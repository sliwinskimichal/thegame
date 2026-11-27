#!/usr/bin/env python3
"""Large comparison sheet for the owner: a few finalists (rows) x a few scenes (columns).

The contact sheets of a tournament show every variant in small thumbnails; this sheet shows
only the finalists, big enough to judge the style by eye.

Usage:
  python3 scripts/owner-sheet.py <render_dir> <out.jpg> \
      --rows "R2B=R2B|kontrola" "i10=i10 Hybryda" \
      --cols "overview=przegląd" "tunnel_night=tunel nocą"
  <render_dir>/<row_id>/<col_id>.png must exist; "|" in a label starts a new line.
"""
import argparse

from PIL import Image, ImageDraw, ImageFont


def pairs(items):
    out = []
    for item in items:
        key, _, label = item.partition('=')
        out.append((key, label or key))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('render_dir')
    ap.add_argument('out')
    ap.add_argument('--rows', nargs='+', required=True)
    ap.add_argument('--cols', nargs='+', required=True)
    ap.add_argument('--cell', default='560x315', help='cell size WxH')
    args = ap.parse_args()
    rows, cols = pairs(args.rows), pairs(args.cols)
    w, h = (int(v) for v in args.cell.split('x'))
    label_w, title_h = 200, 30
    sheet = Image.new('RGB', (label_w + w * len(cols), title_h + h * len(rows)), (18, 16, 14))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 17)
    except OSError:
        font = ImageFont.load_default()
    for j, (_, label) in enumerate(cols):
        draw.text((label_w + j * w + 8, 6), label, fill=(235, 210, 160), font=font)
    for i, (row, label) in enumerate(rows):
        y = title_h + i * h
        for k, line in enumerate(label.split('|')):
            draw.text((8, y + 8 + k * 22), line, fill=(235, 225, 210), font=font)
        for j, (col, _) in enumerate(cols):
            cell = Image.open(f'{args.render_dir}/{row}/{col}.png').convert('RGB')
            sheet.paste(cell.resize((w, h), Image.LANCZOS), (label_w + j * w, y))
    sheet.save(args.out, quality=86)
    print(args.out, sheet.size)


if __name__ == '__main__':
    main()
