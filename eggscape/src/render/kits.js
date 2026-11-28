// The kits: mama raccoon's babies (0.8.18). Tiny raccoons in Bandit's house style (render/raccoon.js: dark outline,
// two-tone fur, the black mask, a ringed tail) but baby-proportioned: a big round head, huge eyes, a small pear body, stubby
// limbs. Three of them, each its own little character (o.who):
//   0 KEEN    silver, a tuft on his head, ears up, eyes bright, always first; leads the way, struts, sprints, never cries
//   1 CLUMSY  the big cinnamon one, rounder, a sticking plaster on the ear; waddles, trips, flails, bawls; pulls
//   2 SLEEPY  the dusky runt, droopy ears, heavy lids, a drifting "z"; shuffles, yawns, dozes off anywhere; pushes
// (2026-11-27, the owner: "like one baby copied thrice". So each has his own size, fur, stride, way of doing every beat
// and his own unscripted moments (quirk(): a glance back, a trip, a yawn) on his own clock. All of it is drawn from the
// clock and the sim's state, never from a random number, so rewind and the hint show the same thing twice.)
// drawKit(ctx, x, y, s, t, pose, o) draws one in a local y-DOWN pixel space: (x, y) the floor point between his feet, facing
// +x (o.face -1 mirrors), s = px per 100 rig units (he stands about 80 units tall). pose from kitPose(state, t, u, o).
// o: { face, who, costume, calm, frozen, low (PERF.low: flat fills, no tail rings detail), noTail }
// kitPose states: sit, walk (u = gait phase, else t), run, wait (looking up, a foot tapping), lift (u: crouch, heave),
// pull, push (u = gait phase: the carry, wobbling under the weight), ride (on top, cheering), tumble (dizzy, splayed),
// dangle (upside down by the tail, flailing; the caller turns the frame), cry (running home in tears; u gait), dive
// (a stretched leap), pop (u: rolling out of the sack, the shake, the sniff), climb (reaching up, the kit tower), wail
// (where they fell, before the run home: a tantrum, a bawl, a sniffle).
import { spline, blinkAt, hash, clamp, lerp, ss, back } from './castkit.js';
import { dizzyStars, spiralEye } from './status.js';
import { costumeHead, costumeNeck } from './costume.js';

const TAU = Math.PI * 2;
export const KIT_M = 0.55; // metres per 100 rig units (the rig stands about 77 units: 0.42 m at KIT_M; play draws him KS bigger)
export const HEAD = 1.2; // the head drawn this much bigger than the rig's (2026-11-27: faces must read at phone size)
const PAL = {
  line: '#221622', fur: '#a2a2b8', furLo: '#7a7894', furHi: '#c6c7d8', cream: '#f4efe6', creamLo: '#d4cbc8', mask: '#3b3548', maskHi: '#575068',
  paw: '#40394e', nose: '#1a1118', earIn: '#efa5a5', eyeW: '#fffdf4', iris: '#8a4a12', irisHi: '#e6a232', pupil: '#150a06', mouth: '#5a1420', tongue: '#f0707c',
  ringD: '#3b3548', ringL: '#cfd0de', tear: '#7fd0ff', plaster: '#f2c79a', blush: 'rgba(255,120,140,0.35)',
};
// each kit his own coat and size (o.who)
export const KIT_SZ = [1, 1.13, 0.92];
const RATE = [1.16, 0.9, 0.76]; // strides per metre: the keen one's quick little steps, the sleepy one's shuffle
const COAT = [null,
  { fur: '#b89a80', furLo: '#8e715c', furHi: '#dfcab6', mask: '#49363a', maskHi: '#695150', paw: '#4c3a3c', ringD: '#49363a', ringL: '#e8d8c4', iris: '#5a7a1e', irisHi: '#a8c83c' },
  { fur: '#8087ab', furLo: '#5a6086', furHi: '#a9b1cf', mask: '#2b2940', maskHi: '#45415e', paw: '#322f48', ringD: '#2b2940', ringL: '#c2c8e0', iris: '#3a6a8a', irisHi: '#6ab8d8' }];
const PALS = COAT.map((c) => (c ? { ...PAL, ...c } : PAL));
const iced = (P0) => { const o = {}, hx = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; for (const k in P0) o[k] = P0[k].startsWith('#') ? '#' + hx(P0[k]).map((v, i) => Math.round(v + (hx('#bfe6ff')[i] - v) * 0.55).toString(16).padStart(2, '0')).join('') : P0[k]; return o; };
const ICEDS = PALS.map(iced);

const REST = { by: 0, dx: 0, rot: 0, sq: 0, hx: 3, hy: -30, hr: 0, a0x: 8, a0y: -6, a1x: 14, a1y: -7, f0x: -5, f0y: 0, f1x: 6, f1y: 0, fr0: 0, fr1: 0,
  look: 0.4, looky: 0, lid: 0.1, pup: 1, brow: 0.2, mouth: 0, smile: 0.6, teeth: 0, tongue: 0, ear: 0, tail: 0.5, tc: 1, tw: 0, puff: 0,
  tear: 0, stars: 0, spiral: 0, squeeze: 0, happy: 0, z: 0, cheek: 0, blush: 0, g0: 0.4, g1: 0.4 };
