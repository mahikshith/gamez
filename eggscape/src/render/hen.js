// Mama hen, fully animated and code-drawn (V3-PLAN M7), in the farm family's style (allies.js: the rooster and the
// goose). Side-on body facing +x with a three-quarter head (both eyes show, so her face can act), cel-shaded: one
// warm-brown outline (thick around the whole silhouette, thinner inside), a light fill lit from the back-top and a
// hard tan shadow crescent on the lower front, layered scalloped feathers, the rooster's comb, beak and leg recipe.
// Driven by a small state machine instead of a fixed pose per mood:
//   idle    breathing, head bob, blink, now and then a peck at the straw or a wing ruffle
//   walk    short shuffles (only when the caller gives a `look` target): she turns to face where she goes, never
//           leaves her patch, and turns back toward the nest when she stops
//   worried feathers puff, both wings half-raise, head darts, wide eyes, sweat  (mood 'worried' / 'gasp', or danger near)
//   cheer   one-shot: crouch, hop, flap, squash on landing, feather burst        (mood 'happy', re-triggerable)
//   cry     droop, sobs, tears, a wing wipes the eye                             (mood 'cry' / 'sad')
//   dance   win screen: hops, kicks, wings up in turns, notes                    (mood 'dance')
// Every state is a full pose (plain numbers); the weights ease toward the wanted state, the pose is the weighted blend,
// so nothing pops. The one-shot layers (cheer, startle, peck, ruffle) are smooth envelopes that start and end at rest.
// Local space is y-down in a 100-unit box centred on (cx, cy); feet rest at cy + 0.48 h. She faces o.face (-1 = left,
// toward the nest she stands beside; the default) and turns while she walks.
import { drawDrop } from './characters.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
const fract = (x) => x - Math.floor(x);
const hash = (n) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
const easeOutBack = (x) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);
const outlineW = (s, base = 2.8) => Math.max(base, 110 / s); // the rooster's: 2.8 % of the box, never under 1.1 px

export const WALK_RANGE = 22; // units either side of home: the hen never leaves her patch beside the nest
const WALK_SPEED = 26; // units / s
const CHEER_LEN = 1.3;

// one farm: the rooster's line, reds and beak (allies.js), the hen's own cream and tan
const LINE = '#6b4a2a';
const RED = { hi: '#f0402f', lo: '#b81f17', line: '#7a1810' };
const BEAK = { hi: '#ffc247', lo: '#e57d12', line: '#8a4a0a' };
const LEG = { hi: '#ffb83a', lo: '#e08a1c', far: '#d77f17', line: '#8a4a0a' };
const EYE = '#2a1d14';
const HEN = {
  hi: '#fffdf7', mid: '#fbf0dc', lo: '#efdcba', // body fill, lit from the back-top
  shade: '#ddbf8f', // the hard cel crescent (tan)
  scal: 'rgba(150,104,58,0.55)', // feather scallops
  wing: ['#fffaf0', '#f1e1c3'], wingLo: '#d6b583',
  far: ['#e6d3b0', '#cfb084'], tail: ['#fbf1de', '#e9d4ad'], tailLo: '#cfab76',
};

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
// wa / wf: near / far wing raise (rad from folded; ~1.5 up-and-back, ~2.4 up-and-forward), sp: feather spread 0..1.
// tail: tail fan tilt, tsp: its spread. fL / fR: foot lift, sL / sR: foot stride (units forward). hx, hy, hr: head.
const KEYS = ['lift', 'sq', 'lean', 'sway', 'dx', 'hx', 'hy', 'hr', 'comb', 'wa', 'wf', 'sp', 'puff', 'tufts', 'tail', 'tsp',
  'fL', 'fR', 'sL', 'sR', 'eWide', 'eHappy', 'eSqueeze', 'brow', 'browY', 'pdx', 'pdy', 'beak', 'tear', 'blush', 'sweat'];
const REST = { lift: 0, sq: 0, lean: 0, sway: 0, dx: 0, hx: 0, hy: 0, hr: 0, comb: 0, wa: 0, wf: 0, sp: 0, puff: 1, tufts: 0, tail: 0, tsp: 0,
  fL: 0, fR: 0, sL: 0, sR: 0, eWide: 0, eHappy: 0, eSqueeze: 0, brow: 0, browY: 0, pdx: 0, pdy: 0, beak: 0, tear: 0, blush: 0.3, sweat: 0 };
const pose = (o) => Object.assign({}, REST, o);

function idlePose(tt) {
  const br = Math.sin(tt * 2.4);
  return pose({ sq: br * 0.018, hx: Math.sin(tt * 1.1) * 0.9, hy: Math.sin(tt * 2.4 + 0.6) * 0.8, hr: Math.sin(tt * 0.9) * 0.03,
    comb: Math.sin(tt * 2.4 - 0.5) * 0.04, wa: br * 0.03, tail: Math.sin(tt * 3) * 0.04 });
}

