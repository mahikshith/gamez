// Mama hen, fully animated and code-drawn (V3-PLAN M7). Same face, colours and body as drawHen (characters.js), but
// driven by a small state machine instead of a fixed pose per mood:
//   idle    breathing, head bob, blink, now and then a peck at the straw or a wing ruffle
//   walk    short shuffles (only when the caller gives a `look` target), feet alternate, never leaves its patch
//   worried feathers puff, wings half-raise, head darts, wide eyes, sweat      (mood 'worried' / 'gasp', or danger near)
//   cheer   one-shot: crouch, hop, flap, squash on landing, feather burst        (mood 'happy', re-triggerable)
//   cry     droop, sobs, tears, a wing wipes the eye                             (mood 'cry' / 'sad')
//   dance   win screen: hops, kicks, wings up in turns, notes                    (mood 'dance')
// Every state is a full pose (plain numbers); the weights ease toward the wanted state, the pose is the weighted blend,
// so nothing pops. The one-shot layers (cheer, startle, peck, ruffle) are smooth envelopes that start and end at rest.
// Feet are drawn on the ground line and only ever lift in the air or for a step; the body squashes around them.
// Local space is y-down in a 100-unit box centred on (cx, cy); feet rest at cy + 0.48 h, like drawHen.
import { HEN, henBodyHalf, henWing, drawDrop, symFill, symStroke, outlineW, glint } from './characters.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
const fract = (x) => x - Math.floor(x);
const hash = (n) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
const easeOutBack = (x) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);

export const WALK_RANGE = 22; // units either side of home: the hen never leaves her patch beside the nest
const WALK_SPEED = 26; // units / s
const CHEER_LEN = 1.3;

/* ------------------------------------------------------------------ idle schedule */
// One slot per period; each slot holds at most one event at a hashed moment. Returns u 0..1 inside the event, or -1.
function slot(tt, period, seed, dur, prob) {
  const k = Math.floor(tt / period);
  if (hash(k * 1.7 + seed) > prob) return { u: -1, k };
  const start = hash(k * 3.1 + seed + 9) * (period - dur - 0.3) + 0.15;
  const u = (tt - k * period - start) / dur;
  return { u: u >= 0 && u <= 1 ? u : -1, k };
}
export function henIdleEvents(tt) {
  const b = slot(tt, 3.3, 1, 0.17, 0.92), p = slot(tt, 5.4, 2, 1.15, 0.8), r = slot(tt, 8.7, 3, 0.75, 0.8);
  return { blink: b.u < 0 ? 0 : Math.sin(b.u * Math.PI), peck: p.u, pdir: hash(p.k * 5.3) > 0.5 ? 1 : -1, ruffle: r.u };
}

/* ------------------------------------------------------------------ poses */
const KEYS = ['lift', 'sq', 'lean', 'sway', 'dx', 'hx', 'hy', 'hr', 'comb', 'wL', 'wR', 'wy', 'wsc', 'puff', 'tufts', 'tail',
  'fL', 'fR', 'eWide', 'eHappy', 'eSqueeze', 'brow', 'browY', 'pdx', 'pdy', 'beak', 'tear', 'blush', 'sweat'];
const REST = { lift: 0, sq: 0, lean: 0, sway: 0, dx: 0, hx: 0, hy: 0, hr: 0, comb: 0, wL: -0.12, wR: -0.12, wy: -2, wsc: 1, puff: 1, tufts: 0, tail: 0.25,
  fL: 0, fR: 0, eWide: 0, eHappy: 0, eSqueeze: 0, brow: 0, browY: 0, pdx: 0, pdy: 0, beak: 0, tear: 0, blush: 0.35, sweat: 0 };
const pose = (o) => Object.assign({}, REST, o);

function idlePose(tt) {
  const br = Math.sin(tt * 2.4);
  return pose({ sq: br * 0.018, hx: Math.sin(tt * 1.1) * 0.9, hy: Math.sin(tt * 2.4 + 0.6) * 0.8, hr: Math.sin(tt * 0.9) * 0.025,
    comb: Math.sin(tt * 2.4 - 0.5) * 0.04, wL: -0.12 + br * 0.04, wR: -0.12 + br * 0.04, tail: 0.25 + Math.sin(tt * 3) * 0.05 });
}

