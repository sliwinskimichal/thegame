#!/usr/bin/env python3
"""Contact sheets for a tournament run.

Usage: python3 scripts/contact-sheet.py <outDir> [names.json]
Writes:
  <outDir>/sheet_<scenario>.png  - all styles for one scenario (grid, labelled)
  <outDir>/sheet_overview.png    - styles (rows) x scenarios (columns), thumbnails
"""
import json
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont

out = sys.argv[1]
names = json.load(open(sys.argv[2])) if len(sys.argv) > 2 else {}
man = json.load(open(os.path.join(out, 'manifest.json')))
styles = list(man['styles'].keys())
scenarios = man['scenarios']
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 18)
    small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
except OSError:
    font = small = ImageFont.load_default()


def label(img, text, sub=None):
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, img.width, 28 if not sub else 46], fill=(0, 0, 0))
    d.text((8, 4), text, fill=(255, 230, 180), font=font)
    if sub:
        d.text((8, 27), sub, fill=(200, 200, 200), font=small)


# per-scenario sheets
cols = 3
tw, th = 640, 360
for sc in scenarios:
    rows = math.ceil(len(styles) / cols)
    sheet = Image.new('RGB', (cols * tw, rows * th), (20, 20, 20))
    for k, st in enumerate(styles):
        p = os.path.join(out, st, f'{sc}.png')
        if not os.path.exists(p):
            continue
        im = Image.open(p).convert('RGB').resize((tw, th), Image.LANCZOS)
        ms = man['styles'][st]['frameMs'].get(sc, 0)
        label(im, f'{k + 1}. {names.get(st, st)}', f'{ms:.0f} ms/klatka (SwiftShader)')
        sheet.paste(im, ((k % cols) * tw, (k // cols) * th))
    sheet.save(os.path.join(out, f'sheet_{sc}.png'), optimize=True)

# overview: styles x scenarios
tw2, th2 = 320, 180
sheet = Image.new('RGB', (200 + len(scenarios) * tw2, 30 + len(styles) * th2), (20, 20, 20))
d = ImageDraw.Draw(sheet)
for j, sc in enumerate(scenarios):
    d.text((200 + j * tw2 + 6, 6), sc, fill=(255, 230, 180), font=small)
for i, st in enumerate(styles):
    d.text((6, 30 + i * th2 + 70), f'{i + 1}. {names.get(st, st)}'[:24], fill=(255, 255, 255), font=small)
    for j, sc in enumerate(scenarios):
        p = os.path.join(out, st, f'{sc}.png')
        if os.path.exists(p):
            sheet.paste(Image.open(p).convert('RGB').resize((tw2, th2), Image.LANCZOS), (200 + j * tw2, 30 + i * th2))
sheet.save(os.path.join(out, 'sheet_overview.png'), optimize=True)
print('sheets written to', out)
