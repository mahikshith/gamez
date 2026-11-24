// v3.4 powers and combos: orb emblems, egg overlays, world effects and event feedback (sim/powers2.js has the rules).
// Code-drawn in the house style: dark outline, two-tone shading. World layers take ctx in world space (metres, y up);
// the orb and egg art draw in a local y-down space (orb: 200 units across, egg: 100 units tall).
import { EGG_H, EGG_W, RING_TH, TAU, rng } from '../sim/geom.js';
import { P2, COMBOS } from '../sim/powers2.js';
import { POWER_INFO, GLASS, EMBLEM_ART, EGG_ART, ORB_ART, drawOrb } from './powers.js';
import { boltStroke } from './status.js';
import { strikeQuiet, strikeMuteAt } from './strikehit.js'; // Chick Strike: its reactions speak for themselves
import { drawWarp, warpEvent } from './warp.js'; // the Warp Gate (sim/warp.js)
import { ringPt, ringSpd } from '../sim/shapes.js'; // v4: iron bars on shaped vaults

// ---------- names, lines (pickup card) and glass tints
const INFO = {
  frostnova: ['Frost nova', 'Every creature freezes and thorns turn brittle. Rings lock, then go icy.', '#9fe9ff', ['#effcff', '#2a86b8', '#062a40']],
  shock: ['Shock ring', 'This ring zaps creatures away for 8 s. Eggs that touch it bounce off.', '#6fd0ff', ['#c8eeff', '#1b5f9e', '#06193a']],
  thunderclap: ['Thunderclap', 'Every creature is stunned. Doors and portals black out a while.', '#ffe14a', ['#fff3b0', '#6b5a1a', '#1f1904']],
  laser: ['Laser cannon', 'Tap to fire: cuts thorns and walls, stuns villains. Burns sponge too.', '#ff4b3a', ['#ffb3a0', '#8f1a10', '#2c0503']],
  spin: ['Spin storm', 'The whole vault spins and flings creatures to the rim. Eggs tumble!', '#7ff0d8', ['#d2fff5', '#13806e', '#032a24']],
  pepper: ['Pepper puff', 'Creatures sneeze and flee for 8 s. The smoke hides the board a moment.', '#ff6a2a', ['#ffc39a', '#9c2c08', '#300b00']],
  shrink: ['Shrink ray', 'Eggs go quail size: through grates, hard to track. They crack easier.', '#c49bff', ['#eedcff', '#5b2fa0', '#1a0838']],
  iron: ['Iron shell', 'Steel eggs: no cracks, no bites. Too heavy for narrow gaps and sponge.', '#b8c4d0', ['#eef3f7', '#4d5966', '#141a20']],
  decoy: ['Decoy egg', 'A fake egg every creature chases. It is big: it can plug a gap.', '#e8a456', ['#ffe0b0', '#8a5420', '#2c1606']],
};
for (const id in INFO) {
  const [name, line, color, glass] = INFO[id];
  POWER_INFO[id] = { name, line, color };
  GLASS[id] = glass;
}
// the pickup card says one short line (2026-11-20, owner: less text, the picture teaches); the album keeps C.line
const COMBO_CARD = { shatter: 'Frozen creatures are knocked out.', sweep: 'The beam sweeps round: every thorn cut.', cannon: 'Tiny iron eggs smash through.', twister: 'Every creature sneezes out to the rim.', magnet: 'Iron eggs stick to the live ring.', bait: 'Creatures chase the decoy far away.', stink: 'Biters flee for far longer.' };
for (const C of COMBOS) POWER_INFO['combo_' + C.id] = { name: 'COMBO! ' + C.name, line: COMBO_CARD[C.id] || C.line, color: '#ffd23f' };

const OUT = '#1b1410';
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// egg outline in a y-down local space, h tall (narrow end up)
function eggPathL(ctx, h, x = 0, y = 0) {
  const w = (h * EGG_W) / EGG_H;
  ctx.beginPath();
  for (let i = 0; i <= 28; i++) {
    const a = (i / 28) * TAU, s = Math.sin(a), px = x + (w / 2) * Math.cos(a) * (1 - 0.13 * s), py = y - (h / 2) * s;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
}
function star(ctx, x, y, r, n = 5, inner = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * TAU - Math.PI / 2, rr = i % 2 ? r * inner : r; i ? ctx.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)) : ctx.moveTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); }
  ctx.closePath();
}

// ---------- shared paint: iron shell and wooden decoy (y-down, egg h tall, centred)
function paintIron(ctx, h, t, lw) {
  eggPathL(ctx, h * 1.03);
  const g = ctx.createLinearGradient(-h * 0.3, -h * 0.4, h * 0.32, h * 0.45);
  g.addColorStop(0, '#f6f9fc'); g.addColorStop(0.4, '#aab5c0'); g.addColorStop(1, '#45505c');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // a riveted seam round the middle
  ctx.strokeStyle = '#27303a';
  ctx.lineWidth = lw * 0.9;
  ctx.beginPath();
  ctx.moveTo(-h * 0.45, h * 0.07); ctx.quadraticCurveTo(0, h * 0.2, h * 0.45, h * 0.07);
  ctx.stroke();
  for (let i = -2; i <= 2; i++) {
    const x = i * h * 0.13, y = h * 0.07 + h * 0.13 * (1 - (i / 3.4) * (i / 3.4)) - h * 0.045;
    ctx.beginPath(); ctx.arc(x, y + h * 0.05, h * 0.03, 0, TAU);
    ctx.fillStyle = '#e6ecf2'; ctx.fill(); ctx.lineWidth = lw * 0.45; ctx.stroke();
  }
  // a sheen that slides over the steel
  const u = ((t * 0.35) % 1.6) - 0.3;
  const s = ctx.createLinearGradient(-h * 0.5 + u * h, -h * 0.5, -h * 0.2 + u * h, h * 0.1);
  s.addColorStop(0, 'rgba(255,255,255,0)'); s.addColorStop(0.5, 'rgba(255,255,255,0.55)'); s.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = s;
  ctx.fillRect(-h, -h, 2 * h, 2 * h);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.ellipse(-h * 0.13, -h * 0.25, h * 0.07, h * 0.12, 0.4, 0, TAU); ctx.fill();
  eggPathL(ctx, h * 1.03);
  ctx.strokeStyle = '#161c22';
  ctx.lineWidth = lw;
  ctx.stroke();
}
function paintDecoy(ctx, h, t, lw, pepper) {
  eggPathL(ctx, h);
  const g = ctx.createLinearGradient(-h * 0.3, -h * 0.45, h * 0.3, h * 0.45);
  g.addColorStop(0, '#ffd9a0'); g.addColorStop(0.5, '#d4914c'); g.addColorStop(1, '#7d4a1c');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // wood grain
  ctx.strokeStyle = 'rgba(95,52,18,0.45)';
  ctx.lineWidth = lw * 0.5;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    for (let j = 0; j <= 10; j++) { const y = -h * 0.5 + (j / 10) * h, x = i * h * 0.13 + Math.sin(j * 1.3 + i) * h * 0.025; j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
  }
  // a painted zig-zag band: red with a white zig-zag (pepper: dark red with black flecks)
  const y0 = h * 0.04, bh = h * 0.2;
  ctx.fillStyle = pepper ? '#a3140c' : '#e2382f';
  ctx.fillRect(-h, y0 - bh / 2, 2 * h, bh);
  ctx.strokeStyle = pepper ? '#2a0806' : '#fff6e6';
  ctx.lineWidth = lw * 0.9;
  ctx.beginPath();
  for (let i = 0; i <= 8; i++) { const x = -h * 0.45 + (i / 8) * h * 0.9, y = y0 + (i % 2 ? -1 : 1) * bh * 0.28; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke();
  ctx.restore();
  // painted eyes: flat dots, no shine (it is not alive)
  ctx.fillStyle = '#2a170a';
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * h * 0.11, -h * 0.17, h * 0.035, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = '#2a170a';
  ctx.lineWidth = lw * 0.5;
  ctx.beginPath(); ctx.moveTo(-h * 0.06, -h * 0.08); ctx.lineTo(h * 0.06, -h * 0.08); ctx.stroke(); // a painted line for a mouth
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.ellipse(-h * 0.14, -h * 0.3, h * 0.05, h * 0.09, 0.4, 0, TAU); ctx.fill();
  eggPathL(ctx, h);
  ctx.strokeStyle = '#3a210b';
  ctx.lineWidth = lw;
  ctx.stroke();
}

// ---------- orb emblems (200-unit orb, y-down)
EMBLEM_ART.frostnova = (ctx, t) => {
  ctx.save();
  ctx.strokeStyle = 'rgba(220,250,255,0.6)';
  ctx.lineWidth = 7;
  ctx.beginPath(); ctx.arc(0, 0, 54 + 8 * ((t * 0.8) % 1), 0, TAU); ctx.stroke();
  ctx.rotate(t * 0.25);
  ctx.lineJoin = 'round';
  for (let k = 0; k < 8; k++) {
    ctx.save();
    ctx.rotate((k / 8) * TAU);
    const L = k % 2 ? 44 : 66, w = k % 2 ? 9 : 13;
    ctx.beginPath(); ctx.moveTo(0, -L); ctx.lineTo(w, -L * 0.42); ctx.lineTo(0, -12); ctx.lineTo(-w, -L * 0.42); ctx.closePath();
    ctx.fillStyle = '#eafcff'; ctx.fill();
    ctx.strokeStyle = '#0d4467'; ctx.lineWidth = 5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -L + 6); ctx.lineTo(0, -16); ctx.strokeStyle = '#7fd2f5'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = '#0d4467'; ctx.lineWidth = 5; ctx.stroke();
  ctx.restore();
};
function zig(ctx, x0, y0, x1, y1, n, amp, R) {
  ctx.beginPath(); ctx.moveTo(x0, y0);
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  for (let i = 1; i < n; i++) { const f = i / n, o = (R() - 0.5) * 2 * amp; ctx.lineTo(x0 + dx * f + nx * o, y0 + dy * f + ny * o); }
  ctx.lineTo(x1, y1);
}
EMBLEM_ART.shock = (ctx, t) => {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#0f2340'; ctx.lineWidth = 26; ctx.beginPath(); ctx.arc(0, 0, 42, 0, TAU); ctx.stroke();
  ctx.strokeStyle = '#7fd3ff'; ctx.lineWidth = 15; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 46, -2.6, -1.2); ctx.stroke();
  const R = rng(Math.floor(t * 12));
  for (let k = 0; k < 4; k++) {
    const a = t * 1.4 + (k / 4) * TAU + (R() - 0.5) * 0.4;
    zig(ctx, Math.cos(a) * 30, Math.sin(a) * 30, Math.cos(a) * 76, Math.sin(a) * 76, 4, 9, R);
    ctx.strokeStyle = '#3a2a00'; ctx.lineWidth = 10; ctx.stroke();
    ctx.strokeStyle = '#fff6a0'; ctx.lineWidth = 5; ctx.stroke();
  }
  ctx.restore();
};
EMBLEM_ART.thunderclap = (ctx, t) => {
  ctx.save();
  ctx.lineJoin = 'round';
  // the clap: sound rings either side
  for (const s of [-1, 1]) for (const r of [22, 36]) {
    const c = s > 0 ? 0 : Math.PI;
    ctx.beginPath(); ctx.arc(s * 46, -20, r, c - 0.9, c + 0.9);
    ctx.strokeStyle = '#3a2a00'; ctx.lineWidth = 9; ctx.stroke(); // the sound rings: golden with a dark edge, never white
    ctx.strokeStyle = `rgba(255,214,48,${0.7 + 0.3 * Math.sin(t * 6)})`; ctx.lineWidth = 5; ctx.stroke();
  }
  // cloud
  ctx.beginPath();
  ctx.arc(-26, -22, 24, Math.PI * 0.5, Math.PI * 1.55); ctx.arc(4, -40, 30, Math.PI * 1.1, Math.PI * 1.95); ctx.arc(32, -18, 22, Math.PI * 1.4, Math.PI * 0.5); ctx.closePath();
  const g = ctx.createLinearGradient(0, -70, 0, 4);
  g.addColorStop(0, '#8d98aa'); g.addColorStop(1, '#3d4656');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = '#141a24'; ctx.lineWidth = 6; ctx.stroke();
  // bolt
  ctx.beginPath();
  for (const [x, y] of [[12, -6], [-20, 28], [0, 28], [-16, 70], [28, 16], [8, 16], [24, -6]]) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fillStyle = '#ffe14a'; ctx.fill();
  ctx.strokeStyle = '#5a3c00'; ctx.lineWidth = 6; ctx.stroke();
  ctx.restore();
};
EMBLEM_ART.laser = (ctx, t) => { // the little laser cannon (drawLaserBeak, below), aiming up and right with its beam
  ctx.save();
  const a = -0.55, sz = 96, ox = -30, oy = 4, x0 = ox + Math.cos(a) * sz * 0.95, y0 = oy + Math.sin(a) * sz * 0.95;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,190,160,0.8)'; ctx.lineWidth = 20 + 4 * Math.sin(t * 9);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + Math.cos(a) * 60, y0 + Math.sin(a) * 60); ctx.stroke();
  ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = 8; ctx.stroke();
  ctx.translate(ox, oy);
  // a cream rim round the silhouette: the red cannon on red glass
  const c = Math.cos(a), sn = Math.sin(a), o = 7;
  ctx.fillStyle = ctx.strokeStyle = '#fff1d6';
  ctx.beginPath(); ctx.arc(0, sz * 0.17, sz * 0.38 + o, 0, TAU); ctx.fill();
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * sz * 0.21, sz * 0.52, sz * 0.14 + o, sz * 0.08 + o, 0, 0, TAU); ctx.fill(); }
  ctx.lineWidth = sz * 0.42 + o * 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(c * sz * 0.8, sn * sz * 0.8); ctx.stroke();
  ctx.beginPath(); ctx.arc(c * sz * 0.92, sn * sz * 0.92, sz * 0.3 + o, 0, TAU); ctx.fill();
  drawLaserBeak(ctx, sz, 0.75 + 0.25 * Math.sin(t * 7), 0, t, a, 3);
  ctx.restore();
};
EMBLEM_ART.spin = (ctx, t) => {
  ctx.save();
  ctx.rotate(-t * 2.2);
  ctx.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    ctx.save();
    ctx.rotate((k / 3) * TAU);
    for (const [w, c] of [[20, '#06332b'], [11, '#c9fff2']]) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(0, 0, 48, 0.25, 1.75); ctx.stroke(); }
    const a = 0.2, x = 48 * Math.cos(a), y = 48 * Math.sin(a);
    ctx.beginPath(); ctx.moveTo(x - 20, y + 4); ctx.lineTo(x + 18, y + 4); ctx.lineTo(x - 2, y - 22); ctx.closePath();
    ctx.fillStyle = '#c9fff2'; ctx.fill(); ctx.strokeStyle = '#06332b'; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = '#06332b'; ctx.lineWidth = 5; ctx.stroke();
  ctx.restore();
};
EMBLEM_ART.pepper = (ctx, t) => {
  ctx.save();
  // puffs drifting off
  for (let i = 0; i < 3; i++) {
    const u = (t * 0.6 + i / 3) % 1, x = 30 + u * 34, y = -40 - u * 26 + i * 6, r = 9 + u * 12;
    ctx.globalAlpha = 0.8 * (1 - u);
    ctx.fillStyle = '#d7a07a'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.rotate(-0.45);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-18, -40); ctx.bezierCurveTo(16, -48, 30, -14, 20, 18); ctx.bezierCurveTo(12, 44, -4, 62, 4, 70);
  ctx.bezierCurveTo(-22, 58, -30, 22, -30, -4); ctx.bezierCurveTo(-30, -24, -28, -36, -18, -40); ctx.closePath();
  const g = ctx.createLinearGradient(-30, 0, 26, 0);
  g.addColorStop(0, '#ff6a40'); g.addColorStop(0.6, '#d31d10'); g.addColorStop(1, '#8a0c05');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#330402'; ctx.lineWidth = 7; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-20, -18); ctx.quadraticCurveTo(-22, 12, -12, 36); ctx.stroke();
  // stem and cap
  ctx.beginPath(); ctx.moveTo(-24, -40); ctx.quadraticCurveTo(-4, -56, 14, -44); ctx.quadraticCurveTo(-2, -36, -24, -40); ctx.closePath();
  ctx.fillStyle = '#46b23c'; ctx.fill(); ctx.strokeStyle = '#123d0e'; ctx.lineWidth = 6; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-6, -48); ctx.quadraticCurveTo(-4, -66, 8, -72); ctx.strokeStyle = '#123d0e'; ctx.lineWidth = 11; ctx.stroke(); ctx.strokeStyle = '#46b23c'; ctx.lineWidth = 5; ctx.stroke();
  ctx.restore();
};
EMBLEM_ART.shrink = (ctx, t) => {
  ctx.save();
  ctx.setLineDash([14, 10]);
  ctx.lineDashOffset = -t * 30;
  eggPathL(ctx, 132);
  ctx.strokeStyle = '#2a0f4f'; ctx.lineWidth = 10; ctx.stroke();
  ctx.strokeStyle = '#ead8ff'; ctx.lineWidth = 5; ctx.stroke();
  ctx.setLineDash([]);
  const p = 1 + 0.06 * Math.sin(t * 5);
  eggPathL(ctx, 56 * p, 0, 6);
  const g = ctx.createRadialGradient(-6, -6, 2, 0, 6, 40);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#c8a6ff');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#2a0f4f'; ctx.lineWidth = 6; ctx.stroke();
  ctx.fillStyle = '#d9bcff'; ctx.strokeStyle = '#2a0f4f'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
  for (const [x, y, a] of [[-54, 6, 0], [54, 6, Math.PI], [0, -58, Math.PI / 2], [0, 72, -Math.PI / 2]]) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, -11); ctx.lineTo(-6, 11); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
};
EMBLEM_ART.iron = (ctx, t) => { ctx.save(); paintIron(ctx, 128, t, 7); ctx.restore(); };
EMBLEM_ART.decoy = (ctx, t) => { ctx.save(); ctx.rotate(Math.sin(t * 2) * 0.12); paintDecoy(ctx, 128, t, 7, false); ctx.restore(); };

