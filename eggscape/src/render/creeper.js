// The thorn creeper in play (0.8.18): the sim's creepers (sim/creeper.js) drawn in the bramble family's own look (the
// thorn curtain's canes, knots and big red thorns with the cream rim, render/v3art.js BRAMBLE). Its stretch is a faint vine
// track with tiny buds and a root knot at each end (where it will go); the head is a knot of canes with red thorns and two
// eyes, a short vine trailing behind along the track. It leans into its crawl, its thorns bristle with its speed; at each
// end the tail winds round it and it curls up, eyes shut (safe); the wind-up rears it back, eyes wide, thorns out
// (anticipation), then it sets off. Fire chars it, it crumbles to a stump; the stump sprouts, unfurls and grows a new head.
// ctx is in world space (m, y up); the head and tail are drawn in a local px frame: +x the way it crawls, -y off the rim.
// Calm (save.calm): no flicker, no wiggle, no smoke; it still crawls (that is the game). PERF.low: no buds, a plain tail.
// Sprites (PERF): the head's knot and one thorn are painted once per size (and char step) and placed with one transform.
import { CREEP } from '../sim/creeper.js';
import { RING_TH } from '../sim/geom.js';
import { PERF } from '../perf.js';
import { freeCanvas } from './cvfree.js';
import { stampStats } from './stamp.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
const outBack = (u, s = 1.9) => { u = clamp(u, 0, 1) - 1; return 1 + u * u * ((s + 1) * u + s); };
const out3 = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
// the bramble's own colours (render/v3art.js drawThornCurtain)
export const BR = { cane: '#4f8f37', back: '#356a2c', vein: '#b4e372', edge: '#132812', knot: '#6a4526', knotLit: '#9a6c3c', knotDark: '#3e2814', leaf: '#62b23c', leafLit: '#96d65e', th: '#d23a3a', thLit: '#ea634c', thShade: '#93282f', thEdge: '#3a0d0d', rim: 'rgba(255,240,214,0.92)', char: '#2b1a16', charTh: '#5a2030' };
const mix = (a, b, k) => { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), c = (sh) => Math.round(((pa >> sh) & 255) + (((pb >> sh) & 255) - ((pa >> sh) & 255)) * k); return `rgb(${c(16)},${c(8)},${c(0)})`; };

// ------------------------------------------------------------------ sprites
const SPR = new Map();
function sprite(key, W, H, paint) {
  let cv = SPR.get(key);
  if (cv) return cv;
  if (typeof document === 'undefined' || !stampStats.on) return null;
  cv = document.createElement('canvas'); cv.width = Math.max(2, Math.ceil(W)); cv.height = Math.max(2, Math.ceil(H));
  const c = cv.getContext('2d'); if (!c) return null;
  paint(c);
  SPR.set(key, cv); stampStats.builds++;
  if (SPR.size > 60) { const k0 = SPR.keys().next().value; freeCanvas(SPR.get(k0)); SPR.delete(k0); }
  return cv;
}
export function freeCreepers() { for (const cv of SPR.values()) freeCanvas(cv); SPR.clear(); }
// px size steps (x1.15), so a camera zoom only repaints now and then
const qpx = (r) => Math.pow(1.15, Math.ceil(Math.log(Math.max(2, r)) / Math.log(1.15)));

// the head's knot: a ball of braided canes, shaded from the top left, dark outline; ch = how charred (0..1)
function paintKnot(c, R, ch) {
  const col = (x) => (ch > 0 ? mix(x, BR.char, ch) : x), ol = Math.max(1.2, R * 0.13);
  c.lineCap = 'round'; c.lineJoin = 'round';
  if (ch < 0.5) { c.beginPath(); c.arc(0, 0, R + ol * 0.55, 0, TAU); c.lineWidth = ol * 1.1; c.strokeStyle = BR.rim; c.stroke(); }
  c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fillStyle = BR.edge; c.fill();
  const g = c.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R);
  g.addColorStop(0, col(BR.leafLit)); g.addColorStop(0.45, col(BR.cane)); g.addColorStop(1, col(BR.back));
  c.beginPath(); c.arc(0, 0, R - ol * 0.7, 0, TAU); c.fillStyle = g; c.fill();
  // canes wound round it (darker bands) and their light veins
  c.save(); c.beginPath(); c.arc(0, 0, R - ol * 0.7, 0, TAU); c.clip();
  for (let i = 0; i < 3; i++) {
    const a = -0.9 + i * 1.05;
    c.beginPath(); c.ellipse(0, 0, R * 1.05, R * (0.32 + 0.12 * i), a, 0.25, Math.PI - 0.25); c.lineWidth = R * 0.2; c.strokeStyle = col(BR.back); c.stroke();
    c.beginPath(); c.ellipse(0, 0, R * 1.05, R * (0.32 + 0.12 * i), a, 0.5, 1.4); c.lineWidth = R * 0.07; c.strokeStyle = ch > 0.5 ? 'rgba(0,0,0,0)' : col(BR.vein); c.globalAlpha = 0.7; c.stroke(); c.globalAlpha = 1;
  }
  // a knot of bark on its crown
  c.beginPath(); c.ellipse(-R * 0.05, -R * 0.62, R * 0.28, R * 0.18, -0.2, 0, TAU); c.fillStyle = col(BR.knot); c.fill();
  c.beginPath(); c.ellipse(-R * 0.12, -R * 0.68, R * 0.12, R * 0.07, -0.2, 0, TAU); c.fillStyle = col(BR.knotLit); c.fill();
  c.restore();
  // the glint
  if (ch < 0.5) { c.beginPath(); c.ellipse(-R * 0.42, -R * 0.38, R * 0.17, R * 0.1, -0.7, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.45)'; c.fill(); }
}
// one big thorn, root at (0, 0), pointing up (-y) L long, W wide at the root: the ring thorns' look (two facets, cream rim)
function paintThorn(c, L, W, ch) {
  const hook = W * 0.22, shape = () => { c.beginPath(); c.moveTo(-W / 2, 0); c.quadraticCurveTo(-W * 0.18, -L * 0.55, hook, -L); c.quadraticCurveTo(W * 0.3, -L * 0.45, W / 2, 0); c.closePath(); };
  c.lineJoin = 'miter'; c.miterLimit = 8;
  shape(); if (!ch) { c.lineWidth = Math.max(2.2, W * 0.36); c.strokeStyle = BR.rim; c.stroke(); }
  c.lineWidth = Math.max(1.2, W * 0.17); c.strokeStyle = BR.thEdge; c.stroke();
  c.fillStyle = ch ? BR.charTh : BR.th; c.fill();
  if (!ch) {
    c.save(); shape(); c.clip();
    c.beginPath(); c.moveTo(0, 0); c.lineTo(-W, 0); c.lineTo(hook - W * 0.4, -L * 1.1); c.lineTo(hook, -L * 1.05); c.closePath(); c.fillStyle = BR.thLit; c.fill();
    c.beginPath(); c.moveTo(0, 0); c.lineTo(W, 0); c.lineTo(hook + W * 0.3, -L * 1.1); c.lineTo(hook, -L * 1.05); c.closePath(); c.fillStyle = BR.thShade; c.fill();
    c.restore();
  }
}
function knotSprite(Rpx, ch) {
  const R = qpx(Rpx), cq = Math.round(ch * 4) / 4, P = Math.ceil(R * 0.25) + 2, S = Math.ceil(2 * R + 2 * P);
  const cv = sprite('k' + R.toFixed(1) + ':' + cq, S, S, (c) => { c.translate(S / 2, S / 2); paintKnot(c, R, cq); });
  return cv ? { cv, R, S } : null;
}
function thornSprite(Lpx, ch) {
  const L = qpx(Lpx), W = L * 0.62, P = Math.ceil(W * 0.4) + 2, w = Math.ceil(W + 2 * P), h = Math.ceil(L * 1.1 + 2 * P);
  const cv = sprite('t' + L.toFixed(1) + (ch ? 'c' : ''), w, h, (c) => { c.translate(w / 2, h - P); paintThorn(c, L, W, ch); });
  return cv ? { cv, L, w, h, P } : null;
}

