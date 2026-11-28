/**
 * Procedural dwarf rig (owner: W2): forward kinematics from the rest joints + a PoseFrame, with
 * analytic two-bone IK (pole vector) for legs and arms, automatic pelvis drop when a foot target is
 * out of reach, and "slinging" of the tool sockets onto the back (re-parenting to CHEST inside the
 * rig; the renderer only ever sees final bone matrices).
 *
 * Output: model-space bone matrices W (float64, column-major), copied to the contract's Float32
 * `bones` by the animator. Skin matrix of bone b = placement * W[b] * T(-rest[b]) (contract).
 * Allocation-free after construction.
 */
import { composeTRS, eulerFromRot3, mulAffine, mulT3, rot3FromEuler, rot3OfMat4, unwrapNear, xformPoint } from './mat';
import { AnimPose } from './pose';
import { rigData, type RigData } from './rigdata';
import { BONE, BONE_COUNT, BONE_PARENT, IK, type PoseFrame, type RigInput } from './types';

/** Upper limit of the automatic pelvis drop (fraction of the hip height). */
const MAX_DROP = 0.4;

/** Limb chains, 6 ints each: effector, upper, lower, end, socket (arms: fist) or -1, side sign. */
const CHAINS = Int32Array.of(
  IK.FOOT_R, BONE.THIGH_R, BONE.SHIN_R, BONE.FOOT_R, -1, 1,
  IK.FOOT_L, BONE.THIGH_L, BONE.SHIN_L, BONE.FOOT_L, -1, -1,
  IK.HAND_R, BONE.ARM_R, BONE.FORE_R, BONE.HAND_R, BONE.TOOL_R, 1,
  IK.HAND_L, BONE.ARM_L, BONE.FORE_L, BONE.HAND_L, BONE.TOOL_L, -1,
);
const LEG_R = 0;
const LEG_L = 6;
const ARM_R = 12;
const ARM_L = 18;

export class Rig {
  readonly d: RigData;
  /** Model-space bone matrices after the last solve. */
  readonly W = new Float64Array(BONE_COUNT * 16);
  /** Effective local Euler rotations of the last solve (FK input after IK). */
  readonly rot = new Float64Array(BONE_COUNT * 3);
  /** Pelvis drop applied by the last solve (tiles). */
  lastDrop = 0;
  /** Distance between each effector target and what was reached in the last solve (tests, metrics). */
  readonly ikError = new Float64Array(4);
  /** Slung tool transforms in CHEST-local space: per socket px, py, pz, rx, ry, rz. */
  readonly slung = new Float64Array(12);

  private readonly loc = new Float64Array(16);
  /** Local 3x3 rotations solved by IK (used directly by FK when the weight is 1). */
  private readonly lrot = new Float64Array(BONE_COUNT * 9);
  private readonly useL = new Uint8Array(BONE_COUNT);
  private readonly tmp = new Float64Array(32);
  private readonly R = new Float64Array(9 * 8);
  private readonly v = new Float64Array(3 * 12);
  private readonly e = new Float64Array(6);

  constructor(rig: RigInput) {
    this.d = rigData(rig);
    this.initSlung();
  }

