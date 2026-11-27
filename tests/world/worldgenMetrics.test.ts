/**
 * Acceptance metrics of the world generator 2.0 (src/world/worldgenMetrics.ts) on hand-built worlds: each
 * metric catches what it must catch, the spec's analytic roof check agrees with the discrete structure model
 * on rasterized cave forms, and navigation goes through the game's NavGrid + HPA*.
 */
import { describe, expect, it } from 'vitest';
import { BIOMES } from '../../src/content/biomes';
import { BANDS, START, WORLD_FRAME, type CaveForm } from '../../src/content/worldgen';
import { INFRA, NAV } from '../../src/sim/nav';
import { M, MAT_BY_KEY } from '../../src/world/materials';
import { CAV, FLUID, World } from '../../src/world/world';
import {
  depositCensus, depositCoverage, depositDensities, evaluateWorld, fluidCheck, gateIntegrity, gorgeAccess, navStats,
  NO_BIOME, placementCheck, roofCheck, startCheck, voidShares, worldHash, type WorldgenLayout, type WorldgenResult,
} from '../../src/world/worldgenMetrics';
import { formRoof } from '../../src/world/worldgenRules';

const PLAIN = WORLD_FRAME.plainRow;
const K = new Map(BIOMES.map((b, k) => [b.id, k]));

const emptyLayout = (): WorldgenLayout => ({
  wagon: { x: 20, y: PLAIN - 1 }, hubs: [], windows: [], seals: [], landmarks: [], hazardCores: [], motherLodes: [],
  lairs: [], spawns: [], objects: [], scripted: [],
});

/** Sky above the plain, soil (Foothills) 20 rows, then the given rock as the Ledges, a granite band at depth 100. */
function layered(w: number, h: number, ledges: number = M.LIMESTONE): WorldgenResult {
  const world = new World(w, h, 1);
  const biome = new Uint8Array(w * h).fill(NO_BIOME);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const d = y - PLAIN;
      if (d < 0) {
        world.mat[i] = M.AIR;
        world.cav[i] = CAV.SKY;
        continue;
      }
      world.mat[i] = d < 20 ? M.SOIL : d < 100 ? ledges : M.GRANITE;
      world.cav[i] = CAV.SOLID;
      biome[i] = d < 20 ? K.get('foothills')! : d < 100 ? K.get('limestone')! : K.get('granite')!;
    }
  world.surface.fill(PLAIN);
  return { world, biome, layout: emptyLayout(), infra: new Uint8Array(w * h) };
}

/** Open a rectangle as a void of the given cavity kind (inclusive). */
function carve(r: WorldgenResult, x0: number, y0: number, x1: number, y1: number, cav: number = CAV.NATURAL): void {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const i = r.world.idx(x, y);
      r.world.mat[i] = M.AIR;
      r.world.cav[i] = cav;
    }
}

function put(r: WorldgenResult, m: number, cells: readonly (readonly [number, number])[]): void {
  for (const [x, y] of cells) r.world.mat[r.world.idx(x, y)] = m;
}

const block = (x0: number, y0: number, wd: number, ht: number): [number, number][] => {
  const out: [number, number][] = [];
  for (let y = y0; y < y0 + ht; y++) for (let x = x0; x < x0 + wd; x++) out.push([x, y]);
  return out;
};

/** Rasterize the largest instance of a cave form (a chain uses one vault) into a world of its roof rock. */
function rasterForm(rock: number, f: CaveForm): World {
  const W = (f.vaultW ? f.vaultW[1] : f.w[1]) + 8;
  const H = f.h[0] + 8;
  const world = new World(W, H, 1);
  world.mat.fill(rock);
  const w = f.vaultW ? f.vaultW[1] : f.w[1];
  const h = f.h[0];
  const floor = H - 4; // last open row
  for (let i = 0; i < w; i++) {
    const t = (i + 0.5 - w / 2) / (w / 2);
    const colH = f.roof === 'vault' ? Math.max(1, Math.round(h * Math.sqrt(Math.max(0, 1 - t * t)))) : h;
    for (let y = floor - colH + 1; y <= floor; y++) {
      const c = y * W + 4 + i;
      world.mat[c] = M.AIR;
      world.cav[c] = CAV.NATURAL;
    }
  }
  if (f.squeezeEvery) {
    // alternate a crawl pinch (upper row closed) and a floor bump (lower row closed)
    for (let i = f.squeezeEvery, k = 0; i < w; i += f.squeezeEvery, k++) world.mat[(floor - (k % 2 === 0 ? 1 : 0)) * W + 4 + i] = rock;
  }
  return world;
}

