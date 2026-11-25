/**
 * Terrain rendering: chunk meshes + the procedural rock shader.
 *
 * All surface detail (strata, ore nuggets, crystal facets, magma cracks,
 * bricks, grass) is generated per pixel from the material table, with bump
 * mapping derived from the same height functions. Lighting comes from the
 * shared world light field (see glsl.ts).
 */
import * as THREE from 'three';
import { CONFIG } from '../config';
import type { World } from '../world/world';
import { GLSL_LIGHT, GLSL_NOISE } from './glsl';
import { buildTerrainChunk } from './terrainMesher';
import type { WorldTextures } from './worldTextures';

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

const FRAG = /* glsl */ `
uniform sampler2D uMatTex;
uniform sampler2D uStateTex;
uniform vec3 uCamPos;
uniform float uCutAmbient;
uniform float uInteriorAmbient;
${GLSL_NOISE}
${GLSL_LIGHT}
varying vec3 vPos;
varying vec3 vNormal;
flat varying float vMat;
flat varying float vFlags;
varying float vAo;

bool flag(float bit) { return mod(floor(vFlags / bit), 2.0) > 0.5; }

struct Surf {
  vec3 albedo;
  float height;
  float spec;
  float shin;
  vec3 emissive;
};

// Height-only evaluation (used three times for bump mapping).
float heightAt(int pat, vec2 uv, vec3 wp, vec4 p3) {
  float s = p3.x;
  float n1 = fbm3(uv * 2.0 * s);
  if (pat == 0 || pat == 10) {
    vec4 v = voronoi(uv * 3.2 * s);
    float peb = smoothstep(0.26, 0.1, v.x) * step(hash12(v.zw), p3.z * 0.55);
    return n1 * 0.5 + vnoise(uv * 14.0 * s) * 0.15 + peb * 0.45;
  } else if (pat == 1) {
    float t = wp.y * 0.55 * s + fbm3(vec2(wp.x * 0.08, wp.y * 0.3)) * 1.6;
    float b = fract(t);
    float edge = smoothstep(0.0, 0.05, b) * smoothstep(1.0, 0.95, b);
    return n1 * 0.4 + edge * 0.35 + vnoise(uv * 18.0) * 0.1;
  } else if (pat == 2) {
    vec4 v = voronoi(uv * 9.0 * s);
    return n1 * 0.45 + (v.y - v.x) * 0.25;
  } else if (pat == 3) {
    vec4 v = voronoi(uv * 2.6 * s);
    float cell = hash12(v.zw);
    float r = 0.16 + 0.2 * hash12(v.zw + 1.3);
    float nug = smoothstep(r, r - 0.08, v.x) * step(cell, 0.3 + p3.z * 0.55);
    return n1 * 0.35 + nug * (0.4 + (r - v.x) * 2.0);
  } else if (pat == 4) {
    vec4 v = voronoi(uv * 1.8 * s);
    float shard = smoothstep(0.55, 0.3, v.x) * step(hash12(v.zw), p3.z + 0.1);
    return n1 * 0.3 + shard * (0.7 - v.x) * 1.6;
  } else if (pat == 5) {
    vec4 v = voronoi(uv * 1.6 * s);
    float crack = smoothstep(0.12, 0.02, v.y - v.x);
    return n1 * 0.45 - crack * 0.5;
  } else if (pat == 6) {
    float row = floor(uv.y * 2.0);
    float bx = uv.x + mod(row, 2.0) * 0.5;
    float m = min(min(fract(bx), 1.0 - fract(bx)), min(fract(uv.y * 2.0), 1.0 - fract(uv.y * 2.0)) * 0.5);
    return n1 * 0.2 + smoothstep(0.02, 0.07, m) * 0.6;
  } else if (pat == 7) {
    vec4 v = voronoi(uv * 2.2 * s);
    return (v.y - v.x) * 0.6 + n1 * 0.2;
  } else if (pat == 8) {
    return vnoise(vec2(uv.x * 12.0, uv.y * 3.0) * s) * 0.35 + n1 * 0.3;
  } else {
    vec4 v = voronoi(uv * 1.5 * s);
    return (v.y - v.x) * 0.8 + n1 * 0.45;
  }
}

Surf surface(int pat, vec2 uv, vec3 wp, vec4 p0, vec4 p1, vec4 p2, vec4 p3) {
  Surf o;
  float s = p3.x;
  float n1 = fbm3(uv * 2.0 * s);
  float macro = vnoise(uv * 0.15 + 3.0);
  vec3 base = mix(p0.rgb, p1.rgb, smoothstep(0.2, 0.8, n1));
  base *= mix(1.0 - p3.w * 0.35, 1.0 + p3.w * 0.25, macro);
  o.albedo = base;
  o.spec = p1.a * 0.3;
  o.shin = 16.0;
  o.emissive = vec3(0.0);
  vec3 acc = p2.rgb;
  float emi = p2.a;
  if (pat == 0 || pat == 10) {
    float g = vnoise(uv * (pat == 10 ? 30.0 : 14.0) * s);
    o.albedo *= 0.82 + 0.34 * g;
    vec4 v = voronoi(uv * 3.2 * s);
    float peb = smoothstep(0.26, 0.1, v.x) * step(hash12(v.zw), p3.z * 0.55);
    o.albedo = mix(o.albedo, acc * (0.35 + 0.45 * hash12(v.zw + 3.0)), peb * 0.7);
  } else if (pat == 1) {
    float t = wp.y * 0.55 * s + fbm3(vec2(wp.x * 0.08, wp.y * 0.3)) * 1.6;
    float id = floor(t);
    float b = fract(t);
    float tone = hash12(vec2(id, 3.1));
    o.albedo = mix(p0.rgb, p1.rgb, tone * 0.7 + n1 * 0.3) * mix(1.0 - p3.w * 0.3, 1.0 + p3.w * 0.2, macro);
    if (hash12(vec2(id, 7.7)) < p3.z * 0.45) o.albedo = mix(o.albedo, acc, 0.55);
    float edge = smoothstep(0.0, 0.05, b) * smoothstep(1.0, 0.95, b);
    float fine = smoothstep(0.03, 0.0, abs(fract(t * 3.0 + n1) - 0.5) - 0.47);
    o.albedo *= mix(0.6, 1.0, edge) * (0.9 + 0.2 * vnoise(uv * 18.0)) * (1.0 - fine * 0.12);
  } else if (pat == 2) {
    vec4 v = voronoi(uv * 9.0 * s);
    float h = hash12(v.zw);
    if (h < p3.z * 0.3) { o.albedo = mix(o.albedo, acc, 0.75); o.spec += 0.3; }
    else if (h > 0.9) o.albedo *= 0.35;
    else o.albedo *= 0.85 + 0.3 * hash12(v.zw + 1.0);
  } else if (pat == 3) {
    o.albedo *= 0.85 + 0.3 * vnoise(uv * 16.0);
    vec4 v = voronoi(uv * 2.6 * s);
    float cell = hash12(v.zw);
    float r = 0.16 + 0.2 * hash12(v.zw + 1.3);
    float nug = smoothstep(r, r - 0.08, v.x) * step(cell, 0.3 + p3.z * 0.55);
    vec4 v2 = voronoi(uv * 7.0 * s + 5.0);
    float fleck = smoothstep(0.13, 0.05, v2.x) * step(hash12(v2.zw), p3.z * 0.6);
    float mask = max(nug, fleck * 0.85);
    vec3 oc = acc * (0.7 + 0.6 * vnoise(uv * 20.0));
    o.albedo = mix(o.albedo, oc, mask);
    o.spec = mix(o.spec, p1.a, mask);
    o.shin = mix(16.0, 70.0, mask);
    float tw = pow(hash12(floor(uv * 24.0) + floor(uTime * 3.0 + cell * 7.0)), 30.0);
    o.emissive = acc * mask * (emi * (0.75 + 0.25 * sin(uTime * 2.0 + cell * 30.0)) + tw * p1.a * 1.5);
  } else if (pat == 4) {
    vec4 v = voronoi(uv * 1.8 * s);
    float cell = hash12(v.zw);
    float shard = smoothstep(0.55, 0.3, v.x) * step(cell, p3.z + 0.1);
    float core = pow(clamp(1.0 - v.x / 0.55, 0.0, 1.0), 1.5);
    o.albedo = mix(o.albedo, acc * (0.35 + 0.65 * core), shard);
    o.spec = mix(o.spec, 1.0, shard);
    o.shin = mix(16.0, 90.0, shard);
    o.emissive = acc * emi * shard * (0.25 + 0.75 * core) * (0.8 + 0.2 * sin(uTime * 1.4 + cell * 20.0));
  } else if (pat == 5) {
    vec4 v = voronoi(uv * 1.6 * s + vec2(0.0, uTime * 0.015));
    float crack = smoothstep(0.12, 0.02, v.y - v.x);
    float glow = crack * (0.6 + 0.4 * sin(uTime * 1.3 + hash12(v.zw) * 6.28));
    o.albedo = mix(o.albedo, acc * 0.25, crack);
    o.emissive = acc * emi * glow;
  } else if (pat == 6) {
    float row = floor(uv.y * 2.0);
    float bx = uv.x + mod(row, 2.0) * 0.5;
    vec2 bid = vec2(floor(bx), row);
    float tone = hash12(bid);
    float m = min(min(fract(bx), 1.0 - fract(bx)), min(fract(uv.y * 2.0), 1.0 - fract(uv.y * 2.0)) * 0.5);
    float mortar = smoothstep(0.06, 0.025, m);
    o.albedo = mix(p0.rgb, p1.rgb, tone) * (0.85 + 0.3 * n1);
    o.albedo *= mix(1.0, 0.4, mortar);
    if (hash12(bid + 7.0) < p3.z) {
      vec2 l = vec2(fract(bx), fract(uv.y * 2.0));
      float rune = abs(sin(l.x * 9.0 + tone * 20.0) * sin(l.y * 7.0 + tone * 13.0));
      float rm = smoothstep(0.86, 0.97, rune) * (1.0 - mortar);
      o.emissive = acc * emi * rm * (0.6 + 0.4 * sin(uTime * 0.8 + tone * 10.0));
    }
  } else if (pat == 7) {
    vec4 v = voronoi(uv * 2.2 * s);
    float f = hash12(v.zw);
    o.albedo = mix(p0.rgb, p1.rgb, f * 0.6 + n1 * 0.4);
    o.spec = p1.a;
    o.shin = 90.0;
  } else if (pat == 8) {
    float f = vnoise(vec2(uv.x * 12.0, uv.y * 3.0) * s);
    o.albedo *= 0.75 + 0.5 * f;
    vec4 v = voronoi(uv * 4.0 * s);
    float spot = smoothstep(0.13, 0.0, v.x) * step(hash12(v.zw), p3.z);
    o.albedo = mix(o.albedo, acc, spot * 0.6);
    o.emissive = acc * emi * spot * (0.5 + 0.5 * sin(uTime * 2.0 + hash12(v.zw) * 20.0));
  } else {
    vec4 v = voronoi(uv * 1.5 * s);
    o.albedo = mix(p0.rgb, p1.rgb, hash12(v.zw)) * (0.7 + 0.3 * n1);
    float vein = smoothstep(0.06, 0.0, v.y - v.x);
    o.albedo = mix(o.albedo, acc, vein * 0.5);
  }
  return o;
}

void main() {
  int m = int(vMat + 0.5);
  vec4 p0 = texelFetch(uMatTex, ivec2(0, m), 0);
  vec4 p1 = texelFetch(uMatTex, ivec2(1, m), 0);
  vec4 p2 = texelFetch(uMatTex, ivec2(2, m), 0);
  vec4 p3 = texelFetch(uMatTex, ivec2(3, m), 0);
  int pat = int(p0.a + 0.5);
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
  ivec2 ot = ivec2(floor(owner.x), int(floor(-owner.y)));
  vec4 st = texelFetch(uStateTex, ot, 0);
  float dmg = st.r;
  float desig = st.g * 255.0;

  if (dmg > 0.0 && !interior || dmg > 0.0 && !cap) {
    vec4 cv = voronoi(uv * 3.3 + 11.0);
    float show = step(hash12(cv.zw), dmg * 1.3);
    float crack = smoothstep(0.05 + 0.07 * dmg, 0.0, cv.y - cv.x) * show;
    sf.albedo *= 1.0 - crack * 0.85;
    Np = normalize(Np + vec3(hash22(cv.zw) - 0.5, 0.0) * crack * 0.6);
  }

  vec3 V = normalize(uCamPos - wp);
  vec2 sp = cap ? wp.xy : wp.xy + N.xy * 0.5;
  vec3 spec;
  float sunMix = outdoor ? 1.0 : (grassy ? 0.7 : 0.0);
  vec3 light = worldLight(wp, Np, sp, V, sf.shin, sunMix, spec);
  vec3 tint = rowTint(wp.y);
  vec3 amb = tint * (interior ? uInteriorAmbient : uCutAmbient);
  if (outdoor) amb += uSkyLight * 0.12;

  vec3 col = sf.albedo * (light + amb) * vAo + spec * sf.spec * 0.6 + sf.emissive;
  if (cap && !interior && !unexplored) {
    // carved edge: the cut plane catches a little light where it meets a hollow
    float occ = fogAt(wp.xy).y;
    float rim = smoothstep(0.86, 0.6, occ);
    col = col * (1.0 + rim * 0.6) + sf.albedo * light * rim * 0.8 + sf.albedo * tint * rim * 0.12;
  }

  if (desig > 0.5) {
    vec2 lt = fract(vec2(owner.x, -owner.y));
    float e = min(min(lt.x, 1.0 - lt.x), min(lt.y, 1.0 - lt.y));
    float outline = smoothstep(0.07, 0.035, e);
    float stripe = step(0.55, fract((wp.x + wp.y) * 2.2 + uTime * 0.4));
    vec3 dc = desig > 1.5 ? vec3(0.35, 0.85, 1.0) : vec3(1.0, 0.62, 0.16);
    col = mix(col, col * 0.6 + dc * 0.25, stripe * 0.5);
    col += dc * (outline * 0.9 + stripe * 0.06);
  }

  // Fog of war: unknown rock stays readable but dim and desaturated.
  float explored = fogAt(owner).x;
  float g = lum(col);
  col = mix(mix(vec3(g), col, 0.5) * 0.42, col, explored);

  gl_FragColor = vec4(col, 1.0);
}
`;

