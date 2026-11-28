/**
 * Technique `primitives` (d01, d09–d12) and `parts` (d07): spheres, capsules, boxes, cones and the
 * revolved barrel exactly as the concept card's table, smooth normals, segment counts per LOD.
 * `parts` uses the same meshes as separate rigid parts (instanced-parts cost twin).
 */
import type { LodLevel } from '../../types';
import type { ModelPart } from '../part';
import { meshShape, type MeshOut, type Quality, type TechniqueImpl } from './common';

export const PRIM_Q: readonly [Quality, Quality, Quality] = [
  { edge: 0.045, minSeg: 6, maxSeg: 16, ringEdge: 0.05, minRings: 3, maxRings: 8, lathePts: 0, apexRatio: 0 },
  { edge: 0.11, minSeg: 4, maxSeg: 6, ringEdge: 0.12, minRings: 2, maxRings: 3, lathePts: 3, apexRatio: 0.3 },
  { edge: 1, minSeg: 3, maxSeg: 4, ringEdge: 1, minRings: 2, maxRings: 2, lathePts: 2, apexRatio: 0 },
];

export function primitivesTechnique(mode: 'welded' | 'parts' = 'welded', q: readonly [Quality, Quality, Quality] = PRIM_Q): TechniqueImpl {
  return {
    technique: mode === 'parts' ? 'parts' : 'primitives',
    mode,
    mesh(part: ModelPart, lod: LodLevel): MeshOut {
      return { raw: meshShape(part, q[lod]!), space: 'local' };
    },
  };
}
