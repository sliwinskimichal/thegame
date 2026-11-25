/**
 * Styles derived from the diorama scene through different image pipelines:
 *  S03 pixel art with ordered dithering, S05 painterly (Kuwahara),
 *  S09 museum ant-farm behind glass.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { PostFX } from '../../render/post';
import { GLSL_NOISE } from '../../render/shaderlib';
import { updateWorldUniforms } from '../common';
import type { RenderStyle } from '../style';
import { buildDioramaScene } from './s01-diorama';

const FS_VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export const S03: RenderStyle = {
  id: 's03-pixel',
  namePl: 'Pixel-art ze światłem',
  descPl: 'Scena renderowana w niskiej rozdzielczości, paleta ograniczona ditheringiem Bayera, kontur pikselowy.',
  create(ctx) {
    const { scene, sky, u } = buildDioramaScene(ctx);
    const S = 4;
    const mk = (w: number, h: number) =>
      new THREE.WebGLRenderTarget(Math.max(1, Math.floor(w / S)), Math.max(1, Math.floor(h / S)), {
        type: THREE.HalfFloatType,
        magFilter: THREE.NearestFilter,
        minFilter: THREE.NearestFilter,
      });
    let rt = mk(ctx.width, ctx.height);
    const mat = new THREE.ShaderMaterial({
      vertexShader: FS_VERT,
      uniforms: { tScene: { value: rt.texture }, uRes: { value: new THREE.Vector2(rt.width, rt.height) }, uLevels: { value: 7 } },
      fragmentShader: /* glsl */ `
        uniform sampler2D tScene; uniform vec2 uRes; uniform float uLevels; varying vec2 vUv;
        vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
        vec3 tone(vec2 uv) { return pow(aces(texture2D(tScene, uv).rgb * 1.05), vec3(1.0 / 2.2)); }
        float bayer(vec2 p) {
          int i = int(mod(p.x, 4.0)) + int(mod(p.y, 4.0)) * 4;
          float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
          return m[i] / 16.0;
        }
        void main() {
          vec2 px = floor(vUv * uRes);
          vec2 uv = (px + 0.5) / uRes;
          vec3 c = tone(uv);
          float l = dot(c, vec3(0.299, 0.587, 0.114));
          float ln = dot(tone(uv + vec2(1.0, 0.0) / uRes), vec3(0.299, 0.587, 0.114));
          float lu = dot(tone(uv + vec2(0.0, 1.0) / uRes), vec3(0.299, 0.587, 0.114));
          float edge = smoothstep(0.08, 0.2, max(abs(l - ln), abs(l - lu)));
          c *= 1.0 - edge * 0.35;
          float t = bayer(px) - 0.5;
          c = floor(c * uLevels + 0.5 + t * 0.9) / uLevels;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const quad = new FullScreenQuad(mat);
    return {
      render(f) {
        updateWorldUniforms(u, f, ctx.camera);
        sky.update(f.day, f.time, ctx.camera.position);
        ctx.renderer.setRenderTarget(rt);
        ctx.renderer.render(scene, ctx.camera);
        ctx.renderer.setRenderTarget(null);
        quad.render(ctx.renderer);
      },
      resize(w, h) {
        rt.dispose();
        rt = mk(w, h);
        mat.uniforms.tScene!.value = rt.texture;
        (mat.uniforms.uRes!.value as THREE.Vector2).set(rt.width, rt.height);
      },
    };
  },
};

const KuwaharaShader = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uTime; varying vec2 vUv;
    ${GLSL_NOISE}
    void main() {
      const int R = 4;
      vec2 px = 1.0 / uRes;
      vec3 m[4]; vec3 s[4];
      for (int k = 0; k < 4; k++) { m[k] = vec3(0.0); s[k] = vec3(0.0); }
      for (int j = -R; j <= R; j++)
      for (int i = -R; i <= R; i++) {
        vec3 c = texture2D(tDiffuse, vUv + vec2(float(i), float(j)) * px).rgb;
        c = c / (1.0 + c); // compress HDR so the filter behaves
        if (i <= 0 && j <= 0) { m[0] += c; s[0] += c * c; }
        if (i >= 0 && j <= 0) { m[1] += c; s[1] += c * c; }
        if (i <= 0 && j >= 0) { m[2] += c; s[2] += c * c; }
        if (i >= 0 && j >= 0) { m[3] += c; s[3] += c * c; }
      }
      float n = float((R + 1) * (R + 1));
      float best = 1e9; vec3 col = vec3(0.0);
      for (int k = 0; k < 4; k++) {
        vec3 mu = m[k] / n;
        vec3 v = abs(s[k] / n - mu * mu);
        float sg = v.r + v.g + v.b;
        if (sg < best) { best = sg; col = mu; }
      }
      col = col / max(vec3(1e-3), 1.0 - col);
      // canvas weave and pigment granulation
      float weave = (vnoise(gl_FragCoord.xy * 0.6) - 0.5) * 0.06 + (sin(gl_FragCoord.x * 1.7) * sin(gl_FragCoord.y * 1.7)) * 0.015;
      col *= 1.0 + weave;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export const S05: RenderStyle = {
  id: 's05-painterly',
  namePl: 'Malarski',
  descPl: 'Makieta przepuszczona przez filtr Kuwahary: pociągnięcia pędzla, płótno, miękkie światło.',
  create(ctx) {
    const { scene, sky, u } = buildDioramaScene(ctx);
    const pr = ctx.renderer.getPixelRatio();
    const composer = new EffectComposer(ctx.renderer, new THREE.WebGLRenderTarget(ctx.width * pr, ctx.height * pr, { type: THREE.HalfFloatType }));
    composer.addPass(new RenderPass(scene, ctx.camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(ctx.width, ctx.height), 0.9, 0.8, 0.75);
    composer.addPass(bloom);
    const kuw = new ShaderPass(KuwaharaShader);
    composer.addPass(kuw);
    composer.addPass(new OutputPass());
    const setSize = (w: number, h: number) => {
      composer.setSize(w, h);
      (kuw.uniforms.uRes!.value as THREE.Vector2).set(w * pr, h * pr);
    };
    setSize(ctx.width, ctx.height);
    return {
      render(f) {
        updateWorldUniforms(u, f, ctx.camera);
        sky.update(f.day, f.time, ctx.camera.position);
        composer.render();
      },
      resize: setSize,
    };
  },
};

export const S09: RenderStyle = {
  id: 's09-antfarm',
  namePl: 'Mrowisko za szkłem',
  descPl: 'Makieta jako eksponat muzealny: szyba z refleksami i smugami, drewniana rama.',
  create(ctx) {
    const { scene, sky, u } = buildDioramaScene(ctx);
    const { w, h } = ctx.world;
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(w + 0.6, h + 0.6),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: u.uTime!, uCamPos: u.uCamPos! },
        vertexShader: /* glsl */ `varying vec3 vPos; void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vPos = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uCamPos; uniform float uTime; varying vec3 vPos;
          ${GLSL_NOISE}
          void main() {
            vec3 V = normalize(uCamPos - vPos);
            float fres = pow(1.0 - abs(V.z), 3.0);
            // soft studio reflections: two diagonal light bands
            float band = smoothstep(0.0, 0.6, sin((vPos.x + vPos.y * 0.6) * 0.09 + 1.3)) * 0.06
                       + smoothstep(0.85, 1.0, sin((vPos.x - vPos.y * 0.3) * 0.21)) * 0.05;
            float smudge = smoothstep(0.55, 0.85, fbm4(vPos.xy * 0.18)) * 0.05;
            float dust = step(0.997, hash12(floor(vPos.xy * 22.0))) * 0.25;
            float a = 0.03 + fres * 0.25 + band + smudge + dust;
            vec3 col = vec3(0.85, 0.92, 1.0) * (band * 6.0 + smudge * 3.0 + dust * 4.0 + fres);
            gl_FragColor = vec4(col, clamp(a, 0.0, 0.6));
          }`,
      }),
    );
    glass.position.set(w / 2, -h / 2, 0.45);
    glass.renderOrder = 10;
    scene.add(glass);
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.6 });
    const frame = (x: number, y: number, sx: number, sy: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, 1.2), wood);
      m.position.set(x, y, 0.1);
      scene.add(m);
    };
    frame(w / 2, 0.6, w + 2.4, 1.2);
    frame(w / 2, -h - 0.6, w + 2.4, 1.2);
    frame(-0.6, -h / 2, 1.2, h + 2.4);
    frame(w + 0.6, -h / 2, 1.2, h + 2.4);
    const key = new THREE.DirectionalLight(0xfff0e0, 1.4);
    key.position.set(20, 40, 60);
    scene.add(key, new THREE.AmbientLight(0x404050, 0.8));
    const post = new PostFX(ctx.renderer, scene, ctx.camera, ctx.width, ctx.height);
    post.setSize(ctx.width, ctx.height);
    return {
      render(f) {
        updateWorldUniforms(u, f, ctx.camera);
        sky.update(f.day, f.time, ctx.camera.position);
        post.render(f.time);
      },
      resize: (w2, h2) => post.setSize(w2, h2),
    };
  },
};
