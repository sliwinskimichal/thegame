/**
 * Motion metrics (owner: W2), AnimMetrics in characters/types.ts:
 *  - slipWalk / slipNav: the dwarf walks along straight nav edges (state machine, root motion, IK,
 *    the real bone matrices) at 120 Hz; for every frame a foot is planted, the foot-local point the
 *    clip pins (heel or toe) is taken through the solved FOOT matrix and the placement to world, and
 *    its horizontal speed is divided by the walking speed. Reported: the maximum over both feet and
 *    3 cycles. slipWalk = max over the concept walk and the sim walk (MOTION.walkTilesPerSecond);
 *    slipNav = the flee jog (MOTION.fleeTilesPerSecond).
 *  - seamJump: for every looping clip, bone positions through the rig at 60 Hz around the seam; the
 *    jump across the seam minus the smooth continuation of the frame before (second difference) —
 *    0 for a seamless cycle whatever the bones' speed. World tiles.
 */
import { CHARACTER_SCALE, MOTION } from '../characters/direction';
import { CLIPS } from './clips/index';
import type { AnimCtx } from './clips/common';
import { conceptSpeed } from './gait';
import { Animator } from './machine';
import { AnimPose } from './pose';
import { Rig } from './rig';
import { rigData } from './rigdata';
import { BONE, BONE_COUNT, CARRY, MV, SIM, WORK, type AnimInput, type RigInput } from './types';

export interface SlipResult {
  /** max planted-pivot horizontal speed / walk speed */
  slip: number;
  /** speed in world tiles/s, stride (world), cadence (steps/s) */
  speed: number;
  stride: number;
  stepsPerSecond: number;
  footDowns: number;
  cycles: number;
}

export function baseInput(x = 0.5, y = -1): AnimInput {
  return { sim: SIM.IDLE, x, y, facing: 1, edge: null, work: WORK.NONE, workX: Number.NaN, workY: Number.NaN, carry: CARRY.NONE, danger: 0 };
}

/** Walk along WALK_R edges of one tile at `speed` world tiles/s; measure the planted feet. */
export function measureSlip(rig: RigInput, speed: number, opts: { worldPerModel?: number; viewYawDeg?: number; carry?: number; sim?: number; seconds?: number } = {}): SlipResult {
  const k = opts.worldPerModel ?? CHARACTER_SCALE.worldPerModel;
  const a = new Animator(rig, { viewYawDeg: opts.viewYawDeg ?? 40, worldPerModel: k });
  const d = a.d;
  const dt = 1 / 120;
  const tileMs = 1000 / speed;
  const input = baseInput(0.5, -1);
  input.sim = opts.sim ?? SIM.GOTO;
  input.carry = opts.carry ?? CARRY.NONE;
  const edge = { move: MV.WALK_R, fromX: 0.5, fromY: -1, toX: 1.5, toY: -1, t: 0, durationMs: tileMs, rows: 0 };
  input.edge = edge;
  const total = opts.seconds ?? 6;
  const warm = 1.0;
  let t = 0;
  let maxSlip = 0;
  let footDowns = 0;
  // previous world x of the heel and the toe of each foot (the pinned point may switch heel -> toe)
  const prevHeel = [Number.NaN, Number.NaN];
  const prevToe = [Number.NaN, Number.NaN];
  const heel = new Float64Array(3);
  const toe = new Float64Array(3);
  const notes: import('./types').AnimNotify[] = [];
  let phaseTravel = 0;
  let lastPhase = Number.NaN;
  while (t < total) {
    const ms = t * 1000;
    const step = Math.floor(ms / tileMs);
    edge.fromX = 0.5 + step;
    edge.toX = 1.5 + step;
    edge.t = (ms - step * tileMs) / tileMs;
    a.update(input, dt);
    t += dt;
    const n = a.drainNotifies(notes);
    if (t < warm) continue;
    for (let i = 0; i < n; i++) if (notes[i]!.kind === 0) footDowns++;
    if (!Number.isNaN(lastPhase)) {
      let dp = a.phase - lastPhase;
      if (dp < -0.5) dp += 1;
      phaseTravel += dp;
    }
    lastPhase = a.phase;
    const pose = a.out;
    for (let s = 0; s < 2; s++) {
      footPoints(a, s, heel, toe);
      if (pose.contact[s] === 1 && !Number.isNaN(prevHeel[s]!)) {
        const useToe = pinnedIsToe(a, s);
        const v = Math.abs(useToe ? toe[0]! - prevToe[s]! : heel[0]! - prevHeel[s]!) / dt;
        maxSlip = Math.max(maxSlip, v / speed);
      }
      prevHeel[s] = pose.contact[s] === 1 ? heel[0]! : Number.NaN;
      prevToe[s] = toe[0]!;
    }
  }
  const seconds = total - warm;
  const strideWorld = phaseTravel > 0 ? (speed * seconds) / phaseTravel : 0;
  void d;
  return { slip: maxSlip, speed, stride: strideWorld, stepsPerSecond: (2 * speed) / Math.max(1e-9, strideWorld), footDowns, cycles: phaseTravel };
}

/** World heel and toe points of foot s through the solved FOOT matrix and the placement. */
export function footPoints(a: Animator, s: number, heel: Float64Array, toe: Float64Array): void {
  const d = a.d;
  const fb = s === 0 ? BONE.FOOT_R : BONE.FOOT_L;
  a.rig.point(fb, d.heelX, -d.ankleY, 0, heel, 0);
  a.toWorld(heel[0]!, heel[1]!, heel[2]!, heel, 0);
  a.rig.point(fb, d.toeX, -d.ankleY, 0, toe, 0);
  a.toWorld(toe[0]!, toe[1]!, toe[2]!, toe, 0);
}

