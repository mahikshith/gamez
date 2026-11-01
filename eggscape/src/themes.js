// Eggscape — procedural level themes & backdrops (Canvas 2D, no assets, no deps).
// createBackdrop(theme, seed) -> { resize, draw, drawAmbient, drawGround }
// Static scenery is prerendered into up to 3 parallax layers in resize(); draw() only blits
// them plus a handful of animated elements. World camera is y-up (planck), meters.

import { drawFox } from './render/characters.js';
import { drawSprite } from './render/sprites.js';

// ---------------------------------------------------------------- math / rng / color
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const fract = (x) => x - Math.floor(x);
const wrap = (v, m) => ((v % m) + m) % m;
function hash32(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) {
  let a = seed >>> 0;
  const f = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.r = (x, y) => x + (y - x) * f();
  f.i = (x, y) => Math.floor(x + (y - x + 1) * f());
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  return f;
}
const hexRgb = (h) => { h = h.slice(1); if (h.length === 3) h = h.replace(/./g, '$&$&'); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgbHex = (c) => '#' + c.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const A = hexRgb(a), B = hexRgb(b); return rgbHex(A.map((v, i) => lerp(v, B[i], t))); };
const rgba = (h, a) => { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; };
const shade = (h, k) => (k >= 0 ? mix(h, '#ffffff', k) : mix(h, '#000000', -k));

// ---------------------------------------------------------------- canvas helpers
function mkCanvas(w, h) {
  const c = typeof document !== 'undefined' ? document.createElement('canvas') : new OffscreenCanvas(1, 1);
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
}
// sprite: CSS-size w,h painted by fn(c) at dpr resolution
function sprite(dpr, w, h, fn) {
  const cv = mkCanvas(w * dpr, h * dpr), c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0); fn(c, w, h);
  return { cv, w, h };
}
const blit = (ctx, sp, x, y, s = 1) => ctx.drawImage(sp.cv, x - sp.w * s / 2, y - sp.h * s / 2, sp.w * s, sp.h * s);
function grad(c, x0, y0, x1, y1, stops) { const g = c.createLinearGradient(x0, y0, x1, y1); for (const [o, k] of stops) g.addColorStop(o, k); return g; }
const vg = (c, y0, y1, stops) => grad(c, 0, y0, 0, y1, stops);
function rect(c, x, y, w, h, f) { c.fillStyle = f; c.fillRect(x, y, w, h); }
function circle(c, x, y, r, f) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); c.fillStyle = f; c.fill(); }
function ell(c, x, y, rx, ry, f, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); c.fillStyle = f; c.fill(); }
function poly(c, p, f) { c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.closePath(); if (f) { c.fillStyle = f; c.fill(); } }
function rrect(c, x, y, w, h, r, f) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); if (f) { c.fillStyle = f; c.fill(); } }
function glow(c, x, y, r, col, a = 1) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(col, a)); g.addColorStop(0.3, rgba(col, a * 0.5)); g.addColorStop(0.65, rgba(col, a * 0.14)); g.addColorStop(1, rgba(col, 0));
  c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r);
}
function line(c, x0, y0, x1, y1, col, w) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.strokeStyle = col; c.lineWidth = w; c.stroke(); }

// ---------------------------------------------------------------- terrain
function waveFn(R, y0, amp, wl) {
  const p = [R.r(0, TAU), R.r(0, TAU), R.r(0, TAU)];
  return (x) => y0 - amp * (0.55 * Math.sin(x / wl * TAU + p[0]) + 0.3 * Math.sin(x / (wl * 0.47) * TAU + p[1]) + 0.15 * Math.sin(x / (wl * 0.21) * TAU + p[2]));
}
function ridgeFn(R, W, y0, amp, rough = 0.55, lv = 7) {
  const n = 1 << lv, a = new Float32Array(n + 1);
  a[0] = R.r(-0.5, 0.5); a[n] = R.r(-0.5, 0.5);
  for (let st = n, sc = 1; st > 1; st >>= 1, sc *= rough) { const h = st >> 1; for (let i = h; i < n; i += st) a[i] = (a[i - h] + a[i + h]) / 2 + R.r(-1, 1) * sc; }
  let mn = Infinity, mx = -Infinity; for (const v of a) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
  return (x) => { const f = clamp(x / W, 0, 1) * n, i = Math.min(n - 1, f | 0), v = a[i] + (a[i + 1] - a[i]) * (f - i); return y0 - amp * ((v - mn) / (mx - mn)); };
}
function pathFn(c, W, H, fn, step = 4) { c.beginPath(); c.moveTo(-4, H + 4); for (let x = -4; x <= W + step; x += step) c.lineTo(x, fn(x)); c.lineTo(W + step, H + 4); c.closePath(); }
function fillFn(c, W, H, fn, f, step = 4) { pathFn(c, W, H, fn, step); c.fillStyle = f; c.fill(); }
function rimFn(c, W, fn, col, w, step = 4) { c.beginPath(); for (let x = -4; x <= W + step; x += step) x < 0 ? c.moveTo(x, fn(x)) : c.lineTo(x, fn(x)); c.strokeStyle = col; c.lineWidth = w; c.stroke(); }
// ---------------------------------------------------------------- props
function cloudSprite(dpr, w, top, bot, R) {
  const h = w * 0.5;
  return sprite(dpr, w, h, (c) => {
    const puffs = [], n = 5 + (R() * 3 | 0);
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; const r = w * (0.09 + 0.11 * Math.sin(t * Math.PI)) * R.r(0.85, 1.15); puffs.push([w * (0.13 + 0.74 * t), h * 0.86 - r * 0.7, r]); }
    c.save(); c.beginPath(); c.rect(0, 0, w, h * 0.86); c.clip();
    for (const [x, y, r] of puffs) circle(c, x, y, r, bot);
    for (const [x, y, r] of puffs) circle(c, x - r * 0.1, y - r * 0.14, r * 0.86, top);
    c.restore();
    rrect(c, w * 0.1, h * 0.86 - w * 0.025, w * 0.8, w * 0.025, w * 0.012, bot);
  });
}
function sun(c, x, y, r, core, halo) {
  glow(c, x, y, r * 9, halo, 0.5); glow(c, x, y, r * 3.2, halo, 0.75);
  const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#fffdf0'); g.addColorStop(1, core);
  circle(c, x, y, r, g);
}
// flat-shaded mountain range: lit left faces, shaded right faces, optional snow caps
function mountains(c, W, base, n, hmin, hmax, lit, dark, snow, R, wk = 1) {
  const pk = []; for (let i = 0; i < n; i++) pk.push({ x: (i + R.r(0.15, 0.85)) / n * W * 1.1 - W * 0.05, h: R.r(hmin, hmax) });
  pk.sort((a, b) => b.h - a.h);
  for (const p of pk) {
    const hw = p.h * R.r(1.2, 1.7) * wk, tx = p.x, ty = base - p.h, j = () => R.r(-0.04, 0.04) * p.h;
    const M = [tx - hw, base + 2, tx - hw * 0.62, base - p.h * 0.38 + j(), tx - hw * 0.4, base - p.h * 0.55 + j(), tx - hw * 0.18, base - p.h * 0.84 + j(), tx, ty,
      tx + hw * 0.16, base - p.h * 0.8 + j(), tx + hw * 0.33, base - p.h * 0.66 + j(), tx + hw * 0.6, base - p.h * 0.36 + j(), tx + hw, base + 2];
    const D = [tx, ty, ...M.slice(10), tx + hw * 0.25, base + 2, tx + hw * 0.1, base - p.h * 0.35, tx + hw * 0.05, base - p.h * 0.7];
    poly(c, M, lit); poly(c, D, dark);
    if (snow) {
      c.save(); poly(c, M); c.clip();
      const sl = ty + p.h * R.r(0.28, 0.4); c.beginPath(); c.moveTo(tx - hw, ty - 5);
      for (let k = 0; k <= 8; k++) c.lineTo(tx - hw * 0.6 + k * hw * 0.15, sl + (k % 2 ? -1 : 1) * p.h * 0.06 + R.r(-0.03, 0.03) * p.h);
      c.lineTo(tx + hw, ty - 5); c.closePath(); c.fillStyle = snow[0]; c.fill();
      poly(c, D); c.clip(); c.fillStyle = snow[1]; c.fill(); c.restore();
    }
  }
}
// sand dunes: sharp crests, curved lit windward slopes (left), shaded slip faces sweeping down-right
function dunes(c, W, H, base, amp, n, lit, dark, rim, R) {
  const C = []; let x = -R.r(0.3, 0.9) * W / n;
  while (x < W + W / n * 1.5) { C.push([x, base - amp * R.r(0.5, 1.05)]); x += W / n * R.r(0.75, 1.3); }
  const T = (i) => [lerp(C[i][0], C[i + 1][0], R.r(0.3, 0.42)), base + amp * 0.2];
  const tr = C.slice(0, -1).map((_, i) => T(i));
  const up = (t, cr) => c.bezierCurveTo(lerp(t[0], cr[0], 0.45), t[1], lerp(t[0], cr[0], 0.7), cr[1] + (t[1] - cr[1]) * 0.12, cr[0], cr[1]);
  const down = (cr, t) => c.bezierCurveTo(lerp(cr[0], t[0], 0.25), lerp(cr[1], t[1], 0.4), lerp(cr[0], t[0], 0.6), t[1], t[0], t[1]);
  c.beginPath(); c.moveTo(C[0][0], H + 4); c.lineTo(C[0][0], C[0][1]);
  for (let i = 0; i < tr.length; i++) { down(C[i], tr[i]); up(tr[i], C[i + 1]); }
  c.lineTo(C[C.length - 1][0], H + 4); c.closePath(); c.fillStyle = lit; c.fill();
  for (let i = 0; i < tr.length; i++) {
    const cr = C[i], t = tr[i], d = t[0] - cr[0];
    c.beginPath(); c.moveTo(cr[0], cr[1]); down(cr, t);
    c.bezierCurveTo(t[0] + d * 0.4, t[1] + amp * 0.2, t[0] + d * 0.3, H, t[0] + d * 0.1, H + 4);
    c.lineTo(cr[0] - d * 0.6, H + 4);
    c.bezierCurveTo(cr[0] - d * 0.5, cr[1] + amp * 1.2, cr[0] - d * 0.05, cr[1] + amp * 0.5, cr[0], cr[1]);
    c.fillStyle = dark; c.fill();
    if (rim && i > 0) { c.beginPath(); c.moveTo(lerp(tr[i - 1][0], cr[0], 0.55), lerp(tr[i - 1][1], cr[1], 0.8)); c.quadraticCurveTo(lerp(tr[i - 1][0], cr[0], 0.85), cr[1] + (tr[i - 1][1] - cr[1]) * 0.05, cr[0], cr[1]); c.strokeStyle = rim; c.lineWidth = Math.max(1, amp * 0.05); c.lineCap = 'round'; c.stroke(); }
  }
}
function roundTree(c, x, y, s, trunk, dark, light, R, fruit, mid) {
  c.fillStyle = trunk; poly(c, [x - 0.07 * s, y, x - 0.04 * s, y - 0.55 * s, x + 0.04 * s, y - 0.55 * s, x + 0.07 * s, y], trunk);
  const B = [[0, -0.72, 0.34], [-0.27, -0.6, 0.25], [0.27, -0.62, 0.27], [-0.13, -0.92, 0.27], [0.15, -0.9, 0.26]];
  for (const b of B) circle(c, x + b[0] * s, y + b[1] * s, b[2] * s, dark);
  if (mid) for (const b of B) circle(c, x + (b[0] - 0.03) * s, y + (b[1] - 0.04) * s, b[2] * s * 0.86, mid);
  for (const b of B) circle(c, x + (b[0] - 0.06) * s, y + (b[1] - 0.08) * s, b[2] * s * 0.66, light);
  if (fruit) for (let i = 0; i < 14; i++) { const a = R.r(0, TAU), d = R.r(0.05, 0.4) * s, fx = x + Math.cos(a) * d, fy = y - 0.76 * s + Math.sin(a) * d * 0.75; circle(c, fx, fy, 0.026 * s, fruit); circle(c, fx - 0.008 * s, fy - 0.008 * s, 0.009 * s, 'rgba(255,255,255,0.6)'); }
}
function pine(c, x, y, s, dark, light, snow, trunk) {
  rect(c, x - s * 0.035, y - s * 0.16, s * 0.07, s * 0.16, trunk || shade(dark, -0.3));
  for (let i = 0; i < 4; i++) {
    const ty = y - s * (0.12 + i * 0.2), wd = s * 0.3 * (1 - i * 0.19), ap = ty - s * 0.32;
    poly(c, [x - wd, ty, x, ap, x + wd, ty], dark);
    poly(c, [x - wd, ty, x, ap, x - wd * 0.1, ty + s * 0.02], light);
    if (snow) { poly(c, [x - wd * 0.62, ty - s * 0.1, x, ap, x + wd * 0.5, ty - s * 0.12, x + wd * 0.1, ty - s * 0.07, x - wd * 0.25, ty - s * 0.1], snow); }
  }
}
function deadTree(c, x, y, s, col, R, depth = 6) {
  c.strokeStyle = col; c.lineCap = 'round';
  const br = (x0, y0, a, len, w, d) => {
    const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
    c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2 + R.r(-1, 1) * len * 0.15, (y0 + y1) / 2, x1, y1); c.stroke();
    if (d <= 0) return;
    const k = d > depth - 2 ? 2 : R() < 0.7 ? 2 : 3;
    for (let i = 0; i < k; i++) br(x1, y1, a + R.r(-0.75, 0.75) + (i - (k - 1) / 2) * 0.35, len * R.r(0.62, 0.8), w * 0.62, d - 1);
  };
  br(x, y, -Math.PI / 2 + R.r(-0.15, 0.15), s * 0.3, s * 0.07, depth);
}
function palm(c, x, y, s, col, lean, R) {
  const tx = x + lean * s * 0.5, ty = y - s;
  c.strokeStyle = col; c.lineCap = 'round';
  for (let i = 0; i < 10; i++) {
    const t0 = i / 10, t1 = (i + 1) / 10;
    const px = (t) => x + lean * s * 0.5 * t * t, py = (t) => y - s * t;
    c.lineWidth = s * (0.07 - 0.03 * t0); c.beginPath(); c.moveTo(px(t0), py(t0)); c.lineTo(px(t1), py(t1)); c.stroke();
  }
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.48 + R.r(-0.1, 0.1), L = s * R.r(0.42, 0.55);
    const ex = tx + Math.cos(a) * L, ey = ty + Math.sin(a) * L * 0.5 + L * 0.35;
    const mx = tx + Math.cos(a) * L * 0.5, my = ty + Math.sin(a) * L * 0.5 - L * 0.05;
    c.beginPath(); c.moveTo(tx, ty); c.quadraticCurveTo(mx, my - s * 0.07, ex, ey); c.quadraticCurveTo(mx, my + s * 0.04, tx, ty); c.fillStyle = col; c.fill();
  }
}
function stars(c, W, H, n, R, maxY, col = '#ffffff') {
  for (let i = 0; i < n; i++) { const y = R() * R() * maxY; c.globalAlpha = R.r(0.25, 0.9); circle(c, R() * W, y, R() < 0.9 ? R.r(0.4, 1) : R.r(1.2, 1.7), col); }
  c.globalAlpha = 1;
}
function moon(c, x, y, r, col, halo, crater) {
  glow(c, x, y, r * 5, halo, 0.45); glow(c, x, y, r * 2, halo, 0.5);
  circle(c, x, y, r, col);
  c.save(); c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
  circle(c, x + r * 0.35, y + r * 0.2, r * 0.95, rgba(crater, 0.25));
  circle(c, x - r * 0.3, y - r * 0.2, r * 0.2, rgba(crater, 0.4)); circle(c, x + r * 0.25, y - r * 0.4, r * 0.12, rgba(crater, 0.4)); circle(c, x - r * 0.05, y + r * 0.45, r * 0.15, rgba(crater, 0.35));
  c.restore();
}
function rays(c, x, y, ang, spread, len, n, col, a, R) {
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const t = ang + (i / (n - 1) - 0.5) * spread + R.r(-0.04, 0.04), w = R.r(0.02, 0.06);
    const ex = x + Math.cos(t) * len, ey = y + Math.sin(t) * len;
    c.fillStyle = grad(c, x, y, ex, ey, [[0, rgba(col, a * R.r(0.5, 1))], [1, rgba(col, 0)]]);
    poly(c, [x + Math.cos(t + 1.57) * len * 0.01, y + Math.sin(t + 1.57) * len * 0.01, x + Math.cos(t - w) * len, y + Math.sin(t - w) * len, x + Math.cos(t + w) * len, y + Math.sin(t + w) * len]); c.fill();
  }
  c.restore();
}
function grassTufts(c, W, fn, col, h, R, dens = 0.15) {
  c.fillStyle = col;
  for (let x = 0; x < W; x += 1 / dens * R.r(0.5, 1.5)) {
    const y = fn(x) + 1, k = R.i(2, 4); c.beginPath(); c.moveTo(x - h * 0.3, y);
    for (let j = 0; j < k; j++) { const bx = x - h * 0.3 + (j + 0.5) / k * h * 0.6; c.lineTo(bx + R.r(-0.2, 0.2) * h, y - h * R.r(0.6, 1)); c.lineTo(bx + h * 0.15, y); }
    c.closePath(); c.fill();
  }
}

// ---------------------------------------------------------------- scenes
// Each scene: veil [color, alpha] (center calming tint), optional prep(S), sky/far/near painters (layer coords),
// optional back/mid/front(ctx,t,S) per-frame animations (drawn after sky/far/near respectively, in layer coords).
const ART = {};

// 1 ------------------------------------------------ Sunny Farm
ART.farm = {
  veil: ['#3a8ad0', 0.16],
  prep(S) {
    const { u, R, dpr } = S;
    S.cl = [0, 1, 2].map((i) => cloudSprite(dpr, (24 + i * 8) * u, '#ffffff', '#cfe2f2', R));
    S.cls = Array.from({ length: 6 }, (_, i) => ({ x: R(), y: R.r(0.04, 0.3) * S.H, v: R.r(1.2, 2.6) * u, k: i % 3, s: R.r(0.75, 1.1) }));
  },
  sky(c, S) {
    const { W, H, u } = S;
    rect(c, 0, 0, W, H, vg(c, 0, S.hz, [[0, '#3f9fe6'], [0.6, '#8fcdf2'], [1, '#dff3fb']]));
    sun(c, W * 0.15, H * 0.11, 5.5 * u, '#ffe98a', '#fff3c0');
  },
  back(ctx, t, S) { driftSprites(ctx, t, S, S.cl, S.cls); },
  far(c, S) {
    const { W, H, u, R, hz } = S, B = S.gy - hz;
    const f1 = waveFn(R, hz - 6 * u, 4 * u, 75 * u);
    fillFn(c, W, H, f1, vg(c, hz - 14 * u, hz + 10 * u, [[0, '#a7dcb0'], [1, '#8ccb98']]));
    const bx = W * 0.8;
    for (let x = R.r(0, 10) * u; x < W; x += R.r(5, 14) * u) if (Math.abs(x - bx) > 9 * u) roundTree(c, x, f1(x) + 1.5 * u, R.r(4, 6.5) * u, '#6f9a74', '#79b582', '#93c999', R);
    barn(c, bx, f1(bx) + 1.2 * u, 0.72 * u);
    const f2 = waveFn(R, hz + B * 0.1, 3 * u, 58 * u);
    fillFn(c, W, H, f2, vg(c, hz - 4 * u, S.gy, [[0, '#8fd36b'], [1, '#6db84e']]));
    c.save(); pathFn(c, W, H, f2); c.clip(); c.strokeStyle = 'rgba(70,140,50,0.2)'; c.lineWidth = 0.9 * u;
    for (let x = -H; x < W + H; x += 3.2 * u) { c.beginPath(); c.moveTo(x, hz - 6 * u); c.lineTo(x + H * 0.5, H); c.stroke(); }
    c.restore(); rimFn(c, W, f2, 'rgba(200,240,150,0.6)', 0.6 * u);
  },
  near(c, S) {
    const { W, H, u, R, gy } = S, B = gy - S.hz;
    const f3 = waveFn(R, S.by(0.42), Math.min(4 * u, B * 0.1), 95 * u);
    fillFn(c, W, H, f3, vg(c, S.by(0.3), gy, [[0, '#62c247'], [1, '#3f9a35']]));
    rimFn(c, W, f3, '#9be06e', 0.7 * u);
    const fh = Math.min(6.5 * u, B * 0.24);
    fence(c, W, (x) => f3(x) + B * 0.12, fh * 0.85, fh, '#f7efe0', '#cbbd9f');
    for (let i = 0; i < W / u * 0.6; i++) { const x = R() * W, y = lerp(f3(x) + B * 0.2, gy + 2 * u, R()); circle(c, x, y, R.r(0.3, 0.5) * u, R.pick(['#ffffff', '#ffe066', '#ff9ec7', '#ffffff'])); }
    roundTree(c, W * 0.035, gy + 3 * u, 32 * u, '#7a5233', '#2f8a3a', '#5fb84a', R, null, '#43a03f');
    roundTree(c, W * 0.965, gy + 3 * u, 24 * u, '#7a5233', '#2f8a3a', '#5fb84a', R, null, '#43a03f');
    grassTufts(c, W, (x) => f3(x) + B * 0.2, '#4aa83c', 1.8 * u, R, 0.2 / u);
  },
};
function driftSprites(ctx, t, S, sps, list, f = 0.15) {
  S.tf(ctx, f);
  for (const o of list) { const sp = sps[o.k], span = S.W + sp.w * o.s; const x = wrap(o.x * span + t * o.v, span) - sp.w * o.s * 0.5; blit(ctx, sp, x, o.y, o.s); }
  ctx.restore();
}
function barn(c, x, y, s) {
  rect(c, x + 9 * s, y - 15 * s, 4.5 * s, 15 * s, '#b8c4cf'); rect(c, x + 11.2 * s, y - 15 * s, 2.3 * s, 15 * s, '#97a5b2');
  c.beginPath(); c.arc(x + 11.25 * s, y - 15 * s, 2.25 * s, Math.PI, 0); c.fillStyle = '#8d99a6'; c.fill();
  rect(c, x - 7 * s, y - 7 * s, 7 * s, 7 * s, '#d24a3f'); rect(c, x, y - 7 * s, 8 * s, 7 * s, '#a8372f');
  poly(c, [x - 7.6 * s, y - 7 * s, x - 3.5 * s, y - 11.5 * s, x + 0.6 * s, y - 7 * s], '#d24a3f');
  poly(c, [x - 3.5 * s, y - 11.5 * s, x + 4.5 * s, y - 11.5 * s, x + 8.6 * s, y - 7 * s, x + 0.6 * s, y - 7 * s], '#6a3a33');
  c.strokeStyle = '#fff4e6'; c.lineWidth = 0.45 * s; c.strokeRect(x - 5 * s, y - 4.6 * s, 3 * s, 4.6 * s);
  c.beginPath(); c.moveTo(x - 5 * s, y - 4.6 * s); c.lineTo(x - 2 * s, y); c.moveTo(x - 2 * s, y - 4.6 * s); c.lineTo(x - 5 * s, y); c.stroke();
  rect(c, x - 4.1 * s, y - 9.3 * s, 1.2 * s, 1.2 * s, '#fff4e6');
}
function fence(c, W, fn, gap, hgt, col, dark) {
  c.lineCap = 'butt';
  for (const k of [0.38, 0.75]) { c.beginPath(); for (let x = -4; x < W + 8; x += 4) { const y = fn(x) - hgt * k; x < 0 ? c.moveTo(x, y) : c.lineTo(x, y); } c.strokeStyle = dark; c.lineWidth = hgt * 0.13; c.stroke(); c.save(); c.translate(0, -hgt * 0.035); c.strokeStyle = col; c.lineWidth = hgt * 0.08; c.stroke(); c.restore(); }
  for (let x = gap * 0.3; x < W + gap; x += gap) { const y = fn(x); rect(c, x - hgt * 0.07, y - hgt, hgt * 0.14, hgt, dark); rect(c, x - hgt * 0.07, y - hgt, hgt * 0.08, hgt, col); poly(c, [x - hgt * 0.07, y - hgt, x, y - hgt * 1.1, x + hgt * 0.07, y - hgt], col); }
}

