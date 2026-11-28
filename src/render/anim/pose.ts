/**
 * The animator's working pose (owner: W2): the contract PoseFrame plus side channels the rig and
 * the state machine need. Clips accept any PoseFrame (contract signature) and fill the extras only
 * when they are given an AnimPose.
 *
 * Conventions on top of the contract (proposed to the lead for PoseFrame's doc comment):
 *  - Hand effectors: target = centre of the fist (origin of TOOL_R / TOOL_L), pitch slot
 *    ik[4k + 3] = pitch of the hand in ROOT space (Rz); with ikW > 0 the hand's rot.x / rot.y are
 *    read as root-space angles too. A tool held rigidly in that hand therefore has a root-space
 *    orientation the clip controls, so two hands can hold one handle exactly.
 *  - Foot effectors: target = ankle (origin of FOOT_*), pitch = sole pitch, rot.y of the foot =
 *    toe-out yaw (root space).
 */
import { IK_COUNT, PoseFrame } from './types';

export class AnimPose extends PoseFrame {
  /** Per foot (0 right, 1 left): 1 = planted (stance), 0 = swing / in the air. */
  readonly contact = new Float32Array(2);
  /** Per foot: root-space point that must not move while planted (heel, flat sole or toe). */
  readonly pivot = new Float32Array(6);
  /** Pole hint per effector (root space, 0,0,0 = rig default). */
  readonly pole = new Float32Array(IK_COUNT * 3);
  /** Per tool socket (0 TOOL_R, 1 TOOL_L): 0 = in the hand, 1 = slung on the back (child of CHEST). */
  readonly attach = new Float32Array(2);

  override reset(): this {
    super.reset();
    this.contact.fill(0);
    this.pivot.fill(0);
    this.pole.fill(0);
    this.attach.fill(0);
    return this;
  }

  override copy(o: PoseFrame): this {
    super.copy(o);
    if (o instanceof AnimPose) {
      this.contact.set(o.contact);
      this.pivot.set(o.pivot);
      this.pole.set(o.pole);
      this.attach.set(o.attach);
    }
    return this;
  }

  override lerp(a: PoseFrame, b: PoseFrame, t: number): this {
    super.lerp(a, b, t);
    if (a instanceof AnimPose && b instanceof AnimPose) {
      for (let i = 0; i < 2; i++) {
        // contact is a flag: the target pose decides once it dominates
        this.contact[i] = t < 0.5 ? a.contact[i]! : b.contact[i]!;
        this.attach[i] = a.attach[i]! + (b.attach[i]! - a.attach[i]!) * t;
      }
      for (let i = 0; i < 6; i++) this.pivot[i] = a.pivot[i]! + (b.pivot[i]! - a.pivot[i]!) * t;
      for (let i = 0; i < this.pole.length; i++) this.pole[i] = a.pole[i]! + (b.pole[i]! - a.pole[i]!) * t;
    }
    return this;
  }
}

/** Helpers to write PoseFrame channels without index arithmetic in the clips. */
export function setRot(p: PoseFrame, b: number, x: number, y: number, z: number): void {
  p.rot[b * 3] = x;
  p.rot[b * 3 + 1] = y;
  p.rot[b * 3 + 2] = z;
}
export function addRot(p: PoseFrame, b: number, x: number, y: number, z: number): void {
  p.rot[b * 3] += x;
  p.rot[b * 3 + 1] += y;
  p.rot[b * 3 + 2] += z;
}
export function setPos(p: PoseFrame, b: number, x: number, y: number, z: number): void {
  p.pos[b * 3] = x;
  p.pos[b * 3 + 1] = y;
  p.pos[b * 3 + 2] = z;
}
export function addPos(p: PoseFrame, b: number, x: number, y: number, z: number): void {
  p.pos[b * 3] += x;
  p.pos[b * 3 + 1] += y;
  p.pos[b * 3 + 2] += z;
}
export function setIK(p: PoseFrame, e: number, x: number, y: number, z: number, pitch: number, w: number): void {
  p.ik[e * 4] = x;
  p.ik[e * 4 + 1] = y;
  p.ik[e * 4 + 2] = z;
  p.ik[e * 4 + 3] = pitch;
  p.ikW[e] = w;
}
