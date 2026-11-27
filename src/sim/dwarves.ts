/**
 * Dwarves as agents (F2-3 stage 2). Each dwarf has a position (its NavAgent's feet cell), a pick
 * (tier and speed), a load (one resource) and a job from the board. Loop: choose a job (JobChooser)
 * -> walk (NavAgent + shared NavPlanner) -> work (DigSystem / build timer / pick up, drop) -> report.
 *
 * States (DS): IDLE -> GOTO -> WORK -> IDLE; FLEE from under a failing roof; STUNNED after a harmful
 * fall; BURIED under rubble (rescue dig jobs are ordered at once; trapped dwarves lose health);
 * DEAD. Work spots are reserved (one dwarf per spot), pile units and stockpile room are reserved
 * before setting off, a failed plan gives the job back to the board (blacklisting) and the dwarf
 * avoids that job for a while. Everything runs in dwarf index order: deterministic.
 */
import { CONFIG, TICK_DT } from '../config';
import { DWARF_STATS, JOB_RULES, WORK_DEFAULT, WORK_TYPES, type WorkType } from '../content/dwarves';
import { SOLID } from '../world/materials';
import type { World } from '../world/world';
import { DIG_FAIL, HANDS, JOB, pickTool, type DigSystem } from './dig';
import type { SimBus } from './events';
import { stackOf, type ItemPiles } from './items';
import { BUILD_SPECS, type JobBoard } from './jobs/board';
import { PriorityDistanceChooser, type DwarfView, type JobChooser } from './jobs/chooser';
import { JF, JS, JT, WORK_INDEX } from './jobs/types';
import { AGENT, INFRA_BY_CONTENT, NavAgent, workSpots, type NavGrid, type NavPlanner, type PathFinder } from './nav';
import { loadAgent, saveAgent, type AgentSave } from './navsave';
import type { Stockpiles } from './stockpile';
import type { StructureSystem } from './structure';
import { rleDecode, rleEncode } from './world/snapshot';

export const DS = { IDLE: 0, GOTO: 1, WORK: 2, FLEE: 3, STUNNED: 4, BURIED: 5, DEAD: 6 } as const;
/** Sub-steps of a job. */
export const STEP = { NONE: 0, TO_SITE: 1, TO_PILE: 2, TO_DEST: 3 } as const;

const TICK_MS = 1000 / CONFIG.tickRate;
const NW = WORK_TYPES.length;
const ARRAYS = ['state', 'hp', 'job', 'step', 'spot', 'digH', 'work', 'carryItem', 'carryN', 'pile', 'dest', 'plan', 'pickTier', 'pickSpeed', 'stun', 'thinkAt', 'avoidJob', 'avoidUntil', 'prio', 'falls'] as const;

export interface DwarvesSave {
  v: 1;
  n: number;
  arrays: Record<(typeof ARRAYS)[number], number[]>;
  spotOwner: number[];
  agents: AgentSave[];
}

export class Dwarves implements DwarfView {
  readonly cap: number;
  n = 0;
  readonly agents: NavAgent[] = [];
  readonly state: Uint8Array;
  readonly hp: Float64Array;
  /** Board job handle (0 = none). */
  readonly job: Int32Array;
  readonly step: Uint8Array;
  /** Reserved work spot cell (-1 = none). */
  readonly spot: Int32Array;
  /** DigSystem handle while digging. */
  readonly digH: Int32Array;
  /** Build work units left. */
  readonly work: Float64Array;
  /** Carried resource index (-1 = nothing) and units. */
  readonly carryItem: Int32Array;
  readonly carryN: Int32Array;
  /** Planned pickup: pile index, destination tile (haul) and units reserved. */
  readonly pile: Int32Array;
  readonly dest: Int32Array;
  readonly plan: Int32Array;
  readonly pickTier: Uint8Array;
  readonly pickSpeed: Float64Array;
  readonly stun: Int32Array;
  readonly thinkAt: Int32Array;
  readonly avoidJob: Int32Array;
  readonly avoidUntil: Int32Array;
  /** Personal priority per work type (cap x WORK_TYPES.length), 0 = never. */
  readonly prio: Uint8Array;
  /** NavAgent.falls already accounted for. */
  readonly falls: Int32Array;
  private readonly spotOwner: Int32Array;
  private readonly goals = new Int32Array(64);
  private readonly spots = new Int32Array(64);
  private readonly cand = new Int32Array(8);
  /** Movement profile index of dwarves in the grid. */
  readonly p: number;
  private readonly height: number;
  now = 0;
  readonly stats = { jobs: 0, falls: 0, injured: 0, deaths: 0, buried: 0, rescued: 0, fled: 0, navFails: 0, spotConflicts: 0 };

