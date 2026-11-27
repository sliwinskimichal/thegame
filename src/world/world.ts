/**
 * World grid: struct-of-arrays storage for every tile, plus static props and
 * static light sources. Pure data — no rendering or simulation logic.
 *
 * Coordinates: tile (x, y), x to the right, y downward (row 0 = top of sky).
 * In 3D a tile (x, y) spans X in [x, x+1] and Y in [-(y+1), -y].
 */
import { M, SOLID } from './materials';

/** Kind of open space for non-solid tiles. */
export const CAV = { SOLID: 0, SKY: 1, DUG: 2, NATURAL: 3 } as const;
export const FLUID = { NONE: 0, WATER: 1, LAVA: 2 } as const;
export const TF = { EXPLORED: 1 } as const;

export const PROP = {
  PINE: 0,
  BIRCH: 1,
  BUSH: 2,
  GRASS: 3,
  FLOWER: 4,
  BOULDER: 5,
  STALACTITE: 6,
  STALAGMITE: 7,
  GLOW_SHROOM: 8,
  GIANT_SHROOM: 9,
  CRYSTAL_CLUSTER: 10,
  ROOTS: 11,
  BONES: 12,
  TORCH: 13,
} as const;
export const PROP_COUNT = 14;

/** Light that props emit into the light field (linear RGB). */
export const PROP_GLOW: Partial<Record<number, readonly [number, number, number]>> = {
  [PROP.GLOW_SHROOM]: [0.05, 0.4, 0.32],
  [PROP.GIANT_SHROOM]: [0.12, 0.3, 0.45],
  [PROP.CRYSTAL_CLUSTER]: [0.15, 0.5, 0.9],
  [PROP.TORCH]: [2.6, 1.35, 0.5],
};

export interface Prop {
  type: number;
  /** World-space position (tile units; Y up, Z toward the viewer). */
  x: number;
  y: number;
  z: number;
  scale: number;
  rot: number;
  /** 'floor' | 'ceiling' | 'wall' | 'ground' attachment. */
  attach: 'floor' | 'ceiling' | 'wall' | 'ground';
  /** Tile index whose removal removes this prop. */
  anchor: number;
  seed: number;
}

export interface Mannequin {
  /** Placeholder character used by the lab to judge readability. */
  x: number;
  y: number;
  facing: 1 | -1;
  pose: 'stand' | 'dig' | 'walk';
}

const CHANGE_RING = 1 << 14;

/** Tile row a prop stands in (floor/ground props sit on the top edge of the tile below them). */
export function propTileY(p: Prop): number {
  return Math.floor(-p.y + (p.attach === 'floor' || p.attach === 'ground' ? -0.01 : 0.01));
}

export class World {
  readonly w: number;
  readonly h: number;
  readonly size: number;
  readonly seed: number;
  readonly mat: Uint8Array;
  /** Back-wall material of open tiles (the rock that was dug / surrounds the cave). */
  readonly bg: Uint8Array;
  readonly cav: Uint8Array;
  /** Depth of the cavity behind an open tile, 1/32 world units. */
  readonly depth: Uint8Array;
  readonly fluid: Uint8Array;
  readonly fluidKind: Uint8Array;
  readonly flags: Uint8Array;
  /**
   * Open state a filled tile returns to when it is dug again: the cavity kind it had before `fill`
   * (0 = virgin rock, which becomes CAV.DUG) and that cavity's depth. Keeps fill + dig lossless (BUG-003).
   */
  readonly baseCav: Uint8Array;
  readonly baseDepth: Uint8Array;
  /** First solid row of each column at generation time. */
  readonly surface: Int16Array;
  props: Prop[] = [];
  mannequins: Mannequin[] = [];

  /** Monotonic counters; consumers compare to detect changes. */
  terrainVersion = 0;
  fogVersion = 0;
  propVersion = 0;
  fluidVersion = 0;
  /** Ring buffer of changed tile indices (for incremental consumers). */
  private readonly ring = new Int32Array(CHANGE_RING);
  changeCount = 0;

  constructor(w: number, h: number, seed = 1) {
    this.w = w;
    this.h = h;
    this.size = w * h;
    this.seed = seed;
    this.mat = new Uint8Array(this.size);
    this.bg = new Uint8Array(this.size);
    this.cav = new Uint8Array(this.size);
    this.depth = new Uint8Array(this.size);
    this.fluid = new Uint8Array(this.size);
    this.fluidKind = new Uint8Array(this.size);
    this.flags = new Uint8Array(this.size);
    this.baseCav = new Uint8Array(this.size);
    this.baseDepth = new Uint8Array(this.size);
    this.surface = new Int16Array(w);
  }