// combo orbs (cards and the future album): the two orbs side by side with a spark between them
for (const C of COMBOS) {
  ORB_ART['combo_' + C.id] = (ctx, cx, cy, r, t) => {
    drawOrb(ctx, C.a, cx - r * 0.42, cy + r * 0.06, r * 0.66, t, true);
    drawOrb(ctx, C.b, cx + r * 0.42, cy - r * 0.06, r * 0.66, t + 1, true);
    ctx.save();
    star(ctx, cx, cy, r * (0.34 + 0.04 * Math.sin(t * 6)), 4, 0.35);
    ctx.fillStyle = '#fff3a8'; ctx.fill(); ctx.strokeStyle = '#6b4a00'; ctx.lineWidth = Math.max(1, r * 0.06); ctx.stroke();
    ctx.restore();
  };
}

// ---------- egg overlays (egg-local, h = 100, y-down)
EGG_ART.iron = (ctx, t) => paintIron(ctx, 100, t, 3.4);
EGG_ART.shrink = (ctx, t) => {
  ctx.save();
  ctx.rotate(t * 1.6);
  ctx.setLineDash([10, 9]);
  ctx.strokeStyle = 'rgba(200,160,255,0.95)';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(0, 0, 54, 62, 0, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  ctx.fillStyle = '#f3e8ff';
  for (let i = 0; i < 3; i++) { const a = -t * 2.4 + (i / 3) * TAU; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 7 + i); star(ctx, Math.cos(a) * 58, Math.sin(a) * 64, 8, 4, 0.35); ctx.fill(); }
  ctx.globalAlpha = 1;
};

// ---------- world layers
// px space at world (x, y): draw(k) in pixels, y down
function px(ctx, x, y, k, rot, draw) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.scale(1 / k, -1 / k);
  draw();
  ctx.restore();
}
function band(ctx, r0, r1, a0, a1) {
  ctx.beginPath();
  ctx.arc(0, 0, r1, a0, a1);
  ctx.arc(0, 0, r0, a1, a0, true);
  ctx.closePath();
}
// a segment is solid at ring-local angle la
function solidLa(ring, la) {
  la = ((la % TAU) + TAU) % TAU;
  for (const g of ring.segs) if (g.alive && ((la >= g.a0 && la < g.a1) || (la + TAU >= g.a0 && la + TAU < g.a1))) return true;
  return false;
}

// ======================================================================== 2026-11-20 polish: Sweep beam and Pepper twister
// (owner: "asset quality needs to be maintained ... those assets need to be properly animated"). Render only: what the
// powers DO is unchanged (sim/powers2.js). Exported pieces are reused by the level card's toy stages (howto.js).
const SEE_FONT = '"Fredoka", "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif'; // ui.js FONT
const BR = { base: '#d9a441', lo: '#a8712a', hi: '#ffe39a', dark: '#7a4c18', line: '#4a2a08' }; // brass
const mixHex = (a, b, u) => { const p = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16); u = clamp01(u); return `rgb(${[0, 1, 2].map((i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * u)).join(',')})`; };

