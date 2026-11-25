import { describe, expect, it } from 'vitest';
import { generateWorld } from '../src/world/worldgen';
import { M } from '../src/world/materials';
import { TF } from '../src/world/world';

const same = (a: ArrayLike<number>, b: ArrayLike<number>) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

describe('worldgen', () => {
  const a = generateWorld({ seed: 12345 });

  it('is deterministic for a seed', () => {
    const b = generateWorld({ seed: 12345 });
    expect(same(a.world.mat, b.world.mat)).toBe(true);
    expect(same(a.world.fluid, b.world.fluid)).toBe(true);
    expect(a.world.decor.length).toBe(b.world.decor.length);
  });

  it('differs between seeds', () => {
    const c = generateWorld({ seed: 999 });
    expect(same(a.world.mat, c.world.mat)).toBe(false);
  });

  it('has open sky above the surface and solid ground at the spawn', () => {
    const w = a.world;
    expect(w.isSolid(w.spawnX, w.spawnY)).toBe(false);
    expect(w.isSolid(w.spawnX, w.spawnY + 1)).toBe(true);
    expect(w.flags[w.idx(w.spawnX, 0)]! & TF.OUTDOOR).toBeTruthy();
  });

  it('keeps the spawn area free of caves', () => {
    const w = a.world;
    for (let y = w.spawnY + 1; y < w.spawnY + 25; y++)
      for (let x = w.spawnX - 10; x <= w.spawnX + 10; x++) expect(w.isSolid(x, y)).toBe(true);
  });

  it('contains ores, caves, fluids and a bedrock floor', () => {
    const w = a.world;
    const counts = new Map<number, number>();
    let caves = 0;
    let fluids = 0;
    for (let i = 0; i < w.size; i++) {
      counts.set(w.mat[i]!, (counts.get(w.mat[i]!) ?? 0) + 1);
      if (w.flags[i]! & TF.NATURAL) caves++;
      if (w.fluid[i]) fluids++;
    }
    for (const m of [M.COAL, M.COPPER, M.IRON, M.SILVER, M.GOLD, M.CRYSTAL, M.EMBERITE, M.GLIMMERITE, M.MYCELIUM])
      expect(counts.get(m) ?? 0, `material ${m}`).toBeGreaterThan(10);
    expect(caves).toBeGreaterThan(w.size * 0.05);
    expect(fluids).toBeGreaterThan(100);
    for (let x = 0; x < w.w; x++) expect(w.mat[w.idx(x, w.h - 1)]).toBe(M.BEDROCK);
  });

  it('generates in reasonable time', () => {
    expect(a.ms).toBeLessThan(3000);
  });
});
