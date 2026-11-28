/**
 * Technique `sdf` (d08 "Glina"): one smooth clay skin per body CHAIN from signed-distance primitives
 * blended with a smooth minimum, polygonised by surface nets (vertex = mean edge crossing, projected
 * onto the surface along the gradient; normal = gradient). Two-bone skin weights come from the
 * distance gap of the two nearest bones (a soft hinge at elbows, knees, ankles, wrists, neck–beard),
 * which keeps the volume in bent joints instead of the rigid-part interpenetration.
 *
 * Chains (rigid, intersecting each other like the primitives — no webbing when an arm swings past the
 * torso): core (pelvis, spine, chest), head (head, beard, beard2), each arm, each leg. Small details
 * (nose, brows, eyes, belt, cuffs, soles...) and all gear stay hard primitives like d01. LOD0 only;
 * LOD1 and LOD2 use the primitives (a 400-triangle clay skin is a blob — reported).
 */
import * as THREE from 'three';
import { BONE } from '../../../anim/types';
import type { LodLevel } from '../../types';
import type { Frame } from '../anatomy';
import { attrsOf } from '../build';
import type { MeshBuilder, VertexAttrs } from '../mesh';
import { partMatrix, type ModelPart } from '../part';
import { meshShape, type MeshOut, type TechniqueImpl } from './common';
import { PRIM_Q } from './primitives';

const CHAINS: readonly (readonly number[])[] = [
  [BONE.PELVIS, BONE.SPINE, BONE.CHEST],
  [BONE.HEAD, BONE.BEARD, BONE.BEARD2],
  [BONE.ARM_R, BONE.FORE_R, BONE.HAND_R],
  [BONE.ARM_L, BONE.FORE_L, BONE.HAND_L],
  [BONE.THIGH_R, BONE.SHIN_R, BONE.FOOT_R],
  [BONE.THIGH_L, BONE.SHIN_L, BONE.FOOT_L],
];

/** Grid cell (model units) per chain: finer for the head (face, beard), coarser for the trunk and limbs. */
const CELL = [0.06, 0.038, 0.044, 0.044, 0.047, 0.047];
/** Smooth-union radius per chain. */
const BLEND = [0.05, 0.03, 0.035, 0.035, 0.03, 0.03];
/** Width of the two-bone weight ramp (distance gap). */
const WEIGHT_RAMP = 0.06;

interface Prim {
  part: ModelPart;
  inv: THREE.Matrix4;
  /** Smallest scale of the part (distance correction for non-uniform scale). */
  sMin: number;
  attrs: VertexAttrs;
}

const _p = new THREE.Vector3();

function clamp(x: number, a: number, b: number): number {
  return x < a ? a : x > b ? b : x;
}

/** Combine a radial (side) and an axial (cap) distance into a capped-solid SDF. */
function capped(dSide: number, dCap: number): number {
  const ox = Math.max(dSide, 0);
  const oy = Math.max(dCap, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(dSide, dCap), 0);
}

function roundBox(x: number, y: number, z: number, hx: number, hy: number, hz: number, rb: number): number {
  const qx = Math.abs(x) - hx + rb;
  const qy = Math.abs(y) - hy + rb;
  const qz = Math.abs(z) - hz + rb;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - rb;
}

