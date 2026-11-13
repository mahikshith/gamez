// The lava salamander's cousins in its v4 style (see salamander.js): the frost gecko, the thorn-back lizard and the
// chameleon. Thin same-hue lines, lit form, a face that acts. Same contract as drawCrawler in crawlers.js (snout at
// x, y; s = snout to hips; every pose channel of poseParams; opts.status / trail / gait / blend / out ...), and the same
// lengths, shoulders, hips and strides (SPECIES), so anchors, feet and size on screen are unchanged.
// drawCrawler() routes these three species here; opts.legacy draws the old rig.
import { SPECIES, poseParams, drawCrawlerThorn, drawPuddle } from './crawlers.js';
import { statusDraw, dizzyStars } from './status.js';
import { spline, blinkAt, hash } from './castkit.js';
import { drawLegs, lidEye, mixA, rgb, palOf, LX, LY, LEG_G } from './salamander.js';

export const COUSINS = { gecko: 1, thornback: 1, chameleon: 1 };

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
const lerp = (a, b, k) => a + (b - a) * k;
const mod = (a, b) => ((a % b) + b) % b;
const WHITE = [255, 255, 255];
const hues = (h) => { const f = (n) => { const k = (n + h * 12) % 12; return 255 * (0.62 - 0.38 * Math.max(-1, Math.min(k - 3, 9 - k, 1))); }; return [f(0), f(8), f(4)]; };

const NS = 46;
const bx = new Float64Array(NS), by = new Float64Array(NS), sx = new Float64Array(NS), sy = new Float64Array(NS), snx = new Float64Array(NS), sny = new Float64Array(NS), sw = new Float64Array(NS);
const PT = { x: 0, y: 0, a: 0 }, Q = { x: 0, y: 0, nx: 0, ny: 0, w: 0 };
const faceUp = {};
let UMAX = 178, DU = UMAX / (NS - 1), HW = null;
function hwAt(u) {
  if (u <= HW[0][0]) return HW[0][1];
  for (let i = 1; i < HW.length; i++) if (u <= HW[i][0]) { const a = HW[i - 1], b = HW[i], k = (u - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * (k * k * (3 - 2 * k)); }
  return HW[HW.length - 1][1];
}
function spInto(u, o) {
  const f = clamp(u / DU, 0, NS - 1.001), i = f | 0, k = f - i;
  o.x = sx[i] + (sx[i + 1] - sx[i]) * k; o.y = sy[i] + (sy[i + 1] - sy[i]) * k;
  o.nx = snx[i] + (snx[i + 1] - snx[i]) * k; o.ny = sny[i] + (sny[i + 1] - sny[i]) * k;
  o.w = sw[i] + (sw[i + 1] - sw[i]) * k;
  return o;
}
const spAt = (u) => spInto(u, { x: 0, y: 0, nx: 0, ny: 0, w: 0 });
// a point in body space: u along the spine, v across it (fraction of the half-width)
const uv = (u, v) => { const q = spInto(u, Q); return [q.x + q.nx * q.w * v, q.y + q.ny * q.w * v]; };
const poly = (ctx, pts) => { ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); };
const litSide = (u) => { const q = spInto(u, Q); return q.nx * LX + q.ny * LY > 0 ? 1 : -1; };

/* ---------------------------------------------------------------- the three (built on first draw: palOf lives in salamander.js) */
let DEF = null;
function defs() {
  if (DEF) return DEF;
  DEF = {
    // Frost gecko: glassy ice-blue, a leaf-fat tail with an icicle tip, huge round toe pads, gold slit eyes that give you the side-eye.
    gecko: {
      hw: [[0, 9], [14, 10], [30, 12], [46, 13.6], [60, 13.4], [72, 11.4], [82, 10.2], [94, 12.6], [110, 13.4], [130, 10.6], [152, 6], [168, 3], [178, 1.2]],
      wave: 5.4, tail: [2, 9], sway: 0.55, lat: [24, 25.5], hs: 1.4, shadow: [15, 17],
      G: { ...LEG_G, l1f: 12.5, l1h: 13, l2f: 12.5, l2h: 13, wf: 8, wh: 9.4, wl: 6, hf: 4.4, hh: 5.4, hl: 3.2, toes: 5, spread: 0.54, lenF: 8.2, lenH: 8.8, toeW: 2, tip: 3.9, pad: 2.7, palm: 4.2, knee: 0 },
      pal: palOf({ line: '#1c4c8a', lo: '#4f9bd6', base: '#9fd6f6', hi: '#d2f0ff', top: '#ffffff', blot: '#2467b4', blotHi: '#6fbdf0', jaw: '#f0fbff', leg: '#8cc8ee', legLo: '#4688c4', pad: '#ffffff', lid: '#5aa6dc', eye: '#ffd640', eyeLo: '#f09a1e', pupil: '#0b1a36', mouth: '#1f2a52', throat: '#5a4a86', tongue: '#ff8aa2', tooth: '#ffffff' }),
      pattern: geckoPattern, head: geckoHead, ground: geckoGround, after: geckoAfter, eyesOnly: (ctx, E) => geckoEyes(ctx, E, true),
    },
  };
  // Thorn-back lizard: a sandy bruiser with a red-tipped ridge, a crown of horns, an underbite and a permanent scowl.
  DEF.thornback = {
    hw: [[0, 10], [16, 12], [30, 14.6], [44, 16], [58, 16], [70, 14], [82, 10], [100, 6.6], [125, 3.8], [150, 1.3]],
    wave: 3.8, tail: [2, 6], sway: 0.35, lat: [25, 26], hs: 1.3, shadow: [16, 18],
    G: { ...LEG_G, l1f: 11, l1h: 12, l2f: 11, l2h: 11.5, wf: 11.5, wh: 13.5, wl: 8.8, hf: 7, hh: 8.6, hl: 5.2, toes: 4, spread: 0.5, lenF: 6, lenH: 6.6, toeW: 2.8, tip: 1.5, pad: 0.9, palm: 5.2, knee: 3 },
    pal: palOf({ line: '#5b3513', lo: '#8a5a26', base: '#c79a4e', hi: '#e3bf6e', top: '#f7e3a0', blot: '#6f3f1a', blotHi: '#a0652c', jaw: '#f4e4b0', leg: '#b98a42', legLo: '#7a4c1e', pad: '#fff3cc', lid: '#93612a', eye: '#fff4c8', eyeLo: '#e8c478', pupil: '#1e1004', mouth: '#4a1410', throat: '#7c2a1e', tongue: '#f2788a', tooth: '#fffbe6', spike: '#f8ecc4', spikeLo: '#c9a160', spikeTip: '#c2331c' }),
    pattern: thornPattern, head: thornHead, under: thornFlanks, over: thornRidge, after: thornSnort,
  };
  // L20 Duke Quartz: the thorn-back in a crystal skin (opts.skin 'crystal'). Lilac body, deep violet shade, amethyst
  // saddles; spines, flank thorns and the horn crown are faceted crystals with a cyan-white tip and a bright rim glint.
  DEF.thornCrystal = {
    ...DEF.thornback, cry: 1,
    pal: palOf({ line: '#34165f', lo: '#6c48b8', base: '#ad8fee', hi: '#d6c4ff', top: '#f6f0ff', blot: '#4f2c9c', blotHi: '#8e6ce0', jaw: '#ece2ff', leg: '#9c80e2', legLo: '#5e3ea8', pad: '#f1eaff', lid: '#7d5cd0', eye: '#ffe680', eyeLo: '#e0a63a', pupil: '#1c0a30', mouth: '#2a0d40', throat: '#5c2a78', tongue: '#ff7fb0', tooth: '#ffffff', spike: '#dff7ff', spikeLo: '#7a52d8', spikeTip: '#f4feff', glint: '#ffffff', facet: '#a58cf6' }),
  };
  // Chameleon: leaf green with teal bands, a helmet, a lollipop tail and two turret eyes that never agree. Smug about it.
  DEF.chameleon = {
    hw: [[0, 8], [14, 9], [34, 11.4], [50, 13], [64, 13], [76, 11], [86, 8], [100, 6.2], [130, 4.8], [170, 3.8], [200, 3], [210, 2.2]],
    wave: 2.6, tail: [1, 3], sway: 0.25, lat: [21.5, 22.5], hs: 1.32, shadow: [13, 16],
    G: { ...LEG_G, l1f: 13, l1h: 14, l2f: 13, l2h: 13.5, wf: 7.4, wh: 8.4, wl: 5.8, hf: 4, hh: 4.8, hl: 3, toes: 2, spread: 1.1, lenF: 6.6, lenH: 7, toeW: 4.4, tip: 3, pad: 1.5, palm: 3.6, knee: 0 },
    pal: palOf({ line: '#1d5a2c', lo: '#2c8a40', base: '#58c24a', hi: '#96e062', top: '#dcf88e', blot: '#15827a', blotHi: '#4cc8ac', jaw: '#f0f7a6', leg: '#4bb043', legLo: '#277536', pad: '#f6e56a', lid: '#46a846', eye: '#fff8d8', eyeLo: '#e6dc9a', pupil: '#0f200c', mouth: '#4a0b12', throat: '#8a1c1a', tongue: '#ff6f8a', tooth: '#ffffff', dot: '#ffe14a' }),
    pattern: chamPattern, head: chamHead, over: chamCrest, after: chamTongue,
  };
  return DEF;
}

