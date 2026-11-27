/**
 * Headless colony benchmark (skipped by default; budget M3: 200 dwarves < 4 ms/tick p95):
 *   SIM_BENCH=1 npx vitest run tests/sim/colony.bench.test.ts --silent=false
 * World CONFIG.worldW x CONFIG.worldH (224 x 736): ten 2-tall galleries off a laddered shaft, braced
 * by stone pillars, 20 dwarves per gallery (iron picks), stockpiles and wood by the shaft, ~3000 dig
 * orders that extend and deepen the galleries (many faces at once; roofs fail as ends grow: warnings,
 * automatic supports, hauling).
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { ColonySim } from '../../src/sim/colony';
import { resourceIndex } from '../../src/sim/items';
import { INFRA } from '../../src/sim/nav';
import { M } from '../../src/world/materials';
import { carve, slab } from './helpers';

const BENCH = !!process.env.SIM_BENCH;

function build(finder: 'hpa' | 'astar') {
  const W = CONFIG.worldW;
  const H = CONFIG.worldH;
  const w = slab(W, H, M.GRANITE, 12);
  const galleries = Array.from({ length: 10 }, (_, g) => 30 + g * 20);
  carve(w, 110, 12, 110, galleries[galleries.length - 1]!);
  for (const y of galleries) carve(w, 60, y - 1, 160, y);
  const c = new ColonySim(w, { finder });
  c.grid.setInfraColumn(110, 12, galleries[galleries.length - 1]!, INFRA.LADDER);
  const wood = resourceIndex('wood');
  for (const y of galleries) {
    for (let x = 64; x <= 156; x += 12) c.sim.structure.placeSupport(x, y, 'stone_pillar');
    c.orderStockpile(96, y, 108, y);
    c.items.drop(112, y, wood, 60);
    for (let k = 0; k < 20; k++) c.dwarves.spawn(62 + k * 5, y, 'iron_pick'); // granite needs tier 2
    c.orderDig(30, y - 1, 59, y); // extend both ends
    c.orderDig(161, y - 1, 200, y);
    // deepen the gallery by a row (many faces at once; deeper pits would trap dwarves without ladders),
    // leaving the pillar footings, the stockpile and the shaft
    for (let x = 61; x <= 159; x++) if ((x - 64) % 12 !== 0 && (x < 95 || x > 111)) c.orderDig(x, y + 1, x, y + 1);
  }
  return c;
}

const stats = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
  return { mean: a.reduce((x, y) => x + y, 0) / a.length, p50: q(0.5), p95: q(0.95), max: s[s.length - 1]! };
};
const f = (v: number) => v.toFixed(3);

describe.skipIf(!BENCH)('colony benchmark: 200 dwarves, full loop', () => {
  for (const finder of ['hpa', 'astar'] as const)
    it(`ticks with ${finder}`, () => {
      const c = build(finder);
      expect(c.dwarves.n).toBe(200);
      const parts = { sync: [] as number[], think: [] as number[], planner: [] as number[], move: [] as number[], world: [] as number[], jobs: [] as number[], total: [] as number[] };
      const T = 1200;
      for (let t = 0; t < T; t++) {
        const tk = c.sim.tick;
        c.board.now = tk;
        c.dwarves.now = tk;
        c.board.dwarfCount = c.dwarves.alive;
        const t0 = performance.now();
        c.grid.sync();
        const t1 = performance.now();
        c.dwarves.think();
        const t2 = performance.now();
        c.planner.run();
        const t3 = performance.now();
        c.dwarves.move();
        const t4 = performance.now();
        c.sim.step();
        const t5 = performance.now();
        c.board.tick();
        const t6 = performance.now();
        if (t < 100) continue; // warm-up: JIT and the first burst of 200 plans
        parts.sync.push(t1 - t0);
        parts.think.push(t2 - t1);
        parts.planner.push(t3 - t2);
        parts.move.push(t4 - t3);
        parts.world.push(t5 - t4);
        parts.jobs.push(t6 - t5);
        parts.total.push(t6 - t0);
      }
      const rows = ['| Podsystem | średnia ms | p50 | p95 | max |', '|---|---|---|---|---|'];
      const names: Record<keyof typeof parts, string> = {
        sync: 'grid.sync (nawigacja po zmianach)', think: 'krasnoludy: decyzje i działania', planner: 'planer ścieżek (budżet 2000)',
        move: 'krasnoludy: ruch, upadki', world: 'kopanie + stropy', jobs: 'tablica zadań', total: '**cały tick**',
      };
      for (const k of Object.keys(parts) as (keyof typeof parts)[]) {
        const s = stats(parts[k]);
        rows.push(`| ${names[k]} | ${f(s.mean)} | ${f(s.p50)} | ${f(s.p95)} | ${f(s.max)} |`);
      }
      const d = c.dwarves.stats;
      console.log(
        `\n[${finder}] ${T - 100} ticków po rozgrzaniu\n${rows.join('\n')}\n` +
          `wykopane: ${c.sim.dig.stats.done}, zadania wykonane: ${c.board.stats.done}, w magazynach: ${c.items.total(resourceIndex('stone'), (i) => c.stockpiles.isStorage(i))} kamienia, ` +
          `ostrzeżenia: ${c.sim.structure.stats.warnings}, zawały: ${c.sim.structure.stats.collapses}, podpory: ${c.board.stats.ordered}, ` +
          `nieudane plany: ${d.navFails}, konflikty miejsc: ${d.spotConflicts}, ucieczki: ${d.fled}, zgony: ${d.deaths}, plany: ${c.planner.served}, czekanie maks.: ${c.planner.waitMax} ticków\n`,
      );
      expect(stats(parts.total).p95).toBeLessThan(4);
    });
});