export class TerrainView {
  readonly group = new THREE.Group();
  readonly material: THREE.ShaderMaterial;
  private meshes: (THREE.Mesh | null)[];
  lastBuildMs = 0;

  constructor(
    private world: World,
    textures: WorldTextures,
  ) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        ...textures.uniforms,
        uCutAmbient: { value: 0.13 },
        uInteriorAmbient: { value: 0.2 },
      },
    });
    this.meshes = new Array(world.chunksW * world.chunksH).fill(null);
    this.group.name = 'terrain';
    this.group.add(this.buildBackstop());
  }

  /**
   * A dark curtain behind the underground part of the slab so that tiny
   * cracks between jittered faces never reveal the sky dome.
   */
  private buildBackstop(): THREE.Mesh {
    const { w, h, surface } = this.world;
    const pos: number[] = [];
    const idx: number[] = [];
    const z = -6;
    for (let x = 0; x <= w; x++) {
      const s = Math.max(surface[Math.max(0, x - 1)]!, surface[Math.min(w - 1, x)]!);
      pos.push(x, -(s + 1.5), z, x, -h - 2, z);
    }
    for (let x = 0; x < w; x++) {
      const a = x * 2;
      idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x030202, side: THREE.DoubleSide }));
    mesh.name = 'backstop';
    return mesh;
  }

  /** Rebuild dirty chunks, nearest to the focus first, within a time budget. */
  update(focusX: number, focusY: number, budgetMs: number): void {
    const dirty = this.world.dirtyChunks;
    if (dirty.size === 0) return;
    const t0 = performance.now();
    const CS = CONFIG.chunk;
    const list = [...dirty];
    const fx = focusX / CS;
    const fy = -focusY / CS;
    list.sort((a, b) => {
      const ax = (a % this.world.chunksW) + 0.5 - fx;
      const ay = Math.floor(a / this.world.chunksW) + 0.5 - fy;
      const bx = (b % this.world.chunksW) + 0.5 - fx;
      const by = Math.floor(b / this.world.chunksW) + 0.5 - fy;
      return ax * ax + ay * ay - (bx * bx + by * by);
    });
    for (const c of list) {
      this.buildChunk(c);
      dirty.delete(c);
      if (performance.now() - t0 > budgetMs) break;
    }
    this.lastBuildMs = performance.now() - t0;
  }

  buildAll(): void {
    for (const c of [...this.world.dirtyChunks]) {
      this.buildChunk(c);
      this.world.dirtyChunks.delete(c);
    }
  }

  private buildChunk(c: number): void {
    const cx = c % this.world.chunksW;
    const cy = Math.floor(c / this.world.chunksW);
    const data = buildTerrainChunk(this.world, cx, cy);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(data.position, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(data.normal, 3));
    geo.setAttribute('aMatFlags', new THREE.BufferAttribute(data.matFlags, 1));
    geo.setAttribute('aAo', new THREE.BufferAttribute(data.ao, 1));
    geo.setIndex(new THREE.BufferAttribute(data.index, 1));
    const CS = CONFIG.chunk;
    geo.boundingBox = new THREE.Box3(
      new THREE.Vector3(cx * CS - 1, -(cy + 1) * CS - 1, -CONFIG.slabDepth - 1),
      new THREE.Vector3((cx + 1) * CS + 1, -cy * CS + 1, 1),
    );
    geo.boundingSphere = geo.boundingBox.getBoundingSphere(new THREE.Sphere());
    const old = this.meshes[c];
    if (old) {
      old.geometry.dispose();
      old.geometry = geo;
    } else {
      const mesh = new THREE.Mesh(geo, this.material);
      mesh.matrixAutoUpdate = false;
      mesh.name = `chunk_${cx}_${cy}`;
      this.meshes[c] = mesh;
      this.group.add(mesh);
    }
  }
}
