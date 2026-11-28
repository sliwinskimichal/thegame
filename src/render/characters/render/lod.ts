/**
 * Zoom and level of detail measured on the CHARACTER, not on the tile (owner decision 2026-11-28:
 * "the world scales to the models, not the models to the world"). A zoom is the on-screen height of
 * a dwarf in pixels; a variant that builds a taller or shorter dwarf is framed at the same pixel
 * height, so the tournament compares variants of different scale fairly.
 *
 * The contract's ZOOMS / lodForPxPerTile (direction.ts) are expressed per tile for the concept dwarf
 * (1.294 tiles with headgear); the functions here convert them once through that reference height.
 * Proposal for the contract (lead): ZoomDef.dwarfPx and lodForDwarfPx() in direction.ts.
 */
import * as THREE from 'three';
import { lodForPxPerTile, PROPORTIONS_A, totalHeight, ZOOMS } from '../direction';
import type { DwarfModel, LodLevel, ZoomDef } from '../types';

/** Height (tiles, with headgear) of the concept dwarf the per-tile zoom table was written for. */
export const REF_HEIGHT = totalHeight(PROPORTIONS_A);

/** On-screen dwarf height (px at 1080p density) of a zoom: Izba ~218, Gród ~75, Okolica ~24. */
export function dwarfPxForZoom(z: ZoomDef['id']): number {
  return ZOOMS[z].pxPerTile * REF_HEIGHT;
}

/** LOD from the on-screen dwarf height (px): the contract thresholds (100 / 30 px per tile) times REF_HEIGHT. */
export function lodForDwarfPx(px: number): LodLevel {
  return lodForPxPerTile(px / REF_HEIGHT);
}

/** Pixel thresholds of lodForDwarfPx (LOD0 at >= [0], LOD1 at >= [1]). */
export const LOD_PX_THRESHOLDS: readonly [number, number] = [100 * REF_HEIGHT, 30 * REF_HEIGHT];

/**
 * LOD with hysteresis: keep the previous level while the height is within `band` (fraction) of the
 * threshold between the two levels, so a dwarf walking at the edge of a zoom step does not flicker.
 */
export function lodWithHysteresis(px: number, prev: number, band = 0.08): LodLevel {
  const next = lodForDwarfPx(px);
  if (prev < 0 || prev === next || Math.abs(prev - next) > 1) return next;
  const t = LOD_PX_THRESHOLDS[Math.min(prev, next)]!;
  return Math.abs(px - t) <= t * band ? (prev as LodLevel) : next;
}

/** Pixels per world unit at view depth `depth` (perspective camera, canvas height h). */
export function pxPerUnitAtDepth(fovDeg: number, h: number, depth: number): number {
  return h / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2) * Math.max(depth, 1e-3));
}

/** View-space depth of a world point (positive in front of the camera); camera matrices must be current. */
export function viewDepth(camera: THREE.Camera, x: number, y: number, z: number): number {
  const e = camera.matrixWorldInverse.elements;
  return -(e[2]! * x + e[6]! * y + e[10]! * z + e[14]!);
}

/** Camera distance that shows a dwarf of `heightTiles` at `dwarfPx` pixels on a canvas of height h (FOV 30°). */
export function distanceForDwarfPx(dwarfPx: number, heightTiles: number, h: number, fovDeg = 30): number {
  return (h * heightTiles) / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2) * dwarfPx);
}

const _box = new THREE.Box3();
const _v = new THREE.Vector3();

/** Rest height (tiles) of a built model: top of its LOD0 geometry (welded) or of its parts (parts mode). */
export function modelHeight(model: DwarfModel): number {
  const m = model.lods[0];
  if (m.geometry) {
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    return m.geometry.boundingBox!.max.y;
  }
  let top = 0;
  for (const p of m.parts ?? []) {
    if (!p.geometry.boundingBox) p.geometry.computeBoundingBox();
    _box.copy(p.geometry.boundingBox!);
    _v.set(model.rig.rest[p.bone * 3]!, model.rig.rest[p.bone * 3 + 1]!, model.rig.rest[p.bone * 3 + 2]!);
    top = Math.max(top, _box.max.y + _v.y);
  }
  return top;
}

/** Height of a variant: median over its role models (headgear differs per role). */
export function variantHeight(models: readonly DwarfModel[]): number {
  const hs = models.map(modelHeight).sort((a, b) => a - b);
  if (hs.length === 0) return REF_HEIGHT;
  const k = hs.length >> 1;
  return hs.length % 2 ? hs[k]! : (hs[k - 1]! + hs[k]!) / 2;
}
