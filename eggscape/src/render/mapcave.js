// World 4, the Crystal Caves, as one place (0.8.10, mykee on the 0.8.9 map: "the level map was not properly built. The
// animations look stale ... they look kind of kiddish"). Built the way the Farm is (mapfarm.js): the inside of a great
// cavern seen from the same raised 3/4 angle, the light from the upper left. Far wall dim and blue at the top, the
// floor nearer and richer toward the bottom, daylight spilling in from the snowfield below.
// The five stops are five landmarks that ARE the tap targets: the Cave Mouth, the Crystal Bridge, the Miners' Camp,
// the Great Geode and the Crystal Throne (Duke Quartz's lair), each with the Farm's wooden plaque at the road side.
//
// What is painted where (the Farm's rules, binding: the map scrolls at 60 fps on a phone):
//   paintCaveBand   rock walls and ledges, the floor and its crystal veins, the stream and the road's stone bridge,
//                   the mine rails, the crystal clusters, the rock lip and its stalactites: painted ONCE (band cache)
//   landmark sprites  each landmark painted ONCE into its own canvas and stamped (a press squashes it like a button)
//   drawCaveLive    the life, every frame, only what is on screen, pure functions of the clock: no state, no
//                   allocation in the loops, no gradients made per frame (glows are cached sprites), no shadowBlur.
// Reduced motion (calm): everything holds still.
import { planStops, drawLandmarkBody, drawFarmPlaque, signBox, lmArt } from './mapfarm.js';
import { freeCanvas } from './cvfree.js';
import { drawThief, thiefPose } from './thieves.js';
import { drawCrawler } from './crawlers.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const fract = (x) => x - Math.floor(x);
function rng(seed) { let s = (seed * 9301 + 49297) % 233280 || 1; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }
const WI = 3; // the world index

// ------------------------------------------------------------------ colour
const RGB = new Map();
function rgb(h) { let v = RGB.get(h); if (!v) { const n = parseInt(h.slice(1), 16); v = [n >> 16, (n >> 8) & 255, n & 255]; RGB.set(h, v); } return v; }
function mix(a, b, k) { const A = rgb(a), B = rgb(b); return `rgb(${Math.round(A[0] + (B[0] - A[0]) * k)},${Math.round(A[1] + (B[1] - A[1]) * k)},${Math.round(A[2] + (B[2] - A[2]) * k)})`; }
function rgba(h, al) { const A = rgb(h); return `rgba(${A[0]},${A[1]},${A[2]},${al})`; }
function lg(c, x0, y0, x1, y1, cols) { const g = c.createLinearGradient(x0, y0, x1, y1); cols.forEach((s, i) => g.addColorStop(i / (cols.length - 1), s)); return g; }
function rg(c, x, y, r0, r1, cols) { const g = c.createRadialGradient(x, y, r0, x, y, r1); cols.forEach((s, i) => g.addColorStop(i / (cols.length - 1), s)); return g; }

// the cave's palette: violet rock lit cool from the upper left, crystal light in three colours
const P = {
  far: '#262250', back: '#2f2a5c', floor: '#3a3168', floorNear: '#43386f', floorLo: '#2a2450', floorHi: '#54478a',
  rock: '#40366e', rockHi: '#62549c', rockTop: '#7a6cb8', rockLo: '#2a2250', rockInk: '#17122e',
  stone: '#8a88aa', stoneHi: '#b4b4d0', stoneLo: '#5e5c80', stoneInk: '#2c2a48',
  wood: '#a87a4e', woodHi: '#c89a68', woodLo: '#7a5432', woodInk: '#3e2814',
  canvas: '#e2cf9e', canvasLo: '#b49a68', canvasInk: '#6a5232',
  iron: '#5a5e70', ironHi: '#8a90a6', ironLo: '#383a4a', ironInk: '#1c1e2a',
  water: '#1f5f8c', waterHi: '#5ac8e8', waterLo: '#123e64', waterGlow: '#8ae8ff',
  lamp: '#ffd27a', lampHot: '#fff2c0',
  snow: '#f4fbff', snowLo: '#c6dcf2',
};
const AM = { base: '#a070e8', hi: '#ead6ff', lo: '#5a2aa8', ink: '#2c1260', glow: '#b48cff' }; // amethyst
const CY = { base: '#46c4e4', hi: '#dcfbff', lo: '#1e7aa6', ink: '#0c3a5a', glow: '#7ae6ff' }; // cyan
const RO = { base: '#ee72c4', hi: '#ffdcf2', lo: '#a83486', ink: '#561244', glow: '#ff9ad8' }; // rose

