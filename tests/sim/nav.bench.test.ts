/**
 * Navigation benchmark (skipped by default):
 *   NAV_BENCH=1 npx vitest run tests/sim/nav.bench.test.ts --silent=false
 *   NAV_BENCH_OUT=docs/design/ai/nav-bench.md  -> also writes the markdown tables
 *   NAV_MAP_OUT=/tmp/mine.png                  -> PNG of the synthetic mine (nav layer)
 *
 * Algorithms: A*, A* with jump tables (JPS+-like), HPA* 16x16, HPA* 32x32,
 * weighted A* (w = 1.5, reference for the speed/quality trade-off).
 * Maps: the lab arena (64 x 46, ladders added) and synthetic mines 224 x 720.
 * Metrics: query time (median, p95), expansions, path cost vs optimum,
 * time of a tile change (grid + algorithm update), memory (typed arrays).
 */
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import { M, SOLID } from '../../src/world/materials';
import { FLUID } from '../../src/world/world';
import { AStar, type PathFinder } from '../../src/sim/nav/astar';
import { NavGrid } from '../../src/sim/nav/grid';
import { HpaStar } from '../../src/sim/nav/hpa';
import { Path, scratchFor } from '../../src/sim/nav/search';
import { applyLinks, buildSyntheticMine, type NavScenario } from '../../src/sim/nav/testmaps';
import { INFRA, INFRA_KIND, NAV } from '../../src/sim/nav/types';
import { arenaScenario } from './navfixtures';

const BENCH = !!process.env.NAV_BENCH;

interface Algo {
  name: string;
  make: (g: NavGrid) => PathFinder;
}

const ALGOS: Algo[] = [
  { name: 'A*', make: (g) => new AStar(g, 0) },
  { name: 'A* + skoki (JPS+)', make: (g) => new AStar(g, 0, { jumps: true }) },
  { name: 'HPA* 16×16', make: (g) => new HpaStar(g, 0, { cluster: 16 }) },
  { name: 'HPA* 32×32', make: (g) => new HpaStar(g, 0, { cluster: 32 }) },
  { name: 'A* ważony w=1,5', make: (g) => new AStar(g, 0, { weight: 1.5 }) },
];

const now = () => performance.now();
const pct = (a: number[], p: number) => {
  if (a.length === 0) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor((s.length - 1) * p))];
};
const f2 = (v: number) => (Number.isFinite(v) ? v.toFixed(v < 1 ? 3 : v < 10 ? 2 : 1) : '—');
const kb = (b: number) => `${(b / 1024).toFixed(0)} KB`;

function buildGrid(sc: NavScenario): NavGrid {
  const g = new NavGrid(sc.world, { infra: sc.infra });
  applyLinks(g, sc);
  g.sync();
  return g;
}

function standableCells(g: NavGrid): number[] {
  const out: number[] = [];
  for (let i = 0; i < g.n; i++) if (g.standable(0, i)) out.push(i);
  return out;
}

/** Query sets: global pairs and local pairs (goal within 24 tiles), deterministic. */
function makeQueries(g: NavGrid, cells: number[], n: number, seed: string): { global: [number, number][]; local: [number, number][] } {
  const rng = new Rng(seed);
  const global: [number, number][] = [];
  const local: [number, number][] = [];
  for (let k = 0; k < n; k++) global.push([cells[Math.floor(rng.next() * cells.length)], cells[Math.floor(rng.next() * cells.length)]]);
  const W = g.w;
  let guard = 0;
  while (local.length < n && guard++ < n * 200) {
    const s = cells[Math.floor(rng.next() * cells.length)];
    const x = (s % W) + rng.int(-24, 24);
    const y = Math.floor(s / W) + rng.int(-24, 24);
    if (x < 0 || y < 0 || x >= W || y >= g.h) continue;
    const t = y * W + x;
    if (t !== s && g.standable(0, t)) local.push([s, t]);
  }
  return { global, local };
}

interface QueryStats {
  found: number;
  failed: number;
  medFound: number;
  p95Found: number;
  medFail: number;
  p95Fail: number;
  expFound: number;
  ratioMean: number;
  ratioMax: number;
}

