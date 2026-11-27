/**
 * DWARF TEAM CONTRACT — animation side (F3-1). Owner: animator-ta (team lead).
 * Workers implement against these types and never edit this file; changes go through the lead.
 * Briefs: docs/team/dwarf-team/BRIEFS.md.
 *
 * Conventions (shared by model, rig, renderer and lab):
 *  - Units: 1 unit = 1 tile (~1 m). A dwarf is ~1.30 tall (with headgear).
 *  - Model space of one dwarf: +X forward (facing direction), +Y up, +Z the dwarf's RIGHT side.
 *    The root sits on the ground between the feet. Every bone's rest orientation is the identity;
 *    limbs (arms, legs, beard, aprons) point along -Y in the rest pose, torso and head along +Y.
 *  - Local rotations are Euler angles applied as R = Rz * Ry * Rx (three.js Euler order 'ZYX').
 *    Rz is pitch in the side-view plane (the main axis of every cycle): a positive Rz tilts the
 *    +Y axis toward -X (torso leans BACK) and swings a limb that hangs along -Y FORWARD.
 *  - Placement (model -> world): world position of the root, then the facing MIRROR (facing -1 =
 *    scale X by -1, so the tool hand stays on the camera side, like a flipped sprite), then the
 *    view yaw (turn toward the camera, variant parameter) and the clip's root yaw (e.g. climbing
 *    turns the back to the camera).
 *  - World: tile (x, y) spans X in [x, x+1], Y in [-(y+1), -y] (y = row, downward). Feet of a dwarf
 *    standing in nav cell (cx, cy) are at X = cx + 0.5, Y = -(cy + 1) (top of the floor tile).
 *    Play plane depth: tunnels z = -0.45, surface z = -1.2, ladders against the back wall z = -0.85.
 *  - Skin matrix of bone b (what the renderer uploads): placement * bones[b] * T(-rest[b]), so
 *    geometry is authored in rest (bind) model space and rigid parts need no inverse-bind data.
 */
import { MOVE_NONE, MV } from '../../sim/nav/types';

export { MOVE_NONE, MV };

// ------------------------------------------------------------------------------------------------ skeleton
/** Bone ids (index into every per-bone array). Sockets: TOOL_R/TOOL_L (grips), BACK, LOAD, APRON_*, LANTERN. */
export const BONE = {
  ROOT: 0,
  PELVIS: 1,
  SPINE: 2,
  CHEST: 3,
  HEAD: 4,
  BEARD: 5,
  BEARD2: 6,
  ARM_R: 7,
  FORE_R: 8,
  HAND_R: 9,
  ARM_L: 10,
  FORE_L: 11,
  HAND_L: 12,
  THIGH_R: 13,
  SHIN_R: 14,
  FOOT_R: 15,
  THIGH_L: 16,
  SHIN_L: 17,
  FOOT_L: 18,
  TOOL_R: 19,
  TOOL_L: 20,
  BACK: 21,
  LOAD: 22,
  APRON_F: 23,
  APRON_B: 24,
  LANTERN: 25,
} as const;
export type BoneId = (typeof BONE)[keyof typeof BONE];
export const BONE_COUNT = 26;

/** Parent of every bone (-1 = none). Joint positions come from `RigInput.rest`. */
export const BONE_PARENT: readonly number[] = [
  -1, // ROOT
  0, // PELVIS <- ROOT   (hips; carries the lower tunic, belt)
  1, // SPINE  <- PELVIS (belt pivot; carries the barrel torso)
  2, // CHEST  <- SPINE  (upper chest; shoulders)
  3, // HEAD   <- CHEST  (pivot at the chin / neck)
  4, // BEARD  <- HEAD   (hinge under the chin, secondary motion)
  5, // BEARD2 <- BEARD  (mid-beard, secondary motion)
  3, // ARM_R  <- CHEST  (shoulder joint)
  7, // FORE_R <- ARM_R  (elbow)
  8, // HAND_R <- FORE_R (wrist)
  3, // ARM_L
  10, // FORE_L
  11, // HAND_L
  1, // THIGH_R <- PELVIS (hip joint)
  13, // SHIN_R (knee)
  14, // FOOT_R (ankle)
  1, // THIGH_L
  16, // SHIN_L
  17, // FOOT_L
  9, // TOOL_R <- HAND_R (centre of the fist = primary grip)
  12, // TOOL_L <- HAND_L
  3, // BACK <- CHEST (back socket: frame, beam, slung tool)
  3, // LOAD <- CHEST (carried load; hidden with scale 0 when nothing is carried)
  1, // APRON_F <- PELVIS (front apron hinge at the belt)
  1, // APRON_B <- PELVIS (back apron "tylnik" hinge at the belt)
  1, // LANTERN <- PELVIS (belt lantern pendulum, camera side)
];

