// Pip the Penguin (the Frozen world's curler): a round little penguin in a red scarf and a woolly hat, huge eyes. Not
// wicked: he thinks eggs are curling stones. Crisp cel-shaded code art in the thieves' house style: a dark outline only,
// two-tone shading with a back highlight, big eyes with lids and brows. Seen three-quarter from the side.
//
// drawPenguin(ctx, x, y, s, t, pose, o) draws him in a local y-DOWN pixel space:
//   (x, y)  the floor point between his feet; he faces +x (o.face -1 mirrors). s = px per 100 rig units; he stands about
//           118 units tall with the hat (PENGUIN_M metres per 100 units puts him near 1 m).
//   pose    from penguinPose(state, t, u): plain numbers, so poses blend (penguinBlend)
//   o       { face, frozen (s left, or 0: an ice shell round his silhouette, icy colours, glints; he shivers in the last
//             second), stars 0..3 (overrides the pose), eye: 'normal' | 'lock' | 'wide' | 'squeeze' | 'spiral' | 'happy' |
//             'angry', out: {} receives beak, head, top, front (where his leading edge meets the floor: put the snow spray
//             there), push (the point that shoves an egg) {x, y} in the same px space }
// penguinPose states: idle, waddle (u > 0 = the gait phase in cycles, else it runs on t), windup (u: crouches, backs up
// 14 units by himself, wiggles, then tips forward), slide (u: the dive onto his belly; hold u = 1 for the slide itself:
// THE GAME MOVES HIM along the channel), bump (u: flattened on a wall whose face is about 64 units ahead of (x, y), then
// he bounces back onto his bottom, dazed), fall (u: teeters on the lip, then drops with his flippers up: THE GAME MOVES
// HIM down through the gap), shake (u: gets up from his belly, shakes the snow off), sneeze (u: ah, ah, CHOO), dizzy,
// wave, defeated (u: plops down; sulks with a fish).
import { spline, blinkAt, clamp, lerp, ss, back } from './castkit.js';
import { dizzyStars, spiralEye } from './status.js';

const TAU = Math.PI * 2;
export const PENGUIN_M = 0.85; // metres per 100 rig units
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixHex = (a, b, k) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
const PAL = {
  line: '#141c36', back: '#3e62b4', backLo: '#2a4488', backHi: '#7397e0', belly: '#ffffff', bellyLo: '#cfdef2', lid: '#a9c0e6',
  beak: '#ffa51f', beakLo: '#e2760c', beakHi: '#ffd470', mouth: '#7a1c2a', tongue: '#ff7f90', blush: '#ff9db4',
  eyeW: '#ffffff', iris: '#4a2c14', pupil: '#120c10',
  scarf: '#e8413c', scarfLo: '#b0242e', scarfHi: '#ff8672', wool: '#fff4de', woolLo: '#e2cfb2',
  fish: '#5fb4a4', fishLo: '#2f7f7a', fishBelly: '#d8f6e6', snow: '#ffffff', snowLo: '#cfe2f6', snowLine: '#3a5a8c', sweat: '#8fd4ff',
};
const ICED = {};
for (const c in PAL) ICED[c] = mixHex(PAL[c], '#bfe6ff', 0.55);
const RIM = '#2f6f9e', SHELL = '#d6f0ff', SH = 4.6, RW = 1.9; // the ice shell beyond the outline and its dark rim (units)

// ------------------------------------------------------------------ poses
// by: body centre height; dx: shift; rot: lean (+ = toward +x; PI / 2 = flat on his belly); sq: squash on the world axes (- =
// stretch); hx, hy, hr, hsc: the head in the body's frame; w0 / w1: near / far flipper angle (0 down his side, PI / 2 straight
// out, 2.5 up beside the head); f0 / f1: near / far foot (x, y, r in the body frame); look, looky: pupils -1..1; lid, lidLo: 0
// open .. 1 shut; brow -1 sad .. 1 fierce; pup: pupil size; happy / squeeze / spiral: eye styles (> 0.5); jaw: beak open;
// tongue; blush; sca: where the scarf tails point (0 down, PI / 2 straight back, PI up), scw: flutter; pom: the hat tip's
// lag; hat: its lift off the head; hatr: its tilt; fish 0..1; snow: flecks flying off; puf: the sneeze cloud's life 0..1;
// stars; sweat; sigh
const REST = { by: 31, dx: 0, rot: 0, sq: 0, hx: 2, hy: -40, hr: 0, hsc: 1.08, w0: 0.22, w1: 0.3, f0x: -11, f0y: 27, f0r: 0, f1x: 8, f1y: 27, f1r: 0,
  look: 0.3, looky: 0, lid: 0.04, lidLo: 0, brow: 0, pup: 1, happy: 0, squeeze: 0, spiral: 0, jaw: 0, tongue: 0, blush: 1,
  sca: 0.12, scw: 0.15, pom: 0, hat: 0, hatr: 0, fish: 0, snow: 0, puf: 0, stars: 0, sweat: 0, sigh: 0 };
