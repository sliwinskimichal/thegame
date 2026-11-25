/**
 * Material look table: colours and procedural-pattern parameters of every
 * world material (tournament #2, docs/variants/02-materials.md).
 *
 * Design rules (checked by tests/palette.test.ts):
 *  - each biome has its own colour story (warm earth -> pink/blue -> violet and
 *    teal -> black-green water -> cold lavender -> black and fire -> plum and runes),
 *  - materials that meet in one biome differ clearly in mean colour, also under
 *    deuteranopia (lightness carries the difference where hue cannot),
 *  - ores = a host-like matrix + a signature accent; `sheen` is the colour of the
 *    twinkle that lets a prospector spot them in the dark (coal: steel-blue glint).
 */
import * as THREE from 'three';
import { M, MAT_COUNT } from '../world/materials';

export const PAT = {
  SOIL: 0, STRATA: 1, SPECKLE: 2, ORE: 3, CRYSTAL: 4, MAGMA: 5, BRICK: 6, GLASSY: 7, MYCELIUM: 8, BEDROCK: 9, SAND: 10,
  FOSSIL: 11, RUNES: 12,
} as const;

export interface MatLook {
  a: number;
  b: number;
  accent: number;
  pattern: number;
  spec: number;
  emissive: number;
  scale: number;
  bump: number;
  amount: number;
  variation: number;
  /** Twinkle colour (sRGB hex) and strength 0..1 (0 = no twinkle). */
  sheen: number;
  glint: number;
  /** Growth form of ore grains / gem crystals (FORM.*). */
  form: number;
}

/** Mineral growth forms: ores and gems differ by shape, not only by colour. */
export const FORM = { ROUND: 0, CUBIC: 1, NEEDLES: 2, DENDRITE: 3, BOTRYOIDAL: 4, SEAM: 5, DUST: 6 } as const;
/** Gem forms (pattern CRYSTAL). */
export const GEM = { SHARDS: 0, DRUSE: 1, PRISMS: 2, HEX: 3 } as const;

interface LookDef {
  a: number;
  b: number;
  acc: number;
  pat: number;
  spec?: number;
  emi?: number;
  scale?: number;
  bump?: number;
  amount?: number;
  vari?: number;
  sheen?: number;
  glint?: number;
  form?: number;
}

const def = (d: LookDef): MatLook => {
  const twinkles = d.pat === PAT.ORE || d.pat === PAT.CRYSTAL;
  return {
    a: d.a, b: d.b, accent: d.acc, pattern: d.pat, spec: d.spec ?? 0.1, emissive: d.emi ?? 0, scale: d.scale ?? 1,
    bump: d.bump ?? 1, amount: d.amount ?? 0.5, variation: d.vari ?? 0.5, sheen: d.sheen ?? d.acc, glint: d.glint ?? (twinkles ? 1 : 0),
    form: d.form ?? 0,
  };
};

export const LOOK: MatLook[] = new Array(MAT_COUNT).fill(null).map(() => def({ a: 0x777777, b: 0x999999, acc: 0xffffff, pat: PAT.SPECKLE }));
const set = (id: number, d: LookDef) => (LOOK[id] = def(d));

// --- Foothills: warm earth --------------------------------------------------
set(M.SOIL, { a: 0x3e2618, b: 0x5a3a24, acc: 0x8a7a68, pat: PAT.SOIL, spec: 0.02, scale: 1.4, bump: 0.8, amount: 0.35, vari: 0.7 });
set(M.CLAY, { a: 0x8c3f24, b: 0xb2583a, acc: 0xb87a55, pat: PAT.SOIL, spec: 0.08, scale: 0.8, bump: 0.5, amount: 0.15, vari: 0.4 });
set(M.SAND, { a: 0xc9a868, b: 0xe6cd92, acc: 0xf2e4c0, pat: PAT.SAND, spec: 0.05, scale: 2, bump: 0.4, amount: 0.4 });
set(M.COPPER, { a: 0x2f5a48, b: 0x3f7a5e, acc: 0xe88848, pat: PAT.ORE, spec: 0.85, emi: 0.05, amount: 0.6, sheen: 0xffb070, form: FORM.DENDRITE });

