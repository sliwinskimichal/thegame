/**
 * Locomotion layer: an agent following a planned path through the grid.
 *
 * The agent advances along path edges by travel time (edge cost x speed).
 * Whenever the grid version changes (dig, cave-in, infrastructure, links) it
 * re-validates the rest of its path and re-plans at once if an edge
 * disappeared — not when it bumps into the obstacle. If its own cell lost
 * support it falls to the landing cell (the fall height is reported for
 * damage) and re-plans. Failed plans back off exponentially (in ticks, not
 * wall-clock time: deterministic) so an unreachable goal cannot burn CPU
 * every tick.
 */
import type { PathFinder } from './astar';
import { Path } from './search';
import { MV, NAV } from './types';

export const AGENT = {
  IDLE: 0,
  MOVING: 1,
  ARRIVED: 2,
  /** No path right now; retries after a back-off. */
  BLOCKED: 3,
  /** Lost support with nowhere to land (lava, deep water, out of the map). */
  LOST: 4,
  /** Waiting in the planner queue (stands still meanwhile). */
  WAITING: 5,
} as const;

/**
 * Deterministic planning queue: agents that need a path wait in FIFO order
 * and `run()` serves them until an expansion budget is spent (at least one
 * per call). The budget is counted in node expansions, not milliseconds, so
 * the simulation stays deterministic on every machine; bursts (a cave-in, a
 * save loaded, 200 dwarves arriving at once) spread over several ticks.
 */
export class NavPlanner {
  readonly budget: number;
  private queue: NavAgent[] = [];
  private head = 0;
  private tick = 0;
  /** Stats: plans served, total and max ticks spent waiting. */
  served = 0;
  waitTotal = 0;
  waitMax = 0;

  constructor(budget = 3000) {
    this.budget = budget;
  }

  get pending(): number {
    return this.queue.length - this.head;
  }

  request(a: NavAgent): void {
    if (a.queuedAt >= 0) return;
    a.queuedAt = this.tick;
    this.queue.push(a);
  }

  /** Serve queued agents within the budget; call once per simulation tick. Returns plans made. */
  run(): number {
    let spent = 0;
    let n = 0;
    while (this.head < this.queue.length && (n === 0 || spent < this.budget)) {
      const a = this.queue[this.head++];
      const wait = this.tick - a.queuedAt;
      a.queuedAt = -1;
      this.waitTotal += wait;
      if (wait > this.waitMax) this.waitMax = wait;
      spent += a.planNow();
      n++;
    }
    if (this.head > 256 && this.head * 2 > this.queue.length) {
      this.queue.splice(0, this.head);
      this.head = 0;
    }
    this.served += n;
    this.tick++;
    return n;
  }
}

export class NavAgent {
  readonly finder: PathFinder;
  cell: number;
  state: number = AGENT.IDLE;
  readonly path = new Path();
  /** Index of the node the agent stands on (or departs from). */
  step = 0;
  /** Milliseconds of the current edge already travelled. */
  progress = 0;
  /** Speed factor (1 = profile base speed). */
  speed = 1;
  replans = 0;
  falls = 0;
  /** Height (rows) of the last fall; > profile.maxDrop means injury. */
  lastFall = 0;
  private goals = new Int32Array(4);
  private goalCount = 0;
  private seenVersion = -1;
  /** 16 x 16 regions the path crosses (consecutive duplicates removed). */
  private regions = new Int32Array(16);
  private regionCount = 0;
  private retryIn = 0;
  private backoff = 1;
  private riding = -1;
  /** Optional planning queue; without it the agent plans synchronously. */
  readonly planner: NavPlanner | null;
  /** Tick the agent entered the planner queue (-1 = not queued). */
  queuedAt = -1;

  constructor(finder: PathFinder, cell: number, planner: NavPlanner | null = null) {
    this.finder = finder;
    this.cell = cell;
    this.planner = planner;
  }

  get profile(): number {
    return this.finder.profile;
  }

  /** Set the destination (any of `goals`) and plan. Returns the new state. */
  go(goals: ArrayLike<number>): number {
    if (this.goals.length < goals.length) this.goals = new Int32Array(goals.length);
    for (let k = 0; k < goals.length; k++) this.goals[k] = goals[k];
    this.goalCount = goals.length;
    this.backoff = 1;
    this.plan();
    return this.state;
  }

