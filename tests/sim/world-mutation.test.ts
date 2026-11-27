/**
 * F2-3 stage 1: consistent tile state (BUG-003 beyond the QA repro), the single mutation path
 * (events, tags, refusals), dirty chunks per consumer channel and world save/load.
 */
import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import { CAUSE, type SimEvents } from '../../src/sim/events';
import { DIRTY, DirtyMap } from '../../src/sim/world/dirty';
import { TAG, WorldMutator } from '../../src/sim/world/mutate';
import { hashWorld, loadWorld, rleDecode, rleEncode, saveWorld } from '../../src/sim/world/snapshot';
import { M, SOLID } from '../../src/world/materials';
import { CAV, FLUID, PROP, type Prop, TF, World } from '../../src/world/world';
import { carve, record, slab } from './helpers';

const prop = (type: number, x: number, y: number, attach: Prop['attach'], anchor: number): Prop => ({ type, x, y, z: -0.5, scale: 1, rot: 0, attach, anchor, seed: 1 });

/** Every tile is either solid (cav SOLID, depth 0, no fluid) or open (cav != SOLID). */
function consistent(w: World): number {
  let bad = 0;
  for (let i = 0; i < w.size; i++) {
    const solid = SOLID[w.mat[i]!] === 1;
    if (solid && (w.cav[i] !== CAV.SOLID || w.fluid[i] || w.fluidKind[i])) bad++;
    if (!solid && w.cav[i] === CAV.SOLID) bad++;
    if ((w.fluid[i] === 0) !== (w.fluidKind[i] === FLUID.NONE)) bad++;
  }
  return bad;
}

describe('World.fill / dig keep tiles consistent (BUG-003)', () => {
  it('filling lava and digging it again leaves a dry natural cave with its depth', () => {
    const w = carve(slab(5, 5, M.BASALT), 1, 1, 3, 3, CAV.NATURAL);
    const i = w.idx(2, 3);
    w.depth[i] = 77;
    w.setFluid(2, 3, FLUID.LAVA, 255);
    expect(w.fill(2, 3, M.STONE_BRICK)).toBe(true);
    expect([w.cav[i], w.depth[i], w.fluid[i], w.fluidKind[i]]).toEqual([CAV.SOLID, 0, 0, FLUID.NONE]);
    expect(w.dig(2, 3)).toBe(M.STONE_BRICK);
    expect([w.cav[i], w.depth[i], w.fluid[i], w.fluidKind[i], w.bg[i]]).toEqual([CAV.NATURAL, 77, 0, FLUID.NONE, M.BASALT]);
    expect(consistent(w)).toBe(0);
  });

  it('a wall built in the sky and removed gives back open sky (depth 255, no back wall)', () => {
    const w = slab(4, 6, M.SOIL, 3);
    const i = w.idx(1, 1);
    w.fill(1, 1, M.STONE_BRICK);
    w.dig(1, 1);
    expect([w.cav[i], w.depth[i], w.bg[i]]).toEqual([CAV.SKY, 255, M.AIR]);
  });

  it('virgin rock dug, filled and dug again is a plain dug tunnel', () => {
    const w = slab(3, 3, M.GRANITE);
    const i = w.idx(1, 1);
    w.dig(1, 1);
    w.fill(1, 1, M.STONE_BRICK);
    w.dig(1, 1);
    expect([w.cav[i], w.depth[i], w.baseCav[i]]).toEqual([CAV.DUG, 32, 0]);
  });

  it('refuses non-solid materials, solid tiles and out-of-bounds tiles without logging', () => {
    const w = slab(3, 3);
    w.dig(1, 1);
    const c = w.changeCount;
    expect(w.fill(1, 1, M.AIR)).toBe(false);
    expect(w.fill(0, 0, M.STONE_BRICK)).toBe(false); // already solid
    expect(w.fill(-1, 1, M.STONE_BRICK)).toBe(false);
    expect(w.changeCount).toBe(c);
    expect(consistent(w)).toBe(0);
  });

  it('fill removes props standing in the tile (stalagmite, grass) and those anchored to it', () => {
    const w = carve(slab(6, 6, M.LIMESTONE, 2), 1, 3, 4, 3);
    const floor = w.idx(2, 4);
    const stalagmite = prop(PROP.STALAGMITE, 2.5, -4, 'floor', floor); // stands in (2, 3), anchored below
    const grass = prop(PROP.GRASS, 4.4, -2, 'ground', w.idx(4, 2)); // grows in the sky tile (4, 1)
    const torch = prop(PROP.TORCH, 3.5, -3.5, 'wall', w.idx(3, 3)); // in (3, 3), untouched
    w.props = [stalagmite, grass, torch];
    w.fill(2, 3, M.STONE_BRICK);
    w.fill(4, 1, M.STONE_BRICK);
    expect(w.props).toEqual([torch]);
    expect(w.propVersion).toBe(2);
  });

  it('setFluid keeps amount and kind together and never wets solid rock', () => {
    const w = carve(slab(3, 3), 1, 1, 1, 1);
    const i = w.idx(1, 1);
    expect(w.setFluid(1, 1, FLUID.WATER, 0)).toBe(false); // already dry
    expect(w.setFluid(1, 1, FLUID.WATER, 300)).toBe(true);
    expect([w.fluid[i], w.fluidKind[i]]).toEqual([255, FLUID.WATER]);
    expect(w.setFluid(1, 1, FLUID.NONE, 200)).toBe(true);
    expect([w.fluid[i], w.fluidKind[i]]).toEqual([0, FLUID.NONE]);
    expect(w.setFluid(0, 0, FLUID.WATER, 10)).toBe(false);
    expect(w.setFluid(1, 1, 7, 10)).toBe(false); // unknown kind
    expect(w.fluidVersion).toBe(2);
  });
});

