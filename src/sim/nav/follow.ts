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
} as const;

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
  private retryIn = 0;
  private backoff = 1;
  private riding = -1;

  constructor(finder: PathFinder, cell: number) {
    this.finder = finder;
    this.cell = cell;
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
    const st = this.finder.find(this.cell, this.goals.subarray(0, this.goalCount), this.path);
    this.step = 0;
    this.progress = 0;
    this.seenVersion = this.finder.grid.version;
    if (st === NAV.FOUND) {
      this.state = this.path.length <= 1 ? AGENT.ARRIVED : AGENT.MOVING;
      this.backoff = 1;
    } else {
      this.state = AGENT.BLOCKED;
      this.retryIn = this.backoff;
      this.backoff = Math.min(this.backoff * 2, 64);
    }
  }

  private release(): void {
    if (this.riding >= 0) {
      this.finder.grid.release(this.riding);
      this.riding = -1;
    }
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
      } else if (!this.pathValid()) {
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
