// The weasel (0.8.18): his own art on the thieves' four-legged rig, in the raccoon's hand (render/raccoon.js): one dark
// ink line, flat two-tone fur lit from the top-left (a lit coat inside a darker one, a pale back highlight), a cream belly,
// throat and muzzle with their own shade, a big glossy eye with lids and a brow that act, whiskers, ears with pink
// insides, limbs that are ONE tapered shape bent at the joint, paws with toes (and fingers when a forepaw is off the floor),
// a brush of a tail with a dark tip. No gradients, no clips: every part is a stroke and a fill or two.
//   drawWeasel(ctx, x, y, s, t, pose, o, K)   the same call as drawThief (render/thieves.js sends its weasels here);
//                                             K: { ice, zap } the thieves' shared frozen / zap overlays
//   weaselAct(p, state, t, u, ph, B, F)       his acting on top of the rig's pose (thiefPose calls it for a weasel)
//   weaselCalm(on)                            Calm mode: no jitter, no fast shakes (gentle versions of the same poses)
// PERF.low: the same poses with fewer points and without the small lights (back highlight, toe lines, whisker dots).
import { spline, blinkAt, clamp, lerp, ss, back, hash } from './castkit.js';
import { dizzyStars, spiralEye } from './status.js';
import { PERF } from '../perf.js';

const TAU = Math.PI * 2;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixHex = (a, b, k) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
const fract = (x) => x - Math.floor(x);
const PAL = {
  line: '#24141a', fur: '#b8642c', furLo: '#8a431c', furHi: '#e09450', cream: '#f8ead0', creamLo: '#dcc29a', paw: '#55301c', pawHi: '#7a4a2c', dark: '#43200e',
  nose: '#1a1118', earIn: '#e59a9a', eyeW: '#fffdf4', iris: '#8a4a12', irisHi: '#e09a2a', pupil: '#150a06', lid: '#9a4c20', mouth: '#5a1420', tongue: '#f0707c', tooth: '#ffffff', sweat: '#8fd4ff',
};
const ICED = {};
for (const c in PAL) ICED[c] = mixHex(PAL[c], '#bfe6ff', 0.55);
const RIM = '#2f6f9e', SHELL = 'rgb(214,240,255)';
let CALM = false;
export function weaselCalm(on) { CALM = !!on; }

