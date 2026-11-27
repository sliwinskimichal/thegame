/**
 * A* over the NavGrid edge masks, optionally with precomputed jumps along
 * horizontal galleries and ladder shafts (JPS+-like, see jump.ts) and an
 * optional heuristic weight (weighted A*: faster, bounded-suboptimal).
 *
 * Multi-goal: the search stops at the first goal popped; the heuristic is the
 * distance to the goals' bounding box (still admissible). Zero allocation per
 * query: shared scratch, reusable output Path.
 */
import type { NavGrid } from './grid';
import { JumpTables } from './jump';
import { H_CAP, KEY_SCALE, scratchFor, type Path, type SearchScratch } from './search';
import { BIT, MOVE_NONE, MV, NAV } from './types';

export interface FindOptions {
  /** Give up after this many node expansions (status BUDGET). */
  maxExpansions?: number;
}

export interface PathFinder {
  readonly name: string;
  readonly profile: number;
  readonly grid: NavGrid;
  /** Nodes expanded by the last query (all levels). */
  expanded: number;
  /** Plan from `start` to the nearest of `goals`. Returns a `NAV` status; fills `out` on FOUND. */
  find(start: number, goals: ArrayLike<number>, out: Path, opts?: FindOptions): number;
  /** Bytes owned by this finder (shared scratch excluded). */
  bytes(): number;
  dispose(): void;
}

export interface AStarOptions {
  /** Heuristic weight (1 = optimal A*). */
  weight?: number;
  /** Use jump tables along runs. */
  jumps?: boolean;
  name?: string;
}

const MAX_JUMP_GOALS = 16;

export class AStar implements PathFinder {
  readonly name: string;
  readonly grid: NavGrid;
  readonly profile: number;
  expanded = 0;
  private readonly s: SearchScratch;
  private readonly jt: JumpTables | null;
  private readonly weight: number;
  private goals = new Int32Array(16);
  private goalCount = 0;
  private gx0 = 0;
  private gx1 = 0;
  private gy0 = 0;
  private gy1 = 0;

  constructor(grid: NavGrid, profile = 0, opts: AStarOptions = {}) {
    this.grid = grid;
    this.profile = profile;
    this.weight = opts.weight ?? 1;
    this.jt = opts.jumps ? new JumpTables(grid, profile) : null;
    this.name = opts.name ?? (opts.jumps ? 'A*+skoki' : this.weight !== 1 ? `A* w=${this.weight}` : 'A*');
    this.s = scratchFor(grid);
  }

  dispose(): void {
    this.jt?.dispose();
  }

  bytes(): number {
    return (this.jt ? this.jt.bytes() : 0) + this.goals.byteLength;
  }

