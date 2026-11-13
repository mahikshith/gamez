// Level 26: Sly the chameleon, the orb thief. RENDER ONLY. His body is the sim's crawler (sim/chameleon.js, species
// 'chameleon'): he crawls in through a gap of the outer ring and walks the channel floors after the power orbs. Everything
// here is read from the sim and never written back. Modelled on render/crystal20.js.
// drawCham26: from drawSalamanders (render/salamander.js), under the eggs.
//   lock: both turret eyes converge, the throat bulges. shoot / reel: the tongue (cousins.js out.tongue) flies to the orb
//   and the orb rides its tip back in. digest: a gulp bulge runs down the throat, then he sinks into camo (the colour of
//   the ring under him; never more than CHAM camo 0.85, the eyes keep moving). miss: the tongue snaps on nothing and he
//   blinks, annoyed. sick: rainbow-sick and staggering; a comic retch, then the stolen orb arcs out (sim C.cough).
//   nap: no orbs left, tail curled, eyes shut, a few z's.
import { TAU } from '../sim/geom.js';
import { CHAM } from '../sim/chameleon.js';
import { drawCrawler } from './crawlers.js';
import { drawOrb } from './powers.js';
import { ringColors } from './world.js';
import { THEMES } from '../themes.js';
import { statusClock } from './status.js';
import { hash } from './castkit.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
const lerp = (a, b, k) => a + (b - a) * k;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const CH = ['walk', 'rear', 'crouch', 'mouth', 'swell', 'dazed', 'angry', 'shake', 'splay', 'tongue', 'sick'];
const RATE = { walk: 9, rear: 9, crouch: 14, mouth: 16, swell: 10, dazed: 6, angry: 8, shake: 30, splay: 8, tongue: 12, sick: 5 };
const CAMO = 0.85, CAMO_IN = CAMO / 1.2, CAMO_OUT = 4; // up over 1.2 s; back fast

export const isCham26 = (sim) => !!(sim && sim.level && sim.level.chameleon);
const shown = (C) => !!C && C.ph !== 'wait' && C.ph !== 'gone' && C.ph !== 'warp' && C.pts.length > 2;
const svlOf = (C) => C.size * 1.8; // m snout to hips (CHAM.svl)

const ST = new Map();
function stateOf(sim, C, t) {
  let S = ST.get(C.id);
  if (!S || S.sim !== sim || t < S.t - 0.5) {
    S = { sim, t, C, hx: 0, hy: 0, hd: 0, tr: [], odo: 0, B: {}, look: { x: 0.6, y: 0 }, aim: 0, hop: 0, camo: 0, shim: 0, col: null, beatT: -1, bodo: 0, hunt: 0, gulpT: -9, ph: '', phT: 0, tip: null };
    for (const c of CH) S.B[c] = 0;
    ST.set(C.id, S);
  }
  S.C = C;
  return S;
}
function pull(S, C) {
  S.tr = C.pts;
  const h = C.pts[0], q = C.pts[Math.min(C.pts.length - 1, 3)];
  S.hx = h.x; S.hy = h.y;
  if (Math.hypot(h.x - q.x, h.y - q.y) > 1e-4) S.hd = Math.atan2(h.y - q.y, h.x - q.x);
  S.odo = C.odo;
}
function trailAt(S, d) {
  const T = S.tr;
  let px = T[0].x, py = T[0].y, left = d;
  if (left <= 0) return { x: px - Math.cos(S.hd) * left, y: py - Math.sin(S.hd) * left };
  for (let i = 1; i < T.length; i++) {
    const q = T[i], l = Math.hypot(q.x - px, q.y - py);
    if (l >= left && l > 1e-6) { const f = left / l; return { x: px + (q.x - px) * f, y: py + (q.y - py) * f }; }
    left -= l; px = q.x; py = q.y;
  }
  const a = T[T.length - 2] || T[0], dx = px - a.x, dy = py - a.y, l = Math.hypot(dx, dy) || 1;
  return { x: px + (dx / l) * left, y: py + (dy / l) * left };
}
function bodyAt(S, d) {
  const q = trailAt(S, d), l = Math.hypot(q.x, q.y) || 1;
  return { x: q.x + (q.x / l) * S.hop, y: q.y + (q.y / l) * S.hop };
}

