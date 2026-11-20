// The magnet power's look (2026-11-20). mykee, on the first rebuild (a horseshoe clamped on the egg): "When I say magnet I am
// talking about the magnet power-up. You literally added a magnet into the level. Just need to properly animate the force
// of attraction." So there is NO magnet object: the two eggs themselves become the poles and the PULL is what is drawn.
// The mechanic is sim.js setMagnet + magnetPull: for 8 s the egg behind is hauled toward the one in front (rope as a stop).
// Here: the taker glows red and its friend blue on the sides that face each other, a snap line flashes once, curved field
// lines join them, and chevrons race inward along the line from both eggs (faster and brighter the harder the pull).
// Both eggs stretch toward each other while they are pulled; they meet with a clack and a shock ring and sit in one
// pulsing bond. The last 2 s flicker; at the end the lines snap back. A miss (no friend in reach): a ring fizzles, a "?".
// Cost: a handful of curves per frame; no gradients, no shadowBlur; nothing when no magnet.
// World space (meters, y up). k = px per meter.
import { EGG_W, EGG_H, TAU } from '../sim/geom.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (q) => q * q * (3 - 2 * q);
const TIME = 8; // = POWER.magnet.time (sim.js)
const INK = '#4a1016';
const RED = '255,74,92', BLUE = '74,140,255';
const NO_DASH = [];
const PAIRS = new Map(); // joint -> { a, b, touch, clackT, wa, wb, ... } (render memory)
const PEND = []; // events waiting for the next draw (they get its time)
const MISS = []; // { egg, t0 }

function spark(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}
// an egg as a pole: a thin halo all round it and a bright crescent on the side that faces its partner
function pole(ctx, egg, ang, rgb, a, w, px, t) {
  const p = egg.body.getPosition(), rot = egg.body.getAngle(), rx = EGG_W / 2 + 0.035, ry = EGG_H / 2 + 0.035, pu = 0.5 + 0.5 * Math.sin(t * 9);
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(${rgb},${0.4 * a})`; ctx.lineWidth = Math.max(2.2 * px, 0.022);
  ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, ry, rot, 0, TAU); ctx.stroke();
  const half = 0.75 + 0.35 * w;
  ctx.strokeStyle = `rgba(${rgb},${(0.55 + 0.35 * w) * a})`; ctx.lineWidth = Math.max(4.5 * px, 0.05 + 0.03 * w * pu);
  ctx.beginPath(); ctx.ellipse(p.x, p.y, rx + 0.01, ry + 0.01, rot, ang - rot - half, ang - rot + half); ctx.stroke();
  ctx.strokeStyle = `rgba(255,255,255,${0.8 * a})`; ctx.lineWidth = Math.max(1.4 * px, 0.014);
  ctx.beginPath(); ctx.ellipse(p.x, p.y, rx + 0.01, ry + 0.01, rot, ang - rot - half * 0.7, ang - rot + half * 0.7); ctx.stroke();
}
// chevrons racing from (x0,y0) along (ux,uy) over len: the pull, drawn
function chevrons(ctx, x0, y0, ux, uy, len, rgb, a, speed, t, px) {
  const n = clamp(Math.round(len / 0.13), 1, 6), nx = -uy, ny = ux, sz = clamp(len * 0.5, 0.045, 0.085);
  for (let i = 0; i < n; i++) {
    const q = (i / n + t * speed) % 1, f = Math.sin(q * Math.PI), x = x0 + ux * len * q, y = y0 + uy * len * q;
    if (f < 0.05) continue;
    ctx.beginPath();
    ctx.moveTo(x - ux * sz + nx * sz, y - uy * sz + ny * sz); ctx.lineTo(x, y); ctx.lineTo(x - ux * sz - nx * sz, y - uy * sz - ny * sz);
    ctx.strokeStyle = `rgba(${rgb},${a * f})`; ctx.lineWidth = Math.max(4.2 * px, 0.042); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${a * f})`; ctx.lineWidth = Math.max(1.6 * px, 0.016); ctx.stroke();
  }
}