  constructor(
    readonly world: World,
    readonly bus: SimBus,
    readonly grid: NavGrid,
    readonly finder: PathFinder,
    readonly planner: NavPlanner,
    readonly dig: DigSystem,
    readonly structure: StructureSystem,
    readonly board: JobBoard,
    readonly items: ItemPiles,
    readonly stockpiles: Stockpiles,
    readonly chooser: JobChooser = new PriorityDistanceChooser(),
    cap = 256,
  ) {
    this.cap = cap;
    this.state = new Uint8Array(cap);
    this.hp = new Float64Array(cap);
    this.job = new Int32Array(cap);
    this.step = new Uint8Array(cap);
    this.spot = new Int32Array(cap).fill(-1);
    this.digH = new Int32Array(cap);
    this.work = new Float64Array(cap);
    this.carryItem = new Int32Array(cap).fill(-1);
    this.carryN = new Int32Array(cap);
    this.pile = new Int32Array(cap).fill(-1);
    this.dest = new Int32Array(cap).fill(-1);
    this.plan = new Int32Array(cap);
    this.pickTier = new Uint8Array(cap);
    this.pickSpeed = new Float64Array(cap);
    this.stun = new Int32Array(cap);
    this.thinkAt = new Int32Array(cap);
    this.avoidJob = new Int32Array(cap);
    this.avoidUntil = new Int32Array(cap);
    this.prio = new Uint8Array(cap * NW);
    this.falls = new Int32Array(cap);
    this.spotOwner = new Int32Array(world.size);
    this.p = finder.profile;
    this.height = grid.profiles[this.p]!.height;
  }

  // ------------------------------------------------------------------ DwarfView

  cellOf(d: number): number {
    return this.agents[d]!.cell;
  }

  pickTierOf(d: number): number {
    return this.pickTier[d]!;
  }

  workPriority(d: number, work: number): number {
    return this.prio[d * NW + work]!;
  }

  avoids(d: number, h: number): boolean {
    return this.avoidJob[d] === h && this.now < this.avoidUntil[d]!;
  }

  get alive(): number {
    let n = 0;
    for (let d = 0; d < this.n; d++) if (this.state[d] !== DS.DEAD) n++;
    return n;
  }

  // ------------------------------------------------------------------ commands

  /** Add a dwarf standing at (x, y) (it drops to the floor if needed). Returns its id or -1. */
  spawn(x: number, y: number, pick: string | null = DWARF_STATS.startPick): number {
    if (this.n >= this.cap || !this.world.inBounds(x, y)) return -1;
    let cell = y * this.world.w + x;
    if (!this.grid.standable(this.p, cell)) {
      cell = this.grid.landing(this.p, x, y);
      if (cell < 0) return -1;
    }
    const d = this.n++;
    this.state[d] = DS.IDLE;
    this.hp[d] = DWARF_STATS.hp;
    for (let k = 0; k < NW; k++) this.prio[d * NW + k] = WORK_DEFAULT[WORK_TYPES[k]!];
    this.thinkAt[d] = this.now + (d % this.thinkTicks);
    this.agents.push(new NavAgent(this.finder, cell, this.planner));
    this.setPick(d, pick);
    this.bus.emit('dwarfSpawned', { dwarf: d, x: cell % this.world.w, y: Math.floor(cell / this.world.w) });
    return d;
  }

