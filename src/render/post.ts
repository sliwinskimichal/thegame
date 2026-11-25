/**
 * Post-processing chain: HDR scene -> bloom -> grade (vignette, chromatic
 * fringe, saturation, grain, optional tilt-shift) -> tone mapping + sRGB.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const GradeShader = {
  name: 'GradeShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uVignette: { value: 0.55 },
    uGrain: { value: 0.035 },
    uSaturation: { value: 1.1 },
    uTiltShift: { value: 0 },
    uFocusY: { value: 0.5 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uRes;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uSaturation;
    uniform float uTiltShift;
    uniform float uFocusY;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    vec3 sampleCA(vec2 uv, vec2 d, float ca) {
      return vec3(texture2D(tDiffuse, uv + d * ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - d * ca).b);
    }
    void main() {
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      float ca = 0.006 * r2;
      vec3 c = sampleCA(vUv, d, ca);
      if (uTiltShift > 0.0) {
        float blur = uTiltShift * smoothstep(0.08, 0.45, abs(vUv.y - uFocusY));
        vec3 acc = c;
        float tot = 1.0;
        for (int i = 0; i < 12; i++) {
          float a = float(i) * 2.39996;
          float r = sqrt(float(i) + 0.5) / sqrt(12.0);
          vec2 o = vec2(cos(a), sin(a)) * r * blur * 7.0 / uRes;
          acc += texture2D(tDiffuse, vUv + o).rgb;
          tot += 1.0;
        }
        c = mix(c, acc / tot, clamp(blur * 2.0, 0.0, 1.0));
      }
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = max(mix(vec3(l), c, uSaturation), 0.0);
      // gentle split-tone: warm highlights, cool shadows
      c *= mix(vec3(0.92, 0.97, 1.08), vec3(1.04, 1.0, 0.95), smoothstep(0.0, 0.6, l));
      c *= 1.0 - uVignette * smoothstep(0.1, 0.55, r2 * 1.6);
      float n = hash(vUv * uRes + fract(uTime) * 100.0) - 0.5;
      c += n * uGrain * (0.25 + sqrt(l));
      gl_FragColor = vec4(c, 1.0);
    }
  `,
};

export class PostFX {
  readonly composer: EffectComposer;
  readonly bloom: UnrealBloomPass;
  readonly grade: ShaderPass;
  private renderPass: RenderPass;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, w: number, h: number) {
    const pr = renderer.getPixelRatio();
    const rt = new THREE.WebGLRenderTarget(w * pr, h * pr, {
      type: THREE.HalfFloatType,
      samples: 4,
    });
    this.composer = new EffectComposer(renderer, rt);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.7, 0.55, 0.82);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }

  setSize(w: number, h: number): void {
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
    const pr = this.composer.renderer.getPixelRatio();
    (this.grade.uniforms.uRes!.value as THREE.Vector2).set(w * pr, h * pr);
  }

  render(time: number): void {
    this.grade.uniforms.uTime!.value = time;
    this.composer.render();
  }
}
