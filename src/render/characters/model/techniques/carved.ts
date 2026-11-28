/**
 * Technique `carved` (d05 "Drewno"): a wooden figurine — boxes and wedges with chamfered edges,
 * cylinders and limbs as 8-sided prisms with chamfered or tapered ends, round parts whittled into
 * octagonal lathes with few rings, extruded outlines with a 1-step chamfer; all flat shaded so every
 * cut catches the light ("ciężka geometria podhalańska" of the bible, applied to the figure).
 */
import type { LodLevel, PartShape } from '../../types';
import { CAP_BOTH, type ModelPart } from '../part';
import { boxCorners, chamferedHexahedron, extrude, flatShade, hexahedron, lathe, wedgeCorners, type P2, type Raw } from '../shapes';
import { meshShape, segFor, simplifyProfile, type MeshOut, type Quality, type TechniqueImpl } from './common';
import { PRIM_Q } from './primitives';

const CARVE_Q: Quality = { edge: 0.045, minSeg: 6, maxSeg: 10, ringEdge: 0.07, minRings: 3, maxRings: 5, lathePts: 6, apexRatio: 0.25 };

function octSeg(r: number, part: ModelPart): number {
  if (part.seg !== undefined) return Math.min(part.seg, 8);
  return r < 0.025 ? 6 : segFor(r * (part.s ? Math.max(part.s[0], part.s[2]) : 1), CARVE_Q) >= 12 ? 10 : 8;
}

function carve(part: ModelPart): Raw {
  const sh: PartShape = part.shape;
  const minDim = (...v: number[]) => Math.min(...v);
  switch (sh.k) {
    case 'box': {
      const c = Math.min(0.014, 0.18 * minDim(sh.w, sh.h, sh.d));
      return chamferedHexahedron(boxCorners(sh.w, sh.h, sh.d), c);
    }
    case 'wedge': {
      const c = Math.min(0.014, 0.18 * minDim(sh.w0, sh.w1, sh.h, sh.d));
      return chamferedHexahedron(wedgeCorners(sh.w0, sh.w1, sh.h, sh.d), c);
    }
    case 'frustum': {
      const { r0, r1, h } = sh;
      const seg = octSeg(Math.max(r0, r1), part);
      const cap = part.cap ?? CAP_BOTH;
      if (r0 < 1e-6 || r1 < 1e-6 || h < 0.03) return lathe([[r0, -h / 2], [r1, h / 2]], seg, cap, 50, Math.PI / seg);
      const c = Math.min(0.012, 0.22 * Math.min(r0, r1), h * 0.2);
      const prof: [number, number][] = [];
      if (cap & 1) prof.push([r0 - c, -h / 2]);
      prof.push([r0, -h / 2 + ((cap & 1) ? c : 0)], [r1, h / 2 - ((cap & 2) ? c : 0)]);
      if (cap & 2) prof.push([r1 - c, h / 2]);
      return lathe(prof, seg, cap, 20, Math.PI / seg);
    }
    case 'capsule': {
      const { r, len } = sh;
      const a = Math.max(0, len / 2 - r);
      return lathe(
        [
          [r * 0.42, -len / 2],
          [r * 0.88, -a - r * 0.55],
          [r, -a],
          [r, a],
          [r * 0.88, a + r * 0.55],
          [r * 0.42, len / 2],
        ],
        octSeg(r, part),
        CAP_BOTH,
        20,
        Math.PI / 8,
      );
    }
    case 'ellipsoid': {
      const { rx, ry, rz } = sh;
      const seg = octSeg(Math.max(rx, rz), part);
      const prof: [number, number][] = [
        [0, -ry],
        [rx * 0.62, -ry * 0.8],
        [rx * 0.95, -ry * 0.32],
        [rx * 0.95, ry * 0.32],
        [rx * 0.62, ry * 0.8],
        [0, ry],
      ];
      const m = lathe(prof, seg, 0, 20, Math.PI / seg);
      for (let k = 2; k < m.p.length; k += 3) m.p[k] = (m.p[k]! * rz) / rx;
      for (let k = 2; k < m.n.length; k += 3) m.n[k] = (m.n[k]! * rx) / rz;
      return m;
    }
    case 'dome': {
      const { r, ry } = sh;
      return lathe(
        [
          [r, 0],
          [r * 0.95, ry * 0.4],
          [r * 0.72, ry * 0.78],
          [r * 0.36, ry * 0.97],
          [0, ry],
        ],
        octSeg(r, part),
        1,
        20,
        Math.PI / 8,
      );
    }
    case 'lathe':
      return lathe(simplifyProfile(sh.profile, 6), octSeg(Math.max(...sh.profile.map((p) => p[0])), part), part.cap ?? CAP_BOTH, 20, Math.PI / 10);
    case 'outline':
      return extrude(sh.pts as P2[], sh.d, { bf: Math.min(0.008, sh.d * 0.25), sf: 1, bb: Math.min(0.008, sh.d * 0.25), sb: 1, creaseDeg: 5 });
  }
}

export function carvedTechnique(): TechniqueImpl {
  return {
    technique: 'carved',
    mode: 'welded',
    mesh(part: ModelPart, lod: LodLevel): MeshOut {
      if (lod === 0 && part.fromLod !== 2) return { raw: flatShade(carve(part)), space: 'local' };
      const sh = part.shape;
      const raw = sh.k === 'box' ? hexahedron(boxCorners(sh.w, sh.h, sh.d)) : sh.k === 'wedge' ? hexahedron(wedgeCorners(sh.w0, sh.w1, sh.h, sh.d)) : meshShape(part, PRIM_Q[lod]!);
      return { raw: flatShade(raw), space: 'local' };
    },
  };
}