// full fright; the blend weight is how scared she is. Darts = the head snaps between look-spots a few times a second
function worryPose(tt) {
  const k = Math.floor(tt * 2.6), f = ss(0, 0.35, fract(tt * 2.6));
  const sx = [-1, 0.8, -0.4, 1, -0.9, 0.3], sy = [0, -1, 0.4, -0.6, 0.2, -1];
  const a = k % 6, b = (k + 1) % 6, dx = lerp(sx[a], sx[b], f), dy = lerp(sy[a], sy[b], f);
  return pose({ sq: 0.02, lift: Math.abs(Math.sin(tt * 15)) * 0.9, dx: Math.sin(tt * 43) * 0.7, hx: dx * 3.4, hy: -2 + dy * 1.5, hr: dx * 0.07, comb: -0.12 + Math.sin(tt * 20) * 0.04,
    wL: -1.05 + Math.sin(tt * 17) * 0.1, wR: -1.05 + Math.sin(tt * 17 + 1) * 0.1, wy: 3, wsc: 0.95, puff: 1.065, tufts: 1, tail: -0.05,
    eWide: 1, brow: 1, pdx: dx * 2.2, pdy: dy * 1.2, beak: 2.7, sweat: 1, blush: 0.3 });
}

function cryPose(tt) {
  const heave = Math.max(0, Math.sin(tt * 8)), wipe = ss(0.55, 0.7, fract(tt / 2.4)) * (1 - ss(0.86, 1, fract(tt / 2.4)));
  return pose({ sq: -0.045 + heave * 0.03, lift: 0, dx: Math.sin(tt * 31) * 0.25, hx: 0, hy: 5 - heave * 1.2, hr: Math.sin(tt * 4) * 0.05, comb: -0.38,
    wL: 0.22 + Math.sin(tt * 9) * 0.04, wR: lerp(0.22, 2.8, wipe) + Math.sin(tt * 16) * 0.07 * wipe, wy: 2, tail: 0.85, eSqueeze: 1, brow: 1, browY: 3, beak: 5.5 + Math.sin(tt * 9) * 1.5, tear: 1, blush: 0.5 });
}

function dancePose(tt) {
  const ph = tt * 2.2, f = fract(ph), air = f < 0.7 ? Math.sin((f / 0.7) * Math.PI) : 0, land = f >= 0.7 ? Math.max(0, 1 - (f - 0.7) / 0.14) : 0;
  const s = Math.sin(ph * Math.PI), sw = Math.sin(ph * TAU) * 0.6;
  return pose({ lift: air * 12, sq: 0.06 * air - 0.1 * land, sway: s * 0.12, dx: s * 3, hx: s * 2, hy: -1, hr: -s * 0.08, comb: -s * 0.2,
    wL: -2.1 + sw, wR: -2.1 - sw, wy: -6, tail: 0.25 + Math.sin(tt * 7) * 0.3, fL: Math.max(0, s) * 6, fR: Math.max(0, -s) * 6,
    eHappy: 1, beak: 4.5, blush: 0.55 });
}

function blendInto(out, p, w) {
  if (w <= 0.0005) return;
  for (const k of KEYS) out[k] += p[k] * w;
}

/* ------------------------------------------------------------------ per-hen state */
const HENS = {}; // key -> state

function fresh(t) {
  return { t, c: 0, w: { worry: 0, cry: 0, dance: 0 }, x: 0, sv: 0, phase: 0, mood: 'idle', n: 0, cheerAt: -9, cheerK: 0, queued: false, startleAt: -9, startleK: 0, worryT: 0, age: 0 };
}
export const resetHen = (key) => { delete HENS[key || 'level']; };

function moodTargets(mood, danger) {
  let worry = 0, cry = 0, dance = 0;
  if (mood === 'gasp') worry = 1;
  else if (mood === 'worried') worry = 0.75;
  else if (mood === 'cry' || mood === 'sad') cry = 1;
  else if (mood === 'dance') dance = 1;
  if (danger > 0.15) worry = Math.max(worry, Math.min(0.6, (danger - 0.15) * 1.3));
  return { worry, cry, dance };
}

