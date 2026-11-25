/**
 * Flat, plane-based styles that draw the cross-section in a fragment shader:
 *  S04 vector illustration with ink outlines and banded light,
 *  S07 paper cut-out diorama with torn edges and cast shadows between layers.
 */
import * as THREE from 'three';
import { PostFX } from '../../render/post';
import { GLSL_LIGHT, GLSL_NOISE } from '../../render/shaderlib';
import { SkyView } from '../../render/sky';
import { GLSL_WORLD } from '../../render/worldTex';
import { buildFluids, buildMannequins, buildProps, updateWorldUniforms, worldUniforms, type WorldUniforms } from '../common';
import type { FrameState, RenderStyle, StyleContext } from '../style';

const PLANE_VERT = /* glsl */ `varying vec3 vPos; void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vPos = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;

/** A plane covering the arena (plus margins) at depth z. */
function arenaPlane(ctx: StyleContext, z: number, mat: THREE.Material): THREE.Mesh {
  const { w, h } = ctx.world;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(w / 2, -h / 2, z);
  return m;
}

/** Flat-colour, banded-light material for props and dwarves (+ ink hull). */
function toonProps(u: WorldUniforms, bands: number, ink: boolean): { fill: THREE.ShaderMaterial; outline: THREE.ShaderMaterial | null } {
  const fill = new THREE.ShaderMaterial({
    uniforms: { ...u, uBands: { value: bands } },
    vertexShader: /* glsl */ `
      attribute vec3 color; attribute float aEmissive;
      varying vec3 vColor; varying vec3 vPos; varying vec3 vN; varying float vEmi;
      void main() {
        mat4 m = modelMatrix;
        #ifdef USE_INSTANCING
          m = modelMatrix * instanceMatrix;
        #endif
        vec4 wp = m * vec4(position, 1.0);
        vPos = wp.xyz; vN = normalize(mat3(m) * normal); vColor = color; vEmi = aEmissive;
        #ifdef USE_INSTANCING_COLOR
          vColor *= instanceColor;
        #endif
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uBands; uniform vec3 uCamPos;
      ${GLSL_WORLD}
      ${GLSL_NOISE}
      ${GLSL_LIGHT}
      varying vec3 vColor; varying vec3 vPos; varying vec3 vN; varying float vEmi;
      void main() {
        vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
        vec3 spec;
        vec3 L = worldLight(vPos, N, vPos.xy, normalize(uCamPos - vPos), 8.0, smoothstep(0.55, 0.95, lightAt(vPos.xy).a), spec);
        float l = max(max(L.r, L.g), L.b);
        float b = floor(min(l, 1.5) * uBands + 0.5) / uBands;
        vec3 tint = L / max(l, 1e-3);
        vec3 col = vColor * (0.18 + b * mix(vec3(1.0), tint, 0.5)) + vColor * vEmi * 0.8;
        col *= smoothstep(0.15, 0.7, fogAt(vPos.xy).x);
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.DoubleSide,
  });
  if (!ink) return { fill, outline: null };
  const outline = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      void main() {
        mat4 m = modelMatrix;
        #ifdef USE_INSTANCING
          m = modelMatrix * instanceMatrix;
        #endif
        vec3 p = position + normal * 0.025;
        gl_Position = projectionMatrix * viewMatrix * m * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `void main() { gl_FragColor = vec4(0.05, 0.035, 0.03, 1.0); }`,
    side: THREE.BackSide,
  });
  return { fill, outline };
}

