// Baron von Brr: the frost gecko (render/cousins.js) as the villain of level 15 (sim kind 'blizzard').
// RENDER ONLY. His body is the sim's crawler (sim/salamander.js, species 'gecko': sim.geckoOf()): he crawls in through
// a gap of the outer ring, walks the channel floors and climbs through gaps toward the eggs, and the blizzard attacks
// (sim/boss.js gale, freeze, icicles) come from him where he stands. Everything here is read from the sim (his trail,
// phase, the boss attack) and never written back. Drawn from drawSalamanders (render/salamander.js), under the eggs.
import { RING_TH, TAU } from '../sim/geom.js';
import { GECKO } from '../sim/salamander.js';
import { drawCrawler } from './crawlers.js';
import { statusClock } from './status.js';
import { hash } from './castkit.js';

const SVL = GECKO.svl, UM = SVL / 100, LEN = 178 * UM, HIP = 76 * UM; // meters: snout to hips, one body unit, whole length
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
const lerp = (a, b, k) => a + (b - a) * k;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const CH = ['walk', 'rear', 'crouch', 'mouth', 'swell', 'dazed', 'angry', 'shake', 'flee', 'splay', 'tongue', 'frost'];

let S = null;
export const isGecko15 = (sim) => !!(sim && sim.bx && sim.bx.boss && sim.bx.boss.kind === 'blizzard');
const geckoC = (sim) => (sim && sim.geckoOf ? sim.geckoOf() : null);
const shown = (C) => !!C && C.ph !== 'wait' && C.ph !== 'gone' && C.ph !== 'warp' && C.pts.length > 2;

