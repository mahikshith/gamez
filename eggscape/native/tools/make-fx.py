# Bakes the particle / light textures in assets/fx (run: python3 tools/make-fx.py). Needs Pillow + numpy.
# Everything is drawn 4x and scaled down, white or cream so the game can tint it.
import os, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "fx")
os.makedirs(OUT, exist_ok=True)
random.seed(7)
SS = 4

def save(im, name, size):
    im.resize(size, Image.LANCZOS).save(os.path.join(OUT, name))

def radial(n, power=2.0, inner=0.0):
    y, x = np.mgrid[0:n, 0:n]
    d = np.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2)
    a = np.clip(1.0 - (d - inner) / (1.0 - inner), 0, 1) ** power
    return a

def rgba(a, col=(255, 255, 255)):
    n = a.shape[0]
    im = np.zeros((a.shape[0], a.shape[1], 4), np.uint8)
    im[..., 0], im[..., 1], im[..., 2] = col
    im[..., 3] = np.clip(a * 255, 0, 255).astype(np.uint8)
    return Image.fromarray(im, "RGBA")

# soft light pool (additive lights, halos)
rgba(radial(128, 2.2)).save(os.path.join(OUT, "glow.png"))

# dust puff: a lumpy union of soft discs
n = 64 * SS
m = Image.new("L", (n, n), 0)
d = ImageDraw.Draw(m)
for i in range(7):
    a = i / 7 * math.tau + random.random()
    r = n * (0.2 + random.random() * 0.08)
    cx = n / 2 + math.cos(a) * n * 0.17
    cy = n / 2 + math.sin(a) * n * 0.15
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
d.ellipse([n * 0.28, n * 0.28, n * 0.72, n * 0.72], fill=255)
m = m.filter(ImageFilter.GaussianBlur(n * 0.045))
a = np.asarray(m, np.float32) / 255
a = np.clip(a * 1.25, 0, 1) * (0.55 + 0.45 * radial(n, 0.8))
y = np.mgrid[0:n, 0:n][0] / n
im = np.zeros((n, n, 4), np.uint8)
shade = 255 - (y * 30)
im[..., 0] = shade; im[..., 1] = shade; im[..., 2] = shade
im[..., 3] = (a * 235).astype(np.uint8)
save(Image.fromarray(im, "RGBA"), "dust.png", (64, 64))

# spark: four-point glint with a hot core
n = 64 * SS
y, x = np.mgrid[0:n, 0:n]
u = (x - n / 2 + 0.5) / (n / 2); v = (y - n / 2 + 0.5) / (n / 2)
star = np.clip(1.0 - (np.abs(u) ** 0.5 + np.abs(v) ** 0.5) ** 2 * 0.52, 0, 1) ** 1.6
core = np.clip(1.0 - np.hypot(u, v) / 0.34, 0, 1) ** 1.5
save(rgba(np.clip(star * 1.3 + core, 0, 1)), "spark.png", (64, 64))

# feather: cream vane, darker quill, brown outline (the hen's colours)
w, h = 40 * SS, 88 * SS
im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
pts = []
for i in range(41):
    t = i / 40
    half = math.sin(t * math.pi) ** 0.7 * (0.36 - 0.1 * t) * w
    pts.append((w / 2 - half, h * (0.06 + 0.86 * t)))
for i in range(40, -1, -1):
    t = i / 40
    half = math.sin(t * math.pi) ** 0.7 * (0.36 - 0.1 * t) * w
    pts.append((w / 2 + half, h * (0.06 + 0.86 * t)))
d.polygon(pts, fill=(255, 247, 232, 255), outline=(107, 74, 42, 255))
d.line(pts + [pts[0]], fill=(107, 74, 42, 255), width=int(2.4 * SS), joint="curve")
right = [(w / 2, h * 0.08)] + [p for p in pts[41:]]
d.polygon(right, fill=(240, 222, 196, 255))
d.line(pts + [pts[0]], fill=(107, 74, 42, 255), width=int(2.4 * SS), joint="curve")
d.line([(w / 2, h * 0.1), (w / 2, h * 0.99)], fill=(170, 124, 76, 255), width=int(2.2 * SS))
for k in range(4):
    yy = h * (0.3 + 0.14 * k)
    d.line([(w / 2, yy), (w / 2 - w * 0.2, yy - h * 0.05)], fill=(214, 190, 158, 255), width=SS)
    d.line([(w / 2, yy), (w / 2 + w * 0.2, yy - h * 0.05)], fill=(205, 180, 148, 255), width=SS)
