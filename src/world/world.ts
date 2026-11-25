/**
 * The world grid: struct-of-arrays typed storage for every tile.
 *
 * Coordinates: tile (x, y), x to the right, y downward (y = 0 is the top of
 * the sky). In 3D, tile (x, y) spans X in [x, x+1] and Y in [-(y+1), -y].
 */
import { CONFIG } from '../config';
import { M, SOLID } from './materials';

/** Tile flag bits (World.flags). */
export const TF = {
  OUTDOOR: 1, // open to the sky (no back wall)
  NATURAL: 2, // natural cave cavity (rough, deeper back wall)
  EXPLORED: 4, // known to the player
  WET: 8, // damp tile (future: water seepage)
} as const;

/** Navigation flag bits (World.nav), set by buildings. */
export const NF = {
  LADDER: 1,
  PLATFORM: 2,
  DOOR: 4,
  BLOCKED: 8, // impassable furniture / machine
  STORAGE: 16,
} as const;

/** Designation kinds (World.desig). */
export const DG = {
  NONE: 0,
  DIG: 1,
  DIG_LADDER: 2, // dig and place a ladder (shaft tool)
} as const;

/** Fluid kinds. */
export const FL = { NONE: 0, WATER: 1, LAVA: 2 } as const;

export interface DecorInstance {
  type: number;
  /** World-space position (tile units), Z into the screen is negative. */
  x: number;
  y: number;
  z: number;
  scale: number;
  rot: number;
  /** Tile this decor is anchored to; removed when that tile changes. */
  anchor: number;
  /** Variant / colour seed. */
  seed: number;
}

export class World {
  readonly w: number;
  readonly h: number;
  readonly size: number;
  readonly seed: number;

  /** Current material of each tile (AIR = empty). */
  readonly mat: Uint8Array;
  /** Original material, used to texture back walls of dug tiles. */
  readonly bg: Uint8Array;
  /** Cavity depth of empty tiles, in 1/32 world units. */
  readonly depth: Uint8Array;
  readonly flags: Uint8Array;
  readonly nav: Uint8Array;
  /** Dig progress 0..255. */
  readonly damage: Uint8Array;
  readonly desig: Uint8Array;
  readonly fluid: Uint8Array;
  readonly fluidType: Uint8Array;
  /** Original surface row per column (first solid tile). */
  readonly surface: Int16Array;
  /** Layer index of each row (computed by worldgen). */
  readonly layerOfRow: Uint8Array;

  decor: DecorInstance[] = [];
  spawnX = 0;
  spawnY = 0;

  // --- change tracking -------------------------------------------------
  readonly chunksW: number;
  readonly chunksH: number;
  /** Chunks whose geometry must be rebuilt. */
  readonly dirtyChunks = new Set<number>();
  /** Tiles changed since the last light/texture sync. */
  lightDirty = true;
  stateDirty = true;
  fogDirty = true;
  /** Bounding box of tile changes since last sync (for partial uploads). */
  changeMinX = Infinity;
  changeMinY = Infinity;
  changeMaxX = -Infinity;
  changeMaxY = -Infinity;
  /** Bumped every time a tile's solidity/nav changes (path caches). */
  navVersion = 0;

  constructor(w: number, h: number, seed: number) {
    this.w = w;
    this.h = h;
    this.size = w * h;
    this.seed = seed;
    this.mat = new Uint8Array(this.size);
    this.bg = new Uint8Array(this.size);
    this.depth = new Uint8Array(this.size);
    this.flags = new Uint8Array(this.size);
    this.nav = new Uint8Array(this.size);
    this.damage = new Uint8Array(this.size);
    this.desig = new Uint8Array(this.size);
    this.fluid = new Uint8Array(this.size);
    this.fluidType = new Uint8Array(this.size);
    this.surface = new Int16Array(w);
    this.layerOfRow = new Uint8Array(h);
    this.chunksW = Math.ceil(w / CONFIG.chunk);
    this.chunksH = Math.ceil(h / CONFIG.chunk);
  }

