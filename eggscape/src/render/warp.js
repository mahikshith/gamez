// v3.4 Warp Gate art (sim/warp.js has the rules): a real swirling hole, never a glyph. Entry gates are violet and cyan and
// pull inward, exit gates are orange and gold and push outward (the colours of the level portals in render/world.js).
// World layers take ctx in world space (metres, y up); the orb emblem draws in the 200-unit y-down orb space.
import { TAU } from '../sim/geom.js';
import { WARP } from '../sim/warp.js';
import { POWER_INFO, GLASS, EMBLEM_ART } from './powers.js';

POWER_INFO.warp = { name: 'Warp gate', line: 'The next creature to strike is swallowed by a portal and spat out far away. The gate pulls in eggs too.', color: '#9b7bff' };
GLASS.warp = ['#e4dcff', '#4a2fb0', '#0d0728'];

const OUT = '#1b1410';
const PAL = {
  in: { a: '#9b7bff', b: '#4fe3ff', hi: '#efe8ff', lo: '#35249a', glow: '120,90,255', deep: '#0a0620' },
  out: { a: '#ffa04a', b: '#ffe08a', hi: '#fff4d6', lo: '#a2481a', glow: '255,150,60', deep: '#1a0a05' },
};
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (u) => { u = clamp01(u); return u * u * (3 - 2 * u); };
const back = (u) => { u = clamp01(u); const c = 2.2; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); }; // overshoots a little, then settles

// A swirling hole of radius R centred on the origin. dir +1 pulls inward (entry), -1 pushes outward (exit). px = size of
// one screen pixel in these units (outline widths), s = open amount 0..1 (an iris: the arms wind up as it opens).
export function paintVortex(ctx, R, t, kind, px, s = 1) {
  const P = PAL[kind], dir = kind === 'in' ? 1 : -1, lw = Math.max(px * 1.6, R * 0.1);
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // the glow it throws on the world
  const gl = ctx.createRadialGradient(0, 0, R * 0.7, 0, 0, R * 1.7);
  gl.addColorStop(0, `rgba(${P.glow},${0.5 * s})`); gl.addColorStop(1, `rgba(${P.glow},0)`);
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, R * 1.7, 0, TAU); ctx.fill();
  // the hole: dark and deep, a little brighter toward the lip
  const d = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
  d.addColorStop(0, '#000000'); d.addColorStop(0.45, P.deep); d.addColorStop(1, P.lo);
  ctx.fillStyle = d; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.clip();
  // tunnel rings: dashes turning at different speeds, so the hole has depth
  for (let i = 0; i < 3; i++) {
    const rr = R * (0.8 - i * 0.22), sp = dir * (1.2 + i * 0.9);
    ctx.setLineDash([rr * 0.9, rr * 0.55]);
    ctx.lineDashOffset = -t * sp * rr;
    ctx.strokeStyle = i % 2 ? P.b : P.a; ctx.globalAlpha = (0.28 + 0.1 * i) * s; ctx.lineWidth = lw * 0.5;
    ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke();
  }
  ctx.setLineDash([]);
  // spiral arms winding into the centre, thick at the rim and thin at the core
  const N = 6, SEG = 16, wind = 3.4 + (1 - s) * 2;
  for (let i = 0; i < N; i++) {
    const base = dir * t * 2.6 + (i * TAU) / N;
    for (let k = 0; k < SEG; k++) {
      const f0 = k / SEG, f1 = (k + 1) / SEG;
      const r0 = R * (1.0 * (1 - f0) + 0.04), r1 = R * (1.0 * (1 - f1) + 0.04), a0 = base + dir * f0 * wind, a1 = base + dir * f1 * wind;
      ctx.globalAlpha = s * (0.3 + 0.7 * Math.pow(1 - f0, 0.7)) * (i % 2 ? 0.8 : 1);
      ctx.strokeStyle = i % 2 ? P.b : P.a;
      ctx.lineWidth = lw * (0.25 + 0.95 * (1 - f0));
      ctx.beginPath(); ctx.moveTo(r0 * Math.cos(a0), r0 * Math.sin(a0)); ctx.lineTo(r1 * Math.cos(a1), r1 * Math.sin(a1)); ctx.stroke();
    }
  }
  // specks carried along the spiral: in toward the core (entry) or out toward the lip (exit)
  ctx.globalAlpha = s;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 9; i++) {
    const ph = (t * 0.9 + i / 9) % 1, f = dir > 0 ? ph : 1 - ph, rr = R * (0.96 * (1 - f) + 0.05), an = dir * t * 2.6 + i * 2.4 + dir * f * wind;
    ctx.globalAlpha = s * Math.sin(Math.PI * ph);
    ctx.beginPath(); ctx.arc(rr * Math.cos(an), rr * Math.sin(an), Math.max(px * 0.9, R * 0.045), 0, TAU); ctx.fill();
  }
  // the bright pinprick far down the hole
  ctx.globalAlpha = s;
  const c = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.3);
  c.addColorStop(0, '#ffffff'); c.addColorStop(0.3, `rgba(${P.glow},0.8)`); c.addColorStop(1, `rgba(${P.glow},0)`);
  ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, R * (0.2 + 0.03 * Math.sin(t * 7)), 0, TAU); ctx.fill();
  ctx.restore();
  // the lip: dark outline, a lit rim (light from the top left), and a thin inner shade
  ctx.globalAlpha = 1;
  ctx.strokeStyle = OUT; ctx.lineWidth = lw * 1.55;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
  const rim = ctx.createLinearGradient(-R * 0.8, -R * 0.8, R * 0.8, R * 0.8);
  rim.addColorStop(0, P.hi); rim.addColorStop(0.5, P.a); rim.addColorStop(1, P.lo);
  ctx.strokeStyle = rim; ctx.lineWidth = lw * 0.95;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(px, lw * 0.22);
  ctx.beginPath(); ctx.arc(0, 0, R + lw * 0.1, Math.PI * 1.08, Math.PI * 1.45); ctx.stroke();
  ctx.restore();
}