  private plan(): void {
    this.release();
    if (this.planner) {
      this.state = AGENT.WAITING;
      this.planner.request(this);
    } else this.planNow();
  }

  /** Plan right now (the planner calls this). Returns the node expansions spent. */
  planNow(): number {
    if (this.state !== AGENT.WAITING && this.planner) return 0; // goal dropped meanwhile
    const st = this.finder.find(this.cell, this.goals.subarray(0, this.goalCount), this.path);
    this.step = 0;
    this.progress = 0;
    this.seenVersion = this.finder.grid.version;
    if (st === NAV.FOUND) {
      this.state = this.path.length <= 1 ? AGENT.ARRIVED : AGENT.MOVING;
      this.backoff = 1;
      this.collectRegions();
    } else {
      this.state = AGENT.BLOCKED;
      this.retryIn = this.backoff;
      this.backoff = Math.min(this.backoff * 2, 64);
    }
    return this.finder.expanded;
  }

  private release(): void {
    if (this.riding >= 0) {
      this.finder.grid.release(this.riding);
      this.riding = -1;
    }
  }

  private collectRegions(): void {
    const grid = this.finder.grid;
    const W = grid.w;
    let n = 0;
    let last = -1;
    for (let k = 0; k < this.path.length; k++) {
      const c = this.path.cells[k];
      const x = c % W;
      const r = (((c - x) / W) >> grid.regionShift) * grid.regionW + (x >> grid.regionShift);
      if (r === last) continue;
      last = r;
      if (n === this.regions.length) {
        const b = new Int32Array(n * 2);
        b.set(this.regions);
        this.regions = b;
      }
      this.regions[n++] = r;
    }
    this.regionCount = n;
  }

  /** Did any region the path crosses change after version `since`? O(regions), not O(path). */
  private pathTouched(since: number): boolean {
    const stamps = this.finder.grid.regionStamp;
    for (let k = 0; k < this.regionCount; k++) if (stamps[this.regions[k]] > since) return true;
    return false;
  }

  /** Is every remaining edge of the path still in the graph? */
  pathValid(): boolean {
    const grid = this.finder.grid;
    const p = this.profile;
    const { cells, moves, links } = this.path;
    for (let k = this.step; k + 1 < this.path.length; k++)
      if (!grid.hasEdge(p, cells[k], cells[k + 1], moves[k + 1], links[k + 1])) return false;
    return true;
  }

  /** Advance by `dtMs` milliseconds of game time. Returns the state. */
  tick(dtMs: number): number {
    const grid = this.finder.grid;
    if (this.state === AGENT.BLOCKED) {
      if (--this.retryIn <= 0) this.plan();
      return this.state;
    }
    if (this.state !== AGENT.MOVING) return this.state;
    grid.sync();
    if (grid.version !== this.seenVersion) {
      const since = this.seenVersion;
      this.seenVersion = grid.version;
      const p = this.profile;
      if (!grid.standable(p, this.cell)) {
        // the floor went away: fall straight down
        const x = this.cell % grid.w;
        const land = grid.landing(p, x, (this.cell - x) / grid.w);
        this.release();
        if (land < 0) {
          this.state = AGENT.LOST;
          return this.state;
        }
        this.falls++;
        this.lastFall = grid.lastFall;
        this.cell = land;
        this.replans++;
        this.plan();
      } else if (this.pathTouched(since) && !this.pathValid()) {
        this.replans++;
        this.plan();
      }
      if (this.state !== AGENT.MOVING) return this.state;
    }
    let budget = dtMs * this.speed;
    const { cells, moves, links } = this.path;
    const p = this.profile;
    while (budget > 0 && this.step + 1 < this.path.length) {
      const a = cells[this.step];
      const b = cells[this.step + 1];
      const mv = moves[this.step + 1];
      const l = links[this.step + 1];
      if (mv === MV.LINK && this.riding < 0 && this.progress === 0) {
        this.riding = grid.linkGroup[l];
        grid.reserve(this.riding);
      }
      const need = grid.edgeCost(p, a, b, mv, l) - this.progress;
      if (budget >= need) {
        budget -= need;
        this.progress = 0;
        this.step++;
        this.cell = b;
        if (mv === MV.LINK) this.release();
      } else {
        this.progress += budget;
        budget = 0;
      }
    }
    if (this.step + 1 >= this.path.length) this.state = AGENT.ARRIVED;
    return this.state;
  }
}
