// The world map (2026-11-16, mykee: "one continuous page, wavy path, every world in its own theme, characters placed
// in the scenery and alive"). One tall map, World 1 at the bottom and World 10 at the top, scrolled vertically.
// Each world is a band of land in its own look; the band's top edge is a wavy hill line that overlaps the band above.
// A single winding road (a sine, never straight zig-zags) runs through all 50 stops.
//
// Layout and art only: main.js owns the scroll, the buttons, the hen at the next stop and the gate cards.
// The still part of every band (ground, trees, barns, crystals...) is painted once into an offscreen canvas and blitted;
// only the creatures, smoke, bubbles and sparkles are drawn live, and only for the bands on screen (battery).
import { PERF } from '../perf.js'; // 2026-11-19 Low graphics: the cast is painted 12x a second, not every frame
import { drawMapAmb } from './mapamb.js';
import { drawVillainPortrait } from './villain-art.js';
import { drawRooster, roosterPose, drawGoose, goosePose } from './allies.js';
import { drawChick } from './characters.js';
import { drawSnake } from './snake.js';
import { drawHenAnim } from './hen.js';
import { drawEggFriend } from './title.js';
import { drawCrawler } from './crawlers.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
function rng(seed) { let s = (seed * 9301 + 49297) % 233280 || 1; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }

export const NW = 10, PER = 5;
// per-stop height fractions inside a band (bottom to top); the strip under the first stop holds the world sign / gate
const STOP_FY = [0.84, 0.665, 0.49, 0.315, 0.14];

// ------------------------------------------------------------------ the look of each world
// ground: band top/bottom colours; road: fill, edge, dash; sky: whether the band's upper part is sky (open worlds)
export const WORLD_LOOK = [
  { name: 'The Farm', ground: ['#9bd86a', '#5fae45'], hill: '#b4e27c', road: ['#ecd29a', '#a8783e', 'rgba(255,255,255,0.6)'], accent: '#ee8a2a' },
  { name: 'Wild Woods', ground: ['#5aa04a', '#2f6e34'], hill: '#6db357', road: ['#c99a62', '#6e4622', 'rgba(255,240,200,0.5)'], accent: '#3f9a4a' },
  { name: 'Frozen Lake', ground: ['#f4fbff', '#c6e2f4'], hill: '#ffffff', road: ['#bfe0f5', '#5f95bf', 'rgba(255,255,255,0.85)'], accent: '#3c8fd0' },
  { name: 'Crystal Caves', ground: ['#5a4592', '#2c2156'], hill: '#6c55a8', road: ['#9a86d6', '#3e2f78', 'rgba(255,240,255,0.6)'], accent: '#8a5ad8' },
  { name: 'Volcano', ground: ['#6a3424', '#2c130d'], hill: '#7c4030', road: ['#4a3a36', '#1a100c', 'rgba(255,150,60,0.7)'], accent: '#e2532a' },
  { name: 'Storm Peaks', ground: ['#8aa0bf', '#4a5e80'], hill: '#a0b4cf', road: ['#c7cfd9', '#4e5a6c', 'rgba(255,255,255,0.6)'], accent: '#5a72a8' },
  { name: 'The Thieves’ Vault', ground: ['#8a7456', '#43341f'], hill: '#9c855f', road: ['#b8a07a', '#5a4528', 'rgba(255,220,120,0.6)'], accent: '#c89a2a' },
  { name: 'Coral Reef', ground: ['#3fbde0', '#145a94'], hill: '#5ccbe8', road: ['#f2deaa', '#b08a4a', 'rgba(255,255,255,0.6)'], accent: '#1f9ad0' },
  { name: 'Gator Bayou', ground: ['#6e9550', '#2c4a2a'], hill: '#7fa85c', road: ['#a07a4a', '#4e3418', 'rgba(255,230,170,0.5)'], accent: '#5a8a3a' },
  { name: 'Shape Lab', ground: ['#3f5684', '#1c2742'], hill: '#4e679a', road: ['#c3cddd', '#5a6880', 'rgba(120,200,255,0.8)'], accent: '#4aa0e0' },
];

// ------------------------------------------------------------------ layout
// L = mapLayout({ W, A, u, n }): bandH, total height H, band tops, the road's x at any map y, every stop's (x, y),
// and place() for scenery: a spot beside the road (never on it).
export function mapLayout(o) {
  const { A, u } = o, n = o.n || NW * PER;
  const nw = Math.ceil(n / PER);
  const BH = Math.round(A.w > A.h * 1.25 ? clamp(540 * u, 480, 900) : clamp(Math.max(640 * u, (A.h - 200 * u) * 0.95), 560, 1100)); // landscape: shorter worlds, more stops on screen
  const TOP = 230 * u, BOT = 120 * u; // room above World 10 (the summit) and below World 1 (the start)
  const H = TOP + nw * BH + BOT;
  const cx = A.x + A.w / 2;
  const amp = A.w > A.h * 1.25 ? Math.min(A.w * 0.24, 260 * u) : Math.min(A.w * 0.19, 150 * u), period = BH * 0.7;
  const roadW = 30 * u, stopR = clamp(Math.min(A.w * 0.085, 34 * u), 24 * u, 40 * u);
  const bandTop = (w) => TOP + (nw - 1 - w) * BH;
  const pathX = (y) => cx + amp * Math.sin(((H - y) / period) * TAU + 0.5);
  const stops = [];
  for (let i = 0; i < n; i++) { const w = Math.floor(i / PER), k = i % PER, y = bandTop(w) + BH * STOP_FY[k]; stops.push({ x: pathX(y), y, w, k }); }
  const clear = roadW * 0.5 + stopR + 14 * u;
  // a spot for a prop of height h whose foot is at fy (0 = band top, 1 = band bottom): left or right of the road,
  // whichever side has more room unless asked; fx 0..1 across that free strip
  function place(w, fy, side, fx = 0.5, h = 60 * u, wHalf = 30 * u) {
    const y = bandTop(w) + fy * BH;
    let lo = Infinity, hi = -Infinity;
    for (let q = 0; q <= 4; q++) { const px = pathX(y - (h * q) / 4); lo = Math.min(lo, px); hi = Math.max(hi, px); }
    const L0 = A.x + wHalf * 0.55, L1 = lo - clear - wHalf, R0 = hi + clear + wHalf, R1 = A.x1 - wHalf * 0.55; // a big prop may run a little off the screen edge
    const roomL = L1 - L0, roomR = R1 - R0;
    let s = side === 'L' ? -1 : side === 'R' ? 1 : roomR > roomL ? 1 : -1;
    if (s < 0 && roomL < 0 && roomR > roomL) s = 1; else if (s > 0 && roomR < 0 && roomL > roomR) s = -1;
    const a = s < 0 ? L0 : R0, b = s < 0 ? L1 : R1;
    const x = b >= a ? lerp(a, b, s < 0 ? 1 - fx : fx) : (a + b) / 2;
    return { x, y, side: s, room: Math.max(0, b - a) + 2 * wHalf, fit: b >= a };
  }
  return { BH, H, TOP, BOT, nw, n, amp, period, roadW, stopR, bandTop, pathX, stops, place, u, A, cx, W: o.W };
}

// ------------------------------------------------------------------ painting kit (static)
function shadow(c, x, y, rx, ry, a = 0.22) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fillStyle = `rgba(20,10,0,${a})`; c.fill(); }
function lg(c, x0, y0, x1, y1, stops) { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s)); return g; }
function blobAt(c, x, y, r, col) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = col; c.fill(); }