  idx(x: number, y: number): number {
    return y * this.w + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  isSolid(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return y >= 0;
    return SOLID[this.mat[y * this.w + x]!] === 1;
  }

  isExplored(x: number, y: number): boolean {
    return this.inBounds(x, y) && (this.flags[y * this.w + x]! & TF.EXPLORED) !== 0;
  }

  /** Record a change to tile i for incremental consumers. */
  private log(i: number): void {
    this.ring[this.changeCount & (CHANGE_RING - 1)] = i;
    this.changeCount++;
  }

  /**
   * Visit tiles changed since `since` (a previous changeCount). Returns false
   * when the ring overflowed and the consumer must rebuild everything.
   */
  changesSince(since: number, fn: (i: number) => void): boolean {
    if (this.changeCount - since > CHANGE_RING) return false;
    for (let k = since; k < this.changeCount; k++) fn(this.ring[k & (CHANGE_RING - 1)]!);
    return true;
  }

  /**
   * Dig out a solid tile. Returns the removed material (AIR if none). Raw primitive without a pick-tier
   * gate; the simulation mutates tiles only through `src/sim/world/mutate.ts`.
   */
  dig(x: number, y: number): number {
    if (!this.inBounds(x, y)) return M.AIR;
    const i = this.idx(x, y);
    const m = this.mat[i]!;
    if (!SOLID[m]) return M.AIR;
    this.mat[i] = M.AIR;
    if (this.cav[i] === CAV.SOLID) {
      // a filled tile gets back the open state it had (sky stays sky, a cave keeps its depth)
      const base = this.baseCav[i]!;
      this.cav[i] = base || CAV.DUG;
      this.depth[i] = base ? this.baseDepth[i]! : 32;
      this.baseCav[i] = 0;
      this.baseDepth[i] = 0;
    }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) this.reveal(x + dx, y + dy);
    this.removeProps(i, false);
    this.terrainVersion++;
    this.log(i);
    return m;
  }

  /**
   * Fill an open tile with a solid material (construction, rubble). Refuses tiles outside the grid,
   * non-solid materials and tiles that are already solid, so a tile is always either solid
   * (`cav = SOLID`, depth 0, no fluid) or open. Clears the fluid (amount and kind), remembers the open
   * state for a later `dig` and removes props anchored to the tile or standing inside it (BUG-003).
   * Returns whether the tile changed.
   */
  fill(x: number, y: number, m: number): boolean {
    if (!this.inBounds(x, y) || SOLID[m] !== 1) return false;
    const i = this.idx(x, y);
    if (SOLID[this.mat[i]!] === 1) return false;
    const c = this.cav[i]!;
    this.baseCav[i] = c === CAV.SOLID ? CAV.DUG : c;
    this.baseDepth[i] = c === CAV.SOLID ? 32 : this.depth[i]!;
    this.mat[i] = m;
    this.cav[i] = CAV.SOLID;
    this.depth[i] = 0;
    if (this.fluid[i] || this.fluidKind[i]) {
      this.fluid[i] = 0;
      this.fluidKind[i] = FLUID.NONE;
      this.fluidVersion++;
    }
    this.removeProps(i, true);
    this.terrainVersion++;
    this.log(i);
    return true;
  }

  /**
   * Set the fluid of an open tile. Amount 0 or kind NONE empty it (both fields together); solid tiles
   * never hold fluid. Returns whether the tile changed.
   */
  setFluid(x: number, y: number, kind: number, amount: number): boolean {
    if (!this.inBounds(x, y) || (kind !== FLUID.NONE && kind !== FLUID.WATER && kind !== FLUID.LAVA)) return false;
    const i = this.idx(x, y);
    const a = kind === FLUID.NONE || !(amount > 0) ? 0 : Math.min(255, Math.max(1, Math.round(amount)));
    const k = a === 0 ? FLUID.NONE : kind;
    if (a > 0 && SOLID[this.mat[i]!] === 1) return false;
    if (this.fluid[i] === a && this.fluidKind[i] === k) return false;
    this.fluid[i] = a;
    this.fluidKind[i] = k;
    this.fluidVersion++;
    this.log(i);
    return true;
  }

  reveal(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    const i = this.idx(x, y);
    if (this.flags[i]! & TF.EXPLORED) return false;
    this.flags[i] = this.flags[i]! | TF.EXPLORED;
    this.fogVersion++;
    this.log(i);
    return true;
  }

  removePropsAnchoredTo(i: number): void {
    this.removeProps(i, false);
  }

  /** Remove props anchored to tile i (and, with `inside`, props standing in it); in place, no allocation. */
  private removeProps(i: number, inside: boolean): void {
    const props = this.props;
    const tx = i % this.w;
    const ty = (i - tx) / this.w;
    let k = 0;
    for (let j = 0; j < props.length; j++) {
      const p = props[j]!;
      if (p.anchor === i || (inside && Math.floor(p.x) === tx && propTileY(p) === ty)) continue;
      props[k++] = p;
    }
    if (k !== props.length) {
      props.length = k;
      this.propVersion++;
    }
  }
}
