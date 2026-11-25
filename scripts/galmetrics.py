#!/usr/bin/env python3
"""Per-biome material readability on the biome gallery (tournament #2).

Usage: python3 scripts/galmetrics.py <outDir> [--json]
Needs probes.json (with tile coords) and layout.json written by tournament.mjs
for the gallery world (lab.html?world=gallery).

For every biome block (scenario g_<biome>) and variant:
  host_min   smallest CIE76 distance between the mean colours of the biome's host rocks
  ore_host   smallest distance between a deposit vein and the host rock around it (same swatch)
  ore_ore    smallest distance between two deposits of the biome
  *_d        the same under simulated deuteranopia (Machado 2009)
Summary columns: worst biome value and mean over biomes. Higher is better.
"""
import itertools
import json
import os
import sys

import numpy as np
from PIL import Image

out = sys.argv[1]
man = json.load(open(os.path.join(out, 'manifest.json')))
probes = json.load(open(os.path.join(out, 'probes.json')))
layout = json.load(open(os.path.join(out, 'layout.json')))
DEUT = np.array([[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]])
SW, SH = 10, 7


def lab_of(lin):
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = lin @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def swatch_of(tx, ty):
    for s in layout:
        if s['x'] <= tx < s['x'] + SW and s['y'] <= ty < s['y'] + SH:
            return s
    return None


def analyse(img_path, pts, biome):
    img = np.asarray(Image.open(img_path).convert('RGB')).astype(np.float64) / 255.0
    lin = np.where(img <= 0.04045, img / 12.92, ((img + 0.055) / 1.055) ** 2.4)
    labs = {'n': lab_of(lin), 'd': lab_of(np.clip(lin @ DEUT.T, 0, 1))}
    h, w, _ = img.shape
    groups = {}  # (swatch index, 'ore'|'host') -> list of (y, x)
    for q in pts:
        if q['cat'] != 'solid':
            continue
        s = swatch_of(q['tx'], q['ty'])
        if not s or s['biome'] != biome:
            continue
        k = layout.index(s)
        role = 'ore' if (s['kind'] == 'deposit' and q['mat'] == s['mat']) else ('host' if q['mat'] == s['host'] else None)
        if role:
            groups.setdefault((k, role), []).append((q['y'], q['x']))
    res = {}
    for mode, lab in labs.items():
        mean = {}
        for key, yx in groups.items():
            if len(yx) < 4:
                continue
            vals = [lab[max(0, y - 2):min(h, y + 3), max(0, x - 2):min(w, x + 3)].reshape(-1, 3).mean(0) for y, x in yx]
            mean[key] = np.mean(vals, 0)
        hosts = [mean[(k, 'host')] for k, s in enumerate(layout) if s['biome'] == biome and s['kind'] == 'rock' and (k, 'host') in mean]
        ores = [(k, mean[(k, 'ore')]) for k, s in enumerate(layout) if s['biome'] == biome and s['kind'] == 'deposit' and (k, 'ore') in mean]
        hm = [float(np.linalg.norm(a - b)) for a, b in itertools.combinations(hosts, 2)]
        oh = [float(np.linalg.norm(o - mean[(k, 'host')])) for k, o in ores if (k, 'host') in mean]
        oo = [float(np.linalg.norm(a[1] - b[1])) for a, b in itertools.combinations(ores, 2)]
        sfx = '' if mode == 'n' else '_d'
        res['host_min' + sfx] = min(hm) if hm else None
        res['ore_host' + sfx] = min(oh) if oh else None
        res['ore_ore' + sfx] = min(oo) if oo else None
        # name the weakest pair for diagnosis
        if mode == 'n' and oh:
            k_worst = [k for k, o in ores if (k, 'host') in mean][int(np.argmin(oh))]
            res['worst_ore'] = layout[k_worst]['mat']
        if mode == 'n' and oo:
            pairs = list(itertools.combinations(ores, 2))
            a, b = pairs[int(np.argmin(oo))]
            res['worst_pair'] = (layout[a[0]]['mat'], layout[b[0]]['mat'])
    return res


rows = {}
biomes = sorted({s['biome'] for s in layout}, key=lambda b: [s['biome'] for s in layout].index(b))
for st in man['styles']:
    per = {}
    for b in biomes:
        sc = f'g_{b}'
        p = os.path.join(out, st, f'{sc}.png')
        if sc in probes and os.path.exists(p):
            per[b] = analyse(p, probes[sc], b)
    rows[st] = per

json.dump(rows, open(os.path.join(out, 'galmetrics.json'), 'w'), indent=2, default=str)
KEYS = ['host_min', 'ore_host', 'ore_ore', 'host_min_d', 'ore_host_d', 'ore_ore_d']


def summary(per, k):
    v = [r[k] for r in per.values() if r.get(k) is not None]
    return (min(v), float(np.mean(v))) if v else (None, None)


print('| wariant | ' + ' | '.join(f'{k} min/śr' for k in KEYS) + ' |')
print('|---|' + '---|' * len(KEYS))
for st, per in rows.items():
    cells = []
    for k in KEYS:
        mn, me = summary(per, k)
        cells.append('—' if mn is None else f'{mn:.1f} / {me:.1f}')
    print(f'| {st} | ' + ' | '.join(cells) + ' |')
if '--detail' in sys.argv:
    for st, per in rows.items():
        print(f'\n{st}')
        for b, r in per.items():
            print(f"  {b:10s} " + ' '.join(f"{k}={r.get(k):.1f}" if isinstance(r.get(k), float) else f"{k}=—" for k in KEYS)
                  + f"  worst_ore={r.get('worst_ore')} worst_pair={r.get('worst_pair')}")
