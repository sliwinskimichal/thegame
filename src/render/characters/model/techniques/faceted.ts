/**
 * Technique `faceted` (d03 "Fasety"): the same parts with 4–6 segments, flat shading and a seeded
 * "whittling" jitter of the vertices (coincident vertices move together, facets stay closed). Tools and
 * small parts get a smaller jitter so blades and handles keep their line.
 */
import { hashString } from '../../../../core/rng';
import type { LodLevel } from '../../types';
import type { Frame } from '../anatomy';
import type { ModelPart } from '../part';
import { flatShade, jitter } from '../shapes';
import { meshShape, shapeRadius, type MeshOut, type Quality, type TechniqueImpl } from './common';

export const FACET_Q: readonly [Quality, Quality, Quality] = [
  { edge: 0.075, minSeg: 4, maxSeg: 6, ringEdge: 0.07, minRings: 2, maxRings: 4, lathePts: 4, apexRatio: 0.25 },
  { edge: 0.11, minSeg: 4, maxSeg: 6, ringEdge: 0.12, minRings: 2, maxRings: 3, lathePts: 3, apexRatio: 0.3 },
  { edge: 1, minSeg: 3, maxSeg: 4, ringEdge: 1, minRings: 2, maxRings: 2, lathePts: 2, apexRatio: 0 },
];

export function facetedTechnique(): TechniqueImpl {
  return {
    technique: 'faceted',
    mode: 'welded',
    mesh(part: ModelPart, lod: LodLevel, f: Frame): MeshOut {
      // LOD0: ignore the smooth segment overrides of the anatomy (the low count IS the technique)
      const p = lod === 0 && part.fromLod !== 2 ? { ...part, seg: part.seg !== undefined ? Math.min(part.seg, 6) : undefined, rings: part.rings !== undefined ? Math.min(part.rings, 4) : undefined } : part;
      const raw = meshShape(p, FACET_Q[lod]!);
      if (part.fromLod !== 2) {
        const r = shapeRadius(part.shape);
        const tool = part.ident === 'tool' || /^(eye|bead|rivet|lamp)/.test(part.name);
        const amp = Math.min(lod === 0 ? 0.011 : 0.007, r * (tool ? 0.05 : 0.12));
        jitter(raw, amp, Math.imul(f.spec.seed | 0, 0x9e3779b1) ^ hashString(part.name));
      }
      return { raw: flatShade(raw), space: 'local' };
    },
  };
}
