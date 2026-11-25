/**
 * Tournament #2: variants of the material palette and procedural patterns.
 * Each variant transforms the baseline look table before a style builds its
 * material texture (lab URL parameter `mat`).
 */
import * as THREE from 'three';
import { LOOK, PAT, type MatLook } from '../render/palette';
import { M, MATERIALS } from '../world/materials';

const BASE: readonly MatLook[] = LOOK.map((l) => ({ ...l }));

function adj(hex: number, o: { s?: number; l?: number; h?: number; toward?: number; amt?: number }): number {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL((hsl.h + (o.h ?? 0) + 1) % 1, Math.min(1, hsl.s * (o.s ?? 1)), Math.min(0.95, hsl.l * (o.l ?? 1)));
  if (o.toward !== undefined) c.lerp(new THREE.Color(o.toward), o.amt ?? 0.2);
  return c.getHex();
}
const both = (l: MatLook, o: Parameters<typeof adj>[1]) => ({ ...l, a: adj(l.a, o), b: adj(l.b, o) });
const ORES = new Set<number>(MATERIALS.filter((m) => m.cls === 'ore' || m.cls === 'gem').map((m) => m.id));
const ROCKS = new Set<number>(MATERIALS.filter((m) => m.solid && !ORES.has(m.id)).map((m) => m.id));

/** The palette before tournament #2 (first 25 materials), kept as the control. */
const LEGACY: Partial<Record<number, [number, number, number, number, number?, number?, number?, number?, number?, number?]>> = {
  [M.SOIL]: [0x4a3222, 0x6e4a30, 0x8a7a68, PAT.SOIL, 0.02, 0, 1.4, 0.8, 0.35, 0.7],
  [M.CLAY]: [0x7d4430, 0x9c5a3a, 0xb87a55, PAT.SOIL, 0.08, 0, 0.8, 0.5, 0.15, 0.4],
  [M.SAND]: [0xb39364, 0xd1b07c, 0xe8d3a6, PAT.SAND, 0.05, 0, 2, 0.4, 0.4],
  [M.LIMESTONE]: [0x8a8070, 0xaea38e, 0xc9bfaa, PAT.STRATA, 0.08],
  [M.SANDSTONE]: [0x93653f, 0xb98854, 0xd4a66f, PAT.STRATA, 0.05, 0, 1.3, 0.8, 0.6, 0.6],
  [M.SHALE]: [0x4c4e53, 0x63666c, 0x7b7f86, PAT.STRATA, 0.12, 0, 2.2, 0.9, 0.4, 0.3],
  [M.GRANITE]: [0x625c5c, 0x837a77, 0xc79a8f, PAT.SPECKLE, 0.18, 0, 1, 1.1, 0.55, 0.4],
  [M.SLATE]: [0x333a46, 0x48525f, 0x6c7a8c, PAT.STRATA, 0.2, 0, 2.6, 1, 0.35, 0.3],
  [M.BASALT]: [0x232428, 0x34353c, 0x55565f, PAT.SPECKLE, 0.15, 0, 1.6, 1.3, 0.3, 0.35],
  [M.OBSIDIAN]: [0x0c0912, 0x211832, 0x6a4c9c, PAT.GLASSY, 0.9, 0, 0.8, 1.4, 0.4, 0.6],
  [M.MAGMA_ROCK]: [0x221310, 0x371b13, 0xff5a1a, PAT.MAGMA, 0.1, 3, 1, 1.3, 0.5, 0.5],
  [M.BEDROCK]: [0x111015, 0x1e1c24, 0x3a3550, PAT.BEDROCK, 0.25, 0, 0.7, 1.6, 0.3, 0.3],
  [M.COAL]: [0x37332f, 0x4a443f, 0x0d0c0c, PAT.ORE, 0.6, 0, 1.2, 1.1, 0.65, 0.4],
  [M.COPPER]: [0x7f7769, 0x9b917f, 0xe07b3c, PAT.ORE, 0.85, 0.05],
  [M.IRON]: [0x5f5958, 0x7a716e, 0xa4523a, PAT.ORE, 0.7, 0, 1, 1.1],
  [M.SILVER]: [0x4e5058, 0x666872, 0xeef3ff, PAT.ORE, 1, 0.08, 1.1],
  [M.GOLD]: [0x413d47, 0x56505d, 0xffc23d, PAT.ORE, 1, 0.15],
  [M.FROST_CRYSTAL]: [0x1f2a3c, 0x2e3b57, 0x52d6ff, PAT.CRYSTAL, 1, 2.2, 1, 1.4, 0.6],
  [M.AMETHYST]: [0x251f30, 0x372c4a, 0xb46cff, PAT.CRYSTAL, 1, 2, 1.1, 1.4, 0.55],
  [M.GLIMMERITE]: [0x171b27, 0x252c40, 0xc4ecff, PAT.ORE, 1, 1.6, 1.4, 1.2, 0.45],
  [M.MYCELIUM]: [0x26302f, 0x384a47, 0x45e6c0, PAT.MYCELIUM, 0.1, 1.3, 1.2, 0.7, 0.35, 0.6],
  [M.ANCIENT_BRICK]: [0x403f4a, 0x55535f, 0x6ff0ff, PAT.BRICK, 0.3, 1.4, 1, 1, 0.15, 0.4],
  [M.EMBERITE]: [0x26170f, 0x3a2216, 0xff8a26, PAT.ORE, 0.8, 2.6, 1, 1.2],
  [M.STONE_BRICK]: [0x6e685f, 0x8b847a, 0x5a554e, PAT.BRICK, 0.12, 0, 1, 1, 0],
};
const legacy = (l: MatLook, id: number): MatLook => {
  const v = LEGACY[id];
  if (!v) return l;
  const [a, b, accent, pattern, spec = 0.1, emissive = 0, scale = 1, bump = 1, amount = 0.5, variation = 0.5] = v;
  return { a, b, accent, pattern, spec, emissive, scale, bump, amount, variation, sheen: accent, glint: pattern === PAT.ORE || pattern === PAT.CRYSTAL ? 1 : 0, form: 0 };
};

