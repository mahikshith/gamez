// The den fox (v3.5): the full-body fox who lives INSIDE the vault on boss levels with a den run (sim/foxden.js).
// Same fox as everywhere else (the head sprites on cards and intros, drawFox in characters.js): the FOX palette,
// cream muzzle, chest and tail tip, dark socks and ear tips, amber eyes under sly lids.
//
// drawDenFox(ctx, x, y, s, t, pose, o) draws the rig, seen from the side, in a local y-DOWN pixel space:
//   (x, y)  the floor point between its feet; it faces +x (o.face -1 mirrors it). s = torso length in px
//           (FOXRIG.torso m x px per metre). 100 units = s.
//   pose    a pose object from foxPose() (plain numbers, so poses blend)
//   o       {only: 'head' (the over-pass on a held egg), frozen (s left, or 0), crack 0..1, zap 0..1, stars 0..3,
//            sweat 0..1, tears 0..1, eye: 'normal' | 'lock' | 'wide' | 'squeeze' | 'spiral' | 'happy',
//            out: {} receives mouth {x, y} in the same px space}
// foxPose(state, t, u, odo) gives the pose for a state: idle (sniff), prowl (trot), stalk, crouch (wiggle, u = telegraph
// progress), leap (u = flight progress), grab, carry (trot with the egg), toss (u: wind-up, then flick), trapped
// (scrabble), hurt, stunned, bonk, laugh, defeated (limp, crying), frozen (held pose).
// Frozen and stunned follow the shared creature-state look (agent-brief-2): the fox's own colours tinted toward
// #bfe6ff inside an ice shell that follows its silhouette with a dark-blue rim; stunned = slack pose, spiral eyes,
// tongue out, three stars on a tilted ellipse that pass behind the head.
import { FACE as FOX } from './foxface.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
const fract = (x) => x - Math.floor(x);
const hash = (n) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const mixHex = (a, b, k) => { const A = hex(a), B = hex(b); return rgb([A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k]); };

// sizes in metres (the sim reads these: where the mouth is, how tall the fox stands)
export const FOXRIG = { torso: 0.72, height: 0.62, mouthX: 0.62, mouthY: 0.4, len: 1.45 };
const ICE = '#bfe6ff', RIM = '#2f6f9e', HS = 1.38; // HS: the head is drawn big (cartoon proportions, the face must read on a phone)
const PAL = { ...FOX, sock: '#3a1608', nose: '#1d0b04', white: '#ffffff', eyeW: '#fffaf0' };
// iced colours: the fox's own colours, the orange drained (straight mixing of orange and ice blue reads beige) and
// then taken ~60% toward the ice
const desat = (c, k) => { const A = hex(c), L = 0.299 * A[0] + 0.587 * A[1] + 0.114 * A[2]; return '#' + A.map((v) => Math.round(v + (L - v) * k).toString(16).padStart(2, '0')).join(''); };
const ICED = (() => { const o = {}; for (const k in PAL) o[k] = mixHex(desat(PAL[k], 0.75), '#a8d8f8', 0.6); return o; })();

// ------------------------------------------------------------------ poses
// by: torso centre height above the floor; dx: torso shift; pitch (+ nose up); st: stretch along the body; sq: squash;
// hx, hy, hr: head offset and pitch; jaw 0..1; ear 0 up .. 1 flat back (-0.4 pricked forward); look: pupils -1..1;
// lid 0 open .. 1 shut; brow: -1 sad .. 1 fierce; tail: base angle (+ up), tc: curl, tw: wave; puff: tail/fur bristle;
// tongue 0..1; legs: feet [x, y] (floor space) near-front, far-front, near-hind, far-hind
const KEYS = ['by', 'dx', 'pitch', 'st', 'sq', 'hx', 'hy', 'hr', 'jaw', 'ear', 'look', 'lid', 'brow', 'tail', 'tc', 'tw', 'puff', 'tongue',
  'f0x', 'f0y', 'f1x', 'f1y', 'f2x', 'f2y', 'f3x', 'f3y'];
const REST = { by: 44, dx: 0, pitch: 0, st: 1, sq: 0, hx: 0, hy: 0, hr: 0, jaw: 0, ear: 0, look: 0.3, lid: 0.25, brow: 0.3, tail: 0.2, tc: 0.5, tw: 0, puff: 0, tongue: 0,
  f0x: 30, f0y: 0, f1x: 36, f1y: 0, f2x: -30, f2y: 0, f3x: -24, f3y: 0 };
const P = (o) => Object.assign({}, REST, o);
const STRIDE = 30; // units: a foot's stance travel (a trot advances 2 x STRIDE per cycle)
export const FOX_CYCLE = (2 * STRIDE * FOXRIG.torso) / 100; // metres per trot cycle

// a trot: diagonal pairs (near-front with far-hind), feet planted while in stance. lift = swing height, L = stride
function trot(ph, L = STRIDE, lift = 9) {
  const f = {};
  [[0, 30, 0], [1, 36, 0.5], [2, -30, 0.5], [3, -24, 0]].forEach(([i, x0, off]) => {
    const p = fract(ph + off);
    let x, y;
    if (p < 0.5) { x = x0 + L / 2 - (p / 0.5) * L; y = 0; } else { const q = (p - 0.5) / 0.5; x = x0 - L / 2 + ss(0, 1, q) * L; y = -Math.sin(q * Math.PI) * lift; }
    f[`f${i}x`] = x; f[`f${i}y`] = y;
  });
  return f;
}

