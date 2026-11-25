/**
 * GPU mirrors of the world grid, shared by renderers:
 *  - light: RGBA8 (rgb block light sqrt-encoded over [0, LIGHT_MAX], a = sky light), linear
 *  - fog:   RG8 (r explored, g solid occupancy), linear — soft edges
 *  - tiles: RGBA8 (r visible material: rock if solid, back wall if open; g cavity kind,
 *           b fluid kind, a cavity depth), nearest
 */
import * as THREE from 'three';
import { LIGHT_MAX, type LightField } from '../world/lightfield';
import { SOLID } from '../world/materials';
import { TF, type World } from '../world/world';

export class WorldTex {
  readonly light: THREE.DataTexture;
  readonly fog: THREE.DataTexture;
  readonly tiles: THREE.DataTexture;
  private fogData: Uint8Array;
  private tileData: Uint8Array;

  constructor(
    private world: World,
    lf: LightField,
  ) {
    const { w, h } = world;
    this.light = new THREE.DataTexture(lf.packed, w, h, THREE.RGBAFormat);
    this.light.magFilter = this.light.minFilter = THREE.LinearFilter;
    this.light.needsUpdate = true;
    this.fogData = new Uint8Array(w * h * 2);
    this.fog = new THREE.DataTexture(this.fogData, w, h, THREE.RGFormat);
    this.fog.magFilter = this.fog.minFilter = THREE.LinearFilter;
    this.fog.unpackAlignment = 2;
    this.tileData = new Uint8Array(w * h * 4);
    this.tiles = new THREE.DataTexture(this.tileData, w, h, THREE.RGBAFormat);
    this.tiles.magFilter = this.tiles.minFilter = THREE.NearestFilter;
    this.sync();
  }

  sync(): void {
    const { mat, bg, flags, cav, fluidKind, depth, size } = this.world;
    for (let i = 0; i < size; i++) {
      const explored = (flags[i]! & TF.EXPLORED) !== 0;
      // apparent state: unknown tiles look like plain host rock (hides caves and ores)
      const solid = SOLID[mat[i]!] === 1 || (!explored && cav[i] !== 1);
      this.fogData[i * 2] = explored ? 255 : 0;
      this.fogData[i * 2 + 1] = solid ? 255 : 0;
      this.tileData[i * 4] = !explored ? bg[i] || mat[i]! : SOLID[mat[i]!] ? mat[i]! : bg[i]!;
      this.tileData[i * 4 + 1] = cav[i]!;
      this.tileData[i * 4 + 2] = fluidKind[i]!;
      this.tileData[i * 4 + 3] = depth[i]!;
    }
    this.fog.needsUpdate = true;
    this.tiles.needsUpdate = true;
    this.light.needsUpdate = true;
  }
}

/** GLSL helpers matching WorldTex (append to a shader that declares the uniforms). */
export const GLSL_WORLD = /* glsl */ `
uniform sampler2D uLightTex;
uniform sampler2D uFogTex;
uniform sampler2D uTileTex;
uniform vec2 uWorldSize;
vec2 worldUV(vec2 p) { return vec2(p.x / uWorldSize.x, -p.y / uWorldSize.y); }
vec4 lightAt(vec2 p) { vec4 e = texture(uLightTex, worldUV(p)); return e * e * vec4(${LIGHT_MAX.toFixed(1)}, ${LIGHT_MAX.toFixed(1)}, ${LIGHT_MAX.toFixed(1)}, 1.0); }
vec2 fogAt(vec2 p) { return texture(uFogTex, worldUV(p)).rg; }
vec4 tileAt(vec2 p) { return texelFetch(uTileTex, ivec2(floor(p.x), int(floor(-p.y))), 0); }
`;
