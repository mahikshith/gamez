// World 1, The Farm, as one place (0.8.7, mykee: "too kiddish ... instead of round orbs for the levels it could be a
// place the map leads to ... different creatures doing different things ... have a proper map").
// The farm is seen from a raised 3/4 angle with the light from the upper left. The five stops are five landmarks that
// ARE the tap targets: the Hen House, the Haystacks, the Duck Pond, the Windmill and the Big Red Barn, each with a
// wooden plaque on a post at the road side that carries the level's number, stars or padlock (main.js draws those).
//
// What is painted where (performance: the map must scroll like butter):
//   paintFarmBand  the ground, fields, patches, pond water, the dirt road with its fence, trees, the farmhouse...
//                  painted ONCE into the band's cached canvas (mapscene.js bandCanvas)
//   landmark sprites  each landmark body painted ONCE into its own small canvas, stamped every frame (so a press
//                  can squash it like a button) plus its few moving bits (windmill sails)
//   drawFarmLive   the creatures and small life, every frame, only what is on screen. Pure functions of the clock:
//                  no state, no allocation in the loops, no gradients made per frame, no shadowBlur.
// Reduced motion (calm): everything holds still.
import { drawRooster, roosterPose, drawGoose, goosePose } from './allies.js';
import { freeCanvas } from './cvfree.js';
import { drawChick } from './characters.js';
import { drawThief, thiefPose } from './thieves.js';
import { bossOf } from '../road.js'; // 0.8.17: the boss stop of a world (its chest stands beside it)

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const fract = (x) => x - Math.floor(x);
function rng(seed) { let s = (seed * 9301 + 49297) % 233280 || 1; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }

// ------------------------------------------------------------------ colour
const RGB = new Map();
function rgb(h) { let v = RGB.get(h); if (!v) { const n = parseInt(h.slice(1), 16); v = [n >> 16, (n >> 8) & 255, n & 255]; RGB.set(h, v); } return v; }
function mix(a, b, k) { const A = rgb(a), B = rgb(b); return `rgb(${Math.round(A[0] + (B[0] - A[0]) * k)},${Math.round(A[1] + (B[1] - A[1]) * k)},${Math.round(A[2] + (B[2] - A[2]) * k)})`; }
function mixA(a, b, k, al) { const A = rgb(a), B = rgb(b); return `rgba(${Math.round(A[0] + (B[0] - A[0]) * k)},${Math.round(A[1] + (B[1] - A[1]) * k)},${Math.round(A[2] + (B[2] - A[2]) * k)},${al})`; }
const dk = (h, k = 0.35) => mix(h, '#2a1a0c', k); // a darker shade of a fill: outlines and shaded faces
const lt = (h, k = 0.3) => mix(h, '#fff6da', k); // warm late-afternoon light
function lg(c, x0, y0, x1, y1, cols) { const g = c.createLinearGradient(x0, y0, x1, y1); cols.forEach((s, i) => g.addColorStop(i / (cols.length - 1), s)); return g; }
function rg(c, x, y, r0, r1, cols) { const g = c.createRadialGradient(x, y, r0, x, y, r1); cols.forEach((s, i) => g.addColorStop(i / (cols.length - 1), s)); return g; }

// the farm's palette
const P = {
  g0: '#b9dc78', g1: '#9fcd62', g2: '#84bb4e', g3: '#6aa53f', g4: '#4f8a33', gInk: '#3c6e28',
  straw: '#f1c55a', strawHi: '#fbe39a', strawLo: '#c8923a', strawInk: '#8a5a22',
  red: '#c8412f', redHi: '#de5a43', redLo: '#962d22', redInk: '#5e1a12',
  wood: '#c08a55', woodHi: '#d9a874', woodLo: '#8e6038', woodInk: '#5a3a1e',
  cream: '#f3e6c6', creamLo: '#d5c29c',
  slate: '#6a7684', slateHi: '#8592a0', slateLo: '#4c5662',
  water: '#4fa6cf', waterHi: '#9fdcf0', waterLo: '#2f7aa8', waterInk: '#2a5f7e',
  dirt: '#d8b07a', dirtHi: '#e9cd9c', dirtLo: '#b3874f', dirtInk: '#8a6236',
  stone: '#b8ad9a', stoneLo: '#8b8170',
  shadow: 'rgba(38,62,18,0.30)', shadowSoft: 'rgba(38,62,18,0.16)',
};

// ------------------------------------------------------------------ small painting kit (unit space: c is scaled)
function poly(c, pts) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); }
function fillPoly(c, pts, fill, ink, lw) { poly(c, pts); c.fillStyle = fill; c.fill(); if (ink) { c.strokeStyle = ink; c.lineWidth = lw || 1.2; c.lineJoin = 'round'; c.stroke(); } }
function ell(c, x, y, rx, ry, fill) { c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, TAU); c.fillStyle = fill; c.fill(); }
// a soft contact shadow (painted once): a radial fade squashed to an ellipse
function softShadow(c, x, y, rx, ry, a = 0.32) {
  c.save(); c.translate(x, y); c.scale(1, ry / rx);
  c.fillStyle = rg(c, 0, 0, 0, rx, [`rgba(34,56,14,${a})`, `rgba(34,56,14,${a * 0.6})`, 'rgba(34,56,14,0)']);
  c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill(); c.restore();
}
// the cast shadow of something wide x0..x1 and `len` tall, thrown to the right by the low afternoon sun: soft, flat
function longShadow(c, x0, x1, len, a = 0.26) { softShadow(c, (x0 + x1) / 2 + len * 0.42, -len * 0.05, (x1 - x0) / 2 + len * 0.42, 9 + len * 0.07, a); }
// a smooth closed blob through points
function blobPath(c, pts) {
  const n = pts.length / 2; c.beginPath();
  const mx = (i) => (pts[(2 * i) % (2 * n)] + pts[(2 * i + 2) % (2 * n)]) / 2, my = (i) => (pts[(2 * i + 1) % (2 * n)] + pts[(2 * i + 3) % (2 * n)]) / 2;
  c.moveTo(mx(n - 1), my(n - 1));
  for (let i = 0; i < n; i++) c.quadraticCurveTo(pts[2 * i], pts[2 * i + 1], mx(i), my(i));
  c.closePath();
}
// an organic blob around (x, y): n lobes, radius rx/ry with seeded wobble
function wobble(x, y, rx, ry, n, amt, seed) { const R = rng(seed), out = []; for (let i = 0; i < n; i++) { const a = (i / n) * TAU, k = 1 + (R() - 0.5) * 2 * amt; out.push(x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k); } return out; }

// grass tuft: a few blades, two tones (unit space)
function tuft(c, x, y, s, dark, light, R) {
  const n = 4 + Math.floor(R() * 3);
  for (let i = 0; i < n; i++) {
    const a = -1.1 + (i / (n - 1)) * 2.2 + (R() - 0.5) * 0.3, h = s * (0.7 + R() * 0.6), bx = x + (i - n / 2) * s * 0.18;
    c.beginPath(); c.moveTo(bx - s * 0.09, y); c.quadraticCurveTo(bx + Math.sin(a) * h * 0.3, y - h * 0.6, bx + Math.sin(a) * h * 0.7, y - h); c.quadraticCurveTo(bx + Math.sin(a) * h * 0.25 + s * 0.06, y - h * 0.5, bx + s * 0.09, y); c.closePath();
    c.fillStyle = i % 2 ? light : dark; c.fill();
  }
}
function flower(c, x, y, r, col, mid) { for (let p = 0; p < 5; p++) { const a = p * 1.2566 - 1.57; ell(c, x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.5, r * 0.5, r * 0.4, col); } ell(c, x, y, r * 0.36, r * 0.3, mid); }

// ------------------------------------------------------------------ the plan: where every landmark and prop goes
// Landmarks (bottom to top, one per stop). Extents in design units (1 = L.u): x0/x1 left/right of the foot point,
// top above it; tap = the touch box (also design units, relative to the foot); pref = the side of the road it sits on;
// gap = space kept from the road edge; dy = the foot below the stop; rows = how much of its height must keep off the road.
const LMS = [
  { kind: 'coop', name: 'Hen House', pref: 1, x0: -66, x1: 74, top: 150, gap: 6, dy: 4, rows: 1, tap: [-62, -146, 72, 6] },
  { kind: 'hay', name: 'Haystacks', pref: -1, x0: -54, x1: 56, top: 128, gap: 4, dy: -8, rows: 1, tap: [-54, -112, 54, 6] },
  { kind: 'pond', name: 'Duck Pond', pref: -1, x0: -104, x1: 100, top: 82, gap: 6, dy: 6, rows: 1, tap: [-100, -78, 100, 6] },
  { kind: 'mill', name: 'Windmill', pref: 1, sc0: 0.9, x0: -50, x1: 50, top: 222, gap: 8, dy: 100, rows: 1, tap: [-40, -150, 40, 8] },
  { kind: 'barn', name: 'Big Red Barn', pref: 1, x0: -66, x1: 72, top: 178, gap: 6, dy: 0, beside: 1, rows: 1, tap: [-64, -124, 72, 6] },
];
export const FARM_LANDMARKS = LMS;
const PLQ = { w: 60, h: 52, post: 20 }; // the plaque board (design units): board above a short post

// the road's extreme x over map rows y0..y1 (s > 0: the rightmost edge, s < 0: the leftmost)
function roadEdge(L, y0, y1, s) { let e = s > 0 ? -Infinity : Infinity; for (let y = y0; y <= y1 + 0.1; y += 4) { const x = L.pathX(y); e = s > 0 ? Math.max(e, x) : Math.min(e, x); } return e + s * L.roadW * 0.5; }

export function farmPlan(L) {
  if (L._farm) return L._farm;
  const plan = planStops(L, 0, LMS);
  plan.props = planProps(L, plan);
  return (L._farm = plan);
}
// 0.8.10: the landmark planner is shared by every world painted as a place (mapcave.js uses it too): world w's five
// stops, each landmark S (the LMS shape above) placed off the road beside its plaque, clear of the sign above.
// 0.8.17 (six stops a world): slots[i] = the stop (0 .. L.per - 1 in the world) landmark i stands by. The Farm's five stand
// by its first five; in the other worlds the new level is the fourth, so their landmarks keep the old five (SLOTS_4TH).
export const SLOTS_4TH = [0, 1, 2, 4, 5];
// 0.8.17: where a boss's treasure chest stands (main.js drawMap draws it; planStops keeps the plaques clear of it): beside
// the boss stop on the outer side, unless the screen edge or a neighbouring stop (six a band sit closer) is in the way.
// -> { x, y (its centre, map space), r (the room kept round the boss stop), cr (the chest's half size) }
export function chestSpot(L, i, A, u) {
  const st = L.stops[i], r = Math.max(L.stopR * 1.2, 46 * u), cr = Math.min(L.stopR * 1.14, 34 * u), side = st.x < A.x + A.w / 2 ? -1 : 1, d = r + cr * 1.25, y = st.y - r * 0.15;
  const fits = (cx) => cx - cr >= A.x + 4 * u && cx + cr <= A.x1 - 4 * u;
  const near = (cx) => [i - 1, i + 1].map((j) => L.stops[j]).filter((q) => q && Math.abs(q.x - cx) <= cr + L.stopR * 1.3);
  const clear = (cx, cy) => near(cx).every((q) => q.y - L.stopR * 1.9 > cy + cr * 0.9 || q.y + L.stopR * 1.3 < cy - cr);
  const a = st.x + side * d, b = st.x - side * d;
  if (fits(a) && clear(a, y)) return { x: a, y, r, cr };
  // a stop just below on that side (with the hen standing in it): lift the chest a little rather than cross the road
  const lift = Math.max(0, ...near(a).map((q) => y + cr * 0.9 - (q.y - L.stopR * 1.9) + 2 * u));
  if (fits(a) && lift <= cr * 1.2 && clear(a, y - lift)) return { x: a, y: y - lift, r, cr };
  return { x: fits(b) && clear(b, y) ? b : fits(a) ? a : b, y, r, cr };
}
export function planStops(L, w, LMSw, slots = LMSw.map((_, i) => i)) {
  const u = L.u, A = L.A, top = L.bandTop(w), lms = [], i0 = w * (L.per || 5), n = LMSw.filter((_, i) => i0 + slots[i] < L.stops.length).length;
  // the plaques first (they only depend on the stops): on a post at the road side, beside the stop
  const plq = [];
  for (let i = 0; i < n; i++) {
    const st = L.stops[i0 + slots[i]], s = LMSw[i].pref, py = st.y + 54 * u, px = roadEdge(L, py - (PLQ.post + PLQ.h) * u, py, s) + s * (3 + PLQ.w / 2) * u;
    plq.push({ x: px, y: py, board: { x: px - (PLQ.w / 2) * u, y: py - (PLQ.post + PLQ.h) * u, w: PLQ.w * u, h: PLQ.h * u } });
  }
  const sign2 = L.nw > w + 1 ? signBox(L, w + 1) : null;
  const hitsPlaque = (i, x0, x1, y0, y1) => plq.some((q, j) => j !== i && x0 < q.board.x + q.board.w && x1 > q.board.x && y0 < q.y && y1 > q.board.y);
  const hitsRoad = (x0, x1, y0, y1) => { for (let y = y0; y <= y1 + 0.1; y += 4) { const x = L.pathX(y); if (x + L.roadW * 0.5 > x0 && x - L.roadW * 0.5 < x1) return true; } return false; };
  const hitsLm = (x0, x1, y0, y1) => lms.some((m) => { const r = lmArt(m), k = 10 * u; return x0 < r.x1 - k && x1 > r.x0 + k && y0 < r.y1 - k && y1 > r.y0 + k; });
  // the boss's chest (main.js drawMap draws it where chestSpot says)
  const bs = L.stops[bossOf(w) - 1], ch = bs ? chestSpot(L, bossOf(w) - 1, A, u) : null, cr = ch ? ch.cr : 0, cR = ch ? ch.r : 0, chX = ch ? ch.x : 0;
  const hitsChest = (x0, x1, y0, y1) => !!ch && x0 < chX + cr && x1 > chX - cr && y0 < ch.y + cR * 0.15 + cr * 1.4 && y1 > ch.y - cr;
  for (let i = 0; i < n; i++) {
    const S = LMSw[i], st = L.stops[i0 + slots[i]];
    let best = null;
    for (const s of [S.pref, -S.pref]) {
      for (const [sc, ddy] of S.tries || [[1, 0], [1, 14], [0.92, 14], [0.92, 28], [0.85, 30], [0.85, 44]]) { // S.tries: a landmark's own list of sizes and drops
        const d = u * sc * (S.sc0 || 1), fy = st.y + (S.dy + ddy) * u, y0 = fy - S.top * S.rows * d, sl = (S.x1 - S.x0) * d * 0.1;
        // start against the road and walk outward until it is clear of the road and the other plaques
        for (let k = 0; k < 80 && !best; k++) {
          const base = S.beside ? (s > 0 ? plq[i].board.x + plq[i].board.w - 12 * u : plq[i].board.x + 12 * u) : L.pathX(st.y) + s * L.roadW * 0.5; // beside: its front stays clear of its own plaque
          const x = base + s * (S.gap * d + k * 8 * u) - (s > 0 ? S.x0 : S.x1) * d;
          const bx0 = x + S.x0 * d, bx1 = x + S.x1 * d;
          if (bx0 < A.x - sl || bx1 > A.x1 + sl) break;
          if (hitsRoad(bx0 - S.gap * d * 0.5, bx1 + S.gap * d * 0.5, y0, fy + 4 * u)) continue;
          if (hitsPlaque(i, bx0, bx1, fy - S.top * d, fy + 6 * d)) continue;
          if (sign2 && bx0 < sign2.x1 && bx1 > sign2.x0 && fy - S.top * d * 0.86 < sign2.y1) continue; // the next world's sign stands just above
          if (hitsLm(bx0, bx1, fy - S.top * d * 0.86, fy) || hitsChest(bx0, bx1, fy - S.top * d, fy)) continue; // 0.8.17: six stops a band sit closer; keep clear of the landmarks placed below
          best = { x, y: fy, d, sc, side: s, flip: s !== S.pref };
        }
        if (best) break;
      }
      if (best) break;
    }
    if (!best) best = { x: st.x + S.pref * 120 * u, y: st.y + S.dy * u, d: u * 0.85, sc: 0.85, side: S.pref, flip: false };
    const s = best.side, d = best.d;
    if (s !== S.pref) { const px = roadEdge(L, plq[i].board.y, plq[i].y, s) + s * (3 + PLQ.w / 2) * u; plq[i].x = px; plq[i].board.x = px - (PLQ.w / 2) * u; }
    const px = plq[i].x, py = plq[i].y, pb = plq[i].board;
    const fx = (v) => (best.flip ? -v : v);
    let tx0 = best.x + Math.min(fx(S.tap[0]), fx(S.tap[2])) * d, tx1 = best.x + Math.max(fx(S.tap[0]), fx(S.tap[2])) * d;
    let ty0 = best.y + S.tap[1] * d, ty1 = best.y + S.tap[3] * d;
    // the plaque is part of the button when it touches the landmark; else the button is the landmark alone (the plaque is drawn)
    if (pb.x < tx1 + 30 * u && pb.x + pb.w > tx0 - 30 * u) { tx0 = Math.min(tx0, pb.x); tx1 = Math.max(tx1, pb.x + pb.w); ty0 = Math.min(ty0, pb.y); ty1 = Math.max(ty1, py + 2 * u); }
    tx0 = Math.max(tx0, A.x); tx1 = Math.min(tx1, A.x1);
    lms.push({ i, gi: i0 + slots[i], S, kind: S.kind, x: best.x, y: best.y, d, side: s, flip: best.flip, plaque: { x: px, y: py, board: pb }, tap: { x0: tx0, y0: ty0, x1: tx1, y1: ty1 }, hen: { x: st.x - s * 6 * u, y: st.y, face: s } });
  }
  // touch boxes never overlap: the nearer (lower) landmark gives up the top of its box where the one above sits
  for (let i = 0; i < lms.length; i++) for (let j = i + 1; j < lms.length; j++) {
    const a = lms[i].tap, b = lms[j].tap;
    if (a.x0 < b.x1 + 2 * u && a.x1 > b.x0 - 2 * u && a.y0 < b.y1 + 2 * u && a.y1 > b.y0 - 2 * u) {
      if (a.y1 - (b.y1 + 3 * u) >= 72 * u) a.y0 = b.y1 + 3 * u; else b.y1 = Math.max(b.y0 + 72 * u, a.y0 - 3 * u);
    }
  }
  return { lms, top, u, w };
}