  /** Solve IK + FK for a pose. */
  solve(p: PoseFrame): void {
    const W = this.W;
    const off = this.d.off;
    const rot = this.rot;
    for (let i = 0; i < rot.length; i++) rot[i] = p.rot[i]!;
    const ap = p instanceof AnimPose ? p : null;
    this.lastDrop = 0;
    this.ikError.fill(0);
    this.useL.fill(0);
    for (let b = 0; b < BONE_COUNT; b++) {
      if (b === BONE.THIGH_R && p.ikW[IK.FOOT_R]! > 0) this.solveChain(p, ap, LEG_R);
      else if (b === BONE.THIGH_L && p.ikW[IK.FOOT_L]! > 0) this.solveChain(p, ap, LEG_L);
      else if (b === BONE.ARM_R && p.ikW[IK.HAND_R]! > 0) this.solveChain(p, ap, ARM_R);
      else if (b === BONE.ARM_L && p.ikW[IK.HAND_L]! > 0) this.solveChain(p, ap, ARM_L);
      const o3 = b * 3;
      if (this.useL[b] === 1) this.localFromRot3(b, off[o3]! + p.pos[o3]!, off[o3 + 1]! + p.pos[o3 + 1]!, off[o3 + 2]! + p.pos[o3 + 2]!, p.scale[b]!);
      else composeTRS(this.loc, 0, off[o3]! + p.pos[o3]!, off[o3 + 1]! + p.pos[o3 + 1]!, off[o3 + 2]! + p.pos[o3 + 2]!, rot[o3]!, rot[o3 + 1]!, rot[o3 + 2]!, p.scale[b]!);
      const parent = BONE_PARENT[b]!;
      if (parent < 0) W.set(this.loc, 0);
      else mulAffine(W, b * 16, W, parent * 16, this.loc, 0);
      if (b === BONE.PELVIS && (p.ikW[IK.FOOT_R]! > 0 || p.ikW[IK.FOOT_L]! > 0)) this.pelvisDrop(p);
      if ((b === BONE.TOOL_R || b === BONE.TOOL_L) && ap) {
        const a = ap.attach[b === BONE.TOOL_R ? 0 : 1]!;
        if (a > 0) this.sling(b, a, p.scale[b]!);
      }
    }
  }

  private localFromRot3(b: number, tx: number, ty: number, tz: number, s: number): void {
    const L = this.loc;
    const r = this.lrot;
    const o = b * 9;
    L[0] = r[o]! * s;
    L[1] = r[o + 1]! * s;
    L[2] = r[o + 2]! * s;
    L[3] = 0;
    L[4] = r[o + 3]! * s;
    L[5] = r[o + 4]! * s;
    L[6] = r[o + 5]! * s;
    L[7] = 0;
    L[8] = r[o + 6]! * s;
    L[9] = r[o + 7]! * s;
    L[10] = r[o + 8]! * s;
    L[11] = 0;
    L[12] = tx;
    L[13] = ty;
    L[14] = tz;
    L[15] = 1;
  }

  /** World-free helper: model-space position of a point given in bone b's local frame. */
  point(b: number, x: number, y: number, z: number, out: Float64Array | Float32Array, o: number): void {
    xformPoint(this.W, b * 16, x, y, z, out, o);
  }

  /** Copy W into a Float32 bone array (contract `bones`). */
  write(out: Float32Array): void {
    const W = this.W;
    for (let i = 0; i < W.length; i++) out[i] = W[i]!;
  }

  /** Recompute the matrix of one bone from its parent (after secondary motion edits rot). */
  refresh(b: number, p: PoseFrame): void {
    const off = this.d.off;
    const rot = this.rot;
    const o3 = b * 3;
    composeTRS(this.loc, 0, off[o3]! + p.pos[o3]!, off[o3 + 1]! + p.pos[o3 + 1]!, off[o3 + 2]! + p.pos[o3 + 2]!, rot[o3]!, rot[o3 + 1]!, rot[o3 + 2]!, p.scale[b]!);
    mulAffine(this.W, b * 16, this.W, BONE_PARENT[b]! * 16, this.loc, 0);
  }

  // ---------------------------------------------------------------------------------------------- IK
  private pelvisDrop(p: PoseFrame): void {
    const W = this.W;
    const off = this.d.off;
    const v = this.v;
    const reach = this.d.legReach * 0.999;
    let drop = 0;
    for (let s = 0; s < 2; s++) {
      const e = s === 0 ? IK.FOOT_R : IK.FOOT_L;
      const w = p.ikW[e]!;
      if (w <= 0) continue;
      const th = s === 0 ? BONE.THIGH_R : BONE.THIGH_L;
      xformPoint(W, BONE.PELVIS * 16, off[th * 3]! + p.pos[th * 3]!, off[th * 3 + 1]! + p.pos[th * 3 + 1]!, off[th * 3 + 2]! + p.pos[th * 3 + 2]!, v, 0);
      const dx = p.ik[e * 4]! - v[0]!;
      const dz = p.ik[e * 4 + 2]! - v[2]!;
      const dy = v[1]! - p.ik[e * 4 + 1]!; // hip above target
      const h2 = dx * dx + dz * dz;
      const need = h2 < reach * reach ? dy - Math.sqrt(reach * reach - h2) : dy;
      if (need * w > drop) drop = need * w;
    }
    const max = MAX_DROP * this.d.hipY;
    if (drop > max) drop = max;
    if (drop > 0) {
      W[BONE.PELVIS * 16 + 13] -= drop;
      this.lastDrop = drop;
    }
  }