  idx(x: number, y: number): number {
    return y * this.w + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  /** Is the tile solid? Out-of-bounds counts as solid below the surface. */
  isSolid(x: number, y: number): boolean {
    if (x < 0 || x >= this.w || y >= this.h) return y >= this.surface[x < 0 ? 0 : this.w - 1]!;
    if (y < 0) return false;
    return SOLID[this.mat[y * this.w + x]!] === 1;
  }

  isExplored(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    return (this.flags[y * this.w + x]! & TF.EXPLORED) !== 0;
  }

  isOutdoor(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return y < 0;
    return (this.flags[y * this.w + x]! & TF.OUTDOOR) !== 0;
  }

  /** Mark a tile's chunk (and neighbours when on a border) for re-meshing. */
  markTile(x: number, y: number): void {
    const c = CONFIG.chunk;
    const cx = Math.floor(x / c);
    const cy = Math.floor(y / c);
    this.markChunk(cx, cy);
    const lx = x - cx * c;
    const ly = y - cy * c;
    if (lx === 0) this.markChunk(cx - 1, cy);
    if (lx === c - 1) this.markChunk(cx + 1, cy);
    if (ly === 0) this.markChunk(cx, cy - 1);
    if (ly === c - 1) this.markChunk(cx, cy + 1);
    if (x < this.changeMinX) this.changeMinX = x;
    if (y < this.changeMinY) this.changeMinY = y;
    if (x > this.changeMaxX) this.changeMaxX = x;
    if (y > this.changeMaxY) this.changeMaxY = y;
  }

  markChunk(cx: number, cy: number): void {
    if (cx < 0 || cy < 0 || cx >= this.chunksW || cy >= this.chunksH) return;
    this.dirtyChunks.add(cy * this.chunksW + cx);
  }

  markAllDirty(): void {
    for (let i = 0; i < this.chunksW * this.chunksH; i++) this.dirtyChunks.add(i);
    this.lightDirty = this.stateDirty = this.fogDirty = true;
    this.changeMinX = 0;
    this.changeMinY = 0;
    this.changeMaxX = this.w - 1;
    this.changeMaxY = this.h - 1;
  }

  resetChangeBox(): void {
    this.changeMinX = this.changeMinY = Infinity;
    this.changeMaxX = this.changeMaxY = -Infinity;
  }

  /**
   * Remove a solid tile (digging). Returns the removed material.
   * The cavity gets a shallow "dug" depth; natural caves keep their own.
   */
  dig(x: number, y: number): number {
    const i = this.idx(x, y);
    const m = this.mat[i]!;
    if (m === M.AIR) return M.AIR;
    this.mat[i] = M.AIR;
    this.damage[i] = 0;
    this.desig[i] = 0;
    // Dug tunnels: 1 unit deep, slightly deeper if next to a natural cave.
    this.depth[i] = 32;
    this.flags[i] = this.flags[i]! & ~TF.NATURAL;
    // Removing a tile reveals neighbours.
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) this.reveal(x + dx, y + dy);
    this.removeDecorAnchoredNear(x, y);
    this.touch(x, y);
    return m;
  }

  /** Place a solid tile (e.g. constructed wall). */
  place(x: number, y: number, m: number): void {
    const i = this.idx(x, y);
    this.mat[i] = m;
    this.damage[i] = 0;
    this.removeDecorAnchoredNear(x, y);
    this.touch(x, y);
  }

  /** Invalidate everything derived from tile (x, y). */
  touch(x: number, y: number): void {
    this.markTile(x, y);
    this.lightDirty = true;
    this.stateDirty = true;
    this.fogDirty = true;
    this.navVersion++;
  }

  reveal(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    const i = this.idx(x, y);
    if (this.flags[i]! & TF.EXPLORED) return false;
    this.flags[i] = this.flags[i]! | TF.EXPLORED;
    this.markTile(x, y);
    this.fogDirty = true;
    return true;
  }

  removeDecorAnchoredNear(x: number, y: number): void {
    if (this.decor.length === 0) return;
    const a = this.idx(x, y);
    const before = this.decor.length;
    this.decor = this.decor.filter((d) => d.anchor !== a);
    if (this.decor.length !== before) this.decorVersion++;
  }

  decorVersion = 0;

  /** Cavity depth of tile in world units (0 for solid). */
  cavityDepth(i: number): number {
    return this.depth[i]! / 32;
  }
}
