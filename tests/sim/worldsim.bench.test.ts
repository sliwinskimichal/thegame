/**
 * World-change core benchmark (skipped by default):
 *   SIM_BENCH=1 npx vitest run tests/sim/worldsim.bench.test.ts --silent=false
 * World 224 x 736 (the M2 size) with 400 rooms; compares two roof evaluation strategies and measures
 * the tick with 200 diggers working (jobs restart on fresh faces as tiles break).
 */
import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import { DIG_FAIL, pickTool } from '../../src/sim/dig';
import { WorldSim } from '../../src/sim/worldsim';
import { M } from '../../src/world/materials';
import { CAV, type World } from '../../src/world/world';
import { carve, slab } from './helpers';

const BENCH = !!process.env.SIM_BENCH;
const W = 224;
const H = 736;

function colony(seed: number): World {
  const rng = new Rng(seed);
  const w = slab(W, H, M.LIMESTONE, 12);
  for (let y = 40; y < H; y++) for (let x = 0; x < W; x++) if (y > 100) w.mat[y * W + x] = w.bg[y * W + x] = y > 400 ? M.BASALT : M.GRANITE;
  for (let k = 0; k < 400; k++) {
    const rw = rng.int(3, 20);
    const rh = rng.int(2, 6);
    const x = rng.int(1, W - rw - 2);
    const y = rng.int(14, H - rh - 3);
    carve(w, x, y, x + rw - 1, y + rh - 1, rng.chance(0.4) ? CAV.NATURAL : CAV.DUG);
  }
  carve(w, 100, 12, 101, H - 10); // a long shaft linking everything
  return w;
}

const stats = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
  return { mean: a.reduce((x, y) => x + y, 0) / a.length, p50: q(0.5), p95: q(0.95), max: s[s.length - 1]! };
};
const f = (v: number) => v.toFixed(3);

describe.skipIf(!BENCH)('world-change core benchmark', () => {
  it('roof evaluation: full pass vs dirty rows; tick with 200 diggers', () => {
    const sim = new WorldSim(colony(3));
    const rows: string[] = ['| Pomiar | średnia ms | p50 | p95 | max |', '|---|---|---|---|---|'];
    // A: full evaluation of every row
    const full: number[] = [];
    for (let k = 0; k < 20; k++) {
      const t0 = performance.now();
      sim.structure.evaluateAll(true);
      full.push(performance.now() - t0);
    }
    const A = stats(full);
    rows.push(`| A: pełna ocena stropów (${W}x${H}) | ${f(A.mean)} | ${f(A.p50)} | ${f(A.p95)} | ${f(A.max)} |`);

    // 200 diggers on exposed faces; a finished job restarts on the next exposed tile
    const picks = [pickTool('steel_pick')!, pickTool('cobalt_pick')!];
    const rng = new Rng(9);
    const faces: number[] = [];
    for (let i = W * 14; i < sim.world.size - W; i++) if (sim.world.isSolid(i % W, Math.floor(i / W)) && sim.dig.canDig(i % W, Math.floor(i / W), 4) === DIG_FAIL.OK) faces.push(i);
    rng.shuffle(faces);
    let next = 0;
    const startOne = (worker: number) => {
      while (next < faces.length) {
        const i = faces[next++]!;
        if (sim.dig.start(i % W, Math.floor(i / W), worker, picks[worker % 2]!) > 0) return;
      }
    };
    for (let k = 0; k < 200; k++) startOne(k);
    sim.bus.on('digDone', (e) => startOne(e.worker));
    const tick: number[] = [];
    const digT: number[] = [];
    const strT: number[] = [];
    for (let k = 0; k < 1000; k++) {
      const t0 = performance.now();
      sim.dig.tick();
      const t1 = performance.now();
      sim.structure.tick();
      const t2 = performance.now();
      sim.tick++;
      digT.push(t1 - t0);
      strT.push(t2 - t1);
      tick.push(t2 - t0);
    }
    const B = stats(tick);
    rows.push(`| B: tick (kopanie + stropy, wiersze brudne), 200 kopaczy | ${f(B.mean)} | ${f(B.p50)} | ${f(B.p95)} | ${f(B.max)} |`);
    const D = stats(digT);
    rows.push(`| — w tym kopanie | ${f(D.mean)} | ${f(D.p50)} | ${f(D.p95)} | ${f(D.max)} |`);
    const S = stats(strT);
    rows.push(`| — w tym stropy (ocena przyrostowa + odliczanie + zawały) | ${f(S.mean)} | ${f(S.p50)} | ${f(S.p95)} | ${f(S.max)} |`);
    // A as a tick strategy: re-evaluate everything whenever anything changed
    const alt: number[] = [];
    for (let k = 0; k < 200; k++) {
      const t0 = performance.now();
      sim.dig.tick();
      sim.structure.evaluateAll(false);
      sim.structure.tick();
      alt.push(performance.now() - t0);
    }
    const C = stats(alt);
    rows.push(`| C: tick ze strategią A (pełna ocena co tick) | ${f(C.mean)} | ${f(C.p50)} | ${f(C.p95)} | ${f(C.max)} |`);
    const s = sim.structure.stats;
    const ds = sim.dig.stats;
    console.log(
      `\n${rows.join('\n')}\n\nkafle wykopane: ${ds.done}, zawały: ${s.collapses} (rumosz: ${s.filled}), ostrzeżenia: ${s.warnings}, wiersze ocenione: ${s.rowsEvaluated}\n`,
    );
    expect(B.p95).toBeLessThan(4);
  });
});
