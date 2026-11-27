/**
 * S01 "Makieta" — the archived prototype approach: Z-heightfield cross-section
 * with recessed tunnels and smooth cave walls, per-pixel procedural rock with
 * bump mapping, light-field lighting, sky dome + distant landscape, bloom.
 */
import * as THREE from 'three';
import { buildHeightfield } from '../../render/heightfield';
import { PostFX } from '../../render/post';
import { GLSL_LIGHT, GLSL_NOISE, GLSL_ROCK } from '../../render/shaderlib';
import { SkyView } from '../../render/sky';
import { GLSL_WORLD } from '../../render/worldTex';
import { buildDressing, buildFluids, buildMannequins, buildProps, litMaterial, updateWorldUniforms, WINDY, worldUniforms, type WorldUniforms } from '../common';
import type { RenderStyle, StyleContext } from '../style';

const VERT = /* glsl */ `
attribute float aMatFlags;
attribute float aAo;
varying vec3 vPos;
varying vec3 vNormal;
flat varying float vMat;
flat varying float vFlags;
varying float vAo;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPos = wp.xyz;
  vNormal = normal;
  vMat = mod(aMatFlags, 256.0);
  vFlags = floor(aMatFlags / 256.0 + 0.5);
  vAo = aAo;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const TERRAIN_FRAG = /* glsl */ `