function tree(c, x, y, s, k = {}) { // a round leafy tree: trunk, three-lobed crown, a lit side
  shadow(c, x, y, s * 0.42, s * 0.1);
  c.fillStyle = k.trunk || '#7a4a24'; c.beginPath(); c.moveTo(x - s * 0.07, y); c.lineTo(x - s * 0.05, y - s * 0.45); c.lineTo(x + s * 0.05, y - s * 0.45); c.lineTo(x + s * 0.08, y); c.closePath(); c.fill();
  const lo = k.lo || '#3d8a34', mid = k.mid || '#55a83f', hi = k.hi || '#86cc5a';
  for (const [dx, dy, r, col] of [[-0.2, -0.55, 0.28, lo], [0.2, -0.56, 0.27, lo], [0, -0.78, 0.3, lo], [-0.16, -0.6, 0.25, mid], [0.16, -0.62, 0.24, mid], [0, -0.8, 0.26, mid], [-0.08, -0.84, 0.15, hi], [-0.2, -0.66, 0.1, hi]]) blobAt(c, x + dx * s, y + dy * s, r * s, col);
  if (k.fruit) for (const [dx, dy] of [[-0.16, -0.62], [0.14, -0.7], [0.02, -0.9], [0.22, -0.52]]) blobAt(c, x + dx * s, y + dy * s, s * 0.045, k.fruit);
}
function pine(c, x, y, s, k = {}) {
  shadow(c, x, y, s * 0.3, s * 0.08);
  c.fillStyle = k.trunk || '#5a3a1e'; c.fillRect(x - s * 0.05, y - s * 0.18, s * 0.1, s * 0.18);
  const tiers = 3;
  for (let i = 0; i < tiers; i++) {
    const w = s * (0.42 - i * 0.1), yb = y - s * (0.14 + i * 0.26), yt = yb - s * 0.42;
    c.beginPath(); c.moveTo(x - w, yb); c.quadraticCurveTo(x, yb + s * 0.06, x + w, yb); c.lineTo(x, yt); c.closePath();
    c.fillStyle = lg(c, x - w, yt, x + w, yb, [k.hi || '#4f9a58', k.lo || '#245a34']); c.fill();
    if (k.snow) { c.beginPath(); c.moveTo(x - w * 0.55, yt + (yb - yt) * 0.55); c.quadraticCurveTo(x, yt + (yb - yt) * 0.4, x + w * 0.5, yt + (yb - yt) * 0.6); c.lineTo(x, yt); c.closePath(); c.fillStyle = '#ffffff'; c.fill(); }
  }
}
function bush(c, x, y, s, col = '#4f9a3a', hi = '#7cc458') { shadow(c, x, y, s * 0.5, s * 0.1, 0.18); for (const [dx, dy, r, cc] of [[-0.25, -0.2, 0.25, col], [0.25, -0.2, 0.25, col], [0, -0.32, 0.3, col], [-0.08, -0.4, 0.13, hi]]) blobAt(c, x + dx * s, y + dy * s, r * s, cc); }
function rock(c, x, y, s, col = '#8a8a94', hi = '#b4b4bf') {
  shadow(c, x, y, s * 0.55, s * 0.12);
  c.beginPath(); c.moveTo(x - s * 0.5, y); c.quadraticCurveTo(x - s * 0.52, y - s * 0.4, x - s * 0.1, y - s * 0.5); c.quadraticCurveTo(x + s * 0.4, y - s * 0.55, x + s * 0.52, y); c.closePath();
  c.fillStyle = lg(c, x, y - s * 0.5, x, y, [hi, col]); c.fill();
}
function grassTufts(c, w, x0, y0, x1, y1, n, col, seed) {
  const R = rng(seed); c.strokeStyle = col; c.lineCap = 'round';
  for (let i = 0; i < n; i++) { const x = lerp(x0, x1, R()), y = lerp(y0, y1, R()), s = 4 + R() * 5; c.lineWidth = 2; c.beginPath(); c.moveTo(x - s * 0.5, y); c.lineTo(x - s * 0.7, y - s); c.moveTo(x, y); c.lineTo(x, y - s * 1.3); c.moveTo(x + s * 0.5, y); c.lineTo(x + s * 0.8, y - s); c.stroke(); }
}
function flowers(c, x0, y0, x1, y1, n, cols, seed, u) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) { const x = lerp(x0, x1, R()), y = lerp(y0, y1, R()), r = (2 + R() * 1.6) * u; c.fillStyle = cols[i % cols.length]; for (let p = 0; p < 5; p++) blobAt(c, x + Math.cos(p * 1.256) * r, y + Math.sin(p * 1.256) * r, r * 0.7, cols[i % cols.length]); blobAt(c, x, y, r * 0.55, '#fff2a0'); }
}
function barn(c, x, y, s) {
  shadow(c, x, y + s * 0.02, s * 0.6, s * 0.1);
  c.fillStyle = '#b83228'; c.beginPath(); c.moveTo(x - s * 0.45, y); c.lineTo(x - s * 0.45, y - s * 0.45); c.lineTo(x - s * 0.3, y - s * 0.68); c.lineTo(x + s * 0.3, y - s * 0.68); c.lineTo(x + s * 0.45, y - s * 0.45); c.lineTo(x + s * 0.45, y); c.closePath(); c.fill();
  c.fillStyle = '#d6463a'; c.fillRect(x - s * 0.45, y - s * 0.45, s * 0.42, s * 0.45);
  c.fillStyle = '#6b2a1a'; c.beginPath(); c.moveTo(x - s * 0.52, y - s * 0.43); c.lineTo(x - s * 0.32, y - s * 0.74); c.lineTo(x + s * 0.32, y - s * 0.74); c.lineTo(x + s * 0.52, y - s * 0.43); c.lineTo(x + s * 0.44, y - s * 0.43); c.lineTo(x + s * 0.27, y - s * 0.66); c.lineTo(x - s * 0.27, y - s * 0.66); c.lineTo(x - s * 0.44, y - s * 0.43); c.closePath(); c.fill();
  c.fillStyle = '#fff1d6'; c.fillRect(x - s * 0.16, y - s * 0.34, s * 0.32, s * 0.34); c.fillStyle = '#8a2a1e'; c.fillRect(x - s * 0.13, y - s * 0.31, s * 0.26, s * 0.31);
  c.strokeStyle = '#fff1d6'; c.lineWidth = s * 0.025; c.beginPath(); c.moveTo(x - s * 0.13, y - s * 0.31); c.lineTo(x + s * 0.13, y); c.moveTo(x + s * 0.13, y - s * 0.31); c.lineTo(x - s * 0.13, y); c.stroke();
  c.fillStyle = '#fff1d6'; c.beginPath(); c.arc(x, y - s * 0.52, s * 0.07, 0, TAU); c.fill(); c.fillStyle = '#3a1a10'; c.beginPath(); c.arc(x, y - s * 0.52, s * 0.05, 0, TAU); c.fill();
}
function hay(c, x, y, s) {
  shadow(c, x, y, s * 0.5, s * 0.1);
  c.beginPath(); c.moveTo(x - s * 0.48, y); c.quadraticCurveTo(x - s * 0.5, y - s * 0.62, x, y - s * 0.66); c.quadraticCurveTo(x + s * 0.5, y - s * 0.62, x + s * 0.48, y); c.closePath();
  c.fillStyle = lg(c, x, y - s * 0.66, x, y, ['#ffe27a', '#e0a83a']); c.fill();
  c.strokeStyle = 'rgba(160,100,20,0.55)'; c.lineWidth = Math.max(1, s * 0.02); for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(x + i * s * 0.12, y - s * 0.05); c.quadraticCurveTo(x + i * s * 0.1, y - s * 0.4, x + i * s * 0.05, y - s * 0.6); c.stroke(); }
}
function fence(c, x, y, len, s) {
  c.fillStyle = '#c99a5a'; c.strokeStyle = '#7a5226'; c.lineWidth = Math.max(1, s * 0.05);
  const n = Math.max(2, Math.round(len / (s * 0.9)));
  for (let i = 0; i <= n; i++) { const px = x + (i / n) * len; c.fillRect(px - s * 0.07, y - s * 0.7, s * 0.14, s * 0.7); }
  c.fillRect(x, y - s * 0.55, len, s * 0.1); c.fillRect(x, y - s * 0.3, len, s * 0.1);
}
function windmill(c, x, y, s) { // the tower (static); the sails turn in the live layer
  shadow(c, x, y, s * 0.4, s * 0.08);
  c.beginPath(); c.moveTo(x - s * 0.25, y); c.lineTo(x - s * 0.14, y - s * 0.95); c.lineTo(x + s * 0.14, y - s * 0.95); c.lineTo(x + s * 0.25, y); c.closePath(); c.fillStyle = lg(c, x - s * 0.25, 0, x + s * 0.25, 0, ['#f4e6c8', '#c9b48c']); c.fill();
  c.fillStyle = '#8a3a2a'; c.beginPath(); c.moveTo(x - s * 0.2, y - s * 0.92); c.lineTo(x, y - s * 1.14); c.lineTo(x + s * 0.2, y - s * 0.92); c.closePath(); c.fill();
  c.fillStyle = '#6b3a1a'; c.fillRect(x - s * 0.07, y - s * 0.22, s * 0.14, s * 0.22);
}
function mushroom(c, x, y, s, cap = '#d8402e') {
  shadow(c, x, y, s * 0.35, s * 0.08);
  c.fillStyle = '#f6ead2'; c.beginPath(); c.moveTo(x - s * 0.12, y); c.quadraticCurveTo(x - s * 0.14, y - s * 0.35, x - s * 0.1, y - s * 0.45); c.lineTo(x + s * 0.1, y - s * 0.45); c.quadraticCurveTo(x + s * 0.14, y - s * 0.35, x + s * 0.12, y); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(x - s * 0.42, y - s * 0.42); c.quadraticCurveTo(x - s * 0.4, y - s * 0.86, x, y - s * 0.88); c.quadraticCurveTo(x + s * 0.4, y - s * 0.86, x + s * 0.42, y - s * 0.42); c.closePath(); c.fillStyle = lg(c, x, y - s * 0.88, x, y - s * 0.42, [cap, '#8a1e18']); c.fill();
  for (const [dx, dy, r] of [[-0.2, -0.6, 0.07], [0.12, -0.72, 0.08], [0.24, -0.52, 0.05], [-0.04, -0.52, 0.05]]) blobAt(c, x + dx * s, y + dy * s, r * s, '#fff4e6');
}
function snowman(c, x, y, s) {
  shadow(c, x, y, s * 0.35, s * 0.08);
  blobAt(c, x, y - s * 0.25, s * 0.27, '#ffffff'); blobAt(c, x, y - s * 0.62, s * 0.19, '#ffffff');
  c.strokeStyle = 'rgba(120,170,210,0.6)'; c.lineWidth = s * 0.02; c.beginPath(); c.arc(x, y - s * 0.25, s * 0.27, 0.2, 2.6); c.stroke(); c.beginPath(); c.arc(x, y - s * 0.62, s * 0.19, 0.2, 2.6); c.stroke();
  blobAt(c, x - s * 0.06, y - s * 0.66, s * 0.025, '#2a1a10'); blobAt(c, x + s * 0.06, y - s * 0.66, s * 0.025, '#2a1a10');
  c.fillStyle = '#f08a1e'; c.beginPath(); c.moveTo(x, y - s * 0.62); c.lineTo(x + s * 0.18, y - s * 0.6); c.lineTo(x, y - s * 0.58); c.closePath(); c.fill();
  c.fillStyle = '#d8402e'; c.fillRect(x - s * 0.18, y - s * 0.48, s * 0.36, s * 0.07); c.fillRect(x + s * 0.06, y - s * 0.48, s * 0.07, s * 0.2);
  c.fillStyle = '#2a2a34'; c.fillRect(x - s * 0.14, y - s * 0.84, s * 0.28, s * 0.05); c.fillRect(x - s * 0.1, y - s * 1.02, s * 0.2, s * 0.19);
}
function crystal(c, x, y, s, col = '#b07af0', hi = '#f0d8ff') {
  shadow(c, x, y, s * 0.4, s * 0.08, 0.3);
  for (const [dx, h, w, a] of [[-0.22, 0.6, 0.12, -0.25], [0.2, 0.7, 0.13, 0.22], [0, 1, 0.16, 0]]) {
    c.save(); c.translate(x + dx * s, y); c.rotate(a);
    c.beginPath(); c.moveTo(-w * s, 0); c.lineTo(-w * s, -h * s * 0.75); c.lineTo(0, -h * s); c.lineTo(w * s, -h * s * 0.75); c.lineTo(w * s, 0); c.closePath(); c.fillStyle = lg(c, -w * s, 0, w * s, 0, [hi, col, '#5a2aa0']); c.fill();
    c.beginPath(); c.moveTo(0, -h * s); c.lineTo(0, 0); c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = Math.max(1, s * 0.02); c.stroke();
    c.restore();
  }
}
function stalag(c, x, y, s, col) { c.beginPath(); c.moveTo(x - s * 0.2, y); c.quadraticCurveTo(x - s * 0.05, y - s * 0.6, x, y - s); c.quadraticCurveTo(x + s * 0.05, y - s * 0.6, x + s * 0.2, y); c.closePath(); c.fillStyle = col; c.fill(); }
function volcano(c, x, y, s) {
  c.beginPath(); c.moveTo(x - s * 0.75, y); c.quadraticCurveTo(x - s * 0.3, y - s * 0.5, x - s * 0.16, y - s * 0.8); c.lineTo(x + s * 0.16, y - s * 0.8); c.quadraticCurveTo(x + s * 0.3, y - s * 0.5, x + s * 0.75, y); c.closePath();
  c.fillStyle = lg(c, x, y - s * 0.8, x, y, ['#5a3026', '#2a120c']); c.fill();
  c.fillStyle = '#ff7a1e'; for (const [dx, l] of [[-0.06, 0.32], [0.08, 0.48], [0.0, 0.22]]) { c.beginPath(); c.moveTo(x + dx * s - s * 0.03, y - s * 0.8); c.quadraticCurveTo(x + dx * s + s * 0.04, y - s * (0.8 - l * 0.5), x + dx * s, y - s * (0.8 - l)); c.lineTo(x + dx * s + s * 0.05, y - s * 0.8); c.closePath(); c.fill(); }
  c.beginPath(); c.ellipse(x, y - s * 0.8, s * 0.16, s * 0.04, 0, 0, TAU); c.fillStyle = '#ffb02a'; c.fill();
}
function peak(c, x, y, s, col = '#6a7c98', snow = true) {
  c.beginPath(); c.moveTo(x - s * 0.6, y); c.lineTo(x - s * 0.08, y - s); c.lineTo(x + s * 0.05, y - s * 0.9); c.lineTo(x + s * 0.6, y); c.closePath(); c.fillStyle = lg(c, x - s * 0.6, 0, x + s * 0.6, 0, ['#a6b4c8', col, '#3e4a60']); c.fill();
  if (snow) { c.beginPath(); c.moveTo(x - s * 0.28, y - s * 0.55); c.lineTo(x - s * 0.08, y - s); c.lineTo(x + s * 0.05, y - s * 0.9); c.lineTo(x + s * 0.24, y - s * 0.6); c.lineTo(x + s * 0.08, y - s * 0.66); c.lineTo(x - s * 0.04, y - s * 0.56); c.lineTo(x - s * 0.16, y - s * 0.64); c.closePath(); c.fillStyle = '#f4f8ff'; c.fill(); }
}
function vaultDoor(c, x, y, s) {
  shadow(c, x, y, s * 0.5, s * 0.08);
  c.fillStyle = '#5a4a3a'; c.fillRect(x - s * 0.5, y - s * 0.95, s, s * 0.95);
  c.beginPath(); c.arc(x, y - s * 0.47, s * 0.4, 0, TAU); c.fillStyle = lg(c, x - s * 0.4, y - s * 0.87, x + s * 0.4, y - s * 0.07, ['#e0c070', '#9a7424']); c.fill();
  c.beginPath(); c.arc(x, y - s * 0.47, s * 0.3, 0, TAU); c.strokeStyle = '#6a4c14'; c.lineWidth = s * 0.03; c.stroke();
  c.strokeStyle = '#4a3410'; c.lineWidth = s * 0.05; for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + 0.3; c.beginPath(); c.moveTo(x, y - s * 0.47); c.lineTo(x + Math.cos(a) * s * 0.22, y - s * 0.47 + Math.sin(a) * s * 0.22); c.stroke(); }
  blobAt(c, x, y - s * 0.47, s * 0.07, '#4a3410');
}
function coins(c, x, y, s) { for (const [dx, dy] of [[-0.2, 0], [0, 0], [0.2, 0], [-0.1, -0.12], [0.1, -0.12], [0, -0.24]]) { c.beginPath(); c.ellipse(x + dx * s, y + dy * s, s * 0.12, s * 0.07, 0, 0, TAU); c.fillStyle = '#f2c43a'; c.fill(); c.strokeStyle = '#a2740e'; c.lineWidth = Math.max(1, s * 0.02); c.stroke(); } }
function crate(c, x, y, s) { shadow(c, x, y, s * 0.4, s * 0.07); c.fillStyle = '#b07a3e'; c.fillRect(x - s * 0.3, y - s * 0.55, s * 0.6, s * 0.55); c.strokeStyle = '#6a4418'; c.lineWidth = s * 0.05; c.strokeRect(x - s * 0.3, y - s * 0.55, s * 0.6, s * 0.55); c.beginPath(); c.moveTo(x - s * 0.3, y - s * 0.55); c.lineTo(x + s * 0.3, y); c.stroke(); }
function coral(c, x, y, s, col = '#ff6a7a') {
  c.strokeStyle = col; c.lineCap = 'round';
  const br = (bx, by, a, l, w, d) => { const ex = bx + Math.cos(a) * l, ey = by + Math.sin(a) * l; c.lineWidth = w; c.beginPath(); c.moveTo(bx, by); c.lineTo(ex, ey); c.stroke(); if (d > 0) { br(ex, ey, a - 0.5, l * 0.7, w * 0.75, d - 1); br(ex, ey, a + 0.45, l * 0.65, w * 0.75, d - 1); } else blobAt(c, ex, ey, w * 0.7, col); };
  br(x, y, -Math.PI / 2, s * 0.35, s * 0.12, 2);
}
function cypress(c, x, y, s) {
  c.fillStyle = '#5a4430'; c.beginPath(); c.moveTo(x - s * 0.22, y); c.quadraticCurveTo(x - s * 0.06, y - s * 0.3, x - s * 0.06, y - s * 0.9); c.lineTo(x + s * 0.06, y - s * 0.9); c.quadraticCurveTo(x + s * 0.06, y - s * 0.3, x + s * 0.22, y); c.closePath(); c.fill();
  for (const [dx, dy, r] of [[-0.25, -0.85, 0.24], [0.25, -0.88, 0.22], [0, -1.02, 0.26], [-0.1, -0.78, 0.2]]) blobAt(c, x + dx * s, y + dy * s, r * s, '#4a6a32');
  c.strokeStyle = 'rgba(160,180,140,0.75)'; c.lineWidth = Math.max(1, s * 0.02); for (const dx of [-0.3, -0.1, 0.15, 0.32]) { c.beginPath(); c.moveTo(x + dx * s, y - s * 0.75); c.quadraticCurveTo(x + dx * s + s * 0.03, y - s * 0.55, x + dx * s, y - s * 0.4); c.stroke(); }
}
function pond(c, x, y, rx, ry, cols) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fillStyle = cols[2] || 'rgba(0,0,0,0.15)'; c.fill(); c.beginPath(); c.ellipse(x, y - ry * 0.06, rx * 0.95, ry * 0.88, 0, 0, TAU); c.fillStyle = lg(c, x, y - ry, x, y + ry, [cols[0], cols[1]]); c.fill(); }
function lily(c, x, y, s) { c.beginPath(); c.ellipse(x, y, s * 0.5, s * 0.22, 0, 0.25, TAU - 0.25); c.lineTo(x, y); c.closePath(); c.fillStyle = '#5aa83a'; c.fill(); }
function gear(c, x, y, r, col = '#8a9ab8', teeth = 10, rot = 0) {
  c.save(); c.translate(x, y); c.rotate(rot); c.beginPath();
  for (let i = 0; i < teeth * 2; i++) { const a = (i / (teeth * 2)) * TAU, rr = i % 2 ? r : r * 1.18; c.lineTo(Math.cos(a - 0.08) * rr, Math.sin(a - 0.08) * rr); c.lineTo(Math.cos(a + 0.08) * rr, Math.sin(a + 0.08) * rr); }
  c.closePath(); c.fillStyle = col; c.fill(); c.beginPath(); c.arc(0, 0, r * 0.35, 0, TAU); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fill(); c.restore();
}
function beaker(c, x, y, s, liq = '#6aff9a') {
  shadow(c, x, y, s * 0.3, s * 0.06);
  c.beginPath(); c.moveTo(x - s * 0.08, y - s * 0.7); c.lineTo(x - s * 0.08, y - s * 0.42); c.lineTo(x - s * 0.3, y); c.lineTo(x + s * 0.3, y); c.lineTo(x + s * 0.08, y - s * 0.42); c.lineTo(x + s * 0.08, y - s * 0.7); c.closePath(); c.fillStyle = 'rgba(220,240,255,0.35)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = Math.max(1, s * 0.03); c.stroke();
  c.beginPath(); c.moveTo(x - s * 0.18, y - s * 0.2); c.lineTo(x - s * 0.28, y - s * 0.02); c.lineTo(x + s * 0.28, y - s * 0.02); c.lineTo(x + s * 0.18, y - s * 0.2); c.closePath(); c.fillStyle = liq; c.fill();
}
function cloud(c, x, y, s, col = 'rgba(255,255,255,0.9)') { for (const [dx, dy, r] of [[-0.35, 0, 0.28], [0, -0.14, 0.36], [0.36, 0, 0.27], [0, 0.06, 0.3]]) blobAt(c, x + dx * s, y + dy * s, r * s, col); }
function nest(c, x, y, s) {
  c.beginPath(); c.ellipse(x, y, s * 0.55, s * 0.2, 0, 0, TAU); c.fillStyle = '#8a5a26'; c.fill();
  c.strokeStyle = '#c99550'; c.lineWidth = Math.max(1, s * 0.03); const R = rng(7);
  for (let i = 0; i < 14; i++) { const a = R() * Math.PI, b = a + 0.6 + R() * 0.8; c.beginPath(); c.ellipse(x, y - s * 0.02, s * (0.4 + R() * 0.15), s * (0.12 + R() * 0.06), 0, a, b); c.stroke(); }
}

