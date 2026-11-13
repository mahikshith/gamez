// Mama: the mother hen in the strike chicks' style (strike.js, the Frost Chick rig). Same construction language grown up:
// a pear body in three-quarter view facing +x, form() shading under the one top-left light, a thin same-hue line, tufted
// down at the neck, chest and rump, the chicks' eye / lid / beak recipe. But an adult: a heavy chest and rump, a fanned tail,
// a red comb and wattle where the chicks wear their eggshell, sturdy legs, and two real wings (shoulder, elbow, a fan of
// feather fingers) that act like arms. Art only: nothing here is wired into the game yet.
//   drawMama(ctx, x, y, s, t, o)   feet at (x, y); s = her height, feet to the top of the head (the comb adds ~0.13 s)
//   mamaLaunch(u)                   the pose for the wing launch at u 0..1 (0.62 s), plus where the chick is
// A riding strike chick is drawn at s * MAMA_CHICK, so she stands about 2.3 chicks tall.
import { form, contact, blinkAt, clamp, lerp, ss, limb } from './castkit.js';

const TAU = Math.PI * 2;
export const MAMA_CHICK = 0.31;
export const MAMA_LAUNCH_T = 0.62;
const P = {
  base: '#ffedcc', lo: '#e3b97c', hi: '#fffaf0', line: '#9a6a34', down: '#fffdf6', downLo: '#ecc994',
  wing: '#f9dfb0', wingLo: '#d9a964', wingHi: '#fff3da', far: '#e2ba80', farLo: '#bf8e50',
  comb: '#e5322d', combLo: '#aa1622', combHi: '#ff6f55', combLine: '#74101a',
  brow: '#56300f', lid: '#f0cd96', white: '#ffffff', eyeSh: '#e2d6c6', iris: '#8a3c0c', irisHi: '#f09a2a', pupil: '#1a0d06',
  beak: '#ffb21e', beakHi: '#ffe27e', beakLo: '#e07a10', beakLine: '#9a4a0a', mouth: '#5a1022', tongue: '#ff7282', teeth: '#fffdf2',
  tear: '#bfe9ff', tearLine: '#3f8fd0',
};
// The face: lid / low = upper / lower lid 0..1; brow = inward tilt (rad, negative = worried); cock lifts the near brow; by =
// brows raised; pup = pupil size; open = beak; shut: 1 scrunched > <, 2 happy arcs, 3 content (lashes down). The body: hx, hy
// = the head pushed out on its neck; ha = head tilt; pf = chest puffed; cb = comb (1 up .. -1 flopped); tl = tail (1 perked
// .. -1 dropped); sq / ln = a squash and a lean of its own; wN / wF = the near / far wing [shoulder, elbow, fan].
// Wing angles: 0 hangs straight down, + swings forward (pi/2 points ahead), - swings back, pi is straight up.
const MOODS = {
  idle: { lid: 0.44, low: 0, brow: 0.2, cock: 0.6, by: 0, pup: 1, open: 0, grit: 0, smirk: 0.5, shut: 0, tears: 0, hx: 0, hy: 0, ha: 0, pf: 0, cb: 0, tl: 0, sq: 0, ln: 0, wN: [-1.0, 2.25, 0], wF: [-0.6, -0.5, 0] },
  proud: { lid: 0.5, low: 0, brow: -0.1, cock: 0, by: 0.012, pup: 1, open: 0, grit: 0, smirk: 1, shut: 3, tears: 0, hx: -0.035, hy: -0.035, ha: -0.16, pf: 0.05, cb: 0.5, tl: 0.8, sq: -0.06, ln: -0.07, wN: [-1.05, 2.3, 0], wF: [1.05, -2.3, 0] },
  worried: { lid: 0.06, low: 0.1, brow: -0.5, cock: 0, by: 0.03, pup: 0.6, open: 0.22, grit: 1, smirk: 0, shut: 0, tears: 0, hx: -0.03, hy: 0.015, ha: 0.08, pf: -0.02, cb: -0.5, tl: -0.6, sq: 0.08, ln: -0.04, wN: [0.75, 0.95, 0.35], wF: [-0.6, -0.5, 0] },
  gasp: { lid: 0, low: 0, brow: -0.2, cock: 0, by: 0.06, pup: 0.3, open: 1, grit: 0, smirk: 0, shut: 0, tears: 0, hx: -0.02, hy: -0.05, ha: -0.1, pf: 0, cb: 1, tl: 1, sq: -0.14, ln: -0.1, wN: [-2.05, -0.35, 1], wF: [2.0, 0.4, 1] },
  angry: { lid: 0.34, low: 0.3, brow: 0.62, cock: 0, by: -0.01, pup: 0.8, open: 0.2, grit: 1, smirk: 0, shut: 0, tears: 0, hx: 0.06, hy: 0.035, ha: 0.12, pf: 0.02, cb: 0.7, tl: 0.6, sq: 0.06, ln: 0.12, wN: [1.4, -0.1, 0.1], wF: [1.05, -2.3, 0] },
  cry: { lid: 0.5, low: 0.3, brow: -0.6, cock: 0, by: 0.02, pup: 1, open: 0.85, grit: 0, smirk: 0, shut: 1, tears: 1, hx: 0.02, hy: 0.03, ha: -0.22, pf: -0.04, cb: -1, tl: -1, sq: 0.1, ln: 0, wN: [-0.8, -0.15, 0.25], wF: [-0.6, -0.3, 0] },
  cheer: { lid: 0.3, low: 0.3, brow: -0.15, cock: 0, by: 0.04, pup: 1, open: 0.9, grit: 0, smirk: 0, shut: 2, tears: 0, hx: 0, hy: -0.03, ha: -0.14, pf: 0.03, cb: 0.8, tl: 1, sq: -0.12, ln: -0.04, wN: [-2.45, 0.4, 1], wF: [2.5, -0.35, 1] },
  smug: { lid: 0.52, low: 0.42, brow: -0.1, cock: 1, by: 0, pup: 1, open: 0, grit: 0, smirk: 1, shut: 0, tears: 0, hx: -0.02, hy: -0.01, ha: -0.1, pf: 0.04, cb: 0.3, tl: 0.5, sq: 0, ln: -0.05, wN: [0.8, 0.9, 0.45], wF: [1.05, -2.3, 0] },
};
const mix = (a, b, k) => (Array.isArray(a) ? a.map((v, i) => lerp(v, b[i], k)) : lerp(a, b, k));
function moodOf(m) {
  if (!Array.isArray(m)) return MOODS[m] || MOODS.idle;
  const a = MOODS[m[0]] || MOODS.idle, b = MOODS[m[1]] || MOODS.idle, k = clamp(m[2], 0, 1), r = {};
  for (const f in a) r[f] = mix(a[f], b[f], k);
  r.shut = k > 0.5 ? b.shut : a.shut; r.grit = k > 0.5 ? b.grit : a.grit;
  return r;
}

