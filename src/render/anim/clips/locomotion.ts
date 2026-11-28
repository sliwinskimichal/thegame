/**
 * Locomotion clips (owner: W2): walk, jog, carry and flee are all the parametric gait (gait.ts) —
 * distance-driven, one stride (two steps) per cycle, right heel strike at phase 0, left at 0.5.
 * Speed (ctx.speed, model units/s) picks the gait keys, so one clip covers the whole range from a
 * shuffle to the 2.5 tiles/s flee without foot sliding. The flavours only add layers:
 *  - carry: lean 8° (MOTION.carryLeanDeg), shorter heavier step (longer stance, deeper bob, lower
 *    clearance), arms by the load (CARRY.HANDS sack in front, SHOULDER on the right shoulder, BACK
 *    hands on the frame straps), LOAD shown, tools slung on the back when the hands are busy;
 *  - flee: more lean, the left hand shields the head with ctx.danger.
 */
import { MOTION } from '../../characters/direction';
import { gaitGeom, gaitParams, newGaitParams, sampleGait, armSwingAt, type GaitGeom, type GaitParams } from '../gait';
import { applyArmFK, blendArmFK, holdsOf, type BakedHold } from '../holds';
import { AnimPose } from '../pose';
import { rigData, type RigData } from '../rigdata';
import { BONE, CARRY, NOTIFY, type AnimClip, type ClipContext, type PoseFrame } from '../types';
import { fleeSpeed, gear, rdOf, walkSpeed, type AnimCtx } from './common';

export const FLAVOUR = { WALK: 0, CARRY: 1, FLEE: 2 } as const;

/** Params of the last gaitFor() call (the rig's cached object). */
let P: GaitParams = newGaitParams();
const CARRY_LEAN = (MOTION.carryLeanDeg * Math.PI) / 180;

/** Carry type a dwarf uses when the input does not say (porters load the frame, others a sack). */
export function carryType(ctx: ClipContext): number {
  if (ctx.carry > 0) return ctx.carry;
  return ctx.rig.back === 'frame' ? CARRY.BACK : CARRY.HANDS;
}

/**
 * Gait parameters and geometry at speed v for a flavour. Cached per rig (the last speed and flavour):
 * the speed of an edge is constant, so the reach verification runs once per speed change.
 */
export function gaitFor(d: RigData, v: number, flavour: number): GaitGeom {
  const c = d.cache;
  if (!c.gaitP) {
    c.gaitP = newGaitParams();
    c.gaitG = { lcMax: 0, heelStrike: 0, stride: 0 };
  }
  P = c.gaitP as GaitParams;
  const g = c.gaitG as GaitGeom;
  if (c.gaitV === v && c.gaitFlavour === flavour) return g;
  computeGait(d, v, flavour, P, g);
  c.gaitV = v;
  c.gaitFlavour = flavour;
  return g;
}

/** Params that belong to the geometry the last gaitFor() returned. */
export function lastGaitParams(): GaitParams {
  return P;
}

function computeGait(d: RigData, v: number, flavour: number, outP: GaitParams, outG: GaitGeom): GaitGeom {
  gaitParams(d, v, outP);
  if (flavour === FLAVOUR.CARRY) {
    outP.duty = Math.min(0.72, outP.duty + 0.04);
    outP.crouch -= 0.012 * d.legUnit;
    outP.bob *= 1.4;
    outP.lean += CARRY_LEAN;
    outP.clear *= 0.75;
    outP.armSwing *= 0.35;
    outP.lcFrac *= 0.88;
    outP.twist *= 0.7;
  } else if (flavour === FLAVOUR.FLEE) {
    outP.lean += 0.06;
  }
  return gaitGeom(d, outP, v, outG);
}

function holdFor(ctx: ClipContext, flavour: number): BakedHold {
  const hs = holdsOf(rdOf(ctx));
  if (flavour === FLAVOUR.CARRY) return hs.carry[carryType(ctx)] ?? hs.walk;
  return hs.walk;
}