/** Signed distance of a shape in its own frame. */
export function shapeSdf(p: ModelPart, x: number, y: number, z: number): number {
  const sh = p.shape;
  switch (sh.k) {
    case 'ellipsoid': {
      const k0 = Math.hypot(x / sh.rx, y / sh.ry, z / sh.rz);
      const k1 = Math.hypot(x / (sh.rx * sh.rx), y / (sh.ry * sh.ry), z / (sh.rz * sh.rz));
      return k1 < 1e-9 ? -Math.min(sh.rx, sh.ry, sh.rz) : (k0 * (k0 - 1)) / k1;
    }
    case 'dome': {
      const k0 = Math.hypot(x / sh.r, y / sh.ry, z / sh.r);
      const k1 = Math.hypot(x / (sh.r * sh.r), y / (sh.ry * sh.ry), z / (sh.r * sh.r));
      return Math.max(k1 < 1e-9 ? -Math.min(sh.r, sh.ry) : (k0 * (k0 - 1)) / k1, -y);
    }
    case 'capsule': {
      const a = Math.max(0, sh.len / 2 - sh.r);
      return Math.hypot(x, y - clamp(y, -a, a), z) - sh.r;
    }
    case 'frustum': {
      const t = clamp((y + sh.h / 2) / sh.h, 0, 1);
      const r = sh.r0 + (sh.r1 - sh.r0) * t;
      const slope = Math.cos(Math.atan2(Math.abs(sh.r1 - sh.r0), sh.h));
      return capped((Math.hypot(x, z) - r) * slope, Math.abs(y) - sh.h / 2);
    }
    case 'lathe': {
      const pr = sh.profile;
      const y0 = pr[0]![1];
      const y1 = pr[pr.length - 1]![1];
      const yy = clamp(y, y0, y1);
      let r = pr[0]![0];
      for (let i = 0; i < pr.length - 1; i++) {
        const a = pr[i]!, b = pr[i + 1]!;
        if (yy >= a[1] && yy <= b[1]) {
          r = a[0] + ((b[0] - a[0]) * (yy - a[1])) / Math.max(1e-9, b[1] - a[1]);
          break;
        }
      }
      return capped(Math.hypot(x, z) - r, Math.max(y0 - y, y - y1));
    }
    case 'box':
      return roundBox(x, y, z, sh.d / 2, sh.h / 2, sh.w / 2, Math.min(0.025, 0.3 * Math.min(sh.d, sh.h, sh.w)));
    case 'wedge': {
      const t = clamp((y + sh.h) / sh.h, 0, 1); // 0 bottom .. 1 top
      const hz = (sh.w1 + (sh.w0 - sh.w1) * t) / 2;
      return roundBox(x, y + sh.h / 2, z, sh.d / 2, sh.h / 2, hz, Math.min(0.03, 0.3 * sh.d));
    }
    case 'outline':
      return roundBox(x, y, z, 0.05, 0.05, sh.d / 2, 0.01);
  }
}

function primOf(p: ModelPart): Prim {
  const m = partMatrix(p);
  const s = p.s ?? [1, 1, 1];
  return { part: p, inv: m.clone().invert(), sMin: Math.min(s[0], s[1], s[2]), attrs: attrsOf(p) };
}

function primDist(q: Prim, x: number, y: number, z: number): number {
  _p.set(x, y, z).applyMatrix4(q.inv);
  return shapeSdf(q.part, _p.x, _p.y, _p.z) * q.sMin;
}

/** Polynomial smooth minimum. */
function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

function field(prims: readonly Prim[], k: number, x: number, y: number, z: number): number {
  let d = Infinity;
  for (const q of prims) {
    const v = primDist(q, x, y, z);
    d = d === Infinity ? v : smin(d, v, k);
  }
  return d;
}

/** Bounds of a set of parts (rest model space) from their meshed shapes. */
function bounds(prims: readonly Prim[]): [number, number, number, number, number, number] {
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity] as [number, number, number, number, number, number];
  const v = new THREE.Vector3();
  for (const q of prims) {
    const raw = meshShape(q.part, PRIM_Q[0]!);
    const m = partMatrix(q.part);
    for (let i = 0; i < raw.p.length; i += 3) {
      v.set(raw.p[i]!, raw.p[i + 1]!, raw.p[i + 2]!).applyMatrix4(m);
      b[0] = Math.min(b[0], v.x);
      b[1] = Math.min(b[1], v.y);
      b[2] = Math.min(b[2], v.z);
      b[3] = Math.max(b[3], v.x);
      b[4] = Math.max(b[4], v.y);
      b[5] = Math.max(b[5], v.z);
    }
  }
  return b;
}

