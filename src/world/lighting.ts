/**
 * Tile light field.
 *
 * Static light (torches, lava, crystals, glowing fungi) and sky light are
 * propagated over the grid with separable max-decay sweeps (Terraria-style):
 * each pass does L[i] = max(L[i], L[prev] * decay(i)), light fading fast
 * inside rock and slowly through open space. A few passes in each direction
 * let light flow around corners. The result is uploaded as a texture and the
 * shaders derive both intensity and an approximate light direction from it.
 *
 * Moving lights (dwarf lanterns, fireballs) are not part of this field; they
 * are shader uniforms (see render/lightUniforms).
 */
import { DECOR_LIGHT } from './decor';
import { MATERIALS, SOLID } from './materials';
import { FL, World } from './world';

export interface LightSource {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
}

const DECAY_AIR = 0.8;
const DECAY_SOLID = 0.5;
const DECAY_FLUID = 0.78;
const SKY_DECAY_AIR = 0.9;
const LAVA_LIGHT: readonly [number, number, number] = [2.2, 0.8, 0.18];

/** Light encoding for the 8-bit texture: sqrt curve over [0, MAX]. */
export const LIGHT_MAX = 4;

export class LightField {
  readonly w: number;
  readonly h: number;
  readonly r: Float32Array;
  readonly g: Float32Array;
  readonly b: Float32Array;
  readonly sky: Float32Array;
  private readonly decay: Float32Array;
  private readonly skyDecay: Float32Array;
  /** Packed RGBA8 data ready for GPU upload. */
  readonly packed: Uint8Array;
  lastMs = 0;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    const n = w * h;
    this.r = new Float32Array(n);
    this.g = new Float32Array(n);
    this.b = new Float32Array(n);
    this.sky = new Float32Array(n);
    this.decay = new Float32Array(n);
    this.skyDecay = new Float32Array(n);
    this.packed = new Uint8Array(n * 4);
  }

  compute(world: World, sources: readonly LightSource[]): void {
    const t0 = performance.now();
    const { w, h, r, g, b, sky, decay, skyDecay } = this;
    const { mat, fluid, fluidType } = world;
    const n = w * h;

    // Emission + per-tile decay.
    for (let i = 0; i < n; i++) {
      const m = mat[i]!;
      const solid = SOLID[m] === 1;
      const fl = fluid[i]! > 0;
      decay[i] = solid ? DECAY_SOLID : fl ? DECAY_FLUID : DECAY_AIR;
      skyDecay[i] = solid ? DECAY_SOLID : fl ? DECAY_FLUID : SKY_DECAY_AIR;
      const L = MATERIALS[m]!.light;
      if (L) {
        r[i] = L[0];
        g[i] = L[1];
        b[i] = L[2];
      } else if (fl && fluidType[i] === FL.LAVA) {
        r[i] = LAVA_LIGHT[0];
        g[i] = LAVA_LIGHT[1];
        b[i] = LAVA_LIGHT[2];
      } else {
        r[i] = g[i] = b[i] = 0;
      }
      sky[i] = 0;
    }
    for (const d of world.decor) {
      const L = DECOR_LIGHT[d.type];
      if (!L) continue;
      const tx = Math.floor(d.x);
      const ty = Math.floor(-d.y - 0.01);
      if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
      const i = ty * w + tx;
      const s = d.scale;
      r[i] = Math.max(r[i]!, L[0] * s);
      g[i] = Math.max(g[i]!, L[1] * s);
      b[i] = Math.max(b[i]!, L[2] * s);
    }
    for (const s of sources) {
      const tx = Math.floor(s.x);
      const ty = Math.floor(s.y);
      if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
      const i = ty * w + tx;
      r[i] = Math.max(r[i]!, s.r);
      g[i] = Math.max(g[i]!, s.g);
      b[i] = Math.max(b[i]!, s.b);
    }

    // Sky: straight down every column until the first solid tile.
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        const i = y * w + x;
        if (SOLID[mat[i]!] === 1) {
          sky[i] = DECAY_SOLID;
          break;
        }
        sky[i] = fluid[i]! > 0 ? 0.6 : 1;
      }
    }

    for (let it = 0; it < 2; it++) {
      this.sweepRows(r, g, b, sky);
      this.sweepCols(r, g, b, sky);
    }
    this.pack();
    this.lastMs = performance.now() - t0;
  }

  private sweepRows(r: Float32Array, g: Float32Array, b: Float32Array, s: Float32Array): void {
    const { w, h, decay, skyDecay } = this;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      // left -> right
      for (let x = 1; x < w; x++) {
        const i = row + x;
        const j = i - 1;
        const d = decay[i]!;
        let v = r[j]! * d;
        if (v > r[i]!) r[i] = v;
        v = g[j]! * d;
        if (v > g[i]!) g[i] = v;
        v = b[j]! * d;
        if (v > b[i]!) b[i] = v;
        v = s[j]! * skyDecay[i]!;
        if (v > s[i]!) s[i] = v;
      }
      // right -> left
      for (let x = w - 2; x >= 0; x--) {
        const i = row + x;
        const j = i + 1;
        const d = decay[i]!;
        let v = r[j]! * d;
        if (v > r[i]!) r[i] = v;
        v = g[j]! * d;
        if (v > g[i]!) g[i] = v;
        v = b[j]! * d;
        if (v > b[i]!) b[i] = v;
        v = s[j]! * skyDecay[i]!;
        if (v > s[i]!) s[i] = v;
      }
    }
  }

  private sweepCols(r: Float32Array, g: Float32Array, b: Float32Array, s: Float32Array): void {
    const { w, h, decay, skyDecay } = this;
    // top -> bottom (row by row keeps memory access linear)
    for (let y = 1; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const i = row + x;
        const j = i - w;
        const d = decay[i]!;
        let v = r[j]! * d;
        if (v > r[i]!) r[i] = v;
        v = g[j]! * d;
        if (v > g[i]!) g[i] = v;
        v = b[j]! * d;
        if (v > b[i]!) b[i] = v;
        v = s[j]! * skyDecay[i]!;
        if (v > s[i]!) s[i] = v;
      }
    }
    // bottom -> top
    for (let y = h - 2; y >= 0; y--) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const i = row + x;
        const j = i + w;
        const d = decay[i]!;
        let v = r[j]! * d;
        if (v > r[i]!) r[i] = v;
        v = g[j]! * d;
        if (v > g[i]!) g[i] = v;
        v = b[j]! * d;
        if (v > b[i]!) b[i] = v;
        v = s[j]! * skyDecay[i]!;
        if (v > s[i]!) s[i] = v;
      }
    }
  }

  private pack(): void {
    const { r, g, b, sky, packed } = this;
    const n = this.w * this.h;
    const k = 1 / LIGHT_MAX;
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      packed[o] = Math.sqrt(Math.min(1, r[i]! * k)) * 255;
      packed[o + 1] = Math.sqrt(Math.min(1, g[i]! * k)) * 255;
      packed[o + 2] = Math.sqrt(Math.min(1, b[i]! * k)) * 255;
      packed[o + 3] = Math.sqrt(Math.min(1, sky[i]!)) * 255;
    }
  }

  /** Brightness at a tile (0..~2), used by gameplay (work speed, monsters). */
  brightness(x: number, y: number, daylight: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    const i = y * this.w + x;
    return Math.max(this.r[i]!, this.g[i]!, this.b[i]!) + this.sky[i]! * daylight;
  }
}
