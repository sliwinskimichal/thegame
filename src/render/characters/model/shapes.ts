/**
 * Raw triangle-mesh generators for the dwarf parts (owner: W1). Every generator returns an indexed
 * `Raw` mesh in the shape's own frame (PartShape conventions in characters/types.ts) with outward
 * counter-clockwise winding. Techniques combine these with modifiers (flat shading, jitter) and
 * 2D profile tools (convex hull, decimation, inset, extrusion with bevel).
 */
import * as THREE from 'three';
import { hash3f } from '../../../core/rng';

export interface Raw {
  p: number[];
  n: number[];
  i: number[];
}

export const newRaw = (): Raw => ({ p: [], n: [], i: [] });

export function vert(m: Raw, x: number, y: number, z: number, nx: number, ny: number, nz: number): number {
  const l = Math.hypot(nx, ny, nz) || 1;
  m.p.push(x, y, z);
  m.n.push(nx / l, ny / l, nz / l);
  return m.p.length / 3 - 1;
}

/** Triangle with the winding fixed so the face normal agrees with the vertex normals (outward). */
export function tri(m: Raw, a: number, b: number, c: number): void {
  const p = m.p;
  const ax = p[a * 3]!, ay = p[a * 3 + 1]!, az = p[a * 3 + 2]!;
  const ux = p[b * 3]! - ax, uy = p[b * 3 + 1]! - ay, uz = p[b * 3 + 2]! - az;
  const vx = p[c * 3]! - ax, vy = p[c * 3 + 1]! - ay, vz = p[c * 3 + 2]! - az;
  const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
  const n = m.n;
  const sx = n[a * 3]! + n[b * 3]! + n[c * 3]!;
  const sy = n[a * 3 + 1]! + n[b * 3 + 1]! + n[c * 3 + 1]!;
  const sz = n[a * 3 + 2]! + n[b * 3 + 2]! + n[c * 3 + 2]!;
  if (fx * sx + fy * sy + fz * sz < 0) m.i.push(a, c, b);
  else m.i.push(a, b, c);
}

export function quad(m: Raw, a: number, b: number, c: number, d: number): void {
  tri(m, a, b, c);
  tri(m, a, c, d);
}

export function merge(into: Raw, m: Raw): Raw {
  const o = into.p.length / 3;
  for (const v of m.p) into.p.push(v);
  for (const v of m.n) into.n.push(v);
  for (const i of m.i) into.i.push(i + o);
  return into;
}

export const triCount = (m: Raw): number => m.i.length / 3;

// ------------------------------------------------------------------------------------------------ round shapes
/** UV ellipsoid: seg around Y, rings latitude bands (seg 4 + rings 2 = octahedron, 8 triangles). */
export function ellipsoid(rx: number, ry: number, rz: number, seg: number, rings: number, phase = 0): Raw {
  const m = newRaw();
  rings = Math.max(2, rings);
  const top = vert(m, 0, ry, 0, 0, 1, 0);
  const ring: number[][] = [];
  for (let k = 1; k < rings; k++) {
    const th = (Math.PI * k) / rings;
    const row: number[] = [];
    for (let j = 0; j < seg; j++) {
      const ph = (2 * Math.PI * j) / seg + phase;
      const x = rx * Math.sin(th) * Math.cos(ph);
      const y = ry * Math.cos(th);
      const z = rz * Math.sin(th) * Math.sin(ph);
      row.push(vert(m, x, y, z, x / (rx * rx), y / (ry * ry), z / (rz * rz)));
    }
    ring.push(row);
  }
  const bot = vert(m, 0, -ry, 0, 0, -1, 0);
  for (let j = 0; j < seg; j++) {
    const j1 = (j + 1) % seg;
    tri(m, top, ring[0]![j]!, ring[0]![j1]!);
    for (let k = 0; k < ring.length - 1; k++) quad(m, ring[k]![j]!, ring[k + 1]![j]!, ring[k + 1]![j1]!, ring[k]![j1]!);
    tri(m, bot, ring[ring.length - 1]![j1]!, ring[ring.length - 1]![j]!);
  }
  return m;
}

