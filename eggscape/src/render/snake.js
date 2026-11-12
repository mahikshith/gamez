// Snake: crisp cel-shaded code art in the house style of the salamander and the crawlers (dark outline, base + one
// shadow + one highlight, eased motion). No image assets. Two parts:
//   drawSnakes(ctx, sim, t, k)  every snake of a level, in world space (meters, y up): path, face, states, entry
//   drawSnake(ctx, pts, r, t, opts)  one snake along pts (head first) in a y-DOWN px space (palette strips use it too)
// The body is one smooth tapered tube (no beads): an outline offset from a smoothed centre line, the inner side of a
// tight bend pulled in so the outline never folds, and a body that crosses itself drawn in short pieces, tail first,
// so the part on top keeps its outline. The head is a side profile (mirrored to face left) with a heavy brow, big
// slit-pupil eye, far eye peeking over the snout, pale jaw, a hinged lower jaw and a forked tongue.
// States drawn into the snake itself (shared creature-state spec): frozen (icy tint, an ice shell along its own
// outline, everything held still, cracks and a shiver in the last second, shards and a shake-off on thaw), stunned
// (slack and drooping, spiral eyes, tongue lolling, three stars on a tilted ring round the head), zapped (0.3 s of
// jagged arcs and a flash first).
//
// Reuse for other long-bodied creatures (an eel, a vine snake): the rig is not snake-specific.
//   SERPENT_PALETTES (= SNAKE_SKIN)  the one palette table; add an entry, or pass a palette object as opts.skin
//   serpentPath(sim, C, A, t)        channel-space body path (world metres) from a trail creature C: {pts (trail of
//                                    {a, r, x, y, g, la} as sim trailPt writes), odo, len, size, rad, a, girth?}, with
//                                    A = {drift, slack, shake, enter} (render state; see drawSnakes for how it eases)
//   snakeHeadAnim(A, face, dt, t)    eased face channels (FACE names: idle hunt snarl hiss strike chew0 chew1 grin
//                                    ouch shock dizzy frozen), blinks and tongue flicks, into A.f
//   drawSerpent(ctx, pxPts, r, t, o) (= drawSnake) the body and head. o: skin (key or palette), thick, head (size),
//                                    anim (A), part, frill, crown, decorate(ctx, {P, F, t, lw, frozen}) for its own
//                                    extras in head space (fins, whiskers), noHead, and the states: frozen, crack,
//                                    ice, flash, droop, stars, shake, venom, breath
import { RING_TH, TAU } from '../sim/geom.js';
import { drawVenom } from './v3art.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, k) => a + (b - a) * k;
const mod = (a, b) => ((a % b) + b) % b;
const sstep = (v) => { v = clamp01(v); return v * v * (3 - 2 * v); };
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const lerpA = (a, b, f) => a + wrapA(b - a) * f;
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/* ---------------------------------------------------------------- skins */
// Cosmetic (sim SNAKE_KIND gives the traits). line = outline, body / shade / light = cel base, shadow and highlight,
// belly / plate = belly band and its scutes, mark / mark2 = back pattern, brow = the heavy brow ridge.
export const SNAKE_SKIN = {
  violet: { line: '#3e1723', body: '#9446bd', shade: '#6c2b8f', light: '#c590e0', belly: '#fbc288', plate: '#d98a5e', mark: '#e64fb2', mark2: '#ff9ad6', brow: '#ff6fae', pat: 'diamond' },
  emerald: { line: '#1f2a12', body: '#3fae6d', shade: '#2a8050', light: '#86dba6', belly: '#f7dc9c', plate: '#c9a560', mark: '#d4ec6a', mark2: '#f2fbb0', brow: '#f2e45a', pat: 'zigzag' },
  amber: { line: '#45200f', body: '#e0a14a', shade: '#b8741f', light: '#f7d48f', belly: '#fde4b4', plate: '#d59a58', mark: '#8a4318', mark2: '#a95a26', brow: '#9a4418', pat: 'band' },
  crimson: { line: '#3d1412', body: '#c9454b', shade: '#9a2a33', light: '#ec8a8a', belly: '#fcc79c', plate: '#d88a62', mark: '#ffcf63', mark2: '#fff0a8', brow: '#ffb347', pat: 'chevron' },
  // not snakes yet: palettes for future long-bodied creatures on the same rig (eye: [iris, iris shade] overrides green)
  eel: { line: '#10233a', body: '#2f7fa8', shade: '#1f5676', light: '#7cc4e4', belly: '#e9f2c8', plate: '#b9c99a', mark: '#f2c14a', mark2: '#ffe9a0', brow: '#5fb3d9', pat: 'zigzag', eye: ['#ffd23a', '#d08a10'] },
  vine: { line: '#1d2a0e', body: '#6fae2e', shade: '#4a7f1c', light: '#b3e06a', belly: '#e6f0a8', plate: '#b9c770', mark: '#3d6a16', mark2: '#9cd04a', brow: '#d7ef7a', pat: 'band', eye: ['#ffb02e', '#c46a0a'] },
};
export const SERPENT_PALETTES = SNAKE_SKIN; // one shared table for every long-bodied creature
const ICE = [191, 230, 255], RIM = '#2f6f9e';
const EYE = { white: [251, 246, 230], iris: [166, 226, 46], irisLo: [72, 150, 24], hunt: [255, 178, 31], huntLo: [196, 92, 10], pupil: [22, 10, 30] };
const palCache = new Map();
// a skin (SNAKE_SKIN key or a palette object of the same shape) as css + rgb, tinted toward ice by k; cached in tenths
function palette(skin, k) {
  const P = typeof skin === 'object' && skin ? skin : SNAKE_SKIN[skin] || SNAKE_SKIN.violet, q = Math.round(clamp01(k) * 10);
  let byQ = palCache.get(P);
  if (!byQ) palCache.set(P, (byQ = []));
  if (byQ[q]) return byQ[q];
  const f = 0.55 * (q / 10), o = { pat: P.pat };
  const tint = (c) => [c[0] + (ICE[0] - c[0]) * f, c[1] + (ICE[1] - c[1]) * f, c[2] + (ICE[2] - c[2]) * f];
  for (const n in P) if (n !== 'pat') { o[n + 'C'] = tint(hexRgb(P[n])); o[n] = css(o[n + 'C']); }
  const eye = { ...EYE, ...(P.eye ? { iris: hexRgb(P.eye[0]), irisLo: hexRgb(P.eye[1]) } : {}) };
  for (const n in eye) { o['e_' + n] = tint(eye[n]); }
  return (byQ[q] = o);
}

/* ---------------------------------------------------------------- body geometry (reused buffers) */
const SN_MAX = 900;
const snX = new Float32Array(SN_MAX), snY = new Float32Array(SN_MAX);
const snNX = new Float32Array(SN_MAX), snNY = new Float32Array(SN_MAX);
const snTX = new Float32Array(SN_MAX), snTY = new Float32Array(SN_MAX);
const snW = new Float32Array(SN_MAX), snA = new Float32Array(SN_MAX);
const snWP = new Float32Array(SN_MAX), snWM = new Float32Array(SN_MAX); // half width on the +normal / -normal side
const snSG = new Float32Array(SN_MAX), snBW = new Float32Array(SN_MAX);
const tmpX = new Float32Array(SN_MAX), tmpY = new Float32Array(SN_MAX);
let N = 0;

// Resample pts at even spacing, then smooth so polyline corners turn into curves.
function sample(pts, step, passes) {
  let n = 1, carry = 0;
  snX[0] = pts[0].x; snY[0] = pts[0].y;
  for (let i = 1; i < pts.length && n < SN_MAX; i++) {
    const ax = pts[i - 1].x, ay = pts[i - 1].y, dx = pts[i].x - ax, dy = pts[i].y - ay, len = Math.hypot(dx, dy);
    if (!(len > 1e-9)) continue;
    let d = step - carry;
    while (d <= len && n < SN_MAX) { snX[n] = ax + (dx * d) / len; snY[n] = ay + (dy * d) / len; n++; d += step; }
    carry = len - (d - step);
  }
  const last = pts[pts.length - 1];
  if (n < SN_MAX && Math.hypot(last.x - snX[n - 1], last.y - snY[n - 1]) > step * 0.3) { snX[n] = last.x; snY[n] = last.y; n++; }
  for (let p = 0; p < passes; p++) {
    for (let i = 1; i < n - 1; i++) { tmpX[i] = (snX[i - 1] + 2 * snX[i] + snX[i + 1]) / 4; tmpY[i] = (snY[i - 1] + 2 * snY[i] + snY[i + 1]) / 4; }
    for (let i = 1; i < n - 1; i++) { snX[i] = tmpX[i]; snY[i] = tmpY[i]; }
  }
  return n;
}
function tangents(n) {
  snA[0] = 0;
  for (let i = 1; i < n; i++) snA[i] = snA[i - 1] + Math.hypot(snX[i] - snX[i - 1], snY[i] - snY[i - 1]);
  for (let i = 0; i < n; i++) {
    const a = Math.min(n - 1, i + 1), b = Math.max(0, i - 1), tx = snX[b] - snX[a], ty = snY[b] - snY[a], l = Math.hypot(tx, ty) || 1;
    snTX[i] = tx / l; snTY[i] = ty / l; snNX[i] = -snTY[i]; snNY[i] = snTX[i];
  }
}
// Widths: a neck just behind the head, full girth, a long taper. Then each side is held inside the local radius of
// curvature (the inside of a tight bend squeezes instead of folding over itself), smoothed so it never kinks.
function widths(n, Wh, breath) {
  const len = Math.max(snA[n - 1], 1e-6), wmin = Math.max(0.6, Wh * 0.06);
  for (let i = 0; i < n; i++) {
    const s = snA[i], f = s / len;
    const neck = s < Wh * 2.2 ? 0.8 + 0.2 * (s / (Wh * 2.2)) : 1;
    const prof = f < 0.35 ? neck : Math.pow((1 - f) / 0.65, 0.8);
    snW[i] = (Wh * Math.min(neck, prof) + wmin) * (f < 0.8 ? breath : 1);
    snSG[i] = snNY[i] >= 0 ? 1 : -1;
    const q = clamp01(Math.abs(snNY[i]) / 0.55);
    snBW[i] = q * q * (3 - 2 * q);
  }
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 2), b = Math.min(n - 1, i + 2), ds = snA[b] - snA[a];
    let kap = 0; // signed curvature, + bends toward +normal
    if (ds > 1e-6) kap = (snTX[b] * snTY[a] - snTY[b] * snTX[a]) / ds;
    const lim = kap !== 0 ? 0.92 / Math.abs(kap) : 1e9;
    tmpX[i] = kap > 0 ? Math.min(snW[i], lim) : snW[i]; // +normal side
    tmpY[i] = kap < 0 ? Math.min(snW[i], lim) : snW[i];
    snWP[i] = tmpX[i]; snWM[i] = tmpY[i];
  }
  for (let p = 0; p < 4; p++) {
    for (let i = 1; i < n - 1; i++) {
      snWP[i] = Math.min(tmpX[i], 0.25 * snWP[i - 1] + 0.5 * snWP[i] + 0.25 * snWP[i + 1]);
      snWM[i] = Math.min(tmpY[i], 0.25 * snWM[i - 1] + 0.5 * snWM[i] + 0.25 * snWM[i + 1]);
    }
  }
}
const ex = (i, k, o) => snX[i] + snNX[i] * (o > 0 ? snWP[i] : snWM[i]) * k * o; // edge point at k * width, side o
const ey = (i, k, o) => snY[i] + snNY[i] * (o > 0 ? snWP[i] : snWM[i]) * k * o;

