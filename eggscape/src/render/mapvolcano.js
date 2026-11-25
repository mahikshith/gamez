// World 5, the Volcano, as one place (0.8.12, mykee on the 0.8.11 map: "these are not properly built ... too sluggish,
// and the creatures look sluggish as well. They're facing towards one direction ... add some life"). Built the way the
// Farm and the Crystal Caves are (mapfarm.js, mapcave.js): a slope of basalt terraces seen from the same raised 3/4
// angle, the crater smoking on the skyline at the top, a lava river winding down across the road, the light coming
// from the lava below as much as from the dim sky.
// The five stops are five landmarks that ARE the tap targets: the Ash Gate, the Melt-Through slab, the Honey Vents,
// the Spike Forge and the crater itself (The Eruption, the Lava Salamander's home), each with the Farm's plaque.
//
// What is painted where (the Farm's rules, binding: the map scrolls at 60 fps on a phone):
//   paintVolcanoBand  the slope, the terraces, the crust fields, the lava river and its bridge, the lava lake, the
//                     skyline: painted ONCE (band cache)
//   landmark sprites  each landmark painted ONCE into its own canvas and stamped (a press squashes it like a button)
//   drawVolcanoLive   the life, every frame, only what is on screen, pure functions of the clock: the lava flowing,
//                     bubbles popping, three salamanders on their rounds; glows are cached sprites, no shadowBlur
//   drawVolcanoFront  over the landmarks: the crater's smoke, its eruptions and the drifting embers (mapamb.js)
// Reduced motion (calm): everything holds still.
import { planStops, SLOTS_4TH, drawLandmarkBody, drawFarmPlaque, signBox, lmArt } from './mapfarm.js';
import { drawCrawler } from './crawlers.js';
import { freeCanvas } from './cvfree.js';
import { drawMapAmb } from './mapamb.js';
import { flame } from '../themes.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const fract = (x) => x - Math.floor(x);
function rng(seed) { let s = (seed * 9301 + 49297) % 233280 || 1; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }
const WI = 4; // the world index

// ------------------------------------------------------------------ colour
const RGB = new Map();
function rgb(h) { let v = RGB.get(h); if (!v) { const n = parseInt(h.slice(1), 16); v = [n >> 16, (n >> 8) & 255, n & 255]; RGB.set(h, v); } return v; }
function mix(a, b, k) { const A = rgb(a), B = rgb(b); return `rgb(${Math.round(A[0] + (B[0] - A[0]) * k)},${Math.round(A[1] + (B[1] - A[1]) * k)},${Math.round(A[2] + (B[2] - A[2]) * k)})`; }
function rgba(h, al) { const A = rgb(h); return `rgba(${A[0]},${A[1]},${A[2]},${al})`; }
function lg(c, x0, y0, x1, y1, cols) { const g = c.createLinearGradient(x0, y0, x1, y1); cols.forEach((s, i) => g.addColorStop(i / (cols.length - 1), s)); return g; }
function rg(c, x, y, r0, r1, cols) { const g = c.createRadialGradient(x, y, r0, x, y, r1); cols.forEach((s, i) => g.addColorStop(i / (cols.length - 1), s)); return g; }

// the volcano's palette: dark basalt, warm ash, lava from deep red to white-hot, sulphur
const P = {
  far: '#2a1618', back: '#3a221e', floor: '#4a2e26', floorNear: '#55362c', floorLo: '#2c1a16', floorHi: '#6e4c3e',
  ash: '#5e463e', ashHi: '#7e6252', ashLo: '#3a2824',
  bas: '#33282e', basHi: '#4e4048', basTop: '#6e5e64', basLo: '#1e161a', basInk: '#0e080a',
  lava: '#ff6a1a', lavaHot: '#ffb02e', lavaCore: '#fff2a8', lavaLo: '#c8320e', lavaDeep: '#6a1206',
  crust: '#2c1c18', crustHi: '#4e342a',
  sul: '#d8b040', sulHi: '#f6e08a', sulLo: '#a07a28', sulInk: '#4a3010',
  iron: '#3a3840', ironHi: '#6e6a76', ironLo: '#222026', ironInk: '#0e0c12',
  wood: '#7a4a2a', woodHi: '#a06c42', woodLo: '#4a2a16', woodInk: '#22120a',
  glow: '#ff7a2a',
};

// ------------------------------------------------------------------ small painting kit (unit space)
function poly(c, pts) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); }
function fillPoly(c, pts, fill, ink, lw) { poly(c, pts); c.fillStyle = fill; c.fill(); if (ink) { c.strokeStyle = ink; c.lineWidth = lw || 1.2; c.lineJoin = 'round'; c.stroke(); } }
function ell(c, x, y, rx, ry, fill) { c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, TAU); c.fillStyle = fill; c.fill(); }
function softShadow(c, x, y, rx, ry, a = 0.45) { c.save(); c.translate(x, y); c.scale(1, ry / rx); c.fillStyle = rg(c, 0, 0, 0, rx, [`rgba(12,4,4,${a})`, `rgba(12,4,4,${a * 0.6})`, 'rgba(12,4,4,0)']); c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill(); c.restore(); }
function glowAt(c, x, y, r, col, a = 0.5) { c.fillStyle = rg(c, x, y, 0, r, [rgba(col, a), rgba(col, a * 0.35), rgba(col, 0)]); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
function flatGlow(c, x, y, rx, ry, col, a) { c.save(); c.translate(x, y); c.scale(1, ry / rx); glowAt(c, 0, 0, rx, col, a); c.restore(); }
function blobPath(c, pts) {
  const n = pts.length / 2; c.beginPath();
  const mx = (i) => (pts[(2 * i) % (2 * n)] + pts[(2 * i + 2) % (2 * n)]) / 2, my = (i) => (pts[(2 * i + 1) % (2 * n)] + pts[(2 * i + 3) % (2 * n)]) / 2;
  c.moveTo(mx(n - 1), my(n - 1));
  for (let i = 0; i < n; i++) c.quadraticCurveTo(pts[2 * i], pts[2 * i + 1], mx(i), my(i));
  c.closePath();
}
function wobble(x, y, rx, ry, n, amt, seed) { const R = rng(seed), out = []; for (let i = 0; i < n; i++) { const a = (i / n) * TAU, k = 1 + (R() - 0.5) * 2 * amt; out.push(x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k); } return out; }
function line(c, pts, col, lw) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.strokeStyle = col; c.lineWidth = lw; c.stroke(); }
// a glowing crack: a warm halo, the red seam, a hot core
function hotCrack(c, pts, w = 1) { c.lineCap = 'round'; c.lineJoin = 'round'; line(c, pts, 'rgba(255,90,20,0.22)', 4.6 * w); line(c, pts, '#d8401a', 1.8 * w); line(c, pts, '#ffc04a', 0.7 * w); }

// a basalt column seen from the 3/4 view: three faces of a hexagon (lit left, front, shaded right) and a lit cap;
// base at (x, y), half width w, height h. The foot is warmed by the lava light.
function hexCol(c, x, y, w, h, k = 0) {
  const t = w * 0.32, base = mix(P.bas, P.basLo, k), lit = mix(P.basHi, P.bas, k), top = mix(P.basTop, P.basHi, k);
  fillPoly(c, [x - w, y, x - w, y - h, x - w * 0.45, y - h + t, x - w * 0.45, y + t], lit, P.basInk, 1);
  fillPoly(c, [x - w * 0.45, y + t, x - w * 0.45, y - h + t, x + w * 0.45, y - h + t, x + w * 0.45, y + t], base, P.basInk, 1);
  fillPoly(c, [x + w * 0.45, y + t, x + w * 0.45, y - h + t, x + w, y - h, x + w, y], mix(P.basLo, '#0e0808', 0.3), P.basInk, 1);
  fillPoly(c, [x - w, y - h, x - w * 0.45, y - h + t, x + w * 0.45, y - h + t, x + w, y - h, x + w * 0.45, y - h - t, x - w * 0.45, y - h - t], top, P.basInk, 1);
  c.fillStyle = 'rgba(255,110,40,0.13)'; c.fillRect(x - w, y - Math.min(h, 10), w * 2, Math.min(h, 10)); // lava light on the foot
  c.strokeStyle = 'rgba(10,4,6,0.45)'; c.lineWidth = 0.8; for (let q = 1; q < 3; q++) { const yy = y - h * (q / 3) + t * 0.5; c.beginPath(); c.moveTo(x - w * 0.45, yy); c.lineTo(x + w * 0.45, yy + 1); c.stroke(); }
}
// a lump of basalt lit top-left, its top face lighter
function rockLump(c, x, y, s, seed, hot = false) {
  softShadow(c, x + s * 0.15, y + s * 0.05, s * 0.75, s * 0.16, 0.5);
  const R = rng(seed), pts = [x - s * 0.62, y, x - s * (0.55 + R() * 0.1), y - s * 0.4, x - s * 0.2, y - s * (0.7 + R() * 0.15), x + s * 0.3, y - s * (0.6 + R() * 0.12), x + s * 0.6, y - s * 0.22, x + s * 0.58, y];
  fillPoly(c, pts, lg(c, x - s * 0.6, y - s * 0.7, x + s * 0.4, y, [P.basHi, P.bas, P.basLo]), P.basInk, 1.1);
  fillPoly(c, [pts[2], pts[3], pts[4], pts[5], pts[6], pts[7], x + s * 0.05, y - s * 0.38, x - s * 0.3, y - s * 0.3], P.basTop);
  if (hot) hotCrack(c, [x - s * 0.3, y - s * 0.12, x - s * 0.05, y - s * 0.3, x + s * 0.2, y - s * 0.22, x + s * 0.4, y - s * 0.36], s / 30);
}
// an obsidian spike: a black glass shard with a sharp lit edge
function spike(c, x, y, h, w, a) {
  c.save(); c.translate(x, y); c.rotate(a);
  fillPoly(c, [-w, 0, -w * 0.3, -h, w, 0], '#16101a', '#050306', 0.8);
  fillPoly(c, [-w, 0, -w * 0.3, -h, -w * 0.15, 0], '#4a3a5a');
  line(c, [-w * 0.55, -h * 0.2, -w * 0.34, -h * 0.9], 'rgba(220,200,255,0.7)', Math.max(0.5, w * 0.18));
  c.restore();
}

// ------------------------------------------------------------------ the plan
// Landmarks (bottom to top): extents in design units; pref = the side of the road (see mapfarm.js LMS)
const LMS = [
  { kind: 'gate', name: 'Ash Gate', pref: -1, x0: -72, x1: 72, top: 150, gap: 6, dy: 2, rows: 1, tap: [-68, -146, 68, 6] },
  { kind: 'melt', name: 'Melt-Through', pref: 1, x0: -82, x1: 82, top: 96, gap: 4, dy: 8, rows: 1, tap: [-80, -90, 80, 6] },
  { kind: 'vents', name: 'Honey Vents', pref: 1, x0: -72, x1: 72, top: 128, gap: 6, dy: 0, rows: 1, tap: [-68, -118, 68, 6] },
  { kind: 'forge', name: 'Spike Forge', pref: -1, x0: -74, x1: 72, top: 156, gap: 6, dy: 4, rows: 1, tap: [-70, -146, 68, 6] },
  { kind: 'crater', name: 'The Eruption', pref: -1, x0: -86, x1: 86, top: 214, gap: 6, dy: 0, beside: 1, rows: 1, tap: [-82, -186, 82, 6] },
];
export const VOLCANO_LANDMARKS = LMS;
export const CRATER_TOP = [0, -178]; // the crater's mouth (design units from the foot)