/** Upper half ellipsoid (base at y = 0), optional flat base. rings >= 1 bands below the apex. */
export function dome(r: number, ry: number, seg: number, rings: number, base = true, phase = 0): Raw {
  const m = newRaw();
  rings = Math.max(1, rings);
  const ring: number[][] = [];
  for (let k = 0; k < rings; k++) {
    const th = (Math.PI / 2) * (1 - k / rings);
    const row: number[] = [];
    for (let j = 0; j < seg; j++) {
      const ph = (2 * Math.PI * j) / seg + phase;
      const x = r * Math.sin(th) * Math.cos(ph);
      const y = ry * Math.cos(th);
      const z = r * Math.sin(th) * Math.sin(ph);
      row.push(vert(m, x, y, z, x / (r * r), y / (ry * ry), z / (r * r)));
    }
    ring.push(row);
  }
  const apex = vert(m, 0, ry, 0, 0, 1, 0);
  for (let j = 0; j < seg; j++) {
    const j1 = (j + 1) % seg;
    for (let k = 0; k < ring.length - 1; k++) quad(m, ring[k]![j]!, ring[k]![j1]!, ring[k + 1]![j1]!, ring[k + 1]![j]!);
    tri(m, apex, ring[ring.length - 1]![j1]!, ring[ring.length - 1]![j]!);
  }
  if (base) disc(m, r, r, 0, -1, seg, phase);
  return m;
}

/** Flat polygonal disc (fan) at height y facing ny = ±1. */
function disc(m: Raw, rx: number, rz: number, y: number, ny: number, seg: number, phase: number): void {
  if (seg < 3) return;
  const idx: number[] = [];
  for (let j = 0; j < seg; j++) {
    const ph = (2 * Math.PI * j) / seg + phase;
    idx.push(vert(m, rx * Math.cos(ph), y, rz * Math.sin(ph), 0, ny, 0));
  }
  for (let j = 1; j < seg - 1; j++) tri(m, idx[0]!, idx[j]!, idx[j + 1]!);
}

/**
 * Surface of revolution around Y from a profile of [radius, y] points (bottom to top). A radius of 0
 * at an end makes a pole; otherwise `cap` closes the ends (bit 0 bottom, bit 1 top). Smooth normals,
 * except at creases sharper than `creaseDeg` (the ring is split).
 */
export function lathe(
  profile: readonly (readonly [number, number])[],
  seg: number,
  cap = 3,
  creaseDeg = 50,
  phase = 0,
  normals?: readonly (readonly [number, number])[],
): Raw {
  const m = newRaw();
  const n = profile.length;
  // per-segment 2D outward normals of the profile (radius = x, y)
  const segN: [number, number][] = [];
  for (let k = 0; k < n - 1; k++) {
    const [r0, y0] = profile[k]!;
    const [r1, y1] = profile[k + 1]!;
    const dx = r1 - r0, dy = y1 - y0;
    const l = Math.hypot(dx, dy) || 1;
    segN.push([dy / l, -dx / l]);
  }
  const cosCrease = Math.cos((creaseDeg * Math.PI) / 180);
  // each profile point gets one or two rings (below / above normals)
  const rings: { idx: number[]; pole: boolean }[][] = [];
  for (let k = 0; k < n; k++) {
    const [r, y] = profile[k]!;
    const nb = k > 0 ? segN[k - 1]! : null;
    const na = k < n - 1 ? segN[k]! : null;
    const variants: [number, number][] = [];
    if (normals) variants.push(normals[k] as [number, number]);
    else if (nb && na) {
      const dot = nb[0] * na[0] + nb[1] * na[1];
      if (dot < cosCrease) variants.push(nb, na);
      else variants.push([nb[0] + na[0], nb[1] + na[1]]);
    } else variants.push((nb ?? na)!);
    const out: { idx: number[]; pole: boolean }[] = [];
    for (const [nr, ny] of variants) {
      if (r <= 1e-6) {
        out.push({ idx: [vert(m, 0, y, 0, 0, ny >= 0 ? 1 : -1, 0)], pole: true });
        continue;
      }
      const idx: number[] = [];
      for (let j = 0; j < seg; j++) {
        const ph = (2 * Math.PI * j) / seg + phase;
        const c = Math.cos(ph), s = Math.sin(ph);
        idx.push(vert(m, r * c, y, r * s, nr * c, ny, nr * s));
      }
      out.push({ idx, pole: false });
    }
    rings.push(out);
  }
  for (let k = 0; k < n - 1; k++) {
    const a = rings[k]![rings[k]!.length - 1]!;
    const b = rings[k + 1]![0]!;
    for (let j = 0; j < seg; j++) {
      const j1 = (j + 1) % seg;
      if (a.pole && b.pole) continue;
      if (a.pole) tri(m, a.idx[0]!, b.idx[j1]!, b.idx[j]!);
      else if (b.pole) tri(m, b.idx[0]!, a.idx[j]!, a.idx[j1]!);
      else quad(m, a.idx[j]!, a.idx[j1]!, b.idx[j1]!, b.idx[j]!);
    }
  }
  const [rb, yb] = profile[0]!;
  const [rt, yt] = profile[n - 1]!;
  if (cap & 1 && rb > 1e-6) disc(m, rb, rb, yb, -1, seg, phase);
  if (cap & 2 && rt > 1e-6) disc(m, rt, rt, yt, 1, seg, phase);
  return m;
}