// ------------------------------------------------------------------ per-world scenery and cast
// Each entry: [kind, fy (foot, 0 top .. 1 bottom of the band), side ('L' | 'R' | 'A' auto), fx, size (x u)]
// still: painted once; live: creatures and moving bits, drawn every frame for bands on screen.
const STILL = [
  [['barn', 0.93, 'A', 0.5, 120], ['tree', 0.76, 'A', 0.35, 110, { fruit: '#e8402e' }], ['hay', 0.58, 'A', 0.6, 62], ['windmill', 0.41, 'A', 0.5, 120], ['tree', 0.24, 'A', 0.6, 100, { fruit: '#ffb02a' }], ['fence', 0.1, 'A', 0.5, 40]],
  [['tree', 0.95, 'A', 0.4, 120, { lo: '#2e6e2c', mid: '#3f8a34', hi: '#6ab04a' }], ['pine', 0.78, 'A', 0.55, 120], ['mushroom', 0.6, 'A', 0.5, 56], ['pine', 0.43, 'A', 0.3, 110], ['bush', 0.3, 'A', 0.7, 60], ['mushroom', 0.12, 'A', 0.5, 46, '#e8a02a']],
  [['pine', 0.95, 'A', 0.5, 120, { snow: 1, hi: '#5a9a8a', lo: '#2a5a54' }], ['lake', 0.72, 'A', 0.5, 70], ['snowman', 0.48, 'A', 0.55, 70], ['pine', 0.3, 'A', 0.35, 100, { snow: 1, hi: '#5a9a8a', lo: '#2a5a54' }], ['pine', 0.12, 'A', 0.6, 90, { snow: 1, hi: '#5a9a8a', lo: '#2a5a54' }]],
  [['crystal', 0.94, 'A', 0.5, 90], ['stalag', 0.76, 'A', 0.4, 80], ['crystal', 0.56, 'A', 0.6, 70, '#5ad0e0', '#d8fbff'], ['crystal', 0.36, 'A', 0.45, 100, '#f07ad0', '#ffe0f6'], ['stalag', 0.15, 'A', 0.6, 90]],
  [['volcano', 0.94, 'A', 0.5, 170], ['rock', 0.72, 'A', 0.5, 60, '#3a2420', '#6a4034'], ['lava', 0.5, 'A', 0.5, 70], ['rock', 0.3, 'A', 0.6, 70, '#3a2420', '#6a4034'], ['rock', 0.12, 'A', 0.4, 50, '#3a2420', '#6a4034']],
  [['peak', 0.95, 'A', 0.5, 170], ['rock', 0.74, 'A', 0.5, 66, '#5a6578', '#9aa6b8'], ['peak', 0.5, 'A', 0.5, 130], ['rock', 0.3, 'A', 0.5, 56, '#5a6578', '#9aa6b8'], ['peak', 0.12, 'A', 0.6, 110]],
  [['vault', 0.95, 'A', 0.5, 110], ['coins', 0.74, 'A', 0.55, 60], ['crate', 0.56, 'A', 0.4, 64], ['coins', 0.36, 'A', 0.6, 50], ['crate', 0.16, 'A', 0.5, 56]],
  [['coral', 0.95, 'A', 0.4, 110], ['weed', 0.78, 'A', 0.6, 90], ['coral', 0.56, 'A', 0.5, 90, '#ffb03a'], ['rock', 0.36, 'A', 0.5, 60, '#2a6a8a', '#5aa0c0'], ['coral', 0.15, 'A', 0.55, 90, '#b86af0']],
  [['cypress', 0.95, 'A', 0.5, 130], ['swamp', 0.72, 'A', 0.5, 80], ['cypress', 0.5, 'A', 0.6, 110], ['swamp', 0.3, 'A', 0.5, 70], ['cypress', 0.12, 'A', 0.4, 100]],
  [['beaker', 0.93, 'A', 0.5, 70], ['gearS', 0.72, 'A', 0.5, 50], ['beaker', 0.52, 'A', 0.55, 60, '#ff7ad0'], ['gearS', 0.3, 'A', 0.5, 40], ['beaker', 0.12, 'A', 0.5, 56, '#7ad0ff']],
];
// live cast: placed on the other side of the road from the still props at about the same height where possible
const CAST = [
// (no hen on a nest here: the hen at the next stop is THE hen; a second one read as a duplicate, mykee 2026-11-16)
  [['rooster', 0.7, 'A', 0.5, 100], ['weaselHay', 0.52, 'A', 0.6, 80], ['chicks', 0.34, 'A', 0.5, 90], ['goose', 0.18, 'A', 0.5, 96]],
  [['snakeBranch', 0.86, 'A', 0.5, 120], ['chicks', 0.62, 'A', 0.5, 80], ['snake', 0.42, 'A', 0.5, 120], ['butterflies', 0.2, 'A', 0.5, 70]],
  [['gecko', 0.86, 'A', 0.5, 130], ['skater', 0.66, 'A', 0.5, 100], ['rooster', 0.42, 'A', 0.5, 96], ['snowfall', 0.22, 'A', 0.5, 80]],
  [['rats', 0.86, 'A', 0.5, 140], ['spike', 0.6, 'A', 0.5, 140], ['sparkle', 0.4, 'A', 0.5, 70], ['rats', 0.22, 'A', 0.5, 120]],
  [['salamander', 0.84, 'A', 0.5, 150], ['embers', 0.6, 'A', 0.5, 80], ['salamander', 0.36, 'A', 0.5, 120], ['smoke', 0.06, 'A', 0.5, 80]],
  [['chameleon', 0.84, 'A', 0.5, 140], ['eagle', 0.62, 'A', 0.5, 130], ['goose', 0.36, 'A', 0.5, 90], ['bolt', 0.24, 'A', 0.5, 70]],
  [['weasel', 0.84, 'A', 0.5, 140], ['rats', 0.6, 'A', 0.5, 130], ['rooster', 0.38, 'A', 0.5, 96], ['weasel', 0.18, 'A', 0.5, 120]],
  [['puffer', 0.84, 'A', 0.5, 110], ['fish', 0.64, 'A', 0.5, 130], ['hermit', 0.46, 'A', 0.5, 120], ['jelly', 0.28, 'A', 0.5, 110], ['bubbles', 0.1, 'A', 0.5, 60]],
  [['gator', 0.86, 'A', 0.5, 160], ['turtle', 0.62, 'A', 0.5, 130], ['frog', 0.42, 'A', 0.5, 110], ['mosquito', 0.22, 'A', 0.5, 100]],
  [['spider', 0.84, 'A', 0.5, 120], ['beetle', 0.62, 'A', 0.5, 130], ['jack', 0.4, 'A', 0.5, 120], ['gearLive', 0.18, 'A', 0.5, 90]],
];

