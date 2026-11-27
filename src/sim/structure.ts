/**
 * Roof load, supports and cave-ins (F2-3 stage 3; hazard `cave_ins` of the Limestone Ledges).
 *
 * Model, evaluated per open row r of the grid (rows are independent, so only changed rows are
 * re-evaluated): a horizontal run of open tiles in row r is bounded by solid tiles (walls, rock pillars,
 * the map border). Supports split it: a support stands on the floor of a column and braces that whole
 * column segment if the segment is not taller than `maxHeight` (a truss also covers `reach` columns on
 * each side). A roof tile is a solid tile directly above the run. Its load `d` is the distance (tiles,
 * along the run) to the nearest wall or braced column. It holds while d <= capacity, where
 *   capacity = floor(maxSpan / 2 x naturalSpanMul (natural cave or overhang) x lowRoof.spanMul (drift))
 * so a flat hall of width L holds iff L <= maxSpan. A tile that stops holding starts a countdown of the
 * roof material's `warnSec`; when it runs out the failing roof tiles of that span fall: each failed
 * column fills with rubble from the floor up (at most `rubbleMaxRows`). Rubble columns are walls, so
 * the rest of the hall holds again; a tall hall can collapse in several steps, each one warned.
 *
 * Output for render/UI: `stress` (percent of capacity per roof tile, > 100 = failing), `timer` (ticks
 * to the collapse), `version`; events caveInWarning / caveInAverted / caveIn / buried / support*.
 */
import { CONFIG } from '../config';
import { ROCK_STRENGTH, STRUCTURE, SUPPORTS, type SupportSpec } from '../content/structure';
import { MATERIALS, MAT_COUNT, M, SOLID } from '../world/materials';
import { CAV, FLUID, type World } from '../world/world';
import { CAUSE, type SimBus, type TileChanged } from './events';
import type { WorldMutator } from './world/mutate';
import { rleDecode, rleEncode } from './world/snapshot';

export const SUPPORT_FAIL = { OK: 0, OUT_OF_BOUNDS: 1, NOT_OPEN: 2, NO_FLOOR: 3, OCCUPIED: 4, UNKNOWN: 5 } as const;
export type SupportFail = (typeof SUPPORT_FAIL)[keyof typeof SUPPORT_FAIL];

/** Why a placed support does (not) brace its column (debug and UI). */
export type SupportStatus = 'none' | 'ok' | 'tooTall' | 'noRoof';

const SUPPORT_INDEX = new Map(SUPPORTS.map((s, k) => [s.id, k]));

export interface StructureSave {
  v: 1;
  support: number[];
  stress: number[];
  timer: number[];
  dirtyRows: number[];
  nextId: number;
}

export interface CaveWarning {
  row: number;
  x0: number;
  x1: number;
  tiles: number[];
  ticksLeft: number;
}

export class StructureSystem {
  /** Percent of capacity carried by each roof tile (0 elsewhere; > 100 = failing; capped at 255). */
  readonly stress: Uint8Array;
  /** Ticks until the collapse of each failing roof tile (0 = holds). */
  readonly timer: Uint16Array;
  /** SUPPORTS index + 1 of the support standing in an open tile (on the floor below it). */
  readonly support: Uint8Array;
  /** Bumped whenever stress or timers change (render re-uploads its field). */
  version = 0;
  readonly stats = { rowsEvaluated: 0, warnings: 0, averted: 0, collapses: 0, filled: 0 };
  /** Per open tile: reach of the support bracing its column segment, -1 = none. */
  private readonly anchor: Int8Array;
  private readonly rowDirty: Uint8Array;
  private readonly dirtyRows: Int32Array;
  private nDirty = 0;
  /** Failing roof tiles per row (countdown scans only rows with failures). */
  private readonly rowFail: Uint16Array;
  private readonly dl: Int32Array;
  private readonly dr: Int32Array;
  private readonly mark: Uint8Array;
  private readonly tmp: Int32Array;
  private readonly expired: Int32Array;
  private readonly halfSpan = new Float64Array(MAT_COUNT);
  private readonly warnTicks = new Uint16Array(MAT_COUNT);
  private nextId = 1;
  private inCollapse = false;
  private collapseSupports = 0;