/** Frustum along Y, centred: r0 at -h/2, r1 at +h/2 (a zero radius makes a cone apex). */
export function frustum(r0: number, r1: number, h: number, seg: number, cap = 3, phase = 0): Raw {
  return lathe(
    [
      [r0, -h / 2],
      [r1, h / 2],
    ],
    seg,
    cap,
    50,
    phase,
  );
}

/** Capsule along Y, centred; `len` is the full tip-to-tip length (straight part = len - 2r). */
export function capsule(r: number, len: number, seg: number, capRings: number, cap = 3): Raw {
  const a = Math.max(0, len / 2 - r);
  const prof: [number, number][] = [];
  const nrm: [number, number][] = [];
  const rings = Math.max(1, capRings);
  const push = (p: [number, number], nn: [number, number]) => {
    const last = prof[prof.length - 1];
    if (last && Math.abs(last[0] - p[0]) < 1e-7 && Math.abs(last[1] - p[1]) < 1e-7) return;
    prof.push(p);
    nrm.push(nn);
  };
  if (cap & 1)
    for (let k = 0; k < rings; k++) {
      const t = -Math.PI / 2 + (Math.PI / 2) * (k / rings);
      push([r * Math.cos(t), -a + r * Math.sin(t)], [Math.cos(t), Math.sin(t)]);
    }
  else push([r, -len / 2], [1, 0]);
  push([r, -a], [1, 0]);
  push([r, a], [1, 0]);
  if (cap & 2)
    for (let k = 1; k <= rings; k++) {
      const t = (Math.PI / 2) * (k / rings);
      push([r * Math.cos(t), a + r * Math.sin(t)], [Math.cos(t), Math.sin(t)]);
    }
  else push([r, len / 2], [1, 0]);
  return lathe(prof, seg, 0, 50, 0, nrm);
}

// ------------------------------------------------------------------------------------------------ polyhedra
/** Corner order of a hexahedron: bit 0 = +X, bit 1 = +Y, bit 2 = +Z. */
export const HEX_FACES: readonly (readonly [number, number, number, number])[] = [
  [0, 2, 6, 4], // -X
  [1, 3, 7, 5], // +X
  [0, 1, 5, 4], // -Y
  [2, 3, 7, 6], // +Y
  [0, 1, 3, 2], // -Z
  [4, 5, 7, 6], // +Z
];

type V3 = readonly [number, number, number];

function faceNormal(a: V3, b: V3, c: V3, centre: V3): [number, number, number] {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const ox = a[0] - centre[0], oy = a[1] - centre[1], oz = a[2] - centre[2];
  if (nx * ox + ny * oy + nz * oz < 0) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }
  return [nx, ny, nz];
}

function centroid(pts: readonly V3[]): [number, number, number] {
  const c: [number, number, number] = [0, 0, 0];
  for (const p of pts) {
    c[0] += p[0] / pts.length;
    c[1] += p[1] / pts.length;
    c[2] += p[2] / pts.length;
  }
  return c;
}

/** Convex hexahedron from 8 corners (flat faces, 12 triangles). */
export function hexahedron(c: readonly V3[]): Raw {
  const m = newRaw();
  const ce = centroid(c);
  for (const f of HEX_FACES) {
    const [a, b, d, e] = f.map((i) => c[i]!) as [V3, V3, V3, V3];
    const nn = faceNormal(a, b, d, ce);
    const ids = [a, b, d, e].map((p) => vert(m, p[0], p[1], p[2], nn[0], nn[1], nn[2]));
    quad(m, ids[0]!, ids[1]!, ids[2]!, ids[3]!);
  }
  return m;
}

