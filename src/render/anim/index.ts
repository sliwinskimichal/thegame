/**
 * Public entry of the animation module (owner: W2 "Animator ruchu", dwarf team).
 * Replaces the lead's stub; the exported names stay: createAnimator, animMetrics, the contract types.
 *
 *  createAnimator(rig, { viewYawDeg, worldPerModel?, probe? }) -> DwarfAnimator
 *    state machine (AS), rig with two-bone IK (feet on floors/steps/rungs, hands on tools/rungs),
 *    distance-driven gait for every speed, dig/build swings with notifies, ladder climbing on the rung
 *    lattice, secondary motion (beard, aprons, lantern); allocation-free update; deterministic.
 *  animMetrics(rig) -> { slipWalk, slipNav, seamJump } (characters/types.ts AnimMetrics).
 *  CLIPS — the clips (lab poses, tests).
 */
import { Animator } from './machine';
import type { CreateAnimator } from './types';

export * from './types';
export { animMetrics, measureSlip, seamJump } from './metrics';
export { CLIPS } from './clips/index';
export { TRANSITION_IN, STATE_CLIP, TURN_SECONDS } from './machine';
export { conceptSpeed } from './gait';

export const createAnimator: CreateAnimator = (rig, opts) => new Animator(rig, opts);