function runQueries(f: PathFinder, qs: [number, number][], ref: Map<number, number> | null, refOut: Map<number, number> | null): QueryStats {
  const path = new Path();
  for (const [s, t] of qs) f.find(s, [t], path); // warm-up (JIT, caches)
  const tf: number[] = [];
  const tn: number[] = [];
  let exp = 0;
  let rs = 0;
  let rmax = 1;
  let rn = 0;
  qs.forEach(([s, t], k) => {
    const t0 = now();
    const st = f.find(s, [t], path);
    const dt = now() - t0;
    if (st === NAV.FOUND) {
      tf.push(dt);
      exp += f.expanded;
      refOut?.set(k, path.cost);
      const opt = ref?.get(k);
      if (opt !== undefined && opt > 0) {
        const r = path.cost / opt;
        rs += r;
        rn++;
        rmax = Math.max(rmax, r);
      }
    } else tn.push(dt);
  });
  return {
    found: tf.length, failed: tn.length,
    medFound: pct(tf, 0.5), p95Found: pct(tf, 0.95), medFail: pct(tn, 0.5), p95Fail: pct(tn, 0.95),
    expFound: tf.length ? exp / tf.length : 0, ratioMean: rn ? rs / rn : 1, ratioMax: rmax,
  };
}

/** Tile changes like mining and cave-ins: dig solid tiles next to open ones, fill open tiles. */
function changeSequence(sc: NavScenario, n: number, seed: string): [number, number, boolean][] {
  const rng = new Rng(seed);
  const { world } = sc;
  const W = world.w;
  const out: [number, number, boolean][] = [];
  let guard = 0;
  while (out.length < n && guard++ < n * 500) {
    const x = rng.int(2, W - 3);
    const y = rng.int(42, world.h - 6);
    const i = y * W + x;
    const solid = SOLID[world.mat[i]] === 1;
    const nearOpen = !SOLID[world.mat[i - 1]] || !SOLID[world.mat[i + 1]] || !SOLID[world.mat[i - W]] || !SOLID[world.mat[i + W]];
    if (solid && nearOpen && world.mat[i] !== M.BEDROCK && rng.chance(0.7)) out.push([x, y, true]);
    else if (!solid && rng.chance(0.3)) out.push([x, y, false]);
  }
  return out;
}