export const KIT_KEYS = Object.keys(REST);
const P = (o) => Object.assign({}, REST, o);
const fract = (x) => x - Math.floor(x);
// personality on top of any pose
function who(p, w, t) {
  if (w === 0) { p.ear = Math.min(p.ear, 0.1) - 0.15; p.pup *= 1.08; p.brow += 0.15; }
  if (w === 2) { if (p.lid > 0.75) p.z = 1; p.lid = Math.max(p.lid, 0.42 + 0.08 * Math.sin(t * 0.9)); p.brow -= 0.15; p.ear = Math.max(p.ear, 0.55); }
  return p;
}
// an unscripted moment now and then, each kit on his own clock: [which of three, 0..1 in and out] or null. A window
// every few seconds (its length his own), a hash of the window's number says whether he does something in it and what.
export function quirk(w, t) {
  const W = [2.6, 3.3, 3.9][w] || 3, x = t / W + w * 0.37, n = Math.floor(x), f = x - n;
  if (f < 0.2 || f > 0.8 || hash(n * 17 + w * 131 + 5) > 0.62) return null;
  return [Math.floor(hash(n * 29 + w * 71 + 3) * 3), Math.sin(((f - 0.2) / 0.6) * Math.PI)];
}
function quirks(p, w, t, moving) {
  const q = quirk(w, t); if (!q) return p;
  const [n, k] = q, K = ss(0, 0.5, k);
  if (w === 0) {
    if (n === 0) { p.look = lerp(p.look, -1, K); p.hr -= 0.3 * K; p.a0x = lerp(p.a0x, 20, K); p.a0y = lerp(p.a0y, -30, K); p.mouth = Math.max(p.mouth, 0.4 * K); } // "come on!": a look back, a beckoning paw
    else if (n === 1) { p.by += 9 * k * Math.abs(Math.sin(t * 9)); p.happy = K > 0.5 ? 1 : p.happy; p.mouth = Math.max(p.mouth, 0.5 * K); p.a0x = lerp(p.a0x, -14, K); p.a0y -= 22 * K; p.a1x = lerp(p.a1x, 23, K); p.a1y -= 24 * K; } // a happy skip, paws in the air
    else { p.a1x = lerp(p.a1x, 26, K); p.a1y = lerp(p.a1y, -24, K); p.brow += 0.4 * K; p.look = lerp(p.look, 1, K); } // pointing the way
  } else if (w === 1) {
    if (n === 0 && moving) { p.rot += 0.5 * k; p.a0x += 10 * k; p.a0y -= 10 * k; p.a1x += 10 * k; p.a1y -= 12 * k; p.mouth = Math.max(p.mouth, 0.5 * k); p.lid = 0; p.pup = lerp(p.pup, 0.6, K); p.f1y -= 6 * k; } // trips over his own feet
    else if (n === 1) { p.looky = lerp(p.looky, -1, K); p.hr -= 0.35 * K; p.mouth = Math.max(p.mouth, 0.35 * K); p.smile = lerp(p.smile, 0.2, K); } // gawps at the sky
    else { p.a1x = lerp(p.a1x, 11, K); p.a1y = lerp(p.a1y, -47 + 2 * Math.sin(t * 16), K); p.lid = Math.max(p.lid, 0.3 * K); p.look = lerp(p.look, -0.4, K); } // scratches the top of his head
  } else {
    if (n === 0) { p.mouth = Math.max(p.mouth, 0.95 * K); p.squeeze = K > 0.4 ? 1 : p.squeeze; p.a0x = lerp(p.a0x, -8, K); p.a0y = lerp(p.a0y, -40, K); p.a1x = lerp(p.a1x, 16, K); p.a1y = lerp(p.a1y, -42, K); p.hr -= 0.25 * K; } // a huge yawn and a stretch
    else if (n === 1) { p.lid = Math.max(p.lid, 0.97 * K); p.hr += 0.35 * K; p.by -= 2 * K; } // nods off on his feet
    else { p.a1x = lerp(p.a1x, 13, K); p.a1y = lerp(p.a1y, -31 + 1.5 * Math.sin(t * 14), K); p.lid = Math.max(p.lid, 0.7 * K); } // rubs an eye
  }
  return p;
}
export function kitPose(state, t, u = 0, o = {}) {
  const w = o.who || 0, sd = hash(w * 7 + 1) * 10, T = t + sd * 0.37, br = Math.sin(T * 3.1);
  let p;
  switch (state) {
    case 'walk': case 'run': case 'cry': {
      const fast = state !== 'walk', ph = (u > 0 ? u : T * (fast ? 2.4 : 1.7)) * RATE[w] + w * 0.31, L = (fast ? 13 : 10) / RATE[w], up = (fast ? 9 : 6) * [1.15, 1, 0.55][w];
      const st = (off) => { const k = fract(ph + off); return k < 0.5 ? [lerp(-L / 2, L / 2, ss(0, 1, k / 0.5)), -Math.sin((k / 0.5) * Math.PI) * up] : [lerp(L / 2, -L / 2, (k - 0.5) / 0.5), 0]; };
      const bob = Math.abs(Math.sin(ph * TAU)), sw = Math.sin(ph * TAU);
      const F0 = st(0), F1 = st(0.5);
      p = P({ by: 2.5 * bob, rot: fast ? 0.22 : 0.1, hr: -0.08 + 0.05 * sw, a0x: 6 - 7 * sw, a0y: -8 + 2 * bob, a1x: 12 + 7 * sw, a1y: -8 - 2 * bob, f0x: -4 + F0[0], f0y: F0[1], f1x: 5 + F1[0], f1y: F1[1],
        tail: 0.9 + 0.15 * sw, tw: sw * 0.6, ear: fast ? 0.3 : 0, smile: 0.7, mouth: fast ? 0.25 : 0.05, look: 0.8, looky: 0.1 });
      // each his own way of going
      if (w === 0) Object.assign(p, fast // the sprinter: head down, elbows pumping; walking he struts, chest out, tail high
        ? { by: 3.5 * bob, rot: 0.32, a0x: 5 - 11 * sw, a0y: -10 + 4 * sw, a1x: 12 + 11 * sw, a1y: -10 - 4 * sw, ear: 0.5, brow: 0.6, smile: 0.9, mouth: 0.35, teeth: 1, tail: 1.15 }
        : { by: 4.2 * bob, rot: 0.02, hr: -0.2 + 0.04 * sw, a0x: 6 - 10 * sw, a0y: -9, a1x: 12 + 10 * sw, a1y: -9, tail: 0.25, tc: 1.2, smile: 1, brow: 0.4 });
      if (w === 1) Object.assign(p, fast // the waddler: rolling from side to side, arms flung wide, tongue flapping
        ? { rot: 0.14 + 0.13 * Math.sin(ph * Math.PI), a0x: -16 - 3 * sw, a0y: -15 + 7 * sw, a1x: 21 + 3 * sw, a1y: -26 - 7 * sw, mouth: 0.55, tongue: 0.8, pup: 0.8, lid: 0, ear: 0.1 + 0.3 * bob, tw: sw * 1.1 }
        : { rot: 0.06 + 0.1 * sw, hr: -0.05 - 0.08 * sw, look: 0.8 * Math.sin(T * 0.8), looky: -0.2, a0x: 3 - 5 * sw, a0y: -4, a1x: 15 + 5 * sw, a1y: -4, tw: sw });
      if (w === 2) Object.assign(p, fast // the shuffler: leaning into it half asleep, arms trailing behind
        ? { by: 1.4 * bob, rot: 0.36, hr: 0.12, a0x: -9 + 2 * sw, a0y: -7, a1x: -4 - 2 * sw, a1y: -5, mouth: 0.12, smile: 0.1, ear: 0.8, tail: 1.2, tw: sw * 0.3, look: 0.6, looky: 0.4 }
        : { by: 1.1 * bob, rot: 0.2, hr: 0.26 + 0.05 * sw, a0x: 6 - 2 * sw, a0y: 2, a1x: 11 + 2 * sw, a1y: 2, smile: 0, looky: 0.7, tail: 1.35, tc: 0.5, tw: sw * 0.2 });
      if (state === 'cry') { // the run home: one furious, one in floods, one sniffling
        if (w === 0) Object.assign(p, { brow: 1, smile: -0.8, mouth: 0.3, teeth: 1, cheek: 0.7, blush: 1, ear: 0.6, look: -1, hr: -0.3, a0x: -6, a0y: -33 + 3 * Math.sin(T * 18), rot: 0.2 });
        else if (w === 1) Object.assign(p, { brow: -1, smile: -0.9, mouth: 0.7 + 0.2 * Math.sin(T * 14), tongue: 0, squeeze: 1, tear: 1, ear: 0.8, a0x: -2, a0y: -14 - 4 * bob, a1x: 16, a1y: -16 + 4 * bob, rot: 0.15 });
        else Object.assign(p, { brow: -0.9, smile: -0.6, mouth: 0.15 + 0.1 * Math.sin(T * 9), tear: 0.55, lid: 0.6, ear: 0.9, a1x: 13, a1y: -31 + 1.5 * Math.sin(T * 13), hr: 0.2, looky: 0.8 });
      } else if (!o.calm && !o.add) quirks(p, w, t, true);
      break;
    }
    case 'wait': { // under the gap: one taps his foot at it, one scratches his head, one sits down and dozes
      const tap = Math.max(0, Math.sin(T * 9)) * 4;
      if (w === 1) p = P({ by: 0.4 * br, rot: 0.04 * Math.sin(T * 1.3), hr: -0.2 + 0.15 * Math.sin(T * 1.1), look: Math.sin(T * 1.1), looky: -0.5, brow: -0.3, smile: -0.05, mouth: 0.2, a0x: 5, a0y: -2, a1x: 11, a1y: -47 + 2 * Math.sin(T * 12), f0x: -5, f1x: 7, tail: 0.5, tw: Math.sin(T * 2) * 0.5 });
      else if (w === 2) { const nod = 0.5 + 0.5 * Math.sin(T * 1.2); p = P({ by: -6, sq: 0.05, rot: 0.06, hr: 0.2 + 0.22 * nod, a0x: 9, a0y: 1, a1x: 14, a1y: 1, f0x: 4, f0y: -2, f1x: 13, f1y: -2, fr0: -0.6, fr1: -0.6, lid: 0.8 + 0.2 * nod, smile: 0.2, mouth: 0.1 * nod, tail: 0.3, tw: 0.2 }); }
      else p = P({ by: 0.4 * br, rot: -0.12, hr: -0.35, look: 0.6, looky: -0.9, brow: 0.5, smile: -0.1, a0x: -10, a0y: -4, a1x: -6, a1y: -5, f0x: -4, f1x: 6, f1y: -tap, tail: 0.6 + 0.2 * Math.sin(T * 2), tw: Math.sin(T * 3) * 0.4, ear: 0.1 });
      if (!o.calm && !o.add && w < 2) quirks(p, w, t, false);
      break;
    }
    case 'lift': { // gather, crouch (the telegraph), then the heave: arms up, cheeks puffed, eyes squeezed
      const u1 = w === 2 ? clamp((u - 0.16) / 0.84, 0, 1) : w === 1 ? clamp(u * 0.94, 0, 1) : u; // the sleepy one starts late, with a yawn
      const cr = ss(0, 0.45, u1), hv = back(ss(0.5, 0.9, u1), 2), sh = Math.sin(T * 40) * ss(0.5, 0.7, u1) * (1 - ss(0.85, 1, u1));
      p = P({ by: -4 * cr + 3 * hv, sq: 0.12 * cr - 0.08 * hv, rot: 0.1 * cr, dx: sh, hr: 0.1 * cr - 0.15 * hv, a0x: lerp(10, 12, hv), a0y: lerp(-2, -26, hv), a1x: lerp(15, 16, hv), a1y: lerp(-3, -25, hv),
        squeeze: hv > 0.3 ? 1 : 0, cheek: hv, mouth: 0.1 * cr, smile: lerp(0.5, -0.2, hv), brow: 0.6, ear: 0.4 * hv, tail: 0.7 + 0.4 * hv, tw: sh * 0.2, look: 0.9, looky: 0.5 * (1 - hv), g0: 0.9, g1: 0.9 });
      if (w === 0) { p.squeeze = 0; p.teeth = 1; p.mouth = 0.3 * hv; p.brow = 1; p.lid = 0.3 * hv; } // gritted teeth, eyes on the job
      if (w === 1) { const sl = Math.sin(ss(0.55, 0.8, u1) * Math.PI); p.f0x -= 7 * sl; p.rot += 0.3 * sl; p.by -= 3 * sl; p.pup = lerp(1, 0.6, sl); if (sl > 0.3) p.squeeze = 0; p.mouth = Math.max(p.mouth, 0.5 * sl); } // a foot slips mid-heave
      if (w === 2 && u < 0.16) { const y = Math.sin((u / 0.16) * Math.PI); p.mouth = 0.9 * y; p.squeeze = y > 0.4 ? 1 : 0; p.a0y = -8 - 30 * y; p.a1y = -8 - 32 * y; p.a0x = -6; }
      break;
    }
    case 'pull': case 'push': { // the carry: wobbling under the weight, short steps
      const ph = (u > 0 ? u : T * 1.4) * RATE[w] + w * 0.27, sw = Math.sin(ph * TAU), L = 6 / RATE[w];
      const st = (off) => { const q = fract(ph + off); return q < 0.5 ? [lerp(-L / 2, L / 2, ss(0, 1, q / 0.5)), -Math.sin((q / 0.5) * Math.PI) * 3.5] : [lerp(L / 2, -L / 2, (q - 0.5) / 0.5), 0]; };
      const F0 = st(0), F1 = st(0.5), wob = Math.sin(T * (6 + w)) * 0.04;
      if (state === 'pull') p = P({ by: -1.5 + Math.abs(sw), rot: 0.34 + wob, sq: 0.06, hr: 0.1, a0x: -12, a0y: -20, a1x: -8, a1y: -22, f0x: -3 + F0[0], f0y: F0[1], f1x: 7 + F1[0], f1y: F1[1], squeeze: 0, lid: 0.35, brow: 0.8, smile: -0.2, mouth: 0.25, teeth: 1, cheek: 0.3, look: 1, looky: 0.3, tail: 1.1, tw: sw * 0.4, ear: 0.3, g0: 1, g1: 1, sweat: 1 });
      else p = P({ by: -2 + Math.abs(sw), rot: 0.42 + wob, sq: 0.08, hr: 0.35, hx: 5, hy: -27, a0x: 15, a0y: -22, a1x: 19, a1y: -20, f0x: -6 + F0[0], f0y: F0[1], f1x: 3 + F1[0], f1y: F1[1], squeeze: 1, cheek: 0.9, smile: -0.3, mouth: 0, brow: 0.7, ear: 0.6, tail: 0.6, tw: sw * 0.5, g0: 0.2, g1: 0.2 });
      if (w === 1 && !o.calm) { const q = quirk(1, t); if (q && q[0] === 0) { const k = q[1]; p.f0x -= 8 * k; p.rot += 0.25 * k; p.by -= 3 * k; p.lid = 0; p.pup = 0.6; p.mouth = 0.5 * k; } } // his feet go from under him, he hangs on
      if (w === 2) { Object.assign(p, { squeeze: 0, cheek: 0.2, smile: 0.1, brow: -0.1, hr: 0.5, sweat: 0 }); if (!o.calm) { const q = quirk(2, t); if (q && q[0] === 0) { p.mouth = 0.9 * q[1]; p.squeeze = q[1] > 0.4 ? 1 : 0; } else if (q) p.lid = Math.max(p.lid, 0.97 * q[1]); } } // leaning on the egg as much as pushing it: a yawn, a doze
      break;
    }
    case 'ride': { // the cheer when an egg comes home: one leaps with both arms up, one claps off the beat and wobbles, one lazy wave and a yawn
      const f = [7, 5.2, 2.6][w], wv = Math.sin(T * f), bb = Math.abs(Math.sin(T * f * 0.5));
      p = P({ by: 8 + 1.5 * bb, rot: -0.05 + 0.05 * wv, hr: -0.15 + 0.1 * wv, a0x: -4 + 6 * wv, a0y: -34 - 3 * bb, a1x: 18 - 6 * wv, a1y: -34 + 3 * bb, f0x: 2, f0y: 2, f1x: 12, f1y: 1, fr0: -0.4, fr1: -0.5,
        happy: 1, mouth: 0.6 + 0.2 * bb, smile: 1, brow: -0.1, ear: -0.2, tail: 0.4 + 0.3 * wv, tw: wv * 0.8, blush: 1, g0: 0, g1: 0 });
      if (w === 0) { p.by = 6 + 9 * bb; p.f0y = -5 * bb; p.f1y = -6 * bb; p.a0x = -15 + 3 * wv; p.a0y = -36 - 3 * bb; p.a1x = 24 - 3 * wv; p.a1y = -38 + 3 * bb; }
      if (w === 1) Object.assign(p, { by: 2, rot: 0.16 * wv, a0x: 9 + 5 * bb, a0y: -13, a1x: 21 - 5 * bb, a1y: -13, f0x: -4, f0y: 0, f1x: 6, f1y: 0, fr0: 0, fr1: 0, tongue: 0.7 });
      if (w === 2) Object.assign(p, { by: -6, rot: -0.08, a0x: 10, a0y: 0, a1x: 16 - 3 * wv, a1y: -30, f0x: 4, f0y: -2, f1x: 13, f1y: -2, fr0: -0.6, fr1: -0.6, happy: 0, mouth: 0.2 + 0.5 * Math.max(0, Math.sin(T * 1.1)), blush: 0 });
      break;
    }
    case 'tumble': { // one flat on his back with his feet in the air, one on his bottom seeing stars, one face down where he fell
      const sw = Math.sin(T * 2.6), s2 = Math.sin(T * 2.6 - 0.8);
      p = P({ by: -7, sq: 0.08, rot: 0.18 * sw, hr: 0.25 * s2, a0x: -14, a0y: 2, a1x: 20, a1y: 1, f0x: -2, f0y: -2, f1x: 16, f1y: -9, fr0: -0.8, fr1: -1.2, spiral: 1, stars: 3, mouth: 0.35, tongue: 1, smile: -0.2, brow: -0.6, ear: 0.7, tail: -0.1, tw: s2 * 0.4 });
      if (w === 0) { const kk = Math.sin(T * 9); Object.assign(p, { by: 7, rot: -1.2 + 0.05 * sw, hr: 0.5, hx: 1, hy: -27, a0x: -16, a0y: -16 + 3 * kk, a1x: -12, a1y: -22 - 3 * kk, f0x: 10 + 3 * kk, f0y: -30, f1x: 17 - 3 * kk, f1y: -35, fr0: -1.4, fr1: -1.4, spiral: 0, stars: 2, tongue: 0, mouth: 0.4, teeth: 1, squeeze: 1, brow: 0.8, smile: -0.6, tail: 1.0 }); } // kicking, cross
      if (w === 2) Object.assign(p, { by: -4, rot: 1.12, hr: -0.75, hx: 4, hy: -25, a0x: 24, a0y: -4, a1x: 27, a1y: -9, f0x: -18, f0y: -1, f1x: -14, f1y: -3, fr0: 1.2, fr1: 1.2, spiral: 0, stars: 0, tongue: 0, mouth: 0.12 + 0.1 * Math.sin(T * 1.6), lid: 1, smile: 0.3, brow: 0, tail: 1.5, tc: 0.3 }); // asleep on the spot
      if (o.beat) { // in play (u = the tumble's share gone): a roll, then the held daze, then up: the keen one first, the sleepy one last
        const uu = clamp(u * [1.22, 1, 0.9][w], 0, 1), rl = o.calm ? 1 : ss(0, 0.16 + 0.03 * w, uu), up = ss(0.86, 1, uu);
        p.rot -= (1 - rl) * TAU * [0.9, 1.4, -0.75][w]; p.by += 12 * Math.sin(rl * Math.PI) * (1 - rl > 0 ? 1 : 0); if (rl < 1) p.squeeze = 1;
        p.by = lerp(p.by, 0, up); p.spiral *= 1 - up; p.stars = up > 0.5 ? 0 : p.stars;
        if (w === 1) p.hr += up * 0.4 * Math.sin(T * 30);
        if (w !== 1 && up > 0) { p.rot = lerp(p.rot, 0, up); p.f0x = lerp(p.f0x, -4, up); p.f0y = lerp(p.f0y, 0, up); p.f1x = lerp(p.f1x, 6, up); p.f1y = lerp(p.f1y, 0, up); p.fr0 = lerp(p.fr0, 0, up); p.fr1 = lerp(p.fr1, 0, up); p.hr = lerp(p.hr, 0, up) + up * 0.4 * Math.sin(T * 30); p.hx = lerp(p.hx, 3, up); p.hy = lerp(p.hy, -30, up); if (w === 2) p.lid = lerp(1, 0.5, up); }
      }
      break;
    }
    case 'wail': { // where they fell, feet planted: a stamping tantrum, a full bawl, a sniffle into both paws
      if (w === 0) { const hop = Math.abs(Math.sin(T * 10)); p = P({ by: 3 * hop, rot: 0.08, hr: -0.1, f0x: -4, f0y: -4 * Math.max(0, Math.sin(T * 10)), f1x: 6, f1y: -4 * Math.max(0, -Math.sin(T * 10)), a0x: -8, a0y: -2 + 3 * hop, a1x: 20, a1y: -3 + 3 * hop, mouth: 0.55 + 0.2 * hop, teeth: 1, brow: 1, smile: -0.8, cheek: 0.6, blush: 1, ear: 0.5, lid: 0.2, look: 0.6, tail: 1.2, puff: 0.8, tw: Math.sin(T * 10) }); }
      else if (w === 2) p = P({ by: -6, sq: 0.05, rot: 0.1, hr: 0.3, f0x: 4, f0y: -2, f1x: 13, f1y: -2, fr0: -0.6, fr1: -0.6, a0x: 2, a0y: -29 + 1.2 * Math.sin(T * 12), a1x: 13, a1y: -31 - 1.2 * Math.sin(T * 12), mouth: 0.15 + 0.1 * Math.sin(T * 8), brow: -0.9, smile: -0.6, lid: 0.75, tear: 0.5, ear: 0.9, tail: 0.3 });
      else p = P({ by: 0, rot: 0.05, f0x: -4, f0y: 0, f1x: 6, f1y: 0, a0x: -19, a0y: -22 + 2 * Math.sin(T * 14), a1x: 24, a1y: -30 - 2 * Math.sin(T * 14), mouth: 0.8 + 0.15 * Math.sin(T * 14), brow: -1, squeeze: 1, tear: 1, ear: 0.9, hr: -0.25 + 0.05 * Math.sin(T * 7), smile: -0.9 });
      break;
    }
    case 'dangle': { // (drawn upside down by the caller: his tail hooked over the edge) one hauling himself back up, one flailing, one hanging limp, fast asleep
      const fl = Math.sin(T * 13), f2 = Math.sin(T * 11 + 1);
      p = P({ by: 2, rot: 0.1 * fl, hr: -0.1 * f2, a0x: -6 + 6 * fl, a0y: 6 + 5 * f2, a1x: 16 - 6 * fl, a1y: 6 - 5 * f2, f0x: -5 + 3 * f2, f0y: -14 + 3 * fl, f1x: 6 - 3 * f2, f1y: -12 - 3 * fl,
        pup: 0.5, lid: 0, brow: -0.9, mouth: 0.8, smile: -0.8, teeth: 1, ear: 0.9, tail: 1.5, tc: 0.2, tw: 0, puff: 1, sweat: 1 });
      if (w === 0) { const cu = 0.5 + 0.5 * Math.sin(T * 3.2); Object.assign(p, { rot: -0.2 - 0.5 * cu, sq: 0.1 * cu, hr: 0.4 * cu, a0x: -10, a0y: 8 + 12 * cu, a1x: -4, a1y: 10 + 13 * cu, f0x: -5, f0y: -13, f1x: 6, f1y: -12, pup: 1, brow: 1, mouth: 0.3, smile: -0.4, looky: 1, look: -0.6, cheek: cu, ear: 0.3, puff: 0.3 }); }
      if (w === 2) Object.assign(p, { rot: 0.03 * Math.sin(T * 1.6), hr: 0, a0x: -9, a0y: -34, a1x: 15, a1y: -36, f0x: -5, f0y: -13, f1x: 6, f1y: -12, lid: 1, pup: 1, brow: 0, mouth: 0.1 + 0.1 * Math.sin(T * 1.6), smile: 0.3, teeth: 0, ear: 0, puff: 0, sweat: 0 });
      break;
    }
    case 'dive': { // a stretched leap for home, eyes shut tight
      p = P({ by: 4, rot: 0.9, sq: -0.12, hr: -0.6, a0x: 22, a0y: -26, a1x: 26, a1y: -22, f0x: -14, f0y: -2, f1x: -10, f1y: -5, fr0: 0.8, fr1: 0.8, squeeze: 1, mouth: 0.4, smile: -0.4, ear: 1, tail: 0.2, tw: 0.3, puff: 0.6 });
      if (w === 1) Object.assign(p, { rot: 0.9 + 0.5 * Math.sin(T * 9), a0x: -6, a0y: -30, squeeze: 0, pup: 0.5, lid: 0, mouth: 0.8 }); // windmilling
      if (w === 2) Object.assign(p, { rot: 0.6, a0x: 4, a0y: -6, a1x: 8, a1y: -4, mouth: 0.1 });
      break;
    }
    case 'pop': { // u 0..0.4 a roll out of the sack, 0.4..0.7 the wet-dog shake (the sleepy one: a stretch and a yawn), then the sniff
      const r = ss(0, 0.4, u), sh = ss(0.4, 0.45, u) * (1 - ss(0.66, 0.72, u)), sn = ss(0.7, 0.78, u), wig = Math.sin(T * (38 - 6 * w)) * sh * (w === 2 ? 0 : 1);
      p = P({ by: 6 * Math.sin(r * Math.PI), rot: (1 - r) * -TAU * [0.9, 1.9, 0.5][w] + 0.25 * wig, dx: 3 * wig, sq: 0.08 * Math.abs(wig), hr: 0.4 * wig - 0.35 * sn, squeeze: r < 1 || sh > 0.2 ? 1 : 0, puff: sh, ear: 0.6 * sh, mouth: 0.3 * sh,
        looky: -0.6 * sn, lid: lerp(0.1, 0.85, sn) * (1 - ss(0.92, 1, u)), smile: 0.8, cheek: 0.3 * sn * Math.max(0, Math.sin(T * 18)), a0x: 7 + 2 * wig, a0y: -9, a1x: 13, a1y: -9, tail: 0.7 + 0.5 * wig, tw: wig });
      if (w === 2) { p.mouth = 0.95 * sh; p.a0x = lerp(7, -8, sh); p.a0y = lerp(-9, -40, sh); p.a1x = lerp(13, 16, sh); p.a1y = lerp(-9, -42, sh); p.puff = 0; p.hr = -0.25 * sh + 0.3 * sn; p.looky = 0.5 * sn; }
      if (w === 0 && sn > 0) { p.by += 5 * Math.abs(Math.sin(T * 9)) * sn; p.happy = sn > 0.5 ? 1 : 0; p.lid = 0; p.a0y = -9 - 22 * sn; p.a1y = -9 - 22 * sn; p.mouth = 0.5 * sn; p.cheek = 0; } // out and already bouncing to go
      break;
    }
    case 'climb': { // reaching up, the kit tower
      const k = Math.sin(T * [7.5, 5, 3][w]);
      p = P({ by: 1, rot: -0.15, hr: -0.4, a0x: 2 + 2 * k, a0y: -36, a1x: 10 - 2 * k, a1y: -38, looky: -1, look: 0.5, smile: 0.2, mouth: 0.3, brow: 0.5, tail: 0.8, tw: k * 0.5, g0: 0.9, g1: 0.9 });
      if (w === 0) { p.brow = 1; p.teeth = 1; p.a0y -= 3 * k; p.a1y += 3 * k; }
      if (w === 1) { p.rot = -0.15 + 0.12 * k; p.pup = 0.7; p.lid = 0; p.mouth = 0.5; p.f1y = -4 * Math.max(0, k); p.sweat = 1; } // scrabbling
      if (w === 2) { p.a1x = 13; p.a1y = -14; p.mouth = 0.1; p.smile = 0; } // one paw up, no hurry
      break;
    }
    default: { // sit, by mama: one bouncing to go again, one swinging his feet, one asleep against nothing
      const sw = Math.sin(T * 2.2);
      p = P({ by: -6, sq: 0.05, rot: -0.05, hr: 0.06 * sw, a0x: 10, a0y: 0, a1x: 15, a1y: 0, f0x: 4, f0y: -2 + 2 * sw, f1x: 13, f1y: -2 - 2 * sw, fr0: -0.6, fr1: -0.6, look: 0.6 * Math.sin(T * 0.7), smile: 0.8, tail: 0.3, tw: sw * 0.4 });
      if (w === 0) { const b = Math.abs(Math.sin(T * 4.4)); Object.assign(p, { by: -6 + 3 * b, hr: -0.12, a0x: 7, a0y: -14 - 6 * b, a1x: 16, a1y: -14 - 6 * b, f0y: -2, f1y: -2, smile: 1, mouth: 0.3, tw: Math.sin(T * 8.8) * 0.8, tail: 0.6 }); }
      if (w === 2) { const nod = 0.5 + 0.5 * Math.sin(T * 1.2); Object.assign(p, { rot: 0.1, hr: 0.2 + 0.22 * nod, f0y: -2, f1y: -2, lid: 0.85 + 0.15 * nod, look: 0.4, smile: 0.2, mouth: 0.1 * nod, tw: 0.1 }); }
      if (!o.calm && !o.add && w === 1) quirks(p, w, t, false);
    }
  }
  return who(p, w, t);
}
// blend memory (like raccoonBlend)
const MEM = {};
export function kitBlend(id, pose, t, rate = 12) {
  let m = MEM[id];
  if (!m || t < m.t - 0.5 || t - m.t > 1) { m = MEM[id] = { t, p: { ...pose } }; return m.p; }
  const a = 1 - Math.exp(-(t - m.t) * rate);
  m.t = t;
  for (const k of KIT_KEYS) m.p[k] += (pose[k] - m.p[k]) * a;
  return { ...m.p };
}

