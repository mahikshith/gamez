// The lava salamander: one species of the crawler rig (see crawlers.js for the options).
// drawSalamander(ctx, x, y, s, t, opts): snout at (x, y), s = snout-to-hips px (in game: 1.8 m * k).
// Poses: 'walk' | 'idle' | 'hiss' | 'breath' | 'dazed' | 'flee' | 'cool'.
//
// In game (v3.2): drawSalHeat() paints the red-hot ring sections and the breath's target mark (after the rings,
// under the eggs); drawSalamanders() draws each creature from the sim's trail (sim/salamander.js), with the leg
// cycle pinned to the distance it walked (C.odo), so planted feet stay put, and ride along when its ring turns.
// ctx is in world space (meters, y up) for both.
import { crawlerAnim, poseParams, drawPit } from './crawlers.js';
import { drawVenom } from './v3art.js';
import { statusClock, statusDraw, dizzyStars } from './status.js';
import { spline, blinkAt } from './castkit.js';
import { RING_TH, TAU } from '../sim/geom.js';
import { SAL } from '../sim/salamander.js';
import { drawGecko15 } from './gecko15.js'; // L15: the frost gecko is a sim crawler too
import { drawThorn20 } from './crystal20.js'; // L20: Duke Quartz and Spike, the thorn-backs
import { drawCham26 } from './cham26.js'; // L26: Sly the chameleon
import { strikeActOf } from './strikehit.js'; // Chick Strike: the pose it takes when a chick hits it

export const salamanderAnim = crawlerAnim;
export const SALAMANDER_LEN = 1.96; // snout to tail tip, in units of s (the sim's body length; the drawn tail is a touch shorter and fatter)

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
const lerp = (a, b, k) => a + (b - a) * k;
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const pxSpace = (ctx, x, y, k, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(1 / k, -1 / k); try { f(); } catch (e) { /* art never breaks the frame */ } ctx.restore(); };

/* ================================================================ the fire salamander (v4 art)
   A glossy, fat-tailed amphibian seen from above with the face tipped up at the camera: a head a quarter of its
   length, heavy-lidded eyes, a mouth that acts. Bright molten body, a few big dark flame blotches, wet highlight
   down the spine. Same rig contract as the crawlers (snout at x, y; s = snout to hips; opts as in crawlers.js). */
