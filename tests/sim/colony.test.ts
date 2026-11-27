/**
 * F2-3 stage 2 / step 4: determinism and save/load of the whole headless colony (world, roofs,
 * digging, items, stockpiles, jobs, dwarves with their paths and the planner queue).
 */
import { describe, expect, it } from 'vitest';
import { ColonySim, type ColonySave } from '../../src/sim/colony';
import { resourceIndex } from '../../src/sim/items';
import { M } from '../../src/world/materials';
import { carve, slab } from './helpers';

/** A hill with a stockpile, wood, 12 dwarves and a timeline of orders (pit, shaft, drift, a hall that fails). */
function scenario(finder: 'hpa' | 'astar' = 'hpa') {
  const w = slab(64, 40, M.LIMESTONE, 8);
  for (let y = 24; y < 40; y++) for (let x = 0; x < 64; x++) w.mat[y * 64 + x] = w.bg[y * 64 + x] = M.GRANITE;
  carve(w, 2, 8, 9, 8); // a dug terrace for the stockpile
  const c = new ColonySim(w, { finder, seed: 99 });
  for (let k = 0; k < 12; k++) c.dwarves.spawn(10 + k * 2, 7);
  c.items.drop(3, 8, resourceIndex('wood'), 30);
  c.orderStockpile(4, 8, 9, 8);
  const orders: [number, () => void][] = [
    [0, () => c.orderDig(20, 8, 29, 11)], // an open pit 10 x 4
    [0, () => c.orderDig(34, 8, 35, 20)], // a shaft
    [200, () => c.orderDig(36, 19, 47, 20)], // a drift off its foot (12 long: holds)
    [600, () => c.orderDig(36, 16, 45, 18)], // raise it into a hall: the roof fails, a support is ordered
    [900, () => c.orderBuild(40, 20, 'wooden_prop')],
  ];
  return { c, orders };
}

function play(ticks: number, opts: { finder?: 'hpa' | 'astar'; saveAt?: number } = {}) {
  let { c, orders } = scenario(opts.finder);
  let k = 0;
  let saved: ColonySave | null = null;
  for (let t = 0; t < ticks; t++) {
    if (t === opts.saveAt) {
      saved = JSON.parse(JSON.stringify(c.save()));
      c = ColonySim.load(saved!);
      // the reloaded colony gets the remaining orders against itself
      const fresh = c;
      orders = orders.map(([at, _f], j) => [at, () => replay(fresh, j)] as [number, () => void]);
    }
    while (k < orders.length && orders[k]![0] === t) orders[k++]![1]();
    c.step();
  }
  return { c, saved };
}

/** The same orders as `scenario`, against a reloaded colony. */
function replay(c: ColonySim, j: number): void {
  const all = [() => c.orderDig(20, 8, 29, 11), () => c.orderDig(34, 8, 35, 20), () => c.orderDig(36, 19, 47, 20), () => c.orderDig(36, 16, 45, 18), () => c.orderBuild(40, 20, 'wooden_prop')];
  all[j]!();
}

describe('colony determinism and save/load', () => {
  it('two runs of 2000 ticks from the same seed give the same hash (and the colony really works)', () => {
    const a = play(2000).c;
    const b = play(2000).c;
    expect(b.hash()).toBe(a.hash());
    expect(a.board.stats.done).toBeGreaterThan(40);
    expect(a.sim.dig.stats.done).toBeGreaterThan(40);
    expect(a.dwarves.stats.deaths).toBe(0);
  });

  it('save -> JSON -> load at tick 1000 (and at uneven ticks) and finishing gives the same hash as the run without a break', () => {
    const a = play(2000).c;
    for (const saveAt of [1000, 137, 613, 1499]) {
      const { c, saved } = play(2000, { saveAt });
      expect(saved, `save at ${saveAt}`).not.toBeNull();
      expect(c.hash(), `save at ${saveAt}`).toBe(a.hash());
      expect(c.tick).toBe(2000);
    }
  });

  it('the same holds with plain A* paths', () => {
    const a = play(1200, { finder: 'astar' }).c;
    const { c } = play(1200, { finder: 'astar', saveAt: 500 });
    expect(c.hash()).toBe(a.hash());
  });
});
