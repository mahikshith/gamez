# compare two shot folders: per image, the share of pixels that differ (>8 levels on any channel), the mean and max abs
# difference, and the box where they differ; writes <B>/diff-<name>.png (differences in red over a dimmed copy)
import sys, os
import numpy as np
from PIL import Image
A, B = sys.argv[1], sys.argv[2]
for n in sorted(os.listdir(A)):
    if not n.endswith('.png') or n.startswith('diff-') or not os.path.exists(os.path.join(B, n)): continue
    a = np.asarray(Image.open(os.path.join(A, n)).convert('RGB')).astype(int); b = np.asarray(Image.open(os.path.join(B, n)).convert('RGB')).astype(int)
    if a.shape != b.shape: print(n, 'size differs', a.shape, b.shape); continue
    d = np.abs(a - b).max(axis=2); m = d > 8
    ys, xs = np.nonzero(m)
    box = (xs.min(), ys.min(), xs.max(), ys.max()) if len(xs) else None
    print(f'{n:34s} differ {100 * m.mean():6.3f}%  mean {np.abs(a - b).mean():5.2f}  max {d.max():3d}  box {box}')
    v = (b * 0.35).astype(np.uint8); v[m] = [255, 0, 0]
    Image.fromarray(v).save(os.path.join(B, 'diff-' + n))
