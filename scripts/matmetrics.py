#!/usr/bin/env python3
"""Material-tournament metrics on the gallery world.

Usage: python3 scripts/matmetrics.py <outDir>
Per variant (averaged over gallery scenarios):
  rock_min / rock_mean  pairwise CIE76 distance between the mean colours of rock materials
                        (min = the two most confusable rocks; higher is better)
  ore_min               the same among ores and gems
  ore_host              ore tiles vs limestone around them in the mixed swatch
  detail                mean in-swatch std-dev of L* (texture; ~6-14 reads as rich, not noisy)
  bright                mean L* of rock swatches
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
ROCKS = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 21, 22, 24}
# rocks that meet in the world (same biome) + the player's stone wall vs every natural rock
BIOME_SETS = [{1, 2, 3, 4, 5}, {4, 5, 6}, {7, 8, 4}, {4, 6, 8, 21}, {7, 8, 3}, {8, 9, 7}, {9, 10, 11}, {9, 8, 22}]
RELEVANT = set()
for b in BIOME_SETS:
    RELEVANT |= {tuple(sorted(p)) for p in itertools.combinations(b, 2)}
RELEVANT |= {tuple(sorted((24, r))) for r in ROCKS if r != 24}
ORES = {13, 14, 15, 16, 17, 18, 19, 20, 23}


def to_lab(img):
    c = img / 255.0
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = lin @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


rows = {}
for st in man['styles']:
    acc = {k: [] for k in ('rock_min', 'rock_mean', 'adj_min', 'adj_mean', 'ore_min', 'ore_host', 'detail', 'bright')}
    for sc, pts in probes.items():
        p = os.path.join(out, st, f'{sc}.png')
        if not os.path.exists(p):
            continue
        lab = to_lab(np.asarray(Image.open(p).convert('RGB')).astype(np.float64))
        h, w, _ = lab.shape
        by = {}
        for q in pts:
            if q['cat'] != 'solid':
                continue
            x, y = q['x'], q['y']
            by.setdefault(q['mat'], []).append(lab[max(0, y - 2):y + 3, max(0, x - 2):x + 3].reshape(-1, 3).mean(0))
        means = {m: np.mean(v, 0) for m, v in by.items() if len(v) >= 6}
        rk = [m for m in means if m in ROCKS]
        if len(rk) >= 3:
            d = [np.linalg.norm(means[a] - means[b]) for a, b in itertools.combinations(rk, 2)]
            acc['rock_min'].append(min(d))
            acc['rock_mean'].append(float(np.mean(d)))
            acc['detail'].append(float(np.mean([np.std(np.array(by[m])[:, 0]) for m in rk])))
            dadj = [np.linalg.norm(means[a] - means[b]) for a, b in itertools.combinations(rk, 2) if tuple(sorted((a, b))) in RELEVANT]
            if dadj:
                acc['adj_min'].append(min(dadj))
                acc['adj_mean'].append(float(np.mean(dadj)))
            acc['bright'].append(float(np.mean([means[m][0] for m in rk])))
        orr = [m for m in means if m in ORES]
        if len(orr) >= 3:
            acc['ore_min'].append(min(np.linalg.norm(means[a] - means[b]) for a, b in itertools.combinations(orr, 2)))
            if 4 in means:
                acc['ore_host'].append(float(np.mean([np.linalg.norm(means[m] - means[4]) for m in orr])))
    rows[st] = {k: (float(np.mean(v)) if v else None) for k, v in acc.items()}

json.dump(rows, open(os.path.join(out, 'matmetrics.json'), 'w'), indent=2)
f = lambda v: '—' if v is None else f'{v:.1f}'
print('| wariant | adj_min | adj_mean | rock_min | rock_mean | ore_min | ore_host | detail | bright |')
print('|---|---|---|---|---|---|---|---|---|')
for st, r in rows.items():
    print(f"| {st} | {f(r['adj_min'])} | {f(r['adj_mean'])} | {f(r['rock_min'])} | {f(r['rock_mean'])} | {f(r['ore_min'])} | {f(r['ore_host'])} | {f(r['detail'])} | {f(r['bright'])} |")
