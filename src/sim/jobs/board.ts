/**
 * Job board (F2-3 stage 2): player orders and automatic jobs, their priorities (1..9), claims,
 * blacklisting and dependencies. The board decides *what* is open; dwarves decide *who* does it (via a
 * JobChooser) and execute it. One job per dig tile, per build site and per pile (no duplicates).
 *
 * Failed plans: a dwarf whose path to the job is BLOCKED gives the job back and reports the failure;
 * after failures of JOB_RULES.failsToBlacklist different dwarves (fewer in a small colony) the job is
 * SUSPENDED until `blacklistSec` passes or the world changes within ~reopenRadius tiles of it (read
 * from the World change ring, so every dig, cave-in, wall or fluid change counts).
 * Dependencies: a roof warning orders a support (JF.AUTO) and dig jobs under that roof wait for it;
 * they open again when the support stands or the danger is gone.
 */
import { CONFIG } from '../../config';
import { INFRASTRUCTURE } from '../../content/buildings';
import { JOB_RULES } from '../../content/dwarves';
import { SUPPORTS } from '../../content/structure';
import { SOLID } from '../../world/materials';
import { CHANGE, type World } from '../../world/world';
import { DIG_FAIL, type DigSystem } from '../dig';
import type { SimBus, SimEvents } from '../events';
import { RES_IDS, resourceIndex, type ItemPiles } from '../items';
import type { Stockpiles } from '../stockpile';
import type { StructureSystem } from '../structure';
import { rleDecode, rleEncode } from '../world/snapshot';
import { JF, JS, JT, MAX_JOBS, PRIORITY_MAX, PRIORITY_MIN } from './types';

/** A buildable infrastructure piece with its cost resolved to resource indices. */
export interface BuildSpec {
  id: string;
  /** Work units (seconds of an average dwarf). */
  work: number;
  need: readonly { item: number; n: number }[];
  /** Index into SUPPORTS, or -1. */
  support: number;
}

export const BUILD_SPECS: readonly BuildSpec[] = INFRASTRUCTURE.map((d) => ({
  id: d.id,
  work: d.work,
  need: d.cost.map((c) => ({ item: resourceIndex(c.id), n: c.n })),
  support: SUPPORTS.findIndex((s) => s.id === d.id),
}));
export const BUILD_INDEX: ReadonlyMap<string, number> = new Map(BUILD_SPECS.map((b, k) => [b.id, k]));
const MAX_NEEDS = 2;

const ARRAYS = ['type', 'state', 'prio', 'flags', 'target', 'arg', 'claim', 'wait', 'fails', 'failBy', 'reopenAt', 'gen', 'got', 'seq'] as const;

export interface JobsSave {
  v: 1;
  arrays: Record<(typeof ARRAYS)[number], number[]>;
  free: number[];
  hi: number;
  nextSeq: number;
  ringSeen: number;
}

export class JobBoard {
  readonly type = new Uint8Array(MAX_JOBS);
  readonly state = new Uint8Array(MAX_JOBS);
  readonly prio = new Uint8Array(MAX_JOBS);
  readonly flags = new Uint8Array(MAX_JOBS);
  /** Dig tile, build site, or the tile of the hauled pile. */
  readonly target = new Int32Array(MAX_JOBS);
  /** BUILD: BUILD_SPECS index; HAUL: pile index. */
  readonly arg = new Int32Array(MAX_JOBS);
  /** Claiming dwarf + 1 (0 = none). */
  readonly claim = new Int32Array(MAX_JOBS);
  /** Handle of the job this one waits for (0 = none). */
  readonly wait = new Int32Array(MAX_JOBS);
  readonly fails = new Uint8Array(MAX_JOBS);
  /** The different dwarves (+1) whose plans failed, three slots per job. */
  readonly failBy = new Int32Array(MAX_JOBS * 3);
  readonly reopenAt = new Int32Array(MAX_JOBS);
  readonly gen = new Uint16Array(MAX_JOBS);
  /** BUILD: units of each needed material already delivered to the site. */
  readonly got = new Uint16Array(MAX_JOBS * MAX_NEEDS);
  /** Order sequence (older first among equals). */
  readonly seq = new Int32Array(MAX_JOBS);
  private readonly free = new Int32Array(MAX_JOBS);
  private freeTop = 0;
  private hi = 0;
  private nextSeq = 1;
  private readonly digAt: Int32Array;
  private readonly buildAt: Int32Array;
  private readonly haulOf: Int32Array;
  /** Changed 8 x 8 cells since the last tick (reopens suspended jobs nearby). */
  private readonly touched: Uint8Array;
  private readonly touchList: Int32Array;
  private nTouched = 0;
  private touchedAll = false;
  private ringSeen: number;
  private readonly tw: number;
  /** Unreserved units of each resource lying anywhere (BUILD availability), refreshed per tick. */
  readonly avail: Int32Array;
  /** Some stockpile tile has room (HAUL availability), refreshed per tick. */
  hasRoom = false;
  private seenItems = -1;
  private seenZones = -1;
  /** Current tick and colony size (set by the colony each tick). */
  now = 0;
  dwarfCount = 1;
  readonly stats = { ordered: 0, done: 0, cancelled: 0, blacklisted: 0, reopened: 0 };

