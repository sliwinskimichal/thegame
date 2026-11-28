// Dwarf tournament runner (owner: W3 "Technical artist", dwarf team): renders every variant in every shot of
// dwarves.html, measures it and writes the files the sheets and the lead's evaluation read.
// Usage: node scripts/dwarf-tournament.mjs <baseUrl> <outDir> [variantsCsv] [W=960] [H=540] [extraQuery]
//   variantsCsv: comma-separated ids; empty or "all" = every tournament variant (the W3 fixtures only when
//   the model team has none yet); extraQuery is appended to every page URL (e.g. "scale=1.2&light=v1").
// Example: node scripts/dwarf-tournament.mjs http://127.0.0.1:5175 /tmp/dwarf-run d01-karta,d02-toczone,d04-wycinanka
// Writes: <out>/<variant>/<shot>.png, <out>/metrics.json (all metrics), <out>/manifest.json (scripts/contact-sheet.py:
// width, height, scenarios = shots, styles[id].frameMs[shot]) and <out>/names.json.
// A run against the dev server can be disturbed by hot reloads of other agents: freeze it first
// (npx vite build --outDir <dir> && python3 -m http.server <port> --directory <dir>).
// Exit codes: 0 ok, 1 aborted (unknown variant, page error, wrong variant rendered), 2 finished with console errors.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const [, , base = 'http://127.0.0.1:5175', out = 'dwarf-tournament-out', only = '', W = '960', H = '540', extra = ''] = process.argv;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function openStation(variant) {
  const page = await browser.newPage({ viewport: { width: Number(W), height: Number(H) }, deviceScaleFactor: 1 });
  const errors = [];
  const warnings = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error') errors.push(t.slice(0, 2000));
    else if (m.type() === 'warning' && t.includes('[dwarves]')) warnings.push(t.slice(0, 500));
  });
  const q = `hud=0${variant ? `&variant=${encodeURIComponent(variant)}` : ''}${extra ? `&${extra}` : ''}`;
  await page.goto(`${base}/dwarves.html?${q}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__dwarfReady || window.__dwarfError, null, { timeout: 240000 });
  const err = await page.evaluate(() => window.__dwarfError ?? null);
  if (err) throw new Error(`station refused "${q}": ${err}`);
  return { page, errors, warnings };
}

const t00 = Date.now();
const probe = await openStation('');
const info = await probe.page.evaluate(() => ({
  variants: window.__dwarf.variants,
  shots: window.__dwarf.shots,
  names: window.__dwarf.names,
  shotNames: window.__dwarf.shotNames,
  scale: window.__dwarf.scale,
  light: window.__dwarf.light,
  mirror: window.__dwarf.mirror,
}));
await probe.page.close();
const FIXTURES = new Set(['fixture', 'fixture-parts']);
let variants = only && only !== 'all' ? only.split(',').filter(Boolean) : info.variants.filter((v) => !FIXTURES.has(v));
if (variants.length === 0) variants = ['fixture'];
for (const v of variants) if (!info.variants.includes(v)) {
  console.error(`unknown variant "${v}" (known: ${info.variants.join(', ')})`);
  await browser.close();
  process.exit(1);
}

const manifest = { width: Number(W), height: Number(H), scenarios: info.shots, styles: {} };
const metrics = {
  meta: { date: new Date().toISOString(), base, size: [Number(W), Number(H)], scale: info.scale, light: info.light, mirror: info.mirror, extra, renderer: 'Chromium SwiftShader (frame times relative only)' },
  shots: info.shotNames,
  variants: {},
};
let anyErrors = false;
const round = (k, v) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1000) / 1000 : v);

for (const v of variants) {
  const t0 = Date.now();
  let st;
  try {
    st = await openStation(v);
    const shown = await st.page.evaluate(() => window.__dwarf.current);
    if (shown !== v) throw new Error(`requested variant "${v}" but the station rendered "${shown}"`);
    mkdirSync(`${out}/${v}`, { recursive: true });
    const frameMs = {};
    const shots = {};
    const boxes = {};
    for (const s of info.shots) {
      const r = await st.page.evaluate((id) => window.__dwarf.shot(id), s);
      const shownShot = await st.page.evaluate(() => window.__dwarf.shotId);
      if (shownShot !== s) throw new Error(`variant ${v}: requested shot "${s}" but the station shows "${shownShot}"`);
      await st.page.screenshot({ path: `${out}/${v}/${s}.png` });
      frameMs[s] = r.renderMs;
      boxes[s] = r.boxes;
      const m = await st.page.evaluate((id) => window.__dwarf.analyze(id), s);
      if (Object.keys(m).length > 1) shots[s] = m;
    }
    const cost = await st.page.evaluate(() => window.__dwarf.bench(200));
    const anim = await st.page.evaluate(() => window.__dwarf.anim());
    const heights = await st.page.evaluate(() => window.__dwarf.heights());
    const poseErrors = await st.page.evaluate(() => window.__dwarf.poseErrors());
    await st.page.close();
    const seconds = (Date.now() - t0) / 1000;
    anyErrors ||= st.errors.length > 0;
    manifest.styles[v] = { id: v, frameMs, errors: st.errors.slice(0, 5), seconds };
    metrics.variants[v] = { name: info.names[v], seconds, shots, cost, anim, heights, boxes, poseErrors, warnings: st.warnings.slice(0, 20), errors: st.errors.slice(0, 20) };
    console.log(`${v}: ${seconds.toFixed(0)} s, draw calls 200 = ${cost.drawCalls200}, frame 0/200 = ${cost.frameMs0.toFixed(1)}/${cost.frameMs200.toFixed(1)} ms${st.errors.length ? `, ${st.errors.length} console errors: ${st.errors[0].slice(0, 300)}` : ''}${poseErrors.length ? `, ${poseErrors.length} pose errors` : ''}`);
  } catch (e) {
    console.error(`tournament aborted at ${v}: ${e.message}`);
    if (st) console.error(st.errors.slice(0, 5).join('\n'));
    await browser.close();
    process.exit(1);
  }
}
writeFileSync(`${out}/manifest.json`, JSON.stringify(manifest, null, 2));
writeFileSync(`${out}/metrics.json`, JSON.stringify(metrics, round, 1));
writeFileSync(`${out}/names.json`, JSON.stringify(Object.fromEntries(variants.map((v) => [v, info.names[v] ?? v])), null, 2));
await browser.close();
console.log(`done in ${((Date.now() - t00) / 1000).toFixed(0)} s → ${out}`);
process.exit(anyErrors ? 2 : 0);
