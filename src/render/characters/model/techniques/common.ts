/**
 * Shared pieces of the construction techniques (owner: W1): the technique interface, segment
 * quality per LOD, the primitive mesher (PartShape -> Raw in the shape frame), 2D side profiles of
 * parts (convex hull of the projected shape) and grouping of parts into merged cards for LOD1.
 */
import * as THREE from 'three';
import type { LodLevel, PartShape, Technique } from '../../types';
import type { Frame } from '../anatomy';
import type { MeshBuilder } from '../mesh';
import { CAP_BOTH, partMatrix, type ModelPart } from '../part';
import {
  polyArea,
  boxCorners,
  capsule,
  convexHull2,
  decimate,
  dome,
  ellipsoid,
  extrude,
  frustum,
  hexahedron,
  lathe,
  perimeter,
  wedgeCorners,
  type P2,
  type Raw,
} from '../shapes';

export interface MeshOut {
  raw: Raw;
  /** 'local' = shape frame (the builder applies the part matrix), 'model' = rest model space. */
  space: 'local' | 'model';
  /** Optional papercut layer override written to aLayer. */
  layer?: -1 | 0 | 1;
}

export interface TechniqueImpl {
  technique: Technique;
  mode: 'welded' | 'parts';
  /** Rewrite part shapes for the technique (e.g. revolved profiles); default: identity. */
  refine?(parts: ModelPart[], f: Frame): ModelPart[];
  /** Mesh every part drawn at this LOD (one MeshOut per part, or merged groups). */
  meshAll?(parts: ModelPart[], lod: LodLevel, f: Frame): { part: ModelPart; out: MeshOut }[];
  /** Mesh one part (used when meshAll is absent). */
  mesh?(part: ModelPart, lod: LodLevel, f: Frame): MeshOut | null;
  /** Smooth skin replacing the `skin` parts at the given LODs (sdf). */
  skin?: { lods: readonly LodLevel[]; build(parts: ModelPart[], lod: LodLevel, f: Frame, b: MeshBuilder): void };
}

/** Segment density of round shapes for one LOD. */
export interface Quality {
  /** Target edge length around the equator (model units). */
  edge: number;
  minSeg: number;
  maxSeg: number;
  /** Target edge length along a meridian (rings of ellipsoids and domes). */
  ringEdge: number;
  minRings: number;
  maxRings: number;
  /** Max points of a lathe profile (0 = keep all). */
  lathePts: number;
  /** Frustum radii below apexRatio * the other radius collapse to a cone apex (0 = never). */
  apexRatio: number;
}

