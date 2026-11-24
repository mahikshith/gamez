// The Lucky Spin's machine (0.8.15, mykee: "a three column turning slot machine like Jetpack Joyride uses, not this
// circular spin"). A red fairground cabinet with three reels, a lever at its side and the hen on its roof.
// Nothing here decides anything: main.js asks spin.js for the prize first (it is in the wallet and saved before a reel
// moves) and this file only turns the three reels onto that result's picture. Every pull ends on three of a kind:
// three of a prize win it, three villains take it (mykee, 12:41: "every spin doesn't win"). A mixed row is never
// shown, so there is no "two the same and the third just past" to tease anyone into another pull.
// The pictures are the game's own cast (mykee: "character pictures for powerups and villains"): the booster that is
// really being won, the player's own power chick for a Chick Charge, a villain he has already met.
//
// Each prize picture is painted once into a small picture of its own and the reels draw those (three reels of live
// icons every frame would cost an old phone its frame rate); releaseSlot() gives them back when the page is left.
import { FONT } from '../ui/ui.js';
import { drawCoin, drawBoosterIcon, drawSkinPreview, drawItemArt, drawPart } from '../ui/store.js';
import { drawStrikeToken } from './strike.js';
import { drawVillainPortrait } from './villain-art.js';
import { freeCanvas } from './cvfree.js';

const TAU = Math.PI * 2;
export const SLICE_COL = { c1: ['#ffe27a', '#ffc21f'], b1: ['#8fd6ff', '#3fa4ea'], cp: ['#b99bff', '#7a48e8'], c2: ['#ffd070', '#ffa51f'], ch: ['#8ff0e0', '#22b8a8'], sh: ['#c8ec80', '#7cba2c'], b2: ['#7fb4ff', '#2f74dc'], c3: ['#ffb070', '#f47a1a'], sk: ['#ff9db0', '#e8486a'], rare: ['#7a5ad0', '#33206e'], vil: ['#6a3a52', '#2a1226'] };
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
// a villain's card: a dark plate (night purple, a blood-red rim) with the creature on it, so a villain reads as "not a
// prize" on a running reel before anyone can tell which creature it is
const CARD_ZOOM = { weasel: 1.3, salamander: 1.35, chameleon: 1.25, rats: 1.25, gator: 1.2, hermit: 1.2, eagle: 1.15, spider: 1.1, frog: 1.1 }; // the long, low creatures are small in their portrait box
export function drawVillainCard(ctx, who, cx, cy, s, t = 0) {
  const r = s * 0.47;
  ctx.save();
  rr(ctx, cx - r, cy - r, r * 2, r * 2, r * 0.34);
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r); g.addColorStop(0, '#6e3460'); g.addColorStop(1, '#22102a'); ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  const gl = ctx.createRadialGradient(cx, cy + r * 0.1, r * 0.1, cx, cy, r * 1.2); gl.addColorStop(0, 'rgba(255,130,96,0.6)'); gl.addColorStop(1, 'rgba(255,90,60,0)'); ctx.fillStyle = gl; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  drawVillainPortrait(ctx, who || 'weasel', cx, cy, r * 2.05 * (CARD_ZOOM[who] || 1), t);
  ctx.restore();
  rr(ctx, cx - r, cy - r, r * 2, r * 2, r * 0.34); ctx.lineWidth = Math.max(1.5, s * 0.05); ctx.strokeStyle = '#e8402c'; ctx.stroke();
  rr(ctx, cx - r, cy - r, r * 2, r * 2, r * 0.34); ctx.lineWidth = Math.max(0.8, s * 0.018); ctx.strokeStyle = '#3a0a10'; ctx.stroke();
  ctx.restore();
}
// the picture of one row's prize, about s across. sl: { id, kind, n } and, when the caller knows them, the cast:
// item (which booster), chick (whose Chick Charge), who (which villain)
export function drawSliceIcon(ctx, sl, cx, cy, s, t = 0) {
  if (sl.kind === 'villain') drawVillainCard(ctx, sl.who, cx, cy, s, t);
  else if (sl.kind === 'coins') {
    if (sl.id === 'c1') drawCoin(ctx, cx, cy, s * 0.36, t);
    else if (sl.id === 'c2') { drawCoin(ctx, cx - s * 0.16, cy + s * 0.05, s * 0.3, t); drawCoin(ctx, cx + s * 0.16, cy - s * 0.03, s * 0.32, t); }
    else drawPart(ctx, 'coins', cx, cy, s * 1.05, t);
  } else if (sl.kind === 'booster' && sl.item) { // the booster itself, big (two of it for the double)
    if (sl.n > 1) { drawBoosterIcon(ctx, sl.item, cx - s * 0.15, cy - s * 0.04, s * 0.7, t); drawBoosterIcon(ctx, sl.item, cx + s * 0.15, cy + s * 0.04, s * 0.74, t); } else drawBoosterIcon(ctx, sl.item, cx, cy, s * 0.92, t);
  } else if (sl.kind === 'booster') {
    if (sl.n > 1) { drawBoosterIcon(ctx, 'stone', cx - s * 0.17, cy + s * 0.02, s * 0.62, t); drawBoosterIcon(ctx, 'golden', cx + s * 0.17, cy - s * 0.02, s * 0.66, t); } else drawBoosterIcon(ctx, 'time', cx, cy, s * 0.8, t);
    qMark(ctx, cx + s * 0.34, cy - s * 0.3, s * 0.17);
  } else if (sl.kind === 'coupon') drawTicket(ctx, cx, cy, s * 1.05);
  else if (sl.kind === 'charge') drawStrikeToken(ctx, sl.chick || 'freeze', cx, cy, s * 0.4, t, true);
  else if (sl.kind === 'scare') drawBoosterIcon(ctx, 'scare', cx, cy, s * 0.9, t);
  else if (sl.kind === 'skip') drawItemArt(ctx, 'skip', cx, cy, s * 1.1, t);
  else { // the rare bird: a golden egg that shines, with a "?"
    drawSkinPreview(ctx, 'golden', cx, cy + s * 0.02, s * 0.74, t);
    sparkle(ctx, cx - s * 0.34, cy - s * 0.22, s * 0.13, 0.6 + 0.4 * Math.sin(t * 3)); sparkle(ctx, cx + s * 0.3, cy + s * 0.26, s * 0.1, 0.6 + 0.4 * Math.sin(t * 3 + 2));
    qMark(ctx, cx + s * 0.32, cy - s * 0.3, s * 0.16);
  }
}


