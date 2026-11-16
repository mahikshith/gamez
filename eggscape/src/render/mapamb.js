// World-map ambience (2026-11-16, mykee: "more lively creatures and animations on the map"): each world's stretch of the
// map gets its own weather and passers-by on top of the still scenery and the placed cast (render/mapscene.js):
//   farm: drifting clouds, a flock of birds, butterflies     woods: falling leaves, fireflies, a bird flock
//   frozen: aurora, snowfall, a chick sledging down           crystal: crystal glows, floating motes, bats
//   volcano: eruptions with lava bombs, embers, lava glow    storm: rain, lightning flashes, storm clouds, wind
//   vault: coin glints, dust in torch light, a rolling coin  reef: light rays, a school of fish, bubble columns
//   bayou: mist, fireflies, dragonflies                      lab: blinking lights, steam, sparks, the brass owl on patrol
// Everything is a pure function of time (no state, no allocation per frame), only for bands on screen, a few dozen
// simple shapes per band, cached glow sprites (no gradients built per frame). Nothing moves with reduced motion.
import { drawFish } from './sea.js';
import { drawOwlArt } from './owl.js';
import { drawChick } from './characters.js';

const TAU = Math.PI * 2;
const fract = (x) => x - Math.floor(x);
const hash = (n) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// glow sprites: a soft radial dot in a colour, cached per colour
const SPR = new Map();
function glowSpr(col) {
  let c = SPR.get(col);
  if (c) return c;
  c = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!c) return null;
  c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, col); r.addColorStop(0.3, col); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  SPR.set(col, c);
  return c;
}
function glow(ctx, col, x, y, r, a = 1) { const s = glowSpr(col); if (!s || a <= 0.01) return; const a0 = ctx.globalAlpha; ctx.globalAlpha = a0 * a; ctx.drawImage(s, x - r, y - r, r * 2, r * 2); ctx.globalAlpha = a0; }
// a soft vertical light shaft (reef rays, torch light), cached
let RAY = null;
function raySpr() {
  if (RAY || typeof document === 'undefined') return RAY;
  RAY = document.createElement('canvas'); RAY.width = 32; RAY.height = 128;
  const g = RAY.getContext('2d'), h = g.createLinearGradient(0, 0, 0, 128); h.addColorStop(0, 'rgba(255,255,240,0.55)'); h.addColorStop(1, 'rgba(255,255,240,0)');
  g.fillStyle = h; g.beginPath(); g.moveTo(10, 0); g.lineTo(22, 0); g.lineTo(32, 128); g.lineTo(0, 128); g.closePath(); g.fill();
  return RAY;
}
const blob = (ctx, x, y, r, col) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = col; ctx.fill(); };
// one soft cloud: the lobes are unioned into a single path and filled once, so translucent clouds never show seams
function puff(ctx, x, y, s, col, belly) {
  ctx.beginPath();
  for (const [dx, dy, r] of [[-0.36, 0.02, 0.24], [-0.12, -0.12, 0.3], [0.16, -0.16, 0.33], [0.4, 0.02, 0.24]]) { ctx.moveTo(x + dx * s + r * s, y + dy * s); ctx.arc(x + dx * s, y + dy * s, r * s, 0, TAU); }
  ctx.rect(x - 0.36 * s, y - 0.02 * s, 0.76 * s, 0.26 * s);
  if (belly) { const g = ctx.createLinearGradient(0, y - 0.5 * s, 0, y + 0.26 * s); g.addColorStop(0, col); g.addColorStop(1, belly); ctx.fillStyle = g; } else ctx.fillStyle = col;
  ctx.fill('nonzero');
}
// a traveller's x: crosses the safe width (plus margins) in `dur` seconds, then waits `gap`; dir +1 left->right. null while off
function cross(t, dur, gap, seed, x0, x1, dir = 1) { const k = fract((t + seed * (dur + gap)) / (dur + gap)) * (dur + gap); if (k > dur) return null; const v = k / dur; return { v, x: dir > 0 ? x0 + (x1 - x0) * v : x1 - (x1 - x0) * v }; }