function palette(D, P, opts, t) {
  let K = D.pal;
  const camo = clamp(opts.camo || 0, 0, 1) * (1 - P.sick), cc = opts.camoColor;
  if (P.sick > 0) { // the chameleon's colours run wild
    K = { ...K };
    const h = mod(t * 1.6, 1), a = hues(h), b = hues(mod(h + 0.33, 1)), c = hues(mod(h + 0.66, 1)), k = P.sick;
    K.base = mixA(K.base, a, k); K.leg = mixA(K.leg, a, k); K.lo = mixA(K.lo, mixA(a, [0, 0, 0], 0.35), k); K.legLo = K.lo; K.lid = mixA(K.lid, a, k);
    K.hi = mixA(K.hi, mixA(a, WHITE, 0.4), k); K.blot = mixA(K.blot, b, k); K.blotHi = mixA(K.blotHi, c, k); K.pad = mixA(K.pad, c, k);
  }
  if (camo > 0 && cc) { // ... or sink into the ring it sits on (the eyes still give it away)
    K = { ...K };
    const lo = mixA(cc, [0, 0, 0], 0.25), hi = mixA(cc, WHITE, 0.14);
    for (const k of ['base', 'leg', 'jaw', 'pad', 'blot', 'lid', 'dot']) if (K[k]) K[k] = mixA(K[k], cc, camo * 0.92);
    for (const k of ['lo', 'legLo']) K[k] = mixA(K[k], lo, camo * 0.92);
    for (const k of ['hi', 'top', 'blotHi']) K[k] = mixA(K[k], hi, camo * 0.9);
    K.line = mixA(K.line, lo, camo * 0.75);
  }
  return K;
}

export function drawCousin(ctx, x, y, s, t = 0, opts = {}, name = 'gecko') {
  const sp = SPECIES[name];
  if (!(s > 0) || !sp || !COUSINS[name]) return;
  opts = opts || {};
  ctx.save();
  try {
    const st = opts.status, U = s / 100;
    if (st && (st.k === 'ice' || st.k === 'thaw' || (st.k === 'stun' && st.zap >= 0))) {
      const pts = [];
      if (typeof opts.trail === 'function') for (let d = 0; d <= sp.len * U; d += 6 * U) pts.push(opts.trail(d));
      pts.push({ x, y }, { x: x - Math.cos(opts.heading || 0) * sp.len * U, y: y - Math.sin(opts.heading || 0) * sp.len * U });
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
      const pad = 36 * U, o2 = st.k === 'stun' ? opts : { ...opts, blink: 0.5, noShadow: 1 };
      statusDraw(ctx, { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad }, (c) => drawBody(c, name, x, y, s, t, o2), st, { off: Math.max(1.1, 1.4 * U), crys: Math.max(1, U * 1.1) });
    } else drawBody(ctx, name, x, y, s, t, opts);
  } catch (e) {
    if (opts.debug) throw e; // art never breaks the frame
  }
  ctx.restore();
}

function footFor(L, D, sp, gait, P, path, U, t, belly) {
  const STRIDE = sp.stride, DUTY = sp.duty;
  const rf = DUTY * STRIDE / 2 + (L.front ? 4 : -6);
  const lat = (L.front ? D.lat[0] : D.lat[1]) + P.splay * 5;
  const q = gait / STRIDE + L.off, n = Math.floor(q), psi = q - n;
  const plantS = (m) => (m - L.off) * STRIDE - L.g + rf;
  let S, lift = 0, w = 0;
  if (psi < DUTY || P.walk < 0.01) S = psi < DUTY ? plantS(n) : plantS(n + 1);
  else { w = (psi - DUTY) / (1 - DUTY); S = lerp(plantS(n), plantS(n + 1), sstep(w)); lift = Math.sin(Math.PI * w); }
  const pt = path((gait - S) * U), nx = -Math.sin(pt.a), ny = Math.cos(pt.a), ll = lat - lift * 4, pa = pt.a;
  let fx = pt.x + nx * L.side * ll * U, fy = pt.y + ny * L.side * ll * U;
  let fa = pa + L.side * (L.front ? 0.5 : 1.05) - L.side * 0.35 * lift * (w < 0.6 ? 1 : -0.6);
  const g = spInto(L.g, Q), gx = g.x, gy = g.y, gnx = g.nx, gny = g.ny, gw = g.w;
  if (L.front && P.rear > 0) { // reared: the hands hover by the chest
    const h = spInto(L.g + 10, Q), tx = h.x + h.nx * L.side * (gw / U + 5) * U, ty = h.y + h.ny * L.side * (gw / U + 5) * U, wv = Math.sin(t * 9 + L.side) * 2 * U * P.rear;
    fx = lerp(fx, tx + wv, P.rear); fy = lerp(fy, ty - wv, P.rear); lift = Math.max(lift, P.rear);
  }
  if (P.melt > 0) { const tx = gx + gnx * L.side * (lat + 5) * U, ty = gy + gny * L.side * (lat + 5) * U; fx = lerp(fx, tx, P.melt); fy = lerp(fy, ty, P.melt); } // feet slide out into the puddle
  if (P.roll > 0.5) { // on its back: the legs paddle at the sky
    const k = sstep((P.roll - 0.5) * 2), ph = t * 15 + (L.front ? 0 : 2) + L.side, out = gw / U + 9 + (L.front ? 0 : 2);
    fx = lerp(fx, gx + gnx * L.side * out * U + Math.cos(ph) * 4 * U, k); fy = lerp(fy, gy + gny * L.side * out * U + Math.sin(ph) * 4 * U, k);
    fa += Math.sin(ph) * 0.6 * k; lift = Math.max(lift, k);
  }
  const hk = belly ? 0.8 : 0.55, hip = { x: gx + gnx * L.side * gw * hk, y: gy + gny * L.side * gw * hk };
  return { L, hip, fx, fy, fa, lift, ox: gnx * L.side, oy: gny * L.side, pa };
}

function bodyPath(ctx, k, ox, oy, X, Y, I0, WM) {
  ctx.beginPath();
  for (let i = I0; i < NS; i++) { const m = sw[i] / WM; ctx.lineTo(X[i] + snx[i] * sw[i] * k + ox * m, Y[i] + sny[i] * sw[i] * k + oy * m); }
  for (let i = NS - 1; i >= I0; i--) { const m = sw[i] / WM; ctx.lineTo(X[i] - snx[i] * sw[i] * k + ox * m, Y[i] - sny[i] * sw[i] * k + oy * m); }
  ctx.closePath();
}