// props: kind, fx, fy, size, [half width, height] (units); nudged off the road, the landmarks, the lava
const PROPS = [
  ['bask', 0.14, 0.6, 1, [74, 46]], // the warm rock and the loop its salamander walks
  ['bank', 0.82, 0.34, 1, [78, 40]], // a salamander's beat along a ledge
  ['pair', 0.84, 0.8, 1, [58, 46]], // two young ones chasing round a boulder
  ['spikes', 0.9, 0.56, 1, [30, 60]],
  ['snag', 0.08, 0.3, 1, [24, 78]],
  ['spikes2', 0.1, 0.9, 0.8, [26, 50]],
  ['vent', 0.55, 0.05, 0.9, [22, 30]],
  ['rocks', 0.92, 0.12, 1, [32, 30]],
  ['rocks2', 0.06, 0.08, 0.9, [30, 28]],
];
const roadHit = (L, x0, x1, y0, y1, m = 4) => { for (let y = y0; y <= y1 + 0.1; y += 6) { const x = L.pathX(y); if (x + L.roadW * 0.5 + m * L.u > x0 && x - L.roadW * 0.5 - m * L.u < x1) return true; } return false; };
const hitAny = (boxes, b) => boxes.some((q) => b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0);

export function volcanoPlan(L) {
  if (L._volc) return L._volc;
  const plan = planStops(L, WI, LMS, SLOTS_4TH), u = L.u, A = L.A, top = plan.top, BH = L.BH, st = (k) => L.stops[WI * L.per + SLOTS_4TH[k]]; // k: the old five
  if (plan.lms.length < 5) { plan.props = []; plan.river = null; return (L._volc = plan); }
  const boxes = plan.lms.map((m) => lmArt(m)).concat(plan.lms.map((m) => { const b = m.plaque.board; return { x0: b.x - 4 * u, x1: b.x + b.w + 4 * u, y0: b.y, y1: m.plaque.y + 6 * u }; }));
  const sign = signBox(L, WI), sign2 = signBox(L, WI + 1);
  // the lava river: out of a lava fall in one wall, across the road under a basalt bridge, into a lake by the other wall.
  // Tried between each pair of stops and both ways round; the course that touches the fewest landmarks wins.
  let best = null;
  for (const [ka, kb] of [[1, 2], [2, 3], [0, 1]]) {
    const yc = lerp(st(ka).y, st(kb).y, 0.5), xc = L.pathX(yc);
    for (const sideL of [-1, 1]) { // sideL: the lake's side
      const src = { x: sideL < 0 ? A.x1 + 8 * u : A.x - 8 * u, y: yc - 0.08 * BH }, lake = { x: sideL < 0 ? A.x + 22 * u : A.x1 - 22 * u, y: yc + 0.1 * BH };
      const pts = [src.x, src.y, lerp(src.x, xc, 0.5), lerp(src.y, yc, 0.75) - 6 * u, xc, yc, lerp(xc, lake.x, 0.45), lerp(yc, lake.y, 0.35) + 4 * u, lake.x, lake.y];
      let hits = 0;
      for (let i = 0; i <= 40; i++) { const p = riverAt(pts, i / 40); if (Math.abs(p.x - xc) < 50 * u) continue; const b = { x0: p.x - 14 * u, x1: p.x + 14 * u, y0: p.y - 10 * u, y1: p.y + 10 * u }; if (hitAny(boxes, b) || hitAny([sign, sign2], b)) hits++; }
      const lb = { x0: lake.x - 64 * u, x1: lake.x + 64 * u, y0: lake.y - 22 * u, y1: lake.y + 22 * u }; if (hitAny(boxes, lb)) hits += 6; if (roadHit(L, lb.x0, lb.x1, lb.y0, lb.y1)) hits += 20;
      if (!best || hits < best.hits) best = { hits, pts, cross: { x: xc, y: yc }, src, lake, side: sideL };
    }
  }
  plan.river = { pts: best.pts, cross: best.cross, w: 18 * u, fall: best.src, lake: best.lake, side: best.side };
  boxes.push({ x0: best.cross.x - 46 * u, x1: best.cross.x + 46 * u, y0: best.cross.y - 18 * u, y1: best.cross.y + 18 * u });
  boxes.push({ x0: best.lake.x - 62 * u, x1: best.lake.x + 62 * u, y0: best.lake.y - 22 * u, y1: best.lake.y + 20 * u });
  // the boss's treasure chest stands beside the boss stop (main.js): keep it clear
  { const sb = st(4), r = L.stopR * 1.2, cr = Math.min(r * 0.95, 34 * u); let side = sb.x < A.cx ? -1 : 1, cx = sb.x + side * (r + cr * 1.25); if (cx - cr < A.x + 4 * u || cx + cr > A.x1 - 4 * u) cx = sb.x - side * (r + cr * 1.25); const cy = sb.y - r * 0.15; boxes.push({ x0: cx - cr * 1.1, x1: cx + cr * 1.1, y0: cy - cr * 1.2, y1: cy + cr * 1.2 }); }
  const riverY = (x) => riverYAt(best.pts, x);
  const out = [];
  for (const [k, fx, fy, sz, [hw0, h0]] of PROPS) {
    const hw = hw0 * u * sz, h = h0 * u * sz;
    let got = null;
    for (let r = 0; r <= 8 && !got; r++) {
      for (const [dx, dy] of r ? [[r, 0], [-r, 0], [0, -r], [0, r], [r, -r], [-r, -r], [r, r], [-r, r]] : [[0, 0]]) {
        const x = A.x + fx * A.w + dx * 10 * u, y = top + fy * BH + dy * 8 * u;
        const b = { x0: x - hw, x1: x + hw, y0: y - h, y1: y + 4 * u };
        if (b.x0 < A.x - hw * 0.5 || b.x1 > A.x1 + hw * 0.5) continue;
        if (b.y0 < top - 10 * u || b.y1 > top + BH * 0.97) continue;
        if (roadHit(L, b.x0, b.x1, b.y0, b.y1)) continue;
        if (hitAny(boxes, b) || hitAny([sign, sign2], b)) continue;
        let wet = false; for (let xx = b.x0; xx <= b.x1; xx += 8 * u) { const ry = riverY(xx); if (ry > b.y0 - 12 * u && ry < b.y1 + 12 * u) { wet = true; break; } }
        if (wet) continue;
        got = { k, x, y, s: sz, box: b, dir: x < L.pathX(y) ? 1 : -1 }; break; // dir: toward the road (the loops open that way)
      }
    }
    if (got) { out.push(got); boxes.push(got.box); }
  }
  plan.props = out;
  // the salamanders' walks: loops in their own patches (see walker())
  plan.walks = [];
  const bk = spot(plan, 'bask'); if (bk) plan.walks.push({ k: 'bask', lp: { x: bk.x + bk.dir * 20 * u, y: bk.y - 16 * u, Ls: 64 * u, r: 15 * u, sq: 0.62, dir: bk.dir }, rock: { x: bk.x - bk.dir * 30 * u, y: bk.y }, s: 31 * u });
  const bn = spot(plan, 'bank'); if (bn) plan.walks.push({ k: 'bank', lp: { x: bn.x, y: bn.y - 14 * u, Ls: 96 * u, r: 11 * u, sq: 0.6, dir: -bn.dir }, s: 27 * u });
  const pr = spot(plan, 'pair'); if (pr) plan.walks.push({ k: 'pair', lp: { x: pr.x, y: pr.y - 18 * u, Ls: 34 * u, r: 22 * u, sq: 0.5, dir: 1 }, s: 19 * u });
  return (L._volc = plan);
}
// the river's centre at f (0 source .. 1 lake) and its y at x (its points run one way in x)
function riverAt(pts, f) { const n = pts.length / 2 - 1, k = Math.min(n - 1, Math.floor(f * n)), a = f * n - k; return { x: lerp(pts[2 * k], pts[2 * k + 2], a), y: lerp(pts[2 * k + 1], pts[2 * k + 3], a) }; }
function riverYAt(pts, x) { for (let i = 0; i < pts.length - 2; i += 2) { const xa = pts[i], xb = pts[i + 2]; if ((x - xa) * (x - xb) <= 0 && xa !== xb) return lerp(pts[i + 1], pts[i + 3], (x - xa) / (xb - xa)); } return Infinity; }
function spot(plan, k) { for (const p of plan.props) if (p.k === k) return p; return null; }
export function volcanoStop(L, i) { const p = volcanoPlan(L); return p.lms[i] || null; }

// ------------------------------------------------------------------ the band, painted once
export function paintVolcanoBand(c, L, E) {
  const u = L.u, W = L.W, BH = L.BH, top = L.bandTop(WI), plan = volcanoPlan(L), A = L.A;
  const R0 = rng(WI * 31 + 5), ph = R0() * TAU, ph2 = R0() * TAU;
  const crest = (x) => E * 0.5 + Math.sin((x / W) * TAU * 1.3 + ph) * E * 0.28 + Math.sin((x / W) * TAU * 3.1 + ph2) * E * 0.12;
  c.save();
  c.beginPath(); c.moveTo(0, BH + E); for (let x = 0; x <= W + 8; x += 8) c.lineTo(x, crest(x)); c.lineTo(W, BH + E); c.closePath();
  c.fillStyle = lg(c, 0, E * 0.2, 0, BH + E, [P.far, P.back, P.floor, P.floorNear]); c.fill();
  c.save(); c.clip();
  c.translate(0, E - top); // map coordinates from here on
  const Y = (f) => top + f * BH;
  try {
    skyline(c, L, plan, top, u, E, crest);
    slope(c, L, plan, top, u);
    terraces(c, L, plan, top, u);
    crustFields(c, L, plan, top, u);
    // light: the lava's warm glow from below, a dim cool sky from the upper left
    c.fillStyle = lg(c, 0, Y(0.7), 0, Y(1.02), ['rgba(255,110,40,0)', 'rgba(255,110,40,0.12)']); c.fillRect(0, Y(0.7), W, BH * 0.32);
    c.fillStyle = rg(c, A.x + A.w * 0.08, Y(0.05), 0, Math.max(A.w, BH) * 0.7, ['rgba(190,170,200,0.1)', 'rgba(190,170,200,0)']); c.fillRect(0, top - E, W, BH + E);
    for (const m of plan.lms) groundFor(c, m);
    if (plan.river) river(c, L, plan, u);
    if (plan.river) bridgeOnRoad(c, L, plan, u);
    pebbles(c, L, plan, u);
    const list = plan.props.slice().sort((a, b) => a.y - b.y);
    for (const p of list) { try { prop(c, L, plan, p, u); } catch (_) { /* a prop never breaks the map */ } }
  } catch (_) { /* the band never breaks the map */ }
  c.restore();
  // the crest: a thin warm rim
  c.beginPath(); for (let x = 0; x <= W + 8; x += 8) { const y = crest(x); if (x === 0) c.moveTo(x, y); else c.lineTo(x, y); }
  c.strokeStyle = 'rgba(255,150,90,0.3)'; c.lineWidth = 2.2 * u; c.stroke();
  c.restore();
}

