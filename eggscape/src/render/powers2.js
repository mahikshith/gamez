// v3.4 powers and combos: orb emblems, egg overlays, world effects and event feedback (sim/powers2.js has the rules).
// Code-drawn in the house style: dark outline, two-tone shading. World layers take ctx in world space (metres, y up);
// the orb and egg art draw in a local y-down space (orb: 200 units across, egg: 100 units tall).
import { EGG_H, EGG_W, RING_TH, TAU, rng } from '../sim/geom.js';
import { P2, COMBOS } from '../sim/powers2.js';
import { POWER_INFO, GLASS, EMBLEM_ART, EGG_ART, ORB_ART, drawOrb } from './powers.js';
import { drawWarp, warpEvent } from './warp.js'; // the Warp Gate (sim/warp.js)

// ---------- names, lines (pickup card) and glass tints
const INFO = {
  frostnova: ['Frost nova', 'Every creature freezes and thorns turn brittle. Rings lock, then go icy.', '#9fe9ff', ['#effcff', '#2a86b8', '#062a40']],
  shock: ['Shock ring', 'This ring zaps creatures away for 8 s. Eggs that touch it bounce off.', '#6fd0ff', ['#c8eeff', '#1b5f9e', '#06193a']],
  thunderclap: ['Thunderclap', 'Every creature is stunned. Doors and portals black out a while.', '#ffe14a', ['#fff3b0', '#6b5a1a', '#1f1904']],
  laser: ['Laser beak', 'Tap to fire: cuts thorns and walls in a line. It burns sponge too.', '#ff4b3a', ['#ffb3a0', '#8f1a10', '#2c0503']],
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
for (const C of COMBOS) POWER_INFO['combo_' + C.id] = { name: 'COMBO! ' + C.name, line: C.line, color: '#ffd23f' };

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
  ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.4 * Math.sin(t * 6)})`;
  ctx.lineWidth = 6;
  for (const s of [-1, 1]) for (const r of [22, 36]) { const c = s > 0 ? 0 : Math.PI; ctx.beginPath(); ctx.arc(s * 46, -20, r, c - 0.9, c + 0.9); ctx.stroke(); }
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
function beak(ctx, s, glow) {
  // a golden beak pointing +x, s = its length; the tip glows red
  ctx.lineJoin = 'round';
  const g = ctx.createLinearGradient(0, -s * 0.4, 0, s * 0.4);
  g.addColorStop(0, '#ffe68a'); g.addColorStop(0.5, '#f2a91c'); g.addColorStop(1, '#a85f00');
  ctx.beginPath(); ctx.moveTo(-s * 0.55, -s * 0.36); ctx.quadraticCurveTo(s * 0.15, -s * 0.34, s * 0.5, -s * 0.02); ctx.lineTo(-s * 0.5, s * 0.03); ctx.closePath();
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#4a2a00'; ctx.lineWidth = s * 0.07; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-s * 0.5, s * 0.08); ctx.lineTo(s * 0.42, s * 0.05); ctx.quadraticCurveTo(s * 0.05, s * 0.3, -s * 0.48, s * 0.3); ctx.closePath();
  ctx.fillStyle = '#d98a10'; ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath(); ctx.ellipse(-s * 0.15, -s * 0.22, s * 0.2, s * 0.05, 0.1, 0, TAU); ctx.fill();
  const r = s * (0.13 + 0.03 * glow);
  const gl = ctx.createRadialGradient(s * 0.5, 0, 0, s * 0.5, 0, r * 2.2);
  gl.addColorStop(0, '#ffffff'); gl.addColorStop(0.35, '#ff5a3c'); gl.addColorStop(1, 'rgba(255,60,40,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(s * 0.5, 0, r * 2.2, 0, TAU); ctx.fill();
}
EMBLEM_ART.laser = (ctx, t) => {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,70,50,0.55)'; ctx.lineWidth = 24 + 4 * Math.sin(t * 9);
  ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(110, 0); ctx.stroke();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 8; ctx.stroke();
  ctx.translate(-12, 0);
  beak(ctx, 92, 0.5 + 0.5 * Math.sin(t * 7));
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
        const half = g.len / (2 * ring.r), a0 = A + g.a - half, a1 = A + g.a + half;
        ctx.lineCap = 'butt';
        ctx.strokeStyle = '#1a2027'; ctx.lineWidth = Math.max(0.09, 4 / k);
        ctx.beginPath(); ctx.arc(0, 0, ring.r, a0, a1); ctx.stroke();
        ctx.strokeStyle = '#9aa6b2'; ctx.lineWidth = Math.max(0.05, 2.2 / k); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = lw(1); ctx.beginPath(); ctx.arc(0, 0, ring.r + 0.012, a0, a1); ctx.stroke();
        for (const b of [a0 + 0.02, a1 - 0.02]) { ctx.beginPath(); ctx.arc(ring.r * Math.cos(b), ring.r * Math.sin(b), 0.045, 0, TAU); ctx.fillStyle = '#d6dde4'; ctx.fill(); ctx.strokeStyle = '#1a2027'; ctx.lineWidth = lw(1.2); ctx.stroke(); }
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
      if (Math.sin(t * 23 + x * 7) > 0.85) { ctx.strokeStyle = '#bfe9ff'; ctx.lineWidth = lw(1.5); zig(ctx, x - 0.2, y + 0.1, x + 0.18, y - 0.08, 4, 0.06, rng(Math.floor(t * 30))); ctx.stroke(); }
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
  if (P.shock > 0 && P.shockR >= 0) {
    const ring = sim.rings[P.shockR], A = ring.body.getAngle(), end = P.shock < 1.5 ? (Math.sin(t * 30) > 0 ? 1 : 0.35) : 1;
    const a = Math.min(1, P.shock / 0.3, (P2.shock.t - P.shock) / 0.2) * end;
    ctx.save();
    ctx.globalAlpha = a * (0.55 + 0.2 * Math.sin(t * 17));
    ctx.strokeStyle = 'rgba(110,200,255,1)';
    ctx.lineWidth = RING_TH + 0.1;
    const n = Math.ceil((TAU * ring.r) / 0.12);
    ctx.beginPath();
    let on = false;
    for (let i = 0; i <= n; i++) {
      const la = (i / n) * TAU, s = solidLa(ring, la), w = A + la;
      if (s) { if (!on) ctx.moveTo(ring.r * Math.cos(w), ring.r * Math.sin(w)); else ctx.lineTo(ring.r * Math.cos(w), ring.r * Math.sin(w)); }
      on = s;
    }
    ctx.stroke();
    ctx.globalAlpha = a;
    const R = rng(Math.floor(t * 20) + P.shockR * 77);
    ctx.lineJoin = 'round';
    for (let j = 0; j < 7; j++) {
      const la = R() * TAU, len = 0.35 + R() * 0.45;
      if (!solidLa(ring, la) || !solidLa(ring, la + len / ring.r)) continue;
      ctx.beginPath();
      for (let q = 0; q <= 6; q++) { const b = A + la + (q / 6) * (len / ring.r), rr = ring.r + (R() - 0.5) * 0.2; q ? ctx.lineTo(rr * Math.cos(b), rr * Math.sin(b)) : ctx.moveTo(rr * Math.cos(b), rr * Math.sin(b)); }
      ctx.strokeStyle = 'rgba(40,120,220,0.9)'; ctx.lineWidth = Math.max(0.06, 3 / k); ctx.stroke();
      ctx.strokeStyle = '#f4fdff'; ctx.lineWidth = Math.max(0.025, 1.4 / k); ctx.stroke();
    }
    ctx.restore();
  }
  // the laser beak in the middle of the vault, pointing where it last fired (pips: shots left)
  if (P.laser > 0 && (P.shots > 0 || P.sweep >= 0 || P.beams.length)) {
    const s = Math.max(0.42, 15 / k) * k, ready = P.shots > 0 && P.sweep < 0;
    px(ctx, 0, 0, k, P.aim, () => {
      ctx.save();
      if (Math.cos(P.aim) < 0) ctx.scale(1, -1); // pointing left: keep the beak the right way up
      if (ready) { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.9); g.addColorStop(0, `rgba(255,90,60,${0.35 + 0.15 * Math.sin(t * 6)})`); g.addColorStop(1, 'rgba(255,90,60,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s * 0.9, 0, TAU); ctx.fill(); }
      beak(ctx, s, ready ? 0.5 + 0.5 * Math.sin(t * 8) : 1);
      ctx.restore();
    });
    for (let i = 0; i < P.shots; i++) {
      const a = P.aim + Math.PI + (i - (P.shots - 1) / 2) * 0.55, r = Math.max(0.3, 11 / k);
      ctx.beginPath(); ctx.arc(r * Math.cos(a), r * Math.sin(a), Math.max(0.045, 2.6 / k), 0, TAU);
      ctx.fillStyle = '#ff5a3c'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = lw(1.2); ctx.stroke();
    }
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
    ctx.strokeStyle = 'rgba(60,150,255,0.85)'; ctx.lineWidth = Math.max(0.05, 3 / k); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(0.02, 1.2 / k); ctx.stroke();
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
  if (F.k === 'zap') sparks(ctx, at.x, at.y, at.r * 0.8, k, t, seed);
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
  if (D && D.alive && P.decoy) {
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
      if (F.k === 'ice') crustAlong(ctx, S.pts, 0.5 * S.size, k, Math.min(1, F.t / 0.3, (F.max - F.t) / 0.15 + 0.3));
      const h = S.pts[0], q = S.pts[Math.min(3, S.pts.length - 1)];
      creatureFx(ctx, F, k, t, { x: h.x, y: h.y, r: 0.45 * S.size, dir: Math.atan2(h.y - q.y, h.x - q.x), block: F.k === 'ice' ? [0.36 * S.size, 0.3 * S.size] : null }, S.id + 1);
    } else if (key[0] === 'c') {
      const C = (sim.sals || []).find((c) => c.id === +key.slice(1));
      if (!C || !sim.salLive(C)) continue;
      if (F.k === 'ice') crustAlong(ctx, C.pts.slice(0, Math.ceil(C.pts.length * 0.62)), 0.55 * C.size, k, Math.min(1, F.t / 0.3, (F.max - F.t) / 0.15 + 0.3));
      const h = C.pts[0], q = C.pts[Math.min(4, C.pts.length - 1)];
      if (F.k !== 'ice') creatureFx(ctx, F, k, t, { x: h.x, y: h.y, r: 0.5 * C.size, dir: Math.atan2(h.y - q.y, h.x - q.x) }, 20 + C.id);
    } else if (key === 'e' && sim.eagle) {
      const E = sim.eagle;
      creatureFx(ctx, F, k, t, { x: E.x, y: E.y, r: 0.9, dir: E.face > 0 ? 0 : Math.PI, block: [1.2, 0.75] }, 40);
    } else if (key === 'f' && sim.fox && !(sim.fox.duck >= 1)) {
      const y = sim.outerR + 0.45 + 0.55;
      creatureFx(ctx, F, k, t, { x: sim.fox.x, y, r: 0.5, dir: Math.PI / 2, block: [0.55, 0.62] }, 50);
    } else if (key === 'b' && sim.bx && sim.bx.boss) {
      const B = sim.bx.boss;
      creatureFx(ctx, F, k, t, { x: B.x, y: B.y, r: 0.9, dir: -Math.PI / 2, block: [1.1, 0.9] }, 60);
    }
  }
  // laser beams (and the sweep)
  const reach = sim.outerR + 3;
  const beam = (a, f, w0) => {
    const c = Math.cos(a), s = Math.sin(a), x0 = 0.3 * c, y0 = 0.3 * s, x1 = reach * c, y1 = reach * s;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.globalAlpha = f;
    ctx.strokeStyle = 'rgba(255,60,40,0.45)'; ctx.lineWidth = w0 * 2.6; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = '#ff5a3c'; ctx.lineWidth = w0 * 1.1; ctx.stroke();
    ctx.strokeStyle = '#fff4ec'; ctx.lineWidth = w0 * 0.45; ctx.stroke();
    ctx.restore();
  };
  for (const B of P.beams) { const u = B.t / 0.5; beam(B.a, 1 - u * u, P2.laser.w * (1 - 0.4 * u)); }
  if (P.sweep >= 0) {
    const a = P.aim, d = P.sweepDir || 1;
    ctx.save();
    for (let i = 1; i <= 8; i++) { ctx.globalAlpha = 0.28 * (1 - i / 9); ctx.fillStyle = '#ff6a4a'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, sim.outerR + 0.3, a - d * i * 0.07, a - d * (i - 1) * 0.07, d < 0); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    beam(a, 1, P2.laser.w * 1.2);
  }
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
    ctx.strokeStyle = 'rgba(255,245,170,0.55)'; ctx.lineWidth = 0.42; ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.12; ctx.stroke();
    for (let j = 0; j < 3; j++) { const y = top * (0.3 + 0.2 * j); zig(ctx, (R() - 0.5) * 0.6, y, (R() - 0.5) * 3, y - 1.2, 4, 0.2, R); ctx.strokeStyle = '#fffbe0'; ctx.lineWidth = 0.05; ctx.stroke(); }
    ctx.restore();
  }
  // pepper cloud: thick enough to hide what is behind it
  const C = P.cloud;
  if (C) {
    const f = clamp01(Math.min((C.max - C.t) / 0.25, C.t / 0.6));
    ctx.save();
    for (let i = 0; i < 14; i++) {
      const a = hash(i * 1.7) * TAU + t * 0.25 * (i % 2 ? 1 : -1), d = C.r * 0.62 * Math.sqrt(hash(i * 2.3 + 1)), x = C.x + d * Math.cos(a), y = C.y + d * Math.sin(a), r = C.r * (0.38 + 0.2 * hash(i * 3.1)) * (0.75 + 0.25 * f);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${i % 3 ? '168,96,62' : '196,128,86'},${0.95 * f})`);
      g.addColorStop(0.65, `rgba(150,80,50,${0.85 * f})`);
      g.addColorStop(1, 'rgba(150,80,50,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = `rgba(70,14,6,${0.85 * f})`;
    for (let i = 0; i < 22; i++) {
      const a = hash(i * 5.3) * TAU + t * (0.4 + hash(i) * 0.6), d = C.r * 0.8 * hash(i * 7.7 + 2);
      ctx.beginPath(); ctx.arc(C.x + d * Math.cos(a), C.y + d * Math.sin(a), Math.max(0.02, 1.4 / k), 0, TAU); ctx.fill();
    }
    ctx.restore();
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
          fx.flash = 0.7; fx.flashColor = '#fffbe0'; fx.shake = Math.max(fx.shake, 0.6);
          once('thunderclap', 'Thunderclap! Creatures are stunned, but doors and portals lose power.');
          break;
        case 'laser':
          audio.play('fire_ignite', { vol: 0.7, pitch: 1.8 });
          once('laser', 'Laser beak! Tap anywhere to fire from the middle of the vault.');
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
      popup(ev.x, ev.y + 0.6, H[0], { color: H[1], size: 17, life: 0.9 });
      if (ev.kind === 'ice') { audio.play('glass_crack', { vol: 0.5, pitch: 1.5 }); fx.chips(ev.x, ev.y, '#dff6ff', 6, 1.6); }
      else if (ev.kind === 'zap') { audio.play('glass_crack', { vol: 0.5, pitch: 2.2 }); fx.sparkle(ev.x, ev.y, 8, '#bfe9ff'); }
      else if (ev.kind === 'pep') { audio.play('bubble_pop', { vol: 0.6, pitch: 0.6 }); fx.smoke(ev.x, ev.y, 2, 'rgba(190,120,80,0.6)'); }
      else if (ev.kind === 'spin') audio.play('wind_gust', { vol: 0.4, pitch: 1.8 });
      break;
    }
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
      if (ev.why === 'snake' || ev.why === 'eagle') { audio.play('wood_break', { vol: 0.8 }); fx.chips(ev.x, ev.y, '#d4914c', 12, 2.6); popup(ev.x, ev.y + 0.6, 'Fooled!', { color: '#ffcf8a', size: 22 }); }
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
