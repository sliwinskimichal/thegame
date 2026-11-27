/**
 * Illustrated ("ink") rendering helpers for the 2.5D cross-section
 * (tournament #3, docs/variants/03-illustrated-style.md).
 *
 *  - GLSL_INK: ink lines with a constant on-screen width, soft light bands,
 *    hatching and halftone with zoom LOD (octave cross-fade keeps the mark
 *    density constant in pixels), brush strokes and paper grain in world space,
 *    exact distance to the rock/void boundary from the mesher's aEdge attribute.
 *  - inkHullMaterial(): back-face hull outline with a constant pixel width
 *    (props, characters).
 *  - DepthInkPass: post-process outline from the depth buffer (Laplacian +
 *    max-jump, wobbled sample positions).
 *
 * Every function is branch-light and allocation-free; all widths are given in
 * pixels and converted with worldPerPixel(), so lines stay crisp at any zoom.
 */
import * as THREE from 'three';
import { FullScreenQuad, Pass } from 'three/addons/postprocessing/Pass.js';
import { GLSL_NOISE } from './shaderlib';

/** Requires GLSL_NOISE. Declares uPxScale (world units per pixel at unit view depth). */
export const GLSL_INK = /* glsl */ `
uniform float uPxScale;

// World units covered by one screen pixel at p (the camera looks along -z).
float worldPerPixel(vec3 p, vec3 cam) { return max(cam.z - p.z, 0.5) * uPxScale; }

// Coverage of a line of half-width w around d = 0 (d, w, aa in the same units).
float inkLine(float d, float w, float aa) { return 1.0 - smoothstep(w - aa, w + aa, d); }

// Light quantised to n bands (n = 0: smooth); s = softness of band edges (0 hard .. 0.5).
float lightBands(float l, float n, float s) {
  if (n < 0.5) return l;
  float x = l * n;
  float i = floor(x);
  return (i + smoothstep(0.5 - s, 0.5 + s, x - i)) / n;
}

// Parallel hatch lines along dir; spacing ~spacingPx and width widthPx on screen at any zoom.
// Octaves are powers of two and the coarser one is a subset of the finer, so the cross-fade never pops.
float hatchLines(vec2 p, vec2 dir, float wpp, float spacingPx, float widthPx, float wob) {
  float lv = log2(spacingPx * wpp);
  float l0 = floor(lv);
  float f = lv - l0;
  float s0 = exp2(l0);
  float t = dot(p, dir) + wob * s0 * 0.18;
  float d0 = (0.5 - abs(fract(t / s0) - 0.5)) * s0;
  float d1 = (0.5 - abs(fract(t / (2.0 * s0)) - 0.5)) * 2.0 * s0;
  float w = widthPx * wpp * 0.5;
  float aa = wpp * 0.6;
  return mix(inkLine(d0, w, aa), inkLine(d1, w, aa), f);
}

// Halftone dots on a 45 degree grid; amount 0..1 sets the dot area.
float halftoneDots(vec2 p, float wpp, float spacingPx, float amount) {
  float lv = log2(spacingPx * wpp);
  float l0 = floor(lv);
  float f = lv - l0;
  vec2 q = vec2(p.x + p.y, p.y - p.x) * 0.70711;
  float s0 = exp2(l0);
  float s1 = s0 * 2.0;
  vec2 c0 = (q / s0 - floor(q / s0 + 0.5)) * s0;
  vec2 c1 = (q / s1 - floor(q / s1 + 0.5)) * s1;
  float r = sqrt(clamp(amount, 0.0, 1.0)) * 0.62;
  float aa = wpp * 0.7;
  float d0 = 1.0 - smoothstep(r * s0 - aa, r * s0 + aa, length(c0));
  float d1 = 1.0 - smoothstep(r * s1 - aa, r * s1 + aa, length(c1));
  return mix(d0, d1, f);
}

// Brush texture in world space: long smudges along the stroke angle, bristle streaks (faded by lod) and
// dry-brush gaps. Returns roughly -1..1.
float brushStrokes(vec2 p, float angle, float scale, float lod) {
  float c = cos(angle);
  float s = sin(angle);
  vec2 q = vec2(c * p.x + s * p.y, -s * p.x + c * p.y) * scale;
  float stroke = vnoise(vec2(q.x * 0.45, q.y * 2.4));
  float streak = vnoise(vec2(q.x * 1.3, q.y * 13.0)) - 0.5;
  float dry = smoothstep(0.6, 0.82, vnoise(vec2(q.x * 0.7, q.y * 4.5) + 7.0));
  return (stroke - 0.5) * 1.5 + streak * 0.7 * lod - dry * 0.45;
}

// Paper / canvas grain in world space (fine tooth faded out when it would alias).
float paperGrain(vec2 p, float wpp) {
  float fine = (vnoise(p * 31.0) - 0.5) * (1.0 - smoothstep(0.012, 0.035, wpp));
  float fiber = vnoise(vec2(p.x * 7.0, p.y * 2.2) + 11.0) - 0.5;
  float blot = vnoise(p * 0.9 + 3.0) - 0.5;
  return fine * 0.7 + fiber * 0.35 + blot * 0.35;
}

// Distance (tiles) from a point of a cap quad to the rock/void boundary of its tile.
// e = tile-local (u, v) in 0..1 (v grows downwards), mask = neighbours that differ in solidity
// (L 1, R 2, T 4, B 8, TL 16, TR 32, BL 64, BR 128); convex corners are rounded with radius r.
float edgeDistance(vec2 e, int mask, float r) {
  float dx = 1e3;
  float dy = 1e3;
  if ((mask & 1) != 0) dx = e.x;
  if ((mask & 2) != 0) dx = min(dx, 1.0 - e.x);
  if ((mask & 4) != 0) dy = e.y;
  if ((mask & 8) != 0) dy = min(dy, 1.0 - e.y);
  float d = (dx < r && dy < r) ? r - length(vec2(r - dx, r - dy)) : min(dx, dy);
  if ((mask & 16) != 0) d = min(d, length(e));
  if ((mask & 32) != 0) d = min(d, length(vec2(1.0 - e.x, e.y)));
  if ((mask & 64) != 0) d = min(d, length(vec2(e.x, 1.0 - e.y)));
  if ((mask & 128) != 0) d = min(d, length(1.0 - e));
  return d;
}
`;

