/**
 * Zoom and level of detail helpers of the crowd renderer (owner: W3 "Technical artist", dwarf team).
 *
 * Contract v2 (owner decision 2026-11-28, "the world scales to the models"): zooms are on-screen heights
 * of the REFERENCE dwarf (ZOOMS[z].dwarfPx); ZOOMS[z].pxPerTile and lodForPxPerTile() follow
 * CHARACTER_SCALE. Cameras, the lab world and LOD use the reference height — identical for every
 * variant; the height of each variant is only measured and reported (modelHeight / variantHeight).
 */
import * as THREE from 'three';
import { CHARACTER_SCALE, lodForDwarfPx, refHeightTiles } from '../direction';
import type { DwarfModel, LodLevel } from '../types';

/** Pixel thresholds of lodForDwarfPx (contract: LOD0 at >= 129 px, LOD1 at >= 39 px of the reference dwarf). */
export const LOD_PX_THRESHOLDS: readonly [number, number] = [129, 39];

/** Pixels per world tile at view depth `depth` (perspective camera with vertical FOV, canvas height h). */
export function pxPerTileAtDepth(fovDeg: number, h: number, depth: number): number {
  return h / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2) * Math.max(depth, 1e-3));
}

/** On-screen height (px) of the REFERENCE dwarf at view depth `depth`. */
export function refDwarfPxAtDepth(fovDeg: number, h: number, depth: number): number {
  return pxPerTileAtDepth(fovDeg, h, depth) * refHeightTiles();
}

/**
 * LOD with hysteresis: keep the previous level while the reference height is within `band` (fraction)
 * of the threshold between the two levels, so a dwarf walking at a zoom step does not flicker.
 */
export function lodWithHysteresis(px: number, prev: number, band = 0.08): LodLevel {
  const next = lodForDwarfPx(px);
  if (prev < 0 || prev > 2 || prev === next || Math.abs(prev - next) > 1) return next;
  const t = LOD_PX_THRESHOLDS[Math.min(prev, next)]!;
  return Math.abs(px - t) <= t * band ? (prev as LodLevel) : next;
}

/** View-space depth of a world point (positive in front of the camera); camera matrices must be current. */
export function viewDepth(camera: THREE.Camera, x: number, y: number, z: number): number {
  const e = camera.matrixWorldInverse.elements;
  return -(e[2]! * x + e[6]! * y + e[10]! * z + e[14]!);
}

const _box = new THREE.Box3();

/** Rest height (MODEL units) of a built model: top of its LOD0 geometry (welded) or of its parts. */
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
    top = Math.max(top, _box.max.y + model.rig.rest[p.bone * 3 + 1]!);
  }
  return top;
}

/** Height of a variant in MODEL units: median over its role models (headgear differs per role). */
export function variantHeight(models: readonly DwarfModel[]): number {
  const hs = models.map(modelHeight).sort((a, b) => a - b);
  if (hs.length === 0) return 0;
  const k = hs.length >> 1;
  return hs.length % 2 ? hs[k]! : (hs[k - 1]! + hs[k]!) / 2;
}

/** The same height in world tiles at the current character scale. */
export function variantHeightTiles(models: readonly DwarfModel[]): number {
  return variantHeight(models) * CHARACTER_SCALE.worldPerModel;
}
