// World 7, The Thieves' Vault, as one place (0.8.12, mykee on the 0.8.11 map: "these are not properly built ... too
// sluggish, and the creatures look sluggish as well. They're facing towards one direction"). Built the way the Farm
// and the Crystal Caves are (mapfarm.js, mapcave.js): a great underground vault hall seen from the same raised 3/4
// angle, in the level's own slate-blue stone (themes.js ART.vault), warm pools of torch light on the flagstones, gold
// everywhere, and a red carpet for the road up to the vault door.
// The five stops are five landmarks that ARE the tap targets: the Thieves' Gate, the Clockwork Keep, the Snake Pit,
// the Sky Bridge and the Great Vault Door, where the Rat King sits on his heap of coins; each with the Farm's plaque.
//
// What is painted where (the Farm's rules, binding: the map scrolls at 60 fps on a phone):
//   paintThievesBand  the back wall and its alcoves, the flagstones, the pillars and their torches' light, the treasure,
//                     the crates, the rope line along the carpet: painted ONCE (band cache)
//   landmark sprites  each landmark painted ONCE into its own canvas and stamped (a press squashes it like a button)
//   drawThievesLive   every frame, only what is on screen, pure functions of the clock: torch flames, the hoist, the
//                     weasel in his crates; dust in the light and glints on the gold (mapamb.js)
//   drawThievesFront  over the landmarks: the Rat King and his coin rats
// Reduced motion (calm): everything holds still.
import { planStops, drawLandmarkBody, drawFarmPlaque, signBox, lmArt } from './mapfarm.js';
import { drawThief, thiefPose } from './thieves.js';
import { RIG } from '../sim/thieves.js';
import { drawSnake } from './snake.js';
import { drawMapAmb } from './mapamb.js';
import { flame } from '../themes.js';
import { freeCanvas } from './cvfree.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const fract = (x) => x - Math.floor(x);
function rng(seed) { let s = (seed * 9301 + 49297) % 233280 || 1; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }
const WI = 6; // the world index

// ------------------------------------------------------------------ colour
const RGB = new Map();
function rgb(h) { let v = RGB.get(h); if (!v) { const n = parseInt(h.slice(1), 16); v = [n >> 16, (n >> 8) & 255, n & 255]; RGB.set(h, v); } return v; }
function mix(a, b, k) { const A = rgb(a), B = rgb(b); return `rgb(${Math.round(A[0] + (B[0] - A[0]) * k)},${Math.round(A[1] + (B[1] - A[1]) * k)},${Math.round(A[2] + (B[2] - A[2]) * k)})`; }
function rgba(h, al) { const A = rgb(h); return `rgba(${A[0]},${A[1]},${A[2]},${al})`; }
function lg(c, x0, y0, x1, y1, cols) { const g = c.createLinearGradient(x0, y0, x1, y1); cols.forEach((s, i) => g.addColorStop(i / (cols.length - 1), s)); return g; }
function rg(c, x, y, r0, r1, cols) { const g = c.createRadialGradient(x, y, r0, x, y, r1); cols.forEach((s, i) => g.addColorStop(i / (cols.length - 1), s)); return g; }

// the vault's palette: the level's slate-blue stone, warm torch light, gold, old wood, iron and brass
const P = {
  far: '#0e1a2a', back: '#16263a', floor: '#22364a', floorNear: '#2a4256', floorLo: '#122030', floorHi: '#46627c',
  stone: '#587489', stoneHi: '#7e9ab0', stoneTop: '#a8c0d2', stoneLo: '#2e465e', stoneInk: '#0a141e',
  gold: '#ffd75a', goldHi: '#fff3b0', goldMid: '#e0a52a', goldLo: '#9a6512', goldInk: '#5a3608',
  wood: '#9a6a3a', woodHi: '#c08a52', woodLo: '#6a4422', woodInk: '#2e1a0a',
  iron: '#3e4a58', ironHi: '#7a8ca0', ironLo: '#222a34', ironInk: '#0a0e14',
  brass: '#c8963e', brassHi: '#f0c870', brassLo: '#8a5e1c',
  red: '#b8303a', redHi: '#e0545a', redLo: '#6a1620',
  torch: '#ff9a3a', dark: '#060b14',
};

// ------------------------------------------------------------------ small painting kit (unit space)
function poly(c, pts) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); }
function fillPoly(c, pts, fill, ink, lw) { poly(c, pts); c.fillStyle = fill; c.fill(); if (ink) { c.strokeStyle = ink; c.lineWidth = lw || 1.2; c.lineJoin = 'round'; c.stroke(); } }
function ell(c, x, y, rx, ry, fill) { c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, TAU); c.fillStyle = fill; c.fill(); }
function softShadow(c, x, y, rx, ry, a = 0.45) { c.save(); c.translate(x, y); c.scale(1, ry / rx); c.fillStyle = rg(c, 0, 0, 0, rx, [`rgba(2,6,14,${a})`, `rgba(2,6,14,${a * 0.6})`, 'rgba(2,6,14,0)']); c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill(); c.restore(); }
function glowAt(c, x, y, r, col, a = 0.5) { c.fillStyle = rg(c, x, y, 0, r, [rgba(col, a), rgba(col, a * 0.35), rgba(col, 0)]); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
function flatGlow(c, x, y, rx, ry, col, a) { c.save(); c.translate(x, y); c.scale(1, ry / rx); glowAt(c, 0, 0, rx, col, a); c.restore(); }
function line(c, pts, col, lw) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.strokeStyle = col; c.lineWidth = lw; c.stroke(); }
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function star4(c, x, y, r) { c.beginPath(); c.moveTo(x, y - r * 1.8); c.quadraticCurveTo(x, y, x + r * 1.8, y); c.quadraticCurveTo(x, y, x, y + r * 1.8); c.quadraticCurveTo(x, y, x - r * 1.8, y); c.quadraticCurveTo(x, y, x, y - r * 1.8); c.fill(); }

// a heap of gold coins: a mound of gold, coins over it, a few standing on edge, glints
function heap(c, x, y, w, h, seed) {
  const R = rng(seed);
  softShadow(c, x + w * 0.15, y + 2, w * 1.1, h * 0.22 + 3, 0.5);
  c.beginPath(); c.moveTo(x - w, y); c.quadraticCurveTo(x - w * 0.55, y - h * 1.05, x, y - h); c.quadraticCurveTo(x + w * 0.55, y - h * 1.05, x + w, y); c.closePath();
  c.fillStyle = lg(c, x, y - h, x, y, [P.goldHi, P.gold, P.goldMid, P.goldLo]); c.fill(); c.strokeStyle = P.goldInk; c.lineWidth = 1; c.stroke();
  c.save(); c.clip();
  const n = Math.round(w * h * 0.09);
  for (let i = 0; i < n; i++) { const px = x + (R() * 2 - 1) * w, py = y - R() * h * 1.05; ell(c, px, py + 0.6, 3.2, 1.5, P.goldLo); ell(c, px, py, 3.2, 1.4, R() < 0.5 ? P.gold : P.goldMid); ell(c, px - 0.6, py - 0.4, 1.6, 0.5, 'rgba(255,250,220,0.8)'); }
  c.fillStyle = lg(c, x - w, 0, x + w, 0, ['rgba(255,250,220,0.25)', 'rgba(255,250,220,0)', 'rgba(60,30,0,0)', 'rgba(60,30,0,0.3)']); c.fillRect(x - w, y - h * 1.1, w * 2, h * 1.1);
  c.restore();
  for (let i = 0; i < 3; i++) { const px = x + (R() - 0.5) * w * 1.2, py = y - h * (0.2 + R() * 0.5); c.save(); c.translate(px, py); c.rotate((R() - 0.5) * 0.6); ell(c, 0, 0, 1.6, 3.6, P.goldLo); ell(c, -0.4, 0, 1.2, 3.4, P.gold); c.restore(); } // coins on edge
  for (let i = 0; i < 5; i++) { const px = x + (R() * 2 - 1) * w * 1.25, py = y + R() * 3; ell(c, px, py + 0.5, 3, 1.3, P.goldLo); ell(c, px, py, 3, 1.2, P.gold); } // strays on the floor
}
// an open treasure chest, lit from the top left (after themes.js chest())
function chest(c, x, y, s) {
  c.save(); c.translate(x, y);
  softShadow(c, s * 0.2, 1, s * 1.3, s * 0.3, 0.5);
  fillPoly(c, [-s, -s * 0.95, s, -s * 0.95, s * 1.12, -s * 1.75, -s * 0.88, -s * 1.75], '#3a2412'); fillPoly(c, [-s * 0.86, -s * 1.02, s * 0.86, -s * 1.02, s * 0.98, -s * 1.66, -s * 0.76, -s * 1.66], '#5a3a1c');
  c.beginPath(); c.ellipse(0, -s * 0.95, s * 0.92, s * 0.42, 0, Math.PI, 0); c.fillStyle = lg(c, 0, -s * 1.4, 0, -s * 0.9, ['#ffe58a', '#d99a22']); c.fill();
  for (let i = 0; i < 7; i++) { const a = Math.PI + (i + 0.5) / 7 * Math.PI; ell(c, Math.cos(a) * s * 0.7, -s * 0.98 + Math.sin(a) * s * 0.26, s * 0.2, s * 0.08, i % 2 ? '#fff1b0' : '#c9861a'); }
  rr(c, -s, -s * 0.95, s * 2, s * 0.95, s * 0.1); c.fillStyle = lg(c, -s, -s, s, 0, ['#9a6a34', '#7a4e24', '#3e2410']); c.fill(); c.strokeStyle = P.woodInk; c.lineWidth = Math.max(0.8, s * 0.06); c.stroke();
  for (const bx of [-0.78, 0.6]) { c.fillStyle = '#d9a12c'; c.fillRect(bx * s, -s * 0.95, s * 0.18, s * 0.95); }
  c.fillStyle = '#e8b63a'; c.fillRect(-s, -s * 0.95, s * 2, s * 0.14); c.fillStyle = '#fff0b0'; c.fillRect(-s, -s * 0.95, s * 2, s * 0.045);
  rr(c, -s * 0.16, -s * 0.74, s * 0.32, s * 0.36, s * 0.05); c.fillStyle = '#ffd75a'; c.fill(); ell(c, 0, -s * 0.58, s * 0.06, s * 0.06, '#3a2412');
  c.restore();
}
// a crate in the 3/4 view: front face with a cross brace, a lit top, a shaded side
function crate(c, x, y, w, h) {
  fillPoly(c, [x, y, x + w, y, x + w, y - h, x, y - h], lg(c, x, y - h, x + w, y, [P.woodHi, P.wood, P.woodLo]), P.woodInk, 1);
  fillPoly(c, [x + w, y, x + w + 6, y - 5, x + w + 6, y - h - 5, x + w, y - h], P.woodLo, P.woodInk, 0.8);
  fillPoly(c, [x, y - h, x + w, y - h, x + w + 6, y - h - 5, x + 6, y - h - 5], P.woodHi, P.woodInk, 0.8);
  c.strokeStyle = P.woodInk; c.lineWidth = 0.9; c.strokeRect(x + 2, y - h + 2, w - 4, h - 4);
  c.beginPath(); c.moveTo(x + 2, y - 2); c.lineTo(x + w - 2, y - h + 2); c.stroke();
}
// gold bars stacked in a little pyramid
function bars(c, x, y, n) {
  softShadow(c, x + 4, y + 1, 22, 4, 0.45);
  const bar = (bx, by) => { fillPoly(c, [bx - 8, by, bx + 8, by, bx + 6, by - 5, bx - 6, by - 5], lg(c, 0, by - 5, 0, by, [P.goldHi, P.goldMid]), P.goldInk, 0.7); fillPoly(c, [bx - 6, by - 5, bx + 6, by - 5, bx + 7.5, by - 7, bx - 4.5, by - 7], P.goldHi, P.goldInk, 0.6); };
  let row = 0, k = n;
  while (k > 0) { const m = Math.min(k, 3 - row); for (let i = 0; i < m; i++) bar(x + (i - (m - 1) / 2) * 16 + row * 1.5, y - row * 6); k -= m; row++; if (row > 2) break; }
}
// a burlap sack of loot, tied at the neck, a coin spilling
function sack(c, x, y, s) {
  softShadow(c, x + 3, y + 1, 12 * s, 3 * s, 0.45);
  c.beginPath(); c.moveTo(x - 10 * s, y); c.quadraticCurveTo(x - 13 * s, y - 14 * s, x - 3 * s, y - 18 * s); c.lineTo(x + 3 * s, y - 18 * s); c.quadraticCurveTo(x + 13 * s, y - 14 * s, x + 10 * s, y); c.closePath();
  c.fillStyle = lg(c, x - 10 * s, y - 18 * s, x + 10 * s, y, ['#d8bc8a', '#b8955e', '#7a5a32']); c.fill(); c.strokeStyle = '#4a3418'; c.lineWidth = 1; c.stroke();
  fillPoly(c, [x - 4 * s, y - 18 * s, x + 4 * s, y - 18 * s, x + 6 * s, y - 24 * s, x - 6 * s, y - 24 * s], '#c8a870', '#4a3418', 0.8);
  line(c, [x - 4 * s, y - 18.5 * s, x + 4 * s, y - 18.5 * s], '#7a2a1a', 1.6);
  ell(c, x + 9 * s, y + 1, 3, 1.3, P.gold);
}

