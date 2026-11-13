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
const HS = 1.22; // v4: a bigger head and face (the star of the show has to act at 60 px tall)

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
  let blink = b.u < 0 ? 0 : Math.sin(b.u * Math.PI);
  if (hash(b.k * 7.7 + 2) > 0.62) { const b2 = slot(tt - 0.26, 3.3, 1, 0.17, 0.92); if (b2.u >= 0) blink = Math.max(blink, Math.sin(b2.u * Math.PI)); } // now and then a double blink
  // eye darts: the pupils snap to a spot, hold, and snap back (a quick ease, never a slide)
  // a glance: the eyes lead (60 ms), the head follows ~90 ms later with a blink on the turn; the eyes come home first too
  const d = slot(tt, 2.3, 6, 0.75, 0.7), de = d.u < 0 ? 0 : ss(0, 0.08, d.u) * (1 - ss(0.62, 0.7, d.u)), dh = d.u < 0 ? 0 : ss(0.12, 0.28, d.u) * (1 - ss(0.74, 0.9, d.u));
  const gx = hash(d.k * 4.1) * 2 - 1, gy = hash(d.k * 2.3 + 1) - 0.6;
  if (d.u >= 0 && Math.abs(gx) > 0.45) blink = Math.max(blink, Math.sin(clamp((d.u - 0.1) / 0.2, 0, 1) * Math.PI), Math.sin(clamp((d.u - 0.7) / 0.2, 0, 1) * Math.PI) * 0.9);
  return { blink, peck: p.u, pdir: hash(p.k * 5.3) > 0.5 ? 1 : -1, ruffle: r.u, dx: de * gx * 1.6, dy: de * gy * 1.4, hx: dh * gx, hy: dh * gy };
}

/* ------------------------------------------------------------------ poses */
// wa / wf: near / far wing raise (rad from folded; ~1.5 up-and-back, ~2.4 up-and-forward), sp: feather spread 0..1.
// tail: tail fan tilt, tsp: its spread. fL / fR: foot lift, sL / sR: foot stride (units forward). hx, hy, hr: head.
// spin: whole-body roll around her middle (a backflip is 0 -> -TAU); twirl: a turn on the spot (the facing scale is
// multiplied by cos(twirl), so PI is a half turn); grit: determined brows (fail screen pep talk); wink: near eye shut;
// fw: far-wing reveal 0..1 (a 3/4 turn of the shoulders: the far wing's root moves back and up, so a raised far wing shows
// past her back and "both wings up" reads as two wings, not one)
const KEYS = ['lift', 'sq', 'lean', 'sway', 'dx', 'hx', 'hy', 'hr', 'comb', 'wa', 'wf', 'sp', 'puff', 'tufts', 'tail', 'tsp',
  'fL', 'fR', 'sL', 'sR', 'eWide', 'eHappy', 'eSqueeze', 'brow', 'browY', 'pdx', 'pdy', 'beak', 'tear', 'blush', 'sweat', 'spin', 'twirl', 'grit', 'wink', 'fw',
  'lid', 'low', 'pup', 'bw', 'bwF', 'smile', 'cheek', 'teeth'];
// The acting face (v5, after render/mama.js): lid / low = upper / lower eyelid 0..1; pup = pupil size (1 normal, 0.2 a pin);
// bw / bwF = the near / far brow cocked up on its own; brow (worried, inner ends up), grit (furrowed) and browY tilt and move
// both; smile 1 .. -1 = the beak corner; cheek = the cheek pushes the eye up; teeth = gritted. eHappy / eSqueeze close the
// lids on the way (never a cross-fade) and snap to the laughing arc / the scrunched > < at the half.
// The face keys blend with a sharpened weight (FACE), so an expression snaps in ~80 ms and holds while the body eases.
const FACE = new Set(['eWide', 'eHappy', 'eSqueeze', 'brow', 'browY', 'beak', 'grit', 'wink', 'lid', 'low', 'pup', 'bw', 'bwF', 'smile', 'cheek', 'teeth']);
const sharp = (w) => ss(0.4, 0.6, w);
const REST = { lift: 0, sq: 0, lean: 0, sway: 0, dx: 0, hx: 0, hy: 0, hr: 0, comb: 0, wa: 0, wf: 0, sp: 0, puff: 1, tufts: 0, tail: 0, tsp: 0,
  fL: 0, fR: 0, sL: 0, sR: 0, eWide: 0, eHappy: 0, eSqueeze: 0, brow: 0, browY: 0, pdx: 0, pdy: 0, beak: 0, tear: 0, blush: 0.3, sweat: 0, spin: 0, twirl: 0, grit: 0, wink: 0, fw: 0,
  lid: 0.14, low: 0, pup: 1, bw: 0, bwF: 0, smile: 0.3, cheek: 0, teeth: 0 };
export const henPose = (o) => Object.assign({}, REST, o);
const pose = henPose;

export function idlePose(tt) {
  const br = Math.sin(tt * 2.4);
  return pose({ sq: br * 0.018, hx: Math.sin(tt * 1.1) * 0.9, hy: Math.sin(tt * 2.4 + 0.6) * 0.8, hr: Math.sin(tt * 0.9) * 0.03,
    comb: Math.sin(tt * 2.4 - 0.5) * 0.04, wa: br * 0.03, tail: Math.sin(tt * 3) * 0.04,
    lid: 0.36, low: 0.08, bw: 0.8, smile: 0.5, grit: 0.3 }); // confident: half-lidded, one brow up, a small smile
}

// full fright; the blend weight is how scared she is. Darts = the head snaps between look-spots a few times a second
function worryPose(tt) {
  const k = Math.floor(tt * 2.6), f = ss(0, 0.35, fract(tt * 2.6));
  const sx = [-1, 0.8, -0.4, 1, -0.9, 0.3], sy = [0, -1, 0.4, -0.6, 0.2, -1];
  const a = k % 6, b = (k + 1) % 6, dx = lerp(sx[a], sx[b], f), dy = lerp(sy[a], sy[b], f);
  return pose({ sq: 0.03, lift: Math.abs(Math.sin(tt * 15)) * 0.9, dx: Math.sin(tt * 43) * 0.7, hx: -2 + dx * 2.5, hy: -4 + dy * 1.5, hr: -0.08 + dx * 0.1, comb: -0.12 + Math.sin(tt * 20) * 0.05,
    wa: 1.05 + Math.sin(tt * 17) * 0.12, wf: 1.15 + Math.sin(tt * 17 + 1) * 0.12, sp: 0.55, puff: 1.06, tufts: 1, tail: 0.12, tsp: 0.6,
    eWide: 1, brow: 1, browY: -1.3, pdx: dx * 1.6, pdy: dy * 1.2, beak: 1.5, sweat: 1, blush: 0.25,
    lid: 0, low: 0.3, pup: 0.5, smile: -0.7, teeth: 1 }); // brows up and pinched, lower lids up, small pupils, teeth gritted
}

function cryPose(tt) {
  const heave = Math.max(0, Math.sin(tt * 8)), wipe = ss(0.55, 0.7, fract(tt / 2.4)) * (1 - ss(0.86, 1, fract(tt / 2.4)));
  return pose({ sq: -0.045 + heave * 0.03, dx: Math.sin(tt * 31) * 0.25, hx: 1, hy: 5 - heave * 1.4, hr: 0.16 + Math.sin(tt * 4) * 0.05, comb: 0.3,
    wa: lerp(-0.18, 2.68, wipe) + Math.sin(tt * 16) * 0.07 * wipe, wf: -0.1, sp: 0.15 * wipe, tail: -0.35, tsp: -0.3, eSqueeze: 1, brow: 1, browY: 1.5,
    beak: 4.6 + Math.sin(tt * 8) * 1.2, tear: 1, blush: 0.45, smile: -1, cheek: 0.8, lid: 0.5, low: 0.3 }); // a scrunched bawl
}