// ------------------------------------------------------------------ small painting kit (unit space)
function poly(c, pts) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); }
function fillPoly(c, pts, fill, ink, lw) { poly(c, pts); c.fillStyle = fill; c.fill(); if (ink) { c.strokeStyle = ink; c.lineWidth = lw || 1.2; c.lineJoin = 'round'; c.stroke(); } }
function ell(c, x, y, rx, ry, fill) { c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, TAU); c.fillStyle = fill; c.fill(); }
function softShadow(c, x, y, rx, ry, a = 0.4) { c.save(); c.translate(x, y); c.scale(1, ry / rx); c.fillStyle = rg(c, 0, 0, 0, rx, [`rgba(8,4,24,${a})`, `rgba(8,4,24,${a * 0.6})`, 'rgba(8,4,24,0)']); c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill(); c.restore(); }
function glowAt(c, x, y, r, col, a = 0.5) { c.fillStyle = rg(c, x, y, 0, r, [rgba(col, a), rgba(col, a * 0.35), rgba(col, 0)]); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
function blobPath(c, pts) {
  const n = pts.length / 2; c.beginPath();
  const mx = (i) => (pts[(2 * i) % (2 * n)] + pts[(2 * i + 2) % (2 * n)]) / 2, my = (i) => (pts[(2 * i + 1) % (2 * n)] + pts[(2 * i + 3) % (2 * n)]) / 2;
  c.moveTo(mx(n - 1), my(n - 1));
  for (let i = 0; i < n; i++) c.quadraticCurveTo(pts[2 * i], pts[2 * i + 1], mx(i), my(i));
  c.closePath();
}
function wobble(x, y, rx, ry, n, amt, seed) { const R = rng(seed), out = []; for (let i = 0; i < n; i++) { const a = (i / n) * TAU, k = 1 + (R() - 0.5) * 2 * amt; out.push(x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k); } return out; }

// a faceted crystal: lit left face, shaded right face, a two-facet tip, a bright edge; base at (x, y), leaning by a
function shard(c, x, y, h, w, a, C, glint = true) {
  c.save(); c.translate(x, y); c.rotate(a);
  const sh = h * 0.74, rx = -w * 0.18;
  fillPoly(c, [-w, 0, -w, -sh, 0, -h, w, -sh, w, 0], C.ink, C.ink, Math.max(0.8, w * 0.16));
  fillPoly(c, [-w, 0, -w, -sh, rx, -sh * 1.02, rx, 0], lg(c, -w, -sh, rx, 0, [C.hi, C.base]));
  fillPoly(c, [rx, 0, rx, -sh * 1.02, w, -sh, w, 0], lg(c, rx, -sh, w, 0, [C.base, C.lo]));
  fillPoly(c, [-w, -sh, 0, -h, rx, -sh * 1.02], mix(C.hi, '#ffffff', 0.4));
  fillPoly(c, [rx, -sh * 1.02, 0, -h, w, -sh], C.base);
  if (glint) { c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = Math.max(0.6, w * 0.12); c.beginPath(); c.moveTo(-w * 0.62, -h * 0.08); c.lineTo(-w * 0.62, -sh * 0.9); c.stroke(); }
  c.fillStyle = rgba(C.lo, 0.35); c.fillRect(-w, -h * 0.1, w * 2, h * 0.1); // the root sits in shade
  c.restore();
}
// a cluster of shards with its own soft light: the glow on the floor, a halo, the shards back to front
function cluster(c, x, y, s, C, seed, n = 6) {
  const R = rng(seed);
  glowAt(c, x, y - s * 0.4, s * 1.25, C.glow, 0.32);
  c.save(); c.translate(x, y); c.scale(1, 0.32); glowAt(c, 0, 0, s * 1.1, C.glow, 0.45); c.restore();
  softShadow(c, x + s * 0.12, y + s * 0.02, s * 0.62, s * 0.12, 0.45);
  const L = [];
  for (let i = 0; i < n; i++) { const f = n === 1 ? 0.5 : i / (n - 1), a = lerp(-0.62, 0.62, f) + (R() - 0.5) * 0.25, hh = s * (0.45 + R() * 0.35) * (1 - Math.abs(f - 0.5) * 0.7), ww = s * (0.09 + R() * 0.05); L.push([x + lerp(-s * 0.42, s * 0.42, f) + (R() - 0.5) * s * 0.1, y + (R() - 0.3) * s * 0.06, hh, ww, a]); }
  L.push([x - s * 0.05, y + s * 0.02, s, s * 0.16, -0.06]); // the big one in the middle
  L.sort((p, q) => q[2] - p[2]); // tall ones behind
  for (const [sx, sy, hh, ww, a] of L) shard(c, sx, sy, hh, ww, a, C);
  for (let i = 0; i < 5; i++) shard(c, x + (R() - 0.5) * s * 1.1, y + s * 0.04 + R() * s * 0.06, s * (0.1 + R() * 0.12), s * 0.04, (R() - 0.5) * 1.2, C, false); // chips at the foot
}
// a rock mass: faceted, lit top-left, its top face lighter (a ledge)
function rockMass(c, pts, top, base = P.rock, hi = P.rockHi, ink = P.rockInk) {
  fillPoly(c, pts, lg(c, pts[0], Math.min(...pts.filter((_, i) => i % 2)), pts[0] + 40, Math.max(...pts.filter((_, i) => i % 2)), [hi, base, P.rockLo]), ink, 1.3);
  if (top) fillPoly(c, top, lg(c, top[0], top[1], top[4] || top[2], top[5] || top[3], [P.rockTop, hi]), ink, 1);
}

// ------------------------------------------------------------------ the plan
// Landmarks (bottom to top): extents in design units; pref = the side of the road (see mapfarm.js LMS)
const LMS = [
  { kind: 'mouth', name: 'Cave Mouth', pref: 1, x0: -72, x1: 70, top: 140, gap: 6, dy: 2, rows: 1, tap: [-68, -134, 66, 6] },
  { kind: 'bridge', name: 'Crystal Bridge', pref: -1, x0: -86, x1: 86, top: 104, gap: 4, dy: 8, rows: 1, tap: [-82, -96, 82, 6] },
  { kind: 'camp', name: 'Miners’ Camp', pref: -1, x0: -68, x1: 66, top: 132, gap: 6, dy: -2, rows: 1, tap: [-64, -122, 62, 6] },
  { kind: 'geode', name: 'Great Geode', pref: 1, x0: -64, x1: 66, top: 130, gap: 6, dy: 4, rows: 1, tap: [-60, -124, 62, 6] },
  { kind: 'throne', name: 'Crystal Throne', pref: 1, x0: -74, x1: 80, top: 188, gap: 8, dy: 0, beside: 1, rows: 1, tap: [-70, -156, 74, 6] },
];
export const CAVE_LANDMARKS = LMS;
const BRIDGE_ARCH = [0, -6]; // where the stream passes under the Crystal Bridge (design units from the foot)

// props: kind, fx, fy, size, [half width, height] (units); nudged off the road, the landmarks, the stream crossing
const PROPS = [
  ['amethyst', 0.07, 0.34, 1.1, [46, 92]],
  ['cyan', 0.95, 0.62, 0.9, [40, 78]],
  ['rose', 0.05, 0.97, 1, [44, 84]],
  ['chime', 0.12, 0.66, 1, [16, 74]],
  ['warm', 0.1, 0.13, 1, [44, 30]],
  ['rats', 0.16, 0.82, 1, [66, 48]],
  ['crates', 0.92, 0.88, 1, [30, 40]],
  ['small', 0.55, 0.06, 0.8, [26, 40]],
  ['small2', 0.9, 0.3, 0.7, [24, 36]],
];
const roadHit = (L, x0, x1, y0, y1, m = 4) => { for (let y = y0; y <= y1 + 0.1; y += 6) { const x = L.pathX(y); if (x + L.roadW * 0.5 + m * L.u > x0 && x - L.roadW * 0.5 - m * L.u < x1) return true; } return false; };

export function cavePlan(L) {
  if (L._cave) return L._cave;
  const plan = planStops(L, WI, LMS), u = L.u, A = L.A, top = plan.top, BH = L.BH, st = (k) => L.stops[WI * 5 + k];
  if (plan.lms.length < 5) { plan.props = []; return (L._cave = plan); }
  const boxes = plan.lms.map((m) => lmArt(m)).concat(plan.lms.map((m) => { const b = m.plaque.board; return { x0: b.x - 4 * u, x1: b.x + b.w + 4 * u, y0: b.y, y1: m.plaque.y + 6 * u }; }));
  // the stream: from a waterfall in the right wall, across the road on a stone bridge, under the Crystal Bridge, into a
  // pool by the left wall (through the bridge's arch whichever side it stands on)
  const br = plan.lms[1], bx = br.x + (br.flip ? -BRIDGE_ARCH[0] : BRIDGE_ARCH[0]) * br.d, by = br.y + BRIDGE_ARCH[1] * br.d;
  const yc = lerp(st(2).y, st(1).y, 0.5), xc = L.pathX(yc), sideB = Math.sign(bx - xc) || -1;
  const src = { x: sideB < 0 ? A.x1 + 6 * u : A.x - 6 * u, y: yc - 0.07 * BH }, out = { x: sideB < 0 ? A.x - 10 * u : A.x1 + 10 * u, y: by + 0.06 * BH };
  plan.stream = { pts: [src.x, src.y, lerp(src.x, xc, 0.55), lerp(src.y, yc, 0.8) - 4 * u, xc, yc, lerp(xc, bx, 0.5), lerp(yc, by, 0.45), bx, by, lerp(bx, out.x, 0.55), lerp(by, out.y, 0.5), out.x, out.y], cross: { x: xc, y: yc }, w: 20 * u, side: -sideB, fall: src };
  boxes.push({ x0: xc - 50 * u, x1: xc + 50 * u, y0: yc - 20 * u, y1: yc + 20 * u });
  // the mine rails: from the wall on the camp's side, past the front of the camp, across the road to a buffer stop
  const cm = plan.lms[2], cs = cm.x < L.pathX(cm.y) ? -1 : 1, yr = cm.y + 18 * u, xr = L.pathX(yr);
  const xEdge = cs < 0 ? A.x - 10 * u : A.x1 + 10 * u, xEnd = xr - cs * (L.roadW * 0.5 + 46 * u);
  plan.rails = { y: yr, x0: Math.min(xEdge, xEnd), x1: Math.max(xEdge, xEnd), cross: xr, tilt: 0.04 * cs, end: xEnd, side: cs };
  const railY = (x) => yr + (x - xr) * plan.rails.tilt;
  plan.rails.at = railY;
  boxes.push({ x0: Math.min(xEnd, xr) - 10 * u, x1: Math.max(xEnd, xr) + 10 * u, y0: yr - 14 * u, y1: yr + 10 * u });
  // the boss's treasure chest stands beside the boss stop (main.js): keep it clear
  { const sb = st(4), r = L.stopR * 1.2, cr = Math.min(r * 0.95, 34 * u); let side = sb.x < A.cx ? -1 : 1, cx = sb.x + side * (r + cr * 1.25); if (cx - cr < A.x + 4 * u || cx + cr > A.x1 - 4 * u) cx = sb.x - side * (r + cr * 1.25); const cy = sb.y - r * 0.15; boxes.push({ x0: cx - cr * 1.1, x1: cx + cr * 1.1, y0: cy - cr * 1.2, y1: cy + cr * 1.2 }); }
  // the props
  const out2 = [], sign = signBox(L, WI), sign2 = signBox(L, WI + 1);
  for (const [k, fx, fy, sz, [hw0, h0]] of PROPS) {
    const hw = hw0 * u * sz, h = h0 * u * sz;
    let got = null;
    for (let r = 0; r <= 7 && !got; r++) {
      for (const [dx, dy] of r ? [[r, 0], [-r, 0], [0, -r], [0, r], [r, -r], [-r, -r], [r, r], [-r, r]] : [[0, 0]]) {
        const x = A.x + fx * A.w + dx * 10 * u, y = top + fy * BH + dy * 8 * u;
        const b = { x0: x - hw, x1: x + hw, y0: y - h, y1: y + 2 * u };
        if (b.x0 < A.x - hw * 0.6 || b.x1 > A.x1 + hw * 0.6) continue;
        if (b.y0 < top - 10 * u || b.y1 > top + BH * 0.97) continue;
        if (roadHit(L, b.x0, b.x1, b.y0, b.y1)) continue;
        if (boxes.some((q) => b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0)) continue;
        if ([sign, sign2].some((q) => b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0)) continue;
        if (k !== 'cyan' && Math.abs(y - streamYAt(plan.stream.pts, x)) < 14 * u && x > Math.min(src.x, out.x) && x < Math.max(src.x, out.x)) continue; // not in the water
        if (Math.abs(y - railY(x)) < 10 * u || (y > railY(x) && y - h < railY(x))) continue; // not on the rails
        got = { k, x, y, s: sz, box: b }; break;
      }
    }
    if (got) { out2.push(got); boxes.push(got.box); }
  }
  plan.props = out2;
  // the mole's run: along the rails on the camp's side, clear of the road and the camp's plaque (he is drawn over the camp)
  { const pb = cm.plaque.board, lim = cs < 0 ? Math.min(pb.x, xr - L.roadW * 0.5) - 34 * u : Math.max(pb.x + pb.w, xr + L.roadW * 0.5) + 34 * u, far = cs < 0 ? A.x + 30 * u : A.x1 - 30 * u;
    plan.mole = Math.abs(lim - far) > 70 * u ? { x0: lim, x1: far } : null; }
  // bats roost on stalactites at the top; glow-worm threads along the lip (off the road)
  plan.roost = [];
  for (const f of [0.28, 0.72, 0.5]) { const x = A.x + f * A.w, y = top + 26 * u; if (!roadHit(L, x - 20 * u, x + 20 * u, y - 10 * u, y + 30 * u, 8) && !boxes.some((q) => x > q.x0 - 10 * u && x < q.x1 + 10 * u && y + 30 * u > q.y0)) plan.roost.push({ x, y }); }
  plan.worms = [];
  { const R = rng(311); for (let x = A.x + 8 * u; x < A.x1 - 6 * u; x += (14 + R() * 18) * u) { const len = (16 + R() * 34) * u, y0 = top + (14 + R() * 8) * u; if (roadHit(L, x - 6 * u, x + 6 * u, y0, y0 + len, 6)) continue; if (boxes.some((q) => x > q.x0 && x < q.x1 && y0 + len > q.y0 && y0 < q.y1)) continue; plan.worms.push([x, y0, len, R()]); } }
  return (L._cave = plan);
}
function streamYAt(pts, x) { // the stream's centre y at x (its points run one way in x)
  for (let i = 0; i < pts.length - 2; i += 2) { const xa = pts[i], xb = pts[i + 2]; if ((x - xa) * (x - xb) <= 0 && xa !== xb) return lerp(pts[i + 1], pts[i + 3], (x - xa) / (xb - xa)); }
  return Infinity;
}
function spot(plan, k) { for (const p of plan.props) if (p.k === k) return p; return null; }
export function caveStop(L, i) { const p = cavePlan(L); return p.lms[i] || null; }

// ------------------------------------------------------------------ the band, painted once
export function paintCaveBand(c, L, E) {
  const u = L.u, W = L.W, BH = L.BH, top = L.bandTop(WI), plan = cavePlan(L), A = L.A;
  const R0 = rng(WI * 31 + 5), ph = R0() * TAU, ph2 = R0() * TAU;
  const crest = (x) => E * 0.5 + Math.sin((x / W) * TAU * 1.3 + ph) * E * 0.28 + Math.sin((x / W) * TAU * 3.1 + ph2) * E * 0.12;
  c.save();
  c.beginPath(); c.moveTo(0, BH + E); for (let x = 0; x <= W + 8; x += 8) c.lineTo(x, crest(x)); c.lineTo(W, BH + E); c.closePath();
  c.fillStyle = lg(c, 0, E * 0.2, 0, BH + E, [P.far, P.back, P.floor, P.floorNear]); c.fill();
  c.save(); c.clip();
  c.translate(0, E - top); // map coordinates from here on
  const Y = (f) => top + f * BH, X = (f) => A.x + f * A.w;
  try {
    farWall(c, L, top, u);
    floor(c, L, plan, top, u);
    sideWalls(c, L, plan, top, u);
    // light: cool from the upper left, the snowfield's daylight spilling in at the bottom
    c.fillStyle = rg(c, X(0.05), Y(0.08), 0, Math.max(A.w, BH) * 0.85, ['rgba(190,180,255,0.14)', 'rgba(190,180,255,0)']); c.fillRect(0, top - E, W, BH + E);
    c.fillStyle = lg(c, 0, Y(0.8), 0, Y(1), ['rgba(200,230,255,0)', 'rgba(200,230,255,0.18)']); c.fillRect(0, Y(0.8), W, BH * 0.2);
    for (const m of plan.lms) groundFor(c, m);
    if (plan.stream) stream(c, L, plan, u);
    if (plan.rails) rails(c, L, plan, u);
    bridgeOnRoad(c, L, plan, u);
    pebbles(c, L, plan, u);
    const list = plan.props.slice().sort((a, b) => a.y - b.y);
    for (const p of list) { try { prop(c, p, u); } catch (_) { /* a prop never breaks the map */ } }
    lip(c, L, plan, top, u, crest, E);
  } catch (_) { /* the band never breaks the map */ }
  c.restore();
  // the crest: the rock lip's lit top edge
  c.beginPath(); for (let x = 0; x <= W + 8; x += 8) { const y = crest(x); if (x === 0) c.moveTo(x, y); else c.lineTo(x, y); }
  c.strokeStyle = 'rgba(200,180,255,0.4)'; c.lineWidth = 2.4 * u; c.stroke();
  c.restore();
}

// the far wall under the lip: strata in dim blue-violet, receding
function farWall(c, L, top, u) {
  const W = L.W, R = rng(41);
  for (let k = 0; k < 4; k++) {
    const y0 = top + (6 + k * 16) * u, col = mix(P.far, P.back, k / 4);
    c.beginPath(); c.moveTo(-10, y0 + 30 * u); for (let x = -10; x <= W + 20; x += 18 * u) c.lineTo(x, y0 + Math.sin(x * 0.03 + k * 1.7) * 5 * u + R() * 4 * u); c.lineTo(W + 20, y0 + 60 * u); c.lineTo(-10, y0 + 60 * u); c.closePath();
    c.fillStyle = col; c.fill();
    c.strokeStyle = 'rgba(150,140,230,0.16)'; c.lineWidth = 1.2 * u; c.stroke();
  }
  c.fillStyle = lg(c, 0, top, 0, top + 90 * u, ['rgba(16,12,44,0.35)', 'rgba(16,12,44,0)']); c.fillRect(0, top - 10 * u, W, 100 * u);
}
// the floor: broad slabs with lit rims and dark cracks, crystal veins that glow, dust
function floor(c, L, plan, top, u) {
  const A = L.A, BH = L.BH, R = rng(77);
  const slabs = [[0.18, 0.22, 0.32, 0.12], [0.82, 0.16, 0.3, 0.1], [0.5, 0.42, 0.4, 0.11], [0.15, 0.55, 0.3, 0.12], [0.85, 0.5, 0.28, 0.1], [0.3, 0.76, 0.42, 0.12], [0.82, 0.8, 0.34, 0.12], [0.55, 0.94, 0.5, 0.08], [0.05, 0.86, 0.2, 0.08]];
  slabs.forEach(([fx, fy, rx, ry], i) => {
    const x = A.x + fx * A.w, y = top + fy * BH, pts = wobble(x, y, rx * A.w, ry * BH, 9, 0.16, 90 + i), near = fy;
    c.save(); c.translate(0, 5 * u); blobPath(c, pts); c.fillStyle = 'rgba(12,8,34,0.35)'; c.fill(); c.restore();
    blobPath(c, pts); c.fillStyle = lg(c, x - rx * A.w, y - ry * BH, x + rx * A.w * 0.4, y + ry * BH, [mix(P.floorHi, P.floor, 0.4 + 0.3 * (1 - near)), mix(P.floor, P.floorNear, near), P.floorLo]); c.fill();
    c.save(); blobPath(c, pts); c.clip(); c.strokeStyle = 'rgba(200,190,255,0.16)'; c.lineWidth = 2 * u; c.translate(1.5 * u, 2 * u); blobPath(c, pts); c.stroke(); c.restore();
    // cracks
    c.strokeStyle = 'rgba(16,10,40,0.45)'; c.lineWidth = 1.1 * u;
    for (let k = 0; k < 2; k++) { let px = x + (R() - 0.5) * rx * A.w, py = y + (R() - 0.5) * ry * BH; c.beginPath(); c.moveTo(px, py); for (let q = 0; q < 4; q++) { px += (R() - 0.3) * 18 * u; py += (R() - 0.5) * 8 * u; c.lineTo(px, py); } c.stroke(); }
  });
  // crystal veins: a soft glow, then a bright core, branching
  const veins = [[0.02, 0.3, AM], [0.98, 0.45, CY], [0.0, 0.72, RO], [0.98, 0.9, AM], [0.4, 0.02, CY]];
  for (const [fx, fy, C] of veins) {
    let x = A.x + fx * A.w, y = top + fy * BH; const dir = fx < 0.5 ? 1 : -1, pts = [x, y];
    for (let q = 0; q < 6; q++) { x += dir * (14 + R() * 18) * u; y += (R() - 0.5) * 22 * u + (fy < 0.1 ? 10 * u : 0); pts.push(x, y); }
    for (const [lw, col] of [[7, rgba(C.glow, 0.12)], [3.4, rgba(C.glow, 0.3)], [1.3, rgba(C.hi, 0.9)]]) { c.strokeStyle = col; c.lineWidth = lw * u; c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.stroke(); }
    for (let i = 4; i < pts.length; i += 4) { c.strokeStyle = rgba(C.hi, 0.7); c.lineWidth = 0.9 * u; c.beginPath(); c.moveTo(pts[i], pts[i + 1]); c.lineTo(pts[i] + dir * 10 * u, pts[i + 1] + (R() - 0.5) * 14 * u); c.stroke(); }
  }
}
// rock walls along both edges: ledges stacked up the band, each a front face with a lit top, far ones bluer
function sideWalls(c, L, plan, top, u) {
  const A = L.A, BH = L.BH, R = rng(19), boxes = plan.lms.map((m) => lmArt(m));
  const busy = (x0, x1, y0, y1) => roadHit(L, x0, x1, y0, y1, 8) || boxes.some((q) => x0 < q.x1 - 10 * u && x1 > q.x0 + 10 * u && y0 < q.y1 - 6 * u && y1 > q.y0 + 20 * u);
  for (const side of [-1, 1]) {
    for (let y = top + 30 * u; y < top + BH * 0.97; y += (34 + R() * 26) * u) {
      const near = (y - top) / BH, depth = (26 + R() * 30) * u * (0.7 + near * 0.6), h = (16 + R() * 14) * u * (0.8 + near * 0.5), lift = (8 + R() * 6) * u;
      const xe = side < 0 ? A.x - 12 * u : A.x1 + 12 * u, xi = xe - side * depth;
      if (busy(Math.min(xe, xi), Math.max(xe, xi), y - h - lift, y)) continue;
      const far = 1 - near, base = mix(P.rock, '#2c3a78', far * 0.45), hi = mix(P.rockHi, '#4a5aa0', far * 0.4);
      softShadow(c, xi + side * -4 * u, y + 2 * u, depth * 0.5, 5 * u, 0.4);
      const front = [xe, y, xi, y + (R() - 0.5) * 4 * u, xi - side * 3 * u, y - h, xe, y - h - 4 * u];
      const topf = [xe, y - h - 4 * u, xi - side * 3 * u, y - h, xi + side * 6 * u, y - h - lift, xe, y - h - lift - 6 * u];
      rockMass(c, front, topf, base, hi);
      c.strokeStyle = 'rgba(10,6,30,0.35)'; c.lineWidth = 1 * u; c.beginPath(); c.moveTo(lerp(xe, xi, 0.5), y - 2 * u); c.lineTo(lerp(xe, xi, 0.45), y - h * 0.7); c.stroke();
      if (R() < 0.4) shard(c, lerp(xi, xe, 0.4), y - h - lift * 0.4, (10 + R() * 10) * u, 3 * u, side * -0.3, [AM, CY, RO][Math.floor(R() * 3)]);
    }
  }
}
function groundFor(c, m) {
  const d = m.d, x = m.x, y = m.y, f = m.flip ? -1 : 1, S = m.S;
  const cx = x + ((S.x0 + S.x1) / 2) * d * f, rx = (S.x1 - S.x0) * d * 0.5;
  softShadow(c, cx + 10 * d, y + 2 * d, rx * 1.05, 14 * d, 0.5); // the landmarks stand on dark contact shadow, thrown a touch right
  if (m.kind === 'mouth') { // the daylight from the opening lies on the floor in front of it
    c.fillStyle = 'rgba(210,235,255,0.16)'; poly(c, [x - 22 * d * f, y, x + 22 * d * f, y, x + 50 * d * f, y + 34 * d, x - 46 * d * f, y + 34 * d]); c.fill();
    blobPath(c, wobble(x, y + 4 * d, 40 * d, 9 * d, 9, 0.2, 61)); c.fillStyle = 'rgba(244,251,255,0.7)'; c.fill(); // snow blown in
  } else if (m.kind === 'geode') { c.save(); c.translate(cx, y); c.scale(1, 0.3); glowAt(c, 0, 0, rx * 1.2, AM.glow, 0.35); c.restore(); }
  else if (m.kind === 'throne') { c.save(); c.translate(cx, y); c.scale(1, 0.3); glowAt(c, 0, 0, rx * 1.3, '#c070ff', 0.4); c.restore(); }
  else if (m.kind === 'camp') { blobPath(c, wobble(cx, y + 2 * d, 70 * d, 14 * d, 10, 0.2, 63)); c.fillStyle = 'rgba(120,90,60,0.35)'; c.fill(); }
}
// the underground stream: a dark bank, the water deep to shallow, glowing light on it; foam at the fall
function streamPath(c, pts) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length - 2; i += 2) c.quadraticCurveTo(pts[i], pts[i + 1], (pts[i] + pts[i + 2]) / 2, (pts[i + 1] + pts[i + 3]) / 2); c.lineTo(pts[pts.length - 2], pts[pts.length - 1]); }
function stream(c, L, plan, u) {
  const S = plan.stream, w = S.w;
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  c.translate(0, 4 * u); streamPath(c, S.pts); c.strokeStyle = 'rgba(10,6,30,0.5)'; c.lineWidth = w + 12 * u; c.stroke(); c.translate(0, -4 * u);
  streamPath(c, S.pts); c.strokeStyle = P.stoneLo; c.lineWidth = w + 9 * u; c.stroke();
  streamPath(c, S.pts); c.strokeStyle = '#7c7aa2'; c.lineWidth = w + 5 * u; c.stroke(); // the lit stone lip of the channel
  streamPath(c, S.pts); c.strokeStyle = P.waterLo; c.lineWidth = w; c.stroke();
  streamPath(c, S.pts); c.strokeStyle = P.water; c.lineWidth = w * 0.7; c.stroke();
  c.translate(-1.5 * u, -2 * u); streamPath(c, S.pts); c.strokeStyle = rgba(P.waterHi, 0.45); c.lineWidth = w * 0.24; c.stroke(); c.translate(1.5 * u, 2 * u);
  c.restore();
  // glowing light under the water (crystals on the bed)
  const R = rng(5);
  for (let i = 0; i < 14; i++) { const f = R(), k = Math.floor(f * (S.pts.length / 2 - 1)), a = (f * (S.pts.length / 2 - 1)) - k, x = lerp(S.pts[2 * k], S.pts[2 * k + 2], a), y = lerp(S.pts[2 * k + 1], S.pts[2 * k + 3], a); ell(c, x + (R() - 0.5) * w * 0.4, y + (R() - 0.5) * w * 0.3, 2 * u, 1.2 * u, rgba(P.waterGlow, 0.7)); }
  // the waterfall out of the wall: a rock spout, a sheet of water, a foam pool
  const F = S.fall, sd = F.x > L.cx ? -1 : 1, fx = F.x + sd * 4 * u, fy = F.y;
  rockMass(c, [fx - sd * 6 * u, fy + 4 * u, fx + sd * 26 * u, fy - 2 * u, fx + sd * 30 * u, fy - 30 * u, fx - sd * 6 * u, fy - 40 * u], [fx - sd * 6 * u, fy - 40 * u, fx + sd * 30 * u, fy - 30 * u, fx + sd * 36 * u, fy - 38 * u, fx - sd * 6 * u, fy - 50 * u]);
  fillPoly(c, [fx + sd * 8 * u, fy - 26 * u, fx + sd * 22 * u, fy - 24 * u, fx + sd * 26 * u, fy + 2 * u, fx + sd * 6 * u, fy + 4 * u], lg(c, 0, fy - 26 * u, 0, fy + 4 * u, ['#9ae6ff', '#3c9ac8']));
  for (let k = 0; k < 5; k++) { ell(c, fx + sd * (8 + k * 4) * u, fy + (3 + (k % 2) * 2) * u, (4 + (k % 3)) * u, 2.2 * u, 'rgba(235,250,255,0.85)'); }
}
// where the road crosses the stream: a stone bridge, its parapets either side of the road, the arch's shade on the water
function bridgeOnRoad(c, L, plan, u) {
  const S = plan.stream; if (!S) return;
  const yc = S.cross.y, rw = L.roadW, half = S.w * 0.5 + 8 * u;
  for (const side of [-1, 1]) {
    const pts = []; for (let y = yc - half; y <= yc + half + 0.1; y += 3) { const x = L.pathX(y) + side * (rw * 0.5 + 4 * u); pts.push(x, y); }
    // the arch's shade on the water, then the parapet wall: a dark side, a lit top, mortar joints
    const x0 = pts[0], y0 = pts[1], x1 = pts[pts.length - 2], y1 = pts[pts.length - 1];
    ell(c, (x0 + x1) / 2 + side * 6 * u, (y0 + y1) / 2 + 3 * u, 10 * u, S.w * 0.5, 'rgba(8,10,40,0.45)');
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(pts[0], pts[1] + 4 * u); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1] + 4 * u); c.strokeStyle = P.stoneInk; c.lineWidth = 8.5 * u; c.stroke();
    c.beginPath(); c.moveTo(pts[0], pts[1] + 3 * u); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1] + 3 * u); c.strokeStyle = P.stoneLo; c.lineWidth = 7 * u; c.stroke();
    c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.strokeStyle = P.stone; c.lineWidth = 6 * u; c.stroke();
    c.strokeStyle = P.stoneHi; c.lineWidth = 2 * u; c.beginPath(); c.moveTo(pts[0] - 1 * u, pts[1] - 1 * u); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i] - 1 * u, pts[i + 1] - 1 * u); c.stroke();
    c.strokeStyle = 'rgba(40,36,70,0.6)'; c.lineWidth = 0.9 * u; for (let i = 4; i < pts.length - 2; i += 4) { c.beginPath(); c.moveTo(pts[i] - 3 * u, pts[i + 1]); c.lineTo(pts[i] + 3 * u, pts[i + 1]); c.stroke(); }
    for (const [px, py] of [[x0, y0], [x1, y1]]) { fillPoly(c, [px - 4.5 * u, py + 5 * u, px + 4.5 * u, py + 5 * u, px + 4.5 * u, py - 5 * u, px - 4.5 * u, py - 5 * u], lg(c, px - 4 * u, 0, px + 4 * u, 0, [P.stoneHi, P.stoneLo]), P.stoneInk, 1 * u); fillPoly(c, [px - 5.5 * u, py - 5 * u, px + 5.5 * u, py - 5 * u, px + 4 * u, py - 8 * u, px - 4 * u, py - 8 * u], P.stoneHi, P.stoneInk, 0.8 * u); }
  }
}
// the mine rails: sleepers, two iron rails with a lit top, chocks at the end; a timbered tunnel in the right wall
function rails(c, L, plan, u) {
  const Rl = plan.rails, at = Rl.at, g = 6 * u;
  const boxes = plan.lms.map((m) => lmArt(m));
  const hid = (x) => boxes.some((q) => x > q.x0 + 8 * u && x < q.x1 - 8 * u && at(x) > q.y0 + 20 * u && at(x) < q.y1);
  for (let x = Rl.x0; x <= Rl.x1; x += 9 * u) { if (hid(x)) continue; const y = at(x); fillPoly(c, [x - 2.4 * u, y - g - 3 * u, x + 2.4 * u, y - g - 3 * u, x + 3 * u, y + g + 3 * u, x - 3 * u, y + g + 3 * u], P.woodLo, P.woodInk, 0.8 * u); c.fillStyle = 'rgba(255,220,170,0.25)'; c.fillRect(x - 2.2 * u, y - g - 3 * u, 1.4 * u, 2 * g + 5 * u); }
  for (const o of [-g, g]) {
    c.beginPath(); c.moveTo(Rl.x0, at(Rl.x0) + o + 1.5 * u); c.lineTo(Rl.x1, at(Rl.x1) + o + 1.5 * u); c.strokeStyle = 'rgba(8,6,20,0.55)'; c.lineWidth = 2.6 * u; c.stroke();
    c.beginPath(); c.moveTo(Rl.x0, at(Rl.x0) + o); c.lineTo(Rl.x1, at(Rl.x1) + o); c.strokeStyle = P.ironLo; c.lineWidth = 2.4 * u; c.stroke();
    c.beginPath(); c.moveTo(Rl.x0, at(Rl.x0) + o - 0.8 * u); c.lineTo(Rl.x1, at(Rl.x1) + o - 0.8 * u); c.strokeStyle = '#c4c8dc'; c.lineWidth = 0.9 * u; c.stroke();
  }
  // the buffer stop past the road: two timbers and a crossbeam; at the wall end, a timbered tunnel mouth
  const bx = Rl.end, byy = at(bx), sd = Rl.side;
  for (const o of [-g, g]) fillPoly(c, [bx - 2 * u, byy + o + 2 * u, bx + 2 * u, byy + o + 2 * u, bx + 2 * u, byy + o - 10 * u, bx - 2 * u, byy + o - 10 * u], lg(c, bx - 2 * u, 0, bx + 2 * u, 0, [P.woodHi, P.woodLo]), P.woodInk, 0.8 * u);
  fillPoly(c, [bx - 3 * u, byy - g - 12 * u, bx + 3 * u, byy - g - 13 * u, bx + 3 * u, byy + g - 6 * u, bx - 3 * u, byy + g - 5 * u], lg(c, bx - 3 * u, 0, bx + 3 * u, 0, ['#d84a3a', '#8a2a20']), P.woodInk, 0.8 * u);
  const tx = sd < 0 ? L.A.x + 2 * u : L.A.x1 - 2 * u, ty = at(tx), k = -sd;
  fillPoly(c, [tx - k * 8 * u, ty + 12 * u, tx + k * 26 * u, ty + 10 * u, tx + k * 28 * u, ty - 34 * u, tx - k * 8 * u, ty - 40 * u], lg(c, tx, 0, tx + k * 28 * u, 0, [P.rock, P.rockHi]), P.rockInk, 1 * u);
  fillPoly(c, [tx + k * 2 * u, ty + 10 * u, tx + k * 20 * u, ty + 9 * u, tx + k * 20 * u, ty - 22 * u, tx + k * 2 * u, ty - 24 * u], '#0c0820');
  for (const px of [22, 1]) fillPoly(c, [tx + k * (px - 2) * u, ty + 10 * u, tx + k * (px + 2) * u, ty + 10 * u, tx + k * (px + 2) * u, ty - 26 * u, tx + k * (px - 2) * u, ty - 26 * u], lg(c, tx + k * (px - 2) * u, 0, tx + k * (px + 2) * u, 0, [P.woodHi, P.woodLo]), P.woodInk, 0.8 * u);
  fillPoly(c, [tx + k * 26 * u, ty - 24 * u, tx - k * 4 * u, ty - 27 * u, tx - k * 4 * u, ty - 32 * u, tx + k * 26 * u, ty - 29 * u], lg(c, 0, ty - 32 * u, 0, ty - 24 * u, [P.woodHi, P.woodLo]), P.woodInk, 0.8 * u);
}
// loose pebbles and crystal chips over the floor, kept off the road
function pebbles(c, L, plan, u) {
  const A = L.A, top = plan.top, BH = L.BH, R = rng(23);
  for (let i = 0; i < 70; i++) {
    const x = A.x + R() * A.w, y = top + 40 * u + R() * (BH - 60 * u), r = (1.4 + R() * 2.6) * u;
    if (roadHit(L, x - r, x + r, y - r, y + r, 3)) continue;
    if (R() < 0.75) { ell(c, x + 0.8 * u, y + 0.8 * u, r * 1.1, r * 0.6, 'rgba(8,6,24,0.4)'); ell(c, x, y, r, r * 0.62, mix(P.floorHi, P.stoneLo, 0.5)); ell(c, x - r * 0.3, y - r * 0.25, r * 0.4, r * 0.22, 'rgba(210,200,255,0.5)'); }
    else shard(c, x, y, r * 3, r * 0.7, (R() - 0.5) * 1, [AM, CY, RO][i % 3], false);
  }
}
// the rock lip along the top: a thick band of rock under the crest, stalactites hanging from it (off the road)
function lip(c, L, plan, top, u, crest, E) {
  const W = L.W, R = rng(29), y = (x) => top - E + crest(x);
  c.beginPath(); c.moveTo(-10, y(-10)); for (let x = -10; x <= W + 10; x += 8) c.lineTo(x, y(x)); for (let x = W + 10; x >= -10; x -= 10) c.lineTo(x, y(x) + (16 + Math.sin(x * 0.11) * 5 + Math.sin(x * 0.037) * 6) * u); c.closePath();
  c.fillStyle = lg(c, 0, top - E, 0, top + 30 * u, [P.rockHi, P.rock, P.rockLo]); c.fill(); c.strokeStyle = P.rockInk; c.lineWidth = 1.2 * u; c.stroke();
  for (let x = 4 * u; x < W; x += (9 + R() * 16) * u) {
    const y0 = y(x) + (12 + Math.sin(x * 0.11) * 5 + Math.sin(x * 0.037) * 6) * u, h = (8 + R() * 26) * u * (R() < 0.2 ? 1.6 : 1), w = (3 + R() * 4) * u;
    if (roadHit(L, x - w, x + w, y0, y0 + h, 4)) continue;
    fillPoly(c, [x - w, y0 - 2 * u, x + w, y0 - 2 * u, x + w * 0.2, y0 + h, x - w * 0.15, y0 + h], lg(c, x - w, 0, x + w, 0, [P.rockHi, P.rock, P.rockLo]), P.rockInk, 0.8 * u);
    c.strokeStyle = 'rgba(210,200,255,0.4)'; c.lineWidth = 0.8 * u; c.beginPath(); c.moveTo(x - w * 0.6, y0); c.lineTo(x - w * 0.1, y0 + h * 0.85); c.stroke();
  }
  // glow-worm threads (the lights pulse live)
  for (const [x, y0, len] of plan.worms) { c.strokeStyle = 'rgba(200,240,255,0.35)'; c.lineWidth = 0.7 * u; c.beginPath(); c.moveTo(x, y0); c.lineTo(x + 1 * u, y0 + len); c.stroke(); for (let k = 0; k < 4; k++) ell(c, x + (k / 4) * 1 * u, y0 + len * (0.3 + k * 0.2), 0.9 * u, 1.2 * u, 'rgba(160,240,230,0.55)'); }
}

