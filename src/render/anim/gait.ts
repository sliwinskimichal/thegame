/**
 * Parametric locomotion (owner: W2): ONE gait generator covers a slow shuffle, the concept walk, the
 * fast walk the sim uses (1.1 tiles/s) and the flee jog (2.5 tiles/s). The clip is distance-driven:
 * phase += travelled distance / stride, and during stance the ground pivot of the foot (heel -> flat
 * sole -> toe) moves back in root space at exactly `stride` per phase, so it is fixed in the world
 * (no foot sliding at ANY speed by construction; the machine's root motion supplies the distance).
 *
 * Speeds are in MODEL units/s (the animator divides world speeds by worldPerModel). Parameter keys
 * are placed on the dimensionless speed v̂ = v / sqrt(g * hipHeight) (square root of the Froude
 * number), so a longer-legged variant or a bigger character scale walks with the same character.
 * The stride is the largest the leg geometry of THIS rig allows for the key's stance (heel strike
 * and toe-off pitch, crouch, bob), capped below the concept cadence (2 steps / 0.9 s).
 */
import { bump, easeIn, easeInOut, easeOut, frac, hermite, lerp, wrap01 } from './curves';
import { AnimPose, setIK } from './pose';
import type { RigData } from './rigdata';
import { BONE, IK, type PoseFrame } from './types';

export interface GaitParams {
  /** Stance share of the cycle (> 0.5 walk with double support, < 0.5 run with flight). */
  duty: number;
  /** Pelvis height offset (model units at preset A, scaled by legUnit). */
  crouch: number;
  /** Pelvis bob amplitude: > 0 high at mid-stance (walk), < 0 low at mid-stance (run). */
  bob: number;
  /** Pelvis lateral shift toward the stance leg. */
  sway: number;
  /** Pelvis roll (swing hip drops) and yaw (swing hip forward), radians. */
  roll: number;
  twist: number;
  /** Forward lean of spine + chest (radians). */
  lean: number;
  /** Sole pitch at heel strike (toes up) and at toe-off (heel up), radians. */
  heel: number;
  toe: number;
  /** Swing-foot clearance, half track width (foot z), toe-out yaw. */
  clear: number;
  track: number;
  toeOut: number;
  /** Upper-arm swing amplitude and base elbow flexion (radians). */
  armSwing: number;
  elbow: number;
  /** Share of the reach-limited contact length actually used (safety margin for roll/twist). */
  lcFrac: number;
}

const N_PARAMS = 15;
const KEYS_V = [0.18, 0.36, 0.64, 1.3];
/** slow shuffle · concept walk (card: 2 steps / 0.9 s) · fast walk (1.1 tiles/s) · flee jog (2.5 tiles/s). */
const KEYS: readonly GaitParams[] = [
  { duty: 0.66, crouch: -0.022, bob: 0.005, sway: 0.022, roll: 0.03, twist: 0.05, lean: 0.03, heel: 0.2, toe: 0.4, clear: 0.035, track: 0.13, toeOut: 0.16, armSwing: 0.14, elbow: 0.18, lcFrac: 0.85 },
  { duty: 0.6, crouch: -0.032, bob: 0.01, sway: 0.02, roll: 0.05, twist: 0.08, lean: 0.06, heel: 0.3, toe: 0.6, clear: 0.05, track: 0.125, toeOut: 0.14, armSwing: 0.3, elbow: 0.25, lcFrac: 0.9 },
  { duty: 0.56, crouch: -0.038, bob: 0.011, sway: 0.015, roll: 0.05, twist: 0.1, lean: 0.11, heel: 0.33, toe: 0.78, clear: 0.06, track: 0.115, toeOut: 0.1, armSwing: 0.42, elbow: 0.42, lcFrac: 0.9 },
  { duty: 0.36, crouch: -0.048, bob: -0.013, sway: 0.01, roll: 0.04, twist: 0.13, lean: 0.24, heel: 0.16, toe: 0.86, clear: 0.085, track: 0.1, toeOut: 0.06, armSwing: 0.6, elbow: 1.2, lcFrac: 0.92 },
];
const LENGTH_KEYS: readonly (keyof GaitParams)[] = ['crouch', 'bob', 'sway', 'clear', 'track'];
const PARAM_NAMES = Object.keys(KEYS[0]!) as (keyof GaitParams)[];