/* ------------------------------------------------------------------ the draw */
// h: hen height (px); (cx, cy): centre of its box. mood: 'idle'|'happy'|'dance'|'worried'|'gasp'|'cry'|'sad'.
// o: {key, n (bumps on every game event so a repeated mood retriggers), look (-1..1 walk toward, undefined = stand still),
//     danger (0..1), enter (s since appearing), phase (s offset), shadow (alpha), calm (reduced motion)}
export function drawHenAnim(ctx, mood, cx, cy, h, t = 0, o = {}) {
  if (!(h > 0)) return false;
  const key = o.key || 'level';
  let st = HENS[key];
  if (!st || t < st.t - 0.5 || t - st.t > 0.8) st = HENS[key] = fresh(t);
  const calm = !!o.calm;
  const dt = calm ? 0 : clamp(t - st.t, 0, 0.1);
  st.t = t;
  st.c += dt;
  const tt = calm ? 0 : st.c + (o.phase || 0) * 3;
  if (calm) st.c = 0;

  // ---- events: a new mood or a bumped counter fires the one-shot layers
  const n = o.n || 0, again = n !== st.n || mood !== st.mood;
  const tg = moodTargets(mood, o.danger || 0);
  if (again) {
    if (mood === 'happy') {
      const u = st.c - st.cheerAt;
      if (u > CHEER_LEN * 0.7 || st.cheerAt < -1) { st.cheerAt = st.c - (st.cheerAt < -1 ? 0 : 0.085); st.cheerK++; st.queued = false; } // later hops skip the crouch
      else st.queued = true; // still in the air: fire when it lands
    }
    if ((mood === 'gasp' || mood === 'worried') && st.worryT < 0.3) { st.startleAt = st.c; st.startleK++; }
    st.mood = mood; st.n = n;
  }
  if (st.queued && st.c - st.cheerAt > CHEER_LEN * 0.7) { st.cheerAt = st.c - 0.085; st.cheerK++; st.queued = false; }
  if (calm) { st.cheerAt = -9; st.queued = false; }

  // ---- weights ease toward the wanted state (fast into fear, slow out of tears)
  const ease = (cur, want, tin, tout) => (calm ? want : cur + (want - cur) * (1 - Math.exp(-dt / (want > cur ? tin : tout))));
  st.w.worry = ease(st.w.worry, tg.worry, 0.07, 0.4);
  st.w.cry = ease(st.w.cry, tg.cry, 0.3, 0.55);
  st.w.dance = ease(st.w.dance, tg.dance, 0.22, 0.3);
  st.worryT = st.w.worry;
  const wsum = st.w.worry + st.w.cry + st.w.dance, nrm = wsum > 1 ? 1 / wsum : 1;
  const wW = st.w.worry * nrm, wC = st.w.cry * nrm, wD = st.w.dance * nrm, wI = Math.max(0, 1 - wW - wC - wD);

  const P = {};
  for (const k of KEYS) P[k] = 0;
  blendInto(P, idlePose(tt), wI);
  blendInto(P, worryPose(tt), wW);
  blendInto(P, cryPose(tt), wC);
  blendInto(P, dancePose(tt), wD);

  // ---- walk: ease a position toward the look target, steps follow the speed
  let walkAmt = 0, dir = 0;
  if (o.look !== undefined && !calm) {
    const still = clamp(1 - wW - wC - wD, 0, 1);
    let want = clamp(o.look, -1, 1) * WALK_RANGE;
    if (Math.abs(o.look) < 0.05) { // nothing to follow: a short shuffle now and then
      const w = slot(tt, 7.3, 4, 0.1, 0.55);
      want = hash(w.k * 2.9 + 1) * 2 - 1; want *= WALK_RANGE * 0.5; if (hash(w.k) < 0.35) want = 0;
    }
    if (still < 0.5) want = st.x;
    const v = clamp((want - st.x) * 5, -WALK_SPEED, WALK_SPEED) * still;
    st.sv += (v - st.sv) * (1 - Math.exp(-dt * 9));
    st.x = clamp(st.x + st.sv * dt, -WALK_RANGE * 0.75, WALK_RANGE); // a little less toward the nest, which stands right beside her
    st.phase += Math.abs(st.sv) * dt * 0.42;
    walkAmt = clamp(Math.abs(st.sv) / WALK_SPEED * 1.6, 0, 1);
    dir = Math.sign(st.sv);
  } else st.sv = 0;
  if (walkAmt > 0.001) {
    const sp = Math.sin(st.phase);
    P.fL += walkAmt * 5 * Math.max(0, sp);
    P.fR += walkAmt * 5 * Math.max(0, -sp);
    P.lift += walkAmt * 0.9 * Math.abs(sp);
    P.lean += dir * 0.05 * walkAmt;
    P.hx += dir * 3 * walkAmt;
    P.hy += Math.sin(st.phase * 2 + 1) * 0.9 * walkAmt;
    P.sq += Math.cos(st.phase * 2) * 0.012 * walkAmt;
    P.sway += sp * 0.045 * walkAmt;
    P.tail += -dir * 0.12 * walkAmt;
  }

  // ---- idle one-shots (only while she is at rest)
  let beakPeck = 0;
  if (!calm && wI > 0.001) {
    const ev = henIdleEvents(tt);
    if (ev.peck >= 0) {
      const u = ev.peck, base = Math.sin(u * Math.PI), tap = Math.max(0, Math.sin(u * TAU * 2.2 - 0.6));
      const dip = base * (0.72 + 0.28 * tap);
      P.lean += ev.pdir * 0.22 * dip * wI;
      P.hy += 7 * dip * wI;
      P.hx += ev.pdir * 2.5 * dip * wI;
      P.sq -= 0.05 * dip * wI;
      P.comb += 0.12 * dip * wI;
      beakPeck = tap * base * 2.4 * wI;
      P.pdy += 1.2 * dip * wI;
    }
    if (ev.ruffle >= 0) {
      const u = ev.ruffle, e = Math.sin(u * Math.PI), sh = Math.sin(u * 62) * e;
      P.wL += (-0.7 - -0.12 + sh * 0.14) * e * wI * 1.0;
      P.wR += (-0.7 - -0.12 + sh * 0.14) * e * wI * 1.0;
      P.dx += sh * 0.9 * wI;
      P.sq += 0.03 * e * wI;
      P.tufts += 0.55 * e * wI;
      P.tail += sh * 0.15 * wI;
    }
  }
  const blink = !calm && wC < 0.5 ? henIdleEvents(tt).blink : 0;

  // ---- cheer: crouch, hop, flap, land, small second hop, feather burst
  const cu = calm ? 99 : st.c - st.cheerAt;
  let cheerE = 0, cheerBurst = -1;
  if (cu >= 0 && cu < CHEER_LEN + 0.3) {
    cheerE = ss(0, 0.08, cu) * (1 - ss(0.85, 1.25, cu));
    let lift = 0, sq = 0;
    if (cu < 0.09) sq = -0.08 * (cu / 0.09);
    else if (cu < 0.5) { const a = (cu - 0.09) / 0.41; lift = 15 * Math.sin(a * Math.PI); sq = lerp(-0.08, 0.07, ss(0, 0.25, a)) * (1 - ss(0.7, 1, a)) + 0.04 * Math.sin(a * Math.PI) * (a > 0.5 ? 0 : 1); }
    if (cu >= 0.5) sq -= 0.15 * Math.exp(-(cu - 0.5) / 0.07);
    if (cu >= 0.62 && cu < 0.92) { const a = (cu - 0.62) / 0.3; lift += 6 * Math.sin(a * Math.PI); }
    if (cu >= 0.92) sq -= 0.07 * Math.exp(-(cu - 0.92) / 0.07);
    P.lift += lift;
    P.sq += sq;
    const fl = Math.sin(cu * 34) * 0.38, wing = lerp(P.wL, -2.25 + fl, cheerE);
    P.wL = wing;
    P.wR = lerp(P.wR, -2.25 - fl, cheerE);
    P.wy = lerp(P.wy, -6, cheerE);
    P.eHappy = lerp(P.eHappy, 1, cheerE);
    P.eWide = lerp(P.eWide, 0, cheerE); P.brow = lerp(P.brow, 0, cheerE); P.sweat = lerp(P.sweat, 0, cheerE);
    P.beak = lerp(P.beak, 4.5, cheerE);
    P.blush = lerp(P.blush, 0.55, cheerE);
    P.hy += -2 * cheerE; P.tail = lerp(P.tail, -0.25 + Math.sin(cu * 26) * 0.25, cheerE); P.sway += Math.sin(cu * 9) * 0.06 * cheerE;
    P.comb += Math.sin(cu * 17) * 0.1 * cheerE;
    P.lean *= 1 - cheerE;
    if (cu >= 0.09) cheerBurst = cu - 0.09;
  }

  // ---- startle: a jump and a puff when something goes wrong
  const su = calm ? 99 : st.c - st.startleAt;
  if (su >= 0 && su < 0.5) {
    const a = Math.min(1, su / 0.2), air = su < 0.2 ? Math.sin(a * Math.PI) : 0;
    P.lift += 4.5 * air;
    P.sq += 0.07 * air - 0.07 * Math.exp(-Math.max(0, su - 0.2) / 0.07) * (su >= 0.2 ? 1 : 0);
    P.puff += 0.05 * Math.exp(-su / 0.18);
    P.tufts = Math.max(P.tufts, 1 - ss(0.2, 0.5, su));
  }

  // ---- blink and beak taps feed the face
  const f = { eWide: P.eWide, eHappy: P.eHappy, eSqueeze: P.eSqueeze, brow: P.brow, browY: P.browY, pdx: P.pdx + (o.look || 0) * 0.8, pdy: P.pdy, beak: P.beak + beakPeck, tear: P.tear, blush: P.blush, blink };

  // ---- draw
  ctx.save();
  try {
    ctx.translate(cx, cy);
    ctx.scale(h / 100, h / 100);
    const pop = o.enter != null && o.enter < 0.6 && !calm ? Math.max(0.001, easeOutBack(clamp(o.enter / 0.5, 0, 1))) : 1;
    if (pop !== 1) { ctx.globalAlpha *= clamp(o.enter * 8, 0, 1); ctx.translate(0, 48); ctx.scale(pop, pop); ctx.translate(0, -48); }
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.translate(st.x + P.dx, 0);
    const ol = outlineW(h, 2.8);
    // contact shadow: shrinks and fades as she hops
    if (o.shadow) {
      const k = 1 / (1 + P.lift / 22);
      ctx.fillStyle = `rgba(0,0,0,${(o.shadow * k).toFixed(3)})`;
      ctx.beginPath(); ctx.ellipse(0, 48.5, 36 * k, 7.5 * k, 0, 0, TAU); ctx.fill();
    }
    drawFeet(ctx, P, ol);
    ctx.save();
    ctx.translate(0, 44 - P.lift);
    ctx.rotate(P.lean + P.sway);
    const sy = 1 + P.sq, sx = 1 - 0.7 * P.sq;
    ctx.scale(sx * P.puff, sy * P.puff);
    ctx.translate(0, -44);
    drawTail(ctx, P, ol);
    if (P.tufts > 0.02) drawTufts(ctx, P.tufts, tt, ol);
    drawComb(ctx, P, ol);
    drawBody(ctx, ol);
    ctx.save();
    ctx.translate(P.hx, P.hy);
    ctx.translate(0, -8); ctx.rotate(P.hr); ctx.translate(0, 8);
    drawFace(ctx, f, tt, ol);
    ctx.restore();
    henWing(ctx, -1, P.wx || 26, P.wy, P.wL, P.wsc, ol);
    henWing(ctx, 1, P.wx || 26, P.wy, P.wR, P.wsc, ol);
    if (P.sweat > 0.02) { const k = fract(tt * 0.8); drawDrop(ctx, 27 + P.hx * 0.5, -30 + k * 8 + P.hy * 0.5, 4.5, ol * 0.7, (1 - k * 0.6) * clamp(P.sweat, 0, 1)); }
    ctx.restore();
    if (wD > 0.05) drawNotes(ctx, tt, ol, wD);
    if (cheerBurst >= 0) drawBurst(ctx, cheerBurst, st.cheerK, ol);
    if (st.w.worry > 0.3 && P.tufts > 0.3) drawLoose(ctx, tt, ol, st.w.worry);
  } catch (e) {
    // art must never break the frame
  }
  ctx.restore();
  return true;
}

