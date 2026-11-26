// The side quests on the map (0.8.17, mykee: "from the map we could build a different pathway where there could be bonus
// levels ... rather than having one linear path we could have different sub-paths. People could always skip them").
// At each world's fourth stop a short trail of stepping stones (the world's own stone) leaves the road to a round vault
// door with the vault's picture in its window: a different family from the road's nests and stone discs, set off the
// road where the scenery has room, so it never reads as a stop on the way. Locked: dim, a padlock. Open: it glows and
// bobs. Won: its stars on a plate under it. Layout and art only; main.js owns the taps, the hen's walk and the reveal.
import { freeCanvas } from './cvfree.js';
import { drawExtraIcon } from './extras.js';
import { FONT } from '../ui/ui.js';
import { chestSpot, lmArt } from './mapfarm.js';
import { gateSpot, signSpot, stopTint, brightStar, PLACES, WORLD_LOOK } from './mapscene.js';
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

// the trail: a gentle curve of stepping stones from the stop's nest to the door; t 0..1 -> point
function curve(a, c, b) { return (t) => { const m = 1 - t; return { x: m * m * a.x + 2 * m * t * c.x + t * t * b.x, y: m * m * a.y + 2 * m * t * c.y + t * t * b.y }; }; }
function trailOf(L, st, x, y) {
  const u = L.u, R = doorR(L), s = x > st.x ? 1 : -1, a = { x: st.x + s * 40 * u, y: st.y + 12 * u }, dx = x - a.x, dy = y + R * 0.55 - a.y;
  const len = Math.hypot(dx, dy) || 1, b = { x: x - (dx / len) * (R + 4 * u), y: y + R * 0.55 - (dy / len) * (R * 0.4) };
  const c = { x: (a.x + b.x) / 2 - (dy / len) * len * 0.16 * s, y: (a.y + b.y) / 2 + Math.abs(dx / len) * len * 0.12 };
  const f = curve(a, c, b), n = Math.max(3, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / (17 * u)));
  const stones = []; for (let k = 0; k <= n; k++) { const p = f(k / n); stones.push({ x: p.x + (k % 2 ? 2.5 : -2.5) * u, y: p.y, k }); }
  return { f, a, b, stones, len: Math.hypot(b.x - a.x, b.y - a.y) };
}

// where every side quest goes in this layout (cached on L). -> [{ w, key, i (the branch stop), x, y, R, trail, box }]
export function sidePlan(L) {
  if (L._side) return L._side;
  const u = L.u, A = L.A, R = doorR(L), DB = doorBox(L), out = [];
  L._side = out; L.sideKeep = (w) => sideKeep(L, w); // (mapscene bandLayout keeps the props off them; set first: a band painted while this runs reads what is placed so far)
  for (const q of SIDE) {
    const i = q.i, st = L.stops[i];
    if (!st) continue;
    const w = q.w, top = L.bandTop(w), step = L.BH * L.stepFY, { out: hard, soft } = blockers(L, w), far = 92 * u; // far: the door stands at least this far from its stop, so the trail reads
    let best = null;
    for (const fy of [0, -0.35, 0.35, -0.7, 0.7, -1, 1, -1.3, 1.3]) {
      const y = st.y + fy * step;
      if (y - R - 12 * u < top + 0.05 * L.BH || y + R + 24 * u > top + 0.93 * L.BH) continue;
      for (const s of [-1, 1]) {
        for (let k = 0; k < 40; k++) {
          const x = L.pathX(y) + s * (L.roadW * 0.5 + R + 18 * u + k * 6 * u);
          if (x - R - 4 * u < A.x || x + R + 4 * u > A.x1) break;
          if (Math.hypot(x - st.x, y - st.y) < far) continue;
          const b = { x0: x + DB.x0, x1: x + DB.x1, y0: y + DB.y0, y1: y + DB.y1 };
          if (roadHit(L, b, 8 * u)) continue;
          if (hard.some((h) => !h.lm && hit(b, h))) continue;
          const lmA = hard.reduce((a2, h) => a2 + (h.lm ? area(b, h) : 0), 0);
          const tr = trailOf(L, st, x, y);
          if (tr.stones.slice(1).some((p) => roadHit(L, { x0: p.x - 5 * u, x1: p.x + 5 * u, y0: p.y - 4 * u, y1: p.y + 4 * u }, 2 * u))) continue;
          if (tr.stones.some((p) => hard.some((h) => h.stop !== i && !h.lm && hit({ x0: p.x - 6 * u, x1: p.x + 6 * u, y0: p.y - 5 * u, y1: p.y + 5 * u }, h)))) continue;
          const sc = Math.abs(tr.len - 120 * u) + Math.max(0, tr.len - 170 * u) * 4 + Math.abs(fy) * 30 * u + soft.reduce((a2, h) => a2 + area(b, h), 0) / (4 * u) + lmA / (2 * u); // a trail of about 120 units reads as a path of its own; a long one wanders off (it is avoided harder than a landmark's corner covered)
          if (!best || sc < best.sc) best = { sc, x, y, tr, b };
          if (!lmA) break; // the nearest clear spot on this side at this height (else further out may clear the landmark)
        }
      }
    }
    if (!best) { const s = st.x < L.cx ? 1 : -1, x = clamp(st.x + s * 110 * u, A.x + R + 6 * u, A.x1 - R - 6 * u); best = { x, y: st.y, tr: trailOf(L, st, x, st.y), b: { x0: x + DB.x0, x1: x + DB.x1, y0: st.y + DB.y0, y1: st.y + DB.y1 } }; } // (never: a layout with no room)
    out.push({ w, key: q.key, i, at: q.at, x: best.x, y: best.y, R, trail: best.tr, box: best.b, two: /2$/.test(q.key), kind: q.level.wonder.kind });
  }
  return out;
}
// the boxes a world's still props and walking cast keep clear of (mapscene bandLayout)
export function sideKeep(L, w) {
  const q = (L._side || []).find((p) => p.w === w); if (!q) return [];
  const u = L.u;
  return [q.box, ...q.trail.stones.filter((_, k) => k % 2 === 0).map((p) => ({ x0: p.x - 9 * u, x1: p.x + 9 * u, y0: p.y - 8 * u, y1: p.y + 6 * u }))];
}

// ---------------------------------------------------------------- art
// the trail: flat stepping stones in the world's stone, a little shadow; dim while the door is shut. n: stones shown (the reveal draws them in)
export function drawSideTrail(ctx, L, q, sy, state, n = 1e9) {
  const u = L.u, T = stopTint(q.w), lit = state !== 'locked';
  ctx.save(); if (!lit) ctx.globalAlpha *= 0.72;
  q.trail.stones.forEach((p, k) => {
    if (k >= n) return;
    const x = p.x, y = p.y - sy, rx = (k === 0 ? 6 : 7.6) * u, ry = rx * 0.58;
    ctx.beginPath(); ctx.ellipse(x, y + 1.6 * u, rx * 1.05, ry * 1.05, 0, 0, TAU); ctx.fillStyle = 'rgba(20,10,0,0.28)'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, (k % 3 - 1) * 0.2, 0, TAU); ctx.fillStyle = T.st; ctx.fill(); ctx.lineWidth = 1.3 * u; ctx.strokeStyle = T.stE; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x - rx * 0.25, y - ry * 0.3, rx * 0.4, ry * 0.28, 0, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fill();
  });
  ctx.restore();
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
  if (state === 'locked') padlock(ctx, x + R * 0.62, y + R * 0.52, 7.4 * u);
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
