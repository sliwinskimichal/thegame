/**
 * Shared helpers of the clips (owner: W2).
 *
 * Clip context: the contract ClipContext (v2: viewYaw, danger, time) plus optional extras the
 * animator passes for its internal states. Lengths in the context are MODEL units (the animator
 * divides world inputs by worldPerModel); `worldPerModel` lets a clip convert world features
 * (tile size, rung spacing) when it needs them.
 */
import { CHARACTER_SCALE, MOTION } from '../../characters/direction';
import { AnimPose, setIK } from '../pose';
import type { RigData } from '../rigdata';
import { BONE, IK, type ClipContext, type PoseFrame } from '../types';

export interface AnimCtx extends ClipContext {
  /** World tiles per model unit (default CHARACTER_SCALE.worldPerModel). */
  worldPerModel?: number;
  /** Ground slope dy/dx along the facing (stairs), model space. */
  slope?: number;
  /** Fall height in rows (land strength), edge progress for edge-driven states. */
  rows?: number;
}

export function wpm(ctx: ClipContext): number {
  return (ctx as AnimCtx).worldPerModel ?? CHARACTER_SCALE.worldPerModel;
}
/** One world tile in model units. */
export function tileSize(ctx: ClipContext): number {
  return 1 / wpm(ctx);
}
/** Default speeds (model units/s): the sim walk and the flee jog (MOTION, world tiles/s). */
export function walkSpeed(ctx: ClipContext): number {
  return MOTION.walkTilesPerSecond / wpm(ctx);
}
export function fleeSpeed(ctx: ClipContext): number {
  return MOTION.fleeTilesPerSecond / wpm(ctx);
}
/** Rung spacing (model units) from the probe or the lab dressing default. */
export function rungSpacing(ctx: ClipContext): number {
  return (ctx.probe ? ctx.probe.ladder.rungSpacing : MOTION.rungSpacing) / wpm(ctx);
}

/** Plant a foot flat (or pitched) with its heel as the pivot. */
export function plantFoot(d: RigData, out: PoseFrame, side: 1 | -1, x: number, y: number, z: number, yaw: number, pitch = 0): void {
  const e = side > 0 ? IK.FOOT_R : IK.FOOT_L;
  const fb = side > 0 ? BONE.FOOT_R : BONE.FOOT_L;
  setIK(out, e, x, y + d.ankleY, z, pitch, 1);
  out.rot[fb * 3] = 0;
  out.rot[fb * 3 + 1] = yaw;
  if (out instanceof AnimPose) {
    const si = side > 0 ? 0 : 1;
    out.contact[si] = 1;
    // heel point of the flat foot (yaw about +Y: x' = x cos, z' = -x sin)
    out.pivot[si * 3] = x + d.heelX * Math.cos(yaw);
    out.pivot[si * 3 + 1] = y;
    out.pivot[si * 3 + 2] = z - d.heelX * Math.sin(yaw);
  }
}

/** Idle/wide stance foot z: thighs abducted ~14° (concept card stance 0.58 at preset A). */
export function stanceZ(d: RigData): number {
  return d.hipZ + d.legReach * Math.sin((14 * Math.PI) / 180);
}

/** Gear visibility every clip sets: the load hidden unless carried, the back gear shown. */
export function gear(out: PoseFrame, load: number, back = 1): void {
  out.scale[BONE.LOAD] = load;
  out.scale[BONE.BACK] = back;
}
