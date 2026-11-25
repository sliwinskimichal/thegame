import { describe, expect, it } from 'vitest';
import { LightField } from '../src/world/lighting';
import { M } from '../src/world/materials';
import { TF, World } from '../src/world/world';
import { generateWorld } from '../src/world/worldgen';

function solidWorld(w: number, h: number): World {
  const world = new World(w, h, 1);
  world.mat.fill(M.GRANITE);
  world.bg.fill(M.GRANITE);
  return world;
}

describe('LightField', () => {
  it('spreads torch light along a tunnel but not through rock', () => {
    const world = solidWorld(40, 20);
    for (let x = 5; x < 35; x++) world.dig(x, 10);
    const lf = new LightField(40, 20);
    lf.compute(world, [{ x: 10, y: 10, r: 1, g: 0.6, b: 0.3 }]);
    const at = (x: number, y: number) => lf.r[y * 40 + x]!;
    expect(at(10, 10)).toBeCloseTo(1);
    expect(at(14, 10)).toBeGreaterThan(0.35); // 4 tiles down the tunnel
    expect(at(10, 14)).toBeLessThan(0.1); // 4 tiles into granite
    // at equal distance, open air carries light far better than rock
    expect(at(14, 10) / at(10, 14)).toBeGreaterThan(5);
  });

  it('lets daylight fall down an open shaft', () => {
    const world = solidWorld(20, 30);
    for (let y = 0; y < 5; y++)
      for (let x = 0; x < 20; x++) {
        const i = world.idx(x, y);
        world.mat[i] = M.AIR;
        world.flags[i] = TF.OUTDOOR;
      }
    for (let y = 5; y < 25; y++) world.dig(10, y);
    const lf = new LightField(20, 30);
    lf.compute(world, []);
    expect(lf.sky[world.idx(10, 24)]).toBeCloseTo(1);
    expect(lf.sky[world.idx(4, 20)]).toBeLessThan(0.02); // 6 tiles of rock
  });

  it('computes a full world quickly', () => {
    const { world } = generateWorld({ seed: 7 });
    const lf = new LightField(world.w, world.h);
    lf.compute(world, []);
    lf.compute(world, []);
    expect(lf.lastMs).toBeLessThan(80);
  });
});