function drawBody(ctx, name, x0, y0, s, t, opts) {
  const D = name === 'thornback' && opts.skin === 'crystal' ? defs().thornCrystal : defs()[name], sp = SPECIES[name], U = s / 100, pose = opts.pose || 'walk';
  const P = poseParams(pose, clamp(opts.p || 0, 0, 1));
  if (opts.blend) for (const c in P) if (opts.blend[c] !== undefined) P[c] = opts.blend[c];
  if (opts.rear !== undefined) P.rear = opts.rear;
  if (opts.mouth !== undefined) P.mouth = opts.mouth;
  UMAX = sp.len; DU = UMAX / (NS - 1); HW = D.hw;
  const U_SH = sp.sh, U_HIP = sp.hip, U_HEAD = sp.neck, STRIDE = sp.stride;
  const glow = clamp(opts.glow !== undefined ? opts.glow : 0.75, 0, 1), gait = (opts.gait || 0) / U;
  const K = palette(D, P, opts, t);
  ctx.translate(x0, y0);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  // ---- path: d (px) behind the snout -> PT {x, y, a}
  const trail = opts.trail, h0 = opts.heading || 0, kap = opts.curve || 0;
  let path;
  if (typeof trail === 'function') {
    const e = 2 * U;
    path = (d) => {
      const dd = Math.max(0, d), q = trail(dd), qa = trail(dd + e), qb = trail(Math.max(0, dd - e));
      let a = Math.atan2(qb.y - qa.y, qb.x - qa.x);
      if (!(dd > e)) { const qc = trail(dd + 2 * e); a = Math.atan2(q.y - qc.y, q.x - qc.x); }
      PT.x = q.x - x0 + (d < 0 ? Math.cos(a) * -d : 0); PT.y = q.y - y0 + (d < 0 ? Math.sin(a) * -d : 0); PT.a = a;
      return PT;
    };
  } else {
    path = (d) => {
      const a = h0 - kap * d;
      if (Math.abs(kap) < 1e-7) { PT.x = -d * Math.cos(h0); PT.y = -d * Math.sin(h0); } else { PT.x = -(Math.sin(h0) - Math.sin(a)) / kap; PT.y = -(-Math.cos(h0) + Math.cos(a)) / kap; }
      PT.a = a;
      return PT;
    };
  }

  // ---- spine: shoulders and hips counter-swing, the tail follows through
  const ph = (gait / STRIDE) * TAU, wk = P.walk * (1 - P.rear * 0.8) * (1 - P.melt) * (1 - P.roll), A = D.wave * (P.flee ? 1.25 : 1) * wk, cph = Math.cos(ph);
  const breathe = 1 + 0.04 * Math.sin(t * 2.3) * (1 - P.walk) + P.swell * 0.12, idle = (1 - P.walk) * (1 - P.dazed * 0.6) * (1 - P.roll);
  for (let i = 0; i < NS; i++) {
    const u = i * DU, q = path(u * U);
    let lat;
    if (u < U_SH) lat = A * 0.5 * cph * (1 - u / U_SH);
    else if (u < U_HIP) lat = -A * cph * Math.sin((Math.PI * (u - U_SH)) / (U_HIP - U_SH));
    else {
      const r = clamp((u - U_HIP) / 22, 0, 1), f = (u - U_HIP) / (UMAX - U_HIP);
      lat = -(D.tail[0] + D.tail[1] * f * (0.6 + 0.4 * f)) * r * Math.cos(ph - (u - U_HIP) * (TAU / 96)) * wk;
      lat += idle * r * Math.sin(t * 1.25 - u * 0.045) * (2.5 + 11 * f * f) * D.sway;
      lat += P.shake * r * Math.sin(t * 22 - u * 0.1) * 6 * f;
      lat += P.flail * r * Math.sin(t * 17 - u * 0.08) * 5 * f;
    }
    const nx = -Math.sin(q.a), ny = Math.cos(q.a);
    bx[i] = q.x + nx * lat * U; by[i] = q.y + ny * lat * U;
    let w = hwAt(u);
    if (u > U_SH - 8 && u < U_HIP + 8) w *= breathe;
    sw[i] = w * U;
  }
  if (sp.curl) { // chameleon: the tail rolls up into a tight spiral (it loosens a little on the move)
    const i0 = Math.round(sp.curl / DU), ck = 1 - 0.4 * P.walk * (1 - P.sick) + 0.25 * P.snatch, dir = D.curlDir || 1;
    let a = Math.atan2(by[i0] - by[i0 - 1], bx[i0] - bx[i0 - 1]);
    for (let i = i0 + 1; i < NS; i++) {
      const f = (i - i0) / (NS - 1 - i0);
      a += dir * ((0.3 + 0.62 * f) * ck + Math.sin(t * 1.3) * 0.012);
      bx[i] = bx[i - 1] + Math.cos(a) * DU * U; by[i] = by[i - 1] + Math.sin(a) * DU * U;
    }
  }
  const hipI = Math.round(U_HIP / DU), fore = 0.22 * P.crouch + 0.26 * Math.sin(Math.PI * clamp(P.rear, 0, 1)) * (1 - P.crouch * 0.5);
  for (let i = 0; i < NS; i++) {
    let X = bx[i], Y = by[i];
    if ((P.rear > 0 || P.crouch > 0) && i < hipI) {
      const f = (U_HIP - i * DU) / U_HIP, c = 1 - f * fore + 0.07 * P.rear * f;
      X = bx[hipI] + (X - bx[hipI]) * c; Y = by[hipI] + (Y - by[hipI]) * c;
      sw[i] *= 1 + 0.26 * P.rear * f + 0.1 * P.crouch * f;
    }
    sx[i] = X; sy[i] = Y;
  }
  if (P.melt > 0) { // gecko: the body slumps toward its middle and spreads
    const mi = Math.round((U_SH + U_HIP) / 2 / DU), mx = sx[mi], my = sy[mi];
    for (let i = 0; i < NS; i++) { sx[i] = mx + (sx[i] - mx) * (1 - 0.55 * P.melt); sy[i] = my + (sy[i] - my) * (1 - 0.55 * P.melt); sw[i] *= 1 + 0.35 * P.melt + 0.05 * Math.sin(t * 9 + i); }
  }
  const rc = Math.cos(Math.PI * P.roll), belly = rc < 0; // thornback: rolls over its edge, opens again belly-up
  if (P.roll > 0) for (let i = 0; i < NS; i++) sw[i] *= Math.max(0.2, Math.abs(rc));
  for (let i = 0; i < NS; i++) {
    const a = Math.max(0, i - 1), b = Math.min(NS - 1, i + 1), tx = sx[a] - sx[b], ty = sy[a] - sy[b], l = Math.hypot(tx, ty) || 1;
    snx[i] = -ty / l; sny[i] = tx / l;
  }
  let wmax = 0; for (const h of HW) wmax = Math.max(wmax, h[1]);
  const lw = Math.max(0.9, 1.5 * U), I0 = Math.round((U_HEAD + 2) / DU), WM = wmax * U;
  const moved = P.melt > 0 || P.roll > 0 || P.rear > 0 || P.crouch > 0, SX = moved ? sx : bx, SY = moved ? sy : by;

  // ---- head frame
  const hc = spAt(U_HEAD), hb = spAt(U_HEAD + 12), hcx = hc.x, hcy = hc.y;
  let ha = Math.atan2(hcy - hb.y, hcx - hb.x) + (opts.aim || 0);
  ha += (Math.sin(t * 1.7) * 0.22 + 0.1 * Math.sin(t * 0.9 + 1)) * P.dazed;
  ha += Math.sin(t * 2.1 + 1) * 0.035 * idle;
  if (P.shake) ha += Math.sin(t * 31) * 0.05 * P.shake;
  if (P.sick) ha += Math.sin(t * 13) * 0.1 * P.sick;
  const hs = (D.hs + 0.3 * P.rear) * U * (1 - 0.2 * P.melt);
  const id = opts.id | 0, upness = -Math.sin(ha);
  let fu = faceUp[id] === undefined ? (upness >= 0 ? 1 : -1) : faceUp[id];
  if (upness > 0.3) fu = 1; else if (upness < -0.3) fu = -1;
  faceUp[id] = fu;
  const lx = LX * Math.cos(ha) + LY * Math.sin(ha), ly = -LX * Math.sin(ha) + LY * Math.cos(ha); // the light, in head space
  const E = { name, D, sp, U, K, P, t, lw, opts, x0, y0, belly, glow, fu, ha, hs, lx, ly, id, idle, U_SH, U_HIP };

  const fadeA = 1 - 0.9 * sstep((P.melt - 0.55) / 0.3); // a melted gecko is a puddle and a pair of eyes
  if (P.melt > 0.02) drawPuddle(ctx, spAt((U_SH + U_HIP) / 2), U, P.melt, t, K);
  if (D.ground) D.ground(ctx, E);

  // ---- contact shadow
  if (!opts.noShadow && P.melt < 0.5) {
    const so = 3.4 * U;
    ctx.fillStyle = `rgba(0,0,0,${(0.28 - 0.08 * P.rear) * (1 - P.melt * 1.6)})`;
    bodyPath(ctx, 1, so * 1.4, so * 1.9, SX, SY, I0, WM); ctx.fill();
    ctx.beginPath(); ctx.ellipse(SX[3] + so * 1.2 + 5 * P.rear * U, SY[3] + so * 1.7 + 7 * P.rear * U, D.shadow[0] * hs, D.shadow[1] * hs, ha, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = fadeA;

  // ---- legs under the body (on its back, or reared, they come over it)
  const LEGS = D.legs || (D.legs = [{ g: U_SH, side: -1, off: 0, front: true }, { g: U_SH, side: 1, off: 0.5, front: true }, { g: U_HIP, side: -1, off: 0.5, front: false }, { g: U_HIP, side: 1, off: 0, front: false }]);
  const feet = LEGS.map((L) => footFor(L, D, sp, gait, P, path, U, t, belly));
  if (opts.out) opts.out.feet = feet.map((f) => ({ x: f.fx + x0, y: f.fy + y0, lift: f.lift }));
  const over = (f) => belly || (f.L.front && P.rear > 0.35);
  if (D.under) D.under(ctx, E);
  drawLegs(ctx, feet.filter((f) => !over(f)), U, K, lw, D.G);

  // ---- body: dark underside, lit back, markings, gloss; one thin line in the skin's own dark
  const Kb = belly ? { ...K, lo: mixA(K.jaw, K.lo, 0.45), base: K.jaw, hi: mixA(K.jaw, WHITE, 0.5) } : K;
  bodyPath(ctx, 1, 0, 0, sx, sy, I0, WM); ctx.fillStyle = rgb(Kb.lo); ctx.fill();
  ctx.save(); ctx.clip();
  bodyPath(ctx, 0.84, LX * 0.165 * WM, LY * 0.165 * WM, sx, sy, I0, WM); ctx.fillStyle = rgb(Kb.base); ctx.fill();
  bodyPath(ctx, 0.5, LX * 0.33 * WM, LY * 0.33 * WM, sx, sy, I0, WM); ctx.fillStyle = rgb(Kb.hi); ctx.fill();
  if (belly) bellyScutes(ctx, E); else D.pattern(ctx, E);
  ctx.restore();
  bodyPath(ctx, 1, 0, 0, sx, sy, I0, WM); ctx.strokeStyle = rgb(K.line); ctx.lineWidth = lw; ctx.stroke();
  if (D.over && !belly) D.over(ctx, E);
  drawLegs(ctx, feet.filter(over), U, K, lw, D.G);

  // ---- head
  const stars = P.dazed > 0.3 ? { size: 10 * U, fade: clamp((P.dazed - 0.3) / 0.4, 0, 1) } : null;
  ctx.globalAlpha = 1;
  if (stars) dizzyStars(ctx, hcx, hcy - 12 * U, 30 * U, 10.5 * U, t, { ...stars, layer: 'back' });
  E.lwH = lw / hs;
  ctx.save();
  if (P.melt > 0.75) { ctx.translate(hcx, hcy + 6 * U * P.melt); ctx.rotate(ha); ctx.scale(hs, hs); D.eyesOnly(ctx, E); } else {
    ctx.globalAlpha = fadeA;
    ctx.translate(hcx, hcy); ctx.rotate(ha); ctx.scale(hs, hs);
    D.head(ctx, E);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  E.hcx = hcx; E.hcy = hcy;
  if (D.after) D.after(ctx, E);
  if (P.steam > 0.01) drawSteam(ctx, U, t, P.steam * (opts.steam !== undefined ? opts.steam : 1));
  if (stars) dizzyStars(ctx, hcx, hcy - 12 * U, 30 * U, 10.5 * U, t, { ...stars, layer: 'front' });
}

function drawSteam(ctx, U, t, k) {
  for (let i = 0; i < 7; i++) {
    const f = mod(t * 0.55 + i * 0.29, 1), q = spInto(Math.min(UMAX, 6 + i * 21), Q);
    const X = q.x + Math.sin(i * 4.1 + t * 1.3) * 5 * U, Y = q.y - 6 * U - f * 28 * U, r = (3.2 + f * 6.5) * U;
    ctx.fillStyle = `rgba(246,248,250,${k * 0.55 * Math.sin(f * Math.PI)})`;
    ctx.beginPath(); ctx.arc(X, Y, r, 0, TAU); ctx.arc(X + r * 0.75, Y + r * 0.25, r * 0.7, 0, TAU); ctx.arc(X - r * 0.6, Y + r * 0.35, r * 0.55, 0, TAU); ctx.fill();
  }
}
function bellyScutes(ctx, E) { // the pale underside: a row of belly plates
  const { U, K, U_SH, U_HIP } = E;
  ctx.strokeStyle = rgb(mixA(K.jaw, K.lo, 0.55)); ctx.lineWidth = 1.3 * U;
  for (let u = U_SH - 8; u < U_HIP + 26; u += 7) { const a = uv(u + 2, -0.7), m = uv(u, 0), b = uv(u + 2, 0.7); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(m[0], m[1], b[0], b[1]); ctx.stroke(); }
}
// broken wet highlights riding the lit side of the spine
function gloss(ctx, E, runs, off = 0.62, w = 1.9, al = 0.92) {
  ctx.strokeStyle = rgb(mixA(E.K.top, WHITE, 0.8), al); ctx.lineWidth = w * E.U;
  for (const [a, b] of runs) {
    ctx.beginPath();
    for (let u = a; u <= b; u += 2) { const q = spInto(u, Q), o = q.w * off; ctx.lineTo(q.x + LX * o, q.y + LY * o); }
    ctx.stroke();
  }
}

/* ---------------------------------------------------------------- shared face parts (head space: +x = snout) */
// the skull: dark underside, base pushed toward the light, a lit crown, then the species' markings, then one thin line
function skull(ctx, E, hp, hiE, marks) {
  const { K, lx, ly, lwH, belly } = E;
  ctx.save();
  hp(); ctx.fillStyle = rgb(belly ? mixA(K.jaw, K.lo, 0.45) : K.lo); ctx.fill(); ctx.clip();
  ctx.save(); ctx.translate(lx * 2.2, ly * 2.2); hp(); ctx.fillStyle = rgb(belly ? K.jaw : K.base); ctx.fill(); ctx.restore();
  ctx.beginPath(); ctx.ellipse(hiE[0] + lx * 5, ly * 6, hiE[1], hiE[2], 0, 0, TAU); ctx.fillStyle = rgb(belly ? mixA(K.jaw, WHITE, 0.5) : K.hi); ctx.fill();
  if (!belly) marks();
  ctx.restore();
  hp(); ctx.strokeStyle = rgb(K.line); ctx.lineWidth = lwH; ctx.stroke();
}
// the open mouth: lower jaw under the skull, dark throat, a fat tongue that lashes
function jaw(ctx, E, m, x0, rx, ry, teeth) {
  const { K, P, t, lwH } = E, jx = x0 + 10.5 * m, jrx = rx + 2.5 * m, jry = ry + 0.8 * m;
  ctx.beginPath(); ctx.ellipse(jx, 0, jrx, jry, 0, 0, TAU); ctx.fillStyle = rgb(K.jaw); ctx.fill(); ctx.strokeStyle = rgb(K.line); ctx.lineWidth = lwH; ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.ellipse(jx - 0.6, 0, jrx - 2.2, jry - 2.4, 0, 0, TAU); ctx.fillStyle = rgb(K.mouth); ctx.fill(); ctx.clip();
  ctx.beginPath(); ctx.ellipse(x0, 0, jrx * 0.7, jry * 0.62, 0, 0, TAU); ctx.fillStyle = rgb(K.throat); ctx.fill();
  if (P.snatch < 0.05) {
    const tk = P.tongue * (1 - P.dazed), wag = Math.sin(t * 19) * 3 * tk, tl = jx + jrx - 6.5 + 1.5 * tk;
    ctx.beginPath(); ctx.moveTo(x0 - 2, 0); ctx.quadraticCurveTo((x0 + tl) / 2, wag * 0.4, tl, wag);
    ctx.strokeStyle = rgb(mixA(K.tongue, K.mouth, 0.45)); ctx.lineWidth = ry * 0.62; ctx.stroke();
    ctx.strokeStyle = rgb(K.tongue); ctx.lineWidth = ry * 0.5; ctx.stroke();
  }
  ctx.restore();
  if (teeth) { ctx.fillStyle = rgb(K.tooth); for (let i = -teeth; i <= teeth; i++) { const a = i * 0.36; ctx.beginPath(); ctx.arc(jx + Math.cos(a) * (jrx - 2.4), Math.sin(a) * (jry - 2.6), 1.2, 0, TAU); ctx.fill(); } }
}
// the closed mouth: a lip line round the muzzle; hook > 0 curls one corner back toward the eye (a smirk), < 0 turns both down
function lip(ctx, E, fx, ck, hook, w = 1.8) {
  const { K, fu } = E, c = ck / 18.5;
  ctx.strokeStyle = rgb(mixA(K.blot, K.line, 0.5)); ctx.lineWidth = w; ctx.beginPath();
  ctx.moveTo(6.5, -fu * 12.6 * c);
  ctx.bezierCurveTo(11, -fu * 11.6 * c, fx - 4.6, -fu * 7 * c, fx - 4.4, 0);
  ctx.bezierCurveTo(fx - 4.6, fu * 7.5 * c, 10, fu * 12.4 * c, 3.5, fu * 14.2 * c);
  if (hook > 0) ctx.quadraticCurveTo(-0.5 - hook, fu * 15 * c, -2.2 - hook, fu * 12 * c);
  ctx.stroke();
}
function nostrils(ctx, E, x, y, r = 0.75) {
  ctx.fillStyle = rgb(E.K.line);
  for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x, sd * y, r, r * 1.5, sd * 0.5, 0, TAU); ctx.fill(); }
}
function lolling(ctx, E, fx) { // dazed: the tongue hangs out of the low corner
  const { K, fu, t, lwH } = E;
  ctx.beginPath(); ctx.moveTo(fx - 5, -fu * 4.5); ctx.quadraticCurveTo(fx + 1, -fu * 6.5, fx + 3.5 + Math.sin(t * 3) * 0.6, -fu * 4);
  ctx.strokeStyle = rgb(mixA(K.tongue, K.mouth, 0.6)); ctx.lineWidth = 5 + 2 * lwH; ctx.stroke(); ctx.strokeStyle = rgb(K.tongue); ctx.lineWidth = 5; ctx.stroke();
}

/* ================================================================ FROST GECKO */
// crystal plates down the back: sharp rhombs, one facet lit. An icicle tail tip, frost freckles, glassy gloss.
function geckoPattern(ctx, E) {
  const { U, K } = E;
  for (const [uc, L, hv] of [[39, 15, 0.66], [58, 19, 0.8], [78, 14, 0.66], [102, 13, 0.6], [119, 12, 0.62], [135, 10, 0.6], [149, 8, 0.6]]) {
    const s1 = litSide(uc), a = uv(uc - L / 2, 0), b = uv(uc + L / 2, 0), c1 = uv(uc - 1, s1 * hv), c2 = uv(uc - 1, -s1 * hv), m = uv(uc + 1, 0);
    ctx.beginPath(); poly(ctx, [a, c1, b, c2]); ctx.fillStyle = rgb(K.blot); ctx.fill();
    ctx.beginPath(); poly(ctx, [a, c1, m]); ctx.fillStyle = rgb(K.blotHi); ctx.fill();
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(m[0], m[1]); ctx.lineTo(b[0], b[1]); ctx.strokeStyle = rgb(K.top, 0.55); ctx.lineWidth = 0.9 * U; ctx.stroke();
  }
  // the icicle: the last of the tail is clear ice
  ctx.beginPath();
  const i0 = Math.round(158 / DU);
  for (let i = i0; i < NS; i++) ctx.lineTo(sx[i] + snx[i] * sw[i] * 1.3, sy[i] + sny[i] * sw[i] * 1.3);
  for (let i = NS - 1; i >= i0; i--) ctx.lineTo(sx[i] - snx[i] * sw[i] * 1.3, sy[i] - sny[i] * sw[i] * 1.3);
  ctx.closePath(); ctx.fillStyle = rgb(K.top); ctx.fill();
  ctx.fillStyle = rgb(K.top, 0.9); ctx.beginPath(); // frost freckles on the shaded flank
  for (const [u, v, r] of [[34, -0.6, 1.3], [48, 0.62, 1.5], [50, -0.7, 1], [68, 0.66, 1.4], [70, -0.62, 1.2], [88, 0.5, 1.1], [96, -0.55, 1.3], [112, 0.66, 1.2], [128, -0.6, 1]]) { const p = uv(u, v); ctx.moveTo(p[0] + r * U, p[1]); ctx.arc(p[0], p[1], r * U, 0, TAU); }
  ctx.fill();
  gloss(ctx, E, [[30, 46], [50, 53], [66, 74], [92, 108], [112, 115]], 0.7, 2.1, 0.95);
}
// a four-point twinkle
function twinkle(ctx, x, y, r, al) {
  if (al <= 0.02) return;
  ctx.fillStyle = `rgba(255,255,255,${al})`; ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r); ctx.fill();
}
function geckoGround(ctx, E) { // 'frost': rime spreads under it as it walks
  const { U, P, t } = E;
  if (P.frost < 0.02) return;
  ctx.fillStyle = `rgba(214,240,255,${0.42 * P.frost})`; ctx.beginPath();
  for (let u = 20; u < 150; u += 16) { const q = spInto(u, Q), r = (q.w + (15 + 4 * Math.sin(u * 1.7)) * U) * (0.9 + 0.06 * Math.sin(t * 2 + u)); ctx.moveTo(q.x + r, q.y); ctx.ellipse(q.x, q.y, r, r * 0.92, 0, 0, TAU); }
  ctx.fill();
}
function geckoAfter(ctx, E) {
  const { U, P, t, glow, hcx, hcy, ha, hs } = E;
  if (P.melt > 0.5) return;
  const k = 0.45 + 0.55 * P.frost, ca = Math.cos(ha), sa = Math.sin(ha);
  for (let i = 0; i < 3; i++) { // cold breath curls off the nose
    const f = mod(t * 0.8 + i / 3, 1);
    if (f > 0.7) continue;
    const d = (17 * hs / U + 3 + f * 15) * U, X = hcx + ca * d + Math.sin(i * 3 + t) * 2 * U, Y = hcy + sa * d - f * 5 * U;
    ctx.fillStyle = `rgba(238,250,255,${0.6 * k * Math.sin((f / 0.7) * Math.PI)})`;
    ctx.beginPath(); ctx.arc(X, Y, (1.8 + f * 4.4) * U, 0, TAU); ctx.arc(X + 2.4 * U, Y + 1 * U, (1.2 + f * 3) * U, 0, TAU); ctx.fill();
  }
  for (let i = 0; i < 5; i++) { // ice glints
    const f = mod(t * 0.7 + i * 0.37, 1), q = spInto(26 + i * 31, Q), sd = i % 2 ? 1 : -1;
    twinkle(ctx, q.x + q.nx * sd * (q.w + 5 * U) + LX * 3 * U, q.y + q.ny * sd * (q.w + 5 * U) + LY * 3 * U, (3.2 + 2.6 * P.frost) * U * Math.sin(f * Math.PI), (0.45 + 0.5 * P.frost) * glow * Math.sin(f * Math.PI));
  }
}
function geckoEyes(ctx, E, wide) {
  const { K, P, t, lwH, fu, lx, ly, opts, id, ha } = E;
  const blink = opts.blink !== undefined ? opts.blink : blinkAt(t, id + 1), look = opts.look || { x: 0.45, y: 0 };
  const gl = sstep((Math.sin(t * 0.7 + id) - 0.05) / 0.3) * (1 - P.walk * 0.5), lt = mod(t + id * 1.7, 6.5);
  const lick = E.canLick && lt < 0.55 ? Math.sin(Math.PI * lt / 0.55) : 0; // it wipes its own eye with its tongue: geckos do
  for (const sd of [-1, 1]) {
    const r = 8, ex = 2.5, ey = sd * 12.8 * (wide ? 0.72 : 1);
    let lid = 0.44 - 0.07 * P.walk + 0.1 * P.angry + (sd === fu ? -0.1 : 0.07) * (1 - P.angry);
    if (wide) lid = 0.04; // melted: two alarmed eyes afloat
    lid = lerp(lid, sd === fu ? 0.62 : 0.4, P.dazed); lid = Math.max(lid, blink, sd === fu ? lick : 0);
    const th = lerp(0.34, 0.62, P.angry) * (1 - P.dazed) * (wide ? 0 : 1);
    lidEye(ctx, ex, ey, r, sd, { K, lx, ly, lw: lwH, lid, th, t, look: wide ? { x: 0.1, y: -sd * 0.55 + Math.sin(t * 3) * 0.2 } : { x: look.x - 0.25 * gl, y: look.y + fu * 0.8 * gl }, spin: P.dazed > 0.5, pr: r * (wide ? 0.4 : 0.62), slit: -ha + sd * 0.14, heavy: 0.3 + P.angry });
  }
  return lick;
}
function geckoHead(ctx, E) {
  const { K, P, t, lwH, fu, lx, ly } = E;
  const m = clamp(P.mouth, 0, 1), fx = 19.5 - 4 * m, sq = P.swell;
  const hp = () => { ctx.beginPath(); spline(ctx, [[-13, -8], [-8, -14.5 - 2 * sq], [0, -16.5 - 3 * sq], [8, -12.5 - 2 * sq], [14.5, -7.5], [fx, -3], [fx, 3], [14.5, 7.5], [8, 12.5 + 2 * sq], [0, 16.5 + 3 * sq], [-8, 14.5 + 2 * sq], [-13, 8]], true, 0.5); };
  if (m > 0.03) jaw(ctx, E, m, 6, 12, 11.5, 0);
  skull(ctx, E, hp, [2, 13, 11], () => {
    ctx.beginPath(); ctx.ellipse(fx - 4, 0, 8, 9.5, 0, 0, TAU); ctx.fillStyle = rgb(K.jaw, 0.75); ctx.fill(); // pale muzzle
    const s1 = ly < 0 ? -1 : 1; // crown crystal, lit facet toward the light
    ctx.beginPath(); poly(ctx, [[-16, 0], [-4, -5.2], [8.5, 0], [-4, 5.2]]); ctx.fillStyle = rgb(K.blot); ctx.fill();
    ctx.beginPath(); poly(ctx, [[-16, 0], [-4, s1 * 5.2], [8.5, 0]]); ctx.fillStyle = rgb(K.blotHi); ctx.fill();
    ctx.beginPath(); ctx.ellipse(fx - 4.5 + lx * 2, ly * 4, 3.2, 1.4, Math.atan2(ly, lx) + Math.PI / 2, 0, TAU); ctx.fillStyle = rgb(WHITE, 0.9); ctx.fill(); // wet nose
  });
  nostrils(ctx, E, fx - 2.2, 2.6);
  E.canLick = m <= 0.03 && P.dazed < 0.1 && P.walk < 0.5 && !E.opts.status;
  if (m <= 0.03) { lip(ctx, E, fx, 15.2, 1.2 + 0.5 * Math.sin(t * 0.8 + E.id)); if (P.dazed > 0.4) lolling(ctx, E, fx); }
  const lick = geckoEyes(ctx, E, false);
  if (lick > 0.02) { // the tongue swings round to the eye
    const tx = lerp(fx - 3, 6, lick), ty = fu * lerp(4, 12.5, lick);
    ctx.beginPath(); ctx.moveTo(fx - 4.5, fu * 2.5); ctx.quadraticCurveTo(fx + 3 * lick, fu * (7 + 3 * lick), tx, ty);
    ctx.strokeStyle = rgb(mixA(K.tongue, K.mouth, 0.55)); ctx.lineWidth = 3.6 + 2 * lwH; ctx.stroke(); ctx.strokeStyle = rgb(K.tongue); ctx.lineWidth = 3.6; ctx.stroke();
  }
}

