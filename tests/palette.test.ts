import { describe, expect, it } from 'vitest';
import { BIOMES } from '../src/content/biomes';
import { DEPOSITS } from '../src/content/sources';
import { LOOK } from '../src/render/palette';
import { deltaE, deuteranopia, meanColor } from '../src/render/paletteCheck';
import { biomeMaterials, DEPOSIT_MAT, M, MAT_COUNT, MATERIALS } from '../src/world/materials';

const name = (id: number) => MATERIALS[id]!.key;

/** Every pair of materials that meet inside one biome. */
function biomePairs(): { biome: string; a: number; b: number }[] {
  const out: { biome: string; a: number; b: number }[] = [];
  for (const b of BIOMES) {
    const { rocks, deposits } = biomeMaterials(b.id);
    const all = [...new Set([...rocks, ...deposits])];
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) out.push({ biome: b.id, a: all[i]!, b: all[j]! });
  }
  return out;
}

describe('world materials and the content bible', () => {
  it('maps every deposit to exactly one material with matching hardness and pick tier', () => {
    for (const d of DEPOSITS) {
      const id = DEPOSIT_MAT.get(d.id);
      expect(id, d.id).toBeDefined();
      const m = MATERIALS[id!]!;
      expect(m.hardness).toBe(d.hardness);
      expect(m.tier).toBe(d.pickTier);
    }
    expect(MATERIALS.filter((m) => m.deposit).length).toBe(DEPOSITS.length);
  });

  it('gives every biome existing host rocks and keeps ids dense', () => {
    for (const b of BIOMES) expect(biomeMaterials(b.id).rocks.length, b.id).toBeGreaterThan(0);
    expect(MATERIALS.length).toBe(MAT_COUNT);
    MATERIALS.forEach((m, i) => expect(m.id).toBe(i));
  });
});

describe('material palette', () => {
  it('defines a look for every solid material', () => {
    for (const m of MATERIALS) {
      if (!m.solid) continue;
      const l = LOOK[m.id]!;
      expect(l.a === 0x777777 && l.b === 0x999999, `${m.key} has the placeholder look`).toBe(false);
    }
  });

  it('separates materials that meet in one biome (mean colour, normal vision)', () => {
    const weak = biomePairs()
      .map((p) => ({ ...p, d: deltaE(meanColor(LOOK[p.a]!), meanColor(LOOK[p.b]!)) }))
      .filter((p) => p.d < 12)
      .map((p) => `${p.biome}: ${name(p.a)}–${name(p.b)} ΔE ${p.d.toFixed(1)}`);
    expect(weak).toEqual([]);
  });

  it('keeps them apart under deuteranopia too', () => {
    const weak = biomePairs()
      .map((p) => ({ ...p, d: deltaE(deuteranopia(meanColor(LOOK[p.a]!)), deuteranopia(meanColor(LOOK[p.b]!))) }))
      .filter((p) => p.d < 7)
      .map((p) => `${p.biome}: ${name(p.a)}–${name(p.b)} ΔE ${p.d.toFixed(1)}`);
    expect(weak).toEqual([]);
  });

  it('keeps the dwarves’ stone wall distinct from every natural rock', () => {
    const wall = meanColor(LOOK[M.STONE_BRICK]!);
    const close = MATERIALS.filter((m) => m.solid && m.cls !== 'ore' && m.cls !== 'gem' && m.id !== M.STONE_BRICK)
      .map((m) => ({ k: m.key, d: deltaE(wall, meanColor(LOOK[m.id]!)) }))
      .filter((x) => x.d < 10)
      .map((x) => `${x.k} ΔE ${x.d.toFixed(1)}`);
    expect(close).toEqual([]);
  });
});
