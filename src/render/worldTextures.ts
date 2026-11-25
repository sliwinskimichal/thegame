/**
 * GPU-side mirrors of world state, shared by all world materials:
 *  - light: RGBA8, rgb = block light, a = sky light (sqrt encoded), linear
 *  - fog:   RG8, r = explored, g = solid occupancy, linear (soft edges)
 *  - state: RGBA8, r = dig damage, g = designation, nearest
 *  - row:   1 x H tint per depth row (layer ambience), linear
 *  - mat:   material parameter table for the terrain shader
 */
import * as THREE from 'three';
import { LAYERS } from '../world/layers';
import { MATERIALS, SOLID } from '../world/materials';
import type { LightField } from '../world/lighting';
import { TF, type World } from '../world/world';
import { MAX_DYN_LIGHTS } from './glsl';

function srgbToLinear(hex: number): [number, number, number] {
  const c = new THREE.Color(hex); // three converts sRGB hex to linear working space
  return [c.r, c.g, c.b];
}

export interface DynLight {
  x: number;
  y: number;
  z: number;
  radius: number;
  r: number;
  g: number;
  b: number;
}

export class WorldTextures {
  readonly light: THREE.DataTexture;
  readonly fog: THREE.DataTexture;
  readonly state: THREE.DataTexture;
  readonly row: THREE.DataTexture;
  readonly mat: THREE.DataTexture;
  private fogData: Uint8Array;
  private stateData: Uint8Array;

  /** Uniforms shared (by reference) with every world material. */
  readonly uniforms: {
    uLightTex: THREE.IUniform<THREE.Texture>;
    uFogTex: THREE.IUniform<THREE.Texture>;
    uStateTex: THREE.IUniform<THREE.Texture>;
    uRowTex: THREE.IUniform<THREE.Texture>;
    uMatTex: THREE.IUniform<THREE.Texture>;
    uWorldSize: THREE.IUniform<THREE.Vector2>;
    uTime: THREE.IUniform<number>;
    uSkyLight: THREE.IUniform<THREE.Color>;
    uSunDir: THREE.IUniform<THREE.Vector3>;
    uDaylight: THREE.IUniform<number>;
    uDynPos: THREE.IUniform<THREE.Vector4[]>;
    uDynCol: THREE.IUniform<THREE.Vector4[]>;
    uDynCount: THREE.IUniform<number>;
    uCamPos: THREE.IUniform<THREE.Vector3>;
  };

