/**
 * Dwarf materials in the illustrated style (owner: W3 "Technical artist", dwarf team).
 *
 * Fill: the light model of the style's props (src/lab/styles/illustrated.ts PROP_FRAG — worldLight from
 * the light field, ambient uAmbCool * uPropAmb * 1.25 + light hue * level * uPropLight, the dark takes
 * colour) with a flat 2–3 tone form (art bible §5.3): base, shade −12 L* toward the ambient, light
 * +10 L* toward the lamp in the core of a pool, soft boundary 0.08. The tone direction mixes the
 * illustrator's fixed key with the direction of the light (light-field gradient + dynamic lamps), so
 * the side toward the lamp reads lighter ("is he in the light"). Lamp flames emit (bloom catches them).
 *
 * Hull: inverted shell pushed out along the smoothed normal by a constant number of pixels
 * (adapted from inkHullMaterial in src/render/ink.ts — reason: skinning from the bone texture and
 * mirror-aware culling), style ink, alpha 0.5 = ink coverage for the L12 "ink over bloom" pass.
 *
 * Mirror (facing −1 scales X by −1, triangle winding flips): one draw serves both facings. Culling is
 * done in the fragment shader: a fragment is a true front face when gl_FrontFacing XOR mirrored.
 * Normals come from the skin matrix and are never flipped by gl_FrontFacing. Option MIRROR_SPLIT:
 * separate buckets per facing with hardware culling (side per bucket), no discard (benchmark twin).
 *
 * Modes (uMode): 0 colour, 1 mask (fill white, hull grey, unlit), 2 silhouette (black, hull hidden).
 */
import * as THREE from 'three';
import { GLSL_INK } from '../../ink';
import { GLSL_LIGHT, GLSL_NOISE, MAX_DYN_LIGHTS } from '../../shaderlib';
import { GLSL_WORLD } from '../../worldTex';

export const MODE = { color: 0, mask: 1, sil: 2 } as const;
export type CrowdMode = keyof typeof MODE;

/** Flat tone model (data-driven; the lab may override from the URL). */
export interface ToneParams {
  /** Illustrator's fixed key light direction (world, toward the light). */
  key: [number, number, number];
  /** 0 = key only, 1 = the light's own direction wherever there is light. */
  keyMix: number;
  /** Shade tone: L* offset and how far its hue moves toward the ambient (0..1). */
  shadeDL: number;
  shadeHue: number;
  /** Light tone in the core of a pool: L* offset and hue toward the lamp (0..1). */
  lightDL: number;
  lightHue: number;
  /** Half width of the tone boundaries in dot(N, key) units. */
  soft: number;
  /** Light-field level where the pool core starts / is full (max channel, torch = 2.6 at the flame). */
  core: [number, number];
  /** Lamp emission flicker amplitude (±2% = 0.02). */
  flicker: number;
  /** Share of the dwarf's own lamp that lights its own body (concept card: in the dark only the outline and the light stay). */
  selfLight: number;
  /** Figure against ground: ambient and light gains relative to the props' (uPropAmb·1.25, uPropLight), the light
   *  level cap and how much the light's hue is taken off the figure (so the garments stay muted, C* <= 26). */
  ambK: number;
  lightK: number;
  lightCap: number;
  figDesat: number;
  /** Share of the props' light the face, hands and the accent keep (the bright "eye" of the dark figure). */
  faceLift: number;
}

export const DEFAULT_TONE: ToneParams = {
  key: [-0.45, 0.75, 0.5],
  keyMix: 0.55,
  shadeDL: -12,
  shadeHue: 0.35,
  lightDL: 10,
  lightHue: 0.35,
  soft: 0.08,
  core: [1.15, 1.6],
  flicker: 0.02,
  selfLight: 0.25,
  ambK: 1,
  lightK: 1,
  lightCap: 1.8,
  figDesat: 0,
  faceLift: 0,
};

