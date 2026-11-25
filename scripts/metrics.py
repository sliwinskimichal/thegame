#!/usr/bin/env python3
"""Automated readability metrics for a tournament run.

Usage: python3 scripts/metrics.py <outDir>  -> prints a markdown table, writes metrics.json

Metrics (per style, averaged over scenarios where the categories are visible):
  C_open    Michelson contrast of luminance: solid rock vs open tunnels/caves (higher = clearer section)
  C_fog     contrast: unexplored vs explored rock (higher = fog of war reads)
  dE_ore    mean CIE76 colour distance ore vs surrounding host rock (higher = ores pop)
  dE_deut   the same under simulated deuteranopia (Machado 2009, severity 1.0)
  dark%     share of pixels darker than L* 6 (crushed blacks)
  ms        mean frame time in the lab (SwiftShader, relative only)
"""
import json
import os
import sys

import numpy as np
from PIL import Image

out = sys.argv[1]
man = json.load(open(os.path.join(out, 'manifest.json')))
probes = json.load(open(os.path.join(out, 'probes.json')))
ORES = {13, 14, 15, 16, 17, 18, 19, 20, 23}
DEUT = np.array([[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]])


def srgb_to_lin(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_lab(rgb):
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = rgb @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    L = 116 * f[..., 1] - 16
    a = 500 * (f[..., 0] - f[..., 1])
    b = 200 * (f[..., 1] - f[..., 2])
    return np.stack([L, a, b], -1)


def sample(img, pts, r=2):
    h, w, _ = img.shape
    vals = []
    for p in pts:
        x0, x1 = max(0, p['x'] - r), min(w, p['x'] + r + 1)
        y0, y1 = max(0, p['y'] - r), min(h, p['y'] + r + 1)
        vals.append(img[y0:y1, x0:x1].reshape(-1, 3).mean(0))
    return np.array(vals) if vals else np.zeros((0, 3))


rows = {}
for st in man['styles']:
    acc = {'C_open': [], 'C_fog': [], 'dE_ore': [], 'dE_deut': [], 'dark': []}
    for sc, pts in probes.items():
        p = os.path.join(out, st, f'{sc}.png')
        if not os.path.exists(p):
            continue
        img = np.asarray(Image.open(p).convert('RGB')).astype(np.float64)
        lin = srgb_to_lin(img)
        lab = lin_to_lab(lin)
        deut_lab = lin_to_lab(np.clip(lin @ DEUT.T, 0, 1))
        acc['dark'].append(float((lab[..., 0] < 6).mean()))
        by = {}
        for q in pts:
            by.setdefault(q['cat'], []).append(q)

        def meanL(cat):
            if cat not in by or len(by[cat]) < 8:
                return None
            return float(sample(lab, by[cat])[:, 0].mean())

        ls = meanL('solid')
        lo = [v for v in (meanL('dug'), meanL('cave')) if v is not None]
        if ls is not None and lo:
            o = float(np.mean(lo))
            acc['C_open'].append(abs(ls - o) / (ls + o + 5))
        lu = meanL('unexplored')
        if ls is not None and lu is not None:
            acc['C_fog'].append(abs(ls - lu) / (ls + lu + 5))
        ores = [q for q in by.get('solid', []) if q['mat'] in ORES]
        host = [q for q in by.get('solid', []) if q['mat'] not in ORES]
        if len(ores) >= 6 and len(host) >= 6:
            hp = np.array([[q['x'], q['y']] for q in host])
            d1, d2 = [], []
            for q in ores[:200]:
                k = np.argsort(((hp - [q['x'], q['y']]) ** 2).sum(1))[:4]
                near = [host[i] for i in k]
                a = sample(lab, [q])[0]
                b = sample(lab, near).mean(0)
                d1.append(np.linalg.norm(a - b))
                a2 = sample(deut_lab, [q])[0]
                b2 = sample(deut_lab, near).mean(0)
                d2.append(np.linalg.norm(a2 - b2))
            acc['dE_ore'].append(float(np.mean(d1)))
            acc['dE_deut'].append(float(np.mean(d2)))
    ms = man['styles'][st]['frameMs']
    rows[st] = {k: (float(np.mean(v)) if v else None) for k, v in acc.items()}
    rows[st]['ms'] = float(np.mean(list(ms.values()))) if ms else None

json.dump(rows, open(os.path.join(out, 'metrics.json'), 'w'), indent=2)
fmt = lambda v, f='{:.3f}': '—' if v is None else f.format(v)
print('| styl | C_open | C_fog | dE_ore | dE_deut | dark% | ms |')
print('|---|---|---|---|---|---|---|')
for st, r in rows.items():
    print(f"| {st} | {fmt(r['C_open'])} | {fmt(r['C_fog'])} | {fmt(r['dE_ore'], '{:.1f}')} | {fmt(r['dE_deut'], '{:.1f}')} | {fmt(r['dark'] * 100 if r['dark'] is not None else None, '{:.1f}')} | {fmt(r['ms'], '{:.0f}')} |")