// 2 ------------------------------------------------ Hay Barn (interior)
ART.barn = {
  veil: ['#2e1b10', 0.3],
  prep(S) { S.gl = sprite(S.dpr, 34 * S.u, 34 * S.u, (c, w) => glow(c, w / 2, w / 2, w / 2, '#ffc56a', 0.8)); },
  sky(c, S) {
    const { W, H, u, R } = S;
    rect(c, 0, 0, W, H, vg(c, 0, H, [[0, '#3c2416'], [0.5, '#6b4126'], [1, '#4a2c19']]));
    for (let x = 0; x < W; x += 7 * u) {
      const k = R.r(-0.08, 0.08); rect(c, x, 0, 7 * u, H, rgba(k > 0 ? '#ffd9a0' : '#000000', Math.abs(k)));
      rect(c, x, 0, 0.45 * u, H, 'rgba(25,12,5,0.55)');
      for (let j = 0; j < 3; j++) ell(c, x + R.r(2, 5) * u, R() * H, 0.8 * u, 0.4 * u, 'rgba(40,20,8,0.35)');
    }
    const ow = S.port ? W * 0.3 : Math.max(16 * u, W * 0.13), oh = ow * 1.1, ox = W * 0.07, oy = S.port ? H * 0.065 : H * 0.12;
    S.win = [ox, oy, ow, oh];
    rect(c, ox - 1.2 * u, oy - 1.2 * u, ow + 2.4 * u, oh + 2.4 * u, '#2a170c');
    c.save(); c.beginPath(); c.rect(ox, oy, ow, oh); c.clip();
    rect(c, ox, oy, ow, oh, vg(c, oy, oy + oh, [[0, '#9fd6f2'], [0.65, '#fff2cf'], [1, '#fff2cf']]));
    fillFn(c, ox + ow, oy + oh, (x) => oy + oh * 0.72 - Math.sin((x - ox) / ow * 3 + 1) * oh * 0.06, '#9fd27a');
    fillFn(c, ox + ow, oy + oh, (x) => oy + oh * 0.84 - Math.sin((x - ox) / ow * 5) * oh * 0.03, '#7dbf5c');
    c.restore();
    c.strokeStyle = '#3a2213'; c.lineWidth = 1.4 * u; c.beginPath(); c.moveTo(ox + ow / 2, oy); c.lineTo(ox + ow / 2, oy + oh); c.moveTo(ox, oy + oh / 2); c.lineTo(ox + ow, oy + oh / 2); c.stroke();
  },
  far(c, S) {
    const { W, H, u, R } = S, [ox, oy, ow, oh] = S.win;
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const x0 = ox + ow * (0.05 + i * 0.25), x1 = x0 + ow * 0.18, d = H * 0.95, sx = d * 0.5;
      c.fillStyle = grad(c, x0, oy, x0 + sx, oy + d, [[0, 'rgba(255,214,140,0.16)'], [0.55, 'rgba(255,200,120,0.05)'], [1, 'rgba(255,200,120,0)']]);
      poly(c, [x0, oy + oh * 0.2, x1, oy + oh * 0.2, x1 + sx * 1.1, oy + d, x0 + sx * 0.92, oy + d]); c.fill();
    }
    c.restore();
    const beam = '#2e1a0d', beamL = '#4d2e17', ty = H * 0.03;
    rect(c, 0, ty, W, 3.2 * u, beam); rect(c, 0, ty, W, 1 * u, beamL);
    for (let x = W * 0.3; x < W + 20 * u; x += Math.max(40 * u, W * 0.3)) {
      c.strokeStyle = beam; c.lineWidth = 2.6 * u; c.beginPath(); c.moveTo(x - 14 * u, ty); c.lineTo(x, -2 * u); c.lineTo(x + 14 * u, ty); c.stroke();
    }
    // hay loft (full width above the vault in portrait, side lofts in landscape)
    const ly = S.port ? H * 0.27 : H * 0.42, spans = S.port ? [[0, W]] : [[0, W * 0.24], [W * 0.76, W]];
    for (const [a, b] of spans) {
      for (let x = a - 4 * u; x < b + 4 * u; x += 3.6 * u) { const s = R.r(0.6, 1); ell(c, x, ly - 0.5 * u, 4 * u * s, 3.4 * u * s, '#b8862e'); ell(c, x - 0.8 * u, ly - 1.4 * u, 3 * u * s, 2.2 * u * s, '#d8aa47'); }
      rect(c, a, ly, b - a, 2.6 * u, '#2e1a0d'); rect(c, a, ly, b - a, 0.8 * u, '#5a361b');
      c.strokeStyle = '#d8aa47'; c.lineWidth = 0.3 * u; for (let k = 0; k < (b - a) / u * 0.4; k++) { const x = lerp(a, b, R()); c.beginPath(); c.moveTo(x, ly + 2.4 * u); c.lineTo(x + R.r(-1, 1) * u, ly + R.r(3.5, 6) * u); c.stroke(); }
    }
    for (const x of S.port ? [W * 0.05, W * 0.95] : [W * 0.04, W * 0.2, W * 0.8, W * 0.96]) { rect(c, x - 1.8 * u, ly, 3.6 * u, H, '#331d0f'); rect(c, x - 1.8 * u, ly, 1.1 * u, H, '#56331a'); }
    S.lan = S.port ? [[W * 0.66, H * 0.15], [W * 0.9, H * 0.19]] : [[W * 0.27, H * 0.17], [W * 0.88, H * 0.27]];
    for (const [x, y] of S.lan) lantern(c, x, y, u, ty + 3 * u);
  },
  near(c, S) {
    const { W, H, u, R, gy } = S;
    rect(c, 0, gy - 2 * u, W, H, vg(c, gy - 2 * u, H, [[0, '#7a5326'], [1, '#4f3216']]));
    const bw = 15 * u, bh = 8.5 * u;
    const stack = (x0, dir, rows) => { for (let r = 0; r < rows; r++) for (let i = 0; i < rows - r; i++) bale(c, x0 + dir * (i * bw + r * bw * 0.5) - (dir < 0 ? bw : 0), gy + 1.5 * u - (r + 1) * bh, bw, bh, R, u); };
    stack(-4 * u, 1, 3); stack(W + 4 * u, -1, S.port ? 2 : 3);
    c.strokeStyle = '#e1b552'; c.lineWidth = 0.35 * u;
    for (let i = 0; i < W / u * 0.8; i++) { const x = R() * W, y = gy - 2 * u + R() * 3 * u, a = R.r(-0.6, 0.6); c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 2.5 * u, y + Math.sin(a) * 2.5 * u); c.stroke(); }
    const px = W * (S.port ? 0.86 : 0.78); line(c, px, gy + 1 * u, px - 6 * u, gy - 33 * u, '#8a5a2c', 0.9 * u);
    c.strokeStyle = '#9aa0a8'; c.lineWidth = 0.5 * u; for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(px - 6 * u, gy - 33 * u); c.quadraticCurveTo(px - 6 * u + k * 1.6 * u, gy - 35 * u, px - 6.6 * u + k * 1.8 * u, gy - 40 * u); c.stroke(); }
  },
  front(ctx, t, S) {
    S.tf(ctx, 0.4);
    for (let i = 0; i < S.lan.length; i++) { const [x, y] = S.lan[i]; ctx.globalAlpha = 0.22 + 0.1 * Math.sin(t * 7.3 + i * 2) * Math.sin(t * 3.1 + i); blit(ctx, S.gl, x, y + S.u * 1.5); }
    ctx.globalAlpha = 1; ctx.restore();
  },
};
function lantern(c, x, y, u, top) {
  line(c, x, top, x, y - 3 * u, '#1e120a', 0.4 * u);
  glow(c, x, y + 1.5 * u, 28 * u, '#ffb54d', 0.45);
  rect(c, x - 2.2 * u, y - 3 * u, 4.4 * u, 1.2 * u, '#2b1c12');
  rrect(c, x - 1.8 * u, y - 1.8 * u, 3.6 * u, 5.5 * u, 1.2 * u, '#ffd27a'); circle(c, x, y + 1.2 * u, 1.2 * u, '#fff1c4');
  c.strokeStyle = '#2b1c12'; c.lineWidth = 0.4 * u; c.beginPath(); c.moveTo(x, y - 1.8 * u); c.lineTo(x, y + 3.7 * u); c.stroke();
  rect(c, x - 2.2 * u, y + 3.7 * u, 4.4 * u, 1 * u, '#2b1c12');
}
function bale(c, x, y, w, h, R, u) {
  rrect(c, x, y, w, h, 1.4 * u, '#c99a3c');
  rrect(c, x, y, w, h * 0.45, 1.4 * u, '#e2b955');
  rect(c, x, y + h * 0.82, w, h * 0.18, 'rgba(90,55,15,0.35)');
  c.strokeStyle = 'rgba(120,80,25,0.5)'; c.lineWidth = 0.25 * u;
  for (let i = 0; i < 14; i++) { const sx = x + R() * w, sy = y + R() * h; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + R.r(1, 3) * u, sy + R.r(-0.5, 0.5) * u); c.stroke(); }
  for (const k of [0.28, 0.72]) rect(c, x + w * k, y, 0.6 * u, h, '#7a4d1e');
}

// 3 ------------------------------------------------ Apple Orchard
ART.orchard = {
  veil: ['#4c7fae', 0.16],
  leaves: ['#e8a33a', '#c9612e', '#9cbc45', '#d8842f'],
  prep(S) {
    const { u, R, dpr } = S;
    S.cl = [0, 1].map((i) => cloudSprite(dpr, (22 + i * 8) * u, '#fff8ea', '#f2d6b6', R));
    S.cls = Array.from({ length: 4 }, (_, i) => ({ x: R(), y: R.r(0.05, 0.25) * S.H, v: R.r(1, 2) * u, k: i % 2, s: R.r(0.8, 1.1) }));
  },
  sky(c, S) {
    const { W, H, u, hz } = S;
    rect(c, 0, 0, W, H, vg(c, 0, hz, [[0, '#5aa5dc'], [0.55, '#a9d2e6'], [1, '#fbe1aa']]));
    sun(c, W * 0.86, H * 0.17, 5.5 * u, '#ffd77a', '#ffe2a1');
  },
  back(ctx, t, S) { driftSprites(ctx, t, S, S.cl, S.cls); },
  far(c, S) {
    const { W, H, u, R, hz } = S;
    const f0 = waveFn(R, hz - 4 * u, 3 * u, 80 * u);
    fillFn(c, W, H, f0, '#b6cf9c');
    for (let x = 0; x < W; x += 4.2 * u) roundTree(c, x + R.r(-1, 1) * u, f0(x) + 1 * u, 5 * u, '#8ea27a', '#93b07e', '#a8c491', R);
    const f1 = waveFn(R, hz + 2 * u, 1.5 * u, 90 * u);
    fillFn(c, W, H, f1, vg(c, hz, S.gy, [[0, '#9ccc63'], [1, '#86bb52']]));
    for (let x = 0; x < W; x += 8.5 * u) roundTree(c, x + R.r(-1, 1) * u, f1(x) + 1.5 * u, 9.5 * u, '#6b5338', '#5e9a3e', '#7fb64e', R, '#d8433a', '#6ba744');
  },
  near(c, S) {
    const { W, H, u, R, gy } = S, B = gy - S.hz;
    const f2 = waveFn(R, S.by(0.4), 1.5 * u, 120 * u);
    fillFn(c, W, H, f2, vg(c, S.by(0.3), gy, [[0, '#7cbf4a'], [1, '#529a36']]));
    c.save(); pathFn(c, W, H, f2); c.clip();
    for (let i = 0; i < 5; i++) rect(c, 0, f2(W / 2) + B * (0.08 + i * i * 0.04), W, B * (0.03 + i * 0.012), 'rgba(255,255,200,0.08)');
    c.restore();
    rimFn(c, W, f2, '#a6d968', 0.6 * u);
    const big = S.port ? 30 * u : 34 * u;
    roundTree(c, W * 0.03, gy + 3 * u, big * 1.15, '#6a4a2c', '#2f7a2e', '#5aa944', R, '#e0392f', '#469236');
    roundTree(c, W * 0.97, gy + 3 * u, big, '#6a4a2c', '#2f7a2e', '#5aa944', R, '#e0392f', '#469236');
    const cx = W * (S.port ? 0.8 : 0.86), cy = gy + 1 * u;
    for (let i = 0; i < 6; i++) circle(c, cx - 3 * u + i * 1.3 * u, cy - 5.6 * u + Math.sin(i * 2) * 0.4 * u, 1.1 * u, i % 2 ? '#d93b30' : '#ef5a3d');
    rect(c, cx - 4.5 * u, cy - 5.5 * u, 9 * u, 5.5 * u, '#b07a42'); rect(c, cx - 4.5 * u, cy - 3.2 * u, 9 * u, 0.6 * u, '#7e5129'); rect(c, cx - 4.5 * u, cy - 5.5 * u, 9 * u, 0.8 * u, '#cf9b5d');
    const lx = W * (S.port ? 0.12 : 0.1), ly = gy + 1 * u;
    c.strokeStyle = '#9b6b3b'; c.lineWidth = 0.8 * u; c.beginPath(); c.moveTo(lx, ly); c.lineTo(lx + 5 * u, ly - 24 * u); c.moveTo(lx + 4.5 * u, ly); c.lineTo(lx + 9.5 * u, ly - 24 * u); c.stroke();
    for (let k = 1; k < 7; k++) { const t = k / 7; line(c, lx + 5 * u * t, ly - 24 * u * t, lx + 4.5 * u + 5 * u * t, ly - 24 * u * t, '#9b6b3b', 0.6 * u); }
    for (let i = 0; i < 12; i++) { const x = R() * W, y = lerp(f2(x) + B * 0.2, gy + 2 * u, R()); circle(c, x, y, 0.8 * u, '#d9432f'); }
    grassTufts(c, W, (x) => f2(x) + B * 0.25, '#5ea83e', 1.8 * u, R, 0.15 / u);
  },
};

// 4 ------------------------------------------------ Pumpkin Patch
ART.pumpkin = {
  veil: ['#4a2440', 0.24],
  leaves: ['#d9772b', '#b8461f', '#8a5a2a', '#e0a33a'],
  prep(S) { const { u, R } = S; S.crows = Array.from({ length: 4 }, () => ({ x: R(), y: R.r(0.07, 0.24) * S.H, v: R.r(3, 5) * u, s: R.r(0.7, 1.1) * u, p: R() * TAU })); },
  sky(c, S) {
    const { W, H, u, R, hz } = S;
    rect(c, 0, 0, W, H, vg(c, 0, hz, [[0, '#33275a'], [0.35, '#7e3a62'], [0.7, '#ea7449'], [1, '#ffbf5a']]));
    const sx = W * (S.port ? 0.72 : 0.8), sy = hz - 3 * u; glow(c, sx, sy, 70 * u, '#ffb050', 0.6); sun(c, sx, sy, 10 * u, '#ffd36a', '#ffb050');
    for (let i = 0; i < 7; i++) { const y = H * R.r(0.1, 0.45), x = R() * W, w = R.r(25, 60) * u; ell(c, x, y, w, R.r(0.8, 1.6) * u, rgba(y < H * 0.25 ? '#c0607a' : '#ff9a6a', 0.35)); ell(c, x - w * 0.2, y - 0.5 * u, w * 0.6, 0.6 * u, rgba('#ffc9a0', 0.25)); }
  },
  back(ctx, t, S) {
    S.tf(ctx, 0.2); ctx.fillStyle = '#2a1626';
    for (const o of S.crows) {
      const span = S.W + 20 * S.u, x = wrap(o.x * span + t * o.v, span) - 10 * S.u, y = o.y + Math.sin(t * 0.7 + o.p) * 2 * S.u, f = Math.sin(t * 7 + o.p), s = o.s;
      ctx.beginPath(); ctx.moveTo(x - 4 * s, y - f * 2.2 * s); ctx.quadraticCurveTo(x - 1.5 * s, y - 1 * s, x, y + 0.4 * s); ctx.quadraticCurveTo(x + 1.5 * s, y - 1 * s, x + 4 * s, y - f * 2.2 * s); ctx.quadraticCurveTo(x + 1.5 * s, y + 0.2 * s, x, y + 1.2 * s); ctx.quadraticCurveTo(x - 1.5 * s, y + 0.2 * s, x - 4 * s, y - f * 2.2 * s); ctx.fill();
    }
    ctx.restore();
  },
  far(c, S) {
    const { W, H, u, R, hz } = S;
    const f1 = waveFn(R, hz - 2 * u, 4 * u, 70 * u); fillFn(c, W, H, f1, '#7a3a4e');
    for (let x = R() * 10 * u; x < W; x += R.r(6, 16) * u) roundTree(c, x, f1(x) + 1 * u, R.r(5, 9) * u, '#5e2c40', '#6b3048', '#6b3048', R);
    const f2 = waveFn(R, S.by(0.12), 2.5 * u, 50 * u); fillFn(c, W, H, f2, vg(c, hz, S.gy, [[0, '#5b2c3c'], [1, '#41202f']]));
    const sx = W * (S.port ? 0.2 : 0.14); scarecrow(c, sx, f2(sx) + 1 * u, u * (S.port ? 0.85 : 0.9), '#2d1624');
    fence(c, W, (x) => f2(x) + 3 * u, 9 * u, 4 * u, '#3a1c2c', '#3a1c2c');
  },
  near(c, S) {
    const { W, H, u, R, gy } = S, B = gy - S.hz;
    const f3 = waveFn(R, S.by(0.35), 1.5 * u, 100 * u);
    fillFn(c, W, H, f3, vg(c, S.by(0.3), H, [[0, '#4a3a2a'], [1, '#2c2018']]));
    rimFn(c, W, f3, 'rgba(255,170,90,0.5)', 0.5 * u);
    c.strokeStyle = '#3d5a2a'; c.lineWidth = 0.5 * u;
    for (let r = 0; r < 3; r++) { c.beginPath(); for (let x = 0; x < W; x += 4 * u) { const y = f3(x) + B * (0.15 + r * 0.22) + Math.sin(x * 0.07 / u * 4 + r) * u; x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); }
    const pts = []; for (let i = 0; i < 36; i++) { const x = R() * W, edge = Math.abs(x - W / 2) / (W / 2), k = R(); pts.push([x, lerp(f3(x) + B * 0.12, gy + 3 * u, k), (1.4 + edge * 2.6 + k * 1.2) * u * R.r(0.8, 1.2)]); }
    pts.sort((a, b) => a[1] - b[1]); for (const [x, y, s] of pts) pumpkinShape(c, x, y, s);
  },
};
function pumpkinShape(c, x, y, s) {
  ell(c, x, y + s * 0.8, s * 1.4, s * 0.28, 'rgba(0,0,0,0.25)');
  for (const [dx, k, col] of [[-0.55, 0.62, '#c95d14'], [0.55, 0.62, '#b85212'], [0, 0.7, '#e8771f']]) ell(c, x + dx * s, y, s * k, s * 0.85, col);
  ell(c, x - 0.25 * s, y - 0.2 * s, s * 0.22, s * 0.52, '#f6a04a');
  rect(c, x - 0.1 * s, y - 1.15 * s, 0.2 * s, 0.45 * s, '#4c5a24');
}
function scarecrow(c, x, y, u, col) {
  rect(c, x - 0.5 * u, y - 24 * u, 1 * u, 24 * u, col); rect(c, x - 9 * u, y - 18 * u, 18 * u, 1 * u, col);
  poly(c, [x - 4 * u, y - 19 * u, x + 4 * u, y - 19 * u, x + 5 * u, y - 9 * u, x + 2 * u, y - 10 * u, x, y - 8 * u, x - 2 * u, y - 10 * u, x - 5 * u, y - 9 * u], col);
  poly(c, [x - 9 * u, y - 18.5 * u, x - 10.5 * u, y - 16 * u, x - 8.5 * u, y - 17 * u], col); poly(c, [x + 9 * u, y - 18.5 * u, x + 10.5 * u, y - 16 * u, x + 8.5 * u, y - 17 * u], col);
  circle(c, x, y - 21.5 * u, 2.6 * u, col);
  ell(c, x, y - 23.6 * u, 5.5 * u, 0.9 * u, col); c.beginPath(); c.ellipse(x, y - 24 * u, 2.6 * u, 2.4 * u, 0, Math.PI, 0); c.fill();
}

