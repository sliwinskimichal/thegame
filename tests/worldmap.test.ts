/**
 * Dev tool: renders the generated world to a PNG so worldgen changes can be
 * eyeballed without the 3D client. Runs only when WORLDMAP_OUT is set:
 *   WORLDMAP_OUT=/tmp/map.png npx vitest run tests/worldmap.test.ts
 */
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { describe, it } from 'vitest';
import { MATERIALS } from '../src/world/materials';
import { FL, TF } from '../src/world/world';
import { generateWorld } from '../src/world/worldgen';

function crc32(buf: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]!;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function png(w: number, h: number, rgb: Uint8Array): Buffer {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    Buffer.from(rgb.buffer, y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1);
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

describe.runIf(!!process.env.WORLDMAP_OUT)('worldmap', () => {
  it('writes png', () => {
    const seed = Number(process.env.WORLDMAP_SEED ?? 12345);
    const { world: w, ms } = generateWorld({ seed });
    const S = 2;
    const rgb = new Uint8Array(w.w * S * w.h * S * 3);
    for (let y = 0; y < w.h; y++)
      for (let x = 0; x < w.w; x++) {
        const i = w.idx(x, y);
        let c: number;
        if (w.fluid[i]) c = w.fluidType[i] === FL.LAVA ? 0xff5010 : 0x2060c0;
        else if (w.flags[i]! & TF.OUTDOOR) c = 0x9cc8ee;
        else if (w.mat[i] === 0) c = 0x101014;
        else {
          const d = MATERIALS[w.mat[i]!]!;
          c = d.ore ? d.accent : d.colorB;
        }
        for (let sy = 0; sy < S; sy++)
          for (let sx = 0; sx < S; sx++) {
            const o = ((y * S + sy) * w.w * S + x * S + sx) * 3;
            rgb[o] = (c >> 16) & 255;
            rgb[o + 1] = (c >> 8) & 255;
            rgb[o + 2] = c & 255;
          }
      }
    writeFileSync(process.env.WORLDMAP_OUT!, png(w.w * S, w.h * S, rgb));
    console.log(`world ${w.w}x${w.h} in ${ms.toFixed(0)} ms, decor ${w.decor.length}`);
    // per-layer cave coverage and ore stats
    const rows: string[] = [];
    for (let k = 0; k < 7; k++) {
      let tot = 0, cave = 0;
      const ores = new Map<number, number>();
      for (let y = 0; y < w.h; y++) {
        if (w.layerOfRow[y] !== k) continue;
        for (let x = 0; x < w.w; x++) {
          const i = w.idx(x, y);
          if (w.flags[i]! & TF.OUTDOOR) continue;
          tot++;
          if (w.flags[i]! & TF.NATURAL) cave++;
          const d = MATERIALS[w.mat[i]!]!;
          if (d.ore) ores.set(d.id, (ores.get(d.id) ?? 0) + 1);
        }
      }
      rows.push(`L${k}: cave ${(100 * cave / tot).toFixed(1)}% ores ` + [...ores].map(([m, n]) => `${MATERIALS[m]!.key}=${n}`).join(' '));
    }
    console.log(rows.join('\n'));
  });
});
