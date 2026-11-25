/**
 * Colour-science helpers for checking the material palette without rendering:
 * an estimate of each material's mean perceived colour (pattern coverage of the
 * accent, glow), CIELAB distances and a deuteranopia simulation. Used by
 * tests/palette.test.ts as a guard rail; the tournament itself measures renders.
 */
import { FORM, GEM, type MatLook, PAT } from './palette';

export type Vec3 = [number, number, number];

export function hexToLinear(hex: number): Vec3 {
  const c = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return [c[0]!, c[1]!, c[2]!];
}

const mix = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/**
 * Mean linear colour of a material under neutral unit light, estimated from its
 * pattern: the share of the surface covered by the accent (veins, grains,
 * shards...), the darkening of mortar and cracks, and a little of the glow.
 */
export function meanColor(l: MatLook): Vec3 {
  const a = hexToLinear(l.a);
  const b = hexToLinear(l.b);
  const acc = hexToLinear(l.accent);
  let base = mix(a, b, 0.5);
  let cover = 0; // accent share
  let accK = 1; // accent brightness factor within its area
  let emiCover = 0;
  let dark = 1;
  const am = l.amount;
  switch (l.pattern) {
    case PAT.SOIL:
    case PAT.SAND:
      cover = am * 0.04;
      accK = 0.575;
      break;
    case PAT.STRATA:
      cover = am * 0.25;
      dark = 0.93;
      break;
    case PAT.SPECKLE:
      cover = am * 0.225;
      dark = 0.935;
      break;
    case PAT.ORE: {
      const p = 0.3 + 0.55 * am; // share of cells holding a grain
      const fleck = 0.013 * am;
      cover =
        l.form === FORM.CUBIC ? 0.16 * p + fleck
        : l.form === FORM.NEEDLES ? 0.08 * p + fleck
        : l.form === FORM.DENDRITE ? 0.06 + fleck
        : l.form === FORM.BOTRYOIDAL ? Math.min(0.8, 0.4 * p) + fleck
        : l.form === FORM.SEAM ? Math.min(0.9, 2 * (0.08 + 0.26 * am))
        : l.form === FORM.DUST ? 0.045 * (0.25 + 0.6 * am)
        : 0.21 * p + fleck;
      emiCover = cover;
      break;
    }
    case PAT.CRYSTAL: {
      const p = Math.min(1, am + 0.1);
      cover =
        l.form === GEM.DRUSE ? 0.45 * Math.min(1, am + 0.2)
        : l.form === GEM.PRISMS ? 0.35 * p
        : l.form === GEM.HEX ? 0.23 * p
        : 0.5 * p;
      accK = 0.6;
      emiCover = cover * 0.6;
      break;
    }
    case PAT.MAGMA:
      cover = 0.12;
      accK = 0.25;
      emiCover = 0.12 * 0.8;
      break;
    case PAT.BRICK:
      dark = 0.91;
      emiCover = am * 0.02;
      break;
    case PAT.MYCELIUM:
      cover = am * 0.036;
      emiCover = am * 0.036;
      break;
    case PAT.BEDROCK:
      cover = 0.03;
      break;
    case PAT.FOSSIL:
      cover = am * 0.13;
      dark = 0.95;
      break;
    case PAT.RUNES:
      cover = am * 0.12;
      accK = 0.3;
      emiCover = am * 0.12;
      break;
    default:
      break;
  }
  base = scale(base, dark);
  let c = mix(base, scale(acc, accK), cover);
  c = add(c, scale(acc, l.emissive * emiCover * 0.15));
  return c;
}

const DEUT = [
  [0.367322, 0.860646, -0.227968],
  [0.280085, 0.672501, 0.047413],
  [-0.01182, 0.04294, 0.968881],
] as const;

export function deuteranopia(c: Vec3): Vec3 {
  const r = DEUT.map((row) => Math.min(1, Math.max(0, row[0] * c[0] + row[1] * c[1] + row[2] * c[2])));
  return [r[0]!, r[1]!, r[2]!];
}

export function linearToLab(c: Vec3): Vec3 {
  const cl = c.map((v) => Math.min(1, Math.max(0, v)));
  const x = (0.4124 * cl[0]! + 0.3576 * cl[1]! + 0.1805 * cl[2]!) / 0.95047;
  const y = 0.2126 * cl[0]! + 0.7152 * cl[1]! + 0.0722 * cl[2]!;
  const z = (0.0193 * cl[0]! + 0.1192 * cl[1]! + 0.9505 * cl[2]!) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

export function deltaE(a: Vec3, b: Vec3): number {
  const la = linearToLab(a);
  const lb = linearToLab(b);
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
}