const NS = 46, UMAX = 174, DU = UMAX / (NS - 1), U_SH = 40, U_HIP = 82, U_HEAD = 13, STRIDE = 40, DUTY = 0.6;
const HW = [[0, 13], [18, 14], [30, 16.5], [40, 18.6], [52, 19.6], [64, 18.6], [74, 18.4], [84, 18], [96, 15], [112, 12], [134, 8.6], [156, 5.4], [168, 3.4], [174, 2]];
const LEGS = [
  { g: U_SH, side: -1, off: 0, front: true }, { g: U_SH, side: 1, off: 0.5, front: true },
  { g: U_HIP, side: -1, off: 0.5, front: false }, { g: U_HIP, side: 1, off: 0, front: false },
];
// flame blotches in spine space: [u centre, v centre (fraction of the half-width), length, half-width fraction, mirror]
const BLOTS = [[39, 0, 17, 0.6, 1], [64, 0.3, 18, 0.52, 1], [88, -0.22, 18, 0.56, -1]];
const BANDS = [[113, 9], [131, 7.5], [147, 6], [160, 4.5]]; // tail bands: [u, length]
const FLAME = [[-0.5, 0], [-0.32, 0.78], [0.05, 1], [0.5, 0.95], [1.15, 0.7], [0.55, 0.3], [0.95, -0.1], [0.42, -0.3], [0.7, -0.85], [0.2, -1], [-0.25, -0.88]];
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const mixA = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
export const rgb = (c, al = 1) => (al >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${al})`);
export const palOf = (o) => { const r = {}; for (const k in o) r[k] = hex(o[k]); return r; };
const HOT = palOf({ line: '#6e1c06', lo: '#c2330a', base: '#ff7414', hi: '#ffab2c', top: '#ffd45a', blot: '#3a1108', blotHi: '#6b2610', jaw: '#ffd872', leg: '#ee5f10', legLo: '#a52c08', pad: '#ffc04a', lid: '#e25a0e', eye: '#fff6d2', eyeLo: '#f0c26a', pupil: '#1a0803', mouth: '#4a0b12', throat: '#8a1c1a', tongue: '#ff7684', tooth: '#fff8e2' });
const ASH = palOf({ line: '#262220', lo: '#45413e', base: '#77726c', hi: '#989189', top: '#bdb7ae', blot: '#2c2927', blotHi: '#4a4643', jaw: '#aaa49b', leg: '#67625d', legLo: '#403c39', pad: '#b5afa6', lid: '#5d5853', eye: '#f3efe2', eyeLo: '#c9c3b4', pupil: '#141210', mouth: '#2e2327', throat: '#57474a', tongue: '#b9979c', tooth: '#eeeae0' });
const bx = new Float64Array(NS), by = new Float64Array(NS), sx = new Float64Array(NS), sy = new Float64Array(NS), snx = new Float64Array(NS), sny = new Float64Array(NS), sw = new Float64Array(NS);
const PT = { x: 0, y: 0, a: 0 }, Q = { x: 0, y: 0, nx: 0, ny: 0, w: 0 };
const faceUp = {};
export const LX = -0.5, LY = -0.87; // light: screen top-left
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

export function drawSalamander(ctx, x, y, s, t = 0, opts = {}) {
  if (!(s > 0)) return;
  opts = opts || {};
  ctx.save();
  try {
    const st = opts.status, U = s / 100;
    if (st && (st.k === 'ice' || st.k === 'thaw' || (st.k === 'stun' && st.zap >= 0))) {
      const pts = [];
      if (typeof opts.trail === 'function') for (let d = 0; d <= UMAX * U; d += 6 * U) pts.push(opts.trail(d));
      pts.push({ x, y }, { x: x - Math.cos(opts.heading || 0) * UMAX * U, y: y - Math.sin(opts.heading || 0) * UMAX * U });
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
      const pad = 38 * U, o2 = st.k === 'stun' ? opts : { ...opts, blink: 0.5, noShadow: 1 };
      statusDraw(ctx, { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad }, (c) => drawSal(c, x, y, s, t, o2), st, { off: Math.max(1.1, 1.4 * U), crys: Math.max(1, U * 1.1) });
    } else drawSal(ctx, x, y, s, t, opts);
  } catch (e) {
    if (opts.debug) throw e;
  }
  ctx.restore();
}

function footFor(L, gait, P, path, U, t) {
  const rf = DUTY * STRIDE / 2 + (L.front ? 4 : -6);
  const lat = (L.front ? 27.5 : 29.5) + P.splay * 5;
  const q = gait / STRIDE + L.off, n = Math.floor(q), psi = q - n;
  const plantS = (m) => (m - L.off) * STRIDE - L.g + rf;
  let S, lift = 0, w = 0;
  if (psi < DUTY || P.walk < 0.01) S = psi < DUTY ? plantS(n) : plantS(n + 1);
  else { w = (psi - DUTY) / (1 - DUTY); S = lerp(plantS(n), plantS(n + 1), sstep(w)); lift = Math.sin(Math.PI * w); }
  const pt = path((gait - S) * U), nx = -Math.sin(pt.a), ny = Math.cos(pt.a), ll = lat - lift * 4;
  let fx = pt.x + nx * L.side * ll * U, fy = pt.y + ny * L.side * ll * U;
  // toes point out and forward; a lifted foot curls in, then flicks open just before it plants
  const fa = pt.a + L.side * (L.front ? 0.5 : 1.05) - L.side * 0.35 * lift * (w < 0.6 ? 1 : -0.6);
  if (L.front && P.rear > 0) { // reared: the hands come off the ground and hover by the chest
    const g = spInto(L.g + 10, Q), tx = g.x + g.nx * L.side * 23 * U, ty = g.y + g.ny * L.side * 23 * U, wv = Math.sin(t * 9 + L.side) * 2 * U * P.rear;
    fx = lerp(fx, tx + wv, P.rear); fy = lerp(fy, ty - wv, P.rear); lift = Math.max(lift, P.rear);
  }
  const g = spInto(L.g, Q), hip = { x: g.x + g.nx * L.side * g.w * 0.55, y: g.y + g.ny * L.side * g.w * 0.55 };
  const ox = g.nx * L.side, oy = g.ny * L.side, fwx = -g.ny * 1, fwy = g.nx * 1; // outward; along the body (sign fixed below)
  return { L, hip, fx, fy, fa, lift, ox, oy, pa: pt.a, fwx, fwy };
}
function ik(hx, hy, fx, fy, l1, l2, px, py) {
  let dx = fx - hx, dy = fy - hy, D = Math.hypot(dx, dy) || 1e-6;
  const max = (l1 + l2) * 0.995;
  if (D > max) { fx = hx + (dx / D) * max; fy = hy + (dy / D) * max; dx = fx - hx; dy = fy - hy; D = max; }
  const a = Math.acos(clamp((l1 * l1 + D * D - l2 * l2) / (2 * l1 * D), -1, 1)), b = Math.atan2(dy, dx);
  const k1x = hx + Math.cos(b + a) * l1, k1y = hy + Math.sin(b + a) * l1, k2x = hx + Math.cos(b - a) * l1, k2y = hy + Math.sin(b - a) * l1;
  return k1x * px + k1y * py > k2x * px + k2y * py ? { kx: k1x, ky: k1y, fx, fy } : { kx: k2x, ky: k2y, fx, fy };
}
// chunky limbs: thigh, shin, a round palm and four toes with pads. Two passes (ink, then colour) so the ink stays thin.
// G: limb geometry in U (the salamander's is the default; its cousins in cousins.js pass their own)
export const LEG_G = { l1f: 14, l1h: 15.5, l2f: 14, l2h: 15, wf: 12.5, wh: 15, wl: 9.6, hf: 8, hh: 10, hl: 6, toes: 4, spread: 0.58, lenF: 8.6, lenH: 9.6, toeW: 3.3, tip: 2.9, pad: 1.9, palm: 5.6, knee: 3.3 };
export function drawLegs(ctx, feet, U, K, lw, G = LEG_G) {
  const J = feet.map((f) => {
    const fr = f.L.front, ca = Math.cos(f.pa), sa = Math.sin(f.pa), kf = fr ? -0.7 : 0.8; // elbows point back, knees forward
    const j = ik(f.hip.x, f.hip.y, f.fx, f.fy, (fr ? G.l1f : G.l1h) * U, (fr ? G.l2f : G.l2h) * U, f.ox + ca * kf, f.oy + sa * kf);
    return { f, j, k: 1 + 0.16 * f.lift };
  });
  // lifted feet throw a small shadow where they will land
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (const { f, j } of J) if (f.lift > 0.05) { ctx.beginPath(); ctx.ellipse(j.fx + 3 * U * f.lift, j.fy + 4.5 * U * f.lift, 6 * U, 5 * U, 0, 0, TAU); ctx.fill(); }
  const limb = (o, wU, wL) => {
    const { f, j } = o;
    ctx.lineWidth = wU; ctx.beginPath(); ctx.moveTo(f.hip.x, f.hip.y); ctx.lineTo(j.kx, j.ky); ctx.stroke();
    ctx.lineWidth = wL; ctx.beginPath(); ctx.moveTo(j.kx, j.ky); ctx.lineTo(j.fx, j.fy); ctx.stroke();
  };
  const foot = (o, grow, pads) => {
    const { f, j, k } = o, n = G.toes, len = (f.L.front ? G.lenF : G.lenH) * U * k;
    for (let i = 0; i < n; i++) {
      const a = f.fa + (i - (n - 1) / 2) * G.spread, c = Math.cos(a), s2 = Math.sin(a);
      if (!pads) { ctx.lineWidth = G.toeW * U * k + grow; ctx.beginPath(); ctx.moveTo(j.fx, j.fy); ctx.lineTo(j.fx + c * len, j.fy + s2 * len); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(j.fx + c * len, j.fy + s2 * len, (pads ? G.pad : G.tip) * U * k + grow / 2, 0, TAU); ctx.fill();
    }
    if (!pads) { ctx.beginPath(); ctx.arc(j.fx, j.fy, G.palm * U * k + grow / 2, 0, TAU); ctx.fill(); }
  };
  ctx.lineCap = 'round';
  ctx.strokeStyle = ctx.fillStyle = rgb(K.line);
  for (const o of J) { limb(o, (o.f.L.front ? G.wf : G.wh) * U + 2 * lw, G.wl * U + 2 * lw); foot(o, 2 * lw, false); }
  for (const o of J) {
    const lit = mixA(K.leg, K.hi, 0.45 * o.f.lift);
    ctx.strokeStyle = ctx.fillStyle = rgb(mixA(K.legLo, lit, 0.35)); limb(o, (o.f.L.front ? G.wf : G.wh) * U, G.wl * U);
    ctx.strokeStyle = ctx.fillStyle = rgb(lit);
    // the lit top plane of the limb: the same strokes, thinner, pushed toward the light
    ctx.save(); ctx.translate(LX * 1.3 * U, LY * 1.3 * U); limb(o, (o.f.L.front ? G.hf : G.hh) * U, G.hl * U); ctx.restore();
    foot(o, 0, false);
    ctx.fillStyle = rgb(K.blot); // a dark band over the elbow / knee
    ctx.beginPath(); ctx.arc(o.j.kx, o.j.ky, G.knee * U, 0, TAU); ctx.fill();
    ctx.fillStyle = rgb(K.pad); foot(o, 0, true);
  }
}

function drawJet(ctx, x, y, a, k, U, t, len) {
  const reach = sstep(k * 1.6), L = len * U * (0.3 + 0.7 * reach), ca = Math.cos(a), sa = Math.sin(a), N = 12;
  const layers = [['rgba(150,26,6,0.85)', 1.14, 1], ['#ff6a14', 0.92, 0.96], ['#ffc83a', 0.6, 0.86], ['#fff6c8', 0.3, 0.68]];
  for (let li = 0; li < layers.length; li++) {
    const [col, wk, lk] = layers[li];
    ctx.fillStyle = col; ctx.beginPath();
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i <= N; i++) {
      const f = pass ? 1 - i / N : i / N, sd = pass ? -1 : 1;
      const lick = Math.sin(t * 31 - f * 11 + li) * 0.5 + Math.sin(t * 19 - f * 7 + sd * 1.7) * 0.5;
      const r = (2.5 + 17 * Math.pow(Math.sin(Math.PI * Math.pow(f, 0.62)), 0.8)) * U * wk * k * (1 + 0.2 * lick * f);
      const d = L * lk * f, off = Math.sin(t * 13 - f * 5) * 2.4 * U * f;
      const X = x + ca * d - sa * (sd * r + off), Y = y + sa * d + ca * (sd * r + off);
      if (!pass && !i) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    }
    ctx.closePath(); ctx.fill();
  }
  const tx = x + ca * L, ty = y + sa * L;
  ctx.fillStyle = '#ffd860'; ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const f = (((t * 3.1 + i * 0.29) % 1) + 1) % 1, sd = i % 2 ? 1 : -1, d = f * 17 * U * reach, X = tx - sa * sd * d - ca * f * 6 * U, Y = ty + ca * sd * d - sa * f * 6 * U, r = 1.8 * U * (1 - f) * k;
    ctx.moveTo(X + r, Y); ctx.arc(X, Y, Math.max(0.3, r), 0, TAU);
  }
  ctx.fill();
  return { x: tx, y: ty };
}

function drawSteam(ctx, U, t, k) {
  for (let i = 0; i < 8; i++) {
    const f = (((t * 0.55 + i * 0.29) % 1) + 1) % 1, q = spInto(Math.min(UMAX, 6 + i * 21), Q);
    const X = q.x + Math.sin(i * 4.1 + t * 1.3) * 5 * U, Y = q.y - 6 * U - f * 30 * U, r = (3.4 + f * 7) * U;
    ctx.fillStyle = `rgba(246,248,250,${k * 0.55 * Math.sin(f * Math.PI)})`;
    ctx.beginPath(); ctx.arc(X, Y, r, 0, TAU); ctx.arc(X + r * 0.75, Y + r * 0.25, r * 0.7, 0, TAU); ctx.arc(X - r * 0.6, Y + r * 0.35, r * 0.55, 0, TAU); ctx.fill();
  }
}

function drawSal(ctx, x0, y0, s, t, opts) {
  const U = s / 100, pose = opts.pose || 'walk';
  const P = poseParams(pose, clamp(opts.p || 0, 0, 1));
  if (opts.blend) for (const c in P) if (opts.blend[c] !== undefined) P[c] = opts.blend[c];
  if (opts.rear !== undefined) P.rear = opts.rear;
  if (opts.mouth !== undefined) P.mouth = opts.mouth;
  const cool = clamp(opts.cool !== undefined ? opts.cool : pose === 'cool' ? 1 : 0, 0, 1);
  if (cool > 0.3) P.steam = Math.max(P.steam, cool);
  const glow = (clamp(opts.glow !== undefined ? opts.glow : 0.75, 0, 1) + P.swell * 0.5) * (1 - cool);
  const gait = (opts.gait || 0) / U;
  // palette: heat pushes the skin toward yellow-white, cooling drains it to ash
  const K = {}, heat = clamp((glow - 0.6) / 0.7, 0, 1), flick = 0.5 + 0.5 * Math.sin(t * 2.4);
  for (const k in HOT) K[k] = cool > 0 ? mixA(HOT[k], ASH[k], cool) : HOT[k];
  if (heat > 0 && cool < 1) {
    const h = heat * (0.75 + 0.25 * flick) * (1 - cool);
    K.base = mixA(K.base, HOT.hi, 0.55 * h); K.hi = mixA(K.hi, HOT.top, 0.6 * h); K.top = mixA(K.top, [255, 246, 200], 0.6 * h); K.lo = mixA(K.lo, HOT.base, 0.4 * h); K.lid = mixA(K.lid, HOT.base, 0.4 * h);
  }
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

  // ---- spine: an S-curve while walking (shoulders and hips counter-swing), the tail whips after it with a lag
  const ph = (gait / STRIDE) * TAU, wk = P.walk * (1 - P.rear * 0.8), A = 6.4 * (P.flee ? 1.25 : 1) * wk, cph = Math.cos(ph);
  const breathe = 1 + 0.04 * Math.sin(t * 2.3) * (1 - P.walk) + P.swell * 0.14, idle = (1 - P.walk) * (1 - P.dazed * 0.6);
  for (let i = 0; i < NS; i++) {
    const u = i * DU, q = path(u * U);
    let lat;
    if (u < U_SH) lat = A * 0.5 * cph * (1 - u / U_SH);
    else if (u < U_HIP) lat = -A * cph * Math.sin((Math.PI * (u - U_SH)) / (U_HIP - U_SH));
    else {
      const r = clamp((u - U_HIP) / 22, 0, 1), f = (u - U_HIP) / (UMAX - U_HIP);
      lat = -(3 + 19 * f * (0.6 + 0.4 * f)) * r * Math.cos(ph - (u - U_HIP) * (TAU / 96)) * wk; // follow-through: each bit of tail trails the bit before
      lat += idle * r * Math.sin(t * 1.25 - u * 0.045) * (2.5 + 11 * f * f); // lazy idle curl
      lat += P.shake * r * Math.sin(t * 22 - u * 0.1) * 6 * f; // rattle on a hiss
      lat += P.swell * r * 10 * f * f; // the tail cocks to one side as it winds up
    }
    const nx = -Math.sin(q.a), ny = Math.cos(q.a);
    bx[i] = q.x + nx * lat * U; by[i] = q.y + ny * lat * U;
    let w = hwAt(u);
    if (u > U_SH - 8 && u < U_HIP + 8) w *= breathe;
    sw[i] = w * U;
  }
  const hipI = Math.round(U_HIP / DU), fore = 0.22 * P.crouch + 0.26 * Math.sin(Math.PI * clamp(P.rear, 0, 1)) * (1 - P.crouch * 0.5);
  for (let i = 0; i < NS; i++) {
    let X = bx[i], Y = by[i];
    if ((P.rear > 0 || P.crouch > 0) && i < hipI) {
      const f = (U_HIP - i * DU) / U_HIP, c = 1 - f * fore + 0.07 * P.rear * f;
      X = bx[hipI] + (X - bx[hipI]) * c; Y = by[hipI] + (Y - by[hipI]) * c;
      sw[i] *= 1 + 0.26 * P.rear * f + 0.08 * P.crouch * f;
    }
    sx[i] = X; sy[i] = Y;
  }
  for (let i = 0; i < NS; i++) {
    const a = Math.max(0, i - 1), b = Math.min(NS - 1, i + 1), tx = sx[a] - sx[b], ty = sy[a] - sy[b], l = Math.hypot(tx, ty) || 1;
    snx[i] = -ty / l; sny[i] = tx / l;
  }
  const lw = Math.max(0.9, 1.5 * U), I0 = Math.round(15 / DU), WM = 19.6 * U;

  // ---- dive (flee into a lava pit): everything past the pit's centre line is under the lava
  let hole = null;
  if (opts.dive !== undefined && opts.dive !== null) {
    const q = path(opts.dive);
    hole = { x: q.x, y: q.y, a: q.a, r: 21 * U };
    drawPit(ctx, hole, U, t, true);
    ctx.save(); ctx.beginPath(); ctx.rect(-1e4, -1e4, 2e4, 2e4);
    const ca = Math.cos(hole.a), sa = Math.sin(hole.a), L = 1e4;
    ctx.moveTo(hole.x - sa * L, hole.y + ca * L); ctx.lineTo(hole.x - sa * L + ca * L, hole.y + ca * L + sa * L); ctx.lineTo(hole.x + sa * L + ca * L, hole.y - ca * L + sa * L); ctx.lineTo(hole.x + sa * L, hole.y - ca * L);
    ctx.closePath(); ctx.clip('evenodd');
  }

  const feet = LEGS.map((L) => footFor(L, gait, P, path, U, t));
  if (opts.out) opts.out.feet = feet.map((f) => ({ x: f.fx + x0, y: f.fy + y0, lift: f.lift }));

  // body outline scaled by k about the spine, pushed (ox, oy) in proportion to the local width
  const bodyPath = (k, ox, oy, X = sx, Y = sy) => {
    ctx.beginPath();
    for (let i = I0; i < NS; i++) { const m = sw[i] / WM; ctx.lineTo(X[i] + snx[i] * sw[i] * k + ox * m, Y[i] + sny[i] * sw[i] * k + oy * m); }
    for (let i = NS - 1; i >= I0; i--) { const m = sw[i] / WM; ctx.lineTo(X[i] - snx[i] * sw[i] * k + ox * m, Y[i] - sny[i] * sw[i] * k + oy * m); }
    ctx.closePath();
  };

  // ---- head frame
  const hc = spAt(U_HEAD), hb = spAt(U_HEAD + 12), hcx = hc.x, hcy = hc.y;
  let ha = Math.atan2(hcy - hb.y, hcx - hb.x) + (opts.aim || 0);
  ha += (Math.sin(t * 1.7) * 0.22 + 0.1 * Math.sin(t * 0.9 + 1)) * P.dazed;
  ha += Math.sin(t * 2.1 + 1) * 0.035 * idle; // an idle head is never quite still
  if (P.shake) ha += Math.sin(t * 31) * 0.05 * P.shake;
  const hs = (1.28 + 0.3 * P.rear) * U;
  const id = opts.id | 0, upness = -Math.sin(ha);
  let fu = faceUp[id] === undefined ? (upness >= 0 ? 1 : -1) : faceUp[id];
  if (upness > 0.3) fu = 1; else if (upness < -0.3) fu = -1;
  faceUp[id] = fu;

  // ---- contact shadow
  if (!opts.noShadow) {
    const so = 3.4 * U;
    ctx.fillStyle = `rgba(0,0,0,${0.3 - 0.08 * P.rear})`;
    bodyPath(1, so * 1.4, so * 1.9, bx, by); ctx.fill();
    ctx.beginPath(); ctx.ellipse(bx[3] + so * 1.2 + 5 * P.rear * U, by[3] + so * 1.7 + 7 * P.rear * U, 17 * hs, 19 * hs, ha, 0, TAU); ctx.fill();
  }

  // ---- legs under the body
  const upFront = P.rear > 0.35;
  drawLegs(ctx, upFront ? feet.filter((f) => !f.L.front) : feet, U, K, lw);

  // ---- body: heat halo, dark belly edge, lit back, flame blotches, wet highlight
  if (glow > 0.05) { bodyPath(1, 0, 0); ctx.strokeStyle = `rgba(255,110,24,${0.16 * glow})`; ctx.lineWidth = lw + 6 * U; ctx.stroke(); }
  bodyPath(1, 0, 0); ctx.fillStyle = rgb(K.lo); ctx.fill();
  ctx.save(); ctx.clip();
  bodyPath(0.84, LX * 3.2 * U, LY * 3.2 * U); ctx.fillStyle = rgb(K.base); ctx.fill();
  bodyPath(0.5, LX * 6.5 * U, LY * 6.5 * U); ctx.fillStyle = rgb(K.hi); ctx.fill();
  ctx.fillStyle = rgb(K.blot); ctx.beginPath();
  for (const [uc, vc, L, hv, mir] of BLOTS) {
    const pts = FLAME.map(([a, b]) => { const q = spInto(uc + a * L, Q), v = clamp(vc + b * hv * mir, -1.2, 1.2) * q.w; return [q.x + q.nx * v, q.y + q.ny * v]; });
    spline(ctx, pts, true, 0.5);
  }
  for (const [u, L] of BANDS) { // tail bands: chevrons that wrap the tail
    const a = spInto(u, Q), ax = a.x, ay = a.y, anx = a.nx, any = a.ny, aw = a.w, b = spInto(u + L, Q), tx = (b.x - ax) / L, ty = (b.y - ay) / L;
    ctx.moveTo(ax + anx * aw * 1.2 + tx * L * 0.5, ay + any * aw * 1.2 + ty * L * 0.5); ctx.lineTo(ax - tx * L * 0.25, ay - ty * L * 0.25); ctx.lineTo(ax - anx * aw * 1.2 + tx * L * 0.5, ay - any * aw * 1.2 + ty * L * 0.5);
    ctx.lineTo(b.x - b.nx * b.w * 1.2 + tx * L * 0.4, b.y - b.ny * b.w * 1.2 + ty * L * 0.4); ctx.lineTo(b.x - tx * L * 0.3, b.y - ty * L * 0.3); ctx.lineTo(b.x + b.nx * b.w * 1.2 + tx * L * 0.4, b.y + b.ny * b.w * 1.2 + ty * L * 0.4); ctx.closePath();
  }
  ctx.fill();
  // wet streak: broken highlights riding the lit side of the spine, crossing the blotches (gloss)
  ctx.strokeStyle = rgb(mixA(K.top, [255, 255, 255], 0.8), 0.92); ctx.lineWidth = 1.9 * U;
  for (const [a, b] of [[45, 55], [59, 61.5], [84, 93], [97, 99], [118, 126]]) {
    ctx.beginPath();
    for (let u = a; u <= b; u += 2) { const q = spInto(u, Q), o = q.w * 0.62; ctx.lineTo(q.x + LX * o, q.y + LY * o); }
    ctx.stroke();
  }
  ctx.restore();
  bodyPath(1, 0, 0); ctx.strokeStyle = rgb(K.line); ctx.lineWidth = lw; ctx.stroke();
  if (upFront) drawLegs(ctx, feet.filter((f) => f.L.front), U, K, lw);

  // ---- head
  if (P.dazed > 0.3) dizzyStars(ctx, hcx, hcy - 12 * U, 32 * U, 11 * U, t, { layer: 'back', size: 10 * U, fade: clamp((P.dazed - 0.3) / 0.4, 0, 1) });
  ctx.save();
  ctx.translate(hcx, hcy); ctx.rotate(ha); ctx.scale(hs * 1.1, hs * 1.1);
  drawHead(ctx, t, opts, P, K, cool, lw / (hs * 1.1), fu, ha, glow);
  ctx.restore();

  const ca = Math.cos(ha), sa = Math.sin(ha);
  if (P.fire > 0.01) {
    const mx = hcx + ca * (16 + 6 * P.mouth) * hs, my = hcy + sa * (16 + 6 * P.mouth) * hs;
    const tip = drawJet(ctx, mx, my, ha, P.fire, U, t, opts.fireLen || 60);
    if (opts.out) opts.out.fire = { x: tip.x + x0, y: tip.y + y0 };
  }
  if (hole) { ctx.restore(); drawPit(ctx, hole, U, t, false, opts.dive > 0 && opts.dive < UMAX * U ? 1 : 0); }
  if (P.steam > 0.01) drawSteam(ctx, U, t, P.steam * (opts.steam !== undefined ? opts.steam : 1));
  if (P.dazed > 0.3) dizzyStars(ctx, hcx, hcy - 12 * U, 32 * U, 11 * U, t, { layer: 'front', size: 10 * U, fade: clamp((P.dazed - 0.3) / 0.4, 0, 1) });
}

// The head, in its own space: +x = snout, units of hs (about 1.3 U). 34 long, 37 wide; puffs to 46 wide on the wind-up.
function drawHead(ctx, t, opts, P, K, cool, lw, fu, ha, glow) {
  const shock = sstep((cool - 0.25) / 0.5) * (1 - P.dazed), sq = P.swell;
  const m = clamp(P.mouth * (1 - 0.92 * sq), 0, 1); // the mouth clamps shut while the cheeks fill
  const lx = LX * Math.cos(ha) + LY * Math.sin(ha), ly = -LX * Math.sin(ha) + LY * Math.cos(ha); // the light, in head space
  const fx = 19 - 4.5 * m, ck = 18.5 + 6.5 * sq + 1.2 * m, line = rgb(K.line);
  const headPath = () => {
    ctx.beginPath();
    spline(ctx, [[-14, -9.5], [-9, -15.8 - 3 * sq], [-1, -ck], [8, -15.6 - 2.6 * sq], [fx - 3.2, -9.6], [fx, -3.6], [fx, 3.6], [fx - 3.2, 9.6], [8, 15.6 + 2.6 * sq], [-1, ck], [-9, 15.8 + 3 * sq], [-14, 9.5]], true, 0.5);
  };
  // ---- lower jaw, mouth and tongue (under the skull)
  const jx = 5.5 + 10.5 * m, jrx = 13.5 + 2.5 * m, jry = 14.6 + 0.8 * m;
  if (m > 0.03) {
    ctx.beginPath(); ctx.ellipse(jx, 0, jrx, jry, 0, 0, TAU);
    ctx.fillStyle = rgb(K.jaw); ctx.fill(); ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.ellipse(jx - 0.6, 0, jrx - 2.4, jry - 2.6, 0, 0, TAU);
    const g = ctx.createRadialGradient(4, 0, 2, jx, 0, jrx);
    g.addColorStop(0, rgb(mixA(K.throat, [255, 170, 60], 0.5 * P.fire + 0.35 * clamp(glow - 0.8, 0, 1)))); g.addColorStop(0.55, rgb(K.throat)); g.addColorStop(1, rgb(K.mouth));
    ctx.fillStyle = g; ctx.fill(); ctx.clip();
    // the tongue: fat, pink, it lashes on a hiss
    const tk = P.tongue * (1 - P.dazed), wag = Math.sin(t * 19) * 3.2 * tk, tl = jx + jrx - 7 + 1.5 * tk;
    if (P.fire < 0.5) {
      ctx.beginPath(); ctx.moveTo(4, 0); ctx.quadraticCurveTo((4 + tl) / 2, wag * 0.4, tl, wag);
      ctx.strokeStyle = rgb(mixA(K.tongue, K.mouth, 0.45)); ctx.lineWidth = 9.4; ctx.stroke();
      ctx.strokeStyle = rgb(K.tongue); ctx.lineWidth = 7.6; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(8, wag * 0.15); ctx.quadraticCurveTo((6 + tl) / 2, wag * 0.45, tl - 1, wag);
      ctx.strokeStyle = rgb(mixA(K.tongue, K.mouth, 0.35)); ctx.lineWidth = 0.9; ctx.stroke();
    }
    ctx.restore();
    // lower teeth: a row of blunt pegs along the front of the jaw
    ctx.fillStyle = rgb(K.tooth);
    for (let i = -2; i <= 2; i++) { const a = i * 0.36, X = jx + Math.cos(a) * (jrx - 2.6), Y = Math.sin(a) * (jry - 2.8); ctx.beginPath(); ctx.arc(X, Y, 1.25, 0, TAU); ctx.fill(); }
    // upper teeth: two fangs and their neighbours under the lip
    ctx.strokeStyle = line; ctx.lineWidth = lw * 0.6;
    for (const [ty, tl2] of [[-7.8, 2.6], [-3.4, 3.6], [3.4, 3.6], [7.8, 2.6]]) {
      const bx0 = fx - (Math.abs(ty) > 5 ? 2.6 : 0.6);
      ctx.beginPath(); ctx.moveTo(bx0 - 1, ty - 1.7); ctx.lineTo(bx0 + tl2 * Math.min(1, m * 2.5), ty); ctx.lineTo(bx0 - 1, ty + 1.7); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  // ---- skull: lit form, pale muzzle, a dark flame down the crown
  ctx.save();
  headPath(); ctx.fillStyle = rgb(K.lo); ctx.fill(); ctx.clip();
  ctx.save(); ctx.translate(lx * 2.2, ly * 2.2); headPath(); ctx.fillStyle = rgb(K.base); ctx.fill(); ctx.restore();
  ctx.beginPath(); ctx.ellipse(1 + lx * 6, ly * 7, 14, 12.5 + 2 * sq, 0, 0, TAU); ctx.fillStyle = rgb(K.hi); ctx.fill();
  ctx.beginPath(); ctx.ellipse(fx - 3, 0, 8.5, 12.5, 0, 0, TAU); ctx.fillStyle = rgb(K.jaw, 0.7); ctx.fill(); // muzzle
  if (sq > 0.05) for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(0.5, sd * (ck - 5.2), 6.5, 4.6, 0, 0, TAU); ctx.fillStyle = rgb(K.top, 0.85 * sq); ctx.fill(); } // stretched cheeks
  ctx.beginPath(); spline(ctx, [[-16, -7.2], [-8, -5.6], [-1, -3.4], [7.5, 0], [-1, 3.4], [-8, 5.6], [-16, 7.2]], true, 0.4); ctx.fillStyle = rgb(K.blot); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-11 + lx * 2.5, ly * 2.5); ctx.lineTo(-3 + lx * 2.5, ly * 2.5); ctx.strokeStyle = rgb(K.blotHi); ctx.lineWidth = 1.5; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(fx - 4.5 + lx * 2, ly * 4.5, 3.4, 1.5, Math.atan2(ly, lx) + Math.PI / 2, 0, TAU); ctx.fillStyle = rgb(mixA(K.top, [255, 255, 255], 0.6), 0.85); ctx.fill(); // wet snout
  ctx.restore();
  headPath(); ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.stroke();
  ctx.fillStyle = rgb(K.line); for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(fx - 2.3, sd * 3, 0.75, 1.15, sd * 0.5, 0, TAU); ctx.fill(); }

  // ---- mouth, closed: smirk / pursed / shocked O
  ctx.strokeStyle = line;
  if (m <= 0.03) {
    if (shock > 0.4) {
      const r = 3.6 * shock;
      ctx.beginPath(); ctx.ellipse(fx - 7, 0, r * 0.9, r * 1.1, 0, 0, TAU); ctx.fillStyle = rgb(K.mouth); ctx.fill(); ctx.lineWidth = lw * 1.2; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(fx - 7.6, 0, r * 0.4, r * 0.6, 0, 0, TAU); ctx.fillStyle = rgb(K.tongue); ctx.fill();
    } else if (sq > 0.25) {
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx - 5.4, -4.4); ctx.quadraticCurveTo(fx - 2.6, -2.2, fx - 4.6, 0); ctx.quadraticCurveTo(fx - 2.6, 2.2, fx - 5.4, 4.4); ctx.stroke();
      ctx.lineWidth = 1; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(fx - 8, sd * 6.4); ctx.lineTo(fx - 5.6, sd * 7.6); ctx.stroke(); }
    } else {
      // the smirk: a lip line round the muzzle; one corner hooks back toward the eye, the other stays flat
      const s1 = fu, grin = 0.5 + 0.5 * Math.sin(t * 0.8 + (opts.id | 0)) * 0.3;
      ctx.strokeStyle = rgb(mixA(K.blot, K.line, 0.35)); ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(6.5, -s1 * 12.6);
      ctx.bezierCurveTo(11, -s1 * 11.6, fx - 4.6, -s1 * 7, fx - 4.4, 0);
      ctx.bezierCurveTo(fx - 4.6, s1 * 7.5, 10, s1 * 12.4, 3.5, s1 * 14.2);
      ctx.quadraticCurveTo(-0.5 - grin, s1 * 15, -2.2 - grin, s1 * 12);
      ctx.stroke();
      ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-2.6, s1 * 15.6); ctx.quadraticCurveTo(-0.4, s1 * 16.6, 1.6, s1 * 16); ctx.stroke(); // cheek crease
      if (P.dazed > 0.4) { // the tongue lolls out of the low corner
        ctx.beginPath(); ctx.moveTo(fx - 5, -s1 * 5); ctx.quadraticCurveTo(fx + 1, -s1 * 7, fx + 3.5 + Math.sin(t * 3) * 0.6, -s1 * 4.5);
        ctx.strokeStyle = line; ctx.lineWidth = 5.4 + 2 * lw; ctx.stroke(); ctx.strokeStyle = rgb(K.tongue); ctx.lineWidth = 5.4; ctx.stroke(); ctx.strokeStyle = line;
      }
    }
  }

  // ---- eyes: big, set wide on top of the head, under heavy lids that do the acting
  const blink = opts.blink !== undefined ? opts.blink : blinkAt(t, (opts.id | 0) + 1);
  const look = opts.look || { x: 0.6, y: 0 };
  for (const sd of [-1, 1]) {
    const r = 7.1 + 0.7 * sq + 0.8 * shock, ex = 3, ey = sd * (11.6 + 1.6 * sq);
    const hi = sd === fu ? 1 : 0; // the smirk side keeps one brow cocked
    let lid = 0.36 - 0.06 * P.walk + 0.08 * P.angry - 0.2 * sq + (hi ? -0.1 : 0.05) * (1 - P.angry) * (1 - sq);
    lid = lerp(lid, 0.02, shock); lid = lerp(lid, sd === fu ? 0.62 : 0.4, P.dazed); lid = Math.max(lid, blink);
    const th = lerp(lerp(0.22, 0.62, P.angry), -0.3, shock) * (1 - P.dazed);
    lidEye(ctx, ex, ey, r, sd, { K, lx, ly, lw, lid, th, t, look, spin: P.dazed > 0.5, pr: r * lerp(0.6, 0.3, shock) * (1 - 0.12 * P.angry) * (1 + 0.1 * sq), heavy: P.angry });
  }
}
// One heavy-lidded eye, in head space (+x = snout; sd = which side of the head). o: K palette, lx/ly light, lw, lid 0..1 (how far the
// lid comes down from the back of the eye), th lid slant, pr pupil radius, look {x, y}, spin (dazed spiral), heavy 0..1 (brow weight),
// slit (optional: the pupil is a slit at this angle). Shared with the salamander's cousins (cousins.js).
export function lidEye(ctx, ex, ey, r, sd, o) {
  const { K, lx, ly, lw, lid, th, t, look, pr } = o;
  ctx.beginPath(); ctx.arc(ex, ey, r + 0.95, 0, TAU); ctx.fillStyle = rgb(mixA(K.blot, K.line, 0.4)); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(ex, ey, r, 0, TAU); ctx.fillStyle = rgb(K.eye); ctx.fill(); ctx.clip();
  ctx.beginPath(); ctx.arc(ex + lx * 2.2, ey + ly * 2.2, r, 0, TAU); ctx.rect(ex - 20, ey - 20, 40, 40); ctx.fillStyle = rgb(K.eyeLo); ctx.fill('evenodd'); // the ball's shaded side
  if (o.spin) {
    ctx.strokeStyle = rgb(K.pupil); ctx.lineWidth = 1.25; ctx.beginPath();
    for (let i = 0; i <= 26; i++) { const a = i * 0.48 + t * 5 * sd, rr = r * 0.09 + (i / 26) * r * 0.66; ctx.lineTo(ex + 0.6 + Math.cos(a) * rr, ey + Math.sin(a) * rr); }
    ctx.stroke();
  } else {
    const px = ex + 0.8 + clamp(look.x, -1, 1) * (r - pr) * 0.75, py = ey - sd * 0.9 + clamp(look.y, -1, 1) * (r - pr) * 0.8; // a touch cross-eyed: funnier
    ctx.beginPath();
    if (o.slit !== undefined) ctx.ellipse(px, py, pr * 0.42, pr * 1.25, o.slit, 0, TAU); else ctx.arc(px, py, pr, 0, TAU);
    ctx.fillStyle = rgb(K.pupil); ctx.fill();
    ctx.beginPath(); ctx.arc(px + lx * pr * 0.42, py + ly * pr * 0.42, pr * 0.3, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
  }
  // the lid: covers the back of the eye up to a slanted edge (the brow line)
  const dx = Math.cos(th), dy = sd * Math.sin(th), h = -r + 2 * r * lid, cxl = ex + dx * h, cyl = ey + dy * h;
  if (lid > 0.01) {
    ctx.beginPath(); ctx.moveTo(cxl - dy * 30, cyl + dx * 30); ctx.lineTo(cxl + dy * 30, cyl - dx * 30); ctx.lineTo(cxl + dy * 30 - dx * 40, cyl - dx * 30 - dy * 40); ctx.lineTo(cxl - dy * 30 - dx * 40, cyl + dx * 30 - dy * 40); ctx.closePath();
    ctx.fillStyle = rgb(K.lid); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cxl - dy * 30 - dx * 1.6, cyl + dx * 30 - dy * 1.6); ctx.lineTo(cxl + dy * 30 - dx * 1.6, cyl - dx * 30 - dy * 1.6); ctx.strokeStyle = rgb(K.hi); ctx.lineWidth = 1.1; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cxl - dy * 30, cyl + dx * 30); ctx.lineTo(cxl + dy * 30, cyl - dx * 30); ctx.strokeStyle = rgb(mixA(K.blot, K.line, 0.3)); ctx.lineWidth = 1.7 + 0.8 * (o.heavy || 0); ctx.stroke();
    if (lid > 0.8) { ctx.beginPath(); ctx.moveTo(ex - 1, ey - r); ctx.quadraticCurveTo(ex + r * 1.1, ey, ex - 1, ey + r); ctx.lineWidth = 1.6; ctx.stroke(); } // shut: the lash line
  }
  ctx.restore();
  ctx.beginPath(); ctx.arc(ex, ey, r, 0, TAU); ctx.strokeStyle = rgb(mixA(K.blot, K.line, 0.4)); ctx.lineWidth = lw * 0.9; ctx.stroke();
}

// ---------- red-hot sections and the breath's target mark
export function drawSalHeat(ctx, sim, k, t) {
  if (!sim.sals || !sim.sals.length) return;
  // the target: a dashed ember arc on the wall that grows hotter through the telegraph
  for (const C of sim.sals) {
    const warn = C.ph === 'warn' ? clamp(1 - C.t / C.dur, 0, 1) : C.ph === 'fire' ? 1 : -1;
    if (warn < 0) continue;
    const T = sim.salTarget(C), ring = sim.rings[T.ri], half = (SAL.hotLen * C.size) / (2 * ring.r), pulse = 0.5 + 0.5 * Math.sin(t * (10 + 14 * warn));
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(255,110,30,${0.25 + 0.35 * warn * pulse})`;
    ctx.lineWidth = RING_TH * (1.6 + 0.8 * warn);
    ctx.beginPath(); ctx.arc(0, 0, ring.r, T.a - half, T.a + half); ctx.stroke();
    ctx.setLineDash([0.12, 0.09]);
    ctx.lineDashOffset = -t * 0.6;
    ctx.strokeStyle = `rgba(255,${200 - 80 * warn},80,${0.65 + 0.35 * warn})`;
    ctx.lineWidth = 0.045;
    for (const dr of [-1, 1]) { ctx.beginPath(); ctx.arc(0, 0, ring.r + dr * (RING_TH / 2 + 0.05), T.a - half, T.a + half); ctx.stroke(); }
    ctx.restore();
  }
  // hot sections: a glowing arc over the ring (runs of hot segments), brightest just after the breath
  for (const ring of sim.rings) {
    const ra = ring.body.getAngle();
    let run = null;
    const runs = [];
    for (const sg of ring.segs) {
      if (sg.hot > 0 && sg.alive) {
        if (run && Math.abs(run.a1 - sg.a0) < 1e-4 && run.k === sg.hotK) { run.a1 = sg.a1; run.h = Math.max(run.h, sg.hot); }
        else runs.push((run = { a0: sg.a0, a1: sg.a1, h: sg.hot, k: sg.hotK }));
      } else run = null;
    }
    for (const R of runs) {
      const f = Math.min(1, R.h / 0.9), fresh = clamp((R.h - (SAL.hotT - 0.4)) / 0.4, 0, 1), a0 = ra + R.a0, a1 = ra + R.a1;
      ctx.save();
      ctx.lineCap = 'butt';
      ctx.strokeStyle = `rgba(255,60,10,${0.35 * f})`;
      ctx.lineWidth = RING_TH * 2.4;
      ctx.beginPath(); ctx.arc(0, 0, ring.r, a0, a1); ctx.stroke();
      ctx.strokeStyle = `rgba(255,${110 + 50 * Math.sin(t * 9 + R.k)},30,${0.95 * f})`;
      ctx.lineWidth = RING_TH * 1.05;
      ctx.beginPath(); ctx.arc(0, 0, ring.r, a0, a1); ctx.stroke();
      ctx.strokeStyle = `rgba(255,240,170,${(0.55 + 0.45 * fresh) * f})`;
      ctx.lineWidth = RING_TH * 0.32;
      const m = (a1 - a0) * 0.12;
      ctx.beginPath(); ctx.arc(0, 0, ring.r, a0 + m, a1 - m); ctx.stroke();
      // rising embers
      const n = Math.max(2, Math.round(((a1 - a0) * ring.r) / 0.25));
      ctx.fillStyle = `rgba(255,190,80,${0.8 * f})`;
      for (let i = 0; i < n; i++) {
        const u = (t * 0.9 + i * 0.37 + R.k * 0.13) % 1, a = a0 + ((i + 0.5) / n) * (a1 - a0), rr = ring.r + (i % 2 ? 1 : -1) * (RING_TH / 2 + 0.05 + 0.3 * u);
        ctx.beginPath(); ctx.arc(rr * Math.cos(a), rr * Math.sin(a), 0.035 * (1 - u) + 0.01, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  }
}

// ---------- the creatures
export const salAnim = new Map(); // id -> per-creature render state (pose blender, eased looks, last feet); reset with a new sim
const ANIM = salAnim;
function pathOf(C, k) {
  // the trail in px (y down), lightly smoothed so corners at a gap read as a bend
  let P = C.pts.map((q) => ({ x: q.x * k, y: -q.y * k }));
  for (let pass = 0; pass < 2; pass++) {
    const Q = P.slice();
    for (let i = 2; i < P.length - 1; i++) Q[i] = { x: (P[i - 1].x + 2 * P[i].x + P[i + 1].x) / 4, y: (P[i - 1].y + 2 * P[i].y + P[i + 1].y) / 4 };
    P = Q;
  }
  const n = P.length, A = new Float64Array(n);
  for (let i = 1; i < n; i++) A[i] = A[i - 1] + Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y);
  const at = (d) => {
    if (d <= 0) { const dx = P[0].x - P[1].x, dy = P[0].y - P[1].y, l = Math.hypot(dx, dy) || 1; return { x: P[0].x - (dx / l) * d, y: P[0].y - (dy / l) * d }; }
    if (d >= A[n - 1]) { const dx = P[n - 1].x - P[n - 2].x, dy = P[n - 1].y - P[n - 2].y, l = Math.hypot(dx, dy) || 1, e = d - A[n - 1]; return { x: P[n - 1].x + (dx / l) * e, y: P[n - 1].y + (dy / l) * e }; }
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (A[m] <= d) lo = m; else hi = m; }
    const f = (d - A[lo]) / (A[hi] - A[lo] || 1);
    return { x: P[lo].x + (P[hi].x - P[lo].x) * f, y: P[lo].y + (P[hi].y - P[lo].y) * f };
  };
  return { P, at };
}

