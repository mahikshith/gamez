// The Lucky Spin's wheel (0.8.15). A painted fairground wheel on a wooden stand, with a leather flapper at the top and
// a lever at its side. What it shows is what spin.js rolls: every slice is exactly as wide as its odds, and the
// amounts painted on it are the real ones for this point of the game. Nothing here decides anything: main.js asks
// spin.js for the result first and this file only turns the wheel to it.
//
// The wheel face is painted once into a picture of its own and turned as a whole (ten slices with their icons every
// frame would cost an old phone its frame rate); releaseWheel() gives the picture back when the page is left.
import { FONT } from '../ui/ui.js';
import { drawCoin, drawBoosterIcon, drawSkinPreview, drawItemArt, drawPart } from '../ui/store.js';
import { freeCanvas } from './cvfree.js';

const TAU = Math.PI * 2;
export const SLICE_COL = { c1: ['#ffe27a', '#ffc21f'], b1: ['#8fd6ff', '#3fa4ea'], cp: ['#b99bff', '#7a48e8'], c2: ['#ffd070', '#ffa51f'], ch: ['#8ff0e0', '#22b8a8'], sh: ['#c8ec80', '#7cba2c'], b2: ['#7fb4ff', '#2f74dc'], c3: ['#ffb070', '#f47a1a'], sk: ['#ff9db0', '#e8486a'], rare: ['#7a5ad0', '#33206e'] };
const WOOD = ['#b9793a', '#8a5426', '#4a2a10'];

// ---- the prize pictures (also used by the odds sheet and the prize reveal)
// a half-price ticket: a purple stub with a notch at each side and "-50%"
export function drawTicket(ctx, cx, cy, s) {
  const w = s * 0.92, h = s * 0.54, r = h * 0.16, n = h * 0.17;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.14);
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(-w / 2 + r, -h / 2); ctx.lineTo(w / 2 - r, -h / 2); ctx.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    ctx.lineTo(w / 2, -n); ctx.arc(w / 2, 0, n, -Math.PI / 2, Math.PI / 2, true); ctx.lineTo(w / 2, h / 2 - r);
    ctx.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); ctx.lineTo(-w / 2 + r, h / 2); ctx.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    ctx.lineTo(-w / 2, n); ctx.arc(-w / 2, 0, n, Math.PI / 2, -Math.PI / 2, true); ctx.lineTo(-w / 2, -h / 2 + r);
    ctx.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2); ctx.closePath();
  };
  ctx.fillStyle = 'rgba(30,10,60,0.35)'; ctx.translate(0, s * 0.03); path(); ctx.fill(); ctx.translate(0, -s * 0.03);
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#a582ff'); g.addColorStop(1, '#6a38d8');
  path(); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = Math.max(1, s * 0.035); ctx.strokeStyle = '#2c1260'; ctx.stroke();
  ctx.setLineDash([s * 0.035, s * 0.035]); ctx.lineWidth = Math.max(0.8, s * 0.016); ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.moveTo(-w * 0.27, -h * 0.36); ctx.lineTo(-w * 0.27, h * 0.36); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = `600 ${Math.max(5, h * 0.5)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(1.5, s * 0.05); ctx.strokeStyle = '#2c1260'; ctx.lineJoin = 'round'; ctx.strokeText('-50%', w * 0.1, h * 0.03);
  ctx.fillStyle = '#fff6c8'; ctx.fillText('-50%', w * 0.1, h * 0.03);
  ctx.restore();
}
// a small round "?" (which booster, which bird: the roll says)
function qMark(ctx, x, y, r) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = '#fff6c8'; ctx.fill(); ctx.lineWidth = Math.max(1, r * 0.22); ctx.strokeStyle = '#4a2a10'; ctx.stroke();
  ctx.font = `600 ${r * 1.5}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#4a2a10'; ctx.fillText('?', x, y + r * 0.08);
  ctx.restore();
}
function sparkle(ctx, x, y, r, a = 1) {
  ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = '#fff8d0';
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r); ctx.fill();
  ctx.restore();
}
// the picture of one slice's prize, about s across. sl: { id, kind, n }
export function drawSliceIcon(ctx, sl, cx, cy, s, t = 0) {
  if (sl.kind === 'coins') {
    if (sl.id === 'c1') drawCoin(ctx, cx, cy, s * 0.36, t);
    else if (sl.id === 'c2') { drawCoin(ctx, cx - s * 0.16, cy + s * 0.05, s * 0.3, t); drawCoin(ctx, cx + s * 0.16, cy - s * 0.03, s * 0.32, t); }
    else drawPart(ctx, 'coins', cx, cy, s * 1.05, t);
  } else if (sl.kind === 'booster') {
    if (sl.n > 1) { drawBoosterIcon(ctx, 'stone', cx - s * 0.17, cy + s * 0.02, s * 0.62, t); drawBoosterIcon(ctx, 'golden', cx + s * 0.17, cy - s * 0.02, s * 0.66, t); } else drawBoosterIcon(ctx, 'time', cx, cy, s * 0.8, t);
    qMark(ctx, cx + s * 0.34, cy - s * 0.3, s * 0.17);
  } else if (sl.kind === 'coupon') drawTicket(ctx, cx, cy, s * 1.05);
  else if (sl.kind === 'charge') drawPart(ctx, 'charge', cx, cy, s * 1.1, t);
  else if (sl.kind === 'scare') drawBoosterIcon(ctx, 'scare', cx, cy, s * 0.9, t);
  else if (sl.kind === 'skip') drawItemArt(ctx, 'skip', cx, cy, s * 1.1, t);
  else { // the rare bird: a golden egg that shines, with a "?"
    drawSkinPreview(ctx, 'golden', cx, cy + s * 0.02, s * 0.74, t);
    sparkle(ctx, cx - s * 0.34, cy - s * 0.22, s * 0.13, 0.6 + 0.4 * Math.sin(t * 3)); sparkle(ctx, cx + s * 0.3, cy + s * 0.26, s * 0.1, 0.6 + 0.4 * Math.sin(t * 3 + 2));
    qMark(ctx, cx + s * 0.32, cy - s * 0.3, s * 0.16);
  }
}