// the still props and the cast's homes. Positions are designed on a phone (420 units wide, the band ~670 tall) and
// given as fractions of the safe width and the band height; each is nudged off the road and the landmarks, or left out.
const PROPS = [
  // kind, fx, fy, size (units), extra
  ['farmhouse', 0.17, 0.36, 1],
  ['washing', 0.46, 0.355, 1],
  ['wheat', 0.88, 0.62, 1],
  ['scarecrow', 0.9, 0.57, 1],
  ['veg', 0.84, 0.95, 1],
  ['plough', 0.12, 0.08, 1],
  ['tree', 0.95, 0.66, 0.9, {}],
  ['bush', 0.36, 0.06, 0.8],
  ['barrow', 0.5, 0.6, 1],
  ['chicks', 0.12, 0.84, 1],
  ['roosterPost', 0.9, 0.79, 1],
];
const PBOX = { // half width, height (units) of each prop's box
  farmhouse: [62, 120], washing: [46, 52], wheat: [52, 70], scarecrow: [18, 66], veg: [56, 40], plough: [56, 46], tree: [44, 120], bush: [26, 30], chicks: [56, 36], roosterPost: [20, 70], barrow: [30, 30],
};
function planProps(L, plan) {
  const u = L.u, A = L.A, top = plan.top, BH = L.BH, out = [];
  const boxes = plan.lms.map((m) => lmArt(m));
  const kinds = [];
  const roadHit = (x0, x1, y0, y1) => { for (let y = y0; y <= y1 + 0.1; y += 6) { const x = L.pathX(y); if (x + L.roadW * 0.5 + 4 * u > x0 && x - L.roadW * 0.5 - 4 * u < x1) return true; } return false; };
  const sign = signBox(L);
  for (const e of PROPS) {
    const [k, fx, fy, sz, o] = e, hw = PBOX[k][0] * u * sz, h = PBOX[k][1] * u * sz;
    let got = null;
    for (let r = 0; r <= 6 && !got; r++) {
      for (const [dx, dy] of r ? [[r, 0], [-r, 0], [0, -r], [0, r], [r, -r], [-r, -r], [r, r], [-r, r]] : [[0, 0]]) {
        const x = A.x + fx * A.w + dx * 10 * u, y = top + fy * BH + dy * 8 * u;
        const b = { x0: x - hw, x1: x + hw, y0: y - h, y1: y + 2 * u };
        if (b.x0 < A.x - hw * 0.5 || b.x1 > A.x1 + hw * 0.5) continue;
        if (b.y0 < top - 30 * u || b.y1 > top + BH) continue;
        if (roadHit(b.x0, b.x1, b.y0, b.y1)) continue;
        if (boxes.some((q, j) => !(k === 'scarecrow' && kinds[j] === 'wheat') && b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0)) continue;
        if (b.x0 < sign.x1 && b.x1 > sign.x0 && b.y0 < sign.y1 && b.y1 > sign.y0) continue;
        got = { k, x, y, s: sz, o: o || {}, box: b }; break;
      }
    }
    if (got) { out.push(got); if (k !== 'washing') { boxes.push(got.box); kinds[boxes.length - 1] = k; } }
  }
  return out;
}
export function signBox(L, w = 0) { const y = L.bandTop(w) + L.BH * 0.955, u = L.u, x = L.pathX(y), bw = 170 * u, s = x < L.cx ? 1 : -1, cx = clamp(x + s * (bw / 2 + L.roadW), L.A.x + bw / 2 + 6 * u, L.A.x1 - bw / 2 - 6 * u); return { x0: cx - bw / 2, x1: cx + bw / 2, y0: y - 40 * u, y1: y + 24 * u }; }
// a landmark's painted box in map coordinates
export function lmArt(m) { const S = m.S, d = m.d, a = m.flip ? -S.x1 : S.x0, b = m.flip ? -S.x0 : S.x1; return { x0: m.x + a * d, x1: m.x + b * d, y0: m.y - S.top * d, y1: m.y + 8 * d }; }
export function farmStop(L, i) { const p = farmPlan(L); return p.lms[i] || null; }
export { PLQ, roadEdge };

// ------------------------------------------------------------------ the band, painted once
// c: the band canvas context, already translated so that map y (L coordinates) is drawn at y - top + E
export function paintFarmBand(c, L, E) {
  const u = L.u, W = L.W, BH = L.BH, top = L.bandTop(0), plan = farmPlan(L), A = L.A;
  // the crest line on top (the same wave the other bands use), then the ground
  const R0 = rng(0 * 31 + 5), ph = R0() * TAU, ph2 = R0() * TAU;
  const crest = (x) => E * 0.5 + Math.sin((x / W) * TAU * 1.3 + ph) * E * 0.28 + Math.sin((x / W) * TAU * 3.1 + ph2) * E * 0.12;
  c.save();
  c.beginPath(); c.moveTo(0, BH + E); for (let x = 0; x <= W + 8; x += 8) c.lineTo(x, crest(x)); c.lineTo(W, BH + E); c.closePath();
  c.fillStyle = lg(c, 0, E * 0.2, 0, BH + E, [P.g0, P.g1, P.g2, P.g3]); c.fill();
  c.save(); c.clip();
  c.translate(0, E - top); // map coordinates from here on
  const Y = (f) => top + f * BH, X = (f) => A.x + f * A.w;
  // rolling fields: overlapping soft shapes in related greens, each with a darker edge below and a lit rim above
  const fields = [
    [X(0.2), Y(0.3), A.w * 0.48, BH * 0.2, P.g1, 3],
    [X(0.85), Y(0.18), A.w * 0.42, BH * 0.18, P.g0, 7],
    [X(0.78), Y(0.58), A.w * 0.4, BH * 0.16, P.g1, 11],
    [X(0.22), Y(0.74), A.w * 0.5, BH * 0.17, P.g0, 13],
    [X(0.6), Y(0.98), A.w * 0.6, BH * 0.14, P.g1, 17],
  ];
  for (const [fx, fy, rx, ry, col, sd] of fields) {
    const pts = wobble(fx, fy, rx, ry, 9, 0.12, sd);
    c.save(); c.translate(0, 7 * u); blobPath(c, pts); c.fillStyle = 'rgba(52,96,30,0.22)'; c.fill(); c.restore();
    c.save(); c.translate(0, 3 * u); blobPath(c, pts); c.fillStyle = 'rgba(52,96,30,0.18)'; c.fill(); c.restore();
    blobPath(c, pts); c.fillStyle = lg(c, fx - rx, fy - ry, fx + rx * 0.4, fy + ry, [lt(col, 0.18), col, mix(col, P.g2, 0.5)]); c.fill();
    // mown stripes on the two big fields
    if (sd === 3 || sd === 13) { c.save(); blobPath(c, pts); c.clip(); c.fillStyle = 'rgba(255,255,220,0.07)'; for (let k = -6; k < 8; k += 2) { c.beginPath(); c.moveTo(fx - rx + k * 22 * u, fy - ry); c.lineTo(fx - rx + (k + 1) * 22 * u, fy - ry); c.lineTo(fx - rx + (k + 1) * 22 * u + ry * 0.9, fy + ry); c.lineTo(fx - rx + k * 22 * u + ry * 0.9, fy + ry); c.closePath(); c.fill(); } c.restore(); }
  }
  // the warm light from the upper left, a touch of shade lower right
  c.fillStyle = rg(c, A.x + A.w * 0.1, top + BH * 0.1, 0, Math.max(A.w, BH) * 0.9, ['rgba(255,236,170,0.16)', 'rgba(255,236,170,0)']); c.fillRect(0, top - E, W, BH + E);
  c.fillStyle = lg(c, 0, top + BH * 0.6, 0, top + BH, ['rgba(30,60,20,0)', 'rgba(30,60,20,0.12)']); c.fillRect(0, top + BH * 0.6, W, BH * 0.4);
  // ground under the landmarks: worn earth where the animals walk, the windmill's rise, the pond
  for (const m of plan.lms) groundFor(c, m, u);
  // patches (ploughed, vegetables, wheat) under the road
  const props = plan.props;
  for (const p of props) if (p.k === 'plough' || p.k === 'veg' || p.k === 'wheat') patch(c, p, u);
  // the road
  farmRoad(c, L, plan);
  // drifts of tufts and flowers
  drifts(c, L, plan);
  // the props, far to near
  const list = props.filter((p) => !(p.k === 'plough' || p.k === 'veg' || p.k === 'wheat' || p.k === 'chicks')).sort((a, b) => a.y - b.y);
  for (const p of list) { try { prop(c, p, u); } catch (_) { /* a prop never breaks the map */ } }
  c.restore();
  // the soft lit rim along the crest
  c.beginPath(); for (let x = 0; x <= W + 8; x += 8) { const y = crest(x); if (x === 0) c.moveTo(x, y); else c.lineTo(x, y); }
  c.strokeStyle = 'rgba(255,250,210,0.45)'; c.lineWidth = 3 * u; c.stroke();
  c.restore();
}

function groundFor(c, m, u) {
  const d = m.d, x = m.x, y = m.y;
  if (LM_SHADOW[m.kind]) { c.save(); c.translate(x, y); c.scale(m.flip ? -d : d, d); LM_SHADOW[m.kind](c); c.restore(); }
  if (m.kind === 'coop') { // a worn yard in front of the coop
    blobPath(c, wobble(x - 6 * d, y + 2 * d, 70 * d, 20 * d, 10, 0.18, 21)); c.fillStyle = mixA(P.dirt, P.g2, 0.35, 0.55); c.fill();
    blobPath(c, wobble(x - 10 * d, y + 2 * d, 48 * d, 12 * d, 9, 0.2, 22)); c.fillStyle = mixA(P.dirt, P.g2, 0.15, 0.55); c.fill();
  } else if (m.kind === 'barn') {
    blobPath(c, wobble(x - 10 * d, y + 4 * d, 70 * d, 16 * d, 10, 0.18, 23)); c.fillStyle = mixA(P.dirt, P.g2, 0.3, 0.6); c.fill();
  } else if (m.kind === 'mill') { // a small grassy rise
    const rx = 70 * d, ry = 22 * d;
    c.save(); c.translate(0, 5 * d); ell(c, x + 4 * d, y - 4 * d, rx, ry, 'rgba(52,96,30,0.28)'); c.restore();
    c.beginPath(); c.ellipse(x, y - 6 * d, rx, ry, 0, 0, TAU); c.fillStyle = lg(c, x - rx, y - 6 * d - ry, x + rx * 0.5, y + ry, [lt(P.g0, 0.3), P.g1, P.g2]); c.fill();
  } else if (m.kind === 'hay') {
    blobPath(c, wobble(x, y + 2 * d, 66 * d, 14 * d, 9, 0.2, 24)); c.fillStyle = mixA(P.strawLo, P.g2, 0.45, 0.45); c.fill();
  } else if (m.kind === 'pond') pondWater(c, m);
}

// the pond's water (in the ground: flat); the reeds and the jetty are in the landmark sprite
function pondShape(m) { const d = m.d; return wobble(m.x - 4 * d, m.y - 36 * d, 92 * d, 30 * d, 12, 0.08, 31); }
function pondWater(c, m) {
  const d = m.d, x = m.x - 4 * d, y = m.y - 36 * d, pts = pondShape(m);
  // the muddy bank, then a band of shallows, then the deep
  c.save(); c.translate(0, 4 * d); c.scale(1, 1); blobPath(c, pts.map((v, i) => (i % 2 ? y + (v - y) * 1.12 : x + (v - x) * 1.06))); c.fillStyle = mixA(P.dirtLo, P.g3, 0.3, 0.9); c.fill(); c.restore();
  blobPath(c, pts.map((v, i) => (i % 2 ? y + (v - y) * 1.08 : x + (v - x) * 1.04))); c.fillStyle = mix(P.dirt, P.g2, 0.35); c.fill();
  blobPath(c, pts); c.fillStyle = lg(c, x, y - 30 * d, x, y + 30 * d, [P.waterLo, P.water, mix(P.water, P.waterHi, 0.35)]); c.fill();
  c.save(); blobPath(c, pts); c.clip();
  // the far bank's shade on the water, the sky's sheen
  c.fillStyle = 'rgba(20,60,80,0.28)'; blobPath(c, pts.map((v, i) => (i % 2 ? v - 16 * d : v))); c.fill('evenodd');
  c.fillStyle = 'rgba(30,70,90,0.22)'; c.beginPath(); c.ellipse(x, y - 30 * d, 100 * d, 12 * d, 0, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(220,248,255,0.55)'; c.lineCap = 'round';
  for (const [a, b, w2, yy] of [[-60, -20, 2.2, 6], [-10, 30, 1.6, 12], [-44, -30, 1.4, 18], [36, 60, 1.6, -2]]) { c.lineWidth = w2 * d; c.beginPath(); c.moveTo(x + a * d, y + yy * d); c.lineTo(x + b * d, y + yy * d); c.stroke(); }
  c.restore();
  // a lit lip along the near bank
  c.save(); blobPath(c, pts); c.strokeStyle = 'rgba(40,90,120,0.55)'; c.lineWidth = 1.6 * d; c.stroke(); c.restore();
  // lily pads with a flower or two
  for (const [dx, dy, r, fl] of [[-62, 4, 9, 1], [-48, 14, 7, 0], [-30, -8, 6, 0], [48, -10, 8, 1], [60, 2, 6, 0]]) lilyPad(c, x + dx * d, y + dy * d, r * d, fl);
}
function lilyPad(c, x, y, r, fl) {
  c.beginPath(); c.ellipse(x, y + r * 0.12, r, r * 0.5, 0, 0, TAU); c.fillStyle = 'rgba(20,60,70,0.3)'; c.fill();
  c.beginPath(); c.ellipse(x, y, r, r * 0.48, 0, 0.35, TAU - 0.05); c.lineTo(x, y); c.closePath(); c.fillStyle = lg(c, x - r, y - r * 0.5, x + r, y + r * 0.5, ['#8fcf5a', '#4f9a3a']); c.fill();
  c.strokeStyle = 'rgba(40,90,30,0.6)'; c.lineWidth = r * 0.08; c.stroke();
  if (fl) { for (let p = 0; p < 6; p++) { const a = (p / 6) * TAU; c.beginPath(); c.ellipse(x - r * 0.2 + Math.cos(a) * r * 0.22, y - r * 0.32 + Math.sin(a) * r * 0.1, r * 0.2, r * 0.12, a, 0, TAU); c.fillStyle = p % 2 ? '#ffd0dc' : '#f7a6bd'; c.fill(); } ell(c, x - r * 0.2, y - r * 0.34, r * 0.1, r * 0.07, '#ffe27a'); }
}

// ploughed earth, a vegetable plot, a wheat patch
function patch(c, p, u) {
  const { x, y } = p, s = p.s * u;
  if (p.k === 'plough') {
    const w = 104 * s, h = 40 * s, sk = 20 * s; // a slanted plot
    const pts = [x - w / 2 + sk, y - h, x + w / 2 + sk, y - h, x + w / 2, y, x - w / 2, y];
    c.save(); c.translate(0, 3 * s); fillPoly(c, pts, 'rgba(52,96,30,0.3)'); c.restore();
    fillPoly(c, pts, lg(c, x, y - h, x, y, ['#9a6a3e', '#7e5230']));
    c.save(); poly(c, pts); c.clip(); c.lineCap = 'round';
    for (let k = 0; k < 7; k++) { const yy = y - h + (k + 0.5) * (h / 7); c.beginPath(); c.moveTo(x - w / 2 - 4 * s, yy + 4 * s); c.quadraticCurveTo(x, yy - 5 * s, x + w / 2 + sk + 4 * s, yy + 2 * s); c.strokeStyle = 'rgba(60,36,16,0.5)'; c.lineWidth = 3.2 * s; c.stroke(); c.beginPath(); c.moveTo(x - w / 2 - 4 * s, yy + 2.4 * s); c.quadraticCurveTo(x, yy - 6.6 * s, x + w / 2 + sk + 4 * s, yy + 0.4 * s); c.strokeStyle = 'rgba(200,150,95,0.45)'; c.lineWidth = 1.4 * s; c.stroke(); }
    c.restore();
    poly(c, pts); c.strokeStyle = 'rgba(70,50,20,0.35)'; c.lineWidth = 1 * s; c.stroke();
  } else if (p.k === 'veg') {
    const w = 104 * s, h = 34 * s;
    const pts = [x - w / 2 + 10 * s, y - h, x + w / 2 + 10 * s, y - h, x + w / 2, y, x - w / 2, y];
    c.save(); c.translate(0, 3 * s); fillPoly(c, pts, 'rgba(52,96,30,0.3)'); c.restore();
    fillPoly(c, pts, lg(c, x, y - h, x, y, ['#a2703f', '#86572f']));
    for (let r = 0; r < 3; r++) for (let k = 0; k < 6; k++) {
      const yy = y - h + (r + 0.6) * (h / 3), xx = x - w / 2 + 10 * s * (1 - (yy - (y - h)) / h) + (k + 0.6) * (w / 6.4);
      if (r === 1) { // carrot tops
        c.strokeStyle = '#5aa63a'; c.lineWidth = 1.6 * s; c.lineCap = 'round'; for (const a of [-0.5, 0, 0.5]) { c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx + Math.sin(a) * 6 * s, yy - 7 * s); c.stroke(); }
        ell(c, xx, yy + 0.5 * s, 2.4 * s, 1.4 * s, '#f08a2a');
      } else { // cabbages
        ell(c, xx + 1 * s, yy + 1.4 * s, 6 * s, 2.4 * s, 'rgba(40,40,10,0.3)');
        ell(c, xx, yy - 1.5 * s, 6 * s, 4.6 * s, '#6fb24a'); ell(c, xx - 1.2 * s, yy - 2.6 * s, 3.6 * s, 2.8 * s, '#a6dc78'); c.strokeStyle = 'rgba(50,100,30,0.6)'; c.lineWidth = 0.8 * s; c.beginPath(); c.moveTo(xx, yy - 6 * s); c.lineTo(xx + 1 * s, yy + 2 * s); c.stroke();
      }
    }
    // a low fence along the front
    fenceRun(c, [[x - w / 2 - 4 * s, y + 4 * s], [x + w / 2 + 2 * s, y + 4 * s]], s * 0.8);
  } else if (p.k === 'wheat') {
    const w = 96 * s, h = 54 * s, sk = 14 * s;
    const pts = [x - w / 2 + sk, y - h, x + w / 2 + sk, y - h, x + w / 2, y, x - w / 2, y];
    c.save(); c.translate(3 * s, 4 * s); fillPoly(c, pts, 'rgba(52,96,30,0.3)'); c.restore();
    fillPoly(c, pts, lg(c, x, y - h, x, y, ['#e9b94e', '#c88f34']));
    // rows of stalks, back to front: stems, then the heads lit from the upper left
    const R = rng(43); c.lineCap = 'round';
    for (let r = 0; r < 7; r++) {
      const yy = y - h + 6 * s + r * (h - 6 * s) / 6.4, k = (yy - (y - h)) / h, xa = x - w / 2 + sk * (1 - k), xb = xa + w;
      for (let xx = xa + 2 * s; xx < xb - 1 * s; xx += 3.2 * s) {
        const l = (9 + R() * 4) * s, lean = (R() - 0.3) * 2 * s;
        c.strokeStyle = 'rgba(150,100,30,0.6)'; c.lineWidth = 0.9 * s; c.beginPath(); c.moveTo(xx, yy + 6 * s); c.lineTo(xx + lean, yy - l + 6 * s); c.stroke();
        c.save(); c.translate(xx + lean, yy - l + 5 * s); c.rotate(0.15 + lean / (8 * s));
        c.beginPath(); c.ellipse(0, -2 * s, 1.6 * s, 3.6 * s, 0, 0, TAU); c.fillStyle = R() < 0.35 ? '#f8dc8a' : '#e9b24a'; c.fill();
        c.beginPath(); c.ellipse(-0.5 * s, -2.6 * s, 0.6 * s, 2 * s, 0, 0, TAU); c.fillStyle = 'rgba(255,248,210,0.7)'; c.fill();
        c.restore();
      }
    }
    // the cut edge at the front: a darker band of stubble
    c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x + w / 2, y); c.lineTo(x + w / 2 + 1 * s, y - 3 * s); c.lineTo(x - w / 2 + 1 * s, y - 3 * s); c.closePath(); c.fillStyle = 'rgba(120,80,20,0.4)'; c.fill();
  }
}