/** Surface nets of one chain into the builder. Returns the number of triangles added. */
export function polygonizeChain(prims: readonly Prim[], h: number, k: number, b: MeshBuilder): number {
  if (!prims.length) return 0;
  const bb = bounds(prims);
  const pad = 2 * h + k;
  const ox = bb[0] - pad, oy = bb[1] - pad, oz = bb[2] - pad;
  const nx = Math.ceil((bb[3] - bb[0] + 2 * pad) / h) + 1;
  const ny = Math.ceil((bb[4] - bb[1] + 2 * pad) / h) + 1;
  const nz = Math.ceil((bb[5] - bb[2] + 2 * pad) / h) + 1;
  const F = new Float32Array(nx * ny * nz);
  const gi = (i: number, j: number, l: number) => (l * ny + j) * nx + i;
  for (let l = 0; l < nz; l++)
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) F[gi(i, j, l)] = field(prims, k, ox + i * h, oy + j * h, oz + l * h);
  const cx = nx - 1, cy = ny - 1, cz = nz - 1;
  const ci = (i: number, j: number, l: number) => (l * cy + j) * cx + i;
  const cellV = new Int32Array(cx * cy * cz).fill(-1);
  const vp: number[] = [];
  const corner = [
    [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
    [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],
  ] as const;
  const edges = [
    [0, 1], [2, 3], [4, 5], [6, 7],
    [0, 2], [1, 3], [4, 6], [5, 7],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ] as const;
  const fval = new Float64Array(8);
  const grad = (x: number, y: number, z: number, e: number): [number, number, number] => [
    field(prims, k, x + e, y, z) - field(prims, k, x - e, y, z),
    field(prims, k, x, y + e, z) - field(prims, k, x, y - e, z),
    field(prims, k, x, y, z + e) - field(prims, k, x, y, z - e),
  ];
  for (let l = 0; l < cz; l++)
    for (let j = 0; j < cy; j++)
      for (let i = 0; i < cx; i++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          const [a, bb2, cc] = corner[c]!;
          const v = F[gi(i + a, j + bb2, l + cc)]!;
          fval[c] = v;
          if (v < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (const [e0, e1] of edges) {
          const v0 = fval[e0]!, v1 = fval[e1]!;
          if (v0 < 0 === v1 < 0) continue;
          const t = v0 / (v0 - v1);
          const c0 = corner[e0]!, c1 = corner[e1]!;
          sx += c0[0] + (c1[0] - c0[0]) * t;
          sy += c0[1] + (c1[1] - c0[1]) * t;
          sz += c0[2] + (c1[2] - c0[2]) * t;
          n++;
        }
        let x = ox + (i + sx / n) * h;
        let y = oy + (j + sy / n) * h;
        let z = oz + (l + sz / n) * h;
        // project onto the surface (2 Newton steps along the gradient), clamped to the cell
        for (let it = 0; it < 2; it++) {
          const d = field(prims, k, x, y, z);
          const g = grad(x, y, z, h * 0.25);
          const gl = g[0] * g[0] + g[1] * g[1] + g[2] * g[2];
          if (gl < 1e-12) break;
          const s = (d * (2 * h * 0.25)) / gl;
          x = clamp(x - g[0] * s, ox + i * h, ox + (i + 1) * h);
          y = clamp(y - g[1] * s, oy + j * h, oy + (j + 1) * h);
          z = clamp(z - g[2] * s, oz + l * h, oz + (l + 1) * h);
        }
        cellV[ci(i, j, l)] = vp.length / 3;
        vp.push(x, y, z);
      }
  // per surface vertex: normal, two nearest bones and the weight
  const nv = vp.length / 3;
  const vn = new Float32Array(nv * 3);
  const vb = new Int32Array(nv * 2);
  const vw = new Float32Array(nv);
  for (let v = 0; v < nv; v++) {
    const x = vp[v * 3]!, y = vp[v * 3 + 1]!, z = vp[v * 3 + 2]!;
    const g = grad(x, y, z, h * 0.25);
    const gl = Math.hypot(g[0], g[1], g[2]) || 1;
    vn[v * 3] = g[0] / gl;
    vn[v * 3 + 1] = g[1] / gl;
    vn[v * 3 + 2] = g[2] / gl;
    let b1 = -1, d1 = Infinity, b2 = -1, d2 = Infinity;
    const best = new Map<number, number>();
    for (const q of prims) {
      const d = primDist(q, x, y, z);
      const bo = q.part.bone;
      if (d < (best.get(bo) ?? Infinity)) best.set(bo, d);
    }
    for (const [bo, d] of best) {
      if (d < d1) {
        b2 = b1;
        d2 = d1;
        b1 = bo;
        d1 = d;
      } else if (d < d2) {
        b2 = bo;
        d2 = d;
      }
    }
    const w = b2 < 0 ? 1 : 0.5 + 0.5 * clamp((d2 - d1) / WEIGHT_RAMP, 0, 1);
    vb[v * 2] = b1;
    vb[v * 2 + 1] = w >= 0.999 ? b1 : b2;
    vw[v] = w >= 0.999 ? 1 : w;
  }
  // faces: one quad per sign-changing grid edge; slot from the nearest primitive at the face centre
  const emitted = new Map<string, number>();
  const outIdx = (v: number, q: Prim): number => {
    const key = `${v}|${q.attrs.slot}|${q.part.color ?? 0}`;
    let id = emitted.get(key);
    if (id === undefined) {
      id = b.addVertex(vp[v * 3]!, vp[v * 3 + 1]!, vp[v * 3 + 2]!, vn[v * 3]!, vn[v * 3 + 1]!, vn[v * 3 + 2]!, {
        ...q.attrs,
        bone: vb[v * 2]!,
        bone2: vb[v * 2 + 1]!,
        weight: vw[v]!,
      });
      emitted.set(key, id);
    }
    return id;
  };
  let tris = 0;
  const nearest = (x: number, y: number, z: number): Prim => {
    let best = prims[0]!;
    let bd = Infinity;
    for (const q of prims) {
      const d = primDist(q, x, y, z);
      if (d < bd) {
        bd = d;
        best = q;
      }
    }
    return best;
  };
  const quad = (a: number, b2: number, c: number, d: number, dir: [number, number, number]) => {
    if (a < 0 || b2 < 0 || c < 0 || d < 0) return;
    const V = (v: number) => [vp[v * 3]!, vp[v * 3 + 1]!, vp[v * 3 + 2]!] as const;
    const P = [V(a), V(b2), V(c), V(d)];
    // shorter diagonal split
    const d02 = Math.hypot(P[0]![0] - P[2]![0], P[0]![1] - P[2]![1], P[0]![2] - P[2]![2]);
    const d13 = Math.hypot(P[1]![0] - P[3]![0], P[1]![1] - P[3]![1], P[1]![2] - P[3]![2]);
    const tri = d02 <= d13 ? [[a, b2, c], [a, c, d]] : [[a, b2, d], [b2, c, d]];
    for (const t of tri) {
      const A = V(t[0]!), B = V(t[1]!), C = V(t[2]!);
      const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
      const wx = C[0] - A[0], wy = C[1] - A[1], wz = C[2] - A[2];
      const fx = uy * wz - uz * wy, fy = uz * wx - ux * wz, fz = ux * wy - uy * wx;
      const flip = fx * dir[0] + fy * dir[1] + fz * dir[2] < 0;
      const q = nearest((A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3, (A[2] + B[2] + C[2]) / 3);
      const i0 = outIdx(t[0]!, q), i1 = outIdx(t[1]!, q), i2 = outIdx(t[2]!, q);
      if (flip) b.index.push(i0, i2, i1);
      else b.index.push(i0, i1, i2);
      tris++;
    }
  };
  for (let l = 1; l < nz - 1; l++)
    for (let j = 1; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        // edge along X: (i,j,l) -> (i+1,j,l)
        const v0 = F[gi(i, j, l)]!, v1 = F[gi(i + 1, j, l)]!;
        if (v0 < 0 !== v1 < 0)
          quad(cellV[ci(i, j - 1, l - 1)]!, cellV[ci(i, j, l - 1)]!, cellV[ci(i, j, l)]!, cellV[ci(i, j - 1, l)]!, [v0 < 0 ? 1 : -1, 0, 0]);
      }
  for (let l = 1; l < nz - 1; l++)
    for (let j = 0; j < ny - 1; j++)
      for (let i = 1; i < nx - 1; i++) {
        const v0 = F[gi(i, j, l)]!, v1 = F[gi(i, j + 1, l)]!;
        if (v0 < 0 !== v1 < 0)
          quad(cellV[ci(i - 1, j, l - 1)]!, cellV[ci(i, j, l - 1)]!, cellV[ci(i, j, l)]!, cellV[ci(i - 1, j, l)]!, [0, v0 < 0 ? 1 : -1, 0]);
      }
  for (let l = 0; l < nz - 1; l++)
    for (let j = 1; j < ny - 1; j++)
      for (let i = 1; i < nx - 1; i++) {
        const v0 = F[gi(i, j, l)]!, v1 = F[gi(i, j, l + 1)]!;
        if (v0 < 0 !== v1 < 0)
          quad(cellV[ci(i - 1, j - 1, l)]!, cellV[ci(i, j - 1, l)]!, cellV[ci(i, j, l)]!, cellV[ci(i - 1, j, l)]!, [0, 0, v0 < 0 ? 1 : -1]);
      }
  return tris;
}

export function sdfTechnique(): TechniqueImpl {
  return {
    technique: 'sdf',
    mode: 'welded',
    mesh(part: ModelPart, lod: LodLevel): MeshOut {
      return { raw: meshShape(part, PRIM_Q[lod]!), space: 'local' };
    },
    skin: {
      lods: [0],
      build(parts: ModelPart[], _lod: LodLevel, _f: Frame, b: MeshBuilder) {
        CHAINS.forEach((bones, c) => {
          const prims = parts.filter((p) => bones.includes(p.bone)).map(primOf);
          polygonizeChain(prims, CELL[c]!, BLEND[c]!, b);
        });
      },
    },
  };
}
