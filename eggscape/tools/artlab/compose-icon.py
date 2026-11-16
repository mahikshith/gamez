# Composites the icon: a crop of a real in-game vault (blurred a touch, darkened at the edges, a warm light behind the
# stars) under the foreground render (icon-fg.js). python3 compose-icon.py <vault.png> <fg.png> <out.png> [cx cy size]
import sys
from PIL import Image, ImageFilter, ImageDraw, ImageEnhance
vault, fg, out = sys.argv[1:4]
cx, cy, sz = (int(v) for v in (sys.argv[4:7] if len(sys.argv) > 6 else (650, 1500, 1100)))
bg = Image.open(vault).convert('RGB').crop((cx - sz // 2, cy - sz // 2, cx + sz // 2, cy + sz // 2)).resize((1024, 1024), Image.LANCZOS)
bg = bg.filter(ImageFilter.GaussianBlur(5)); bg = ImageEnhance.Color(bg).enhance(1.15)
# vignette + a warm glow where the two meet
vig = Image.new('L', (1024, 1024), 0); d = ImageDraw.Draw(vig)
for i in range(60):
    r = 760 - i * 9; d.ellipse((512 - r, 470 - r, 512 + r, 470 + r), fill=int(i * 3.4))
vig = vig.filter(ImageFilter.GaussianBlur(40))
dark = Image.new('RGB', (1024, 1024), (16, 10, 24))
bg = Image.composite(bg, dark, vig.point(lambda v: min(255, 60 + v)))
glow = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0)); gd = ImageDraw.Draw(glow)
for i in range(30):
    r = 420 - i * 12; gd.ellipse((560 - r, 420 - r, 560 + r, 420 + r), fill=(255, 210, 120, 6))
bg = bg.convert('RGBA'); bg.alpha_composite(glow.filter(ImageFilter.GaussianBlur(30)))
f = Image.open(fg).convert('RGBA')
# a soft drop shadow under the characters
sh = Image.new('RGBA', f.size, (0, 0, 0, 0)); sh.putalpha(f.getchannel('A').point(lambda a: int(a * 0.45)))
sh = sh.filter(ImageFilter.GaussianBlur(14)); bg.alpha_composite(sh, (10, 16)); bg.alpha_composite(f)
bg.convert('RGB').save(out)