function bird(ctx, x, y, s, flap, col) { // a little "m" bird
  const f = Math.sin(flap) * 0.5;
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.2, s * 0.16); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x - s, y - s * (0.2 + f)); ctx.quadraticCurveTo(x - s * 0.45, y - s * (0.55 + f), x, y); ctx.quadraticCurveTo(x + s * 0.45, y - s * (0.55 + f), x + s, y - s * (0.2 + f)); ctx.stroke();
}
function bat(ctx, x, y, s, flap) {
  const f = Math.sin(flap);
  ctx.fillStyle = '#2a1a3a';
  ctx.beginPath(); ctx.ellipse(x, y, s * 0.18, s * 0.26, 0, 0, TAU); ctx.fill();
  for (const d of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(x + d * s * 0.12, y - s * 0.05);
    ctx.quadraticCurveTo(x + d * s * 0.6, y - s * (0.55 + f * 0.4), x + d * s * 1.05, y - s * (0.1 + f * 0.55));
    ctx.quadraticCurveTo(x + d * s * 0.8, y + s * 0.05, x + d * s * 0.62, y - s * 0.02); ctx.quadraticCurveTo(x + d * s * 0.45, y + s * 0.18, x + d * s * 0.12, y + s * 0.08);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#ffe14a'; blob(ctx, x - s * 0.06, y - s * 0.08, s * 0.035, '#ffe14a'); blob(ctx, x + s * 0.06, y - s * 0.08, s * 0.035, '#ffe14a');
}
function butterfly(ctx, x, y, s, flap, col) {
  const f = 0.25 + 0.75 * Math.abs(Math.sin(flap));
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.ellipse(x - s * 0.45 * f, y - s * 0.15, s * 0.45 * f, s * 0.55, -0.35, 0, TAU); ctx.ellipse(x + s * 0.45 * f, y - s * 0.15, s * 0.45 * f, s * 0.55, 0.35, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x - s * 0.3 * f, y + s * 0.3, s * 0.3 * f, s * 0.32, -0.2, 0, TAU); ctx.ellipse(x + s * 0.3 * f, y + s * 0.3, s * 0.3 * f, s * 0.32, 0.2, 0, TAU); ctx.fill();
  ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - s * 0.05, y - s * 0.45, s * 0.1, s * 0.9);
}
function dragonfly(ctx, x, y, s, ang, flap) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.fillStyle = 'rgba(220,245,255,0.55)';
  const f = 0.6 + 0.4 * Math.sin(flap);
  for (const [dx, sy] of [[0.12, -1], [0.12, 1], [-0.05, -1], [-0.05, 1]]) { ctx.beginPath(); ctx.ellipse(dx * s, sy * s * 0.32 * f, s * 0.12, s * 0.34 * f, sy * 0.25, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = '#1f8aa8'; ctx.lineWidth = Math.max(1.4, s * 0.1); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-s * 0.6, 0); ctx.lineTo(s * 0.3, 0); ctx.stroke();
  blob(ctx, s * 0.34, 0, s * 0.1, '#156a84');
  ctx.restore();
}
function leaf(ctx, x, y, s, r, col) { ctx.save(); ctx.translate(x, y); ctx.rotate(r); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-s, 0); ctx.quadraticCurveTo(0, -s * 0.9, s, 0); ctx.quadraticCurveTo(0, s * 0.9, -s, 0); ctx.fill(); ctx.restore(); }
function sparkle(ctx, x, y, r, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r); ctx.fill(); }
function boltPath(ctx, x, y0, y1, seed, w) {
  const n = 6; ctx.beginPath(); ctx.moveTo(x, y0);
  for (let i = 1; i <= n; i++) ctx.lineTo(x + (i < n ? (hash(seed + i) - 0.5) * w : 0), y0 + ((y1 - y0) * i) / n);
}

