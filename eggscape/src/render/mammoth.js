// Old Frostbeard: the world 3 boss (sim kind 'blizzard'). A grumpy woolly mammoth on an ice floe over the vault.
// Front view, built with the cast kit (one light top-left, crisp bands, thin same-hue lines). Everything that moves
// is on a spring (body, ears, each trunk joint), so poses overshoot and the fur and trunk follow through.
//   gale:    rears, chest swells, cheeks puff, the trunk rolls up like a party horn .. then whips out and trumpets
//   freeze:  lifts a foot high, slams it on the floe (frost cracks race to the ring: render/boss.js)
//   icicles: shakes like a wet dog, ice flying off the coat and tusks
//   hurt:    recoils, eyes squeezed, the snow on its head and back flies off (and slowly settles again)
//   dizzy / frozen: the shared status looks; beaten: sits down with a thump and a head full of snow
// Drawn in px space at the boss pose, y down; s = pose height in px.
import { clamp, lerp, ss, hash, blinkAt, spline, form, limb, eye, contact, burst } from './castkit.js';
import { dizzyStars } from './status.js';

const TAU = Math.PI * 2, N = 11, SEG = 0.041;
const C = {
  fur: '#8c5331', furLo: '#5b3020', furHi: '#b97d4d', line: '#3a1d12', mask: '#5f3422',
  skin: '#7d4d38', skinLo: '#50291c', skinHi: '#a87258',
  frost: '#f1f6fb', frostLo: '#a8bdd2', frostLine: '#6f88a3',
  ivory: '#f7eed8', ivoryLo: '#c9b088', ivoryLine: '#7d6242',
  ice: '#c6e6f6', iceLo: '#79b0d2', iceDeep: '#4a7fa8', iceLine: '#3b6a8e',
};
export const MAMMOTH_FOOT = { x: 0.27, y: 0.44 }; // x the pose height from its centre (toward dir), y down

let S = null; // spring state of the one mammoth on screen
function spr(key, target, dt, k = 150, d = 15) {
  if (S[key] === undefined) { S[key] = target; S[key + 'V'] = 0; }
  S[key + 'V'] += ((target - S[key]) * k - S[key + 'V'] * d) * dt;
  S[key] += S[key + 'V'] * dt;
  return S[key];
}
function stateOf(sim, B, acting) {
  if (sim.state === 'won' || sim.state === 'winning') return 'beaten';
  if (sim.state === 'failed') return 'gloat';
  if (B.dizzy > 0) return 'dizzy';
  if (B.flinch > 0) return 'hurt';
  const A = B.atk;
  if (!A) return 'idle';
  if (A.name === 'gale') return acting ? 'blow' : 'inhale';
  if (A.name === 'freeze') return 'stomp';
  if (A.name === 'icicles') return 'shake';
  return 'idle';
}

// a lit tube: shade pass with the line, the base offset to the light, a thin highlight
function tube(ctx, P, W, lo, base, hi, line, lw) {
  limb(ctx, P, W, lo, line, lw);
  limb(ctx, P.map((p, i) => [p[0] - W[i] * 0.16, p[1] - W[i] * 0.22]), W.map((w) => w * 0.76), base);
  if (hi) limb(ctx, P.map((p, i) => [p[0] - W[i] * 0.42, p[1] - W[i] * 0.48]), W.map((w) => w * 0.2), hi);
}
function resample(P, W, m) {
  const out = [], ow = [], n = P.length;
  const f = (a, b, c, d, u) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < m; j++) {
    const u = j / m, p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n - 1, i + 2)];
    out.push([f(p0[0], p1[0], p2[0], p3[0], u), f(p0[1], p1[1], p2[1], p3[1], u)]); ow.push(lerp(W[i], W[i + 1], u));
  }
  out.push(P[n - 1]); ow.push(W[n - 1]);
  return [out, ow];
}
// hanging tufts from (x0, y0) to (x1, y1): continues the current path. bow lifts the middle (negative) or sags it.
function zig(ctx, x0, y0, x1, y1, n, len, sway, seed, bow = 0) {
  const at = (u) => [lerp(x0, x1, u), lerp(y0, y1, u) + bow * (1 - (2 * u - 1) * (2 * u - 1))];
  let p = at(0);
  ctx.lineTo(p[0], p[1]);
  for (let j = 0; j < n; j++) {
    const m = at((j + 0.5) / n), q = at((j + 1) / n), h = len * (0.6 + 0.6 * hash(seed + j)), tx = m[0] + sway * (0.5 + hash(seed + j + 7)), ty = m[1] + h;
    ctx.quadraticCurveTo(lerp(p[0], tx, 0.3), ty - h * 0.2, tx, ty);
    ctx.quadraticCurveTo(lerp(tx, q[0], 0.8), ty - h * 0.45, q[0], q[1]);
    p = q;
  }
}
// one lock of hair from a root, w wide, len long, pointing along ang (0 = down), its tip bent by bend
function lock(ctx, x, y, w, len, ang, bend, fill, line, lw) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.quadraticCurveTo(-w * 0.5, len * 0.6, bend, len); ctx.quadraticCurveTo(w * 0.6, len * 0.5, w / 2, 0); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (line) { ctx.lineWidth = lw; ctx.strokeStyle = line; ctx.lineJoin = 'round'; ctx.stroke(); }
  ctx.restore();
}
function icicle(ctx, x, y, w, len, ang = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); ctx.lineTo(w * 0.08, len); ctx.closePath();
  ctx.fillStyle = C.iceLo; ctx.fill();
  ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w * 0.05, 0); ctx.lineTo(w * 0.02, len * 0.85); ctx.closePath();
  ctx.fillStyle = C.ice; ctx.fill();
  ctx.restore();
}

