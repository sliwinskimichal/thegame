/**
 * Material gallery for tournament #2: one block per biome (3 x 3 swatches).
 * A block holds the biome's host rocks as plain swatches and every deposit of
 * the biome as a vein inside the main host rock — exactly the pairs a player
 * has to tell apart. Every swatch has a dug notch with a torch on its back wall.
 */
import { BIOMES } from '../content/biomes';
import { Rng } from '../core/rng';
import { biomeMaterials, M } from '../world/materials';
import { CAV, PROP, TF, World } from '../world/world';
import type { ArenaInfo } from './arena';

export const SW = 10;
export const SH = 7;
const TOP = 4;
const BLOCK_W = 3 * (SW + 1) + 1;
const BLOCK_H = 3 * (SH + 1) + 1;

export interface Swatch {
  biome: string;
  kind: 'rock' | 'deposit' | 'built';
  /** Material shown (the deposit for 'deposit' swatches). */
  mat: number;
  /** Rock around a deposit (or the rock itself). */
  host: number;
  x: number;
  y: number;
}

/** Block origin (top-left tile) of biome k. */
export function blockOrigin(k: number): { x: number; y: number } {
  return { x: (k % 3) * BLOCK_W, y: TOP + Math.floor(k / 3) * BLOCK_H };
}

export const BLOCK_SIZE = { w: BLOCK_W, h: BLOCK_H };

export function galleryLayout(): Swatch[] {
  const out: Swatch[] = [];
  BIOMES.forEach((b, k) => {
    const { rocks, deposits } = biomeMaterials(b.id);
    const items: Omit<Swatch, 'x' | 'y'>[] = [
      ...rocks.map((m) => ({ biome: b.id, kind: 'rock' as const, mat: m, host: m })),
      ...deposits.map((m) => ({ biome: b.id, kind: 'deposit' as const, mat: m, host: rocks[0]! })),
    ];
    if (b.id === 'foothills') items.push({ biome: b.id, kind: 'built', mat: M.STONE_BRICK, host: M.STONE_BRICK });
    if (items.length > 9) throw new Error(`biome ${b.id}: ${items.length} swatches do not fit a block`);
    const o = blockOrigin(k);
    items.forEach((it, s) => out.push({ ...it, x: o.x + 1 + (s % 3) * (SW + 1), y: o.y + 1 + Math.floor(s / 3) * (SH + 1) }));
  });
  return out;
}

export const GALLERY_W = 3 * BLOCK_W;
export const GALLERY_H = TOP + 3 * BLOCK_H + 1;

export function buildGallery(seed = 4242): ArenaInfo & { swatches: Swatch[] } {
  const W = GALLERY_W;
  const H = GALLERY_H;
  const world = new World(W, H, seed);
  const rng = new Rng(seed);
  const { mat, bg, cav, depth, flags, surface } = world;
  for (let x = 0; x < W; x++) surface[x] = TOP;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = world.idx(x, y);
      flags[i] = TF.EXPLORED;
      if (y < TOP) {
        cav[i] = CAV.SKY;
        depth[i] = 255;
      } else {
        mat[i] = bg[i] = M.BEDROCK; // frames between swatches
        cav[i] = CAV.SOLID;
      }
    }
  const swatches = galleryLayout();
  for (const s of swatches) {
    for (let y = s.y; y < s.y + SH; y++)
      for (let x = s.x; x < s.x + SW; x++) {
        const i = world.idx(x, y);
        mat[i] = bg[i] = s.host;
        if (s.kind !== 'deposit') continue;
        // a vein: an ellipse in the upper part plus a few loose tiles
        const dx = (x + 0.5 - (s.x + 5)) / 3.4;
        const dy = (y + 0.5 - (s.y + 2)) / 1.7;
        if (dx * dx + dy * dy < 1 || (y < s.y + 3 && rng.chance(0.08))) mat[i] = s.mat;
      }
    for (let y = s.y + 4; y <= s.y + 5; y++)
      for (let x = s.x + 2; x <= s.x + 7; x++) {
        const i = world.idx(x, y);
        mat[i] = M.AIR;
        cav[i] = CAV.DUG;
        depth[i] = 32;
      }
    world.props.push({ type: PROP.TORCH, x: s.x + 4.5, y: -(s.y + 4) - 0.3, z: -0.92, scale: 1, rot: 0, attach: 'wall', anchor: world.idx(s.x + 4, s.y + 4), seed: rng.nextU32() });
  }
  const o = blockOrigin(0);
  world.mannequins = [{ x: o.x + 1 + 2 * (SW + 1) + 6.5, y: -(o.y + 1 + 5 + 1), facing: -1, pose: 'stand' }];
  return {
    world,
    swatches,
    unexplored: { x0: -1, y0: -1, x1: -1, y1: -1 },
    poi: { center: { x: W / 2, y: H / 2 } },
  };
}