function dancePose(tt) {
  const ph = tt * 2.2, f = fract(ph), air = f < 0.7 ? Math.sin((f / 0.7) * Math.PI) : 0, land = f >= 0.7 ? Math.max(0, 1 - (f - 0.7) / 0.14) : 0;
  const s = Math.sin(ph * Math.PI), sw = Math.sin(ph * TAU) * 0.45;
  return pose({ lift: air * 12, sq: 0.06 * air - 0.1 * land, sway: s * 0.1, dx: s * 3, hx: s * 2, hy: -2, hr: -0.1 - s * 0.1, comb: -s * 0.2,
    wa: 1.5 + sw, wf: 1.45 - sw, sp: 0.85, tail: Math.sin(tt * 7) * 0.2, tsp: 0.5, fL: Math.max(0, s) * 6, fR: Math.max(0, -s) * 6, sL: Math.max(0, s) * 5, sR: Math.max(0, -s) * 5,
    eHappy: ss(0.72, 0.84, air), beak: 3 + 1.6 * air, blush: 0.5, lid: 0.2, low: 0.25, bw: 1, smile: 1, cheek: 0.9 }); // eyes close at the top of each hop, a cocky brow
}

function blendInto(out, p, w, wf = w) { // wf: the weight of the face keys
  if (w <= 0.0005 && wf <= 0.0005) return;
  for (const k of KEYS) out[k] += p[k] * (FACE.has(k) ? wf : w);
}