// events (main.js handleEvents): magnetOn / magnetOff / magnetMiss
export function magnetEvent(ev, fx) {
  if (ev.type === 'magnetMiss') { PEND.push({ type: 'miss', egg: ev.egg }); return; }
  if (ev.type === 'magnetOn' && ev.egg && ev.egg.body && fx) {
    const p = ev.egg.body.getPosition();
    fx.wave(p.x, p.y, 0.7, '#ff6a78', 0.35, 0.06);
    if (ev.other && ev.other.body) { const q = ev.other.body.getPosition(); fx.wave(q.x, q.y, 0.7, '#6aa2ff', 0.35, 0.06, { delay: 0.12 }); }
  }
}

// both eggs stretch toward each other while the magnet hauls them (main.js drawEggFelt): { a (rad), s (stretch), dx, dy }
const LEAN = { a: 0, s: 0, dx: 0, dy: 0 };
export function magnetLean(e) {
  const J = e.joint;
  if (!J || J.dead) return null;
  const P = PAIRS.get(J);
  if (!P) return null;
  const isB = J.b === e, w = isB ? P.wb : P.wa, sg = isB ? -1 : 1;
  if (!(w > 0.02)) return null;
  LEAN.a = P.dir + (isB ? Math.PI : 0); LEAN.s = 0.13 * w; LEAN.dx = sg * P.ux * 0.045 * w; LEAN.dy = sg * P.uy * 0.045 * w;
  return LEAN;
}

export function drawMagnetField(ctx, sim, t, k = 60, calm = false) {
  const px = 1 / k;
  while (PEND.length) { const E = PEND.shift(); if (E.type === 'miss') MISS.push({ egg: E.egg, t0: t }); }
  let seen = 0;
  for (const e of sim.eggs) {
    const J = e.joint;
    if (!J || J.a !== e || J.dead || !e.alive || !(e.magnet > 0)) continue;
    const o = J.b;
    if (!o || !o.alive || !o.body || !e.body) continue;
    seen++;
    let P = PAIRS.get(J);
    if (!P) PAIRS.set(J, (P = { a: e, b: o, touch: false, knot: 0, clackT: -9, seen: t, dir: 0, ux: 1, uy: 0, taut: 0, wa: 0, wb: 0, len: J.len }));
    P.seen = t;
    drawPair(ctx, P, e, o, J, t, px, calm);
  }
  // pairs that ended since the last frame: the magnet pops off, the lines snap back
  for (const [J, P] of PAIRS) {
    if (P.seen === t) continue;
    if (!P.end) P.end = t;
    const e = t - P.end;
    if (e > 0.4 || !P.a.body || !P.b.body) { PAIRS.delete(J); continue; }
    snapBack(ctx, P, e, px);
  }
  // misses (no friend in reach): the pull reaches out, finds nothing and fizzles, with a "?"
  for (let i = MISS.length - 1; i >= 0; i--) {
    const M = MISS[i], e = t - M.t0;
    if (e > 0.95 || !M.egg.body || !M.egg.alive) { MISS.splice(i, 1); continue; }
    const p = M.egg.body.getPosition(), q = e / 0.95;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.setLineDash([0.09, 0.12]);
    for (let j = 0; j < 2; j++) {
      const r = 0.34 + (0.5 + 0.35 * j) * smooth(clamp(q * 1.6 - j * 0.25, 0, 1));
      ctx.strokeStyle = `rgba(${RED},${0.7 * (1 - q)})`; ctx.lineWidth = Math.max(3 * px, 0.03);
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke();
    }
    ctx.setLineDash(NO_DASH);
    ctx.restore();
    if (e > 0.25) { // the questioning flicker
      const on = calm ? 1 : Math.floor(e * 9) % 3 ? 1 : 0.4;
      ctx.save();
      ctx.translate(p.x + 0.2, p.y + EGG_H * 0.5 + 0.32);
      ctx.scale(px, -px);
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.globalAlpha = on * clamp((e - 0.25) / 0.1, 0, 1) * clamp((0.95 - e) / 0.15, 0, 1);
      ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.strokeText('?', 0, 0);
      ctx.fillStyle = '#ffffff'; ctx.fillText('?', 0, 0);
      ctx.restore();
    }
  }
}