// ------------------------------------------------------------------ the pose from the sim state
const MEM = new Map();
const ART = 1.15; // the head is drawn this much over the sim's headR (the thorns are the reach)
function pose(sim, C, t, calm) {
  const el = C.dur - C.t, T = sim.creepCrawlT ? sim.creepCrawlT(C) : 3, peak = ((C.a1 - C.a0) * C.rh / T) * 1.5;
  const P = { u: C.u, dir: C.dir, lift: CREEP.lift, sc: 1, lean: 0, sx: 1, sy: 1, rear: 0, bristle: 0.55, eyes: 'open', ch: 0, crumble: 0, stump: 0, sprout: 0, chomp: 0, curl: 0, head: 1, snap: 0, wiggle: 0, flame: 0 };
  const spdN = clamp(C.spd / Math.max(0.05, peak), 0, 1.2);
  switch (C.ph) {
    case 'crawl': {
      P.lean = 0.38 * spdN; P.sx = 1 + 0.12 * spdN; P.sy = 1 - 0.07 * spdN; P.bristle = 0.6 + 0.6 * spdN; P.wiggle = spdN; P.eyes = 'hunt';
      P.curl = 1 - out3(clamp(C.s * T / 0.35, 0, 1)); // the tail unwinds as it sets off
      if (C.s < 0.08) { const q = C.s / 0.08; P.sx *= 1 + 0.1 * Math.sin(q * Math.PI); P.bristle += 0.25 * Math.sin(q * Math.PI); } // the launch overshoot
      break;
    }
    case 'coil': {
      const rest = C.dur, w = clamp((el - (rest - CREEP.wind)) / CREEP.wind, 0, 1); // the wind-up: the last CREEP.wind s
      const inC = out3(clamp(el / 0.3, 0, 1)), sleep = calm ? 1 : inC;
      P.curl = w > 0 ? 1 - 0.35 * sstep(w) : sleep; P.zz = w > 0 ? 0 : clamp((el - 0.25) / 0.25, 0, 1); P.lift = CREEP.lift * (0.62 + 0.38 * sstep(w)); P.sc = 0.88 + 0.12 * sstep(w);
      P.bristle = 0.18 + 1.15 * outBack(w, 2.4) * (w > 0 ? 1 : 0); P.eyes = w > 0.2 ? 'wide' : 'shut';
      P.rear = w > 0 ? Math.sin(sstep(w) * Math.PI * 0.5) : 0; P.sy = 1 + 0.12 * P.rear; P.sx = 1 - 0.1 * P.rear;
      if (!calm && w <= 0) { const br = Math.sin(t * 2.4 + C.id) * 0.03; P.sy += br; P.sx -= br; } // it breathes, asleep
      if (!calm && w > 0.5) P.shiver = Math.sin(t * 70) * 0.02 * w;
      P.dir = C.dir; // (already turned round for the next crawl)
      break;
    }
    case 'bite': { const q = clamp(el / CREEP.bite, 0, 1); P.chomp = Math.abs(Math.sin(q * Math.PI * 2.5)) * (1 - q * 0.5); P.bristle = 1.25; P.eyes = 'glee'; P.lean = 0.25; break; }
    case 'burn': {
      const q = clamp(el / CREEP.burn, 0, 1);
      if (C.why === 'snap') { P.snap = q; P.head = 0; P.stump = sstep(q * 2); P.eyes = 'x'; }
      else { P.ch = sstep(q * 1.4); P.flame = 1 - sstep((q - 0.55) / 0.45); P.sc = 1 - 0.35 * sstep(q); P.crumble = sstep((q - 0.55) / 0.45); P.bristle = 0.9 * (1 - q); P.eyes = q < 0.5 ? 'x' : 'none'; P.stump = sstep((q - 0.5) / 0.5); P.curl = 0.6; }
      break;
    }
    case 'stump': P.head = 0; P.stump = 1; P.eyes = 'none'; break;
    case 'grow': { const q = clamp(el / CREEP.grow, 0, 1); P.stump = 1 - sstep((q - 0.6) / 0.4); P.sprout = q; P.head = outBack(clamp((q - 0.45) / 0.55, 0, 1), 2.2); P.eyes = q > 0.8 ? 'open' : 'shut'; P.bristle = 0.3 + 0.5 * q; P.curl = 1; break; }
    case 'gone': P.head = 0; P.stump = 0; break;
  }
  // smoothing (frame memory): the bristle and lean ease, never snap
  let M = MEM.get(C);
  if (!M || M.sim !== sim) { M = { sim, t, br: P.bristle, lean: P.lean, curl: P.curl }; MEM.set(C, M); }
  const dt = clamp(t - M.t, 0, 0.1); M.t = t;
  const f = 1 - Math.exp(-dt * 16), fc = 1 - Math.exp(-dt * 10);
  M.br += (P.bristle - M.br) * f; M.lean += (P.lean - M.lean) * f; M.curl += (P.curl - M.curl) * fc;
  if (calm) { M.br = P.bristle; M.lean = P.lean; M.curl = P.curl; }
  P.bristle = M.br; P.lean = M.lean; P.curl = M.curl;
  return P;
}