// Where everything in a band goes, worked out once per layout: the cast first (they are the stars), then the still
// props; each tries its height and the roomier side of the road, then the other side, then a little up or down, and
// is left out rather than drawn over something else. Boxes: x +- half, foot y, height h.
const TALL = { barn: 0.8, tree: 1.05, pine: 1.25, hay: 0.7, windmill: 1.2, fence: 0.75, mushroom: 0.9, bush: 0.45, lake: 0.75, snowman: 1.05, crystal: 1, stalag: 1, volcano: 0.95, rock: 0.55, lava: 0.6, peak: 1, vault: 0.95, coins: 0.35, crate: 0.6, coral: 1, weed: 0.95, cypress: 1.25, swamp: 0.55, beaker: 0.75, gearS: 1,
  henNest: 1.15, rooster: 1.05, goose: 0.8, weaselHay: 0.75, chicks: 0.4, snakeBranch: 1.75, snake: 0.4, butterflies: 0.8, gecko: 0.9, skater: 0.5, snowfall: 1.6, rats: 0.6, spike: 0.75, sparkle: 0.9, salamander: 0.85, embers: 1.2, smoke: 1.8, eagle: 1.3, chameleon: 0.85, bolt: 1.9, weasel: 0.75, puffer: 1, fish: 0.9, hermit: 0.75, jelly: 1.1, bubbles: 1.6, gator: 0.75, turtle: 0.65, frog: 0.75, mosquito: 1, spider: 1.45, beetle: 0.6, jack: 0.85, gearLive: 0.85 };