// --- Limestone Ledges: cream, ochre and grey bands ---------------------------
set(M.LIMESTONE, { a: 0x9a9888, b: 0xb8b6a6, acc: 0xd6d4c6, pat: PAT.STRATA, spec: 0.08 });
set(M.SANDSTONE, { a: 0xa65f2c, b: 0xcf8646, acc: 0xd4a66f, pat: PAT.STRATA, spec: 0.05, scale: 1.3, bump: 0.8, amount: 0.6, vari: 0.6 });
set(M.SHALE, { a: 0x3d4656, b: 0x56617a, acc: 0x7b7f86, pat: PAT.STRATA, spec: 0.12, scale: 2.2, bump: 0.9, amount: 0.4, vari: 0.3 });
set(M.COAL, { a: 0x141210, b: 0x211d1a, acc: 0x34363c, pat: PAT.ORE, spec: 0.9, scale: 1.2, bump: 1.1, amount: 0.75, vari: 0.3, sheen: 0xa0a4aa, glint: 0.2, form: FORM.SEAM });
set(M.TIN, { a: 0x5c6a68, b: 0x70807c, acc: 0x2a1a14, pat: PAT.ORE, spec: 0.8, scale: 1.1, bump: 1.2, amount: 0.8, vari: 0.4, sheen: 0xd0a070, glint: 0.6, form: FORM.NEEDLES });
set(M.SHELL_LIMESTONE, { a: 0xd6c296, b: 0xead8ac, acc: 0x9a7448, pat: PAT.FOSSIL, spec: 0.06, amount: 0.5, vari: 0.3 });
set(M.SALTPETER, { a: 0xc4c6c4, b: 0xd8dad8, acc: 0xfbfcff, pat: PAT.ORE, spec: 0.35, scale: 1.4, bump: 0.7, amount: 0.95, vari: 0.3, glint: 0 });

// --- Granite Roots: salmon granite and blue slate ----------------------------
set(M.GRANITE, { a: 0x93706a, b: 0xb8928a, acc: 0xe6b0a0, pat: PAT.SPECKLE, spec: 0.18, bump: 1.1, amount: 0.55, vari: 0.4 });
set(M.SLATE, { a: 0x24324e, b: 0x3a4c70, acc: 0x6c7a8c, pat: PAT.STRATA, spec: 0.2, scale: 2.6, amount: 0.35, vari: 0.3 });
set(M.IRON, { a: 0x4a3430, b: 0x5e403a, acc: 0xb8442a, pat: PAT.ORE, spec: 0.7, bump: 1.1, amount: 0.7, sheen: 0xff8866, form: FORM.BOTRYOIDAL });
set(M.GALENA, { a: 0x2e3036, b: 0x3a3d44, acc: 0x9ca8bc, pat: PAT.ORE, spec: 1, scale: 0.8, amount: 0.7, vari: 0.3, sheen: 0xdfe8ff, form: FORM.CUBIC });
set(M.SPHALERITE, { a: 0x5e5a3a, b: 0x747048, acc: 0xd8c860, pat: PAT.ORE, spec: 0.85, scale: 0.8, amount: 0.7, sheen: 0xfff0a0 });
set(M.QUARTZ, { a: 0xb4b8c0, b: 0xd2d6dc, acc: 0xf6f2fa, pat: PAT.CRYSTAL, spec: 1, emi: 0.15, amount: 0.7, bump: 1.2, sheen: 0xffffff, glint: 0.35, form: GEM.PRISMS });

