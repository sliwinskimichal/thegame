/**
 * Model part as data (owner: W1). `ModelPart` extends the contract's `PartDef` (v2: `s`, `fromLod`,
 * `ident` are contract fields) with local construction hints:
 *  - `cap`   which ends of a frustum / lathe / capsule are closed (bit 0 bottom, bit 1 top; default both);
 *  - `skin`  the part is a primitive of the smooth SDF skin (technique `sdf`, d08);
 *  - `prio`  papercut draw order inside one layer (higher = nearer the camera);
 *  - `seg`, `rings`, `phase`  segment-count override for round shapes (LOD2 tokens use exact counts);
 *  - `round` 0..1 how much a technique may round / bevel the part (0 = keep crisp: blades, plates);
 *  - `lod1`  overrides applied when meshing LOD1 (Gród, <= 400 triangles: simpler shape, fewer segments,
 *            open tube ends hidden inside other parts). Dropping a part at LOD1 = `minLod: 0`.
 * All lengths are MODEL units (contract v2: the world scales to the models).
 */
import * as THREE from 'three';
import type { PartDef } from '../types';

export type IdentGroup = NonNullable<PartDef['ident']>;
export const IDENT_GROUPS: readonly IdentGroup[] = ['headgear', 'tool', 'load', 'back', 'apron', 'lamp'];

export interface ModelPart extends PartDef {
  cap?: number;
  skin?: boolean;
  prio?: number;
  seg?: number;
  rings?: number;
  phase?: number;
  round?: number;
  lod1?: Partial<Omit<ModelPart, 'name' | 'bone' | 'lod1' | 'minLod' | 'fromLod' | 'ident' | 'identity'>>;
}

/** The part as meshed at a LOD (LOD1 overrides applied). */
export function atLod(p: ModelPart, lod: number): ModelPart {
  return lod === 1 && p.lod1 ? { ...p, ...p.lod1 } : p;
}

export const CAP_BOTTOM = 1;
export const CAP_TOP = 2;
export const CAP_BOTH = 3;

/** Is the part drawn at this LOD? (contract: fromLod <= lod <= minLod, defaults 0 and 2) */
export function drawnAt(p: PartDef, lod: number): boolean {
  return (p.fromLod ?? 0) <= lod && lod <= (p.minLod ?? 2);
}

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

/** Shape frame -> rest model space: T(t) * R(r, Euler ZYX) * S(s). */
export function partMatrix(p: PartDef, out = new THREE.Matrix4()): THREE.Matrix4 {
  const r = p.r ?? [0, 0, 0];
  _e.set(r[0], r[1], r[2], 'ZYX');
  _q.setFromEuler(_e);
  _v.set(p.t[0], p.t[1], p.t[2]);
  const s = p.s ?? [1, 1, 1];
  _s.set(s[0], s[1], s[2]);
  return out.compose(_v, _q, _s);
}

/** Linear-space RGB of an sRGB hex colour (three.js ColorManagement converts sRGB hex to linear). */
export function linearRgb(hex: number): [number, number, number] {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}