  constructor(
    readonly world: World,
    readonly mut: WorldMutator,
    readonly bus: SimBus,
  ) {
    const { w, h, size } = world;
    this.stress = new Uint8Array(size);
    this.timer = new Uint16Array(size);
    this.support = new Uint8Array(size);
    this.anchor = new Int8Array(size).fill(-1);
    this.rowDirty = new Uint8Array(h);
    this.dirtyRows = new Int32Array(2 * h); // a flush may re-mark every row it already evaluated
    this.rowFail = new Uint16Array(h);
    this.dl = new Int32Array(w);
    this.dr = new Int32Array(w);
    this.mark = new Uint8Array(w);
    this.tmp = new Int32Array(w);
    this.expired = new Int32Array(w);
    for (const m of MATERIALS) {
      if (!m.solid) continue;
      const rs = ROCK_STRENGTH[m.key];
      if (!rs) throw new Error(`structure: no ROCK_STRENGTH for material ${m.key}`);
      this.halfSpan[m.id] = rs.maxSpan / 2;
      this.warnTicks[m.id] = Math.max(1, Math.min(65535, Math.round(rs.warnSec * CONFIG.tickRate)));
    }
    this.rebuildAnchors();
    for (let r = 0; r < h; r++) this.markRow(r);
    bus.on('tileChanged', (e) => this.onTileChanged(e));
  }

  // ------------------------------------------------------------------ queries

  stressAt(x: number, y: number): number {
    return this.world.inBounds(x, y) ? this.stress[y * this.world.w + x]! : 0;
  }

  ticksLeftAt(x: number, y: number): number {
    return this.world.inBounds(x, y) ? this.timer[y * this.world.w + x]! : 0;
  }

  /** Number of failing roof tiles in the world. */
  get failing(): number {
    let n = 0;
    for (let c = 0; c < this.world.h; c++) n += this.rowFail[c]!;
    return n;
  }

  supportAt(x: number, y: number): SupportSpec | null {
    if (!this.world.inBounds(x, y)) return null;
    const s = this.support[y * this.world.w + x]!;
    return s ? SUPPORTS[s - 1]! : null;
  }

  supportStatus(x: number, y: number): SupportStatus {
    const spec = this.supportAt(x, y);
    if (!spec) return 'none';
    const { t, f } = this.segment(x, y);
    if (t === 0 || !this.world.isSolid(x, t - 1)) return 'noRoof';
    return f - t + 1 <= spec.maxHeight ? 'ok' : 'tooTall';
  }

  /** Active warnings grouped by span (allocates; UI and debug). */
  warnings(): CaveWarning[] {
    const out: CaveWarning[] = [];
    const { w } = this.world;
    for (let c = 0; c < this.world.h; c++) {
      if (!this.rowFail[c]) continue;
      for (let x = 0; x < w; x++) {
        if (!this.timer[c * w + x]) continue;
        const { L, R } = this.span(x, c + 1);
        const tiles: number[] = [];
        let ticksLeft = 65535;
        for (let k = L; k <= R; k++) {
          const t = this.timer[c * w + k]!;
          if (!t) continue;
          tiles.push(c * w + k);
          ticksLeft = Math.min(ticksLeft, t);
        }
        out.push({ row: c, x0: L, x1: R, tiles, ticksLeft });
        x = R;
      }
    }
    return out;
  }

  // ----------------------------------------------------------------- commands

  /** Place support `id` (content/structure.ts SUPPORTS) in open tile (x, y) standing on solid floor. */
  placeSupport(x: number, y: number, id: string): SupportFail {
    const w = this.world;
    if (!w.inBounds(x, y)) return SUPPORT_FAIL.OUT_OF_BOUNDS;
    const k = SUPPORT_INDEX.get(id);
    if (k === undefined) return SUPPORT_FAIL.UNKNOWN;
    const i = y * w.w + x;
    if (SOLID[w.mat[i]!]) return SUPPORT_FAIL.NOT_OPEN;
    if (!w.isSolid(x, y + 1)) return SUPPORT_FAIL.NO_FLOOR;
    if (this.support[i]) return SUPPORT_FAIL.OCCUPIED;
    this.support[i] = k + 1;
    this.refreshColumn(x, y, y, true);
    this.bus.emit('supportPlaced', { i, x, y, id });
    return SUPPORT_FAIL.OK;
  }

  removeSupport(x: number, y: number): boolean {
    if (!this.world.inBounds(x, y)) return false;
    const i = y * this.world.w + x;
    if (!this.support[i]) return false;
    this.drop(i, 'removed');
    return true;
  }

