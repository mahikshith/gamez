#!/usr/bin/env python3
"""Slice the approved reference-sheet cells into game sprites (cream bg -> alpha, trim, resize, WebP).
Usage: python3 tools/slice-sprites.py [sheet dir]   (default: $EGG_SHEETS or ./refs/Eggscape-reference-sheets)
Needs S03-hen-chick-fox.png, S05-orbs.png, S09-bosses.png (1254x1254). Writes assets/sprites/<id>.webp."""
import os, sys
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'sprites')
SRC = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('EGG_SHEETS', os.path.join(ROOT, 'refs', 'Eggscape-reference-sheets'))
INSET = 8        # px trimmed off each cell edge (sheet dividers/shadows live there)
TOL = 34         # colour distance from the sheet background counted as background
BOSS_TOL = 18    # bosses have near-cream whites (feathers, clouds): stay tight
TOL_OF = {'win_hen': 9, 'boss_blizzard': 9}  # per-sprite overrides (white art touching the crop edge)
POCKETS = {'boss_snake'}  # enclosed background pockets to clear too (gap inside the coil)
Q = 80

# cell boundaries measured from the sheets (grids are not perfectly even)
S03 = dict(file='S03-hen-chick-fox.png', xs=[3, 314, 627, 940, 1251], ys=[3, 418, 804, 1251])
S05 = dict(file='S05-orbs.png', xs=[3, 318, 622, 928, 1251], ys=[3, 308, 598, 890, 1251])
S09 = dict(file='S09-bosses.png', xs=[3, 315, 627, 939, 1251], ys=[3, 626, 1251])
ORBS = 'fire_red fire_black fire_green fire_gold stone bubble water thunder thorn magnet twin golden hourglass feather rockskin foxcurse'.split()
JOBS = [(S05, 'orb', [(i % 4, i // 4, 'orb_' + n) for i, n in enumerate(ORBS)], 128)]
JOBS += [(S03, 'face', [(0, 0, 'hen_dance'), (1, 0, 'hen_worried'), (2, 0, 'hen_cry'), (3, 0, 'hen_proud'),
                        (0, 2, 'fox_evil'), (1, 2, 'fox_laugh'), (2, 2, 'fox_cry'), (3, 2, 'fox_shock')], 256)]
# boss portraits ship as WHOLE cards (the art runs off the cell edges, so a cut-out looks chopped): the full cell,
# rounded corners, nothing removed. win_hen stays a cut-out (it sits fully inside its cell).
JOBS += [(S09, 'card', [(i % 4, i // 4, n) for i, n in enumerate(
    'boss_fox boss_snake boss_blizzard boss_golem boss_salamander boss_eagle boss_foxking'.split())], 384)]
JOBS += [(S09, 'boss', [(3, 1, 'win_hen')], 384)]
CARD_INSET = 10  # px off each cell edge: drops the grey divider lines
CARD_R = 0.07    # corner radius as a share of the card width


def flood(ok, seeds):
    """4-connected fill over bool array `ok` from seed (y, x) list."""
    h, w = ok.shape
    seen = np.zeros_like(ok)
    dq = deque()
    for y, x in seeds:
        if ok[y, x] and not seen[y, x]:
            seen[y, x] = True; dq.append((y, x))
    while dq:
        y, x = dq.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and ok[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; dq.append((ny, nx))
    return seen


def bg_colour(img):
    """Sheet background: median of the pixels near the most common (quantised) colour."""
    a = np.asarray(img.convert('RGB'))[::3, ::3].reshape(-1, 3).astype(int)
    q = (a // 4) * 4 + 2
    keys, cnt = np.unique(q, axis=0, return_counts=True)
    m = keys[cnt.argmax()]
    return np.median(a[np.abs(a - m).max(1) <= 8], axis=0)


def dist(a, bg):
    return np.sqrt(((a.astype(float) - bg) ** 2).sum(2))


def soft(mask, erode=1, blur=0.8):
    """bool fg mask -> 8-bit alpha, eroded `erode` px (kills the cream fringe) then lightly blurred. Edge-replicated so crop borders stay solid."""
    p = 4
    m = np.pad(mask, p, mode='edge')
    im = Image.fromarray((m * 255).astype(np.uint8))
    for _ in range(erode): im = im.filter(ImageFilter.MinFilter(3))
    im = im.filter(ImageFilter.GaussianBlur(blur))
    return np.asarray(im)[p:-p, p:-p]


def finish(rgb, alpha, size, kind):
    ys, xs = np.where(alpha > 8)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    im = Image.fromarray(np.dstack([rgb, alpha]).astype(np.uint8), 'RGBA').crop((x0, y0, x1, y1))
    w, h = im.size
    k = size / h if kind == 'boss' else size / max(w, h)  # bosses: height; orbs/faces: longest side
    im = im.convert('RGBa').resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS).convert('RGBA')
    return im


def card(sheet, img, cx, cy, size):
    x0, x1 = sheet['xs'][cx] + CARD_INSET, sheet['xs'][cx + 1] - CARD_INSET
    y0, y1 = sheet['ys'][cy] + CARD_INSET, sheet['ys'][cy + 1] - CARD_INSET
    im = img.crop((x0, y0, x1, y1)).convert('RGB')
    w, h = im.size
    k = size / h
    im = im.resize((round(w * k), size), Image.LANCZOS)
    w, h = im.size
    S = 4  # supersampled rounded-corner mask
    m = Image.new('L', (w * S, h * S), 0)
    from PIL import ImageDraw
    ImageDraw.Draw(m).rounded_rectangle((0, 0, w * S - 1, h * S - 1), radius=round(w * CARD_R * S), fill=255)
    im.putalpha(m.resize((w, h), Image.LANCZOS))
    return im


def cut(sheet, img, bg, cx, cy, kind, size, sid):
    if kind == 'card': return card(sheet, img, cx, cy, size)
    x0, x1 = sheet['xs'][cx] + INSET, sheet['xs'][cx + 1] - INSET
    y0, y1 = sheet['ys'][cy] + INSET, sheet['ys'][cy + 1] - INSET
    a = np.asarray(img.crop((x0, y0, x1, y1)).convert('RGB'))
    d = dist(a, bg)
    h, w = d.shape
    if kind == 'orb':
        ys, xs = np.where(d > 20)
        bx0, bx1, by0 = xs.min(), xs.max() + 1, ys.min()  # width/top only: a drop shadow can extend the bottom
        r = (bx1 - bx0) / 2 - 1.5
        ccx, ccy = (bx0 + bx1 - 1) / 2, by0 + (bx1 - bx0) / 2 - 0.5
        yy, xx = np.mgrid[0:h, 0:w]
        alpha = np.clip(r + 0.5 - np.hypot(xx - ccx, yy - ccy), 0, 1) * 255  # 1px soft circular edge
        im = Image.fromarray(np.dstack([a, alpha]).astype(np.uint8), 'RGBA')
        R = r + 2  # square crop around the detected circle, exact size
        return im.crop((round(ccx - R), round(ccy - R), round(ccx + R), round(ccy + R))).convert('RGBa').resize((size, size), Image.LANCZOS).convert('RGBA')
    ok = d < TOL_OF.get(sid, BOSS_TOL if kind == 'boss' else TOL)
    seeds = [(0, x) for x in range(w)] + [(h - 1, x) for x in range(w)] + [(y, 0) for y in range(h)] + [(y, w - 1) for y in range(h)]
    bgm = flood(ok, seeds)
    if sid in POCKETS:
        pk = (d < 10) & ~bgm
        done = np.zeros_like(pk)
        for y, x in zip(*np.where(pk)):
            if not done[y, x]:
                comp = flood(pk, [(y, x)]); done |= comp
                if comp.sum() > 150: bgm |= comp
    return finish(a, soft(~bgm), size, kind)


def main():
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for sheet, kind, cells, size in JOBS:
        p = os.path.join(SRC, sheet['file'])
        if not os.path.exists(p): sys.exit(f'missing {p}')
        img = Image.open(p)
        bg = bg_colour(img)
        for cx, cy, sid in cells:
            im = cut(sheet, img, bg, cx, cy, kind, size, sid)
            f = os.path.join(OUT, sid + '.webp')
            im.save(f, 'WEBP', quality=Q, method=6, alpha_quality=90)
            n = os.path.getsize(f); total += n
            print(f'{sid:18s} {im.size[0]:4d}x{im.size[1]:<4d} {n / 1024:6.1f} KB')
    print(f'total {total / 1024:.1f} KB')


if __name__ == '__main__':
    main()
