// Baron von Brr: the frost gecko (render/cousins.js) as the villain of level 15 (sim kind 'blizzard').
// RENDER ONLY. He is the visible author of every attack the sim already runs (sim/boss.js: gale, freeze, icicles):
// everything here is read from sim.bx.boss (attack name, warn / act phase, timers, dir, ring) and never written back.
// He clings to the outside of the outermost ring, on the upper arc, and crawls (a real snout trail, so the body
// follows through every turn) to where the next attack comes from; he never teleports.
import { RING_TH, TAU } from '../sim/geom.js';
import { drawCrawler } from './crawlers.js';
import { statusClock, statusKind } from './status.js';
import { hash } from './castkit.js';

const SVL = 2.0, UM = SVL / 100, LEN = 178 * UM, HIP = 76 * UM; // meters: snout to hips, one body unit, whole length
const TURN_R = 0.22, DEG = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
const lerp = (a, b, k) => a + (b - a) * k;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const CH = ['walk', 'rear', 'crouch', 'mouth', 'swell', 'dazed', 'angry', 'shake', 'flee', 'splay', 'tongue', 'frost'];

let S = null;
export const isGecko15 = (sim) => !!(sim && sim.bx && sim.bx.boss && sim.bx.boss.kind === 'blizzard');
const pathR = (sim) => sim.outerR + RING_TH / 2 + 0.3;

function fresh(sim, t) {
  const R = pathR(sim), a0 = 78 * DEG;
  S = { sim, t, R, hx: R * Math.cos(a0), hy: R * Math.sin(a0), hd: a0 - Math.PI / 2, tr: [], odo: 0, v: 0, B: {}, look: { x: 0.45, y: 0 }, aim: 0, hop: 0, flick: 0, touch: 0, crack: 0, frostAt: null, atk: null, goal: null, sl: null, hurtT: -9, wasFl: 0, wasDz: 0, k: 30, puffT: -9 };
  for (const c of CH) S.B[c] = 0;
  for (let d = 0; d <= LEN + 0.6; d += 0.05) { const a = a0 + d / R; S.tr.push({ x: R * Math.cos(a), y: R * Math.sin(a) }); }
  return S;
}
// a point d meters behind the snout, along the trail he actually walked
function trailAt(d) {
  const T = S.tr;
  let px = S.hx, py = S.hy, left = Math.max(0, d);
  for (let i = 0; i < T.length; i++) {
    const q = T[i], l = Math.hypot(q.x - px, q.y - py);
    if (l >= left && l > 1e-6) { const f = left / l; return { x: px + (q.x - px) * f, y: py + (q.y - py) * f }; }
    left -= l; px = q.x; py = q.y;
  }
  return { x: px, y: py };
}
// the same, with the body's own moves on top: the hurt hop (all of him jumps off the ring) and the tail flick
function bodyAt(d) {
  const q = trailAt(d), l = Math.hypot(q.x, q.y) || 1, nx = q.x / l, ny = q.y / l;
  let o = S.hop;
  if (d > HIP && S.flick) { const f = (d - HIP) / (LEN - HIP); o += S.flick * Math.pow(f, 1.5) * 1.7; }
  return { x: q.x + nx * o, y: q.y + ny * o };
}