  /** Hold failing roofs in a rectangle for `ticks` more (scripted: the king's Lullaby holds the roof). */
  extendTimers(x0: number, y0: number, x1: number, y1: number, ticks: number): number {
    const w = this.world;
    let n = 0;
    for (let y = Math.max(0, y0); y <= Math.min(w.h - 1, y1); y++)
      for (let x = Math.max(0, x0); x <= Math.min(w.w - 1, x1); x++) {
        const i = y * w.w + x;
        if (!this.timer[i]) continue;
        this.timer[i] = Math.min(65535, this.timer[i]! + Math.max(0, Math.round(ticks)));
        n++;
      }
    if (n) this.version++;
    return n;
  }

  /** One sim tick: evaluate changed rows (supports placed this tick still count), count down, collapse. */
  tick(): void {
    this.flush(false);
    const { w, h } = this.world;
    const { timer, rowFail, expired } = this;
    let any = false;
    for (let c = 0; c < h; c++) {
      if (!rowFail[c]) continue;
      any = true;
      const base = c * w;
      let n = 0;
      for (let x = 0; x < w; x++) {
        const t = timer[base + x]!;
        if (t === 1) expired[n++] = base + x;
        else if (t) timer[base + x] = t - 1;
      }
      for (let k = 0; k < n; k++) {
        const ci = expired[k]!;
        if (timer[ci] === 1) this.collapse(ci); // the first tile of a span takes the whole span down
      }
    }
    if (any) this.version++;
  }

  /** Re-evaluate every row now (tools, tests, generator checks). */
  evaluateAll(silent = false): void {
    for (let r = 0; r < this.world.h; r++) this.markRow(r);
    this.flush(silent);
  }

  /**
   * Evaluate the rows changed since the last evaluation, top to bottom. A row marked again from inside
   * an event handler during the pass stays dirty for the next flush.
   */
  flush(silent = false): void {
    const n = this.nDirty;
    if (!n) return;
    const rows = this.dirtyRows.subarray(0, n).sort();
    for (let k = 0; k < n; k++) {
      const r = rows[k]!;
      this.rowDirty[r] = 0;
      this.evaluateRow(r, silent);
    }
    const extra = this.nDirty - n;
    if (extra > 0) this.dirtyRows.copyWithin(0, n, n + extra);
    this.nDirty = extra;
  }

  // ------------------------------------------------------------------ save

  save(): StructureSave {
    const dirtyRows = Array.from(this.dirtyRows.subarray(0, this.nDirty)).sort((a, b) => a - b);
    return { v: 1, support: rleEncode(this.support), stress: rleEncode(this.stress), timer: rleEncode(this.timer), dirtyRows, nextId: this.nextId };
  }

  load(s: StructureSave): void {
    if (s.v !== 1) throw new Error(`structure save v${s.v}: unsupported`);
    rleDecode(s.support, this.support);
    rleDecode(s.stress, this.stress);
    rleDecode(s.timer, this.timer);
    this.nextId = s.nextId;
    const { w, h } = this.world;
    for (let c = 0; c < h; c++) {
      let n = 0;
      for (let x = 0; x < w; x++) if (this.timer[c * w + x]) n++;
      this.rowFail[c] = n;
    }
    this.rebuildAnchors();
    this.rowDirty.fill(0);
    this.nDirty = 0;
    for (const r of s.dirtyRows) this.markRow(r);
    this.version++;
  }

  // --------------------------------------------------------------- internals

  private onTileChanged(e: TileChanged): void {
    const i = e.i;
    const W = this.world.w;
    if (SOLID[e.after]) {
      if (this.support[i]) this.drop(i, 'buried');
    } else if (e.y > 0 && this.support[i - W]) this.drop(i - W, 'floorLost');
    this.refreshColumn(e.x, e.y, e.y, true);
  }

  private drop(i: number, reason: 'removed' | 'floorLost' | 'buried'): void {
    const W = this.world.w;
    const x = i % W;
    const y = (i - x) / W;
    const id = SUPPORTS[this.support[i]! - 1]!.id;
    this.support[i] = 0;
    if (this.inCollapse && reason === 'buried') this.collapseSupports++;
    this.refreshColumn(x, y, y, true);
    this.bus.emit('supportRemoved', { i, x, y, id, reason });
  }

  private markRow(r: number): void {
    if (r < 0 || r >= this.world.h || this.rowDirty[r]) return;
    this.rowDirty[r] = 1;
    this.dirtyRows[this.nDirty++] = r;
  }

  /** Open segment of column x around row y: [t, f] (t > f when (x, y) is solid). */
  private segment(x: number, y: number): { t: number; f: number } {
    const w = this.world;
    let t = y;
    while (t > 0 && !w.isSolid(x, t - 1)) t--;
    let f = y;
    while (f < w.h - 1 && !w.isSolid(x, f + 1)) f++;
    return { t, f };
  }