// --- Fungal Grottos: violet shale under teal glow ----------------------------
set(M.SPORE_SHALE, { a: 0x2a1c30, b: 0x3c2846, acc: 0x7a5a74, pat: PAT.STRATA, spec: 0.1, scale: 1.8, amount: 0.4, vari: 0.4 });
set(M.MYCELIUM, { a: 0x3a6a5e, b: 0x4e8c7c, acc: 0x45e6c0, pat: PAT.MYCELIUM, spec: 0.1, emi: 1.3, scale: 1.2, bump: 0.7, amount: 0.35, vari: 0.6 });
set(M.SILVER, { a: 0x2a2c34, b: 0x383a44, acc: 0xf0f4ff, pat: PAT.ORE, spec: 1, emi: 0.08, scale: 1.3, amount: 0.6, sheen: 0xffffff, form: FORM.DENDRITE });
set(M.SULFUR, { a: 0xb8a438, b: 0xd8c850, acc: 0x8a7a30, pat: PAT.SOIL, spec: 0.2, scale: 1.2, bump: 0.7, amount: 0.3, vari: 0.4 });

// --- Sunken Deep: black-green wet stone ----------------------------------------
set(M.MUDSTONE, { a: 0x1c2a2c, b: 0x2a3c3e, acc: 0x4a6a6a, pat: PAT.STRATA, spec: 0.5, scale: 2.4, amount: 0.3, vari: 0.3 });
set(M.SALT, { a: 0xc8d0dc, b: 0xe4eaf2, acc: 0xffffff, pat: PAT.GLASSY, spec: 0.6, scale: 1.4, bump: 0.9, vari: 0.4 });
set(M.NICKEL, { a: 0x2e3a30, b: 0x3c4a3e, acc: 0x8ed27a, pat: PAT.ORE, spec: 0.4, amount: 0.8, sheen: 0xc8ffb0, glint: 0.4, form: FORM.DUST });
set(M.GOLD, { a: 0x4a463f, b: 0x5e5850, acc: 0xffc23d, pat: PAT.ORE, spec: 1, emi: 0.15, amount: 0.55, sheen: 0xffe9a0 });

// --- Crystal Depths: cold violet schist, gems ---------------------------------
set(M.SCHIST, { a: 0x3a3656, b: 0x4e4a70, acc: 0x8a90b8, pat: PAT.SPECKLE, spec: 0.5, scale: 1.4, amount: 0.3, vari: 0.35 });
set(M.COBALT, { a: 0x8a6a80, b: 0xa07e94, acc: 0xff5c9c, pat: PAT.ORE, spec: 0.7, amount: 0.7, sheen: 0xffa0d0, form: FORM.NEEDLES });
set(M.AMETHYST, { a: 0x251f30, b: 0x372c4a, acc: 0xb46cff, pat: PAT.CRYSTAL, spec: 1, emi: 2, scale: 1.1, bump: 1.4, amount: 0.55, form: GEM.DRUSE });
set(M.SAPPHIRE, { a: 0x141c3a, b: 0x1e2a52, acc: 0x3a6cff, pat: PAT.CRYSTAL, spec: 1, emi: 1.6, bump: 1.4, amount: 0.6, form: GEM.HEX });
set(M.FROST_CRYSTAL, { a: 0x2a3a4e, b: 0x3c5068, acc: 0x7ae4ff, pat: PAT.CRYSTAL, spec: 1, emi: 2.2, bump: 1.4, amount: 0.6 });

// --- Magma Belt: black basalt and fire ----------------------------------------
set(M.BASALT, { a: 0x1e2128, b: 0x30343e, acc: 0x55565f, pat: PAT.SPECKLE, spec: 0.15, scale: 1.6, bump: 1.3, amount: 0.3, vari: 0.35 });
set(M.MAGMA_ROCK, { a: 0x221310, b: 0x371b13, acc: 0xff5a1a, pat: PAT.MAGMA, spec: 0.1, emi: 3, bump: 1.3 });
set(M.OBSIDIAN, { a: 0x0b0812, b: 0x1e1430, acc: 0x8a5ad0, pat: PAT.GLASSY, spec: 0.9, scale: 0.8, bump: 1.4, amount: 0.4, vari: 0.6 });
set(M.RUBY, { a: 0xb8b0b0, b: 0xd4cccc, acc: 0xe8203c, pat: PAT.CRYSTAL, spec: 1, emi: 1.2, bump: 1.4, amount: 0.6, form: GEM.HEX });
set(M.EMBERITE, { a: 0x1e120c, b: 0x2c1a10, acc: 0xff8a26, pat: PAT.ORE, spec: 0.8, emi: 2.6, bump: 1.2, amount: 0.5, form: FORM.SEAM });