// full fright; the blend weight is how scared she is. Darts = the head snaps between look-spots a few times a second
function worryPose(tt) {
  const k = Math.floor(tt * 2.6), f = ss(0, 0.35, fract(tt * 2.6));
  const sx = [-1, 0.8, -0.4, 1, -0.9, 0.3], sy = [0, -1, 0.4, -0.6, 0.2, -1];
  const a = k % 6, b = (k + 1) % 6, dx = lerp(sx[a], sx[b], f), dy = lerp(sy[a], sy[b], f);
  return pose({ sq: 0.03, lift: Math.abs(Math.sin(tt * 15)) * 0.9, dx: Math.sin(tt * 43) * 0.7, hx: -2 + dx * 2.5, hy: -4 + dy * 1.5, hr: -0.08 + dx * 0.1, comb: -0.12 + Math.sin(tt * 20) * 0.05,
    wa: 1.05 + Math.sin(tt * 17) * 0.12, wf: 1.15 + Math.sin(tt * 17 + 1) * 0.12, sp: 0.55, puff: 1.06, tufts: 1, tail: 0.12, tsp: 0.6,
    eWide: 1, brow: 1, pdx: dx * 1.4, pdy: dy * 1.0, beak: 2.6, sweat: 1, blush: 0.25 });
}

function cryPose(tt) {
  const heave = Math.max(0, Math.sin(tt * 8)), wipe = ss(0.55, 0.7, fract(tt / 2.4)) * (1 - ss(0.86, 1, fract(tt / 2.4)));
  return pose({ sq: -0.045 + heave * 0.03, dx: Math.sin(tt * 31) * 0.25, hx: 1, hy: 5 - heave * 1.4, hr: 0.16 + Math.sin(tt * 4) * 0.05, comb: 0.3,
    wa: lerp(-0.18, 2.68, wipe) + Math.sin(tt * 16) * 0.07 * wipe, wf: -0.1, sp: 0.15 * wipe, tail: -0.35, tsp: -0.3, eSqueeze: 1, brow: 1, browY: 1.5,
    beak: 4.5 + Math.sin(tt * 9) * 1.4, tear: 1, blush: 0.45 });
}

function dancePose(tt) {
  const ph = tt * 2.2, f = fract(ph), air = f < 0.7 ? Math.sin((f / 0.7) * Math.PI) : 0, land = f >= 0.7 ? Math.max(0, 1 - (f - 0.7) / 0.14) : 0;
  const s = Math.sin(ph * Math.PI), sw = Math.sin(ph * TAU) * 0.45;
  return pose({ lift: air * 12, sq: 0.06 * air - 0.1 * land, sway: s * 0.1, dx: s * 3, hx: s * 2, hy: -2, hr: -0.1 - s * 0.1, comb: -s * 0.2,
    wa: 1.5 + sw, wf: 1.45 - sw, sp: 0.85, tail: Math.sin(tt * 7) * 0.2, tsp: 0.5, fL: Math.max(0, s) * 6, fR: Math.max(0, -s) * 6, sL: Math.max(0, s) * 5, sR: Math.max(0, -s) * 5,
    eHappy: 1, beak: 4.5, blush: 0.5 });
}

function blendInto(out, p, w) {
  if (w <= 0.0005) return;
  for (const k of KEYS) out[k] += p[k] * w;
}

/* ------------------------------------------------------------------ per-hen state */
const HENS = {}; // key -> state