  /** Equip a pick (content item id) or bare hands (null); a running dig continues with it. */
  setPick(d: number, itemId: string | null): void {
    const t = (itemId && pickTool(itemId)) || HANDS;
    this.pickTier[d] = t.pickTier;
    this.pickSpeed[d] = t.workSpeed;
    if (this.digH[d]) this.dig.setTool(this.digH[d]!, t, DWARF_STATS.workMul);
  }

  setWorkPriority(d: number, work: WorkType, prio: number): void {
    this.prio[d * NW + WORK_INDEX[work]] = Math.max(0, Math.min(9, Math.round(prio)));
  }

  // ------------------------------------------------------------------ tick

  /** Decisions and actions (before the planner runs). */
  think(): void {
    const failing = this.structure.failing > 0;
    for (let d = 0; d < this.n; d++) {
      const st = this.state[d];
      if (st === DS.DEAD) continue;
      if (st === DS.BURIED) {
        if (!this.bodyBlocked(d)) this.rescued(d);
        else {
          this.hp[d] = this.hp[d]! - DWARF_STATS.buriedPerSec * TICK_DT;
          if (this.hp[d]! <= 0) this.die(d, 'buried');
        }
        continue;
      }
      if (this.bodyBlocked(d)) {
        this.bury(d);
        continue;
      }
      if (st === DS.STUNNED) {
        if (--this.stun[d]! <= 0) this.state[d] = DS.IDLE;
        continue;
      }
      if (failing && st !== DS.FLEE && this.inDanger(d) && !this.brave(d)) {
        this.flee(d);
        continue;
      }
      if (st === DS.IDLE) {
        if (this.now >= this.thinkAt[d]! && !this.pickJob(d)) this.thinkAt[d] = this.now + this.thinkTicks;
      } else if (st === DS.GOTO) this.goto(d);
      else if (st === DS.WORK) this.doWork(d);
      else if (st === DS.FLEE) {
        const a = this.agents[d]!;
        if (a.state === AGENT.ARRIVED || a.state === AGENT.BLOCKED || a.state === AGENT.IDLE || !this.inDanger(d)) {
          this.state[d] = DS.IDLE;
          this.thinkAt[d] = this.now + 1;
        }
      }
    }
  }

  /** Movement, falls and gravity (after the planner ran). */
  move(): void {
    const g = this.grid;
    for (let d = 0; d < this.n; d++) {
      const st = this.state[d];
      if (st === DS.DEAD || st === DS.BURIED) continue;
      const a = this.agents[d]!;
      if (st === DS.GOTO || st === DS.FLEE) {
        a.speed = this.carryN[d]! > 0 ? DWARF_STATS.loadedSpeed : 1;
        a.tick(TICK_MS);
        if (a.state === AGENT.LOST) {
          this.die(d, 'lost');
          continue;
        }
        if (a.falls !== this.falls[d]) {
          this.falls[d] = a.falls;
          this.landed(d, a.lastFall);
        }
      } else if (!g.standable(this.p, a.cell)) {
        // standing still while the floor went away
        const x = a.cell % g.w;
        const land = g.landing(this.p, x, (a.cell - x) / g.w);
        if (land < 0) {
          this.die(d, 'lost');
          continue;
        }
        const rows = g.lastFall;
        a.cell = land;
        if (st === DS.WORK) this.abandon(d, false);
        this.landed(d, rows);
      }
    }
  }

  // ------------------------------------------------------------------ save

  save(): DwarvesSave {
    const arrays = {} as DwarvesSave['arrays'];
    for (const k of ARRAYS) arrays[k] = rleEncode(this[k].subarray(0, k === 'prio' ? this.n * NW : this.n));
    return { v: 1, n: this.n, arrays, spotOwner: rleEncode(this.spotOwner), agents: this.agents.map(saveAgent) };
  }

