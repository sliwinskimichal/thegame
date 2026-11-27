/**
 * Digging as a process (F2-3 stage 2). A dig job is one worker (dwarf, drill, script) working one
 * tile; work accumulates on the tile (`progress`, work units) at `tool.workSpeed x workerMul` per
 * second until it reaches the material hardness (x rubble multiplier), then the tile is removed through
 * the mutator and the loot is announced as an event. A pick below the material tier makes no
 * progress and reports why (DIG_FAIL + the tier needed). Progress stays on the tile when a job stops,
 * so a second dwarf continues where the first left off. One job per tile (no double loot).
 *
 * Numbers come from content: hardness and tier from MATERIALS (deposits from the content bible),
 * pick stats from RESOURCES, hands / plain-rock loot / rubble rules from content/structure.ts.
 */
import { TICK_DT } from '../config';
import { RESOURCES } from '../content/resources';
import { DEPOSITS } from '../content/sources';
import { EXCAVATION, STRUCTURE, type DigToolSpec } from '../content/structure';
import type { Rng } from '../core/rng';
import { MATERIALS, MAT_COUNT, M, SOLID } from '../world/materials';
import type { World } from '../world/world';
import { CAUSE, type SimBus, type TileChanged } from './events';
import { rleDecode, rleEncode } from './world/snapshot';
import { TAG, TIER_NEVER, type WorldMutator } from './world/mutate';

export const DIG_FAIL = {
  OK: 0,
  OUT_OF_BOUNDS: 1,
  /** Nothing to dig (open tile, or it was dug away under the job). */
  NOT_SOLID: 2,
  /** Tier 9 material (bedrock, Prakowali stone): never diggable. */
  UNBREAKABLE: 3,
  /** The pick is too weak; `need` carries the tier required. */
  TIER_TOO_LOW: 4,
  /** No open 4-neighbour: nobody can stand next to the tile yet. */
  NOT_EXPOSED: 5,
  /** Another job already works this tile. */
  RESERVED: 6,
  NO_SLOT: 7,
  /** Unknown or stale job handle. */
  BAD_JOB: 8,
} as const;
export type DigFail = (typeof DIG_FAIL)[keyof typeof DIG_FAIL];

/** i18n keys of the reasons; the UI words them (e.g. "Za słaby kilof: potrzebny poziom {need}"). */
export const DIG_FAIL_KEY: Readonly<Record<number, string>> = {
  0: 'dig.ok',
  1: 'dig.outOfBounds',
  2: 'dig.notSolid',
  3: 'dig.unbreakable',
  4: 'dig.tierTooLow',
  5: 'dig.notExposed',
  6: 'dig.reserved',
  7: 'dig.noSlot',
  8: 'dig.badJob',
};

export const JOB = { FREE: 0, ACTIVE: 1, BLOCKED: 2 } as const;
export const MAX_DIG_JOBS = 1024;

export type DigTool = DigToolSpec;
/** Bare hands (content/structure.ts EXCAVATION.hands). */
export const HANDS: DigTool = EXCAVATION.hands;

/** Dig tool of a pick item from the content bible, or null if the id is not a pick. */
export function pickTool(itemId: string): DigTool | null {
  const r = RESOURCES.find((x) => x.id === itemId);
  if (!r || r.slot !== 'pick') return null;
  return { pickTier: r.stats?.pickTier ?? 0, workSpeed: r.stats?.workSpeed ?? 1 };
}

interface Loot {
  resource: string;
  n: number;
  deposit: string | null;
}

export interface DigSave {
  v: 1;
  /** Sparse progress: tile index, work units, tile index, work units, ... */
  progress: number[];
  jobs: Record<'tile' | 'worker' | 'tier' | 'speed' | 'state' | 'reason' | 'gen' | 'stage', number[]>;
  free: number[];
  hi: number;
  rng: [number, number, number, number];
}

const JOB_ARRAYS = ['tile', 'worker', 'tier', 'speed', 'state', 'reason', 'gen', 'stage'] as const;

