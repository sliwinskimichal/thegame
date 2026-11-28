/**
 * Measures of one dwarf derived ONCE from its RigInput (owner: W2).
 *
 * Scale rule (owner's principle "the world scales to the models"): nothing here assumes a dwarf
 * height in tiles. Every body length comes from the rest joints (`RigInput.rest`, which W1 builds
 * from `referenceJoints(proportions)`); the few authored distances (foot pivots, clearances, hold
 * offsets) are written for preset A and multiplied by `unit` = body size / preset-A size. World
 * features (rung spacing, step heights, edge lengths, depths) only ever come from the probe and the
 * nav edges at run time.
 */
import { hash2f } from '../../core/rng';
import { BONE, BONE_COUNT, BONE_PARENT, HOLD, type RigInput, type ToolInfo } from './types';

/** Chin height of preset A (referenceJoints(PROPORTIONS_A)): the yardstick for `unit`. */
const REF_CHIN_Y = 0.864;
/** Hip-joint height of preset A. */
const REF_HIP_Y = 0.3;

export interface RigData {
  readonly input: RigInput;
  /** Rest joints (model space) and rest offsets to the parent, float64. */
  readonly rest: Float64Array;
  readonly off: Float64Array;
  /** Body size relative to preset A (1 = the concept card's 1.30-tile dwarf). */
  readonly unit: number;
  /** Leg-length unit (hip height / preset A hip height): used for foot and stride numbers. */
  readonly legUnit: number;
  readonly hipY: number;
  readonly hipZ: number;
  readonly ankleY: number;
  readonly thigh: number;
  readonly shin: number;
  /** Hip joint to ankle, straight leg. */
  readonly legReach: number;
  /** Foot pivots relative to the ankle (model x) and the sole below it: heel < 0 < toe. */
  readonly heelX: number;
  readonly toeX: number;
  readonly chinY: number;
  readonly headH: number;
  readonly crownY: number;
  readonly shoulderY: number;
  readonly shoulderZ: number;
  readonly upper: number;
  readonly fore: number;
  /** Wrist to fist centre (the TOOL socket offset). */
  readonly fist: number;
  /** Shoulder to fist, straight arm. */
  readonly armReach: number;
  /** Torso radius estimate (from the BACK socket default: -0.7 chestR). */
  readonly chestR: number;
  readonly toolR: ToolInfo | null;
  readonly toolL: ToolInfo | null;
  readonly hold: number;
  /** Deterministic per-dwarf offsets in [0, 1). */
  readonly seedA: number;
  readonly seedB: number;
  readonly seedC: number;
}

const cache = new WeakMap<RigInput, RigData>();

export function rigData(rig: RigInput): RigData {
  let d = cache.get(rig);
  if (!d) {
    d = buildRigData(rig);
    cache.set(rig, d);
  }
  return d;
}

function buildRigData(rig: RigInput): RigData {
  const rest = new Float64Array(BONE_COUNT * 3);
  const off = new Float64Array(BONE_COUNT * 3);
  for (let i = 0; i < BONE_COUNT * 3; i++) rest[i] = rig.rest[i]!;
  for (let b = 0; b < BONE_COUNT; b++) {
    const p = BONE_PARENT[b]!;
    for (let k = 0; k < 3; k++) off[b * 3 + k] = rest[b * 3 + k]! - (p >= 0 ? rest[p * 3 + k]! : 0);
  }
  const len = (b: number) => Math.hypot(off[b * 3]!, off[b * 3 + 1]!, off[b * 3 + 2]!);
  const y = (b: number) => rest[b * 3 + 1]!;
  const chinY = y(BONE.HEAD);
  const unit = chinY / REF_CHIN_Y;
  const hipY = y(BONE.THIGH_R);
  const legUnit = hipY / REF_HIP_Y;
  const thigh = len(BONE.SHIN_R);
  const shin = len(BONE.FOOT_R);
  const upper = len(BONE.FORE_R);
  const fore = len(BONE.HAND_R);
  const fist = len(BONE.TOOL_R);
  // head module from the beard hinge (referenceJoints: beard.x = head.x + 0.22 headH); fallback 0.36 unit
  const hx = rest[BONE.BEARD * 3]! - rest[BONE.HEAD * 3]!;
  const headH = hx > 0.01 ? hx / 0.22 : 0.36 * unit;
  const chestR = rest[BONE.BACK * 3]! < -0.01 ? -rest[BONE.BACK * 3]! / 0.7 : 0.29 * unit;
  const s = rig.seed >>> 0;
  return {
    input: rig,
    rest,
    off,
    unit,
    legUnit,
    hipY,
    hipZ: rest[BONE.THIGH_R * 3 + 2]!,
    ankleY: y(BONE.FOOT_R),
    thigh,
    shin,
    legReach: thigh + shin,
    // the boot (concept card: 0.22 long with a big toe) around the ankle
    heelX: -0.05 * legUnit,
    toeX: 0.14 * legUnit,
    chinY,
    headH,
    crownY: chinY + headH,
    shoulderY: y(BONE.ARM_R),
    shoulderZ: rest[BONE.ARM_R * 3 + 2]!,
    upper,
    fore,
    fist,
    armReach: upper + fore + fist,
    chestR,
    toolR: rig.toolR && rig.toolR.kind !== 'none' ? rig.toolR : null,
    toolL: rig.toolL && rig.toolL.kind !== 'none' ? rig.toolL : null,
    hold: rig.hold ?? HOLD.TOOL_HANG,
    seedA: hash2f(s, 11, 0x5eed),
    seedB: hash2f(s, 23, 0x5eed),
    seedC: hash2f(s, 37, 0x5eed),
  };
}