/**
 * Drawn rock structure in the language of old mining atlases (requires GLSL_NOISE, GLSL_INK):
 *  layered rock (pattern 1): bedding planes of the palette's strata, joints per bed, fine lamination;
 *  masonry (6): mortar joints; loose ground (0, 10): stipple and outlined pebbles;
 *  everything else (massive rock, ore matrix, gems): polygonal joint blocks, a crack stroke in some.
 * Line widths are world units derived from pixels by the caller (w, aa), and every family fades or
 * switches octave before its marks get closer than ~10-22 px on screen.
 */
export const GLSL_ROCK_INK = /* glsl */ `
struct RockInk { float lines; float fine; float cell; float bev; };

RockInk rockInk(int pat, vec2 p, float sc, float wpp, float scale, float w, float aa) {
  RockInk r;
  r.lines = 0.0;
  r.fine = 0.0;
  r.cell = 0.5;
  r.bev = 0.0;
  float ppt = 1.0 / wpp;
  if (pat == 1) {
    float k = 0.55 * sc;
    float t = p.y * k + fbm3(vec2(p.x * 0.08, p.y * 0.3)) * 1.6;
    float id = floor(t);
    float b = fract(t);
    float bedH = 1.0 / k;
    float bedLod = smoothstep(9.0, 20.0, bedH * ppt);
    float lj = scale * (1.1 + 1.5 * hash12(vec2(id, 1.3)));
    lj *= exp2(max(0.0, ceil(log2(18.0 * wpp / lj))));
    float xj = (p.x + hash12(vec2(id, 4.1)) * lj) / lj + (b - 0.5) * (hash12(vec2(id, 6.7)) - 0.5) * 0.5;
    float c = floor(xj);
    float fj = fract(xj);
    float jb = fj < 0.5 ? c : c + 1.0;
    float joint = hash12(vec2(id, jb) + 0.5) < 0.8 ? inkLine(min(fj, 1.0 - fj) * lj, w, aa) : 0.0;
    r.lines = max(inkLine(min(b, 1.0 - b) * bedH, w, aa), joint) * bedLod;
    float t3 = fract(t * 3.0);
    r.fine = inkLine(min(t3, 1.0 - t3) * bedH / 3.0, w * 0.6, aa) * step(hash12(vec2(id, 9.2)), 0.75) * smoothstep(9.0, 20.0, bedH / 3.0 * ppt);
    r.cell = hash12(vec2(id, c));
    r.bev = smoothstep(0.72, 1.0, b) - smoothstep(0.28, 0.0, b);
  } else if (pat == 6) {
    float row = floor(p.y * 2.0);
    float bx = p.x + mod(row, 2.0) * 0.5;
    float fy = fract(p.y * 2.0);
    float dm = min(min(fract(bx), 1.0 - fract(bx)), min(fy, 1.0 - fy) * 0.5);
    r.lines = inkLine(dm, w * 0.8, aa) * smoothstep(8.0, 16.0, 0.5 * ppt);
    r.cell = hash12(vec2(floor(bx), row));
    r.bev = smoothstep(0.7, 1.0, fy) - smoothstep(0.3, 0.0, fy);
  } else if (pat == 0 || pat == 10) {
    float gs = pat == 10 ? 7.0 : 5.0;
    vec2 g = p * gs;
    vec2 gi = floor(g);
    vec2 gf = fract(g) - 0.5 - (hash22(gi) - 0.5) * 0.7;
    float rd = 0.75 * wpp * gs;
    float stip = (1.0 - smoothstep(rd - aa * gs, rd + aa * gs, length(gf))) * step(hash12(gi + 3.3), 0.6) * smoothstep(5.0, 10.0, ppt / gs);
    float ps = 3.2 * sc;
    vec4 v = voronoi(p * ps);
    float ring = inkLine(abs(v.x - 0.2) / ps, w * 0.55, aa) * step(hash12(v.zw), 0.3) * smoothstep(6.0, 12.0, 0.4 / ps * ppt);
    r.fine = max(stip, ring);
    float cs = scale * 1.3;
    cs *= exp2(max(0.0, ceil(log2(22.0 * wpp / cs))));
    vec4 vc = voronoi(p / cs + 5.3);
    r.lines = inkLine((vc.y - vc.x) * 0.5 * cs, w * 0.7, aa) * 0.8;
    r.cell = hash12(vc.zw);
  } else {
    float lvl = max(0.0, log2(22.0 * wpp / scale));
    float s0 = scale * exp2(floor(lvl));
    float f = lvl > 0.0 ? fract(lvl) : 0.0;
    vec2 cp = p * vec2(0.9, 1.06) / s0;
    vec4 v = voronoi(cp);
    float l0 = inkLine((v.y - v.x) * 0.5 * s0 / 1.06, w, aa);
    r.cell = hash12(v.zw);
    vec2 rel = cp - v.zw - hash22(v.zw);
    float nearB = 1.0 - smoothstep(0.0, 0.5, v.y - v.x);
    r.bev = nearB * dot(normalize(rel + 1e-4), vec2(-0.5, 0.866));
    float ch = hash12(v.zw + 9.1);
    for (int k = 0; k < 2; k++) {
      float a = ch * 37.0 + float(k) * 2.1;
      vec2 dir = vec2(cos(a), sin(a));
      vec2 q = rel - vec2(-dir.y, dir.x) * (float(k) * 0.22 - 0.06);
      float along = dot(q, dir);
      float across = abs(dot(q, vec2(-dir.y, dir.x)) + 0.05 * sin(along * 11.0));
      float len = 0.22 + 0.15 * hash12(v.zw + float(k) * 3.7);
      r.fine = max(r.fine, inkLine(across * s0, w * 0.55, aa) * step(abs(along), len) * step(hash12(v.zw + float(k) * 5.3), 0.7));
    }
    if (f > 0.0) {
      vec4 v1 = voronoi(cp * 0.5 + 31.7);
      l0 = mix(l0, inkLine((v1.y - v1.x) * s0 / 1.06, w, aa), f);
      r.fine *= 1.0 - f;
    }
    r.lines = l0;
  }
  return r;
}
// Natural, irregular structure (round 2): beds undulate and pinch and swell, joints are slanted,
// unevenly spaced and stop inside the bed, blocks come from a domain-warped cell pattern with uneven
// sizes; no straight line runs along the tile grid. Masonry (6) keeps its regular courses.
RockInk rockInkNatural(int pat, vec2 p, float sc, float wpp, float scale, float w, float aa) {
  RockInk r;
  r.lines = 0.0;
  r.fine = 0.0;
  r.cell = 0.5;
  r.bev = 0.0;
  float ppt = 1.0 / wpp;
  if (pat == 1) {
    float k = 0.55 * sc;
    float warp = fbm3(vec2(p.x * 0.07, p.y * 0.2)) * 2.2 + 0.55 * sin(p.x * 0.23 + fbm3(p * 0.11) * 3.0);
    float t0 = (p.y + warp / k * 0.55) * k;
    float t = t0 + 0.28 * sin(t0 * 1.7 + vnoise(vec2(p.x * 0.05, 3.0)) * 6.0); // pinch and swell
    float id = floor(t);
    float b = fract(t);
    float bedH = 1.0 / k;
    float bedLod = smoothstep(9.0, 20.0, bedH * ppt);
    float lj = scale * (1.3 + 1.4 * hash12(vec2(id, 1.3)));
    lj *= exp2(max(0.0, ceil(log2(18.0 * wpp / lj))));
    float xs = (p.x + hash12(vec2(id, 4.1)) * lj) / lj;
    float c = floor(xs);
    float joint = 0.0;
    for (int n = 0; n < 2; n++) {
      float jc = c + float(n);
      float h1 = hash12(vec2(id, jc) + 0.5);
      float h2 = hash12(vec2(id, jc) + 7.3);
      if (h1 > 0.72) continue;                                 // some joints missing: uneven blocks
      float slant = (h2 - 0.5) * 1.3;                          // up to ~35 degrees
      float jx = jc + (h1 - 0.36) * 0.9 + slant * (b - 0.5) + 0.05 * sin(b * 9.0 + h2 * 20.0);
      float b0 = 0.1 * h2;                                     // joints stop inside the bed
      float b1 = 1.0 - 0.45 * fract(h1 * 7.1);
      float span = smoothstep(b0, b0 + 0.06, b) * (1.0 - smoothstep(b1 - 0.06, b1, b));
      joint = max(joint, inkLine(abs(xs - jx) * lj, w, aa) * span);
    }
    float bed = inkLine(min(b, 1.0 - b) * bedH, w, aa) * (0.55 + 0.45 * smoothstep(0.25, 0.6, vnoise(vec2(p.x * 0.6, id))));
    r.lines = max(bed, joint) * bedLod;
    float t3 = fract(t * 3.0 + 0.3 * vnoise(p * 0.8));
    r.fine = inkLine(min(t3, 1.0 - t3) * bedH / 3.0, w * 0.6, aa) * step(hash12(vec2(id, 9.2)), 0.6)
           * smoothstep(0.35, 0.65, vnoise(vec2(p.x * 0.9, id * 3.0))) * smoothstep(9.0, 20.0, bedH / 3.0 * ppt);
    r.cell = hash12(vec2(id, c));
    r.bev = smoothstep(0.72, 1.0, b) - smoothstep(0.28, 0.0, b);
    return r;
  }
  if (pat == 6 || pat == 0 || pat == 10) return rockInk(pat, p, sc, wpp, scale, w, aa);
  float lvl = max(0.0, log2(22.0 * wpp / scale));
  float s0 = scale * exp2(floor(lvl));
  float f = lvl > 0.0 ? fract(lvl) : 0.0;
  vec2 q = p / s0;
  q += (vec2(fbm3(q * 0.45 + 2.0), fbm3(q * 0.45 + 9.0)) - 0.5) * 0.9; // curved, uneven cells
  vec4 v = voronoi(q * vec2(0.9, 1.06));
  float big = step(0.6, hash12(v.zw + 3.3));                           // some cells merge into big blocks
  float e0 = (v.y - v.x) * 0.5 * s0 / 1.06;
  float l0 = inkLine(e0, w, aa) * (1.0 - big * smoothstep(0.0, 0.4, hash12(floor(q * 0.5)))) ;
  r.cell = hash12(v.zw);
  vec2 rel = q * vec2(0.9, 1.06) - v.zw - hash22(v.zw);
  float nearB = 1.0 - smoothstep(0.0, 0.5, v.y - v.x);
  r.bev = nearB * dot(normalize(rel + 1e-4), vec2(-0.5, 0.866));
  float ch = hash12(v.zw + 9.1);
  for (int k = 0; k < 2; k++) {
    float a = ch * 37.0 + float(k) * 2.1;
    vec2 dir = vec2(cos(a), sin(a));
    vec2 qq = rel - vec2(-dir.y, dir.x) * (float(k) * 0.22 - 0.06);
    float along = dot(qq, dir);
    float across = abs(dot(qq, vec2(-dir.y, dir.x)) + 0.07 * sin(along * 11.0));
    float len = 0.22 + 0.2 * hash12(v.zw + float(k) * 3.7);
    r.fine = max(r.fine, inkLine(across * s0, w * 0.55, aa) * step(abs(along), len) * step(hash12(v.zw + float(k) * 5.3), 0.7));
  }
  if (f > 0.0) {
    vec4 v1 = voronoi(q * 0.5 + 31.7);
    l0 = mix(l0, inkLine((v1.y - v1.x) * s0 / 1.06, w, aa), f);
    r.fine *= 1.0 - f;
  }
  r.lines = l0;
  return r;
}
`;