// pose for the sim phase: { pose, p, ... }
function poseOf(C) {
  const sa = strikeActOf(C);
  if (sa === 'dazed' || sa === 'ouch') return { pose: 'dazed' };
  if (sa === 'angry' || sa === 'strain') return { pose: 'hiss', p: 0.6 };
  const u = C.dur > 0 ? clamp(1 - C.t / C.dur, 0, 1) : 1;
  switch (C.ph) {
    case 'walk': case 'brake': case 'retreat': return { pose: 'walk' };
    case 'warn': return { pose: 'breath', p: 0.42 * u, aimAt: 'target' };
    case 'fire': return { pose: 'breath', p: 0.42 + 0.44 * u, aimAt: 'target' };
    case 'settle': return { pose: 'breath', p: 0.86 + 0.14 * u, aimAt: 'target' };
    case 'hiss': return { pose: 'hiss', p: 0.15 + 0.6 * u };
    case 'rest': return { pose: C.cool > 0 ? 'cool' : 'idle' };
    case 'daze': return { pose: 'dazed' };
    case 'dive': return { pose: 'flee' };
    case 'grin': return { pose: 'idle', grin: 1 };
    case 'in': return { pose: 'idle' };
    case 'rival': {
      const el = C.dur - C.t;
      if (el < 1.3) return { pose: 'hiss', p: 0.12 + 0.6 * (el / 1.3), aimAt: 'snake' };
      if (el < 2.3) return { pose: 'breath', p: 0.3 + 0.55 * ((el - 1.3) / 1.0), aimAt: 'snake', puff: 1 };
      return { pose: 'hiss', p: 0.55 + 0.45 * ((el - 2.3) / 0.7), aimAt: 'snake' };
    }
  }
  return { pose: 'idle' };
}

