/**
 * F2-3 stage 2 / step 2: dwarves as agents - choose a job, walk, work, report; spot reservations,
 * personal and job priorities, failed plans and blacklisting, falls, burial and rescue orders,
 * fleeing from a failing roof, building supports and ladders with materials fetched from piles.
 */
import { describe, expect, it } from 'vitest';
import { asciiWorld } from '../../src/sim/debug';
import { DS } from '../../src/sim/dwarves';
import { ColonySim } from '../../src/sim/colony';
import { resourceIndex } from '../../src/sim/items';
import { JS } from '../../src/sim/jobs/types';
import { INFRA } from '../../src/sim/nav';
import { CAUSE } from '../../src/sim/events';
import { M } from '../../src/world/materials';
import type { World } from '../../src/world/world';
import { carve, record, slab } from './helpers';

/** 40 x 24 limestone hill under 6 rows of sky; dwarves stand on row 5. */
const hill = () => slab(40, 24, M.LIMESTONE, 6);

function colony(w: World, finder: 'hpa' | 'astar' = 'hpa') {
  const c = new ColonySim(w, { finder });
  const rec = record(c.bus, ['jobDone', 'jobBlacklisted', 'digLoot', 'dwarfFell', 'dwarfBuried', 'dwarfRescued', 'dwarfFled', 'dwarfDied', 'itemsStored', 'supportPlaced']);
  const until = (done: () => boolean, max = 4000) => {
    let n = 0;
    while (!done() && n < max) {
      c.step();
      n++;
    }
    return n;
  };
  return { c, rec, until, w };
}

describe('the job loop', () => {
  it('a dwarf walks to an ordered tile, digs it with its pick and the loot lies on the floor', () => {
    const { c, rec, until, w } = colony(hill());
    const d = c.dwarves.spawn(3, 5);
    expect(d).toBe(0);
    c.orderDig(9, 6, 9, 6);
    const t = until(() => rec.of('jobDone').length > 0);
    expect(t).toBeLessThan(200); // walk ~6 tiles (2.4 s) + dig 2.2 s with a copper pick
    expect(w.isSolid(9, 6)).toBe(false);
    expect(rec.of('digLoot')[0]).toMatchObject({ resource: 'stone', n: 1, worker: 0 });
    expect(c.items.unitsAt(w.idx(9, 6))).toBe(1);
    expect(c.dwarves.state[0]).toBe(DS.IDLE);
  });

  it('higher job priority goes first; a personal priority of 0 means never', () => {
    const { c, rec, until } = colony(hill());
    c.dwarves.spawn(10, 5);
    c.board.orderDig(4, 6, 2);
    c.board.orderDig(16, 6, 8);
    until(() => rec.of('jobDone').length > 0);
    expect(rec.of('jobDone')[0]).toMatchObject({ x: 16, y: 6 });
    c.dwarves.setWorkPriority(0, 'dig', 0);
    c.run(400);
    expect(rec.of('jobDone').length).toBe(1);
  });

  it('two dwarves never share a work spot; six dwarves dig a 6 x 2 trench without conflicts', () => {
    const { c, rec, until, w } = colony(hill());
    for (let k = 0; k < 6; k++) c.dwarves.spawn(2 + k, 5);
    c.orderDig(12, 6, 17, 7);
    let shared = 0;
    const t = until(() => {
      const spots = new Set<number>();
      for (let d = 0; d < c.dwarves.n; d++) {
        const sp = c.dwarves.spot[d]!;
        if (sp < 0) continue;
        if (spots.has(sp)) shared++;
        spots.add(sp);
      }
      return rec.of('jobDone').length === 12;
    });
    expect(t).toBeLessThan(2000);
    expect(shared).toBe(0);
    for (let y = 6; y <= 7; y++) for (let x = 12; x <= 17; x++) expect(w.isSolid(x, y)).toBe(false);
    expect(rec.of('dwarfDied').length).toBe(0);
  });

  it('a job nobody can reach is blacklisted after the plans of three different dwarves fail', () => {
    const w = hill();
    // a sealed pocket in bedrock with a limestone tile inside: exposed, but unreachable
    for (let y = 12; y <= 18; y++) for (let x = 20; x <= 28; x++) w.mat[w.idx(x, y)] = w.bg[w.idx(x, y)] = M.BEDROCK;
    carve(w, 22, 14, 26, 16);
    w.mat[w.idx(24, 16)] = M.LIMESTONE; // floor tile of the pocket, dig target
    w.cav[w.idx(24, 16)] = 0;
    const { c, rec, until } = colony(w);
    for (let k = 0; k < 3; k++) c.dwarves.spawn(3 + k, 5);
    const h = c.board.orderDig(24, 16);
    expect(c.board.isOpen(c.board.slot(h))).toBe(true);
    until(() => rec.of('jobBlacklisted').length > 0, 3000);
    expect(rec.of('jobBlacklisted')[0]).toMatchObject({ job: h, fails: 3 });
    expect(c.board.state[c.board.slot(h)]).toBe(JS.SUSPENDED);
    expect(c.dwarves.stats.navFails).toBeGreaterThanOrEqual(3);
  });
});

