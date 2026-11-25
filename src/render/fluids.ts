/**
 * Shared fluid layer: water and lava bodies rendered as a front sheet in the
 * cut plane (slightly behind it) plus a surface strip where the fluid meets
 * air. Styles may replace the material but reuse the geometry.
 */
import * as THREE from 'three';
import type { World } from '../world/world';
import { GLSL_LIGHT, GLSL_NOISE } from './shaderlib';
import { GLSL_WORLD } from './worldTex';

/** Geometry: attribute aKind (1 water, 2 lava), aSurf (1 = top surface tile). */
export function buildFluidGeometry(world: World): THREE.BufferGeometry {
  const pos: number[] = [];
  const kind: number[] = [];
  const surf: number[] = [];
  const idx: number[] = [];
  let n = 0;
  for (let y = 0; y < world.h; y++)
    for (let x = 0; x < world.w; x++) {
      const i = world.idx(x, y);
      const k = world.fluidKind[i]!;
      if (!k || !world.fluid[i]) continue;
      const above = y > 0 ? world.fluidKind[i - world.w]! : 0;
      const top = above !== k;
      const yTop = top ? -y - 0.12 : -y;
      const z = -0.04;
      pos.push(x, -y - 1, z, x + 1, -y - 1, z, x + 1, yTop, z, x, yTop, z);
      for (let q = 0; q < 4; q++) {
        kind.push(k);
        surf.push(top ? (q >= 2 ? 1 : 0) : 0);
      }
      idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
      n += 4;
      if (top) {
        // horizontal surface strip from the cut plane back into the cavity
        const d = -(world.depth[i]! / 32);
        pos.push(x, yTop, z, x + 1, yTop, z, x + 1, yTop, d, x, yTop, d);
        for (let q = 0; q < 4; q++) {
          kind.push(k);
          surf.push(2);
        }
        idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
        n += 4;
      }
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
  g.setAttribute('aSurf', new THREE.Float32BufferAttribute(surf, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

const VERT = /* glsl */ `
attribute float aKind;
attribute float aSurf;
varying vec3 vPos;
varying float vKind;
varying float vSurf;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPos = wp.xyz;
  vKind = aKind;
  vSurf = aSurf;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */ `
uniform vec3 uCamPos;
${GLSL_WORLD}
${GLSL_NOISE}
${GLSL_LIGHT}
varying vec3 vPos;
varying float vKind;
varying float vSurf;
void main() {
  vec2 p = vPos.xy;
  if (vKind < 1.5) {
    // water: deep blue body, caustics, bright surface line
    vec3 spec;
    vec3 L = worldLight(vPos, vec3(0.0, 0.0, 1.0), p, normalize(uCamPos - vPos), 40.0, 0.0, spec);
    float caust = pow(vnoise(p * 3.0 + vec2(uTime * 0.4, uTime * 0.25)) * vnoise(p * 4.3 - uTime * 0.3), 1.5);
    vec3 deep = vec3(0.02, 0.07, 0.14);
    vec3 col = deep + vec3(0.05, 0.2, 0.32) * (L + 0.06) + vec3(0.25, 0.55, 0.7) * caust * (L + 0.08) * 0.8;
    float line = vSurf > 0.5 && vSurf < 1.5 ? 1.0 : 0.0;
    col += vec3(0.5, 0.8, 1.0) * (L + 0.15) * line * 0.6;
    if (vSurf > 1.5) col = vec3(0.12, 0.3, 0.42) * (L + 0.1) + spec * 0.6;
    gl_FragColor = vec4(col, vSurf > 1.5 ? 0.8 : 0.72);
  } else {
    // lava: emissive flowing crust
    float f = fbm3(p * 1.3 + vec2(uTime * 0.07, -uTime * 0.03));
    float crust = smoothstep(0.55, 0.75, fbm3(p * 2.1 - vec2(uTime * 0.05, 0.0)));
    vec3 hot = mix(vec3(1.5, 0.38, 0.05), vec3(2.3, 0.95, 0.2), f);
    vec3 col = mix(hot, vec3(0.06, 0.025, 0.02), crust * 0.9);
    if (vSurf > 1.5) col *= 0.7;
    gl_FragColor = vec4(col, 1.0);
  }
}
`;

export function fluidMaterial(uniforms: Record<string, THREE.IUniform>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
