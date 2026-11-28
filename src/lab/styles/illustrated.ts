/**
 * Tournament #3 — the illustrated cross-section (docs/variants/03-illustrated-style.md).
 *
 * One parametric renderer; every variant is a coherent set of parameters (data-driven,
 * no per-variant shader forks beyond #defines that strip unused features):
 *  - ink contour on the rock/void boundary, exact to the mesh (aEdge from the mesher),
 *    constant width in screen pixels, uneven by world-space wobble; ink on the wall lip
 *    and an optional contact line where back walls meet side walls (2.5D read),
 *  - rock "chunks": the cut face drawn as stones (cellular joints in ink, bevel, own value),
 *  - fills: palette kept from tournament #2, value range narrowed, optional posterisation,
 *    brush strokes in world space, desaturation (chroma target of the direction),
 *  - light: smooth or 2–4 soft bands, warm light hue over a cool ambient,
 *  - shadow marks: hatching or halftone with zoom LOD (constant density in pixels),
 *  - ore forms traced in ink, glints as drawn sparkles (not HDR auras),
 *  - fog of war as a dense hatched "unmapped" region with an ink border,
 *  - props and dwarves: flat two-tone fill with banded light + back-face ink hull,
 *    or outlines from the depth buffer in post (DepthInkPass).
 */
import * as THREE from 'three';
import { buildFluidGeometry } from '../../render/fluids';
import { buildHeightfield } from '../../render/heightfield';
import { DepthInkPass, GLSL_INK, GLSL_ROCK_INK, hullGeometry, InkCapturePass, inkHullMaterial, InkOverPass, pxScale } from '../../render/ink';
import { InkPost } from '../../render/inkPost';
import WINNER from '../../render/illustrated-v1.json';
import { PostFX } from '../../render/post';
import { buildMannequin, buildPropGeometries, collectProps } from '../../render/propsGeo';
import { GLSL_LIGHT, GLSL_NOISE, GLSL_ROCK } from '../../render/shaderlib';
import { SkyView } from '../../render/sky';
import { GLSL_WORLD } from '../../render/worldTex';
import { PROP } from '../../world/world';
import { buildDressing, updateWorldUniforms, WINDY, worldUniforms, type WorldUniforms } from '../common';
import type { FrameState, RenderStyle, StyleContext, StyleInstance } from '../style';

export interface IllParams {
  // --- ink contour (rock/void boundary)
  contour: number; // 0..1 opacity of the shader contour
  inkPx: number; // contour width (pixels, minimum when inkWorld > 0)
  inkWorld: number; // > 0: width follows the zoom (tiles), clamped to [inkPx, inkMaxPx]
  inkMaxPx: number;
  wobble: number; // 0..1 uneven line
  boil: number; // Hz; 0 = lines still at rest (direction: tremble only for dread)
  round: number; // convex corner rounding (tiles)
  lip: number; // ink on the front lip of side walls
  backInk: number; // contact line back wall / side wall
  inkTint: number; // ink takes the hue of the rock
  // --- rock chunks
  chunk: number; // cell size in tiles (0 = off)
  chunkInk: number; // joint line width relative to the contour (one side)
  backStruct: number; // rock structure drawn on back walls as a lighter pencil line (0..1)
  rockNatural: number; // 0 = mining-atlas structure (round 1), 1 = natural irregular (round 2, C2)
  bevel: number;
  darkDesat: number; // 0..1: darkness takes colour, not shape (unlit surfaces drift to cool grey)
  grainInk: number; // ore/gem grains traced in ink
  sparkle: number; // drawn star glints on mineral grains
  // --- fills
  valueTarget: number; // linear luminance the palette is pulled toward
  valueComp: number; // 0 = palette as is, 1 = every material at valueTarget
  poster: number; // value steps relative to the material mean (0 = off)
  flat: number; // flatten fine procedural grain on the cut face (0..1), mineral grains kept
  flatBack: number; // the same on back walls (calmer backgrounds)
  brush: number;
  desat: number;
  lightDesat: number;
  // --- light
  bands: number; // 0 = smooth
  bandSoft: number;
  ambCool: [number, number, number];
  cutAmb: number;
  cutLight: number;
  backAmb: number;
  backLight: number;
  backLift: number; // back walls: host rock painted toward backTint (layers stay)
  backTint: [number, number, number];
  sideDark: number;
  emissive: number;
  air: number; // glowing air sheet (0 = off)
  // --- shadow marks
  hatch: number;
  halftone: number;
  shadowAt: number; // light level under which marks appear
  markPx: number; // spacing of hatch lines / halftone dots (px)
  // --- fog of war
  fogCol: [number, number, number];
  fogHatch: number;
  fogHatchPx: number;
  // --- props / characters
  hullPx: number; // props (0 = no hull)
  hullDwarfPx: number;
  propAmb: number;
  propLight: number;
  // --- paper & post
  paper: number;
  postInk: number; // depth-buffer outline strength (0 = off)
  postInkPx: number;
  bloom: number;
  bloomRadius: number;
  bloomThreshold: number;
  saturation: number;
  vignette: number;
  grain: number;
  exposure: number;
  // --- light layer (round 2)
  post: 'r2b' | 'ink'; // r2b: RenderPass + UnrealBloom + grade (R2B 1:1); ink: merged InkPost (mip bloom)
  lightCurve: number; // pool falloff shaping: l' = l^gamma (1 = light field as is)
  rimGlow: number; // R2B rim glow: cut face next to open space takes the light (0..)
  airSmooth: number; // 0 banded air sheet, 1 R2B smooth dusty glow
  shaft: number; // sky light in the air (shafts from openings)
  lavaEmit: number;
  heat: number; // lava heat shimmer amplitude (tiles)
  propGlow: number; // emission of flames, mushrooms, crystal clusters
  inkMask: number; // bloom does not wash out dark ink pixels (InkPost only)
  inkMaskHi: number; // luminance up to which a pixel is protected (wider = anti-aliased edges too)
  inkMaskAlpha: number; // 1: exact ink coverage from the scene alpha instead of a luminance guess
  inkOver: number; // R2B chain: put the pre-bloom ink back after the bloom (0..1)
  lavaInk: number; // strength of that restore in lava light (1 = as everywhere; the winner uses 0.6)
  tone: 'aces' | 'agx' | 'knee';
}

/** Shared defaults: a 3-band illustrated look with stones in ink (variants override). */
export const ILL_BASE: IllParams = {
  contour: 1,
  inkPx: 2.6,
  inkWorld: 0,
  inkMaxPx: 2.6,
  wobble: 0.45,
  boil: 0,
  round: 0.28,
  lip: 1,
  backInk: 0.35,
  inkTint: 0.35,
  chunk: 0.85,
  chunkInk: 0.32,
  backStruct: 0.8,
  rockNatural: 0,
  bevel: 0.35,
  darkDesat: 0.25,
  grainInk: 0.75,
  sparkle: 1,
  valueTarget: 0.17,
  valueComp: 0.5,
  poster: 0,
  flat: 0.45,
  flatBack: 0.75,
  brush: 0.14,
  desat: 0.05,
  lightDesat: 0.15,
  bands: 3,
  bandSoft: 0.14,
  ambCool: [0.62, 0.74, 0.82],
  cutAmb: 0.5,
  cutLight: 0.5,
  backAmb: 1.3,
  backLight: 1.0,
  backLift: 0.4,
  backTint: [0.24, 0.26, 0.27],
  sideDark: 0.62,
  emissive: 1.2,
  air: 0,
  hatch: 0,
  halftone: 0,
  shadowAt: 0.3,
  markPx: 7,
  fogCol: [0.018, 0.02, 0.026],
  fogHatch: 0.8,
  fogHatchPx: 6,
  hullPx: 1.5,
  hullDwarfPx: 2.2,
  propAmb: 0.34,
  propLight: 0.95,
  paper: 0.06,
  postInk: 0,
  postInkPx: 1.3,
  bloom: 0.45,
  bloomRadius: 0.55,
  bloomThreshold: 0.85,
  saturation: 1.15,
  vignette: 0.42,
  grain: 0.025,
  exposure: 1.05,
  post: 'r2b',
  lightCurve: 1,
  rimGlow: 0,
  airSmooth: 0,
  shaft: 0.3,
  lavaEmit: 1,
  heat: 0,
  propGlow: 1,
  inkMask: 0,
  inkMaskHi: 0.03,
  inkMaskAlpha: 0,
  inkOver: 0,
  lavaInk: 1,
  tone: 'aces',
};

