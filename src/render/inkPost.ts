/**
 * Merged post chain for the illustrated style (tournament #3, round 2):
 *   scene -> HalfFloat MSAA target (+ depth texture when the depth ink is on)
 *   bloom: soft-threshold prefilter + dual-filter (Kawase) mip chain, 5 levels down, 4 up
 *          (additive in place) — about 1/3 of a full-resolution pass in total
 *   final (one full-screen pass to the canvas): depth ink, bloom with an ink mask (bloom does
 *          not wash out dark ink pixels), grade (saturation, split tone, vignette), tone mapping
 *          (ACES / AgX from three's chunks, or a soft knee), grain, sRGB.
 * Replaces RenderPass + UnrealBloom + grade + output (+ DepthInkPass): fewer full-res passes.
 */
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { GLSL_NOISE } from './shaderlib';

export interface InkPostOptions {
  bloom: number;
  bloomRadius: number;
  bloomThreshold: number;
  /** 0..1: keep dark (ink) pixels free of bloom spill. */
  inkMask: number;
  /** Linear luminance up to which a pixel counts as ink for the mask (anti-aliased edges included). */
  inkMaskHi?: number;
  /** 'alpha': the scene writes ink coverage into alpha (1 - 0.5·ink), exact; 'luma': dark pixels count as ink. */
  inkMaskMode?: 'alpha' | 'luma';
  depthInk: number;
  depthInkPx: number;
  saturation: number;
  vignette: number;
  grain: number;
  tone: 'aces' | 'agx' | 'knee';
  exposure: number;
  ink: THREE.Color;
}

const VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const PREFILTER = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThreshold; varying vec2 vUv;
void main() {
  vec3 c = (texture2D(tSrc, vUv + uTexel * vec2(-0.5, -0.5)).rgb + texture2D(tSrc, vUv + uTexel * vec2(0.5, -0.5)).rgb
          + texture2D(tSrc, vUv + uTexel * vec2(-0.5, 0.5)).rgb + texture2D(tSrc, vUv + uTexel * vec2(0.5, 0.5)).rgb) * 0.25;
  float br = max(c.r, max(c.g, c.b));
  float knee = uThreshold * 0.5;
  float soft = clamp(br - uThreshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 1e-4);
  gl_FragColor = vec4(c * max(soft, br - uThreshold) / max(br, 1e-4), 1.0);
}`;

const DOWN = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
void main() {
  vec2 h = uTexel * 0.5;
  vec3 s = texture2D(tSrc, vUv).rgb * 4.0 + texture2D(tSrc, vUv - h).rgb + texture2D(tSrc, vUv + h).rgb
         + texture2D(tSrc, vUv + vec2(h.x, -h.y)).rgb + texture2D(tSrc, vUv - vec2(h.x, -h.y)).rgb;
  gl_FragColor = vec4(s / 8.0, 1.0);
}`;

