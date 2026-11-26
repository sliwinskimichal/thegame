/**
 * scripts/style-report.py on a synthetic tournament: uniform grey (L* ~38) and black
 * screenshots, an incomplete variant and a corrupt PNG. Checks the ranking, the
 * numbers (identical to scripts/refstats.py, which the report imports), the JSON and
 * the error paths. Skipped when python3 with numpy + Pillow is not installed.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../..');
const SCRIPT = join(ROOT, 'scripts/style-report.py');
const hasPython = spawnSync('python3', ['-c', 'import numpy, PIL'], { encoding: 'utf8' }).status === 0;
const py = (args: string[]) => spawnSync('python3', args, { cwd: ROOT, encoding: 'utf8' });

const FIXTURE = `
import os, sys
from PIL import Image
out = sys.argv[1]
def save(v, s, rgb):
    os.makedirs(os.path.join(out, v), exist_ok=True)
    Image.new('RGB', (192, 108), rgb).save(os.path.join(out, v, s + '.png'))
for s in ('cave', 'meadow'):
    save('grey', s, (90, 90, 90))
    save('black', s, (0, 0, 0))
save('partial', 'cave', (90, 90, 90))
save('broken', 'meadow', (90, 90, 90))
open(os.path.join(out, 'broken', 'cave.png'), 'wb').write(b'not a png at all')
open(os.path.join(out, 'sheet_overview.png'), 'wb').write(b'top-level files are not variants')
`;

describe.runIf(hasPython)('style report (scripts/style-report.py)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'style-report-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const run = spawnSync('python3', ['-c', FIXTURE, dir], { encoding: 'utf8' });
  const res = py([SCRIPT, dir, '--detail']);
  const json = () => JSON.parse(readFileSync(join(dir, 'style_metrics.json'), 'utf8'));

  it('prints a table per variant and writes style_metrics.json', () => {
    expect(run.status, run.stderr).toBe(0);
    expect(res.status, res.stderr).toBe(0);
    expect(res.stdout).toContain('Raport stylu:');
    expect(res.stdout).toMatch(/\| # \| wariant \| sceny \| L\* śr \| czerń % \| chroma \| krawędzie % \| kreska % \| cele \| odl\. \| cele\/scena \|/);
    expect(res.stdout).toMatch(/\| grey \| 2\/2 \| 38\.\d ✓ \| 0\.0 ✗ \| 0\.0 ✗ \| 0\.0 ✗ \| 0\.0 ✗ \| 1\/5 \|/);
    expect(res.stdout).toMatch(/\| 4 \| black \| 2\/2 \| 0\.0 ✗ \| 100\.0 ✗ /); // last: no target met
    expect(res.stdout).toContain('| grey | meadow |'); // --detail rows
    expect(existsSync(join(dir, 'style_metrics.json'))).toBe(true);
    expect(Object.keys(json().variants).sort()).toEqual(['black', 'broken', 'grey', 'partial']);
  });

  it('counts targets and distance from refstats.TARGET', () => {
    const v = json().variants;
    expect(v.grey.targets_met).toBe(1);
    expect(v.grey.met).toEqual({ L_mean: true, dark_pct: false, chroma_mean: false, edge_pct: false, ink_pct: false });
    expect(v.black.targets_met).toBe(0);
    expect(v.black.mean.dark_pct).toBe(100);
    // grey misses dark (15/7) + chroma (13/5) + edges (15/15) + ink (3/3)
    expect(v.grey.dist).toBeCloseTo(15 / 7 + 13 / 5 + 1 + 1, 2);
    expect(json().ranking.at(-1)).toBe('black');
  });

  it('reports exactly what scripts/refstats.py measures (imported, not copied)', () => {
    const p = join(dir, 'grey', 'cave.png');
    const ref = py(['-c', `import sys, json; sys.path.insert(0, 'scripts'); import refstats; print(json.dumps(refstats.stats(sys.argv[1])))`, p]);
    expect(ref.status, ref.stderr).toBe(0);
    const { targets_met: _, ...mine } = json().variants.grey.scenarios.cave;
    expect(mine).toEqual(JSON.parse(ref.stdout));
  });

  it('flags incomplete variants and skips corrupt screenshots without failing', () => {
    const j = json();
    expect(j.variants.partial.missing).toEqual(['meadow']);
    expect(res.stderr).toContain('wariant „partial” nie ma scen: meadow');
    expect(j.skipped).toEqual([expect.objectContaining({ path: join(dir, 'broken', 'cave.png') })]);
    expect(res.stderr).toMatch(/pominięto .*broken\/cave\.png \(UnidentifiedImageError/);
    expect(j.variants.broken.scenarios).toHaveProperty('meadow');
  });

  it('writes the JSON elsewhere with --json and fails clearly on bad input', () => {
    const alt = join(dir, 'alt.json');
    expect(py([SCRIPT, dir, '--json', alt, '--sort', 'name']).status).toBe(0);
    expect(JSON.parse(readFileSync(alt, 'utf8')).ranking).toEqual(['black', 'broken', 'grey', 'partial']);
    const missing = py([SCRIPT, join(dir, 'no-such-dir')]);
    expect(missing.status).toBe(2);
    expect(missing.stderr).toContain('nie istnieje');
    const empty = join(dir, 'empty');
    mkdirSync(empty);
    const none = py([SCRIPT, empty]);
    expect(none.status).toBe(1);
    expect(none.stderr).toContain('Nie znaleziono wariantów');
  });
}, 60000);