// ------------------------------------------------------------------ the track (the stretch it will crawl)
function drawTrack(ctx, ring, C, k, t, calm, low, P, gone) {
  const A = ring.body.getAngle(), nrm = C.side === 'in' ? -1 : 1, rf = ring.r + (C.side === 'in' ? -RING_TH / 2 : RING_TH / 2), r0 = rf + nrm * 0.022;
  const n = Math.max(8, Math.ceil((C.a1 - C.a0) * rf / 0.06)), pt = (a, lift) => [(r0 + nrm * lift) * Math.cos(A + a), (r0 + nrm * lift) * Math.sin(A + a)];
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const wav = (i) => Math.sin(i * 1.7 + C.id) * 0.008;
  const path = () => { ctx.beginPath(); for (let i = 0; i <= n; i++) { const [x, y] = pt(C.a0 + ((C.a1 - C.a0) * i) / n, wav(i)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } };
  ctx.globalAlpha *= gone ? 0.3 : 0.6;
  path(); ctx.lineWidth = 0.05; ctx.strokeStyle = gone ? '#3a2a1a' : BR.edge; ctx.stroke();
  path(); ctx.lineWidth = 0.03; ctx.strokeStyle = gone ? '#7a6a4a' : BR.back; ctx.stroke();
  // tiny buds along it (they perk up as the head goes by)
  if (!low && !gone) {
    const step = 0.2, m = Math.max(2, Math.round(((C.a1 - C.a0) * rf) / step));
    for (let i = 1; i < m; i++) {
      const a = C.a0 + ((C.a1 - C.a0) * i) / m, s = i % 2 ? 1 : -1, near = P.head > 0 ? clamp(1 - (Math.abs(a - P.u) * rf) / 0.3, 0, 1) : 0;
      const [x, y] = pt(a, 0.012), ang = A + a + (C.side === 'in' ? Math.PI : 0), up = 0.035 + 0.025 * near;
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang + s * 0.5 + (calm ? 0 : Math.sin(t * 1.3 + i) * 0.08)); ctx.scale(1, 1);
      ctx.beginPath(); ctx.ellipse(up * 0.6, 0, up * 0.75, up * 0.38, 0, 0, TAU); ctx.fillStyle = i % 3 ? BR.leaf : BR.leafLit; ctx.fill();
      ctx.lineWidth = 0.008; ctx.strokeStyle = BR.edge; ctx.stroke();
      ctx.restore();
    }
  }
  // a root knot at each end: where it turns round
  for (const a of [C.a0, C.a1]) {
    const [x, y] = pt(a, 0.01);
    ctx.beginPath(); ctx.arc(x, y, 0.045, 0, TAU); ctx.fillStyle = gone ? '#5a4632' : BR.knot; ctx.fill();
    ctx.lineWidth = 0.012; ctx.strokeStyle = BR.knotDark; ctx.stroke();
    ctx.beginPath(); ctx.arc(x - 0.012, y + 0.012, 0.016, 0, TAU); ctx.fillStyle = gone ? '#7a6a52' : BR.knotLit; ctx.fill();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ the creeper
export function drawCreepers(ctx, sim, t, k, calm = false) {
  if (!sim.creeps || !sim.creeps.length) return;
  const low = !!PERF.low;
  for (const C of sim.creeps) {
    const ring = sim.rings[C.ri];
    if (!ring) continue;
    const P = pose(sim, C, t, calm);
    drawTrack(ctx, ring, C, k, t, calm, low, P, C.ph === 'gone');
    if (C.ph === 'gone') continue;
    const A = ring.body.getAngle(), Aw = A + P.u, nrm = C.side === 'in' ? -1 : 1, rf = ring.r + (C.side === 'in' ? -RING_TH / 2 : RING_TH / 2);
    // the local frame on the rim under the head: px, +x = the way it crawls, -y = off the rim
    const ux = nrm * Math.cos(Aw), uy = nrm * Math.sin(Aw), face = (C.side === 'in' ? 1 : -1) * P.dir;
    ctx.save();
    ctx.translate(rf * Math.cos(Aw), rf * Math.sin(Aw)); ctx.scale(1 / k, -1 / k); ctx.rotate(Math.atan2(ux, uy)); ctx.scale(face, 1);
    try { drawBody(ctx, sim, C, P, k, t, calm, low, rf); } finally { ctx.restore(); }
  }
}

// px helpers inside the local frame: the rim is the line y = 0 (it bends a little: the ring's curve)
function drawBody(c, sim, C, P, k, t, calm, low, rf) {
  const R = CREEP.headR * ART * k * P.sc, lift = P.lift * k, Rr = rf * k, bend = (x) => (C.side === 'in' ? -1 : 1) * (x * x) / (2 * Rr); // the rim x px along from the head bends this far (y down): toward the ring's centre
  // the stump (under everything)
  if (P.stump > 0) drawStump(c, k, P.stump, t, calm, low, C);
  if (P.sprout > 0) drawSprout(c, k, P.sprout, t, calm);
  // the tail: back along the track, or wound round the head when it curls up
  const hx = -P.rear * R * 0.35 + (P.shiver || 0) * R, hy = -lift + bend(hx);
  const tailK = C.ph === 'stump' ? 0 : C.ph === 'grow' ? clamp(P.head, 0, 1) : 1 - P.crumble;
  if (tailK > 0.02 && !P.snap) drawTail(c, C, P, k, t, calm, low, R, hx, hy, bend, tailK);
  else if (P.snap > 0 && P.snap < 0.5) drawTail(c, C, P, k, t, calm, low, R, hx, hy, bend, 1 - P.snap * 2);
  if (P.snap > 0) { // snapped off by a stone egg: the head flies off backwards, spinning, and fades
    const q = P.snap, X = hx - R * 4 * q, Y = hy - R * 3.2 * Math.sin(q * Math.PI * 0.8) + R * 3 * q * q;
    c.save(); c.globalAlpha *= 1 - sstep((q - 0.5) / 0.5); c.translate(X, Y); c.rotate(-q * 7);
    headArt(c, R, { ...P, eyes: 'x', bristle: 0.6, ch: 0 }, t, calm); c.restore();
    return;
  }
  if (P.head <= 0.01) return;
  c.save();
  c.translate(hx, hy);
  // soft shadow on the rim
  c.save(); c.globalAlpha *= 0.22 * P.head; c.fillStyle = '#000'; c.beginPath(); c.ellipse(R * 0.1, lift - R * 0.05, R * 1.05, R * 0.25, 0, 0, TAU); c.fill(); c.restore();
  c.rotate(P.lean + (P.chomp ? P.chomp * 0.12 : 0));
  c.scale(P.sx * P.head, P.sy * P.head);
  if (P.chomp) c.translate(R * 0.25 * P.chomp, 0);
  if (P.crumble > 0) { c.globalAlpha *= 1 - P.crumble; c.translate(0, R * 0.8 * P.crumble); c.scale(1 - 0.4 * P.crumble, 1 - 0.6 * P.crumble); }
  headArt(c, R, P, t, calm);
  c.restore();
  if (P.flame > 0.01) drawFlames(c, hx, hy, R, P.flame, t, calm);
  if (P.crumble > 0 && P.crumble < 1) { // bits of char falling off
    c.save(); c.fillStyle = BR.char;
    for (let i = 0; i < 6; i++) { const a = i * 1.1, q = P.crumble; c.globalAlpha = 1 - q; c.beginPath(); c.arc(hx + Math.cos(a) * R * (0.4 + q), hy - R * 0.2 + R * 1.6 * q * q + Math.sin(a) * R * 0.3, R * 0.13, 0, TAU); c.fill(); }
    c.restore();
  }
}

// the head: thorns behind and round it, the knot, the eyes (and a jaw when it bites)
function headArt(c, R, P, t, calm) {
  const ch = P.ch || 0, br = Math.max(0.08, P.bristle);
  const TS = thornSprite(R * 0.95, ch > 0.5);
  // seven thorns over its back and crown (none into the rim): angle from straight up, + = forward
  const TH = [-2.05, -1.45, -0.85, -0.25, 0.35, 0.95, 1.55];
  for (let i = 0; i < TH.length; i++) {
    const a = TH[i] + (calm ? 0 : Math.sin(t * 9 + i * 1.7) * 0.05 * P.wiggle), len = br * (0.82 + 0.18 * ((i * 0.618) % 1)) * (i === 3 ? 1.12 : 1);
    c.save(); c.rotate(a); c.translate(0, -R * 0.78);
    c.scale(0.92 + 0.1 * br, len);
    if (TS) c.drawImage(TS.cv, -TS.w / 2 * (R * 0.95 / TS.L), -(TS.h - TS.P) * (R * 0.95 / TS.L), TS.w * (R * 0.95 / TS.L), TS.h * (R * 0.95 / TS.L));
    else paintThorn(c, R * 0.95, R * 0.59, ch > 0.5);
    c.restore();
  }
  const KS = knotSprite(R, ch);
  if (KS) { const s = R / KS.R; c.drawImage(KS.cv, -KS.S / 2 * s, -KS.S / 2 * s, KS.S * s, KS.S * s); } else paintKnot(c, R, ch);
  // the jaw: a dark notch with little teeth, open while it chomps
  if (P.chomp > 0.05) {
    const o = P.chomp * R * 0.35;
    c.beginPath(); c.moveTo(R * 0.95, -R * 0.05 - o * 0.4); c.quadraticCurveTo(R * 0.4, R * 0.1, R * 0.95, R * 0.12 + o); c.closePath(); c.fillStyle = '#2a0c0c'; c.fill();
    c.fillStyle = '#fff4dc'; for (const yy of [-R * 0.02 - o * 0.3, R * 0.1 + o * 0.85]) { c.beginPath(); c.moveTo(R * 0.72, yy); c.lineTo(R * 0.8, yy + (yy < 0 ? R * 0.1 : -R * 0.1)); c.lineTo(R * 0.88, yy); c.closePath(); c.fill(); }
  }
  eyes(c, R, P.eyes, t, calm, ch);
  if (P.eyes === 'shut' && P.zz) snooze(c, R, t, calm, P.zz);
}
// two little z's drift up off a curled-up creeper: asleep, safe to pass (drawn, not lettered)
function snooze(c, R, t, calm, a) {
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  for (let i = 0; i < (calm ? 1 : 2); i++) {
    const q = calm ? 0.45 : (t * 0.7 + i * 0.5) % 1, s = R * (0.32 + 0.22 * q), x = R * (0.75 + 0.5 * q) + (calm ? 0 : Math.sin(q * 6) * R * 0.08), y = -R * (1.0 + 1.1 * q);
    c.globalAlpha = a * (calm ? 0.9 : Math.sin(q * Math.PI));
    const zp = () => { c.beginPath(); c.moveTo(x - s / 2, y - s / 2); c.lineTo(x + s / 2, y - s / 2); c.lineTo(x - s / 2, y + s / 2); c.lineTo(x + s / 2, y + s / 2); };
    zp(); c.lineWidth = Math.max(2.4, R * 0.2); c.strokeStyle = BR.edge; c.stroke();
    zp(); c.lineWidth = Math.max(1.3, R * 0.1); c.strokeStyle = '#fff6d0'; c.stroke();
  }
  c.restore();
}
function eyes(c, R, mode, t, calm, ch) {
  if (mode === 'none') return;
  const ex = [R * 0.14, R * 0.56], ey = -R * 0.16, er = R * 0.25;
  c.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    const x = ex[i], y = ey + (i ? R * 0.04 : 0), rr = er * (i ? 0.92 : 1);
    if (mode === 'shut') { c.beginPath(); c.arc(x, y - rr * 0.2, rr * 0.85, 0.25, Math.PI - 0.25); c.lineWidth = Math.max(1.2, R * 0.07); c.strokeStyle = '#132812'; c.stroke(); continue; }
    if (mode === 'x') { c.lineWidth = Math.max(1.2, R * 0.07); c.strokeStyle = '#1a0a06'; c.beginPath(); c.moveTo(x - rr * 0.6, y - rr * 0.6); c.lineTo(x + rr * 0.6, y + rr * 0.6); c.moveTo(x + rr * 0.6, y - rr * 0.6); c.lineTo(x - rr * 0.6, y + rr * 0.6); c.stroke(); continue; }
    const wide = mode === 'wide', big = wide ? 1.22 : 1;
    c.beginPath(); c.ellipse(x, y, rr * 0.86 * big, rr * big, 0, 0, TAU); c.fillStyle = ch > 0.4 ? '#c9b48a' : '#fff6d0'; c.fill();
    c.lineWidth = Math.max(1, R * 0.05); c.strokeStyle = '#132812'; c.stroke();
    // the pupil looks the way it goes (a slit of amber when it hunts)
    const px = x + rr * 0.32, py = y + rr * 0.08;
    c.beginPath(); c.ellipse(px, py, rr * (mode === 'hunt' ? 0.32 : 0.42), rr * 0.6, 0, 0, TAU); c.fillStyle = wide ? '#a8231c' : mode === 'hunt' ? '#b86a10' : '#2a1406'; c.fill();
    c.beginPath(); c.ellipse(px, py, rr * 0.14, rr * 0.42, 0, 0, TAU); c.fillStyle = '#120806'; c.fill();
    c.beginPath(); c.arc(px - rr * 0.12, py - rr * 0.3, rr * 0.13, 0, TAU); c.fillStyle = '#fff'; c.fill();
    // a frowning brow when it hunts or rears
    if (mode === 'hunt' || wide || mode === 'glee') { c.beginPath(); c.moveTo(x - rr * 0.9, y - rr * (wide ? 1.35 : 1.05)); c.lineTo(x + rr * 0.85, y - rr * (wide ? 1.1 : 0.7)); c.lineWidth = Math.max(1.4, R * 0.09); c.strokeStyle = '#132812'; c.stroke(); }
  }
}
// the trailing vine: back along the track (bending with the rim), a travelling wiggle while it crawls; when it curls,
// the same vine winds round the head as a spiral
function drawTail(c, C, P, k, t, calm, low, R, hx, hy, bend, tk = 1) {
  const TL = 0.62 * k * tk, N = low ? 9 : 16, curl = clamp(P.curl, 0, 1);
  // how much track there is behind the head (a tail longer than that folds into the curl at the end knot)
  const back = (P.dir > 0 ? P.u - C.a0 : C.a1 - P.u) * C.rh * k;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    // straight: behind the head along the rim, lower toward the tip
    let d = s * TL, extra = 0;
    if (d > back) { extra = d - back; d = back; }
    const wig = calm ? 0 : Math.sin(t * 10 - s * 7) * R * 0.18 * P.wiggle * s;
    let sx = hx * (1 - s) - d - R * 0.6 * (1 - s) * 0, sy = -(P.lift * k) * (1 - s * 0.82) + bend(-d) + wig;
    if (extra > 0) { const ph = extra / (R * 0.7); sx = -back + Math.sin(ph) * R * 0.5 * (1 - ph * 0.08); sy = -R * 0.5 + Math.cos(ph) * R * 0.5 + bend(-back); }
    // curled: a spiral round the head
    const ang = Math.PI * 0.55 + s * Math.PI * 2.1, rad = R * (1.22 - 0.55 * s);
    const cx = hx + Math.cos(ang) * rad * -1, cy = hy + Math.sin(ang) * rad * 0.9 + R * 0.15;
    pts.push([sx + (cx - sx) * curl, sy + (cy - sy) * curl]);
  }
  const ch = P.ch || 0, cane = ch ? mix(BR.cane, BR.char, ch) : BR.cane, edge = BR.edge;
  c.lineCap = 'round'; c.lineJoin = 'round';
  const w0 = R * 0.62 * (0.5 + 0.5 * tk), w1 = R * 0.2;
  const stroke = (col, add) => { for (let i = 0; i < N; i++) { const s = i / N; c.beginPath(); c.moveTo(pts[i][0], pts[i][1]); c.lineTo(pts[i + 1][0], pts[i + 1][1]); c.lineWidth = w0 + (w1 - w0) * s + add; c.strokeStyle = col; c.stroke(); } };
  if (!ch) { c.save(); c.globalAlpha *= 0.75; stroke(BR.rim, Math.max(3.5, R * 0.34)); c.restore(); } // the cream rim: it reads on any ring
  stroke(edge, Math.max(2, R * 0.16));
  stroke(cane, 0);
  if (!low && !ch) { c.save(); c.globalAlpha *= 0.7; c.beginPath(); for (let i = 0; i <= N - 3; i++) { const [x, y] = pts[i]; i ? c.lineTo(x, y - R * 0.08) : c.moveTo(x, y - R * 0.08); } c.lineWidth = R * 0.08; c.strokeStyle = BR.vein; c.stroke(); c.restore(); }
  // a few small thorns on the vine (they stand up as it speeds)
  if (!low) {
    for (const s of [0.3, 0.55, 0.8]) {
      const i = Math.round(s * N), [x, y] = pts[i], [x2, y2] = pts[Math.min(N, i + 1)], a = Math.atan2(y2 - y, x2 - x), L = R * (0.3 + 0.25 * P.bristle) * (1 - s * 0.4);
      c.save(); c.translate(x, y); c.rotate(a - Math.PI / 2 + (i % 2 ? 0.3 : -0.3) + Math.PI);
      c.beginPath(); c.moveTo(-L * 0.35, 0); c.lineTo(0, -L); c.lineTo(L * 0.35, 0); c.closePath(); c.fillStyle = ch ? BR.charTh : BR.th; c.fill(); c.lineWidth = Math.max(1, R * 0.05); c.strokeStyle = BR.thEdge; c.stroke();
      c.restore();
    }
    // a leaf near the head
    const [lx, ly] = pts[2];
    c.save(); c.translate(lx, ly - R * 0.15); c.rotate(-0.9 + (calm ? 0 : Math.sin(t * 3) * 0.12)); c.beginPath(); c.ellipse(R * 0.3, 0, R * 0.34, R * 0.16, 0, 0, TAU); c.fillStyle = ch ? mix(BR.leaf, BR.char, ch) : BR.leaf; c.fill(); c.lineWidth = Math.max(1, R * 0.05); c.strokeStyle = BR.edge; c.stroke(); c.restore();
  }
}
function drawFlames(c, x, y, R, a, t, calm) {
  c.save(); c.translate(x, y);
  for (let i = 0; i < 4; i++) {
    const ph = calm ? i : t * 13 + i * 1.9, h = R * (1.1 + 0.35 * Math.sin(ph)) * a, ox = (i - 1.5) * R * 0.42, w = R * 0.42 * a;
    const g = c.createLinearGradient(0, R * 0.2, 0, -h);
    g.addColorStop(0, 'rgba(255,214,90,0.95)'); g.addColorStop(0.5, 'rgba(255,120,30,0.85)'); g.addColorStop(1, 'rgba(220,40,20,0)');
    c.beginPath(); c.moveTo(ox - w, R * 0.2); c.quadraticCurveTo(ox - w * 0.8, -h * 0.5, ox + (calm ? 0 : Math.sin(ph * 1.3) * w * 0.4), -h); c.quadraticCurveTo(ox + w * 0.8, -h * 0.5, ox + w, R * 0.2); c.closePath();
    c.fillStyle = g; c.fill();
  }
  c.restore();
}
// the stump left on the rim: a short knotted nub, charred on top; a thread of smoke while it is fresh
function drawStump(c, k, a, t, calm, low, C) {
  const w = 0.15 * k, h = 0.13 * k * a;
  c.save();
  c.beginPath(); c.moveTo(-w / 2, 2); c.lineTo(-w * 0.42, -h); c.quadraticCurveTo(0, -h - w * 0.2, w * 0.42, -h); c.lineTo(w / 2, 2); c.closePath();
  c.fillStyle = BR.knot; c.fill(); c.lineWidth = Math.max(1.2, w * 0.1); c.strokeStyle = BR.knotDark; c.stroke();
  c.beginPath(); c.ellipse(0, -h, w * 0.42, w * 0.14, 0, 0, TAU); c.fillStyle = BR.char; c.fill();
  c.beginPath(); c.ellipse(0, -h, w * 0.22, w * 0.07, 0, 0, TAU); c.strokeStyle = '#6a4a30'; c.lineWidth = Math.max(1, w * 0.05); c.stroke();
  if (!calm && !low && C.ph === 'stump' && C.dur - C.t < 3) { // a thread of smoke for the first seconds
    const q = (C.dur - C.t) / 3;
    c.globalAlpha *= 0.4 * (1 - q); c.strokeStyle = '#8a8580'; c.lineWidth = w * 0.18; c.lineCap = 'round';
    c.beginPath(); for (let i = 0; i <= 8; i++) { const yy = -h - i * w * 0.4, xx = Math.sin(t * 2 + i * 0.8) * w * 0.25 * (i / 8); i ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } c.stroke();
  }
  c.restore();
}
// the sprout: a green shoot unrolls out of the stump (a spiral opening), two leaves pop, then the head grows on it
function drawSprout(c, k, q, t, calm) {
  const L = 0.2 * k * outBack(clamp(q / 0.6, 0, 1), 1.6), N = 12;
  c.save(); c.lineCap = 'round';
  c.beginPath();
  for (let i = 0; i <= N; i++) { const s = i / N, open = clamp(q / 0.6, 0, 1), ang = -Math.PI / 2 + (1 - open) * s * 4.5, rr = L * s; const x = Math.cos(ang) * rr * (1 - open) + Math.sin(s * 3) * L * 0.08, y = -0.06 * k * Math.min(1, q * 3) - s * L * open + Math.sin(ang) * rr * (1 - open) * 0.6; i ? c.lineTo(x, y) : c.moveTo(x, y); }
  c.lineWidth = 0.035 * k; c.strokeStyle = BR.edge; c.stroke(); c.lineWidth = 0.022 * k; c.strokeStyle = BR.cane; c.stroke();
  const lf = outBack(clamp((q - 0.3) / 0.35, 0, 1), 2.4);
  if (lf > 0) for (const s of [-1, 1]) { c.save(); c.translate(0, -0.1 * k * Math.min(1, q * 2)); c.rotate(s * 1.0); c.scale(lf, lf); c.beginPath(); c.ellipse(s * 0.045 * k, 0, 0.05 * k, 0.022 * k, 0, 0, TAU); c.fillStyle = BR.leafLit; c.fill(); c.lineWidth = Math.max(1, 0.006 * k); c.strokeStyle = BR.edge; c.stroke(); c.restore(); }
  c.restore();
}

