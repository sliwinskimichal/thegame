/**
 * Composition root of the world-change core: one EventBus, the mutator (single mutation path), the
 * dig system and the roof model, advanced in a fixed order each tick. Commands (dig orders, supports)
 * are applied between ticks or by systems inside a tick, never inside event handlers. Save/load
 * captures every piece of state, so a reloaded sim continues exactly like the original.
 */
import { EventBus } from '../core/events';
import { Rng } from '../core/rng';
import type { World } from '../world/world';
import { DigSystem, type DigSave } from './dig';
import type { SimEvents } from './events';
import { StructureSystem, type StructureSave } from './structure';
import { WorldMutator } from './world/mutate';
import { hashWords, hashWorld, loadWorld, rleDecode, rleEncode, saveWorld, type WorldSave } from './world/snapshot';

export interface WorldSimSave {
  v: 1;
  tick: number;
  seed: number;
  world: WorldSave;
  tag: number[];
  dig: DigSave;
  structure: StructureSave;
}

export class WorldSim {
  readonly bus = new EventBus<SimEvents>();
  readonly mut: WorldMutator;
  readonly dig: DigSystem;
  readonly structure: StructureSystem;
  tick = 0;

  constructor(
    readonly world: World,
    readonly seed: number = world.seed,
  ) {
    const rng = new Rng(seed);
    this.mut = new WorldMutator(world, this.bus);
    // subscription order (dig, then structure) is part of the deterministic contract
    this.dig = new DigSystem(world, this.mut, this.bus, rng.fork('dig'));
    this.structure = new StructureSystem(world, this.mut, this.bus);
  }

  /** Advance one tick (CONFIG.tickRate per second): diggers work, then roofs are evaluated and fall. */
  step(): void {
    this.dig.tick();
    this.structure.tick();
    this.tick++;
  }

  save(): WorldSimSave {
    return { v: 1, tick: this.tick, seed: this.seed, world: saveWorld(this.world), tag: rleEncode(this.mut.tag), dig: this.dig.save(), structure: this.structure.save() };
  }

  static load(s: WorldSimSave): WorldSim {
    if (s.v !== 1) throw new Error(`sim save v${s.v}: unsupported`);
    const sim = new WorldSim(loadWorld(s.world), s.seed);
    rleDecode(s.tag, sim.mut.tag);
    sim.dig.load(s.dig);
    sim.structure.load(s.structure);
    sim.tick = s.tick;
    return sim;
  }

  /** Hash of the whole simulated state (world, tags, dig progress and jobs, supports, stress, timers). */
  hash(): number {
    let h = hashWorld(this.world);
    h = hashWords(h, this.mut.tag);
    h = hashWords(h, this.structure.support);
    h = hashWords(h, this.structure.stress);
    h = hashWords(h, this.structure.timer);
    const d = this.dig.save();
    h = hashWords(h, d.progress.map((v) => Math.round(v * 1e6)));
    for (const k of Object.keys(d.jobs) as (keyof DigSave['jobs'])[]) h = hashWords(h, d.jobs[k].map((v) => Math.round(v * 1e6)));
    return hashWords(h, [this.tick, ...d.rng]);
  }
}
