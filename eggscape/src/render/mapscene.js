// The world map (2026-11-16, mykee: "one continuous page, wavy path, every world in its own theme, characters placed
// in the scenery and alive"). One tall map, World 1 at the bottom and World 10 at the top, scrolled vertically.
// Each world is a band of land in its own look; the band's top edge is a wavy hill line that overlaps the band above.
// A single winding road (a sine, never straight zig-zags) runs through all 50 stops.
//
// Layout and art only: main.js owns the scroll, the buttons, the hen at the next stop and the gate cards.
// The still part of every band (ground, trees, barns, crystals...) is painted once into an offscreen canvas and blitted;
// only the creatures, smoke, bubbles and sparkles are drawn live, and only for the bands on screen (battery).
import { PERF } from '../perf.js'; // 2026-11-19 Low graphics: the cast is painted 12x a second, not every frame
import { freeCanvas } from './cvfree.js';
import { drawStar, drawLock, FONT } from '../ui/ui.js';
import { drawMapAmb } from './mapamb.js';
import { drawVillainPortrait } from './villain-art.js';
import { drawRooster, roosterPose, drawGoose, goosePose } from './allies.js';
import { drawChick } from './characters.js';
import { drawSnake } from './snake.js';
import { drawHenAnim } from './hen.js';
import { drawEggFriend } from './title.js';
import { drawCrawler } from './crawlers.js';
import { PLACE as FARM_PLACE, freeLandmarks } from './mapfarm.js'; // 0.8.7: World 1 is one painted farm with landmark stops
import { PLACE as CAVE_PLACE } from './mapcave.js'; // 0.8.10: World 4, the Crystal Caves, the same way
import { PLACE as VOLCANO_PLACE, freeSalamanders } from './mapvolcano.js'; // 0.8.12: World 5, the Volcano
import { PLACE as THIEVES_PLACE, freeThieves } from './mapthieves.js'; // 0.8.12: World 7, the Thieves' Vault
export * as FARM from './mapfarm.js';
// 0.8.10: the worlds painted as one place, by world index. Each entry: { landmarks (the LMS shapes), paintBand(c, L, E),
// drawLive(ctx, L, sy, t, calm, vt, vb), drawFront?(...), stop(L, i) (i: 0..4 within the world), drawLandmark(ctx, L, m,
// sy, t, calm, press, glow, DPR), drawPlaque(ctx, L, m, sy, press) }. 0.8.14: the landmarks are scenery; every world's
// stops are the nests on the road (drawStop below), and drawPlaque is no longer used. A world not listed keeps the
// generic band and the walking cast. The next world plugs in here.
export const PLACES = { 0: FARM_PLACE, 3: CAVE_PLACE, 4: VOLCANO_PLACE, 6: THIEVES_PLACE };

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
  { name: 'The Thieves’ Vault', ground: ['#2c4458', '#142232'], hill: '#3a5670', road: ['#b23a40', '#5a1420', 'rgba(255,214,110,0.75)'], accent: '#c89a2a' },
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
        const fy = clamp(e[1] + dy, 0.08, 0.9); // 0.8.10: nothing stands on the seam (the world below rises over the last tenth)
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
const HEAD = 46; // 0.8.10: headroom over the crest for the join's edge (hedges, snow-capped rocks, a rock lip) (x u)
// where band w's crest (the wavy top of its ground, which overlaps the band above) is at x, in map y
const CREST = [];
function crestFn(L, w) {
  let f = CREST[w];
  if (!f || f.W !== L.W || f.E !== EDGE * L.u) { const R = rng(w * 31 + 5), ph = R() * TAU, ph2 = R() * TAU, W = L.W, E = EDGE * L.u; f = CREST[w] = (x) => E * 0.5 + Math.sin((x / W) * TAU * 1.3 + ph) * E * 0.28 + Math.sin((x / W) * TAU * 3.1 + ph2) * E * 0.12; f.W = W; f.E = E; }
  return f;
}
export function crestY(L, w, x) { return L.bandTop(w) - EDGE * L.u + crestFn(L, w)(x); }
// the map y where the road crosses band w's crest (the join between world w and world w + 1)
export function seamY(L, w) { let y = L.bandTop(w); for (let k = 0; k < 8; k++) y = crestY(L, w, L.pathX(y)); return y; }