// ---- the wheel face, painted once
let CACHE = null; // { key, cv, R (css px), m (margin, css px) }
export function releaseWheel() { if (CACHE) { freeCanvas(CACHE.cv); CACHE = null; } }
const tone = (ctx, R, a, b) => { const g = ctx.createRadialGradient(0, 0, R * 0.18, 0, 0, R); g.addColorStop(0, a); g.addColorStop(0.62, a); g.addColorStop(1, b); return g; };
function paintFace(ctx, R, slices) {
  const rim = R * 0.085, r1 = R - rim; // the painted face ends where the wooden rim begins
  // the slices: as wide as their odds, clockwise from the top
  for (const s of slices) {
    const a0 = -Math.PI / 2 + s.a0 * TAU, a1 = -Math.PI / 2 + s.a1 * TAU, C = SLICE_COL[s.id] || SLICE_COL.c1;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r1, a0, a1); ctx.closePath();
    ctx.fillStyle = tone(ctx, r1, C[0], C[1]); ctx.fill();
  }
  // a soft inner ring of light, so the face reads as one painted disc
  { const g = ctx.createRadialGradient(0, -r1 * 0.2, r1 * 0.1, 0, 0, r1); g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(0.7, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(60,20,0,0.16)'); ctx.beginPath(); ctx.arc(0, 0, r1, 0, TAU); ctx.fillStyle = g; ctx.fill(); }
  // the lines between them
  ctx.lineWidth = Math.max(1.5, R * 0.014); ctx.strokeStyle = '#fff3d0'; ctx.lineCap = 'round';
  for (const s of slices) { const a = -Math.PI / 2 + s.a0 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 0.2, Math.sin(a) * R * 0.2); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.stroke(); }
  // each prize: its picture near the rim (where the slice is widest), the amount under it, both standing upright when
  // the slice is at the top
  for (const s of slices) {
    const mid = (s.a0 + s.a1) / 2, arc = (s.a1 - s.a0) * TAU, big = arc > 0.5;
    const thin = arc < 0.34, rr = r1 * (big ? 0.66 : thin ? 0.8 : 0.74), room = 2 * rr * Math.sin(Math.min(arc, 1.2) / 2) * (thin ? 0.98 : 0.86), is = Math.min(room, r1 * 0.3); // a thin slice: its picture sits at the rim, where it is widest
    const label = s.kind === 'coins' ? String(s.n) : s.n > 1 ? 'x' + s.n : '';
    ctx.save(); ctx.rotate(mid * TAU); ctx.translate(0, -rr);
    drawSliceIcon(ctx, s, 0, label && big ? -is * 0.12 : 0, is, 0);
    if (label) {
      const fs = Math.max(7, Math.min(is * 0.5, r1 * 0.12)), ly = big ? is * 0.56 : is * 0.62 + fs * 0.25;
      ctx.font = `600 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2, fs * 0.28); ctx.strokeStyle = 'rgba(70,30,0,0.85)'; ctx.strokeText(label, 0, ly); ctx.fillStyle = '#fffbe8'; ctx.fillText(label, 0, ly);
    }
    ctx.restore();
  }
  // the wooden rim, with a brass peg on every line (the flapper ticks over them)
  ctx.beginPath(); ctx.arc(0, 0, R - rim / 2, 0, TAU); ctx.lineWidth = rim; ctx.strokeStyle = WOOD[1]; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, R - rim * 0.3, 0, TAU); ctx.lineWidth = rim * 0.28; ctx.strokeStyle = WOOD[0]; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, R - Math.max(1, R * 0.008), 0, TAU); ctx.lineWidth = Math.max(2, R * 0.02); ctx.strokeStyle = WOOD[2]; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r1, 0, TAU); ctx.lineWidth = Math.max(1.5, R * 0.014); ctx.strokeStyle = WOOD[2]; ctx.stroke();
  for (const s of slices) {
    const a = -Math.PI / 2 + s.a0 * TAU, x = Math.cos(a) * (R - rim / 2), y = Math.sin(a) * (R - rim / 2), pr = rim * 0.3;
    ctx.beginPath(); ctx.arc(x, y, pr, 0, TAU); ctx.fillStyle = '#ffd86a'; ctx.fill(); ctx.lineWidth = Math.max(1, pr * 0.3); ctx.strokeStyle = '#7a4a08'; ctx.stroke();
    ctx.beginPath(); ctx.arc(x - pr * 0.25, y - pr * 0.3, pr * 0.3, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill();
  }
}
function face(R, dpr, slices) {
  const key = `${Math.round(R * dpr)}|${dpr}|${slices.map((s) => s.id + ':' + s.n).join(',')}`;
  if (CACHE && CACHE.key === key) return CACHE;
  releaseWheel();
  const m = 2, px = Math.ceil((R + m) * 2 * dpr), cv = document.createElement('canvas');
  cv.width = px; cv.height = px;
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, px / 2, px / 2);
  paintFace(c, R, slices);
  return (CACHE = { key, cv, R, m });
}

// The whole wheel at (cx, cy): its shadow, the turning face, the hub and the flapper.
// slices: spin.js wheel() joined with slices() -> [{ id, kind, n, a0, a1 }]   ang: how far the face is turned (radians)
// o: { dpr, lit: the slice id that just won (it glows), litK: 0..1, flap: 0..1 how far the flapper is knocked aside, t }
export function drawWheel(ctx, cx, cy, R, ang, slices, o = {}) {
  const F = face(R, o.dpr || 1, slices), t = o.t || 0;
  ctx.save(); ctx.translate(cx, cy);
  // the shadow it throws on the board behind
  ctx.beginPath(); ctx.arc(R * 0.03, R * 0.05, R * 1.01, 0, TAU); ctx.fillStyle = 'rgba(20,6,30,0.32)'; ctx.fill();
  ctx.save(); ctx.rotate(ang); const d = (F.R + F.m) * 2; ctx.drawImage(F.cv, -d / 2, -d / 2, d, d);
  if (o.lit && o.litK > 0) { // the winning slice: a light that breathes over it
    const s = slices.find((q) => q.id === o.lit);
    if (s) { const a0 = -Math.PI / 2 + s.a0 * TAU, a1 = -Math.PI / 2 + s.a1 * TAU, r1 = R * 0.915; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r1, a0, a1); ctx.closePath(); ctx.fillStyle = `rgba(255,255,255,${(0.22 + 0.2 * Math.sin(t * 9)) * o.litK})`; ctx.fill(); ctx.lineWidth = Math.max(2, R * 0.025); ctx.strokeStyle = `rgba(255,246,200,${0.95 * o.litK})`; ctx.lineJoin = 'round'; ctx.stroke(); }
  }
  ctx.restore();
  // the hub: a brass boss with an egg on it (it does not turn, so the light on it stays put)
  const hr = R * 0.17;
  ctx.beginPath(); ctx.arc(0, hr * 0.08, hr * 1.06, 0, TAU); ctx.fillStyle = 'rgba(40,14,0,0.35)'; ctx.fill();
  const hg = ctx.createRadialGradient(-hr * 0.3, -hr * 0.35, hr * 0.1, 0, 0, hr); hg.addColorStop(0, '#fff0a8'); hg.addColorStop(0.55, '#ffc83a'); hg.addColorStop(1, '#d08a12');
  ctx.beginPath(); ctx.arc(0, 0, hr, 0, TAU); ctx.fillStyle = hg; ctx.fill(); ctx.lineWidth = Math.max(1.5, R * 0.016); ctx.strokeStyle = '#6a3c06'; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, hr * 0.03, hr * 0.42, hr * 0.54, 0, 0, TAU); ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.lineWidth = Math.max(1, R * 0.01); ctx.strokeStyle = '#6a3c06'; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-hr * 0.13, -hr * 0.16, hr * 0.1, hr * 0.16, -0.4, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
  // the flapper at the top: a red leather tongue on a brass pin, knocked to the side by each peg
  const fw = R * 0.1, fh = R * 0.2, fy = -R * 1.045;
  ctx.save(); ctx.translate(0, fy); ctx.rotate(-(o.flap || 0) * 0.6);
  ctx.beginPath(); ctx.moveTo(-fw, 0); ctx.quadraticCurveTo(-fw, fh * 0.55, 0, fh); ctx.quadraticCurveTo(fw, fh * 0.55, fw, 0); ctx.quadraticCurveTo(0, -fw * 0.9, -fw, 0); ctx.closePath();
  const fg = ctx.createLinearGradient(0, 0, 0, fh); fg.addColorStop(0, '#ff7a5a'); fg.addColorStop(1, '#d8341c'); ctx.fillStyle = fg; ctx.fill(); ctx.lineWidth = Math.max(1.5, R * 0.016); ctx.strokeStyle = '#5a1206'; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, fw * 0.1, fw * 0.36, 0, TAU); ctx.fillStyle = '#ffd86a'; ctx.fill(); ctx.lineWidth = Math.max(1, R * 0.01); ctx.strokeStyle = '#7a4a08'; ctx.stroke();
  ctx.restore();
  ctx.restore();
}

// The wooden stand behind the wheel: a post from the hub down to two feet. (x, y): the hub. floor: the ground line.
export function drawStand(ctx, cx, cy, R, floor) {
  const w = R * 0.2, bw = R * 1.3, bh = Math.max(6, R * 0.1);
  ctx.save();
  ctx.beginPath(); ctx.ellipse(cx, floor + bh * 0.2, bw * 0.62, bh * 0.9, 0, 0, TAU); ctx.fillStyle = 'rgba(20,6,30,0.3)'; ctx.fill();
  const leg = (dir) => { ctx.beginPath(); ctx.moveTo(cx + dir * w * 0.2, cy + R * 0.5); ctx.lineTo(cx + dir * bw * 0.5, floor); ctx.lineTo(cx + dir * (bw * 0.5 - w * 0.9), floor); ctx.lineTo(cx - dir * w * 0.3, cy + R * 0.3); ctx.closePath(); ctx.fillStyle = WOOD[1]; ctx.fill(); ctx.lineWidth = Math.max(1.5, R * 0.016); ctx.strokeStyle = WOOD[2]; ctx.lineJoin = 'round'; ctx.stroke(); };
  leg(-1); leg(1);
  const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0); g.addColorStop(0, WOOD[0]); g.addColorStop(1, WOOD[1]);
  ctx.beginPath(); ctx.rect(cx - w / 2, cy, w, floor - cy); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = Math.max(1.5, R * 0.016); ctx.strokeStyle = WOOD[2]; ctx.stroke();
  ctx.beginPath(); ctx.rect(cx - bw / 2, floor - bh, bw, bh); ctx.fillStyle = WOOD[0]; ctx.fill(); ctx.stroke();
  ctx.restore();
}

// The lever: a brass box with a slot and a stick with a red knob. (x, y): the pivot; h: the stick's length;
// k: 0 (up, ready) .. 1 (pulled all the way down).
export function drawLever(ctx, x, y, h, k = 0, ready = false, t = 0) {
  const a = -0.55 + 1.9 * k, bw = h * 0.5, bh = h * 0.42; // the stick swings from up-right down to low-right
  ctx.save(); ctx.translate(x, y);
  const g = ctx.createLinearGradient(0, -bh / 2, 0, bh / 2); g.addColorStop(0, '#ffd86a'); g.addColorStop(1, '#c8860e');
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-bw / 2, -bh * 0.35, bw, bh, bh * 0.22); else ctx.rect(-bw / 2, -bh * 0.35, bw, bh);
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = Math.max(1.5, h * 0.03); ctx.strokeStyle = '#6a3c06'; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, bh * 0.2, 0, TAU); ctx.fillStyle = '#6a3c06'; ctx.fill();
  ctx.rotate(a);
  ctx.lineCap = 'round'; ctx.lineWidth = h * 0.13; ctx.strokeStyle = '#4a2a10'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -h); ctx.stroke();
  ctx.lineWidth = h * 0.075; ctx.strokeStyle = '#e8e2d2'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -h); ctx.stroke();
  const kr = h * 0.2 * (ready ? 1 + 0.06 * Math.sin(t * 5) : 1), kg = ctx.createRadialGradient(-kr * 0.3, -h - kr * 0.3, kr * 0.1, 0, -h, kr); kg.addColorStop(0, '#ff9a80'); kg.addColorStop(1, '#d8341c');
  ctx.beginPath(); ctx.arc(0, -h, kr, 0, TAU); ctx.fillStyle = kg; ctx.fill(); ctx.lineWidth = Math.max(1.5, h * 0.03); ctx.strokeStyle = '#5a1206'; ctx.stroke();
  ctx.restore();
}
// a small wheel for a button: eight plain slices in the wheel's colours (no pictures: at 20 px they would be dots)
export function drawWheelIcon(ctx, cx, cy, r, ang = 0) {
  const cols = ['#ffc21f', '#3fa4ea', '#7a48e8', '#ffa51f', '#22b8a8', '#7cba2c', '#e8486a', '#f47a1a'];
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
  cols.forEach((c, i) => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r * 0.88, (i / 8) * TAU, ((i + 1) / 8) * TAU); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); });
  ctx.beginPath(); ctx.arc(0, 0, r * 0.92, 0, TAU); ctx.lineWidth = Math.max(1.5, r * 0.16); ctx.strokeStyle = WOOD[1]; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.lineWidth = Math.max(1, r * 0.07); ctx.strokeStyle = WOOD[2]; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.24, 0, TAU); ctx.fillStyle = '#ffd86a'; ctx.fill(); ctx.lineWidth = Math.max(1, r * 0.07); ctx.strokeStyle = '#6a3c06'; ctx.stroke();
  ctx.restore();
  ctx.beginPath(); ctx.moveTo(cx - r * 0.2, cy - r * 1.12); ctx.lineTo(cx + r * 0.2, cy - r * 1.12); ctx.lineTo(cx, cy - r * 0.72); ctx.closePath(); ctx.fillStyle = '#e8402e'; ctx.fill(); ctx.lineWidth = Math.max(1, r * 0.06); ctx.strokeStyle = '#5a1206'; ctx.lineJoin = 'round'; ctx.stroke();
}