const KEYS = Object.keys(REST);
// world targets (rig units, floor at y = 0; a third number is a world angle) into the body's frame
function fin(p, w) {
  const c = Math.cos(-p.rot), s = Math.sin(-p.rot), sy = 1 - p.sq, sx = 1 + p.sq * 0.7;
  for (const k in w) { const X = w[k][0] / sx - p.dx, Y = w[k][1] / sy + p.by; p[k + 'x'] = X * c - Y * s; p[k + 'y'] = X * s + Y * c; if (w[k].length > 2) p[k + 'r'] = w[k][2] - p.rot; }
  return p;
}
const P = (o) => Object.assign({}, REST, o);
const fract = (x) => x - Math.floor(x);
const mix3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const FLAT = { f0: [-33, -38, Math.PI + 0.55], f1: [-32, -25, Math.PI + 0.3] }, STAND = { f0: [-11, -4, 0], f1: [8, -4, 0] }, SIT = { f0: [9, -5.5, -0.8], f1: [20, -6, -0.65] };
const HEAD_FLAT = -Math.PI / 2 - 0.12;
export function penguinPose(state, t, u = 0) {
  const br = Math.sin(t * 2.4);
  switch (state) {
    case 'waddle': { // rocks from foot to foot, flippers out for balance, the scarf and the hat tip a beat behind
      const ph = u > 0 ? u : t * 1.7, a = ph * TAU, sw = Math.sin(a), lag = Math.sin(a - 0.9), co = Math.cos(a);
      return fin(P({ by: 31 + 1.8 * Math.abs(co), dx: 2.5 * sw, rot: 0.15 * sw, hx: 2 + lag, hr: -0.11 * sw + 0.04 * lag, w0: 0.62 + 0.24 * sw, w1: 0.62 - 0.24 * sw, look: 0.6, brow: -0.25, jaw: 0.3,
        sca: 0.3 + 0.32 * lag, scw: 0.3, pom: -0.5 * lag }), { f0: [-11 + 5 * co, -4 - 6 * Math.max(0, sw), -0.4 * Math.max(0, sw)], f1: [8 - 5 * co, -4 - 6 * Math.max(0, -sw), -0.4 * Math.max(0, -sw)] });
    }
    case 'windup': { // crouches and backs up, tongue out, rump wiggling faster and faster, the scarf fluttering; then tips forward
      const e = ss(0, 0.22, u), wg = ss(0.15, 0.45, u) * (1 - ss(0.84, 0.94, u)), w = Math.sin(t * (15 + 12 * u)) * wg, go = ss(0.86, 1, u);
      return fin(P({ by: 31 - 6 * e + 2 * go, dx: -14 * e + 2.4 * w + 6 * go, rot: -0.2 * e + 0.06 * w + 0.55 * go, sq: 0.1 * e - 0.08 * go, hx: 2 + 3 * e, hr: 0.2 * e - 0.05 * w - 0.32 * go, w0: 0.22 + 1.0 * e + 0.16 * w + 0.3 * go, w1: 0.3 - 0.9 * e,
        look: 1, lid: 0.2 * e, lidLo: 0.25 * e, brow: 0.9 * e, pup: 1 + 0.15 * e, tongue: e * (1 - go), jaw: 0.6 * go, sca: 0.3 - 0.4 * e + 1.0 * go, scw: 0.3 + 1.0 * wg, pom: 0.55 * w - 0.6 * go }),
        { f0: [-11 - 14 * e + 2 * go, -4 - 3.5 * Math.max(0, w), 0], f1: [8 - 14 * e + 4 * go, -4 - 3.5 * Math.max(0, -w), 0] });
    }
    case 'slide': { // a hop, the dive, a squash as his belly lands; then flat out: chin up, flippers back, scarf streaming
      const a = ss(0, 0.55, u), ab = back(a, 1.3), hop = Math.sin(a * Math.PI), land = Math.sin(ss(0.5, 0.85, u) * Math.PI), on = ss(0.6, 1, u), fl = Math.sin(t * 17);
      return fin(P({ by: lerp(31, 31.5, a) + 15 * hop - 2.5 * land + 0.6 * Math.sin(t * 23) * on, dx: 12 * a, rot: lerp(0.55, Math.PI / 2, ab), sq: 0.14 * land - 0.06 * hop,
        hx: lerp(2, -5, a), hy: lerp(-40, -40, a), hr: lerp(-0.3, HEAD_FLAT, a) + 0.03 * fl * on, w0: lerp(1.3, 0.8, a) + 0.1 * fl * on, w1: lerp(-0.6, 0.3, a),
        look: 0.9, lid: 0, brow: -0.5, pup: 1.12, jaw: 0.85, tongue: 0.7 * on, sca: lerp(0.9, Math.PI / 2 + 0.5, a), scw: 0.6, pom: -1.0 * a }),
        { f0: mix3(STAND.f0, [FLAT.f0[0] + 12, FLAT.f0[1] + 3 * fl * on, FLAT.f0[2]], a), f1: mix3(STAND.f1, [FLAT.f1[0] + 12, FLAT.f1[1] - 3 * fl * on, FLAT.f1[2]], a) });
    }
    case 'fall': { // teeters on the lip, flippers windmilling; then drops with both flippers up: wheee
      const tee = ss(0, 0.1, u) * (1 - ss(0.22, 0.34, u)), dr = ss(0.26, 0.4, u), k = Math.sin(t * 13), k2 = Math.sin(t * 6.5);
      return fin(P({ by: 31 + 3 * dr, dx: 5 * tee, rot: 0.34 * tee + 0.12 * k2 * dr, sq: -0.1 * dr, hr: 0.16 * tee - 0.14 * dr - 0.06 * k2 * dr,
        w0: lerp(0.3 + tee * (1.3 + 1.1 * Math.sin(t * 24)), 2.5 + 0.22 * k, dr), w1: lerp(0.3 + tee * (1.3 + 1.1 * Math.cos(t * 24)), 2.45 - 0.22 * k, dr),
        look: 0.7, looky: 0.7 * tee, lid: 0, pup: lerp(1, 0.6, tee), happy: dr, jaw: 0.3 + 0.7 * Math.max(tee, dr), tongue: dr, brow: -0.6, sca: lerp(0.12, Math.PI - 0.3, dr), scw: 0.2 + 0.5 * dr, pom: 0.35 * k2 * dr, hat: 5 * dr + 1.5 * k2 * dr }),
        { f0: [-11, -4 + 8 * dr + 3 * k * dr, 0.55 * dr], f1: [8, -4 + 8 * dr - 3 * k * dr, 0.45 * dr] });
    }
    case 'bump': { // hits the wall beak first and folds up like a concertina; bounces back onto his bottom, stars round his hat
      const im = 1 - ss(0.06, 0.2, u), up = ss(0.12, 0.42, u), ub = back(up, 1.6), w = Math.sin(t * 2.6), w2 = Math.sin(t * 2.6 - 0.8), sit = ss(0.4, 0.55, u), bo = Math.sin(ss(0.36, 0.62, u) * Math.PI);
      return fin(P({ by: lerp(31.5, 28.5, up) + 10 * Math.sin(up * Math.PI) - 2 * bo, dx: lerp(13, -12, up), rot: lerp(Math.PI / 2, -0.2 + 0.06 * w * sit, ub) + 0.32 * im, sq: -0.2 * im + 0.1 * bo,
        hx: lerp(-5, 2 + 1.5 * w2 * sit, up), hy: lerp(-40, -41, up), hr: lerp(HEAD_FLAT, 0.1 + 0.2 * w2 * sit, up), w0: lerp(0.8, 0.5 + 0.2 * w2, up) + 1.0 * im, w1: lerp(0.3, 0.6 - 0.2 * w2, up) + 1.0 * im,
        squeeze: up < 0.5 ? 1 : 0, spiral: up >= 0.5 ? 1 : 0, lid: 0, brow: -0.8, jaw: lerp(0.15, 0.35, up), tongue: sit, stars: 3, sca: lerp(Math.PI / 2, 0.1 + 0.25 * w2, up) - 1.5 * im, scw: 0.3, pom: lerp(-1, 0.4 * w2, up) + 1.4 * im, hatr: 0.36 * sit + 0.05 * w2, hat: 7 * im }),
        { f0: mix3([FLAT.f0[0] + 13, FLAT.f0[1] - 6 * im, FLAT.f0[2]], SIT.f0, up), f1: mix3([FLAT.f1[0] + 13, FLAT.f1[1] - 6 * im, FLAT.f1[2]], SIT.f1, up) });
    }
    case 'shake': { // pushes himself up with his flippers, then a whole-body shake: snow flying, scarf whipping
      const k = ss(0, 0.32, u), kb = back(k, 1.5), sh = ss(0.36, 0.46, u) * (1 - ss(0.8, 0.92, u)), v = Math.sin(t * 36), end = ss(0.9, 1, u), psh = Math.sin(k * Math.PI);
      return fin(P({ by: lerp(31.5, 31, k) + 7 * psh + 2.5 * Math.abs(Math.sin(t * 9)) * end, rot: lerp(Math.PI / 2, 0, kb) + 0.15 * v * sh, dx: 2 * v * sh, sq: 0.05 * sh,
        hx: lerp(-5, 2, k), hy: -40, hr: lerp(HEAD_FLAT, 0, k) - 0.26 * v * sh, w0: lerp(0.8, 0.25, k) + (0.8 + 0.5 * v) * sh + 1.2 * psh, w1: lerp(0.3, 0.3, k) + (0.8 - 0.5 * v) * sh + 1.0 * psh,
        squeeze: sh > 0.5 ? 1 : 0, happy: end > 0.5 ? 1 : 0, lid: 0.1, brow: lerp(0.3, -0.3, end), jaw: 0.15 + 0.5 * end, snow: sh, sca: lerp(Math.PI / 2, 0.12, k), scw: 0.2 + 1.3 * sh, pom: 0.8 * v * sh, hatr: 0.12 * v * sh }),
        { f0: mix3(FLAT.f0, STAND.f0, k), f1: mix3(FLAT.f1, STAND.f1, k) });
    }
    case 'sneeze': { // ah ... ah ... (head back, flippers rising, eyes narrowing) CHOO: doubles over, the hat jumps, a puff of snow
      const b = ss(0, 0.5, u), c0 = ss(0.52, 0.57, u), bb = b * (1 - c0), pu = Math.pow(Math.sin(clamp(u / 0.5, 0, 1) * Math.PI * 3), 2) * bb, c = c0 * (1 - ss(0.66, 0.9, u)), af = ss(0.85, 1, u);
      return fin(P({ by: 31 + 2 * bb + 1.5 * pu - 5 * c, dx: -8 * c, rot: -0.14 * bb - 0.06 * pu + 0.28 * c, sq: -0.07 * bb + 0.14 * c, hx: 2 + 4 * c, hr: -0.32 * bb - 0.12 * pu + 0.26 * c, w0: 0.25 + 0.8 * bb + 0.3 * pu - 0.3 * c, w1: 0.3 + 0.7 * bb + 1.2 * c,
        lid: 0.45 * bb + 0.2 * af, lidLo: 0.5 * bb, brow: -0.9 * b * (1 - af) - 0.3 * af, squeeze: c > 0.3 ? 1 : 0, jaw: 0.25 * bb + 0.5 * pu + 0.9 * c + 0.12 * af, look: lerp(0.2, 0.9, af), looky: -0.5 * bb + 0.6 * af,
        hat: 15 * Math.sin(ss(0.53, 0.82, u) * Math.PI), hatr: 0.25 * af, puf: u > 0.53 ? ss(0.53, 0.97, u) : 0, sca: 0.12 - 1.3 * c, scw: 0.2 + c, pom: 1.0 * c - 0.5 * pu, blush: 1 + 0.6 * af }),
        { f0: [-11, -4 - 4 * c, 0], f1: [8, -4 - 5 * c, 0] });
    }
    case 'dizzy': { // legs gone to jelly, a slow sway, spiral eyes, the hat askew
      const w = Math.sin(t * 2.3), w2 = Math.sin(t * 2.3 - 0.8);
      return fin(P({ by: 30 + Math.sin(t * 4.6), dx: 6 * w, rot: 0.15 * w, hx: 2 + 2 * w2, hr: 0.24 * w2, spiral: 1, lid: 0, brow: -0.7, jaw: 0.35, tongue: 1, stars: 3, w0: 0.45 + 0.35 * w2, w1: 0.45 - 0.35 * w2, sca: 0.12 + 0.4 * w2, scw: 0.2, pom: 0.6 * w2, hatr: 0.32 + 0.08 * w2 }),
        { f0: [-15, -4, 0], f1: [12, -4, 0] });
    }
    case 'wave': { // a big hello: one flipper high and flapping, little hops, eyes shut with joy between looks
      const h = Math.abs(Math.sin(t * 5.2)), v = Math.sin(t * 10.4), lag = Math.sin(t * 5.2 - 0.9);
      return fin(P({ by: 31 + 3.5 * h, sq: -0.05 * h + 0.04 * (1 - h), rot: -0.07 + 0.03 * v, hr: -0.12 + 0.07 * Math.sin(t * 5.2), w0: 2.5 + 0.38 * v, w1: 0.75 + 0.12 * v, happy: Math.sin(t * 1.3) > -0.2 ? 1 : 0, lid: 0, brow: -0.4, jaw: 0.75, tongue: 0.5, look: 0.8,
        sca: 0.2 + 0.25 * lag, scw: 0.3, pom: -0.4 * lag }), { f0: [-11, -4 - 3 * h, 0.2 * h], f1: [8, -4 - 3 * h, 0.2 * h] });
    }
    case 'defeated': { // plops onto his bottom and sulks with a consolation fish: glances at it, looks away, a big sigh
      const k = ss(0, 0.3, u), bo = Math.sin(ss(0.2, 0.5, u) * Math.PI), sp = fract(t / 3.4), sg = Math.sin(clamp(sp / 0.32, 0, 1) * Math.PI) * k, peek = ss(0.5, 0.58, sp) * (1 - ss(0.84, 0.92, sp)) * k;
      return fin(P({ by: lerp(31, 28.5, k) - 2 * bo + 1.3 * sg, rot: lerp(0, -0.12, k) + 0.03 * sg, sq: 0.1 * bo - 0.035 * sg, hx: 2 + 3 * k, hy: -40 + 3.5 * k - 1.5 * sg, hr: 0.24 * k - 0.12 * sg + 0.1 * peek, w0: lerp(0.22, 0.08, k), w1: lerp(0.3, 1.3, k) + 0.04 * Math.sin(t * 1.9) * k,
        look: lerp(0.3, lerp(-0.55, 0.8, peek), k), looky: lerp(0, lerp(0.15, 0.85, peek), k), lid: 0.38 * k - 0.12 * peek, lidLo: 0.18 * k, brow: lerp(0, 0.6 - 1.3 * peek, k), jaw: 0.3 * sg * ss(0.5, 1, sp * 4), fish: k, sca: 0.05, scw: 0.04, pom: 0.75 * k, hatr: 0.1 * k, sigh: sg }),
        { f0: mix3(STAND.f0, [SIT.f0[0], SIT.f0[1], SIT.f0[2] + 0.12 * Math.sin(t * 2.1)], k), f1: mix3(STAND.f1, SIT.f1, k) });
    }
    default: { // idle: breathing, looking about for something to curl, a flap now and then
      const gl = Math.sin(t * 0.8), fl = Math.max(0, Math.sin(t * 1.1 + 1)) ** 6 * Math.sin(t * 20);
      return fin(P({ by: 31 + 0.8 * br, sq: 0.015 * br, rot: 0.03 * gl, hx: 2 + 1.5 * gl, hr: 0.07 * gl, look: 0.5 + 0.5 * gl, w0: 0.24 + 0.05 * br + 0.3 * Math.abs(fl), w1: 0.3 + 0.05 * br + 0.3 * Math.abs(fl), jaw: 0.12, sca: 0.12 + 0.1 * Math.sin(t * 1.7), scw: 0.15, pom: 0.15 * Math.sin(t * 1.7 - 1) }), STAND);
    }
  }
}