  load(s: DwarvesSave): void {
    if (s.v !== 1) throw new Error(`dwarves save v${s.v}: unsupported`);
    this.n = s.n;
    for (const k of ARRAYS) rleDecode(s.arrays[k], this[k].subarray(0, k === 'prio' ? this.n * NW : this.n));
    rleDecode(s.spotOwner, this.spotOwner);
    this.agents.length = 0;
    for (const as of s.agents) {
      const a = new NavAgent(this.finder, as.cell, this.planner);
      loadAgent(a, as);
      this.agents.push(a);
    }
  }

  // --------------------------------------------------------------- internals

  private get thinkTicks(): number {
    return Math.max(1, Math.round(JOB_RULES.thinkSec * CONFIG.tickRate));
  }

  private xy(cell: number): [number, number] {
    const x = cell % this.world.w;
    return [x, (cell - x) / this.world.w];
  }

  private bodyBlocked(d: number): boolean {
    const w = this.world;
    for (let k = 0, c = this.agents[d]!.cell; k < this.height && c >= 0; k++, c -= w.w) if (SOLID[w.mat[c]!]) return true;
    return false;
  }

  private inDanger(d: number): boolean {
    const [x, y] = this.xy(this.agents[d]!.cell);
    return this.structure.dangerAt(x, y);
  }

  /**
   * Keeps working under a failing roof (a support to stand, a buried friend to dig out) while more of
   * the countdown is left than the work needs plus JOB_RULES.braveMarginSec.
   */
  private brave(d: number): boolean {
    const b = this.board;
    const s = b.slot(this.job[d]!);
    if (s < 0) return false;
    const i = b.target[s]!;
    const [x, y] = this.xy(i);
    let work: number;
    let left: number;
    if (b.type[s] === JT.BUILD) {
      const spec = BUILD_SPECS[b.arg[s]!]!;
      if (spec.support < 0) return false;
      work = (this.state[d] === DS.WORK ? this.work[d]! : spec.work + 4) / DWARF_STATS.workMul;
      left = this.structure.countdownAt(x, y);
    } else if (b.type[s] === JT.DIG && b.flags[s]! & JF.RESCUE) {
      work = (this.dig.required(i) - this.dig.progress[i]!) / Math.max(0.05, this.pickSpeed[d]! * DWARF_STATS.workMul) + 2;
      const [dx, dy] = this.xy(this.agents[d]!.cell);
      left = Math.max(this.structure.countdownAt(dx, dy), this.structure.countdownAt(x, y));
    } else return false;
    return left > (work + JOB_RULES.braveMarginSec) * CONFIG.tickRate;
  }

  private pickJob(d: number): boolean {
    const n = this.chooser.candidates(d, this.board, this, this.cand);
    for (let k = 0; k < n; k++) if (this.begin(d, this.cand[k]!)) return true;
    return false;
  }

  private begin(d: number, s: number): boolean {
    const b = this.board;
    const t = b.type[s];
    const [x, y] = this.xy(b.target[s]!);
    if (t === JT.DIG) {
      const g = this.freeSpots(d, x, y);
      if (!g) return false;
      this.claim(d, s, STEP.TO_SITE);
      this.agents[d]!.go(this.goals.subarray(0, g));
      return true;
    }
    if (t === JT.BUILD) {
      this.job[d] = b.handle(s); // brave() reads the job
      const ok = !(BUILD_SPECS[b.arg[s]!]!.support >= 0 && this.structure.dangerAt(x, y) && !this.brave(d));
      this.job[d] = 0;
      return ok && this.buildLeg(d, s, true);
    }
    // HAUL
    const p = b.arg[s]!;
    const from = this.items.tile[p]!;
    const dest = this.stockpiles.nearest(from);
    if (dest < 0) return false;
    const k = Math.min(this.items.available(p), DWARF_STATS.carry, stackOf(this.items.item[p]!), this.stockpiles.room(dest));
    if (k <= 0) return false;
    const g = this.reachSpots(from);
    if (!g) return false;
    this.claim(d, s, STEP.TO_PILE);
    this.items.reserve(p, k);
    this.stockpiles.book(dest, k);
    this.pile[d] = p;
    this.dest[d] = dest;
    this.plan[d] = k;
    this.agents[d]!.go(this.goals.subarray(0, g));
    return true;
  }

