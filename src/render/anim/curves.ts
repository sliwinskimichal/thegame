/**
 * Named timing curves of the dwarf motion (owner: W2). Every clip refers to these by name so the
 * phase breakdown in the report and the data in the clips stay the same thing.
 * All take t in [0, 1] and return [0, 1] (unless stated), with f(0) = 0 and f(1) = 1.
 */
export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Frac in [0, 1) (but 1 stays 1 so seam tests can sample the very end of a cycle). */
export const wrap01 = (p: number): number => (p >= 0 && p <= 1 ? p : p - Math.floor(p));
export const frac = (p: number): number => p - Math.floor(p);

/** Smoothstep: zero velocity at both ends (holds, settling). */
export const easeInOut = (t: number): number => {
  t = clamp01(t);
  return t * t * (3 - 2 * t);
};
/** Smootherstep: zero velocity and acceleration at both ends (long moves: windup). */
export const easeInOut5 = (t: number): number => {
  t = clamp01(t);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
/** Starts slow, accelerates (the strike: whip into the rock). */
export const strikeIn = (t: number): number => {
  t = clamp01(t);
  return t * t * t;
};
/** Fast start, soft landing (recoil, recovery, reach). */
export const easeOut = (t: number): number => {
  t = clamp01(t);
  const u = 1 - t;
  return 1 - u * u;
};
export const easeOut3 = (t: number): number => {
  t = clamp01(t);
  const u = 1 - t;
  return 1 - u * u * u;
};
export const easeIn = (t: number): number => {
  t = clamp01(t);
  return t * t;
};
/** Bump 0 -> 1 -> 0 with the peak at `peak` (swing-foot lift, notify flashes). */
export const bump = (t: number, peak = 0.5): number => {
  t = clamp01(t);
  const u = t < peak ? t / peak : (1 - t) / (1 - peak);
  return u * u * (3 - 2 * u);
};
/** Cubic Hermite between p0 and p1 with tangents m0, m1 (per unit t). */
export const hermite = (p0: number, m0: number, p1: number, m1: number, t: number): number => {
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * m1;
};
/** Local time of t inside the segment [a, b] (0 before, 1 after). */
export const seg = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a));
/** Smooth periodic noise from a few sines (deterministic idle fidgets), period 1 in p. */
export const wobble = (p: number, seed: number): number =>
  0.6 * Math.sin(Math.PI * 2 * (p + seed)) + 0.3 * Math.sin(Math.PI * 2 * (2 * p + seed * 1.7)) + 0.1 * Math.sin(Math.PI * 2 * (3 * p + seed * 2.3));
