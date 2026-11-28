/**
 * Root motion along a nav edge (owner: W2): the visual feet position for `AnimEdge` (world units),
 * one curve per move so the position and the planted feet agree:
 *  - WALK_*, UP / DOWN, STAIR_*, LINK: linear (constant speed; distance-driven clips plant feet);
 *  - STEP_UL / STEP_UR (clamber onto a 1-tile ledge): rise first, then forward (arc);
 *  - DROP_*: step off to the ledge edge, then a ballistic fall (constant acceleration from rest);
 *  - FALL: let go of the ladder, ballistic straight down.
 * The step-off share of a drop comes from the nav cost model (300 ms + 250 ms per row).
 */
import { easeInOut, easeOut, seg } from './curves';
import { MV, type AnimEdge } from './types';

export function edgeRoot(e: AnimEdge, out: Float64Array): void {
  const t = e.t < 0 ? 0 : e.t > 1 ? 1 : e.t;
  const dx = e.toX - e.fromX;
  const dy = e.toY - e.fromY;
  let fx = t;
  let fy = t;
  switch (e.move) {
    case MV.STEP_UL:
    case MV.STEP_UR:
      fy = easeOut(seg(t, 0, 0.62));
      fx = easeInOut(seg(t, 0.22, 1));
      break;
    case MV.DROP_L:
    case MV.DROP_R: {
      const off = dropStepOff(e);
      fx = t < off ? 0.5 * (t / off) : 0.5 + 0.5 * ((t - off) / (1 - off));
      fy = t < off ? 0 : ((t - off) / (1 - off)) ** 2;
      break;
    }
    case MV.FALL: {
      const off = 0.12;
      fx = t;
      fy = t < off ? 0 : ((t - off) / (1 - off)) ** 2;
      break;
    }
    default:
      break;
  }
  out[0] = e.fromX + dx * fx;
  out[1] = e.fromY + dy * fy;
}

/** Share of a drop edge spent stepping off the ledge (nav: 300 ms of 300 + 250 k). */
export function dropStepOff(e: AnimEdge): number {
  const total = e.durationMs > 0 ? e.durationMs : 300 + 250 * Math.max(1, e.rows);
  return Math.min(0.6, Math.max(0.15, 300 / total));
}

export function isWalkMove(m: number): boolean {
  return m === MV.WALK_L || m === MV.WALK_R;
}
export function isStairMove(m: number): boolean {
  return m === MV.STAIR_UL || m === MV.STAIR_UR || m === MV.STAIR_DL || m === MV.STAIR_DR;
}
export function isClimbMove(m: number): boolean {
  return m === MV.UP || m === MV.DOWN;
}
export function isDropMove(m: number): boolean {
  return m === MV.DROP_L || m === MV.DROP_R || m === MV.FALL;
}
export function isLedgeMove(m: number): boolean {
  return m === MV.STEP_UL || m === MV.STEP_UR;
}