// the skyline under the crest: two ranges of jagged peaks, the far one hazy red, a warm glow behind the crater's side
function skyline(c, L, plan, top, u, E, crest) {
  const W = L.W, cr = plan.lms[4], R = rng(13);
  const gx = cr ? cr.x : W * 0.7;
  c.fillStyle = rg(c, gx, top - E * 0.2, 0, W * 0.75, ['rgba(255,100,40,0.3)', 'rgba(255,100,40,0.1)', 'rgba(255,100,40,0)']); c.fillRect(0, top - E, W, 200 * u);
  for (const [k, col, hi, amp, base] of [[0, '#3e2022', '#5a3030', 34, 34], [1, '#2a1618', '#3e2424', 26, 58]]) {
    const y0 = top + base * u;
    c.beginPath(); c.moveTo(-10, y0 + 60 * u); let x = -10;
    const pk = [];
    while (x < W + 30) { const h = (0.4 + R() * 0.6) * amp * u, w2 = (22 + R() * 30) * u; pk.push([x + w2 * 0.5, y0 - h]); c.lineTo(x + w2 * 0.5, y0 - h); x += w2; c.lineTo(x, y0 - (R() * 0.25) * amp * u); }
    c.lineTo(W + 30, y0 + 60 * u); c.closePath(); c.fillStyle = lg(c, 0, y0 - amp * u, 0, y0 + 60 * u, [col, mix(col, P.back, 0.6)]); c.fill();
    c.strokeStyle = rgba(k ? '#ff8a4a' : '#c87060', k ? 0.25 : 0.2); c.lineWidth = 1.2 * u; c.stroke();
    if (k) for (const [px, py] of pk) { if (R() < 0.5) continue; line(c, [px - 8 * u, py + 10 * u, px, py, px + 5 * u, py + 6 * u], rgba(P.basTop, 0.5), 1.2 * u); }
  }
  // haze over the far ranges, then dark smoke banks drifting off the crater (the live smoke rises over them)
  c.fillStyle = lg(c, 0, top, 0, top + 90 * u, ['rgba(60,30,30,0.35)', 'rgba(60,30,30,0)']); c.fillRect(0, top - E, W, 100 * u + E);
  for (let i = 0; i < 5; i++) { const x = gx + (i - 2) * 46 * u + R() * 20 * u, y = top + (6 + R() * 14) * u, r = (22 + R() * 18) * u; ell(c, x, y, r * 1.4, r * 0.55, 'rgba(34,20,22,0.35)'); }
}
// the slope: broad ash shelves with lit rims and dark cracks, darker basalt between
function slope(c, L, plan, top, u) {
  const A = L.A, BH = L.BH, R = rng(71);
  const slabs = [[0.2, 0.2, 0.3, 0.1], [0.8, 0.24, 0.3, 0.1], [0.5, 0.4, 0.4, 0.1], [0.16, 0.5, 0.3, 0.11], [0.86, 0.52, 0.28, 0.1], [0.32, 0.74, 0.42, 0.12], [0.8, 0.76, 0.34, 0.12], [0.55, 0.94, 0.5, 0.08], [0.06, 0.84, 0.2, 0.08]];
  slabs.forEach(([fx, fy, rx, ry], i) => {
    const x = A.x + fx * A.w, y = top + fy * BH, pts = wobble(x, y, rx * A.w, ry * BH, 9, 0.18, 120 + i);
    c.save(); c.translate(0, 5 * u); blobPath(c, pts); c.fillStyle = 'rgba(16,6,6,0.4)'; c.fill(); c.restore();
    blobPath(c, pts); c.fillStyle = lg(c, x - rx * A.w, y - ry * BH, x + rx * A.w * 0.4, y + ry * BH, [mix(P.ashHi, P.ash, 0.5 + 0.3 * (1 - fy)), mix(P.ash, P.floorHi, 0.5), P.ashLo]); c.fill();
    c.save(); blobPath(c, pts); c.clip(); c.strokeStyle = 'rgba(255,220,190,0.14)'; c.lineWidth = 2 * u; c.translate(1.5 * u, 2 * u); blobPath(c, pts); c.stroke(); c.restore();
    c.strokeStyle = 'rgba(30,14,12,0.45)'; c.lineWidth = 1.1 * u;
    for (let k = 0; k < 2; k++) { let px = x + (R() - 0.5) * rx * A.w, py = y + (R() - 0.5) * ry * BH; c.beginPath(); c.moveTo(px, py); for (let q = 0; q < 4; q++) { px += (R() - 0.3) * 18 * u; py += (R() - 0.5) * 8 * u; c.lineTo(px, py); } c.stroke(); }
  });
}
// basalt terraces up both edges: stepped ledges of columns, each with a lit top, far ones dimmer; glowing seams under some
function terraces(c, L, plan, top, u) {
  const A = L.A, BH = L.BH, R = rng(23), boxes = plan.lms.map((m) => lmArt(m));
  const busy = (x0, x1, y0, y1) => roadHit(L, x0, x1, y0, y1, 8) || boxes.some((q) => x0 < q.x1 - 10 * u && x1 > q.x0 + 10 * u && y0 < q.y1 - 6 * u && y1 > q.y0 + 20 * u);
  for (const side of [-1, 1]) {
    for (let y = top + 40 * u; y < top + BH * 0.97; y += (52 + R() * 30) * u) {
      const near = (y - top) / BH, depth = (34 + R() * 30) * u * (0.7 + near * 0.5), h = (22 + R() * 18) * u * (0.8 + near * 0.4);
      const xe = side < 0 ? A.x - 14 * u : A.x1 + 14 * u, xi = xe - side * depth;
      if (busy(Math.min(xe, xi), Math.max(xe, xi), y - h - 8 * u, y)) continue;
      softShadow(c, xi + side * -6 * u, y + 3 * u, depth * 0.55, 6 * u, 0.5);
      const cw = 6.5 * u * (0.8 + near * 0.3), n = Math.max(2, Math.round(depth / (cw * 1.55)));
      for (let q = 0; q < n; q++) { // the columns, the ones at the cliff's front edge shorter
        const f = (q + 0.5) / n, cx = lerp(xi, xe, f), hh = h * (0.75 + 0.25 * f) + (R() - 0.5) * 6 * u;
        hexCol(c, cx, y + (R() - 0.5) * 2 * u, cw, hh, 0.25 * (1 - near));
      }
      if (R() < 0.45) { const gx = lerp(xi, xe, 0.3); hotCrack(c, [gx - 10 * u, y + 2 * u, gx, y - 1 * u, gx + 12 * u, y + 2 * u], u); }
    }
  }
}
// cooling crust: black plates with glowing seams between them, here and there over the slope
function crustFields(c, L, plan, top, u) {
  const A = L.A, BH = L.BH, R = rng(37), boxes = plan.lms.map((m) => lmArt(m));
  for (const [fx, fy, rx] of [[0.3, 0.28, 46], [0.7, 0.62, 52], [0.22, 0.88, 40], [0.62, 0.1, 40]]) {
    const cx = A.x + fx * A.w, cy = top + fy * BH;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + R() * 0.5, d = R() * rx * u, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.4, r = (9 + R() * 9) * u;
      if (roadHit(L, x - r, x + r, y - r * 0.5, y + r * 0.5, 3)) continue;
      if (boxes.some((q) => x > q.x0 && x < q.x1 && y > q.y0 && y < q.y1)) continue;
      const pts = wobble(x, y, r, r * 0.45, 6, 0.25, 300 + i * 7 + fx * 100);
      c.save(); c.translate(0, 1.6 * u); blobPath(c, pts); c.fillStyle = 'rgba(255,90,20,0.55)'; c.fill(); c.restore(); // the hot seam peeks out under the plate
      blobPath(c, pts); c.fillStyle = lg(c, x - r, y - r * 0.4, x + r, y + r * 0.4, [P.crustHi, P.crust]); c.fill();
      c.strokeStyle = 'rgba(255,150,80,0.25)'; c.lineWidth = 0.8 * u; c.stroke();
    }
  }
}
function groundFor(c, m) {
  const d = m.d, x = m.x, y = m.y, f = m.flip ? -1 : 1, S = m.S;
  const cx = x + ((S.x0 + S.x1) / 2) * d * f, rx = (S.x1 - S.x0) * d * 0.5;
  softShadow(c, cx + 10 * d, y + 2 * d, rx * 1.05, 14 * d, 0.55);
  if (m.kind === 'crater' || m.kind === 'melt' || m.kind === 'forge') flatGlow(c, cx, y, rx * 1.2, rx * 0.3, P.glow, m.kind === 'crater' ? 0.42 : 0.3);
  else if (m.kind === 'vents') flatGlow(c, cx, y, rx * 1.1, rx * 0.28, '#ffd04a', 0.22);
}
// the lava river: a black crust bank, the flow deep red at the edges to white-hot in the middle, crust rafts, a lava
// fall out of the wall at its head and a lake at its foot
function riverPath(c, pts) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length - 2; i += 2) c.quadraticCurveTo(pts[i], pts[i + 1], (pts[i] + pts[i + 2]) / 2, (pts[i + 1] + pts[i + 3]) / 2); c.lineTo(pts[pts.length - 2], pts[pts.length - 1]); }
function river(c, L, plan, u) {
  const S = plan.river, w = S.w, pts = S.pts, Lk = S.lake;
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  // the glow it throws on the ground around it
  for (let i = 0; i <= 12; i++) { const p = riverAt(pts, i / 12); flatGlow(c, p.x, p.y, 46 * u, 22 * u, P.glow, 0.22); }
  flatGlow(c, Lk.x, Lk.y, 110 * u, 40 * u, P.glow, 0.35);
  // the lake: a crust rim, the molten face
  blobPath(c, wobble(Lk.x, Lk.y + 2 * u, 66 * u, 22 * u, 11, 0.12, 81)); c.fillStyle = P.crust; c.fill();
  c.translate(0, 4 * u); riverPath(c, pts); c.strokeStyle = 'rgba(14,4,4,0.55)'; c.lineWidth = w + 12 * u; c.stroke(); c.translate(0, -4 * u);
  riverPath(c, pts); c.strokeStyle = P.crust; c.lineWidth = w + 9 * u; c.stroke();
  riverPath(c, pts); c.strokeStyle = P.crustHi; c.lineWidth = w + 5 * u; c.stroke();
  riverPath(c, pts); c.strokeStyle = P.lavaDeep; c.lineWidth = w + 1 * u; c.stroke();
  riverPath(c, pts); c.strokeStyle = P.lavaLo; c.lineWidth = w * 0.86; c.stroke();
  riverPath(c, pts); c.strokeStyle = P.lava; c.lineWidth = w * 0.6; c.stroke();
  riverPath(c, pts); c.strokeStyle = P.lavaHot; c.lineWidth = w * 0.3; c.stroke();
  blobPath(c, wobble(Lk.x, Lk.y, 60 * u, 18 * u, 11, 0.1, 82)); c.fillStyle = lg(c, 0, Lk.y - 18 * u, 0, Lk.y + 18 * u, [P.lavaHot, P.lava, P.lavaLo]); c.fill();
  blobPath(c, wobble(Lk.x - 6 * u, Lk.y - 2 * u, 34 * u, 9 * u, 9, 0.15, 83)); c.fillStyle = rgba(P.lavaCore, 0.75); c.fill();
  c.restore();
  // crust rafts afloat (the live flow slides glints past them)
  const R = rng(9);
  for (let i = 0; i < 10; i++) { const p = riverAt(pts, 0.08 + R() * 0.88); if (Math.abs(p.x - L.pathX(p.y)) < L.roadW + 12 * u) continue; const r = (3 + R() * 3) * u; blobPath(c, wobble(p.x + (R() - 0.5) * w * 0.4, p.y + (R() - 0.5) * w * 0.25, r, r * 0.5, 6, 0.3, 90 + i)); c.fillStyle = P.crust; c.fill(); c.strokeStyle = 'rgba(255,200,120,0.6)'; c.lineWidth = 0.6 * u; c.stroke(); }
  for (let i = 0; i < 7; i++) { const a = R() * TAU, r = (4 + R() * 5) * u, x = Lk.x + Math.cos(a) * 40 * u * R(), y = Lk.y + Math.sin(a) * 12 * u * R(); blobPath(c, wobble(x, y, r, r * 0.45, 6, 0.3, 120 + i)); c.fillStyle = P.crust; c.fill(); }
  // the lava fall: a basalt spout in the wall, a sheet of lava down it, a splash pool
  const F = S.fall, sd = F.x > L.cx ? -1 : 1, fx = F.x + sd * 4 * u, fy = F.y;
  fillPoly(c, [fx - sd * 8 * u, fy + 4 * u, fx + sd * 26 * u, fy - 2 * u, fx + sd * 32 * u, fy - 34 * u, fx - sd * 8 * u, fy - 46 * u], lg(c, fx, fy - 46 * u, fx + sd * 30 * u, fy, [P.basHi, P.bas, P.basLo]), P.basInk, 1.2 * u);
  for (let q = 0; q < 3; q++) hexCol(c, fx + sd * (2 + q * 9) * u, fy - (28 - q * 3) * u, 4.6 * u, (16 + q * 4) * u, 0.3);
  fillPoly(c, [fx + sd * 8 * u, fy - 28 * u, fx + sd * 22 * u, fy - 26 * u, fx + sd * 26 * u, fy + 2 * u, fx + sd * 6 * u, fy + 4 * u], lg(c, 0, fy - 28 * u, 0, fy + 4 * u, [P.lavaCore, P.lavaHot, P.lava]));
  glowAt(c, fx + sd * 16 * u, fy, 26 * u, P.glow, 0.45);
}
// where the road crosses the lava: a basalt bridge, its parapets either side of the road, the arch's shade on the flow
function bridgeOnRoad(c, L, plan, u) {
  const S = plan.river, yc = S.cross.y, rw = L.roadW, half = S.w * 0.5 + 8 * u;
  for (const side of [-1, 1]) {
    const pts = []; for (let y = yc - half; y <= yc + half + 0.1; y += 3) { const x = L.pathX(y) + side * (rw * 0.5 + 4 * u); pts.push(x, y); }
    const x0 = pts[0], y0 = pts[1], x1 = pts[pts.length - 2], y1 = pts[pts.length - 1];
    ell(c, (x0 + x1) / 2 + side * 6 * u, (y0 + y1) / 2 + 3 * u, 10 * u, S.w * 0.5, 'rgba(40,6,2,0.5)');
    c.lineCap = 'round'; c.lineJoin = 'round';
    const run = (dy, col, lw) => { c.beginPath(); c.moveTo(pts[0], pts[1] + dy); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1] + dy); c.strokeStyle = col; c.lineWidth = lw; c.stroke(); };
    run(4 * u, P.basInk, 8.5 * u); run(3 * u, P.basLo, 7 * u); run(0, P.bas, 6 * u); run(-1 * u, P.basHi, 2 * u);
    c.strokeStyle = 'rgba(255,110,40,0.5)'; c.lineWidth = 1 * u; for (let i = 4; i < pts.length - 2; i += 4) { c.beginPath(); c.moveTo(pts[i] - 3 * u, pts[i + 1] + 2 * u); c.lineTo(pts[i] + 3 * u, pts[i + 1] + 2 * u); c.stroke(); } // the lava's light on the lower course
    for (const [px, py] of [[x0, y0], [x1, y1]]) hexCol(c, px, py + 5 * u, 4.6 * u, 12 * u, 0);
  }
}
function pebbles(c, L, plan, u) {
  const A = L.A, top = plan.top, BH = L.BH, R = rng(29);
  for (let i = 0; i < 70; i++) {
    const x = A.x + R() * A.w, y = top + 40 * u + R() * (BH - 60 * u), r = (1.4 + R() * 2.6) * u;
    if (roadHit(L, x - r, x + r, y - r, y + r, 3)) continue;
    if (R() < 0.8) { ell(c, x + 0.8 * u, y + 0.8 * u, r * 1.1, r * 0.6, 'rgba(14,4,4,0.45)'); ell(c, x, y, r, r * 0.62, mix(P.bas, P.ash, 0.4)); ell(c, x - r * 0.3, y - r * 0.25, r * 0.4, r * 0.22, 'rgba(255,220,200,0.35)'); }
    else { ell(c, x, y, r * 0.9, r * 0.5, P.crust); ell(c, x, y - r * 0.1, r * 0.4, r * 0.2, 'rgba(255,140,50,0.8)'); }
  }
}

