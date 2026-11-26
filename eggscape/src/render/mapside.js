// The side quests on the map (0.8.17, mykee: "from the map we could build a different pathway where there could be bonus
// levels ... rather than having one linear path we could have different sub-paths. People could always skip them").
// 0.8.18 (mykee: "show a split path towards that level, and it could merge back"): a FORK of the road leaves it under
// the branch stop's nest, swings out to a round vault door with the vault's picture in its window (a different family
// from the road's nests, sitting ON the fork, so it reads as the fork's own stop) and swings back to join the road one or
// two levels on. Locked: the fork faded, a small padlock where it leaves the road, the door dim. Open: lit, a pulse runs
// along it once, the door glows and bobs. Won: gold down the fork, its stars on a plate under the door. Layout and art
// only; main.js owns the taps, the hen's walk and the reveal.
import { freeCanvas } from './cvfree.js';
import { drawExtraIcon } from './extras.js';
import { FONT } from '../ui/ui.js';
import { chestSpot, lmArt } from './mapfarm.js';
import { gateSpot, signSpot, brightStar, roadCols, PLACES, WORLD_LOOK } from './mapscene.js';
import { SIDE } from '../side.js';
import { bossOf } from '../road.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const hit = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
const area = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
const PLAN_KEY = { 0: '_farm', 3: '_cave', 4: '_volc', 6: '_thieves' }; // where each painted world keeps its plan (its props)

// the door's radius and its box round the centre (the bob, the "II" tag above, the star plate below)
export const doorR = (L) => clamp(L.stopR * 1.0, 26 * L.u, 36 * L.u);
export function doorBox(L) { const u = L.u, R = doorR(L); return { x0: -R - 5 * u, x1: R + 5 * u, y0: -R - 12 * u, y1: R + 24 * u }; }

// what a side marker and its trail must keep clear of, in world w (map space)
function blockers(L, w) {
  const u = L.u, out = [], soft = [];
  for (let j = 0; j < L.stops.length; j++) {
    const st = L.stops[j]; if (Math.abs(st.w - w) > 1) continue;
    const b = (j + 1) % 6 === 0 ? 1.22 : 1, rx = Math.max(37 * u * b, 30) + 6 * u; // (a stop's touch box is at least 48 px wide)
    out.push({ x0: st.x - rx, x1: st.x + rx, y0: st.y - L.stopR * 2.2, y1: st.y + Math.max(44 * u * b, 30), stop: j }); // the nest, its badge and plate, the hen in it
  }
  for (const k of [w, w + 1]) {
    if (k >= L.nw) continue;
    const sp = signSpot(L, k); out.push({ x0: sp.x - 90 * u, x1: sp.x + 90 * u, y0: sp.y - 38 * u, y1: sp.y + 24 * u }); // the world's sign
    const g = gateSpot(L, k); out.push({ ...g.box }, { x0: g.x - g.half - g.pw - 4 * u, x1: g.x + g.half + g.pw + 4 * u, y0: g.y - 58 * u, y1: g.y + 8 * u }); // its gate, board and coin button
  }
  const bi = bossOf(w) - 1;
  if (L.stops[bi]) { const c = chestSpot(L, bi, L.A, u); out.push({ x0: c.x - c.cr * 1.15, x1: c.x + c.cr * 1.15, y0: c.y - c.cr * 1.25, y1: c.y + c.cr * 1.7 }); } // the boss's treasure chest
  const P = PLACES[w];
  if (P) { // a world painted as one place: its landmarks are hard, its small props soft
    for (let k = 0; k < (P.landmarks || []).length; k++) { const m = P.stop(L, k); if (m) { const r = lmArt(m); out.push({ x0: r.x0 + 6 * u, x1: r.x1 - 6 * u, y0: r.y0 + 8 * u, y1: r.y1, lm: 1 }); } } // (lm: may be covered a little where nothing else fits)
    const plan = L[PLAN_KEY[w]];
    for (const p of (plan && plan.props) || []) if (p.box) soft.push(p.box);
  }
  return { out, soft };
}
function roadHit(L, b, pad) { for (let y = b.y0; y <= b.y1 + 0.1; y += 4) { const x = L.pathX(y); if (x + L.roadW * 0.5 + pad > b.x0 && x - L.roadW * 0.5 - pad < b.x1) return true; } return false; }

