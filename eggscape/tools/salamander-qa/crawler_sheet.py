# Contact sheet for the crawler family (gecko, thorn-back, chameleon, plus the line-up with the salamander).
# Usage: python3 tools/salamander-qa/crawler_sheet.py <qa dir (holds crawlers/ and salamander/)> <out.png>
import sys, os
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]
W = 2000
TITLES = {
    'gecko': 'FROST GECKO (Frozen Lake, L11) - walks on the ring, its trail freezes the ring (eggs slide); fire melts it for a while',
    'thornback': 'THORN-BACK LIZARD (Crystal Caves, L16) - drops thorns behind it; a stone egg or dash chick flips it, its thorns crumble',
    'chameleon': 'CHAMELEON (Storm Peaks, L26) - hides in the ring colour, tongue steals an orb from 2 m; a fox-curse orb makes it flash, flee and drop its loot',
}
def load(p, w=None, h=None, s=None):
    im = Image.open(p).convert('RGB')
    if s is None:
        s = min(1.0, w / im.size[0]) if w else h / im.size[1]
    return im.resize((max(1, int(im.size[0] * s)), max(1, int(im.size[1] * s))), Image.LANCZOS)
rows = []  # (title or None, [(label, image)])
rows.append(('FAMILY LINE-UP at true relative size (one rig, four species)', [('x-lineup', load(os.path.join(d, 'salamander/x-lineup.png'), w=W - 20))]))
for sp in ['gecko', 'thornback', 'chameleon']:
    f = lambda n: os.path.join(d, 'crawlers', f'{sp}-{n}.png')
    rows.append((TITLES[sp], [('1-walk', load(f('1-walk'), w=W - 20))]))
    rows.append((None, [('2-trait', load(f('2-trait'), w=W - 20))]))
    rows.append((None, [('3-weakness', load(f('3-weakness'), w=W - 20))]))
    lvl = load(f('5-level'), s=0.42)
    head = load(f('6-head-2x'), h=lvl.size[1])
    if head.size[0] > W - 40 - lvl.size[0]:
        head = load(f('6-head-2x'), w=W - 40 - lvl.size[0])
    rows.append((None, [('4-idle', load(f('4-idle'), w=W - 20))]))
    rows.append((None, [('6-head-2x', head), ('5-level (phone frame x0.42)', lvl)]))
H = 10 + sum((30 if t else 0) + 16 + max(im.size[1] for _, im in ims) + 14 for t, ims in rows)
sheet = Image.new('RGB', (W, H), (17, 17, 17))
dr = ImageDraw.Draw(sheet)
y = 10
for t, ims in rows:
    if t:
        dr.rectangle((0, y, W, y + 24), fill=(48, 40, 30))
        dr.text((10, y + 6), t, fill=(255, 220, 140))
        y += 30
    x = 10
    for label, im in ims:
        dr.text((x, y), label, fill=(255, 210, 120))
        sheet.paste(im, (x, y + 16))
        x += im.size[0] + 20
    y += 16 + max(im.size[1] for _, im in ims) + 14
sheet.save(out, optimize=True)
print(sheet.size)