export const G = 9.81;
/** Card cadence: one stride (2 steps) per 0.9 s at preset A (scaled with sqrt of the leg length). */
const CARD_STRIDE_S = 0.9;
/** Heel roll ends / toe roll starts at these shares of the stance. */
const SH = 0.18;
const ST = 0.5;
/** Highest hip-ankle distance allowed over a flat foot (share of the leg reach): a soft knee. */
const FLAT_EXT = 0.97;

export function newGaitParams(): GaitParams {
  return { ...KEYS[1]! };
}

/** v̂ = v / sqrt(g * hip height) (sqrt Froude). */
export function gaitSpeedHat(d: RigData, v: number): number {
  return v / Math.sqrt(G * d.hipY);
}

/** Interpolate the gait keys at model speed v and scale lengths to the rig. */
export function gaitParams(d: RigData, v: number, out: GaitParams): GaitParams {
  const h = gaitSpeedHat(d, v);
  let i = 0;
  while (i < KEYS_V.length - 2 && h > KEYS_V[i + 1]!) i++;
  const t = easeInOut((h - KEYS_V[i]!) / (KEYS_V[i + 1]! - KEYS_V[i]!));
  const a = KEYS[i]!;
  const b = KEYS[i + 1]!;
  for (let k = 0; k < N_PARAMS; k++) {
    const n = PARAM_NAMES[k]!;
    out[n] = lerp(a[n], b[n], t);
  }
  for (const n of LENGTH_KEYS) out[n] *= d.legUnit;
  // whatever the rig's legs: over a flat foot (ankle straight below) the hip stays within FLAT_EXT of
  // the reach at the top of the bob (a straight rest leg would otherwise be unreachable)
  const top = d.hipY + out.crouch + Math.max(0, out.bob) - d.ankleY;
  const lim = FLAT_EXT * d.legReach;
  if (top > lim) out.crouch -= top - lim;
  return out;
}

/** Ankle relative to a sole pivot (local x px, sole at -ankleY) for a sole pitch: -Rz(pitch)·(px, -ay). */
function ankleFromPivot(px: number, ay: number, pitch: number, o: Float64Array): void {
  const c = Math.cos(pitch);
  const s = Math.sin(pitch);
  o[0] = -(px * c + ay * s);
  o[1] = -(px * s - ay * c);
}

const scr = new Float64Array(4);

export interface GaitGeom {
  /** Largest hip travel during stance this rig allows with these params. */
  lcMax: number;
  /** Heel x (root space) at strike for the stride in use. */
  heelStrike: number;
  stride: number;
}