// ------------------------------------------------------------------ props (painted into the band)
function prop(c, p, u) {
  const s = p.s * u;
  c.save(); c.translate(p.x, p.y); c.scale(s, s);
  switch (p.k) {
    case 'amethyst': cluster(c, 0, 0, 82, AM, 7, 7); break;
    case 'cyan': cluster(c, 0, 0, 70, CY, 11, 6); break;
    case 'rose': cluster(c, 0, 0, 74, RO, 13, 6); break;
    case 'small': cluster(c, 0, 0, 34, CY, 17, 4); break;
    case 'small2': cluster(c, 0, 0, 32, RO, 19, 4); break;
    case 'chime': chimeStone(c); break;
    case 'warm': warmRock(c); break;
    case 'rats': softShadow(c, 0, 2, 44, 6, 0.4); break;
    case 'crates': crates(c); break;
    default: break;
  }
  c.restore();
}
export const CHIME_TIP = [0, -70];
function chimeStone(c) { // a tall lone crystal on a carved stone foot (it chimes: live)
  glowAt(c, 0, -40, 46, CY.glow, 0.3);
  softShadow(c, 6, 0, 20, 5, 0.5);
  fillPoly(c, [-14, 0, 14, 0, 11, -10, -11, -10], lg(c, -14, 0, 14, 0, [P.stoneHi, P.stone, P.stoneLo]), P.stoneInk, 1);
  fillPoly(c, [-11, -10, 11, -10, 8, -13, -8, -13], P.stoneHi, P.stoneInk, 0.8);
  shard(c, 0, -12, 60, 7.5, 0.02, CY);
  shard(c, -7, -12, 22, 3.4, -0.4, CY); shard(c, 6, -12, 16, 3, 0.45, CY);
}
function warmRock(c) { // a flat rock warmed from below: glowing cracks (the salamander basks on it: live)
  c.save(); c.scale(1, 0.4); glowAt(c, 0, -8, 56, '#ff8a3a', 0.35); c.restore();
  softShadow(c, 6, 2, 46, 8, 0.5);
  fillPoly(c, [-42, 0, -38, -14, -14, -22, 20, -22, 40, -12, 44, 0, 20, 6, -20, 6], lg(c, -40, -22, 40, 6, ['#7a5a6a', '#5a3e52', '#3a2438']), '#1e1020', 1.2);
  fillPoly(c, [-38, -14, -14, -22, 20, -22, 40, -12, 18, -8, -16, -8], lg(c, -30, -22, 30, -8, ['#a47e86', '#7a5a6a']), '#1e1020', 0.8);
  c.strokeStyle = 'rgba(255,140,60,0.9)'; c.lineWidth = 1.4; for (const p of [[-20, -12, -6, -16, 8, -12], [10, -18, 22, -14, 30, -16], [-30, -4, -18, -6]]) { c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.stroke(); }
  c.strokeStyle = 'rgba(255,220,150,0.9)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(-20, -12); c.lineTo(-6, -16); c.stroke();
}
function crates(c) { // a stack of miners' crates and a coil of rope
  softShadow(c, 6, 0, 30, 6, 0.5);
  const box = (x, y, w, h) => { fillPoly(c, [x, y, x + w, y, x + w, y - h, x, y - h], lg(c, x, y - h, x + w, y, [P.woodHi, P.wood, P.woodLo]), P.woodInk, 1); fillPoly(c, [x + w, y, x + w + 6, y - 5, x + w + 6, y - h - 5, x + w, y - h], P.woodLo, P.woodInk, 0.8); fillPoly(c, [x, y - h, x + w, y - h, x + w + 6, y - h - 5, x + 6, y - h - 5], P.woodHi, P.woodInk, 0.8); c.strokeStyle = P.woodInk; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x + 2, y - 2); c.lineTo(x + w - 2, y - h + 2); c.stroke(); };
  box(-24, 0, 22, 18); box(0, 0, 20, 16); box(-14, -18, 20, 16);
  ell(c, 26, -3, 7, 3, '#8a6a3a'); c.strokeStyle = '#c8a060'; c.lineWidth = 1; c.beginPath(); c.ellipse(26, -4, 6, 2.4, 0, 0, TAU); c.ellipse(26, -4, 3.6, 1.4, 0, 0, TAU); c.stroke();
}