const MEM = {};
export function penguinBlend(id, pose, t, rate = 10) {
  let m = MEM[id];
  if (!m || t < m.t - 0.5 || t - m.t > 1) { m = MEM[id] = { t, p: { ...pose } }; return m.p; }
  const a = 1 - Math.exp(-(t - m.t) * rate);
  m.t = t;
  for (const k of KEYS) m.p[k] += (pose[k] - m.p[k]) * a;
  return m.p;
}

// ------------------------------------------------------------------ drawing kit
// MODE 0 paints; 1 and 2 lay the ice shell down first (every inked shape grown: the dark rim, then the pale ice)
let MODE = 0;
const blobP = (pts) => (c) => { c.beginPath(); spline(c, pts, true); };
const ellP = (x, y, rx, ry, r = 0) => (c) => { c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), r, 0, TAU); };
const ink = (c, path, fill, line, lw) => {
  path(c);
  if (MODE) { c.lineWidth = (lw + (MODE === 1 ? SH : SH - RW)) * 2; c.strokeStyle = c.fillStyle = MODE === 1 ? RIM : SHELL; c.stroke(); c.fill(); return; }
  c.lineWidth = lw * 2; c.strokeStyle = line; c.stroke(); c.fillStyle = fill; c.fill();
};
const fillP = (c, path, fill) => { if (MODE) return; path(c); c.fillStyle = fill; c.fill(); };
const inset = (pts, k, ox, oy) => { let cx = 0, cy = 0; for (const q of pts) { cx += q[0]; cy += q[1]; } cx /= pts.length; cy /= pts.length; return pts.map((q) => [cx + (q[0] - cx) * k + ox, cy + (q[1] - cy) * k + oy]); };
function hose(c, pts, w, col, line, lw) {
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); spline(c, pts, false);
  if (MODE) { c.lineWidth = w + (lw + (MODE === 1 ? SH : SH - RW)) * 2; c.strokeStyle = MODE === 1 ? RIM : SHELL; c.stroke(); return; }
  c.lineWidth = w + lw * 2; c.strokeStyle = line; c.stroke(); c.lineWidth = w; c.strokeStyle = col; c.stroke();
}
// a lump of snow: white with a blue underside
function lump(c, x, y, r, C, lw, a = 1) {
  if (MODE) return;
  c.save(); c.globalAlpha *= a; ink(c, ellP(x, y, r, r * 0.92), C.snowLo, C.snowLine, lw); fillP(c, ellP(x - r * 0.12, y - r * 0.16, r * 0.8, r * 0.72), C.snow); c.restore();
}

