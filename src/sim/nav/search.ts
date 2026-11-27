/**
 * Shared search scratch (one per grid: searches run one at a time), a
 * lazy-deletion binary heap on typed arrays and the reusable Path buffer.
 * Nothing here allocates per query; buffers only grow when a search needs
 * more room than ever before.
 */
import type { NavGrid } from './grid';

/** Key = f * KEY_SCALE + h: smaller f first, then smaller h (closer to the goal). */
export const KEY_SCALE = 1048576;
export const H_CAP = KEY_SCALE - 1;

export class SearchScratch {
  readonly n: number;
  readonly g: Int32Array;
  readonly par: Int32Array;
  /** Move used to reach the node (or a segment code of the hierarchical search). */
  readonly pmv: Uint8Array;
  /** Link id for LINK moves. */
  readonly paux: Int32Array;
  /** 2q = opened in query q, 2q + 1 = closed in query q. */
  readonly seen: Uint32Array;
  private stamp = 0;
  hn: Int32Array = new Int32Array(4096);
  hk: Float64Array = new Float64Array(4096);
  size = 0;
  lastKey = 0;

  constructor(n: number) {
    this.n = n;
    this.g = new Int32Array(n);
    this.par = new Int32Array(n);
    this.pmv = new Uint8Array(n);
    this.paux = new Int32Array(n);
    this.seen = new Uint32Array(n);
  }

  /** Start a query: returns the OPEN stamp (CLOSED = OPEN + 1). */
  begin(): number {
    this.stamp += 2;
    if (this.stamp >= 0xfffffff0) {
      this.seen.fill(0);
      this.stamp = 2;
    }
    this.size = 0;
    return this.stamp;
  }

  push(node: number, key: number): void {
    if (this.size === this.hn.length) {
      const k = this.hn.length * 2;
      const hn = new Int32Array(k);
      hn.set(this.hn);
      const hk = new Float64Array(k);
      hk.set(this.hk);
      this.hn = hn;
      this.hk = hk;
    }
    const hn = this.hn;
    const hk = this.hk;
    let i = this.size++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hk[p] <= key) break;
      hn[i] = hn[p];
      hk[i] = hk[p];
      i = p;
    }
    hn[i] = node;
    hk[i] = key;
  }

  /** Pop the minimum; its key is left in `lastKey`. */
  pop(): number {
    const hn = this.hn;
    const hk = this.hk;
    const top = hn[0];
    this.lastKey = hk[0];
    const n = --this.size;
    if (n > 0) {
      const node = hn[n];
      const key = hk[n];
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && hk[c + 1] < hk[c]) c++;
        if (hk[c] >= key) break;
        hn[i] = hn[c];
        hk[i] = hk[c];
        i = c;
      }
      hn[i] = node;
      hk[i] = key;
    }
    return top;
  }

  bytes(): number {
    return this.g.byteLength + this.par.byteLength + this.pmv.byteLength + this.paux.byteLength + this.seen.byteLength
      + this.hn.byteLength + this.hk.byteLength;
  }
}

const SCRATCH = new WeakMap<NavGrid, SearchScratch>();

/** The scratch shared by every finder of a grid. */
export function scratchFor(grid: NavGrid): SearchScratch {
  let s = SCRATCH.get(grid);
  if (!s) {
    s = new SearchScratch(grid.n);
    SCRATCH.set(grid, s);
  }
  return s;
}

/** A planned path: node cells, the move used to enter each node and link ids. */
export class Path {
  cells: Int32Array = new Int32Array(64);
  moves: Uint8Array = new Uint8Array(64);
  links: Int32Array = new Int32Array(64);
  length = 0;
  cost = 0;
  /** Profile index and grid version the path was planned with. */
  profile = 0;
  version = 0;

  clear(): void {
    this.length = 0;
    this.cost = 0;
  }

  push(cell: number, move: number, link: number): void {
    if (this.length === this.cells.length) {
      const k = this.cells.length * 2;
      const c = new Int32Array(k);
      c.set(this.cells);
      const m = new Uint8Array(k);
      m.set(this.moves);
      const l = new Int32Array(k);
      l.set(this.links);
      this.cells = c;
      this.moves = m;
      this.links = l;
    }
    const k = this.length++;
    this.cells[k] = cell;
    this.moves[k] = move;
    this.links[k] = link;
  }

  /**
   * Reverse in place. Paths are assembled goal-first, each node together with
   * the move that entered it, so a plain reverse yields start..goal with the
   * start carrying MOVE_NONE.
   */
  reverse(): void {
    const n = this.length;
    const c = this.cells;
    const m = this.moves;
    const l = this.links;
    for (let i = 0, j = n - 1; i < j; i++, j--) {
      let t = c[i];
      c[i] = c[j];
      c[j] = t;
      t = m[i];
      m[i] = m[j];
      m[j] = t;
      t = l[i];
      l[i] = l[j];
      l[j] = t;
    }
  }

  /** Copy of the cells (tests and debugging only — allocates). */
  toArray(): number[] {
    return Array.from(this.cells.subarray(0, this.length));
  }

  last(): number {
    return this.length > 0 ? this.cells[this.length - 1] : -1;
  }
}