const tmp3 = new Float64Array(6);
/** Whether the clip pins the toe (else the heel) of foot s this frame: nearest of the two to the clip pivot. */
export function pinnedIsToe(a: Animator, s: number): boolean {
  const d = a.d;
  const fb = s === 0 ? BONE.FOOT_R : BONE.FOOT_L;
  const pv = a.out.pivot;
  a.rig.point(fb, d.heelX, -d.ankleY, 0, tmp3, 0);
  a.rig.point(fb, d.toeX, -d.ankleY, 0, tmp3, 3);
  const eh = Math.hypot(tmp3[0]! - pv[s * 3]!, tmp3[1]! - pv[s * 3 + 1]!, tmp3[2]! - pv[s * 3 + 2]!);
  const et = Math.hypot(tmp3[3]! - pv[s * 3]!, tmp3[4]! - pv[s * 3 + 1]!, tmp3[5]! - pv[s * 3 + 2]!);
  return et < eh;
}

const SEAM_CLIPS = ['idle', 'walk', 'jog', 'carry', 'flee', 'dig', 'build', 'climb', 'stunned'];

/**
 * Seam quality of the looping clips (world tiles). For every bone the "excess" of a 60 Hz step is
 * the step minus the mean of its two neighbours (second difference: 0 for uniform motion, large for
 * a jump — but also large for any genuinely fast move). seamJump = how much the step across the seam
 * exceeds the sharpest step anywhere else in the same cycle, so a seamless cycle scores 0 however
 * fast its limbs move; `seamRaw` keeps the plain seam excess for reference.
 */
export function seamJump(rig: RigInput, worldPerModel = CHARACTER_SCALE.worldPerModel): { max: number; byClip: Record<string, number>; seamRaw: Record<string, number> } {
  const r = new Rig(rig);
  const d = rigData(rig);
  const pose = new AnimPose();
  const ctx: AnimCtx = { rig, speed: 0, carry: CARRY.NONE, aimX: 1 / worldPerModel, aimY: 0.5 / worldPerModel, probe: null, viewYaw: 0.7, danger: 0, time: 0, worldPerModel };
  const byClip: Record<string, number> = {};
  const seamRaw: Record<string, number> = {};
  let max = 0;
  const P = [new Float64Array(BONE_COUNT * 3), new Float64Array(BONE_COUNT * 3), new Float64Array(BONE_COUNT * 3), new Float64Array(BONE_COUNT * 3)];
  const excessAt = (clip: (typeof CLIPS)[string], centre: number, dph: number): number => {
    // samples at centre - 1.5, -0.5, +0.5, +1.5 steps (raw phases: 1 stays 1, the seam is not wrapped)
    const phases = [centre - 1.5 * dph, centre - 0.5 * dph, centre + 0.5 * dph, centre + 1.5 * dph];
    phases.forEach((ph, i) => {
      pose.reset();
      clip!.sample(ctx, ph < 0 ? ph + 1 : ph > 1 ? ph - 1 : ph, pose);
      r.solve(pose);
      for (let b = 0; b < BONE_COUNT; b++) for (let c = 0; c < 3; c++) P[i]![b * 3 + c] = r.W[b * 16 + 12 + c]!;
    });
    let m = 0;
    for (let b = 0; b < BONE_COUNT; b++) {
      let e2 = 0;
      for (let c = 0; c < 3; c++) {
        const before = P[1]![b * 3 + c]! - P[0]![b * 3 + c]!;
        const across = P[2]![b * 3 + c]! - P[1]![b * 3 + c]!;
        const after = P[3]![b * 3 + c]! - P[2]![b * 3 + c]!;
        const ex = across - 0.5 * (before + after);
        e2 += ex * ex;
      }
      m = Math.max(m, Math.sqrt(e2));
    }
    return m;
  };
  for (const id of SEAM_CLIPS) {
    const clip = CLIPS[id];
    if (!clip || !clip.loop) continue;
    ctx.carry = id === 'carry' ? (d.input.back === 'frame' ? CARRY.BACK : CARRY.HANDS) : CARRY.NONE;
    const len = clip.length(ctx);
    const v = clip.drive === 'distance' ? (id === 'jog' || id === 'flee' ? MOTION.fleeTilesPerSecond : id === 'climb' ? 1 / 0.9 : MOTION.walkTilesPerSecond) / worldPerModel : 0;
    const dph = clip.drive === 'distance' ? v / 60 / len : 1 / 60 / len;
    // the seam: samples straddle phase 1 -> 0 (centre 0 with the negative phases mapped to 1 - x)
    const seam = excessAt(clip, 0, dph);
    let other = 0;
    const N = Math.max(24, Math.ceil(1 / dph));
    for (let i = 1; i < N; i++) other = Math.max(other, excessAt(clip, i / N, dph));
    seamRaw[id] = seam * worldPerModel;
    byClip[id] = Math.max(0, seam - other) * worldPerModel;
    max = Math.max(max, byClip[id]!);
  }
  return { max, byClip, seamRaw };
}

/** AnimMetrics for the lab (W3) and the tournament. */
export function animMetrics(rig: RigInput, worldPerModel = CHARACTER_SCALE.worldPerModel): { slipWalk: number; slipNav: number; seamJump: number } {
  const d = rigData(rig);
  const vc = conceptSpeed(d) * worldPerModel;
  const opts = { worldPerModel, seconds: 4 };
  const slipWalk = Math.max(measureSlip(rig, vc, opts).slip, measureSlip(rig, MOTION.walkTilesPerSecond, opts).slip);
  const slipNav = measureSlip(rig, MOTION.fleeTilesPerSecond, opts).slip;
  return { slipWalk, slipNav, seamJump: seamJump(rig, worldPerModel).max };
}