// 5 ------------------------------------------------ Bramble Woods
ART.bramble = {
  veil: ['#0f2a1c', 0.38],
  leaves: ['#5b8a3a', '#3f6e2e', '#8aa046', '#6e5a2a'],
  prep(S) { const { W, H, dpr, R } = S; S.ray = sprite(dpr, W, H, (c) => rays(c, W * 0.2, -H * 0.1, 1.05, 0.7, H * 1.25, 7, '#e8f7b0', 0.22, R)); },
  sky(c, S) {
    const { W, H, u, R } = S;
    rect(c, 0, 0, W, H, vg(c, 0, H, [[0, '#9ac97e'], [0.35, '#5f9a5a'], [0.75, '#2f5e3c'], [1, '#1d3c28']]));
    glow(c, W * 0.2, 0, 60 * u, '#f4ffd0', 0.55);
    for (const [col, n, a, b] of [['#8bb985', 22, 1.2, 2.4], ['#6a9e6a', 16, 2, 3.6]]) for (let i = 0; i < n; i++) rect(c, R() * W, 0, R.r(a, b) * u, H, col);
  },
  back(ctx, t, S) { S.tf(ctx, 0.1); ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 0.5); ctx.drawImage(S.ray.cv, 0, 0, S.ray.w, S.ray.h); ctx.globalAlpha = 1; ctx.restore(); },
  far(c, S) {
    const { W, H, u, R, hz } = S;
    for (let i = 0; i < 12; i++) { const x = R() * W, w = R.r(3, 6) * u; rect(c, x, 0, w, H, '#3f6e46'); rect(c, x, 0, w * 0.3, H, '#52845a'); }
    const f = waveFn(R, hz + 2 * u, 3 * u, 40 * u); fillFn(c, W, H, f, '#2f5a36');
    for (let x = 0; x < W; x += 3 * u) circle(c, x, f(x) + 1 * u, R.r(2, 4) * u, '#3a6a40');
    for (let x = -5 * u; x < W + 5 * u; x += 5 * u) { circle(c, x, R.r(-4, 2) * u, R.r(6, 11) * u, '#1e3d25'); circle(c, x + 2 * u, R.r(-2, 3) * u, R.r(4, 7) * u, '#2b5332'); }
  },
  near(c, S) {
    const { W, H, u, R, gy } = S, B = gy - S.hz;
    const trunk = (x, w) => { poly(c, [x - w, H, x - w * 0.6, 0, x + w * 0.6, 0, x + w, H], '#15291a'); poly(c, [x - w, H, x - w * 0.6, 0, x - w * 0.25, 0, x - w * 0.5, H], '#24402a'); };
    trunk(W * 0.03, 6 * u); trunk(W * 0.97, 7 * u); if (!S.port) { trunk(W * 0.14, 3.5 * u); trunk(W * 0.86, 4 * u); }
    const f = waveFn(R, S.by(0.35), 2 * u, 60 * u); fillFn(c, W, H, f, vg(c, S.by(0.2), H, [[0, '#24452a'], [1, '#132a18']]));
    const bram = (x0, y0, len, a0, curl) => {
      let x = x0, y = y0, a = a0; const pts = [];
      for (let i = 0; i < 24; i++) { a += curl / 24 + R.r(-0.05, 0.05); x += Math.cos(a) * len / 24; y += Math.sin(a) * len / 24; pts.push([x, y, a]); }
      c.strokeStyle = '#3c2a22'; c.lineWidth = 0.9 * u; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0, y0); for (const p of pts) c.lineTo(p[0], p[1]); c.stroke();
      for (let i = 1; i < pts.length; i += 2) { const [px, py, pa] = pts[i], sd = i % 4 ? 1 : -1, na = pa + sd * 1.2; poly(c, [px + Math.cos(pa) * 0.6 * u, py + Math.sin(pa) * 0.6 * u, px + Math.cos(na) * 2 * u, py + Math.sin(na) * 2 * u, px - Math.cos(pa) * 0.6 * u, py - Math.sin(pa) * 0.6 * u], '#5a3c2e'); }
      for (let i = 3; i < pts.length; i += 5) { const [px, py, pa] = pts[i]; ell(c, px + Math.cos(pa + 1.6) * 1.8 * u, py + Math.sin(pa + 1.6) * 1.8 * u, 1.5 * u, 0.7 * u, '#2f6a2c', pa + 0.6); }
      if (R() < 0.7) circle(c, pts[12][0], pts[12][1] + 1.6 * u, 0.9 * u, '#5a1f3a');
    };
    for (let i = 0; i < W / u / 7; i++) { const x = R() * W, y = lerp(f(x), gy + 4 * u, R()); bram(x, y, R.r(14, 26) * u, -Math.PI / 2 + R.r(-1, 1), R.r(-2, 2)); }
    for (const [x, y, a] of [[0, H * 0.1, 0.4], [W, H * 0.14, Math.PI - 0.4], [0, H * 0.3, -0.2], [W, H * 0.35, Math.PI + 0.2]]) bram(x, y, 26 * u, a, a > 1.5 ? -1.5 : 1.5);
    grassTufts(c, W, (x) => f(x) + B * 0.3, '#2f5a34', 2 * u, R, 0.2 / u);
  },
};

// 6 ------------------------------------------------ Mushroom Glade (night)
ART.mushroom = {
  veil: ['#140d30', 0.3],
  sky(c, S) {
    const { W, H, u, R, hz } = S;
    rect(c, 0, 0, W, H, vg(c, 0, hz, [[0, '#0d0b2a'], [0.6, '#24215a'], [1, '#2d5a73']]));
    glow(c, W * 0.15, H * 0.25, 50 * u, '#3fd0c0', 0.12); glow(c, W * 0.85, H * 0.4, 45 * u, '#ff5fa8', 0.1);
    stars(c, W, H, 140, R, hz * 0.9);
    moon(c, W * 0.82, H * 0.1, 4.5 * u, '#eef2ff', '#9fb4ff', '#8fa0d0');
  },
  far(c, S) {
    const { W, H, u, R, hz } = S;
    const f1 = waveFn(R, hz - 3 * u, 5 * u, 60 * u); fillFn(c, W, H, f1, '#1f2c52');
    for (let x = 0; x < W; x += R.r(3, 7) * u) roundTree(c, x, f1(x) + 2 * u, R.r(7, 13) * u, '#1a2547', '#1d2a50', '#22305a', R);
    const f2 = waveFn(R, S.by(0.1), 2 * u, 45 * u); fillFn(c, W, H, f2, '#192447');
    for (let i = 0; i < 9; i++) { const x = R() * W; mush(c, x, f2(x) + 1.5 * u, R.r(3, 5.5) * u, R.pick(MUSH), R, u, 0.7); }
  },
  near(c, S) {
    const { W, H, u, R, gy } = S, B = gy - S.hz;
    const f3 = waveFn(R, S.by(0.4), 1.5 * u, 70 * u); fillFn(c, W, H, f3, vg(c, S.by(0.3), H, [[0, '#17213f'], [1, '#0d1328']]));
    const big = S.port ? 1 : 1.2;
    for (const [x, s, k, dy] of [[0.07, 26, 0, 4], [0.21, 12, 1, 2], [0.93, 22, 1, 4], [0.8, 10, 2, 2]]) { glow(c, W * x, gy, s * u * big * 1.4, MUSH[k][0], 0.18); mush(c, W * x, gy + dy * u, s * u * big, MUSH[k], R, u, 1); }
    for (let i = 0; i < 10; i++) { const x = R() * W; mush(c, x, lerp(f3(x) + B * 0.1, gy + 2 * u, R()), R.r(2, 3.5) * u, R.pick(MUSH), R, u, 1); }
    grassTufts(c, W, (x) => f3(x) + B * 0.1, '#22305a', 2.5 * u, R, 0.25 / u);
  },
};
const MUSH = [['#ff5fa8', '#ff9fd0', '#ffd6ec'], ['#3fe0d0', '#9ff7ee', '#e0fffb'], ['#b77bff', '#d7b4ff', '#f1e4ff']];
function mush(c, x, y, s, cols, R, u, g) {
  const [cap, lit, spot] = cols;
  if (g) glow(c, x, y - s * 0.9, s * 2.2, cap, 0.34 * g);
  const sw = s * 0.15, bend = s * 0.06;
  c.beginPath(); c.moveTo(x - sw * 1.2, y); c.quadraticCurveTo(x - sw * 0.6 + bend, y - s * 0.45, x - sw * 0.7, y - s * 0.85); c.lineTo(x + sw * 0.7, y - s * 0.85); c.quadraticCurveTo(x + sw + bend, y - s * 0.45, x + sw * 1.3, y); c.closePath(); c.fillStyle = '#b9b0dc'; c.fill();
  c.beginPath(); c.moveTo(x - sw * 1.2, y); c.quadraticCurveTo(x - sw * 0.6 + bend, y - s * 0.45, x - sw * 0.7, y - s * 0.85); c.lineTo(x - sw * 0.1, y - s * 0.85); c.quadraticCurveTo(x - sw * 0.1 + bend, y - s * 0.45, x - sw * 0.2, y); c.closePath(); c.fillStyle = '#e4def5'; c.fill();
  ell(c, x, y - s * 0.85, sw * 1.6, s * 0.05, rgba(cap, 0.5));
  c.beginPath(); c.ellipse(x, y - s * 0.82, s * 0.62, s * 0.5, 0, Math.PI, 0); c.closePath(); c.fillStyle = cap; c.fill();
  c.beginPath(); c.ellipse(x - s * 0.1, y - s * 0.86, s * 0.45, s * 0.4, 0, Math.PI, 1.8 * Math.PI); c.closePath(); c.fillStyle = lit; c.fill();
  ell(c, x, y - s * 0.82, s * 0.62, s * 0.07, shade(cap, -0.35));
  for (let i = 0; i < 4; i++) ell(c, x + (i - 1.5) * s * 0.26, y - s * (1.0 + (i % 2) * 0.12), s * 0.07, s * 0.05, spot);
}

// 7 ------------------------------------------------ Crystal Cave
ART.crystal = {
  veil: ['#1a0f33', 0.32],
  spark: '#7ff7ec',
  sky(c, S) {
    const { W, H, u, R } = S;
    rect(c, 0, 0, W, H, vg(c, 0, H, [[0, '#120a26'], [0.5, '#2a1a4e'], [1, '#160d2c']]));
    glow(c, W * 0.5, H * 0.55, Math.max(W, H) * 0.6, '#3c6f8a', 0.35);
    for (let i = 0; i < 18; i++) { const x = R() * W, w = R.r(6, 14) * u; poly(c, [x - w, H, x - w * 0.5, R.r(0.1, 0.4) * H, x + w * 0.4, R.r(0.1, 0.4) * H, x + w, H], rgba('#3a2766', 0.5)); }
  },
  far(c, S) {
    const { W, H, u, R, hz } = S;
    const f = waveFn(R, hz + 2 * u, 3 * u, 40 * u); fillFn(c, W, H, f, '#24173f');
    for (let i = 0; i < 7; i++) { const x = R() * W; crystals(c, x, f(x) + 2 * u, R.r(4, 8) * u, R.pick(CRY), R, 0.5); }
    for (let x = -2 * u; x < W + 4 * u; x += R.r(2.5, 6) * u) { const e = 0.5 + Math.abs(x / W - 0.5) * 1.4, L = R.r(6, 18) * u * e; stal(c, x, -1, R.r(1.5, 3.2) * u * e, L, '#2a1b4a', '#3d2a68'); }
    rect(c, 0, 0, W, 3 * u, '#1d1236');
  },
  near(c, S) {
    const { W, H, u, R, gy } = S;
    // cave walls framing the sides
    for (const sd of [-1, 1]) {
      const x0 = sd < 0 ? 0 : W, d = (S.port ? 7 : 12) * u; c.beginPath(); c.moveTo(x0, 0);
      for (let y = 0; y <= H + 5 * u; y += 5 * u) c.lineTo(x0 - sd * (d + Math.sin(y / u * 0.21) * 2.5 * u + R.r(-1, 1) * u + (y < H * 0.2 ? (H * 0.2 - y) * 0.25 : 0)), y);
      c.lineTo(x0, H + 5 * u); c.closePath(); c.fillStyle = '#140b28'; c.fill(); c.strokeStyle = 'rgba(80,220,210,0.25)'; c.lineWidth = 0.5 * u; c.stroke();
    }
    const f = waveFn(R, S.by(0.4), 1.5 * u, 55 * u); fillFn(c, W, H, f, vg(c, S.by(0.3), H, [[0, '#2b1c4c'], [1, '#150c28']]));
    for (let x = -2 * u; x < W; x += R.r(6, 14) * u) stal(c, x, f(x) + 2 * u, R.r(1.5, 3) * u, -R.r(4, 9) * u, '#2a1b4a', '#3a2864');
    const big = S.port ? 1 : 1.25;
    crystals(c, W * 0.06, gy + 4 * u, 20 * u * big, CRY[0], R, 1);
    crystals(c, W * 0.94, gy + 4 * u, 17 * u * big, CRY[1], R, 1);
    crystals(c, W * 0.24, gy + 2 * u, 6 * u * big, CRY[1], R, 1);
    crystals(c, W * 0.75, gy + 2 * u, 7 * u * big, CRY[0], R, 1);
    for (const [x, s] of [[W * 0.03, 1.4], [W * 0.13, 0.9], [W * 0.88, 1.1], [W * 0.98, 1.5]]) stal(c, x, -1, 5 * u * s, 24 * u * s * (S.port ? 0.8 : 1), '#1d1236', '#2d1d52');
    crystals(c, W * 0.09, 4 * u, 8 * u, CRY[1], R, 1, true);
    crystals(c, W * 0.91, 4 * u, 7 * u, CRY[0], R, 1, true);
  },
};
const CRY = [['#3ee6d6', '#a8fff5', '#1f8f9a'], ['#b86cff', '#e2c4ff', '#6b33b0']];
function stal(c, x, y, w, L, col, lit) { poly(c, [x - w, y, x + w, y, x + w * 0.1, y + L], col); poly(c, [x - w, y, x - w * 0.2, y, x + w * 0.05, y + L * 0.97], lit); }
function crystals(c, x, y, s, cols, R, g, down) {
  const [base, light, dark] = cols, d = down ? -1 : 1;
  if (g) glow(c, x, y - d * s * 0.6, s * 2.4, base, 0.32 * g);
  for (let i = 0; i < 5; i++) {
    const a = (i - 2) * 0.32 + R.r(-0.1, 0.1), L = s * R.r(0.55, 1.1) * (i === 2 ? 1.25 : 1), w = s * R.r(0.13, 0.2);
    const ca = Math.sin(a), cb = -Math.cos(a) * d, bx = x + (i - 2) * s * 0.12, tx = bx + ca * L, ty = y + cb * L, px = -cb, py = ca, tp = 0.75;
    poly(c, [bx + px * w, y + py * w, bx + ca * L * tp + px * w, y + cb * L * tp + py * w, tx, ty, bx + ca * L * tp, y + cb * L * tp, bx, y], g ? base : shade(base, -0.4));
    poly(c, [bx - px * w, y - py * w, bx + ca * L * tp - px * w, y + cb * L * tp - py * w, tx, ty, bx + ca * L * tp, y + cb * L * tp, bx, y], g ? light : shade(light, -0.35));
    poly(c, [bx + px * w, y + py * w, bx + ca * L * tp + px * w, y + cb * L * tp + py * w, tx, ty, bx + ca * L * tp + px * w * 0.4, y + cb * L * tp + py * w * 0.4], g ? dark : shade(dark, -0.3));
  }
}

// 8 ------------------------------------------------ Frozen Lake
ART.frozen = {
  veil: ['#4a78a8', 0.22],
  sky(c, S) {
    const { W, H, u, hz } = S;
    rect(c, 0, 0, W, H, vg(c, 0, hz, [[0, '#7fb6e3'], [0.7, '#c4e2f4'], [1, '#eef8fc']]));
    sun(c, W * 0.2, H * 0.13, 4.5 * u, '#fffbe8', '#ffffff');
  },
  far(c, S) {
    const { W, H, u, R, hz } = S, k = S.port ? 0.75 : 1;
    mountains(c, W, hz + 1 * u, 6, 16 * u * k, 30 * u * k, '#b9d2e8', '#8eaecd', ['#ffffff', '#d3e2f0'], R);
    mountains(c, W, hz + 1 * u, 8, 7 * u * k, 13 * u * k, '#9dbad6', '#7d9cbd', ['#f4f9fd', '#c4d6e8'], R);
    const sh = hz + 1 * u;
    rect(c, 0, sh, W, H, vg(c, sh, S.gy, [[0, '#a8cfe4'], [0.25, '#c6e3f1'], [1, '#93c3dd']]));
    for (let x = -2 * u; x < W + 2 * u; x += R.r(1.4, 2.6) * u) pine(c, x, sh + R.r(0, 1) * u, R.r(5, 9) * u, '#3d6a7c', '#557f90', '#e8f3fa');
    rect(c, 0, sh + 0.5 * u, W, 3 * u, vg(c, sh, sh + 3.5 * u, [[0, 'rgba(61,106,124,0.35)'], [1, 'rgba(61,106,124,0)']]));
    for (let i = 0; i < 16; i++) { const y = lerp(sh + 4 * u, S.gy, R()), x = R() * W; rect(c, x, y, R.r(8, 30) * u, 0.35 * u, 'rgba(255,255,255,0.65)'); }
    c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 0.3 * u;
    for (let i = 0; i < 6; i++) { let x = R() * W, y = lerp(sh + 6 * u, S.gy, R()); c.beginPath(); c.moveTo(x, y); for (let k2 = 0; k2 < 5; k2++) { x += R.r(-5, 5) * u; y += R.r(-1, 2) * u; c.lineTo(x, y); } c.stroke(); }
  },
  near(c, S) {
    const { W, H, u, gy } = S, big = S.port ? 1 : 1.2;
    for (const sd of [-1, 1]) {
      const x0 = sd < 0 ? 0 : W, ww = W * (S.port ? 0.4 : 0.26), f = (x) => gy - 4 * u - Math.pow(1 - clamp(Math.abs(x - x0) / ww, 0, 1), 1.5) * 18 * u;
      c.beginPath(); c.moveTo(x0, H); for (let k = 0; k <= 1.001; k += 0.04) { const x = x0 - sd * k * ww; c.lineTo(x, f(x)); } c.lineTo(x0 - sd * ww, H); c.closePath(); c.fillStyle = vg(c, gy - 22 * u, gy, [[0, '#ffffff'], [1, '#d4e7f3']]); c.fill();
      for (const [dx, s] of [[1, 44], [9, 28], [17, 17]]) pine(c, x0 - sd * dx * u, f(x0 - sd * dx * u) + 3 * u, s * u * big, '#2c5768', '#3f7387', '#f4fbff', '#3a3030');
    }
  },
};