// ------------------------------------------------------------------ landmark sprites (design units, foot at 0,0)
// The Cave Mouth: a rock arch with the snowfield's daylight behind it, icicles on the lintel, a lantern on a post
export const MOUTH_LAMP = [56, -50];
function paintMouth(c) {
  // the bright outside, seen through the opening
  c.save(); c.beginPath(); c.moveTo(-30, 0); c.lineTo(-31, -60); c.quadraticCurveTo(-28, -98, 0, -100); c.quadraticCurveTo(28, -98, 30, -60); c.lineTo(28, 0); c.closePath(); c.clip();
  c.fillStyle = lg(c, 0, -100, 0, 0, ['#bfe2ff', '#e8f6ff', '#ffffff']); c.fillRect(-40, -110, 80, 112);
  c.beginPath(); c.moveTo(-40, -30); c.quadraticCurveTo(-14, -50, 10, -36); c.quadraticCurveTo(26, -46, 40, -38); c.lineTo(40, 2); c.lineTo(-40, 2); c.closePath(); c.fillStyle = '#d6ecfa'; c.fill();
  c.beginPath(); c.moveTo(-40, -14); c.quadraticCurveTo(0, -26, 40, -16); c.lineTo(40, 2); c.lineTo(-40, 2); c.closePath(); c.fillStyle = '#f4fbff'; c.fill();
  for (const [x, y, s] of [[-16, -32, 14], [-4, -38, 10], [18, -34, 12]]) { fillPoly(c, [x - s * 0.4, y, x, y - s, x + s * 0.4, y], '#3e7a7a'); fillPoly(c, [x - s * 0.24, y - s * 0.45, x, y - s, x + s * 0.2, y - s * 0.5], '#f4fbff'); }
  c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.arc(-18, -78, 3, 0, TAU); c.arc(12, -86, 2, 0, TAU); c.fill();
  c.restore();
  // the rock around it: three masses with lit faces, the reveal inside the arch (its depth) on the right
  rockMass(c, [-72, 0, -70, -54, -58, -98, -30, -126, -4, -132, -6, -100, -28, -98, -31, -60, -30, 0], [-58, -98, -30, -126, -4, -132, -14, -120, -40, -112], mix(P.rock, P.rockHi, 0.35), P.rockTop);
  rockMass(c, [-6, -100, -4, -132, 26, -140, 50, -122, 64, -92, 70, -48, 68, 0, 28, 0, 30, -60, 28, -98], [-4, -132, 26, -140, 50, -122, 36, -116, 12, -124], mix(P.rock, P.rockLo, 0.3), P.rockHi);
  // courses of rock round the arch, inside the two masses: a dark joint with a lit edge above it
  c.save(); c.beginPath();
  poly(c, [-72, 0, -70, -54, -58, -98, -30, -126, -4, -132, -6, -100, -28, -98, -31, -60, -30, 0]); c.clip();
  for (const [y0, y1, x0, x1] of [[-18, -20, -72, -34], [-46, -50, -70, -34], [-74, -80, -66, -36], [-100, -108, -58, -36]]) { c.strokeStyle = 'rgba(16,10,36,0.45)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.strokeStyle = 'rgba(210,200,255,0.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, y0 - 2); c.lineTo(x1, y1 - 2); c.stroke(); }
  c.restore();
  c.save(); poly(c, [-6, -100, -4, -132, 26, -140, 50, -122, 64, -92, 70, -48, 68, 0, 28, 0, 30, -60, 28, -98]); c.clip();
  for (const [y0, y1, x0, x1] of [[-20, -24, 70, 30], [-52, -58, 68, 30], [-86, -96, 62, 24], [-116, -126, 44, 10]]) { c.strokeStyle = 'rgba(16,10,36,0.45)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.strokeStyle = 'rgba(190,180,240,0.25)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, y0 - 2); c.lineTo(x1, y1 - 2); c.stroke(); }
  c.restore();
  fillPoly(c, [28, 0, 30, -60, 28, -98, 18, -94, 20, -58, 20, 0], mix(P.rockLo, '#121032', 0.4)); // the inner wall in shade
  // daylight on the rim: a soft halo outside the arch, then a bright line on the edge itself
  c.save(); c.beginPath(); c.moveTo(-30, 2); c.lineTo(-31, -60); c.quadraticCurveTo(-28, -98, 0, -100); c.quadraticCurveTo(28, -98, 30, -60); c.lineTo(28, 2); c.closePath(); c.clip('evenodd');
  c.strokeStyle = 'rgba(200,232,255,0.45)'; c.lineWidth = 9; c.beginPath(); c.moveTo(-30, 2); c.lineTo(-31, -60); c.quadraticCurveTo(-28, -98, 0, -100); c.quadraticCurveTo(28, -98, 30, -60); c.lineTo(28, 2); c.stroke();
  c.restore();
  c.strokeStyle = 'rgba(240,250,255,0.95)'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(-30, -4); c.lineTo(-31, -60); c.quadraticCurveTo(-28, -98, 0, -100); c.stroke();
  c.strokeStyle = 'rgba(20,14,50,0.5)'; c.lineWidth = 1.2; for (const p of [[-60, -40, -46, -70, -50, -90], [44, -30, 52, -60, 46, -96], [-20, -112, -8, -120]]) { c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.stroke(); }
  // snow on the top, icicles on the lintel
  c.beginPath(); c.moveTo(-58, -98); c.quadraticCurveTo(-44, -118, -30, -126); c.quadraticCurveTo(-12, -136, 26, -140); c.quadraticCurveTo(42, -132, 50, -122); c.quadraticCurveTo(36, -124, 22, -128); c.quadraticCurveTo(0, -126, -24, -118); c.quadraticCurveTo(-42, -108, -58, -98); c.fillStyle = P.snow; c.fill(); c.strokeStyle = P.snowLo; c.lineWidth = 0.8; c.stroke();
  for (let k = 0; k < 8; k++) { const x = -24 + k * 6.6, y = -98 + Math.abs(x) * 0.02 - (Math.abs(x) > 18 ? 6 : 0), h = 6 + ((k * 5) % 7); fillPoly(c, [x - 1.8, y, x + 1.8, y, x + 0.2, y + h], 'rgba(220,244,255,0.95)', 'rgba(120,170,210,0.8)', 0.5); }
  // a drift at the threshold, a few stones
  c.beginPath(); c.moveTo(-34, 2); c.quadraticCurveTo(-20, -10, 0, -6); c.quadraticCurveTo(20, -12, 34, 2); c.closePath(); c.fillStyle = P.snow; c.fill(); c.strokeStyle = P.snowLo; c.lineWidth = 0.8; c.stroke();
  for (const [x, y, r] of [[-60, 2, 6], [-46, 6, 4], [40, 6, 5]]) { ell(c, x + 1, y + 1.5, r, r * 0.55, 'rgba(8,6,24,0.4)'); ell(c, x, y, r, r * 0.62, P.rockHi); ell(c, x - r * 0.3, y - r * 0.3, r * 0.45, r * 0.25, P.rockTop); }
  // the lantern post
  const [lx, ly] = MOUTH_LAMP;
  ell(c, lx + 3, 4, 7, 2, 'rgba(8,6,24,0.45)');
  fillPoly(c, [lx - 2, 4, lx + 2, 4, lx + 2, ly - 4, lx - 2, ly - 4], lg(c, lx - 2, 0, lx + 2, 0, [P.woodHi, P.woodLo]), P.woodInk, 0.8);
  c.strokeStyle = P.woodInk; c.lineWidth = 2; c.beginPath(); c.moveTo(lx, ly - 2); c.lineTo(lx - 10, ly - 2); c.stroke();
  lantern(c, lx - 10, ly + 2, 1);
}
function lantern(c, x, y, s) { // hangs from (x, y - 6s): an iron cage, warm glass
  c.strokeStyle = P.ironInk; c.lineWidth = 0.9 * s; c.beginPath(); c.moveTo(x, y - 4 * s); c.lineTo(x, y); c.stroke();
  fillPoly(c, [x - 4 * s, y, x + 4 * s, y, x + 3 * s, y - 2 * s, x - 3 * s, y - 2 * s], P.iron, P.ironInk, 0.7 * s);
  fillPoly(c, [x - 3.6 * s, y, x + 3.6 * s, y, x + 3.6 * s, y + 9 * s, x - 3.6 * s, y + 9 * s], lg(c, 0, y, 0, y + 9 * s, [P.lampHot, P.lamp]), P.ironInk, 0.8 * s);
  c.strokeStyle = P.ironInk; c.lineWidth = 0.7 * s; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 9 * s); c.stroke();
  fillPoly(c, [x - 4.4 * s, y + 9 * s, x + 4.4 * s, y + 9 * s, x + 3.4 * s, y + 11 * s, x - 3.4 * s, y + 11 * s], P.iron, P.ironInk, 0.7 * s);
}
// The Crystal Bridge: a humped stone bridge over the stream, crystal pillars at its ends, crystals along the parapet
function paintBridge(c) {
  // the water under the arch (the stream in the ground runs through here)
  c.save(); c.beginPath(); c.moveTo(-42, 2); c.lineTo(-40, -16); c.quadraticCurveTo(0, -52, 40, -16); c.lineTo(42, 2); c.closePath(); c.clip();
  c.fillStyle = lg(c, 0, -46, 0, 2, ['#0c0a2a', '#141a44', P.waterLo]); c.fillRect(-46, -56, 92, 60);
  c.fillStyle = P.water; c.beginPath(); c.ellipse(0, 0, 44, 8, 0, Math.PI, TAU); c.fill();
  c.strokeStyle = rgba(P.waterGlow, 0.7); c.lineWidth = 1; for (const [a, b, y] of [[-30, -10, -3], [4, 26, -2], [-14, 8, -6]]) { c.beginPath(); c.moveTo(a, y); c.lineTo(b, y); c.stroke(); }
  c.restore();
  // the deck seen from the front: a humped span with a top face going back
  const D = [8, -8];
  const front = [-86, 2, -86, -22, -60, -40, -30, -50, 0, -54, 30, -50, 60, -40, 86, -22, 86, 2, 42, 2, 40, -16, 26, -30, 0, -36, -26, -30, -40, -16, -42, 2];
  fillPoly(c, front, lg(c, -86, -54, 60, 2, [P.stoneHi, P.stone, P.stoneLo]), P.stoneInk, 1.3);
  c.save(); poly(c, front); c.clip();
  // courses of stone: mortar lines following the hump, staggered joints
  c.strokeStyle = 'rgba(40,36,72,0.45)'; c.lineWidth = 0.9;
  for (let r = 0; r < 4; r++) { const yo = -16 - r * 9; c.beginPath(); c.moveTo(-90, yo + 20 + r * 2); c.quadraticCurveTo(0, yo - 22, 90, yo + 20 + r * 2); c.stroke(); for (let k = -6; k <= 6; k++) { const x = k * 13 + (r % 2) * 6.5, y = yo + 20 + r * 2 - (1 - (x / 90) ** 2) * 21; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 9); c.stroke(); } }
  c.fillStyle = 'rgba(255,255,255,0.1)'; c.fillRect(-90, -60, 70, 80);
  c.restore();
  // the voussoirs round the arch
  for (let k = 0; k <= 8; k++) { const a = Math.PI + (k / 8) * Math.PI, x0 = Math.cos(a) * 41, y0 = -16 + Math.sin(a) * 30 * (k > 0 && k < 8 ? 1 : 0.5), x1 = Math.cos(a) * 50, y1 = -16 + Math.sin(a) * 38; c.strokeStyle = P.stoneInk; c.lineWidth = 0.9; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
  c.strokeStyle = P.stoneHi; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-40, -16); c.quadraticCurveTo(-34, -40, 0, -36.5); c.stroke();
  // the parapet's top face, going back
  const topf = [-86, -22, -60, -40, -30, -50, 0, -54, 30, -50, 60, -40, 86, -22, 86 + D[0], -22 + D[1], 60 + D[0], -40 + D[1], 30 + D[0], -50 + D[1], 0 + D[0], -54 + D[1], -30 + D[0], -50 + D[1], -60 + D[0], -40 + D[1], -86 + D[0], -22 + D[1]];
  fillPoly(c, topf, lg(c, -86, -60, 86, -22, ['#d4d4ea', P.stoneHi]), P.stoneInk, 1);
  // crystals growing along the parapet, back to front
  const R = rng(3);
  for (let k = 0; k < 11; k++) { const x = -64 + k * 12.6 + (R() - 0.5) * 4, y = -22 - (1 - (x / 86) ** 2) * 32 - 2; shard(c, x + 3, y - 3, 8 + R() * 12, 2.4 + R() * 1.4, (R() - 0.5) * 0.8, k % 3 === 1 ? AM : CY); }
  // the end pillars: tall crystal posts on stone feet
  for (const [x, C] of [[-80, AM], [80, CY]]) {
    glowAt(c, x, -52, 30, C.glow, 0.35);
    fillPoly(c, [x - 9, 2, x + 9, 2, x + 8, -18, x - 8, -18], lg(c, x - 9, 0, x + 9, 0, [P.stoneHi, P.stone, P.stoneLo]), P.stoneInk, 1);
    fillPoly(c, [x - 10, -18, x + 10, -18, x + 8, -22, x - 8, -22], P.stoneHi, P.stoneInk, 0.8);
    shard(c, x, -21, 70, 7.5, x < 0 ? -0.05 : 0.05, C); shard(c, x - 6, -21, 28, 3.6, -0.35, C); shard(c, x + 6, -21, 22, 3.2, 0.4, C);
  }
}
// The Miners' Camp: a canvas tent, crates, crossed pickaxes, a cart heaped with gems, a lantern on a pole
export const CAMP_LAMP = [-54, -108];
function paintCamp(c) {
  // the pole and its lantern (back left)
  const [px, py] = CAMP_LAMP;
  fillPoly(c, [px + 6 - 2, -2, px + 6 + 2, -2, px + 6 + 1.5, py - 10, px + 6 - 1.5, py - 10], lg(c, px + 4, 0, px + 8, 0, [P.woodHi, P.woodLo]), P.woodInk, 0.8);
  c.strokeStyle = P.woodInk; c.lineWidth = 2; c.beginPath(); c.moveTo(px + 6, py - 8); c.lineTo(px - 2, py - 8); c.stroke();
  lantern(c, px, py - 4, 1.1);
  // the tent: back face (shade), front gable with an open flap, the ridge pole
  const D = [24, -16];
  fillPoly(c, [-4, -84, -4 + D[0], -84 + D[1], 40 + D[0], 0 + D[1], 40, 0], lg(c, 0, -100, 60, 0, [P.canvas, P.canvasLo]), P.canvasInk, 1.1);
  c.save(); poly(c, [-4, -84, -4 + D[0], -84 + D[1], 40 + D[0], 0 + D[1], 40, 0]); c.clip(); c.strokeStyle = 'rgba(120,90,50,0.35)'; c.lineWidth = 0.8; for (let k = 1; k < 6; k++) { const a = k / 6; c.beginPath(); c.moveTo(lerp(-4, 40, a), lerp(-84, 0, a)); c.lineTo(lerp(-4, 40, a) + D[0], lerp(-84, 0, a) + D[1]); c.stroke(); } c.restore();
  const gable = [-46, 0, -4, -84, 40, 0];
  fillPoly(c, gable, lg(c, -46, -84, 40, 0, ['#f8ecc8', P.canvas, mix(P.canvas, P.canvasLo, 0.55)]), P.canvasInk, 1.2);
  c.save(); poly(c, gable); c.clip();
  // the canvas: sagging folds from the ridge, a band of stripes along the hem, a patch stitched on, grime at the foot
  c.strokeStyle = 'rgba(140,108,60,0.3)'; c.lineWidth = 1;
  for (const f of [0.22, 0.46, 0.68, 0.86]) { const x0 = lerp(-46, -4, f), x1 = lerp(40, -4, f); c.beginPath(); c.moveTo(lerp(-4, -46, 1 - f) * 0 + x0, lerp(0, -84, f)); c.quadraticCurveTo(-4, lerp(0, -84, f) + 6, x1, lerp(0, -84, f)); c.stroke(); void x1; }
  for (const [sx, sy2] of [[-30, -16], [22, -22]]) { c.strokeStyle = 'rgba(160,120,70,0.45)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(sx, sy2); c.quadraticCurveTo(sx + 4, sy2 - 14, sx + 2, sy2 - 26); c.stroke(); }
  c.fillStyle = '#d8c08a'; c.fillRect(-46, -12, 86, 12); c.fillStyle = '#b8683a'; c.fillRect(-46, -11, 86, 3.4);
  fillPoly(c, [8, -44, 20, -46, 22, -34, 10, -32], '#d6bf8a', 'rgba(120,90,50,0.6)', 0.8); // a patch
  c.strokeStyle = 'rgba(120,90,50,0.6)'; c.lineWidth = 0.6; for (let k = 0; k < 6; k++) { const a = k / 5; c.beginPath(); c.moveTo(lerp(8, 20, a), lerp(-44, -46, a) - 1); c.lineTo(lerp(8, 20, a) + 1, lerp(-44, -46, a) + 2); c.stroke(); }
  c.fillStyle = 'rgba(90,70,40,0.18)'; c.fillRect(-46, -6, 86, 6);
  c.restore();
  fillPoly(c, [-20, 0, -4, -50, 12, 0], lg(c, 0, -50, 0, 0, ['#1e1410', '#3a2a1a'])); // the opening
  fillPoly(c, [-4, -50, 12, 0, 22, 0, 4, -40], lg(c, 0, -50, 20, 0, ['#f8ecc8', '#d8c492']), P.canvasInk, 0.8); // the flap tied back
  c.strokeStyle = '#8a4a2a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(14, -18); c.lineTo(20, -12); c.stroke();
  fillPoly(c, [-14, 0, -4, -12, 8, -12, 8, 0], '#7a3a3a'); // a bedroll inside
  c.strokeStyle = P.woodInk; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-4, -86); c.lineTo(-4 + D[0] + 2, -86 + D[1] - 1); c.stroke(); c.strokeStyle = P.wood; c.lineWidth = 1.2; c.stroke();
  // guy ropes to their pegs, a lantern hung at the ridge, a billy can by the door
  c.strokeStyle = '#c8a877'; c.lineWidth = 1.1; c.lineCap = 'round';
  for (const [ax, ay, bx2, by2] of [[-46, -2, -62, 5], [-4, -82, -24, 4], [40, -2, 56, 5], [-4, -82, 22, 4]]) { c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo((ax + bx2) / 2, (ay + by2) / 2 + 4, bx2, by2); c.stroke(); }
  for (const [px2, py2] of [[-62, 5], [56, 5], [-24, 4], [22, 4]]) { c.strokeStyle = P.woodInk; c.lineWidth = 2.2; c.beginPath(); c.moveTo(px2, py2 - 5); c.lineTo(px2 + 1.5, py2 + 2); c.stroke(); c.strokeStyle = P.woodHi; c.lineWidth = 1; c.stroke(); }
  lantern(c, -6, -76, 0.8);
  fillPoly(c, [26, 2, 38, 2, 36, -9, 28, -9], lg(c, 26, 0, 38, 0, [P.ironHi, P.ironLo]), P.ironInk, 0.9); ell(c, 32, -9, 5, 1.6, '#9aa0b4'); c.strokeStyle = P.ironInk; c.lineWidth = 0.9; c.beginPath(); c.arc(32, -10, 5.6, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
  // crates and the pickaxes leaning on them (left front)
  const box = (x, y, w, h) => { fillPoly(c, [x, y, x + w, y, x + w, y - h, x, y - h], lg(c, x, y - h, x + w, y, [P.woodHi, P.wood, P.woodLo]), P.woodInk, 1); fillPoly(c, [x, y - h, x + w, y - h, x + w + 5, y - h - 4, x + 5, y - h - 4], P.woodHi, P.woodInk, 0.8); c.strokeStyle = P.woodInk; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x + 2, y - 2); c.lineTo(x + w - 2, y - h + 2); c.stroke(); };
  box(-68, 4, 22, 18); box(-62, -14, 16, 13);
  for (const [a, x] of [[-0.35, -44], [0.35, -36]]) { c.save(); c.translate(x, 4); c.rotate(a); fillPoly(c, [-1.4, 0, 1.4, 0, 1.4, -34, -1.4, -34], lg(c, -1.4, 0, 1.4, 0, [P.woodHi, P.woodLo]), P.woodInk, 0.6); c.beginPath(); c.moveTo(-12, -30); c.quadraticCurveTo(0, -38, 12, -30); c.lineTo(10, -28); c.quadraticCurveTo(0, -34, -10, -28); c.closePath(); c.fillStyle = P.ironHi; c.fill(); c.strokeStyle = P.ironInk; c.lineWidth = 0.8; c.stroke(); c.restore(); }
  // an open crate of ore by the tent door (the gem cart is the mole's, out on the rails)
  fillPoly(c, [34, 6, 64, 6, 64, -12, 34, -12], lg(c, 34, 0, 64, 0, [P.woodHi, P.wood, P.woodLo]), P.woodInk, 1);
  fillPoly(c, [34, -12, 64, -12, 68, -16, 38, -16], P.woodHi, P.woodInk, 0.8);
  c.save(); c.beginPath(); c.rect(34, -22, 34, 12); c.clip();
  for (let k = 0; k < 7; k++) shard(c, 38 + k * 4.4, -11, 6 + (k % 3) * 3, 2.2, (k % 3 - 1) * 0.4, [AM, CY, RO][k % 3], false);
  c.restore();
  c.strokeStyle = P.woodInk; c.lineWidth = 0.8; c.beginPath(); c.moveTo(36, 4); c.lineTo(62, -10); c.stroke();
}
// a mine cart heaped with gems (x, y: the floor between the wheels); its size in s
function gemCart(c, x, y, s) {
  c.save(); c.translate(x, y); c.scale(s, s);
  ell(c, 2, 1, 22, 3.4, 'rgba(8,6,24,0.45)');
  // the heap of gems over the rim
  const R = rng(9);
  for (let k = 0; k < 9; k++) { const gx = -13 + k * 3.2 + (R() - 0.5) * 2, h = 6 + R() * 8; shard(c, gx, -16, h, 2.4 + R(), (R() - 0.5) * 1.2, [AM, CY, RO][k % 3], false); }
  fillPoly(c, [-18, -16, 18, -16, 15, -4, -15, -4], lg(c, -18, -16, 18, -4, [P.ironHi, P.iron, P.ironLo]), P.ironInk, 1);
  fillPoly(c, [-19, -18, 19, -18, 18, -15, -18, -15], '#a8aec4', P.ironInk, 0.8);
  for (const rx of [-12, 0, 12]) { ell(c, rx, -10, 0.9, 0.9, '#c8ccdc'); }
  for (const wx of [-10, 10]) { ell(c, wx, -2, 4.2, 4.2, P.ironInk); ell(c, wx, -2, 2.8, 2.8, P.iron); ell(c, wx - 0.6, -2.6, 1, 1, '#c8ccdc'); }
  c.restore();
}
// The Great Geode: a knobbly boulder split open, banded agate round the cut, a hollow full of amethyst; the other half
// lies at its foot with its crystals up
function paintGeode(c) {
  const R = rng(4);
  // the boulder: an uneven lump, lit upper left
  const outer = wobble(6, -58, 58, 58, 11, 0.1, 44);
  c.save(); c.translate(3, 3); blobPath(c, outer); c.fillStyle = P.rockInk; c.fill(); c.restore();
  blobPath(c, outer); c.fillStyle = lg(c, -50, -116, 60, 0, ['#a59cb4', '#786e8c', '#4e4562', '#342c46']); c.fill(); c.strokeStyle = '#1e1830'; c.lineWidth = 1.4; c.stroke();
  c.save(); blobPath(c, outer); c.clip();
  for (let k = 0; k < 34; k++) { const a = R() * TAU, r = R() * 56, x = 6 + Math.cos(a) * r, y = -58 + Math.sin(a) * r, rr = 3 + R() * 6, lit = x + y * 0.8 < -40; ell(c, x + rr * 0.3, y + rr * 0.3, rr, rr * 0.8, 'rgba(20,14,40,0.28)'); ell(c, x, y, rr * 0.9, rr * 0.7, lit ? 'rgba(220,214,236,0.35)' : 'rgba(150,140,170,0.25)'); }
  c.fillStyle = 'rgba(16,10,34,0.35)'; c.beginPath(); c.ellipse(40, -30, 44, 40, 0.4, 0, TAU); c.fill();
  c.restore();
  // the cut face, tipped toward us like a bowl: a thin rind of agate, a deep hollow, crystals crowding in from the rim
  const cx = -4, cy = -66, face = (k) => wobble(cx, cy, 46 * k, 32 * k, 12, 0.07, 45);
  c.save(); c.translate(0, 4); blobPath(c, face(1.04)); c.fillStyle = 'rgba(16,10,34,0.45)'; c.fill(); c.restore();
  for (const [k, col] of [[1, '#efe8f8'], [0.94, '#9a7cd0'], [0.9, '#dccff2']]) { blobPath(c, face(k)); c.fillStyle = col; c.fill(); }
  blobPath(c, face(1)); c.strokeStyle = 'rgba(40,24,80,0.75)'; c.lineWidth = 1.1; c.stroke();
  const hol = face(0.86);
  blobPath(c, hol); c.fillStyle = lg(c, cx, cy - 28, cx, cy + 26, ['#1c0a44', '#3a1880', '#7a48c8', '#b48ae8']); c.fill();
  c.save(); blobPath(c, hol); c.clip();
  // the back wall's crystals hang toward us, big and dark; the near wall's crystals stand up, small and lit
  const back = [], near = [];
  for (let k = 0; k < 15; k++) { const f = k / 14, x = cx - 40 + f * 80 + (R() - 0.5) * 4, y = cy - 26 * Math.sqrt(Math.max(0, 1 - ((x - cx) / 42) ** 2)) + 2, len = 16 + R() * 14 * (1 - Math.abs(f - 0.5)), a = (f - 0.5) * 0.9; back.push([x, y, len, 3 + R() * 2.4, Math.PI + a]); }
  for (let k = 0; k < 12; k++) { const f = k / 11, x = cx - 36 + f * 72 + (R() - 0.5) * 4, y = cy + 24 * Math.sqrt(Math.max(0, 1 - ((x - cx) / 40) ** 2)) + 2, len = 10 + R() * 9, a = (f - 0.5) * -0.8; near.push([x, y, len, 2.6 + R() * 2, a]); }
  for (const [x, y, len, w, a] of back) { c.save(); c.translate(x, y); c.rotate(a); fillPoly(c, [-w, 0, -w * 0.8, -len * 0.72, 0, -len, w * 0.8, -len * 0.72, w, 0], lg(c, -w, 0, w, 0, ['#6a3ab8', '#4a2090', '#2a0c60']), 'rgba(20,6,50,0.7)', 0.5); c.strokeStyle = 'rgba(200,170,255,0.6)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(-w * 0.4, -1); c.lineTo(-w * 0.3, -len * 0.7); c.stroke(); c.restore(); }
  glowAt(c, cx + 4, cy + 6, 26, '#e0c0ff', 0.45);
  for (const [x, y, len, w, a] of near) { c.save(); c.translate(x, y); c.rotate(a); fillPoly(c, [-w, 0, -w * 0.8, -len * 0.72, 0, -len, w * 0.8, -len * 0.72, w, 0], lg(c, -w, 0, w, 0, [AM.hi, AM.base, AM.lo]), rgba(AM.ink, 0.6), 0.5); fillPoly(c, [-w * 0.8, -len * 0.72, 0, -len, -w * 0.1, -len * 0.7], '#ffffff'); c.restore(); }
  c.restore();
  c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 1.4; c.beginPath(); c.ellipse(cx, cy, 45, 31, 0, Math.PI * 0.05, Math.PI * 0.8); c.stroke(); // the lit near lip
  // the other half, lying at the foot (front right), its crystals up
  c.save(); c.translate(42, -2); c.rotate(0.12);
  c.beginPath(); c.moveTo(-24, -6); c.quadraticCurveTo(-26, 8, 0, 10); c.quadraticCurveTo(26, 8, 24, -6); c.closePath(); c.fillStyle = lg(c, 0, -6, 0, 10, ['#6a6080', '#3a3248']); c.fill(); c.strokeStyle = '#1e1830'; c.lineWidth = 1.2; c.stroke();
  c.beginPath(); c.ellipse(0, -6, 24, 8, 0, 0, TAU); c.fillStyle = '#efe8f8'; c.fill(); c.strokeStyle = 'rgba(40,24,80,0.6)'; c.lineWidth = 0.8; c.stroke();
  c.beginPath(); c.ellipse(0, -6, 21, 6.4, 0, 0, TAU); c.fillStyle = '#8a64c8'; c.fill();
  c.beginPath(); c.ellipse(0, -5.6, 18, 5, 0, 0, TAU); c.fillStyle = rg(c, 0, -5, 1, 18, ['#f6e8ff', AM.base, AM.lo]); c.fill();
  for (let k = 0; k < 9; k++) { const x = -14 + k * 3.5, h = 4 + (k % 3) * 2.4; fillPoly(c, [x - 1.6, -4, x, -4 - h, x + 1.6, -4], k % 2 ? AM.hi : AM.base, rgba(AM.ink, 0.5), 0.4); }
  c.restore();
  for (let k = 0; k < 4; k++) shard(c, -40 + k * 6, 3, 5 + (k % 3) * 3, 1.8, (k - 1.5) * 0.35, AM, false);
}
// The Crystal Throne: a stepped dais, a great crown of crystal spires, the boss's shadow on the wall behind (live eyes)
export const THRONE_EYES = [[-12, -150], [10, -150]];
const THRONE_WALL = [-72, -20, -70, -112, -56, -158, -26, -182, 14, -186, 48, -170, 72, -136, 78, -92, 76, -20];
function paintThrone(c) {
  // a slab of lit rock behind the throne, and on it the shadow of Duke Quartz (the thornback): the game's own crawler
  fillPoly(c, THRONE_WALL, lg(c, -72, -186, 78, -20, ['#7a6cb8', '#53468e', '#372e66']), P.rockInk, 1.4);
  c.save(); poly(c, THRONE_WALL); c.clip();
  c.strokeStyle = 'rgba(20,12,50,0.4)'; c.lineWidth = 1.2; for (const p of [[-60, -60, -48, -110, -52, -150], [60, -40, 66, -90, 54, -150], [-20, -176, 0, -168]]) { c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.stroke(); }
  shadowOfBoss(c);
  c.restore();
  c.strokeStyle = 'rgba(210,200,255,0.55)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-71, -40); c.lineTo(-70, -112); c.lineTo(-56, -158); c.lineTo(-26, -182); c.lineTo(14, -186); c.stroke();
  // the dais: three steps of dark stone with lit treads
  for (let k = 0; k < 3; k++) { const w = 74 - k * 14, y = -k * 9; fillPoly(c, [-w, y + 2, w, y + 2, w - 4, y - 8, -w + 4, y - 8], lg(c, -w, y - 8, w, y + 2, [P.stoneHi, P.stone, P.stoneLo]), P.stoneInk, 1.1); fillPoly(c, [-w + 4, y - 8, w - 4, y - 8, w - 8, y - 11, -w + 8, y - 11], '#c4c2de', P.stoneInk, 0.8); }
  // the crown: a band of gold set with gems, crystal spires rising out of it, the tallest in the middle
  const by = -30, bw = 44;
  glowAt(c, 0, -80, 84, '#c070ff', 0.4);
  const spires = [[-38, 44, 7, -0.28, RO], [38, 44, 7, 0.28, RO], [-28, 66, 8, -0.18, AM], [28, 66, 8, 0.18, AM], [-15, 94, 9, -0.08, CY], [15, 94, 9, 0.08, CY], [0, 122, 11, 0, AM]];
  for (const [x, h, w, a, C] of spires) shard(c, x, by - 10, h, w, a, C);
  // the crown band in front of the spires' roots
  c.beginPath(); c.moveTo(-bw, by); c.quadraticCurveTo(0, by + 10, bw, by); c.lineTo(bw + 2, by - 14); c.quadraticCurveTo(0, by - 4, -bw - 2, by - 14); c.closePath();
  c.fillStyle = lg(c, -bw, by - 14, bw, by, ['#ffe9a0', '#e8b43a', '#a8741a']); c.fill(); c.strokeStyle = '#5a3a08'; c.lineWidth = 1.2; c.stroke();
  for (let k = 0; k < 5; k++) { const x = -32 + k * 16, y = by - 6 + (1 - (x / bw) ** 2) * 4; const C = [RO, CY, AM, CY, RO][k]; ell(c, x, y, 4, 3.4, C.lo); ell(c, x - 0.6, y - 0.6, 3, 2.6, C.base); ell(c, x - 1.2, y - 1.2, 1.1, 0.9, '#ffffff'); }
  c.strokeStyle = 'rgba(255,250,220,0.8)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-bw, by - 13); c.quadraticCurveTo(0, by - 3, bw, by - 13); c.stroke();
  // torches? no fire here: two crystal braziers glowing at the dais corners
  for (const x of [-64, 64]) { glowAt(c, x, -24, 18, CY.glow, 0.45); fillPoly(c, [x - 6, 0, x + 6, 0, x + 4, -12, x - 4, -12], P.ironLo, P.ironInk, 0.8); fillPoly(c, [x - 8, -12, x + 8, -12, x + 6, -16, x - 6, -16], P.iron, P.ironInk, 0.8); shard(c, x - 3, -15, 12, 2.6, -0.3, CY, false); shard(c, x + 3, -15, 14, 2.8, 0.25, CY, false); }
}
function shadowOfBoss(c) {
  if (typeof document === 'undefined') return;
  const S = 64, w = 200, h = 220, cv = document.createElement('canvas'), k = 2;
  cv.width = w * k; cv.height = h * k;
  const g = cv.getContext('2d'); g.scale(k, k);
  try { drawCrawler(g, w / 2, 30, S * 1.25, 0.4, { heading: -Math.PI / 2, curve: 0.004, pose: 'idle', id: 9301, glow: 0 }, 'thornback'); } catch (_) { /* no shadow rather than a broken sprite */ }
  g.globalCompositeOperation = 'source-in'; g.fillStyle = 'rgba(18,8,44,0.62)'; g.fillRect(0, 0, w, h);
  c.drawImage(cv, -w / 2, -186, w, h);
  freeCanvas(cv); // a scratch picture: back to the phone at once
  cv.width = cv.height = 0;
}
const PAINT = { mouth: paintMouth, bridge: paintBridge, camp: paintCamp, geode: paintGeode, throne: paintThrone };

// ------------------------------------------------------------------ landmarks on the map (called by main.js)
export function drawCaveLandmark(ctx, L, m, sy, t, calm, p, glow, DPR) {
  const y = drawLandmarkBody(ctx, m, sy, t, calm, p, glow, DPR, (c, mm) => PAINT[mm.kind](c));
  if (y == null) return;
  const d = m.d, f = m.flip ? -1 : 1, T = calm ? 0 : t;
  const sq = p && !calm;
  if (sq) { ctx.save(); ctx.translate(m.x, y); ctx.scale(1 + 0.035 * p, 1 - 0.045 * p); ctx.translate(-m.x, -y); }
  // live bits: lantern light, the geode's glitter, the boss's eyes
  if (m.kind === 'mouth') lampGlow(ctx, m.x + (MOUTH_LAMP[0] - 10) * d * f, y + (MOUTH_LAMP[1] + 7) * d, d, T, calm);
  else if (m.kind === 'camp') lampGlow(ctx, m.x + CAMP_LAMP[0] * d * f, y + (CAMP_LAMP[1] + 4) * d, d * 1.1, T + 1.7, calm);
  else if (m.kind === 'geode' && !calm) { ctx.fillStyle = '#ffffff'; for (let q = 0; q < 6; q++) { const a = Math.max(0, Math.sin(T * 1.7 + q * 2.1)), r = a * 3.2 * d; if (r < 0.4) continue; const gx = m.x + (-3 + Math.cos(q * 2.4) * 28 * (0.4 + (q % 3) * 0.2)) * d * f, gy = y + (-58 + Math.sin(q * 2.4) * 30 * (0.4 + (q % 3) * 0.2)) * d; ctx.globalAlpha = a; star4(ctx, gx, gy, r); } ctx.globalAlpha = 1; }
  else if (m.kind === 'throne') { // the eyes in the shadow: open, glow, blink now and then; narrow when the boss level is next
    const cyc = fract(T / 5.3), bl = calm ? 0 : cyc > 0.93 ? Math.sin(((cyc - 0.93) / 0.07) * Math.PI) : 0, op = 1 - bl, gl = calm ? 0.8 : 0.7 + 0.3 * Math.sin(T * 2.2);
    for (const [ex, ey] of THRONE_EYES) { const x = m.x + ex * d * f, yy = y + ey * d; ctx.fillStyle = `rgba(255,70,120,${0.22 * gl})`; ctx.beginPath(); ctx.ellipse(x, yy, 7 * d, 5 * d * Math.max(0.2, op), 0, 0, TAU); ctx.fill(); ctx.fillStyle = `rgba(255,200,120,${0.95 * gl})`; ctx.beginPath(); ctx.ellipse(x, yy, 3.4 * d, 1.8 * d * Math.max(0.1, op), ex < 0 ? 0.25 : -0.25, 0, TAU); ctx.fill(); }
  }
  if (sq) ctx.restore();
}
function star4(ctx, x, y, r) { ctx.beginPath(); ctx.moveTo(x, y - r * 1.8); ctx.quadraticCurveTo(x, y, x + r * 1.8, y); ctx.quadraticCurveTo(x, y, x, y + r * 1.8); ctx.quadraticCurveTo(x, y, x - r * 1.8, y); ctx.quadraticCurveTo(x, y, x, y - r * 1.8); ctx.fill(); }
function lampGlow(ctx, x, y, d, t, calm) {
  const fl = calm ? 0.85 : 0.82 + 0.1 * Math.sin(t * 7.1) + 0.06 * Math.sin(t * 13.3);
  const g = glowSprite('#ffd27a'); if (g) { const r = 30 * d * fl; ctx.globalAlpha = 0.85; ctx.drawImage(g, x - r, y - r, 2 * r, 2 * r); ctx.globalAlpha = 1; }
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
export const drawCavePlaque = drawFarmPlaque;

// ------------------------------------------------------------------ the live layer
// Pure functions of the clock, each creature on its own beat, eased (win() ramps), each in its own patch.
function win(t, a, b, f = 0.25) { return ss((t - a) / f) * (1 - ss((t - b) / f)); }
const vis = (y0, y1, vt, vb) => y1 >= vt && y0 <= vb;
export function drawCaveLive(ctx, L, sy, t, calm, vt = -Infinity, vb = Infinity) {
  const plan = cavePlan(L), u = L.u, T = calm ? 0 : t;
  if (plan.lms.length < 5) return;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  try {
    if (plan.stream && vis(plan.stream.fall.y - 60 * u - sy, plan.stream.pts[plan.stream.pts.length - 1] + 30 * u - sy, vt, vb)) water(ctx, L, plan, sy, u, T, calm);
    if (plan.worms.length && vis(plan.top - 20 * u - sy, plan.top + 80 * u - sy, vt, vb)) worms(ctx, plan, sy, u, T, calm);
    const ch = spot(plan, 'chime'); if (ch && vis(ch.y - 120 * u - sy, ch.y + 10 * u - sy, vt, vb)) chime(ctx, ch, sy, u, T, calm);
    for (const k of ['amethyst', 'cyan', 'rose']) { const p = spot(plan, k); if (p && !calm && vis(p.y - 100 * u - sy, p.y - sy, vt, vb)) clusterTwinkle(ctx, p, sy, u, T, k.length); }
    const wr = spot(plan, 'warm'); if (wr && vis(wr.y - 60 * u - sy, wr.y + 10 * u - sy, vt, vb)) salamander(ctx, wr, sy, u, T, calm);
    const ra = spot(plan, 'rats'); if (ra && vis(ra.y - 60 * u - sy, ra.y + 10 * u - sy, vt, vb)) rats(ctx, ra, sy, u, T, calm);
    if (plan.roost.length && vis(plan.top - 20 * u - sy, plan.top + 160 * u - sy, vt, vb)) bats(ctx, plan, sy, u, T, calm);
  } catch (e) { /* art never breaks the map */ }
  ctx.restore();
}

// over the landmarks: the mole and his cart run along the rails in front of the camp
export function drawCaveFront(ctx, L, sy, t, calm, vt = -Infinity, vb = Infinity) {
  const plan = cavePlan(L), u = L.u;
  if (!plan.mole || !vis(plan.rails.y - 70 * u - sy, plan.rails.y + 20 * u - sy, vt, vb)) return;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  try { mole(ctx, L, plan, sy, u, calm ? 0 : t, calm); } catch (e) { /* art never breaks the map */ }
  ctx.restore();
}
// the stream: light flowing along it, the waterfall's sheet streaming, drips from the spout and their rings
function water(ctx, L, plan, sy, u, t, calm) {
  const S = plan.stream, pts = S.pts, n = pts.length / 2 - 1;
  if (!calm) {
    ctx.fillStyle = '#c8f6ff';
    for (let q = 0; q < 12; q++) { const f = fract(q / 12 + t * 0.05 * (S.side || 1)), k = Math.min(n - 1, Math.floor(f * n)), a = f * n - k, x = lerp(pts[2 * k], pts[2 * k + 2], a), y = lerp(pts[2 * k + 1], pts[2 * k + 3], a) - sy + Math.sin(q * 2.3) * S.w * 0.2; if (Math.abs(x - L.pathX(y + sy)) < L.roadW * 0.6 + 6 * u) continue; ctx.globalAlpha = 0.35 + 0.4 * Math.sin(f * Math.PI); ctx.beginPath(); ctx.ellipse(x, y, 3.4 * u, 0.9 * u, 0, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  const F = S.fall, sd = F.x > L.cx ? -1 : 1, fx = F.x + sd * 4 * u, fy = F.y - sy;
  ctx.strokeStyle = 'rgba(235,252,255,0.75)'; ctx.lineWidth = 1.1 * u;
  for (let q = 0; q < 4; q++) { const a = calm ? 0.5 : fract(t * 1.6 + q * 0.27), x = fx + sd * (10 + q * 4) * u, y0 = fy - 24 * u + a * 22 * u; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 + 6 * u); ctx.stroke(); }
  // drips: from the spout's lip into the pool, a ring where each lands
  if (!calm) for (let q = 0; q < 2; q++) {
    const c = fract(t / 2.6 + q * 0.5), x = fx + sd * (30 - q * 6) * u, y0 = fy - 34 * u, y1 = fy + 4 * u;
    if (c < 0.35) { const k = c / 0.35, yy = lerp(y0, y1, k * k); ctx.fillStyle = 'rgba(200,245,255,0.9)'; ctx.beginPath(); ctx.ellipse(x, yy, 1.2 * u, 2 * u, 0, 0, TAU); ctx.fill(); }
    else { const k = (c - 0.35) / 0.65; ctx.strokeStyle = `rgba(220,250,255,${0.7 * (1 - k)})`; ctx.lineWidth = 1 * u; ctx.beginPath(); ctx.ellipse(x, y1, (2 + k * 12) * u, (0.8 + k * 3.4) * u, 0, 0, TAU); ctx.stroke(); }
  }
}
// glow-worms: their lights pulse in slow waves along the lip
function worms(ctx, plan, sy, u, t, calm) {
  const g = glowSprite('#9af0e0'); if (!g) return;
  for (let i = 0; i < plan.worms.length; i++) {
    const [x, y0, len, r] = plan.worms[i];
    for (let k = 0; k < 4; k++) { const y = y0 + len * (0.3 + k * 0.2) - sy, p = calm ? 0.6 : 0.45 + 0.55 * Math.max(0, Math.sin(t * 1.3 - x * 0.02 + k * 0.9 + r * 6)), rr = (3 + p * 4) * u; ctx.globalAlpha = 0.25 + 0.6 * p; ctx.drawImage(g, x - rr, y - rr, 2 * rr, 2 * rr); }
  }
  ctx.globalAlpha = 1;
}
// the chiming crystal: every few seconds it brightens, a ring of light runs out along the floor, notes of light rise
function chime(ctx, ch, sy, u, t, calm) {
  const s = ch.s * u, x = ch.x, y = ch.y - sy, cyc = fract((t + 1.2) / 6.4) * 6.4, hit = calm ? 0 : win(cyc, 0, 0.9, 0.12);
  const g = glowSprite('#7ae6ff');
  if (g && hit > 0) { const r = 40 * s * (0.8 + hit * 0.4); ctx.globalAlpha = hit * 0.9; ctx.drawImage(g, x - r, y - 44 * s - r, 2 * r, 2 * r); ctx.globalAlpha = 1; }
  if (!calm && cyc < 2.4) for (let q = 0; q < 2; q++) { const k = (cyc - q * 0.35) / 2; if (k <= 0 || k >= 1) continue; ctx.strokeStyle = `rgba(160,240,255,${0.75 * (1 - k)})`; ctx.lineWidth = (2.2 - k * 1.4) * u; ctx.beginPath(); ctx.ellipse(x, y - 2 * s, (10 + k * 70) * s, (3 + k * 20) * s, 0, 0, TAU); ctx.stroke(); }
  if (!calm && cyc < 3) for (let q = 0; q < 3; q++) { const k = (cyc - 0.2 - q * 0.3) / 2.2; if (k <= 0 || k >= 1) continue; ctx.fillStyle = `rgba(210,250,255,${Math.min(1, k * 5) * (1 - k)})`; star4(ctx, x + Math.sin(k * 5 + q * 2) * 14 * s, y - 70 * s - k * 46 * s, (1.6 + q * 0.4) * u); }
}
function clusterTwinkle(ctx, p, sy, u, t, seed) {
  const s = p.s * u; ctx.fillStyle = '#ffffff';
  for (let q = 0; q < 3; q++) { const a = Math.max(0, Math.sin(t * 1.1 + q * 2.2 + seed)), r = a * 2.6 * u; if (r < 0.4) continue; ctx.globalAlpha = a; star4(ctx, p.x + Math.sin(q * 2.9 + seed) * 26 * s, p.y - sy - (30 + q * 16) * s, r); }
  ctx.globalAlpha = 1;
}
// the salamander basking on the warm rock: still, eyes half shut, the tail curling lazily; now and then a tongue flick
function salamander(ctx, wr, sy, u, t, calm) {
  const s = wr.s * u, x = wr.x, y = wr.y - sy - 12 * s, cyc = fract((t + 0.6) / 4.2) * 4.2, fl = calm ? 0 : win(cyc, 2.9, 3.35, 0.08);
  drawCrawler(ctx, x + 24 * s, y, 30 * s, t, { heading: Math.PI + 0.12, curve: 0.012 / s, pose: 'idle', blend: { tongue: fl, mouth: fl * 0.35 }, glow: 0.6, id: 9401 }, 'salamander');
}
// two rats tugging at one gem: they sit up and heave in turn, the gem rocks between them; now and then one squeaks
function rats(ctx, ra, sy, u, t, calm) {
  const s = ra.s * u * 1.35, x = ra.x, y = ra.y - sy, S = 34 * s;
  const tug = calm ? 0 : Math.sin(t * 1.25) * 0.8 + Math.sin(t * 2.7) * 0.2, gx = x + tug * 5 * s;
  const cyc = fract((t + 2) / 9) * 9, crossA = calm ? 0 : win(cyc, 6.4, 7.8, 0.25);
  const gem = (front) => { // a big rose crystal standing between them, lying back a little
    ctx.save(); ctx.translate(gx, y - 2 * s); ctx.rotate(tug * 0.1);
    if (!front) { ctx.beginPath(); ctx.ellipse(2 * s, 1 * s, 13 * s, 3 * s, 0, 0, TAU); ctx.fillStyle = 'rgba(8,6,24,0.45)'; ctx.fill(); }
    ctx.beginPath(); ctx.rect(-14 * s, front ? -9 * s : -34 * s, 28 * s, front ? 11 * s : 25 * s); ctx.clip();
    ctx.beginPath(); ctx.moveTo(-7 * s, 2 * s); ctx.lineTo(-7 * s, -16 * s); ctx.lineTo(0, -26 * s); ctx.lineTo(7 * s, -16 * s); ctx.lineTo(7 * s, 2 * s); ctx.closePath();
    ctx.fillStyle = RO.base; ctx.fill(); ctx.strokeStyle = RO.ink; ctx.lineWidth = 1.2 * s; ctx.stroke();
    ctx.fillStyle = RO.hi; ctx.beginPath(); ctx.moveTo(-7 * s, 2 * s); ctx.lineTo(-7 * s, -16 * s); ctx.lineTo(-1.5 * s, -22 * s); ctx.lineTo(-1.5 * s, 2 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = RO.lo; ctx.beginPath(); ctx.moveTo(1.5 * s, -21 * s); ctx.lineTo(7 * s, -16 * s); ctx.lineTo(7 * s, 2 * s); ctx.lineTo(1.5 * s, 2 * s); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1 * s; ctx.beginPath(); ctx.moveTo(-4.4 * s, 0); ctx.lineTo(-4.4 * s, -17 * s); ctx.stroke();
    ctx.restore();
  };
  const paw = (side, pz) => { ctx.fillStyle = '#ef9ea8'; ctx.beginPath(); ctx.ellipse(gx - side * (7.4 * s), y - (13 + pz * 3) * s, 3 * s, 2.2 * s, side * 0.3, 0, TAU); ctx.fill(); };
  gem(false);
  for (const side of [-1, 1]) { // the far rat (right) first, then the near one
    const sd = side > 0 ? 1 : -1, pull = sd * tug, pz = clamp(pull, 0, 1), sit = sd > 0 ? crossA : 0;
    const P = thiefPose('rat', sit > 0.5 ? 'cross' : 'stand', t + (sd > 0 ? 0.37 : 0), 0, 0);
    P.dx = (P.dx || 0) - pz * 5; P.pitch = (P.pitch || 0) - 0.12 * pz; P.by = (P.by || 24) - 3 * pz;
    P.look = 1; P.brow = 1; P.lid = 0.3; P.jaw = 0.25 + 0.45 * pz; P.puff = Math.max(P.puff || 0, pz * 0.5);
    P.f0x = (P.f0x || 0) + 10 - pz * 3; P.f0y = (P.f0y || 0) + 4; P.f1x = (P.f1x || 0) + 8 - pz * 3; P.f1y = (P.f1y || 0) + 5;
    drawThief(ctx, gx - sd * (12 * s + S * 0.3) - sd * pz * 3 * s, y + 2 * s, S, t, P, { face: sd }, 'rat');
    paw(sd, pz);
  }
  gem(true);
}
// the mole and his gem cart: pushes it along the rails, stops, wipes his brow, pushes back the other way
function mole(ctx, L, plan, sy, u, t, calm) {
  const M = plan.mole, at = plan.rails.at, Cy = 14, k = fract((t + 5) / Cy) * Cy;
  const g = Math.sign(M.x0 - M.x1) || 1; // the way toward the road
  let e, dir, wipe = 0, walk = 0;
  if (calm) { e = 0.4; dir = g; }
  else if (k < 5) { e = ss(k / 5); dir = g; walk = 1; }
  else if (k < 7) { e = 1; dir = g; wipe = win(k, 5.3, 6.6, 0.25); }
  else if (k < 12) { e = 1 - ss((k - 7) / 5); dir = -g; walk = 1; }
  else { e = 0; dir = -g; wipe = win(k, 12.2, 13.6, 0.25); }
  const cx = lerp(M.x1, M.x0, e), cy = at(cx) - sy, s = u * 1.05;
  // the cart is in front (the way it goes), the mole behind it pushing
  const moleX = cx - dir * 26 * s;
  gemCart(ctx, cx, cy + 4 * s, s * 1.05);
  drawMole(ctx, moleX, cy + 4 * s, 15 * s, dir < 0 ? -1 : 1, t, walk, wipe, calm);
}
function drawMole(ctx, x, y, s, face, t, walk, wipe, calm) {
  // face: the way he looks (toward the cart). Unit: s = 15 px is about his height / 2.
  const bob = walk ? Math.abs(Math.sin(t * 7)) * 1.2 : 0, k = s / 15;
  ctx.save(); ctx.translate(x, y); ctx.scale(face * k, k);
  ctx.beginPath(); ctx.ellipse(1, 0.5, 13, 2.6, 0, 0, TAU); ctx.fillStyle = 'rgba(8,6,24,0.45)'; ctx.fill();
  // feet (stepping)
  const st = walk ? Math.sin(t * 7) : 0;
  ell(ctx, -5 + st * 2, -1, 4, 2.2, '#e89aa4'); ell(ctx, 4 - st * 2, -1, 4, 2.2, '#e89aa4');
  ctx.translate(0, -bob);
  // the body: a velvety dark pear leaning into the push
  ctx.save(); ctx.rotate(walk ? 0.28 : 0.05);
  ctx.beginPath(); ctx.ellipse(-1, -13, 11, 13, 0, 0, TAU); ctx.fillStyle = '#4a3c54'; ctx.fill(); ctx.strokeStyle = '#1a1220'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-4, -18, 6, 8, -0.4, 0, TAU); ctx.fillStyle = '#6a5a78'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(3, -9, 6, 7, 0, 0, TAU); ctx.fillStyle = '#7a6a80'; ctx.fill(); // the belly
  // the head: snout pointing forward, a pink nose, tiny eyes shut tight, the miner's helmet with a lamp
  const hx = 6, hy = -24;
  ctx.beginPath(); ctx.ellipse(hx, hy, 8, 7, 0, 0, TAU); ctx.fillStyle = '#4a3c54'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hx + 5, hy - 2); ctx.quadraticCurveTo(hx + 14, hy + 1, hx + 13, hy + 4); ctx.quadraticCurveTo(hx + 8, hy + 5, hx + 4, hy + 4); ctx.closePath(); ctx.fillStyle = '#5a4a64'; ctx.fill(); ctx.stroke();
  ell(ctx, hx + 13.5, hy + 2, 2.6, 2.2, '#f08aa0'); ell(ctx, hx + 13, hy + 1.2, 0.9, 0.7, '#ffd0dc');
  ctx.strokeStyle = '#1a1220'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(hx + 4, hy - 1, 1.6, 0.3, Math.PI - 0.3); ctx.stroke();
  ctx.strokeStyle = 'rgba(240,230,255,0.6)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(hx + 12, hy + 4); ctx.lineTo(hx + 17, hy + 6); ctx.moveTo(hx + 12, hy + 3); ctx.lineTo(hx + 17, hy + 2); ctx.stroke();
  // helmet
  ctx.beginPath(); ctx.ellipse(hx - 1, hy - 4, 8.4, 6, -0.1, Math.PI, TAU); ctx.closePath(); ctx.fillStyle = '#e8b43a'; ctx.fill(); ctx.strokeStyle = '#6a4a10'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#c8901e'; ctx.fillRect(hx - 10, hy - 4.6, 18, 2);
  ell(ctx, hx + 4, hy - 8, 2.2, 2.2, '#fff2c0'); ctx.strokeStyle = '#6a4a10'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(hx + 4, hy - 8, 2.2, 0, TAU); ctx.stroke();
  // the arms: both on the cart when pushing; one up to the brow to wipe it
  ctx.strokeStyle = '#3a2e44'; ctx.lineWidth = 4.2;
  ctx.beginPath(); ctx.moveTo(4, -15); ctx.lineTo(16, -12 + (walk ? 0 : 3)); ctx.stroke();
  if (wipe > 0) { const sw = Math.sin(t * 9) * 3 * wipe; ctx.beginPath(); ctx.moveTo(2, -18); ctx.quadraticCurveTo(lerp(16, 10, wipe), lerp(-14, -28, wipe), lerp(16, hx + 1 + sw, wipe), lerp(-12, hy - 1, wipe)); ctx.stroke(); }
  else { ctx.beginPath(); ctx.moveTo(2, -18); ctx.lineTo(16, -16); ctx.stroke(); }
  ctx.fillStyle = '#f0a0ac'; ctx.beginPath(); ctx.arc(16, -12 + (walk ? 0 : 3), 2.6, 0, TAU); ctx.fill();
  if (wipe > 0) { const sw = Math.sin(t * 9) * 3 * wipe; ctx.beginPath(); ctx.arc(lerp(16, hx + 1 + sw, wipe), lerp(-16, hy - 1, wipe), 2.6, 0, TAU); ctx.fill(); }
  else { ctx.beginPath(); ctx.arc(16, -16, 2.6, 0, TAU); ctx.fill(); }
  ctx.restore();
  // a drop of sweat flies off as he wipes
  if (wipe > 0.3 && !calm) { const a = fract(t * 1.4); ctx.globalAlpha = (1 - a) * wipe; ctx.fillStyle = '#bfeaff'; ctx.beginPath(); ctx.ellipse(-6 - a * 8, -30 + a * 10 - Math.sin(a * Math.PI) * 6, 1.4, 2, 0.4, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
  ctx.restore();
}
// the bats: hang from the lip, wings wrapped; now and then one drops, opens its wings, loops and hangs back up
function bats(ctx, plan, sy, u, t, calm) {
  for (let i = 0; i < plan.roost.length; i++) {
    const r = plan.roost[i], Cy = 9 + i * 2.3, k = fract((t + i * 3.1) / Cy) * Cy, x0 = r.x, y0 = r.y - sy + 18 * u;
    let x = x0, y = y0, fly = 0, flap = 0, hang = 1, face = i % 2 ? -1 : 1;
    if (!calm && k > Cy - 3.2) { // the flight: drop, flutter out in a loop, come back
      const p = (k - (Cy - 3.2)) / 3.2, a = p * TAU;
      fly = win(p, 0.06, 0.92, 0.08); hang = 1 - fly;
      x = x0 + Math.sin(a) * 46 * u * face; y = y0 + (1 - Math.cos(a)) * 26 * u + Math.sin(p * Math.PI) * 10 * u; flap = t * 18;
      face = Math.cos(a) >= 0 ? face : -face;
    }
    drawBat(ctx, x, y, 9 * u, face, fly, flap, hang, calm ? 0 : t + i);
  }
}
function drawBat(ctx, x, y, s, face, fly, flap, hang, t) {
  ctx.save(); ctx.translate(x, y); ctx.scale(face * s / 10, s / 10);
  const body = '#3a2a4a', ink = '#140c1c', wing = '#4e3a62';
  if (hang > 0.5) { // upside down, wrapped: a teardrop with ears at the bottom, feet up to the rock
    const sw = Math.sin(t * 1.3) * 0.08;
    ctx.rotate(sw);
    ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-1.5, -16); ctx.lineTo(-1.5, -11); ctx.moveTo(1.5, -16); ctx.lineTo(1.5, -11); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.quadraticCurveTo(7, -8, 5, 2); ctx.quadraticCurveTo(0, 6, -5, 2); ctx.quadraticCurveTo(-7, -8, 0, -12); ctx.fillStyle = wing; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 1.1; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-3, -9); ctx.quadraticCurveTo(0, -4, -2, 1); ctx.strokeStyle = 'rgba(160,130,200,0.5)'; ctx.lineWidth = 0.7; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 4, 3.6, 0, TAU); ctx.fillStyle = body; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(-3, 6); ctx.lineTo(-4, 10); ctx.lineTo(-1, 7); ctx.moveTo(3, 6); ctx.lineTo(4, 10); ctx.lineTo(1, 7); ctx.fill();
    ctx.fillStyle = '#ffd060'; ctx.beginPath(); ctx.arc(-1.4, 4.4, 0.7, 0, TAU); ctx.arc(1.4, 4.4, 0.7, 0, TAU); ctx.fill();
  } else { // flying: wings beat
    const w = Math.sin(flap), sp = 0.4 + 0.6 * Math.abs(w);
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 2, -1); ctx.quadraticCurveTo(sd * 8, -8 * w - 2, sd * 15 * sp, -6 * w); ctx.lineTo(sd * 12 * sp, -1 * w + 1); ctx.lineTo(sd * 9 * sp, -2 * w + 3); ctx.lineTo(sd * 6 * sp, 1); ctx.lineTo(sd * 2, 2); ctx.closePath(); ctx.fillStyle = wing; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(0, 0, 3.2, 4, 0, 0, TAU); ctx.fillStyle = body; ctx.fill(); ctx.strokeStyle = ink; ctx.stroke();
    ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(-2.4, -3); ctx.lineTo(-3, -7); ctx.lineTo(-0.6, -4); ctx.moveTo(2.4, -3); ctx.lineTo(3, -7); ctx.lineTo(0.6, -4); ctx.fill();
    ctx.fillStyle = '#ffd060'; ctx.beginPath(); ctx.arc(-1.2, -2, 0.7, 0, TAU); ctx.arc(1.2, -2, 0.7, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// the registry entry (mapscene.js PLACES)
export const PLACE = { landmarks: LMS, paintBand: paintCaveBand, drawLive: drawCaveLive, drawFront: drawCaveFront, stop: caveStop, drawLandmark: drawCaveLandmark, drawPlaque: drawCavePlaque };
