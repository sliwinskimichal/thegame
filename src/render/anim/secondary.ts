/**
 * Secondary motion (owner: W2): beard (2 bones), front apron, back apron ("tylnik") and the belt
 * lantern as damped springs on a tip particle in WORLD space. The rigid pose gives each bone's
 * target tip; the particle lags behind it (inertia of walking, stopping, swinging a pick) and sags
 * toward world-down by a per-bone share (aprons and the lantern hang, the beard is stiff). The
 * particle's direction is turned back into a local pitch/roll offset of the bone.
 *
 * Integration: semi-implicit Euler with fixed-size substeps (<= 1/120 s), targets interpolated
 * across the substeps -> stable and (nearly) frame-rate independent; deterministic (no randomness,
 * same inputs and dt sequence -> same state). Teleports (> 0.5 world tiles per frame) reset it.
 */
import { xformPoint } from './mat';
import type { Rig } from './rig';
import { BONE, BONE_PARENT, type PoseFrame } from './types';

interface Spring {
  bone: number;
  len: number; // model units
  omega: number;
  zeta: number;
  /** share of world-down in the target direction (0 rigid, 1 free pendulum) */
  hang: number;
  limZ: number;
  limX: number;
}

const H = 1 / 120;

export class Secondary {
  private readonly springs: Spring[] = [];
  /** per spring: particle p(3), velocity v(3), previous target(3) */
  private readonly st: Float64Array;
  private ready = false;
  private readonly v = new Float64Array(12);

  constructor(private readonly rig: Rig) {
    const d = rig.d;
    const r = d.rest;
    const u = d.unit;
    const dist = (a: number, b: number) => Math.hypot(r[a * 3]! - r[b * 3]!, r[a * 3 + 1]! - r[b * 3 + 1]!, r[a * 3 + 2]! - r[b * 3 + 2]!);
    const beard1 = Math.max(0.05 * u, dist(BONE.BEARD, BONE.BEARD2));
    this.springs.push({ bone: BONE.BEARD, len: beard1, omega: 13, zeta: 0.55, hang: 0.12, limZ: 0.45, limX: 0.3 });
    this.springs.push({ bone: BONE.BEARD2, len: beard1, omega: 15, zeta: 0.5, hang: 0.15, limZ: 0.5, limX: 0.35 });
    const knee = r[BONE.SHIN_R * 3 + 1]!;
    if (rig.d.input.front === 'apron') {
      const L = Math.max(0.1 * u, r[BONE.APRON_F * 3 + 1]! - knee * 0.9);
      this.springs.push({ bone: BONE.APRON_F, len: L, omega: 9, zeta: 0.42, hang: 0.55, limZ: 0.8, limX: 0.25 });
    }
    if (rig.d.input.back === 'apron') {
      const L = Math.max(0.1 * u, (r[BONE.APRON_B * 3 + 1]! - knee) * 0.8);
      this.springs.push({ bone: BONE.APRON_B, len: L, omega: 9, zeta: 0.4, hang: 0.6, limZ: 0.8, limX: 0.25 });
    }
    if (rig.d.input.lamp.bone === BONE.LANTERN) {
      const L = Math.max(0.04 * u, r[BONE.LANTERN * 3 + 1]! - rig.d.input.lamp.offset[1]);
      this.springs.push({ bone: BONE.LANTERN, len: L, omega: Math.sqrt(9.81 / Math.max(0.05, L)), zeta: 0.14, hang: 0.9, limZ: 1.0, limX: 0.8 });
    }
    this.st = new Float64Array(this.springs.length * 9);
  }

  reset(): void {
    this.ready = false;
  }