/* ================================================================ THORN-BACK LIZARD */
// one thorn: base (x, y), tip (tx, ty), half-width hw. Bone, one face lit, a red tip.
function spike(ctx, E, x, y, tx, ty, hw, lw) {
  if (E.D.cry) { crystalSpike(ctx, E.K, x, y, tx, ty, hw, lw); return; }
  const K = E.K, dx = tx - x, dy = ty - y, l = Math.hypot(dx, dy) || 1, nx = (-dy / l) * hw, ny = (dx / l) * hw, s1 = nx * LX + ny * LY > 0 ? 1 : -1;
  const tri = [[x + nx, y + ny], [tx, ty], [x - nx, y - ny]];
  ctx.beginPath(); poly(ctx, tri); ctx.fillStyle = rgb(K.spikeLo); ctx.fill();
  ctx.beginPath(); poly(ctx, [[x + nx * s1, y + ny * s1], [tx, ty], [x, y]]); ctx.fillStyle = rgb(K.spike); ctx.fill();
  ctx.beginPath(); poly(ctx, [[x + dx * 0.6 + nx * 0.4, y + dy * 0.6 + ny * 0.4], [tx, ty], [x + dx * 0.6 - nx * 0.4, y + dy * 0.6 - ny * 0.4]]); ctx.fillStyle = rgb(K.spikeTip); ctx.fill();
  ctx.beginPath(); poly(ctx, tri); ctx.strokeStyle = rgb(K.line); ctx.lineWidth = lw * 0.85; ctx.stroke();
}
// a faceted crystal: a dark violet body, a lilac facet, a pale lit facet toward the light, a cyan-white tip and a white
// rim glint along the lit edge. Thin same-hue line. Exported for the shed crystals (render/crystal20.js).
export function crystalSpike(ctx, K, x, y, tx, ty, hw, lw) {
  const dx = tx - x, dy = ty - y, l = Math.hypot(dx, dy) || 1, nx = (-dy / l) * hw, ny = (dx / l) * hw, s1 = nx * LX + ny * LY > 0 ? 1 : -1;
  const sh = [x + dx * 0.7, y + dy * 0.7]; // the shoulder where the facets meet the point
  const L = [x + nx * s1, y + ny * s1], R = [x - nx * s1, y - ny * s1], SL = [sh[0] + nx * s1 * 0.75, sh[1] + ny * s1 * 0.75], SR = [sh[0] - nx * s1 * 0.75, sh[1] - ny * s1 * 0.75];
  const out = [L, SL, [tx, ty], SR, R];
  ctx.beginPath(); poly(ctx, out); ctx.fillStyle = rgb(K.spikeLo); ctx.fill();
  ctx.beginPath(); poly(ctx, [[x, y], L, SL, [tx, ty]]); ctx.fillStyle = rgb(K.spike); ctx.fill(); // the lit facet
  ctx.beginPath(); poly(ctx, [[x, y], [tx, ty], SR, R]); ctx.fillStyle = rgb(K.facet || K.spikeLo, 0.85); ctx.fill(); // the far facet
  ctx.beginPath(); poly(ctx, [SL, [tx, ty], SR, [sh[0] + dx * 0.08, sh[1] + dy * 0.08]]); ctx.fillStyle = rgb(K.spikeTip); ctx.fill(); // the clear tip
  ctx.beginPath(); poly(ctx, out); ctx.strokeStyle = rgb(K.line); ctx.lineWidth = lw * 0.8; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(L[0] + (SL[0] - L[0]) * 0.15, L[1] + (SL[1] - L[1]) * 0.15); ctx.lineTo(SL[0], SL[1]); ctx.lineTo(tx + (SL[0] - tx) * 0.1, ty + (SL[1] - ty) * 0.1);
  ctx.strokeStyle = rgb(K.glint || WHITE, 0.95); ctx.lineWidth = lw * 0.75; ctx.stroke(); // the rim glint
}
function thornFlanks(ctx, E) { // side thorns: they break the outline, so the silhouette is a saw
  const { U, lw } = E;
  for (let u = 30; u < 140; u += u < 92 ? 9.5 : 9) for (const sd of [-1, 1]) {
    const q = spInto(u, Q), r = (u < 96 ? 8 : 6.2 - (u - 96) * 0.07) * U, tx = -q.ny, ty = q.nx, w = q.w;
    spike(ctx, E, q.x + q.nx * sd * w * 0.78, q.y + q.ny * sd * w * 0.78, q.x + q.nx * sd * (w + r) + tx * r * 0.62, q.y + q.ny * sd * (w + r) + ty * r * 0.62, r * 0.48, lw);
  }
}
const LAY_U = 79;
function thornRidge(ctx, E) { // the ridge down the spine, biggest over the shoulders; 'lay' flicks one off behind
  const { U, lw, P, t, opts, x0, y0 } = E, popped = P.lay > 0.35;
  for (let u = 132; u >= 34; u -= u > 97 ? 8.5 : 9) {
    if (u < 98 && u > 88) u = 88;
    if (popped && Math.abs(u - LAY_U) < 3) continue;
    const q = spInto(u, Q), r = (u > 92 ? 5.4 - (u - 92) * 0.06 : 7 + 2.6 * Math.sin((Math.PI * (u - 30)) / 62)) * U * (1 + 0.12 * P.angry), tx = -q.ny, ty = q.nx;
    spike(ctx, E, q.x - tx * r * 0.25, q.y - ty * r * 0.25, q.x + tx * r * 1.15 - LX * r * 0.3, q.y + ty * r * 1.15 - LY * r * 0.3, r * 0.52, lw);
  }
  if (P.lay > 0.25 && P.lay < 0.98) {
    const k = clamp((P.lay - 0.3) / 0.6, 0, 1), a = spAt(LAY_U), b = spAt(Math.min(UMAX - 4, LAY_U + 70));
    const X = lerp(a.x, b.x + b.nx * 14 * U, k), Y = lerp(a.y, b.y + b.ny * 14 * U, k), r = 4.4 * U * (1 + 0.6 * Math.sin(Math.PI * k));
    if (E.D.cry) { const yy = Y - Math.sin(Math.PI * k) * 7 * U, a = t * 9; crystalSpike(ctx, E.K, X - Math.sin(a) * r * 0.5, yy + Math.cos(a) * r * 0.5, X + Math.sin(a) * r * 1.3, yy - Math.cos(a) * r * 1.3, r * 0.6, E.lw); }
    else drawCrawlerThorn(ctx, X, Y - Math.sin(Math.PI * k) * 7 * U, r, t * 9, 0, null);
    if (opts.out) opts.out.thorn = { x: X + x0, y: Y + y0, k };
  }
}
function thornPattern(ctx, E) {
  const { U, K } = E;
  ctx.fillStyle = rgb(K.blot, 0.82); ctx.beginPath(); // dark saddles between the thorns
  for (const uc of [38.5, 56.5, 74.5, 92]) poly(ctx, [uv(uc - 3.5, -1.25), uv(uc - 0.5, 0), uv(uc - 3.5, 1.25), uv(uc + 3.5, 1.25), uv(uc + 6, 0), uv(uc + 3.5, -1.25)]);
  for (const [u, L] of [[106, 5], [119, 4.2], [131, 3.6]]) poly(ctx, [uv(u, -1.4), uv(u + L, -1.4), uv(u + L, 1.4), uv(u, 1.4)]);
  ctx.fill();
  ctx.fillStyle = rgb(K.top, 0.7); ctx.beginPath(); // pebbly scales
  for (let u = 31, i = 0; u < 98; u += 5.5, i++) { const p = uv(u, (i % 2 ? 0.52 : -0.56) + 0.08 * Math.sin(u)); ctx.moveTo(p[0] + 1.25 * U, p[1]); ctx.arc(p[0], p[1], 1.25 * U, 0, TAU); }
  ctx.fill();
  gloss(ctx, E, [[33, 40], [62, 68]], 0.66, 1.5, 0.5);
}
function thornSnort(ctx, E) { // it snorts: two puffs out of the nostrils when it is cross (and now and then anyway)
  const { U, P, t, hcx, hcy, ha, hs, id } = E, f = P.angry > 0.2 ? mod(t * 2.2, 1) : mod(t + id * 0.7, 3.4) / 0.7;
  if (f >= 1 || P.dazed > 0.3 || E.belly) return;
  const ca = Math.cos(ha), sa = Math.sin(ha);
  ctx.fillStyle = `rgba(255,250,236,${0.6 * Math.sin(f * Math.PI)})`; ctx.beginPath();
  for (const sd of [-1, 1]) { const d = (16 + f * 9) * hs, o = sd * (3.4 + f * 5) * hs, X = hcx + ca * d - sa * o, Y = hcy + sa * d + ca * o, r = (1.4 + f * 2.6) * U; ctx.moveTo(X + r, Y); ctx.arc(X, Y, r, 0, TAU); ctx.moveTo(X + ca * r * 1.2 + r * 0.7, Y + sa * r * 1.2); ctx.arc(X + ca * r * 1.2, Y + sa * r * 1.2, r * 0.7, 0, TAU); }
  ctx.fill();
}
function thornHead(ctx, E) {
  const { K, P, t, lwH, fu, lx, ly, opts, id, belly } = E;
  const m = clamp(P.mouth, 0, 1), fx = 17 - 3.5 * m;
  for (const [x, y, tx, ty, hw] of [[1, 15, -6, 24.5, 3.1], [-9, 10.5, -23.5, 18, 3.8], [-11.5, 4, -22.5, 6.5, 2.9]]) for (const sd of [-1, 1]) spike(ctx, E, x, sd * y, tx, sd * ty, hw, lwH); // the crown of horns
  if (m > 0.03) jaw(ctx, E, m, 5, 13, 14.5, 2);
  const hp = () => { ctx.beginPath(); spline(ctx, [[-13, -10], [-9, -15.5], [0, -17.5], [8, -16.2], [13.5, -12], [fx, -6], [fx, 6], [13.5, 12], [8, 16.2], [0, 17.5], [-9, 15.5], [-13, 10]], true, 0.5); };
  skull(ctx, E, hp, [1, 13, 12], () => {
    ctx.beginPath(); ctx.ellipse(fx - 3.5, 0, 7.5, 12.5, 0, 0, TAU); ctx.fillStyle = rgb(K.jaw, 0.6); ctx.fill(); // pale muzzle
    ctx.beginPath(); spline(ctx, [[-16, -7.5], [-7, -8], [1, -5], [5.5, 0], [1, 5], [-7, 8], [-16, 7.5]], true, 0.4); ctx.fillStyle = rgb(K.blot); ctx.fill(); // dark crown plate
    ctx.fillStyle = rgb(K.blotHi); for (const [x, y] of [[-9.5, -3.6], [-9.5, 3.6], [-3, 0]]) { ctx.beginPath(); ctx.arc(x + lx * 0.6, y + ly * 0.6, 1.7, 0, TAU); ctx.fill(); }
  });
  nostrils(ctx, E, fx - 2.4, 3.6, 0.95);
  if (m <= 0.03) {
    lip(ctx, E, fx, 17.2, 0, 2);
    ctx.fillStyle = rgb(K.tooth); ctx.strokeStyle = rgb(K.line); ctx.lineWidth = lwH * 0.7; // the underbite: two tusks over the lip
    for (const sd of [-1, 1]) { ctx.beginPath(); poly(ctx, [[fx - 6, sd * 4.8], [fx + 1.4, sd * 6.6], [fx - 6, sd * 8.6]]); ctx.fill(); ctx.stroke(); }
    if (P.dazed > 0.4) lolling(ctx, E, fx);
  }
  const blink = opts.blink !== undefined ? opts.blink : blinkAt(t, id + 1), look = opts.look || { x: 0.75, y: 0 };
  for (const sd of [-1, 1]) {
    const r = 6.4, ex = 3.5, ey = sd * 10.6, dz = Math.max(P.dazed, belly ? 1 : 0);
    let lid = 0.5 + 0.1 * P.angry - 0.05 * P.walk; lid = lerp(lid, sd === fu ? 0.6 : 0.36, dz); lid = Math.max(lid, blink);
    const th = lerp(0.66, 0.9, P.angry) * (1 - dz);
    lidEye(ctx, ex, ey, r, sd, { K, lx, ly, lw: lwH, lid, th, t, look, spin: dz > 0.5, pr: r * 0.42, heavy: 1.4 });
    if (lid < 0.8) { // the brow: a bony slab along the lid, sticking out past the eye
      const dx = Math.cos(th), dy = sd * Math.sin(th), h = -r + 2 * r * lid - 1.6, cx = ex + dx * h, cy = ey + dy * h, e = r + 1.4;
      ctx.beginPath(); ctx.moveTo(cx - dy * e, cy + dx * e); ctx.lineTo(cx + dy * e, cy - dx * e);
      ctx.strokeStyle = rgb(K.line); ctx.lineWidth = 3.6 + lwH; ctx.stroke(); ctx.strokeStyle = rgb(K.blot); ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - dy * e + lx * 0.8, cy + dx * e + ly * 0.8); ctx.lineTo(cx + dy * e + lx * 0.8, cy - dx * e + ly * 0.8); ctx.strokeStyle = rgb(K.blotHi); ctx.lineWidth = 1.2; ctx.stroke();
    }
  }
}

