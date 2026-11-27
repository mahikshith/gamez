// Bandit the raccoon IN PLAY (0.8.17, L6; 0.8.18: on the rings): his own art (render/raccoon.js) driven by the sim
// (sim/bandit.js). On the yard (coming in, the crouch, the catch, beaten in his sack) he is drawn whole before the rings;
// on a ring he sits on its floor (drawBanditPerch, inner face) in two layers: his tail behind the rings, the rest of him
// (and the faint arrow of his crank) after the rings and the eggs.
//   drawBandit(ctx, sim, t, k, calm, layer)  world space (y up, metres), k = px per metre; layer 'back' | 'front'
//   bandHides(sim, egg)                      the eggs he draws himself (in his sack, hugged after a grab)
//   banditEvent(ev, fx, U)                   sounds and a few short popups (U: { popup, audio, hitStop, calm })
//   drawBanditPerch                          him on a ring (also the level card's actor, howact.js)
//   drawBanditEmblem / drawBanditCard        the boss bar chip and the intro portrait
// Calm (save.calm): no shake, no pulsing; poses are not blended.
import { RACCOON_M, raccoonPose, raccoonBlend, raccoonHold, drawRaccoon, CRANK_PULL } from './raccoon.js';
import { drawEgg } from './world.js';
import { RING_TH } from '../sim/geom.js';
import { PERF } from '../perf.js'; // 0.8.18 the stand-off's cloud
import { DUEL } from '../sim/bandit.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
const INK = '#221622';

