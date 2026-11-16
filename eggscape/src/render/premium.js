// The premium chicks' effects (Phoenix, Tick-Tock, Bubble) and the Thorn Snips boost, in the world, plus the small shared
// shapes their art is built from (a flame tongue, a cog, a soap bubble) and the gold crown that marks a premium chick.
// Render only: rules in sim/strike.js, data in data/strikes.js. World space is y up (k px per m), like render/strike.js.
import { clamp, lerp, ss, hash } from './castkit.js';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------- shapes (any space; y down for the chick rig)
// a flame tongue from its root (x, y) reaching h along angle a (0 = straight up in a y-down space): outer, middle, core
export function flameTongue(ctx, x, y, h, w, a, c1, c2, c3) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  for (const [k, col] of [[1, c1], [0.66, c2], [0.36, c3]]) {
    const H = h * (0.55 + 0.45 * k), W = w * k;
    ctx.beginPath(); ctx.moveTo(-W, 0); ctx.bezierCurveTo(-W * 1.1, -H * 0.45, -W * 0.2, -H * 0.6, 0, -H);
    ctx.bezierCurveTo(W * 0.35, -H * 0.55, W * 1.1, -H * 0.4, W, 0); ctx.quadraticCurveTo(0, W * 0.9, -W, 0); ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
  }
  ctx.restore();
}
// a little cog: eight teeth, a hub
export function cog(ctx, x, y, r, a, fill, line, lw) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.beginPath();
  for (let i = 0; i < 16; i++) { const an = (i / 16) * TAU, rr = i % 2 ? r * 0.78 : r; ctx.lineTo(Math.cos(an - 0.12) * rr, Math.sin(an - 0.12) * rr); ctx.lineTo(Math.cos(an + 0.12) * rr, Math.sin(an + 0.12) * rr); }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = line; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, TAU); ctx.fillStyle = line; ctx.fill();
  ctx.restore();
}
// a soap bubble: a clear film with a rainbow rim that drifts round, a window highlight. a: its opacity
export function bubbleBall(ctx, x, y, r, t, a = 1) {
  if (r <= 0.3) return;
  ctx.save(); ctx.globalAlpha *= a;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = 'rgba(200,240,255,0.18)'; ctx.fill();
  const lw = Math.max(0.8, r * 0.12), sp = t * 1.3;
  for (const [o, col] of [[0, 'rgba(255,140,210,0.85)'], [2.1, 'rgba(120,220,255,0.85)'], [4.2, 'rgba(190,255,150,0.75)']]) {
    ctx.beginPath(); ctx.arc(x, y, r - lw * 0.5, sp + o, sp + o + 1.7); ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.lineWidth = Math.max(0.6, r * 0.04); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x - r * 0.38, y - r * 0.4, r * 0.24, r * 0.12, -0.7, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
  ctx.beginPath(); ctx.arc(x + r * 0.42, y + r * 0.36, r * 0.07, 0, TAU); ctx.fill();
  ctx.restore();
}
// the premium mark: a small gold crown with a ruby, a twinkle now and then. (cx, cy) its centre, r its half width (y down)
export function drawPremiumBadge(ctx, cx, cy, r, t = 0) {
  ctx.save(); ctx.translate(cx, cy); ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.ellipse(0, r * 0.62, r * 1.05, r * 0.3, 0, 0, TAU); ctx.fillStyle = 'rgba(40,20,0,0.35)'; ctx.fill();
  const P = [[-1, 0.5], [-1.05, -0.45], [-0.5, 0.0], [0, -0.75], [0.5, 0.0], [1.05, -0.45], [1, 0.5]];
  ctx.beginPath(); P.forEach(([x, y], i) => (i ? ctx.lineTo(x * r, y * r) : ctx.moveTo(x * r, y * r))); ctx.closePath();
  const g = ctx.createLinearGradient(0, -r * 0.8, 0, r * 0.6); g.addColorStop(0, '#fff3a0'); g.addColorStop(0.5, '#ffc928'); g.addColorStop(1, '#c47a06');
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = Math.max(1, r * 0.16); ctx.strokeStyle = '#6a3a02'; ctx.stroke();
  ctx.fillStyle = '#c47a06'; ctx.fillRect(-r * 0.95, r * 0.22, r * 1.9, r * 0.12);
  for (const [x, y] of [[-1.05, -0.45], [0, -0.75], [1.05, -0.45]]) { ctx.beginPath(); ctx.arc(x * r, y * r, r * 0.16, 0, TAU); ctx.fillStyle = '#fff6c8'; ctx.fill(); ctx.lineWidth = Math.max(0.8, r * 0.08); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(0, -r * 0.18); ctx.lineTo(r * 0.2, r * 0.05); ctx.lineTo(0, r * 0.26); ctx.lineTo(-r * 0.2, r * 0.05); ctx.closePath();
  ctx.fillStyle = '#e8304a'; ctx.fill(); ctx.lineWidth = Math.max(0.8, r * 0.08); ctx.strokeStyle = '#6a0a1a'; ctx.stroke();
  const tw = (t * 0.7) % 1;
  if (tw < 0.25) { const q = Math.sin((tw / 0.25) * Math.PI) * r * 0.5, sx = r * 0.7, sy = -r * 0.55; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(sx, sy - q); ctx.quadraticCurveTo(sx, sy, sx + q, sy); ctx.quadraticCurveTo(sx, sy, sx, sy + q); ctx.quadraticCurveTo(sx, sy, sx - q, sy); ctx.quadraticCurveTo(sx, sy, sx, sy - q); ctx.fill(); }
  ctx.restore();
}

// ---------------------------------------------------------------- world
const RT = { sim: null, snips: [], drops: [] }; // render-only beats from events (cleared on a new level)
const px = (ctx, x, y, k, draw) => { ctx.save(); ctx.translate(x, y); ctx.scale(1 / k, -1 / k); draw(); ctx.restore(); };
// the Phoenix's path home, as the sim flies it (sim/strike.js stkCarry)
function carryAt(sim, C, u) {
  const n = sim.nest.getPosition(), tx = n.x, ty = sim.nestY + 0.36 * sim.gy, v = u * u * (3 - 2 * u);
  const h = (1.3 + 0.18 * Math.hypot(tx - C.x0, ty - C.y0)) * sim.gy;
  return { x: C.x0 + (tx - C.x0) * v, y: C.y0 + (ty - C.y0) * v + h * 4 * v * (1 - v) };
}

// everything premium in the world. chick(id, x, y, s, o): draws a strike chick (px space); egg(e): draws an egg as the game does
export function premiumWorld(ctx, sim, k, t, S, chick, egg) {
  if (RT.sim !== sim) { RT.sim = sim; RT.snips.length = 0; RT.drops.length = 0; }
  const K = sim.stk;
  // Tick-Tock: the world goes sepia under a great clock face; the eggs stay in colour (they move freely)
  if (K && K.tock > 0) tockWash(ctx, sim, K, k, t, S, egg);
  // the Bubble Chick's bubbles round the eggs (blinking when about to pop)
  for (const e of sim.eggs) {
    if (!(e.sbub > 0) || !e.alive || e.saved) continue;
    const p = e.body.getPosition(), on = Math.min(1, (6 - e.sbub) / 0.25), blink = e.sbub < 1.2 && Math.sin(t * 26) < -0.3;
    const r = (0.34 + 0.015 * Math.sin(t * 5 + e.id)) * (0.6 + 0.4 * on);
    px(ctx, p.x, p.y, k, () => { ctx.scale(1 + 0.04 * Math.sin(t * 7 + e.id), 1 - 0.04 * Math.sin(t * 7 + e.id)); bubbleBall(ctx, 0, 0, r * k, t + e.id, blink ? 0.45 : 0.95); });
  }
  // the Phoenix carrying an egg home: a blazing trail along its arc, the egg in its talons, wings beating
  if (K && K.phx) {
    const C = K.phx, e = sim.eggs.find((q) => q.id === C.id), u = clamp(C.t / C.max, 0, 1), p = carryAt(sim, C, u), q = carryAt(sim, C, Math.min(1, u + 0.03));
    ctx.save();
    for (const [w, col, al] of [[0.34, '#ff4a12', 0.55], [0.2, '#ffb02a', 0.75], [0.08, '#fff3b0', 0.9]]) { // the trail: thick behind, thin at the chick
      ctx.beginPath(); const u0 = Math.max(0, u - 0.45);
      for (let j = 0; j <= 16; j++) { const a = carryAt(sim, C, lerp(u0, u, j / 16)); if (j) ctx.lineTo(a.x, a.y); else ctx.moveTo(a.x, a.y); }
      ctx.globalAlpha = al; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = w * (0.6 + 0.4 * Math.sin(t * 20)) + 0.04; ctx.strokeStyle = col; ctx.stroke();
    }
    for (let i = 0; i < 8; i++) { const ub = Math.max(0, u - i * 0.05), a = carryAt(sim, C, ub), age = i * 0.05 * C.max; ctx.globalAlpha = clamp(1 - i / 8, 0, 1); ctx.fillStyle = i % 2 ? '#ffd23a' : '#ff6a1a'; ctx.beginPath(); ctx.arc(a.x + (hash(i + C.id) - 0.5) * 0.3, a.y - age * 0.8 + (hash(i * 3) - 0.3) * 0.2, 0.04 + 0.03 * hash(i * 7), 0, TAU); ctx.fill(); }
    ctx.restore();
    const ang = Math.atan2(q.y - p.y, q.x - p.x), dir = Math.cos(ang) < 0 ? -1 : 1;
    if (e) egg(e);
    px(ctx, p.x, p.y + 0.34, k, () => { if (dir < 0) ctx.scale(-1, 1); ctx.rotate(-clamp(Math.abs(ang) > Math.PI / 2 ? Math.PI - Math.abs(ang) : ang, -0.6, 0.6) * Math.sign(Math.sin(ang) || 1) * 0.4); chick('phoenix', 0, 0, S * 1.1, { mood: 'yell', wing: 0.6 + 0.4 * Math.sin(t * 30), trail: 0.8, feet: true, look: { x: 0.6, y: 0.8 }, fog: false }); });
  }
  // Thorn Snips: a pair of shears closes on each snipped thorn
  for (let i = RT.snips.length - 1; i >= 0; i--) {
    const P = RT.snips[i]; if (P.t0 == null) P.t0 = t;
    const u = (t - P.t0) / 0.7; if (u >= 1) { RT.snips.splice(i, 1); continue; }
    px(ctx, P.x, P.y + 0.12, k, () => shears(ctx, 0.5 * k, u));
  }
  // a gold ring round the basket where the Phoenix put an egg down
  for (let i = RT.drops.length - 1; i >= 0; i--) {
    const D = RT.drops[i]; if (D.t0 == null) D.t0 = t;
    const u = (t - D.t0) / 0.8; if (u >= 1) { RT.drops.splice(i, 1); continue; }
    ctx.save(); ctx.globalAlpha = 1 - u; ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = (5 * (1 - u) + 1) / k; ctx.beginPath(); ctx.ellipse(D.x, D.y, 0.4 + u * 1.4, (0.4 + u * 1.4) * 0.45, 0, 0, TAU); ctx.stroke(); ctx.restore();
  }
}
// the shears: two blades and two rings that close (u 0..1), then fade (px space, y down)
function shears(ctx, s, u) {
  const close = ss(0, 0.35, u), a = (1 - close) * 0.55, fade = 1 - ss(0.6, 1, u);
  ctx.save(); ctx.globalAlpha *= fade; ctx.rotate(-0.5); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const sd of [-1, 1]) {
    ctx.save(); ctx.rotate(sd * a);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-s * 0.55, sd * s * 0.05); ctx.lineTo(0, sd * s * 0.1); ctx.closePath(); ctx.fillStyle = '#e6eef4'; ctx.fill(); ctx.lineWidth = s * 0.04; ctx.strokeStyle = '#4a5866'; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(s * 0.28, sd * s * 0.1, s * 0.13, s * 0.09, 0, 0, TAU); ctx.lineWidth = s * 0.07; ctx.strokeStyle = '#e8402e'; ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath(); ctx.arc(0, 0, s * 0.04, 0, TAU); ctx.fillStyle = '#4a5866'; ctx.fill();
  if (u > 0.3 && u < 0.6) { ctx.globalAlpha *= 1 - (u - 0.3) / 0.3; ctx.strokeStyle = '#fffbe0'; ctx.lineWidth = s * 0.05; for (let i = 0; i < 5; i++) { const an = (i / 5) * TAU, r0 = s * 0.2, r1 = s * (0.3 + (u - 0.3)); ctx.beginPath(); ctx.moveTo(-s * 0.55 + Math.cos(an) * r0, Math.sin(an) * r0); ctx.lineTo(-s * 0.55 + Math.cos(an) * r1, Math.sin(an) * r1); ctx.stroke(); } }
  ctx.restore();
}
// stopped time: sepia over the world, a great clock face over the vault with its second hand stuck shivering, a small
// clock over every held villain; the eggs redrawn on top in full colour
function tockWash(ctx, sim, K, k, t, S, egg) {
  const T = 5, left = K.tock, a = Math.min(1, (T - left) / 0.3, left / 0.5), m = ctx.getTransform();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 0.75 * a; ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.globalAlpha = 0.42 * a; ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = '#e8c48a'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
  ctx.save(); ctx.globalAlpha = 0.55 * a;
  const R = Math.max(1.4, sim.outerR * 0.95);
  ctx.lineCap = 'round'; ctx.strokeStyle = '#5a3a12';
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.lineWidth = 6 / k; ctx.stroke();
  for (let i = 0; i < 60; i++) { const an = (i / 60) * TAU, big = i % 5 === 0, r0 = R * (big ? 0.86 : 0.93); ctx.lineWidth = (big ? 5 : 2) / k; ctx.beginPath(); ctx.moveTo(Math.cos(an) * r0, Math.sin(an) * r0); ctx.lineTo(Math.cos(an) * R * 0.98, Math.sin(an) * R * 0.98); ctx.stroke(); }
  const sec = Math.PI / 2 - (Math.ceil(left) / 60) * TAU * 3 + Math.sin(t * 40) * 0.015; // stuck between ticks, shivering
  ctx.lineWidth = 3 / k; ctx.strokeStyle = '#a8241a'; ctx.beginPath(); ctx.moveTo(-Math.cos(sec) * R * 0.15, -Math.sin(sec) * R * 0.15); ctx.lineTo(Math.cos(sec) * R * 0.88, Math.sin(sec) * R * 0.88); ctx.stroke();
  ctx.lineWidth = 7 / k; ctx.strokeStyle = '#5a3a12'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, R * 0.6); ctx.moveTo(0, 0); ctx.lineTo(R * 0.4, -R * 0.12); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 0.08, 0, TAU); ctx.fillStyle = '#5a3a12'; ctx.fill();
  ctx.restore();
  // a small stopped clock over each villain
  for (const V of sim.stkTargets()) px(ctx, V.x, V.y + 0.62, k, () => {
    const r = Math.max(9, S * 0.22), sh = Math.sin(t * 30 + V.x) * 0.04;
    ctx.globalAlpha = a; ctx.rotate(sh);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fillStyle = '#fff7e2'; ctx.fill(); ctx.lineWidth = r * 0.18; ctx.strokeStyle = '#8a5a1c'; ctx.stroke();
    ctx.lineCap = 'round'; ctx.lineWidth = r * 0.14; ctx.strokeStyle = '#3a2406'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -r * 0.6); ctx.moveTo(0, 0); ctx.lineTo(r * 0.42, r * 0.1); ctx.stroke();
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(sd * r * 0.62, -r * 0.92, r * 0.3, Math.PI, 0); ctx.fillStyle = '#e2ae48'; ctx.fill(); ctx.lineWidth = r * 0.1; ctx.strokeStyle = '#8a5a1c'; ctx.stroke(); }
  });
  for (const e of sim.aliveEggs()) egg(e); // the eggs keep their colour: time stopped for everyone else
  void m;
}

