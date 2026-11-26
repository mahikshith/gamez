// Spike the sea urchin in play (0.8.17, level 46): the sim's urchin (sim/urchin.js) drawn with his own rig
// (render/urchin.js, never redrawn here), his aim line, his events (sounds, the SPLAT), the level card's little scene
// (an actor for render/howact.js) and his portrait for the "i" panel. ctx is in world space (m, y up); he is drawn in a
// local y-DOWN px space whose "up" is the way off his floor (away from the vault's middle on the floor, or off the wall he
// is splatted on). Calm (save.calm): no shake, a steady aim line.
import { urchinPose, urchinBlend, drawUrchin, URCHIN_M, URCHIN_TURN } from './urchin.js';
import { URCHIN } from '../sim/urchin.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
const out3 = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
const wrapA = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
// 0.8.18: in play Spike is drawn 1.7x his sim body, standing on the same floor point (at 450x1000 he was a purple dot
// about one egg wide: his face did not read). What he touches, bumps and splats on is the sim's and is unchanged.
export const SPIKE_PLAY = 1.7;
const MEM = new Map(); // per urchin: the frame's eased angle, the end clock

// where and how to draw him: { fx, fy (the floor point under him, world m), ang (his "up", world rad), face, pose, o }
function frame(sim, U, t, M) {
  const el = U.dur - U.t; // s into the state
  const up = Math.atan2(U.uy, U.ux), rad = Math.atan2(U.y, U.x);
  let ang = U.on >= 0 ? rad : up, face = U.face, h = URCHIN.h, pose, o = {};
  // along a dash: he rolls the way he flies, upright as near as the run allows (his "up" turns off the run's line, toward the rim)
  const runUp = () => { const a = Math.atan2(U.dy, U.dx), p1 = a + Math.PI / 2, p2 = a - Math.PI / 2; const k = Math.cos(wrapA(p1 - rad)) >= Math.cos(wrapA(p2 - rad)) ? p1 : p2; face = wrapA(a - (k - Math.PI / 2)) < 0.01 && wrapA(a - (k - Math.PI / 2)) > -0.01 ? 1 : -1; return k; };
  switch (U.ph) {
    case 'wait': case 'in': h = URCHIN.hNap; pose = urchinPose('nap', t); break;
    case 'nap': h = URCHIN.hNap; pose = urchinPose('nap', t + U.id * 1.7); break;
    case 'puff': pose = urchinPose('puff', t, clamp(el / U.dur, 0, 1)); if (U.aim) o.eye = el / U.dur > 0.35 ? 'lock' : undefined; break;
    case 'roll': case 'cross': pose = urchinPose('roll', t, Math.max(1e-3, U.odo / URCHIN_TURN)); if (U.ph === 'cross' && U.on < 0) ang = rad; break;
    case 'dash': case 'back': ang = runUp(); pose = urchinPose('roll', t, Math.max(1e-3, U.odo / URCHIN_TURN)); if (U.ph === 'back' && U.hit) o.eye = 'happy'; break;
    case 'bump': pose = urchinPose('bump', t, clamp(el / U.dur, 0, 1)); face = -U.face; break; // the thorn (or egg) is behind his new way
    case 'laugh': pose = urchinPose('laugh', t); break;
    case 'splat': ang = runUp(); pose = urchinPose('bump', t, clamp(el / 0.9, 0, 0.5)); break; // crunch on the wall ahead
    case 'flip': h = URCHIN.hFlip; ang = rad; pose = urchinPose('flipped', t, clamp(el / 1.1, 0, 1)); if (el > 0.5 && !U.zp) o.stars = 3; if (U.zp > 0 || U.k === 'zap') o.eye = el < 1.2 ? 'spiral' : undefined; break;
    case 'dizzy': h = URCHIN.hNap; pose = urchinPose('dizzy', t); break;
    case 'scare': h = URCHIN.hNap; pose = urchinPose('scared', t); break;
    case 'warp': h = URCHIN.hNap; pose = urchinPose('scared', t); break;
    case 'end': {
      if (M.endT == null) M.endT = t;
      pose = sim.state === 'failed' || sim.state === 'failing' ? urchinPose('laugh', t) : urchinPose('defeated', t, clamp((t - M.endT) / 2.6, 0, 1));
      break;
    }
    default: pose = urchinPose('idle', t);
  }
  if (U.ph !== 'end') M.endT = null;
  if (U.fz > 0) o.frozen = U.fz;
  return { cx: U.x, cy: U.y, ang, face, h, pose, o };
}

