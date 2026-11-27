/**
 * Hierarchical path finding (HPA*) on C x C clusters of the NavGrid.
 *
 * Portals of a cluster are every cell that is the source or the target of an
 * edge crossing the cluster border (the gravity graph is directed: drops are
 * one way) plus every link endpoint. Each portal keeps a predecessor map of
 * its in-cluster Dijkstra tree and the cluster keeps portal-to-portal costs.
 * Because every crossing edge is represented and in-cluster costs are exact,
 * the abstract search returns optimal paths; refinement only walks stored
 * predecessor maps (no search).
 *
 * Query: forward Dijkstra from the start inside its cluster, reverse Dijkstra
 * from the goals inside theirs, A* over portals (intra-cluster costs,
 * crossing edges read live from the grid masks, links with live congestion
 * cost), then path assembly.
 *
 * Updates: changed cells mark the clusters their edges touch as dirty; dirty
 * clusters are rebuilt lazily before the next query (or `flush()`).
 */
import type { NavGrid, NavListener } from './grid';
import { AStar, type FindOptions, type PathFinder } from './astar';
import { H_CAP, KEY_SCALE, scratchFor, type Path, type SearchScratch } from './search';
import { BIT, INF, MOVE_NONE, MV, NAV } from './types';

interface Cluster {
  x0: number;
  y0: number;
  cw: number;
  ch: number;
  cc: number;
  /** Portal cells, ascending. */
  portals: Int32Array;
  /** Local cell -> portal index, -1 when not a portal. */
  local: Int16Array;
  /** Portal-to-portal in-cluster costs (P x P). */
  cost: Int32Array;
  /** Per portal: predecessor of every local cell, (localPred << 4) | move; 0xffff = none. */
  pred: Uint16Array;
}

const SEG_INTRA = 200;
const SEG_START = 201;
const NONE16 = 0xffff;
const MAX_SLOTS = 4;

export interface HpaOptions {
  /** Cluster edge in tiles (4..32). */
  cluster?: number;
  name?: string;
}

export class HpaStar implements PathFinder, NavListener {
  readonly name: string;
  readonly grid: NavGrid;
  readonly profile: number;
  readonly C: number;
  readonly cx: number;
  readonly cy: number;
  expanded = 0;
  /** Clusters rebuilt since construction (stat). */
  rebuilt = 0;
  private readonly clusters: Cluster[] = [];
  private readonly dirty: Uint8Array;
  private dirtyList: Int32Array;
  private dirtyCount = 0;
  private readonly s: SearchScratch;
  private readonly fallback: AStar;
  // local (in-cluster) search scratch
  private readonly ld: Int32Array;
  private lhn = new Int32Array(1024);
  private lhk = new Float64Array(1024);
  private lsize = 0;
  private lkey = 0;
  // start segment
  private readonly sd: Int32Array;
  private readonly sp: Uint16Array;
  // goal slots
  private readonly gd: Int32Array[] = [];
  private readonly gn: Uint16Array[] = [];
  private readonly slotCluster = new Int32Array(MAX_SLOTS);
  private slots = 0;
  private goals = new Int32Array(16);
  private goalCount = 0;
  private gx0 = 0;
  private gx1 = 0;
  private gy0 = 0;
  private gy1 = 0;
  private readonly predCells = new Int32Array(64);
  private readonly predMoves = new Uint8Array(64);
  private portalBuf = new Int32Array(256);
  private readonly tmpCells: Int32Array;
  private readonly tmpMoves: Uint8Array;

  constructor(grid: NavGrid, profile = 0, opts: HpaOptions = {}) {
    const C = opts.cluster ?? 16;
    if (C < 4 || C > 32) throw new Error('HpaStar: cluster size 4..32');
    this.grid = grid;
    this.profile = profile;
    this.C = C;
    this.name = opts.name ?? `HPA* ${C}×${C}`;
    this.cx = Math.ceil(grid.w / C);
    this.cy = Math.ceil(grid.h / C);
    const cc = C * C;
    this.ld = new Int32Array(cc);
    this.sd = new Int32Array(cc);
    this.sp = new Uint16Array(cc);
    this.tmpCells = new Int32Array(cc);
    this.tmpMoves = new Uint8Array(cc);
    for (let k = 0; k < MAX_SLOTS; k++) {
      this.gd.push(new Int32Array(cc));
      this.gn.push(new Uint16Array(cc));
    }
    const empty = new Int32Array(0);
    for (let ky = 0; ky < this.cy; ky++)
      for (let kx = 0; kx < this.cx; kx++) {
        const x0 = kx * C;
        const y0 = ky * C;
        const cw = Math.min(C, grid.w - x0);
        const ch = Math.min(C, grid.h - y0);
        this.clusters.push({ x0, y0, cw, ch, cc: cw * ch, portals: empty, local: new Int16Array(cw * ch).fill(-1), cost: empty, pred: new Uint16Array(0) });
      }
    this.dirty = new Uint8Array(this.clusters.length);
    this.dirtyList = new Int32Array(this.clusters.length);
    this.s = scratchFor(grid);
    this.fallback = new AStar(grid, profile);
    for (let k = 0; k < this.clusters.length; k++) this.rebuild(k);
    grid.addListener(this);
  }

