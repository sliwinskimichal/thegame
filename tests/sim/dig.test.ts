/**
 * F2-3 stage 2: digging as a process - time from hardness and pick speed, the pick-tier gate with a
 * clear reason, exposure, tool swaps mid-dig, reservations (no double loot), loot from content data,
 * rubble, crack stages and save/load of jobs in progress.
 */
import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import { Rng } from '../../src/core/rng';
import { DIG_FAIL, DigSystem, HANDS, JOB, pickTool, type DigTool } from '../../src/sim/dig';
import { CAUSE, type SimEvents } from '../../src/sim/events';
import { WorldMutator } from '../../src/sim/world/mutate';
import { hashWorld, loadWorld, saveWorld } from '../../src/sim/world/snapshot';
import { M } from '../../src/world/materials';
import { CAV, type World } from '../../src/world/world';
import { carve, record, slab } from './helpers';

const tool = (id: string): DigTool => pickTool(id)!;

function setup(w: World) {
  const bus = new EventBus<SimEvents>();
  const mut = new WorldMutator(w, bus);
  const dig = new DigSystem(w, mut, bus, new Rng(5));
  const rec = record(bus, ['digStarted', 'digCrack', 'digBlocked', 'digResumed', 'digDone', 'digLoot', 'tileChanged']);
  /** Tick until `done()` holds; returns the number of ticks. */
  const run = (done: () => boolean, max = 5000) => {
    let n = 0;
    while (!done() && n < max) {
      dig.tick();
      n++;
    }
    return n;
  };
  return { bus, mut, dig, rec, run };
}

/** 8 x 5 world of `rock` with a dug corridor in row 2, x 0..2; tile (3, 2) is the dig face. */
const face = (rock: number) => carve(slab(8, 5, rock), 0, 2, 2, 2);

describe('dig time, tier gate and loot', () => {
  it('takes hardness / (workSpeed x tick) ticks and drops the plain-rock loot (stone x1)', () => {
    const w = face(M.GRANITE);
    const { dig, rec, run } = setup(w);
    const iron = tool('iron_pick');
    expect(iron).toEqual({ pickTier: 2, workSpeed: 1.35 });
    expect(dig.start(3, 2, 7, iron)).toBeGreaterThan(0);
    const ticks = run(() => w.mat[w.idx(3, 2)] === M.AIR);
    expect(ticks).toBe(Math.ceil(3.5 / (1.35 / 20))); // 52 ticks = 2.6 s
    expect(rec.of('digLoot')).toEqual([{ x: 3, y: 2, mat: M.GRANITE, deposit: null, resource: 'stone', n: 1, worker: 7 }]);
    expect(rec.of('digDone').length).toBe(1);
    expect(w.cav[w.idx(3, 2)]).toBe(CAV.DUG);
  });

  it('is exact for round numbers (limestone 2.2 with a copper pick = 44 ticks)', () => {
    const w = face(M.LIMESTONE);
    const { dig, run } = setup(w);
    dig.start(3, 2, 1, tool('copper_pick'));
    expect(run(() => w.mat[w.idx(3, 2)] === M.AIR)).toBe(44);
  });

  it('a deposit yields its resource and amount from the content bible', () => {
    const w = face(M.LIMESTONE);
    w.mat[w.idx(3, 2)] = M.COPPER;
    const { dig, rec, run } = setup(w);
    dig.start(3, 2, 1, tool('bronze_pick'));
    run(() => rec.of('digLoot').length > 0);
    expect(rec.of('digLoot')[0]).toMatchObject({ deposit: 'copper_vein', resource: 'copper_ore', n: 2 });
  });

  it('a pick below the material tier makes no job and names the tier needed', () => {
    const w = face(M.GRANITE);
    const { dig } = setup(w);
    expect(dig.start(3, 2, 1, tool('copper_pick'))).toBe(-DIG_FAIL.TIER_TOO_LOW);
    expect(dig.lastNeed).toBe(2);
    expect(dig.canDig(3, 2, HANDS.pickTier)).toBe(DIG_FAIL.TIER_TOO_LOW);
    expect(dig.progress[w.idx(3, 2)]).toBe(0);
  });

  it('bedrock is unbreakable even for the best pick; open and outside tiles are refused', () => {
    const w = face(M.LIMESTONE);
    w.mat[w.idx(3, 2)] = M.BEDROCK;
    const { dig } = setup(w);
    expect(dig.start(3, 2, 1, tool('glimmer_pick'))).toBe(-DIG_FAIL.UNBREAKABLE);
    expect(dig.start(1, 2, 1, tool('glimmer_pick'))).toBe(-DIG_FAIL.NOT_SOLID);
    expect(dig.start(-1, 2, 1, tool('glimmer_pick'))).toBe(-DIG_FAIL.OUT_OF_BOUNDS);
  });

  it('hands dig soil at 0.6 and the sky above row 0 counts as open (map edge)', () => {
    const w = slab(4, 4, M.SOIL);
    const { dig, run } = setup(w);
    expect(dig.start(0, 0, 1, HANDS)).toBeGreaterThan(0);
    expect(run(() => w.mat[0] === M.AIR)).toBe(Math.ceil(1 / (0.6 / 20)));
  });
});