  /**
   * Two-bone IK of one limb. Writes blended local Euler angles for the upper, lower and end bones
   * into this.rot (FK continues from them).
   */
  private solveChain(p: PoseFrame, ap: AnimPose | null, c: number): void {
    const eff = CHAINS[c]!;
    const upper = CHAINS[c + 1]!;
    const lower = CHAINS[c + 2]!;
    const end = CHAINS[c + 3]!;
    const socket = CHAINS[c + 4]!;
    const side = CHAINS[c + 5]!;
    const isArm = socket >= 0;
    const W = this.W;
    const off = this.d.off;
    const rot = this.rot;
    const R = this.R; // 0 parent, 9 R1, 18 R2, 27 Rend, 36 F, 45 Fr, 54 tmp, 63 local
    const v = this.v; // 0 A, 3 T, 6 n, 9 b, 12 K, 15 pole, 18 dir1, 21 dir2, 24 h, 27 tmp
    const w = Math.min(1, p.ikW[eff]!);
    const parent = BONE_PARENT[upper]!;
    // chain root in model space
    xformPoint(W, parent * 16, off[upper * 3]! + p.pos[upper * 3]!, off[upper * 3 + 1]! + p.pos[upper * 3 + 1]!, off[upper * 3 + 2]! + p.pos[upper * 3 + 2]!, v, 0);
    rot3OfMat4(W, parent * 16, R, 0);
    // end orientation (root space): feet pitch the sole, hands pitch the fist
    const pitch = p.ik[eff * 4 + 3]!;
    rot3FromEuler(R, 27, rot[end * 3]!, rot[end * 3 + 1]!, pitch);
    // target of the two-bone chain: ankle (legs) or wrist = fist - Rend * socket offset (arms)
    let tx = p.ik[eff * 4]!;
    let ty = p.ik[eff * 4 + 1]!;
    let tz = p.ik[eff * 4 + 2]!;
    if (isArm) {
      const sx = off[socket * 3]!;
      const sy = off[socket * 3 + 1]!;
      const sz = off[socket * 3 + 2]!;
      tx -= R[27]! * sx + R[30]! * sy + R[33]! * sz;
      ty -= R[28]! * sx + R[31]! * sy + R[34]! * sz;
      tz -= R[29]! * sx + R[32]! * sy + R[35]! * sz;
    }
    v[3] = tx;
    v[4] = ty;
    v[5] = tz;
    // pole (root space): clip hint or default (knee forward and a little out; elbow back, down, out)
    let px = 0;
    let py = 0;
    let pz = 0;
    if (ap) {
      px = ap.pole[eff * 3]!;
      py = ap.pole[eff * 3 + 1]!;
      pz = ap.pole[eff * 3 + 2]!;
    }
    if (px === 0 && py === 0 && pz === 0) {
      const lx = isArm ? -0.45 : 1;
      const ly = isArm ? -1 : 0;
      const lz = isArm ? 0.55 * side : 0.18 * side;
      px = R[0]! * lx + R[3]! * ly + R[6]! * lz;
      py = R[1]! * lx + R[4]! * ly + R[7]! * lz;
      pz = R[2]! * lx + R[5]! * ly + R[8]! * lz;
    }
    v[15] = px;
    v[16] = py;
    v[17] = pz;
    const l1 = Math.sqrt(off[lower * 3]! * off[lower * 3]! + off[lower * 3 + 1]! * off[lower * 3 + 1]! + off[lower * 3 + 2]! * off[lower * 3 + 2]!);
    const l2 = Math.sqrt(off[end * 3]! * off[end * 3]! + off[end * 3 + 1]! * off[end * 3 + 1]! + off[end * 3 + 2]! * off[end * 3 + 2]!);
    twoBone(v, R, l1, l2, isArm ? -1 : 1, off, lower, end);
    // reached error (for tests): |E - T|
    const ex = v[30]! - tx;
    const ey = v[31]! - ty;
    const ez = v[32]! - tz;
    this.ikError[eff] = Math.sqrt(ex * ex + ey * ey + ez * ez);
    // locals: L1 = Rpᵀ R1, L2 = R1ᵀ R2, L3 = R2ᵀ Rend
    const e = this.e;
    const full = w >= 1;
    const lr = this.lrot;
    mulT3(full ? lr : R, full ? upper * 9 : 63, R, 0, R, 9);
    eulerFromRot3(full ? lr : R, full ? upper * 9 : 63, e, 0);
    blendRot(rot, upper, e, w);
    mulT3(full ? lr : R, full ? lower * 9 : 63, R, 9, R, 18);
    eulerFromRot3(full ? lr : R, full ? lower * 9 : 63, e, 0);
    blendRot(rot, lower, e, w);
    mulT3(full ? lr : R, full ? end * 9 : 63, R, 18, R, 27);
    eulerFromRot3(full ? lr : R, full ? end * 9 : 63, e, 0);
    blendRot(rot, end, e, w);
    if (full) {
      // FK uses these matrices directly (the Euler copy stays for readers of rig.rot)
      this.useL[upper] = 1;
      this.useL[lower] = 1;
      this.useL[end] = 1;
    }
  }