const WIDE = { barn: 0.55, windmill: 0.6, fence: 0.62, lake: 1.15, lava: 0.95, volcano: 0.78, peak: 0.62, swamp: 1.05, snakeBranch: 0.85, chicks: 0.7, henNest: 0.55, rats: 0.55, weasel: 0.6, fish: 0.6, gator: 0.8, eagle: 0.8, snake: 0.7 };
const AIRY = { eagle: 1, snowfall: 1, sparkle: 1, embers: 1, smoke: 1, butterflies: 1, bubbles: 1, bolt: 1 }; // effects: may sit over other things
function bandLayout(L, w) {
  L._bl = L._bl || {};
  if (L._bl[w]) return L._bl[w];
  const u = L.u, boxes = [], out = { still: [], cast: [] };
  const sign = MS_SIGN(L, w);
  boxes.push(sign);
  const BIG = { barn: 1, windmill: 1, volcano: 1, peak: 1, vault: 1, cypress: 1, lake: 1, lava: 1, swamp: 1 };
  const still = (STILL[w] || []).map((e, i) => ['still', e, i]);
  const items = [...still.filter((q) => BIG[q[1][0]]), ...(CAST[w] || []).map((e, i) => ['cast', e, i]), ...still.filter((q) => !BIG[q[1][0]])]; // the set pieces, the cast, then the small props
  for (const [kind2, e, i] of items) {
    const k = e[0], airy = !!AIRY[k];
    let got = null;
    for (const sc of [1, 0.84, 0.7, 0.58]) {
      const s = e[4] * u * sc, h = s * (TALL[k] || 0.9), half = s * (WIDE[k] || 0.45);
      for (const dy of [0, -0.05, 0.05, -0.1, 0.1, -0.15]) {
        const fy = clamp(e[1] + dy, 0.08, 0.99);
        const p0 = L.place(w, fy, null, e[3], h, half);
        for (const p of [p0, L.place(w, fy, p0.side > 0 ? 'L' : 'R', e[3], h, half)]) {
          if (!p.fit) continue;
          const b = { x0: p.x - half, x1: p.x + half, y0: p.y - h, y1: p.y };
          if (b.y0 < L.bandTop(w) - 40 * u) continue;
          if (!airy && boxes.some((q) => b.x0 < q.x1 + 4 * u && b.x1 > q.x0 - 4 * u && b.y0 < q.y1 + 2 * u && b.y1 > q.y0 - 2 * u)) continue;
          got = { x: p.x, y: p.y, s, side: p.side, box: b }; break;
        }
        if (got) break;
      }
      if (got) break;
    }
    if (got && !airy) boxes.push(got.box);
    out[kind2][i] = got;
  }
  return (L._bl[w] = out);
}
// the world sign's box (main.js draws the sign at this spot)
function MS_SIGN(L, w) { const y = L.bandTop(w) + L.BH * 0.955, u = L.u, x = L.pathX(y), bw = 170 * u, s = x < L.cx ? 1 : -1, cx = clamp(x + s * (bw / 2 + L.roadW), L.A.x + bw / 2 + 6 * u, L.A.x1 - bw / 2 - 6 * u); return { x0: cx - bw / 2, x1: cx + bw / 2, y0: y - 34 * u, y1: y + 20 * u, cx }; }
export function signSpot(L, w) { const b = MS_SIGN(L, w); return { x: b.cx, y: L.bandTop(w) + L.BH * 0.955 }; }
function spotOf(L, w, e, i, cast) { const B = bandLayout(L, w); return (cast ? B.cast : B.still)[i] || null; }

function drawStill(c, L, w, e, i) {
  const sp = spotOf(L, w, e, i, false); if (!sp) return;
  const { x, y, s } = sp, k = e[0], o = e[5];
  switch (k) {
    case 'barn': barn(c, x, y, s); break;
    case 'tree': tree(c, x, y, s, o || {}); break;
    case 'pine': pine(c, x, y, s, o || {}); break;
    case 'hay': hay(c, x, y, s); break;
    case 'windmill': windmill(c, x, y, s); break;
    case 'fence': fence(c, x - s * 0.6, y, s * 1.2, s * 0.6); break;
    case 'mushroom': mushroom(c, x, y, s, o || '#d8402e'); break;
    case 'bush': bush(c, x, y, s); break;
    case 'lake': pond(c, x, y - s * 0.3, s * 1.1, s * 0.42, ['#e8f8ff', '#9fd2ef', 'rgba(90,150,200,0.5)']); c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - s * 0.5, y - s * 0.4); c.lineTo(x - s * 0.1, y - s * 0.46); c.moveTo(x + s * 0.1, y - s * 0.2); c.lineTo(x + s * 0.5, y - s * 0.26); c.stroke(); break;
    case 'snowman': snowman(c, x, y, s); break;
    case 'crystal': crystal(c, x, y, s, o || '#b07af0', e[6] || '#f0d8ff'); break;
    case 'stalag': stalag(c, x - s * 0.2, y, s * 0.8, '#3e2e72'); stalag(c, x + s * 0.15, y, s, '#4a3a86'); stalag(c, x + s * 0.4, y, s * 0.5, '#3e2e72'); break;
    case 'volcano': volcano(c, x, y, s); break;
    case 'rock': rock(c, x, y, s, o || '#8a8a94', e[6] || '#b4b4bf'); break;
    case 'lava': pond(c, x, y - s * 0.25, s * 0.9, s * 0.32, ['#ffd23a', '#ff5a1e', '#2a0c06']); break;
    case 'peak': peak(c, x, y, s); break;
    case 'vault': vaultDoor(c, x, y, s); break;
    case 'coins': coins(c, x, y, s); break;
    case 'crate': crate(c, x, y, s); break;
    case 'coral': coral(c, x, y, s, o || '#ff6a7a'); break;
    case 'weed': break; // live (it sways)
    case 'cypress': cypress(c, x, y, s); break;
    case 'swamp': pond(c, x, y - s * 0.2, s * 1, s * 0.34, ['#6a8a5a', '#3a5a3a', 'rgba(20,40,20,0.4)']); lily(c, x - s * 0.4, y - s * 0.24, s * 0.4); lily(c, x + s * 0.3, y - s * 0.12, s * 0.3); break;
    case 'beaker': beaker(c, x, y, s, o || '#6aff9a'); break;
    case 'gearS': gear(c, x, y - s * 0.5, s * 0.45, '#6a7a98', 9, 0.2); break;
    default: break;
  }
}

// ------------------------------------------------------------------ static band cache
const cache = new Map(); // key -> { canvas, key }
const EDGE = 60; // hill crest overhang above the band (x u)

function paintBand(c, L, w) {
  const u = L.u, BH = L.BH, W = L.W, E = EDGE * u, look = WORLD_LOOK[w] || WORLD_LOOK[0];
  // the band: a wavy hill line on top, then the ground gradient
  const R = rng(w * 31 + 5), ph = R() * TAU, ph2 = R() * TAU;
  const crest = (x) => E * 0.5 + Math.sin((x / W) * TAU * 1.3 + ph) * E * 0.28 + Math.sin((x / W) * TAU * 3.1 + ph2) * E * 0.12;
  c.beginPath(); c.moveTo(0, BH + E);
  for (let x = 0; x <= W + 8; x += 8) c.lineTo(x, crest(x));
  c.lineTo(W, BH + E); c.closePath();
  c.fillStyle = lg(c, 0, E * 0.2, 0, BH + E, [look.hill, look.ground[0], look.ground[1]]); c.fill();
  // a soft lit rim along the crest
  c.beginPath(); for (let x = 0; x <= W + 8; x += 8) { const y = crest(x); if (x === 0) c.moveTo(x, y); else c.lineTo(x, y); }
  c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 4 * u; c.stroke();
  c.save(); c.translate(0, E); // band coordinates: y 0 = band top
  // ground texture per world
  const rr = rng(w * 97 + 3);
  if (w === 0 || w === 1 || w === 8) grassTufts(c, w, 0, 20 * u, W, BH, 70, w === 0 ? 'rgba(60,130,40,0.6)' : 'rgba(20,60,20,0.55)', w * 13 + 1);
  if (w === 0) flowers(c, 0, 40 * u, W, BH - 20 * u, 26, ['#ffffff', '#ff8ab0', '#ffd23a'], 11, u);
  if (w === 1) flowers(c, 0, 40 * u, W, BH - 20 * u, 14, ['#ffd23a', '#ff7a5a'], 17, u);
  if (w === 2) { c.fillStyle = 'rgba(160,200,230,0.5)'; for (let i = 0; i < 40; i++) { const x = rr() * W, y = rr() * BH; c.beginPath(); c.ellipse(x, y, (10 + rr() * 30) * u, (2 + rr() * 3) * u, 0, 0, TAU); c.fill(); } }
  if (w === 3) { for (let i = 0; i < 40; i++) blobAt(c, rr() * W, rr() * BH, (1 + rr() * 2) * u, `rgba(220,180,255,${0.3 + rr() * 0.4})`); }
  if (w === 4) { c.strokeStyle = 'rgba(255,110,30,0.55)'; c.lineWidth = 2.5 * u; for (let i = 0; i < 8; i++) { let x = rr() * W, y = rr() * BH; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rr() - 0.5) * 40 * u; y += (10 + rr() * 20) * u; c.lineTo(x, y); } c.stroke(); } }
  if (w === 5) { for (let i = 0; i < 26; i++) rock(c, rr() * W, rr() * BH, (8 + rr() * 10) * u, '#5a6578', '#8c98aa'); }
  if (w === 6) { c.strokeStyle = 'rgba(40,28,14,0.35)'; c.lineWidth = 1.5 * u; const sz = 34 * u; for (let y = 0; y < BH; y += sz * 0.6) for (let x = ((y / (sz * 0.6)) % 2) * sz * 0.5; x < W; x += sz) c.strokeRect(x, y, sz, sz * 0.6); }
  if (w === 7) { c.fillStyle = 'rgba(255,255,255,0.08)'; for (let i = 0; i < 10; i++) { c.beginPath(); c.moveTo(rr() * W, 0); c.lineTo(rr() * W - 60 * u, BH); c.lineTo(rr() * W - 20 * u, BH); c.closePath(); c.fill(); } c.fillStyle = 'rgba(240,220,160,0.35)'; for (let i = 0; i < 30; i++) { c.beginPath(); c.ellipse(rr() * W, rr() * BH, (8 + rr() * 16) * u, 3 * u, 0, 0, TAU); c.fill(); } }
  if (w === 8) { c.fillStyle = 'rgba(30,60,40,0.35)'; for (let i = 0; i < 10; i++) { c.beginPath(); c.ellipse(rr() * W, rr() * BH, (30 + rr() * 50) * u, (8 + rr() * 10) * u, 0, 0, TAU); c.fill(); } }
  if (w === 9) { c.strokeStyle = 'rgba(150,200,255,0.12)'; c.lineWidth = 1; const g = 26 * u; for (let x = 0; x < W; x += g) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, BH); c.stroke(); } for (let y = 0; y < BH; y += g) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); } }
  // the still props, top to bottom so nearer (lower) ones overlap
  const list = (STILL[w] || []).map((e, i) => [e, i]).sort((a, b) => a[0][1] - b[0][1]);
  const top = L.bandTop(w);
  c.translate(0, -top); // place() works in map coordinates
  for (const [e, i] of list) { try { drawStill(c, L, w, e, i); } catch (_) { /* a prop never breaks the map */ } }
  c.restore();
}