export function foxPose(state, t, u = 0, odo = 0) {
  const ph = (odo / FOX_CYCLE) || 0, bob = Math.sin(ph * TAU * 2);
  switch (state) {
    case 'prowl': return P({ ...trot(ph), by: 44 + 1.6 * bob, pitch: 0.02 * Math.sin(ph * TAU), hx: 3, hy: 5 + 1.2 * bob, hr: 0.12, tail: 0.12, tc: 0.35, tw: Math.sin(ph * TAU) * 0.25, ear: -0.1, look: 0.6, lid: 0.3 });
    case 'stalk': return P({ ...trot(ph, 22, 5), by: 33 + 0.8 * bob, pitch: -0.05, hx: 8, hy: 10, hr: 0.05, tail: 0.0, tc: 0.15, tw: Math.sin(t * 3) * 0.08, ear: -0.35, look: 1, lid: 0.45, brow: 0.9 });
    case 'carry': return P({ ...trot(ph, 26, 7), by: 43 + 1.4 * bob, pitch: 0.06, hx: 2, hy: -6, hr: -0.32, jaw: 0.3, tail: 0.75 + 0.1 * Math.sin(t * 7), tc: 0.7, tw: Math.sin(t * 7) * 0.3, ear: 0.1, look: 0.8, lid: 0.5, brow: 0.6 });
    case 'defeated': return P({ ...trot(ph, 18, 5), by: 36 + 2.2 * Math.abs(bob), pitch: -0.08, hx: 4, hy: 12, hr: 0.45, tail: -0.55, tc: -0.2, tw: Math.sin(t * 3) * 0.06, ear: 1, lid: 0.8, brow: -1, jaw: 0.25 + 0.15 * Math.max(0, Math.sin(t * 8)) });
    case 'crouch': {
      // drop low, rump up, wiggle (faster as it nears the spring), tail lashing, eyes locked
      const e = ss(0, 0.35, u), w = Math.sin(t * (14 + 10 * u)) * e;
      return P({ by: lerp(44, 25, e), dx: w * 2.2, pitch: lerp(0, -0.16, e) + w * 0.03, hx: lerp(0, 9, e), hy: lerp(0, 4, e), hr: lerp(0, -0.18, e), ear: lerp(0, -0.45, e), look: 1, lid: lerp(0.3, 0.55, e), brow: 1,
        tail: lerp(0.2, 0.05, e), tc: 0.2, tw: Math.sin(t * 13) * 0.35 * e, f0x: lerp(30, 40, e), f1x: lerp(36, 45, e), f2x: lerp(-30, -34, e), f3x: lerp(-24, -29, e) });
    }
    case 'leap': {
      // spring: stretched out, forelegs reaching, hind legs kicked back; tuck at the top, forelegs down to land
      const tuck = Math.sin(clamp(u, 0, 1) * Math.PI), land = ss(0.7, 1, u);
      return P({ by: 44, st: 1.12 - 0.1 * tuck * (1 - land), pitch: 0, hx: 6, hy: -2, hr: lerp(-0.15, 0.25, land), jaw: lerp(0.75, 0.4, land), ear: 0.75, look: 1, lid: 0.1, brow: 1, tail: -0.05, tc: -0.1, tw: 0.15 * Math.sin(t * 9),
        f0x: lerp(72, 46, land), f0y: lerp(-30, -6, land), f1x: lerp(66, 52, land), f1y: lerp(-26, -4, land), f2x: lerp(-74, -40, tuck * 0.6), f2y: lerp(-24, -10, tuck), f3x: lerp(-68, -34, tuck * 0.6), f3y: lerp(-20, -6, tuck) });
    }
    case 'grab': { // head dips, jaws snap shut on the egg
      const d = Math.sin(clamp(u, 0, 1) * Math.PI);
      return P({ by: 36, pitch: -0.08 * d, hx: 10 * d + 2, hy: 10 * d, hr: 0.3 * d, jaw: lerp(0.75, 0.3, ss(0.35, 0.7, u)), ear: 0.2, look: 1, lid: 0.35, brow: 1, tail: 0.4, tw: Math.sin(t * 10) * 0.2, f0x: 38, f1x: 44 });
    }
    case 'toss': { // wind-up: head back with the orb in its jaws, then a flick of the head up and forward
      const w = ss(0, 0.75, u), f = ss(0.75, 1, u);
      return P({ by: 42, pitch: lerp(0, 0.1, w) - 0.18 * f, hx: lerp(0, -8, w) + 12 * f, hy: lerp(0, -8, w) - 4 * f, hr: lerp(0, -0.5, w) + 0.6 * f, jaw: lerp(0.25, 0.25, w) + 0.6 * f, ear: 0.3, look: 0.6, lid: 0.55, brow: 1,
        tail: 0.5 + 0.3 * w, tw: Math.sin(t * 8) * 0.2, f0x: 34, f1x: 40, f2x: -32, f3x: -26 });
    }
    case 'trapped': { // scrabbling against the floor: paws paddle fast in place, ears flat, tail bristled
      const sp = t * 15;
      return P({ by: 30 + Math.sin(sp * 2) * 1.6, dx: Math.sin(t * 37) * 1.2, pitch: 0.12 + Math.sin(t * 9) * 0.05, hx: 4, hy: -4, hr: -0.4 + Math.sin(t * 11) * 0.12, jaw: 0.45 + 0.25 * Math.sin(t * 13), ear: 1, look: Math.sin(t * 5), lid: 0, brow: -0.6,
        tail: 0.45, tc: 0.9, tw: Math.sin(t * 23) * 0.3, puff: 1,
        f0x: 36 + Math.cos(sp) * 12, f0y: -Math.max(0, Math.sin(sp)) * 16, f1x: 40 + Math.cos(sp + 3.1) * 12, f1y: -Math.max(0, Math.sin(sp + 3.1)) * 16,
        f2x: -28 + Math.cos(sp * 1.3 + 1) * 8, f2y: -Math.max(0, Math.sin(sp * 1.3 + 1)) * 8, f3x: -22 + Math.cos(sp * 1.3 + 4) * 8, f3y: -Math.max(0, Math.sin(sp * 1.3 + 4)) * 8 });
    }
    case 'hurt': { // a jolt: thrown back and squashed, eyes squeezed, a yelp
      const k = Math.sin(clamp(u, 0, 1) * Math.PI);
      return P({ by: 38 - 6 * k, dx: -6 * k, sq: 0.12 * k, pitch: 0.2 * k, hx: -4 * k, hy: -6 * k, hr: -0.5 * k, jaw: 0.8 * k, ear: 1, lid: 1, brow: -1, tail: 0.9 * k, tc: 1, puff: k, f0x: 34, f1x: 40 });
    }
    case 'stunned': { // slack: head droops, body sags with a slow wobble, tongue out
      const w = Math.sin(t * 2.2);
      return P({ by: 31 + 1.5 * w, dx: w * 1.5, pitch: -0.1 + w * 0.05, hx: 4 + 2 * w, hy: 14, hr: 0.55 + 0.1 * w, jaw: 0.4, tongue: 1, ear: 0.85, lid: 0, brow: -0.8, tail: -0.3, tc: -0.1, tw: w * 0.05,
        f0x: 36, f1x: 42, f2x: -34, f3x: -28 });
    }
    case 'bonk': { // the pounce was blocked: flattened against the floor, then shakes it off
      const k = 1 - ss(0, 1, u);
      return P({ by: lerp(38, 22, k), sq: 0.22 * k, pitch: -0.06 * k, hx: 4, hy: 6 * k, hr: 0.3 * k, jaw: 0.2, ear: 1 * k + 0.2, lid: 0.6 * k, brow: -0.5, tail: -0.2 * k + 0.2, puff: 0.6 * k, f0x: 46, f1x: 52, f2x: -42, f3x: -36 });
    }
    case 'laugh': { // sits back on its haunches and cackles
      const h = Math.abs(Math.sin(t * 9));
      return P({ by: 40 + 3 * h, dx: -6, pitch: 0.45, hx: -2, hy: -10 - 2 * h, hr: -0.45 - 0.08 * h, jaw: 0.6 + 0.3 * h, ear: 0.15, lid: 1, brow: 0.6, tail: 0.9, tc: 0.9, tw: Math.sin(t * 9) * 0.2,
        f0x: 22, f1x: 28, f2x: -26, f3x: -20 });
    }
    default: { // idle: stands and sniffs the floor in short bursts, ears twitch, tail sways
      const sn = Math.max(0, Math.sin(t * 0.9)), bur = Math.sin(t * 22) * ss(0.4, 0.8, sn), tw = slotTwitch(t);
      return P({ by: 44 + Math.sin(t * 2.4) * 0.7, hx: 2 + 4 * sn, hy: 12 * sn - 2, hr: 0.5 * sn + 0.05 * bur, ear: -0.1 + tw * 0.4, look: 0.5 + 0.4 * sn, lid: 0.3, tail: 0.25 + 0.06 * Math.sin(t * 1.7), tc: 0.55, tw: Math.sin(t * 1.9) * 0.18 });
    }
  }
}
function slotTwitch(t) { const k = Math.floor(t / 2.3), f = fract(t / 2.3); return hash(k) > 0.5 ? Math.sin(clamp((f - 0.3) / 0.08, 0, 1) * Math.PI) : 0; }