// G: { x0, x1 (safe band width), y (band top on screen), h (band height), u, t, spots(kind) -> [{x, y, s}] }
const AMB = [
  { // 0 farm
    back(ctx, G) {
      const { x0, x1, y, h, u, t } = G;
      for (let i = 0; i < 3; i++) { // slow clouds drifting over the fields
        const s = (46 + i * 16) * u, span = x1 - x0 + s * 3, cx = x0 - s * 1.5 + fract(t * (0.006 + i * 0.002) + i * 0.37) * span;
        puff(ctx, cx, y + h * (0.12 + i * 0.3), s, 'rgba(255,255,255,0.55)');
      }
    },
    front(ctx, G) {
      const { x0, x1, y, h, u, t } = G;
      const c = cross(t, 9, 7, 0.2, x0 - 60 * u, x1 + 60 * u, 1); // a flock crossing every 16 s
      if (c) for (let i = 0; i < 5; i++) { const k = Math.abs(i - 2); bird(ctx, c.x - k * 16 * u - (i > 2 ? 4 * u : 0), y + h * 0.3 + k * 9 * u + Math.sin(t * 1.3) * 6 * u, 7 * u, t * 9 + i, 'rgba(50,40,40,0.75)'); }
      for (let i = 0; i < 3; i++) { const a = t * 0.55 + i * 2.1, bx = x0 + (0.2 + 0.3 * i) * (x1 - x0) + Math.sin(a) * 40 * u, by = y + h * (0.25 + 0.25 * i) + Math.sin(a * 1.7) * 18 * u; butterfly(ctx, bx, by, 6 * u, t * 11 + i, ['#ffd23a', '#ff8ab0', '#ffffff'][i]); }
    },
  },
  { // 1 woods
    front(ctx, G) {
      const { x0, x1, y, h, u, t } = G;
      for (let i = 0; i < 12; i++) { // leaves tumbling down
        const sp = 0.05 + hash(i) * 0.04, k = fract(t * sp + hash(i + 9)), lx = x0 + hash(i + 3) * (x1 - x0) + Math.sin(t * 1.2 + i) * 24 * u, ly = y + k * h;
        const a = k < 0.08 ? k / 0.08 : k > 0.9 ? (1 - k) / 0.1 : 1;
        ctx.globalAlpha = a; leaf(ctx, lx, ly, (5 + hash(i + 5) * 3) * u, t * (1 + hash(i)) * 2 + i, ['#e8872a', '#c8402a', '#d8b02a', '#6aa83a'][i % 4]); ctx.globalAlpha = 1;
      }
      for (let i = 0; i < 9; i++) { // fireflies
        const fx = x0 + hash(i + 20) * (x1 - x0) + Math.sin(t * 0.6 + i * 2) * 20 * u, fy = y + (0.2 + hash(i + 30) * 0.7) * h + Math.cos(t * 0.8 + i) * 14 * u;
        glow(ctx, 'rgba(230,255,110,1)', fx, fy, 9 * u, 0.25 + 0.75 * Math.max(0, Math.sin(t * 2.2 + i * 1.9)));
      }
      const c = cross(t, 8, 9, 0.6, x0 - 50 * u, x1 + 50 * u, -1);
      if (c) for (let i = 0; i < 3; i++) bird(ctx, c.x + i * 18 * u, y + h * 0.2 + i * 8 * u, 6 * u, t * 10 + i, 'rgba(40,50,30,0.7)');
    },
  },
  { // 2 frozen
    back(ctx, G) {
      const { x0, x1, y, h, u, t } = G;
      G.spots('lake').forEach((p, i) => { // glints running over the ice
        for (let q = 0; q < 3; q++) { const k = fract(t * 0.45 + q / 3 + i * 0.3), a = Math.sin(k * Math.PI); sparkle(ctx, p.x + (hash(q + i * 5) - 0.5) * p.s * 1.6, p.y - p.s * (0.2 + hash(q + 9) * 0.25), (3 + a * 5) * u, `rgba(255,255,255,${a})`); }
      });
    },
    front(ctx, G) {
      const { x0, x1, y, h, u, t } = G;
      for (let i = 0; i < 26; i++) { // snow over the whole stretch
        const sp = 0.04 + hash(i) * 0.05, k = fract(t * sp + hash(i + 2)), sx = x0 + hash(i + 7) * (x1 - x0) + Math.sin(t * 0.9 + i) * 12 * u;
        blob(ctx, sx, y + k * h, (1.4 + hash(i + 4) * 2.2) * u, 'rgba(255,255,255,0.9)');
      }
      const c = cross(t, 5, 8, 0.3, x0 + 20 * u, x1 - 20 * u, 1); // a chick sledging down the slope
      if (c) {
        const sx = c.x, sy = y + h * (0.55 + c.v * 0.25);
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(0.22);
        ctx.fillStyle = '#d8302a'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-16 * u, -4 * u, 32 * u, 7 * u, 3 * u) : ctx.rect(-16 * u, -4 * u, 32 * u, 7 * u); ctx.fill();
        ctx.strokeStyle = '#6a4424'; ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.moveTo(-18 * u, 6 * u); ctx.lineTo(16 * u, 6 * u); ctx.quadraticCurveTo(22 * u, 6 * u, 21 * u, 0); ctx.stroke();
        drawChick(ctx, 0, -14 * u, 27 * u, t, 1, 0);
        ctx.restore();
        for (let q = 1; q < 5; q++) blob(ctx, sx - q * 9 * u, sy - q * 2.4 * u + 6 * u, (3 - q * 0.5) * u, `rgba(255,255,255,${0.7 - q * 0.15})`);
      }
    },
  },
  { // 3 crystal caves
    back(ctx, G) {
      const { u, t } = G;
      G.spots('crystal').forEach((p, i) => glow(ctx, ['rgba(200,140,255,1)', 'rgba(120,230,255,1)', 'rgba(255,140,220,1)'][i % 3], p.x, p.y - p.s * 0.55, p.s * 0.9, 0.25 + 0.2 * Math.sin(t * 1.6 + i * 2)));
      void u;
    },
    front(ctx, G) {
      const { x0, x1, y, h, u, t } = G;
      for (let i = 0; i < 14; i++) { // motes drifting up
        const k = fract(t * (0.03 + hash(i) * 0.03) + hash(i + 1)), mx = x0 + hash(i + 11) * (x1 - x0) + Math.sin(t + i) * 10 * u;
        glow(ctx, i % 2 ? 'rgba(220,180,255,1)' : 'rgba(170,240,255,1)', mx, y + (1 - k) * h, 5 * u, Math.sin(k * Math.PI));
      }
      for (let i = 0; i < 4; i++) { const k = fract(t * 0.5 + i * 0.27); if (k < 0.3) sparkle(ctx, x0 + hash(i * 3 + Math.floor(t * 0.5 + i * 0.27)) * (x1 - x0), y + hash(i * 5 + Math.floor(t * 0.5)) * h, 7 * u * Math.sin((k / 0.3) * Math.PI), '#ffffff'); }
      for (let b = 0; b < 2; b++) { const c = cross(t, 6, 6 + b * 3, 0.15 + b * 0.5, x0 - 40 * u, x1 + 40 * u, b ? -1 : 1); if (c) bat(ctx, c.x, y + h * (0.25 + b * 0.35) + Math.sin(t * 4 + b) * 12 * u, 14 * u, t * 14 + b); }
    },
  },
  { // 4 volcano
    back(ctx, G) {
      const { u, t } = G;
      G.spots('lava').forEach((p, i) => glow(ctx, 'rgba(255,120,30,1)', p.x, p.y - p.s * 0.25, p.s * 1.1, 0.3 + 0.2 * Math.sin(t * 2 + i)));
      G.spots('volcano').forEach((p, i) => { // smoke from the crater
        for (let q = 0; q < 4; q++) { const a = fract(t * 0.18 + q / 4 + i * 0.3); blob(ctx, p.x + Math.sin(a * 4 + q) * 8 * u, p.y - p.s * 0.82 - a * p.s * 0.9, (8 + a * 22) * u, `rgba(70,50,50,${0.4 * (1 - a)})`); }
      });
    },
    front(ctx, G) {
      const { x0, x1, y, h, u, t } = G;
      G.spots('volcano').forEach((p, i) => { // every 7 s it erupts: lava bombs arc out and fall
        const k = fract(t / 7 + i * 0.4) * 7; if (k > 1.6) return;
        const top = p.y - p.s * 0.82; glow(ctx, 'rgba(255,170,60,1)', p.x, top, p.s * 0.4, 1 - k / 1.6);
        for (let q = 0; q < 6; q++) { const vx = (hash(q + i * 7) - 0.5) * p.s * 1.1, vy = -p.s * (0.9 + hash(q + 3) * 0.6), bx = p.x + vx * k, by = top + vy * k + p.s * 1.4 * k * k; blob(ctx, bx, by, (2.5 + (q % 3)) * u, q % 2 ? '#ff7a1e' : '#ffd23a'); }
      });
      for (let i = 0; i < 16; i++) { // embers rising over the stretch
        const k = fract(t * (0.08 + hash(i) * 0.06) + hash(i + 4)), ex = x0 + hash(i + 8) * (x1 - x0) + Math.sin(t * 1.4 + i) * 14 * u;
        glow(ctx, i % 3 ? 'rgba(255,150,40,1)' : 'rgba(255,220,90,1)', ex, y + (1 - k) * h, (3 + (i % 3)) * u, Math.sin(k * Math.PI));
      }
    },
  },
  { // 5 storm peaks
    back(ctx, G) {
      const { x0, x1, y, h, u, t } = G;
      for (let i = 0; i < 3; i++) { const s = (60 + i * 14) * u, span = x1 - x0 + s * 3, cx = x0 - s * 1.5 + fract(t * (0.012 + i * 0.004) + i * 0.41) * span; puff(ctx, cx, y + h * (0.08 + i * 0.28), s, 'rgba(120,130,160,0.62)', 'rgba(58,64,92,0.7)'); }
    },
    front(ctx, G) {
      const { x0, x1, y, h, u, t } = G;
      ctx.strokeStyle = 'rgba(200,220,255,0.45)'; ctx.lineWidth = 1.4 * u; ctx.lineCap = 'round'; ctx.beginPath();
      for (let i = 0; i < 34; i++) { const k = fract(t * (0.9 + hash(i) * 0.5) + hash(i + 2)), rx = x0 + hash(i + 5) * (x1 - x0 + 60 * u), ry = y + k * h; ctx.moveTo(rx, ry); ctx.lineTo(rx - 6 * u, ry + 18 * u); }
      ctx.stroke();
      const k = fract(t / 6.5) * 6.5; // lightning: a flash and a bolt
      if (k < 0.28) {
        const n = Math.floor(t / 6.5), bx = x0 + (0.2 + hash(n) * 0.6) * (x1 - x0), a = k < 0.07 || (k > 0.14 && k < 0.2) ? 1 : 0.35;
        ctx.fillStyle = `rgba(230,240,255,${0.22 * a})`; ctx.fillRect(x0 - 40 * u, y, x1 - x0 + 80 * u, h);
        ctx.strokeStyle = `rgba(255,250,200,${a})`; ctx.lineWidth = 3.5 * u; ctx.lineJoin = 'miter'; boltPath(ctx, bx, y + h * 0.05, y + h * (0.45 + hash(n + 1) * 0.3), n * 13, 40 * u); ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 1.4 * u; ctx.stroke();
      }
      for (let i = 0; i < 3; i++) { const c = cross(t, 2.2, 3.5, i * 0.33, x0 - 80 * u, x1 + 80 * u, 1); if (!c) continue; const wy = y + h * (0.25 + i * 0.22); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.moveTo(c.x - 60 * u, wy); ctx.quadraticCurveTo(c.x - 20 * u, wy - 8 * u, c.x, wy); ctx.stroke(); }
    },
  },
  { // 6 thieves' vault
    back(ctx, G) {
      const { x0, x1, y, h, u, t } = G;
      const R = raySpr(); if (R) { ctx.globalAlpha = 0.5; for (let i = 0; i < 2; i++) { const rx = x0 + (0.25 + i * 0.5) * (x1 - x0); ctx.save(); ctx.translate(rx, y); ctx.rotate(0.25 - i * 0.5 + Math.sin(t * 0.3 + i) * 0.03); ctx.drawImage(R, -40 * u, 0, 80 * u, h * 0.9); ctx.restore(); } ctx.globalAlpha = 1; }
      for (let i = 0; i < 14; i++) { const k = fract(t * 0.02 + hash(i)), mx = x0 + hash(i + 3) * (x1 - x0) + Math.sin(t * 0.4 + i) * 16 * u; blob(ctx, mx, y + (0.1 + 0.8 * k) * h, 1.4 * u, 'rgba(255,240,200,0.6)'); }
    },
    front(ctx, G) {
      const { x0, x1, y, h, u, t } = G;
      G.spots('coins').forEach((p, i) => { const k = fract(t * 0.45 + i * 0.37); if (k < 0.25) sparkle(ctx, p.x + (hash(i + Math.floor(t * 0.45)) - 0.5) * p.s * 0.4, p.y - p.s * 0.2, 9 * u * Math.sin((k / 0.25) * Math.PI), '#fffbe0'); });
      const c = cross(t, 6, 8, 0.5, x0, x1, 1); // a runaway coin rolls along the floor
      if (c) { const cy = y + h * 0.72 - Math.abs(Math.sin(c.v * 14)) * 10 * u * (1 - c.v); ctx.save(); ctx.translate(c.x, cy); ctx.scale(Math.cos(t * 9), 1); blob(ctx, 0, 0, 8 * u, '#f2c43a'); ctx.strokeStyle = '#a2740e'; ctx.lineWidth = 1.6 * u; ctx.beginPath(); ctx.arc(0, 0, 5 * u, 0, TAU); ctx.stroke(); ctx.restore(); }
    },
  },
  { // 7 coral reef
    back(ctx, G) {
      const { x0, x1, y, h, u, t } = G;
      const R = raySpr(); if (R) { ctx.globalAlpha = 0.45; for (let i = 0; i < 3; i++) { const rx = x0 + (0.16 + i * 0.34) * (x1 - x0); ctx.save(); ctx.translate(rx, y - 20 * u); ctx.rotate(0.18 + Math.sin(t * 0.4 + i * 1.3) * 0.06); ctx.drawImage(R, -26 * u, 0, 52 * u, h * 0.95); ctx.restore(); } ctx.globalAlpha = 1; }
    },
    front(ctx, G) {
      const { x0, x1, y, h, u, t } = G;
      for (let s2 = 0; s2 < 2; s2++) { // schools of fish
        const dir = s2 ? -1 : 1, c = cross(t, 10, 4, 0.3 + s2 * 0.45, x0 - 80 * u, x1 + 80 * u, dir); if (!c) continue;
        for (let i = 0; i < 6; i++) { const fx = c.x - dir * ((i % 3) * 20 + (i > 2 ? 10 : 0)) * u, fy = y + h * (0.3 + s2 * 0.32) + (i > 2 ? 14 : 0) * u + Math.sin(t * 2 + i) * 4 * u; drawFish(ctx, fx, fy, 16 * u, dir > 0 ? 0 : Math.PI, t + i, { flip: 1 }); }
      }
      for (let col = 0; col < 3; col++) { // bubble columns
        const bx = x0 + (0.18 + col * 0.33) * (x1 - x0);
        for (let i = 0; i < 6; i++) { const k = fract(t * 0.22 + i / 6 + col * 0.3), r = (1.6 + (i % 3)) * u; ctx.beginPath(); ctx.arc(bx + Math.sin(k * 9 + i) * 6 * u, y + (1 - k) * h, r, 0, TAU); ctx.strokeStyle = `rgba(255,255,255,${0.8 * Math.sin(k * Math.PI)})`; ctx.lineWidth = 1.2 * u; ctx.stroke(); }
      }
    },
  },
  { // 8 gator bayou
    back(ctx, G) {
      const { x0, x1, y, h, u, t } = G;
      for (let i = 0; i < 4; i++) { const span = x1 - x0 + 300 * u, mx = x0 - 150 * u + fract(t * 0.01 + i * 0.29) * span; glow(ctx, 'rgba(235,245,230,1)', mx, y + h * (0.2 + i * 0.2), 110 * u, 0.22); }
      G.spots('swamp').forEach((p, i) => { const k = fract(t * 0.4 + i * 0.5); ctx.strokeStyle = `rgba(220,240,210,${0.5 * (1 - k)})`; ctx.lineWidth = 1.4 * u; ctx.beginPath(); ctx.ellipse(p.x + p.s * 0.1, p.y - p.s * 0.2, p.s * 0.15 + k * p.s * 0.3, (p.s * 0.15 + k * p.s * 0.3) * 0.3, 0, 0, TAU); ctx.stroke(); });
    },
    front(ctx, G) {
      const { x0, x1, y, h, u, t } = G;
      for (let i = 0; i < 10; i++) { const fx = x0 + hash(i + 40) * (x1 - x0) + Math.sin(t * 0.5 + i * 2) * 22 * u, fy = y + (0.15 + hash(i + 50) * 0.75) * h + Math.cos(t * 0.7 + i) * 12 * u; glow(ctx, 'rgba(240,255,120,1)', fx, fy, 9 * u, 0.2 + 0.8 * Math.max(0, Math.sin(t * 2 + i * 1.7))); }
      for (let i = 0; i < 2; i++) { // dragonflies: dart, hover, dart
        const seg = Math.floor(t / 1.6 + i * 0.5), k = clamp((fract(t / 1.6 + i * 0.5)) * 3, 0, 1), e = k * k * (3 - 2 * k);
        const ax = x0 + hash(seg * 3 + i) * (x1 - x0), ay = y + (0.2 + hash(seg * 5 + i) * 0.6) * h, bx = x0 + hash(seg * 3 + 3 + i) * (x1 - x0), by = y + (0.2 + hash(seg * 5 + 5 + i) * 0.6) * h;
        dragonfly(ctx, ax + (bx - ax) * e, ay + (by - ay) * e + Math.sin(t * 6 + i) * 2 * u, 14 * u, Math.atan2(by - ay, bx - ax) * 0.25, t * 40);
      }
    },
  },
  { // 9 shape lab
    back(ctx, G) {
      const { u, t } = G;
      G.spots('beaker').forEach((p, i) => { // bubbling flasks with a little steam
        for (let q = 0; q < 4; q++) { const k = fract(t * 0.7 + q / 4 + i * 0.2); blob(ctx, p.x + Math.sin(k * 8 + q) * p.s * 0.05, p.y - p.s * (0.1 + k * 0.55), (1.4 + (q % 2)) * u, `rgba(255,255,255,${0.8 * (1 - k)})`); }
        for (let q = 0; q < 3; q++) { const k = fract(t * 0.3 + q / 3 + i * 0.4); blob(ctx, p.x + Math.sin(k * 4 + q) * 6 * u, p.y - p.s * 0.72 - k * p.s * 0.7, (4 + k * 10) * u, `rgba(240,248,255,${0.45 * (1 - k)})`); }
      });
    },
    front(ctx, G) {
      const { x0, x1, y, h, u, t } = G;
      for (let i = 0; i < 8; i++) { const on = fract(t * 0.8 + hash(i)) < 0.5; glow(ctx, ['rgba(80,255,170,1)', 'rgba(255,90,90,1)', 'rgba(90,200,255,1)'][i % 3], x0 + hash(i + 60) * (x1 - x0), y + hash(i + 70) * h, 7 * u, on ? 0.9 : 0.15); }
      G.spots('gearS').forEach((p, i) => { const k = fract(t * 0.9 + i * 0.5); if (k > 0.35) return; ctx.strokeStyle = 'rgba(160,230,255,0.95)'; ctx.lineWidth = 1.8 * u; boltPath(ctx, p.x + p.s * 0.5, p.y - p.s * 0.9, p.y - p.s * 0.2, Math.floor(t * 9) + i, 16 * u); ctx.stroke(); });
      const c = cross(t, 12, 6, 0.4, x0 + 30 * u, x1 - 30 * u, 1); // the brass owl patrols the lab
      if (c) { ctx.save(); ctx.translate(c.x, y + h * 0.3 + Math.sin(t * 2) * 8 * u); ctx.scale(-1, 1); drawOwlArt(ctx, 54 * u, t, { flap: t * 6, wing: 0, look: 0.6 }); ctx.restore(); }
    },
  },
];

// the band's ambience: layer 'back' (over the land, under the cast) or 'front' (over the cast, under the stops)
export function drawMapAmb(ctx, layer, w, G) {
  const A = AMB[w]; if (!A || !A[layer]) return;
  ctx.save();
  try { A[layer](ctx, G); } catch (e) { /* art must never break the frame */ }
  ctx.restore();
}