// ------------------------------------------------------------------ the plan
// Landmarks (bottom to top): extents in design units; pref = the side of the road (see mapfarm.js LMS)
const LMS = [
  { kind: 'gate', name: 'Thieves’ Gate', pref: -1, x0: -70, x1: 70, top: 146, gap: 6, dy: 2, rows: 1, tap: [-66, -140, 66, 6] },
  { kind: 'clock', name: 'Clockwork Keep', pref: -1, x0: -60, x1: 62, top: 168, gap: 6, dy: 4, rows: 1, tap: [-56, -160, 58, 6] },
  { kind: 'pit', name: 'Snake Pit', pref: 1, x0: -80, x1: 80, top: 84, gap: 4, dy: 8, rows: 1, tap: [-76, -76, 76, 6] },
  { kind: 'bridge', name: 'Sky Bridge', pref: 1, x0: -84, x1: 84, top: 104, gap: 4, dy: 6, rows: 1, tap: [-80, -96, 80, 6] },
  { kind: 'door', name: 'The Rat King', pref: -1, x0: -76, x1: 80, top: 186, gap: 6, dy: 0, beside: 1, rows: 1, tap: [-72, -170, 76, 6], tries: [[1, 0], [1, 24], [1, 40], [1, 56], [0.92, 56], [0.85, 44]] } // the door stands low, beside its plaque, clear of the next world's sign,
];
export const VAULT_LANDMARKS = LMS;

// props: kind, fx, fy, size, [half width, height] (units); nudged off the road and the landmarks, or left out
const PROPS = [
  ['crates', 0.88, 0.6, 1, [44, 50]], // the weasel's crates
  ['hoist', 0.1, 0.46, 1, [28, 120]], // a rope hoist with a crate going up and down
  ['heap', 0.9, 0.86, 1, [40, 30]],
  ['chest', 0.1, 0.9, 1, [26, 30]],
  ['bars', 0.88, 0.32, 1, [26, 18]],
  ['heap2', 0.12, 0.2, 0.8, [34, 26]],
  ['sacks', 0.6, 0.06, 1, [26, 26]],
  ['crates2', 0.92, 0.12, 0.8, [32, 40]],
];
const roadHit = (L, x0, x1, y0, y1, m = 4) => { for (let y = y0; y <= y1 + 0.1; y += 6) { const x = L.pathX(y); if (x + L.roadW * 0.5 + m * L.u > x0 && x - L.roadW * 0.5 - m * L.u < x1) return true; } return false; };
const hitAny = (boxes, b) => boxes.some((q) => b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0);

export function thievesPlan(L) {
  if (L._vault) return L._vault;
  const plan = planStops(L, WI, LMS), u = L.u, A = L.A, top = plan.top, BH = L.BH, st = (k) => L.stops[WI * 5 + k];
  plan.props = []; plan.pillars = []; plan.torches = []; plan.ropes = [];
  if (plan.lms.length < 5) return (L._vault = plan);
  const boxes = plan.lms.map((m) => lmArt(m)).concat(plan.lms.map((m) => { const b = m.plaque.board; return { x0: b.x - 4 * u, x1: b.x + b.w + 4 * u, y0: b.y, y1: m.plaque.y + 6 * u }; }));
  const sign = signBox(L, WI), sign2 = signBox(L, WI + 1);
  // the boss's treasure chest stands beside the boss stop (main.js): keep it clear
  { const sb = st(4), r = L.stopR * 1.2, cr = Math.min(r * 0.95, 34 * u); let side = sb.x < A.cx ? -1 : 1, cx = sb.x + side * (r + cr * 1.25); if (cx - cr < A.x + 4 * u || cx + cr > A.x1 - 4 * u) cx = sb.x - side * (r + cr * 1.25); const cy = sb.y - r * 0.15; boxes.push({ x0: cx - cr * 1.1, x1: cx + cr * 1.1, y0: cy - cr * 1.2, y1: cy + cr * 1.2 }); }
  // pillars up both edges of the hall, every few steps; a torch on every other one (its flame is live)
  const R = rng(17);
  for (const side of [-1, 1]) {
    let n = 0;
    for (let y = top + 150 * u; y < top + BH * 0.98; y += (96 + R() * 20) * u) {
      const x = side < 0 ? A.x + 6 * u : A.x1 - 6 * u, w = 11 * u * (0.85 + 0.25 * (y - top) / BH), h = 96 * u * (0.85 + 0.2 * (y - top) / BH);
      const b = { x0: x - w * 1.5, x1: x + w * 1.5, y0: y - h, y1: y + 4 * u };
      if (hitAny(boxes, b) || roadHit(L, b.x0, b.x1, b.y0, b.y1)) continue;
      plan.pillars.push({ x, y, w, h, side });
      if (n++ % 2 === 0) plan.torches.push({ x: x - side * w * 1.15, y: y - h * 0.62, s: u * (0.85 + 0.2 * (y - top) / BH) });
      boxes.push(b);
    }
  }
  // the props
  for (const [k, fx, fy, sz, [hw0, h0]] of PROPS) {
    const hw = hw0 * u * sz, h = h0 * u * sz;
    let got = null;
    for (let r = 0; r <= 8 && !got; r++) {
      for (const [dx, dy] of r ? [[r, 0], [-r, 0], [0, -r], [0, r], [r, -r], [-r, -r], [r, r], [-r, r]] : [[0, 0]]) {
        const x = A.x + fx * A.w + dx * 10 * u, y = top + fy * BH + dy * 8 * u;
        const b = { x0: x - hw, x1: x + hw, y0: y - h, y1: y + 4 * u };
        if (b.x0 < A.x - hw * 0.5 || b.x1 > A.x1 + hw * 0.5) continue;
        if (b.y0 < top + (k === 'hoist' ? 20 : 60) * u || b.y1 > top + BH * 0.97) continue;
        if (roadHit(L, b.x0, b.x1, b.y0, b.y1)) continue;
        if (hitAny(boxes, b) || hitAny([sign, sign2], b)) continue;
        got = { k, x, y, s: sz, box: b, dir: x < L.pathX(y) ? 1 : -1 }; break;
      }
    }
    if (got) { plan.props.push(got); boxes.push(got.box); }
  }
  // the rope line: brass posts and red ropes along both edges of the carpet, from the Snake Pit up to the vault door
  for (const side of [-1, 1]) {
    const posts = [];
    for (let y = st(2).y - 30 * u; y > st(4).y + 16 * u; y -= 30 * u) {
      const x = L.pathX(y) + side * (L.roadW * 0.5 + 9 * u), b = { x0: x - 5 * u, x1: x + 5 * u, y0: y - 24 * u, y1: y + 3 * u };
      if (hitAny(boxes, b)) { if (posts.length > 1) plan.ropes.push(posts.slice()); posts.length = 0; continue; }
      posts.push({ x, y });
    }
    if (posts.length > 1) plan.ropes.push(posts);
  }
  return (L._vault = plan);
}
function spot(plan, k) { for (const p of plan.props) if (p.k === k) return p; return null; }
export function thievesStop(L, i) { const p = thievesPlan(L); return p.lms[i] || null; }