describe('deposits: census, coverage, densities', () => {
  it('counts tiles and veins per biome and reports missing deposit-biome pairs', () => {
    const r = layered(64, 160);
    put(r, M.COPPER, block(10, PLAIN + 5, 4, 3)); // 12-tile vein in the Foothills
    put(r, M.CLAY, block(30, PLAIN + 2, 5, 3));
    put(r, M.COPPER, [[50, PLAIN + 30]]); // a lone tile in the Ledges: below the minimum vein
    const c = depositCensus(r.world, r.biome);
    const f = K.get('foothills')!;
    expect(c.tiles.get('copper_vein')![f]).toBe(12);
    expect(c.veins.get('copper_vein')![f]).toBe(1);
    expect(c.largest.get('copper_vein')![f]).toBe(12);
    expect(c.veins.get('copper_vein')![K.get('limestone')!]).toBe(0);
    expect(c.solid[f]).toBe(64 * 20);
    const cov = depositCoverage(c);
    expect(cov.missing).not.toContain('copper_vein@foothills');
    expect(cov.missing).toContain('copper_vein@limestone');
    expect(cov.missing).toContain('tin_vein@limestone');
    expect(cov.ratio).toBeGreaterThan(0);
    const row = depositDensities(c).find((d) => d.biome === 'foothills' && d.deposit === 'copper_vein')!;
    expect(row.actual).toBeCloseTo((1000 * 12) / (64 * 20), 6);
    expect(row.ok).toBe(false); // 9.4 per mille vs target 16
  });

  it('measures the void share of a biome (sky excluded)', () => {
    const r = layered(64, 160);
    carve(r, 0, PLAIN + 30, 63, PLAIN + 37); // 8 rows of the 80-row Ledges: 10%
    const v = voidShares(r.world, r.biome).find((x) => x.biome === 'limestone')!;
    expect(v.share).toBeCloseTo(0.1, 6);
    expect(v.ok).toBe(true);
    expect(voidShares(r.world, r.biome).find((x) => x.biome === 'foothills')!.share).toBe(0);
  });
});

describe('roofs: the structure model at generation time', () => {
  it('holds a natural limestone room 14 wide and fails it at 16; a dug room fails above 6, a dug drift above 12', () => {
    const r = layered(64, 160);
    carve(r, 4, PLAIN + 30, 17, PLAIN + 33); // natural 14 x 4
    expect(roofCheck(r.world).failures).toBe(0);
    carve(r, 30, PLAIN + 30, 45, PLAIN + 33); // natural 16 x 4
    expect(roofCheck(r.world).failures).toBeGreaterThan(0);
    const d = layered(64, 160);
    carve(d, 4, PLAIN + 30, 9, PLAIN + 33, CAV.DUG); // dug 6 x 4 holds
    carve(d, 20, PLAIN + 30, 31, PLAIN + 31, CAV.DUG); // dug drift 12 x 2 holds (low roof x2)
    expect(roofCheck(d.world).failures).toBe(0);
    carve(d, 40, PLAIN + 30, 47, PLAIN + 33, CAV.DUG); // dug 8 x 4 fails
    expect(roofCheck(d.world).first.some((f) => f.x >= 40 && f.x <= 47)).toBe(true);
  });

  it('agrees with the analytic check of the spec on every cave form of every biome (rasterized at its largest)', () => {
    const disagree: string[] = [];
    for (const band of BANDS)
      for (const f of band.caves.forms) {
        const rock = MAT_BY_KEY.get(f.roofRock ?? band.roofRock)!.id;
        const holds = roofCheck(rasterForm(rock, f)).failures === 0;
        if (holds !== formRoof(band, f).ok || !holds) disagree.push(`${band.biome}.${f.kind}: raster ${holds}, analytic ${formRoof(band, f).ok}`);
      }
    expect(disagree).toEqual([]);
  });
});