/** Ellipse perimeter (Ramanujan). */
export function ellipsePerimeter(a: number, b: number): number {
  const h = ((a - b) * (a - b)) / ((a + b) * (a + b) || 1);
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

export function segFor(r: number, q: Quality): number {
  return segForPerimeter(2 * Math.PI * r, q);
}

export function segForPerimeter(per: number, q: Quality): number {
  return Math.max(q.minSeg, Math.min(q.maxSeg, Math.round(per / q.edge)));
}

export function ringsFor(halfMeridian: number, q: Quality): number {
  return Math.max(q.minRings, Math.min(q.maxRings, Math.round(halfMeridian / q.ringEdge)));
}

/** Effective radius scale of a part (largest horizontal scale). */
const sMax = (p: ModelPart) => (p.s ? Math.max(p.s[0], p.s[2]) : 1);

/** Simplify an open lathe profile to at most n points (Visvalingam on the polyline, ends kept). */
export function simplifyProfile(prof: readonly (readonly [number, number])[], n: number): [number, number][] {
  const out = prof.map((p) => [p[0], p[1]] as [number, number]);
  if (n <= 0) return out;
  while (out.length > Math.max(2, n)) {
    let best = 1;
    let bestA = Infinity;
    for (let i = 1; i < out.length - 1; i++) {
      const a = out[i - 1]!, b = out[i]!, c = out[i + 1]!;
      const ar = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
      if (ar < bestA) {
        bestA = ar;
        best = i;
      }
    }
    out.splice(best, 1);
  }
  return out;
}

/** The primitive mesher: one PartShape in its own frame at quality q (part overrides win). */
export function meshShape(part: ModelPart, q: Quality): Raw {
  const sh = part.shape;
  const sm = sMax(part);
  const ph = part.phase ?? 0;
  const cap = part.cap ?? CAP_BOTH;
  switch (sh.k) {
    case 'ellipsoid': {
      const seg = part.seg ?? segForPerimeter(ellipsePerimeter(sh.rx, sh.rz) * sm, q);
      const rings = part.rings ?? ringsFor(ellipsePerimeter(Math.max(sh.rx, sh.rz) * sm, sh.ry) / 2, q);
      return ellipsoid(sh.rx, sh.ry, sh.rz, seg, Math.max(2, rings), ph);
    }
    case 'dome': {
      const seg = part.seg ?? segFor(sh.r * sm, q);
      const rings = part.rings ?? Math.max(1, Math.round(ringsFor(ellipsePerimeter(sh.r * sm, sh.ry) / 4, q)));
      return dome(sh.r, sh.ry, seg, rings, true, ph);
    }
    case 'frustum': {
      const seg = part.seg ?? segFor(Math.max(sh.r0, sh.r1) * sm, q);
      let r0 = sh.r0;
      let r1 = sh.r1;
      if (q.apexRatio > 0 && r1 < q.apexRatio * r0) r1 = 0;
      if (q.apexRatio > 0 && r0 < q.apexRatio * r1) r0 = 0;
      return frustum(r0, r1, sh.h, seg, cap, ph);
    }
    case 'capsule': {
      const seg = part.seg ?? segFor(sh.r * sm, q);
      return capsule(sh.r, sh.len, seg, Math.max(1, Math.round(ringsFor((Math.PI * sh.r) / 2, q))), cap);
    }
    case 'box':
      return hexahedron(boxCorners(sh.w, sh.h, sh.d));
    case 'wedge':
      return hexahedron(wedgeCorners(sh.w0, sh.w1, sh.h, sh.d));
    case 'lathe': {
      const rmax = Math.max(...sh.profile.map((p) => p[0]));
      const seg = part.seg ?? segFor(rmax * sm, q);
      return lathe(simplifyProfile(sh.profile, q.lathePts), seg, cap, 50, ph);
    }
    case 'outline':
      return extrude(sh.pts as P2[], sh.d, { creaseDeg: 35 });
  }
}

/** Approximate largest radius of a shape (for heuristics). */
export function shapeRadius(sh: PartShape): number {
  switch (sh.k) {
    case 'ellipsoid':
      return Math.max(sh.rx, sh.ry, sh.rz);
    case 'dome':
      return Math.max(sh.r, sh.ry);
    case 'frustum':
      return Math.max(sh.r0, sh.r1, sh.h / 2);
    case 'capsule':
      return Math.max(sh.r, sh.len / 2);
    case 'box':
      return Math.max(sh.w, sh.h, sh.d) / 2;
    case 'wedge':
      return Math.max(sh.w0, sh.w1, sh.h, sh.d) / 2;
    case 'lathe':
      return Math.max(...sh.profile.map((p) => Math.max(p[0], Math.abs(p[1]))));
    case 'outline':
      return Math.max(...sh.pts.map((p) => Math.hypot(p[0], p[1])));
  }
}

const FINE: Quality = { edge: 0.01, minSeg: 24, maxSeg: 32, ringEdge: 0.01, minRings: 8, maxRings: 16, lathePts: 0, apexRatio: 0 };
const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();

export interface Profile {
  /** CCW polygon of the part's side silhouette (XY, rest model space). */
  poly: P2[];
  z0: number;
  z1: number;
}

/**
 * Side profile of a part: the convex hull of its finely meshed shape projected on XY (outline
 * shapes without out-of-plane rotation keep their own non-convex polygon), plus its depth range.
 */
export function partProfile(part: ModelPart, skew?: (x: number, z: number) => number): Profile {
  partMatrix(part, _m);
  const sh = part.shape;
  const inPlane = !part.r || (Math.abs(part.r[0]) < 1e-6 && Math.abs(part.r[1]) < 1e-6);
  const fine = sh.k === 'outline' && inPlane ? null : meshShape({ ...part, seg: undefined, rings: undefined }, FINE);
  let z0 = Infinity;
  let z1 = -Infinity;
  const pts: P2[] = [];
  const push = (x: number, y: number, z: number) => {
    _v.set(x, y, z).applyMatrix4(_m);
    pts.push([skew ? skew(_v.x, _v.z) : _v.x, _v.y]);
    z0 = Math.min(z0, _v.z);
    z1 = Math.max(z1, _v.z);
  };
  if (fine) {
    for (let k = 0; k < fine.p.length; k += 3) push(fine.p[k]!, fine.p[k + 1]!, fine.p[k + 2]!);
    return { poly: convexHull2(pts), z0, z1 };
  }
  const o = sh as Extract<PartShape, { k: 'outline' }>;
  for (const [x, y] of o.pts) {
    push(x, y, -o.d / 2);
    push(x, y, o.d / 2);
  }
  // keep the authored (possibly concave) order: every point appears twice, take the even ones
  return { poly: pts.filter((_, i) => i % 2 === 0), z0, z1 };
}

/** Number of polygon vertices for a profile at a target edge length. */
export function profileVerts(poly: readonly P2[], edge: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(perimeter(poly) / edge)));
}