// ------------------------------------------------------------------ the band, painted once
export function paintThievesBand(c, L, E) {
  const u = L.u, W = L.W, BH = L.BH, top = L.bandTop(WI), plan = thievesPlan(L), A = L.A;
  const R0 = rng(WI * 31 + 5), ph = R0() * TAU, ph2 = R0() * TAU;
  const crest = (x) => E * 0.5 + Math.sin((x / W) * TAU * 1.3 + ph) * E * 0.28 + Math.sin((x / W) * TAU * 3.1 + ph2) * E * 0.12;
  c.save();
  c.beginPath(); c.moveTo(0, BH + E); for (let x = 0; x <= W + 8; x += 8) c.lineTo(x, crest(x)); c.lineTo(W, BH + E); c.closePath();
  c.fillStyle = lg(c, 0, E * 0.2, 0, BH + E, [P.far, P.back, P.floor, P.floorNear]); c.fill();
  c.save(); c.clip();
  c.translate(0, E - top); // map coordinates from here on
  const Y = (f) => top + f * BH;
  try {
    backWall(c, L, plan, top, u, E);
    flagstones(c, L, plan, top, u);
    // light: the torches' warm pools on the floor, a cold sheen from the upper left
    for (const T of plan.torches) flatGlow(c, T.x, T.y + 62 * T.s, 90 * T.s, 34 * T.s, P.torch, 0.3);
    for (const m of plan.lms) if (m.kind === 'gate' || m.kind === 'door') flatGlow(c, m.x, m.y, 100 * m.d, 30 * m.d, P.torch, 0.25);
    c.fillStyle = rg(c, A.x + A.w * 0.1, Y(0.1), 0, Math.max(A.w, BH) * 0.8, ['rgba(160,200,240,0.1)', 'rgba(160,200,240,0)']); c.fillRect(0, top - E, W, BH + E);
    for (const m of plan.lms) groundFor(c, m);
    for (const p of plan.pillars) pillar(c, p, u);
    const list = plan.props.slice().sort((a, b) => a.y - b.y);
    for (const p of list) { try { prop(c, p, u); } catch (_) { /* a prop never breaks the map */ } }
    for (const posts of plan.ropes) ropeLine(c, posts, u);
  } catch (_) { /* the band never breaks the map */ }
  c.restore();
  c.beginPath(); for (let x = 0; x <= W + 8; x += 8) { const y = crest(x); if (x === 0) c.moveTo(x, y); else c.lineTo(x, y); }
  c.strokeStyle = 'rgba(170,210,240,0.3)'; c.lineWidth = 2.2 * u; c.stroke();
  c.restore();
}
// the far wall: big dressed blocks, a row of barred alcoves between square piers, banners with the golden-egg crest
function backWall(c, L, plan, top, u, E) {
  const W = L.W, H = 124 * u, y1 = top + H, R = rng(5);
  c.fillStyle = lg(c, 0, top - E, 0, y1, ['#0c1624', '#1a2c40', '#24384c']); c.fillRect(0, top - E, W, H + E);
  const bw = 30 * u, bh = 13 * u;
  for (let y = top - E, r = 0; y < y1; y += bh, r++) for (let x = (r % 2) * bw / 2 - bw; x < W; x += bw) { const k = (R() - 0.5) * 0.12; rr(c, x + 0.5 * u, y + 0.5 * u, bw - 1 * u, bh - 1 * u, 1.4 * u); c.fillStyle = k > 0 ? `rgba(160,200,230,${k + 0.03})` : `rgba(0,0,0,${-k + 0.05})`; c.fill(); c.fillStyle = 'rgba(170,210,240,0.08)'; c.fillRect(x + 1.5 * u, y + 0.6 * u, bw - 3 * u, 0.7 * u); }
  // the alcoves: an arch of darkness behind iron bars, a cold glint far inside
  const bay = 74 * u, n = Math.ceil(W / bay) + 1;
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) * bay - bay * 0.25, aw = 17 * u, at = top + 10 * u, ab = y1 - 6 * u;
    if (i % 2 === 0) {
      const arch = () => { c.beginPath(); c.moveTo(x - aw, ab); c.lineTo(x - aw, at + aw); c.arc(x, at + aw, aw, Math.PI, 0); c.lineTo(x + aw, ab); c.closePath(); };
      arch(); c.fillStyle = lg(c, 0, at, 0, ab, ['#03070c', '#0c1a28']); c.fill();
      c.save(); arch(); c.clip(); glowAt(c, x, lerp(at, ab, 0.7), 26 * u, '#2fb0c0', 0.22);
      for (let bx = x - aw + 3.4 * u; bx < x + aw; bx += 5.6 * u) { c.fillStyle = '#16232f'; c.fillRect(bx, at, 1.8 * u, ab - at); c.fillStyle = '#3d566e'; c.fillRect(bx, at, 0.6 * u, ab - at); }
      for (const ky of [0.34, 0.66]) { c.fillStyle = '#1c2c3c'; c.fillRect(x - aw, lerp(at, ab, ky), aw * 2, 2 * u); }
      c.restore();
      arch(); c.lineWidth = 3.4 * u; c.strokeStyle = '#2b425a'; c.stroke(); c.lineWidth = 1 * u; c.strokeStyle = 'rgba(170,210,240,0.3)'; c.stroke();
    } else banner(c, x, at + 6 * u, 15 * u, 46 * u, u);
    // the pier between bays
    const px = x + bay / 2, pw = 8 * u;
    c.fillStyle = lg(c, px - pw, 0, px + pw, 0, ['#4a6680', '#2c445c', '#0e1824']); c.fillRect(px - pw, top - E, pw * 2, H + E);
    c.fillStyle = 'rgba(180,215,240,0.15)'; c.fillRect(px - pw, y1 - 10 * u, pw * 2, 2 * u);
  }
  // the foot of the wall: a skirting course and its shadow on the floor
  c.fillStyle = lg(c, 0, y1 - 8 * u, 0, y1, ['#46627c', '#2a4054']); c.fillRect(0, y1 - 8 * u, W, 8 * u);
  c.fillStyle = 'rgba(200,230,250,0.25)'; c.fillRect(0, y1 - 8 * u, W, 1 * u);
  c.fillStyle = lg(c, 0, y1, 0, y1 + 16 * u, ['rgba(2,6,14,0.5)', 'rgba(2,6,14,0)']); c.fillRect(0, y1, W, 16 * u);
}
function banner(c, x, y, w, h, u) {
  line(c, [x - w * 0.7, y, x + w * 0.7, y], P.brass, 1.6 * u);
  fillPoly(c, [x - w / 2, y, x + w / 2, y, x + w / 2, y + h, x, y + h - w * 0.4, x - w / 2, y + h], '#d8601a', '#5a2208', 0.8 * u);
  fillPoly(c, [x - w / 2, y, x - w * 0.25, y, x - w * 0.25, y + h - w * 0.28, x - w / 2, y + h], '#f08a34');
  c.fillStyle = '#ffd27a'; c.fillRect(x - w / 2, y + 2 * u, w, 1.2 * u);
  crestEgg(c, x, y + h * 0.44, Math.min(w * 0.8, h * 0.5));
}
function crestEgg(c, x, y, s) { // the vault's crest: a golden egg with a keyhole (themes.js crestEgg)
  const h = s * 0.9, w = h * 0.74;
  c.save(); c.translate(x, y); c.beginPath();
  for (let i = 0; i <= 24; i++) { const a = (i / 24) * TAU, sn = Math.sin(a); c.lineTo((w / 2) * Math.cos(a) * (1 + 0.13 * sn), (h / 2) * sn); }
  c.closePath(); c.fillStyle = '#ffd75a'; c.fill(); c.lineWidth = Math.max(0.8, s * 0.07); c.strokeStyle = '#5a2e0e'; c.stroke();
  ell(c, w * 0.14, h * 0.12, w * 0.26, h * 0.26, '#d9a12c');
  ell(c, 0, -h * 0.06, w * 0.14, w * 0.14, '#3a1a08'); fillPoly(c, [-w * 0.07, -h * 0.02, w * 0.07, -h * 0.02, w * 0.1, h * 0.24, -w * 0.1, h * 0.24], '#3a1a08');
  c.restore();
}
// the floor: rows of big flagstones, nearer rows taller, each slab lit on its top edge, worn and cracked
function flagstones(c, L, plan, top, u) {
  const W = L.W, BH = L.BH, R = rng(31);
  let y = top + 124 * u;
  while (y < top + BH + 10 * u) {
    const near = (y - top) / BH, rh = (16 + 16 * near) * u, sw = (40 + 30 * near) * u;
    let x = -R() * sw;
    while (x < W) {
      const w = sw * (0.75 + R() * 0.5), tone = (R() - 0.5) * 0.18;
      rr(c, x + 0.8 * u, y + 0.8 * u, w - 1.6 * u, rh - 1.6 * u, 2 * u);
      c.fillStyle = lg(c, 0, y, 0, y + rh, [mix(P.floorHi, P.floor, 0.35 - tone), mix(P.floor, P.floorNear, near), mix(P.floorLo, P.floor, 0.4)]); c.fill();
      c.fillStyle = `rgba(170,210,240,${0.1 + tone * 0.3})`; c.fillRect(x + 2 * u, y + 1.2 * u, w - 4 * u, 1 * u);
      if (R() < 0.2) { c.strokeStyle = 'rgba(4,10,18,0.5)'; c.lineWidth = 0.9 * u; let px = x + w * (0.2 + R() * 0.6), py = y + 2 * u; c.beginPath(); c.moveTo(px, py); for (let q = 0; q < 3; q++) { px += (R() - 0.5) * 10 * u; py += rh * 0.3; c.lineTo(px, py); } c.stroke(); }
      if (R() < 0.06) { ell(c, x + w * 0.5, y + rh * 0.5, 2.6 * u, 1.2 * u, P.goldLo); ell(c, x + w * 0.5, y + rh * 0.45, 2.6 * u, 1.1 * u, P.gold); } // a dropped coin
      x += w;
    }
    c.fillStyle = 'rgba(2,6,14,0.35)'; c.fillRect(0, y + rh - 1 * u, W, 1.4 * u);
    y += rh;
  }
}
function groundFor(c, m) {
  const d = m.d, x = m.x, y = m.y, f = m.flip ? -1 : 1, S = m.S;
  const cx = x + ((S.x0 + S.x1) / 2) * d * f, rx = (S.x1 - S.x0) * d * 0.5;
  softShadow(c, cx + 10 * d, y + 2 * d, rx * 1.05, 14 * d, 0.55);
  if (m.kind === 'door') flatGlow(c, cx, y, rx * 1.2, rx * 0.3, P.gold, 0.3);
}
// a round pillar on a square base with a capital, lit on its left (the level's pillars), a torch bracket on some
function pillar(c, p, u) {
  const { x, y, w, h } = p;
  softShadow(c, x + 8 * u, y + 2 * u, w * 2.2, 5 * u, 0.5);
  const base = (yy, k) => { fillPoly(c, [x - w * k, yy, x + w * k, yy, x + w * k, yy - 7 * u, x - w * k, yy - 7 * u], lg(c, x - w * k, 0, x + w * k, 0, ['#6a88a2', '#3a5670', '#16222e']), P.stoneInk, 0.9 * u); c.fillStyle = 'rgba(200,230,250,0.3)'; c.fillRect(x - w * k, yy - 7 * u, w * 2 * k, 1 * u); };
  base(y, 1.4);
  c.fillStyle = lg(c, x - w, 0, x + w, 0, ['#5a7a94', '#3a5670', '#1e3044', '#0e1824']); c.fillRect(x - w, y - h, w * 2, h - 6 * u);
  c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 0.8 * u; for (const f of [-0.5, 0, 0.5]) { c.beginPath(); c.moveTo(x + f * w, y - h); c.lineTo(x + f * w, y - 7 * u); c.stroke(); } // flutes
  c.fillStyle = 'rgba(200,230,250,0.18)'; c.fillRect(x - w * 0.8, y - h, w * 0.25, h - 7 * u);
  base(y - h + 7 * u, 1.35); fillPoly(c, [x - w * 1.6, y - h, x + w * 1.6, y - h, x + w * 1.6, y - h - 6 * u, x - w * 1.6, y - h - 6 * u], lg(c, 0, y - h - 6 * u, 0, y - h, ['#8aa8c0', '#4a6680']), P.stoneInk, 0.9 * u);
}
function torchBracket(c, x, y, s) { // the iron bracket and the torch's head (the flame is live)
  fillPoly(c, [x - 2 * s, y - 1 * s, x + 2 * s, y - 1 * s, x + 0.8 * s, y + 9 * s, x - 0.8 * s, y + 9 * s], '#3a2412', '#120a04', 0.6 * s);
  c.fillStyle = P.brass; c.fillRect(x - 2.6 * s, y - 2.4 * s, 5.2 * s, 1.6 * s);
  c.fillStyle = P.ironLo; c.fillRect(x - 0.6 * s, y + 9 * s, 1.2 * s, 5 * s);
  ell(c, x, y - 1.6 * s, 2.4 * s, 1 * s, '#ff8a2a');
}
function ropeLine(c, posts, u) { // brass posts with red velvet ropes hanging between them
  for (let i = 0; i < posts.length - 1; i++) { const a = posts[i], b = posts[i + 1], my = Math.max(a.y, b.y) - 13 * u; c.lineCap = 'round'; c.beginPath(); c.moveTo(a.x, a.y - 18 * u); c.quadraticCurveTo((a.x + b.x) / 2, my + 2 * u, b.x, b.y - 18 * u); c.strokeStyle = P.redLo; c.lineWidth = 3 * u; c.stroke(); c.strokeStyle = P.red; c.lineWidth = 2 * u; c.stroke(); c.strokeStyle = 'rgba(255,170,170,0.5)'; c.lineWidth = 0.7 * u; c.stroke(); }
  for (const p of posts) { ell(c, p.x + 1.5 * u, p.y + 0.5 * u, 5 * u, 1.6 * u, 'rgba(2,6,14,0.5)'); ell(c, p.x, p.y, 4 * u, 1.6 * u, P.brassLo); fillPoly(c, [p.x - 1.3 * u, p.y, p.x + 1.3 * u, p.y, p.x + 1.3 * u, p.y - 19 * u, p.x - 1.3 * u, p.y - 19 * u], lg(c, p.x - 1.3 * u, 0, p.x + 1.3 * u, 0, [P.brassHi, P.brass, P.brassLo]), P.goldInk, 0.6 * u); ell(c, p.x, p.y - 20 * u, 2.4 * u, 2.4 * u, P.brassHi); ell(c, p.x - 0.7 * u, p.y - 20.7 * u, 0.8 * u, 0.8 * u, '#fffbe0'); }
}