/* ------------------------------------------------------------------ in-level reactions */
// One-shot layers on top of the blended pose, each with 2-3 variants so the same event never looks the same twice in a
// row: an egg saved ('happy'), an egg cracked ('gasp'), a close shave past a thorn ('phew'). Each f(P, u) edits the
// pose u seconds in and may return extras {burst, heart}. All start and end at rest (an envelope E), so nothing pops.
const env = (u, a, b, c, d) => ss(a, b, u) * (1 - ss(c, d, u));
// the joy face: bright open eyes and a grin; at the top of the hop (air 0..1) the eyes shut into laughing arcs
function cheerCommon(P, E, air = 1) {
  const F = sharp(E);
  P.eHappy = lerp(P.eHappy, ss(0.45, 0.6, air), F); P.eWide = lerp(P.eWide, 0, F); P.eSqueeze = lerp(P.eSqueeze, 0, F); P.brow = lerp(P.brow, 0, F); P.browY = lerp(P.browY, -1, F);
  P.lid = lerp(P.lid, 0.04, F); P.low = lerp(P.low, 0.22, F); P.pup = lerp(P.pup, 1.1, F); P.smile = lerp(P.smile, 1, F); P.cheek = lerp(P.cheek, 1, F);
  P.bw = lerp(P.bw, 0.5, F); P.bwF = lerp(P.bwF, 0.5, F); P.teeth = lerp(P.teeth, 0, F);
  P.sweat = lerp(P.sweat, 0, E); P.blush = lerp(P.blush, 0.55, E); P.lean *= 1 - E;
}
// a take: a 50 ms squint (anticipation), then the eyes pop (lids wide, pin pupils, brows up, beak gaping), hold, recover
function gaspFace(P, su, t0 = 0) {
  const u = su - t0; if (u < 0) return;
  const sq = env(u, 0, 0.025, 0.045, 0.07), T = ss(0.045, 0.1, u) * (1 - ss(0.34, 0.43, u));
  P.eWide = lerp(P.eWide, 1.3, T); P.pup = lerp(P.pup, 0.2, T); P.low = lerp(P.low, 0, T); P.lid = lerp(lerp(P.lid, 1, sq), -0.1, T);
  P.beak = lerp(P.beak, 5.6, T); P.teeth = lerp(P.teeth, 0, T); P.browY = lerp(P.browY, -2.8, T); P.brow = lerp(P.brow, 0.45, T); P.smile = lerp(P.smile, -0.2, T);
  P.eSqueeze *= 1 - T; P.eHappy *= 1 - T; P.pdx *= 1 - T; P.pdy *= 1 - T;
}
const REACT = {
  happy: [
    { len: CHEER_LEN, f(P, cu) { // hop: crouch, hop, flap, land, a small second hop, feather burst
      const E = ss(0, 0.08, cu) * (1 - ss(0.85, 1.25, cu));
      let lift = 0, sq = 0;
      if (cu < 0.09) sq = -0.1 * (cu / 0.09);
      else if (cu < 0.5) { const a = (cu - 0.09) / 0.41; lift = 15 * Math.sin(a * Math.PI); sq = lerp(-0.1, 0.09, ss(0, 0.25, a)) * (1 - ss(0.7, 1, a)) + 0.04 * Math.sin(a * Math.PI) * (a > 0.5 ? 0 : 1); }
      if (cu >= 0.5) sq -= 0.17 * Math.exp(-(cu - 0.5) / 0.07);
      if (cu >= 0.62 && cu < 0.92) { const a = (cu - 0.62) / 0.3; lift += 6 * Math.sin(a * Math.PI); }
      if (cu >= 0.92) sq -= 0.08 * Math.exp(-(cu - 0.92) / 0.07);
      P.lift += lift; P.sq += sq;
      const fl = Math.sin(cu * 34) * 0.5;
      P.wa = lerp(P.wa, 1.45 + fl, E); P.wf = lerp(P.wf, 1.35 + fl, E); P.sp = lerp(P.sp, 1, E);
      cheerCommon(P, E, lift / 15);
      P.beak = lerp(P.beak, 4.5, E); P.hy += -2 * E; P.hr = lerp(P.hr, -0.15, E);
      P.tail = lerp(P.tail, 0.15 + Math.sin(cu * 26) * 0.18, E); P.tsp = lerp(P.tsp, 0.8, E); P.sway += Math.sin(cu * 9) * 0.05 * E;
      P.fL = lerp(P.fL, lift * 0.25, E); P.fR = lerp(P.fR, lift * 0.2, E); // toes tuck in the air
      return { burst: cu >= 0.09 ? cu - 0.09 : -1 };
    } },
    { len: 1.25, f(P, cu) { // twirl: a hop with a full turn in the air, wings out, then a wing flourish
      const E = ss(0, 0.06, cu) * (1 - ss(0.9, 1.25, cu));
      const a = clamp((cu - 0.1) / 0.46, 0, 1), air = cu > 0.1 && cu < 0.56 ? Math.sin(a * Math.PI) : 0;
      P.lift += 13 * air;
      P.sq += (cu < 0.1 ? -0.1 * ss(0, 0.1, cu) : 0) + 0.08 * air * (a < 0.5 ? 1 : 0.3) - (cu >= 0.56 ? 0.16 * Math.exp(-(cu - 0.56) / 0.07) : 0);
      P.twirl += TAU * clamp((cu - 0.14) / 0.32, 0, 1); // linear, so the edge-on moments are brief
      const fl = env(cu, 0.62, 0.7, 0.85, 1.05);
      P.wa = lerp(P.wa, 1.6 - 0.1 * fl, E); P.wf = lerp(P.wf, 1.5 + 0.8 * fl, E); P.sp = lerp(P.sp, 1, E);
      cheerCommon(P, E, air);
      P.beak = lerp(P.beak, 3.5 + 1.5 * fl, E); P.hr = lerp(P.hr, -0.12 - 0.12 * fl, E);
      P.tail = lerp(P.tail, 0.2, E); P.tsp = lerp(P.tsp, 0.9, E);
      P.fL = lerp(P.fL, 4 * air, E); P.fR = lerp(P.fR, 3 * air, E);
      return { burst: cu >= 0.5 ? (cu - 0.5) * 1.3 : -1 };
    } },
    { len: 1.2, f(P, cu) { // pump: feet planted, two quick wing pumps with a cluck each, head bobbing to the beat
      const E = ss(0, 0.06, cu) * (1 - ss(0.85, 1.2, cu));
      const p1 = env(cu, 0.04, 0.13, 0.3, 0.42), p2 = env(cu, 0.42, 0.51, 0.7, 0.86), p = Math.max(p1, p2);
      P.wa = lerp(P.wa, 0.3 + 1.35 * p, E); P.wf = lerp(P.wf, 0.4 + 1.85 * p, E); P.sp = lerp(P.sp, 0.5 + 0.5 * p, E);
      P.lift += 3 * p; P.sq += 0.06 * p - 0.05 * env(cu, 0.3, 0.36, 0.38, 0.46) - 0.05 * env(cu, 0.7, 0.76, 0.78, 0.9);
      P.hx += 3 * p * E; P.hy -= 2 * p * E; P.hr = lerp(P.hr, -0.2 * p, E);
      cheerCommon(P, E, p);
      P.beak = lerp(P.beak, 1.2 + 3.6 * p, E);
      P.tail = lerp(P.tail, Math.sin(cu * 30) * 0.22, E); P.tsp = lerp(P.tsp, 0.6, E);
      P.fR += 3 * p2; // a little kick on the second pump
      return { burst: -1 };
    } },
  ],
  gasp: [
    { len: 0.5, f(P, su) { // startle: a jump and a puff
      const a = Math.min(1, su / 0.2), air = su < 0.2 ? Math.sin(a * Math.PI) : 0;
      P.lift += 4.5 * air;
      P.sq += 0.08 * air - 0.08 * Math.exp(-Math.max(0, su - 0.2) / 0.07) * (su >= 0.2 ? 1 : 0);
      P.puff += 0.05 * Math.exp(-su / 0.18);
      P.tufts = Math.max(P.tufts, 1 - ss(0.2, 0.5, su));
      gaspFace(P, su);
    } },
    { len: 0.85, f(P, su) { // cover: both wings fly up to her cheeks, she leans back, beak an O
      const E = env(su, 0, 0.07, 0.55, 0.85);
      P.wa = lerp(P.wa, 2.5, E); P.wf = lerp(P.wf, 2.35, E); P.sp = lerp(P.sp, 0.3, E);
      P.lean -= 0.14 * E; P.hy -= 2 * E; P.hx -= 2 * E; P.lift += 2.5 * Math.sin(clamp(su / 0.18, 0, 1) * Math.PI);
      P.eWide = Math.max(P.eWide, E); P.beak = lerp(P.beak, 3.6, E); P.puff += 0.03 * E;
      P.tufts = Math.max(P.tufts, 0.8 * E);
      gaspFace(P, su);
    } },
    { len: 0.75, f(P, su) { // flinch: a quick duck, head pulled in, then a shake of the head
      const d = env(su, 0, 0.06, 0.2, 0.42), sh = env(su, 0.22, 0.3, 0.55, 0.72);
      P.sq -= 0.11 * d; P.lift -= 4 * d; P.hx -= 4 * d; P.hy += 4 * d; P.puff += 0.04 * d;
      P.wa = lerp(P.wa, 0.9, d); P.wf = lerp(P.wf, 0.9, d);
      P.hr += Math.sin((su - 0.22) * 42) * 0.2 * sh; P.comb += Math.sin((su - 0.22) * 42 - 0.8) * 0.22 * sh;
      P.eSqueeze = Math.max(P.eSqueeze, sharp(d)); P.tufts = Math.max(P.tufts, Math.max(d, sh) * 0.9);
      gaspFace(P, su, 0.3); // she peeks out of the duck
    } },
  ],
  phew: [
    { len: 1.0, f(P, u) { // wipe: a wing across the brow, a sweat drop flicked away, eyes shut in relief
      const E = env(u, 0, 0.12, 0.72, 1), sw = env(u, 0.16, 0.24, 0.5, 0.6);
      P.wa = lerp(P.wa, 2.45 + Math.sin(u * 11) * 0.22 * sw, E); P.sp = lerp(P.sp, 0.2, E);
      P.sweat = Math.max(P.sweat, env(u, 0, 0.08, 0.4, 0.6));
      const rl = ss(0.34, 0.42, u) * (1 - ss(0.8, 0.88, u)), F = sharp(E); // relief: the lids drop shut, the brows let go, a breath out
      P.eWide = lerp(P.eWide, 0, F); P.brow = lerp(P.brow, 0.7, F); P.browY = lerp(P.browY, -1.2 + 1.6 * rl, F); P.teeth = lerp(P.teeth, 0, F);
      P.lid = lerp(P.lid, lerp(0.05, 1, rl), F); P.pup = lerp(P.pup, 1, F); P.smile = lerp(P.smile, lerp(-0.3, 0.7, rl), F);
      P.beak = lerp(P.beak, 2, env(u, 0.45, 0.5, 0.75, 0.9));
      P.sq -= 0.04 * env(u, 0.5, 0.6, 0.8, 1); P.hy += 2 * E;
      return { breath: (u - 0.47) / 0.4 };
    } },
    { len: 1.0, f(P, u) { // slump: breath in, a big relieved breath out, then shake it off
      const inh = env(u, 0, 0.12, 0.16, 0.26), out = env(u, 0.2, 0.32, 0.6, 0.78), sh = env(u, 0.66, 0.72, 0.88, 1);
      P.sq += 0.05 * inh - 0.07 * out; P.puff += 0.04 * inh; P.hy += -2 * inh + 4 * out; P.lean += 0.06 * out;
      P.wa = lerp(P.wa, -0.2, out); P.wf = lerp(P.wf, -0.1, out);
      const F = sharp(Math.max(inh, out)), o2 = sharp(out);
      P.eWide = lerp(P.eWide, 0.7 * (1 - o2), F); P.browY = lerp(P.browY, lerp(-2, 0.6, o2), F); P.brow = lerp(P.brow, 0.6, F); P.teeth = lerp(P.teeth, 0, F);
      P.lid = lerp(P.lid, o2, F); P.smile = lerp(P.smile, 0.6 * o2, F); P.beak = lerp(P.beak, lerp(0.6, 2.2, o2), F);
      if (u > 0.22) { P.dx += Math.sin(u * 60) * 0.9 * sh; P.tufts = Math.max(P.tufts, 0.5 * sh); P.tail += Math.sin(u * 50) * 0.2 * sh; return { breath: (u - 0.24) / 0.42 }; }
      P.dx += Math.sin(u * 60) * 0.9 * sh; P.tufts = Math.max(P.tufts, 0.5 * sh); P.tail += Math.sin(u * 50) * 0.2 * sh;
    } },
    { len: 0.95, f(P, u) { // heart: a wing to her chest, a happy little hop and a heart
      const E = env(u, 0, 0.1, 0.65, 0.95), a = clamp((u - 0.3) / 0.28, 0, 1), air = u > 0.3 && u < 0.58 ? Math.sin(a * Math.PI) : 0;
      P.wa = lerp(P.wa, 0.8 + Math.sin(u * 16) * 0.1, E); P.wf = lerp(P.wf, 0.3, E);
      P.lift += 6 * air; P.sq += 0.05 * air - (u > 0.58 ? 0.1 * Math.exp(-(u - 0.58) / 0.07) : 0);
      cheerCommon(P, E, air); P.blush = lerp(P.blush, 0.85, E); P.beak = lerp(P.beak, 2, E); P.hr = lerp(P.hr, 0.1, E);
      const F = sharp(E) * (1 - ss(0.25, 0.32, u)); P.lid = lerp(P.lid, 0.85, F); P.browY = lerp(P.browY, 0.4, F); // first the relieved lids and a breath, then the happy hop
      return { heart: u, breath: (u - 0.04) / 0.34 };
    } },
  ],
};
// pick a variant: random-looking from the trigger count, never the one played last time
const nextVariant = (prev, n) => (prev < 0 ? Math.floor(hash(n * 3.7 + 1) * 3) : (prev + 1 + (hash(n * 1.3 + 5) > 0.5 ? 1 : 0)) % 3);