// ------------------------------------------------------------------ props (painted into the band)
function prop(c, L, plan, p, u) {
  if (p.k === 'bask') { const w = plan.walks.find((q) => q.k === 'bask'); if (w) warmRock(c, w.rock.x, w.rock.y, u); return; }
  if (p.k === 'bank') { ledge(c, p.x, p.y, u, p.dir); return; }
  if (p.k === 'pair') { softShadow(c, p.x, p.y - 14 * u, 40 * u, 10 * u, 0.35); flatGlow(c, p.x, p.y - 14 * u, 50 * u, 14 * u, P.glow, 0.15); return; } // the boulder itself is live (they run behind it)
  const s = p.s * u;
  c.save(); c.translate(p.x, p.y); c.scale(s, s);
  switch (p.k) {
    case 'spikes': spikes(c, 0, 0, 1, 5); break;
    case 'spikes2': spikes(c, 0, 0, 0.8, 7); break;
    case 'snag': snag(c); break;
    case 'vent': smallVent(c); break;
    case 'rocks': rockLump(c, -10, 0, 22, 3, true); rockLump(c, 14, 4, 14, 4); break;
    case 'rocks2': rockLump(c, 6, 0, 20, 5); rockLump(c, -14, 4, 12, 6, true); break;
    default: break;
  }
  c.restore();
}
function warmRock(c, x, y, u) { // a flat rock warmed from below: glowing cracks (a salamander basks on it: live)
  c.save(); c.translate(x, y); c.scale(u, u);
  flatGlow(c, 0, -6, 60, 18, '#ff8a3a', 0.4);
  softShadow(c, 6, 2, 46, 8, 0.55);
  fillPoly(c, [-42, 0, -38, -14, -14, -22, 20, -22, 40, -12, 44, 0, 20, 6, -20, 6], lg(c, -40, -22, 40, 6, [P.basHi, P.bas, P.basLo]), P.basInk, 1.2);
  fillPoly(c, [-38, -14, -14, -22, 20, -22, 40, -12, 18, -8, -16, -8], lg(c, -30, -22, 30, -8, [P.basTop, P.basHi]), P.basInk, 0.8);
  hotCrack(c, [-20, -12, -6, -16, 8, -12], 1); hotCrack(c, [10, -18, 22, -14, 30, -16], 0.8); hotCrack(c, [-30, -4, -18, -6], 0.8);
  c.restore();
}
function ledge(c, x, y, u, dir) { // a long low shelf of columns along the lava, the walk runs on its top
  softShadow(c, x, y + 2 * u, 70 * u, 8 * u, 0.45);
  for (let q = 0; q < 9; q++) { const f = q / 8, cx = x + (f - 0.5) * 120 * u * dir, hh = (12 + Math.sin(q * 1.7) * 3) * u; hexCol(c, cx, y + Math.sin(q * 2.3) * 1.5 * u, 7.4 * u, hh, 0.15); }
}
function spikes(c, x, y, k, seed) { // a crop of obsidian spikes
  const R = rng(seed);
  softShadow(c, x + 4, y + 1, 26 * k, 5 * k, 0.5);
  for (let i = 0; i < 6; i++) { const f = i / 5; spike(c, x + (f - 0.5) * 36 * k + (R() - 0.5) * 4, y + R() * 3, (18 + R() * 30 * (1 - Math.abs(f - 0.5))) * k, (4 + R() * 2) * k, (f - 0.5) * 0.9 + (R() - 0.5) * 0.2); }
}
function snag(c) { // a burnt tree: a black trunk and bare branches, embers in its cracks
  softShadow(c, 6, 0, 20, 5, 0.5);
  fillPoly(c, [-7, 0, -4, -40, -9, -58, -4, -60, 0, -44, 4, -66, 8, -64, 4, -40, 8, 0], lg(c, -8, 0, 8, 0, ['#4a3432', '#2a1c1c', '#140c0c']), '#080404', 1);
  c.lineCap = 'round'; for (const p of [[-3, -46, -16, -62, -22, -60], [2, -52, 14, -70, 20, -72], [-1, -30, 12, -40]]) line(c, p, '#2a1c1c', 2.6);
  hotCrack(c, [0, -6, 1, -18, -1, -26], 0.8);
}
function smallVent(c) { // a little steaming crack in a crust mound (the steam is live)
  softShadow(c, 4, 0, 22, 5, 0.45);
  c.beginPath(); c.moveTo(-22, 0); c.quadraticCurveTo(-14, -18, 0, -20); c.quadraticCurveTo(14, -18, 22, 0); c.closePath(); c.fillStyle = lg(c, 0, -20, 0, 0, [P.sulLo, '#6a4a2a', P.crust]); c.fill(); c.strokeStyle = P.basInk; c.lineWidth = 1; c.stroke();
  ell(c, 0, -18, 6, 2.2, '#1a0c08'); ell(c, 0, -18.4, 3.4, 1.2, '#ff8a2a');
  for (const [x, y] of [[-10, -8], [8, -12], [12, -4]]) ell(c, x, y, 2.4, 1.2, P.sul);
}
export const VENT_TOP = [0, -20];

