// The moving thorn's render side (0.8.18, redone). The thorn itself is drawn by render/world.js drawThorns with the very
// code of every standing thorn (it is an entry of ring.thorns: sim/creeper.js); this file only adds what moving adds:
//   moverPose   the thorn's own language, as numbers drawThorns feeds into its sway / stretch / hot tip: the wind-up
//               (shiver, hot tip, a small squash, a lean toward where it will go), the slide (the tip trails back by its
//               speed on a damped spring), the stop (the spring swings the tip forward, wobbles, settles; a squash).
//   drawGroove  its road: a shallow groove in the ring's own colours along the rim face, a stop notch at each end.
//   drawMoverFx scrape bits off its base while it slides and a small puff at the stop, in the ring's material.
// ctx is in ring space (m, y up, rotated with the ring). Calm: a smooth glide, a steady glow, no bits. PERF.low: no bits.
import { CREEP } from '../sim/creeper.js';
import { ringPt } from '../sim/shapes.js';
import { PERF } from '../perf.js';
import { darken } from './ringart.js';
import { drawThornIcon } from './world.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const MEM = new WeakMap(); // the sim's mover -> its render memory (spring, bits)
const REST = { lean: 0, stretch: 1, hot: 0, pop: 0, steady: false };

function mem(C, t) {
  let M = MEM.get(C);
  if (!M) MEM.set(C, (M = { t, lean: 0, vel: 0, ph: C.ph, stopT: -9, goT: -9, bits: [], acc: 0, seed: 7 + C.id * 31, sgn: 1, out: { ...REST } }));
  return M;
}
const rnd = (M) => { M.seed = (M.seed * 16807) % 2147483647; return M.seed / 2147483647; };

// called once per thorn per frame by drawThorns: { lean (added to the sway), stretch (x its length), hot (0..1 the hot
// tip and shiver of the wind-up), pop (0..1: a stub about to spring out, the retracting thorn's warning), steady (calm) }
export function moverPose(th, t, calm) {
  const C = th.mv, M = mem(C, t);
  let dt = t - M.t;
  if (dt === 0) return M.out;
  M.t = t;
  if (!(dt > 0 && dt < 0.12)) { dt = 0; M.lean = M.vel = 0; M.bits.length = 0; M.ph = C.ph; M.stopT = M.goT = -9; }
  const sgn = Math.sign(C.to - C.from) || 1;
  if (C.ph !== M.ph) {
    if (M.ph === 'slide' && C.ph === 'rest') { M.stopT = t; M.vel += sgn * 3.5; M.puff = sgn; }
    if (M.ph === 'rest' && C.ph === 'slide') M.goT = t;
    M.ph = C.ph;
  }
  M.sgn = sgn;
  const O = M.out;
  O.hot = 0; O.pop = 0; O.stretch = 1; O.steady = !!calm;
  let target = 0;
  if (C.ph === 'slide') target = -sgn * 0.62 * Math.tanh(C.spd * 1.15);
  else if (C.ph === 'rest' && C.t < CREEP.wind) {
    const w = 1 - C.t / CREEP.wind, nd = Math.abs((C.dir > 0 ? C.a1 : C.a0) - C.u) < 1e-4 ? -C.dir : C.dir;
    O.hot = w; target = nd * 0.3 * w * w; O.stretch = 1 - 0.15 * Math.sin((w * Math.PI) / 2);
  } else if (C.ph === 'stub' && C.t < CREEP.warn) O.pop = 1 - C.t / CREEP.warn;
  if (calm) { M.lean = M.vel = 0; O.lean = 0; O.stretch = 1; return O; }
  // the tip on a damped spring
  for (let left = dt; left > 1e-6; left -= 1 / 120) {
    const h = Math.min(left, 1 / 120), W0 = 24, Z = 0.2;
    M.vel += (-W0 * W0 * (M.lean - target) - 2 * Z * W0 * M.vel) * h;
    M.lean += M.vel * h;
  }
  M.lean = clamp(M.lean, -0.8, 0.8);
  const sa = t - M.stopT, ga = t - M.goT;
  if (sa >= 0 && sa < 0.7) O.stretch += -0.15 * Math.exp(-sa * 8) * Math.cos(sa * 26); // the stop lands: a squash that rings out
  if (ga >= 0 && ga < 0.4) O.stretch += 0.1 * Math.sin((ga / 0.4) * Math.PI) * (1 - ga / 0.4); // off the mark: a stretch
  O.lean = C.ph === 'stub' || C.ph === 'grow' ? 0 : M.lean;
  return O;
}

