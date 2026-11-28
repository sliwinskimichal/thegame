/**
 * Technique `papercut` (d04 "Wycinanka"): every part becomes a flat 2.5D card — its side profile
 * (convex hull of the projected shape; authored outlines keep their concave contour) extruded 0.02–0.04
 * — stacked in three depth layers (`layer`: far side −1, body 0, near side +1) with a fixed draw order
 * inside each layer. Designed for a pure profile view (yaw 0). LOD1 merges overlapping cards of the same
 * bone and colour into one card; LOD2 uses the shared token.
 */
import type { LodLevel } from '../../types';
import { type ModelPart } from '../part';
import { convexHull2, extrude, type P2 } from '../shapes';
import { depthLayer, meshShape, mergeGroups, partProfile, profileVerts, reduceProfile, type MeshOut, type Profile, type TechniqueImpl } from './common';
import { PRIM_Q } from './primitives';

/** Draw order inside a layer (back to front) by part-name pattern; first match wins. */
const PRIO: readonly [RegExp, number][] = [
  [/^(arm)\./, 6.9],
  [/^(fore)\./, 7.0],
  [/^(cuff)\./, 7.1],
  [/^(hand)\./, 7.2],
  [/^(thumb)\./, 7.3],
  [/^(pick|axe|hammer|tongs)/, 6.5],
  [/^(tylnik|frame|basket|ore|beam)/, 0],
  [/^(hood\.spike|tassel|knot|plume|cap\.flap|feather)/, 0.5],
  [/^(thigh|shin|knee|boot|toe|shaft|sole)\.L/, 0.8],
  [/^(thigh|shin|knee|boot|toe|shaft|sole)\.R/, 0.9],
  [/^(skirt|hem)/, 1],
  [/^(torso|collar|shoulders|hood\.cape)/, 1.5],
  [/^(belt|buckle|pouch|apron|strap|lantern|sack)/, 2],
  [/^(head|ear)/, 3],
  [/^(hair\.back|hair\.nape)/, 3.5],
  [/^(helmet|hood|cap|hair\.top|band|goggle|lamp)/, 4],
  [/^(beard|braid|bead)/, 5],
  [/^(mous|nose|brow|eye)/, 6],
];

export function cardPrio(p: ModelPart): number {
  if (p.prio !== undefined) return p.prio;
  for (const [re, v] of PRIO) if (re.test(p.name)) return v;
  return 2;
}

/**
 * Flat garments seen edge-on in a pure profile (front apron, tylnik) would be a 0.02 sliver: draw their
 * card as if turned ~35° — the width folds back into the body, the outer edge stays where it is.
 */
function flatSkew(p: ModelPart): ((x: number, z: number) => number) | undefined {
  const sh = p.shape;
  const thin = (sh.k === 'wedge' || sh.k === 'box') && sh.d <= 0.05;
  if (!thin || !/^(tylnik|apron)/.test(p.name)) return undefined;
  const xc = p.t[0];
  const toBody = xc > 0 ? -1 : 1;
  return (x, z) => x + toBody * Math.abs(z - p.t[2]) * 0.55;
}

const LAYER_Z = { [-1]: -0.25, 0: 0, 1: 0.25 } as const;
const STEP = 0.0042;

interface Card {
  part: ModelPart;
  poly: P2[];
  layer: -1 | 0 | 1;
  prio: number;
  order: number;
  thick: number;
}

function buildCards(parts: readonly ModelPart[], lod: LodLevel): Card[] {
  const prof: Profile[] = parts.map((p) => partProfile(p, flatSkew(p)));
  const layerOf = (p: ModelPart, pr: Profile) => (p.layer ?? depthLayer(pr.z0, pr.z1)) as -1 | 0 | 1;
  const cards: Card[] = [];
  if (lod === 1) {
    for (const g of mergeGroups(parts, prof)) {
      const first = parts[g[0]!]!;
      const pts = g.flatMap((i) => prof[i]!.poly);
      const poly = g.length === 1 ? prof[g[0]!]!.poly : convexHull2(pts);
      const n = profileVerts(poly, 0.125, 3, 6);
      // the group is sorted largest first: the dominant part sets the draw order
      cards.push({ part: first, poly: reduceProfile(poly, n), layer: layerOf(first, prof[g[0]!]!), prio: cardPrio(first), order: g[0]!, thick: 0.03 });
    }
  } else {
    parts.forEach((p, i) => {
      const pr = prof[i]!;
      const n = profileVerts(pr.poly, 0.022, 4, 26);
      const small = Math.abs(pr.z1 - pr.z0) < 0.05 && n <= 6;
      cards.push({ part: p, poly: reduceProfile(pr.poly, n), layer: layerOf(p, pr), prio: cardPrio(p), order: i, thick: small ? 0.02 : 0.032 });
    });
  }
  return cards;
}

export function papercutTechnique(): TechniqueImpl {
  return {
    technique: 'papercut',
    mode: 'welded',
    meshAll(parts: ModelPart[], lod: LodLevel) {
      const out: { part: ModelPart; out: MeshOut }[] = [];
      const tokens = parts.filter((p) => p.fromLod === 2);
      for (const p of tokens) out.push({ part: p, out: { raw: meshShape(p, PRIM_Q[2]!), space: 'local' } });
      const cards = buildCards(
        parts.filter((p) => p.fromLod !== 2),
        lod,
      );
      for (const layer of [-1, 0, 1] as const) {
        const inLayer = cards.filter((c) => c.layer === layer).sort((a, b) => a.prio - b.prio || a.order - b.order);
        inLayer.forEach((c, rank) => {
          const z = LAYER_Z[layer] + rank * STEP;
          const raw = extrude(c.poly, c.thick, { creaseDeg: 30 });
          for (let k = 2; k < raw.p.length; k += 3) raw.p[k] = raw.p[k]! + z;
          out.push({ part: c.part, out: { raw, space: 'model', layer } });
        });
      }
      return out;
    },
  };
}