  constructor(
    readonly world: World,
    readonly bus: SimBus,
    readonly dig: DigSystem,
    readonly structure: StructureSystem,
    readonly items: ItemPiles,
    readonly stockpiles: Stockpiles,
  ) {
    for (let s = MAX_JOBS - 1; s >= 0; s--) this.free[this.freeTop++] = s;
    this.digAt = new Int32Array(world.size);
    this.buildAt = new Int32Array(world.size);
    this.haulOf = new Int32Array(items.cap);
    this.tw = Math.ceil(world.w / 8);
    this.touched = new Uint8Array(this.tw * Math.ceil(world.h / 8));
    this.touchList = new Int32Array(this.touched.length);
    this.ringSeen = world.changeCount;
    this.avail = new Int32Array(RES_IDS.length);
    bus.on('caveInWarning', (e) => this.onWarning(e));
    bus.on('itemsDropped', (e) => this.onDropped(e.i));
  }

  // ------------------------------------------------------------------ handles

  handle(s: number): number {
    return this.gen[s]! * MAX_JOBS + s + 1;
  }

  /** Slot of a live job handle, or -1. */
  slot(h: number): number {
    if (!(h > 0)) return -1;
    const s = (h - 1) % MAX_JOBS;
    return this.state[s] !== JS.FREE && this.gen[s] === Math.floor((h - 1) / MAX_JOBS) ? s : -1;
  }

  /** One past the highest slot ever used. */
  get span(): number {
    return this.hi;
  }

  get openCount(): number {
    let n = 0;
    for (let s = 0; s < this.hi; s++) if (this.state[s] === JS.OPEN) n++;
    return n;
  }

  /** Handle of the dig job on (x, y), or 0. */
  digJobAt(x: number, y: number): number {
    if (!this.world.inBounds(x, y)) return 0;
    const s = this.digAt[y * this.world.w + x]! - 1;
    return s < 0 ? 0 : this.handle(s);
  }

  buildJobAt(x: number, y: number): number {
    if (!this.world.inBounds(x, y)) return 0;
    const s = this.buildAt[y * this.world.w + x]! - 1;
    return s < 0 ? 0 : this.handle(s);
  }

  // ------------------------------------------------------------------ orders

  /** Order digging (x, y). Returns the job handle (an existing one gets the higher priority), or 0. */
  orderDig(x: number, y: number, prio: number = JOB_RULES.defaultPriority, flags = 0): number {
    const w = this.world;
    if (!w.inBounds(x, y)) return 0;
    const i = y * w.w + x;
    const code = this.dig.canDig(x, y, 8);
    if (code === DIG_FAIL.NOT_SOLID || code === DIG_FAIL.UNBREAKABLE) return 0;
    const old = this.digAt[i]! - 1;
    if (old >= 0) {
      this.prio[old] = Math.max(this.prio[old]!, clampPrio(prio));
      this.flags[old] = this.flags[old]! | flags;
      return this.handle(old);
    }
    const s = this.alloc(JT.DIG, i, 0, prio, flags);
    if (s >= 0) this.digAt[i] = s + 1;
    return s < 0 ? 0 : this.emitOrdered(s);
  }

  /** Order infrastructure `id` (content/buildings.ts) at open tile (x, y). Supports need a floor. */
  orderBuild(x: number, y: number, id: string, prio: number = JOB_RULES.defaultPriority, flags = 0): number {
    const w = this.world;
    const b = BUILD_INDEX.get(id);
    if (b === undefined || !w.inBounds(x, y) || w.isSolid(x, y)) return 0;
    if (BUILD_SPECS[b]!.support >= 0 && !w.isSolid(x, y + 1)) return 0;
    const i = y * w.w + x;
    if (this.buildAt[i]) return 0;
    const s = this.alloc(JT.BUILD, i, b, prio, flags);
    if (s >= 0) this.buildAt[i] = s + 1;
    return s < 0 ? 0 : this.emitOrdered(s);
  }