// a wooden fence along a polyline (map coords), posts every ~16 units
function fenceRun(c, pts, s) {
  const posts = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / (24 * s)));
    for (let k = 0; k < n + (i === pts.length - 2 ? 1 : 0); k++) posts.push([x0 + (x1 - x0) * (k / n), y0 + (y1 - y0) * (k / n)]);
  }
  // shadows, rails, posts
  c.lineCap = 'round';
  for (const [rh, wv] of [[-9, 2.6], [-4, 2.6]]) {
    c.beginPath(); posts.forEach(([x, y], k) => (k ? c.lineTo(x + 3 * s, y + 2 * s) : c.moveTo(x + 3 * s, y + 2 * s))); c.strokeStyle = 'rgba(40,60,20,0.18)'; c.lineWidth = 2.4 * s; if (rh === -4) c.stroke();
    c.beginPath(); posts.forEach(([x, y], k) => (k ? c.lineTo(x, y + rh * s) : c.moveTo(x, y + rh * s))); c.strokeStyle = P.woodInk; c.lineWidth = (wv + 1) * s; c.stroke();
    c.strokeStyle = P.wood; c.lineWidth = wv * s; c.stroke();
    c.beginPath(); posts.forEach(([x, y], k) => (k ? c.lineTo(x, y + (rh - 0.7) * s) : c.moveTo(x, y + (rh - 0.7) * s))); c.strokeStyle = P.woodHi; c.lineWidth = 0.9 * s; c.stroke();
  }
  for (const [x, y] of posts) {
    ell(c, x + 2 * s, y + 0.5 * s, 4 * s, 1.5 * s, 'rgba(40,60,20,0.25)');
    fillPoly(c, [x - 2.2 * s, y, x - 2.2 * s, y - 12 * s, x, y - 13.5 * s, x + 2.2 * s, y - 12 * s, x + 2.2 * s, y], P.wood, P.woodInk, 0.8 * s);
    fillPoly(c, [x + 0.5 * s, y - 0.3 * s, x + 0.5 * s, y - 12.6 * s, x + 2.2 * s, y - 12 * s, x + 2.2 * s, y], P.woodLo);
  }
}

// ------------------------------------------------------------------ the road: packed dirt, ruts, stones, a fence
function roadPts(L, y0, y1, off) { // an offset curve along the road (map coords): off > 0 to the road's right
  const out = [];
  for (let y = y0; y <= y1 + 0.1; y += 5) { const x = L.pathX(y), dx = (L.pathX(y + 1) - L.pathX(y - 1)) / 2, n = Math.hypot(1, dx); out.push(x + off / n, y - (off * dx) / n); }
  return out;
}
function strokeLine(c, pts) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); }
function farmRoad(c, L, plan) {
  const u = L.u, top = plan.top, rw = L.roadW, y0 = top - 70 * u, yEnd = L.stops[0].y + L.BH * 0.12;
  const mid = roadPts(L, y0, yEnd, 0);
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  // soft dark verge, then the packed dirt in three tones, light along the crown of the road
  strokeLine(c, mid); c.strokeStyle = 'rgba(60,70,20,0.16)'; c.lineWidth = rw + 14 * u; c.stroke();
  strokeLine(c, mid); c.strokeStyle = 'rgba(80,60,20,0.22)'; c.lineWidth = rw + 7 * u; c.stroke();
  strokeLine(c, mid); c.strokeStyle = P.dirtLo; c.lineWidth = rw + 3 * u; c.stroke();
  strokeLine(c, mid); c.strokeStyle = P.dirt; c.lineWidth = rw - 2 * u; c.stroke();
  strokeLine(c, roadPts(L, y0, yEnd, -2 * u)); c.strokeStyle = 'rgba(245,222,170,0.55)'; c.lineWidth = rw * 0.42; c.stroke();
  // wheel ruts: a dark groove with a lit lip
  for (const o of [-rw * 0.24, rw * 0.24]) {
    strokeLine(c, roadPts(L, y0, yEnd, o)); c.strokeStyle = 'rgba(140,96,48,0.45)'; c.lineWidth = 2.6 * u; c.stroke();
    strokeLine(c, roadPts(L, y0, yEnd, o - 1.6 * u)); c.strokeStyle = 'rgba(255,236,190,0.35)'; c.lineWidth = 1 * u; c.stroke();
  }
  // grass creeping over the edges, stones, pebbles
  const R = rng(57);
  for (let y = y0; y < yEnd; y += 7 * u) {
    const x = L.pathX(y), side = R() < 0.5 ? -1 : 1, e = x + side * (rw * 0.5 + (R() - 0.3) * 3 * u);
    if (R() < 0.55) tuft(c, e, y, (5 + R() * 4) * u, P.g3, P.g1, R);
    if (R() < 0.16) { const sx = x + (R() - 0.5) * rw * 0.8, sr = (1.6 + R() * 2.2) * u; ell(c, sx + 0.6 * u, sy(y) + 0.8 * u, sr, sr * 0.6, 'rgba(90,60,30,0.35)'); ell(c, sx, sy(y), sr, sr * 0.62, P.stone); ell(c, sx - sr * 0.3, sy(y) - sr * 0.25, sr * 0.45, sr * 0.25, '#e6dccb'); }
    if (R() < 0.3) { const sx = e + side * (2 + R() * 6) * u, sr = (2 + R() * 2.5) * u; ell(c, sx + 0.8 * u, y + 1 * u, sr * 1.1, sr * 0.6, 'rgba(40,60,20,0.3)'); ell(c, sx, y, sr, sr * 0.7, P.stone); ell(c, sx - sr * 0.3, y - sr * 0.3, sr * 0.5, sr * 0.3, '#e6dccb'); }
  }
  function sy(y) { return y; }
  // a wooden fence along stretches of the road, kept clear of the plaques and the landmarks
  const boxes = plan.lms.map((m) => { const b = m.plaque.board; return { x0: Math.min(b.x, m.tap.x0) - 6 * u, x1: Math.max(b.x + b.w, m.tap.x1) + 6 * u, y0: m.tap.y0, y1: m.plaque.y + 10 * u }; });
  const sign = signBox(L);
  for (const side of [-1, 1]) {
    let run = [];
    const flush = () => { if (run.length >= 4) { const pts = []; for (let i = 0; i < run.length; i += 2) pts.push([run[i], run[i + 1]]); fenceRun(c, pts, u); } run = []; };
    const pts = roadPts(L, top + 10 * u, yEnd - 10 * u, side * (rw * 0.5 + 9 * u));
    for (let i = 0; i < pts.length; i += 2) {
      const x = pts[i], y = pts[i + 1], yy = (y - top) / L.BH;
      const want = side > 0 ? (yy > 0.18 && yy < 0.3) || (yy > 0.6 && yy < 0.72) : (yy > 0.36 && yy < 0.47) || (yy > 0.78 && yy < 0.86);
      const blocked = boxes.some((b) => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1) || (x > sign.x0 && x < sign.x1 && y > sign.y0 && y < sign.y1) || x < L.A.x + 4 * u || x > L.A.x1 - 4 * u;
      if (want && !blocked) run.push(x, y); else flush();
    }
    flush();
  }
  c.restore();
}

// drifts of tufts and flowers: gathered in clumps around a few spots, not sprinkled
function drifts(c, L, plan) {
  const u = L.u, A = L.A, top = plan.top, BH = L.BH, R = rng(71);
  const occupied = (x, y) => { const r = L.pathX(y); if (Math.abs(x - r) < L.roadW * 0.5 + 6 * u) return true; for (const m of plan.lms) { const b = lmArt(m); if (x > b.x0 && x < b.x1 && y > b.y0 + (b.y1 - b.y0) * 0.3 && y < b.y1) return true; } return false; };
  const spots = [[0.05, 0.45], [0.42, 0.18], [0.58, 0.48], [0.95, 0.38], [0.3, 0.6], [0.66, 0.84], [0.02, 0.9], [0.92, 0.82], [0.4, 0.95], [0.75, 0.05], [0.25, 0.02]];
  for (const [fx, fy] of spots) {
    const cx = A.x + fx * A.w, cy = top + fy * BH, n = 7 + Math.floor(R() * 6);
    for (let k = 0; k < n; k++) { const x = cx + (R() - 0.5) * 70 * u, y = cy + (R() - 0.5) * 30 * u; if (!occupied(x, y)) tuft(c, x, y, (5 + R() * 5) * u, P.g3, P.g1, R); }
    const cols = R() < 0.5 ? ['#ffffff', '#fff4c0'] : ['#ffd84a', '#ffffff', '#f7a6bd'], nf = 5 + Math.floor(R() * 7);
    for (let k = 0; k < nf; k++) { const x = cx + (R() - 0.5) * 60 * u, y = cy + (R() - 0.5) * 24 * u; if (!occupied(x, y)) { c.strokeStyle = 'rgba(60,110,40,0.7)'; c.lineWidth = 0.8 * u; c.beginPath(); c.moveTo(x, y + 4 * u); c.lineTo(x, y); c.stroke(); flower(c, x, y, (2.4 + R() * 1.2) * u, cols[k % cols.length], '#f2b52a'); } }
  }
}

