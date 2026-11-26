/**
 * QA (F1-5): edge cases of the world grid (src/world/world.ts) - bounds, the mutation paths
 * dig/fill/reveal, the change ring and prop anchoring. The sim does not exist yet; these tests
 * pin down the contract the sim (M3) will build on. Known defects are `it.fails` with a BUG id
 * (docs/qa/bugs/), so a fix flips them and Vitest asks for the marker to be removed.
 */
import { describe, expect, it } from 'vitest';
import { buildArena } from '../../src/lab/arena';
import { M, SOLID } from '../../src/world/materials';
import { CAV, FLUID, PROP, TF, World } from '../../src/world/world';

/** w x h world of explored granite. */
function slab(w: number, h: number, m: number = M.GRANITE): World {
  const wd = new World(w, h, 1);
  for (let i = 0; i < wd.size; i++) {
    wd.mat[i] = wd.bg[i] = m;
    wd.cav[i] = CAV.SOLID;
  }
  return wd;
}

describe('world: bounds', () => {
  it('treats everything left, right and below the grid as solid and the sky above as open', () => {
    const w = slab(4, 4);
    expect(w.isSolid(-1, 0)).toBe(true);
    expect(w.isSolid(4, 0)).toBe(true);
    expect(w.isSolid(0, 4)).toBe(true);
    expect(w.isSolid(0, -1)).toBe(false);
    expect(w.isSolid(-1, -1)).toBe(false);
    expect(w.isExplored(-1, 0)).toBe(false);
  });

  it('ignores digs, fills and reveals outside the grid without logging a change', () => {
    const w = slab(4, 4);
    expect(w.dig(-1, 0)).toBe(M.AIR);
    expect(w.dig(0, 4)).toBe(M.AIR);
    w.fill(4, 0, M.GRANITE);
    expect(w.reveal(-1, -1)).toBe(false);
    expect(w.changeCount).toBe(0);
    expect(w.terrainVersion).toBe(0);
  });

  it('digs corner tiles and reveals only the in-bounds part of the 3x3 neighbourhood', () => {
    const w = slab(4, 4);
    expect(w.dig(0, 0)).toBe(M.GRANITE);
    expect(w.cav[w.idx(0, 0)]).toBe(CAV.DUG);
    const revealed = [0, 1, 4, 5].map((i) => (w.flags[i]! & TF.EXPLORED) !== 0);
    expect(revealed).toEqual([true, true, true, true]);
    expect(w.flags.filter((f) => f & TF.EXPLORED).length).toBe(4);
    // one log entry for the dug tile + one per newly revealed tile
    expect(w.changeCount).toBe(1 + 4);
  });
});

describe('world: dig and reveal', () => {
  it('returns AIR and changes nothing when the tile is already open', () => {
    const w = slab(3, 3);
    w.dig(1, 1);
    const v = w.terrainVersion;
    const c = w.changeCount;
    expect(w.dig(1, 1)).toBe(M.AIR);
    expect(w.terrainVersion).toBe(v);
    expect(w.changeCount).toBe(c);
  });

  it('keeps the cavity kind and depth of natural caves when a neighbour is dug', () => {
    const w = slab(3, 3);
    const i = w.idx(1, 1);
    w.mat[i] = M.AIR;
    w.cav[i] = CAV.NATURAL;
    w.depth[i] = 80;
    w.dig(2, 1);
    expect(w.cav[i]).toBe(CAV.NATURAL);
    expect(w.depth[i]).toBe(80);
    expect(w.cav[w.idx(2, 1)]).toBe(CAV.DUG);
    expect(w.depth[w.idx(2, 1)]).toBe(32);
  });

  it('has no pick-tier gate in the raw API: World.dig removes bedrock too (the sim must gate tier 9)', () => {
    // The pick-tier gate (bedrock tier 9, Prakowali stone of the Gardziel) belongs to the sim (M3).
    const w = slab(3, 3, M.BEDROCK);
    expect(w.dig(1, 1)).toBe(M.BEDROCK);
  });

  it('reveal is idempotent and bumps fogVersion once per tile', () => {
    const w = slab(3, 3);
    expect(w.reveal(1, 1)).toBe(true);
    expect(w.reveal(1, 1)).toBe(false);
    expect(w.fogVersion).toBe(1);
  });

  it('removes exactly the props anchored to a dug tile', () => {
    const w = slab(3, 3);
    const mk = (anchor: number) => ({ type: PROP.TORCH, x: 1.5, y: -1.5, z: -0.9, scale: 1, rot: 0, attach: 'wall' as const, anchor, seed: 1 });
    w.props = [mk(w.idx(1, 1)), mk(w.idx(1, 2)), mk(w.idx(1, 1))];
    w.dig(1, 1);
    expect(w.props.map((p) => p.anchor)).toEqual([w.idx(1, 2)]);
    expect(w.propVersion).toBe(1);
  });
});

describe('world: change ring', () => {
  it('replays changes since a counter and reports an overflow beyond 16384 entries', () => {
    const w = slab(200, 100);
    const start = w.changeCount;
    w.dig(5, 5);
    const seen: number[] = [];
    expect(w.changesSince(start, (i) => seen.push(i))).toBe(true);
    expect(seen).toContain(w.idx(5, 5));
    // flood the ring: 200 x 100 digs log far more than 16384 entries
    for (let y = 0; y < 100; y++) for (let x = 0; x < 200; x++) w.dig(x, y);
    expect(w.changesSince(start, () => {})).toBe(false);
    expect(w.changesSince(w.changeCount, () => {})).toBe(true);
  });
});

describe('world: fill (construction) keeps the grid consistent', () => {
  it.fails('BUG-003: fill() over water clears the fluid kind, not only the fluid amount', () => {
    const { world: w } = buildArena();
    let wi = -1;
    for (let i = 0; i < w.size; i++) if (w.fluidKind[i] === FLUID.WATER && w.fluid[i]) wi = i;
    const x = wi % w.w;
    const y = Math.floor(wi / w.w);
    w.fill(x, y, M.STONE_BRICK);
    w.dig(x, y);
    // a dug, dry tile must not keep a "water" kind (WorldTex and lab probes read fluidKind)
    expect(w.fluid[wi]).toBe(0);
    expect(w.fluidKind[wi]).toBe(FLUID.NONE);
  });

  it.fails('BUG-003: building and then removing a block in the open sky gives the sky back', () => {
    const { world: w } = buildArena();
    const i = w.idx(2, 2);
    expect(w.cav[i]).toBe(CAV.SKY);
    w.fill(2, 2, M.STONE_BRICK);
    w.dig(2, 2);
    // expected: open sky again, not a dug tunnel tile with a back wall floating above the meadow
    expect(w.cav[i]).toBe(CAV.SKY);
  });

  it.fails('BUG-003: fill() with a non-solid material does not leave a "solid cavity" tile', () => {
    const w = slab(3, 3);
    const i = w.idx(1, 1);
    w.dig(1, 1);
    w.fill(1, 1, M.AIR);
    // either fill(AIR) is refused or the tile is a consistent open tile
    expect(SOLID[w.mat[i]!] === 1 || w.cav[i] !== CAV.SOLID).toBe(true);
  });
});
