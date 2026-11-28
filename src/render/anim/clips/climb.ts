/**
 * climb (owner: W2): ladder climbing driven by the root height on the rung lattice — one cycle =
 * two rungs; the animator sets phase = frac((rootY - rungOffset) / (2 · spacing)), so a planted hand
 * or foot sits EXACTLY on a world rung in every phase (going up or down; down just plays backward).
 *
 * Four-beat gait repeated twice per cycle (one rung per limb move: with legs of ~0.22 a two-rung
 * step would be higher than the leg). Each limb moves for 30% of a half-cycle, holds 70%:
 *   right hand 0.000–0.150 · right foot 0.125–0.275 · left hand 0.250–0.400 · left foot 0.375–0.525
 *   (+0.5 for the second beat). RUNG_GRAB when a hand lands (0.15 / 0.65 right, 0.40 / 0.90 left),
 *   FOOT_DOWN when a foot lands (0.275 / 0.775 right, 0.025 / 0.525 left).
 * The dwarf turns its back to the camera with ~30° toward its right side (absolute yaw: the clip
 * cancels the variant's view yaw), so the headgear and the back gear read; the tools are slung on
 * the back (rig re-parenting), the beard swings aside off the ladder, the head looks up.
 * Model-space ladder plane: the root stands `climbStandoff` in front of it (animator), so with the
 * yaw ψ a model point (x, z) lies on the plane when x = (standoff + cos ψ · z) / sin ψ.
 */
import { MOTION } from '../../characters/direction';
import { easeInOut, frac } from '../curves';
import { AnimPose, setIK } from '../pose';
import type { RigData } from '../rigdata';
import { BONE, IK, NOTIFY, type AnimClip, type ClipContext, type PoseFrame } from '../types';
import { gear, rdOf, rungSpacing } from './common';

/** Absolute yaw of the climbing body (placement Ry): forward into the wall, 30° to the right side. */
export const CLIMB_YAW = (60 * Math.PI) / 180;
/** One beat = half a cycle (one rung of root travel); a limb move takes 30% of it. */
const BEAT = 0.5;
const MOVE = 0.15;
/** Limb schedule: start of the move (phase, first beat), side, hand? */
const LIMBS = [
  { start: 0.0, side: 1, hand: true },
  { start: 0.125, side: 1, hand: false },
  { start: 0.25, side: -1, hand: true },
  { start: 0.375, side: -1, hand: false },
] as const;

/**
 * Root distance in front of the ladder plane. The barrel torso (r ≈ chestR) would keep the hips out
 * of the legs' reach of the rungs, so the body overlaps the ladder a little; seen from behind (back to
 * the camera) the rungs are hidden by the body, the hands and feet on them are not.
 */
export function climbStandoff(d: RigData): number {
  return d.chestR * 0.35;
}

/** x of the ladder plane at model z (see header). */
function planeX(d: RigData, z: number): number {
  return (climbStandoff(d) + Math.cos(CLIMB_YAW) * z) / Math.sin(CLIMB_YAW);
}

/**
 * Relative height (to the root) of a limb's rung and its move state at a phase.
 * Returns the height; `o[0]` = 1 while moving, `o[1]` = move progress 0..1.
 */
function limbHeight(target: number, sp: number, start: number, phase: number, o: Float64Array): number {
  // local time in the current beat since this limb's move started
  const u = frac((phase - start) / BEAT) * BEAT;
  // the move that ended last (or ends now): its end phase, and the rung it landed on (lattice
  // point nearest to the target height at that moment)
  const end = phase - u + MOVE;
  const K = Math.round((target + 2 * sp * end) / sp);
  const yEnd = K * sp - 2 * sp * end;
  if (u >= MOVE) {
    o[0] = 0;
    o[1] = 1;
    return yEnd - 2 * sp * (u - MOVE);
  }
  o[0] = 1;
  o[1] = u / MOVE;
  // from the rung below (relative yEnd - 2sp(BEAT - MOVE)) up to yEnd while the root rises
  const drop = 2 * sp * (BEAT - MOVE);
  return yEnd - drop + drop * easeInOut(u / MOVE);
}

const st = new Float64Array(2);