  constructor(private world: World, lightField: LightField) {
    const { w, h } = world;
    this.light = new THREE.DataTexture(lightField.packed, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.light.magFilter = THREE.LinearFilter;
    this.light.minFilter = THREE.LinearFilter;
    this.light.needsUpdate = true;

    this.fogData = new Uint8Array(w * h * 2);
    this.fog = new THREE.DataTexture(this.fogData, w, h, THREE.RGFormat, THREE.UnsignedByteType);
    this.fog.magFilter = THREE.LinearFilter;
    this.fog.minFilter = THREE.LinearFilter;
    this.fog.unpackAlignment = 2;

    this.stateData = new Uint8Array(w * h * 4);
    this.state = new THREE.DataTexture(this.stateData, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.state.magFilter = THREE.NearestFilter;
    this.state.minFilter = THREE.NearestFilter;

    // Row tints: blend layer ambience across boundaries.
    const rowData = new Uint8Array(h * 4);
    for (let y = 0; y < h; y++) {
      const k = world.layerOfRow[y]!;
      const a = new THREE.Color(LAYERS[k]!.ambient);
      const next = LAYERS[k + 1];
      if (next) {
        const start = next.base * (h / 480);
        const t = Math.max(0, Math.min(1, (y - (start - 12)) / 12));
        a.lerp(new THREE.Color(next.ambient), t * 0.5);
      }
      const mx = Math.max(a.r, a.g, a.b, 1e-4);
      const hue = new THREE.Color(a.r / mx, a.g / mx, a.b / mx).lerp(new THREE.Color(1, 1, 1), 0.45);
      rowData[y * 4] = Math.round(hue.r * 255);
      rowData[y * 4 + 1] = Math.round(hue.g * 255);
      rowData[y * 4 + 2] = Math.round(hue.b * 255);
      rowData[y * 4 + 3] = 255;
    }
    this.row = new THREE.DataTexture(rowData, 1, h, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.row.magFilter = THREE.LinearFilter;
    this.row.minFilter = THREE.LinearFilter;
    this.row.needsUpdate = true;

    // Material table: 4 texels per material.
    const MT = 32;
    const md = new Float32Array(4 * MT * 4);
    for (const d of MATERIALS) {
      if (!d) continue;
      const o = d.id * 16;
      const A = srgbToLinear(d.colorA);
      const B = srgbToLinear(d.colorB);
      const C = srgbToLinear(d.accent);
      md.set([A[0], A[1], A[2], d.pattern], o);
      md.set([B[0], B[1], B[2], d.spec], o + 4);
      md.set([C[0], C[1], C[2], d.emissive], o + 8);
      md.set([d.scale, d.bump, d.accentAmount, d.variation], o + 12);
    }
    this.mat = new THREE.DataTexture(md, 4, MT, THREE.RGBAFormat, THREE.FloatType);
    this.mat.magFilter = THREE.NearestFilter;
    this.mat.minFilter = THREE.NearestFilter;
    this.mat.needsUpdate = true;

    const dynPos: THREE.Vector4[] = [];
    const dynCol: THREE.Vector4[] = [];
    for (let i = 0; i < MAX_DYN_LIGHTS; i++) {
      dynPos.push(new THREE.Vector4(0, 0, 0, 1));
      dynCol.push(new THREE.Vector4(0, 0, 0, 0));
    }
    this.uniforms = {
      uLightTex: { value: this.light },
      uFogTex: { value: this.fog },
      uStateTex: { value: this.state },
      uRowTex: { value: this.row },
      uMatTex: { value: this.mat },
      uWorldSize: { value: new THREE.Vector2(w, h) },
      uTime: { value: 0 },
      uSkyLight: { value: new THREE.Color(1, 1, 1) },
      uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.5).normalize() },
      uDaylight: { value: 1 },
      uDynPos: { value: dynPos },
      uDynCol: { value: dynCol },
      uDynCount: { value: 0 },
      uCamPos: { value: new THREE.Vector3() },
    };
    this.syncFog();
    this.syncState();
  }

  syncLight(): void {
    this.light.needsUpdate = true;
  }

  syncFog(): void {
    const { mat, flags } = this.world;
    const d = this.fogData;
    const n = this.world.size;
    for (let i = 0; i < n; i++) {
      d[i * 2] = flags[i]! & TF.EXPLORED ? 255 : 0;
      d[i * 2 + 1] = SOLID[mat[i]!] ? 255 : 0;
    }
    this.fog.needsUpdate = true;
  }

  syncState(): void {
    const { damage, desig } = this.world;
    const d = this.stateData;
    const n = this.world.size;
    for (let i = 0; i < n; i++) {
      d[i * 4] = damage[i]!;
      d[i * 4 + 1] = desig[i]!;
    }
    this.state.needsUpdate = true;
  }

  setDynamicLights(lights: readonly DynLight[]): void {
    const n = Math.min(lights.length, MAX_DYN_LIGHTS);
    const P = this.uniforms.uDynPos.value;
    const C = this.uniforms.uDynCol.value;
    for (let i = 0; i < n; i++) {
      const l = lights[i]!;
      P[i]!.set(l.x, l.y, l.z, l.radius);
      C[i]!.set(l.r, l.g, l.b, 0);
    }
    this.uniforms.uDynCount.value = n;
  }
}
