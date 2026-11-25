/**
 * Geometry styles with their own shading models:
 *  S06 cel-shaded with depth-based ink outlines,
 *  S08 soft clay (smoothed continuous surface, wrap lighting),
 *  S10 dark silhouettes with glowing, volumetric air,
 *  S12 low-poly facets (flat-shaded jittered triangles).
 */
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { CONFIG } from '../../config';
import { hash2f, hash3f } from '../../core/rng';
import { buildHeightfield } from '../../render/heightfield';
import { LOOK } from '../../render/palette';
import { PostFX } from '../../render/post';
import { GLSL_LIGHT, GLSL_NOISE } from '../../render/shaderlib';
import { SkyView } from '../../render/sky';
import { GLSL_WORLD } from '../../render/worldTex';
import { M, MATERIALS, SOLID } from '../../world/materials';
import { CAV, TF } from '../../world/world';
import { buildFluids, buildMannequins, buildProps, litMaterial, updateWorldUniforms, WINDY, worldUniforms } from '../common';
import type { RenderStyle } from '../style';

const ORE = new Set<number>(MATERIALS.filter((m) => m.cls === 'ore' || m.cls === 'gem').map((m) => m.id));
const GLOW = new Set<number>([M.CRYSTAL, M.AMETHYST, M.MAGMA_ROCK, M.MYCELIUM, M.EMBERITE, M.GLIMMERITE]);