function fresh(t, face) {
  return { t, c: 0, w: { worry: 0, cry: 0, dance: 0 }, x: 0, sv: 0, phase: 0, mood: 'idle', n: 0, cheerAt: -9, cheerK: 0, queued: false, startleAt: -9, startleK: 0, worryT: 0, face, faceT: face };
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
//     danger (0..1), enter (s since appearing), phase (s offset), shadow (alpha), calm (reduced motion),
//     face (-1 faces left, the default; 1 faces right)}
export function drawHenAnim(ctx, mood, cx, cy, h, t = 0, o = {}) {
  if (!(h > 0)) return false;
  const key = o.key || 'level', home = o.face === 1 ? 1 : -1;
  let st = HENS[key];
  if (!st || t < st.t - 0.5 || t - st.t > 0.8) st = HENS[key] = fresh(t, home);
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

  // ---- walk: ease a position toward the look target, steps follow the speed; she turns to face the way she goes
  let walkAmt = 0;
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
  } else st.sv = 0;
  // facing: the way she walks, else home (toward the nest); a quick squash-turn, never a pop
  st.faceT = Math.abs(st.sv) > 3 ? Math.sign(st.sv) : home;
  st.face = calm ? st.faceT : st.face + (st.faceT - st.face) * (1 - Math.exp(-dt / 0.045));
  if (walkAmt > 0.001) {
    const sp = Math.sin(st.phase), cp = Math.cos(st.phase);
    P.fL += walkAmt * 5 * Math.max(0, sp);
    P.fR += walkAmt * 5 * Math.max(0, -sp);
    P.sL += walkAmt * 6 * cp;
    P.sR -= walkAmt * 6 * cp;
    P.lift += walkAmt * 0.9 * Math.abs(sp);
    P.lean += 0.07 * walkAmt;
    P.hx += 3 * walkAmt + Math.sin(st.phase * 2 + 1) * 2.2 * walkAmt; // the hen's head-bob
    P.hy += Math.sin(st.phase * 2 + 1) * 0.8 * walkAmt;
    P.sq += Math.cos(st.phase * 2) * 0.012 * walkAmt;
    P.sway += sp * 0.03 * walkAmt;
    P.tail += -0.1 * walkAmt;
  }

  // ---- idle one-shots (only while she is at rest)
  let beakPeck = 0;
  if (!calm && wI > 0.001) {
    const ev = henIdleEvents(tt);
    if (ev.peck >= 0) {
      const u = ev.peck, base = Math.sin(u * Math.PI), tap = Math.max(0, Math.sin(u * TAU * 2.2 - 0.6));
      const dip = base * (0.72 + 0.28 * tap) * wI;
      P.lean += 0.3 * dip;
      P.hy += 7 * dip;
      P.hx += 5 * dip;
      P.hr += 0.55 * dip;
      P.sq -= 0.04 * dip;
      P.comb += 0.12 * dip;
      P.tail -= 0.25 * dip;
      beakPeck = tap * base * 2.4 * wI;
      P.pdy += 1 * dip;
    }
    if (ev.ruffle >= 0) {
      const u = ev.ruffle, e = Math.sin(u * Math.PI), sh = Math.sin(u * 62) * e;
      P.wa += (0.55 + sh * 0.15) * e * wI;
      P.wf += (0.5 - sh * 0.15) * e * wI;
      P.sp += 0.35 * e * wI;
      P.dx += sh * 0.9 * wI;
      P.sq += 0.03 * e * wI;
      P.tufts += 0.55 * e * wI;
      P.tail += sh * 0.15 * wI;
      P.tsp += 0.4 * e * wI;
    }
  }
  const blink = !calm && wC < 0.5 ? henIdleEvents(tt).blink : 0;

  // ---- cheer: crouch, hop, flap, land, small second hop, feather burst
  const cu = calm ? 99 : st.c - st.cheerAt;
  let cheerBurst = -1;
  if (cu >= 0 && cu < CHEER_LEN + 0.3) {
    const cheerE = ss(0, 0.08, cu) * (1 - ss(0.85, 1.25, cu));
    let lift = 0, sq = 0;
    if (cu < 0.09) sq = -0.08 * (cu / 0.09);
    else if (cu < 0.5) { const a = (cu - 0.09) / 0.41; lift = 15 * Math.sin(a * Math.PI); sq = lerp(-0.08, 0.07, ss(0, 0.25, a)) * (1 - ss(0.7, 1, a)) + 0.04 * Math.sin(a * Math.PI) * (a > 0.5 ? 0 : 1); }
    if (cu >= 0.5) sq -= 0.15 * Math.exp(-(cu - 0.5) / 0.07);
    if (cu >= 0.62 && cu < 0.92) { const a = (cu - 0.62) / 0.3; lift += 6 * Math.sin(a * Math.PI); }
    if (cu >= 0.92) sq -= 0.07 * Math.exp(-(cu - 0.92) / 0.07);
    P.lift += lift;
    P.sq += sq;
    const fl = Math.sin(cu * 34) * 0.5;
    P.wa = lerp(P.wa, 1.45 + fl, cheerE);
    P.wf = lerp(P.wf, 1.35 + fl, cheerE);
    P.sp = lerp(P.sp, 1, cheerE);
    P.eHappy = lerp(P.eHappy, 1, cheerE);
    P.eWide = lerp(P.eWide, 0, cheerE); P.brow = lerp(P.brow, 0, cheerE); P.sweat = lerp(P.sweat, 0, cheerE);
    P.beak = lerp(P.beak, 4.5, cheerE);
    P.blush = lerp(P.blush, 0.5, cheerE);
    P.hy += -2 * cheerE; P.hr = lerp(P.hr, -0.15, cheerE);
    P.tail = lerp(P.tail, 0.15 + Math.sin(cu * 26) * 0.18, cheerE); P.tsp = lerp(P.tsp, 0.8, cheerE); P.sway += Math.sin(cu * 9) * 0.05 * cheerE;
    P.comb += Math.sin(cu * 17) * 0.1 * cheerE;
    P.fL = lerp(P.fL, lift * 0.25, cheerE); P.fR = lerp(P.fR, lift * 0.2, cheerE); // toes tuck in the air
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

  // ---- blink, look and beak taps feed the face. look is on screen (-1 = left): in her frame that is * facing
  const fs = st.face >= 0 ? 1 : -1;
  const f = { eWide: P.eWide, eHappy: P.eHappy, eSqueeze: P.eSqueeze, brow: P.brow, browY: P.browY, pdx: P.pdx + (o.look || 0) * 0.8 * fs, pdy: P.pdy, beak: P.beak + beakPeck, tear: P.tear, blush: P.blush, blink };

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
    const ol = outlineW(h);
    // contact shadow: shrinks and fades as she hops
    if (o.shadow) {
      const k = 1 / (1 + P.lift / 22);
      ctx.fillStyle = `rgba(0,0,0,${(o.shadow * k).toFixed(3)})`;
      ctx.beginPath(); ctx.ellipse(-2 * fs, 48.5, 34 * k, 7 * k, 0, 0, TAU); ctx.fill();
    }
    ctx.save();
    ctx.scale(fs * Math.max(0.1, Math.abs(st.face)), 1); // her own frame faces +x
    drawLegs(ctx, P, ol);
    ctx.save();
    ctx.translate(0, 44 - P.lift);
    ctx.rotate(P.lean + P.sway);
    const sy = 1 + P.sq, sx = 1 - 0.7 * P.sq;
    ctx.scale(sx * P.puff, sy * P.puff);
    ctx.translate(0, -44);
    const H = { x: 21 + P.hx, y: -25 + P.hy };
    wing(ctx, ol, 9, -6, P.wf - 0.12, P.sp, true); // far wing: behind the body, darker (hidden while folded)
    drawTail(ctx, P, ol);
    if (P.tufts > 0.02) drawTufts(ctx, P.tufts, tt, ol);
    drawBody(ctx, H, ol);
    drawHead(ctx, H, P, f, tt, ol);
    wing(ctx, ol, 1, -1, P.wa, P.sp, false); // near wing, over the body (and over her eye when she wipes it)
    if (P.sweat > 0.02) { const k = fract(tt * 0.8); drawDrop(ctx, H.x - 15, H.y - 8 + k * 9, 3.6, ol * 0.7, (1 - k * 0.6) * clamp(P.sweat, 0, 1)); }
    ctx.restore();
    if (cheerBurst >= 0) drawBurst(ctx, cheerBurst, st.cheerK, ol);
    if (st.w.worry > 0.3 && P.tufts > 0.3) drawLoose(ctx, tt, ol, st.w.worry);
    ctx.restore();
    if (wD > 0.05) drawNotes(ctx, tt, ol, wD);
  } catch (e) {
    // art must never break the frame
  }
  ctx.restore();
  return true;
}