// 9 ------------------------------------------------ Pine Blizzard
ART.blizzard = {
  veil: ['#33445c', 0.3],
  sky(c, S) {
    const { W, H, u, R, hz } = S, k = S.port ? 0.75 : 1;
    rect(c, 0, 0, W, H, vg(c, 0, hz, [[0, '#5b6c86'], [0.6, '#8a9ab0'], [1, '#b8c4d2']]));
    for (let i = 0; i < 3; i++) {
      const col = mix('#aab7c8', '#6f7f95', i * 0.4);
      mountains(c, W, hz + (2 + i * 3) * u, 5 + i * 2, (22 - i * 6) * u * k, (36 - i * 9) * u * k, col, shade(col, -0.12), [mix('#f2f5f9', col, 0.25), mix('#cbd5e1', col, 0.3)], R);
      rect(c, 0, 0, W, H, 'rgba(196,206,220,0.38)');
    }
  },
  far(c, S) {
    const { W, H, u, R, hz } = S;
    const f = waveFn(R, S.by(0.08), 2 * u, 60 * u); fillFn(c, W, H, f, '#c4ceda');
    for (let x = -2 * u; x < W; x += R.r(2, 4) * u) pine(c, x, f(x) + 2 * u, R.r(7, 12) * u, '#5f7088', '#6e7f96', '#dfe6ee');
    rect(c, 0, 0, W, H, 'rgba(190,202,218,0.4)');
    for (let i = 0; i < 10; i++) { const y = R() * H, x = R() * W; c.fillStyle = grad(c, x, 0, x + 60 * u, 0, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,0.16)'], [1, 'rgba(255,255,255,0)']]); c.fillRect(x, y, 60 * u, R.r(1, 3) * u); }
  },
  near(c, S) {
    const { W, H, u, R, gy } = S;
    const f = waveFn(R, S.by(0.4), 2 * u, 70 * u); fillFn(c, W, H, f, vg(c, S.by(0.3), H, [[0, '#eef2f7'], [1, '#c2cddb']]));
    const big = S.port ? 1 : 1.2;
    for (const [x, s] of [[0.02, 48], [0.11, 30], [0.98, 42], [0.88, 24]]) pine(c, W * x, gy + 4 * u, s * u * big, '#34435a', '#46566e', '#f1f5fa', '#2c2a2c');
    for (let i = 0; i < 6; i++) { const x = R() * W; rect(c, x, lerp(f(x), gy, R()), R.r(10, 25) * u, 0.4 * u, 'rgba(160,175,195,0.5)'); }
  },
};

// 10 ----------------------------------------------- Desert Dunes
ART.dunes = {
  veil: ['#9c5a3a', 0.16],
  sky(c, S) {
    const { W, H, u, hz } = S;
    rect(c, 0, 0, W, H, vg(c, 0, hz, [[0, '#2f86c9'], [0.5, '#7fb8d6'], [0.8, '#f2d59a'], [1, '#ffd98e']]));
    sun(c, W * 0.8, H * 0.12, 6.5 * u, '#fff1b0', '#fff1b8');
  },
  far(c, S) {
    const { W, H, u, R, hz } = S;
    const f0 = waveFn(R, hz - 1 * u, 1.5 * u, 90 * u); fillFn(c, W, H, f0, '#efc78f');
    const px = W * (S.port ? 0.26 : 0.18), py = f0(px) + 1.5 * u, ps = S.port ? 15 * u : 17 * u;
    for (const [dx, k] of [[0, 1], [ps * 1.3, 0.6], [-ps * 0.95, 0.42]]) { const x = px + dx, s = ps * k; poly(c, [x - s, py, x, py - s * 0.95, x + s, py], '#e8b77a'); poly(c, [x, py - s * 0.95, x + s, py, x + s * 0.15, py], '#cc9660'); }
    dunes(c, W, H, hz + 4 * u, 4 * u, S.port ? 2 : 4, '#f3bd75', '#dd9d5c', 'rgba(255,240,205,0.6)', R);
  },
  near(c, S) {
    const { W, H, u, R, gy } = S, B = gy - S.hz;
    dunes(c, W, H, S.by(0.32), B * 0.22, S.port ? 2 : 3, '#f2ac5e', '#d1813f', 'rgba(255,236,190,0.7)', R);
    dunes(c, W, H, S.by(0.72), B * 0.26, S.port ? 2 : 3, '#eea052', '#c9733a', 'rgba(255,230,180,0.7)', R);
    c.strokeStyle = 'rgba(150,80,35,0.16)'; c.lineWidth = 0.35 * u;
    for (let i = 0; i < 26; i++) { const x = R() * W, y = lerp(S.by(0.45), gy, R()); c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 4 * u, y - 1 * u, x + 9 * u, y); c.stroke(); }
  },
};

// shared animated helpers ----------------------------------------------------------------
function fogStrip(S, col, a, hgt) {
  const { W, R, dpr } = S, w = W;
  return sprite(dpr, w, hgt, (c) => { for (let x = -hgt * 0.5; x < w + hgt * 0.5; x += hgt * 0.45) { const r = hgt * R.r(0.35, 0.55), y = hgt * R.r(0.45, 0.6); const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0)); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); } });
}
function driftStrip(ctx, sp, x, y, a) { // seamless-ish horizontal drift of a full-width strip
  const w = sp.w; x = wrap(x, w); ctx.globalAlpha = a; ctx.drawImage(sp.cv, x - w, y, w, sp.h); ctx.drawImage(sp.cv, x, y, w, sp.h); ctx.globalAlpha = 1;
}
function gearSprite(dpr, r, teeth, col, dark, light) {
  return sprite(dpr, r * 2.4, r * 2.4, (c, w) => {
    const o = w / 2; c.beginPath();
    for (let i = 0; i < teeth * 2; i++) { const a0 = i / (teeth * 2) * TAU, a1 = (i + 1) / (teeth * 2) * TAU, rr = i % 2 ? r : r * 1.13; c.arc(o, o, rr, a0, a1); }
    c.closePath(); c.fillStyle = col; c.fill();
    circle(c, o, o, r * 0.74, dark);
    c.save(); c.translate(o, o); for (let k = 0; k < 5; k++) { c.rotate(TAU / 5); rect(c, -r * 0.08, 0, r * 0.16, r * 0.76, col); } c.restore();
    circle(c, o, o, r * 0.26, col); circle(c, o, o, r * 0.1, dark);
    c.beginPath(); c.arc(o, o, r * 0.94, Math.PI * 0.9, Math.PI * 1.6); c.strokeStyle = light; c.lineWidth = r * 0.05; c.stroke();
  });
}
function spin(ctx, sp, x, y, a) { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.drawImage(sp.cv, -sp.w / 2, -sp.h / 2, sp.w, sp.h); ctx.restore(); }
function flame(ctx, x, y, s, t, k) {
  const f = 1 + 0.18 * Math.sin(t * 13 + k) + 0.1 * Math.sin(t * 23 + k * 2), sw = Math.sin(t * 7 + k) * 0.15 * s;
  const tear = (w, h, col) => { ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x - w, y - h * 0.5, x + sw, y - h); ctx.quadraticCurveTo(x + w, y - h * 0.5, x + w, y); ctx.quadraticCurveTo(x, y + w * 0.8, x - w, y); ctx.fillStyle = col; ctx.fill(); };
  tear(s * 0.55, s * 2 * f, '#ff7a1a'); tear(s * 0.36, s * 1.4 * f, '#ffc23a'); tear(s * 0.18, s * 0.8 * f, '#fff3c0');
}
function torchStatic(c, x, y, u) { glow(c, x, y - 3 * u, 30 * u, '#ff9a3a', 0.35); poly(c, [x - 1.6 * u, y - 1 * u, x + 1.6 * u, y - 1 * u, x + 0.7 * u, y + 5 * u, x - 0.7 * u, y + 5 * u], '#3a2412'); rect(c, x - 2 * u, y - 1.6 * u, 4 * u, 1 * u, '#c8963e'); rect(c, x - 0.5 * u, y + 5 * u, 1 * u, 3 * u, '#2a1a0c'); }
function coinPile(c, x, y, w, h, R, u, dim = 0) {
  c.beginPath(); c.moveTo(x - w, y); c.quadraticCurveTo(x - w * 0.5, y - h * 1.05, x, y - h); c.quadraticCurveTo(x + w * 0.5, y - h * 1.05, x + w, y); c.closePath();
  c.fillStyle = vg(c, y - h, y, [[0, '#ffd75a'], [0.5, '#e0a52a'], [1, '#9a6512']]); c.fill();
  c.save(); c.clip();
  for (let i = 0; i < w * h / (u * u) * 0.5; i++) { const px = x + R.r(-1, 1) * w, py = y - R() * h; ell(c, px, py, 1.3 * u, 0.6 * u, R() < 0.5 ? '#f6cc4a' : '#c58b1c'); ell(c, px - 0.2 * u, py - 0.2 * u, 0.8 * u, 0.3 * u, 'rgba(255,245,190,0.75)'); }
  if (dim) rect(c, x - w, y - h * 1.1, w * 2, h * 1.1, rgba('#1c0e04', dim));
  c.restore();
  if (!dim) for (let i = 0; i < 3; i++) { const px = x + R.r(-0.5, 0.5) * w, py = y - h * R.r(0.4, 0.85); twinkle(c, px, py, 1.4 * u); }
}
function twinkle(c, x, y, s) { glow(c, x, y, s * 1.6, '#fff4c0', 0.5); poly(c, [x, y - s, x + s * 0.18, y - s * 0.18, x + s, y, x + s * 0.18, y + s * 0.18, x, y + s, x - s * 0.18, y + s * 0.18, x - s, y, x - s * 0.18, y - s * 0.18], 'rgba(255,255,240,0.9)'); }
function rockPile(c, x, y, s, col, lit, R) { for (let i = 0; i < 4; i++) { const rx = x + R.r(-1, 1) * s, rw = s * R.r(0.5, 0.9), rh = rw * R.r(0.5, 0.8); poly(c, [rx - rw, y, rx - rw * 0.7, y - rh * 0.8, rx - rw * 0.1, y - rh, rx + rw * 0.6, y - rh * 0.7, rx + rw, y], col); poly(c, [rx - rw, y, rx - rw * 0.7, y - rh * 0.8, rx - rw * 0.1, y - rh, rx - rw * 0.2, y], lit); } }

// 11 ----------------------------------------------- Pyramid Tomb
ART.tomb = {
  veil: ['#1e1209', 0.36],
  dust: '#ffd9a0',
  prep(S) { S.gl = sprite(S.dpr, 40 * S.u, 40 * S.u, (c, w) => glow(c, w / 2, w / 2, w / 2, '#ffa040', 0.6)); },
  sky(c, S) {
    const { W, H, u, R } = S;
    rect(c, 0, 0, W, H, vg(c, 0, H, [[0, '#2c1a0e'], [0.5, '#4e321b'], [1, '#2e1c0f']]));
    const bh = 6 * u;
    for (let r = 0; r * bh < H; r++) for (let x = -(r % 2) * 7 * u; x < W; x += 14 * u) { const k = R.r(-0.06, 0.06); rect(c, x + 0.3 * u, r * bh + 0.3 * u, 13.4 * u, bh - 0.6 * u, rgba(k > 0 ? '#e8b878' : '#000000', Math.abs(k) + 0.04)); rect(c, x + 0.3 * u, r * bh + 0.3 * u, 13.4 * u, 0.4 * u, 'rgba(255,210,150,0.07)'); }
    // hieroglyph bands top & bottom
    for (const y of [H * 0.07, S.port ? H * 0.2 : H * 0.8]) {
      rect(c, 0, y - 4 * u, W, 8 * u, 'rgba(120,80,40,0.35)'); rect(c, 0, y - 4.4 * u, W, 0.5 * u, '#8a6a3a'); rect(c, 0, y + 4 * u, W, 0.5 * u, '#8a6a3a');
      for (let x = 3 * u; x < W; x += 5 * u) glyph(c, x, y, 2.6 * u, R.i(0, 6), '#2a180a', 'rgba(255,214,150,0.25)');
    }
  },
  far(c, S) {
    const { W, H, u, R } = S;
    const pil = (x, w) => {
      rect(c, x - w, 0, w * 2, H, vg(c, 0, H, [[0, '#7a5530'], [1, '#5a3c20']])); rect(c, x - w, 0, w * 0.6, H, 'rgba(255,220,160,0.14)'); rect(c, x + w * 0.6, 0, w * 0.4, H, 'rgba(0,0,0,0.25)');
      for (let y = H * 0.18; y < H; y += H * 0.16) { rect(c, x - w, y, w * 2, 1.4 * u, '#2f8a8a'); rect(c, x - w, y + 1.4 * u, w * 2, 0.7 * u, '#c8963e'); rect(c, x - w, y + 2.1 * u, w * 2, 1 * u, '#a83a2a'); }
      for (let y = H * 0.25; y < H * 0.9; y += 6 * u) glyph(c, x, y, w * 0.55, R.i(0, 6), '#3a2410', 'rgba(255,214,150,0.2)');
      poly(c, [x - w * 1.4, H * 0.06, x + w * 1.4, H * 0.06, x + w, H * 0.12, x - w, H * 0.12], '#8a6236');
    };
    const xs = S.port ? [W * 0.04, W * 0.96] : [W * 0.07, W * 0.93];
    for (const x of xs) pil(x, (S.port ? 5 : 6) * u);
    S.torch = S.port ? [[W * 0.16, H * 0.23], [W * 0.84, H * 0.23]] : [[W * 0.17, H * 0.4], [W * 0.83, H * 0.4]];
    for (const [x, y] of S.torch) torchStatic(c, x, y, u);
  },
  near(c, S) {
    const { W, H, u, R, gy } = S;
    rect(c, 0, gy - 3 * u, W, H, vg(c, gy - 3 * u, H, [[0, '#6a4626'], [1, '#3a2412']]));
    for (const [x, w, h] of [[W * 0.02, 22, 14], [W * 0.98, 18, 12], [W * 0.18, 10, 6], [W * 0.82, 12, 7]]) coinPile(c, x, gy + 2 * u, w * u, h * u, R, u);
    // urns
    for (const [x, s] of [[W * 0.11, 1.2], [W * 0.9, 1]]) { const y = gy - 2 * u; ell(c, x, y - 5 * s * u, 3.6 * s * u, 4.5 * s * u, '#2f8a8a'); ell(c, x - 1 * s * u, y - 6 * s * u, 1.6 * s * u, 3 * s * u, '#4fb0aa'); rect(c, x - 1.6 * s * u, y - 11.5 * s * u, 3.2 * s * u, 2.5 * s * u, '#c8963e'); rect(c, x - 3 * s * u, y - 5.5 * s * u, 6 * s * u, 0.8 * s * u, '#c8963e'); }
  },
  front(ctx, t, S) {
    S.tf(ctx, 0.4); const u = S.u;
    S.torch.forEach(([x, y], i) => { ctx.globalAlpha = 0.5 + 0.18 * Math.sin(t * 9 + i * 3) + 0.1 * Math.sin(t * 17 + i); blit(ctx, S.gl, x, y - 3 * u); ctx.globalAlpha = 1; flame(ctx, x, y - 1.4 * u, 1.8 * u, t, i * 2.3); });
    ctx.restore();
  },
};
function glyph(c, x, y, s, k, col, hl) {
  const g = (dx, dy, f) => { c.save(); c.translate(x + dx, y + dy); f(); c.restore(); };
  for (const [dx, dy, cc] of [[-0.06 * s, -0.08 * s, hl], [0, 0, col]]) g(dx, dy, () => {
    c.fillStyle = cc; c.strokeStyle = cc; c.lineWidth = s * 0.14; c.lineCap = 'round';
    if (k === 0) { c.beginPath(); c.ellipse(0, 0, s * 0.55, s * 0.25, 0, 0, TAU); c.stroke(); circle(c, 0, 0, s * 0.15, cc); c.beginPath(); c.moveTo(-s * 0.1, s * 0.25); c.lineTo(-s * 0.3, s * 0.6); c.stroke(); }
    else if (k === 1) { c.beginPath(); c.arc(0, -s * 0.4, s * 0.22, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(0, -s * 0.18); c.lineTo(0, s * 0.6); c.moveTo(-s * 0.35, 0); c.lineTo(s * 0.35, 0); c.stroke(); }
    else if (k === 2) { c.beginPath(); for (let i = 0; i < 3; i++) { c.moveTo(-s * 0.5, (i - 1) * s * 0.3); for (let j = 0; j <= 4; j++) c.lineTo(-s * 0.5 + j * s * 0.25, (i - 1) * s * 0.3 + (j % 2 ? -1 : 1) * s * 0.1); } c.stroke(); }
    else if (k === 3) { ell(c, 0, s * 0.05, s * 0.4, s * 0.25, cc); circle(c, s * 0.35, -s * 0.25, s * 0.16, cc); poly(c, [-s * 0.35, s * 0.05, -s * 0.65, -s * 0.15, -s * 0.6, s * 0.2], cc); c.beginPath(); c.moveTo(0, s * 0.3); c.lineTo(0, s * 0.6); c.stroke(); }
    else if (k === 4) { circle(c, 0, -s * 0.2, s * 0.3, cc); poly(c, [-s * 0.45, s * 0.5, 0, s * 0.05, s * 0.45, s * 0.5], cc); }
    else { c.beginPath(); c.moveTo(-s * 0.2, s * 0.6); c.lineTo(-s * 0.2, -s * 0.5); c.moveTo(s * 0.2, s * 0.6); c.lineTo(s * 0.2, -s * 0.3); c.stroke(); ell(c, -s * 0.2, -s * 0.55, s * 0.15, s * 0.2, cc); }
  });
}

// 12 ----------------------------------------------- Jungle Ruins
ART.jungle = {
  veil: ['#0c2a1a', 0.34],
  leaves: ['#3f8a3a', '#6aa83e', '#2d6a32', '#9aba4a'],
  prep(S) { S.mist = fogStrip(S, '#d8f0d0', 0.35, 26 * S.u); },
  sky(c, S) {
    const { W, H, u, R, hz } = S;
    rect(c, 0, 0, W, H, vg(c, 0, H, [[0, '#c9e3a0'], [0.3, '#7fb070'], [0.65, '#3d7a4e'], [1, '#1d4a30']]));
    glow(c, W * 0.45, 0, 70 * u, '#f6ffd8', 0.5);
    for (let k = 0; k < 2; k++) { const f = waveFn(R, hz - (14 - k * 8) * u, 6 * u, 30 * u), col = k ? '#5d9a68' : '#8cbf88'; fillFn(c, W, H, f, col); for (let x = 0; x < W; x += 4 * u) circle(c, x, f(x) + 1 * u, R.r(3, 6) * u, col); }
  },
  far(c, S) {
    const { W, H, u, R, hz } = S;
    const tx = W * (S.port ? 0.72 : 0.76), ty = hz + 2 * u, tw = (S.port ? 22 : 26) * u;
    for (let i = 0; i < 5; i++) { const w = tw * (1 - i * 0.17), y = ty - i * 4.2 * u; rect(c, tx - w, y - 4.2 * u, w * 2, 4.2 * u, '#6f8a76'); rect(c, tx - w, y - 4.2 * u, w * 2, 0.8 * u, '#93ad96'); rect(c, tx + w * 0.55, y - 4.2 * u, w * 0.45, 4.2 * u, 'rgba(30,60,40,0.25)'); }
    rect(c, tx - 3 * u, ty - 21 * u - 7 * u, 6 * u, 7 * u, '#6f8a76'); rect(c, tx - 1.2 * u, ty - 25 * u, 2.4 * u, 4 * u, '#2f4a36');
    poly(c, [tx - 4 * u, ty - 28 * u, tx, ty - 31 * u, tx + 4 * u, ty - 28 * u], '#5d7864');
    poly(c, [tx - 3 * u, ty, tx + 3 * u, ty, tx + 1.8 * u, ty - 21 * u, tx - 1.8 * u, ty - 21 * u], '#5d7864');
    for (let i = 0; i < 18; i++) { const x = tx + R.r(-1, 1) * tw, y = ty - R() * 20 * u; if (Math.abs(x - tx) < tw * (1 - (ty - y) / (24 * u))) ell(c, x, y, R.r(1.5, 3.5) * u, R.r(0.8, 1.6) * u, '#4f7a46'); }
    const f = waveFn(R, hz + 3 * u, 3 * u, 25 * u); fillFn(c, W, H, f, '#2f6a40');
    for (let x = 0; x < W; x += 3.5 * u) circle(c, x, f(x) + 1 * u, R.r(2.5, 5) * u, '#2f6a40');
    rect(c, 0, hz - 10 * u, W, 16 * u, vg(c, hz - 10 * u, hz + 6 * u, [[0, 'rgba(220,240,210,0)'], [0.6, 'rgba(220,240,210,0.35)'], [1, 'rgba(220,240,210,0)']]));
  },
  mid(ctx, t, S) { S.tf(ctx, 0.6); driftStrip(ctx, S.mist, t * 4 * S.u, S.hz - 6 * S.u, 0.7); driftStrip(ctx, S.mist, -t * 2.5 * S.u + S.W * 0.4, S.by(0.25), 0.5); ctx.restore(); },
  near(c, S) {
    const { W, H, u, R, gy } = S;
    const f = waveFn(R, S.by(0.45), 1.5 * u, 50 * u); fillFn(c, W, H, f, vg(c, S.by(0.3), H, [[0, '#2a5a30'], [1, '#163a1e']]));
    // broken pillars
    for (const [x, h] of [[W * 0.16, 22], [W * 0.86, 14]]) { const ww = 3.5 * u; rect(c, x - ww, gy - h * u, ww * 2, h * u, '#7d8f7c'); rect(c, x - ww, gy - h * u, ww * 0.7, h * u, '#9aab97'); poly(c, [x - ww, gy - h * u, x - ww * 0.2, gy - (h + 2) * u, x + ww * 0.5, gy - (h - 1) * u, x + ww, gy - (h + 1) * u, x + ww, gy - h * u], '#7d8f7c'); ell(c, x, gy - h * u, ww * 1.2, 1.2 * u, '#4f8a3e'); }
    // hanging vines
    for (let i = 0; i < (S.port ? 7 : 12); i++) {
      const edge = i % 2 ? R.r(0, 0.22) : R.r(0.78, 1), x0 = W * edge, L = R.r(0.15, S.port ? 0.3 : 0.5) * H;
      c.strokeStyle = '#2d5a26'; c.lineWidth = 0.6 * u; c.beginPath(); c.moveTo(x0, -2); c.quadraticCurveTo(x0 + R.r(-6, 6) * u, L * 0.5, x0 + R.r(-3, 3) * u, L); c.stroke();
      for (let y = 4 * u; y < L; y += 3.5 * u) { const x = x0 + Math.sin(y / L * 2) * 2 * u, sd = (y / u | 0) % 2 ? 1 : -1; ell(c, x + sd * 1.2 * u, y, 1.6 * u, 0.8 * u, sd > 0 ? '#3f8a3a' : '#5aa842', sd * 0.6); }
    }
    // big foreground leaves
    const leaf = (x, y, L, a, col, lit) => { c.save(); c.translate(x, y); c.rotate(a); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(L * 0.5, -L * 0.32, L, 0); c.quadraticCurveTo(L * 0.5, L * 0.32, 0, 0); c.fillStyle = col; c.fill(); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(L * 0.5, -L * 0.32, L, 0); c.quadraticCurveTo(L * 0.5, -L * 0.05, 0, 0); c.fillStyle = lit; c.fill(); line(c, 0, 0, L * 0.95, 0, 'rgba(10,40,10,0.4)', L * 0.015); c.restore(); };
    for (const [x, sd] of [[0, 1], [W, -1]]) for (let k = 0; k < 6; k++) { const a = sd > 0 ? -0.2 - k * 0.28 : Math.PI + 0.2 + k * 0.28; leaf(x, gy + 6 * u, R.r(18, 30) * u, a, k % 2 ? '#1f5a26' : '#2b6e2c', k % 2 ? '#2f7a32' : '#3f8f38'); }
    for (const [x, sd] of [[0, 1], [W, -1]]) for (let k = 0; k < 3; k++) leaf(x, R.r(0.02, 0.12) * H, R.r(14, 22) * u, sd > 0 ? 0.3 + k * 0.35 : Math.PI - 0.3 - k * 0.35, '#1f5a26', '#2f7a32');
  },
};

// 13 ----------------------------------------------- Coral Reef
ART.reef = {
  veil: ['#06345a', 0.28],
  prep(S) {
    const { W, H, u, R, dpr } = S;
    S.ray = sprite(dpr, W, H, (c) => rays(c, W * 0.45, -H * 0.15, Math.PI / 2, 1.1, H * 1.1, 8, '#c8fbff', 0.2, R));
    S.fish = Array.from({ length: 7 }, (_, i) => ({ x: R(), y: R.r(0.12, 0.85), v: R.r(1.5, 4) * u * (i % 3 ? 1 : -1), s: R.r(1, 1.8) * u, c: R.pick(['#ffb03a', '#ff7a5a', '#ffe14d', '#5ad7ff']), p: R() * TAU }));
  },
  sky(c, S) {
    const { W, H, u, R } = S;
    rect(c, 0, 0, W, H, vg(c, 0, H, [[0, '#3fd0e0'], [0.35, '#1aa0c8'], [0.75, '#0d5f96'], [1, '#0a3f6e']]));
    for (let i = 0; i < 9; i++) ell(c, R() * W, R.r(0, 3) * u, R.r(10, 30) * u, R.r(0.6, 1.4) * u, 'rgba(230,255,255,0.4)');
  },
  back(ctx, t, S) { S.tf(ctx, 0.1); ctx.globalAlpha = 0.6 + 0.3 * Math.sin(t * 0.7); ctx.translate(Math.round(Math.sin(t * 0.4) * 3 * S.u), 0); ctx.drawImage(S.ray.cv, 0, 0, S.ray.w, S.ray.h); ctx.globalAlpha = 1; ctx.restore(); },
  far(c, S) {
    const { W, H, u, R, hz } = S;
    const f = ridgeFn(R, W, hz + 4 * u, 18 * u, 0.5); fillFn(c, W, H, f, '#13628f');
    for (let i = 0; i < 6; i++) { const x = R() * W; kelp(c, x, f(x) + 2 * u, R.r(20, 40) * u, '#147090', u, R); }
    for (let k = 0; k < 2; k++) { const sx = R.r(0.1, 0.9) * W, sy = R.r(0.1, 0.3) * H; for (let i = 0; i < 14; i++) fishShape(c, sx + R.r(-10, 10) * u, sy + R.r(-4, 4) * u, 0.7 * u, 'rgba(10,70,110,0.55)', 1); }
    const g = waveFn(R, S.by(0.15), 2 * u, 60 * u); fillFn(c, W, H, g, vg(c, S.by(0.1), S.gy, [[0, '#2a7e9a'], [1, '#c9b48a']]));
  },
  mid(ctx, t, S) {
    S.tf(ctx, 0.6);
    for (const f of S.fish) { const span = S.W + 20 * S.u, x = wrap(f.x * span + t * f.v, span) - 10 * S.u, y = f.y * S.H + Math.sin(t * 0.8 + f.p) * 2 * S.u; fishShape(ctx, x, y, f.s, f.c, f.v > 0 ? 1 : -1, Math.sin(t * 8 + f.p) * 0.25); }
    ctx.restore();
  },
  near(c, S) {
    const { W, H, u, R, gy } = S;
    const f = waveFn(R, S.by(0.55), 1.5 * u, 70 * u); fillFn(c, W, H, f, vg(c, S.by(0.4), H, [[0, '#d9c493'], [1, '#a88e5e']]));
    const big = S.port ? 1 : 1.2, cl = [['#ff6f91', '#ff9fb5'], ['#ff9a3c', '#ffc27a'], ['#b06cff', '#d4a8ff'], ['#ffd23f', '#ffe68a']];
    for (const [x, sd] of [[W * 0.02, 1], [W * 0.98, -1]]) {
      rockPile(c, x, gy + 4 * u, 12 * u * big, '#3d5f7a', '#557a96', R);
      fanCoral(c, x + sd * 4 * u, gy - 4 * u, 18 * u * big, cl[sd > 0 ? 2 : 0][0], R);
      branchCoral(c, x + sd * 12 * u, gy + 1 * u, 16 * u * big, cl[sd > 0 ? 0 : 1][0], R);
      brainCoral(c, x + sd * 21 * u, gy + 2 * u, 5 * u * big, cl[3][0], cl[3][1]);
      kelp(c, x + sd * 7 * u, gy + 2 * u, 34 * u * big, '#2a9a6a', u, R);
    }
    for (let i = 0; i < 8; i++) { const x = R() * W; brainCoral(c, x, lerp(f(x) + 2 * u, gy + 2 * u, R()), R.r(1.2, 2.5) * u, cl[i % 4][0], cl[i % 4][1]); }
  },
};
function fishShape(c, x, y, s, col, d, w = 0) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, s * 2, s * 1.05, 0, 0, TAU); c.fill(); c.beginPath(); c.moveTo(x - d * s * 1.6, y); c.lineTo(x - d * s * 3, y - s * (1 + w)); c.lineTo(x - d * s * 3, y + s * (1 - w)); c.closePath(); c.fill(); }
function kelp(c, x, y, L, col, u, R) { c.strokeStyle = col; c.lineCap = 'round'; c.lineWidth = 1.2 * u; const p = R() * TAU; c.beginPath(); c.moveTo(x, y); for (let k = 1; k <= 10; k++) c.lineTo(x + Math.sin(k * 0.7 + p) * 2.5 * u, y - L * k / 10); c.stroke(); for (let k = 2; k <= 10; k += 2) { const yy = y - L * k / 10, xx = x + Math.sin(k * 0.7 + p) * 2.5 * u; ell(c, xx + 1.6 * u * (k % 4 ? 1 : -1), yy, 2 * u, 0.8 * u, col, (k % 4 ? -0.5 : 0.5)); } }
function fanCoral(c, x, y, s, col, R) { c.save(); c.beginPath(); c.moveTo(x, y); c.arc(x, y, s, Math.PI * 1.08, Math.PI * 1.92); c.closePath(); c.fillStyle = rgba(col, 0.85); c.fill(); c.clip(); c.strokeStyle = shade(col, -0.25); c.lineWidth = s * 0.02; for (let k = 0; k < 14; k++) { const a = Math.PI * (1.08 + k / 13 * 0.84); c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s); c.stroke(); } for (let r = 0.3; r < 1; r += 0.18) { c.beginPath(); c.arc(x, y, s * r, Math.PI, TAU); c.stroke(); } c.restore(); }
function branchCoral(c, x, y, s, col, R) { c.strokeStyle = col; c.lineCap = 'round'; const br = (x0, y0, a, L, w, d) => { const x1 = x0 + Math.cos(a) * L, y1 = y0 + Math.sin(a) * L; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); if (d) { br(x1, y1, a - R.r(0.3, 0.6), L * 0.75, w * 0.8, d - 1); br(x1, y1, a + R.r(0.3, 0.6), L * 0.75, w * 0.8, d - 1); } else circle(c, x1, y1, w * 0.7, shade(col, 0.3)); }; br(x, y, -Math.PI / 2, s * 0.35, s * 0.09, 3); }
function brainCoral(c, x, y, r, col, lit) { c.beginPath(); c.ellipse(x, y, r * 1.3, r, 0, Math.PI, 0); c.fillStyle = col; c.fill(); c.beginPath(); c.ellipse(x - r * 0.2, y - r * 0.1, r * 0.9, r * 0.75, 0, Math.PI, 1.75 * Math.PI); c.fillStyle = lit; c.fill(); c.strokeStyle = shade(col, -0.25); c.lineWidth = r * 0.08; for (let k = 1; k < 4; k++) { c.beginPath(); c.ellipse(x, y, r * 1.3 * k / 4, r * k / 4, 0, Math.PI, 0); c.stroke(); } }

