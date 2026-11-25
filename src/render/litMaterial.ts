/**
 * Generic world-lit material for props, creatures, buildings and items.
 * Vertex colours carry albedo; the `aEmissive` attribute marks glowing parts.
 * Lighting is sampled from the shared world light field so everything in a
 * tunnel picks up the same torchlight as the rock around it.
 */
import * as THREE from 'three';
import { GLSL_LIGHT, GLSL_NOISE } from './glsl';
import type { WorldTextures } from './worldTextures';

const VERT = /* glsl */ `
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
    float h = max(position.y, 0.0);
    float ph = wp.x * 0.7 + wp.z * 0.4;
    wp.x += (sin(uTime * 1.6 + ph) * 0.6 + sin(uTime * 3.7 + ph * 2.0) * 0.25) * h * h * uWind;
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

const FRAG = /* glsl */ `
uniform vec3 uCamPos;
uniform float uAmbient;
uniform float uEmissiveBoost;
uniform float uOpacity;
uniform float uRim;
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
  vec2 sp = vPos.xy;
  float skyHere = lightAt(sp).a;
  float sunMix = smoothstep(0.55, 0.95, skyHere);
  vec3 spec;
  vec3 light = worldLight(vPos, N, sp, V, 24.0, sunMix, spec);
  vec3 amb = rowTint(vPos.y) * uAmbient + uSkyLight * skyHere * 0.18;
  vec3 col = vColor * (light + amb) + spec * 0.12;
  // readable silhouettes in the dark: a faint rim from the light field
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += (light + amb * 2.0) * rim * uRim;
  col += vColor * vEmi * uEmissiveBoost;
  float explored = fogAt(vPos.xy).x;
  col *= smoothstep(0.15, 0.7, explored);
  gl_FragColor = vec4(col, uOpacity);
}
`;

export interface LitOptions {
  wind?: number;
  ambient?: number;
  emissiveBoost?: number;
  rim?: number;
  transparent?: boolean;
  doubleSide?: boolean;
}

export function createLitMaterial(textures: WorldTextures, opts: LitOptions = {}): THREE.ShaderMaterial {
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      ...textures.uniforms,
      uWind: { value: opts.wind ?? 0 },
      uAmbient: { value: opts.ambient ?? 0.22 },
      uEmissiveBoost: { value: opts.emissiveBoost ?? 1 },
      uOpacity: { value: 1 },
      uRim: { value: opts.rim ?? 0.25 },
    },
    transparent: opts.transparent ?? false,
    side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
  });
  if (opts.wind) mat.defines = { WIND: 1 };
  return mat;
}

// ------------------------------------------------------------------ geometry
// Helpers to build small vertex-coloured low-poly meshes procedurally.

export class GeoBuilder {
  private parts: THREE.BufferGeometry[] = [];

  add(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, emissive = 0, matrix?: THREE.Matrix4): this {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    const n = g.attributes.position!.count;
    const c = new THREE.Color(color);
    const cols = new Float32Array(n * 3);
    const emi = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      cols[i * 3] = c.r;
      cols[i * 3 + 1] = c.g;
      cols[i * 3 + 2] = c.b;
      emi[i] = emissive;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.setAttribute('aEmissive', new THREE.BufferAttribute(emi, 1));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'aEmissive'].includes(k)) g.deleteAttribute(k);
    this.parts.push(g);
    return this;
  }

  build(): THREE.BufferGeometry {
    const out = mergeGeometries(this.parts);
    out.computeBoundingSphere();
    return out;
  }
}

/** Merge non-indexed geometries with identical attribute layouts. */
export function mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const names = ['position', 'normal', 'color', 'aEmissive'];
  const out = new THREE.BufferGeometry();
  for (const name of names) {
    const item = geos[0]!.attributes[name]!.itemSize;
    let total = 0;
    for (const g of geos) total += g.attributes[name]!.count * item;
    const arr = new Float32Array(total);
    let o = 0;
    for (const g of geos) {
      const a = g.attributes[name]!.array as Float32Array;
      arr.set(a, o);
      o += a.length;
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, item));
  }
  return out;
}

export const M4 = {
  t(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): THREE.Matrix4 {
    const m = new THREE.Matrix4();
    m.compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(sx, sy, sz),
    );
    return m;
  },
};

/** Randomly displace vertices for a rough, hand-made look (keeps shading flat). */
export function roughen(geo: THREE.BufferGeometry, amount: number, seed = 1): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position!;
  const key = (x: number, y: number, z: number) => `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
  const off = new Map<string, [number, number, number]>();
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647 - 0.5;
  };
  for (let i = 0; i < p.count; i++) {
    const k = key(p.getX(i), p.getY(i), p.getZ(i));
    let o = off.get(k);
    if (!o) {
      o = [rnd() * amount, rnd() * amount, rnd() * amount];
      off.set(k, o);
    }
    p.setXYZ(i, p.getX(i) + o[0], p.getY(i) + o[1], p.getZ(i) + o[2]);
  }
  g.computeVertexNormals();
  return g;
}
