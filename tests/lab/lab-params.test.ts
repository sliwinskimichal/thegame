/**
 * Lab fixes (engine-graphics): BUG-001 (no silent fallback of style/scenario), BUG-002 (frame
 * statistics), D4 (`seed` for every lab world) and the tone scenes (F2-12) as data.
 */
import { describe, expect, it } from 'vitest';
import { summarizeFrames } from '../../src/lab/frametime';
import { parseLabParams } from '../../src/lab/params';
import { TONE_SCENARIOS } from '../../src/lab/scenarios';
import { buildToneScenes } from '../../src/lab/toneScenes';
import { M, SOLID } from '../../src/world/materials';
import { CAV, TF } from '../../src/world/world';

const STY = ['s01-diorama', 'r2b-silhouette-plus', 'i08-depth'];
const SC = { arena: ['overview', 'cave'], gallery: ['g_all'], tone: ['izba', 'przodek', 'zawal'] } as const;

describe('BUG-001: lab parameters are validated, never silently replaced', () => {
  it('accepts known ids and keeps the documented defaults when a parameter is absent', () => {
    expect(parseLabParams('?style=i08-depth&scenario=cave', STY, SC)).toMatchObject({ styleId: 'i08-depth', scenarioId: 'cave', world: 'arena', seed: null, errors: [] });
    expect(parseLabParams('', STY, SC)).toMatchObject({ styleId: 's01-diorama', scenarioId: null, errors: [] });
  });
  it('reports an unknown style, scenario or world instead of falling back', () => {
    expect(parseLabParams('?style=__no_such_style__', STY, SC).errors.join()).toMatch(/nieznany styl/);
    expect(parseLabParams('?style=i08-depth&scenario=jaskinia', STY, SC).errors.join()).toMatch(/nieznany scenariusz/);
    expect(parseLabParams('?world=moon', STY, SC).errors.join()).toMatch(/nieznany świat/);
    // a scenario of another world is unknown in this one
    expect(parseLabParams('?world=tone&scenario=cave', STY, SC).errors).toHaveLength(1);
  });
});

describe('D4: seed parameter', () => {
  it('parses a non-negative integer seed and rejects anything else', () => {
    expect(parseLabParams('?world=gallery&seed=9', STY, SC)).toMatchObject({ world: 'gallery', seed: 9, errors: [] });
    expect(parseLabParams('?seed=-3', STY, SC).errors).toHaveLength(1);
    expect(parseLabParams('?seed=abc', STY, SC).errors).toHaveLength(1);
  });
});

describe('BUG-002: frame statistics', () => {
  it('summarises samples with min / p50 / p95 / mean and the method used', () => {
    const s = summarizeFrames([12, 10, 11, 40, 10, NaN, -1], 'gl.finish');
    expect(s).toMatchObject({ method: 'gl.finish', n: 5, min: 10, p50: 11 });
    expect(s.p95).toBe(40);
    expect(s.mean).toBeCloseTo(16.6, 5);
    expect(Number.isNaN(summarizeFrames([], 'timer-query').p50)).toBe(true);
  });
});

describe('F2-12: tone scenes', () => {
  it('has the three scenarios of CHARTER §4', () => {
    expect(TONE_SCENARIOS.map((s) => s.id)).toEqual(['izba', 'przodek', 'zawal']);
  });
  for (const seed of [1, 2]) {
    it(`seed ${seed}: built masonry meets natural rock, the face hides the unknown, dressing and dwarves are staged`, () => {
      const t = buildToneScenes(seed);
      const w = t.world;
      // dressed stone wall directly beside natural rock (izba)
      expect(w.mat[w.idx(3, 15)]).toBe(M.STONE_BRICK);
      expect([M.LIMESTONE, M.SANDSTONE]).toContain(w.mat[w.idx(2, 15)]);
      // part of the hall's back wall is masonry, the rest natural
      expect(w.bg[w.idx(8, 15)]).toBe(M.STONE_BRICK);
      expect(w.bg[w.idx(20, 15)]).not.toBe(M.STONE_BRICK);
      // przodek: the drift is explored, the rock beyond the face is not, and never leaks (bg != 0)
      expect(w.flags[w.idx(45, 15)]! & TF.EXPLORED).toBeTruthy();
      expect(w.flags[w.idx(50, 15)]! & TF.EXPLORED).toBe(0);
      for (let i = 0; i < w.size; i++) if (!(w.flags[i]! & TF.EXPLORED) && w.cav[i] !== CAV.SKY) expect(w.bg[i]).not.toBe(0);
      // an ore vein is half exposed in the face
      expect(w.mat[w.idx(46, 15)] === M.IRON || w.mat[w.idx(47, 15)] === M.IRON).toBe(true);
      // zawal: rubble blocks part of the drift
      expect(SOLID[w.mat[w.idx(64, 16)]!]).toBe(1);
      const kinds = new Set(t.dressing.map((d) => d.kind));
      for (const k of ['forge', 'anvil', 'table', 'bench', 'barrel', 'shelf', 'ladder', 'pipe', 'planks', 'support', 'brokenSupport', 'debris', 'dust', 'crack']) expect(kinds.has(k as never), k).toBe(true);
      const hall = w.mannequins.filter((m) => m.x < 30);
      expect(hall.length).toBeGreaterThanOrEqual(6);
      expect(w.mannequins.length).toBeLessThanOrEqual(12); // lab lanterns: MAX_DYN_LIGHTS
    });
  }
  it('the seed changes the natural rock, not the staging', () => {
    const a = buildToneScenes(1).world;
    const b = buildToneScenes(2).world;
    let diff = 0;
    for (let i = 0; i < a.size; i++) if (a.mat[i] !== b.mat[i]) diff++;
    expect(diff).toBeGreaterThan(0);
    expect(a.mat[a.idx(3, 15)]).toBe(b.mat[b.idx(3, 15)]);
  });
});