save(im, "feather.png", (40, 88))

# shell chips: four jagged shards in one strip (cream, lit top-left, brown edge)
c = 40 * SS
strip = Image.new("RGBA", (c * 4, c), (0, 0, 0, 0))
for k in range(4):
    d = ImageDraw.Draw(strip)
    nv = 5 + k % 2
    pts = []
    for i in range(nv):
        a = i / nv * math.tau + random.random() * 0.5
        r = c * (0.24 + random.random() * 0.2)
        pts.append((k * c + c / 2 + math.cos(a) * r, c / 2 + math.sin(a) * r * 0.8))
    d.polygon(pts, fill=(255, 248, 236, 255))
    lo = [(p[0] * 0.6 + (k * c + c / 2) * 0.4 + c * 0.05, p[1] * 0.6 + (c / 2) * 0.4 + c * 0.07) for p in pts]
    d.polygon(lo, fill=(238, 214, 178, 255))
    d.line(pts + [pts[0]], fill=(138, 98, 58, 255), width=int(1.8 * SS), joint="curve")
save(strip, "chips.png", (160, 40))

# confetti: rectangle, disc, streamer, star (white; tinted in game), with a soft fold shade
c = 32 * SS
strip = Image.new("RGBA", (c * 4, c), (0, 0, 0, 0))
d = ImageDraw.Draw(strip)
d.rectangle([c * 0.18, c * 0.3, c * 0.82, c * 0.7], fill=(255, 255, 255, 255))
d.rectangle([c * 0.18, c * 0.5, c * 0.82, c * 0.7], fill=(214, 214, 214, 255))
d.ellipse([c * 1.24, c * 0.24, c * 1.76, c * 0.76], fill=(255, 255, 255, 255))
d.pieslice([c * 1.24, c * 0.24, c * 1.76, c * 0.76], 20, 200, fill=(220, 220, 220, 255))
pts = [(2 * c + c * (0.15 + 0.7 * i / 30), c * (0.5 + 0.2 * math.sin(i / 30 * math.tau * 1.5))) for i in range(31)]
d.line(pts, fill=(255, 255, 255, 255), width=int(c * 0.16), joint="curve")
sp = []
for i in range(10):
    r = c * (0.4 if i % 2 == 0 else 0.18)
    a = -math.pi / 2 + i * math.pi / 5
    sp.append((3 * c + c / 2 + math.cos(a) * r, c / 2 + math.sin(a) * r))
d.polygon(sp, fill=(255, 255, 255, 255))
save(strip, "confetti.png", (128, 32))

# clouds: two painterly cumulus shapes, lit from the top-left, cool underside, soft edge
def cloud(name, seed, w, h):
    random.seed(seed)
    W, H = w * SS, h * SS
    m = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(m)
    base = H * 0.74
    nb = 6
    for i in range(nb):
        t = (i + 0.5) / nb
        r = H * (0.2 + 0.24 * math.sin(t * math.pi) + random.random() * 0.06)
        cx = W * (0.14 + 0.72 * t)
        d.ellipse([cx - r, base - r * 1.5, cx + r, base + r * 0.5], fill=255)
    d.rounded_rectangle([W * 0.06, base - H * 0.16, W * 0.94, base + H * 0.14], radius=H * 0.15, fill=255)
    hi = m.filter(ImageFilter.GaussianBlur(SS * 1.2))
    a = np.asarray(hi, np.float32) / 255
    # shading: light where the mask shifted down-right still covers (top-left lit), cool grey-blue below
    sh = np.asarray(m.transform(m.size, Image.AFFINE, (1, 0, W * 0.02, 0, 1, -H * 0.1)).filter(ImageFilter.GaussianBlur(H * 0.07)), np.float32) / 255
    yy = np.mgrid[0:H, 0:W][0] / H
    k = np.clip((1.0 - sh) * 0.0 + np.clip((yy - 0.5) * 2.4, 0, 1) * 0.75 * (0.4 + 0.6 * sh), 0, 1)
    top = np.array([255, 255, 255], np.float32); bot = np.array([186, 214, 240], np.float32)
    im = np.zeros((H, W, 4), np.uint8)
    for ch in range(3):
        im[..., ch] = top[ch] + (bot[ch] - top[ch]) * k
    im[..., 3] = (a * 255).astype(np.uint8)
    save(Image.fromarray(im, "RGBA"), name, (w, h))

cloud("cloud1.png", 3, 320, 150)
cloud("cloud2.png", 11, 256, 110)
print("ok", sorted(os.listdir(OUT)))
