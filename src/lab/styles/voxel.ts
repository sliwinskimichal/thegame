/**
 * Block-based styles:
 *  S02 rounded toy blocks (one bevelled cube per tile),
 *  S11 micro-voxels (3 x 3 cubes per tile with material-driven colour).
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { hash2f, hash3f } from '../../core/rng';
import { LOOK, flatColor } from '../../render/palette';
import { PostFX } from '../../render/post';
import { SkyView } from '../../render/sky';
import { M, MATERIALS, SOLID } from '../../world/materials';
import { CAV, TF } from '../../world/world';
import { buildFluids, buildMannequins, buildProps, litMaterial, updateWorldUniforms, WINDY, worldUniforms } from '../common';
import type { RenderStyle, StyleContext } from '../style';

const GLOW = new Set<number>([M.CRYSTAL, M.AMETHYST, M.MAGMA_ROCK, M.MYCELIUM, M.EMBERITE, M.GLIMMERITE]);
const ORE = new Set<number>(MATERIALS.filter((m) => m.cls === 'ore' || m.cls === 'gem').map((m) => m.id));

function withAttrs(geo: THREE.BufferGeometry, emissive: number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const n = g.attributes.position!.count;
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  g.setAttribute('aEmissive', new THREE.BufferAttribute(new Float32Array(n).fill(emissive), 1));
  return g;
}

interface Inst {
  m: THREE.Matrix4[];
  c: THREE.Color[];
}
const inst = (): Inst => ({ m: [], c: [] });
function push(i: Inst, x: number, y: number, z: number, sx: number, sy: number, sz: number, c: THREE.Color): void {
  i.m.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz)));
  i.c.push(c);
}
function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, i: Inst): THREE.InstancedMesh {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, i.m.length));
  i.m.forEach((x, k) => m.setMatrixAt(k, x));
  i.c.forEach((x, k) => m.setColorAt(k, x));
  m.count = i.m.length;
  m.frustumCulled = false;
  return m;
}

function common(ctx: StyleContext, scene: THREE.Scene) {
  const u = worldUniforms(ctx);
  const sky = new SkyView(ctx.world);
  scene.add(sky.group);
  const propLit = litMaterial(u);
  const propWind = litMaterial(u, { wind: 0.05, doubleSide: true });
  scene.add(buildProps(ctx, (t) => (WINDY.has(t) ? propWind : propLit)));
  scene.add(buildMannequins(ctx, litMaterial(u, { rim: 0.35 })));
  scene.add(buildFluids(ctx, u));
  const post = new PostFX(ctx.renderer, scene, ctx.camera, ctx.width, ctx.height);
  post.setSize(ctx.width, ctx.height);
  return { u, sky, post };
}

const GRASS = new THREE.Color(0x4f7f2a);

export const S02: RenderStyle = {
  id: 's02-blocks',
  namePl: 'Fazowane klocki',
  descPl: 'Każdy kafel to zaokrąglony klocek jak zabawka; wnętrza to płytki tylnej ściany; mocne AO.',
  create(ctx) {
    const scene = new THREE.Scene();
    const { u, sky, post } = common(ctx, scene);
    const { world } = ctx;
    const solid = inst();
    const glow = inst();
    const back = inst();
    for (let y = 0; y < world.h; y++)
      for (let x = 0; x < world.w; x++) {
        const i = world.idx(x, y);
        const explored = (world.flags[i]! & TF.EXPLORED) !== 0;
        const m = world.mat[i]!;
        const cx = x + 0.5;
        const cy = -y - 0.5;
        if (world.cav[i] === CAV.SKY) continue;
        if (!explored) {
          push(solid, cx, cy, -0.5, 0.97, 0.97, 1, new THREE.Color(0.1, 0.1, 0.12));
          continue;
        }
        if (SOLID[m]) {
          let c = flatColor(m).multiplyScalar(0.85 + 0.3 * hash2f(x, y, 7));
          if (ORE.has(m)) c = flatColor(m).lerp(new THREE.Color(LOOK[m]!.accent), 0.7);
          const grassy = (m === M.SOIL || m === M.CLAY) && y > 0 && world.cav[i - world.w] === CAV.SKY;
          if (grassy) {
            c = GRASS.clone().multiplyScalar(0.9 + 0.2 * hash2f(x, y, 9));
            for (let z = 1; z <= 2; z++) push(solid, cx, cy, -0.5 - z, 0.97, 0.97, 1, GRASS.clone().multiplyScalar(0.85 + 0.2 * hash2f(x, z, 3)));
          }
          push(GLOW.has(m) ? glow : solid, cx, cy, -0.5, 0.97, 0.97, 1, c);
        } else {
          const d = world.depth[i]! / 32;
          push(back, cx, cy, -d - 0.05, 0.97, 0.97, 0.1, flatColor(world.bg[i] || M.LIMESTONE).multiplyScalar(0.55));
        }
      }
    const geo = new RoundedBoxGeometry(1, 1, 1, 2, 0.12);
    const mat = litMaterial(u, { rim: 0.15, ambient: 0.18 });
    scene.add(mesh(withAttrs(geo.clone(), 0), mat, solid));
    scene.add(mesh(withAttrs(geo.clone(), 0.9), mat, glow));
    scene.add(mesh(withAttrs(new THREE.BoxGeometry(1, 1, 1), 0), mat, back));
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

export const S11: RenderStyle = {
  id: 's11-microvoxel',
  namePl: 'Mikro-woksele',
  descPl: 'Kafel złożony z 3×3 sześcianów z wypukłościami; rudy i warstwy jako kolorowe kostki.',
  create(ctx) {
    const scene = new THREE.Scene();
    const { u, sky, post } = common(ctx, scene);
    const { world } = ctx;
    const solid = inst();
    const glow = inst();
    const S = 1 / 3;
    for (let y = 0; y < world.h; y++)
      for (let x = 0; x < world.w; x++) {
        const i = world.idx(x, y);
        if (world.cav[i] === CAV.SKY) continue;
        const explored = (world.flags[i]! & TF.EXPLORED) !== 0;
        const m = world.mat[i]!;
        const L = LOOK[m]!;
        const grassy = explored && (m === M.SOIL || m === M.CLAY) && y > 0 && world.cav[i - world.w] === CAV.SKY;
        for (let sy = 0; sy < 3; sy++)
          for (let sx = 0; sx < 3; sx++) {
            const px = x + (sx + 0.5) * S;
            const py = -y - (sy + 0.5) * S;
            const hsh = hash3f(x * 3 + sx, y * 3 + sy, m, 5);
            if (!explored) {
              push(solid, px, py, -0.5, S * 0.98, S * 0.98, 1, new THREE.Color(0.09, 0.09, 0.11).multiplyScalar(0.8 + 0.4 * hsh));
              continue;
            }
            if (SOLID[m]) {
              let c = new THREE.Color(L.a).lerp(new THREE.Color(L.b), hsh);
              if (L.pattern === 1) c = new THREE.Color(L.a).lerp(new THREE.Color(L.b), hash2f(0, y * 3 + sy, 11)); // strata rows
              const accent = ORE.has(m) ? hsh > 0.45 : L.pattern === 2 && hsh > 0.85;
              if (accent) c = new THREE.Color(L.accent);
              if (grassy && sy === 0) c = GRASS.clone().multiplyScalar(0.8 + 0.4 * hsh);
              const out = (hsh - 0.5) * 0.12 + (accent ? 0.08 : 0);
              const target = GLOW.has(m) && accent ? glow : solid;
              push(target, px, py, -0.5 + out * 0.5, S * 0.96, S * 0.96, 1 + out, c);
              if (grassy && sy === 0) for (let z = 1; z <= 8; z++) push(solid, px, py, -0.5 - z * S * 1.1, S * 0.96, S * 0.96, S, GRASS.clone().multiplyScalar(0.75 + 0.4 * hash3f(x, z, sx, 2)));
            } else {
              const d = world.depth[i]! / 32;
              const c = new THREE.Color(LOOK[world.bg[i] || M.LIMESTONE]!.a).multiplyScalar(0.5 + 0.3 * hsh);
              push(solid, px, py, -d - S * 0.5 + (hsh - 0.5) * 0.15, S * 0.96, S * 0.96, S, c);
            }
          }
      }
    const mat = litMaterial(u, { rim: 0.1, ambient: 0.16 });
    const geo = new THREE.BoxGeometry(1, 1, 1);
    scene.add(mesh(withAttrs(geo.clone(), 0), mat, solid));
    scene.add(mesh(withAttrs(geo.clone(), 1.4), mat, glow));
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