function bandCanvas(L, w, DPR) {
  const W = L.W, h = L.BH + EDGE * L.u, key = `${W}x${L.BH}x${L.u.toFixed(3)}x${DPR}x${L.A.x}x${L.A.w}`;
  const hit = cache.get(w);
  if (hit && hit.key === key) { cache.delete(w); cache.set(w, hit); return hit.canvas; } // LRU touch
  if (typeof document === 'undefined') return null;
  const cv = (hit && hit.canvas) || document.createElement('canvas');
  cv.width = Math.ceil(W * DPR); cv.height = Math.ceil(h * DPR);
  const c = cv.getContext('2d'); c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, W, h);
  paintBand(c, L, w);
  cache.delete(w); cache.set(w, { canvas: cv, key });
  while (cache.size > 4) cache.delete(cache.keys().next().value); // keep the few bands around the view
  return cv;
}

// the land: sky above the summit, then each band in its look (painted once, blitted), top band first
export function drawLand(ctx, L, sy, vt, vb, DPR) {
  const W = L.W, u = L.u;
  // the summit sky
  const skyB = L.TOP + EDGE * u - sy;
  if (skyB > vt) { const g = ctx.createLinearGradient(0, -sy, 0, skyB); g.addColorStop(0, '#20305a'); g.addColorStop(1, '#5a7ab0'); ctx.fillStyle = g; ctx.fillRect(0, vt, W, Math.min(vb, skyB) - vt + 1); }
  for (let w = L.nw - 1; w >= 0; w--) {
    const top = L.bandTop(w) - EDGE * u - sy, bot = L.bandTop(w) + L.BH - sy;
    if (bot < vt - 4 || top > vb + 4) continue;
    const cv = bandCanvas(L, w, DPR);
    if (cv) ctx.drawImage(cv, 0, top, W, L.BH + EDGE * u);
  }
  // under World 1: the farm's soil
  const b0 = L.bandTop(0) + L.BH - sy;
  if (b0 < vb) { ctx.fillStyle = '#4e8a36'; ctx.fillRect(0, b0 - 1, W, vb - b0 + 2); }
}