  dispose(): void {
    this.grid.removeListener(this);
  }

  // ============================================================ updates

  navRebuilt(): void {
    for (let k = 0; k < this.clusters.length; k++) this.markDirty(k);
  }

  navChanged(cells: Int32Array, count: number): void {
    const W = this.grid.w;
    const C = this.C;
    const md = this.grid.profiles[this.profile].maxDrop;
    for (let q = 0; q < count; q++) {
      const c = cells[q];
      const x = c % W;
      const y = (c - x) / W;
      // the cell's own cluster plus every cluster its edges can reach
      const kx0 = Math.max(0, Math.floor((x - 1) / C));
      const kx1 = Math.min(this.cx - 1, Math.floor((x + 1) / C));
      const ky0 = Math.max(0, Math.floor((y - 1) / C));
      const ky1 = Math.min(this.cy - 1, Math.floor((y + md + 1) / C));
      for (let ky = ky0; ky <= ky1; ky++) for (let kx = kx0; kx <= kx1; kx++) this.markDirty(ky * this.cx + kx);
    }
  }

  private markDirty(k: number): void {
    if (this.dirty[k]) return;
    this.dirty[k] = 1;
    this.dirtyList[this.dirtyCount++] = k;
  }

  /** Rebuild dirty clusters now (queries do this lazily). Returns the number rebuilt. */
  flush(): number {
    this.grid.sync();
    const n = this.dirtyCount;
    if (n === 0) return 0;
    // deterministic order regardless of notification order
    this.dirtyList.subarray(0, n).sort();
    for (let q = 0; q < n; q++) {
      const k = this.dirtyList[q];
      this.dirty[k] = 0;
      this.rebuild(k);
    }
    this.dirtyCount = 0;
    return n;
  }

  private inside(K: Cluster, x: number, y: number): boolean {
    return x >= K.x0 && y >= K.y0 && x < K.x0 + K.cw && y < K.y0 + K.ch;
  }

  private addPortal(n: number, c: number): number {
    if (n === this.portalBuf.length) {
      const b = new Int32Array(n * 2);
      b.set(this.portalBuf);
      this.portalBuf = b;
    }
    this.portalBuf[n] = c;
    return n + 1;
  }

  private rebuild(k: number): void {
    this.rebuilt++;
    const grid = this.grid;
    const p = this.profile;
    const K = this.clusters[k];
    const W = grid.w;
    const H = grid.h;
    const mask = grid.mask[p];
    const drop = grid.drop[p];
    const mul = grid.mul[p];
    const x1 = K.x0 + K.cw;
    const y1 = K.y0 + K.ch;
    let np = 0;
    // sources of edges leaving the cluster, link sources
    for (let y = K.y0; y < y1; y++)
      for (let x = K.x0; x < x1; x++) {
        const u = y * W + x;
        let m = mask[u];
        if (m === 0) continue;
        if (m & BIT.LINK) {
          np = this.addPortal(np, u);
          continue;
        }
        const du = drop[u];
        while (m !== 0) {
          const low = m & -m;
          m ^= low;
          const v = grid.target(u, 31 - Math.clz32(low), du);
          const vx = v % W;
          if (!this.inside(K, vx, (v - vx) / W)) {
            np = this.addPortal(np, u);
            break;
          }
        }
      }
    // targets of edges entering the cluster from the surrounding ring
    const md = grid.profiles[p].maxDrop;
    for (let y = Math.max(0, K.y0 - md - 1); y <= Math.min(H - 1, y1); y++)
      for (let x = Math.max(0, K.x0 - 1); x <= Math.min(W - 1, x1); x++) {
        if (this.inside(K, x, y)) continue;
        const u = y * W + x;
        let m = mask[u] & ~BIT.LINK;
        const du = drop[u];
        while (m !== 0) {
          const low = m & -m;
          m ^= low;
          const v = grid.target(u, 31 - Math.clz32(low), du);
          const vx = v % W;
          if (this.inside(K, vx, (v - vx) / W)) np = this.addPortal(np, v);
        }
      }
    // link targets
    for (let l = 0; l < grid.linkCount; l++) {
      if (!grid.linkUsable(p, l)) continue;
      const t = grid.linkTo[l];
      const tx = t % W;
      if (mul[t] !== 0 && this.inside(K, tx, (t - tx) / W)) np = this.addPortal(np, t);
    }
    // sort + dedupe
    const buf = this.portalBuf.subarray(0, np).sort();
    let P = 0;
    for (let q = 0; q < np; q++) if (q === 0 || buf[q] !== buf[q - 1]) buf[P++] = buf[q];
    K.local.fill(-1);
    K.portals = new Int32Array(P);
    for (let q = 0; q < P; q++) {
      const c = buf[q];
      K.portals[q] = c;
      const cx = c % W;
      K.local[((c - cx) / W - K.y0) * K.cw + (cx - K.x0)] = q;
    }
    K.cost = new Int32Array(P * P);
    K.pred = new Uint16Array(P * K.cc);
    const ld = this.ld;
    for (let a = 0; a < P; a++) {
      this.forward(K, this.localOf(K, K.portals[a]), ld, K.pred, a * K.cc);
      for (let b = 0; b < P; b++) K.cost[a * P + b] = ld[this.localOf(K, K.portals[b])];
    }
  }

