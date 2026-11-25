/**
 * Shared GLSL snippets: noise, cellular patterns and the world lighting model
 * used by every lit material (terrain, decor, dwarves, buildings, items).
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

/** World light sampling. Requires GLSL_NOISE. */
export const GLSL_LIGHT = /* glsl */ `
uniform sampler2D uLightTex;
uniform sampler2D uFogTex;
uniform sampler2D uRowTex;
uniform vec2 uWorldSize;
uniform float uTime;
uniform vec3 uSkyLight;
uniform vec3 uSunDir;
uniform float uDaylight;
uniform vec4 uDynPos[${MAX_DYN_LIGHTS}];
uniform vec4 uDynCol[${MAX_DYN_LIGHTS}];
uniform int uDynCount;

vec2 lightUV(vec2 p) { return vec2(p.x / uWorldSize.x, -p.y / uWorldSize.y); }

vec4 decodeLight(vec4 e) { return e * e * vec4(4.0, 4.0, 4.0, 1.0); }

vec4 lightAt(vec2 p) { return decodeLight(texture(uLightTex, lightUV(p))); }

/** x: explored (0..1), y: solid occupancy (0..1). */
vec2 fogAt(vec2 p) { return texture(uFogTex, lightUV(p)).rg; }

vec3 rowTint(float worldY) { return texture(uRowTex, vec2(0.5, clamp(-worldY / uWorldSize.y, 0.0, 1.0))).rgb; }

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