  /** Sub-run of row r around column x between walls and braced columns. */
  private span(x: number, r: number): { L: number; R: number } {
    const { w, mat } = this.world;
    const row = r * w;
    let L = x;
    while (L > 0 && !SOLID[mat[row + L - 1]!] && this.anchor[row + L - 1]! < 0) L--;
    let R = x;
    while (R < w - 1 && !SOLID[mat[row + R + 1]!] && this.anchor[row + R + 1]! < 0) R++;
    return { L, R };
  }

  private rebuildAnchors(): void {
    for (let x = 0; x < this.world.w; x++) this.refreshColumn(x, 0, this.world.h - 1, false);
  }

  /** Recompute the braced state of the open segments of column x touching rows [y0, y1]. */
  private refreshColumn(x: number, y0: number, y1: number, markRows: boolean): void {
    const { w: W, h: H, mat } = this.world;
    let top = y0;
    while (top > 0 && !SOLID[mat[(top - 1) * W + x]!]) top--;
    let bot = y1;
    while (bot < H - 1 && !SOLID[mat[(bot + 1) * W + x]!]) bot++;
    let y = top;
    while (y <= bot) {
      if (SOLID[mat[y * W + x]!]) {
        this.anchor[y * W + x] = -1;
        y++;
        continue;
      }
      const t = y;
      while (y <= bot && !SOLID[mat[y * W + x]!]) y++;
      const f = y - 1;
      let reach = -1;
      const s = this.support[f * W + x]!;
      if (s && t > 0 && SOLID[mat[(t - 1) * W + x]!]) {
        const spec = SUPPORTS[s - 1]!;
        if (f - t + 1 <= spec.maxHeight) reach = spec.reach;
      }
      for (let k = t; k <= f; k++) this.anchor[k * W + x] = reach;
    }
    if (markRows) for (let r = top; r <= Math.min(H - 1, bot + 1); r++) this.markRow(r);
  }

  /** Capacity (max load distance) of roof tile ci above open tile oi. */
  private capacity(ci: number, oi: number): number {
    const { mat, cav, w, size } = this.world;
    const R = this.halfSpan[mat[ci]!]!;
    if (R === Infinity) return R;
    let mul = 1;
    const cv = cav[oi]!;
    if (cv === CAV.NATURAL || cv === CAV.SKY) mul *= STRUCTURE.naturalSpanMul;
    const lim = STRUCTURE.lowRoof.maxHeight;
    let hgt = 0;
    for (let j = oi; hgt <= lim && j < size && !SOLID[mat[j]!]; j += w) hgt++;
    if (hgt <= lim) mul *= STRUCTURE.lowRoof.spanMul;
    return Math.max(1, Math.floor(R * mul));
  }

  /** Re-evaluate the roof tiles of row r - 1 over the open runs of row r. */
  private evaluateRow(r: number, silent: boolean): void {
    if (r < 1) return;
    const { w: W, mat } = this.world;
    const { stress, timer, anchor, dl, dr, mark, tmp } = this;
    const c = r - 1;
    const base = c * W;
    const rowR = r * W;
    this.stats.rowsEvaluated++;
    for (let x = 0; x < W; x++) {
      mark[x] = timer[base + x]! > 0 ? 1 : 0;
      stress[base + x] = 0;
    }
    let fails = 0;
    let averted: number[] | null = null;
    let x = 0;
    while (x < W) {
      if (SOLID[mat[rowR + x]!]) {
        x++;
        continue;
      }
      const a = x;
      while (x < W && !SOLID[mat[rowR + x]!]) x++;
      const b = x - 1;
      let roofs = 0;
      for (let k = a; k <= b; k++) if (SOLID[mat[base + k]!]) roofs++;
      if (!roofs) continue;
      // distance to the nearest wall (the run ends) or braced column, from both sides
      let run = 1;
      for (let k = a; k <= b; k++) {
        const an = anchor[rowR + k]!;
        if (an >= 0) run = -an;
        dl[k] = run++;
      }
      run = 1;
      for (let k = b; k >= a; k--) {
        const an = anchor[rowR + k]!;
        if (an >= 0) run = -an;
        dr[k] = run++;
      }
      let s0 = a;
      let fresh = 0;
      let old = false;
      let minT = 65535;
      for (let k = a; k <= b + 1; k++) {
        if (k > b || anchor[rowR + k]! >= 0) {
          if (fresh > 0 && !old) this.warn(c, s0, k - 1, fresh, minT, silent);
          s0 = k + 1;
          fresh = 0;
          old = false;
          minT = 65535;
          continue; // a braced column's own roof holds (left unvisited: cleared below)
        }
        const ci = base + k;
        if (!SOLID[mat[ci]!]) continue; // the roof steps up here: no roof tile in this row
        mark[k] = mark[k]! | 2;
        const cap = this.capacity(ci, rowR + k);
        if (cap === Infinity) continue;
        const d = Math.max(0, Math.min(dl[k]!, dr[k]!));
        stress[ci] = Math.min(255, Math.round((100 * d) / cap));
        if (d > cap) {
          fails++;
          if (mark[k]! & 1) {
            old = true;
            minT = Math.min(minT, timer[ci]!);
          } else {
            const t = this.warnTicks[mat[ci]!]!;
            timer[ci] = t;
            minT = Math.min(minT, t);
            tmp[fresh++] = ci;
          }
        } else if (mark[k]! & 1) {
          timer[ci] = 0;
          (averted ??= []).push(ci);
        }
      }
    }
    for (let k = 0; k < W; k++)
      if (mark[k] === 1) {
        timer[base + k] = 0;
        (averted ??= []).push(base + k);
      }
    this.rowFail[c] = fails;
    this.version++;
    if (averted) {
      this.stats.averted += averted.length;
      if (!silent) this.bus.emit('caveInAverted', { row: c, tiles: averted });
    }
  }