  private localOf(K: Cluster, c: number): number {
    const W = this.grid.w;
    const x = c % W;
    return ((c - x) / W - K.y0) * K.cw + (x - K.x0);
  }

  private globalOf(K: Cluster, l: number): number {
    const lx = l % K.cw;
    return (K.y0 + (l - lx) / K.cw) * this.grid.w + K.x0 + lx;
  }

  // ============================================================ local searches

  private lpush(node: number, key: number): void {
    if (this.lsize === this.lhn.length) {
      const k = this.lhn.length * 2;
      const hn = new Int32Array(k);
      hn.set(this.lhn);
      const hk = new Float64Array(k);
      hk.set(this.lhk);
      this.lhn = hn;
      this.lhk = hk;
    }
    const hn = this.lhn;
    const hk = this.lhk;
    let i = this.lsize++;
    while (i > 0) {
      const q = (i - 1) >> 1;
      if (hk[q] <= key) break;
      hn[i] = hn[q];
      hk[i] = hk[q];
      i = q;
    }
    hn[i] = node;
    hk[i] = key;
  }

  private lpop(): number {
    const hn = this.lhn;
    const hk = this.lhk;
    const top = hn[0];
    this.lkey = hk[0];
    const n = --this.lsize;
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

  /** In-cluster Dijkstra from local cell `src` (links excluded): dist + predecessor map. */
  private forward(K: Cluster, src: number, dist: Int32Array, pred: Uint16Array, off: number): void {
    const grid = this.grid;
    const p = this.profile;
    const mask = grid.mask[p];
    const drop = grid.drop[p];
    const W = grid.w;
    dist.fill(INF, 0, K.cc);
    pred.fill(NONE16, off, off + K.cc);
    dist[src] = 0;
    this.lsize = 0;
    this.lpush(src, 0);
    while (this.lsize > 0) {
      const l = this.lpop();
      const dl = dist[l];
      if (this.lkey > dl) continue;
      this.expanded++;
      const u = this.globalOf(K, l);
      const du = drop[u];
      let m = mask[u] & ~BIT.LINK;
      while (m !== 0) {
        const low = m & -m;
        m ^= low;
        const mv = 31 - Math.clz32(low);
        const v = grid.target(u, mv, du);
        const vx = v % W;
        const vy = (v - vx) / W;
        if (!this.inside(K, vx, vy)) continue;
        const lv = (vy - K.y0) * K.cw + (vx - K.x0);
        const nd = dl + grid.moveCost(p, mv, du, v);
        if (nd < dist[lv]) {
          dist[lv] = nd;
          pred[off + lv] = (l << 4) | mv;
          this.lpush(lv, nd);
        }
      }
    }
  }

  /** In-cluster reverse Dijkstra from the goals in cluster K: distance to the nearest goal + next step. */
  private reverse(K: Cluster, dist: Int32Array, next: Uint16Array): void {
    const grid = this.grid;
    const p = this.profile;
    const drop = grid.drop[p];
    const W = grid.w;
    dist.fill(INF, 0, K.cc);
    next.fill(NONE16, 0, K.cc);
    this.lsize = 0;
    for (let q = 0; q < this.goalCount; q++) {
      const c = this.goals[q];
      const cx = c % W;
      if (!this.inside(K, cx, (c - cx) / W)) continue;
      const l = this.localOf(K, c);
      dist[l] = 0;
      this.lpush(l, 0);
    }
    const cells = this.predCells;
    const moves = this.predMoves;
    while (this.lsize > 0) {
      const l = this.lpop();
      const dl = dist[l];
      if (this.lkey > dl) continue;
      this.expanded++;
      const v = this.globalOf(K, l);
      const n = grid.predecessors(p, v, cells, moves);
      for (let q = 0; q < n; q++) {
        const u = cells[q];
        const ux = u % W;
        const uy = (u - ux) / W;
        if (!this.inside(K, ux, uy)) continue;
        const mv = moves[q];
        const lu = (uy - K.y0) * K.cw + (ux - K.x0);
        const nd = dl + grid.moveCost(p, mv, drop[u], v);
        if (nd < dist[lu]) {
          dist[lu] = nd;
          next[lu] = (l << 4) | mv;
          this.lpush(lu, nd);
        }
      }
    }
  }

  // ============================================================ query

  private clusterIndex(c: number): number {
    const W = this.grid.w;
    const x = c % W;
    return Math.floor((c - x) / W / this.C) * this.cx + Math.floor(x / this.C);
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
    return hv > H_CAP ? H_CAP : hv;
  }

  find(start: number, goals: ArrayLike<number>, out: Path, opts: FindOptions = {}): number {
    const grid = this.grid;
    this.flush();
    const p = this.profile;
    this.expanded = 0;
    out.clear();
    out.profile = p;
    out.version = grid.version;
    if (!grid.standable(p, start)) return NAV.INVALID_START;
    // goals: standable ones, their bounding box and cluster slots
    if (this.goals.length < goals.length) this.goals = new Int32Array(goals.length);
    let gc = 0;
    this.slots = 0;
    this.gx0 = grid.w;
    this.gx1 = -1;
    this.gy0 = grid.h;
    this.gy1 = -1;
    let overflow = false;
    for (let q = 0; q < goals.length; q++) {
      const c = goals[q];
      if (!grid.standable(p, c)) continue;
      this.goals[gc++] = c;
      const x = c % grid.w;
      const y = (c - x) / grid.w;
      this.gx0 = Math.min(this.gx0, x);
      this.gx1 = Math.max(this.gx1, x);
      this.gy0 = Math.min(this.gy0, y);
      this.gy1 = Math.max(this.gy1, y);
      const k = this.clusterIndex(c);
      let s = 0;
      while (s < this.slots && this.slotCluster[s] !== k) s++;
      if (s === this.slots) {
        if (this.slots === MAX_SLOTS) overflow = true;
        else this.slotCluster[this.slots++] = k;
      }
    }
    this.goalCount = gc;
    if (gc === 0) return NAV.INVALID_GOAL;
    if (overflow) {
      const st = this.fallback.find(start, goals, out, opts);
      this.expanded = this.fallback.expanded;
      return st;
    }
    for (let s = 0; s < this.slots; s++) this.reverse(this.clusters[this.slotCluster[s]], this.gd[s], this.gn[s]);
    const ks = this.clusterIndex(start);
    const KS = this.clusters[ks];
    const lstart = this.localOf(KS, start);
    this.forward(KS, lstart, this.sd, this.sp, 0);

    let best = INF;
    let bestVia = -1;
    let bestSlot = -1;
    for (let s = 0; s < this.slots; s++)
      if (this.slotCluster[s] === ks && this.gd[s][lstart] < best) {
        best = this.gd[s][lstart];
        bestVia = start;
        bestSlot = s;
      }

    const S = this.s;
    const { g, seen } = S;
    this.open = S.begin();
    const CLOSED = this.open + 1;
    const mask = grid.mask[p];
    const drop = grid.drop[p];
    const mul = grid.mul[p];
    const maxExp = opts.maxExpansions ?? Infinity;
    for (let q = 0; q < KS.portals.length; q++) {
      const c = KS.portals[q];
      const d = this.sd[this.localOf(KS, c)];
      if (c === start) this.relax(c, 0, -1, MOVE_NONE, -1);
      else if (d < INF) this.relax(c, d, start, SEG_START, -1);
    }
    while (S.size > 0) {
      const u = S.pop();
      if (seen[u] === CLOSED) continue;
      seen[u] = CLOSED;
      const gu = g[u];
      if (Math.floor(S.lastKey / KEY_SCALE) >= best) break;
      if (++this.expanded > maxExp) return NAV.BUDGET;
      const ku = this.clusterIndex(u);
      const K = this.clusters[ku];
      const lu = this.localOf(K, u);
      for (let s = 0; s < this.slots; s++)
        if (this.slotCluster[s] === ku) {
          const d = this.gd[s][lu];
          if (d < INF && gu + d < best) {
            best = gu + d;
            bestVia = u;
            bestSlot = s;
          }
        }
      // intra-cluster edges
      const iu = K.local[lu];
      if (iu >= 0) {
        const P = K.portals.length;
        const row = iu * P;
        for (let q = 0; q < P; q++) {
          const c = K.cost[row + q];
          if (q !== iu && c < INF) this.relax(K.portals[q], gu + c, u, SEG_INTRA, -1);
        }
      }
      // crossing edges and links
      const du = drop[u];
      let m = mask[u];
      while (m !== 0) {
        const low = m & -m;
        m ^= low;
        const mv = 31 - Math.clz32(low);
        if (mv === MV.LINK) {
          let l = grid.linkHead.get(u);
          while (l !== undefined && l >= 0) {
            const t = grid.linkTo[l];
            if (grid.linkUsable(p, l) && mul[t] !== 0) this.relax(t, gu + grid.linkCostNow(l), u, MV.LINK, l);
            l = grid.linkNext[l];
          }
          continue;
        }
        const v = grid.target(u, mv, du);
        if (this.clusterIndex(v) !== ku) this.relax(v, gu + grid.moveCost(p, mv, du, v), u, mv, -1);
      }
    }
    if (best >= INF) return NAV.NO_PATH;
    this.assemble(start, bestVia, bestSlot, out);
    out.cost = best;
    return NAV.FOUND;
  }

  /** OPEN stamp of the running abstract search. */
  private open = 0;

  private relax(v: number, ng: number, u: number, mv: number, aux: number): void {
    const S = this.s;
    const sv = S.seen[v];
    if (sv === this.open + 1) return;
    if (sv !== this.open || ng < S.g[v]) {
      S.seen[v] = this.open;
      S.g[v] = ng;
      S.par[v] = u;
      S.pmv[v] = mv;
      S.paux[v] = aux;
      const hv = this.h(v);
      S.push(v, (ng + hv) * KEY_SCALE + hv);
    }
  }

  private assemble(start: number, via: number, slot: number, out: Path): void {
    const { par, pmv, paux } = this.s;
    // goal segment: follow next pointers from `via` to a goal (forward), then append reversed
    const KG = this.clusters[this.slotCluster[slot]];
    const next = this.gn[slot];
    let t = 0;
    let l = this.localOf(KG, via);
    while (next[l] !== NONE16) {
      const e = next[l];
      l = e >> 4;
      this.tmpCells[t] = this.globalOf(KG, l);
      this.tmpMoves[t++] = e & 15;
    }
    for (let q = t - 1; q >= 0; q--) out.push(this.tmpCells[q], this.tmpMoves[q], -1);
    // abstract chain back to the start
    let v = via;
    while (v !== start) {
      const u = par[v];
      const mv = pmv[v];
      if (mv === SEG_INTRA || mv === SEG_START) {
        const K = this.clusters[this.clusterIndex(v)];
        let pred: Uint16Array;
        let off: number;
        if (mv === SEG_START) {
          pred = this.sp;
          off = 0;
        } else {
          pred = K.pred;
          off = K.local[this.localOf(K, u)] * K.cc;
        }
        const stop = this.localOf(K, u);
        let lc = this.localOf(K, v);
        while (lc !== stop) {
          const e = pred[off + lc];
          out.push(this.globalOf(K, lc), e & 15, -1);
          lc = e >> 4;
        }
      } else out.push(v, mv, paux[v]);
      v = u;
    }
    out.push(start, MOVE_NONE, -1);
    out.reverse();
  }

  bytes(): number {
    let b = this.dirty.byteLength + this.dirtyList.byteLength + this.portalBuf.byteLength;
    b += this.ld.byteLength + this.sd.byteLength + this.sp.byteLength + this.lhn.byteLength + this.lhk.byteLength;
    b += this.tmpCells.byteLength + this.tmpMoves.byteLength;
    for (let s = 0; s < MAX_SLOTS; s++) b += this.gd[s].byteLength + this.gn[s].byteLength;
    for (const K of this.clusters) b += K.portals.byteLength + K.local.byteLength + K.cost.byteLength + K.pred.byteLength;
    return b;
  }

  /** Abstract graph size (stats). */
  portalCount(): number {
    let n = 0;
    for (const K of this.clusters) n += K.portals.length;
    return n;
  }
}
