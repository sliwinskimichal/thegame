/**
 * Technique `lathe` (d02 "Toczone"): the same parts as revolved and extruded PROFILES with a smooth
 * outline — barrel torso and flared skirt through a spline, egg-shaped head, turned helmet / cap / hood
 * profiles, limbs with muscle bulges and rounded ends, a teardrop beard (width and depth taper),
 * boots as one extruded side profile with a rounded bevel, tool handles with knobs.
 */
import type { LodLevel, PartShape } from '../../types';
import type { Frame } from '../anatomy';
import { CAP_BOTH, type ModelPart } from '../part';
import { decimate, extrude, type P2 } from '../shapes';
import { meshShape, simplifyProfile, type MeshOut, type Quality, type TechniqueImpl } from './common';

export const LATHE_Q: readonly [Quality, Quality, Quality] = [
  { edge: 0.045, minSeg: 7, maxSeg: 14, ringEdge: 0.05, minRings: 3, maxRings: 8, lathePts: 0, apexRatio: 0 },
  { edge: 0.11, minSeg: 4, maxSeg: 6, ringEdge: 0.12, minRings: 2, maxRings: 3, lathePts: 3, apexRatio: 0.3 },
  { edge: 1, minSeg: 3, maxSeg: 4, ringEdge: 1, minRings: 2, maxRings: 2, lathePts: 2, apexRatio: 0 },
];

type Prof = [number, number][];

/** Catmull–Rom resampling of an open profile (ends kept), n points. */
export function smoothProfile(prof: readonly (readonly [number, number])[], n: number): Prof {
  if (prof.length < 3) return prof.map((p) => [p[0], p[1]]);
  const pts = prof.map((p) => [p[0], p[1]] as [number, number]);
  const seg = pts.length - 1;
  const out: Prof = [];
  for (let i = 0; i < n; i++) {
    const u = (i / (n - 1)) * seg;
    const k = Math.min(seg - 1, Math.floor(u));
    const t = u - k;
    const p0 = pts[Math.max(0, k - 1)]!, p1 = pts[k]!, p2 = pts[k + 1]!, p3 = pts[Math.min(seg, k + 2)]!;
    const c = (a: number, b: number, cc: number, d: number) =>
      0.5 * (2 * b + (-a + cc) * t + (2 * a - 5 * b + 4 * cc - d) * t * t + (-a + 3 * b - 3 * cc + d) * t * t * t);
    out.push([Math.max(0, c(p0[0], p1[0], p2[0], p3[0])), c(p0[1], p1[1], p2[1], p3[1])]);
  }
  return out;
}

const lathe = (profile: Prof): PartShape => ({ k: 'lathe', profile });

/** Turned limb: rounded ends, slight bulge at 35% of the length. */
function limb(r0: number, r1: number, h: number, bulge: number): Prof {
  const y0 = -h / 2;
  const y1 = h / 2;
  const rm = Math.max(r0, r1) * (1 + bulge);
  return smoothProfile(
    [
      [0, y0],
      [r0 * 0.75, y0 + r0 * 0.3],
      [r0, y0 + h * 0.12],
      [rm, y0 + h * 0.55],
      [r1, y1 - h * 0.12],
      [r1 * 0.75, y1 - r1 * 0.3],
      [0, y1],
    ],
    7,
  );
}

/** Boot side profile around the ankle (x forward, y up from the ground): heel, shaft, instep, big toe. */
export function bootProfile(): P2[] {
  return [
    [-0.08, 0.0],
    [0.18, 0.0],
    [0.198, 0.028],
    [0.188, 0.058],
    [0.155, 0.078],
    [0.1, 0.09],
    [0.062, 0.118],
    [0.06, 0.175],
    [-0.062, 0.175],
    [-0.072, 0.1],
    [-0.09, 0.045],
  ];
}

/** LOD1 (<= 400 triangles) keeps the base shape of the part unless its own LOD1 override says otherwise. */
function keepLod1(p: ModelPart): ModelPart['lod1'] {
  return { shape: p.shape, s: p.s ?? [1, 1, 1], cap: p.cap ?? CAP_BOTH, seg: p.seg, rings: p.rings, ...p.lod1 };
}