// ------------------------------------------------------------------ props (painted into the band)
function prop(c, p, u) {
  const s = p.s * u;
  c.save(); c.translate(p.x, p.y); c.scale(s, s);
  switch (p.k) {
    case 'crates': softShadow(c, 6, 1, 44, 7, 0.5); crate(c, -40, 0, 26, 24); crate(c, 8, 2, 28, 28); crate(c, -30, -24, 24, 22); sack(c, -8, 4, 0.8); break; // the weasel's box is the right one (its lid is live)
    case 'crates2': softShadow(c, 4, 1, 30, 6, 0.5); crate(c, -22, 0, 22, 20); crate(c, 2, 0, 20, 18); crate(c, -14, -20, 20, 18); break;
    case 'hoist': hoist(c); break;
    case 'heap': heap(c, 0, 0, 36, 24, 3); chest(c, 26, 4, 9); break;
    case 'heap2': heap(c, 0, 0, 30, 20, 5); bars(c, -20, 6, 3); break;
    case 'chest': chest(c, 0, 0, 13); heap(c, 18, 4, 12, 7, 9); break;
    case 'bars': bars(c, 0, 0, 6); break;
    case 'sacks': sack(c, -10, 0, 1); sack(c, 10, 2, 0.85); heap(c, 0, 6, 10, 5, 12); break;
    default: break;
  }
  c.restore();
}
export const HOIST_TOP = [0, -116], HOIST_ROPE = [12, -110];
function hoist(c) { // a timber gantry: two legs, a beam, a pulley wheel; the rope and its crate move (live)
  softShadow(c, 4, 1, 30, 6, 0.5);
  for (const [x0, x1] of [[-20, -6], [20, 6]]) fillPoly(c, [x0 - 2.5, 0, x0 + 2.5, 0, x1 + 2, -112, x1 - 2, -112], lg(c, x0 - 2, 0, x0 + 2, 0, [P.woodHi, P.woodLo]), P.woodInk, 0.8);
  fillPoly(c, [-12, -108, 22, -108, 22, -116, -12, -116], lg(c, 0, -116, 0, -108, [P.woodHi, P.wood]), P.woodInk, 0.8);
  line(c, [-17, -50, 17, -50], P.woodLo, 2.4);
  ell(c, 12, -110, 5, 5, P.iron); ell(c, 12, -110, 2, 2, P.brassHi);
  // the rope's other end: coiled on a cleat on the left leg
  line(c, [7, -110, -16, -60], '#c8a060', 1);
  ell(c, -16, -58, 3, 1.4, P.brass);
  heap(c, -4, 2, 8, 4, 21);
}