  /** Order hauling pile p to a stockpile (normally automatic). */
  orderHaul(p: number, prio: number = JOB_RULES.haulPriority): number {
    if (p < 0 || p >= this.items.cap || this.items.tile[p]! < 0) return 0;
    const old = this.haulOf[p]! - 1;
    if (old >= 0) return this.handle(old);
    const s = this.alloc(JT.HAUL, this.items.tile[p]!, p, prio, JF.AUTO);
    if (s >= 0) this.haulOf[p] = s + 1;
    return s < 0 ? 0 : this.emitOrdered(s);
  }

  setPriority(h: number, prio: number): boolean {
    const s = this.slot(h);
    if (s < 0) return false;
    this.prio[s] = clampPrio(prio);
    return true;
  }

  /** Cancel a job (the claiming dwarf notices on its next step). */
  cancel(h: number, reason = 'player'): boolean {
    const s = this.slot(h);
    if (s < 0) return false;
    this.end(s, reason);
    return true;
  }

  // --------------------------------------------------------- availability

  /** Is job s open for some dwarf right now (state, target still valid, no danger, materials, room)? */
  isOpen(s: number): boolean {
    if (this.state[s] !== JS.OPEN) return false;
    const w = this.world;
    const i = this.target[s]!;
    const x = i % w.w;
    const y = (i - x) / w.w;
    switch (this.type[s]) {
      case JT.DIG: {
        const code = this.dig.canDig(x, y, 8);
        if (code !== DIG_FAIL.OK && code !== DIG_FAIL.TIER_TOO_LOW) return false;
        if (this.dig.jobAt(x, y)) return false;
        return !this.dangerous(x, y);
      }
      case JT.BUILD: {
        if (w.isSolid(x, y)) return false;
        const b = BUILD_SPECS[this.arg[s]!]!;
        for (let k = 0; k < b.need.length && k < MAX_NEEDS; k++) {
          const left = b.need[k]!.n - this.got[s * MAX_NEEDS + k]!;
          if (left > 0 && this.avail[b.need[k]!.item]! < 1) return false;
        }
        return true;
      }
      case JT.HAUL: {
        const p = this.arg[s]!;
        return this.hasRoom && this.items.tile[p]! >= 0 && this.items.available(p) > 0 && !this.stockpiles.isStorage(this.items.tile[p]!) && !w.isSolid(x, y);
      }
    }
    return false;
  }

  /** Is the work area of solid tile (x, y) under a failing roof? */
  dangerous(x: number, y: number): boolean {
    const st = this.structure;
    return st.dangerAt(x - 1, y) || st.dangerAt(x + 1, y) || st.dangerAt(x, y - 1) || st.dangerAt(x, y + 1);
  }

  /** Materials still missing at a BUILD site: [item, units] pairs (allocates; UI and tests). */
  missing(h: number): [string, number][] {
    const s = this.slot(h);
    if (s < 0 || this.type[s] !== JT.BUILD) return [];
    const b = BUILD_SPECS[this.arg[s]!]!;
    return b.need.map((nd, k) => [RES_IDS[nd.item]!, nd.n - this.got[s * MAX_NEEDS + k]!] as [string, number]).filter(([, n]) => n > 0);
  }

  // ------------------------------------------------------------- lifecycle

  claimJob(s: number, dwarf: number): void {
    this.state[s] = JS.CLAIMED;
    this.claim[s] = dwarf + 1;
    this.bus.emit('jobClaimed', { job: this.handle(s), type: this.type[s]!, dwarf });
  }

  /** Give a job back without blame (danger, a better job, a dead dwarf). */
  unclaim(s: number): void {
    if (this.state[s] !== JS.CLAIMED) return;
    this.state[s] = JS.OPEN;
    this.claim[s] = 0;
  }

