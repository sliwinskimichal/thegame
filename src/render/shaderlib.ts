/**
 * Shared GLSL library: hash/value/cellular noise, the procedural rock
 * patterns of the baseline palette, and the world lighting model (light
 * field + sky + moving lanterns with cheap occlusion).
 * Requires GLSL_WORLD (worldTex.ts) for lightAt / fogAt.
 */
export const MAX_DYN_LIGHTS = 12;

export const GLSL_NOISE = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm3(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s / 0.875;
}
float fbm4(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s / 0.9375;
}
// Cellular noise: x = F1 distance, y = F2 distance, zw = id of nearest cell.
vec4 voronoi(vec2 p) {
  vec2 n = floor(p);
  vec2 f = fract(p);
  float f1 = 8.0, f2 = 8.0;
  vec2 id = vec2(0.0);
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = hash22(n + g);
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < f1) { f2 = f1; f1 = d; id = n + g; }
    else if (d < f2) { f2 = d; }
  }
  return vec4(sqrt(f1), sqrt(f2), id);
}
`;

export const GLSL_LIGHT = /* glsl */ `
uniform float uTime;
uniform vec3 uSkyLight;
uniform vec3 uSunDir;
uniform float uDaylight;
uniform vec4 uDynPos[${MAX_DYN_LIGHTS}];
uniform vec4 uDynCol[${MAX_DYN_LIGHTS}];
uniform int uDynCount;


float lum(vec3 c) { return dot(c, vec3(0.3, 0.55, 0.15)); }

/**
 * Incoming light at world position p with normal n.
 * samplePos is where the light field is read (usually p.xy pushed into the
 * open cell the surface faces). spec receives a specular-ish term.
 */
vec3 worldLight(vec3 p, vec3 n, vec2 samplePos, vec3 viewDir, float shininess, float sunMix, out vec3 spec) {
  vec4 L = lightAt(samplePos);
  float e = 0.55;
  vec4 lx = lightAt(samplePos + vec2(e, 0.0)) - lightAt(samplePos - vec2(e, 0.0));
  vec4 ly = lightAt(samplePos + vec2(0.0, e)) - lightAt(samplePos - vec2(0.0, e));

  // Block light: direction from the gradient of the light field.
  float bl = lum(L.rgb);
  vec2 gb = vec2(lum(lx.rgb), lum(ly.rgb)) / max(bl, 0.04);
  vec3 db = normalize(vec3(gb * 1.6, 0.9));
  float flick = 1.0 + 0.05 * (vnoise(samplePos * 0.7 + uTime * 3.1) - 0.5) + 0.03 * sin(uTime * 13.0 + samplePos.x);
  float ndb = max(dot(n, db), 0.0);
  vec3 block = L.rgb * flick * (0.3 + 0.7 * ndb);

  // Sky light: comes from above and from the open direction.
  vec2 gs = vec2(lx.a, ly.a) / max(L.a, 0.04);
  vec3 ds = normalize(vec3(gs * 1.2, 0.6) + vec3(0.0, 0.8, 0.0));
  ds = normalize(mix(ds, uSunDir, sunMix));
  float nds = max(dot(n, ds), 0.0);
  vec3 sky = L.a * uSkyLight * mix(0.4 + 0.6 * nds, 0.22 + 0.95 * nds, sunMix);

  vec3 h = normalize(db + viewDir);
  float sp = pow(max(dot(n, h), 0.0), shininess);
  spec = L.rgb * sp * ndb + sky * pow(max(dot(n, normalize(ds + viewDir)), 0.0), shininess) * 0.5;

  // Moving lights with a cheap 3-tap occlusion through rock.
  vec3 dyn = vec3(0.0);
  for (int i = 0; i < ${MAX_DYN_LIGHTS}; i++) {
    if (i >= uDynCount) break;
    vec3 d = uDynPos[i].xyz - p;
    float dist = length(d);
    float rad = uDynPos[i].w;
    if (dist > rad) continue;
    vec3 l = d / max(dist, 1e-3);
    float att = 1.0 - dist / rad;
    att *= att;
    float occ = 1.0;
    vec2 a = p.xy + n.xy * 0.3;
    vec2 b = uDynPos[i].xy;
    occ *= 1.0 - fogAt(mix(a, b, 0.33)).y;
    occ *= 1.0 - fogAt(mix(a, b, 0.66)).y;
    float nd = max(dot(n, l), 0.0) * 0.8 + 0.2;
    vec3 c = uDynCol[i].rgb * att * occ;
    dyn += c * nd;
    spec += c * pow(max(dot(n, normalize(l + viewDir)), 0.0), shininess);
  }
  return block + sky + dyn;
}
`;

/** Procedural rock: heightAt(pat, uv, wp, p3) and surface(pat, uv, wp, p0..p3). Needs uTime. */
export const GLSL_ROCK = /* glsl */ `struct Surf {
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
`;
