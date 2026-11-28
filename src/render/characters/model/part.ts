/**
 * Model part as data (owner: W1). `ModelPart` extends the contract's `PartDef` with a few local fields
 * (proposed to the lead for the contract; until then they stay here):
 *  - `s`       non-uniform scale of the shape in its own frame (elliptic barrel torso, flattened brims);
 *  - `fromLod` first LOD that draws the part: a part is drawn at LOD L when fromLod <= L <= minLod
 *              (LOD2 "token" parts replace several detailed parts);
 *  - `ident`   identity group of the role (headgear, tool, load, back, apron, lamp) — every group present
 *              at LOD0 must be present at every LOD (tests);
 *  - `cap`     which ends of a frustum / lathe / capsule are closed (bit 0 bottom, bit 1 top; default both);
 *  - `skin`    the part is a primitive of the smooth SDF skin (technique `sdf`, d08);
 *  - `prio`    papercut draw order inside one layer (higher = nearer the camera);
 *  - `seg`     segment-count override for round shapes.
 */
import * as THREE from 'three';
import type { PartDef } from '../types';

export type IdentGroup = 'headgear' | 'tool' | 'load' | 'back' | 'apron' | 'lamp';

export interface ModelPart extends PartDef {
  s?: readonly [number, number, number];
  fromLod?: 0 | 1 | 2;
  ident?: IdentGroup;
  cap?: number;
  skin?: boolean;
  prio?: number;
  seg?: number;
}

export const CAP_BOTTOM = 1;
export const CAP_TOP = 2;
export const CAP_BOTH = 3;

/** Is the part drawn at this LOD? */
export function drawnAt(p: ModelPart, lod: number): boolean {
  return (p.fromLod ?? 0) <= lod && lod <= (p.minLod ?? 2);
}

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

/** Shape frame -> rest model space: T(t) * R(r, Euler ZYX) * S(s). */
export function partMatrix(p: ModelPart, out = new THREE.Matrix4()): THREE.Matrix4 {
  const r = p.r ?? [0, 0, 0];
  _e.set(r[0], r[1], r[2], 'ZYX');
  _q.setFromEuler(_e);
  _v.set(p.t[0], p.t[1], p.t[2]);
  const s = p.s ?? [1, 1, 1];
  _s.set(s[0], s[1], s[2]);
  return out.compose(_v, _q, _s);
}

/** Linear-space RGB of an sRGB hex colour (three.js does the conversion). */
export function linearRgb(hex: number): [number, number, number] {
  const c = new THREE.Color(hex); // ColorManagement converts sRGB hex to linear working space
  return [c.r, c.g, c.b];
}
