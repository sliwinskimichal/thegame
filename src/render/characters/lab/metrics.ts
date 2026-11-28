/**
 * Image metrics of the dwarf tournament (owner: W3 "Technical artist", dwarf team). Pure functions on
 * RGBA8 images (top-down rows) and binary masks; no DOM, tested in Node (tests/anim/render/).
 *  - sRGB -> CIE L*a*b* (D65), chroma C*
 *  - figure / ground contrast: mean L* of the fill vs a ring 6–12 px outside the outline (exact EDT)
 *  - accent: share of fill pixels with C* > 30 (light sources L* >= 85 excluded)
 *  - silhouettes: 1 − IoU of role pairs (centroid aligned), nearest-template role accuracy
 *  - stability: IoU of consecutive frames
 */

export interface Rgba {
  w: number;
  h: number;
  /** RGBA8, row 0 = top. */
  data: Uint8Array | Uint8ClampedArray;
}

export interface BinMask {
  w: number;
  h: number;
  data: Uint8Array;
}

// ------------------------------------------------------------------------------------------------ colour
function lin(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}
const LUT = new Float64Array(256).map((_, i) => lin(i));
const fLab = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);

/** sRGB (0–255) -> [L*, a*, b*] (D65). */
export function srgbToLab(r: number, g: number, b: number): [number, number, number] {
  const R = LUT[r & 255]!, G = LUT[g & 255]!, B = LUT[b & 255]!;
  const X = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047;
  const Y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B;
  const Z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883;
  const fx = fLab(X), fy = fLab(Y), fz = fLab(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** L* of an sRGB colour (0–255 channels). */
export function lStar(r: number, g: number, b: number): number {
  return srgbToLab(r, g, b)[0];
}

export function chroma(r: number, g: number, b: number): number {
  const [, a, bb] = srgbToLab(r, g, b);
  return Math.hypot(a, bb);
}

/** Flip a bottom-up RGBA buffer (gl.readPixels) into top-down rows. */
export function flipRows(src: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(src.length);
  const row = w * 4;
  for (let y = 0; y < h; y++) out.set(src.subarray((h - 1 - y) * row, (h - y) * row), y * row);
  return out;
}

// ------------------------------------------------------------------------------------------------ masks
export function maskWhere(img: Rgba, pred: (r: number, g: number, b: number) => boolean): BinMask {
  const n = img.w * img.h;
  const data = new Uint8Array(n);
  const d = img.data;
  for (let i = 0; i < n; i++) data[i] = pred(d[i * 4]!, d[i * 4 + 1]!, d[i * 4 + 2]!) ? 1 : 0;
  return { w: img.w, h: img.h, data };
}

export function maskCount(m: BinMask): number {
  let n = 0;
  for (let i = 0; i < m.data.length; i++) n += m.data[i]!;
  return n;
}

export function maskOr(a: BinMask, b: BinMask): BinMask {
  const data = new Uint8Array(a.data.length);
  for (let i = 0; i < data.length; i++) data[i] = a.data[i]! | b.data[i]!;
  return { w: a.w, h: a.h, data };
}

/** Crop a mask to a box (clamped), x1/y1 exclusive. */
export function cropMask(m: BinMask, x0: number, y0: number, x1: number, y1: number): BinMask {
  const ax = Math.max(0, Math.floor(x0)), ay = Math.max(0, Math.floor(y0));
  const bx = Math.min(m.w, Math.ceil(x1)), by = Math.min(m.h, Math.ceil(y1));
  const w = Math.max(0, bx - ax), h = Math.max(0, by - ay);
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = m.data[(ay + y) * m.w + ax + x]!;
  return { w, h, data };
}

/** 1D squared distance transform (Felzenszwalb & Huttenlocher). */
function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array): void {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    while (s <= z[k]!) {
      k--;
      s = (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1]! < q) k++;
    d[q] = (q - v[k]!) * (q - v[k]!) + f[v[k]!]!;
  }
}

/** Exact Euclidean distance (px) from every pixel to the nearest pixel of the mask (0 inside). */
export function distanceTo(m: BinMask): Float32Array {
  const { w, h } = m;
  const INF = 1e20;
  const grid = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) grid[i] = m.data[i] ? 0 : INF;
  const n = Math.max(w, h);
  const f = new Float64Array(n), d = new Float64Array(n), z = new Float64Array(n + 1);
  const v = new Int32Array(n);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x]!;
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y]!;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x]!;
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) grid[y * w + x] = d[x]!;
  }
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = Math.sqrt(grid[i]!);
  return out;
}

// ------------------------------------------------------------------------------------------------ contrast and accent
export interface Contrast {
  fillL: number;
  ringL: number;
  dL: number;
  fillPx: number;
  ringPx: number;
  /** Mean a*, b* of the ring (the local light / ground tint; reference of the adapted accent). */
  ringA: number;
  ringB: number;
}

/**
 * Mean L* of the fill pixels vs the ring `ringIn`–`ringOut` px outside the figure (fill + outline);
 * pixels of `exclude` (other dwarves) never count as ground.
 */