export const BONE_NAMES: readonly string[] = [
  'root', 'pelvis', 'spine', 'chest', 'head', 'beard', 'beard2',
  'arm_r', 'fore_r', 'hand_r', 'arm_l', 'fore_l', 'hand_l',
  'thigh_r', 'shin_r', 'foot_r', 'thigh_l', 'shin_l', 'foot_l',
  'tool_r', 'tool_l', 'back', 'load', 'apron_f', 'apron_b', 'lantern',
];

// ------------------------------------------------------------------------------------------------ gear seen by the rig
/** How the idle / walk layer holds the role's things (implemented by the animator, chosen by the model). */
export const HOLD = {
  /** pick (or hammer) over the right shoulder while walking, head down by the boot while standing */
  TOOL_SHOULDER: 0,
  /** tool hanging in the right hand along the leg (carpenter's axe) */
  TOOL_HANG: 1,
  /** both hands on the straps of a back frame at the chest (porter) */
  FRAME_STRAPS: 2,
  /** hammer in the right hand, tongs in the left (smith) */
  TWO_TOOLS: 3,
  /** left hand steadies a beam on the left shoulder, right hand free / tool */
  BEAM_SHOULDER: 4,
} as const;

/**
 * A tool in its own frame (bone TOOL_R / TOOL_L): origin = centre of the gripping fist, the handle
 * runs along local +Y toward the head, the working edge (pick point, axe blade, hammer face)
 * faces local +X, thickness along Z.
 */
export interface ToolInfo {
  kind: 'pick' | 'axe' | 'hammer' | 'tongs' | 'staff' | 'none';
  /** Full handle length (tiles). */
  length: number;
  /** Distance along +Y of the second hand for two-handed swings (0 = one-handed). */
  gripL: number;
  /** Distance along +Y of the head centre. */
  head: number;
  /** Working point in tool space (the pixel that should touch the rock at the hit frame). */
  strike: readonly [number, number, number];
}

export interface LampInfo {
  /** Bone the light hangs from (HEAD for the miner's helmet lamp, LANTERN for belt lanterns). */
  bone: number;
  /** Offset of the flame in that bone's rest model space (same space as the geometry). */
  offset: readonly [number, number, number];
  /** Linear-ish RGB intensity of the dynamic light and its radius (tiles). */
  color: readonly [number, number, number];
  radius: number;
}

/** What the rig needs to know about a built dwarf (produced by the model builder). */
export interface RigInput {
  /** Rest joint position of every bone in model space (BONE_COUNT * 3). Body joints must equal
   *  `referenceJoints(proportions)` (characters/direction.ts); sockets may be moved by the gear. */
  rest: Float32Array;
  toolR: ToolInfo | null;
  toolL: ToolInfo | null;
  hold: number;
  /** Gear that hangs and swings (secondary motion is only applied where something is there). */
  back: 'none' | 'apron' | 'beam' | 'frame';
  front: 'none' | 'apron';
  lamp: LampInfo;
  /** Seed of the dwarf (per-dwarf timing offsets: breathing, idle fidgets). */
  seed: number;
}

// ------------------------------------------------------------------------------------------------ pose data
/** IK effectors. Targets are in ROOT (model) space; pitch applies to feet (sole angle), hands ignore it. */
export const IK = { FOOT_R: 0, FOOT_L: 1, HAND_R: 2, HAND_L: 3 } as const;
export const IK_COUNT = 4;

/**
 * One sampled pose: local Euler rotations, translation offsets added to the rest offsets,
 * per-bone uniform scale (0 hides a bone and its children: gear that is put down), IK targets
 * with weights, and the root offset/yaw. Clips write PoseFrames, the state machine blends them,
 * the rig resolves IK and forward kinematics.
 */