const TERRAIN_VERT = /* glsl */ `
attribute float aMatFlags;
attribute float aAo;
attribute vec4 aEdge;
varying vec3 vPos;
varying vec3 vNormal;
flat varying float vMat;
flat varying float vFlags;
varying float vAo;
varying vec2 vEdge;
flat varying float vMask;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPos = wp.xyz;
  vNormal = normal;
  vMat = mod(aMatFlags, 256.0);
  vFlags = floor(aMatFlags / 256.0 + 0.5);
  vAo = aAo;
  vEdge = aEdge.xy;
  vMask = aEdge.z;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

/** Uniform block of the style (GLSL declarations). */
const ILL_UNIFORMS = /* glsl */ `
uniform sampler2D uMatTex;
uniform vec3 uCamPos;
uniform float uGlint;
uniform float uGlintBase;
uniform float uOreAura;
uniform float uRimTint;
uniform vec3 uInk;
uniform float uInkTint;
uniform float uContour;
uniform vec3 uInkW; // x px, y world, z max px
uniform float uWobble;
uniform float uBoil;
uniform float uRound;
uniform float uLip;
uniform float uBackInk;
uniform float uChunk;
uniform float uChunkInk;
uniform float uBackStruct;
uniform float uBevel;
uniform float uDarkDesat;
uniform float uGrainInk;
uniform float uSparkle;
uniform float uValueTarget;
uniform float uValueComp;
uniform float uPoster;
uniform float uFlat;
uniform float uFlatBack;
uniform float uBrush;
uniform float uDesat;
uniform float uLightDesat;
uniform float uBands;
uniform float uBandSoft;
uniform vec3 uAmbCool;
uniform float uCutAmb;
uniform float uCutLight;
uniform float uBackAmb;
uniform float uBackLight;
uniform float uBackLift;
uniform vec3 uBackTint;
uniform float uSideDark;
uniform float uEmissive;
uniform float uHatch;
uniform float uHalftone;
uniform float uShadowAt;
uniform float uMarkPx;
uniform vec3 uFogCol;
uniform float uFogHatch;
uniform float uFogHatchPx;
uniform float uPaper;
uniform float uLightCurve;
uniform float uRimGlow;
uniform float uAirSmooth;
uniform float uShaft;
uniform float uLavaEmit;
uniform float uHeat;
uniform float uPropGlow;
uniform float uLavaInk;
// alpha written by the scene for the ink-over-bloom pass: 1 - 0.5 * restore weight
float inkAlpha(float cover, float zone) { return 1.0 - 0.5 * min(cover * 4.0, 1.0) * zone; }
vec3 desat(vec3 c, float k) { return mix(vec3(lum(c)), c, 1.0 - k); }
`;

const TERRAIN_FRAG = /* glsl */ `
${GLSL_WORLD}
${GLSL_NOISE}
${GLSL_LIGHT}
${GLSL_INK}
${GLSL_ROCK_INK}
${ILL_UNIFORMS}
varying vec3 vPos;
varying vec3 vNormal;
flat varying float vMat;
flat varying float vFlags;
varying float vAo;
varying vec2 vEdge;
flat varying float vMask;
bool flag(float bit) { return mod(floor(vFlags / bit), 2.0) > 0.5; }
${GLSL_ROCK}
void main() {
  int m = int(vMat + 0.5);
  vec4 p0 = texelFetch(uMatTex, ivec2(0, m), 0);
  vec4 p1 = texelFetch(uMatTex, ivec2(1, m), 0);
  vec4 p2 = texelFetch(uMatTex, ivec2(2, m), 0);
  vec4 p3 = texelFetch(uMatTex, ivec2(3, m), 0);
  vec4 p4 = texelFetch(uMatTex, ivec2(4, m), 0);
  int pat = int(p0.a + 0.5);
  gForm = int(texelFetch(uMatTex, ivec2(5, m), 0).x + 0.5);
  vec3 N = normalize(vNormal);
  vec3 wp = vPos;
  bool interior = flag(1.0);
  bool grassy = flag(2.0);
  bool unexplored = flag(8.0);
  bool outdoor = flag(16.0);
  bool top = flag(32.0);
  bool cap = abs(N.z) > 0.5;
  bool cut = cap && !interior;
  float wpp = worldPerPixel(wp, uCamPos);
  float ppt = 1.0 / wpp; // pixels per tile
  float lodFine = smoothstep(10.0, 28.0, ppt);

  vec2 uv;
  if (cap) uv = wp.xy;
  else if (abs(N.x) > 0.5) uv = vec2(wp.z, wp.y);
  else uv = vec2(wp.x, wp.z);

  Surf sf = surface(pat, uv, wp, p0, p1, p2, p3);
  float maskW = fwidth(sf.mask);
  vec3 mean = mix(p0.rgb, p1.rgb, 0.5);
  float vk = pow(uValueTarget / max(lum(mean), 0.004), uValueComp);
  vec3 alb = sf.albedo * vk;
  mean *= vk;
  // flat fills: fine procedural grain is calmed (more on back walls); mineral grains stay
  alb = mix(alb, mean * (0.9 + 0.2 * vnoise(uv * 0.45 + 3.0)), (interior ? uFlatBack : uFlat) * (1.0 - sf.mask));
#ifdef POSTER
  {
    float r = lum(alb) / max(lum(mean), 1e-3);
    float q = r * uPoster;
    float qi = floor(q);
    float qa = fwidth(q) * 1.5 + 0.12;
    float qs = (qi + smoothstep(0.5 - qa, 0.5 + qa, q - qi)) / uPoster;
    alb *= mix(1.0, qs / max(r, 1e-3), 1.0 - sf.mask);
  }
#endif
  alb = desat(alb, uDesat);

  // ---- ink widths: constant in pixels (or following the zoom, clamped), uneven by world-space wobble
  float wpx = clamp(uInkW.y * ppt, uInkW.x, max(uInkW.x, uInkW.z));
  float wW = wpx * wpp;
  float bt = uBoil > 0.0 ? floor(uTime * uBoil) : 0.0;
  float wob = (vnoise(wp.xy * 1.7 + bt * 7.13) - 0.5) * 1.6 + (vnoise(wp.xy * 5.9 + 3.0 + bt * 3.71) - 0.5) * 0.7;
  float wE = wW * max(0.3, 1.0 + uWobble * wob);
  float aa = wpp * 0.75;

  // ---- drawn rock structure: beds and joints, blocks and cracks, stipple and pebbles
  RockInk rk;
  rk.lines = 0.0;
  rk.fine = 0.0;
  rk.cell = 0.5;
  rk.bev = 0.0;
#ifdef CHUNKS
  if (cap && !unexplored) {
#ifdef ROCK_NATURAL
    rk = rockInkNatural(pat, wp.xy, p3.x, wpp, uChunk, wE * uChunkInk, aa);
#else
    rk = rockInk(pat, wp.xy, p3.x, wpp, uChunk, wE * uChunkInk, aa);
#endif
    alb *= mix(1.0, (0.88 + 0.24 * rk.cell) * (1.0 + uBevel * rk.bev), cut ? 1.0 : 0.5);
  }
#endif
#ifdef BRUSH
  {
    float ang = (pat == 1 ? 0.15 : 0.7) * (rk.cell - 0.5) * 2.0;
    alb *= 1.0 + uBrush * brushStrokes(uv, ang, 1.0, lodFine) * (1.0 - 0.7 * sf.mask);
  }
#endif

  // ---- grass on soil open to the sky: flat two-tone tufts with a scalloped edge
  float grassMask = 0.0;
  float fringe = 0.0;
  if (grassy) {
    fringe = 0.17 + 0.08 * vnoise(vec2(wp.x * 7.0, 1.0)) + 0.05 * abs(sin(wp.x * 9.0));
    if (top) grassMask = 1.0;
    else if (cap) grassMask = 1.0 - smoothstep(fringe - wpp, fringe + wpp, fract(-wp.y));
    vec3 g = mix(vec3(0.06, 0.13, 0.03), vec3(0.15, 0.25, 0.05), step(0.5, vnoise(uv * 1.7)));
    alb = mix(alb, desat(g, uDesat * 0.5), grassMask);
  }

  // ---- light: warm hue of the light field over a cool ambient, smooth or banded
  vec3 V = normalize(uCamPos - wp);
  vec2 sp = cap ? wp.xy : wp.xy + N.xy * 0.5;
  float sunMix = outdoor ? 1.0 : (grassy ? 0.7 : 0.0);
  vec3 spec;
  vec3 L = worldLight(wp, N, sp, V, 12.0, sunMix, spec);
  float l0 = max(max(L.r, L.g), L.b);
  vec3 hue = desat(L / max(l0, 1e-3), uLightDesat);
  float l = pow(l0, uLightCurve); // pool falloff shaping
  float lb = lightBands(min(l, uBands > 0.5 ? 1.8 : 3.0), uBands, uBandSoft);
  float amb;
  float gain;
  if (cut) { amb = uCutAmb; gain = uCutLight; }
  else if (cap) { amb = uBackAmb; gain = uBackLight; }
  else { amb = uBackAmb * uSideDark; gain = uBackLight * uSideDark; }
  if (interior) {
    // back walls: the host rock repainted lighter and cooler; its layers stay readable
    vec3 painted = uBackTint * (lum(alb) / max(lum(mean), 0.02));
    alb = mix(alb, painted, uBackLift);
  }
  vec3 col = alb * (uAmbCool * amb * vAo + hue * lb * gain * mix(1.0, vAo, 0.5));
  // darkness takes colour, not shape: unlit surfaces drift to a cool grey (mineral grains keep some)
  float dk = 1.0 - smoothstep(0.05, 0.45, l);
  col = mix(col, vec3(lum(col)) * vec3(0.92, 0.98, 1.08), uDarkDesat * dk * (1.0 - 0.6 * sf.mask));
  col += sf.emissive * uEmissive;
  if (cut && uRimGlow > 0.0) {
    // R2B rim: the cut face next to open space catches the light in the rock's own colour
    float rim = smoothstep(0.92, 0.55, fogAt(wp.xy).y);
    col += hue * l * rim * uRimGlow * mix(vec3(1.0), min(alb * 2.5, vec3(1.2)), uRimTint);
  }

  // ---- shadow marks
  float dark = 1.0 - smoothstep(uShadowAt * 0.3, uShadowAt, l);
  vec3 inkC = uInk * mix(vec3(1.0), mean / max(lum(mean), 0.01), uInkTint);
#ifdef HATCH
  if (!unexplored) {
    float hw = vnoise(wp.xy * 0.8) - 0.5;
    float h1 = hatchLines(wp.xy, vec2(0.7071, 0.7071), wpp, uMarkPx, 1.25, hw);
    float h2 = hatchLines(wp.xy, vec2(-0.7071, 0.7071), wpp, uMarkPx, 1.25, -hw);
    float hm = max(h1 * smoothstep(0.12, 0.42, dark), h2 * smoothstep(0.62, 0.92, dark));
    col = mix(col, inkC * 2.0, hm * uHatch * (interior ? 0.6 : 1.0));
  }
#endif
#ifdef HALFTONE
  if (!unexplored) {
    float hd = halftoneDots(wp.xy, wpp, uMarkPx, dark * 0.5);
    col = mix(col, inkC * 2.0, hd * uHalftone * (interior ? 0.6 : 1.0));
  }
#endif

  // ---- ink
  float ink = 0.0;
  if (cap) {
    float dE = edgeDistance(vEdge, int(vMask + 0.5), uRound);
    ink = cut ? inkLine(dE, wE, aa) * uContour : inkLine(dE, wE * 0.5, aa) * uBackInk;
  } else {
    float span = max(vEdge.y, 1e-3);
    if (vMask > 0.5) ink = inkLine((1.0 - vEdge.x) * span, wE * 1.3, aa) * uLip;
    ink = max(ink, inkLine(vEdge.x * span, wE * 0.5, aa) * uBackInk);
  }
#ifdef CHUNKS
  float structure = max(rk.lines, rk.fine * 0.85) * (1.0 - grassMask);
  if (cut) ink = max(ink, structure);
  else if (cap) ink = max(ink, structure * uBackStruct * 0.6); // back walls: a lighter pencil line
#endif
  if (grassy && cap && !top) ink = max(ink, inkLine(abs(fract(-wp.y) - fringe), wE * 0.3, aa) * 0.8);
#ifdef GRAIN_INK
  if (pat == 3 || pat == 4) {
    float gd = abs(sf.mask - 0.5) / max(maskW, 1e-4);
    ink = max(ink, (1.0 - smoothstep(0.5, 1.5, gd)) * smoothstep(14.0, 36.0, ppt) * uGrainInk);
  }
#endif
  col = mix(col, inkC, clamp(ink, 0.0, 1.0));

  // ---- ores: faint aura at low zoom + drawn sparkles on grains
  vec2 owner = cap ? wp.xy : wp.xy - N.xy * 0.3;
  float ex = fogAt(owner).x;
  float exW = fwidth(ex);
  if (p4.a > 0.0) {
    float seen = smoothstep(0.2, 0.8, ex);
    col += p4.rgb * p4.a * (uOreAura + sf.mask * uGlintBase) * uGlint * seen;
#ifdef SPARKLE
    vec2 gq = uv * 2.5;
    vec2 gc = floor(gq);
    float gh = hash12(gc + 17.0);
    vec2 gp = (fract(gq) - 0.5 - (hash22(gc) - 0.5) * 0.4) / 2.5; // world offset from the star centre
    float ph = fract(uTime * 0.22 + gh * 7.0);
    float on = step(0.55, gh) * smoothstep(0.0, 0.1, ph) * (1.0 - smoothstep(0.35, 0.6, ph));
    float r = 5.5 * wpp * (0.7 + 0.3 * sin(ph * 6.2832));
    float wl = 0.9 * wpp;
    float arm1 = (1.0 - smoothstep(wl * 0.3, wl, abs(gp.x) * (r / max(r - abs(gp.y), 1e-4)))) * step(abs(gp.y), r);
    float arm2 = (1.0 - smoothstep(wl * 0.3, wl, abs(gp.y) * (r / max(r - abs(gp.x), 1e-4)))) * step(abs(gp.x), r);
    float star = max(arm1, arm2) * on * smoothstep(12.0, 26.0, ppt);
    col = mix(col, mix(p4.rgb, vec3(1.0), 0.45) * (1.2 + 0.6 * p4.a), star * uSparkle * seen);
#endif
  }

  // ---- fog of war: an unmapped scrap, densely hatched, with an ink border
  if (ex < 0.999) {
    float fw = vnoise(wp.xy * 0.6) - 0.5;
    float f1 = hatchLines(wp.xy, vec2(0.8, 0.6), wpp, uFogHatchPx, 1.15, fw);
    float f2 = hatchLines(wp.xy, vec2(-0.6, 0.8), wpp, uFogHatchPx * 1.5, 1.0, -fw);
    vec3 fogc = uFogCol * (1.0 + 0.25 * (vnoise(wp.xy * 0.35) - 0.5));
    fogc = mix(fogc, uFogCol * 2.6, max(f1, f2 * 0.6) * uFogHatch);
    col = mix(fogc, col, smoothstep(0.42, 0.58, ex));
    float fd = abs(ex - 0.5) / max(exW, 1e-4);
    float fink = (1.0 - smoothstep(wpx * 0.6, wpx * 0.6 + 1.0, fd)) * 0.9 * step(0.03, ex);
    col = mix(col, uInk, fink);
    ink = max(ink, fink);
  }
#ifdef PAPER
  col *= 1.0 + uPaper * paperGrain(wp.xy, wpp);
#endif
  // lava light (redder than torches and lanterns) restores the ink more softly: glow close to L00
  float lavaZone = smoothstep(0.54, 0.6, (L.r - L.g) / max(L.r, 1e-3)) * smoothstep(0.05, 0.3, l0);
  gl_FragColor = vec4(col, inkAlpha(clamp(ink, 0.0, 1.0), mix(1.0, uLavaInk, lavaZone))); // alpha: ink coverage
}
`;

const PROP_VERT = /* glsl */ `
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