describe('exposure, tool swaps and interruptions', () => {
  it('an enclosed tile cannot be dug until a neighbour opens; a job blocks when its only opening is walled up', () => {
    const w = face(M.LIMESTONE);
    const { dig, mut, rec, run } = setup(w);
    const cp = tool('copper_pick');
    expect(dig.start(5, 2, 1, cp)).toBe(-DIG_FAIL.NOT_EXPOSED);
    const h = dig.start(3, 2, 1, cp);
    run(() => false, 10);
    const before = dig.progress[w.idx(3, 2)]!;
    mut.place(2, 2, M.STONE_BRICK); // wall up the only open neighbour
    expect(dig.state(h)).toBe(JOB.BLOCKED);
    expect(rec.of('digBlocked')[0]).toMatchObject({ job: h, reason: DIG_FAIL.NOT_EXPOSED });
    run(() => false, 30);
    expect(dig.progress[w.idx(3, 2)]).toBe(before);
    mut.dig(2, 2);
    expect(dig.state(h)).toBe(JOB.ACTIVE);
    expect(rec.of('digResumed').length).toBe(1);
    run(() => w.mat[w.idx(3, 2)] === M.AIR);
    expect(rec.of('digDone').length).toBe(1);
  });

  it('swapping to a weaker pick mid-dig blocks with the tier needed; a better one resumes with the work kept', () => {
    const w = face(M.GRANITE);
    const { dig, rec, run } = setup(w);
    const h = dig.start(3, 2, 1, tool('bronze_pick')); // tier 2, 1.15
    let ticks = run(() => false, 20);
    expect(dig.setTool(h, tool('copper_pick'))).toBe(DIG_FAIL.TIER_TOO_LOW);
    expect(rec.of('digBlocked')[0]).toMatchObject({ reason: DIG_FAIL.TIER_TOO_LOW, need: 2 });
    run(() => false, 30);
    expect(dig.progress[w.idx(3, 2)]).toBeCloseTo(20 * 1.15 * 0.05, 9);
    expect(dig.setTool(h, tool('steel_pick'))).toBe(DIG_FAIL.OK); // 1.6
    ticks += run(() => w.mat[w.idx(3, 2)] === M.AIR);
    expect(ticks).toBe(20 + Math.ceil((3.5 - 1.15) / (1.6 * 0.05)));
  });

  it('one job per tile: no double loot; a second dwarf continues the kept progress after a cancel', () => {
    const w = face(M.LIMESTONE);
    const { dig, rec, run } = setup(w);
    const cp = tool('copper_pick');
    const a = dig.start(3, 2, 1, cp);
    expect(dig.start(3, 2, 2, cp)).toBe(-DIG_FAIL.RESERVED);
    run(() => false, 30);
    expect(dig.cancel(a)).toBe(true);
    expect(dig.state(a)).toBe(JOB.FREE);
    expect(dig.cancel(a)).toBe(false);
    expect(dig.setTool(a, cp)).toBe(DIG_FAIL.BAD_JOB);
    const b = dig.start(3, 2, 2, cp);
    expect(b).not.toBe(a); // the reused slot gets a new generation
    expect(run(() => w.mat[w.idx(3, 2)] === M.AIR)).toBe(44 - 30);
    expect(rec.of('digLoot').map((l) => l.worker)).toEqual([2]);
  });

  it('emits each crack stage once, in order, before the tile breaks', () => {
    const w = face(M.GRANITE);
    const { dig, rec, run } = setup(w);
    dig.start(3, 2, 1, tool('iron_pick'));
    run(() => w.mat[w.idx(3, 2)] === M.AIR);
    expect(rec.of('digCrack').map((c) => c.stage)).toEqual([1, 2, 3]);
    const order = rec.log.map((l) => l.type).filter((t) => t !== 'digCrack');
    expect(order).toEqual(['digStarted', 'tileChanged', 'digLoot', 'digDone']);
  });

  it('rubble from a collapse digs by hand at half the hardness and yields nothing', () => {
    const w = face(M.LIMESTONE);
    const { dig, mut, rec, run } = setup(w);
    mut.place(2, 2, M.LIMESTONE, CAUSE.COLLAPSE);
    expect(dig.start(2, 2, 1, HANDS)).toBeGreaterThan(0);
    expect(run(() => w.mat[w.idx(2, 2)] === M.AIR)).toBe(Math.ceil((2.2 * 0.5) / (0.6 / 20)));
    expect(rec.of('digLoot').length).toBe(0);
  });
});

describe('save / load of digging in progress', () => {
  it('continues to the same tick and the same world as an uninterrupted run', () => {
    const make = () => {
      const w = carve(slab(12, 6, M.GRANITE), 0, 2, 3, 3);
      w.mat[w.idx(4, 3)] = M.IRON;
      return w;
    };
    const plan = (dig: DigSystem) => {
      dig.start(4, 2, 1, tool('iron_pick'));
      dig.start(4, 3, 2, tool('bronze_pick'));
    };
    // uninterrupted
    const A = setup(make());
    plan(A.dig);
    const tA = A.run(() => A.rec.of('digDone').length === 2);
    // 25 ticks, save through JSON, rebuild everything, continue
    const B = setup(make());
    plan(B.dig);
    B.run(() => false, 25);
    const saved = JSON.parse(JSON.stringify({ world: saveWorld(B.dig.world), dig: B.dig.save(), tag: Array.from(B.mut.tag) }));
    const w2 = loadWorld(saved.world);
    const C = setup(w2);
    C.mut.tag.set(saved.tag);
    C.dig.load(saved.dig);
    expect(C.dig.activeJobs).toBe(2);
    const tC = C.run(() => C.rec.of('digDone').length === 2);
    expect(25 + tC).toBe(tA);
    expect(hashWorld(w2)).toBe(hashWorld(A.dig.world));
    expect(C.rec.of('digLoot')).toEqual(A.rec.of('digLoot'));
  });
});
