// Shared geometry for physics and rendering. Units are meters, y up.

export const EGG_H = 0.56;
export const EGG_W = 0.42;
export const RING_TH = 0.16;
export const TAU = Math.PI * 2;

// Egg outline point at parameter t (0..TAU). Narrow top, wide bottom.
export function eggPoint(t, h = EGG_H, w = EGG_W) {
  const s = Math.sin(t);
  return { x: (w / 2) * Math.cos(t) * (1 - 0.13 * s), y: (h / 2) * s };
}

export function eggHull(n = 12, scale = 1) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const p = eggPoint((i / n) * TAU, EGG_H * scale, EGG_W * scale);
    pts.push(p);
  }
  return pts;
}

export function wrap(a) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

// Solid arcs of a ring given gaps [{a, len}] in ring-local angles.
// Returns [[a0, a1], ...] covering the ring minus gaps (a1 > a0, may exceed TAU).
export function solidArcs(r, gaps) {
  if (!gaps.length) return [[0, TAU]];
  const gs = gaps
    .map((g) => {
      const half = g.len / (2 * r);
      let a0 = g.a - half;
      a0 = ((a0 % TAU) + TAU) % TAU;
      return [a0, a0 + 2 * half];
    })
    .sort((p, q) => p[0] - q[0]);
  const arcs = [];
  for (let i = 0; i < gs.length; i++) {
    const end = gs[i][1];
    const next = i + 1 < gs.length ? gs[i + 1][0] : gs[0][0] + TAU;
    if (next - end > 1e-3) arcs.push([end, next]);
  }
  return arcs;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}
export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

// Small deterministic RNG.
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