/** Box: X = d (depth), Y = h, Z = w (width), centred. */
export function boxCorners(w: number, h: number, d: number): V3[] {
  const out: V3[] = [];
  for (let i = 0; i < 8; i++) out.push([i & 1 ? d / 2 : -d / 2, i & 2 ? h / 2 : -h / 2, i & 4 ? w / 2 : -w / 2]);
  return out;
}

/** Wedge: width w0 at the top (y = 0) to w1 at the bottom (y = -h) along Z, depth d along X. */
export function wedgeCorners(w0: number, w1: number, h: number, d: number): V3[] {
  const out: V3[] = [];
  for (let i = 0; i < 8; i++) {
    const top = (i & 2) !== 0;
    const w = top ? w0 : w1;
    out.push([i & 1 ? d / 2 : -d / 2, top ? 0 : -h, i & 4 ? w / 2 : -w / 2]);
  }
  return out;
}

/**
 * Edge-chamfered convex hexahedron (carved wood): 6 inset faces, 12 bevel strips, 8 corner triangles
 * (44 triangles, flat). `c` is the chamfer width along each face.
 */
export function chamferedHexahedron(c: readonly V3[], ch: number): Raw {
  const m = newRaw();
  const ce = centroid(c);
  // inset point of corner v inside face f
  const inset = new Map<string, [number, number, number]>();
  const key = (f: number, v: number) => `${f}:${v}`;
  HEX_FACES.forEach((f, fi) => {
    for (let k = 0; k < 4; k++) {
      const v = c[f[k]!]!;
      const prev = c[f[(k + 3) % 4]!]!;
      const next = c[f[(k + 1) % 4]!]!;
      const d1 = [prev[0] - v[0], prev[1] - v[1], prev[2] - v[2]];
      const d2 = [next[0] - v[0], next[1] - v[1], next[2] - v[2]];
      const l1 = Math.hypot(d1[0]!, d1[1]!, d1[2]!) || 1;
      const l2 = Math.hypot(d2[0]!, d2[1]!, d2[2]!) || 1;
      const a1 = Math.min(ch, l1 * 0.45) / l1;
      const a2 = Math.min(ch, l2 * 0.45) / l2;
      inset.set(key(fi, f[k]!), [v[0] + d1[0]! * a1 + d2[0]! * a2, v[1] + d1[1]! * a1 + d2[1]! * a2, v[2] + d1[2]! * a1 + d2[2]! * a2]);
    }
  });
  const emit = (pts: V3[]) => {
    const nn = faceNormal(pts[0]!, pts[1]!, pts[2]!, ce);
    const ids = pts.map((p) => vert(m, p[0], p[1], p[2], nn[0], nn[1], nn[2]));
    for (let k = 1; k < ids.length - 1; k++) tri(m, ids[0]!, ids[k]!, ids[k + 1]!);
  };
  // faces
  HEX_FACES.forEach((f, fi) => emit(f.map((v) => inset.get(key(fi, v))!)));
  // edges: shared by two faces
  const faceOf = (v: number) => HEX_FACES.map((f, fi) => (f.includes(v) ? fi : -1)).filter((x) => x >= 0);
  const done = new Set<string>();
  HEX_FACES.forEach((f, fi) => {
    for (let k = 0; k < 4; k++) {
      const u = f[k]!;
      const v = f[(k + 1) % 4]!;
      const ek = u < v ? `${u}-${v}` : `${v}-${u}`;
      if (done.has(ek)) continue;
      done.add(ek);
      const gi = HEX_FACES.findIndex((g, i) => i !== fi && g.includes(u) && g.includes(v));
      emit([inset.get(key(fi, u))!, inset.get(key(fi, v))!, inset.get(key(gi, v))!, inset.get(key(gi, u))!]);
    }
  });
  // corners
  for (let v = 0; v < 8; v++) {
    const fs = faceOf(v);
    emit(fs.map((fi) => inset.get(key(fi, v))!));
  }
  return m;
}

// ------------------------------------------------------------------------------------------------ 2D profiles
export type P2 = [number, number];

