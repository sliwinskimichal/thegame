/**
 * F2-3 stage 2 / step 1: the job board without dwarves - orders, duplicates and priorities, exposure,
 * blacklisting by different dwarves with reopening on world changes (change ring) or expiry,
 * automatic supports under a roof warning with dependent dig jobs, haul jobs for loose piles,
 * materials of cancelled sites, save/load.
 */
import { describe, expect, it } from 'vitest';
import { JOB_RULES } from '../../src/content/dwarves';
import { ItemPiles, resourceIndex } from '../../src/sim/items';
import { JobBoard } from '../../src/sim/jobs/board';
import { JF, JS, JT } from '../../src/sim/jobs/types';
import { Stockpiles } from '../../src/sim/stockpile';
import { WorldSim } from '../../src/sim/worldsim';
import { M } from '../../src/world/materials';
import type { World } from '../../src/world/world';
import { carve, record, slab } from './helpers';

function setup(w: World) {
  const sim = new WorldSim(w);
  const items = new ItemPiles(w, sim.bus);
  const piles = new Stockpiles(w, items);
  const board = new JobBoard(w, sim.bus, sim.dig, sim.structure, items, piles);
  board.dwarfCount = 8;
  const rec = record(sim.bus, ['jobOrdered', 'jobBlacklisted', 'jobReopened', 'jobCancelled', 'jobDone']);
  return { sim, items, piles, board, rec };
}

describe('orders, duplicates, priorities, exposure', () => {
  it('one dig job per tile; a repeated order raises the priority; open and unbreakable tiles are refused', () => {
    const w = carve(slab(20, 10), 2, 4, 5, 5);
    w.mat[w.idx(9, 9)] = M.BEDROCK;
    const { board } = setup(w);
    const a = board.orderDig(6, 4, 4);
    expect(a).toBeGreaterThan(0);
    expect(board.orderDig(6, 4, 7)).toBe(a);
    expect(board.prio[board.slot(a)]).toBe(7);
    expect(board.orderDig(6, 4, 2)).toBe(a);
    expect(board.prio[board.slot(a)]).toBe(7);
    expect(board.orderDig(3, 4)).toBe(0); // open
    expect(board.orderDig(9, 9)).toBe(0); // bedrock
    expect(board.orderDig(-1, 4)).toBe(0);
    expect(board.digJobAt(6, 4)).toBe(a);
  });

  it('a dig job deep in the rock opens only once a neighbour is dug', () => {
    const w = carve(slab(20, 10), 2, 4, 5, 5);
    const { sim, board } = setup(w);
    const deep = board.slot(board.orderDig(8, 4));
    const face = board.slot(board.orderDig(6, 4));
    expect(board.isOpen(face)).toBe(true);
    expect(board.isOpen(deep)).toBe(false);
    sim.mut.dig(6, 4);
    sim.mut.dig(7, 4);
    expect(board.isOpen(deep)).toBe(true);
    board.tick();
    expect(board.state[face]).toBe(JS.FREE); // dug by someone else: dropped as gone
  });
});

describe('blacklist after failed plans of different dwarves', () => {
  it('suspends after 3 different dwarves fail, reopens on a nearby world change but not a far one', () => {
    const w = carve(slab(64, 20), 2, 4, 5, 5);
    const { sim, board, rec } = setup(w);
    const h = board.orderDig(6, 4);
    const s = board.slot(h);
    for (const d of [0, 0, 0, 1]) {
      board.claimJob(s, d);
      board.fail(s, d);
    }
    expect(board.state[s]).toBe(JS.OPEN); // two different dwarves so far
    board.claimJob(s, 2);
    board.fail(s, 2);
    expect(board.state[s]).toBe(JS.SUSPENDED);
    expect(rec.of('jobBlacklisted')).toEqual([{ job: h, type: JT.DIG, x: 6, y: 4, fails: 3 }]);
    sim.mut.dig(50, 15); // far away
    board.tick();
    expect(board.state[s]).toBe(JS.SUSPENDED);
    sim.mut.dig(2, 6); // 4 tiles away
    board.tick();
    expect(board.state[s]).toBe(JS.OPEN);
    expect(rec.of('jobReopened')).toEqual([{ job: h, type: JT.DIG, x: 6, y: 4, reason: 'worldChanged' }]);
  });

  it('reopens on expiry; a colony of one dwarf blacklists after its single failure', () => {
    const w = carve(slab(30, 10), 2, 4, 5, 5);
    const { board, rec } = setup(w);
    board.dwarfCount = 1;
    const s = board.slot(board.orderDig(6, 4));
    board.claimJob(s, 0);
    board.fail(s, 0);
    expect(board.state[s]).toBe(JS.SUSPENDED);
    board.now += JOB_RULES.blacklistSec * 20 - 1;
    board.tick();
    expect(board.state[s]).toBe(JS.SUSPENDED);
    board.now += 1;
    board.tick();
    expect(board.state[s]).toBe(JS.OPEN);
    expect(rec.of('jobReopened')[0]!.reason).toBe('expired');
  });
});

