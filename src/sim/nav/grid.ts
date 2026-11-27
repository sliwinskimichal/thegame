/**
 * NavGrid: the navigation layer of the world, built from the tile grid plus
 * the infrastructure layer and off-mesh links, kept in typed arrays.
 *
 * For every movement profile the grid stores, per cell:
 *   mask  - bit mask of the moves available from the cell (see `MV`),
 *   drop  - packed drop / fall heights of the DROP_L, DROP_R and FALL moves,
 *   mul   - cost multiplier of entering the cell (x16 fixed point), 0 = not standable.
 * Path finders read only these arrays (plus the link table), so the movement
 * rules live in one place. Tile changes (dig, fill, infrastructure, fluids)
 * rebuild a small window of cells around each change and notify listeners
 * with the list of cells whose navigation data changed.
 *
 * Movement model (walkers): a body is `height` cells tall and needs a floor
 * (solid tile, platform deck, ladder top) under its feet, or must be on a
 * ladder / staircase / afloat. It walks, steps up one tile, drops down to
 * `maxDrop` rows (sideways off a ledge, or straight down off a ladder),
 * climbs ladders, follows stairs diagonally and rides links. It never flies.
 *
 * Reads world state only through `SOLID[mat]` and the (fluid level, kind)
 * pair (water/lava only where the level is > 0), so stale `cav` / `fluidKind`
 * values (BUG-003) cannot leak into navigation.
 */
import { SOLID } from '../../world/materials';
import { FLUID, type World } from '../../world/world';
import { DWARF, heuristicCoefficients, moveBaseCosts, type MoveProfile } from './profiles';
import {
  BIT, INFRA, INFRA_KIND, INFRA_LOCKED, INFRA_RISE_RIGHT, LINK, MOVE_COUNT, MOVE_DX, MOVE_DY, MV, dropHeight,
} from './types';

export interface NavListener {
  /** Navigation data (mask, drop heights or cost) of these cells changed for some profile. */
  navChanged(cells: Int32Array, count: number): void;
  /** The whole grid was rebuilt (e.g. the world change ring overflowed). */
  navRebuilt(): void;
}

export interface NavGridOptions {
  profiles?: readonly MoveProfile[];
  /** Initial infrastructure layer (copied). */
  infra?: Uint8Array;
}

export interface LiftOptions { speed: number; wait: number; capacity: number; profiles?: number }
export interface RailOptions { speed: number; board: number; capacity: number; profiles?: number }
export interface RopeOptions { upPerRow?: number; downPerRow?: number; profiles?: number }
export interface BridgeOptions { perTile?: number; capacity?: number; profiles?: number }

const F_PENDING = 1;
const F_VISITED = 2;
const F_CHANGED = 4;

function grow(a: Int32Array, need: number): Int32Array {
  if (need <= a.length) return a;
  const b = new Int32Array(Math.max(need, a.length * 2));
  b.set(a);
  return b;
}

export class NavGrid {
  readonly world: World;
  readonly w: number;
  readonly h: number;
  readonly n: number;
  readonly profiles: readonly MoveProfile[];
  /** Cached SOLID[mat] of every tile. */
  readonly solid: Uint8Array;
  /** Infrastructure layer (`INFRA` kind + flags) — proposed as a `World` field. */
  readonly infra: Uint8Array;
  readonly mask: Uint16Array[] = [];
  readonly drop: Uint16Array[] = [];
  readonly mul: Uint8Array[] = [];
  /** Base cost of every move slot per profile (drops: fixed part). */
  readonly base: Int32Array[] = [];
  /** Extra cost per row fallen, per profile. */
  readonly perRow: Int32Array;
  /** Index offset of fixed moves. */
  readonly off: Int32Array;
  /** Heuristic coefficients per profile (links folded in). */
  readonly hA: Int32Array;
  readonly hUp: Int32Array;
  readonly hDown: Int32Array;
  readonly maxDropAll: number;
  readonly maxHeightAll: number;
  /** Bumped by every batch of navigation changes. */
  version = 0;
  /** 16 x 16 tile regions stamped with the version of their last change (for path validation). */
  readonly regionShift = 4;
  readonly regionW: number;
  readonly regionStamp: Uint32Array;

  // ------------------------------------------------------------ links
  linkCount = 0;
  linkFrom = new Int32Array(16);
  linkTo = new Int32Array(16);
  linkCost = new Int32Array(16);
  linkKind = new Uint8Array(16);
  linkGroup = new Int32Array(16);
  /** Bit mask over grid profile indices allowed on the link. */
  linkProfiles = new Uint32Array(16);
  linkOn = new Uint8Array(16);
  linkNext = new Int32Array(16);
  /** First link leaving a cell (chained through linkNext). */
  readonly linkHead = new Map<number, number>();
  groupCount = 0;
  groupCap = new Int32Array(8);
  groupLoad = new Int32Array(8);
  groupTrip = new Int32Array(8);