  /** The dwarf's plan to reach the job failed; blacklist after enough different dwarves failed. */
  fail(s: number, dwarf: number): void {
    this.unclaim(s);
    const base = s * 3;
    let seen = false;
    for (let k = 0; k < this.fails[s]! && k < 3; k++) if (this.failBy[base + k] === dwarf + 1) seen = true;
    if (!seen && this.fails[s]! < 3) this.failBy[base + this.fails[s]!] = dwarf + 1;
    if (!seen) this.fails[s] = Math.min(255, this.fails[s]! + 1);
    const need = Math.max(1, Math.min(JOB_RULES.failsToBlacklist, this.dwarfCount));
    if (this.fails[s]! >= need) {
      this.state[s] = JS.SUSPENDED;
      this.reopenAt[s] = this.now + Math.round(JOB_RULES.blacklistSec * CONFIG.tickRate);
      this.stats.blacklisted++;
      const { x, y } = this.xy(s);
      this.bus.emit('jobBlacklisted', { job: this.handle(s), type: this.type[s]!, x, y, fails: this.fails[s]! });
    }
  }

  /** The job is finished. HAUL jobs stay open while their pile still has units to move. */
  complete(s: number, dwarf: number): void {
    if (this.type[s] === JT.HAUL) {
      const p = this.arg[s]!;
      if (this.items.tile[p]! >= 0 && this.items.count[p]! > 0 && !this.stockpiles.isStorage(this.items.tile[p]!)) {
        this.state[s] = JS.OPEN;
        this.claim[s] = 0;
        this.target[s] = this.items.tile[p]!;
        return;
      }
    }
    const { x, y } = this.xy(s);
    this.stats.done++;
    this.bus.emit('jobDone', { job: this.handle(s), type: this.type[s]!, x, y, dwarf });
    this.release(s);
  }

  /** Record materials delivered to a BUILD site. */
  deliver(s: number, item: number, n: number): number {
    const b = BUILD_SPECS[this.arg[s]!]!;
    for (let k = 0; k < b.need.length && k < MAX_NEEDS; k++) {
      if (b.need[k]!.item !== item) continue;
      const left = b.need[k]!.n - this.got[s * MAX_NEEDS + k]!;
      const take = Math.min(left, n);
      this.got[s * MAX_NEEDS + k] = this.got[s * MAX_NEEDS + k]! + take;
      return take;
    }
    return 0;
  }

  /** First material still missing at BUILD site s: item index (and `missingN`), or -1 when complete. */
  nextNeed(s: number): number {
    const b = BUILD_SPECS[this.arg[s]!]!;
    for (let k = 0; k < b.need.length && k < MAX_NEEDS; k++) {
      const left = b.need[k]!.n - this.got[s * MAX_NEEDS + k]!;
      if (left > 0) {
        this.missingN = left;
        return b.need[k]!.item;
      }
    }
    this.missingN = 0;
    return -1;
  }
  missingN = 0;

  /** Mark a world change that is not in the World ring (infrastructure built) for reopening. */
  touch(x: number, y: number): void {
    if (!this.world.inBounds(x, y)) return;
    this.touchCell((y >> 3) * this.tw + (x >> 3));
  }

  // ------------------------------------------------------------------ tick

  tick(): void {
    // world changes since the last tick (the change ring) reopen suspended jobs nearby
    if (this.world.changeCount !== this.ringSeen) {
      if (!this.world.changesSince(this.ringSeen, this.onRing)) this.touchedAll = true;
      this.ringSeen = this.world.changeCount;
    }
    if (this.items.version !== this.seenItems || this.stockpiles.version !== this.seenZones) {
      const zonesChanged = this.stockpiles.version !== this.seenZones;
      this.seenItems = this.items.version;
      this.seenZones = this.stockpiles.version;
      this.avail.fill(0);
      const it = this.items;
      for (let p = 0; p < it.span; p++) if (it.tile[p]! >= 0 && !this.world.isSolid(it.tile[p]! % this.world.w, Math.floor(it.tile[p]! / this.world.w))) this.avail[it.item[p]!] = this.avail[it.item[p]!]! + it.available(p);
      this.hasRoom = this.stockpiles.zones.length > 0 && this.stockpiles.totalRoom > 0;
      if (zonesChanged) this.scanLoose();
    }
    const w = this.world;
    for (let s = 0; s < this.hi; s++) {
      const st = this.state[s];
      if (st === JS.FREE) continue;
      const i = this.target[s]!;
      if (st === JS.SUSPENDED) {
        const reason = this.now >= this.reopenAt[s]! ? 'expired' : this.touchedAll || this.nearTouched(i) ? 'worldChanged' : null;
        if (reason) this.reopen(s, reason);
        continue;
      }
      if (st !== JS.OPEN) continue;
      // drop jobs whose target is gone (dug by someone else, pile gone, site walled up)
      const t = this.type[s];
      if (t === JT.DIG && !SOLID[w.mat[i]!]) this.end(s, 'gone');
      else if (t === JT.HAUL && this.items.tile[this.arg[s]!]! < 0) this.end(s, 'gone');
      else if (t === JT.HAUL) this.target[s] = this.items.tile[this.arg[s]!]!;
      else if (t === JT.BUILD && SOLID[w.mat[i]!]) this.end(s, 'blocked');
      else if (this.wait[s] && this.slot(this.wait[s]!) < 0) this.wait[s] = 0;
    }
    for (let k = 0; k < this.nTouched; k++) this.touched[this.touchList[k]!] = 0;
    this.nTouched = 0;
    this.touchedAll = false;
  }