export const S04_FRAG = /* glsl */ `
uniform sampler2D uMatTex;
${GLSL_WORLD}
${GLSL_NOISE}
${GLSL_LIGHT}
varying vec3 vPos;
vec3 pal(int m, int k) { return texelFetch(uMatTex, ivec2(k, m), 0).rgb; }
void main() {
  vec2 p = vPos.xy;
  vec4 t = tileAt(p);
  vec2 fg = fogAt(p);
  float occ = fg.y;
  int cav = int(t.g * 255.0 + 0.5);
  int m = int(t.r * 255.0 + 0.5);
  float aw = fwidth(occ) * 1.2;
  if (cav == 1 && occ < 0.5 - aw) discard;
  bool solid = occ > 0.5;
  if (solid && cav != 0) {
    // smooth contour crosses into an open tile: borrow a neighbouring rock
    for (int k = 0; k < 4; k++) {
      vec2 o = vec2(k == 0 ? 0.6 : k == 1 ? -0.6 : 0.0, k == 2 ? 0.6 : k == 3 ? -0.6 : 0.0);
      vec4 tt = tileAt(p + o);
      if (int(tt.g * 255.0 + 0.5) == 0) { m = int(tt.r * 255.0 + 0.5); break; }
    }
  }
  vec3 a = pal(m, 0), b = pal(m, 1), acc = pal(m, 2);
  float pat = texelFetch(uMatTex, ivec2(0, m), 0).a;
  vec3 col = mix(a, b, 0.55);
  if (solid) {
    if (pat > 0.5 && pat < 1.5) col = mix(a, b, step(0.5, fract(p.y * 0.55 + vnoise(vec2(p.x * 0.1, p.y * 0.3)) * 1.2)));
    if (pat > 2.5 && pat < 4.5) {
      vec4 v = voronoi(p * 2.2);
      float r = 0.2 + 0.12 * hash12(v.zw);
      float blob = smoothstep(r + 0.03, r, v.x) * step(hash12(v.zw), 0.75);
      float ring = smoothstep(r + 0.06, r + 0.03, v.x) * (1.0 - blob) * step(hash12(v.zw), 0.75);
      col = mix(col, acc, blob);
      col = mix(col, vec3(0.06, 0.04, 0.03), ring * 0.8);
    }
  } else {
    col = mix(a, b, 0.3) * 0.42;
  }
  // banded light
  vec4 L = lightAt(p + (solid ? vec2(0.0) : vec2(0.0)));
  vec3 lit = L.rgb + L.a * uSkyLight;
  float l = max(max(lit.r, lit.g), lit.b);
  float band = floor(min(l, 1.6) * 3.0 + 0.5) / 3.0;
  vec3 tint = lit / max(l, 1e-3);
  col *= (solid ? 0.32 : 0.22) + band * mix(vec3(1.0), tint, 0.55);
  float emi = texelFetch(uMatTex, ivec2(2, m), 0).a;
  if (solid && emi > 0.5) col += acc * 0.35;
  // ink outline on the contour
  float ink = 1.0 - smoothstep(aw * 0.6, aw * 1.6, abs(occ - 0.5));
  col = mix(col, vec3(0.05, 0.035, 0.03), ink);
  // fog of war: flat slate with hatching
  float ex = fg.x;
  if (ex < 0.99) {
    float hatch = step(0.5, fract((p.x + p.y) * 1.6));
    vec3 fogc = vec3(0.1, 0.11, 0.14) * (0.85 + 0.15 * hatch);
    col = mix(fogc, col, smoothstep(0.35, 0.65, ex));
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

/** Vector illustration renderer with a given arena fragment shader and prop light bands. */
export function createVector(ctx: StyleContext, frag: string, bands: number, bloom: number) {
  const scene = new THREE.Scene();
  const u = worldUniforms(ctx);
  const sky = new SkyView(ctx.world);
  scene.add(sky.group);
  const plane = arenaPlane(ctx, -0.55, new THREE.ShaderMaterial({ vertexShader: PLANE_VERT, fragmentShader: frag, uniforms: u, depthWrite: false }));
  plane.renderOrder = -1;
  scene.add(plane);
  const { fill, outline } = toonProps(u, bands, true);
  scene.add(buildProps(ctx, () => fill));
  if (outline) scene.add(buildProps(ctx, () => outline));
  scene.add(buildMannequins(ctx, fill));
  if (outline) scene.add(buildMannequins(ctx, outline));
  scene.add(buildFluids(ctx, u));
  const post = new PostFX(ctx.renderer, scene, ctx.camera, ctx.width, ctx.height);
  post.bloom.strength = bloom;
  post.setSize(ctx.width, ctx.height);
  return {
    render(f: FrameState) {
      updateWorldUniforms(u, f, ctx.camera);
      sky.update(f.day, f.time, ctx.camera.position);
      post.render(f.time);
    },
    resize: (w: number, h: number) => post.setSize(w, h),
  };
}

export const S04: RenderStyle = {
  id: 's04-vector',
  namePl: 'Ilustracja wektorowa',
  descPl: 'Płaskie barwy, gładkie kontury jaskiń obwiedzione tuszem, światło w trzech pasmach.',
  create: (ctx) => createVector(ctx, S04_FRAG, 3, 0.35),
};

const PAPER = /* glsl */ `
float paperGrain(vec2 p) { return (vnoise(p * 9.0) - 0.5) * 0.08 + (vnoise(p * 40.0) - 0.5) * 0.05 + (vnoise(vec2(p.x * 3.0, p.y * 60.0)) - 0.5) * 0.03; }
float frontMask(vec2 p) {
  float occ = fogAt(p).y;
  float tear = (fbm3(p * 2.3) - 0.5) * 0.35;
  return occ + tear;
}
`;

const S07_FRONT = /* glsl */ `
uniform sampler2D uMatTex;
${GLSL_WORLD}
${GLSL_NOISE}
${GLSL_LIGHT}
${PAPER}
varying vec3 vPos;
void main() {
  vec2 p = vPos.xy;
  float mk = frontMask(p);
  if (mk < 0.5) discard;
  vec4 t = tileAt(p);
  int m = int(t.r * 255.0 + 0.5);
  if (int(t.g * 255.0 + 0.5) != 0) {
    for (int k = 0; k < 4; k++) {
      vec2 o = vec2(k == 0 ? 0.6 : k == 1 ? -0.6 : 0.0, k == 2 ? 0.6 : k == 3 ? -0.6 : 0.0);
      vec4 tt = tileAt(p + o);
      if (int(tt.g * 255.0 + 0.5) == 0) { m = int(tt.r * 255.0 + 0.5); break; }
    }
  }
  vec3 base = mix(texelFetch(uMatTex, ivec2(0, m), 0).rgb, texelFetch(uMatTex, ivec2(1, m), 0).rgb, 0.6);
  vec3 acc = texelFetch(uMatTex, ivec2(2, m), 0).rgb;
  float pat = texelFetch(uMatTex, ivec2(0, m), 0).a;
  // pastel paper: lift and soften the palette
  vec3 col = mix(base, vec3(0.62, 0.56, 0.5), 0.25) * 1.25;
  if (pat > 2.5 && pat < 4.5) {
    vec4 v = voronoi(p * 1.8);
    float dot_ = smoothstep(0.26, 0.2, v.x) * step(hash12(v.zw), 0.7);
    col = mix(col, acc * 1.1, dot_);
  }
  if (pat > 0.5 && pat < 1.5) col *= 0.92 + 0.08 * step(0.5, fract(p.y * 0.5 + fbm3(p * 0.2)));
  vec2 fg = fogAt(p);
  if (fg.x < 0.5) col = vec3(0.16, 0.18, 0.26);
  col *= 1.0 + paperGrain(p);
  // the cut edge catches light
  float edge = smoothstep(0.62, 0.5, mk);
  col = mix(col, vec3(0.95, 0.92, 0.85), edge * 0.6);
  vec4 L = lightAt(p);
  vec3 lit = L.rgb + L.a * uSkyLight;
  col *= 0.42 + 0.58 * min(vec3(1.2), lit);
  col += lit * 0.04;
  gl_FragColor = vec4(col, 1.0);
}
`;

const S07_BACK = /* glsl */ `
uniform sampler2D uMatTex;
${GLSL_WORLD}
${GLSL_NOISE}
${GLSL_LIGHT}
${PAPER}
varying vec3 vPos;
void main() {
  vec2 p = vPos.xy;
  vec4 t = tileAt(p);
  if (int(t.g * 255.0 + 0.5) == 1) discard;
  int m = int(t.r * 255.0 + 0.5);
  vec3 base = mix(texelFetch(uMatTex, ivec2(0, m), 0).rgb, texelFetch(uMatTex, ivec2(1, m), 0).rgb, 0.5);
  vec3 col = mix(base, vec3(0.3, 0.27, 0.25), 0.4) * 0.75;
  col *= 1.0 + paperGrain(p * 1.3);
  // shadow cast by the front paper layer (offset down-right, softened)
  float sh = 0.0;
  for (int k = 0; k < 4; k++) {
    vec2 o = vec2(0.28, -0.32) + vec2(float(k % 2), float(k / 2)) * 0.18;
    sh += smoothstep(0.35, 0.65, frontMask(p + o));
  }
  col *= 1.0 - 0.5 * sh / 4.0;
  vec4 L = lightAt(p);
  vec3 lit = L.rgb + L.a * uSkyLight;
  col *= 0.3 + 0.7 * min(vec3(1.3), lit);
  col += lit * 0.05;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const S07: RenderStyle = {
  id: 's07-papercut',
  namePl: 'Wycinanka papierowa',
  descPl: 'Warstwy papieru: pastelowa skała z poszarpaną krawędzią rzuca cień na tło tuneli.',
  create(ctx) {
    const scene = new THREE.Scene();
    const u = worldUniforms(ctx);
    const sky = new SkyView(ctx.world);
    scene.add(sky.group);
    scene.add(arenaPlane(ctx, 0, new THREE.ShaderMaterial({ vertexShader: PLANE_VERT, fragmentShader: S07_FRONT, uniforms: u })));
    scene.add(arenaPlane(ctx, -1.4, new THREE.ShaderMaterial({ vertexShader: PLANE_VERT, fragmentShader: S07_BACK, uniforms: u })));
    const { fill } = toonProps(u, 4, false);
    scene.add(buildProps(ctx, () => fill));
    scene.add(buildMannequins(ctx, fill));
    scene.add(buildFluids(ctx, u));
    const post = new PostFX(ctx.renderer, scene, ctx.camera, ctx.width, ctx.height);
    post.bloom.strength = 0.45;
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