// closed outline of samples [a, b] grown by `grow` px; the tail tip (b = last) gets a rounded point
function outlinePath(ctx, a, b, grow = 0, n = N) {
  const g = (i, o) => (o > 0 ? snWP[i] : snWM[i]) + grow;
  if (a === 0) { // a round neck end (only seen while the head turns round)
    ctx.moveTo(snX[0] - snNX[0] * g(0, -1), snY[0] - snNY[0] * g(0, -1));
    const r = g(0, 1) * 1.3;
    ctx.quadraticCurveTo(snX[0] + snTX[0] * r, snY[0] + snTY[0] * r, snX[0] + snNX[0] * g(0, 1), snY[0] + snNY[0] * g(0, 1));
  } else ctx.moveTo(snX[a] + snNX[a] * g(a, 1), snY[a] + snNY[a] * g(a, 1));
  for (let i = a + 1; i <= b; i++) ctx.lineTo(snX[i] + snNX[i] * g(i, 1), snY[i] + snNY[i] * g(i, 1));
  if (b === n - 1) { const r = g(b, 1) * 1.4 + grow * 0.3; ctx.quadraticCurveTo(snX[b] - snTX[b] * r, snY[b] - snTY[b] * r, snX[b] - snNX[b] * g(b, -1), snY[b] - snNY[b] * g(b, -1)); }
  for (let i = b; i >= a; i--) ctx.lineTo(snX[i] - snNX[i] * g(i, -1), snY[i] - snNY[i] * g(i, -1));
  ctx.closePath();
}
// the two flanks of [a, b] as open lines (no seams across the body at piece ends), joined round the tail tip
function flankPath(ctx, a, b, n = N) {
  if (b === n - 1) {
    if (a === 0) { const r = snWM[0] * 1.3; ctx.moveTo(ex(0, 1, -1), ey(0, 1, -1)); ctx.quadraticCurveTo(snX[0] + snTX[0] * r, snY[0] + snTY[0] * r, ex(0, 1, 1), ey(0, 1, 1)); } else
    ctx.moveTo(ex(a, 1, 1), ey(a, 1, 1));
    for (let i = a + 1; i <= b; i++) ctx.lineTo(ex(i, 1, 1), ey(i, 1, 1));
    const r = snWP[b] * 1.4;
    ctx.quadraticCurveTo(snX[b] - snTX[b] * r, snY[b] - snTY[b] * r, ex(b, 1, -1), ey(b, 1, -1));
    for (let i = b - 1; i >= a; i--) ctx.lineTo(ex(i, 1, -1), ey(i, 1, -1));
    return;
  }
  if (a === 0) {
    ctx.moveTo(ex(b, 1, -1), ey(b, 1, -1));
    for (let i = b - 1; i >= 0; i--) ctx.lineTo(ex(i, 1, -1), ey(i, 1, -1));
    const r = snWP[0] * 1.3;
    ctx.quadraticCurveTo(snX[0] + snTX[0] * r, snY[0] + snTY[0] * r, ex(0, 1, 1), ey(0, 1, 1));
    for (let i = 1; i <= b; i++) ctx.lineTo(ex(i, 1, 1), ey(i, 1, 1));
    return;
  }
  for (const o of [1, -1]) {
    ctx.moveTo(ex(a, 1, o), ey(a, 1, o));
    for (let i = a + 1; i <= b; i++) ctx.lineTo(ex(i, 1, o), ey(i, 1, o));
  }
}