// ------------------------------------------------------------------ drawing
const ellP = (c, x, y, rx, ry, r = 0) => { c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), r, 0, TAU); };
const inkF = (c, fill, line, lw) => { c.lineWidth = lw * 2; c.strokeStyle = line; c.stroke(); c.fillStyle = fill; c.fill(); };
function limbK(c, x0, y0, x1, y1, w0, w1, col, line, lw) { // a short stubby limb: one tapered stroke with an outline
  c.lineCap = 'round';
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineWidth = Math.max(w0, w1) + lw * 2; c.strokeStyle = line; c.stroke();
  c.lineWidth = (w0 + w1) / 2; c.strokeStyle = col; c.stroke();
}
function pawK(c, x, y, r, col, line, lw) { c.beginPath(); c.arc(x, y, r, 0, TAU); inkF(c, col, line, lw); }
export function drawKit(ctx, x, y, s, t, p, o = {}) {
  if (!(s > 0)) return;
  const w = o.who || 0, u = (s / 100) * (o.even ? 1 : KIT_SZ[w] || 1), C = (o.frozen ? ICEDS : PALS)[w] || PAL, lw = Math.max(1.6, 1.0 / u), face = o.face < 0 ? -1 : 1, rnd = w === 1 ? 1.12 : w === 2 ? 0.95 : 1;
  const c = ctx;
  c.save();
  try {
    c.translate(x, y); c.scale(u * face, u); c.lineJoin = 'round'; c.lineCap = 'round';
    const sx = 1 + p.sq * 0.7, sy = 1 - p.sq;
    // feet stay on the floor frame; the body turns about the feet
    const body = (fn) => { c.save(); c.translate(p.dx, -p.by - 13); c.scale(sx, sy); c.rotate(p.rot); fn(); c.restore(); };
    // ---- tail (behind): a fat ringed brush from the rump
    if (!o.noTail) body(() => {
      const n = 7, len = 30 * (1 + p.puff * 0.1), seg = len / n, ctr = [];
      let a = Math.PI - p.tail, px = -11, py = 4;
      for (let i = 0; i <= n; i++) { const f = i / n; ctr.push([px, py, a]); a -= (p.tc * 0.2 + p.tw * 0.22 * Math.sin(f * 3.4 + t * 2)) * (0.35 + f); px += Math.cos(a) * seg; py -= Math.sin(a) * seg; }
      const wd = (f) => (3.5 + 6.5 * Math.sin(Math.min(1, f * 1.4) * Math.PI * 0.6) - 4 * ss(0.75, 1, f)) * (1 + p.puff * 0.4);
      const L = [], R = [];
      ctr.forEach((q, i) => { const ww = wd(i / n), nx = Math.sin(q[2]), ny = Math.cos(q[2]); L.push([q[0] + nx * ww, q[1] + ny * ww]); R.push([q[0] - nx * ww, q[1] - ny * ww]); });
      const tip = ctr[n], tx = tip[0] + Math.cos(tip[2]) * 5, ty = tip[1] - Math.sin(tip[2]) * 5;
      c.beginPath(); c.moveTo(L[0][0], L[0][1]); for (let i = 1; i <= n; i++) c.lineTo(L[i][0], L[i][1]); c.quadraticCurveTo(tx, ty, R[n][0], R[n][1]); for (let i = n - 1; i >= 0; i--) c.lineTo(R[i][0], R[i][1]); c.closePath();
      inkF(c, C.ringL, C.line, lw);
      c.fillStyle = C.ringD;
      for (const i of [1, 3, 5]) { c.beginPath(); c.moveTo(L[i][0], L[i][1]); c.lineTo(L[i + 1][0], L[i + 1][1]); c.lineTo(R[i + 1][0], R[i + 1][1]); c.lineTo(R[i][0], R[i][1]); c.closePath(); c.fill(); }
      c.beginPath(); c.moveTo(L[n - 1][0], L[n - 1][1]); c.lineTo(L[n][0], L[n][1]); c.quadraticCurveTo(tx, ty, R[n][0], R[n][1]); c.lineTo(R[n - 1][0], R[n - 1][1]); c.closePath(); c.fill();
    });
    // ---- far leg and far arm
    const hipF = [5, 7], hipN = [-4, 8];
    const legTo = (H, fx, fy, fr, far) => { // from the hip (body frame) to the foot (floor frame)
      const cr = Math.cos(p.rot), sr = Math.sin(p.rot), hx = p.dx + (H[0] * cr - H[1] * sr) * sx, hy = -p.by - 13 + (H[0] * sr + H[1] * cr) * sy;
      limbK(c, hx, hy, fx, fy - 3, 9, 7, far ? C.furLo : C.fur, C.line, lw);
      c.save(); c.translate(fx, fy - 2.5); c.rotate(fr); ellP(c, 3, 0, 6.2, 3.4); inkF(c, far ? C.mask : C.paw, C.line, lw); c.restore();
    };
    legTo(hipF, p.f1x, p.f1y, p.fr1, true);
    body(() => { limbK(c, 7, -10, p.a1x, p.a1y, 7, 6, C.furLo, C.line, lw); pawK(c, p.a1x, p.a1y, 3.6, C.mask, C.line, lw); });
    // ---- body: a small pear, cream belly
    body(() => {
      c.beginPath(); spline(c, [[-13 * rnd, 8], [-15 * rnd, -3], [-10, -14], [0, -18], [10, -14], [14 * rnd, -3], [12 * rnd, 8], [0, 13]], true); inkF(c, C.furLo, C.line, lw);
      c.beginPath(); spline(c, [[-11 * rnd, 6], [-13 * rnd, -4], [-9, -13], [-1, -16], [8, -13], [11 * rnd, -4], [9, 5], [-1, 10]], true); c.fillStyle = C.fur; c.fill();
      ellP(c, 4, 0, 7.5 * rnd, 9, 0.1); c.fillStyle = C.cream; c.fill();
      ellP(c, -7, -9, 3, 5, 0.5); c.fillStyle = C.furHi; c.fill();
    });
    legTo(hipN, p.f0x, p.f0y, p.fr0, false);
    // ---- head (in the body's frame: it turns with the lean)
    body(() => {
      c.save(); c.translate(p.hx, p.hy); c.rotate(p.hr);
      const HS = o.hs ?? HEAD; c.translate(0, 14); c.scale(HS, HS); c.translate(0, -14); // (round 2: a baby's big head, scaled about the neck)
      const er = 1 - 0.3 * clamp(p.ear, 0, 1);
      const ear = (bx, by, far, rot) => { c.save(); c.translate(bx, by); c.rotate(rot + (far ? 0.3 : -0.4) * p.ear); c.scale(1, er); c.beginPath(); spline(c, [[-7, 2], [-6, -8], [0, -14], [6, -8], [7, 2]], true); inkF(c, far ? C.furLo : C.fur, C.line, lw); c.beginPath(); spline(c, [[-3.5, 0], [-3, -6], [0, -9.5], [3, -6], [3.5, 0]], true); c.fillStyle = far ? C.mask : C.earIn; c.fill(); c.restore(); };
      ear(11, -15, true, 0.35); ear(-10, -14, false, -0.35);
      if (w === 1) { c.save(); c.translate(-12, -22); c.rotate(-0.6); c.beginPath(); c.rect(-5, -2, 10, 4); inkF(c, C.plaster, C.line, lw * 0.6); c.fillStyle = '#c99a6a'; c.fillRect(-1.6, -1.2, 3.2, 2.4); c.restore(); } // the clumsy one's plaster
      // the skull: round, wider than tall; cheeks puff
      const ck = p.cheek;
      c.beginPath(); spline(c, [[0, -20], [14, -16], [22 + 2 * ck, -4], [26 + 2 * ck, 6], [17 + 2 * ck, 13 + ck], [2, 16], [-14, 13 + ck], [-22 - 2 * ck, 4], [-21, -9], [-12, -18]], true); inkF(c, C.furLo, C.line, lw);
      c.beginPath(); spline(c, [[0, -18], [12, -14], [19, -4], [21, 5], [14, 11], [1, 13], [-12, 11], [-19, 3], [-18, -9], [-10, -16]], true); c.fillStyle = C.fur; c.fill();
      ellP(c, -7, -13, 6, 2.6, -0.3); c.fillStyle = C.furHi; c.fill();
      if (w === 0) { c.beginPath(); spline(c, [[-5, -17], [-7, -27], [-2, -22], [1, -30], [3, -22], [8, -25], [6, -17]], false); c.closePath(); inkF(c, C.furHi, C.line, lw * 0.7); } // the keen one's tuft
      if (w === 2) { ellP(c, -5, -1, 10.5, 10.5); c.fillStyle = C.maskHi; c.fill(); } // the sleepy one: a dark ring round one eye
      // the mask: a dark band over both eyes, pinched at the nose
      c.beginPath(); spline(c, [[-20, 3], [-17, -7], [-6, -10], [3, -5], [11, -9], [20, -6], [21, 2], [13, 5], [3, 2], [-6, 7], [-15, 8]], true); c.fillStyle = C.mask; c.fill();
      // brows (cream, they act)
      const br = p.brow, brow = (bx, by, len, d) => { c.save(); c.translate(bx, by + (br < 0 ? br * 1.6 : br * 1.4)); c.rotate((br > 0 ? br * 0.45 : br * 0.35) * d); c.beginPath(); c.moveTo(-len, 0.6); c.quadraticCurveTo(0, -1.8, len, 0.6); c.lineWidth = lw * 2.4; c.strokeStyle = C.line; c.stroke(); c.lineWidth = lw * 1.3; c.strokeStyle = C.cream; c.stroke(); c.restore(); };
      brow(-6, -13, 4.5, 1); brow(12, -12, 3.6, -1);
      // eyes: huge, glossy
      const lid = Math.max(p.lid, p.happy > 0.5 || p.squeeze > 0.5 ? 0 : blinkAt(t, w * 3 + 1));
      const eye = (ex, ey, rx, ry, d) => {
        if (p.spiral > 0.5) { ellP(c, ex, ey, rx, ry); inkF(c, C.eyeW, C.line, lw * 0.7); spiralEye(c, ex, ey, Math.min(rx, ry), t, d, C.line); return; }
        if (p.happy > 0.5 || p.squeeze > 0.5) { c.beginPath(); if (p.squeeze > 0.5) { c.moveTo(ex - rx * 0.7 * d, ey - ry * 0.5); c.lineTo(ex + rx * 0.5 * d, ey); c.lineTo(ex - rx * 0.7 * d, ey + ry * 0.5); } else { c.moveTo(ex - rx * 0.85, ey + ry * 0.3); c.quadraticCurveTo(ex, ey - ry, ex + rx * 0.85, ey + ry * 0.3); } c.lineWidth = lw * 2.4; c.strokeStyle = C.line; c.stroke(); c.lineWidth = lw * 1.2; c.strokeStyle = C.cream; c.stroke(); return; }
        ellP(c, ex, ey, rx, ry); inkF(c, C.eyeW, C.line, lw * 0.7);
        const ir = Math.min(rx, ry) * 0.7 * clamp(p.pup, 0.45, 1.25), px = ex + p.look * (rx - ir) * 0.9, py = ey + p.looky * (ry - ir) * 0.9 + (ry - ir) * 0.1;
        ellP(c, px, py, ir, ir); c.fillStyle = C.iris; c.fill(); ellP(c, px, py + ir * 0.25, ir * 0.8, ir * 0.7); c.fillStyle = C.irisHi; c.fill(); ellP(c, px, py, ir * 0.58, ir * 0.58); c.fillStyle = C.pupil; c.fill();
        ellP(c, px - ir * 0.38, py - ir * 0.42, ir * 0.34, ir * 0.34); c.fillStyle = '#fff'; c.fill(); ellP(c, px + ir * 0.34, py + ir * 0.36, ir * 0.14, ir * 0.14); c.fill();
        if (lid > 0.02) { const v = clamp(-1 + 2 * clamp(lid, 0, 1), -0.999, 0.999), a = Math.asin(v); c.save(); c.translate(ex, ey); c.rotate(clamp(br, 0, 1) * 0.3 * d); c.beginPath(); c.ellipse(0, 0, rx + 0.3, ry + 0.3, 0, Math.PI - a, TAU + a); c.closePath(); c.fillStyle = C.maskHi; c.fill(); c.lineWidth = lw * 0.7; c.strokeStyle = C.line; c.stroke(); c.restore(); }
      };
      eye(11.5, -1.5, 5.6, 6.6, -1); eye(-5, -1, 7.4, 7.8, 1);
      // tears: two streams off the eyes
      if (p.tear > 0.05) {
        c.save(); c.globalAlpha *= clamp(p.tear, 0, 1); c.lineCap = 'round';
        for (const [ex, d] of [[-5, -1], [11.5, 1]]) for (let i = 0; i < 3; i++) { const f = fract(t * 2.6 + i / 3 + (d > 0 ? 0.5 : 0)), dx = d * (4 + f * 16), dy = 2 + f * 10 + f * f * 10; c.beginPath(); c.arc(ex + dx, dy, 2.2 * (1 - f * 0.4), 0, TAU); c.fillStyle = C.tear; c.fill(); c.lineWidth = lw * 0.5; c.strokeStyle = '#2a6a9a'; c.stroke(); }
        c.restore();
      }
      // muzzle, nose, mouth
      c.beginPath(); spline(c, [[2, 6], [8, 1.5], [17, 1], [23 + ck, 5], [20 + ck, 11], [10, 13], [4, 11]], true); inkF(c, C.cream, C.line, lw * 0.5);
      ellP(c, 21, 3, 3.6, 2.8, 0.15); inkF(c, C.nose, C.line, lw * 0.35); ellP(c, 20, 2.2, 1.2, 0.7); c.fillStyle = '#8a8494'; c.fill();
      const mx = 13, my = 9, mw = 4.2, sm = p.smile, jw = p.mouth;
      if (jw < 0.08) { c.beginPath(); c.moveTo(mx - mw, my - sm * 1.2); c.quadraticCurveTo(mx, my + sm * 2.4, mx + mw * 0.8, my - sm * 1.2); c.lineWidth = lw * 0.9; c.strokeStyle = C.line; c.stroke(); }
      else {
        c.beginPath(); c.moveTo(mx - mw, my - sm * 1.2); c.quadraticCurveTo(mx, my + sm * 2.4, mx + mw * 0.8, my - sm * 1.2); c.quadraticCurveTo(mx, my + 2 + jw * 11, mx - mw, my - sm * 1.2); c.closePath(); inkF(c, C.mouth, C.line, lw * 0.55);
        if (jw > 0.3) { ellP(c, mx, my + jw * 6, mw * 0.45, jw * 2.2); c.fillStyle = C.tongue; c.fill(); }
        if (p.teeth > 0.5) { c.fillStyle = '#fff'; c.fillRect(mx - 2.6, my - sm * 1.2 + 0.4, 2, 2); c.fillRect(mx + 0.4, my - sm * 1.2 + 0.4, 2, 2); }
      }
      if (p.tongue > 0.05) { c.beginPath(); c.ellipse(mx + 1, my + 4, 2.2, 3.6 * p.tongue, 0.2, 0, TAU); inkF(c, C.tongue, C.line, lw * 0.5); }
      if (p.blush > 0.05) { ellP(c, -12, 8, 4, 2.2); c.fillStyle = C.blush; c.fill(); }
      // whiskers
      c.beginPath(); for (const [a, b, e, f] of [[20, 8, 29, 6], [20, 10, 28, 12]]) { c.moveTo(a, b); c.lineTo(e, f); } c.lineWidth = lw * 0.45; c.strokeStyle = C.line; c.stroke();
      if (p.sweat > 0.05 && !o.calm) for (let i = 0; i < 2; i++) { const f = fract(t * 1.8 + i * 0.5), a = -2.3 + i * 0.7, r0 = 22 + f * 10; c.save(); c.globalAlpha *= 1 - f * f; c.translate(Math.cos(a) * r0, Math.sin(a) * r0); c.rotate(a + Math.PI / 2); c.beginPath(); c.moveTo(0, -3.4); c.quadraticCurveTo(2.4, 0, 0, 2); c.quadraticCurveTo(-2.4, 0, 0, -3.4); c.closePath(); inkF(c, C.tear, C.line, lw * 0.5); c.restore(); }
      if (o.costume) costumeHead(c, o.costume, { top: -21, cx: -1, w: 20, ear: [-10, -14], s: 0.74 }, lw, t + w, { calm: o.calm, low: o.low });
      if (p.stars > 0) dizzyStars(c, 0, -26, 17, 5, t, { n: Math.round(p.stars), size: Math.max(4, 3 / u) });
      if (p.z > 0.5 && !o.calm) { const f = fract(t * 0.45 + w * 0.3); c.save(); c.globalAlpha *= Math.sin(f * Math.PI); c.font = `900 ${Math.round(9 + 5 * f)}px sans-serif`; c.textAlign = 'center'; c.lineWidth = lw * 1.6; c.strokeStyle = C.line; c.fillStyle = '#e8f0ff'; const zx = 18 + 10 * f, zy = -24 - 14 * f; c.strokeText('z', zx, zy); c.fillText('z', zx, zy); c.restore(); }
      c.restore();
      if (o.costume && o.costume !== 'woods' && o.costume !== 'bow') costumeNeck(c, o.costume, { x: p.hx + 2, y: p.hy + 14, w: 10, s: 0.55 }, lw, t + w, { calm: o.calm });
      // ---- the near arm, over the head and body
      limbK(c, -3, -10, p.a0x, p.a0y, 8, 6.5, C.fur, C.line, lw); pawK(c, p.a0x, p.a0y, 4, C.paw, C.line, lw);
    });
  } finally { c.restore(); }
}
