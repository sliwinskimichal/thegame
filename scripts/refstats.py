#!/usr/bin/env python3
"""Style metrics of screenshots versus the owner's style reference.

Usage: python3 scripts/refstats.py <image> [<image> ...] [--json out.json]
The owner's reference lives in .reference/owner-style.jpg (git-ignored: it is a
screenshot of another game and must never be committed).

Metrics (image resized to 960 px wide):
  L_mean / L_p05 / L_p50 / L_p95  CIELAB lightness statistics
  chroma_mean                     mean CIELAB chroma (saturation)
  dark_pct                        share of pixels with L* < 15 (crushed blacks)
  edge_pct                        share of pixels with an L* gradient > 18 (drawn detail)
  ink_pct                         dark pixels (L* < 22) on a strong gradient (outline strokes)
Targets for the illustrated direction: docs/team/CHARTER.md section 4.
"""
import json
import sys

import numpy as np
from PIL import Image


def lab(img):
    c = img / 255.0
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = lin @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def stats(path, width=960):
    im = Image.open(path).convert('RGB')
    im = im.resize((width, int(im.height * width / im.width)), Image.LANCZOS)
    L = lab(np.asarray(im).astype(np.float64))
    l = L[..., 0]
    chroma = np.hypot(L[..., 1], L[..., 2])
    gx = np.zeros_like(l)
    gy = np.zeros_like(l)
    gx[:, 1:-1] = l[:, 2:] - l[:, :-2]
    gy[1:-1, :] = l[2:, :] - l[:-2, :]
    g = np.hypot(gx, gy)
    ink = (l < 22) & (g > 18)
    r = lambda v: round(float(v), 2)
    return {
        'L_mean': r(l.mean()), 'L_p05': r(np.percentile(l, 5)), 'L_p50': r(np.percentile(l, 50)),
        'L_p95': r(np.percentile(l, 95)), 'chroma_mean': r(chroma.mean()), 'dark_pct': r((l < 15).mean() * 100),
        'edge_pct': r((g > 18).mean() * 100), 'ink_pct': r(ink.mean() * 100),
    }


TARGET = {'L_mean': (36, 40), 'dark_pct': (15, 22), 'chroma_mean': (13, 18), 'edge_pct': (15, 100), 'ink_pct': (3, 100)}


def score(s):
    """Fraction of illustrated-direction targets met (0..1)."""
    return sum(lo <= s[k] <= hi for k, (lo, hi) in TARGET.items()) / len(TARGET)


if __name__ == '__main__':
    args = sys.argv[1:]
    out = None
    if '--json' in args:
        i = args.index('--json')
        out = args[i + 1]
        args = args[:i] + args[i + 2:]
    res = {p: {**stats(p), 'targets_met': score(stats(p))} for p in args}
    print('| obraz | L* śr | czerń % | chroma | krawędzie % | kreska % | cele |')
    print('|---|---|---|---|---|---|---|')
    for p, s in res.items():
        print(f"| {p} | {s['L_mean']} | {s['dark_pct']} | {s['chroma_mean']} | {s['edge_pct']} | {s['ink_pct']} | {s['targets_met']:.0%} |")
    if out:
        json.dump(res, open(out, 'w'), indent=1)