const PROP_FRAG = /* glsl */ `
${GLSL_WORLD}
${GLSL_NOISE}
${GLSL_LIGHT}
${GLSL_INK}
${ILL_UNIFORMS}
uniform float uPropAmb;
uniform float uPropLight;
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vPos;
varying float vEmi;
void main() {
  if (fogAt(vPos.xy).x < 0.5) discard; // never leak shapes of unexplored props
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(uCamPos - vPos);
  vec3 spec;
  vec3 L = worldLight(vPos, N, vPos.xy, V, 16.0, smoothstep(0.55, 0.95, lightAt(vPos.xy).a), spec);
  float l = max(max(L.r, L.g), L.b);
  vec3 hue = desat(L / max(l, 1e-3), uLightDesat);
  float lb = lightBands(min(l, 1.8), uBands, uBandSoft);
  // flat two-tone form: a lit side and a shade side from the illustrator's key light
  float form = smoothstep(-0.12, 0.18, dot(N, normalize(vec3(-0.45, 0.75, 0.5))));
  vec3 base = desat(vColor, uDesat);
  vec3 col = base * (uAmbCool * uPropAmb + hue * lb * uPropLight) * mix(0.66, 1.0, form);
  float dk = 1.0 - smoothstep(0.05, 0.45, l);
  col = mix(col, vec3(lum(col)) * vec3(0.92, 0.98, 1.08), uDarkDesat * dk);
  col += vColor * vEmi * uPropGlow;
  gl_FragColor = vec4(col, 1.0);
}
`;