/** Reduce a profile polygon to n vertices (keeps corners). */
export const reduceProfile = (poly: readonly P2[], n: number): P2[] => (poly.length > n ? decimate(poly, n) : poly.map((p) => [p[0], p[1]] as P2));

/** Layer of a part from its depth (papercut / outline merging): far, body, near. */
export function depthLayer(z0: number, z1: number): -1 | 0 | 1 {
  const zc = (z0 + z1) / 2;
  return zc > 0.15 ? 1 : zc < -0.15 ? -1 : 0;
}

/**
 * Group parts for merged cards: same bone, slot, fixed colour, emission and layer, overlapping profiles,
 * and a union hull that stays compact (hull area <= 1.12 × the summed areas) — protrusions such as a
 * hood's spike or separated frame bars keep their own card.
 */
export function mergeGroups(parts: readonly ModelPart[], profiles: readonly Profile[]): number[][] {
  const n = parts.length;
  const key = (p: ModelPart, pr: Profile) =>
    `${p.bone}|${p.slot}|${p.slot === 0 ? p.color : ''}|${p.emissive ?? 0}|${p.layer ?? depthLayer(pr.z0, pr.z1)}|${p.shape.k === 'outline' ? p.name : ''}`;
  const keys = parts.map((p, i) => key(p, profiles[i]!));
  const area = (poly: readonly P2[]) => Math.abs(polyArea(poly));
  const groups: { idx: number[]; pts: P2[]; sum: number; bb: [number, number, number, number] }[] = [];
  const bbOf = (poly: readonly P2[]): [number, number, number, number] => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of poly) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    return [x0, y0, x1, y1];
  };
  // largest parts first, so small details join the big shape they sit on
  const order = parts.map((_, i) => i).sort((a, b) => area(profiles[b]!.poly) - area(profiles[a]!.poly) || a - b);
  const m = 0.005;
  for (const i of order) {
    const pr = profiles[i]!;
    const bb = bbOf(pr.poly);
    let placed = false;
    for (const g of groups) {
      if (keys[g.idx[0]!] !== keys[i]) continue;
      if (!(g.bb[0] - m <= bb[2] && bb[0] - m <= g.bb[2] && g.bb[1] - m <= bb[3] && bb[1] - m <= g.bb[3])) continue;
      const hull = convexHull2([...g.pts, ...pr.poly]);
      const sum = g.sum + area(pr.poly);
      if (area(hull) > 1.12 * sum) continue;
      g.idx.push(i);
      g.pts = hull;
      g.sum = sum;
      g.bb = bbOf(hull);
      placed = true;
      break;
    }
    if (!placed) groups.push({ idx: [i], pts: pr.poly.slice(), sum: area(pr.poly), bb });
  }
  void n;
  return groups.map((g) => g.idx);
}