// The spray his belly throws up. (x, y) = where his leading edge meets the floor (out.front), s as for the penguin,
// o: { k 0..1 strength, face }. A plume curling forward and up, lumps flying back over him.
export function drawSnowSpray(ctx, x, y, s, t, o = {}) {
  const k = o.k == null ? 1 : o.k; if (!(s > 0) || k <= 0.02) return;
  const u = s / 100, C = PAL, lw = Math.max(1.5, 0.9 / u), face = o.face < 0 ? -1 : 1;
  ctx.save(); ctx.translate(x, y); ctx.scale(u * face, u); ctx.lineJoin = 'round';
  // the bow wave: three bulges that breathe
  for (let i = 0; i < 3; i++) { const w = Math.sin(t * 19 + i * 2.1), r = (6.5 + 2.5 * i + 1.5 * w) * k; lump(ctx, 8 - i * 9, -r * 0.62, r, C, lw); }
  // lumps thrown up and back
  for (let i = 0; i < 6; i++) {
    const f = fract(t * 1.9 + i / 6 + (i % 2) * 0.13), vx = -(26 + 34 * (i % 3) / 2), px = 4 + vx * f * k, py = -(52 + 16 * (i % 2)) * f * k + 62 * f * f * k - 6;
    lump(ctx, px, py, (5.4 - 3 * f) * (0.6 + 0.4 * k), C, lw, 1 - f * f);
  }
  ctx.restore();
}

