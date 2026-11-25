/**
 * Tournament #1, round 2: refined finalists combining the strengths found
 * in round 1 (see docs/variants/01-render-style.md).
 *  R2A "Makieta nastrojowa"  — S01 detail + brighter interiors, ore glints, glowing air.
 *  R2B "Sylwetki czytelne"   — S10 atmosphere, but rock keeps its material and ores glint.
 *  R2C "Wektor miękki"       — S04 outlines with smooth (non-banded) light.
 */
import * as THREE from 'three';
import { PostFX } from '../../render/post';
import { GLSL_LIGHT, GLSL_NOISE } from '../../render/shaderlib';
import { GLSL_WORLD } from '../../render/worldTex';
import { updateWorldUniforms, type WorldUniforms } from '../common';
import type { RenderStyle, StyleContext } from '../style';
import { createVector, S04_FRAG } from './flat';
import { buildDioramaScene, TERRAIN_FRAG } from './s01-diorama';

/** Additive sheet that makes the air of tunnels and caves glow with the light field. */
function glowingAir(ctx: StyleContext, u: WorldUniforms, strength: number): THREE.Mesh {
  const { w, h } = ctx.world;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.ShaderMaterial({
      uniforms: { ...u, uStrength: { value: strength } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `varying vec3 vPos; void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vPos = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: /* glsl */ `
        uniform float uStrength;
        ${GLSL_WORLD}
        ${GLSL_NOISE}
        ${GLSL_LIGHT}
        varying vec3 vPos;
        void main() {
          vec2 p = vPos.xy;
          if (int(tileAt(p).g * 255.0 + 0.5) == 1) discard;
          vec2 fg = fogAt(p);
          vec4 L = lightAt(p);
          float dust = 0.75 + 0.5 * fbm3(p * 0.7 + vec2(uTime * 0.04, uTime * 0.015));
          vec3 c = (L.rgb + L.a * uSkyLight * 0.4) * uStrength * (1.0 - fg.y) * dust * fg.x;
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  m.position.set(w / 2, -h / 2, -0.25);
  m.renderOrder = 5;
  return m;
}

function terrainVariant(ctx: StyleContext, frag: string, ambCut: number, ambIn: number) {
  const d = buildDioramaScene(ctx);
  d.terrain.fragmentShader = frag;
  d.terrain.uniforms.uCutAmbient!.value = ambCut;
  d.terrain.uniforms.uInteriorAmbient!.value = ambIn;
  d.terrain.needsUpdate = true;
  return d;
}

// ores sparkle a little everywhere so prospecting by eye works even in the dark
const ORE_GLINT = `
  if (pat == 3 || pat == 4) {
    float tw = pow(hash12(floor(uv * 9.0) + floor(uTime * 1.5)), 12.0);
    col += p2.rgb * (0.12 + tw * 0.9) * smoothstep(0.2, 0.8, fogAt(owner).x);
  }
`;

const R2A_FRAG = TERRAIN_FRAG.replace(
  '  vec3 col = sf.albedo * (light + amb) * vAo + spec * sf.spec * 0.6 + sf.emissive;',
  '  vec3 col = sf.albedo * (light + amb) * vAo + spec * sf.spec * 0.8 + sf.emissive * 1.5;' + ORE_GLINT,
);

export const R2A: RenderStyle = {
  id: 'r2a-diorama-plus',
  namePl: 'Makieta nastrojowa',
  descPl: 'Detal makiety + jaśniejsze wnętrza, iskrzące rudy i świecące powietrze tuneli.',
  create(ctx) {
    const { scene, sky, u } = terrainVariant(ctx, R2A_FRAG, 0.15, 0.34);
    scene.add(glowingAir(ctx, u, 0.09));
    const post = new PostFX(ctx.renderer, scene, ctx.camera, ctx.width, ctx.height);
    post.bloom.strength = 0.75;
    post.bloom.radius = 0.7;
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

const R2B_FRAG = TERRAIN_FRAG.replace(
  '  vec3 col = sf.albedo * (light + amb) * vAo + spec * sf.spec * 0.6 + sf.emissive;',
  `  vec3 col;
  if (cap && !interior) {
    // rock stays a dark silhouette but keeps its material: light reveals it, rims outline it
    float occR = fogAt(wp.xy).y;
    float rimR = smoothstep(0.92, 0.55, occR);
    col = sf.albedo * (light * 0.42 + amb * 0.55) + spec * sf.spec * 0.5 + sf.emissive * 1.6 + light * rimR * 0.35;
  } else {
    col = sf.albedo * (light * 1.15 + amb) * vAo + spec * sf.spec * 0.8 + sf.emissive * 1.4;
  }` + ORE_GLINT,
);

export const R2B: RenderStyle = {
  id: 'r2b-silhouette-plus',
  namePl: 'Sylwetki czytelne',
  descPl: 'Nastrój sylwetek: ciemna skała z poświatą krawędzi, ale z widocznym materiałem i iskrzącymi rudami.',
  create(ctx) {
    const { scene, sky, u } = terrainVariant(ctx, R2B_FRAG, 0.1, 0.3);
    scene.add(glowingAir(ctx, u, 0.14));
    const post = new PostFX(ctx.renderer, scene, ctx.camera, ctx.width, ctx.height);
    post.bloom.strength = 0.95;
    post.bloom.radius = 0.8;
    post.bloom.threshold = 0.62;
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

export function softenVector(frag: string): string {
  return frag
    .replace('float band = floor(min(l, 1.6) * 3.0 + 0.5) / 3.0;', 'float band = 1.0 - exp(-l * 1.6);')
    .replace('col *= (solid ? 0.32 : 0.22) + band * mix(vec3(1.0), tint, 0.55);', 'col *= (solid ? 0.3 : 0.2) + band * 1.15 * mix(vec3(1.0), tint, 0.6);');
}

/** R2C: the vector style with smooth light instead of hard bands. */
export const R2C: RenderStyle = {
  id: 'r2c-vector-soft',
  namePl: 'Wektor miękki',
  descPl: 'Kontury tuszem i płaskie barwy, ale miękkie, ciągłe światło i delikatne gradienty.',
  create: (ctx) => createVector(ctx, softenVector(S04_FRAG), 6, 0.5),
};