/* ------------------------------------------------------------------ parts */
function drawFeet(ctx, P, o) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const pass of [0, 1]) {
    ctx.strokeStyle = pass ? HEN.beak : HEN.beakLine;
    ctx.lineWidth = pass ? 3.4 : 3.4 + o * 1.4;
    ctx.beginPath();
    for (const sx of [-1, 1]) {
      const l = P.lift + (sx < 0 ? P.fL : P.fR), x = sx * 10 + (sx < 0 ? -1 : 1) * 0, fy = 48 - l, toe = l > 0.5 ? 1 : 0;
      ctx.moveTo(x, 38 - P.lift);
      ctx.lineTo(x, fy);
      ctx.moveTo(x - 6, fy + 1.5 + toe * 1.5);
      ctx.lineTo(x, fy);
      ctx.lineTo(x + 6, fy + 1.5 + toe * 1.5);
      ctx.moveTo(x, fy);
      ctx.lineTo(x + sx * 1.5, fy + 2.5);
    }
    ctx.stroke();
  }
}

function drawTail(ctx, P, o) {
  ctx.save();
  ctx.translate(26, -8);
  ctx.rotate(P.tail);
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.rotate(-0.55 + i * 0.45);
    ctx.beginPath();
    ctx.ellipse(0, -13, 6.5, 15, 0, 0, TAU);
    ctx.fillStyle = i === 1 ? '#fffaf0' : '#efe2cd';
    ctx.fill();
    ctx.lineWidth = o;
    ctx.strokeStyle = HEN.line;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

// feather tufts poking out of the silhouette when she puffs up
const TUFTS = [[-27, -17, -2.3], [-37, 2, -2.9], [-41, 20, 3.3], [-31, 33, 2.5], [27, -17, -0.85], [37, 2, -0.25], [41, 20, 0.2], [31, 33, 0.7]];
function drawTufts(ctx, k, tt, o) {
  ctx.fillStyle = HEN.bodyMid;
  ctx.strokeStyle = HEN.line;
  ctx.lineWidth = o;
  const L = 4 + 9 * clamp(k, 0, 1.2);
  TUFTS.forEach(([x, y, a], i) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a + Math.sin(tt * 19 + i * 2) * 0.07);
    ctx.beginPath();
    ctx.moveTo(-5, -3.6);
    ctx.quadraticCurveTo(L * 0.5, -4.4, L, 0);
    ctx.quadraticCurveTo(L * 0.5, 4.4, -5, 3.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });
}

