// Minimal PNG encoder and image helpers for the model preview sheets (W1, Node only).
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]!) & 255]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

export interface Img {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
}

export function writePng(path: string, img: Img): void {
  const { width: w, height: h, rgba } = img;
  const raw = new Uint8Array((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1);
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array(0))];
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  writeFileSync(path, out);
}

/** Nearest-neighbour upscale. */
export function upscale(img: Img, f: number): Img {
  const w = img.width * f;
  const h = img.height * f;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = (((y / f) | 0) * img.width + ((x / f) | 0)) * 4;
      const d = (y * w + x) * 4;
      rgba[d] = img.rgba[s]!;
      rgba[d + 1] = img.rgba[s + 1]!;
      rgba[d + 2] = img.rgba[s + 2]!;
      rgba[d + 3] = 255;
    }
  return { width: w, height: h, rgba };
}

/** Paste images into a grid sheet (rows of equal cell size, light background). */
export function sheet(rows: Img[][], pad = 6): Img {
  const cw = Math.max(...rows.flat().map((i) => i.width));
  const ch = Math.max(...rows.flat().map((i) => i.height));
  const cols = Math.max(...rows.map((r) => r.length));
  const w = cols * (cw + pad) + pad;
  const h = rows.length * (ch + pad) + pad;
  const rgba = new Uint8ClampedArray(w * h * 4).fill(255);
  for (let k = 0; k < w * h; k++) {
    rgba[k * 4] = 120;
    rgba[k * 4 + 1] = 116;
    rgba[k * 4 + 2] = 110;
  }
  rows.forEach((row, ry) =>
    row.forEach((img, cx) => {
      const ox = pad + cx * (cw + pad);
      const oy = pad + ry * (ch + pad);
      for (let y = 0; y < img.height; y++)
        for (let x = 0; x < img.width; x++) {
          const s = (y * img.width + x) * 4;
          const d = ((oy + y) * w + ox + x) * 4;
          rgba[d] = img.rgba[s]!;
          rgba[d + 1] = img.rgba[s + 1]!;
          rgba[d + 2] = img.rgba[s + 2]!;
        }
    }),
  );
  return { width: w, height: h, rgba };
}
