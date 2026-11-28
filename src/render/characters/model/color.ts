/**
 * Colour math for the dwarf model (owner: W1). sRGB hex <-> linear RGB <-> CIE XYZ (D65) <-> L*a*b* <-> LCh.
 * Pure functions, no three.js dependency (the spec factory and the tests use them in Node).
 */

export interface Lab {
  L: number;
  a: number;
  b: number;
}

export interface LCh {
  L: number;
  C: number;
  /** Hue in degrees 0..360. */
  h: number;
}

/** sRGB channel 0..1 -> linear 0..1. */
export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Linear channel 0..1 -> sRGB 0..1. */
export function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/** Hex 0xRRGGBB -> linear RGB triple. */
export function hexToLinear(hex: number, out: number[] = [0, 0, 0], o = 0): number[] {
  out[o] = srgbToLinear(((hex >> 16) & 255) / 255);
  out[o + 1] = srgbToLinear(((hex >> 8) & 255) / 255);
  out[o + 2] = srgbToLinear((hex & 255) / 255);
  return out;
}

const XN = 0.95047;
const YN = 1.0;
const ZN = 1.08883;
const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
const fInv = (t: number) => (t * t * t > 216 / 24389 ? t * t * t : (116 * t - 16) / (24389 / 27));

export function hexToLab(hex: number): Lab {
  const [r, g, b] = hexToLinear(hex) as [number, number, number];
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / XN;
  const y = (0.2126729 * r + 0.7151522 * g + 0.072175 * b) / YN;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / ZN;
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** L*a*b* -> hex (channels clamped to gamut). */
export function labToHex(lab: Lab): number {
  const fy = (lab.L + 16) / 116;
  const fx = fy + lab.a / 500;
  const fz = fy - lab.b / 200;
  const x = fInv(fx) * XN;
  const y = fInv(fy) * YN;
  const z = fInv(fz) * ZN;
  const r = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  const g = -0.969266 * x + 1.8760108 * y + 0.041556 * z;
  const b = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z;
  const to8 = (c: number) => Math.max(0, Math.min(255, Math.round(linearToSrgb(Math.max(0, Math.min(1, c))) * 255)));
  return (to8(r) << 16) | (to8(g) << 8) | to8(b);
}

export function labToLch(lab: Lab): LCh {
  const h = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  return { L: lab.L, C: Math.hypot(lab.a, lab.b), h: h < 0 ? h + 360 : h };
}

export function lchToLab(c: LCh): Lab {
  const r = (c.h * Math.PI) / 180;
  return { L: c.L, a: c.C * Math.cos(r), b: c.C * Math.sin(r) };
}

export const hexToLch = (hex: number): LCh => labToLch(hexToLab(hex));
export const lchToHex = (c: LCh): number => labToHex(lchToLab(c));

/** CIE L* of a hex colour. */
export const lightness = (hex: number): number => hexToLab(hex).L;
/** CIE C*ab of a hex colour. */
export const chroma = (hex: number): number => hexToLch(hex).C;

/** Signed hue difference a - b in degrees (-180..180). */
export function hueDelta(a: number, b: number): number {
  let d = a - b;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}