// 0.8.18 the FORK (mykee: "the world map should have a separate path for that, and it should also integrate back into the
// map ... show a split path towards that level, and it could merge back"): a narrower road of the same family leaves the
// main road under the branch stop's nest, swings out to the quest's door and swings back to join the road again under the
// nest one or two levels on. Two cubic legs, S -> N (the door) -> E, smooth through the door (its tangent there runs from
// S to E), each end leaving / meeting the road along the road's own direction.
function roadDist(L, p) { let m = 1e9; for (let y = p.y - 70 * L.u; y <= p.y + 70 * L.u; y += 3) m = Math.min(m, Math.hypot(L.pathX(y) - p.x, y - p.y)); return m; } // how far a point is from the road's middle line
function roadDir(L, y) { const dx = L.pathX(y - 2) - L.pathX(y + 2), d = Math.hypot(dx, 4) || 1; return { x: dx / d, y: -4 / d }; } // the road's way on (up the map)
function cubic(p0, p1, p2, p3, n) {
  const out = [];
  for (let k = 0; k <= n; k++) { const t = k / n, m = 1 - t; out.push({ x: m * m * m * p0.x + 3 * m * m * t * p1.x + 3 * m * t * t * p2.x + t * t * t * p3.x, y: m * m * m * p0.y + 3 * m * m * t * p1.y + 3 * m * t * t * p2.y + t * t * t * p3.y }); }
  return out;
}
const plen = (P) => { let a = 0; for (let k = 1; k < P.length; k++) a += Math.hypot(P[k].x - P[k - 1].x, P[k].y - P[k - 1].y); return a; };
export const forkW = (L) => L.roadW * 0.56; // the fork's width: the road's family, narrower
function forkOf(L, S, N, E) {
  const c = { x: E.x - S.x, y: E.y - S.y }, cl = Math.hypot(c.x, c.y) || 1, T = { x: c.x / cl, y: c.y / cl }; // through the door: from S towards E
  const dS = roadDir(L, S.y), dE = roadDir(L, E.y), la = Math.hypot(N.x - S.x, N.y - S.y), lb = Math.hypot(E.x - N.x, E.y - N.y);
  const toN = { x: (N.x - S.x) / (la || 1), y: (N.y - S.y) / (la || 1) }, fromN = { x: (E.x - N.x) / (lb || 1), y: (E.y - N.y) / (lb || 1) };
  const mixd = (a, b, k) => { const x = a.x * k + b.x * (1 - k), y = a.y * k + b.y * (1 - k), d = Math.hypot(x, y) || 1; return { x: x / d, y: y / d }; };
  const s1 = mixd(dS, toN, 0.45), e1 = mixd(dE, fromN, 0.45);
  const nA = Math.max(10, Math.round(la / (5 * L.u))), nB = Math.max(10, Math.round(lb / (5 * L.u)));
  const A = cubic(S, { x: S.x + s1.x * la * 0.5, y: S.y + s1.y * la * 0.5 }, { x: N.x - T.x * la * 0.42, y: N.y - T.y * la * 0.42 }, N, nA);
  const B = cubic(N, { x: N.x + T.x * lb * 0.42, y: N.y + T.y * lb * 0.42 }, { x: E.x - e1.x * lb * 0.5, y: E.y - e1.y * lb * 0.5 }, E, nB);
  return { S, E, A, B, la: plen(A), lb: plen(B) };
}
// the fork's points as one line S .. N .. E (for drawing, the pulse and the keep-out boxes)
export const forkPts = (f) => f.A.concat(f.B.slice(1));