  // ---------------------------------------------------------------------------------------------- slung tools
  private initSlung(): void {
    const d = this.d;
    const u = d.unit;
    const rest = d.rest;
    const R = this.R;
    for (let s = 0; s < 2; s++) {
      const side = s === 0 ? 1 : -1;
      // fist at the lower back, handle up across the back toward the opposite... same-side shoulder
      const px = -d.chestR * 1.02 - 0.02 * u;
      const py = rest[BONE.SPINE * 3 + 1]! + 0.04 * u;
      const pz = -0.1 * u * side;
      // frame: Y along the handle (up, toward this side, a little back), X = blade facing backward
      let yx = -0.18;
      let yy = 0.86;
      let yz = 0.48 * side;
      const yl = Math.sqrt(yx * yx + yy * yy + yz * yz);
      yx /= yl;
      yy /= yl;
      yz /= yl;
      // X = (-1,0,0) orthogonalised against Y: (-1,0,0) - ((-1,0,0)·Y) Y = (-1,0,0) + yx Y
      let xx = -1 + yx * yx;
      let xy = yx * yy;
      let xz = yx * yz;
      const xl = Math.sqrt(xx * xx + xy * xy + xz * xz);
      xx /= xl;
      xy /= xl;
      xz /= xl;
      // Z = X × Y
      const zx = xy * yz - xz * yy;
      const zy = xz * yx - xx * yz;
      const zz = xx * yy - xy * yx;
      R[0] = xx;
      R[1] = xy;
      R[2] = xz;
      R[3] = yx;
      R[4] = yy;
      R[5] = yz;
      R[6] = zx;
      R[7] = zy;
      R[8] = zz;
      eulerFromRot3(R, 0, this.slung, s * 6 + 3);
      // chest rest orientation is identity: chest-local = model rest - chest rest
      this.slung[s * 6] = px - rest[BONE.CHEST * 3]!;
      this.slung[s * 6 + 1] = py - rest[BONE.CHEST * 3 + 1]!;
      this.slung[s * 6 + 2] = pz - rest[BONE.CHEST * 3 + 2]!;
    }
  }