const FLUID_VERT = /* glsl */ `
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

const FLUID_FRAG = /* glsl */ `
${GLSL_WORLD}
${GLSL_NOISE}
${GLSL_LIGHT}
${GLSL_INK}
${ILL_UNIFORMS}
varying vec3 vPos;
varying float vKind;
varying float vSurf;
void main() {
#ifdef ONLY_WATER
  if (vKind > 1.5) discard;
#endif
#ifdef ONLY_LAVA
  if (vKind < 1.5) discard;
#endif
  vec2 p = vPos.xy;
  float wpp = worldPerPixel(vPos, uCamPos);
  float wW = uInkW.x * wpp;
  float aa = wpp * 0.75;
  bool face = vSurf < 1.5;
  float dTop = (1.0 - clamp(vSurf, 0.0, 1.0)) * 0.88; // world distance below the surface line
  if (vKind < 1.5) {
    // water: flat teal body, light in bands, streaks, a light rim and an ink line on top
    vec4 Lr = lightAt(p);
    float l = max(max(Lr.r, Lr.g), Lr.b) + Lr.a * 0.4;
    float lb = lightBands(min(l, 1.6), uBands, uBandSoft);
    float streak = vnoise(vec2(p.x * 0.7 + uTime * 0.06, p.y * 5.0));
    vec3 col = mix(vec3(0.02, 0.055, 0.075), vec3(0.075, 0.2, 0.24), clamp(lb, 0.0, 1.2)) * (0.88 + 0.24 * streak);
    col += uAmbCool * 0.02;
    if (face && vSurf > 0.01) {
      col = mix(col, vec3(0.22, 0.42, 0.45) * (0.5 + lb), inkLine(dTop - wW, wpp * 2.0, aa) * 0.8);
      col = mix(col, uInk, inkLine(dTop, wW * 0.8, aa));
    }
    if (!face) col = vec3(0.06, 0.14, 0.17) * (0.6 + lb * 0.7);
    gl_FragColor = vec4(col, face ? 0.82 : 0.9);
  } else {
    // lava: hot flat body, dark crust plates outlined in ink, ink line on the surface
    p += uHeat * vec2(sin(p.y * 7.0 + uTime * 5.0), sin(p.x * 5.0 + uTime * 4.3)) * 0.5;
    vec2 q = p * 1.5 + vec2(uTime * 0.05, -uTime * 0.02);
    vec4 v = voronoi(q);
    float e = (v.y - v.x) * 0.5 / 1.5;
    float crust = step(0.6, hash12(v.zw));
    float f = vnoise(p * 1.1 + uTime * 0.1);
    vec3 hot = mix(vec3(1.2, 0.3, 0.04), vec3(1.7, 0.72, 0.15), step(0.5, f)) * uLavaEmit;
    vec3 col = mix(hot, vec3(0.08, 0.03, 0.02), crust);
    float cover = inkLine(e, wW * 0.45, aa) * crust;
    col = mix(col, uInk, cover);
    if (face && vSurf > 0.01) {
      float top = inkLine(dTop, wW * 0.8, aa);
      col = mix(col, uInk, top);
      cover = max(cover, top);
    }
    if (!face) col *= 0.7;
    gl_FragColor = vec4(col, inkAlpha(cover, uLavaInk)); // opaque lava mesh: alpha = ink coverage
  }
}
`;

const AIR_FRAG = /* glsl */ `
uniform float uStrength;
${GLSL_WORLD}
${GLSL_NOISE}
${GLSL_LIGHT}
${GLSL_INK}
${ILL_UNIFORMS}
varying vec3 vPos;
void main() {
  vec2 p = vPos.xy;
  if (int(tileAt(p).g * 255.0 + 0.5) == 1) discard;
  vec2 fg = fogAt(p);
  vec4 L = lightAt(p);
  float l = max(max(L.r, L.g), L.b);
  vec3 hue = desat(L.rgb / max(l, 1e-3), uLightDesat);
  float lb = lightBands(min(pow(l, uLightCurve), 1.6), uBands, uBandSoft);
  vec3 banded = hue * lb;
  vec3 smoothL = hue * pow(l, uLightCurve);
  float dust = mix(1.0, 0.75 + 0.5 * fbm3(p * 0.7 + vec2(uTime * 0.04, uTime * 0.015)), uAirSmooth);
  vec3 c = (mix(banded, smoothL, uAirSmooth) + L.a * uSkyLight * uShaft) * uStrength * (1.0 - fg.y) * dust * fg.x;
  gl_FragColor = vec4(c, 1.0);
}
`;

const PLANE_VERT = /* glsl */ `varying vec3 vPos; void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vPos = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;