function eyeDraw(c, x, y, rx, ry, e, C, lw, t, dir) {
  if (MODE) return;
  if (e.spiral > 0.5) { ink(c, ellP(x, y, rx, ry), C.eyeW, C.line, lw * 0.7); spiralEye(c, x, y, Math.min(rx, ry), t, dir, C.line); return; }
  if (e.happy > 0.5 || e.squeeze > 0.5) { // shut: a happy arc, or a tight > <
    c.beginPath();
    if (e.squeeze > 0.5) { c.moveTo(x - rx * 0.75 * dir, y - ry * 0.5); c.lineTo(x + rx * 0.55 * dir, y); c.lineTo(x - rx * 0.75 * dir, y + ry * 0.5); }
    else { c.moveTo(x - rx * 0.9, y + ry * 0.3); c.quadraticCurveTo(x, y - ry * 1.0, x + rx * 0.9, y + ry * 0.3); }
    c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = lw * 1.5; c.strokeStyle = C.line; c.stroke();
    return;
  }
  if (e.lid > 0.9) { ink(c, ellP(x, y, rx, ry), C.lid, C.line, lw * 0.7); c.beginPath(); c.moveTo(x - rx * 0.85, y + ry * 0.25); c.quadraticCurveTo(x, y + ry * 0.75, x + rx * 0.85, y + ry * 0.25); c.lineCap = 'round'; c.lineWidth = lw * 1.0; c.strokeStyle = C.line; c.stroke(); return; }
  ink(c, ellP(x, y, rx, ry), C.eyeW, C.line, lw * 0.7);
  const ir = Math.min(rx, ry) * 0.74 * clamp(e.pup, 0.4, 1.25), px = x + e.look * (rx - ir) * 0.95, py = y + e.looky * (ry - ir) * 0.95 + (ry - ir) * 0.25;
  fillP(c, ellP(px, py, ir, ir), C.iris); fillP(c, ellP(px, py - ir * 0.06, ir * 0.82, ir * 0.82), C.pupil);
  fillP(c, ellP(px - ir * 0.34, py - ir * 0.38, ir * 0.36, ir * 0.36), '#ffffff'); fillP(c, ellP(px + ir * 0.36, py + ir * 0.4, ir * 0.17, ir * 0.17), '#ffffff');
  const lid = clamp(e.lid, 0, 1), lo = clamp(e.lidLo, 0, 1);
  c.save(); c.translate(x, y);
  if (lid > 0.02) { c.save(); c.rotate(e.mad * dir); const v = clamp(-1 + 2 * lid, -0.999, 0.999), a = Math.asin(v); c.beginPath(); c.ellipse(0, 0, rx + 0.3, ry + 0.3, 0, Math.PI - a, TAU + a); c.closePath(); c.fillStyle = C.lid; c.fill(); c.lineWidth = lw * 0.7; c.strokeStyle = C.line; c.stroke(); c.restore(); }
  if (lo > 0.02) { const v = clamp(1 - 1.2 * lo, -0.999, 0.999), a = Math.asin(v); c.beginPath(); c.ellipse(0, 0, rx + 0.3, ry + 0.3, 0, a, Math.PI - a); c.closePath(); c.fillStyle = C.lid; c.fill(); c.lineWidth = lw * 0.7; c.strokeStyle = C.line; c.stroke(); }
  c.restore();
}

const BODY = [[0, -30], [14, -27], [25, -15], [30, 2], [27, 19], [15, 29], [0, 31], [-15, 29], [-27, 19], [-30, 2], [-25, -15], [-14, -27]].map((q) => [q[0] * 1.05, q[1] * 0.9]);
const HEAD = [[0, -25], [14, -23], [24, -14], [28, -2], [26, 10], [17, 19], [2, 22], [-13, 19], [-24, 10], [-27, -3], [-23, -15], [-12, -23]];
const PATCH = [[-7, -8], [-1, -14.5], [8, -13.5], [13, -10], [18, -13.5], [24, -9.5], [25.5, 1], [23.5, 11], [15, 18], [3, 19.5], [-6, 15], [-9.5, 5]];
const FLIP = [[0, -7], [11, -8], [23, -5.5], [31, 0.5], [23, 5], [10, 6], [0, 5.5]];
const FOOT = [[-5, -3.6], [3, -4.8], [11, -3.4], [14.5, 0.6], [11, 3.8], [2, 4.2], [-5, 3.2]];
const FISH = [[-11, 0], [-5, -5], [3, -5.5], [9, -2], [15, -6], [14, 0], [15, 6], [9, 2], [3, 5.5], [-5, 5]];
const SHO0 = [-12, -13], SHO1 = [21, -12], KNOT = [-20, -15];