function paintBand(c, L, w) {
  if (PLACES[w]) { PLACES[w].paintBand(c, L, EDGE * L.u); try { paintJoin(c, L, w); } catch (_) {} return; } // a place: its own painter (mapfarm.js, mapcave.js)
  paintGeneric(c, L, w);
  try { paintJoin(c, L, w); } catch (_) { /* the edge never breaks the map */ }
}
function paintGeneric(c, L, w) {
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

// ------------------------------------------------------------------ the joins between worlds (0.8.10)
// The world below rises into the world above along its crest; a ruler-straight colour change read as a seam. Each pair
// gets an edge of its own along that crest, painted once with the lower band: a hedge, frost and snow, snow-capped
// rocks at the cave, a basalt lip, a stone wall, a sandy shore, a reedy bank, a metal kerb. The road (stroked over
// everything) keeps a clear gap; the world sign that stands on the crest keeps clear posts.
const JOIN = ['hedge', 'frost', 'snowrock', 'lip', 'basalt', 'wall', 'shore', 'reeds', 'kerb'];
function paintJoin(c, L, w) {
  if (w >= L.nw - 1 || !JOIN[w]) return;
  const u = L.u, E = EDGE * u, top = L.bandTop(w), W = L.W, kind = JOIN[w], R = rng(w * 53 + 9);
  const sg = MS_SIGN(L, w + 1), gap = L.roadW * 0.5 + 10 * u;
  const onRoad = (x0, x1, y) => { const rx = L.pathX(y); return x1 > rx - gap && x0 < rx + gap; };
  const onSign = (x0, x1) => x1 > sg.x0 - 2 * u && x0 < sg.x1 + 2 * u;
  c.save(); c.translate(0, E - top); c.lineJoin = 'round'; c.lineCap = 'round';
  const cy = (x) => crestY(L, w, x);
  // along the crest: a soft band of the upper world's colour where the two grounds meet, cut at the road
  const up = WORLD_LOOK[w + 1], lo = WORLD_LOOK[w];
  for (let x = -20; x < W + 20; x += 6 * u) {
    const y = cy(x); if (onRoad(x - 3 * u, x + 3 * u, y)) continue;
    c.beginPath(); c.ellipse(x, y + 2 * u, 7 * u, 3.4 * u, 0, 0, TAU); c.fillStyle = withA(up.ground[1], 0.16); c.fill();
  }
  const items = [];
  for (let x = -14 * u; x < W + 14 * u;) {
    const s = (17 + R() * 19) * u, y = cy(x) + (3 + R() * 4) * u, low = R() < 0.3;
    if (!onRoad(x - s * 0.7, x + s * 0.7, y) && !(onSign(x - s * 0.7, x + s * 0.7) && !low)) items.push([x, y, low ? s * 0.6 : s, R()]);
    x += s * (0.75 + R() * 0.7);
  }
  for (const [x, y, s, r] of items) joinItem(c, kind, x, y, s, r, u, lo, up);
  c.restore();
}
function joinItem(c, kind, x, y, s, r, u, lo, up) {
  const sh = (rx, a = 0.25) => { c.beginPath(); c.ellipse(x + s * 0.12, y + s * 0.06, rx, s * 0.14, 0, 0, TAU); c.fillStyle = `rgba(20,14,30,${a})`; c.fill(); };
  const boulder = (base, hi, ink, cap) => { // a faceted rock lit from the upper left, an optional cap (snow) on top
    sh(s * 0.62);
    const pts = [x - s * 0.6, y, x - s * 0.52, y - s * 0.42, x - s * 0.18, y - s * (0.72 + r * 0.2), x + s * 0.3, y - s * 0.62, x + s * 0.58, y - s * 0.2, x + s * 0.55, y];
    c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath();
    c.fillStyle = base; c.fill(); c.strokeStyle = ink; c.lineWidth = Math.max(1, s * 0.05); c.stroke();
    c.beginPath(); c.moveTo(x - s * 0.52, y - s * 0.42); c.lineTo(x - s * 0.18, y - s * (0.72 + r * 0.2)); c.lineTo(x + s * 0.3, y - s * 0.62); c.lineTo(x + s * 0.02, y - s * 0.3); c.lineTo(x - s * 0.36, y - s * 0.2); c.closePath(); c.fillStyle = hi; c.fill();
    c.beginPath(); c.moveTo(x + s * 0.3, y - s * 0.62); c.lineTo(x + s * 0.58, y - s * 0.2); c.lineTo(x + s * 0.55, y); c.lineTo(x + s * 0.1, y); c.lineTo(x + s * 0.02, y - s * 0.3); c.closePath(); c.fillStyle = 'rgba(10,6,24,0.28)'; c.fill();
    if (cap) { c.beginPath(); c.moveTo(x - s * 0.56, y - s * 0.36); c.quadraticCurveTo(x - s * 0.4, y - s * 0.6, x - s * 0.18, y - s * (0.78 + r * 0.2)); c.quadraticCurveTo(x + s * 0.1, y - s * 0.74, x + s * 0.34, y - s * 0.64); c.quadraticCurveTo(x + s * 0.5, y - s * 0.42, x + s * 0.4, y - s * 0.4); c.quadraticCurveTo(x + s * 0.2, y - s * 0.5, x + s * 0.06, y - s * 0.4); c.quadraticCurveTo(x - s * 0.2, y - s * 0.5, x - s * 0.56, y - s * 0.36); c.fillStyle = cap; c.fill(); c.strokeStyle = 'rgba(120,160,200,0.6)'; c.lineWidth = Math.max(0.8, s * 0.03); c.stroke(); }
  };
  const clump = (dark, mid, hi, ink) => { // a leafy clump: lobes with a lit top-left
    sh(s * 0.6, 0.2);
    const L3 = [[-0.32, -0.3, 0.32], [0.3, -0.3, 0.3], [0, -0.52, 0.36], [-0.12, -0.2, 0.3], [0.16, -0.16, 0.28]];
    c.beginPath(); for (const [dx, dy, rr] of L3) { c.moveTo(x + dx * s + rr * s + 1, y + dy * s); c.arc(x + dx * s, y + dy * s, rr * s + 1, 0, TAU); } c.fillStyle = ink; c.fill();
    c.beginPath(); for (const [dx, dy, rr] of L3) { c.moveTo(x + dx * s + rr * s, y + dy * s); c.arc(x + dx * s, y + dy * s, rr * s, 0, TAU); } c.fillStyle = mid; c.fill();
    c.beginPath(); c.arc(x + 0.22 * s, y - 0.12 * s, 0.3 * s, 0, TAU); c.fillStyle = dark; c.fill();
    c.beginPath(); c.arc(x - 0.16 * s, y - 0.6 * s, 0.16 * s, 0, TAU); c.arc(x - 0.36 * s, y - 0.38 * s, 0.1 * s, 0, TAU); c.fillStyle = hi; c.fill();
  };
  const drift = (col, shade) => { c.beginPath(); c.ellipse(x, y - s * 0.06, s * 0.7, s * 0.24, 0, Math.PI, TAU); c.closePath(); c.fillStyle = col; c.fill(); c.beginPath(); c.ellipse(x + s * 0.1, y - s * 0.02, s * 0.6, s * 0.1, 0, 0, Math.PI); c.fillStyle = shade; c.fill(); };
  const reed = (n, col, hi) => { for (let k = 0; k < n; k++) { const bx = x + (k - n / 2) * s * 0.12, h = s * (0.8 + ((k * 37 + r * 100) % 7) / 10), a = ((k % 3) - 1) * 0.18; c.strokeStyle = k % 2 ? col : hi; c.lineWidth = Math.max(1, s * 0.06); c.beginPath(); c.moveTo(bx, y); c.quadraticCurveTo(bx + a * h * 0.3, y - h * 0.6, bx + a * h, y - h); c.stroke(); if (k % 3 === 0) { c.beginPath(); c.ellipse(bx + a * h * 0.8, y - h * 0.8, s * 0.06, s * 0.16, a, 0, TAU); c.fillStyle = '#7a4a26'; c.fill(); } } };
  switch (kind) {
    case 'hedge': if (r < 0.2) { sh(s * 0.4, 0.2); c.fillStyle = '#7a4e2a'; c.fillRect(x - s * 0.06, y - s * 0.6, s * 0.12, s * 0.6); const y2 = y - s * 0.55; c.save(); c.translate(0, -s * 0.5); clump('#3f7f2e', '#5aa03e', '#9ad466', '#2f5a22'); c.restore(); void y2; } else clump('#3f7f2e', '#5aa03e', '#8fcf5a', '#2f5a22'); break;
    case 'frost': if (r < 0.45) drift('#f4fbff', 'rgba(150,190,220,0.6)'); else { clump('#2f6a34', '#3f8a40', '#6ab057', '#1f4a24'); c.beginPath(); c.ellipse(x - s * 0.1, y - s * 0.66, s * 0.3, s * 0.1, -0.2, 0, TAU); c.ellipse(x + s * 0.22, y - s * 0.46, s * 0.18, s * 0.07, 0.2, 0, TAU); c.fillStyle = '#f6fbff'; c.fill(); } break;
    case 'snowrock': if (r < 0.3) drift('#f4fbff', 'rgba(140,170,215,0.6)'); else boulder('#4a3d78', '#6c5aa8', '#2a2050', '#f6fbff'); break;
    case 'lip': boulder('#3a2a3a', '#5a4258', '#1c1220', null); if (r > 0.4) { c.strokeStyle = 'rgba(255,140,50,0.8)'; c.lineWidth = Math.max(1, s * 0.05); c.beginPath(); c.moveTo(x - s * 0.2, y - s * 0.1); c.lineTo(x - s * 0.05, y - s * 0.35); c.lineTo(x + s * 0.12, y - s * 0.42); c.stroke(); } c.strokeStyle = 'rgba(255,150,70,0.55)'; c.lineWidth = Math.max(1, s * 0.05); c.beginPath(); c.moveTo(x - s * 0.5, y - s * 0.44); c.lineTo(x - s * 0.18, y - s * (0.72 + r * 0.2)); c.lineTo(x + s * 0.3, y - s * 0.62); c.stroke(); break;
    case 'basalt': boulder(r < 0.5 ? '#5a6578' : '#4a3a36', r < 0.5 ? '#8c98aa' : '#6a524a', '#2a2e3a', null); break;
    case 'wall': { // a low wall of dressed blocks, broken here and there
      if (r < 0.18) { boulder('#4a6278', '#7a92a8', '#1c2c3c', null); break; }
      const bw = s * 1.1, bh = s * 0.5; sh(bw * 0.55, 0.2);
      for (let k = 0; k < 2; k++) { const yy = y - k * bh, xx = x - bw / 2 + (k ? bw * 0.25 : 0), ww = k ? bw * 0.6 : bw; if (k && r < 0.5) break; c.fillStyle = '#5a7288'; c.fillRect(xx, yy - bh, ww, bh); c.fillStyle = '#8aa2b8'; c.fillRect(xx, yy - bh, ww, bh * 0.22); c.fillStyle = 'rgba(10,20,34,0.3)'; c.fillRect(xx + ww * 0.82, yy - bh, ww * 0.18, bh); c.strokeStyle = '#1c2c3c'; c.lineWidth = Math.max(1, s * 0.05); c.strokeRect(xx, yy - bh, ww, bh); }
      break;
    }
    case 'shore': if (r < 0.5) { drift('#ead39c', 'rgba(150,110,60,0.35)'); c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = Math.max(1, s * 0.07); c.beginPath(); c.moveTo(x - s * 0.6, y - s * 0.3); c.quadraticCurveTo(x - s * 0.3, y - s * 0.4, x, y - s * 0.3); c.quadraticCurveTo(x + s * 0.3, y - s * 0.2, x + s * 0.6, y - s * 0.32); c.stroke(); } else { drift('#e2c88e', 'rgba(150,110,60,0.35)'); c.beginPath(); c.ellipse(x, y - s * 0.12, s * 0.16, s * 0.1, -0.4, 0, TAU); c.fillStyle = '#ffb6a0'; c.fill(); c.strokeStyle = '#c0705a'; c.lineWidth = 1; c.stroke(); } break;
    case 'reeds': drift('#6a5a3a', 'rgba(30,30,10,0.35)'); reed(5, '#4a7a32', '#6a9a44'); break;
    case 'kerb': { if (r < 0.35) { reed(4, '#4a6a32', '#6a8a44'); break; } const bw = s * 1.2, bh = s * 0.34; sh(bw * 0.5, 0.2); c.fillStyle = '#6a7a98'; c.fillRect(x - bw / 2, y - bh, bw, bh); c.fillStyle = '#9aaac4'; c.fillRect(x - bw / 2, y - bh, bw, bh * 0.3); c.strokeStyle = '#2a3448'; c.lineWidth = Math.max(1, s * 0.05); c.strokeRect(x - bw / 2, y - bh, bw, bh); for (const k of [-0.35, 0.35]) { c.beginPath(); c.arc(x + k * bw, y - bh * 0.5, s * 0.05, 0, TAU); c.fillStyle = '#c8d2e4'; c.fill(); } break; }
    default: break;
  }
}

function bandCanvas(L, w, DPR) {
  const W = L.W, h = L.BH + (EDGE + HEAD) * L.u, key = `${W}x${L.BH}x${L.u.toFixed(3)}x${DPR}x${L.A.x}x${L.A.w}`;
  const hit = cache.get(w);
  if (hit && hit.key === key) { cache.delete(w); cache.set(w, hit); return hit.canvas; } // LRU touch
  if (typeof document === 'undefined') return null;
  const cv = (hit && hit.canvas) || document.createElement('canvas');
  cv.width = Math.ceil(W * DPR); cv.height = Math.ceil(h * DPR);
  const c = cv.getContext('2d'); c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, W, h);
  c.translate(0, HEAD * L.u); // the painters draw with y 0 at the crest's overhang; the headroom sits above it
  paintBand(c, L, w);
  cache.delete(w); cache.set(w, { canvas: cv, key });
  while (cache.size > 4) { const k0 = cache.keys().next().value; freeCanvas(cache.get(k0).canvas); cache.delete(k0); } // keep the few bands around the view (0.8.10: one that leaves gives its picture back at once)
  return cv;
}

// the land: sky above the summit, then each band in its look (painted once, blitted), top band first
export function drawLand(ctx, L, sy, vt, vb, DPR) {
  const W = L.W, u = L.u;
  // the summit sky
  const skyB = L.TOP + EDGE * u - sy;
  if (skyB > vt) { const g = ctx.createLinearGradient(0, -sy, 0, skyB); g.addColorStop(0, '#20305a'); g.addColorStop(1, '#5a7ab0'); ctx.fillStyle = g; ctx.fillRect(0, vt, W, Math.min(vb, skyB) - vt + 1); }
  for (let w = L.nw - 1; w >= 0; w--) {
    const top = L.bandTop(w) - (EDGE + HEAD) * u - sy, bot = L.bandTop(w) + L.BH - sy;
    if (bot < vt - 4 || top > vb + 4) continue;
    const cv = bandCanvas(L, w, DPR);
    if (cv) ctx.drawImage(cv, 0, top, W, L.BH + (EDGE + HEAD) * u);
  }
  // under World 1: the farm's soil
  const b0 = L.bandTop(0) + L.BH - sy;
  if (b0 < vb) { ctx.fillStyle = '#4e8a36'; ctx.fillRect(0, b0 - 1, W, vb - b0 + 2); }
}