  private readonly listeners: NavListener[] = [];
  private worldSeen: number;
  private readonly flags: Uint8Array;
  private pending: Int32Array = new Int32Array(64);
  private pendingCount = 0;
  private visited: Int32Array = new Int32Array(256);
  private visitedCount = 0;
  private changed: Int32Array = new Int32Array(256);
  private changedCount = 0;
  /** Fall height of the last `landing()` call. */
  lastFall = 0;

  constructor(world: World, opts: NavGridOptions = {}) {
    this.world = world;
    this.w = world.w;
    this.h = world.h;
    this.n = world.size;
    this.profiles = opts.profiles ?? [DWARF];
    if (this.profiles.length === 0 || this.profiles.length > 32) throw new Error('NavGrid: 1..32 profiles');
    this.solid = new Uint8Array(this.n);
    this.infra = new Uint8Array(this.n);
    if (opts.infra) this.infra.set(opts.infra);
    this.flags = new Uint8Array(this.n);
    const np = this.profiles.length;
    this.perRow = new Int32Array(np);
    this.hA = new Int32Array(np);
    this.hUp = new Int32Array(np);
    this.hDown = new Int32Array(np);
    let md = 1;
    let mh = 1;
    this.profiles.forEach((p, k) => {
      if (p.maxDrop > 15 || p.height < 1 || p.height > 4) throw new Error(`profile ${p.id}: maxDrop <= 15, height 1..4`);
      this.mask.push(new Uint16Array(this.n));
      this.drop.push(new Uint16Array(this.n));
      this.mul.push(new Uint8Array(this.n));
      this.base.push(moveBaseCosts(p));
      this.perRow[k] = p.cost.dropPerRow;
      md = Math.max(md, p.maxDrop);
      mh = Math.max(mh, p.height);
    });
    this.maxDropAll = md;
    this.maxHeightAll = mh;
    this.off = new Int32Array(MOVE_COUNT);
    for (let m = 0; m < MOVE_COUNT; m++) this.off[m] = MOVE_DX[m] + MOVE_DY[m] * this.w;
    this.regionW = (this.w + 15) >> 4;
    this.regionStamp = new Uint32Array(this.regionW * ((this.h + 15) >> 4));
    this.worldSeen = world.changeCount;
    for (let i = 0; i < this.n; i++) this.solid[i] = SOLID[world.mat[i]];
    this.updateHeuristics();
    this.rebuildAll();
  }

  addListener(l: NavListener): void {
    this.listeners.push(l);
  }

  removeListener(l: NavListener): void {
    const k = this.listeners.indexOf(l);
    if (k >= 0) this.listeners.splice(k, 1);
  }

  idx(x: number, y: number): number {
    return y * this.w + x;
  }

  profileIndex(id: string): number {
    const k = this.profiles.findIndex((p) => p.id === id);
    if (k < 0) throw new Error(`NavGrid: no profile ${id}`);
    return k;
  }

  /** Can a body of profile `p` rest at cell i (it is a graph node)? */
  standable(p: number, i: number): boolean {
    return i >= 0 && i < this.n && this.mul[p][i] !== 0;
  }

  // ============================================================ updates

  /** Rebuild every cell of every profile. */
  rebuildAll(): void {
    for (let p = 0; p < this.profiles.length; p++)
      for (let y = 0, i = 0; y < this.h; y++) for (let x = 0; x < this.w; x++, i++) this.buildCell(p, x, y, i);
  }