  // ------------------------------------------------------------------ save

  save(): JobsSave {
    const arrays = {} as JobsSave['arrays'];
    for (const k of ARRAYS) arrays[k] = rleEncode(this[k]);
    return { v: 1, arrays, free: Array.from(this.free.subarray(0, this.freeTop)), hi: this.hi, nextSeq: this.nextSeq, ringSeen: this.ringSeen };
  }

  /** Restore; `ringSeen` refers to the world's change counter, which restarts at 0 after a world load. */
  load(s: JobsSave): void {
    if (s.v !== 1) throw new Error(`jobs save v${s.v}: unsupported`);
    for (const k of ARRAYS) rleDecode(s.arrays[k], this[k]);
    this.free.set(s.free);
    this.freeTop = s.free.length;
    this.hi = s.hi;
    this.nextSeq = s.nextSeq;
    this.ringSeen = this.world.changeCount;
    this.digAt.fill(0);
    this.buildAt.fill(0);
    this.haulOf.fill(0);
    for (let j = 0; j < this.hi; j++) {
      if (this.state[j] === JS.FREE) continue;
      if (this.type[j] === JT.DIG) this.digAt[this.target[j]!] = j + 1;
      else if (this.type[j] === JT.BUILD) this.buildAt[this.target[j]!] = j + 1;
      else this.haulOf[this.arg[j]!] = j + 1;
    }
    this.seenItems = -1;
    this.seenZones = -1;
  }

  // ------------------------------------------------------------- internals

  private alloc(type: number, target: number, arg: number, prio: number, flags: number): number {
    if (this.freeTop === 0) return -1;
    const s = this.free[--this.freeTop]!;
    if (s >= this.hi) this.hi = s + 1;
    this.gen[s] = (this.gen[s]! % 65535) + 1;
    this.type[s] = type;
    this.state[s] = JS.OPEN;
    this.prio[s] = clampPrio(prio);
    this.flags[s] = flags;
    this.target[s] = target;
    this.arg[s] = arg;
    this.claim[s] = 0;
    this.wait[s] = 0;
    this.fails[s] = 0;
    this.failBy.fill(0, s * 3, s * 3 + 3);
    this.reopenAt[s] = 0;
    this.got.fill(0, s * MAX_NEEDS, s * MAX_NEEDS + MAX_NEEDS);
    this.seq[s] = this.nextSeq++;
    this.stats.ordered++;
    return s;
  }

  private emitOrdered(s: number): number {
    const h = this.handle(s);
    const { x, y } = this.xy(s);
    this.bus.emit('jobOrdered', { job: h, type: this.type[s]!, x, y, priority: this.prio[s]! });
    return h;
  }

  private xy(s: number): { x: number; y: number } {
    const i = this.target[s]!;
    const x = i % this.world.w;
    return { x, y: (i - x) / this.world.w };
  }

  private end(s: number, reason: string): void {
    const { x, y } = this.xy(s);
    // materials already delivered to a cancelled site are put back on the ground
    if (this.type[s] === JT.BUILD) {
      const b = BUILD_SPECS[this.arg[s]!]!;
      for (let k = 0; k < b.need.length && k < MAX_NEEDS; k++) {
        const n = this.got[s * MAX_NEEDS + k]!;
        if (n > 0) this.items.drop(x, y, b.need[k]!.item, n);
      }
    }
    this.stats.cancelled++;
    this.bus.emit('jobCancelled', { job: this.handle(s), type: this.type[s]!, x, y, reason });
    this.release(s);
  }