// The laser cannon (v0.8.9, mykee: "a proper kind of laser, a small kind of cannon"; was a thin brass muzzle): a round red
// turret pod on two stubby feet, a swivel cap with a face, a short fat ivory barrel with two gold bands and a flared gold
// muzzle holding a big red crystal. The crystal glows up while a shot is ready and goes white-hot as it fires; the barrel
// kicks back and the pod squashes; a puff of smoke rolls off the muzzle after. Pixel space, y down: the pivot (the cap) at
// 0,0, the crystal s*0.95 out along aim (rad, y down; 0 = right). heat 0..1, rec 0..1 (the kick), shots: red lights on the
// pod's belt (-1: none), puff 0..1 over the smoke after a shot (0: none). The old 5-argument calls still work.
const CN = { pod: ['#e2493d', '#ac2c25', '#ff9a85'], ivy: ['#f7ecd2', '#d5bc8e', '#fffdf6'], gold: ['#f5b83a', '#c47c16', '#ffe9a6'], foot: '#8a3020', line: '#4a2410' };
export function drawLaserBeak(ctx, s, heat, rec, t, aim = 0, shots = 3, puff = 0) {
  const lw = Math.max(1.5, s * 0.055), L = CN.line, kick = clamp01(rec), c = Math.cos(aim), sn = Math.sin(aim);
  const lx = c * (s * 0.95 - kick * s * 0.2), ly = sn * (s * 0.95 - kick * s * 0.2), lr = s * 0.17; // the crystal, after the kick
  const path = (f) => { ctx.beginPath(); f(); };
  const fillLine = (col, w = lw) => { ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = L; ctx.lineWidth = w; ctx.stroke(); };
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (heat > 0.02) { // the glow the crystal throws: two soft discs, no gradient
    ctx.globalAlpha = 0.26 * heat; ctx.fillStyle = '#ff5a3c'; path(() => ctx.arc(lx, ly, lr * (2.2 + 1.8 * heat), 0, TAU)); ctx.fill();
    ctx.globalAlpha = 0.42 * heat; ctx.fillStyle = '#ffb08a'; path(() => ctx.arc(lx, ly, lr * (1.4 + 0.7 * heat), 0, TAU)); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // the pod and its feet squash down on the kick (anchored at the feet)
  const R = s * 0.38, py = s * 0.17, fy = py + R * 0.92;
  ctx.save();
  ctx.translate(0, fy); ctx.scale(1 + 0.1 * kick, 1 - 0.13 * kick); ctx.translate(0, -fy);
  for (const sx of [-1, 1]) { path(() => ctx.ellipse(sx * R * 0.55, fy, R * 0.36, R * 0.2, 0, 0, TAU)); fillLine(CN.foot); }
  const pod = () => path(() => ctx.arc(0, py, R, 0, TAU));
  pod(); ctx.fillStyle = CN.pod[1]; ctx.fill();
  ctx.save(); pod(); ctx.clip();
  path(() => ctx.arc(-R * 0.12, py - R * 0.14, R * 0.94, 0, TAU)); ctx.fillStyle = CN.pod[0]; ctx.fill();
  path(() => ctx.ellipse(-R * 0.42, py - R * 0.5, R * 0.26, R * 0.13, -0.6, 0, TAU)); ctx.fillStyle = CN.pod[2]; ctx.fill();
  const by = py + R * 0.38, bh = R * 0.34; // the gold belt with the shot lights
  ctx.fillStyle = CN.gold[0]; ctx.fillRect(-R, by - bh / 2, R * 2, bh);
  ctx.fillStyle = CN.gold[1]; ctx.fillRect(-R, by + bh * 0.18, R * 2, bh * 0.32);
  ctx.strokeStyle = L; ctx.lineWidth = lw * 0.8; ctx.beginPath(); ctx.moveTo(-R, by - bh / 2); ctx.lineTo(R, by - bh / 2); ctx.moveTo(-R, by + bh / 2); ctx.lineTo(R, by + bh / 2); ctx.stroke();
  ctx.restore();
  pod(); ctx.strokeStyle = L; ctx.lineWidth = lw; ctx.stroke();
  if (shots >= 0) for (let i = 0; i < 3; i++) {
    const x = (i - 1) * R * 0.5, on = i < shots, r = R * 0.14;
    path(() => ctx.arc(x, by, r, 0, TAU)); fillLine(on ? '#ff3b2f' : '#5a1a12', lw * 0.7);
    if (on) { ctx.fillStyle = '#ffd0c0'; path(() => ctx.arc(x - r * 0.3, by - r * 0.3, r * 0.35, 0, TAU)); ctx.fill(); }
  }
  ctx.restore();
  // the barrel turns on the cap; it kicks back along itself
  ctx.save();
  ctx.rotate(aim);
  if (c < 0) ctx.scale(1, -1); // pointing left: keep the light on top
  ctx.translate(-kick * s * 0.2, 0);
  const x0 = s * 0.08, x1 = s * 0.72, h0 = s * 0.21, h1 = s * 0.195;
  const barrel = () => path(() => { ctx.moveTo(x0, -h0); ctx.lineTo(x1, -h1); ctx.lineTo(x1, h1); ctx.lineTo(x0, h0); ctx.closePath(); });
  barrel(); ctx.fillStyle = CN.ivy[0]; ctx.fill();
  ctx.save(); barrel(); ctx.clip();
  ctx.fillStyle = CN.ivy[1]; ctx.fillRect(x0, h0 * 0.3, x1, h0);
  ctx.fillStyle = CN.ivy[2]; ctx.fillRect(x0 + s * 0.08, -h0 * 0.68, s * 0.5, h0 * 0.28);
  if (heat > 0.05) { ctx.globalAlpha = 0.5 * heat; ctx.fillStyle = '#ff7a4a'; ctx.fillRect(s * 0.5, -h0, s * 0.3, h0 * 2); ctx.globalAlpha = 1; } // it warms toward the muzzle
  ctx.restore();
  barrel(); ctx.strokeStyle = L; ctx.lineWidth = lw; ctx.stroke();
  for (const bx of [0.34, 0.56]) { // two gold bands
    const hb = s * (0.235 - bx * 0.03);
    path(() => ctx.roundRect ? ctx.roundRect(s * bx - s * 0.045, -hb, s * 0.09, hb * 2, s * 0.025) : ctx.rect(s * bx - s * 0.045, -hb, s * 0.09, hb * 2)); fillLine(CN.gold[0], lw * 0.85);
    ctx.fillStyle = CN.gold[2]; ctx.fillRect(s * bx - s * 0.022, -hb * 0.8, s * 0.044, hb * 0.35);
  }
  // the flared muzzle and its crystal
  const m0 = s * 0.7, m1 = s * 0.93, mh = s * 0.3;
  path(() => { ctx.moveTo(m0, -h1 - s * 0.02); ctx.quadraticCurveTo(s * 0.86, -h1, m1, -mh); ctx.lineTo(m1, mh); ctx.quadraticCurveTo(s * 0.86, h1, m0, h1 + s * 0.02); ctx.closePath(); }); fillLine(CN.gold[0]);
  ctx.save(); path(() => { ctx.moveTo(m0, s * 0.03); ctx.lineTo(m1, s * 0.08); ctx.lineTo(m1, mh); ctx.quadraticCurveTo(s * 0.86, h1, m0, h1 + s * 0.02); ctx.closePath(); }); ctx.fillStyle = CN.gold[1]; ctx.fill(); ctx.restore();
  ctx.fillStyle = CN.gold[2]; path(() => ctx.ellipse(s * 0.84, -s * 0.15, s * 0.05, s * 0.022, -0.5, 0, TAU)); ctx.fill();
  path(() => ctx.ellipse(m1, 0, s * 0.06, mh, 0, 0, TAU)); fillLine(CN.gold[1], lw * 0.85);
  const cx = m1 - s * 0.01; // the crystal: a fat faceted gem, dark red cold, red when charged, white-hot as it fires
  path(() => ctx.arc(cx, 0, lr, 0, TAU)); fillLine(mixHex('#7a1208', '#ff3b24', heat * 1.5));
  path(() => { ctx.moveTo(cx - lr * 0.55, -lr * 0.2); ctx.lineTo(cx - lr * 0.1, -lr * 0.62); ctx.lineTo(cx + lr * 0.5, -lr * 0.25); ctx.lineTo(cx + lr * 0.3, lr * 0.42); ctx.lineTo(cx - lr * 0.35, lr * 0.38); ctx.closePath(); });
  ctx.fillStyle = mixHex('#b02814', '#fff6ee', heat > 0.75 ? 1 : heat * 0.9); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; path(() => ctx.ellipse(cx - lr * 0.38, -lr * 0.42, lr * 0.2, lr * 0.11, -0.6, 0, TAU)); ctx.fill();
  ctx.restore();
  // the swivel cap with its face: eyes on where it aims, squeezed shut as it fires
  const cr = s * 0.25;
  path(() => ctx.arc(0, 0, cr, 0, TAU)); ctx.fillStyle = CN.pod[1]; ctx.fill();
  path(() => ctx.arc(-cr * 0.1, -cr * 0.12, cr * 0.86, 0, TAU)); ctx.fillStyle = CN.pod[0]; ctx.fill();
  path(() => ctx.ellipse(-cr * 0.45, -cr * 0.55, cr * 0.22, cr * 0.11, -0.6, 0, TAU)); ctx.fillStyle = CN.pod[2]; ctx.fill();
  path(() => ctx.arc(0, 0, cr, 0, TAU)); ctx.strokeStyle = L; ctx.lineWidth = lw; ctx.stroke();
  const ex = c * cr * 0.22, ey = sn * cr * 0.16 + cr * 0.05, squint = kick > 0.25;
  for (const sx of [-1, 1]) {
    const x = ex + sx * cr * 0.38, y = ey;
    if (squint) { ctx.strokeStyle = L; ctx.lineWidth = lw * 1.1; path(() => { ctx.moveTo(x - sx * cr * 0.16, y - cr * 0.15); ctx.lineTo(x + sx * cr * 0.1, y); ctx.lineTo(x - sx * cr * 0.16, y + cr * 0.15); }); ctx.stroke(); continue; }
    path(() => ctx.ellipse(x, y, cr * 0.25, cr * 0.31, 0, 0, TAU)); fillLine('#fffdf6', lw * 0.8);
    const blink = (t + 0.3) % 3.7 < 0.12;
    if (blink) { ctx.fillStyle = CN.pod[0]; path(() => ctx.ellipse(x, y, cr * 0.27, cr * 0.33, 0, 0, TAU)); ctx.fill(); ctx.strokeStyle = L; ctx.lineWidth = lw * 0.9; path(() => { ctx.moveTo(x - cr * 0.2, y); ctx.lineTo(x + cr * 0.2, y); }); ctx.stroke(); continue; }
    const qx = x + c * cr * 0.1, qy = y + sn * cr * 0.13;
    ctx.fillStyle = '#1e1008'; path(() => ctx.arc(qx, qy, cr * 0.15, 0, TAU)); ctx.fill();
    ctx.fillStyle = '#fff'; path(() => ctx.arc(qx - cr * 0.05, qy - cr * 0.06, cr * 0.055, 0, TAU)); ctx.fill();
  }
  if (heat > 0.8 && kick > 0.15) { // the shot: a white-hot star on the crystal
    ctx.fillStyle = '#fffaf0'; ctx.globalAlpha = Math.min(1, kick * 1.5);
    path(() => { for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + t * 3, r = i % 2 ? lr * 0.6 : lr * 1.5; ctx.lineTo(lx + Math.cos(a) * r, ly + Math.sin(a) * r); } ctx.closePath(); }); ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (puff > 0 && puff < 1) { // a puff of smoke rolls up off the muzzle
    for (let i = 0; i < 3; i++) {
      const q = clamp01(puff * 1.2 - i * 0.12), r = lr * (0.7 + 1.3 * q) * (1 - i * 0.15);
      ctx.globalAlpha = 0.75 * (1 - q) * (q > 0 ? 1 : 0);
      ctx.fillStyle = i === 1 ? '#c9c0b8' : '#e8e2dc';
      path(() => ctx.arc(lx + c * lr * (0.4 + q * 1.4) + (i - 1) * lr * 0.9, ly + sn * lr * (0.4 + q * 1.4) - q * s * 0.45 - i * lr * 0.3, r, 0, TAU)); ctx.fill();
      ctx.strokeStyle = 'rgba(74,36,16,0.45)'; ctx.lineWidth = lw * 0.6; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
export const BEAK_M = 0.74; // m: the cannon's reach to its crystal (an egg is 0.56 m tall: the cannon stands a little taller)

// sparks spraying where a beam meets something (world space at x, y; a = the beam's angle; n sparks; u = a seed clock)
export function beamSparks(ctx, x, y, a, k, u, n = 5, size = 1) {
  const R = rng(Math.floor(u * 40) + Math.floor((x + 9) * 31) + Math.floor((y + 9) * 17));
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const b = a + Math.PI + (R() - 0.5) * 2.2, l = (0.12 + 0.28 * R()) * size, o = 0.04 * R();
    ctx.strokeStyle = i % 2 ? '#fff3b0' : '#ffb03a'; ctx.lineWidth = Math.max(0.02, (1.6 + R()) / k) * size;
    ctx.beginPath(); ctx.moveTo(x + o * Math.cos(b), y + o * Math.sin(b)); ctx.lineTo(x + (o + l) * Math.cos(b), y + (o + l) * Math.sin(b)); ctx.stroke();
  }
  ctx.fillStyle = '#fff8e0'; ctx.beginPath(); ctx.arc(x, y, Math.max(0.035, 2.4 / k) * size, 0, TAU); ctx.fill();
  ctx.restore();
}
// a thorn the beam cut: a charred stub on the ring, its cut edge glowing, a wisp of smoke; u = 0..1 over its second
export function scorchStub(ctx, x, y, ang, h, k, u) {
  const a = 1 - clamp01((u - 0.6) / 0.4), glow = 1 - clamp01(u / 0.7);
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(x, y); ctx.rotate(ang); // +x points along the thorn (out of the wall)
  const w = 0.075, hh = h * 0.32;
  ctx.beginPath(); ctx.moveTo(0, -w); ctx.lineTo(hh, -w * 0.55); ctx.lineTo(hh * 0.92, w * 0.5); ctx.lineTo(0, w); ctx.closePath();
  ctx.fillStyle = '#2b1a12'; ctx.fill(); ctx.strokeStyle = 'rgba(20,10,6,0.9)'; ctx.lineWidth = Math.max(0.012, 1 / k); ctx.stroke();
  if (glow > 0) { ctx.strokeStyle = `rgba(255,${120 + 100 * glow},50,${glow})`; ctx.lineWidth = Math.max(0.03, 2.2 / k); ctx.beginPath(); ctx.moveTo(hh, -w * 0.55); ctx.lineTo(hh * 0.92, w * 0.5); ctx.stroke(); }
  for (let i = 0; i < 2; i++) { const q = (u * 1.4 + i * 0.45) % 1; ctx.globalAlpha = a * 0.45 * (1 - q); ctx.fillStyle = '#6b625c'; ctx.beginPath(); ctx.arc(hh + q * 0.45, (i ? 0.05 : -0.04) + Math.sin(q * 6 + i) * 0.04, 0.04 + q * 0.09, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// ---- pepper smoke: soft puffs (baked once into a small picture, three tints) with pepper specks that swirl
const PUFF = { cv: null };
function puffSprite() {
  if (PUFF.cv !== null) return PUFF.cv;
  PUFF.cv = false;
  if (typeof document === 'undefined') return false;
  try {
    const n = 96, cv = document.createElement('canvas'); cv.width = n * 3; cv.height = n;
    const q = cv.getContext('2d');
    [['#e4553a', '#b93524', '#ff9a7c'], ['#d84a31', '#a82c1d', '#f78c6e'], ['#ee6846', '#c2412a', '#ffae90']] /* 2026-11-23 (mykee: "the brown kind of paper thing... simply a red cloud"): pepper is red */.forEach(([b, lo, hi], i) => {
      const cx = n * i + n / 2, cy = n / 2, r = n * 0.4;
      const blob = (x, y, rr) => { q.beginPath(); q.arc(x, y, rr, 0, TAU); };
      q.save();
      blob(cx, cy, r); q.fillStyle = b; q.fill();
      q.save(); blob(cx, cy, r); q.clip();
      blob(cx + r * 0.18, cy + r * 0.32, r * 0.82); q.fillStyle = lo; q.fill(); // the shaded underside
      blob(cx - r * 0.06, cy - r * 0.04, r * 0.74); q.fillStyle = b; q.fill();
      blob(cx - r * 0.3, cy - r * 0.34, r * 0.34); q.fillStyle = hi; q.fill(); // the lit top
      q.restore();
      blob(cx, cy, r); q.strokeStyle = 'rgba(74,30,12,0.55)'; q.lineWidth = 3; q.stroke(); // thin, dark-tinted outline
      q.restore();
    });
    PUFF.cv = cv;
  } catch (e) { PUFF.cv = false; }
  return PUFF.cv;
}
function puff(ctx, x, y, r, tint, a) {
  const cv = puffSprite();
  if (a <= 0.01 || r <= 0) return;
  ctx.globalAlpha = a;
  if (cv) { ctx.save(); ctx.translate(x, y); ctx.scale(1, -1); ctx.drawImage(cv, (tint % 3) * 96, 0, 96, 96, -r * 1.25, -r * 1.25, r * 2.5, r * 2.5); ctx.restore(); }
  else { ctx.fillStyle = '#c98a5e'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
}
function speck(ctx, x, y, s, rot, col) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.55, 0, 0, TAU); ctx.fill(); ctx.restore(); }
// the cloud: world space, centre (x, y), radius r, f = how thick 0..1
export function drawPepperCloud(ctx, x, y, r, f, k, t) {
  if (f <= 0.01) return;
  ctx.save();
  const n = 11;
  for (let i = 0; i < n; i++) { // back to front: the lower puffs last
    const a = hash(i * 1.7) * TAU + t * 0.22 * (i % 2 ? 1 : -1), d = r * 0.58 * Math.sqrt(hash(i * 2.3 + 1)) * (0.7 + 0.3 * f);
    const pr = r * (0.34 + 0.16 * hash(i * 3.1)) * (0.7 + 0.3 * f) * (1 + 0.05 * Math.sin(t * 2.2 + i));
    puff(ctx, x + d * Math.cos(a), y + d * Math.sin(a) * 0.8 + r * 0.12 * (i / n - 0.5), pr, i, 0.93 * f);
  }
  ctx.globalAlpha = f;
  const sz = Math.max(0.022, 1.7 / k);
  for (let i = 0; i < 24; i++) { // pepper specks riding the smoke round
    const a = hash(i * 5.3) * TAU + t * (0.7 + hash(i) * 0.9) * (i % 3 ? 1 : -1), d = r * (0.25 + 0.6 * hash(i * 7.7 + 2));
    speck(ctx, x + d * Math.cos(a), y + d * Math.sin(a) * 0.82, sz * (0.8 + 0.6 * hash(i * 1.3)), a * 2 + t, i % 4 === 0 ? '#1b0a06' : '#7a1408');
  }
  ctx.fillStyle = '#ffd27a';
  for (let i = 0; i < 4; i++) { const a = hash(i * 9.1) * TAU + t * 1.3, d = r * 0.5 * hash(i * 4.4 + 3), tw = Math.sin(t * 9 + i * 2); if (tw > 0.2) { star(ctx, x + d * Math.cos(a), y + d * Math.sin(a), sz * 1.6 * tw, 4, 0.35); ctx.fill(); } }
  ctx.restore();
}
// the twister: the spin winds the smoke into a funnel that whirls, then flings it out. u 0..1 over TWIST_T s
export const TWIST_T = 1.6;
export function drawTwister(ctx, x, y, r, u, k, t) {
  if (u >= 1) return;
  const g = clamp01(u / 0.3), f = clamp01((u - 0.12) / 0.3), out = clamp01((u - 0.68) / 0.32), gE = g * g * (3 - 2 * g);
  ctx.save();
  // 1) the cloud is pulled in round and round
  if (f < 1) {
    for (let i = 0; i < 9; i++) {
      const a = hash(i * 1.7) * TAU + t * (2 + 9 * gE), d = r * 0.6 * (1 - 0.7 * gE) * (0.5 + 0.5 * hash(i * 2.3 + 1));
      puff(ctx, x + d * Math.cos(a), y + d * Math.sin(a) * 0.7, r * (0.36 + 0.12 * hash(i)) * (1 - 0.35 * gE), i, 0.92 * (1 - f));
    }
  }
  // 2) the funnel: narrow at the floor, wide at the top, each layer whirling faster near the bottom
  if (f > 0) {
    const H = r * 1.35 * (0.6 + 0.4 * f), lift = out * r * 0.7, spread = 1 + out * 0.5, n = 9, bend = r * 0.22;
    for (const front of [false, true]) {
      for (let j = 0; j < n; j++) {
        const h = j / (n - 1), yy = y - r * 0.3 + lift + H * h, rx = r * (0.07 + 0.42 * h * h + 0.06 * h) * spread, sz = r * (0.1 + 0.15 * h) * (1 - 0.3 * out);
        const sway = Math.sin(t * 3.1 + j * 0.6) * bend * h + bend * h * h; // the funnel leans and snakes as it whirls
        const m = 4 + Math.round(h * 4);
        for (let q = 0; q < m; q++) {
          const a = j * 0.9 + (q / m) * TAU + t * (12 - j * 0.8), sn = Math.sin(a);
          if ((sn > 0) !== front) continue;
          puff(ctx, x + sway + rx * Math.cos(a), yy + rx * 0.3 * sn, sz * (1 + 0.4 * out), j + q, (front ? 0.97 : 0.72) * f * (1 - out) * (1 - out));
        }
      }
    }
    // wind streaks and pepper whipped round the funnel
    ctx.globalAlpha = 0.8 * f * (1 - out);
    ctx.strokeStyle = 'rgba(255,248,236,0.9)'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(0.025, 2 / k);
    for (let j = 0; j < 3; j++) { const h = 0.3 + 0.3 * j, yy = y - r * 0.3 + lift + H * h, rx = r * (0.07 + 0.42 * h * h + 0.06 * h) * spread + r * 0.12, a0 = t * (8 - j) + j * 2; ctx.save(); ctx.translate(x + bend * h * h, yy); ctx.scale(1, 0.3); ctx.beginPath(); ctx.arc(0, 0, rx * 1.15, a0, a0 + 1.6); ctx.stroke(); ctx.restore(); }
    const sz = Math.max(0.022, 1.7 / k);
    for (let i = 0; i < 26; i++) {
      const j = i % n, h = j / (n - 1), yy = y - r * 0.3 + lift + H * h, rx = (r * (0.12 + 0.42 * h * h) * spread + r * 0.06) * (1 + out * 1.5), a = hash(i * 3.3) * TAU + t * (13 - j);
      ctx.globalAlpha = f * (1 - out * 0.8);
      speck(ctx, x + bend * h * h + rx * Math.cos(a), yy + rx * 0.3 * Math.sin(a), sz, a, i % 4 === 0 ? '#1b0a06' : '#7a1408');
    }
  }
  ctx.restore();
}
// a creature's sneeze, at its head (x, y), blowing along dir: "ah..." with watery eyes, then "CHOO!", a jolt and a
// spray of pepper. u 0..1 over SNEEZE_T s. sz = the creature's head size (m).
export const SNEEZE_T = 1.3;
export function drawSneeze(ctx, x, y, dir, u, k, t, sz = 0.5) {
  if (u >= 1 || u < 0) return;
  const ah = clamp01(u / 0.36), choo = clamp01((u - 0.36) / 0.64), fade = 1 - clamp01((u - 0.75) / 0.25);
  ctx.save();
  // watery eyes: two drops welling up and running off
  if (u < 0.75) for (let i = 0; i < 2; i++) {
    const q = (u * 2.2 + i * 0.5) % 1, dx = (i ? 1 : -1) * sz * 0.35, dy = sz * 0.25 - q * sz * 0.5, s = Math.max(0.045, 3.2 / k) * (0.6 + 0.6 * ah);
    ctx.globalAlpha = (1 - q) * Math.min(1, ah * 2) * fade;
    ctx.beginPath(); ctx.moveTo(x + dx, y + dy - s * 1.4); ctx.quadraticCurveTo(x + dx + s, y + dy, x + dx, y + dy + s * 0.6); ctx.quadraticCurveTo(x + dx - s, y + dy, x + dx, y + dy - s * 1.4);
    ctx.fillStyle = '#9fdcff'; ctx.fill(); ctx.strokeStyle = '#1d5d8a'; ctx.lineWidth = Math.max(0.012, 1 / k); ctx.stroke();
  }
  // the spray: pepper and spit blown out along dir, and three jolt lines
  if (choo > 0) {
    const c = Math.cos(dir), s = Math.sin(dir);
    ctx.globalAlpha = fade;
    for (let i = 0; i < 12; i++) {
      const b = dir + (hash(i * 2.1) - 0.5) * 1.1, d = sz * (0.3 + (0.6 + hash(i)) * 1.6 * Math.pow(choo, 0.6)), ps = Math.max(0.025, (1.6 + 1.6 * hash(i * 5)) / k);
      ctx.fillStyle = i % 3 === 0 ? '#e0502a' : i % 3 === 1 ? '#ffb07a' : '#7a1408';
      ctx.beginPath(); ctx.arc(x + d * Math.cos(b), y + d * Math.sin(b), ps * (1 - 0.4 * choo), 0, TAU); ctx.fill();
    }
    if (choo < 0.5) { ctx.strokeStyle = '#fff6e6'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(0.025, 2.2 / k); for (let i = -1; i <= 1; i++) { const b = dir + Math.PI + i * 0.5, r0 = sz * (0.55 + choo), r1 = r0 + sz * 0.35; ctx.globalAlpha = 1 - choo * 2; ctx.beginPath(); ctx.moveTo(x + r0 * Math.cos(b), y + r0 * Math.sin(b)); ctx.lineTo(x + r1 * Math.cos(b), y + r1 * Math.sin(b)); ctx.stroke(); } }
    if (choo < 0.6) puff(ctx, x + c * sz * (0.5 + choo), y + s * sz * (0.5 + choo), sz * (0.25 + 0.4 * choo), 2, 0.8 * (1 - choo / 0.6));
  }
  // the words, in pixel space over the head
  const word = (txt, px0, py0, size, fill, a, sc) => {
    if (a <= 0.01) return;
    ctx.save(); ctx.translate(px0, py0); ctx.scale(1 / k, -1 / k); ctx.scale(sc, sc);
    ctx.globalAlpha = a; ctx.font = `700 ${Math.round(size)}px ${SEE_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size * 0.22); ctx.strokeStyle = '#4a1a08'; ctx.strokeText(txt, 0, 0); ctx.fillStyle = fill; ctx.fillText(txt, 0, 0);
    ctx.restore();
  };
  const fs = Math.max(13, Math.min(22, k * 0.42));
  word('ah...', x - sz * 0.1, y + sz * 0.75 + ah * sz * 0.25, fs * (0.8 + 0.25 * ah), '#ffe6c8', ah * (1 - choo * 2.5), 1 + 0.06 * Math.sin(t * 9));
  if (choo > 0) word('CHOO!', x + Math.cos(dir) * sz * 0.4, y + sz * 0.95 + choo * sz * 0.3, fs * 1.35, '#ffb07a', fade, choo < 0.15 ? 0.6 + 0.4 * (choo / 0.15) * 1.25 : 1.05 - 0.05 * clamp01((choo - 0.15) / 0.2));
  ctx.restore();
}

// ---- in-play state of the polish (render side only; keyed to the sim it belongs to)
const POL = { sim: null, seen: new WeakSet(), stubs: [], tw: null };
function polFor(sim) { if (POL.sim !== sim) { POL.sim = sim; POL.seen = new WeakSet(); POL.stubs.length = 0; POL.tw = null; } return POL; }
// creatures a twister reaches: where each one's head is now (live), for its sneeze
function sneezers(sim) {
  const L = [];
  for (const S of sim.snakes || []) if (!S.gone && S.pts && S.pts.length) L.push({ k: 's', o: S, sz: 0.45 * (S.size || 1) });
  for (const C of sim.sals || []) if (C.pts && C.pts.length && (!sim.salLive || sim.salLive(C))) L.push({ k: 'c', o: C, sz: 0.5 * (C.size || 1) });
  if (sim.eagle && !sim.eagle.end) L.push({ k: 'e', o: sim.eagle, sz: 0.8 });
  for (const F of sim.frogs || []) L.push({ k: 'x', o: F, sz: 0.5 });
  for (const G of sim.gators || []) if (G.ph !== 'hid' && G.ph !== 'gone' && G.ph !== 'beaten') L.push({ k: 'g', o: G, sz: 0.6 });
  for (const T of sim.turtles || []) L.push({ k: 'x', o: T, sz: 0.5 });
  for (const Q of sim.mosqs || []) L.push({ k: 'x', o: Q, sz: 0.45 });
  return L;
}
function headOf(w) { const o = w.o; if (w.k === 's' || w.k === 'c') return o.pts[0] || null; return Number.isFinite(o.x) ? o : null; }

// a point of a ring (any shape) at ring-local angle la and radius-equivalent rad, in world space (A = the ring's angle)
function onRing(ring, A, la, rad) { const [x, y] = ringPt(ring, la, rad), c = Math.cos(A), s = Math.sin(A); return [x * c - y * s, x * s + y * c]; }
// The Electromagnet (shock + iron) in the level, 0.8.15: the live ring PULLS and it shows. Chevrons march onto the ring from
// both sides all the way round (on = they march, off = they are gone), and every iron egg in reach is tied to it by field
// lines that tighten and brighten as it is hauled in; where an egg clings, sparks jump. No magnet object is drawn: the ring
// is the magnet (as the magnet power's two eggs are its poles, render/magnet.js). a = strength 0..1.
const MAG_SEE = 1.9; // m from the ring an iron egg shows its field lines (the sim pulls inside RING_TH / 2 + 0.55)
export function drawMagnetPull(ctx, sim, ring, k, t, a) {
  if (!(a > 0)) return;
  const A = ring.body.getAngle(), n = Math.max(10, Math.round((TAU * ring.r) / 0.55)), lwc = Math.max(0.03, 1.8 / k);
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // 1) the pull, all round the ring: chevrons close in on it from inside and outside
  for (const side of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const la = ((i + (side > 0 ? 0.5 : 0)) / n) * TAU;
      if (!solidLa(ring, la)) continue;
      for (let j = 0; j < 2; j++) {
        const u = (t * 1.5 + j * 0.5 + i * 0.37) % 1, d = RING_TH / 2 + 0.06 + (1 - u) * 0.34, w = 0.07 + 0.03 * (1 - u);
        const [x0, y0] = onRing(ring, A, la - w / ring.r, ring.r + side * (d + 0.07)), [x1, y1] = onRing(ring, A, la, ring.r + side * d), [x2, y2] = onRing(ring, A, la + w / ring.r, ring.r + side * (d + 0.07));
        ctx.globalAlpha = a * Math.min(1, u * 3) * (0.35 + 0.6 * u);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2);
        ctx.strokeStyle = '#0b2a52'; ctx.lineWidth = lwc * 2.2; ctx.stroke();
        ctx.strokeStyle = side > 0 ? '#8fdcff' : '#ff9a8a'; ctx.lineWidth = lwc; ctx.stroke();
      }
    }
  }
  // 2) each iron egg in reach: three field lines from the ring to it, dashes running to the ring; arcs where it clings
  for (const e of sim.aliveEggs()) {
    if (!e.iron) continue;
    const p = e.body.getPosition(), la = Math.atan2(p.y, p.x) - A, [cx, cy] = onRing(ring, A, la, ring.r), gap = Math.hypot(p.x - cx, p.y - cy);
    if (gap > MAG_SEE) continue;
    const pull = clamp01(1 - (gap - 0.3) / (MAG_SEE - 0.3)), stuck = gap < RING_TH / 2 + 0.38;
    for (let j = -1; j <= 1; j++) {
      const [rx, ry] = onRing(ring, A, la + (j * 0.34) / ring.r, ring.r), mx = (rx + p.x) / 2 + (cx - p.x) * 0.0 + (rx - cx) * 0.9, my = (ry + p.y) / 2 + (ry - cy) * 0.9;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(mx, my, rx, ry);
      ctx.globalAlpha = a * (0.3 + 0.6 * pull);
      ctx.setLineDash([]); ctx.strokeStyle = 'rgba(11,42,82,0.8)'; ctx.lineWidth = lwc * 2.4; ctx.stroke();
      ctx.setLineDash([0.09, 0.08]); ctx.lineDashOffset = -t * (0.5 + 0.9 * pull);
      ctx.strokeStyle = j ? '#8fdcff' : '#ffffff'; ctx.lineWidth = lwc * 1.15; ctx.stroke();
    }
    ctx.setLineDash([]);
    if (stuck) {
      const R = rng(Math.floor(t * 18) + e.id * 31);
      ctx.globalAlpha = a;
      for (let j = 0; j < 2; j++) { const q = R() * TAU; zig(ctx, cx + (R() - 0.5) * 0.3, cy + (R() - 0.5) * 0.3, p.x + Math.cos(q) * 0.2, p.y + Math.sin(q) * 0.2, 4, 0.07, R); boltStroke(ctx, Math.max(0.03, 1.4 / k), 1); }
    }
  }
  ctx.restore();
}

// the live ring (shock): a blue glow along its solid wall and bolts crawling round it; a = strength 0..1. Also the level
// card's Electromagnet stage (howto.js).
export function drawLiveRing(ctx, ring, k, t, a, seed = 0) {
  const A = ring.body.getAngle();
    ctx.save();
    ctx.globalAlpha = a * (0.55 + 0.2 * Math.sin(t * 17));
    ctx.strokeStyle = 'rgba(110,200,255,1)';
    ctx.lineWidth = RING_TH + 0.1;
    const n = Math.ceil((TAU * ring.r) / 0.12);
    ctx.beginPath();
    let on = false;
    for (let i = 0; i <= n; i++) {
      const la = (i / n) * TAU, s = solidLa(ring, la), [X, Y] = onRing(ring, A, la, ring.r); // 0.8.15: follows square, hex and spiral rings (it drew a circle)
      if (s) { if (!on) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); }
      on = s;
    }
    ctx.stroke();
    ctx.globalAlpha = a;
    const R = rng(Math.floor(t * 20) + seed * 77);
    ctx.lineJoin = 'round';
    for (let j = 0; j < 7; j++) {
      const la = R() * TAU, len = 0.35 + R() * 0.45;
      if (!solidLa(ring, la) || !solidLa(ring, la + len / ring.r)) continue;
      ctx.beginPath();
      for (let q = 0; q <= 6; q++) { const [X, Y] = onRing(ring, A, la + (q / 6) * (len / ring.r), ring.r + (R() - 0.5) * 0.2); q ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
      boltStroke(ctx, Math.max(0.03, 1.5 / k), 1);
    }
    ctx.restore();
}
// the wooden decoy egg at world (x, y), h m tall (level card: Bait and switch)
export function drawDecoyAt(ctx, x, y, h, k, t, rot = 0) { px(ctx, x, y, k, rot, () => paintDecoy(ctx, h * k, t, Math.max(1.6, k * 0.035), false)); }

// Under the eggs: the live ring, scorched sponge, iron bars, frosted thorns, blacked-out doors and portals, the beak.
export function drawP2Back(ctx, sim, k, t) {
  const P = sim.p2;
  if (!P) return;
  const lw = (n) => Math.max(n / k, 0.012);
  // scorched sponge
  for (const ring of sim.rings) {
    const A = ring.body.getAngle(), ri = ring.r - RING_TH / 2;
    for (const sg of ring.segs) {
      if (!sg.padBurnt || !sg.alive) continue;
      ctx.fillStyle = '#2b1a12';
      band(ctx, ri - 0.05, ri + 0.02, A + sg.a0, A + sg.a1);
      ctx.fill();
      const m = A + (sg.a0 + sg.a1) / 2, R = rng(Math.floor(m * 100));
      ctx.fillStyle = `rgba(255,${120 + 60 * Math.sin(t * 5 + m * 9)},40,0.85)`;
      for (let j = 0; j < 2; j++) { const a = A + sg.a0 + (sg.a1 - sg.a0) * R(); ctx.beginPath(); ctx.arc((ri - 0.025) * Math.cos(a), (ri - 0.025) * Math.sin(a), 0.018, 0, TAU); ctx.fill(); }
    }
  }
  // frost nova: every thorn wears an ice coat (brittle)
  if (P.nova > 0) {
    const a = Math.min(1, P.nova / 0.5, (P2.frostnova.t - P.nova) / 0.3);
    ctx.save();
    ctx.globalAlpha = a;
    for (const ring of sim.rings) {
      const A = ring.body.getAngle();
      for (const th of ring.thorns) {
        if (!th.alive || th.ext < 0.5) continue;
        const half = 0.15 / ring.r, base = th.base, tip = th.base + (th.tip - th.base) * 1.12, w = A + th.a;
        ctx.beginPath();
        ctx.moveTo(base * Math.cos(w - half), base * Math.sin(w - half));
        ctx.lineTo(tip * Math.cos(w), tip * Math.sin(w));
        ctx.lineTo(base * Math.cos(w + half), base * Math.sin(w + half));
        ctx.closePath();
        ctx.fillStyle = 'rgba(205,242,255,0.72)'; ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = lw(1.6); ctx.stroke();
        const mid = (base + tip) / 2;
        ctx.strokeStyle = 'rgba(40,120,170,0.9)'; ctx.lineWidth = lw(1.2);
        ctx.beginPath(); ctx.moveTo(mid * Math.cos(w - half * 0.3), mid * Math.sin(w - half * 0.3)); ctx.lineTo(((mid + tip) / 2) * Math.cos(w + half * 0.2), ((mid + tip) / 2) * Math.sin(w + half * 0.2)); ctx.stroke();
      }
    }
    ctx.restore();
  }
  // iron bars across narrow gaps, while iron is on
  if (sim.aliveEggs().some((e) => e.iron && !(e.shrink > 0))) {
    for (const ring of sim.rings) {
      const A = ring.body.getAngle();
      for (const g of ring.gaps) {
        if (!g.ironBar) continue;
        const half = g.len / (2 * ringSpd(ring, g.a)), a0 = A + g.a - half, a1 = A + g.a + half; // v4: shape-aware
        const at = (wa, rad) => { if (!ring.prof) return [rad * Math.cos(wa), rad * Math.sin(wa)]; const [x, y] = ringPt(ring, wa - A, rad); return [x * Math.cos(A) - y * Math.sin(A), x * Math.sin(A) + y * Math.cos(A)]; };
        const bar = (rad) => { ctx.beginPath(); for (let i = 0; i <= 8; i++) { const [x, y] = at(a0 + ((a1 - a0) * i) / 8, rad); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } };
        ctx.lineCap = 'butt';
        ctx.strokeStyle = '#1a2027'; ctx.lineWidth = Math.max(0.09, 4 / k);
        bar(ring.r); ctx.stroke();
        ctx.strokeStyle = '#9aa6b2'; ctx.lineWidth = Math.max(0.05, 2.2 / k); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = lw(1); bar(ring.r + 0.012); ctx.stroke();
        for (const b of [a0 + 0.02, a1 - 0.02]) { const [x, y] = at(b, ring.r); ctx.beginPath(); ctx.arc(x, y, 0.045, 0, TAU); ctx.fillStyle = '#d6dde4'; ctx.fill(); ctx.strokeStyle = '#1a2027'; ctx.lineWidth = lw(1.2); ctx.stroke(); }
      }
    }
  }
  // blackout: dead portals and stuck doors
  if (P.dark > 0) {
    const a = Math.min(1, P.dark / 0.4);
    ctx.save();
    ctx.globalAlpha = a;
    for (const pt of sim.portals) for (const [x, y] of [[pt.ax, pt.ay], [pt.bx, pt.by]]) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, 0.5);
      g.addColorStop(0, 'rgba(8,8,14,0.95)'); g.addColorStop(0.7, 'rgba(20,20,30,0.85)'); g.addColorStop(1, 'rgba(20,20,30,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 0.5, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#5b6170'; ctx.lineWidth = lw(2); ctx.beginPath(); ctx.arc(x, y, 0.3, 0, TAU); ctx.stroke();
      if (Math.sin(t * 23 + x * 7) > 0.85) { zig(ctx, x - 0.2, y + 0.1, x + 0.18, y - 0.08, 4, 0.06, rng(Math.floor(t * 30))); boltStroke(ctx, lw(1), 1); }
    }
    for (const ring of sim.rings) {
      const A = ring.body.getAngle();
      for (const g of ring.gaps) {
        if (!g.shut) continue;
        const half = g.len / (2 * ring.r);
        band(ctx, ring.r - RING_TH / 2 - 0.03, ring.r + RING_TH / 2 + 0.03, A + g.a - half - 0.03, A + g.a + half + 0.03);
        ctx.fillStyle = 'rgba(10,10,18,0.45)'; ctx.fill();
        const q = A + g.a + half + 0.06, on = Math.sin(t * 4) > 0;
        ctx.beginPath(); ctx.arc(ring.r * Math.cos(q), ring.r * Math.sin(q), 0.05, 0, TAU);
        ctx.fillStyle = on ? '#ff3b2f' : '#5a1410'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = lw(1); ctx.stroke();
      }
    }
    ctx.restore();
  }
  // the live ring: lightning crawls round it
  if (P.shock > 0 && P.shockR >= 0) drawLiveRing(ctx, sim.rings[P.shockR], k, t, Math.min(1, P.shock / 0.3, (P2.shock.t - P.shock) / 0.2) * (P.shock < 1.5 ? (Math.sin(t * 30) > 0 ? 1 : 0.35) : 1), P.shockR);
  if (P.shock > 0 && P.shockR >= 0 && P.iron > 0) drawMagnetPull(ctx, sim, sim.rings[P.shockR], k, t, Math.min(1, P.shock / 0.3, P.iron / 0.3, (P2.shock.t - P.shock) / 0.25 + 0.05));
  // the laser cannon in the middle of the vault, turned where it last fired (lights on its belt: shots left). 2026-11-23:
  // a chunky cartoon cannon (was a brass muzzle): the crystal glows while a shot is ready, the barrel kicks back, the pod
  // squashes and the crystal goes white-hot as it fires, then a puff of smoke; it shudders through the sweep.
  if (P.laser > 0 && (P.shots > 0 || P.sweep >= 0 || P.beams.length)) {
    const s = Math.max(BEAK_M * k, 24), ready = P.shots > 0 && P.sweep < 0;
    let heat = ready ? 0.35 + 0.25 * Math.sin(t * 6) : 0.15, rec = 0, puff = 0;
    for (const B of P.beams) { heat = Math.max(heat, 1 - B.t / 0.5); rec = Math.max(rec, 1 - B.t / 0.18); }
    const last = P.beams[P.beams.length - 1];
    if (last && P.sweep < 0) puff = clamp01((last.t - 0.05) / 0.45);
    if (P.sweep >= 0) { heat = Math.max(heat, Math.min(1, 0.4 + P.sweep * 3) * (0.88 + 0.12 * Math.sin(t * 40))); rec = Math.max(rec, 0.35 + 0.15 * Math.sin(t * 55)); }
    px(ctx, 0, 0, k, 0, () => drawLaserBeak(ctx, s, heat, rec, t, -P.aim, P.shots, puff)); // px flips y: a world angle a is -a on screen
  }
  // thorns the beam cut: a charred stub each, for a second
  const PL = polFor(sim), cutting = P.laser > 0 || P.sweep >= 0 || P.beams.length > 0;
  for (const ring of sim.rings) for (const th of ring.thorns) if (!th.alive && !PL.seen.has(th)) { PL.seen.add(th); if (cutting && PL.stubs.length < 24) PL.stubs.push({ ring, th, t0: sim.t }); }
  for (let i = PL.stubs.length - 1; i >= 0; i--) {
    const S = PL.stubs[i], u = (sim.t - S.t0) / 1.1;
    if (u >= 1 || u < 0) { PL.stubs.splice(i, 1); continue; }
    const th = S.th, w = S.ring.body.getAngle() + th.a, out = th.tip > th.base ? 0 : Math.PI, bx = th.base * Math.cos(w), by = th.base * Math.sin(w);
    scorchStub(ctx, bx, by, w + out, Math.abs(th.tip - th.base), k, u);
    if (u < 0.3) beamSparks(ctx, bx + (th.tip - th.base) * 0.3 * Math.cos(w), by + (th.tip - th.base) * 0.3 * Math.sin(w), P.aim, k, t, 6, 1.1 - u * 2);
  }
}

// ice crust along a body (world points), w wide
function crustAlong(ctx, pts, w, k, a, step = 2) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += step) i ? ctx.lineTo(pts[i].x, pts[i].y) : ctx.moveTo(pts[i].x, pts[i].y);
  ctx.strokeStyle = 'rgba(25,85,135,0.75)'; ctx.lineWidth = w + Math.max(0.05, 3 / k); ctx.stroke();
  ctx.strokeStyle = 'rgba(205,243,255,0.62)'; ctx.lineWidth = w; ctx.stroke();
  ctx.setLineDash([0.12, 0.3]);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = w * 0.16; ctx.stroke();
  ctx.setLineDash([]);
  // shards sticking out
  for (let i = 4; i < pts.length - 2; i += 9) {
    const p = pts[i], q = pts[i + 1], l = Math.hypot(q.x - p.x, q.y - p.y) || 1, nx = -(q.y - p.y) / l, ny = (q.x - p.x) / l, s = i % 2 ? 1 : -1, h = w * (0.55 + 0.25 * hash(i));
    ctx.beginPath();
    ctx.moveTo(p.x + nx * s * w * 0.4 - (q.x - p.x) / l * w * 0.18, p.y + ny * s * w * 0.4 - (q.y - p.y) / l * w * 0.18);
    ctx.lineTo(p.x + nx * s * (w * 0.4 + h), p.y + ny * s * (w * 0.4 + h));
    ctx.lineTo(p.x + nx * s * w * 0.4 + (q.x - p.x) / l * w * 0.18, p.y + ny * s * w * 0.4 + (q.y - p.y) / l * w * 0.18);
    ctx.closePath();
    ctx.fillStyle = '#eafcff'; ctx.fill(); ctx.strokeStyle = 'rgba(25,85,135,0.9)'; ctx.lineWidth = Math.max(0.015, 1 / k); ctx.stroke();
  }
  ctx.restore();
}
function iceBlock(ctx, x, y, rx, ry, k, a, t) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x, y);
  ctx.beginPath();
  const n = 9;
  for (let i = 0; i < n; i++) { const b = (i / n) * TAU, f = 0.86 + 0.18 * hash(i * 3.1); i ? ctx.lineTo(rx * f * Math.cos(b), ry * f * Math.sin(b)) : ctx.moveTo(rx * f * Math.cos(b), ry * f * Math.sin(b)); }
  ctx.closePath();
  const g = ctx.createLinearGradient(-rx, ry, rx, -ry);
  g.addColorStop(0, 'rgba(240,252,255,0.7)'); g.addColorStop(1, 'rgba(120,195,235,0.5)');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(25,85,135,0.85)'; ctx.lineWidth = Math.max(0.03, 2 / k); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = Math.max(0.025, 1.6 / k);
  ctx.beginPath(); ctx.moveTo(-rx * 0.55, ry * 0.25); ctx.lineTo(-rx * 0.2, ry * 0.6); ctx.moveTo(-rx * 0.4, ry * 0.05); ctx.lineTo(-rx * 0.28, ry * 0.18); ctx.stroke();
  void t;
  ctx.restore();
}
function sparks(ctx, x, y, R, k, t, seed) {
  const r = rng(Math.floor(t * 16) + seed * 13);
  ctx.save();
  ctx.lineJoin = 'round';
  for (let i = 0; i < 3; i++) {
    const a = r() * TAU, b = a + 0.6 + r() * 0.8;
    zig(ctx, x + R * Math.cos(a), y + R * Math.sin(a), x + R * 1.1 * Math.cos(b), y + R * 1.1 * Math.sin(b), 4, R * 0.25, r);
    boltStroke(ctx, Math.max(0.03, 1.4 / k), 1);
  }
  ctx.restore();
}
function sneeze(ctx, x, y, dir, k, t, seed) {
  ctx.save();
  for (let i = 0; i < 4; i++) {
    const u = (t * 1.3 + i / 4 + seed * 0.37) % 1, d = 0.15 + u * 0.7, a = dir + (hash(i + seed) - 0.5) * 1.2;
    ctx.globalAlpha = 0.75 * (1 - u);
    ctx.fillStyle = i % 2 ? '#c98a62' : '#e0b08a';
    ctx.beginPath(); ctx.arc(x + d * Math.cos(a), y + d * Math.sin(a), 0.07 + u * 0.16, 0, TAU); ctx.fill();
    ctx.fillStyle = '#4a1208';
    ctx.beginPath(); ctx.arc(x + d * Math.cos(a) + 0.03, y + d * Math.sin(a) - 0.02, Math.max(0.015, 1 / k), 0, TAU); ctx.fill();
  }
  ctx.restore();
}
function dizzy(ctx, x, y, k, t) {
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const a = t * 5 + (i / 3) * TAU, sx = x + 0.32 * Math.cos(a), sy = y + 0.3 + 0.1 * Math.sin(a);
    star(ctx, sx, sy, Math.max(0.07, 4 / k), 5, 0.45);
    ctx.fillStyle = '#ffe14a'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(0.012, 1 / k); ctx.stroke();
  }
  ctx.restore();
}
function sweat(ctx, x, y, k, t) {
  ctx.save();
  for (let i = 0; i < 2; i++) {
    const u = (t * 1.6 + i * 0.5) % 1, dx = (i ? 0.22 : -0.2) + (i ? 1 : -1) * u * 0.12, dy = 0.28 - u * 0.25, s = Math.max(0.06, 3.5 / k);
    ctx.globalAlpha = 1 - u;
    ctx.beginPath(); ctx.moveTo(x + dx, y + dy + s * 1.4); ctx.quadraticCurveTo(x + dx + s, y + dy, x + dx, y + dy - s * 0.6); ctx.quadraticCurveTo(x + dx - s, y + dy, x + dx, y + dy + s * 1.4);
    ctx.fillStyle = '#9fdcff'; ctx.fill(); ctx.strokeStyle = '#1d5d8a'; ctx.lineWidth = Math.max(0.012, 1 / k); ctx.stroke();
  }
  ctx.restore();
}
// what a power is doing to one creature: k = ice | zap | pep | scare | spin
function creatureFx(ctx, F, k, t, at, seed) {
  const a = Math.min(1, F.t / 0.3, (F.max - F.t) / 0.15 + 0.2);
  if (F.k === 'zap') { if (!strikeMuteAt(at.x, at.y)) sparks(ctx, at.x, at.y, at.r * 0.8, k, t, seed); }
  else if (F.k === 'pep') sneeze(ctx, at.x, at.y, at.dir ?? Math.atan2(at.y, at.x), k, t, seed);
  else if (F.k === 'scare') sweat(ctx, at.x, at.y, k, t);
  else if (F.k === 'spin') dizzy(ctx, at.x, at.y, k, t);
  else if (F.k === 'ice' && at.block) iceBlock(ctx, at.x, at.y, at.block[0], at.block[1], k, a, t);
}

// Over everything in the vault: the decoy, creature effects, beams, the spin, the thunderclap and the pepper cloud.
export function drawP2Front(ctx, sim, k, t) {
  const P = sim.p2;
  if (!P) return;
  // shrink ending: a ghost outline of the full-size egg pulses where it will grow back
  for (const e of sim.aliveEggs()) {
    if (!(e.shrink > 0) || e.shrink > 1.3) continue;
    const p = e.body.getPosition(), s = { ostrich: 1.3 }[e.kind] || 1;
    px(ctx, p.x, p.y, k, e.body.getAngle(), () => {
      ctx.setLineDash([4, 3]);
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 14);
      eggPathL(ctx, EGG_H * s * k);
      ctx.strokeStyle = '#e6d2ff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.setLineDash([]);
    });
  }
  // the decoy
  const D = sim.p2d;
  if (D && D.alive && P.decoy && !P.decoy.stk) { // the decoy chick (Chick Strike) is drawn by render/strike.js
    const p = D.body.getPosition(), blink = P.decoy.t < 1.5 && Math.sin(t * 22) < -0.2;
    px(ctx, p.x, p.y, k, D.body.getAngle(), () => {
      ctx.save();
      ctx.globalAlpha = blink ? 0.45 : 1;
      paintDecoy(ctx, EGG_H * D.s * k, t, Math.max(1.6, k * 0.035), P.decoy.pepper);
      ctx.restore();
    });
    if (P.decoy.pepper) sneeze(ctx, p.x, p.y + 0.35, Math.PI / 2, k, t * 0.6, 3);
  }
  // creatures
  for (const key in P.fx) {
    const F = P.fx[key];
    if (key[0] === 's') {
      const S = sim.snakes.find((s) => s.id === +key.slice(1));
      if (!S || S.gone || !S.pts.length) continue;
      if (F.k === 'ice' || F.k === 'zap' || F.k === 'spin') continue; // frozen, zapped and dizzy are drawn into the snake (render/snake.js)
      const h = S.pts[0], q = S.pts[Math.min(3, S.pts.length - 1)];
      creatureFx(ctx, F, k, t, { x: h.x, y: h.y, r: 0.45 * S.size, dir: Math.atan2(h.y - q.y, h.x - q.x), block: F.k === 'ice' ? [0.36 * S.size, 0.3 * S.size] : null }, S.id + 1);
    } else if (key[0] === 'c') {
      const C = (sim.sals || []).find((c) => c.id === +key.slice(1));
      if (!C || !sim.salLive(C)) continue;
      // frozen / zapped / dizzy salamanders are drawn by the creature itself (render/salamander.js + status.js)
      const h = C.pts[0], q = C.pts[Math.min(4, C.pts.length - 1)];
      if (F.k === 'pep' || F.k === 'scare') creatureFx(ctx, F, k, t, { x: h.x, y: h.y, r: 0.5 * C.size, dir: Math.atan2(h.y - q.y, h.x - q.x) }, 20 + C.id);
    } else if (key === 'e' && sim.eagle) {
      const E = sim.eagle; // frozen / stunned: the eagle's own art (world.js drawEagleAt + status.js)
      if (F.k === 'pep' || F.k === 'scare') creatureFx(ctx, F, k, t, { x: E.x, y: E.y, r: 0.9, dir: E.face > 0 ? 0 : Math.PI, block: [1.2, 0.75] }, 40);
    } else if (key === 'b' && sim.bx && sim.bx.boss) {
      const B = sim.bx.boss;
      if ((B.kind === 'blizzard' || B.kind === 'golem') && (F.k === 'ice' || F.k === 'zap' || F.k === 'spin')) continue; // the mammoth and the golem draw their own states (render/boss.js)
      creatureFx(ctx, F, k, t, { x: B.x, y: B.y, r: 0.9, dir: -Math.PI / 2, block: [1.1, 0.9] }, 60);
    }
  }
  // laser beams (and the sweep)
  const reach = sim.outerR + 3, from = (Math.max(BEAK_M * k, 24) * 0.95) / k; // the beam leaves the cannon's crystal
  const beam = (a, f, w0) => {
    const c = Math.cos(a), s = Math.sin(a), x0 = from * c, y0 = from * s, x1 = reach * c, y1 = reach * s;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.globalAlpha = f;
    ctx.strokeStyle = 'rgba(255,60,40,0.45)'; ctx.lineWidth = w0 * 2.6; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = '#ff5a3c'; ctx.lineWidth = w0 * 1.1; ctx.stroke();
    ctx.strokeStyle = '#fff4ec'; ctx.lineWidth = w0 * 0.45; ctx.stroke();
    // the muzzle flash on the crystal: a red ring, a white-hot star, matching the cannon's lens
    const fr = w0 * (1.6 + 1.4 * f);
    ctx.fillStyle = 'rgba(255,90,60,0.55)'; ctx.beginPath(); ctx.arc(x0, y0, fr * 1.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff4ec'; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const b = a + (i / 10) * TAU, r = i % 2 ? fr * 0.45 : fr * (i % 4 ? 1 : 1.35); ctx.lineTo(x0 + Math.cos(b) * r, y0 + Math.sin(b) * r); }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  };
  for (const B of P.beams) { const u = B.t / 0.5; beam(B.a, 1 - u * u, P2.laser.w * (1 - 0.4 * u)); }
  if (P.sweep >= 0) {
    const a = P.aim, d = P.sweepDir || 1;
    ctx.save();
    for (let i = 1; i <= 8; i++) { ctx.globalAlpha = 0.28 * (1 - i / 9); ctx.fillStyle = '#ff6a4a'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, sim.outerR + 0.3, a - d * i * 0.07, a - d * (i - 1) * 0.07, d < 0); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    beam(a, 1, P2.laser.w * 1.2);
    // it cuts through every wall it crosses: sparks spray where the beam meets each ring
    for (const ring of sim.rings) if (solidLa(ring, a - ring.body.getAngle())) beamSparks(ctx, ring.r * Math.cos(a), ring.r * Math.sin(a), a + (d > 0 ? -Math.PI / 2 : Math.PI / 2), k, t + ring.i, 4, 0.9);
  }
  for (const B of P.beams) if (B.t < 0.2) for (const ring of sim.rings) if (solidLa(ring, B.a - ring.body.getAngle())) beamSparks(ctx, ring.r * Math.cos(B.a), ring.r * Math.sin(B.a), B.a, k, t + ring.i, 3, 0.8);
  // spin storm: wind streaks whip round the channels
  if (P.spin > 0) {
    const el = P.spinMax - P.spin, f = clamp01(Math.min(el / 0.3, P.spin / 0.4)), d = P.spinDir;
    ctx.save();
    ctx.lineCap = 'round';
    const radii = sim.rings.map((r, i) => (i ? (sim.rings[i - 1].r + r.r) / 2 : r.r * 0.6)).concat([sim.outerR + 0.45]);
    radii.forEach((r, i) => {
      for (let j = 0; j < 3; j++) {
        const a0 = d * t * 3.2 + (j / 3) * TAU + i * 0.9, len = 0.55;
        const g = ctx.createLinearGradient(r * Math.cos(a0), r * Math.sin(a0), r * Math.cos(a0 + d * len), r * Math.sin(a0 + d * len));
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, `rgba(235,255,250,${0.8 * f})`);
        ctx.strokeStyle = g; ctx.lineWidth = Math.max(0.05, 3 / k);
        ctx.beginPath(); ctx.arc(0, 0, r, Math.min(a0, a0 + d * len), Math.max(a0, a0 + d * len)); ctx.stroke();
      }
    });
    ctx.restore();
  }
  // thunderclap: the bolt that came down
  if (P.clap > 0) {
    const f = P.clap / 0.7, R = rng(Math.floor(t * 15)), top = sim.outerR + 5;
    ctx.save();
    ctx.globalAlpha = f;
    ctx.lineJoin = 'round';
    zig(ctx, (R() - 0.5) * 2, top, 0, 0.2, 9, 0.35, R);
    boltStroke(ctx, 0.1, 1);
    for (let j = 0; j < 3; j++) { const y = top * (0.3 + 0.2 * j); zig(ctx, (R() - 0.5) * 0.6, y, (R() - 0.5) * 3, y - 1.2, 4, 0.2, R); boltStroke(ctx, Math.max(0.025, 1.2 / k), 1); }
    ctx.restore();
  }
  // pepper cloud: thick enough to hide what is behind it (layered puffs, pepper specks swirling in it)
  const C = P.cloud, PL = polFor(sim);
  if (C) drawPepperCloud(ctx, C.x, C.y, C.r, clamp01(Math.min((C.max - C.t) / 0.25, C.t / 0.6)), k, t);
  // Pepper twister (pepper + spin): the smoke winds into a whirling funnel, then every creature sneezes (render only:
  // the sim has already flung them out to the rim)
  if (PL.tw) {
    const W = PL.tw, el = sim.t - W.t0, wind = P2.twist.wind, AFTER = 0.85;
    if (el < 0 || el > Math.max(TWIST_T, wind + AFTER) + 0.1) PL.tw = null;
    else {
      drawTwister(ctx, W.x, W.y, W.r, el / TWIST_T, k, t);
      // "ah... ah..." while the sim winds up (P.tw), "CHOO!" on the step it throws them: the spray blows back at the vault's
      // middle and a streak follows each one from where it stood out to the rim
      const us = el < wind ? 0.36 * (el / wind) : 0.36 + 0.64 * ((el - wind) / AFTER);
      for (const w of W.who) {
        const h = headOf(w);
        if (!h) continue;
        if (P.tw > 0) { w.x0 = h.x; w.y0 = h.y; }
        else if (w.x0 != null && el < wind + 0.3) {
          const f = 1 - (el - wind) / 0.3, d = Math.hypot(h.x - w.x0, h.y - w.y0);
          if (d > 0.25) { ctx.save(); ctx.lineCap = 'round'; ctx.globalAlpha = 0.75 * f; ctx.strokeStyle = '#fff6e6'; ctx.lineWidth = w.sz * 0.5 * f; ctx.beginPath(); ctx.moveTo(w.x0 + (h.x - w.x0) * (1 - f) * 0.8, w.y0 + (h.y - w.y0) * (1 - f) * 0.8); ctx.lineTo(h.x, h.y); ctx.stroke(); ctx.restore(); }
        }
        if (us < 1) drawSneeze(ctx, h.x, h.y, Math.atan2(-h.y, -h.x), us, k, t, w.sz);
      }
    }
  }
  drawWarp(ctx, sim, k, t); // the Warp Gate's portals and the armed swirl
}

// ---------- events: sound (existing names), sparks and pops. api: popup, audio, toast, once(key, text), combo(ev)
const zapPop = {}; // egg id -> sim time of its last 'Bzzt!'
const HIT = { ice: ['Frozen!', '#bfeaff'], zap: ['Zap!', '#9fdcff'], pep: ['Achoo!', '#ffb27a'], scare: ['Eek!', '#ffe0a0'], spin: ['Whoosh!', '#b8fff0'] };
export function p2Event(ev, fx, api) {
  const { popup, audio, once } = api;
  if (warpEvent(ev, fx, api)) return; // the Warp Gate (render/warp.js)
  switch (ev.type) {
    case 'powerOn':
      switch (ev.power) {
        case 'frostnova':
          audio.play('glass_crack', { vol: 0.9, pitch: 0.7 }); audio.play('wind_gust', { vol: 0.6, pitch: 1.4 });
          fx.wave(0, 0, (api.sim.outerR || 4) * 1.1, '#dff6ff', 0.6, 0.18);
          once('frostnova', 'Frost nova! Thorns shatter at a touch. The rings thaw icy: eggs slide far.');
          break;
        case 'shock':
          audio.play('thunder', { vol: 0.45, pitch: 1.8 });
          once('shock', 'Shock ring! Creatures touching it get zapped. Your eggs bounce off it too.');
          break;
        case 'thunderclap':
          audio.play('thunder', { vol: 1 });
          fx.flash = 0.7; fx.flashColor = 'clap'; fx.shake = Math.max(fx.shake, 0.6);
          once('thunderclap', 'Thunderclap! Creatures are stunned, but doors and portals lose power.');
          break;
        case 'laser':
          audio.play('fire_ignite', { vol: 0.7, pitch: 1.8 });
          once('laser', 'Laser cannon! Tap anywhere to fire from the middle of the vault.');
          break;
        case 'spin':
          audio.play('wind_gust', { vol: 0.9, pitch: 0.8 }); audio.play('motor_tick', { vol: 0.6 });
          fx.shake = Math.max(fx.shake, 0.35);
          break;
        case 'pepper':
          audio.play('squish', { intensity: 0.7, pitch: 0.5 }); audio.play('wind_gust', { vol: 0.4, pitch: 1.6 });
          if (api.sim.p2.cloud) { const c = api.sim.p2.cloud; fx.smoke(c.x, c.y, 8, 'rgba(170,96,62,0.7)'); }
          break;
        case 'shrink':
          audio.play('bubble_pop', { pitch: 1.9 }); audio.play('rewind', { vol: 0.4, pitch: 1.6 });
          break;
        case 'iron':
          audio.play('steel_on'); audio.play('steel_clang', { vol: 0.6 });
          break;
        case 'decoy':
          audio.play('twin_hatch');
          break;
      }
      break;
    case 'p2Combo': {
      if (ev.id === 'twister' && api.sim) { const PL = polFor(api.sim); PL.tw = { t0: api.sim.t, x: ev.x, y: ev.y, r: P2.pepper.r, who: sneezers(api.sim) }; }
      audio.play('combo', { intensity: 1 });
      audio.play('level_win', { vol: 0.4, pitch: 1.4 });
      fx.sparkle(ev.x, ev.y, 24, '#ffd23f');
      fx.wave(ev.x, ev.y, 1.6, '#ffe680', 0.5, 0.14);
      fx.flash = Math.max(fx.flash, 0.4); fx.flashColor = '#fff1b0';
      fx.punch = 1;
      popup(ev.x, ev.y + 1.0, 'COMBO!', { sub: ev.name, color: '#ffd23f', size: 34, life: 1.8 });
      api.combo && api.combo(ev);
      break;
    }
    case 'p2Hit': {
      const H = HIT[ev.kind];
      if (!H) break;
      const twist = api.sim && POL.sim === api.sim && POL.tw && api.sim.t - POL.tw.t0 < P2.twist.wind + 0.3; // the twister acts its own "ah... CHOO!"
      if (twist && (ev.kind === 'pep' || ev.kind === 'spin')) { if (!(api.sim.p2.tw > 0) && ev.kind === 'pep') fx.smoke(ev.x, ev.y, 3, 'rgba(190,120,80,0.6)'); break; }
      if (!strikeQuiet()) popup(ev.x, ev.y + 0.6, H[0], { color: H[1], size: 17, life: 0.9 });
      if (ev.kind === 'ice') { audio.play('glass_crack', { vol: 0.5, pitch: 1.5 }); fx.chips(ev.x, ev.y, '#dff6ff', 6, 1.6); }
      else if (ev.kind === 'zap') { audio.play('glass_crack', { vol: 0.5, pitch: 2.2 }); fx.sparkle(ev.x, ev.y, 8, '#bfe9ff'); }
      else if (ev.kind === 'pep') { audio.play('bubble_pop', { vol: 0.6, pitch: 0.6 }); fx.smoke(ev.x, ev.y, 2, 'rgba(190,120,80,0.6)'); }
      else if (ev.kind === 'spin') audio.play('wind_gust', { vol: 0.4, pitch: 1.8 });
      break;
    }
    case 'emagOn': { // the Electromagnet switches on: a clang, a deep buzz, a pulse runs in onto the ring
      const ring = api.sim && api.sim.rings[ev.ring];
      audio.play('steel_clang', { vol: 0.7, pitch: 0.6 }); audio.play('thunder', { vol: 0.35, pitch: 0.7 });
      if (ring) { fx.wave(0, 0, ring.r, '#8fdcff', 0.5, 0.2); fx.wave(0, 0, ring.r, '#ffffff', 0.3, 0.08); }
      fx.shake = Math.max(fx.shake, 0.2);
      break;
    }
    case 'emagHum': audio.play('gear_whir', { vol: 0.22, pitch: 0.5 }); audio.play('jelly_zap', { vol: 0.12, pitch: 0.6 }); break;
    case 'emagOff': { // ...and off: it lets go with a clunk, a few sparks fall off the ring
      const ring = api.sim && api.sim.rings[ev.ring];
      audio.play('steel_on', { vol: 0.5, pitch: 0.6 }); audio.play('release', { vol: 0.5, pitch: 0.7 });
      if (ring) for (let i = 0; i < 6; i++) { const q = (i / 6) * TAU + 0.4; fx.sparkle(ring.r * Math.cos(q), ring.r * Math.sin(q), 3, '#bfe9ff'); }
      break;
    }
    case 'p2Sneeze': // the Pepper twister's sneeze: one big blast from the funnel, the camera jolts
      audio.play('squish', { intensity: 1, pitch: 1.5 }); audio.play('wind_gust', { vol: 0.9, pitch: 1.3 }); audio.play('bubble_pop', { vol: 0.8, pitch: 0.55 });
      fx.wave(ev.x, ev.y, (api.sim && api.sim.outerR ? api.sim.outerR : 4) * 1.05, '#ffd9b0', 0.45, 0.16);
      fx.shake = Math.max(fx.shake, 0.4);
      break;
    case 'p2Fling':
      fx.burst(ev.x, ev.y, 10, (i, a, b) => ({ x: ev.x + (ev.x2 - ev.x) * a, y: ev.y + (ev.y2 - ev.y) * a, vx: (b - 0.5) * 1.5, vy: (b - 0.5) * 1.5, drag: 3, life: 0.45, size: 0.05, color: '#e8fff8' }));
      break;
    case 'thornShatter':
      audio.play('glass_break', { vol: 0.6, pitch: 1.4 });
      fx.chips(ev.x, ev.y, '#dff6ff', 9, 2.4);
      fx.sparkle(ev.x, ev.y, 5, '#ffffff');
      once('brittle', 'Brittle thorns shatter when an egg touches them.');
      break;
    case 'p2Curtain':
      if (ev.why === 'ice') { audio.play('glass_break', { vol: 0.8 }); fx.chips(ev.x, ev.y, '#dff6ff', 14, 2.8); popup(ev.x, ev.y + 0.5, 'Shattered!', { color: '#bfeaff', size: 20 }); }
      else { audio.play('fire_burn'); fx.chips(ev.x, ev.y, '#ff8a3a', 12, 2.6); fx.smoke(ev.x, ev.y, 4); popup(ev.x, ev.y + 0.5, 'Cut!', { color: '#ff9a7a', size: 20 }); }
      break;
    case 'padBurn':
      audio.play('lava_sizzle', { vol: 0.5, pitch: 1.4 });
      fx.smoke(ev.x, ev.y, 3, 'rgba(60,40,30,0.6)');
      once('padBurn', 'The laser burnt the sponge: landings there are hard now.');
      break;
    case 'laser':
      audio.play('fire_ignite', { vol: 0.9, pitch: 2.2 }); audio.play('thunder', { vol: 0.2, pitch: 2.5 });
      fx.sparkle(ev.x, ev.y, 8, '#ff8a6a');
      fx.shake = Math.max(fx.shake, 0.18);
      break;
    case 'shockBounce':
      audio.play('glass_crack', { vol: 0.45, pitch: 2.4 });
      fx.sparkle(ev.x, ev.y, 7, '#bfe9ff');
      // a word the first time each egg bounces in a while, not on every hop
      if (!(api.sim && ev.egg && Math.abs(api.sim.t - (zapPop[ev.egg.id] ?? -9)) < 2.5)) popup(ev.x, ev.y + 0.45, 'Bzzt!', { color: '#9fdcff', size: 15, life: 0.8 });
      if (api.sim && ev.egg) zapPop[ev.egg.id] = api.sim.t;
      break;
    case 'decoyOn':
      fx.sparkle(ev.x, ev.y, 10, '#ffcf8a');
      break;
    case 'decoyPop':
      if (ev.why === 'snake' || ev.why === 'eagle' || ev.why === 'gator' || ev.why === 'turtle') { audio.play('wood_break', { vol: 0.8 }); fx.chips(ev.x, ev.y, '#d4914c', 12, 2.6); popup(ev.x, ev.y + 0.6, 'Fooled!', { color: '#ffcf8a', size: 22 }); }
      else { audio.play('bubble_pop', { pitch: 0.7 }); fx.chips(ev.x, ev.y, '#d4914c', 6, 1.6); }
      if (ev.pepper && ev.why !== 'time') { audio.play('squish', { intensity: 0.8, pitch: 0.5 }); fx.smoke(ev.x, ev.y, 8, 'rgba(170,80,40,0.7)'); }
      break;
    case 'shrinkOn':
      fx.sparkle(ev.x, ev.y, 6, '#d9bcff');
      break;
    case 'shrinkOff':
      audio.play('bubble_pop', { vol: 0.5, pitch: 0.7 });
      fx.sparkle(ev.x, ev.y, 6, '#d9bcff');
      break;
    case 'ironOff':
      audio.play('steel_on', { vol: 0.5, pitch: 0.7 });
      break;
    case 'cannonSmash':
      audio.play('rock_hit'); audio.play('wood_break', { vol: 0.6 });
      fx.chips(ev.x, ev.y, '#c9a26a', 10, 3);
      popup(ev.x, ev.y + 0.5, 'Smash!', { color: '#e6e6e6', size: 20, life: 0.9 });
      break;
    case 'cannonBonk':
      audio.play('steel_clang', { vol: 0.8 });
      fx.sparkle(ev.x, ev.y, 8, '#fff1b8');
      break;
  }
}

// the strip tool and the album read these
export const P2_INFO = INFO;