// ------------------------------------------------------------------ landmark sprites (design units, foot at 0,0)
// The Thieves' Gate: a stone arch, the portcullis drawn up into it, darkness beyond, a torch on each jamb (live)
export const GATE_TORCHES = [[-46, -86], [46, -86]];
function paintGate(c) {
  flatGlow(c, 0, -2, 80, 20, P.torch, 0.35);
  const arch = (k = 1) => { c.beginPath(); c.moveTo(-28 * k, 0); c.lineTo(-28 * k, -74); c.arc(0, -74, 28 * k, Math.PI, 0); c.lineTo(28 * k, 0); c.closePath(); };
  // the wall block: dressed stone, the arch cut through it
  const wall = [-66, 2, -66, -112, -54, -128, 54, -128, 66, -112, 66, 2];
  fillPoly(c, wall, lg(c, -66, -128, 66, 0, [P.stoneHi, P.stone, P.stoneLo]), P.stoneInk, 1.3);
  c.save(); poly(c, wall); c.clip();
  for (let r = 0; r < 9; r++) { const y = -r * 14; line(c, [-70, y, 70, y], 'rgba(4,10,18,0.5)', 1); for (let k = -5; k <= 5; k++) { const x = k * 14 + (r % 2) * 7; line(c, [x, y, x, y - 14], 'rgba(4,10,18,0.45)', 1); } c.fillStyle = 'rgba(200,230,250,0.08)'; c.fillRect(-70, y - 13, 140, 1.2); }
  c.restore();
  fillPoly(c, [-66, -112, -54, -128, 54, -128, 66, -112], lg(c, 0, -128, 0, -112, [P.stoneTop, P.stoneHi]), P.stoneInk, 1);
  // the passage: dark, a far glow of gold deep inside
  arch(); c.fillStyle = lg(c, 0, -102, 0, 0, ['#02050a', '#0a1420', '#16263a']); c.fill();
  c.save(); arch(); c.clip(); flatGlow(c, 0, -10, 22, 10, P.gold, 0.35);
  // the portcullis, drawn up: its spiked foot hangs a little way into the arch
  for (let x = -24; x <= 24; x += 8) { fillPoly(c, [x - 1.6, -102, x + 1.6, -102, x + 1.6, -76, x, -70, x - 1.6, -76], lg(c, x - 1.6, 0, x + 1.6, 0, [P.ironHi, P.iron, P.ironLo]), P.ironInk, 0.6); }
  for (const y of [-96, -84]) fillPoly(c, [-28, y, 28, y, 28, y + 2.6, -28, y + 2.6], P.iron, P.ironInk, 0.5);
  c.restore();
  // the voussoirs and the keystone with the crest
  for (let k = 0; k <= 8; k++) { const a = Math.PI + (k / 8) * Math.PI, x0 = Math.cos(a) * 28, y0 = -74 + Math.sin(a) * 28, x1 = Math.cos(a) * 38, y1 = -74 + Math.sin(a) * 38; line(c, [x0, y0, x1, y1], P.stoneInk, 1); }
  c.strokeStyle = P.stoneTop; c.lineWidth = 1.6; c.beginPath(); c.arc(0, -74, 29, Math.PI, Math.PI * 1.5); c.stroke();
  fillPoly(c, [-8, -100, 8, -100, 10, -118, -10, -118], lg(c, -10, -118, 10, -100, [P.stoneTop, P.stoneHi]), P.stoneInk, 1);
  crestEgg(c, 0, -109, 13);
  // the torches on the jambs (the flames are live)
  for (const [x, y] of GATE_TORCHES) torchBracket(c, x, y, 1.6);
  // a coin dropped on the threshold, a crate left by the wall
  ell(c, 12, 2, 3, 1.3, P.gold);
  crate(c, -64, 4, 14, 13);
}
// The Clockwork Keep: a stone tower with a great clock (its hands and gears turn live), a pendulum in a slot below
export const CLOCK = { x: -6, y: -116, r: 26 };
export const KEEP_GEARS = [[34, -80, 16, 10], [44, -54, 10, 7], [28, -40, 8, 6]];
export const PENDULUM = { x: -6, y: -82, len: 46 };
function paintClock(c) {
  flatGlow(c, 0, -4, 70, 18, P.brass, 0.2);
  const tw = [-40, 2, -40, -138, -34, -150, 22, -150, 28, -138, 28, 2];
  fillPoly(c, tw, lg(c, -40, -150, 28, 0, [P.stoneHi, P.stone, P.stoneLo]), P.stoneInk, 1.3);
  c.save(); poly(c, tw); c.clip();
  for (let r = 0; r < 11; r++) { const y = -r * 14; line(c, [-44, y, 32, y], 'rgba(4,10,18,0.5)', 1); for (let k = -3; k <= 3; k++) { const x = k * 14 + (r % 2) * 7; line(c, [x, y, x, y - 14], 'rgba(4,10,18,0.4)', 1); } }
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(14, -152, 20, 160);
  c.restore();
  // the roof: a pointed slate cap with a brass finial
  fillPoly(c, [-44, -146, 32, -146, -6, -168], lg(c, -44, -168, 32, -146, ['#5a7088', '#2c3c50']), P.stoneInk, 1.2);
  line(c, [-6, -168, -6, -176], P.brass, 1.6); ell(c, -6, -177, 2.4, 2.4, P.brassHi);
  // the clock: a brass bezel, a cream dial, hour marks (the hands are live)
  const { x, y, r } = CLOCK;
  ell(c, x + 1.5, y + 2, r + 4, r + 4, 'rgba(2,6,14,0.5)');
  ell(c, x, y, r + 4, r + 4, P.brassLo); ell(c, x - 0.6, y - 0.6, r + 3, r + 3, P.brass);
  c.beginPath(); c.arc(x, y, r + 3, Math.PI * 0.9, Math.PI * 1.6); c.strokeStyle = P.brassHi; c.lineWidth = 1.6; c.stroke();
  ell(c, x, y, r, r, '#f4ead0'); c.beginPath(); c.arc(x, y, r, 0, TAU); c.strokeStyle = '#8a6a3a'; c.lineWidth = 1; c.stroke();
  for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU, r0 = r * (k % 3 ? 0.84 : 0.76); line(c, [x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.92], '#3a2a1a', k % 3 ? 1 : 2); }
  // the pendulum's slot (the bob swings live)
  const pd = PENDULUM;
  rr(c, pd.x - 12, pd.y - 2, 24, pd.len + 12, 4); c.fillStyle = '#060c14'; c.fill(); c.strokeStyle = P.stoneInk; c.lineWidth = 1; c.stroke();
  // the gear housing on the right: a dark open frame (the gears turn live in front of it)
  fillPoly(c, [18, -100, 60, -100, 60, -28, 18, -28], '#0c1622', P.stoneInk, 1);
  for (const yy of [-100, -28]) fillPoly(c, [16, yy - 2, 62, yy - 2, 62, yy + 2, 16, yy + 2], P.brass, P.goldInk, 0.6);
  for (const xx of [18, 60]) fillPoly(c, [xx - 2, -100, xx + 2, -100, xx + 2, -28, xx - 2, -28], P.brassLo, P.goldInk, 0.6);
  // the door at the foot
  c.beginPath(); c.moveTo(-28, 0); c.lineTo(-28, -18); c.arc(-18, -18, 10, Math.PI, 0); c.lineTo(-8, 0); c.closePath(); c.fillStyle = lg(c, 0, -28, 0, 0, [P.woodLo, '#3a2412']); c.fill(); c.strokeStyle = P.woodInk; c.lineWidth = 1; c.stroke();
  ell(c, -12, -12, 1.2, 1.2, P.brassHi);
}
// The Snake Pit: a round pit sunk in the floor, a stone kerb, an iron rail round its back, coins glinting in the dark
// at its bottom (a snake rises out of it, live)
export const PIT = { x: 0, y: -26, rx: 58, ry: 20 };
function paintPit(c) {
  const { x, y, rx, ry } = PIT;
  softShadow(c, x + 6, y + ry * 0.6, rx * 1.2, ry * 0.9, 0.5);
  // the rail along the back half, behind the hole
  const posts = []; for (let k = 0; k <= 6; k++) { const a = Math.PI + (k / 6) * Math.PI; posts.push([x + Math.cos(a) * (rx + 8), y + Math.sin(a) * (ry + 4)]); }
  for (const [px, py] of posts) fillPoly(c, [px - 1.6, py, px + 1.6, py, px + 1.6, py - 26, px - 1.6, py - 26], lg(c, px - 1.6, 0, px + 1.6, 0, [P.ironHi, P.ironLo]), P.ironInk, 0.6);
  for (const dy of [-24, -12]) { c.beginPath(); posts.forEach(([px, py], i) => (i ? c.lineTo(px, py + dy) : c.moveTo(px, py + dy))); c.strokeStyle = P.ironInk; c.lineWidth = 2.6; c.stroke(); c.strokeStyle = P.ironHi; c.lineWidth = 1; c.stroke(); }
  // the kerb (a ring of blocks), then the hole
  ell(c, x, y + 4, rx + 10, ry + 8, P.stoneLo);
  ell(c, x, y, rx + 10, ry + 7, P.stoneHi);
  for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU; line(c, [x + Math.cos(a) * rx, y + Math.sin(a) * ry, x + Math.cos(a) * (rx + 10), y + Math.sin(a) * (ry + 7)], P.stoneInk, 0.9); }
  c.beginPath(); c.ellipse(x, y, rx + 10, ry + 7, 0, Math.PI * 1.05, Math.PI * 1.6); c.strokeStyle = P.stoneTop; c.lineWidth = 1.4; c.stroke();
  ell(c, x, y, rx, ry, '#02050a');
  c.save(); c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.clip();
  // the inner wall going down (lit at the back), coins far below
  c.fillStyle = lg(c, 0, y - ry, 0, y + ry, ['#2a4054', '#0e1a26', '#02050a']); c.beginPath(); c.ellipse(x, y - ry * 0.3, rx, ry * 0.8, 0, Math.PI, TAU); c.fill();
  for (let k = 0; k < 7; k++) { const cx = x + (k - 3) * 9 + Math.sin(k) * 3, cy = y + ry * 0.55 + Math.cos(k * 2) * 2; ell(c, cx, cy, 3, 1.2, '#8a6a20'); ell(c, cx - 0.6, cy - 0.3, 1.4, 0.4, '#d8b050'); }
  c.restore();
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI); c.strokeStyle = 'rgba(2,6,14,0.8)'; c.lineWidth = 2; c.stroke();
  // the front rail posts (short, so the pit shows) and a coiled rope ladder hooked over the kerb
  for (let k = 1; k < 6; k++) { const a = (k / 6) * Math.PI, px = x + Math.cos(a) * (rx + 12), py = y + Math.sin(a) * (ry + 9); fillPoly(c, [px - 1.6, py, px + 1.6, py, px + 1.6, py - 9, px - 1.6, py - 9], P.iron, P.ironInk, 0.6); ell(c, px, py - 9.5, 2, 1.2, P.ironHi); }
  line(c, [x + rx * 0.55, y - ry * 0.7, x + rx * 0.5, y + ry * 0.2], '#c8a060', 1.4); line(c, [x + rx * 0.68, y - ry * 0.6, x + rx * 0.62, y + ry * 0.3], '#c8a060', 1.4);
  for (let k = 0; k < 4; k++) { const f = k / 4; line(c, [lerp(x + rx * 0.55, x + rx * 0.5, f), lerp(y - ry * 0.7, y + ry * 0.2, f), lerp(x + rx * 0.68, x + rx * 0.62, f), lerp(y - ry * 0.6, y + ry * 0.3, f)], '#8a6a3a', 1.2); }
}
// The Sky Bridge: a deep crack across the floor and a rope bridge of planks across it between two stone piers, a
// lantern on each pier
export const BRIDGE_LAMPS = [[-70, -70], [70, -70]];
function paintBridge(c) {
  // the chasm: a jagged black cleft across the floor, its far wall lit
  const cleft = [-84, -20, -60, -30, -30, -24, 0, -34, 30, -26, 60, -34, 84, -24, 84, 6, 60, 0, 30, 8, 0, -2, -30, 6, -60, -2, -84, 4];
  fillPoly(c, cleft, '#010307', P.stoneInk, 1);
  c.save(); poly(c, cleft); c.clip(); c.fillStyle = lg(c, 0, -34, 0, -10, ['#2a4054', '#02050a']); c.beginPath(); c.moveTo(-90, -40); for (let x = -84; x <= 84; x += 12) c.lineTo(x, -24 - Math.sin(x * 0.13) * 6); c.lineTo(90, -40); c.fill(); flatGlow(c, 0, -4, 50, 8, '#2fb0c0', 0.15); c.restore();
  line(c, [-84, 4, -60, -2, -30, 6, 0, -2, 30, 8, 60, 0, 84, 6], P.stoneTop, 1.2);
  // the piers
  for (const sd of [-1, 1]) { const x = sd * 72; fillPoly(c, [x - 12, 4, x + 12, 4, x + 10, -56, x - 10, -56], lg(c, x - 12, 0, x + 12, 0, [P.stoneHi, P.stone, P.stoneLo]), P.stoneInk, 1.1); fillPoly(c, [x - 12, -56, x + 12, -56, x + 10, -62, x - 10, -62], P.stoneTop, P.stoneInk, 0.9); for (let r = 1; r < 4; r++) line(c, [x - 11, -r * 15, x + 11, -r * 15], 'rgba(4,10,18,0.45)', 1); }
  // the rope bridge: hand ropes from pier top to pier top, sagging; the deck of planks below, sagging more
  const deck = (f) => -14 + Math.sin(f * Math.PI) * 10, hand = (f) => -54 + Math.sin(f * Math.PI) * 16;
  for (let k = 0; k <= 16; k++) { const f = k / 16, x = lerp(-62, 62, f), y = deck(f); fillPoly(c, [x - 3.4, y + 2.6, x + 3.4, y + 2.6, x + 3.2, y - 2, x - 3.2, y - 2], k % 3 ? P.wood : P.woodHi, P.woodInk, 0.7); }
  for (const dy of [0, 3]) { c.beginPath(); for (let k = 0; k <= 16; k++) { const f = k / 16, x = lerp(-62, 62, f); k ? c.lineTo(x, deck(f) + dy) : c.moveTo(x, deck(f) + dy); } c.strokeStyle = '#7a5a30'; c.lineWidth = 1; c.stroke(); }
  c.beginPath(); for (let k = 0; k <= 16; k++) { const f = k / 16, x = lerp(-62, 62, f); k ? c.lineTo(x, hand(f)) : c.moveTo(x, hand(f)); } c.strokeStyle = '#c8a060'; c.lineWidth = 1.6; c.stroke();
  for (let k = 1; k < 16; k += 2) { const f = k / 16, x = lerp(-62, 62, f); line(c, [x, hand(f), x, deck(f) - 2], 'rgba(200,160,96,0.8)', 0.8); }
  for (const [x, y] of BRIDGE_LAMPS) { line(c, [x, y + 8, x, y + 2], P.ironInk, 1.4); fillPoly(c, [x - 4, y + 2, x + 4, y + 2, x + 3.4, y - 8, x - 3.4, y - 8], lg(c, 0, y - 8, 0, y + 2, ['#fff2c0', '#ffc860']), P.ironInk, 0.8); fillPoly(c, [x - 5, y - 8, x + 5, y - 8, x, y - 13], P.iron, P.ironInk, 0.7); }
}
// The Great Vault Door: a massive round door of steel and brass in a wall of dressed stone, standing a crack open on
// gold; the Rat King's heap of coins beside it, a rat hole at the wall's foot (the King and his rats are live)
export const DOOR = { x: -12, y: -84, r: 50 };
export const KING_SEAT = [26, -20]; // where the King sits on his heap
export const RAT_HOLE = [-58, 2];
export const RAT_HEAP = [8, 4];
function paintDoor(c) {
  flatGlow(c, 0, -6, 110, 26, P.gold, 0.35);
  const wall = [-74, 2, -74, -150, -60, -168, 42, -168, 56, -150, 56, 2];
  fillPoly(c, wall, lg(c, -84, -168, 84, 0, [P.stoneHi, P.stone, P.stoneLo]), P.stoneInk, 1.4);
  c.save(); poly(c, wall); c.clip();
  for (let r = 0; r < 12; r++) { const y = -r * 15; line(c, [-90, y, 90, y], 'rgba(4,10,18,0.5)', 1); for (let k = -6; k <= 6; k++) { const x = k * 16 + (r % 2) * 8; line(c, [x, y, x, y - 15], 'rgba(4,10,18,0.4)', 1); } c.fillStyle = 'rgba(200,230,250,0.07)'; c.fillRect(-90, y - 14, 180, 1.2); }
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(30, -170, 30, 175);
  c.restore();
  fillPoly(c, [-74, -150, -60, -168, 42, -168, 56, -150], lg(c, 0, -168, 0, -150, [P.stoneTop, P.stoneHi]), P.stoneInk, 1.1);
  crestEgg(c, -12, -152, 16);
  const { x, y, r } = DOOR;
  // the frame: a thick steel ring set in the stone, bolts round it
  ell(c, x + 2, y + 3, r + 10, r + 10, 'rgba(2,6,14,0.55)');
  ell(c, x, y, r + 9, r + 9, P.ironLo); ell(c, x - 0.8, y - 0.8, r + 8, r + 8, P.iron);
  c.beginPath(); c.arc(x, y, r + 8, Math.PI * 0.85, Math.PI * 1.6); c.strokeStyle = P.ironHi; c.lineWidth = 2; c.stroke();
  for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU; ell(c, x + Math.cos(a) * (r + 4.5), y + Math.sin(a) * (r + 4.5), 1.8, 1.8, P.ironHi); }
  // the opening: a crescent of gold light where the door stands ajar (the door has swung toward us on its right hinge)
  ell(c, x, y, r, r, '#1a0e04');
  c.save(); c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip(); c.fillStyle = rg(c, x - r * 0.5, y, 4, r * 1.2, ['#fff2b0', '#ffc84a', '#a06a10', '#2a1404']); c.fillRect(x - r, y - r, r * 2, r * 2);
  for (let k = 0; k < 6; k++) { ell(c, x - r * 0.7 + k * 4, y + r * 0.55 - (k % 3) * 6, 6, 3, k % 2 ? P.gold : P.goldMid); }
  c.restore();
  // the door leaf: a thick disc pushed a little right, seen a touch edge-on, with its own rim, spokes and wheel
  const dx = x + 12, rx = r * 0.92;
  c.beginPath(); c.ellipse(dx + 6, y, rx * 0.9, r, 0, 0, TAU); c.fillStyle = '#2a323e'; c.fill(); // the leaf's thickness
  c.beginPath(); c.ellipse(dx, y, rx * 0.9, r, 0, 0, TAU); c.fillStyle = lg(c, dx - rx, y - r, dx + rx, y + r, ['#c4ccd6', '#8a96a6', '#5a6676', '#3a4452']); c.fill(); c.strokeStyle = P.ironInk; c.lineWidth = 1.4; c.stroke();
  c.beginPath(); c.ellipse(dx, y, rx * 0.72, r * 0.8, 0, 0, TAU); c.strokeStyle = 'rgba(10,14,20,0.5)'; c.lineWidth = 1.2; c.stroke();
  c.beginPath(); c.ellipse(dx, y, rx * 0.74, r * 0.82, 0, Math.PI * 0.9, Math.PI * 1.5); c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1; c.stroke();
  for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; ell(c, dx + Math.cos(a) * rx * 0.81, y + Math.sin(a) * r * 0.9, 1.8, 1.8, '#dce2ea'); }
  // the brass wheel: rim, hub, six spokes ending in knobs
  c.strokeStyle = P.brassLo; c.lineWidth = 3.4; c.beginPath(); c.ellipse(dx, y, rx * 0.36, r * 0.4, 0, 0, TAU); c.stroke(); c.strokeStyle = P.brassHi; c.lineWidth = 1.4; c.stroke();
  for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU + 0.3, ex = dx + Math.cos(a) * rx * 0.5, ey = y + Math.sin(a) * r * 0.55; line(c, [dx, y, ex, ey], P.brass, 2.6); ell(c, ex, ey, 3, 3, P.brassHi); }
  ell(c, dx, y, 7, 7.6, P.brass); ell(c, dx - 1.5, y - 1.5, 3, 3, P.brassHi);
  // the hinge on the right
  for (const hy of [-30, 30]) fillPoly(c, [dx + rx * 0.82, y + hy - 6, dx + rx + 16, y + hy - 6, dx + rx + 16, y + hy + 6, dx + rx * 0.82, y + hy + 6], lg(c, 0, y + hy - 6, 0, y + hy + 6, [P.ironHi, P.ironLo]), P.ironInk, 0.8);
  // the rat hole at the wall's foot (left), the King's heap of coins (right), gold spilt between
  const [hx, hy] = RAT_HOLE;
  c.beginPath(); c.moveTo(hx - 9, hy); c.lineTo(hx - 9, hy - 7); c.arc(hx, hy - 7, 9, Math.PI, 0); c.lineTo(hx + 9, hy); c.closePath(); c.fillStyle = '#010306'; c.fill(); c.strokeStyle = P.stoneLo; c.lineWidth = 1.4; c.stroke();
  for (let k = 0; k < 9; k++) { const sx = lerp(-44, 10, k / 8) + Math.sin(k * 3.1) * 4, sy = 6 + Math.cos(k * 2.3) * 2; ell(c, sx, sy + 0.4, 3, 1.3, P.goldLo); ell(c, sx, sy, 3, 1.2, P.gold); }
  heap(c, 30, 6, 26, 24, 41);
  chest(c, 56, 9, 7);
}
const PAINT = { gate: paintGate, clock: paintClock, pit: paintPit, bridge: paintBridge, door: paintDoor };

