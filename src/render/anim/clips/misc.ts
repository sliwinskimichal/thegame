/**
 * Simple clips of E2 (owner: W2) — present and wired into the state machine; full versions in round 2.
 *  - stunned (time, 1.8 s loop): knees give, torso folds forward, the head circles dazed.
 *  - cower (time, 1.2 s loop): FLEE on the spot (no edge): deep crouch, both hands over the head, a tremble.
 *  - ledge (edge t): STEP_UL/UR — crouch and reach (0–0.2), hands on the ledge corner while the root
 *    rises (0.2–0.65, knees tucked), feet onto the ledge and stand up (0.65–1).
 *  - drop (edge t): DROP_* / FALL — step off (until the step-off share of the edge), then the fall pose:
 *    arms up and out, knees bent, looking down (beard and aprons fly up through the springs).
 *  - land (time, 0.28 s + 0.07 s per row, max 4): impact crouch scaled by the fall height, recovery.
 */
import { bump, easeInOut, easeOut, seg, wrap01 } from '../curves';
import { dropStepOff } from '../edge';
import { blendArmFK, holdsOf } from '../holds';
import { AnimPose, setIK } from '../pose';
import { BONE, IK, MV, type AnimClip, type PoseFrame } from '../types';
import { gear, plantFoot, rdOf, stanceZ, tileSize, type AnimCtx } from './common';

export const stunnedClip: AnimClip = {
  id: 'stunned',
  drive: 'time',
  loop: true,
  length: () => 1.8,
  notifies: [],
  cancel: [[0, 1]],
  sample(ctx, phase, out) {
    const d = rdOf(ctx);
    const lu = d.legUnit;
    const ph = wrap01(phase);
    const TAU = Math.PI * 2;
    const r = out.rot;
    out.pos[BONE.PELVIS * 3] = 0.015 * lu * Math.sin(TAU * ph);
    out.pos[BONE.PELVIS * 3 + 1] = -0.055 * lu + 0.008 * lu * Math.sin(TAU * 2 * ph);
    r[BONE.PELVIS * 3] = 0.05 * Math.sin(TAU * ph);
    r[BONE.SPINE * 3 + 2] = -0.3 - 0.04 * Math.sin(TAU * 2 * ph);
    r[BONE.CHEST * 3 + 2] = -0.12;
    r[BONE.HEAD * 3] = 0.18 * Math.sin(TAU * ph);
    r[BONE.HEAD * 3 + 2] = -0.08 + 0.12 * Math.cos(TAU * ph);
    for (const s of [1, -1] as const) {
      const a = s > 0 ? BONE.ARM_R : BONE.ARM_L;
      r[a * 3] = -0.12 * s;
      r[a * 3 + 2] = 0.35;
      r[(s > 0 ? BONE.FORE_R : BONE.FORE_L) * 3 + 2] = 0.35;
    }
    const hs = holdsOf(d);
    if (hs.walk.r) blendArmFK(out, 1, hs.walk.r, 0.5);
    if (hs.walk.l) blendArmFK(out, -1, hs.walk.l, 0.5);
    const z = stanceZ(d) + 0.02 * lu;
    plantFoot(d, out, 1, 0.04 * lu, 0, z, -0.3);
    plantFoot(d, out, -1, -0.04 * lu, 0, -z, 0.3);
    gear(out, 0);
  },
};

export const cowerClip: AnimClip = {
  id: 'cower',
  drive: 'time',
  loop: true,
  length: () => 1.2,
  notifies: [],
  cancel: [[0, 1]],
  sample(ctx, phase, out) {
    const d = rdOf(ctx);
    const lu = d.legUnit;
    const ph = wrap01(phase);
    const r = out.rot;
    const tremble = 0.02 * Math.sin(Math.PI * 2 * 6 * ph);
    out.pos[BONE.PELVIS * 3 + 1] = -0.075 * lu;
    r[BONE.SPINE * 3 + 2] = -0.38;
    r[BONE.CHEST * 3 + 2] = -0.12;
    r[BONE.CHEST * 3] = tremble;
    r[BONE.HEAD * 3 + 2] = -0.1 + tremble;
    const hs = holdsOf(d);
    if (hs.cower.r) blendArmFK(out, 1, hs.cower.r, 1);
    if (hs.cower.l) blendArmFK(out, -1, hs.cower.l, 1);
    const z = stanceZ(d) + 0.03 * lu;
    plantFoot(d, out, 1, 0.03 * lu, 0, z, -0.35);
    plantFoot(d, out, -1, -0.05 * lu, 0, -z, 0.35);
    gear(out, 0);
    if (out instanceof AnimPose) out.attach[0] = out.attach[1] = 0;
  },
};