export class DigSystem {
  /** Work units done on each tile (0 = untouched). Render reads progress / required for cracks. */
  readonly progress: Float64Array;
  /** Job slot + 1 working each tile (0 = none). */
  private readonly tileJob: Int32Array;
  private readonly job = {
    tile: new Int32Array(MAX_DIG_JOBS),
    worker: new Int32Array(MAX_DIG_JOBS),
    tier: new Uint8Array(MAX_DIG_JOBS),
    speed: new Float64Array(MAX_DIG_JOBS),
    state: new Uint8Array(MAX_DIG_JOBS),
    reason: new Uint8Array(MAX_DIG_JOBS),
    gen: new Uint16Array(MAX_DIG_JOBS),
    stage: new Uint8Array(MAX_DIG_JOBS),
  };
  private readonly free = new Int32Array(MAX_DIG_JOBS);
  private freeTop = 0;
  /** One past the highest slot ever used (tick() scans [0, hi)). */
  private hi = 0;
  /** Tier required by the last canDig() that returned TIER_TOO_LOW. */
  lastNeed = 0;
  readonly stats = { started: 0, done: 0, blocked: 0, cancelled: 0 };
  private readonly loot: (Loot | null)[] = [];
  private readonly rubbleLoot: Loot | null;
  private readonly hardness = new Float64Array(MAT_COUNT);
  private readonly tier = new Uint8Array(MAT_COUNT);
  private readonly stages: readonly number[];

  constructor(
    readonly world: World,
    readonly mut: WorldMutator,
    readonly bus: SimBus,
    readonly rng: Rng,
  ) {
    this.progress = new Float64Array(world.size);
    this.tileJob = new Int32Array(world.size);
    for (let s = MAX_DIG_JOBS - 1; s >= 0; s--) this.free[this.freeTop++] = s;
    const dep = new Map(DEPOSITS.map((d) => [d.id, d]));
    for (const m of MATERIALS) {
      this.hardness[m.id] = m.hardness;
      this.tier[m.id] = Math.min(255, m.tier);
      if (!m.solid) this.loot[m.id] = null;
      else if (m.deposit) {
        const d = dep.get(m.deposit)!;
        this.loot[m.id] = { resource: d.yields, n: d.amount, deposit: d.id };
      } else {
        const s = m.key in EXCAVATION.lootByMaterial ? (EXCAVATION.lootByMaterial[m.key] ?? null) : EXCAVATION.plainLoot;
        this.loot[m.id] = s ? { resource: s.id, n: s.n, deposit: null } : null;
      }
    }
    const rl = STRUCTURE.rubbleLoot;
    this.rubbleLoot = rl ? { resource: rl.id, n: rl.n, deposit: null } : null;
    this.stages = EXCAVATION.crackStages;
    bus.on('tileChanged', (e) => this.onTileChanged(e));
  }

  // ------------------------------------------------------------------ queries

  /** Can a pick of `pickTier` dig (x, y) now? Ignores reservations. Sets `lastNeed` for TIER_TOO_LOW. */
  canDig(x: number, y: number, pickTier: number): DigFail {
    const w = this.world;
    if (!w.inBounds(x, y)) return DIG_FAIL.OUT_OF_BOUNDS;
    return this.check(y * w.w + x, pickTier);
  }

  /** Work units needed to dig tile i as it is now (Infinity for unbreakable, 0 for open tiles). */
  required(i: number): number {
    const m = this.world.mat[i]!;
    if (!SOLID[m]) return 0;
    return this.mut.tag[i]! & TAG.RUBBLE ? this.hardness[m]! * STRUCTURE.rubbleHardnessMul : this.hardness[m]!;
  }

  /** Pick tier needed to dig tile i as it is now (rubble is easier; >= TIER_NEVER = never). */
  needTier(i: number): number {
    const t = this.tier[this.world.mat[i]!]!;
    return this.mut.tag[i]! & TAG.RUBBLE ? Math.min(t, STRUCTURE.rubbleTier) : t;
  }

  /** Dig progress of a tile in [0, 1] (render: cracks). */
  progressAt(x: number, y: number): number {
    if (!this.world.inBounds(x, y)) return 0;
    const i = y * this.world.w + x;
    const r = this.required(i);
    return r > 0 && Number.isFinite(r) ? Math.min(1, this.progress[i]! / r) : 0;
  }

  /** JOB state of a handle (FREE for stale or unknown handles). */
  state(handle: number): number {
    const s = this.slotOf(handle);
    return s < 0 ? JOB.FREE : this.job.state[s]!;
  }

  /** DIG_FAIL reason of a blocked job (OK when active, BAD_JOB when stale). */
  reason(handle: number): DigFail {
    const s = this.slotOf(handle);
    return s < 0 ? DIG_FAIL.BAD_JOB : (this.job.reason[s]! as DigFail);
  }

  /** Handle of the job working tile (x, y), or 0. */
  jobAt(x: number, y: number): number {
    if (!this.world.inBounds(x, y)) return 0;
    const s = this.tileJob[y * this.world.w + x]! - 1;
    return s < 0 ? 0 : this.handleOf(s);
  }

