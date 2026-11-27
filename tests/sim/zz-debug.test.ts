import { it } from 'vitest';
import { ColonySim } from '../../src/sim/colony';
import { M } from '../../src/world/materials';
import { CAV } from '../../src/world/world';
import { slab } from './helpers';
it('who gets buried', () => {
  const w = slab(48, 30, M.LIMESTONE, 13);
  for (let y = 4; y < 13; y++) for (let x = 20; x < 48; x++) { const i = w.idx(x, y); w.mat[i] = w.bg[i] = M.LIMESTONE; w.cav[i] = CAV.SOLID; w.depth[i] = 0; }
  const c = new ColonySim(w, { seed: 7 });
  for (let k = 0; k < 8; k++) c.dwarves.spawn(2 + k, 12, 'iron_pick');
  c.orderStockpile(3, 12, 10, 12);
  c.orderDig(20, 11, 29, 13);
  c.bus.on('dwarfBuried', (e) => { const d = e.dwarf; console.log('tick', c.tick, 'buried', JSON.stringify(e), 'state/step', c.dwarves.step[d], 'agent', c.dwarves.agents[d]!.state); });
  c.bus.on('caveIn', (e) => console.log('tick', c.tick, 'caveIn row', e.row, e.x0, e.x1, 'roof', e.roof.map(i => i % 48)));
  c.bus.on('dwarfFled', (e) => console.log('tick', c.tick, 'fled', JSON.stringify(e)));
  const seen = new Map<number, string>();
  for (let t = 0; t < 1500; t++) {
    c.step();
    for (let d = 0; d < 8; d++) { const cell = c.dwarves.agents[d]!.cell; const s = `${c.dwarves.state[d]}@${cell % 48},${Math.floor(cell / 48)} job ${c.dwarves.job[d]} danger ${c.sim.structure.dangerAt(cell % 48, Math.floor(cell / 48))}`; if (c.sim.structure.failing && seen.get(d) !== s && t > 1000) { seen.set(d, s); } }
  }
});