/* ------------------------------------------------------------------ secondary motion */
// Overlapping action: the comb, tail and wing tips lag the body. vy / vx are the body's speed (units / s, vy up).
// The level hen feeds damped springs with these; the win-screen routines pass lagged speeds (pure functions of time).
const SEC = { c: [-0.0055, -0.005], t: [0.006, 0.004], w: [-0.0045, 0] };
const secTarget = (k, vy, vx) => clamp(SEC[k][0] * vy + SEC[k][1] * vx, -0.4, 0.4);
function applySecondary(P, c, t, w) {
  P.comb += c; P.tail += t;
  P.wa += w * clamp(P.wa, 0, 1); P.wf += w * clamp(P.wf, 0, 1); // only an open wing drags
}
export function henSecondary(P, vy, vx) { applySecondary(P, secTarget('c', vy, vx), secTarget('t', vy, vx), secTarget('w', vy, vx)); }

/* ------------------------------------------------------------------ the Chick Strike: her wing launches the chick */
// render/strike.js tells the world hen what the chick is doing (henStrike, once a frame): 'land' (u = s since it landed on
// her back: she dips and squashes under it, glances back), 'wind' (u 0..1 over the hop phase: the near wing winds down and
// back, eyes narrowing, then bats up under the chick; contact at u = 1), 'fly' (u 0..1: she holds the follow-through, smug,
// eyes on the chick), 'after' (u = s since the hit: she settles to her mood). (tx, ty) = what to look at, in canvas pixels.
// She answers with where things are (henAnchors, canvas pixels): the seat on her back, her wing's palm, her head.
const STK = { phase: '', u: 0, tx: 0, ty: 0, n: 99 };
const WORLD = { n: 99, seat: null, palm: null, head: null, ride: false, over: false, m: null, ol: 1, wa: 0, sp: 0 };
export function henStrike(c) { STK.phase = c.phase || ''; STK.u = c.u || 0; STK.tx = c.tx || 0; STK.ty = c.ty || 0; STK.n = 0; }
export function henAnchors() { return WORLD.n++ < 2 && WORLD.seat ? WORLD : null; }
const WIND = 0.56; // the wind-up ends here (0.18 s of anticipation), the bat takes the rest of the hop phase
function strikePose(ph, u) {
  const br = { lid: 0.36, low: 0.08, bw: 0.8, smile: 0.5 };
  if (ph === 'wind') {
    const A = ss(0, 0.42, u), B = clamp((u - WIND) / (1 - WIND), 0, 1), b = B * B, pop = ss(0.55, 0.8, B);
    return pose({ sq: lerp(-0.085 * A, 0.07, b), lift: 2.5 * b, lean: lerp(0.07 * A, -0.05, b), hx: lerp(2 * A, -1, b), hy: lerp(2.5 * A, -2.5, b), hr: lerp(0.1 * A, -0.1, b),
      comb: 0.15 * A - 0.3 * b, wa: lerp(-0.85 * A, 1.15, b), wf: 0.2 * b, sp: 0.4 * A + 0.6 * ss(0, 0.5, B), tail: 0.2 * A - 0.3 * b, tsp: 0.4, fL: 0, fR: 0,
      lid: lerp(0.56, 0.02, pop), low: lerp(0.46 * A, 0.1, pop), grit: lerp(A, 0.3, pop), browY: lerp(0.6 * A, -1.5, pop), pup: 0.85, smile: lerp(0.2, 1, pop), teeth: 1 - pop, beak: lerp(1.3 * A, 4.6, pop), cheek: 0.5 * pop, bw: 0.4 * pop });
  }
  const o = ph === 'fly' ? ss(0, 0.16, u) : 1, sw = ph === 'fly' ? Math.exp(-u * 9) * Math.sin(u * 30) : 0; // the follow-through overshoots and rings out
  return pose({ sq: lerp(0.07, 0.02, o), lift: 2.5 * (1 - o), lean: -0.05, hx: -1, hy: -2.5, hr: -0.12, comb: -0.1, wa: lerp(1.15, 1.5, o) + 0.12 * sw, wf: 0.25, sp: lerp(1, 0.8, o), tail: 0.15, tsp: 0.5,
    ...br, lid: lerp(0.02, 0.46, o), low: 0.34 * o, bw: 1, smile: 1, cheek: 0.7, beak: 4.6 * (1 - ss(0.3, 0.7, o)) });
}
function strikeLayer(P, world) {
  const ph = STK.phase, u = STK.u;
  if (ph === 'land') { // the chick lands on her back: a dip and a squash, a blink, then a look back up at it
    const d = Math.exp(-u / 0.085) * Math.cos(u * 14), g = env(u, 0.12, 0.18, 0.55, 0.62);
    P.sq -= 0.14 * d; P.lift -= 3.2 * d; P.tail += 0.3 * d; P.comb += 0.25 * d; P.hy += 2 * d; P.wa += 0.35 * Math.max(0, d); P.sp += 0.3 * Math.max(0, d);
    P.lid = lerp(P.lid, 1, env(u, 0, 0.03, 0.07, 0.12)); P.pdx = lerp(P.pdx, -1.6, g); P.pdy = lerp(P.pdy, -1.3, g); P.bw = lerp(P.bw, 1, g); P.hr -= 0.12 * g; P.hx -= 1.5 * g;
    return u < 0.6;
  }
  if (ph !== 'wind' && ph !== 'fly' && ph !== 'after') return false;
  const w = ph === 'wind' ? ss(0, 0.16, u) : ph === 'after' ? 1 - ss(0.12, 0.42, u) : 1, wf = ph === 'after' ? 1 - ss(0.2, 0.3, u) : sharp(w);
  if (w <= 0.001) return false;
  const L = strikePose(ph, u);
  for (const k of KEYS) P[k] = lerp(P[k], L[k], FACE.has(k) ? wf : w);
  // her eyes: on the target while she winds up, then on the chick all the way
  if (WORLD.head) { const dx = (STK.tx - WORLD.head[0]) * WORLD.sx, dy = STK.ty - WORLD.head[1], l = Math.hypot(dx, dy) || 1; P.pdx = lerp(P.pdx, (dx / l) * 1.6, wf); P.pdy = lerp(P.pdy, (dy / l) * 1.4, wf); }
  world.wind = ph === 'wind' && u > WIND;
  return wf > 0.5;
}
// the near wing again, over the chick (only while the wing is under it)
export function henWingOver(ctx) {
  if (!WORLD.m) return;
  ctx.save();
  ctx.setTransform(WORLD.m);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  wing(ctx, WORLD.ol, 1, -1, WORLD.wa, WORLD.sp, false);
  ctx.restore();
}

/* ------------------------------------------------------------------ per-hen state */
const HENS = {}; // key -> state