  /** Next leg of a build: fetch a missing material, or go to the site to work. */
  private buildLeg(d: number, s: number, fresh: boolean): boolean {
    const b = this.board;
    const item = b.nextNeed(s);
    if (item >= 0) {
      const p = this.nearestPile(this.agents[d]!.cell, item);
      if (p < 0) return fresh ? false : this.abandon(d, false);
      const k = Math.min(b.missingN, DWARF_STATS.carry, stackOf(item), this.items.available(p));
      const g = this.reachSpots(this.items.tile[p]!);
      if (!g || k <= 0) return fresh ? false : this.abandon(d, false);
      if (fresh) this.claim(d, s, STEP.TO_PILE);
      else this.step[d] = STEP.TO_PILE;
      this.items.reserve(p, k);
      this.pile[d] = p;
      this.plan[d] = k;
      this.agents[d]!.go(this.goals.subarray(0, g));
      return true;
    }
    const [x, y] = this.xy(b.target[s]!);
    const g = this.freeSpots(d, x, y);
    if (!g) return fresh ? false : this.abandon(d, false);
    if (fresh) this.claim(d, s, STEP.TO_SITE);
    else {
      this.step[d] = STEP.TO_SITE;
      this.state[d] = DS.GOTO;
    }
    this.agents[d]!.go(this.goals.subarray(0, g));
    return true;
  }

  private claim(d: number, s: number, step: number): void {
    this.board.claimJob(s, d);
    this.job[d] = this.board.handle(s);
    this.step[d] = step;
    this.state[d] = DS.GOTO;
    this.stats.jobs++;
  }

  private goto(d: number): void {
    const b = this.board;
    const s = b.slot(this.job[d]!);
    if (s < 0 || b.state[s] !== JS.CLAIMED || b.claim[s] !== d + 1) {
      this.abandon(d, false); // cancelled meanwhile
      return;
    }
    const a = this.agents[d]!;
    if (this.step[d] === STEP.TO_SITE && this.spot[d]! < 0 && (a.state === AGENT.MOVING || a.state === AGENT.ARRIVED)) {
      // reserve the work spot the path leads to; if another dwarf holds it, plan again without it
      const dst = a.path.length ? a.path.cells[a.path.length - 1]! : a.cell;
      const owner = this.spotOwner[dst]!;
      if (owner && owner !== d + 1) {
        this.stats.spotConflicts++;
        const [x, y] = this.xy(b.target[s]!);
        const g = this.freeSpots(d, x, y);
        if (!g) this.abandon(d, false);
        else a.go(this.goals.subarray(0, g));
        return;
      }
      this.spotOwner[dst] = d + 1;
      this.spot[d] = dst;
    }
    if (a.state === AGENT.ARRIVED) this.arrive(d, s);
    else if (a.state === AGENT.BLOCKED) this.navFail(d, s);
  }