/** Contact geometry for params P (reach-limited) and the stride to use at model speed v. */
export function gaitGeom(d: RigData, P: GaitParams, v: number, out: GaitGeom): GaitGeom {
  const R = d.legReach * 0.985;
  const dz = Math.abs(P.track - d.hipZ) + Math.abs(P.sway);
  const Rxy = Math.sqrt(Math.max(1e-6, R * R - dz * dz));
  // pelvis height at heel strike and at toe-off of the stance foot (same by symmetry)
  const H = d.hipY + P.crouch + P.bob * Math.cos(2 * Math.PI * P.duty);
  const twistFront = d.hipZ * Math.sin(P.twist);
  const twistBack = -d.hipZ * Math.sin(P.twist * Math.cos(2 * Math.PI * P.duty));
  ankleFromPivot(d.heelX, d.ankleY, P.heel, scr); // ankle rel heel at strike
  const asx = scr[0]!;
  const asy = scr[1]!;
  ankleFromPivot(d.toeX, d.ankleY, -P.toe, scr); // ankle rel toe at toe-off
  const atx = scr[0]!;
  const aty = scr[1]!;
  const front = Math.sqrt(Math.max(0, Rxy * Rxy - (H - asy) * (H - asy))) + twistFront;
  const back = Math.sqrt(Math.max(0, Rxy * Rxy - (H - aty) * (H - aty))) - twistBack;
  const heelMax = front - asx;
  const toeMin = -back - atx;
  const lcMax = Math.max(0.01 * d.legUnit, heelMax + (d.toeX - d.heelX) - toeMin);
  const strideCard = v * CARD_STRIDE_S * Math.sqrt(d.legUnit);
  let strideGeo = (P.lcFrac * lcMax) / P.duty;
  // the endpoints are not the whole story (mid toe-roll can be the farthest): verify the stance
  for (let it = 0; it < 4; it++) {
    const st = Math.max(0.02 * d.legUnit, Math.min(strideGeo, strideCard));
    const hs = heelMax - (lcMax - st * P.duty) * 0.5;
    const over = stanceOverreach(d, P, st, hs);
    if (over <= 1) break;
    strideGeo = Math.min(strideGeo, st) * (1 - Math.min(0.5, (over - 1) * 3 + 0.02));
  }
  const stride = Math.max(0.02 * d.legUnit, Math.min(strideGeo, strideCard));
  const slack = lcMax - stride * P.duty;
  out.lcMax = lcMax;
  out.stride = stride;
  out.heelStrike = heelMax - slack * 0.5;
  return out;
}

const SAMPLE_S = [0, 0.04, 0.08, 0.12, 0.16, 0.58, 0.64, 0.7, 0.76, 0.82, 0.88, 0.94, 1];

/** Largest hip-ankle distance / reach over the stance of one foot (right; the left mirrors it). */
function stanceOverreach(d: RigData, P: GaitParams, stride: number, heelStrike: number): number {
  const R = d.legReach * 0.985;
  const yaw = -P.toeOut;
  const ftx = (d.toeX - d.heelX) * Math.cos(yaw);
  let worst = 0;
  for (let i = 0; i < SAMPLE_S.length; i++) {
    const s = SAMPLE_S[i]!;
    const u = s * P.duty;
    const heelX = heelStrike - stride * u;
    let pitch: number;
    let px: number;
    let plx: number;
    if (s < ST) {
      pitch = s < SH ? P.heel * (1 - easeOut(s / SH)) : 0;
      px = heelX;
      plx = d.heelX;
    } else {
      pitch = -P.toe * easeIn((s - ST) / (1 - ST));
      px = heelX + ftx;
      plx = d.toeX;
    }
    soleOffset(plx, -d.ankleY, yaw, pitch, pv);
    const ax = px - pv[0]!;
    const ay = -pv[1]!;
    const mid = P.duty * 0.5;
    const c2 = Math.cos(2 * Math.PI * (u - mid));
    const hy = d.hipY + P.crouch + P.bob * Math.cos(4 * Math.PI * (u - mid)) - d.hipZ * Math.sin(-P.roll * c2);
    const hx = d.hipZ * Math.sin(P.twist * Math.cos(2 * Math.PI * u));
    const hz = d.hipZ + P.sway * c2;
    const dist = Math.hypot(ax - hx, ay - hy, P.track - hz);
    worst = Math.max(worst, dist / R);
  }
  return worst;
}

/** Concept walk speed of this rig: the fastest speed that still keeps the card cadence. */
export function conceptSpeed(d: RigData): number {
  const P = newGaitParams();
  const g: GaitGeom = { lcMax: 0, heelStrike: 0, stride: 0 };
  // fixed point: params depend on v, v = strideGeo / T
  let v = 0.6 * d.legUnit;
  for (let i = 0; i < 12; i++) {
    gaitParams(d, v, P);
    gaitGeom(d, P, 1e9, g);
    v = g.stride / (CARD_STRIDE_S * Math.sqrt(d.legUnit));
  }
  return v;
}