export class PoseFrame {
  /** Euler x, y, z per bone (order ZYX), radians, local to the parent. */
  readonly rot = new Float32Array(BONE_COUNT * 3);
  /** Translation offset per bone (parent space), added to the rest offset. */
  readonly pos = new Float32Array(BONE_COUNT * 3);
  /** Uniform scale per bone; 0 hides the bone's geometry and its children. */
  readonly scale = new Float32Array(BONE_COUNT).fill(1);
  /** IK target per effector: x, y, z (root space), pitch (feet: world sole pitch, radians). */
  readonly ik = new Float32Array(IK_COUNT * 4);
  /** IK weight per effector (0 = keep FK, 1 = reach the target). */
  readonly ikW = new Float32Array(IK_COUNT);
  /** Root offset in placement space: dx, dy, dz, extra yaw (radians, about +Y). */
  readonly root = new Float32Array(4);

  reset(): this {
    this.rot.fill(0);
    this.pos.fill(0);
    this.scale.fill(1);
    this.ik.fill(0);
    this.ikW.fill(0);
    this.root.fill(0);
    return this;
  }

  copy(o: PoseFrame): this {
    this.rot.set(o.rot);
    this.pos.set(o.pos);
    this.scale.set(o.scale);
    this.ik.set(o.ik);
    this.ikW.set(o.ikW);
    this.root.set(o.root);
    return this;
  }

  /** this = a + (b - a) * t, component-wise (angles are small enough for a linear blend). */
  lerp(a: PoseFrame, b: PoseFrame, t: number): this {
    const mix = (o: Float32Array, x: Float32Array, y: Float32Array) => {
      for (let i = 0; i < o.length; i++) o[i] = x[i]! + (y[i]! - x[i]!) * t;
    };
    mix(this.rot, a.rot, b.rot);
    mix(this.pos, a.pos, b.pos);
    mix(this.scale, a.scale, b.scale);
    mix(this.ik, a.ik, b.ik);
    mix(this.ikW, a.ikW, b.ikW);
    mix(this.root, a.root, b.root);
    return this;
  }
}

// ------------------------------------------------------------------------------------------------ inputs from the simulation
/** Mirrors `DS` in src/sim/dwarves.ts (kept as a copy: the animation layer must not depend on sim internals). */
export const SIM = { IDLE: 0, GOTO: 1, WORK: 2, FLEE: 3, STUNNED: 4, BURIED: 5, DEAD: 6 } as const;
/** What the dwarf works at when SIM.WORK. */
export const WORK = { NONE: 0, DIG: 1, BUILD: 2, HAUL: 3, CRAFT: 4 } as const;
/** What the dwarf carries (CARRY.BACK = porter frame / heavy load: lean 8 degrees). */
export const CARRY = { NONE: 0, HANDS: 1, SHOULDER: 2, BACK: 3 } as const;

/**
 * The path edge being traversed: nav `path.moves[step + 1]` (an `MV` code) between the feet cells
 * `cells[step]` -> `cells[step + 1]`, converted to world feet positions (see conventions), with
 * `t = agent.progress / edgeCost` in 0..1. `rows` = fall height for DROP_* / FALL.
 */
export interface AnimEdge {
  move: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  t: number;
  durationMs: number;
  rows: number;
}

export interface AnimInput {
  /** SIM.* state of the dwarf. */
  sim: number;
  /** World feet position while standing (ignored while an edge is traversed: the animator derives
   *  the visual root position from the edge, so root motion and foot plants agree). */
  x: number;
  y: number;
  facing: 1 | -1;
  edge: AnimEdge | null;
  work: number;
  /** World centre of the tile being worked (dig / build), NaN if none. */
  workX: number;
  workY: number;
  carry: number;
  /** 0..1: a failing roof nearby (look up, flinch), 1 = run. */
  danger: number;
}

/** Discrete events forwarded from SimEvents (mapping in the brief). */
export type AnimEvent =
  | { type: 'digStart'; x: number; y: number }
  | { type: 'digCrack'; stage: number }
  | { type: 'digDone' }
  | { type: 'digBlocked'; reason: number }
  | { type: 'caveInWarning'; x: number; y: number; seconds: number }
  | { type: 'fell'; rows: number; damage: number }
  | { type: 'buried' }
  | { type: 'rescued' }
  | { type: 'pickUp' }
  | { type: 'putDown' };

/** Read-only view of the world the animator may query (foot IK on steps, ladders). */
export interface AnimWorldProbe {
  /** World Y of the walkable surface under world x near world y (within ±1 tile), NaN if none. */
  floorAt(x: number, y: number): number;
  /** Ladder rungs: world Y of rung k = rungOffset + k * rungSpacing (per tile row), ladder depth z. */
  ladder: { rungSpacing: number; rungOffset: number; z: number };
  /** Depth of the play plane at world y (tunnel -0.45, surface -1.2). */
  playZ(y: number): number;
}