function refine(parts: ModelPart[], f: Frame): ModelPart[] {
  const out: ModelPart[] = [];
  for (const p0 of parts) {
    const p: ModelPart = p0.fromLod === 2 || /^boot\./.test(p0.name) ? p0 : { ...p0, lod1: keepLod1(p0) };
    if (p.fromLod === 2) {
      out.push(p);
      continue;
    }
    const sh = p.shape;
    const n = p.name;
    // boots: one extruded side profile replaces box + toe + shaft
    if (/^(toe|shaft)\./.test(n)) continue;
    if (/^boot\./.test(n)) {
      const A = [f.j[p.bone * 3]!, 0, f.j[p.bone * 3 + 2]!] as const;
      const prof = bootProfile();
      out.push({
        ...p,
        shape: { k: 'outline', pts: prof, d: 0.145 },
        t: [A[0], 0, A[2]],
        round: 1,
        lod1: { shape: { k: 'outline', pts: decimate(prof, 5), d: 0.14 }, round: 0 },
      });
      continue;
    }
    if (n === 'head' && sh.k === 'ellipsoid') {
      const { rx, ry, rz } = sh;
      out.push({
        ...p,
        shape: lathe(
          smoothProfile(
            [
              [0, -ry],
              [rx * 0.55, -ry * 0.92],
              [rx * 0.88, -ry * 0.55],
              [rx, -ry * 0.05],
              [rx * 0.96, ry * 0.4],
              [rx * 0.78, ry * 0.75],
              [rx * 0.42, ry * 0.96],
              [0, ry],
            ],
            10,
          ),
        ),
        s: [1, 1, rz / rx],
      });
      continue;
    }
    if (sh.k === 'dome') {
      const { r, ry } = sh;
      out.push({
        ...p,
        shape: lathe(
          smoothProfile(
            [
              [r * 1.04, 0],
              [r * 1.0, ry * 0.08],
              [r * 0.96, ry * 0.35],
              [r * 0.8, ry * 0.72],
              [r * 0.45, ry * 0.96],
              [0, ry],
            ],
            9,
          ),
        ),
        cap: 1,
      });
      continue;
    }
    if (sh.k === 'capsule' && /^(arm|fore)\./.test(n)) {
      out.push({ ...p, shape: lathe(limb(sh.r * 0.92, sh.r, sh.len, 0.1)) });
      continue;
    }
    if (sh.k === 'frustum' && /^(thigh|shin)\./.test(n)) {
      out.push({ ...p, shape: lathe(limb(sh.r0, sh.r1, sh.h, n.startsWith('shin') ? 0.12 : 0.06)) });
      continue;
    }
    if (sh.k === 'frustum' && /\.handle$/.test(n)) {
      // turned handle: knob at the butt, swelling at the grip, ferrule under the head
      const { r0, r1, h } = sh;
      out.push({
        ...p,
        shape: lathe([
          [0, -h / 2],
          [r0 * 1.25, -h / 2 + 0.006],
          [r0 * 1.3, -h / 2 + 0.02],
          [r0 * 0.95, -h / 2 + 0.04],
          [r0 * 1.05, -h / 2 + 0.16],
          [r1, h / 2 - 0.08],
          [r1 * 1.15, h / 2 - 0.05],
          [r1 * 1.1, h / 2],
          [0, h / 2],
        ]),
        seg: 8,
      });
      continue;
    }
    if (sh.k === 'frustum' && /^beard\.s\dl$/.test(n)) {
      // lower half of a strand: rounded tip curling slightly
      const { r0, r1, h } = sh;
      out.push({
        ...p,
        shape: lathe(
          smoothProfile(
            [
              [0, -h / 2 - r0 * 0.8],
              [r0 * 0.9, -h / 2],
              [(r0 + r1) * 0.55, 0],
              [r1, h / 2],
            ],
            6,
          ),
        ),
        cap: 2,
      });
      continue;
    }
    if (sh.k === 'lathe' && (n === 'torso' || n === 'skirt' || n === 'basket')) {
      out.push({ ...p, shape: lathe(smoothProfile(sh.profile, n === 'torso' ? 11 : 6)) });
      continue;
    }
    out.push(p);
  }
  return out;
}

export function latheTechnique(): TechniqueImpl {
  return {
    technique: 'lathe',
    mode: 'welded',
    refine,
    mesh(part: ModelPart, lod: LodLevel): MeshOut {
      const q = LATHE_Q[lod]!;
      const sh = part.shape;
      if (sh.k === 'outline' && (part.round ?? 0) > 0 && lod === 0) {
        const b = Math.min(0.03, sh.d * 0.3) * (part.round ?? 0);
        return { raw: extrude(sh.pts as P2[], sh.d, { bf: b, sf: 2, bb: b, sb: 2, creaseDeg: 30 }), space: 'local' };
      }
      if (sh.k === 'lathe' && lod === 1) return { raw: meshShape({ ...part, shape: { k: 'lathe', profile: simplifyProfile(sh.profile, 4) } }, q), space: 'local' };
      return { raw: meshShape(part, q), space: 'local' };
    },
  };
}