// ------------------------------------------------------------------ landmark sprites (design units, foot at 0,0)
// The Ash Gate: two clusters of basalt columns under a heavy lintel carved with a glowing salamander, a brazier each side
export const GATE_FIRE = [[-60, -27], [60, -27]];
function paintGate(c) {
  flatGlow(c, 0, -4, 72, 22, '#ff7a2a', 0.45);
  // the threshold: a worn basalt step, warm cracks
  fillPoly(c, [-44, 4, 44, 4, 40, -6, -40, -6], lg(c, 0, -6, 0, 4, [P.basTop, P.bas]), P.basInk, 1);
  hotCrack(c, [-26, -2, -10, 0, 4, -3], 0.8);
  for (const sd of [-1, 1]) {
    const cols = [[sd * 50, 10, 86, -4], [sd * 38, 12, 126, -2], [sd * 26, 10, 104, 3]];
    cols.sort((a, b) => a[3] - b[3]);
    for (const [x, w, h, dy] of cols) hexCol(c, x, dy, w, h, 0);
  }
  // the lintel: a front face, a lit top going back; cracks, and the carved salamander glowing in it
  fillPoly(c, [-62, -114, 62, -114, 60, -136, -60, -136], lg(c, -60, -136, 60, -114, [P.basHi, P.bas, P.basLo]), P.basInk, 1.3);
  fillPoly(c, [-60, -136, 60, -136, 68, -144, -52, -144], lg(c, -60, -144, 60, -136, [P.basTop, P.basHi]), P.basInk, 1);
  line(c, [-60, -125, -40, -124, -36, -130], 'rgba(10,4,6,0.5)', 1);
  line(c, [44, -116, 50, -126, 58, -128], 'rgba(10,4,6,0.5)', 1);
  c.save(); c.translate(0, -125); c.lineCap = 'round'; c.lineJoin = 'round';
  const sal = [-24, 2, -14, -4, -4, -2, 6, 3, 16, 0, 22, -4];
  line(c, sal, 'rgba(255,90,20,0.35)', 6); line(c, sal, '#e0481a', 2.6); line(c, sal, '#ffd060', 1);
  ell(c, 24, -4, 3.4, 2.4, '#ffb03a'); ell(c, 25, -4.4, 1, 0.8, '#3a0c04');
  for (const [lx, ly, a] of [[-12, -3, -1], [-10, -3, 1], [6, 2, -1], [8, 2, 1]]) line(c, [lx, ly, lx + 3, ly + a * 5], '#ffb03a', 1.2);
  c.restore();
  // the braziers: three iron legs, a bowl of coals (the fire is live)
  for (const [bx, by] of GATE_FIRE) {
    softShadow(c, bx + 3, 2, 12, 3, 0.5);
    for (const lx of [-7, 0, 7]) line(c, [bx + lx * 0.4, by + 6, bx + lx, 2], P.ironInk, 2);
    c.beginPath(); c.moveTo(bx - 11, by - 1); c.quadraticCurveTo(bx, by + 12, bx + 11, by - 1); c.closePath(); c.fillStyle = lg(c, bx - 11, 0, bx + 11, 0, [P.ironHi, P.iron, P.ironLo]); c.fill(); c.strokeStyle = P.ironInk; c.lineWidth = 1; c.stroke();
    ell(c, bx, by - 1, 11, 3, '#3a1408'); ell(c, bx, by - 1.4, 8, 2, '#ff8a2a'); ell(c, bx - 2, by - 1.6, 3, 1, P.lavaCore);
  }
}
// Melt-Through: a broad basalt slab with three holes melted clean through it, lava glowing beneath and dripping down
// its front; obsidian spikes stand on the far edge
export const MELT_HOLES = [[-36, -34, 15, 6], [10, -28, 19, 7.5], [46, -38, 11, 4.5]];
function paintMelt(c) {
  flatGlow(c, 0, -6, 90, 24, P.glow, 0.4);
  const topf = wobble(4, -34, 82, 24, 12, 0.06, 51);
  c.save(); c.translate(0, 22); blobPath(c, topf); c.fillStyle = P.basInk; c.fill(); c.restore();
  // the thick front edge: the top's outline dropped, filled darker, with column joints
  c.save(); c.translate(0, 20); blobPath(c, topf); c.fillStyle = lg(c, -80, -40, 80, 0, [P.bas, P.basLo, '#1a1012']); c.fill(); c.restore();
  c.save(); c.beginPath(); c.rect(-90, -34, 180, 40); c.clip();
  for (let x = -70; x <= 76; x += 13) line(c, [x, -14 - Math.abs(x) * 0.02, x + 1, 2 - Math.abs(x) * 0.1], 'rgba(8,4,6,0.6)', 1);
  c.restore();
  blobPath(c, topf); c.fillStyle = lg(c, -60, -58, 60, -12, [P.basTop, P.basHi, P.bas]); c.fill(); c.strokeStyle = P.basInk; c.lineWidth = 1.2; c.stroke();
  // the holes: a scorched ring, the molten pool far below the rim, a bright core; drips running down the front edge
  for (const [x, y, rx, ry] of MELT_HOLES) {
    ell(c, x, y, rx * 1.35, ry * 1.5, 'rgba(30,10,6,0.6)');
    ell(c, x, y, rx, ry, '#1a0806');
    c.save(); c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.clip();
    ell(c, x, y + ry * 0.55, rx * 0.95, ry * 0.7, P.lavaLo); ell(c, x, y + ry * 0.6, rx * 0.7, ry * 0.45, P.lava); ell(c, x - rx * 0.1, y + ry * 0.62, rx * 0.4, ry * 0.25, P.lavaHot);
    c.restore();
    c.strokeStyle = 'rgba(255,140,60,0.8)'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0.1, Math.PI - 0.1); c.stroke();
    hotCrack(c, [x + rx, y, x + rx + 10, y - 3, x + rx + 18, y + 1], 0.8);
    const dx = x + rx * 0.3, dy = y + ry * 0.5 + 18 + Math.abs(x) * 0.02; // a drip down the front face
    c.lineCap = 'round'; line(c, [dx, dy - 10, dx + 1, dy + 6], 'rgba(255,100,30,0.4)', 5); line(c, [dx, dy - 10, dx + 1, dy + 6], P.lava, 2.4); ell(c, dx + 1, dy + 7, 2.2, 2.6, P.lavaHot);
  }
  // spikes on the far edge, crust bits on top
  for (const [x, h, a] of [[-58, 40, -0.2], [-50, 26, 0.1], [62, 34, 0.25], [70, 20, 0.4]]) spike(c, x, -48, h, 5, a);
  for (const [x, y, r] of [[-12, -46, 5], [28, -46, 4], [-62, -30, 4], [64, -26, 5]]) { ell(c, x, y, r, r * 0.5, P.crust); ell(c, x - r * 0.3, y - r * 0.2, r * 0.4, r * 0.2, P.crustHi); }
}
// Honey Vents: three mounds of sulphur crust, honey-gold drips round their mouths, each mouth steaming (live)
export const VENT_MOUTHS = [[0, -104, 1], [-42, -64, 0.75], [40, -72, 0.8]];
function paintVents(c) {
  flatGlow(c, 0, -4, 80, 22, '#ffc040', 0.35);
  const mound = (x, by, h, w, seed) => {
    softShadow(c, x + w * 0.3, by + 2, w * 1.1, 6, 0.5);
    c.beginPath(); c.moveTo(x - w, by); c.bezierCurveTo(x - w * 0.98, by - h * 0.62, x - w * 0.55, by - h, x - w * 0.24, by - h); c.lineTo(x + w * 0.24, by - h); c.bezierCurveTo(x + w * 0.55, by - h, x + w * 0.98, by - h * 0.62, x + w, by); c.closePath();
    c.fillStyle = lg(c, x, by - h, x, by, [P.sulHi, P.sul, P.sulLo, '#5a3416']); c.fill(); c.strokeStyle = P.sulInk; c.lineWidth = 1.2; c.stroke();
    c.save(); c.clip(); c.fillStyle = lg(c, x - w, 0, x + w, 0, ['rgba(255,250,210,0.35)', 'rgba(255,250,210,0)', 'rgba(60,24,6,0)', 'rgba(60,24,6,0.4)']); c.fillRect(x - w, by - h, w * 2, h); c.restore();
    c.save(); c.clip();
    const R = rng(seed);
    for (let k = 1; k < 5; k++) { const yy = by - h * (k / 5); c.strokeStyle = 'rgba(110,70,20,0.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - w, yy + 4); c.quadraticCurveTo(x, yy - 2 + R() * 4, x + w, yy + 4); c.stroke(); }
    for (let k = 0; k < 4; k++) { const dx = x + (R() - 0.5) * w * 0.4, len = h * (0.25 + R() * 0.3); c.lineCap = 'round'; line(c, [dx, by - h + 2, dx + (R() - 0.5) * 3, by - h + len], '#ffb020', 3.2); line(c, [dx - 0.8, by - h + 2, dx - 0.8, by - h + len * 0.8], '#ffe890', 1); ell(c, dx, by - h + len + 1, 2.2, 2.6, '#f0a018'); } // honey drips
    c.restore();
    ell(c, x, by - h, w * 0.24, w * 0.08 + 1.5, '#2a1406'); ell(c, x, by - h + 0.4, w * 0.15, w * 0.05 + 0.8, '#ff9a2a');
    c.strokeStyle = P.sulHi; c.lineWidth = 1.2; c.beginPath(); c.ellipse(x, by - h, w * 0.26, w * 0.09 + 1.6, 0, Math.PI * 0.95, Math.PI * 2.05); c.stroke();
  };
  mound(0, -8, 96, 44, 61);
  mound(-40, 0, 64, 32, 62);
  mound(40, 2, 74, 32, 63);
  for (const [x, y, r] of [[-66, 2, 5], [62, 4, 6], [-14, 6, 4], [18, 6, 3.5]]) { ell(c, x, y, r, r * 0.55, P.sulLo); ell(c, x - r * 0.3, y - r * 0.25, r * 0.4, r * 0.2, P.sulHi); }
}
// The Spike Forge: a domed stone furnace with a glowing mouth (the fire is live) and a chimney, an anvil with a red-hot
// spike on it, a rack of finished obsidian spikes, a bellows
export const FORGE_MOUTH = [-34, -26];
export const FORGE_CHIMNEY = [-22, -150];
export const FORGE_SPIKE = [36, -50];
function paintForge(c) {
  flatGlow(c, -20, -4, 80, 22, P.glow, 0.45);
  // the spike rack behind (right)
  fillPoly(c, [14, -4, 68, -4, 68, -10, 14, -10], lg(c, 0, -10, 0, -4, [P.woodHi, P.woodLo]), P.woodInk, 0.8);
  for (const x of [18, 64]) fillPoly(c, [x - 2, -4, x + 2, -4, x + 2, -100, x - 2, -100], lg(c, x - 2, 0, x + 2, 0, [P.woodHi, P.woodLo]), P.woodInk, 0.8);
  fillPoly(c, [14, -96, 68, -96, 68, -102, 14, -102], lg(c, 0, -102, 0, -96, [P.woodHi, P.woodLo]), P.woodInk, 0.8);
  for (let k = 0; k < 5; k++) spike(c, 24 + k * 9.5, -12, 76 + (k % 2) * 8, 3.4, 0);
  // the furnace: a stone dome of blocks, a chimney, the mouth
  const dome = () => { c.beginPath(); c.moveTo(-72, 0); c.lineTo(-72, -40); c.quadraticCurveTo(-70, -96, -34, -98); c.quadraticCurveTo(2, -96, 4, -40); c.lineTo(4, 0); c.closePath(); };
  fillPoly(c, [-30, -88, -14, -88, -12, -150, -32, -150], lg(c, -32, 0, -12, 0, [P.basHi, P.bas, P.basLo]), P.basInk, 1.1);
  fillPoly(c, [-34, -150, -10, -150, -10, -156, -34, -156], P.basTop, P.basInk, 0.9);
  ell(c, -22, -153, 9, 2.4, '#1a0c08');
  dome(); c.fillStyle = lg(c, -72, -98, 4, 0, [P.basTop, P.basHi, P.bas, P.basLo]); c.fill(); c.strokeStyle = P.basInk; c.lineWidth = 1.3; c.stroke();
  c.save(); dome(); c.clip();
  for (let r = 0; r < 6; r++) { const y = -10 - r * 15; line(c, [-74, y, 6, y], 'rgba(12,6,8,0.5)', 1); for (let k = 0; k < 7; k++) { const x = -72 + k * 13 + (r % 2) * 6.5; line(c, [x, y, x, y - 15], 'rgba(12,6,8,0.45)', 1); } }
  c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(-74, -100, 30, 100);
  c.restore();
  // the mouth: an arch of fire bricks round a deep orange throat (coals at the bottom; the flame dances live)
  c.beginPath(); c.moveTo(-52, 0); c.lineTo(-52, -28); c.quadraticCurveTo(-50, -52, -34, -52); c.quadraticCurveTo(-18, -52, -16, -28); c.lineTo(-16, 0); c.closePath();
  c.fillStyle = lg(c, 0, -52, 0, 0, ['#5a1006', '#c83a0e', '#ff9a2a']); c.fill(); c.strokeStyle = '#3a1206'; c.lineWidth = 3; c.stroke(); c.strokeStyle = '#b8582a'; c.lineWidth = 1.2; c.stroke();
  for (let k = 0; k < 6; k++) ell(c, -46 + k * 5.6, -4 + (k % 2), 3.2, 2.2, k % 2 ? '#ffd060' : '#ff7a1a');
  // the anvil on its block, the red-hot spike on it, hammer leaning
  fillPoly(c, [22, 4, 52, 4, 50, -24, 24, -24], lg(c, 22, 0, 52, 0, [P.basHi, P.bas, P.basLo]), P.basInk, 1);
  fillPoly(c, [24, -24, 50, -24, 54, -28, 28, -28], P.basTop, P.basInk, 0.8);
  c.beginPath(); c.moveTo(14, -40); c.quadraticCurveTo(20, -36, 28, -36); c.lineTo(30, -28); c.lineTo(46, -28); c.lineTo(48, -36); c.lineTo(58, -36); c.lineTo(58, -44); c.lineTo(22, -44); c.quadraticCurveTo(16, -44, 14, -40); c.closePath();
  c.fillStyle = lg(c, 0, -44, 0, -28, [P.ironHi, P.iron, P.ironLo]); c.fill(); c.strokeStyle = P.ironInk; c.lineWidth = 1.1; c.stroke();
  line(c, [22, -43, 57, -43], 'rgba(230,230,255,0.5)', 1);
  c.save(); c.translate(60, -6); c.rotate(-0.4); fillPoly(c, [-1.5, 0, 1.5, 0, 1.5, -34, -1.5, -34], lg(c, -1.5, 0, 1.5, 0, [P.woodHi, P.woodLo]), P.woodInk, 0.6); fillPoly(c, [-6, -34, 6, -34, 6, -42, -6, -42], lg(c, 0, -42, 0, -34, [P.ironHi, P.ironLo]), P.ironInk, 0.8); c.restore();
  // the bellows by the furnace's foot
  c.save(); c.translate(-4, -6); fillPoly(c, [0, 0, 18, -6, 18, 4, 0, 6], '#6a3a20', P.woodInk, 0.8); fillPoly(c, [18, -3, 26, -1, 18, 1], P.ironHi, P.ironInk, 0.6); c.restore();
}
// The Eruption: the crater itself, a cone of layered basalt, lava spilling over the lip in three runs; the Lava
// Salamander's eyes glow in the crater (live), smoke and eruptions rise from it (mapamb.js, live)
export const CRATER_EYES = [[-8, -186], [8, -186]];
function paintCrater(c) {
  flatGlow(c, 0, -6, 110, 28, P.glow, 0.5);
  // the cone: a lit left flank, a shaded right one, strata, a notched rim
  const cone = [-86, 2, -64, -50, -42, -120, -30, -170, -18, -180, 20, -180, 32, -168, 46, -116, 66, -52, 86, 2];
  c.beginPath(); c.moveTo(cone[0], cone[1]); for (let i = 2; i < cone.length; i += 2) c.lineTo(cone[i], cone[i + 1]); c.closePath();
  c.fillStyle = lg(c, -96, -180, 96, 0, ['#8a6a5e', '#6a4a42', '#4a3230', '#2e1c1c', '#160c0c']); c.fill(); c.strokeStyle = P.basInk; c.lineWidth = 1.4; c.stroke();
  c.save(); poly(c, cone); c.clip();
  fillPoly(c, [6, -180, 20, -180, 32, -168, 46, -116, 66, -52, 86, 2, 20, 2], 'rgba(10,4,6,0.35)');
  for (let k = 1; k < 8; k++) { const y = -180 + k * 23, wv = 4 * Math.sin(k * 1.7); c.strokeStyle = 'rgba(12,6,8,0.25)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-110, y + 10); c.quadraticCurveTo(0, y - 6 + wv, 110, y + 10); c.stroke(); c.strokeStyle = 'rgba(255,210,180,0.1)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-110, y + 8); c.quadraticCurveTo(0, y - 8 + wv, 110, y + 8); c.stroke(); }
  // the lava runs: from the lip down the front, each a glowing ribbon that spreads at the foot
  for (const run of [[-10, -176, -16, -130, -30, -80, -40, -30, -52, 0], [8, -176, 14, -140, 10, -96, 22, -46, 30, 0], [-2, -176, -4, -150, 0, -120]]) {
    c.lineCap = 'round'; c.lineJoin = 'round';
    const path = () => { c.beginPath(); c.moveTo(run[0], run[1]); for (let i = 2; i < run.length - 2; i += 2) c.quadraticCurveTo(run[i], run[i + 1], (run[i] + run[i + 2]) / 2, (run[i + 1] + run[i + 3]) / 2); c.lineTo(run[run.length - 2], run[run.length - 1]); };
    path(); c.strokeStyle = 'rgba(255,90,20,0.3)'; c.lineWidth = 12; c.stroke();
    path(); c.strokeStyle = P.lavaLo; c.lineWidth = 6.5; c.stroke();
    path(); c.strokeStyle = P.lava; c.lineWidth = 4; c.stroke();
    path(); c.strokeStyle = P.lavaHot; c.lineWidth = 1.6; c.stroke();
  }
  c.restore();
  // the lip: a ragged rim lit from inside, the crater's molten mouth
  ell(c, 0, -180, 30, 8, '#1a0806');
  c.save(); c.beginPath(); c.ellipse(0, -180, 30, 8, 0, 0, TAU); c.clip();
  ell(c, 0, -176, 28, 7, P.lavaLo); ell(c, 0, -175, 20, 4.6, P.lava); ell(c, -3, -175, 11, 2.4, P.lavaHot);
  c.restore();
  glowAt(c, 0, -184, 46, P.glow, 0.4);
  c.strokeStyle = '#ffb060'; c.lineWidth = 1.4; c.beginPath(); c.ellipse(0, -180, 30, 8, 0, 0.15, Math.PI - 0.15); c.stroke();
  for (const [x, h] of [[-30, 10], [-20, 6], [24, 9], [31, 5]]) fillPoly(c, [x - 5, -178, x, -178 - h, x + 5, -177], P.bas, P.basInk, 0.8);
  // the pool at the foot where the runs gather, rocks round it
  blobPath(c, wobble(-8, 2, 66, 9, 10, 0.12, 71)); c.fillStyle = P.crust; c.fill();
  blobPath(c, wobble(-8, 1, 58, 6, 10, 0.12, 72)); c.fillStyle = lg(c, 0, -6, 0, 8, [P.lavaHot, P.lava, P.lavaLo]); c.fill();
  for (const [x, y, s, sd] of [[-74, 6, 16, 3], [70, 6, 18, 4], [-54, 10, 10, 5], [52, 10, 11, 6]]) rockLump(c, x, y, s, sd, sd % 2 === 1);
}
const PAINT = { gate: paintGate, melt: paintMelt, vents: paintVents, forge: paintForge, crater: paintCrater };