/** Parse tone overrides from URL-like pairs: tone.shadeDL=-12&tone.ambK=0.6 (numbers; key/core as a,b[,c]). */
export function toneFromParams(params: URLSearchParams, base: ToneParams = DEFAULT_TONE): ToneParams {
  const t: ToneParams = { ...base, key: [...base.key], core: [...base.core] };
  for (const [k, v] of params) {
    if (!k.startsWith('tone.')) continue;
    const name = k.slice(5) as keyof ToneParams;
    if (!(name in t)) throw new Error(`nieznany parametr tonu "${name}"`);
    const nums = v.split(',').map(Number);
    if (nums.some((x) => !Number.isFinite(x))) throw new Error(`parametr tonu "${name}": "${v}" nie jest liczbą`);
    if (name === 'key') t.key = [nums[0]!, nums[1]!, nums[2]!];
    else if (name === 'core') t.core = [nums[0]!, nums[1]!];
    else (t[name] as number) = nums[0]!;
  }
  return t;
}

const SKIN_ATTRS = /* glsl */ `
attribute vec3 color;
attribute float aSlot;
attribute vec2 aBones;
attribute float aWeight;
attribute float aEmissive;
`;

/** Per-instance data of the welded (bone texture) path. */
const WELDED_INSTANCE = /* glsl */ `
attribute vec4 aInst; // x: bone-texture row, y: mirror sign (+1 / -1), z: lamp on (0/1), w: seed 0..1
attribute vec3 aPal1; // TUNIC
attribute vec3 aPal2; // TUNIC2
attribute vec3 aPal3; // BEARD
attribute vec3 aPal4; // SKIN
attribute vec3 aPal5; // CLOTH
attribute vec3 aPal6; // ACCENT
attribute vec3 aLamp; // world position of this dwarf's own lamp (far away when it has none)
uniform sampler2D uBoneTex;
void boneRows(float row, float bone, out vec4 r0, out vec4 r1, out vec4 r2) {
  ivec2 c = ivec2(int(bone + 0.5) * 3, int(row + 0.5));
  r0 = texelFetch(uBoneTex, c, 0);
  r1 = texelFetch(uBoneTex, c + ivec2(1, 0), 0);
  r2 = texelFetch(uBoneTex, c + ivec2(2, 0), 0);
}
// Linear blend skinning of two bones (rigid parts: aWeight = 1, one fetch triple).
void skin(vec3 p, vec3 n, out vec3 wp, out vec3 wn) {
  vec4 a0, a1, a2;
  boneRows(aInst.x, aBones.x, a0, a1, a2);
  if (aWeight < 0.9999) {
    vec4 b0, b1, b2;
    boneRows(aInst.x, aBones.y, b0, b1, b2);
    float w = aWeight;
    a0 = a0 * w + b0 * (1.0 - w);
    a1 = a1 * w + b1 * (1.0 - w);
    a2 = a2 * w + b2 * (1.0 - w);
  }
  vec4 p4 = vec4(p, 1.0);
  wp = vec3(dot(a0, p4), dot(a1, p4), dot(a2, p4));
  wn = vec3(dot(a0.xyz, n), dot(a1.xyz, n), dot(a2.xyz, n));
}
vec3 slotColor() {
  int s = int(aSlot + 0.5);
  if (s == 1) return aPal1 * color;
  if (s == 2) return aPal2 * color;
  if (s == 3) return aPal3 * color;
  if (s == 4) return aPal4 * color;
  if (s == 5) return aPal5 * color;
  if (s == 6) return aPal6 * color;
  return color;
}
`;

/** Per-instance data of the instanced-parts path (InstancedMesh: instanceMatrix = placement * bones[part.bone]). */
const PARTS_INSTANCE = /* glsl */ `
attribute vec4 aInst; // x: unused, y: mirror sign, z: lamp on, w: seed
attribute vec3 aTint; // palette colour of the part's slot (white for FIXED)
attribute vec3 aLamp; // world position of this dwarf's own lamp
void skin(vec3 p, vec3 n, out vec3 wp, out vec3 wn) {
  wp = (modelMatrix * instanceMatrix * vec4(p, 1.0)).xyz;
  wn = mat3(modelMatrix) * mat3(instanceMatrix) * n;
}
vec3 slotColor() { return aTint * color; }
`;