// ------------------------------------------------------------------ props (painted into the band)
function prop(c, p, u) {
  const s = p.s * u;
  c.save(); c.translate(p.x, p.y); c.scale(s, s);
  switch (p.k) {
    case 'tree': tree(c, p.o); break;
    case 'bush': bush(c); break;
    case 'farmhouse': farmhouse(c); break;
    case 'washing': washingPosts(c); break;
    case 'scarecrow': scarecrow(c); break;
    case 'roosterPost': fencePost(c); break;
    case 'barrow': barrow(c); break;
    default: break;
  }
  c.restore();
}
// a leafy tree with volume: trunk lit on the left, a crown of clusters lit from the upper left, shade lower right
function crownPath(c, lobes, grow = 0) { c.beginPath(); for (const [x, y, r] of lobes) { c.moveTo(x + r + grow, y); c.arc(x, y, r + grow, 0, TAU); } }
function tree(c, o = {}) {
  // cast shadow to the lower right, contact shadow
  longShadow(c, -22, 26, 70);
  softShadow(c, 2, 0, 22, 6, 0.4);
  // trunk
  c.beginPath(); c.moveTo(-8, 0); c.quadraticCurveTo(-4, -10, -5, -42); c.lineTo(5, -42); c.quadraticCurveTo(4, -10, 9, 0); c.quadraticCurveTo(0, 3, -8, 0); c.closePath();
  c.fillStyle = lg(c, -8, 0, 9, 0, ['#9a6a3e', '#7a4e2a', '#5a361a']); c.fill(); c.strokeStyle = '#4a2c14'; c.lineWidth = 1; c.stroke();
  c.strokeStyle = 'rgba(60,34,14,0.5)'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-1, -6); c.lineTo(-2, -30); c.moveTo(3, -12); c.lineTo(3, -34); c.stroke();
  // branches into the crown
  c.strokeStyle = '#6a4222'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(-2, -36); c.lineTo(-14, -52); c.moveTo(2, -38); c.lineTo(14, -54); c.stroke();
  const lobes = [[-22, -62, 20], [20, -64, 21], [0, -82, 25], [-16, -92, 18], [16, -94, 18], [0, -104, 16], [-28, -76, 15], [28, -78, 15], [0, -58, 20]];
  const lo = o.lo || '#4f8f36', mid = o.mid || '#69ad44', hi = o.hi || '#9ad466', ink = '#3a6a26';
  crownPath(c, lobes, 1.2); c.fillStyle = ink; c.fill();
  crownPath(c, lobes); c.fillStyle = mid; c.fill();
  c.save(); crownPath(c, lobes); c.clip();
  // shade: lower right; light: upper left (clusters)
  c.fillStyle = lo; for (const [x, y, r] of [[14, -54, 24], [28, -70, 16], [-6, -50, 18], [22, -88, 12]]) { c.beginPath(); c.arc(x + 4, y + 6, r, 0, TAU); c.fill(); }
  c.fillStyle = 'rgba(30,70,20,0.25)'; c.beginPath(); c.arc(16, -50, 30, 0, TAU); c.fill();
  c.fillStyle = hi; for (const [x, y, r] of [[-20, -70, 11], [-6, -92, 12], [-24, -88, 8], [10, -100, 7], [-34, -74, 6], [8, -76, 6]]) { c.beginPath(); c.arc(x - 2, y - 3, r, 0, TAU); c.fill(); }
  c.fillStyle = 'rgba(255,250,200,0.35)'; for (const [x, y, r] of [[-12, -98, 5], [-26, -78, 4], [-8, -74, 3]]) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  // leaf texture: tiny dark crescents
  const R = rng(5); c.strokeStyle = 'rgba(40,80,25,0.35)'; c.lineWidth = 0.9;
  for (let k = 0; k < 26; k++) { const a = R() * TAU, rr = R() * 30, x = Math.cos(a) * rr, y = -80 + Math.sin(a) * rr * 0.9; c.beginPath(); c.arc(x, y, 3, 0.2, 1.6); c.stroke(); }
  c.restore();
  if (o.fruit) for (const [x, y] of [[-18, -66], [14, -72], [2, -92], [24, -60], [-8, -80], [-26, -84]]) { ell(c, x + 0.5, y + 1, 3.2, 3, 'rgba(60,20,10,0.35)'); ell(c, x, y, 3.2, 3.2, o.fruit); ell(c, x - 1, y - 1.1, 1.1, 0.9, 'rgba(255,255,255,0.8)'); }
}
function bush(c) {
  softShadow(c, 4, 0, 26, 6, 0.4);
  const lobes = [[-14, -10, 12], [12, -10, 12], [0, -18, 14], [-4, -8, 12], [8, -6, 10]];
  crownPath(c, lobes, 1); c.fillStyle = '#3a6a26'; c.fill();
  crownPath(c, lobes); c.fillStyle = '#62a640'; c.fill();
  c.save(); crownPath(c, lobes); c.clip();
  c.fillStyle = '#4a8a32'; c.beginPath(); c.arc(12, -2, 14, 0, TAU); c.fill();
  c.fillStyle = '#92cd60'; c.beginPath(); c.arc(-8, -20, 8, 0, TAU); c.arc(-18, -14, 5, 0, TAU); c.fill();
  c.restore();
  for (const [x, y] of [[-10, -16], [6, -20], [-2, -10], [12, -12]]) flower(c, x, y, 2.2, '#ffffff', '#f2b52a');
}
// the farmhouse: a little white cottage with a red roof and a chimney (its smoke is live)
export const FARMHOUSE_CHIMNEY = [22, -112];
function farmhouse(c) {
  // cast shadow, contact shadow
  longShadow(c, -50, 50, 70);
  softShadow(c, -4, 0, 62, 8, 0.38);
  const F = '#f4ead4', Fs = '#d3c3a2', ink = '#7a6a52';
  // side wall (shaded), front wall (gable end, lit)
  fillPoly(c, [18, 0, 52, -20, 52, -66, 18, -46], Fs, ink, 1);
  fillPoly(c, [-50, 0, 18, 0, 18, -46, -16, -80, -50, -46], lg(c, -50, -80, 18, 0, ['#fff8e6', F]), ink, 1);
  // clapboard lines
  c.strokeStyle = 'rgba(140,120,90,0.35)'; c.lineWidth = 0.8;
  for (let y = -6; y > -46; y -= 6) { c.beginPath(); c.moveTo(-49, y); c.lineTo(17, y); c.moveTo(19, y); c.lineTo(51, y - 20); c.stroke(); }
  // roof: the right plane, red shingles, the gable's fascia
  fillPoly(c, [18, -44, -16, -82, 18, -102, 56, -64], P.red, P.redInk, 1);
  c.save(); poly(c, [18, -44, -16, -82, 18, -102, 56, -64]); c.clip();
  for (let k = 1; k < 8; k++) { const a = k / 8; c.strokeStyle = 'rgba(90,20,10,0.45)'; c.lineWidth = 1; c.beginPath(); c.moveTo(lerp(18, -16, a), lerp(-44, -82, a)); c.lineTo(lerp(56, 18, a), lerp(-64, -102, a)); c.stroke(); }
  c.fillStyle = 'rgba(255,200,170,0.18)'; poly(c, [-16, -82, 18, -102, 22, -96, -10, -78]); c.fill();
  c.restore();
  c.strokeStyle = '#8a2a1c'; c.lineWidth = 3.4; c.lineJoin = 'round'; c.beginPath(); c.moveTo(-54, -44); c.lineTo(-16, -84); c.lineTo(22, -44); c.stroke();
  c.strokeStyle = '#e8705a'; c.lineWidth = 1; c.beginPath(); c.moveTo(-54, -45.5); c.lineTo(-16, -85.5); c.stroke();
  // chimney
  fillPoly(c, [14, -92, 14, -116, 24, -118, 24, -94], '#b4614a', '#6a2e20', 1);
  fillPoly(c, [24, -94, 24, -118, 30, -115, 30, -97], '#8e4636');
  fillPoly(c, [12, -116, 25, -119, 32, -116, 19, -113], '#5a2a1e');
  // door and windows
  fillPoly(c, [-8, 0, 6, 0, 6, -26, -8, -26], '#7a4a2a', '#4a2a14', 1);
  ell(c, 3, -13, 1, 1, '#f2c45a');
  for (const wx of [-40, -26]) { fillPoly(c, [wx, -16, wx + 12, -16, wx + 12, -32, wx, -32], '#5a7f9a', ink, 1); c.fillStyle = 'rgba(255,255,255,0.4)'; poly(c, [wx, -32, wx + 5, -32, wx, -24]); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 1; c.beginPath(); c.moveTo(wx + 6, -16); c.lineTo(wx + 6, -32); c.moveTo(wx, -24); c.lineTo(wx + 12, -24); c.stroke(); fillPoly(c, [wx - 1, -15, wx + 13, -15, wx + 13, -13, wx - 1, -13], '#8a5a34'); }
  fillPoly(c, [-21, -52, -11, -52, -11, -62, -21, -62], '#5a7f9a', ink, 1);
  fillPoly(c, [30, -20, 42, -27, 42, -42, 30, -35], '#4a6a84', ink, 1);
  // a flower box and a bench
  fillPoly(c, [-42, -14, -16, -14, -17, -10, -41, -10], '#8a5a34');
  for (const [x, col] of [[-38, '#ff7a9a'], [-32, '#ffd84a'], [-26, '#ff7a9a'], [-20, '#ffffff']]) flower(c, x, -16, 2.4, col, '#f2b52a');
}
function washingPosts(c) { // the two posts; the line and the washing are live (they sway)
  for (const x of [-44, 44]) { softShadow(c, x + 2, 0, 6, 2, 0.4); fillPoly(c, [x - 1.6, 0, x - 1.6, -46, x + 1.6, -46, x + 1.6, 0], P.wood, P.woodInk, 0.8); fillPoly(c, [x - 6, -44, x + 6, -44, x + 6, -42, x - 6, -42], P.woodLo); }
  c.fillStyle = 'rgba(40,62,18,0.14)'; poly(c, [-40, 2, 48, 2, 60, -2, -28, -2]); c.fill();
}
function scarecrow(c) {
  longShadow(c, -12, 12, 40, 0.2);
  fillPoly(c, [-1.5, 0, -1.5, -60, 1.5, -60, 1.5, 0], P.woodLo, P.woodInk, 0.8);
  fillPoly(c, [-22, -44, 22, -44, 22, -41, -22, -41], P.wood, P.woodInk, 0.8);
  // coat
  fillPoly(c, [-10, -46, 10, -46, 13, -22, 4, -26, 0, -20, -5, -26, -13, -22], '#5a7a9a', '#2a3a4a', 1);
  fillPoly(c, [-10, -46, -22, -44, -22, -39, -10, -40], '#5a7a9a', '#2a3a4a', 0.8); fillPoly(c, [10, -46, 22, -44, 22, -39, 10, -40], '#4a6a88', '#2a3a4a', 0.8);
  c.strokeStyle = P.straw; c.lineWidth = 1.2; for (const [x, y, a] of [[-22, -41, -2.6], [-22, -42, 2.8], [22, -41, -0.5], [22, -42, 0.3]]) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5); c.stroke(); }
  fillPoly(c, [-3, -36, 3, -36, 2, -30, -2, -30], '#c8412f');
  // head (a sack) and hat
  ell(c, 0, -52, 7.5, 7, '#e8d2a0'); c.strokeStyle = '#a88a5a'; c.lineWidth = 0.8; c.beginPath(); c.ellipse(0, -52, 7.5, 7, 0, 0, TAU); c.stroke();
  ell(c, -2.6, -53, 1, 1.2, '#3a2a1a'); ell(c, 2.6, -53, 1, 1.2, '#3a2a1a'); c.beginPath(); c.moveTo(-3, -48.5); c.quadraticCurveTo(0, -46.5, 3, -48.5); c.stroke();
  fillPoly(c, [-12, -57, 12, -57, 10, -55, -10, -55], '#8a6a3a', '#5a3a1e', 0.8);
  fillPoly(c, [-7, -57, -6, -66, 6, -66, 7, -57], '#a07a44', '#5a3a1e', 0.8);
}
function pumpkin(c, x, y, r) {
  ell(c, x + r * 0.2, y + r * 0.55, r * 1.1, r * 0.35, 'rgba(40,40,10,0.3)');
  for (const [dx, k] of [[-0.45, 0.62], [0.45, 0.62], [0, 0.75]]) { c.beginPath(); c.ellipse(x + dx * r, y, r * k, r * 0.8, 0, 0, TAU); c.fillStyle = lg(c, x - r, y - r, x + r, y + r, ['#ffb24a', '#e8761e', '#b8521a']); c.fill(); c.strokeStyle = '#8a3a10'; c.lineWidth = 0.7; c.stroke(); }
  ell(c, x - r * 0.3, y - r * 0.35, r * 0.22, r * 0.14, 'rgba(255,240,200,0.6)');
  c.strokeStyle = '#5a7a2a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, y - r * 0.75); c.quadraticCurveTo(x + 1, y - r * 1.15, x + 3, y - r * 1.2); c.stroke();
}
// a wheelbarrow of pumpkins left by the road
function barrow(c) {
  longShadow(c, -26, 22, 30, 0.22); softShadow(c, -2, 0, 28, 5, 0.35);
  c.strokeStyle = P.woodInk; c.lineWidth = 2.2; c.beginPath(); c.moveTo(-6, -10); c.lineTo(-28, -4); c.moveTo(-2, -8); c.lineTo(-26, 0); c.stroke();
  c.strokeStyle = P.wood; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-6, -10); c.lineTo(-28, -4); c.stroke();
  fillPoly(c, [-8, -4, 2, -10, 2, -2, -8, 2], P.woodLo, P.woodInk, 0.8);
  fillPoly(c, [-16, -10, 18, -10, 14, 2, -12, 2], lg(c, 0, -10, 0, 2, ['#7aa0b4', '#4a6a7c']), '#2e4452', 1);
  fillPoly(c, [-18, -12, 20, -12, 18, -9, -16, -9], '#a8c2d0', '#2e4452', 0.8);
  pumpkin(c, -6, -14, 7); pumpkin(c, 8, -15, 6); pumpkin(c, 1, -21, 5.5);
  ell(c, 16, 0, 5, 5, '#3a3030'); ell(c, 16, 0, 2.6, 2.6, '#8a8078'); ell(c, 15, -1, 1, 1, '#d8d0c8');
}
function fencePost(c) { // the rooster's post (taller, with a cap)
  softShadow(c, 3, 0, 8, 2.4, 0.4);
  fillPoly(c, [-4, 0, -4, -40, 4, -40, 4, 0], P.wood, P.woodInk, 0.9);
  fillPoly(c, [1, 0, 1, -40, 4, -40, 4, 0], P.woodLo);
  fillPoly(c, [-5.5, -40, 5.5, -40, 4.5, -43, -4.5, -43], P.woodHi, P.woodInk, 0.8);
}

// ------------------------------------------------------------------ landmark sprites
const SPR = new Map();
// 0.8.10: the landmark pictures of every world but `keepWorld` go back to the phone (called when a level starts: the
// map is not on screen then; a landmark is repainted the next time its band is drawn)
export function freeLandmarks(keepWorld = -1, per = 5) {
  for (const [gi, e] of SPR) if (Math.floor(gi / per) !== keepWorld) { freeCanvas(e.cv); SPR.delete(gi); }
}
// a landmark's body painted once into its own canvas (keyed by the stop's map index), stamped every frame; paint(c, m)
// draws it in design units with the foot at the origin (shared with the other places: mapcave.js)
export function landmarkSprite(m, DPR, paint = (c, mm) => LM_PAINT[mm.kind](c)) {
  const S = m.S, d = m.d, key = `${m.kind}|${d.toFixed(3)}|${DPR}|${m.flip ? 1 : 0}`;
  let e = SPR.get(m.gi);
  if (e && e.key === key) return e;
  if (typeof document === 'undefined') return null;
  const pad = 30, x0 = (S.x0 - pad) * d, y0 = -(S.top + pad) * d, w = (S.x1 - S.x0 + 2 * pad) * d, h = (S.top + pad + 34) * d;
  const cv = (e && e.cv) || document.createElement('canvas');
  cv.width = Math.ceil(w * DPR); cv.height = Math.ceil(h * DPR);
  const c = cv.getContext('2d');
  c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, w, h);
  c.translate(-x0, -y0); c.scale(d, d); c.lineJoin = 'round'; c.lineCap = 'round';
  try { paint(c, m); } catch (err) { /* art never breaks the map */ }
  e = { key, cv, x0, y0, w, h };
  SPR.set(m.gi, e);
  return e;
}