// ------------------------------------------------------------------ landmarks on the map (called by main.js)
export function drawVolcanoLandmark(ctx, L, m, sy, t, calm, p, glow, DPR) {
  const y = drawLandmarkBody(ctx, m, sy, t, calm, p, glow, DPR, (c, mm) => PAINT[mm.kind](c), '#ffb24a', '#ffd88a');
  if (y == null) return;
  const d = m.d, f = m.flip ? -1 : 1, T = calm ? 0 : t, X = (v) => m.x + v * d * f, Yy = (v) => y + v * d;
  const sq = p && !calm;
  if (sq) { ctx.save(); ctx.translate(m.x, y); ctx.scale(1 + 0.035 * p, 1 - 0.045 * p); ctx.translate(-m.x, -y); }
  if (m.kind === 'gate') { for (let i = 0; i < 2; i++) { const [bx, by] = GATE_FIRE[i]; glowBlit(ctx, X(bx), Yy(by - 8), 30 * d, '#ff8a2a', calm ? 0.6 : 0.55 + 0.15 * Math.sin(T * 6 + i)); flame(ctx, X(bx), Yy(by), 6.5 * d, T, i * 2.3); } }
  else if (m.kind === 'melt') meltLife(ctx, m, X, Yy, d, T, calm);
  else if (m.kind === 'vents') { for (let i = 0; i < 3; i++) { const [vx, vy, k] = VENT_MOUTHS[i]; steam(ctx, X(vx), Yy(vy), d * k, T + i * 1.37, calm, 3.4 + i * 0.6, '255,236,180'); } }
  else if (m.kind === 'forge') {
    glowBlit(ctx, X(FORGE_MOUTH[0]), Yy(FORGE_MOUTH[1]), 40 * d, '#ff8a2a', calm ? 0.6 : 0.55 + 0.12 * Math.sin(T * 7.3));
    flame(ctx, X(FORGE_MOUTH[0]), Yy(-4), 9 * d, T, 1.1);
    const hot = calm ? 0.7 : 0.55 + 0.45 * Math.sin(T * 1.6); // the spike on the anvil glows and cools as it is worked
    ctx.lineCap = 'round'; ctx.strokeStyle = `rgba(255,${Math.round(90 + 120 * hot)},${Math.round(30 + 60 * hot)},1)`; ctx.lineWidth = 2.6 * d; ctx.beginPath(); ctx.moveTo(X(FORGE_SPIKE[0] - 12), Yy(FORGE_SPIKE[1] + 2)); ctx.lineTo(X(FORGE_SPIKE[0] + 14), Yy(FORGE_SPIKE[1] - 1)); ctx.stroke();
    glowBlit(ctx, X(FORGE_SPIKE[0]), Yy(FORGE_SPIKE[1]), 16 * d, '#ff6a1a', 0.5 * hot);
    if (!calm) { const k = fract(T / 2.4); if (k < 0.18) { ctx.fillStyle = '#ffe08a'; for (let q = 0; q < 5; q++) { const a = -0.4 - q * 0.5, r = (6 + k * 80) * d; ctx.globalAlpha = 1 - k / 0.18; ctx.beginPath(); ctx.arc(X(FORGE_SPIKE[0] + Math.cos(a) * r / d), Yy(FORGE_SPIKE[1] + Math.sin(a) * r / d), 1.2 * d, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; } } // sparks off the hammer's beat
    smoke(ctx, X(FORGE_CHIMNEY[0]), Yy(FORGE_CHIMNEY[1]), d, T, calm);
  } else if (m.kind === 'crater') {
    glowBlit(ctx, X(0), Yy(-182), 54 * d, '#ff7a2a', calm ? 0.55 : 0.45 + 0.2 * Math.sin(T * 2.1) * Math.sin(T * 0.7 + 1));
    // the boss's eyes in the crater: open, glow, blink, look about
    const cyc = fract(T / 5.1), bl = calm ? 0 : cyc > 0.92 ? Math.sin(((cyc - 0.92) / 0.08) * Math.PI) : 0, lk = calm ? 0 : Math.sin(T * 0.7) * 2.4;
    for (const [ex, ey] of CRATER_EYES) { const x = X(ex + lk), yy = Yy(ey); ctx.fillStyle = 'rgba(255,220,80,0.3)'; ctx.beginPath(); ctx.ellipse(x, yy, 6 * d, 4 * d * Math.max(0.15, 1 - bl), 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff0a0'; ctx.beginPath(); ctx.ellipse(x, yy, 3.4 * d, 2.2 * d * Math.max(0.1, 1 - bl), ex < 0 ? 0.25 : -0.25, 0, TAU); ctx.fill(); ctx.fillStyle = '#3a0a02'; ctx.beginPath(); ctx.ellipse(x + lk * 0.3 * d, yy, 0.8 * d, 1.8 * d * Math.max(0.1, 1 - bl), 0, 0, TAU); ctx.fill(); }
    if (!calm) { // glints running down the lava runs
      ctx.fillStyle = '#fff2b0';
      for (let q = 0; q < 6; q++) { const k = fract(T * 0.22 + q / 6), run = q % 2, x = run ? lerp(8, 30, k) + Math.sin(k * 5) * 4 : lerp(-10, -52, k) - Math.sin(k * 4) * 3, yy = lerp(-176, -2, k); ctx.globalAlpha = Math.sin(k * Math.PI) * 0.9; ctx.beginPath(); ctx.ellipse(X(x), Yy(yy), 1.6 * d, 2.6 * d, 0, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
  }
  if (sq) ctx.restore();
}
function meltLife(ctx, m, X, Yy, d, T, calm) {
  for (let i = 0; i < 3; i++) {
    const [hx, hy, rx, ry] = MELT_HOLES[i];
    glowBlit(ctx, X(hx), Yy(hy), rx * 2.2 * d, '#ff8a2a', calm ? 0.4 : 0.32 + 0.12 * Math.sin(T * 2 + i * 2));
    if (calm) continue;
    const k = fract(T / (2.6 + i * 0.7) + i * 0.3); // a bubble swells in the hole and pops
    if (k < 0.7) { const r = ss(k / 0.7) * rx * 0.4 * d; ctx.fillStyle = '#ffd060'; ctx.beginPath(); ctx.ellipse(X(hx + rx * 0.1), Yy(hy + ry * 0.5), r, r * 0.6, 0, 0, TAU); ctx.fill(); }
    else { const q = (k - 0.7) / 0.3; ctx.strokeStyle = `rgba(255,220,120,${1 - q})`; ctx.lineWidth = 1 * d; ctx.beginPath(); ctx.ellipse(X(hx + rx * 0.1), Yy(hy + ry * 0.5), (rx * 0.4 + q * rx * 0.5) * d, (ry * 0.3 + q * ry * 0.3) * d, 0, 0, TAU); ctx.stroke(); }
    steam(ctx, X(hx), Yy(hy - 2), d * 0.6, T + i * 1.9, calm, 4.4, '255,210,170');
  }
}
// a few soft puffs rising and swelling from a mouth (x, y); one breath every `per` seconds
function steam(ctx, x, y, d, t, calm, per, col) {
  if (calm) return;
  const g = puffSprite(col); if (!g) return;
  for (let q = 0; q < 4; q++) { // stamped from a soft puff picture made once
    const k = fract(t / per + q * 0.25), a = Math.sin(k * Math.PI) * (k < 0.2 ? k / 0.2 : 1), r = (6 + k * 17) * d;
    if (a < 0.02) continue;
    ctx.globalAlpha = 0.5 * a; ctx.drawImage(g, x + Math.sin(k * 5 + q) * 6 * d - r, y - k * 60 * d - r, 2 * r, 2 * r);
  }
  ctx.globalAlpha = 1;
}
function smoke(ctx, x, y, d, t, calm) {
  if (calm) return;
  const g = puffSprite('70,52,52'); if (!g) return;
  for (let q = 0; q < 5; q++) { const k = fract(t * 0.22 + q / 5), r = (6 + k * 18) * d; ctx.globalAlpha = 0.5 * (1 - k); ctx.drawImage(g, x + Math.sin(k * 4 + q) * 6 * d + k * 14 * d - r, y - k * 70 * d - r, 2 * r, 2 * r); }
  ctx.globalAlpha = 1;
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
const PUFF = new Map();
function puffSprite(col) { // a puff of steam: solid in the middle, soft at the rim (col: 'r,g,b')
  let cv = PUFF.get(col); if (cv) return cv;
  if (typeof document === 'undefined') return null;
  cv = document.createElement('canvas'); cv.width = cv.height = 48;
  const g = cv.getContext('2d'); g.fillStyle = rg(g, 24, 24, 0, 24, [`rgba(${col},0.9)`, `rgba(${col},0.75)`, `rgba(${col},0)`]); g.fillRect(0, 0, 48, 48);
  PUFF.set(col, cv); return cv;
}
function glowBlit(ctx, x, y, r, col, a) { const g = glowSprite(col); if (!g || a <= 0.01) return; ctx.globalAlpha = a; ctx.drawImage(g, x - r, y - r, 2 * r, 2 * r); ctx.globalAlpha = 1; }
export const drawVolcanoPlaque = drawFarmPlaque;

// ------------------------------------------------------------------ the live layer
function win(t, a, b, f = 0.25) { return ss((t - a) / f) * (1 - ss((t - b) / f)); }
const vis = (y0, y1, vt, vb) => y1 >= vt && y0 <= vb;
export function drawVolcanoLive(ctx, L, sy, t, calm, vt = -Infinity, vb = Infinity) {
  const plan = volcanoPlan(L), u = L.u, T = calm ? 0 : t;
  if (plan.lms.length < 5) return;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  try {
    if (plan.river) { const S = plan.river, y0 = Math.min(S.fall.y - 60 * u, S.lake.y - 30 * u, S.cross.y - 30 * u), y1 = Math.max(S.lake.y, S.fall.y, S.cross.y) + 30 * u; if (vis(y0 - sy, y1 - sy, vt, vb)) lava(ctx, L, plan, sy, u, T, calm); }
    const vn = spot(plan, 'vent'); if (vn && vis(vn.y - 80 * u - sy, vn.y - sy, vt, vb)) steam(ctx, vn.x + VENT_TOP[0] * u * vn.s, vn.y - sy + VENT_TOP[1] * u * vn.s, u * vn.s * 0.7, T, calm, 3.1, '255,232,200');
    for (const w of plan.walks) { const lp = w.lp; if (vis(lp.y - lp.r - 60 * u - sy, lp.y + lp.r + 30 * u - sy, vt, vb)) walker(ctx, L, w, sy, u, T, calm); }
  } catch (e) { /* art never breaks the map */ }
  ctx.restore();
}
// over the landmarks: the crater's smoke and eruptions, and embers drifting up the slope (the map's own volcano
// ambience, mapamb.js, aimed at this crater)
export function drawVolcanoFront(ctx, L, sy, t, calm, vt = -Infinity, vb = Infinity) {
  if (calm) return;
  const plan = volcanoPlan(L), u = L.u, cr = plan.lms[4], top = L.bandTop(WI);
  if (!cr || !vis(top - 120 * u - sy, top + L.BH - sy, vt, vb)) return;
  const s = 120 * cr.d, cx = cr.x + CRATER_TOP[0] * cr.d * (cr.flip ? -1 : 1), cy = cr.y + CRATER_TOP[1] * cr.d - sy;
  const crater = [{ x: cx, y: cy + s * 0.82, s }], none = [];
  const G = { x0: L.A.x, x1: L.A.x1, y: top - sy, h: L.BH, u, t, spots: (k) => (k === 'volcano' ? crater : none) };
  drawMapAmb(ctx, 'back', WI, G);
  drawMapAmb(ctx, 'front', WI, G);
}
// the lava: light sliding down the flow, crust rafts drifting, bubbles swelling and popping, the fall pouring, the
// lake breathing
function lava(ctx, L, plan, sy, u, t, calm) {
  const S = plan.river, pts = S.pts;
  for (let i = 0; i < 6; i++) { const p = riverAt(pts, (i + 0.5) / 6); glowBlit(ctx, p.x, p.y - sy, 34 * u, '#ff7a2a', calm ? 0.3 : 0.24 + 0.1 * Math.sin(t * 1.3 + i * 1.7)); }
  glowBlit(ctx, S.lake.x, S.lake.y - sy, 80 * u, '#ff8a2a', calm ? 0.35 : 0.3 + 0.1 * Math.sin(t * 0.9));
  if (calm) return;
  const near = (x, y) => Math.abs(x - L.pathX(y + sy)) < L.roadW * 0.6 + 8 * u;
  ctx.fillStyle = '#fff0a0';
  for (let q = 0; q < 14; q++) { const f = fract(q / 14 + t * 0.035), p = riverAt(pts, f), x = p.x, y = p.y - sy + Math.sin(q * 2.3) * S.w * 0.18; if (near(x, y)) continue; ctx.globalAlpha = 0.3 + 0.5 * Math.sin(f * Math.PI); ctx.beginPath(); ctx.ellipse(x, y, 4 * u, 1 * u, 0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#2c1c18'; // rafts of crust riding the flow
  for (let q = 0; q < 5; q++) { const f = fract(q / 5 + t * 0.022), p = riverAt(pts, f), x = p.x, y = p.y - sy + Math.cos(q * 1.9) * S.w * 0.12; if (near(x, y) || f > 0.97) continue; ctx.globalAlpha = Math.min(1, Math.sin(f * Math.PI) * 3); ctx.beginPath(); ctx.ellipse(x, y, 3.6 * u, 1.6 * u, 0.3, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
  for (let q = 0; q < 4; q++) { // bubbles: in the river and the lake
    const k = fract(t / (2.2 + q * 0.5) + q * 0.37), lakeB = q > 1, n = Math.floor(t / (2.2 + q * 0.5) + q * 0.37);
    const p = lakeB ? { x: S.lake.x + Math.sin(n * 2.7 + q) * 36 * u, y: S.lake.y + Math.cos(n * 1.9 + q) * 8 * u } : riverAt(pts, 0.15 + fract(Math.sin(n * 12.9 + q) * 43.7) * 0.7);
    const x = p.x, y = p.y - sy; if (near(x, y)) continue;
    if (k < 0.7) { const r = ss(k / 0.7) * 3.4 * u; ctx.fillStyle = '#ffd060'; ctx.beginPath(); ctx.arc(x, y - r * 0.4, r, Math.PI, TAU); ctx.fill(); ctx.fillStyle = '#fff6c0'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.7, r * 0.3, 0, TAU); ctx.fill(); }
    else { const q2 = (k - 0.7) / 0.3; ctx.strokeStyle = `rgba(255,230,140,${1 - q2})`; ctx.lineWidth = 1 * u; ctx.beginPath(); ctx.ellipse(x, y, (2 + q2 * 9) * u, (1 + q2 * 3) * u, 0, 0, TAU); ctx.stroke(); ctx.fillStyle = `rgba(255,200,90,${1 - q2})`; for (let s2 = -1; s2 <= 1; s2 += 2) { ctx.beginPath(); ctx.arc(x + s2 * q2 * 7 * u, y - Math.sin(q2 * Math.PI) * 7 * u, 1.1 * u, 0, TAU); ctx.fill(); } }
  }
  const F = S.fall, sd = F.x > L.cx ? -1 : 1, fx = F.x + sd * 4 * u, fy = F.y - sy; // the fall pours
  ctx.strokeStyle = 'rgba(255,250,200,0.8)'; ctx.lineWidth = 1.2 * u;
  for (let q = 0; q < 4; q++) { const a = fract(t * 0.9 + q * 0.27), x = fx + sd * (10 + q * 4) * u, y0 = fy - 26 * u + a * 24 * u; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 + 6 * u); ctx.stroke(); }
}

// ------------------------------------------------------------------ the salamanders
// Each walks a loop in its own patch (a stadium: two straights joined by two half turns, squashed into the 3/4 view),
// so it goes one way along the near side, turns round at the end and comes back along the far side: always nose first,
// the body following the path it walked (drawCrawler's trail). Between walks it stops to do its thing.
function loopLen(lp) { return 2 * lp.Ls + TAU * lp.r; }
function loopPt(lp, s) {
  const Ls = lp.Ls, r = lp.r, Pp = loopLen(lp), h = Math.PI * r;
  s = ((s % Pp) + Pp) % Pp;
  let px, py;
  if (s < Ls) { px = -Ls / 2 + s; py = r; }
  else if (s < Ls + h) { const a = (s - Ls) / r; px = Ls / 2 + r * Math.sin(a); py = r * Math.cos(a); }
  else if (s < 2 * Ls + h) { px = Ls / 2 - (s - Ls - h); py = -r; }
  else { const a = (s - 2 * Ls - h) / r; px = -Ls / 2 - r * Math.sin(a); py = -r * Math.cos(a); }
  return { x: lp.x + lp.dir * px, y: lp.y + py * lp.sq };
}
// a routine: a list of [seconds, kind, distance] steps run in a cycle. Returns where along the loop the head is, the
// distance walked in all (the legs' gait), and the step's own clock
function routine(steps, t, Pp) {
  let C = 0; for (const s of steps) C += s[0];
  const n = Math.floor(t / C); let k = t - n * C, dist = 0;
  for (const s of steps) {
    const [dur, kind, dd] = s;
    if (k < dur) { const e = kind === 'walk' ? (k / dur) * 0.86 + ss(k / dur) * 0.14 : 0; return { s: dist + (dd || 0) * e, gait: n * Pp + dist + (dd || 0) * e, kind, k, dur, moving: kind === 'walk' ? win(k, 0, dur, 0.22) : 0 }; }
    k -= dur; dist += s[1] === 'walk' ? s[2] : 0;
  }
  return { s: 0, gait: n * Pp, kind: 'rest', k: 0, dur: 1, moving: 0 };
}
const BLEND = {};
// The salamanders are the game's full crawler rig, too many strokes to paint every frame for a map: each is painted onto
// its own small picture 12 times a second (slot: which picture) and the picture is stamped every frame where the head
// is now, so it glides smoothly while the legs and body move at 12 steps a second. freeSalamanders gives them back.
const CSPR = new Map();
export function freeSalamanders() { for (const e of CSPR.values()) freeCanvas(e.cv); CSPR.clear(); }
const STAG = { bask: 0, bank: 0.5, pair0: 0.25, pair1: 0.75 }; // the pictures are repainted on different frames
function crawler(ctx, slot, x, y, s, t, o) {
  const D = (ctx.getTransform ? Math.abs(ctx.getTransform().d) : 1) || 1, R = s * 2.6, W = Math.ceil(2 * R * D), key = `${Math.floor(t * 12 + (STAG[slot] || 0))}|${W}`;
  let e = CSPR.get(slot);
  if (!e || e.key !== key) {
    if (typeof document === 'undefined') return;
    if (e && (e.cv.width < W || e.cv.width > W * 1.6)) { freeCanvas(e.cv); e = null; }
    if (!e) { e = { cv: document.createElement('canvas'), key: '' }; e.cv.width = e.cv.height = W; CSPR.set(slot, e); }
    const c = e.cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, e.cv.width, e.cv.height);
    c.setTransform(D, 0, 0, D, D * (R - x), D * (R - y)); c.lineCap = 'round'; c.lineJoin = 'round';
    drawCrawler(c, x, y, s, t, o, 'salamander');
    e.key = key; e.W = W; e.x = x; e.y = y; e.R = R;
  }
  ctx.drawImage(e.cv, 0, 0, e.W, e.W, x - e.R, y - e.R, e.W / D, e.W / D);
}
function walker(ctx, L, w, sy, u, t, calm) {
  const lp = w.lp, Pp = loopLen(lp), half = lp.Ls + Math.PI * lp.r, v = 30 * u;
  if (w.k === 'pair') return pair(ctx, w, sy, u, t, calm);
  let R;
  if (w.k === 'bask') R = calm ? { s: 0, gait: 0, kind: 'bask', k: 1, dur: 4, moving: 0 } : routine([[4.4, 'bask'], [half / v, 'walk', half], [2.4, 'puff'], [half / v, 'walk', Pp - half]], t, Pp);
  else R = calm ? { s: 0, gait: 0, kind: 'look', k: 0, dur: 2, moving: 0 } : routine([[half / (v * 0.8), 'walk', half], [2.2, 'look'], [half / (v * 0.8), 'walk', Pp - half], [1.8, 'lick']], t + 3.3, Pp);
  const B = BLEND; for (const k in B) delete B[k];
  B.walk = R.moving; let aim = 0, glow = 0.7;
  if (R.kind === 'bask') { glow = 0.95; const fl = win(R.k, 2.6, 3.0, 0.08); B.tongue = fl; B.mouth = fl * 0.3; B.crouch = 0.25; }
  else if (R.kind === 'puff') { // looks round, rears up a little and puffs a small flame
    aim = Math.sin(clamp(R.k / 1, 0, 1) * Math.PI * 2) * 0.45; const up = win(R.k, 1.0, 2.2, 0.2), fi = win(R.k, 1.25, 1.95, 0.08);
    B.rear = up * 0.5; B.mouth = up * (0.3 + 0.7 * fi); B.fire = fi; B.swell = win(R.k, 0.8, 1.25, 0.15) * 0.8; glow = 0.8 + 0.2 * up;
  } else if (R.kind === 'look') { aim = Math.sin((R.k / R.dur) * Math.PI * 2) * 0.55; }
  else if (R.kind === 'lick') { const fl = win(R.k, 0.5, 0.9, 0.08) + win(R.k, 1.1, 1.4, 0.06); B.tongue = clamp(fl, 0, 1); B.mouth = fl * 0.3; }
  const head = loopPt(lp, R.s);
  const trail = (d) => { const q = loopPt(lp, R.s - d); q.y -= sy; return q; };
  crawler(ctx, w.k, head.x, head.y - sy, w.s, t, { trail, gait: R.gait, pose: 'idle', blend: B, glow, aim, fireLen: 38, look: { x: 0.4 + aim, y: 0.2 }, id: w.k === 'bask' ? 9501 : 9502, curve: 0 });
}
// two young salamanders chasing each other round a boulder: they run, stop, one rears and hisses, off they go again.
// The far side of the loop passes behind the boulder (drawn here, between them)
function pair(ctx, w, sy, u, t, calm) {
  const lp = w.lp, Pp = loopLen(lp), C = 9, k = calm ? 0 : fract(t / C) * C, n = calm ? 0 : Math.floor(t / C);
  const run = (a, b) => (k < a ? 0 : k > b ? 1 : (k - a) / (b - a));
  const prog = (run(0, 3.2) + run(4.6, 7.4)) * Pp * 0.5 * 1.0, base = n * Pp;
  const moving = calm ? 0 : win(k, 0, 3.2, 0.2) + win(k, 4.6, 7.4, 0.2), hiss = calm ? 0 : win(k, 3.4, 4.4, 0.12);
  const bodies = [0, Pp * 0.5].map((off, i) => { const s = prog + off + (i ? Math.sin(k * 1.3) * 3 * u : 0), p = loopPt(lp, s); return { i, s, p }; });
  bodies.sort((a, b) => a.p.y - b.p.y);
  const boulder = () => { const x = lp.x, y = lp.y + 4 * u - sy; ctx.fillStyle = 'rgba(14,4,4,0.4)'; ctx.beginPath(); ctx.ellipse(x + 3 * u, y + 2 * u, 20 * u, 5 * u, 0, 0, TAU); ctx.fill(); ctx.fillStyle = P.bas; ctx.beginPath(); ctx.moveTo(x - 18 * u, y); ctx.quadraticCurveTo(x - 20 * u, y - 16 * u, x - 4 * u, y - 22 * u); ctx.quadraticCurveTo(x + 14 * u, y - 24 * u, x + 18 * u, y); ctx.closePath(); ctx.fill(); ctx.strokeStyle = P.basInk; ctx.lineWidth = 1 * u; ctx.stroke(); ctx.fillStyle = P.basTop; ctx.beginPath(); ctx.moveTo(x - 14 * u, y - 12 * u); ctx.quadraticCurveTo(x - 8 * u, y - 21 * u, x + 2 * u, y - 21 * u); ctx.quadraticCurveTo(x - 2 * u, y - 14 * u, x - 14 * u, y - 12 * u); ctx.fill(); ctx.strokeStyle = '#ff9a3a'; ctx.lineWidth = 1 * u; ctx.beginPath(); ctx.moveTo(x - 6 * u, y - 6 * u); ctx.lineTo(x + 2 * u, y - 10 * u); ctx.lineTo(x + 8 * u, y - 7 * u); ctx.stroke(); };
  let drewRock = false;
  for (const b of bodies) {
    if (!drewRock && b.p.y > lp.y) { boulder(); drewRock = true; }
    const B = BLEND; for (const kk in B) delete B[kk];
    B.walk = moving; if (b.i === 0) { B.rear = hiss * 0.6; B.mouth = hiss; B.angry = hiss; B.frill = 0.22 + 0.7 * hiss; B.shake = hiss; }
    const trail = (d) => { const q = loopPt(lp, b.s - d); q.y -= sy; return q; };
    crawler(ctx, 'pair' + b.i, b.p.x, b.p.y - sy, w.s, t + b.i * 0.7, { trail, gait: base + b.s, pose: 'idle', blend: B, glow: 0.8, id: 9503 + b.i, aim: b.i === 1 ? hiss * -0.4 : 0 });
  }
  if (!drewRock) boulder();
}

// the registry entry (mapscene.js PLACES)
export const PLACE = { landmarks: LMS, paintBand: paintVolcanoBand, drawLive: drawVolcanoLive, drawFront: drawVolcanoFront, stop: volcanoStop, drawLandmark: drawVolcanoLandmark, drawPlaque: drawVolcanoPlaque };
