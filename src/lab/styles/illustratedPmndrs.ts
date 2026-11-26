/**
 * Tournament #3 — library contestant: the I10 hybrid scene (shader ink on the terrain,
 * depth-buffer ink for props, dwarves and landscape) with the post chain replaced by
 * pmndrs/postprocessing 6.39.6 (Zlib licence): one merged EffectPass with a depth-ink
 * Effect, mipmap bloom, saturation, vignette, film grain and ACES tone mapping.
 * Compared with our chain (RenderPass, ink pass, UnrealBloom, grade, output) in identical
 * scenes: image, ms/frame and bundle size (docs/variants/03-illustrated-style.md).
 */
import {
  BlendFunction,
  BloomEffect,
  Effect,
  EffectAttribute,
  EffectComposer,
  EffectPass,
  HueSaturationEffect,
  NoiseEffect,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import * as THREE from 'three';
import { GLSL_NOISE } from '../../render/shaderlib';
import { pxScale } from '../../render/ink';
import { updateWorldUniforms } from '../common';
import type { FrameState, RenderStyle, StyleContext, StyleInstance } from '../style';
import { buildIllustratedScene, ILL_VARIANTS, illParams } from './illustrated';

/** Same algorithm as DepthInkPass (render/ink.ts), written as a mergeable pmndrs Effect. */
class DepthInkEffect extends Effect {
  constructor(width: number, strength: number, ink: THREE.Color) {
    super(
      'DepthInkEffect',
      /* glsl */ `
      uniform float uWidth;
      uniform float uStrength;
      uniform float uThreshold;
      uniform vec3 uInk;
      uniform vec2 uFadeFar;
      ${GLSL_NOISE}
      float inkDist(vec2 uv) { return -getViewZ(readDepth(uv)); }
      void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
        vec2 fc = uv * resolution * 0.035;
        vec2 wob = vec2(vnoise(fc), vnoise(fc + 7.7)) - 0.5;
        vec2 q = uv + wob * 1.2 * texelSize;
        float d = inkDist(q);
        float s = 0.0;
        float mx = 0.0;
        for (int i = 0; i < 8; i++) {
          float a = float(i) * 0.785398;
          float dn = inkDist(q + vec2(cos(a), sin(a)) * uWidth * texelSize);
          s += dn;
          mx = max(mx, d - dn);
        }
        float lap = abs(s * 0.125 - d) / d;
        float e = smoothstep(uThreshold, uThreshold * 2.5, max(lap * 3.0, mx / d));
        e *= 1.0 - smoothstep(uFadeFar.x, uFadeFar.y, d);
        outputColor = vec4(mix(inputColor.rgb, uInk, e * uStrength), inputColor.a);
      }`,
      {
        attributes: EffectAttribute.DEPTH,
        blendFunction: BlendFunction.NORMAL,
        uniforms: new Map<string, THREE.Uniform>([
          ['uWidth', new THREE.Uniform(width)],
          ['uStrength', new THREE.Uniform(strength)],
          ['uThreshold', new THREE.Uniform(0.006)],
          ['uInk', new THREE.Uniform(ink.clone())],
          ['uFadeFar', new THREE.Uniform(new THREE.Vector2(70, 260))],
        ]),
      },
    );
  }
}

const HYBRID = ILL_VARIANTS.find((v) => v.id === 'i10-hybrid')!;

export const I11_PMNDRS: RenderStyle = {
  id: 'i11-pmndrs',
  namePl: 'Hybryda + pmndrs',
  descPl: 'Scena hybrydy (i10), post-processing z biblioteki pmndrs/postprocessing: jeden scalony EffectPass (kreska z głębi, bloom mipmap, nasycenie, winieta, ziarno, ACES).',
  create(ctx: StyleContext): StyleInstance {
    const p = illParams(HYBRID.params);
    const { scene, sky, u } = buildIllustratedScene(ctx, p);
    const composer = new EffectComposer(ctx.renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 4 });
    composer.addPass(new RenderPass(scene, ctx.camera));
    const ink = new DepthInkEffect(p.postInkPx, p.postInk, u.uInk!.value as THREE.Color);
    const bloom = new BloomEffect({ mipmapBlur: true, intensity: p.bloom * 1.6, luminanceThreshold: p.bloomThreshold, luminanceSmoothing: 0.15, radius: p.bloomRadius + 0.15 });
    const sat = new HueSaturationEffect({ saturation: p.saturation - 1 });
    const vignette = new VignetteEffect({ darkness: p.vignette, offset: 0.35 });
    const noise = new NoiseEffect({ premultiply: true, blendFunction: BlendFunction.SCREEN });
    noise.blendMode.opacity.value = p.grain * 4;
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    composer.addPass(new EffectPass(ctx.camera, ink, bloom, sat, vignette, noise, tone));
    composer.setSize(ctx.width, ctx.height, false);
    return {
      render(f: FrameState) {
        updateWorldUniforms(u, f, ctx.camera);
        sky.update(f.day, f.time, ctx.camera.position);
        composer.render();
      },
      resize(w: number, h: number) {
        composer.setSize(w, h, false);
        (u.uRes!.value as THREE.Vector2).set(w, h);
        u.uPxScale!.value = pxScale(ctx.camera, h);
      },
    };
  },
};