/* ================================================================ CHAMELEON */
function chamPattern(ctx, E) {
  const { U, K } = E;
  ctx.fillStyle = rgb(K.blot); ctx.beginPath(); // teal bands, raked back; rings down the tail and round the curl
  for (const uc of [35, 49, 63, 77]) poly(ctx, [uv(uc - 3, -1.25), uv(uc + 2.6, -1.25), uv(uc + 7, 1.25), uv(uc + 1.4, 1.25)]);
  for (let u = 94; u < 206; u += 12.5) poly(ctx, [uv(u, -1.5), uv(u + 4.4, -1.5), uv(u + 4.4, 1.5), uv(u, 1.5)]);
  ctx.fill();
  ctx.strokeStyle = rgb(K.blotHi); ctx.lineWidth = 1.1 * U; ctx.beginPath();
  for (const uc of [35, 49, 63, 77]) { const a = uv(uc - 3, -1.25), b = uv(uc + 1.4, 1.25); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
  ctx.stroke();
  ctx.fillStyle = rgb(K.dot); ctx.beginPath(); // a row of yellow dots down each flank
  for (let u = 29; u < 90; u += 7) for (const v of [-0.6, 0.6]) { const p = uv(u, v); ctx.moveTo(p[0] + 1.6 * U, p[1]); ctx.arc(p[0], p[1], 1.6 * U, 0, TAU); }
  ctx.fill();
  gloss(ctx, E, [[30, 42], [56, 60], [100, 112]], 0.6, 1.6, 0.8);
}
function chamCrest(ctx, E) { // saw teeth down the spine, leaning out of the light
  const { U, K, lw } = E;
  ctx.fillStyle = rgb(K.lo); ctx.strokeStyle = rgb(K.line); ctx.lineWidth = lw * 0.7; ctx.beginPath();
  for (let u = 24; u < 96; u += 6) { const a = uv(u, 0), b = uv(u + 5.4, 0), q = spInto(u + 3.4, Q), r = 4.2 * U * (1 - (u - 24) / 150); poly(ctx, [a, [q.x - LX * r, q.y - LY * r], b]); }
  ctx.fill(); ctx.stroke();
}
// a turret eye: a scaly cone with a pinhole; ang / amt = where it points, in head space
function turret(ctx, E, sd, ang, amt, lid, spin) {
  const { K, lx, ly, lwH, P, t } = E, ex = 3.5, ey = sd * 10.9, r = 8.3 + 0.6 * P.swell, ring = rgb(mixA(K.blot, K.line, 0.45));
  const ca = Math.cos(ang) * amt, sa = Math.sin(ang) * amt, ax = ex + ca * r * 0.4, ay = ey + sa * r * 0.4, ar = 3.9;
  ctx.beginPath(); ctx.arc(ex, ey, r + 0.9, 0, TAU); ctx.fillStyle = ring; ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(ex, ey, r, 0, TAU); ctx.fillStyle = rgb(K.lo); ctx.fill(); ctx.clip();
  ctx.beginPath(); ctx.arc(ex + lx * 2, ey + ly * 2, r, 0, TAU); ctx.fillStyle = rgb(K.base); ctx.fill();
  ctx.beginPath(); ctx.arc(ex + lx * 3.6, ey + ly * 3.6, r * 0.6, 0, TAU); ctx.fillStyle = rgb(K.hi, 0.85); ctx.fill();
  ctx.strokeStyle = rgb(K.lo, 0.9); ctx.lineWidth = 0.9;
  for (const k of [0.8, 0.6]) { ctx.beginPath(); ctx.arc(lerp(ax, ex, k), lerp(ay, ey, k), r * k, 0, TAU); ctx.stroke(); } // skin folds, sliding with the gaze
  ctx.restore();
  ctx.beginPath(); ctx.arc(ax, ay, ar + 0.85, 0, TAU); ctx.fillStyle = ring; ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(ax, ay, ar, 0, TAU); ctx.fillStyle = rgb(K.eye); ctx.fill(); ctx.clip();
  if (spin) {
    ctx.strokeStyle = rgb(K.pupil); ctx.lineWidth = 0.95; ctx.beginPath();
    for (let i = 0; i <= 20; i++) { const a = i * 0.55 + t * 5 * sd, rr = 0.3 + (i / 20) * ar * 0.8; ctx.lineTo(ax + Math.cos(a) * rr, ay + Math.sin(a) * rr); }
    ctx.stroke();
  } else {
    const px = ax + ca * 1.1, py = ay + sa * 1.1;
    ctx.beginPath(); ctx.arc(px, py, 2.25, 0, TAU); ctx.fillStyle = rgb(K.pupil); ctx.fill();
    ctx.beginPath(); ctx.arc(px + lx * 0.9, py + ly * 0.9, 0.75, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
  }
  if (lid > 0.01) { // the smug lid: a flat skin edge over the back of the pinhole
    const e = ax - ar + 2 * ar * lid;
    ctx.fillStyle = rgb(K.lid); ctx.fillRect(ax - ar - 1, ay - ar - 1, e - (ax - ar - 1), 2 * ar + 2);
    ctx.beginPath(); ctx.moveTo(e, ay - ar - 1); ctx.lineTo(e, ay + ar + 1); ctx.strokeStyle = ring; ctx.lineWidth = 1.2; ctx.stroke();
  }
  ctx.restore();
  ctx.beginPath(); ctx.arc(ex, ey, r, 0, TAU); ctx.strokeStyle = ring; ctx.lineWidth = lwH * 0.9; ctx.stroke();
}
function chamHead(ctx, E) {
  const { K, P, t, lwH, fu, ly, opts, id } = E;
  const m = clamp(P.mouth, 0, 1), fx = 20.5 - 3 * m, sq = P.swell;
  if (m > 0.03) jaw(ctx, E, m, 9, 10, 8.4, 0);
  const hp = () => { ctx.beginPath(); spline(ctx, [[-25, -1.6], [-15, -8.5], [-4, -11.5 - 3.4 * sq], [6, -10.5 - 2.4 * sq], [13.5, -7.2], [fx, -3.2], [fx, 3.2], [13.5, 7.2], [6, 10.5 + 2.4 * sq], [-4, 11.5 + 3.4 * sq], [-15, 8.5], [-25, 1.6]], true, 0.45); };
  skull(ctx, E, hp, [-2, 13, 7], () => {
    const s1 = ly < 0 ? -1 : 1; // the helmet: one face to the light, one away, a ridge between
    ctx.beginPath(); poly(ctx, [[-26, 0], [-13, s1 * 8.4], [3, s1 * 3.4], [7, 0]]); ctx.fillStyle = rgb(K.hi, 0.75); ctx.fill();
    ctx.beginPath(); poly(ctx, [[-26, 0], [-13, -s1 * 8.4], [3, -s1 * 3.4], [7, 0]]); ctx.fillStyle = rgb(K.lo, 0.7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(7, 0); ctx.strokeStyle = rgb(K.line, 0.75); ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); poly(ctx, [[9, -12], [12.4, -12], [12.4, 12], [9, 12]]); ctx.fillStyle = rgb(K.blot); ctx.fill(); // a teal band over the snout
    ctx.beginPath(); spline(ctx, [[1, -11.2], [6, -10.3], [13.5, -7], [fx - 0.7, -3.1], [fx - 0.7, 3.1], [13.5, 7], [6, 10.3], [1, 11.2]], false, 0.45); ctx.strokeStyle = rgb(K.jaw); ctx.lineWidth = 2.4; ctx.stroke(); // pale lips
  });
  ctx.beginPath(); ctx.arc(fx - 2.4, 0, 1.7, 0, TAU); ctx.fillStyle = rgb(K.top); ctx.fill(); // nose bump
  nostrils(ctx, E, fx - 3.4, 2.3, 0.6);
  if (m <= 0.03) { lip(ctx, E, fx, 11.6, 1.8, 1.5); if (P.dazed > 0.4) lolling(ctx, E, fx); }
  // the eyes: one keeps watch ahead, the other goes sightseeing; they only agree when there is something to eat
  const blink = opts.blink !== undefined ? opts.blink : blinkAt(t, id + 1), hunt = clamp(Math.max(P.snatch * 4, m * 2, opts.hunt || 0), 0, 1), spin = P.dazed > 0.5;
  const q = t / 1.6 + id * 0.31, n = Math.floor(q), f = sstep((q - n) / 0.22);
  let aA = opts.look ? Math.atan2(opts.look.y, opts.look.x) : 0.3 * Math.sin(t * 0.6 + id), aB = lerp(hash(n * 7.3 + id - 7.3), hash(n * 7.3 + id), f) * TAU;
  if (Math.cos(aB - aA) > 0.3) aB += 2; // never the same way
  aA = lerp(aA, -fu * 0.25, hunt); aB = lerp(aB, fu * 0.25, hunt);
  for (const sd of [-1, 1]) {
    const main = sd === fu;
    turret(ctx, E, sd, main ? aA : aB, 1, Math.max(blink, lerp(main ? 0.52 : 0.36, 0.05, hunt) + 0.3 * P.dazed), spin);
  }
}
function chamTongue(ctx, E) { // 'snatch': the tongue fires at opts.target, sticks, and reels back in
  const { U, K, P, t, lw, opts, x0, y0, hcx, hcy, ha, hs } = E;
  if (P.snatch <= 0.01) return;
  const ca = Math.cos(ha), sa = Math.sin(ha), mx = hcx + ca * 17 * hs, my = hcy + sa * 17 * hs;
  const tg = opts.target ? { x: opts.target.x - x0, y: opts.target.y - y0 } : { x: mx + ca * 120 * U, y: my + sa * 120 * U };
  const tx = lerp(mx, tg.x, P.snatch), ty = lerp(my, tg.y, P.snatch), dx = tx - mx, dy = ty - my, L = Math.hypot(dx, dy) || 1, sag = Math.sin(t * 25) * 0.8 * U + L * 0.06 * (1 - P.snatch);
  const dark = rgb(mixA(K.tongue, K.mouth, 0.6));
  ctx.beginPath(); ctx.moveTo(mx, my); ctx.quadraticCurveTo((mx + tx) / 2 - (dy / L) * sag, (my + ty) / 2 + (dx / L) * sag, tx, ty);
  ctx.strokeStyle = dark; ctx.lineWidth = 3.4 * U + lw; ctx.stroke(); ctx.strokeStyle = rgb(K.tongue); ctx.lineWidth = 3.4 * U; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(tx, ty, 5.4 * U, 4.6 * U, Math.atan2(dy, dx), 0, TAU); ctx.fillStyle = rgb(K.tongue); ctx.fill(); ctx.strokeStyle = dark; ctx.lineWidth = lw * 0.9; ctx.stroke(); // the sticky club
  ctx.beginPath(); ctx.arc(tx + LX * 2 * U, ty + LY * 2 * U, 1.4 * U, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
  if (opts.out) opts.out.tongue = { x: tx + x0, y: ty + y0, k: P.snatch };
}