// the art's own px point of a torso-frame point (raccoon.js toPx), at feet (0, 0)
function toPx(p, lx, ly, u, face) {
  const sx = 1 + p.sq * 0.7, sy = 1 - p.sq, cr = Math.cos(p.rot), sr = Math.sin(p.rot);
  return { x: (p.dx + lx * cr - ly * sr) * sx * u * face, y: (-p.by + lx * sr + ly * cr) * sy * u };
}
const FZ = { on: false, t: 0 };
// 0.8.18 (owner: "the raccoon is too small for starters"): in play he is drawn this much bigger than the sim's 1.22 m
// thief, so that perched on a ring he is about 1.7 channels tall (a channel is 0.89 m; he sits about 85 rig units high)
export const BANDIT_SCALE = 1.7;
const PLAY_M = RACCOON_M * BANDIT_SCALE; // metres per 100 rig units in play
// 0.8.18 (owner: "on the floor it is so small, but on the rings it looks so big"): ONE size everywhere. On the yard he is
// drawn at BANDIT_SCALE too, in FRONT of the rings (a foreground character: his head may cross the vault's lower rim)
// instead of being shrunk to fit under it.
export function banditYardScale() { return BANDIT_SCALE; }
// ---------- in play (0.8.18): on the yard while he comes in, ON a ring's floor while he works it
const D2R = Math.PI / 180;
const YARD_PH = new Set(['idle', 'sneak', 'crouch', 'dash', 'stuff', 'laugh', 'scared', 'stun', 'defeated']);
// his yard pose this frame: [state, u, extra pose fields, draw options]
function lookYard(sim, B) {
  const P = () => clamp(1 - B.t / Math.max(1e-3, B.dur), 0, 1), o = { eye: 'normal' }, add = {};
  let st = 'idle', u = 0;
  switch (B.ph) {
    case 'sneak': st = 'sneak'; u = 0.001 + B.odo / 0.36; break;
    case 'dash': st = 'sneak'; u = 0.001 + B.odo / 0.5; o.eye = 'lock'; break;
    case 'scared': st = Math.abs(sim.bandGeo().x0 - B.x) > 0.03 ? 'sneak' : 'idle'; u = 0.001 + B.odo / 0.4; o.eye = 'wide'; add.sweat = 1; add.ear = 0.8; break;
    case 'crouch': { // he looks up at the ring, eyes lock, then sinks into a crouch: the telegraph before the leap
      const q = P(), dn = ss(0.45, 1, q);
      st = 'peek'; u = 0.3 * ss(0, 0.4, q); o.eye = 'lock';
      Object.assign(add, { looky: -0.9, look: 0.7, hr: -0.3 * ss(0, 0.3, q), by: 34 - 9 * dn, sq: 0.15 * dn, ear: -0.4, tail: 0.5 + 0.6 * dn, tongue: 0 });
      break;
    }
    case 'stuff': st = 'grab'; u = 0.55 * P(); break;
    case 'laugh': st = 'laugh'; break;
    case 'stun': st = 'dizzy'; u = 0; break;
    case 'defeated': st = 'defeated'; u = clamp((sim.t - (B.t0 ?? sim.t)) / 2, 0, 1); break;
  }
  if (B.end === 'win' && B.ph !== 'defeated') { st = 'idle'; add.brow = -0.8; add.smile = -0.6; add.ear = 0.6; } // he sulks
  if (B.end === 'lose' && B.ph !== 'defeated') st = 'laugh';
  return { st, u, o, add };
}
// on a ring: [state, u, pose overrides, options]
function lookPerch(sim, B, t) {
  const P = clamp(1 - B.t / Math.max(1e-3, B.dur), 0, 1), add = {}, o = { eye: 'normal' };
  let st = 'sit', u = 0;
  switch (B.ph) {
    case 'spit': Object.assign(add, spitPose(P, t)); o.eye = P > 0.55 ? 'lock' : 'normal'; break;
    case 'crank': st = 'crank'; u = 0.001 + (B.cr * 100) / (PLAY_M * CRANK_PULL); break;
    case 'reach': st = 'reach'; u = 0.82 * P; o.eye = 'lock'; o.toW = { x: B.px, y: B.py }; break;
    case 'strain': st = 'reach'; u = 0.86 + 0.04 * Math.sin(t * 20); o.toW = { x: B.px, y: B.py }; Object.assign(add, { sweat: 1, brow: -0.6, jaw: 0.4, teeth: 1, tongue: 0 }); break;
    case 'grab': st = 'grab'; u = P; o.toW = { x: B.px, y: B.py }; o.hug = true; break;
    case 'shaken': st = 'shaken'; u = B.hurt ? 1 : 0.45; o.eye = B.hurt ? 'squeeze' : 'wide'; break;
    case 'whistle': st = 'whistle'; u = P; break;
    case 'perchStun': Object.assign(add, { spiral: 1, stars: 3, lid: 0, jaw: 0.35, tongue: 1, ta: 1.3, smile: -0.3 }); break;
    case 'cower': Object.assign(add, { ear: 1, sweat: 1, brow: -0.8, pup: 0.6, smile: -0.5, by: 21 }); o.eye = 'wide'; break;
    // 0.8.18 the stand-off: he sees it coming, FREEZES (ears up, eyes wide), a beat, the eyes NARROW, they CIRCLE (a slow
    // sway, chin down, a paw flexing), then the dust cloud (drawDuel); after it he DUSTS his paws (won) or stares at the rip
    case 'duel': {
      const D = B.duel || {}, q = D.ph === 'come' ? 0 : D.t; // (s since the freeze)
      if (D.ph === 'come') { o.eye = 'lock'; Object.assign(add, { brow: 0.4, smile: 0.2 }); }
      else if (D.ph === 'freeze') { o.eye = 'wide'; Object.assign(add, { ear: -0.4, pup: 0.55, jaw: 0.2 * ss(0, 0.15, q), smile: -0.2, by: 23 + 2 * ss(0, 0.1, q) }); }
      else if (D.ph === 'stare' || D.ph === 'circle') {
        const sw = D.ph === 'circle' ? Math.sin(t * 3.2) : 0, n = ss(0, 0.5, q - DUEL.freeze);
        o.eye = n > 0.5 ? 'lock' : 'normal';
        Object.assign(add, { brow: lerp(0.2, -1, n), lid: lerp(0.1, 0.5, n), lidLo: 0.25 * n, smile: lerp(0, -0.35, n), ear: -0.3 * n, rot: 0.08 * sw, hr: 0.1 * sw, a1x: 25 + 3 * sw, a1y: -19 + 4 * Math.abs(sw), tw: sw * 0.8, tail: 0.6 + 0.3 * n });
      }
      break;
    }
    case 'dust': { const r = spitPose(0.62 + 0.38 * ss(0, 0.7, P), t); Object.assign(add, r, { happy: P > 0.15 && P < 0.7 ? 1 : 0, smile: 1, brow: -0.3, lid: 0.35, look: -0.5, hr: -0.15 }); break; } // brushing one paw off with the other, smug
    case 'huh': o.eye = 'wide'; Object.assign(add, { hr: 0.25, jaw: 0.35, smile: -0.3, brow: 0.9, ear: 0.6, look: -0.8, looky: 0.9, pup: 0.7 }); break; // he stares down at the ripped sack
  }
  if (B.end === 'win') { st = 'sit'; Object.assign(add, { brow: -0.8, smile: -0.6, ear: 0.6, lid: 0.4 }); }
  if (B.end === 'lose') { st = 'sit'; Object.assign(add, { happy: 1, jaw: 0.7, teeth: 1, smile: 1 }); }
  return { st, u, add, o };
}
// the telegraph before a crank: both paws to his mouth, a "ptoo" into them, then rubbing them together, eyes on the ring
function spitPose(q, t) {
  const up = ss(0, 0.25, q) * (1 - ss(0.5, 0.62, q)), pt = ss(0.3, 0.38, q) * (1 - ss(0.44, 0.55, q)), rub = ss(0.55, 0.65, q), w = Math.sin(t * 22) * rub;
  return {
    a0x: lerp(14, 11, up) + 3 * w, a0y: lerp(-20, -16, up) + lerp(0, 8, rub) - 1.5 * w, a1x: lerp(25, 19, up) - 3 * w, a1y: lerp(-19, -16, up) + lerp(0, 8, rub) + 1.5 * w,
    pucker: up * (1 - pt), cheek: 0.6 * up, jaw: 0.5 * pt, g0: 0.3, g1: 0.3, brow: 0.5 + 0.45 * rub, look: 0.9, looky: 0.6 * rub, smile: 0.3 + 0.4 * rub, hr: -0.1 * up + 0.12 * rub, lid: 0.15 + 0.15 * rub,
  };
}
const lerp = (a, b, k) => a + (b - a) * k;
// the faint arrow along his ring the way he will turn it (the crank's telegraph), sliding his way while he cranks
function crankArrow(ctx, sim, B, t, k, calm) {
  const ring = sim.rings[B.ri], P = clamp(1 - B.t / Math.max(1e-3, B.dur), 0, 1), al = B.ph === 'spit' ? ss(0.1, 0.6, P) : 1;
  if (!ring || al <= 0) return;
  const r = ring.r, a0 = B.pa - B.side * 6 * D2R, a1 = B.pa - B.side * 62 * D2R, lo = Math.min(a0, a1), hi = Math.max(a0, a1), head = B.dir > 0 ? hi : lo;
  const pulse = calm ? 0.8 : 0.65 + 0.35 * Math.sin(t * 5);
  ctx.save(); ctx.lineCap = 'round';
  ctx.globalAlpha *= 0.55 * al * pulse;
  ctx.strokeStyle = '#ffdc7a'; ctx.lineWidth = RING_TH * 0.42;
  const dash = 0.34, gap = 0.22, off = calm ? 0 : (((t * 0.9 * B.dir) % (dash + gap)) + (dash + gap)) % (dash + gap);
  ctx.setLineDash([dash, gap]); ctx.lineDashOffset = (B.dir > 0 ? -1 : 1) * off * 1;
  ctx.beginPath(); ctx.arc(0, 0, r, lo, hi); ctx.stroke(); ctx.setLineDash([]);
  // the head: a chevron on the ring
  const hx = r * Math.cos(head), hy = r * Math.sin(head), tx = -Math.sin(head) * B.dir, ty = Math.cos(head) * B.dir, nx = Math.cos(head), ny = Math.sin(head), L = 0.42, W = 0.3;
  ctx.fillStyle = '#ffdc7a'; ctx.beginPath(); ctx.moveTo(hx + tx * L, hy + ty * L); ctx.lineTo(hx + nx * W, hy + ny * W); ctx.lineTo(hx - nx * W, hy - ny * W); ctx.closePath(); ctx.fill();
  ctx.restore();
}
// the eggs in his sack peek out over its neck (drawn first: the sack goes over them); p is his pose, u px per rig unit
function sackEggs(ctx, B, p, u, face) {
  const n = B.sack.length;
  if (!n || B.ph === 'defeated') return;
  const sk = toPx(p, p.skx, p.sky, u, face);
  for (let i = 0; i < Math.min(4, n); i++) egg(ctx, sk.x + (i - (Math.min(4, n) - 1) / 2) * 11 * u, sk.y - 22 * u - (i % 2) * 3 * u, 17 * u, (i - 1.5) * 0.25);
}