  /** Copy standable goals and their bounding box; returns their count. */
  private setGoals(goals: ArrayLike<number>): number {
    const g = this.grid;
    if (this.goals.length < goals.length) this.goals = new Int32Array(goals.length);
    let n = 0;
    let x0 = g.w;
    let x1 = -1;
    let y0 = g.h;
    let y1 = -1;
    for (let k = 0; k < goals.length; k++) {
      const c = goals[k];
      if (!g.standable(this.profile, c)) continue;
      this.goals[n++] = c;
      const x = c % g.w;
      const y = (c - x) / g.w;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    this.goalCount = n;
    this.gx0 = x0;
    this.gx1 = x1;
    this.gy0 = y0;
    this.gy1 = y1;
    return n;
  }

  private h(v: number): number {
    const W = this.grid.w;
    const x = v % W;
    const y = (v - x) / W;
    const p = this.profile;
    const dx = x < this.gx0 ? this.gx0 - x : x > this.gx1 ? x - this.gx1 : 0;
    let hv = this.grid.hA[p] * dx;
    if (y > this.gy1) hv += this.grid.hUp[p] * (y - this.gy1);
    else if (y < this.gy0) hv += this.grid.hDown[p] * (this.gy0 - y);
    if (this.weight !== 1) hv = Math.floor(hv * this.weight);
    return hv > H_CAP ? H_CAP : hv;
  }

  private isGoal(v: number): boolean {
    const gs = this.goals;
    for (let k = 0; k < this.goalCount; k++) if (gs[k] === v) return true;
    return false;
  }

  /** First goal strictly after `from` (exclusive) up to `to` (inclusive) along a run, or -1. */
  private goalOnRun(from: number, to: number, step: number): number {
    const gs = this.goals;
    let best = -1;
    let bestD = Infinity;
    const W = this.grid.w;
    const vertical = step === W || step === -W;
    for (let k = 0; k < this.goalCount; k++) {
      const c = gs[k];
      const d = (c - from) / step;
      if (d <= 0 || d > (to - from) / step || d !== Math.floor(d)) continue;
      // a horizontal run must stay on one row
      if (!vertical && Math.floor(c / W) !== Math.floor(from / W)) continue;
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  find(start: number, goals: ArrayLike<number>, out: Path, opts: FindOptions = {}): number {
    const grid = this.grid;
    grid.sync();
    const p = this.profile;
    this.expanded = 0;
    out.clear();
    out.profile = p;
    out.version = grid.version;
    if (!grid.standable(p, start)) return NAV.INVALID_START;
    if (this.setGoals(goals) === 0) return NAV.INVALID_GOAL;
    const maxExp = opts.maxExpansions ?? Infinity;
    const s = this.s;
    const { g, par, pmv, paux, seen } = s;
    const mask = grid.mask[p];
    const drop = grid.drop[p];
    const mul = grid.mul[p];
    const base = grid.base[p];
    const perRow = grid.perRow[p];
    const W = grid.w;
    const jt = this.jt !== null && this.goalCount <= MAX_JUMP_GOALS ? this.jt : null;
    const OPEN = s.begin();
    const CLOSED = OPEN + 1;
    seen[start] = OPEN;
    g[start] = 0;
    par[start] = -1;
    pmv[start] = MOVE_NONE;
    paux[start] = -1;
    const hs = this.h(start);
    s.push(start, hs * KEY_SCALE + hs);
    while (s.size > 0) {
      const u = s.pop();
      if (seen[u] === CLOSED) continue;
      seen[u] = CLOSED;
      if (this.isGoal(u)) {
        this.reconstruct(u, out);
        return NAV.FOUND;
      }
      if (++this.expanded > maxExp) return NAV.BUDGET;
      const gu = g[u];
      const du = drop[u];
      let m = mask[u];
      while (m !== 0) {
        const low = m & -m;
        m ^= low;
        const mv = 31 - Math.clz32(low);
        if (mv === MV.LINK) {
          let l = grid.linkHead.get(u);
          while (l !== undefined && l >= 0) {
            if (grid.linkUsable(p, l)) {
              const v = grid.linkTo[l];
              if (mul[v] !== 0 && seen[v] !== CLOSED) {
                const ng = gu + grid.linkCostNow(l);
                if (seen[v] !== OPEN || ng < g[v]) {
                  seen[v] = OPEN;
                  g[v] = ng;
                  par[v] = u;
                  pmv[v] = MV.LINK;
                  paux[v] = l;
                  const hv = this.h(v);
                  s.push(v, (ng + hv) * KEY_SCALE + hv);
                }
              }
            }
            l = grid.linkNext[l];
          }
          continue;
        }
        let v: number;
        let c: number;
        if (jt !== null && (mv === MV.WALK_L || mv === MV.WALK_R || mv === MV.UP || mv === MV.DOWN)) {
          const step = mv === MV.WALK_L ? -1 : mv === MV.WALK_R ? 1 : mv === MV.UP ? -W : W;
          const n = mv === MV.WALK_L ? jt.jl[u] : mv === MV.WALK_R ? jt.jr[u] : mv === MV.UP ? jt.ju[u] : jt.jd[u];
          const stepCost = (base[mv] * mul[u + step] + 8) >> 4;
          v = u + n * step;
          if (n > 1) {
            const gl = this.goalCount > 0 ? this.goalOnRun(u, v, step) : -1;
            if (gl >= 0) v = gl;
            else {
              // dead end: the run's last cell only leads back
              const back = mv === MV.WALK_L ? BIT.WALK_R : mv === MV.WALK_R ? BIT.WALK_L : mv === MV.UP ? BIT.DOWN : BIT.UP;
              if ((mask[v] & ~back) === 0) continue;
            }
          }
          c = ((v - u) / step) * stepCost;
        } else {
          v = grid.target(u, mv, du);
          let bc = base[mv];
          if (mv === MV.DROP_L) bc += perRow * (du & 15);
          else if (mv === MV.DROP_R) bc += perRow * ((du >> 4) & 15);
          else if (mv === MV.FALL) bc += perRow * ((du >> 8) & 15);
          c = (bc * mul[v] + 8) >> 4;
        }
        const sv = seen[v];
        if (sv === CLOSED) continue;
        const ng = gu + c;
        if (sv !== OPEN || ng < g[v]) {
          seen[v] = OPEN;
          g[v] = ng;
          par[v] = u;
          pmv[v] = mv;
          paux[v] = -1;
          const hv = this.h(v);
          s.push(v, (ng + hv) * KEY_SCALE + hv);
        }
      }
    }
    return NAV.NO_PATH;
  }

  private reconstruct(goal: number, out: Path): void {
    const { g, par, pmv, paux } = this.s;
    const W = this.grid.w;
    let v = goal;
    for (;;) {
      const u = par[v];
      const mv = pmv[v];
      if (u === -1) {
        out.push(v, MOVE_NONE, -1);
        break;
      }
      const step = mv === MV.WALK_L ? -1 : mv === MV.WALK_R ? 1 : mv === MV.UP ? -W : mv === MV.DOWN ? W : 0;
      if (step !== 0) for (let c = v; c !== u; c -= step) out.push(c, mv, -1);
      else out.push(v, mv, paux[v]);
      v = u;
    }
    out.reverse();
    out.cost = g[goal];
  }
}
