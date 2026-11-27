/**
 * QA (F1-5): specification vs data vs code - owner ranges (CLAUDE.md), world size vs biome
 * depths (docs/narrative/05-level-systems.md), one source of truth for rock hardness, and
 * invariants of the lab test worlds (arena over many seeds, gallery). Known discrepancies are
 * it.fails with BUG ids (docs/qa/bugs/).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { BIOMES } from '../../src/content/biomes';
import { RESOURCES } from '../../src/content/resources';
import { buildArena } from '../../src/lab/arena';
import { buildGallery, GALLERY_H, GALLERY_W, SH, SW } from '../../src/lab/gallery';
import { GALLERY_SCENARIOS, SCENARIOS } from '../../src/lab/scenarios';
import { MAT_BY_KEY, SOLID } from '../../src/world/materials';
import { PROP, TF } from '../../src/world/world';

describe('owner requirements vs data', () => {
  it.fails('BUG-008: crafted materials stay within the owner range 60-80 (data: 81; tests/content allows 85)', () => {
    const n = RESOURCES.filter((r) => r.kind === 'material').length;
    expect(n).toBeGreaterThanOrEqual(60);
    expect(n).toBeLessThanOrEqual(80);
  });
});

describe('world size vs the biome bible', () => {
  it('has contiguous, non-overlapping biome depth bands starting at the surface', () => {
    expect(BIOMES[0]!.depth[0]).toBe(0);
    BIOMES.forEach((b, k) => {
      expect(b.tier).toBe(k);
      expect(b.depth[1]).toBeGreaterThan(b.depth[0]);
      if (k > 0) expect(b.depth[0]).toBe(BIOMES[k - 1]!.depth[1]);
    });
  });

  it('BUG-006 (fixed): CONFIG.worldH holds the mountain (40 tiles) plus every biome (680 tiles deep)', () => {
    const deepest = Math.max(...BIOMES.map((b) => b.depth[1]));
    expect(CONFIG.worldH).toBeGreaterThanOrEqual(deepest + 40);
    // chunks (render, dirty tracking) and navigation clusters (16) divide both axes: no partial edge chunk
    expect(CONFIG.worldW % CONFIG.chunk).toBe(0);
    expect(CONFIG.worldH % CONFIG.chunk).toBe(0);
    expect(CONFIG.worldH % 16).toBe(0);
  });
});

describe('one source of truth: rock hardness', () => {
  it.fails('BUG-010: the balance model digs each biome with the hardness of its main rock from materials.ts', () => {
    // src/balance/model.ts keeps its own private table; read it from the source (no export)
    const src = readFileSync(new URL('../../src/balance/model.ts', import.meta.url), 'utf8');
    const table = src.match(/const ROCK_HARDNESS = \[([^\]]+)\]/)![1]!.split(',').map(Number);
    const diffs = BIOMES.map((b) => ({ b: b.id, model: table[b.tier]!, world: MAT_BY_KEY.get(b.rocks[0]!)!.hardness })).filter((x) => x.model !== x.world);
    expect(diffs).toEqual([]);
  });
});

describe('lab worlds: arena over many seeds', () => {
  it('keeps mannequins on floors, torches in open tiles, fluids out of rock and the fog region hidden (seeds 1-40)', () => {
    for (let s = 1; s <= 40; s++) {
      const { world: w, unexplored: u } = buildArena(s);
      for (const q of w.mannequins) {
        expect(w.isSolid(Math.floor(q.x), -q.y), `seed ${s} floor`).toBe(true);
        expect(w.isSolid(Math.floor(q.x), -q.y - 1), `seed ${s} body`).toBe(false);
      }
      for (const p of w.props) if (p.type === PROP.TORCH) expect(SOLID[w.mat[p.anchor]!], `seed ${s} torch`).toBe(0);
      for (let i = 0; i < w.size; i++) if (w.fluid[i]) expect(SOLID[w.mat[i]!], `seed ${s} fluid ${i}`).toBe(0);
      expect(w.flags[w.idx(u.x0, u.y0)]! & TF.EXPLORED, `seed ${s} fog`).toBe(0);
    }
  });

  it('is reproducible per seed and different across seeds', () => {
    const a = buildArena(3).world.mat;
    expect(Array.from(buildArena(3).world.mat)).toEqual(Array.from(a));
    expect(Array.from(buildArena(4).world.mat)).not.toEqual(Array.from(a));
  });

  it('frames every scenario inside its world with a time of day in [0, 1)', () => {
    const { world: a } = buildArena();
    for (const s of SCENARIOS) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(a.w);
      expect(-s.y).toBeLessThanOrEqual(a.h);
      expect(s.t >= 0 && s.t < 1).toBe(true);
    }
    for (const s of GALLERY_SCENARIOS) expect(s.x <= GALLERY_W && -s.y <= GALLERY_H).toBe(true);
    expect(new Set([...SCENARIOS, ...GALLERY_SCENARIOS].map((s) => s.id)).size).toBe(SCENARIOS.length + GALLERY_SCENARIOS.length);
  });
});

describe('lab worlds: material gallery', () => {
  const g = buildGallery();
  it('places non-overlapping swatches inside the wall, each deposit vein >= 20 tiles, torches in open notches', () => {
    const used = new Set<number>();
    for (const s of g.swatches) {
      expect(s.x >= 0 && s.y >= 0 && s.x + SW <= GALLERY_W && s.y + SH <= GALLERY_H).toBe(true);
      let vein = 0;
      for (let y = s.y; y < s.y + SH; y++)
        for (let x = s.x; x < s.x + SW; x++) {
          const i = g.world.idx(x, y);
          expect(used.has(i)).toBe(false);
          used.add(i);
          if (g.world.mat[i] === s.mat) vein++;
        }
      if (s.kind === 'deposit') expect(vein, `${s.biome} ${s.mat}`).toBeGreaterThanOrEqual(20);
    }
    for (const p of g.world.props) if (p.type === PROP.TORCH) expect(SOLID[g.world.mat[p.anchor]!]).toBe(0);
  });

  it('keeps headroom in the 9-swatch blocks (limestone is full: one more deposit breaks the gallery)', () => {
    const per = new Map<string, number>();
    for (const s of g.swatches) per.set(s.biome, (per.get(s.biome) ?? 0) + 1);
    for (const [b, n] of per) expect(n, b).toBeLessThanOrEqual(9);
    expect(per.get('limestone')).toBe(9); // documents the full block (risk for M2 content growth)
  });
});
