// Smoke test + screenshots of the data browser (tools.html) in a real browser.
// Usage: node scripts/tools-smoke.mjs [url] [outDir]
//   url    default http://localhost:5174/tools.html (Vite dev server) — also works on a built dist/
//   outDir default /tmp/underhearth-tools
// Checks: page boots without console errors, search finds things, a resource shows sources and uses,
// a building shows 3 levels, a biome and a research node render. Writes PNGs + summary.json; exit 1 on failure.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const [, , url = 'http://localhost:5174/tools.html', out = '/tmp/underhearth-tools'] = process.argv;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text().slice(0, 500)}`));

const checks = [];
const check = (name, ok, info = '') => checks.push({ name, ok: !!ok, info: String(info) });
const shot = async (name) => {
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${out}/${name}.png` });
};
const open = async (hash) => {
  await page.evaluate((h) => (location.hash = h), hash);
  await page.waitForSelector(`.detail[data-key="${hash}"]`, { timeout: 10000 });
};
const texts = (sel) => page.$$eval(sel, (els) => els.map((e) => e.textContent ?? ''));

const t0 = Date.now();
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__tools?.ready, null, { timeout: 60000 });
const info = await page.evaluate(() => ({ ...window.__tools, selected: undefined }));
check('boots', info.entries > 500, `${info.entries} entries, validator ${info.errors} errors / ${info.warnings} warnings, ${Date.now() - t0} ms`);
await shot('01-overview');

await page.fill('.search', 'brąz');
await page.waitForTimeout(200);
const found = await texts('.list li .name');
check('search "brąz"', found.some((t) => t.includes('Sztabka brązu')), `${found.length} results: ${found.slice(0, 5).join(' | ')}`);
await page.fill('.search', 'miedz');
await page.waitForTimeout(200);
const noDiacritics = await texts('.list li .name');
check('search without diacritics ("miedz")', noDiacritics.some((t) => t.includes('miedzi')), `${noDiacritics.length} results`);
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(200);
check('arrow keys select a result', (await page.evaluate(() => location.hash)).length > 1);
await shot('02-search');
await page.fill('.search', '');

await open('resource:bronze_bar');
const secs = await texts('.detail .sec h3');
check('resource: sources and uses', secs.some((t) => t.startsWith('Skąd się bierze')) && secs.some((t) => t.startsWith('Do czego służy')), secs.join(' | '));
await shot('03-resource-bronze');

await open('building:smelter');
const levels = await page.$$eval('.detail .level', (els) => els.length);
check('building: 3 levels', levels === 3, `${levels} level cards`);
await shot('04-building-smelter');

await open('biome:fungal');
const bsecs = await texts('.detail .sec h3');
check('biome: deposits, creatures, research', ['Złoża', 'Stworzenia', 'Badania tej warstwy'].every((s) => bsecs.some((t) => t.startsWith(s))), bsecs.length);
await shot('05-biome-fungal');

await open('tech:gas_masks');
const issues = await page.$$eval('.detail .issues li', (els) => els.length);
check('tech node renders (with validator remarks if any)', true, `${issues} remarks`);
await shot('06-tech-gas-masks');

await page.click('.chip >> text=Przedmioty');
await page.selectOption('select[aria-label="Slot przedmiotu"]', 'weapon');
await page.waitForTimeout(200);
const weapons = await texts('.list li .sub');
check('filters: items + slot weapon', weapons.length > 5 && weapons.every((t) => t.includes('broń')), `${weapons.length} weapons`);
await shot('07-filter-weapons');

await page.setViewportSize({ width: 420, height: 900 });
await open('resource:iron_ore');
await shot('08-narrow');

check('no console errors', errors.length === 0, errors.slice(0, 5).join('\n'));
await browser.close();
const ok = checks.every((c) => c.ok);
writeFileSync(`${out}/summary.json`, JSON.stringify({ url, ok, info, checks, errors }, null, 2));
for (const c of checks) console.log(`${c.ok ? 'OK  ' : 'FAIL'} ${c.name}${c.info ? ` — ${c.info}` : ''}`);
console.log(`${ok ? 'wszystko OK' : 'BŁĘDY'} · zrzuty: ${out}`);
process.exitCode = ok ? 0 : 1;