const UP = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uWeight; varying vec2 vUv;
void main() {
  vec2 h = uTexel * 0.5;
  vec3 s = texture2D(tSrc, vUv + vec2(-2.0 * h.x, 0.0)).rgb + texture2D(tSrc, vUv + vec2(-h.x, h.y)).rgb * 2.0
         + texture2D(tSrc, vUv + vec2(0.0, 2.0 * h.y)).rgb + texture2D(tSrc, vUv + vec2(h.x, h.y)).rgb * 2.0
         + texture2D(tSrc, vUv + vec2(2.0 * h.x, 0.0)).rgb + texture2D(tSrc, vUv + vec2(h.x, -h.y)).rgb * 2.0
         + texture2D(tSrc, vUv + vec2(0.0, -2.0 * h.y)).rgb + texture2D(tSrc, vUv + vec2(-h.x, -h.y)).rgb * 2.0;
  gl_FragColor = vec4(s / 12.0 * uWeight, 1.0);
}`;

const FINAL = /* glsl */ `
#include <tonemapping_pars_fragment>
uniform sampler2D tScene; uniform sampler2D tBloom; uniform sampler2D tDepth;
uniform vec2 uRes; uniform float uTime; uniform float uNear; uniform float uFar;
uniform float uBloom; uniform float uInkMask; uniform float uInkMaskHi; uniform float uDepthInk; uniform float uDepthInkPx; uniform vec3 uInk;
uniform float uSaturation; uniform float uVignette; uniform float uGrain;
varying vec2 vUv;
${GLSL_NOISE}
float linDepth(vec2 uv) { float z = texture2D(tDepth, uv).x * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
vec3 knee(vec3 c) { vec3 k = vec3(0.6); return mix(c, k + (1.0 - k) * tanh((c - k) / (1.0 - k)), step(k, c)); }
void main() {
  vec3 c = texture2D(tScene, vUv).rgb;
#ifdef DEPTH_INK
  {
    vec2 px = 1.0 / uRes;
    vec2 fc = gl_FragCoord.xy * 0.035;
    vec2 uv = vUv + (vec2(vnoise(fc), vnoise(fc + 7.7)) - 0.5) * 1.2 * px;
    float d = linDepth(uv);
    float s = 0.0;
    float mx = 0.0;
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.785398;
      float dn = linDepth(uv + vec2(cos(a), sin(a)) * uDepthInkPx * px);
      s += dn;
      mx = max(mx, d - dn);
    }
    float e = smoothstep(0.006, 0.015, max(abs(s * 0.125 - d) / d * 3.0, mx / d)) * (1.0 - smoothstep(70.0, 260.0, d));
    c = mix(c, uInk, e * uDepthInk);
  }
#endif
  vec3 b = texture2D(tBloom, vUv).rgb * uBloom;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
#ifdef INK_ALPHA
  b *= 1.0 - clamp((1.0 - texture2D(tScene, vUv).a) * 2.0, 0.0, 1.0) * uInkMask; // ink coverage from the scene
#else
  b *= mix(1.0, smoothstep(0.003, uInkMaskHi, l), uInkMask); // ink stays ink inside a glow
#endif
  c += b;
  l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(mix(vec3(l), c, uSaturation), 0.0);
  c *= mix(vec3(0.92, 0.97, 1.08), vec3(1.04, 1.0, 0.95), smoothstep(0.0, 0.6, l));
  vec2 dv = vUv - 0.5;
  c *= 1.0 - uVignette * smoothstep(0.1, 0.55, dot(dv, dv) * 1.6);
#if TONE == 1
  c = ACESFilmicToneMapping(c);
#elif TONE == 2
  c = AgXToneMapping(c);
#else
  c = knee(c * toneMappingExposure);
#endif
  c += (fract(sin(dot(vUv * uRes + fract(uTime) * 100.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * uGrain * (0.25 + sqrt(max(l, 0.0)));
  gl_FragColor = linearToOutputTexel(vec4(clamp(c, 0.0, 1.0), 1.0));
}`;

export class InkPost {
  private rt: THREE.WebGLRenderTarget;
  private mips: THREE.WebGLRenderTarget[] = [];
  private pre: THREE.ShaderMaterial;
  private down: THREE.ShaderMaterial;
  private up: THREE.ShaderMaterial;
  readonly final: THREE.ShaderMaterial;
  private quad = new FullScreenQuad();
  private levels = 5;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    w: number,
    h: number,
    private o: InkPostOptions,
  ) {
    this.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
    if (o.depthInk > 0) this.rt.depthTexture = new THREE.DepthTexture(w, h);
    const fs = (frag: string, uniforms: Record<string, THREE.IUniform>, blending: THREE.Blending = THREE.NoBlending) =>
      new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, blending, transparent: blending !== THREE.NoBlending, toneMapped: false });
    this.pre = fs(PREFILTER, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: o.bloomThreshold } });
    this.down = fs(DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.up = fs(UP, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uWeight: { value: o.bloomRadius } }, THREE.AdditiveBlending);
    this.final = fs(FINAL, {
      tScene: { value: null },
      tBloom: { value: null },
      tDepth: { value: null },
      uRes: { value: new THREE.Vector2(w, h) },
      uTime: { value: 0 },
      uNear: { value: camera.near },
      uFar: { value: camera.far },
      uBloom: { value: o.bloom },
      uInkMask: { value: o.inkMask },
      uInkMaskHi: { value: o.inkMaskHi ?? 0.03 },
      uDepthInk: { value: o.depthInk },
      uDepthInkPx: { value: o.depthInkPx },
      uInk: { value: o.ink.clone() },
      uSaturation: { value: o.saturation },
      uVignette: { value: o.vignette },
      uGrain: { value: o.grain },
    });
    this.final.defines = { TONE: o.tone === 'aces' ? 1 : o.tone === 'agx' ? 2 : 3, ...(o.depthInk > 0 ? { DEPTH_INK: 1 } : {}), ...(o.inkMaskMode === 'alpha' ? { INK_ALPHA: 1 } : {}) };
    this.setSize(w, h);
  }

  setSize(w: number, h: number): void {
    this.rt.setSize(w, h);
    this.mips.forEach((m) => m.dispose());
    this.mips = [];
    for (let i = 0; i < this.levels; i++) {
      const mw = Math.max(1, w >> (i + 1));
      const mh = Math.max(1, h >> (i + 1));
      this.mips.push(new THREE.WebGLRenderTarget(mw, mh, { type: THREE.HalfFloatType, depthBuffer: false }));
    }
    (this.final.uniforms.uRes!.value as THREE.Vector2).set(w, h);
  }

  private pass(mat: THREE.ShaderMaterial, src: THREE.Texture, srcW: number, srcH: number, dst: THREE.WebGLRenderTarget | null): void {
    mat.uniforms.tSrc!.value = src;
    (mat.uniforms.uTexel!.value as THREE.Vector2).set(1 / srcW, 1 / srcH);
    this.quad.material = mat;
    this.renderer.setRenderTarget(dst);
    this.quad.render(this.renderer);
  }

  render(time: number): void {
    const r = this.renderer;
    r.setRenderTarget(this.rt);
    r.render(this.scene, this.camera);
    const m = this.mips;
    const autoClear = r.autoClear;
    r.autoClear = false; // the up chain adds into the mips in place; every other pass covers the target
    if (this.o.bloom > 0) {
      this.pass(this.pre, this.rt.texture, this.rt.width, this.rt.height, m[0]!);
      for (let i = 1; i < m.length; i++) this.pass(this.down, m[i - 1]!.texture, m[i - 1]!.width, m[i - 1]!.height, m[i]!);
      for (let i = m.length - 2; i >= 0; i--) this.pass(this.up, m[i + 1]!.texture, m[i + 1]!.width, m[i + 1]!.height, m[i]!);
    }
    const u = this.final.uniforms;
    u.tScene!.value = this.rt.texture;
    u.tBloom!.value = m[0]!.texture;
    u.tDepth!.value = this.rt.depthTexture;
    u.uTime!.value = time;
    u.uBloom!.value = this.o.bloom;
    this.quad.material = this.final;
    r.setRenderTarget(null);
    this.quad.render(r);
    r.autoClear = autoClear;
  }
}