/** Pixel-scale uniform for GLSL_INK: world units per pixel at unit view depth. */
export function pxScale(camera: THREE.PerspectiveCamera, heightPx: number): number {
  return (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / Math.max(1, heightPx);
}

/** Smooth-normal copy of a (non-indexed, flat-shaded) geometry for hull outlines. */
export function hullGeometry(src: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const p = src.attributes.position!;
  // weld by quantised position so the hull is watertight across flat-shaded faces
  const key = new Map<string, number>();
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(4)}|${p.getY(i).toFixed(4)}|${p.getZ(i).toFixed(4)}`;
    let j = key.get(k);
    if (j === undefined) {
      j = pos.length / 3;
      key.set(k, j);
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
    }
    idx.push(j);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/**
 * Ink hull: back faces pushed out along the smoothed normal by a constant number
 * of pixels (clip-space offset), so outlines keep their width at every zoom.
 * Hidden where the world is unexplored (fog texture) so it never leaks shapes.
 */
export function inkHullMaterial(u: Record<string, THREE.IUniform>, px: number, color: THREE.Color, wind = 0): THREE.ShaderMaterial {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uFogTex: u.uFogTex!,
      uWorldSize: u.uWorldSize!,
      uTime: u.uTime!,
      uRes: u.uRes!,
      uHullPx: { value: px },
      uInkCol: { value: color },
      uWind: { value: wind },
    },
    vertexShader: /* glsl */ `
      uniform float uHullPx;
      uniform vec2 uRes;
      uniform float uTime;
      uniform float uWind;
      varying vec2 vWp;
      void main() {
        mat4 m = modelMatrix;
        #ifdef USE_INSTANCING
          m = modelMatrix * instanceMatrix;
        #endif
        vec4 wp = m * vec4(position, 1.0);
        #ifdef WIND
          // same sway as the lit prop material, so the outline stays on the swaying plant
          float hh = max(position.y, 0.0);
          wp.x += sin(uTime * 1.6 + wp.x * 0.7 + wp.z * 0.4) * hh * hh * uWind;
        #endif
        vWp = wp.xy;
        vec4 clip = projectionMatrix * viewMatrix * wp;
        vec3 vn = mat3(viewMatrix) * normalize(mat3(m) * normal);
        vec2 dir = (projectionMatrix * vec4(vn, 0.0)).xy;
        float len = length(dir);
        dir = len > 1e-5 ? dir / len : vec2(0.0);
        clip.xy += dir * uHullPx * 2.0 / uRes * clip.w;
        gl_Position = clip;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uFogTex;
      uniform vec2 uWorldSize;
      uniform vec3 uInkCol;
      varying vec2 vWp;
      void main() {
        if (texture(uFogTex, vec2(vWp.x / uWorldSize.x, -vWp.y / uWorldSize.y)).r < 0.5) discard;
        gl_FragColor = vec4(uInkCol, 0.5); // alpha 0.5 = ink coverage for the bloom ink mask (InkPost)
      }`,
    side: THREE.BackSide,
  });
  if (wind) mat.defines = { WIND: 1 };
  return mat;
}

/** Screen-space outline from depth: wobbled 8-tap Laplacian + max jump, faded with distance. */
const DepthInkShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.Texture | null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uNear: { value: 0.5 },
    uFar: { value: 1200 },
    uWidth: { value: 1.2 },
    uStrength: { value: 0.9 },
    uThreshold: { value: 0.006 },
    uInk: { value: new THREE.Color(0.012, 0.009, 0.008) },
    uTime: { value: 0 },
    uBoil: { value: 0 },
    uWobblePx: { value: 1.2 },
    uFadeFar: { value: new THREE.Vector2(70, 260) },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform vec2 uRes;
    uniform float uNear;
    uniform float uFar;
    uniform float uWidth;
    uniform float uStrength;
    uniform float uThreshold;
    uniform vec3 uInk;
    uniform float uTime;
    uniform float uBoil;
    uniform float uWobblePx;
    uniform vec2 uFadeFar;
    varying vec2 vUv;
    ${GLSL_NOISE}
    float linDepth(vec2 uv) {
      float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
      return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
    }
    void main() {
      vec2 px = 1.0 / uRes;
      float bt = uBoil > 0.0 ? floor(uTime * uBoil) : 0.0;
      vec2 fc = gl_FragCoord.xy * 0.035;
      vec2 wob = vec2(vnoise(fc + bt * 13.1), vnoise(fc + 7.7 + bt * 5.3)) - 0.5;
      vec2 uv = vUv + wob * uWobblePx * px;
      float d = linDepth(uv);
      float s = 0.0;
      float mx = 0.0;
      for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.785398;
        float dn = linDepth(uv + vec2(cos(a), sin(a)) * uWidth * px);
        s += dn;
        mx = max(mx, d - dn); // only the far side of a jump draws, so lines sit on the near object
      }
      float lap = abs(s * 0.125 - d) / d;
      float e = smoothstep(uThreshold, uThreshold * 2.5, max(lap * 3.0, mx / d));
      e *= 1.0 - smoothstep(uFadeFar.x, uFadeFar.y, d);
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      gl_FragColor = vec4(mix(c, uInk, e * uStrength), 1.0);
    }`,
};

export interface DepthInkOptions {
  width?: number;
  strength?: number;
  threshold?: number;
  boil?: number;
  wobblePx?: number;
}

/** Composer pass: reads colour + depth of the previous pass (both composer targets carry a DepthTexture). */
export class DepthInkPass extends Pass {
  readonly material: THREE.ShaderMaterial;
  private quad: FullScreenQuad;

  constructor(camera: THREE.PerspectiveCamera, opt: DepthInkOptions = {}) {
    super();
    this.material = new THREE.ShaderMaterial({
      ...DepthInkShader,
      uniforms: THREE.UniformsUtils.clone(DepthInkShader.uniforms),
      depthTest: false,
      depthWrite: false,
    });
    const u = this.material.uniforms;
    u.uNear!.value = camera.near;
    u.uFar!.value = camera.far;
    if (opt.width !== undefined) u.uWidth!.value = opt.width;
    if (opt.strength !== undefined) u.uStrength!.value = opt.strength;
    if (opt.threshold !== undefined) u.uThreshold!.value = opt.threshold;
    if (opt.boil !== undefined) u.uBoil!.value = opt.boil;
    if (opt.wobblePx !== undefined) u.uWobblePx!.value = opt.wobblePx;
    this.quad = new FullScreenQuad(this.material);
  }

  override setSize(w: number, h: number): void {
    (this.material.uniforms.uRes!.value as THREE.Vector2).set(w, h);
  }

  override render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget): void {
    this.material.uniforms.tDiffuse!.value = readBuffer.texture;
    this.material.uniforms.tDepth!.value = readBuffer.depthTexture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }

  override dispose(): void {
    this.material.dispose();
    this.quad.dispose();
  }
}
