/**
 * Technique `outline` (d06 "Kontur"): the silhouette of every part is designed in 2D (its side
 * profile; authored outlines keep their concave contour) and extruded through the part's real depth
 * with a strong ROUNDED bevel on the camera side ("pillow" cookie-cutter volumes), flat back. LOD1
 * merges overlapping parts of the same bone and colour into one plain extrusion; LOD2 = shared token.
 */
import type { LodLevel } from '../../types';
import type { ModelPart } from '../part';
import { convexHull2, extrude, type P2 } from '../shapes';
import { meshShape, mergeGroups, partProfile, profileVerts, reduceProfile, type MeshOut, type Profile, type TechniqueImpl } from './common';
import { PRIM_Q } from './primitives';

/** Inradius estimate of a convex polygon: 2 * area / perimeter. */
function inradius(poly: readonly P2[]): number {
  let a = 0;
  let per = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    a += p[0] * q[1] - q[0] * p[1];
    per += Math.hypot(q[0] - p[0], q[1] - p[1]);
  }
  return per > 0 ? Math.abs(a) / per : 0;
}

function slab(poly: P2[], z0: number, z1: number, bf: number, sf: number, bb = 0, sb = 0): MeshOut['raw'] {
  const d = Math.max(0.012, z1 - z0);
  const raw = extrude(poly, d, sf > 0 ? { bf, sf, bb, sb, creaseDeg: 40 } : { creaseDeg: 40 });
  const zc = (z0 + z1) / 2;
  for (let k = 2; k < raw.p.length; k += 3) raw.p[k] = raw.p[k]! + zc;
  return raw;
}

export function outlineTechnique(): TechniqueImpl {
  return {
    technique: 'outline',
    mode: 'welded',
    meshAll(parts: ModelPart[], lod: LodLevel) {
      const out: { part: ModelPart; out: MeshOut }[] = [];
      for (const p of parts.filter((q) => q.fromLod === 2)) out.push({ part: p, out: { raw: meshShape(p, PRIM_Q[2]!), space: 'local' } });
      const body = parts.filter((q) => q.fromLod !== 2);
      const prof: Profile[] = body.map((p) => partProfile(p));
      if (lod === 1) {
        for (const g of mergeGroups(body, prof)) {
          const poly = g.length === 1 ? prof[g[0]!]!.poly : convexHull2(g.flatMap((i) => prof[i]!.poly));
          const z0 = Math.min(...g.map((i) => prof[i]!.z0));
          const z1 = Math.max(...g.map((i) => prof[i]!.z1));
          const n = profileVerts(poly, 0.11, 3, 6);
          out.push({ part: body[g[0]!]!, out: { raw: slab(reduceProfile(poly, n), z0, z1, 0, 0), space: 'model' } });
        }
        return out;
      }
      body.forEach((p, i) => {
        const pr = prof[i]!;
        const r = inradius(pr.poly);
        const depth = pr.z1 - pr.z0;
        const big = depth > 0.15 && r > 0.07;
        const n = profileVerts(pr.poly, big ? 0.045 : 0.06, r < 0.02 ? 4 : 5, big ? 16 : 10);
        const round = p.round ?? 1;
        // strong pillow on big volumes (front 3 steps, softer back), a smaller one elsewhere
        const bevel = Math.min(big ? 0.1 : 0.03, 0.3 * Math.min(depth, 2 * r)) * round;
        const raw =
          bevel < 0.004
            ? slab(reduceProfile(pr.poly, n), pr.z0, pr.z1, 0, 0)
            : big
              ? slab(reduceProfile(pr.poly, n), pr.z0, pr.z1, bevel, 3, bevel * 0.6, 2)
              : slab(reduceProfile(pr.poly, n), pr.z0, pr.z1, bevel, 2);
        out.push({ part: p, out: { raw, space: 'model' } });
      });
      return out;
    },
  };
}