// ------------------------------------------------------------------ the road
// 0.8.10 (mykee: "between the two worlds there is no proper connection ... a stutter in the pathway"): the road is ONE
// path from the summit down to the Farm, stroked in map space with gradients built once per layout, so its centre
// line, width and edges run on through every join; each world's colours hold inside the world and blend into the next
// over about a road width, centred where the world below's ground edge crosses the road. World 1's dirt road is painted
// with its land (mapfarm.js): the stroked road takes on the farm's dirt there and fades into it just under the crest.
const FARM_ROAD = ['#d8b07a', '#b3874f', 'rgba(255,255,255,0)'];
function roadKit(L, ctx) {
  if (L._road) return L._road;
  const u = L.u, H = L.H, B = L.roadW * 0.6, yEnd = L.TOP * 0.62, yStart = L.stops[0].y + L.BH * 0.12;
  const seams = []; for (let w = 0; w < L.nw - 1; w++) seams[w] = seamY(L, w); // seams[w]: between world w and w + 1
  const cols = (w, k) => (w === 0 ? FARM_ROAD : WORLD_LOOK[w].road)[k];
  const mk = (colOf) => { // one colour per world, blended across each join; on the farm side it fades into the painted road
    const g = ctx.createLinearGradient(0, 0, 0, H), stop = (y, c) => g.addColorStop(clamp(y / H, 0, 1), c);
    for (let w = L.nw - 1; w >= 0; w--) {
      const y0 = w === L.nw - 1 ? 0 : seams[w] + B, y1 = w === 0 ? H : seams[w - 1] - B;
      if (w === 0) { stop(y0, colOf(0)); stop(Math.min(H, y0 + 2.2 * L.roadW), withA(colOf(0), 0)); stop(H, withA(colOf(0), 0)); } else { stop(y0, colOf(w)); stop(y1, colOf(w)); }
    }
    return g;
  };
  // the arc length along the road from the summit, every 6 px of map y: the dashes stay put while the map scrolls
  const arc = []; let acc = 0, px = L.pathX(yEnd); for (let y = yEnd, i = 0; y <= yStart + 6; y += 6, i++) { const x = L.pathX(y); acc += i ? Math.hypot(x - px, 6) : 0; arc.push(acc); px = x; }
  L._road = {
    yEnd, yStart, seams, arc, farmY: seams[0] + B + 2.2 * L.roadW,
    shade: mk(() => 'rgba(20,10,0,0.22)'), edge: mk((w) => cols(w, 1)), fill: mk((w) => cols(w, 0)), dash: mk((w) => cols(w, 2)),
  };
  // the walked stretch: solid gold over the stroked worlds, the farm's softer gold trail over its dirt
  const gg = ctx.createLinearGradient(0, 0, 0, H), gs = (y, c) => gg.addColorStop(clamp(y / H, 0, 1), c);
  gs(0, '#f6c454'); gs(seams[0] - B, '#f6c454'); gs(seams[0] + B, 'rgba(255,206,84,0.6)'); gs(H, 'rgba(255,206,84,0.6)');
  const gh = ctx.createLinearGradient(0, 0, 0, H), hs = (y, c) => gh.addColorStop(clamp(y / H, 0, 1), c);
  hs(0, 'rgba(255,244,190,0.3)'); hs(seams[0] - B, 'rgba(255,244,190,0.3)'); hs(seams[0] + B, 'rgba(255,244,190,0.55)'); hs(H, 'rgba(255,244,190,0.55)');
  L._road.gold = gg; L._road.goldHi = gh;
  return L._road;
}
// a colour (#hex or rgba()) with its alpha set to a
function withA(c, a) {
  if (c[0] === '#') { const n = parseInt(c.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
  const m = c.match(/rgba?\(([^)]*)\)/); if (!m) return c; const p = m[1].split(',').map((v) => v.trim()); return `rgba(${p[0]},${p[1]},${p[2]},${(p[3] != null ? +p[3] : 1) * a})`;
}
export function drawRoad(ctx, L, sy, vt, vb, doneTo) {
  const u = L.u, K = roadKit(L, ctx), rw = L.roadW;
  const y0 = Math.max(K.yEnd, vt + sy - 40 * u), y1 = Math.min(K.yStart, K.farmY, vb + sy + 40 * u);
  if (y0 >= y1) { if (doneTo != null) gold(); return; }
  const i0 = Math.max(0, Math.floor((y0 - K.yEnd) / 6)), i1 = Math.ceil((y1 - K.yEnd) / 6);
  const path = (a, b) => { ctx.beginPath(); for (let i = a; i <= b; i++) { const y = Math.min(K.yEnd + i * 6, K.yStart); const x = L.pathX(y); if (i === a) ctx.moveTo(x, y); else ctx.lineTo(x, y); } };
  ctx.save(); ctx.translate(0, -sy); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  path(i0, i1);
  ctx.strokeStyle = K.shade; ctx.lineWidth = rw + 8 * u; ctx.stroke();
  ctx.strokeStyle = K.edge; ctx.lineWidth = rw + 3 * u; ctx.stroke();
  ctx.strokeStyle = K.fill; ctx.lineWidth = rw - 2 * u; ctx.stroke();
  ctx.restore();
  gold();
  ctx.save(); ctx.translate(0, -sy); ctx.lineCap = 'butt';
  path(i0, Math.min(i1, Math.ceil((K.seams[0] - K.yEnd) / 6)));
  ctx.setLineDash([6 * u, 9 * u]); ctx.lineDashOffset = K.arc[i0] || 0; ctx.strokeStyle = K.dash; ctx.lineWidth = 3 * u; ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
  // the stretch already walked shines gold (over the farm's painted road too)
  function gold() {
    if (doneTo == null || doneTo >= K.yStart) return;
    const a = Math.max(vt + sy - 40 * u, doneTo, K.yEnd), b = Math.min(vb + sy + 40 * u, K.yStart);
    if (a >= b) return;
    ctx.save(); ctx.translate(0, -sy); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); for (let y = a, f = 1; ; y += 6) { const yy = Math.min(y, b); const x = L.pathX(yy); if (f) { ctx.moveTo(x, yy); f = 0; } else ctx.lineTo(x, yy); if (yy >= b) break; }
    ctx.strokeStyle = K.gold; ctx.lineWidth = rw * 0.6; ctx.stroke();
    ctx.strokeStyle = K.goldHi; ctx.lineWidth = rw * 0.18; ctx.stroke();
    ctx.restore();
  }
}

