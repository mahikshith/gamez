// The Extras page's pictures: one small scene per Wonder Vault and for Practice, in the game's current style (chunky,
// rounded, a dark outline, soft inner shading, the real hen, egg and chick art). Each draws a square tile of side s
// centred at (cx, cy): a rounded well with its own sky, then the scene. t is the clock (0 under reduced motion).
// Nothing is cached: the scenes are a few paths each, so there is no canvas to give back.
import { drawHenAnim, drawHeart } from './hen.js';
import { drawChick } from './characters.js';
import { drawEggIcon } from '../ui/ui.js';

const TAU = Math.PI * 2;
const INK = '#2a1408';

const SKY = {
  planet: ['#1a1d5c', '#5a3fb0'], plan: ['#2f86c0', '#8fd8f0'], mama: ['#ffb45a', '#d8682c'],
  twin: ['#2f9a5c', '#9be4a8'], hatch: ['#ffe082', '#f0a030'], practice: ['#3a9b4a', '#a0dc80'],
};

function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
function egg(c, x, y, h) { drawEggIcon(c, x, y, h, 'ok'); }
function outlined(c, lw, fill) { c.lineWidth = lw; c.strokeStyle = INK; c.lineJoin = 'round'; c.stroke(); if (fill) { c.fillStyle = fill; c.fill(); } }

// the tile: rounded well, the key's sky, soft inner shade at the bottom and a light rim on top
function well(c, key, s) {
  const k = SKY[key] || SKY.planet, g = c.createLinearGradient(0, -s / 2, 0, s / 2);
  g.addColorStop(0, k[0]); g.addColorStop(1, k[1]);
  rr(c, -s / 2, -s / 2, s, s, s * 0.22); c.fillStyle = g; c.fill();
  c.save(); rr(c, -s / 2, -s / 2, s, s, s * 0.22); c.clip();
  const sh = c.createLinearGradient(0, -s / 2, 0, s / 2); sh.addColorStop(0, 'rgba(0,0,0,0.28)'); sh.addColorStop(0.18, 'rgba(0,0,0,0)'); sh.addColorStop(0.8, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(255,255,255,0.14)');
  c.fillStyle = sh; c.fillRect(-s / 2, -s / 2, s, s);
  return () => { c.restore(); rr(c, -s / 2, -s / 2, s, s, s * 0.22); c.lineWidth = s * 0.045; c.strokeStyle = 'rgba(20,8,30,0.55)'; c.stroke(); };
}

function sparkle(c, x, y, r, a = 1) {
  if (a <= 0.02) return;
  c.save(); c.globalAlpha *= a; c.beginPath();
  c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r); c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r);
  c.fillStyle = '#fffbe0'; c.fill(); c.restore();
}

// Planet Nest: a small world with a gold ring, an egg riding the ring
function planet(c, s, t, o = {}) {
  if (!o.bare) for (let i = 0; i < 7; i++) { const px = Math.sin(i * 12.9) * 0.42 * s, py = Math.cos(i * 7.7) * 0.42 * s; sparkle(c, px, py, s * (0.025 + (i % 3) * 0.012), 0.55 + 0.45 * Math.sin(t * 2 + i * 1.7)); }
  const pr = s * 0.22, px = 0, py = s * 0.03, tilt = -0.38, rx = s * 0.35, ry = s * 0.1;
  const ringHalf = (a0, a1) => { c.save(); c.translate(px, py); c.rotate(tilt); c.beginPath(); c.ellipse(0, 0, rx, ry, 0, a0, a1); c.lineCap = 'round'; c.lineWidth = s * 0.085; c.strokeStyle = INK; c.stroke(); c.lineWidth = s * 0.05; c.strokeStyle = '#ffd966'; c.stroke(); c.lineWidth = s * 0.016; c.strokeStyle = '#fff3b0'; c.translate(0, -s * 0.012); c.stroke(); c.restore(); };
  const orbit = (a) => { c.save(); c.translate(px, py); c.rotate(tilt); const ex = Math.cos(a) * rx, ey = Math.sin(a) * ry; c.restore(); const ca = Math.cos(tilt), sa = Math.sin(tilt); return { x: px + ex * ca - ey * sa, y: py + ex * sa + ey * ca }; };
  const a = t * 1.1 + 0.6, front = Math.sin(a) > 0, ep = orbit(a);
  ringHalf(Math.PI, TAU); // the back of the ring
  if (!front) egg(c, ep.x, ep.y - s * 0.03, s * 0.2);
  c.beginPath(); c.arc(px, py, pr, 0, TAU);
  const g = c.createRadialGradient(px - pr * 0.4, py - pr * 0.45, pr * 0.1, px, py, pr * 1.05); g.addColorStop(0, '#b8fff0'); g.addColorStop(0.5, '#47b5e8'); g.addColorStop(1, '#2a58b8');
  c.fillStyle = g; c.fill();
  c.save(); c.clip(); c.fillStyle = '#58c860';
  c.beginPath(); c.ellipse(px - pr * 0.35, py + pr * 0.2, pr * 0.42, pr * 0.26, 0.5, 0, TAU); c.fill();
  c.beginPath(); c.ellipse(px + pr * 0.45, py - pr * 0.25, pr * 0.22, pr * 0.3, -0.4, 0, TAU); c.fill();
  c.fillStyle = 'rgba(10,10,60,0.3)'; c.beginPath(); c.arc(px + pr * 0.5, py + pr * 0.55, pr * 1.05, 0, TAU); c.arc(px, py, pr * 1.2, 0, TAU, true); c.fill(); c.restore();
  c.beginPath(); c.arc(px, py, pr, 0, TAU); c.lineWidth = s * 0.04; c.strokeStyle = INK; c.stroke();
  ringHalf(0, Math.PI); // the front
  if (front) egg(c, ep.x, ep.y - s * 0.03, s * 0.2);
}

