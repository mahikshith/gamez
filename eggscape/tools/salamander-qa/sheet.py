# Combine the salamander QA strips into one contact sheet (<= 2000 px wide).
# Usage: python3 tools/salamander-qa/sheet.py <strip dir> <out.png>
import sys, os
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]
names = ['1-walk', '2-turn-gap', '3-idle', '4-breath', '5-hiss-cool', '6-dazed', '7-flee', '10-blend', '9-head-2x']
W = 2000
strips = []
for n in names:
    im = Image.open(os.path.join(d, n + '.png')).convert('RGB')
    s = min(1.0, (W - 20) / im.size[0])
    strips.append((n, im.resize((int(im.size[0] * s), int(im.size[1] * s)), Image.LANCZOS)))
lvl = Image.open(os.path.join(d, '8-level.png')).convert('RGB')
lvl = lvl.resize((int(lvl.size[0] * 0.62), int(lvl.size[1] * 0.62)), Image.LANCZOS)
head = strips.pop()  # head close-up sits beside the level shot on the last row
H = sum(im.size[1] + 30 for _, im in strips) + max(lvl.size[1], head[1].size[1]) + 40
sheet = Image.new('RGB', (W, H), (17, 17, 17))
dr = ImageDraw.Draw(sheet)
y = 10
for n, im in strips:
    dr.text((10, y), n, fill=(255, 210, 120))
    sheet.paste(im, (10, y + 16))
    y += im.size[1] + 30
dr.text((10, y), '8-level (full phone frame, 390x844 @2x, scaled 0.62)', fill=(255, 210, 120))
sheet.paste(lvl, (10, y + 16))
x = lvl.size[0] + 30
dr.text((x, y), head[0], fill=(255, 210, 120))
sheet.paste(head[1], (x, y + 16))
sheet.save(out, optimize=True)
print(sheet.size)