// eased pose blending per fox (id): every pose change glides over ~0.12 s
const MEM = {};
export function foxBlend(id, pose, t, rate = 9) {
  let m = MEM[id];
  if (!m || t < m.t - 0.5 || t - m.t > 1) { m = MEM[id] = { t, p: { ...pose } }; return m.p; }
  const a = 1 - Math.exp(-(t - m.t) * rate);
  m.t = t;
  for (const k of KEYS) m.p[k] += (pose[k] - m.p[k]) * a;
  return m.p;
}

// ------------------------------------------------------------------ drawing
// Every body part is a path or a limb (a thick round-capped polyline). Layers draw outline first, then fill, so a
// group (torso + neck + head) has one clean silhouette; the frozen shell is the same paths stroked wider.
function ik(jx, jy, fx, fy, a, b) {
  let dx = fx - jx, dy = fy - jy, d = Math.hypot(dx, dy);
  const m = a + b - 0.5;
  if (d > m) { fx = jx + (dx / d) * m; fy = jy + (dy / d) * m; dx = fx - jx; dy = fy - jy; d = m; }
  d = Math.max(d, Math.abs(a - b) + 0.5);
  const base = Math.atan2(dy, dx), A = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
  const k1 = { x: jx + a * Math.cos(base + A), y: jy + a * Math.sin(base + A) }, k2 = { x: jx + a * Math.cos(base - A), y: jy + a * Math.sin(base - A) };
  return { knee: k1.x < k2.x ? k1 : k2, fx, fy }; // joints bend backward (elbow / hock)
}

