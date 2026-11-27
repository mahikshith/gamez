// The kits: mama raccoon's babies (0.8.18). Tiny raccoons in Bandit's house style (render/raccoon.js: dark outline,
// two-tone fur, the black mask, a ringed tail) but baby-proportioned: a big round head, huge eyes, a small pear body, stubby
// limbs. Three of them, each its own little character (o.who):
//   0 KEEN    ears up, eyes bright, always first; leads and pulls
//   1 CLUMSY  a bit rounder, a sticking plaster on the ear, trips over his own feet now and then; pushes
//   2 SLEEPY  heavy lids, yawns, a drifting "z"; lags behind, rides on top of the egg
// drawKit(ctx, x, y, s, t, pose, o) draws one in a local y-DOWN pixel space: (x, y) the floor point between his feet, facing
// +x (o.face -1 mirrors), s = px per 100 rig units (he stands about 80 units tall). pose from kitPose(state, t, u, o).
// o: { face, who, costume, calm, frozen, low (PERF.low: flat fills, no tail rings detail), noTail }
// kitPose states: sit, walk (u = gait phase, else t), run, wait (looking up, a foot tapping), lift (u: crouch, heave),
// pull, push (u = gait phase: the carry, wobbling under the weight), ride (on top, cheering), tumble (dizzy, splayed),
// dangle (upside down by the tail, flailing; the caller turns the frame), cry (running home in tears; u gait), dive
// (a stretched leap), pop (u: rolling out of the sack, the shake, the sniff), climb (reaching up, the kit tower), peek.
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
const ICED = {};
{ const hx = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; for (const k in PAL) ICED[k] = PAL[k].startsWith('#') ? '#' + hx(PAL[k]).map((v, i) => Math.round(v + (hx('#bfe6ff')[i] - v) * 0.55).toString(16).padStart(2, '0')).join('') : PAL[k]; }

const REST = { by: 0, dx: 0, rot: 0, sq: 0, hx: 3, hy: -30, hr: 0, a0x: 8, a0y: -6, a1x: 14, a1y: -7, f0x: -5, f0y: 0, f1x: 6, f1y: 0, fr0: 0, fr1: 0,
  look: 0.4, looky: 0, lid: 0.1, pup: 1, brow: 0.2, mouth: 0, smile: 0.6, teeth: 0, tongue: 0, ear: 0, tail: 0.5, tc: 1, tw: 0, puff: 0,
  tear: 0, stars: 0, spiral: 0, squeeze: 0, happy: 0, z: 0, cheek: 0, blush: 0, g0: 0.4, g1: 0.4 };