// the pull streaks round an entry gate (faint spirals turning in)
function pullField(ctx, g, t, a, px) {
  const R = WARP.suck;
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const ph = (t * 0.8 + i / 7) % 1;
    ctx.strokeStyle = `rgba(210,195,255,${0.7 * a * Math.sin(Math.PI * ph)})`;
    ctx.lineWidth = Math.max(px, 0.035);
    ctx.beginPath();
    for (let s = 0; s <= 8; s++) {
      const f = s / 8, rr = (R * (1 - ph) * (1 - f * 0.35) + g.r * 0.9 * ph) + 0.05, an = (i * TAU) / 7 + t * 1.8 + f * 0.9 + ph * 2.2;
      if (s) ctx.lineTo(rr * Math.cos(an), rr * Math.sin(an)); else ctx.moveTo(rr * Math.cos(an), rr * Math.sin(an));
    }
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- the orb emblem (200 units across)
EMBLEM_ART.warp = (ctx, t) => {
  ctx.save();
  paintVortex(ctx, 66, t, 'in', 3.2, 1);
  ctx.restore();
};

// ---------- world layer: gates, and the armed swirl orbiting the hen
export function drawWarp(ctx, sim, k, t) {
  const W = sim.p2 && sim.p2.warp;
  if (!W) return;
  const px = 1 / k;
  for (const g of W.gates) {
    if (g.t < 0) continue;
    const open = g.t < 0.24 ? back(g.t / 0.24) : 1, close = g.life - g.t < 0.32 ? Math.pow(clamp01((g.life - g.t) / 0.32), 1.4) : 1;
    const sc = open * close;
    if (sc <= 0.01) continue;
    ctx.save();
    ctx.translate(g.x, g.y);
    if (g.k === 'in' && g.pull) pullField(ctx, g, t, Math.min(1, g.t / 0.3) * close, px);
    ctx.rotate((1 - close) * 2.4 * (g.k === 'in' ? 1 : -1) + (1 - Math.min(1, g.t / 0.24)) * 1.5);
    ctx.scale(sc, sc);
    paintVortex(ctx, g.r, t + g.id * 0.7, g.k, px, Math.min(1, 0.4 + g.t * 4));
    ctx.restore();
  }
  // armed: a small swirl circling the hen and a ring that runs down with the time left; a pip per charge
  if (W.arm > 0 && W.ch > 0 && k >= 20) {
    const n = sim.nest.getPosition(), s = Math.max(0.95, Math.min(52, k * 1.5) / k);
    const hx = n.x + sim.nestW / 2 + 0.6 + (s - 0.95) / 2, hy = sim.groundY + s * 0.62;
    const a = t * 2.1, ox = hx + Math.cos(a) * s * 0.62, oy = hy + Math.sin(a) * s * 0.2 + Math.sin(a * 0.5) * 0.04;
    const R = Math.max(0.24, 13 / k), u = W.arm / W.max, blink = W.arm < 2.5 && Math.sin(t * 16) < -0.3;
    if (!blink) {
      ctx.save();
      ctx.translate(ox, oy);
      const hl = ctx.createRadialGradient(0, 0, R * 0.5, 0, 0, R * 3.2); // a pulsing halo so it is noticed
      hl.addColorStop(0, `rgba(160,130,255,${0.55 + 0.25 * Math.sin(t * 5)})`); hl.addColorStop(1, 'rgba(160,130,255,0)');
      ctx.fillStyle = hl; ctx.beginPath(); ctx.arc(0, 0, R * 3.2, 0, TAU); ctx.fill();
      paintVortex(ctx, R, t, 'in', px, 1);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(hx, hy);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(27,20,16,0.7)'; ctx.lineWidth = Math.max(4 * px, 0.06);
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.62, s * 0.2, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#e4dcff'; ctx.lineWidth = Math.max(3 * px, 0.045);
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.62, s * 0.2, 0, -Math.PI / 2, -Math.PI / 2 + TAU * u); ctx.stroke();
    for (let i = 0; i < W.ch; i++) {
      ctx.beginPath(); ctx.arc((i - (W.ch - 1) / 2) * 0.2, -s * 0.34, Math.max(0.05, 3 * px), 0, TAU);
      ctx.fillStyle = '#4fe3ff'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(px, 0.012); ctx.stroke();
    }
    ctx.restore();
  }
}

// ---------- a creature being swallowed or spat out: draw its layer through this (begin / end). The creature shrinks
// into the gate on a spiral, stretched toward it, and the reverse at the exit. kind: 'e' eagle, 'f' frog, 'o' octopus.
// Returns null when nothing of that kind is inside a gate (or the layer holds more than that one creature).
export function warpXfBegin(ctx, sim, kind) {
  const W = sim.p2 && sim.p2.warp;
  if (!W || !W.holds.length) return null;
  const h = W.holds.find((q) => q.k === kind);
  if (!h) return null;
  let ax, ay;
  if (kind === 'e') { ax = sim.eagle.x; ay = sim.eagle.y; }
  else if (kind === 'f') { if ((sim.frogs || []).length !== 1) return null; const F = sim.frogs[0]; ax = F.x + F.nx * 0.2; ay = F.y + F.ny * 0.2; }
  else { if ((sim.octos || []).length !== 1 || (sim.schools || []).length) return null; const C = sim.octos[0]; ax = C.rad * Math.cos(C.a); ay = C.rad * Math.sin(C.a); }
  const SW = WARP.swallow, EM = WARP.emerge, into = h.t < SW;
  const u = into ? clamp01(h.t / SW) : clamp01((h.t - SW) / EM), e = ease(u);
  const sc = into ? 1 - Math.pow(e, 0.8) * 0.96 : 0.04 + 0.96 * back(u);
  const px = into ? h.g[0] : h.x[0], py = into ? h.g[1] : h.x[1], w = into ? e : 1 - e;
  const dx = px - ax, dy = py - ay, th = Math.atan2(dy, dx), stretch = 1 + 0.9 * Math.sin(Math.PI * u) * (into ? 1 : 0.6);
  ctx.save();
  ctx.translate(ax + dx * w, ay + dy * w);
  ctx.rotate(th + (into ? e : e - 1) * 4.5);
  ctx.scale(sc * stretch, sc / Math.sqrt(stretch));
  ctx.rotate(-th);
  ctx.translate(-ax, -ay);
  ctx.globalAlpha *= into ? 1 - 0.7 * Math.pow(e, 3) : 0.3 + 0.7 * e;
  return true;
}
export function warpXfEnd(ctx, tok) { if (tok) ctx.restore(); }

// ---------- events. api: popup, audio, once
// At most one warp label per 1.5 s: a swallow and the egg it pulls in share one line, never two on top of each other
// (and never over the gate: they sit a gate radius plus a bit above it).
let lastPop = -9;
function label(api, ev, x, y, r, text, o, below) {
  const sim = api.sim, t = sim ? sim.t : 0;
  if (t - lastPop < 1.5 && t >= lastPop) return;
  lastPop = t;
  api.popup(x, below ? y - r - 1.3 : y + r + 0.55, text, o); // below it when the creature (the eagle) hangs above the gate
}
export function warpEvent(ev, fx, api) {
  const { audio, once } = api;
  switch (ev.type) {
    case 'powerOn':
      if (ev.power !== 'warp') return false;
      audio.play('portal_enter', { vol: 0.5, pitch: 1.5 }); audio.play('rewind', { vol: 0.3, pitch: 1.9 });
      once('warp', 'Warp gate armed! The next creature that strikes is swallowed. The open gate also pulls in your eggs.');
      return true;
    case 'warpOpen':
      audio.play('portal_enter', { vol: 0.8 });
      fx.wave(ev.x, ev.y, 0.9, '#b9a5ff', 0.4, 0.1);
      fx.sparkle(ev.x, ev.y, 10, '#8de8ff');
      label(api, ev, ev.x, ev.y, ev.r || 0.5, ev.kind === 'boss' ? 'Resists!' : 'Warp!', { color: '#c8b6ff', size: 22, life: 1.1 }, ev.kind === 'e');
      return true;
    case 'warpResist':
      audio.play('steel_clang', { vol: 0.6, pitch: 0.8 });
      fx.shake = Math.max(fx.shake, 0.25);
      return true;
    case 'warpIn':
      audio.play('bubble_pop', { vol: 0.6, pitch: 0.55 });
      fx.sparkle(ev.x, ev.y, 12, '#c8b6ff');
      return true;
    case 'warpOut':
      audio.play('portal_exit', { vol: 0.8 });
      fx.wave(ev.x, ev.y, 0.9, '#ffc27a', 0.4, 0.1);
      fx.sparkle(ev.x, ev.y, 10, '#ffe08a');
      return true;
    case 'warpEgg':
      audio.play('portal_enter', { vol: 0.7, pitch: 1.3 }); setTimeout(() => audio.play('portal_exit', { vol: 0.6 }), 90);
      fx.burst(ev.x, ev.y, 10, (i, a, b) => ({ x: ev.x + (ev.x2 - ev.x) * a, y: ev.y + (ev.y2 - ev.y) * a, vx: (b - 0.5) * 1.2, vy: (b - 0.5) * 1.2, drag: 3, life: 0.45, size: 0.05, color: '#d8ccff' }));
      label(api, ev, ev.x2, ev.y2, 0.36, 'Pulled through!', { color: '#ffb27a', size: 18, life: 1.1 });
      once('warpEgg', 'Careful: the open gate pulls in eggs too, and drops them further in.');
      return true;
    case 'warpBait':
      audio.play('twin_hatch', { vol: 0.6 });
      fx.sparkle(ev.x2, ev.y2, 12, '#ffcf8a');
      return true;
  }
  return false;
}