const GAMEY: Partial<Record<number, [number, number]>> = {
  [M.SOIL]: [0x4a2a1c, 0x6e3e26], [M.CLAY]: [0x8a4026, 0xae5a34], [M.SAND]: [0xc8a464, 0xe0c287],
  [M.LIMESTONE]: [0xb8a98a, 0xd8cbb0], [M.SANDSTONE]: [0xb06a30, 0xd88a44], [M.SHALE]: [0x4a5566, 0x637086],
  [M.GRANITE]: [0x8a6a6a, 0xb08a86], [M.SLATE]: [0x2e3c56, 0x445877], [M.BASALT]: [0x1c1e28, 0x2c2e3c],
};
const TINT: Partial<Record<number, number>> = {
  [M.SOIL]: 0xffb070, [M.CLAY]: 0xff9060, [M.SAND]: 0xffe0a0, [M.LIMESTONE]: 0xffe2b0, [M.SANDSTONE]: 0xffb060,
  [M.SHALE]: 0x9fb4d8, [M.GRANITE]: 0xd8a8b0, [M.SLATE]: 0x8098d8, [M.BASALT]: 0x8070c0, [M.OBSIDIAN]: 0xa070ff,
  [M.MAGMA_ROCK]: 0xff6030, [M.BEDROCK]: 0x6060a0, [M.MYCELIUM]: 0x40e0c0, [M.ANCIENT_BRICK]: 0x80e0ff,
  [M.SHELL_LIMESTONE]: 0xffe0a0, [M.SPORE_SHALE]: 0xc080ff, [M.MUDSTONE]: 0x40b0a0, [M.SCHIST]: 0xa0a8ff,
  [M.DEEPSTONE]: 0x905070, [M.HEARTSTONE]: 0xff3040,
};