// where the next attack comes from: { th (angle on the ring), face (+1 counter-clockwise, -1 clockwise, 0 any), touch }
function goalOf(sim, B, A) {
  if (A && A !== S.atk) {
    S.atk = A; S.crack = 0; S.touch = 0;
    if (A.name === 'gale') S.goal = { th: (90 + A.dir * 36) * DEG, face: A.dir, touch: 0 };
    else if (A.name === 'freeze') {
      // beside the eggs that stand on the ring he is about to lick (the upper arc only: the nest is below)
      let sx = 0, sy = 0, n = 0;
      for (const e of sim.aliveEggs()) { if (Math.min(sim.rings.length - 1, sim.channelOf(e)) !== A.ring) continue; const p = e.body.getPosition(); sx += p.x; sy += p.y; n++; }
      const cur = Math.atan2(S.hy, S.hx);
      let th = n ? Math.atan2(sy, sx) : cur;
      if (th < -90 * DEG) th += TAU;
      S.goal = { th: clamp(th, 38 * DEG, 142 * DEG), face: 0, touch: 1 };
    } else S.goal = { th: Math.atan2(S.hy, S.hx), face: 0, touch: 0, stay: 1 }; // icicles: the tail does it, right where he is
  } else if (!A) {
    S.atk = null;
    if (B.t < 1.3) S.goal = { th: 90 * DEG, face: 0, touch: 0, hurry: 1 }; // the next attack is about due: back to the top, ready for either side
    else { const n = Math.floor(sim.t / 5.5); S.goal = { th: (90 + (hash(n * 3.7 + 1) - 0.5) * 96) * DEG, face: 0, touch: 0 }; }
  }
  return S.goal;
}