describe('dependencies: a support before digging under a warned roof', () => {
  it('orders a timber prop in the middle of the failing span; dig jobs there wait and are closed until it holds', () => {
    const w = carve(slab(30, 12), 5, 4, 12, 6); // 8 wide, 3 tall limestone hall: fails
    const { sim, board, rec } = setup(w);
    const dg = board.slot(board.orderDig(13, 5)); // widening the hall at its east wall
    expect(board.isOpen(dg)).toBe(true);
    sim.step(); // warning
    const support = rec.of('jobOrdered').find((o) => o.type === JT.BUILD)!;
    expect(support).toMatchObject({ x: 9, y: 6, priority: JOB_RULES.supportPriority });
    const ss = board.slot(support.job);
    expect(board.flags[ss]! & JF.AUTO).toBe(JF.AUTO);
    expect(board.wait[dg]).toBe(support.job);
    expect(board.isOpen(dg)).toBe(false); // (12, 5) beside it is under the failing roof
    // the support is built (here directly): the roof holds, the dig job opens
    expect(sim.structure.placeSupport(9, 6, 'wooden_prop')).toBe(0);
    sim.step();
    board.tick();
    expect(sim.structure.failing).toBe(0);
    expect(board.isOpen(dg)).toBe(true);
  });
});

describe('hauling and materials', () => {
  it('orders a haul job for every loose pile once a stockpile exists; stored piles need none', () => {
    const w = carve(slab(30, 10), 2, 4, 20, 5);
    const { items, piles, board, rec } = setup(w);
    const stone = resourceIndex('stone');
    items.drop(4, 4, stone, 5); // falls to (4, 5)
    board.tick();
    expect(rec.of('jobOrdered').length).toBe(0); // no stockpile yet
    piles.add(15, 5, 18, 5);
    board.tick();
    expect(rec.of('jobOrdered').map((o) => [o.type, o.x, o.y])).toEqual([[JT.HAUL, 4, 5]]);
    items.drop(16, 4, stone, 3); // lands in the stockpile
    items.drop(8, 4, stone, 2);
    board.tick();
    expect(rec.of('jobOrdered').map((o) => o.x)).toEqual([4, 8]);
    expect(board.isOpen(board.slot(rec.of('jobOrdered')[0]!.job))).toBe(true);
  });

  it('a cancelled build site puts its delivered materials back on the ground', () => {
    const w = carve(slab(30, 10), 2, 4, 20, 5);
    const { items, board } = setup(w);
    const h = board.orderBuild(6, 5, 'wooden_prop');
    const s = board.slot(h);
    expect(board.missing(h)).toEqual([['wood', 3]]);
    expect(board.deliver(s, resourceIndex('wood'), 2)).toBe(2);
    expect(board.missing(h)).toEqual([['wood', 1]]);
    board.cancel(h);
    expect(items.unitsAt(w.idx(6, 5))).toBe(2);
    expect(board.orderBuild(6, 4, 'wooden_prop')).toBe(0); // a support needs a floor
    expect(board.orderBuild(6, 5, 'no_such_thing')).toBe(0);
  });
});

describe('save / load', () => {
  it('round-trips every job and rebuilds the tile lookups', () => {
    const w = carve(slab(30, 10), 2, 4, 20, 5);
    const a = setup(w);
    a.board.orderDig(21, 4, 6);
    const b = a.board.orderBuild(6, 5, 'ladder', 2);
    a.board.deliver(a.board.slot(b), resourceIndex('wood'), 1);
    const c = setup(w);
    c.board.load(JSON.parse(JSON.stringify(a.board.save())));
    expect(c.board.digJobAt(21, 4)).toBe(a.board.digJobAt(21, 4));
    expect(c.board.buildJobAt(6, 5)).toBe(b);
    expect(c.board.missing(b)).toEqual([['wood', 1]]);
    expect(c.board.save()).toEqual(a.board.save());
  });
});