// ------------------------------------------------------------------ acting
// eyes that dart: they hold, then jump to a new spot (a saccade), never drift
function dart(t, rate = 1.6, seed = 0) { const k = Math.floor(t * rate), f = fract(t * rate), a = hash(k + seed) * 2 - 1, b = hash(k + 1 + seed) * 2 - 1; return lerp(a, b, ss(0.82, 1, f)); }
// p: the rig's pose for this state (thieves.js thiefPose). Adds the face (looky, lidLo, pup, smile, ta, grip, hsc) and
// reworks the body where the weasel has more to say. u as thiefPose; ph: the gait phase in cycles; B: rest height; F: feet
export function weaselAct(p, state, t, u, ph, B, F) {
  const j = CALM ? 0 : 1, g2 = Math.sin(ph * TAU * 2), lag = Math.sin(ph * TAU * 2 - 1.2);
  switch (state) {
    case 'prowl': // slinking in: sly lids, eyes darting about, the tail and ears a beat behind the bounding back
      p.look = dart(t, 1.7); p.looky = 0.25 * dart(t, 1.7, 9); p.lid = 0.36; p.lidLo = 0.12; p.brow = 0.7; p.smile = 0.7;
      p.tail = 0.22 + 0.16 * lag; p.tc = 0.35 - 0.3 * lag; p.tw = Math.sin(ph * TAU - 1.3) * 0.45; p.ear = -0.1 + 0.22 * Math.max(0, -lag); p.hy += 0.8 * lag; p.hr += 0.03 * lag;
      break;
    case 'stalk': // on tiptoe, low, eyes fixed, the tail tip flicking
      p.look = 1; p.looky = 0.1; p.pup = 1.2; p.lid = 0.3; p.lidLo = 0.25; p.smile = 0.9; p.tw = Math.sin(t * 9) * 0.25 * ss(0.6, 1, Math.sin(t * 2.3)); p.tc = 0.1 + 0.25 * Math.max(0, Math.sin(t * 2.3));
      break;
    case 'carry': // away with it: head high, a smug sideways look back, lids low, the tail up and curled, a prance
      p.by += 1.2 * Math.abs(g2); p.hy -= 3; p.hr -= 0.08; p.look = -0.75 + 0.12 * Math.sin(t * 2); p.looky = -0.15; p.lid = 0.46; p.lidLo = 0.3; p.brow = 0.35; p.smile = 1; p.pup = 0.95;
      p.tail = 0.95 + 0.12 * lag; p.tc = 1.1; p.tw = Math.sin(ph * TAU - 1) * 0.5; p.ear = -0.25 + 0.15 * Math.max(0, lag);
      for (const i of [0, 1, 2, 3]) p[`f${i}y`] *= 1.5;
      break;
    case 'scared': // bolting: flat out, eyes like saucers, tongue streaming, fur on end
      p.st = 1.1 + 0.05 * g2; p.look = -1; p.looky = -0.2; p.lid = 0; p.pup = 0.5; p.brow = -1; p.jaw = 0.75 + 0.15 * Math.sin(t * 24) * j; p.smile = -1; p.ear = 1; p.puff = 0.9; p.tail = 0.6 + 0.2 * lag; p.tc = -0.2; p.hsc = 1.04;
      break;
    case 'spin': { // the wind-up before he bolts: he jumps, hangs, his legs spin on the spot (u 0..1), then he is gone
      const up = Math.sin(clamp(u / 0.35, 0, 1) * Math.PI * 0.5), go = ss(0.6, 1, u), w = t * 38;
      p.by = B * (1.05 + 0.25 * up * (1 - go)); p.dx = -7 * up * (1 - go) + 6 * go; p.pitch = 0.2 * up * (1 - go) - 0.12 * go; p.st = 1 - 0.06 * up + 0.14 * go; p.hx = -3 * up; p.hy = -4 * up; p.hr = -0.3 * up * (1 - go);
      p.look = -1; p.lid = 0; p.pup = 0.45; p.brow = -1; p.jaw = 0.8; p.smile = -1; p.ear = 1 - 1.5 * up * (1 - go); p.puff = 1; p.tail = 1.2 - 0.6 * go; p.tc = 0.2; p.tw = Math.sin(t * 30) * 0.3 * j; p.hsc = 1.08;
      [F[0], F[1], F[2], F[3]].forEach((x0, i) => { const a = w + i * 1.6; p[`f${i}x`] = x0 + Math.cos(a) * 11; p[`f${i}y`] = -3 - Math.max(0, Math.sin(a)) * 9 - (B * 0.25 * up * (1 - go)); });
      break;
    }
    case 'crouch': { // he SPOTS it (stops dead, eyes pop, ears up), licks his lips right round, then sinks, wiggles and winds up
      const pop = ss(0, 0.06, u) * (1 - ss(0.14, 0.24, u)), k = ss(0.2, 0.52, u), lick = ss(0, 0.12, k) * (1 - ss(0.85, 1, k)), e = ss(0.42, 0.7, u), wind = ss(0.86, 1, u);
      const w = Math.sin(t * (13 + 12 * u)) * e * (CALM ? 0.35 : 1);
      p.by = lerp(B * (1 + 0.05 * pop), B * 0.6, e) - B * 0.07 * wind; p.dx = w * 2.2 - 3 * wind; p.pitch = lerp(0.05 * pop, -0.15, e) + w * 0.035 - 0.03 * wind; p.sq = 0.12 * wind; p.st = 1 - 0.05 * wind;
      p.hx = lerp(-2 * pop, 7, e); p.hy = lerp(-5 * pop, 4, e) - 1.5 * lick; p.hr = lerp(-0.12 * pop, -0.17, e) + 0.05 * Math.sin(k * TAU) * lick; p.hsc = 1 + 0.1 * pop;
      p.look = 1; p.looky = 0.1; p.lid = lerp(0, 0.34, ss(0.2, 0.4, u)) * (1 - pop); p.lidLo = 0.25 * lick + 0.3 * e; p.pup = lerp(1.15, 0.5, pop) + 0.12 * e; p.brow = lerp(1, -0.8, pop);
      p.tongue = lick * 1.25; p.ta = lerp(0.9, -1.5, k); p.smile = 1 - 0.6 * pop; p.jaw = 0.3 * pop + 0.1 * lick;
      p.ear = lerp(-0.7 * pop, -0.2 + 0.9 * wind, e); p.tail = lerp(0.2 + 0.9 * pop, 0.12, ss(0.16, 0.5, u)) + 0.5 * wind; p.tc = 0.2 + 0.5 * pop - 0.3 * wind; p.tw = Math.sin(t * 13) * 0.5 * e * (CALM ? 0.4 : 1); p.puff = 0.5 * pop;
      p.f0x = F[0] + 8 * e; p.f1x = F[1] + 8 * e; p.f2x = F[2] - 4 * e; p.f3x = F[3] - 4 * e;
      break;
    }
    case 'leap': { // off the mark: a long stretch, ears and tail streaming, claws out; he folds at the top and reaches to land
      const off = 1 - ss(0, 0.3, u), land = ss(0.7, 1, u);
      p.st += 0.1 * off; p.sq = -0.05 * off + 0.06 * land; p.ear = 0.9; p.tail = -0.15 - 0.25 * off; p.tc = -0.15; p.tw = 0.2 * Math.sin(t * 11); p.look = 1; p.looky = lerp(-0.4, 0.5, land); p.lid = 0; p.pup = 1.2; p.brow = 1; p.smile = 0.6; p.grip = 0; p.tongue = 0.4 * (1 - land); p.ta = 2.2;
      break;
    }
    case 'grab': { // lands in a squash, the jaws snap, then a pleased wriggle with the tail flicking up
      const lnd = 1 - ss(0, 0.3, u), got = ss(0.45, 0.8, u), fl = back(ss(0.4, 0.7, u), 2.6);
      p.sq = 0.16 * lnd; p.by -= B * 0.08 * lnd; p.look = 1; p.looky = 0.6 * (1 - got); p.lid = 0.12 + 0.3 * got; p.lidLo = 0.5 * got; p.pup = 1.15; p.brow = lerp(1, 0.3, got); p.smile = 1; p.tail = 0.3 + 0.7 * fl; p.tc = 0.3 + 0.8 * fl; p.tw = Math.sin(t * 14) * 0.5 * got; p.ear = 0.5 * lnd - 0.3 * got; p.grip = 1;
      break;
    }
    case 'toss': p.smile = 0.8; p.lidLo = 0.3; p.look = 0.8; p.looky = -0.4 * ss(0.6, 1, u); p.grip = lerp(1, 0, ss(0.75, 0.9, u)); p.tc = 0.6; break;
    case 'huh': { // the way out is shut: he stops, looks back at it, looks up, the tail curls into a question mark (u 0..1)
      const a = back(ss(0, 0.25, u)), b2 = ss(0.45, 0.62, u), tilt = Math.sin(ss(0.5, 1, u) * Math.PI);
      p.by = B * (1 + 0.06 * a); p.pitch = 0.08 * a; p.dx = -2 * a; p.hx = -3 * a; p.hy = -4 * a; p.hr = lerp(-0.25 * a, -0.5, b2) + 0.14 * tilt; p.hsc = 1.05;
      p.look = lerp(-1, 0.3, b2); p.looky = lerp(0, -1, b2); p.lid = 0; p.pup = 0.72; p.brow = -0.9; p.jaw = 0.16; p.smile = -0.5; p.ear = lerp(-0.6, -0.2, b2) + 0.5 * tilt; p.tail = 1.0; p.tc = 1.7; p.tw = 0.2 * Math.sin(t * 5);
      p.f0x = F[0] - 2; p.f1x = F[1] + 3;
      break;
    }
    case 'trapped': p.look = dart(t, 5, 3); p.looky = 0.5 * dart(t, 5, 7); p.pup = 0.5; p.lid = 0; p.smile = -1; p.tongue = 0; p.hsc = 1.04; if (CALM) { p.dx = 0; } break;
    case 'hurt': { const k = Math.sin(clamp(u, 0, 1) * Math.PI); p.smile = -1; p.pup = 0.6; p.hsc = 1 + 0.08 * k; p.st = 1 - 0.06 * k; p.grip = 0; p.f2x = F[2] - 8 * k; p.f3x = F[3] - 8 * k; p.f0y = -B * 0.5 * k; p.f1y = -B * 0.35 * k; break; }
    case 'stunned': { // legs gone to jelly: a slow figure of eight with the head a beat behind, tongue lolling, ears drooping in turn
      const w = Math.sin(t * 2.3), w2 = Math.sin(t * 2.3 - 0.8), c2 = Math.cos(t * 2.3 - 0.8);
      p.by = B * 0.74 + 1.4 * Math.sin(t * 4.6); p.dx = 3.5 * w; p.pitch = -0.08 + 0.07 * w; p.hx = 3 + 4 * w2; p.hy = 7 + 3 * c2; p.hr = 0.4 + 0.22 * w2; p.jaw = 0.45; p.tongue = 1; p.ta = 1.5 + 0.35 * w2; p.smile = -0.4; p.brow = -0.8;
      p.ear = 0.7 + 0.3 * w2; p.tail = -0.25 + 0.2 * w2; p.tc = -0.3; p.tw = 0.3 * c2; p.f0x = F[0] + 9 + 2 * w; p.f1x = F[1] + 2 - 2 * w; p.f2x = F[2] - 7 + 2 * w; p.f3x = F[3] + 3 - 2 * w;
      break;
    }
    case 'bonk': { // flat on the floor, legs out like a rug (u 0 .. 0.4); then he sits up, looks up at the ring, a paw scratching his chin: "Huh?"
      const flat = 1 - ss(0.3, 0.48, u), up = back(ss(0.36, 0.6, u), 2.2) * (1 - ss(0.88, 1, u)), sc = ss(0.55, 0.65, u) * (1 - ss(0.86, 0.94, u)), rub = Math.sin(t * 15) * sc * (CALM ? 0.4 : 1);
      p.by = lerp(B * 0.92, B * 0.46, flat) + 2 * up; p.sq = 0.26 * flat; p.pitch = -0.05 * flat + 0.2 * up; p.dx = -3 * up; p.hx = 3 - 3 * up; p.hy = 5 * flat - 2 * up; p.hr = 0.3 * flat - 0.3 * up + 0.12 * Math.sin(t * 2.6) * up; p.hsc = 1 + 0.05 * up;
      p.look = lerp(0.2, 0.35, up); p.looky = -0.95 * up; p.lid = 0.7 * flat; p.pup = lerp(1, 0.7, up); p.brow = lerp(-0.5, -1, up); p.jaw = 0.2 * flat + 0.12 * up; p.smile = -0.6; p.ear = flat * 0.9 - 0.5 * up + 0.5 * sc * Math.max(0, Math.sin(t * 7.5)); p.tail = 0.1 + 0.9 * up; p.tc = 0.1 + 1.7 * up; p.tw = 0.3 * Math.sin(t * 4) * up; p.puff = 0.5 * flat; p.tongue = 0.8 * flat * (1 - ss(0.2, 0.3, u)); p.ta = 1.3;
      const k = up * ss(0.5, 0.62, u);
      p.f0x = lerp(F[0] + 16 * flat, F[0] + 25 + 1.2 * rub, k); p.f0y = lerp(0, -B * 0.95 - 2.5 * Math.abs(rub), k); p.f1x = F[1] + 14 * flat - 2 * up; p.f1y = 0; p.f2x = F[2] - 12 * flat + 5 * up; p.f3x = F[3] - 12 * flat + 6 * up; p.grip = 0.1;
      break;
    }
    case 'laugh': { // on his haunches, head back, pointing, the belly shaking
      const h = Math.abs(Math.sin(t * 9)); p.smile = 1; p.sq = 0.04 * Math.sin(t * 9); p.tw = Math.sin(t * 9) * 0.6; p.tc = 1.1; p.grip = 0.2; p.f0x += 10 + 2 * h; p.f0y -= 3 * h; p.tongue = 0.25; p.ta = 1.2;
      break;
    }
    case 'defeated': p.look = -0.8; p.looky = 0.5; p.smile = -1; p.pup = 0.9; p.lid = 0.55; p.lidLo = 0.3; p.tc = -0.5; break;
    case 'stand': p.smile = 1; p.look = 0.3 + 0.6 * dart(t, 0.8); p.lid = 0.4; p.lidLo = 0.2; p.brow = 0.85; // the card and the map: the sly look, lids low, brow down p.grip = 0.55; p.tc = 0.9; p.tw = Math.sin(t * 1.6) * 0.4; break;
    default: { // idle: sniffing in bursts, eyes wandering over the loot, the tail swishing a beat behind
      const sn = Math.max(0, Math.sin(t * 0.9));
      p.look = lerp(dart(t, 0.9), 1, sn); p.looky = 0.5 * sn; p.smile = 0.6; p.lid = 0.24; p.lidLo = 0.1; p.tw = Math.sin(t * 1.9 - 0.8) * 0.4; p.tc = 0.5 + 0.2 * Math.sin(t * 1.1);
    }
  }
  return p;
}

