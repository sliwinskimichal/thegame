/**
 * Public entry of the animation module (owner: W2 "Animator ruchu", dwarf team).
 * STUB written by the team lead so the contract compiles from day one: a rest-pose animator
 * (no state machine, no IK) that places the dwarf and keeps every bone at its rest joint.
 * W2 replaces this file with the real implementation; the exported names stay.
 */
import { BONE_COUNT, type AnimInput, type AnimNotify, type CreateAnimator, type DwarfAnimator, type RigInput } from './types';

export * from './types';

class RestPoseAnimator implements DwarfAnimator {
  state = 1;
  readonly bones = new Float32Array(BONE_COUNT * 16);
  readonly placement = new Float32Array(16);

  constructor(
    private rig: RigInput,
    private yaw: number,
  ) {
    for (let b = 0; b < BONE_COUNT; b++) {
      const o = b * 16;
      this.bones[o] = this.bones[o + 5] = this.bones[o + 10] = this.bones[o + 15] = 1;
      this.bones[o + 12] = rig.rest[b * 3]!;
      this.bones[o + 13] = rig.rest[b * 3 + 1]!;
      this.bones[o + 14] = rig.rest[b * 3 + 2]!;
    }
  }

  private place(input: AnimInput): void {
    // placement = T(x, y, z) * S(facing, 1, 1) * Ry(-yaw): forward +X turns toward the camera (+Z)
    const c = Math.cos(-this.yaw);
    const s = Math.sin(-this.yaw);
    const f = input.facing;
    const m = this.placement;
    m.fill(0);
    m[0] = f * c;
    m[2] = -s;
    m[5] = 1;
    m[8] = f * s;
    m[10] = c;
    m[12] = input.edge ? input.edge.fromX + (input.edge.toX - input.edge.fromX) * input.edge.t : input.x;
    m[13] = input.edge ? input.edge.fromY + (input.edge.toY - input.edge.fromY) * input.edge.t : input.y;
    m[14] = -0.45;
    m[15] = 1;
  }

  update(input: AnimInput): void {
    this.place(input);
  }

  pose(_clip: string, _phase: number, input: AnimInput): void {
    this.place(input);
  }

  drainNotifies(_out: AnimNotify[]): number {
    return 0;
  }

  canCancel(): boolean {
    return true;
  }

  lampWorld(out: Float32Array, o: number): boolean {
    const l = this.rig.lamp;
    const m = this.placement;
    const x = l.offset[0];
    const y = l.offset[1];
    const z = l.offset[2];
    out[o] = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!;
    out[o + 1] = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!;
    out[o + 2] = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!;
    return true;
  }
}

export const createAnimator: CreateAnimator = (rig, opts) => new RestPoseAnimator(rig, (opts.viewYawDeg * Math.PI) / 180);

/** Motion metrics (see AnimMetrics in characters/types.ts). STUB: NaN until W2 implements it. */
export function animMetrics(_rig: RigInput): { slipWalk: number; slipNav: number; seamJump: number } {
  return { slipWalk: Number.NaN, slipNav: Number.NaN, seamJump: Number.NaN };
}
