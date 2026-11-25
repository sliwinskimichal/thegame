/**
 * Sky dome with day/night cycle, sun, moon, stars and drifting clouds, plus a
 * distant landscape that continues the surface behind the cut-away slab.
 */
import * as THREE from 'three';
import { CONFIG } from '../config';
import { Noise2D } from '../core/noise';
import type { World } from '../world/world';
import { GLSL_NOISE } from './shaderlib';
import type { DaylightState } from './daylight';

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vDir = wp.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * wp;
  gl_Position.z = gl_Position.w; // far plane
}
`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
uniform float uNight;
uniform float uTime;
varying vec3 vDir;
${GLSL_NOISE}
void main() {
  vec3 d = normalize(vDir);
  float el = d.y;
  vec3 col = mix(uHorizon, uZenith, pow(clamp(el * 1.3 + 0.08, 0.0, 1.0), 0.55));
  // below the horizon fade into a hazy dark ground tone
  col = mix(col, uHorizon * 0.55, smoothstep(0.02, -0.25, el));
  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunColor * (pow(sd, 900.0) * 30.0 + pow(sd, 18.0) * 0.45 + pow(sd, 3.0) * 0.12);
  vec3 md = normalize(-uSunDir + vec3(0.25, 0.0, 0.0));
  float mdot = max(dot(d, md), 0.0);
  col += vec3(0.75, 0.82, 1.0) * uNight * (smoothstep(0.9993, 0.9996, mdot) * 3.0 + pow(mdot, 60.0) * 0.08);
  // stars
  if (uNight > 0.01 && el > 0.0) {
    vec2 sp = d.xz / (d.y + 0.35) * 70.0;
    vec2 id = floor(sp);
    float h = hash12(id);
    vec2 c = hash22(id) - 0.5;
    float star = smoothstep(0.06, 0.0, length(fract(sp) - 0.5 - c * 0.6)) * step(0.965, h);
    star *= 0.6 + 0.4 * sin(uTime * (2.0 + h * 5.0) + h * 40.0);
    col += vec3(0.85, 0.9, 1.0) * star * uNight * 2.2 * smoothstep(0.0, 0.25, el);
  }
  // clouds
  if (el > 0.0) {
    vec2 cp = d.xz / (d.y + 0.12) * 1.6 + vec2(uTime * 0.008, 0.0);
    float c = fbm4(cp);
    float cov = smoothstep(0.52, 0.78, c) * smoothstep(0.0, 0.2, el);
    vec3 cc = mix(uHorizon * 1.1, vec3(1.0), 0.6) * (1.0 - uNight * 0.85) + uSunColor * pow(sd, 6.0) * 0.6;
    col = mix(col, cc, cov * 0.75);
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

const LAND_VERT = /* glsl */ `
attribute vec3 color;
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vPos;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  #ifdef USE_INSTANCING
    wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  #endif
  vPos = wp.xyz;
  vColor = color;
  #ifdef USE_INSTANCING
    vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  #else
    vNormal = normalize(mat3(modelMatrix) * normal);
  #endif
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const LAND_FRAG = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uAmbient;
uniform vec3 uHorizon;
uniform float uSlab;
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vPos;
${GLSL_NOISE}
void main() {
  vec3 n = normalize(vNormal);
  float ndl = max(dot(n, uSunDir), 0.0);
  float g = vnoise(vPos.xz * 0.8) * 0.15 + 0.92;
  vec3 col = vColor * g * (uAmbient + uSunColor * ndl);
  float dist = max(0.0, -vPos.z - uSlab);
  float fog = 1.0 - exp(-dist * 0.0065);
  col = mix(col, uHorizon * 0.9, clamp(fog, 0.0, 0.85));
  gl_FragColor = vec4(col, 1.0);
}
`;

export class SkyView {
  readonly group = new THREE.Group();
  readonly skyMat: THREE.ShaderMaterial;
  readonly landMat: THREE.ShaderMaterial;
  private dome: THREE.Mesh;
  readonly sunDir = new THREE.Vector3();
  readonly sunColor = new THREE.Color();
  readonly skyLight = new THREE.Color();
  daylight = 1;

  constructor(world: World) {
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uSunDir: { value: this.sunDir },
        uZenith: { value: new THREE.Color() },
        uHorizon: { value: new THREE.Color() },
        uSunColor: { value: this.sunColor },
        uNight: { value: 0 },
        uTime: { value: 0 },
      },
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), this.skyMat);
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    this.group.add(this.dome);

    this.landMat = new THREE.ShaderMaterial({
      vertexShader: LAND_VERT,
      fragmentShader: LAND_FRAG,
      uniforms: {
        uSunDir: { value: this.sunDir },
        uSunColor: { value: this.sunColor },
        uAmbient: { value: new THREE.Color() },
        uHorizon: this.skyMat.uniforms.uHorizon!,
        uSlab: { value: CONFIG.groundDepth },
      },
    });
    this.buildLand(world);
  }

  private buildLand(world: World): void {
    const noise = new Noise2D(world.seed ^ 0xf00d);
    const SLAB = CONFIG.groundDepth;
    const W = world.w;
    const xMin = -260;
    const xMax = W + 260;
    const zNear = -SLAB + 0.4;
    const zFar = -420;
    const nx = 220;
    const nz = 90;
    const colAt = (x: number) => Math.max(0, Math.min(W - 1, Math.floor(x)));
    /** Smoothed surface height (world Y) around x. */
    const surf = (x: number): number => {
      const xi = colAt(x);
      let s = 0;
      for (let k = -3; k <= 3; k++) s += world.surface[colAt(xi + k)]!;
      let y = -(s / 7);
      if (x < 0 || x > W) y += noise.fbm(x * 0.01, 3.3, 3) * 14;
      return y;
    };
    /** Lowest ground near x, so the land never pokes through the slab. */
    const low = (x: number): number => {
      const xi = colAt(x);
      let m = 0;
      for (let k = -1; k <= 1; k++) m = Math.max(m, world.surface[colAt(xi + k)]!);
      return -m;
    };
    const pos: number[] = [];
    const col: number[] = [];
    const grass = new THREE.Color(0x3b5a1e);
    const dry = new THREE.Color(0x6d6a3a);
    const rock = new THREE.Color(0x77706a);
    const snow = new THREE.Color(0xe8eef5);
    const heightAt = (x: number, z: number): number => {
      const t = (zNear - z) / (zNear - zFar); // 0 near .. 1 far
      const near = THREE.MathUtils.smoothstep(t, 0, 0.04);
      const base = THREE.MathUtils.lerp(low(x) - 0.15, surf(x) - 0.2, near) - t * 4;
      const hills = noise.fbm(x * 0.012, z * 0.012, 4) * (3 + t * 34) * near;
      const m = Math.max(0, noise.fbm(x * 0.0045 + 10, z * 0.006, 4) * 0.5 + 0.5);
      const mountains = Math.pow(m, 1.6) * THREE.MathUtils.smoothstep(t, 0.18, 0.7) * 150;
      return base + hills + mountains;
    };
    for (let j = 0; j <= nz; j++) {
      const tz = Math.pow(j / nz, 1.7);
      const z = zNear + (zFar - zNear) * tz;
      for (let i = 0; i <= nx; i++) {
        const x = xMin + ((xMax - xMin) * i) / nx;
        const y = heightAt(x, z);
        pos.push(x, y, z);
        const hRel = y - surf(x);
        const c = grass.clone().lerp(dry, Math.max(0, Math.min(1, noise.fbm(x * 0.02, z * 0.02, 2) + 0.3)));
        if (hRel > 30) c.lerp(rock, Math.min(1, (hRel - 30) / 30));
        if (hRel > 85) c.lerp(snow, Math.min(1, (hRel - 85) / 25));
        col.push(c.r, c.g, c.b);
      }
    }
    const idx: number[] = [];
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i;
        const b = a + 1;
        const c = a + nx + 1;
        const d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const land = new THREE.Mesh(geo, this.landMat);
    land.renderOrder = -5;
    this.group.add(land);

    // Distant forest: simple instanced cones.
    const coneGeo = new THREE.ConeGeometry(1, 3.2, 6, 1);
    coneGeo.translate(0, 1.6, 0);
    const cc: number[] = [];
    const cnt = coneGeo.attributes.position!.count;
    const tc = new THREE.Color(0x1f3a1a);
    for (let i = 0; i < cnt; i++) cc.push(tc.r, tc.g, tc.b);
    coneGeo.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
    const N = 900;
    let seedR = 12345;
    const rnd = () => ((seedR = (seedR * 16807) % 2147483647) / 2147483647);
    const trees = new THREE.InstancedMesh(coneGeo, this.landMat, N);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    let k = 0;
    let tries = 0;
    while (k < N && tries < N * 10) {
      tries++;
      const x = xMin + rnd() * (xMax - xMin);
      const tz = Math.pow(rnd(), 1.6) * 0.45;
      const z = zNear - 4 + (zFar - zNear) * tz;
      if (noise.fbm(x * 0.02 + 40, z * 0.02, 2) < -0.05) continue;
      const y = heightAt(x, z);
      if (y - surf(x) > 26) continue;
      const sc = 0.6 + rnd() * 0.9 + tz * 2;
      p.set(x, y - 0.2, z);
      s.set(sc, sc * (0.8 + rnd() * 0.6), sc);
      m.compose(p, q, s);
      trees.setMatrixAt(k++, m);
    }
    trees.count = k;
    trees.renderOrder = -4;
    this.group.add(trees);
  }

  /** Apply a daylight state (see daylight.ts). */
  update(d: DaylightState, time: number, camPos: THREE.Vector3): void {
    this.dome.position.copy(camPos);
    this.sunDir.copy(d.sunDir);
    this.sunColor.copy(d.sunColor);
    this.skyLight.copy(d.skyLight);
    this.daylight = d.daylight;
    const u = this.skyMat.uniforms;
    (u.uZenith!.value as THREE.Color).copy(d.zenith);
    (u.uHorizon!.value as THREE.Color).copy(d.horizon);
    u.uNight!.value = d.night;
    u.uTime!.value = time;
    (this.landMat.uniforms.uAmbient!.value as THREE.Color).copy(d.ambient);
  }
}
