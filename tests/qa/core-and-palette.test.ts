/**
 * QA (F1-5): core libraries at their edges (EventBus re-entrancy and errors, noise range,
 * weighted pick on empty tables) and the strength of the palette guard (tests/palette.test.ts):
 * which mutations of the look table its checks catch. Known defects: BUG-007 (BUG-009 fixed).
 */
import { describe, expect, it } from 'vitest';
import { BIOMES } from '../../src/content/biomes';
import { DEPOSITS } from '../../src/content/sources';
import { EventBus } from '../../src/core/events';
import { Noise2D } from '../../src/core/noise';
import { Rng } from '../../src/core/rng';
import { LOOK, type MatLook } from '../../src/render/palette';
import { deltaE, deuteranopia, meanColor } from '../../src/render/paletteCheck';
import { biomeMaterials, MATERIALS } from '../../src/world/materials';

describe('EventBus edges (BUG-009)', () => {
  it('BUG-009 (fixed): one throwing subscriber does not starve the others', () => {
    const bus = new EventBus<{ dug: number }>();
    let second = 0;
    bus.on('dug', () => {
      throw new Error('audio failed');
    });
    bus.on('dug', () => second++);
    try {
      bus.emit('dug', 1);
    } catch {
      /* the bus may rethrow after delivering */
    }
    expect(second).toBe(1);
  });

  it('BUG-009 (fixed): a subscriber added during emit does not receive the event in flight', () => {
    const bus = new EventBus<{ dug: number }>();
    let late = 0;
    bus.on('dug', () => {
      bus.on('dug', () => late++);
    });
    bus.emit('dug', 1);
    expect(late).toBe(0);
  });
});

describe('core helpers at their edges', () => {
  it('keeps simplex noise inside [-1, 1] (200k samples)', () => {
    const n = new Noise2D(5);
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < 200_000; i++) {
      const v = n.simplex((i * 0.0173) % 997, (i * 0.0311) % 991);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    expect(lo).toBeGreaterThanOrEqual(-1);
    expect(hi).toBeLessThanOrEqual(1);
  });

  it('throws on a weighted pick from an empty table - and the Heart biome has an empty deposit table', () => {
    // contract for the world generator 2.0 (M2): guard empty tables before rng.weighted()
    expect(() => new Rng(1).weighted([])).toThrow();
    expect(DEPOSITS.filter((d) => d.biomes.includes('heart'))).toEqual([]);
  });
});

describe('palette guard strength (mutation test of the mean-colour checks)', () => {
  const key = (id: number) => MATERIALS[id]!.key;
  const pairs = BIOMES.flatMap((b) => {
    const { rocks, deposits } = biomeMaterials(b.id);
    const all = [...new Set([...rocks, ...deposits])];
    return all.flatMap((a, i) => all.slice(i + 1).map((c) => [a, c] as const));
  });
  /** Same rules as tests/palette.test.ts: ΔE >= 12 (normal), >= 7 (deuteranopia), placeholder look. */
  const caught = (L: readonly MatLook[]) =>
    MATERIALS.some((m) => m.solid && L[m.id]!.a === 0x777777 && L[m.id]!.b === 0x999999) ||
    pairs.some(([a, b]) => deltaE(meanColor(L[a]!), meanColor(L[b]!)) < 12 || deltaE(deuteranopia(meanColor(L[a]!)), deuteranopia(meanColor(L[b]!))) < 7);

  it('passes on the current palette', () => expect(caught(LOOK)).toBe(false));

  it('catches every copy of a biome neighbour look and every placeholder look', () => {
    for (const [a, b] of pairs) {
      const L = LOOK.map((l) => ({ ...l }));
      L[b] = { ...L[a]! };
      expect(caught(L), `${key(a)} -> ${key(b)}`).toBe(true);
    }
    for (const m of MATERIALS.filter((x) => x.solid)) {
      const L = LOOK.map((l) => ({ ...l }));
      L[m.id] = { ...L[m.id]!, a: 0x777777, b: 0x999999 };
      expect(caught(L), m.key).toBe(true);
    }
  });

  it('is blind by design to sheen, glint, spec, bump, scale and variation (render-only parameters)', () => {
    const L = LOOK.map((l) => ({ ...l, sheen: 0, glint: 0, spec: 0, bump: 0, scale: 5, variation: 0 }));
    expect(caught(L)).toBe(false);
  });

  it.todo('BUG-007: render-based palette regression - pairs confused in renders (galena-quartz deut ΔE 3.0, tin-limestone 5.3, obsidian-basalt 6.0) pass the mean-colour proxy with ΔE 46.4 / 24.2 / 17.3');
});