const HF_VERT = /* glsl */ `
attribute float aMatFlags;
attribute float aAo;
varying vec3 vPos; varying vec3 vNormal; flat varying float vMat; flat varying float vFlags; varying float vAo;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPos = wp.xyz; vNormal = normal; vMat = mod(aMatFlags, 256.0); vFlags = floor(aMatFlags / 256.0 + 0.5); vAo = aAo;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const HF_COMMON = /* glsl */ `
uniform sampler2D uMatTex; uniform vec3 uCamPos;
${GLSL_WORLD}
${GLSL_NOISE}
${GLSL_LIGHT}
varying vec3 vPos; varying vec3 vNormal; flat varying float vMat; flat varying float vFlags; varying float vAo;
bool flag(float bit) { return mod(floor(vFlags / bit), 2.0) > 0.5; }
vec4 P(int m, int k) { return texelFetch(uMatTex, ivec2(k, m), 0); }
`;

// ------------------------------------------------------------------ S06
const S06_FRAG = /* glsl */ `
${HF_COMMON}
void main() {
  int m = int(vMat + 0.5);
  vec3 N = normalize(vNormal);
  bool interior = flag(1.0), grassy = flag(2.0), unexplored = flag(8.0), outdoor = flag(16.0), top = flag(32.0);
  bool cap = abs(N.z) > 0.5;
  vec2 uv = cap ? vPos.xy : abs(N.x) > 0.5 ? vPos.zy : vPos.xz;
  vec3 a = P(m, 0).rgb, b = P(m, 1).rgb, acc = P(m, 2).rgb;
  float pat = P(m, 0).a;
  vec3 col = mix(a, b, step(0.5, vnoise(uv * 1.3)) * 0.5 + 0.25);
  if (pat > 0.5 && pat < 1.5) col = mix(a, b, step(0.5, fract(vPos.y * 0.5 + vnoise(vec2(vPos.x * 0.12, 0.0)))));
  if (pat > 2.5 && pat < 4.5) {
    vec4 v = voronoi(uv * 2.4);
    col = mix(col, acc, smoothstep(0.24, 0.2, v.x) * step(hash12(v.zw), 0.7));
  }
  if (grassy && (top || fract(-vPos.y) < 0.18)) col = vec3(0.2, 0.42, 0.08);
  if (interior && !outdoor) col *= 0.7;
  vec3 spec;
  vec2 sp = cap ? vPos.xy : vPos.xy + N.xy * 0.5;
  vec3 L = worldLight(vPos, N, sp, normalize(uCamPos - vPos), 8.0, outdoor ? 1.0 : 0.0, spec);
  float l = max(max(L.r, L.g), L.b);
  float band = l < 0.12 ? 0.0 : l < 0.45 ? 0.45 : l < 0.95 ? 0.8 : 1.05;
  vec3 tint = L / max(l, 1e-3);
  col *= 0.16 + band * mix(vec3(1.0), tint, 0.6);
  if (P(m, 2).a > 0.5) col += acc * 0.6 * (cap ? 1.0 : 0.5);
  if (unexplored) col = mix(col * 0.25, vec3(0.08, 0.09, 0.12), 0.6);
  gl_FragColor = vec4(col, 1.0);
}`;

export const S06: RenderStyle = {
  id: 's06-cel',
  namePl: 'Cel-shading z konturem',
  descPl: 'Płaskie barwy, światło w progach jak w komiksie, kontury z nieciągłości głębi.',
  create(ctx) {
    const scene = new THREE.Scene();
    const u = worldUniforms(ctx);
    const sky = new SkyView(ctx.world);
    scene.add(sky.group);
    scene.add(new THREE.Mesh(buildHeightfield(ctx.world, 0, 0, ctx.world.w, ctx.world.h, { jitterNatural: 0.1, jitterDug: 0.03 }),
      new THREE.ShaderMaterial({ vertexShader: HF_VERT, fragmentShader: S06_FRAG, uniforms: u })));
    const props = litMaterial(u, { rim: 0 });
    scene.add(buildProps(ctx, () => props));
    scene.add(buildMannequins(ctx, props));
    scene.add(buildFluids(ctx, u));
    const mkRT = (w: number, h: number) => {
      const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
      rt.depthTexture = new THREE.DepthTexture(w, h);
      return rt;
    };
    let rt = mkRT(ctx.width, ctx.height);
    const mat = new THREE.ShaderMaterial({
      uniforms: { tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture }, uRes: { value: new THREE.Vector2(ctx.width, ctx.height) }, uNear: { value: ctx.camera.near }, uFar: { value: ctx.camera.far } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 uRes; uniform float uNear; uniform float uFar; varying vec2 vUv;
        float lin(vec2 uv) { float z = texture2D(tDepth, uv).x * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
        vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
        void main() {
          vec2 px = 1.0 / uRes;
          float d = lin(vUv);
          float dx = abs(lin(vUv + vec2(px.x, 0.0)) - lin(vUv - vec2(px.x, 0.0)));
          float dy = abs(lin(vUv + vec2(0.0, px.y)) - lin(vUv - vec2(0.0, px.y)));
          float edge = smoothstep(0.012, 0.03, (dx + dy) / d);
          vec3 c = texture2D(tColor, vUv).rgb;
          c = pow(aces(c * 1.1), vec3(1.0 / 2.2));
          c = mix(c, vec3(0.04, 0.03, 0.03), edge * 0.9);
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
        rt = mkRT(w, h);
        mat.uniforms.tColor!.value = rt.texture;
        mat.uniforms.tDepth!.value = rt.depthTexture;
        (mat.uniforms.uRes!.value as THREE.Vector2).set(w, h);
      },
    };
  },
};

// ------------------------------------------------------------------ S08
export const S08: RenderStyle = {
  id: 's08-clay',
  namePl: 'Plastelina',
  descPl: 'Ciągła, wygładzona powierzchnia jak ulepiona z plasteliny; miękkie światło, nasycone barwy.',
  create(ctx) {
    const scene = new THREE.Scene();
    const u = worldUniforms(ctx);
    const sky = new SkyView(ctx.world);
    scene.add(sky.group);
    const { world } = ctx;
    const G = CONFIG.groundDepth;
    // tile depth field (apparent) and visible material
    const zf = new Float32Array(world.size);
    const vis = new Uint8Array(world.size);
    for (let i = 0; i < world.size; i++) {
      const explored = (world.flags[i]! & TF.EXPLORED) !== 0;
      const solid = SOLID[world.mat[i]!] || !explored;
      if (world.cav[i] === CAV.SKY) zf[i] = -G;
      else zf[i] = solid ? 0 : -world.depth[i]! / 32;
      vis[i] = !explored ? 255 : solid ? world.mat[i]! : world.bg[i]!;
    }
    // smooth (two box-blur passes ~ gaussian)
    const blur = (src: Float32Array) => {
      const out = new Float32Array(src.length);
      for (let y = 0; y < world.h; y++)
        for (let x = 0; x < world.w; x++) {
          let s = 0;
          let n = 0;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const xx = Math.min(world.w - 1, Math.max(0, x + dx));
              const yy = Math.min(world.h - 1, Math.max(0, y + dy));
              s += src[yy * world.w + xx]!;
              n++;
            }
          out[y * world.w + x] = s / n;
        }
      return out;
    };
    const sm = blur(blur(zf));
    const SUB = 4;
    const NX = world.w * SUB + 1;
    const NY = world.h * SUB + 1;
    const pos = new Float32Array(NX * NY * 3);
    const col = new Float32Array(NX * NY * 3);
    const emi = new Float32Array(NX * NY);
    const sample = (fx: number, fy: number) => {
      const x = Math.min(world.w - 1.001, Math.max(0, fx - 0.5));
      const y = Math.min(world.h - 1.001, Math.max(0, fy - 0.5));
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const tx = x - x0;
      const ty = y - y0;
      const g = (xx: number, yy: number) => sm[yy * world.w + xx]!;
      return (g(x0, y0) * (1 - tx) + g(x0 + 1, y0) * tx) * (1 - ty) + (g(x0, y0 + 1) * (1 - tx) + g(x0 + 1, y0 + 1) * tx) * ty;
    };
    const c = new THREE.Color();
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NX; i++) {
        const fx = i / SUB;
        const fy = j / SUB;
        const k = j * NX + i;
        const z = sample(fx, fy);
        pos.set([fx, -fy, z], k * 3);
        const tx = Math.min(world.w - 1, Math.floor(fx));
        const ty = Math.min(world.h - 1, Math.floor(fy));
        const v = vis[ty * world.w + tx]!;
        if (v === 255) c.setRGB(0.09, 0.09, 0.12);
        else {
          const L = LOOK[v]!;
          c.set(L.a).lerp(new THREE.Color(L.b), hash2f(tx, ty, 3));
          if (ORE.has(v) && hash3f(i, j, v, 1) > 0.55) c.set(L.accent);
          const hsl = { h: 0, s: 0, l: 0 };
          c.getHSL(hsl);
          c.setHSL(hsl.h, Math.min(1, hsl.s * 1.6 + 0.08), Math.min(0.85, hsl.l * 1.25 + 0.04));
          if ((v === M.SOIL || v === M.CLAY) && ty > 0 && world.cav[(ty - 1) * world.w + tx] === CAV.SKY && fy - ty < 0.35) c.setRGB(0.25, 0.55, 0.12);
          if (GLOW.has(v)) emi[k] = 0.7;
        }
        col.set([c.r, c.g, c.b], k * 3);
      }
    const idx: number[] = [];
    for (let j = 0; j < NY - 1; j++)
      for (let i = 0; i < NX - 1; i++) {
        const a = j * NX + i;
        idx.push(a, a + NX, a + 1, a + 1, a + NX, a + NX + 1);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aEmissive', new THREE.BufferAttribute(emi, 1));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const clay = new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: /* glsl */ `
        attribute vec3 color; attribute float aEmissive;
        varying vec3 vPos; varying vec3 vN; varying vec3 vColor; varying float vEmi;
        void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vPos = wp.xyz; vN = normal; vColor = color; vEmi = aEmissive; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uCamPos;
        ${GLSL_WORLD}
        ${GLSL_NOISE}
        ${GLSL_LIGHT}
        varying vec3 vPos; varying vec3 vN; varying vec3 vColor; varying float vEmi;
        void main() {
          vec4 t = tileAt(vPos.xy);
          if (int(t.g * 255.0 + 0.5) == 1 && vPos.z < -2.6) discard; // open sky
          vec3 N = normalize(vN);
          // thumbprints and dents
          float f = vnoise(vPos.xy * 6.0) + 0.5 * vnoise(vPos.xy * 13.0);
          N = normalize(N + vec3(dFdx(f), dFdy(f), 0.0) * 1.4);
          vec3 V = normalize(uCamPos - vPos);
          vec3 spec;
          vec3 L = worldLight(vPos, N, vPos.xy + N.xy * 0.4, V, 12.0, smoothstep(0.5, 0.95, lightAt(vPos.xy).a), spec);
          float wrap = 0.55 + 0.45 * max(dot(N, normalize(vec3(-0.3, 0.6, 0.8))), 0.0);
          vec3 col = vColor * (L * wrap + 0.16) + spec * 0.18 + vColor * vEmi;
          float sss = pow(1.0 - max(dot(N, V), 0.0), 2.0);
          col += vColor * L * sss * 0.35;
          col *= smoothstep(0.15, 0.7, fogAt(vPos.xy).x) * 0.85 + 0.15;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    scene.add(new THREE.Mesh(geo, clay));
    const props = litMaterial(u, { rim: 0.4, ambient: 0.25 });
    const wind = litMaterial(u, { rim: 0.4, ambient: 0.25, wind: 0.05, doubleSide: true });
    scene.add(buildProps(ctx, (t) => (WINDY.has(t) ? wind : props)));
    scene.add(buildMannequins(ctx, props));
    scene.add(buildFluids(ctx, u));
    const post = new PostFX(ctx.renderer, scene, ctx.camera, ctx.width, ctx.height);
    post.setSize(ctx.width, ctx.height);
    return {
      render(f) {
        updateWorldUniforms(u, f, ctx.camera);
        sky.update(f.day, f.time, ctx.camera.position);
        post.render(f.time);
      },
      resize: (w, h) => post.setSize(w, h),
    };
  },
};

