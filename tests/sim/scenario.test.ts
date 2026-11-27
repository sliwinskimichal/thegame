/**
 * F2-3 stage 2 / step 6: proof scenarios of the headless colony.
 *  "Mała kopalnia": 8 dwarves, the player orders a 10 x 4 chamber in a hillside (behind a 2-tile entrance
 *  drift) and a stockpile on the meadow; the chamber gets dug, the loot ends in the stockpile, nobody
 *  dies, nothing deadlocks.
 *  Cave-in variants (limestone, roof wider than 6): with wood the dwarves stand timber props under the
 *  warned roof; without wood they flee and the roof falls on nobody.
 * Set SCENARIO_OUT=1 to print the ASCII views (copied into docs/design/sim/JOBS.md).
 */
import { describe, expect, it } from 'vitest';
import { ColonySim } from '../../src/sim/colony';
import { asciiWorld } from '../../src/sim/debug';
import { DS } from '../../src/sim/dwarves';
import { resourceIndex } from '../../src/sim/items';
import { JS } from '../../src/sim/jobs/types';
import { M } from '../../src/world/materials';
import { CAV } from '../../src/world/world';
import { record, slab } from './helpers';

const OUT = !!process.env.SCENARIO_OUT;

/** 48 x 30: a meadow (ground at row 13) left of a hill (rock from row 4) starting at x = 20. */
function hillside(rock: number) {
  const w = slab(48, 30, rock, 13);
  for (let y = 4; y < 13; y++)
    for (let x = 20; x < 48; x++) {
      const i = w.idx(x, y);
      w.mat[i] = w.bg[i] = rock;
      w.cav[i] = CAV.SOLID;
      w.depth[i] = 0;
    }
  return w;
}

/** Dwarves with a dot for each, over the ASCII view. */
function view(c: ColonySim, x0: number, y0: number, x1: number, y1: number): string {
  const rows = asciiWorld(c.sim, x0, y0, x1, y1).split('\n').map((r) => r.split(''));
  for (let d = 0; d < c.dwarves.n; d++) {
    if (c.dwarves.state[d] === DS.DEAD) continue;
    const cell = c.dwarves.agents[d]!.cell;
    const x = cell % c.world.w;
    const y = Math.floor(cell / c.world.w);
    if (x >= x0 && x <= x1 && y >= y0 && y <= y1) rows[y - y0]![x - x0] = c.dwarves.state[d] === DS.BURIED ? 'B' : 'd';
  }
  return rows.map((r) => r.join('')).join('\n');
}

function mine(rock: number, wood: number) {
  const c = new ColonySim(hillside(rock), { seed: 7 });
  const rec = record(c.bus, ['caveInWarning', 'caveIn', 'dwarfFled', 'dwarfBuried', 'dwarfDied', 'jobDone', 'supportPlaced']);
  for (let k = 0; k < 8; k++) c.dwarves.spawn(2 + k, 12, 'iron_pick');
  c.orderStockpile(3, 12, 10, 12);
  if (wood) c.items.drop(12, 12, resourceIndex('wood'), wood);
  return { c, rec };
}

const STONE = resourceIndex('stone');

describe('scenario: a small mine', () => {
  it('8 dwarves dig a 10 x 4 chamber in granite, haul the stone to the stockpile, nobody dies, nothing deadlocks', () => {
    const { c, rec } = mine(M.GRANITE, 0);
    // a 2-tile entrance drift, then the chamber behind it: an opening straight onto the meadow would
    // make its roof a cantilever over open air (the roof model fails it past maxSpan / 2)
    c.orderDig(20, 11, 21, 12, 7);
    // the player digs the upper three rows first and the floor row when they are done (lowering the floor
    // first would put the top row out of reach: dwarves reach one tile above their heads)
    c.orderDig(22, 10, 31, 12, 6);
    const before = view(c, 0, 8, 35, 15);
    let t = 0;
    let floor = false;
    while (t < 6000 && !(floor && c.board.openCount === 0 && c.items.total(STONE, (i) => c.stockpiles.isStorage(i)) === 44)) {
      if (!floor && c.board.openCount === 0 && c.sim.dig.stats.done === 34) {
        c.orderDig(22, 13, 31, 13, 4);
        floor = true;
      }
      c.step();
      t++;
    }
    const after = view(c, 0, 8, 35, 15);
    if (OUT) console.log(`\nmała kopalnia: ${t} ticków (${(t / 20).toFixed(1)} s)\nprzed:\n${before}\npo:\n${after}\n`);
    for (let y = 10; y <= 13; y++) for (let x = 22; x <= 31; x++) expect(c.world.isSolid(x, y), `${x},${y}`).toBe(false);
    expect(c.items.total(STONE, (i) => c.stockpiles.isStorage(i))).toBe(44); // 40 chamber + 4 entrance
    expect(c.sim.structure.stats.warnings).toBe(0);
    expect(c.items.total(STONE, (i) => !c.stockpiles.isStorage(i))).toBe(0);
    expect(rec.of('dwarfDied').length).toBe(0);
    expect(c.sim.structure.stats.collapses).toBe(0);
    let open = 0;
    for (let s = 0; s < c.board.span; s++) if (c.board.state[s] !== JS.FREE) open++;
    expect(open).toBe(0); // no job left behind, none blacklisted
    c.run(40);
    for (let d = 0; d < 8; d++) expect(c.dwarves.state[d], `dwarf ${d}`).toBe(DS.IDLE);
    expect(t).toBeLessThan(6000);
  });

  it('cave-in variant with wood: the roof warns as the chamber widens, dwarves stand timber props, nothing falls', () => {
    const { c, rec } = mine(M.LIMESTONE, 30);
    c.orderDig(20, 11, 29, 13); // 10 x 3 in limestone: wider than 6 fails without props
    let warned = '';
    for (let t = 0; t < 5000 && !(c.board.openCount === 0 && t > 200); t++) {
      c.step();
      if (!warned && rec.of('caveInWarning').length) warned = view(c, 14, 8, 33, 15);
    }
    c.run(1200); // well past any countdown
    if (OUT) console.log(`\nzawał (stemple): ostrzeżenie:\n${warned}\npo:\n${view(c, 14, 8, 33, 15)}\n`);
    expect(rec.of('caveInWarning').length).toBeGreaterThan(0);
    expect(rec.of('supportPlaced').length).toBeGreaterThan(0);
    expect(rec.of('caveIn').length).toBe(0);
    expect(c.sim.structure.failing).toBe(0);
    expect(rec.of('dwarfDied').length + rec.of('dwarfBuried').length).toBe(0);
  });

  it('cave-in variant without wood: nobody can prop the roof, the dwarves flee, the roof falls on nobody', () => {
    const { c, rec } = mine(M.LIMESTONE, 0);
    c.orderDig(20, 11, 29, 13);
    let warned = '';
    for (let t = 0; t < 5000 && rec.of('caveIn').length === 0; t++) {
      c.step();
      if (!warned && rec.of('caveInWarning').length) warned = view(c, 14, 8, 33, 15);
    }
    c.run(200);
    if (OUT) console.log(`\nzawał (bez drewna): ostrzeżenie:\n${warned}\npo:\n${view(c, 14, 8, 33, 15)}\n`);
    expect(rec.of('caveIn').length).toBeGreaterThan(0);
    expect(rec.of('dwarfDied').length).toBe(0);
    expect(rec.of('dwarfBuried').length).toBe(0);
  });
});
