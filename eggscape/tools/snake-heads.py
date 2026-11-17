#!/usr/bin/env python3
"""Snake head sheet for Eggscape, cut from the Breaker serpent's painted heads.

Source: the Breaker repo, `git show origin/mooncoil:art/snake-emerald/source/heads-v1.png` (1024x1536, ten
right-facing heads in 2 columns x 5 rows: idle blink / taste hunt / chew0 chew1 / hiss ouch / dizzy grin).

Writes assets/ref/snake-heads.webp (one row of ten 432x284 cells at source scale, right-facing; the game mirrors
for left) and assets/ref/snake-heads-mask.webp (lossless; red = part: 0 keep (eyes, mouth, teeth), 80 scales,
160 belly, 240 brows and lids) so the game can recolour scales, belly and brows per skin. Every cell is aligned
on the same anchor, so expressions crossfade without the head jumping.

    python3 -I tools/snake-heads.py heads-v1.png
Prints the reference lightness of each part and the dizzy cell's eye positions (for characters.js).
"""
import sys, os
from collections import deque
import numpy as np
from PIL import Image

ROWS = [0, 302, 602, 897, 1205, 1536]
CENTRES = [(285, 154), (790, 154), (285, 448), (790, 448), (285, 744), (790, 744), (285, 1043), (790, 1043), (285, 1341), (790, 1341)]
NAMES = ['idle', 'blink', 'taste', 'hunt', 'chew0', 'chew1', 'hiss', 'ouch', 'dizzy', 'grin']
X0, X1, Y0, Y1 = -208, 224, -136, 148  # cell window around each centre
CW, CH = X1 - X0, Y1 - Y0


def hsl(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = np.maximum(np.maximum(r, g), b), np.minimum(np.minimum(r, g), b)
    l, d = (mx + mn) / 2, mx - mn
    s = np.where(d > 1e-6, d / (1 - np.abs(2 * l - 1) + 1e-6), 0)
    h = np.where(mx == r, ((g - b) / (d + 1e-9)) % 6, np.where(mx == g, (b - r) / (d + 1e-9) + 2, (r - g) / (d + 1e-9) + 4)) * 60
    return h % 360, np.clip(s, 0, 1), l


def blobs(mask):
    """8-connected components: list of arrays of (y, x)."""
    seen = np.zeros_like(mask, bool)
    out = []
    H, W = mask.shape
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]:
            continue
        q, pts = deque([(y0, x0)]), []
        seen[y0, x0] = True
        while q:
            y, x = q.popleft()
            pts.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < H and 0 <= xx < W and mask[yy, xx] and not seen[yy, xx]:
                        seen[yy, xx] = True
                        q.append((yy, xx))
        out.append(np.array(pts))
    return out


