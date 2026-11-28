/**
 * Spec factory (owner: W1): seed + role + social state -> DwarfSpec with a deterministic palette.
 * Rules (brief §2, concept card §3–§4, ART-BIBLE §4.3):
 *  - garments from ROLE_DIRECTION: tunic hue ±4°, C* <= 26, L* 30–48 (checked after 8-bit quantisation);
 *  - beard from BEARD_COLORS with ΔL* >= 15 to the tunic (deterministic re-draw in a seeded order);
 *  - skin SKIN_BASE ±8 L*; accent = the social state's colour; fixed materials from FIXED_COLORS.
 */
import { hash2, Rng } from '../../../core/rng';
import { BEARD_COLORS, FIXED_COLORS, ROLE_DIRECTION, SKIN_BASE, SOCIAL_ACCENT, VALUE_BANDS } from '../direction';
import type { DwarfPalette, DwarfSpec, MakeSpec, Proportions, RoleId, SocialId } from '../types';
import { hexToLch, hueDelta, lchToHex, lightness } from './color';

/** Seeded generator of one dwarf (independent streams per role so a seed reads as "the same person"). */
export function specRng(seed: number, role: number, salt = 0): Rng {
  return new Rng(hash2(seed | 0, role * 31 + salt, 0x0d3a7f));
}

const GARMENT_C_MAX = VALUE_BANDS.garmentMaxC - 0.4;
const GARMENT_L_MIN = VALUE_BANDS.tunicL[0] + 0.4;
const GARMENT_L_MAX = VALUE_BANDS.tunicL[1] - 0.4;

/** Is a garment colour inside the bands of the bible (after quantisation)? */
export function garmentOk(hex: number, base: number, maxHue: number): boolean {
  const c = hexToLch(hex);
  const b = hexToLch(base);
  if (c.L < VALUE_BANDS.tunicL[0] || c.L > VALUE_BANDS.tunicL[1]) return false;
  if (c.C > VALUE_BANDS.garmentMaxC) return false;
  // hue is meaningless for near-greys (8-bit rounding swings it by tens of degrees)
  if (b.C >= 6 && Math.abs(hueDelta(c.h, b.h)) > maxHue + 0.6) return false;
  return true;
}

/** A garment variant: hue ±dh°, lightness ±dl, chroma clamped; falls back to the base colour. */
function garment(base: number, rng: Rng, dh: number, dl: number): number {
  const b = hexToLch(base);
  for (let tries = 0; tries < 6; tries++) {
    const L = Math.min(GARMENT_L_MAX, Math.max(GARMENT_L_MIN, b.L + rng.range(-dl, dl)));
    const C = Math.min(GARMENT_C_MAX, b.C * rng.range(0.9, 1.06));
    const h = b.h + rng.range(-dh, dh);
    const hex = lchToHex({ L, C, h });
    if (garmentOk(hex, base, dh)) return hex;
  }
  return base;
}

/** Beard: first colour of a seeded order with ΔL* >= 15 to the tunic (+ small L jitter that keeps the rule). */
export function pickBeard(tunic: number, rng: Rng): number {
  const order = rng.shuffle(BEARD_COLORS.map((_, i) => i));
  const lt = lightness(tunic);
  const min = VALUE_BANDS.beardMinDeltaL;
  let best = BEARD_COLORS[order[0]!]!;
  let bestD = -1;
  for (const i of order) {
    const c = BEARD_COLORS[i]!;
    const d = Math.abs(lightness(c) - lt);
    if (d >= min) {
      const lch = hexToLch(c);
      const j = lchToHex({ ...lch, L: lch.L + rng.range(-2, 2) });
      return Math.abs(lightness(j) - lt) >= min ? j : c;
    }
    if (d > bestD) {
      bestD = d;
      best = c;
    }
  }
  return best; // unreachable for the shipped palettes (the contract test guarantees a contrasting beard)
}

export function makePalette(seed: number, role: RoleId, social: SocialId): DwarfPalette {
  const dir = ROLE_DIRECTION[role]!;
  const rng = specRng(seed, role, 1);
  const tunic = garment(dir.tunic, rng, 4, 3);
  const tunic2 = garment(dir.tunic2, rng, 4, 2.5);
  const cloth = garment(dir.cloth, rng, 3, 2);
  const beard = pickBeard(tunic, rng);
  const skinL = hexToLch(SKIN_BASE);
  const skin = lchToHex({ ...skinL, L: skinL.L + rng.range(-8, 8) });
  return {
    tunic,
    tunic2,
    beard,
    skin,
    cloth,
    accent: SOCIAL_ACCENT[social],
    leather: FIXED_COLORS.leather,
    boot: FIXED_COLORS.boot,
    iron: FIXED_COLORS.iron,
    wood: FIXED_COLORS.wood,
    lamp: FIXED_COLORS.lampFlame,
  };
}

export const makeSpec: MakeSpec = (seed: number, role: RoleId, social: SocialId, proportions: Proportions): DwarfSpec => {
  const rng = specRng(seed, role, 2);
  return {
    seed: seed | 0,
    role,
    social,
    proportions: { ...proportions },
    palette: makePalette(seed, role, social),
    braids: ROLE_DIRECTION[role]!.braids,
    beardShape: rng.next(),
  };
};
