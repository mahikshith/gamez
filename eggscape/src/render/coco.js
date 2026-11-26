// Coco the monkey in play (0.8.17, level 10): the sim (sim/coco.js) moved onto the artist's rig (render/monkey.js, not
// redrawn here). Every pose is the artist's own (monkeyPose), placed from the point where he grips his ring; the tricks
// the artist did not draw are built from the rig's own numbers: the hand-over-hand crossing pins one hand on each ring
// (a0 / a1), the tail that lifts an egg is the tail's own curl moved onto the egg (tx / ty), and his hang is shortened
// (by) so his head stays off the floor ring. drawCocos draws the peels and him in the creature layer (under the eggs);
// drawCocoOver draws the tail's curl again over an egg he holds and a peel in flight; cocoEvent gives each moment its
// sound and its word.
import { monkeyPose, monkeyBlend, drawMonkey, drawPeel, TOSS_RELEASE } from './monkey.js';
import { COCO } from '../sim/coco.js';

const RING_TH = 0.16;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (a, b, v) => { const u = clamp((v - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
const lerp = (a, b, k) => a + (b - a) * k;
const back = (u, s = 1.6) => { u -= 1; return u * u * ((s + 1) * u + s) + 1; };
const wrap = (a) => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
// 0.8.18: in play Coco is drawn 1.7x the size that fits his channel, from the same grip point on his ring (at 450x1000 he
// was about one egg tall and his face did not read); hanging he reaches over the floor ring, standing over the ceiling ring.
// The rig's floor depth D is counted in the bigger units, so his feet still land on the floor and his hands on the rings;
// what he grabs and what hits him is the sim's and is unchanged.
export const COCO_PLAY = 1.7;
const DM = {}; // per monkey: the pose he froze in, the time he froze
let CALM = false;
export function cocoCalm(on) { CALM = !!on; }

// ---------------------------------------------------------------- the rig's numbers, placed
// metres per 100 rig units: his channel's height is COCO_FIT rig units (the ride's feet just touch the floor)
const COCO_FIT = 92;
export const cocoScale = (gap) => clamp(gap / (COCO_FIT / 100), 0.8, 1.1);
// a point (X, Y) of the anchor's frame (rig units, y down) in pose p's torso frame
function toTorso(p, X, Y) {
  const sx = 1 + p.sq * 0.7, sy = 1 - p.sq, c = Math.cos(p.rot), s = Math.sin(p.rot);
  const x = X / sx - p.dx, y = Y / sy + p.by - p.dy;
  return [x * c + y * s, -x * s + y * c];
}
function fromTorso(p, lx, ly) {
  const sx = 1 + p.sq * 0.7, sy = 1 - p.sq, c = Math.cos(p.rot), s = Math.sin(p.rot);
  return [sx * (p.dx + lx * c - ly * s), sy * (-p.by + p.dy + lx * s + ly * c)];
}
const mix = (A, B, k) => { const o = {}; for (const key in A) o[key] = typeof A[key] === 'number' ? A[key] + ((B[key] ?? A[key]) - A[key]) * k : A[key]; return o; };
// a floor pose (anchor between his feet) seen from the grip, D rig units above the floor
const onFloor = (p, D) => { p.by -= D; return p; };
// the hang, shortened (the artist's tail is long: his head would reach through the floor ring); the curl stays on the ring
function hangPose(t) {
  const p = monkeyPose('hang', t);
  p.by *= 0.62; p.dx *= 0.62;
  const [tx, ty] = toTorso(p, 0, 1); p.tx = tx; p.ty = ty;
  return p;
}
// both hands on the ring, swinging with the ring (rp: the sim's swing phase, so the pump matches the ring's rock)
const ridePose = (rp) => monkeyPose('ride', rp / 4.2);
// the tail's curl moved onto a point (X, Y) of the anchor frame (an egg's narrow top): k 0..1 of the way from where it was
function tailTo(p, X, Y, k, curl = 8) {
  const [tx, ty] = toTorso(p, X, Y);
  p.tx = lerp(p.tx, tx, k); p.ty = lerp(p.ty, ty, k); p.tr = lerp(p.tr, curl, k); p.tc = lerp(p.tc, 1.05, k); p.tb = lerp(p.tb, 6, k);
}
// the hand-over-hand crossing at depth v (0 = both hands on the ceiling ring, 1 = standing on the floor), from the grip's
// frame. fx: where on the floor his far hand holds (rig units along, + = the way he faces). One hand on each ring between.
function crossPose(t, v, D, fx, stretch) {
  const A = ridePose(t * 4.2), B = onFloor(monkeyPose('idle', t), D);
  B.dx += fx * 0.8;
  const M = mix(A, A, 0); M.dx = -4; M.by = -D * 0.54; M.rot = 1.0; M.hr = 0.25; M.look = 0.9; M.looky = 0.6; M.jaw = 0.35; M.teeth = 1; M.smile = 1; M.sq = -0.05 - 0.12 * stretch; M.grip = 1;
  M.f0x = -6; M.f0y = 24; M.f1x = 6; M.f1y = 26; M.tx = -34; M.ty = 8; M.tb = 10; M.tc = 1.3;
  const e1 = ss(0, 0.38, v), e2 = ss(0.62, 1, v);
  const p = e2 > 0 ? mix(M, B, e2) : mix(A, M, e1);
  // the hands: near one on the ceiling ring until late, far one reaches down to the floor ring early
  const ceil = [-21, -1], flo = [fx, D + 1];
  const reach = ss(0.05, 0.34, v), letC = ss(0.66, 0.86, v), letF = ss(0.84, 1, v);
  const farX = lerp(25, flo[0], reach), farY = lerp(-1, flo[1], reach) - Math.sin(reach * Math.PI) * 10;
  if (letF < 1) { const [hx, hy] = toTorso(p, farX, farY); p.a1x = lerp(hx, p.a1x, letF); p.a1y = lerp(hy, p.a1y, letF); }
  if (letC < 1) { const [hx, hy] = toTorso(p, ceil[0], ceil[1] - 4 * Math.sin(letC * Math.PI)); p.a0x = lerp(hx, p.a0x, letC); p.a0y = lerp(hy, p.a0y, letC); }
  p.ab = 1;
  return p;
}

// the pose (in the grip's frame) and how to draw him for the sim's phase
function lookOf(sim, C, t, D, M) {
  const u = C.dur > 0 ? clamp(1 - C.t / C.dur, 0, 1) : 0, o = { eye: undefined, alpha: C.alpha ?? 1, pop: 1, frozen: 0 };
  let p;
  switch (C.ph) {
    case 'in': p = hangPose(t); o.pop = 0.25 + 0.75 * back(ss(0, 0.8, u)); o.alpha *= ss(0, 0.35, u); break;
    case 'hang': p = hangPose(t); if (u > 0.55) { p.look = 0.6; p.brow = 0.8; } break; // a sly look before the trick
    case 'ride': case 'hold': case 'bored': case 'snatch': case 'aim': {
      p = ridePose(C.rp);
      if (C.ph === 'aim') { o.eye = 'lock'; p.happy = 0; p.brow = 0.9; p.smile = 1; p.teeth = 1; p.jaw = 0.25; p.tongue = 1; p.ta = 0.6; }
      if (C.ph === 'snatch') { p.happy = 0; o.eye = 'lock'; p.jaw = 0.4; p.teeth = 1; }
      if (C.ph === 'hold') { const h = Math.abs(Math.sin(t * 9)); p.happy = Math.sin(t * 2.3) > -0.2 ? 1 : 0; p.jaw = 0.55 + 0.3 * h; p.teeth = 1; p.smile = 1; p.tongue = 0; }
      if (C.ph === 'bored') { p.look = 1; p.looky = 0.6; p.smile = 0.2; p.jaw = 0.1; }
      break;
    }
    case 'down': case 'up': {
      const v = C.ph === 'down' ? u : 1 - u, gA = sim.cocoGripA(C), fA = sim.rings[C.ch].body.getAngle() + C.lf;
      const fx = (wrap(fA - gA) * (sim.cocoFloorR(C)) / M) * 100 * (C.face < 0 ? -1 : 1);
      p = crossPose(t, v, D, clamp(fx, -30, 60), clamp(C.cs / Math.max(0.01, sim.cocoM(COCO.crossShake)), 0, 1));
      break;
    }
    case 'slip': {
      const DX = Math.abs(wrap(C.sd - C.sa)) * sim.cocoFloorR(C) / M * 100;
      p = monkeyPose('slipoff', t, u, { dx: DX, drop: D * (C.sv || 1) + (1 - (C.sv || 1)) * 0 });
      if (C.sv < 1) p.dy -= D * (1 - C.sv) * (1 - u); // let go half way down: starts lower
      break;
    }
    case 'out': p = monkeyPose('slipoff', t, clamp(u * 0.8, 0, 0.8), { dx: 150, drop: 260 }); break;
    case 'leap': p = u < 0.45 ? onFloor(monkeyPose('scared', t), D * (1 - u * 0.6)) : ridePose(t * 4.2); break;
    case 'land': p = onFloor(monkeyPose('idle', t), D); break;
    case 'eat': p = onFloor(monkeyPose('eat', t, u), D); break;
    case 'toss': p = onFloor(monkeyPose('toss', t, u), D); break;
    case 'laugh': case 'cheer': p = C.at === 'floor' ? onFloor(monkeyPose('laugh', t), D) : hangPose(t); if (C.at !== 'floor') { p.happy = 1; p.jaw = 0.7; } break;
    case 'dizzy': p = onFloor(monkeyPose('dizzy', t), D); break;
    case 'sulk': p = onFloor(monkeyPose('sulk', t), D); break;
    case 'asleep': p = onFloor(monkeyPose('defeated', t), D); break;
    default: p = hangPose(t);
  }
  return { p, o };
}

// the anchor: his grip point on the ceiling ring (r, a) in world metres
function anchorOf(sim, C) {
  const a = C.ph === 'slip' || C.ph === 'out' ? C.sa : sim.cocoA(C);
  return { a, r: sim.cocoGripR(C) };
}
// draw f in his frame: (0, 0) = the grip point, x along the ring, y DOWN = radially out (toward his floor), px units
function inFrame(ctx, a, r, k, f) {
  ctx.save();
  ctx.translate(r * Math.cos(a), r * Math.sin(a)); ctx.scale(1 / k, -1 / k); ctx.rotate(Math.atan2(-Math.cos(a), -Math.sin(a)));
  try { f(); } catch (e) { /* never break the frame */ }
  ctx.restore();
}
// a world point in that frame (px)
function local(a, r, k, wx, wy) {
  const ox = r * Math.cos(a), oy = r * Math.sin(a), dx = (wx - ox) * k, dy = -(wy - oy) * k, rot = Math.atan2(-Math.cos(a), -Math.sin(a));
  return [dx * Math.cos(rot) + dy * Math.sin(rot), -dx * Math.sin(rot) + dy * Math.cos(rot)];
}
// the narrow top of an egg (world): where his tail's curl holds it
function eggTop(e) { const p = e.body.getPosition(), ang = e.body.getAngle(); return { x: p.x - Math.sin(ang) * 0.17, y: p.y + Math.cos(ang) * 0.17 }; }

function poseNow(sim, C, t, k) {
  const gap = sim.cocoFloorR(C) - sim.cocoGripR(C), M = cocoScale(gap) * COCO_PLAY, D = (gap / M) * 100, s = M * k, u = s / 100, face = C.face < 0 ? -1 : 1;
  const D0 = DM[C.id] || (DM[C.id] = { ph: '', t0: 0, frz: null, ft: 0 });
  const { a, r } = anchorOf(sim, C);
  if (C.ph === 'frozen') {
    if (!D0.frz) { D0.frz = { ...(monkeyBlend('coco' + C.id, lookOf(sim, { ...C, ph: C.at === 'floor' ? 'sulk' : 'hang' }, t, D, M).p, t)) }; D0.ft = t; }
    return { p: D0.frz, o: { frozen: 1, alpha: 1, pop: 1 }, a, r, s, u, face, D, tt: D0.ft };
  }
  D0.frz = null;
  const L = lookOf(sim, C, t, D, M);
  const egg = C.eid ? sim.cocoEgg(C.eid) : C.ph === 'aim' ? sim.cocoEgg(C.tgt) : null;
  const fast = C.ph === 'slip' || C.ph === 'out' || C.ph === 'down' || C.ph === 'up' || C.ph === 'leap' ? 28 : 11;
  const p = { ...monkeyBlend('coco' + C.id, L.p, t, fast) };
  if (egg && (C.ph === 'snatch' || C.ph === 'hold' || C.ph === 'bored' || C.ph === 'aim')) {
    const top = eggTop(egg), [lx, ly] = local(a, r, k, top.x, top.y), uu = C.dur > 0 ? clamp(1 - C.t / C.dur, 0, 1) : 0;
    let X = (lx / u) * face, Y = ly / u;
    if (C.ph === 'aim') { const w = CALM ? 0 : Math.sin(t * 11); X += 6 * w; Y -= 14 + 4 * Math.abs(w) - 8 * ss(0.6, 1, uu); } // the curl hovers over its top, wiggling: about to grab
    const kk = C.ph === 'aim' ? ss(0, 0.45, uu) : C.ph === 'snatch' ? 1 : C.ph === 'bored' ? 1 - ss(0.3, 1, uu) : 1;
    tailTo(p, X, Y, kk);
  }
  return { p, o: L.o, a, r, s, u, face, D, tt: t };
}

// ---------------------------------------------------------------- the peels on the floors (and in flight, over the eggs)
function drawPeels(ctx, sim, t, k, flying) {
  for (const P of sim.peels || []) {
    if ((P.ph === 'fly') !== flying) continue;
    const ring = sim.rings[P.ch]; if (!ring) continue;
    const rF = ring.r - RING_TH / 2, gap = rF - (sim.rings[P.ch - 1].r + RING_TH / 2), s = cocoScale(gap) * k * 0.95, a0 = sim.cocoPeelA(P), th = sim.cocoTheta(a0);
    // carried up the side, it slides back down the floor as it fades (gravity: ease in)
    const a = P.ph === 'drop' && Math.abs(th) > COCO.peelTh - 0.1 ? a0 - (Math.sign(th) * 2.2 * P.t * P.t) / rF : a0;
    if (P.ph === 'fly') { // from his hand along a little arc to where it lands, spinning
      const u = clamp(P.t / COCO.fly, 0, 1), e = ss(0, 1, u), aL = a, x1 = rF * Math.cos(aL), y1 = rF * Math.sin(aL);
      const x = lerp(P.x0, x1, e), y = lerp(P.y0, y1, e), lift = Math.sin(u * Math.PI) * 0.45, d = Math.hypot(x, y) || 1, ux = x / d, uy = y / d;
      const fa = Math.atan2(y - uy * lift, x - ux * lift);
      inFrame(ctx, fa, d - lift, k, () => drawPeel(ctx, 0, 0, s, t, { air: 1 - ss(0.8, 1, u), rot: CALM ? 0 : u * 9 * P.face, face: P.face }));
      continue;
    }
    let al = 1, sl = 0, sink = 0;
    if (P.ph === 'slip') sl = clamp(P.t / 0.7, 0, 1);
    if (P.ph === 'burn' || P.ph === 'old') al = 1 - clamp(P.t / 0.7, 0, 1);
    if (P.ph === 'drop') { al = 1 - clamp(P.t / 0.7, 0, 1); sink = a === a0 ? P.t * 0.6 : 0; sl = a === a0 ? 0 : clamp(P.t / 0.5, 0, 1); }
    if (P.ph === 'lie' && P.t < 0.25) sl = 0; // (it has just landed)
    inFrame(ctx, a, rF + sink, k, () => {
      ctx.globalAlpha *= al;
      if (P.ph === 'burn') { ctx.filter = 'none'; ctx.globalAlpha *= 0.9; }
      drawPeel(ctx, 0, 0, s, t, { slip: sl, face: P.face, frozen: 0 });
      if (P.ph === 'burn') { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = `rgba(60,30,10,${0.7 * clamp(P.t / 0.3, 0, 1)})`; ctx.fillRect(-s * 0.4, -s * 0.4, s * 0.8, s * 0.5); }
    });
  }
}

export function drawCocos(ctx, sim, t, k) {
  if (!sim.cocos || !sim.cocos.length) return;
  drawPeels(ctx, sim, t, k, false);
  for (const C of sim.cocos) {
    if (C.ph === 'wait' || C.ph === 'away' || C.ph === 'gone') continue;
    const N = poseNow(sim, C, t, k);
    inFrame(ctx, N.a, N.r, k, () => {
      ctx.globalAlpha *= clamp(N.o.alpha, 0, 1);
      if (N.o.pop !== 1) ctx.scale(N.o.pop, N.o.pop);
      drawMonkey(ctx, 0, 0, N.s, N.tt, N.p, { face: N.face, eye: N.o.eye, frozen: N.o.frozen });
      if (N.o.frozen) frost(ctx, N, t);
    });
  }
}
// a frozen monkey: a pale glaze and two glints over the rig's own icy colours
function frost(ctx, N, t) {
  const [cx, cy] = fromTorso(N.p, 0, -8), x = cx * N.u * N.face, y = cy * N.u, R = 46 * N.u;
  ctx.save(); ctx.globalAlpha *= 0.28; ctx.fillStyle = '#dff4ff'; ctx.beginPath(); ctx.ellipse(x, y, R * 0.8, R, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = Math.max(1.2, 3 * N.u); ctx.lineCap = 'round';
  for (const [gx, gy] of [[-0.35, -0.5], [0.3, 0.1]]) { const q = CALM ? 1 : 0.6 + 0.4 * Math.sin(t * 3 + gx * 9); ctx.globalAlpha = q; ctx.beginPath(); ctx.moveTo(x + gx * R - 5 * N.u, y + gy * R); ctx.lineTo(x + gx * R + 5 * N.u, y + gy * R); ctx.moveTo(x + gx * R, y + gy * R - 5 * N.u); ctx.lineTo(x + gx * R, y + gy * R + 5 * N.u); ctx.stroke(); }
  ctx.restore();
}
// over the eggs: his tail's curl round the egg he holds (the egg itself is drawn between), and a peel in flight
export function drawCocoOver(ctx, sim, t, k) {
  if (!sim.cocos || !sim.cocos.length) return;
  for (const C of sim.cocos) {
    if (!(C.eid && (C.ph === 'snatch' || C.ph === 'hold' || C.ph === 'bored')) && !(C.ph === 'aim' && C.tgt)) continue;
    const N = poseNow(sim, C, t, k);
    inFrame(ctx, N.a, N.r, k, () => {
      const [cx, cy] = fromTorso(N.p, N.p.tx, N.p.ty), x = cx * N.u * N.face, y = cy * N.u;
      ctx.beginPath(); ctx.arc(x, y, (N.p.tr + 7) * N.u, 0, Math.PI * 2); ctx.clip();
      drawMonkey(ctx, 0, 0, N.s, N.tt, N.p, { face: N.face, eye: N.o.eye });
    });
  }
  drawPeels(ctx, sim, t, k, true);
}

// ---------------------------------------------------------------- sounds, puffs and words (main.js passes popup, audio)
export function cocoEvent(ev, fx, api) {
  const { popup, audio } = api;
  switch (ev.type) {
    case 'cocoIn': audio.play('gecko_chirp', { vol: 0.5, pitch: 1.5 }); audio.play('flap', { vol: 0.35, pitch: 1.6 }); fx.dust?.(ev.x, ev.y, 5, 'rgba(120,170,80,0.8)'); break; // a rustle of leaves and a chatter
    case 'cocoRide': audio.play('grab', { vol: 0.45, pitch: 1.3 }); audio.play('gecko_chirp', { vol: 0.35, pitch: 1.7 }); break;
    case 'cocoAim': audio.play('gecko_chirp', { vol: 0.5, pitch: 1.9 }); break;
    case 'cocoSnatch': audio.play('tongue_lick', { vol: 0.45, pitch: 1.4 }); break;
    case 'cocoGrab': audio.play('grab', { vol: 0.5, pitch: 1.5 }); popup(ev.x, ev.y + 0.6, 'Gotcha!', { color: '#ffd96a', size: 18, life: 1.0 }); break;
    case 'cocoCross': audio.play('grab', { vol: 0.3, pitch: ev.dir > 0 ? 1.2 : 1.5 }); break;
    case 'cocoEat': audio.play('squish', { vol: 0.35, pitch: 1.6, intensity: 0.2 }); break;
    case 'cocoThrow': audio.play('wind_gust', { vol: 0.3, pitch: 2.1 }); break;
    case 'cocoPeel': audio.play('squish', { vol: 0.45, pitch: 1.2, intensity: 0.3 }); break;
    case 'cocoLaugh': audio.play('gecko_chirp', { vol: 0.55, pitch: 1.35 }); break;
    case 'cocoPeelSlip': audio.play('wind_gust', { vol: 0.45, pitch: 1.9 }); audio.play('squish', { vol: 0.45, pitch: 0.9, intensity: 0.4 }); popup(ev.x, ev.y + 0.55, 'Whee!', { color: '#ffe27a', size: 18, life: 1.0 }); break;
    case 'cocoPeelBurn': audio.play('fire_burn', { vol: 0.5, pitch: 1.3 }); fx.smoke?.(ev.x, ev.y, 4); popup(ev.x, ev.y + 0.5, 'Sizzle!', { color: '#ffb36a', size: 16, life: 0.9 }); break;
    case 'cocoPeelGone': if (ev.drop) audio.play('release', { vol: 0.3, pitch: 1.4 }); break;
    case 'cocoSlip': if (ev.why === 'end') break; audio.play('wind_gust', { vol: 0.5, pitch: 1.5 }); audio.play('gecko_chirp', { vol: 0.6, pitch: 1.0 }); popup(ev.x, ev.y + 0.6, 'Whoa!', { color: '#ffe27a', size: 20, life: 1.0 }); break;
    case 'cocoLand': audio.play('egg_land', { vol: 0.4, pitch: 1.2 }); audio.play('stun_stars', { vol: 0.55, pitch: 1.35 }); fx.dust?.(ev.x, ev.y, 5); break;
    case 'cocoSulk': audio.play('cluck', { vol: 0.25, pitch: 0.7 }); break;
    case 'cocoLeap': audio.play('hen_hop', { vol: 0.4, pitch: 1.6 }); break;
    case 'cocoDrop': if (ev.why !== 'end' && ev.why !== 'slip') audio.play('release', { vol: 0.35, pitch: 1.3 }); break;
    case 'cocoThaw': audio.play('glass_crack', { vol: 0.3, pitch: 1.6 }); break;
    case 'cocoHit':
      if (ev.kind === 'ice') audio.play('frost_lick', { vol: 0.5, pitch: 1.2 });
      else if (ev.kind === 'pepper') { audio.play('wind_gust', { vol: 0.45, pitch: 2.2 }); popup(ev.x, ev.y + 0.6, 'Ah-CHOO!', { color: '#ffd0a0', size: 18, life: 1.0 }); }
      else if (ev.kind === 'scare' || ev.kind === 'out') audio.play('flap', { vol: 0.5, pitch: 1.3 });
      else audio.play('stun_stars', { vol: 0.6, pitch: 1.3 });
      break;
  }
}

// ---------------------------------------------------------------- the level card (howto.js, through howact.js ACTORS.monkey)
// Coco sits on the ring beside the egg with his tail curled round it (it is his now), grinning. The hand flicks the ring:
// he loses his seat, flails off and tumbles away; the gap the flick brought round drops the egg into the basket.
// S: howact.js's stage (at(phi, lift), k px per metre, floor, eggS, th, T, t, m, calm). Returns what the stage needs.
const G0 = 0.4; // the gap starts right of the egg; the flick turns the ring -0.4 and brings it under the egg
export const cocoActor = {
  stage: () => ({ g0: G0, dTh: -G0, hand: [0.45, 0.05], pan: -0.05 }),
  aim: (S) => S.at(-0.32, 0.4 * S.k),
  draw(ctx, S) {
    const { T, t, k } = S, M = 1.3, s = M * k, u = s / 100, D = COCO_FIT; // (bigger than the egg, as in play)
    const flick = S.m === 'turn' ? ss(1.45, 1.7, T) : 0, off = T >= 1.62 && S.m === 'turn', fu = off ? clamp((T - 1.62) / 1.1, 0, 1) : 0;
    const seat = -0.4 + 0.08 * (1 - ss(0.2, 1.1, T)) + (S.m === 'turn' ? S.th * (1 - ss(1.62, 1.7, T)) : 0); // he rides the ring until his grip goes
    const phi = off ? -0.42 : seat, p0 = S.at(phi, 0), ang = -phi; // the floor point under him, the ring's slope there
    let p;
    if (!off) { p = monkeyPose(T < 0.6 ? 'idle' : 'laugh', t); if (T < 0.6) { p.look = 1; } }
    else { p = monkeyPose('slipoff', t, 0.16 + fu * 0.84, { dx: -170, drop: 260 }); p.by += D; } // (the slip-off hangs from a grip: lifted to his seat)
    // the egg: on the floor at the stage's egg angle (0); his tail's curl round its top while he has it
    const e = S.at(0.035, S.eggS * 1.42); // (just over its top: the curl reads in front of the egg)
    ctx.save(); ctx.translate(p0.x, p0.y); ctx.rotate(ang);
    const face = 1;
    if (!off) {
      const ex = (e.x - p0.x) * Math.cos(-ang) - (e.y - p0.y) * Math.sin(-ang), ey = (e.x - p0.x) * Math.sin(-ang) + (e.y - p0.y) * Math.cos(-ang);
      const kk = ss(0.25, 0.9, T) * (1 - flick * 0.85);
      tailTo(p, ex / u, ey / u, kk, 11);
      if (T > 0.6) { p.happy = 1; }
    }
    ctx.globalAlpha *= off ? 1 - ss(0.7, 1, fu) : 1;
    drawMonkey(ctx, 0, 0, s, t, p, { face, eye: off && fu > 0.5 ? 'spiral' : undefined });
    ctx.restore();
    if (off && fu < 0.55) { // the word, at his head
      const q = fu / 0.55;
      ctx.save(); ctx.globalAlpha *= 1 - ss(0.6, 1, q); ctx.font = `900 ${Math.round(S.eggS * 0.5 * (1 + 0.25 * (1 - ss(0, 0.2, q))))}px system-ui, sans-serif`; ctx.textAlign = 'center';
      const w = { x: p0.x + S.eggS * 0.7, y: p0.y - S.eggS * 1.9 - q * S.eggS * 0.3 };
      ctx.lineWidth = Math.max(3, S.eggS * 0.12); ctx.strokeStyle = '#7a3a10'; ctx.lineJoin = 'round'; ctx.strokeText('Whoa!', w.x, w.y); ctx.fillStyle = '#ffe27a'; ctx.fillText('Whoa!', w.x, w.y);
      ctx.restore();
    }
    void D; void TOSS_RELEASE;
    return { threat: !off, bonk: 0, x: p0.x, y: p0.y - S.eggS * 1.6 };
  },
};