function fresh(sim, t) {
  S = { sim, t, hx: 0, hy: 0, hd: 0, tr: [], odo: 0, B: {}, look: { x: 0.45, y: 0 }, aim: 0, hop: 0, flick: 0, touch: 0, crack: 0, hurtT: -9, wasFl: 0, wasDz: 0, k: 30, prints: [], pOdo: null, pSide: 1, beatT: -1, lkT: -9, lk: null, wide: false };
  for (const c of CH) S.B[c] = 0;
  return S;
}
// his trail from the sim (snout first), in meters
function pull(C) {
  S.tr = C.pts;
  const h = C.pts[0], q = C.pts[Math.min(C.pts.length - 1, 3)];
  S.hx = h.x; S.hy = h.y;
  if (Math.hypot(h.x - q.x, h.y - q.y) > 1e-4) S.hd = Math.atan2(h.y - q.y, h.x - q.x);
  S.odo = C.odo;
}
// a point d meters behind the snout, along the trail he actually walked (past its end: straight on)
function trailAt(d) {
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
// the same, with the body's own moves on top: the hurt hop (a jump off the floor) and the tail flick
function bodyAt(d) {
  const q = trailAt(d), l = Math.hypot(q.x, q.y) || 1, nx = q.x / l, ny = q.y / l;
  let o = S.hop;
  if (d > HIP && S.flick) { const f = (d - HIP) / (LEN - HIP); o += S.flick * Math.pow(f, 1.5) * 0.9; }
  return { x: q.x + nx * o, y: q.y + ny * o };
}

function step(sim, C, B, dt, t) {
  const A = B.atk, st = sim.state;
  const warn = A && A.ph === 'warn', act = A && A.ph === 'act', u = warn ? clamp(1 - A.t / A.dur, 0, 1) : act ? 1 : 0;
  const W = {}; for (const c of CH) W[c] = 0;
  let look = { x: 0.45, y: 0 }, aim = 0, flick = 0;
  const flinch = B.flinch > 0, dizzy = B.dizzy > 0 || C.ph === 'daze';
  if (flinch && !S.wasFl) S.hurtT = t;
  if (B.dizzy > 0 && !S.wasDz) S.hurtT = t;
  S.wasFl = flinch; S.wasDz = B.dizzy > 0;
  const hu = (t - S.hurtT) / 0.55; // the hurt take: a hop, eyes wide, jaw dropped
  const moving = C.ph === 'walk' || C.ph === 'brake' || C.ph === 'retreat' || C.ph === 'in';
  const a = Math.atan2(S.hy, S.hx);
  // head turn toward a world point (radians off his heading, clamped)
  const aimAt = (x, y) => clamp(wrap(Math.atan2(y - S.hy, x - S.hx) - S.hd), -1.1, 1.1);
  if (st !== 'play' && C.ph === 'grin') { // the level is lost: he gloats
    W.rear = 0.35; W.tongue = 1; W.mouth = 0.7; W.angry = 0.4;
  } else if (hu >= 0 && hu < 1) {
    W.shake = 1; W.mouth = 0.9; W.splay = 1; W.crouch = 0.4; look = { x: -0.2, y: 0 };
  } else if (dizzy) {
    W.dazed = 1; W.splay = 1; W.tongue = 0.6;
  } else if (C.ph === 'lick') {
    // he reaches his head to the egg and licks it: the tongue goes out, then the ice runs over it
    const e = sim.eggs.find((x) => x.id === C.lk), el = C.dur - C.t;
    if (e && e.alive && !e.saved) { const p = e.body.getPosition(); aim = aimAt(p.x, p.y) * 0.8; S.lk = { x: p.x, y: p.y }; }
    W.crouch = 0.45 + 0.3 * Math.sin(Math.PI * clamp(el / C.dur, 0, 1)); W.tongue = el > 0.12 ? 1 : 0; W.mouth = 0.6; W.frost = 1;
    look = { x: 1, y: 0 };
  } else if (A && (C.ph === 'atk' || C.ph === 'brake')) {
    if (A.name === 'gale') {
      if (warn) { W.crouch = 0.5 * Math.sin(Math.PI * clamp(u / 0.5, 0, 1)); W.rear = 0.75 * sstep((u - 0.3) / 0.4); W.swell = sstep((u - 0.35) / 0.4); W.mouth = 0.15 * W.swell; W.angry = 0.7; }
      else { W.rear = 0.7; W.mouth = 1; W.swell = 0.35 + 0.3 * Math.sin(t * 17); W.angry = 1; W.shake = 0.35; }
      look = { x: 1, y: 0 };
    } else if (A.name === 'freeze') {
      // he turns his head to the wall he freezes and slaps, slaps, licks it
      const ring = sim.rings[A.ring], toward = ring ? (ring.r < Math.hypot(S.hx, S.hy) ? -1 : 1) : 1;
      aim = aimAt(S.hx + Math.cos(a) * toward, S.hy + Math.sin(a) * toward);
      S.touch = Math.min(1, S.touch + dt * 4);
      W.frost = S.touch; W.angry = 0.5;
      if (S.touch > 0.3 || act) { const sl = Math.abs(Math.sin(t * 9.5)); W.crouch = 0.75 * sl; W.tongue = 1; W.mouth = 0.55; S.crack = Math.min(1, S.crack + dt / 0.45); }
      look = { x: 1, y: 0 };
    } else if (A.name === 'icicles') {
      // the icicle tail: it coils in, then whips up and out, and the icicles fly off it
      flick = warn ? (u < 0.28 ? -0.3 * sstep(u / 0.28) : u < 0.5 ? lerp(-0.3, 1, sstep((u - 0.28) / 0.14)) : 1 - 0.75 * sstep((u - 0.55) / 0.45) + 0.12 * Math.sin((u - 0.5) * 40) * (1 - u)) : 0.25 * clamp(A.t / A.dur, 0, 1);
      W.angry = 0.8; W.crouch = warn && u < 0.3 ? 0.6 : 0; W.mouth = warn && u > 0.3 ? 0.4 : 0;
      aim = 0.5 * Math.sign(Math.cos(S.hd - (a + Math.PI / 2)) || 1) * (warn ? sstep(u / 0.3) : 0.4); // he looks back over his shoulder
      look = { x: 0.3, y: 0 };
    }
  } else if (C.bored > 0 && moving) { W.tongue = C.bored > GECKO.bored - 1.2 ? 0.7 : 0; look = { x: 0.6, y: 0.4 * Math.sin(t * 2) }; } // smug, wandering off
  if (!(A && A.name === 'freeze' && C.ph === 'atk')) { S.touch = Math.max(0, S.touch - dt * 4); if (!A || A.name !== 'freeze') S.crack = 0; }
  W.walk = moving ? 1 : 0;
  const rate = { walk: 9, rear: 9, crouch: 16, mouth: 14, swell: 9, dazed: 6, angry: 8, shake: 30, flee: 6, splay: 8, tongue: 12, frost: 5 };
  for (const c of CH) S.B[c] += (W[c] - S.B[c]) * (1 - Math.exp(-dt * rate[c]));
  S.hop = hu >= 0 && hu < 1 ? 0.12 * Math.sin(Math.PI * Math.min(1, hu * 1.6)) * (hu < 0.625 ? 1 : 0) : 0;
  S.flick += (flick - S.flick) * (1 - Math.exp(-dt * 26));
  S.aim += (aim - S.aim) * (1 - Math.exp(-dt * 8));
  S.look.x += (look.x - S.look.x) * Math.min(1, dt * 7); S.look.y += (look.y - S.look.y) * Math.min(1, dt * 7);
  S.wide = hu >= 0 && hu < 1;
}
// beaten (the level is won): he goes limp, then scrabbles off and is gone in a puff of snow
function beaten(dt, t) {
  if (S.beatT < 0) { S.beatT = t; S.hurtT = t; }
  const el = t - S.beatT;
  for (const c of CH) S.B[c] += ((c === 'dazed' || c === 'splay' ? (el < 1.1 ? 1 : 0) : c === 'walk' || c === 'flee' ? (el >= 1.1 ? 1 : 0) : c === 'mouth' ? 0.8 : c === 'shake' ? (el < 0.5 ? 1 : 0) : 0) - S.B[c]) * (1 - Math.exp(-dt * 9));
  if (el >= 1.1) S.odo = (S.bodo = (S.bodo || S.odo) + 6 * dt);
  S.hop = 0; S.flick += (0 - S.flick) * Math.min(1, dt * 8); S.wide = el < 0.5; S.touch = 0; S.crack = 0;
  return el;
}

// icy feet: frosty prints where his feet came down (on the floor wall, riding its ring), gone after GECKO.icy s
function footprints(sim, C, t) {
  if (C.ph !== 'walk' && C.ph !== 'brake' && C.ph !== 'retreat') return;
  if (S.pOdo == null || Math.abs(C.odo - S.pOdo) > 0.2) {
    S.pOdo = C.odo; S.pSide = -S.pSide;
    const n = sim.rings.length;
    for (const d of [0.12 * SVL / 1.3, HIP * 0.95]) {
      const q = trailAt(d), r = Math.hypot(q.x, q.y), qa = Math.atan2(q.y, q.x), c = sim.chAt(r);
      if (c < 1 || c > n - 1) continue;
      const ri = Math.sin(qa) > 0 ? c - 1 : c, ring = sim.rings[ri];
      S.prints.push({ ri, la: qa - ring.body.getAngle(), side: S.pSide, t, out: ri === c - 1 ? 1 : -1, h: S.hd - qa });
    }
    if (S.prints.length > 60) S.prints.splice(0, S.prints.length - 60);
  }
}
function drawPrints(ctx, sim, t) {
  const left = [];
  for (const P of S.prints) {
    const age = t - P.t;
    if (age > GECKO.icy || age < 0) continue;
    left.push(P);
    const ring = sim.rings[P.ri], a = ring.body.getAngle() + P.la, r = ring.r + P.out * (RING_TH / 2 + 0.035) + P.side * 0.05 * P.out;
    const x = r * Math.cos(a), y = r * Math.sin(a), al = Math.min(1, age * 6) * (1 - sstep((age - (GECKO.icy - 1.2)) / 1.2));
    const h = a + P.h;
    ctx.save(); ctx.translate(x, y); ctx.rotate(h);
    ctx.globalAlpha = 0.85 * al; ctx.fillStyle = '#f4fcff'; ctx.strokeStyle = 'rgba(70,140,200,0.8)'; ctx.lineWidth = 0.012;
    ctx.beginPath(); ctx.ellipse(0, 0, 0.04, 0.03, 0, 0, TAU); ctx.fill(); ctx.stroke();
    for (const s of [-1, 0, 1]) { const ta = s * 0.6; ctx.beginPath(); ctx.arc(Math.cos(ta) * 0.065, Math.sin(ta) * 0.055, 0.017, 0, TAU); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }
  S.prints = left;
}

function ensure(sim, t) {
  if (!isGecko15(sim)) return null;
  if (!S || S.sim !== sim || t < S.t - 0.5) fresh(sim, t);
  return S;
}
// his body centre in the world, where he is drawn now (popups, hit sparks)
export function geckoAnchor(sim) {
  const C = geckoC(sim);
  if (!isGecko15(sim) || !shown(C)) return null;
  if (!S || S.sim !== sim) fresh(sim, sim.t);
  pull(C);
  return bodyAt(HIP * 0.55);
}
// the deep freeze: where his snout touches, and how far the frost has run from it to the ring (0..1)
export function geckoFreeze(sim) {
  const C = geckoC(sim);
  if (!isGecko15(sim) || !S || S.sim !== sim || !shown(C)) return null;
  pull(C);
  const sn = bodyAt(0), ha = S.hd + S.aim;
  return { x: sn.x + Math.cos(ha) * 0.12, y: sn.y + Math.sin(ha) * 0.12, u: S.crack };
}
// a strike event or effect aimed at the boss's sim point, moved onto him (strikes now aim at his sim body: kept for 'bx')
export function geckoStrikeEv(sim, ev) {
  if (!ev || !ev.type || ev.type.slice(0, 3) !== 'stk') return ev;
  const g = geckoAnchor(sim);
  if (!g) return ev;
  if (ev.type === 'stkHit' && ev.key === 'bx') return { ...ev, x: g.x, y: g.y };
  if ((ev.type === 'stkFire' || ev.type === 'stkLaunch') && sim.stk && sim.stk.fly && sim.stk.fly.key === 'bx') return { ...ev, tx: g.x, ty: g.y };
  return ev;
}

function mouthPt() { // the open mouth (he rears: the forebody pulls back toward the hips)
  const hp = bodyAt(HIP), sn = bodyAt(0), r = S.B.rear, c = 1 - 0.26 * Math.sin(Math.PI * clamp(r, 0, 1)) * (1 - S.B.crouch * 0.5) - 0.22 * S.B.crouch + 0.07 * r;
  return { x: hp.x + (sn.x - hp.x) * c, y: hp.y + (sn.y - hp.y) * c };
}
// the gale is his breath: it leaves his mouth and runs along the ring the way the wind blows
function drawBreath(ctx, A, t, calm) {
  const warn = A.ph === 'warn', u = warn ? clamp(1 - A.t / A.dur, 0, 1) : 1;
  const pw = warn ? 0.35 * sstep((u - 0.75) / 0.25) : Math.min(1, (A.dur - A.t) * 5) * Math.min(1, A.t * 2.5 + 0.15);
  if (pw < 0.02 || S.B.rear < 0.25) return;
  const m = mouthPt(), am = Math.atan2(m.y, m.x), rm = Math.hypot(m.x, m.y), dir = A.dir, N = calm ? 12 : 30;
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < N; i++) {
    const f = (t * (0.9 + 0.5 * hash(i + 3)) + hash(i * 7.1)) % 1, sp = (hash(i + 11) - 0.5) * 2;
    const ang = am + dir * (0.03 + f * (0.75 + 0.5 * hash(i + 5))), r = rm + sp * f * 0.75 - f * f * 0.9;
    const x = r * Math.cos(ang), y = r * Math.sin(ang), al = pw * (1 - f) * (f < 0.08 ? f / 0.08 : 1);
    if (i % 3) { // streaks that leave the mouth and bend with the ring
      const span = (0.06 + 0.16 * f) * dir;
      ctx.globalAlpha = al * 0.6; ctx.strokeStyle = 'rgba(46,100,170,1)'; ctx.lineWidth = 0.14 + 0.1 * f;
      ctx.beginPath(); ctx.arc(0, 0, r, Math.min(ang - span, ang), Math.max(ang - span, ang)); ctx.stroke();
      ctx.globalAlpha = al; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.07 + 0.05 * f;
      ctx.beginPath(); ctx.arc(0, 0, r, Math.min(ang - span, ang), Math.max(ang - span, ang)); ctx.stroke();
    } else { // frosty puffs
      ctx.globalAlpha = al * 0.7; ctx.fillStyle = '#eaf8ff';
      ctx.beginPath(); ctx.arc(x, y, 0.1 + 0.42 * f, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}
// the icicles: thrown off the tail flick, each one flies to the spot where it then hangs (sim.bx.ice)
function drawFlick(ctx, sim, A, t) {
  if (A.ph !== 'warn') return;
  const u = clamp(1 - A.t / A.dur, 0, 1), f = (u - 0.36) / 0.34;
  const tip = bodyAt(LEN - 0.05);
  ctx.save();
  if (u > 0.3 && u < 0.62) { // the whip's swish
    const b = bodyAt(LEN * 0.8), k = Math.sin(Math.PI * (u - 0.3) / 0.32);
    ctx.globalAlpha = 0.8 * k; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.05; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const an = Math.atan2(tip.y - b.y, tip.x - b.x) + (i - 1) * 0.5, r0 = 0.22, r1 = 0.4 + 0.15 * k; ctx.beginPath(); ctx.moveTo(tip.x + Math.cos(an) * r0, tip.y + Math.sin(an) * r0); ctx.lineTo(tip.x + Math.cos(an) * r1, tip.y + Math.sin(an) * r1); ctx.stroke(); }
  }
  if (f > 0 && f < 1) {
    for (const I of sim.bx.ice || []) {
      if (I.ph !== 'hang' || I.big) continue;
      const e = 1 - Math.pow(1 - f, 1.7), l = Math.hypot(tip.x, tip.y) || 1, bow = Math.sin(Math.PI * e) * 0.9;
      const x = lerp(tip.x, I.x, e) + (tip.x / l) * bow, y = lerp(tip.y, I.y, e) + (tip.y / l) * bow;
      const e2 = Math.min(1, e + 0.04), x2 = lerp(tip.x, I.x, e2) + (tip.x / l) * Math.sin(Math.PI * e2) * 0.9, y2 = lerp(tip.y, I.y, e2) + (tip.y / l) * Math.sin(Math.PI * e2) * 0.9;
      const an = Math.atan2(y2 - y, x2 - x), ca = Math.cos(an), sa = Math.sin(an), L = 0.2, w = 0.06;
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.moveTo(x + ca * L, y + sa * L); ctx.lineTo(x - sa * w, y + ca * w); ctx.lineTo(x - ca * L * 0.8, y - sa * L * 0.8); ctx.lineTo(x + sa * w, y - ca * w); ctx.closePath();
      ctx.fillStyle = '#eafaff'; ctx.fill(); ctx.strokeStyle = '#3f86c8'; ctx.lineWidth = 0.025; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.globalAlpha = 0.7; ctx.fillStyle = '#ffffff';
      for (let j = 1; j < 4; j++) { ctx.beginPath(); ctx.arc(x - ca * j * 0.16 + sa * 0.05 * Math.sin(t * 30 + j), y - sa * j * 0.16, 0.035 - j * 0.007, 0, TAU); ctx.fill(); }
    }
  }
  ctx.restore();
}

// ctx: world space (meters, y up). k: pixels per meter. Called from drawSalamanders (render/salamander.js) every frame.
export function drawGecko15(ctx, sim, k, t, calm) {
  const B = sim.bx.boss, C = geckoC(sim);
  ensure(sim, t);
  const dt = clamp(t - S.t, 0, 0.05);
  S.t = t; S.k = k;
  if (!shown(C)) return;
  pull(C);
  const st = statusClock(sim, 'c' + C.id, C.ph === 'daze' ? (C.dk === 'frost' ? { k: 'ice', left: C.t } : { k: 'stun', zap: C.dk === 'bolt', left: C.t }) : null, t);
  const frozen = !!(st && st.k === 'ice');
  const won = C.ph === 'beat';
  let alpha = C.ph === 'in' ? sstep(C.dur / 0.45) : 1;
  if (won) { const el = beaten(dt, t); alpha = 1 - sstep((el - 1.6) / 0.5); if (alpha <= 0) return; }
  else if (!frozen) step(sim, C, B, dt, t);
  if (!frozen && !won) footprints(sim, C, t);
  drawPrints(ctx, sim, t);
  const A = B.atk, acting = A && C.ph === 'atk' && !won;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (acting && A.name === 'gale') drawBreath(ctx, A, t, calm);
  const s = SVL * k, sn = bodyAt(0), o = {
    pose: 'idle', blend: { ...S.B }, gait: S.odo * k, id: 15, heading: -S.hd, aim: -S.aim, look: S.wide ? { x: 0.1, y: 0 } : S.look, noShadow: frozen ? 1 : 0,
    trail: (d) => { const q = bodyAt(d / k); return { x: q.x * k, y: -q.y * k }; }, status: st,
  };
  if (S.wide) o.blink = 0;
  ctx.scale(1 / k, -1 / k);
  drawCrawler(ctx, sn.x * k, -sn.y * k, s, frozen ? st.hold : t, o, 'gecko');
  ctx.scale(k, -k);
  if (acting && A.name === 'icicles') drawFlick(ctx, sim, A, t);
  if (C.ph === 'lick' && S.lk) drawLickFx(ctx, C, t);
  if (C.ph === 'in' && C.dur < 0.6) { // a puff of snow where he squeezes through the gap
    const f = C.dur / 0.6, n = sim.rings.length, ring = sim.rings[n - 1], ga = ring.body.getAngle() + C.ent.la, r = ring.r + 0.1;
    ctx.globalAlpha = 0.75 * (1 - f); ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 6; i++) { const aa = ga + (hash(i + 1) - 0.5) * 0.25, rr = r + (hash(i + 7) - 0.3) * 0.5 * f; ctx.beginPath(); ctx.arc(rr * Math.cos(aa), rr * Math.sin(aa), 0.06 + 0.14 * f, 0, TAU); ctx.fill(); }
  }
  if (won && t - S.beatT > 1.1) { // gone in a puff of snow
    const f = clamp((t - S.beatT - 1.1) / 1.0, 0, 1), c = bodyAt(HIP * 0.6);
    ctx.globalAlpha = 0.8 * (1 - f); ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 7; i++) { const aa = hash(i + 3) * TAU; ctx.beginPath(); ctx.arc(c.x + Math.cos(aa) * 0.5 * f, c.y + Math.sin(aa) * 0.5 * f, 0.1 + 0.18 * f, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}
// the lick: a frosty glint and a few ice flecks fly from his tongue onto the egg
function drawLickFx(ctx, C, t) {
  const el = C.dur - C.t, f = clamp((el - GECKO.lickAt + 0.12) / 0.4, 0, 1);
  if (f <= 0 || f >= 1) return;
  const sn = bodyAt(0), e = S.lk;
  ctx.save();
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#7cc4f0'; ctx.lineWidth = 0.02;
  for (let i = 0; i < 6; i++) {
    const g = clamp(f * 1.4 - hash(i + 2) * 0.4, 0, 1), x = lerp(sn.x, e.x, g) + (hash(i + 9) - 0.5) * 0.25 * g, y = lerp(sn.y, e.y, g) + Math.sin(Math.PI * g) * 0.12;
    ctx.globalAlpha = 1 - g * 0.7;
    ctx.beginPath(); ctx.moveTo(x, y + 0.05); ctx.lineTo(x + 0.03, y); ctx.lineTo(x, y - 0.05); ctx.lineTo(x - 0.03, y); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}
// an egg he licked: frozen solid in a block of ice (drawn over the eggs, render/boss.js drawBossOver)
export function drawGeckoOver(ctx, sim, k, t) {
  if (!isGecko15(sim)) return;
  for (const e of sim.aliveEggs()) {
    if (!(e.icy > 0)) continue;
    const p = e.body.getPosition(), age = GECKO.freeze - e.icy, grow = sstep(age / 0.28), end = e.icy < 0.6 ? 1 - e.icy / 0.6 : 0;
    const shake = end > 0 ? Math.sin(t * 60) * 0.012 * end : 0, R = 0.3 * (0.4 + 0.6 * grow), a0 = e.body.getAngle() * 0.3 + e.id;
    ctx.save();
    ctx.translate(p.x + shake, p.y);
    // the block: a chunky faceted shell, light from the top left
    ctx.beginPath();
    for (let i = 0; i < 7; i++) { const a = a0 + (i / 7) * TAU, rr = R * (0.9 + 0.16 * hash(i + e.id * 3)); ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr * 1.08); }
    ctx.closePath();
    const g = ctx.createLinearGradient(-R, R, R, -R);
    g.addColorStop(0, 'rgba(120,190,240,0.62)'); g.addColorStop(0.55, 'rgba(200,236,255,0.5)'); g.addColorStop(1, 'rgba(250,254,255,0.72)');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(40,110,180,0.9)'; ctx.lineWidth = Math.max(0.022, 2 / k); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = Math.max(0.018, 1.6 / k);
    ctx.beginPath(); ctx.moveTo(-R * 0.55, R * 0.25); ctx.lineTo(-R * 0.3, R * 0.62); ctx.lineTo(R * 0.1, R * 0.7); ctx.stroke(); // the top-left glint
    ctx.beginPath(); ctx.arc(-R * 0.35, R * 0.42, R * 0.08, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill();
    // a frosty rim of crystals as it ices up
    if (grow < 1) { ctx.globalAlpha = 1 - grow; ctx.fillStyle = '#ffffff'; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + t; ctx.beginPath(); ctx.arc(Math.cos(a) * R * 1.3, Math.sin(a) * R * 1.3, 0.035, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; }
    // cracks race over it just before it thaws
    if (end > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = Math.max(0.015, 1.4 / k); ctx.beginPath();
      for (let i = 0; i < 3; i++) { const a = hash(i + e.id) * TAU, l = R * end; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * l * 0.5 + 0.03, Math.sin(a) * l * 0.5); ctx.lineTo(Math.cos(a + 0.4) * l, Math.sin(a + 0.4) * l); }
      ctx.stroke();
    }
    ctx.restore();
  }
}

// his face, for the boss bar chip (screen space, y down; drawn inside the chip's clip)
export function drawGeckoEmblem(ctx, r, t) {
  drawCrawler(ctx, 0, -r * 0.62, r * 2.55, t, { heading: -Math.PI / 2, pose: 'idle', id: 16, noShadow: 1, look: { x: 0.5, y: 0.5 } }, 'gecko');
}
// the intro card: the Baron on a pane of ice, giving you the side-eye
export function drawGeckoCard(ctx, x, y, w, h, t, age = null) {
  const e = age == null ? 1 : clamp(age / 0.45, 0, 1), pad = Math.max(2, h * 0.025), cw = Math.min(w - pad * 2, (h - pad * 2) * 1.5), ch = h - pad * 2, cx = x + w / 2, cy = y + h / 2;
  if (e <= 0) return true;
  ctx.save();
  ctx.translate(cx, cy + (1 - sstep(e)) * h * 0.12); ctx.scale(0.9 + 0.1 * sstep(e), 0.9 + 0.1 * sstep(e)); ctx.globalAlpha = sstep(e);
  const rr = Math.min(cw, ch) * 0.12;
  ctx.beginPath(); ctx.roundRect(-cw / 2, -ch / 2, cw, ch, rr);
  const g = ctx.createLinearGradient(0, -ch / 2, 0, ch / 2);
  g.addColorStop(0, '#2c5f9c'); g.addColorStop(1, '#173a6c');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = Math.max(1, ch * 0.012); ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) { const a = hash(i + 1) * TAU, l = ch * (0.2 + 0.5 * hash(i + 9)), px = (hash(i + 4) - 0.5) * cw, py = (hash(i + 6) - 0.5) * ch; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); ctx.stroke(); }
  const s = ch * 0.62;
  drawCrawler(ctx, cw * 0.3, ch * 0.02 + Math.sin(t * 1.4) * ch * 0.01, s, t, { heading: -0.12, curve: 0.55 / s, pose: 'idle', id: 17, look: { x: 0.5, y: 0.6 } }, 'gecko');
  ctx.restore();
  ctx.beginPath(); ctx.roundRect(-cw / 2, -ch / 2, cw, ch, rr);
  ctx.strokeStyle = '#ffe3b0'; ctx.lineWidth = Math.max(1.5, ch * 0.02); ctx.stroke();
  ctx.restore();
  return true;
}
