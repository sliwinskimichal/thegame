/**
 * World save/load (E1, E20): every SoA tile array run-length encoded into plain JSON-safe numbers,
 * plus props. Versions and the change ring are runtime state: after a load consumers rebuild fully.
 */
import { World, type Prop } from '../../world/world';

export const WORLD_SAVE_VERSION = 1;

export interface WorldSave {
  v: number;
  w: number;
  h: number;
  seed: number;
  /** RLE (value, run, value, run, ...) of each tile array. */
  tiles: Record<TileArray, number[]>;
  surface: number[];
  props: Prop[];
}

const TILE_ARRAYS = ['mat', 'bg', 'cav', 'depth', 'fluid', 'fluidKind', 'flags', 'baseCav', 'baseDepth'] as const;
type TileArray = (typeof TILE_ARRAYS)[number];

/** Run-length encode a typed array as [value, run, value, run, ...]. */
export function rleEncode(a: ArrayLike<number>): number[] {
  const out: number[] = [];
  let i = 0;
  while (i < a.length) {
    const v = a[i]!;
    let j = i + 1;
    while (j < a.length && a[j] === v) j++;
    out.push(v, j - i);
    i = j;
  }
  return out;
}

/** Decode `rle` into `out`; throws when the runs do not cover `out` exactly. */
export function rleDecode(rle: readonly number[], out: { length: number; [i: number]: number }): void {
  let k = 0;
  for (let j = 0; j < rle.length; j += 2) {
    const v = rle[j]!;
    const n = rle[j + 1]!;
    if (!(n > 0) || k + n > out.length) throw new Error(`rle: bad run ${n} at ${k}/${out.length}`);
    for (let e = k + n; k < e; k++) out[k] = v;
  }
  if (k !== out.length) throw new Error(`rle: covers ${k} of ${out.length}`);
}

export function saveWorld(w: World): WorldSave {
  const tiles = {} as Record<TileArray, number[]>;
  for (const k of TILE_ARRAYS) tiles[k] = rleEncode(w[k]);
  return { v: WORLD_SAVE_VERSION, w: w.w, h: w.h, seed: w.seed, tiles, surface: Array.from(w.surface), props: w.props.map((p) => ({ ...p })) };
}

export function loadWorld(s: WorldSave): World {
  if (s.v !== WORLD_SAVE_VERSION) throw new Error(`world save v${s.v}: unsupported (expected v${WORLD_SAVE_VERSION})`);
  const w = new World(s.w, s.h, s.seed);
  for (const k of TILE_ARRAYS) rleDecode(s.tiles[k], w[k]);
  if (s.surface.length !== w.w) throw new Error('world save: surface length');
  w.surface.set(s.surface);
  w.props = s.props.map((p) => ({ ...p }));
  return w;
}

/** FNV-1a over 32-bit words, folded into an existing hash. */
export function hashWords(h: number, a: ArrayLike<number>): number {
  for (let i = 0; i < a.length; i++) {
    h ^= a[i]! | 0;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Hash of the full tile state and props (determinism tests, desync hunting). */
export function hashWorld(w: World, h = 0x811c9dc5): number {
  for (const k of TILE_ARRAYS) h = hashWords(h, w[k]);
  for (const p of w.props) h = hashWords(h, [p.type, p.anchor, p.seed, Math.round(p.x * 1024), Math.round(p.y * 1024)]);
  return h;
}