function step(sim, B, dt, t) {
  const A = B.atk, R = S.R, st = sim.state;
  const warn = A && A.ph === 'warn', act = A && A.ph === 'act', u = warn ? clamp(1 - A.t / A.dur, 0, 1) : act ? 1 : 0;
  const W = {}; for (const c of CH) W[c] = 0;
  let speed = 0, look = { x: 0.45, y: 0 }, aim = 0, flick = 0;
  const flinch = B.flinch > 0, dizzy = B.dizzy > 0;
  if (flinch && !S.wasFl) S.hurtT = t;
  if (dizzy && !S.wasDz) S.hurtT = t;
  S.wasFl = flinch; S.wasDz = dizzy;
  const hu = (t - S.hurtT) / 0.55; // the hurt take: a hop off the ring, eyes wide, jaw dropped
  const G = goalOf(sim, B, A);
  const a = Math.atan2(S.hy, S.hx), rad = Math.hypot(S.hx, S.hy);
  let d = G ? wrap(G.th - a) : 0;
  if (st !== 'play') { // the level is over: lost = he gloats (won: he slips off, see slide())
    W.rear = 0.35; W.tongue = 1; W.mouth = 0.7; W.angry = 0.4;
  } else if (hu >= 0 && hu < 1) {
    W.shake = 1; W.mouth = 0.9; W.splay = 1; W.crouch = 0.4; look = { x: -0.2, y: 0 };
  } else if (dizzy) {
    W.dazed = 1; W.splay = 1; W.tongue = 0.6;
  } else if (G) {
    const arc = Math.abs(d) * R;
    let want = 0; // which way to head: along the ring to the goal, then round to face the way the attack goes
    if (!G.stay && arc > 0.1) want = Math.sign(d);
    else if (G.face && Math.cos(S.hd - (a + G.face * Math.PI / 2)) < 0.8) want = G.face;
    const touching = G.touch && arc <= 0.1 && A;
    if (want) {
      const left = warn ? Math.max(0.12, A.t - A.dur * 0.55) : 0.5;
      speed = warn || G.hurry ? clamp(arc / left, 2.4, 15) : 1.5; // the telegraph: he scuttles
      if (arc <= 0.1) speed = 1.6; else speed = Math.min(speed, arc * 7 + 0.5);
      const la = Math.min(arc <= 0.1 ? 0.5 : arc, 0.55) / R, pa = a + want * la, px = R * Math.cos(pa), py = R * Math.sin(pa);
      steer(Math.atan2(py - S.hy, px - S.hx), a, speed, dt);
    } else if (touching) {
      // deep freeze: he turns in and plants his snout and both front pads on the ring
      const rt = sim.outerR + 0.02, side = Math.cos(S.hd - (a + Math.PI / 2)) >= 0 ? 1 : -1, pa = a + side * 0.16 / R;
      const px = rt * Math.cos(pa), py = rt * Math.sin(pa), dist = Math.hypot(px - S.hx, py - S.hy);
      if (rad > rt + 0.035 && dist > 0.03) { speed = clamp(dist * 9, 0.5, 2.2); steer(Math.atan2(py - S.hy, px - S.hx), a, speed, dt, 0.11); }
      else S.touch = Math.min(1, S.touch + dt * 5);
    }
    if (A && A.name === 'gale') {
      const ready = !want;
      if (warn) { W.crouch = ready ? 0.5 * Math.sin(Math.PI * clamp(u / 0.5, 0, 1)) : 0; W.rear = ready ? 0.75 * sstep((u - 0.3) / 0.4) : 0; W.swell = ready ? sstep((u - 0.35) / 0.4) : 0; W.mouth = 0.15 * W.swell; W.angry = 0.7; }
      else { W.rear = 0.7; W.mouth = 1; W.swell = 0.35 + 0.3 * Math.sin(t * 17); W.angry = 1; W.shake = 0.35; }
      look = { x: 1, y: 0 };
    } else if (A && A.name === 'freeze') {
      W.frost = S.touch; W.angry = 0.5;
      if (S.touch > 0.3 || act) { const sl = Math.abs(Math.sin(t * 9.5)); W.crouch = 0.75 * sl; W.tongue = 1; W.mouth = 0.55; S.crack = Math.min(1, S.crack + dt / 0.45); } // slap, slap, lick
      look = { x: 1, y: 0 };
    } else if (A && A.name === 'icicles') {
      // the icicle tail: it coils in, then whips up and out, and the icicles fly off it
      flick = warn ? (u < 0.28 ? -0.3 * sstep(u / 0.28) : u < 0.5 ? lerp(-0.3, 1, sstep((u - 0.28) / 0.14)) : 1 - 0.75 * sstep((u - 0.55) / 0.45) + 0.12 * Math.sin((u - 0.5) * 40) * (1 - u)) : 0.25 * clamp(A.t / A.dur, 0, 1);
      W.angry = 0.8; W.crouch = warn && u < 0.3 ? 0.6 : 0; W.mouth = warn && u > 0.3 ? 0.4 : 0;
      aim = 0.5 * Math.sign(Math.cos(S.hd - (a + Math.PI / 2)) || 1) * (warn ? sstep(u / 0.3) : 0.4); // he looks back over his shoulder into the vault
      look = { x: 0.3, y: 0 };
    }
  }
  if (!(A && A.name === 'freeze')) S.touch = Math.max(0, S.touch - dt * 4);
  W.walk = speed > 0.05 ? 1 : 0;
  W.flee = speed > 4 ? 1 : 0;
  S.v = speed;
  const rate = { walk: 9, rear: 9, crouch: 16, mouth: 14, swell: 9, dazed: 6, angry: 8, shake: 30, flee: 6, splay: 8, tongue: 12, frost: 5 };
  for (const c of CH) S.B[c] += (W[c] - S.B[c]) * (1 - Math.exp(-dt * rate[c]));
  S.hop = hu >= 0 && hu < 1 ? 0.3 * Math.sin(Math.PI * Math.min(1, hu * 1.6)) * (hu < 0.625 ? 1 : 0) : 0;
  S.flick += (flick - S.flick) * (1 - Math.exp(-dt * 26));
  S.aim += (aim - S.aim) * (1 - Math.exp(-dt * 8));
  S.look.x += (look.x - S.look.x) * Math.min(1, dt * 7); S.look.y += (look.y - S.look.y) * Math.min(1, dt * 7);
  S.wide = hu >= 0 && hu < 1;
}
// turn the snout toward a heading (no tighter than his own turning circle; a U-turn swings out, away from the ring) and walk
function steer(want, a, speed, dt, tr = TURN_R) {
  let e = wrap(want - S.hd);
  if (Math.abs(e) > 1.9 && Math.cos(S.hd - a) < 0.25) { const o = wrap(a - S.hd); e = Math.abs(e) * (o >= 0 ? 1 : -1); }
  const mx = (speed / tr) * dt;
  S.hd += clamp(e, -mx, mx);
  const ds = speed * dt;
  S.hx += Math.cos(S.hd) * ds; S.hy += Math.sin(S.hd) * ds; S.odo += ds;
  const T = S.tr, h = T[0];
  if (!h || Math.hypot(h.x - S.hx, h.y - S.hy) > 0.04) { T.unshift({ x: S.hx, y: S.hy }); if (T.length > 90) T.length = 90; }
}