/* ------------------------------------------------------------------ parts */
const grad = (ctx, x0, y0, x1, y1, stops) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c)); return g; };
const rgrad = (ctx, x, y, r0, r1, stops) => { const g = ctx.createRadialGradient(x, y, r0, x, y, r1); stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c)); return g; };
const dot = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
function solid(ctx, o, p, fill, line = LINE, w = 1) {
  ctx.beginPath(); p(ctx); ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = o * w; ctx.strokeStyle = line; ctx.stroke();
}
// a filled shape with a hard two-tone split: `lo` covers the part of `p` below the line y = cut (in the current frame)
function twoTone(ctx, o, p, hi, lo, cut, line = LINE, w = 1) {
  ctx.beginPath(); p(ctx); ctx.fillStyle = hi; ctx.fill();
  ctx.save(); ctx.clip(); ctx.fillStyle = lo; ctx.fillRect(-200, cut, 400, 400); ctx.restore();
  ctx.beginPath(); p(ctx); ctx.lineWidth = o * w; ctx.strokeStyle = line; ctx.stroke();
}

// Scaly legs: the rooster's recipe (dark underlay, then the colour), a little thicker, with scale ticks, three front toes
// and a back toe. Hips ride the hop, feet stay on the ground line (y 48) unless lifted.
function drawLegs(ctx, P, o) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const L = [
    { x: -6, st: P.sL, up: P.fL, c: LEG.far }, // far leg first, a shade darker
    { x: 5, st: P.sR, up: P.fR, c: LEG.hi },
  ].map((l) => {
    const fy = 48 - P.lift - l.up, top = 32 - P.lift, fx = l.x + l.st, air = clamp((l.up + P.lift) / 6, 0, 1);
    return { ...l, fy, top, fx, air };
  });
  for (const l of L) {
    const toes = (c) => {
      const curl = l.air * 3.5;
      c.moveTo(l.fx, l.fy); c.lineTo(l.fx + 9 - curl * 0.6, l.fy + 0.6 + curl); // long middle toe
      c.moveTo(l.fx, l.fy); c.lineTo(l.fx + 6 - curl * 0.4, l.fy + 2.2 + curl * 0.8); // side toe (toward us)
      c.moveTo(l.fx, l.fy); c.lineTo(l.fx - 4.5 + curl * 0.3, l.fy + 1 + curl * 0.6); // back toe
    };
    for (const pass of [0, 1]) {
      ctx.strokeStyle = pass ? l.c : LEG.line;
      ctx.lineWidth = 4.4 + (pass ? 0 : o * 1.4);
      ctx.beginPath(); ctx.moveTo(l.x, l.top); ctx.lineTo(l.fx, l.fy); ctx.stroke();
      ctx.lineWidth = 2.8 + (pass ? 0 : o * 1.4);
      ctx.beginPath(); toes(ctx); ctx.stroke();
    }
    // scales: short ticks across the shank
    ctx.strokeStyle = LEG.line; ctx.lineWidth = o * 0.5;
    ctx.beginPath();
    for (let i = 1; i <= 3; i++) {
      const u = 0.4 + i * 0.15, x = lerp(l.x, l.fx, u), y = lerp(l.top, l.fy, u);
      ctx.moveTo(x - 2, y - 0.6); ctx.lineTo(x + 2, y + 0.6);
    }
    ctx.stroke();
  }
}

