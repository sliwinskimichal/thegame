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
  float mask; // share of mineral grains (where ores and gems twinkle)
};

// Mineral growth forms (ores: pat 3, gems: pat 4); gForm is set per material by the caller.
int gForm = 0;
float gCell = 0.0;

// x = mineral mask, y = relief, z = shade (facet / core brightness)
vec3 mineral(vec2 uv, float s, float amount, int pat) {
  vec4 v;
  vec2 q;
  if (pat == 4) {
    if (gForm == 1) { // druse: a carpet of small pyramids
      q = uv * 4.4 * s;
      v = voronoi(q);
      gCell = hash12(v.zw);
      float m = smoothstep(0.5, 0.26, v.x) * step(gCell, amount + 0.2);
      float core = pow(clamp(1.0 - v.x / 0.5, 0.0, 1.0), 1.2);
      return vec3(m, m * (0.5 - v.x) * 1.7, core);
    } else if (gForm == 2) { // prisms: long hexagonal columns
      q = uv * 1.6 * s;
      v = voronoi(q);
      gCell = hash12(v.zw);
      vec2 d = q - (v.zw + hash22(v.zw));
      float a = hash12(v.zw + 4.0) * 3.1416;
      vec2 r = vec2(cos(a) * d.x + sin(a) * d.y, -sin(a) * d.x + cos(a) * d.y);
      float e = max(abs(r.x) * 3.0, abs(r.y) * 0.95);
      float m = smoothstep(0.5, 0.42, e) * step(gCell, amount + 0.1);
      float ridge = clamp(1.0 - abs(r.x) * 7.0, 0.0, 1.0);
      return vec3(m, m * (0.5 - e * 0.5 + ridge * 0.2), 0.35 + ridge * 0.65);
    } else if (gForm == 3) { // hexagonal crystals seen end-on
      q = uv * 1.9 * s;
      v = voronoi(q);
      gCell = hash12(v.zw);
      vec2 d = abs(q - (v.zw + hash22(v.zw)));
      float hx = max(d.x * 0.866 + d.y * 0.5, d.y);
      float R = 0.24 + 0.12 * hash12(v.zw + 1.7);
      float m = smoothstep(R, R - 0.03, hx) * step(gCell, amount + 0.1);
      float core = clamp(1.0 - hx / R, 0.0, 1.0);
      return vec3(m, m * (0.3 + core * 0.45), 0.3 + core * 0.7);
    }
    v = voronoi(uv * 1.8 * s); // shards (default)
    gCell = hash12(v.zw);
    float shard = smoothstep(0.55, 0.3, v.x) * step(gCell, amount + 0.1);
    float core = pow(clamp(1.0 - v.x / 0.55, 0.0, 1.0), 1.5);
    return vec3(shard, shard * (0.7 - v.x) * 1.6, 0.35 + 0.65 * core);
  }
  float m = 0.0;
  float h = 0.0;
  float sh = 1.0;
  if (gForm == 1) { // cubic crystals (galena, adamantite)
    q = uv * 2.3 * s;
    v = voronoi(q);
    gCell = hash12(v.zw);
    vec2 d = q - (v.zw + hash22(v.zw));
    float a = (hash12(v.zw + 4.0) - 0.5) * 0.9;
    vec2 r = vec2(cos(a) * d.x + sin(a) * d.y, -sin(a) * d.x + cos(a) * d.y);
    float e = max(abs(r.x), abs(r.y));
    float R = 0.13 + 0.14 * hash12(v.zw + 1.3);
    m = smoothstep(R, R - 0.02, e) * step(gCell, 0.3 + amount * 0.55);
    sh = r.x + r.y > 0.0 ? 1.2 : 0.75;
    h = m * 0.55;
  } else if (gForm == 2) { // needles: radiating sprays of prisms (cassiterite, erythrite)
    q = uv * 2.0 * s;
    v = voronoi(q);
    gCell = hash12(v.zw);
    vec2 d = q - (v.zw + hash22(v.zw));
    float a0 = hash12(v.zw + 4.0) * 6.2832;
    float on = step(gCell, 0.3 + amount * 0.55);
    for (int k = 0; k < 5; k++) {
      float a = a0 + float(k) * 1.2566 + (hash12(v.zw + float(k)) - 0.5) * 0.7;
      vec2 dir = vec2(cos(a), sin(a));
      float along = dot(d, dir);
      float across = abs(dot(d, vec2(-dir.y, dir.x)));
      float len = 0.2 + 0.22 * hash12(v.zw + float(k) * 3.1);
      float w = 0.04 * (1.0 - clamp(along / len, 0.0, 1.0)) + 0.008;
      m = max(m, smoothstep(w + 0.012, w, across) * step(0.0, along) * step(along, len) * on);
    }
    h = m * 0.45;
  } else if (gForm == 3) { // dendrites: branching native metal (copper, silver)
    q = uv * 1.3 * s;
    float blob = smoothstep(0.35, 0.6, vnoise(q * 0.8 + 7.0));
    vec2 w2 = q + vec2(fbm3(q * 1.3), fbm3(q * 1.3 + 5.2)) * 0.8;
    float f = fbm3(w2 * 1.9);
    float wire = smoothstep(0.05, 0.0, abs(f - 0.5));
    float twig = smoothstep(0.035, 0.0, abs(fbm3(w2 * 4.2 + 3.0) - 0.5)) * smoothstep(0.42, 0.5, f) * smoothstep(0.58, 0.5, f);
    m = max(wire, twig) * mix(0.25, 1.0, blob) * smoothstep(0.0, 0.3, amount);
    gCell = hash12(floor(q * 2.0));
    h = m * 0.35;
  } else if (gForm == 4) { // botryoidal: kidney-shaped bubbly masses (hematite)
    q = uv * 1.5 * s;
    v = voronoi(q);
    gCell = hash12(v.zw);
    float R = 0.3 + 0.12 * hash12(v.zw + 1.3);
    float blob = smoothstep(R, R - 0.05, v.x) * step(gCell, 0.3 + amount * 0.55);
    vec4 b = voronoi(uv * 8.5 * s + 3.0);
    float bub = 1.0 - smoothstep(0.0, 0.6, b.x);
    m = blob;
    h = blob * (0.2 + bub * 0.5);
    sh = 0.65 + bub * 0.55;
  } else if (gForm == 5) { // seams: bands along the bedding with cleat cracks (coal, emberite)
    float t = (uv.y * 1.7 + fbm3(uv * 0.55) * 0.9) * s;
    float b = abs(fract(t) - 0.5);
    float edge = 0.08 + amount * 0.26;
    m = smoothstep(edge + 0.03, edge, b);
    float cleat = smoothstep(0.03, 0.0, abs(fract(uv.x * 3.1 * s + floor(t) * 0.37) - 0.5) - 0.47);
    gCell = hash12(vec2(floor(t), 2.0));
    sh = 0.8 + 0.4 * hash12(vec2(floor(t), 5.0)) - cleat * 0.5;
    h = m * 0.3 - cleat * 0.2;
  } else if (gForm == 6) { // dust: a glitter of tiny flakes (glimmerite, garnierite)
    q = uv * 7.5 * s;
    v = voronoi(q);
    gCell = hash12(v.zw);
    m = smoothstep(0.17, 0.07, v.x) * step(gCell, 0.25 + amount * 0.6);
    h = m * 0.25;
    sh = 0.75 + 0.5 * hash12(v.zw + 2.0);
  } else { // round nuggets (default)
    v = voronoi(uv * 2.6 * s);
    gCell = hash12(v.zw);
    float r = 0.16 + 0.2 * hash12(v.zw + 1.3);
    m = smoothstep(r, r - 0.08, v.x) * step(gCell, 0.3 + amount * 0.55);
    h = m * (0.4 + (r - v.x) * 2.0);
  }
  if (gForm != 6 && gForm != 5) {
    vec4 v2 = voronoi(uv * 7.0 * s + 5.0);
    float fleck = smoothstep(0.13, 0.05, v2.x) * step(hash12(v2.zw), amount * 0.6) * 0.85;
    m = max(m, fleck);
  }
  return vec3(m, h, sh);
}