function fresh(t, face) {
  return { t, c: 0, w: { worry: 0, cry: 0, dance: 0 }, x: 0, sv: 0, phase: 0, mood: 'idle', n: 0, cheerAt: -9, cheerK: 0, cheerV: -1, queued: false,
    startleAt: -9, startleK: 0, startleV: -1, phewAt: -9, phewK: 0, phewV: -1, worryT: 0, face, faceT: face, sec: null };
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
// h: hen height (px); (cx, cy): centre of its box. mood: 'idle'|'happy'|'dance'|'worried'|'gasp'|'phew'|'cry'|'sad'.
// o: {key, n (bumps on every game event so a repeated mood retriggers), look (-1..1 walk toward, undefined = stand still),
//     danger (0..1), enter (s since appearing), phase (s offset), shadow (alpha), calm (reduced motion),
//     face (-1 faces left, the default; 1 faces right), variant (QA strips: force a reaction variant 0..2)}
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

  // ---- events: a new mood or a bumped counter fires the one-shot layers (each picks a variant)
  const n = o.n || 0, again = n !== st.n || mood !== st.mood;
  const tg = moodTargets(mood, o.danger || 0);
  const fireCheer = (skip) => { st.cheerAt = st.c - (skip ? 0.085 : 0); st.cheerK++; st.cheerV = o.variant != null ? o.variant : skip && st.cheerV === 0 ? 0 : nextVariant(st.cheerV, st.cheerK + n); st.queued = false; };
  if (again) {
    if (mood === 'happy') {
      const u = st.c - st.cheerAt, len = REACT.happy[Math.max(0, st.cheerV)].len;
      if (u > len * 0.7 || st.cheerAt < -1) fireCheer(false);
      else st.queued = true; // still in the air: fire when it lands
    }
    if (mood === 'gasp' && st.worryT < 0.3) { st.startleAt = st.c; st.startleK++; st.startleV = o.variant != null ? o.variant : nextVariant(st.startleV, st.startleK + n); }
    else if (mood === 'worried' && st.worryT < 0.3) { st.startleAt = st.c; st.startleK++; st.startleV = 0; } // something creeping close: the plain jump
    if (mood === 'phew') { st.phewAt = st.c; st.phewK++; st.phewV = o.variant != null ? o.variant : nextVariant(st.phewV, st.phewK + n); }
    st.mood = mood; st.n = n;
  }
  if (st.queued && st.c - st.cheerAt > REACT.happy[Math.max(0, st.cheerV)].len * 0.7) fireCheer(true); // later hops skip the crouch
  if (calm) { st.cheerAt = -9; st.startleAt = -9; st.phewAt = -9; st.queued = false; }

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
  // the face snaps between the states while the body eases (calm: the weights are already 0 or 1)
  let fW = sharp(st.w.worry), fC = sharp(st.w.cry), fD = sharp(st.w.dance);
  const fsum = fW + fC + fD; if (fsum > 1) { fW /= fsum; fC /= fsum; fD /= fsum; }
  blendInto(P, idlePose(tt), wI, Math.max(0, 1 - fW - fC - fD));
  blendInto(P, worryPose(tt), wW, fW);
  blendInto(P, cryPose(tt), wC, fC);
  blendInto(P, dancePose(tt), wD, fD);

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
  const ev = henIdleEvents(tt);
  if (!calm && wI > 0.001) {
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
    if (o.look === undefined || Math.abs(o.look) < 0.05) { // a glance when nothing holds her look: eyes first, then the head
      P.pdx += ev.dx * wI; P.pdy += ev.dy * wI;
      P.hx += ev.hx * 2.4 * wI; P.hy += ev.hy * 1.2 * wI; P.hr += ev.hx * 0.07 * wI; P.bw -= Math.abs(ev.hx) * 0.5 * wI;
    }
  }
  let blink = !calm && wC < 0.5 ? ev.blink : 0;

  // ---- one-shot reactions
  let burst = -1, heart = -1, breath = -1;
  const cu = calm ? 99 : st.c - st.cheerAt, R1 = REACT.happy[Math.max(0, st.cheerV)];
  if (cu >= 0 && cu < R1.len + 0.3) { const x = R1.f(P, cu) || {}; if (x.burst >= 0) burst = x.burst; }
  const su = calm ? 99 : st.c - st.startleAt, R2 = REACT.gasp[Math.max(0, st.startleV)];
  if (su >= 0 && su < R2.len) R2.f(P, su);
  const pu = calm ? 99 : st.c - st.phewAt, R3 = REACT.phew[Math.max(0, st.phewV)];
  if (pu >= 0 && pu < R3.len) { const x = R3.f(P, pu) || {}; if (x.heart >= 0) heart = x.heart; if (x.breath >= 0 && x.breath < 1) breath = x.breath; }
  // ---- the Chick Strike (the world hen only): the chick lands on her back, she winds her wing under it and bats it away
  let world = null;
  if (key === 'level') { world = {}; if (STK.n++ < 3 && !calm) { const b = strikeLayer(P, world); if (b) blink = 0; } }

  // ---- overlapping action: damped springs on the comb, tail and wing tips, pushed by the body's speed
  if (!st.sec) st.sec = { pl: P.lift, px: st.x + P.dx, c: 0, cv: 0, t: 0, tv: 0, w: 0, wv: 0 };
  const S = st.sec;
  if (dt > 0) {
    const vy = (P.lift - S.pl) / dt, vx = ((st.x + P.dx - S.px) / dt) * (st.face >= 0 ? 1 : -1);
    const steps = Math.ceil(dt * 120), hdt = dt / steps;
    for (let i = 0; i < steps; i++) for (const k of ['c', 't', 'w']) {
      const v = k + 'v';
      S[v] += (220 * (secTarget(k, vy, vx) - S[k]) - 13 * S[v]) * hdt;
      S[k] += S[v] * hdt;
    }
  }
  S.pl = P.lift; S.px = st.x + P.dx;
  if (!calm) applySecondary(P, S.c, S.t, S.w);

  // ---- blink, look and beak taps feed the face. look is on screen (-1 = left): in her frame that is * facing
  const fs = st.face >= 0 ? 1 : -1;
  P.pdx += (o.look || 0) * 0.8 * fs;
  P.beak += beakPeck;
  return drawHenPose(ctx, P, cx, cy, h, { face: st.face, x: st.x, blink, tt, shadow: o.shadow, enter: o.enter, calm, breath, world,
    burst: burst >= 0 ? { u: burst, k: st.cheerK } : null, loose: st.w.worry > 0.3 && P.tufts > 0.3 ? st.w.worry : 0, notes: wD, heart });
}

