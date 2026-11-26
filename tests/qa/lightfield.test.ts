/**
 * QA (F1-5): light field (src/world/lightfield.ts) - boundary values, emitters on the world
 * edges, decay characterisation and the E4 time budget (docs/QUALITY.md). Characterisation
 * tests pin the current algorithm (max-decay sweeps, DEFAULT_LIGHT); the E4 acceptance
 * thresholds that are not defined numerically yet are listed as it.todo.
 */
import { describe, expect, it } from 'vitest';
import { buildArena } from '../../src/lab/arena';
import { buildGallery } from '../../src/lab/gallery';
import { DEFAULT_LIGHT, LIGHT_MAX, LightField } from '../../src/world/lightfield';
import { M } from '../../src/world/materials';
import { CAV, PROP, TF, World, type Prop } from '../../src/world/world';

function slab(w: number, h: number, m: number = M.GRANITE): World {
  const wd = new World(w, h, 1);
  for (let i = 0; i < wd.size; i++) {
    wd.mat[i] = wd.bg[i] = m;
    wd.cav[i] = CAV.SOLID;
    wd.flags[i] = TF.EXPLORED;
  }
  return wd;
}
const open = (w: World, x: number, y: number) => {
  const i = w.idx(x, y);
  w.mat[i] = M.AIR;
  w.cav[i] = CAV.DUG;
  w.depth[i] = 32;
};
const torch = (x: number, y: number, attach: Prop['attach'] = 'wall'): Prop => ({ type: PROP.TORCH, x, y, z: -0.9, scale: 1, rot: 0, attach, anchor: 0, seed: 1 });
const TORCH_R = 2.6; // PROP_GLOW[TORCH][0]

function tunnel(): { w: World; lf: LightField } {
  const w = slab(60, 9);
  for (let x = 1; x < 59; x++) open(w, x, 4);
  w.props = [torch(2.5, -4.3)];
  const lf = new LightField(w.w, w.h);
  lf.compute(w);
  return { w, lf };
}

describe('light field: torch in a tunnel (E4 characterisation)', () => {
  const { w, lf } = tunnel();
  const r = (x: number, y: number) => lf.r[w.idx(x, y)]!;

  it('decays by decayAir per tile along the tunnel and stays monotonic', () => {
    for (let d = 1; d <= 12; d++) {
      expect(r(2 + d, 4)).toBeCloseTo(TORCH_R * DEFAULT_LIGHT.decayAir ** d, 4);
      expect(r(2 + d, 4)).toBeLessThan(r(1 + d, 4));
    }
    // ~10 tiles: about a tenth of the source is left (E4: "oświetla tunel ~10 kafli")
    expect(r(12, 4) / TORCH_R).toBeGreaterThan(0.1);
    expect(r(12, 4) / TORCH_R).toBeLessThan(0.12);
  });

  it('decays by decaySolid per tile into rock', () => {
    for (let k = 1; k <= 4; k++) expect(r(2, 4 - k)).toBeCloseTo(TORCH_R * DEFAULT_LIGHT.decaySolid ** k, 4);
  });

  it.todo('E4: "nie przebija się przez >2 kafle skały" needs a numeric threshold - today 3 tiles of rock still carry 12.5% of the source (0.325 of 2.6); see docs/qa/TEST-PLAN.md M1-L3');
  it.todo('E4: isotropy - in an open room the light at (7,7) is 0.41 of the light at (10,0) (L1 "diamond" falloff of the separable sweeps); threshold to be set by the lighting tournament (A7)');
});