// ------------------------------------------------------------------ drawing kit
const P2 = (c, pts, closed = true) => { c.beginPath(); spline(c, pts, closed); };
const ell = (c, x, y, rx, ry, r = 0) => { c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), r, 0, TAU); };
// the lit part of a shape: every point pulled in along its own normal, a little on the lit side (up-left), more on the
// shaded side (down-right), so it never leaves the outline however the shape bends
function lit(pts, dHi, dLo, wx = 0.45) {
  const n = pts.length, out = [];
  let ar = 0; for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; ar += a[0] * b[1] - b[0] * a[1]; }
  const sg = ar > 0 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1, nx = (ty / l) * sg, ny = (-tx / l) * sg; // outward
    const d = lerp(dHi, dLo, clamp(0.5 + 0.5 * (ny * 0.8 + nx * wx), 0, 1));
    out.push([pts[i][0] - nx * d, pts[i][1] - ny * d]);
  }
  return out;
}
// one tapered limb from A through the joint K to B: its outline as a point list, and the angle it arrives at B with
function limbPts(A, K, B, w0, w1, w2, n) {
  const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, cx = K[0] + (K[0] - mx) * 0.7, cy = K[1] + (K[1] - my) * 0.7, L = [], R = [];
  let a1 = 0;
  for (let i = 0; i <= n; i++) {
    const f = i / n, g = 1 - f, x = g * g * A[0] + 2 * f * g * cx + f * f * B[0], y = g * g * A[1] + 2 * f * g * cy + f * f * B[1];
    const tx = 2 * g * (cx - A[0]) + 2 * f * (B[0] - cx), ty = 2 * g * (cy - A[1]) + 2 * f * (B[1] - cy), tl = Math.hypot(tx, ty) || 1, nx = -ty / tl, ny = tx / tl;
    const w = (lerp(w0, w2, f) + (w1 - (w0 + w2) / 2) * Math.sin(f * Math.PI)) / 2;
    L.push([x + nx * w, y + ny * w]); R.push([x - nx * w, y - ny * w]);
    if (i === n) a1 = Math.atan2(ty, tx);
  }
  return { L, R, a1, A, B, w0, w2, n };
}
function limbPath(c, q) {
  const { L, R, n, A, B, w0, w2, a1 } = q, a0 = Math.atan2(L[0][1] - R[0][1], L[0][0] - R[0][0]) - Math.PI / 2;
  c.beginPath(); c.moveTo(L[0][0], L[0][1]); for (let i = 1; i <= n; i++) c.lineTo(L[i][0], L[i][1]);
  c.arc(B[0], B[1], w2 / 2, a1 + Math.PI / 2, a1 - Math.PI / 2, true);
  for (let i = n - 1; i >= 0; i--) c.lineTo(R[i][0], R[i][1]);
  c.arc(A[0], A[1], w0 / 2, a0 - Math.PI / 2, a0 + Math.PI / 2, true); c.closePath();
}
function knee(jx, jy, fx, fy, a, b, fwd) {
  let dx = fx - jx, dy = fy - jy, d = Math.hypot(dx, dy);
  const m = a + b - 0.3;
  if (d > m) { fx = jx + (dx / d) * m; fy = jy + (dy / d) * m; dx = fx - jx; dy = fy - jy; d = m; }
  d = Math.max(d, Math.abs(a - b) + 0.5);
  const base = Math.atan2(dy, dx), A = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
  const k1 = [jx + a * Math.cos(base + A), jy + a * Math.sin(base + A)], k2 = [jx + a * Math.cos(base - A), jy + a * Math.sin(base - A)];
  return { K: (k1[0] < k2[0]) !== fwd ? k1 : k2, B: [fx, fy] };
}