const v3 = (a: [number, number, number]) => new THREE.Vector3(...a);

/** Uniforms of the style shared by every material (one object per style instance). */
function styleUniforms(p: IllParams): WorldUniforms {
  return {
    uInk: { value: new THREE.Color(0.016, 0.011, 0.009) },
    uInkTint: { value: p.inkTint },
    uContour: { value: p.contour },
    uInkW: { value: new THREE.Vector3(p.inkPx, p.inkWorld, p.inkMaxPx) },
    uWobble: { value: p.wobble },
    uBoil: { value: p.boil },
    uRound: { value: p.round },
    uLip: { value: p.lip },
    uBackInk: { value: p.backInk },
    uChunk: { value: Math.max(p.chunk, 0.01) },
    uChunkInk: { value: p.chunkInk },
    uBackStruct: { value: p.backStruct },
    uBevel: { value: p.bevel },
    uDarkDesat: { value: p.darkDesat },
    uGrainInk: { value: p.grainInk },
    uSparkle: { value: p.sparkle },
    uValueTarget: { value: p.valueTarget },
    uValueComp: { value: p.valueComp },
    uPoster: { value: p.poster },
    uFlat: { value: p.flat },
    uFlatBack: { value: p.flatBack },
    uBrush: { value: p.brush },
    uDesat: { value: p.desat },
    uLightDesat: { value: p.lightDesat },
    uBands: { value: p.bands },
    uBandSoft: { value: p.bandSoft },
    uAmbCool: { value: v3(p.ambCool) },
    uCutAmb: { value: p.cutAmb },
    uCutLight: { value: p.cutLight },
    uBackAmb: { value: p.backAmb },
    uBackLight: { value: p.backLight },
    uBackLift: { value: p.backLift },
    uBackTint: { value: v3(p.backTint) },
    uSideDark: { value: p.sideDark },
    uEmissive: { value: p.emissive },
    uHatch: { value: p.hatch },
    uHalftone: { value: p.halftone },
    uShadowAt: { value: p.shadowAt },
    uMarkPx: { value: p.markPx },
    uFogCol: { value: v3(p.fogCol) },
    uFogHatch: { value: p.fogHatch },
    uFogHatchPx: { value: p.fogHatchPx },
    uPaper: { value: p.paper },
    uLightCurve: { value: p.lightCurve },
    uRimGlow: { value: p.rimGlow },
    uAirSmooth: { value: p.airSmooth },
    uShaft: { value: p.shaft },
    uLavaEmit: { value: p.lavaEmit },
    uHeat: { value: p.heat },
    uPropGlow: { value: p.propGlow },
    uLavaInk: { value: p.lavaInk },
    uPropAmb: { value: p.propAmb },
    uPropLight: { value: p.propLight },
  };
}

function terrainDefines(p: IllParams): Record<string, number> {
  const d: Record<string, number> = {};
  if (p.chunk > 0) d.CHUNKS = 1;
  if (p.brush > 0) d.BRUSH = 1;
  if (p.poster > 0) d.POSTER = 1;
  if (p.hatch > 0) d.HATCH = 1;
  if (p.halftone > 0) d.HALFTONE = 1;
  if (p.grainInk > 0) d.GRAIN_INK = 1;
  if (p.sparkle > 0) d.SPARKLE = 1;
  if (p.paper > 0) d.PAPER = 1;
  if (p.rockNatural > 0) d.ROCK_NATURAL = 1;
  return d;
}

/** Props that are too thin for a hull (blades, stems). */
const THIN = new Set<number>([PROP.GRASS, PROP.FLOWER]);

export interface IllustratedScene {
  scene: THREE.Scene;
  sky: SkyView;
  u: WorldUniforms;
  params: IllParams;
}

/** Build the illustrated scene: terrain, props (+ hulls), dwarves, fluids, optional air, sky. */
export function buildIllustratedScene(ctx: StyleContext, p: IllParams): IllustratedScene {
  const scene = new THREE.Scene();
  const u: WorldUniforms = {
    ...worldUniforms(ctx),
    uPxScale: { value: pxScale(ctx.camera, ctx.height) },
    uRes: { value: new THREE.Vector2(ctx.width, ctx.height) },
  };
  Object.assign(u, styleUniforms(p));
  const sky = new SkyView(ctx.world);
  scene.add(sky.group);

  const terrain = new THREE.ShaderMaterial({ vertexShader: TERRAIN_VERT, fragmentShader: TERRAIN_FRAG, uniforms: u, defines: terrainDefines(p) });
  scene.add(new THREE.Mesh(buildHeightfield(ctx.world, 0, 0, ctx.world.w, ctx.world.h), terrain));

  const fill = (wind: number, side: THREE.Side) =>
    new THREE.ShaderMaterial({
      vertexShader: PROP_VERT,
      fragmentShader: PROP_FRAG,
      uniforms: { ...u, uWind: { value: wind } },
      side,
      defines: wind ? { WIND: 1 } : {},
    });
  const propFill = fill(0, THREE.FrontSide);
  const propWind = fill(0.05, THREE.DoubleSide);
  const ink = u.uInk!.value as THREE.Color;
  const hullStill = p.hullPx > 0 ? inkHullMaterial(u, p.hullPx, ink) : null;
  const hullWind = p.hullPx > 0 ? inkHullMaterial(u, p.hullPx, ink, 0.05) : null;
  const geos = buildPropGeometries();
  const props = new THREE.Group();
  for (const pi of collectProps(ctx.world)) {
    if (pi.matrices.length === 0) continue;
    const windy = WINDY.has(pi.type);
    const mesh = new THREE.InstancedMesh(geos[pi.type]!, windy ? propWind : propFill, pi.matrices.length);
    pi.matrices.forEach((mm, i) => mesh.setMatrixAt(i, mm));
    pi.colors.forEach((c, i) => mesh.setColorAt(i, c));
    mesh.frustumCulled = false;
    props.add(mesh);
    if (hullStill && hullWind && !THIN.has(pi.type)) {
      const hull = new THREE.InstancedMesh(hullGeometry(geos[pi.type]!), windy ? hullWind : hullStill, pi.matrices.length);
      pi.matrices.forEach((mm, i) => hull.setMatrixAt(i, mm));
      hull.frustumCulled = false;
      props.add(hull);
    }
  }
  scene.add(props);
  scene.add(buildDressing(ctx, propFill, (geo) => (hullStill ? { geo: hullGeometry(geo), material: hullStill } : null)));

  const dwarfFill = new THREE.ShaderMaterial({
    vertexShader: PROP_VERT,
    fragmentShader: PROP_FRAG,
    uniforms: { ...u, uWind: { value: 0 }, uPropAmb: { value: p.propAmb * 1.25 } },
  });
  const dwarfHull = p.hullDwarfPx > 0 ? inkHullMaterial(u, p.hullDwarfPx, ink) : null;
  ctx.world.mannequins.forEach((mq, i) => {
    const geo = buildMannequin(mq.pose, i + 3);
    const meshes = [new THREE.Mesh(geo, dwarfFill)];
    if (dwarfHull) meshes.push(new THREE.Mesh(hullGeometry(geo), dwarfHull));
    for (const mesh of meshes) {
      mesh.position.set(mq.x, mq.y, mq.y > -11 ? -1.2 : -0.45);
      mesh.rotation.y = mq.facing > 0 ? 0.9 : -0.9;
      scene.add(mesh);
    }
  });

  // water: translucent, keeps the scene alpha; lava: opaque, writes its own ink coverage into alpha
  const fluidGeo = buildFluidGeometry(ctx.world);
  const water = new THREE.Mesh(
    fluidGeo,
    new THREE.ShaderMaterial({
      vertexShader: FLUID_VERT, fragmentShader: FLUID_FRAG, uniforms: u, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      defines: { ONLY_WATER: 1 },
      blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    }),
  );
  water.renderOrder = 2;
  const lava = new THREE.Mesh(
    fluidGeo,
    new THREE.ShaderMaterial({ vertexShader: FLUID_VERT, fragmentShader: FLUID_FRAG, uniforms: u, side: THREE.DoubleSide, defines: { ONLY_LAVA: 1 } }),
  );
  lava.renderOrder = 2;
  scene.add(water, lava);

  if (p.air > 0) {
    const { w, h } = ctx.world;
    const air = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.ShaderMaterial({
        vertexShader: PLANE_VERT,
        fragmentShader: AIR_FRAG,
        uniforms: { ...u, uStrength: { value: p.air } },
        transparent: true,
        depthWrite: false,
        // additive colour, alpha (ink coverage) kept
        blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
        blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
      }),
    );
    air.position.set(w / 2, -h / 2, -0.25);
    air.renderOrder = 5;
    scene.add(air);
  }
  return { scene, sky, u, params: p };
}