const pv = new Float64Array(3);

/**
 * Sample the gait at phase into `out`: pelvis, spine, chest, head, both legs (IK) and free-arm swing.
 * `slope` (dy/dx along +X, root space) bends the ground for stairs; `heavy` 0..1 adds a load.
 */
export function sampleGait(d: RigData, P: GaitParams, g: GaitGeom, phase: number, out: PoseFrame, slope = 0, viewYaw = 0): void {
  const TAU = Math.PI * 2;
  const ph = wrap01(phase);
  const mid = P.duty * 0.5;
  const c2 = Math.cos(TAU * (ph - mid));
  const c4 = Math.cos(2 * TAU * (ph - mid));
  const tw = Math.cos(TAU * ph);
  const r = out.rot;
  const p = out.pos;
  // pelvis: bob, sway toward the stance leg, swing hip drops (roll) and goes forward (twist)
  p[BONE.PELVIS * 3 + 1] = P.crouch + P.bob * c4;
  p[BONE.PELVIS * 3 + 2] = P.sway * c2;
  r[BONE.PELVIS * 3] = -P.roll * c2;
  r[BONE.PELVIS * 3 + 1] = P.twist * tw;
  // torso counter-rotates, leans; the head stays level and steady
  r[BONE.SPINE * 3] = P.roll * c2 * 0.5;
  r[BONE.SPINE * 3 + 1] = -P.twist * tw * 0.6;
  r[BONE.SPINE * 3 + 2] = -P.lean * 0.55;
  r[BONE.CHEST * 3] = P.roll * c2 * 0.3;
  r[BONE.CHEST * 3 + 1] = -P.twist * tw * 0.5;
  r[BONE.CHEST * 3 + 2] = -P.lean * 0.45 + 0.012 * c4;
  r[BONE.HEAD * 3] = -P.roll * c2 * 0.2;
  r[BONE.HEAD * 3 + 1] = P.twist * tw * 0.12;
  r[BONE.HEAD * 3 + 2] = P.lean * 0.78 - 0.012 * c4;
  // travel runs along world X: pelvis and legs in profile (the root cancels the view yaw), torso,
  // beard and head turn back toward the camera by the same yaw (readability of the variant)
  out.root[3] = viewYaw;
  r[BONE.SPINE * 3 + 1] -= viewYaw * 0.45;
  r[BONE.CHEST * 3 + 1] -= viewYaw * 0.4;
  r[BONE.HEAD * 3 + 1] -= viewYaw * 0.15;
  foot(d, P, g, frac(ph), 1, out, slope);
  foot(d, P, g, frac(ph - 0.5), -1, out, slope);
  // free arms swing against the legs (right arm forward with the left leg), slight lag
  const sw = P.armSwing * Math.cos(TAU * (ph - 0.06));
  r[BONE.ARM_R * 3] = -0.07;
  r[BONE.ARM_R * 3 + 2] = -sw;
  r[BONE.FORE_R * 3 + 2] = P.elbow + 0.6 * Math.max(0, -sw);
  r[BONE.ARM_L * 3] = 0.07;
  r[BONE.ARM_L * 3 + 2] = sw;
  r[BONE.FORE_L * 3 + 2] = P.elbow + 0.6 * Math.max(0, sw);
}

/** Free-arm swing angle of the right arm at a phase (holds add a scaled copy). */
export function armSwingAt(P: GaitParams, phase: number): number {
  return -P.armSwing * Math.cos(Math.PI * 2 * (wrap01(phase) - 0.06));
}