// ------------------------------------------------------------------ landmarks on the map (called by main.js)
export function drawThievesLandmark(ctx, L, m, sy, t, calm, p, glow, DPR) {
  const y = drawLandmarkBody(ctx, m, sy, t, calm, p, glow, DPR, (c, mm) => PAINT[mm.kind](c), '#ffd27a', '#fff1a8');
  if (y == null) return;
  const d = m.d, f = m.flip ? -1 : 1, T = calm ? 0 : t, X = (v) => m.x + v * d * f, Yy = (v) => y + v * d;
  const sq = p && !calm;
  if (sq) { ctx.save(); ctx.translate(m.x, y); ctx.scale(1 + 0.035 * p, 1 - 0.045 * p); ctx.translate(-m.x, -y); }
  if (m.kind === 'gate') { for (let i = 0; i < 2; i++) { const [tx, ty] = GATE_TORCHES[i]; torchFire(ctx, X(tx), Yy(ty - 2.6), d * 1.6, T, i * 2.3, calm); } }
  else if (m.kind === 'clock') clockLife(ctx, X, Yy, d, f, T, calm, t);
  else if (m.kind === 'pit') pitSnake(ctx, X, Yy, d, f, T, calm);
  else if (m.kind === 'bridge') { for (let i = 0; i < 2; i++) { const [lx, ly] = BRIDGE_LAMPS[i]; glowBlit(ctx, X(lx), Yy(ly - 3), 22 * d, '#ffd27a', calm ? 0.6 : 0.55 + 0.1 * Math.sin(T * 7 + i * 3)); } }
  else if (m.kind === 'door') { glowBlit(ctx, X(DOOR.x - DOOR.r * 0.45), Yy(DOOR.y), DOOR.r * 1.2 * d, '#ffd060', calm ? 0.35 : 0.3 + 0.1 * Math.sin(T * 1.7)); }
  if (sq) ctx.restore();
}
function torchFire(ctx, x, y, s, t, k, calm) { glowBlit(ctx, x, y - 3 * s, 16 * s, '#ff9a3a', calm ? 0.6 : 0.5 + 0.12 * Math.sin(t * 7 + k)); flame(ctx, x, y, 2.6 * s, t, k); }
const gearShape = (ctx, x, y, r, teeth, rot, col, ink) => {
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) { const a = rot + (i / (teeth * 2)) * TAU, rr2 = i % 2 ? r : r * 1.2; ctx.lineTo(x + Math.cos(a - 0.1) * rr2, y + Math.sin(a - 0.1) * rr2); ctx.lineTo(x + Math.cos(a + 0.1) * rr2, y + Math.sin(a + 0.1) * rr2); }
  ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = Math.max(0.8, r * 0.08); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, TAU); ctx.strokeStyle = 'rgba(90,54,8,0.6)'; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r * 0.22, 0, TAU); ctx.fillStyle = ink; ctx.fill();
};
function clockLife(ctx, X, Yy, d, f, T, calm, t) {
  // the gears: each driven by the one before (opposite ways, speed by size)
  let w0 = calm ? 0 : T * 0.6;
  for (let i = 0; i < KEEP_GEARS.length; i++) { const [gx, gy, r, n] = KEEP_GEARS[i], rot = (i % 2 ? -1 : 1) * w0 * (KEEP_GEARS[0][2] / r) * f; gearShape(ctx, X(gx), Yy(gy), r * d, n, rot + i * 0.3, i === 1 ? '#d8a84a' : '#c8963e', '#5a3608'); }
  // the hands: the minute hand ticks round once a minute, the hour hand creeps
  const { x, y, r } = CLOCK, cx = X(x), cy = Yy(y), mm = calm ? 0.12 : (t / 60) % 1, hh = calm ? 0.35 : (t / 720 + 0.35) % 1;
  const tick = calm ? mm : Math.floor(mm * 60) / 60 + ss(fract(mm * 60) * 6) / 60; // it jumps a little each second
  ctx.lineCap = 'round'; ctx.strokeStyle = '#2a1a0c';
  ctx.lineWidth = 2.6 * d; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(hh * TAU) * r * 0.5 * d * f, cy - Math.cos(hh * TAU) * r * 0.5 * d); ctx.stroke();
  ctx.lineWidth = 1.6 * d; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(tick * TAU) * r * 0.78 * d * f, cy - Math.cos(tick * TAU) * r * 0.78 * d); ctx.stroke();
  ctx.fillStyle = P.brass; ctx.beginPath(); ctx.arc(cx, cy, 2.2 * d, 0, TAU); ctx.fill();
  // the pendulum
  const pd = PENDULUM, a = calm ? 0 : Math.sin(T * Math.PI) * 0.28, px = X(pd.x), py = Yy(pd.y), bx = px + Math.sin(a) * pd.len * d * f, by = py + Math.cos(a) * pd.len * d;
  ctx.strokeStyle = P.brassLo; ctx.lineWidth = 1.4 * d; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(bx, by); ctx.stroke();
  ctx.fillStyle = P.brass; ctx.beginPath(); ctx.arc(bx, by, 5 * d, 0, TAU); ctx.fill(); ctx.strokeStyle = P.goldInk; ctx.lineWidth = 0.8 * d; ctx.stroke();
  ctx.fillStyle = P.brassHi; ctx.beginPath(); ctx.arc(bx - 1.5 * d, by - 1.5 * d, 1.6 * d, 0, TAU); ctx.fill();
}
// the snake in the pit: it rises out of the dark, sways, looks one way then the other (its head turns to face where
// it looks), tastes the air, sinks back down
function pitSnake(ctx, X, Yy, d, f, T, calm) {
  const C = 9, k = calm ? 3 : fract(T / C) * C;
  const up = calm ? 0.8 : ss((k - 0.4) / 1.2) * (1 - ss((k - 7.2) / 1.2));
  if (up <= 0.02) return;
  const look = calm ? 0.5 : k < 3.6 ? 1 : k < 4.2 ? 1 - 2 * ss((k - 3.6) / 0.6) : -1; // right, turn, left
  const sway = calm ? 0 : Math.sin(T * 1.6) * 5;
  const bx = PIT.x + 6, by = PIT.y + 4, H = 58 * up, pts = [];
  const hx = bx + sway * up + look * 10, hy = by - H;
  for (let q = 0; q <= 14; q++) { const v = q / 14, yy = lerp(hy, by + 4, v), xx = lerp(hx, bx, v) + Math.sin(v * 5.5 - T * 2.4) * 5 * (1 - v * 0.4) * up; pts.push({ x: X(xx), y: Yy(yy) }); }
  // the head end bends to point where it looks: the first two points lead out sideways
  pts.unshift({ x: X(hx + look * 9), y: Yy(hy + 2) });
  drawSnake(ctx, pts, 4.2 * d, T, { skin: 'violet', wave: 0 });
  const fl = calm ? 0 : Math.max(0, Math.sin(T * 5)) * (k > 2 && k < 6 ? 1 : 0); // the tongue
  if (fl > 0.3) { const tx = X(hx + look * 9) + look * f * 6 * d, ty = Yy(hy + 2); ctx.strokeStyle = '#e0405a'; ctx.lineWidth = 1 * d; ctx.beginPath(); ctx.moveTo(X(hx + look * 9), ty); ctx.lineTo(tx, ty); ctx.lineTo(tx + look * f * 2 * d, ty - 1.5 * d); ctx.moveTo(tx, ty); ctx.lineTo(tx + look * f * 2 * d, ty + 1.5 * d); ctx.stroke(); }
}
// soft glow sprites, one per colour, made once (no gradients per frame)
const GLOW = new Map();
function glowSprite(col) {
  let cv = GLOW.get(col); if (cv) return cv;
  if (typeof document === 'undefined') return null;
  cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'); g.fillStyle = rg(g, 32, 32, 0, 32, [rgba(col, 0.9), rgba(col, 0.35), rgba(col, 0)]); g.fillRect(0, 0, 64, 64);
  GLOW.set(col, cv); return cv;
}
function glowBlit(ctx, x, y, r, col, a) { const g = glowSprite(col); if (!g || a <= 0.01) return; ctx.globalAlpha = a; ctx.drawImage(g, x - r, y - r, 2 * r, 2 * r); ctx.globalAlpha = 1; }
export const drawThievesPlaque = drawFarmPlaque;