  private release(s: number): void {
    const t = this.type[s];
    if (t === JT.DIG && this.digAt[this.target[s]!] === s + 1) this.digAt[this.target[s]!] = 0;
    else if (t === JT.BUILD && this.buildAt[this.target[s]!] === s + 1) this.buildAt[this.target[s]!] = 0;
    else if (t === JT.HAUL && this.haulOf[this.arg[s]!] === s + 1) this.haulOf[this.arg[s]!] = 0;
    this.state[s] = JS.FREE;
    this.claim[s] = 0;
    this.free[this.freeTop++] = s;
  }

  private reopen(s: number, reason: 'expired' | 'worldChanged'): void {
    this.state[s] = JS.OPEN;
    this.fails[s] = 0;
    this.failBy.fill(0, s * 3, s * 3 + 3);
    this.stats.reopened++;
    const { x, y } = this.xy(s);
    this.bus.emit('jobReopened', { job: this.handle(s), type: this.type[s]!, x, y, reason });
  }

  private readonly onRing = (i: number, kind: number): void => {
    if (!(kind & (CHANGE.TERRAIN | CHANGE.FLUID))) return;
    const x = i % this.world.w;
    this.touchCell((((i - x) / this.world.w) >> 3) * this.tw + (x >> 3));
  };

  private touchCell(c: number): void {
    if (this.touched[c]) return;
    this.touched[c] = 1;
    this.touchList[this.nTouched++] = c;
  }

  private nearTouched(i: number): boolean {
    if (!this.nTouched) return false;
    const W = this.world.w;
    const x = i % W;
    const cx = x >> 3;
    const cy = ((i - x) / W) >> 3;
    const r = Math.max(1, Math.ceil(JOB_RULES.reopenRadius / 8));
    const th = this.touched.length / this.tw;
    for (let yy = Math.max(0, cy - r); yy <= Math.min(th - 1, cy + r); yy++)
      for (let xx = Math.max(0, cx - r); xx <= Math.min(this.tw - 1, cx + r); xx++) if (this.touched[yy * this.tw + xx]) return true;
    return false;
  }

  /** Haul jobs for every loose pile (a stockpile appeared or changed). */
  private scanLoose(): void {
    if (!this.stockpiles.zones.length) return;
    const it = this.items;
    for (let p = 0; p < it.span; p++) if (it.tile[p]! >= 0 && !this.stockpiles.isStorage(it.tile[p]!) && !this.haulOf[p]) this.orderHaul(p);
  }

  private onDropped(i: number): void {
    if (!this.stockpiles.zones.length || this.stockpiles.isStorage(i)) return;
    for (let p = this.items.first(i); p >= 0; p = this.items.nextOf(p)) if (!this.haulOf[p]) this.orderHaul(p);
  }

  /** A roof started failing: order a support under it; dig jobs there wait for it. */
  private onWarning(e: SimEvents['caveInWarning']): void {
    if (!JOB_RULES.autoSupport || !e.tiles.length) return;
    const w = this.world;
    const mid = e.tiles[e.tiles.length >> 1]!;
    const cx = mid % w.w;
    let f = e.row + 1;
    while (f + 1 < w.h && !w.isSolid(cx, f + 1)) f++;
    const height = f - e.row;
    const spec = SUPPORTS.find((s) => s.maxHeight >= height);
    if (!spec) return;
    let h = 0;
    for (let s = 0; s < this.hi && !h; s++) {
      if (this.state[s] === JS.FREE || this.type[s] !== JT.BUILD || BUILD_SPECS[this.arg[s]!]!.support < 0) continue;
      const tx = this.target[s]! % w.w;
      const ty = Math.floor(this.target[s]! / w.w);
      if (tx >= e.x0 && tx <= e.x1 && ty > e.row && ty <= f) h = this.handle(s);
    }
    if (!h) h = this.orderBuild(cx, f, spec.id, JOB_RULES.supportPriority, JF.AUTO);
    if (!h) return;
    for (let s = 0; s < this.hi; s++) {
      if (this.state[s] === JS.FREE || this.type[s] !== JT.DIG) continue;
      const tx = this.target[s]! % w.w;
      const ty = Math.floor(this.target[s]! / w.w);
      if (tx >= e.x0 - 1 && tx <= e.x1 + 1 && ty >= e.row && ty <= f + 1) this.wait[s] = h;
    }
  }
}

function clampPrio(p: number): number {
  return Math.max(PRIORITY_MIN, Math.min(PRIORITY_MAX, Math.round(p)));
}