  private arrive(d: number, s: number): void {
    const b = this.board;
    const t = b.type[s];
    const step = this.step[d];
    const [x, y] = this.xy(b.target[s]!);
    if (t === JT.DIG) {
      const h = this.dig.start(x, y, d, { pickTier: this.pickTier[d]!, workSpeed: this.pickSpeed[d]! }, DWARF_STATS.workMul);
      if (h > 0) {
        this.digH[d] = h;
        this.state[d] = DS.WORK;
      } else {
        this.avoid(d);
        this.abandon(d, false);
      }
      return;
    }
    if (step === STEP.TO_PILE) {
      const p = this.pile[d]!;
      const item = this.items.item[p]!;
      const took = this.items.tile[p]! >= 0 ? this.items.take(p, this.plan[d]!, d) : 0;
      this.pile[d] = -1;
      if (took <= 0) {
        this.releasePlan(d);
        this.abandon(d, false);
        return;
      }
      this.carryItem[d] = item;
      this.carryN[d] = took;
      if (t === JT.HAUL) {
        const g = this.reachSpots(this.dest[d]!);
        if (!g) {
          this.abandon(d, false);
          return;
        }
        this.step[d] = STEP.TO_DEST;
        this.agents[d]!.go(this.goals.subarray(0, g));
      } else {
        this.plan[d] = 0;
        this.buildLeg2(d, s);
      }
      return;
    }
    if (t === JT.HAUL && step === STEP.TO_DEST) {
      const dest = this.dest[d]!;
      const [dx, dy] = this.xy(dest);
      this.stockpiles.unbook(dest, this.plan[d]!);
      const item = this.carryItem[d]!;
      const n = this.carryN[d]!;
      const at = this.items.drop(dx, dy, item, n);
      this.carryItem[d] = -1;
      this.carryN[d] = 0;
      this.dest[d] = -1;
      this.plan[d] = 0;
      if (at >= 0) this.bus.emit('itemsStored', { i: at, item: this.itemId(item), n, dwarf: d });
      b.complete(s, d);
      this.reset(d);
      return;
    }
    // BUILD at the site: deliver what is carried, fetch more or start working
    if (this.carryN[d]! > 0) {
      const used = b.deliver(s, this.carryItem[d]!, this.carryN[d]!);
      this.carryN[d] = this.carryN[d]! - used;
      this.dropLoad(d);
    }
    if (b.nextNeed(s) >= 0) {
      this.releaseSpot(d);
      this.buildLeg(d, s, false);
      return;
    }
    this.work[d] = BUILD_SPECS[b.arg[s]!]!.work;
    this.state[d] = DS.WORK;
  }

  /** After a pickup for a build: head for the site. */
  private buildLeg2(d: number, s: number): void {
    const [x, y] = this.xy(this.board.target[s]!);
    const g = this.freeSpots(d, x, y);
    if (!g) {
      this.abandon(d, false);
      return;
    }
    this.step[d] = STEP.TO_SITE;
    this.agents[d]!.go(this.goals.subarray(0, g));
  }

  private doWork(d: number): void {
    const b = this.board;
    const s = b.slot(this.job[d]!);
    if (s < 0 || b.claim[s] !== d + 1) {
      this.abandon(d, false);
      return;
    }
    const [x, y] = this.xy(b.target[s]!);
    if (b.type[s] === JT.DIG) {
      if (!this.world.isSolid(x, y)) {
        this.digH[d] = 0;
        b.complete(s, d);
        this.reset(d);
        return;
      }
      if (this.dig.state(this.digH[d]!) === JOB.BLOCKED) {
        const reason = this.dig.reason(this.digH[d]!);
        if (reason !== DIG_FAIL.NOT_SOLID) this.avoid(d);
        this.abandon(d, false);
      } else if (this.dig.state(this.digH[d]!) === JOB.FREE) this.abandon(d, false);
      return;
    }
    // BUILD
    this.work[d] = this.work[d]! - DWARF_STATS.workMul * TICK_DT;
    if (this.work[d]! > 1e-9) return;
    const spec = BUILD_SPECS[b.arg[s]!]!;
    const h = b.handle(s);
    if (spec.support >= 0) {
      if (this.structure.placeSupport(x, y, spec.id) !== 0) b.cancel(h, 'blocked');
      else b.complete(s, d);
    } else {
      const code = INFRA_BY_CONTENT[spec.id];
      if (code !== undefined) {
        this.grid.setInfra(x, y, code);
        b.touch(x, y);
      }
      b.complete(s, d);
    }
    this.reset(d);
  }

  private navFail(d: number, s: number): void {
    this.stats.navFails++;
    this.avoid(d);
    this.releasePlan(d);
    this.dropLoad(d);
    this.board.fail(s, d);
    this.reset(d);
    this.thinkAt[d] = this.now + 1;
  }