// a wing: shoulder at (x, y); `raise` rotates it up from folded (0) toward up-and-back (1.5) or up-and-forward (2.4).
// One silhouette like the rooster's wing, but its trailing edge is a row of rounded feather tips (scallops) that open up
// as it spreads; inside, a scalloped covert row and quill lines, and a hard two-tone split (light leading half, tan
// trailing half). Local frame: x runs shoulder -> tip, +y is the leading edge (up while folded).
function wing(ctx, o, x, y, raise, sp, far) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI - 0.3 + raise);
  if (far) ctx.scale(0.94, 0.94);
  sp = clamp(sp, 0, 1.2);
  const L = 37 + 9 * sp, W = 13 + 4 * sp, n = 4, dip = 3.4 + 2.4 * sp;
  const T = []; // trailing-edge points, tip first
  for (let i = 0; i <= n; i++) { const b = i / n; T.push([L * (1 - b * 0.8), -W * (0.05 + b * (0.8 + 0.25 * sp))]); }
  const path = (c) => {
    c.moveTo(0, W * 0.55);
    c.bezierCurveTo(L * 0.3, W * 1.05, L * 0.78, W * 0.75, L, 0);
    for (let i = 0; i < n; i++) { // each feather tip bulges out past the line between its neighbours
      const [x0, y0] = T[i], [x1, y1] = T[i + 1], mx = (x0 + x1) / 2, my = (y0 + y1) / 2, dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1;
      c.quadraticCurveTo(mx + (dy / l) * dip * -1, my - (dx / l) * dip * -1, x1, y1);
    }
    c.quadraticCurveTo(-5, -W * 0.5, 0, W * 0.55);
    c.closePath();
  };
  const col = far ? HEN.far : HEN.wing, lo = far ? '#bf9d6e' : HEN.wingLo;
  ctx.beginPath(); path(ctx); ctx.fillStyle = col[0]; ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = col[1]; ctx.fillRect(-20, -60, L + 40, 60 + W * 0.15); // mid tone below the leading half
  ctx.fillStyle = lo; ctx.fillRect(-20, -60, L + 40, 60 - W * 0.45); // tan trailing feathers
  ctx.strokeStyle = LINE; ctx.lineWidth = o * 0.6;
  ctx.beginPath(); // covert row: three small scallops across the wing
  for (let i = 0; i < 3; i++) { const u = i / 3, x0 = lerp(L * 0.62, L * 0.12, u), y0 = lerp(W * 0.25, -W * 0.25, u), x1 = lerp(L * 0.62, L * 0.12, u + 1 / 3), y1 = lerp(W * 0.25, -W * 0.25, u + 1 / 3); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 - 1.5, (y0 + y1) / 2 - 3.4, x1, y1); }
  for (let i = 1; i < n; i++) { const [tx, ty] = T[i]; ctx.moveTo(tx + 1, ty + 1.2); ctx.lineTo(lerp(tx, L * 0.5, 0.45), lerp(ty, -W * 0.05, 0.6)); } // quills between the primaries
  ctx.stroke();
  ctx.restore();
  ctx.beginPath(); path(ctx); ctx.lineWidth = o; ctx.strokeStyle = LINE; ctx.stroke();
  ctx.restore();
}

// tail: a short upright fan of rounded feathers at the back, each split light / tan along its quill
function drawTail(ctx, P, o) {
  ctx.save();
  ctx.translate(-33, -2);
  ctx.rotate(P.tail);
  const spread = 0.27 * (1 + 0.5 * clamp(P.tsp, -0.6, 1));
  for (const i of [0, 4, 1, 3, 2]) {
    const a = -2.05 + (i - 2) * spread, len = 27 - Math.abs(i - 2) * 3, w = 10;
    ctx.save();
    ctx.rotate(a);
    const path = (c) => { c.moveTo(0, -w * 0.4); c.lineTo(len - w * 0.5, -w * 0.5); c.arc(len - w * 0.5, 0, w * 0.5, -Math.PI / 2, Math.PI / 2); c.lineTo(0, w * 0.4); c.closePath(); };
    twoTone(ctx, o, path, i === 2 ? HEN.tail[0] : HEN.tail[1], HEN.tailLo, 0.4);
    ctx.strokeStyle = 'rgba(150,104,58,0.6)'; ctx.lineWidth = o * 0.5;
    ctx.beginPath(); ctx.moveTo(4, 0.2); ctx.lineTo(len - 4, 0.2); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

// feather tufts poking out of the silhouette when she puffs up (x, y, outward angle)
const TUFTS = [[33, 6, -0.35], [34, 20, 0.2], [-38, 20, 2.75], [-39, 4, -2.95], [-20, -13, -1.9], [8, -13, -1.5]];
function drawTufts(ctx, k, tt, o) {
  const L = 1 + 4 * clamp(k, 0, 1.2), w = 3.6;
  TUFTS.forEach(([x, y, a], i) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a + Math.sin(tt * 19 + i * 2) * 0.07);
    solid(ctx, o, (c) => { c.moveTo(-6, -w); c.quadraticCurveTo(L, -w * 1.1, L + w, 0); c.quadraticCurveTo(L, w * 1.1, -6, w); c.closePath(); }, HEN.mid);
    ctx.restore();
  });
}