// where every side quest goes in this layout (cached on L). -> [{ w, key, i (the branch stop), j (where it joins again), x, y,
// R, fork, box }]
export function sidePlan(L) {
  if (L._side) return L._side;
  const u = L.u, A = L.A, R = doorR(L), DB = doorBox(L), out = [], fw = forkW(L);
  L._side = out; L.sideKeep = (w) => sideKeep(L, w); // (mapscene bandLayout keeps the props off them; set first: a band painted while this runs reads what is placed so far)
  for (const q of SIDE) {
    const i = q.i, st = L.stops[i];
    if (!st) continue;
    const w = q.w, top = L.bandTop(w), { out: hard, soft } = blockers(L, w);
    let best = null;
    // candidates: out from the road along its normal (the road runs steep on a phone, nearly flat on a phone on its side),
    // half way between the two stops first. strict 2: clear of everything; 1: may cross a landmark's corner; 0: may cross
    // a sign, gate or chest too (never the road, a stop or the screen edge). The first level with a fit wins
    for (const strict of [2, 1, 0, -1]) { // (-1: the last resort, the door may stand a little into the next band)
      if (best) break;
      const bandLo = strict < 0 ? -0.12 : 0.03, bandHi = strict < 0 ? 1.1 : 0.95;
      for (const j of [i + 2, i + 1]) {
        const en = L.stops[j]; if (!en || en.w !== w) continue;
        const S = { x: st.x, y: st.y }, E = { x: en.x, y: en.y };
        const C = []; // the spots to try: out along the road's normal from points between the two stops (each ray stops at the screen's or the band's edge)
        for (const fy of [0.5, 0.36, 0.64, 0.22, 0.78]) {
          const y0 = S.y + (E.y - S.y) * fy, x0 = L.pathX(y0), d = roadDir(L, y0);
          for (const s of [-1, 1]) for (let k = 0; k < 30; k++) {
            const off = L.roadW * 0.5 + R + 24 * u + k * 6 * u, x = x0 - d.y * s * off, y = y0 + d.x * s * off;
            if (x - R - 6 * u < A.x || x + R + 6 * u > A.x1 || y - R - 12 * u < top + bandLo * L.BH || y + R + 24 * u > top + bandHi * L.BH) break;
            C.push({ x, y, fy });
          }
        }
        if (strict < 0) for (let y = top + bandLo * L.BH + R + 12 * u; y < top + bandHi * L.BH - R - 24 * u; y += 10 * u) for (let x = A.x + R + 6 * u; x < A.x1 - R - 6 * u; x += 10 * u) C.push({ x, y, fy: clamp((y - S.y) / (E.y - S.y || 1), -1, 2) }); // (last resort: anywhere in the band)
        for (const { x, y, fy } of C) {
          {
            {
              const off = roadDist(L, { x, y });
              const b = { x0: x + DB.x0, x1: x + DB.x1, y0: y + DB.y0, y1: y + DB.y1 };
              if (roadHit(L, b, 8 * u)) continue;
              if (hard.some((h) => h.stop != null && (strict >= 0 || (h.stop !== i && h.stop !== j)) && hit(b, h))) continue;
              if (strict < 0 && [st, en].some((z) => Math.hypot(z.x - x, z.y - y) < L.stopR + R + 6 * u)) continue; // (last resort: it may touch its own two stops' plates, never their nests)
              let pen = hard.reduce((a2, h) => a2 + (h.stop == null && !h.lm ? area(b, h) : 0), 0) * 6;
              if (pen && strict > 0) continue;
              const f = forkOf(L, S, { x, y }, E), P = forkPts(f);
              let bad = false, lmA = hard.reduce((a2, h) => a2 + (h.lm ? area(b, h) : 0), 0), softA = soft.reduce((a2, h) => a2 + area(b, h), 0);
              if (lmA && strict === 2) continue;
              for (const p of P) {
                const dS = Math.hypot(p.x - S.x, p.y - S.y), dE = Math.hypot(p.x - E.x, p.y - E.y), dN = Math.hypot(p.x - x, p.y - y);
                if (dN < R) continue; // under the door
                if (p.x - fw / 2 < A.x + 2 * u || p.x + fw / 2 > A.x1 - 2 * u) { bad = true; break; }
                if (Math.min(dS, dE) > L.stopR * 1.5 && roadDist(L, p) < L.roadW * 0.5 + fw * 0.5 + 5 * u) { bad = true; break; } // it never crosses or runs along the road
                const pb = { x0: p.x - fw / 2, x1: p.x + fw / 2, y0: p.y - fw / 2, y1: p.y + fw / 2 };
                if (strict >= 0 ? hard.some((h) => h.stop != null && h.stop !== i && h.stop !== j && hit(pb, h)) : L.stops.some((z, k2) => k2 !== i && k2 !== j && Math.hypot(z.x - p.x, z.y - p.y) < L.stopR * 1.25)) { bad = true; break; } // (last resort: clear of the other nests themselves)
                const hp = hard.reduce((a2, h) => a2 + (h.stop == null && !h.lm ? area(pb, h) : 0), 0), lmP = hard.reduce((a2, h) => a2 + (h.lm ? area(pb, h) : 0), 0);
                if ((hp && strict > 0) || (lmP && strict === 2)) { bad = true; break; }
                pen += hp * 6; lmA += lmP * 2; softA += soft.reduce((a2, h) => a2 + area(pb, h), 0) * 0.3;
              }
              if (bad) continue;
              const bal = Math.abs(f.la - f.lb);
              const sc = Math.abs(off - (L.roadW * 0.5 + R + 66 * u)) * 1.5 + bal * 0.25 + Math.abs(fy - 0.5) * 40 * u + (j === i + 1 ? 60 * u : 0) + softA / (4 * u) + lmA / (2 * u) + pen / (u * u);
              if (!best || sc < best.sc) best = { sc, x, y, f, b, j };
            }
          }
        }
      }
    }
    if (!best) { const j = Math.min(i + 1, L.stops.length - 1), en = L.stops[j], y = (st.y + en.y) / 2, s = L.pathX(y) < L.cx ? 1 : -1, x = clamp(L.pathX(y) + s * (L.roadW * 0.5 + R + 30 * u), A.x + R + 6 * u, A.x1 - R - 6 * u); best = { x, y, j, f: forkOf(L, { x: st.x, y: st.y }, { x, y }, { x: en.x, y: en.y }), b: { x0: x + DB.x0, x1: x + DB.x1, y0: y + DB.y0, y1: y + DB.y1 } }; } // (never: a layout with no room)
    out.push({ w, key: q.key, i, j: best.j, at: q.at, x: best.x, y: best.y, R, fork: best.f, box: best.b, two: /2$/.test(q.key), kind: q.level.wonder.kind });
  }
  return out;
}
// the boxes a world's still props and walking cast keep clear of (mapscene bandLayout): the door and the whole fork, with
// room either side, so nothing round sits by the fork looking like a stop of its own
export function sideKeep(L, w) {
  const q = (L._side || []).find((p) => p.w === w); if (!q) return [];
  const u = L.u, P = forkPts(q.fork), m = forkW(L) * 0.5 + 12 * u, out = [{ x0: q.box.x0 - 10 * u, x1: q.box.x1 + 10 * u, y0: q.box.y0 - 6 * u, y1: q.box.y1 + 6 * u }];
  for (let k = 0; k < P.length; k += 3) out.push({ x0: P[k].x - m, x1: P[k].x + m, y0: P[k].y - m, y1: P[k].y + m });
  return out;
}
// the hen's way between a stop of the road and the door: along the road to the nearer end of the fork, then up that leg.
// -> { pts (map space, from the stop to the door), len }. back: the same way the other round (door -> stop)
export function sideRoute(L, q, from, back = false) {
  const st = L.stops[from] || L.stops[q.i], f = q.fork;
  const road = (y0, y1) => { const P = [], n = Math.max(1, Math.round(Math.abs(y1 - y0) / (6 * L.u))); for (let k = 0; k <= n; k++) { const y = y0 + ((y1 - y0) * k) / n; P.push({ x: L.pathX(y), y }); } return P; };
  const viaA = road(st.y, f.S.y).concat(f.A.slice(1)), viaB = road(st.y, f.E.y).concat(f.B.slice().reverse().slice(1));
  if (from === q.i) viaA[0] = { x: st.x, y: st.y }; if (from === q.j) viaB[0] = { x: st.x, y: st.y };
  const N = { x: q.x, y: q.y }, trim = (P) => { const k = P.findIndex((p) => Math.hypot(p.x - N.x, p.y - N.y) < q.R * 0.85); return k > 1 ? P.slice(0, k) : P; }; // she stops on the fork at the door's rim (the door stays in view beside her)
  const A2 = trim(viaA), B2 = trim(viaB), a = plen(A2), b = plen(B2), pts = a <= b ? A2 : B2;
  return { pts: back ? pts.slice().reverse() : pts, len: Math.min(a, b), leg: a <= b ? 'A' : 'B' };
}
// a point at arc length s along a polyline (and the way it heads there)
export function along(P, s) {
  for (let k = 1; k < P.length; k++) {
    const d = Math.hypot(P[k].x - P[k - 1].x, P[k].y - P[k - 1].y);
    if (s <= d || k === P.length - 1) { const t = d ? clamp(s / d, 0, 1) : 1; return { x: P[k - 1].x + (P[k].x - P[k - 1].x) * t, y: P[k - 1].y + (P[k].y - P[k - 1].y) * t, dx: P[k].x - P[k - 1].x }; }
    s -= d;
  }
  return { x: P[0].x, y: P[0].y, dx: 0 };
}
// the fork's touch boxes (a tap on the path walks the hen there too): squares along it, clear of the two nests at its ends
// and off the door's middle (its own box). map space
export function forkTaps(L, q) {
  const u = L.u, P = forkPts(q.fork), s = Math.max(30 * u, 44), out = [];
  let last = null;
  for (const p of P) {
    if (Math.hypot(p.x - q.fork.S.x, p.y - q.fork.S.y) < L.stopR * 1.6 || Math.hypot(p.x - q.fork.E.x, p.y - q.fork.E.y) < L.stopR * 1.6) continue;
    const b = { x0: p.x - s / 2, x1: p.x + s / 2, y0: p.y - s / 2, y1: p.y + s / 2 };
    if (Math.hypot(p.x - q.x, p.y - q.y) < q.R + s * 0.35 || (last && hit(b, last))) continue; // (it may share a corner with the door's box: the same tap)
    out.push(b); last = b;
  }
  return out;
}