// the aim line of a dash puff: dots from him to the egg he glares at, growing as the spines come out
function aimLine(ctx, sim, U, t, k, calm) {
  if (U.ph !== 'puff' || !U.aim) return;
  let p = null;
  if (U.aim === -1) { const D = sim.p2Lure?.(); if (D) p = D.body.getPosition(); }
  else { const e = sim.eggs.find((q) => q.id === U.aim && q.alive && q.body); if (e) p = e.body.getPosition(); }
  if (!p) return;
  const u = clamp(1 - U.t / U.dur, 0, 1), a = ease(u / 0.6), L = Math.hypot(p.x - U.x, p.y - U.y);
  if (L < 0.4) return;
  const nx = (p.x - U.x) / L, ny = (p.y - U.y) / L, n = Math.floor(L / 0.17), r = 0.045, flow = calm ? 0 : (t * 2.2) % 1;
  ctx.save();
  for (let i = 1; i < n; i++) {
    const f = (i + flow) / n;
    if (f > a || f < 0.12) continue;
    const x = U.x + nx * L * f, y = U.y + ny * L * f, rr = r * (0.75 + 0.35 * f);
    ctx.beginPath(); ctx.arc(x, y, rr + 0.018, 0, TAU); ctx.fillStyle = '#170b2a'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fillStyle = '#ff5fae'; ctx.fill();
  }
  // the mark on the egg: a ring that closes in
  if (a > 0.98) {
    const q = calm ? 1 : 0.85 + 0.15 * Math.sin(t * 12);
    ctx.lineWidth = 0.05; ctx.strokeStyle = '#170b2a'; ctx.beginPath(); ctx.arc(p.x, p.y, 0.36 * q + 0.02, 0, TAU); ctx.stroke();
    ctx.lineWidth = 0.03; ctx.strokeStyle = '#ff5fae'; ctx.beginPath(); ctx.arc(p.x, p.y, 0.36 * q, 0, TAU); ctx.stroke();
  }
  ctx.restore();
  void k;
}