export const climbClip: AnimClip = {
  id: 'climb',
  drive: 'distance',
  loop: true,
  length: (ctx) => 2 * rungSpacing(ctx),
  notifies: [
    { phase: 0.15, kind: NOTIFY.RUNG_GRAB, side: 0 },
    { phase: 0.275, kind: NOTIFY.FOOT_DOWN, side: 0 },
    { phase: 0.4, kind: NOTIFY.RUNG_GRAB, side: 1 },
    { phase: 0.525, kind: NOTIFY.FOOT_DOWN, side: 1 },
    { phase: 0.65, kind: NOTIFY.RUNG_GRAB, side: 0 },
    { phase: 0.775, kind: NOTIFY.FOOT_DOWN, side: 0 },
    { phase: 0.9, kind: NOTIFY.RUNG_GRAB, side: 1 },
    { phase: 0.025, kind: NOTIFY.FOOT_DOWN, side: 1 },
  ],
  cancel: [[0, 1]],
  sample(ctx: ClipContext, phase: number, out: PoseFrame): void {
    const d = rdOf(ctx);
    const u = d.unit;
    const lu = d.legUnit;
    const sp = rungSpacing(ctx);
    const ph = phase < 0 || phase > 1 ? frac(phase) : phase;
    const r = out.rot;
    // body turned to the wall, absolute yaw (cancels the variant's view yaw)
    out.root[3] = ctx.viewYaw + CLIMB_YAW;
    // targets: hands beside the head, feet around the root
    const handT = d.shoulderY + 0.16 * u;
    const footT = 0.02 * lu;
    let footSum = 0;
    let wxSum = 0;
    const cy = Math.cos(CLIMB_YAW);
    const sy = Math.sin(CLIMB_YAW);
    for (let i = 0; i < 4; i++) {
      const L = LIMBS[i]!;
      const h = limbHeight(L.hand ? handT : footT, sp, L.start, ph, st);
      const moving = st[0] === 1;
      const away = moving ? Math.sin(Math.PI * st[1]!) : 0;
      if (L.hand) {
        const z = L.side * 0.82 * d.shoulderZ;
        const x = planeX(d, z) - 0.015 * u - 0.07 * u * away;
        setIK(out, L.side > 0 ? IK.HAND_R : IK.HAND_L, x, h + 0.012 * u, z, 1.25 + 0.4 * away, 1);
        wxSum += x * cy + z * sy;
      } else {
        const z = L.side * 0.12 * lu;
        // the arch of the boot on the rung: the ankle ~0.05 behind and above it
        const x = planeX(d, z) - 0.05 * lu - 0.06 * lu * away;
        wxSum += x * cy + z * sy;
        const y = h + d.ankleY + 0.012 * lu + 0.03 * lu * away;
        setIK(out, L.side > 0 ? IK.FOOT_R : IK.FOOT_L, x, y, z, -0.12 - 0.25 * away, 1);
        r[(L.side > 0 ? BONE.FOOT_R : BONE.FOOT_L) * 3 + 1] = 0;
        footSum += h;
        if (out instanceof AnimPose) {
          const si = L.side > 0 ? 0 : 1;
          out.contact[si] = moving ? 0 : 1;
          out.pivot[si * 3] = x + 0.05 * lu;
          out.pivot[si * 3 + 1] = h;
          out.pivot[si * 3 + 2] = z;
        }
      }
    }
    // centre the limbs on the ladder (world x along the rungs), mirrored with the facing
    out.root[0] = -wxSum / 4;
    // pelvis rides over the feet (mean hip-ankle height ~half the leg), close to the ladder
    const feet = footSum * 0.5;
    out.pos[BONE.PELVIS * 3] = 0.05 * u;
    out.pos[BONE.PELVIS * 3 + 1] = feet + d.ankleY + 0.012 * lu + 0.5 * d.legReach - d.hipY;
    r[BONE.PELVIS * 3 + 2] = -0.05;
    r[BONE.SPINE * 3 + 2] = -0.08;
    r[BONE.CHEST * 3 + 2] = -0.04;
    r[BONE.CHEST * 3] = 0.06 * Math.sin(2 * Math.PI * ph);
    r[BONE.HEAD * 3 + 2] = 0.3;
    // the beard swings aside (toward the camera side) instead of pressing into the rungs
    r[BONE.BEARD * 3] = -0.4;
    r[BONE.BEARD * 3 + 2] = 0.1;
    gear(out, 0);
    if (out instanceof AnimPose) {
      out.attach[0] = ctx.rig.toolR ? 1 : 0;
      out.attach[1] = ctx.rig.toolL ? 1 : 0;
    }
    void MOTION;
  },
};