// --- Ancient Deep: plum darkness, runes, legendary ores -----------------------
set(M.DEEPSTONE, { a: 0x1c1618, b: 0x2a2024, acc: 0x5a4a50, pat: PAT.BEDROCK, spec: 0.2, scale: 1.2, bump: 1.4, amount: 0.3, vari: 0.3 });
set(M.ANCIENT_BRICK, { a: 0x505e78, b: 0x6a7c9a, acc: 0x6ff0ff, pat: PAT.BRICK, spec: 0.3, emi: 1.4, amount: 0.15, vari: 0.4 });
set(M.ADAMANTITE, { a: 0x142420, b: 0x1e3430, acc: 0x3ce0a0, pat: PAT.ORE, spec: 1, emi: 0.2, amount: 0.6, sheen: 0xa0ffe0, form: FORM.CUBIC });
set(M.RUNESTONE, { a: 0x241c24, b: 0x342832, acc: 0xff3a6e, pat: PAT.RUNES, spec: 0.3, emi: 2, amount: 0.55, vari: 0.3 });
set(M.GLIMMERITE, { a: 0x161a36, b: 0x202650, acc: 0xc4ecff, pat: PAT.ORE, spec: 1, emi: 1.6, scale: 1.4, bump: 1.2, amount: 0.8, form: FORM.DUST });

// --- Heart of the Mountain ------------------------------------------------------
set(M.HEARTSTONE, { a: 0x1e0c10, b: 0x2e1218, acc: 0xff2a3a, pat: PAT.MAGMA, spec: 0.2, emi: 1.2, scale: 0.8, bump: 1.4 });
set(M.BEDROCK, { a: 0x0a090e, b: 0x16131e, acc: 0x5a4a8a, pat: PAT.BEDROCK, spec: 0.25, scale: 0.7, bump: 1.6, amount: 0.3, vari: 0.3 });

// --- Built by dwarves ------------------------------------------------------------
set(M.STONE_BRICK, { a: 0x8f7c60, b: 0xab9676, acc: 0x5a4e40, pat: PAT.BRICK, spec: 0.12, amount: 0 });

/** Texels per material row in the look texture: a, b, accent, params, sheen, form. */
export const LOOK_TEXELS = 8;

/** Material table texture (one row per material) for procedural shaders. */
export function lookTexture(): THREE.DataTexture {
  let rows = 32;
  while (rows < MAT_COUNT) rows *= 2;
  const d = new Float32Array(LOOK_TEXELS * rows * 4);
  const lin = (hex: number) => {
    const c = new THREE.Color(hex);
    return [c.r, c.g, c.b];
  };
  LOOK.forEach((l, id) => {
    const o = id * LOOK_TEXELS * 4;
    d.set([...lin(l.a), l.pattern], o);
    d.set([...lin(l.b), l.spec], o + 4);
    d.set([...lin(l.accent), l.emissive], o + 8);
    d.set([l.scale, l.bump, l.amount, l.variation], o + 12);
    d.set([...lin(l.sheen), l.glint], o + 16);
    d.set([l.form, 0, 0, 0], o + 20);
  });
  const t = new THREE.DataTexture(d, LOOK_TEXELS, rows, THREE.RGBAFormat, THREE.FloatType);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

/** Average display colour of a material (sRGB hex) for flat styles. */
export function flatColor(id: number): THREE.Color {
  const l = LOOK[id]!;
  return new THREE.Color(l.a).lerp(new THREE.Color(l.b), 0.5);
}