// bubbles streaming off a dash
function trail(ctx, U, t) {
  if (U.ph !== 'dash' && U.ph !== 'back') return;
  ctx.save(); ctx.fillStyle = 'rgba(214,240,255,0.75)'; ctx.strokeStyle = 'rgba(22,70,124,0.7)'; ctx.lineWidth = 0.015;
  for (let i = 0; i < 5; i++) {
    const q = ((t * 3 + i / 5) % 1), d = 0.35 + q * 0.7, w = Math.sin(i * 2.3 + t * 5) * 0.12;
    const x = U.x - U.dx * d - U.dy * w, y = U.y - U.dy * d + U.dx * w, r = 0.05 * (1 - q * 0.6);
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

export function drawUrchins(ctx, sim, t, k, calm = false) {
  for (const U of sim.urchins || []) {
    if (U.ph === 'wait' || U.ph === 'out') continue;
    let M = MEM.get(U.id);
    if (!M || M.sim !== sim || t < M.t - 0.5) { M = { sim, t, ang: null, endT: null }; MEM.set(U.id, M); }
    const F = frame(sim, U, t, M);
    if (M.ang == null) M.ang = F.ang;
    const dt = clamp(t - M.t, 0, 0.1); M.t = t;
    M.ang += wrapA(F.ang - M.ang) * (1 - Math.exp(-dt * 14)); // the frame turns smoothly (a splat, a fall, a dash)
    const pose = urchinBlend('u' + U.id + (sim.level.id || 0), F.pose, t, U.ph === 'roll' || U.ph === 'dash' || U.ph === 'back' ? 30 : 12);
    aimLine(ctx, sim, U, t, k, calm);
    trail(ctx, U, t);
    // the floor point under his middle, then into his px space: -y = his up
    const ux = Math.cos(M.ang), uy = Math.sin(M.ang), fx = F.cx - ux * F.h, fy = F.cy - uy * F.h;
    const grow = U.ph === 'in' ? out3(1 - U.t / U.dur) : U.ph === 'warp' ? Math.abs(U.t / U.dur - 0.5) * 2 : 1;
    if (grow <= 0.02) continue;
    ctx.save();
    ctx.translate(fx, fy); ctx.scale(1 / k, -1 / k);
    ctx.rotate(Math.atan2(ux, uy)); // local (0, -1) -> world (ux, uy)
    drawUrchin(ctx, 0, 0, k * URCHIN_M * URCHIN.art * SPIKE_PLAY * grow, t, pose, { face: F.face, ...F.o });
    ctx.restore();
  }
}

// ---------------------------------------------------------------- events (main.js handleEvents)
export function urchinEvent(ev, fx, U) {
  const P = U.popup, A = U.audio, calm = !!U.calm;
  switch (ev.type) {
    case 'urIn': A.play('bubble_on', { vol: 0.5, pitch: 0.7 }); fx.sparkle && fx.sparkle(ev.x, ev.y + 0.3, 6, '#d6f0ff'); break;
    case 'urPuff': A.play('puff_swell', { vol: ev.aim ? 0.75 : 0.45, pitch: ev.aim ? 1.25 : 1 }); break;
    case 'urDash': A.play('eagle_dive', { vol: 0.55, pitch: 1.5 }); break;
    case 'urHit': A.play('thorn_hit', { vol: 0.8 }); if (!calm) fx.shake = Math.max(fx.shake || 0, ev.dash ? 0.3 : 0.15); U.buzz && U.buzz('hit'); break;
    case 'urSplat':
      A.play('squish', { vol: 0.9, pitch: 0.8 }); A.play('rock_hit', { vol: 0.6, pitch: 1.4 });
      P(ev.x, ev.y + 0.35, 'SPLAT!', { color: '#ff8fd0', size: 22, life: 1.0 });
      fx.chips && fx.chips(ev.x, ev.y, '#a274f0', 7, 1.6);
      if (!calm) fx.shake = Math.max(fx.shake || 0, 0.25);
      U.buzz && U.buzz('hit');
      break;
    case 'urLand': A.play('rock_hit', { vol: 0.45, pitch: 1.7 }); break;
    case 'urFlip': A.play('stun_stars', { vol: 0.7 }); if (ev.why !== 'wall') P(ev.x, ev.y + 0.55, 'Flipped!', { color: '#fff2a8', size: 18, life: 0.9 }); break;
    case 'urBonk': A.play('rock_hit', { vol: 0.7, pitch: 1.2 }); P(ev.x, ev.y + 0.4, 'Bonk!', { color: '#fff2a8', size: 18, life: 0.8 }); break;
    case 'urUp': A.play('sal_huff', { vol: 0.45, pitch: 1.7 }); break;
    case 'urLaugh': A.play('weasel_snicker', { vol: 0.5, pitch: 1.5 }); break;
    case 'urBump': A.play('thorn_hit', { vol: 0.35, pitch: 1.4 }); break;
    case 'urCross': A.play('bubble_on', { vol: 0.35, pitch: 1.2 }); break;
    case 'urScare': A.play('sal_yelp', { vol: 0.5, pitch: 1.6 }); break;
    case 'urOut': A.play('bubble_pop', { vol: 0.7, pitch: 0.8 }); break;
    case 'urDecoy': A.play('bubble_pop', { vol: 0.7, pitch: 1.2 }); break;
  }
}

// ---------------------------------------------------------------- the level card's little scene (render/howact.js actor)
// Stage space: px, y down; S.at(phi, lift) a point on the ring floor (phi 0 = straight down, lift > 0 = inside, toward
// the centre); S.k px per metre. 'harm': he naps by the egg, puffs, dashes into it (CRACK!) and rolls on with it.
// 'turn': he sits under the ring and aims up through a gap at the egg; the hand turns the ring, the gap slides on to the
// egg, his dash meets the wall: SPLAT! he drops on his back with stars, and the egg falls through into the basket.
const segA = (T, a, b) => clamp((T - a) / (b - a), 0, 1);
function dots(c, x0, y0, x1, y1, a, r, t, calm) {
  const L = Math.hypot(x1 - x0, y1 - y0); if (L < 1 || a <= 0) return;
  const n = Math.max(3, Math.floor(L / (r * 3.6))), fl = calm ? 0 : (t * 2.2) % 1;
  for (let i = 1; i < n; i++) {
    const f = (i + fl) / n; if (f > a || f < 0.14) continue;
    const X = x0 + (x1 - x0) * f, Y = y0 + (y1 - y0) * f, rr = r * (0.75 + 0.35 * f);
    c.beginPath(); c.arc(X, Y, rr + r * 0.4, 0, TAU); c.fillStyle = '#170b2a'; c.fill();
    c.beginPath(); c.arc(X, Y, rr, 0, TAU); c.fillStyle = '#ff5fae'; c.fill();
  }
}
const ART_H = 0.47 * URCHIN.art; // m: his centre over the floor with the spines out (the rig's standing height)
function urchinAt(c, X, Y, rot, s, t, pose, o) { c.save(); c.translate(X, Y); c.rotate(rot); drawUrchin(c, 0, 0, s, t, pose, o); c.restore(); }
function actHarm(c, S) {
  const { T, t, k, floor, eggS } = S, s = k * URCHIN_M * URCHIN.art, reach = ART_H * k * 0.92;
  const eA = S.eA || 0, touch = (a) => a - (eggS * 0.44 + reach) / floor, a0 = touch(0) - 0.42;
  let phi = a0, st = 'nap', u = 0, o = { face: 1 }, odo = 0;
  if (T < 0.2) st = 'nap';
  else if (T < 0.92) { st = 'puff'; u = segA(T, 0.2, 0.92); if (u > 0.4) o.eye = 'lock'; }
  else if (T < 1.02) { st = 'roll'; phi = a0 + (touch(0) - a0) * segA(T, 0.92, 1.02); }
  else if (T < 1.95) { st = 'roll'; phi = touch(eA); }
  else { st = 'laugh'; phi = touch(eA); }
  odo = (phi - a0) * floor / k;
  const pose = st === 'roll' ? urchinPose('roll', t, Math.max(1e-3, odo / URCHIN_TURN)) : urchinPose(st, st === 'nap' ? t : t, u);
  const P = S.at(phi, 0);
  if (st === 'puff' && u > 0.35) { const E = S.at(0, eggS * 0.5), M = S.at(phi, ART_H * k); dots(c, M.x, M.y, E.x, E.y, ease((u - 0.35) / 0.5), k * 0.045, t, S.calm); }
  if (st === 'roll' && T < 1.1) { c.save(); c.fillStyle = 'rgba(214,240,255,0.8)'; for (let i = 0; i < 4; i++) { const b = S.at(phi - (0.05 + i * 0.05), ART_H * k * (0.6 + 0.3 * Math.sin(i * 2.1))); c.beginPath(); c.arc(b.x, b.y, k * 0.05 * (1 - i * 0.18), 0, TAU); c.fill(); } c.restore(); }
  urchinAt(c, P.x, P.y, -phi, s, t, urchinBlend('howU', pose, t, st === 'roll' ? 40 : 14), o);
  return { threat: true, bonk: 0, x: P.x, y: P.y - s, own: true };
}
function actTurn(c, S) {
  const { T, t, k, band, eggS, C } = S, s = k * URCHIN_M * URCHIN.art, cr = ART_H * k;
  const E = S.at(0, eggS * 0.5), G = S.at(S.g0, 0), gx = G.x - E.x, gy = G.y - E.y, gl = Math.hypot(gx, gy) || 1, dx = gx / gl, dy = gy / gl;
  const P0 = { x: G.x + dx * (band * 0.6 + cr * 1.45), y: G.y + dy * (band * 0.6 + cr * 1.45) }; // his centre, under the ring, in line with the gap and the egg
  const phiS = Math.atan2(P0.x - C.x, P0.y - C.y), stand = -phiS; // standing: his up toward the ring's centre
  const run = Math.atan2(dy, dx); // the dash goes up the line (toward the egg): face -1 rolls that way
  const hitD = Math.max(0, Math.hypot(P0.x - G.x, P0.y - G.y) - band - cr * 0.9); // how far he gets before the wall
  let X = P0.x, Y = P0.y, rot = stand, st = 'idle', u = 0, o = { face: -1 }, odo = 0, bonk = 0, aim = 0;
  if (T < 0.3) st = 'nap';
  else if (T < 1.75) { st = 'puff'; u = segA(T, 0.3, 1.75); if (u > 0.4) o.eye = 'lock'; aim = ease((u - 0.3) / 0.45); }
  else if (T < 2.1) { const q = segA(T, 1.85, 2.1); st = 'roll'; X = P0.x - dx * hitD * q * q; Y = P0.y - dy * hitD * q * q; odo = hitD * q * q / k; rot = stand + wrapA(run - stand) * ease(segA(T, 1.75, 1.9)); }
  else if (T < 2.35) { st = 'bump'; u = segA(T, 2.1, 2.6); X = P0.x - dx * hitD; Y = P0.y - dy * hitD; rot = run; bonk = segA(T, 2.1, 2.65); }
  else { const q = ease(segA(T, 2.35, 2.7)); st = 'flipped'; u = segA(T, 2.35, 3.6); X = P0.x - dx * hitD * (1 - q); Y = P0.y - dy * hitD * (1 - q); rot = run + wrapA(stand - run) * q; bonk = segA(T, 2.1, 2.65); if (T > 2.9) o.stars = 3; }
  if (T >= 2.1 && T < 2.35) bonk = segA(T, 2.1, 2.65);
  // he is drawn from his floor point: centre minus his up (rot says where "up" is)
  const ux = Math.sin(rot), uy = -Math.cos(rot), hy = st === 'nap' ? URCHIN.hNap * k : cr;
  if (aim > 0) { const tipX = P0.x - dx * cr * 0.7, tipY = P0.y - dy * cr * 0.7; dots(c, tipX, tipY, E.x, E.y, aim, k * 0.045, t, S.calm); }
  if (st === 'roll' && T > 1.85) { c.save(); c.fillStyle = 'rgba(214,240,255,0.8)'; for (let i = 1; i < 4; i++) { const q = i * 0.28; c.beginPath(); c.arc(X + dx * cr * q * 1.6, Y + dy * cr * q * 1.6, k * 0.05 * (1 - i * 0.2), 0, TAU); c.fill(); } c.restore(); }
  const pose = st === 'roll' ? urchinPose('roll', t, Math.max(1e-3, odo / URCHIN_TURN)) : urchinPose(st, t, u);
  urchinAt(c, X - ux * hy, Y - uy * hy, rot, s, t, urchinBlend('howT', pose, t, st === 'roll' ? 40 : 14), o);
  return { threat: T < 2.1, bonk, word: 'SPLAT!', x: X, y: Y - cr * 1.6, own: true };
}
export const urchinActor = {
  draw: (c, S) => (S.m === 'harm' ? actHarm(c, S) : actTurn(c, S)),
  stage: (m) => (m === 'harm' ? { g0: 1.1, dTh: 0, pan: 0.14 } : { g0: 0.3, dTh: -0.3, hand: [-0.22, -0.52], pan: -0.12 }),
  aim: (S) => S.at(0.6, -(S.band + ART_H * S.k)),
};
