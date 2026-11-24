// The celebration kit (0.8.15): one set of effects for every moment the game gives something (the win's stars, the boss
// treasure, a free try, the win streak's boosters). mykee 2026-11-24: "the screen spends very less time on the stars ...
// make sure we have a proper cool celebratory animation on the gifts and unlockables".
// Everything here is a pure picture of a moment: (ctx, where, how far along). Nothing keeps particles alive between
// frames (confetti is worked out from its age), so a tap can jump any effect to any time, and there is nothing to clean
// up but the one small glow picture (releaseCelebrate). Cheap on purpose: plain paths, flat fills, no shadowBlur, no
// gradient made per frame; Low graphics draws half the pieces.
import { PERF } from '../perf.js';
import { freeCanvas } from './cvfree.js';

const TAU = Math.PI * 2;
const c01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const hash = (i, s) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
const INK = '#3d2410';
export const easeOut = (k) => 1 - (1 - c01(k)) ** 3;
export const smooth = (k) => { const x = c01(k); return x * x * (3 - 2 * x); };
export const backOut = (k) => { const x = c01(k); return x <= 0 ? 0 : 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2; };
// a count that rolls up to n (k 0..1)
export const rollTo = (n, k) => Math.round(n * easeOut(k));

// ---- the warm glow behind a prize: one small picture, made once, stretched to any size
let GLOW = null;
function glowCv() {
  if (GLOW && GLOW.width > 1) return GLOW;
  if (typeof document === 'undefined') return null;
  const S = 96, cv = Object.assign(document.createElement('canvas'), { width: S, height: S }), c = cv.getContext('2d');
  const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,224,130,1)'); g.addColorStop(0.45, 'rgba(255,214,110,0.5)'); g.addColorStop(1, 'rgba(255,214,110,0)');
  c.fillStyle = g; c.fillRect(0, 0, S, S);
  return (GLOW = cv);
}
export function glow(ctx, cx, cy, R, a = 1) {
  const cv = glowCv();
  if (!cv || a <= 0.005) return;
  const ga = ctx.globalAlpha;
  ctx.globalAlpha = ga * Math.min(1, a);
  ctx.drawImage(cv, cx - R, cy - R, 2 * R, 2 * R);
  ctx.globalAlpha = ga;
}
// the celebration is over: the glow picture goes back to the phone
export function releaseCelebrate() { if (GLOW) { freeCanvas(GLOW); GLOW = null; } }

// ---- rays: wedges round a centre, turned by rot (one path, one fill)
export function rays(ctx, cx, cy, R, rot, col, n = 12, wide = 0.55) {
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.fillStyle = col;
  ctx.beginPath();
  const d = (Math.PI / n) * wide;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - d) * R, Math.sin(a - d) * R); ctx.lineTo(Math.cos(a + d) * R, Math.sin(a + d) * R); ctx.closePath();
  }
  ctx.fill();
  ctx.restore();
}

// a four-point glint
export function glint(ctx, x, y, g, col = '#fff6c8') {
  if (g <= 0.3) return;
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(x, y - g); ctx.quadraticCurveTo(x, y, x + g, y); ctx.quadraticCurveTo(x, y, x, y + g); ctx.quadraticCurveTo(x, y, x - g, y); ctx.quadraticCurveTo(x, y, x, y - g); ctx.fill();
}

// ---- the burst of light as something opens or lands (a 0..1): a white heart, spikes that shoot out, a ring
export function burst(ctx, cx, cy, R, a, col = '#fff6c8') {
  if (a <= 0 || a >= 1) return;
  const e = easeOut(a), n = PERF.low ? 8 : 12;
  ctx.save();
  ctx.translate(cx, cy);
  const A0 = ctx.globalAlpha;
  if (a < 0.45) { // the white heart: gone in the first half
    const h = 1 - a / 0.45;
    ctx.globalAlpha = A0 * h * h; ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 0, R * (0.25 + 0.45 * e), 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = A0 * (1 - a);
  ctx.fillStyle = col;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const q = (i / n) * TAU + 0.3, r0 = R * (0.2 + 0.5 * e), r1 = R * (0.55 + (i % 2 ? 0.75 : 1.15) * e), d = 0.05 * (1 - a) + 0.012;
    ctx.moveTo(Math.cos(q - d) * r0, Math.sin(q - d) * r0); ctx.lineTo(Math.cos(q) * r1, Math.sin(q) * r1); ctx.lineTo(Math.cos(q + d) * r0, Math.sin(q + d) * r0); ctx.closePath();
  }
  ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, R * 0.11 * (1 - a));
  ctx.beginPath(); ctx.arc(0, 0, R * (0.3 + 0.95 * e), 0, TAU); ctx.stroke();
  ctx.restore();
}

