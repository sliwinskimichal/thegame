// QA smoke audit of the visual lab (not a Vitest file - run it with node).
//
// Renders every style x scenario of the arena, and the material gallery with and
// without work light (&flood=1), and collects per shot:
//   - console errors/warnings (WebGL and shader warnings included), page errors,
//     failed requests,
//   - style/scenario fallback (requested id vs id actually rendered),
//   - frame time: the lab's own EMA (window.__lab.frameMs, CPU submit time) and
//     the median requestAnimationFrame interval (closer to real cost in SwiftShader),
//   - pixel statistics of the WebGL canvas: share of near-black pixels (L* < 6,
//     same threshold as scripts/metrics.py "dark%"), share of pure-black pixels
//     (max channel <= 8), mean / std of L*, magenta share (missing-texture tell),
//     number of distinct 15-bit colours (blank frame tell).
//
// Usage:
//   node tests/qa/lab-audit.mjs [baseUrl] [outDir] [arenaStyles|all] [galleryStyles|all|none] [W] [H] [concurrency]
//   e.g. node tests/qa/lab-audit.mjs http://localhost:5174 /tmp/underhearth-qa/lab-audit all s01-diorama,r2b-silhouette-plus
// Env: SHOTS=0 disables screenshots (default: on).
//      PAGE=<path> page to drive instead of lab.html (e.g. tests/qa/harness/ill-lab.html for the
//      illustrated styles that are not registered in the lab yet).
//      STABILITY=1 also measures "lines still at rest" (docs/team/vision/VISION.md section 3): two
//      captures 1 s apart; share of changed pixels overall and among ink pixels (L* < 22 in the
//      first capture). Animated fluids, sky and wind legitimately change some pixels.
// Output: <outDir>/audit.json, <outDir>/audit.md and screenshots <outDir>/<mode>/<style>/<scenario>.png
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const [, , BASE = 'http://localhost:5174', OUT = '/tmp/underhearth-qa/lab-audit', ARENA = 'all', GALLERY = 's01-diorama,r2b-silhouette-plus', W = '960', H = '540', CONC = '2'] = process.argv;
const SHOTS = process.env.SHOTS !== '0';
const PAGE = process.env.PAGE ?? 'lab.html';
const STABILITY = process.env.STABILITY === '1';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

/** Open a lab page; returns the page and the log sink. */
async function open(query, timeout = 90000) {
  const page = await browser.newPage({ viewport: { width: Number(W), height: Number(H) }, deviceScaleFactor: 1 });
  const log = { errors: [], warnings: [], pageErrors: [], failed: [] };
  page.on('console', (m) => {
    const t = m.text().slice(0, 1500);
    if (m.type() === 'error') log.errors.push(t);
    else if (m.type() === 'warning') log.warnings.push(t);
  });
  page.on('pageerror', (e) => log.pageErrors.push(String(e.message).slice(0, 1500)));
  page.on('requestfailed', (r) => log.failed.push(`${r.url()} ${r.failure()?.errorText ?? ''}`));
  const t0 = Date.now();
  let ready = true;
  try {
    await page.goto(`${BASE}/${PAGE}?hud=0${query ? `&${query}` : ''}`, { waitUntil: 'load', timeout });
    await page.waitForFunction(() => !!window.__lab, null, { timeout });
  } catch (e) {
    ready = false;
    log.pageErrors.push(`not ready: ${String(e.message).split('\n')[0]}`);
  }
  return { page, log, ready, loadMs: Date.now() - t0 };
}

/** Pixel statistics of the WebGL canvas (preserveDrawingBuffer is on in the lab). */
function canvasStats() {
  const c = document.getElementById('c');
  const off = document.createElement('canvas');
  off.width = c.width;
  off.height = c.height;
  const g = off.getContext('2d', { willReadFrequently: true });
  g.drawImage(c, 0, 0);
  const d = g.getImageData(0, 0, off.width, off.height).data;
  const lut = new Float64Array(256);
  for (let v = 0; v < 256; v++) {
    const s = v / 255;
    lut[v] = s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }
  const n = off.width * off.height;
  let dark = 0, black = 0, magenta = 0, sum = 0, sum2 = 0;
  const colours = new Set();
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gg = d[i + 1], b = d[i + 2];
    const Y = 0.2126 * lut[r] + 0.7152 * lut[gg] + 0.0722 * lut[b];
    const L = Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y;
    if (L < 6) dark++;
    if (Math.max(r, gg, b) <= 8) black++;
    if (r > 200 && gg < 60 && b > 200) magenta++;
    sum += L;
    sum2 += L * L;
    if (colours.size < 5000) colours.add(((r >> 3) << 10) | ((gg >> 3) << 5) | (b >> 3));
  }
  const mean = sum / n;
  return { w: off.width, h: off.height, darkPct: (100 * dark) / n, blackPct: (100 * black) / n, magentaPct: (100 * magenta) / n, meanL: mean, stdL: Math.sqrt(Math.max(0, sum2 / n - mean * mean)), colours: colours.size };
}

/** Keep a copy of the canvas (first call) or compare the canvas with the kept copy (second call). */
function canvasDiff(keep) {
  const c = document.getElementById('c');
  const off = document.createElement('canvas');
  off.width = c.width;
  off.height = c.height;
  const g = off.getContext('2d', { willReadFrequently: true });
  g.drawImage(c, 0, 0);
  const d = g.getImageData(0, 0, off.width, off.height).data;
  if (keep) {
    window.__qaPrev = d;
    return null;
  }
  const a = window.__qaPrev;
  const L = (r, gg, b) => {
    const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const Y = 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
    return Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y;
  };
  let changed = 0, ink = 0, inkChanged = 0;
  for (let i = 0; i < d.length; i += 4) {
    const diff = Math.max(Math.abs(d[i] - a[i]), Math.abs(d[i + 1] - a[i + 1]), Math.abs(d[i + 2] - a[i + 2]));
    const isInk = L(a[i], a[i + 1], a[i + 2]) < 22;
    if (diff > 24) changed++;
    if (isInk) {
      ink++;
      if (diff > 24) inkChanged++;
    }
  }
  const n = d.length / 4;
  return { changedPct: (100 * changed) / n, inkPct: (100 * ink) / n, inkChangedPct: ink ? (100 * inkChanged) / ink : 0 };
}