// ---------------------------------------------------------------- art
// the fork: the road's own strokes (its shade, edge, fill and dashes, in the world's colours), narrower. Locked: faded,
// a small padlock where it leaves the road. Open: lit; o.pulse (0..1) runs a soft glow once from S through the door to E.
// Won: the walked road's gold down its middle. o.lit (0..1): how much of it has lit up so far (the reveal draws it in).
export function drawSideFork(ctx, L, q, sy, state, o = {}) {
  const u = L.u, P = forkPts(q.fork), fw = forkW(L), K = roadCols(q.w), locked = state === 'locked', lit = o.lit == null ? 1 : o.lit;
  const line = (a = 0, b = P.length - 1) => { ctx.beginPath(); for (let k = a; k <= b; k++) { const p = P[k]; if (k === a) ctx.moveTo(p.x, p.y - sy); else ctx.lineTo(p.x, p.y - sy); } };
  const strokeAll = (a, b) => {
    line(a, b); ctx.strokeStyle = 'rgba(20,10,0,0.22)'; ctx.lineWidth = fw + 7 * u; ctx.stroke();
    ctx.strokeStyle = K.edge; ctx.lineWidth = fw + 3 * u; ctx.stroke();
    ctx.strokeStyle = K.fill; ctx.lineWidth = fw - 2 * u; ctx.stroke();
  };
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const nl = Math.round((P.length - 1) * clamp(lit, 0, 1));
  if (locked || nl < P.length - 1) { ctx.save(); ctx.globalAlpha *= 0.6; strokeAll(nl, P.length - 1); ctx.restore(); } // faded: shut (or not lit yet)
  if (!locked && nl > 0) {
    strokeAll(0, nl);
    if (state === 'won') { line(0, nl); ctx.strokeStyle = '#f6c454'; ctx.lineWidth = fw * 0.5; ctx.stroke(); ctx.strokeStyle = 'rgba(255,244,190,0.55)'; ctx.lineWidth = fw * 0.15; ctx.stroke(); }
    else if (K.dash && !/,\s*0\)$/.test(K.dash)) { line(0, nl); ctx.lineCap = 'butt'; ctx.setLineDash([5 * u, 8 * u]); ctx.strokeStyle = K.dash; ctx.lineWidth = 2.4 * u; ctx.stroke(); ctx.setLineDash([]); }
  }
  if (!locked && o.pulse != null && o.pulse > 0 && o.pulse < 1) { // the pulse: a soft bright bead with a tail, eased along once
    const s = ss(o.pulse) * plen(P), tail = 70 * u;
    for (let k = 0; k < 7; k++) {
      const pt = along(P, Math.max(0, s - (k * tail) / 7)), a = (1 - k / 7) * Math.sin(Math.PI * clamp(o.pulse * 1.15, 0, 1));
      const r = fw * (0.9 - k * 0.07), g = ctx.createRadialGradient(pt.x, pt.y - sy, 0, pt.x, pt.y - sy, r);
      g.addColorStop(0, `rgba(255,250,215,${0.85 * a})`); g.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(pt.x, pt.y - sy, r, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
  if (locked || (o.lockK != null && o.lockK < 1)) { // the padlock where it leaves the road (o.lockK 0..1: it breaks away)
    const pt = along(q.fork.A, Math.min(q.fork.la * 0.42, L.stopR * 2.1)), k = o.lockK == null ? 0 : clamp(o.lockK, 0, 1);
    ctx.save(); ctx.globalAlpha *= 1 - ss((k - 0.35) / 0.65);
    const lift = k * k * 26 * u, sc = 1 + 0.35 * Math.sin(Math.PI * clamp(k * 1.6, 0, 1));
    ctx.translate(pt.x, pt.y - sy - 3 * u - lift); ctx.rotate(k * 0.9); ctx.scale(sc, sc);
    ctx.beginPath(); ctx.arc(0, 2 * u, 10.5 * u, 0, TAU); ctx.fillStyle = 'rgba(30,20,10,0.35)'; ctx.fill();
    padlock(ctx, 0, 0, 6.4 * u);
    ctx.restore();
  }
}
// the door's picture (stamped once per vault, state and size): a heavy round door, gold rim and bolts, a dark steel band
// in the world's colour, the vault's own scene in its round window, hinges on one side. Locked: dimmed, a padlock.
const SPR = new Map();
export function freeSide() { for (const e of SPR.values()) freeCanvas(e.cv); SPR.clear(); }
const mix = (h, k) => { const n = parseInt(h.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, f = (v) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k); return `rgb(${f(r)},${f(g)},${f(b)})`; };
function paintDoor(c, L, q, locked) {
  const u = L.u, R = q.R, acc = (WORLD_LOOK[q.w] || WORLD_LOOK[0]).accent;
  // the hinges on the side away from the road (behind the door)
  const hs = q.x > L.pathX(q.y) ? 1 : -1;
  for (const dy of [-0.45, 0.45]) { c.beginPath(); c.roundRect ? c.roundRect(hs * R * 0.7, dy * R - 4 * u, R * 0.5, 8 * u, 3 * u) : c.rect(hs * R * 0.7, dy * R - 4 * u, R * 0.5, 8 * u); c.fillStyle = '#4a3a2a'; c.fill(); c.lineWidth = 1.5 * u; c.strokeStyle = '#1e140a'; c.stroke(); }
  c.beginPath(); c.ellipse(0, R * 0.9, R * 0.95, R * 0.26, 0, 0, TAU); c.fillStyle = 'rgba(20,8,0,0.32)'; c.fill(); // its shadow on the ground
  // the gold rim
  c.beginPath(); c.arc(0, 0, R + 2.2 * u, 0, TAU); c.fillStyle = '#2a1606'; c.fill();
  c.beginPath(); c.arc(0, 0, R, 0, TAU); const g = c.createLinearGradient(0, -R, 0, R); g.addColorStop(0, '#fff2b0'); g.addColorStop(0.45, '#f2b83a'); g.addColorStop(1, '#a86a10'); c.fillStyle = g; c.fill();
  // the steel band in the world's colour, with bolts
  const rb = R * 0.84; c.beginPath(); c.arc(0, 0, rb, 0, TAU); const g2 = c.createLinearGradient(0, -rb, 0, rb); g2.addColorStop(0, mix(acc, 0.35)); g2.addColorStop(1, mix(acc, -0.45)); c.fillStyle = g2; c.fill();
  c.lineWidth = 1.4 * u; c.strokeStyle = 'rgba(20,8,0,0.6)'; c.stroke();
  for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU + TAU / 16, bx = Math.cos(a) * rb * 0.86, by = Math.sin(a) * rb * 0.86; c.beginPath(); c.arc(bx, by, 2.3 * u, 0, TAU); c.fillStyle = '#ffe9a0'; c.fill(); c.lineWidth = 0.9 * u; c.strokeStyle = '#5a3a0a'; c.stroke(); }
  // the window: the vault's scene (the Extras page's picture, clipped round)
  const rw = R * 0.62;
  c.save(); c.beginPath(); c.arc(0, 0, rw, 0, TAU); c.clip();
  drawExtraIcon(c, q.kind, 0, 0, rw * 2.3, 0.6, { calm: true });
  if (locked) { c.fillStyle = 'rgba(24,20,40,0.55)'; c.fillRect(-rw, -rw, rw * 2, rw * 2); }
  c.restore();
  c.beginPath(); c.arc(0, 0, rw, 0, TAU); c.lineWidth = 3 * u; c.strokeStyle = '#2a1606'; c.stroke(); c.lineWidth = 1.2 * u; c.strokeStyle = 'rgba(255,240,200,0.7)'; c.beginPath(); c.arc(0, 0, rw + 1.8 * u, Math.PI * 1.1, Math.PI * 1.75); c.stroke();
  c.beginPath(); c.ellipse(-R * 0.35, -R * 0.62, R * 0.26, R * 0.1, -0.5, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.5)'; c.fill(); // a glint on the rim
  if (locked) { c.save(); c.beginPath(); c.arc(0, 0, R + 2.5 * u, 0, TAU); c.fillStyle = 'rgba(30,26,40,0.28)'; c.fill(); c.restore(); }
  if (q.two) { // the second, tougher vault of a kind: a red "II" tag on its top
    const tw = 22 * u, th = 14 * u, ty = -R - 6 * u;
    c.beginPath(); c.roundRect ? c.roundRect(-tw / 2, ty - th / 2, tw, th, th / 2) : c.rect(-tw / 2, ty - th / 2, tw, th); c.fillStyle = '#d8402e'; c.fill(); c.lineWidth = 1.8 * u; c.strokeStyle = '#3a0a04'; c.stroke();
    c.font = `700 ${Math.round(11 * u)}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText('II', 0, ty + 0.6 * u);
  }
}
function padlock(c, x, y, s) {
  c.save(); c.translate(x, y); c.lineCap = 'round'; c.lineJoin = 'round';
  for (const [lw, col] of [[s * 0.62, '#3a2410'], [s * 0.34, '#e8eef4']]) { c.lineWidth = lw; c.strokeStyle = col; c.beginPath(); c.moveTo(-s * 0.55, -s * 0.1); c.lineTo(-s * 0.55, -s * 0.55); c.arc(0, -s * 0.55, s * 0.55, Math.PI, 0); c.lineTo(s * 0.55, -s * 0.1); c.stroke(); }
  c.beginPath(); c.roundRect ? c.roundRect(-s, -s * 0.2, s * 2, s * 1.5, s * 0.34) : c.rect(-s, -s * 0.2, s * 2, s * 1.5); const g = c.createLinearGradient(0, -s * 0.2, 0, s * 1.3); g.addColorStop(0, '#ffe486'); g.addColorStop(1, '#d8800a'); c.fillStyle = g; c.fill(); c.lineWidth = s * 0.17; c.strokeStyle = '#3a2410'; c.stroke();
  c.fillStyle = '#3a2410'; c.beginPath(); c.arc(0, s * 0.42, s * 0.22, 0, TAU); c.fill();
  c.restore();
}
function sprite(L, q, locked, DPR) {
  const key = `${q.key}|${locked ? 1 : 0}|${q.R.toFixed(2)}|${L.u.toFixed(3)}|${DPR}|${q.x > L.pathX(q.y) ? 1 : 0}`;
  let e = SPR.get(key);
  if (!e) {
    if (typeof document === 'undefined') return null;
    const R = q.R, pad = 14 * L.u, w = 2 * (R + pad) + R, h = 2 * (R + pad) + 10 * L.u, ox = w / 2, oy = R + pad + 6 * L.u;
    const cv = document.createElement('canvas'); cv.width = Math.ceil(w * DPR); cv.height = Math.ceil(h * DPR);
    const c = cv.getContext('2d'); c.setTransform(DPR, 0, 0, DPR, ox * DPR, oy * DPR);
    try { paintDoor(c, L, q, locked); } catch (_) { /* art never breaks the map */ }
    e = { cv, ox, oy, w, h }; SPR.set(key, e);
    if (SPR.size > 24) { const k0 = SPR.keys().next().value; freeCanvas(SPR.get(k0).cv); SPR.delete(k0); }
  }
  return e;
}
// the door on the map. state 'locked' | 'open' | 'won'. o: { t, calm, stars, DPR, p (press 0..1), pop (0..1: the reveal's
// pop, 1 = still), glow (0..1 extra glow) }
export function drawSideDoor(ctx, L, q, sy, state, o = {}) {
  const u = L.u, R = q.R, t = o.t || 0, calm = !!o.calm, x = q.x, open = state === 'open';
  const bob = open && !calm ? -Math.abs(Math.sin(t * 2.4 + q.w)) * 3.5 * u : 0, y = q.y - sy + bob;
  if (open || o.glow) { // its glow on the ground: steady when calm
    const k = calm ? 0.75 : 0.6 + 0.4 * Math.sin(t * 3 + q.w), gl = Math.max(open ? k : 0, o.glow || 0);
    const gr = ctx.createRadialGradient(x, y, R * 0.6, x, y, R * 1.9); gr.addColorStop(0, `rgba(214,160,255,${0.55 * gl})`); gr.addColorStop(1, 'rgba(214,160,255,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, R * 1.9, 0, TAU); ctx.fill();
  }
  const e = sprite(L, q, state === 'locked', o.DPR || 1);
  if (!e) return;
  const pop = o.pop == null ? 1 : o.pop, sc = (1 + 0.05 * (o.p || 0)) * pop;
  ctx.save();
  if (sc !== 1) { ctx.translate(x, y); ctx.scale(sc, sc); ctx.translate(-x, -y); }
  ctx.drawImage(e.cv, x - e.ox, y - e.oy, e.w, e.h);
  if (open && !calm) { // a sparkle that circles the rim
    const a = t * 1.6 + q.w, sx = x + Math.cos(a) * (R + 1 * u), sy2 = y + Math.sin(a) * (R + 1 * u), r = 4.5 * u;
    ctx.beginPath(); ctx.moveTo(sx, sy2 - r); ctx.quadraticCurveTo(sx, sy2, sx + r, sy2); ctx.quadraticCurveTo(sx, sy2, sx, sy2 + r); ctx.quadraticCurveTo(sx, sy2, sx - r, sy2); ctx.quadraticCurveTo(sx, sy2, sx, sy2 - r); ctx.fillStyle = '#fffbe0'; ctx.fill();
  }
  // (0.8.18: a shut one's padlock sits on its fork, where it leaves the road: drawSideFork)
  if (state === 'won') { // the stars it earned, on a dark plate under it
    const pw = 52 * u, ph = 16 * u, py = y + R + 3 * u;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - pw / 2, py, pw, ph, ph / 2) : ctx.rect(x - pw / 2, py, pw, ph); ctx.fillStyle = 'rgba(30,16,6,0.9)'; ctx.fill(); ctx.lineWidth = 1.2 * u; ctx.strokeStyle = 'rgba(255,232,170,0.6)'; ctx.stroke();
    for (let k = 0; k < 3; k++) brightStar(ctx, x + (k - 1) * 15.5 * u, py + ph / 2 + 0.4 * u, 6.6 * u, k < (o.stars | 0));
  }
  ctx.restore();
}
// the reveal's burst round a door that just opened (s: seconds since the pop, about 0.7 s)
export function drawSideBurst(ctx, L, q, sy, s, calm) {
  if (calm || s < 0 || s > 0.8) return;
  const u = L.u, k = ss(s / 0.8), x = q.x, y = q.y - sy;
  ctx.save(); ctx.globalAlpha = 1 - k;
  ctx.lineWidth = 4 * u * (1 - k) + 1; ctx.strokeStyle = '#e8c8ff'; ctx.beginPath(); ctx.arc(x, y, q.R * (1.1 + 1.3 * k), 0, TAU); ctx.stroke();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.3, d = q.R * (1.2 + 1.6 * k); brightStar(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, 6 * u * (1 - k * 0.5), true); }
  ctx.restore();
}