// the colour he sinks into: the ring his feet grip (the floor eggs rest on: the inner wall on the upper arc, else the outer)
function floorColor(sim, C) {
  const h = C.pts[Math.min(C.pts.length - 1, 12)], r = Math.hypot(h.x, h.y), n = sim.rings.length;
  let c = 0;
  for (const ring of sim.rings) if (r > ring.r) c++;
  c = clamp(c, 1, n - 1);
  const ring = sim.rings[h.y > 0 ? c - 1 : c], theme = THEMES.find((T) => T.id === sim.level.theme);
  const hex = ringColors(ring, theme).base, v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function step(sim, C, S, dt, t) {
  const W = {}; for (const c of CH) W[c] = 0;
  let look = { x: 0.6, y: 0 }, aim = 0, hunt = 0;
  if (C.ph !== S.ph) { S.ph = C.ph; S.phT = t; if (C.ph === 'digest') S.gulpT = t; }
  const el = t - S.phT;
  const moving = C.ph === 'walk' || C.ph === 'brake' || C.ph === 'retreat' || C.ph === 'in' || (C.ph === 'sick' && !(C.cough && C.cough.t > CHAM.fly));
  const aimAt = (x, y) => clamp(wrap(Math.atan2(y - S.hy, x - S.hx) - S.hd), -1.0, 1.0);
  let still = false;
  if (sim.state !== 'play' && C.ph === 'grin') { W.mouth = 0.35; W.swell = 0.4; aim = -0.2; look = { x: 0.3, y: 0.5 }; still = true; }
  else if (C.ph === 'lock' || (C.ph === 'brake' && C.pend === 'lock')) { // the telegraph: eyes converge, throat bulges
    const u = C.ph === 'lock' ? clamp(1 - C.t / CHAM.lock, 0, 1) : 0;
    if (C.tg) aim = aimAt(C.tg.x, C.tg.y) * 0.8;
    hunt = C.ph === 'lock' ? sstep(u / 0.35) : 0.3; W.swell = 0.9 * sstep(u / 0.5) + 0.1 * Math.sin(t * 30) * u; W.crouch = 0.35 * u; look = { x: 1, y: 0 };
  } else if (C.ph === 'shoot' || C.ph === 'reel') {
    if (C.tg) aim = aimAt(C.tg.x, C.tg.y) * 0.8;
    hunt = 1; W.crouch = C.ph === 'shoot' ? 0.4 : 0.2; W.mouth = 0.5; look = { x: 1, y: 0 };
  } else if (C.ph === 'miss') { // the tongue snaps on nothing; he blinks at the empty air, annoyed
    if (C.tg && el < 0.4) aim = aimAt(C.tg.x, C.tg.y) * 0.8 * (1 - sstep((el - 0.25) / 0.15));
    W.mouth = el < 0.4 ? 0.5 : 0; W.angry = el > 0.3 ? 1 : 0; W.shake = el > 0.35 && el < 0.6 ? 0.5 : 0; look = { x: 0.2, y: 0.4 * Math.sin(t * 6) }; still = el > 0.4;
  } else if (C.ph === 'digest') { // gulp, then smug and still
    W.swell = el < 0.5 ? 0.5 * Math.sin(Math.PI * el / 0.5) : 0; look = { x: 0.4, y: 0.3 * Math.sin(t * 0.7) }; still = el > 0.6;
  } else if (C.ph === 'sick') {
    W.sick = 1; W.walk = moving ? 1 : 0; W.dazed = 0.6; W.splay = 0.6;
    if (C.cough && C.cough.t > CHAM.fly) { const u = 1 - (C.cough.t - CHAM.fly) / CHAM.retch; W.crouch = 0.6 * Math.sin(Math.PI * clamp(u * 2.2, 0, 1)) + 0.4 * sstep((u - 0.6) / 0.4); W.shake = u > 0.45 ? 1 : 0.3; W.mouth = u > 0.75 ? 1 : 0.25 * Math.sin(t * 22) ** 2; W.swell = sstep((u - 0.4) / 0.4); W.rear = u > 0.85 ? 0.4 : 0; }
    else if (C.cough) { W.mouth = 1; W.rear = 0.3; }
  } else if (C.ph === 'stagger') { W.shake = el < 0.35 ? 1 : 0; W.dazed = 0.7; W.splay = 1; W.mouth = 0.3; }
  else if (C.ph === 'nap') { still = true; W.crouch = 0.2; }
  else if (C.ph === 'daze') { W.dazed = 1; W.splay = 1; W.tongue = 0.6; }
  W.walk = Math.max(W.walk, moving && C.ph !== 'sick' ? 1 : 0);
  if (C.sickT > 0 && C.ph !== 'sick') W.sick = 1;
  for (const c of CH) S.B[c] += (W[c] - S.B[c]) * (1 - Math.exp(-dt * RATE[c]));
  S.hunt += (hunt - S.hunt) * (1 - Math.exp(-dt * 14));
  S.aim += (aim - S.aim) * (1 - Math.exp(-dt * 9));
  S.look.x += (look.x - S.look.x) * Math.min(1, dt * 7); S.look.y += (look.y - S.look.y) * Math.min(1, dt * 7);
  // camo: up while he sits still, back down at once when he walks, telegraphs, is hit or is sick
  const want = still && C.sickT <= 0 && !(C.cough) ? CAMO : 0, was = S.camo;
  S.camo = want > S.camo ? Math.min(want, S.camo + CAMO_IN * dt) : Math.max(want, S.camo - CAMO_OUT * dt);
  if (S.camo < was - 1e-4 && was > 0.25) S.shim = 1; // he shimmers back into view
  S.shim = Math.max(0, S.shim - dt * 2.2);
  if (S.camo > 0.01 || S.shim > 0) S.col = floorColor(sim, C);
  S.hop = C.ph === 'stagger' && el < 0.35 ? 0.08 * Math.sin(Math.PI * el / 0.35) : 0;
}
function beaten(S, dt, t) {
  if (S.beatT < 0) { S.beatT = t; S.bodo = S.odo; }
  const el = t - S.beatT;
  for (const c of CH) S.B[c] += ((c === 'walk' ? (el >= 0.6 ? 1 : 0) : c === 'mouth' ? (el < 0.6 ? 0.3 : 0) : 0) - S.B[c]) * (1 - Math.exp(-dt * 9));
  if (el >= 0.6) { S.bodo += 1.4 * dt; S.odo = S.bodo; }
  S.camo = Math.min(CAMO, S.camo + dt * 0.7); // he fades out into the ring as he slinks off
  return el;
}

// ctx: world space (meters, y up). k: pixels per meter.
export function drawCham26(ctx, sim, C, k, t) {
  const S = stateOf(sim, C, t);
  const dt = clamp(t - S.t, 0, 0.05);
  S.t = t;
  if (!shown(C)) return;
  pull(S, C);
  const st = statusClock(sim, 'c' + C.id, C.ph === 'daze' ? (C.dk === 'frost' ? { k: 'ice', left: C.t } : { k: 'stun', zap: C.dk === 'bolt', left: C.t }) : null, t);
  const frozen = !!(st && st.k === 'ice'), won = C.ph === 'beat';
  let alpha = C.ph === 'in' ? sstep(C.dur / 0.45) : 1;
  if (won) { const el = beaten(S, dt, t); alpha = 1 - sstep((el - 2.0) / 0.6); if (alpha <= 0) return; if (!S.col) S.col = floorColor(sim, C); }
  else if (!frozen) step(sim, C, S, dt, t);
  const L = svlOf(C), out = {};
  // the tongue: out to the orb (lock: not yet; shoot: flying; reel: coming back with it; miss: a snap on nothing)
  let snatch = 0, tgt = null;
  if (C.tg) tgt = { x: C.tg.x * k, y: -C.tg.y * k };
  if (C.ph === 'shoot') snatch = sstep(1 - C.t / CHAM.shoot);
  else if (C.ph === 'reel') snatch = 1 - sstep(1 - C.t / CHAM.reel);
  else if (C.ph === 'miss') { const el = C.dur - C.t; snatch = el < 0.16 ? sstep(el / 0.16) : 1 - sstep((el - 0.16) / 0.2); }
  ctx.save();
  ctx.globalAlpha = alpha;
  const sn = bodyAt(S, 0), nap = C.ph === 'nap', o = {
    pose: 'idle', blend: { ...S.B, snatch }, gait: S.odo * k, id: 260 + C.id, heading: -S.hd, aim: -S.aim, look: S.look, noShadow: frozen ? 1 : 0, hunt: S.hunt,
    trail: (d) => { const q = bodyAt(S, d / k); return { x: q.x * k, y: -q.y * k }; }, status: st, out, target: tgt || undefined,
    camo: S.camo, camoColor: S.col || undefined,
  };
  if (nap) o.blink = 1;
  else if (C.ph === 'miss') { const el = C.dur - C.t; o.blink = el > 0.4 && el < 0.95 ? (Math.sin((el - 0.4) * 22) > 0 ? 0.85 : 0.35) : undefined; } // annoyed blinks
  ctx.scale(1 / k, -1 / k);
  drawCrawler(ctx, sn.x * k, -sn.y * k, L * k, frozen ? st.hold : t, o, 'chameleon');
  // the orb rides the tongue's tip back in
  if (C.ph === 'reel' && C.held && out.tongue) drawOrb(ctx, C.held.type, out.tongue.x, out.tongue.y, 0.2 * k * (0.75 + 0.25 * out.tongue.k), t, true);
  ctx.scale(k, -k);
  if (S.shim > 0) shimmer(ctx, S, L, t);
  if (C.ph === 'digest' && t - S.gulpT < 0.75) gulp(ctx, S, L, (t - S.gulpT) / 0.75, C);
  if (C.ph === 'lock') throat(ctx, S, clamp(1 - C.t / CHAM.lock, 0, 1), t);
  if (C.cough) cough(ctx, sim, C, S, k, t);
  if (C.ph === 'miss' && C.dur - C.t < 0.45 && C.tg) { const f = (C.dur - C.t - 0.1) / 0.35; if (f > 0 && f < 1) puffAt(ctx, C.tg.x, C.tg.y, f, '#ffffff'); } // a snap on nothing
  if (nap) zees(ctx, S, t);
  if (C.ph === 'in' && C.dur < 0.7) { // leaves flutter where he squeezes in through the gap
    const f = C.dur / 0.7, n = sim.rings.length, ring = sim.rings[n - 1], ga = ring.body.getAngle() + C.ent.la, r = ring.r + 0.1;
    ctx.globalAlpha = 0.7 * (1 - f); ctx.fillStyle = '#9fe07a';
    for (let i = 0; i < 6; i++) { const aa = ga + (hash(i + 1) - 0.5) * 0.25, rr = r + (hash(i + 7) - 0.3) * 0.5 * f; ctx.beginPath(); ctx.ellipse(rr * Math.cos(aa), rr * Math.sin(aa), 0.05 + 0.08 * f, 0.03, aa + f * 3, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

// camo dropping: a glassy ripple runs down his back as the colours come back
function shimmer(ctx, S, L, t) {
  const f = 1 - S.shim;
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const g = clamp(f * 1.3 - i * 0.15, 0, 1); if (g <= 0 || g >= 1) continue;
    const d = g * L * 1.4, c = bodyAt(S, d), b = bodyAt(S, d + 0.06), nx = -(b.y - c.y), ny = b.x - c.x, l = Math.hypot(nx, ny) || 1, w = 0.2 * (1 - g * 0.5);
    ctx.globalAlpha = 0.75 * Math.sin(Math.PI * g) * S.shim;
    ctx.strokeStyle = i === 1 ? '#c9fff0' : '#ffffff'; ctx.lineWidth = 0.035;
    ctx.beginPath(); ctx.moveTo(c.x + (nx / l) * w, c.y + (ny / l) * w); ctx.quadraticCurveTo(c.x - (b.x - c.x) * 1.5, c.y - (b.y - c.y) * 1.5, c.x - (nx / l) * w, c.y - (ny / l) * w); ctx.stroke();
  }
  for (let i = 0; i < 5; i++) { // sparkles
    const g = (f + hash(i + 4) * 0.5) % 1, c = bodyAt(S, L * (0.15 + 1.1 * hash(i + 11)));
    ctx.globalAlpha = S.shim * Math.sin(Math.PI * g); ctx.fillStyle = '#ffffff';
    star(ctx, c.x + (hash(i + 2) - 0.5) * 0.25, c.y + (hash(i + 3) - 0.5) * 0.25, 0.06 * Math.sin(Math.PI * g));
  }
  ctx.restore();
}
function star(ctx, x, y, r) {
  if (r <= 0.003) return;
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r); ctx.fill();
}
// the gulp: a lump runs from his throat down to his belly
function gulp(ctx, S, L, f, C) {
  const d = lerp(0.12, 0.62 * L, sstep(f)), c = bodyAt(S, d), r = 0.1 * (1 - 0.5 * f) + 0.03;
  const col = C.ate && C.ate.length ? C.ate[C.ate.length - 1] : '';
  ctx.save();
  ctx.globalAlpha = 0.9 * (1 - sstep((f - 0.7) / 0.3));
  ctx.fillStyle = 'rgba(20,60,20,0.35)'; ctx.beginPath(); ctx.arc(c.x + 0.02, c.y - 0.03, r * 1.15, 0, TAU); ctx.fill();
  ctx.fillStyle = col === 'fire_black' ? '#5a4a6a' : '#8fe06a'; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(c.x - r * 0.35, c.y + r * 0.35, r * 0.35, 0, TAU); ctx.fill();
  ctx.restore();
}
// the telegraph: the throat pouch throbs, and two short sight lines run from the eyes to the orb
function throat(ctx, S, u, t) {
  const C = S.C; if (!C.tg) return;
  const h = bodyAt(S, 0.08), tx = C.tg.x, ty = C.tg.y, dx = tx - h.x, dy = ty - h.y, l = Math.hypot(dx, dy) || 1;
  ctx.save(); ctx.lineCap = 'round';
  ctx.globalAlpha = 0.55 * sstep(u / 0.4); ctx.strokeStyle = '#fff6b0'; ctx.lineWidth = 0.025; ctx.setLineDash([0.06, 0.07]); ctx.lineDashOffset = -t * 0.6;
  for (const s of [-1, 1]) { const ox = (-dy / l) * 0.09 * s * (1 - u), oy = (dx / l) * 0.09 * s * (1 - u); ctx.beginPath(); ctx.moveTo(h.x + ox, h.y + oy); ctx.lineTo(lerp(h.x, tx, 0.82), lerp(h.y, ty, 0.82)); ctx.stroke(); }
  ctx.setLineDash([]);
  // a target glint on the orb
  ctx.globalAlpha = 0.8 * sstep(u / 0.5); ctx.strokeStyle = '#fff6b0'; ctx.lineWidth = 0.03;
  const r = 0.3 - 0.06 * u; ctx.beginPath(); ctx.arc(tx, ty, r, 0, TAU); ctx.stroke();
  ctx.restore();
}
// the cough: retch, then the orb arcs out of his mouth and lands ahead of him in the channel
function cough(ctx, sim, C, S, k, t) {
  const K = C.cough;
  if (K.t > CHAM.fly) { // retching: little sweat drops and a wobble line over the head
    const u = 1 - (K.t - CHAM.fly) / CHAM.retch, h = bodyAt(S, 0.25), r = Math.hypot(h.x, h.y) || 1, ux = h.x / r, uy = h.y / r;
    ctx.save(); ctx.globalAlpha = 0.85; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.03; ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) { const a = Math.atan2(uy, ux) + i * 0.5, j = Math.sin(t * 28 + i) * 0.02; ctx.beginPath(); ctx.moveTo(h.x + Math.cos(a) * (0.28 + j), h.y + Math.sin(a) * (0.28 + j)); ctx.lineTo(h.x + Math.cos(a) * (0.4 + j + 0.06 * u), h.y + Math.sin(a) * (0.4 + j + 0.06 * u)); ctx.stroke(); }
    ctx.restore();
    return;
  }
  if (K.x0 == null) return;
  const f = clamp(1 - K.t / CHAM.fly, 0, 1), x1 = K.r * Math.cos(K.la), y1 = K.r * Math.sin(K.la);
  const x = lerp(K.x0, x1, f), y = lerp(K.y0, y1, f), l = Math.hypot(x, y) || 1, bow = Math.sin(Math.PI * f) * 0.55;
  const ox = x - (x / l) * bow * 0.3, oy = y + bow; // up (screen) and a little inward
  ctx.save();
  ctx.scale(1 / k, -1 / k);
  drawOrb(ctx, K.type, ox * k, -oy * k, 0.2 * k * (0.6 + 0.4 * f), t, true);
  ctx.restore();
  if (f < 0.35) puffAt(ctx, K.x0, K.y0, f / 0.35, '#e8ffb0');
}
function puffAt(ctx, x, y, f, col) {
  ctx.save(); ctx.globalAlpha = 0.9 * (1 - f); ctx.strokeStyle = col; ctx.lineWidth = 0.04; ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.4, r0 = 0.08 + 0.22 * f; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * (r0 + 0.12), y + Math.sin(a) * (r0 + 0.12)); ctx.stroke(); }
  ctx.restore();
}
function zees(ctx, S, t) {
  const h = bodyAt(S, 0.2), k = 100;
  ctx.save(); ctx.scale(1 / k, -1 / k); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < 3; i++) {
    const f = (t * 0.45 + i / 3) % 1, x = h.x + 0.25 * f + Math.sin(f * 6 + i) * 0.05, y = h.y + 0.3 + 0.5 * f;
    ctx.globalAlpha = Math.sin(Math.PI * f) * 0.95;
    ctx.font = `bold ${Math.round(14 + 10 * f)}px sans-serif`;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,40,30,0.7)'; ctx.strokeText('z', x * k, -y * k);
    ctx.fillStyle = '#ffffff'; ctx.fillText('z', x * k, -y * k);
  }
  ctx.restore();
}
