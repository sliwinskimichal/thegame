import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { buildArena } from '../src/lab/arena';
import { M, SOLID } from '../src/world/materials';
import { CAV, FLUID, PROP, TF } from '../src/world/world';

describe('arena', () => {
  const { world, unexplored } = buildArena();

  it('is deterministic', () => {
    const b = buildArena().world;
    expect(Array.from(b.mat)).toEqual(Array.from(world.mat));
    expect(b.props.length).toBe(world.props.length);
  });

  it('contains every feature a variant must render', () => {
    const has = (m: number) => world.mat.some((v) => v === m);
    for (const m of [M.SOIL, M.CLAY, M.LIMESTONE, M.SANDSTONE, M.SHALE, M.GRANITE, M.SLATE, M.BASALT,
      M.OBSIDIAN, M.MAGMA_ROCK, M.BEDROCK, M.COAL, M.COPPER, M.IRON, M.SILVER, M.GOLD, M.FROST_CRYSTAL,
      M.AMETHYST, M.MYCELIUM, M.EMBERITE]) expect(has(m), `material ${m}`).toBe(true);
    expect(world.cav.some((c) => c === CAV.DUG)).toBe(true);
    expect(world.cav.some((c) => c === CAV.NATURAL)).toBe(true);
    expect(world.fluidKind.some((f) => f === FLUID.WATER)).toBe(true);
    expect(world.fluidKind.some((f) => f === FLUID.LAVA)).toBe(true);
    const types = new Set(world.props.map((p) => p.type));
    for (const t of [PROP.PINE, PROP.BIRCH, PROP.GRASS, PROP.STALACTITE, PROP.STALAGMITE, PROP.GLOW_SHROOM,
      PROP.GIANT_SHROOM, PROP.CRYSTAL_CLUSTER, PROP.TORCH, PROP.ROOTS]) expect(types.has(t), `prop ${t}`).toBe(true);
    expect(world.mannequins.length).toBeGreaterThanOrEqual(3);
  });

  it('hides the unexplored region', () => {
    for (let y = unexplored.y0; y <= unexplored.y1; y++)
      for (let x = unexplored.x0; x <= unexplored.x1; x++)
        expect(world.flags[world.idx(x, y)]! & TF.EXPLORED).toBe(0);
  });

  it('puts mannequins on solid floors in open tiles', () => {
    for (const m of world.mannequins) {
      const x = Math.floor(m.x);
      const row = -m.y;
      expect(world.isSolid(x, row), `floor under ${m.x},${m.y}`).toBe(true);
      expect(world.isSolid(x, row - 1), `body at ${m.x},${m.y}`).toBe(false);
    }
  });

  it.runIf(!!process.env.ARENA_OUT)('writes a debug map', () => {
    const S = 8;
    const W = world.w * S;
    const H = world.h * S;
    const rgb = Buffer.alloc(W * H * 3);
    const col: Record<number, number> = {
      [M.SOIL]: 0x5b3e2b, [M.CLAY]: 0x9c5a3a, [M.LIMESTONE]: 0xaea38e, [M.SANDSTONE]: 0xb98854,
      [M.SHALE]: 0x63666c, [M.GRANITE]: 0x837a77, [M.SLATE]: 0x48525f, [M.BASALT]: 0x34353c,
      [M.OBSIDIAN]: 0x211832, [M.MAGMA_ROCK]: 0x6b2a16, [M.BEDROCK]: 0x111015, [M.COAL]: 0x111111,
      [M.COPPER]: 0xe07b3c, [M.IRON]: 0xa4523a, [M.SILVER]: 0xeef3ff, [M.GOLD]: 0xffc23d,
      [M.FROST_CRYSTAL]: 0x52d6ff, [M.AMETHYST]: 0xb46cff, [M.MYCELIUM]: 0x45e6c0, [M.EMBERITE]: 0xff8a26,
    };
    for (let y = 0; y < world.h; y++)
      for (let x = 0; x < world.w; x++) {
        const i = world.idx(x, y);
        let c = col[world.mat[i]!] ?? 0xff00ff;
        if (!SOLID[world.mat[i]!]) {
          c = world.cav[i] === CAV.SKY ? 0x9cc8ee : world.cav[i] === CAV.DUG ? 0x3a2a1a : 0x15151a;
          if (world.fluidKind[i] === FLUID.WATER) c = 0x2060c0;
          if (world.fluidKind[i] === FLUID.LAVA) c = 0xff5010;
        }
        if (!(world.flags[i]! & TF.EXPLORED)) c = ((c >> 2) & 0x3f3f3f) + 0x202020;
        for (let sy = 0; sy < S; sy++)
          for (let sx = 0; sx < S; sx++) {
            const o = ((y * S + sy) * W + x * S + sx) * 3;
            rgb[o] = (c >> 16) & 255;
            rgb[o + 1] = (c >> 8) & 255;
            rgb[o + 2] = c & 255;
          }
      }
    for (const p of world.props) {
      const px = Math.round(p.x * S);
      const py = Math.round(-p.y * S);
      const c = p.type === PROP.TORCH ? 0xffaa33 : p.type === PROP.GLOW_SHROOM ? 0x55ffcc : 0xffffff;
      for (let k = -1; k <= 1; k++)
        for (let j = -1; j <= 1; j++) {
          const X = px + k;
          const Y = py + j;
          if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
          const o = (Y * W + X) * 3;
          rgb[o] = (c >> 16) & 255;
          rgb[o + 1] = (c >> 8) & 255;
          rgb[o + 2] = c & 255;
        }
    }
    for (const m of world.mannequins) {
      for (let k = -2; k <= 2; k++)
        for (let j = 0; j < 7; j++) {
          const X = Math.round(m.x * S) + k;
          const Y = Math.round(-m.y * S) - j;
          const o = (Y * W + X) * 3;
          rgb[o] = 255;
          rgb[o + 1] = 40;
          rgb[o + 2] = 200;
        }
    }
    const raw = Buffer.alloc((W * 3 + 1) * H);
    for (let y = 0; y < H; y++) rgb.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
    const crc = (b: Buffer) => {
      let c = ~0;
      for (const v of b) {
        c ^= v;
        for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
      }
      return ~c >>> 0;
    };
    const chunk = (t: string, d: Buffer) => {
      const l = Buffer.alloc(4);
      l.writeUInt32BE(d.length);
      const td = Buffer.concat([Buffer.from(t), d]);
      const c = Buffer.alloc(4);
      c.writeUInt32BE(crc(td));
      return Buffer.concat([l, td, c]);
    };
    const ih = Buffer.alloc(13);
    ih.writeUInt32BE(W, 0);
    ih.writeUInt32BE(H, 4);
    ih[8] = 8;
    ih[9] = 2;
    writeFileSync(process.env.ARENA_OUT!, Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
    ]));
  });
});
