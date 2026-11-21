# before/after table from two bench logs: flushed frame mean, fps at 4x/6x throttle, the layers that changed most
import json, sys
def load(f): return {(r['tier'], r['id']): r for r in (json.loads(l) for l in open(f) if l.startswith('{'))}
A, B = load(sys.argv[1]), load(sys.argv[2])
print(f"{'tier':7s} {'lvl':>3s} | flush ms before->after | fps x4 | fps x6 | ops/frame | biggest layer changes (ms)")
for k in A:
    if k not in B: continue
    a, b = A[k], B[k]
    la, lb = a.get('layers', {}), b.get('layers', {})
    ch = sorted(((lb.get(n, 0) - la.get(n, 0), n) for n in set(la) | set(lb) if n.startswith('seg.') or n.startswith('backdrop') or n.startswith('weather')), key=lambda x: x[0])[:3]
    na, nb = a.get('count', {}).get('n', {}), b.get('count', {}).get('n', {})
    oa = sum(na.get(x, 0) for x in ('main.fill', 'main.stroke')); ob = sum(nb.get(x, 0) for x in ('main.fill', 'main.stroke'))
    fa, fb = a.get('fps', {}), b.get('fps', {})
    print(f"{k[0]:7s} {k[1]:3d} | {a['flush']['mean']:6.1f} -> {b['flush']['mean']:6.1f} | {fa.get('x4',{}).get('fps','-'):>4} -> {fb.get('x4',{}).get('fps','-'):>4} | {fa.get('x6',{}).get('fps','-'):>4} -> {fb.get('x6',{}).get('fps','-'):>4} | {oa:4d} -> {ob:4d} | " + ', '.join(f"{n.replace('seg.','')} {d:+.1f}" for d, n in ch))
