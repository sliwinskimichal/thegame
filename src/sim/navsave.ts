/**
 * Save/load bridge for navigation state (the nav module has no save API yet). NavAgent keeps part of its
 * state in private fields; this bridge reads and writes them through a structural view of the class.
 * Replace with NavAgent.save()/load() and NavPlanner.save()/load() once the ai-programmer adds them
 * (handoff in docs/design/sim/JOBS.md). Tests in tests/sim/colony.test.ts break if the fields change.
 */
import type { NavAgent, NavGrid, NavPlanner } from './nav';

interface AgentInternals {
  goals: Int32Array;
  goalCount: number;
  seenVersion: number;
  retryIn: number;
  backoff: number;
  riding: number;
  collectRegions(): void;
}

interface PlannerInternals {
  queue: NavAgent[];
  head: number;
}

export interface AgentSave {
  cell: number;
  state: number;
  step: number;
  progress: number;
  speed: number;
  replans: number;
  falls: number;
  lastFall: number;
  goals: number[];
  seenVersion: number;
  retryIn: number;
  backoff: number;
  riding: number;
  path: { cells: number[]; moves: number[]; links: number[]; cost: number; profile: number; version: number };
}

export function saveAgent(a: NavAgent): AgentSave {
  const x = a as unknown as AgentInternals;
  const n = a.path.length;
  return {
    cell: a.cell,
    state: a.state,
    step: a.step,
    progress: a.progress,
    speed: a.speed,
    replans: a.replans,
    falls: a.falls,
    lastFall: a.lastFall,
    goals: Array.from(x.goals.subarray(0, x.goalCount)),
    seenVersion: x.seenVersion,
    retryIn: x.retryIn,
    backoff: x.backoff,
    riding: x.riding,
    path: {
      cells: Array.from(a.path.cells.subarray(0, n)),
      moves: Array.from(a.path.moves.subarray(0, n)),
      links: Array.from(a.path.links.subarray(0, n)),
      cost: a.path.cost,
      profile: a.path.profile,
      version: a.path.version,
    },
  };
}

/** Restore an agent saved with `saveAgent` into a fresh agent of the same finder. */
export function loadAgent(a: NavAgent, s: AgentSave): void {
  const x = a as unknown as AgentInternals;
  a.cell = s.cell;
  a.state = s.state;
  a.step = s.step;
  a.progress = s.progress;
  a.speed = s.speed;
  a.replans = s.replans;
  a.falls = s.falls;
  a.lastFall = s.lastFall;
  if (x.goals.length < s.goals.length) x.goals = new Int32Array(s.goals.length);
  x.goals.set(s.goals);
  x.goalCount = s.goals.length;
  x.seenVersion = s.seenVersion;
  x.retryIn = s.retryIn;
  x.backoff = s.backoff;
  x.riding = s.riding;
  a.path.clear();
  for (let k = 0; k < s.path.cells.length; k++) a.path.push(s.path.cells[k]!, s.path.moves[k]!, s.path.links[k]!);
  a.path.cost = s.path.cost;
  a.path.profile = s.path.profile;
  a.path.version = s.path.version;
  x.collectRegions();
  if (s.riding >= 0) a.finder.grid.reserve(s.riding);
  a.queuedAt = -1;
}

/** Indices (into `agents`) of the agents waiting in the planner queue, in queue order. */
export function plannerQueue(p: NavPlanner, agents: readonly NavAgent[]): number[] {
  const x = p as unknown as PlannerInternals;
  const index = new Map(agents.map((a, k) => [a, k] as const));
  const out: number[] = [];
  for (let k = x.head; k < x.queue.length; k++) {
    const i = index.get(x.queue[k]!);
    if (i !== undefined) out.push(i);
  }
  return out;
}

export function restorePlannerQueue(p: NavPlanner, agents: readonly NavAgent[], order: readonly number[]): void {
  for (const k of order) {
    agents[k]!.queuedAt = -1;
    p.request(agents[k]!);
  }
}

/** Grid change counters the agents compare against (version and per-region stamps). */
export function saveGridClock(g: NavGrid): { version: number; stamps: number[] } {
  return { version: g.version, stamps: Array.from(g.regionStamp) };
}

export function loadGridClock(g: NavGrid, s: { version: number; stamps: number[] }): void {
  g.version = s.version;
  g.regionStamp.set(s.stamps);
}
