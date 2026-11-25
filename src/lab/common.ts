/**
 * Helpers shared by the lab styles: world uniforms, lantern lights carried
 * by the mannequins, prop/mannequin meshes and the standard lit material.
 */
import * as THREE from 'three';
import { buildFluidGeometry, fluidMaterial } from '../render/fluids';
import { lookTexture } from '../render/palette';
import { buildMannequin, buildPropGeometries, collectProps } from '../render/propsGeo';
import { GLSL_LIGHT, GLSL_NOISE, MAX_DYN_LIGHTS } from '../render/shaderlib';
import { GLSL_WORLD } from '../render/worldTex';
import { PROP } from '../world/world';
import type { FrameState, StyleContext } from './style';

export type WorldUniforms = Record<string, THREE.IUniform>;

export function worldUniforms(ctx: StyleContext): WorldUniforms {
  const dynPos = Array.from({ length: MAX_DYN_LIGHTS }, () => new THREE.Vector4(0, 0, 0, 1));
  const dynCol = Array.from({ length: MAX_DYN_LIGHTS }, () => new THREE.Vector4());
  const lanterns = ctx.world.mannequins.map((m) => new THREE.Vector3(m.x - 0.16 * m.facing, m.y + 0.3, -0.42));
  lanterns.slice(0, MAX_DYN_LIGHTS).forEach((p, i) => {
    dynPos[i]!.set(p.x, p.y, p.z, 3.6);
    dynCol[i]!.set(1.4, 0.95, 0.55, 0);
  });
  return {
    uLightTex: { value: ctx.tex.light },
    uFogTex: { value: ctx.tex.fog },
    uTileTex: { value: ctx.tex.tiles },
    uMatTex: { value: lookTexture() },
    uWorldSize: { value: new THREE.Vector2(ctx.world.w, ctx.world.h) },
    uTime: { value: 0 },
    uSkyLight: { value: new THREE.Color(1, 1, 1) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uDaylight: { value: 1 },
    uDynPos: { value: dynPos },
    uDynCol: { value: dynCol },
    uDynCount: { value: Math.min(lanterns.length, MAX_DYN_LIGHTS) },
    uCamPos: { value: new THREE.Vector3() },
  };
}

export function updateWorldUniforms(u: WorldUniforms, f: FrameState, cam: THREE.Camera): void {
  u.uTime!.value = f.time;
  (u.uSkyLight!.value as THREE.Color).copy(f.day.skyLight);
  (u.uSunDir!.value as THREE.Vector3).copy(f.day.sunDir);
  u.uDaylight!.value = f.day.daylight;
  (u.uCamPos!.value as THREE.Vector3).copy(cam.position);
}

const LIT_VERT = /* glsl */ `
attribute vec3 color;
attribute float aEmissive;
uniform float uWind;
uniform float uTime;
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vPos;
varying float vEmi;
void main() {
  mat4 m = modelMatrix;
  #ifdef USE_INSTANCING
    m = modelMatrix * instanceMatrix;
  #endif
  vec4 wp = m * vec4(position, 1.0);
  #ifdef WIND
    float hh = max(position.y, 0.0);
    wp.x += sin(uTime * 1.6 + wp.x * 0.7 + wp.z * 0.4) * hh * hh * uWind;
  #endif
  vPos = wp.xyz;
  vNormal = normalize(mat3(m) * normal);
  vColor = color;
  #ifdef USE_INSTANCING_COLOR
    vColor *= instanceColor;
  #endif
  vEmi = aEmissive;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const LIT_FRAG = /* glsl */ `
uniform vec3 uCamPos;
uniform float uAmbient;
uniform float uRim;
${GLSL_WORLD}
${GLSL_NOISE}
${GLSL_LIGHT}
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vPos;
varying float vEmi;
void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(uCamPos - vPos);
  float skyHere = lightAt(vPos.xy).a;
  vec3 spec;
  vec3 light = worldLight(vPos, N, vPos.xy, V, 24.0, smoothstep(0.55, 0.95, skyHere), spec);
  vec3 amb = vec3(0.9, 0.85, 0.8) * uAmbient + uSkyLight * skyHere * 0.18;
  vec3 col = vColor * (light + amb) + spec * 0.12;
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += (light + amb * 2.0) * rim * uRim;
  col += vColor * vEmi;
  col *= smoothstep(0.15, 0.7, fogAt(vPos.xy).x);
  gl_FragColor = vec4(col, 1.0);
}
`;

/** World-lit material for props and characters (baseline shading). */
export function litMaterial(u: WorldUniforms, opts: { wind?: number; ambient?: number; rim?: number; doubleSide?: boolean } = {}): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    vertexShader: LIT_VERT,
    fragmentShader: LIT_FRAG,
    uniforms: { ...u, uWind: { value: opts.wind ?? 0 }, uAmbient: { value: opts.ambient ?? 0.2 }, uRim: { value: opts.rim ?? 0.25 } },
    side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
  });
  if (opts.wind) m.defines = { WIND: 1 };
  return m;
}

/** Instanced meshes for all props, one material factory per kind of prop. */
export function buildProps(
  ctx: StyleContext,
  material: (type: number) => THREE.Material,
): THREE.Group {
  const g = new THREE.Group();
  const geos = buildPropGeometries();
  for (const p of collectProps(ctx.world)) {
    if (p.matrices.length === 0) continue;
    const mesh = new THREE.InstancedMesh(geos[p.type]!, material(p.type), p.matrices.length);
    p.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    p.colors.forEach((c, i) => mesh.setColorAt(i, c));
    mesh.frustumCulled = false;
    g.add(mesh);
  }
  return g;
}

export const WINDY = new Set<number>([PROP.GRASS, PROP.FLOWER, PROP.PINE, PROP.BIRCH, PROP.BUSH]);

/** Placeholder dwarves, standing in their tunnels at z = -0.45. */
export function buildMannequins(ctx: StyleContext, material: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  ctx.world.mannequins.forEach((m, i) => {
    const mesh = new THREE.Mesh(buildMannequin(m.pose, i + 3), material);
    mesh.position.set(m.x, m.y, m.y > -11 ? -1.2 : -0.45);
    mesh.rotation.y = m.facing > 0 ? 0.9 : -0.9;
    g.add(mesh);
  });
  return g;
}

/** Shared water/lava layer. */
export function buildFluids(ctx: StyleContext, u: WorldUniforms, material?: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(buildFluidGeometry(ctx.world), material ?? fluidMaterial(u));
  mesh.renderOrder = 2;
  return mesh;
}