  get activeJobs(): number {
    let n = 0;
    for (let s = 0; s < this.hi; s++) if (this.job.state[s] !== JOB.FREE) n++;
    return n;
  }

  // ----------------------------------------------------------------- commands

  /**
   * Start digging (x, y). Returns a job handle (> 0) or -DIG_FAIL (RESERVED when another job owns the
   * tile, TIER_TOO_LOW / NOT_EXPOSED / UNBREAKABLE / NOT_SOLID / OUT_OF_BOUNDS / NO_SLOT).
   */
  start(x: number, y: number, worker: number, tool: DigTool, workerMul = 1): number {
    const code = this.canDig(x, y, tool.pickTier);
    if (code !== DIG_FAIL.OK) return -code;
    const i = y * this.world.w + x;
    if (this.tileJob[i]) return -DIG_FAIL.RESERVED;
    if (this.freeTop === 0) return -DIG_FAIL.NO_SLOT;
    const s = this.free[--this.freeTop]!;
    if (s >= this.hi) this.hi = s + 1;
    const J = this.job;
    J.gen[s] = (J.gen[s]! % 65535) + 1;
    J.tile[s] = i;
    J.worker[s] = worker;
    J.tier[s] = tool.pickTier;
    J.speed[s] = Math.max(0, tool.workSpeed * workerMul);
    J.state[s] = JOB.ACTIVE;
    J.reason[s] = DIG_FAIL.OK;
    J.stage[s] = this.stageOf(i);
    this.tileJob[i] = s + 1;
    this.stats.started++;
    const h = this.handleOf(s);
    this.bus.emit('digStarted', { job: h, worker, x, y, mat: this.world.mat[i]! });
    return h;
  }

  /** Swap the tool (or the worker's speed) mid-dig; progress is kept. Returns the new reason. */
  setTool(handle: number, tool: DigTool, workerMul = 1): DigFail {
    const s = this.slotOf(handle);
    if (s < 0) return DIG_FAIL.BAD_JOB;
    this.job.tier[s] = tool.pickTier;
    this.job.speed[s] = Math.max(0, tool.workSpeed * workerMul);
    this.revalidate(s);
    return this.job.reason[s]! as DigFail;
  }

  /** Stop a job; EXCAVATION.progressKept of the work stays on the tile. */
  cancel(handle: number): boolean {
    const s = this.slotOf(handle);
    if (s < 0) return false;
    const i = this.job.tile[s]!;
    this.progress[i] = this.progress[i]! * EXCAVATION.progressKept;
    this.release(s);
    this.stats.cancelled++;
    return true;
  }

  /** Advance every active job by one tick (slot order: deterministic). */
  tick(): void {
    const J = this.job;
    for (let s = 0; s < this.hi; s++) {
      if (J.state[s] !== JOB.ACTIVE) continue;
      const i = J.tile[s]!;
      const req = this.required(i);
      const p = this.progress[i]! + J.speed[s]! * TICK_DT;
      this.progress[i] = p;
      const st = this.stageOf(i);
      if (st > J.stage[s]! && p < req - 1e-9) {
        J.stage[s] = st;
        const x = i % this.world.w;
        this.bus.emit('digCrack', { job: this.handleOf(s), worker: J.worker[s]!, x, y: (i - x) / this.world.w, stage: st });
      }
      if (p >= req - 1e-9) this.complete(s);
    }
  }

  // ------------------------------------------------------------------ save

  save(): DigSave {
    const progress: number[] = [];
    for (let i = 0; i < this.progress.length; i++) if (this.progress[i]) progress.push(i, this.progress[i]!);
    const jobs = {} as DigSave['jobs'];
    for (const k of JOB_ARRAYS) jobs[k] = rleEncode(this.job[k]);
    return { v: 1, progress, jobs, free: Array.from(this.free.subarray(0, this.freeTop)), hi: this.hi, rng: this.rng.getState() };
  }

  load(s: DigSave): void {
    if (s.v !== 1) throw new Error(`dig save v${s.v}: unsupported`);
    this.progress.fill(0);
    for (let k = 0; k < s.progress.length; k += 2) this.progress[s.progress[k]!] = s.progress[k + 1]!;
    for (const k of JOB_ARRAYS) rleDecode(s.jobs[k], this.job[k]);
    this.free.set(s.free);
    this.freeTop = s.free.length;
    this.hi = s.hi;
    this.rng.setState(s.rng);
    this.tileJob.fill(0);
    for (let j = 0; j < this.hi; j++) if (this.job.state[j] !== JOB.FREE) this.tileJob[this.job.tile[j]!] = j + 1;
  }

  // --------------------------------------------------------------- internals