// The Hen House: a small wooden coop on stilts, a ramp down to the yard, a straw nest box on its side
function paintCoop(c) {
  // cast shadow to the lower right and the shade under the house
  const W1 = P.wood, Wh = P.woodHi, Wl = P.woodLo, ink = P.woodInk;
  const D = [26, -18]; // depth: one step back in the 3/4 view
  // back stilts (in shade)
  for (const x of [-38, 18]) fillPoly(c, [x + D[0] - 2.5, D[1] + 2, x + D[0] - 2.5, -50 + D[1], x + D[0] + 2.5, -50 + D[1], x + D[0] + 2.5, D[1] + 2], dk(W1, 0.45));
  // floor underside
  fillPoly(c, [-44, -48, 20, -48, 20 + D[0], -48 + D[1], -44 + D[0], -48 + D[1]], dk(W1, 0.5));
  // the side wall (shaded): planks
  const sx0 = 20, sx1 = 20 + D[0];
  fillPoly(c, [sx0, -48, sx1, -48 + D[1], sx1, -98 + D[1], sx0, -98], lg(c, sx0, 0, sx1, 0, [Wl, dk(W1, 0.28)]), ink, 1);
  c.strokeStyle = 'rgba(60,36,16,0.45)'; c.lineWidth = 0.8; for (let k = 1; k < 4; k++) { const x = lerp(sx0, sx1, k / 4); c.beginPath(); c.moveTo(x, -48 + D[1] * (k / 4)); c.lineTo(x, -98 + D[1] * (k / 4)); c.stroke(); }
  // the front wall: the gable end, vertical boards, lit
  const front = [-46, -48, 20, -48, 20, -98, -13, -126, -46, -98];
  fillPoly(c, front, lg(c, -46, -126, 20, -48, [Wh, W1, mix(W1, Wl, 0.4)]), ink, 1.1);
  c.save(); poly(c, front); c.clip();
  for (let x = -40; x < 20; x += 7.5) { c.strokeStyle = 'rgba(80,46,18,0.45)'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(x, -48); c.lineTo(x, -130); c.stroke(); c.strokeStyle = 'rgba(255,230,190,0.35)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(x + 1.2, -48); c.lineTo(x + 1.2, -130); c.stroke(); }
  // weathering: a few knots and a darker lower edge
  ell(c, -30, -70, 1.4, 2, 'rgba(80,46,18,0.5)'); ell(c, 6, -86, 1.2, 1.8, 'rgba(80,46,18,0.5)');
  c.fillStyle = 'rgba(60,30,10,0.18)'; c.fillRect(-46, -56, 70, 8);
  c.restore();
  // corner trim
  fillPoly(c, [-47, -47, -42, -47, -42, -98, -47, -98], P.cream, P.creamLo, 0.6);
  fillPoly(c, [16, -47, 21, -47, 21, -98, 16, -98], P.creamLo, dk(P.creamLo, 0.3), 0.6);
  // round window in the gable
  ell(c, -13, -104, 8.5, 8.5, P.cream); ell(c, -13, -104, 6.5, 6.5, '#3a2a1e');
  c.fillStyle = 'rgba(160,210,240,0.55)'; c.beginPath(); c.arc(-13, -104, 6.5, Math.PI * 1.05, Math.PI * 1.75); c.lineTo(-13, -104); c.closePath(); c.fill();
  c.strokeStyle = P.cream; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-19.5, -104); c.lineTo(-6.5, -104); c.moveTo(-13, -110.5); c.lineTo(-13, -97.5); c.stroke();
  // the pop hole: an arched door, dark inside, a little straw spilling out
  c.beginPath(); c.moveTo(-28, -48); c.lineTo(-28, -64); c.arc(-19, -64, 9, Math.PI, 0); c.lineTo(-10, -48); c.closePath(); c.fillStyle = P.cream; c.fill();
  c.beginPath(); c.moveTo(-26, -48); c.lineTo(-26, -64); c.arc(-19, -64, 7, Math.PI, 0); c.lineTo(-12, -48); c.closePath(); c.fillStyle = lg(c, 0, -71, 0, -48, ['#24160c', '#3e2814']); c.fill();
  c.strokeStyle = P.straw; c.lineWidth = 1.1; for (const [x, a] of [[-24, -0.4], [-21, 0.2], [-17, -0.2], [-14, 0.5]]) { c.beginPath(); c.moveTo(x, -48.5); c.lineTo(x + Math.sin(a) * 5, -51.5); c.stroke(); }
  // the roof: right plane with shingle rows, the gable's barge boards
  const r0 = [22, -94], ap = [-13, -130], ra = [ap[0] + D[0], ap[1] + D[1]], rb = [r0[0] + D[0] + 2, r0[1] + D[1]];
  const roof = [r0[0], r0[1], ap[0], ap[1], ra[0], ra[1], rb[0], rb[1]];
  fillPoly(c, roof, lg(c, ap[0], ap[1], rb[0], rb[1], [P.redHi, P.red, P.redLo]), P.redInk, 1);
  c.save(); poly(c, roof); c.clip();
  for (let k = 1; k <= 6; k++) { const a = k / 6.4, xa = lerp(ap[0], r0[0], a), ya = lerp(ap[1], r0[1], a); c.strokeStyle = 'rgba(80,16,8,0.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(xa, ya); c.lineTo(xa + D[0] + 2 * a, ya + D[1]); c.stroke();
    for (let q = 0; q < 5; q++) { const v = (q + (k % 2) * 0.5) / 5, x = xa + (D[0] + 2 * a) * v, y = ya + D[1] * v; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 2.4, y - 3.4); c.strokeStyle = 'rgba(80,16,8,0.35)'; c.lineWidth = 0.7; c.stroke(); } }
  c.fillStyle = 'rgba(255,220,200,0.22)'; poly(c, [ap[0], ap[1], ra[0], ra[1], ra[0] + 4, ra[1] + 5, ap[0] + 4, ap[1] + 5]); c.fill();
  c.restore();
  c.strokeStyle = P.redInk; c.lineWidth = 5.4; c.beginPath(); c.moveTo(-52, -93); c.lineTo(ap[0], ap[1] - 1); c.lineTo(r0[0] + 3, r0[1] + 1); c.stroke();
  c.strokeStyle = '#a8382a'; c.lineWidth = 3.6; c.stroke();
  c.strokeStyle = 'rgba(255,190,170,0.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-52, -94.5); c.lineTo(ap[0], ap[1] - 2.6); c.stroke();
  // ridge cap
  c.strokeStyle = P.redInk; c.lineWidth = 2.4; c.beginPath(); c.moveTo(ap[0], ap[1] - 1); c.lineTo(ra[0], ra[1] - 1); c.stroke();
  // the nest box on the side wall: a small box with a sloped lid, straw and an egg in it
  const nb = [sx1 - 4, -66 + D[1] * 0.6];
  fillPoly(c, [nb[0] - 14, nb[1], nb[0] + 12, nb[1] - 4, nb[0] + 12, nb[1] - 22, nb[0] - 14, nb[1] - 18], dk(W1, 0.2), ink, 1);
  fillPoly(c, [nb[0] + 12, nb[1] - 4, nb[0] + 20, nb[1] - 10, nb[0] + 20, nb[1] - 27, nb[0] + 12, nb[1] - 22], dk(W1, 0.42), ink, 0.8);
  fillPoly(c, [nb[0] - 16, nb[1] - 17, nb[0] + 13, nb[1] - 22, nb[0] + 22, nb[1] - 28, nb[0] - 6, nb[1] - 25], P.red, P.redInk, 1);
  c.beginPath(); c.ellipse(nb[0] - 1, nb[1] - 9, 10, 5.5, -0.15, 0, TAU); c.fillStyle = '#3a2410'; c.fill();
  c.strokeStyle = P.straw; c.lineWidth = 1.2; for (let k = 0; k < 9; k++) { const x = nb[0] - 10 + k * 2.4; c.beginPath(); c.moveTo(x, nb[1] - 5 - (k % 3)); c.lineTo(x + (k % 2 ? 3 : -2), nb[1] - 1 + (k % 2)); c.stroke(); }
  ell(c, nb[0] + 1, nb[1] - 9, 4, 5, '#fbf3e2'); ell(c, nb[0] - 0.5, nb[1] - 11, 1.4, 1.8, '#ffffff'); c.strokeStyle = 'rgba(160,130,90,0.6)'; c.lineWidth = 0.6; c.beginPath(); c.ellipse(nb[0] + 1, nb[1] - 9, 4, 5, 0, 0.2, 2.8); c.stroke();
  // front stilts (lit side)
  for (const x of [-42, 15]) { fillPoly(c, [x - 3, 0, x - 3, -49, x + 3, -49, x + 3, 0], lg(c, x - 3, 0, x + 3, 0, [Wh, W1, Wl]), ink, 0.9); }
  c.strokeStyle = dk(W1, 0.3); c.lineWidth = 2.2; c.beginPath(); c.moveTo(-39, -8); c.lineTo(13, -40); c.stroke(); c.strokeStyle = W1; c.lineWidth = 1.2; c.stroke();
  // the ramp: down from the pop hole to the yard, toward the road, with cleats
  const rp = [[-28, -48], [-10, -48], [-50, 1], [-70, 1]];
  fillPoly(c, [rp[0][0], rp[0][1], rp[1][0], rp[1][1], rp[2][0], rp[2][1], rp[3][0], rp[3][1]], lg(c, -70, 0, -10, -48, [W1, Wh]), ink, 1);
  fillPoly(c, [rp[3][0], rp[3][1], rp[2][0], rp[2][1], rp[2][0] + 1, rp[2][1] + 3, rp[3][0] + 1, rp[3][1] + 3], dk(W1, 0.4));
  c.strokeStyle = dk(W1, 0.4); c.lineWidth = 2; for (let k = 1; k < 6; k++) { const a = k / 6; c.beginPath(); c.moveTo(lerp(-28, -70, a), lerp(-48, 1, a)); c.lineTo(lerp(-10, -50, a), lerp(-48, 1, a)); c.stroke(); }
  c.strokeStyle = Wh; c.lineWidth = 0.8; for (let k = 1; k < 6; k++) { const a = k / 6; c.beginPath(); c.moveTo(lerp(-28, -70, a), lerp(-48, 1, a) - 1.2); c.lineTo(lerp(-10, -50, a), lerp(-48, 1, a) - 1.2); c.stroke(); }
  // a feed trough and a water dish in the yard
  fillPoly(c, [30, -2, 58, -6, 60, -14, 30, -10], P.woodLo, P.woodInk, 0.9); fillPoly(c, [30, -10, 60, -14, 64, -18, 34, -14], '#e8b84a', P.strawInk, 0.8);
  ell(c, 70, -2, 7, 2.6, '#7a8a96'); ell(c, 70, -3, 5.6, 1.8, '#9fdcf0');
}