// body + neck + head as one silhouette (the rooster's union: every outline first, then every fill, no seams)
const bodyPath = (c) => {
  c.moveTo(22, -9);
  c.bezierCurveTo(37, 0, 37, 26, 17, 35);
  c.bezierCurveTo(3, 41, -19, 40, -30, 29);
  c.bezierCurveTo(-40, 19, -43, 3, -37, -8);
  c.bezierCurveTo(-29, -15, -12, -14, 0, -13);
  c.bezierCurveTo(10, -12, 17, -12, 22, -9);
  c.closePath();
};
const neckPath = (H) => (c) => {
  c.moveTo(0, -11);
  c.quadraticCurveTo(H.x - 13, H.y + 10, H.x - 10, H.y + 4);
  c.lineTo(H.x + 9, H.y + 6);
  c.quadraticCurveTo(H.x + 12, H.y + 17, 31, -1);
  c.closePath();
};
const headPath = (H) => (c) => c.arc(H.x, H.y, 13, 0, TAU);

function drawBody(ctx, H, o) {
  const parts = [bodyPath, neckPath(H), headPath(H)];
  ctx.lineJoin = 'round';
  ctx.lineWidth = o * 2;
  ctx.strokeStyle = LINE;
  ctx.fillStyle = LINE;
  for (const p of parts) { ctx.beginPath(); p(ctx); ctx.stroke(); ctx.fill(); }
  const fill = rgrad(ctx, -12, -16, 4, 66, [HEN.hi, HEN.mid, HEN.lo]);
  // two tones: the tan crescent is everything the silhouette, nudged toward the light (back-top), no longer covers
  ctx.save();
  ctx.beginPath();
  for (const p of parts) p(ctx);
  ctx.clip();
  ctx.fillStyle = HEN.shade;
  ctx.fillRect(-60, -60, 120, 120);
  ctx.translate(-4.5, -5.5);
  ctx.fillStyle = fill;
  for (const p of parts) { ctx.beginPath(); p(ctx); ctx.fill(); }
  ctx.translate(4.5, 5.5);
  // breast and flank feathers: rows of small scallops, denser on the breast
  ctx.strokeStyle = HEN.scal; ctx.lineWidth = o * 0.6;
  ctx.beginPath();
  for (const [x, y] of [[22, 6], [29, 13], [17, 15], [25, 22], [12, 25], [20, 30], [4, 31], [-8, 33], [-20, 28], [-28, 20]]) {
    ctx.moveTo(x - 4, y); ctx.quadraticCurveTo(x, y + 4, x + 4, y);
  }
  ctx.stroke();
  // neck hackles: a few pointed feather lines where the neck meets the body
  ctx.beginPath();
  for (let i = 0; i < 3; i++) { const x = H.x - 8 + i * 5, y = H.y + 13 + i * 1.5; ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 1, y + 5, x - 3, y + 8); }
  ctx.stroke();
  ctx.restore();
}