  /** Give the job back (without blame); releases reservations and puts the load down. Returns false. */
  private abandon(d: number, blame: boolean): false {
    const s = this.board.slot(this.job[d]!);
    if (this.digH[d]) {
      this.dig.cancel(this.digH[d]!);
      this.digH[d] = 0;
    }
    this.releasePlan(d);
    this.dropLoad(d);
    if (s >= 0 && this.board.claim[s] === d + 1) {
      if (blame) this.board.fail(s, d);
      else this.board.unclaim(s);
    }
    this.reset(d);
    return false;
  }

  private avoid(d: number): void {
    this.avoidJob[d] = this.job[d]!;
    this.avoidUntil[d] = this.now + Math.round(JOB_RULES.avoidSec * CONFIG.tickRate);
  }

  private reset(d: number): void {
    this.releaseSpot(d);
    this.job[d] = 0;
    this.step[d] = STEP.NONE;
    this.digH[d] = 0;
    this.work[d] = 0;
    if (this.state[d] !== DS.DEAD && this.state[d] !== DS.BURIED && this.state[d] !== DS.STUNNED) this.state[d] = DS.IDLE;
  }

  private releaseSpot(d: number): void {
    const c = this.spot[d]!;
    if (c >= 0 && this.spotOwner[c] === d + 1) this.spotOwner[c] = 0;
    this.spot[d] = -1;
  }

  private releasePlan(d: number): void {
    if (this.pile[d]! >= 0) this.items.unreserve(this.pile[d]!, this.plan[d]!);
    if (this.dest[d]! >= 0) this.stockpiles.unbook(this.dest[d]!, this.plan[d]!);
    this.pile[d] = -1;
    this.dest[d] = -1;
    this.plan[d] = 0;
  }

  private dropLoad(d: number): void {
    if (this.carryN[d]! <= 0) {
      this.carryItem[d] = -1;
      this.carryN[d] = 0;
      return;
    }
    const [x, y] = this.xy(this.agents[d]!.cell);
    if (!this.world.isSolid(x, y)) this.items.drop(x, y, this.carryItem[d]!, this.carryN[d]!);
    this.carryItem[d] = -1;
    this.carryN[d] = 0;
  }

  private landed(d: number, rows: number): void {
    const dmg = Math.max(0, rows - CONFIG.maxSafeDrop) * DWARF_STATS.fallDamagePerRow;
    this.stats.falls++;
    const [x, y] = this.xy(this.agents[d]!.cell);
    this.bus.emit('dwarfFell', { dwarf: d, x, y, rows, damage: dmg });
    if (dmg <= 0) return;
    this.stats.injured++;
    this.hp[d] = this.hp[d]! - dmg;
    if (this.hp[d]! <= 0) {
      this.die(d, 'fall');
      return;
    }
    this.abandon(d, false);
    this.state[d] = DS.STUNNED;
    this.stun[d] = Math.max(1, Math.round(DWARF_STATS.fallStunSec * CONFIG.tickRate));
  }

  private flee(d: number): void {
    if (this.job[d]) this.abandon(d, false);
    const w = this.world;
    const [x, y] = this.xy(this.agents[d]!.cell);
    let n = 0;
    for (let dy = 0; dy <= 2 && n === 0; dy++)
      for (const yy of dy === 0 ? [y] : [y - dy, y + dy])
        for (let r = 1; r <= JOB_RULES.fleeRadius && n < 8; r++)
          for (const xx of [x - r, x + r]) {
            if (xx < 0 || xx >= w.w || yy < 0 || yy >= w.h || n >= 8) continue;
            const c = yy * w.w + xx;
            if (this.grid.standable(this.p, c) && !this.structure.dangerAt(xx, yy)) this.goals[n++] = c;
          }
    if (!n) {
      this.thinkAt[d] = this.now + this.thinkTicks;
      return;
    }
    this.state[d] = DS.FLEE;
    this.stats.fled++;
    this.agents[d]!.go(this.goals.subarray(0, n));
    this.bus.emit('dwarfFled', { dwarf: d, x, y });
  }