// The Haystacks: square bales stacked three high, loose straw, a pitchfork leaning on them
function rrPath(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function bale(c, x, y, w, h, dep) { // a straw bale: front face at (x..x+w, y-h..y), its depth goes up-right; soft rounded edges
  const D = [dep * 0.6, -dep * 0.45], r = 4;
  const R = rng(Math.round(x * 7 + y * 13 + 500));
  // the side and top as one rounded block behind the front
  c.beginPath(); c.moveTo(x + r, y - h); c.lineTo(x + D[0] + r, y - h + D[1]); c.lineTo(x + w + D[0] - r * 0.5, y - h + D[1]); c.quadraticCurveTo(x + w + D[0] + 1, y - h + D[1], x + w + D[0], y - h + D[1] + r); c.lineTo(x + w + D[0], y + D[1] - r * 0.5); c.lineTo(x + w, y - 1); c.closePath();
  c.fillStyle = P.strawInk; c.fill();
  const top = [x + 2, y - h, x + w - 1, y - h, x + w + D[0] - 1, y - h + D[1] + 1, x + D[0] + 2, y - h + D[1] + 1];
  const side = [x + w, y - 1, x + w + D[0] - 1, y + D[1], x + w + D[0] - 1, y - h + D[1] + 2, x + w, y - h + 1];
  fillPoly(c, side, lg(c, x + w, 0, x + w + D[0], 0, ['#c99036', '#a87428']));
  fillPoly(c, top, lg(c, x, y - h + D[1], x + w, y - h, ['#fff0b8', '#f7d679']));
  rrPath(c, x, y - h, w, h, r); c.fillStyle = P.strawInk; c.fill();
  rrPath(c, x + 0.8, y - h + 0.8, w - 1.6, h - 1.6, r - 0.8); c.fillStyle = lg(c, x, y - h, x + w * 0.4, y + 4, ['#ffe48e', '#f3c656', '#dba140']); c.fill();
  // straw texture: dense short strokes running along the bale, dark in the lower right, light in the upper left
  c.save(); rrPath(c, x, y - h, w, h, r); c.clip(); c.lineCap = 'round';
  for (let k = 0; k < w * h * 0.09; k++) { const xx = x + R() * w, yy = y - R() * h, a = (R() - 0.5) * 0.7, l = 2.5 + R() * 4, lo = (xx - x) / w + (yy - (y - h)) / h > 1.1; c.strokeStyle = lo ? 'rgba(160,98,24,0.55)' : R() < 0.5 ? 'rgba(190,124,36,0.4)' : 'rgba(255,248,206,0.7)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx + Math.cos(a) * l, yy + Math.sin(a) * l); c.stroke(); }
  c.fillStyle = 'rgba(140,80,10,0.18)'; c.fillRect(x, y - 5, w, 5);
  c.restore();
  c.save(); poly(c, top); c.clip(); for (let k = 0; k < w * 0.9; k++) { const xx = x + R() * (w + D[0]), yy = y - h + D[1] * R(); c.strokeStyle = R() < 0.5 ? 'rgba(200,140,50,0.5)' : 'rgba(255,255,230,0.7)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx + 3.2, yy - 1.4); c.stroke(); } c.restore();
  c.save(); poly(c, side); c.clip(); for (let k = 0; k < h * 1.2; k++) { const xx = x + w + R() * D[0], yy = y - R() * h + D[1] * 0.5; c.strokeStyle = 'rgba(120,70,14,0.45)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx + 1, yy - 3); c.stroke(); } c.restore();
  // twine: two thin bands across the front and over the top
  for (const f of [0.27, 0.73]) { const tx = x + w * f; c.strokeStyle = 'rgba(120,52,22,0.75)'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(tx, y); c.lineTo(tx, y - h); c.lineTo(tx + D[0], y - h + D[1]); c.stroke(); }
  // stray stalks over the top edge
  c.strokeStyle = '#fff0b0'; c.lineWidth = 0.8; for (let k = 0; k < 7; k++) { const xx = x + 3 + R() * (w - 6); c.beginPath(); c.moveTo(xx, y - h + 1); c.lineTo(xx + (R() - 0.5) * 7, y - h - 2 - R() * 3); c.stroke(); }
}
function paintHay(c) {
  // loose straw on the ground
  const R = rng(9); c.lineCap = 'round';
  for (let k = 0; k < 60; k++) { const x = -58 + R() * 116, y = -2 + R() * 8; c.strokeStyle = R() < 0.5 ? P.straw : P.strawLo; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (R() - 0.5) * 8, y - R() * 3); c.stroke(); }
  // three rows, each set back a little: the top bale, the middle pair, the front pair
  bale(c, -26, -62, 42, 26, 20);
  bale(c, -46, -32, 42, 28, 22); bale(c, -4, -32, 42, 28, 22);
  bale(c, -52, 0, 44, 30, 24); bale(c, -8, 0, 44, 30, 24);
  // the pitchfork stuck in the top bale
  c.save(); c.translate(6, -74); c.rotate(0.5);
  fillPoly(c, [-1.6, 6, -1.6, -58, 1.6, -58, 1.6, 6], lg(c, -2, 0, 2, 0, [P.woodHi, P.woodLo]), P.woodInk, 0.7);
  c.strokeStyle = '#5e646e'; c.lineWidth = 2; c.beginPath(); c.moveTo(-5, 8); c.lineTo(5, 8); for (const x of [-5, 0, 5]) { c.moveTo(x, 8); c.lineTo(x * 1.05, 16); } c.stroke();
  c.restore();
  // a few stalks spilling at the front
  for (let k = 0; k < 14; k++) { const x = -50 + R() * 90; c.strokeStyle = P.strawHi; c.lineWidth = 1; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + (R() - 0.5) * 10, 3 + R() * 3); c.stroke(); }
}
export const WEASEL_SPOT = [-4, -86]; // where the weasel peeks over the stack (design units from the foot)

// The Duck Pond: reeds and cattails, a little jetty at the road side (the water is in the ground)
function reeds(c, x, y, n, seed, h = 30) {
  const R = rng(seed); c.lineCap = 'round';
  for (let k = 0; k < n; k++) {
    const bx = x + (R() - 0.5) * 22, l = h * (0.6 + R() * 0.5), a = (R() - 0.5) * 0.5;
    c.strokeStyle = k % 2 ? '#4f8f36' : '#6aa844'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(bx, y); c.quadraticCurveTo(bx + a * l * 0.3, y - l * 0.6, bx + a * l, y - l); c.stroke();
    if (k % 3 === 0) { const tx = bx + a * l * 0.8, ty = y - l * 0.82; c.beginPath(); c.ellipse(tx, ty, 2.4, 6, a, 0, TAU); c.fillStyle = '#7a4a26'; c.fill(); ell(c, tx - 0.8, ty - 2, 0.8, 2, 'rgba(255,220,180,0.5)'); }
  }
}
function paintPond(c) {
  // stones on the bank
  for (const [x, y, r] of [[-96, -30, 6], [-88, -18, 4.5], [86, -50, 5], [-20, 0, 4], [12, -2, 5]]) { ell(c, x + 1, y + 1.5, r, r * 0.55, 'rgba(40,40,20,0.35)'); ell(c, x, y, r, r * 0.62, P.stone); ell(c, x - r * 0.3, y - r * 0.3, r * 0.45, r * 0.25, '#ece3d4'); }
  // back reeds on the far bank
  reeds(c, -66, -60, 12, 3, 30); reeds(c, -40, -64, 6, 4, 22);
  // the jetty: posts in the water and planks out from the near bank on the right
  const J = [[54, -6], [26, -30]];
  for (const [x, y] of [[30, -26], [44, -16], [30, -10]]) { fillPoly(c, [x - 1.6, y + 6, x - 1.6, y - 6, x + 1.6, y - 6, x + 1.6, y + 6], P.woodLo, P.woodInk, 0.6); ell(c, x, y + 6, 3.4, 1, 'rgba(255,255,255,0.45)'); }
  const deck = [62, 4, 80, -8, 46, -36, 28, -24];
  fillPoly(c, [deck[0], deck[1], deck[6], deck[7], deck[6], deck[7] + 3, deck[0], deck[1] + 3], P.woodInk);
  fillPoly(c, deck, lg(c, 28, -36, 80, 4, [P.woodHi, P.wood]), P.woodInk, 0.9);
  c.strokeStyle = 'rgba(80,46,18,0.55)'; c.lineWidth = 0.8; for (let k = 1; k < 7; k++) { const a = k / 7; c.beginPath(); c.moveTo(lerp(62, 28, a), lerp(4, -24, a)); c.lineTo(lerp(80, 46, a), lerp(-8, -36, a)); c.stroke(); }
  // a little rowing boat tied up? keep it calm: a bucket and a fishing rod on the jetty
  ell(c, 58, -14, 4, 1.6, '#5a6a74'); fillPoly(c, [54, -14, 62, -14, 61, -21, 55, -21], '#7d8c96', '#3e4a52', 0.6); ell(c, 58, -21, 3, 1.2, '#aeb8c0');
  c.strokeStyle = '#6a4424'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(44, -28); c.quadraticCurveTo(20, -58, -6, -60); c.stroke(); c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(-6, -60); c.lineTo(-8, -42); c.stroke(); ell(c, -8, -41, 1.4, 1.4, '#e8402e');
  // front reeds on the near bank
  reeds(c, -86, -8, 10, 7, 30); reeds(c, 90, -30, 7, 8, 26);
  for (const [x, y] of [[-70, -2], [-50, 2], [74, -16], [92, -10]]) tuft(c, x, y, 7, P.g3, P.g1, rng(x * 3 + 7));
}

// The Windmill: a stone base and a white-boarded smock tower, a shingled cap; the sails turn (live)
export const MILL_HUB = [0, -158];
function paintMill(c) {
  const yb = -2, yt = -150, hw0 = 32, hw1 = 18, fb = 12, ft = 7;
  const faces = [ // left (lit), front, right (shade)
    [[-hw0, yb], [-fb, yb + 3], [-ft, yt + 2], [-hw1, yt], '#fbf4e4', '#e4d6bc'],
    [[-fb, yb + 3], [fb, yb + 3], [ft, yt + 2], [-ft, yt + 2], '#eadcc2', '#d2c09e'],
    [[fb, yb + 3], [hw0, yb], [hw1, yt], [ft, yt + 2], '#c4ad88', '#a89170'],
  ];
  for (const [a, b, cc, dd, c0, c1] of faces) {
    fillPoly(c, [a[0], a[1], b[0], b[1], cc[0], cc[1], dd[0], dd[1]], lg(c, 0, yt, 0, yb, [c0, c1]), '#7a6a50', 0.9);
    // weatherboards
    c.save(); poly(c, [a[0], a[1], b[0], b[1], cc[0], cc[1], dd[0], dd[1]]); c.clip();
    for (let y = yb - 6; y > yt; y -= 6.5) { c.strokeStyle = 'rgba(120,100,70,0.35)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-40, y + 1.5); c.lineTo(40, y + 1.5); c.stroke(); c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(-40, y + 2.4); c.lineTo(40, y + 2.4); c.stroke(); }
    c.restore();
  }
  // a stone footing
  const st = [-hw0 - 2, 0, hw0 + 2, 0, hw0, -18, -hw0, -18];
  fillPoly(c, st, lg(c, -hw0, 0, hw0, 0, ['#d6ccb8', '#b2a68e', '#8d8270']), '#6a604e', 1);
  c.save(); poly(c, st); c.clip();
  const R = rng(17);
  for (let row = 0; row < 3; row++) for (let k = 0; k < 7; k++) { const x = -hw0 - 4 + k * 10.5 + (row % 2) * 5, y = -2 - row * 6; c.beginPath(); c.ellipse(x, y - 2.5, 5, 2.6, 0, 0, TAU); c.strokeStyle = 'rgba(90,80,60,0.45)'; c.lineWidth = 0.8; c.stroke(); c.fillStyle = `rgba(255,255,255,${0.1 + R() * 0.15})`; c.fill(); }
  c.restore();
  // door and windows
  c.beginPath(); c.moveTo(-7, 1); c.lineTo(-7, -20); c.arc(0, -20, 7, Math.PI, 0); c.lineTo(7, 1); c.closePath(); c.fillStyle = '#6e4426'; c.fill(); c.strokeStyle = '#3e2412'; c.lineWidth = 1; c.stroke();
  c.strokeStyle = 'rgba(40,20,8,0.5)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(-3.5, 0); c.lineTo(-3.5, -24); c.moveTo(0, 0); c.lineTo(0, -27); c.moveTo(3.5, 0); c.lineTo(3.5, -24); c.stroke(); ell(c, 4.6, -11, 0.9, 0.9, '#e8c060');
  for (const [x, y, w, h, col] of [[-19, -70, 8, 11, '#4a6a84'], [-4, -104, 8, 11, '#4a6a84'], [14, -60, 6, 10, '#38526a']]) { fillPoly(c, [x, y, x + w, y + 0.6, x + w, y + h, x, y + h], col, '#5a4a36', 0.8); c.fillStyle = 'rgba(255,255,255,0.35)'; poly(c, [x, y, x + w * 0.5, y + 0.3, x, y + h * 0.6]); c.fill(); }
  // a gallery rail around the middle
  c.strokeStyle = P.woodInk; c.lineWidth = 2.2; c.beginPath(); c.moveTo(-28, -86); c.quadraticCurveTo(0, -80, 28, -86); c.stroke(); c.strokeStyle = P.wood; c.lineWidth = 1.2; c.stroke();
  for (const x of [-24, -12, 0, 12, 24]) { c.strokeStyle = P.woodInk; c.lineWidth = 1; c.beginPath(); c.moveTo(x, -84 + Math.abs(x) * 0.05); c.lineTo(x, -76 + Math.abs(x) * 0.05); c.stroke(); }
  // the cap: a boat-shaped dome in red shingles
  c.beginPath(); c.moveTo(-24, yt + 2); c.quadraticCurveTo(-26, yt - 22, 0, yt - 28); c.quadraticCurveTo(26, yt - 22, 24, yt + 2); c.closePath();
  c.fillStyle = lg(c, -24, yt - 28, 24, yt, [P.redHi, P.red, P.redLo]); c.fill(); c.strokeStyle = P.redInk; c.lineWidth = 1; c.stroke();
  c.save(); c.clip(); for (let k = 0; k < 4; k++) { const y = yt - 4 - k * 6; c.strokeStyle = 'rgba(80,16,8,0.4)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-26, y); c.quadraticCurveTo(0, y - 4, 26, y); c.stroke(); } c.fillStyle = 'rgba(255,220,200,0.25)'; c.beginPath(); c.ellipse(-8, yt - 20, 9, 5, -0.4, 0, TAU); c.fill(); c.restore();
  fillPoly(c, [-26, yt + 3, 26, yt + 3, 24, yt - 1, -24, yt - 1], P.woodLo, P.woodInk, 0.8);
  ell(c, 0, yt - 29, 2.4, 2.4, '#e8c060');
  // the windshaft boss the sails turn on
  fillPoly(c, [-3, MILL_HUB[1] + 4, 3, MILL_HUB[1] + 4, 4, MILL_HUB[1] - 4, -4, MILL_HUB[1] - 4], P.woodLo, P.woodInk, 0.8);
}
// the sails (live): four lattice sails with canvas, turning about the hub
export function millSails(ctx, x, y, d, ang) {
  ctx.save(); ctx.translate(x, y); ctx.scale(d * 0.92, d);
  for (let q = 0; q < 4; q++) {
    ctx.save(); ctx.rotate(ang + (q * TAU) / 4);
    // the stock
    ctx.fillStyle = '#5e3c1e'; ctx.fillRect(-2, -3, 4, -62);
    // lattice frame and canvas: a long panel beside the stock
    ctx.fillStyle = 'rgba(250,242,222,0.95)'; ctx.fillRect(2, -14, 13, -48);
    ctx.fillStyle = 'rgba(200,184,150,0.7)'; ctx.fillRect(10, -14, 5, -48);
    ctx.strokeStyle = '#6e4a28'; ctx.lineWidth = 1.2; ctx.strokeRect(2, -14, 13, -48);
    ctx.beginPath(); for (let k = 1; k < 6; k++) { ctx.moveTo(2, -14 - k * 8); ctx.lineTo(15, -14 - k * 8); } ctx.lineWidth = 0.8; ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = '#4a2c14'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill(); ctx.fillStyle = '#8a5a34'; ctx.beginPath(); ctx.arc(-1, -1, 3, 0, TAU); ctx.fill();
  ctx.restore();
}

// The Big Red Barn: a gambrel barn with white trim, big X doors, an open hayloft, a silo, a weather vane
export const BARN_VANE = [-8, -170]; // the vane's top (the crow lands here)
function paintBarn(c) {
  const D = [36, -24];
  // side wall (shade)
  const fx0 = -62, fx1 = 34, wh = 60;
  fillPoly(c, [fx1, 0, fx1 + D[0], D[1], fx1 + D[0], -wh + D[1], fx1, -wh], lg(c, fx1, 0, fx1 + D[0], 0, [P.redLo, dk(P.red, 0.4)]), P.redInk, 1);
  c.save(); poly(c, [fx1, 0, fx1 + D[0], D[1], fx1 + D[0], -wh + D[1], fx1, -wh]); c.clip();
  for (let k = 1; k < 8; k++) { const a = k / 8, x = lerp(fx1, fx1 + D[0], a), y = D[1] * a; c.strokeStyle = 'rgba(60,10,6,0.4)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - wh); c.stroke(); }
  c.restore();
  fillPoly(c, [fx1 + 12, -30 + D[1] * 0.33, fx1 + 24, -30 + D[1] * 0.66, fx1 + 24, -46 + D[1] * 0.66, fx1 + 12, -46 + D[1] * 0.33], '#3a3036', P.cream, 1.6);
  // the gambrel front
  const knee = 30, ap = [-14, -122];
  const front = [fx0, 0, fx1, 0, fx1, -wh, fx1 - 8, -wh - knee, ap[0], ap[1], fx0 + 8, -wh - knee, fx0, -wh];
  fillPoly(c, front, lg(c, fx0, ap[1], fx1, 0, [P.redHi, P.red, mix(P.red, P.redLo, 0.6)]), P.redInk, 1.2);
  c.save(); poly(c, front); c.clip();
  for (let x = fx0 + 6; x < fx1; x += 6) { c.strokeStyle = 'rgba(80,14,8,0.35)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, -130); c.stroke(); c.strokeStyle = 'rgba(255,170,150,0.18)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(x + 1, 0); c.lineTo(x + 1, -130); c.stroke(); }
  c.fillStyle = 'rgba(60,10,4,0.16)'; c.fillRect(fx0, -8, fx1 - fx0, 8);
  c.restore();
  // roof planes on the right: lower (steep) and upper (shallow), slate shingles
  const k1 = [fx1 - 8, -wh - knee], e0 = [fx1 + 3, -wh + 2];
  const lower = [e0[0], e0[1], k1[0], k1[1], k1[0] + D[0], k1[1] + D[1], e0[0] + D[0], e0[1] + D[1]];
  const upper = [k1[0], k1[1], ap[0], ap[1], ap[0] + D[0], ap[1] + D[1], k1[0] + D[0], k1[1] + D[1]];
  for (const [pl, c0, c1] of [[lower, P.slate, P.slateLo], [upper, P.slateHi, P.slate]]) {
    fillPoly(c, pl, lg(c, pl[2], pl[3], pl[6], pl[7], [c0, c1]), '#3a424c', 1);
    c.save(); poly(c, pl); c.clip();
    for (let k = 1; k < 8; k++) { const a = k / 8, xa = lerp(pl[0], pl[2], a), ya = lerp(pl[1], pl[3], a); c.strokeStyle = 'rgba(30,36,44,0.45)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(xa, ya); c.lineTo(xa + D[0], ya + D[1]); c.stroke(); }
    c.restore();
  }
  c.fillStyle = 'rgba(255,255,255,0.18)'; poly(c, [ap[0], ap[1], ap[0] + D[0], ap[1] + D[1], ap[0] + D[0] + 3, ap[1] + D[1] + 4, ap[0] + 3, ap[1] + 4]); c.fill();
  // white trim along the gambrel edge and the corners
  c.lineJoin = 'round';
  c.strokeStyle = dk(P.cream, 0.35); c.lineWidth = 5.2; c.beginPath(); c.moveTo(fx0 - 3, -wh + 1); c.lineTo(fx0 + 7, -wh - knee - 1); c.lineTo(ap[0], ap[1] - 2); c.lineTo(fx1 - 7, -wh - knee - 1); c.lineTo(fx1 + 3, -wh + 1); c.stroke();
  c.strokeStyle = P.cream; c.lineWidth = 3.6; c.stroke();
  for (const x of [fx0 + 1.5, fx1 - 1.5]) fillPoly(c, [x - 2, 0, x + 2, 0, x + 2, -wh, x - 2, -wh], x < 0 ? P.cream : P.creamLo);
  // the hayloft: an open door, hay inside, a beam with a pulley above
  const hx = ap[0], hy = -wh - 14;
  fillPoly(c, [hx - 13, hy, hx + 13, hy, hx + 13, hy - 26, hx - 13, hy - 26], P.cream);
  fillPoly(c, [hx - 10, hy - 1, hx + 10, hy - 1, hx + 10, hy - 23, hx - 10, hy - 23], '#2a1a12');
  c.save(); poly(c, [hx - 10, hy - 1, hx + 10, hy - 1, hx + 10, hy - 23, hx - 10, hy - 23]); c.clip();
  c.beginPath(); c.moveTo(hx - 11, hy); c.quadraticCurveTo(hx - 6, hy - 12, hx, hy - 10); c.quadraticCurveTo(hx + 6, hy - 14, hx + 11, hy); c.closePath(); c.fillStyle = lg(c, 0, hy - 14, 0, hy, [P.strawHi, P.strawLo]); c.fill();
  c.restore();
  c.strokeStyle = P.strawHi; c.lineWidth = 1; for (let k = 0; k < 7; k++) { const x = hx - 9 + k * 3; c.beginPath(); c.moveTo(x, hy - 1); c.lineTo(x + (k % 2 ? 2 : -2), hy + 4); c.stroke(); }
  fillPoly(c, [hx + 10, hy - 1, hx + 20, hy + 3, hx + 20, hy - 21, hx + 10, hy - 23], '#b03a2a', P.cream, 1.4); // the open shutter
  fillPoly(c, [hx - 3, hy - 32, hx + 3, hy - 32, hx + 3 + 8, hy - 38, hx - 3 + 8, hy - 38], P.woodLo, P.woodInk, 0.8);
  c.strokeStyle = '#6a5a40'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(hx + 8, hy - 34); c.lineTo(hx + 8, hy - 18); c.stroke(); ell(c, hx + 8, hy - 34, 2.2, 2.2, '#6e7480');
  // the big doors with white X braces
  const dx0 = fx0 + 18, dx1 = fx1 - 18, dh = 44;
  fillPoly(c, [dx0 - 3, 0, dx1 + 3, 0, dx1 + 3, -dh - 3, dx0 - 3, -dh - 3], P.cream, dk(P.cream, 0.3), 0.8);
  const mid = (dx0 + dx1) / 2;
  for (const [a, b] of [[dx0, mid], [mid, dx1]]) {
    fillPoly(c, [a + 1, 0, b - 1, 0, b - 1, -dh, a + 1, -dh], lg(c, a, -dh, b, 0, [P.redHi, P.red]), dk(P.red, 0.4), 0.8);
    c.strokeStyle = dk(P.cream, 0.3); c.lineWidth = 3.6; c.beginPath(); c.moveTo(a + 2, -2); c.lineTo(b - 2, -dh + 2); c.moveTo(b - 2, -2); c.lineTo(a + 2, -dh + 2); c.rect(a + 1.5, -dh + 0.5, b - a - 3, dh - 1); c.stroke();
    c.strokeStyle = P.cream; c.lineWidth = 2.4; c.stroke();
  }
  fillPoly(c, [dx0 - 6, -dh - 6, dx1 + 6, -dh - 6, dx1 + 6, -dh - 3, dx0 - 6, -dh - 3], '#4a4440');
  // a lantern by the door, a hay bale and a milk can
  fillPoly(c, [dx1 + 7, -36, dx1 + 12, -36, dx1 + 12, -28, dx1 + 7, -28], '#3a3030'); ell(c, dx1 + 9.5, -32, 1.6, 2.4, '#ffd76a');
  bale(c, fx0 - 2, 2, 22, 13, 12);
  fillPoly(c, [fx1 + 6, 2, fx1 + 14, 2, fx1 + 14, -12, fx1 + 6, -12], lg(c, fx1 + 6, 0, fx1 + 14, 0, ['#dfe4ea', '#9aa4ae']), '#5a646e', 0.7); ell(c, fx1 + 10, -12, 4, 1.4, '#c8d0d8'); fillPoly(c, [fx1 + 8, -12, fx1 + 12, -12, fx1 + 11.5, -16, fx1 + 8.5, -16], '#aab4be', '#5a646e', 0.6);
  // the weather vane on the ridge: a pole, the arms, a cockerel
  const vx = ap[0] + D[0] * 0.2, vy = ap[1] + D[1] * 0.2;
  c.strokeStyle = '#3a3a3e'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(vx, vy); c.lineTo(vx, vy - 38); c.moveTo(vx - 9, vy - 20); c.lineTo(vx + 9, vy - 20); c.moveTo(vx - 4, vy - 24); c.lineTo(vx + 4, vy - 16); c.stroke();
  ell(c, vx, vy - 3, 2.6, 2, '#3a3a3e');
  c.fillStyle = '#3a3a3e'; c.beginPath(); c.moveTo(vx - 12, vy - 33); c.quadraticCurveTo(vx - 6, vy - 41, vx + 2, vy - 36); c.lineTo(vx + 6, vy - 42); c.lineTo(vx + 9, vy - 38); c.lineTo(vx + 6, vy - 33); c.quadraticCurveTo(vx, vy - 30, vx - 12, vy - 33); c.fill();
  c.beginPath(); c.moveTo(vx - 12, vy - 33); c.lineTo(vx - 17, vy - 40); c.lineTo(vx - 15, vy - 32); c.fill();
}
// the landmarks' shadows lie on the ground: painted into the band (under the next level's glow), not into the sprites
const LM_SHADOW = {
  coop: (c) => { longShadow(c, -46, 46, 90); softShadow(c, -6, 0, 58, 10, 0.42); },
  hay: (c) => { longShadow(c, -50, 50, 70); softShadow(c, 0, 0, 58, 10, 0.42); },
  mill: (c) => { longShadow(c, -30, 30, 120); softShadow(c, 0, 0, 42, 9, 0.42); },
  barn: (c) => { longShadow(c, -62, 70, 100); softShadow(c, 6, -4, 80, 14, 0.42); },
};
const LM_PAINT = { coop: paintCoop, hay: paintHay, pond: paintPond, mill: paintMill, barn: paintBarn };

// ------------------------------------------------------------------ landmarks on the map (called by main.js)
// p: the press (0 rest .. 1 held), same squash as a button. glow: 0..1 the breathing golden glow of the next level.
export function drawFarmLandmark(ctx, L, m, sy, t, calm, p, glow, DPR) {
  const y = drawLandmarkBody(ctx, m, sy, t, calm, p, glow, DPR);
  if (y == null) return;
  // live bits
  if (m.kind === 'mill') { const d = m.d; ctx.save(); if (p && !calm) { ctx.translate(m.x, y); ctx.scale(1 + 0.035 * p, 1 - 0.045 * p); ctx.translate(-m.x, -y); } millSails(ctx, m.x + MILL_HUB[0] * d, y + MILL_HUB[1] * d, d, calm ? 0.35 : t * 0.7); ctx.restore(); }
}
// the shared part: the next level's glow pool, the stamped body (squashed by a press), the golden motes; returns the
// foot's screen y (null when the sprite is not ready)
export function drawLandmarkBody(ctx, m, sy, t, calm, p, glow, DPR, paint, glowCol = '#ffe27a', moteCol = '#fff1a8') {
  const y = m.y - sy, d = m.d, S = m.S;
  const gcx = m.x + ((S.x0 + S.x1) / 2) * d * (m.flip ? -1 : 1), grx = (S.x1 - S.x0) * d * 0.7;
  if (glow > 0) { // layered ellipses make a soft pool of warm light (no gradient per frame)
    ctx.save(); ctx.fillStyle = glowCol;
    for (let q = 0; q < 5; q++) { const k = 1 - q * 0.17; ctx.globalAlpha = glow * 0.26; ctx.beginPath(); ctx.ellipse(gcx, y + 2 * d, grx * k, grx * 0.36 * k, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  const e = landmarkSprite(m, DPR, paint); if (!e) return null;
  ctx.save();
  if (p && !calm) { ctx.translate(m.x, y); ctx.scale(1 + 0.035 * p, 1 - 0.045 * p); ctx.translate(-m.x, -y); }
  const X = Math.round((m.x + (m.flip ? -e.x0 - e.w : e.x0)) * DPR) / DPR, Yy = Math.round((y + e.y0) * DPR) / DPR;
  if (m.flip) { ctx.translate(X + e.w, Yy); ctx.scale(-1, 1); ctx.drawImage(e.cv, 0, 0, e.w, e.h); } else ctx.drawImage(e.cv, X, Yy, e.w, e.h);
  ctx.restore();
  // the next level: golden motes drift up around it
  if (glow > 0 && !calm) {
    ctx.fillStyle = moteCol;
    for (let q = 0; q < 7; q++) { const a = fract(t * 0.35 + q / 7), mx = gcx + Math.sin(q * 2.4) * grx * 0.85 + Math.sin(t * 1.5 + q) * 4 * d, my = y - 6 * d - a * 90 * d, r = (2.2 + (q % 3) * 0.8) * d; ctx.globalAlpha = Math.min(1, a * 4) * (1 - a) * 0.95; ctx.beginPath(); ctx.arc(mx, my, r, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  return y;
}
// the plaque board on its post (main.js puts the number, stars or padlock on it); returns where those go
export function drawFarmPlaque(ctx, L, m, sy, p) {
  const u = L.u, b = m.plaque.board, x = m.plaque.x, y = m.plaque.y - sy, by = b.y - sy;
  ctx.save();
  if (p) { ctx.translate(x, y); ctx.scale(1 + 0.035 * p, 1 - 0.045 * p); ctx.translate(-x, -y); }
  // the post and its shadow
  ctx.beginPath(); ctx.ellipse(x + 3 * u, y, 9 * u, 2.6 * u, 0, 0, TAU); ctx.fillStyle = 'rgba(30,50,14,0.35)'; ctx.fill();
  ctx.fillStyle = P.woodInk; ctx.fillRect(x - 3.6 * u, by + b.h - 4 * u, 7.2 * u, y - by - b.h + 4 * u);
  ctx.fillStyle = P.wood; ctx.fillRect(x - 2.6 * u, by + b.h - 4 * u, 3.4 * u, y - by - b.h + 3 * u);
  ctx.fillStyle = P.woodLo; ctx.fillRect(x + 0.8 * u, by + b.h - 4 * u, 1.8 * u, y - by - b.h + 3 * u);
  // the board: two planks with a dark rim, lit top edge, nails
  const r = 7 * u, X0 = b.x, Y0 = by, w = b.w, h = b.h;
  rr(ctx, X0, Y0 + 3 * u, w, h, r); ctx.fillStyle = 'rgba(40,24,10,0.45)'; ctx.fill();
  rr(ctx, X0, Y0, w, h, r); ctx.fillStyle = P.woodInk; ctx.fill();
  rr(ctx, X0 + 2 * u, Y0 + 2 * u, w - 4 * u, h - 4 * u, r * 0.75); ctx.fillStyle = '#b78452'; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = '#c99760'; ctx.fillRect(X0, Y0, w, h * 0.5);
  ctx.fillStyle = 'rgba(255,236,200,0.35)'; ctx.fillRect(X0, Y0 + 2 * u, w, 2.2 * u);
  ctx.fillStyle = 'rgba(80,46,18,0.45)'; ctx.fillRect(X0, Y0 + h * 0.5 - 0.6 * u, w, 1.4 * u);
  ctx.fillStyle = 'rgba(80,46,18,0.18)'; ctx.fillRect(X0, Y0 + h - 7 * u, w, 7 * u);
  ctx.strokeStyle = 'rgba(110,70,30,0.35)'; ctx.lineWidth = 0.8 * u; ctx.beginPath(); ctx.moveTo(X0 + 8 * u, Y0 + 10 * u); ctx.quadraticCurveTo(X0 + w * 0.5, Y0 + 7 * u, X0 + w - 6 * u, Y0 + 12 * u); ctx.moveTo(X0 + 6 * u, Y0 + h * 0.5 + 9 * u); ctx.quadraticCurveTo(X0 + w * 0.5, Y0 + h * 0.5 + 12 * u, X0 + w - 9 * u, Y0 + h * 0.5 + 8 * u); ctx.stroke();
  ctx.restore();
  for (const [nx, ny] of [[X0 + 6 * u, Y0 + 6 * u], [X0 + w - 6 * u, Y0 + 6 * u], [X0 + 6 * u, Y0 + h - 6 * u], [X0 + w - 6 * u, Y0 + h - 6 * u]]) { ctx.beginPath(); ctx.arc(nx, ny, 1.5 * u, 0, TAU); ctx.fillStyle = '#5a4a3a'; ctx.fill(); ctx.beginPath(); ctx.arc(nx - 0.4 * u, ny - 0.4 * u, 0.6 * u, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill(); }
  ctx.restore();
  return { cx: x, num: by + h * 0.36, stars: by + h * 0.74, mid: by + h * 0.5, w, h, top: by };
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

// ------------------------------------------------------------------ the live layer
// Every routine is a pure function of the clock, seeded per creature so nobody moves in step. Pose changes are eased
// over ~0.25 s (win() ramps), never popped. The rooster's crow is the farm's clock: the weasel ducks, the napping chick
// wakes. Nothing runs across the road or over a plaque: each creature keeps to its own patch.
const RC = 8.6; // the rooster's cycle (s): stand, stretch up, crow, settle, preen
const crowAt = (t) => fract((t + 2.1) / RC) * RC; // seconds into the rooster's cycle
const CROW0 = 5.0, CROW1 = 6.5;
function win(t, a, b, f = 0.25) { return ss((t - a) / f) * (1 - ss((t - b) / f)); }
const POSE = {}; // reused blend target (no allocation per frame for the blend itself)
function blendInto(dst, src, w) { if (w <= 0) return; for (const k in src) { const v = src[k]; if (typeof v === 'number') dst[k] = (dst[k] ?? v) + (v - (dst[k] ?? v)) * w; else if (w > 0.5) dst[k] = v; } }
function copyInto(dst, src) { for (const k in dst) delete dst[k]; for (const k in src) dst[k] = src[k]; return dst; }
function spot(plan, k) { for (const p of plan.props) if (p.k === k) return p; return null; }
const vis = (y0, y1, vt, vb) => y1 >= vt && y0 <= vb;

export function drawFarmLive(ctx, L, sy, t, calm, vt = -Infinity, vb = Infinity) {
  const plan = farmPlan(L), u = L.u, T = calm ? 0 : t;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  try {
    const pond = plan.lms[2], hay = plan.lms[1];
    if (pond && vis(pond.y - 90 * pond.d - sy, pond.y - sy, vt, vb)) { pondGlints(ctx, pond, sy, T, calm); goose(ctx, pond, sy, T, calm); }
    const wh = spot(plan, 'wheat'); if (wh && vis(wh.y - 90 * u - sy, wh.y - sy, vt, vb)) wheatSway(ctx, wh, sy, u, T, calm);
    const wa = spot(plan, 'washing'); if (wa && vis(wa.y - 70 * u - sy, wa.y - sy, vt, vb)) washing(ctx, wa, sy, u, T, calm);
    const fh = spot(plan, 'farmhouse'); if (fh && !calm && vis(fh.y - 200 * u - sy, fh.y - sy, vt, vb)) smoke(ctx, fh.x + FARMHOUSE_CHIMNEY[0] * u * fh.s, fh.y - sy + FARMHOUSE_CHIMNEY[1] * u * fh.s, u, T);
    const ch = spot(plan, 'chicks');
    if (hay && vis(hay.y - 140 * hay.d - sy, hay.y - sy, vt, vb)) weasel(ctx, hay, ch, sy, T, calm, u);
    const rp = spot(plan, 'roosterPost'); if (rp && vis(rp.y - 130 * u - sy, rp.y + 10 * u - sy, vt, vb)) rooster(ctx, rp, sy, u, T, calm);
    if (ch && vis(ch.y - 80 * u - sy, ch.y + 20 * u - sy, vt, vb)) chicks(ctx, ch, hay, sy, u, T, calm);
    const fl = fh || ch; if (fl && !calm && vis(fl.y - 140 * u - sy, fl.y - sy, vt, vb)) { const bx = fl.x + 60 * u, by = fl.y - 20 * u - sy; const a = T * 0.7 + 1.3; butterfly(ctx, bx + Math.sin(a) * 34 * u, by + Math.sin(a * 1.6) * 14 * u - 10 * u, 5.5 * u, T * 12.5, '#ffffff'); }
  } catch (e) { /* art never breaks the map */ }
  ctx.restore();
}
// over the landmarks: the crow (it lands on the barn's weather vane and on the scarecrow)
export function drawFarmFront(ctx, L, sy, t, calm, vt = -Infinity, vb = Infinity) {
  const plan = farmPlan(L), u = L.u, T = calm ? 0 : t, barn = plan.lms[4], sc = spot(plan, 'scarecrow');
  if (!barn || !sc) return;
  const A = { x: sc.x + 2 * u * sc.s, y: sc.y - 67 * u * sc.s }, B = { x: barn.x + BARN_VANE[0] * barn.d, y: barn.y + BARN_VANE[1] * barn.d };
  if (!vis(Math.min(A.y, B.y) - 60 * u - sy, Math.max(A.y, B.y) + 10 * u - sy, vt, vb)) return;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  try { crowBird(ctx, A, B, sy, u, T, calm); } catch (e) { /* art never breaks the map */ }
  ctx.restore();
}

// the rooster on his post: stands and looks about, stretches up, crows (notes float off), settles, preens
function rooster(ctx, rp, sy, u, t, calm) {
  const s = rp.s * u, x = rp.x, y = rp.y - sy - 42 * s, S = 46 * u, face = -1; // faces the coop / the road
  const c = crowAt(t);
  const look = Math.sin(t * 0.7) > 0.6 ? 1 : 0; // now and then glances back
  const base = roosterPose('idle', 0, t), Pp = copyInto(POSE, base);
  if (!calm) {
    const wS = win(c, CROW0 - 0.55, CROW0 + 0.05, 0.3), wC = win(c, CROW0, CROW1, 0.2), wR = win(c, 7.0, 8.3, 0.3);
    blendInto(Pp, roosterPose('puff', clamp((c - (CROW0 - 0.55)) / 0.55, 0, 1), t), wS);
    blendInto(Pp, roosterPose('crow', clamp((c - CROW0) / (CROW1 - CROW0), 0, 1), t), wC);
    if (wR > 0) { const pr = Math.sin((c - 7) * 9) * 0.5 + 0.5; blendInto(Pp, { hr: 1.05 + pr * 0.25, hx: -10, hy: 13, beak: 0.15, eye: 'closed', shut: 0.85, wa: 2.25 + pr * 0.15, sp: 0.25, lean: 0.06, lidU: 0.6 }, wR); }
  }
  ctx.save(); ctx.translate(x, y); ctx.scale(face * (look && !calm ? -1 : 1), 1); drawRooster(ctx, 0, -S * 0.48, S, Pp); ctx.restore();
  if (!calm && c > CROW0 + 0.15 && c < CROW1 + 1.6) for (let k = 0; k < 3; k++) { // music notes float off the beak
    const a = (c - CROW0 - 0.15 - k * 0.38) / 1.6; if (a <= 0 || a >= 1) continue;
    const nx = x + face * (20 + a * 26) * u + Math.sin(a * 6 + k) * 4 * u, ny = y - S * 0.95 - a * 34 * u;
    note(ctx, nx, ny, (6 + k) * u, Math.min(1, a * 6) * (1 - ss((a - 0.6) / 0.4)), k % 2);
  }
}
function note(ctx, x, y, s, al, dbl) {
  ctx.save(); ctx.globalAlpha = al; ctx.translate(x, y); ctx.rotate(-0.2);
  ctx.fillStyle = '#fffbea'; ctx.strokeStyle = 'rgba(90,60,20,0.75)'; ctx.lineWidth = Math.max(1, s * 0.16);
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.42, s * 0.3, -0.4, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(s * 0.36, -s * 0.08); ctx.lineTo(s * 0.36, -s * 1.3); ctx.quadraticCurveTo(s * 0.8, -s * 1.1, s * 0.9, -s * 0.7); ctx.stroke();
  if (dbl) { ctx.beginPath(); ctx.ellipse(s * 1.0, -s * 0.2, s * 0.42, s * 0.3, -0.4, 0, TAU); ctx.fill(); ctx.stroke(); }
  ctx.restore();
}

// three chicks by the haystacks: one pecks about, one chases a butterfly in a figure of eight, one naps (wakes at the crow)
function chicks(ctx, ch, hay, sy, u, t, calm) {
  const x = ch.x, y = ch.y - sy, cs = 17 * u;
  // the napper, in the hay's shade
  const nx = x + 30 * u, ny = y + 6 * u, c = crowAt(t), awake = calm ? 0 : win(c, CROW0 + 0.1, CROW0 + 2.6, 0.3);
  const startle = calm ? 0 : Math.max(0, Math.sin(clamp((c - CROW0 - 0.1) / 0.45, 0, 1) * Math.PI));
  ctx.beginPath(); ctx.ellipse(nx + 2 * u, ny + 1 * u, 10 * u, 2.6 * u, 0, 0, TAU); ctx.fillStyle = 'rgba(30,50,10,0.25)'; ctx.fill();
  ctx.save(); ctx.translate(nx, ny - startle * 9 * u); ctx.scale(1 + 0.08 * (1 - awake), 1 - 0.14 * (1 - awake));
  drawChick(ctx, 0, -cs * 0.69, cs, awake > 0.5 ? t : 0, startle, 0);
  if (awake < 0.5) sleepyEyes(ctx, cs); // eyes shut while asleep
  ctx.restore();
  if (!calm && awake < 0.05) for (let k = 0; k < 2; k++) { const a = fract(t * 0.32 + k * 0.5); zee(ctx, nx + (6 + a * 14) * u, ny - cs * 1.6 - a * 22 * u, (4 + a * 3) * u, Math.min(1, a * 5) * (1 - a)); }
  // the pecker: pecks, looks up, hops to the next spot
  const pc = fract((t + 0.7) / 3.4) * 3.4, hopK = ss((pc - 2.9) / 0.5), step = Math.floor((t + 0.7) / 3.4);
  const P3 = [-30, -18, -40], px0 = P3[((step % 3) + 3) % 3] * u, px1 = P3[(((step + 1) % 3) + 3) % 3] * u, px = x + lerp(px0, px1, hopK), hopY = Math.sin(hopK * Math.PI) * 5 * u;
  const peck = calm ? 0 : win(pc, 0.1, 1.9, 0.2);
  ctx.beginPath(); ctx.ellipse(px + 1.5 * u, y + 1 * u, 9 * u, 2.4 * u, 0, 0, TAU); ctx.fillStyle = 'rgba(30,50,10,0.25)'; ctx.fill();
  drawChick(ctx, px, y - cs * 0.69 - hopY, cs, t * 1.1 + 2, 0, peck);
  // the chaser: a figure of eight after a butterfly, leaning into the turns
  const th = t * 1.25, R1 = 30 * u, R2 = 11 * u, cx = x + 2 * u, cy = y - 22 * u;
  const fx = cx + Math.sin(th) * R1, fy = cy + Math.sin(th) * Math.cos(th) * R2 * 2, vx = Math.cos(th), hop = Math.abs(Math.sin(t * 9)) * 3 * u;
  ctx.beginPath(); ctx.ellipse(fx + 1.5 * u, fy + 1 * u, 9 * u, 2.4 * u, 0, 0, TAU); ctx.fillStyle = 'rgba(30,50,10,0.25)'; ctx.fill();
  ctx.save(); ctx.translate(fx, fy - hop); ctx.rotate(calm ? 0 : vx * 0.2); ctx.scale(calm ? 1 : 0.9 + 0.1 * Math.abs(vx), 1); drawChick(ctx, vx * 2 * u, -cs * 0.69, cs, t * 2, calm ? 0 : 0.35, 0); ctx.restore();
  if (!calm) { const b = th + 0.7, bx = cx + Math.sin(b) * R1, by = cy + Math.sin(b) * Math.cos(b) * R2 * 2 - 26 * u - Math.sin(t * 3) * 4 * u; butterfly(ctx, bx, by, 5 * u, t * 13, '#ffd23a'); }
}
// closed eyes over a chick (drawChick has no shut eyes): paint the eyes out, then two sleepy arcs
function sleepyEyes(ctx, cs) {
  const k = (cs * 1.5) / 100;
  ctx.save(); ctx.translate(0, -cs * 0.69 - cs * 0.04); ctx.scale(k, k);
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * 11.5, 6, 7.4, 8.6, 0, 0, TAU); ctx.fillStyle = '#ffd94a'; ctx.fill(); }
  ctx.strokeStyle = '#5a3412'; ctx.lineWidth = 3; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * 11.5, 4, 5.5, 0.25, Math.PI - 0.25); ctx.stroke(); }
  ctx.restore();
}
function zee(ctx, x, y, s, al) { ctx.save(); ctx.globalAlpha = al; ctx.strokeStyle = 'rgba(70,60,110,0.85)'; ctx.lineWidth = Math.max(1, s * 0.22); ctx.beginPath(); ctx.moveTo(x - s * 0.5, y - s * 0.5); ctx.lineTo(x + s * 0.5, y - s * 0.5); ctx.lineTo(x - s * 0.5, y + s * 0.5); ctx.lineTo(x + s * 0.5, y + s * 0.5); ctx.stroke(); ctx.restore(); }
function butterfly(ctx, x, y, s, flap, col) {
  const f = 0.25 + 0.75 * Math.abs(Math.sin(flap));
  ctx.fillStyle = col; ctx.strokeStyle = 'rgba(80,50,20,0.55)'; ctx.lineWidth = Math.max(0.6, s * 0.08);
  ctx.beginPath(); ctx.ellipse(x - s * 0.45 * f, y - s * 0.15, s * 0.45 * f, s * 0.55, -0.35, 0, TAU); ctx.ellipse(x + s * 0.45 * f, y - s * 0.15, s * 0.45 * f, s * 0.55, 0.35, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x - s * 0.3 * f, y + s * 0.3, s * 0.3 * f, s * 0.32, -0.2, 0, TAU); ctx.ellipse(x + s * 0.3 * f, y + s * 0.3, s * 0.3 * f, s * 0.32, 0.2, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - s * 0.06, y - s * 0.45, s * 0.12, s * 0.9);
}

// the weasel behind the haystacks: rises to peek (eyes and ears over the top bale), eyes on the chicks, ducks at the crow
function weasel(ctx, hay, ch, sy, t, calm, u) {
  const d = hay.d, c = crowAt(t);
  const up = calm ? 0.8 : ss((c - 0.9) / 0.6) * (1 - ss((c - CROW0) / 0.22));
  if (up <= 0.01) return;
  const x = hay.x + WEASEL_SPOT[0] * d, foot = hay.y + WEASEL_SPOT[1] * d - sy, hide = 34 * u * (1 - up);
  const toward = ch ? Math.sign(ch.x - hay.x) || -1 : -1;
  const P = thiefPose('weasel', 'stand', t, 0, 0);
  const glance = calm ? 0.6 : 0.4 + 0.6 * ss((Math.sin(t * 0.8) + 0.2) * 1.4);
  P.look = glance; P.ear = 0.15 + 0.2 * Math.sin(t * 3.1); P.lid = 0.35; P.brow = 0.6;
  ctx.save(); ctx.beginPath(); ctx.rect(x - 60 * u, foot - 90 * u, 120 * u, 90 * u - 6 * d); ctx.clip();
  drawThief(ctx, x, foot + hide + 22 * u, 40 * u, t, P, { face: toward }, 'weasel');
  ctx.restore();
}

// the goose on the pond: paddles to one end, dips its head, turns round, paddles back; ripples and a V wake
function goose(ctx, pond, sy, t, calm) {
  const d = pond.d, cx = pond.x - 4 * d, wy = pond.y - 32 * d - sy, xa = cx - 62 * d, xb = cx + 4 * d, Cy = 15;
  const k = fract((t + 3.3) / Cy) * Cy;
  let gx, dir, mv = 0, dip = 0;
  if (k < 5.5) { const e = ss(k / 5.5); gx = lerp(xa, xb, e); dir = 1; mv = Math.sin((k / 5.5) * Math.PI); }
  else if (k < 7.5) { gx = xb; dip = win(k, 5.8, 6.9, 0.25); dir = 1 - 2 * ss((k - 6.95) / 0.5); }
  else if (k < 13) { const e = ss((k - 7.5) / 5.5); gx = lerp(xb, xa, e); dir = -1; mv = Math.sin(((k - 7.5) / 5.5) * Math.PI); }
  else { gx = xa; dip = win(k, 13.3, 14.4, 0.25); dir = -1 + 2 * ss((k - 14.45) / 0.5); }
  if (calm) { gx = lerp(xa, xb, 0.4); dir = 1; mv = 0; dip = 0; }
  const bob = calm ? 0 : Math.sin(t * 2.2) * 0.8 * d, S = 40 * d, sgn = dir >= 0 ? 1 : -1;
  // wake and ripples, on the water under the bird
  if (!calm) {
    ctx.strokeStyle = 'rgba(230,250,255,0.6)'; ctx.lineWidth = 1.2 * d;
    for (let q = 0; q < 2; q++) { const a = fract(t * 0.45 + q * 0.5); ctx.globalAlpha = (1 - a) * 0.8; ctx.beginPath(); ctx.ellipse(gx, wy + 2 * d, (12 + a * 22) * d, (3 + a * 5) * d, 0, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = mv * 0.7;
    const tx = gx - sgn * 14 * d; ctx.beginPath(); ctx.moveTo(tx, wy + 1 * d); ctx.lineTo(tx - sgn * 26 * d, wy - 5 * d); ctx.moveTo(tx, wy + 3 * d); ctx.lineTo(tx - sgn * 26 * d, wy + 8 * d); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.beginPath(); ctx.ellipse(gx, wy + 2 * d, 17 * d, 4 * d, 0, 0, TAU); ctx.fillStyle = 'rgba(20,60,80,0.3)'; ctx.fill();
  // the bird, cut at the waterline (it floats: no legs)
  const P = dip > 0 ? goosePose('hiss', 0.12 + dip * 0.3, 0) : goosePose('idle', 0, t);
  if (dip > 0) { P.beak = 0; P.eye = 'open'; P.wa = 2.95; P.sp = 0; P.legs = 'stand'; P.lean = 0.25 * dip; P.hy = (P.hy || 0) + 16 * dip; P.hx = (P.hx || 0) + 4 * dip; }
  ctx.save(); ctx.beginPath(); ctx.rect(gx - 60 * d, wy - 80 * d, 120 * d, 80 * d + 1.5 * d); ctx.clip();
  ctx.translate(gx, wy + bob + 9 * d); ctx.scale(dir, 1); drawGoose(ctx, 0, -S * 0.63, S, P); ctx.restore();
  // a lit line where the body meets the water
  ctx.strokeStyle = 'rgba(235,252,255,0.75)'; ctx.lineWidth = 1.2 * d; ctx.beginPath(); ctx.ellipse(gx, wy + 1.5 * d, 15 * d, 2.6 * d, 0, 0.1, Math.PI - 0.1); ctx.stroke();
}
function pondGlints(ctx, pond, sy, t, calm) {
  if (calm) return;
  const d = pond.d, cx = pond.x - 4 * d, cy = pond.y - 36 * d - sy;
  ctx.fillStyle = '#ffffff';
  for (let q = 0; q < 4; q++) {
    const a = Math.max(0, Math.sin(t * 1.3 + q * 1.9)), r = a * 3 * d; if (r < 0.3) continue;
    const x = cx + [30, -20, 50, -60][q] * d, y = cy + [6, -10, -6, 8][q] * d;
    ctx.globalAlpha = a * 0.9; ctx.beginPath(); ctx.moveTo(x, y - r * 1.8); ctx.quadraticCurveTo(x, y, x + r * 1.8, y); ctx.quadraticCurveTo(x, y, x, y + r * 1.8); ctx.quadraticCurveTo(x, y, x - r * 1.8, y); ctx.quadraticCurveTo(x, y, x, y - r * 1.8); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// the crow: perched on the scarecrow, flies to the barn's vane, lands, sits a while, flies back
function crowBird(ctx, A, B, sy, u, t, calm) {
  const Cy = 19, k = fract((t + 4.2) / Cy) * Cy, s = 15 * u;
  let x, y, fly = 0, flap = 0, face = 1, hop = 0;
  const arc = (p, a, b) => { const e = ss(p), mx = Math.max(a.x, b.x) + 60 * u, my = Math.min(a.y, b.y) + Math.abs(a.y - b.y) * 0.2; const ix = lerp(lerp(a.x, mx, e), lerp(mx, b.x, e), e), iy = lerp(lerp(a.y, my, e), lerp(my, b.y, e), e); return [ix, iy]; };
  if (calm || k < 6) { x = A.x; y = A.y; face = B.x > A.x ? 1 : -1; hop = calm ? 0 : Math.max(0, Math.sin(k * 2.2)) * win(k, 2, 3.2, 0.2) * 3 * u; }
  else if (k < 8.6) { const p = (k - 6) / 2.6; [x, y] = arc(p, A, B); fly = win(k, 6, 8.6, 0.18); face = B.x > A.x ? 1 : -1; flap = t * 16; }
  else if (k < 15.5) { x = B.x; y = B.y; face = A.x > B.x ? 1 : -1; hop = Math.max(0, Math.sin(k * 2.6)) * win(k, 11, 12.2, 0.2) * 3 * u; }
  else if (k < 18.1) { const p = (k - 15.5) / 2.6; [x, y] = arc(p, B, A); fly = win(k, 15.5, 18.1, 0.18); face = A.x > B.x ? 1 : -1; flap = t * 16; }
  else { x = A.x; y = A.y; face = B.x > A.x ? 1 : -1; }
  drawCrow(ctx, x, y - sy - hop, s, face, fly, flap, calm ? 0 : t);
}
function drawCrow(ctx, x, y, s, face, fly, flap, t) {
  ctx.save(); ctx.translate(x, y); ctx.scale(face * s / 20, s / 20);
  const ink = '#1a1c24', body = '#2d3140', hi = '#4c5468';
  // legs (tucked in flight)
  if (fly < 0.5) { ctx.strokeStyle = '#4a4036'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-1, -6); ctx.lineTo(-2, 0); ctx.moveTo(2, -6); ctx.lineTo(2, 0); ctx.stroke(); }
  const by = -11 - fly * 2;
  // far wing
  const wa = fly > 0 ? Math.sin(flap) : 0;
  if (fly > 0) { ctx.save(); ctx.translate(1, by - 3); ctx.rotate(-0.4 - wa * 0.9 * fly); ctx.fillStyle = ink; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-6, -14, -2, -22); ctx.quadraticCurveTo(4, -12, 6, 0); ctx.closePath(); ctx.fill(); ctx.restore(); }
  // tail
  ctx.fillStyle = ink; ctx.beginPath(); ctx.moveTo(-6, by + 2); ctx.lineTo(-16, by + 6 - fly * 4); ctx.lineTo(-15, by + 9 - fly * 4); ctx.lineTo(-5, by + 5); ctx.closePath(); ctx.fill();
  // body: dark with a lit back
  ctx.beginPath(); ctx.ellipse(0, by, 9, 6.5, -0.15 - fly * 0.2, 0, TAU); ctx.fillStyle = body; ctx.fill();
  ctx.beginPath(); ctx.ellipse(-1, by - 2.5, 6, 3, -0.2, 0, TAU); ctx.fillStyle = hi; ctx.fill();
  // head
  const hb = fly > 0 ? 0 : Math.sin(t * 2.3) * 0.8;
  ctx.beginPath(); ctx.arc(7, by - 6 + hb, 4.8, 0, TAU); ctx.fillStyle = body; ctx.fill();
  ctx.beginPath(); ctx.arc(6, by - 7.5 + hb, 2.4, 0, TAU); ctx.fillStyle = hi; ctx.fill();
  ctx.fillStyle = '#5a5a52'; ctx.beginPath(); ctx.moveTo(10.5, by - 7 + hb); ctx.lineTo(16, by - 5 + hb); ctx.lineTo(10.5, by - 4 + hb); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(8.4, by - 7 + hb, 1.1, 0, TAU); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(8.7, by - 7 + hb, 0.6, 0, TAU); ctx.fill();
  // near wing: folded on the side, or beating
  ctx.save(); ctx.translate(-1, by - 1);
  if (fly > 0) ctx.rotate(-0.2 - wa * 1.1 * fly);
  ctx.fillStyle = '#23262f'; ctx.beginPath(); ctx.moveTo(4, -2); ctx.quadraticCurveTo(-4 - fly * 4, -4 - fly * 16, -12 + fly * 6, 2 - fly * 20); ctx.quadraticCurveTo(-4, 4, 4, 2); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
}

// the washing on the line: three things sway in the breeze, each to its own beat
function washing(ctx, wa, sy, u, t, calm) {
  const s = wa.s * u, x0 = wa.x - 44 * s, x1 = wa.x + 44 * s, y = wa.y - sy - 44 * s, sag = 7 * s;
  const at = (v) => y + Math.sin(v * Math.PI) * sag;
  ctx.strokeStyle = 'rgba(240,236,224,0.95)'; ctx.lineWidth = 0.9 * s; ctx.beginPath(); ctx.moveTo(x0, y); ctx.quadraticCurveTo((x0 + x1) / 2, y + sag * 2, x1, y); ctx.stroke();
  const items = [[0.2, 20, 24, '#ffffff', '#dcd8cc'], [0.5, 16, 18, '#e85a4a', '#b8402e'], [0.76, 14, 20, '#7ab0e0', '#5a88b8']];
  for (let q = 0; q < 3; q++) {
    const [v, w, h, c0, c1] = items[q], px = lerp(x0, x1, v), py = at(v), sw = calm ? 0 : Math.sin(t * 1.7 + q * 1.3) * 0.12 + Math.sin(t * 2.9 + q) * 0.04;
    ctx.save(); ctx.translate(px, py); ctx.rotate(sw);
    ctx.beginPath(); ctx.moveTo(-w * s / 2, 0); ctx.lineTo(w * s / 2, 0); ctx.quadraticCurveTo(w * s / 2 + sw * 20 * s, h * s * 0.6, w * s / 2 + sw * 10 * s, h * s); ctx.lineTo(-w * s / 2 + sw * 10 * s, h * s); ctx.quadraticCurveTo(-w * s / 2 + sw * 18 * s, h * s * 0.5, -w * s / 2, 0); ctx.closePath();
    ctx.fillStyle = c0; ctx.fill(); ctx.strokeStyle = dk(c1, 0.3); ctx.lineWidth = 0.7 * s; ctx.stroke();
    ctx.fillStyle = c1; ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.moveTo(w * s * 0.1, 0); ctx.lineTo(w * s / 2, 0); ctx.lineTo(w * s / 2 + sw * 10 * s, h * s); ctx.lineTo(w * s * 0.1 + sw * 10 * s, h * s); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#c8a070'; ctx.fillRect(-w * s * 0.3 - 0.8 * s, -2 * s, 1.6 * s, 3.4 * s); ctx.fillRect(w * s * 0.3 - 0.8 * s, -2 * s, 1.6 * s, 3.4 * s);
    ctx.restore();
  }
}
// a thin curl of smoke from the farmhouse chimney
function smoke(ctx, x, y, u, t) {
  for (let q = 0; q < 5; q++) {
    const a = fract(t * 0.16 + q / 5), r = (3 + a * 9) * u;
    ctx.globalAlpha = 0.5 * Math.min(1, a * 5) * (1 - a);
    ctx.beginPath(); ctx.arc(x + a * 22 * u + Math.sin(a * 6 + q) * 3 * u, y - a * 64 * u, r, 0, TAU); ctx.fillStyle = '#f4f0ea'; ctx.fill();
  }
  ctx.globalAlpha = 1;
}
// the front row of the wheat patch sways
function wheatSway(ctx, wh, sy, u, t, calm) {
  const s = wh.s * u, w = 96 * s, x0 = wh.x - w / 2, y = wh.y - sy;
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const bx = x0 + 3 * s + i * (w - 6 * s) / 25, l = (12 + ((i * 7) % 5)) * s, a = calm ? 0.1 : 0.12 + Math.sin(t * 1.4 - i * 0.35) * 0.14;
    const tx = bx + Math.sin(a) * l, ty = y - Math.cos(a) * l;
    ctx.strokeStyle = '#b9862e'; ctx.lineWidth = 0.9 * s; ctx.beginPath(); ctx.moveTo(bx, y); ctx.quadraticCurveTo(bx, y - l * 0.5, tx, ty); ctx.stroke();
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(0, -3 * s, 1.7 * s, 3.8 * s, 0, 0, TAU); ctx.fillStyle = i % 3 ? '#efc055' : '#f8dc8a'; ctx.fill(); ctx.restore();
  }
}

// 0.8.10: the Farm as the first entry of the places registry (mapscene.js PLACES)
export const PLACE = { landmarks: LMS, paintBand: paintFarmBand, drawLive: drawFarmLive, drawFront: drawFarmFront, stop: farmStop, drawLandmark: drawFarmLandmark, drawPlaque: drawFarmPlaque };