// 14 ----------------------------------------------- Pirate Cove
ART.cove = {
  veil: ['#081530', 0.3],
  fog: '#8fa8d0',
  sky(c, S) {
    const { W, H, u, R, hz } = S;
    rect(c, 0, 0, W, H, vg(c, 0, hz, [[0, '#070f2a'], [0.6, '#16306a'], [1, '#3a5a92']]));
    stars(c, W, H, 160, R, hz * 0.85);
    S.moon = [W * 0.8, H * 0.12]; moon(c, S.moon[0], S.moon[1], 6 * u, '#fff6dc', '#ffe9b0', '#c9b88a');
    for (let i = 0; i < 4; i++) { const x = R() * W, y = R.r(0.08, 0.35) * H; ell(c, x, y, R.r(15, 30) * u, 1.6 * u, 'rgba(120,150,210,0.25)'); ell(c, x + 4 * u, y - 1 * u, R.r(8, 16) * u, 1 * u, 'rgba(170,190,230,0.2)'); }
  },
  far(c, S) {
    const { W, H, u, R, hz } = S;
    const isl = ridgeFn(R, W, hz, 8 * u, 0.55); c.save(); c.beginPath(); c.rect(0, 0, W * 0.45, H); c.clip(); fillFn(c, W, H, isl, '#142a52'); c.restore();
    rect(c, 0, hz, W, H, vg(c, hz, S.gy, [[0, '#2a4a80'], [1, '#0f2350']]));
    for (let i = 0; i < 40; i++) { const y = lerp(hz + 1 * u, S.gy, R() ** 1.5), x = R() * W; rect(c, x, y, R.r(3, 10) * u * (y - hz) / (S.gy - hz + 1) + 1 * u, 0.25 * u, 'rgba(150,180,230,0.25)'); }
    glow(c, S.moon[0], hz + 6 * u, 26 * u, '#ffe9b0', 0.18);
    // shipwreck (right)
    const sx = W * (S.port ? 0.74 : 0.82), sy = hz + 3 * u, k = S.port ? 0.8 : 1;
    c.save(); c.translate(sx, sy); c.rotate(-0.12); c.scale(k * u, k * u);
    poly(c, [-16, 0, 14, 0, 18, -7, 9, -6, -12, -5, -18, -9], '#0c1a36');
    line(c, -2, -5, 3, -30, '#0c1a36', 1.2); line(c, 3, -24, 13, -21, '#0c1a36', 0.8); line(c, -3, -18, 9, -16, '#0c1a36', 0.7);
    poly(c, [3, -23, 12, -21, 10, -12, 6, -14, 4, -11], '#16274a');
    line(c, 9, -6, 16, -16, '#0c1a36', 0.8);
    for (let i = 0; i < 5; i++) line(c, -14 + i * 3, -5, -15 + i * 3, -11 + (i % 2) * 2, '#0c1a36', 0.5);
    c.restore();
    for (let i = 0; i < 10; i++) rect(c, sx + R.r(-16, 16) * k * u, sy + R.r(0.5, 2) * u, R.r(2, 6) * u, 0.25 * u, 'rgba(255,233,176,0.25)');
  },
  mid(ctx, t, S) {
    S.tf(ctx, 0.6); const { u } = S, x0 = S.moon[0], hz = S.hz;
    ctx.fillStyle = 'rgba(255,236,190,0.55)';
    for (let i = 0; i < 16; i++) { const y = hz + 1 * u + i * i * 0.1 * u + i * 0.9 * u; if (y > S.gy) break; const w = (2 + i * 0.5) * u * (0.6 + 0.4 * Math.sin(t * 1.7 + i * 1.3)); ctx.fillRect(x0 - w / 2 + Math.sin(t * 0.9 + i) * 1.5 * u, y, w, 0.35 * u); }
    ctx.restore();
  },
  near(c, S) {
    const { W, H, u, R, gy } = S;
    const f = waveFn(R, S.by(0.62), 1.5 * u, 80 * u);
    fillFn(c, W, H, (x) => f(x) - 1 * u, 'rgba(200,220,255,0.35)');
    fillFn(c, W, H, f, vg(c, S.by(0.5), H, [[0, '#4a4a6a'], [1, '#2a2a44']]));
    rockPile(c, W * 0.92, gy + 2 * u, 9 * u, '#141c34', '#222c4a', R);
    const big = S.port ? 1 : 1.2;
    palm(c, W * 0.04, gy + 2 * u, 50 * u * big, '#0a1430', 0.5, R); palm(c, W * 0.14, gy + 2 * u, 34 * u * big, '#0d1838', 0.8, R);
    if (!S.port) palm(c, W * 0.96, gy + 2 * u, 40 * u, '#0a1430', -0.6, R);
    // treasure chest silhouette on the beach
    const cx = W * (S.port ? 0.82 : 0.76), cy = gy + 0.5 * u; rect(c, cx - 4 * u, cy - 4 * u, 8 * u, 4 * u, '#2a1c1a'); c.beginPath(); c.ellipse(cx, cy - 4 * u, 4 * u, 2 * u, 0, Math.PI, 0); c.fillStyle = '#3a2620'; c.fill(); rect(c, cx - 0.6 * u, cy - 4.6 * u, 1.2 * u, 1.6 * u, '#c8963e');
  },
};

// 15 ----------------------------------------------- Thunder Sky
ART.storm = {
  veil: ['#141828', 0.3],
  prep(S) {
    const { W, H, u, R, dpr } = S;
    S.bolts = Array.from({ length: 4 }, () => { const pts = []; let x = 0, y = 0; while (y < S.hz * 0.85) { x += R.r(-4, 4) * u; y += R.r(3, 7) * u; pts.push([x, y]); } return pts; });
    S.cl = [0, 1].map((i) => cloudSprite(dpr, (34 + i * 10) * u, '#454b66', '#2a2e44', R));
    S.cls = Array.from({ length: 5 }, (_, i) => ({ x: R(), y: R.r(0.02, 0.3) * H, v: R.r(2, 4) * u, k: i % 2, s: R.r(0.8, 1.2) }));
  },
  sky(c, S) {
    const { W, H, u, R, hz } = S;
    rect(c, 0, 0, W, H, vg(c, 0, hz, [[0, '#14172a'], [0.5, '#2a2f4a'], [1, '#4c5578']]));
    for (let k = 0; k < 3; k++) for (let x = -10 * u; x < W + 10 * u; x += R.r(8, 16) * u) { const y = (k * 9 + R.r(0, 8)) * u, r = R.r(9, 16) * u; circle(c, x, y, r, mix('#1d2034', '#3a4060', k * 0.3)); circle(c, x - r * 0.2, y + r * 0.6, r * 0.6, mix('#262a40', '#4a5274', k * 0.3)); }
  },
  back(ctx, t, S) {
    driftSprites(ctx, t, S, S.cl, S.cls, 0.1);
    const P = 9, k = Math.floor(t / P), h = hash32('b' + k), dt = t - k * P - (h % 1000) / 1000 * 3;
    if (dt < 0 || dt > 0.45) return;
    const I = dt < 0.07 ? 1 : dt < 0.13 ? 0.25 : dt < 0.2 ? 0.85 : Math.max(0, 1 - (dt - 0.2) / 0.25) * 0.5;
    S.tf(ctx, 0.2); const b = S.bolts[k % 4], x0 = S.W * ((h >>> 10) % 2 ? lerp(0.08, 0.3, ((h >>> 12) % 100) / 100) : lerp(0.7, 0.92, ((h >>> 12) % 100) / 100)), y0 = S.H * 0.08;
    ctx.globalAlpha = I; ctx.lineJoin = 'round';
    for (const [w, col] of [[5 * S.u * 0.25 + 4, 'rgba(160,190,255,0.35)'], [2, '#f4f8ff']]) { ctx.beginPath(); ctx.moveTo(x0, y0); for (const [x, y] of b) ctx.lineTo(x0 + x, y0 + y); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.restore();
    S.flash = I;
  },
  far(c, S) {
    const { W, H, u, R, hz } = S, kp = S.port ? 0.8 : 1;
    // jagged dark peaks with wind-blown snow, rising out of the cloud sea
    mountains(c, W, hz + 3 * u, 7, 14 * u * kp, 30 * u * kp, '#3c4566', '#222842', ['#dfe6f6', '#9aa6c8'], R, 0.75);
    mountains(c, W, hz + 4 * u, 6, 8 * u * kp, 17 * u * kp, '#4a5478', '#2c3250', ['#c8d2ea', '#8894b8'], R, 0.8);
    for (let k = 0; k < 3; k++) {
      const base = hz + (k * 6 - 6) * u, col = mix('#8a93b4', '#5d6688', k * 0.4), lit = mix('#b8c0da', '#7d86a8', k * 0.4);
      for (let x = -10 * u; x < W + 10 * u; x += R.r(7, 13) * u) { const r = R.r(7, 13) * u; circle(c, x, base + r * 0.4, r, col); circle(c, x - r * 0.15, base + r * 0.25, r * 0.8, lit); }
      rect(c, 0, base + 6 * u, W, H, col);
    }
    for (const [x, y, s] of [[0.1, 0.55, 1], [0.88, 0.5, 0.8]]) { const cx = W * x, cy = H * y; for (let i = 0; i < 5; i++) circle(c, cx + (i - 2) * 5 * s * u, cy - Math.sin(i / 4 * Math.PI) * 8 * s * u, 7 * s * u, '#6d7699'); }
  },
  near(c, S) {
    const { W, H, u, R, gy } = S;
    for (const [x0, sd] of [[0, 1], [W, -1]]) for (let i = 0; i < 6; i++) { const r = R.r(8, 14) * u, x = x0 + sd * R.r(0, 22) * u, y = gy - R.r(-4, 14) * u; circle(c, x, y, r, '#9aa3c2'); circle(c, x - r * 0.15, y - r * 0.2, r * 0.82, '#c3cae0'); }
    for (const [x0, sd] of [[0, 1], [W, -1]]) for (let i = 0; i < 5; i++) { const r = R.r(8, 13) * u; circle(c, x0 + sd * R.r(0, 25) * u, R.r(-6, 4) * u, r, '#171a2c'); }
  },
  front(ctx, t, S) { if (S.flash > 0.01) { ctx.fillStyle = `rgba(220,230,255,${0.14 * S.flash})`; ctx.fillRect(0, 0, S.w, S.h); S.flash = 0; } },
};

// 16 ----------------------------------------------- Clocktower
ART.clock = {
  veil: ['#2a1c34', 0.3],
  dust: '#ffd59a',
  prep(S) {
    const { u, dpr } = S, b = ['#8a6a3c', '#5a4428', '#b08a50'];
    S.gears = [[0.04, 0.12, 22, 16, 0.05], [0.9, 0.27, 15, 12, -0.07], [0.74, 0.08, 9, 9, 0.093], [0.17, 0.42, 11, 10, -0.08]].map(([x, y, r, n, w]) => ({ x, y, w, sp: gearSprite(dpr, r * u, n, ...b) }));
  },
  sky(c, S) {
    const { W, H, u, R, hz } = S;
    rect(c, 0, 0, W, H, vg(c, 0, hz, [[0, '#231d44'], [0.45, '#6a3f66'], [0.8, '#d9785a'], [1, '#f6b064']]));
    stars(c, W, H, 50, R, H * 0.25);
  },
  back(ctx, t, S) { S.tf(ctx, 0.15); ctx.globalAlpha = 0.55; for (const g of S.gears) spin(ctx, g.sp, g.x * S.W, g.y * S.H, t * g.w); ctx.globalAlpha = 1; ctx.restore(); },
  far(c, S) {
    const { W, H, u, R, hz } = S;
    for (const [col, by, hmin, hmax] of [['#4a2e52', hz + 2 * u, 6, 16], ['#2e1d3a', S.by(0.15), 4, 12]]) {
      for (let x = -2 * u; x < W; ) { const w = R.r(5, 11) * u, h = R.r(hmin, hmax) * u; rect(c, x, by - h, w + 0.5, H, col); if (R() < 0.5) poly(c, [x - 0.5 * u, by - h, x + w / 2, by - h - w * 0.5, x + w + 0.5 * u, by - h], col); else if (R() < 0.4) { c.beginPath(); c.arc(x + w / 2, by - h, w * 0.35, Math.PI, 0); c.fillStyle = col; c.fill(); }
        if (R() < 0.6) rect(c, x + w * 0.7, by - h - 3 * u, 1.2 * u, 3 * u, col);
        for (let wy = by - h + 2 * u; wy < by - 1 * u; wy += 2.6 * u) for (let wx = x + 1 * u; wx < x + w - 1.2 * u; wx += 2.2 * u) if (R() < 0.22) rect(c, wx, wy, 0.9 * u, 1.2 * u, R() < 0.7 ? '#ffc46a' : '#ffe2a0');
        x += w + R.r(0, 1) * u; }
    }
  },
  near(c, S) {
    const { W, H, u, R, gy } = S;
    // clocktower on the left edge
    const tx = W * (S.port ? 0.15 : 0.1), tw = (S.port ? 9 : 10) * u, top = S.port ? H * 0.16 : H * 0.18, col = '#1d1328';
    rect(c, tx - tw, top, tw * 2, H, col); rect(c, tx - tw * 1.2, top + 18 * u, tw * 2.4, 1.5 * u, col);
    poly(c, [tx - tw * 1.2, top, tx, top - 14 * u, tx + tw * 1.2, top], col); line(c, tx, top - 14 * u, tx, top - 19 * u, col, 0.6 * u);
    const cy = top + 9 * u, r = tw * 0.72; glow(c, tx, cy, r * 2.5, '#ffd58a', 0.35); circle(c, tx, cy, r * 1.12, '#b8873a'); circle(c, tx, cy, r, '#fbe8c0');
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; line(c, tx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78, tx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92, '#5a3e1c', r * (i % 3 ? 0.04 : 0.09)); }
    line(c, tx, cy, tx + r * 0.45, cy - r * 0.3, '#2a1c10', r * 0.09); line(c, tx, cy, tx - r * 0.1, cy - r * 0.7, '#2a1c10', r * 0.06);
    for (let y = top + 26 * u; y < gy - 8 * u; y += 14 * u) { rrect(c, tx - 1.4 * u, y, 2.8 * u, 4.5 * u, [1.4 * u, 1.4 * u, 0, 0], '#ffc46a'); }
    // rooftops right
    const rx = W * (S.port ? 0.86 : 0.88);
    poly(c, [rx - 18 * u, gy, rx - 18 * u, gy - 20 * u, rx - 4 * u, gy - 32 * u, rx + 12 * u, gy - 20 * u, rx + 12 * u, gy], col);
    rect(c, rx + 2 * u, gy - 38 * u, 3 * u, 12 * u, col); rect(c, rx - 10 * u, gy - 16 * u, 3 * u, 4 * u, '#ffc46a'); rect(c, rx - 3 * u, gy - 16 * u, 3 * u, 4 * u, '#ffb050');
    poly(c, [W, gy - 26 * u, rx + 10 * u, gy - 26 * u, rx + 16 * u, gy - 34 * u, W, gy - 34 * u], col); rect(c, rx + 10 * u, gy - 26 * u, W, 26 * u, col);
  },
};