function writePng(path: string, w: number, h: number, rgb: Uint8Array): void {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1);
  const table = new Int32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c;
  });
  const crc = (b: Buffer) => {
    let c = -1;
    for (const v of b) c = table[(c ^ v) & 255] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

/** Debug picture of the navigation layer (2 px per tile). */
function mapPicture(sc: NavScenario, g: NavGrid, file: string): void {
  const S = 2;
  const W = g.w * S;
  const H = g.h * S;
  const rgb = new Uint8Array(W * H * 3);
  for (let y = 0; y < g.h; y++)
    for (let x = 0; x < g.w; x++) {
      const i = y * g.w + x;
      const k = g.infra[i] & INFRA_KIND;
      let c = g.solid[i] ? 0x3a3530 : 0x14161c;
      if (!g.solid[i] && sc.world.fluid[i] > 0) c = sc.world.fluidKind[i] === FLUID.WATER ? 0x2a5fb0 : 0xff5010;
      if (g.standable(0, i)) c = g.mask[0][i] === 0 ? 0x806020 : 0x4fbf5a;
      if (k === INFRA.LADDER) c = 0xc08a4a;
      else if (k === INFRA.STAIRS) c = 0xf0a020;
      else if (k === INFRA.PLATFORM) c = 0xf0e060;
      for (let sy = 0; sy < S; sy++)
        for (let sx = 0; sx < S; sx++) {
          const o = ((y * S + sy) * W + x * S + sx) * 3;
          rgb[o] = (c >> 16) & 255;
          rgb[o + 1] = (c >> 8) & 255;
          rgb[o + 2] = c & 255;
        }
    }
  for (let l = 0; l < g.linkCount; l++)
    for (const c of [g.linkFrom[l], g.linkTo[l]]) {
      const x = (c % g.w) * S;
      const y = Math.floor(c / g.w) * S;
      for (let k = 0; k < S * S; k++) {
        const o = ((y + Math.floor(k / S)) * W + x + (k % S)) * 3;
        rgb[o] = 255;
        rgb[o + 1] = 40;
        rgb[o + 2] = 200;
      }
    }
  writePng(file, W, H, rgb);
}

describe.runIf(BENCH)('navigation benchmark', () => {
  it('runs every algorithm on the arena and two synthetic mines', { timeout: 600_000 }, () => {
    const lines: string[] = [];
    const log = (s = '') => {
      lines.push(s);
      console.log(s);
    };
    const scenarios: [NavScenario, number][] = [
      [arenaScenario(), 300],
      [buildSyntheticMine(1), 300],
      [buildSyntheticMine(2), 300],
    ];
    if (process.env.NAV_MAP_OUT) {
      const sc = scenarios[1][0];
      mapPicture(sc, buildGrid(sc), process.env.NAV_MAP_OUT);
    }
    for (const [sc, nq] of scenarios) {
      const tb = now();
      const g0 = buildGrid(sc);
      const gridMs = now() - tb;
      const cells = standableCells(g0);
      const { global, local } = makeQueries(g0, cells, nq, `q-${sc.name}`);
      log(`\n### ${sc.name}`);
      log(`węzły (kafle stawialne): ${cells.length}, linki: ${g0.linkCount}, budowa NavGrid: ${f2(gridMs)} ms, ` +
        `pamięć NavGrid: ${kb(g0.bytes())} (+ wspólne bufory wyszukiwania ${kb(scratchFor(g0).bytes())})`);
      // reference costs from plain A*
      const refG = new Map<number, number>();
      const refL = new Map<number, number>();
      const refFinder = new AStar(g0, 0);
      runQueries(refFinder, global, null, refG);
      runQueries(refFinder, local, null, refL);
      log('');
      log('| Algorytm | budowa [ms] | pamięć własna | lokalne: mediana / p95 [ms] | globalne: mediana / p95 [ms] | brak ścieżki: mediana / p95 [ms] | rozwinięte węzły (globalne) | koszt / optimum (śr. / maks.) |');
      log('|---|---|---|---|---|---|---|---|');
      for (const a of ALGOS) {
        const t0 = now();
        const f = a.make(g0);
        const buildMs = now() - t0;
        const L = runQueries(f, local, refL, null);
        const G = runQueries(f, global, refG, null);
        expect(G.found).toBe(refG.size);
        log(`| ${a.name} | ${f2(buildMs)} | ${kb(f.bytes())} | ${f2(L.medFound)} / ${f2(L.p95Found)} | ${f2(G.medFound)} / ${f2(G.p95Found)} | ` +
          `${f2(G.medFail)} / ${f2(G.p95Fail)} (${G.failed}) | ${G.expFound.toFixed(0)} | ${G.ratioMean.toFixed(4)} / ${G.ratioMax.toFixed(3)} |`);
        f.dispose();
      }
      log(`\nzapytań: lokalnych ${local.length} (cel ≤ 24 kafle), globalnych ${global.length} (w tym bez ścieżki: ${global.length - refG.size})`);
      // updates: one grid per algorithm on the same world, same change sequence
      const changes = changeSequence(sc, 150, `chg-${sc.name}`);
      const grids = ALGOS.slice(0, 4).map(() => buildGrid(sc));
      const finders = ALGOS.slice(0, 4).map((a, k) => a.make(grids[k]));
      const times: number[][] = finders.map(() => []);
      const gridOnly: number[] = [];
      for (const [x, y, dig] of changes) {
        if (dig) sc.world.dig(x, y);
        else sc.world.fill(x, y, M.GRANITE);
        finders.forEach((f, k) => {
          const t0 = now();
          grids[k].sync();
          if (f instanceof HpaStar) f.flush();
          const dt = now() - t0;
          times[k].push(dt);
          if (k === 0) gridOnly.push(dt);
        });
      }
      log('');
      log('| Algorytm | aktualizacja po zmianie kafla: mediana / p95 [ms] |');
      log('|---|---|');
      finders.forEach((f, k) => log(`| ${f.name} | ${f2(pct(times[k], 0.5))} / ${f2(pct(times[k], 0.95))} |`));
      log(`\n(${changes.length} zmian: kopanie przy pustkach i zasypywanie; A* = sam NavGrid: mediana ${f2(pct(gridOnly, 0.5))} ms)`);
      finders.forEach((f) => f.dispose());
    }
    if (process.env.NAV_BENCH_OUT) writeFileSync(process.env.NAV_BENCH_OUT, lines.join('\n') + '\n');
  });
});

describe('navigation benchmark harness', () => {
  it('is skipped unless NAV_BENCH=1 (smoke: query sets are deterministic)', () => {
    const sc = arenaScenario();
    const g = buildGrid(sc);
    const cells = standableCells(g);
    const a = makeQueries(g, cells, 20, 'x');
    const b = makeQueries(g, cells, 20, 'x');
    expect(a).toEqual(b);
    expect(a.local.length).toBe(20);
  });
});