// ------------------------------------------------------------------ the live layer: the cast and moving bits
const HKEYS = {};
// 0.8.12: a creature that wanders walks one way facing that way, eases to a stop, turns round (a quick squash
// through the middle, never a slide backwards), walks back and turns again. dx: its offset, f: its facing scale
// (1 right .. -1 left; the portraits face right)
const turnF = (q) => { const c = Math.cos(clamp(q, 0, 1) * Math.PI); return (c < 0 ? -1 : 1) * Math.max(0.15, Math.abs(c)); };
function pace(tt, A, walk = 2.6, rest = 1.2) {
  const C = 2 * (walk + rest), k = ((tt % C) + C) % C;
  if (k < walk) return { dx: lerp(-A, A, ss(k / walk)), f: 1 };
  if (k < walk + rest) return { dx: A, f: turnF((k - walk - rest * 0.3) / (rest * 0.45)) };
  if (k < 2 * walk + rest) return { dx: lerp(A, -A, ss((k - walk - rest) / walk)), f: -1 };
  return { dx: -A, f: -turnF((k - 2 * walk - rest - rest * 0.3) / (rest * 0.45)) };
}
function drawLive(ctx, L, w, e, i, t, calm) {
  const p = spotOf(L, w, e, i, true); if (!p) return;
  const { x, s } = p, u = L.u, k = e[0], face = p.side < 0 ? 1 : -1; // face the road
  const y = p.y - L.sy, tt = calm ? 0 : t + i * 1.7 + w * 0.9;
  const port = (kind, d, yy = y - d * 0.42, xx = x) => drawVillainPortrait(ctx, kind, xx, yy, d, tt);
  const roam = (kind, d, yy, A, walk, rest) => { // a portrait that paces: faces the way it goes, turns at the ends
    const P = calm ? { dx: 0, f: face } : pace(tt, A, walk, rest);
    ctx.save(); ctx.translate(x + P.dx, yy); ctx.scale(P.f, 1); drawVillainPortrait(ctx, kind, 0, 0, d, tt); ctx.restore();
  };
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
      const P = calm ? { dx: 0, f: face } : pace(tt * 0.8, s * 0.25, 3, 1.4);
      ctx.save(); ctx.translate(x + P.dx, y); ctx.scale(P.f, 1); drawGoose(ctx, 0, -s * 0.38, s * 0.6, goosePose('waddle', 0, tt)); ctx.restore();
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
      const P = calm ? { dx: 0, f: 1 } : pace(tt, s * 0.3, 1.8, 1), sx = x + P.dx, moving = Math.abs(P.f) === 1 && Math.abs(P.dx) < s * 0.29;
      ctx.beginPath(); ctx.ellipse(x, y - 3 * u, s * 0.62, s * 0.14, 0, 0, TAU); ctx.fillStyle = 'rgba(190,225,245,0.9)'; ctx.fill();
      ctx.save(); ctx.translate(sx, y - s * 0.2); ctx.scale(P.f, 1); ctx.rotate(moving ? 0.12 : 0); drawChick(ctx, 0, 0, s * 0.42, tt, 1, 0); ctx.restore(); // leans into the slide
      if (moving && !calm) { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.moveTo(sx - P.f * s * 0.3, y - 2 * u); ctx.lineTo(sx, y - 2 * u); ctx.stroke(); } // the scratch behind
      break;
    }
    case 'snowfall': if (!calm) for (let q = 0; q < 14; q++) { const fx2 = ((q * 37.3) % 100) / 100, py = ((t * 18 * u + q * 41 * u) % (s * 2)); blobAt(ctx, x - s + fx2 * s * 2 + Math.sin(t + q) * 6 * u, y - s * 2 + py, 2 * u, 'rgba(255,255,255,0.9)'); } break;
    case 'rats': roam('rats', s * 1.0, y - s * 0.45, s * 0.35, 2.2, 1.1); break;
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
    case 'weasel': coins(ctx, x - face * s * 0.5, y, s * 0.4); roam('weasel', s * 1.1, y - s * 0.45, s * 0.3, 2.4, 1.4); break;
    case 'puffer': { const b = calm ? 0 : Math.sin(tt * 1.2) * s * 0.1; port('puffer', s * 0.95, y - s * 0.55 + b); break; }
    case 'fish': roam('fish', s * 1.1, y - s * 0.5, s * 0.3, 3, 0.9); break;
    case 'hermit': roam('hermit', s, y - s * 0.4, s * 0.25, 3.4, 1.6); break;
    case 'jelly': port('jelly', s * 0.9, y - s * 0.6 + (calm ? 0 : Math.sin(tt * 1.1) * s * 0.15)); break;
    case 'bubbles': if (!calm) for (let q = 0; q < 8; q++) { const a = (t * 0.35 + q / 8) % 1; ctx.beginPath(); ctx.arc(x + Math.sin(q * 1.9 + a * 5) * s * 0.4, y - a * s * 1.8, (2 + (q % 3) * 1.5) * u, 0, TAU); ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - a)})`; ctx.lineWidth = 1.5 * u; ctx.stroke(); } break;
    case 'weedLive': break;
    case 'gator': { pond(ctx, x, y - s * 0.12, s * 0.75, s * 0.2, ['#6a8a5a', '#3a5a3a', 'rgba(20,40,20,0.4)']); ctx.save(); ctx.beginPath(); ctx.rect(x - s, y - s * 1.4, s * 2, s * 1.4 - s * 0.14); ctx.clip(); port('gator', s * 0.95, y - s * 0.2 + (calm ? 0 : Math.sin(tt * 0.8) * s * 0.03)); ctx.restore(); ctx.strokeStyle = 'rgba(200,230,200,0.5)'; ctx.lineWidth = 1.5 * u; ctx.beginPath(); ctx.ellipse(x, y - s * 0.14, s * 0.5 + (t % 2) * 6 * u, s * 0.07, 0, 0, TAU); ctx.stroke(); break; }
    case 'turtle': { ctx.fillStyle = '#6a4a2a'; ctx.beginPath(); ctx.ellipse(x, y - s * 0.06, s * 0.55, s * 0.1, 0, 0, TAU); ctx.fill(); port('turtle', s * 0.8, y - s * 0.34); break; }
    case 'frog': lily(ctx, x, y - s * 0.06, s * 0.9); port('frog', s * 0.7, y - s * 0.55); break;
    case 'mosquito': roam('mosquito', s, y - s * 0.6 + (calm ? 0 : Math.sin(tt * 3) * s * 0.04), s * 0.3, 1.8, 0.7); break;
    case 'spider': { const sw = calm ? 0 : Math.sin(tt * 1.3) * 0.2; ctx.strokeStyle = 'rgba(220,230,255,0.7)'; ctx.lineWidth = 1.2 * u; const ax = x, ay = y - s * 1.4, bx = ax + Math.sin(sw) * s * 0.7, by = ay + Math.cos(sw) * s * 0.7; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); port('spider', s * 0.8, by + s * 0.1, bx); break; }
    case 'beetle': roam('beetle', s, y - s * 0.3, s * 0.25, 3, 1.3); break;
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
    castBand(ctx, L, w, sy, t, calm, vt, vb);
  }
  L.sy = sy;
}
function castBand(ctx, L, w, sy, t, calm, vt = -Infinity, vb = Infinity) {
  L.sy = sy;
  if (PLACES[w]) { try { PLACES[w].drawLive(ctx, L, sy, t, calm, vt, vb); } catch (_) {} return; } // a place's own routines (mapfarm.js, mapcave.js)
  const S = STILL[w] || [], C = CAST[w] || [];
  const G = calm ? null : ambBand(L, w, sy, t);
  if (G) drawMapAmb(ctx, 'back', w, G);
  // 0.8.7: only what is on the screen is drawn. A band is taller than most phones, and every creature in it was
  // drawn every frame even when it sat above or below the view (about a third of the map's drawing while scrolling).
  const B = vb < Infinity ? bandLayout(L, w) : null, u = L.u;
  const off = (p, k) => { if (!p) return false; const y = p.y - sy, h = (TALL[k] || 1) * p.s * (AIRY[k] ? 2.2 : 1.5) + 70 * u; return y - h > vb || y + 80 * u < vt; };
  S.forEach((e, i) => { if (B && off(B.still[i], e[0])) return; try { drawStillLive(ctx, L, w, e, i, t, calm); } catch (_) {} });
  C.forEach((e, i) => { if (B && off(B.cast[i], e[0])) return; try { drawLive(ctx, L, w, e, i, t, calm); } catch (_) {} });
  if (G) drawMapAmb(ctx, 'front', w, G);
}
// 0.8.10: a level is starting, the map is off screen: every band picture but the played world's, every creature
// layer and every other world's landmarks go back to the phone (up to ~80 MB on a sharp screen were held through play)
export function mapRelease(keepWorld = -1) {
  for (const [w, e] of cache) if (w !== keepWorld) { freeCanvas(e.canvas); cache.delete(w); }
  for (const [w, e] of CASTC) { freeCanvas(e.cv); CASTC.delete(w); }
  freeLandmarks(keepWorld, PER);
  freeThieves(); freeSalamanders(); freeStops(); // 0.8.12: the Vault's thieves and the Volcano's salamanders are stamped from small pictures
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
  if (CASTC.size > 4) for (const k of [...CASTC.keys()]) { if (Math.abs(k - w) > 1) { freeCanvas(CASTC.get(k).cv); CASTC.delete(k); } }
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
// a world behind its gate: one soft veil of mist rising from the world's foot (where the gate card stands), thinning
// upward to a light haze, so the stops, their numbers and padlocks, and the world's life all still show through.
// 0.8.12: was a wash and six cloud puffs dropped over the stops and creatures. The veil is a small gradient strip made
// once and stretched (no gradient per frame).
let VEIL = null;
function veilStrip() {
  if (VEIL || typeof document === 'undefined') return VEIL;
  VEIL = document.createElement('canvas'); VEIL.width = 2; VEIL.height = 128;
  const g = VEIL.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128);
  for (let i = 0; i <= 12; i++) { const k = i / 12, q = Math.min(1, k / 0.84), a = k <= 0.84 ? 0.16 + 0.7 * q * q * q : 0.86 - 0.72 * ((k - 0.84) / 0.16) ** 0.7; gr.addColorStop(k, `rgba(238,243,250,${a.toFixed(3)})`); } // haze above, thick at the foot, then a soft lip below the edge
  g.fillStyle = gr; g.fillRect(0, 0, 2, 128);
  return VEIL;
}
// lift 0..1 (0.8.17, the world opening): the fog rolls away upward and thins out
export function drawFog(ctx, L, w, sy, t, calm, lift = 0) {
  const u = L.u, h = L.BH, top = L.bandTop(w) - sy - (calm ? 0 : lift * h * 0.6), v = veilStrip();
  if (lift >= 1) return;
  ctx.save(); ctx.globalAlpha *= 1 - lift;
  ctx.fillStyle = 'rgba(232,238,248,0.14)'; ctx.fillRect(0, top, L.W, h * 0.45); // the far part of the world: only a haze
  if (v) { const vh = (h * 0.55) / 0.84; ctx.drawImage(v, 0, 0, 2, 128, 0, top + h * 0.45, L.W, vh); } // thickening down to the world's foot, fading out just past it
  ctx.restore();
}


// ------------------------------------------------------------------ the stops: nests on the road (0.8.14)
// mykee 2026-11-24: "do we need to show flags for all the levels? ... the hen is not landing on the corresponding level".
// Every world now marks its levels the same way, ON the road at the stop: a won level is a straw nest with a golden egg
// that carries the number and its stars; the level to play is a bigger nest the hen stands in, a bright number badge in
// front; the next locked level an empty nest with one small padlock; every level after that only a pale stepping stone
// with a tiny number. A boss level's nest is bigger and its egg wears a crown. Each look is painted once into its own small
// picture (per level, per state) and stamped; only the ring and glow round the level to play are drawn live.
// states: 'won' | 'cur' | 'open' (playable, not the next one) | 'skip' (skipped: passed without stars) | 'next' (the
// next locked level) | 'far' (any later locked level)
// per-world straw: fill, shade, light, ink, bowl (the hollow), and the stepping stone's face and edge
const NEST_TINT = [
  { s: '#e9bd62', lo: '#b07a32', hi: '#fbe2a0', ink: '#6a4418', bowl: '#8a5a24', st: '#f4ead2', stE: '#a8834e' }, // farm
  { s: '#c99652', lo: '#7e5226', hi: '#e8c486', ink: '#47290e', bowl: '#5e3a18', st: '#e6dcc0', stE: '#6e4a26' }, // woods
  { s: '#e2c890', lo: '#a2865a', hi: '#fff4da', ink: '#5a4426', bowl: '#7e6440', st: '#ffffff', stE: '#7aa6c8' }, // frozen
  { s: '#d4ad70', lo: '#8e6a3a', hi: '#f2dcaa', ink: '#3a2614', bowl: '#5c4024', st: '#d8ccf2', stE: '#4a3a86' }, // caves
  { s: '#c99252', lo: '#7a4c22', hi: '#f0c482', ink: '#2a140a', bowl: '#4e2c14', st: '#8a7066', stE: '#2a1610' }, // volcano
  { s: '#d0bc90', lo: '#8c7a58', hi: '#f2e6c6', ink: '#463a26', bowl: '#6a5a3e', st: '#eef2f8', stE: '#5a667a' }, // storm
  { s: '#dcae52', lo: '#966822', hi: '#f8dc90', ink: '#48290a', bowl: '#6a4614', st: '#e8d6b0', stE: '#6a1a24' }, // vault
  { s: '#dcc48e', lo: '#9e8654', hi: '#f8ecc4', ink: '#4e3c1c', bowl: '#77623a', st: '#fff6dc', stE: '#a88a4e' }, // reef
  { s: '#b49a56', lo: '#6c5a2c', hi: '#dcc88a', ink: '#33260e', bowl: '#55441e', st: '#d8c8a0', stE: '#4e3418' }, // bayou
  { s: '#cfc096', lo: '#8c7c5a', hi: '#f0e6c6', ink: '#3a3226', bowl: '#665a40', st: '#e6ecf6', stE: '#5a6880' }, // lab
];
// sizes in units (x u). 0.8.17 (mykee: "the levels you're showing are too small ... the previous build was displaying quite
// good ... rather than making them smaller and adding the numbers on the map itself"): every stop is one marker family
// again, about the size of 0.8.12's discs. A locked level is a stone disc in the world's tint, its number in bold outlined
// digits and a padlock on its lower right. A won level keeps its nest and golden egg; its number rides on a round badge at
// the nest's front and its stars sit on a dark plate under the badge (bright gold with a dark outline, empty ones dark
// sockets, so they never melt into a yellow road). The level to play is the hen in a bigger nest with a bigger badge.
const NEST_RX = { won: 29, cur: 37, skip: 29 }; // a nest's half width; the hen's height in the level-to-play nest is 2 * L.stopR
const DISC_R = 24, BOSS_K = 1.22; // a disc's radius; a boss stop is this much bigger (and wears a crown)
const BADGE_R = { won: 13.5, skip: 13.5, cur: 16.5 };
const isNest = (st) => !!NEST_RX[st];
export function stopTint(w) { return NEST_TINT[w] || NEST_TINT[0]; }
const hexRGB = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const mixHex = (a, b, k) => { const A = hexRGB(a), B = hexRGB(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
const LOOKS = new Map();
function stopLook(w) { // a world's marker colours: its accent (badges, open discs) and its stone (locked discs)
  let o = LOOKS.get(w); if (o) return o;
  const acc = (WORLD_LOOK[w] || WORLD_LOOK[0]).accent, stone = mixHex('#a2a6ae', acc, 0.16);
  o = { accHi: mixHex(acc, '#ffffff', 0.4), acc, accLo: mixHex(acc, '#000000', 0.32), accInk: mixHex(acc, '#000000', 0.66),
    stHi: mixHex(stone, '#ffffff', 0.45), st: stone, stLo: mixHex(stone, '#000000', 0.3), stInk: mixHex(stone, '#000000', 0.68) };
  LOOKS.set(w, o); return o;
}
const BOSS_LOOK = { accHi: '#ff8aa4', acc: '#d82a5a', accLo: '#8e1238', accInk: '#40061a' };
const SKIP_LOOK = { accHi: '#a8c0e8', acc: '#5a7ab0', accLo: '#3a5488', accInk: '#16264a' };
// the touch box round a stop's centre (main.js keeps it at least 48 px each way)
export function stopBox(L, st, boss) {
  const u = L.u, b = boss ? BOSS_K : 1;
  if (st === 'cur') { const d = nestDims(L, st, boss); return { x0: -d.rx, x1: d.rx, y0: -L.stopR * 1.9, y1: d.by + d.br + 3 * u }; }
  if (isNest(st)) { const d = nestDims(L, st, boss); return { x0: -d.rx, x1: d.rx, y0: -34 * u * b, y1: d.by + d.br + 13 * u }; }
  const r = DISC_R * u * b;
  return { x0: -r - 2 * u, x1: r + 2 * u, y0: -r - (boss ? 9 : 2) * u, y1: r + 3 * u };
}
const SPRS = new Map(); // key -> { cv, ox, oy, w, h }
export function freeStops() { for (const e of SPRS.values()) freeCanvas(e.cv); SPRS.clear(); }
let FONTOK = 0;
function stopFont() { if (FONTOK) return 1; try { if (typeof document !== 'undefined' && document.fonts && document.fonts.check('600 16px Fredoka')) FONTOK = 1; } catch (_) { FONTOK = 1; } return FONTOK; }
// a straw nest seen from the front and above: shadow, the woven body, the hollow, straws over the rim. part 'back' is
// the whole nest; 'front' only its front rim (drawn after the hen so her feet sit in the straw)
function strawNest(c, rx, ry, T, part, seed) {
  const bowlY = -ry * 0.1, brx = rx * 0.7, bry = ry * 0.62;
  const body = () => { c.beginPath(); c.ellipse(0, 0, rx, ry, 0, Math.PI, TAU); c.bezierCurveTo(rx * 1.02, ry * 0.7, rx * 0.7, ry * 1.32, 0, ry * 1.34); c.bezierCurveTo(-rx * 0.7, ry * 1.32, -rx * 1.02, ry * 0.7, -rx, 0); c.closePath(); };
  c.save();
  if (part === 'front') { c.beginPath(); c.rect(-rx * 1.3, bowlY, rx * 2.6, ry * 3); c.ellipse(0, bowlY, brx, bry, 0, 0, TAU, true); c.clip('evenodd'); }
  if (part !== 'front') { c.beginPath(); c.ellipse(0, ry * 1.1, rx * 1.12, ry * 0.62, 0, 0, TAU); c.fillStyle = 'rgba(20,10,0,0.28)'; c.fill(); }
  body(); c.fillStyle = lg(c, 0, -ry, 0, ry * 1.34, [T.hi, T.s, T.lo]); c.fill();
  c.lineWidth = Math.max(1, rx * 0.06); c.strokeStyle = T.ink; c.stroke();
  // the hollow
  if (part !== 'front') { c.beginPath(); c.ellipse(0, bowlY, brx, bry, 0, 0, TAU); c.fillStyle = lg(c, 0, bowlY - bry, 0, bowlY + bry, [T.ink, T.bowl]); c.fill(); }
  // woven straws: short arcs round the body, light over dark
  const R = rng(seed);
  c.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const a0 = R() * TAU, a1 = a0 + 0.5 + R() * 0.7, k = 0.78 + R() * 0.3, yy = R() * ry * 0.7;
    c.beginPath(); c.ellipse(0, yy * 0.6, rx * k, ry * (0.7 + R() * 0.3), 0, a0, a1);
    c.strokeStyle = i % 3 === 0 ? T.lo : i % 3 === 1 ? T.hi : T.s; c.lineWidth = Math.max(1, rx * (0.05 + R() * 0.03)); c.stroke();
  }
  // a few loose straws sticking out of the rim
  for (let i = 0; i < 7; i++) { const a = Math.PI + R() * Math.PI, x = Math.cos(a) * rx * 0.96, y = Math.sin(a) * ry * 0.96, l = rx * (0.14 + R() * 0.12), d = (R() - 0.5) * 1.2 + (x < 0 ? -0.6 : 0.6); c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a + d) * l, y + Math.sin(a + d) * l * 0.7); c.strokeStyle = T.hi; c.lineWidth = Math.max(1, rx * 0.045); c.stroke(); }
  c.restore();
  return { bowlY, brx, bry };
}
function eggShape(c, x, yb, w, h) { // an egg standing on (x, yb), w wide, h tall: a round lower half, a taller narrower dome
  const ym = yb - h * 0.42, rx = w / 2;
  c.beginPath(); c.ellipse(x, ym, rx, h * 0.42, 0, 0, Math.PI); c.ellipse(x, ym, rx, h * 0.58, 0, Math.PI, TAU); c.closePath();
}
function goldEgg(c, x, yb, w, h, u) {
  eggShape(c, x, yb, w, h);
  const g = c.createRadialGradient(x - w * 0.18, yb - h * 0.66, w * 0.05, x, yb - h * 0.4, h * 0.75); g.addColorStop(0, '#fff8d0'); g.addColorStop(0.35, '#ffd650'); g.addColorStop(0.8, '#e89a18'); g.addColorStop(1, '#b86c08');
  c.fillStyle = g; c.fill(); c.lineWidth = Math.max(1.2, 1.8 * u); c.strokeStyle = '#7a4204'; c.stroke();
  c.beginPath(); c.ellipse(x - w * 0.2, yb - h * 0.7, w * 0.09, h * 0.13, -0.4, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.75)'; c.fill();
}
function crownMark(c, x, y, s) { // a small gold crown, its base on y
  c.save(); c.translate(x, y); c.lineJoin = 'round';
  c.beginPath(); c.moveTo(-s, 0); c.lineTo(-s * 1.08, -s * 0.95); c.lineTo(-s * 0.48, -s * 0.48); c.lineTo(0, -s * 1.2); c.lineTo(s * 0.48, -s * 0.48); c.lineTo(s * 1.08, -s * 0.95); c.lineTo(s, 0); c.closePath();
  c.lineWidth = s * 0.34; c.strokeStyle = '#4a1a04'; c.stroke(); c.fillStyle = lg(c, 0, -s * 1.2, 0, 0, ['#fff0a0', '#f2a516']); c.fill();
  blobAt(c, 0, -s * 0.38, s * 0.18, '#e8402e'); c.restore();
}
function numText(c, str, x, y, size, fill, ink, wgt = 600) {
  c.font = `${wgt} ${Math.round(size)}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineJoin = 'round'; c.lineWidth = Math.max(2.5, size * 0.26); c.strokeStyle = ink; c.strokeText(str, x, y); c.fillStyle = fill; c.fillText(str, x, y);
}
// a hard level (sim.js HARD_IDS): a small red badge with three white thorns
function hardMark(c, x, y, r) {
  c.save(); c.translate(x, y); c.lineJoin = 'round';
  c.beginPath(); c.arc(0, 0, r * 1.36, 0, TAU); c.fillStyle = '#2a1606'; c.fill();
  c.beginPath(); c.arc(0, 0, r * 1.2, 0, TAU); c.fillStyle = '#fff6dc'; c.fill();
  c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fillStyle = lg(c, 0, -r, 0, r, ['#f2553a', '#b8201a']); c.fill();
  c.fillStyle = '#ffffff';
  for (const [dx, h] of [[-0.42, 0.62], [0, 0.95], [0.42, 0.62]]) { c.beginPath(); c.moveTo((dx - 0.24) * r, r * 0.42); c.lineTo(dx * r, r * 0.42 - h * r); c.lineTo((dx + 0.24) * r, r * 0.42); c.closePath(); c.fill(); }
  c.restore();
}
function rrect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function starPath(c, x, y, r) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.5 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); }
// a star on a marker: bright gold with a dark outline and a white glint; an empty one is a dark socket
export function brightStar(c, x, y, r, on) {
  c.save(); c.lineJoin = 'round';
  starPath(c, x, y, r);
  if (!on) { c.fillStyle = 'rgba(0,0,0,0.55)'; c.fill(); c.lineWidth = Math.max(1, r * 0.16); c.strokeStyle = 'rgba(255,236,190,0.3)'; c.stroke(); c.restore(); return; }
  c.lineWidth = r * 0.44; c.strokeStyle = '#3a1800'; c.stroke();
  c.fillStyle = lg(c, x, y - r, x, y + r * 0.8, ['#fffbd2', '#ffd92e', '#ffa20c']); c.fill();
  c.beginPath(); c.ellipse(x - r * 0.26, y - r * 0.3, r * 0.2, r * 0.12, -0.6, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.95)'; c.fill();
  c.restore();
}
// the number badge: a dark outline, a cream ring, the colour, a glint, the number in white
function badge(c, x, y, r, K, num, u) {
  c.beginPath(); c.arc(x, y + 1.8 * u, r + 2.6 * u, 0, TAU); c.fillStyle = 'rgba(20,8,0,0.35)'; c.fill();
  c.beginPath(); c.arc(x, y, r + 2.6 * u, 0, TAU); c.fillStyle = '#2a1606'; c.fill();
  c.beginPath(); c.arc(x, y, r + 1.3 * u, 0, TAU); c.fillStyle = '#fff6dc'; c.fill();
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = lg(c, x, y - r, x, y + r, [K.accHi, K.acc, K.accLo]); c.fill();
  c.beginPath(); c.ellipse(x, y - r * 0.52, r * 0.6, r * 0.28, 0, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.3)'; c.fill();
  numText(c, num, x, y + 0.6 * u, r * (num.length > 1 ? 1.16 : 1.32), '#ffffff', K.accInk);
}
// the dark plate under a won badge with the level's stars (or, skipped, two chevrons); y is its top
function starPlate(c, x, y, n, u, skip) {
  const w = 52 * u, h = 16 * u;
  rrect(c, x - w / 2, y, w, h, h / 2); c.fillStyle = 'rgba(30,16,6,0.9)'; c.fill(); c.lineWidth = 1.2 * u; c.strokeStyle = 'rgba(255,232,170,0.6)'; c.stroke();
  if (skip) { c.fillStyle = '#c8d8f4'; for (const dx of [-5, 3]) { c.beginPath(); c.moveTo(x + (dx - 3) * u, y + 3.5 * u); c.lineTo(x + (dx + 3) * u, y + h / 2); c.lineTo(x + (dx - 3) * u, y + h - 3.5 * u); c.closePath(); c.fill(); } return; }
  for (let q = 0; q < 3; q++) brightStar(c, x + (q - 1) * 15.5 * u, y + h / 2 + 0.4 * u, 6.6 * u, q < n);
}
// a padlock (s: its half width). part: 'all' | 'shackle' | 'left' | 'right' (the body's halves, split along a crack);
// o: { rot, a (alpha), crack 0..1 }
function padlock(c, x, y, s, o = {}) {
  const part = o.part || 'all', ink = '#3a2410';
  c.save(); c.translate(x, y); if (o.rot) c.rotate(o.rot); if (o.a != null) c.globalAlpha *= clamp(o.a, 0, 1);
  c.lineCap = 'round'; c.lineJoin = 'round';
  if (part === 'all' || part === 'shackle') for (const [lw, col] of [[s * 0.62, ink], [s * 0.34, '#e8eef4']]) { c.lineWidth = lw; c.strokeStyle = col; c.beginPath(); c.moveTo(-s * 0.55, -s * 0.1); c.lineTo(-s * 0.55, -s * 0.55); c.arc(0, -s * 0.55, s * 0.55, Math.PI, 0); c.lineTo(s * 0.55, -s * 0.1); c.stroke(); }
  if (part !== 'shackle') {
    const crack = [[0.1, -0.2], [-0.12, 0.25], [0.12, 0.62], [-0.06, 0.98], [0.04, 1.3]];
    c.save();
    if (part === 'left' || part === 'right') { const sg = part === 'left' ? -1 : 1; c.beginPath(); crack.forEach(([px, py], i) => (i ? c.lineTo(px * s, py * s) : c.moveTo(px * s, py * s))); c.lineTo(sg * 1.3 * s, 1.3 * s); c.lineTo(sg * 1.3 * s, -0.3 * s); c.closePath(); c.clip(); }
    rrect(c, -s, -s * 0.2, s * 2, s * 1.5, s * 0.34); c.fillStyle = lg(c, 0, -s * 0.2, 0, s * 1.3, ['#ffe486', '#f5b22a', '#d8800a']); c.fill();
    c.lineWidth = s * 0.17; c.strokeStyle = ink; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.65)'; c.lineWidth = s * 0.12; c.beginPath(); c.moveTo(-s * 0.62, 0); c.lineTo(s * 0.3, 0); c.stroke();
    c.fillStyle = ink; c.beginPath(); c.arc(0, s * 0.42, s * 0.22, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(-s * 0.1, s * 0.5); c.lineTo(s * 0.1, s * 0.5); c.lineTo(s * 0.16, s * 0.98); c.lineTo(-s * 0.16, s * 0.98); c.closePath(); c.fill();
    if (o.crack > 0) { c.globalAlpha *= clamp(o.crack, 0, 1); c.beginPath(); crack.forEach(([px, py], i) => (i ? c.lineTo(px * s, py * s) : c.moveTo(px * s, py * s))); c.strokeStyle = ink; c.lineWidth = s * 0.16; c.stroke(); c.strokeStyle = '#fff6c8'; c.lineWidth = s * 0.06; c.stroke(); }
    c.restore();
  }
  c.restore();
}
// a padlock breaking away: shakes (s < 0.32), cracks, the shackle pops off spinning, the two halves fall apart and fade,
// gold sparks fly. s: seconds since it started; k: size; calm: it only fades
function lockBreak(ctx, x, y, ls, s, calm, u) {
  if (s < 0) { padlock(ctx, x, y, ls); return; }
  if (calm) { if (s < 0.4) padlock(ctx, x, y, ls, { a: 1 - s / 0.4 }); return; }
  const POP = 0.32;
  if (s < POP) { const k = s / POP, rot = Math.sin(s * 52) * 0.32 * k, dx = Math.sin(s * 63) * ls * 0.14 * k; padlock(ctx, x + dx, y, ls, { rot, crack: ss((s - 0.16) / 0.12) }); return; }
  const q = s - POP, a = 1 - ss((q - 0.2) / 0.3), sc = ls / 8;
  if (a > 0.01) {
    padlock(ctx, x + q * 46 * u * sc, y - (q * 120 - q * q * 330) * u * sc, ls, { part: 'shackle', rot: q * 10, a });
    padlock(ctx, x - q * 26 * u * sc, y + q * q * 260 * u * sc, ls, { part: 'left', rot: -q * 3.2, a, crack: 1 });
    padlock(ctx, x + q * 30 * u * sc, y + q * q * 300 * u * sc, ls, { part: 'right', rot: q * 3.6, a, crack: 1 });
  }
  if (q < 0.55) { // sparks
    const f = q / 0.55, e = 1 - (1 - f) * (1 - f);
    ctx.save(); ctx.globalAlpha = 1 - f;
    for (let i = 0; i < 9; i++) { const an = (i / 9) * TAU + 0.35, d = ls * (0.8 + e * 3.4) * (i % 2 ? 1 : 0.8); brightStar(ctx, x + Math.cos(an) * d, y + ls * 0.4 + Math.sin(an) * d * 0.85, ls * 0.34 * (1 - f * 0.5), true); }
    ctx.restore();
  }
}
// a locked stop: a stone disc on the road, the world's tint in the stone; an open (playable, not yet played) one: the same
// disc in the world's colour
function disc(c, r, K, num, u, open) {
  c.beginPath(); c.ellipse(0, r * 0.82, r * 0.98, r * 0.3, 0, 0, TAU); c.fillStyle = 'rgba(20,10,0,0.3)'; c.fill();
  c.beginPath(); c.arc(0, 0.9 * u, r + 2.2 * u, 0, TAU); c.fillStyle = open ? '#2a1606' : K.stInk; c.fill();
  c.beginPath(); c.arc(0, 1.6 * u, r, 0, TAU); c.fillStyle = open ? K.accLo : K.stLo; c.fill(); // its edge, seen a little from above
  c.beginPath(); c.arc(0, -0.8 * u, r - 0.6 * u, 0, TAU); c.fillStyle = lg(c, 0, -r, 0, r, open ? [K.accHi, K.acc] : [K.stHi, K.st]); c.fill();
  c.beginPath(); c.arc(0, -0.8 * u, r * 0.8, 0, TAU); c.lineWidth = 1.3 * u; c.strokeStyle = 'rgba(255,255,255,0.32)'; c.stroke();
  c.beginPath(); c.ellipse(-r * 0.3, -r * 0.55, r * 0.32, r * 0.14, -0.5, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fill();
  numText(c, num, 0, -0.4 * u, r * (num.length > 1 ? 0.86 : 0.96), '#ffffff', open ? K.accInk : K.stInk);
}
// paint one stop's picture (origin = the stop's centre on the road). part: 'back' (a nest's body, hollow and egg) |
// 'front' (its front rim, badge, plate and marks: drawn after the hen when she sits in it) | 'all'
function paintStop(c, u, st, part, o) {
  const K = stopLook(o.w), boss = !!o.boss, b = boss ? BOSS_K : 1, num = String(o.num);
  if (!isNest(st)) {
    const r = DISC_R * u * b, open = st === 'open';
    disc(c, r, boss && open ? BOSS_LOOK : K, num, u, open);
    if (boss) crownMark(c, 0, -r - 0.5 * u, 7.5 * u);
    if (!open && !o.noLock) padlock(c, r * 0.64, r * 0.5, 7.6 * u * b);
    if (o.hard) hardMark(c, -r * 0.7, r * 0.56, 6.6 * u);
    return;
  }
  const T = stopTint(o.w), seed = 11 + o.num * 7, d = nestD(u, st, boss);
  if (part !== 'front') {
    const nb = strawNest(c, d.rx, d.ry, T, 'back', seed);
    if (st === 'won') { const ew = 27 * u * b, eh = 34 * u * b, yb = nb.bowlY + nb.bry * 1.05; goldEgg(c, 0, yb, ew, eh, u); if (boss) crownMark(c, 0, yb - eh + 3 * u, 7 * u); }
  }
  if (part === 'back') return;
  strawNest(c, d.rx, d.ry, T, 'front', seed);
  if (st !== 'cur') starPlate(c, 0, d.by + d.br - 2.5 * u, o.stars | 0, u, st === 'skip');
  badge(c, 0, d.by, d.br, st === 'skip' ? SKIP_LOOK : boss ? BOSS_LOOK : K, num, u);
  if (boss && st === 'cur') crownMark(c, 0, d.by - d.br - 1.5 * u, 6.5 * u);
  if (o.hard) hardMark(c, -d.rx * 0.86, d.ry * 0.5, 6.6 * u);
}
// draw stop `o.num` (o: { w, num, stars, boss, hard, DPR, part: 'back' | 'front' | 'all', p: press 0..1, noLock }) centred on (x, y)
export function drawStop(ctx, L, x, y, st, o) {
  const u = L.u, DPR = o.DPR || 1, part = isNest(st) ? o.part || 'all' : 'all';
  const key = `${st}|${part}|${o.num}|${o.stars | 0}|${o.boss ? 1 : 0}${o.hard ? 'h' : ''}${o.noLock ? 'n' : ''}|${o.w}|${u.toFixed(3)}|${DPR}|${stopFont()}`;
  let e = SPRS.get(key);
  if (!e) {
    if (typeof document === 'undefined') return;
    const ox = 60 * u, oy = 84 * u, w = 120 * u, h = 136 * u;
    const cv = document.createElement('canvas'); cv.width = Math.ceil(w * DPR); cv.height = Math.ceil(h * DPR);
    const c = cv.getContext('2d'); c.setTransform(DPR, 0, 0, DPR, ox * DPR, oy * DPR);
    try { if (part === 'all' && isNest(st)) { paintStop(c, u, st, 'back', o); paintStop(c, u, st, 'front', o); } else paintStop(c, u, st, part, o); } catch (_) { /* a stop never breaks the map */ }
    e = { cv, ox, oy, w, h };
    SPRS.set(key, e);
    if (SPRS.size > 48) { const k0 = SPRS.keys().next().value; freeCanvas(SPRS.get(k0).cv); SPRS.delete(k0); }
  } else { SPRS.delete(key); SPRS.set(key, e); } // LRU touch
  const p = o.p || 0;
  if (p) { ctx.save(); ctx.translate(x, y + 10 * u); ctx.scale(1 + 0.05 * p, 1 - 0.07 * p); ctx.translate(-x, -y - 10 * u); }
  ctx.drawImage(e.cv, x - e.ox, y - e.oy, e.w, e.h);
  if (p) ctx.restore();
}
const backOut = (k) => { const c1 = 1.9, c3 = c1 + 1, q = k - 1; return 1 + c3 * q * q * q + c1 * q * q; };
// 0.8.17 (mykee: "show the user that the lock icon completely breaks away"): a level opening as the hen sets off for it.
// s: seconds since it began (about 0.95 s): the padlock shakes, cracks and breaks away (lockBreak), then the stone disc
// gives way to the level-to-play nest and badge with a small bounce. Calm: the lock fades, the marker cross-fades.
export const UNLOCK_T = 0.95;
export function drawUnlock(ctx, L, x, y, o, s, calm) {
  const u = L.u, b = o.boss ? BOSS_K : 1, r = DISC_R * u * b, T0 = 0.48;
  const fade = ss((s - T0) / 0.3);
  if (fade < 1) {
    ctx.save(); ctx.globalAlpha *= 1 - fade;
    if (!calm && fade > 0) { const sc = 1 - 0.3 * fade; ctx.translate(x, y); ctx.scale(sc, sc); ctx.translate(-x, -y); }
    drawStop(ctx, L, x, y, 'next', { ...o, noLock: 1 }); ctx.restore();
  }
  if (s > T0) {
    const k = clamp((s - T0) / (UNLOCK_T - T0), 0, 1), sc = calm ? 1 : 0.5 + 0.5 * backOut(k);
    ctx.save(); ctx.globalAlpha *= calm ? k : ss(k * 3);
    if (sc !== 1) { ctx.translate(x, y + 12 * u); ctx.scale(sc, sc); ctx.translate(-x, -y - 12 * u); }
    drawStop(ctx, L, x, y, 'cur', { ...o, part: 'all' }); ctx.restore();
  }
  lockBreak(ctx, x + r * 0.64, y + r * 0.5, 7.6 * u * b, s, calm, u);
}
// the level to play: a soft glow on the ground and a ring that swells and fades (both cheap: a stamped glow, one stroke)
let GLOW = null;
export function drawStopCall(ctx, L, x, y, t, calm, boss) {
  const u = L.u, rx = NEST_RX.cur * u * (boss ? BOSS_K : 1), ry = rx * 0.4;
  if (!GLOW && typeof document !== 'undefined') { GLOW = document.createElement('canvas'); GLOW.width = GLOW.height = 64; const g = GLOW.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,236,150,0.9)'); gr.addColorStop(0.5, 'rgba(255,214,90,0.45)'); gr.addColorStop(1, 'rgba(255,214,90,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }
  const k = calm ? 0.5 : 0.5 + 0.5 * Math.sin(t * 3.2);
  if (GLOW) { ctx.globalAlpha = 0.55 + 0.3 * k; ctx.drawImage(GLOW, x - rx * 1.7, y + ry * 0.3 - ry * 2.6, rx * 3.4, ry * 5.2); ctx.globalAlpha = 1; }
  ctx.lineWidth = 3 * u; ctx.strokeStyle = '#fff4c0';
  if (calm) { ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.ellipse(x, y + ry * 0.4, rx * 1.3, ry * 1.6, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; return; }
  for (let q = 0; q < 2; q++) { const f = (t * 0.7 + q * 0.5) % 1; ctx.globalAlpha = 0.75 * (1 - f); ctx.beginPath(); ctx.ellipse(x, y + ry * 0.4, rx * (1.08 + 0.55 * f), ry * (1.4 + 0.7 * f), 0, 0, TAU); ctx.stroke(); }
  ctx.globalAlpha = 1;
}
// a nest's measures (px): half width and height, the hollow, the badge's centre and radius
function nestD(u, st, boss) { const b = boss ? BOSS_K : 1, rx = NEST_RX[st] * u * b, ry = rx * 0.4; return { rx, ry, bowlY: -ry * 0.1, brx: rx * 0.7, bry: ry * 0.62, by: ry * 1.12, br: (BADGE_R[st] + (boss ? 1.5 : 0)) * u }; }
const nestDims = (L, st, boss) => nestD(L.u, st, boss);
// where the hen's feet rest on a stop: y below the stop's centre (px)
export function stopFeet(L, boss) { const ry = NEST_RX.cur * L.u * (boss ? BOSS_K : 1) * 0.4; return -ry * 0.1 + ry * 0.62 * 0.85; }
// 0.8.16 (mykee: "the hen doesn't sit in the nest, they are coinciding or overlapping"): she sits IN it: her body sinks
// until the nest's near lip crosses it SEAT_Y units down her 100-unit height (drawHenAnim: her feet at 48). 0.8.17: the
// nest's front rim and badge are drawn over her (main.js: the stop's 'front' part), so nothing of the nest shows through
// her; nestClip only hides what of her would poke out under the nest's bottom.
const SEAT_Y = 27;
export function nestSeat(L, st, boss, hh) { if (!isNest(st)) return 0; const d = nestDims(L, st, boss); return d.bowlY + d.bry + ((48 - SEAT_Y) * hh) / 100; }
export function nestClip(ctx, L, x, y, st, boss) {
  if (!isNest(st)) return;
  const d = nestDims(L, st, boss), rx = d.rx * 1.02, ry = d.ry;
  ctx.beginPath(); ctx.rect(-1e5, -1e5, 2e5, 2e5);
  ctx.moveTo(x + rx, y); ctx.bezierCurveTo(x + rx, y + ry * 0.7, x + rx * 0.7, y + ry * 1.32, x, y + ry * 1.34); ctx.bezierCurveTo(x - rx * 0.7, y + ry * 1.32, x - rx, y + ry * 0.7, x - rx, y);
  ctx.lineTo(x - rx, y + ry * 8); ctx.lineTo(x + rx, y + ry * 8); ctx.closePath();
  ctx.clip('evenodd');
}

// ------------------------------------------------------------------ a world's gate (0.8.17)
// mykee: "we could have shown it to the user without the help of a pop-up". A world behind its star gate shows a wooden
// gate across the road at its foot (where its sign stands once it is open): two posts and a beam, two plank doors, a big
// padlock on the seam, and one board hanging from the post arm with a star, have / need and a thin bar. main.js hangs the
// coin button under the board (the first locked world only) and runs the opening (o.s).
export function gateSpot(L, w) {
  if (L._gates && L._gates[w]) return L._gates[w];
  const u = L.u, A = L.A, y = L.bandTop(w) + L.BH * 0.955, x = L.pathX(y);
  const slope = (L.pathX(y - 4) - L.pathX(y + 4)) / 8, half = (L.roadW / 2) * Math.sqrt(1 + slope * slope) + 5 * u;
  const bw = 132 * u, bh = 54 * u, pw = 9 * u, pref = x < L.cx ? 1 : -1;
  // keep the board and its button clear of the world's first stop, the stop below the gate (the hen may sit there) and
  // that stop's boss chest: the roomier side first, then the other, then a little lower
  const st = L.stops, s0 = st.find((q) => q.w === w), s1 = [...st].reverse().find((q) => q.w === w - 1), keep = [];
  if (s0) { const r = (DISC_R * BOSS_K + 4) * u; keep.push({ x0: s0.x - r, x1: s0.x + r, y0: s0.y - r - 10 * u, y1: s0.y + r + 4 * u }); }
  if (s1) {
    keep.push({ x0: s1.x - 44 * u, x1: s1.x + 44 * u, y0: s1.y - 64 * u, y1: s1.y + 46 * u });
    const r = Math.max(L.stopR * 1.2, 46 * u), cr = Math.min(L.stopR * 1.14, 34 * u); let sd = s1.x < A.cx ? -1 : 1, cx = s1.x + sd * (r + cr * 1.25);
    if (cx - cr < A.x + 4 * u || cx + cr > A.x1 - 4 * u) cx = s1.x - sd * (r + cr * 1.25);
    const cy = s1.y - r * 0.15; keep.push({ x0: cx - cr * 1.1, x1: cx + cr * 1.1, y0: cy - cr * 1.1, y1: cy + cr * 1.3 });
  }
  const make = (side, dy) => {
    const postX = x + side * (half + pw / 2), bx = clamp(side > 0 ? postX + 16 * u : postX - 16 * u - bw, A.x + 6 * u, A.x1 - 6 * u - bw);
    const board = { x: bx, y: y - 50 * u + dy, w: bw, h: bh }, btn = { x: bx + 6 * u, y: board.y + bh + 12 * u, w: bw - 12 * u, h: 38 * u };
    const box = { x0: Math.min(postX, bx) - 3 * u, x1: Math.max(postX, bx + bw) + 3 * u, y0: board.y - 14 * u, y1: btn.y + btn.h + 3 * u };
    return { x, y, half, side, pw, postX, board, btn, box, hit: keep.some((k) => box.x0 < k.x1 && box.x1 > k.x0 && box.y0 < k.y1 && box.y1 > k.y0) };
  };
  let g = null;
  for (const [sd, dy] of [[pref, 0], [pref, 12], [-pref, 0], [-pref, 12], [pref, 24], [-pref, 24], [pref, 36], [-pref, 36]]) { const c = make(sd, dy * u); if (!c.hit) { g = c; break; } }
  if (!g) g = make(pref, 0);
  (L._gates || (L._gates = {}))[w] = g;
  return g;
}
function woodRect(c, x, y, w, h, r, u, hi = '#d9ab68', lo = '#9a6a32') { rrect(c, x, y, w, h, r); c.fillStyle = lg(c, x, y, x, y + h, [hi, lo]); c.fill(); c.lineWidth = 2.4 * u; c.strokeStyle = '#4a2c10'; c.stroke(); }
// o: { have, need, s (seconds into the opening, or < 0 shut), calm, coin (the coin button hangs under the board) }
export function drawGate(ctx, L, w, sy, o) {
  const u = L.u, g = gateSpot(L, w), y = g.y - sy, x = g.x, s = o.s == null ? -1 : o.s, calm = !!o.calm;
  const fadeAll = s < 0 ? 1 : 1 - ss((s - 1.05) / 0.3);
  if (fadeAll <= 0.01) return g;
  const c = ctx; c.save(); c.globalAlpha *= fadeAll; c.lineJoin = 'round'; c.lineCap = 'round';
  const half = g.half, pw = g.pw, ph = 58 * u, top = y - ph;
  const open = s < 0 ? 0 : ss((s - 0.38) / 0.5); // the doors swing open
  // the doors: plank leaves hinged on the posts, meeting on the road's middle; opening, each turns in to its post
  for (const sd of [-1, 1]) {
    const hx = x + sd * half, f = Math.cos(open * 1.45), fx = hx - sd * half * f, grow = open * 7 * u, y0 = y - 40 * u, y1 = y - 3 * u;
    c.beginPath(); c.moveTo(hx, y0); c.lineTo(fx, y0 - grow * 0.5); c.lineTo(fx, y1 + grow * 0.5); c.lineTo(hx, y1); c.closePath();
    c.fillStyle = lg(c, hx, 0, fx, 0, open > 0.05 ? ['#b07c40', mixHex('#c9945a', '#5a3a1a', open * 0.6)] : ['#c9945a', '#b07c40']); c.fill();
    c.lineWidth = 2.2 * u; c.strokeStyle = '#4a2c10'; c.stroke();
    if (f > 0.15) { // planks and the Z brace
      c.lineWidth = 1.2 * u; c.strokeStyle = 'rgba(74,44,16,0.6)';
      for (let k = 1; k < 3; k++) { const px = lerp(hx, fx, k / 3); c.beginPath(); c.moveTo(px, y0 - grow * 0.5 * k / 3); c.lineTo(px, y1 + grow * 0.5 * k / 3); c.stroke(); }
      c.lineWidth = 3.2 * u; c.strokeStyle = '#8a5a26';
      c.beginPath(); c.moveTo(hx, y0 + 6 * u); c.lineTo(fx, y0 + 6 * u); c.moveTo(hx, y1 - 6 * u); c.lineTo(fx, y1 - 6 * u); c.moveTo(hx, y1 - 6 * u); c.lineTo(fx, y0 + 6 * u); c.stroke();
    }
  }
  // the posts and the beam
  for (const sd of [-1, 1]) {
    const px = x + sd * (half + pw / 2);
    c.beginPath(); c.ellipse(px, y + 2 * u, pw * 1.1, 3 * u, 0, 0, TAU); c.fillStyle = 'rgba(20,10,0,0.3)'; c.fill();
    woodRect(c, px - pw / 2, top, pw, ph + 3 * u, 2.5 * u, u, '#b98a4e', '#7a5226');
    c.beginPath(); c.moveTo(px - pw * 0.8, top + 1 * u); c.lineTo(px, top - 7 * u); c.lineTo(px + pw * 0.8, top + 1 * u); c.closePath(); c.fillStyle = '#c0503a'; c.fill(); c.lineWidth = 2 * u; c.strokeStyle = '#4a2c10'; c.stroke();
  }
  woodRect(c, x - half - pw * 0.2, top + 6 * u, 2 * half + pw * 0.4, 7 * u, 2 * u, u, '#c9945a', '#946234');
  // the board hanging from an arm off the post on its side (it falls away as the gate opens)
  const B = { ...g.board, y: g.board.y - sy }, bs = s < 0 ? -1 : s - 0.3, bA = bs < 0 ? 1 : 1 - ss(bs / 0.35);
  if (bA > 0.01) {
    c.save(); c.globalAlpha *= bA;
    const armY = B.y - 9 * u, ax = g.postX, bx0 = B.x + B.w * 0.18, bx1 = B.x + B.w * 0.82;
    woodRect(c, Math.min(ax, B.x + 6 * u) - 2 * u, armY - 3.5 * u, Math.abs(Math.max(ax, B.x + B.w - 6 * u) - Math.min(ax, B.x + 6 * u)) + 4 * u, 7 * u, 2 * u, u, '#b98a4e', '#7a5226');
    const drop = bs > 0 && !calm ? bs * bs * 260 * u : 0, rot = bs > 0 && !calm ? bs * 0.9 * g.side : 0;
    if (drop === 0) { c.strokeStyle = '#5a3a1a'; c.lineWidth = 1.6 * u; for (const rx of [bx0, bx1]) { c.beginPath(); c.moveTo(rx, armY + 2 * u); c.lineTo(rx, B.y + 3 * u); c.stroke(); } }
    c.translate(B.x + B.w / 2, B.y + B.h / 2 + drop); c.rotate(rot);
    const X0 = -B.w / 2, Y0 = -B.h / 2;
    c.beginPath(); c.ellipse(0, B.h / 2 + 4 * u, B.w * 0.42, 4 * u, 0, 0, TAU); c.fillStyle = 'rgba(20,10,0,0.18)'; if (drop === 0) c.fill();
    woodRect(c, X0, Y0, B.w, B.h, 9 * u, u);
    c.fillStyle = 'rgba(255,240,200,0.35)'; c.fillRect(X0 + 8 * u, Y0 + 4 * u, B.w - 16 * u, 2 * u);
    for (const nx of [X0 + 8 * u, -X0 - 8 * u]) blobAt(c, nx, Y0 + 9 * u, 2 * u, '#5a3a1a');
    // a star, have / need, a thin bar
    const txt = `${o.have} / ${o.need}`, fs = 21 * u;
    c.font = `600 ${Math.round(fs)}px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'middle';
    const tw = c.measureText(txt).width, sr = 11 * u, gx = -(sr * 2 + 6 * u + tw) / 2, ty = Y0 + 21 * u;
    brightStar(c, gx + sr, ty, sr, true);
    c.lineWidth = 4 * u; c.strokeStyle = 'rgba(255,244,214,0.9)'; c.strokeText(txt, gx + sr * 2 + 6 * u, ty + 0.5 * u); c.fillStyle = '#3a2008'; c.fillText(txt, gx + sr * 2 + 6 * u, ty + 0.5 * u);
    const bw2 = B.w - 30 * u, by2 = Y0 + B.h - 15 * u, fr = clamp(o.have / Math.max(1, o.need), 0, 1);
    rrect(c, -bw2 / 2, by2, bw2, 7 * u, 3.5 * u); c.fillStyle = 'rgba(58,32,8,0.45)'; c.fill();
    if (fr > 0) { rrect(c, -bw2 / 2, by2, Math.max(7 * u, bw2 * fr), 7 * u, 3.5 * u); c.fillStyle = lg(c, 0, by2, 0, by2 + 7 * u, ['#ffe27a', '#f0a018']); c.fill(); }
    rrect(c, -bw2 / 2, by2, bw2, 7 * u, 3.5 * u); c.lineWidth = 1.2 * u; c.strokeStyle = 'rgba(58,32,8,0.7)'; c.stroke();
    if (o.coin && s < 0) { c.strokeStyle = '#5a3a1a'; c.lineWidth = 1.6 * u; for (const rx of [-B.w / 2 + 24 * u, B.w / 2 - 24 * u]) { c.beginPath(); c.moveTo(rx, B.h / 2 - 1 * u); c.lineTo(rx, B.h / 2 + 13 * u); c.stroke(); } }
    c.restore();
  }
  // the hasp and the big padlock on the seam
  if (open < 0.2) { c.save(); c.globalAlpha *= 1 - open * 5; rrect(c, x - 9 * u, y - 27 * u, 18 * u, 7 * u, 2 * u); c.fillStyle = '#5a5e66'; c.fill(); c.lineWidth = 1.4 * u; c.strokeStyle = '#22242a'; c.stroke(); c.restore(); }
  lockBreak(c, x, y - 19 * u, 12.5 * u, s, calm, u);
  c.restore();
  return g;
}