// a ring and a few dots where something lands (a 0..1)
export function landFlash(ctx, x, y, R, a, col = '#fff3b0') {
  if (a <= 0 || a >= 1) return;
  ctx.save();
  ctx.globalAlpha *= 1 - a;
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, R * 0.16 * (1 - a));
  ctx.beginPath(); ctx.arc(x, y, R * (0.4 + 0.8 * Math.sqrt(a)), 0, TAU); ctx.stroke();
  ctx.fillStyle = '#ffd94a';
  for (let i = 0; i < 6; i++) { const q = i * 1.047 + 0.4, r = R * (0.5 + 0.9 * a); ctx.beginPath(); ctx.arc(x + Math.cos(q) * r, y + Math.sin(q) * r, R * 0.1 * (1 - a) + 0.5, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// small diamonds thrown out of a point (a 0..1), palette colours
const SPARK_COL = ['#ffd23f', '#ff7a9a', '#46b83d', '#5a8dee', '#e57d12', '#ffffff', '#ffd23f', '#ff7a9a', '#7fe0c4', '#ffffff'];
export function sparks(ctx, cx, cy, r, a, n = 8, seed = 0) {
  if (a <= 0 || a >= 1) return;
  ctx.save();
  ctx.globalAlpha *= 1 - a;
  for (let i = 0; i < n; i++) {
    const q = (i / n) * TAU + seed, d = r * (1 + (1.1 + 0.3 * (i % 2)) * Math.sqrt(a)), sz = r * 0.19 * (1 - a * 0.6);
    ctx.save(); ctx.translate(cx + Math.cos(q) * d, cy + Math.sin(q) * d + r * 0.5 * a * a); ctx.rotate(q + a * 3);
    ctx.fillStyle = SPARK_COL[i % SPARK_COL.length]; ctx.beginPath(); ctx.moveTo(0, -sz); ctx.lineTo(sz * 0.6, 0); ctx.lineTo(0, sz); ctx.lineTo(-sz * 0.6, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// ---- confetti: a burst thrown from a point, t seconds ago. Each piece flies out, slows, tumbles and falls.
// o: { n, speed (px/s), g (px/s2), life (s), seed, size (px), dir (rad, -PI/2 = up), spread (rad) }
const CONF_COL = ['#ffd23f', '#ff5e7a', '#46b83d', '#4f9bf0', '#ff8a1f', '#ffffff', '#b06cf0', '#35c9c0'];
export function confetti(ctx, cx, cy, t, o = {}) {
  const life = o.life || 1.8;
  if (t <= 0 || t >= life) return;
  const n = Math.ceil((o.n || 40) * (PERF.low ? 0.5 : 1)), sp = o.speed || 400, g = o.g || 500, seed = o.seed || 1, size = o.size || 8;
  const dir = o.dir != null ? o.dir : -Math.PI / 2, spread = o.spread != null ? o.spread : TAU, f = (1 - Math.exp(-2.4 * t)) / 2.4;
  ctx.save();
  const A0 = ctx.globalAlpha;
  for (let i = 0; i < n; i++) {
    const h1 = hash(i, seed), h2 = hash(i + 0.5, seed * 1.7), h3 = hash(i, seed + 9.1);
    const lf = life * (0.7 + 0.3 * h3), al = Math.min(1, (lf - t) / 0.3);
    if (al <= 0) continue;
    const q = dir + (h1 - 0.5) * spread, v = sp * (0.4 + 0.6 * h2), s = size * (0.7 + 0.6 * h3);
    const x = cx + Math.cos(q) * v * f + Math.sin(t * 5 + i) * s * 0.8, y = cy + Math.sin(q) * v * f + 0.5 * g * t * t * (0.6 + 0.5 * h2);
    ctx.globalAlpha = A0 * al;
    ctx.fillStyle = CONF_COL[i % CONF_COL.length];
    ctx.save(); ctx.translate(x, y); ctx.rotate(h1 * TAU + t * (3 + 5 * h2)); ctx.scale(1, Math.cos(t * (7 + 6 * h3) + i));
    if (i % 5 === 4) ctx.fillRect(-s * 1.1, -s * 0.16, s * 2.2, s * 0.32); // a streamer
    else ctx.fillRect(-s * 0.5, -s * 0.32, s, s * 0.64);
    ctx.restore();
  }
  ctx.restore();
}

// ---- a ring of glints round a hero: they turn slowly and twinkle (still when t is held)
export function sparkleRing(ctx, cx, cy, rx, ry, t, n = 10, size = 8) {
  const m = PERF.low ? Math.ceil(n / 2) : n;
  for (let i = 0; i < m; i++) {
    const q = (i / m) * TAU + t * 0.5, tw = 0.55 + 0.45 * Math.sin(t * 3.2 + i * 1.9), k = 1 + 0.08 * Math.sin(i * 2.3);
    glint(ctx, cx + Math.cos(q) * rx * k, cy + Math.sin(q) * ry * k, size * tw * (i % 2 ? 1 : 0.65), i % 3 ? '#fff6c8' : '#ffffff');
  }
}

// ---- a spotlight from above onto a hero: a soft cone and a pool of light at its feet (a 0..1)
export function spotlight(ctx, cx, y0, y1, w0, w1, a = 1) {
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.fillStyle = 'rgba(255,244,200,0.10)';
  for (const k of [1, 0.62]) { ctx.beginPath(); ctx.moveTo(cx - w0 * k, y0); ctx.lineTo(cx + w0 * k, y0); ctx.lineTo(cx + w1 * k, y1); ctx.lineTo(cx - w1 * k, y1); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,240,180,0.22)';
  ctx.beginPath(); ctx.ellipse(cx, y1, w1, w1 * 0.2, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---- a point on a curved path from (x0, y0) to (x1, y1): lift bends it up, side bends it sideways (k 0..1)
export function arcPt(x0, y0, x1, y1, k, lift = 0, side = 0) {
  const mx = (x0 + x1) / 2 + side, my = (y0 + y1) / 2 - lift, u = 1 - k;
  return [u * u * x0 + 2 * u * k * mx + k * k * x1, u * u * y0 + 2 * u * k * my + k * k * y1];
}

// ---- the gift box (a free try arrives in it): body and lid apart, so the lid can fly.
// centre (cx, cy), s = its width; o: { lidX, lidY (px), lidRot, lidA, bodyA }
export function giftBox(ctx, cx, cy, s, o = {}) {
  const lw = s * 0.035, body = '#3f9be8', bodyD = '#2c7ccb', lidC = '#62b8f8', gold = '#ffd23f', goldD = '#e0a312';
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineJoin = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = INK;
  const A0 = ctx.globalAlpha, ba = o.bodyA == null ? 1 : o.bodyA, la = o.lidA == null ? 1 : o.lidA;
  if (ba > 0.01) { // the body: a box with a ribbon down the middle
    ctx.globalAlpha = A0 * ba;
    const w = s * 0.78, h = s * 0.5, y = -s * 0.1;
    ctx.fillStyle = body; ctx.beginPath(); ctx.rect(-w / 2, y, w, h); ctx.fill();
    ctx.fillStyle = bodyD; ctx.fillRect(-w / 2, y + h * 0.72, w, h * 0.28);
    ctx.fillStyle = 'rgba(10,40,90,0.28)'; ctx.fillRect(-w / 2, y, w, h * 0.14); // the lid's shade
    ctx.fillStyle = gold; ctx.fillRect(-s * 0.08, y, s * 0.16, h);
    ctx.fillStyle = goldD; ctx.fillRect(-s * 0.08, y + h * 0.72, s * 0.16, h * 0.28);
    ctx.beginPath(); ctx.rect(-s * 0.08, y, s * 0.16, h); ctx.stroke();
    ctx.beginPath(); ctx.rect(-w / 2, y, w, h); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(-w / 2 + lw * 1.6, y + h * 0.2, lw * 1.4, h * 0.4);
  }
  if (la > 0.01) { // the lid: wider than the box, a bow on top
    ctx.globalAlpha = A0 * la;
    ctx.translate(o.lidX || 0, -s * 0.19 + (o.lidY || 0)); ctx.rotate(o.lidRot || 0);
    const w = s * 0.9, h = s * 0.18;
    for (const d of [-1, 1]) { // the bow's loops
      ctx.fillStyle = gold;
      ctx.beginPath(); ctx.moveTo(0, -h / 2); ctx.bezierCurveTo(d * s * 0.1, -h / 2 - s * 0.3, d * s * 0.36, -h / 2 - s * 0.22, d * s * 0.26, -h / 2 - s * 0.06); ctx.bezierCurveTo(d * s * 0.2, -h / 2, d * s * 0.08, -h / 2, 0, -h / 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = goldD;
      ctx.beginPath(); ctx.ellipse(d * s * 0.17, -h / 2 - s * 0.12, s * 0.05, s * 0.03, d * -0.7, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = lidC; ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.fill();
    ctx.fillStyle = gold; ctx.fillRect(-s * 0.09, -h / 2, s * 0.18, h);
    ctx.beginPath(); ctx.rect(-s * 0.09, -h / 2, s * 0.18, h); ctx.stroke();
    ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-w / 2 + lw * 1.6, -h / 2 + lw * 1.3, w * 0.3, lw * 1.2);
    ctx.fillStyle = gold; ctx.beginPath(); ctx.arc(0, -h / 2 - s * 0.02, s * 0.06, 0, TAU); ctx.fill(); ctx.stroke(); // the knot
  }
  ctx.restore();
}

// ---- the treasure chest's lid, drawn over the closed chest (ui/store.js drawChest, 'ready', same place and size) so it
// can rattle before it opens: lift (0..~0.1 of the chest's size) shows a line of light under it, rot tips it.
export function chestLid(ctx, cx, cy, s, lift = 0, rot = 0) {
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(s, s);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (lift > 0.002) { ctx.fillStyle = '#fff6b8'; ctx.fillRect(-0.47, -lift - 0.07, 0.94, lift + 0.085); } // the light inside
  ctx.translate(0, -lift); ctx.rotate(rot);
  const lid = () => { ctx.beginPath(); ctx.moveTo(-0.5, 0); ctx.quadraticCurveTo(-0.5, -0.42, 0, -0.42); ctx.quadraticCurveTo(0.5, -0.42, 0.5, 0); ctx.closePath(); };
  const grad = (y0, y1, a, b) => { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
  lid(); ctx.fillStyle = grad(-0.42, 0, '#c4813f', '#7f4c1f'); ctx.fill();
  ctx.lineWidth = 0.04; ctx.strokeStyle = INK; ctx.stroke();
  ctx.save(); lid(); ctx.clip();
  ctx.fillStyle = grad(-0.42, 0, '#ffe27a', '#c98a10'); ctx.lineWidth = 0.02;
  for (const bx of [-0.34, 0.34]) { ctx.fillRect(bx - 0.05, -0.45, 0.1, 0.46); ctx.strokeRect(bx - 0.05, -0.45, 0.1, 0.46); }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.025;
  ctx.beginPath(); ctx.moveTo(-0.2, -0.3); ctx.quadraticCurveTo(-0.1, -0.37, 0.05, -0.37); ctx.stroke();
  // the lock hangs from the lid
  ctx.fillStyle = '#f0c040'; ctx.fillRect(-0.09, -0.08, 0.18, 0.2);
  ctx.lineWidth = 0.025; ctx.strokeStyle = INK; ctx.strokeRect(-0.09, -0.08, 0.18, 0.2);
  ctx.fillStyle = '#5a3200'; ctx.beginPath(); ctx.arc(0, 0.01, 0.028, 0, TAU); ctx.fill(); ctx.fillRect(-0.012, 0.01, 0.024, 0.06);
  ctx.restore();
}

// ---- the bag: where boosters and charges go. A cloth sack with a tie; bump (0..1) squashes it as something lands in it.
export function bag(ctx, x, y, s, bump = 0) {
  ctx.save();
  ctx.translate(x, y + s * 0.5); ctx.scale(1 + 0.14 * bump, 1 - 0.12 * bump); ctx.translate(0, -s * 0.5);
  ctx.lineJoin = 'round'; ctx.lineWidth = s * 0.06; ctx.strokeStyle = INK;
  // the open mouth behind
  ctx.fillStyle = '#6e4420'; ctx.beginPath(); ctx.ellipse(0, -s * 0.3, s * 0.3, s * 0.11, 0, 0, TAU); ctx.fill(); ctx.stroke();
  // the sack
  ctx.fillStyle = '#d9a05a';
  ctx.beginPath(); ctx.moveTo(-s * 0.28, -s * 0.27);
  ctx.bezierCurveTo(-s * 0.2, -s * 0.12, -s * 0.56, s * 0.1, -s * 0.46, s * 0.36);
  ctx.bezierCurveTo(-s * 0.4, s * 0.52, s * 0.4, s * 0.52, s * 0.46, s * 0.36);
  ctx.bezierCurveTo(s * 0.56, s * 0.1, s * 0.2, -s * 0.12, s * 0.28, -s * 0.27);
  ctx.quadraticCurveTo(0, -s * 0.17, -s * 0.28, -s * 0.27); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(120,70,20,0.3)'; ctx.beginPath(); ctx.ellipse(s * 0.1, s * 0.3, s * 0.3, s * 0.13, -0.2, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.ellipse(-s * 0.22, s * 0.08, s * 0.06, s * 0.14, 0.4, 0, TAU); ctx.fill();
  // the tie
  ctx.strokeStyle = '#e4572a'; ctx.lineWidth = s * 0.07; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-s * 0.25, -s * 0.13); ctx.quadraticCurveTo(0, -s * 0.05, s * 0.25, -s * 0.13); ctx.stroke();
  ctx.restore();
}