describe('fluids', () => {
  it('flags fluid in rock, floating water and lava touching water', () => {
    const r = layered(32, 120);
    carve(r, 2, PLAIN + 30, 12, PLAIN + 35);
    const w = r.world;
    w.fluid[w.idx(3, PLAIN + 35)] = 255; // on the floor: fine
    w.fluidKind[w.idx(3, PLAIN + 35)] = FLUID.WATER;
    expect(fluidCheck(w)).toEqual({ inSolid: 0, floating: 0, lavaWater: 0 });
    w.fluid[w.idx(6, PLAIN + 31)] = 200; // in mid-air
    w.fluidKind[w.idx(6, PLAIN + 31)] = FLUID.WATER;
    w.fluid[w.idx(20, PLAIN + 31)] = 100; // inside rock
    w.fluidKind[w.idx(20, PLAIN + 31)] = FLUID.WATER;
    w.fluid[w.idx(4, PLAIN + 35)] = 255;
    w.fluidKind[w.idx(4, PLAIN + 35)] = FLUID.LAVA;
    expect(fluidCheck(w)).toEqual({ inSolid: 1, floating: 1, lavaWater: 1 });
  });
});

describe('navigation: hub -> Gorge window with NavGrid + HPA*', () => {
  /** Ledges hub on the left, a gallery to the window plug on the right with a 3-row step down on the way. */
  function road(): WorldgenResult {
    const r = layered(64, 160);
    const y = PLAIN + 30; // floor row (solid) of the upper gallery
    carve(r, 2, y - 3, 30, y - 1); // hub cave and gallery, 3 tall
    carve(r, 31, y - 3, 48, y + 2); // the gallery drops 3 rows at x = 31
    r.layout = {
      ...emptyLayout(),
      hubs: [{ biome: 'limestone', landmark: 'first_ledge_hall', x: 4, y: y - 1 }],
      windows: [{ biome: 'limestone', side: 'W', plug: { x0: 49, y0: y - 1, x1: 50, y1: y + 2 } }],
    };
    return r;
  }

  it('finds the way down with one one-way drop, and the way back once a ladder is built', () => {
    const r = road();
    const [row] = gorgeAccess(r);
    expect(row!.status).toBe(NAV.FOUND);
    expect(row!.oneWayDrops).toBe(1);
    expect(row!.back).toBe(false);
    const y = PLAIN + 30;
    for (let yy = y - 3; yy <= y + 2; yy++) r.infra[r.world.idx(31, yy)] = INFRA.LADDER;
    const [again] = gorgeAccess(r);
    expect(again!.status).toBe(NAV.FOUND);
    expect(again!.back).toBe(true);
  });

  it('refuses a drop taller than the safe drop (4 rows) without a ladder', () => {
    const r = road();
    carve(r, 31, PLAIN + 33, 48, PLAIN + 33); // deepen the lower gallery: the step becomes 4 rows
    r.layout = { ...r.layout, windows: [{ biome: 'limestone', side: 'W', plug: { x0: 49, y0: PLAIN + 30, x1: 50, y1: PLAIN + 33 } }] };
    expect(gorgeAccess(r)[0]!.status).toBe(NAV.NO_PATH);
  });

  it('counts the standable cells of the navigation graph', () => {
    const r = layered(64, 160);
    expect(navStats(r).nodes).toBe(64); // the surface row only
    r.infra[r.world.idx(5, PLAIN - 2)] = INFRA.PLATFORM;
    expect(navStats(r).infraTiles).toBe(1);
  });
});