// ------------------------------------------------------------------ the live layer
function win(t, a, b, f = 0.25) { return ss((t - a) / f) * (1 - ss((t - b) / f)); }
const vis = (y0, y1, vt, vb) => y1 >= vt && y0 <= vb;
export function drawThievesLive(ctx, L, sy, t, calm, vt = -Infinity, vb = Infinity) {
  const plan = thievesPlan(L), u = L.u, T = calm ? 0 : t, top = L.bandTop(WI);
  if (plan.lms.length < 5) return;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  try {
    if (!calm && vis(top - sy, top + L.BH - sy, vt, vb)) drawMapAmb(ctx, 'back', WI, ambG(L, plan, sy, t)); // dust drifting in the light
    for (let i = 0; i < plan.torches.length; i++) { const q = plan.torches[i]; if (vis(q.y - 40 * u - sy, q.y + 20 * u - sy, vt, vb)) torchFire(ctx, q.x, q.y - sy - 2.6 * q.s * 1.4, q.s * 1.4, T, i * 1.7, calm); }
    const ho = spot(plan, 'hoist'); if (ho && vis(ho.y - 130 * u - sy, ho.y - sy, vt, vb)) hoistLife(ctx, ho, sy, u, T, calm);
    const cr = spot(plan, 'crates'); if (cr && vis(cr.y - 110 * u - sy, cr.y + 10 * u - sy, vt, vb)) weasel(ctx, cr, sy, u, T, calm);
  } catch (e) { /* art never breaks the map */ }
  ctx.restore();
}
function ambG(L, plan, sy, t) {
  const coins = plan.props.filter((p) => p.k.startsWith('heap') || p.k === 'chest').map((p) => ({ x: p.x, y: p.y - sy, s: 40 * L.u }));
  return { x0: L.A.x, x1: L.A.x1, y: L.bandTop(WI) - sy, h: L.BH, u: L.u, t, spots: (k) => (k === 'coins' ? coins : []) };
}
// over the landmarks: the Rat King and his rats at the vault door; glints on the gold and a runaway coin (mapamb.js)
export function drawThievesFront(ctx, L, sy, t, calm, vt = -Infinity, vb = Infinity) {
  const plan = thievesPlan(L), u = L.u, door = plan.lms[4], top = L.bandTop(WI);
  if (!door) return;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  try {
    if (vis(door.y - 120 * door.d - sy, door.y + 20 * door.d - sy, vt, vb)) court(ctx, door, sy, calm ? 0 : t, calm);
    if (!calm && vis(top - sy, top + L.BH - sy, vt, vb)) drawMapAmb(ctx, 'front', WI, ambG(L, plan, sy, t));
  } catch (e) { /* art never breaks the map */ }
  ctx.restore();
}

// the hoist: the crate is wound up to the beam, hangs swinging a moment, is let down to the floor, rests
function hoistLife(ctx, ho, sy, u, t, calm) {
  const s = ho.s * u, x = ho.x + 12 * s, top = ho.y - sy - 110 * s, C = 11, k = calm ? 0 : fract(t / C) * C;
  const lift = calm ? 0.2 : k < 1.5 ? 0 : k < 4.5 ? ss((k - 1.5) / 3) : k < 6.5 ? 1 : k < 9.5 ? 1 - ss((k - 6.5) / 3) : 0;
  const swing = calm ? 0 : Math.sin(t * 2.2) * 0.06 * (k > 4 && k < 7.5 ? 1 : 0.25) * lift;
  const len = lerp(100, 34, lift) * s, cx = x + Math.sin(swing) * len, cy = top + Math.cos(swing) * len;
  ctx.strokeStyle = '#c8a060'; ctx.lineWidth = 1.2 * s; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(cx, cy); ctx.stroke();
  ctx.strokeStyle = '#7a5a30'; ctx.lineWidth = 1 * s; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - 7 * s, cy + 6 * s); ctx.moveTo(cx, cy); ctx.lineTo(cx + 7 * s, cy + 6 * s); ctx.stroke();
  ctx.save(); ctx.translate(cx, cy + 6 * s); ctx.rotate(swing * 0.6); ctx.scale(s, s);
  if (lift < 0.05) { ctx.fillStyle = 'rgba(2,6,14,0.4)'; ctx.beginPath(); ctx.ellipse(1, 14, 12, 2.6, 0, 0, TAU); ctx.fill(); }
  crate(ctx, -9, 14, 18, 14);
  ctx.restore();
  if (lift > 0.1) { ctx.fillStyle = `rgba(2,6,14,${0.35 * (1 - lift * 0.6)})`; ctx.beginPath(); ctx.ellipse(x + 2 * s, ho.y - sy - 4 * s, 12 * s * (1 - lift * 0.4), 2.6 * s, 0, 0, TAU); ctx.fill(); } // its shadow on the floor
}