const FILL_VERT = (parts: boolean) => /* glsl */ `
${SKIN_ATTRS}
${parts ? PARTS_INSTANCE : WELDED_INSTANCE}
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vPos;
varying float vEmi;
varying vec3 vInst; // mirror sign, lamp on, seed
varying vec3 vLamp;
flat varying float vSlot;
void main() {
  vec3 wp;
  vec3 wn;
  skin(position, normal, wp, wn);
  vLamp = aLamp;
  vSlot = aSlot;
  float nl = length(wn);
  vNormal = nl > 1e-6 ? wn / nl : vec3(0.0, 0.0, 1.0);
  vPos = wp;
  vColor = slotColor();
  vEmi = aEmissive;
  vInst = aInst.yzw;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;

const FILL_FRAG = /* glsl */ `
${GLSL_WORLD}
${GLSL_NOISE}
${GLSL_LIGHT}
${GLSL_INK}
uniform vec3 uCamPos;
uniform vec3 uAmbCool;
uniform float uDwarfAmb;
uniform float uPropLight;
uniform float uBands;
uniform float uBandSoft;
uniform float uLightDesat;
uniform float uDesat;
uniform float uDarkDesat;
uniform float uPropGlow;
uniform int uMode;
uniform vec3 uKey;
uniform float uKeyMix;
uniform vec4 uTone; // shadeDL, shadeHue, lightDL, lightHue
uniform float uToneSoft;
uniform vec2 uCore;
uniform float uFlicker;
uniform float uSelfLight;
uniform vec4 uFig; // ambient gain, light gain, light cap, light-hue desaturation (figure vs ground)
uniform float uFaceLift; // face, hands and the accent keep this share of the props' light ("the bright eye")
varying vec3 vLamp;
flat varying float vSlot;
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vPos;
varying float vEmi;
varying vec3 vInst;
const vec3 Y709 = vec3(0.2126, 0.7152, 0.0722);
vec3 desatC(vec3 c, float k) { return mix(vec3(lum(c)), c, 1.0 - k); }
float toLstar(float y) { return y > 0.008856 ? 116.0 * pow(y, 1.0 / 3.0) - 16.0 : 903.3 * y; }
float fromLstar(float l) { return l > 8.0 ? pow((l + 16.0) / 116.0, 3.0) : max(l, 0.0) / 903.3; }
// Move a colour by dL in L* (scene-linear), keeping its chromaticity.
vec3 shiftL(vec3 c, float dL) {
  float y = max(dot(c, Y709), 1e-6);
  return c * (fromLstar(toLstar(y) + dL) / y);
}
// Same luminance, hue of h.
vec3 withHue(vec3 c, vec3 h) {
  return h * (dot(c, Y709) / max(dot(h, Y709), 1e-4));
}
// Direction (and amount) of the light at p: light-field gradient plus the dynamic lamps.
vec3 lightDirection(vec3 p) {
  vec4 L = lightAt(p.xy);
  float e = 0.55;
  vec3 lx = (lightAt(p.xy + vec2(e, 0.0)) - lightAt(p.xy - vec2(e, 0.0))).rgb;
  vec3 ly = (lightAt(p.xy + vec2(0.0, e)) - lightAt(p.xy - vec2(0.0, e))).rgb;
  vec3 acc = vec3(vec2(lum(lx), lum(ly)) * 1.6, 0.5 * lum(L.rgb));
  for (int i = 0; i < ${MAX_DYN_LIGHTS}; i++) {
    if (i >= uDynCount) break;
    vec3 d = uDynPos[i].xyz - p;
    float dist = length(d);
    float rad = uDynPos[i].w;
    if (dist > rad) continue;
    float att = 1.0 - dist / rad;
    acc += d / max(dist, 1e-3) * att * att * lum(uDynCol[i].rgb);
  }
  return acc;
}
// Light of the dwarf's OWN lamp on its own body (the dynamic light at vLamp), the same term worldLight adds.
// The concept card: in the dark the dwarf keeps only its outline and the little light, so the own lamp
// lights its body only by uSelfLight.
vec3 ownLamp(vec3 p, vec3 n) {
  for (int i = 0; i < ${MAX_DYN_LIGHTS}; i++) {
    if (i >= uDynCount) break;
    if (distance(uDynPos[i].xyz, vLamp) > 1e-3) continue;
    vec3 d = uDynPos[i].xyz - p;
    float dist = length(d);
    float rad = uDynPos[i].w;
    if (dist > rad) return vec3(0.0);
    vec3 l = d / max(dist, 1e-3);
    float att = 1.0 - dist / rad;
    att *= att;
    vec2 a = p.xy + n.xy * 0.3;
    vec2 b = uDynPos[i].xy;
    float occ = (1.0 - fogAt(mix(a, b, 0.33)).y) * (1.0 - fogAt(mix(a, b, 0.66)).y);
    return uDynCol[i].rgb * att * occ * (max(dot(n, l), 0.0) * 0.8 + 0.2);
  }
  return vec3(0.0);
}
void main() {
  bool mirrored = vInst.x < 0.0;
#ifndef MIRROR_SPLIT
  if (gl_FrontFacing == mirrored) discard; // true back face (winding flips with the mirror)
#endif
  if (uMode == 2) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  if (uMode == 1) { gl_FragColor = vec4(1.0); return; }
  if (fogAt(vPos.xy).x < 0.5) discard; // never leak shapes into unexplored rock
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCamPos - vPos);
  vec3 spec;
  vec3 L = worldLight(vPos, N, vPos.xy, V, 16.0, smoothstep(0.55, 0.95, lightAt(vPos.xy).a), spec);
  L = max(L - ownLamp(vPos, N) * (1.0 - uSelfLight), vec3(0.0));
  float l = max(max(L.r, L.g), L.b);
  vec3 hue = desatC(L / max(l, 1e-3), max(uLightDesat, uFig.w));
  vec3 base = desatC(vColor, uDesat);
  int slot = int(vSlot + 0.5);
  float lift = (slot == 4 || slot == 6) ? uFaceLift : 0.0; // SLOT.SKIN, SLOT.ACCENT
  float lbF = lightBands(min(l, mix(uFig.z, 1.8, lift)), uBands, uBandSoft);
  vec3 col = base * (uAmbCool * uDwarfAmb * mix(uFig.x, 1.0, lift) + hue * lbF * uPropLight * mix(uFig.y, 1.0, lift));
  // flat tones: the side toward the light is lighter, the other side drops toward the ambient
  vec3 ld = lightDirection(vPos);
  float amt = smoothstep(0.02, 0.3, length(ld));
  vec3 key = normalize(mix(normalize(uKey), normalize(ld + vec3(0.0, 0.0, 1e-3)), uKeyMix * amt));
  float f = dot(N, key);
  float shade = 1.0 - smoothstep(-uToneSoft, uToneSoft, f);
  float fieldL = max(max(lightAt(vPos.xy).r, lightAt(vPos.xy).g), lightAt(vPos.xy).b);
  float core = smoothstep(uCore.x, uCore.y, fieldL) * smoothstep(0.45 - uToneSoft, 0.45 + uToneSoft, f);
  vec3 sh = shiftL(col, uTone.x);
  sh = mix(sh, withHue(sh, uAmbCool), uTone.y);
  vec3 li = shiftL(col, uTone.z);
  li = mix(li, withHue(li, hue), uTone.w);
  col = mix(mix(col, sh, shade), li, core);
  float dk = 1.0 - smoothstep(0.05, 0.45, l);
  col = mix(col, vec3(lum(col)) * vec3(0.92, 0.98, 1.08), uDarkDesat * dk);
  float flick = 1.0 + uFlicker * sin(uTime * 11.0 + vInst.z * 40.0);
  col += vColor * vEmi * uPropGlow * vInst.y * flick;
  gl_FragColor = vec4(col, 1.0);
}
`;

const HULL_VERT = (parts: boolean) => /* glsl */ `
${SKIN_ATTRS}
${parts ? PARTS_INSTANCE : WELDED_INSTANCE}
uniform float uHullPx;
uniform vec2 uRes;
varying vec2 vWp;
varying float vMirror;
void main() {
  vec3 wp;
  vec3 wn;
  skin(position, normal, wp, wn);
  vWp = wp.xy;
  vMirror = aInst.y;
  vec4 clip = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  float nl = length(wn);
  vec3 vn = mat3(viewMatrix) * (nl > 1e-6 ? wn / nl : vec3(0.0));
  vec2 dir = (projectionMatrix * vec4(vn, 0.0)).xy;
  float len = length(dir);
  dir = len > 1e-5 ? dir / len : vec2(0.0);
  clip.xy += dir * uHullPx * 2.0 / uRes * clip.w;
  gl_Position = clip;
}
`;

const HULL_FRAG = /* glsl */ `
uniform sampler2D uFogTex;
uniform vec2 uWorldSize;
uniform vec3 uInk;
uniform int uMode;
varying vec2 vWp;
varying float vMirror;
void main() {
#ifndef MIRROR_SPLIT
  if (gl_FrontFacing != (vMirror < 0.0)) discard; // keep true back faces only
#endif
  if (uMode == 1) { gl_FragColor = vec4(0.5, 0.5, 0.5, 1.0); return; }
  if (texture(uFogTex, vec2(vWp.x / uWorldSize.x, -vWp.y / uWorldSize.y)).r < 0.5) discard;
  gl_FragColor = vec4(uInk, 0.5); // alpha 0.5 = ink coverage (InkCapture / InkOver of L12)
}
`;

export type Uniforms = Record<string, THREE.IUniform>;

/** Uniforms owned by the dwarf materials (shared by every material of one crowd renderer). */
export interface DwarfUniforms {
  uMode: THREE.IUniform<number>;
  uBoneTex: THREE.IUniform<THREE.Texture | null>;
  uDwarfAmb: THREE.IUniform<number>;
  uKey: THREE.IUniform<THREE.Vector3>;
  uKeyMix: THREE.IUniform<number>;
  uTone: THREE.IUniform<THREE.Vector4>;
  uToneSoft: THREE.IUniform<number>;
  uCore: THREE.IUniform<THREE.Vector2>;
  uFlicker: THREE.IUniform<number>;
  uSelfLight: THREE.IUniform<number>;
  uFig: THREE.IUniform<THREE.Vector4>;
  uFaceLift: THREE.IUniform<number>;
}

export function dwarfUniforms(style: Uniforms, tone: ToneParams = DEFAULT_TONE): DwarfUniforms {
  return {
    uMode: { value: MODE.color },
    uBoneTex: { value: null },
    // the style's character ambient: uPropAmb * 1.25 (as dwarfFill in buildIllustratedScene)
    uDwarfAmb: { value: ((style.uPropAmb?.value as number | undefined) ?? 0.34) * 1.25 },
    uKey: { value: new THREE.Vector3(...tone.key).normalize() },
    uKeyMix: { value: tone.keyMix },
    uTone: { value: new THREE.Vector4(tone.shadeDL, tone.shadeHue, tone.lightDL, tone.lightHue) },
    uToneSoft: { value: tone.soft },
    uCore: { value: new THREE.Vector2(...tone.core) },
    uFlicker: { value: tone.flicker },
    uSelfLight: { value: tone.selfLight },
    uFig: { value: new THREE.Vector4(tone.ambK, tone.lightK, tone.lightCap, tone.figDesat) },
    uFaceLift: { value: tone.faceLift },
  };
}

export function setTone(d: DwarfUniforms, t: ToneParams): void {
  d.uKey.value.set(...t.key).normalize();
  d.uKeyMix.value = t.keyMix;
  d.uTone.value.set(t.shadeDL, t.shadeHue, t.lightDL, t.lightHue);
  d.uToneSoft.value = t.soft;
  d.uCore.value.set(...t.core);
  d.uFlicker.value = t.flicker;
  d.uSelfLight.value = t.selfLight;
  d.uFig.value.set(t.ambK, t.lightK, t.lightCap, t.figDesat);
  d.uFaceLift.value = t.faceLift;
}

/** Fill material; `side` only matters with MIRROR_SPLIT (FrontSide for facing +1, BackSide for −1). */
export function dwarfFillMaterial(style: Uniforms, d: DwarfUniforms, opts: { parts?: boolean; split?: boolean; side?: THREE.Side } = {}): THREE.ShaderMaterial {
  const defines: Record<string, number> = {};
  if (opts.split) defines.MIRROR_SPLIT = 1;
  return new THREE.ShaderMaterial({
    vertexShader: FILL_VERT(!!opts.parts),
    fragmentShader: FILL_FRAG,
    uniforms: { ...style, ...(d as unknown as Uniforms) },
    defines,
    side: opts.split ? (opts.side ?? THREE.FrontSide) : THREE.DoubleSide,
  });
}

/** Hull material for a line width in px; with MIRROR_SPLIT `side` is BackSide for +1 and FrontSide for −1. */
export function dwarfHullMaterial(style: Uniforms, d: DwarfUniforms, px: number, opts: { parts?: boolean; split?: boolean; side?: THREE.Side } = {}): THREE.ShaderMaterial {
  const defines: Record<string, number> = {};
  if (opts.split) defines.MIRROR_SPLIT = 1;
  return new THREE.ShaderMaterial({
    vertexShader: HULL_VERT(!!opts.parts),
    fragmentShader: HULL_FRAG,
    uniforms: {
      uFogTex: style.uFogTex!,
      uWorldSize: style.uWorldSize!,
      uRes: style.uRes!,
      uInk: style.uInk!,
      uMode: d.uMode,
      uBoneTex: d.uBoneTex,
      uHullPx: { value: px },
    },
    defines,
    side: opts.split ? (opts.side ?? THREE.BackSide) : THREE.DoubleSide,
  });
}

/** Minimal style uniforms for rendering dwarves outside a lab world (tests, sil shots on white). */
export function neutralStyleUniforms(width: number, height: number): Uniforms {
  const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
  white.needsUpdate = true;
  const dyn = Array.from({ length: 12 }, () => new THREE.Vector4(0, 0, 0, 1));
  const dynC = Array.from({ length: 12 }, () => new THREE.Vector4());
  return {
    uLightTex: { value: white },
    uFogTex: { value: white },
    uTileTex: { value: white },
    uWorldSize: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uSkyLight: { value: new THREE.Color(1, 1, 1) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uDaylight: { value: 1 },
    uDynPos: { value: dyn },
    uDynCol: { value: dynC },
    uDynCount: { value: 0 },
    uCamPos: { value: new THREE.Vector3() },
    uPxScale: { value: 1 },
    uRes: { value: new THREE.Vector2(width, height) },
    uInk: { value: new THREE.Color(0.016, 0.011, 0.009) },
    uAmbCool: { value: new THREE.Vector3(0.62, 0.74, 0.82) },
    uPropAmb: { value: 0.34 },
    uPropLight: { value: 0.95 },
    uBands: { value: 0 },
    uBandSoft: { value: 0.14 },
    uLightDesat: { value: 0 },
    uDesat: { value: 0 },
    uDarkDesat: { value: 0 },
    uPropGlow: { value: 1 },
  };
}