// 17 ----------------------------------------------- Haunted Graveyard
ART.haunted = {
  veil: ['#140a26', 0.32],
  fog: '#c8b8ee',
  prep(S) { S.fog = fogStrip(S, '#b8a8e0', 0.4, 22 * S.u); },
  sky(c, S) {
    const { W, H, u, R, hz } = S;
    rect(c, 0, 0, W, H, vg(c, 0, hz, [[0, '#120a26'], [0.55, '#33204f'], [1, '#6a4a8a']]));
    stars(c, W, H, 90, R, hz * 0.7);
    const mx = W * (S.port ? 0.72 : 0.8), my = H * 0.15; moon(c, mx, my, 9 * u, '#f4f0dc', '#c9b8ff', '#a898b8');
    for (let i = 0; i < 3; i++) { const y = my + R.r(-6, 8) * u, x = mx + R.r(-25, 10) * u; ell(c, x, y, R.r(14, 24) * u, 1.3 * u, 'rgba(60,40,90,0.65)'); }
    for (let i = 0; i < 4; i++) { const bx = mx + R.r(-24, 20) * u, by = my + R.r(-12, 16) * u, s = R.r(0.8, 1.3) * u; poly(c, [bx, by, bx - 3 * s, by - 1.5 * s, bx - 5 * s, by + 0.5 * s, bx - 2.5 * s, by - 0.2 * s, bx, by + 1.2 * s, bx + 2.5 * s, by - 0.2 * s, bx + 5 * s, by + 0.5 * s, bx + 3 * s, by - 1.5 * s], '#1a1028'); }
  },
  far(c, S) {
    const { W, H, u, R, hz } = S;
    const f = waveFn(R, hz - 2 * u, 5 * u, 60 * u); fillFn(c, W, H, f, '#3a2856');
    const cx = W * (S.port ? 0.25 : 0.22), cy = f(cx) + 1 * u, col = '#2a1c42';
    rect(c, cx - 5 * u, cy - 9 * u, 10 * u, 9 * u, col); poly(c, [cx - 6 * u, cy - 9 * u, cx, cy - 14 * u, cx + 6 * u, cy - 9 * u], col); rect(c, cx + 5 * u, cy - 6 * u, 6 * u, 6 * u, col);
    rect(c, cx - 1.5 * u, cy - 22 * u, 3 * u, 9 * u, col); poly(c, [cx - 2 * u, cy - 22 * u, cx, cy - 28 * u, cx + 2 * u, cy - 22 * u], col); rect(c, cx - 0.6 * u, cy - 7 * u, 1.2 * u, 2 * u, '#ffd27a');
    for (let i = 0; i < 6; i++) { const x = R() * W; deadTree(c, x, f(x) + 1 * u, R.r(10, 18) * u, '#2a1c42', R, 4); }
    const g = waveFn(R, S.by(0.12), 2 * u, 40 * u); fillFn(c, W, H, g, '#251838');
    for (let i = 0; i < 14; i++) { const x = R() * W; tomb(c, x, g(x) + 1.5 * u, R.r(1.6, 2.6) * u, '#1c122c', '#2c1e40', R); }
  },
  mid(ctx, t, S) { S.tf(ctx, 0.6); driftStrip(ctx, S.fog, t * 3 * S.u, S.by(0.05), 0.6); ctx.restore(); },
  near(c, S) {
    const { W, H, u, R, gy } = S;
    const f = waveFn(R, S.by(0.45), 1.5 * u, 60 * u); fillFn(c, W, H, f, vg(c, S.by(0.3), H, [[0, '#2a1c3c'], [1, '#160e22']]));
    for (let x = 1 * u; x < W; x += 2.2 * u) { const y = f(x) + 0.5 * u; rect(c, x, y - 7 * u, 0.4 * u, 7 * u, '#120a1c'); poly(c, [x - 0.4 * u, y - 7 * u, x + 0.2 * u, y - 8.4 * u, x + 0.8 * u, y - 7 * u], '#120a1c'); }
    rect(c, 0, f(0) - 6 * u, W, 0.4 * u, '#120a1c'); for (let x = 0; x < W; x += 4 * u) rect(c, x, f(x) - 6 * u, 4.4 * u, 0.4 * u, '#120a1c'); for (let x = 0; x < W; x += 4 * u) rect(c, x, f(x) - 2 * u, 4.4 * u, 0.4 * u, '#120a1c');
    for (let i = 0; i < 9; i++) { const x = R() * W, e = Math.abs(x / W - 0.5) * 2; tomb(c, x, lerp(f(x) + 3 * u, gy + 2 * u, R()), (2.5 + e * 2.5) * u, '#4a3a62', '#6a5a86', R); }
    deadTree(c, W * 0.03, gy + 3 * u, (S.port ? 46 : 60) * u, '#0e0818', R, 6);
    deadTree(c, W * 0.97, gy + 3 * u, (S.port ? 36 : 48) * u, '#0e0818', R, 6);
  },
};
function tomb(c, x, y, s, col, lit, R) {
  const k = R.i(0, 2), a = R.r(-0.12, 0.12); c.save(); c.translate(x, y); c.rotate(a);
  if (k === 0) { rrect(c, -s, -s * 2.6, s * 2, s * 2.6, [s, s, 0, 0], col); rrect(c, -s, -s * 2.6, s * 0.7, s * 2.6, [s, 0, 0, 0], lit); rect(c, -s * 0.5, -s * 1.8, s, s * 0.2, rgba('#000000', 0.25)); }
  else if (k === 1) { rect(c, -s * 0.3, -s * 3, s * 0.6, s * 3, col); rect(c, -s * 1.1, -s * 2.3, s * 2.2, s * 0.6, col); rect(c, -s * 0.3, -s * 3, s * 0.22, s * 3, lit); }
  else { rect(c, -s * 1.3, -s * 1.6, s * 2.6, s * 1.6, col); rect(c, -s * 1.3, -s * 1.6, s * 2.6, s * 0.35, lit); }
  c.restore();
}

// 18 ----------------------------------------------- Volcano
ART.volcano = {
  veil: ['#100c0e', 0.55], // cool charcoal behind the vault so red thorns stand out
  prep(S) {
    const { u, dpr, R } = S; S.vg = sprite(dpr, 50 * u, 50 * u, (c, w) => glow(c, w / 2, w / 2, w / 2, '#ff6a1a', 0.7));
    S.bombs = Array.from({ length: 9 }, () => ({ vx: R.r(-1, 1) * 9 * u, vy: R.r(20, 32) * u, p: R(), s: R.r(0.5, 1) * u }));
  },
  sky(c, S) {
    const { W, H, u, R, hz } = S;
    rect(c, 0, 0, W, H, vg(c, 0, hz, [[0, '#0c0a0c'], [0.55, '#241a1a'], [1, '#5a3a2c']]));
    for (let i = 0; i < 16; i++) { const x = R() * W, y = R.r(0, 0.35) * H, r = R.r(8, 18) * u; circle(c, x, y, r, 'rgba(26,20,22,0.5)'); circle(c, x, y + r * 0.5, r * 0.6, 'rgba(110,60,40,0.14)'); }
  },
  far(c, S) {
    const { W, H, u, R, hz } = S;
    mountains(c, W, hz + 2 * u, 6, 6 * u, 14 * u, '#241618', '#171011', null, R);
    const vx = W * (S.port ? 0.74 : 0.8), top = S.port ? H * 0.22 : H * 0.2, bw = (hz - top) * 1.3, cw = 7 * u;
    S.crater = [vx, top];
    for (let i = 0; i < 9; i++) { const r = (5 + i * 2.2) * u; circle(c, vx + Math.sin(i * 1.3) * 3 * u + i * 1.5 * u, top - i * 4.5 * u - 4 * u, r, rgba(mix('#4a1a12', '#2a0e0c', i / 9), 0.85)); circle(c, vx + i * 1.5 * u - r * 0.2, top - i * 4.5 * u - 4 * u + r * 0.5, r * 0.6, 'rgba(255,90,30,' + (0.25 - i * 0.025) + ')'); }
    glow(c, vx, top, 40 * u, '#ff5a1a', 0.4);
    poly(c, [vx - bw, hz + 3 * u, vx - cw, top, vx + cw, top, vx + bw, hz + 3 * u], '#261a1c');
    poly(c, [vx + cw, top, vx + bw, hz + 3 * u, vx + bw * 0.2, hz + 3 * u, vx + cw * 0.3, top + 6 * u], '#171011');
    ell(c, vx, top, cw, 1.5 * u, '#ffb040');
    c.strokeStyle = '#ff7a1a'; c.lineCap = 'round';
    for (let k = 0; k < 3; k++) { let x = vx + (k - 1) * cw * 0.6, y = top + 1 * u; c.lineWidth = (1.4 - k * 0.3) * u; c.beginPath(); c.moveTo(x, y); while (y < hz) { y += 3 * u; x += ((k - 1) * 1.2 + R.r(-0.8, 0.8)) * u; c.lineTo(x, y); } c.stroke(); }
    c.strokeStyle = 'rgba(255,220,120,0.7)'; c.lineWidth = 0.4 * u; c.stroke();
  },
  mid(ctx, t, S) {
    S.tf(ctx, 0.4); const [x, y] = S.crater;
    ctx.globalAlpha = 0.5 + 0.25 * Math.sin(t * 2.1) * Math.sin(t * 0.7); blit(ctx, S.vg, x, y); ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffb040';
    for (const b of S.bombs) { const ph = fract(t * 0.32 + b.p), T = ph * 2.2; const bx = x + b.vx * T, by = y - b.vy * T + 0.5 * 26 * S.u * T * T; if (ph < 0.95) { ctx.beginPath(); ctx.arc(bx, by, b.s, 0, TAU); ctx.fill(); } }
    ctx.restore();
  },
  near(c, S) {
    const { W, H, u, R, gy } = S;
    const f = waveFn(R, S.by(0.2), 2 * u, 50 * u); fillFn(c, W, H, f, vg(c, S.by(0.1), H, [[0, '#241618'], [1, '#110a0c']]));
    for (let k = 0; k < 2; k++) {
      const y0 = lerp(S.by(0.4), gy, k * 0.55 + 0.1), p = R() * TAU, fy = (x) => y0 + Math.sin(x / (18 * u) + p) * 3 * u;
      c.lineCap = 'round';
      for (const [w, col] of [[5, 'rgba(255,80,20,0.25)'], [2.4, '#e2471a'], [1.2, '#ff9a2a'], [0.4, '#ffe08a']]) { c.beginPath(); for (let x = -4; x < W + 8; x += 4) x < 0 ? c.moveTo(x, fy(x)) : c.lineTo(x, fy(x)); c.strokeStyle = col; c.lineWidth = w * u * (1 - k * 0.3); c.stroke(); }
    }
    for (const [x, s] of [[W * 0.03, 14], [W * 0.97, 12]]) { const y = gy + 3 * u; poly(c, [x - s * u, y, x - s * 0.6 * u, y - s * 1.6 * u, x + s * 0.1 * u, y - s * 2.2 * u, x + s * 0.7 * u, y - s * 1.2 * u, x + s * u, y], '#120606'); poly(c, [x - s * 0.6 * u, y - s * 1.6 * u, x + s * 0.1 * u, y - s * 2.2 * u, x - s * 0.2 * u, y], '#2a0f0c'); line(c, x - s * 0.6 * u, y - s * 1.6 * u, x + s * 0.1 * u, y - s * 2.2 * u, 'rgba(255,110,40,0.6)', 0.4 * u); }
  },
};

// 19 ----------------------------------------------- Dragon's Lair (lava falls and glowing cracks, no dragon)
ART.dragon = {
  veil: ['#100c0e', 0.5],
  prep(S) {
    const { W, H, u, dpr, R } = S;
    S.lg = sprite(dpr, 40 * u, 40 * u, (c, w) => glow(c, w / 2, w / 2, w / 2, '#ff7a1a', 0.7));
    S.smoke = sprite(dpr, 12 * u, 12 * u, (c, w) => glow(c, w / 2, w / 2, w / 2, '#8a7a6a', 0.45));
    // lava falls: x (fraction), width, and where they land
    S.falls = (S.port ? [[0.07, 5.6], [0.94, 4.6], [0.27, 2.6]] : [[0.1, 6.2], [0.9, 5.6], [0.3, 3.2], [0.71, 2.8]]).map(([fx, fw], i) => ({ x: W * fx, w: fw * u, y1: S.by(0.28) + i * 0.5 * u, p: R(), v: R.r(0.7, 1.2) }));
    // glowing cracks in the cave wall: jagged polylines
    S.cracks = Array.from({ length: S.port ? 7 : 11 }, () => { let x = R() * W, y = R.r(0.05, 0.55) * H; const pts = [[x, y]], n = R.i(4, 8); for (let k = 0; k < n; k++) { x += R.r(-4, 4) * u; y += R.r(1.5, 5) * u; pts.push([x, y]); } return pts; });
  },
  sky(c, S) {
    const { W, H, u, R } = S;
    rect(c, 0, 0, W, H, vg(c, 0, H, [[0, '#0b090b'], [0.6, '#1d1514'], [1, '#33231b']]));
    for (let i = 0; i < 26; i++) { const x = R() * W, y = R() * H * 0.7, r = R.r(6, 16) * u; ell(c, x, y, r, r * 0.6, 'rgba(48,36,34,0.4)'); ell(c, x - r * 0.2, y - r * 0.2, r * 0.6, r * 0.3, 'rgba(78,60,54,0.22)'); }
    for (let x = -2 * u; x < W + 4 * u; x += R.r(4, 9) * u) { const e = 0.4 + Math.abs(x / W - 0.5) * 1.5; stal(c, x, -1, R.r(2, 4) * u * e, R.r(6, 16) * u * e, '#120c0c', '#241917'); }
    // glowing cracks (dark seam, orange fill, hot core)
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const pts of S.cracks) for (const [w, col] of [[3.2 * u * 0.4, 'rgba(255,90,20,0.18)'], [1.1 * u * 0.4, '#ff6a1a'], [0.4 * u * 0.4, '#ffd27a']]) { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.strokeStyle = col; c.lineWidth = w; c.stroke(); }
  },
  far(c, S) {
    const { W, H, u, R } = S;
    coinPile(c, W * 0.15, S.by(0.2), W * 0.25, 9 * u, R, u, 0.6);
    coinPile(c, W * 0.85, S.by(0.2), W * 0.25, 10 * u, R, u, 0.6);
    coinPile(c, W * 0.5, S.by(0.3), W * 0.55, 12 * u, R, u, 0.66);
    // lava falls: dark rock lip, a channel of molten rock, a hot pool where it lands
    for (const f of S.falls) {
      const { x, w, y1 } = f;
      glow(c, x, y1 * 0.5, Math.max(w * 5, 18 * u), '#ff6a1a', 0.26);
      poly(c, [x - w * 2.2, -1, x + w * 2.2, -1, x + w * 1.1, 3 * u, x - w * 1.1, 3 * u], '#120c0c');
      c.fillStyle = vg(c, 0, y1, [[0, '#ffb040'], [0.5, '#e8541a'], [1, '#b02a10']]);
      c.beginPath(); c.moveTo(x - w * 0.55, 1); c.lineTo(x + w * 0.55, 1); c.lineTo(x + w * 0.65, y1); c.lineTo(x - w * 0.65, y1); c.closePath(); c.fill();
      rect(c, x - w * 0.55, 0, w * 0.18, y1, 'rgba(255,230,150,0.35)');
      c.strokeStyle = '#1a0c0a'; c.lineWidth = Math.max(1, 0.25 * u);
      c.beginPath(); c.moveTo(x - w * 0.55, 1); c.lineTo(x - w * 0.65, y1); c.moveTo(x + w * 0.55, 1); c.lineTo(x + w * 0.65, y1); c.stroke();
      ell(c, x, y1 + 0.4 * u, w * 2.3, w * 0.6, '#ff8a2a'); ell(c, x, y1 + 0.2 * u, w * 1.6, w * 0.35, '#ffd27a');
    }
  },
  mid(ctx, t, S) {
    S.tf(ctx, 0.4);
    const u = S.u;
    for (const f of S.falls) {
      const { x, w, y1 } = f;
      // bright ripples running down the fall
      for (let i = 0; i < 6; i++) {
        const ph = fract(t * 0.5 * f.v + f.p + i / 6), y = ph * y1, L = 5 * u;
        const g = ctx.createLinearGradient(0, y - L, 0, y + L); g.addColorStop(0, 'rgba(255,240,170,0)'); g.addColorStop(0.5, 'rgba(255,240,170,0.7)'); g.addColorStop(1, 'rgba(255,240,170,0)');
        ctx.fillStyle = g; ctx.fillRect(x - w * 0.35 + Math.sin(i * 2.3) * w * 0.12, y - L, w * 0.55, 2 * L);
      }
      // splash pool glow and droplets
      ctx.globalAlpha = 0.5 + 0.25 * Math.sin(t * 3 + f.p * 6); blit(ctx, S.lg, x, y1, w / (3 * u) + 0.3); ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffb040';
      for (let i = 0; i < 4; i++) { const ph = fract(t * 0.9 + f.p + i / 4), dx = (i - 1.5) * w * 0.5 * ph * 1.4; ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.arc(x + dx, y1 - Math.sin(ph * Math.PI) * w * 1.1, Math.max(0.5, 0.35 * u * (1 - ph * 0.5)), 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 0.25; blit(ctx, S.smoke, x + Math.sin(t * 0.7 + f.p * 4) * 2 * u, y1 - fract(t * 0.2 + f.p) * 14 * u, 0.6 + fract(t * 0.2 + f.p)); ctx.globalAlpha = 1;
    }
    // cracks breathe
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = `rgba(255,170,70,${0.18 + 0.16 * Math.sin(t * 1.7)})`; ctx.lineWidth = 0.9 * u * 0.4;
    for (const pts of S.cracks) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); }
    ctx.restore();
  },
  near(c, S) {
    const { W, H, u, R, gy } = S;
    rect(c, 0, gy - 2 * u, W, H, vg(c, gy - 2 * u, H, [[0, '#6a4416'], [1, '#2a1a0a']]));
    for (const [x, w, h] of [[W * 0.03, 26, 16], [W * 0.97, 22, 14], [W * 0.22, 12, 6], [W * 0.78, 12, 7]]) coinPile(c, x, gy + 2 * u, w * u, h * u, R, u);
    // chest + goblet + sword
    const cx = W * (S.port ? 0.16 : 0.12), cy = gy - 9 * u; rect(c, cx - 5 * u, cy - 5 * u, 10 * u, 5 * u, '#6a3a1a'); c.beginPath(); c.ellipse(cx, cy - 5 * u, 5 * u, 2.6 * u, 0, Math.PI, 0); c.fillStyle = '#7a4420'; c.fill(); rect(c, cx - 5 * u, cy - 3.5 * u, 10 * u, 0.7 * u, '#d9a12c'); rect(c, cx - 0.7 * u, cy - 5.5 * u, 1.4 * u, 2 * u, '#ffd75a');
    const sx = W * (S.port ? 0.86 : 0.9), sy = gy - 8 * u; c.save(); c.translate(sx, sy); c.rotate(0.25); rect(c, -0.6 * u, -16 * u, 1.2 * u, 14 * u, '#c9d2dc'); rect(c, -0.6 * u, -16 * u, 0.5 * u, 14 * u, '#eef4fa'); rect(c, -3 * u, -2 * u, 6 * u, 1 * u, '#d9a12c'); rect(c, -0.5 * u, -1 * u, 1 * u, 3 * u, '#5a3a1a'); circle(c, 0, 2.4 * u, 0.9 * u, '#d9a12c'); c.restore();
    for (let i = 0; i < 7; i++) { const x = R() * W, y = lerp(gy - 4 * u, gy + 1 * u, R()), col = R.pick(['#e0304a', '#30c0e0', '#40d070', '#b050ff']); poly(c, [x, y - 1.2 * u, x + 1 * u, y, x, y + 1 * u, x - 1 * u, y], col); poly(c, [x, y - 1.2 * u, x - 1 * u, y, x, y], 'rgba(255,255,255,0.5)'); }
  },
};