function drawComb(ctx, P, o) {
  ctx.save();
  ctx.translate(P.hx * 0.6, -33 + P.hy * 0.35);
  ctx.rotate(P.comb + P.hr * 0.5);
  ctx.beginPath();
  ctx.moveTo(-11, 2);
  ctx.arc(-7, -3, 5.5, Math.PI * 0.85, Math.PI * 1.75);
  ctx.arc(0, -8, 6.5, Math.PI * 1.1, Math.PI * 1.9);
  ctx.arc(7.5, -3, 5.5, Math.PI * 1.25, Math.PI * 2.15);
  ctx.lineTo(9, 4);
  ctx.closePath();
  const cg = ctx.createLinearGradient(0, -15, 0, 4);
  cg.addColorStop(0, HEN.comb);
  cg.addColorStop(1, HEN.combLo);
  ctx.fillStyle = cg;
  ctx.fill();
  ctx.lineWidth = o;
  ctx.strokeStyle = HEN.combLine;
  ctx.stroke();
  ctx.restore();
}

function drawBody(ctx, o) {
  const bg = ctx.createRadialGradient(-9, -14, 4, 0, 6, 52);
  bg.addColorStop(0, '#ffffff');
  bg.addColorStop(0.5, HEN.bodyMid);
  bg.addColorStop(1, HEN.bodyLo);
  symFill(ctx, henBodyHalf, bg);
  ctx.save();
  ctx.beginPath();
  henBodyHalf(ctx, -1);
  ctx.closePath();
  henBodyHalf(ctx, 1);
  ctx.closePath();
  ctx.clip();
  ctx.beginPath();
  ctx.ellipse(0, 22, 22, 19, 0, 0, TAU);
  ctx.fillStyle = 'rgba(255,253,246,0.85)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(160,130,95,0.45)';
  ctx.lineWidth = o * 0.6;
  ctx.beginPath();
  for (const [x, y] of [[-10, 16], [0, 19], [10, 16], [-5, 27], [5, 27]]) {
    ctx.moveTo(x - 4, y);
    ctx.quadraticCurveTo(x, y + 4, x + 4, y);
  }
  ctx.stroke();
  ctx.restore();
  ctx.lineWidth = o;
  ctx.strokeStyle = HEN.line;
  symStroke(ctx, henBodyHalf);
}

