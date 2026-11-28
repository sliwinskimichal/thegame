/**
 * Clip registry of the animator (owner: W2). `CLIPS` holds every clip id the lab may ask for in
 * `pose()` (contract CLIP_IDS) plus the animator's internal states. Clips not yet built fall back
 * to idle in the state machine (never in pose(): an unknown id is an error).
 */
import type { AnimClip, ClipContext } from '../types';
import { idleClip } from './idle';
import { climbClip } from './climb';
import { carryClip, fleeClip, jogClip, walkClip } from './locomotion';
import { cowerClip, dropClip, landClip, ledgeClip, stunnedClip } from './misc';
import { buildClip, digClip } from './swing';

/** A clip that can also tell where its tool strikes (model space), for DIG_HIT. */
export interface StrikeClip extends AnimClip {
  strike(ctx: ClipContext, out: Float64Array): void;
}

export const CLIPS: Record<string, AnimClip> = {
  idle: idleClip,
  walk: walkClip,
  jog: jogClip,
  carry: carryClip,
  flee: fleeClip,
  dig: digClip,
  build: buildClip,
  climb: climbClip,
  stunned: stunnedClip,
  cower: cowerClip,
  ledge: ledgeClip,
  drop: dropClip,
  land: landClip,
};

export function registerClip(c: AnimClip): void {
  CLIPS[c.id] = c;
}

export { idleClip, walkClip, jogClip, carryClip, fleeClip, digClip, buildClip, climbClip, stunnedClip, cowerClip, ledgeClip, dropClip, landClip };