def main(src, outdir):
    im = np.array(Image.open(src).convert('RGBA')).astype(np.float64) / 255
    sheet = np.zeros((CH, CW * len(NAMES), 4))
    cls = np.zeros((CH, CW * len(NAMES)), np.uint8)
    lrefs = {1: [], 2: [], 3: []}
    idle_eye = None
    for k, (cx, cy) in enumerate(CENTRES):
        a = np.zeros((CH, CW, 4))
        sy0, sx0 = cy + Y0, cx + X0
        ya, xa = max(0, sy0), max(0, sx0)
        yb, xb = min(im.shape[0], cy + Y1), min(im.shape[1], cx + X1)
        a[ya - sy0:yb - sy0, xa - sx0:xb - sx0] = im[ya:yb, xa:xb]
        # keep only this head: the half-cell it was painted in
        hx0, hx1 = (0, 512) if cx < 512 else (512, 1024)
        r = next(i for i in range(5) if ROWS[i] <= cy < ROWS[i + 1])
        yy, xx = np.mgrid[sy0:sy0 + CH, sx0:sx0 + CW]
        a[(xx < hx0) | (xx >= hx1) | (yy < ROWS[r]) | (yy >= ROWS[r + 1])] = 0
        al = a[..., 3]
        al[al < 8 / 255] = 0
        a[al == 0] = 0
        h, s, l = hsl(a)
        solid = al > 0.6
        # eyes: lime irises and the whites around them (never recoloured)
        Y, X = np.mgrid[0:CH, 0:CW]
        iris = solid & (h >= 50) & (h < 95) & (s > 0.4) & (Y < -Y0 + 15)
        ib = sorted(blobs(iris), key=len, reverse=True)
        eyes = []
        for b in ib[:2]:
            if len(b) < 60 or b[:, 0].mean() > -Y0 + 5:
                continue
            ey, ex = b[:, 0].mean(), b[:, 1].mean()
            eyes.append((ex, ey))
        white = solid & (l > 0.68) & ((s < 0.12) | ((h >= 25) & (h < 85) & (s < 0.45)))
        eye = np.zeros_like(solid)
        near = np.zeros_like(solid)
        for ex, ey in eyes:
            near |= np.hypot(X - ex, Y - ey) < 62
        for wb in blobs((white | iris) & near):
            if len(wb) < 40:
                continue
            my, mx_ = wb[:, 0].mean(), wb[:, 1].mean()
            if not eyes or min(np.hypot(mx_ - ex, my - ey) for ex, ey in eyes) > 70:
                continue
            ry = (wb[:, 0].max() - wb[:, 0].min()) / 2 + 3
            rx = (wb[:, 1].max() - wb[:, 1].min()) / 2 + 3
            cy_, cx_ = (wb[:, 0].max() + wb[:, 0].min()) / 2, (wb[:, 1].max() + wb[:, 1].min()) / 2
            eye |= ((X - cx_) / rx) ** 2 + ((Y - cy_) / ry) ** 2 <= 1
            if NAMES[k] in ('idle', 'dizzy'):
                print(f'{NAMES[k]} eye blob centre ({cx_ + X0:.0f},{cy_ + Y0:.0f}) r ({rx:.0f},{ry:.0f}) [rel. centre]')
        if NAMES[k] == 'idle':
            idle_eye = eyes[0] if eyes else (-X0, -Y0)
        eye_y = idle_eye[1]  # the near eye sits at the same place in every cell
        c = np.zeros((CH, CW), np.uint8)
        vis = al > 0
        teal = vis & (h >= 140) & (h < 215)
        dark = vis & (l < 0.2) & ~((h >= 300) | (h < 40))
        c[(teal | dark) & ~eye] = 1
        belly = vis & (h >= 82) & (h < 160) & (s < 0.6) & (l > 0.3) & ~teal
        c[belly & ~eye] = 2
        pink = vis & ((h >= 300) | (h < 32)) & (s > 0.2) & (l > 0.25)
        for b in blobs(pink):
            if b[:, 0].mean() < eye_y + 18:
                c[b[:, 0], b[:, 1]] = 3
        # soft edges take the part of their nearest solid neighbour
        part = c.copy()
        for _ in range(4):
            unk = vis & (part == 0) & ~eye
            if not unk.any():
                break
            for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                nb = np.roll(np.roll(part, dy, 0), dx, 1)
                take = unk & (nb > 0) & (al < 0.6) & (part == 0)
                part[take] = nb[take]
        # pale cyan and mint glints between scales and belly join whichever part surrounds them
        glint = vis & (part == 0) & ~eye & (h >= 80) & (h < 230) & (s < 0.5) & (l > 0.45)
        for _ in range(12):
            if not glint.any():
                break
            for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                nb = np.roll(np.roll(part, dy, 0), dx, 1)
                take = glint & (nb > 0) & (nb < 3) & (part == 0)
                part[take] = nb[take]
            glint &= part == 0
        for p in (1, 2, 3):
            m = solid & (part == p)
            if m.any():
                lrefs[p].append(l[m])
        sheet[:, k * CW:(k + 1) * CW] = a
        cls[:, k * CW:(k + 1) * CW] = part
    for p, v in lrefs.items():
        v = np.concatenate(v)
        print('part', p, 'lightness median %.3f  p90 %.3f' % (np.median(v), np.percentile(v, 90)))
    rgba = (sheet * 255 + 0.5).astype(np.uint8)
    os.makedirs(outdir, exist_ok=True)
    Image.fromarray(rgba, 'RGBA').save(os.path.join(outdir, 'snake-heads.webp'), quality=86, method=6, alpha_quality=90)
    Image.fromarray(cls * 80, 'L').save(os.path.join(outdir, 'snake-heads-mask.webp'), lossless=True, method=6)
    vis = np.zeros((CH, CW * len(NAMES), 3), np.uint8) + 255
    pal = np.array([[255, 255, 255], [40, 120, 200], [250, 190, 120], [230, 40, 160]], np.uint8)
    vis[rgba[..., 3] > 0] = pal[cls[rgba[..., 3] > 0]]
    vis[(rgba[..., 3] > 0) & (cls == 0)] = rgba[..., :3][(rgba[..., 3] > 0) & (cls == 0)]
    Image.fromarray(vis).save(os.path.join(os.environ.get('SNAKE_DEBUG', outdir), 'snake-heads-parts.png'))


if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else os.path.join(here, '..', 'assets', 'ref'))