// ------------------------------------------------------------------------------------------------ outputs
/** Animation states of the machine. */
export const AS = {
  HIDDEN: 0, // buried or dead: nothing is drawn (tragedy by subtraction)
  IDLE: 1,
  WALK: 2, // walk / jog blend by speed (also FLEE with the flee flavour)
  CLIMB: 3, // ladder UP / DOWN
  LEDGE: 4, // STEP_UL / STEP_UR: clamber onto a 1-tile ledge
  STAIRS: 5,
  DROP: 6, // DROP_* / FALL: step off, fall
  LAND: 7,
  DIG: 8,
  BUILD: 9,
  FLEE: 10,
  STUNNED: 11,
  RIDE: 12, // LINK: lift, cart, rope bridge
} as const;

/** Animation notifies (sound, VFX, hitboxes, gameplay timing). */
export const NOTIFY = {
  FOOT_DOWN: 0,
  DIG_WINDUP: 1,
  DIG_HIT: 2,
  TOOL_SWOOSH: 3,
  RUNG_GRAB: 4,
  LAND: 5,
  PICK_UP: 6,
  PUT_DOWN: 7,
} as const;

export interface AnimNotify {
  kind: number;
  /** 0 = right, 1 = left (feet, hands), 0 otherwise. */
  side: number;
  /** World position (foot contact, tool strike point, hand on the rung). */
  x: number;
  y: number;
  z: number;
  /** 0..1 (heavy step with a load, final strike...). */
  strength: number;
}

/** Context a clip samples with. */
export interface ClipContext {
  rig: RigInput;
  /** Travel speed along the edge (tiles/s), 0 when standing. */
  speed: number;
  carry: number;
  /** Work target relative to the root (model space x forward, y up), NaN if none. */
  aimX: number;
  aimY: number;
  probe: AnimWorldProbe | null;
}

/**
 * A motion cycle or one-shot. Time-driven clips advance by dt / length; distance-driven clips by
 * travelled distance / length (walk: one stride = two steps; climb: two rungs) so planted feet and
 * hands stay locked to the world without foot sliding.
 */
export interface AnimClip {
  readonly id: string;
  readonly drive: 'time' | 'distance';
  readonly loop: boolean;
  /** Seconds (time) or tiles (distance) per full cycle; may depend on ctx.speed (stride). */
  length(ctx: ClipContext): number;
  sample(ctx: ClipContext, phase: number, out: PoseFrame): void;
  /** Phase points (0..1) where notifies fire. */
  readonly notifies: readonly { phase: number; kind: number; side: number }[];
  /** Phase windows [a, b) where leaving the clip is allowed without a forced (fast) blend. */
  readonly cancel: readonly (readonly [number, number])[];
}

/** One animated dwarf: state machine + rig. Allocation-free per update. */
export interface DwarfAnimator {
  readonly state: number;
  /** Model-space bone matrices after IK and FK (BONE_COUNT * 16, column-major like three.js). */
  readonly bones: Float32Array;
  /** World matrix of the root: position, facing mirror, view yaw + clip yaw (16 floats). */
  readonly placement: Float32Array;
  /** Advance by dt seconds with this frame's input and the events since the last update. */
  update(input: AnimInput, dt: number, events?: readonly AnimEvent[]): void;
  /** Deterministic pose for lab shots: clip at a phase, placed from the input (no state machine). */
  pose(clipId: string, phase: number, input: AnimInput): void;
  /** Move the notifies fired since the last call into `out`; returns how many were written. */
  drainNotifies(out: AnimNotify[]): number;
  /** True while the current clip is in a cancel window (gameplay may end the action now). */
  canCancel(): boolean;
  /** World position of the lamp flame into out[o..o+2]; false when there is no lit lamp. */
  lampWorld(out: Float32Array, o: number): boolean;
}

export interface AnimatorOptions {
  /** View turn toward the camera (degrees, from profile), from the variant. */
  viewYawDeg: number;
  probe?: AnimWorldProbe | null;
}

export type CreateAnimator = (rig: RigInput, opts: AnimatorOptions) => DwarfAnimator;

/** Clip ids every animator must accept in `pose()` (lab shots). */
export const CLIP_IDS = ['idle', 'walk', 'jog', 'dig', 'build', 'climb', 'carry', 'flee', 'stunned'] as const;
export type ClipId = (typeof CLIP_IDS)[number];