// beaten (the level is won): his pads let go, he scrabbles, slides round the ring on his belly, drops and skids away
function slide(sim, dt, t) {
  let L = S.sl;
  if (!L) {
    const c = bodyAt(HIP * 0.7), ph = Math.atan2(c.y, c.x), dirn = Math.abs(Math.cos(ph)) > 0.08 ? (Math.cos(ph) > 0 ? -1 : 1) : (Math.cos(S.hd) > 0 ? -1 : 1);
    L = S.sl = { t0: t, c, ph, r: Math.hypot(c.x, c.y), da: 0, om: 0, dirn, mode: 'ring', ox: 0, oy: 0, vx: 0, vy: 0, rot: 0, vr: 0 };
    S.hurtT = t;
  }
  const el = t - L.t0, gY = sim.groundY + 0.22;
  if (L.mode === 'ring') {
    if (el > 0.5) { const ph = L.ph + L.da; L.om += (-(16 / L.r) * Math.cos(ph) + L.dirn * 3.2) * dt; L.om *= 1 - 0.25 * dt; L.da += L.om * dt; }
    S.odo += 9 * dt * Math.max(0, 1 - el / 1.6); // the scrabble: feet going, body not
    const ph = L.ph + L.da;
    if (Math.sin(ph) < -0.12 || el > 6) { L.mode = 'air'; const v = L.om * L.r; L.vx = -Math.sin(ph) * v + L.dirn * -1.2; L.vy = Math.cos(ph) * v; L.vr = L.om; }
  } else {
    const ph = L.ph + L.da, cy = L.r * Math.sin(ph) + L.oy;
    if (L.mode === 'air') {
      L.vy -= 14 * dt; L.ox += L.vx * dt; L.oy += L.vy * dt; L.rot += L.vr * dt;
      if (cy <= gY) { L.mode = 'ground'; L.oy += gY - cy; L.vy = 0; L.vx = L.dirn * 7.5; L.land = t; } // he skids right across the yard, past the nest
    } else { L.ox += L.vx * dt; L.vx *= 1 - 0.1 * dt; const h = wrap(S.hd + L.da + L.rot), tg = Math.abs(h) < Math.PI / 2 ? 0 : Math.PI * Math.sign(h); L.rot += wrap(tg - h) * Math.min(1, dt * 7); } // flat on his belly
  }
  for (const c of CH) S.B[c] += ((c === 'dazed' || c === 'splay' ? (el > 0.35 ? 1 : 0) : c === 'walk' ? (L.mode === 'ring' && el < 1.6 ? 1 : 0) : c === 'mouth' ? 0.8 : c === 'shake' ? (el < 0.5 ? 1 : 0) : 0) - S.B[c]) * (1 - Math.exp(-dt * 9));
  S.hop = 0; S.flick += (0 - S.flick) * Math.min(1, dt * 8); S.wide = el < 0.5; S.touch = 0; S.crack = 0;
}
// the rigid move of the whole drawn gecko while he slides (world space)
function slideXf(ctx) {
  const L = S.sl; if (!L) return;
  const ph = L.ph + L.da, cx = L.r * Math.cos(ph), cy = L.r * Math.sin(ph);
  ctx.translate(L.ox + cx, L.oy + cy); ctx.rotate(L.rot); ctx.translate(-cx, -cy); ctx.rotate(L.da);
}
function slidePt(p) {
  const L = S.sl; if (!L) return p;
  const ph = L.ph + L.da, cx = L.r * Math.cos(ph), cy = L.r * Math.sin(ph);
  let x = p.x * Math.cos(L.da) - p.y * Math.sin(L.da) - cx, y = p.x * Math.sin(L.da) + p.y * Math.cos(L.da) - cy;
  return { x: x * Math.cos(L.rot) - y * Math.sin(L.rot) + cx + L.ox, y: x * Math.sin(L.rot) + y * Math.cos(L.rot) + cy + L.oy };
}