  /**
   * Advance by dt and apply the offsets to the rig (rig.rot + refreshed matrices).
   * `placement` maps model -> world (scale, mirror, yaw); `pose` is the pose the rig solved.
   */
  step(placement: Float32Array, pose: PoseFrame, dt: number): void {
    const rig = this.rig;
    const W = rig.W;
    const st = this.st;
    const v = this.v;
    const steps = Math.max(1, Math.min(16, Math.ceil(dt / H - 1e-9)));
    const h = dt / steps;
    for (let i = 0; i < this.springs.length; i++) {
      const s = this.springs[i]!;
      const b = s.bone;
      if (pose.scale[b] === 0) continue;
      if (BONE_PARENT[b] === BONE.BEARD) rig.refresh(b, pose); // its parent just moved
      // pivot and rigid tip in model space, then world
      xformPoint(W, b * 16, 0, 0, 0, v, 0);
      xformPoint(W, b * 16, 0, -s.len, 0, v, 3);
      worldOf(placement, v, 0, v, 6);
      worldOf(placement, v, 3, v, 9);
      const scale = Math.hypot(placement[0]!, placement[1]!, placement[2]!);
      const L = s.len * scale;
      // target = rigid tip mixed with the hanging point
      const tx = v[9]! + (v[6]! - v[9]!) * s.hang;
      const ty = v[10]! + (v[7]! - L - v[10]!) * s.hang;
      const tz = v[11]! + (v[8]! - v[11]!) * s.hang;
      const o = i * 9;
      if (!this.ready || dt <= 0) {
        st[o] = tx;
        st[o + 1] = ty;
        st[o + 2] = tz;
        st[o + 3] = st[o + 4] = st[o + 5] = 0;
        st[o + 6] = tx;
        st[o + 7] = ty;
        st[o + 8] = tz;
      } else {
        const w2 = s.omega * s.omega;
        const c = 2 * s.zeta * s.omega;
        for (let k = 1; k <= steps; k++) {
          const f = k / steps;
          const gx = st[o + 6]! + (tx - st[o + 6]!) * f;
          const gy = st[o + 7]! + (ty - st[o + 7]!) * f;
          const gz = st[o + 8]! + (tz - st[o + 8]!) * f;
          st[o + 3] += (w2 * (gx - st[o]!) - c * st[o + 3]!) * h;
          st[o + 4] += (w2 * (gy - st[o + 1]!) - c * st[o + 4]!) * h;
          st[o + 5] += (w2 * (gz - st[o + 2]!) - c * st[o + 5]!) * h;
          st[o] += st[o + 3]! * h;
          st[o + 1] += st[o + 4]! * h;
          st[o + 2] += st[o + 5]! * h;
        }
        st[o + 6] = tx;
        st[o + 7] = ty;
        st[o + 8] = tz;
      }
      // direction pivot -> particle in the PARENT's local frame (inverse of placement * W[parent] via transpose)
      const dx = st[o]! - v[6]!;
      const dy = st[o + 1]! - v[7]!;
      const dz = st[o + 2]! - v[8]!;
      const p = BONE_PARENT[b]! * 16;
      // world dir -> model dir: Aᵀ d for A = placement 3x3 (orthogonal * scale, maybe mirrored)
      const mx = placement[0]! * dx + placement[1]! * dy + placement[2]! * dz;
      const my = placement[4]! * dx + placement[5]! * dy + placement[6]! * dz;
      const mz = placement[8]! * dx + placement[9]! * dy + placement[10]! * dz;
      const lx = W[p]! * mx + W[p + 1]! * my + W[p + 2]! * mz;
      const ly = W[p + 4]! * mx + W[p + 5]! * my + W[p + 6]! * mz;
      const lz = W[p + 8]! * mx + W[p + 9]! * my + W[p + 10]! * mz;
      // rigid local direction of the bone's -Y: R(rot)·(0,-1,0), from its local matrix = parentᵀ * W[b] column 1
      const q = b * 16;
      const ry = -(W[p]! * W[q + 4]! + W[p + 1]! * W[q + 5]! + W[p + 2]! * W[q + 6]!);
      const ryy = -(W[p + 4]! * W[q + 4]! + W[p + 5]! * W[q + 5]! + W[p + 6]! * W[q + 6]!);
      const ryz = -(W[p + 8]! * W[q + 4]! + W[p + 9]! * W[q + 5]! + W[p + 10]! * W[q + 6]!);
      let az = Math.atan2(lx, -ly) - Math.atan2(ry, -ryy);
      let ax = Math.atan2(-lz, -ly) - Math.atan2(-ryz, -ryy);
      if (az > Math.PI) az -= 2 * Math.PI;
      if (az < -Math.PI) az += 2 * Math.PI;
      if (ax > Math.PI) ax -= 2 * Math.PI;
      if (ax < -Math.PI) ax += 2 * Math.PI;
      az = az > s.limZ ? s.limZ : az < -s.limZ ? -s.limZ : az;
      ax = ax > s.limX ? s.limX : ax < -s.limX ? -s.limX : ax;
      rig.rot[b * 3] += ax;
      rig.rot[b * 3 + 2] += az;
      rig.refresh(b, pose);
    }
    // children of secondary bones (beard2 under beard) were refreshed in order; nothing else hangs below them
    this.ready = true;
  }
}

function worldOf(m: Float32Array, src: Float64Array, so: number, out: Float64Array, oo: number): void {
  const x = src[so]!;
  const y = src[so + 1]!;
  const z = src[so + 2]!;
  out[oo] = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!;
  out[oo + 1] = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!;
  out[oo + 2] = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!;
}