// ---- the reels
// Each reel carries the same ten prizes in an order of its own, so the three never run side by side in step.
const STEP = [1, 3, 7];
export const stripAt = (reel, k, n) => ((((k % n) + n) % n) * STEP[reel]) % n; // the prize index at place k of a reel
export function stripPos(reel, idx, n) { for (let k = 0; k < n; k++) if (stripAt(reel, k, n) === idx) return k; return 0; } // where a prize sits on a reel
const SYM = new Map(); // key -> canvas
export function releaseSlot() { for (const cv of SYM.values()) freeCanvas(cv); SYM.clear(); }
function symbol(sl, c, dpr) {
  const key = `${sl.id}:${sl.n}:${sl.item || sl.chick || sl.who || ''}|${Math.round(c * dpr)}`;
  let cv = SYM.get(key);
  if (cv) return cv;
  if (SYM.size > 60) releaseSlot(); // a resize, or many pulls with a new cast: the old pictures go
  const px = Math.ceil(c * dpr); cv = document.createElement('canvas'); cv.width = px; cv.height = px;
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const label = sl.kind === 'coins' ? String(sl.n) : sl.n > 1 ? 'x' + sl.n : '';
  drawSliceIcon(g, sl, c / 2, label ? c * 0.4 : c / 2, label ? c * 0.7 : sl.kind === 'villain' ? c * 0.98 : c * 0.84, 0);
  if (label) {
    const fs = c * 0.27; g.font = `600 ${fs}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = fs * 0.3; g.strokeStyle = '#5a2a06'; g.strokeText(label, c / 2, c * 0.82); g.fillStyle = '#fff6c8'; g.fillText(label, c / 2, c * 0.82);
  }
  SYM.set(key, cv);
  return cv;
}
const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); };
// Where things are on a machine drawn into the box (x, y, w, h): the roof (the hen stands on it), the windows, the lever.
export function slotGeom(x, y, w, h) {
  // mykee, 13:32: "make it bigger ... make sure the images or rollable images dont overshoot the slots". The reel panel
  // takes nine tenths of the cabinet, and each window shows ONE whole picture at rest: its neighbours on the reel sit a
  // full pitch away, outside the window, so nothing is ever cut by a window's edge unless the reel is turning.
  const mqH = h * 0.25, bodyY = y + mqH * 0.74, bodyH = y + h - bodyY;
  const px = x + w * 0.05, pw = w * 0.9, py = bodyY + bodyH * 0.13, ph = bodyH * 0.56, ip = pw * 0.028, g = pw * 0.022;
  const cw = (pw - 2 * ip - 2 * g) / 3, wh = ph - 2 * ip, cell = Math.min(cw * 0.92, wh * 0.86), lh = bodyH * 0.36;
  return { mqH, bodyY, bodyH, px, py, pw, ph, cw, wh, wy: py + ip, wx: [0, 1, 2].map((i) => px + ip + i * (cw + g)), cell, pitch: wh / 2 + cell * 0.62,
    roofY: y, lever: { x: x + w * 0.985, y: bodyY + bodyH * 0.52, h: lh }, right: x + w * 0.985 + lh * 0.32 };
}
// the roof sign carries no words (mykee, 13:29 and 13:30: "dont add any text, just add cool graphics"): a golden egg
// with wings in a dark red plate, and stars running out from it to both ends, lit one after another
function star5(ctx, cx, cy, r) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, q = i % 2 ? r * 0.46 : r; ctx.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); } ctx.closePath(); }
function drawCrest(ctx, x, y, w, G, o, lw) {
  const t = o.t || 0, bad = o.bad || 0, lit = bad > 0 ? 0 : o.lit || 0, vh = G.mqH * 0.74, mx = x + w * 0.1, mw = w * 0.8, cx = x + w / 2;
  const g = ctx.createLinearGradient(0, y, 0, y + G.mqH); g.addColorStop(0, '#ffe27a'); g.addColorStop(1, '#f0a01c');
  rr(ctx, mx, y, mw, G.mqH, [G.mqH * 0.5, G.mqH * 0.5, 0, 0]); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = lw * 1.3; ctx.strokeStyle = '#6a3c06'; ctx.stroke();
  const ih = vh * 0.66, iy = y + vh * 0.19, ix = mx + vh * 0.28, iw = mw - vh * 0.56, cy = iy + ih / 2;
  const pg = ctx.createLinearGradient(0, iy, 0, iy + ih); pg.addColorStop(0, bad > 0 ? '#4a0c1c' : '#8e1c10'); pg.addColorStop(1, bad > 0 ? '#2a0612' : '#5c0e08');
  rr(ctx, ix, iy, iw, ih, ih * 0.5); ctx.fillStyle = pg; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = '#6a3c06'; ctx.stroke();
  ctx.save(); rr(ctx, ix, iy, iw, ih, ih * 0.5); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(ix, iy, iw, ih * 0.36); ctx.restore();
  // the stars: four a side, smaller toward the ends; a light runs out from the egg (all of them flash for a row)
  const N = 3, step = Math.floor(t * 4) % (N + 2);
  for (const d of [-1, 1]) for (let i = 0; i < N; i++) {
    const sx = cx + d * (iw * 0.25 + i * iw * 0.095), r = ih * (0.31 - i * 0.045), on = o.calm ? i % 2 === 0 : bad > 0 ? Math.floor(t * 3.2) % 2 === 0 : lit > 0 ? Math.floor(t * 9 + i) % 2 === 0 : step === i || step === i + 1;
    if (on) { ctx.beginPath(); ctx.arc(sx, cy, r * 1.5, 0, TAU); ctx.fillStyle = bad > 0 ? 'rgba(255,80,50,0.22)' : 'rgba(255,240,150,0.22)'; ctx.fill(); }
    star5(ctx, sx, cy + r * 0.06, r); ctx.fillStyle = bad > 0 ? (on ? '#ff5a3c' : '#6a1a14') : on ? '#fff3a8' : '#e09a14'; ctx.fill(); ctx.lineWidth = Math.max(1, lw * 0.7); ctx.strokeStyle = '#4a1606'; ctx.stroke();
  }
  // the golden egg, its two wings beating slowly, a glint
  const er = ih * 0.4, flap = o.calm ? 0 : Math.sin(t * (lit > 0 ? 14 : 3.2)) * 0.22;
  for (const d of [-1, 1]) {
    ctx.save(); ctx.translate(cx + d * er * 0.5, cy - er * 0.05); ctx.scale(d, 1); ctx.rotate(-0.42 - flap);
    for (let f = 2; f >= 0; f--) { ctx.save(); ctx.rotate(f * 0.44); ctx.beginPath(); ctx.ellipse(er * (0.95 - f * 0.14), 0, er * (0.9 - f * 0.16), er * 0.3, 0, 0, TAU); ctx.fillStyle = f % 2 ? '#fff0d0' : '#ffffff'; ctx.fill(); ctx.lineWidth = Math.max(1, lw * 0.6); ctx.strokeStyle = '#4a1606'; ctx.stroke(); ctx.restore(); }
    ctx.restore();
  }
  if (lit > 0) { ctx.beginPath(); ctx.arc(cx, cy, er * 1.9, 0, TAU); ctx.fillStyle = `rgba(255,240,150,${0.3 * lit})`; ctx.fill(); }
  const eg = ctx.createRadialGradient(cx - er * 0.25, cy - er * 0.4, er * 0.1, cx, cy, er * 1.2); eg.addColorStop(0, '#fff8c8'); eg.addColorStop(0.55, '#ffd040'); eg.addColorStop(1, '#e8920c');
  ctx.beginPath(); ctx.moveTo(cx, cy - er * 1.12); ctx.bezierCurveTo(cx + er * 0.86, cy - er * 1.0, cx + er * 1.0, cy + er * 1.05, cx, cy + er * 1.05); ctx.bezierCurveTo(cx - er * 1.0, cy + er * 1.05, cx - er * 0.86, cy - er * 1.0, cx, cy - er * 1.12); ctx.closePath();
  ctx.fillStyle = eg; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = '#6a3c06'; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx - er * 0.3, cy - er * 0.45, er * 0.16, er * 0.3, 0.5, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
}
export function drawSlot(ctx, x, y, w, h, slices, reels, o = {}) {
  const G = slotGeom(x, y, w, h), t = o.t || 0, bad = o.bad || 0, lit = bad > 0 ? 0 : o.lit || 0, n = slices.length, lw = Math.max(1.5, w * 0.012), OUT = '#5a1206';
  ctx.save(); ctx.lineJoin = 'round';
  // the shadow on the floor, and two feet
  ctx.beginPath(); ctx.ellipse(x + w / 2, y + h + h * 0.012, w * 0.56, h * 0.045, 0, 0, TAU); ctx.fillStyle = 'rgba(20,6,30,0.34)'; ctx.fill();
  for (const fx of [x + w * 0.16, x + w * 0.84]) { rr(ctx, fx - w * 0.07, y + h - h * 0.02, w * 0.14, h * 0.045, h * 0.015); ctx.fillStyle = '#3a1c0c'; ctx.fill(); }
  drawCrest(ctx, x, y, w, G, o, lw);
  // the cabinet: barn red, a lighter band across the top, a gold strip at the foot
  {
    const g = ctx.createLinearGradient(0, G.bodyY, 0, y + h); g.addColorStop(0, '#f0604a'); g.addColorStop(0.5, '#d8402c'); g.addColorStop(1, '#a82a1a');
    rr(ctx, x, G.bodyY, w, G.bodyH, w * 0.07); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = lw * 1.5; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.save(); rr(ctx, x, G.bodyY, w, G.bodyH, w * 0.07); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(x, G.bodyY, w, G.bodyH * 0.07);
    { const sg = ctx.createLinearGradient(x, 0, x + w, 0); sg.addColorStop(0, 'rgba(255,255,255,0.2)'); sg.addColorStop(0.1, 'rgba(255,255,255,0)'); sg.addColorStop(0.86, 'rgba(60,0,0,0)'); sg.addColorStop(1, 'rgba(60,0,0,0.3)'); ctx.fillStyle = sg; ctx.fillRect(x, G.bodyY, w, G.bodyH); } // a round-shouldered box: light on its left edge, shade on its right
    ctx.fillStyle = '#ffc83a'; ctx.fillRect(x, y + h - G.bodyH * 0.055, w, G.bodyH * 0.055); ctx.fillStyle = 'rgba(90,18,6,0.5)'; ctx.fillRect(x, y + h - G.bodyH * 0.055 - lw, w, lw);
    ctx.restore();
  }
  // the lever, on the cabinet's right edge (in front of it, so the machine stays near the middle of the page): a brass
  // socket, a steel arm, a red knob
  {
    // (pulled, it swings toward the player and down: seen from the front the arm shortens, passes the socket and
    // points down, and the knob grows a little as it comes nearer; it never leaves the screen's edge)
    const L = G.lever, k = o.lever || 0, th = k * 2.0, ty = -L.h * Math.cos(th), tx = L.h * 0.12 * (1 - 0.5 * Math.sin(th)), near = 1 + 0.22 * Math.sin(Math.min(Math.PI, th));
    rr(ctx, L.x - w * 0.024, L.y - L.h * 0.17, w * 0.048, L.h * 0.34, w * 0.016); ctx.fillStyle = '#c8860e'; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = '#6a3c06'; ctx.stroke();
    ctx.save(); ctx.translate(L.x, L.y);
    ctx.lineCap = 'round'; ctx.lineWidth = L.h * 0.14; ctx.strokeStyle = '#3a2a22'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.lineWidth = L.h * 0.08; ctx.strokeStyle = '#e8e2d2'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(tx, ty); ctx.stroke();
    const kr = L.h * 0.2 * near * (o.ready && !o.calm ? 1 + 0.07 * Math.sin(t * 5) : 1), kg = ctx.createRadialGradient(tx - kr * 0.3, ty - kr * 0.3, kr * 0.1, tx, ty, kr); kg.addColorStop(0, '#ffa890'); kg.addColorStop(1, '#d8341c');
    ctx.beginPath(); ctx.arc(tx, ty, kr, 0, TAU); ctx.fillStyle = kg; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(tx - kr * 0.32, ty - kr * 0.36, kr * 0.22, kr * 0.14, -0.6, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.arc(L.x, L.y, L.h * 0.13, 0, TAU); ctx.fillStyle = '#ffd86a'; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = '#6a3c06'; ctx.stroke();
  }
  // a row of lamps over the reels: they wander at rest and all dance when a row has come in
  {
    const nb = 9, by = G.bodyY + G.bodyH * 0.063, br = Math.min(w * 0.017, G.bodyH * 0.03);
    for (let i = 0; i < nb; i++) {
      const bx = G.px + G.pw * ((i + 0.5) / nb), on = o.calm ? i % 2 === 0 : bad > 0 ? Math.floor(t * 3.2) % 2 === 0 : lit > 0 ? Math.floor(t * 9 + i) % 2 === 0 : Math.floor(t * 2.2 + i * 0.5) % 3 === 0;
      ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fillStyle = bad > 0 ? (on ? '#ff5a3c' : '#5a1408') : on ? '#fff3a8' : '#c8781a'; ctx.fill(); ctx.lineWidth = Math.max(1, lw * 0.7); ctx.strokeStyle = '#6a3c06'; ctx.stroke();
      if (on) { ctx.beginPath(); ctx.arc(bx, by, br * 2.1, 0, TAU); ctx.fillStyle = bad > 0 ? 'rgba(255,80,50,0.25)' : 'rgba(255,240,150,0.22)'; ctx.fill(); }
    }
  }
  // the reel panel and its three windows
  rr(ctx, G.px, G.py, G.pw, G.ph, G.pw * 0.04); ctx.fillStyle = '#3a1408'; ctx.fill(); ctx.lineWidth = lw * 1.2; ctx.strokeStyle = '#ffc83a'; ctx.stroke();
  const c = G.cell, dpr = o.dpr || 1, cy = G.wy + G.wh / 2;
  for (let r = 0; r < 3; r++) {
    const wx = G.wx[r], pos = reels[r] || 0, sp = Math.abs((o.speed && o.speed[r]) || 0), k0 = Math.round(pos);
    ctx.save(); rr(ctx, wx, G.wy, G.cw, G.wh, G.cw * 0.1); ctx.clip();
    const bg = ctx.createLinearGradient(wx, 0, wx + G.cw, 0); bg.addColorStop(0, '#f2e4c2'); bg.addColorStop(0.5, '#fffaf0'); bg.addColorStop(1, '#f2e4c2'); ctx.fillStyle = bg; ctx.fillRect(wx, G.wy, G.cw, G.wh);
    if (bad > 0) { ctx.fillStyle = `rgba(40,8,30,${0.62 * bad})`; ctx.fillRect(wx, G.wy, G.cw, G.wh); } // the lights go down behind the villains
    for (let k = k0 - 2; k <= k0 + 2; k++) { // as the reel runs on, its pictures come down through the window
      const sy = cy + (pos - k) * G.pitch; if (sy < G.wy - c || sy > G.wy + G.wh + c) continue;
      const cv = symbol(slices[stripAt(r, k, n)], c, dpr);
      if (bad > 0 && k === k0) { // the villain in the row shakes with laughter, a little bigger; its neighbours fade
        const j = o.calm ? 0 : Math.sin(t * 26 + r * 2) * c * 0.012 * bad, z = c * (1 + 0.05 * bad);
        ctx.drawImage(cv, wx + (G.cw - z) / 2 + j, sy - z / 2 - Math.abs(j) * 0.8, z, z); continue;
      }
      if (bad > 0) ctx.globalAlpha = 1 - 0.75 * bad;
      if (sp > 7 && !o.calm) { ctx.globalAlpha = 0.3; ctx.drawImage(cv, wx + (G.cw - c) / 2, sy - c / 2 - c * 0.2, c, c); ctx.drawImage(cv, wx + (G.cw - c) / 2, sy - c / 2 + c * 0.2, c, c); ctx.globalAlpha = 0.75; }
      ctx.drawImage(cv, wx + (G.cw - c) / 2, sy - c / 2, c, c); ctx.globalAlpha = 1;
    }
    const sh = ctx.createLinearGradient(0, G.wy, 0, G.wy + G.wh); sh.addColorStop(0, 'rgba(60,24,6,0.6)'); sh.addColorStop(0.24, 'rgba(60,24,6,0)'); sh.addColorStop(0.76, 'rgba(60,24,6,0)'); sh.addColorStop(1, 'rgba(60,24,6,0.6)');
    ctx.fillStyle = sh; ctx.fillRect(wx, G.wy, G.cw, G.wh);
    if (lit > 0) { ctx.fillStyle = `rgba(255,236,150,${(0.16 + 0.14 * Math.sin(t * 9)) * lit})`; ctx.fillRect(wx, G.wy, G.cw, G.wh); }
    ctx.restore();
    rr(ctx, wx, G.wy, G.cw, G.wh, G.cw * 0.1); ctx.lineWidth = lw * (1 + lit + bad * 0.6); ctx.strokeStyle = bad > 0 ? '#e8402c' : lit > 0 ? `rgba(255,${Math.round(200 + 40 * lit)},90,1)` : '#8a5200'; ctx.stroke();
  }
  if (lit > 0) { // three of a kind: a line of light through the row, and sparks thrown out from it
    const a = (0.55 + 0.25 * Math.sin(t * 11)) * lit, g = ctx.createLinearGradient(0, cy - c * 0.12, 0, cy + c * 0.12); g.addColorStop(0, 'rgba(255,240,160,0)'); g.addColorStop(0.5, `rgba(255,246,190,${a})`); g.addColorStop(1, 'rgba(255,240,160,0)');
    ctx.fillStyle = g; ctx.fillRect(G.px, cy - c * 0.12, G.pw, c * 0.24);
    const wt = o.winT == null ? 9 : o.winT;
    if (wt < 0.9 && !o.calm) for (let i = 0; i < 14; i++) { const an = (i / 14) * TAU + 0.4, d = w * (0.18 + (0.34 + 0.22 * ((i * 7) % 5) / 4) * (1 - Math.pow(1 - wt / 0.9, 2))); sparkle(ctx, x + w / 2 + Math.cos(an) * d * 1.15, cy + Math.sin(an) * d * 0.8, w * (0.035 + 0.012 * (i % 3)), 1 - wt / 0.9); }
  }
  // the row that counts: a gold marker at each end
  for (const d of [-1, 1]) { const ax = d < 0 ? G.px : G.px + G.pw, s = G.pw * 0.035; ctx.beginPath(); ctx.moveTo(ax - d * s * 0.5, cy - s); ctx.lineTo(ax + d * s * 1.0, cy); ctx.lineTo(ax - d * s * 0.5, cy + s); ctx.closePath(); ctx.fillStyle = bad > 0 ? '#ff5a3c' : lit > 0 ? '#fff3a8' : '#ffc83a'; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = '#6a3c06'; ctx.stroke(); }
  // under the reels: the prize tray
  {
    const ty = G.py + G.ph + G.bodyH * 0.06, th = G.bodyH * 0.115, tw = w * 0.5;
    rr(ctx, x + w / 2 - tw / 2, ty, tw, th, th * 0.4); ctx.fillStyle = '#3a1408'; ctx.fill(); ctx.lineWidth = lw * 1.2; ctx.strokeStyle = '#ffc83a'; ctx.stroke();
    rr(ctx, x + w / 2 - tw / 2 + th * 0.2, ty + th * 0.52, tw - th * 0.4, th * 0.3, th * 0.15); ctx.fillStyle = 'rgba(255,200,58,0.25)'; ctx.fill();
    for (const d of [-1, 1]) { const bx = x + w / 2 + d * w * 0.36, by = ty + th / 2, br = th * 0.42; ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); const g = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.3, br * 0.1, bx, by, br); g.addColorStop(0, '#fff0a8'); g.addColorStop(1, '#e09a14'); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = '#6a3c06'; ctx.stroke(); }
  }
  ctx.restore();
  return G;
}
// the machine, small, for a button: a red box with three windows and the knob
export function drawSlotIcon(ctx, cx, cy, r, t = 0) {
  const w = r * 1.7, h = r * 1.5, x = cx - w / 2 - r * 0.1, y = cy - h / 2;
  ctx.save(); ctx.lineJoin = 'round';
  ctx.lineCap = 'round'; ctx.lineWidth = r * 0.14; ctx.strokeStyle = '#e8e2d2'; ctx.beginPath(); ctx.moveTo(x + w + r * 0.06, cy + r * 0.1); ctx.lineTo(x + w + r * 0.2, cy - r * 0.5); ctx.stroke();
  ctx.beginPath(); ctx.arc(x + w + r * 0.2, cy - r * 0.55, r * 0.2, 0, TAU); ctx.fillStyle = '#ff6a4a'; ctx.fill(); ctx.lineWidth = Math.max(1, r * 0.07); ctx.strokeStyle = '#5a1206'; ctx.stroke();
  rr(ctx, x, y, w, h, r * 0.26); ctx.fillStyle = '#e04a34'; ctx.fill(); ctx.lineWidth = Math.max(1, r * 0.1); ctx.strokeStyle = '#5a1206'; ctx.stroke();
  rr(ctx, x + w * 0.1, y + h * 0.22, w * 0.8, h * 0.5, r * 0.1); ctx.fillStyle = '#3a1408'; ctx.fill();
  const cols = ['#ffc21f', '#3fa4ea', '#7cba2c'], cw = w * 0.22;
  for (let i = 0; i < 3; i++) { const wx = x + w * 0.14 + i * (cw + w * 0.03); rr(ctx, wx, y + h * 0.27, cw, h * 0.4, r * 0.06); ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.beginPath(); ctx.arc(wx + cw / 2, y + h * 0.47 + (t ? Math.sin(t * 6 + i * 2) * h * 0.05 : 0), cw * 0.3, 0, TAU); ctx.fillStyle = cols[i]; ctx.fill(); }
  ctx.fillStyle = '#ffc83a'; ctx.fillRect(x + w * 0.3, y + h * 0.82, w * 0.4, h * 0.07);
  ctx.restore();
}
