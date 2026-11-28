# pixel diff of two shot folders: mean abs difference per channel (0-255), share of pixels off by > 24, and a diff image
import sys, os
from PIL import Image, ImageChops
a, b, o = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(o, exist_ok=True)
for f in sorted(os.listdir(a)):
    if not f.endswith('.png') or not os.path.exists(os.path.join(b, f)): continue
    A = Image.open(os.path.join(a, f)).convert('RGB'); B = Image.open(os.path.join(b, f)).convert('RGB')
    if A.size != B.size: print(f, 'size differs', A.size, B.size); continue
    D = ImageChops.difference(A, B); px = list(D.getdata()); n = len(px)
    mean = sum(sum(p) for p in px) / (3 * n); big = sum(1 for p in px if max(p) > 24) / n
    print(f'{f:28s} mean {mean:5.2f}  >24: {100*big:5.2f}%')
    D.point(lambda v: min(255, v * 4)).save(os.path.join(o, f))