// 20 ----------------------------------------------- The Fox's Vault
ART.vault = {
  veil: ['#06141a', 0.34],
  spark: '#ffb04d',
  sky(c, S) {
    const { W, H, u, R } = S;
    rect(c, 0, 0, W, H, vg(c, 0, H, [[0, '#0a1a22'], [0.5, '#12303a'], [1, '#081418']]));
    const pw = 16 * u, ph = 12 * u;
    for (let y = 0; y < H; y += ph) for (let x = (y / ph % 2) * pw / 2 - pw; x < W; x += pw) { rect(c, x + 0.4 * u, y + 0.4 * u, pw - 0.8 * u, ph - 0.8 * u, rgba(R() < 0.5 ? '#1a3c48' : '#163640', 0.8)); rect(c, x + 0.4 * u, y + 0.4 * u, pw - 0.8 * u, 0.3 * u, 'rgba(140,220,230,0.12)'); for (const [a, b] of [[1.2, 1.2], [pw - 1.2 * u, 1.2]]) circle(c, x + (a > u * 2 ? a : a * u), y + b * u, 0.35 * u, 'rgba(140,220,230,0.25)'); }
    glow(c, W / 2, H / 2, Math.max(W, H) * 0.55, '#1f6a74', 0.35);
  },
  far(c, S) {
    const { W, H, u, R, R0 } = S, cx = W / 2, cy = H / 2;
    // giant vault-door frame framing the play area
    for (const [r, wd, col] of [[R0 * 1.18, 5 * u, '#0e262e'], [R0 * 1.18, 2.4 * u, '#21505a'], [R0 * 1.3, 1 * u, '#ff9a3a']]) { c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.strokeStyle = col; c.lineWidth = wd; c.stroke(); }
    for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; circle(c, cx + Math.cos(a) * R0 * 1.18, cy + Math.sin(a) * R0 * 1.18, 0.8 * u, '#6fb7c0'); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + 0.2; c.save(); c.translate(cx + Math.cos(a) * R0 * 1.3, cy + Math.sin(a) * R0 * 1.3); c.rotate(a); rect(c, -1.5 * u, -2.5 * u, 3 * u, 5 * u, '#2a5a64'); rect(c, -1.5 * u, -2.5 * u, 1 * u, 5 * u, '#4f8a94'); c.restore(); }
    // orange light strips on the sides
    S.lights = [];
    for (const y of [H * 0.12, H * 0.32, H * 0.62]) for (const [a, b] of [[0, W * 0.2], [W * 0.8, W]]) { glow(c, (a + b) / 2, y, (b - a) * 0.6, '#ff8a2a', 0.12); rect(c, a, y - 0.4 * u, b - a, 0.8 * u, '#ff9a3a'); rect(c, a, y - 0.15 * u, b - a, 0.3 * u, '#ffe0b0'); for (let k = 0; k < 2; k++) S.lights.push([lerp(a, b, R.r(0.15, 0.85)), y + 3 * u, R() * TAU, R.r(0.6, 1.6), R() < 0.5 ? '#3ef0e0' : '#ff9a3a']); }
    // fox banners
    for (const x of S.port ? [W * 0.13, W * 0.87] : [W * 0.12, W * 0.88]) banner(c, S, x, S.port ? H * 0.03 : H * 0.06, (S.port ? 11 : 12) * u, (S.port ? 20 : 30) * u, u);
  },
  near(c, S) {
    const { W, H, u, R, gy } = S;
    rect(c, 0, gy - 2 * u, W, H, vg(c, gy - 2 * u, H, [[0, '#1f3a42'], [1, '#0a161a']]));
    for (const [x, w, h] of [[W * 0.03, 24, 15], [W * 0.97, 22, 14], [W * 0.2, 9, 5], [W * 0.8, 10, 6]]) coinPile(c, x, gy + 2 * u, w * u, h * u, R, u);
    for (const [x, n] of [[W * 0.12, 6], [W * 0.88, 5]]) for (let i = 0; i < n; i++) { ell(c, x, gy - 3 * u - i * 1.4 * u, 3.4 * u, 1.2 * u, '#b8801a'); ell(c, x, gy - 3.4 * u - i * 1.4 * u, 3.4 * u, 1.1 * u, '#ffd75a'); }
  },
  front(ctx, t, S) {
    S.tf(ctx, 0.4); const u = S.u;
    for (const [x, y, p, f, col] of S.lights) { const on = Math.sin(t * f * 2 + p) > 0.2 ? 1 : 0.25; ctx.globalAlpha = on; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 0.55 * u, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    // the fox's reference portrait (the same art as the title, the cards and the thrower) on each banner
    for (const [x, y, fs] of S.banners || []) if (!drawSprite(ctx, 'fox_evil', x, y, fs * 1.2)) drawFox(ctx, x, y, fs, 'smug', 0.3);
    ctx.restore();
  },
};
function banner(c, S, x, y, w, h, u) {
  line(c, x - w * 0.6, y, x + w * 0.6, y, '#c8963e', 0.8 * u);
  poly(c, [x - w / 2, y, x + w / 2, y, x + w / 2, y + h, x, y + h - w * 0.35, x - w / 2, y + h], '#e86a1a');
  poly(c, [x - w / 2, y, x - w * 0.3, y, x - w * 0.3, y + h - w * 0.24, x - w / 2, y + h], '#ff8a34');
  rect(c, x - w / 2, y + 1 * u, w, 0.6 * u, '#ffd27a'); rect(c, x - w / 2, y + h * 0.82 - 1 * u, w, 0.4 * u, 'rgba(255,210,122,0.6)');
  // the fox on the cloth is drawn in front() (the cached layer sits under the dark vignette), so remember where
  (S.banners || (S.banners = [])).push([x, y + h * 0.43, Math.min(w * 0.8, h * 0.62)]);
}

// ---------------------------------------------------------------- theme table
const P = (skyTop, skyBottom, text, plate, accent, ring, thorn, nestStraw, ground, groundTop) => ({ skyTop, skyBottom, text, plate, accent, ring, thorn, nestStraw, ground, groundTop });
const RING = {
  wood: { base: '#b9854e', light: '#e2b57d', dark: '#76492a' },
  darkwood: { base: '#8a5a34', light: '#b8834f', dark: '#4e2f1a' },
  stone: { base: '#8f8a83', light: '#bdb7ad', dark: '#5c5853' },
  sandstone: { base: '#c9965a', light: '#ebc189', dark: '#8a5f33' },
  ice: { base: '#8fcbea', light: '#dff4ff', dark: '#4f8fb6' },
  mushroom: { base: '#c2508f', light: '#f08cc0', dark: '#7a2c5a' },
  glass: { base: '#5ec9c4', light: '#c4fff8', dark: '#2f7a8a' },
  metal: { base: '#8f99a5', light: '#d0d8e0', dark: '#545d68' },
  brass: { base: '#b8873a', light: '#ecc673', dark: '#6e4c1c' },
  coral: { base: '#ec6f61', light: '#ffae9c', dark: '#a2413a' },
  vine: { base: '#4f8a3a', light: '#8cc463', dark: '#2a5222' },
  cloud: { base: '#aab3c6', light: '#e8edf6', dark: '#6b7489' },
  obsidian: { base: '#3b3443', light: '#72667e', dark: '#19151d' },
  bone: { base: '#cfc4ab', light: '#f3ead7', dark: '#8f8268' },
  gold: { base: '#d6a12c', light: '#ffdc72', dark: '#8a6114' },
  tech: { base: '#4b6670', light: '#8fb2bb', dark: '#253740' },
};
export const THEMES = [
  { id: 'farm', name: 'Sunny Farm', palette: P('#3f9fe6', '#dff3fb', '#ffffff', 'rgba(24,58,92,0.55)', '#ffcf3a', RING.wood, '#4a3426', '#e7bf63', '#6b4a2b', '#5cb43c'), material: 'wood', ground: 'grass', ambient: 'pollen', music: { root: 'C', scale: 'major', bpm: 112, mood: 'cheerful morning' } },
  { id: 'barn', name: 'Hay Barn', palette: P('#3c2416', '#6b4126', '#fff4e0', 'rgba(36,18,8,0.6)', '#ffb54d', RING.wood, '#3a2a1e', '#e9c46a', '#5e3d1f', '#d9b04f'), material: 'wood', ground: 'dirt', ambient: 'dust', music: { root: 'G', scale: 'major', bpm: 100, mood: 'cozy folk' } },
  { id: 'orchard', name: 'Apple Orchard', palette: P('#5aa5dc', '#fbe1aa', '#ffffff', 'rgba(52,62,30,0.55)', '#ff5a44', RING.wood, '#4a2f20', '#e2b862', '#6a4a2c', '#6fb443'), material: 'wood', ground: 'grass', ambient: 'leaves', music: { root: 'F', scale: 'major', bpm: 104, mood: 'lazy afternoon' } },
  { id: 'pumpkin', name: 'Pumpkin Patch', palette: P('#3a2a5e', '#ffc35c', '#fff1de', 'rgba(42,18,36,0.6)', '#ff8a2a', RING.darkwood, '#2a1a12', '#d9a24e', '#3a2a1e', '#5a4a2a'), material: 'wood', ground: 'dirt', ambient: 'leaves', music: { root: 'D', scale: 'dorian', bpm: 96, mood: 'playful spooky harvest' } },
  { id: 'bramble', name: 'Bramble Woods', palette: P('#9ac97e', '#1d3c28', '#f2ffe6', 'rgba(10,30,16,0.6)', '#b8e05a', RING.vine, '#5a3c2e', '#c8a456', '#3a2a1c', '#2f6a30'), material: 'vine', ground: 'dirt', ambient: 'leaves', music: { root: 'E', scale: 'minor', bpm: 98, mood: 'mysterious forest' } },
  { id: 'mushroom', name: 'Mushroom Glade', palette: P('#0d0b2a', '#2d5a73', '#f4ecff', 'rgba(12,8,36,0.6)', '#ff6fb5', RING.mushroom, '#3b2d5a', '#c9a35e', '#1c1a33', '#2c3f6e'), material: 'mushroom', ground: 'grass', ambient: 'fireflies', music: { root: 'A', scale: 'lydian', bpm: 84, mood: 'dreamy night' } },
  { id: 'crystal', name: 'Crystal Cave', palette: P('#120a26', '#2a1a4e', '#eefcff', 'rgba(14,6,30,0.62)', '#3ee6d6', RING.glass, '#6b33b0', '#c9a35e', '#24173f', '#4a3480'), material: 'glass', ground: 'stone', ambient: 'sparkles', music: { root: 'B', scale: 'lydian', bpm: 90, mood: 'shimmering wonder' } },
  { id: 'frozen', name: 'Frozen Lake', palette: P('#7fb6e3', '#eef8fc', '#ffffff', 'rgba(26,56,92,0.55)', '#7fe0ff', RING.ice, '#2f5266', '#d8b56a', '#86bcd9', '#e9f6fc'), material: 'ice', ground: 'ice', ambient: 'snow', music: { root: 'E', scale: 'pentatonic', bpm: 92, mood: 'crisp and calm' } },
  { id: 'blizzard', name: 'Pine Blizzard', palette: P('#5b6c86', '#b8c4d2', '#ffffff', 'rgba(26,36,52,0.6)', '#9fd0ff', RING.stone, '#2c3440', '#cfae6a', '#8a9ab0', '#f2f5f9'), material: 'stone', ground: 'snow', ambient: 'blizzard', music: { root: 'C', scale: 'minor', bpm: 120, mood: 'driving storm' } },
  { id: 'dunes', name: 'Desert Dunes', palette: P('#2f86c9', '#ffd98e', '#ffffff', 'rgba(92,44,18,0.55)', '#ffb02e', RING.sandstone, '#5a3a20', '#e0b45a', '#c8783a', '#f2b96a'), material: 'stone', ground: 'sand', ambient: 'sand', music: { root: 'D', scale: 'phrygian', bpm: 108, mood: 'hot exotic' } },
  { id: 'tomb', name: 'Pyramid Tomb', palette: P('#2c1a0e', '#4e321b', '#fff1d6', 'rgba(30,16,6,0.62)', '#ffc23a', RING.sandstone, '#2a180a', '#d9b25a', '#4a3018', '#8a6a3a'), material: 'stone', ground: 'stone', ambient: 'dust', music: { root: 'E', scale: 'phrygian', bpm: 92, mood: 'ancient mystery' } },
  { id: 'jungle', name: 'Jungle Ruins', palette: P('#c9e3a0', '#1d4a30', '#f2ffe8', 'rgba(8,34,18,0.6)', '#ffd23f', RING.vine, '#2a3a1a', '#cfa957', '#3a2a18', '#3f8a38'), material: 'vine', ground: 'grass', ambient: 'leaves', music: { root: 'A', scale: 'dorian', bpm: 116, mood: 'adventurous drums' } },
  { id: 'reef', name: 'Coral Reef', palette: P('#3fd0e0', '#0a3f6e', '#ffffff', 'rgba(4,36,66,0.58)', '#ff7a5a', RING.coral, '#3a1a3a', '#d9c07a', '#a88e5e', '#e0cc9a'), material: 'coral', ground: 'sand', ambient: 'bubbles', music: { root: 'F', scale: 'lydian', bpm: 88, mood: 'floating calm' } },
  { id: 'cove', name: 'Pirate Cove', palette: P('#070f2a', '#3a5a92', '#fff6dc', 'rgba(6,12,34,0.62)', '#ffd27a', RING.darkwood, '#1a1424', '#c9a35e', '#4a4a6a', '#8a8aa8'), material: 'wood', ground: 'sand', ambient: 'fog', music: { root: 'D', scale: 'minor', bpm: 104, mood: 'sea shanty at night' } },
  { id: 'storm', name: 'Storm Peaks', palette: P('#14172a', '#4c5578', '#ffffff', 'rgba(12,14,28,0.6)', '#ffe14d', RING.cloud, '#2a2e44', '#cfae6a', '#8a93b4', '#e6eaf4'), material: 'cloud', ground: 'cloud', ambient: 'rain', music: { root: 'B', scale: 'minor', bpm: 132, mood: 'tense and electric' } },
  { id: 'clock', name: 'Clocktower', palette: P('#231d44', '#f6b064', '#fff2dc', 'rgba(26,16,36,0.6)', '#ffc46a', RING.brass, '#2a1c10', '#d9b25a', '#3a2e3a', '#6a5a66'), material: 'metal', ground: 'stone', ambient: 'dust', music: { root: 'G', scale: 'minor', bpm: 120, mood: 'ticking clockwork' } },
  { id: 'haunted', name: 'Haunted Graveyard', palette: P('#120a26', '#6a4a8a', '#f4ecff', 'rgba(16,8,30,0.62)', '#b8ff6a', RING.bone, '#1a1028', '#b8a070', '#2a1c3a', '#4a3a5a'), material: 'bone', ground: 'dirt', ambient: 'fog', music: { root: 'C', scale: 'phrygian', bpm: 90, mood: 'spooky waltz' } },
  { id: 'volcano', name: 'Volcano', palette: P('#0c0a0c', '#5a3a2c', '#fff0e0', 'rgba(24,4,2,0.62)', '#ff7a1a', RING.obsidian, '#ff5a1a', '#c9984e', '#5a0e0c', '#ff7a1a'), material: 'obsidian', ground: 'lava', ambient: 'embers', music: { root: 'F', scale: 'phrygian', bpm: 138, mood: 'urgent heat' } },
  { id: 'dragon', name: "Dragon's Lair", palette: P('#0b090b', '#33231b', '#fff2d6', 'rgba(20,10,4,0.62)', '#ffd75a', RING.gold, '#1e120c', '#c9984e', '#6a4416', '#ffd75a'), material: 'gold', ground: 'gold', ambient: 'embers', music: { root: 'D', scale: 'minor', bpm: 100, mood: 'epic tiptoe' } },
  { id: 'vault', name: "The Fox's Vault", palette: P('#0a1a22', '#12303a', '#f2fdff', 'rgba(4,14,18,0.62)', '#ff9a3a', RING.tech, '#ff8a2a', '#d9b25a', '#1f3a42', '#4f8a94'), material: 'metal', ground: 'stone', ambient: 'sparkles', music: { root: 'A', scale: 'minor', bpm: 128, mood: 'heist finale' } },
];