// head details in the head's own frame: comb, cheek, eyes (three-quarter: near eye at the cheek, far eye smaller just
// above the beak), beak, wattle, brows, tears
function drawHead(ctx, H, P, f, tt, o) {
  ctx.save();
  ctx.translate(H.x, H.y);
  ctx.rotate(P.hr);
  // highlight: a soft lit patch on the back of the crown
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath(); ctx.ellipse(-6, -6.5, 4.2, 2.6, -0.6, 0, TAU); ctx.fill();
  // comb: four lobes (smaller than the rooster's five), wobbling from its base
  ctx.save();
  ctx.translate(1, -10); ctx.rotate(P.comb); ctx.translate(-1, 10);
  const lobes = [[-7, -12, 4], [-2, -15.5, 4.8], [4, -15, 4.5], [8.6, -11.2, 3.5]];
  const combPath = (c) => { for (const [x, y, r] of lobes) { c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); } c.moveTo(-8, -8); c.lineTo(10, -8); c.lineTo(10, -12); c.lineTo(-8, -13); };
  ctx.lineWidth = o * 2; ctx.strokeStyle = RED.line; ctx.fillStyle = RED.line; ctx.beginPath(); combPath(ctx); ctx.stroke(); ctx.fill();
  ctx.fillStyle = grad(ctx, 0, -20, 0, -8, [RED.hi, RED.lo]); ctx.beginPath(); combPath(ctx); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; dot(ctx, -3, -17.5, 1.5); dot(ctx, -8, -13.5, 1.1);
  ctx.restore();
  // blush on the near cheek
  if (f.blush > 0.01) { ctx.fillStyle = `rgba(255,120,120,${clamp(f.blush, 0, 1).toFixed(3)})`; ctx.beginPath(); ctx.ellipse(-3, 5.5, 4, 2.4, 0, 0, TAU); ctx.fill(); }

  const NE = { x: 0.5, y: -1.5, k: 1 }, FE = { x: 10, y: -3, k: 0.64 }; // near and far eye; k = width (foreshortening)
  const bl = f.blink || 0, a0 = ctx.globalAlpha;
  ctx.lineCap = 'round';
  ctx.strokeStyle = EYE;
  // dot eyes (calm): the rooster's eye, a dark oval with one glint
  const dotW = (1 - f.eWide) * (1 - f.eHappy) * (1 - f.eSqueeze);
  if (dotW > 0.01) {
    ctx.globalAlpha = a0 * dotW;
    for (const E of [NE, FE]) {
      const px = E.x + f.pdx * 0.5 * E.k, py = E.y + f.pdy * 0.4;
      ctx.fillStyle = EYE;
      ctx.beginPath(); ctx.ellipse(px, py, 3.6 * E.k, 4.6 * (1 - bl * 0.85) + 0.3, 0, 0, TAU); ctx.fill();
      if (bl < 0.5) { ctx.fillStyle = '#fff'; dot(ctx, px - 1.2 * E.k, py - 1.5, 1.35 * (0.6 + 0.4 * E.k)); }
    }
  }
  // wide eyes (scared): white with a rim and a darting pupil
  if (f.eWide > 0.01) {
    ctx.globalAlpha = a0 * f.eWide * (1 - f.eHappy) * (1 - f.eSqueeze);
    for (const E of [NE, FE]) {
      ctx.beginPath(); ctx.ellipse(E.x, E.y - 0.5, 5 * E.k, 6 * (1 - bl * 0.8) + 0.2, 0, 0, TAU);
      ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = o * 0.8; ctx.stroke();
      if (bl < 0.5) {
        const px = E.x + clamp(f.pdx, -2, 2) * E.k, py = E.y + clamp(f.pdy, -2, 2);
        ctx.fillStyle = EYE; dot(ctx, px, py, 2.7 * (0.7 + 0.3 * E.k));
        ctx.fillStyle = '#fff'; dot(ctx, px - 0.8 * E.k, py - 0.9, 0.95);
      }
    }
  }
  // happy arcs
  if (f.eHappy > 0.01) {
    ctx.globalAlpha = a0 * f.eHappy;
    ctx.lineWidth = o * 1.3;
    ctx.beginPath();
    for (const E of [NE, FE]) { ctx.moveTo(E.x - 4.5 * E.k, E.y + 1.5); ctx.quadraticCurveTo(E.x, E.y - 5, E.x + 4.5 * E.k, E.y + 1.5); }
    ctx.stroke();
  }
  // squeezed shut: > <
  if (f.eSqueeze > 0.01) {
    ctx.globalAlpha = a0 * f.eSqueeze * (1 - f.eHappy);
    ctx.lineWidth = o * 1.2;
    ctx.beginPath();
    for (const E of [NE, FE]) { const d = E === NE ? 1 : -1, w = 4 * E.k; ctx.moveTo(E.x - d * w, E.y - 4); ctx.lineTo(E.x + d * w, E.y - 0.5); ctx.lineTo(E.x - d * w, E.y + 3); }
    ctx.stroke();
  }
  // worried brows: inner ends (toward the beak) raised
  if (f.brow > 0.01) {
    ctx.globalAlpha = a0 * f.brow * (1 - f.eHappy);
    ctx.lineWidth = o * 1.05;
    ctx.beginPath();
    ctx.moveTo(NE.x - 4.5, NE.y - 7 + f.browY); ctx.lineTo(NE.x + 3.5, NE.y - 10 + f.browY);
    ctx.moveTo(FE.x - 1.5, FE.y - 9.5 + f.browY); ctx.lineTo(FE.x + 2.8, FE.y - 7.5 + f.browY);
    ctx.stroke();
  }
  ctx.globalAlpha = a0;
  // tears: a stream down the near cheek, drops flung off the far side
  if (f.tear > 0.01) {
    ctx.save();
    ctx.globalAlpha = a0 * clamp(f.tear, 0, 1);
    ctx.strokeStyle = 'rgba(120,205,255,0.95)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(NE.x - 1, NE.y + 3); ctx.quadraticCurveTo(NE.x - 4 + Math.sin(tt * 8), NE.y + 9, NE.x - 3, NE.y + 15); ctx.stroke();
    for (let i = 0; i < 2; i++) {
      const k = fract(tt * 1.8 + i * 0.5);
      drawDrop(ctx, NE.x - 3 - k * 3, NE.y + 15 + k * 20, 2.4, 1, 1 - k * 0.7);
      const k2 = fract(tt * 1.8 + i * 0.5 + 0.25);
      drawDrop(ctx, FE.x + 4 + k2 * 10, FE.y + k2 * 18 + k2 * k2 * 8, 2.2, 1, 1 - k2 * 0.7);
    }
    ctx.restore();
  }
  // wattle and beak: the rooster's two-part beak, shorter; open is in the old units (0 shut .. ~5.5 wide)
  const open = clamp(f.beak / 5, 0, 1.2);
  solid(ctx, o * 0.8, (c) => { c.moveTo(8, 6 + open * 3); c.quadraticCurveTo(13.5, 8.5 + open * 3, 10.5, 14.5 + open * 3); c.quadraticCurveTo(6.5, 13 + open * 3, 6.5, 7 + open * 2.5); c.closePath(); }, grad(ctx, 0, 6, 0, 16, [RED.hi, RED.lo]), RED.line);
  ctx.save(); ctx.translate(9, 1);
  if (open > 0.08) {
    ctx.save(); ctx.rotate(open * 0.62);
    solid(ctx, o * 0.8, (c) => { c.moveTo(0, 0); c.lineTo(10.5, 1); c.lineTo(9.5, 3.8); c.lineTo(0, 4.4); c.closePath(); }, grad(ctx, 0, 0, 10, 4, [BEAK.hi, BEAK.lo]), BEAK.line);
    ctx.restore();
    const ca = Math.cos(open * 0.62), sa = Math.sin(open * 0.62);
    ctx.fillStyle = '#5a1710'; ctx.beginPath(); ctx.moveTo(0.5, 0); ctx.lineTo(10.5, 0.3); ctx.lineTo(10 * ca - 0.8 * sa, 10 * sa + 0.8 * ca); ctx.lineTo(0.5, 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff7a8a'; ctx.beginPath(); ctx.ellipse(4.5, 2.6 + open * 1.8, 3.4, 1.2 + open * 0.7, open * 0.2, 0, TAU); ctx.fill();
  }
  solid(ctx, o * 0.8, (c) => { c.moveTo(-0.5, -4); c.quadraticCurveTo(6.5, -4.8, 12, 0.8); c.quadraticCurveTo(6, 2.6, -0.5, 2.6); c.closePath(); }, grad(ctx, 0, -5, 0, 3, [BEAK.hi, BEAK.lo]), BEAK.line);
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(3.5, -2.4, 2.4, 0.8, 0.1, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.restore();
}

function feather(ctx, x, y, rot, len, o, alpha) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  const p = (c) => { c.moveTo(0, -len / 2); c.quadraticCurveTo(len * 0.36, 0, 0, len / 2); c.quadraticCurveTo(-len * 0.36, 0, 0, -len / 2); };
  ctx.beginPath(); p(ctx); ctx.fillStyle = HEN.hi; ctx.fill();
  ctx.save(); ctx.clip(); ctx.fillStyle = HEN.lo; ctx.fillRect(0, -len, len, len * 2); ctx.restore();
  ctx.beginPath(); p(ctx); ctx.lineWidth = o * 0.8; ctx.strokeStyle = LINE; ctx.stroke();
  ctx.restore();
}