export function drawWeasel(ctx, x, y, s, t, p, o = {}, K = {}) {
  if (!(s > 0)) return;
  const u = s / 100, frozen = o.frozen > 0, C = frozen ? ICED : PAL, lw = Math.max(3.1, 1.25 / u), low = !!PERF.low, only = o.only, face = o.face < 0 ? -1 : 1, em = o.eye || 'normal';
  ctx.save();
  try {
    ctx.translate(x, y);
    if (frozen && o.frozen < 1) ctx.translate(Math.sin(t * 70) * 0.6 * (1 - o.frozen), 0); // the last second: it shivers
    ctx.scale(u * face, u);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const cx = p.dx, cy = -p.by, cp = Math.cos(p.pitch), sn = Math.sin(p.pitch), sy = 1 - p.sq, sx = p.st * (1 + p.sq * 0.6);
    const T = (lx, ly) => [cx + (lx * sx) * cp + (ly * sy) * sn, cy - (lx * sx) * sn + (ly * sy) * cp];
    const HS = 1.5 * (p.hsc || 1), N = T(38, -9), hcx = N[0] + 12 + p.hx, hcy = N[1] - 9 + p.hy - p.pitch * 14, hr = p.hr - p.pitch * 0.6, hc = Math.cos(hr) * HS, hs = Math.sin(hr) * HS;
    const H = (lx, ly) => [hcx + lx * hc - ly * hs, hcy + lx * hs + ly * hc];
    const jawA = p.jaw * 0.6, jc = Math.cos(jawA), js = Math.sin(jawA), J = (lx, ly) => { const dx = lx, dy = ly - 5; return H(dx * jc - dy * js, 5 + dx * js + dy * jc); };
    const TO = { x: (q) => ({ x: q[0], y: q[1] }) };
    // ---- the shapes
    const torso = [[-50, 6], [-55, -6], [-47, -18], [-30, -22], [-9, -15], [13, -16.5], [33, -18], [47, -11], [50, 2], [42, 12], [21, 11], [-3, 6.5], [-25, 11], [-42, 12.5]].map((q) => T(q[0], q[1]));
    const belly = [[-40, 9.5], [-26, 8], [-4, 3.5], [20, 8], [40, 9.5], [47.5, 3], [45.5, -6], [39, -4], [31, 1.5], [18, 3], [-4, -0.5], [-24, 3.5], [-41, 4]].map((q) => T(q[0], q[1]));
    const neck = [T(17, -15), T(34, -17), H(-12, -4), H(-2, 9), H(6, 9.5), T(49, 5), T(40, 10)];
    const throat = [H(-5, 7), H(5, 8), T(47, 5), T(40, 8.5), T(30, 4), T(34, -2)];
    const skull = [[-16, 1], [-16.5, -10], [-8, -17.5], [4, -17], [13, -11.5], [21, -6], [26.5, -3.2], [28.6, 0.6], [22, 5], [10, 8.6], [-3, 11.2], [-12.5, 9]].map((q) => H(q[0], q[1]));
    const muzzle = [[-9, 7.4], [-3, 3.4], [7, 1.6], [17, 0.6], [25.4, 0.4], [26.2, 2.8], [20, 4.4], [9, 7.6], [-3, 9.8]].map((q) => H(q[0], q[1]));
    const jaw = [[-2, 4.8], [10, 4], [21, 3.2], [23.5, 5], [17.5, 8.2], [8, 10], [-2, 9.6]].map((q) => J(q[0], q[1]));
    const earPts = (far) => {
      const b = H(-9 + (far ? -4.5 : 0), -12.5 + (far ? 1.5 : 0)), ea = -p.ear * 0.95 + (far ? 0.22 : 0) + hr - 0.2, c = Math.cos(ea) * HS, s2 = Math.sin(ea) * HS, fl = 1 - 0.3 * clamp(p.ear, 0, 1);
      const R2 = (lx, ly) => [b[0] + lx * c - ly * s2 * fl, b[1] + lx * s2 + ly * c * fl];
      return { out: [[-5.6, 2], [-6.2, -5], [-1.5, -10.6], [4.6, -7.4], [5.6, 2]].map((q) => R2(q[0], q[1])), inn: [[-2.6, 0.5], [-3, -4], [-0.6, -7.4], [2.6, -5], [2.9, 0.5]].map((q) => R2(q[0], q[1])) };
    };
    const earN = earPts(false), earF = earPts(true);
    // the tail: a brush that tapers to a dark tip
    const tn = low ? 7 : 10, tl = [], tr = [], tc = [];
    {
      const base = T(-49, -4), len = 50 * (1 + p.puff * 0.06);
      let a = Math.PI + p.pitch - p.tail, px = base[0], py = base[1];
      for (let i = 0; i <= tn; i++) {
        const f = i / tn, w = (4.6 + 8.2 * Math.sin(Math.min(1, f * 1.3) * Math.PI * 0.62) - 5.5 * ss(0.78, 1, f)) * (1 + p.puff * 0.45), nx = Math.sin(a), ny = Math.cos(a);
        tc.push([px, py, a]); tl.push([px + nx * w, py + ny * w]); tr.push([px - nx * w, py - ny * w]);
        a += (-p.tc * 0.14 + p.tw * Math.sin(f * 3) * 0.12) * (0.4 + f) * (10 / tn);
        px += Math.cos(a) * (len / tn); py -= Math.sin(a) * (len / tn);
      }
    }
    const tipA = tc[tn], tipX = tipA[0] + Math.cos(tipA[2]) * 7, tipY = tipA[1] - Math.sin(tipA[2]) * 7;
    const tailPath = (c, from = 0) => { c.beginPath(); c.moveTo(tl[from][0], tl[from][1]); for (let i = from + 1; i <= tn; i++) c.lineTo(tl[i][0], tl[i][1]); c.quadraticCurveTo(tipX, tipY, tr[tn][0], tr[tn][1]); for (let i = tn - 1; i >= from; i--) c.lineTo(tr[i][0], tr[i][1]); c.closePath(); };
    // the legs: hip, knee (IK), ankle; a paw on the end
    const ln = low ? 5 : 8;
    const mkLeg = (jx, jy, fx, fy, a, b, far, front, w) => {
      const j = T(jx, jy), lift = clamp(-fy / 10, 0, 1), k = knee(j[0], j[1], fx - 1.5, fy - 3.2, a, b, !front), q = limbPts(j, k.K, k.B, w[0], w[1], w[2], ln);
      return { q, far, front, lift, fx: k.B[0] + 1.5, fy: k.B[1] + 3.2 };
    };
    const legs = only === 'head' ? [] : [
      mkLeg(34, 5, p.f1x, p.f1y, 10.5, 12, true, true, [10, 7.6, 5.6]), mkLeg(-31, 4, p.f3x, p.f3y, 11.5, 12.5, true, false, [15, 8.6, 6]),
      mkLeg(30, 6, p.f0x, p.f0y, 10.5, 12, false, true, [11, 8.2, 6]), mkLeg(-36, 5, p.f2x, p.f2y, 11.5, 12.5, false, false, [17, 9.4, 6.4]),
    ];
    const pawParts = (L) => { // the sole and three toes, turned toes-down as the foot leaves the floor; a raised forepaw opens into fingers
      const hand = L.front && L.lift > 0.55, rot = hand ? L.q.a1 - 0.2 : L.lift * (L.front ? 0.75 : 0.5), c = Math.cos(rot), s2 = Math.sin(rot), ax = L.q.B[0], ay = L.q.B[1];
      const R2 = (lx, ly) => [ax + lx * c - ly * s2, ay + lx * s2 + ly * c];
      if (hand) { const g = clamp(p.grip ?? 0.5, 0, 1), f = []; for (let i = 0; i < 4; i++) { const a = (i - 1.5) * 0.42 * (1 - 0.55 * g), l = 6.6 * (1 - 0.35 * g); f.push([R2(2.2, (i - 1.5) * 1.5), R2(2.2 + Math.cos(a) * l, (i - 1.5) * 1.5 + Math.sin(a) * l + g * 1.5)]); } return { hand, palm: [R2(1.5, 0), 3.9, 3.5, rot], f }; }
      return { hand, parts: [[R2(3.6, 1.4), 5.4, 3, rot], [R2(8.2, 0.2), 2.3, 2.1, rot], [R2(8.9, 2.2), 2.2, 1.9, rot], [R2(6.4, -0.9), 2.1, 1.9, rot]], hi: R2(2.6, 0.2) };
    };
    for (const L of legs) L.paw = pawParts(L);
    const pawSil = (c, L, g) => { const P = L.paw; c.beginPath(); if (P.hand) { c.ellipse(P.palm[0][0], P.palm[0][1], P.palm[1] + g, P.palm[2] + g, P.palm[3], 0, TAU); } else for (const q of P.parts) { c.moveTo(q[0][0] + q[1] + g, q[0][1]); c.ellipse(q[0][0], q[0][1], q[1] + g, q[2] + g, q[3], 0, TAU); } };
    const drawPaw = (L) => {
      const P = L.paw, col = L.far ? C.dark : C.paw;
      if (P.hand) {
        ctx.beginPath(); for (const f of P.f) { ctx.moveTo(f[0][0], f[0][1]); ctx.lineTo(f[1][0], f[1][1]); }
        ctx.lineWidth = 2.6 + lw * 2; ctx.strokeStyle = C.line; ctx.stroke();
        pawSil(ctx, L, lw); ctx.fillStyle = C.line; ctx.fill();
        ctx.beginPath(); for (const f of P.f) { ctx.moveTo(f[0][0], f[0][1]); ctx.lineTo(f[1][0], f[1][1]); } ctx.lineWidth = 2.6; ctx.strokeStyle = col; ctx.stroke();
        pawSil(ctx, L, 0); ctx.fillStyle = col; ctx.fill();
        return;
      }
      pawSil(ctx, L, lw); ctx.fillStyle = C.line; ctx.fill();
      pawSil(ctx, L, 0); ctx.fillStyle = col; ctx.fill();
      if (!L.far && !low) { ell(ctx, P.hi[0], P.hi[1], 3.2, 1.1, P.parts[0][3]); ctx.fillStyle = C.pawHi; ctx.fill(); }
    };
    const drawLeg = (L) => {
      limbPath(ctx, L.q); ctx.lineWidth = lw * 2; ctx.strokeStyle = C.line; ctx.stroke(); ctx.fillStyle = L.far ? C.furLo : C.fur; ctx.fill();
      drawPaw(L);
    };
    const inkS = (path, w = lw) => { path(ctx); ctx.lineWidth = w * 2; ctx.strokeStyle = C.line; ctx.stroke(); };
    const fill = (path, col) => { path(ctx); ctx.fillStyle = col; ctx.fill(); };
    const sp = (pts) => (c) => P2(c, pts);
    // ---- the ice shell first (the thieves' frozen look: a pale shell with a dark blue rim round the whole silhouette)
    if (frozen) {
      const sil = only === 'head' ? [sp(earF.out), sp(skull), sp(earN.out)] : [...legs.map((L) => (c) => limbPath(c, L.q)), ...legs.map((L) => (c) => pawSil(c, L, 0)), (c) => tailPath(c), sp(earF.out), sp(torso), sp(neck), sp(skull), sp(earN.out)];
      for (const [col, g] of [[RIM, 5], [SHELL, 3]]) { ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2 * (lw + g); for (const f of sil) { f(ctx); ctx.stroke(); ctx.fill(); } }
    }
    const headTop = H(-3, -20);
    if (o.stars > 0) dizzyStars(ctx, headTop[0], headTop[1] - 6, 17, 5, t, { n: Math.round(o.stars), layer: 'back', size: Math.max(5, 3.4 / u) });
    if (only !== 'head') {
      for (const L of legs) if (L.far) drawLeg(L);
      // tail
      inkS((c) => tailPath(c)); fill((c) => tailPath(c), C.furLo);
      { // the lit top of the brush, then the dark tip
        const k0 = Math.round(tn * 0.68), up = tl.map((q, i) => (tr[i][1] < q[1] ? tr[i] : q)), dn = tl.map((q, i) => (tr[i][1] < q[1] ? q : tr[i]));
        ctx.beginPath(); for (let i = 0; i <= k0; i++) { const X = lerp(up[i][0], dn[i][0], 0.08), Y = lerp(up[i][1], dn[i][1], 0.08); if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); } for (let i = k0; i >= 0; i--) ctx.lineTo(lerp(up[i][0], dn[i][0], 0.62), lerp(up[i][1], dn[i][1], 0.62)); ctx.closePath(); ctx.fillStyle = C.fur; ctx.fill();
        tailPath(ctx, k0); ctx.fillStyle = C.dark; ctx.fill();
        if (!low) { ctx.beginPath(); for (let i = 1; i <= k0 - 1; i++) { const X = lerp(up[i][0], dn[i][0], 0.24), Y = lerp(up[i][1], dn[i][1], 0.24); if (i === 1) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); } ctx.lineWidth = 2.4; ctx.strokeStyle = C.furHi; ctx.stroke(); }
        if (p.puff > 0.3) { ctx.strokeStyle = C.line; ctx.lineWidth = lw * 0.7; ctx.beginPath(); for (let i = 2; i < tn; i += 2) { const nx = Math.sin(tc[i][2]), ny = Math.cos(tc[i][2]); for (const q of [[tl[i], 1], [tr[i], -1]]) { ctx.moveTo(q[0][0], q[0][1]); ctx.lineTo(q[0][0] + nx * q[1] * 4.5 * p.puff, q[0][1] + ny * q[1] * 4.5 * p.puff); } } ctx.stroke(); }
      }
    }
    // far ear
    inkS(sp(earF.out)); fill(sp(earF.out), C.furLo); fill(sp(earF.inn), C.dark);
    // ---- body and head: every outline first, so torso, neck and head are one silhouette
    if (only !== 'head') { inkS(sp(torso)); inkS(sp(neck)); }
    if (p.jaw > 0.05) inkS(sp(jaw));
    inkS(sp(skull));
    if (only !== 'head') {
      fill(sp(torso), C.furLo); fill(sp(lit(torso, 0.4, 5)), C.fur);
      fill(sp(belly), C.creamLo); fill(sp(lit(belly, 0.3, 2.2)), C.cream);
      if (!low) { const g = T(-32, -15.5); ell(ctx, g[0], g[1], 10, 2.6, -p.pitch - 0.1); ctx.fillStyle = C.furHi; ctx.fill(); const g2 = T(22, -13); ell(ctx, g2[0], g2[1], 8, 2.2, -p.pitch + 0.08); ctx.fill(); }
      fill(sp(neck), C.fur); fill(sp(throat), C.cream);
      // the haunch: one curved ink line
      { const a = T(-24, -13), b = T(-17, -3), c = T(-24, 6); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(b[0], b[1], c[0], c[1]); ctx.lineWidth = lw * 0.6; ctx.strokeStyle = C.furLo; ctx.stroke(); }
      for (const L of legs) if (!L.far) drawLeg(L);
      // the shoulder and hip grow out of the coat: a patch of fur over the top of each near limb
      if (!frozen) for (const [bx, by2, rx, ry] of [[30, 1.5, 6.4, 5.4], [-37, -1, 9.5, 7.5]]) { const q = T(bx, by2); ell(ctx, q[0], q[1], rx, ry, -p.pitch); ctx.fillStyle = C.fur; ctx.fill(); }
    }
    // ---- head
    if (p.jaw > 0.05) { // the open mouth: dark inside, the tongue lying in the lower jaw, two fangs
      const mp = [H(2, 4), H(24, 2.6), J(22, 3.6), J(0, 5.5)];
      fill(sp(jaw), C.cream);
      ctx.beginPath(); mp.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); ctx.fillStyle = C.mouth; ctx.fill();
      if (p.jaw > 0.3 && !(p.tongue > 0.05)) { const a = J(5, 4.6), b = J(18, 3.8), m = J(12, 1.2); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(m[0], m[1], b[0], b[1]); ctx.closePath(); ctx.fillStyle = C.tongue; ctx.fill(); }
    }
    fill(sp(skull), C.furLo); fill(sp(lit(skull, 0.3, 3.4, 0)), C.fur);
    fill(sp(muzzle), C.cream);
    if (!low) { const g = H(-5, -13.6); ell(ctx, g[0], g[1], 6 * HS, 1.8 * HS, hr - 0.25); ctx.fillStyle = C.furHi; ctx.fill(); }
    // mouth
    const sm = clamp(p.smile ?? 0.3, -1, 1);
    if (p.jaw > 0.05) {
      ctx.fillStyle = C.tooth; for (const tx of [19.5, 12]) { const a = H(tx - 1.6, 3.1), b = H(tx + 1.6, 3), c = H(tx + 0.2, 6.6); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.fill(); }
      const a = H(1.5, 4.2), b = H(24.5, 2.6), m = H(13, 3.6); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(m[0], m[1], b[0], b[1]); ctx.lineWidth = lw * 0.55; ctx.strokeStyle = C.line; ctx.stroke();
    } else { // closed: the lip line curls up into the cheek when he is pleased, sags when he is not; one fang shows
      const a = H(2.5, 4.6 - 3.2 * sm), k1 = H(7, 6.2 - 0.6 * sm), b = H(16, 5), c = H(25, 2.6);
      const f0 = H(17.2, 4.6), f1 = H(19.8, 4.2), f2 = H(18.6, 7.6);
      ctx.fillStyle = C.tooth; ctx.strokeStyle = C.line; ctx.lineWidth = lw * 0.3; ctx.beginPath(); ctx.moveTo(f0[0], f0[1]); ctx.lineTo(f1[0], f1[1]); ctx.lineTo(f2[0], f2[1]); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(k1[0], k1[1], b[0], b[1]); ctx.quadraticCurveTo((b[0] + c[0]) / 2, (b[1] + c[1]) / 2 + 1, c[0], c[1]); ctx.lineWidth = lw * 0.6; ctx.strokeStyle = C.line; ctx.stroke();
    }
    if (p.tongue > 0.05) { // the tongue: out and round the lips (ta: its angle in the head's frame, 0 forward, + down)
      const ta = p.ta ?? 1.5, b0 = p.jaw > 0.3 ? J(15, 4.5) : H(19, 4.4), L2 = 6.4 * p.tongue, e = [b0[0] + (Math.cos(ta) * hc - Math.sin(ta) * hs) * L2, b0[1] + (Math.cos(ta) * hs + Math.sin(ta) * hc) * L2];
      const m = [(b0[0] + e[0]) / 2 + Math.sin(t * 3) * 0.6, (b0[1] + e[1]) / 2];
      ctx.beginPath(); ctx.moveTo(b0[0], b0[1]); ctx.quadraticCurveTo(m[0], m[1], e[0], e[1]); ctx.lineWidth = 6 + lw * 0.9; ctx.strokeStyle = C.line; ctx.stroke(); ctx.lineWidth = 6; ctx.strokeStyle = C.tongue; ctx.stroke();
    }
    // nose, whiskers
    { const nq = H(27.6, -0.6); ell(ctx, nq[0], nq[1], 3.5 * HS, 2.8 * HS, hr + 0.1); ctx.fillStyle = C.nose; ctx.fill(); if (!frozen) { const ng = H(26.8, -1.7); ell(ctx, ng[0], ng[1], 1.2 * HS, 0.7 * HS, hr); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill(); } }
    {
      const w0 = H(21.5, 2), wl = 12.5 * HS; ctx.strokeStyle = C.line; ctx.lineWidth = Math.max(0.9, lw * 0.36); ctx.beginPath();
      for (let i = 0; i < 3; i++) { const a = hr + (-0.3 + i * 0.36) + (p.whisk || 0) * 0.07, e = [w0[0] + Math.cos(a) * wl, w0[1] + Math.sin(a) * wl]; ctx.moveTo(w0[0], w0[1]); ctx.quadraticCurveTo((w0[0] + e[0]) / 2, (w0[1] + e[1]) / 2 - 2.5, e[0], e[1]); }
      ctx.stroke();
      if (!low) { ctx.fillStyle = C.creamLo; for (const [a, b] of [[19, 2.6], [21.5, 3.6], [17.5, 1.2]]) { const q = H(a, b); ell(ctx, q[0], q[1], 0.9, 0.9); ctx.fill(); } }
    }
    // the eye and the brow
    {
      const e = H(4.2, -5.4), bro = em === 'angry' ? 1 : p.brow, rx = 5.5, ry = 6.2, wide = em === 'wide', lock = em === 'lock';
      let lid = clamp(Math.max(p.lid, blinkAt(t, 5)), 0, 1), lo = clamp(p.lidLo || 0, 0, 1), pup = p.pup || 1, look = clamp(p.look, -1, 1), looky = clamp(p.looky || 0, -1, 1);
      if (wide) { lid = 0; lo = 0; pup = Math.min(pup, 0.55); } else if (lock) { look = 1; pup *= 1.12; }
      ctx.save(); ctx.translate(e[0], e[1]); ctx.rotate(hr); ctx.scale(HS, HS);
      const ew = lw / HS;
      if (em === 'spiral') { ell(ctx, 0, 0, rx, ry); ctx.lineWidth = ew * 1.4; ctx.strokeStyle = C.line; ctx.stroke(); ctx.fillStyle = C.eyeW; ctx.fill(); spiralEye(ctx, 0, 0, 5, t, 1, C.line); }
      else if (em === 'squeeze' || em === 'happy') {
        ctx.beginPath();
        if (em === 'squeeze') { ctx.moveTo(-4.4, -3.6); ctx.lineTo(3.4, 0); ctx.lineTo(-4.4, 3.4); } else { ctx.moveTo(-4.8, 1.8); ctx.quadraticCurveTo(0, -5.4, 4.8, 1.8); }
        ctx.lineWidth = ew * 1.1; ctx.strokeStyle = C.line; ctx.stroke();
      } else {
        const g = 1 + 0.14 * clamp(1.1 - pup, 0, 1), RX = rx * g, RY = ry * g;
        ell(ctx, 0, 0, RX, RY); ctx.lineWidth = ew * 1.4; ctx.strokeStyle = C.line; ctx.stroke(); ctx.fillStyle = C.eyeW; ctx.fill();
        const ir = Math.min(RX, RY) * 0.68 * clamp(pup, 0.4, 1.3), px = look * (RX - ir) * 0.95, py = looky * (RY - ir) * 0.95 + (RY - ir) * 0.1;
        ell(ctx, px, py, ir, ir); ctx.fillStyle = C.iris; ctx.fill(); ell(ctx, px, py + ir * 0.25, ir * 0.8, ir * 0.7); ctx.fillStyle = C.irisHi; ctx.fill(); ell(ctx, px, py, ir * 0.58, ir * 0.58); ctx.fillStyle = C.pupil; ctx.fill();
        ctx.fillStyle = '#ffffff'; ell(ctx, px - ir * 0.36, py - ir * 0.4, ir * 0.3, ir * 0.3); ctx.fill(); if (!low) { ell(ctx, px + ir * 0.34, py + ir * 0.36, ir * 0.13, ir * 0.13); ctx.fill(); }
        const mad = clamp(bro, 0, 1) * 0.32;
        if (lid > 0.02) { ctx.save(); ctx.rotate(mad); const v = clamp(-1 + 2 * lid, -0.999, 0.999), a = Math.asin(v); ctx.beginPath(); ctx.ellipse(0, 0, RX + 0.3, RY + 0.3, 0, Math.PI - a, TAU + a); ctx.closePath(); ctx.fillStyle = C.lid; ctx.fill(); ctx.lineWidth = ew * 0.7; ctx.strokeStyle = C.line; ctx.stroke(); ctx.restore(); }
        if (lo > 0.02) { const v = clamp(1 - 1.2 * lo, -0.999, 0.999), a = Math.asin(v); ctx.beginPath(); ctx.ellipse(0, 0, RX + 0.3, RY + 0.3, 0, a, Math.PI - a); ctx.closePath(); ctx.fillStyle = C.lid; ctx.fill(); ctx.lineWidth = ew * 0.7; ctx.strokeStyle = C.line; ctx.stroke(); }
      }
      // brow: fierce slopes down to the snout, worried lifts and tilts the other way
      ctx.beginPath(); ctx.moveTo(-5.5, -8.6 - (bro < 0 ? -bro * 2.2 : 0) - bro * 0.4); ctx.quadraticCurveTo(0, -9.6 - (bro < 0 ? -bro * 2.6 : -bro * 0.6), 6, -8 + (bro > 0 ? bro * 3 : bro * 0.6));
      ctx.lineWidth = ew * 1.0; ctx.strokeStyle = C.line; ctx.stroke();
      if (o.tears > 0) {
        ctx.fillStyle = '#7fd0ff'; ctx.strokeStyle = RIM; ctx.lineWidth = ew * 0.35;
        for (let i = 0; i < 2; i++) { const f = fract(t * 1.4 + i * 0.5), ty = 5 + f * 12; ctx.globalAlpha = 1 - f * 0.6; ell(ctx, -2 + i * 2.5, ty, 1.7, 2.4); ctx.fill(); ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
    // near ear, over the head
    inkS(sp(earN.out)); fill(sp(earN.out), C.fur); fill(sp(earN.inn), C.earIn);
    { const q = H(-9, -9.4); ell(ctx, q[0], q[1], 6.2 * HS, 3.4 * HS, hr - 0.2 - p.ear * 0.5); ctx.fillStyle = C.fur; ctx.fill(); } // the ear grows out of the head: no line across its root
    if (o.sweat > 0) { // drops flying off the brow
      for (let i = 0; i < 2; i++) { const f = fract(t * 2.2 + i * 0.5), q = H(-12 - i * 6 - f * 6, -19 + f * f * 6 - f * 3), r = 2.4; ctx.globalAlpha = o.sweat * (1 - f); ctx.beginPath(); ctx.moveTo(q[0], q[1] - r * 1.7); ctx.quadraticCurveTo(q[0] + r * 1.2, q[1], q[0], q[1] + r); ctx.quadraticCurveTo(q[0] - r * 1.2, q[1], q[0], q[1] - r * 1.7); ctx.closePath(); ctx.lineWidth = lw * 1.1; ctx.strokeStyle = C.line; ctx.stroke(); ctx.fillStyle = C.sweat; ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    if (o.stars > 0) dizzyStars(ctx, headTop[0], headTop[1] - 6, 17, 5, t, { n: Math.round(o.stars), layer: 'front', size: Math.max(5, 3.4 / u) });
    const Tx = (lx, ly) => TO.x(T(lx, ly)), Hx = (lx, ly) => TO.x(H(lx, ly));
    if (frozen && K.ice) K.ice(ctx, Tx, Hx, lw * 0.85, t, o);
    if (o.zap > 0 && K.zap) K.zap(ctx, Tx, Hx, lw * 0.85, t, o.zap);
    if (o.out) {
      const mo = H(17, 5), no = H(27, 0), hd = H(0, -4);
      o.out.mouth = { x: x + mo[0] * u * face, y: y + mo[1] * u }; o.out.nose = { x: x + no[0] * u * face, y: y + no[1] * u }; o.out.head = { x: x + hd[0] * u * face, y: y + hd[1] * u };
    }
  } catch (e) { /* art never breaks the frame */ }
  ctx.restore();
}
