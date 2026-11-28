/**
 * How a dwarf holds its things (owner: W2). Every hold is authored as "fist here, fist pitched like
 * this, tool turned like that in the fist" relative to the body measures of the rig (never in tiles),
 * then BAKED once per rig into local FK angles of ARM / FORE / HAND (relative to the chest) by running
 * the rig's own IK with the chest at rest. Baked holds ride on the chest during walks (FK), so a pick
 * over the shoulder stays on the shoulder whatever the torso does.
 */
import { AnimPose, setIK } from './pose';
import { Rig } from './rig';
import type { RigData } from './rigdata';
import { BONE, CARRY, HOLD, IK, type PoseFrame, type RigInput, type ToolInfo } from './types';

/** One arm of a hold: target of the fist (model space, chest at rest), its pitch, the tool's local rotation. */
export interface ArmSpec {
  x: number;
  y: number;
  z: number;
  pitch: number;
  /** Tool local Euler (relative to the fist). */
  tool: readonly [number, number, number];
  /** Where along the handle the fist holds it (0 = the butt, the contract's tool origin). */
  grip?: number;
}

/** Baked arm: local Euler of ARM, FORE, HAND (9) + tool local Euler (3) + the spec (for IK use). */
export interface BakedArm {
  readonly rot: Float64Array;
  readonly spec: ArmSpec;
}

/** Both arms of a hold; null = the arm is free (it swings with the gait). */
export interface BakedHold {
  readonly r: BakedArm | null;
  readonly l: BakedArm | null;
  /** Gait arm swing multiplier for held arms (0 = rigid on the chest). */
  readonly swing: number;
}

export interface HoldSet {
  /** Walking / standing with the role's gear (the hold of the RigInput). */
  walk: BakedHold;
  /** Standing idle (miner: pick head down by the boot — IK, it rests on the floor). */
  idle: BakedHold;
  /** Carry layers by CARRY.* (index 0 unused). */
  carry: readonly (BakedHold | null)[];
  /** Fleeing: left hand shields the head (right keeps the tool). */
  flee: BakedHold;
  /** Cowering on the spot: both hands at the head. */
  cower: BakedHold;
  /** Tools are slung on the back while carrying with the hands / climbing. */
  slingOnCarry: readonly boolean[];
}

const cache = new WeakMap<RigInput, HoldSet>();

export function holdSet(rig: Rig): HoldSet {
  const c = rig.d.cache;
  if (c.holds) return c.holds as HoldSet;
  let h = cache.get(rig.d.input);
  if (!h) {
    h = buildHolds(rig.d);
    cache.set(rig.d.input, h);
  }
  c.holds = h;
  return h;
}

/** Hold set of a rig input (cached on its RigData). */
export function holdsOf(d: RigData): HoldSet {
  const c = d.cache;
  if (c.holds) return c.holds as HoldSet;
  let h = cache.get(d.input);
  if (!h) {
    h = buildHolds(d);
    cache.set(d.input, h);
  }
  c.holds = h;
  return h;
}