  /** Set the infrastructure code of a tile (applied on the next `sync`). */
  setInfra(x: number, y: number, code: number): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    if (this.infra[i] === code) return;
    this.infra[i] = code;
    this.queueTile(i);
  }

  /** Fill a vertical run of tiles with one infrastructure code (ladders). */
  setInfraColumn(x: number, y0: number, y1: number, code: number): void {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.setInfra(x, y, code);
  }

  /** Re-read world state of a rectangle (fluids, or anything changed outside the change ring). */
  markDirty(x0: number, y0: number, x1: number, y1: number): void {
    for (let y = Math.max(0, y0); y <= Math.min(this.h - 1, y1); y++)
      for (let x = Math.max(0, x0); x <= Math.min(this.w - 1, x1); x++) {
        const i = y * this.w + x;
        this.solid[i] = SOLID[this.world.mat[i]];
        this.queueTile(i);
      }
  }

  /**
   * Pull terrain changes from the world change ring and apply every queued
   * change. Returns the number of cells whose navigation changed (-1 = full
   * rebuild). Cheap when nothing changed; finders call it before searching.
   */
  sync(): number {
    if (this.world.changeCount !== this.worldSeen) {
      const ok = this.world.changesSince(this.worldSeen, this.onWorldTile);
      this.worldSeen = this.world.changeCount;
      if (!ok) {
        for (let i = 0; i < this.n; i++) this.solid[i] = SOLID[this.world.mat[i]];
        for (let q = 0; q < this.pendingCount; q++) this.flags[this.pending[q]] = 0;
        for (let q = 0; q < this.changedCount; q++) this.flags[this.changed[q]] = 0;
        this.pendingCount = 0;
        this.changedCount = 0;
        this.rebuildAll();
        this.version++;
        this.regionStamp.fill(this.version);
        for (const l of this.listeners) l.navRebuilt();
        return -1;
      }
    }
    return this.flush();
  }

  private readonly onWorldTile = (i: number): void => {
    const s = SOLID[this.world.mat[i]];
    if (s !== this.solid[i]) {
      this.solid[i] = s;
      this.queueTile(i);
    }
  };

  private queueTile(i: number): void {
    if (this.flags[i] & F_PENDING) return;
    this.flags[i] |= F_PENDING;
    this.pending = grow(this.pending, this.pendingCount + 1);
    this.pending[this.pendingCount++] = i;
  }

  /** Report a cell as changed even if its own mask did not change (link table edits). */
  private forceChanged(i: number): void {
    if (this.flags[i] & F_CHANGED) return;
    this.flags[i] |= F_CHANGED;
    this.changed = grow(this.changed, this.changedCount + 1);
    this.changed[this.changedCount++] = i;
  }

  private flush(): number {
    if (this.pendingCount === 0 && this.changedCount === 0) return 0;
    const W = this.w;
    const y0d = this.maxDropAll + 2;
    const y1d = this.maxHeightAll + 1;
    for (let q = 0; q < this.pendingCount; q++) {
      const t = this.pending[q];
      this.flags[t] &= ~F_PENDING;
      const tx = t % W;
      const ty = (t - tx) / W;
      // cells whose moves read tile t: two columns each side, from maxDrop+2 rows above to height+1 below
      for (let y = Math.max(0, ty - y0d); y <= Math.min(this.h - 1, ty + y1d); y++)
        for (let x = Math.max(0, tx - 2); x <= Math.min(W - 1, tx + 2); x++) this.visit(x, y);
    }
    this.pendingCount = 0;
    // link sources depend on their far end being standable: re-check them all (links are few)
    for (let l = 0; l < this.linkCount; l++) {
      const f = this.linkFrom[l];
      const fx = f % W;
      this.visit(fx, (f - fx) / W);
    }
    for (let q = 0; q < this.visitedCount; q++) this.flags[this.visited[q]] &= ~F_VISITED;
    this.visitedCount = 0;
    const n = this.changedCount;
    if (n > 0) {
      this.version++;
      for (let q = 0; q < n; q++) {
        const c = this.changed[q];
        const cx = c % W;
        this.regionStamp[(((c - cx) / W) >> 4) * this.regionW + (cx >> 4)] = this.version;
      }
      for (const l of this.listeners) l.navChanged(this.changed, n);
      for (let q = 0; q < n; q++) this.flags[this.changed[q]] &= ~F_CHANGED;
      this.changedCount = 0;
    }
    return n;
  }

  private visit(x: number, y: number): void {
    const i = y * this.w + x;
    if (this.flags[i] & F_VISITED) return;
    this.flags[i] |= F_VISITED;
    this.visited = grow(this.visited, this.visitedCount + 1);
    this.visited[this.visitedCount++] = i;
    let diff = false;
    for (let p = 0; p < this.profiles.length; p++) {
      const m0 = this.mask[p][i];
      const d0 = this.drop[p][i];
      const u0 = this.mul[p][i];
      this.buildCell(p, x, y, i);
      if (m0 !== this.mask[p][i] || d0 !== this.drop[p][i] || u0 !== this.mul[p][i]) diff = true;
    }
    if (diff) this.forceChanged(i);
  }

  // ============================================================ tile predicates

  private water(c: number): number {
    return this.world.fluidKind[c] === FLUID.WATER ? this.world.fluid[c] : 0;
  }

  /** Can a body pass through tile (x, y)? Above the map is open sky. */
  private open(P: MoveProfile, x: number, y: number): boolean {
    if (x < 0 || x >= this.w || y >= this.h) return false;
    if (y < 0) return true;
    const c = y * this.w + x;
    if (this.solid[c]) return false;
    const f = this.infra[c];
    const k = f & INFRA_KIND;
    if (k === INFRA.PLATFORM) return false;
    if (k >= INFRA.DOOR_WOOD && k <= INFRA.BULKHEAD && (f & INFRA_LOCKED || P.doorMul[k - INFRA.DOOR_WOOD] === 0)) return false;
    if (!P.lavaOk && this.world.fluidKind[c] === FLUID.LAVA && this.world.fluid[c] > 0) return false;
    return true;
  }

  /** Does tile (x, y) carry a body standing on top of it? Below the map counts as floor. */
  private floorAt(P: MoveProfile, x: number, y: number): boolean {
    if (y >= this.h) return true;
    if (x < 0 || x >= this.w || y < 0) return false;
    const c = y * this.w + x;
    if (this.solid[c]) return true;
    const k = this.infra[c] & INFRA_KIND;
    return k === INFRA.PLATFORM || (k === INFRA.LADDER && P.ladders);
  }

  private headroom(P: MoveProfile, x: number, y: number): number {
    let n = 0;
    while (n < P.height && this.open(P, x, y - n)) n++;
    return n;
  }

  /** The body fits at (x, y): open feet, enough headroom (or crawling), head not under water. */
  private bodyOk(P: MoveProfile, x: number, y: number): boolean {
    if (!this.open(P, x, y)) return false;
    const hr = this.headroom(P, x, y);
    if (hr < P.height && !P.crawl) return false;
    if (!P.swim) {
      const top = y - hr + 1;
      if (top >= 0 && this.water(top * this.w + x) >= P.deepLevel) return false;
    }
    return true;
  }

  private floating(P: MoveProfile, x: number, y: number): boolean {
    return P.swim && this.water(y * this.w + x) >= P.deepLevel;
  }

  private clings(x: number, y: number): boolean {
    const W = this.w;
    const c = y * W + x;
    return (x > 0 && this.solid[c - 1] === 1) || (x < W - 1 && this.solid[c + 1] === 1) || (y > 0 && this.solid[c - W] === 1);
  }

  private stand(P: MoveProfile, x: number, y: number): boolean {
    if (y < 0 || y >= this.h || x < 0 || x >= this.w) return false;
    if (!this.bodyOk(P, x, y)) return false;
    if (P.kind === 'flyer') return true;
    const k = this.infra[y * this.w + x] & INFRA_KIND;
    if (k === INFRA.LADDER && P.ladders) return true;
    if (k === INFRA.STAIRS && P.stairs) return true;
    if (this.floating(P, x, y)) return true;
    if (this.floorAt(P, x, y + 1)) return true;
    return P.kind === 'climber' && this.clings(x, y);
  }

  /** Rows fallen from (x, y) until a body lands, 0 if no landing within `limit` rows. */
  private fallFrom(P: MoveProfile, x: number, y: number, limit: number): number {
    for (let j = 1; j <= limit; j++) {
      const yy = y + j;
      if (yy >= this.h || !this.bodyOk(P, x, yy)) return 0;
      if (this.stand(P, x, yy)) return j;
    }
    return 0;
  }

  private cellMul(P: MoveProfile, x: number, y: number, i: number): number {
    let m = 16;
    if (this.headroom(P, x, y) < P.height) m *= P.crawlMul;
    const k = this.infra[i] & INFRA_KIND;
    if (k >= INFRA.DOOR_WOOD && k <= INFRA.BULKHEAD) m *= P.doorMul[k - INFRA.DOOR_WOOD];
    if (this.water(i) >= P.wadeLevel) m *= this.floating(P, x, y) && !this.floorAt(P, x, y + 1) ? P.swimMul : P.wadeMul;
    m = Math.round(m);
    return m < 16 ? 16 : m > 255 ? 255 : m;
  }

  // ============================================================ cell rules

  private buildCell(p: number, x: number, y: number, i: number): void {
    const P = this.profiles[p];
    const mask = this.mask[p];
    if (!this.stand(P, x, y)) {
      mask[i] = 0;
      this.drop[p][i] = 0;
      this.mul[p][i] = 0;
      return;
    }
    this.mul[p][i] = this.cellMul(P, x, y, i);
    let m = 0;
    let dr = 0;
    if (P.kind === 'flyer') m = this.flyerMoves(P, x, y);
    else if (P.kind === 'climber') {
      for (let s = 0; s < 2; s++) {
        const nx = x + (s === 0 ? -1 : 1);
        if (nx < 0 || nx >= this.w) continue;
        if (this.stand(P, nx, y)) m |= 1 << (MV.WALK_L + s);
        else if (this.bodyOk(P, nx, y)) {
          const k = this.fallFrom(P, nx, y, P.maxDrop);
          if (k > 0) {
            m |= 1 << (MV.DROP_L + s);
            dr |= k << (4 * s);
          }
        }
      }
      if (this.stand(P, x, y - 1)) m |= BIT.UP;
      if (this.stand(P, x, y + 1)) m |= BIT.DOWN;
    } else {
      const W = this.w;
      const f = this.infra[i];
      const kind = f & INFRA_KIND;
      const onLadder = P.ladders && kind === INFRA.LADDER;
      const rise = f & INFRA_RISE_RIGHT ? 1 : -1;
      const onStairs = P.stairs && kind === INFRA.STAIRS;
      for (let s = 0; s < 2; s++) {
        const d = s === 0 ? -1 : 1;
        const nx = x + d;
        if (nx < 0 || nx >= W) continue;
        if (this.stand(P, nx, y)) m |= 1 << (MV.WALK_L + s);
        else if (this.bodyOk(P, nx, y)) {
          const k = this.fallFrom(P, nx, y, P.maxDrop);
          if (k > 0) {
            m |= 1 << (MV.DROP_L + s);
            dr |= k << (4 * s);
          }
        } else if (y > 0 && !this.open(P, nx, y) && this.open(P, x, y - 1) && this.floorAt(P, nx, y) && this.stand(P, nx, y - 1)) {
          m |= 1 << (MV.STEP_UL + s);
        }
        if (onStairs && rise === d && this.stand(P, nx, y - 1)) {
          m |= 1 << (MV.STAIR_UL + s);
          m &= ~(1 << (MV.STEP_UL + s));
        }
        if (P.stairs && y + 1 < this.h) {
          const fj = this.infra[i + d + W];
          if ((fj & INFRA_KIND) === INFRA.STAIRS && (fj & INFRA_RISE_RIGHT ? 1 : -1) === -d && this.stand(P, nx, y + 1)) {
            m |= 1 << (MV.STAIR_DL + s);
            if (((dr >> (4 * s)) & 15) === 1) {
              m &= ~(1 << (MV.DROP_L + s));
              dr &= ~(15 << (4 * s));
            }
          }
        }
      }
      if (y > 0 && this.stand(P, x, y - 1)) {
        if (onLadder || (P.ladders && (this.infra[i - W] & INFRA_KIND) === INFRA.LADDER) || (this.floating(P, x, y) && this.floating(P, x, y - 1)))
          m |= BIT.UP;
      }
      if (y + 1 < this.h) {
        if (this.stand(P, x, y + 1)) {
          if (onLadder || (P.ladders && (this.infra[i + W] & INFRA_KIND) === INFRA.LADDER) || this.floating(P, x, y + 1)) m |= BIT.DOWN;
        } else if (onLadder && P.maxDrop >= 2 && this.bodyOk(P, x, y + 1)) {
          // let go of the ladder and drop through the gap below
          const k = this.fallFrom(P, x, y + 1, P.maxDrop - 1);
          if (k > 0) {
            m |= 1 << MV.FALL;
            dr |= (k + 1) << 8;
          }
        }
      }
    }
    if (this.linkCount > 0 && this.hasUsableLink(p, P, i)) m |= BIT.LINK;
    mask[i] = m;
    this.drop[p][i] = dr;
  }

  private flyerMoves(P: MoveProfile, x: number, y: number): number {
    let m = 0;
    const upOk = this.bodyOk(P, x, y - 1) && y > 0;
    const dnOk = this.bodyOk(P, x, y + 1);
    if (upOk) m |= BIT.UP;
    if (dnOk) m |= BIT.DOWN;
    for (let s = 0; s < 2; s++) {
      const nx = x + (s === 0 ? -1 : 1);
      if (!this.bodyOk(P, nx, y)) continue;
      m |= 1 << (MV.WALK_L + s);
      if (upOk && this.bodyOk(P, nx, y - 1)) m |= 1 << (MV.STEP_UL + s);
      if (dnOk && this.bodyOk(P, nx, y + 1)) m |= 1 << (MV.STAIR_DL + s);
    }
    return m;
  }

  private hasUsableLink(p: number, P: MoveProfile, i: number): boolean {
    let l = this.linkHead.get(i);
    while (l !== undefined && l >= 0) {
      if (this.linkUsable(p, l)) {
        const t = this.linkTo[l];
        const tx = t % this.w;
        if (this.stand(P, tx, (t - tx) / this.w)) return true;
      }
      l = this.linkNext[l];
    }
    return false;
  }

  // ============================================================ edges

  /** Target cell of a mask move from cell i (drop heights from the cell's drop entry). */
  target(i: number, move: number, drop: number): number {
    if (move === MV.DROP_L) return i - 1 + (drop & 15) * this.w;
    if (move === MV.DROP_R) return i + 1 + ((drop >> 4) & 15) * this.w;
    if (move === MV.FALL) return i + ((drop >> 8) & 15) * this.w;
    return i + this.off[move];
  }

  /** Cost of a mask move into cell j. */
  moveCost(p: number, move: number, drop: number, j: number): number {
    let c = this.base[p][move];
    if (move === MV.DROP_L || move === MV.DROP_R || move === MV.FALL) c += dropHeight(drop, move) * this.perRow[p];
    return (c * this.mul[p][j] + 8) >> 4;
  }

  /** Does the edge from -> to via `move` (and `link` for LINK moves) still exist? */
  hasEdge(p: number, from: number, to: number, move: number, link: number): boolean {
    if (from < 0 || from >= this.n || this.mul[p][from] === 0 || this.mul[p][to] === 0) return false;
    if (move === MV.LINK)
      return link >= 0 && link < this.linkCount && this.linkFrom[link] === from && this.linkTo[link] === to && this.linkUsable(p, link);
    if (!((this.mask[p][from] >> move) & 1)) return false;
    return this.target(from, move, this.drop[p][from]) === to;
  }

  /** Current cost of an edge on a path (LINK moves include congestion). */
  edgeCost(p: number, from: number, to: number, move: number, link: number): number {
    return move === MV.LINK ? this.linkCostNow(link) : this.moveCost(p, move, this.drop[p][from], to);
  }

  /**
   * Cells with a mask edge into v (links excluded), written to `cells` /
   * `moves` (capacity >= 64). Used by reverse searches.
   */
  predecessors(p: number, v: number, cells: Int32Array, moves: Uint8Array): number {
    const W = this.w;
    const mask = this.mask[p];
    const drop = this.drop[p];
    const x = v % W;
    const y = (v - x) / W;
    const md = this.profiles[p].maxDrop;
    let n = 0;
    for (let s = 0; s < 2; s++) {
      // s = 0: predecessor on the right moving left; s = 1: on the left moving right
      const d = s === 0 ? 1 : -1;
      if (x + d < 0 || x + d >= W) continue;
      const side = v + d;
      if ((mask[side] >> (MV.WALK_L + s)) & 1) {
        cells[n] = side;
        moves[n++] = MV.WALK_L + s;
      }
      if (y + 1 < this.h) {
        const u = side + W;
        const m = mask[u];
        if ((m >> (MV.STEP_UL + s)) & 1) {
          cells[n] = u;
          moves[n++] = MV.STEP_UL + s;
        }
        if ((m >> (MV.STAIR_UL + s)) & 1) {
          cells[n] = u;
          moves[n++] = MV.STAIR_UL + s;
        }
      }
      if (y > 0) {
        const u = side - W;
        if ((mask[u] >> (MV.STAIR_DL + s)) & 1) {
          cells[n] = u;
          moves[n++] = MV.STAIR_DL + s;
        }
      }
      for (let k = 1; k <= md && y - k >= 0; k++) {
        const u = side - k * W;
        if ((mask[u] >> (MV.DROP_L + s)) & 1 && ((drop[u] >> (4 * s)) & 15) === k) {
          cells[n] = u;
          moves[n++] = MV.DROP_L + s;
        }
      }
    }
    if (y + 1 < this.h && mask[v + W] & BIT.UP) {
      cells[n] = v + W;
      moves[n++] = MV.UP;
    }
    if (y > 0 && mask[v - W] & BIT.DOWN) {
      cells[n] = v - W;
      moves[n++] = MV.DOWN;
    }
    for (let k = 2; k <= md && y - k >= 0; k++) {
      const u = v - k * W;
      if (mask[u] & (1 << MV.FALL) && ((drop[u] >> 8) & 15) === k) {
        cells[n] = u;
        moves[n++] = MV.FALL;
      }
    }
    return n;
  }

  /**
   * Where a body at (x, y) ends up: the cell itself if standable, else the
   * first standable cell straight below (sets `lastFall`), -1 if none.
   */
  landing(p: number, x: number, y: number): number {
    this.lastFall = 0;
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return -1;
    const P = this.profiles[p];
    for (let yy = y; yy < this.h; yy++) {
      if (!this.bodyOk(P, x, yy)) return -1;
      if (this.stand(P, x, yy)) {
        this.lastFall = yy - y;
        return yy * this.w + x;
      }
    }
    return -1;
  }

  /** Heuristic lower bound of the cost from cell i to cell j. */
  heuristic(p: number, i: number, j: number): number {
    const W = this.w;
    const xi = i % W;
    const xj = j % W;
    const dy = (j - xj) / W - (i - xi) / W;
    return this.hA[p] * (xi > xj ? xi - xj : xj - xi) + (dy > 0 ? this.hDown[p] * dy : -this.hUp[p] * dy);
  }

  // ============================================================ links

  linkUsable(p: number, l: number): boolean {
    return this.linkOn[l] === 1 && ((this.linkProfiles[l] >>> p) & 1) === 1 && ((this.profiles[p].links >> this.linkKind[l]) & 1) === 1;
  }

  /** Link cost including congestion of its group (a full car means waiting for the next trip). */
  linkCostNow(l: number): number {
    const g = this.linkGroup[l];
    let c = this.linkCost[l];
    if (g >= 0) {
      const cap = this.groupCap[g];
      if (cap > 0 && this.groupLoad[g] >= cap) c += this.groupTrip[g] * Math.floor(this.groupLoad[g] / cap);
    }
    return c;
  }

  newGroup(capacity: number, trip: number): number {
    if (this.groupCount === this.groupCap.length) {
      const k = this.groupCount * 2;
      const gc = new Int32Array(k);
      gc.set(this.groupCap);
      const gl = new Int32Array(k);
      gl.set(this.groupLoad);
      const gt = new Int32Array(k);
      gt.set(this.groupTrip);
      this.groupCap = gc;
      this.groupLoad = gl;
      this.groupTrip = gt;
    }
    const g = this.groupCount++;
    this.groupCap[g] = capacity;
    this.groupTrip[g] = trip;
    return g;
  }

  /** Agent boards / leaves a link group (lift car, rope, bridge, cart). */
  reserve(group: number): void {
    if (group >= 0) this.groupLoad[group]++;
  }

  release(group: number): void {
    if (group >= 0 && this.groupLoad[group] > 0) this.groupLoad[group]--;
  }

  /** Add a directed off-mesh link. `profiles` is a bit mask over grid profile indices. */
  addLink(kind: number, from: number, to: number, cost: number, group = -1, profiles = 0xffffffff): number {
    if (from < 0 || from >= this.n || to < 0 || to >= this.n) throw new Error('addLink: cell out of bounds');
    if (this.linkCount === this.linkFrom.length) this.growLinks();
    const l = this.linkCount++;
    this.linkFrom[l] = from;
    this.linkTo[l] = to;
    this.linkCost[l] = Math.max(1, Math.round(cost));
    this.linkKind[l] = kind;
    this.linkGroup[l] = group;
    this.linkProfiles[l] = profiles >>> 0;
    this.linkOn[l] = 1;
    this.linkNext[l] = this.linkHead.get(from) ?? -1;
    this.linkHead.set(from, l);
    this.linkTouched(l);
    return l;
  }

  setLinkEnabled(l: number, on: boolean): void {
    if (this.linkOn[l] === (on ? 1 : 0)) return;
    this.linkOn[l] = on ? 1 : 0;
    this.linkTouched(l);
  }

  setGroupEnabled(g: number, on: boolean): void {
    for (let l = 0; l < this.linkCount; l++) if (this.linkGroup[l] === g) this.setLinkEnabled(l, on);
  }

  private linkTouched(l: number): void {
    this.queueTile(this.linkFrom[l]);
    this.forceChanged(this.linkFrom[l]);
    this.forceChanged(this.linkTo[l]);
    this.updateHeuristics();
  }

  private growLinks(): void {
    const k = this.linkFrom.length * 2;
    const i32 = (a: Int32Array) => {
      const b = new Int32Array(k);
      b.set(a);
      return b;
    };
    this.linkFrom = i32(this.linkFrom);
    this.linkTo = i32(this.linkTo);
    this.linkCost = i32(this.linkCost);
    this.linkGroup = i32(this.linkGroup);
    this.linkNext = i32(this.linkNext);
    const kind = new Uint8Array(k);
    kind.set(this.linkKind);
    this.linkKind = kind;
    const on = new Uint8Array(k);
    on.set(this.linkOn);
    this.linkOn = on;
    const pr = new Uint32Array(k);
    pr.set(this.linkProfiles);
    this.linkProfiles = pr;
  }

  /** Lift shaft: every pair of stops linked; cost = wait + rows / speed. Returns the group. */
  addLift(stops: readonly number[], o: LiftOptions): number {
    const g = this.newGroup(o.capacity, o.wait * 2);
    for (const a of stops)
      for (const b of stops) {
        if (a === b) continue;
        const rows = Math.abs(Math.floor(a / this.w) - Math.floor(b / this.w));
        const cols = Math.abs((a % this.w) - (b % this.w));
        this.addLink(LINK.LIFT, a, b, o.wait + (rows * 1000) / o.speed + cols * 200, g, o.profiles);
      }
    return g;
  }

  /** Cart line through stations (in track order): each pair linked by track length / speed. */
  addRail(stations: readonly number[], o: RailOptions): number {
    const g = this.newGroup(o.capacity, o.board * 2);
    const along = [0];
    for (let k = 1; k < stations.length; k++) {
      const a = stations[k - 1];
      const b = stations[k];
      along.push(along[k - 1] + Math.abs((a % this.w) - (b % this.w)) + Math.abs(Math.floor(a / this.w) - Math.floor(b / this.w)));
    }
    for (let i = 0; i < stations.length; i++)
      for (let j = 0; j < stations.length; j++)
        if (i !== j) this.addLink(LINK.RAIL, stations[i], stations[j], o.board + (Math.abs(along[i] - along[j]) * 1000) / o.speed, g, o.profiles);
    return g;
  }

  /** Hanging rope between a top and a bottom anchor (capacity 1). */
  addRope(top: number, bottom: number, o: RopeOptions = {}): number {
    const g = this.newGroup(1, 4000);
    const rows = Math.abs(Math.floor(top / this.w) - Math.floor(bottom / this.w));
    this.addLink(LINK.ROPE, bottom, top, 400 + rows * (o.upPerRow ?? 1300), g, o.profiles);
    this.addLink(LINK.ROPE, top, bottom, 400 + rows * (o.downPerRow ?? 700), g, o.profiles);
    return g;
  }

  /** Rope bridge between two anchors (both ways, load limit). */
  addBridge(a: number, b: number, o: BridgeOptions = {}): number {
    const g = this.newGroup(o.capacity ?? 3, 3000);
    const cols = Math.abs((a % this.w) - (b % this.w));
    const rows = Math.abs(Math.floor(a / this.w) - Math.floor(b / this.w));
    const c = (cols + rows) * (o.perTile ?? 560);
    this.addLink(LINK.BRIDGE, a, b, c, g, o.profiles);
    this.addLink(LINK.BRIDGE, b, a, c, g, o.profiles);
    return g;
  }

  /** Fold enabled links into the heuristic so it stays a lower bound for every edge. */
  private updateHeuristics(): void {
    const W = this.w;
    for (let p = 0; p < this.profiles.length; p++) {
      const hc = heuristicCoefficients(this.profiles[p]);
      let f = 1;
      for (let l = 0; l < this.linkCount; l++) {
        if (!this.linkUsable(p, l)) continue;
        const a = this.linkFrom[l];
        const b = this.linkTo[l];
        const dx = Math.abs((a % W) - (b % W));
        const dy = Math.floor(b / W) - Math.floor(a / W);
        const hv = hc.a * dx + (dy > 0 ? hc.down * dy : -hc.up * dy);
        if (hv > this.linkCost[l]) f = Math.min(f, this.linkCost[l] / hv);
      }
      this.hA[p] = Math.floor(hc.a * f);
      this.hUp[p] = Math.floor(hc.up * f);
      this.hDown[p] = Math.floor(hc.down * f);
    }
  }

  // ============================================================ stats

  /** Bytes of the grid's own typed arrays (link table included). */
  bytes(): number {
    let b = this.solid.byteLength + this.infra.byteLength + this.flags.byteLength + this.regionStamp.byteLength;
    for (let p = 0; p < this.profiles.length; p++) b += this.mask[p].byteLength + this.drop[p].byteLength + this.mul[p].byteLength;
    b += this.pending.byteLength + this.visited.byteLength + this.changed.byteLength;
    b += this.linkFrom.byteLength * 6 + this.linkKind.byteLength * 2 + this.linkProfiles.byteLength;
    return b;
  }

  /** Bytes per profile (mask + drop + mul). */
  bytesPerProfile(): number {
    return this.n * 5;
  }
}