export function drawDenFox(ctx, x, y, s, t, pose, o = {}) {
  if (!(s > 0)) return;
  const C = o.frozen > 0 ? ICED : PAL, frozen = o.frozen > 0, only = o.only;
  const u = s / 100, ow = Math.max(3.4, 1.25 / u); // outline width in units (never under ~1.25 px)
  const p = pose;
  ctx.save();
  try {
    ctx.translate(x, y);
    if (frozen && o.frozen < 1) ctx.translate(Math.sin(t * 70) * 0.6 * (1 - o.frozen), 0); // the last second: it shivers
    ctx.scale(u * (o.face < 0 ? -1 : 1), u);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // torso frame
    const by = p.by, cx = p.dx, cy = -by, cp = Math.cos(p.pitch), sp = Math.sin(p.pitch), st = p.st, sy = 1 - p.sq, sx = st * (1 + p.sq * 0.6);
    const T = (lx, ly) => ({ x: cx + (lx * sx) * cp + (ly * sy) * sp, y: cy - (lx * sx) * sp + (ly * sy) * cp });
    const torsoPath = (c) => {
      const q = (a, b) => T(a, b), m = (pt) => c.moveTo(pt.x, pt.y), bz = (a, b, d) => c.bezierCurveTo(a.x, a.y, b.x, b.y, d.x, d.y);
      c.beginPath();
      m(q(-44, -2)); bz(q(-45, -15), q(-30, -17), q(-10, -15.5)); bz(q(8, -14), q(26, -19), q(38, -11)); bz(q(48, -5), q(45, 9), q(33, 12.5));
      bz(q(16, 14), q(-6, 11), q(-22, 12)); bz(q(-38, 12), q(-46, 8), q(-44, -2)); c.closePath();
    };
    // head frame: neck point on the torso, then the skull centre
    const N = T(40, -14), hcx = N.x + 8 + p.hx, hcy = N.y - 7 + p.hy - (p.pitch * 20), hr = p.hr - p.pitch * 0.5;
    const hc = Math.cos(hr) * HS, hs = Math.sin(hr) * HS;
    const H = (lx, ly) => ({ x: hcx + lx * hc - ly * hs, y: hcy + lx * hs + ly * hc });
    const jawA = p.jaw * 0.62, JP = { x: 2, y: 6 };
    const J = (lx, ly) => { const dx = lx - JP.x, dy = ly - JP.y, c = Math.cos(jawA), s2 = Math.sin(jawA); return H(JP.x + dx * c - dy * s2, JP.y + dx * s2 + dy * c); };
    const pathOf = (pts, close = true) => (c) => { c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); if (close) c.closePath(); };
    const skull = (c) => { const q = H(0, -1); c.beginPath(); c.ellipse(q.x, q.y, 15.5 * HS, 14.5 * HS, hr, 0, TAU); };
    const cheek = pathOf([H(-10, -3), H(-22, 5), H(-13, 7), H(-19, 14), H(-7, 11), H(-6, 19), H(3, 11), H(4, 4)]);
    const snout = (c) => {
      const a = H(2, -8.5), b1 = H(12, -8), b2 = H(24, -4), tip = H(31.5, -0.5), lo = H(31.5, 2.4), c1 = H(25, 5), c2 = H(14, 7), e = H(2, 8.5);
      c.beginPath(); c.moveTo(a.x, a.y); c.bezierCurveTo(b1.x, b1.y, b2.x, b2.y, tip.x, tip.y); c.lineTo(lo.x, lo.y); c.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, e.x, e.y); c.closePath();
    };
    const jaw = pathOf([J(2, 5), J(27, 4.5), J(25, 8), J(12, 10.5), J(2, 10.5)]);
    const neck = pathOf([T(14, -16), T(44, 3), H(6, 11), H(-12, 2)]);
    const ear = (dx, dy, back) => {
      const ea = -0.1 - p.ear * 1.05 + (back ? 0.14 : 0), b = H(-3 + dx, -11 + dy), L = 21 - (back ? 2 : 0);
      const c = Math.cos(ea + hr) * HS, s2 = Math.sin(ea + hr) * HS;
      const R = (lx, ly) => ({ x: b.x + lx * c - ly * s2, y: b.y + lx * s2 + ly * c });
      const sh = (c2) => { const q = [R(-7.5, 2), R(7.5, 0)], tp = R(-1.5, -L), m0 = R(-4.5, -L * 0.6), m1 = R(4.5, -L * 0.6); c2.beginPath(); c2.moveTo(q[0].x, q[0].y); c2.quadraticCurveTo(m1.x + (m1.x - m0.x) * 0.1, m1.y, q[1].x, q[1].y); c2.lineTo(q[1].x, q[1].y); c2.quadraticCurveTo(m1.x, m1.y, tp.x, tp.y); c2.quadraticCurveTo(m0.x, m0.y, q[0].x, q[0].y); c2.closePath(); };
      return { path: sh, tip: pathOf([R(-14, -L * 0.6), R(14, -L * 0.5), R(14, -L - 6), R(-14, -L - 6)]), inner: pathOf([R(1.5, -0.5), R(6, 0), R(-0.5, -L * 0.66)]) };
    };
    // tail: a bushy tapered shape from the rump
    const tailPath = (() => {
      const base = T(-43, -6), n = 12, len = 66 * (1 + p.puff * 0.08), pts = [];
      let a = Math.PI + p.pitch - p.tail, px = base.x, py = base.y;
      const ctr = [];
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        ctr.push({ x: px, y: py, a });
        a += (-p.tc * 0.16 + p.tw * Math.sin(f * 3) * 0.12) * (0.4 + f);
        px += Math.cos(a) * (len / n) * 1; py -= Math.sin(a) * (len / n);
      }
      const w = (f) => (4 + 15 * Math.sin(Math.min(1, f * 1.25) * Math.PI * 0.62) - 9 * ss(0.8, 1, f)) * (1 + p.puff * 0.35);
      const L = [], R = [];
      ctr.forEach((q, i) => { const f = i / n, nx = Math.sin(q.a), ny = Math.cos(q.a), ww = w(f); L.push({ x: q.x + nx * ww, y: q.y + ny * ww }); R.push({ x: q.x - nx * ww, y: q.y - ny * ww }); });
      const tip = ctr[n], ta = ctr[n].a;
      return { path: (c) => {
        c.beginPath(); c.moveTo(L[0].x, L[0].y);
        for (let i = 1; i <= n; i++) c.lineTo(L[i].x, L[i].y);
        c.quadraticCurveTo(tip.x + Math.cos(ta) * 9, tip.y - Math.sin(ta) * 9, R[n].x, R[n].y);
        for (let i = n - 1; i >= 0; i--) c.lineTo(R[i].x, R[i].y);
        c.closePath();
      }, cut: ctr[Math.round(n * 0.76)] };
    })();
    // legs: shoulder / hip joints on the torso, feet from the pose (floor space: y up negative)
    const legs = [
      { j: T(26, 6), f: [p.f0x, p.f0y], a: 22, b: 22, w0: 11, w1: 7.5, far: false, front: true },
      { j: T(30, 4), f: [p.f1x, p.f1y], a: 22, b: 22, w0: 10, w1: 7, far: true, front: true },
      { j: T(-28, 2), f: [p.f2x, p.f2y], a: 21, b: 24, w0: 12, w1: 7.5, far: false, front: false },
      { j: T(-24, 0), f: [p.f3x, p.f3y], a: 21, b: 24, w0: 11, w1: 7, far: true, front: false },
    ].map((L) => { const r = ik(L.j.x, L.j.y, L.f[0], L.f[1], L.a, L.b); return { ...L, k: r.knee, fx: r.fx, fy: r.fy }; });

    // ---- passes. paint(kind, path|limb, fill): kind 'path' or 'limb'
    const drawLimb = (L, pass) => {
      const lw = (w) => (pass === 'outline' ? w + 2 * ow : pass === 'rim' ? w + 2 * ow + 2 * SH : pass === 'ice' ? w + 2 * ow + 2 * SH - 2 * RW : w);
      const col = pass === 'outline' ? C.line : pass === 'rim' ? RIM : pass === 'ice' ? 'rgba(214,240,255,1)' : null;
      ctx.lineCap = 'round';
      const seg = (a, b, w, c2) => { ctx.strokeStyle = col || c2; ctx.lineWidth = lw(w); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };
      const F = { x: L.fx, y: L.fy };
      const furc = L.far ? C.furLo : C.fur;
      seg(L.j, L.k, L.w0, furc);
      if (L.front) seg(L.k, F, L.w1, C.sock);
      else { const m = { x: (L.k.x + F.x) / 2, y: (L.k.y + F.y) / 2 }; seg(L.k, m, L.w1 + 1, furc); seg(m, F, L.w1, C.sock); }
      // paw
      ctx.fillStyle = col || C.sock;
      ctx.beginPath(); ctx.ellipse(F.x + 2.5, F.y - 2.5, 5.5 + (col ? lw(0) / 2 : 0), 3.6 + (col ? lw(0) / 2 : 0), 0, 0, TAU); ctx.fill();
    };
    const SH = 5.5, RW = 2.2; // ice shell thickness beyond the outline, its dark rim (units)
    const fillPath = (path, pass, fill) => {
      path(ctx);
      if (pass === 'outline') { ctx.strokeStyle = C.line; ctx.lineWidth = 2 * ow; ctx.stroke(); }
      else if (pass === 'rim') { ctx.strokeStyle = RIM; ctx.lineWidth = 2 * (ow + SH); ctx.stroke(); ctx.fillStyle = RIM; ctx.fill(); }
      else if (pass === 'ice') { ctx.strokeStyle = 'rgb(214,240,255)'; ctx.lineWidth = 2 * (ow + SH - RW); ctx.stroke(); ctx.fillStyle = 'rgb(214,240,255)'; ctx.fill(); }
      else { ctx.fillStyle = fill; ctx.fill(); }
    };
    const earN = ear(0, 0, false), earF = ear(-8, 1, true);
    const headParts = (pass) => {
      fillPath(cheek, pass, C.cream);
      fillPath(skull, pass, C.fur);
      fillPath(snout, pass, C.fur);
    };
    const groups = only === 'head'
      ? [(pass) => { fillPath(earF.path, pass, C.furLo); }, (pass) => headParts(pass), (pass) => fillPath(earN.path, pass, C.fur)]
      : [
        (pass) => { for (const L of legs) if (L.far) drawLimb(L, pass); },
        (pass) => fillPath(tailPath.path, pass, C.fur),
        (pass) => fillPath(earF.path, pass, C.furLo),
        (pass) => { if (p.jaw > 0.05) fillPath(jaw, pass, C.fur); fillPath(torsoPath, pass, C.fur); fillPath(neck, pass, C.fur); if (pass === 'fill') torsoShade(); headParts(pass); },
        (pass) => { for (const L of legs) if (!L.far) drawLimb(L, pass); },
        (pass) => fillPath(earN.path, pass, C.fur),
      ];
    // frozen: the shell first (all parts, stroked wide: an offset of the fox's own silhouette)
    if (frozen) { for (const g of groups) g('rim'); for (const g of groups) g('ice'); }
    const stars = o.stars > 0 ? starPts(t, o.stars) : null;
    const headTop = H(-4, -24);
    const sk = Math.max(1, 3.6 / (5.2 * u)); // stars never smaller than ~7 px across
    if (stars) drawStars(ctx, stars, headTop, ow, false, sk);
    groups.forEach((g, gi) => {
      g('outline'); g('fill');
      // details per group, inside the silhouette
      if (only === 'head' && gi === 1) headDetails();
      if (only !== 'head') {
        if (gi === 1) tailTip();
        if (gi === 2) earTip(earF);
        if (gi === 3) headDetails();
      }
      if ((only !== 'head' && gi === 5) || (only === 'head' && gi === 2)) { fillPath(earN.inner, 'fill', C.earIn); earTip(earN); }
    });
    if (o.crown) crown();
    // the Fox King: the same fox with a small gold crown set between the ears
    function crown() {
      const P = [[-13, -19], [-15, -35], [-8, -27], [-3, -38], [2, -27], [9, -34], [7, -19]].map(([a, b]) => H(a, b));
      ctx.beginPath(); P.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath();
      ctx.lineJoin = 'round'; ctx.strokeStyle = C.line; ctx.lineWidth = 2 * ow; ctx.stroke();
      ctx.fillStyle = frozen ? mixHex('#ffcf3a', ICE, 0.55) : '#ffcf3a'; ctx.fill();
      const g = H(-3, -23);
      ctx.fillStyle = frozen ? '#9fc6e6' : '#e0312b'; ctx.beginPath(); ctx.arc(g.x, g.y, 2.6, 0, TAU); ctx.fill();
      ctx.lineWidth = ow * 0.6; ctx.stroke();
    }
    function earTip(E) { ctx.save(); E.path(ctx); ctx.clip(); fillPath(E.tip, 'fill', C.dark); ctx.restore(); }
    function tailTip() {
      ctx.save(); tailPath.path(ctx); ctx.clip();
      const q = tailPath.cut;
      ctx.fillStyle = C.cream;
      ctx.beginPath(); ctx.arc(q.x + Math.cos(q.a) * 40, q.y - Math.sin(q.a) * 40, 42, 0, TAU); ctx.fill();
      // a darker underside stroke along the tail
      ctx.restore();
    }
    function torsoShade() {
      ctx.save(); torsoPath(ctx); ctx.clip();
      // belly shade (cel) and a back highlight
      ctx.fillStyle = C.furLo;
      const a = T(-50, 7), b = T(50, 9);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + 4, b.x, b.y); ctx.lineTo(b.x, b.y + 40); ctx.lineTo(a.x, a.y + 40); ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.furHi;
      const h0 = T(-36, -15), h1 = T(-8, -16.5), h2 = T(22, -15), h3 = T(-8, -11);
      ctx.beginPath(); ctx.moveTo(h0.x, h0.y); ctx.quadraticCurveTo(h1.x, h1.y - 2, h2.x, h2.y); ctx.quadraticCurveTo(h3.x, h3.y, h0.x, h0.y); ctx.fill();
      // cream chest and belly
      ctx.fillStyle = C.cream;
      const c0 = T(30, -9), c1 = T(50, 2), c2 = T(34, 15), c3 = T(8, 17), c4 = T(20, 6);
      ctx.beginPath(); ctx.moveTo(c0.x, c0.y); ctx.quadraticCurveTo(c1.x, c1.y, c2.x, c2.y); ctx.quadraticCurveTo(c3.x, c3.y + 2, c3.x, c3.y); ctx.quadraticCurveTo(c4.x, c4.y, c0.x, c0.y); ctx.fill();
      ctx.restore();
      // haunch line
      ctx.strokeStyle = C.line; ctx.lineWidth = ow * 0.7;
      const k0 = T(-14, -8), k1 = T(-12, 8), k2 = T(-26, 13);
      ctx.beginPath(); ctx.moveTo(k0.x, k0.y); ctx.quadraticCurveTo(k1.x, k1.y, k2.x, k2.y); ctx.stroke();
      // cream bib: throat into the chest (under the head, which is filled next)
      ctx.save(); neck(ctx); ctx.clip();
      ctx.fillStyle = C.cream;
      const r = [H(-4, 8), H(8, 10), T(46, 3), T(36, 4), T(26, -6)];
      ctx.beginPath(); r.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    function headDetails() {
      // muzzle and cheek cream
      ctx.fillStyle = C.cream;
      const m = [H(2, 1.5), H(14, 2.4), H(26, 2.2), H(31.5, 2.4), H(25, 5), H(14, 7), H(4, 8.5), H(-4, 9), H(-9, 4), H(-4, 0.5)];
      ctx.beginPath(); m.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); ctx.fill();
      if (p.jaw > 0.05) { // open mouth: dark inside, teeth, tongue
        const mp = [H(3, 6), H(28, 3.6), J(27, 4.5), J(2, 7)];
        ctx.fillStyle = C.mouth;
        ctx.beginPath(); mp.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); ctx.fill();
        ctx.fillStyle = C.white;
        for (const tx of [21, 13]) { const a = H(tx - 1.6, 5.4), b = H(tx + 1.6, 5.4), c = H(tx, 8.4); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.fill(); }
        fillPath(jaw, 'fill', C.cream);
        ctx.strokeStyle = C.line; ctx.lineWidth = ow * 0.75; jaw(ctx); ctx.stroke();
      } else {
        // the smirk: the corner hooks up and one fang peeks out
        ctx.strokeStyle = C.line; ctx.lineWidth = ow * 0.6;
        const a = H(16, 6.2), b = H(27, 4), c = H(6, 3.6), f0 = H(19.5, 5.4), f1 = H(22, 5.2), f2 = H(20.6, 8.6);
        ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.quadraticCurveTo(a.x, a.y + 1.5, b.x, b.y); ctx.stroke();
        ctx.fillStyle = C.white; ctx.lineWidth = ow * 0.4; ctx.beginPath(); ctx.moveTo(f0.x, f0.y); ctx.lineTo(f1.x, f1.y); ctx.lineTo(f2.x, f2.y); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      if (p.tongue > 0.05) { // lolling tongue
        const a = J(14, 8), b = J(20, 8), tip = J(16 + 3 * Math.sin(t * 3), 8 + 12 * p.tongue);
        ctx.fillStyle = C.tongue; ctx.strokeStyle = C.line; ctx.lineWidth = ow * 0.55;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(tip.x - 5, tip.y, tip.x, tip.y + 2); ctx.quadraticCurveTo(tip.x + 5, tip.y, b.x, b.y); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      // nose
      const nq = H(31, 0.8);
      ctx.fillStyle = frozen ? C.nose : PAL.nose;
      ctx.beginPath(); ctx.ellipse(nq.x, nq.y, 3.3 * HS, 2.7 * HS, hr, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(nq.x - 1.4, nq.y - 1.8, 1.5, 0, TAU); ctx.fill();
      drawEye();
    }
    function drawEye() {
      const e = H(6, -3), em = o.eye || 'normal';
      ctx.save();
      ctx.translate(e.x, e.y); ctx.rotate(hr); ctx.scale(HS, HS);
      ctx.lineWidth = ow * 0.7; ctx.strokeStyle = C.line;
      const bro = p.brow;
      if (em === 'spiral') {
        ctx.strokeStyle = C.line; ctx.lineWidth = ow * 0.55; ctx.beginPath();
        for (let i = 0; i <= 24; i++) { const a = i * 0.55 + t * 8, r = 0.3 * i; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(0, 0); }
        ctx.stroke();
      } else if (em === 'squeeze' || em === 'happy') { // >  or ^
        ctx.beginPath();
        if (em === 'squeeze') { ctx.moveTo(-5, -3.5); ctx.lineTo(3, 0); ctx.lineTo(-5, 3.2); } else { ctx.moveTo(-5, 1.5); ctx.quadraticCurveTo(0, -5, 5, 1.5); }
        ctx.stroke();
      } else {
        const wide = em === 'wide', lock = em === 'lock';
        const W = wide ? 6.6 : 6, Hh = wide ? 5.8 : 4.6;
        const almond = () => { ctx.beginPath(); ctx.moveTo(-W, 0.5); ctx.quadraticCurveTo(-1, -Hh * 1.3, W, -0.8); ctx.quadraticCurveTo(1, Hh * 1.15, -W, 0.5); ctx.closePath(); };
        almond(); ctx.fillStyle = C.eyeW; ctx.fill();
        ctx.save(); almond(); ctx.clip();
        const lx = clamp(p.look, -1, 1) * 2 + (lock ? 1.4 : 0);
        ctx.fillStyle = C.iris; ctx.beginPath(); ctx.arc(lx, 0, wide ? 3.4 : 3.8, 0, TAU); ctx.fill();
        ctx.fillStyle = C.pupil; ctx.beginPath(); ctx.ellipse(lx, 0, lock ? 0.7 : wide ? 1.3 : 1.0, 3.2, 0, 0, TAU); ctx.fill(); // slit pupil
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(lx + 1.1, -1.3, 0.9, 0, TAU); ctx.fill();
        // upper lid (fur) down to `lid`, slanted for the sly look
        const lid = wide ? 0 : p.lid;
        if (lid > 0.02) { ctx.fillStyle = C.fur; ctx.beginPath(); ctx.moveTo(-W - 1, -Hh * 1.4); ctx.lineTo(W + 1, -Hh * 1.4); ctx.lineTo(W + 1, -Hh * 1.3 + lid * Hh * 2.0 - 1.2); ctx.lineTo(-W - 1, -Hh * 1.3 + lid * Hh * 2.3 + 0.8 * bro); ctx.closePath(); ctx.fill(); }
        ctx.restore();
        almond(); ctx.stroke();
        ctx.lineWidth = ow * 0.8; ctx.beginPath(); ctx.moveTo(W - 1.5, -1); ctx.lineTo(W + 3.5, -3.4); ctx.stroke(); // liner flick
        if (lid > 0.02) { ctx.lineWidth = ow * 0.85; ctx.beginPath(); ctx.moveTo(-W, -Hh * 1.3 + lid * Hh * 2.3 + 0.8 * bro); ctx.lineTo(W, -Hh * 1.3 + lid * Hh * 2.0 - 1.2); ctx.stroke(); }
      }
      // brow: fierce slopes down to the snout, sad lifts
      ctx.strokeStyle = C.dark; ctx.lineWidth = ow * 0.95;
      ctx.beginPath(); ctx.moveTo(-6, -7.5 - bro * 0.5 - (bro < 0 ? 2 : 0)); ctx.lineTo(6.5, -7 + bro * 2.6 - (bro < 0 ? -2 * bro : 0)); ctx.stroke();
      if (o.tears > 0) { // tears streaming down the cheek
        ctx.fillStyle = '#7fd0ff'; ctx.strokeStyle = '#2f6f9e'; ctx.lineWidth = ow * 0.4;
        for (let i = 0; i < 2; i++) { const f = fract(t * 1.4 + i * 0.5), ty = 3 + f * 14; ctx.globalAlpha = 1 - f * 0.6; ctx.beginPath(); ctx.ellipse(-2 + i * 2, ty, 1.8, 2.6, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
    // sweat drops over the head (trapped)
    if (o.sweat > 0) {
      ctx.fillStyle = '#9fe0ff'; ctx.strokeStyle = '#2f6f9e'; ctx.lineWidth = ow * 0.45;
      for (let i = 0; i < 2; i++) { const f = fract(t * 2.2 + i * 0.5), q = H(-14 - i * 6 - f * 6, -20 + f * 4); ctx.globalAlpha = o.sweat * (1 - f); ctx.beginPath(); ctx.moveTo(q.x, q.y - 4); ctx.quadraticCurveTo(q.x + 3, q.y, q.x, q.y + 2.4); ctx.quadraticCurveTo(q.x - 3, q.y, q.x, q.y - 4); ctx.fill(); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    if (stars) drawStars(ctx, stars, headTop, ow, true, sk);
    // frozen: facet glints, frost crystals on the rim, hairline cracks in the last second
    if (frozen) iceDetails(ctx, T, H, ow, t, o);
    if (o.zap > 0) zapArcs(ctx, T, H, ow, t, o.zap);
    if (o.out) { const m = H(26, 6.5); o.out.mouth = { x: x + m.x * u * (o.face < 0 ? -1 : 1), y: y + m.y * u }; const hd = H(0, -6); o.out.head = { x: x + hd.x * u * (o.face < 0 ? -1 : 1), y: y + hd.y * u }; }
  } catch (e) { /* art never breaks the frame */ }
  ctx.restore();
}

// three stars (or birds) circling on a tilted ellipse over the head; front = the half that passes in front
function starPts(t, n) {
  const out = [];
  for (let i = 0; i < Math.round(n); i++) { const a = t * 3.2 + (i * TAU) / Math.round(n); out.push({ x: Math.cos(a) * 17, y: Math.sin(a) * 5 + Math.cos(a) * 3, front: Math.sin(a) > 0, sc: 0.8 + 0.25 * Math.sin(a) }); }
  return out;
}
function drawStars(ctx, pts, top, ow, front, k = 1) {
  for (const q of pts) {
    if (q.front !== front) continue;
    const x = top.x + q.x * k, y = top.y - 6 * k + q.y * k, r = 5.2 * q.sc * k;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath();
    ctx.fillStyle = front ? '#ffe14a' : '#d9b630'; ctx.strokeStyle = '#6a4200'; ctx.lineWidth = ow * 0.55;
    ctx.fill(); ctx.stroke();
  }
}
function iceDetails(ctx, T, H, ow, t, o) {
  ctx.save();
  // glints: crisp white facets on the shell
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  for (const [q, r] of [[T(-12, -24), 4.5], [H(-6, -18), 3.5], [T(30, -26), 3]]) {
    ctx.beginPath(); ctx.moveTo(q.x, q.y - r); ctx.lineTo(q.x + r * 0.3, q.y - r * 0.3); ctx.lineTo(q.x + r, q.y); ctx.lineTo(q.x + r * 0.3, q.y + r * 0.3); ctx.lineTo(q.x, q.y + r); ctx.lineTo(q.x - r * 0.3, q.y + r * 0.3); ctx.lineTo(q.x - r, q.y); ctx.lineTo(q.x - r * 0.3, q.y - r * 0.3); ctx.closePath(); ctx.fill();
  }
  // a cold sheen across the shell
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = ow * 0.9;
  const a = T(-36, -21), b = T(-20, -25);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  // frost crystals on the outline
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = ow * 0.5;
  for (const q of [T(-46, -14), T(10, -26), H(14, -16), T(40, 22), T(-40, 18)]) {
    for (let i = 0; i < 3; i++) { const an = (i * Math.PI) / 3; ctx.beginPath(); ctx.moveTo(q.x - Math.cos(an) * 3.6, q.y - Math.sin(an) * 3.6); ctx.lineTo(q.x + Math.cos(an) * 3.6, q.y + Math.sin(an) * 3.6); ctx.stroke(); }
  }
  // cracks spreading over the last second
  if (o.frozen < 1) {
    const k = 1 - o.frozen;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = ow * 0.45;
    const starts = [T(-6, -20), T(24, 4), H(4, -8), T(-34, 4)];
    starts.forEach((q, j) => {
      ctx.beginPath(); ctx.moveTo(q.x, q.y);
      let x = q.x, y = q.y;
      for (let i = 0; i < 4 * k; i++) { x += (hash(j * 9 + i) - 0.5) * 16; y += (hash(j * 7 + i + 3) - 0.3) * 12; ctx.lineTo(x, y); }
      ctx.stroke();
    });
  }
  ctx.restore();
}
function zapArcs(ctx, T, H, ow, t, k) {
  ctx.save();
  const seed = Math.floor(t * 30);
  for (const [c, w] of [['rgba(255,240,120,0.9)', 2.2], ['#ffffff', 1]]) {
    ctx.strokeStyle = c; ctx.lineWidth = ow * w;
    for (let j = 0; j < 3; j++) {
      const pts = [T(-44, -6 + j * 6), T(-20, -18 + j * 10), T(6, -14 + j * 8), T(30, -12 + j * 10), H(10, -10 + j * 6)];
      ctx.beginPath();
      pts.forEach((q, i) => { const jx = (hash(seed + i * 3 + j * 11) - 0.5) * 12, jy = (hash(seed + i * 5 + j * 7) - 0.5) * 12; i ? ctx.lineTo(q.x + jx, q.y + jy) : ctx.moveTo(q.x + jx, q.y + jy); });
      ctx.globalAlpha = k;
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ------------------------------------------------------------------ in the level (world space: metres, y up)
// drawFoxDen: the den on the outer ring, the pounce telegraph, the fox (under the eggs). drawFoxDenOver: its head over
// an egg held in its jaws, the trap ring. denEvent: popups and sounds.
const pxAt = (ctx, x, y, k, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(1 / k, -1 / k); try { f(); } catch (e) { /* never break the frame */ } ctx.restore(); };
const DM = { pose: null, frozenWas: 0, thawT: -9, thawA: 0, thawR: 0 };

function denLook(sim, F, t) {
  const u = F.dur > 0 ? clamp(1 - F.t / F.dur, 0, 1) : 0, o = {};
  let st = 'idle', uu = u;
  switch (F.ph) {
    case 'prowl': st = 'prowl'; break;
    case 'stalk': st = 'stalk'; break;
    case 'carry': st = 'carry'; break;
    case 'inner': st = 'stalk'; o.eye = 'wide'; o.sweat = 0.5; break;
    case 'toss': st = 'toss'; break;
    case 'crouch': st = 'crouch'; o.eye = 'lock'; break;
    case 'leap': st = F.blocked ? 'hurt' : 'leap'; uu = F.blocked ? 0.5 : F.lu; o.eye = F.blocked ? 'squeeze' : 'lock'; break;
    case 'grab': case 'stash': st = 'grab'; break;
    case 'trapped': st = 'trapped'; o.eye = 'wide'; o.sweat = 1; break;
    case 'hurt': st = 'hurt'; o.eye = 'squeeze'; break;
    case 'stunned': st = 'stunned'; o.eye = 'spiral'; o.stars = 3; break;
    case 'bonk': st = 'bonk'; o.eye = 'squeeze'; o.stars = 2; break;
    case 'laugh': st = 'laugh'; o.eye = 'happy'; break;
    case 'defeated': case 'flee': st = 'defeated'; o.eye = 'squeeze'; o.tears = 1; break;
    default: st = 'idle';
  }
  if (F.zap > 0) o.zap = clamp(F.zap / 0.3, 0, 1);
  return { st, u: uu, o };
}

// the den: an arched burrow in the outer ring's inner face, straw on its floor (stashed eggs sit in it)
export function drawFoxDen(ctx, sim, t, k) {
  const F = sim.den;
  if (!F) return;
  const n = sim.rings.length, ring = sim.rings[n - 1], d = sim.denDenPt(), rf = ring.r - 0.08;
  const bx = rf * Math.cos(d.a), by = rf * Math.sin(d.a);
  pxAt(ctx, bx, by, k, () => {
    ctx.rotate(Math.atan2(-Math.cos(d.a), -Math.sin(d.a)));
    const w = 0.62 * k, h = 0.5 * k;
    ctx.beginPath(); ctx.moveTo(-w, 2); ctx.bezierCurveTo(-w, -h * 1.25, w, -h * 1.25, w, 2); ctx.closePath();
    const g = ctx.createLinearGradient(0, -h, 0, 0); g.addColorStop(0, '#1a0c06'); g.addColorStop(1, '#3a2010');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(1.2, 0.05 * k); ctx.strokeStyle = '#5a3418'; ctx.stroke();
    ctx.strokeStyle = '#d8b04a'; ctx.lineWidth = Math.max(1, 0.025 * k); ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) { const x = (-0.8 + (i / 6) * 1.6) * w * 0.8, a = (hash(i) - 0.5) * 1.2; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + Math.sin(a) * 0.18 * k, -Math.cos(a) * 0.12 * k); ctx.stroke(); }
    if (F.stash.length && !(sim.state !== 'play')) { // a red "!" pulse over a full den
      ctx.fillStyle = `rgba(255,80,60,${0.5 + 0.4 * Math.sin(t * 6)})`; ctx.beginPath(); ctx.arc(0, -h * 1.25, Math.max(3, 0.1 * k), 0, TAU); ctx.fill();
    }
  });
}

function denFrame(sim, F, k, f) {
  const x = F.r * Math.cos(F.a), y = F.r * Math.sin(F.a);
  pxAt(ctx0, x, y, k, () => { ctx0.rotate(Math.atan2(-Math.cos(F.a), -Math.sin(F.a))); f(); });
}
let ctx0 = null;

export function drawFoxDenFox(ctx, sim, t, k) {
  const F = sim.den;
  if (!F || F.ph === 'wait' || F.ph === 'gone') return;
  ctx0 = ctx;
  const n = sim.rings.length;
  // the pounce telegraph: a paw mark where it will land and a dashed arc from the fox (grey with a cross when the
  // gap has turned away: the pounce is blocked)
  if (F.ph === 'crouch') {
    const T = sim.denLanding(), u = clamp(1 - F.t / F.dur, 0, 1), b = sim.denBody();
    const ok = F.kind !== 'pounce' || sim.denAligned(n - 2, F.gi, F.a);
    const ring = sim.rings[n - 2], cr = ring.r - 0.7, cx = cr * Math.cos(F.a), cy = cr * Math.sin(F.a);
    ctx.save();
    ctx.setLineDash([0.12, 0.1]); ctx.lineWidth = Math.max(0.035, 1.6 / k); ctx.lineCap = 'round';
    ctx.strokeStyle = ok ? `rgba(255,70,50,${0.45 + 0.5 * u})` : 'rgba(90,90,90,0.7)';
    ctx.beginPath(); ctx.moveTo(b.x, b.y);
    if (F.kind === 'pounce') ctx.quadraticCurveTo(cx, cy, T.x, T.y); else ctx.lineTo(T.x, T.y);
    ctx.stroke(); ctx.setLineDash([]);
    if (!ok) { const r = ring.r, X = r * Math.cos(F.a), Y = r * Math.sin(F.a), s = 0.14; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(0.05, 2.4 / k); ctx.beginPath(); ctx.moveTo(X - s, Y - s); ctx.lineTo(X + s, Y + s); ctx.moveTo(X - s, Y + s); ctx.lineTo(X + s, Y - s); ctx.stroke(); }
    ctx.restore();
    pawMark(ctx, T, k, t, u, ok);
  }
  const L = denLook(sim, F, t), frozen = F.frozen > 0;
  let pose;
  if (frozen && DM.pose) pose = DM.pose; // held still in the ice
  else { pose = foxBlend('den', foxPose(L.st, t, L.u, F.odo), t, F.ph === 'leap' || F.ph === 'trapped' ? 22 : 9); DM.pose = { ...pose }; }
  if (DM.frozenWas > 0 && !frozen) { DM.thawT = t; } // thaw: shards pop off
  DM.frozenWas = F.frozen;
  const B = sim.bx && sim.bx.boss, s = FOXRIG.torso * k, o = { ...L.o, face: F.face, frozen: frozen ? F.frozen : 0, crown: !!B && B.kind === 'foxking' };
  if (frozen) { o.eye = o.eye === 'spiral' ? 'normal' : o.eye; o.stars = 0; o.sweat = 0; }
  const alpha = F.ph === 'flee' ? F.alpha : 1, pop = F.ph === 'in' ? 0.4 + 0.6 * easeBack(clamp(1 - F.t / F.dur, 0, 1)) : 1;
  denFrame(sim, F, k, () => {
    ctx.globalAlpha *= alpha;
    let pitch = 0;
    if (F.ph === 'leap') { const q0 = sim.denFlyAt(Math.max(0, F.lu - 0.02)), q1 = sim.denFlyAt(Math.min(1, F.lu + 0.02)); const fw = (q1.a - q0.a) * F.r * F.face, up = q0.r - q1.r; pitch = clamp(Math.atan2(up, Math.abs(fw) + 1e-4), -1.15, 1.15) * (fw < 0 ? -1 : 1) * 0.85; }
    const shake = t - DM.thawT < 0.5 ? Math.sin(t * 60) * 0.12 * (1 - (t - DM.thawT) / 0.5) : 0;
    ctx.translate(0, -0.3 * k); ctx.rotate(-pitch * F.face + shake); ctx.scale(pop, pop); ctx.translate(0, 0.3 * k);
    drawDenFox(ctx, 0, 0, s, t, pose, o);
    if (t - DM.thawT < 0.6) thawShards(ctx, k, (t - DM.thawT) / 0.6);
  });
}
function easeBack(x) { return 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2); }
function thawShards(ctx, k, f) {
  ctx.save();
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (hash(i * 3) - 0.5) * 2.6, v = (0.5 + hash(i) * 0.6) * k, x = Math.cos(a) * v * f * 0.8, y = -0.35 * k + Math.sin(a) * v * f * 0.8 + 1.6 * k * f * f, r = (0.05 + 0.04 * hash(i + 5)) * k;
    ctx.globalAlpha = 1 - f; ctx.fillStyle = 'rgba(214,240,255,0.95)'; ctx.strokeStyle = RIM; ctx.lineWidth = Math.max(1, 0.015 * k);
    ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.8, y + r * 0.2); ctx.lineTo(x - r * 0.3, y + r); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}
// a red paw print on the floor where it will land
function pawMark(ctx, T, k, t, u, ok) {
  pxAt(ctx, T.x, T.y, k, () => {
    ctx.rotate(Math.atan2(-Math.cos(T.a), -Math.sin(T.a)));
    const s = Math.max(0.2 * k, 6) * (1 + 0.08 * Math.sin(t * 14)), col = ok ? `rgba(230,40,30,${0.4 + 0.5 * u})` : 'rgba(80,80,80,0.55)';
    ctx.translate(0, -s * 0.55);
    ctx.fillStyle = col; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(1, s * 0.09);
    ctx.beginPath(); ctx.ellipse(0, s * 0.18, s * 0.42, s * 0.34, 0, 0, TAU); ctx.fill(); ctx.stroke();
    for (const [x, y] of [[-0.42, -0.28], [-0.15, -0.5], [0.15, -0.5], [0.42, -0.28]]) { ctx.beginPath(); ctx.ellipse(x * s, y * s, s * 0.14, s * 0.18, x * 0.6, 0, TAU); ctx.fill(); ctx.stroke(); }
  });
}

export function drawFoxDenOver(ctx, sim, t, k) {
  const F = sim.den;
  if (!F || F.ph === 'wait' || F.ph === 'gone') return;
  ctx0 = ctx;
  // trapped: a pulsing gold ring says "now hit it"
  if (F.ph === 'trapped') {
    const b = sim.denBody(), u = 0.5 + 0.5 * Math.sin(t * 8);
    ctx.save(); ctx.setLineDash([0.16, 0.1]); ctx.lineDashOffset = -t * 0.6;
    ctx.strokeStyle = `rgba(255,214,60,${0.55 + 0.4 * u})`; ctx.lineWidth = Math.max(0.05, 2.4 / k);
    ctx.beginPath(); ctx.arc(b.x, b.y, 0.62 + 0.05 * u, 0, TAU); ctx.stroke(); ctx.restore();
  }
  if (!F.eid || !DM.pose) return;
  const L = denLook(sim, F, t);
  denFrame(sim, F, k, () => {
    let pitch = 0;
    if (F.ph === 'leap') { const q0 = sim.denFlyAt(Math.max(0, F.lu - 0.02)), q1 = sim.denFlyAt(Math.min(1, F.lu + 0.02)); const fw = (q1.a - q0.a) * F.r * F.face, up = q0.r - q1.r; pitch = clamp(Math.atan2(up, Math.abs(fw) + 1e-4), -1.15, 1.15) * (fw < 0 ? -1 : 1) * 0.85; }
    ctx.translate(0, -0.3 * k); ctx.rotate(-pitch * F.face); ctx.translate(0, 0.3 * k);
    drawDenFox(ctx, 0, 0, FOXRIG.torso * k, t, DM.pose, { ...L.o, face: F.face, only: 'head', frozen: F.frozen > 0 ? F.frozen : 0, stars: 0, sweat: 0, crown: !!(sim.bx && sim.bx.boss && sim.bx.boss.kind === 'foxking') });
  });
}

// events -> popups, sounds, one-time tips
export function denEvent(ev, fx, U) {
  const { popup, audio, once } = U;
  switch (ev.type) {
    case 'denIn': audio.play('grab', { vol: 0.5, pitch: 0.7 }); once('denIn', 'The fox is IN the vault! He pounces through gaps to steal eggs. Turn the gap away and he is trapped.', 4); break;
    case 'denWarn': audio.play('squish', { vol: 0.4, pitch: 0.8 }); break;
    case 'denPounce': audio.play('wind_gust', { vol: 0.45, pitch: 1.5 }); break;
    case 'denBonk': audio.play('rock_hit', { vol: 0.7 }); fx.sparkle(ev.x, ev.y, 6, '#ffe08a'); popup(ev.x, ev.y + 0.6, 'Blocked!', { color: '#bff0a0', size: 18, life: 0.9 }); break;
    case 'denGrab': audio.play('grab', { vol: 0.8 }); popup(ev.x, ev.y + 0.6, 'Snatched!', { color: '#ff9a6a', size: 18, life: 0.9 }); break;
    case 'denTrapped': audio.play('glass_crack', { vol: 0.5, pitch: 1.4 }); fx.sparkle(ev.x, ev.y, 10, '#ffd63c'); popup(ev.x, ev.y + 0.8, 'TRAPPED!', { color: '#ffd63c', size: 20, life: 1.2 }); once('denTrapped', 'Trapped! Now hit him: drop an egg on him, burn him with a flaming egg, or save an egg.', 4); break;
    case 'denHit': audio.play('thorn_snap', { vol: 0.8 }); fx.sparkle(ev.x, ev.y, 14, '#ffffff'); fx.shake = Math.max(fx.shake || 0, 0.3); popup(ev.x, ev.y + 0.9, ev.hp > 0 ? `OUCH! ${ev.hp} left` : 'DEFEATED!', { color: '#ff6a4a', size: 22, life: 1.2 }); break;
    case 'denStash': audio.play('level_fail', { vol: 0.25, pitch: 1.6 }); popup(ev.x, ev.y + 0.7, 'Stashed!', { color: '#ff7a5a', size: 18, life: 1 }); once('denStash', 'He stashed an egg in his den. Hit him while he is trapped to win it back.', 4); break;
    case 'denDrop': if (ev.why === 'tired') popup(ev.x, ev.y + 0.6, 'Dropped it!', { color: '#bff0a0', size: 16, life: 0.8 }); break;
    case 'denFreeze': audio.play('glass_crack', { vol: 0.5 }); break;
    default: break;
  }
}
