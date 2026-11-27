/**
 * Headless colony (F2-3 stage 2): the world-change core (WorldSim) plus navigation, items,
 * stockpiles, the job board and the dwarves, advanced in one fixed order per tick:
 *   grid.sync -> dwarves.think (decide, act) -> planner.run (paths within a node budget)
 *   -> dwarves.move (walk, fall) -> dig.tick -> structure.tick (roofs) -> board.tick (reopen, cleanup)
 * The player gives orders (dig, build, stockpile); dwarves carry them out. Save/load captures every
 * piece of state so a reloaded colony continues exactly like the original (same hash).
 */
import { AStar, DWARF, HpaStar, NavGrid, NavPlanner, type PathFinder } from './nav';
import { Dwarves, type DwarvesSave } from './dwarves';
import { ItemPiles, resourceIndex, type PilesSave } from './items';
import { JobBoard, type JobsSave } from './jobs/board';
import type { JobChooser } from './jobs/chooser';
import { loadGridClock, plannerQueue, restorePlannerQueue, saveGridClock } from './navsave';
import { Stockpiles, type StockpileSave } from './stockpile';
import { hashWords, loadWorld, rleDecode, rleEncode } from './world/snapshot';
import { WorldSim, type WorldSimSave } from './worldsim';
import type { World } from '../world/world';

export interface ColonyOptions {
  seed?: number;
  /** 'hpa' = HPA* 16x16 (recommended by NAVIGATION.md), 'astar' = plain A*. */
  finder?: 'hpa' | 'astar';
  /** Node expansions per tick for the planning queue (NAVIGATION.md recommends 2000). */
  plannerBudget?: number;
  chooser?: JobChooser;
  maxDwarves?: number;
}

export interface ColonySave {
  v: 1;
  opts: { finder: 'hpa' | 'astar'; plannerBudget: number; maxDwarves: number };
  sim: WorldSimSave;
  infra: number[];
  gridClock: { version: number; stamps: number[] };
  planner: number[];
  items: PilesSave;
  stockpiles: StockpileSave;
  jobs: JobsSave;
  dwarves: DwarvesSave;
}

export class ColonySim {
  readonly sim: WorldSim;
  readonly grid: NavGrid;
  readonly finder: PathFinder;
  readonly planner: NavPlanner;
  readonly items: ItemPiles;
  readonly stockpiles: Stockpiles;
  readonly board: JobBoard;
  readonly dwarves: Dwarves;
  private readonly opts: ColonySave['opts'];

  constructor(world: World, opts: ColonyOptions = {}, infra?: Uint8Array) {
    this.opts = { finder: opts.finder ?? 'hpa', plannerBudget: opts.plannerBudget ?? 2000, maxDwarves: opts.maxDwarves ?? 256 };
    this.sim = new WorldSim(world, opts.seed ?? world.seed);
    this.grid = new NavGrid(world, { profiles: [DWARF], infra });
    this.finder = this.opts.finder === 'hpa' ? new HpaStar(this.grid, 0, { cluster: 16 }) : new AStar(this.grid, 0);
    this.planner = new NavPlanner(this.opts.plannerBudget);
    this.items = new ItemPiles(world, this.sim.bus);
    this.stockpiles = new Stockpiles(world, this.items);
    this.board = new JobBoard(world, this.sim.bus, this.sim.dig, this.sim.structure, this.items, this.stockpiles);
    this.dwarves = new Dwarves(world, this.sim.bus, this.grid, this.finder, this.planner, this.sim.dig, this.sim.structure, this.board, this.items, this.stockpiles, opts.chooser, this.opts.maxDwarves);
    // loot of a dug tile lies where the tile was (falling to the floor) until it is hauled
    this.sim.bus.on('digLoot', (e) => this.items.drop(e.x, e.y, resourceIndex(e.resource), e.n));
  }

  get world(): World {
    return this.sim.world;
  }

  get bus() {
    return this.sim.bus;
  }

  get tick(): number {
    return this.sim.tick;
  }

  /** One tick (CONFIG.tickRate per second). */
  step(): void {
    const t = this.sim.tick;
    this.board.now = t;
    this.dwarves.now = t;
    this.board.dwarfCount = this.dwarves.alive;
    this.grid.sync();
    this.dwarves.think();
    this.planner.run();
    this.dwarves.move();
    this.sim.step(); // dig progress, roofs (warnings, collapses)
    this.board.tick();
  }

  run(ticks: number): void {
    for (let k = 0; k < ticks; k++) this.step();
  }

  // ------------------------------------------------------------- player orders

  /** Order digging every solid tile of a rectangle. Returns the number of jobs. */
  orderDig(x0: number, y0: number, x1: number, y1: number, prio?: number): number {
    let n = 0;
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) if (this.board.orderDig(x, y, prio)) n++;
    return n;
  }

  orderStockpile(x0: number, y0: number, x1: number, y1: number): number {
    return this.stockpiles.add(x0, y0, x1, y1);
  }

  orderBuild(x: number, y: number, id: string, prio?: number): number {
    return this.board.orderBuild(x, y, id, prio);
  }

  // ------------------------------------------------------------------ save

  save(): ColonySave {
    this.grid.sync(); // fold pending world changes into the grid clock (the next tick would do it first)
    return {
      v: 1,
      opts: { ...this.opts },
      sim: this.sim.save(),
      infra: rleEncode(this.grid.infra),
      gridClock: saveGridClock(this.grid),
      planner: plannerQueue(this.planner, this.dwarves.agents),
      items: this.items.save(),
      stockpiles: this.stockpiles.save(),
      jobs: this.board.save(),
      dwarves: this.dwarves.save(),
    };
  }

  static load(s: ColonySave, chooser?: JobChooser): ColonySim {
    if (s.v !== 1) throw new Error(`colony save v${s.v}: unsupported`);
    const world = loadWorld(s.sim.world);
    const infra = new Uint8Array(world.size);
    rleDecode(s.infra, infra);
    const c = new ColonySim(world, { ...s.opts, seed: s.sim.seed, chooser }, infra);
    rleDecode(s.sim.tag, c.sim.mut.tag);
    c.sim.dig.load(s.sim.dig);
    c.sim.structure.load(s.sim.structure);
    c.sim.tick = s.sim.tick;
    loadGridClock(c.grid, s.gridClock);
    c.items.load(s.items);
    c.stockpiles.load(s.stockpiles);
    c.board.load(s.jobs);
    c.dwarves.load(s.dwarves);
    restorePlannerQueue(c.planner, c.dwarves.agents, s.planner);
    return c;
  }

  /** Hash of the whole colony state (world, roofs, digging, items, zones, jobs, dwarves and their paths). */
  hash(): number {
    let h = this.sim.hash();
    h = hashWords(h, this.grid.infra);
    const it = this.items.save();
    for (const k of Object.keys(it.arrays) as (keyof PilesSave['arrays'])[]) h = hashWords(h, it.arrays[k]);
    h = hashWords(h, this.stockpiles.incoming);
    const jb = this.board.save();
    for (const k of Object.keys(jb.arrays) as (keyof JobsSave['arrays'])[]) h = hashWords(h, jb.arrays[k]);
    const dw = this.dwarves.save();
    for (const k of Object.keys(dw.arrays) as (keyof DwarvesSave['arrays'])[]) h = hashWords(h, dw.arrays[k].map((v) => Math.round(v * 1e6)));
    for (const a of dw.agents) h = hashWords(h, [a.cell, a.state, a.step, Math.round(a.progress * 1e3), a.path.cells.length, ...a.path.cells]);
    return h;
  }
}