// ---------------------------------------------------------------- geometry shared by the drawing and the launch
const SH_N = [-0.05, -0.5], SH_F = [0.25, -0.5], L1 = 0.15, L2 = 0.12, SEAT = [-0.2, -0.66];
const wingOf = (w, d) => (w ? { a: w.a ?? d[0], bend: w.bend ?? d[1], open: w.open ?? d[2] } : { a: d[0], bend: d[1], open: d[2] });
function wingGeo(sh, w) { // elbow, wrist, the palm (where a chick would sit), in s units
  const b = w.a + w.bend, el = [sh[0] + Math.sin(w.a) * L1, sh[1] + Math.cos(w.a) * L1], wr = [el[0] + Math.sin(b) * L2, el[1] + Math.cos(b) * L2];
  return { el, wr, b, palm: [wr[0] + Math.sin(b) * 0.1, wr[1] + Math.cos(b) * 0.1] };
}
// a point of her body (s units, feet at the origin) after the squash and the lean
function bodyPt(px, py, sq, ln) {
  const x = px * (1 + sq * 0.3), y = py * (1 - sq * 0.34), c = Math.cos(ln), n = Math.sin(ln);
  return [x * c - y * n, x * n + y * c];
}

// ---------------------------------------------------------------- parts
function mBody(ctx, s, hx, hy, pf) { // the pear: a head on a thick feathered neck, a heavy chest, a full rump
  const X = (x) => (x + hx) * s, Y = (y) => (y + hy) * s, L = (x, y) => ctx.lineTo(x * s, y * s);
  ctx.beginPath();
  ctx.moveTo(X(0.1), Y(-1.0));
  ctx.bezierCurveTo(X(0.27), Y(-1.0), X(0.365), Y(-0.89), X(0.355), Y(-0.76));
  ctx.bezierCurveTo(X(0.35), Y(-0.69), (0.29 + hx * 0.5) * s, (-0.655 + hy * 0.5) * s, (0.31 + pf * 0.4) * s, -0.6 * s);
  ctx.bezierCurveTo((0.39 + pf) * s, -0.585 * s, (0.49 + pf) * s, -0.5 * s, (0.49 + pf) * s, -0.37 * s);
  ctx.bezierCurveTo((0.49 + pf) * s, -0.24 * s, 0.29 * s, -0.16 * s, 0.04 * s, -0.16 * s);
  ctx.bezierCurveTo(-0.2 * s, -0.16 * s, -0.39 * s, -0.21 * s, -0.42 * s, -0.36 * s);
  L(-0.51, -0.41); L(-0.4, -0.44); L(-0.48, -0.52); L(-0.36, -0.53);
  ctx.bezierCurveTo(-0.31 * s, -0.6 * s, (-0.22 + hx * 0.5) * s, (-0.6 + hy * 0.5) * s, X(-0.16), Y(-0.655));
  ctx.lineTo(X(-0.25), Y(-0.67)); ctx.lineTo(X(-0.155), Y(-0.715)); ctx.lineTo(X(-0.225), Y(-0.765)); ctx.lineTo(X(-0.14), Y(-0.79));
  ctx.bezierCurveTo(X(-0.15), Y(-0.91), X(-0.06), Y(-1.0), X(0.1), Y(-1.0));
  ctx.closePath();
}
// one feather: a leaf from (x, y) along angle a (0 = down, + forward), built in place so the light stays top-left
function leaf(ctx, x, y, a, L, hw, o) {
  const dx = Math.sin(a), dy = Math.cos(a), nx = dy, ny = -dx;
  form(ctx, () => {
    ctx.beginPath(); ctx.moveTo(x + nx * hw, y + ny * hw);
    ctx.quadraticCurveTo(x + dx * L * 0.82 + nx * hw * 1.35, y + dy * L * 0.82 + ny * hw * 1.35, x + dx * L, y + dy * L);
    ctx.quadraticCurveTo(x + dx * L * 0.82 - nx * hw * 1.35, y + dy * L * 0.82 - ny * hw * 1.35, x - nx * hw, y - ny * hw);
    ctx.closePath();
  }, o);
}
// a wing that acts like an arm: upper arm, forearm, and a fan of feather fingers off the wrist
function mWing(ctx, s, sh, w, far, lw) {
  const g = wingGeo(sh, w), pts = [[sh[0] * s, sh[1] * s], [g.el[0] * s, g.el[1] * s], [g.wr[0] * s, g.wr[1] * s]], rad = [0.1 * s, 0.08 * s, 0.058 * s];
  const lo = far ? P.farLo : P.wingLo, base = far ? P.far : P.wing, hi = far ? P.wing : P.wingHi, open = clamp(w.open, 0, 1), n = 5;
  const fo = { d: s * 0.017, lo, base, hi, line: P.line, lw, noWeight: true };
  // the secondaries hang off the forearm's trailing edge (whichever side is under the wing as it swings round)
  const tr = g.b - (0.85 + open * 0.2) * Math.tanh(3 * Math.sin(g.b));
  for (const [k, L] of [[-0.5, 0.15], [0.0, 0.18], [0.5, 0.21], [0.95, 0.23]]) leaf(ctx, lerp(pts[1][0], pts[2][0], k), lerp(pts[1][1], pts[2][1], k), lerp(tr, g.b, k * 0.45), L * s, 0.05 * s, fo);
  for (let j = 0; j < n; j++) { // the primaries are her fingers: outer ones first, so the middle ones sit on top
    const i = [0, 4, 1, 3, 2][j], k = i / (n - 1) - 0.5, a = g.b + k * lerp(0.5, 1.7, open), L = (0.28 - Math.abs(k) * 0.09) * (1 + open * 0.1) * s;
    leaf(ctx, pts[2][0] - Math.sin(g.b) * 0.02 * s, pts[2][1] - Math.cos(g.b) * 0.02 * s, a, L, 0.052 * s, fo);
  }
  const arm = (grow) => { // the union of the joints and the bones, wound one way so it fills and clips as one shape
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const r = rad[i] + grow, [x, y] = pts[i];
      ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
      if (i < 2) { const r2 = rad[i + 1] + grow, [x2, y2] = pts[i + 1], dx = x2 - x, dy = y2 - y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l; ctx.moveTo(x - nx * r, y - ny * r); ctx.lineTo(x2 - nx * r2, y2 - ny * r2); ctx.lineTo(x2 + nx * r2, y2 + ny * r2); ctx.lineTo(x + nx * r, y + ny * r); ctx.closePath(); }
    }
  };
  const d = s * 0.03;
  arm(lw * 0.9); ctx.fillStyle = P.line; ctx.fill();
  ctx.save(); arm(0); ctx.fillStyle = lo; ctx.fill(); ctx.clip();
  ctx.translate(-d * 0.55, -d); arm(0); ctx.fillStyle = hi; ctx.fill(); ctx.clip();
  ctx.translate(d * 0.36, d * 0.65); arm(0); ctx.fillStyle = base; ctx.fill();
  ctx.restore();
}
function mEye(ctx, s, E, M, lk, bl, lw) { // the chicks' eye: a tall white, a two-tone iris, a heavy lid whose edge carries the attitude
  const { cx, cy, rx, ry, sd } = E, lid = lerp(M.lid - (sd > 0 ? M.cock * 0.16 : 0), 1.04, bl), ang = M.brow * 0.8 * (sd > 0 ? 1 - M.cock * 0.7 : 1);
  const yb = cy - ry * 1.08 + 2 * ry * lid, sl = sd * Math.tan(ang), Y = (x) => yb + (x - cx) * sl;
  const el = () => { ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); };
  const edge = Math.max(1, s * 0.012);
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (M.shut) {
    el(); ctx.fillStyle = P.lid; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = P.line; ctx.stroke();
    ctx.beginPath();
    if (M.shut === 1) { ctx.moveTo(cx - sd * rx * 0.6, cy - ry * 0.3); ctx.lineTo(cx + sd * rx * 0.55, cy + ry * 0.12); ctx.lineTo(cx - sd * rx * 0.6, cy + ry * 0.5); } // > <
    else if (M.shut === 2) { ctx.moveTo(cx - rx * 0.7, cy + ry * 0.3); ctx.quadraticCurveTo(cx, cy - ry * 0.75, cx + rx * 0.7, cy + ry * 0.3); } // a laughing arc
    else { ctx.moveTo(cx - rx * 0.72, cy + ry * 0.05); ctx.quadraticCurveTo(cx, cy + ry * 0.62, cx + rx * 0.72, cy + ry * 0.05); for (const k of [-0.5, 0, 0.5]) { ctx.moveTo(cx + k * rx, cy + ry * (0.33 - Math.abs(k) * 0.3)); ctx.lineTo(cx + k * rx * 1.35, cy + ry * (0.6 - Math.abs(k) * 0.3)); } } // content, lashes down
    ctx.lineWidth = Math.max(1.2, s * 0.017); ctx.strokeStyle = P.brow; ctx.stroke();
  } else {
    el(); ctx.fillStyle = P.white; ctx.fill(); ctx.save(); ctx.clip();
    ctx.beginPath(); ctx.ellipse(cx + rx * 0.16, cy + ry * 0.2, rx, ry, 0, 0, TAU); ctx.rect(cx - rx * 2, cy - ry * 2, rx * 4, ry * 4); ctx.fillStyle = P.eyeSh; ctx.fill('evenodd');
    const ir = s * 0.064 * (0.55 + 0.45 * M.pup) * (sd > 0 ? 1 : 0.84), pxx = cx + lk.x * (rx - ir * 0.8) * 0.8 + sd * rx * 0.06, pyy = Math.max(cy + lk.y * ry * 0.3, Math.min(cy + ry * 0.4, Y(pxx) + ir * 0.55));
    ctx.beginPath(); ctx.arc(pxx, pyy, ir, 0, TAU); ctx.fillStyle = P.iris; ctx.fill();
    ctx.beginPath(); ctx.arc(pxx, pyy + ir * 0.25, ir * 0.72, 0, TAU); ctx.fillStyle = P.irisHi; ctx.fill();
    ctx.beginPath(); ctx.arc(pxx, pyy, ir * 0.52 * (1.25 - 0.25 * M.pup), 0, TAU); ctx.fillStyle = P.pupil; ctx.fill();
    ctx.beginPath(); ctx.arc(pxx - ir * 0.38, pyy - ir * 0.4, ir * 0.27, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - rx * 2, Y(cx - rx * 2)); ctx.lineTo(cx + rx * 2, Y(cx + rx * 2)); ctx.lineTo(cx + rx * 2, cy - ry * 2); ctx.lineTo(cx - rx * 2, cy - ry * 2); ctx.closePath(); ctx.fillStyle = P.lid; ctx.fill();
    ctx.lineWidth = edge; ctx.strokeStyle = P.brow; ctx.stroke();
    if (M.low > 0.01) {
      const yl = cy + ry - 2 * ry * M.low;
      ctx.beginPath(); ctx.moveTo(cx - rx * 1.4, cy + ry * 1.3); ctx.lineTo(cx - rx * 1.4, yl + ry * 0.3); ctx.quadraticCurveTo(cx, yl - ry * 0.4, cx + rx * 1.4, yl + ry * 0.3); ctx.lineTo(cx + rx * 1.4, cy + ry * 1.3); ctx.closePath();
      ctx.fillStyle = P.base; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = P.line; ctx.stroke();
    }
    ctx.restore();
    el(); ctx.lineWidth = lw; ctx.strokeStyle = P.line; ctx.stroke();
  }
  ctx.restore();
}
function mBrow(ctx, s, E, M) { // a feather brow over each eye: thick at the bridge, tapering out
  const { cx, cy, rx, ry, sd } = E, ang = M.brow * (sd > 0 ? 1 - M.cock * 0.75 : 1), lid = M.shut ? 0.3 : M.lid - (sd > 0 ? M.cock * 0.16 : 0);
  const y0 = cy - ry * 1.27 + ry * Math.max(0, lid - 0.15) * 0.9 - (M.by + (sd > 0 ? M.cock * 0.045 : 0)) * s, tn = Math.tan(clamp(ang, -0.9, 0.9));
  const xi = cx + sd * rx * 1.0, xo = cx - sd * rx * 1.05, yi = y0 + tn * rx * 1.1, yo = y0 - tn * rx * 0.75 + ry * 0.1, th = Math.max(1.6, s * 0.03) * (sd > 0 ? 1 : 0.85), ar = ry * (0.2 + (sd > 0 ? M.cock * 0.16 : 0));
  ctx.beginPath(); ctx.moveTo(xo, yo); ctx.quadraticCurveTo(cx, (yi + yo) / 2 - ar - th * 0.6, xi, yi - th * 0.55); ctx.lineTo(xi + sd * th * 0.15, yi + th * 0.5); ctx.quadraticCurveTo(cx, (yi + yo) / 2 - ar + th * 0.55, xo, yo); ctx.closePath();
  ctx.fillStyle = P.brow; ctx.fill();
}
function mBeak(ctx, s, M, lw) { // the chicks' beak (its own s): the lower half swings on its hinge, teeth when she grits
  const open = clamp(M.open, 0, 1), a = open * 0.95, hx = -0.09 * s, hy = 0.035 * s, c = Math.cos(a), sn = Math.sin(a);
  const R = (x, y) => [hx + (x * s - hx) * c - (y * s - hy) * sn, hy + (x * s - hx) * sn + (y * s - hy) * c];
  ctx.save(); ctx.rotate(-0.06 * M.smirk); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const t0 = R(0.15, 0.045), t1 = R(0.07, 0.14), t3 = R(-0.07, 0.12), h0 = R(-0.1, 0.04);
  const ua = -open * 0.42, uc = Math.cos(ua), us = Math.sin(ua), U = (x, y) => [hx + (x * s - hx) * uc - (y * s - hy) * us, hy + (x * s - hx) * us + (y * s - hy) * uc];
  if (open > 0.04) {
    const u0 = U(0.2, 0.035);
    ctx.beginPath(); ctx.moveTo(hx - 0.03 * s, hy - 0.01 * s); ctx.lineTo(u0[0], u0[1]); ctx.lineTo(t0[0], t0[1]); ctx.lineTo(t3[0], t3[1]); ctx.closePath(); ctx.fillStyle = P.mouth; ctx.fill();
    ctx.save(); ctx.clip();
    if (M.grit) { ctx.fillStyle = P.teeth; ctx.fillRect(-0.2 * s, -0.2 * s, 0.6 * s, 0.6 * s); ctx.strokeStyle = '#b9a98a'; ctx.lineWidth = lw; ctx.beginPath(); for (let i = 0; i < 4; i++) { const x = (-0.04 + i * 0.06) * s; ctx.moveTo(x, -0.05 * s); ctx.lineTo(x + 0.01 * s, 0.2 * s); } ctx.stroke(); }
    else { const q = R(0.03, 0.1); ctx.beginPath(); ctx.ellipse(q[0], q[1], 0.09 * s, 0.05 * s, a, 0, TAU); ctx.fillStyle = P.tongue; ctx.fill(); }
    ctx.restore();
  }
  ctx.beginPath(); ctx.moveTo(h0[0], h0[1]); ctx.lineTo(t0[0], t0[1]); ctx.quadraticCurveTo(t1[0], t1[1], t3[0], t3[1]); ctx.closePath();
  ctx.fillStyle = P.beakLo; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = P.beakLine; ctx.stroke();
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(ua); ctx.translate(-hx, -hy);
  const up = () => { ctx.beginPath(); ctx.moveTo(-0.12 * s, 0.01 * s); ctx.quadraticCurveTo(-0.04 * s, -0.11 * s, 0.06 * s, -0.07 * s); ctx.lineTo(0.21 * s, 0.035 * s); ctx.lineTo(-0.1 * s, 0.05 * s); ctx.closePath(); };
  form(ctx, up, { d: s * 0.035, lo: P.beakLo, base: P.beak, hi: P.beakHi, line: P.beakLine, lw, noWeight: true, hiK: 0.7 });
  ctx.restore();
  if (M.smirk > 0.05 && open < 0.3) { ctx.beginPath(); ctx.moveTo(-0.1 * s, 0.045 * s); ctx.quadraticCurveTo(-0.18 * s, 0.06 * s, -0.22 * s, (0.045 - 0.11 * M.smirk) * s); ctx.lineWidth = Math.max(1, s * 0.028); ctx.strokeStyle = P.brow; ctx.stroke(); }
  ctx.restore();
}
function mComb(ctx, s, cb, whip, lw) { // three lobes; it stands when she is up, flops when she is down, whips with her head
  ctx.save(); ctx.translate(0.1 * s, -0.955 * s); ctx.transform(1, 0, -whip * 0.75 + Math.min(0, cb) * 0.5, 1 + cb * 0.16, 0, 0); ctx.scale(0.84, 1.06);
  const p = () => {
    ctx.beginPath(); ctx.moveTo(-0.17 * s, 0.03 * s);
    ctx.bezierCurveTo(-0.24 * s, -0.08 * s, -0.15 * s, -0.16 * s, -0.08 * s, -0.1 * s);
    ctx.bezierCurveTo(-0.08 * s, -0.22 * s, 0.06 * s, -0.24 * s, 0.07 * s, -0.12 * s);
    ctx.bezierCurveTo(0.11 * s, -0.2 * s, 0.22 * s, -0.17 * s, 0.19 * s, -0.06 * s);
    ctx.lineTo(0.17 * s, 0.04 * s); ctx.closePath();
  };
  form(ctx, p, { d: s * 0.022, lo: P.combLo, base: P.comb, hi: P.combHi, line: P.combLine, lw, noWeight: true, hiK: 0.6 });
  ctx.restore();
}
function mWattle(ctx, s, sw, lw) {
  for (const [x, r, far] of [[0.05, 0.85, 1], [0, 1, 0]]) {
    ctx.save(); ctx.translate(x * s, 0); ctx.rotate(sw * (far ? 0.8 : 1)); ctx.scale(r, r);
    form(ctx, () => { ctx.beginPath(); ctx.moveTo(-0.028 * s, -0.01 * s); ctx.bezierCurveTo(-0.075 * s, 0.07 * s, -0.045 * s, 0.14 * s, 0.0, 0.14 * s); ctx.bezierCurveTo(0.05 * s, 0.14 * s, 0.07 * s, 0.07 * s, 0.03 * s, -0.01 * s); ctx.closePath(); },
      { d: s * 0.016, lo: P.combLo, base: far ? P.combLo : P.comb, hi: far ? P.comb : P.combHi, line: P.combLine, lw, noWeight: true, hiK: 0.6 });
    ctx.restore();
  }
}
function mFoot(ctx, s, fx, lw) { // the chicks' big planted foot, grown up
  const f = 0.66 * s, X = (x) => fx * s + x * f, Y = (y) => -0.036 * s + y * f;
  ctx.beginPath(); ctx.moveTo(X(-0.07), Y(0)); ctx.quadraticCurveTo(X(-0.03), Y(-0.06), X(0.05), Y(-0.045));
  ctx.lineTo(X(0.21), Y(-0.03)); ctx.lineTo(X(0.12), Y(-0.005)); ctx.lineTo(X(0.23), Y(0.02)); ctx.lineTo(X(0.1), Y(0.023)); ctx.lineTo(X(0.16), Y(0.055)); ctx.lineTo(X(-0.05), Y(0.04)); ctx.closePath();
  ctx.fillStyle = P.beak; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = P.beakLine; ctx.stroke();
}