function snapBack(ctx, P, e, px) {
  const pa = P.a.body.getPosition(), pb = P.b.body.getPosition(), dx = pb.x - pa.x, dy = pb.y - pa.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, nx = -uy, ny = ux;
  const f = Math.max(0, Math.exp(-e * 9) * Math.cos(e * 26)), a = 1 - e / 0.4;
  ctx.save();
  ctx.lineCap = 'round';
  for (const [x0, y0, sd, col] of [[pa.x, pa.y, 1, 'rgba(255,90,104,'], [pb.x, pb.y, -1, 'rgba(90,150,255,']]) {
    for (let i = -1; i <= 1; i++) {
      const L = (d * 0.5) * f, cx = x0 + ux * sd * L * 0.5 + nx * i * 0.12 * f, cy = y0 + uy * sd * L * 0.5 + ny * i * 0.12 * f;
      ctx.beginPath(); ctx.moveTo(x0 + ux * sd * 0.18, y0 + uy * sd * 0.18); ctx.quadraticCurveTo(cx, cy, x0 + ux * sd * (0.18 + L), y0 + uy * sd * (0.18 + L));
      ctx.strokeStyle = col + 0.6 * a + ')';
      ctx.lineWidth = Math.max(3 * px, 0.03);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.8 * a})`;
      ctx.lineWidth = Math.max(1.2 * px, 0.01);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawPair(ctx, P, A, B, J, t, px, calm) {
  const pa = A.body.getPosition(), pb = B.body.getPosition(), dx = pb.x - pa.x, dy = pb.y - pa.y, d = Math.hypot(dx, dy) || 1e-3;
  const ux = dx / d, uy = dy / d, nx = -uy, ny = ux, dir = Math.atan2(dy, dx);
  const age = TIME - A.magnet, left = A.magnet; // seconds since the pickup, seconds left
  const maxL = (J.j && J.j.getMaxLength ? J.j.getMaxLength() : J.len) || 0.8;
  const taut = clamp((d - (maxL - 0.12)) / 0.12, 0, 1), touch = d < EGG_W + 0.1;
  const pull = J.pull || 0; // (sim) the pull in g before each egg's share
  P.dir = dir; P.ux = ux; P.uy = uy; P.taut += (taut - P.taut) * 0.3;
  P.wa += (clamp((pull * (J.ka || 0)) / 2.2 + 0.25 * taut, 0, 1) - P.wa) * 0.25;
  P.wb += (clamp((pull * (J.kb || 0)) / 2.2 + 0.25 * taut, 0, 1) - P.wb) * 0.25;
  if (touch && !P.touch) P.clackT = t;
  P.touch = touch;
  // flicker in the last 2 s (calm: a slow fade instead)
  let vis = 1;
  if (left < 2) vis = calm ? 0.45 + 0.55 * (left / 2) : (Math.sin(t * (18 + (2 - left) * 16)) > -0.2 ? 1 : 0.3);
  const intro = clamp(age / 0.2, 0, 1), strong = clamp(Math.max(P.wa, P.wb), 0, 1);
  const kn = (P.knot += ((touch ? 1 : 0) - P.knot) * 0.25);
  ctx.save();
  ctx.lineCap = 'round';
  // the snap line: once, right at the pickup
  if (age < 0.2 && !calm) {
    const q = age / 0.2, n = 7;
    for (const [w, col] of [[Math.max(6 * px, 0.05), 'rgba(150,170,255,0.7)'], [Math.max(2.4 * px, 0.018), '#ffffff']]) {
      ctx.lineWidth = w; ctx.strokeStyle = col; ctx.globalAlpha = 1 - q * q;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const f = i / n, j = i === 0 || i === n ? 0 : (i % 2 ? 1 : -1) * 0.07 * Math.sin(i * 7.3 + Math.floor(age * 60));
        const x = pa.x + dx * f + nx * j, y = pa.y + dy * f + ny * j;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  // the field: curved lines from the red egg to the blue one (red half, blue half, a white core), tighter as they close
  const ra = EGG_W * 0.5 + 0.03, gap = Math.max(0, d - EGG_W), fan = 0.34 + 0.16 * kn;
  const bulge = (0.05 + 0.07 * clamp(1 - gap / 1.0, 0, 1)) * (1 - 0.5 * P.taut) + 0.05 * kn;
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 0; j < 4; j++) {
      const i = j - 1.5, aa = dir + i * fan, ab = dir + Math.PI - i * fan, ax = pa.x + Math.cos(aa) * ra, ay = pa.y + Math.sin(aa) * ra, bx = pb.x + Math.cos(ab) * ra, by = pb.y + Math.sin(ab) * ra;
      const wob = calm ? 0 : 0.012 * Math.sin(t * 7 + j * 1.9), bb = i * (bulge + wob) * (1 + 0.3 * Math.abs(i)), mx = (ax + bx) / 2 + nx * bb, my = (ay + by) / 2 + ny * bb;
      const c1x = (ax + mx) / 2, c1y = (ay + my) / 2, c2x = (mx + bx) / 2, c2y = (my + by) / 2, hx = (c1x + c2x) / 2, hy = (c1y + c2y) / 2;
      if (pass === 0) {
        ctx.lineWidth = Math.max(3.4 * px, 0.04);
        ctx.strokeStyle = `rgba(${RED},${intro * vis * (0.4 + 0.3 * strong)})`; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(c1x, c1y, hx, hy); ctx.stroke();
        ctx.strokeStyle = `rgba(${BLUE},${intro * vis * (0.4 + 0.3 * strong)})`; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(c2x, c2y, bx, by); ctx.stroke();
      } else {
        ctx.lineWidth = Math.max(1.3 * px, 0.011); ctx.strokeStyle = `rgba(255,255,255,${intro * vis * (0.4 + 0.4 * strong)})`;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, bx, by); ctx.stroke();
      }
    }
  }
  // the pull itself: chevrons racing inward from both eggs to where they will meet
  if (gap > 0.05) {
    const half = gap / 2, sp = calm ? 0 : 1.1 + 1.6 * strong, a = intro * vis * (0.65 + 0.35 * strong);
    chevrons(ctx, pa.x + ux * (EGG_W / 2), pa.y + uy * (EGG_W / 2), ux, uy, half, RED, a, sp, t, px);
    chevrons(ctx, pb.x - ux * (EGG_W / 2), pb.y - uy * (EGG_W / 2), -ux, -uy, half, BLUE, a, sp, t, px);
  }
  // the eggs as poles
  pole(ctx, A, dir, RED, intro * vis, P.wa, px, t);
  pole(ctx, B, dir + Math.PI, BLUE, intro * vis, P.wb, px, t + 0.35);
  // together: one pulsing bond at the contact
  if (kn > 0.05) {
    const cx = pa.x + ux * d * 0.5, cy = pa.y + uy * d * 0.5, pr = 0.055 + (calm ? 0 : 0.014 * Math.sin(t * 12));
    ctx.globalAlpha = intro * vis * kn;
    ctx.fillStyle = 'rgba(255,244,250,0.95)'; ctx.beginPath(); ctx.arc(cx, cy, pr, 0, TAU); ctx.fill();
    ctx.lineWidth = Math.max(3 * px, 0.025); ctx.strokeStyle = '#c86bff'; ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // sparks at the back of an egg that is being hauled hard
  if (!calm) for (const [p, w, sg] of [[pa, P.wa, -1], [pb, P.wb, 1]]) {
    if (w < 0.5 || touch) continue;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 3; i++) { const ph = (t * 4 + i / 3) % 1, a = dir + (sg > 0 ? 0 : Math.PI) + (i - 1) * 0.5; spark(ctx, p.x + Math.cos(a) * (0.3 + ph * 0.16), p.y + Math.sin(a) * (0.3 + ph * 0.16), 0.04 * Math.sin(ph * Math.PI) * w); }
  }
  // the clack when they meet: a star and a shock ring
  const ce = t - P.clackT;
  if (ce >= 0 && ce < 0.35) {
    const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2, q = ce / 0.35;
    ctx.fillStyle = `rgba(255,255,255,${1 - q})`;
    spark(ctx, mx, my, 0.09 + 0.14 * Math.sin(q * Math.PI));
    ctx.strokeStyle = `rgba(255,236,160,${1 - q})`; ctx.lineWidth = Math.max(3 * px, 0.03 * (1 - q));
    ctx.beginPath(); ctx.arc(mx, my, 0.1 + 0.5 * smooth(q), 0, TAU); ctx.stroke();
    ctx.lineWidth = Math.max(2.5 * px, 0.02);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.3; ctx.moveTo(mx + Math.cos(a) * (0.08 + 0.1 * q), my + Math.sin(a) * (0.08 + 0.1 * q)); ctx.lineTo(mx + Math.cos(a) * (0.14 + 0.18 * q), my + Math.sin(a) * (0.14 + 0.18 * q)); }
    ctx.stroke();
  }
  ctx.restore();
}