export function bandHides(sim, e) {
  const B = sim.band;
  return !!B && (B.sack.includes(e.id) || ((B.ph === 'stuff' || B.ph === 'grab') && B.eid === e.id) || (B.ph === 'dash' && B.tgt === e.id && !e.hc));
}

// layer 'back' (before the rings): Bandit on the yard whole, or the tail of a perched Bandit that hangs behind his ring;
// layer 'front' (after the rings and the eggs): the crank arrow and the rest of him
export function drawBandit(ctx, sim, t, k, calm, layer = 'back') {
  const B = sim.band;
  if (!B) return;
  const X = sim.bx && sim.bx.boss, frozen = !!((X && X.stk > 0) || B.fz > 0 || B.held);
  if (frozen && !FZ.on) { FZ.on = true; FZ.t = t; } else if (!frozen) FZ.on = false;
  const tt = FZ.on ? FZ.t : t;
  if (YARD_PH.has(B.ph)) { if (layer === 'front') drawYard(ctx, sim, B, tt, k, calm, frozen); return; } // in front of the rim
  const P = clamp(1 - B.t / Math.max(1e-3, B.dur), 0, 1), ring = sim.rings[B.ri];
  if (!ring) return;
  const base = { face: B.face, inner: true, layer, frozen, calm, id: 'bandit', rate: 14, eye: 'normal', rip: B.rip };
  if (B.ph === 'climb') { // a leap from the yard to the outside of the rim, then the haul over it onto the floor
    const g = sim.groundY, F = B.from || { x: B.x, y: g }, thP = -Math.PI / 2 - B.pa, L = 0.34;
    if (P < L) {
      const v = P / L, e = ss(0, 1, v), rr = ring.r + RING_TH / 2 + 0.05, H = { x: rr * Math.cos(B.pa) - 0.25, y: rr * Math.sin(B.pa) - 0.9 };
      const at = { x: lerp(F.x, H.x, e), y: lerp(F.y, H.y, e) + 1.1 * Math.sin(v * Math.PI) };
      drawBanditPerch(ctx, ring.r, B.pa, tt, k, 'hop', 0.22 + 0.4 * v, { ...base, at, th: thP * ss(0.3, 1, v), opt: { h: 0 }, eye: 'lock', id: null });
      return;
    }
    drawBanditPerch(ctx, ring.r, B.pa, tt, k, 'climb', 0.04 + 0.96 * ss(0, 1, (P - L) / (1 - L)), { ...base, id: null });
    return;
  }
  if (B.ph === 'hop') { // the hop to his next perch: up, over the vault's floor, down onto the other ring
    const F = B.from || { ri: B.ri, pa: B.pa }, r0 = sim.bandFloor(F.ri), r1 = sim.bandFloor(B.ri), e = ss(0.18, 0.78, P);
    const A = { x: r0 * Math.cos(F.pa), y: r0 * Math.sin(F.pa) }, C = { x: r1 * Math.cos(B.pa), y: r1 * Math.sin(B.pa) };
    const th0 = -Math.PI / 2 - F.pa, th1 = -Math.PI / 2 - B.pa, at = { x: lerp(A.x, C.x, e), y: lerp(A.y, C.y, e) + 1.4 * Math.sin(e * Math.PI) };
    const flip = P > 0.5 ? B.face : -B.face; // he turns in the air to face down his new slope
    drawBanditPerch(ctx, ring.r, B.pa, tt, k, 'hop', P, { ...base, face: flip, at, th: lerp(th0, th1, e), opt: { h: 0 }, id: null });
    return;
  }
  if (B.ph === 'fall') { // the third hurt: he loses his grip and goes over backwards, down to the yard
    const F = B.from || sim.bandPerchPt(B), g = sim.groundY, v = ss(0, 1, P), x1 = B.lx ?? F.x;
    const at = { x: lerp(F.x, x1, v), y: lerp(F.y, g + 0.25, P * P) + 1.2 * Math.sin(Math.min(1, P * 1.6) * Math.PI) * (1 - P) };
    drawBanditPerch(ctx, ring.r, B.pa, tt, k, 'fall', P, { ...base, at, th: (-Math.PI / 2 - B.pa) * (1 - v), id: null, layer: layer === 'back' ? 'back' : 'front' });
    return;
  }
  if (B.ph === 'duel' && B.duel && B.duel.ph === 'fight') { if (layer === 'front') drawDuel(ctx, sim, B, t, k, calm); return; } // 0.8.18: both inside the dust cloud
  const Lk = lookPerch(sim, B, t);
  if (layer === 'front' && B.ph === 'duel' && B.duel && B.duel.ph === 'stare' && !calm) duelLeaf(ctx, sim, B, k);
  if (layer === 'front' && (B.ph === 'spit' || B.ph === 'crank') && !sim.state.startsWith('w') && !frozen) crankArrow(ctx, sim, B, t, k, calm);
  // his eyes follow the egg nearest him on his floor while he sits
  let eyeW = null;
  if (B.ph === 'duel' || B.ph === 'huh') { const T = sim.bandWeaselT && sim.bandWeaselT(); eyeW = B.ph === 'huh' ? sim.bandSackPt(B, 0) : T ? sim.thBody(T) : null; }
  else if (Lk.st === 'sit') { let bd = 9; for (const e of sim.aliveEggs()) { if (e.hc || sim.channelOf(e) !== B.ri) continue; const p = e.body.getPosition(), q = sim.bandPerchPt(B), d = Math.hypot(p.x - q.x, p.y - q.y); if (d < bd) { bd = d; eyeW = { x: p.x, y: p.y }; } } }
  const o = { ...base, add: Lk.add, eye: frozen ? 'normal' : Lk.o.eye, toW: Lk.o.toW, eyeW, egg: false, under: (c, p, u, face) => sackEggs(c, B, p, u, face) };
  // 0.8.18 the egg he reaches for / holds is the REAL one where the sim has it: his paws close on it, and while he holds it
  // he draws it himself between his paws (bandHides keeps the game from drawing it again)
  const live = liveEgg(sim, B);
  if (live) { o.toW = live.w; o.eggW = live.w; if (B.ph === 'grab') o.eggDraw = eggDrawer(ctx, live.e, live.a, t, k); }
  if (calm) o.id = null;
  if (layer === 'back') { MEMP.p = drawBanditPerch(ctx, ring.r, B.pa, tt, k, Lk.st, Lk.u, o); MEMP.t = t; return; }
  drawBanditPerch(ctx, ring.r, B.pa, tt, k, Lk.st, Lk.u, { ...o, blended: MEMP.t === t ? MEMP.p : null });
}
const MEMP = { p: null, t: -1 };
// 0.8.18 the stand-off's scuffle: a rolling ball of dust between them (world space, metres), with a striped tail, a brown
// one, a fist, a foot and stars popping out of it in turn; calm: a still cloud. PERF.low: fewer puffs, no pop-outs.
function drawDuel(ctx, sim, B, t, k, calm) {
  const P = sim.bandDuelPt(B), q = B.duel.t - DUEL.freeze - DUEL.stare - DUEL.circle, R = 0.95 * (0.85 + 0.15 * ss(0, 0.3, q)) * (1 - 0.3 * ss(0.85, 1, q / DUEL.fight)), low = !!PERF.low, n = low ? 7 : 12;
  const tt = calm ? 0.6 : t, puff = (x, y, r, c) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill(); };
  ctx.save(); ctx.translate(P.x, P.y + (calm ? 0 : 0.05 * Math.sin(tt * 17)));
  ctx.lineWidth = 0.05; ctx.strokeStyle = '#5a4632';
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + tt * 2.3, rr = R * (0.55 + 0.12 * Math.sin(tt * 9 + i * 2.1)); ctx.beginPath(); ctx.arc(rr * Math.cos(a), rr * 0.8 * Math.sin(a), R * (0.42 + 0.06 * Math.sin(tt * 11 + i)), 0, Math.PI * 2); ctx.fillStyle = i % 2 ? '#d9c6a2' : '#c8b088'; ctx.fill(); ctx.stroke(); }
  puff(0, 0, R * 0.7, '#e3d2b0');
  if (!calm && !low) { // what pokes out, one at a time, each a quick in-out
    const slot = Math.floor(q / 0.38) % 5, u = (q % 0.38) / 0.38, out = Math.sin(u * Math.PI), a = (slot * 2.4 + 0.7) % (Math.PI * 2), ex = Math.cos(a) * R * (0.7 + 0.35 * out), ey = Math.sin(a) * R * 0.8 * (0.7 + 0.35 * out);
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
    if (slot === 0 || slot === 3) { // a tail: raccoon rings or the weasel's brown
      for (let j = 0; j < 4; j++) puff(j * 0.13, 0, 0.11, slot === 0 ? (j % 2 ? '#2a2630' : '#9a98aa') : '#a0623a');
    } else if (slot === 1) { puff(0, 0, 0.14, '#3b3548'); puff(0.1, 0.08, 0.05, '#3b3548'); puff(0.12, -0.02, 0.05, '#3b3548'); } // his fist
    else if (slot === 2) { puff(0, 0, 0.12, '#f2e6cc'); puff(0.12, 0, 0.08, '#a0623a'); } // a foot
    else { ctx.fillStyle = '#ffe14a'; for (let j = 0; j < 3; j++) { const sa = j * 2.1 + tt * 5; ctx.beginPath(); for (let m = 0; m < 10; m++) { const r2 = m % 2 ? 0.05 : 0.12, aa = sa + (m / 10) * Math.PI * 2; ctx.lineTo(0.18 * Math.cos(j * 2.1) + r2 * Math.cos(aa), 0.18 * Math.sin(j * 2.1) + r2 * Math.sin(aa)); } ctx.closePath(); ctx.fill(); } } // stars
    ctx.restore();
  }
  ctx.restore();
}
// a single leaf drifting down between them while they stare (the beat before the scuffle)
function duelLeaf(ctx, sim, B, k) {
  const P = sim.bandDuelPt(B), q = clamp((B.duel.t - DUEL.freeze) / DUEL.stare, 0, 1), x = P.x + 0.5 * Math.sin(q * 5) * (1 - q * 0.3), y = P.y + 1.1 - 1.4 * q, rot = Math.sin(q * 7) * 0.9;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha *= ss(0, 0.1, q) * (1 - ss(0.85, 1, q));
  ctx.beginPath(); ctx.moveTo(-0.14, 0); ctx.quadraticCurveTo(0, 0.1, 0.14, 0); ctx.quadraticCurveTo(0, -0.1, -0.14, 0); ctx.fillStyle = '#c9822e'; ctx.fill(); ctx.lineWidth = 0.02; ctx.strokeStyle = '#6a3a10'; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-0.14, 0); ctx.lineTo(0.12, 0); ctx.stroke();
  ctx.restore();
}
// the egg in his paws (grab, stuff) or under them (reach, strain): { e, w (its sim position), a (its drawn turn) }. A held
// egg turns from how it lay at the touch to upright in his arms (sim/bandit.js pins it at a fixed turn).
const HOLDA = { id: 0, a: 0 };
function liveEgg(sim, B) {
  const id = B.ph === 'grab' || B.ph === 'stuff' ? B.eid : B.ph === 'reach' || B.ph === 'strain' || B.ph === 'dash' ? B.tgt : 0, e = id ? sim.eggs.find((q) => q.id === id && q.alive) : null;
  if (!e || !e.body) return null;
  const P = e.body.getPosition(), w = { x: P.x, y: P.y };
  if (!e.hc) { HOLDA.id = e.id; HOLDA.a = e.body.getAngle(); return { e, w, a: HOLDA.a }; }
  const up = B.ph === 'grab' ? B.pa + Math.PI / 2 : 0, a0 = HOLDA.id === e.id ? HOLDA.a : up, q = ss(0, 0.35, clamp(1 - B.t / Math.max(1e-3, B.dur), 0, 1));
  return { e, w, a: a0 + Math.atan2(Math.sin(up - a0), Math.cos(up - a0)) * q };
}
// draws the real egg (render/world.js drawEgg) in world space from inside his rig, turned to a, without its floor shadow
function eggDrawer(ctx, e, a, t, k) {
  const M = ctx.getTransform(), body = Object.create(e.body);
  body.getAngle = () => a; body.getLinearVelocity = () => ({ x: 0, y: 9 }); // (a fast egg casts no contact shadow)
  const egg = Object.create(e); egg.body = body;
  return (c) => { c.save(); c.setTransform(M); try { drawEgg(c, egg, t, k); } finally { c.restore(); } };
}
function drawYard(ctx, sim, B, t, k, calm, ice) {
  const gY = sim.groundY, s = PLAY_M * k, u = s / 100, L = lookYard(sim, B), live = B.ph === 'stuff' || B.ph === 'dash' ? liveEgg(sim, B) : null;
  const opt = { noHold: true };
  if (B.ph === 'stuff') opt.stuff = clamp(1 - B.t / Math.max(1e-3, B.dur), 0, 1);
  let p = raccoonPose(L.st, t, L.u, opt);
  Object.assign(p, L.add);
  const W0 = { hw0: p.hw0, hw1: p.hw1, hq0: p.hq0 }; // the hold's weights as posed (not trailing behind a blend)
  p = { ...(calm ? p : raccoonBlend('banditY', p, t, 12)), ...W0 };
  const eggDraw = live ? eggDrawer(ctx, live.e, live.a, t, k) : null;
  if (live && B.ph === 'stuff') raccoonHold(p, { x: ((live.w.x - B.x) * 100 * B.face) / PLAY_M, y: (-(live.w.y - gY) * 100) / PLAY_M, a: 0 });
  else p.hw0 = p.hw1 = 0;
  ctx.save(); ctx.translate(B.x, gY); ctx.scale(1 / k, -1 / k);
  try {
    sackEggs(ctx, B, p, u, B.face);
    drawRaccoon(ctx, 0, 0, s, t, p, { rip: B.rip, face: B.face, frozen: ice ? 1 : 0, eye: L.o.eye, egg: false, eggDraw: B.ph === 'stuff' ? eggDraw : null });
    if (B.ph === 'dash' && eggDraw) eggDraw(ctx); // the egg he runs under falls in front of him (bandHides)
    if (B.ph === 'crouch' && B.t / B.dur < 0.8) bubble(ctx, toPx(p, p.hx + 30, p.hy - 58, u, B.face), 13 * u * 1.7, '!'); // (0.8.18: the same size on screen as at his old yard scale)
  } finally { ctx.restore(); }
}
// ---------- 0.8.18: Bandit ON a ring (art for the new behaviour: climb, hop, sit, crank, reach, grab, shaken, fall)
// World space (y up, metres, the vault's centre at 0, 0), k px per metre. He perches on the outer face of a ring of
// radius r (to its centre line) at world angle a, drawn at BANDIT_SCALE. Draw o.layer 'back' BEFORE the rings (his tail
// hangs behind them) and 'front' AFTER them (body, paws wrapped over the rim, sack). st / u / opt as raccoonPose (the perch
// states); o: { face (1: he faces clockwise on screen, -1 the other way), layer, eye, frozen, calm, id (blend memory),
// add (pose overrides), out (as drawRaccoon), at ({ x, y } world: his perch point when he has left the rim: a hop
// between spots, the fall) }. opt.to / opt.eye given in WORLD metres are turned into his rig here
// (o.toW, o.eyeW: { x, y }).
export function drawBanditPerch(ctx, r, a, t, k, st, u, o = {}) {
  // 0.8.18 o.inner: he sits on the ring's INNER face (its floor, low in the vault), his up toward the vault's centre;
  // o.th: the frame's turn instead of the perch's (a leap, a hop, the fall); o.sc: a size factor; o.under(ctx, pose, u,
  // face): drawn in his frame before him (the eggs in his sack)
  const face = o.face < 0 ? -1 : 1, s = PLAY_M * (o.sc || 1) * k, inner = !!o.inner, ro = inner ? r - RING_TH / 2 : r + RING_TH / 2, aN = inner ? a + Math.PI : a;
  const px = o.at ? o.at.x : ro * Math.cos(a), py = o.at ? o.at.y : ro * Math.sin(a), th = o.th ?? Math.PI / 2 - aN;
  const rig = (W) => { const dx = (W.x - px) * k, dy = -(W.y - py) * k, c = Math.cos(-th), sn = Math.sin(-th); return [((dx * c - dy * sn) * face * 100) / s, ((dx * sn + dy * c) * 100) / s]; };
  const opt = { perch: true, R: inner ? -1 : (ro * 100) / (PLAY_M * (o.sc || 1)), tilt: Math.atan2(Math.sin(th), Math.cos(th)) * face, noHold: true, ...(o.opt || {}) };
  if (o.toW) opt.to = rig(o.toW);
  if (o.eyeW) opt.eye = rig(o.eyeW);
  let p = raccoonPose(st, t, u, opt);
  if (o.add) Object.assign(p, o.add);
  if (!o.calm && o.id) p = o.layer === 'front' && o.blended ? o.blended : { ...raccoonBlend(o.id, p, t, o.rate || 14), hw0: p.hw0, hw1: p.hw1, hq0: p.hq0 }; // (the hold's weights as posed)
  // 0.8.18 his paws on the egg, after the blend (a blended paw would trail a moving egg): the real egg (o.eggW, world) or
  // the pose's own
  if ((p.hw0 > 0 || p.hw1 > 0) && !(o.layer === 'front' && o.blended)) { const EW = o.eggW || (st === 'reach' || st === 'perchReach' ? o.toW : null); if (EW) { const E = rig(EW); raccoonHold(p, { x: E[0], y: E[1], a: 0 }); } else raccoonHold(p); }
  ctx.save(); ctx.translate(px, py); ctx.scale(1 / k, -1 / k); ctx.rotate(th);
  try {
    if (o.under && o.layer !== 'back') o.under(ctx, p, s / 100, face);
    drawRaccoon(ctx, 0, 0, s, t, p, { face, frozen: o.frozen ? 1 : 0, eye: o.eye || 'normal', egg: o.egg, layer: o.layer, out: o.out, eggDraw: o.eggDraw, rip: o.rip });
  } finally { ctx.restore(); }
  return p; // pass it back as o.blended for the second layer, so both layers show the same pose
}
function egg(ctx, x, y, h, rot) {
  const w = h * 0.76;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath(); for (let i = 0; i <= 24; i++) { const a = (i / 24) * TAU, s2 = Math.sin(a); ctx.lineTo((w / 2) * Math.cos(a) * (1 + 0.13 * s2), (h / 2) * s2); }
  ctx.closePath(); ctx.fillStyle = '#fff1d6'; ctx.fill(); ctx.lineWidth = Math.max(1, h * 0.08); ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(-w * 0.16, -h * 0.18, w * 0.1, h * 0.14, 0.4, 0, TAU); ctx.fill();
  ctx.restore();
}
function bubble(ctx, P, r, ch) {
  ctx.save();
  ctx.beginPath(); ctx.arc(P.x, P.y, r, 0, TAU); ctx.fillStyle = '#fffbe8'; ctx.fill(); ctx.lineWidth = Math.max(1.5, r * 0.14); ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = ch === '!' ? '#d23a2a' : '#3a2a5a'; ctx.font = `900 ${Math.round(r * 1.45)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(ch, P.x, P.y + r * 0.08);
  ctx.restore();
}

// ---------- events: sounds (the game's own) and a few short popups; no text tips (0.8.18: one idea on screen, shown not told)
export function banditEvent(ev, fx, U) {
  const { popup, audio } = U, calm = !!U.calm;
  switch (ev.type) {
    case 'bandCrouch': audio.play('weasel_sniff', { vol: 0.55, pitch: 0.75 }); break;
    case 'bandClimb': audio.play('hen_hop', { vol: 0.6, pitch: 0.7 }); break;
    case 'bandHop': audio.play('hen_hop', { vol: 0.6, pitch: 0.8 }); break;
    case 'bandPerch': audio.play('hen_land', { vol: 0.55, pitch: 0.75 }); break;
    case 'bandSpit': audio.play('squish', { vol: 0.35, pitch: 1.7 }); break;
    case 'bandCrank': audio.play('gear_whir', { vol: 0.4, pitch: 0.6 }); break;
    case 'bandReach': audio.play('tongue_lick', { vol: 0.45, pitch: 0.8 }); break;
    case 'bandGrab': audio.play('grab', { vol: 0.75, pitch: 0.8 }); if (ev.golden) fx.sparkle(ev.x, ev.y, 10, '#ffd63c'); break;
    case 'bandCatch': audio.play('grab', { vol: 0.75, pitch: 0.9 }); break;
    case 'bandStuff': audio.play('squish', { vol: 0.5, pitch: 0.7 }); audio.play('weasel_snicker', { vol: 0.45, pitch: 0.8 }); break;
    case 'bandMiss': audio.play('egg_bump', { vol: 0.3, pitch: 0.7 }); break;
    case 'bandStrain': audio.play('squish', { vol: 0.5, pitch: 0.5 }); break;
    case 'bandHeavy': audio.play('rock_hit', { vol: 0.6, pitch: 0.8 }); break;
    case 'bandDash': audio.play('egg_bump', { vol: 0.35, pitch: 1.9 }); break;
    case 'bandShake': // the counter: his ring turned against him
      audio.play('ring_tick', { vol: 0.8, pitch: 0.6 }); audio.play('egg_bump', { vol: 0.5, pitch: 0.6 });
      if (!ev.hurt) popup(ev.x, ev.y + 0.5, '!?', { color: '#ffe680', size: 20, life: 0.7 });
      break;
    case 'bandHurt': {
      audio.play('thorn_snap', { vol: 0.8, pitch: 0.9 }); audio.play('weasel_yelp', { vol: 0.8, pitch: 0.7 });
      fx.sparkle(ev.x, ev.y, 14, '#ffe08a');
      if (!calm) { fx.shake = Math.max(fx.shake || 0, 0.22); if (U.hitStop) U.hitStop(0.06); }
      popup(ev.x, ev.y + 0.5, ev.why === 'hot' ? 'HOT!' : ev.why === 'zap' ? 'ZAP!' : 'OUCH!', { color: '#ff6a4a', size: 24, life: 1.1 });
      break;
    }
    // 0.8.18 the stand-off
    case 'bandDuel':
      if (ev.ph === 'freeze') { audio.play('weasel_sniff', { vol: 0.5, pitch: 1.0 }); popup(ev.x, ev.y + 0.9, '!', { color: '#ffe680', size: 22, life: 0.6 }); }
      else if (ev.ph === 'fight') { audio.play('egg_bump', { vol: 0.6, pitch: 0.7 }); audio.play('weasel_yelp', { vol: 0.5, pitch: 1.2 }); if (!calm) fx.shake = Math.max(fx.shake || 0, 0.12); }
      break;
    case 'bandDuelWin': audio.play('rock_hit', { vol: 0.5, pitch: 1.3 }); audio.play('weasel_yelp', { vol: 0.6, pitch: 1.5 }); fx.sparkle(ev.x, ev.y, 10, '#ffe08a'); break; // the bonk with his sack
    case 'bandDuelRip': audio.play('thorn_snap', { vol: 0.6, pitch: 1.4 }); audio.play('release', { vol: 0.6, pitch: 0.9 }); popup(ev.x, ev.y + 0.9, '?', { color: '#ffe680', size: 26, life: 1.2 }); break; // the sack rips: "Huh?"
    case 'bandFall': audio.play('creature_hurt', { vol: 0.8, pitch: 0.7 }); audio.play('wind_gust', { vol: 0.4, pitch: 1.4 }); break;
    case 'bandDefeat':
      audio.play('rock_hit', { vol: 0.6, pitch: 0.6 }); audio.play('tada', { vol: 0.6 });
      popup(ev.x, ev.y + 1.0, 'BAGGED!', { color: '#ffd63c', size: 28, life: 1.6 });
      if (!calm) fx.shake = Math.max(fx.shake || 0, 0.3);
      break;
    case 'bandSpill': audio.play('release', { vol: 0.6, pitch: 1.1 }); fx.sparkle(ev.x, ev.y, 10, '#bff0a0'); break;
    case 'bandWhistle': audio.play('wind_gust', { vol: 0.45, pitch: 2.4 }); if (ev.weasel) audio.play('weasel_snicker', { vol: 0.6 }); break;
    case 'bandFreeze': audio.play('glass_crack', { vol: 0.5 }); break;
    case 'bandStun': audio.play('stun_stars', { vol: 0.6 }); break;
    case 'bandScared': audio.play('egg_bump', { vol: 0.5, pitch: 1.9 }); break;
  }
}

// ---------- his face in a round chip (the boss bar, the info panel) and his intro card
export function drawBanditEmblem(ctx, r, t) {
  const s = r * 1.55, u = s / 100, p = raccoonPose('peek', t, 0.55 + 0.45 * Math.sin(t * 1.3) ** 2);
  drawRaccoon(ctx, -6 * u, 74 * u + r * 0.1, s, t, p, { egg: false });
}
export function drawBanditCard(ctx, x, y, w, h, t, age) {
  const H0 = Math.min(h, w * 2.06), W0 = H0 / 2.06, pad = Math.max(2, H0 * 0.025);
  const e = age == null ? 1 : clamp(age / 0.45, 0, 1), pop = e < 1 ? 0.6 + 0.4 * (1 - Math.pow(1 - e, 3)) + Math.sin(e * Math.PI) * 0.08 : 1;
  const dw = (W0 - pad * 2) * pop, dh = (H0 - pad * 2) * pop, cx = x + w / 2, cy = y + h / 2 + Math.sin(t * 2.1) * h * 0.012, r = dw * 0.07;
  const rr = (px, py, pw, ph, rad) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(px, py, pw, ph, rad); else ctx.rect(px, py, pw, ph); };
  ctx.save();
  ctx.globalAlpha *= Math.min(1, e * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; rr(cx - dw / 2 + pad * 0.6, cy - dh / 2 + pad * 1.2, dw, dh, r); ctx.fill();
  ctx.fillStyle = '#5a3a1c'; rr(cx - dw / 2 - pad, cy - dh / 2 - pad, dw + pad * 2, dh + pad * 2, r + pad); ctx.fill();
  ctx.fillStyle = '#f2c25a'; rr(cx - dw / 2 - pad * 0.45, cy - dh / 2 - pad * 0.45, dw + pad * 0.9, dh + pad * 0.9, r + pad * 0.45); ctx.fill();
  rr(cx - dw / 2, cy - dh / 2, dw, dh, r);
  ctx.save(); ctx.clip();
  const g = ctx.createLinearGradient(0, cy - dh / 2, 0, cy + dh / 2);
  g.addColorStop(0, '#16203f'); g.addColorStop(0.62, '#2f3f5a'); g.addColorStop(1, '#6a5a32');
  ctx.fillStyle = g; ctx.fillRect(cx - dw / 2, cy - dh / 2, dw, dh);
  ctx.fillStyle = '#f6eccb'; ctx.beginPath(); ctx.arc(cx - dw * 0.22, cy - dh * 0.34, dw * 0.12, 0, TAU); ctx.fill(); // a full moon: a raid night
  ctx.fillStyle = 'rgba(255,248,220,0.85)';
  for (let i = 0; i < 7; i++) { const sx = cx - dw * 0.42 + (((i * 41) % 84) / 100) * dw, sy = cy - dh * 0.46 + (((i * 57) % 30) / 100) * dh; ctx.fillRect(sx, sy, Math.max(1, dw * 0.012), Math.max(1, dw * 0.012)); }
  const fy = cy + dh * 0.36;
  ctx.fillStyle = '#4a6a2a'; ctx.fillRect(cx - dw / 2, fy, dw, dh); ctx.fillStyle = '#35501e'; ctx.fillRect(cx - dw / 2, fy + dh * 0.05, dw, dh);
  ctx.strokeStyle = '#140c08'; ctx.lineWidth = Math.max(1, dw * 0.012); ctx.beginPath(); ctx.moveTo(cx - dw / 2, fy); ctx.lineTo(cx + dw / 2, fy); ctx.stroke();
  // the egg he has his eye on, and Bandit himself licking his lips
  egg(ctx, cx + dw * 0.32, fy - dh * 0.085, dh * 0.15, 0.1 * Math.sin(t * 2));
  const s = dw * 0.86, cyc = (t % 3.2) / 3.2;
  drawRaccoon(ctx, cx - dw * 0.08, fy, s, t, raccoonPose('peek', t, ss(0, 0.6, cyc) * (1 - ss(0.9, 1, cyc))), { egg: false });
  ctx.restore();
  ctx.restore();
  return true;
}

// ---------- dev only: the perch states on a stand-in ring (window.__bandit.demo), for strips and for whoever builds the behaviour
const DEMO = [['climb', 1.5], ['hop', 0.95], ['sit', 2.2], ['crank', 3], ['reach', 1.5], ['grab', 1.8], ['shaken', 1.6], ['fall', 1.3]];
function demoAt(T) { let x = T % DEMO.reduce((n, d) => n + d[1], 0); for (const [st, d] of DEMO) { if (x < d) return { st, u: x / d, d }; x -= d; } return { st: 'sit', u: 0, d: 1 }; }
// centre (cx, cy) px of a 4-ring vault like L6's, k px per metre; o: { a (perch angle, rad), face, st, u (else it cycles on t), calm, rings: false }
function banditDemo(ctx, cx, cy, k, t, o = {}) {
  const D = o.st ? { st: o.st, u: o.u || 0 } : demoAt(t), a = o.a ?? 2.0, face = o.face || 1, R = 4.2, eggA = a - face * 0.2, eggW = { x: (R - 0.52) * Math.cos(eggA), y: (R - 0.52) * Math.sin(eggA) };
  const st = D.st, u = !o.st && (st === 'sit' || st === 'crank') ? 0 : D.u, base = { face, calm: true, opt: {}, eyeW: eggW, toW: eggW, egg: st === 'grab' ? undefined : false };
  if (st === 'fall') { const T = Math.max(0, u - 0.12) * 0.95, ro = R + RING_TH / 2, vx = -Math.sin(a) * face * 1.7 + Math.cos(a) * 1.6, vy = Math.cos(a) * face * 1.7 + Math.sin(a) * 1.6; base.at = { x: ro * Math.cos(a) + vx * T, y: ro * Math.sin(a) + vy * T - 4.5 * T * T }; } // thrown off backwards, then gravity
  ctx.save(); ctx.translate(cx, cy); ctx.scale(k, -k);
  const p = drawBanditPerch(ctx, R, a, t, k, st, u, { ...base, layer: 'back' });
  if (o.rings !== false) for (const r of [3.15, 4.2]) { ctx.beginPath(); ctx.arc(0, 0, r, a - 0.9, a + 0.9); ctx.lineCap = 'butt'; ctx.lineWidth = RING_TH + 5 / k; ctx.strokeStyle = '#3a2412'; ctx.stroke(); ctx.lineWidth = RING_TH; ctx.strokeStyle = '#a8713c'; ctx.stroke(); ctx.lineWidth = RING_TH * 0.3; ctx.strokeStyle = '#c99556'; ctx.stroke(); }
  if (st !== 'grab' && st !== 'fall' && st !== 'shaken') { ctx.save(); ctx.translate(eggW.x, eggW.y); ctx.scale(1 / k, -1 / k); egg(ctx, 0, 0, 0.56 * k, 0.1); ctx.restore(); }
  drawBanditPerch(ctx, R, a, t, k, st, u, { ...base, layer: 'front' });
  ctx.restore();
  return D;
}
if (typeof __DEV__ === 'undefined' || __DEV__) { try { window.__bandit = { drawBanditPerch, demo: banditDemo, demoAt, DEMO, BANDIT_SCALE }; } catch (_) { /* no window */ } }