// Plan and Hatch: a stopwatch, and an egg waiting beside it in its straw
function plan(c, s, t) {
  const x = -s * 0.07, y = -s * 0.02, r = s * 0.28;
  c.fillStyle = INK; rr(c, x - s * 0.05, y - r - s * 0.1, s * 0.1, s * 0.09, s * 0.02); c.fill(); // crown
  c.save(); c.translate(x + r * 0.78, y - r * 0.78); c.rotate(0.78); c.fillStyle = INK; rr(c, -s * 0.04, -s * 0.085, s * 0.08, s * 0.07, s * 0.02); c.fill(); c.restore();
  c.beginPath(); c.arc(x, y, r, 0, TAU); const mg = c.createLinearGradient(x, y - r, x, y + r); mg.addColorStop(0, '#ffe9a0'); mg.addColorStop(1, '#d8941c'); outlined(c, s * 0.045, mg);
  c.beginPath(); c.arc(x, y, r * 0.8, 0, TAU); c.fillStyle = '#fff8e4'; c.fill(); c.lineWidth = s * 0.02; c.strokeStyle = 'rgba(90,50,10,0.5)'; c.stroke();
  c.lineCap = 'round'; c.strokeStyle = '#5a3414'; c.lineWidth = s * 0.022;
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, q = i % 3 ? 0.66 : 0.58; c.beginPath(); c.moveTo(x + Math.cos(a) * r * q, y + Math.sin(a) * r * q); c.lineTo(x + Math.cos(a) * r * 0.74, y + Math.sin(a) * r * 0.74); c.stroke(); }
  const a = t * 1.4 - Math.PI / 2 + 0.6; // the red slice of time already spent, and the hand
  c.beginPath(); c.moveTo(x, y); c.arc(x, y, r * 0.62, -Math.PI / 2, a); c.closePath(); c.fillStyle = 'rgba(232,64,46,0.35)'; c.fill();
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * r * 0.66, y + Math.sin(a) * r * 0.66); c.lineWidth = s * 0.04; c.strokeStyle = '#e8402e'; c.stroke();
  c.beginPath(); c.arc(x, y, s * 0.032, 0, TAU); outlined(c, s * 0.02, '#fff0c0');
  // the egg waits on a little straw nest
  const ex = s * 0.27, ey = s * 0.3;
  c.beginPath(); c.ellipse(ex, ey + s * 0.06, s * 0.17, s * 0.07, 0, 0, TAU); outlined(c, s * 0.03, '#e8b040');
  egg(c, ex, ey - s * 0.01, s * 0.24);
  c.beginPath(); c.ellipse(ex, ey + s * 0.07, s * 0.14, s * 0.045, 0, 0, Math.PI); c.fillStyle = '#f4cc60'; c.fill();
}