// ---------------------------------------------------------------- the hen
// o: { mood (a name or [from, to, k]), squash (about the feet; negative stretches her up), lean (rad, + forward), look {x, y},
//      blink 0..1, shadow, flip, lift (s units off the ground: a hop), wingN / wingF { a, bend, open } (override the mood's
//      wings), comb / tail (-1..1: a whip on top of the mood's), still (true = no idle breathing or sway) }
export function drawMama(ctx, x, y, s, t, o = {}) {
  const M = moodOf(o.mood || 'idle'), lw = Math.max(1, s * 0.0072), live = o.still ? 0 : 1, br = Math.sin(t * 2.1) * live, sw = Math.sin(t * 2.6) * live;
  const sq = clamp((o.squash || 0) + M.sq + br * 0.012, -0.6, 0.8), ln = (o.lean || 0) + M.ln, lk = o.look || { x: 0.5, y: 0 };
  const bl = M.shut ? 0 : (o.blink ?? blinkAt(t, 71) * live), lift = (o.lift || 0) * s;
  const wN = wingOf(o.wingN, M.wN), wF = wingOf(o.wingF, M.wF), cw = o.comb || 0, tw = o.tail || 0;
  const hx = M.hx, hy = M.hy + br * 0.004, pf = M.pf + br * 0.006;
  ctx.save(); ctx.translate(x, y); if (o.flip) ctx.scale(-1, 1);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (o.shadow) contact(ctx, 0.02 * s, 0, s * 0.42 * (1 + sq * 0.3) * (1 - Math.min(0.5, lift / s)), s * 0.045, 0.25);
  ctx.translate(0, -lift);
  for (const fx of [-0.15, 0.13]) { // sturdy legs: the shank runs from the planted foot up into the belly feathers
    const hip = bodyPt(fx * 0.85 + 0.02, -0.23, sq, ln);
    limb(ctx, [[hip[0] * s, hip[1] * s], [(fx + 0.01) * s, -0.04 * s]], [0.03 * s, 0.024 * s], P.beakLo, P.beakLine, lw);
    limb(ctx, [[hip[0] * s - 0.006 * s, hip[1] * s], [(fx + 0.004) * s, -0.045 * s]], [0.017 * s, 0.013 * s], P.beak, null, 0);
    mFoot(ctx, s, fx, lw);
  }
  ctx.rotate(ln); ctx.scale(1 + sq * 0.3, 1 - sq * 0.34);
  // the fanned tail: five feathers off the rump
  for (const i of [4, 0, 3, 1, 2]) {
    const a = -1.72 - i * 0.27 - M.tl * 0.22 + (i - 2) * M.tl * 0.05 + tw * 0.5 + sw * 0.03, L = (0.4 - Math.abs(i - 2) * 0.035) * s;
    leaf(ctx, -0.34 * s, -0.43 * s, a, L, 0.075 * s, { d: s * 0.024, lo: P.wingLo, base: P.wing, hi: P.wingHi, line: P.line, lw, noWeight: true });
  }
  mWing(ctx, s, SH_F, wF, true, lw);
  ctx.save(); ctx.translate(hx * s, hy * s); mComb(ctx, s, M.cb, cw + sw * 0.03, lw); ctx.restore();
  form(ctx, () => mBody(ctx, s, hx, hy, pf), { d: s * 0.055, lo: P.lo, base: P.base, hi: P.hi, line: P.line, lw, noWeight: true, hiK: 0.5,
    inner: (c) => {
      // the downy chest: the chicks' ruff of pale tufts, grown into a bib
      const T = [[0.7, -0.57], [0.37, -0.53], [0.42, -0.455], [0.28, -0.45], [0.34, -0.365], [0.19, -0.36], [0.26, -0.275], [0.09, -0.27], [0.15, -0.195], [-0.04, -0.14], [0.7, -0.1]];
      for (const [ox, oy, col] of [[0.014, 0.02, P.downLo], [0, 0, P.down]]) { c.beginPath(); T.forEach(([px, py], i) => (i ? c.lineTo((px + ox + pf) * s, (py + oy) * s) : c.moveTo((px + ox + pf) * s, (py + oy) * s))); c.closePath(); c.fillStyle = col; c.fill(); }
      c.strokeStyle = P.lo; c.lineWidth = Math.max(0.8, s * 0.011); c.lineJoin = 'round'; c.lineCap = 'round'; c.beginPath();
      const H = [[-0.2, -0.635], [-0.13, -0.585], [-0.08, -0.65], [0.0, -0.59], [0.055, -0.655], [0.13, -0.6], [0.19, -0.66], [0.25, -0.61], [0.31, -0.645]]; // the hackle: a feather collar
      H.forEach(([px, py], i) => (i ? c.lineTo((px + hx * 0.6) * s, (py + hy * 0.6) * s) : c.moveTo((px + hx * 0.6) * s, (py + hy * 0.6) * s)));
      for (const [px, py] of [[-0.3, -0.3], [-0.2, -0.22], [-0.33, -0.2]]) { c.moveTo((px - 0.035) * s, (py - 0.022) * s); c.lineTo(px * s, (py + 0.022) * s); c.lineTo((px + 0.035) * s, (py - 0.022) * s); } // rump fluff
      c.stroke();
    } });
  // the face, on the head (which the mood pushes about on the neck)
  ctx.save(); ctx.translate((0.1 + hx) * s, (-0.8 + hy) * s); ctx.rotate(M.ha); ctx.scale(0.93, 0.93); ctx.translate(-0.1 * s, 0.8 * s);
  ctx.save(); ctx.translate(0.262 * s, -0.672 * s); mWattle(ctx, s, -cw * 0.5 + sw * 0.04 - M.ha * 0.6, lw); ctx.restore();
  const e0 = { cx: 0.243 * s, cy: -0.835 * s, rx: 0.07 * s, ry: 0.102 * s, sd: -1 }, e1 = { cx: 0.083 * s, cy: -0.83 * s, rx: 0.1 * s, ry: 0.116 * s, sd: 1 };
  mEye(ctx, s, e0, M, lk, bl, lw); mEye(ctx, s, e1, M, lk, bl, lw);
  mBrow(ctx, s, e0, M); mBrow(ctx, s, e1, M);
  ctx.save(); ctx.translate(0.292 * s, -0.7 * s); mBeak(ctx, s * 0.64, M, lw); ctx.restore();
  if (M.tears > 0.01) { // tears fly off both eyes in arcs
    for (const e of [e0, e1]) for (let i = 0; i < 3; i++) {
      const u = (t * 1.5 + i / 3 + (e.sd > 0 ? 0 : 0.17)) % 1, dx = -e.sd * (0.02 + u * 0.2) * s + (e.sd > 0 ? -e.rx : e.rx) * 0.5, dy = (-0.03 - u * 0.2 + u * u * 0.44) * s, r = s * 0.026 * (1 - u * 0.4) * M.tears;
      ctx.save(); ctx.globalAlpha *= clamp((1 - u) * 3, 0, 1); ctx.translate(e.cx + dx, e.cy + dy); ctx.rotate(-e.sd * (0.9 - u * 1.6));
      ctx.beginPath(); ctx.moveTo(0, -r * 1.7); ctx.bezierCurveTo(r * 1.1, -r * 0.2, r, r, 0, r); ctx.bezierCurveTo(-r, r, -r * 1.1, -r * 0.2, 0, -r * 1.7); ctx.closePath();
      ctx.fillStyle = P.tear; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = P.tearLine; ctx.stroke();
      ctx.beginPath(); ctx.arc(-r * 0.3, r * 0.1, r * 0.28, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
    }
  }
  ctx.restore();
  mWing(ctx, s, SH_N, wN, false, lw);
  ctx.restore();
}

// ---------------------------------------------------------------- the wing launch
// u 0..1 over MAMA_LAUNCH_T (0.62 s). The charged chick drops onto her back (she dips) -> she scoops the near wing down and
// back under it, coiling, eyes narrowing -> she bats it up and over, stretching into the swing, comb and tail whipping ->
// she holds the follow-through with a smug look after it, then settles. Returns drawMama's options, plus `chick`: where the
// chick is ({ x, y } of its feet in her s units from her feet, facing +x; held = still on her; rot, squash, stretch, mood).
const key = (u, K) => { // smooth keys [[u, v], ...]
  if (u <= K[0][0]) return K[0][1];
  for (let i = 1; i < K.length; i++) if (u <= K[i][0]) return lerp(K[i - 1][1], K[i][1], ss(K[i - 1][0], K[i][0], u));
  return K[K.length - 1][1];
};
const REL = 0.5; // she lets go here
function launchPose(u) {
  const squash = key(u, [[0, 0], [0.07, 0.32], [0.15, 0.08], [0.37, 0.2], [0.47, -0.3], [0.6, -0.12], [0.8, 0.06], [1, 0]]);
  const lean = key(u, [[0, 0], [0.08, -0.03], [0.37, -0.2], [0.48, 0.05], [0.6, 0.06], [0.86, -0.02], [1, 0]]);
  const a = key(u, [[0, -1.0], [0.1, -0.85], [0.3, -1.55], [0.4, -1.45], [0.5, -3.6], [0.58, -5.0], [0.66, -4.8], [0.84, -4.85], [1, -1.0 - TAU]]);
  const bend = key(u, [[0, 2.25], [0.12, 1.2], [0.3, -0.75], [0.4, -0.95], [0.5, -0.1], [0.58, 0.35], [0.66, -0.1], [0.84, 0], [1, 2.25]]);
  const open = key(u, [[0, 0], [0.3, 0.5], [0.4, 0.3], [0.5, 1], [0.84, 1], [1, 0]]);
  const fa = key(u, [[0, -0.6], [0.36, -0.3], [0.5, -1.9], [0.8, -1.0], [1, -0.6]]), fb = key(u, [[0, -0.5], [0.36, -0.6], [0.5, -0.2], [1, -0.5]]);
  const mood = u < 0.08 ? ['idle', 'gasp', Math.sin((u / 0.08) * Math.PI) * 0.55] : u < 0.38 ? ['idle', 'angry', ss(0.1, 0.32, u)] : u < 0.52 ? 'angry' : u < 0.64 ? ['angry', 'smug', ss(0.52, 0.62, u)] : u < 0.88 ? 'smug' : ['smug', 'idle', ss(0.88, 1, u)];
  return {
    mood, squash, lean, still: true, blink: 0,
    wingN: { a, bend, open }, wingF: { a: fa, bend: fb, open: key(u, [[0, 0], [0.4, 0], [0.5, 0.9], [0.8, 0.3], [1, 0]]) },
    comb: key(u, [[0, 0], [0.07, 0.6], [0.2, -0.2], [0.37, -0.35], [0.47, 1], [0.58, -0.8], [0.72, 0.3], [0.86, -0.1], [1, 0]]),
    tail: key(u, [[0, 0], [0.07, 0.5], [0.37, 0.4], [0.47, -0.9], [0.6, 0.6], [0.76, -0.2], [1, 0]]),
    look: { x: key(u, [[0, 0.5], [0.07, -0.6], [0.36, 0.9], [1, 0.8]]), y: key(u, [[0, 0], [0.07, -0.5], [0.36, 0.2], [0.5, -0.8], [0.88, -0.9], [1, 0]]) },
  };
}
function palmAt(p) { const g = wingGeo(SH_N, p.wingN), M = moodOf(p.mood); return bodyPt(g.palm[0], g.palm[1] - 0.045, p.squash + M.sq, p.lean + M.ln); }
export function mamaLaunch(u) {
  u = clamp(u, 0, 1);
  const p = launchPose(u), M = moodOf(p.mood), seat = bodyPt(SEAT[0], SEAT[1], p.squash + M.sq, p.lean + M.ln);
  let c;
  if (u < REL) {
    const k = ss(0.16, 0.32, u), palm = palmAt(p), drop = u < 0.07 ? (1 - u / 0.07) : 0;
    c = { x: lerp(seat[0], palm[0], k), y: lerp(seat[1], palm[1], k) - drop * drop * 0.3, held: true, rot: key(u, [[0, 0], [0.3, -0.25], [0.4, -0.3], [REL, 0.5]]),
      squash: key(u, [[0, -0.2], [0.07, 0.45], [0.16, 0], [0.38, 0.3], [REL, -0.3]]), stretch: 0, mood: u < 0.07 ? 'ready' : u < 0.4 ? 'crouch' : 'yell' };
  } else {
    const p0 = palmAt(launchPose(REL)), v = u - REL; // off the wing: up and out at the villain
    c = { x: p0[0] + v * 5.2, y: p0[1] - v * 3.4, held: false, rot: -0.55, squash: 0, stretch: 0.22, mood: 'yell' };
  }
  p.chick = c;
  return p;
}