describe('WorldMutator: the single mutation path', () => {
  const setup = (w: World) => {
    const bus = new EventBus<SimEvents>();
    const rec = record(bus, ['tileChanged', 'tileRevealed', 'propsRemoved', 'fluidDisplaced', 'fluidChanged']);
    return { mut: new WorldMutator(w, bus), rec, bus };
  };

  it('emits exactly one tileChanged per dig and reveals only newly explored tiles', () => {
    const w = slab(4, 4);
    for (let i = 0; i < w.size; i++) w.flags[i] = 0;
    w.flags[w.idx(1, 0)] = TF.EXPLORED;
    const { mut, rec } = setup(w);
    expect(mut.dig(0, 0)).toBe(M.LIMESTONE);
    expect(rec.of('tileChanged')).toEqual([{ i: 0, x: 0, y: 0, before: M.LIMESTONE, after: M.AIR, cause: CAUSE.DIG }]);
    expect(rec.of('tileRevealed').map((e) => e.i).sort()).toEqual([0, 4, 5]);
    expect(mut.dig(0, 0)).toBe(M.AIR); // already open: no event
    expect(rec.of('tileChanged').length).toBe(1);
  });

  it('gates unbreakable rock (tier 9): refused for DIG, allowed for SCRIPT', () => {
    const w = slab(3, 3, M.BEDROCK);
    const { mut, rec } = setup(w);
    expect(mut.dig(1, 1)).toBe(M.AIR);
    expect(mut.stats.refused).toBe(1);
    expect(rec.log.length).toBe(0);
    expect(mut.dig(1, 1, CAUSE.SCRIPT)).toBe(M.BEDROCK);
  });

  it('place over water reports the displaced fluid and tags construction and rubble', () => {
    const w = carve(slab(5, 3), 1, 1, 3, 1);
    w.setFluid(2, 1, FLUID.WATER, 180);
    const { mut, rec } = setup(w);
    expect(mut.place(2, 1, M.STONE_BRICK, CAUSE.BUILD)).toBe(true);
    expect(rec.of('fluidDisplaced')).toEqual([{ i: w.idx(2, 1), x: 2, y: 1, kind: FLUID.WATER, amount: 180, cause: CAUSE.BUILD }]);
    expect(mut.tag[w.idx(2, 1)]).toBe(TAG.BUILT);
    expect(mut.place(1, 1, M.LIMESTONE, CAUSE.COLLAPSE)).toBe(true);
    expect(mut.tag[w.idx(1, 1)]).toBe(TAG.RUBBLE);
    mut.dig(1, 1);
    expect(mut.tag[w.idx(1, 1)]).toBe(0);
    expect(mut.place(0, 0, M.LIMESTONE)).toBe(false);
    expect(mut.place(3, 1, M.AIR)).toBe(false);
    expect(mut.stats.refused).toBe(2);
  });

  it('setFluid emits fluidChanged with the previous state; no event when nothing changes', () => {
    const w = carve(slab(3, 3), 1, 1, 1, 1);
    const { mut, rec } = setup(w);
    expect(mut.setFluid(1, 1, FLUID.LAVA, 90)).toBe(true);
    expect(mut.setFluid(1, 1, FLUID.LAVA, 90)).toBe(false);
    expect(rec.of('fluidChanged')).toEqual([{ i: 4, x: 1, y: 1, kind: FLUID.LAVA, amount: 90, prevKind: 0, prevAmount: 0, cause: CAUSE.FLUID }]);
  });

  it('reports props removed by a dig', () => {
    const w = slab(3, 3);
    w.props = [prop(PROP.TORCH, 1.5, -1.5, 'wall', w.idx(1, 1))];
    const { mut, rec } = setup(w);
    mut.dig(1, 1);
    expect(rec.of('propsRemoved')).toEqual([{ i: w.idx(1, 1), count: 1 }]);
  });
});