function drawFace(ctx, f, tt, o) {
  const ey = -16, bl = f.blink || 0;
  ctx.fillStyle = `rgba(255,120,125,${f.blush})`;
  ctx.beginPath();
  ctx.ellipse(-17, -6, 5, 3.2, 0, 0, TAU);
  ctx.ellipse(17, -6, 5, 3.2, 0, 0, TAU);
  ctx.fill();
  ctx.lineCap = 'round';
  ctx.strokeStyle = HEN.eye;
  const a0 = ctx.globalAlpha;
  // dot eyes (idle)
  const dot = (1 - f.eWide) * (1 - f.eHappy) * (1 - f.eSqueeze);
  if (dot > 0.01) {
    ctx.globalAlpha = a0 * dot;
    for (const sx of [-1, 1]) {
      ctx.fillStyle = HEN.eye;
      ctx.beginPath();
      ctx.ellipse(sx * 10 + f.pdx * 0.5, ey + f.pdy * 0.4, 3.7, 4.7 * (1 - bl * 0.85) + 0.3, 0, 0, TAU);
      ctx.fill();
      if (bl < 0.5) { ctx.fillStyle = '#ffffff'; glint(ctx, sx * 10 + f.pdx * 0.5 - 1.2, ey + f.pdy * 0.4 - 1.6, 1.3); }
    }
  }
  // wide eyes (scared)
  if (f.eWide > 0.01) {
    ctx.globalAlpha = a0 * f.eWide * (1 - f.eHappy) * (1 - f.eSqueeze);
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(sx * 10, ey, 5.6, 6.8 * (1 - bl * 0.8) + 0.2, 0, 0, TAU);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = o * 0.8;
      ctx.stroke();
      if (bl < 0.5) {
        ctx.fillStyle = HEN.eye;
        ctx.beginPath();
        ctx.arc(sx * 10 + f.pdx, ey + 0.5 + f.pdy, 2.7, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        glint(ctx, sx * 10 + f.pdx - 0.9, ey + f.pdy - 0.6, 0.9);
      }
    }
  }
  // happy arcs
  if (f.eHappy > 0.01) {
    ctx.globalAlpha = a0 * f.eHappy;
    ctx.lineWidth = o * 1.3;
    ctx.beginPath();
    for (const sx of [-1, 1]) {
      ctx.moveTo(sx * 10 - 5, ey + 2);
      ctx.quadraticCurveTo(sx * 10, ey - 6, sx * 10 + 5, ey + 2);
    }
    ctx.stroke();
  }
  // squeezed > <
  if (f.eSqueeze > 0.01) {
    ctx.globalAlpha = a0 * f.eSqueeze * (1 - f.eHappy);
    ctx.lineWidth = o * 1.2;
    ctx.beginPath();
    for (const sx of [-1, 1]) {
      ctx.moveTo(sx * 15, ey - 4);
      ctx.lineTo(sx * 7, ey);
      ctx.lineTo(sx * 15, ey + 3);
    }
    ctx.stroke();
  }
  // worried brows
  if (f.brow > 0.01) {
    ctx.globalAlpha = a0 * f.brow * (1 - f.eHappy);
    ctx.lineWidth = o;
    ctx.beginPath();
    for (const sx of [-1, 1]) {
      ctx.moveTo(sx * 5, ey - 13 + f.browY);
      ctx.lineTo(sx * 14, ey - 9 + f.browY);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = a0;
  // tears
  if (f.tear > 0.01) {
    ctx.save();
    ctx.globalAlpha = a0 * f.tear;
    for (const sx of [-1, 1]) {
      ctx.strokeStyle = 'rgba(120,205,255,0.9)';
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(sx * 12, ey + 3);
      ctx.quadraticCurveTo(sx * (17 + Math.sin(tt * 8) * 1.5), ey + 12, sx * 16, ey + 24);
      ctx.stroke();
      for (let i = 0; i < 2; i++) {
        const k = fract(tt * 1.8 + i * 0.5 + (sx > 0 ? 0.25 : 0));
        drawDrop(ctx, sx * (16 + k * 9), ey + 22 + k * 22, 2.6, 1, 1 - k * 0.7);
      }
    }
    ctx.restore();
  }
  // wattle and beak (open is in the same units as drawHen)
  const open = f.beak, op = open > 0.5;
  ctx.beginPath();
  ctx.ellipse(0, (op ? 1 : -1) + open * 1.05, 3.6, 5.2, 0, 0, TAU);
  ctx.fillStyle = HEN.comb;
  ctx.fill();
  ctx.lineWidth = o * 0.8;
  ctx.strokeStyle = HEN.combLine;
  ctx.stroke();
  ctx.strokeStyle = HEN.beakLine;
  if (op) {
    ctx.beginPath();
    ctx.moveTo(-5.5, -8);
    ctx.lineTo(5.5, -8);
    ctx.lineTo(0, -2 + open * 1.4);
    ctx.closePath();
    ctx.fillStyle = '#7a1f1a';
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-4.2, -5 + open * 0.9);
    ctx.quadraticCurveTo(0, -3 + open * 0.9, 4.2, -5 + open * 0.9);
    ctx.lineTo(0, -1 + open * 1.4);
    ctx.closePath();
    ctx.fillStyle = HEN.beakLo;
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-6, -9.5);
  ctx.quadraticCurveTo(0, -13, 6, -9.5);
  ctx.lineTo(0, op ? -5 : -2.5);
  ctx.closePath();
  const bk = ctx.createLinearGradient(0, -12, 0, -3);
  bk.addColorStop(0, HEN.beak);
  bk.addColorStop(1, HEN.beakLo);
  ctx.fillStyle = bk;
  ctx.fill();
  ctx.stroke();
}

function feather(ctx, x, y, rot, len, o, alpha) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, -len / 2);
  ctx.quadraticCurveTo(len * 0.36, 0, 0, len / 2);
  ctx.quadraticCurveTo(-len * 0.36, 0, 0, -len / 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = o * 0.8;
  ctx.strokeStyle = HEN.line;
  ctx.stroke();
  ctx.restore();
}