  private check(i: number, pickTier: number): DigFail {
    const w = this.world;
    const m = w.mat[i]!;
    if (!SOLID[m]) return DIG_FAIL.NOT_SOLID;
    const t = this.tier[m]!;
    if (t >= TIER_NEVER || !Number.isFinite(this.hardness[m]!)) return DIG_FAIL.UNBREAKABLE;
    const need = this.mut.tag[i]! & TAG.RUBBLE ? Math.min(t, STRUCTURE.rubbleTier) : t;
    if (pickTier < need) {
      this.lastNeed = need;
      return DIG_FAIL.TIER_TOO_LOW;
    }
    const x = i % w.w;
    const y = (i - x) / w.w;
    if (w.isSolid(x - 1, y) && w.isSolid(x + 1, y) && w.isSolid(x, y - 1) && w.isSolid(x, y + 1)) return DIG_FAIL.NOT_EXPOSED;
    return DIG_FAIL.OK;
  }

  private complete(s: number): void {
    const J = this.job;
    const i = J.tile[s]!;
    const worker = J.worker[s]!;
    const h = this.handleOf(s);
    const w = this.world;
    const x = i % w.w;
    const y = (i - x) / w.w;
    const m = w.mat[i]!;
    const loot = this.mut.tag[i]! & TAG.RUBBLE ? this.rubbleLoot : this.loot[m]!;
    this.release(s);
    this.progress[i] = 0;
    if (this.mut.dig(x, y, CAUSE.DIG) === M.AIR) return; // refused (cannot happen after check)
    this.stats.done++;
    if (loot) {
      const whole = Math.floor(loot.n);
      const n = whole + (loot.n > whole && this.rng.next() < loot.n - whole ? 1 : 0);
      if (n > 0) this.bus.emit('digLoot', { x, y, mat: m, deposit: loot.deposit, resource: loot.resource, n, worker });
    }
    this.bus.emit('digDone', { job: h, worker, x, y, mat: m });
  }

  /** Re-check a job after its tool or neighbourhood changed; emits blocked/resumed on transitions. */
  private revalidate(s: number): void {
    const J = this.job;
    const code = this.check(J.tile[s]!, J.tier[s]!);
    if (code === J.reason[s]) return;
    const wasActive = J.state[s] === JOB.ACTIVE;
    J.reason[s] = code;
    J.state[s] = code === DIG_FAIL.OK ? JOB.ACTIVE : JOB.BLOCKED;
    const i = J.tile[s]!;
    const x = i % this.world.w;
    const y = (i - x) / this.world.w;
    const h = this.handleOf(s);
    if (code === DIG_FAIL.OK) this.bus.emit('digResumed', { job: h, worker: J.worker[s]!, x, y });
    else {
      if (wasActive) this.stats.blocked++;
      this.bus.emit('digBlocked', { job: h, worker: J.worker[s]!, x, y, reason: code, need: code === DIG_FAIL.TIER_TOO_LOW ? this.lastNeed : 0 });
    }
  }

  private onTileChanged(e: TileChanged): void {
    const i = e.i;
    this.progress[i] = 0; // the tile was replaced: its work is gone
    const own = this.tileJob[i]! - 1;
    if (own >= 0) this.revalidate(own); // dug away or replaced under the job
    const w = this.world;
    if (e.x > 0) this.near(i - 1);
    if (e.x < w.w - 1) this.near(i + 1);
    if (e.y > 0) this.near(i - w.w);
    if (e.y < w.h - 1) this.near(i + w.w);
  }

  private near(j: number): void {
    const s = this.tileJob[j]! - 1;
    if (s >= 0) this.revalidate(s);
  }

  private release(s: number): void {
    this.tileJob[this.job.tile[s]!] = 0;
    this.job.state[s] = JOB.FREE;
    this.job.reason[s] = DIG_FAIL.OK;
    this.free[this.freeTop++] = s;
  }

  private stageOf(i: number): number {
    const r = this.required(i);
    if (!(r > 0) || !Number.isFinite(r)) return 0;
    const f = this.progress[i]! / r;
    let st = 0;
    while (st < this.stages.length && f >= this.stages[st]!) st++;
    return st;
  }

  private handleOf(s: number): number {
    return this.job.gen[s]! * MAX_DIG_JOBS + s + 1;
  }

  private slotOf(handle: number): number {
    if (!(handle > 0)) return -1;
    const s = (handle - 1) % MAX_DIG_JOBS;
    const gen = Math.floor((handle - 1) / MAX_DIG_JOBS);
    return this.job.state[s] !== JOB.FREE && this.job.gen[s] === gen ? s : -1;
  }
}