  private bury(d: number): void {
    this.abandon(d, false);
    this.state[d] = DS.BURIED;
    this.stats.buried++;
    this.hp[d] = this.hp[d]! - DWARF_STATS.buriedHit;
    const [x, y] = this.xy(this.agents[d]!.cell);
    this.bus.emit('dwarfBuried', { dwarf: d, x, y });
    this.orderRescue(x, y);
    if (this.hp[d]! <= 0) this.die(d, 'buried');
  }

  /** Dig out the body tiles and a two-high tunnel from the nearest open side. */
  private orderRescue(x: number, y: number): void {
    const w = this.world;
    const P = JOB_RULES.rescuePriority;
    for (let k = 0; k < this.height; k++) if (w.isSolid(x, y - k)) this.board.orderDig(x, y - k, P, JF.RESCUE);
    let best = 0;
    for (let r = 1; r <= 16 && !best; r++)
      for (const side of [-1, 1]) if (!best && w.inBounds(x + side * r, y) && !w.isSolid(x + side * r, y)) best = side * r;
    if (!best) return;
    const side = Math.sign(best);
    for (let r = 1; r < Math.abs(best); r++)
      for (let k = 0; k < this.height; k++) if (w.isSolid(x + side * r, y - k)) this.board.orderDig(x + side * r, y - k, P, JF.RESCUE);
  }

  private rescued(d: number): void {
    this.state[d] = DS.IDLE;
    this.thinkAt[d] = this.now + 1;
    this.stats.rescued++;
    const [x, y] = this.xy(this.agents[d]!.cell);
    this.bus.emit('dwarfRescued', { dwarf: d, x, y });
  }

  private die(d: number, cause: 'fall' | 'buried' | 'lost'): void {
    if (this.state[d] !== DS.BURIED) this.abandon(d, false);
    this.releasePlan(d);
    this.releaseSpot(d);
    this.state[d] = DS.DEAD;
    this.hp[d] = 0;
    this.stats.deaths++;
    const [x, y] = this.xy(this.agents[d]!.cell);
    this.bus.emit('dwarfDied', { dwarf: d, x, y, cause });
  }

  /** Free work spots for tile (x, y) into `goals`; returns the count. */
  private freeSpots(d: number, x: number, y: number): number {
    const n = workSpots(this.grid, this.p, x, y, this.spots);
    let k = 0;
    for (let j = 0; j < n; j++) {
      const c = this.spots[j]!;
      const o = this.spotOwner[c]!;
      if (!o || o === d + 1) this.goals[k++] = c;
    }
    return k;
  }

  /** Cells from which a dwarf picks up or drops at tile i: the tile itself (if standable) and its work spots. */
  private reachSpots(i: number): number {
    const [x, y] = this.xy(i);
    let k = 0;
    if (this.grid.standable(this.p, i)) this.goals[k++] = i;
    const n = workSpots(this.grid, this.p, x, y, this.spots);
    for (let j = 0; j < n && k < this.goals.length; j++) if (this.spots[j] !== i) this.goals[k++] = this.spots[j]!;
    return k;
  }

  /** Nearest pile with free units of `item` (Manhattan; ties: lower index), not buried; -1 if none. */
  private nearestPile(cell: number, item: number): number {
    const it = this.items;
    const W = this.world.w;
    const cx = cell % W;
    const cy = (cell - cx) / W;
    let best = -1;
    let bestD = Infinity;
    for (let p = 0; p < it.span; p++) {
      const t = it.tile[p]!;
      if (t < 0 || it.item[p] !== item || it.available(p) <= 0 || SOLID[this.world.mat[t]!]) continue;
      const tx = t % W;
      const dist = Math.abs(tx - cx) + Math.abs((t - tx) / W - cy);
      if (dist < bestD) {
        bestD = dist;
        best = p;
      }
    }
    return best;
  }

  private itemId(item: number): string {
    return this.items.itemId(item);
  }
}