export const ledgeClip: AnimClip = {
  id: 'ledge',
  drive: 'time',
  loop: false,
  length: () => 0.7,
  notifies: [],
  cancel: [[0.9, 1.01]],
  sample(ctx, phase, out) {
    const d = rdOf(ctx);
    const u = d.unit;
    const lu = d.legUnit;
    const t = Math.min(1, Math.max(0, phase));
    const tile = tileSize(ctx);
    // root displacement so far along the edge curve (same as edgeRoot for STEP_U*), model units
    const ry = tile * easeOut(seg(t, 0, 0.62));
    const rx = tile * easeInOut(seg(t, 0.22, 1));
    // the ledge corner (next tile's top edge) relative to the current root
    const lx = 0.5 * tile - rx;
    const ly = tile - ry;
    const reach = easeInOut(seg(t, 0, 0.15)) * (1 - easeInOut(seg(t, 0.62, 0.85)));
    const tuck = bump(seg(t, 0.15, 0.8), 0.45);
    const r = out.rot;
    out.pos[BONE.PELVIS * 3 + 1] = -0.06 * lu * (1 - seg(t, 0.15, 0.3)) - 0.03 * lu * tuck;
    r[BONE.SPINE * 3 + 2] = -0.45 * (reach + tuck * 0.5);
    r[BONE.CHEST * 3 + 2] = -0.15 * reach;
    r[BONE.HEAD * 3 + 2] = 0.3 * reach;
    for (const s of [1, -1] as const) {
      setIK(out, s > 0 ? IK.HAND_R : IK.HAND_L, lx - 0.02 * u, ly + 0.03 * u, s * 0.16 * u, 1.4, reach);
      const th = s > 0 ? BONE.THIGH_R : BONE.THIGH_L;
      r[th * 3 + 2] = 1.1 * tuck;
      r[(s > 0 ? BONE.SHIN_R : BONE.SHIN_L) * 3 + 2] = -1.5 * tuck;
    }
    // feet planted at the start and again once on the ledge
    const plant = 1 - bump(seg(t, 0.1, 0.9), 0.5);
    const z = d.hipZ + 0.02 * lu;
    plantFoot(d, out, 1, 0.02 * lu, 0, z, -0.15);
    plantFoot(d, out, -1, -0.02 * lu, 0, -z, 0.15);
    out.ikW[IK.FOOT_R] = plant;
    out.ikW[IK.FOOT_L] = plant;
    if (out instanceof AnimPose) out.contact[0] = out.contact[1] = plant > 0.99 ? 1 : 0;
    gear(out, 0);
    void MV;
  },
};

export const dropClip: AnimClip = {
  id: 'drop',
  drive: 'time',
  loop: false,
  length: () => 1,
  notifies: [],
  cancel: [],
  sample(ctx, phase, out) {
    const d = rdOf(ctx);
    const lu = d.legUnit;
    const t = Math.min(1, Math.max(0, phase));
    const rows = (ctx as AnimCtx).rows ?? 1;
    const off = dropStepOff({ move: MV.DROP_R, fromX: 0, fromY: 0, toX: 1, toY: -rows, t, durationMs: 300 + 250 * rows, rows });
    const fall = easeOut(seg(t, off * 0.7, off + 0.15));
    const r = out.rot;
    // stepping off: one stride, leaning toward the drop
    r[BONE.SPINE * 3 + 2] = -0.12 * (1 - fall) + 0.1 * fall;
    r[BONE.HEAD * 3 + 2] = -0.25 * fall;
    for (const s of [1, -1] as const) {
      const a = s > 0 ? BONE.ARM_R : BONE.ARM_L;
      r[a * 3] = -0.55 * s * fall;
      r[a * 3 + 2] = 2.1 * fall + 0.2;
      r[(s > 0 ? BONE.FORE_R : BONE.FORE_L) * 3 + 2] = 0.5;
      const th = s > 0 ? BONE.THIGH_R : BONE.THIGH_L;
      r[th * 3 + 2] = (s > 0 ? 0.55 : 0.25) * fall;
      r[(s > 0 ? BONE.SHIN_R : BONE.SHIN_L) * 3 + 2] = -0.8 * fall;
    }
    const z = d.hipZ + 0.02 * lu;
    plantFoot(d, out, 1, 0.12 * lu * seg(t, 0, off), 0, z, -0.1);
    plantFoot(d, out, -1, -0.02 * lu, 0, -z, 0.1);
    out.ikW[IK.FOOT_R] = 1 - fall;
    out.ikW[IK.FOOT_L] = 1 - fall;
    if (out instanceof AnimPose) out.contact[0] = out.contact[1] = fall > 0 ? 0 : 1;
    gear(out, 0);
  },
};

export const landClip: AnimClip = {
  id: 'land',
  drive: 'time',
  loop: false,
  length: (ctx) => 0.28 + 0.07 * Math.min(4, Math.max(0, (ctx as AnimCtx).rows ?? 1)),
  notifies: [],
  cancel: [[0.6, 1.01]],
  sample(ctx, phase, out) {
    const d = rdOf(ctx);
    const lu = d.legUnit;
    const t = Math.min(1, Math.max(0, phase));
    const s = Math.min(1, Math.max(0.25, ((ctx as AnimCtx).rows ?? 1) / 4));
    const down = bump(t, 0.18);
    const r = out.rot;
    out.pos[BONE.PELVIS * 3 + 1] = -(0.04 + 0.07 * s) * lu * down;
    r[BONE.SPINE * 3 + 2] = -(0.25 + 0.25 * s) * down;
    r[BONE.CHEST * 3 + 2] = -0.1 * down;
    r[BONE.HEAD * 3 + 2] = 0.1 * down;
    for (const sd of [1, -1] as const) {
      const a = sd > 0 ? BONE.ARM_R : BONE.ARM_L;
      r[a * 3] = -0.4 * sd * down;
      r[a * 3 + 2] = 0.6 * down;
      r[(sd > 0 ? BONE.FORE_R : BONE.FORE_L) * 3 + 2] = 0.3;
    }
    const z = stanceZ(d);
    plantFoot(d, out, 1, 0.04 * lu, 0, z, -0.25);
    plantFoot(d, out, -1, -0.04 * lu, 0, -z, 0.25);
    gear(out, 0);
  },
};

export type { PoseFrame };
