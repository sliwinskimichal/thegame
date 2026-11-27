// Visual tournament runner: renders every style in every scenario of the lab.
// Usage: node scripts/tournament.mjs <baseUrl> <outDir> [styleIdsCsv] [width] [height] [concurrency]
// Example: node scripts/tournament.mjs http://localhost:5174 /tmp/t1
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const [, , base = 'http://localhost:5174', out = 'tournament-out', only = '', W = '960', H = '540', CONC = '2'] = process.argv;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

// Entries: a JSON file [{id, query}] or a comma-separated list of style ids.
let entries = null;
if (only.endsWith('.json')) entries = JSON.parse(readFileSync(only, 'utf8'));

async function openLab(query) {
  const page = await browser.newPage({ viewport: { width: Number(W), height: Number(H) }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 2000)));
  await page.goto(`${base}/lab.html?hud=0${query ? `&${query}` : ''}`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__lab || !!window.__labError, null, { timeout: 120000 });
  // BUG-001: an unknown style/scenario/world/seed is an error, never a silent fallback
  const labError = await page.evaluate(() => window.__labError ?? null);
  if (labError) throw new Error(`lab refused "${query}": ${labError}`);
  return { page, errors };
}

const probe = await openLab(entries ? entries[0].query : '');
if (!entries) {
  const ids = only ? only.split(',') : await probe.page.evaluate(() => window.__lab.styles);
  entries = ids.map((id) => ({ id, query: `style=${id}` }));
}
const styles = entries.map((e) => e.id);
const queryOf = Object.fromEntries(entries.map((e) => [e.id, e.query]));
const scenarios = await probe.page.evaluate(() => window.__lab.scenarios);
const probes = {};
for (const sc of scenarios) {
  await probe.page.evaluate((id) => window.__lab.setScenario(id, 2), sc);
  probes[sc] = await probe.page.evaluate(() => window.__lab.probes());
}
const layout = await probe.page.evaluate(() => window.__lab.layout);
await probe.page.close();
writeFileSync(`${out}/probes.json`, JSON.stringify(probes));
if (layout) writeFileSync(`${out}/layout.json`, JSON.stringify(layout));

const manifest = { width: Number(W), height: Number(H), scenarios, styles: {} };
async function runStyle(style) {
  const t0 = Date.now();
  const { page, errors } = await openLab(queryOf[style]);
  const info = await page.evaluate(() => ({ id: window.__lab.styleId ?? window.__lab.style }));
  const wanted = new URLSearchParams(queryOf[style]).get('style');
  if (wanted && info.id !== wanted) throw new Error(`entry ${style}: requested style "${wanted}" but the lab rendered "${info.id}"`);
  mkdirSync(`${out}/${style}`, { recursive: true });
  const times = {};
  for (const sc of scenarios) {
    await page.evaluate((id) => window.__lab.setScenario(id, 6), sc);
    const shown = await page.evaluate(() => window.__lab.scenarioId ?? null);
    if (shown !== null && shown !== sc) throw new Error(`entry ${style}: requested scenario "${sc}" but the lab shows "${shown}"`);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}/${style}/${sc}.png` });
    times[sc] = await page.evaluate(() => window.__lab.frameMs);
  }
  await page.close();
  manifest.styles[style] = { id: info.id, frameMs: times, errors: errors.slice(0, 5), seconds: (Date.now() - t0) / 1000 };
  console.log(`${style}: ${((Date.now() - t0) / 1000).toFixed(0)} s${errors.length ? `, ${errors.length} errors: ${errors[0].slice(0, 300)}` : ''}`);
}
const queue = [...styles];
try {
  await Promise.all(
    Array.from({ length: Number(CONC) }, async () => {
      while (queue.length) await runStyle(queue.shift());
    }),
  );
} catch (e) {
  console.error(`tournament aborted: ${e.message}`);
  await browser.close();
  process.exit(1);
}
writeFileSync(`${out}/manifest.json`, JSON.stringify(manifest, null, 2));
await browser.close();