function foot(d: RigData, P: GaitParams, g: GaitGeom, u: number, side: 1 | -1, out: PoseFrame, slope: number): void {
  const e = side > 0 ? IK.FOOT_R : IK.FOOT_L;
  const fb = side > 0 ? BONE.FOOT_R : BONE.FOOT_L;
  const si = side > 0 ? 0 : 1;
  const ay = d.ankleY;
  const hx = d.heelX;
  const tx = d.toeX;
  const duty = P.duty;
  const stride = g.stride;
  const yaw = -side * P.toeOut;
  // heel -> toe along the toed-out foot (Ry: x' = x cos, z' = -x sin)
  const ftx = (tx - hx) * Math.cos(yaw);
  const ftz = -(tx - hx) * Math.sin(yaw);
  const z = side * P.track;
  let ax: number;
  let ayy: number;
  let az: number;
  let pitch: number;
  let planted = 0;
  let pvx = 0;
  let pvz = z;
  if (u < duty) {
    planted = 1;
    const s = u / duty;
    const heelX = g.heelStrike - stride * u;
    let plx: number;
    if (s < ST) {
      // heel roll, then the flat sole (the heel stays the pivot; the toe is down too)
      pitch = s < SH ? P.heel * (1 - easeOut(s / SH)) : 0;
      pvx = heelX;
      pvz = z;
      plx = hx;
    } else {
      pitch = -P.toe * easeIn((s - ST) / (1 - ST));
      pvx = heelX + ftx;
      pvz = z + ftz;
      plx = tx;
    }
    // ankle = pivot - Rz(pitch)·Ry(yaw)·(plx, -ay, 0)
    soleOffset(plx, -ay, yaw, pitch, pv);
    ax = pvx - pv[0]!;
    ayy = -pv[1]!;
    az = pvz - pv[2]!;
  } else {
    const w = (u - duty) / (1 - duty);
    // from the toe-off pose to the next heel strike
    soleOffset(tx, -ay, yaw, -P.toe, pv);
    const x0 = g.heelStrike - stride * duty + ftx - pv[0]!;
    const y0 = -pv[1]!;
    soleOffset(hx, -ay, yaw, P.heel, pv);
    const x1 = g.heelStrike - pv[0]!;
    const y1 = -pv[1]!;
    const z1 = z - pv[2]!;
    // lift-off still moving back, arrival with zero velocity (no forward overshoot past the strike)
    const m = -stride * (1 - duty) * 0.5;
    ax = hermite(x0, m, x1, 0, w);
    ayy = lerp(y0, y1, w) + P.clear * bump(w, 0.42);
    pitch = lerp(-P.toe, P.heel, easeInOut(w));
    az = z1 - side * 0.012 * d.legUnit * bump(w, 0.5);
    // keep the toe off the ground while it swings through
    soleOffset(tx, -ay, yaw, pitch, pv);
    const toeY = ayy + pv[1]! + slope * pv[0]!;
    const minY = 0.006 * d.legUnit;
    if (toeY < minY) ayy += minY - toeY;
  }
  const yOff = slope * (planted ? pvx : ax);
  setIK(out, e, ax, ayy + yOff, az, pitch, 1);
  out.rot[fb * 3] = 0;
  out.rot[fb * 3 + 1] = yaw;
  if (out instanceof AnimPose) {
    out.contact[si] = planted;
    out.pivot[si * 3] = planted ? pvx : ax;
    out.pivot[si * 3 + 1] = planted ? slope * pvx : ayy - ay + yOff;
    out.pivot[si * 3 + 2] = pvz;
  }
}

/** o = Rz(pitch)·Ry(yaw)·(px, py, 0). */
function soleOffset(px: number, py: number, yaw: number, pitch: number, o: Float64Array): void {
  const X = px * Math.cos(yaw);
  const Z = -px * Math.sin(yaw);
  const c = Math.cos(pitch);
  const s = Math.sin(pitch);
  o[0] = X * c - py * s;
  o[1] = X * s + py * c;
  o[2] = Z;
}