export function figureGround(img: Rgba, fill: BinMask, figure: BinMask, exclude: BinMask | null, ringIn = 6, ringOut = 12): Contrast {
  const dist = distanceTo(figure);
  let fs = 0, fn = 0, rs = 0, rn = 0, ra = 0, rb = 0;
  const d = img.data;
  for (let i = 0; i < fill.data.length; i++) {
    if (fill.data[i]) {
      fs += lStar(d[i * 4]!, d[i * 4 + 1]!, d[i * 4 + 2]!);
      fn++;
    } else if (!figure.data[i] && !(exclude && exclude.data[i])) {
      const t = dist[i]!;
      if (t >= ringIn && t <= ringOut) {
        const [L, a, b] = srgbToLab(d[i * 4]!, d[i * 4 + 1]!, d[i * 4 + 2]!);
        rs += L;
        ra += a;
        rb += b;
        rn++;
      }
    }
  }
  const fillL = fn ? fs / fn : Number.NaN;
  const ringL = rn ? rs / rn : Number.NaN;
  return { fillL, ringL, dL: fillL - ringL, fillPx: fn, ringPx: rn, ringA: rn ? ra / rn : 0, ringB: rn ? rb / rn : 0 };
}

/**
 * Share of fill pixels with C* > cMin, ignoring light sources (L* >= lMax). With `ref` (mean a*, b* of the
 * ground around the figure) chroma is measured relative to the local light tint — the warm wash of the
 * L12 light lifts every pixel of a pool above C* 30, the adapted share asks what stands out of it.
 */
export function accentShare(img: Rgba, fill: BinMask, cMin = 30, lMax = 85, ref: readonly [number, number] = [0, 0]): number {
  let n = 0, k = 0;
  const d = img.data;
  for (let i = 0; i < fill.data.length; i++) {
    if (!fill.data[i]) continue;
    const [L, a, b] = srgbToLab(d[i * 4]!, d[i * 4 + 1]!, d[i * 4 + 2]!);
    if (L >= lMax) continue;
    n++;
    if (Math.hypot(a - ref[0], b - ref[1]) > cMin) k++;
  }
  return n ? k / n : 0;
}

// ------------------------------------------------------------------------------------------------ silhouettes
export function centroid(m: BinMask): [number, number] {
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.data[y * m.w + x]) { sx += x; sy += y; n++; }
  return n ? [sx / n, sy / n] : [m.w / 2, m.h / 2];
}

/** IoU of two masks; with `align`, B is shifted so the centroids coincide (integer shift). */
export function iou(a: BinMask, b: BinMask, align = true): number {
  let sx = 0, sy = 0;
  if (align) {
    const ca = centroid(a);
    const cb = centroid(b);
    sx = Math.round(ca[0] - cb[0]);
    sy = Math.round(ca[1] - cb[1]);
  }
  let inter = 0;
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      if (!b.data[y * b.w + x]) continue;
      const ax = x + sx, ay = y + sy;
      if (ax >= 0 && ay >= 0 && ax < a.w && ay < a.h && a.data[ay * a.w + ax]) inter++;
    }
  const uni = maskCount(a) + maskCount(b) - inter;
  return uni > 0 ? inter / uni : 1;
}

export interface SilhouetteResult {
  /** Mean over poses of 1 − IoU(role a, role b) at the same pose (centroid aligned). */
  pairDistance: number[][];
  minPair: number;
  /** Share of (role, pose) silhouettes whose nearest rest template (max IoU) is their own role. */
  accuracy: number;
}

/** masks[role][pose]; pose 0 = rest (template). */
export function silhouetteMetrics(masks: BinMask[][]): SilhouetteResult {
  const R = masks.length;
  const pairDistance = Array.from({ length: R }, () => new Array<number>(R).fill(0));
  let minPair = Infinity;
  for (let a = 0; a < R; a++)
    for (let b = a + 1; b < R; b++) {
      const P = Math.min(masks[a]!.length, masks[b]!.length);
      let s = 0;
      for (let k = 0; k < P; k++) s += 1 - iou(masks[a]![k]!, masks[b]![k]!);
      const dist = P ? s / P : 0;
      pairDistance[a]![b] = pairDistance[b]![a] = dist;
      minPair = Math.min(minPair, dist);
    }
  let ok = 0, all = 0;
  for (let r = 0; r < R; r++)
    for (const m of masks[r]!) {
      let best = -1, bestIoU = -1;
      for (let t = 0; t < R; t++) {
        const v = iou(masks[t]![0]!, m);
        if (v > bestIoU) { bestIoU = v; best = t; }
      }
      all++;
      if (best === r) ok++;
    }
  return { pairDistance, minPair: Number.isFinite(minPair) ? minPair : 0, accuracy: all ? ok / all : 0 };
}

/** Mean / min IoU of consecutive frames (no alignment: popping is what we measure). */
export function stability(frames: BinMask[]): { meanIoU: number; minIoU: number } {
  let s = 0, mn = 1, n = 0;
  for (let k = 1; k < frames.length; k++) {
    const v = iou(frames[k - 1]!, frames[k]!, false);
    s += v;
    mn = Math.min(mn, v);
    n++;
  }
  return { meanIoU: n ? s / n : 1, minIoU: n ? mn : 1 };
}

/** Median of a list (NaN for an empty list). */
export function median(xs: readonly number[]): number {
  if (xs.length === 0) return Number.NaN;
  const s = [...xs].sort((a, b) => a - b);
  const k = s.length >> 1;
  return s.length % 2 ? s[k]! : (s[k - 1]! + s[k]!) / 2;
}