export function polyArea(pts: readonly P2[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

export function ccw(pts: readonly P2[]): P2[] {
  const out = pts.map((p) => [p[0], p[1]] as P2);
  return polyArea(out) < 0 ? out.reverse() : out;
}

/** Andrew's monotone chain (CCW, no collinear points). */
export function convexHull2(points: readonly P2[]): P2[] {
  const pts = points.map((p) => [p[0], p[1]] as P2).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o: P2, a: P2, b: P2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: P2[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 1e-12) lower.pop();
    lower.push(p);
  }
  const upper: P2[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 1e-12) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/** Visvalingam–Whyatt: drop the vertex with the smallest triangle area until `n` remain. */
export function decimate(poly: readonly P2[], n: number): P2[] {
  const out = poly.map((p) => [p[0], p[1]] as P2);
  while (out.length > Math.max(3, n)) {
    let best = 0;
    let bestA = Infinity;
    for (let i = 0; i < out.length; i++) {
      const a = out[(i + out.length - 1) % out.length]!;
      const b = out[i]!;
      const c = out[(i + 1) % out.length]!;
      const ar = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
      if (ar < bestA - 1e-12) {
        bestA = ar;
        best = i;
      }
    }
    out.splice(best, 1);
  }
  return out;
}

export function perimeter(poly: readonly P2[]): number {
  let l = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    l += Math.hypot(q[0] - p[0], q[1] - p[1]);
  }
  return l;
}

/** Offset a CCW polygon inward by d (mitred, miter clamped). */
export function inset(poly: readonly P2[], d: number): P2[] {
  const n = poly.length;
  const out: P2[] = [];
  for (let i = 0; i < n; i++) {
    const a = poly[(i + n - 1) % n]!;
    const b = poly[i]!;
    const c = poly[(i + 1) % n]!;
    const e1 = [b[0] - a[0], b[1] - a[1]];
    const e2 = [c[0] - b[0], c[1] - b[1]];
    const l1 = Math.hypot(e1[0]!, e1[1]!) || 1;
    const l2 = Math.hypot(e2[0]!, e2[1]!) || 1;
    // inward normals of a CCW polygon: rotate edge by +90°
    const n1 = [-e1[1]! / l1, e1[0]! / l1];
    const n2 = [-e2[1]! / l2, e2[0]! / l2];
    let bx = n1[0]! + n2[0]!;
    let by = n1[1]! + n2[1]!;
    const bl = Math.hypot(bx, by) || 1;
    bx /= bl;
    by /= bl;
    const cosHalf = Math.max(0.4, bx * n1[0]! + by * n1[1]!);
    out.push([b[0] + (bx * d) / cosHalf, b[1] + (by * d) / cosHalf]);
  }
  return out;
}

function triangulate(poly: readonly P2[]): number[][] {
  const contour = poly.map((p) => new THREE.Vector2(p[0], p[1]));
  return THREE.ShapeUtils.triangulateShape(contour, []);
}

/**
 * Extrude a polygon in XY along Z, centred on z = 0, total depth d, with optional rounded bevels
 * (front = +Z, back = -Z): `bf`/`bb` bevel radius, `sf`/`sb` arc steps (0 = sharp edge).
 * Side walls are smooth across corners flatter than `creaseDeg`.
 */
export function extrude(
  polyIn: readonly P2[],
  d: number,
  opts: { bf?: number; sf?: number; bb?: number; sb?: number; creaseDeg?: number; frontCap?: boolean; backCap?: boolean } = {},
): Raw {
  const poly = ccw(polyIn);
  const n = poly.length;
  const m = newRaw();
  const bf = opts.sf ? Math.min(opts.bf ?? 0, d * 0.45) : 0;
  const bb = opts.sb ? Math.min(opts.bb ?? 0, d * 0.45) : 0;
  const sf = bf > 0 ? opts.sf! : 0;
  const sb = bb > 0 ? opts.sb! : 0;
  // rings from the front cap edge to the back cap edge: [insetDist, z, nIn (normal weight in-plane), nz]
  const rings: [number, number, number, number][] = [];
  for (let k = 0; k <= sf; k++) {
    const th = sf ? (k / sf) * (Math.PI / 2) : Math.PI / 2;
    rings.push([bf * (1 - Math.sin(th)), d / 2 - bf * (1 - Math.cos(th)), Math.sin(th), Math.cos(th)]);
  }
  for (let k = sb; k >= 0; k--) {
    const th = sb ? (k / sb) * (Math.PI / 2) : Math.PI / 2;
    rings.push([bb * (1 - Math.sin(th)), -d / 2 + bb * (1 - Math.cos(th)), Math.sin(th), -Math.cos(th)]);
  }
  // in-plane outward normals per vertex (smooth or split at creases)
  const edgeN: P2[] = [];
  for (let i = 0; i < n; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % n]!;
    const ex = b[0] - a[0], ey = b[1] - a[1];
    const l = Math.hypot(ex, ey) || 1;
    edgeN.push([ey / l, -ex / l]);
  }
  const cosCrease = Math.cos(((opts.creaseDeg ?? 35) * Math.PI) / 180);
  const insets = new Map<number, P2[]>();
  const ins = (dist: number) => {
    if (!insets.has(dist)) insets.set(dist, dist > 1e-6 ? inset(poly, dist) : poly);
    return insets.get(dist)!;
  };
  // for each polygon vertex: the normal(s) used by the wall before / after it
  const vN: [P2, P2][] = [];
  for (let i = 0; i < n; i++) {
    const nb = edgeN[(i + n - 1) % n]!;
    const na = edgeN[i]!;
    const dot = nb[0] * na[0] + nb[1] * na[1];
    if (dot < cosCrease) vN.push([nb, na]);
    else {
      const s: P2 = [nb[0] + na[0], nb[1] + na[1]];
      vN.push([s, s]);
    }
  }
  // wall quads per edge and ring band (vertices duplicated per edge to allow creases)
  for (let i = 0; i < n; i++) {
    const i1 = (i + 1) % n;
    const col = (vi: number, side: 0 | 1) =>
      rings.map(([dist, z, wIn, wz]) => {
        const p = ins(dist)[vi]!;
        const nn = vN[vi]![side];
        return vert(m, p[0], p[1], z, nn[0] * wIn, nn[1] * wIn, wz);
      });
    const a = col(i, 1);
    const b = col(i1, 0);
    for (let k = 0; k < rings.length - 1; k++) quad(m, a[k]!, b[k]!, b[k + 1]!, a[k + 1]!);
  }
  const capPoly = (dist: number, z: number, nz: number) => {
    const p = ins(dist);
    const tris = triangulate(p);
    const ids = p.map((q) => vert(m, q[0], q[1], z, 0, 0, nz));
    for (const t of tris) tri(m, ids[t[0]!]!, ids[t[1]!]!, ids[t[2]!]!);
  };
  if (opts.frontCap !== false) capPoly(rings[0]![0], rings[0]![1], 1);
  if (opts.backCap !== false) capPoly(rings[rings.length - 1]![0], rings[rings.length - 1]![1], -1);
  return m;
}