// ------------------------------------------------------------------ S10
const S10_FRAG = /* glsl */ `
${HF_COMMON}
void main() {
  int m = int(vMat + 0.5);
  vec3 N = normalize(vNormal);
  bool interior = flag(1.0), outdoor = flag(16.0), unexplored = flag(8.0);
  bool cap = abs(N.z) > 0.5;
  vec3 a = P(m, 0).rgb, acc = P(m, 2).rgb;
  vec2 sp = cap ? vPos.xy : vPos.xy + N.xy * 0.5;
  vec3 spec;
  vec3 L = worldLight(vPos, N, sp, normalize(uCamPos - vPos), 16.0, outdoor ? 1.0 : 0.0, spec);
  vec3 col;
  if (!interior && cap) {
    // the rock itself is a near-black silhouette with a glowing rim towards open space
    float occ = fogAt(vPos.xy).y;
    float rim = smoothstep(0.9, 0.55, occ);
    col = a * 0.06 + L * rim * 0.55 * (0.6 + 0.4 * vnoise(vPos.xy * 3.0));
  } else {
    col = mix(a, vec3(dot(a, vec3(0.33))), 0.5) * (L + 0.02) * 1.2 * vAo;
  }
  if (P(m, 2).a > 0.5) col += acc * 0.5;
  if (unexplored) col *= 0.3;
  gl_FragColor = vec4(col, 1.0);
}`;