function ensure(sim, t) {
  if (!isGecko15(sim)) return null;
  if (!S || S.sim !== sim || t < S.t - 0.5) fresh(sim, t);
  return S;
}
// his body centre in the world, where he is drawn now (popups, hit sparks and Chick Strikes land here)
export function geckoAnchor(sim) {
  if (!isGecko15(sim) || !S || S.sim !== sim) return null;
  return slidePt(bodyAt(HIP * 0.55));
}
// the camera's fixed room for him (no zoom pumping as he walks): the upper arc outside the outer ring
export function geckoFrame(sim) { return { x: 0, y: sim.outerR - 0.5, h: 1.7, pad: 1.1 }; } // h < 2: main keeps him in frame even when the camera would close in on the eggs
// the deep freeze: where his snout touches the ring, and how far the frost has run from it (0..1)
export function geckoFreeze(sim) {
  if (!isGecko15(sim) || !S || S.sim !== sim) return null;
  return { x: S.hx, y: S.hy, u: S.crack };
}
// a strike event or effect aimed at the boss's sim point, moved onto him
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

// ctx: world space (meters, y up). k: pixels per meter. Called from drawBossActor every frame.
export function drawGecko15(ctx, sim, k, t, calm) {
  const B = sim.bx.boss;
  ensure(sim, t);
  const dt = clamp(t - S.t, 0, 0.05);
  S.t = t; S.k = k;
  const fxb = sim.p2 && sim.p2.fx && sim.p2.fx.b, iced = (B.stk > 0 || B.dizzy > 0) && ((fxb && fxb.k === 'ice') || statusKind('b') === 'ice');
  const st = statusClock(sim, 'b', iced ? { k: 'ice', left: Math.max(B.stk || 0, B.dizzy) } : B.dizzy > 0 && fxb && fxb.k === 'zap' ? { k: 'stun', zap: true, left: B.dizzy } : null, t);
  const frozen = !!(st && st.k === 'ice');
  const won = sim.state === 'won' || sim.state === 'winning';
  if (won) slide(sim, dt, t);
  else if (!frozen) { S.sl = null; step(sim, B, dt, t); }
  const A = B.atk;
  if (S.sl && S.sl.mode === 'ground' && Math.abs(S.sl.r * Math.cos(S.sl.ph + S.sl.da) + S.sl.ox) > sim.outerR + 5 && (S.sl.r * Math.cos(S.sl.ph + S.sl.da) + S.sl.ox) * S.sl.dirn > 0) return; // gone
  ctx.save();
  slideXf(ctx);
  if (A && A.name === 'gale' && !won) drawBreath(ctx, A, t, calm);
  const s = SVL * k, sn = bodyAt(0), o = {
    pose: 'idle', blend: { ...S.B }, gait: S.odo * k, id: 15, heading: -S.hd, aim: -S.aim, look: S.wide ? { x: 0.1, y: 0 } : S.look, noShadow: frozen ? 1 : 0,
    trail: (d) => { const q = bodyAt(d / k); return { x: q.x * k, y: -q.y * k }; }, status: st,
  };
  if (S.wide) o.blink = 0;
  ctx.scale(1 / k, -1 / k);
  drawCrawler(ctx, sn.x * k, -sn.y * k, s, frozen ? st.hold : t, o, 'gecko');
  ctx.scale(k, -k);
  if (A && A.name === 'icicles' && !won) drawFlick(ctx, sim, A, t);
  // landing on the snow: a puff where he hits the ground
  const L = S.sl;
  if (L && L.land && t - L.land < 0.5) {
    const f = (t - L.land) / 0.5, c = bodyAt(HIP * 0.7);
    ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - f)})`;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(c.x + (i - 2) * 0.3 * (1 + f), c.y - 0.1 + 0.25 * f * hash(i + 2), 0.12 + 0.2 * f, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
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