  private sling(b: number, a: number, scale: number): void {
    const W = this.W;
    const t = this.tmp;
    const o = (b === BONE.TOOL_R ? 0 : 1) * 6;
    const sl = this.slung;
    composeTRS(this.loc, 0, sl[o]!, sl[o + 1]!, sl[o + 2]!, sl[o + 3]!, sl[o + 4]!, sl[o + 5]!, scale);
    mulAffine(t, 0, W, BONE.CHEST * 16, this.loc, 0);
    if (a >= 1) {
      for (let i = 0; i < 16; i++) W[b * 16 + i] = t[i]!;
      return;
    }
    // blend hand-held (current W[b]) -> slung (t): positions linearly, rotations as Euler
    const R = this.R;
    const e = this.e;
    const sa = rot3OfMat4(W, b * 16, R, 54);
    eulerFromRot3(R, 54, e, 0);
    rot3OfMat4(t, 0, R, 63);
    eulerFromRot3(R, 63, e, 3);
    const x = W[b * 16 + 12]! + (t[12]! - W[b * 16 + 12]!) * a;
    const y = W[b * 16 + 13]! + (t[13]! - W[b * 16 + 13]!) * a;
    const z = W[b * 16 + 14]! + (t[14]! - W[b * 16 + 14]!) * a;
    const rx = e[0]! + (unwrapNear(e[3]!, e[0]!) - e[0]!) * a;
    const ry = e[1]! + (unwrapNear(e[4]!, e[1]!) - e[1]!) * a;
    const rz = e[2]! + (unwrapNear(e[5]!, e[2]!) - e[2]!) * a;
    composeTRS(W, b * 16, x, y, z, rx, ry, rz, sa);
  }
}

/** rot[b] = fk + (ik - fk) * w with each IK angle unwrapped next to the FK angle. */
function blendRot(rot: Float64Array, b: number, e: Float64Array, w: number): void {
  for (let k = 0; k < 3; k++) {
    const fk = rot[b * 3 + k]!;
    const ik = unwrapNear(e[k]!, fk);
    rot[b * 3 + k] = fk + (ik - fk) * w;
  }
}

/**
 * Analytic two-bone IK.
 * In:  v[0..2] chain root A, v[3..5] target T, v[15..17] pole direction; l1, l2 bone lengths;
 *      bendSign +1 when the rest bend goes toward +X (knees), -1 toward -X (elbows);
 *      rest offsets of the lower and end bones (rest directions of both bones).
 * Out: R[9..17] = R1, R[18..26] = R2 (model-space rotations mapping each bone's rest frame to its
 *      posed frame); v[30..32] = reached end point.
 */