export const S10: RenderStyle = {
  id: 's10-silhouette',
  namePl: 'Mroczne sylwetki',
  descPl: 'Skała jako czarna sylwetka z poświatą krawędzi, powietrze w tunelach świeci barwną mgłą.',
  create(ctx) {
    const scene = new THREE.Scene();
    const u = worldUniforms(ctx);
    const sky = new SkyView(ctx.world);
    scene.add(sky.group);
    scene.add(new THREE.Mesh(buildHeightfield(ctx.world, 0, 0, ctx.world.w, ctx.world.h), new THREE.ShaderMaterial({ vertexShader: HF_VERT, fragmentShader: S10_FRAG, uniforms: u })));
    const props = litMaterial(u, { rim: 0.8, ambient: 0.05 });
    scene.add(buildProps(ctx, () => props));
    scene.add(buildMannequins(ctx, props));
    scene.add(buildFluids(ctx, u));
    // glowing air: additive sheet inside open space
    const { w, h } = ctx.world;
    const air = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.ShaderMaterial({
        uniforms: u,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `varying vec3 vPos; void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vPos = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
        fragmentShader: /* glsl */ `
          ${GLSL_WORLD}
          ${GLSL_NOISE}
          ${GLSL_LIGHT}
          varying vec3 vPos;
          void main() {
            vec2 p = vPos.xy;
            vec2 fg = fogAt(p);
            if (int(tileAt(p).g * 255.0 + 0.5) == 1) discard;
            vec4 L = lightAt(p);
            float dust = 0.7 + 0.6 * fbm3(p * 0.8 + vec2(uTime * 0.05, uTime * 0.02));
            vec3 c = (L.rgb * 0.16 + L.a * uSkyLight * 0.06) * (1.0 - fg.y) * dust * fg.x;
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    );
    air.position.set(w / 2, -h / 2, -0.3);
    air.renderOrder = 5;
    scene.add(air);
    const post = new PostFX(ctx.renderer, scene, ctx.camera, ctx.width, ctx.height);
    post.bloom.strength = 1.1;
    post.bloom.radius = 0.85;
    post.bloom.threshold = 0.55;
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

// ------------------------------------------------------------------ S12
export const S12: RenderStyle = {
  id: 's12-facets',
  namePl: 'Low-poly fasetki',
  descPl: 'Mocno poszarpana siatka z płaskim cieniowaniem trójkątów; skała jak oszlifowany kamień.',
  create(ctx) {
    const scene = new THREE.Scene();
    const u = worldUniforms(ctx);
    const sky = new SkyView(ctx.world);
    scene.add(sky.group);
    const geo0 = buildHeightfield(ctx.world, 0, 0, ctx.world.w, ctx.world.h, { jitterNatural: 0.26, jitterDug: 0.16, jitterFront: 0.14, jitterDeep: 0.3 });
    const geo = geo0.toNonIndexed();
    geo.computeVertexNormals(); // non-indexed => flat per-face normals
    const mf = geo.attributes.aMatFlags!;
    const p = geo.attributes.position!;
    const n = p.count;
    const col = new Float32Array(n * 3);
    const emi = new Float32Array(n);
    const c = new THREE.Color();
    for (let t = 0; t < n; t += 3) {
      const m = mf.getX(t) % 256;
      const flags = Math.floor(mf.getX(t) / 256);
      const cx = (p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3;
      const cy = (p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3;
      const hsh = hash2f(Math.floor(cx * 7), Math.floor(cy * 7), m);
      const L = LOOK[m]!;
      c.set(L.a).lerp(new THREE.Color(L.b), hsh);
      if (ORE.has(m) && hsh > 0.6) c.set(L.accent);
      if (flags & 2 && (flags & 32 || -cy - Math.floor(-cy) < 0.2)) c.setRGB(0.2, 0.45, 0.1);
      if (flags & 1) c.multiplyScalar(0.7);
      if (flags & 8) c.setRGB(0.08, 0.08, 0.1).multiplyScalar(0.8 + 0.4 * hsh);
      const e = GLOW.has(m) && hsh > 0.5 ? 1 : 0;
      for (let k = 0; k < 3; k++) {
        col.set([c.r, c.g, c.b], (t + k) * 3);
        emi[t + k] = e;
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aEmissive', new THREE.BufferAttribute(emi, 1));
    scene.add(new THREE.Mesh(geo, litMaterial(u, { rim: 0.05, ambient: 0.16 })));
    const props = litMaterial(u);
    scene.add(buildProps(ctx, () => props));
    scene.add(buildMannequins(ctx, props));
    scene.add(buildFluids(ctx, u));
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