// ------------------------------------------------------------------ the road
export function drawRoad(ctx, L, sy, vt, vb, doneTo) {
  const u = L.u, y0 = Math.max(0, vt + sy - 40 * u), y1 = Math.min(L.H, vb + sy + 40 * u);
  const yEnd = L.TOP * 0.62, yStart = L.stops[0].y + L.BH * 0.12;
  const seg = (a, b) => { ctx.beginPath(); let first = true; for (let y = Math.max(a, yEnd); y <= Math.min(b, yStart) + 0.1; y += 6) { const x = L.pathX(y); if (first) { ctx.moveTo(x, y - sy); first = false; } else ctx.lineTo(x, y - sy); } };
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // per world, so each world's road wears its own colours
  for (let w = 0; w < L.nw; w++) {
    const a = Math.max(y0, L.bandTop(w) - 2), b = Math.min(y1, L.bandTop(w) + L.BH + 2);
    if (a >= b) continue;
    const R = WORLD_LOOK[w].road;
    seg(a, b); ctx.strokeStyle = 'rgba(20,10,0,0.25)'; ctx.lineWidth = L.roadW + 8 * u; ctx.stroke();
    seg(a, b); ctx.strokeStyle = R[1]; ctx.lineWidth = L.roadW + 5 * u; ctx.stroke();
    seg(a, b); ctx.strokeStyle = R[0]; ctx.lineWidth = L.roadW; ctx.stroke();
  }
  // the stretch already walked shines gold
  if (doneTo != null && doneTo < yStart) { const a = Math.max(y0, doneTo), b = Math.min(y1, yStart); if (a < b) { seg(a, b); ctx.strokeStyle = '#f6c454'; ctx.lineWidth = L.roadW * 0.62; ctx.stroke(); } }
  for (let w = 0; w < L.nw; w++) {
    const a = Math.max(y0, L.bandTop(w)), b = Math.min(y1, L.bandTop(w) + L.BH);
    if (a >= b) continue;
    ctx.setLineDash([6 * u, 9 * u]); seg(a, b); ctx.strokeStyle = WORLD_LOOK[w].road[2]; ctx.lineWidth = 3 * u; ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();
}

// ------------------------------------------------------------------ the live layer: the cast and moving bits
const HKEYS = {};
function drawLive(ctx, L, w, e, i, t, calm) {
  const p = spotOf(L, w, e, i, true); if (!p) return;
  const { x, s } = p, u = L.u, k = e[0], face = p.side < 0 ? 1 : -1; // face the road
  const y = p.y - L.sy, tt = calm ? 0 : t + i * 1.7 + w * 0.9;
  const port = (kind, d, yy = y - d * 0.42, xx = x) => drawVillainPortrait(ctx, kind, xx, yy, d, tt);
  switch (k) {
    case 'henNest': {
      nest(ctx, x, y - s * 0.05, s * 0.9);
      drawEggFriend(ctx, x - s * 0.18, y - s * 0.12, s * 0.28, { kind: 'classic', rot: -0.2 });
      drawEggFriend(ctx, x + s * 0.2, y - s * 0.1, s * 0.26, { kind: 'quail', rot: 0.25, seed: 3 });
      const key = 'mapnest' + w; HKEYS[key] = 1;
      drawHenAnim(ctx, 'idle', x - face * s * 0.02, y - s * 0.72, s * 0.95, calm ? 0 : t, { key, face, calm, shadow: 0 });
      break;
    }
    case 'rooster': {
      // on a post; every few seconds he throws his head back and crows
      ctx.fillStyle = '#9a6a36'; ctx.fillRect(x - s * 0.08, y - s * 0.42, s * 0.16, s * 0.42); ctx.fillStyle = '#c99a5a'; ctx.fillRect(x - s * 0.11, y - s * 0.46, s * 0.22, s * 0.06);
      const cyc = tt % 6, crow = cyc > 4.2 && cyc < 5.6, P = crow ? roosterPose('crow', clamp((cyc - 4.2) / 1.4, 0, 1), tt) : roosterPose('idle', 0, tt);
      ctx.save(); ctx.translate(x, y - s * 0.46); ctx.scale(face, 1); drawRooster(ctx, 0, -s * 0.36, s * 0.62, P); ctx.restore();
      if (crow && !calm) { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2 * u; for (let q = 0; q < 3; q++) { ctx.beginPath(); ctx.arc(x + face * s * 0.35, y - s * 1.05, s * (0.12 + q * 0.08 + ((tt * 0.8) % 0.08)), -0.6, 0.6); ctx.stroke(); } }
      break;
    }
    case 'goose': {
      const walk = calm ? 0 : Math.sin(tt * 0.5) * s * 0.25, dir = Math.cos(tt * 0.5) >= 0 ? 1 : -1;
      ctx.save(); ctx.translate(x + walk, y); ctx.scale(dir * 1, 1); drawGoose(ctx, 0, -s * 0.38, s * 0.6, goosePose('waddle', 0, tt)); ctx.restore();
      break;
    }
    case 'weaselHay': { // peeks out from behind a haystack, ducks back
      const pk = calm ? 0.6 : ss((Math.sin(tt * 0.9) - 0.1) * 2);
      ctx.save(); ctx.beginPath(); ctx.rect(x - s, y - s * 2, s * 2, s * 2 - s * 0.05); ctx.clip();
      port('weasel', s * 1.1, y - s * 0.3 - pk * s * 0.35, x + face * s * 0.3);
      ctx.restore();
      hay(ctx, x, y, s);
      break;
    }
    case 'chicks': for (let q = 0; q < 3; q++) { const ph = tt * 2 + q * 2.1, dx = (q - 1) * s * 0.42 + (calm ? 0 : Math.sin(tt * 0.6 + q) * s * 0.12); drawChick(ctx, x + dx, y - s * 0.16, s * 0.34, tt + q, 0, calm ? 0 : Math.max(0, Math.sin(ph)) ); } break;
    case 'snakeBranch': snakeOnBranch(ctx, x, y, s, tt, face, calm); break;
    case 'snake': { const pts = []; for (let q = 0; q <= 22; q++) { const v = q / 22; pts.push({ x: x + face * (s * 0.5 - v * s) , y: y - s * 0.12 + Math.sin(v * 6 - tt * 3) * s * 0.07 }); } bush(ctx, x - face * s * 0.6, y, s * 0.5); drawSnake(ctx, pts, s * 0.05, tt, { skin: 'emerald' }); break; }
    case 'butterflies': for (let q = 0; q < 3; q++) { const a = tt * 0.8 + q * 2.1, bx = x + Math.sin(a) * s * 0.5, by = y - s * 0.5 + Math.sin(a * 1.7) * s * 0.25, f = calm ? 1 : Math.abs(Math.sin(tt * 12 + q)); ctx.fillStyle = ['#ffd23a', '#ff8ab0', '#8ad0ff'][q]; ctx.beginPath(); ctx.ellipse(bx - 4 * u * f, by, 4 * u * f, 6 * u, -0.3, 0, TAU); ctx.ellipse(bx + 4 * u * f, by, 4 * u * f, 6 * u, 0.3, 0, TAU); ctx.fill(); } break;
    case 'gecko': { rock(ctx, x, y, s * 0.8, '#9cc8e4', '#eaf6ff'); const S2 = s * 0.3; drawCrawler(ctx, x + face * 0.8 * S2, y - s * 0.4, S2, tt, { heading: face > 0 ? 0 : Math.PI, curve: -0.12 / S2, pose: 'idle', look: { x: 0.5 * face, y: 0.4 }, id: 9150 }, 'gecko'); break; }
    case 'skater': { // a chick sliding across the ice
      const v = calm ? 0 : Math.sin(tt * 0.9), sx = x + v * s * 0.3;
      ctx.beginPath(); ctx.ellipse(x, y - 3 * u, s * 0.62, s * 0.14, 0, 0, TAU); ctx.fillStyle = 'rgba(190,225,245,0.9)'; ctx.fill();
      ctx.save(); ctx.translate(sx, y - s * 0.2); ctx.rotate(-v * 0.15); drawChick(ctx, 0, 0, s * 0.42, tt, 1, 0); ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.moveTo(sx - Math.sign(Math.cos(tt * 0.9) || 1) * s * 0.3, y - 2 * u); ctx.lineTo(sx, y - 2 * u); ctx.stroke();
      break;
    }
    case 'snowfall': if (!calm) for (let q = 0; q < 14; q++) { const fx2 = ((q * 37.3) % 100) / 100, py = ((t * 18 * u + q * 41 * u) % (s * 2)); blobAt(ctx, x - s + fx2 * s * 2 + Math.sin(t + q) * 6 * u, y - s * 2 + py, 2 * u, 'rgba(255,255,255,0.9)'); } break;
    case 'rats': { const run = calm ? 0 : Math.sin(tt * 0.7) * s * 0.35; port('rats', s * 1.0, y - s * 0.45, x + run); break; }
    case 'spike': crystal(ctx, x + face * s * 0.35, y, s * 0.4, '#5ad0e0', '#d8fbff'); port('spike', s * 0.95, y - s * 0.38, x - face * s * 0.1); break;
    case 'sparkle': if (!calm) for (let q = 0; q < 6; q++) { const a = (t * 1.3 + q) % 2, r = Math.sin((a / 2) * Math.PI) * 4 * u, sx = x + Math.cos(q * 2.4) * s * 0.6, sy2 = y - s * 0.4 + Math.sin(q * 1.7) * s * 0.4; ctx.fillStyle = 'rgba(255,240,255,0.9)'; ctx.beginPath(); ctx.moveTo(sx, sy2 - r * 2); ctx.lineTo(sx + r * 0.5, sy2); ctx.lineTo(sx, sy2 + r * 2); ctx.lineTo(sx - r * 0.5, sy2); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(sx - r * 2, sy2); ctx.lineTo(sx, sy2 + r * 0.5); ctx.lineTo(sx + r * 2, sy2); ctx.lineTo(sx, sy2 - r * 0.5); ctx.closePath(); ctx.fill(); } break;
    case 'salamander': rock(ctx, x, y, s * 0.9, '#3a2420', '#6a4034'); port('salamander', s * 0.95, y - s * 0.62); break;
    case 'embers': if (!calm) for (let q = 0; q < 10; q++) { const a = (t * 0.6 + q * 0.37) % 1, ex = x + Math.sin(q * 2.3 + t) * s * 0.5, ey = y - a * s * 1.4; blobAt(ctx, ex, ey, (1.5 + (q % 3)) * u, `rgba(255,${120 + q * 10},40,${1 - a})`); } break;
    case 'smoke': if (!calm) for (let q = 0; q < 5; q++) { const a = (t * 0.25 + q / 5) % 1; blobAt(ctx, x + Math.sin(a * 4 + q) * 10 * u, y - s * 0.4 - a * s * 1.6, (10 + a * 26) * u, `rgba(90,70,70,${0.4 * (1 - a)})`); } break;
    case 'eagle': { // circles the peaks
      const a = calm ? 0.8 : tt * 0.5, ex = x + Math.cos(a) * s * 0.6, ey = y - s * 0.9 + Math.sin(a) * s * 0.22;
      ctx.save(); ctx.translate(ex, ey); ctx.scale(-Math.sign(Math.sin(a)) || 1, 1); drawVillainPortrait(ctx, 'eagle', 0, 0, s * 0.9, tt); ctx.restore();
      break;
    }
    case 'chameleon': rock(ctx, x, y, s * 0.8, '#5a6578', '#9aa6b8'); port('chameleon', s * 0.9, y - s * 0.6); break;
    case 'bolt': if (!calm && (t % 5) < 0.18) { ctx.strokeStyle = 'rgba(255,250,200,0.95)'; ctx.lineWidth = 4 * u; ctx.beginPath(); ctx.moveTo(x, y - s * 1.6); ctx.lineTo(x - s * 0.12, y - s * 1.0); ctx.lineTo(x + s * 0.08, y - s * 0.9); ctx.lineTo(x - s * 0.06, y - s * 0.2); ctx.stroke(); } cloud(ctx, x, y - s * 1.6, s * 0.7, 'rgba(90,100,130,0.85)'); break;
    case 'weasel': { const run = calm ? 0 : Math.sin(tt * 0.6) * s * 0.3; port('weasel', s * 1.1, y - s * 0.45, x + run); coins(ctx, x - face * s * 0.5, y, s * 0.4); break; }
    case 'puffer': { const b = calm ? 0 : Math.sin(tt * 1.2) * s * 0.1; port('puffer', s * 0.95, y - s * 0.55 + b); break; }
    case 'fish': port('fish', s * 1.1, y - s * 0.5, x + (calm ? 0 : Math.sin(tt * 0.5) * s * 0.3)); break;
    case 'hermit': port('hermit', s, y - s * 0.4, x + (calm ? 0 : Math.sin(tt * 0.4) * s * 0.25)); break;
    case 'jelly': port('jelly', s * 0.9, y - s * 0.6 + (calm ? 0 : Math.sin(tt * 1.1) * s * 0.15)); break;
    case 'bubbles': if (!calm) for (let q = 0; q < 8; q++) { const a = (t * 0.35 + q / 8) % 1; ctx.beginPath(); ctx.arc(x + Math.sin(q * 1.9 + a * 5) * s * 0.4, y - a * s * 1.8, (2 + (q % 3) * 1.5) * u, 0, TAU); ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - a)})`; ctx.lineWidth = 1.5 * u; ctx.stroke(); } break;
    case 'weedLive': break;
    case 'gator': { pond(ctx, x, y - s * 0.12, s * 0.75, s * 0.2, ['#6a8a5a', '#3a5a3a', 'rgba(20,40,20,0.4)']); ctx.save(); ctx.beginPath(); ctx.rect(x - s, y - s * 1.4, s * 2, s * 1.4 - s * 0.14); ctx.clip(); port('gator', s * 0.95, y - s * 0.2 + (calm ? 0 : Math.sin(tt * 0.8) * s * 0.03)); ctx.restore(); ctx.strokeStyle = 'rgba(200,230,200,0.5)'; ctx.lineWidth = 1.5 * u; ctx.beginPath(); ctx.ellipse(x, y - s * 0.14, s * 0.5 + (t % 2) * 6 * u, s * 0.07, 0, 0, TAU); ctx.stroke(); break; }
    case 'turtle': { ctx.fillStyle = '#6a4a2a'; ctx.beginPath(); ctx.ellipse(x, y - s * 0.06, s * 0.55, s * 0.1, 0, 0, TAU); ctx.fill(); port('turtle', s * 0.8, y - s * 0.34); break; }
    case 'frog': lily(ctx, x, y - s * 0.06, s * 0.9); port('frog', s * 0.7, y - s * 0.55); break;
    case 'mosquito': port('mosquito', s, y - s * 0.6, x + (calm ? 0 : Math.sin(tt * 0.9) * s * 0.3)); break;
    case 'spider': { const sw = calm ? 0 : Math.sin(tt * 1.3) * 0.2; ctx.strokeStyle = 'rgba(220,230,255,0.7)'; ctx.lineWidth = 1.2 * u; const ax = x, ay = y - s * 1.4, bx = ax + Math.sin(sw) * s * 0.7, by = ay + Math.cos(sw) * s * 0.7; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); port('spider', s * 0.8, by + s * 0.1, bx); break; }
    case 'beetle': port('beetle', s, y - s * 0.3, x + (calm ? 0 : Math.sin(tt * 0.5) * s * 0.25)); break;
    case 'jack': port('jack', s * 0.9, y - s * 0.4); break;
    case 'gearLive': gear(ctx, x - s * 0.25, y - s * 0.5, s * 0.32, '#8a9ab8', 10, calm ? 0 : t * 0.8); gear(ctx, x + s * 0.22, y - s * 0.3, s * 0.22, '#c8a050', 7, calm ? 0 : -t * 1.15 + 0.2); break;
    default: break;
  }
}

// the farm windmill's sails and the reef's seaweed move: live extras keyed off the still props
function drawStillLive(ctx, L, w, e, i, t, calm) {
  const k = e[0]; if (k !== 'windmill' && k !== 'weed') return;
  const p = spotOf(L, w, e, i, false); if (!p) return;
  const x = p.x, y = p.y - L.sy, s = p.s, u = L.u;
  if (k === 'windmill') {
    ctx.save(); ctx.translate(x, y - s * 0.86); ctx.rotate(calm ? 0.4 : t * 0.9);
    for (let q = 0; q < 4; q++) { ctx.rotate(TAU / 4); ctx.fillStyle = '#7a4a24'; ctx.fillRect(-s * 0.02, 0, s * 0.04, s * 0.55); ctx.fillStyle = 'rgba(255,248,230,0.95)'; ctx.fillRect(s * 0.02, s * 0.12, s * 0.12, s * 0.42); }
    ctx.restore(); blobAt(ctx, x, y - s * 0.86, s * 0.05, '#5a3a1a');
  } else {
    ctx.strokeStyle = '#2f9a5a'; ctx.lineCap = 'round';
    for (let q = 0; q < 4; q++) { ctx.lineWidth = (5 - q * 0.6) * u; ctx.beginPath(); const bx = x + (q - 1.5) * 12 * u; ctx.moveTo(bx, y); for (let h = 1; h <= 8; h++) ctx.lineTo(bx + Math.sin(h * 0.7 + (calm ? 0 : t * 1.6) + q) * 6 * u, y - (h / 8) * s * (0.8 + q * 0.1)); ctx.stroke(); }
  }
}

// a snake coiled around a branch: the branch, the coil (sampled as a helix), and the branch drawn again over the
// coil where it passes behind; the head lifts off the end and sways
function snakeOnBranch(ctx, x, y, s, t, face, calm) {
  const u = s / 120, bx0 = x - face * s * 0.55, bx1 = x + face * s * 0.6, by = y - s * 0.8;
  const branchY = (bx) => by + (bx - bx0) * 0.06 * face;
  const trunkX = bx0;
  // trunk and branch
  ctx.fillStyle = '#6a4424'; ctx.beginPath(); ctx.moveTo(trunkX - face * s * 0.12, y); ctx.lineTo(trunkX - face * s * 0.08, by - s * 0.6); ctx.lineTo(trunkX + face * s * 0.08, by - s * 0.6); ctx.lineTo(trunkX + face * s * 0.1, y); ctx.closePath(); ctx.fill();
  shadow(ctx, trunkX, y, s * 0.3, s * 0.06);
  for (const [dx, dy, r] of [[-0.1, -1.4, 0.32], [0.18, -1.5, 0.28], [0.02, -1.7, 0.3]]) blobAt(ctx, trunkX + face * dx * s, y + dy * s, r * s, '#2e6e2c');
  for (const [dx, dy, r] of [[-0.06, -1.48, 0.22], [0.12, -1.6, 0.18]]) blobAt(ctx, trunkX + face * dx * s, y + dy * s, r * s, '#4a9a3c');
  const bw = s * 0.075;
  const branch = () => { ctx.beginPath(); ctx.moveTo(bx0, branchY(bx0) - bw); ctx.lineTo(bx1, branchY(bx1) - bw * 0.5); ctx.lineTo(bx1, branchY(bx1) + bw * 0.5); ctx.lineTo(bx0, branchY(bx0) + bw); ctx.closePath(); ctx.fillStyle = '#7a5030'; ctx.fill(); };
  branch();
  blobAt(ctx, bx1 + face * 3 * u, branchY(bx1) - 4 * u, s * 0.06, '#5aa83a');
  // the coil: three turns along the branch, then the neck and head rise off the tip
  const pts = [], turns = 3, xa = lerp(bx0, bx1, 0.16), xb = lerp(bx0, bx1, 0.8), R = bw * 1.25;
  const lift = calm ? 0 : Math.sin(t * 1.4) * 0.15;
  // head first: the head end hangs over the tip, swaying
  const hx = bx1 + face * s * 0.12, hy = branchY(bx1) - s * 0.28;
  for (let q = 6; q >= 1; q--) { const v = q / 6; pts.push({ x: lerp(xb, hx + Math.sin(t * 1.4) * 4 * u, v), y: lerp(branchY(xb) - R * 0.6, hy + lift * s * 0.2, v) - Math.sin(v * Math.PI) * s * 0.1 }); }
  const N = 60;
  for (let q = 0; q <= N; q++) { const v = q / N, bx = lerp(xb, xa, v), a = v * turns * TAU; pts.push({ x: bx, y: branchY(bx) - Math.cos(a) * R }); } // a helix seen side-on: top, front, bottom, behind
  for (let q = 1; q <= 8; q++) pts.push({ x: xa - face * q * 4 * u, y: branchY(xa) + R + q * 3 * u }); // the tail hangs
  drawSnake(ctx, pts, s * 0.035, t, { skin: 'violet', wave: 0 });
  // the branch again over the coil's back halves (where cos(a) < 0 the coil is behind)
  ctx.save(); ctx.beginPath();
  for (let k2 = 0; k2 < turns; k2++) { const v0 = (k2 + 0.5) / turns, v1 = (k2 + 1) / turns; const x0 = lerp(xb, xa, v0), x1 = lerp(xb, xa, v1); ctx.rect(Math.min(x0, x1), by - s, Math.abs(x1 - x0), s * 2); }
  ctx.clip(); branch(); ctx.restore();
}

// the summit over World 10: a cloud island with the Golden Nest, where the road ends
function drawSummit(ctx, L, sy, t, calm) {
  const u = L.u, x = L.pathX(L.TOP * 0.62), y = L.TOP * 0.62 - sy;
  // drifting stars in the night sky
  const R = rng(91);
  for (let i = 0; i < 26; i++) { const sx = R() * L.W, syy = R() * L.TOP * 0.9 - sy, tw = calm ? 0.8 : 0.5 + 0.5 * Math.sin(t * 2 + i); blobAt(ctx, sx, syy, (1 + R() * 1.5) * u, `rgba(255,250,220,${0.4 + 0.5 * tw})`); }
  cloud(ctx, x, y + 34 * u, 120 * u, 'rgba(255,255,255,0.95)'); cloud(ctx, x - 70 * u, y + 46 * u, 70 * u, 'rgba(235,242,255,0.95)'); cloud(ctx, x + 74 * u, y + 44 * u, 76 * u, 'rgba(235,242,255,0.95)');
  const g = ctx.createRadialGradient(x, y - 10 * u, 4 * u, x, y - 10 * u, 90 * u); g.addColorStop(0, `rgba(255,220,110,${calm ? 0.5 : 0.45 + 0.15 * Math.sin(t * 2)})`); g.addColorStop(1, 'rgba(255,220,110,0)');
  ctx.fillStyle = g; ctx.fillRect(x - 90 * u, y - 100 * u, 180 * u, 180 * u);
  nest(ctx, x, y + 6 * u, 70 * u);
  drawEggFriend(ctx, x, y - 2 * u, 46 * u, { kind: 'golden', rot: calm ? 0 : Math.sin(t * 1.5) * 0.06 });
  // a little pennant
  ctx.fillStyle = '#6a4424'; ctx.fillRect(x + 34 * u, y - 52 * u, 3 * u, 56 * u);
  ctx.beginPath(); ctx.moveTo(x + 37 * u, y - 52 * u); ctx.lineTo(x + 37 * u + 26 * u, y - 46 * u + (calm ? 0 : Math.sin(t * 4) * 2 * u)); ctx.lineTo(x + 37 * u, y - 38 * u); ctx.closePath(); ctx.fillStyle = '#e8402e'; ctx.fill();
}

export function drawCast(ctx, L, sy, vt, vb, t, calm, DPR = 1) {
  L.sy = sy;
  if (L.TOP + 60 * L.u - sy > vt) drawSummit(ctx, L, sy, t, calm);
  for (let w = 0; w < L.nw; w++) {
    const top = L.bandTop(w) - 120 * L.u - sy, bot = L.bandTop(w) + L.BH + 40 * L.u - sy;
    if (bot < vt || top > vb) continue;
    if (PERF.low && typeof document !== 'undefined') { castCached(ctx, L, w, sy, t, calm, DPR); continue; }
    castBand(ctx, L, w, sy, t, calm);
  }
  L.sy = sy;
}
function castBand(ctx, L, w, sy, t, calm) {
  L.sy = sy;
  const S = STILL[w] || [], C = CAST[w] || [];
  const G = calm ? null : ambBand(L, w, sy, t);
  if (G) drawMapAmb(ctx, 'back', w, G);
  S.forEach((e, i) => { try { drawStillLive(ctx, L, w, e, i, t, calm); } catch (_) {} });
  C.forEach((e, i) => { try { drawLive(ctx, L, w, e, i, t, calm); } catch (_) {} });
  if (G) drawMapAmb(ctx, 'front', w, G);
}
// 2026-11-19 Low graphics: a band's creatures are painted onto their own canvas 12 times a second (bands take turns)
// and that picture is stamped every frame, so scrolling stays smooth while the cast still moves
const CASTC = new Map();
function castCached(ctx, L, w, sy, t, calm, DPR) {
  const u = L.u, y0 = L.bandTop(w) - 120 * u, h = L.BH + 160 * u, key = `${L.W}x${h.toFixed(1)}x${DPR}`;
  let E = CASTC.get(w);
  if (!E || E.key !== key) { E = { cv: (E && E.cv) || document.createElement('canvas'), key, t: -1 }; E.cv.width = Math.ceil(L.W * DPR); E.cv.height = Math.ceil(h * DPR); CASTC.set(w, E); }
  if (E.t < 0 || t - E.t >= 1 / 12 || t < E.t) {
    const c = E.cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, E.cv.width, E.cv.height); c.setTransform(DPR, 0, 0, DPR, 0, 0);
    castBand(c, L, w, y0, t, calm);
    E.t = t + (w % 2) * 0.04; // neighbouring bands repaint on different frames
  }
  ctx.drawImage(E.cv, 0, y0 - sy, L.W, h);
  if (CASTC.size > 4) for (const k of CASTC.keys()) { if (Math.abs(k - w) > 1) CASTC.delete(k); }
}
// what the ambience layer (render/mapamb.js) needs to know about a band on screen
function ambBand(L, w, sy, t) {
  const B = bandLayout(L, w), S = STILL[w] || [];
  return {
    x0: L.A.x, x1: L.A.x1, y: L.bandTop(w) - sy, h: L.BH, u: L.u, t,
    spots: (kind) => S.map((e, i) => (e[0] === kind && B.still[i] ? { x: B.still[i].x, y: B.still[i].y - sy, s: B.still[i].s } : null)).filter(Boolean),
  };
}

// the fog over a world still behind its gate: drifting cloud banks
export function drawFog(ctx, L, w, sy, t, calm) {
  const u = L.u, top = L.bandTop(w) - 30 * u - sy, h = L.BH + 30 * u;
  ctx.save();
  ctx.fillStyle = 'rgba(232,238,248,0.32)'; ctx.fillRect(0, top + 20 * u, L.W, h - 20 * u); // light: the world's life shows through, a teaser
  const R = rng(w * 7 + 1);
  for (let i = 0; i < 6; i++) { const fx = R(), fy = R(), s = (80 + R() * 60) * u, dx = calm ? 0 : Math.sin(t * 0.15 + i) * 20 * u; cloud(ctx, fx * L.W + dx, top + 30 * u + fy * (h - 60 * u), s, 'rgba(250,252,255,0.7)'); }
  ctx.restore();
}