// Mama's Call: the hen calling, sound arcs and a heart
function mama(c, s, t, o) {
  if (o.bare) { c.beginPath(); c.ellipse(0, s * 0.32, s * 0.3, s * 0.045, 0, 0, TAU); c.fillStyle = 'rgba(70,30,10,0.28)'; c.fill(); } // (bare: a soft shadow on the page instead of the tile's floor)
  else {
    c.fillStyle = 'rgba(70,30,10,0.35)'; c.fillRect(-s / 2, s * 0.3, s, s * 0.2); // the ground
    c.fillStyle = 'rgba(255,230,160,0.55)'; c.fillRect(-s / 2, s * 0.3, s, s * 0.02);
  }
  const hh = s * 0.68;
  drawHenAnim(c, 'idle', -s * 0.12, s * 0.3 - hh * 0.5, hh, t, { key: 'extras', face: 1, calm: !!o.calm, shadow: 0 });
  c.lineCap = 'round';
  for (let i = 0; i < 3; i++) { const a = 0.55 + 0.45 * Math.sin(t * 4 - i * 0.9), r0 = s * (0.1 + i * 0.075); c.beginPath(); c.arc(s * 0.17, -s * 0.06, r0, -0.75, 0.75); c.lineWidth = s * 0.04; c.strokeStyle = `rgba(42,20,8,${0.9 * (o.calm ? 1 : a)})`; c.stroke(); c.lineWidth = s * 0.022; c.strokeStyle = `rgba(255,245,210,${o.calm ? 1 : a})`; c.stroke(); }
  drawHeart(c, s * 0.3, -s * 0.3 - (o.calm ? 0 : Math.sin(t * 3) * s * 0.012), s * 0.09, s * 0.03, 1);
}

// one small ring vault: a wooden ring with a gap, an egg waiting inside
function miniVault(c, x, y, r, rot, s) {
  const gapA = 1.0, a0 = rot + gapA / 2, a1 = a0 + TAU - gapA;
  c.save(); c.lineCap = 'round';
  c.beginPath(); c.arc(x, y, r, a0, a1); c.lineWidth = s * 0.115; c.strokeStyle = INK; c.stroke();
  c.beginPath(); c.arc(x, y, r, a0, a1); c.lineWidth = s * 0.075; c.strokeStyle = '#c98a48'; c.stroke();
  c.beginPath(); c.arc(x, y, r, a0, a1); c.lineWidth = s * 0.022; c.translate(0, -s * 0.014); c.strokeStyle = '#f0c080'; c.stroke();
  c.restore();
  egg(c, x, y + r * 0.04, r * 0.85);
}
// Twin Vaults: two small ring vaults side by side, turning together
function twin(c, s, t) {
  c.beginPath(); c.arc(-s * 0.23, s * 0.02, s * 0.23, 0, TAU); c.moveTo(s * 0.46, s * 0.02); c.arc(s * 0.23, s * 0.02, s * 0.23, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.14)'; c.fill();
  miniVault(c, -s * 0.23, s * 0.02, s * 0.185, t * 0.7, s);
  miniVault(c, s * 0.23, s * 0.02, s * 0.185, -t * 0.7 + 2.4, s);
  sparkle(c, 0, -s * 0.33, s * 0.05, 0.8 + 0.2 * Math.sin(t * 3));
  sparkle(c, 0, s * 0.33, s * 0.04, 0.8 + 0.2 * Math.sin(t * 3 + 1));
}

// Hatchlings: a chick bursting out of its shell
function hatch(c, s, t, o) {
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 0.4; c.beginPath(); c.moveTo(Math.cos(a) * s * 0.34, -s * 0.06 + Math.sin(a) * s * 0.34); c.lineTo(Math.cos(a) * s * 0.46, -s * 0.06 + Math.sin(a) * s * 0.46); c.lineWidth = s * 0.03; c.lineCap = 'round'; c.strokeStyle = 'rgba(255,250,210,0.8)'; c.stroke(); }
  const bob = o.calm ? 0 : Math.sin(t * 3) * s * 0.01;
  drawChick(c, 0, s * 0.04 + bob, s * 0.34, t, 0, 0);
  // the lower shell, zigzag top, over the chick's feet
  const sy = s * 0.16, w = s * 0.27;
  c.beginPath(); c.moveTo(-w, sy);
  for (let i = 1; i <= 6; i++) c.lineTo(-w + (2 * w * i) / 6, sy + (i % 2 ? -s * 0.06 : 0));
  c.bezierCurveTo(w, sy + s * 0.2, w * 0.5, s * 0.42, 0, s * 0.42); c.bezierCurveTo(-w * 0.5, s * 0.42, -w, sy + s * 0.2, -w, sy); c.closePath();
  const g = c.createLinearGradient(-w, 0, w, 0); g.addColorStop(0, '#fff8e8'); g.addColorStop(1, '#e6c898'); outlined(c, s * 0.04, g);
  // a loose cap of shell tumbling away
  c.save(); c.translate(s * 0.3, -s * 0.3 - (o.calm ? 0 : Math.sin(t * 2.4) * s * 0.015)); c.rotate(0.6);
  c.beginPath(); c.moveTo(-s * 0.1, 0); for (let i = 1; i <= 4; i++) c.lineTo(-s * 0.1 + (s * 0.2 * i) / 4, i % 2 ? -s * 0.03 : 0); c.bezierCurveTo(s * 0.1, -s * 0.1, s * 0.05, -s * 0.18, 0, -s * 0.18); c.bezierCurveTo(-s * 0.05, -s * 0.18, -s * 0.1, -s * 0.1, -s * 0.1, 0); c.closePath(); outlined(c, s * 0.035, '#fff4dc'); c.restore();
  sparkle(c, -s * 0.33, -s * 0.28, s * 0.05, 0.8 + 0.2 * Math.sin(t * 3));
}