uniform sampler2D uMatTex;
uniform vec3 uCamPos;
uniform float uCutAmbient;
uniform float uInteriorAmbient;
uniform float uRockExposure;
uniform float uRockAmbient;
uniform float uGlint;
uniform float uGlintBase;
uniform float uOreAura;
uniform float uRimTint;
uniform float uInteriorGain;
${GLSL_WORLD}
${GLSL_NOISE}
${GLSL_LIGHT}
varying vec3 vPos;
varying vec3 vNormal;
flat varying float vMat;
flat varying float vFlags;
varying float vAo;
bool flag(float bit) { return mod(floor(vFlags / bit), 2.0) > 0.5; }
vec3 depthTint(float y) {
  return mix(vec3(1.0, 0.94, 0.84), vec3(0.78, 0.92, 1.0), smoothstep(-22.0, -40.0, y));
}
${GLSL_ROCK}
void main() {
  int m = int(vMat + 0.5);
  vec4 p0 = texelFetch(uMatTex, ivec2(0, m), 0);
  vec4 p1 = texelFetch(uMatTex, ivec2(1, m), 0);
  vec4 p2 = texelFetch(uMatTex, ivec2(2, m), 0);
  vec4 p3 = texelFetch(uMatTex, ivec2(3, m), 0);
  vec4 p4 = texelFetch(uMatTex, ivec2(4, m), 0);
  int pat = int(p0.a + 0.5);
  gForm = int(texelFetch(uMatTex, ivec2(5, m), 0).x + 0.5);
  vec3 N = normalize(vNormal);
  vec3 wp = vPos;
  bool interior = flag(1.0);
  bool grassy = flag(2.0);
  bool natural = flag(4.0);
  bool unexplored = flag(8.0);
  bool outdoor = flag(16.0);
  bool top = flag(32.0);
  bool cap = abs(N.z) > 0.5;

  // Planar mapping per face orientation.
  vec2 uv; vec3 T; vec3 Bv;
  if (cap) { uv = wp.xy; T = vec3(1.0, 0.0, 0.0); Bv = vec3(0.0, 1.0, 0.0); }
  else if (abs(N.x) > 0.5) { uv = vec2(wp.z, wp.y); T = vec3(0.0, 0.0, 1.0); Bv = vec3(0.0, 1.0, 0.0); }
  else { uv = vec2(wp.x, wp.z); T = vec3(1.0, 0.0, 0.0); Bv = vec3(0.0, 0.0, 1.0); }

  Surf sf = surface(pat, uv, wp, p0, p1, p2, p3);

  // Bump from the height field.
  float eps = 0.025;
  float h0 = heightAt(pat, uv, wp, p3);
  float hx = heightAt(pat, uv + vec2(eps, 0.0), wp + T * eps, p3);
  float hy = heightAt(pat, uv + vec2(0.0, eps), wp + Bv * eps, p3);
  float bumpK = p3.y * (natural ? 0.22 : 0.16) * (unexplored ? 0.5 : 1.0);

  // Grass on soil exposed to the sky.
  float grassMask = 0.0;
  if (grassy) {
    if (top) {
      grassMask = 1.0;
    } else if (cap) {
      float t = fract(-wp.y);
      float fringe = 0.16 + 0.1 * vnoise(vec2(wp.x * 9.0, 1.0)) + 0.06 * sin(wp.x * 31.0);
      grassMask = smoothstep(fringe + 0.03, fringe - 0.02, t);
    }
    if (grassMask > 0.0) {
      float blades = vnoise(uv * vec2(38.0, 38.0));
      float gpatch = fbm3(uv * 0.6);
      vec3 g = mix(vec3(0.08, 0.16, 0.03), vec3(0.24, 0.36, 0.07), gpatch) * (0.7 + 0.6 * blades);
      g = mix(g, vec3(0.35, 0.32, 0.1), smoothstep(0.65, 0.8, fbm3(uv * 0.35 + 9.0)) * 0.5);
      sf.albedo = mix(sf.albedo, g, grassMask);
      h0 += blades * 0.4 * grassMask;
      hx += vnoise((uv + vec2(eps, 0.0)) * 38.0) * 0.4 * grassMask;
      hy += vnoise((uv + vec2(0.0, eps)) * 38.0) * 0.4 * grassMask;
      sf.spec *= 1.0 - grassMask;
    }
  }

  vec3 nts = normalize(vec3(-(hx - h0) / eps * bumpK, -(hy - h0) / eps * bumpK, 1.0));
  vec3 Np = normalize(T * nts.x + Bv * nts.y + N * nts.z);

  // Tile that owns this surface (walls belong to the tile behind them).
  vec2 owner = cap ? wp.xy : wp.xy - N.xy * 0.3;

  vec3 V = normalize(uCamPos - wp);
  vec2 sp = cap ? wp.xy : wp.xy + N.xy * 0.5;
  vec3 spec;
  float sunMix = outdoor ? 1.0 : (grassy ? 0.7 : 0.0);
  vec3 light = worldLight(wp, Np, sp, V, sf.shin, sunMix, spec);
  vec3 tint = depthTint(wp.y);
  vec3 amb = tint * (interior ? uInteriorAmbient : uCutAmbient);
  if (outdoor) amb += uSkyLight * 0.12;

  vec3 col = sf.albedo * (light + amb) * vAo + spec * sf.spec * 0.6 + sf.emissive;
  if (cap && !interior && !unexplored) {
    // carved edge: the cut plane catches a little light where it meets a hollow
    float occ = fogAt(wp.xy).y;
    float rim = smoothstep(0.86, 0.6, occ);
    col = col * (1.0 + rim * 0.6) + sf.albedo * light * rim * 0.8 + sf.albedo * tint * rim * 0.12;
  }

  // Fog of war: unknown rock stays readable but dim and desaturated.
  float explored = fogAt(owner).x;
  float g = lum(col);
  col = mix(mix(vec3(g), col, 0.5) * 0.42, col, explored);

  gl_FragColor = vec4(col, 1.0);
}
`;

/** The diorama scene (terrain, props, dwarves, fluids, sky) reused by derived styles. */
export function buildDioramaScene(ctx: StyleContext): { scene: THREE.Scene; sky: SkyView; u: WorldUniforms; terrain: THREE.ShaderMaterial } {
  const scene = new THREE.Scene();
  const u = worldUniforms(ctx);
  const sky = new SkyView(ctx.world);
  scene.add(sky.group);
  const terrain = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: TERRAIN_FRAG,
    uniforms: { ...u, uCutAmbient: { value: 0.13 }, uInteriorAmbient: { value: 0.2 } },
  });
  scene.add(new THREE.Mesh(buildHeightfield(ctx.world, 0, 0, ctx.world.w, ctx.world.h), terrain));
  const propLit = litMaterial(u);
  const propWind = litMaterial(u, { wind: 0.05, doubleSide: true });
  scene.add(buildProps(ctx, (t) => (WINDY.has(t) ? propWind : propLit)));
  scene.add(buildMannequins(ctx, litMaterial(u, { rim: 0.35 })));
  scene.add(buildDressing(ctx, propLit));
  scene.add(buildFluids(ctx, u));
  return { scene, sky, u, terrain };
}

export const S01: RenderStyle = {
  id: 's01-diorama',
  namePl: 'Makieta (prototyp)',
  descPl: 'Przekrój jako wgłębienia w płycie, proceduralne materiały skał z bumpem, pole światła, bloom.',
  create(ctx) {
    const { scene, sky, u } = buildDioramaScene(ctx);
    const post = new PostFX(ctx.renderer, scene, ctx.camera, ctx.width, ctx.height);
    post.setSize(ctx.width, ctx.height);
    return {
      render(f) {
        updateWorldUniforms(u, f, ctx.camera);
        sky.update(f.day, f.time, ctx.camera.position);
        post.render(f.time);
      },
      resize(w, h) {
        post.setSize(w, h);
      },
    };
  },
};