// ------------------------------------------------------------------------------------------------ modifiers
/** Non-indexed copy with one normal per face (flat shading). */
export function flatShade(m: Raw): Raw {
  const o = newRaw();
  for (let t = 0; t < m.i.length; t += 3) {
    const a = m.i[t]!, b = m.i[t + 1]!, c = m.i[t + 2]!;
    const P = (k: number, j: number) => m.p[k * 3 + j]!;
    const ux = P(b, 0) - P(a, 0), uy = P(b, 1) - P(a, 1), uz = P(b, 2) - P(a, 2);
    const vx = P(c, 0) - P(a, 0), vy = P(c, 1) - P(a, 1), vz = P(c, 2) - P(a, 2);
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const ids = [a, b, c].map((k) => vert(o, P(k, 0), P(k, 1), P(k, 2), nx, ny, nz));
    o.i.push(ids[0]!, ids[1]!, ids[2]!);
  }
  return o;
}

/**
 * "Whittling": displace every vertex by a hashed 3D offset of its quantised position (coincident
 * vertices move together, so flat-shaded facets stay closed). Deterministic from the seed.
 */
export function jitter(m: Raw, amp: number, seed: number): Raw {
  const q = (v: number) => Math.round(v * 2000);
  for (let k = 0; k < m.p.length; k += 3) {
    const x = q(m.p[k]!), y = q(m.p[k + 1]!), z = q(m.p[k + 2]!);
    m.p[k] = m.p[k]! + amp * (hash3f(x, y, z, seed) * 2 - 1);
    m.p[k + 1] = m.p[k + 1]! + amp * (hash3f(x, y, z, seed ^ 0x51ed) * 2 - 1);
    m.p[k + 2] = m.p[k + 2]! + amp * (hash3f(x, y, z, seed ^ 0xa3c5) * 2 - 1);
  }
  return m;
}
