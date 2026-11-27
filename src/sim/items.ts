/**
 * Items lying in the world (F2-3 stage 2): piles of one resource on one tile, at most the resource's
 * stack size per pile (several piles may share a tile). Piles fall to the floor; a pile whose tile
 * becomes solid is buried and comes back when the tile is dug out. Haul and build jobs reserve units
 * of a pile before walking to it, so two dwarves never count on the same units.
 * SoA with a free list; per-tile singly linked lists (`head`, `next`).
 */
import { RESOURCES } from '../content/resources';
import { SOLID } from '../world/materials';
import type { World } from '../world/world';
import type { SimBus, TileChanged } from './events';
import { rleDecode, rleEncode } from './world/snapshot';

export const RES_IDS: readonly string[] = RESOURCES.map((r) => r.id);
const RES_INDEX = new Map(RES_IDS.map((id, k) => [id, k]));
const RES_STACK = Uint16Array.from(RESOURCES, (r) => Math.max(1, Math.min(65535, r.stack)));

/** Index of a resource id (throws for unknown ids: a typo must not silently create nothing). */
export function resourceIndex(id: string): number {
  const k = RES_INDEX.get(id);
  if (k === undefined) throw new Error(`items: unknown resource ${id}`);
  return k;
}

export const stackOf = (item: number): number => RES_STACK[item]!;

export interface PilesSave {
  v: 1;
  arrays: Record<'tile' | 'item' | 'count' | 'reserved' | 'next', number[]>;
  head: number[];
  free: number[];
  hi: number;
}

const ARRAYS = ['tile', 'item', 'count', 'reserved', 'next'] as const;

export class ItemPiles {
  readonly cap: number;
  readonly tile: Int32Array;
  readonly item: Uint16Array;
  readonly count: Uint16Array;
  readonly reserved: Uint16Array;
  /** Next pile on the same tile + 1 (0 = end). */
  readonly next: Int32Array;
  /** First pile of each tile + 1 (0 = none). */
  private readonly head: Int32Array;
  private readonly free: Int32Array;
  private freeTop = 0;
  private hi = 0;
  /** Bumped on every change (render, UI). */
  version = 0;

  constructor(
    readonly world: World,
    readonly bus: SimBus,
    cap = 16384,
  ) {
    this.cap = cap;
    this.tile = new Int32Array(cap).fill(-1);
    this.item = new Uint16Array(cap);
    this.count = new Uint16Array(cap);
    this.reserved = new Uint16Array(cap);
    this.next = new Int32Array(cap);
    this.head = new Int32Array(world.size);
    this.free = new Int32Array(cap);
    for (let p = cap - 1; p >= 0; p--) this.free[this.freeTop++] = p;
    bus.on('tileChanged', (e) => this.onTileChanged(e));
  }

  /** First pile on tile i, or -1. */
  first(i: number): number {
    return this.head[i]! - 1;
  }

  nextOf(p: number): number {
    return this.next[p]! - 1;
  }

  /** Content id of a resource index. */
  itemId(item: number): string {
    return RES_IDS[item]!;
  }

  /** Units of pile p not reserved by a job. */
  available(p: number): number {
    return this.count[p]! - this.reserved[p]!;
  }

  /** Units on tile i (all piles). */
  unitsAt(i: number): number {
    let n = 0;
    for (let p = this.first(i); p >= 0; p = this.nextOf(p)) n += this.count[p]!;
    return n;
  }

  /** Live piles (one past the highest slot ever used; dead slots have tile -1). */
  get span(): number {
    return this.hi;
  }

  /**
   * Put `n` units of `item` at (x, y): they fall to the floor first, then merge into piles of the same
   * item there up to the stack size; overflow makes new piles. Returns the landing tile or -1.
   */
  drop(x: number, y: number, item: number, n: number): number {
    const w = this.world;
    if (!w.inBounds(x, y) || n <= 0) return -1;
    let i = y * w.w + x;
    if (SOLID[w.mat[i]!]) return -1;
    while (i + w.w < w.size && !SOLID[w.mat[i + w.w]!]) i += w.w;
    let left = n;
    const stack = RES_STACK[item]!;
    for (let p = this.first(i); p >= 0 && left > 0; p = this.nextOf(p)) {
      if (this.item[p] !== item || this.count[p]! >= stack) continue;
      const k = Math.min(left, stack - this.count[p]!);
      this.count[p] = this.count[p]! + k;
      left -= k;
    }
    while (left > 0 && this.freeTop > 0) {
      const k = Math.min(left, stack);
      this.link(this.free[--this.freeTop]!, i, item, k);
      left -= k;
    }
    this.version++;
    if (n - left > 0) this.bus.emit('itemsDropped', { i, x: i % w.w, y: Math.floor(i / w.w), item: RES_IDS[item]!, n: n - left });
    return i;
  }

