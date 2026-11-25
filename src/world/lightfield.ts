/**
 * Tile light field: block light (torches, lava, glowing rock and fungi) and
 * sky light, propagated with separable max-decay sweeps. Light fades quickly
 * inside rock and slowly through open space; repeated passes let it bend
 * around corners. Parameters are exposed so the lighting look can be tuned
 * (and tournamented) without touching the algorithm.
 */
import { MATERIALS, SOLID } from './materials';
import { FLUID, PROP, PROP_GLOW, type World } from './world';

export interface LightParams {
  decayAir: number;
  decaySolid: number;
  decayFluid: number;
  skyDecayAir: number;
  passes: number;
  lava: readonly [number, number, number];
}

export const DEFAULT_LIGHT: LightParams = {
  decayAir: 0.8,
  decaySolid: 0.5,
  decayFluid: 0.74,
  skyDecayAir: 0.9,
  passes: 2,
  lava: [2.2, 0.8, 0.18],
};

/** RGB block light is encoded as sqrt(L / LIGHT_MAX); sky as sqrt(S). */
export const LIGHT_MAX = 4;

export class LightField {
  readonly w: number;
  readonly h: number;
  readonly r: Float32Array;
  readonly g: Float32Array;
  readonly b: Float32Array;
  readonly sky: Float32Array;
  readonly packed: Uint8Array;
  private readonly dec: Float32Array;
  private readonly skyDec: Float32Array;
  params: LightParams;
  lastMs = 0;

  constructor(w: number, h: number, params: LightParams = DEFAULT_LIGHT) {
    this.w = w;
    this.h = h;
    const n = w * h;
    this.r = new Float32Array(n);
    this.g = new Float32Array(n);
    this.b = new Float32Array(n);
    this.sky = new Float32Array(n);
    this.dec = new Float32Array(n);
    this.skyDec = new Float32Array(n);
    this.packed = new Uint8Array(n * 4);
    this.params = params;
  }

  compute(world: World): void {
    const t0 = performance.now();
    const P = this.params;
    const { w, h, r, g, b, sky, dec, skyDec } = this;
    const { mat, fluid, fluidKind } = world;
    const n = w * h;
    for (let i = 0; i < n; i++) {
      const m = mat[i]!;
      const solid = SOLID[m] === 1;
      const fl = fluid[i]! > 0;
      dec[i] = solid ? P.decaySolid : fl ? P.decayFluid : P.decayAir;
      skyDec[i] = solid ? P.decaySolid : fl ? P.decayFluid : P.skyDecayAir;
      const glow = MATERIALS[m]!.glow;
      if (fl && fluidKind[i] === FLUID.LAVA) {
        r[i] = P.lava[0];
        g[i] = P.lava[1];
        b[i] = P.lava[2];
      } else if (glow) {
        r[i] = glow[0];
        g[i] = glow[1];
        b[i] = glow[2];
      } else r[i] = g[i] = b[i] = 0;
      sky[i] = 0;
    }
    for (const p of world.props) {
      const L = PROP_GLOW[p.type];
      if (!L) continue;
      const tx = Math.floor(p.x);
      const ty = Math.floor(-p.y + (p.attach === 'floor' || p.attach === 'ground' ? -0.01 : 0.01));
      if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
      const i = ty * w + tx;
      const s = p.type === PROP.TORCH ? 1 : Math.min(1.3, p.scale);
      r[i] = Math.max(r[i]!, L[0] * s);
      g[i] = Math.max(g[i]!, L[1] * s);
      b[i] = Math.max(b[i]!, L[2] * s);
    }
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        const i = y * w + x;
        if (SOLID[mat[i]!] === 1) {
          sky[i] = P.decaySolid;
          break;
        }
        sky[i] = fluid[i]! > 0 ? 0.6 : 1;
      }
    }
    for (let k = 0; k < P.passes; k++) {
      this.rows();
      this.cols();
    }
    this.pack();
    this.lastMs = performance.now() - t0;
  }

  private rows(): void {
    const { w, h, r, g, b, sky: s, dec, skyDec } = this;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 1; x < w; x++) step(row + x, row + x - 1);
      for (let x = w - 2; x >= 0; x--) step(row + x, row + x + 1);
    }
    function step(i: number, j: number): void {
      const d = dec[i]!;
      let v = r[j]! * d;
      if (v > r[i]!) r[i] = v;
      v = g[j]! * d;
      if (v > g[i]!) g[i] = v;
      v = b[j]! * d;
      if (v > b[i]!) b[i] = v;
      v = s[j]! * skyDec[i]!;
      if (v > s[i]!) s[i] = v;
    }
  }

  private cols(): void {
    const { w, h, r, g, b, sky: s, dec, skyDec } = this;
    for (let y = 1; y < h; y++) for (let x = 0, row = y * w; x < w; x++) step(row + x, row + x - w);
    for (let y = h - 2; y >= 0; y--) for (let x = 0, row = y * w; x < w; x++) step(row + x, row + x + w);
    function step(i: number, j: number): void {
      const d = dec[i]!;
      let v = r[j]! * d;
      if (v > r[i]!) r[i] = v;
      v = g[j]! * d;
      if (v > g[i]!) g[i] = v;
      v = b[j]! * d;
      if (v > b[i]!) b[i] = v;
      v = s[j]! * skyDec[i]!;
      if (v > s[i]!) s[i] = v;
    }
  }

  private pack(): void {
    const { r, g, b, sky, packed } = this;
    const k = 1 / LIGHT_MAX;
    for (let i = 0, n = this.w * this.h; i < n; i++) {
      const o = i * 4;
      packed[o] = Math.sqrt(Math.min(1, r[i]! * k)) * 255;
      packed[o + 1] = Math.sqrt(Math.min(1, g[i]! * k)) * 255;
      packed[o + 2] = Math.sqrt(Math.min(1, b[i]! * k)) * 255;
      packed[o + 3] = Math.sqrt(Math.min(1, sky[i]!)) * 255;
    }
  }
}
