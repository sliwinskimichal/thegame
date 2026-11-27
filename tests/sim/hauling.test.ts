/**
 * F2-3 stage 2 / step 3: items on the ground, stockpiles and hauling - loot goes to the stockpile,
 * capacity is never over-booked, one trip carries at most DWARF_STATS.carry, removing a zone frees its
 * piles, piles fall with their floor and come back when buried rubble is dug out.
 */
import { describe, expect, it } from 'vitest';
import { DWARF_STATS, STOCKPILE_RULES } from '../../src/content/dwarves';
import { ColonySim } from '../../src/sim/colony';
import { CAUSE } from '../../src/sim/events';
import { resourceIndex } from '../../src/sim/items';
import { M } from '../../src/world/materials';
import type { World } from '../../src/world/world';
import { carve, record, slab } from './helpers';

const STONE = resourceIndex('stone');

function colony(w: World) {
  const c = new ColonySim(w);
  const rec = record(c.bus, ['itemsPicked', 'itemsStored', 'itemsDropped', 'itemsBuried', 'jobDone']);
  return { c, rec, w };
}

const looseUnits = (c: ColonySim, item: number) => c.items.total(item, (i) => !c.stockpiles.isStorage(i));
const storedUnits = (c: ColonySim, item: number) => c.items.total(item, (i) => c.stockpiles.isStorage(i));

describe('hauling to stockpiles', () => {
  it('loot of a dug trench ends up in the stockpile; nothing stays loose', () => {
    const w = slab(40, 20, M.LIMESTONE, 6);
    carve(w, 2, 6, 6, 6); // a dug terrace for the stockpile (floor at row 7)
    const { c } = colony(w);
    for (let k = 0; k < 4; k++) c.dwarves.spawn(8 + k, 5);
    c.orderStockpile(2, 6, 6, 6);
    // a stepped trench (a 2-deep pit with sheer walls would trap the diggers: no ladder yet)
    c.orderDig(14, 6, 21, 6);
    c.orderDig(15, 7, 21, 7);
    c.run(2400);
    expect(c.sim.dig.stats.done).toBe(15);
    expect(storedUnits(c, STONE)).toBe(15);
    expect(looseUnits(c, STONE)).toBe(0);
    expect(c.dwarves.stats.deaths).toBe(0);
  });

  it('never over-books a full stockpile: 60 stone, room for 50, carried at most 10 per trip', () => {
    const w = slab(30, 12, M.GRANITE, 6);
    carve(w, 2, 6, 2, 6);
    const { c, rec } = colony(w);
    for (let k = 0; k < 5; k++) c.dwarves.spawn(10 + k, 5);
    c.orderStockpile(2, 6, 2, 6); // one tile
    c.items.drop(20, 5, STONE, 30);
    c.items.drop(24, 5, STONE, 30);
    let over = 0;
    for (let t = 0; t < 1500; t++) {
      c.step();
      const i = w.idx(2, 6);
      if (c.items.unitsAt(i) + c.stockpiles.incoming[i]! > STOCKPILE_RULES.perTile) over++;
    }
    expect(over).toBe(0);
    expect(storedUnits(c, STONE)).toBe(STOCKPILE_RULES.perTile);
    expect(looseUnits(c, STONE)).toBe(60 - STOCKPILE_RULES.perTile);
    expect(Math.max(...rec.of('itemsPicked').map((p) => p.n))).toBeLessThanOrEqual(DWARF_STATS.carry);
    expect(c.items.reserved.reduce((a, b) => a + b, 0)).toBe(0); // no reservation leaks
  });

  it('removing a stockpile makes its piles loose; a new zone takes them', () => {
    const w = slab(40, 12, M.GRANITE, 6);
    carve(w, 2, 6, 4, 6);
    carve(w, 30, 6, 32, 6);
    const { c } = colony(w);
    c.dwarves.spawn(16, 5);
    const a = c.orderStockpile(2, 6, 4, 6);
    c.items.drop(10, 5, STONE, 8);
    c.run(600);
    expect(storedUnits(c, STONE)).toBe(8);
    c.stockpiles.remove(a);
    c.orderStockpile(30, 6, 32, 6);
    c.run(900);
    expect(c.items.total(STONE, (i) => i % 40 >= 30)).toBe(8);
  });
});

describe('piles in a changing world', () => {
  it('a pile falls with its floor; a pile buried by rubble comes back when the rubble is dug out', () => {
    const w = carve(slab(20, 14, M.LIMESTONE), 2, 4, 12, 5);
    const { c, rec } = colony(w);
    c.items.drop(6, 4, STONE, 3); // lands on (6, 5)
    expect(c.items.unitsAt(w.idx(6, 5))).toBe(3);
    for (let y = 6; y <= 9; y++) c.sim.mut.dig(6, y, CAUSE.SCRIPT);
    expect(c.items.unitsAt(w.idx(6, 9))).toBe(3);
    c.items.drop(9, 4, STONE, 2);
    c.sim.mut.place(9, 5, M.LIMESTONE, CAUSE.COLLAPSE);
    expect(rec.of('itemsBuried')).toEqual([{ i: w.idx(9, 5), item: 'stone', n: 2 }]);
    expect(c.board.avail[STONE]).toBe(0 + 0); // nothing counted yet (cache refreshes per tick)
    c.step();
    expect(c.board.avail[STONE]).toBe(3); // the buried pile does not count
    c.sim.mut.dig(9, 5, CAUSE.SCRIPT);
    c.step();
    expect(c.items.unitsAt(w.idx(9, 5))).toBe(2);
    expect(c.board.avail[STONE]).toBe(5);
  });
});
