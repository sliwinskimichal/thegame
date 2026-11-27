import { it } from 'vitest';
import { ColonySim } from '../../src/sim/colony';
import { resourceIndex } from '../../src/sim/items';
import { hashWords } from '../../src/sim/world/snapshot';
import { M } from '../../src/world/materials';
import { carve, slab } from './helpers';
function make() {
  const w = slab(64, 40, M.LIMESTONE, 8);
  for (let y = 24; y < 40; y++) for (let x = 0; x < 64; x++) w.mat[y * 64 + x] = w.bg[y * 64 + x] = M.GRANITE;
  carve(w, 2, 8, 9, 8);
  const c = new ColonySim(w, { finder: 'astar', seed: 99 });
  for (let k = 0; k < 12; k++) c.dwarves.spawn(10 + k * 2, 7);
  c.items.drop(3, 8, resourceIndex('wood'), 30);
  c.orderStockpile(4, 8, 9, 8);
  return c;
}
const orders = (c: ColonySim, t: number) => {
  if (t === 0) { c.orderDig(20, 8, 29, 11); c.orderDig(34, 8, 35, 20); }
  if (t === 200) c.orderDig(36, 19, 47, 20);
  if (t === 600) c.orderDig(36, 16, 45, 18);
  if (t === 900) c.orderBuild(40, 20, 'wooden_prop');
};
const parts = (c: ColonySim) => {
  const dw = c.dwarves.save();
  return {
    world: c.sim.hash(),
    items: hashWords(0, c.items.save().arrays.count),
    jobs: Object.values(c.board.save().arrays).reduce((h, a) => hashWords(h, a), 0),
    dwarves: Object.entries(dw.arrays).map(([k, a]) => [k, hashWords(0, a.map((v) => Math.round(v * 1e6)))]),
    agents: dw.agents.map((a) => JSON.stringify(a)),
  };
};
it('find divergence', () => {
  const a = make();
  for (let t = 0; t < 500; t++) { orders(a, t); a.step(); }
  const b = ColonySim.load(JSON.parse(JSON.stringify(a.save())));
  for (let t = 500; t < 1200; t++) {
    orders(a, t); orders(b, t);
    const pa = parts(a), pb = parts(b);
    const diff: string[] = [];
    if (pa.world !== pb.world) diff.push('world');
    if (pa.items !== pb.items) diff.push('items');
    if (pa.jobs !== pb.jobs) diff.push('jobs');
    pa.dwarves.forEach((d, k) => { if (d[1] !== pb.dwarves[k]![1]) diff.push('dw.' + d[0]); });
    pa.agents.forEach((s, k) => { if (s !== pb.agents[k]) diff.push('agent' + k + ':' + s.slice(0, 300) + ' VS ' + pb.agents[k]!.slice(0, 300)); });
    if (diff.length) { console.log('diverged before step at t=' + t, diff.slice(0, 6)); break; }
    a.step(); b.step();
  }
});