// Ammonite shell in a voronoi cell: x = shell mask, y = spiral ridge, z = shading.
vec3 shellAt(vec2 q, float amount) {
  vec4 v = voronoi(q);
  vec2 d = q - (v.zw + hash22(v.zw));
  float r = length(d);
  float R = 0.2 + 0.12 * hash12(v.zw + 2.0);
  float shell = step(hash12(v.zw), amount) * smoothstep(R, R - 0.04, r);
  float ang = atan(d.y, d.x) * (hash12(v.zw + 5.0) < 0.5 ? 1.0 : -1.0);
  float spiral = abs(fract(log(r + 0.012) * 1.7 - ang / 6.2832) - 0.5);
  float ridge = smoothstep(0.16, 0.03, spiral) * shell;
  float rib = smoothstep(0.75, 1.0, abs(sin(ang * 11.0 + r * 30.0))) * shell * 0.5;
  return vec3(shell, max(ridge, rib), r / R);
}

// Rune glyph strokes in a cell grid: x = stroke mask, y = cell id hash.
vec2 runeAt(vec2 q, float amount) {
  vec2 c = floor(q);
  vec2 l = fract(q) - 0.5;
  float h = hash12(c);
  if (h > amount) return vec2(0.0, h);
  float k = floor(hash12(c + 3.1) * 4.0);
  // three strokes per glyph: a stave and two branches, chosen per cell
  float stave = smoothstep(0.06, 0.02, abs(l.x + (k - 1.5) * 0.06)) * step(abs(l.y), 0.34);
  vec2 b1 = vec2(l.x - l.y * (k < 2.0 ? 0.9 : -0.9), l.y);
  float br1 = smoothstep(0.06, 0.02, abs(b1.x - 0.08)) * step(abs(l.y - 0.12), 0.16);
  float br2 = smoothstep(0.06, 0.02, abs(l.y + l.x * (mod(k, 2.0) < 1.0 ? 0.7 : -0.7) + 0.12)) * step(abs(l.x), 0.2);
  return vec2(clamp(stave + br1 + br2, 0.0, 1.0), h);
}

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
  } else if (pat == 3 || pat == 4) {
    vec3 mn = mineral(uv, s, p3.z, pat);
    return n1 * (pat == 3 ? 0.35 : 0.3) + mn.y;
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
  } else if (pat == 11) {
    vec3 sh = shellAt(uv * 1.15 * s, p3.z);
    return n1 * 0.35 + vnoise(uv * 16.0) * 0.12 + sh.x * 0.25 + sh.y * 0.25;
  } else if (pat == 12) {
    vec2 rg = runeAt(uv * 1.7 * s, p3.z);
    return n1 * 0.4 + vnoise(uv * 14.0) * 0.1 - rg.x * 0.3;
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
  o.mask = 0.0;
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
    if (h < p3.z * 0.3) { o.albedo = mix(o.albedo, acc, 0.75); o.spec += 0.3; o.mask = 1.0; }
    else if (h > 0.9) o.albedo *= 0.35;
    else o.albedo *= 0.85 + 0.3 * hash12(v.zw + 1.0);
  } else if (pat == 3) {
    o.albedo *= 0.85 + 0.3 * vnoise(uv * 16.0);
    vec3 mn = mineral(uv, s, p3.z, 3);
    float mask = mn.x;
    float cell = gCell;
    vec3 oc = acc * (0.7 + 0.6 * vnoise(uv * 20.0)) * mn.z;
    o.albedo = mix(o.albedo, oc, mask);
    o.mask = mask;
    o.spec = mix(o.spec, p1.a, mask);
    o.shin = mix(16.0, 70.0, mask);
    float tw = pow(hash12(floor(uv * 24.0) + floor(uTime * 3.0 + cell * 7.0)), 30.0);
    o.emissive = acc * mask * (emi * (0.75 + 0.25 * sin(uTime * 2.0 + cell * 30.0)) + tw * p1.a * 1.5);
  } else if (pat == 4) {
    vec3 mn = mineral(uv, s, p3.z, 4);
    float cell = gCell;
    float shard = mn.x;
    float core = mn.z;
    o.albedo = mix(o.albedo, acc * core, shard);
    o.mask = shard;
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
  } else if (pat == 11) {
    // shell limestone: ammonite spirals in a pale matrix
    o.albedo *= 0.9 + 0.2 * vnoise(uv * 16.0);
    vec3 sh = shellAt(uv * 1.15 * s, p3.z);
    o.albedo = mix(o.albedo, acc * (0.85 + 0.3 * sh.z), sh.x * 0.6);
    o.albedo *= 1.0 - sh.y * 0.4;
  } else if (pat == 12) {
    // runestone: glyphs carved in dark stone, glowing from within
    vec2 rg = runeAt(uv * 1.7 * s, p3.z);
    o.albedo = mix(o.albedo, acc * 0.3, rg.x);
    o.emissive = acc * emi * rg.x * (0.55 + 0.45 * sin(uTime * 0.9 + rg.y * 17.0));
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