  reserve(p: number, n: number): number {
    const k = Math.max(0, Math.min(n, this.available(p)));
    this.reserved[p] = this.reserved[p]! + k;
    return k;
  }

  unreserve(p: number, n: number): void {
    this.reserved[p] = Math.max(0, this.reserved[p]! - n);
  }

  /** Remove `n` reserved units of pile p (a dwarf picks them up). Returns the units taken. */
  take(p: number, n: number, dwarf: number): number {
    if (this.tile[p]! < 0) return 0;
    const k = Math.min(n, this.count[p]!);
    this.count[p] = this.count[p]! - k;
    this.reserved[p] = Math.max(0, this.reserved[p]! - k);
    const i = this.tile[p]!;
    const item = this.item[p]!;
    if (this.count[p] === 0) this.unlink(p);
    this.version++;
    if (k > 0) this.bus.emit('itemsPicked', { i, item: RES_IDS[item]!, n: k, dwarf });
    return k;
  }

  /** Total units of `item` on tiles accepted by `where` (all tiles when omitted). */
  total(item: number, where?: (i: number) => boolean): number {
    let n = 0;
    for (let p = 0; p < this.hi; p++) if (this.tile[p]! >= 0 && this.item[p] === item && (!where || where(this.tile[p]!))) n += this.count[p]!;
    return n;
  }

  save(): PilesSave {
    const arrays = {} as PilesSave['arrays'];
    for (const k of ARRAYS) arrays[k] = rleEncode(this[k]);
    return { v: 1, arrays, head: rleEncode(this.head), free: Array.from(this.free.subarray(0, this.freeTop)), hi: this.hi };
  }

  load(s: PilesSave): void {
    if (s.v !== 1) throw new Error(`piles save v${s.v}: unsupported`);
    for (const k of ARRAYS) rleDecode(s.arrays[k], this[k]);
    rleDecode(s.head, this.head);
    this.free.set(s.free);
    this.freeTop = s.free.length;
    this.hi = s.hi;
    this.version++;
  }

  private link(p: number, i: number, item: number, n: number): void {
    if (p >= this.hi) this.hi = p + 1;
    this.tile[p] = i;
    this.item[p] = item;
    this.count[p] = n;
    this.reserved[p] = 0;
    this.next[p] = this.head[i]!;
    this.head[i] = p + 1;
  }

  private unlink(p: number): void {
    const i = this.tile[p]!;
    let q = this.head[i]! - 1;
    if (q === p) this.head[i] = this.next[p]!;
    else
      while (q >= 0) {
        const nq = this.next[q]! - 1;
        if (nq === p) {
          this.next[q] = this.next[p]!;
          break;
        }
        q = nq;
      }
    this.tile[p] = -1;
    this.next[p] = 0;
    this.count[p] = 0;
    this.reserved[p] = 0;
    this.free[this.freeTop++] = p;
  }

  /** Move every pile of tile i to the floor below it (its floor was dug away). */
  private fall(i: number): void {
    const w = this.world;
    let j = i;
    while (j + w.w < w.size && !SOLID[w.mat[j + w.w]!]) j += w.w;
    if (j === i) return;
    for (let p = this.first(i); p >= 0; ) {
      const nx = this.nextOf(p);
      // relink p from tile i to tile j (keeps its index, so reservations stay valid)
      this.head[i] = this.next[p]!;
      this.tile[p] = j;
      this.next[p] = this.head[j]!;
      this.head[j] = p + 1;
      p = nx;
    }
    this.version++;
  }

  private onTileChanged(e: TileChanged): void {
    const w = this.world;
    if (SOLID[e.after]) {
      if (this.head[e.i]) this.version++; // buried piles stop counting as available
      for (let p = this.first(e.i); p >= 0; p = this.nextOf(p)) this.bus.emit('itemsBuried', { i: e.i, item: RES_IDS[this.item[p]!]!, n: this.count[p]! });
      return;
    }
    // opened: piles on this (dug-out) tile and piles standing on it from above fall down
    if (this.head[e.i]) {
      this.version++;
      this.fall(e.i);
    }
    if (e.y > 0 && this.head[e.i - w.w]) this.fall(e.i - w.w);
  }
}