export interface MaterialVariant {
  id: string;
  namePl: string;
  apply: (l: MatLook, id: number) => MatLook;
}

export const MAT_VARIANTS: readonly MaterialVariant[] = [
  { id: 'm01-base', namePl: 'Paleta sprzed turnieju (kontrola)', apply: legacy },
  { id: 'm02-saturated', namePl: 'Nasycona, cieplejsza', apply: (l) => both(l, { s: 1.45, toward: 0xffc080, amt: 0.08 }) },
  { id: 'm03-realistic', namePl: 'Realistyczna, stonowana', apply: (l, id) => (ORES.has(id) ? l : both(l, { s: 0.55, l: 0.95 })) },
  { id: 'm04-gamey', namePl: 'Wyraźne barwy per skała', apply: (l, id) => (GAMEY[id] ? { ...l, a: GAMEY[id]![0], b: GAMEY[id]![1] } : l) },
  { id: 'm05-macro', namePl: 'Duże formy wzorów', apply: (l) => ({ ...l, scale: l.scale * 0.6 }) },
  { id: 'm06-micro', namePl: 'Drobny detal', apply: (l) => ({ ...l, scale: l.scale * 1.6, bump: l.bump * 0.85 }) },
  { id: 'm07-strata', namePl: 'Mocne warstwy', apply: (l) => (l.pattern === 1 ? { ...l, a: adj(l.a, { l: 0.75 }), b: adj(l.b, { l: 1.2 }), amount: Math.min(1, l.amount + 0.3) } : l) },
  { id: 'm08-painterly', namePl: 'Malarska zmienność barw', apply: (l) => ({ ...l, a: adj(l.a, { h: -0.03, s: 1.2 }), b: adj(l.b, { h: 0.04, s: 1.2 }), variation: Math.min(1, l.variation * 1.8) }) },
  { id: 'm09-biome-tint', namePl: 'Barwy biomów', apply: (l, id) => (TINT[id] ? both(l, { toward: TINT[id]!, amt: 0.22 }) : l) },
  { id: 'm10-ore-pop', namePl: 'Rudy na pierwszym planie', apply: (l, id) => (ORES.has(id) ? { ...l, accent: adj(l.accent, { s: 1.2, l: 1.15 }), amount: Math.min(1, l.amount + 0.2), spec: Math.min(1, l.spec + 0.1) } : ROCKS.has(id) ? both(l, { s: 0.7, l: 0.85 }) : l) },
  { id: 'm11-crystal-glam', namePl: 'Blask klejnotów i metali', apply: (l, id) => (ORES.has(id) ? { ...l, emissive: l.emissive * 1.6 + 0.15, spec: 1 } : l) },
  { id: 'm12-contrast', namePl: 'Kontrastowa faktura', apply: (l) => ({ ...l, a: adj(l.a, { l: 0.8 }), b: adj(l.b, { l: 1.25 }), bump: l.bump * 1.2 }) },
  { id: 'm13-designed', namePl: 'Projektowana pełna (domyślna)', apply: (l) => l },
  { id: 'm14-sheen-strong', namePl: 'Mocniejsze iskrzenie rud', apply: (l) => ({ ...l, glint: Math.min(1.6, l.glint * 1.5) }) },
  { id: 'm15-no-sheen', namePl: 'Iskry w kolorze akcentu (bez połysku)', apply: (l) => ({ ...l, sheen: l.accent }) },
];

/** Apply one variant or a chain (joined by '+', ' ' or ','; note '+' arrives as ' ' from URLs). */
export function applyMaterialVariant(id: string | null): void {
  const chain = (id ?? 'm13-designed')
    .split(/[+ ,|]+/)
    .filter(Boolean)
    .map((x) => {
      const v = MAT_VARIANTS.find((m) => m.id === x);
      if (!v) throw new Error(`unknown material variant ${x}`);
      return v;
    });
  BASE.forEach((b, i) => (LOOK[i] = chain.reduce((l, v) => v.apply(l, i), { ...b })));
}