/** Lab knob: `nobloom=1` renders the same frame without bloom (line-survival guard). */
function noBloom(): boolean {
  return new URLSearchParams(globalThis.location?.search ?? '').get('nobloom') === '1';
}

/** Extra content for a style instance (e.g. the dwarf team's models), added before the post chain is built. */
export type SceneExtra = (scene: THREE.Scene, u: WorldUniforms, p: IllParams) => void;

/** Post chain: R2B's (RenderPass, UnrealBloom, grade, ACES output) or the merged InkPost. */
export function createIllustrated(ctx: StyleContext, p: IllParams): StyleInstance {
  return createIllustratedWith(ctx, p);
}

/**
 * The same renderer with extra meshes in the scene: they get the same light, bloom and ink-over-bloom
 * chain. A mesh that should keep its outline over the glow writes alpha = 1 - 0.5 * ink (the hull
 * material from render/ink.ts already does).
 */
export function createIllustratedWith(ctx: StyleContext, p: IllParams, extra?: SceneExtra): StyleInstance {
  if (p.post === 'ink') return createInkPosted(ctx, p, extra);
  const { scene, sky, u } = buildIllustratedScene(ctx, p);
  extra?.(scene, u, p);
  const post = new PostFX(ctx.renderer, scene, ctx.camera, ctx.width, ctx.height);
  let inkPass: DepthInkPass | null = null;
  if (p.postInk > 0) {
    // both composer targets carry a depth texture (the read buffer alternates between them)
    for (const rt of [post.composer.renderTarget1, post.composer.renderTarget2]) rt.depthTexture = new THREE.DepthTexture(ctx.width, ctx.height);
    inkPass = new DepthInkPass(ctx.camera, { width: p.postInkPx, strength: p.postInk, boil: p.boil });
    (inkPass.material.uniforms.uInk!.value as THREE.Color).copy(u.uInk!.value as THREE.Color);
    post.composer.insertPass(inkPass, 1);
  }
  ctx.renderer.toneMappingExposure = p.exposure;
  let capture: InkCapturePass | null = null;
  if (p.inkOver > 0) {
    // after RenderPass (and the depth ink if any): capture; right after the bloom: ink over the glow
    capture = new InkCapturePass(ctx.width, ctx.height);
    const passes = post.composer.passes;
    post.composer.insertPass(capture, passes.indexOf(post.bloom));
    post.composer.insertPass(new InkOverPass(capture, p.inkOver), passes.indexOf(post.bloom) + 1);
  }
  post.bloom.strength = noBloom() ? 0 : p.bloom;
  post.bloom.radius = p.bloomRadius;
  post.bloom.threshold = p.bloomThreshold;
  const g = post.grade.uniforms;
  g.uSaturation!.value = p.saturation;
  g.uVignette!.value = p.vignette;
  g.uGrain!.value = p.grain;
  post.setSize(ctx.width, ctx.height);
  return {
    render(f: FrameState) {
      updateWorldUniforms(u, f, ctx.camera);
      sky.update(f.day, f.time, ctx.camera.position);
      if (inkPass) inkPass.material.uniforms.uTime!.value = f.time;
      post.render(f.time);
    },
    resize(w: number, h: number) {
      post.setSize(w, h);
      (u.uRes!.value as THREE.Vector2).set(w, h);
      u.uPxScale!.value = pxScale(ctx.camera, h);
    },
  };
}

function createInkPosted(ctx: StyleContext, p: IllParams, extra?: SceneExtra): StyleInstance {
  const { scene, sky, u } = buildIllustratedScene(ctx, p);
  extra?.(scene, u, p);
  ctx.renderer.toneMappingExposure = p.exposure;
  const post = new InkPost(ctx.renderer, scene, ctx.camera, ctx.width, ctx.height, {
    bloom: noBloom() ? 0 : p.bloom,
    bloomRadius: p.bloomRadius,
    bloomThreshold: p.bloomThreshold,
    inkMask: p.inkMask,
    inkMaskHi: p.inkMaskHi,
    inkMaskMode: p.inkMaskAlpha > 0 ? 'alpha' : 'luma',
    depthInk: p.postInk,
    depthInkPx: p.postInkPx,
    saturation: p.saturation,
    vignette: p.vignette,
    grain: p.grain,
    tone: p.tone,
    exposure: p.exposure,
    ink: u.uInk!.value as THREE.Color,
  });
  return {
    render(f: FrameState) {
      updateWorldUniforms(u, f, ctx.camera);
      sky.update(f.day, f.time, ctx.camera.position);
      post.render(f.time);
    },
    resize(w: number, h: number) {
      post.setSize(w, h);
      (u.uRes!.value as THREE.Vector2).set(w, h);
      u.uPxScale!.value = pxScale(ctx.camera, h);
    },
  };
}

/** Variant definitions of round 1 (names in Polish for the sheets). */
export interface IllVariant {
  id: string;
  namePl: string;
  descPl: string;
  params: Partial<IllParams>;
}

