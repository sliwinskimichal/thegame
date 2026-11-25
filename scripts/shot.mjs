// Screenshot helper for visual checks.
// Usage: node scripts/shot.mjs <url> <out.png> [waitMs] [width] [height]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const [, , url, out, waitMs = '2500', w = '1280', h = '720'] = process.argv;
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(Number(waitMs));
await page.screenshot({ path: out });
const info = await page.evaluate(() => {
  const g = window.__game;
  if (!g) return null;
  return {
    frameMs: g.gr?.frameMs,
    light: g.lightField?.lastMs,
    calls: g.gr?.renderer.info.render.calls,
    tris: g.gr?.renderer.info.render.triangles,
  };
});
console.log(JSON.stringify(info));
const seen = new Set();
const uniq = logs.filter((l) => (seen.has(l) ? false : (seen.add(l), true)));
const errs = uniq.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
for (const l of errs.slice(0, 10)) console.log(l.slice(0, 6000));
for (const l of uniq.filter((l) => !errs.includes(l)).slice(0, 15)) console.log(l.slice(0, 400));
await browser.close();