// Draw the hen in a given pose P (see KEYS), centred on (cx, cy), h px tall. The win-screen routines (render/cheer.js)
// drive this directly. o: {face (-1..1, fractional while turning), x (walk offset, units), blink (0..1), tt (s, for
// flutter), shadow, enter, calm, burst {u, k}, loose (0..1), notes (0..1), heart (s, or -1), hat(ctx, P) drawn in the
// head's frame (crowns, an egg balanced on her head)}
export function drawHenPose(ctx, P, cx, cy, h, o = {}) {
  if (!(h > 0)) return false;
  const tt = o.tt || 0, calm = !!o.calm, face = o.face == null ? -1 : o.face;
  const fs = face >= 0 ? 1 : -1;
  const v = (k) => (P[k] == null || P[k] !== P[k] ? REST[k] : P[k]); // a routine that never heard of a key gets the rest face
  const hap = clamp(v('eHappy'), 0, 1), sqz = clamp(v('eSqueeze'), 0, 1), wide = clamp(v('eWide'), 0, 1.4), worry = clamp(v('brow'), 0, 1), grit = clamp(v('grit'), 0, 1), tear = clamp(v('tear'), 0, 1);
  const f = { hap, sqz, wide, wink: clamp(v('wink'), 0, 1), lid: v('lid'), low: v('low'), pup: clamp(v('pup'), 0.15, 1.3), tilt: grit * 0.6 - worry * 0.62, by: -v('browY') + Math.min(1, wide) * 1.3 + hap * 1.1,
    bw: clamp(v('bw'), 0, 1), bwF: clamp(v('bwF'), 0, 1), smile: clamp(v('smile') + hap * 0.7 - Math.max(sqz, tear) * 1.3, -1, 1), cheek: clamp(Math.max(v('cheek'), hap * 0.9), 0, 1), teeth: v('teeth'),
    pdx: v('pdx'), pdy: v('pdy'), beak: v('beak'), tear: v('tear'), blink: o.blink || 0 };
  ctx.save();
  try {
    ctx.translate(cx, cy);
    ctx.scale(h / 100, h / 100);
    const pop = o.enter != null && o.enter < 0.6 && !calm ? Math.max(0.001, easeOutBack(clamp(o.enter / 0.5, 0, 1))) : 1;
    if (pop !== 1) { ctx.globalAlpha *= clamp(o.enter * 8, 0, 1); ctx.translate(0, 48); ctx.scale(pop, pop); ctx.translate(0, -48); }
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.translate((o.x || 0) + P.dx, 0);
    const ol = outlineW(h);
    // contact shadow: shrinks and fades as she hops
    if (o.shadow) {
      const k = 1 / (1 + Math.max(0, P.lift) / 22);
      ctx.fillStyle = `rgba(0,0,0,${(o.shadow * k).toFixed(3)})`;
      ctx.beginPath(); ctx.ellipse(-2 * fs, 48.5, 34 * k, 7 * k, 0, 0, TAU); ctx.fill();
    }
    ctx.save();
    const tw = Math.cos(P.twirl || 0);
    ctx.scale(fs * Math.max(0.1, Math.abs(face)) * (Math.abs(tw) < 0.3 ? (tw < 0 ? -0.3 : 0.3) : tw), 1); // her own frame faces +x
    if (P.spin) { const py = 14 - P.lift; ctx.translate(0, py); ctx.rotate(P.spin); ctx.translate(0, -py); }
    drawLegs(ctx, P, ol);
    ctx.save();
    ctx.translate(0, 44 - P.lift);
    ctx.rotate(P.lean + P.sway);
    const sy = 1 + P.sq, sx = 1 - 0.7 * P.sq;
    ctx.scale(sx * P.puff, sy * P.puff);
    ctx.translate(0, -44);
    const H = { x: 20 + P.hx, y: -27.5 + P.hy };
    const fw = clamp(P.fw || 0, 0, 1);
    wing(ctx, ol, 9 - 14 * fw, -6 - 5 * fw, P.wf - 0.12, P.sp, true); // far wing: behind the body, darker (hidden while folded)
    drawTail(ctx, P, ol);
    if (P.tufts > 0.02) drawTufts(ctx, P.tufts, tt, ol);
    drawBody(ctx, H, ol);
    drawHead(ctx, H, P, f, tt, ol, o.hat);
    wing(ctx, ol, 1, -1, P.wa, P.sp, false); // near wing, over the body (and over her eye when she wipes it)
    if (o.breath >= 0 && o.breath < 1) drawBreath(ctx, H.x + 25, H.y + 5, o.breath);
    if (o.world && ctx.getTransform) { // Chick Strike: where her back, her wing's palm and her head are on the canvas
      const m = ctx.getTransform(), T = (x, y) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
      const a = Math.PI - 0.3 + P.wa, ca = Math.cos(a), sa = Math.sin(a), px = 1 + 24 * ca - 6 * sa, py = -1 + 24 * sa + 6 * ca;
      WORLD.m = m; WORLD.ol = ol; WORLD.wa = P.wa; WORLD.sp = P.sp; WORLD.n = 0; WORLD.sx = m.a < 0 ? -1 : 1; WORLD.u = Math.hypot(m.a, m.b);
      WORLD.seat = T(-21, -15.5); WORLD.palm = T(px, py - 1); WORLD.head = T(H.x + 5, H.y - 2);
      WORLD.ride = !!o.world.wind && py - 1 < -15.5; WORLD.over = !!o.world.wind && P.wa > 0.1;
    }
    if (P.sweat > 0.02) { const k = fract(tt * 0.8); drawDrop(ctx, H.x - 19, H.y - 9 + k * 9, 3.6, ol * 0.7, (1 - k * 0.6) * clamp(P.sweat, 0, 1)); }
    ctx.restore();
    if (o.burst && o.burst.u >= 0) drawBurst(ctx, o.burst.u, o.burst.k, ol);
    if (o.loose > 0) drawLoose(ctx, tt, ol, o.loose);
    ctx.restore();
    if (o.notes > 0.05) drawNotes(ctx, tt, ol, o.notes);
    if (o.heart >= 0 && o.heart < 1) drawHeart(ctx, 14 * fs, -58 - o.heart * 16, 7 + 2 * Math.sin(Math.min(1, o.heart * 3) * Math.PI), ol, 1 - ss(0.65, 1, o.heart));
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
    const fy = Math.min(48, 48 - P.lift - l.up), top = 32 - P.lift, fx = l.x + l.st, air = clamp((l.up + P.lift) / 6, 0, 1); // feet never sink below the ground (a crouch bends the legs)
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
      ctx.lineWidth = 5 + (pass ? 0 : o * 1.4);
      ctx.beginPath(); ctx.moveTo(l.x, l.top); ctx.lineTo(l.fx, l.fy); ctx.stroke();
      ctx.lineWidth = 3.3 + (pass ? 0 : o * 1.4);
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
  c.quadraticCurveTo(H.x - 15, H.y + 12, H.x - 12, H.y + 4);
  c.lineTo(H.x + 11, H.y + 7);
  c.quadraticCurveTo(H.x + 14, H.y + 18, 31, -1);
  c.closePath();
};
const headPath = (H) => (c) => { c.moveTo(H.x + 13 * HS, H.y); c.ellipse(H.x, H.y + 0.6, 13 * HS, 12.4 * HS, 0, 0, TAU); };

function drawBody(ctx, H, o) {
  const parts = [bodyPath, neckPath(H), headPath(H)];
  ctx.lineJoin = 'round';
  ctx.lineWidth = o * 2;
  ctx.strokeStyle = LINE;
  ctx.fillStyle = LINE;
  for (const p of parts) { ctx.beginPath(); p(ctx); ctx.stroke(); ctx.fill(); }
  ctx.translate(o * 0.25, o * 0.6); // line weight: heavier under her, away from the light
  for (const p of parts) { ctx.beginPath(); p(ctx); ctx.stroke(); }
  ctx.translate(-o * 0.25, -o * 0.6);
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
function drawHead(ctx, H, P, f, tt, o, hat) {
  ctx.save();
  ctx.translate(H.x, H.y);
  ctx.rotate(P.hr);
  ctx.scale(HS, HS);
  // highlight: a soft lit patch on the back of the crown
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath(); ctx.ellipse(-6, -6.5, 4.2, 2.6, -0.6, 0, TAU); ctx.fill();
  // comb: four lobes (smaller than the rooster's five), wobbling from its base
  ctx.save();
  ctx.translate(1, -10); ctx.rotate(P.comb); ctx.translate(-1, 10);
  const combPath = (c) => { // three soft lobes, tallest in the middle, leaning a little forward
    c.moveTo(-9.5, -8.5);
    c.bezierCurveTo(-14, -13, -10.5, -19.5, -5, -16.5);
    c.bezierCurveTo(-5, -22.5, 3, -25, 4.6, -18.6);
    c.bezierCurveTo(7.5, -22, 13.8, -19, 11.6, -13.4);
    c.bezierCurveTo(14, -11.5, 12.5, -8, 10, -7.6);
    c.closePath();
  };
  ctx.lineWidth = o * 2 / HS; ctx.strokeStyle = RED.line; ctx.beginPath(); combPath(ctx); ctx.stroke();
  ctx.fillStyle = grad(ctx, -4, -24, 4, -8, ['#ff5a43', RED.hi, RED.lo]); ctx.beginPath(); combPath(ctx); ctx.fill();
  ctx.save(); ctx.beginPath(); combPath(ctx); ctx.clip();
  ctx.fillStyle = 'rgba(120,10,10,0.35)'; ctx.beginPath(); ctx.ellipse(3, -8, 14, 3.6, 0.05, 0, TAU); ctx.fill(); // where it meets the crown
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-9.2, -14.5); ctx.quadraticCurveTo(-8.6, -17, -6.4, -17.2); ctx.moveTo(-1.6, -21); ctx.quadraticCurveTo(0, -22.6, 2, -22); ctx.moveTo(8.2, -18.6); ctx.quadraticCurveTo(9.6, -19, 10.6, -17.8); ctx.stroke();
  ctx.restore();
  // the acting face: two eyes with lids, a brow each (the far eye is foreshortened and sits just above the beak)
  const a0 = ctx.globalAlpha;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const lids = [NE, FE].map((E) => drawEye(ctx, E, f, o));
  drawBrow(ctx, NE, f, lids[0]); drawBrow(ctx, FE, f, lids[1]);
  if (f.cheek > 0.3 && f.sqz < 0.5) { // the cheek crease of a real smile, under the near eye
    ctx.strokeStyle = 'rgba(150,104,58,0.8)'; ctx.lineWidth = o * 0.5;
    ctx.beginPath(); ctx.moveTo(NE.x - NE.rx * 0.8, NE.y + NE.ry * 1.18); ctx.quadraticCurveTo(NE.x - 0.3, NE.y + NE.ry * (1.2 + 0.26 * f.cheek), NE.x + NE.rx * 0.6, NE.y + NE.ry * 1.14); ctx.stroke();
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
  // wattle and beak: the rooster's two-part beak, shorter; open is in the old units (0 shut .. ~5.5 wide). The lower half
  // swings on its hinge and the upper lifts a little (a real gape); teeth when she grits, a tongue, a corner that smiles or frowns
  const open = clamp(f.beak / 5, 0, 1.2), sm = f.smile;
  solid(ctx, o * 0.8, (c) => { c.moveTo(8, 6 + open * 3); c.quadraticCurveTo(13.5, 8.5 + open * 3, 10.5, 14.5 + open * 3); c.quadraticCurveTo(6.5, 13 + open * 3, 6.5, 7 + open * 2.5); c.closePath(); }, grad(ctx, 0, 6, 0, 16, [RED.hi, RED.lo]), RED.line);
  ctx.save(); ctx.translate(9, 1); ctx.rotate(-0.07 * sm * (1 - Math.min(1, open)));
  const la = open * 0.62, ua = -open * 0.2;
  if (open > 0.08) {
    ctx.save(); ctx.rotate(la);
    solid(ctx, o * 0.8, (c) => { c.moveTo(0, 0); c.lineTo(10.5, 1); c.lineTo(9.5, 3.8); c.lineTo(0, 4.4); c.closePath(); }, grad(ctx, 0, 0, 10, 4, [BEAK.hi, BEAK.lo]), BEAK.line);
    ctx.restore();
    const ca = Math.cos(la), sa = Math.sin(la), cu = Math.cos(ua), su = Math.sin(ua);
    const mouth = (c) => { c.moveTo(0.3, 0.6); c.lineTo(10.6 * cu - 0.9 * su, 10.6 * su + 0.9 * cu); c.lineTo(10 * ca - 0.8 * sa, 10 * sa + 0.8 * ca); c.lineTo(0.3, 3.6 + open * 1.2); c.closePath(); };
    ctx.fillStyle = '#5a1710'; ctx.beginPath(); mouth(ctx); ctx.fill();
    ctx.save(); ctx.beginPath(); mouth(ctx); ctx.clip();
    if (f.teeth > 0.5) { // gritted: a row of teeth fills the gap
      ctx.fillStyle = '#fff6df'; ctx.fillRect(-2, -8, 16, 24);
      ctx.strokeStyle = '#b79a6c'; ctx.lineWidth = o * 0.35; ctx.beginPath();
      for (let i = 1; i < 5; i++) { ctx.moveTo(i * 2.1, -6); ctx.lineTo(i * 2.1 + 0.5, 12); }
      ctx.stroke();
    } else { ctx.fillStyle = '#ff7a8a'; ctx.beginPath(); ctx.ellipse(4.6 * ca - 2.4 * sa * 0.4, 2.2 + open * 2.4, 3.6, 1.3 + open * 1.1, la * 0.6, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  ctx.save(); ctx.translate(0, 1.5); ctx.rotate(ua); ctx.translate(0, -1.5);
  solid(ctx, o * 0.8, (c) => { c.moveTo(-0.5, -4); c.quadraticCurveTo(6.5, -4.8, 12, 0.8); c.quadraticCurveTo(6, 2.6, -0.5, 2.6); c.closePath(); }, grad(ctx, 0, -5, 0, 3, [BEAK.hi, BEAK.lo]), BEAK.line);
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(3.5, -2.4, 2.4, 0.8, 0.1, 0, TAU); ctx.fill();
  ctx.restore();
  if (Math.abs(sm) > 0.08) { // the corner of the beak runs back onto her cheek: up for a smile, down for a frown
    const cy0 = 2.5 + (open > 0.08 ? 1.6 + open * 1.6 : 0), k = open > 0.08 ? 0.75 : 1;
    ctx.strokeStyle = BEAK.line; ctx.lineWidth = o * 0.75; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0.2, cy0); ctx.quadraticCurveTo(-2.2, cy0 + 0.5, -3.1 * k, cy0 - 3.1 * sm * k); ctx.stroke();
  }
  ctx.restore();
  if (hat) hat(ctx, P, o); // in the head's frame: (0, -16) is the top of her crown under the comb
  ctx.restore();
}

// near and far eye (k = foreshortening; sd = which way its inner end, the one by the bridge of the beak, lies)
const NE = { x: 0, y: 1, rx: 5.2, ry: 5.6, k: 1, sd: 1 }, FE = { x: 10.2, y: -0.3, rx: 3.3, ry: 4.9, k: 0.66, sd: -1 };
const LID = '#f0d9ae', BROW = LINE, PUPIL = '#0d0806'; // brows in her outline brown
// One eye: a white with her dark iris (the old dot eye lives on inside it: warm lower iris, a white glint), an upper lid
// whose edge carries the attitude (it tilts with the brow), a lower lid the cheek pushes up. Shut: the scrunched > <, the
// laughing arc, or just the closed lid (a blink, relief). Returns how far the upper lid is down (the brow rides on it).
function drawEye(ctx, E, F, o) {
  const near = E.sd > 0, hap = near ? Math.max(F.hap, F.wink) : F.hap * (1 - F.wink), ck = near ? F.bw : F.bwF;
  const sc = 1 + 0.1 * Math.min(1.3, F.wide), rx = E.rx * sc, ry = E.ry * sc, cx = E.x, cy = E.y - 0.4 * F.wide;
  const shutK = Math.max(hap, F.sqz), closing = Math.max(ss(0, 0.5, shutK), F.blink);
  const lid = lerp(clamp(F.lid - 0.3 * F.wide - ck * 0.13, -0.1, 1.05), 1.05, closing), low = lerp(clamp(F.low + F.cheek * 0.13, 0, 0.6), 0.42, ss(0, 0.5, shutK));
  const shut = shutK > 0.5 ? (F.sqz >= hap ? 1 : 2) : lid >= 0.82 ? 3 : 0;
  const el = () => { ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); };
  ctx.save();
  if (shut) {
    ctx.strokeStyle = EYE;
    if (shut === 3) { el(); ctx.fillStyle = LID; ctx.fill(); }
    ctx.beginPath();
    if (shut === 1) { const w = 4.2 * E.k; ctx.moveTo(cx - E.sd * w, cy - 3.6); ctx.lineTo(cx + E.sd * w, cy - 0.2); ctx.lineTo(cx - E.sd * w, cy + 3.2); ctx.lineWidth = o * 1.2; }
    else if (shut === 2) { ctx.moveTo(cx - 4.7 * E.k, cy + 1.9); ctx.quadraticCurveTo(cx, cy - 5.4, cx + 4.7 * E.k, cy + 1.9); ctx.lineWidth = o * 1.3; }
    else { ctx.moveTo(cx - rx * 0.86, cy + ry * 0.22); ctx.quadraticCurveTo(cx, cy + ry * 0.86, cx + rx * 0.86, cy + ry * 0.22); ctx.lineWidth = o * 0.95; }
    ctx.stroke();
    ctx.restore();
    return shut === 3 ? 1 : 0.3;
  }
  const ang = clamp(F.tilt * (1 - ck * 0.6), -0.8, 0.8), yb = cy - ry * 1.06 + 2 * ry * lid, sl = E.sd * Math.tan(ang * 0.8), Y = (x) => yb + (x - cx) * sl;
  el(); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.beginPath(); ctx.ellipse(cx - rx * 0.14, cy - ry * 0.16, rx, ry, 0, 0, TAU); ctx.rect(cx - rx * 2, cy - ry * 2, rx * 4, ry * 4); ctx.fillStyle = 'rgba(190,160,130,0.45)'; ctx.fill('evenodd'); // the white is shaded on its lower front, like the rest of her
  const ir = 4.35 * (0.2 + 0.8 * F.pup) * (near ? 1 : 0.86), lx = clamp(F.pdx / 1.6, -1, 1), ly = clamp(F.pdy / 1.4, -1, 1);
  const px = cx + lx * Math.max(0.4, rx - ir * 0.8) * 0.9 + E.sd * rx * 0.05, py = Math.max(cy + ly * ry * 0.34 + ry * 0.04, Math.min(cy + ry * 0.42, Y(px) + ir * 0.5));
  // a big dark iris (~80% of the white's height at rest, a pin in a take), a near-black pupil, one crisp highlight
  const iw = ir * (near ? 0.9 : 0.76), ih = ir * 1.04;
  ctx.fillStyle = EYE; ctx.beginPath(); ctx.ellipse(px, py, iw, ih, 0, 0, TAU); ctx.fill();
  if (ir > 2) { ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(150,88,42,0.6)'; ctx.beginPath(); ctx.ellipse(px, py + ih * 0.95, iw * 0.9, ih * 0.4, 0, 0, TAU); ctx.fill(); ctx.restore(); } // a thin warm rim low in the iris
  ctx.fillStyle = PUPIL; ctx.beginPath(); ctx.ellipse(px, py, iw * 0.6, ih * 0.62, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; dot(ctx, px - iw * 0.38, py - ih * 0.4, Math.max(0.9, ir * 0.3));
  if (lid > 0.02) { // the upper lid and its edge
    ctx.beginPath(); ctx.moveTo(cx - rx * 2, Y(cx - rx * 2)); ctx.lineTo(cx + rx * 2, Y(cx + rx * 2)); ctx.lineTo(cx + rx * 2, cy - ry * 2); ctx.lineTo(cx - rx * 2, cy - ry * 2); ctx.closePath();
    ctx.fillStyle = LID; ctx.fill(); ctx.lineWidth = o * 0.6; ctx.strokeStyle = EYE; ctx.stroke();
  }
  if (low > 0.01) { // the lower lid: the cheek pushes up in an arc
    const yl = cy + ry - 2 * ry * low;
    ctx.beginPath(); ctx.moveTo(cx - rx * 1.4, cy + ry * 1.3); ctx.lineTo(cx - rx * 1.4, yl + ry * 0.3); ctx.quadraticCurveTo(cx, yl - ry * (0.34 + F.cheek * 0.25), cx + rx * 1.4, yl + ry * 0.3); ctx.lineTo(cx + rx * 1.4, cy + ry * 1.3); ctx.closePath();
    ctx.fillStyle = LID; ctx.fill(); ctx.lineWidth = o * 0.45; ctx.strokeStyle = LINE; ctx.stroke();
  }
  ctx.restore();
  el(); ctx.lineWidth = o * 0.7; ctx.strokeStyle = EYE; ctx.stroke();
  ctx.restore();
  return clamp(lid, 0, 1);
}
// a feather brow over each eye: thick at the bridge, tapering out; each side tilts and raises on its own
function drawBrow(ctx, E, F, lid) {
  const sd = E.sd, ck = sd > 0 ? F.bw : F.bwF, ang = clamp(F.tilt * (1 - ck * 0.6), -0.8, 0.8), tn = Math.tan(ang);
  const y0 = E.y - E.ry * 1.2 + E.ry * Math.max(0, lid - 0.2) * 0.7 - Math.min(1.3, F.by * 0.55 + ck * 1.0); // her comb sits low: a raised brow lifts a little and arches, never onto the comb
  const xi = E.x + sd * E.rx * 1.0, xo = E.x - sd * E.rx * 1.08, th = 2.7 * (sd > 0 ? 1 : 0.82), ar = E.ry * (0.12 + ck * 0.1);
  let yi = y0 + tn * E.rx * 1.15, yo = y0 - tn * E.rx * 0.8 + E.ry * 0.12;
  const top = Math.min(yi - th * 0.55, yo, (yi + yo) / 2 - ar - th * 0.6), push = Math.max(0, -6.6 - top); // the comb's lower edge: the brow stays on her face, a gap of feathers between
  yi += push; yo += push;
  ctx.beginPath(); ctx.moveTo(xo, yo); ctx.quadraticCurveTo(E.x, (yi + yo) / 2 - ar - th * 0.6, xi, yi - th * 0.55); ctx.lineTo(xi + sd * th * 0.15, yi + th * 0.5); ctx.quadraticCurveTo(E.x, (yi + yo) / 2 - ar + th * 0.5, xo, yo); ctx.closePath();
  ctx.fillStyle = BROW; ctx.fill();
}

// a puff of breath off her beak (phew): three small clouds that drift forward, swell and fade
function drawBreath(ctx, x, y, u) {
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const k = clamp(u * 1.25 - i * 0.12, 0, 1); if (k <= 0 || k >= 1) continue;
    ctx.globalAlpha *= 1; ctx.fillStyle = `rgba(255,255,255,${(0.85 * (1 - k * k)).toFixed(3)})`; ctx.strokeStyle = `rgba(107,74,42,${(0.5 * (1 - k)).toFixed(3)})`; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(x + k * (11 + i * 5), y + 1 - k * (2 + i * 2.2) + i * 1.2, 2 + k * (3.4 - i * 0.6), 0, TAU); ctx.fill(); ctx.stroke();
  }
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

// a small heart (pink, outlined) floating up from her when she is relieved
export function drawHeart(ctx, x, y, r, o, alpha = 1) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, r * 0.9);
  ctx.bezierCurveTo(-r * 1.4, -r * 0.1, -r * 0.7, -r * 1.25, 0, -r * 0.45);
  ctx.bezierCurveTo(r * 0.7, -r * 1.25, r * 1.4, -r * 0.1, 0, r * 0.9);
  ctx.closePath();
  ctx.fillStyle = '#ff6f8f'; ctx.fill();
  ctx.lineWidth = o * 0.8; ctx.strokeStyle = '#8a2a3a'; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(-r * 0.42, -r * 0.35, r * 0.22, r * 0.14, -0.6, 0, TAU); ctx.fill();
  ctx.restore();
}