export const ILL_VARIANTS: readonly IllVariant[] = [
  {
    id: 'i01-outline',
    namePl: 'Obrys na R2B',
    descPl: 'Minimalna zmiana: nastrój R2B (gładkie światło, świecące powietrze), tylko kontur skała/pustka, warga ścian i obrys rekwizytów.',
    params: { chunk: 0, brush: 0, bands: 0, desat: 0.1, lightDesat: 0.15, cutAmb: 0.3, backAmb: 0.85, backLift: 0, backInk: 0, air: 0.1, grainInk: 0, sparkle: 0, paper: 0, bloom: 0.8, bloomThreshold: 0.65, saturation: 1.0, fogHatch: 0.5 },
  },
  {
    id: 'i02-stones',
    namePl: 'Kamienie tuszem',
    descPl: 'Lico skały rysowane jako bryły z fugami tuszem i fazą, lekki pędzel, gładkie światło.',
    params: { bands: 0, poster: 5 },
  },
  {
    id: 'i03-bands3',
    namePl: 'Trzy pasma',
    descPl: 'Bryły tuszem + światło w 3 miękkich pasmach, ciepłe plamy na chłodnym tle, jaśniejsze tła wnęk.',
    params: {},
  },
  {
    id: 'i04-hatch',
    namePl: 'Kreskowanie',
    descPl: '2 pasma, cienie kreskowane (krzyżowo w najgłębszym mroku), gęsto kreskowane nieodkryte, papier.',
    params: { bands: 2, bandSoft: 0.1, hatch: 0.75, shadowAt: 0.35, markPx: 7, paper: 0.08, poster: 4 },
  },
  {
    id: 'i05-halftone',
    namePl: 'Półtony',
    descPl: '3 pasma, cienie z rastra półtonowego jak w druku komiksowym, nieco żywsza paleta.',
    params: { halftone: 0.7, shadowAt: 0.38, markPx: 6, desat: 0.1, saturation: 1.0 },
  },
  {
    id: 'i06-gouache',
    namePl: 'Gwasz',
    descPl: 'Malarsko: gładkie światło, mocny pędzel i posteryzacja plam, cieńsza i bardziej drżąca kreska, bez brył, mocny papier.',
    params: { chunk: 0, bands: 0, brush: 0.32, poster: 4, inkPx: 1.8, inkMaxPx: 1.8, wobble: 0.8, paper: 0.12, backLift: 0.45, grainInk: 0.5 },
  },
  {
    id: 'i07-zoomline',
    namePl: 'Kreska z zoomem',
    descPl: 'Grubość kreski rośnie ze zbliżeniem (0,09 kafla, 1,5–5 px), duże bryły, 3 pasma — test przeciw „stałej w pikselach”.',
    params: { inkPx: 1.5, inkWorld: 0.09, inkMaxPx: 5, chunk: 2.4, chunkInk: 0.35, bevel: 0.45 },
  },
  {
    id: 'i08-depth',
    namePl: 'Głębia warstw',
    descPl: 'Akcent 2.5D: jasne, chłodne tylne ściany z warstwami skały, linia styku tła ze ścianami, ciemne boki wnęk, mocna warga.',
    params: { backLift: 0.5, backAmb: 1.6, backInk: 0.85, sideDark: 0.42, lip: 1, backTint: [0.27, 0.29, 0.3] },
  },
  {
    id: 'i09-sobel',
    namePl: 'Kontur z głębi (post)',
    descPl: 'Kreska tylko z bufora głębi w post-procesie (Laplasjan, 2,6 px) — także rekwizyty i krajobraz; bez konturu w shaderze i bez obrysu skorupy.',
    params: { contour: 0, lip: 0, backInk: 0, chunk: 0, hullPx: 0, hullDwarfPx: 0, postInk: 0.95, postInkPx: 1.6, poster: 5 },
  },
  {
    id: 'i10-hybrid',
    namePl: 'Hybryda',
    descPl: 'Kontur i bryły w shaderze terenu + kontur z głębi w poście dla rekwizytów, postaci i krajobrazu (bez skorup), papier.',
    params: { hullPx: 0, hullDwarfPx: 0, postInk: 0.9, postInkPx: 1.2, paper: 0.08 },
  },
  {
    id: 'i12-darkmine',
    namePl: 'Ciemna kopalnia',
    descPl: 'Ciemniej: niski ambient, 4 pasma ciepłego światła, mrok mocno zabiera kolor (kreska zostaje), ciężka kreska 3 px, gęste kreskowanie nieodkrytego.',
    params: { cutAmb: 0.38, backAmb: 0.85, cutLight: 0.75, bands: 4, darkDesat: 0.85, inkPx: 3, inkMaxPx: 3, fogHatchPx: 5, desat: 0.25, bloom: 0.55 },
  },
  {
    id: 'i13-lightsection',
    namePl: 'Jasny przekrój',
    descPl: 'Odwrócone wartości: lico skały jasne jak papier przekroju, wnęki ciemniejsze z ciepłymi plamami światła, mocne bryły.',
    params: { cutAmb: 0.95, cutLight: 0.45, valueComp: 0.55, valueTarget: 0.2, backAmb: 0.55, backLift: 0.2, sideDark: 0.5, bevel: 0.45, darkDesat: 0.3 },
  },
];

export function illParams(v: Partial<IllParams>): IllParams {
  return { ...ILL_BASE, ...v };
}

export const ILLUSTRATED: readonly RenderStyle[] = ILL_VARIANTS.map((v) => ({
  id: v.id,
  namePl: v.namePl,
  descPl: v.descPl,
  create: (ctx: StyleContext) => createIllustrated(ctx, illParams(v.params)),
}));

// ------------------------------------------------------------------ round 2, C1: light layer
/** i08 "Głębia warstw" — the owner's base after round 1 (drawing: structure, ink, depth cues). */
export const I08_DRAWING: Partial<IllParams> = ILL_VARIANTS.find((v) => v.id === 'i08-depth')!.params;

/** R2B's light 1:1 (bloom, glowing air, lamp tint, rim glow, grade) on top of a drawing. */
const R2B_LIGHT: Partial<IllParams> = {
  post: 'r2b', bloom: 0.95, bloomRadius: 0.8, bloomThreshold: 0.62, saturation: 1.1, vignette: 0.55, grain: 0.035, exposure: 1.05,
  ambCool: [1.0, 0.94, 0.84], cutAmb: 0.055, cutLight: 0.42, rimGlow: 0.35, backAmb: 0.3, backLight: 1.15,
  bands: 0, lightDesat: 0, darkDesat: 0, desat: 0, air: 0.14, airSmooth: 1, shaft: 0.4, emissive: 1.5, lightCurve: 1,
};
/** Value plan of round 2 (producer): background out of light ~14 L* under the cut face, pools fall off. */
const PLAN: Partial<IllParams> = {
  post: 'ink', bloom: 0.9, bloomRadius: 0.8, bloomThreshold: 0.65, saturation: 1.05, vignette: 0.5, grain: 0.03, exposure: 1.05,
  ambCool: [0.62, 0.74, 0.82], cutAmb: 0.65, cutLight: 0.35, rimGlow: 0.35, backAmb: 0.45, backLight: 0.6, backLift: 0.3,
  bands: 0, lightDesat: 0, darkDesat: 0.25, desat: 0.05, air: 0.12, airSmooth: 1, shaft: 0.4, emissive: 1.5, lightCurve: 1.6,
};