export const KIT_KEYS = Object.keys(REST);
const P = (o) => Object.assign({}, REST, o);
const fract = (x) => x - Math.floor(x);
// personality on top of any pose
function who(p, w, t) {
  if (w === 0) { p.ear = Math.min(p.ear, 0.1) - 0.15; p.pup *= 1.08; p.brow += 0.15; }
  if (w === 2) { p.lid = Math.max(p.lid, 0.42 + 0.08 * Math.sin(t * 0.9)); p.z = Math.max(p.z, 1); p.brow -= 0.15; }
  return p;
}
export function kitPose(state, t, u = 0, o = {}) {
  const w = o.who || 0, sd = hash(w * 7 + 1) * 10, T = t + sd * 0.37, br = Math.sin(T * 3.1);
  let p;
  switch (state) {
    case 'walk': case 'run': case 'cry': {
      const fast = state !== 'walk', ph = (u > 0 ? u : T * (fast ? 2.4 : 1.7)) + w * 0.31, q = fract(ph), L = fast ? 13 : 10;
      const st = (off) => { const k = fract(ph + off); return k < 0.5 ? [lerp(-L / 2, L / 2, ss(0, 1, k / 0.5)), -Math.sin((k / 0.5) * Math.PI) * (fast ? 9 : 6)] : [lerp(L / 2, -L / 2, (k - 0.5) / 0.5), 0]; };
      const bob = Math.abs(Math.sin(ph * TAU)), sw = Math.sin(ph * TAU);
      const F0 = st(0), F1 = st(0.5);
      p = P({ by: 2.5 * bob, rot: fast ? 0.22 : 0.1, hr: -0.08 + 0.05 * sw, a0x: 6 - 7 * sw, a0y: -8 + 2 * bob, a1x: 12 + 7 * sw, a1y: -8 - 2 * bob, f0x: -4 + F0[0], f0y: F0[1], f1x: 5 + F1[0], f1y: F1[1],
        tail: 0.9 + 0.15 * sw, tw: sw * 0.6, ear: fast ? 0.3 : 0, smile: 0.7, mouth: fast ? 0.25 : 0.05, look: 0.8, looky: 0.1 });
      if (state === 'cry') Object.assign(p, { brow: -1, smile: -0.9, mouth: 0.7 + 0.2 * Math.sin(T * 14), squeeze: 1, tear: 1, ear: 0.8, a0x: -2, a0y: -14 - 4 * bob, a1x: 16, a1y: -16 + 4 * bob, rot: 0.15 });
      if (w === 1 && state === 'walk') { const trip = fract(T / 5.3); if (trip > 0.82 && trip < 0.97) { const k = Math.sin(((trip - 0.82) / 0.15) * Math.PI); p.rot += 0.45 * k; p.a0x += 10 * k; p.a0y -= 10 * k; p.a1x += 10 * k; p.a1y -= 12 * k; p.mouth = 0.5 * k; p.lid = 0; p.pup = 0.6; p.f1y -= 6 * k; } }
      break;
    }
    case 'wait': { // looking up at the gap, a foot tapping, paws behind his back
      const tap = Math.max(0, Math.sin(T * 9)) * 4;
      p = P({ by: 0.4 * br, rot: -0.12, hr: -0.35, look: 0.6, looky: -0.9, brow: -0.2, smile: -0.1, a0x: -10, a0y: -4, a1x: -6, a1y: -5, f0x: -4, f1x: 6, f1y: -tap, tail: 0.6 + 0.2 * Math.sin(T * 2), tw: Math.sin(T * 3) * 0.4, ear: 0.1 });
      break;
    }
    case 'lift': { // gather, crouch (the telegraph), then the heave: arms up, cheeks puffed, eyes squeezed
      const cr = ss(0, 0.45, u), hv = back(ss(0.5, 0.9, u), 2), sh = Math.sin(T * 40) * ss(0.5, 0.7, u) * (1 - ss(0.85, 1, u));
      p = P({ by: -4 * cr + 3 * hv, sq: 0.12 * cr - 0.08 * hv, rot: 0.1 * cr, dx: sh, hr: 0.1 * cr - 0.15 * hv, a0x: lerp(10, 12, hv), a0y: lerp(-2, -26, hv), a1x: lerp(15, 16, hv), a1y: lerp(-3, -25, hv),
        squeeze: hv > 0.3 ? 1 : 0, cheek: hv, mouth: 0.1 * cr, smile: lerp(0.5, -0.2, hv), brow: 0.6, ear: 0.4 * hv, tail: 0.7 + 0.4 * hv, tw: sh * 0.2, look: 0.9, looky: 0.5 * (1 - hv), g0: 0.9, g1: 0.9 });
      break;
    }
    case 'pull': case 'push': { // the carry: wobbling under the weight, short steps
      const ph = (u > 0 ? u : T * 1.4) + w * 0.27, k = fract(ph), sw = Math.sin(ph * TAU), L = 6;
      const st = (off) => { const q = fract(ph + off); return q < 0.5 ? [lerp(-L / 2, L / 2, ss(0, 1, q / 0.5)), -Math.sin((q / 0.5) * Math.PI) * 3.5] : [lerp(L / 2, -L / 2, (q - 0.5) / 0.5), 0]; };
      const F0 = st(0), F1 = st(0.5), wob = Math.sin(T * 7) * 0.04;
      if (state === 'pull') p = P({ by: -1.5 + Math.abs(sw), rot: 0.34 + wob, sq: 0.06, hr: 0.1, a0x: -12, a0y: -20, a1x: -8, a1y: -22, f0x: -3 + F0[0], f0y: F0[1], f1x: 7 + F1[0], f1y: F1[1], squeeze: 0, lid: 0.35, brow: 0.8, smile: -0.2, mouth: 0.25, teeth: 1, cheek: 0.3, look: 1, looky: 0.3, tail: 1.1, tw: sw * 0.4, ear: 0.3, g0: 1, g1: 1, sweat: 1 });
      else p = P({ by: -2 + Math.abs(sw), rot: 0.42 + wob, sq: 0.08, hr: 0.35, hx: 5, hy: -27, a0x: 15, a0y: -22, a1x: 19, a1y: -20, f0x: -6 + F0[0], f0y: F0[1], f1x: 3 + F1[0], f1y: F1[1], squeeze: 1, cheek: 0.9, smile: -0.3, mouth: 0, brow: 0.7, ear: 0.6, tail: 0.6, tw: sw * 0.5, g0: 0.2, g1: 0.2 });
      break;
    }
    case 'ride': { // sitting on the egg, waving both arms, cheering
      const wv = Math.sin(T * 7), bb = Math.abs(Math.sin(T * 3.5));
      p = P({ by: 8 + 1.5 * bb, rot: -0.05 + 0.05 * wv, hr: -0.15 + 0.1 * wv, a0x: -4 + 6 * wv, a0y: -34 - 3 * bb, a1x: 18 - 6 * wv, a1y: -34 + 3 * bb, f0x: 2, f0y: 2, f1x: 12, f1y: 1, fr0: -0.4, fr1: -0.5,
        happy: 1, mouth: 0.6 + 0.2 * bb, smile: 1, brow: -0.1, ear: -0.2, tail: 0.4 + 0.3 * wv, tw: wv * 0.8, blush: 1, g0: 0, g1: 0 });
      break;
    }
    case 'tumble': { // splayed on his bottom, swaying, stars and spiral eyes
      const sw = Math.sin(T * 2.6), s2 = Math.sin(T * 2.6 - 0.8);
      p = P({ by: -7, sq: 0.08, rot: 0.18 * sw, hr: 0.25 * s2, a0x: -14, a0y: 2, a1x: 20, a1y: 1, f0x: -2, f0y: -2, f1x: 16, f1y: -9, fr0: -0.8, fr1: -1.2, spiral: 1, stars: 3, mouth: 0.35, tongue: 1, smile: -0.2, brow: -0.6, ear: 0.7, tail: -0.1, tw: s2 * 0.4 });
      if (o.beat) { // in play (u = the tumble's share gone): a backward roll, then the held dizzy sit, then a head shake and up
        const rl = o.calm ? 1 : ss(0, 0.16, u), up = ss(0.86, 1, u);
        p.rot -= (1 - rl) * TAU * 0.9; p.by += 12 * Math.sin(rl * Math.PI) * (1 - rl > 0 ? 1 : 0); p.squeeze = rl < 1 ? 1 : 0;
        p.by = lerp(p.by, 0, up); p.spiral = 1 - up; p.stars = up > 0.5 ? 0 : 3; p.hr += up * 0.4 * Math.sin(T * 30);
      }
      break;
    }
    case 'dangle': { // (drawn upside down by the caller: his tail hooked over the edge) arms flailing, eyes wide
      const fl = Math.sin(T * 13), f2 = Math.sin(T * 11 + 1);
      p = P({ by: 2, rot: 0.1 * fl, hr: -0.1 * f2, a0x: -6 + 6 * fl, a0y: 6 + 5 * f2, a1x: 16 - 6 * fl, a1y: 6 - 5 * f2, f0x: -5 + 3 * f2, f0y: -14 + 3 * fl, f1x: 6 - 3 * f2, f1y: -12 - 3 * fl,
        pup: 0.5, lid: 0, brow: -0.9, mouth: 0.8, smile: -0.8, teeth: 1, ear: 0.9, tail: 1.5, tc: 0.2, tw: 0, puff: 1, sweat: 1 });
      break;
    }
    case 'dive': { // a stretched leap for home, eyes shut tight
      p = P({ by: 4, rot: 0.9, sq: -0.12, hr: -0.6, a0x: 22, a0y: -26, a1x: 26, a1y: -22, f0x: -14, f0y: -2, f1x: -10, f1y: -5, fr0: 0.8, fr1: 0.8, squeeze: 1, mouth: 0.4, smile: -0.4, ear: 1, tail: 0.2, tw: 0.3, puff: 0.6 });
      break;
    }
    case 'pop': { // u 0..0.4 a roll out of the sack, 0.4..0.7 the wet-dog shake, then the sniff
      const r = ss(0, 0.4, u), sh = ss(0.4, 0.45, u) * (1 - ss(0.66, 0.72, u)), sn = ss(0.7, 0.78, u), wig = Math.sin(T * 38) * sh;
      p = P({ by: 6 * Math.sin(r * Math.PI), rot: (1 - r) * -TAU * 0.9 + 0.25 * wig, dx: 3 * wig, sq: 0.08 * Math.abs(wig), hr: 0.4 * wig - 0.35 * sn, squeeze: r < 1 || sh > 0.2 ? 1 : 0, puff: sh, ear: 0.6 * sh, mouth: 0.3 * sh,
        looky: -0.6 * sn, lid: lerp(0.1, 0.85, sn) * (1 - ss(0.92, 1, u)), smile: 0.8, cheek: 0.3 * sn * Math.max(0, Math.sin(T * 18)), a0x: 7 + 2 * wig, a0y: -9, a1x: 13, a1y: -9, tail: 0.7 + 0.5 * wig, tw: wig });
      break;
    }
    case 'climb': { // reaching up, the kit tower
      const k = Math.sin(T * 6);
      p = P({ by: 1, rot: -0.15, hr: -0.4, a0x: 2 + 2 * k, a0y: -36, a1x: 10 - 2 * k, a1y: -38, looky: -1, look: 0.5, smile: 0.2, mouth: 0.3, brow: 0.5, tail: 0.8, tw: k * 0.5, g0: 0.9, g1: 0.9 });
      break;
    }
    default: { // sit: on his bottom by mama, swinging his feet
      const sw = Math.sin(T * 2.2);
      p = P({ by: -6, sq: 0.05, rot: -0.05, hr: 0.06 * sw, a0x: 10, a0y: 0, a1x: 15, a1y: 0, f0x: 4, f0y: -2 + 2 * sw, f1x: 13, f1y: -2 - 2 * sw, fr0: -0.6, fr1: -0.6, look: 0.6 * Math.sin(T * 0.7), smile: 0.8, tail: 0.3, tw: sw * 0.4 });
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
  const u = s / 100, C = o.frozen ? ICED : PAL, lw = Math.max(1.6, 1.0 / u), face = o.face < 0 ? -1 : 1, w = o.who || 0, rnd = w === 1 ? 1.08 : 1;
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