// feather burst on a catch: deterministic from (time since launch, trigger count), no stored particles
function drawBurst(ctx, u, k, o) {
  if (u > 1) return;
  for (let i = 0; i < 10; i++) {
    const sd = i % 2 ? 1 : -1, a = -Math.PI / 2 + sd * (0.5 + hash(k * 9 + i) * 0.85), sp = 60 + hash(k * 3 + i * 7) * 40; // out and up from the wing tips, clear of the face
    const x = sd * 34 + Math.cos(a) * sp * u * 0.7, y = -14 + Math.sin(a) * sp * u * 0.75 + 80 * u * u;
    feather(ctx, x, y, a + Math.PI / 2 + u * (hash(i + k) > 0.5 ? 4 : -4), 15 + hash(i * 2) * 5, o, 1 - ss(0.5, 1, u));
  }
}

// a couple of loose feathers drifting while she is scared
function drawLoose(ctx, tt, o, w) {
  for (let i = 0; i < 2; i++) {
    const k = fract(tt * 0.7 + i * 0.5);
    feather(ctx, (i ? 36 : -37) + Math.sin(tt * 4 + i) * 4, -14 - k * 26 + k * k * 18, Math.sin(tt * 3 + i * 2) * 0.8, 13, o, (1 - k) * clamp(w, 0, 1));
  }
}

function drawNotes(ctx, tt, o, w) {
  ctx.save();
  ctx.fillStyle = '#ff7a9a';
  ctx.strokeStyle = HEN.line;
  ctx.lineWidth = o * 0.8;
  for (let i = 0; i < 3; i++) {
    const k = fract(tt * 0.6 + i / 3);
    const nx = (i - 1) * 40 + Math.sin(tt * 2 + i) * 4, ny = -44 - k * 30;
    ctx.globalAlpha = Math.sin(k * Math.PI) * w;
    ctx.beginPath();
    ctx.ellipse(nx, ny, 4.5, 3.4, -0.4, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(nx + 3.8, ny - 1);
    ctx.lineTo(nx + 3.8, ny - 14);
    ctx.quadraticCurveTo(nx + 10, ny - 11, nx + 8, ny - 6);
    ctx.stroke();
  }
  ctx.restore();
}
