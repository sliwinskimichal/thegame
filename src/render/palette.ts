/**
 * Baseline material palette used while the render style is being decided.
 * (The material look gets its own tournament afterwards.)
 */
import * as THREE from 'three';
import { M, MAT_COUNT } from '../world/materials';

export const PAT = { SOIL: 0, STRATA: 1, SPECKLE: 2, ORE: 3, CRYSTAL: 4, MAGMA: 5, BRICK: 6, GLASSY: 7, MYCELIUM: 8, BEDROCK: 9, SAND: 10 } as const;

export interface MatLook {
  a: number;
  b: number;
  accent: number;
  pattern: number;
  /** specular, emissive, scale, bump, accentAmount, variation */
  spec: number;
  emissive: number;
  scale: number;
  bump: number;
  amount: number;
  variation: number;
}

const L = (a: number, b: number, accent: number, pattern: number, spec = 0.1, emissive = 0, scale = 1, bump = 1, amount = 0.5, variation = 0.5): MatLook =>
  ({ a, b, accent, pattern, spec, emissive, scale, bump, amount, variation });

export const LOOK: MatLook[] = new Array(MAT_COUNT).fill(null).map(() => L(0x777777, 0x999999, 0xffffff, PAT.SPECKLE));
LOOK[M.SOIL] = L(0x4a3222, 0x6e4a30, 0x8a7a68, PAT.SOIL, 0.02, 0, 1.4, 0.8, 0.35, 0.7);
LOOK[M.CLAY] = L(0x7d4430, 0x9c5a3a, 0xb87a55, PAT.SOIL, 0.08, 0, 0.8, 0.5, 0.15, 0.4);
LOOK[M.SAND] = L(0xb39364, 0xd1b07c, 0xe8d3a6, PAT.SAND, 0.05, 0, 2, 0.4, 0.4);
LOOK[M.LIMESTONE] = L(0x8a8070, 0xaea38e, 0xc9bfaa, PAT.STRATA, 0.08);
LOOK[M.SANDSTONE] = L(0x93653f, 0xb98854, 0xd4a66f, PAT.STRATA, 0.05, 0, 1.3, 0.8, 0.6, 0.6);
LOOK[M.SHALE] = L(0x4c4e53, 0x63666c, 0x7b7f86, PAT.STRATA, 0.12, 0, 2.2, 0.9, 0.4, 0.3);
LOOK[M.GRANITE] = L(0x625c5c, 0x837a77, 0xc79a8f, PAT.SPECKLE, 0.18, 0, 1, 1.1, 0.55, 0.4);
LOOK[M.SLATE] = L(0x333a46, 0x48525f, 0x6c7a8c, PAT.STRATA, 0.2, 0, 2.6, 1, 0.35, 0.3);
LOOK[M.BASALT] = L(0x232428, 0x34353c, 0x55565f, PAT.SPECKLE, 0.15, 0, 1.6, 1.3, 0.3, 0.35);
LOOK[M.OBSIDIAN] = L(0x0c0912, 0x211832, 0x6a4c9c, PAT.GLASSY, 0.9, 0, 0.8, 1.4, 0.4, 0.6);
LOOK[M.MAGMA_ROCK] = L(0x221310, 0x371b13, 0xff5a1a, PAT.MAGMA, 0.1, 3, 1, 1.3, 0.5, 0.5);
LOOK[M.BEDROCK] = L(0x111015, 0x1e1c24, 0x3a3550, PAT.BEDROCK, 0.25, 0, 0.7, 1.6, 0.3, 0.3);
LOOK[M.COAL] = L(0x37332f, 0x4a443f, 0x0d0c0c, PAT.ORE, 0.6, 0, 1.2, 1.1, 0.65, 0.4);
LOOK[M.COPPER] = L(0x7f7769, 0x9b917f, 0xe07b3c, PAT.ORE, 0.85, 0.05);
LOOK[M.IRON] = L(0x5f5958, 0x7a716e, 0xa4523a, PAT.ORE, 0.7, 0, 1, 1.1);
LOOK[M.SILVER] = L(0x4e5058, 0x666872, 0xeef3ff, PAT.ORE, 1, 0.08, 1.1);
LOOK[M.GOLD] = L(0x413d47, 0x56505d, 0xffc23d, PAT.ORE, 1, 0.15);
LOOK[M.CRYSTAL] = L(0x1f2a3c, 0x2e3b57, 0x52d6ff, PAT.CRYSTAL, 1, 2.2, 1, 1.4, 0.6);
LOOK[M.AMETHYST] = L(0x251f30, 0x372c4a, 0xb46cff, PAT.CRYSTAL, 1, 2, 1.1, 1.4, 0.55);
LOOK[M.GLIMMERITE] = L(0x171b27, 0x252c40, 0xc4ecff, PAT.ORE, 1, 1.6, 1.4, 1.2, 0.45);
LOOK[M.MYCELIUM] = L(0x26302f, 0x384a47, 0x45e6c0, PAT.MYCELIUM, 0.1, 1.3, 1.2, 0.7, 0.35, 0.6);
LOOK[M.ANCIENT_BRICK] = L(0x403f4a, 0x55535f, 0x6ff0ff, PAT.BRICK, 0.3, 1.4, 1, 1, 0.15, 0.4);
LOOK[M.EMBERITE] = L(0x26170f, 0x3a2216, 0xff8a26, PAT.ORE, 0.8, 2.6, 1, 1.2);
LOOK[M.STONE_BRICK] = L(0x6e685f, 0x8b847a, 0x5a554e, PAT.BRICK, 0.12, 0, 1, 1, 0);

/** Material table texture (4 texels per material) for procedural shaders. */
export function lookTexture(): THREE.DataTexture {
  const rows = 32;
  const d = new Float32Array(4 * rows * 4);
  const lin = (hex: number) => {
    const c = new THREE.Color(hex);
    return [c.r, c.g, c.b];
  };
  LOOK.forEach((l, id) => {
    const o = id * 16;
    d.set([...lin(l.a), l.pattern], o);
    d.set([...lin(l.b), l.spec], o + 4);
    d.set([...lin(l.accent), l.emissive], o + 8);
    d.set([l.scale, l.bump, l.amount, l.variation], o + 12);
  });
  const t = new THREE.DataTexture(d, 4, rows, THREE.RGBAFormat, THREE.FloatType);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

/** Average display colour of a material (sRGB hex) for flat styles. */
export function flatColor(id: number): THREE.Color {
  const l = LOOK[id]!;
  return new THREE.Color(l.a).lerp(new THREE.Color(l.b), 0.5);
}