async function rafMedian(page, frames = 10) {
  return page.evaluate(async (k) => {
    const t = [];
    let last = performance.now();
    for (let i = 0; i < k; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      const now = performance.now();
      t.push(now - last);
      last = now;
    }
    t.sort((a, b) => a - b);
    return { p50: t[Math.floor(k / 2)], max: t[k - 1] };
  }, frames);
}

const results = [];
async function runJob(job) {
  const { mode, style } = job;
  const query = [`style=${style}`, mode !== 'arena' ? 'world=gallery' : '', mode === 'gallery-flood' ? 'flood=1' : ''].filter(Boolean).join('&');
  let o = await open(query);
  if (!o.ready) {
    // one retry: another agent may be editing the style registry right now
    await o.page.close();
    o = await open(query);
  }
  const { page, log, ready, loadMs } = o;
  const rec = { mode, style, query, ready, loadMs, renderedStyle: null, shots: [], log };
  if (ready) {
    rec.renderedStyle = await page.evaluate(() => window.__lab.style);
    const scenarios = await page.evaluate(() => window.__lab.scenarios);
    if (SHOTS) mkdirSync(`${OUT}/${mode}/${style}`, { recursive: true });
    for (const sc of scenarios) {
      const t0 = Date.now();
      try {
        await page.evaluate((id) => window.__lab.setScenario(id, 6), sc);
        await page.waitForTimeout(250);
        const stats = await page.evaluate(canvasStats);
        const raf = await rafMedian(page, 8);
        const frameMs = await page.evaluate(() => window.__lab.frameMs);
        if (SHOTS) await page.screenshot({ path: `${OUT}/${mode}/${style}/${sc}.png` });
        let stability = null;
        if (STABILITY) {
          await page.evaluate(canvasDiff, true);
          await page.waitForTimeout(1000);
          await rafMedian(page, 2);
          stability = await page.evaluate(canvasDiff, false);
        }
        rec.shots.push({ scenario: sc, frameMs, rafP50: raf.p50, rafMax: raf.max, ...stats, ...(stability ?? {}), ms: Date.now() - t0 });
      } catch (e) {
        rec.shots.push({ scenario: sc, error: String(e.message).split('\n')[0] });
      }
    }
  }
  await page.close();
  results.push(rec);
  const worstDark = Math.max(0, ...rec.shots.map((s) => s.darkPct ?? 0));
  console.log(`${mode}/${style}: ready=${ready} rendered=${rec.renderedStyle} shots=${rec.shots.length} errors=${log.errors.length + log.pageErrors.length} warnings=${log.warnings.length} worstDark=${worstDark.toFixed(1)}%`);
}

// discover styles from the lab itself (registry may change while another agent works)
const probe = await open('');
const allStyles = probe.ready ? await probe.page.evaluate(() => window.__lab.styles) : [];
await probe.page.close();
const pick = (spec) => (spec === 'all' ? allStyles : spec === 'none' ? [] : spec.split(','));
const jobs = [
  ...pick(ARENA).map((style) => ({ mode: 'arena', style })),
  ...pick(GALLERY).flatMap((style) => [{ mode: 'gallery', style }, { mode: 'gallery-flood', style }]),
];
// negative probes: unknown ids must not silently render something else
jobs.push({ mode: 'arena', style: '__no_such_style__' });

const queue = [...jobs];
await Promise.all(Array.from({ length: Number(CONC) }, async () => {
  while (queue.length) await runJob(queue.shift());
}));
await browser.close();

results.sort((a, b) => (a.mode + a.style).localeCompare(b.mode + b.style));
writeFileSync(`${OUT}/audit.json`, JSON.stringify({ base: BASE, width: Number(W), height: Number(H), styles: allStyles, results }, null, 2));

const f1 = (v) => (typeof v === 'number' ? v.toFixed(1) : '—');
const stab = STABILITY ? ' maks. zmiana pikseli kreski w 1 s % |' : '';
const md = [`| tryb | styl | gotowy | wyrenderowany styl | błędy | ostrz. | maks. czerń L*<6 % | min. średnia L* | maks. ms (lab) | maks. rAF p50 ms |${stab}`, `|---|---|---|---|---|---|---|---|---|---|${STABILITY ? '---|' : ''}`];
for (const r of results) {
  const s = r.shots.filter((x) => !x.error);
  const st = STABILITY ? ` ${f1(Math.max(...s.map((x) => x.inkChangedPct ?? 0)))} |` : '';
  md.push(`| ${r.mode} | ${r.style} | ${r.ready ? 'tak' : '**NIE**'} | ${r.renderedStyle ?? '—'}${r.renderedStyle && r.renderedStyle !== r.style ? ' **(fallback)**' : ''} | ${r.log.errors.length + r.log.pageErrors.length} | ${r.log.warnings.length} | ${f1(Math.max(...s.map((x) => x.darkPct)))} | ${f1(Math.min(...s.map((x) => x.meanL)))} | ${f1(Math.max(...s.map((x) => x.frameMs)))} | ${f1(Math.max(...s.map((x) => x.rafP50)))} |${st}`);
}
writeFileSync(`${OUT}/audit.md`, md.join('\n') + '\n');
console.log(md.join('\n'));