describe('hard gates and placement', () => {
  it('detects a natural opening that lets a flint pick reach the core of a deeper biome', () => {
    const r = layered(64, 160);
    expect(gateIntegrity(r).every((g) => g.leaked === 0)).toBe(true);
    carve(r, 40, PLAIN + 10, 41, PLAIN + 60); // a soil-to-limestone chimney past the cap
    const lime = gateIntegrity(r).find((g) => g.biome === 'limestone')!;
    expect(lime.tier).toBe(1);
    expect(lime.leaked).toBeGreaterThan(0);
  });

  it('flags a mother lode outside hazard zones, a spawn at the hub and a breakable seal', () => {
    const r = layered(64, 160);
    r.layout = {
      ...emptyLayout(),
      hubs: [{ biome: 'limestone', landmark: 'first_ledge_hall', x: 10, y: PLAIN + 29 }],
      hazardCores: [{ hazard: 'cave_ins', biome: 'limestone', x: 50, y: PLAIN + 60, r: 8 }],
      motherLodes: [{ deposit: 'copper_vein', biome: 'limestone', x: 55, y: PLAIN + 40, tiles: 40 }],
      spawns: [{ creature: 'rock_rat', x: 12, y: PLAIN + 29 }],
      seals: [{ id: 'seal_first', rect: { x0: 30, y0: PLAIN + 50, x1: 33, y1: PLAIN + 52 } }],
    };
    const msgs = placementCheck(r);
    expect(msgs.some((m) => m.startsWith('mother lode copper_vein@limestone outside'))).toBe(true);
    expect(msgs.some((m) => m.startsWith('spawn rock_rat inside the safe radius'))).toBe(true);
    expect(msgs.some((m) => m.startsWith('seal seal_first: breakable'))).toBe(true);
  });
});

describe('start and tutorial', () => {
  function startWorld(): WorldgenResult {
    const r = layered(160, 200);
    const y0 = PLAIN;
    put(r, M.COPPER, block(60, y0 + 1, 6, 2)); // outcrop: 12 tiles right under the surface
    put(r, M.CLAY, block(34, y0 + 3, 4, 3));
    put(r, M.COAL, block(70, y0 + 22, 10, 1));
    put(r, M.SHELL_LIMESTONE, block(80, y0 + 24, 10, 1));
    const [hw, hh] = START.tutorialHall.size;
    carve(r, 100, y0 + START.tutorialHall.floorDepth - hh, 100 + hw - 1, y0 + START.tutorialHall.floorDepth - 1);
    r.layout = {
      ...emptyLayout(),
      landmarks: [{ id: 'first_ledge_hall', rect: { x0: 100, y0: y0 + START.tutorialHall.floorDepth - hh, x1: 100 + hw - 1, y1: y0 + START.tutorialHall.floorDepth - 1 } }],
      objects: [
        ...[42, 46, 50, 54, 58, 62].map((x) => ({ id: 'pine_tree', x, y: y0 - 1 })),
        { id: 'berry_bush', x: 10, y: y0 - 1 }, { id: 'berry_bush', x: 36, y: y0 - 1 },
        { id: 'wild_barley', x: 8, y: y0 - 1 }, { id: 'wild_barley', x: 40, y: y0 - 1 },
      ],
    };
    return r;
  }

  it('passes a camp that follows the start rules', () => {
    expect(startCheck(startWorld())).toEqual([]);
  });

  it('flags a cave under the camp, a bumpy pad and a missing resource', () => {
    const r = startWorld();
    carve(r, 20, PLAIN + 10, 22, PLAIN + 12);
    r.world.surface[16] = PLAIN - 1;
    r.layout = { ...r.layout, objects: r.layout.objects.filter((o) => o.id !== 'berry_bush') };
    const msgs = startCheck(r);
    expect(msgs.some((m) => m.startsWith('camp zone: open tile (20'))).toBe(true);
    expect(msgs.some((m) => m.startsWith('pad: column 16'))).toBe(true);
    expect(msgs.some((m) => m.startsWith('reach: berry_bush 0 < 2'))).toBe(true);
  });
});

describe('determinism and the full report', () => {
  it('hashes equal worlds equally and any tile change differently', () => {
    const a = layered(64, 160);
    const b = layered(64, 160);
    expect(worldHash(a.world)).toBe(worldHash(b.world));
    b.world.mat[b.world.idx(5, PLAIN + 5)] = M.CLAY;
    expect(worldHash(b.world)).not.toBe(worldHash(a.world));
  });

  it('evaluates a full-size 224 x 736 world in well under a second and fails a world that is only layers', () => {
    const r = layered(WORLD_FRAME.w, WORLD_FRAME.h);
    const t0 = performance.now();
    const rep = evaluateWorld(r);
    const ms = performance.now() - t0;
    expect(rep.pass).toBe(false);
    expect(rep.coverage.ratio).toBe(0);
    expect(rep.roofs.failures).toBe(0);
    expect(ms).toBeLessThan(1500);
  });
});