function buildHolds(d: RigData): HoldSet {
  const u = d.unit;
  const sY = d.shoulderY;
  const sZ = d.shoulderZ;
  const cR = d.chestR;
  const hangY = sY - (d.upper + d.fore) * 0.92 - d.fist; // fist of a nearly straight hanging arm
  const beltY = d.rest[BONE.SPINE * 3 + 1]!;
  const tR = d.toolR;
  const tL = d.toolL;
  const scratch = new Rig(d.input);
  const pose = new AnimPose();

  const bake = (side: 1 | -1, s: ArmSpec): BakedArm => {
    pose.reset();
    setIK(pose, side > 0 ? IK.HAND_R : IK.HAND_L, s.x, s.y, s.z, s.pitch, 1);
    scratch.solve(pose);
    const rot = new Float64Array(12);
    const bones = side > 0 ? [BONE.ARM_R, BONE.FORE_R, BONE.HAND_R] : [BONE.ARM_L, BONE.FORE_L, BONE.HAND_L];
    bones.forEach((b, i) => {
      for (let k = 0; k < 3; k++) rot[i * 3 + k] = scratch.rot[b * 3 + k]!;
    });
    rot[9] = s.tool[0];
    rot[10] = s.tool[1];
    rot[11] = s.tool[2];
    return { rot, spec: s };
  };
  const hold = (r: ArmSpec | null, l: ArmSpec | null, swing: number): BakedHold => ({ r: r ? bake(1, r) : null, l: l ? bake(-1, l) : null, swing });

  // --- building blocks (all lengths from the rig measures)
  // a tool hangs head down along the thigh, the edge down and back, the head below the belt; the
  // fist slides up the handle as far as needed for the head to clear the floor
  const hangTool = (side: 1 | -1, t: ToolInfo | null): ArmSpec => {
    const y = hangY + 0.02 * u;
    const th = Math.PI + 0.25;
    const drop = Math.cos(0.25);
    const grip = t ? Math.max(0, Math.min(t.head * 0.8, t.head - (y - 0.2 * u) / drop)) : 0;
    return { x: 0.06 * u, y, z: side * (sZ + 0.03 * u), pitch: 0.12, tool: [0, 0, th - 0.12], grip };
  };
  // handle across the fist (swing grip): fist pitch = handle angle + 90°, tool turned -90° in the fist
  const tongsForward: ArmSpec = { x: cR * 0.72, y: sY - 0.25 * u, z: -sZ * 0.72, pitch: -1.85 + Math.PI / 2, tool: [0, 0, -Math.PI / 2] };
  const overShoulder: ArmSpec = { x: cR * 0.55, y: sY - 0.05 * u, z: sZ * 0.8, pitch: 0.85, tool: [0, 0, 0] };
  const strap = (side: 1 | -1): ArmSpec => ({ x: cR * 0.62, y: sY - 0.11 * u, z: side * sZ * 0.48, pitch: -0.45, tool: [0, 0, 0] });
  const beamSteady: ArmSpec = { x: 0.1 * u, y: sY + 0.1 * u, z: -sZ * 0.72, pitch: 0.6, tool: [0, 0, 0] };
  const shield = (side: 1 | -1): ArmSpec => ({ x: 0.09 * u, y: Math.min(d.crownY - 0.1 * u, sY + d.armReach * 0.82), z: side * 0.11 * u, pitch: 2.2, tool: [0, 0, 0] });
  const sackFront = (side: 1 | -1): ArmSpec => ({ x: cR + 0.07 * u, y: beltY + 0.05 * u, z: side * 0.15 * u, pitch: 1.35, tool: [0, 0, 0] });
  const sackShoulder: ArmSpec = { x: 0.07 * u, y: sY + 0.15 * u, z: sZ * 0.92, pitch: 2.4, tool: [0, 0, 0] };
  // miner idle: right fist on the butt of the pick, pick head down on the floor by the boot
  const pickRest = (t: ToolInfo): ArmSpec => {
    const y = Math.min(t.head + 0.05 * u, sY + 0.05 * u);
    const p = 0.75;
    return { x: 0.21 * u, y, z: sZ + 0.02 * u, pitch: p, tool: [0, 0, Math.PI - p] };
  };

  // --- the role's hold
  let walk: BakedHold;
  let idle: BakedHold;
  switch (d.hold) {
    case HOLD.TOOL_SHOULDER:
      // the pick rides the shoulder also at rest: the T of the head over the shoulder is the
      // miner's silhouette (lead's review of E1; pickRest kept for a calmer variant)
      walk = hold(tR ? overShoulder : null, null, 0.25);
      idle = hold(tR ? overShoulder : null, null, 0);
      void pickRest;
      break;
    case HOLD.FRAME_STRAPS:
      walk = hold(strap(1), strap(-1), 0.08);
      idle = walk;
      break;
    case HOLD.TWO_TOOLS:
      // hammer along the right thigh; the tongs held forward at the belt, jaws forward and a little
      // down, sticking out past the belly (the smith's silhouette; lead's review of E1)
      walk = hold(hangTool(1, tR), tL ? tongsForward : null, 0.55);
      idle = walk;
      break;
    case HOLD.BEAM_SHOULDER:
      walk = hold(tR ? hangTool(1, tR) : null, beamSteady, 0.5);
      idle = walk;
      break;
    case HOLD.TOOL_HANG:
    default:
      walk = hold(tR ? hangTool(1, tR) : null, tL ? hangTool(-1, tL) : null, 0.55);
      idle = walk;
      break;
  }
  const strapsBoth = hold(strap(1), strap(-1), 0.08);
  const carry: (BakedHold | null)[] = [];
  carry[CARRY.NONE] = null;
  carry[CARRY.HANDS] = hold(sackFront(1), sackFront(-1), 0.06);
  carry[CARRY.SHOULDER] = hold(sackShoulder, null, 0.1);
  carry[CARRY.BACK] = strapsBoth;
  const flee = hold(d.hold === HOLD.TOOL_SHOULDER && tR ? overShoulder : walk.r ? walk.r.spec : null, shield(-1), 0.4);
  const cower = hold(shield(1), shield(-1), 0);
  const slingOnCarry: boolean[] = [];
  slingOnCarry[CARRY.NONE] = false;
  slingOnCarry[CARRY.HANDS] = true;
  slingOnCarry[CARRY.SHOULDER] = true;
  slingOnCarry[CARRY.BACK] = d.hold !== HOLD.FRAME_STRAPS;
  return { walk, idle, carry, flee, cower, slingOnCarry };
}