// ------------------------------------------------------------------ the thieves (the game's own weasel and rats)
// A side-view creature walks the way it faces. To turn round it squashes through the middle (a quick flip with a
// little hop), so it never slides backwards or snaps: turn(k) gives the facing scale, k 0..1 through the turn.
const turnScale = (k) => { const c = Math.cos(clamp(k, 0, 1) * Math.PI); return Math.sign(c || 1) * Math.max(0.12, Math.abs(c)); };
// the odometer a pose's legs run on (thieves.js counts it in metres of the rig)
const odoOf = (kind, distPx, s) => (distPx * RIG[kind].s) / s;
// draw a thief at floor point (x, y), facing f (1 right .. -1 left, fractional while turning), with a hop
// The thieves are the game's full rigs, too many strokes to paint every frame for a map: each one is painted onto its
// own small picture 15 times a second (slot: which picture) and that picture is stamped every frame, so it still glides
// smoothly while its legs and head move at 15 steps a second. A picture is reused; one that must grow is given back
// (freeCanvas) and made anew. freeThieves gives them all back when the map lets go of its pictures.
const TSPR = new Map();
export function freeThieves() { for (const e of TSPR.values()) freeCanvas(e.cv); TSPR.clear(); }
function thief(ctx, kind, x, y, s, t, P, f, o = {}, slot = kind) {
  const D = (ctx.getTransform ? Math.abs(ctx.getTransform().d) : 1) || 1, face = f < 0 ? -1 : 1;
  const bw = s * 2.8, bh = s * 2.4, ox = s * 1.4, oy = s * 1.9; // the picture's box around the floor point
  const W = Math.ceil(bw * D), H = Math.ceil(bh * D), key = `${kind}|${Math.floor(t * 15)}|${face}|${o.eye || ''}|${W}x${H}`;
  let e = TSPR.get(slot);
  if (!e || e.key !== key) {
    if (typeof document === 'undefined') return;
    if (e && (e.cv.width < W || e.cv.height < H || e.cv.width > W * 1.6)) { freeCanvas(e.cv); e = null; }
    if (!e) { e = { cv: document.createElement('canvas'), key: '' }; e.cv.width = W; e.cv.height = H; TSPR.set(slot, e); }
    const c = e.cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, e.cv.width, e.cv.height);
    c.setTransform(D, 0, 0, D, 0, 0);
    drawThief(c, ox, oy, s, t, P, Object.assign(o, { face }), kind);
    e.key = key; e.W = W; e.H = H;
  }
  ctx.save(); ctx.translate(x, y); ctx.scale(Math.abs(f), 1);
  ctx.drawImage(e.cv, 0, 0, e.W, e.H, -ox, -oy, e.W / D, e.H / D);
  ctx.restore();
}
// the weasel in the crates: pops his head up behind the top crate, looks one way, turns, looks the other, ducks; every
// other round he hops out, trots off along the floor, turns round, trots back and hops in again
function weasel(ctx, cr, sy, u, t, calm) {
  const s = cr.s * u, bx = cr.x + 22 * s, floorY = cr.y - sy + 2 * s, boxTop = floorY - 30 * s, S = 30 * s, out = cr.dir; // out: the side he hops out on (toward the road: open floor)
  const C = 16, n = calm ? 0 : Math.floor(t / C), k = calm ? 2 : fract(t / C) * C, hops = n % 2 === 1;
  let x = bx, y = boxTop + 12 * s, f = out, P = null, clip = true, lid = 0;
  const odo = (d) => odoOf('weasel', d, S);
  if (k < 0.8 || (k > 5.4 && !hops)) { lidDraw(ctx, bx, boxTop, s, 0); return; } // hidden in the crate
  if (k < 5.4) { // the peek: up, look out, turn, look back, duck
    const upk = ss((k - 0.8) / 0.4) * (1 - ss((k - 5) / 0.4)); lid = upk;
    f = k < 2.6 ? out : k < 3.0 ? out * turnScale((k - 2.6) / 0.4) : -out;
    y = boxTop + (1 - upk) * 26 * s + 6 * s;
    P = thiefPose('weasel', 'idle', t, 0, 0); P.hr = (P.hr || 0) - 0.15; P.look = 1; P.ear = -0.2;
  } else { // the hop out: up and over, a trot out and back, the hop in
    const D = 56 * s, edge = bx + out * 24 * s;
    if (k < 6.2) { const q = (k - 5.4) / 0.8; lid = 1; x = lerp(bx, edge + out * 10 * s, q); y = lerp(boxTop + 6 * s, floorY, q) - Math.sin(q * Math.PI) * 18 * s; f = out; P = thiefPose('weasel', 'leap', t, q, 0); clip = q < 0.35; }
    else if (k < 8.4) { const q = ss((k - 6.2) / 2.2); clip = false; x = edge + out * (10 * s + q * D); y = floorY; f = out; P = thiefPose('weasel', 'prowl', t, 0, odo(q * D)); }
    else if (k < 9.8) { clip = false; x = edge + out * (10 * s + D); y = floorY; f = out; P = thiefPose('weasel', 'idle', t, 0, 0); P.look = 1; } // sniffs the air
    else if (k < 10.3) { clip = false; const q = (k - 9.8) / 0.5; x = edge + out * (10 * s + D); y = floorY - Math.sin(q * Math.PI) * 4 * s; f = out * turnScale(q); P = thiefPose('weasel', 'idle', t, 0, 0); }
    else if (k < 12.5) { const q = ss((k - 10.3) / 2.2); clip = false; x = edge + out * (10 * s + D * (1 - q)); y = floorY; f = -out; P = thiefPose('weasel', 'prowl', t, 0, odo((1 - q) * D)); }
    else if (k < 13.3) { const q = (k - 12.5) / 0.8; lid = 1; x = lerp(edge + out * 10 * s, bx, q); y = lerp(floorY, boxTop + 10 * s, q) - Math.sin(q * Math.PI) * 18 * s; f = -out; P = thiefPose('weasel', 'leap', t, q, 0); clip = q > 0.65; }
    else { lidDraw(ctx, bx, boxTop, s, 1 - ss((k - 13.3) / 0.4)); return; }
  }
  if (clip) { ctx.save(); ctx.beginPath(); ctx.rect(bx - 80 * s, boxTop - 80 * s, 160 * s, 80 * s + 1 * s); ctx.clip(); }
  thief(ctx, 'weasel', x, y, S, t, P, f, {});
  if (clip) ctx.restore();
  lidDraw(ctx, bx, boxTop, s, lid);
}
function lidDraw(ctx, bx, boxTop, s, open) { // the crate's lid: shut, or propped up on his head
  ctx.save(); ctx.translate(bx - 14 * s, boxTop); ctx.rotate(-open * 0.9);
  ctx.fillStyle = P.woodHi; ctx.strokeStyle = P.woodInk; ctx.lineWidth = 0.8 * s;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(28 * s, 0); ctx.lineTo(34 * s, -5 * s); ctx.lineTo(6 * s, -5 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}
// the court at the vault door: the King on his heap, two rats carrying coins from the heap to the hole. They meet half
// way and squabble; when the King turns to look at them they freeze until he looks away.
const KC = 11, LOOK0 = 7.2, LOOK1 = 9.6; // the King's round: sits, preens, then turns and glares for a while
function court(ctx, m, sy, t, calm) {
  const d = m.d, f = m.flip ? -1 : 1, y0 = m.y - sy, X = (v) => m.x + v * d * f;
  const kk = calm ? 1 : fract(t / KC) * KC, nk = calm ? 0 : Math.floor(t / KC);
  const glare = calm ? 0 : win(kk, LOOK0, LOOK1, 0.3); // how much the King is looking at them
  // the rats' own clock stops while he glares (time spent frozen is taken out)
  const frozenFor = (k) => clamp(k - LOOK0, 0, LOOK1 - LOOK0);
  const tr = calm ? 0 : nk * (KC - (LOOK1 - LOOK0)) + kk - frozenFor(kk);
  const freeze = glare > 0.2;
  // the King: sits up on his heap facing the hall; turns toward the rats (they are on his inner side) and rears up
  const kx = X(KING_SEAT[0]), ky = y0 + KING_SEAT[1] * d, KS = 48 * d, toward = -f; // the hole is on the wall's left (inner) side
  const turnK = calm ? 0 : clamp((kk - (LOOK0 - 0.4)) / 0.4, 0, 1) * (1 - clamp((kk - LOOK1) / 0.4, 0, 1));
  const kf = (-toward) * turnScale(turnK); // from facing out (away from the hole) to facing the rats
  const PK = thiefPose('ratking', glare > 0.5 ? 'stand' : 'idle', t, 0, 0);
  if (glare > 0.5) { PK.brow = 1; PK.lid = 0.1; } else { PK.lid = 0.5; PK.look = 0.2; }
  // the rats walk between the heap's foot and the hole, on the floor in front of the wall
  const hx = X(RAT_HOLE[0]), px = X(RAT_HEAP[0] - 6), ry = y0 + 6 * d, RS = 30 * d;
  const rats = [ratAt(tr, 0, hx, px, RS, freeze), ratAt(tr, 0.5, hx, px, RS, freeze)];
  // draw back to front: the King on his heap is behind the rats' lane
  thief(ctx, 'ratking', kx, ky, KS, t, PK, kf, { crown: true, cape: true, eye: glare > 0.5 ? 'angry' : 'normal' });
  if (glare > 0.5 && !calm) { ctx.fillStyle = 'rgba(255,240,180,0.9)'; star4(ctx, kx + kf * 16 * d, ky - 36 * d, 1.8 * d * glare); }
  rats.sort((a, b) => a.lane - b.lane);
  for (const r of rats) {
    const o = {}, yy = ry + r.lane * d;
    if (r.hole > 0) { ctx.save(); ctx.beginPath(); const cx = hx + (hx < px ? 6 : -6) * d; ctx.rect(hx < px ? cx : -1e4, yy - 60 * d, 1e4, 80 * d); ctx.clip(); }
    thief(ctx, 'rat', r.x, yy, RS, t + r.ph, r.P, r.f, o, r.ph ? 'rat2' : 'rat');
    if (r.coin) { const mx = r.x + r.f * 26 * d, my = yy - 13 * d; ctx.fillStyle = P.goldLo; ctx.beginPath(); ctx.ellipse(mx, my + 0.6 * d, 3.6 * d, 3.6 * d, 0, 0, TAU); ctx.fill(); ctx.fillStyle = P.gold; ctx.beginPath(); ctx.ellipse(mx - 0.5 * d, my, 3.2 * d, 3.2 * d, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#fffbe0'; ctx.beginPath(); ctx.arc(mx - 1.4 * d, my - 1.2 * d, 0.9 * d, 0, TAU); ctx.fill(); }
    if (r.hole > 0) ctx.restore();
    if (r.squeak > 0.4 && !calm) { ctx.strokeStyle = `rgba(255,255,255,${0.8 * r.squeak})`; ctx.lineWidth = 1.2 * d; for (let q = 0; q < 2; q++) { ctx.beginPath(); ctx.arc(r.x + r.f * 22 * d, yy - 30 * d, (5 + q * 4) * d, -1.2, -0.3); ctx.stroke(); } }
  }
}
// one rat's round (ph: its offset through the round): heap -> (squabble half way) -> hole, drop the coin in, turn,
// back -> (squabble) -> heap, pick up a coin, turn. Returns where it is, which way it faces and its pose.
function ratAt(t, ph, hx, px, S, freeze) {
  const D = Math.abs(px - hx), dirToHole = Math.sign(hx - px) || -1, v = 34 * (S / 30), walk = D * 0.5 / v;
  const steps = [[walk, 'carry', 0, 0.5], [1.2, 'fuss', 0.5, 0.5], [walk, 'carry', 0.5, 1], [0.7, 'drop', 1, 1], [0.45, 'turnH', 1, 1], [walk, 'prowl', 1, 0.5], [1.2, 'fuss2', 0.5, 0.5], [walk, 'prowl', 0.5, 0], [0.7, 'grab', 0, 0], [0.45, 'turnP', 0, 0]];
  let C = 0; for (const s of steps) C += s[0];
  let k = fract(t / C + ph) * C, odoBase = 0;
  for (const [dur, kind, a, b] of steps) {
    if (k < dur) {
      const q = k / dur, e = kind === 'carry' || kind === 'prowl' ? q : 0, at = lerp(a, b, e), toHole = kind === 'carry' || kind === 'drop' || kind === 'turnP' || kind === 'fuss';
      const x = lerp(px, hx, at) + (kind === 'fuss' ? -dirToHole * 9 * S / 30 : kind === 'fuss2' ? dirToHole * 9 * S / 30 : 0);
      let f = toHole ? dirToHole : -dirToHole, P, squeak = 0, hole = 0, coin = kind === 'carry' || kind === 'fuss' || (kind === 'drop' && q < 0.5) || (kind === 'turnP' && q > 0.3);
      const odo = odoOf('rat', odoBase + Math.abs(at - a) * D, S);
      if (kind === 'turnH') { f = dirToHole * turnScale(q); P = thiefPose('rat', 'idle', t, 0, 0); }
      else if (kind === 'turnP') { f = -dirToHole * turnScale(q); P = thiefPose('rat', 'idle', t, 0, 0); }
      else if (kind === 'drop') { P = thiefPose('rat', 'grab', t, q, 0); hole = 1; }
      else if (kind === 'grab') { P = thiefPose('rat', 'grab', t, q, 0); }
      else if (kind === 'fuss' || kind === 'fuss2') { P = thiefPose('rat', kind === 'fuss' ? 'cross' : 'skid', t, q, 0); squeak = win(q * 1.2, 0.2, 0.9, 0.1); }
      else P = thiefPose('rat', kind === 'carry' ? 'carry' : 'prowl', t, 0, odo);
      if (freeze) { P = thiefPose('rat', 'startle', t, 0, 0); squeak = 0; }
      return { x, f, P, squeak, hole: hole * (q > 0.3 ? 1 : 0), coin, lane: ph ? 7 : 0, ph };
    }
    k -= dur; if (kind === 'carry' || kind === 'prowl') odoBase += Math.abs(b - a) * D;
  }
  return { x: px, f: dirToHole, P: thiefPose('rat', 'idle', t, 0, 0), squeak: 0, hole: 0, coin: false, lane: 0, ph };
}

// the registry entry (mapscene.js PLACES)
export const PLACE = { landmarks: LMS, paintBand: paintThievesBand, drawLive: drawThievesLive, drawFront: drawThievesFront, stop: thievesStop, drawLandmark: drawThievesLandmark, drawPlaque: drawThievesPlaque };
