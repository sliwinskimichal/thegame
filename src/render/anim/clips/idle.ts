/**
 * idle (owner: W2): time-driven loop of two breaths and one weight shift (breath 3–4 s from the
 * seed, chest ±1.5°), soft knees, the beard follows through secondary motion, the hands hold the
 * role's things (miner: pick head down on the floor by the boot, IK-planted).
 *
 *  phase  0.00 ........ 0.25 ........ 0.50 ........ 0.75 ........ 1.00
 *  breath in ───── out ───── in ───── out ─────
 *  weight      on the right foot ─────────── on the left foot ───────────
 */
import { wobble, wrap01 } from '../curves';
import { applyArmFK, applyArmIK, holdsOf } from '../holds';
import { rigData } from '../rigdata';
import { Rig } from '../rig';
import { BONE, type AnimClip, type ClipContext, type PoseFrame, type RigInput } from '../types';
import { gear, plantFoot, rdOf, stanceZ } from './common';

const rigs = new WeakMap<RigInput, Rig>();
/** Scratch rig per RigInput for hold baking (holds are cached per rig input). */
export function scratchRig(input: RigInput): Rig {
  let r = rigs.get(input);
  if (!r) {
    r = new Rig(input);
    rigs.set(input, r);
  }
  return r;
}

/** Breath period of a dwarf (3–4 s from the seed). */
export function breathPeriod(rig: RigInput): number {
  return 3 + rigData(rig).seedA;
}

export const idleClip: AnimClip = {
  id: 'idle',
  drive: 'time',
  loop: true,
  length: (ctx) => 2 * breathPeriod(ctx.rig),
  notifies: [],
  cancel: [[0, 1]],
  sample(ctx: ClipContext, phase: number, out: PoseFrame): void {
    const d = rdOf(ctx);
    const u = d.legUnit;
    const ph = wrap01(phase);
    const TAU = Math.PI * 2;
    const breath = Math.sin(TAU * 2 * ph);
    const weight = Math.sin(TAU * ph);
    const r = out.rot;
    const p = out.pos;
    p[BONE.PELVIS * 3 + 1] = -0.016 * u + 0.002 * u * breath;
    p[BONE.PELVIS * 3 + 2] = 0.018 * u * weight;
    r[BONE.PELVIS * 3] = -0.03 * weight;
    r[BONE.PELVIS * 3 + 1] = 0.03 * Math.sin(TAU * ph + 1);
    r[BONE.SPINE * 3] = 0.02 * weight;
    r[BONE.SPINE * 3 + 2] = -0.03 - 0.008 * breath;
    r[BONE.CHEST * 3] = 0.012 * weight;
    r[BONE.CHEST * 3 + 2] = -0.02 - 0.026 * breath; // ±1.5°
    p[BONE.ARM_R * 3 + 1] = 0.004 * d.unit * breath;
    p[BONE.ARM_L * 3 + 1] = 0.004 * d.unit * breath;
    r[BONE.HEAD * 3 + 1] = 0.13 * wobble(ph, d.seedB);
    r[BONE.HEAD * 3 + 2] = 0.04 + 0.01 * breath + 0.03 * wobble(ph * 2, d.seedC);
    // wide stance, toes out, the right foot a little ahead
    const z = stanceZ(d);
    plantFoot(d, out, 1, 0.035 * u, 0, z, -0.24);
    plantFoot(d, out, -1, -0.03 * u, 0, -z, 0.24);
    // free arms hang slightly forward with soft elbows
    r[BONE.ARM_R * 3] = -0.1;
    r[BONE.ARM_R * 3 + 2] = 0.05 + 0.02 * breath;
    r[BONE.FORE_R * 3 + 2] = 0.3;
    r[BONE.ARM_L * 3] = 0.1;
    r[BONE.ARM_L * 3 + 2] = 0.05 + 0.02 * breath;
    r[BONE.FORE_L * 3 + 2] = 0.3;
    const hs = holdsOf(d);
    const h = hs.idle;
    if (h.r) {
      // a tool resting on the floor is IK-planted (it must not sink with the breath)
      if (h.r.spec.tool[2] > 1.5 && h === hs.idle && hs.idle !== hs.walk) applyArmIK(out, 1, h.r, 1);
      else applyArmFK(out, 1, h.r, 0.02 * breath);
    }
    if (h.l) applyArmFK(out, -1, h.l, 0.02 * breath);
    gear(out, 0);
  },
};