// which bits a ring's material sheds
const BITS = { vine: 'leaf', wood: 'leaf', ice: 'chip', metal: 'spark', brass: 'spark', gold: 'spark', coral: 'bubble', obsidian: 'ember', glass: 'glint', crystal: 'glint' };
export const bitKind = (mat, look) => BITS[look] || BITS[mat] || (mat ? 'dust' : 'leaf');

// the groove: drawn before the ring's thorns
export function drawGroove(ctx, ring, th, col, px) {
  const C = th.mv, inn = th.side === 'in', rg = th.base + (inn ? 0.04 : -0.04), dark = darken(col.dark, 0.5);
  const hA = (CREEP.half * 0.75) / ring.r, a0 = C.a0 - hA, a1 = C.a1 + hA, n = Math.max(4, Math.ceil((a1 - a0) / 0.035));
  const line = (rad) => { ctx.beginPath(); for (let i = 0; i <= n; i++) { const [x, y] = ringPt(ring, a0 + ((a1 - a0) * i) / n, rad); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } };
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.globalAlpha = C.ph === 'gone' ? 0.45 : 1;
  line(rg + (inn ? 0.03 : -0.03)); ctx.strokeStyle = col.light; ctx.globalAlpha *= 0.7; ctx.lineWidth = Math.max(0.022, 1.6 * px); ctx.stroke(); // the lit lip of the cut
  ctx.globalAlpha = C.ph === 'gone' ? 0.45 : 0.9;
  line(rg); ctx.strokeStyle = dark; ctx.lineWidth = Math.max(0.05, 2.6 * px); ctx.stroke(); // the groove itself
  for (const a of [a0, a1]) { // a stop notch at each end
    const [x, y] = ringPt(ring, a, rg), [qx, qy] = ringPt(ring, a, rg + (inn ? 0.02 : -0.02));
    ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(x, y, Math.max(0.045, 2.6 * px), 0, TAU); ctx.fill();
    ctx.fillStyle = col.light; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(qx, qy, Math.max(0.011, 0.8 * px), 0, TAU); ctx.fill(); ctx.globalAlpha = C.ph === 'gone' ? 0.45 : 0.9;
  }
  ctx.restore();
}

