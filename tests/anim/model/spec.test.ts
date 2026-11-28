// W1 model: the spec factory and its palette rules (brief §2, concept card §3–§4, ART-BIBLE §4.3).
import { describe, expect, it } from 'vitest';
import { BEARD_COLORS, FIXED_COLORS, PROPORTION_PRESETS, ROLE_DIRECTION, SKIN_BASE, SOCIAL_ACCENT, VALUE_BANDS } from '../../../src/render/characters/direction';
import { canonicalSpec, makeSpec } from '../../../src/render/characters/model/index';
import { chroma, hexToLch, hueDelta, lightness } from '../../../src/render/characters/model/color';
import { ROLE_IDS, SOCIAL } from '../../../src/render/characters/types';

const ROLES = [0, 1, 2, 3] as const;
const SEEDS = Array.from({ length: 200 }, (_, i) => i * 7919 + 13);

describe('makeSpec: palette rules on 200 seeds × 4 roles', () => {
  it('beard contrasts with the tunic by >= 15 L*', () => {
    let worst = Infinity;
    for (const role of ROLES)
      for (const seed of SEEDS) {
        const s = makeSpec(seed, role, SOCIAL.FREE_MINER, PROPORTION_PRESETS.A);
        const d = Math.abs(lightness(s.palette.beard) - lightness(s.palette.tunic));
        worst = Math.min(worst, d);
      }
    expect(worst).toBeGreaterThanOrEqual(VALUE_BANDS.beardMinDeltaL);
  });

  it('garments stay in the bands: L* 30–48, C* <= 26, tunic hue within ±4° of the role colour', () => {
    for (const role of ROLES)
      for (const seed of SEEDS) {
        const p = makeSpec(seed, role, SOCIAL.MASTER, PROPORTION_PRESETS.A).palette;
        for (const g of [p.tunic, p.tunic2, p.cloth]) {
          expect(lightness(g)).toBeGreaterThanOrEqual(VALUE_BANDS.tunicL[0]);
          expect(lightness(g)).toBeLessThanOrEqual(VALUE_BANDS.tunicL[1]);
          expect(chroma(g)).toBeLessThanOrEqual(VALUE_BANDS.garmentMaxC);
        }
        const base = hexToLch(ROLE_DIRECTION[role]!.tunic);
        if (base.C >= 6) expect(Math.abs(hueDelta(hexToLch(p.tunic).h, base.h))).toBeLessThanOrEqual(4.6);
      }
  });

  it('skin is the base ±8 L*, beard from the card palette (±2 L*), accent = social state, fixed materials', () => {
    const lb = lightness(SKIN_BASE);
    for (const seed of SEEDS.slice(0, 50)) {
      for (const social of [0, 1, 2, 3] as const) {
        const s = makeSpec(seed, 0, social, PROPORTION_PRESETS.A);
        expect(Math.abs(lightness(s.palette.skin) - lb)).toBeLessThanOrEqual(8.6);
        expect(BEARD_COLORS.some((b) => Math.abs(lightness(b) - lightness(s.palette.beard)) <= 2.6 && Math.abs(hueDelta(hexToLch(b).h, hexToLch(s.palette.beard).h)) < 8)).toBe(true);
        expect(s.palette.accent).toBe(SOCIAL_ACCENT[social]);
        expect(s.palette.lamp).toBe(FIXED_COLORS.lampFlame);
        expect(s.palette.boot).toBe(FIXED_COLORS.boot);
      }
    }
  });

  it('is deterministic, varies with the seed, braids from the role, beardShape in 0..1', () => {
    for (const role of ROLES) {
      const a = makeSpec(42, role, 0, PROPORTION_PRESETS.A);
      const b = makeSpec(42, role, 0, PROPORTION_PRESETS.A);
      expect(b).toEqual(a);
      expect(a.braids).toBe(ROLE_DIRECTION[role]!.braids);
      expect(a.beardShape).toBeGreaterThanOrEqual(0);
      expect(a.beardShape).toBeLessThan(1);
      const distinct = new Set(SEEDS.slice(0, 40).map((s) => JSON.stringify(makeSpec(s, role, 0, PROPORTION_PRESETS.A).palette)));
      expect(distinct.size).toBeGreaterThan(30);
    }
    expect(ROLE_IDS.length).toBe(4);
  });

  it('canonical crowd spec: neutral beard shape, same palette rules', () => {
    const c = canonicalSpec(2, PROPORTION_PRESETS.B);
    expect(c.beardShape).toBe(0.5);
    expect(c.proportions).toEqual(PROPORTION_PRESETS.B);
    expect(Math.abs(lightness(c.palette.beard) - lightness(c.palette.tunic))).toBeGreaterThanOrEqual(15);
  });
});