export function drawSalamanders(ctx, sim, t, k) {
  const after = [];
  for (const C of sim.sals || []) {
    if (C.sp === 'gecko') { drawGecko15(ctx, sim, k, t, false); continue; } // Baron von Brr (render/gecko15.js)
    if (C.sp === 'thornback') { drawThorn20(ctx, sim, C, k, t); continue; } // L20 (render/crystal20.js)
    if (C.sp === 'chameleon') { drawCham26(ctx, sim, C, k, t); continue; } // L26: Sly the orb thief (render/cham26.js)
    if (C.ph === 'wait' || C.ph === 'gone' || C.pts.length < 3) continue;
    let R = ANIM.get(C.id);
    const fresh = !R || R.sim !== sim || t < R.t - 0.5;
    if (fresh) { R = { sim, A: crawlerAnim(), t, cool: C.cool > 0 ? 1 : 0, lookX: 1, lookY: 0, aim: 0, out: {} }; ANIM.set(C.id, R); }
    const dt = clamp(t - R.t, 0, 0.1);
    R.t = t;
    const W = poseOf(C);
    // daze: frozen (a frost nova, a frost boss) holds the pose it was caught in, mid-stride; anything else is a stun (lightning also zaps first)
    const st = statusClock(sim, 'c' + C.id, C.ph === 'daze' ? (C.dk === 'frost' ? { k: 'ice', left: C.t } : { k: 'stun', zap: C.dk === 'bolt', left: C.t }) : null, t);
    const frozen = st && st.k === 'ice';
    if (fresh) for (let i = 0; i < 12; i++) R.A.update(0.1, { pose: W.pose, p: W.p, speed: 0 }); // no blend-in on the first frame
    else if (!frozen) R.A.update(dt, { pose: W.pose, p: W.p, speed: 0 });
    const B = R.A.st.B;
    const coolT = C.cool > 0.8 ? 1 : C.cool / 0.8;
    R.cool += (coolT - R.cool) * Math.min(1, dt * 4);
    const { P, at } = pathOf(C, k);
    const s = SAL.svl * C.size * k, U = s / 100;
    // aim the head (and the jet) at the target: the breath's spot on the wall, or the rival snake's head
    let aim = 0, fireLen = 44, tgt = null;
    if (W.aimAt === 'target') { const T = sim.salTarget(C); tgt = { x: T.x * k, y: -T.y * k }; }
    else if (W.aimAt === 'snake') { const S = sim.snakes.find((x) => x.id === C.rid) || sim.snakes.find((x) => x.rivalId === C.id && x.rival > 0); if (S && S.pts.length) tgt = { x: S.pts[0].x * k, y: -S.pts[0].y * k }; }
    if (tgt) {
      const hip = at(82 * U), hd = at(13 * U), hb = at(25 * U);
      const fore = 0.22 * B.crouch + 0.26 * Math.sin(Math.PI * clamp(B.rear, 0, 1)) * (1 - B.crouch * 0.5), f = (82 - 13) / 82, c = 1 - f * fore + 0.07 * B.rear * f;
      const hc = { x: hip.x + (hd.x - hip.x) * c, y: hip.y + (hd.y - hip.y) * c };
      const base = Math.atan2(hd.y - hb.y, hd.x - hb.x), want = Math.atan2(tgt.y - hc.y, tgt.x - hc.x);
      aim = clamp(wrapA(want - base), -1.15, 1.15);
      const ha = base + aim, hs = (1.28 + 0.3 * B.rear) * U, m = (16 + 6 * B.mouth) * hs;
      fireLen = clamp(Math.hypot(tgt.x - (hc.x + Math.cos(ha) * m), tgt.y - (hc.y + Math.sin(ha) * m)) / U, 12, 90);
      if (W.puff) fireLen = Math.min(fireLen * 0.55, 26);
    }
    R.aim += (aim - R.aim) * Math.min(1, dt * 10);
    // eyes: toward the target, else ahead
    const lx = tgt ? 1 : 0.85, ly = tgt ? clamp(R.aim, -1, 1) : 0.15 * Math.sin(t * 0.7 + C.id);
    R.lookX += (lx - R.lookX) * Math.min(1, dt * 6); R.lookY += (ly - R.lookY) * Math.min(1, dt * 6);
    const glow = clamp(0.72 + 0.28 * (C.charge || 0) + (C.ph === 'walk' && C.next < 1.2 ? 0.15 * (1 - C.next / 1.2) : 0), 0, 1);
    const alpha = C.ph === 'in' ? sstep(1 - C.t / C.dur) : 1;
    const o = {
      ...R.A.opts(), gait: C.odo * k, trail: at, id: 50 + C.id, glow, cool: R.cool, aim: R.aim, fireLen, look: { x: R.lookX, y: R.lookY }, out: R.out,
    };
    if (W.grin) { o.mouth = 0.32; }
    if (C.ph === 'dive') o.dive = (C.odo - C.hole) * k;
    // boss: the lava rocks come out of its mouth (mouth open, glowing) while it throws
    const BX = sim.bx && sim.bx.boss;
    if (C.boss && BX && BX.atk && (BX.atk.name === 'rock' || BX.atk.name === 'rock2') && C.ph === 'walk') o.mouth = BX.atk.ph === 'warn' ? 0.4 + 0.5 * clamp(1 - BX.atk.t / BX.atk.dur, 0, 1) : 0.9;
    if (C.ph === 'in') { // it climbs out of a lava pool
      const h = P[0];
      pxSpace(ctx, 0, 0, k, () => {
        const g = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, 0.9 * s);
        g.addColorStop(0, `rgba(255,200,80,${0.9 * (1 - alpha * 0.6)})`); g.addColorStop(0.5, `rgba(255,90,20,${0.6 * (1 - alpha * 0.5)})`); g.addColorStop(1, 'rgba(120,20,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(h.x, h.y, 0.9 * s, 0, TAU); ctx.fill();
      });
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    pxSpace(ctx, 0, 0, k, () => drawSalamander(ctx, P[0].x, P[0].y, s, frozen ? st.hold : t, { ...o, status: st }));
    ctx.restore();
    // a face-off: the snake's venom in flight at it
    if (C.ph === 'rival') {
      const el = C.dur - C.t, S = sim.snakes.find((x) => x.id === C.rid);
      if (S && S.pts.length && el > 1.0 && el < 1.4) after.push(() => {
        const u = (el - 1.0) / 0.4, a = S.pts[0], b = C.pts[0];
        for (let j = 3; j >= 0; j--) {
          const v = Math.max(0, u - j * 0.08), x = a.x + (b.x - a.x) * v, y = a.y + (b.y - a.y) * v + Math.sin(Math.PI * v) * 0.3;
          pxSpace(ctx, x, y, k, () => drawVenom(ctx, 0, 0, 0.1 * k * (1 - j * 0.15), t, j ? 0.6 - j * 0.12 : 1));
        }
      });
    }
  }
  for (const f of after) f();
}