// ------------------------------------------------------------------ events (main.js handleEvents)
export function creeperEvent(ev, fx, U) {
  const A = U.audio, calm = !!U.calm;
  switch (ev.type) {
    case 'creepGo': A.play('squish', { vol: 0.28, pitch: 1.7 }); break; // a rustle as it sets off
    case 'creepCoil': A.play('squish', { vol: 0.16, pitch: 1.25 }); break;
    case 'creepHit': A.play('thorn_hit', { vol: 0.8 }); fx.chips && fx.chips(ev.x, ev.y, '#d23a3a', 6, 1.6); break;
    case 'creepBurn': A.play('fire_burn'); fx.smoke && fx.smoke(ev.x, ev.y + 0.2, calm ? 1 : 3); fx.chips && fx.chips(ev.x, ev.y, '#ff8a3a', 7, 2); break;
    case 'creepSnap': A.play('thorn_snap'); fx.chips && fx.chips(ev.x, ev.y, '#4f8f37', 7, 2.2); break;
    case 'creepSnip': A.play('thorn_snap', { pitch: 1.3 }); fx.chips && fx.chips(ev.x, ev.y, '#4f8f37', 6, 1.6); break;
    case 'creepGrow': A.play('bubble_on', { vol: 0.3, pitch: 1.7 }); fx.sparkle && fx.sparkle(ev.x, ev.y, calm ? 2 : 5, '#b4e372'); break;
  }
}