/** Arms, gear and the carry lean of a locomotion pose (also used by idle + carry). */
export function locoArms(ctx: ClipContext, out: PoseFrame, flavour: number, swing: number): void {
  const hs = holdsOf(rdOf(ctx));
  const h = holdFor(ctx, flavour);
  if (h.r) applyArmFK(out, 1, h.r, swing * h.swing);
  if (h.l) applyArmFK(out, -1, h.l, -swing * h.swing);
  if (flavour === FLAVOUR.FLEE) {
    const w = Math.max(0, Math.min(1, ctx.danger));
    if (hs.flee.l && w > 0) blendArmFK(out, -1, hs.flee.l, w);
  }
  const carrying = flavour === FLAVOUR.CARRY;
  const type = carrying ? carryType(ctx) : CARRY.NONE;
  gear(out, carrying ? 1 : 0);
  if (out instanceof AnimPose) {
    const sling = carrying && hs.slingOnCarry[type] ? 1 : 0;
    out.attach[0] = ctx.rig.toolR ? sling : 0;
    out.attach[1] = ctx.rig.toolL ? sling : 0;
  }
  if (carrying && type === CARRY.SHOULDER) shoulderLoad(rigData(ctx.rig), out);
}

/** Move the LOAD socket from its rest (in front of the belly) onto the right shoulder. */
function shoulderLoad(d: RigData, out: PoseFrame): void {
  const r = d.rest;
  const tx = -0.02 * d.unit;
  const ty = d.shoulderY + 0.14 * d.unit;
  const tz = d.shoulderZ * 0.7;
  // LOAD's parent is CHEST: the offset is in the chest frame (rest orientation identity)
  out.pos[BONE.LOAD * 3] = tx - r[BONE.LOAD * 3]!;
  out.pos[BONE.LOAD * 3 + 1] = ty - r[BONE.LOAD * 3 + 1]!;
  out.pos[BONE.LOAD * 3 + 2] = tz - r[BONE.LOAD * 3 + 2]!;
}

/** Carry layer on a standing pose (idle + load): lean, arms, load. */
export function carryStanding(ctx: ClipContext, out: PoseFrame): void {
  out.rot[BONE.SPINE * 3 + 2] -= CARRY_LEAN * 0.55;
  out.rot[BONE.CHEST * 3 + 2] -= CARRY_LEAN * 0.45;
  out.rot[BONE.HEAD * 3 + 2] += CARRY_LEAN * 0.7;
  out.pos[BONE.PELVIS * 3 + 1] -= 0.012 * rigData(ctx.rig).legUnit;
  locoArms(ctx, out, FLAVOUR.CARRY, 0);
}

function makeLoco(id: string, flavour: number, defaultSpeed: (ctx: ClipContext) => number): AnimClip {
  const speedOf = (ctx: ClipContext) => (ctx.speed > 1e-6 ? ctx.speed : defaultSpeed(ctx));
  return {
    id,
    drive: 'distance',
    loop: true,
    length(ctx) {
      return gaitFor(rdOf(ctx), speedOf(ctx), flavour).stride;
    },
    notifies: [
      { phase: 0, kind: NOTIFY.FOOT_DOWN, side: 0 },
      { phase: 0.5, kind: NOTIFY.FOOT_DOWN, side: 1 },
    ],
    cancel: [[0, 1]],
    sample(ctx, phase, out) {
      const d = rdOf(ctx);
      const v = speedOf(ctx);
      const g = gaitFor(d, v, flavour);
      sampleGait(d, P, g, phase, out, (ctx as AnimCtx).slope ?? 0, ctx.viewYaw);
      locoArms(ctx, out, flavour, armSwingAt(P, phase));
    },
  };
}

export const walkClip = makeLoco('walk', FLAVOUR.WALK, walkSpeed);
export const jogClip = makeLoco('jog', FLAVOUR.WALK, fleeSpeed);
export const carryClip = makeLoco('carry', FLAVOUR.CARRY, walkSpeed);
export const fleeClip = makeLoco('flee', FLAVOUR.FLEE, fleeSpeed);