// One piece of the body, samples [a, b]: fill, pattern, belly with scutes, cel shadow and highlight, then the flanks.
function bodyPiece(ctx, P, a, b, Wh, lw, flash) {
  const n = N, m0 = Math.max(0, a - 8), m1 = Math.min(n - 1, b + 8);
  ctx.save();
  ctx.beginPath();
  outlinePath(ctx, a, b);
  ctx.fillStyle = P.body;
  ctx.fill();
  ctx.clip();
  pattern(ctx, P, m0, m1, Wh);
  // belly band along the screen-lower flank, scutes across it following the curve
  ctx.beginPath();
  for (let i = m0; i <= m1; i++) { const k = 1.05 - 0.6 * snBW[i], x = ex(i, k, snSG[i]), y = ey(i, k, snSG[i]); if (i > m0) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
  for (let i = m1; i >= m0; i--) ctx.lineTo(ex(i, 1.2, snSG[i]), ey(i, 1.2, snSG[i]));
  ctx.closePath();
  ctx.fillStyle = P.belly;
  ctx.fill();
  ctx.beginPath();
  const plate = Math.max(Wh * 0.55, 2.4);
  for (let i = m0, next = Math.ceil(snA[m0] / plate) * plate; i <= m1; i++) {
    if (snA[i] < next) continue;
    next += plate;
    if (snBW[i] < 0.2) continue;
    const o = snSG[i], k0 = 1.05 - 0.58 * snBW[i];
    ctx.moveTo(ex(i, k0, o), ey(i, k0, o));
    ctx.quadraticCurveTo(ex(i, (k0 + 1) / 2, o) + snTX[i] * Wh * 0.12, ey(i, (k0 + 1) / 2, o) + snTY[i] * Wh * 0.12, ex(i, 1.1, o), ey(i, 1.1, o));
  }
  ctx.strokeStyle = P.plate;
  ctx.lineWidth = Math.max(0.8, Wh * 0.1);
  ctx.stroke();
  // cel light from the upper left: one hard shadow band lower right, one highlight stripe upper left
  const band = (ox, oy, wk, col, al) => {
    ctx.beginPath();
    for (let i = m0; i <= m1; i++) { const x = snX[i] + ox * snW[i] + snNX[i] * snW[i] * wk, y = snY[i] + oy * snW[i] + snNY[i] * snW[i] * wk; if (i > m0) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    for (let i = m1; i >= m0; i--) ctx.lineTo(snX[i] + ox * snW[i] - snNX[i] * snW[i] * wk, snY[i] + oy * snW[i] - snNY[i] * snW[i] * wk);
    ctx.closePath();
    ctx.globalAlpha = al;
    ctx.fillStyle = col;
    ctx.fill();
  };
  band(0.66, 0.84, 0.74, P.shade, 0.6);
  band(-0.38, -0.5, 0.2, P.light, 0.75);
  ctx.globalAlpha = 1;
  if (flash > 0) { ctx.beginPath(); outlinePath(ctx, a, b); ctx.fillStyle = `rgba(255,252,210,${clamp01(flash)})`; ctx.fill(); }
  ctx.restore();
  ctx.beginPath();
  flankPath(ctx, a, b);
  ctx.strokeStyle = P.line;
  ctx.lineWidth = lw;
  ctx.stroke();
}

// Back patterns, spaced along the arc length: diamonds, a wavy zigzag stripe, crossbands, chevrons. Each mark is
// built from the local frame, so it bends with the body.
function pattern(ctx, P, m0, m1, Wh) {
  const len = snA[N - 1], start = Wh * 2.6, end = len * 0.9;
  const at = (i, k) => [snX[i] - snNX[i] * snW[i] * k * snSG[i] * snBW[i], snY[i] - snNY[i] * snW[i] * k * snSG[i] * snBW[i]];
  if (P.pat === 'zigzag') {
    for (const [col, lwk] of [[P.mark, 0.42], [P.mark2, 0.12]]) {
      ctx.beginPath();
      let first = true;
      for (let i = m0; i <= m1; i++) {
        if (snA[i] < start * 0.7 || snA[i] > end) continue;
        const z = Math.sin((snA[i] / (Wh * 0.9)) * Math.PI) * 0.42, c = at(i, 0.25), x = c[0] + snNX[i] * snW[i] * z, y = c[1] + snNY[i] * snW[i] * z;
        if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(lwk > 0.2 ? 1.2 : 0.6, Wh * lwk);
      ctx.stroke();
    }
    return;
  }
  const gap = P.pat === 'band' ? Wh * 1.7 : P.pat === 'chevron' ? Wh * 1.35 : Wh * 1.5;
  for (let i = m0, next = Math.max(start, Math.ceil((snA[m0] - start) / gap) * gap + start); i <= m1; i++) {
    if (snA[i] < next) continue;
    next += gap;
    if (snA[i] > end) break;
    const w = snW[i], tx = snTX[i], ty = snTY[i], nx = snNX[i], ny = snNY[i];
    ctx.beginPath();
    if (P.pat === 'band') {
      const L = w * 0.32;
      ctx.moveTo(snX[i] + tx * L + nx * w * 1.2, snY[i] + ty * L + ny * w * 1.2);
      ctx.lineTo(snX[i] + tx * L * 1.6 - nx * w * 1.2, snY[i] + ty * L * 1.6 - ny * w * 1.2);
      ctx.lineTo(snX[i] - tx * L * 0.4 - nx * w * 1.2, snY[i] - ty * L * 0.4 - ny * w * 1.2);
      ctx.lineTo(snX[i] - tx * L + nx * w * 1.2, snY[i] - ty * L + ny * w * 1.2);
      ctx.closePath();
      ctx.fillStyle = P.mark;
      ctx.fill();
      continue;
    }
    const [cx, cy] = at(i, 0.3);
    if (P.pat === 'chevron') {
      const L = w * 0.55, Wd = w * 0.62, th = w * 0.36;
      ctx.moveTo(cx + tx * L, cy + ty * L);
      ctx.lineTo(cx - tx * 0.1 * L + nx * Wd, cy - ty * 0.1 * L + ny * Wd);
      ctx.lineTo(cx - tx * (0.1 * L + th) + nx * Wd, cy - ty * (0.1 * L + th) + ny * Wd);
      ctx.lineTo(cx + tx * (L - th), cy + ty * (L - th));
      ctx.lineTo(cx - tx * (0.1 * L + th) - nx * Wd, cy - ty * (0.1 * L + th) - ny * Wd);
      ctx.lineTo(cx - tx * 0.1 * L - nx * Wd, cy - ty * 0.1 * L - ny * Wd);
      ctx.closePath();
      ctx.fillStyle = P.mark;
      ctx.fill();
      continue;
    }
    for (const [k, col] of [[1, P.mark], [0.45, P.mark2]]) {
      const L = w * 0.9 * k, Wd = w * 0.5 * k;
      ctx.beginPath();
      ctx.moveTo(cx + tx * L, cy + ty * L);
      ctx.lineTo(cx - nx * Wd, cy - ny * Wd);
      ctx.lineTo(cx - tx * L, cy - ty * L);
      ctx.lineTo(cx + nx * Wd, cy + ny * Wd);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
    }
  }
}

// Where the body lies over itself, split it into pieces short enough never to overlap themselves (tail first).
function pieces(n, Wh) {
  const gapS = Wh * 4.2;
  let hit = false;
  for (let i = 0; i < n && !hit; i += 2) for (let j = i + 2; j < n; j += 2) {
    if (snA[j] - snA[i] < gapS) continue;
    const d = (snW[i] + snW[j]) * 0.95, dx = snX[i] - snX[j], dy = snY[i] - snY[j];
    if (dx * dx + dy * dy < d * d) { hit = true; break; }
  }
  if (!hit) return [[0, n - 1]];
  const out = [], L = Wh * 3.8;
  let a = 0;
  for (let i = 1; i < n; i++) if (snA[i] - snA[a] >= L || i === n - 1) { out.push([a, i]); a = i - 1; }
  return out.reverse();
}

/* ---------------------------------------------------------------- face animation */
// Face targets per expression; snakeHeadAnim eases toward them. lid: upper lid 0 open..1 shut; low: lower lid (a
// happy squint); brow: raise (+) / lower (-); tilt: + angry (front end down), - worried; pup: slit width; mouth: jaw
// open 0..1; teeth: fangs and a tooth row; hunt: amber iris; sq: eye squeezed shut; spi: spiral eyes; smile: mouth
// corner up (+) / down (-); tongue: out (0..1); loll: tongue hangs limp.
const FACE = {
  idle: { lid: 0.14, low: 0, brow: 0, tilt: 0.15, pup: 1, mouth: 0, teeth: 0, hunt: 0, sq: 0, spi: 0, smile: 0.35, loll: 0 },
  hunt: { lid: 0.3, low: 0.12, brow: -0.6, tilt: 1, pup: 0.55, mouth: 0.04, teeth: 0, hunt: 1, sq: 0, spi: 0, smile: 0.1, loll: 0 },
  snarl: { lid: 0.3, low: 0.15, brow: -0.8, tilt: 1.1, pup: 0.5, mouth: 0.2, teeth: 1, hunt: 1, sq: 0, spi: 0, smile: -0.2, loll: 0 },
  hiss: { lid: 0.2, low: 0.1, brow: -0.6, tilt: 1, pup: 0.55, mouth: 0.7, teeth: 1, hunt: 1, sq: 0, spi: 0, smile: 0, loll: 0 },
  strike: { lid: 0, low: 0, brow: -0.2, tilt: 0.8, pup: 0.45, mouth: 1, teeth: 1, hunt: 1, sq: 0, spi: 0, smile: 0, loll: 0 },
  chew0: { lid: 0.45, low: 0.4, brow: 0.2, tilt: -0.1, pup: 1, mouth: 0.32, teeth: 1, hunt: 0, sq: 0, spi: 0, smile: 0.6, loll: 0 },
  chew1: { lid: 0.45, low: 0.4, brow: 0.2, tilt: -0.1, pup: 1, mouth: 0.02, teeth: 0, hunt: 0, sq: 0, spi: 0, smile: 0.8, loll: 0 },
  grin: { lid: 0.42, low: 0.18, brow: 0.35, tilt: 0.5, pup: 0.8, mouth: 0.07, teeth: 1, hunt: 0, sq: 0, spi: 0, smile: 1, loll: 0 },
  ouch: { lid: 0, low: 0, brow: -0.5, tilt: -0.8, pup: 1, mouth: 0.3, teeth: 1, hunt: 0, sq: 1, spi: 0, smile: -0.8, loll: 0 },
  shock: { lid: 0, low: 0, brow: 1, tilt: -0.6, pup: 0.3, mouth: 0.38, teeth: 0, hunt: 0, sq: 0, spi: 0, smile: -0.4, loll: 0 },
  dizzy: { lid: 0.32, low: 0.12, brow: 0.15, tilt: -0.9, pup: 1, mouth: 0.2, teeth: 0, hunt: 0, sq: 0, spi: 1, smile: -0.5, loll: 1 },
  frozen: { lid: 0.48, low: 0, brow: 0.6, tilt: -0.4, pup: 0.4, mouth: 0.12, teeth: 0, hunt: 0, sq: 0, spi: 0, smile: -0.3, loll: 0 },
};
FACE.taste = FACE.idle; FACE.blink = FACE.idle;
const URGENT = new Set(['ouch', 'shock', 'dizzy', 'strike', 'chew0', 'chew1', 'grin']);
const CALM = new Set(['idle', 'hunt']);

// Head animation state per snake (A, kept by the caller): a wanted face holds at least 0.22 s (reactions cut in at
// once) and every face channel eases toward it; blinks every 2-5 s and tongue flicks every 1.5-3 s from calm faces.
export function snakeHeadAnim(A, want, dt, t) {
  if (!A.f) {
    A.f = { ...(FACE[want] || FACE.idle), tongue: 0 };
    A.ex = want; A.hold = 9; A.blinkT = 0; A.tasteT = 0; A.flickT = 0;
    A.blinkAt = t + 0.8 + hash(t + (A.seed || 0)) * 2.5; A.tasteAt = t + 0.5 + hash(t * 1.7 + (A.seed || 0)) * 2;
    A.cur = { ex: want };
  }
  A.hold += dt;
  if (want !== A.ex && (A.hold > 0.22 || URGENT.has(want))) { A.ex = want; A.hold = 0; }
  const ex0 = A.ex;
  if (CALM.has(ex0)) {
    if (t >= A.blinkAt && !(A.tasteT > 0)) { A.blinkT = 0.17; A.blinkAt = t + 2 + hash(t * 3.1 + (A.seed || 0)) * 3; }
    if (ex0 === 'idle' && t >= A.tasteAt && !(A.blinkT > 0)) { A.tasteT = 0.5; A.tasteAt = t + 1.5 + hash(t * 5.3 + (A.seed || 0)) * 1.5; }
  } else A.blinkT = 0;
  if (A.tasteT > 0 && ex0 !== 'idle') A.tasteT = 0;
  A.blinkT = Math.max(0, A.blinkT - dt);
  A.tasteT = Math.max(0, A.tasteT - dt);
  const T = FACE[ex0] || FACE.idle, r = 1 - Math.exp(-dt * (URGENT.has(ex0) ? 26 : 14));
  for (const k in T) A.f[k] += (T[k] - A.f[k]) * (k === 'mouth' ? Math.min(1, r * 1.4) : r);
  // the tongue: a quick flick out (taste), out while hissing, lolling while dizzy
  const tw = A.tasteT > 0 ? Math.sin((1 - A.tasteT / 0.5) * Math.PI) : ex0 === 'hiss' ? 0.75 : ex0 === 'dizzy' ? 0.55 : 0;
  A.f.tongue += (tw - A.f.tongue) * Math.min(1, dt * 22);
  A.cur.ex = ex0; // (read by old callers)
}

/* ---------------------------------------------------------------- the head */
// Head space: units of Wh / 10 (Wh = body half width at the neck), x along the snout, y down, origin at the neck point.
const HINGE = [5, 4.6];
function upperPath(ctx, open) { // cranium, upper jaw and throat; `open` leaves the neck edge out (for the stroke)
  ctx.moveTo(-16, -9);
  ctx.bezierCurveTo(-17, -16.5, -9, -21, 0, -21);
  ctx.bezierCurveTo(7, -21, 12.5, -18.8, 16.5, -15.4);
  ctx.bezierCurveTo(21, -12, 27, -9.8, 30.6, -7.2);
  ctx.bezierCurveTo(34.2, -4.6, 34.6, 0.2, 32.4, 2.4);
  ctx.quadraticCurveTo(20, 5, HINGE[0], HINGE[1]);
  ctx.quadraticCurveTo(2, 9.5, -4, 11.2);
  ctx.bezierCurveTo(-9, 12.4, -14, 11.6, -16, 9);
  if (!open) ctx.closePath();
}
function jawPath(ctx) { // lower jaw, in the jaw's own frame (rotated about HINGE)
  ctx.moveTo(HINGE[0], HINGE[1]);
  ctx.quadraticCurveTo(20, 5.4, 31, 3.6);
  ctx.bezierCurveTo(33, 5.4, 31.5, 8.8, 27, 10);
  ctx.bezierCurveTo(21, 12, 12, 12.8, 5, 12.2);
  ctx.bezierCurveTo(1, 11.9, -1.5, 10.5, -3, 9.4);
  ctx.closePath();
}
const lipPt = (u) => { // a point on the upper lip, u = 0 hinge .. 1 front (quadratic HINGE -> (20,5) -> (32.4,2.4))
  const v = 1 - u;
  return [v * v * HINGE[0] + 2 * u * v * 20 + u * u * 32.4, v * v * HINGE[1] + 2 * u * v * 5 + u * u * 2.4];
};
const jawLip = (u) => { const v = 1 - u; return [v * v * HINGE[0] + 2 * u * v * 20 + u * u * 31, v * v * HINGE[1] + 2 * u * v * 5.4 + u * u * 3.6]; };

function star(ctx, x, y, r, rot) {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) { const b = rot - Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(b) * rr, y + Math.sin(b) * rr); }
  ctx.closePath();
}

// The whole head in head space. F = face channels, P = palette, lw = outline width (head units).
function drawHead(ctx, P, F, t, lw, o) {
  const m = clamp01(F.mouth), jawA = m * 0.72;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // far eye, peeking over the snout (behind the head)
  ctx.beginPath();
  ctx.arc(20, -15, 3.9, 0, TAU);
  ctx.fillStyle = P.body;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = P.line;
  ctx.stroke();
  if (!(F.sq > 0.5)) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(20.3, -15.3, 2.9, 0, TAU);
    ctx.clip();
    ctx.fillStyle = css(P.e_white);
    ctx.fill();
    if (F.spi > 0.5) { ctx.beginPath(); ctx.arc(20.9, -15.3, 1.4, t * 6, t * 6 + 4.5); ctx.lineWidth = 0.9; ctx.strokeStyle = css(P.e_pupil); ctx.stroke(); }
    else {
      ctx.fillStyle = css(mixC(P.e_iris, P.e_hunt, F.hunt));
      ctx.beginPath(); ctx.arc(21.3 + (o.look || 0) * 0.6, -15.1, 2, 0, TAU); ctx.fill();
      ctx.fillStyle = css(P.e_pupil);
      ctx.beginPath(); ctx.ellipse(21.5 + (o.look || 0) * 0.6, -15.1, 0.45 + 0.35 * F.pup, 1.7, 0, 0, TAU); ctx.fill();
    }
    const lid = Math.max(F.lid, o.blink || 0);
    ctx.fillStyle = P.body;
    ctx.fillRect(14, -19.5, 12, 0.8 + 5.8 * lid);
    ctx.restore();
  }
  // lower jaw, mouth, tongue (under the upper head)
  ctx.save();
  ctx.translate(HINGE[0], HINGE[1]);
  ctx.rotate(jawA);
  ctx.translate(-HINGE[0], -HINGE[1]);
  ctx.beginPath();
  jawPath(ctx);
  ctx.fillStyle = P.belly;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.beginPath(); // jaw shadow
  ctx.ellipse(18, 2, 24, 7.5, 0.05, 0, TAU);
  ctx.rect(-10, -10, 60, 40);
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = P.plate;
  ctx.fill('evenodd');
  ctx.restore();
  ctx.beginPath();
  jawPath(ctx);
  ctx.lineWidth = lw;
  ctx.strokeStyle = P.line;
  ctx.stroke();
  if (m > 0.04 && F.teeth > 0.3) { // lower teeth
    ctx.beginPath();
    for (const u of [0.55, 0.72, 0.86]) { const [x, y] = jawLip(u); ctx.moveTo(x - 1.1, y + 0.3); ctx.lineTo(x, y - 2.3 * Math.min(1, m * 4)); ctx.lineTo(x + 1.1, y + 0.3); }
    ctx.fillStyle = '#fff8ea';
    ctx.fill();
    ctx.lineWidth = lw * 0.5;
    ctx.stroke();
  }
  ctx.restore();
  const rot = (p) => { const c = Math.cos(jawA), s = Math.sin(jawA), dx = p[0] - HINGE[0], dy = p[1] - HINGE[1]; return [HINGE[0] + dx * c - dy * s, HINGE[1] + dx * s + dy * c]; };
  if (m > 0.04) { // the open mouth
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) { const [x, y] = lipPt(i / 10); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    for (let i = 10; i >= 0; i--) { const [x, y] = rot(jawLip(i / 10)); ctx.lineTo(x, y); }
    ctx.closePath();
    ctx.fillStyle = '#6a0d1c';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.beginPath(); // throat shade and the tongue bed
    const [jx, jy] = rot([21, 7]);
    ctx.ellipse(jx, jy, 12, 3.2, jawA, 0, TAU);
    ctx.fillStyle = '#c8344f';
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = lw * 0.8;
    ctx.strokeStyle = P.line;
    ctx.stroke();
  }
  // forked tongue: from inside the mouth's front, flicking; lolls down limp when dizzy
  const tg = clamp01(F.tongue);
  if (tg > 0.04) {
    const [fx, fy] = m > 0.04 ? rot([27, 5]) : [31.5, 3];
    const L = 15 * tg, sway = Math.sin(t * 34) * 0.22 * (1 - F.loll) * tg;
    const a0 = (m > 0.04 ? jawA * 0.6 : 0.12) + sway + F.loll * 0.9;
    const mx = fx + Math.cos(a0) * L * 0.55, my = fy + Math.sin(a0) * L * 0.55 + F.loll * 2;
    const a1 = a0 + F.loll * 0.5 - sway * 1.5;
    const tx = mx + Math.cos(a1) * L * 0.5, ty = my + Math.sin(a1) * L * 0.5;
    const spread = 0.42 + 0.25 * Math.sin(t * 40) * (1 - F.loll);
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.quadraticCurveTo(mx, my, tx, ty);
    for (const s of [-1, 1]) { ctx.moveTo(tx, ty); ctx.lineTo(tx + Math.cos(a1 + s * spread) * 3.6 * tg, ty + Math.sin(a1 + s * spread) * 3.6 * tg); }
    ctx.lineWidth = 2.6 + lw * 1.6;
    ctx.strokeStyle = P.line;
    ctx.stroke();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#ec4466';
    ctx.stroke();
  }
  // upper head: body colour, pale throat and upper lip, cel shadow and highlight, a few scale hints
  ctx.beginPath();
  upperPath(ctx, false);
  ctx.fillStyle = P.body;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.beginPath(); // pale throat under the eye, running back into the belly
  ctx.moveTo(-18, 4);
  ctx.bezierCurveTo(-8, 6.5, 0, 6, HINGE[0] + 1, HINGE[1] - 0.6);
  ctx.quadraticCurveTo(20, 2.6, 33, 0.4);
  ctx.lineTo(40, 20); ctx.lineTo(-20, 20);
  ctx.closePath();
  ctx.fillStyle = P.belly;
  ctx.fill();
  ctx.beginPath(); // cel shadow on the lower back of the skull and under the snout
  ctx.rect(-30, -30, 80, 60);
  ctx.ellipse(6, -8.5, 24, 14.5, -0.05, 0, TAU);
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = P.shade;
  ctx.fill('evenodd');
  ctx.globalAlpha = 1;
  ctx.beginPath(); // highlight crescent on the crown
  ctx.ellipse(-3, -16.8, 10, 2.8, -0.12, Math.PI * 1.05, Math.PI * 1.95);
  ctx.ellipse(-2, -15.4, 9, 1.3, -0.12, Math.PI * 1.95, Math.PI * 1.05, true);
  ctx.closePath();
  ctx.fillStyle = P.light;
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; // v4: a crisp wet glint on the crown and the snout (gloss reads as a hard, clean form)
  ctx.beginPath(); ctx.ellipse(-6.5, -17.1, 3.6, 1.05, -0.14, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(1.2, -17.6, 1.1, 0.8, -0.1, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(25.5, -7.6, 2.3, 0.9, 0.42, 0, TAU); ctx.fill();
  ctx.beginPath(); // scale hints behind the eye
  for (const [x, y] of [[-10, -7], [-6, -2], [-11, -1.5], [-2, -0.5]]) { ctx.moveTo(x - 2.4, y); ctx.quadraticCurveTo(x, y + 2.2, x + 2.4, y); }
  ctx.strokeStyle = P.shade;
  ctx.lineWidth = 0.9;
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  upperPath(ctx, true);
  ctx.lineWidth = lw * 1.15;
  ctx.strokeStyle = P.line;
  ctx.stroke();
  ctx.save(); ctx.translate(lw * 0.15, lw * 0.4); ctx.beginPath(); upperPath(ctx, true); ctx.stroke(); ctx.restore(); // line weight: heavier under the jawline
  // nostril
  ctx.beginPath();
  ctx.ellipse(28.8, -4, 1.2, 0.85, -0.4, 0, TAU);
  ctx.fillStyle = P.line;
  ctx.fill();
  // mouth line (closed) with its corner turned up or down; fangs and a tooth row
  if (m <= 0.04) {
    ctx.beginPath();
    const [cx, cy] = lipPt(0.12);
    ctx.moveTo(32.2, 2.3);
    ctx.quadraticCurveTo(20, 5, cx, cy);
    ctx.quadraticCurveTo(cx - 2.2, cy - 0.2 - F.smile * 1.6, cx - 3, cy - F.smile * 3);
    ctx.lineWidth = lw * 1.1;
    ctx.strokeStyle = P.line;
    ctx.stroke();
    if (F.teeth > 0.3) { // a toothy grin along the lip
      ctx.beginPath();
      for (let u = 0.3; u < 0.92; u += 0.09) { const [x, y] = lipPt(u); ctx.moveTo(x - 1.2, y - 0.2); ctx.lineTo(x, y + 2.2); ctx.lineTo(x + 1.2, y - 0.1); }
      ctx.fillStyle = '#fff8ea';
      ctx.fill();
      ctx.lineWidth = lw * 0.45;
      ctx.stroke();
    }
  } else if (F.teeth > 0.3) {
    ctx.beginPath();
    for (const [u, L] of [[0.84, 4.2], [0.6, 2.4], [0.45, 2]]) { const [x, y] = lipPt(u); ctx.moveTo(x - 1.2, y - 0.2); ctx.lineTo(x - 0.3, y + L * Math.min(1, m * 4)); ctx.lineTo(x + 1.2, y - 0.1); }
    ctx.fillStyle = '#fff8ea';
    ctx.fill();
    ctx.lineWidth = lw * 0.5;
    ctx.strokeStyle = P.line;
    ctx.stroke();
  }
  drawEye(ctx, P, F, t, lw, o);
}

const mixC = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

// The near eye at (8.5, -6.5): white, iris (green, amber when hunting), slit pupil, two highlights; lids, a heavy
// brow above; squeezed shut (ouch) or spirals (dizzy).
function drawEye(ctx, P, F, t, lw, o) {
  const X = 8, Y = -8, R = 7.6, lid = Math.max(F.lid, o.blink || 0), look = clamp(o.look || 0, -1, 1);
  ctx.save();
  ctx.translate(X, Y);
  ctx.beginPath(); // socket
  ctx.arc(0, 0, R + 1.1, 0, TAU);
  ctx.fillStyle = P.shade;
  ctx.fill();
  if (F.sq > 0.5) { // squeezed shut: a > of lid lines
    ctx.beginPath();
    ctx.moveTo(-4.5, -4); ctx.lineTo(3.5, 0); ctx.lineTo(-4.5, 4);
    ctx.lineWidth = lw * 1.3;
    ctx.strokeStyle = P.line;
    ctx.stroke();
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.clip();
    ctx.fillStyle = css(P.e_white);
    ctx.fillRect(-R, -R, 2 * R, 2 * R);
    if (F.spi > 0.5) {
      ctx.beginPath();
      const s0 = t * 7;
      for (let i = 0; i <= 30; i++) { const a = s0 + i * 0.55, r = 0.3 + i * 0.2; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = css(P.e_pupil);
      ctx.stroke();
    } else {
      const ix = 1.6 + look * 1.6, iy = 0.4, ir = R * 0.66;
      ctx.beginPath();
      ctx.arc(ix, iy, ir, 0, TAU);
      ctx.fillStyle = css(mixC(P.e_iris, P.e_hunt, F.hunt));
      ctx.fill();
      ctx.beginPath(); // iris shade, lower back
      ctx.arc(ix, iy, ir, 0.2, Math.PI * 1.05);
      ctx.arc(ix + 0.8, iy - 1.2, ir, Math.PI * 1.05, 0.2, true);
      ctx.fillStyle = css(mixC(P.e_irisLo, P.e_huntLo, F.hunt));
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(ix + 0.3, iy, 0.7 + 1.5 * F.pup, ir * 0.86, 0, 0, TAU);
      ctx.fillStyle = css(P.e_pupil);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(ix + 2.2, iy - 2.4, 1.45, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(ix - 1.6, iy + 2.2, 0.6, 0, TAU); ctx.fill();
    }
    // lids: the upper one tilts with the brow (angry: front end lower), the lower one rises in a squint
    const yU = -R + 2 * R * lid, tl = (1.6 + 1.2 * Math.abs(F.tilt)) * Math.sign(F.tilt) * (1 - lid * 0.6);
    ctx.beginPath();
    ctx.moveTo(-R - 1, -R - 2);
    ctx.lineTo(R + 1, -R - 2);
    ctx.lineTo(R + 1, yU + tl);
    ctx.lineTo(-R - 1, yU - tl);
    ctx.closePath();
    const yL = R - 2 * R * clamp01(F.low);
    if (F.low > 0.02) { ctx.moveTo(-R - 1, R + 2); ctx.lineTo(R + 1, R + 2); ctx.lineTo(R + 1, yL - 0.8); ctx.quadraticCurveTo(0, yL - 2.2, -R - 1, yL + 0.6); ctx.closePath(); }
    ctx.fillStyle = P.body;
    ctx.fill();
    ctx.beginPath();
    if (lid > 0.04) { ctx.moveTo(-R - 1, yU - tl); ctx.lineTo(R + 1, yU + tl); }
    if (F.low > 0.04) { ctx.moveTo(R + 1, yL - 0.8); ctx.quadraticCurveTo(0, yL - 2.2, -R - 1, yL + 0.6); }
    ctx.lineWidth = lw;
    ctx.strokeStyle = P.line;
    ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.lineWidth = lw * 0.95;
  ctx.strokeStyle = P.line;
  ctx.stroke();
  // the brow: a heavy tapered ridge over the eye, raised or lowered and tilted with the mood
  ctx.translate(0.5, -R - 1.2 - F.brow * 2.8);
  ctx.rotate(F.tilt * 0.3);
  ctx.beginPath();
  ctx.moveTo(-10.5, 2.4);
  ctx.bezierCurveTo(-10, -4.8, 4, -6.2, 11, -1);
  ctx.bezierCurveTo(12.6, 0.4, 11.8, 3, 9.6, 3);
  ctx.bezierCurveTo(3, 1.2, -4, 1.4, -10.5, 2.4);
  ctx.closePath();
  ctx.fillStyle = P.brow;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.beginPath();
  ctx.ellipse(0, 3.6, 11, 3.4, 0, 0, TAU);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = P.line;
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = lw;
  ctx.strokeStyle = P.line;
  ctx.stroke();
  ctx.restore();
}

// spitter's hood: five spines fanned behind the head with a webbed frill between, flaring (0..1) when it rears
function drawFrill(ctx, P, flare, t, lw) {
  const bx = -10, by = -3.6, n = 5, a0 = Math.PI - 0.75, a1 = Math.PI + 1.25, len = 22 * (0.82 + 0.3 * flare), tips = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / (n - 1) + Math.sin(t * 3 + i) * 0.03, L = len * (i === 0 || i === n - 1 ? 0.8 : 1);
    tips.push([bx + Math.cos(a) * L, by + Math.sin(a) * L]);
  }
  ctx.beginPath();
  ctx.moveTo(bx, by);
  tips.forEach(([x, y], i) => {
    if (i) { const [px, py] = tips[i - 1], mx = (px + x) / 2, my = (py + y) / 2; ctx.quadraticCurveTo(bx + (mx - bx) * 0.82, by + (my - by) * 0.82, x, y); } else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = P.shade;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = P.line;
  ctx.stroke();
  ctx.lineCap = 'round';
  for (const [x, y] of tips) {
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(x, y);
    ctx.lineWidth = 2 + lw;
    ctx.strokeStyle = P.line;
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = P.mark;
    ctx.stroke();
  }
}

function drawCrown(ctx, t, lw) { // the boss's little gold crown (head space)
  ctx.save();
  ctx.translate(-2, -21);
  ctx.rotate(-0.12);
  ctx.beginPath();
  ctx.moveTo(-6.5, 1.5); ctx.lineTo(-7.5, -6); ctx.lineTo(-3.5, -2); ctx.lineTo(0, -8); ctx.lineTo(3.5, -2); ctx.lineTo(7.5, -6); ctx.lineTo(6.5, 1.5);
  ctx.closePath();
  ctx.fillStyle = '#ffcf3a';
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = '#6b3a0c';
  ctx.stroke();
  ctx.fillStyle = '#ff5a6e';
  ctx.beginPath(); ctx.arc(0, -1.6, 1.3, 0, TAU); ctx.fill();
  ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.4 * Math.sin(t * 3)})`;
  ctx.beginPath(); ctx.arc(-4, -1, 0.7, 0, TAU); ctx.fill();
  ctx.restore();
}

// Green venom welling at the mouth (px space, d = facing).
function drawVenomDrip(ctx, u, d, v, t) {
  ctx.save();
  ctx.lineJoin = 'round';
  const blob = (x, y, rx, ry) => {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.fillStyle = '#7bea38'; ctx.fill();
    ctx.lineWidth = Math.max(1, u * 0.28); ctx.strokeStyle = '#1c6a14'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(x - rx * 0.3, y - ry * 0.3, Math.max(0.5, rx * 0.22), 0, TAU); ctx.fill();
  };
  const L = u * (1 + 3.5 * v);
  ctx.beginPath();
  ctx.moveTo(-u * 0.6, 0);
  ctx.quadraticCurveTo(-u * 0.3, L * 0.6, 0, L);
  ctx.quadraticCurveTo(u * 0.3, L * 0.6, u * 0.6, 0);
  ctx.closePath();
  ctx.fillStyle = '#7bea38';
  ctx.fill();
  blob(0, L, u * (0.8 + 0.5 * v), u * (0.95 + 0.5 * v));
  for (let i = 0; i < 3; i++) {
    const k = mod(t * 2.2 + i / 3, 1);
    ctx.globalAlpha = (1 - k) * v;
    blob(d * (k * u * 7 + i * u), k * u * 5 + Math.sin(i * 2) * u, u * 0.55 * (1 - k * 0.4), u * 0.55 * (1 - k * 0.4));
  }
  ctx.restore();
}

/* ---------------------------------------------------------------- one snake */
const snFace = {}; // facing per snake id when there is no anim state (palette strips)
const SN_TILT = 0.87; // ~50 degrees: the most a head tilts before it foreshortens

// Snake along pts (head first, y-down px). r = the old body radius unit: the body is ~2r * 1.9 * thick wide.
// opts: id, skin, kind ('spitter' wears a hood), thick, head (head size, 5.4 = standard), breath (width swell),
// crown, venom 0..1, mouthOpen / expr (without anim), anim (A from snakeHeadAnim: look, dt, face), part ('body' |
// 'head'), wave (0 = the caller shaped the path), flash 0..1 (zap), frozen 0..1 (ice shell), crack 0..1, droop 0..1,
// stars 0..1 (dizzy ring), shake 0..1 (shake-off after a thaw), ice 0..1 (tint).
export function drawSnake(ctx, pts, r, t = 0, opts = {}) {
  if (!pts || pts.length < 2 || !(r > 0)) return;
  ctx.save();
  try {
    opts = opts || {};
    const A = opts.anim || null, frozen = clamp01(opts.frozen || 0);
    const P = palette(opts.skin || 'violet', Math.max(frozen, clamp01(opts.ice || 0)));
    const Wh = r * 1.9 * clamp(opts.thick || 1, 0.4, 3);
    const step = Math.max(Wh * 0.22, 0.5);
    let n = sample(pts, step, opts.wave === 0 ? 6 : 14);
    if (n < 3) {
      n = 3;
      const dx = pts[1].x - pts[0].x, dy = pts[1].y - pts[0].y, l = Math.hypot(dx, dy) || 1;
      for (let i = 0; i < 3; i++) { snX[i] = pts[0].x + (dx / l) * step * i; snY[i] = pts[0].y + (dy / l) * step * i; }
    }
    N = n;
    tangents(n);
    if (opts.wave !== 0) { // a travelling wiggle for callers that pass a plain line
      const len = snA[n - 1] || 1, wl = (0.22 * 7) / Wh;
      for (let i = 1; i < n; i++) { const w = Math.sin(t * 6 - snA[i] * wl) * Wh * 0.36 * Math.min(1, (snA[i] / len) * 2.5); tmpX[i] = snX[i] + snNX[i] * w; tmpY[i] = snY[i] + snNY[i] * w; }
      for (let i = 1; i < n; i++) { snX[i] = tmpX[i]; snY[i] = tmpY[i]; }
      tangents(n);
    }
    widths(n, Wh, opts.breath || 1);
    const lw = Math.max(1.3, Wh * 0.17);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const head = headFrame(opts, A, Wh, t, n, opts.part !== 'body');
    const shell = Wh * 0.42; // ice shell thickness
    if (opts.part !== 'head') {
      // contact shadow
      ctx.save();
      ctx.translate(Wh * 0.3, Wh * 0.5);
      ctx.beginPath();
      outlinePath(ctx, 0, n - 1, frozen > 0 ? shell : 0);
      ctx.fillStyle = 'rgba(40,16,8,0.28)';
      ctx.fill();
      ctx.restore();
      if (frozen > 0) iceBack(ctx, n, head, shell, lw, frozen);
      for (const [a, b] of pieces(n, Wh)) bodyPiece(ctx, P, a, b, Wh, lw, opts.flash || 0);
    }
    if (opts.part === 'body') return;
    if (opts.noHead) return;
    drawHeadAt(ctx, P, opts, A, head, Wh, lw, t);
    if (frozen > 0) iceFront(ctx, n, head, shell, lw, frozen, clamp01(opts.crack || 0), t, opts.id | 0);
  } catch (e) {
    // art must never break the frame
  }
  ctx.restore();
}

// Where the head goes and how it is posed: follows the body tangent with a slight lag plus where it looks; tilts at
// most SN_TILT off level, then foreshortens; turning round is a quick squash and mirror (no crossfade ghost).
function headFrame(opts, A, Wh, t, n, upd) {
  const hx = snX[0], hy = snY[0], j = Math.min(n - 1, Math.max(2, Math.round(1.6 / 0.22)));
  const dx = hx - snX[j], dy = hy - snY[j];
  const hu = (Wh / 10) * ((opts.head || 5.4) / 5.4) * 1.05;
  let ang, fs;
  if (A && (upd || !Number.isFinite(A.ang))) {
    const dt = upd ? clamp(A.dt || 0, 0, 0.1) : 0, want = Math.atan2(dy, dx) + (A.look || 0) * 0.6;
    if (Number.isFinite(want)) A.ang = !Number.isFinite(A.ang) ? want : A.ang + wrapA(want - A.ang) * (1 - Math.exp(-dt * (A.lag || 9)));
    else if (!Number.isFinite(A.ang)) A.ang = 0;
    const c = Math.cos(A.ang);
    if (A.face === undefined) { A.face = c < 0 ? -1 : 1; A.fs = A.face; }
    if (A.face > 0 ? c < -0.3 : c > 0.3) A.flipT = (A.flipT || 0) + dt; else A.flipT = 0;
    if (A.flipT > 0.12) { A.face = -A.face; A.flipT = 0; }
    A.fs += clamp(A.face - A.fs, -dt / 0.06, dt / 0.06);
    ang = A.ang; fs = A.fs;
  } else if (A) { ang = A.ang; fs = A.fs; } else {
    const id = opts.id | 0;
    let L = snFace[id] === undefined ? dx < 0 : snFace[id];
    if (Math.abs(dx) > Math.hypot(dx, dy) * 0.3) L = dx < 0;
    snFace[id] = L;
    ang = Math.atan2(dy, dx); fs = L ? -1 : 1;
  }
  const left = fs < 0, a = wrapA(ang - (left ? Math.PI : 0));
  const tilt = clamp(a, -SN_TILT, SN_TILT), fore = clamp01((Math.abs(a) - SN_TILT) / 0.75);
  // life: a slow bob, a hiss rears up, a dizzy head lolls, drooping toward the floor; zaps jitter it; a thaw shakes it
  const F = A && A.f ? A.f : faceFor(opts, t), frozen = opts.frozen > 0, d = left ? -1 : 1;
  const droop = clamp01(opts.droop || 0), shake = clamp01(opts.shake || 0), rearing = F.mouth > 0.5 || F.tilt > 0.7;
  const bob = frozen ? 0 : (Math.sin(t * 3.2) * 0.6 - (rearing ? 1.2 : 0)) * (Wh / 7);
  let rot = frozen ? 0 : Math.sin(t * 2.6) * 0.03;
  rot += d * droop * (0.32 + (frozen ? 0 : 0.12 * Math.sin(t * 2.1)));
  if (F.spi > 0.5 && !frozen) rot += Math.sin(t * 5) * 0.1;
  if (opts.flash > 0) rot += Math.sin(t * 90) * 0.12 * opts.flash;
  rot += Math.sin(t * 38) * 0.28 * shake;
  return { hx, hy, hu, left, d, tilt, fore, rot, bob, F, rearing, sx: Math.max(0.55, Math.abs(fs)) * (left ? -1 : 1) }; // a turn squashes, never to a sliver
}
function applyHead(ctx, H) {
  ctx.translate(H.hx, H.hy + H.bob);
  ctx.rotate(H.tilt + H.rot);
  ctx.scale((1 - 0.2 * H.fore) * H.sx * H.hu, (1 + 0.05 * H.fore) * H.hu);
}
// a head-space point in px
function headPt(H, x, y) {
  const X = x * (1 - 0.2 * H.fore) * H.sx * H.hu, Y = y * (1 + 0.05 * H.fore) * H.hu, c = Math.cos(H.tilt + H.rot), s = Math.sin(H.tilt + H.rot);
  return [H.hx + X * c - Y * s, H.hy + H.bob + X * s + Y * c];
}

function drawHeadAt(ctx, P, opts, A, H, Wh, lw, t) {
  const { F, d, bob, rearing } = H, frozen = opts.frozen > 0, droop = clamp01(opts.droop || 0);
  const lwH = lw / H.hu;
  // stars behind the head first (the far side of their ring)
  const stars = clamp01(opts.stars || 0);
  const starsPass = (front) => {
    if (stars <= 0) return;
    const cx = H.hx + d * 6 * H.hu, cy = H.hy + bob - 26 * H.hu * (1 - 0.3 * droop), rx = 15 * H.hu, ry = 4.6 * H.hu, tl = 0.22 * d;
    for (let i = 0; i < 3; i++) {
      const a = t * 4.2 + (i * TAU) / 3, s = Math.sin(a);
      if ((s > 0) !== front) continue;
      const x0 = Math.cos(a) * rx, y0 = s * ry;
      const x = cx + x0 * Math.cos(tl) - y0 * Math.sin(tl), y = cy + x0 * Math.sin(tl) + y0 * Math.cos(tl);
      const rr = Math.max(2.8, 4.2 * H.hu) * (front ? 1.1 : 0.8);
      ctx.globalAlpha = stars * (front ? 1 : 0.85);
      star(ctx, x, y, rr, t * 3 + i);
      ctx.fillStyle = front ? '#ffe14a' : '#e3b52c';
      ctx.fill();
      ctx.lineWidth = Math.max(0.9, rr * 0.3);
      ctx.strokeStyle = '#6b3d06';
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  };
  starsPass(false);
  ctx.save();
  applyHead(ctx, H);
  if (opts.kind === 'spitter' || opts.frill) {
    if (A) A.frill = (A.frill || 0) + ((rearing || (opts.venom || 0) > 0.05 ? 1 : 0) - (A.frill || 0)) * Math.min(1, (A.dt || 0) * 10);
    drawFrill(ctx, P, A ? A.frill : rearing ? 1 : 0, frozen ? 0 : t, lwH);
  }
  const blink = A && A.blinkT > 0 ? Math.sin((1 - A.blinkT / 0.17) * Math.PI) : 0;
  drawHead(ctx, P, F, t, lwH, { blink, look: A ? clamp(-(A.look || 0) * d, -1, 1) : 0 });
  if (opts.crown) drawCrown(ctx, t, lwH);
  if (opts.decorate) opts.decorate(ctx, { P, F, t, lw: lwH, frozen }); // a creature's own extras, in head space
  if (opts.flash > 0) { ctx.beginPath(); upperPath(ctx, false); ctx.fillStyle = `rgba(255,252,210,${clamp01(opts.flash) * 0.85})`; ctx.fill(); }
  ctx.restore();
  const [mx, my] = headPt(H, 32, 3); // the mouth's front, for the venom and the spit
  if (A) { A.mouthX = mx; A.mouthY = my; }
  const venom = clamp01(opts.venom || 0);
  if (venom > 0.05) { ctx.save(); ctx.translate(mx, my); drawVenomDrip(ctx, Wh * 0.55, d, venom, t); ctx.restore(); }
  starsPass(true);
}
// a face without anim state (palette strips): from expr / mouthOpen / venom
function faceFor(opts, t) {
  let ex = opts.expr && FACE[opts.expr] ? opts.expr : null;
  const mo = clamp01(opts.mouthOpen || 0);
  if (!ex) ex = (opts.venom || 0) > 0.05 ? 'snarl' : mo > 0.6 ? 'strike' : mo > 0.15 ? 'hiss' : 'idle';
  const F = { ...FACE[ex], tongue: ex === 'taste' || mod(t * 0.9, 2.4) < 0.4 ? 0.8 : 0 };
  if (ex === 'blink' || mod(t, 3.4) < 0.13) F.lid = 1;
  return F;
}

/* ---------------------------------------------------------------- frozen */
// The shell follows the snake's own silhouette: the body outline grown by `shell`, and the head outline grown the
// same in head space. Back: a dark blue rim and pale ice behind the snake; front: a clear sheen, facet glints,
// frost crystals on the outline and, near the end, cracks.
function silhouette(ctx, n, H, shell, grow) {
  outlinePath(ctx, 0, n - 1, grow);
  ctx.save();
  applyHead(ctx, H);
  const g = 1 + (grow / H.hu) / 15;
  ctx.translate(10, -3);
  ctx.scale(g, g);
  ctx.translate(-10, 3);
  upperPath(ctx, false);
  jawPath(ctx);
  ctx.restore();
}
function iceBack(ctx, n, H, shell, lw, a) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.beginPath();
  silhouette(ctx, n, H, shell, shell);
  ctx.lineWidth = Math.max(2.4, lw * 2);
  ctx.strokeStyle = RIM;
  ctx.stroke();
  ctx.fillStyle = '#a9d8f5';
  ctx.fill();
  ctx.restore();
}
function iceFront(ctx, n, H, shell, lw, a, crack, t, seed) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.beginPath();
  silhouette(ctx, n, H, shell, shell);
  ctx.fillStyle = 'rgba(170,220,250,0.22)';
  ctx.fill();
  ctx.save();
  ctx.clip();
  // facet glints: crisp white slivers on the upper-left side of the shell
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  const glint = (i, L) => {
    if (i < 1 || i >= n - 2) return;
    const o = snNY[i] < 0 ? 1 : -1, w = (o > 0 ? snWP[i] : snWM[i]) + shell * 0.45;
    const x = snX[i] + snNX[i] * w * o, y = snY[i] + snNY[i] * w * o, tx = snTX[i], ty = snTY[i], nx = snNX[i] * o, ny = snNY[i] * o;
    ctx.beginPath();
    ctx.moveTo(x + tx * L, y + ty * L);
    ctx.lineTo(x + tx * L * 0.7 - nx * L * 0.22, y + ty * L * 0.7 - ny * L * 0.22);
    ctx.lineTo(x - tx * L, y - ty * L);
    ctx.lineTo(x - tx * L * 0.7 + nx * L * 0.18, y - ty * L * 0.7 + ny * L * 0.18);
    ctx.closePath();
    ctx.fill();
  };
  const slash = (i, L, wd) => { // a crisp white facet streak across the shell, slanted
    if (i < 1 || i >= n - 2) return;
    const w = snW[i] + shell, tx = snTX[i], ty = snTY[i], nx = snNX[i], ny = snNY[i], c = [snX[i], snY[i]];
    ctx.beginPath();
    ctx.moveTo(c[0] + nx * w + tx * L * 0.5, c[1] + ny * w + ty * L * 0.5);
    ctx.lineTo(c[0] + nx * w + tx * (L * 0.5 + wd), c[1] + ny * w + ty * (L * 0.5 + wd));
    ctx.lineTo(c[0] - nx * w - tx * (L * 0.5 - wd), c[1] - ny * w - ty * (L * 0.5 - wd));
    ctx.lineTo(c[0] - nx * w - tx * L * 0.5, c[1] - ny * w - ty * L * 0.5);
    ctx.closePath();
    ctx.fill();
  };
  ctx.globalAlpha = a * 0.75;
  slash(Math.round(n * 0.26), shell * 2.2, shell * 0.9);
  slash(Math.round(n * 0.26) + Math.round(shell * 2.6 / Math.max(0.5, snA[1] - snA[0])), shell * 2.2, shell * 0.45);
  slash(Math.round(n * 0.6), shell * 2, shell * 0.7);
  ctx.globalAlpha = a;
  glint(Math.round(n * 0.42), shell * 1.6);
  ctx.save(); // and one on the head's crown
  applyHead(ctx, H);
  ctx.beginPath();
  ctx.moveTo(-9, -22.5); ctx.lineTo(7, -24); ctx.lineTo(8, -22.6); ctx.lineTo(-8, -21.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // cracks: jagged hairlines spreading from a few seeds over the shell
  if (crack > 0) {
    ctx.beginPath();
    for (let c = 0; c < 5; c++) {
      const i0 = Math.round(((c + 0.5) / 5) * (n - 2)), L = (2 + 5 * crack) * shell;
      let x = snX[i0], y = snY[i0], dir = hash(seed * 7 + c) * TAU;
      ctx.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        const s = L / 5;
        dir += (hash(seed + c * 13 + k) - 0.5) * 1.6;
        x += Math.cos(dir) * s; y += Math.sin(dir) * s;
        ctx.lineTo(x, y);
        if (k === 2) { const b = dir + (hash(c + k) > 0.5 ? 1 : -1) * 0.9; ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(b) * s * 1.2 * crack, y + Math.sin(b) * s * 1.2 * crack); ctx.moveTo(x, y); }
      }
    }
    ctx.lineWidth = Math.max(2, lw * 1.1);
    ctx.strokeStyle = 'rgba(47,111,158,0.9)';
    ctx.stroke();
    ctx.lineWidth = Math.max(1, lw * 0.55);
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }
  ctx.restore();
  // frost crystals on the outline: small six-point snowflakes on the upper rim
  ctx.lineWidth = Math.max(0.9, lw * 0.5);
  for (let c = 0; c < 4; c++) {
    const i = Math.round(((c + 0.7) / 4.4) * (n - 3)), o = snNY[i] < 0 ? 1 : -1, w = (o > 0 ? snWP[i] : snWM[i]) + shell;
    const x = snX[i] + snNX[i] * w * o, y = snY[i] + snNY[i] * w * o, R = shell * (0.7 + 0.3 * hash(c + seed));
    ctx.beginPath();
    for (let k = 0; k < 3; k++) { const b = (k * Math.PI) / 3 + c; ctx.moveTo(x - Math.cos(b) * R, y - Math.sin(b) * R); ctx.lineTo(x + Math.cos(b) * R, y + Math.sin(b) * R); }
    ctx.strokeStyle = RIM;
    ctx.lineWidth = Math.max(1.8, lw * 0.9);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(0.9, lw * 0.45);
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------------------------------------------------------------- in the level */
export const drawSerpent = drawSnake; // the rig under its generic name
const pxSpace = (ctx, x, y, k, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(1 / k, -1 / k); try { f(); } catch (e) { /* art never breaks the frame */ } ctx.restore(); };
const ENTER_T = 1.2, ENTER_C = 1.5; // s of the slither-in before a snake starts hunting; its ease (m/s^2)

// The face a snake wants from its state. Green eyes for calm crawling, amber hunting eyes only once close to its
// prey; a blocked snake must stay blocked a while to hiss.
function snakeWant(S, A, sim) {
  if (S.flee >= 0 || S.carried) return 'shock';
  if (S.mood === 'ouch' || S.mood === 'shock') return S.mood;
  if (S.stun > 0) return S.hurt === 'burn' ? 'ouch' : S.hurt === 'ice' ? 'frozen' : 'dizzy';
  if (S.daze > 0) return 'dizzy';
  if (S.rival > 0) { const el = (S.rivalD || 3.3) - S.rival; return el < 1.3 ? 'hiss' : el < 1.6 ? 'strike' : 'snarl'; }
  const sp = sim.spitPhase && sim.spitPhase(S);
  if (sp) return sp.fly < 0 ? 'snarl' : 'strike';
  if (S.mood === 'chew') return Math.floor(sim.t * 8) % 2 ? 'chew1' : 'chew0';
  if (S.mood === 'grin') return 'grin';
  if (S.lunge > 0.45) return 'strike';
  if (S.strike > 0) return 'snarl';
  if (S.spit) { const sk = sim.spitK(S); return sk < 0.25 ? 'snarl' : sk < 0.4 ? 'strike' : 'hiss'; }
  if (S.back > 0) return 'hunt';
  if (A.blk > 0.75) A.hissing = true; else if (A.blk < 0.3) A.hissing = false;
  if (A.hissing) return 'hiss';
  if (S.mouthOpen > 0.45) A.near = true; else if (S.mouthOpen < 0.2) A.near = false;
  return A.near ? 'hunt' : 'idle';
}

// Per-snake render state (head animation, smoothed flags, the frozen clock). Reset when the sim changes.
export const snAnim = {};

// The drawn body lives in channel space: each trail point sits on its channel's centre line (a little of the real
// path kept), so the body never crosses a ring wall; points that slid through a gap keep their real radius, blended
// in over ~0.35 m. A lateral wave pinned to the distance crawled (S.odo) runs down the body, with a slow drift of
// its own while it moves so the slither reads lively. A trail still shorter than the body (just come in) carries on
// straight out from the vault, so the snake slides in whole; before it starts hunting it is drawn slithering in
// from off screen along that line (presentation only: the sim's delay and speed are untouched).
export function serpentPath(sim, S, A, t) {
  if (S.carried) return S.pts.map((q) => ({ x: q.x, y: q.y }));
  const R = sim.rings, n = R.length, sz = Math.pow(S.size || 1, 0.6);
  const Wm = 0.22 * sz * (S.girth || 1), inner = (R.length > 1 ? R[1].r - R[0].r : 1) - RING_TH;
  const Am = clamp(inner / 2 - Wm - 0.04, 0.02, 0.13 * sz);
  const m = Wm + Am + 0.02;
  const band = (c) => {
    let lo = c > 0 ? R[c - 1].r + RING_TH / 2 + m : 0.3, hi = c < n ? R[c].r - RING_TH / 2 - m : 1e9;
    if (lo > hi) lo = hi = (lo + hi) / 2;
    return [lo, hi];
  };
  // 1. trail -> polar points with path coordinate P (odo - distance back along the trail), gaps filled in polar
  const Q = [];
  let P = S.odo || 0;
  let T = S.pts;
  if (T.length < 2) { // slithering in (or the first step in): a straight line out from the spawn point, the head d further out
    const d = A.enter, r0 = S.rad + d;
    T = [{ a: S.a, r: r0, g: 0, x: r0 * Math.cos(S.a), y: r0 * Math.sin(S.a) }];
    P = -d;
  }
  for (let i = 0; i < T.length; i++) {
    const q = T[i];
    if (i) {
      const p = T[i - 1], d = Math.hypot(q.x - p.x, q.y - p.y), k = Math.min(40, Math.floor(d / 0.06));
      for (let j = 1; j <= k; j++) { const f = j / (k + 1); Q.push({ a: lerpA(p.a, q.a, f), r: p.r + (q.r - p.r) * f, pin: p.g && q.g ? 1 : 0, P: P - d * f }); }
      P -= d;
    }
    Q.push({ a: q.a, r: q.r, pin: q.g && !sim.solidAt(R[q.g - 1], q.x, q.y) ? 1 : 0, P });
  }
  // a short trail carries on straight out of the vault, so the whole body is always there
  let have = 0;
  for (let i = 1; i < T.length; i++) have += Math.hypot(T[i].x - T[i - 1].x, T[i].y - T[i - 1].y);
  const last = Q[Q.length - 1];
  if (have < S.len && last.r > sim.outerR) for (let s = 0.06; s <= S.len - have + 0.1; s += 0.06) Q.push({ a: last.a, r: last.r + s, pin: 0, P: last.P - s });
  // 2. pin weights eased along the body; which way each part crawls (+ ccw), smoothed: a body that doubles back in
  // its channel lays its two arms side by side (lanes) and rounds the turn, instead of piling up on itself
  const NQ = Q.length, w = new Float32Array(NQ), dir = new Float32Array(NQ), lane = new Float32Array(NQ);
  let ccw = 0, cw = 0;
  for (let i = 0; i < NQ; i++) {
    const a = Q[Math.max(0, i - 1)], b = Q[Math.min(NQ - 1, i + 1)], da = wrapA(a.a - b.a) * Q[i].r;
    dir[i] = Math.abs(da) > 0.01 ? Math.sign(da) : 0;
    if (dir[i] > 0) ccw++; else if (dir[i] < 0) cw++;
  }
  if (ccw > 4 && cw > 4) {
    for (let p = 0; p < 3; p++) { // ~0.35 m box blur, three times: a round U
      let acc = 0;
      const H = 3;
      for (let i = 0; i < NQ + H; i++) {
        if (i < NQ) acc += dir[i];
        if (i - 2 * H - 1 >= 0) acc -= dir[i - 2 * H - 1];
        const j = i - H;
        if (j >= 0) lane[j] = acc / (2 * H + 1);
      }
      dir.set(lane);
    }
  }
  for (let i = 0; i < NQ; i++) w[i] = Q[i].pin;
  for (let i = 1; i < NQ; i++) w[i] = Math.max(w[i], w[i - 1] - (Q[i - 1].P - Q[i].P) / 0.35);
  for (let i = NQ - 2; i >= 0; i--) w[i] = Math.max(w[i], w[i + 1] - (Q[i].P - Q[i + 1].P) / 0.35);
  // 3. channel-space positions, cut at the body length
  const out = [];
  let s = 0, px = 0, py = 0;
  for (let i = 0; i < NQ; i++) {
    const q = Q[i], c = sim.chAt(q.r), [lo, hi] = band(c);
    const mid = c < n ? (lo + hi) / 2 : Math.max(lo, q.r);
    const ln = c < n ? lane[i] : 0, rl = clamp(mid + (q.r - mid) * 0.4 * (1 - Math.abs(ln)) + ln * ((hi - lo) / 2 + Am * 0.7), lo - Am * 0.7, hi + Am * 0.7);
    const rd = rl + (q.r - rl) * w[i];
    const x = rd * Math.cos(q.a), y = rd * Math.sin(q.a);
    if (i) { s += Math.hypot(x - px, y - py); if (s > S.len) break; }
    out.push({ x, y, P: q.P, s, w: w[i], ln: Math.abs(ln) });
    px = x; py = y;
  }
  // 4. lateral wave along the normal; strike coil and lunge; a stunned body goes slack; a thawed one shakes
  const M = out.length, lam = 1.35 * Math.sqrt(sz), L = M ? out[M - 1].s : 0;
  const sp = sim.spitPhase && S.vsK !== undefined && sim.spitPhase(S), rear = sp ? (sp.fly < 0 ? sp.rear : Math.max(0, 1 - sp.fly * 3)) : 0;
  const coil = Math.max(S.strike > 0 ? Math.min(1, S.strike / 0.3) : 0, rear), lunge = S.lunge > 0 ? Math.sin(Math.PI * Math.min(1, (1 - S.lunge) / 0.4)) * (1 - S.lunge) ** 0.5 : 0;
  const res = [];
  for (let i = 0; i < M; i++) {
    const o = out[i], a = out[Math.max(0, i - 1)], b = out[Math.min(M - 1, i + 1)];
    let tx = a.x - b.x, ty = a.y - b.y;
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl; ty /= tl;
    const env = Math.min(1, o.s / (0.9 * sz)) * (1 - o.w), tail = 1 - 0.3 * Math.max(0, (o.s - L * 0.7) / (L * 0.3 || 1));
    let off = Am * env * tail * Math.sin(((o.P + A.drift) / lam) * TAU) * (1 - 0.6 * A.slack) * (1 - 0.7 * o.ln);
    off += Am * 0.8 * A.slack * env * Math.sin(t * 1.5 + o.s * 1.6); // slack, slow wobble while stunned
    if (A.shake > 0) off += Am * 1.5 * A.shake * env * Math.sin(o.s * 3.2 - t * 32); // shaking the frost off
    off += Am * 1.3 * coil * Math.sin(Math.min(1, o.s / (1.3 * sz)) * Math.PI * 2) * (1 - o.w) * (o.s < 1.3 * sz ? 1 : 0); // S-coil
    let x = o.x - ty * off, y = o.y + tx * off;
    const pull = (0.28 * coil - 0.38 * lunge) * sz * Math.max(0, 1 - o.s / (1.4 * sz));
    x -= tx * pull; y -= ty * pull;
    res.push({ x, y });
  }
  return res;
}

// Jagged lightning along the body (px space), crisp yellow-white, re-rolled ~24 times a second.
function zapArcs(ctx, px, Wpx, t, k) {
  const r = (() => { let s = Math.floor(t * 24) * 9301 + 49297; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
  ctx.save();
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'round';
  const nP = px.length, span = Math.max(8, Math.round(nP * 0.45));
  for (let a = 0; a < 3; a++) {
    const i0 = Math.floor(r() * Math.max(1, nP - span)), i1 = Math.min(nP - 1, i0 + span);
    ctx.beginPath();
    for (let i = i0, side = 1; i <= i1; i += 3, side = -side) {
      const p = px[i], q = px[Math.min(nP - 1, i + 1)], dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1, j = side * (0.4 + r() * 0.9) * Wpx;
      const x = p.x - (dy / l) * j, y = p.y + (dx / l) * j;
      if (i === i0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      if (r() < 0.18) { ctx.lineTo(x - (dy / l) * j * 1.2 + dx / l * Wpx * 0.6, y + (dx / l) * j * 1.2 + dy / l * Wpx * 0.6); ctx.moveTo(x, y); } // a fork
    }
    ctx.lineWidth = Math.max(2.6, Wpx * 0.5) * k;
    ctx.strokeStyle = 'rgba(255,214,60,0.9)';
    ctx.stroke();
    ctx.lineWidth = Math.max(1.1, Wpx * 0.2) * k;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }
  ctx.restore();
}

// Ice shards popping off on a thaw (px space): angular bits flung out from the body, falling and spinning.
function thawShards(ctx, px, u, Wpx, seed) {
  ctx.save();
  ctx.globalAlpha = 1 - u * u;
  for (let i = 0; i < 7; i++) {
    const p = px[Math.floor(((i + 0.5) / 7) * (px.length - 1))], a = -Math.PI / 2 + (hash(seed + i) - 0.5) * 2.6;
    const v = Wpx * (5 + 4 * hash(seed + i * 3)), x = p.x + Math.cos(a) * v * u, y = p.y + Math.sin(a) * v * u + Wpx * 14 * u * u;
    const s = Wpx * (0.45 + 0.35 * hash(i + seed * 2));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(u * 7 * (hash(i) - 0.5) + i);
    ctx.beginPath();
    ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, -s * 0.1); ctx.lineTo(s * 0.2, s * 0.8); ctx.lineTo(-s * 0.6, s * 0.3);
    ctx.closePath();
    ctx.fillStyle = '#e4f6ff';
    ctx.fill();
    ctx.lineWidth = Math.max(1, Wpx * 0.14);
    ctx.strokeStyle = RIM;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

export function drawSnakes(ctx, sim, t, k) {
  const heads = [];
  for (const S of sim.snakes || []) {
    if (S.gone) continue;
    let A = snAnim[S.id];
    if (!A || A.sim !== sim || t < A.t - 0.5) A = snAnim[S.id] = { sim, t, slack: 0, blk: 0, at: t, drift: 0, shake: 0, seed: S.id * 3.7, odo: S.odo || 0 };
    A.dt = Math.min(0.1, Math.max(0, t - A.t));
    A.t = t;
    // slithering in (presentation): the last ENTER_T s of the first wait, eased from fast to its own speed
    const entering = S.pts.length < 2 && (S.inside || S.wait < ENTER_T);
    if (S.pts.length < 2 && !entering) continue;
    if (entering) { const w = Math.max(0, S.wait); A.enter = S.speed * w + ENTER_C * w * w; }
    const iced = S.stun > 0 && S.hurt === 'ice';
    if (iced && !A.iced) { A.iced = true; A.ice0 = t; A.f = { ...FACE.frozen, tongue: 0 }; A.ex = 'frozen'; A.blinkT = 0; A.tasteT = 0; }
    if (!iced && A.iced) { A.iced = false; A.thaw0 = t; }
    const thawK = A.thaw0 !== undefined ? (t - A.thaw0) / 0.7 : 9;
    // the animation clock stops while frozen: every motion holds its pose
    if (!iced) A.at += A.dt;
    const at = A.at;
    A.blk += (S.blocked - A.blk) * Math.min(1, A.dt * 2.5);
    const dizzy = !iced && (S.stun > 0 && S.hurt !== 'burn' || S.daze > 0);
    if (!iced) A.slack += ((dizzy ? 1 : 0) - A.slack) * Math.min(1, A.dt * 4);
    const dOdo = Math.abs((S.odo || 0) - A.odo); A.odo = S.odo || 0;
    if (!iced) A.drift += A.dt * (dOdo > 1e-4 || entering ? 0.5 : 0.08) * 1.35;
    A.shake = thawK < 1 ? Math.max(0, 1 - Math.max(0, thawK - 0.15) / 0.6) : 0;
    const path = serpentPath(sim, S, A, at);
    if (path.length < 2) continue;
    // where it looks: toward its prey when close, a slow look-around while it waits
    const h = path[0], egg = S.tgt && sim.eggs.find((e) => e.id === S.tgt && e.alive && e.body);
    let look = 0;
    const bx = path[0].x - path[Math.min(path.length - 1, 6)].x, by = path[0].y - path[Math.min(path.length - 1, 6)].y;
    const sp = sim.spitPhase && sim.spitPhase(S);
    const rv = S.rival > 0 && sim.sals && sim.sals.find((c) => c.id === S.rivalId && c.pts.length);
    if (iced) look = A.lookW || 0;
    else if (rv) { const q = rv.pts[0]; look = clamp(lerpA(0, Math.atan2(q.y - h.y, q.x - h.x) - Math.atan2(by, bx), 1), -1.1, 1.1); }
    else if (sp) { const q = sim.venomPt(S); look = clamp(lerpA(0, Math.atan2(q.y - h.y, q.x - h.x) - Math.atan2(by, bx), 1), -1.1, 1.1); }
    else if (egg && !(S.stun > 0) && S.flee < 0) {
      const p = egg.body.getPosition(), d = Math.hypot(p.x - h.x, p.y - h.y), lim = S.strike > 0 || S.lunge > 0 ? 1.1 : 0.5;
      look = clamp(lerpA(0, Math.atan2(p.y - h.y, p.x - h.x) - Math.atan2(by, bx), 1), -lim, lim) * clamp(1.4 - d / 3, 0.2, 1);
    }
    if (!iced && (S.wait > 0 && S.inside || S.blocked)) look += 0.35 * Math.sin(at * 0.8 + S.id * 2.1) ** 3;
    A.lookW = look;
    A.look = -look; // y-down px space
    if (!iced) snakeHeadAnim(A, snakeWant(S, A, sim), A.dt, at);
    else A.dt = 0;
    // zapped: 0.3 s of arcs and flash when a bolt stun starts
    if (S.hurt === 'bolt' && S.stun > (A.stun0 || 0) + 0.05) A.zap0 = t;
    A.stun0 = S.stun;
    const zap = A.zap0 !== undefined ? clamp01(1 - (t - A.zap0) / 0.3) : 0;
    const sk = sim.spitK(S), idle = S.wait > 0 || S.blocked || S.spit || S.stun > 0 ? 1 : 0;
    let alpha = S.flee > 0.4 ? clamp01(1 - (S.flee - 0.4) / 0.45) : 1; // gone before the vault bursts
    if (entering) alpha = clamp01((ENTER_T - Math.max(0, S.wait)) / 0.3);
    const shiver = iced && S.stun < 1 ? Math.sin(t * 70) * 0.6 * (1 - S.stun) : 0;
    const pxs = path.map((q) => ({ x: q.x * k + shiver, y: -q.y * k }));
    const r = 0.1 * Math.pow(S.size || 1, 0.6) * k;
    const o = { id: S.id, thick: 1.16, head: 5.4, wave: 0, skin: S.skin, kind: S.kind, anim: A,
      breath: 1 + 0.045 * idle * Math.sin(at * 2.3 + S.id), crown: sim.level.boss === 'snake' && S.size > 1.2,
      venom: sk > 0 && sk < 0.25 ? sk / 0.25 : sp && sp.fly < 0 ? sp.rear : 0,
      flash: zap > 0 ? (Math.sin(t * 60) > 0 ? 0.85 : 0.35) * zap : 0,
      frozen: iced ? clamp01((t - A.ice0) / 0.2) : 0,
      ice: !iced && thawK < 1 ? clamp01(1 - thawK / 0.45) : 0,
      crack: iced ? clamp01(1 - S.stun) : 0, droop: A.slack, stars: dizzy && zap <= 0 ? clamp01(A.slack * 1.5) : 0, shake: A.shake };
    const draw = (part) => { ctx.save(); ctx.globalAlpha = alpha; pxSpace(ctx, 0, 0, k, () => drawSnake(ctx, pxs, r, at, { ...o, part })); ctx.restore(); };
    draw('body');
    if (zap > 0) pxSpace(ctx, 0, 0, k, () => zapArcs(ctx, pxs, r * 2.2, t, 1));
    heads.push(draw);
    if (thawK < 1) { const W = r * 2.2; heads.push(() => pxSpace(ctx, 0, 0, k, () => thawShards(ctx, pxs, clamp01(thawK), W, S.id * 5 + 1))); }
    // the venom blob in flight
    if (sk >= 0.25 && sk < 0.36) {
      const b = sim.barriers[S.spit.b], q = sim.barrierPoint(b, 0.4), u = (sk - 0.25) / 0.11, hh = S.pts[0];
      const x = hh.x + (q.x - hh.x) * u, y = hh.y + (q.y - hh.y) * u + Math.sin(u * Math.PI) * 0.25;
      pxSpace(ctx, x, y, k, () => drawVenom(ctx, 0, 0, 0.1 * k, t, 1));
    }
    // a spitter's glob arcing at the wall, with a dripping trail
    if (sp && sp.fly >= 0 && sp.fly < 1) {
      const q = sim.venomPt(S), bl = Math.hypot(bx, by) || 1, fx = bx / bl, fy = by / bl;
      heads.push(() => {
        const hx = A.mouthX !== undefined ? A.mouthX / k : path[0].x + fx * 0.4, hy = A.mouthY !== undefined ? -A.mouthY / k : path[0].y + fy * 0.4;
        for (let j = 4; j >= 0; j--) {
          const u = Math.max(0, sp.fly - j * 0.07), b = Math.sin(u * Math.PI) * 0.5;
          pxSpace(ctx, hx + (q.x - hx) * u + fx * b, hy + (q.y - hy) * u + fy * b, k, () => drawVenom(ctx, 0, 0, 0.12 * k * (1 - j * 0.14), t, j ? 0.55 - j * 0.1 : 1));
        }
      });
    }
  }
  for (const f of heads) f('head');
}