const BODY = [[-0.5, 0.25], [-0.575, 0.07], [-0.535, -0.13], [-0.4, -0.3], [-0.21, -0.4], [0, -0.43], [0.21, -0.4], [0.4, -0.3], [0.535, -0.13], [0.575, 0.07], [0.5, 0.25]];
const HEAD = [[0, -0.27], [0.13, -0.25], [0.23, -0.17], [0.27, -0.02], [0.24, 0.12], [0.14, 0.22], [0, 0.25], [-0.14, 0.22], [-0.24, 0.12], [-0.27, -0.02], [-0.23, -0.17], [-0.13, -0.25]];
const [TUSK_P, TUSK_W] = resample([[0.115, 0.1], [0.16, 0.25], [0.275, 0.365], [0.42, 0.385], [0.535, 0.31], [0.585, 0.18], [0.545, 0.05]], [0.041, 0.041, 0.038, 0.032, 0.024, 0.015, 0.005], 4);
const TRUNK_W = Array.from({ length: N + 1 }, (_, i) => lerp(0.08, 0.036, Math.pow(i / N, 0.8)));

export function drawMammoth(ctx, sim, B, Q, s, t, warnU, acting, calm, frozen) {
  if (!S || S.sim !== sim || S.B !== B) S = { sim, B, t, cap: 1, c: new Float32Array(N), cv: new Float32Array(N), st: 'idle', land: 9, beat: 0, wasUp: false };
  const dt = clamp(t - S.t, 0, 0.05); S.t = t;
  const st = frozen ? S.st : stateOf(sim, B, acting); S.st = st;
  const dir = Q.dir || 1, A = B.atk;
  // ---- targets
  let lift = 0, rot = 0, sq = 0, swell = 0, ear = 0, puff = 0, anger = 0.55, base = 0, mouth = 0, lid = 0.18, shut = null, shake = 0, splay = 0, pin = 0.5;
  let look = { x: dir * 0.35, y: 0.55 };
  const legT = [0, 0]; // foot lift, left / right
  let curl = (i) => 0.07 * Math.sin(t * 1.3 - i * 0.55) + (i > 7 ? 0.42 * dir : 0);
  const side = dir > 0 ? 1 : 0;
  let landed = false;
  if (st === 'idle') {
    sq = 0.012 * Math.sin(t * 1.7);
    const f = t % 3.7; ear = f < 0.55 ? Math.sin((f / 0.55) * TAU * 1.5) * 0.55 : 0;
  } else if (st === 'inhale') {
    const e = ss(0, 1, warnU);
    lift = 0.065 * e; rot = -0.09 * dir * e; swell = 0.08 * e; sq = -0.04 * e; puff = e; ear = 0.55 * e; anger = 0.85; base = dir * 0.55 * e; lid = 0.45; pin = 0.36;
    legT[side] = 0.05 * e; legT[1 - side] = 0.02 * e;
    curl = (i) => dir * e * (0.3 + 0.075 * i);
    if (!calm) shake = Math.sin(t * 52) * 0.006 * warnU;
    look = { x: dir * 0.7, y: 0.2 };
  } else if (st === 'blow') {
    lift = -0.02; rot = 0.11 * dir; sq = 0.05; puff = 0.25; ear = -0.6 + (calm ? 0 : 0.15 * Math.sin(t * 36)); anger = 1; base = -dir * 1.32; mouth = 0.9; lid = 0.3; pin = 0.36;
    curl = (i) => (calm ? 0 : 0.05 * Math.sin(t * 40 - i * 1.1));
    look = { x: dir * 0.9, y: 0.1 };
  } else if (st === 'stomp') {
    const up = ss(0, 0.3, warnU) * (1 - ss(0.38, 0.45, warnU)) * (acting ? 0 : 1);
    landed = acting || warnU >= 0.45;
    legT[side] = 0.2 * up; lift = 0.04 * up; rot = landed ? 0.05 * dir : -0.15 * dir * up; anger = 1; ear = landed ? -0.35 : 0.55 * up; mouth = landed ? 0.25 : 0.7 * up; lid = 0.3; pin = 0.4;
    base = landed ? 0 : dir * 2.0 * up;
    curl = landed ? (i) => -dir * 0.05 + (i > 7 ? 0.3 * dir : 0) : (i) => dir * 0.1 * up;
    look = { x: dir * 0.5, y: 0.9 };
  } else if (st === 'shake') {
    const w = acting ? 1 : 0.4 + 0.6 * warnU;
    if (!calm) shake = Math.sin(t * 34) * 0.075 * w;
    lift = 0.012; anger = 1; mouth = 0.55; lid = 0.1; pin = 0.3; ear = calm ? 0.2 : 0.55 * Math.sin(t * 34 + 1.2);
    base = calm ? 0 : 0.3 * Math.sin(t * 17);
    curl = (i) => (calm ? 0 : 0.32 * Math.sin(t * 34 - i * 0.8) * w);
    look = { x: 0, y: 0.7 };
  } else if (st === 'hurt') {
    const u = 1 - clamp(B.flinch / 0.9, 0, 1);
    rot = -0.13 * dir * (1 - u * 0.6); lift = 0.045 * (1 - u); sq = -0.03 * (1 - u); anger = -0.7; ear = -0.75; mouth = 1; shut = 'squint'; base = -dir * 2.3 * (1 - u * 0.5);
    curl = () => -dir * 0.07;
  } else if (st === 'dizzy') {
    rot = calm ? 0 : Math.sin(t * 2.2) * 0.08; sq = 0.03 + 0.015 * Math.sin(t * 1.6); anger = -0.25; mouth = 0.35; ear = 0.3 * Math.sin(t * 2.2 - 1); base = 0.25 * Math.sin(t * 2.2 - 0.6);
    curl = (i) => 0.2 * Math.sin(t * 3 - i * 0.7);
  } else if (st === 'beaten') {
    S.beat += dt;
    lift = -0.085; sq = 0.05; rot = 0.03 * dir; anger = -0.6; lid = 0.52; ear = -0.55; splay = 0.09; look = { x: -dir * 0.8, y: 0.35 };
    curl = (i) => 0.015 * Math.sin(t * 1.1 - i * 0.5) + (i > 8 ? -0.3 * dir : 0);
  } else if (st === 'gloat') {
    lift = calm ? 0 : 0.03 * Math.abs(Math.sin(t * 8)); base = -dir * 2.5 + 0.25 * Math.sin(t * 8); mouth = 0.8; shut = 'squint'; anger = 0.3; ear = 0.4 * Math.sin(t * 8);
    curl = () => -dir * 0.06;
  }
  if (st !== 'beaten') S.beat = 0;
  // the stomp lands: kick the squash spring once, start the impact clock
  if (st === 'stomp' && landed && S.wasUp) { S.sqV = (S.sqV || 0) + 1.5; S.land = 0; }
  S.wasUp = st === 'stomp' && !landed;
  S.land += dt;
  if (st === 'hurt') S.cap = Math.max(0, S.cap - dt * 9); else S.cap = Math.min(1, S.cap + dt * 0.3);
  // ---- springs (two substeps keep the stiff ones stable at 30 fps)
  const h2 = dt / 2;
  let L = 0, R = 0, SQ = 0, SW = 0, EAR = 0, PUFF = 0, ANG = 0, BASE = 0, DS = 0, LG0 = 0, LG1 = 0;
  for (let q = 0; q < 2; q++) {
    L = spr('lift', lift, h2, 170, 15); R = spr('rot', rot, h2, 120, 11); SQ = spr('sq', sq, h2, 240, 14); SW = spr('sw', swell, h2);
    EAR = spr('ear', ear, h2, 260, 15); PUFF = spr('puff', puff, h2, 200, 18); ANG = spr('ang', anger, h2, 200, 20); BASE = spr('base', base, h2, 110, 11);
    DS = spr('dir', dir, h2, 60, 13); LG0 = spr('lg0', legT[0], h2, 420, 26); LG1 = spr('lg1', legT[1], h2, 420, 26);
    for (let i = 0; i < N; i++) { const k = 190 - i * 11, d = 13 - i * 0.55; S.cv[i] += ((curl(i) - S.c[i]) * k - S.cv[i] * d) * h2; S.c[i] += S.cv[i] * h2; }
  }
  const MO = spr('mo', mouth, dt, 260, 22), SPL = spr('spl', splay, dt, 160, 13), CAPB = spr('capb', st === 'beaten' && S.beat > 0.45 ? 1 : 0, dt, 130, 10);
  const lag = clamp(-(S.rotV || 0) * 0.05 - (calm ? 0 : Math.cos(t * 34) * shake * 0.9), -0.07, 0.07) + (calm ? 0 : 0.004 * Math.sin(t * 2.1)); // fur tips trail the body
  const lw = 0.0085;
  const legs = [LG0, LG1];

  ctx.save();
  ctx.scale(s, s);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // ---- the ice floe
  const FY = 0.44;
  contact(ctx, 0.03, FY + 0.075, 0.6, 0.035, 0.16);
  ctx.beginPath(); ctx.moveTo(-0.66, FY - 0.005); ctx.lineTo(0.66, FY - 0.005); ctx.lineTo(0.6, FY + 0.05); ctx.lineTo(0.34, FY + 0.075); ctx.lineTo(0.06, FY + 0.055); ctx.lineTo(-0.24, FY + 0.085); ctx.lineTo(-0.56, FY + 0.05); ctx.closePath();
  ctx.fillStyle = C.iceLo; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = C.iceLine; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.06, FY + 0.055); ctx.lineTo(0.34, FY + 0.075); ctx.lineTo(0.6, FY + 0.05); ctx.lineTo(0.66, FY); ctx.lineTo(0.1, FY); ctx.closePath(); ctx.fillStyle = C.iceDeep; ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1;
  for (const [x, w, l] of [[-0.47, 0.05, 0.07], [-0.3, 0.035, 0.045], [-0.02, 0.04, 0.06], [0.22, 0.03, 0.04], [0.47, 0.045, 0.065]]) icicle(ctx, x, FY + 0.05 + (x < -0.2 && x > -0.4 ? 0.03 : 0.005), w, l);
  // snow lying on it
  ctx.beginPath(); ctx.moveTo(-0.68, FY + 0.012);
  for (let i = 0; i <= 8; i++) { const x = -0.68 + (i / 8) * 1.36; ctx.quadraticCurveTo(x - 0.085, FY - 0.03 - 0.014 * hash(i + 2), x, FY - 0.004 + (i === 8 ? 0.016 : 0)); }
  ctx.closePath(); ctx.fillStyle = C.frost; ctx.fill(); ctx.lineWidth = lw * 0.8; ctx.strokeStyle = C.frostLine; ctx.stroke();
  if (S.land < 1.2 && st === 'stomp') { // the floe cracks under the foot
    const fx = dir * MAMMOTH_FOOT.x, g = clamp(S.land / 0.12, 0, 1);
    ctx.strokeStyle = C.iceLine; ctx.lineWidth = lw * 1.2; ctx.beginPath();
    for (const d of [-1, 0.2, 1]) { ctx.moveTo(fx, FY + 0.005); ctx.lineTo(fx + d * 0.05 * g, FY + 0.03 * g); ctx.lineTo(fx + d * 0.1 * g, FY + 0.05 * g); }
    ctx.stroke();
  }
  // ---- legs (planted on the floe; the coat hangs over their tops)
  for (const i of [0, 1]) {
    const sg = i ? 1 : -1, up = legs[i], fx = sg * (0.27 + SPL + up * 0.75), fy = FY - 0.012 - up, hx = sg * 0.27, hy = 0.16 - L * 0.6;
    if (up < 0.02) contact(ctx, fx, FY, 0.13, 0.02, 0.22);
    const P = [[hx, hy], [lerp(hx, fx, 0.5) + sg * up * 0.25, lerp(hy, fy, 0.5)], [fx, fy - 0.05], [fx, fy - 0.02]];
    tube(ctx, P, [0.1, 0.105, 0.108, 0.118], C.furLo, i ? '#7a4529' : C.fur, null, C.line, lw);
    // shaggy cuff and three toenails
    ctx.beginPath(); ctx.moveTo(fx - 0.118, fy - 0.07); zig(ctx, fx - 0.118, fy - 0.07, fx + 0.118, fy - 0.07, 5, 0.035, lag * 0.5, 30 + i * 9); ctx.lineWidth = lw; ctx.strokeStyle = 'rgba(45,20,10,0.55)'; ctx.stroke();
    for (const q of [-1, 0, 1]) { ctx.beginPath(); ctx.ellipse(fx + q * 0.066, fy + 0.006, 0.027, 0.02, 0, Math.PI, TAU); ctx.closePath(); ctx.fillStyle = q < 0 ? C.ivory : '#e3d4b2'; ctx.fill(); ctx.lineWidth = lw * 0.7; ctx.strokeStyle = C.ivoryLine; ctx.stroke(); }
  }
  // ---- body (pivots on the feet)
  ctx.translate(0, FY); ctx.rotate(R + shake); ctx.scale(1 + SQ * 0.7 + SW, 1 - SQ); ctx.translate(0, -FY - L);
  // side locks behind the coat
  for (const sg of [-1, 1]) for (const [x, y, a] of [[0.53, -0.1, 0.55], [0.56, 0.04, 0.38], [0.53, 0.16, 0.2]]) lock(ctx, sg * x, y, 0.1, 0.14, -sg * a, lag * 1.2, C.furLo, C.line, lw);
  const bodyPath = () => { ctx.beginPath(); spline(ctx, BODY, false, 0.5, true); zig(ctx, 0.5, 0.25, -0.5, 0.25, 9, 0.075, lag, 3, 0.02); ctx.closePath(); };
  form(ctx, bodyPath, {
    d: 0.075, lo: C.furLo, base: C.fur, hi: C.furHi, line: C.line, lw, hiK: 0.75,
    inner: (c) => {
      for (const [y, sd] of [[-0.14, 11], [0.03, 23], [0.17, 37]]) { // layered rows of fur: a shadow under each row, a lit edge above
        c.beginPath(); c.moveTo(-0.7, y + 0.1); zig(c, -0.66, y + 0.1, 0.66, y + 0.1, 10, 0.075, lag * 0.8, sd, -0.11);
        c.lineWidth = 0.022; c.strokeStyle = 'rgba(48,20,10,0.42)'; c.stroke();
        c.save(); c.translate(-0.004, -0.011); c.lineWidth = 0.006; c.strokeStyle = 'rgba(255,214,170,0.22)'; c.stroke(); c.restore();
      }
      // snow on the hump
      const k = S.cap * (1 + CAPB * 0.25);
      if (k > 0.02) { c.fillStyle = C.frostLo; c.beginPath(); c.ellipse(-0.05, -0.53, 0.46, 0.2 * k + 0.012, 0.05, 0, TAU); c.fill(); c.fillStyle = C.frost; c.beginPath(); c.ellipse(-0.07, -0.545, 0.46, 0.2 * k, 0.05, 0, TAU); c.fill(); }
    },
  });
  // icicles in the coat's hem (shaken off during the volley)
  if (st !== 'shake') for (const [x, l] of [[-0.45, 0.05], [-0.36, 0.035], [0.39, 0.045], [0.46, 0.03]]) icicle(ctx, x + lag * 0.6, 0.3, 0.028, l, -lag * 2);
  // ---- head
  const hx = 0.045 * DS, hy = -0.215 - (st === 'inhale' ? 0.03 * PUFF : 0) + SQ * 0.3;
  ctx.save();
  ctx.translate(hx, hy); ctx.rotate(R * 0.5 - clamp((S.rotV || 0) * 0.03, -0.1, 0.1));
  // ears
  for (const sg of [-1, 1]) {
    ctx.save(); ctx.translate(sg * 0.24, -0.1); ctx.scale(sg * 1.4, 1.4); ctx.rotate(-0.2 - EAR * 0.55); ctx.scale(1 - 0.25 * Math.abs(EAR), 1);
    const ep = () => { ctx.beginPath(); spline(ctx, [[-0.02, -0.03], [0.08, -0.1], [0.155, -0.04], [0.15, 0.08], [0.07, 0.15], [0, 0.09]], true); };
    form(ctx, ep, { d: 0.03, lo: C.furLo, base: '#7c482b', hi: C.fur, line: C.line, lw: lw / 1.4, inner: (c) => { c.fillStyle = 'rgba(92,34,36,0.75)'; c.beginPath(); c.ellipse(0.075, 0.025, 0.045, 0.075, 0.2, 0, TAU); c.fill(); } });
    lock(ctx, 0.1, 0.12, 0.05, 0.06, -0.2, lag, C.furLo, C.line, lw * 0.8);
    ctx.restore();
  }
  // topknot behind the skull
  for (const [x, a, l] of [[-0.09, -0.75, 0.1], [-0.035, -0.3, 0.13], [0.03, 0.15, 0.14], [0.085, 0.6, 0.1]]) lock(ctx, x, -0.24, 0.07, l * (1 - CAPB * 0.5), Math.PI + a, -lag * 2.4 + (calm ? 0 : 0.008 * Math.sin(t * 2.6 + x * 30)), x > 0 ? C.furLo : C.fur, C.line, lw);
  const headPath = () => { ctx.beginPath(); spline(ctx, HEAD.map(([x, y], i) => [(i === 3 || i === 4 || i === 8 || i === 9) ? x * (1 + 0.2 * PUFF) : x, y]), true); };
  form(ctx, headPath, {
    d: 0.06, lo: C.furLo, base: C.fur, hi: C.furHi, line: C.line, lw, hiK: 0.7,
    inner: (c) => {
      c.fillStyle = C.mask; c.globalAlpha *= 0.7; c.beginPath(); c.ellipse(0, -0.045, 0.21, 0.075, 0, 0, TAU); c.fill(); c.beginPath(); c.moveTo(-0.1, 0); c.lineTo(0.1, 0); c.lineTo(0.09, 0.3); c.lineTo(-0.09, 0.3); c.closePath(); c.fill(); c.globalAlpha /= 0.7;
      const k = S.cap + CAPB * 1.5;
      if (k > 0.02) { c.fillStyle = C.frostLo; c.beginPath(); c.ellipse(-0.02, -0.3, 0.24, 0.085 * k + 0.01, 0, 0, TAU); c.fill(); c.fillStyle = C.frost; c.beginPath(); c.ellipse(-0.03, -0.31, 0.24, 0.085 * k, 0, 0, TAU); c.fill(); }
    },
  });
  // the frost beard: locks hanging off the jowls, either side of the trunk
  for (const sg of [-1, 1]) for (const [x, y, l, a, q] of [[0.255, 0.06, 0.09, 0.5, 1], [0.235, 0.105, 0.12, 0.38, 0], [0.2, 0.15, 0.15, 0.27, 1], [0.16, 0.185, 0.17, 0.17, 0], [0.12, 0.21, 0.18, 0.09, 1], [0.085, 0.225, 0.16, 0.02, 0]]) lock(ctx, sg * x * (1 + 0.15 * PUFF), y, 0.072, l, -sg * a, lag * 2 + (calm ? 0 : 0.006 * Math.sin(t * 2.3 + x * 20)), q ? '#d3e0ec' : C.frost, C.frostLine, lw * 0.8);
  // mouth under the trunk (shows when the trunk is up)
  if (MO > 0.05) {
    ctx.beginPath(); ctx.ellipse(0, 0.2 + 0.02 * MO, 0.075, 0.012 + 0.055 * MO, 0, 0, TAU); ctx.fillStyle = '#4a1218'; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = C.line; ctx.stroke();
    ctx.save(); ctx.clip(); ctx.beginPath(); ctx.ellipse(0, 0.2 + 0.075 * MO, 0.05, 0.035, 0, 0, TAU); ctx.fillStyle = '#c85a62'; ctx.fill(); ctx.restore();
  }
  // tusks (they sag when it is beaten, rattle when it shakes)
  for (const sg of [-1, 1]) {
    ctx.save(); ctx.scale(sg, 1); ctx.translate(0.115, 0.1); ctx.rotate(SPL * 1.6 + EAR * 0.02 * sg - lag * sg * 0.8); ctx.translate(-0.115, -0.1);
    tube(ctx, TUSK_P, TUSK_W, C.ivoryLo, C.ivory, null, C.ivoryLine, lw);
    if (st !== 'shake') for (const j of [9, 12]) icicle(ctx, TUSK_P[j][0], TUSK_P[j][1] + TUSK_W[j] * 0.8, 0.026, 0.045 - (j - 9) * 0.004);
    ctx.restore();
    // the fur lip the tusk grows out of
    lock(ctx, sg * 0.125, 0.07, 0.12, 0.085, -sg * 0.12, 0, C.fur, C.line, lw);
  }
  // eyes: small and furious, deep under frosted brows
  const blink = st === 'idle' || st === 'beaten' ? blinkAt(t, 3) : 0;
  for (const sg of [-1, 1]) {
    const ex = sg * 0.11, ey = -0.055, er = 0.048;
    if (st === 'dizzy') {
      ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.fillStyle = '#f3ecdc'; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = C.line; ctx.stroke();
      ctx.beginPath(); for (let a = 0; a < 3.2 * Math.PI; a += 0.35) { const rr = er * 0.85 * (a / (3.2 * Math.PI)), aa = a + t * 7 * sg; ctx.lineTo(ex + Math.cos(aa) * rr, ey + Math.sin(aa) * rr); } ctx.lineWidth = lw * 1.1; ctx.stroke();
    } else {
      eye(ctx, ex, ey, { r: er, white: '#f3ecdc', iris: '#2b160c', irisR: pin, pupil: 'dot', pupilR: pin * 0.55, look, lid: Math.max(lid + 0.25 * clamp(ANG, 0, 1), blink), mad: -sg * 0.42 * clamp(ANG, 0, 1), lidLo: st === 'beaten' ? 0.15 : 0.1 + 0.2 * PUFF, lidCol: C.mask, line: C.line, lw, shut });
    }
    // brow: a heavy frosted wedge, its inner end dropping over the eye when angry
    const a = clamp(ANG, -1, 1), ix = sg * 0.03, iy = -0.108 + a * 0.04, ox = sg * 0.2, oy = -0.14 - a * 0.035;
    ctx.beginPath(); ctx.moveTo(ix, iy + 0.03); ctx.lineTo(ox, oy + 0.035); ctx.lineTo(ox + sg * 0.05, oy - 0.012 - lag); ctx.lineTo(ox - sg * 0.01, oy - 0.012); ctx.lineTo(ox - sg * 0.03, oy - 0.045); ctx.lineTo(lerp(ix, ox, 0.55), lerp(iy, oy, 0.55) - 0.022); ctx.lineTo(lerp(ix, ox, 0.4), lerp(iy, oy, 0.4) - 0.045); ctx.lineTo(ix + sg * 0.02, iy - 0.02); ctx.lineTo(ix - sg * 0.012, iy - 0.03); ctx.closePath();
    ctx.fillStyle = C.frost; ctx.fill(); ctx.lineWidth = lw * 0.9; ctx.strokeStyle = C.frostLine; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ix, iy + 0.03); ctx.lineTo(ox, oy + 0.035); ctx.lineWidth = lw * 1.6; ctx.strokeStyle = C.frostLo; ctx.stroke();
  }
  // ---- the trunk: a sprung chain from between the tusks
  const TP = [[0, 0.085]];
  let ang = Math.PI / 2 + BASE, tx = 0, ty = 0.085;
  for (let i = 0; i < N; i++) { ang += S.c[i]; tx += Math.cos(ang) * SEG; ty += Math.sin(ang) * SEG; TP.push([tx, ty]); }
  tube(ctx, TP, TRUNK_W, C.skinLo, C.skin, C.skinHi, C.line, lw);
  ctx.strokeStyle = 'rgba(50,22,14,0.45)'; ctx.lineWidth = lw * 0.9; ctx.beginPath();
  for (let i = 2; i < N; i += 2) { const a2 = Math.atan2(TP[i + 1][1] - TP[i - 1][1], TP[i + 1][0] - TP[i - 1][0]), nx = -Math.sin(a2), ny = Math.cos(a2), w = TRUNK_W[i]; ctx.moveTo(TP[i][0] - nx * w * 0.2, TP[i][1] - ny * w * 0.2); ctx.lineTo(TP[i][0] + nx * w * 0.85, TP[i][1] + ny * w * 0.85); ctx.moveTo(TP[i][0] - nx * w * 0.85, TP[i][1] - ny * w * 0.85); ctx.lineTo(TP[i][0] - nx * w * 0.55, TP[i][1] - ny * w * 0.55); }
  ctx.stroke();
  const flare = st === 'blow' ? 1.5 : 1;
  ctx.save(); ctx.translate(tx, ty); ctx.rotate(ang);
  ctx.beginPath(); ctx.ellipse(0.004, 0, 0.02, 0.04 * flare, 0, 0, TAU); ctx.fillStyle = C.skinLo; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = C.line; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0.008, 0, 0.009, 0.022 * flare, 0, 0, TAU); ctx.fillStyle = '#2a0f0c'; ctx.fill();
  if (!calm && !frozen) {
    if (st === 'blow') { // the trumpet: streaks and snow fanning out of the trunk
      ctx.strokeStyle = '#ffffff';
      for (let i = 0; i < 7; i++) {
        const f = (t * 2.1 + i / 7 + hash(i) * 0.3) % 1, x0 = 0.03 + f * 0.62, y0 = (i - 3) * 0.022 * (1 + f * 3.2), len = 0.1 + 0.1 * hash(i + 4);
        ctx.globalAlpha = (1 - f) * 0.95; ctx.lineWidth = 0.02 * (1 - f * 0.6);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 + len * 0.5, y0 + (i - 3) * 0.012, x0 + len, y0 + (i - 3) * 0.03 * (1 + f)); ctx.stroke();
      }
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 9; i++) { const f = (t * 1.7 + hash(i + 20)) % 1; ctx.globalAlpha = 1 - f; ctx.beginPath(); ctx.arc(0.04 + f * 0.75, (hash(i + 31) - 0.5) * 0.3 * (0.2 + f), 0.011 * (1 - f * 0.4), 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    } else if (st === 'beaten' && S.beat > 0.5) { // a long sigh
      const f = ((S.beat - 0.5) * 0.6) % 1; ctx.globalAlpha = 0.7 * Math.sin(f * Math.PI); ctx.fillStyle = '#ffffff';
      for (const j of [0, 1, 2]) { ctx.beginPath(); ctx.arc(0.03 + f * 0.1 + j * 0.03, (j - 1) * 0.015 - f * 0.02, 0.016 + f * 0.02 - j * 0.003, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
  ctx.restore(); // head
  if (!calm && !frozen) {
    if (st === 'shake') { // ice flung out of the coat
      for (let i = 0; i < 10; i++) {
        const f = (t * 1.7 + hash(i)) % 1, sg = hash(i + 9) < 0.5 ? -1 : 1, x = sg * (0.25 + 0.3 * hash(i + 4)) + sg * f * (0.25 + 0.3 * hash(i + 2)), y = -0.2 + 0.5 * hash(i + 5) - 0.22 * f + 0.55 * f * f;
        ctx.globalAlpha = 1 - f * f; icicle(ctx, x, y, 0.03, 0.065, sg * (1 + f * 5));
      }
      ctx.globalAlpha = 1;
    }
    if (st === 'hurt') { // the snow leaves its head and back
      const u = 1 - clamp(B.flinch / 0.9, 0, 1);
      for (let i = 0; i < 9; i++) {
        const sg = i % 2 ? 1 : -1, x = (hash(i + 3) - 0.5) * 0.6 + sg * u * (0.2 + 0.35 * hash(i)), y = -0.45 + 0.12 * hash(i + 6) - 0.3 * u + 0.75 * u * u, r = 0.04 * (1 - u * 0.5) * (0.6 + 0.6 * hash(i + 8));
        ctx.globalAlpha = 1 - u * u; ctx.fillStyle = C.frostLo; ctx.beginPath(); ctx.arc(x + r * 0.2, y + r * 0.25, r, 0, TAU); ctx.fill(); ctx.fillStyle = C.frost; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
      burst(ctx, hx - dir * 0.02, hy - 0.05, 0.36, 0.47, -Math.PI * 0.9, -Math.PI * 0.1, 7, 0.012 * (1 - u), '#ffffff');
    }
  }
  ctx.restore(); // body
  // ---- the stomp lands: lines and snow off the floe
  if (!calm && !frozen && st === 'stomp' && S.land < 0.55) {
    ctx.save(); ctx.scale(s, s);
    const fx = dir * MAMMOTH_FOOT.x, u = S.land / 0.55;
    if (u < 0.5) burst(ctx, fx, FY - 0.01, 0.15 + u * 0.1, 0.24 + u * 0.22, -Math.PI * 0.95, -Math.PI * 0.05, 6, 0.014 * (1 - u * 2), '#ffffff');
    for (let i = 0; i < 6; i++) { const sg = i % 2 ? 1 : -1, r = 0.035 * (1 - u * 0.6) * (0.7 + 0.5 * hash(i)); ctx.globalAlpha = 1 - u; ctx.fillStyle = C.frost; ctx.beginPath(); ctx.arc(fx + sg * (0.1 + u * 0.16 * (1 + hash(i + 2))), FY - 0.01 - u * 0.09 * (1 + hash(i + 5)) + u * u * 0.08, r, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  if (st === 'dizzy' && !calm && !frozen) dizzyStars(ctx, hx * s, -0.55 * s, s * 0.26, s * 0.07, t, { layer: 'all', size: s * 0.05 });
}

// the boss bar chip: brow, tusks and trunk in a circle of radius r (screen space, origin at its centre)
export function drawMammothEmblem(ctx, r) {
  ctx.save(); ctx.scale(r, r); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.fillStyle = C.fur; ctx.beginPath(); ctx.ellipse(0, -0.1, 0.62, 0.66, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = C.furHi; ctx.beginPath(); ctx.ellipse(-0.14, -0.4, 0.36, 0.26, -0.3, 0, TAU); ctx.fill();
  ctx.fillStyle = C.frost; ctx.beginPath(); ctx.ellipse(0, -0.78, 0.5, 0.2, 0, 0, TAU); ctx.fill();
  for (const sg of [-1, 1]) {
    ctx.strokeStyle = C.ivoryLine; ctx.lineWidth = 0.24; ctx.beginPath(); ctx.moveTo(sg * 0.26, 0.2); ctx.quadraticCurveTo(sg * 0.42, 0.86, sg * 0.86, 0.42); ctx.stroke();
    ctx.strokeStyle = C.ivory; ctx.lineWidth = 0.15; ctx.stroke();
    ctx.fillStyle = C.frost; ctx.beginPath(); ctx.moveTo(sg * 0.06, -0.2); ctx.lineTo(sg * 0.5, -0.4); ctx.lineTo(sg * 0.46, -0.22); ctx.lineTo(sg * 0.08, -0.08); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1c0d08'; ctx.beginPath(); ctx.arc(sg * 0.24, -0.1, 0.07, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = C.skinLo; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.moveTo(0, 0.1); ctx.quadraticCurveTo(0, 0.6, 0.12, 0.84); ctx.stroke();
  ctx.strokeStyle = C.skin; ctx.lineWidth = 0.2; ctx.stroke();
  ctx.restore();
}