// ---------------------------------------------------------------- ground kits
const GROUND = {
  grass: { lift: 9, depth: 10 }, dirt: { lift: 4, depth: 8 }, sand: { lift: 3, depth: 8 }, snow: { lift: 7, depth: 12 },
  ice: { lift: 2, depth: 10 }, stone: { lift: 2, depth: 10 }, water: { lift: 0, depth: 0 }, lava: { lift: 0, depth: 0 },
  cloud: { lift: 10, depth: 14 }, wood: { lift: 2, depth: 8 }, gold: { lift: 9, depth: 10 },
};
function groundKit(style, P, dpr, seed) {
  const R = rng(seed ^ 0x9e3779b9), TW = 192, TB = 96, g = GROUND[style] || GROUND.dirt;
  const top = P.groundTop, bot = P.ground, dk = shade(bot, -0.35), lt = shade(top, 0.25);
  const body = sprite(dpr, TW, TB, (c) => {
    if (style === 'stone') {
      for (let r = 0; r < 4; r++) for (let k = -1; k < 6; k++) { const x = k * 40 + (r % 2) * 20, y = r * 24; rrect(c, x + 1, y + 1, 38, 22, 3, rgba(R() < 0.5 ? shade(bot, 0.12) : shade(bot, -0.08), 0.9)); rect(c, x + 3, y + 2, 34, 2, rgba('#ffffff', 0.12)); }
    } else if (style === 'wood') {
      for (let r = 0; r < 6; r++) { rect(c, 0, r * 16, TW, 1.5, rgba(dk, 0.6)); for (let k = 0; k < 2; k++) { const x = R() * TW; rect(c, x, r * 16, 1.5, 16, rgba(dk, 0.5)); circle(c, x + 4, r * 16 + 4, 0.9, rgba(dk, 0.7)); } }
    } else if (style === 'gold') {
      for (let i = 0; i < 26; i++) { const x = R() * TW, y = R() * TB; ell(c, x, y, 4.5, 2, rgba(R() < 0.5 ? '#f3c548' : '#b8801a', 0.55)); ell(c, x - 1, y - 0.6, 2.6, 0.9, 'rgba(255,240,170,0.35)'); }
    } else if (style === 'cloud') {
      for (let i = 0; i < 7; i++) ell(c, R() * TW, R() * TB, R.r(18, 30), R.r(5, 8), rgba('#ffffff', 0.09));
    } else if (style === 'ice') {
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1;
      for (let i = 0; i < 5; i++) { let x = R() * TW, y = R() * TB; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 4; k++) { x += R.r(-14, 14); y += R.r(-6, 10); c.lineTo(x, y); } c.stroke(); }
      for (let i = 0; i < 4; i++) { const x = R() * TW; poly(c, [x, 0, x + 10, 0, x - 30, TB, x - 40, TB], 'rgba(255,255,255,0.08)'); }
    } else if (style === 'snow') {
      for (let i = 0; i < 30; i++) circle(c, R() * TW, R() * TB, R.r(0.6, 1.4), 'rgba(255,255,255,0.7)');
    } else if (style === 'sand') {
      c.strokeStyle = rgba(dk, 0.25); c.lineWidth = 1;
      for (let i = 0; i < 9; i++) { const x = R() * TW, y = R() * TB; c.beginPath(); c.moveTo(x - 16, y); c.quadraticCurveTo(x, y - 3, x + 16, y); c.stroke(); }
      for (let i = 0; i < 40; i++) circle(c, R() * TW, R() * TB, 0.7, rgba(R() < 0.5 ? dk : lt, 0.5));
    } else if (style !== 'water' && style !== 'lava') {
      for (let i = 0; i < 26; i++) { const x = R() * TW, y = R() * TB, r = R.r(1.2, 3.2); ell(c, x, y, r * 1.3, r, rgba(dk, 0.45)); ell(c, x - 0.4, y - 0.6, r * 0.9, r * 0.6, rgba(shade(bot, 0.2), 0.5)); }
      for (let i = 0; i < 40; i++) circle(c, R() * TW, R() * TB, 0.7, rgba(lt, 0.35));
    }
  });
  const H = g.lift + g.depth;
  const edge = H ? sprite(dpr, TW, H, (c) => {
    const y0 = g.lift;
    if (style === 'grass') {
      rect(c, 0, y0, TW, g.depth, vg(c, y0, H, [[0, top], [1, shade(top, -0.25)]]));
      for (let x = 0; x < TW; x += 3.5) { const h = R.r(4, 9); poly(c, [x - 2.5, y0 + 2, x + R.r(-1.5, 1.5), y0 + 2 - h, x + 2.5, y0 + 2], R() < 0.5 ? top : shade(top, 0.12)); }
      for (let x = 0; x < TW; x += 9) ell(c, x, H - 1, 6, 2.2, shade(top, -0.3));
      rect(c, 0, y0 + 1, TW, 1.5, rgba(lt, 0.6));
    } else if (style === 'snow' || style === 'cloud' || style === 'gold') {
      const base = style === 'snow' ? '#f6faff' : style === 'cloud' ? '#f3f5fa' : '#f0c040', sh = style === 'snow' ? '#c4d6ea' : style === 'cloud' ? '#c3c9d8' : '#b98318';
      rect(c, 0, y0 + 2, TW, g.depth - 2, sh);
      const L = []; for (let x = -10; x < TW + 10; x += style === 'gold' ? R.r(4, 8) : R.r(9, 20)) L.push([x, style === 'gold' ? R.r(2.5, 5) : R.r(7, 13), R.r(-1.5, 2)]);
      for (const [x, r, d] of L) circle(c, x, y0 + r * 0.7 + d, r, sh);
      for (const [x, r, d] of L) circle(c, x - r * 0.12, y0 + r * 0.7 + d - 2, r * 0.92, base);
      if (style === 'gold') for (let i = 0; i < 6; i++) { const x = R() * TW; rect(c, x - 0.5, y0 - 3, 1, 6, 'rgba(255,255,230,0.9)'); rect(c, x - 3, y0, 6, 1, 'rgba(255,255,230,0.9)'); }
    } else {
      // dirt, sand, ice, stone, wood: lit lip + subtle dark line
      rect(c, 0, y0, TW, 3, lt); rect(c, 0, y0 + 3, TW, 2, top); rect(c, 0, y0 + 5, TW, 2, rgba(dk, 0.35));
      if (style === 'dirt') for (let x = 0; x < TW; x += R.r(8, 20)) { const h = R.r(2, 4); poly(c, [x - 3, y0 + 1, x, y0 + 1 - h, x + 1, y0 + 1 - h * 0.6, x + 3, y0 + 1], top); }
      if (style === 'ice') { rect(c, 0, y0, TW, 1, '#ffffff'); for (let i = 0; i < 5; i++) ell(c, R() * TW, y0 + 0.5, R.r(4, 10), 1.6, '#ffffff'); }
    }
  }) : null;
  return { body, edge, TW, TB, g, H };
}

// ---------------------------------------------------------------- ambient particles
function makeAmbient(type, S, P, art) {
  const R = rng(S.seed ^ 0xa5a5), { dpr } = S, out = { type, list: [], sp: null, n: 0 };
  const N = { pollen: 26, dust: 30, leaves: 14, fireflies: 24, sparkles: 22, snow: 48, blizzard: 60, sand: 40, embers: 34, bubbles: 20, rain: 56, fog: 4, none: 0 }[type] || 0;
  for (let i = 0; i < N; i++) out.list.push({ x: R(), y: R(), s: R.r(0.6, 1.4), p: R() * TAU, v: R.r(0.7, 1.3), k: R.i(0, 3) });
  const soft = (col, r, a = 1) => sprite(dpr, r * 2, r * 2, (c) => { const g = c.createRadialGradient(r, r, 0, r, r, r); g.addColorStop(0, rgba(col, a)); g.addColorStop(0.45, rgba(col, a * 0.6)); g.addColorStop(1, rgba(col, 0)); c.fillStyle = g; c.fillRect(0, 0, r * 2, r * 2); });
  const dot = (col, r) => sprite(dpr, r * 2 + 2, r * 2 + 2, (c) => circle(c, r + 1, r + 1, r, col));
  switch (type) {
    case 'pollen': out.sp = [soft('#fff6c8', 3)]; break;
    case 'dust': out.sp = [soft(art.dust || '#ffe0a8', 2.4)]; break;
    case 'fireflies': out.sp = [soft('#d9ff6a', 7), dot('#f8ffd0', 1.1)]; break;
    case 'sparkles': out.sp = [sprite(dpr, 12, 12, (c) => { const col = art.spark || P.accent; glow(c, 6, 6, 6, col, 0.5); poly(c, [6, 0, 7, 5, 12, 6, 7, 7, 6, 12, 5, 7, 0, 6, 5, 5], '#ffffff'); })]; break;
    case 'snow': out.sp = [soft('#ffffff', 3, 0.95)]; break;
    case 'blizzard': out.sp = [soft('#ffffff', 2.5, 0.9)]; break;
    case 'sand': out.sp = [dot('#f3d29a', 0.9), dot('#d9a865', 0.8)]; break;
    case 'embers': out.sp = [soft('#ff8a2a', 5, 0.9), dot('#fff0b0', 1)]; break;
    case 'bubbles': out.sp = [sprite(dpr, 20, 20, (c) => { c.beginPath(); c.arc(10, 10, 8.5, 0, TAU); c.fillStyle = 'rgba(200,245,255,0.12)'; c.fill(); c.strokeStyle = 'rgba(220,250,255,0.7)'; c.lineWidth = 1.1; c.stroke(); ell(c, 7, 6.5, 2.4, 1.5, 'rgba(255,255,255,0.85)', -0.6); })]; break;
    case 'leaves': out.sp = (art.leaves || ['#7aa83a', '#c9852e', '#a8c24a']).map((col) => sprite(dpr, 14, 10, (c) => { c.beginPath(); c.moveTo(1, 5); c.quadraticCurveTo(7, -2, 13, 5); c.quadraticCurveTo(7, 12, 1, 5); c.fillStyle = col; c.fill(); line(c, 1, 5, 12, 5, shade(col, -0.3), 0.8); })); break;
    case 'fog': out.sp = [sprite(dpr, 260, 70, (c) => { for (let i = 0; i < 7; i++) { const x = 40 + i * 30, r = 30 + Math.sin(i * 1.7) * 8; const g = c.createRadialGradient(x, 38, 0, x, 38, r); g.addColorStop(0, rgba(art.fog || '#d8d0f0', 0.5)); g.addColorStop(1, rgba(art.fog || '#d8d0f0', 0)); c.fillStyle = g; c.fillRect(x - r, 38 - r, 2 * r, 2 * r); } })]; break;
  }
  return out;
}
function drawAmbientList(ctx, t, A, S) {
  const { w, h } = S, L = A.list; if (!L.length) return;
  const cx = w / 2, cy = h / 2, r0 = S.R0 * 0.55, r1 = S.R0 * 1.05;
  const fade = (x, y) => 0.4 + 0.6 * sstep(r0, r1, Math.hypot(x - cx, y - cy));
  const pad = 30, W2 = w + pad * 2, H2 = h + pad * 2;
  if (A.type === 'rain') {
    ctx.strokeStyle = 'rgba(200,215,240,0.28)'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (const p of L) { const y = wrap(p.y * H2 + t * 900 * p.v, H2) - pad, x = wrap(p.x * W2 - t * 180 * p.v + y * 0.2, W2) - pad; ctx.moveTo(x, y); ctx.lineTo(x - 5 * p.s, y + 22 * p.s); }
    ctx.stroke(); return;
  }
  for (let i = 0; i < L.length; i++) {
    const p = L[i]; let x, y, a = 1, s = p.s, sp = A.sp[0], rot = 0;
    switch (A.type) {
      case 'pollen': x = wrap(p.x * W2 + t * 9 * p.v + Math.sin(t * 0.6 + p.p) * 14, W2) - pad; y = wrap(p.y * H2 - t * 6 * p.v + Math.sin(t * 0.9 + p.p) * 8, H2) - pad; a = 0.45 + 0.35 * Math.sin(t * 2 + p.p); break;
      case 'dust': x = wrap(p.x * W2 + Math.sin(t * 0.21 * p.v + p.p) * 40 + t * 3, W2) - pad; y = wrap(p.y * H2 + Math.cos(t * 0.17 * p.v + p.p * 2) * 30 - t * 2, H2) - pad; a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.3 + p.p)); break;
      case 'fireflies': x = wrap(p.x * W2 + Math.sin(t * 0.33 * p.v + p.p) * 50, W2) - pad; y = p.y * h * 0.75 + h * 0.2 + Math.sin(t * 0.47 * p.v + p.p * 3) * 30; a = Math.max(0, Math.sin(t * 1.2 * p.v + p.p)) ** 2; s = 1; break;
      case 'sparkles': x = p.x * w; y = p.y * h; const ph = fract(t * 0.25 * p.v + p.p / TAU); a = Math.max(0, Math.sin(ph * Math.PI)) ** 3; s = 0.5 + a * 0.8 * p.s; break;
      case 'snow': y = wrap(p.y * H2 + t * 32 * p.v * p.s, H2) - pad; x = wrap(p.x * W2 + Math.sin(t * 0.8 * p.v + p.p) * 16 + t * 8, W2) - pad; a = 0.85; s = p.s * 0.85; break;
      case 'blizzard': x = wrap(p.x * W2 + t * 45 * p.v + Math.sin(t * 0.9 * p.v + p.p) * 18, W2) - pad; y = wrap(p.y * H2 + t * 60 * p.v * p.s, H2) - pad; a = 0.8; break; // v3.1: gentle snowfall, so it never reads as a wind that pushes eggs (the Blizzard's gale has its own streaks)
      case 'sand': x = wrap(p.x * W2 + t * 160 * p.v, W2) - pad; y = p.y * h * 0.6 + h * 0.38 + Math.sin(t * 1.7 + p.p) * 12; sp = A.sp[p.k % 2]; a = 0.65; break;
      case 'embers': { const ph = fract(t * 0.09 * p.v + p.y); y = h + pad - ph * H2; x = wrap(p.x * W2 + Math.sin(t * 1.1 + p.p) * 18 + ph * 40, W2) - pad; a = Math.sin(ph * Math.PI) * (0.6 + 0.4 * Math.sin(t * 9 + p.p)); s = p.s * 0.8; break; }
      case 'bubbles': { const ph = fract(t * 0.06 * p.v + p.y); y = h + pad - ph * H2; x = wrap(p.x * W2 + Math.sin(t * 1.4 * p.v + p.p) * 10, W2) - pad; a = 0.85; s = p.s * 0.65; break; }
      case 'leaves': { const ph = fract(t * 0.045 * p.v + p.y); y = ph * H2 - pad; x = wrap(p.x * W2 + Math.sin(t * 1.2 * p.v + p.p) * 30 + ph * 80, W2) - pad; rot = Math.sin(t * 2 * p.v + p.p) * 1.4 + p.p; sp = A.sp[p.k % A.sp.length]; a = 0.9; break; }
      case 'fog': { x = wrap(p.x * (w + 520) + t * 7 * p.v, w + 520) - 260; y = h * (0.66 + p.y * 0.26); s = 0.9 + p.s * 0.6; a = 0.55 + 0.25 * Math.sin(t * 0.3 + p.p); ctx.globalAlpha = a; ctx.drawImage(sp.cv, x - sp.w * s / 2, y - sp.h * s / 2, sp.w * s, sp.h * s); continue; }
    }
    ctx.globalAlpha = clamp(a * fade(x, y), 0, 1);
    if (rot) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.drawImage(sp.cv, -sp.w * s / 2, -sp.h * s / 2, sp.w * s, sp.h * s); ctx.restore(); }
    else ctx.drawImage(sp.cv, x - sp.w * s / 2, y - sp.h * s / 2, sp.w * s, sp.h * s);
    if (A.type === 'fireflies' || A.type === 'embers') { const d = A.sp[1]; ctx.drawImage(d.cv, x - d.w / 2, y - d.h / 2, d.w, d.h); }
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- backdrop
export function createBackdrop(theme, seed = 1) {
  const th = typeof theme === 'string' ? THEMES.find((x) => x.id === theme) || THEMES[0] : theme || THEMES[0];
  const art = ART[th.id] || ART.farm;
  const P = th.palette;
  const S = { th, P, seed: (seed >>> 0) ^ hash32(th.id), w: 0, h: 0, dpr: 1, layers: [], tf: null, ySign: 1 };
  let A = null, G = null, gpat = new WeakMap();
  S.tf = (ctx, f) => { // apply layer transform for depth f (0 sky .. 1 near)
    const cam = S.cam, M = S.M, w = S.w, h = S.h;
    const sc = 1 + clamp((cam.zoom || 1) - 1, -0.5, 0.6) * 0.05 * f;
    const lim = Math.max(0, ((w + 2 * M) * sc - w) / 2 - 1), limy = Math.max(0, ((h + 2 * M) * sc - h) / 2 - 1);
    const dx = clamp(-clamp((cam.x || 0) / 5, -1, 1) * M * f, -lim, lim), dy = clamp(clamp((cam.y || 0) / 5, -1, 1) * M * f * S.ySign, -limy, limy);
    const q = S.dpr, ox = sc === 1 ? Math.round((dx - M) * q) / q + M : dx, oy = sc === 1 ? Math.round((dy - M) * q) / q + M : dy; // pixel-snap => 1:1 blits
    ctx.save(); ctx.translate(w / 2 + ox, h / 2 + oy); ctx.scale(sc, sc); ctx.translate(-S.W / 2, -S.H / 2);
  };
  const api = {
    theme: th,
    set parallaxYSign(v) { S.ySign = v < 0 ? -1 : 1; },
    resize(w, h, dpr = 1) {
      w = Math.max(1, w); h = Math.max(1, h);
      dpr = clamp(dpr || 1, 1, 2); const M = Math.round(Math.max(w, h) * 0.03);
      while (dpr > 0.75 && (w + 2 * M) * (h + 2 * M) * dpr * dpr > 2.8e6) dpr -= 0.25;
      Object.assign(S, { w, h, dpr, M, W: w + 2 * M, H: h + 2 * M, u: Math.min(w, h) / 100, port: w / h < 0.8, R0: Math.min(w, h) * 0.45 });
      S.cx = S.W / 2; S.cy = S.H / 2; S.cam = { x: 0, y: 0, zoom: 1 };
      // horizon & ground line in layer coords: the game's floor sits ~88% down the screen
      S.hz = M + h * lerp(0.68, 0.6, clamp((w / h - 0.6) / 1.2, 0, 1)); S.gy = M + h * 0.88; S.by = (k) => lerp(S.hz, S.gy, k);
      S.R = rng(S.seed); S.banners = []; if (art.prep) art.prep(S);
      const paint = (fns, final, opaque) => {
        const cv = mkCanvas(S.W * dpr, S.H * dpr), c = cv.getContext('2d', { alpha: !opaque });
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        fns.forEach((fn, i) => { S.R = rng(S.seed + 101 * (i + 1) + (final ? 7 : 0)); fn(c, S); });
        if (final) calm(c, S, art);
        return cv;
      };
      const L = [];
      if (art.back) { L.push({ cv: paint([art.sky], false, true), f: 0 }); L.push({ cv: paint([art.far]), f: 0.4 }); }
      else L.push({ cv: paint([art.sky, art.far], false, true), f: 0.4 });
      L.push({ cv: paint([art.near], true), f: 1 });
      S.layers = L;
      A = makeAmbient(th.ambient, S, P, art);
      G = groundKit(th.ground, P, dpr, S.seed); gpat = new WeakMap();
    },
    draw(ctx, t = 0, cam) {
      if (!S.layers.length) return;
      S.cam = cam || S.cam;
      const L = S.layers;
      for (let i = 0; i < L.length; i++) {
        S.tf(ctx, L[i].f); ctx.drawImage(L[i].cv, 0, 0, S.W, S.H); ctx.restore();
        if (art.back && i === 0) art.back(ctx, t, S);
        if (i === L.length - 2 && art.mid) art.mid(ctx, t, S);
      }
      if (art.front) art.front(ctx, t, S);
    },
    drawAmbient(ctx, t = 0, cam) { if (A && A.list.length) drawAmbientList(ctx, t, A, S); },
    drawGround(ctx, x, y, w, h, t = 0) {
      if (!G) return;
      const st = th.ground, P2 = P;
      if (st === 'water' || st === 'lava') return liquid(ctx, x, y, w, h, t, st, P2);
      ctx.fillStyle = vg(ctx, y, y + Math.max(h, 1), [[0, shade(P2.ground, 0.08)], [1, shade(P2.ground, -0.4)]]); ctx.fillRect(x, y, w, h);
      let pat = gpat.get(ctx); if (!pat) { pat = ctx.createPattern(G.body.cv, 'repeat'); if (pat.setTransform) pat.setTransform(new DOMMatrix([1 / S.dpr, 0, 0, 1 / S.dpr, 0, 0])); gpat.set(ctx, pat); }
      ctx.save(); ctx.translate(x, y + G.g.depth * 0.5); ctx.fillStyle = pat; ctx.fillRect(0, 0, w, h); ctx.restore();
      if (G.edge) { const tw = G.TW; for (let tx = x; tx < x + w; tx += tw) ctx.drawImage(G.edge.cv, tx, y - G.g.lift, tw, G.H); }
    },
  };
  return api;
}
function calm(c, S, art) {
  const { W, H, R0 } = S, cx = W / 2, cy = H / 2, [vc, va] = art.veil || ['#000000', 0.2];
  c.save(); c.globalCompositeOperation = 'destination-out';
  let g = c.createRadialGradient(cx, cy, R0 * 0.2, cx, cy, R0 * 1.15); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore();
  g = c.createRadialGradient(cx, cy, 0, cx, cy, R0 * 1.35); g.addColorStop(0, rgba(vc, va)); g.addColorStop(0.6, rgba(vc, va * 0.7)); g.addColorStop(1, rgba(vc, 0));
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const D = Math.hypot(W, H) / 2; g = c.createRadialGradient(cx, cy, D * 0.55, cx, cy, D * 1.05); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.28)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}
function liquid(ctx, x, y, w, h, t, st, P) {
  const lava = st === 'lava';
  const top = lava ? '#ffb030' : P.groundTop, bot = P.ground;
  if (lava) { ctx.fillStyle = vg(ctx, y - 30, y, [[0, 'rgba(255,90,20,0)'], [1, 'rgba(255,110,30,0.35)']]); ctx.fillRect(x, y - 30, w, 30); }
  ctx.fillStyle = vg(ctx, y, y + Math.max(h, 1), lava ? [[0, '#ff7a1a'], [0.25, '#d2381a'], [1, '#5a0e0c']] : [[0, top], [1, bot]]);
  const wave = (k, amp, sp) => { ctx.beginPath(); ctx.moveTo(x, y + h); for (let i = 0; i <= w + 16; i += 16) ctx.lineTo(x + i, y + Math.sin((x + i) * 0.035 * k + t * sp) * amp + Math.sin((x + i) * 0.013 + t * sp * 0.6) * amp * 0.6); ctx.lineTo(x + w, y + h); ctx.closePath(); };
  wave(1, 2.2, 1.6); ctx.fill();
  if (lava) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = 'rgba(40,10,8,0.55)';
    for (let i = 0; i < 9; i++) { const px = x + wrap(i * 137 + t * 9 * (1 + (i % 3) * 0.3), w + 120) - 60, py = y + 10 + (i * 53 % Math.max(10, h - 14)); ctx.beginPath(); ctx.ellipse(px, py, 28 + (i % 4) * 8, 4 + (i % 3) * 1.5, 0, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = 'rgba(255,220,120,0.8)'; ctx.lineWidth = 1.6; ctx.beginPath();
    for (let i = 0; i <= w + 16; i += 16) ctx.lineTo(x + i, y + 1.5 + Math.sin((x + i) * 0.035 + t * 1.6) * 2.2 + Math.sin((x + i) * 0.013 + t * 0.96) * 1.3);
    ctx.stroke(); ctx.restore();
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.4; ctx.beginPath();
    for (let i = 0; i <= w + 16; i += 16) ctx.lineTo(x + i, y + Math.sin((x + i) * 0.035 + t * 1.6) * 2.2 + Math.sin((x + i) * 0.013 + t * 0.96) * 1.3);
    ctx.stroke();
  }
}