describe('dirty chunks per channel (E1)', () => {
  const chunksOf = (d: DirtyMap, ch: number) => {
    const out: string[] = [];
    d.take(ch, (cx, cy) => out.push(`${cx},${cy}`));
    return out.sort();
  };

  it('marks one chunk for an interior tile and every touching chunk on edges and corners', () => {
    const w = slab(96, 96);
    const mut = new WorldMutator(w, new EventBus<SimEvents>(), { lightRadius: 4 });
    mut.dig(10, 10);
    expect(chunksOf(mut.dirty, DIRTY.MESH)).toEqual(['0,0']);
    expect(chunksOf(mut.dirty, DIRTY.MESH)).toEqual([]); // taken
    mut.dig(31, 10);
    expect(chunksOf(mut.dirty, DIRTY.MESH)).toEqual(['0,0', '1,0']);
    mut.dig(32, 32);
    expect(chunksOf(mut.dirty, DIRTY.NAV)).toEqual(['0,0', '0,1', '1,0', '1,1']);
    // light reaches further: x 28 +- 4 crosses into chunk 0 from 1, the earlier digs left LIGHT dirty too
    expect(chunksOf(mut.dirty, DIRTY.LIGHT)).toEqual(['0,0', '0,1', '1,0', '1,1']);
    expect(mut.dirty.count(DIRTY.FOG)).toBeGreaterThan(0);
  });

  it('clamps at the world border and keeps a chunk re-marked inside take() for the next take', () => {
    const d = new DirtyMap(40, 40, { chunk: 32 });
    d.markTile(0, 0, DIRTY.MESH);
    d.markTile(39, 39, DIRTY.MESH);
    expect(d.count(DIRTY.MESH)).toBe(2);
    let again = true;
    const n = d.take(DIRTY.MESH, (cx, cy) => {
      if (again) d.markRect(cx * 32, cy * 32, cx * 32, cy * 32, DIRTY.MESH);
      again = false;
    });
    expect(n).toBe(2);
    expect(d.count(DIRTY.MESH)).toBe(1);
    expect(() => d.count(3)).toThrow();
  });
});

describe('world save / load (E1, E20)', () => {
  it('round-trips a world after a fill/dig sequence identically through JSON', () => {
    const w = carve(slab(20, 12, M.GRANITE, 3), 2, 5, 12, 7, CAV.NATURAL);
    w.setFluid(4, 7, FLUID.WATER, 200);
    w.fill(4, 7, M.STONE_BRICK);
    w.fill(6, 1, M.STONE_BRICK);
    w.dig(15, 9);
    w.props = [prop(PROP.TORCH, 8.5, -6.5, 'wall', w.idx(8, 5))];
    const back = loadWorld(JSON.parse(JSON.stringify(saveWorld(w))));
    expect(hashWorld(back)).toBe(hashWorld(w));
    for (const k of ['mat', 'bg', 'cav', 'depth', 'fluid', 'fluidKind', 'flags', 'baseCav', 'baseDepth', 'surface'] as const) expect(back[k]).toEqual(w[k]);
    expect(back.props).toEqual(w.props);
    // the reloaded wall still knows it stood in a natural cave
    back.dig(4, 7);
    expect(back.cav[back.idx(4, 7)]).toBe(CAV.NATURAL);
  });

  it('RLE rejects runs that do not cover the array', () => {
    expect(rleEncode([1, 1, 1, 0, 2, 2])).toEqual([1, 3, 0, 1, 2, 2]);
    expect(() => rleDecode([1, 3], new Uint8Array(4))).toThrow();
    expect(() => rleDecode([1, 5], new Uint8Array(4))).toThrow();
    expect(() => rleDecode([1, 0, 1, 4], new Uint8Array(4))).toThrow();
  });
});