export function drawPenguin(ctx, x, y, s, t, pose, o = {}) {
  if (!(s > 0)) return;
  const p = pose, u = s / 100, frozen = o.frozen > 0, C = frozen ? ICED : PAL, lw = Math.max(2.3, 1.15 / u), face = o.face < 0 ? -1 : 1;
  const sy = 1 - p.sq, sx = 1 + p.sq * 0.7, cr = Math.cos(p.rot), sr = Math.sin(p.rot);
  const shiver = frozen && o.frozen < 1 ? Math.sin(t * 70) * 0.6 * (1 - o.frozen) : 0;
  const toPx = (lx, ly) => ({ x: x + shiver + (p.dx + lx * cr - ly * sr) * sx * u * face, y: y + (-p.by + lx * sr + ly * cr) * sy * u });
  const e = { look: p.look, looky: p.looky, lid: Math.max(p.lid, p.happy > 0.5 || p.squeeze > 0.5 || frozen ? 0 : blinkAt(t, 7)), lidLo: p.lidLo, pup: p.pup, happy: p.happy, squeeze: p.squeeze, spiral: p.spiral, mad: 0 };
  let brow = p.brow;
  if (o.eye === 'spiral') e.spiral = 1; else if (o.eye === 'happy') e.happy = 1; else if (o.eye === 'squeeze') e.squeeze = 1; else if (o.eye === 'wide') { e.pup = 0.55; e.lid = 0; } else if (o.eye === 'lock') { e.pup = 1.2; e.look = 1; } else if (o.eye === 'angry') brow = 1;
  if (frozen && !o.eye) { e.pup = 0.6; e.lid = 0; e.happy = e.squeeze = 0; brow = -0.8; } // caught mid-thought: wide eyes
  e.mad = clamp(brow, 0, 1) * 0.32;
  const stars = o.stars != null ? o.stars : p.stars;
  const tailDir = (A) => { const dxw = -Math.sin(A), dyw = Math.cos(A); return [dxw * cr + dyw * sr, -dxw * sr + dyw * cr]; }; // a world direction in the body's frame
  const paint = () => {
    ctx.save();
    ctx.translate(x + shiver, y); ctx.scale(u * face, u); ctx.scale(sx, sy); ctx.translate(p.dx, -p.by); ctx.rotate(p.rot);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const flipper = (S, a, far) => {
      ctx.save(); ctx.translate(S[0], S[1]); ctx.rotate(far ? Math.PI / 2 - a : Math.PI / 2 + a); if (far) ctx.scale(1, -1);
      ink(ctx, blobP(FLIP), far ? C.backLo : C.backLo, C.line, lw);
      if (!far && a > 1.6) { fillP(ctx, blobP(inset(FLIP, 0.74, 0.5, 0)), C.bellyLo); fillP(ctx, blobP(inset(FLIP, 0.6, 0, -0.6)), C.belly); }
      else if (!far) { fillP(ctx, blobP(inset(FLIP, 0.8, -0.5, -1.2)), C.back); fillP(ctx, ellP(11, -3.6, 7, 1.7, 0.03), C.backHi); }
      ctx.restore();
    };
    const foot = (ax, ay, fx, fy, fr, far) => {
      if (Math.hypot(fx - ax, fy - ay) > 9) hose(ctx, [[ax, ay], [fx, fy]], 6.5, C.beakLo, C.line, lw);
      ctx.save(); ctx.translate(fx, fy); ctx.rotate(fr);
      ink(ctx, blobP(FOOT), C.beakLo, C.line, lw);
      if (!far) fillP(ctx, blobP(inset(FOOT, 0.78, -0.4, -0.9)), C.beak);
      if (!MODE) { ctx.strokeStyle = C.line; ctx.lineWidth = lw * 0.5; ctx.beginPath(); ctx.moveTo(9, -2.2); ctx.lineTo(13.4, -0.8); ctx.moveTo(9, 1.4); ctx.lineTo(13.4, 1.8); ctx.stroke(); }
      ctx.restore();
    };
    // the scarf round his neck and its knot (the head sits on it)
    const wrapDraw = () => {
      const wrap = [[-25.5, -19.5], [-9, -12.5], [9, -12], [27, -18]];
      hose(ctx, wrap, 10, C.scarfLo, C.line, lw);
      if (!MODE) { ctx.beginPath(); spline(ctx, wrap.map((q) => [q[0] - 0.4, q[1] - 1.4]), false); ctx.lineWidth = 6.4; ctx.strokeStyle = C.scarf; ctx.stroke(); }
      ink(ctx, blobP([[-25, -18.5], [-19, -20.5], [-14.5, -15.5], [-17, -10], [-23, -11]]), C.scarf, C.line, lw);
    };
    // ---- far flipper (and the fish it holds), then the body: a fat pear, white belly
    if (p.fish > 0.05) {
      ctx.save(); ctx.translate(SHO1[0] + Math.sin(p.w1) * 29, SHO1[1] + Math.cos(p.w1) * 29); ctx.rotate(-p.rot + Math.PI / 2 + 0.14 * Math.sin(t * 1.9)); ctx.scale(p.fish * 1.15, p.fish * 1.15); ctx.translate(13, 0); ctx.scale(-1, 1);
      ink(ctx, blobP(FISH), C.fishLo, C.line, lw * 0.9); fillP(ctx, blobP([[-10, -0.5], [-5, -4.2], [3, -4.6], [8, -1.8], [3, 1.5], [-5, 1.6]]), C.fish); fillP(ctx, ellP(-1, 2.6, 7, 1.8), C.fishBelly);
      if (!MODE) { ctx.strokeStyle = C.line; ctx.lineWidth = lw * 0.55; ctx.beginPath(); ctx.moveTo(-8.2, -2.6); ctx.lineTo(-6, -0.8); ctx.moveTo(-6, -2.6); ctx.lineTo(-8.2, -0.8); ctx.moveTo(-3.4, -3.4); ctx.quadraticCurveTo(-1.8, 0, -3.4, 3); ctx.stroke(); }
      ctx.restore();
    }
    flipper(SHO1, p.w1, true);
    ink(ctx, blobP(BODY), C.backLo, C.line, lw);
    fillP(ctx, blobP(inset(BODY, 0.87, -2, -2.5)), C.back);
    fillP(ctx, ellP(-17, -9, 5, 8, 0.55), C.backHi);
    fillP(ctx, ellP(9, 4, 20, 21.6, 0.05), C.bellyLo); fillP(ctx, ellP(8, 2.2, 18, 19.3, 0.05), C.belly);
    foot(7, 21, p.f1x, p.f1y, p.f1r, true); foot(-8, 22, p.f0x, p.f0y, p.f0r, false);
    wrapDraw();
    // ---- scarf tails: two ribbons from the knot, a wave running down them
    const tail = (A, len, ph, w) => {
      const n = 5, pts = [[KNOT[0], KNOT[1]]]; let px = KNOT[0], py = KNOT[1];
      for (let i = 1; i <= n; i++) { const d = tailDir(A + p.scw * Math.sin(t * 13 - i * 1.0 + ph) * (0.25 + 0.75 * i / n)); px += d[0] * len / n; py += d[1] * len / n; pts.push([px, py]); }
      hose(ctx, pts, w, C.scarfLo, C.line, lw);
      if (!MODE) { ctx.beginPath(); spline(ctx, pts, false); ctx.lineWidth = w * 0.55; ctx.strokeStyle = C.scarf; ctx.stroke();
        const a = pts[n - 1], b = pts[n], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L; ctx.beginPath(); ctx.moveTo(b[0] + nx * w * 0.42, b[1] + ny * w * 0.42); ctx.lineTo(b[0] - nx * w * 0.42, b[1] - ny * w * 0.42); ctx.lineWidth = lw * 1.1; ctx.strokeStyle = C.wool; ctx.stroke(); }
    };
    tail(p.sca + 0.3, 31, 1.3, 8); tail(p.sca - 0.08, 39, 0, 9);
    // ---- head
    ctx.save();
    ctx.translate(p.hx, p.hy); ctx.rotate(p.hr); ctx.scale(p.hsc, p.hsc);
    if (stars > 0 && !MODE) dizzyStars(ctx, 0, -40, 27, 7, t, { n: Math.round(stars), layer: 'back', size: Math.max(6, 3.4 / u) });
    ink(ctx, blobP(HEAD), C.backLo, C.line, lw);
    fillP(ctx, blobP(inset(HEAD, 0.88, -1.5, -2.2)), C.back);
    fillP(ctx, blobP(PATCH), C.belly);
    fillP(ctx, ellP(-3, 12.5, 5.2, 3.2, -0.1), C.blush); fillP(ctx, ellP(24, 11, 2.2, 2.8, 0), C.blush);
    if (p.blush > 1.05 && !MODE) { ctx.globalAlpha = clamp(p.blush - 1, 0, 1); fillP(ctx, ellP(-3, 12.5, 6.5, 4.2, -0.1), '#ff6f8e'); ctx.globalAlpha = 1; }
    eyeDraw(ctx, 20.5, 0.5, 6.6, 9.6, e, C, lw, t, -1);
    eyeDraw(ctx, 4.5, 1, 9.6, 11, e, C, lw, t, 1);
    // brows: short dark dashes that act
    if (!MODE) {
      const browS = (bx, by2, len, dir) => { const a = (brow > 0 ? brow * 0.5 : brow * 0.42) * dir; ctx.save(); ctx.translate(bx, by2 + (brow > 0 ? brow * 2.4 : brow * 1.2)); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(-len, 0.6); ctx.quadraticCurveTo(0, -1.6, len, 0.6); ctx.lineWidth = lw * 1.25; ctx.strokeStyle = C.line; ctx.stroke(); ctx.restore(); };
      browS(3.5, -13.2, 5.2, 1); browS(20.5, -12.2, 3.6, -1);
    }
    // beak: the lower half drops open; mouth and tongue between
    const jw = clamp(p.jaw, 0, 1.1), ja = jw * 0.62;
    if (jw > 0.06) {
      ctx.save(); ctx.translate(9, 11); ctx.rotate(ja);
      ink(ctx, blobP([[-2, -2.5], [8, -3], [17, -1.5], [20.5, 1.5], [15, 5], [6, 5.5], [-2, 3.5]]), C.beakLo, C.line, lw * 0.8);
      fillP(ctx, blobP([[0, -2.6], [8, -3.2], [16, -2], [18, 0], [8, 1.5], [0, 0.5]]), C.mouth);
      if (jw > 0.3 || p.tongue > 0.3) fillP(ctx, ellP(8.5 + 3 * p.tongue, -0.6, 5 + 2 * p.tongue, 2.2), C.tongue);
      ctx.restore();
    }
    const ub = [[6.5, 8], [12, 4.2], [21, 5.4], [31.5, 10.4], [22, 13.2], [8, 12.6]];
    ink(ctx, blobP(ub), C.beakLo, C.line, lw * 0.8); fillP(ctx, blobP(inset(ub, 0.8, -0.8, -1)), C.beak); fillP(ctx, ellP(14.5, 6.9, 4.2, 1.2, 0.12), C.beakHi);
    if (jw <= 0.06 && p.tongue > 0.05) hose(ctx, [[17, 12.5], [18 + 1.5 * p.tongue, 13 + 5.5 * p.tongue]], 4.6, C.tongue, C.line, lw * 0.6); // the tongue of concentration
    // the hat: a red beanie with a ribbed cream band and a pompom on a floppy tip
    ctx.save(); ctx.translate(0, -17 - p.hat); ctx.rotate(p.hatr); ctx.translate(0, 17);
    const pa = -0.5 + p.pom, tx = -7 + Math.sin(pa) * 13, ty = -37 - Math.cos(pa) * 10;
    hose(ctx, [[-6, -32], [-7 + Math.sin(pa) * 6, -37 - Math.cos(pa) * 4], [tx, ty]], 9, C.scarf, C.line, lw);
    const dome = [[-26, -14], [-26, -24], [-17, -34], [-3, -38.5], [11, -35], [21, -26], [25.5, -17], [12, -20.5], [-7, -19]];
    ink(ctx, blobP(dome), C.scarfLo, C.line, lw); fillP(ctx, blobP(inset(dome, 0.86, -1.2, -1.8)), C.scarf);
    fillP(ctx, ellP(-11, -29.5, 7.5, 3, -0.6), C.scarfHi);
    if (!MODE) { ctx.beginPath(); spline(ctx, [[-22, -26], [-8, -30.5], [8, -29.5], [20, -24.5]], false); ctx.lineWidth = 3.2; ctx.strokeStyle = C.wool; ctx.stroke(); }
    const band = [[-26, -13.5], [-12, -18], [4, -19.6], [16, -19], [26, -16.5]];
    hose(ctx, band, 7.6, C.woolLo, C.line, lw);
    if (!MODE) { ctx.beginPath(); spline(ctx, band.map((q) => [q[0] - 0.3, q[1] - 1.1]), false); ctx.lineWidth = 4.8; ctx.strokeStyle = C.wool; ctx.stroke();
      ctx.strokeStyle = C.woolLo; ctx.lineWidth = lw * 0.5; ctx.beginPath(); for (let i = 0; i < 7; i++) { const bx = -20 + i * 6.6, by2 = -15.5 - 4.2 * Math.sin(((bx + 26) / 52) * Math.PI * 0.9); ctx.moveTo(bx, by2 - 3); ctx.lineTo(bx + 0.8, by2 + 3); } ctx.stroke(); }
    ink(ctx, ellP(tx, ty, 7.6, 7.2), C.woolLo, C.line, lw); fillP(ctx, ellP(tx - 1, ty - 1.3, 5.8, 5.2), C.wool);
    ctx.restore();
    if (stars > 0 && !MODE) dizzyStars(ctx, 0, -40, 27, 7, t, { n: Math.round(stars), layer: 'front', size: Math.max(6, 3.4 / u) });
    // the sneeze: a burst of snow from the beak
    if (p.puf > 0.02 && p.puf < 0.99 && !MODE) {
      const f = p.puf, a = 1 - ss(0.5, 1, f);
      for (let i = 0; i < 5; i++) { const an = -0.5 + i * 0.25, r0 = 6 + (30 + 9 * (i % 2)) * Math.sqrt(f); lump(ctx, 31 + Math.cos(an) * r0, 11 + Math.sin(an) * r0 + 10 * f * f, (3.5 + 5 * Math.sqrt(f)) * (1 - 0.25 * (i % 2)), C, lw * 0.7, a); }
      if (f < 0.35) { ctx.strokeStyle = C.line; ctx.lineWidth = lw; ctx.beginPath(); for (let i = 0; i < 4; i++) { const an = -0.7 + i * 0.45; ctx.moveTo(34 + Math.cos(an) * 6, 11 + Math.sin(an) * 6); ctx.lineTo(34 + Math.cos(an) * (12 + 30 * f), 11 + Math.sin(an) * (12 + 30 * f)); } ctx.stroke(); }
    }
    if (p.sigh > 0.05 && !MODE) lump(ctx, 36 + 9 * p.sigh, 16 + 5 * p.sigh, 2.5 + 3 * p.sigh, C, lw * 0.6, 0.85 * Math.sin(clamp(p.sigh, 0, 1) * Math.PI * 0.5));
    if (p.sweat > 0.05 && !MODE) for (let i = 0; i < 3; i++) { const f = fract(t * 1.7 + i / 3), an = -2.3 + i * 0.5, r0 = 30 + f * 16; ctx.save(); ctx.translate(Math.cos(an) * r0, Math.sin(an) * r0 + f * f * 8); ctx.rotate(an + Math.PI / 2); ctx.globalAlpha = p.sweat * (1 - f * f); ink(ctx, (c) => { c.beginPath(); c.moveTo(0, -5); c.quadraticCurveTo(3.4, 0, 0, 3); c.quadraticCurveTo(-3.4, 0, 0, -5); c.closePath(); }, C.sweat, C.line, lw * 0.6); ctx.restore(); }
    ctx.restore();
    // ---- the near flipper last
    flipper(SHO0, p.w0, false);
    ctx.restore();
    // snow shaken off: flecks flung out from the body (world axes)
    if (p.snow > 0.05 && !MODE) {
      ctx.save(); ctx.translate(x, y); ctx.scale(u * face, u);
      for (let i = 0; i < 9; i++) { const f = fract(t * 2.6 + i / 9 + (i % 3) * 0.11), an = -Math.PI * (0.08 + 0.84 * ((i * 4) % 9) / 8), r0 = 30 + 46 * f; lump(ctx, p.dx + Math.cos(an) * r0 * 1.15, -p.by - 12 + Math.sin(an) * r0 + 34 * f * f, 4.6 - 2.4 * f, C, lw * 0.75, p.snow * (1 - f * f)); }
      ctx.restore();
    }
  };
  if (frozen) { MODE = 1; try { paint(); MODE = 2; paint(); } finally { MODE = 0; } }
  paint();
  if (frozen) { // glints on the shell
    const g = (lx, ly, k) => { const q = toPx(lx, ly); ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(-0.6); ctx.lineCap = 'round'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1.2, 2.6 * u); ctx.beginPath(); ctx.moveTo(-6 * u * k, 0); ctx.lineTo(6 * u * k, 0); ctx.moveTo(-3 * u * k, 5 * u); ctx.lineTo(2 * u * k, 5 * u); ctx.stroke(); ctx.restore(); };
    g(-23, -8, 1.2); g(p.hx - 20, p.hy - 30, 1);
    const tw = toPx(p.hx + 26, p.hy - 30), k = 0.6 + 0.4 * Math.sin(t * 4); ctx.save(); ctx.translate(tw.x, tw.y); ctx.fillStyle = '#ffffff'; ctx.beginPath(); for (let i = 0; i < 8; i++) { const r = (i % 2 ? 1.6 : 7 * k) * u, a = (i * Math.PI) / 4; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.restore();
  }
  if (o.out) {
    const hc = Math.cos(p.hr), hs = Math.sin(p.hr), H = (lx, ly) => toPx(p.hx + (lx * hc - ly * hs) * p.hsc, p.hy + (lx * hs + ly * hc) * p.hsc);
    const bk = H(31, 10), flat = ss(0.6, 1.3, p.rot), ext = lerp(31, 68, flat) * sx; // his reach ahead of the body centre: belly when upright, beak when flat
    o.out.beak = bk; o.out.head = H(0, 0); o.out.top = H(-3, -40);
    o.out.front = { x: x + (p.dx * sx + lerp(24, 10, flat)) * u * face, y };
    o.out.push = { x: x + (p.dx * sx + ext) * u * face, y: y - lerp(26, 22, flat) * u };
  }
}