// ------------------------------------------------------------------ portrait and the level card's scene
// the "i" panel / card tile portrait: the head on a short rim, crawling (screen space, y down, centred in a d x d box)
export function drawCreeperPortrait(ctx, x, y, d, t) {
  const R = d * 0.2, P = { u: 0, dir: 1, lift: 0, sc: 1, lean: 0.25, sx: 1.06, sy: 0.96, bristle: 0.95 + 0.2 * Math.sin(t * 3), eyes: 'hunt', ch: 0, wiggle: 0.6, chomp: 0 };
  ctx.save();
  ctx.fillStyle = '#b9854e'; ctx.fillRect(x - d * 0.44, y + d * 0.2, d * 0.88, d * 0.11);
  ctx.strokeStyle = '#2a1606'; ctx.lineWidth = Math.max(1, d * 0.02); ctx.strokeRect(x - d * 0.44, y + d * 0.2, d * 0.88, d * 0.11);
  ctx.lineCap = 'round';
  // the trailing vine behind it
  ctx.beginPath(); for (let i = 0; i <= 10; i++) { const s = i / 10, X = x - s * d * 0.42, Y = y + d * 0.2 - R * 0.7 * (1 - s * 0.8) + Math.sin(t * 6 - s * 6) * R * 0.08 * s; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
  ctx.lineWidth = R * 0.55; ctx.strokeStyle = BR.edge; ctx.stroke(); ctx.lineWidth = R * 0.36; ctx.strokeStyle = BR.cane; ctx.stroke();
  ctx.translate(x + d * 0.08, y + d * 0.2 - R * 1.05); ctx.rotate(P.lean);
  headArt(ctx, R, P, t, false);
  ctx.restore();
}
// The card scene (howact.js actor). Stage space: px, y down; S.at(phi, lift) a point on the ring floor (phi 0 = straight
// down, lift > 0 = inside); S.k px per metre. Its track lies on the floor between the egg and the gap.
//  'harm': it sets off from the far end, speeds up, runs into the egg: CRACK!
//  'turn': it crawls to the gap's end of its track and curls up (eyes shut); while it is curled the hand turns the ring,
//          the egg rolls over it and drops through the gap; it wakes, rears and crawls on behind.
export const CREEP_STAGE = { g0: -0.62, a0: -0.5, a1: -0.12 };
function stageCreep(c, S, u, P, track = true) {
  const { k, C, floor, t } = S, rimR = floor / k; // floor: the rim face's radius in px (from the stage ring's centre)
  const th = S.th || 0, Wd = (phi, lift) => S.at(phi + th, lift);
  // the track and its end knots
  if (track) {
    c.save(); c.lineCap = 'round'; c.globalAlpha *= 0.65;
    const n = 18; c.beginPath(); for (let i = 0; i <= n; i++) { const p = Wd(CREEP_STAGE.a0 + (CREEP_STAGE.a1 - CREEP_STAGE.a0) * i / n, 0.02 * k); i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); }
    c.lineWidth = 0.05 * k; c.strokeStyle = BR.edge; c.stroke(); c.lineWidth = 0.03 * k; c.strokeStyle = BR.back; c.stroke();
    c.globalAlpha /= 0.65;
    for (const a of [CREEP_STAGE.a0, CREEP_STAGE.a1]) { const p = Wd(a, 0.01 * k); c.beginPath(); c.arc(p.x, p.y, 0.05 * k, 0, TAU); c.fillStyle = BR.knot; c.fill(); c.lineWidth = 0.012 * k; c.strokeStyle = BR.knotDark; c.stroke(); }
    c.restore();
  }
  // the head: its local frame on the rim (+x the way it goes: phi rising = to the left on the stage... rotate to the rim)
  const p = Wd(u, 0), q = Wd(u + 0.01 * P.dir, 0), tl = Math.hypot(q.x - p.x, q.y - p.y) || 1, tx = (q.x - p.x) / tl, ty = (q.y - p.y) / tl;
  const ul = Math.hypot(C.x - p.x, C.y - p.y) || 1, ux = (C.x - p.x) / ul, uy = (C.y - p.y) / ul; // up: toward the stage ring's centre
  c.save(); c.transform(tx, ty, -ux, -uy, p.x, p.y); // local +x the way it goes, local -y up off the floor
  drawBody(c, null, { side: 'in', a0: CREEP_STAGE.a0, a1: CREEP_STAGE.a1, rh: rimR, id: 0, ph: P.ph || 'crawl', dur: 1, t: 1 }, P, k, t, !!S.calm, false, rimR);
  c.restore();
}
const cardPose = (o) => ({ u: 0, dir: 1, lift: CREEP.lift, sc: 1, lean: 0, sx: 1, sy: 1, rear: 0, bristle: 0.6, eyes: 'hunt', ch: 0, crumble: 0, stump: 0, sprout: 0, chomp: 0, curl: 0, head: 1, snap: 0, wiggle: 0, flame: 0, ...o });
export const CREEP_HIT = 1.25; // s into the card's harm beat when the head reaches the egg (howto.js cracks it then)
function actHarm(c, S) {
  const { T } = S, eggA = 0, touch = eggA - (S.eggS * 0.45 + CREEP.headR * S.k) / S.floor, start = -0.62;
  // it sets off (wind-up 0.2-0.5), crawls faster and faster, bites (1.25), chews
  let u = start, P;
  if (T < 0.5) { const w = sstep((T - 0.15) / 0.35); P = cardPose({ u, curl: 1 - 0.35 * w, eyes: w > 0.2 ? 'wide' : 'shut', bristle: 0.2 + 1.1 * outBack(w, 2.4) * (w > 0 ? 1 : 0), rear: w > 0 ? Math.sin(w * Math.PI * 0.5) : 0, lift: CREEP.lift * (0.62 + 0.38 * w) }); }
  else if (T < 1.25) { const q = (T - 0.5) / 0.75, f = q * q; u = start + (touch - start) * f; const sp = 2 * q; P = cardPose({ u, lean: 0.38 * Math.min(1, sp), bristle: 0.6 + 0.6 * Math.min(1, sp), wiggle: Math.min(1, sp), curl: 1 - out3(q * 3), sx: 1 + 0.12 * Math.min(1, sp), sy: 1 - 0.07 * Math.min(1, sp) }); }
  else { u = touch; const q = clamp((T - 1.25) / 0.6, 0, 1); P = cardPose({ u, chomp: Math.abs(Math.sin(q * Math.PI * 2.5)) * (1 - q * 0.5), bristle: 1.25, eyes: 'glee', lean: 0.25 }); }
  stageCreep(c, { ...S, th: 0 }, u, P);
  const p = S.at(touch, S.eggS);
  return { threat: true, bonk: 0, x: p.x, y: p.y, own: true };
}
function actTurn(c, S) {
  const { T } = S;
  // crawl to the gap's end (0-1.0), curl (1.0-1.25) and sleep while the ring turns (1.45-2.25): the egg rolls over it, drops
  let u, P;
  const a0 = CREEP_STAGE.a0, a1 = CREEP_STAGE.a1;
  if (T < 1.0) { const q = sstep(clamp((T + 0.25) / 1.25, 0, 1)); u = a1 + (a0 - a1) * q; const sp = Math.sin(q * Math.PI); P = cardPose({ u, lean: 0.38 * sp, bristle: 0.6 + 0.6 * sp, wiggle: sp, sx: 1 + 0.1 * sp, sy: 1 - 0.06 * sp }); P.dir = -1; }
  else if (T < 2.6) { u = a0; const q = out3((T - 1.0) / 0.3); P = cardPose({ u, curl: q, eyes: 'shut', bristle: 0.18 + 0.4 * (1 - q), lift: CREEP.lift * (1 - 0.38 * q), sc: 1 - 0.12 * q }); P.dir = 1; }
  else { const w = sstep((T - 2.6) / 0.35), q = clamp((T - 2.95) / 1.2, 0, 1); u = a0 + (a1 - a0) * sstep(q); P = cardPose({ u, curl: T < 2.95 ? 1 - 0.35 * w : 1 - out3(q * 3), eyes: T < 2.95 ? (w > 0.2 ? 'wide' : 'shut') : 'hunt', bristle: T < 2.95 ? 0.2 + 1.1 * outBack(w, 2.4) : 0.6 + 0.5 * Math.sin(q * Math.PI), rear: T < 2.95 ? Math.sin(w * Math.PI * 0.5) : 0, lean: T < 2.95 ? 0 : 0.3 * Math.sin(q * Math.PI), wiggle: T < 2.95 ? 0 : Math.sin(q * Math.PI) }); P.dir = 1; }
  stageCreep(c, S, u, P);
  const p = S.at(a0 + (S.th || 0), S.eggS);
  // a soft green "safe" ring round the curled head while the egg goes over it
  if (T > 1.2 && T < 2.5 && !S.calm) { c.save(); c.globalAlpha *= 0.5 * Math.min(clamp((T - 1.2) / 0.2, 0, 1), clamp((2.5 - T) / 0.2, 0, 1)); c.strokeStyle = '#9be36a'; c.lineWidth = 0.04 * S.k; const q = S.at(a0 + (S.th || 0), CREEP.lift * S.k * 0.6); c.beginPath(); c.arc(q.x, q.y, CREEP.headR * S.k * 1.9, 0, TAU); c.stroke(); c.restore(); }
  return { threat: T < 1.0, bonk: 0, x: p.x, y: p.y, own: true };
}
export const creeperActor = {
  draw: (c, S) => (S.m === 'harm' ? actHarm(c, S) : actTurn(c, S)),
  stage: (m) => (m === 'harm' ? { g0: 1.2, dTh: 0, pan: 0.1 } : { g0: CREEP_STAGE.g0, dTh: -CREEP_STAGE.g0, hand: [-0.55, 0.1], pan: 0.1 }),
  aim: (S) => S.at(CREEP_STAGE.a1, CREEP.headR * S.k),
};