/** Write a baked arm into a pose as FK (local to the chest) plus a swing offset on the upper arm. */
export function applyArmFK(p: PoseFrame, side: 1 | -1, a: BakedArm, swingZ: number): void {
  const bones = side > 0 ? ARM_BONES_R : ARM_BONES_L;
  for (let i = 0; i < 3; i++) {
    const b = bones[i]!;
    p.rot[b * 3] = a.rot[i * 3]!;
    p.rot[b * 3 + 1] = a.rot[i * 3 + 1]!;
    p.rot[b * 3 + 2] = a.rot[i * 3 + 2]! + (i === 0 ? swingZ : 0);
  }
  const t = side > 0 ? BONE.TOOL_R : BONE.TOOL_L;
  p.rot[t * 3] = a.rot[9]!;
  p.rot[t * 3 + 1] = a.rot[10]!;
  p.rot[t * 3 + 2] = a.rot[11]!;
  gripSlide(p, t, a.spec);
}

/** Slide the tool in the fist: the handle point at `grip` lands on the fist (tool origin). */
function gripSlide(p: PoseFrame, t: number, s: ArmSpec): void {
  const g = s.grip ?? 0;
  // pos = -Rz(tool z)·(0, g, 0) (tool rot x / y are 0 for holds)
  const th = s.tool[2];
  p.pos[t * 3] = g * Math.sin(th);
  p.pos[t * 3 + 1] = -g * Math.cos(th);
  p.pos[t * 3 + 2] = 0;
}

/** Blend the arm channels already in the pose toward a baked arm (FK) by weight w. */
export function blendArmFK(p: PoseFrame, side: 1 | -1, a: BakedArm, w: number): void {
  const bones = side > 0 ? ARM_BONES_R : ARM_BONES_L;
  for (let i = 0; i < 3; i++) {
    const b = bones[i]!;
    for (let k = 0; k < 3; k++) p.rot[b * 3 + k] += (a.rot[i * 3 + k]! - p.rot[b * 3 + k]!) * w;
  }
}

/** Write a baked arm as an IK target (root space = model space of the rest chest) with weight w. */
export function applyArmIK(p: PoseFrame, side: 1 | -1, a: BakedArm, w: number, dx = 0, dy = 0, dz = 0): void {
  const s = a.spec;
  setIK(p, side > 0 ? IK.HAND_R : IK.HAND_L, s.x + dx, s.y + dy, s.z + dz, s.pitch, w);
  const h = side > 0 ? BONE.HAND_R : BONE.HAND_L;
  p.rot[h * 3] = 0;
  p.rot[h * 3 + 1] = 0;
  const t = side > 0 ? BONE.TOOL_R : BONE.TOOL_L;
  p.rot[t * 3] = s.tool[0];
  p.rot[t * 3 + 1] = s.tool[1];
  p.rot[t * 3 + 2] = s.tool[2];
  gripSlide(p, t, s);
}

const ARM_BONES_R = [BONE.ARM_R, BONE.FORE_R, BONE.HAND_R] as const;
const ARM_BONES_L = [BONE.ARM_L, BONE.FORE_L, BONE.HAND_L] as const;
