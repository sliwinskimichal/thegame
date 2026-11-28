// Dwarf station metrics (owner: W3 "Technical artist"): colour science, masks, contrast, silhouettes, stability.
import { describe, expect, it } from 'vitest';
import {
  accentShare,
  centroid,
  chroma,
  cropMask,
  distanceTo,
  figureGround,
  flipRows,
  iou,
  lStar,
  maskCount,
  median,
  silhouetteMetrics,
  srgbToLab,
  stability,
  type BinMask,
  type Rgba,
} from '../../../src/render/characters/lab/metrics';

const rect = (w: number, h: number, x0: number, y0: number, x1: number, y1: number): BinMask => {
  const data = new Uint8Array(w * h);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data[y * w + x] = 1;
  return { w, h, data };
};

/** Solid image with a rectangle of another colour. */
const image = (w: number, h: number, bg: [number, number, number], fg: [number, number, number], r: [number, number, number, number]): Rgba => {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const inside = x >= r[0] && x < r[2] && y >= r[1] && y < r[3];
      const c = inside ? fg : bg;
      data.set([c[0], c[1], c[2], 255], (y * w + x) * 4);
    }
  return { w, h, data };
};

describe('colour science (sRGB -> CIE L*a*b*, D65)', () => {
  it('L* of known colours', () => {
    expect(lStar(255, 255, 255)).toBeCloseTo(100, 1);
    expect(lStar(0, 0, 0)).toBeCloseTo(0, 5);
    expect(lStar(119, 119, 119)).toBeCloseTo(50.03, 1);
    expect(lStar(0x20, 0x18, 0x12)).toBeGreaterThan(8); // ink #201812: L* 9 (art bible)
    expect(lStar(0x20, 0x18, 0x12)).toBeLessThan(11);
  });
  it('Lab of pure red and chroma of greys', () => {
    const [L, a, b] = srgbToLab(255, 0, 0);
    expect(L).toBeCloseTo(53.24, 1);
    expect(a).toBeCloseTo(80.09, 0);
    expect(b).toBeCloseTo(67.2, 0);
    expect(chroma(128, 128, 128)).toBeLessThan(0.01);
    expect(chroma(0xa8, 0x30, 0x3a)).toBeGreaterThan(30); // crown accent is saturated
  });
  it('flips bottom-up readback rows', () => {
    const src = new Uint8Array([1, 1, 1, 1, 2, 2, 2, 2]); // 1x2, row 0 = bottom
    expect([...flipRows(src, 1, 2)]).toEqual([2, 2, 2, 2, 1, 1, 1, 1]);
  });
});

describe('masks and distances', () => {
  it('exact Euclidean distance outside a mask', () => {
    const m = rect(20, 20, 5, 5, 10, 10);
    const d = distanceTo(m);
    expect(d[7 * 20 + 7]).toBe(0);
    expect(d[7 * 20 + 13]).toBeCloseTo(4, 5); // 4 px right of the right edge (x = 9)
    expect(d[13 * 20 + 13]).toBeCloseTo(Math.hypot(4, 4), 5);
  });
  it('IoU of known masks, with and without centroid alignment', () => {
    const a = rect(20, 20, 2, 2, 8, 8); // 36 px
    const b = rect(20, 20, 5, 2, 11, 8); // shifted by 3 px
    expect(iou(a, b, false)).toBeCloseTo(18 / 54, 6);
    expect(iou(a, b, true)).toBeCloseTo(1, 6);
    expect(iou(a, rect(20, 20, 12, 12, 18, 18), false)).toBe(0);
    expect(centroid(a)).toEqual([4.5, 4.5]);
  });
  it('crops with clamping', () => {
    const m = rect(10, 10, 0, 0, 10, 10);
    const c = cropMask(m, -3, 2, 4, 20);
    expect([c.w, c.h, maskCount(c)]).toEqual([4, 8, 32]);
  });
});

describe('figure / ground contrast and accent', () => {
  it('measures the fill against a ring 6–12 px outside the outline', () => {
    // ground L* 30 (grey 71), figure L* 60 (grey 145), 2 px outline of ink around it
    const W = 64;
    const img = image(W, W, [71, 71, 71], [145, 145, 145], [20, 20, 40, 44]);
    const fill = rect(W, W, 20, 20, 40, 44);
    const figure = rect(W, W, 18, 18, 42, 46); // fill + outline
    const c = figureGround(img, fill, figure, null);
    expect(c.fillL).toBeCloseTo(lStar(145, 145, 145), 3);
    expect(c.ringL).toBeCloseTo(lStar(71, 71, 71), 3);
    expect(c.dL).toBeGreaterThan(29);
    expect(c.ringPx).toBeGreaterThan(0);
    // other dwarves never count as ground
    const other = rect(W, W, 0, 0, W, W);
    expect(figureGround(img, fill, figure, other).ringPx).toBe(0);
  });
  it('accent share: saturated pixels of the fill, light sources ignored, relative to the ground tint', () => {
    const W = 10;
    const data = new Uint8Array(W * W * 4);
    for (let i = 0; i < W * W; i++) data.set(i < 10 ? [0xa8, 0x30, 0x3a, 255] : i < 20 ? [255, 250, 240, 255] : [110, 100, 90, 255], i * 4);
    const img = { w: W, h: W, data };
    const fill = rect(W, W, 0, 0, W, W);
    // 10 accent pixels of 90 non-light pixels
    expect(accentShare(img, fill)).toBeCloseTo(10 / 90, 6);
    // a warm wash (reference = the accent colour itself) makes the accent pixels ordinary
    const [, a, b] = srgbToLab(0xa8, 0x30, 0x3a);
    expect(accentShare(img, fill, 30, 85, [a, b])).toBeGreaterThan(0.85);
  });
});

describe('silhouettes and stability', () => {
  it('role distance, the closest pair and nearest-template accuracy', () => {
    const W = 40;
    const tall = rect(W, W, 15, 5, 25, 35); // 10 x 30
    const wide = rect(W, W, 5, 15, 35, 25); // 30 x 10
    const square = rect(W, W, 10, 10, 30, 30);
    const masks = [
      [tall, rect(W, W, 16, 5, 26, 35)],
      [wide, rect(W, W, 5, 16, 35, 26)],
      [square, square],
    ];
    const r = silhouetteMetrics(masks);
    expect(r.pairDistance[0]![1]).toBeCloseTo(1 - 100 / 500, 6);
    expect(r.pairDistance[0]![1]).toBe(r.pairDistance[1]![0]);
    expect(r.minPair).toBeLessThanOrEqual(r.pairDistance[0]![1]!);
    expect(r.accuracy).toBe(1);
  });
  it('IoU of consecutive frames', () => {
    const f = [rect(20, 20, 2, 2, 12, 12), rect(20, 20, 2, 2, 12, 12), rect(20, 20, 3, 2, 13, 12)];
    const s = stability(f);
    expect(s.minIoU).toBeCloseTo(90 / 110, 6);
    expect(s.meanIoU).toBeCloseTo((1 + 90 / 110) / 2, 6);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
});