function twoBone(v: Float64Array, R: Float64Array, l1: number, l2: number, bendSign: number, off: Float64Array, lower: number, end: number): void {
  const ax = v[0]!;
  const ay = v[1]!;
  const az = v[2]!;
  let nx = v[3]! - ax;
  let ny = v[4]! - ay;
  let nz = v[5]! - az;
  let d = Math.sqrt(nx * nx + ny * ny + nz * nz);
  // rest directions of the two bones (unit)
  let r1x = off[lower * 3]!;
  let r1y = off[lower * 3 + 1]!;
  let r1z = off[lower * 3 + 2]!;
  const r1l = Math.sqrt(r1x * r1x + r1y * r1y + r1z * r1z) || 1;
  r1x /= r1l;
  r1y /= r1l;
  r1z /= r1l;
  let r2x = off[end * 3]!;
  let r2y = off[end * 3 + 1]!;
  let r2z = off[end * 3 + 2]!;
  const r2l = Math.sqrt(r2x * r2x + r2y * r2y + r2z * r2z) || 1;
  r2x /= r2l;
  r2y /= r2l;
  r2z /= r2l;
  if (d < 1e-9) {
    nx = r1x;
    ny = r1y;
    nz = r1z;
    d = 0;
  } else {
    nx /= d;
    ny /= d;
    nz /= d;
  }
  const dmin = Math.abs(l1 - l2) + 1e-6;
  const dmax = (l1 + l2) * (1 - 1e-9);
  const dc = d < dmin ? dmin : d > dmax ? dmax : d;
  // bend direction: pole projected onto the plane normal to n
  let px = v[15]!;
  let py = v[16]!;
  let pz = v[17]!;
  let pn = px * nx + py * ny + pz * nz;
  let bx = px - pn * nx;
  let by = py - pn * ny;
  let bz = pz - pn * nz;
  let bl = Math.sqrt(bx * bx + by * by + bz * bz);
  if (bl < 1e-6) {
    // pole along the chain: fall back to the rest bend axis (x) then z
    px = bendSign;
    py = 0;
    pz = 0;
    pn = px * nx;
    bx = px - pn * nx;
    by = -pn * ny;
    bz = -pn * nz;
    bl = Math.sqrt(bx * bx + by * by + bz * bz);
    if (bl < 1e-6) {
      bx = 0;
      by = 0;
      bz = 1;
      bl = 1;
    }
  }
  bx /= bl;
  by /= bl;
  bz /= bl;
  const cosA = Math.max(-1, Math.min(1, (l1 * l1 + dc * dc - l2 * l2) / (2 * l1 * dc)));
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const kx = ax + l1 * (cosA * nx + sinA * bx);
  const ky = ay + l1 * (cosA * ny + sinA * by);
  const kz = az + l1 * (cosA * nz + sinA * bz);
  const ex = ax + dc * nx;
  const ey = ay + dc * ny;
  const ez = az + dc * nz;
  v[30] = ex;
  v[31] = ey;
  v[32] = ez;
  // posed hinge h = n × b
  const hx = ny * bz - nz * by;
  const hy = nz * bx - nx * bz;
  const hz = nx * by - ny * bx;
  // rest hinge h0 = r1 × b0 with b0 = (bendSign, 0, 0) projected
  let b0x = bendSign - (bendSign * r1x) * r1x;
  let b0y = -(bendSign * r1x) * r1y;
  let b0z = -(bendSign * r1x) * r1z;
  const b0l = Math.sqrt(b0x * b0x + b0y * b0y + b0z * b0z) || 1;
  b0x /= b0l;
  b0y /= b0l;
  b0z /= b0l;
  const h0x = r1y * b0z - r1z * b0y;
  const h0y = r1z * b0x - r1x * b0z;
  const h0z = r1x * b0y - r1y * b0x;
  // bone 1
  frame(R, 36, -(kx - ax) / l1, -(ky - ay) / l1, -(kz - az) / l1, hx, hy, hz);
  frame(R, 45, -r1x, -r1y, -r1z, h0x, h0y, h0z);
  mulFrT(R, 9, 36, 45);
  // bone 2
  frame(R, 36, -(ex - kx) / l2, -(ey - ky) / l2, -(ez - kz) / l2, hx, hy, hz);
  // rest frame of bone 2 shares the rest hinge (re-orthogonalised against its own direction)
  frame(R, 45, -r2x, -r2y, -r2z, h0x, h0y, h0z);
  mulFrT(R, 18, 36, 45);
}

/** Orthonormal frame [X = Y × Z', Y, Z'] (column-major) from a Y axis and an approximate Z. */
function frame(R: Float64Array, o: number, yx: number, yy: number, yz: number, zx: number, zy: number, zz: number): void {
  const yl = Math.sqrt(yx * yx + yy * yy + yz * yz) || 1;
  yx /= yl;
  yy /= yl;
  yz /= yl;
  const d = zx * yx + zy * yy + zz * yz;
  zx -= d * yx;
  zy -= d * yy;
  zz -= d * yz;
  const zl = Math.sqrt(zx * zx + zy * zy + zz * zz) || 1;
  zx /= zl;
  zy /= zl;
  zz /= zl;
  R[o] = yy * zz - yz * zy;
  R[o + 1] = yz * zx - yx * zz;
  R[o + 2] = yx * zy - yy * zx;
  R[o + 3] = yx;
  R[o + 4] = yy;
  R[o + 5] = yz;
  R[o + 6] = zx;
  R[o + 7] = zy;
  R[o + 8] = zz;
}

/** R[o] = R[a] * R[b]ᵀ (frames). */
function mulFrT(R: Float64Array, o: number, a: number, b: number): void {
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 3; i++) {
      // (A Bᵀ)[i][j] = sum_k A[i][k] B[j][k]
      R[o + j * 3 + i] = R[a + i]! * R[b + j]! + R[a + 3 + i]! * R[b + 3 + j]! + R[a + 6 + i]! * R[b + 6 + j]!;
    }
  }
}