// Practice: a target, a villain's shadow with glowing eyes in the bullseye, an arrow in the rim
function practice(c, s, t) {
  const x = 0, y = s * 0.02, r = s * 0.36;
  c.fillStyle = 'rgba(30,60,20,0.3)'; c.beginPath(); c.ellipse(x, y + r * 1.02, r * 0.8, r * 0.14, 0, 0, TAU); c.fill();
  const cols = ['#e8402e', '#fff4dc', '#e8402e', '#fff4dc'];
  cols.forEach((col, i) => { c.beginPath(); c.arc(x, y, r * (1 - i * 0.22), 0, TAU); outlined(c, s * 0.03, col); });
  c.beginPath(); c.arc(x, y, r * 0.42, 0, TAU); c.fillStyle = '#ffe9a0'; c.fill(); c.lineWidth = s * 0.02; c.strokeStyle = INK; c.stroke();
  // the villain: round dark head, pointed ears, a bandit mask, two glowing eyes
  c.save(); c.translate(x, y); c.scale(1.3, 1.3); c.translate(-x, -y);
  c.fillStyle = '#1a1030';
  c.beginPath(); c.moveTo(x - r * 0.24, y - r * 0.08); c.lineTo(x - r * 0.2, y - r * 0.3); c.lineTo(x - r * 0.05, y - r * 0.16); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(x + r * 0.24, y - r * 0.08); c.lineTo(x + r * 0.2, y - r * 0.3); c.lineTo(x + r * 0.05, y - r * 0.16); c.closePath(); c.fill();
  c.beginPath(); c.ellipse(x, y + r * 0.02, r * 0.25, r * 0.21, 0, 0, TAU); c.fill();
  const gl = 0.75 + 0.25 * Math.sin(t * 4);
  c.fillStyle = `rgba(255,214,60,${gl})`;
  for (const d of [-1, 1]) { c.beginPath(); c.ellipse(x + d * r * 0.11, y - r * 0.02, r * 0.065, r * 0.045, d * 0.35, 0, TAU); c.fill(); }
  c.restore();
  // an arrow stuck in the red rim at the upper right
  c.save(); c.translate(x + r * 0.62, y - r * 0.62); c.rotate(-0.78);
  c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.lineTo(s * 0.26, 0); c.lineWidth = s * 0.06; c.strokeStyle = INK; c.stroke(); c.lineWidth = s * 0.03; c.strokeStyle = '#d8b070'; c.stroke();
  for (const d of [-1, 1]) { c.beginPath(); c.moveTo(s * 0.2, 0); c.lineTo(s * 0.3, d * s * 0.065); c.lineTo(s * 0.33, d * s * 0.065); c.lineTo(s * 0.28, 0); c.closePath(); outlined(c, s * 0.02, '#fff'); }
  c.restore();
}

const SCENE = { planet, plan, mama, twin, hatch, practice };

// key: 'planet' | 'plan' | 'mama' | 'twin' | 'hatch' | 'practice'. Returns false for a key it does not know.
export function drawExtraIcon(c, key, cx, cy, s, t = 0, o = {}) {
  const f = SCENE[key];
  if (!f || !(s > 0)) return false;
  c.save(); c.translate(cx, cy); c.lineJoin = 'round'; c.lineCap = 'round';
  const done = o.bare ? () => {} : well(c, key, s); // o.bare (frame818): no tile, the scene's things on the page itself
  try { f(c, s, o.calm ? 0 : t, o); } catch (_) { /* art must never break the page */ }
  done();
  c.restore();
  return true;
}

// the home screen's Extras button: the same little planet with its ring and an egg, no tile around it
export function drawExtrasMark(c, cx, cy, s, t = 0) {
  c.save(); c.translate(cx, cy); c.lineJoin = 'round'; c.lineCap = 'round';
  planet(c, s * 1.3, t, { bare: true });
  c.restore();
}