// events -> feel: returns true when handled. api: { audio, popup, once, buzz, hitStop, punch }
export function premiumEvent(ev, fx, api) {
  const { audio, popup, once } = api;
  switch (ev.type) {
    case 'stkScoop':
      fx.burst(ev.x, ev.y, 16, (i, a, b) => ({ x: ev.x, y: ev.y, vx: (a - 0.5) * 4, vy: 1 + b * 3, drag: 1.4, g: -0.5, life: 0.5 + b * 0.5, size: 0.06 + a * 0.06, color: i % 2 ? '#ff7a1a' : '#ff4d12', hot: '#ffe27a', type: 'flame' }));
      fx.wave(ev.x, ev.y, 1.1, '#ffd23a', 0.45, 0.12);
      popup(ev.x, ev.y + 0.9, 'Rescued!', { color: '#ffd86a', size: 22 });
      once('stkPhx', 'Phoenix Chick: it flies once a level, so pick your moment.', 3);
      return true;
    case 'stkDrop':
      RT.drops.push({ x: ev.x, y: ev.y, t0: null });
      fx.sparkle(ev.x, ev.y + 0.3, 14, '#ffd23a');
      fx.burst(ev.x, ev.y + 0.6, 12, (i, a, b) => ({ x: ev.x + (a - 0.5) * 0.6, y: ev.y + 0.6, vx: (a - 0.5) * 2, vy: 1.5 + b * 2.5, drag: 1.2, life: 0.6 + b * 0.5, size: 0.05 + a * 0.05, color: '#ff6a1a', hot: '#fff3b0', type: 'flame' })); // it bursts into embers
      return true;
    case 'stkTock':
      audio.play('strike_hit', { pitch: 1.4 }); audio.play('unlock', { pitch: 0.8, vol: 0.7 });
      fx.flash = 0.4; fx.flashColor = '#ffe8b0';
      fx.wave(ev.x, ev.y, 2.4, '#fff1c8', 0.6, 0.14); fx.wave(0, 0, 4, '#e8c48a', 0.9, 0.08, { delay: 0.1 });
      popup(ev.x, ev.y + 1.2, 'Time stops!', { color: '#ffe08a', size: 22 });
      if (ev.cost > 0) popup(0, 0.6, `-${ev.cost} s`, { color: '#ff8a7a', size: 26, life: 1.4 });
      once('stkTock', 'Tick-Tock Chick: time stops, but the clock pays 10 s.', 3);
      return true;
    case 'stkTick': if (api.buzz && ev.n <= 2) api.buzz('tick'); return true;
    case 'stkTockEnd': fx.wave(0, 0, 3, '#fff6e0', 0.5, 0.06); return true;
    case 'stkBubbleOn': fx.sparkle(ev.x, ev.y, 4, '#d8f6ff'); return true;
    case 'stkPop':
      fx.burst(ev.x, ev.y, 8, (i, a) => { const an = (i / 8) * TAU; return { x: ev.x + Math.cos(an) * 0.3, y: ev.y + Math.sin(an) * 0.3, vx: Math.cos(an) * 1.6, vy: Math.sin(an) * 1.6, drag: 3, life: 0.35, size: 0.035 + a * 0.02, color: i % 2 ? '#bff0ff' : '#ffc6e8', type: 'dot' }; });
      once('stkPop', 'Bubble Chick: the bubbles pop with a little shove.', 2.6);
      return true;
    case 'stkSnip':
      RT.snips.push({ x: ev.x, y: ev.y, t0: null });
      fx.chips(ev.x, ev.y, '#7a9a5a', 5, 2);
      if (ev.n === 1) popup(ev.x, ev.y + 0.6, 'Snip!', { color: '#ffffff', size: 20 });
      return true;
  }
  return false;
}