  private warn(c: number, x0: number, x1: number, n: number, ticksLeft: number, silent: boolean): void {
    this.stats.warnings++;
    if (silent) return;
    this.bus.emit('caveInWarning', { id: this.nextId++, row: c, x0, x1, tiles: Array.from(this.tmp.subarray(0, n)), ticksLeft });
  }

  /** Rubble material: plain host rock (the dug rock behind the tile, else the roof's), never ore. */
  private rubbleOf(ci: number, oi: number): number {
    const { bg, mat } = this.world;
    const plain = (m: number) => SOLID[m] === 1 && m !== M.BEDROCK && !MATERIALS[m]!.deposit;
    if (plain(bg[oi]!)) return bg[oi]!;
    if (plain(bg[ci]!)) return bg[ci]!;
    if (plain(mat[ci]!)) return mat[ci]!;
    return M.LIMESTONE;
  }

  /** The span of failing roof tile ci falls: fill each failed column from the floor up. */
  private collapse(ci: number): void {
    const w = this.world;
    const { w: W, h: H, mat } = w;
    const x = ci % W;
    const c = (ci - x) / W;
    const r = c + 1;
    const rowR = r * W;
    const { L, R } = this.span(x, r);
    const roof: number[] = [];
    for (let k = L; k <= R; k++) {
      const cj = c * W + k;
      if (this.timer[cj]! > 0 && SOLID[mat[cj]!] && !SOLID[mat[rowR + k]!]) roof.push(cj);
    }
    if (!roof.includes(ci)) {
      // cannot happen after the flush at the start of the tick; never let a stale countdown spin
      this.timer[ci] = 0;
      this.rowFail[c] = Math.max(0, this.rowFail[c]! - 1);
      this.markRow(r);
      if (!roof.length) return;
    }
    const id = this.nextId++;
    const filled: number[] = [];
    let water = 0;
    let lava = 0;
    const props = w.props.length;
    this.inCollapse = true;
    this.collapseSupports = 0;
    for (const cj of roof) {
      const k = cj % W;
      this.timer[cj] = 0;
      this.rowFail[c] = Math.max(0, this.rowFail[c]! - 1);
      const rubble = this.rubbleOf(cj, rowR + k);
      let f = r;
      while (f < H - 1 && !SOLID[mat[(f + 1) * W + k]!]) f++;
      const top = Math.max(r, f - STRUCTURE.rubbleMaxRows + 1);
      for (let y = f; y >= top; y--) {
        const j = y * W + k;
        const fk = w.fluidKind[j]!;
        const fa = w.fluid[j]!;
        if (!this.mut.place(k, y, rubble, CAUSE.COLLAPSE)) continue;
        filled.push(j);
        if (fk === FLUID.WATER) water += fa;
        else if (fk === FLUID.LAVA) lava += fa;
      }
    }
    this.inCollapse = false;
    this.stats.collapses++;
    this.stats.filled += filled.length;
    this.version++;
    this.bus.emit('caveIn', { id, row: c, x0: L, x1: R, roof, filled });
    this.bus.emit('buried', { id, tiles: filled, water, lava, supports: this.collapseSupports, props: props - w.props.length });
  }
}