export const LIGHT_VARIANTS: readonly IllVariant[] = [
  { id: 'l00-r2b', namePl: 'L00 Światło R2B 1:1', descPl: 'Rysunek i08 + światło R2B bez zmian (UnrealBloom 0,95/0,8/0,62, poświata powietrza, barwienie lampą, poświata krawędzi).', params: { ...R2B_LIGHT } },
  { id: 'l01-mip', namePl: 'L01 R2B na bloomie mip', descPl: 'Jak L00, ale scalony post (bloom mipmapowy, jeden przebieg końcowy) — test kosztu.', params: { ...R2B_LIGHT, post: 'ink', bloom: 0.9 } },
  { id: 'l02-plan', namePl: 'L02 Plan wartości', descPl: 'Ciemne tło poza światłem (≈ lico −14 L*), stromszy spadek plam (γ 1,4), światło R2B, bloom mip.', params: { ...PLAN } },
  { id: 'l03-inkmask', namePl: 'L03 Kreska w blasku', descPl: 'L02 + maska bloomu z kreski: blask nie zamazuje ciemnej kreski.', params: { ...PLAN, inkMask: 1 } },
  { id: 'l04-tint', namePl: 'L04 Barwa lampy częściowo', descPl: 'L03 z barwą lampy złagodzoną (40%).', params: { ...PLAN, inkMask: 1, lightDesat: 0.4 } },
  { id: 'l05-neutral', namePl: 'L05 Światło neutralne', descPl: 'L03 bez barwienia kadru (80% odbarwienia światła).', params: { ...PLAN, inkMask: 1, lightDesat: 0.8 } },
  { id: 'l06-haze', namePl: 'L06 Mgiełka i smugi', descPl: 'L03 + mocniejsza poświata powietrza i smugi światła nieba.', params: { ...PLAN, inkMask: 1, air: 0.22, shaft: 0.8 } },
  { id: 'l07-emitters', namePl: 'L07 Rysowane plamy', descPl: 'L03 z bloomem tylko na emiterach (0,5, próg 0,9), 2 miękkie pasma plam, słaba mgiełka.', params: { ...PLAN, inkMask: 1, bloom: 0.5, bloomThreshold: 0.9, bands: 2, bandSoft: 0.2, air: 0.06 } },
  { id: 'l08-lava', namePl: 'L08 Żar', descPl: 'L03 + mocniejsza lawa (emisja ×1,4, drganie gorąca), poświata krawędzi 0,6, kryształy i grzyby ×1,5.', params: { ...PLAN, inkMask: 1, lavaEmit: 1.4, heat: 0.04, rimGlow: 0.6, emissive: 2.0, propGlow: 1.5 } },
  { id: 'l09-agx', namePl: 'L09 AgX', descPl: 'L03 z mapowaniem tonów AgX (ekspozycja 1,4).', params: { ...PLAN, inkMask: 1, tone: 'agx', exposure: 1.4 } },
  { id: 'l10-knee', namePl: 'L10 Własne kolano', descPl: 'L03 z własnym kolanem świateł (tanh nad 0,6, ekspozycja 1,6) zamiast ACES.', params: { ...PLAN, inkMask: 1, tone: 'knee', exposure: 1.6 } },
  {
    id: 'l12-r2b-ink',
    namePl: 'L12 Światło L00 + kreska L03',
    descPl: 'Łańcuch L00 bez zmian (UnrealBloom, gradacja, ACES) + kreska nad bloomem: piksele tuszu (pokrycie w alfie sceny) wracają po bloomie do koloru sprzed blasku.',
    params: { ...R2B_LIGHT, inkOver: 1 },
  },
  {
    id: 'l13-r2b-ink-ember',
    namePl: 'L13 L12 + żar lawy',
    descPl: 'L12 + lawa z L08: emisja ×1,4, drganie gorąca, poświata krawędzi 0,6, kryształy i grzyby ×1,5.',
    params: { ...R2B_LIGHT, inkOver: 1, lavaEmit: 1.4, heat: 0.04, rimGlow: 0.6, emissive: 2.0, propGlow: 1.5 },
  },
  {
    id: 'l14-r2b-ink-soft',
    namePl: 'L14 L00 + kreska 60%',
    descPl: 'Łańcuch L00 z łagodniejszym przywróceniem kreski po bloomie (0,6): najbliżej wyglądu L00.',
    params: { ...R2B_LIGHT, inkOver: 0.6 },
  },
  {
    id: 'l15-r2b-ink-amb',
    namePl: 'L15 L12 + jaśniejszy ambient',
    descPl: 'L12 z podniesionym ambientem lica i tła, żeby czerń < 15 L* spadła do ok. 25%.',
    params: { ...R2B_LIGHT, inkOver: 1, cutAmb: 0.25, backAmb: 0.42 },
  },
  {
    id: 'l16-winner',
    namePl: 'L16 Zwycięzca: L12 + lawa L14',
    descPl: 'Wybór właściciela: łańcuch L00, kreska nad bloomem w całym kadrze, w świetle lawy przywracana w 60% (jak L14), żeby blask lawy był bliski L00.',
    params: { ...R2B_LIGHT, inkOver: 1, lavaInk: 0.6 },
  },
  { id: 'l11-night', namePl: 'L11 Noc (dawca i12)', descPl: 'L03 + najstromszy spadek (γ 1,8), ciemniejszy ambient, mrok mocniej zabiera kolor.', params: { ...PLAN, inkMask: 1, lightCurve: 1.8, cutAmb: 0.55, backAmb: 0.38, darkDesat: 0.6 } },
];

export const LIGHT_STYLES: readonly RenderStyle[] = LIGHT_VARIANTS.map((v) => ({
  id: v.id,
  namePl: v.namePl,
  descPl: v.descPl,
  create: (ctx: StyleContext) => createIllustrated(ctx, illParams({ ...I08_DRAWING, ...v.params })),
}));

// ------------------------------------------------------------------ round 2, C2: natural rock language
/** Light-layer leader of C1 (set from the C1 results). */
export const LIGHT_LEADER = 'l03-inkmask';
const leader = (): Partial<IllParams> => LIGHT_VARIANTS.find((v) => v.id === LIGHT_LEADER)!.params;

export const ROCK_VARIANTS: readonly IllVariant[] = [
  { id: 'n0-atlas', namePl: 'N0 Atlas (kontrola)', descPl: 'i08 + lider światła; struktura skały z rundy 1 (ławice, prostopadłe spękania, bloki Voronoi).', params: { rockNatural: 0 } },
  { id: 'n1-natural', namePl: 'N1 Natura nieregularna', descPl: 'i08 + lider światła; falujące ławice o zmiennej miąższości, ukośne urwane spękania, bloki nierówne z zawirowanej siatki; mur bez zmian.', params: { rockNatural: 1 } },
];

export const ROCK_STYLES: readonly RenderStyle[] = ROCK_VARIANTS.map((v) => ({
  id: v.id,
  namePl: v.namePl,
  descPl: v.descPl,
  create: (ctx: StyleContext) => createIllustrated(ctx, illParams({ ...I08_DRAWING, ...leader(), ...v.params })),
}));

// ------------------------------------------------------------------ winner of the light layer (data)
/**
 * The game's illustrated style, version 1, as data (`src/render/illustrated-v1.json`): drawing of i08
 * "Głębia warstw" + light L16 (L00/R2B light, ink over the bloom, 60% in lava light). The game loads the
 * same JSON; tests/lab/illustrated-style.test.ts checks it still equals that composition.
 */
export const STYLE_ILLUSTRATED_V1 = { id: WINNER.id, namePl: WINNER.namePl, params: WINNER.params as IllParams };

export const WINNER_STYLE: RenderStyle = {
  id: 'w1-illustrated',
  namePl: 'Zwycięzca: ilustrowany v1',
  descPl: 'Styl gry wczytywany z danych (illustrated-v1.json): rysunek i08 + światło L16.',
  create: (ctx: StyleContext) => createIllustrated(ctx, STYLE_ILLUSTRATED_V1.params),
};