// feather burst on a catch: deterministic from (time since launch, trigger count), no stored particles
function drawBurst(ctx, u, k, o) {
  if (u > 1) return;
  for (let i = 0; i < 10; i++) {
    const sd = i % 2 ? 1 : -1, a = -Math.PI / 2 + sd * (0.5 + hash(k * 9 + i) * 0.85), sp = 60 + hash(k * 3 + i * 7) * 40; // out and up from the wings, clear of the face
    const x = sd * 30 - 4 + Math.cos(a) * sp * u * 0.7, y = -12 + Math.sin(a) * sp * u * 0.75 + 80 * u * u;
    feather(ctx, x, y, a + Math.PI / 2 + u * (hash(i + k) > 0.5 ? 4 : -4), 15 + hash(i * 2) * 5, o, 1 - ss(0.5, 1, u));
  }
}

// a couple of loose feathers drifting while she is scared
function drawLoose(ctx, tt, o, w) {
  for (let i = 0; i < 2; i++) {
    const k = fract(tt * 0.7 + i * 0.5);
    feather(ctx, (i ? 30 : -40) + Math.sin(tt * 4 + i) * 4, -10 - k * 26 + k * k * 18, Math.sin(tt * 3 + i * 2) * 0.8, 13, o, (1 - k) * clamp(w, 0, 1));
  }
}

function drawNotes(ctx, tt, o, w) {
  ctx.save();
  ctx.fillStyle = '#ff7a9a';
  ctx.strokeStyle = LINE;
  ctx.lineWidth = o * 0.8;
  for (let i = 0; i < 3; i++) {
    const k = fract(tt * 0.6 + i / 3);
    const nx = (i - 1) * 40 + Math.sin(tt * 2 + i) * 4, ny = -46 - k * 28;
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