// scrape bits and the stop's puff: drawn after the ring's thorns. kind: bitKind(ring.mat, look)
export function drawMoverFx(ctx, ring, th, t, col, kind, calm) {
  const C = th.mv, M = mem(C, t);
  if (calm || PERF.low) { M.bits.length = 0; M.puff = 0; return; }
  const dtF = 1 / 60, A = ring.body.getAngle(), gx = -Math.sin(A), gy = -Math.cos(A); // world down, in ring space
  const out = th.side === 'in' ? -1 : 1, hA = CREEP.half / ring.r;
  const frame = (a) => { const [x, y] = ringPt(ring, a, th.base), c = Math.cos(a), s = Math.sin(a); return { x, y, tx: -s, ty: c, nx: c * out, ny: s * out }; }; // t: +angle along the rim; n: off the face
  if (C.ph === 'slide' && C.spd > 0.12 && th.ext > 0.5) {
    M.acc += C.spd * 0.42; // bits per frame, by speed
    while (M.acc >= 1 && M.bits.length < 14) {
      M.acc -= 1;
      const F = frame(C.u - M.sgn * hA * 0.8), back = -M.sgn * (0.25 + 0.5 * rnd(M)) * (0.5 + C.spd), up = 0.5 + 0.7 * rnd(M);
      M.bits.push({ x: F.x, y: F.y, vx: F.tx * back + F.nx * up, vy: F.ty * back + F.ny * up, t0: t, life: 0.3 + 0.25 * rnd(M), r: 0.014 + 0.012 * rnd(M), sp: (rnd(M) - 0.5) * 20, k: kind });
    }
    if (M.acc >= 1) M.acc = 0;
  }
  if (M.puff) { // the stop: a small puff off the leading foot
    const F = frame(C.u + M.puff * hA);
    for (let i = 0; i < 4; i++) { const s = (i - 1.5) / 1.5; M.bits.push({ x: F.x, y: F.y, vx: F.tx * (M.puff * 0.35 + s * 0.3) + F.nx * (0.25 + 0.2 * rnd(M)), vy: F.ty * (M.puff * 0.35 + s * 0.3) + F.ny * (0.25 + 0.2 * rnd(M)), t0: t, life: 0.42, r: 0.03 + 0.012 * rnd(M), sp: 0, k: 'puff' }); }
    M.puff = 0;
  }
  ctx.save();
  for (let i = M.bits.length - 1; i >= 0; i--) {
    const b = M.bits[i], age = t - b.t0, u = age / b.life;
    if (u >= 1 || age < 0) { M.bits.splice(i, 1); continue; }
    const k = b.k, grav = k === 'puff' ? 0 : k === 'bubble' ? -1.2 : k === 'ember' || k === 'spark' ? 1.2 : 3.2, drag = k === 'puff' ? 3 : 0.6;
    b.vx += (gx * grav - b.vx * drag) * dtF; b.vy += (gy * grav - b.vy * drag) * dtF;
    b.x += b.vx * dtF; b.y += b.vy * dtF;
    const al = u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85;
    ctx.globalAlpha = clamp(al, 0, 1) * (k === 'puff' ? 0.55 : 0.95);
    if (k === 'puff') { ctx.fillStyle = col.light; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (0.6 + 1.3 * u), 0, TAU); ctx.fill(); continue; }
    if (k === 'bubble') { ctx.strokeStyle = '#eafcff'; ctx.lineWidth = 0.008; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (0.8 + 0.5 * u), 0, TAU); ctx.stroke(); continue; }
    if (k === 'spark' || k === 'ember') {
      const sp = Math.hypot(b.vx, b.vy) || 1, L = k === 'spark' ? 0.05 : 0.012;
      ctx.strokeStyle = k === 'spark' ? (u < 0.4 ? '#fff6c8' : '#ffb347') : u < 0.5 ? '#ffb347' : '#e2502a'; ctx.lineCap = 'round'; ctx.lineWidth = k === 'spark' ? 0.012 : b.r * 1.2;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - (b.vx / sp) * L, b.y - (b.vy / sp) * L); ctx.stroke(); continue;
    }
    ctx.save();
    ctx.translate(b.x, b.y); ctx.rotate(b.sp * age);
    const r = b.r;
    if (k === 'glint') { ctx.fillStyle = '#ffffff'; const s = r * 1.5 * (1 - 0.5 * u); ctx.beginPath(); ctx.moveTo(-s, 0); ctx.quadraticCurveTo(0, 0, 0, s); ctx.quadraticCurveTo(0, 0, s, 0); ctx.quadraticCurveTo(0, 0, 0, -s); ctx.quadraticCurveTo(0, 0, -s, 0); ctx.fill(); }
    else if (k === 'leaf') { ctx.fillStyle = i % 3 ? '#6fb445' : col.light; ctx.beginPath(); ctx.moveTo(-r * 1.4, 0); ctx.quadraticCurveTo(0, r * 1.1, r * 1.4, 0); ctx.quadraticCurveTo(0, -r * 1.1, -r * 1.4, 0); ctx.fill(); }
    else { ctx.fillStyle = k === 'chip' ? (i % 2 ? '#eaf8ff' : '#a8dcf5') : i % 2 ? col.light : col.base; ctx.beginPath(); ctx.moveTo(-r, -r * 0.6); ctx.lineTo(r, 0); ctx.lineTo(-r * 0.4, r * 0.8); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ events (main.js handleEvents)
// setting off, the stop against the end of its groove, springing back out. (A hit, a burn, a snap are the thorn's own
// events and sounds: thorn_hit, fire_burn, thorn_snap.)
export function moverEvent(ev, U) {
  const A = U.audio;
  switch (ev.type) {
    case 'creepGo': A.play('ring_tick', { vol: 0.3, pitch: 0.7 }); break;
    case 'creepStop': A.play('egg_bump', { vol: 0.3, pitch: 1.5 }); break;
    case 'creepGrow': A.play('thorn_snap', { vol: 0.3, pitch: 1.6 }); break;
  }
}

// ------------------------------------------------------------------ pictures outside play
// A small spring for the pictures: the pose at time T of a scripted move u(T) (rad along the rim, px = rad x floor).
const sstep = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
// one beat of a slide that starts at T0 and lasts D: where it is (0..1), its speed share (0..1) and what the tip does
function beat(T, T0, D, wind = 0.4) {
  const s = clamp((T - T0) / D, 0, 1), E = (q) => sstep(0.88 * Math.pow(q, 1.3)) / sstep(0.88), f = E(s);
  const sp = s > 0 && s < 1 ? clamp((E(Math.min(1, s + 0.02)) - E(Math.max(0, s - 0.02))) / 0.04 / 1.6, 0, 1) : 0;
  const w = clamp((T - (T0 - wind)) / wind, 0, 1) * (T < T0 ? 1 : 0), sa = T - (T0 + D);
  let lean = -0.55 * sp + 0.3 * w * w, stretch = 1 - 0.15 * Math.sin((w * Math.PI) / 2);
  if (sa >= 0) { lean += 0.34 * Math.exp(-sa * 5) * Math.cos(sa * 23); stretch -= 0.15 * Math.exp(-sa * 8) * Math.cos(sa * 26); }
  return { f, lean, stretch, hot: w };
}
// the groove on a flat strip or a stage ring: pts = [[x, y], ...] along it, in px; lw = the groove's width in px
function grooveLine(c, pts, lw, dark, light, nx, ny) {
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  const path = (ox, oy) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x + ox, y + oy) : c.moveTo(x + ox, y + oy))); };
  c.globalAlpha *= 0.55; path(nx * lw * 0.45, ny * lw * 0.45); c.strokeStyle = light; c.lineWidth = lw * 0.5; c.stroke(); c.globalAlpha /= 0.55;
  path(0, 0); c.strokeStyle = dark; c.lineWidth = lw; c.stroke();
  for (const [x, y] of [pts[0], pts[pts.length - 1]]) { c.fillStyle = dark; c.beginPath(); c.arc(x, y, lw * 0.9, 0, TAU); c.fill(); }
  c.restore();
}
// the "i" panel / card tile portrait: the game's thorn on a strip of rim, sliding to and fro in its groove (screen
// space, y down, centred in a d x d box)
export function drawMoverPortrait(ctx, x, y, d, t) {
  const k = d / 0.92, top = y + d * 0.17, x0 = x - d * 0.3, x1 = x + d * 0.3, P = 3.4, T = ((t % P) + P) % P;
  const go = T < P / 2, b = beat(go ? T : T - P / 2, 0.55, 0.75), u = go ? b.f : 1 - b.f, sg = go ? 1 : -1;
  ctx.save();
  ctx.fillStyle = '#b27a45'; ctx.fillRect(x - d * 0.44, top, d * 0.88, 0.16 * k);
  ctx.strokeStyle = '#5a3a20'; ctx.lineWidth = Math.max(1, d * 0.02); ctx.strokeRect(x - d * 0.44, top, d * 0.88, 0.16 * k);
  grooveLine(ctx, [[x0 - 0.1 * k, top + 0.045 * k], [x1 + 0.1 * k, top + 0.045 * k]], 0.045 * k, '#5a3a20', '#d9a46a', 0, 1);
  drawThornIcon(ctx, x0 + (x1 - x0) * u, top + 0.03 * k, 0, k, t, { lean: b.lean * sg, stretch: b.stretch, hot: b.hot });
  ctx.restore();
}
// The card scene (howact.js actor). Stage space: px, y down; S.at(phi, lift) a point on the ring floor (phi 0 = straight
// down, lift > 0 = inside); S.k px per metre; S.th the ring's turn. The groove lies on the floor from just right of the
// egg; the thorn starts at its far end.
//  'harm': it winds up, slides along its groove and runs into the egg: POP!
//  'turn': it winds up and slides for the egg; the hand turns the ring, which carries groove and thorn away while the
//          egg drops through the gap; the thorn lands on its end stop, where the egg was, and wobbles.
export const MOVER_STAGE = { g0: -0.62, a0: 0.02, a1: 0.52 };
export const CREEP_HIT = 1.25; // s into the card's harm beat when the thorn reaches the egg (howto.js breaks it then)
function stageMover(c, S, u, pose) {
  const { k } = S, th = S.th || 0, col = S.col || { dark: '#5a3a20', light: '#d9a46a' };
  const hA = (CREEP.half * 0.75 * k) / S.floor, n = 14, pts = [];
  for (let i = 0; i <= n; i++) { const p = S.at(MOVER_STAGE.a0 - hA + ((MOVER_STAGE.a1 - MOVER_STAGE.a0 + 2 * hA) * i) / n + th, -0.042 * k); pts.push([p.x, p.y]); }
  grooveLine(c, pts, 0.045 * k, col.dark, col.light, 0, 0);
  const p = S.at(u + th, -0.03 * k);
  drawThornIcon(c, p.x, p.y, -(u + th), k, S.t, { lean: S.calm ? 0 : pose.lean, stretch: S.calm ? 1 : pose.stretch, hot: pose.hot, steady: !!S.calm });
}
function actHarm(c, S) {
  const touch = (S.eggS * 0.4 + CREEP.half * S.k) / S.floor, start = MOVER_STAGE.a1, b = beat(S.T, 0.5, CREEP_HIT - 0.5);
  const u = start + (touch - start) * b.f, hit = S.T - CREEP_HIT;
  stageMover(c, { ...S, th: 0 }, u, hit >= 0 ? { lean: -0.12 * Math.exp(-hit * 6) * Math.cos(hit * 40), stretch: 1 + 0.3 * Math.exp(-hit * 9), hot: 0 } : { ...b, lean: -b.lean }); // (it slides toward phi 0: the lean's sign turns with it)
  const p = S.at(touch, S.eggS);
  return { threat: true, bonk: 0, x: p.x, y: p.y, own: true };
}
function actTurn(c, S) {
  const b = beat(S.T, 0.75, 1.75), u = MOVER_STAGE.a1 + (MOVER_STAGE.a0 - MOVER_STAGE.a1) * b.f;
  stageMover(c, S, u, { ...b, lean: -b.lean });
  const p = S.at(MOVER_STAGE.a0 + (S.th || 0), S.eggS);
  return { threat: S.T < 2.2, bonk: 0, x: p.x, y: p.y, own: true };
}
export const moverActor = {
  draw: (c, S) => (S.m === 'harm' ? actHarm(c, S) : actTurn(c, S)),
  stage: (m) => (m === 'harm' ? { g0: 1.2, dTh: 0, pan: -0.1 } : { g0: MOVER_STAGE.g0, dTh: -MOVER_STAGE.g0, hand: [-0.55, 0.1], pan: -0.1 }),
  aim: (S) => S.at(MOVER_STAGE.a1, CREEP.h * S.k),
};