describe('hazards: falls, burial, a failing roof', () => {
  it('falling 7 rows down a fresh shaft hurts (beyond the safe 3) and stuns', () => {
    const { c, rec } = colony(hill());
    c.dwarves.spawn(5, 5);
    c.step();
    for (let y = 6; y <= 12; y++) c.sim.mut.dig(5, y, CAUSE.SCRIPT);
    c.step();
    c.step();
    expect(rec.of('dwarfFell')[0]).toMatchObject({ dwarf: 0, rows: 7, damage: 60 });
    expect(c.dwarves.hp[0]).toBe(40);
    expect(c.dwarves.state[0]).toBe(DS.STUNNED);
  });

  it('a dwarf under rubble is buried, rescue digs are ordered at top priority and a friend digs it out', () => {
    const w = carve(hill(), 4, 10, 15, 11); // a drift 12 long, 2 tall: holds
    const { c, rec, until } = colony(w);
    c.dwarves.spawn(10, 11);
    c.dwarves.spawn(5, 11);
    c.step();
    c.sim.mut.place(10, 11, M.LIMESTONE, CAUSE.COLLAPSE);
    c.sim.mut.place(10, 10, M.LIMESTONE, CAUSE.COLLAPSE);
    c.step();
    expect(c.dwarves.state[0]).toBe(DS.BURIED);
    expect(rec.of('dwarfBuried').length).toBe(1);
    const h = c.board.digJobAt(10, 11);
    expect(h).toBeGreaterThan(0);
    expect(c.board.prio[c.board.slot(h)]).toBe(9);
    until(() => rec.of('dwarfRescued').length > 0, 2000);
    expect(rec.of('dwarfRescued')[0]!.dwarf).toBe(0);
    expect(c.dwarves.hp[0]).toBeGreaterThan(0);
  });

  it('dwarves standing under a failing roof flee before it falls; nobody is buried', () => {
    const w = carve(slab(40, 16, M.LIMESTONE, 4), 2, 8, 30, 10); // 29-wide hall, 3 tall: fails
    const { c, rec, until } = colony(w);
    for (let k = 0; k < 4; k++) c.dwarves.spawn(13 + k, 10);
    until(() => rec.of('dwarfFled').length >= 4, 100);
    expect(rec.of('dwarfFled').length).toBe(4);
    c.run(700); // the countdown (30 s) runs out
    expect(c.sim.structure.stats.collapses).toBeGreaterThan(0);
    expect(rec.of('dwarfBuried').length).toBe(0);
    expect(rec.of('dwarfDied').length).toBe(0);
  });
});

describe('building with materials', () => {
  it('a dwarf fetches wood from a pile and stands a timber prop; another builds a ladder', () => {
    const w = carve(hill(), 4, 10, 15, 11); // a drift 12 long, 2 tall: holds
    const { c, rec, until } = colony(w);
    c.dwarves.spawn(6, 11);
    c.dwarves.spawn(7, 11);
    c.items.drop(5, 11, resourceIndex('wood'), 10);
    const prop = c.orderBuild(12, 11, 'wooden_prop');
    const ladder = c.orderBuild(14, 11, 'ladder');
    expect(prop).toBeGreaterThan(0);
    expect(ladder).toBeGreaterThan(0);
    until(() => rec.of('jobDone').length >= 2, 2000);
    expect(rec.of('supportPlaced')[0]).toMatchObject({ x: 12, y: 11, id: 'wooden_prop' });
    expect(c.grid.infra[w.idx(14, 11)]).toBe(INFRA.LADDER);
    expect(c.items.total(resourceIndex('wood'))).toBe(10 - 3 - 2);
    expect(asciiWorld(c.sim, 4, 9, 15, 12)).toContain('T');
    expect(c.sim.structure.failing).toBe(0);
  });
});