describe('light field: boundary values', () => {
  it('handles emitters on every edge and corner without NaN', () => {
    const w = slab(8, 8);
    for (let i = 0; i < w.size; i++) {
      w.mat[i] = M.AIR;
      w.cav[i] = CAV.NATURAL;
    }
    w.props = [torch(0, -0.5), torch(7.999, -7.5), torch(3.5, 0, 'floor'), torch(3.5, -8, 'ceiling'), torch(0.2, -7.9)];
    const lf = new LightField(8, 8);
    lf.compute(w);
    for (const a of [lf.r, lf.g, lf.b, lf.sky]) expect(Array.from(a).some((v) => !Number.isFinite(v))).toBe(false);
    expect(lf.r[0]).toBeCloseTo(TORCH_R, 5);
    expect(lf.r[63]).toBeCloseTo(TORCH_R, 5);
    expect(lf.r[56]).toBeCloseTo(TORCH_R, 5);
    // corner tile, red channel: floor(sqrt(2.6 / 4) * 255)
    expect(lf.packed[0]).toBe(205);
  });

  it('ignores props outside the grid (x = w, negative x, row above the top)', () => {
    const w = slab(6, 6);
    for (let i = 0; i < w.size; i++) w.mat[i] = M.AIR;
    w.props = [torch(6, -3.5), torch(-0.01, -3.5), torch(3.5, 0.5)];
    const lf = new LightField(6, 6);
    lf.compute(w);
    expect(Math.max(...lf.r)).toBe(0);
  });

  it('keeps props in unexplored tiles dark and glowing rock in unexplored tiles at 15%', () => {
    const w = slab(5, 5);
    for (let i = 0; i < w.size; i++) w.flags[i] = 0;
    w.mat[w.idx(1, 1)] = M.FROST_CRYSTAL;
    w.mat[w.idx(3, 3)] = M.AIR;
    w.props = [torch(3.5, -3.3)];
    const lf = new LightField(5, 5);
    lf.compute(w);
    // the torch would give 2.6; what is left is the faint, propagated crystal hint
    expect(lf.r[w.idx(3, 3)]).toBeLessThan(0.01);
    expect(lf.b[w.idx(1, 1)]).toBeCloseTo(0.7 * 0.15, 5);
  });

  it('packs block light as sqrt(L / LIGHT_MAX) and saturates at 255 above LIGHT_MAX', () => {
    const w = slab(3, 3);
    w.mat[w.idx(1, 1)] = M.AIR;
    w.props = [torch(1.5, -1.3)];
    const lf = new LightField(3, 3);
    lf.compute(w);
    const o = w.idx(1, 1) * 4;
    expect(lf.packed[o]).toBe(Math.floor(Math.sqrt(Math.min(1, TORCH_R / LIGHT_MAX)) * 255));
    // a lava tile far brighter than LIGHT_MAX must clamp, not wrap around (Uint8 modulo)
    const hot = slab(3, 3);
    const c = hot.idx(1, 1);
    hot.mat[c] = M.AIR;
    hot.fluid[c] = 255;
    hot.fluidKind[c] = 2;
    const lh = new LightField(3, 3, { ...DEFAULT_LIGHT, lava: [40, 40, 40] });
    lh.compute(hot);
    expect([lh.packed[c * 4], lh.packed[c * 4 + 1], lh.packed[c * 4 + 2]]).toEqual([255, 255, 255]);
  });

  it('gives open columns full sky light down to the first solid tile, which gets decaySolid', () => {
    const w = slab(3, 8);
    for (let y = 0; y < 5; y++) w.mat[w.idx(1, y)] = M.AIR;
    const lf = new LightField(3, 8);
    lf.compute(w);
    for (let y = 0; y < 5; y++) expect(lf.sky[w.idx(1, y)]).toBe(1);
    expect(lf.sky[w.idx(1, 5)]).toBeCloseTo(DEFAULT_LIGHT.decaySolid, 5);
  });

  it('is deterministic and repeatable (compute twice -> identical buffers)', () => {
    const { world } = buildArena();
    const a = new LightField(world.w, world.h);
    a.compute(world);
    const first = Array.from(a.packed);
    a.compute(world);
    expect(Array.from(a.packed)).toEqual(first);
  });

  it('works on the material gallery (every biome emitter) without NaN', () => {
    const { world } = buildGallery();
    const lf = new LightField(world.w, world.h);
    lf.compute(world);
    expect(Array.from(lf.r).some((v) => !Number.isFinite(v))).toBe(false);
  });
});

describe('light field: E4 time budget', () => {
  it('recomputes a full 224 x 720 world (B1 size) in < 50 ms (best of 3)', () => {
    const w = new World(224, 720, 1);
    for (let i = 0; i < w.size; i++) {
      w.mat[i] = i % 7 === 0 ? M.AIR : M.GRANITE;
      w.flags[i] = TF.EXPLORED;
    }
    const lf = new LightField(w.w, w.h);
    let best = Infinity;
    for (let k = 0; k < 3; k++) {
      lf.compute(w);
      best = Math.min(best, lf.lastMs);
    }
    expect(best).toBeLessThan(50);
  });
  it.todo('E4: local update < 5 ms - LightField has no incremental update yet (full recompute only)');
});
