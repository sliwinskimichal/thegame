/**
 * Precomputed jump distances ("JPS+-like" shortcuts) for one profile.
 *
 * In the gravity graph long horizontal galleries and ladder shafts are runs of
 * cells whose only moves continue the run. A search may jump from a run's
 * start straight to the next cell where anything else can happen (a side
 * exit, a drop, a ladder, a cost change, a link) without losing optimality:
 * intermediate cells have no other outgoing moves and share one step cost.
 *
 * jr[i] = steps walking right from i to the next stop cell (0 = cannot walk right);
 * jl, ju (climb up), jd (climb down) likewise. Capped at 255 (a capped target
 * is an ordinary node and the run continues from it).
 *
 * Updated locally: every changed cell recomputes its row (jl, jr) and its
 * column (ju, jd) — O(w + h) per changed cell, deduplicated per batch.
 */
import type { NavGrid, NavListener } from './grid';
import { BIT } from './types';

export class JumpTables implements NavListener {
  readonly grid: NavGrid;
  readonly profile: number;
  readonly jl: Uint8Array;
  readonly jr: Uint8Array;
  readonly ju: Uint8Array;
  readonly jd: Uint8Array;
  private readonly rowMark: Uint32Array;
  private readonly colMark: Uint32Array;
  private stamp = 0;

  constructor(grid: NavGrid, profile = 0) {
    this.grid = grid;
    this.profile = profile;
    this.jl = new Uint8Array(grid.n);
    this.jr = new Uint8Array(grid.n);
    this.ju = new Uint8Array(grid.n);
    this.jd = new Uint8Array(grid.n);
    this.rowMark = new Uint32Array(grid.h);
    this.colMark = new Uint32Array(grid.w);
    this.navRebuilt();
    grid.addListener(this);
  }

  dispose(): void {
    this.grid.removeListener(this);
  }

  navRebuilt(): void {
    for (let y = 0; y < this.grid.h; y++) this.row(y);
    for (let x = 0; x < this.grid.w; x++) this.col(x);
  }

  navChanged(cells: Int32Array, count: number): void {
    const s = ++this.stamp;
    const W = this.grid.w;
    for (let q = 0; q < count; q++) {
      const c = cells[q];
      const x = c % W;
      const y = (c - x) / W;
      if (this.rowMark[y] !== s) {
        this.rowMark[y] = s;
        this.row(y);
      }
      if (this.colMark[x] !== s) {
        this.colMark[x] = s;
        this.col(x);
      }
    }
  }

  private row(y: number): void {
    const W = this.grid.w;
    const mask = this.grid.mask[this.profile];
    const mul = this.grid.mul[this.profile];
    const b = y * W;
    const jr = this.jr;
    const jl = this.jl;
    jr[b + W - 1] = 0;
    for (let x = W - 2; x >= 0; x--) {
      const i = b + x;
      if (!(mask[i] & BIT.WALK_R)) {
        jr[i] = 0;
        continue;
      }
      const j = i + 1;
      const plain = (mask[j] & ~BIT.WALKS) === 0 && (mask[j] & BIT.WALK_R) !== 0 && mul[j + 1] === mul[j];
      jr[i] = plain ? Math.min(255, jr[j] + 1) : 1;
    }
    jl[b] = 0;
    for (let x = 1; x < W; x++) {
      const i = b + x;
      if (!(mask[i] & BIT.WALK_L)) {
        jl[i] = 0;
        continue;
      }
      const j = i - 1;
      const plain = (mask[j] & ~BIT.WALKS) === 0 && (mask[j] & BIT.WALK_L) !== 0 && mul[j - 1] === mul[j];
      jl[i] = plain ? Math.min(255, jl[j] + 1) : 1;
    }
  }

  private col(x: number): void {
    const W = this.grid.w;
    const H = this.grid.h;
    const mask = this.grid.mask[this.profile];
    const mul = this.grid.mul[this.profile];
    const ju = this.ju;
    const jd = this.jd;
    for (let y = 0; y < H; y++) {
      const i = y * W + x;
      if (!(mask[i] & BIT.UP)) {
        ju[i] = 0;
        continue;
      }
      const j = i - W;
      const plain = (mask[j] & ~BIT.CLIMBS) === 0 && (mask[j] & BIT.UP) !== 0 && mul[j - W] === mul[j];
      ju[i] = plain ? Math.min(255, ju[j] + 1) : 1;
    }
    for (let y = H - 1; y >= 0; y--) {
      const i = y * W + x;
      if (!(mask[i] & BIT.DOWN)) {
        jd[i] = 0;
        continue;
      }
      const j = i + W;
      const plain = (mask[j] & ~BIT.CLIMBS) === 0 && (mask[j] & BIT.DOWN) !== 0 && mul[j + W] === mul[j];
      jd[i] = plain ? Math.min(255, jd[j] + 1) : 1;
    }
  }

  bytes(): number {
    return this.jl.byteLength * 4 + this.rowMark.byteLength + this.colMark.byteLength;
  }
}
