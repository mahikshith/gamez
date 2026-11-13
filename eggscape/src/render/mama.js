// Mama: the mother hen in the strike chicks' style (strike.js, the Frost Chick rig). Same construction language grown up:
// a pear body in three-quarter view facing +x, form() shading under the one top-left light, a thin same-hue line, tufted
// down at the neck, chest and rump, the chicks' eye / lid / beak recipe. But an adult: a proud chest, a heavy rump, a fanned
// tail, a red comb and wattle where the chicks wear their eggshell, sturdy legs, and two real feathered wings (a covert
// patch, a row of secondaries, long primaries that splay and curl like fingers). Art only: not wired into the game yet.
//   drawMama(ctx, x, y, s, t, o)   feet at (x, y); s = her height, feet to the top of the head (the comb adds ~0.13 s)
//   MAMA_ANIMS[name]               { len (s), loop, keys (6 review times), pose(u) -> drawMama options at u seconds }
//   mamaLaunch(u)                  the wing launch at u 0..1 (MAMA_LAUNCH_T): her pose, plus `chick` (where the chick is)
// A riding strike chick is drawn at s * MAMA_CHICK, so she stands about 2.3 chicks tall. Everything is a pure function.
import { form, contact, blinkAt, clamp, lerp, ss, back, limb } from './castkit.js';

const TAU = Math.PI * 2;
export const MAMA_CHICK = 0.31;
export const MAMA_LAUNCH_T = 0.62;
const P = {
  base: '#ffe9c4', lo: '#dcae6e', hi: '#fffaf0', deep: '#c99555', line: '#94632e', down: '#fffdf6', downLo: '#e8c38a',
  wing: '#f7d9a6', wingAlt: '#efc98c', wingLo: '#cf9c56', wingHi: '#fff1d6', far: '#deb47a', farAlt: '#d2a468', farLo: '#b78546',
  comb: '#e5322d', combLo: '#aa1622', combHi: '#ff6f55', combLine: '#74101a',
  brow: '#56300f', lid: '#f0cd96', white: '#ffffff', eyeSh: '#e2d6c6', iris: '#8a3c0c', irisHi: '#f09a2a', pupil: '#1a0d06',
  beak: '#ffb21e', beakHi: '#ffe27e', beakLo: '#e07a10', beakLine: '#9a4a0a', mouth: '#5a1022', tongue: '#ff7282', teeth: '#fffdf2',
  tear: '#bfe9ff', tearLine: '#3f8fd0',
};
// wing poses [shoulder, elbow, fan 0..1, curl 0..1]. Angles: 0 hangs straight down, + swings forward (pi/2 points ahead),
// - swings back, pi is straight up. The fan splays the primaries; the curl closes them toward the palm (a fist).
const FOLD = [-0.75, -0.55, 0, 0], HIDE = [0.9, -2.4, 0, 0.6], HIPN = [-1.0, 2.25, 0.1, 0.35], HIPF = [1.05, -2.3, 0.1, 0.35];
const UPN = [-2.15, 0.25, 1, 0], UPF = [2.3, -0.25, 1, 0], BEAK = [1.6, 0.6, 0.35, 0.3], EYE = [2.75, -0.45, 0.55, 0.15];
const SHRN = [-1.35, -1.0, 0.85, 0], SHRF = [1.35, 1.0, 0.85, 0], CHEST = [0.8, 0.9, 0.45, 0.2];
// The face rig: lid / low = upper / lower lid; brow = inward tilt (negative = worried); cock / cockF raise the near / far brow;
// by = both brows up; pup = pupil size; open = beak; grit = teeth; smirk 1 smile .. -1 frown; cheek = the cheek pushes the eye
// up; shut: 1 scrunched > <, 2 laughing arcs, 3 content (lashes down); tears, sweat, vein, steam, spark = the extras 0..1.
// The body: hx, hy = the head pushed out on its neck; ha = head tilt; pf = chest puffed; cb = comb (1 up .. -1 flopped);
// tl = tail (1 perked .. -1 dropped); sq / ln = a squash and a lean of its own; wN / wF = the near / far wing.
const B = { lid: 0.44, low: 0, brow: 0.2, cock: 0, cockF: 0, by: 0, pup: 1, open: 0, grit: 0, smirk: 0, cheek: 0, shut: 0, tears: 0, sweat: 0, vein: 0, steam: 0, spark: 0, hx: 0, hy: 0, ha: 0, pf: 0, cb: 0, tl: 0, sq: 0, ln: 0, wN: FOLD, wF: HIDE };
const MOODS = {
  idle: { ...B, cock: 0.6, smirk: 0.5 },
  proud: { ...B, lid: 0.5, brow: -0.1, by: 0.012, smirk: 1, cheek: 0.6, shut: 3, hx: -0.03, hy: -0.03, ha: -0.16, pf: 0.04, cb: 0.5, tl: 0.8, sq: -0.06, ln: -0.06, wN: HIPN, wF: HIPF },
  worried: { ...B, lid: 0.06, low: 0.1, brow: -0.5, by: 0.03, pup: 0.6, open: 0.22, grit: 1, sweat: 1, hx: -0.03, hy: 0.015, ha: 0.08, pf: -0.02, cb: -0.5, tl: -0.6, sq: 0.08, ln: -0.04, wN: BEAK },
  gasp: { ...B, lid: 0, brow: -0.2, by: 0.06, pup: 0.3, open: 1, hx: -0.02, hy: -0.05, ha: -0.1, cb: 1, tl: 1, sq: -0.14, ln: -0.1, wN: [-1.75, -0.45, 1, 0], wF: [2.0, 0.4, 1, 0] },
  angry: { ...B, lid: 0.34, low: 0.3, brow: 0.62, by: -0.01, pup: 0.8, open: 0.2, grit: 1, smirk: -0.6, vein: 1, hx: 0.05, hy: 0.03, ha: 0.12, pf: 0.02, cb: 0.7, tl: 0.6, sq: 0.06, ln: 0.1, wN: HIPN, wF: HIPF },
  cry: { ...B, lid: 0.5, low: 0.3, brow: -0.6, by: 0.02, open: 0.85, shut: 1, tears: 1, hx: 0.02, hy: 0.03, ha: -0.22, pf: -0.04, cb: -1, tl: -1, sq: 0.1, wN: [-0.8, -0.15, 0.25, 0] },
  cheer: { ...B, lid: 0.3, low: 0.3, brow: -0.15, by: 0.04, open: 0.9, cheek: 1, shut: 2, hy: -0.03, ha: -0.14, pf: 0.03, cb: 0.8, tl: 1, sq: -0.1, ln: -0.04, wN: UPN, wF: UPF },
  smug: { ...B, lid: 0.52, low: 0.42, brow: -0.1, cock: 1, smirk: 1, cheek: 0.5, hx: -0.02, hy: -0.01, ha: -0.1, pf: 0.04, cb: 0.3, tl: 0.5, ln: -0.05, wN: CHEST, wF: HIPF },
  // acting poses the animations pass through
  wince: { ...B, lid: 0.5, low: 0.4, brow: -0.35, open: 0.18, grit: 1, smirk: -0.5, shut: 1, hy: 0.02, ha: 0.06, cb: -0.4, tl: -0.4, sq: 0.06 },
  sad: { ...B, lid: 0.36, low: 0.1, brow: -0.55, by: 0.02, smirk: -1, hy: 0.03, ha: 0.1, pf: -0.03, cb: -0.9, tl: -0.9, sq: 0.06 },
  brave: { ...B, lid: 0.3, low: 0.25, brow: -0.35, by: 0.035, smirk: 0.7, cheek: 0.6, ha: -0.08, cb: 0.1, tl: 0.2, sq: -0.03 },
  glee: { ...B, lid: 0.16, low: 0.35, brow: -0.1, by: 0.035, open: 0.55, cheek: 1, spark: 1, hy: -0.02, ha: -0.08, pf: 0.03, cb: 0.8, tl: 1, sq: -0.04, wN: UPN, wF: UPF },
  aim: { ...B, lid: 0.4, low: 0.26, brow: 0.5, pup: 0.75, smirk: 0.3, hx: 0.02, ha: 0.06, cb: 0.4, tl: 0.4 },
};
export const MAMA_MOODS = ['idle', 'proud', 'worried', 'gasp', 'angry', 'cry', 'cheer', 'smug'];
const mix = (a, b, k) => (Array.isArray(a) ? a.map((v, i) => lerp(v, b[i], k)) : lerp(a, b, k));
function moodOf(m, face) {
  let r;
  if (!Array.isArray(m)) r = MOODS[m] || MOODS.idle;
  else {
    const a = MOODS[m[0]] || MOODS.idle, b = MOODS[m[1]] || MOODS.idle, k = clamp(m[2], 0, 1); r = {};
    for (const f in a) r[f] = mix(a[f], b[f], k);
    r.shut = k > 0.5 ? b.shut : a.shut; r.grit = k > 0.5 ? b.grit : a.grit;
  }
  return face ? { ...r, ...face } : r;
}

// ---------------------------------------------------------------- geometry shared by the drawing and the animations
const SH_N = [-0.04, -0.5], SH_F = [0.24, -0.5], L1 = 0.15, L2 = 0.12, SEAT = [-0.19, -0.64], HEAD = [0.13, -0.83];
const wingOf = (w, d) => (Array.isArray(w) ? { a: w[0], bend: w[1], open: w[2], curl: w[3] || 0 } : w ? { a: w.a ?? d[0], bend: w.bend ?? d[1], open: w.open ?? d[2], curl: w.curl ?? d[3] } : { a: d[0], bend: d[1], open: d[2], curl: d[3] });
function wingGeo(sh, w) { // elbow, wrist, the palm (where a chick would sit), in s units
  const b = w.a + w.bend, el = [sh[0] + Math.sin(w.a) * L1, sh[1] + Math.cos(w.a) * L1], wr = [el[0] + Math.sin(b) * L2, el[1] + Math.cos(b) * L2];
  return { el, wr, b, palm: [wr[0] + Math.sin(b) * 0.1, wr[1] + Math.cos(b) * 0.1] };
}
function bodyPt(px, py, sq, ln) { // a point of her body (s units, feet at the origin) after the squash and the lean
  const x = px * (1 + sq * 0.3), y = py * (1 - sq * 0.34), c = Math.cos(ln), n = Math.sin(ln);
  return [x * c - y * n, x * n + y * c];
}

// ---------------------------------------------------------------- parts
function mBody(ctx, s, hx, hy, pf) { // the pear: a head on a feathered neck, a chest carried high and forward, a full rump
  const X = (x) => (x + hx) * s, Y = (y) => (y + hy) * s, L = (x, y) => ctx.lineTo(x * s, y * s), N = (x, y) => ctx.lineTo((x + hx * 0.5 + pf * 0.5) * s, (y + hy * 0.5) * s), C = (x, y) => ctx.lineTo((x + pf) * s, y * s);
  ctx.beginPath();
  ctx.moveTo(X(0.13), Y(-1.0));
  ctx.bezierCurveTo(X(0.27), Y(-1.0), X(0.345), Y(-0.9), X(0.335), Y(-0.79));
  ctx.bezierCurveTo(X(0.33), Y(-0.73), X(0.29), Y(-0.7), X(0.285), Y(-0.665));
  N(0.35, -0.64); N(0.325, -0.605); C(0.41, -0.58); C(0.39, -0.54); C(0.465, -0.505); // the chest ruff
  ctx.bezierCurveTo((0.51 + pf) * s, -0.43 * s, (0.49 + pf) * s, -0.28 * s, 0.36 * s, -0.21 * s);
  ctx.bezierCurveTo(0.27 * s, -0.165 * s, 0.15 * s, -0.16 * s, 0.03 * s, -0.16 * s);
  ctx.bezierCurveTo(-0.18 * s, -0.16 * s, -0.36 * s, -0.2 * s, -0.4 * s, -0.35 * s);
  L(-0.49, -0.4); L(-0.38, -0.43); L(-0.46, -0.51); L(-0.34, -0.52);
  ctx.bezierCurveTo(-0.24 * s, -0.58 * s, (-0.13 + hx * 0.5) * s, (-0.6 + hy * 0.5) * s, X(-0.085), Y(-0.68));
  ctx.lineTo(X(-0.165), Y(-0.695)); ctx.lineTo(X(-0.075), Y(-0.735)); ctx.lineTo(X(-0.14), Y(-0.78)); ctx.lineTo(X(-0.065), Y(-0.8));
  ctx.bezierCurveTo(X(-0.075), Y(-0.92), X(0.0), Y(-1.0), X(0.13), Y(-1.0));
  ctx.closePath();
}
// one feather: a leaf from (x, y) along angle a (0 = down, + forward), built in place so the light stays top-left.
// bow bends it sideways (a curled finger); a centre quill is inked when q is set.
function leaf(ctx, x, y, a, L, hw, o, bow = 0, q = 0) {
  const dx = Math.sin(a), dy = Math.cos(a), nx = dy, ny = -dx, tx = x + dx * L + nx * bow * L, ty = y + dy * L + ny * bow * L;
  form(ctx, () => {
    ctx.beginPath(); ctx.moveTo(x + nx * hw, y + ny * hw);
    ctx.quadraticCurveTo(x + dx * L * 0.8 + nx * (hw * 1.35 + bow * L * 0.3), y + dy * L * 0.8 + ny * (hw * 1.35 + bow * L * 0.3), tx, ty);
    ctx.quadraticCurveTo(x + dx * L * 0.8 - nx * (hw * 1.35 - bow * L * 0.3), y + dy * L * 0.8 - ny * (hw * 1.35 - bow * L * 0.3), x - nx * hw, y - ny * hw);
    ctx.closePath();
  }, o);
  if (q) { ctx.beginPath(); ctx.moveTo(x + dx * L * 0.25, y + dy * L * 0.25); ctx.quadraticCurveTo(x + dx * L * 0.6 + nx * bow * L * 0.3, y + dy * L * 0.6 + ny * bow * L * 0.3, x + dx * L * 0.86 + nx * bow * L * 0.8, y + dy * L * 0.86 + ny * bow * L * 0.8); ctx.lineWidth = q; ctx.strokeStyle = o.lo; ctx.stroke(); }
}
// A feathered wing on two bones. Back to front: the secondaries off the forearm's trailing edge, the long primaries off the
// wrist (her fingers: they fan with `open`, close into a fist with `curl`), a row of coverts over their roots, and the
// rounded shoulder patch with its scallops. The trailing edge is whichever side is under the wing as it swings round.
function mWing(ctx, s, sh, w, far, lw) {
  const g = wingGeo(sh, w), S = [sh[0] * s, sh[1] * s], E = [g.el[0] * s, g.el[1] * s], Wr = [g.wr[0] * s, g.wr[1] * s];
  const lo = far ? P.farLo : P.wingLo, base = far ? P.far : P.wing, alt = far ? P.farAlt : P.wingAlt, hi = far ? P.wing : P.wingHi, open = clamp(w.open, 0, 1), curl = clamp(w.curl || 0, 0, 1);
  const fo = (i) => ({ d: s * 0.017, lo, base: i % 2 ? alt : base, hi, line: P.line, lw, noWeight: true }), q = Math.max(0.7, s * 0.006);
  const sideB = -Math.tanh(3 * Math.sin(g.b)), sideA = -Math.tanh(3 * Math.sin(w.a)), trB = g.b + (0.8 + open * 0.25) * sideB, trA = w.a + 0.85 * sideA;
  const at = (A, Bp, k) => [lerp(A[0], Bp[0], k), lerp(A[1], Bp[1], k)];
  for (let i = 0; i < 4; i++) { const k = i / 3, p = at(E, Wr, k * 0.9 - 0.1); leaf(ctx, p[0], p[1], lerp(trB, g.b, 0.12 + k * 0.42), (0.17 + k * 0.055) * s, 0.05 * s, fo(i), 0, q); }
  const n = 5;
  for (let j = 0; j < n; j++) { // outer primaries first, so the middle ones sit on top
    const i = [0, 4, 1, 3, 2][j], k = i / (n - 1) - 0.5, a = g.b + k * lerp(0.42, 1.55, open) + sideB * curl * (1.15 + k * 0.5), L = (0.27 - Math.abs(k) * 0.085) * (1 + open * 0.1) * (1 - curl * 0.42) * s;
    leaf(ctx, Wr[0] - Math.sin(g.b) * 0.02 * s, Wr[1] - Math.cos(g.b) * 0.02 * s, a, L, 0.05 * s, fo(i + 1), sideB * (curl * 0.45 + open * 0.06 * -k * 2), q);
  }
  for (let i = 0; i < 6; i++) { // the coverts: short round feathers lapping over the long ones
    const up = i < 3, k = up ? 0.2 + (i / 2) * 0.75 : 0.1 + ((i - 3) / 2) * 0.75, p = up ? at(S, E, k) : at(E, Wr, k);
    leaf(ctx, p[0], p[1], up ? lerp(trA, trB, k * 0.5) : lerp(trB, g.b, 0.15 + k * 0.2), (up ? 0.12 : 0.11) * s, 0.052 * s, fo(i));
  }
  const pts = [S, E, Wr], rad = [0.092 * s, 0.066 * s, 0.05 * s];
  const arm = (grow) => { // the union of the joints and the bones, wound one way so it fills and clips as one shape
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const r = rad[i] + grow, [x, y] = pts[i];
      ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
      if (i < 2) { const r2 = rad[i + 1] + grow, [x2, y2] = pts[i + 1], dx = x2 - x, dy = y2 - y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l; ctx.moveTo(x - nx * r, y - ny * r); ctx.lineTo(x2 - nx * r2, y2 - ny * r2); ctx.lineTo(x2 + nx * r2, y2 + ny * r2); ctx.lineTo(x + nx * r, y + ny * r); ctx.closePath(); }
    }
  };
  const d = s * 0.028;
  arm(lw * 0.9); ctx.fillStyle = P.line; ctx.fill();
  ctx.save(); arm(0); ctx.fillStyle = lo; ctx.fill(); ctx.clip();
  ctx.save(); ctx.translate(-d * 0.55, -d); arm(0); ctx.fillStyle = hi; ctx.fill(); ctx.clip();
  ctx.translate(d * 0.36, d * 0.65); arm(0); ctx.fillStyle = base; ctx.fill(); ctx.restore();
  ctx.lineWidth = Math.max(0.8, s * 0.008); ctx.strokeStyle = lo; ctx.lineCap = 'round'; ctx.beginPath(); // scallops on the patch
  const th = Math.atan2(Math.cos(trA), Math.sin(trA)), ax = Math.sin(w.a), ay = Math.cos(w.a);
  for (const [k, off] of [[0.1, -0.035], [0.1, 0.035], [0.55, 0], [0.55, 0.06], [0.55, -0.06]]) { const cx = S[0] + ax * k * L1 * s + ay * off * s - Math.cos(th) * 0.02 * s, cy = S[1] + ay * k * L1 * s - ax * off * s - Math.sin(th) * 0.02 * s, r = 0.032 * s; ctx.moveTo(cx + Math.cos(th - 1.15) * r, cy + Math.sin(th - 1.15) * r); ctx.arc(cx, cy, r, th - 1.15, th + 1.15); }
  ctx.stroke(); ctx.restore();
}
function mEye(ctx, s, E, M, lk, bl, lw) { // the chicks' eye: a tall white, a two-tone iris, heavy lids whose edges carry the attitude
  const { cx, cy, rx, ry, sd } = E, ck = sd > 0 ? M.cock : M.cockF, lid = lerp(M.lid - ck * 0.16, 1.04, bl), ang = M.brow * 0.8 * (1 - ck * 0.7), low = M.low + M.cheek * 0.16;
  const yb = cy - ry * 1.08 + 2 * ry * lid, sl = sd * Math.tan(ang), Y = (x) => yb + (x - cx) * sl;
  const el = () => { ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); };
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (M.shut) {
    el(); ctx.fillStyle = P.lid; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = P.line; ctx.stroke();
    ctx.beginPath();
    if (M.shut === 1) { ctx.moveTo(cx - sd * rx * 0.6, cy - ry * 0.3); ctx.lineTo(cx + sd * rx * 0.55, cy + ry * 0.12); ctx.lineTo(cx - sd * rx * 0.6, cy + ry * 0.5); } // > <
    else if (M.shut === 2) { ctx.moveTo(cx - rx * 0.7, cy + ry * 0.3); ctx.quadraticCurveTo(cx, cy - ry * 0.75, cx + rx * 0.7, cy + ry * 0.3); } // a laughing arc
    else { ctx.moveTo(cx - rx * 0.72, cy + ry * 0.05); ctx.quadraticCurveTo(cx, cy + ry * 0.62, cx + rx * 0.72, cy + ry * 0.05); for (const k of [-0.5, 0, 0.5]) { ctx.moveTo(cx + k * rx, cy + ry * (0.33 - Math.abs(k) * 0.3)); ctx.lineTo(cx + k * rx * 1.35, cy + ry * (0.6 - Math.abs(k) * 0.3)); } } // content, lashes down
    ctx.lineWidth = Math.max(1.2, s * 0.016); ctx.strokeStyle = P.brow; ctx.stroke();
  } else {
    el(); ctx.fillStyle = P.white; ctx.fill(); ctx.save(); ctx.clip();
    ctx.beginPath(); ctx.ellipse(cx + rx * 0.16, cy + ry * 0.2, rx, ry, 0, 0, TAU); ctx.rect(cx - rx * 2, cy - ry * 2, rx * 4, ry * 4); ctx.fillStyle = P.eyeSh; ctx.fill('evenodd');
    const ir = s * 0.057 * (0.55 + 0.45 * M.pup) * (sd > 0 ? 1 : 0.84), pxx = cx + lk.x * (rx - ir * 0.8) * 0.8 + sd * rx * 0.06, pyy = Math.max(cy + lk.y * ry * 0.3, Math.min(cy + ry * 0.4, Y(pxx) + ir * 0.55));
    ctx.beginPath(); ctx.arc(pxx, pyy, ir, 0, TAU); ctx.fillStyle = P.iris; ctx.fill();
    ctx.beginPath(); ctx.arc(pxx, pyy + ir * 0.25, ir * 0.72, 0, TAU); ctx.fillStyle = P.irisHi; ctx.fill();
    ctx.beginPath(); ctx.arc(pxx, pyy, ir * 0.52 * (1.25 - 0.25 * M.pup), 0, TAU); ctx.fillStyle = P.pupil; ctx.fill();
    ctx.fillStyle = '#fff';
    if (M.spark > 0.5) { // a four-point sparkle instead of the plain glint
      const r = ir * 0.62, gx = pxx - ir * 0.34, gy = pyy - ir * 0.36;
      ctx.beginPath(); ctx.moveTo(gx, gy - r); ctx.quadraticCurveTo(gx, gy, gx + r, gy); ctx.quadraticCurveTo(gx, gy, gx, gy + r); ctx.quadraticCurveTo(gx, gy, gx - r, gy); ctx.quadraticCurveTo(gx, gy, gx, gy - r); ctx.fill();
      ctx.beginPath(); ctx.arc(pxx + ir * 0.36, pyy + ir * 0.38, ir * 0.16, 0, TAU); ctx.fill();
    } else { ctx.beginPath(); ctx.arc(pxx - ir * 0.38, pyy - ir * 0.4, ir * 0.27, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(cx - rx * 2, Y(cx - rx * 2)); ctx.lineTo(cx + rx * 2, Y(cx + rx * 2)); ctx.lineTo(cx + rx * 2, cy - ry * 2); ctx.lineTo(cx - rx * 2, cy - ry * 2); ctx.closePath(); ctx.fillStyle = P.lid; ctx.fill();
    ctx.lineWidth = Math.max(1, s * 0.012); ctx.strokeStyle = P.brow; ctx.stroke();
    if (low > 0.01) { // the lower lid: the cheek pushes up in an arc
      const yl = cy + ry - 2 * ry * low;
      ctx.beginPath(); ctx.moveTo(cx - rx * 1.4, cy + ry * 1.3); ctx.lineTo(cx - rx * 1.4, yl + ry * 0.3); ctx.quadraticCurveTo(cx, yl - ry * (0.4 + M.cheek * 0.25), cx + rx * 1.4, yl + ry * 0.3); ctx.lineTo(cx + rx * 1.4, cy + ry * 1.3); ctx.closePath();
      ctx.fillStyle = P.base; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = P.line; ctx.stroke();
    }
    ctx.restore();
    el(); ctx.lineWidth = lw; ctx.strokeStyle = P.line; ctx.stroke();
  }
  if (M.cheek > 0.3 && sd > 0) { ctx.beginPath(); ctx.moveTo(cx - rx * 0.75, cy + ry * 1.2); ctx.quadraticCurveTo(cx - rx * 0.1, cy + ry * (1.2 + 0.22 * M.cheek), cx + rx * 0.55, cy + ry * 1.18); ctx.lineWidth = Math.max(0.8, s * 0.009); ctx.strokeStyle = P.lo; ctx.stroke(); } // the cheek crease of a real smile
  ctx.restore();
}
function mBrow(ctx, s, E, M) { // a feather brow over each eye: thick at the bridge, tapering out; each side raises on its own
  const { cx, cy, rx, ry, sd } = E, ck = sd > 0 ? M.cock : M.cockF, ang = M.brow * (1 - ck * 0.75), lid = M.shut ? 0.3 : M.lid - ck * 0.16;
  const y0 = cy - ry * 1.27 + ry * Math.max(0, lid - 0.15) * 0.9 - (M.by + ck * 0.045) * s, tn = Math.tan(clamp(ang, -0.9, 0.9));
  const xi = cx + sd * rx * 1.0, xo = cx - sd * rx * 1.05, yi = y0 + tn * rx * 1.1, yo = y0 - tn * rx * 0.75 + ry * 0.1, th = Math.max(1.6, s * 0.028) * (sd > 0 ? 1 : 0.85), ar = ry * (0.2 + ck * 0.16);
  ctx.beginPath(); ctx.moveTo(xo, yo); ctx.quadraticCurveTo(cx, (yi + yo) / 2 - ar - th * 0.6, xi, yi - th * 0.55); ctx.lineTo(xi + sd * th * 0.15, yi + th * 0.5); ctx.quadraticCurveTo(cx, (yi + yo) / 2 - ar + th * 0.55, xo, yo); ctx.closePath();
  ctx.fillStyle = P.brow; ctx.fill();
}
function mBeak(ctx, s, M, lw) { // the chicks' beak (its own s): the lower half swings on its hinge; teeth, a tongue, a corner that smiles or frowns
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
  if (Math.abs(M.smirk) > 0.05 && open < 0.4) { ctx.beginPath(); ctx.moveTo(-0.1 * s, 0.045 * s); ctx.quadraticCurveTo(-0.18 * s, 0.06 * s, -0.22 * s, (0.045 - 0.11 * M.smirk) * s); ctx.lineWidth = Math.max(1, s * 0.028); ctx.strokeStyle = P.brow; ctx.stroke(); }
  ctx.restore();
}
function mComb(ctx, s, cb, whip, lw) { // three lobes; it stands when she is up, flops when she is down, lags behind her head
  ctx.save(); ctx.translate(0.12 * s, -0.955 * s); ctx.transform(1, 0, whip * 0.7 + Math.min(0, cb) * 0.5, 1 + cb * 0.16, 0, 0); ctx.scale(0.8, 1.04);
  const p = () => {
    ctx.beginPath(); ctx.moveTo(-0.17 * s, 0.03 * s);
    ctx.bezierCurveTo(-0.24 * s, -0.08 * s, -0.15 * s, -0.16 * s, -0.08 * s, -0.1 * s);
    ctx.bezierCurveTo(-0.08 * s, -0.22 * s, 0.06 * s, -0.24 * s, 0.07 * s, -0.12 * s);
    ctx.bezierCurveTo(0.11 * s, -0.2 * s, 0.22 * s, -0.17 * s, 0.19 * s, -0.06 * s);
    ctx.lineTo(0.17 * s, 0.04 * s); ctx.closePath();
  };
  form(ctx, p, { d: s * 0.024, lo: P.combLo, base: P.comb, hi: P.combHi, line: P.combLine, lw, noWeight: true, hiK: 0.6 });
  ctx.restore();
}
function mWattle(ctx, s, sw, lw) {
  for (const [x, r, far] of [[0.045, 0.85, 1], [0, 1, 0]]) {
    ctx.save(); ctx.translate(x * s, 0); ctx.rotate(sw * (far ? 0.75 : 1)); ctx.scale(r, r * (1 + Math.abs(sw) * 0.2));
    form(ctx, () => { ctx.beginPath(); ctx.moveTo(-0.026 * s, -0.01 * s); ctx.bezierCurveTo(-0.07 * s, 0.065 * s, -0.042 * s, 0.13 * s, 0.0, 0.13 * s); ctx.bezierCurveTo(0.046 * s, 0.13 * s, 0.066 * s, 0.065 * s, 0.028 * s, -0.01 * s); ctx.closePath(); },
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
function drop(ctx, x, y, r, rot, lw) { // a tear or a bead of sweat
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath(); ctx.moveTo(0, -r * 1.7); ctx.bezierCurveTo(r * 1.1, -r * 0.2, r, r, 0, r); ctx.bezierCurveTo(-r, r, -r * 1.1, -r * 0.2, 0, -r * 1.7); ctx.closePath();
  ctx.fillStyle = P.tear; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = P.tearLine; ctx.stroke();
  ctx.beginPath(); ctx.arc(-r * 0.3, r * 0.1, r * 0.28, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
}

// ---------------------------------------------------------------- the hen
// o: { mood (a name or [from, to, k]), face (rig values laid over the mood's: see the list above MOODS), squash (about the
//      feet; negative stretches her up), lean (rad, + forward), lift (s units off the ground), head { x, y, a } (pushed and
//      tilted on the neck), look { x, y }, blink 0..1, wingN / wingF ({ a, bend, open, curl } or [a, bend, open, curl]: they
//      override the mood's wings), comb / tail / wattle (-1..1 lag on top of the mood's), shadow, flip, still (true = no
//      idle breathing or sway: the animations set it) }
export function drawMama(ctx, x, y, s, t, o = {}) {
  const M = moodOf(o.mood || 'idle', o.face), lw = Math.max(1, s * 0.0072), live = o.still ? 0 : 1, br = Math.sin(t * 2.1) * live, sw = Math.sin(t * 2.6) * live;
  const sq = clamp((o.squash || 0) + M.sq + br * 0.012, -0.6, 0.8), ln = (o.lean || 0) + M.ln, lk = o.look || { x: 0.5, y: 0 }, hd = o.head || {};
  const bl = M.shut ? 0 : (o.blink ?? blinkAt(t, 71) * live), lift = (o.lift || 0) * s;
  const wN = wingOf(o.wingN, M.wN), wF = wingOf(o.wingF, M.wF), cw = (o.comb || 0) + sw * 0.03, tw = o.tail || 0;
  const hx = M.hx + (hd.x || 0), hy = M.hy + (hd.y || 0) + br * 0.004, ha = M.ha + (hd.a || 0), pf = M.pf + br * 0.006;
  ctx.save(); ctx.translate(x, y); if (o.flip) ctx.scale(-1, 1);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (o.shadow) contact(ctx, 0.02 * s, 0, s * 0.4 * (1 + sq * 0.3) * (1 - Math.min(0.5, lift / s)), s * 0.042, 0.25);
  ctx.translate(0, -lift);
  for (const fx of [-0.14, 0.12]) { // sturdy legs: the shank runs from the foot up into the belly feathers
    const hip = bodyPt(fx * 0.85 + 0.02, -0.23, sq, ln), dr = Math.min(0.03, lift / s * 0.4); // off the ground the feet dangle a little
    ctx.save(); ctx.translate(0, dr * s);
    limb(ctx, [[hip[0] * s, hip[1] * s - dr * s], [(fx + 0.01) * s, -0.04 * s]], [0.03 * s, 0.024 * s], P.beakLo, P.beakLine, lw);
    limb(ctx, [[hip[0] * s - 0.006 * s, hip[1] * s - dr * s], [(fx + 0.004) * s, -0.045 * s]], [0.017 * s, 0.013 * s], P.beak, null, 0);
    mFoot(ctx, s, fx, lw); ctx.restore();
  }
  ctx.rotate(ln); ctx.scale(1 + sq * 0.3, 1 - sq * 0.34);
  // the fanned tail: six feathers off the rump, lit and shaded in turn
  for (const i of [5, 0, 4, 1, 3, 2]) {
    const a = -1.7 - i * 0.235 * (1 + M.tl * 0.12) - M.tl * 0.2 + tw * 0.5 + sw * 0.03, L = (0.4 - Math.abs(i - 2.5) * 0.035) * s;
    leaf(ctx, -0.31 * s, -0.43 * s, a, L, 0.07 * s, { d: s * 0.024, lo: P.wingLo, base: i % 2 ? P.wingAlt : P.wing, hi: P.wingHi, line: P.line, lw, noWeight: true }, 0, Math.max(0.7, s * 0.006));
  }
  mWing(ctx, s, SH_F, wF, true, lw);
  ctx.save(); ctx.translate(hx * s, hy * s); ctx.translate(0.12 * s, -0.9 * s); ctx.rotate(ha); ctx.translate(-0.12 * s, 0.9 * s); mComb(ctx, s, M.cb + (o.combUp || 0) * 0.6, cw, lw); ctx.restore();
  form(ctx, () => mBody(ctx, s, hx, hy, pf), { d: s * 0.066, lo: P.lo, base: P.base, hi: P.hi, line: P.line, lw, noWeight: true, hiK: 0.42,
    inner: (c) => {
      c.fillStyle = P.deep; c.globalAlpha *= 0.4; c.beginPath(); c.ellipse(0.06 * s, -0.12 * s, 0.4 * s, 0.085 * s, 0.05, 0, TAU); c.fill(); c.globalAlpha /= 0.4; // the belly falls into shade
      // the downy chest: the chicks' ruff of pale tufts, grown into a bib
      const T = [[0.7, -0.62], [0.33, -0.56], [0.385, -0.49], [0.255, -0.48], [0.315, -0.4], [0.175, -0.39], [0.245, -0.31], [0.085, -0.3], [0.15, -0.23], [-0.02, -0.16], [0.7, -0.1]];
      for (const [ox, oy, col] of [[0.014, 0.02, P.downLo], [0, 0, P.down]]) { c.beginPath(); T.forEach(([px, py], i) => (i ? c.lineTo((px + ox + pf) * s, (py + oy) * s) : c.moveTo((px + ox + pf) * s, (py + oy) * s))); c.closePath(); c.fillStyle = col; c.fill(); }
      c.strokeStyle = P.lo; c.lineWidth = Math.max(0.8, s * 0.01); c.lineJoin = 'round'; c.lineCap = 'round'; c.beginPath();
      const H = [[-0.13, -0.645], [-0.07, -0.6], [-0.02, -0.66], [0.05, -0.605], [0.1, -0.665], [0.17, -0.61], [0.22, -0.665], [0.28, -0.625]]; // the hackle: a feather collar
      H.forEach(([px, py], i) => (i ? c.lineTo((px + hx * 0.6) * s, (py + hy * 0.6) * s) : c.moveTo((px + hx * 0.6) * s, (py + hy * 0.6) * s)));
      for (const [px, py] of [[-0.27, -0.31], [-0.18, -0.25], [-0.3, -0.22], [-0.08, -0.22], [0.1, -0.34], [0.03, -0.27], [0.17, -0.46], [-0.2, -0.47], [-0.1, -0.52], [0.05, -0.52]]) { c.moveTo((px - 0.034) * s, (py - 0.012) * s); c.quadraticCurveTo(px * s, (py + 0.04) * s, (px + 0.034) * s, (py - 0.012) * s); } // feather scallops
      c.stroke();
    } });
  // the face, on the head (which the mood and the animation push about on the neck)
  ctx.save(); ctx.translate((HEAD[0] + hx) * s, (HEAD[1] + hy + 0.1) * s); ctx.rotate(ha); ctx.translate(-HEAD[0] * s, -(HEAD[1] + 0.1) * s);
  ctx.save(); ctx.translate(0.262 * s, -0.69 * s); mWattle(ctx, s, (o.wattle || 0) + sw * 0.04 - ha * 0.5, lw); ctx.restore();
  const e0 = { cx: 0.243 * s, cy: -0.85 * s, rx: 0.062 * s, ry: 0.092 * s, sd: -1 }, e1 = { cx: 0.1 * s, cy: -0.845 * s, rx: 0.09 * s, ry: 0.105 * s, sd: 1 };
  mEye(ctx, s, e0, M, lk, bl, lw); mEye(ctx, s, e1, M, lk, bl, lw);
  mBrow(ctx, s, e0, M); mBrow(ctx, s, e1, M);
  ctx.save(); ctx.translate(0.288 * s, -0.728 * s); mBeak(ctx, s * 0.58, M, lw); ctx.restore();
  if (M.tears > 0.01) for (const e of [e0, e1]) for (let i = 0; i < 3; i++) { // tears fly off both eyes in arcs
    const u = (t * 1.5 + i / 3 + (e.sd > 0 ? 0 : 0.17)) % 1, dx = -e.sd * (0.02 + u * 0.2) * s + (e.sd > 0 ? -e.rx : e.rx) * 0.5, dy = (-0.03 - u * 0.2 + u * u * 0.44) * s;
    ctx.save(); ctx.globalAlpha *= clamp((1 - u) * 3, 0, 1) * clamp(M.tears * 2, 0, 1); drop(ctx, e.cx + dx, e.cy + dy, s * 0.024 * (1 - u * 0.4) * (0.5 + 0.5 * M.tears), -e.sd * (0.9 - u * 1.6), lw); ctx.restore();
  }
  if (M.sweat > 0.01) { const u = (t * 0.8) % 1; ctx.save(); ctx.globalAlpha *= clamp(M.sweat, 0, 1) * clamp(Math.min(u * 6, (1 - u) * 3), 0, 1); drop(ctx, -0.02 * s, (-0.93 + u * u * 0.16) * s, s * 0.026, -0.15, lw); ctx.restore(); }
  if (M.vein > 0.01) { // the anger mark, throbbing
    const r = s * 0.05 * clamp(M.vein, 0, 1.3) * (1 + 0.12 * Math.sin(t * 16)); ctx.save(); ctx.translate(0.0, -0.955 * s); ctx.rotate(-0.3); ctx.beginPath();
    for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + 0.78, cx = Math.cos(a) * r * 1.35, cy = Math.sin(a) * r * 1.35; ctx.moveTo(cx + Math.cos(a + Math.PI - 0.8) * r * 0.85, cy + Math.sin(a + Math.PI - 0.8) * r * 0.85); ctx.arc(cx, cy, r * 0.85, a + Math.PI - 0.8, a + Math.PI + 0.8); }
    ctx.lineWidth = Math.max(1.6, s * 0.026); ctx.strokeStyle = P.combLine; ctx.stroke(); ctx.lineWidth = Math.max(1, s * 0.015); ctx.strokeStyle = P.comb; ctx.stroke(); ctx.restore();
  }
  if (M.steam > 0.01) for (let i = 0; i < 4; i++) { // steam off the top of her head
    const u = (t * 1.3 + i * 0.25) % 1, sd = i % 2 ? 1 : -1; ctx.save(); ctx.globalAlpha *= clamp(M.steam, 0, 1) * 0.85 * clamp(Math.min(u * 5, (1 - u) * 2), 0, 1);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc((0.12 + sd * (0.2 + u * 0.14)) * s, (-1.0 - u * 0.2) * s, s * (0.025 + u * 0.035), 0, TAU); ctx.arc((0.12 + sd * (0.23 + u * 0.17)) * s, (-1.035 - u * 0.2) * s, s * (0.02 + u * 0.03), 0, TAU); ctx.fill(); ctx.restore();
  }
  ctx.restore();
  if (Math.sin(wN.a) < 0) { // a wing raised from behind passes behind her head: it never covers her face
    ctx.beginPath(); ctx.rect(-2 * s, -3 * s, 4 * s, 4 * s); ctx.save(); ctx.translate((HEAD[0] + hx) * s, (HEAD[1] + hy + 0.1) * s); ctx.rotate(ha); ctx.ellipse(0, -0.1 * s, 0.205 * s, 0.172 * s, 0, 0, TAU); ctx.restore(); ctx.clip('evenodd');
  }
  mWing(ctx, s, SH_N, wN, false, lw);
  ctx.restore();
}

// ---------------------------------------------------------------- animation kit
// Pose to pose: keys [[time, value, ease]] (value a number or an array). The ease belongs to the key being arrived at:
// default a soft in-out, 'b' overshoots and settles, 'i' accelerates in (a hit), 'o' decelerates out, 'l' linear.
const EASE = { b: (k) => back(k, 2.4), i: (k) => k * k * k, o: (k) => 1 - (1 - k) ** 3, l: (k) => k };
function K(u, keys) {
  if (u <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (u <= keys[i][0]) { const a = keys[i - 1], b = keys[i], k = (u - a[0]) / (b[0] - a[0] || 1e-6), e = EASE[b[2]]; return mix(a[1], b[1], e ? e(k) : k * k * (3 - 2 * k)); }
  return keys[keys.length - 1][1];
}
function KM(u, keys) { // mood keys [[time, name]]: a blend [from, to, k]
  if (u <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (u <= keys[i][0]) return [keys[i - 1][1], keys[i][1], ss(keys[i - 1][0], keys[i][0], u)];
  return keys[keys.length - 1][1];
}
const blinks = (u, ts) => { let v = 0; for (const t of ts) { const k = (u - t) / 0.13; if (k > 0 && k < 1) v = Math.max(v, Math.sin(k * Math.PI)); } return v; };
const shake = (u, t0, t1, hz) => (u > t0 && u < t1 ? Math.sin((u - t0) * hz * TAU) * (1 - (u - t0) / (t1 - t0)) : 0); // a rattle that dies away
const XY = (v) => ({ x: v[0], y: v[1] });
function headPt(p) { // where the top of her head is: the comb, wattle and tail lag behind it
  const M = moodOf(p.mood || 'idle', p.face), hd = p.head || {}, ha = M.ha + (hd.a || 0);
  const q = bodyPt(0.13 + M.hx + (hd.x || 0) + ha * 0.16, -0.97 + M.hy + (hd.y || 0), (p.squash || 0) + M.sq, (p.lean || 0) + M.ln);
  return [q[0], q[1] - (p.lift || 0)];
}
// wrap a pose function: clamp or loop the time, then add the secondary motion (comb, wattle and tail lag her head and body)
function anim(len, loop, keys, fn) {
  const at = (u) => (loop ? ((u % len) + len) % len : clamp(u, 0, len)), hp = (u) => headPt(fn(at(u)));
  return { len, loop, keys, pose(u) {
    u = at(u); const p = fn(u), a = hp(u), b = hp(u - 0.07), c = hp(u - 0.14);
    p.still = true;
    p.comb = (p.comb || 0) + clamp((b[0] - a[0]) * 13 - (c[0] - b[0]) * 5, -1.3, 1.3);
    p.combUp = clamp((a[1] - b[1]) * 9, -1.2, 1.2);
    p.wattle = clamp((a[0] - b[0]) * 15 + (c[0] - b[0]) * -5, -0.9, 0.9);
    p.tail = (p.tail || 0) + clamp((c[1] - a[1]) * 5.5 + (a[0] - c[0]) * 3, -1.2, 1.2);
    return p;
  } };
}

// ---------------------------------------------------------------- the animations (u in seconds)
function idle(u) { // breathing, blinks, a side glance (eyes first, then the head), a feather ruffle
  const rs = shake(u, 4.4, 4.98, 8.5), puff = K(u, [[4.1, 0], [4.3, -0.4], [4.42, 1, 'b'], [4.9, 0.85], [5.25, 0, 'b']]);
  return {
    mood: u > 4.95 && u < 5.9 ? ['idle', 'smug', K(u, [[4.95, 0], [5.1, 0.8], [5.6, 0.8], [5.9, 0]])] : 'idle',
    face: { pf: Math.max(0, puff) * 0.05 + Math.sin(u / 3 * TAU) * 0.008, cock: K(u, [[1.9, 0.6], [2.0, 1, 'b'], [3.0, 1], [3.15, 0.6]]) },
    squash: Math.sin(u / 3 * TAU) * 0.016 + K(u, [[4.1, 0], [4.3, 0.15, 'o'], [4.42, -0.1, 'b'], [4.9, -0.07], [5.2, 0.04], [5.45, 0]]),
    lean: rs * 0.05,
    look: XY(K(u, [[0, [0.5, 0]], [1.9, [0.5, 0]], [1.97, [-0.95, -0.15], 'o'], [3.0, [-0.95, -0.15]], [3.07, [0.5, 0], 'o'], [6, [0.5, 0]]])),
    head: { x: K(u, [[2.0, 0], [2.16, -0.035, 'b'], [3.06, -0.035], [3.24, 0, 'b']]), y: 0, a: K(u, [[2.0, 0], [2.16, -0.11, 'b'], [3.06, -0.11], [3.24, 0, 'b'], [4.3, 0.06], [4.44, -0.12, 'b'], [4.95, -0.1], [5.3, 0, 'b']]) + rs * 0.05 },
    blink: Math.max(blinks(u, [0.8, 2.02, 3.08, 3.8, 5.75]), K(u, [[4.24, 0], [4.32, 1], [4.98, 1], [5.08, 0]])),
    wingN: mix(FOLD, [-1.3, -0.45, 0.85, 0], Math.max(0, puff)).map((v, i) => v + (i === 0 ? rs * 0.16 : 0)),
    wingF: HIDE,
    tail: -Math.max(0, puff) * 0.5 + rs * 0.5,
  };
}
function worried(u) { // eyes dart, the head snaps after them, she nibbles her wingtip, gulps
  const lx = K(u, [[0, 0.8], [0.1, 0.8], [0.17, -0.85, 'o'], [0.7, -0.85], [0.77, 0.6, 'o'], [1.2, 0.6], [1.27, -0.4, 'o'], [1.7, -0.4], [1.77, 0.8, 'o'], [2.4, 0.8]]);
  const hxk = K(u, [[0, 0.8], [0.16, 0.8], [0.3, -0.85, 'b'], [0.76, -0.85], [0.9, 0.6, 'b'], [1.26, 0.6], [1.4, -0.4, 'b'], [1.76, -0.4], [1.9, 0.8, 'b'], [2.4, 0.8]]);
  const nib = Math.sin(u * 20) > 0 ? 1 : -1, gulp = K(u, [[1.95, 0], [2.05, 1, 'o'], [2.17, -0.4, 'b'], [2.36, 0]]);
  return {
    mood: 'worried', face: { by: 0.03 + Math.abs(lx) * 0.015, open: 0.22 - Math.max(0, gulp) * 0.2, pup: 0.55 },
    squash: Math.sin(u * 44) * 0.008 + gulp * 0.09, lean: 0,
    look: { x: lx, y: K(u, [[0, 0], [0.7, -0.3], [1.2, 0.2], [1.7, -0.4], [2.4, 0]]) },
    head: { x: hxk * 0.018, y: Math.max(0, gulp) * 0.02, a: hxk * 0.05 },
    blink: blinks(u, [0.12, 0.72, 1.22, 1.72]),
    wingN: [BEAK[0] + hxk * 0.03, BEAK[1] + nib * 0.05, 0.35, 0.3 + nib * 0.12], wingF: HIDE,
  };
}
function gasp(u) { // a take: dip (anticipation), pop up stretched with huge eyes and feathers flared, settle shaking
  const sh = shake(u, 0.3, 0.95, 11);
  return {
    mood: KM(u, [[0, 'idle'], [0.12, 'wince'], [0.2, 'gasp'], [1.3, 'gasp']]), face: u > 0.2 ? { open: 0.95 + sh * 0.05, pup: K(u, [[0.2, 0.2], [0.9, 0.34]]) } : null,
    squash: K(u, [[0, 0], [0.13, 0.3, 'o'], [0.22, -0.3, 'o'], [0.33, 0.14], [0.45, -0.05, 'b'], [1.3, 0]]),
    lift: K(u, [[0.13, 0], [0.22, 0.07, 'o'], [0.32, 0, 'i']]), lean: sh * 0.035,
    look: XY(K(u, [[0, [0.5, 0]], [0.06, [0.95, -0.2], 'o'], [1.3, [0.95, -0.2]]])),
    head: { x: 0, y: K(u, [[0.14, 0], [0.24, -0.03, 'b'], [0.5, 0]]), a: sh * 0.03 }, blink: K(u, [[0.04, 0], [0.1, 1], [0.17, 1], [0.21, 0]]),
    wingN: K(u, [[0, FOLD], [0.13, [-0.6, -0.8, 0, 0.3]], [0.25, [-2.0, -0.4, 1, 0], 'b'], [0.5, [-1.75, -0.45, 1, 0]]]).map((v, i) => v + (i === 0 ? sh * 0.1 : 0)),
    wingF: K(u, [[0, HIDE], [0.16, HIDE], [0.29, [2.35, 0.3, 1, 0], 'b'], [0.54, [2.0, 0.4, 1, 0]]]).map((v, i) => v + (i === 0 ? -sh * 0.1 : 0)),
  };
}
function angry(u) { // rear back, stomp, fists to hips one after the other, lean in and glare; a vein, then steam
  const tr = u > 0.8 ? Math.sin(u * 50) * 0.01 : 0;
  return {
    mood: KM(u, [[0, 'idle'], [0.14, 'aim'], [0.24, 'angry'], [1.8, 'angry']]),
    face: { vein: K(u, [[0.22, 0], [0.32, 1.25, 'o'], [0.45, 1]]), steam: K(u, [[0.75, 0], [0.9, 1]]), open: K(u, [[0.2, 0], [0.26, 0.5], [0.5, 0.2], [1.8, 0.2]]), brow: K(u, [[0.2, 0.3], [0.3, 0.75, 'b'], [1.8, 0.66]]) },
    squash: K(u, [[0, 0], [0.06, 0.1], [0.17, -0.2, 'o'], [0.25, 0.3, 'i'], [0.4, -0.08, 'o'], [0.56, 0], [1.8, 0]]) + tr,
    lift: K(u, [[0.05, 0], [0.17, 0.08, 'o'], [0.25, 0, 'i']]),
    lean: K(u, [[0, 0], [0.17, -0.16, 'o'], [0.26, -0.04], [0.56, -0.06], [0.74, 0.07, 'b'], [1.8, 0.05]]),
    look: XY(K(u, [[0, [0.5, 0]], [0.08, [0.95, 0.1], 'o'], [1.8, [0.95, 0.1]]])),
    head: { x: K(u, [[0.56, -0.02], [0.74, 0.03, 'b'], [1.8, 0.025]]), y: 0, a: tr * 2 }, blink: blinks(u, [0.12]),
    wingN: K(u, [[0, FOLD], [0.17, [-2.0, -0.6, 0.7, 0], 'o'], [0.27, [-1.5, -0.4, 0.4, 0.9], 'i'], [0.34, [-1.5, -0.4, 0.4, 0.9]], [0.46, [-1.0, 2.25, 0, 0.6], 'b'], [1.8, [-1.0, 2.25, 0, 0.6]]]),
    wingF: K(u, [[0, HIDE], [0.2, [2.0, 0.5, 0.7, 0], 'o'], [0.3, [1.6, 0.4, 0.4, 0.9], 'i'], [0.42, [1.6, 0.4, 0.4, 0.9]], [0.54, [1.05, -2.3, 0, 0.6], 'b'], [1.8, [1.05, -2.3, 0, 0.6]]]),
  };
}
function cry(u) { // three bawling sobs, then she wipes an eye with her wing, sniffs, breathes in and starts again
  const bawl = u < 1.25, p = (u % 0.42) / 0.42, hic = bawl ? (p < 0.22 ? ss(0, 0.22, p) : 1 - ss(0.22, 1, p)) : 0, wipe = K(u, [[1.25, 0], [1.45, 1, 'b'], [2.0, 1], [2.2, 0]]);
  return {
    mood: 'cry', face: { open: bawl ? 0.7 + hic * 0.3 : K(u, [[1.25, 0.85], [1.4, 0.12], [2.05, 0.12], [2.2, 0.5], [2.4, 0.9, 'o']]), tears: bawl ? 1 : K(u, [[1.25, 1], [1.5, 0.35], [2.1, 0.35], [2.4, 1]]), smirk: -1, ha: bawl ? -0.22 + hic * 0.07 : K(u, [[1.25, -0.2], [1.45, 0.04, 'b'], [2.05, 0.04], [2.3, -0.3, 'o'], [2.4, -0.24]]) },
    squash: bawl ? hic * 0.13 - 0.04 : K(u, [[1.25, -0.04], [1.45, 0.08], [1.7, 0.02], [1.78, 0.1, 'o'], [2.05, 0.04], [2.3, -0.16, 'o'], [2.4, -0.04]]),
    lean: bawl ? -0.03 : K(u, [[1.25, -0.03], [1.45, 0.03], [2.1, 0.03], [2.3, -0.06], [2.4, -0.03]]),
    head: { x: 0, y: bawl ? -hic * 0.012 : 0, a: 0 },
    wingN: K(u, [[0, [-0.8, -0.15, 0.25, 0]], [1.22, [-0.8, -0.15, 0.25, 0]], [1.45, [2.75, -0.5, 0.4, 0.3], 'b'], [1.68, [2.5, -0.1, 0.4, 0.3]], [1.9, [2.75, -0.5, 0.4, 0.3]], [2.05, [2.6, -0.3, 0.4, 0.3]], [2.3, [-0.8, -0.15, 0.25, 0], 'b'], [2.4, [-0.8, -0.15, 0.25, 0]]]).map((v, i) => v + (i === 0 && bawl ? hic * -0.2 : 0)),
    wingF: HIDE, tail: wipe * 0.1,
  };
}
function aww(u) { // a small fail: flinch, facepalm (hold, a slow shake of the head), peek, then a brave shrug
  const sh = u > 0.5 && u < 1.1 ? Math.sin((u - 0.5) * 10.5) * 0.05 : 0;
  return {
    mood: KM(u, [[0, 'idle'], [0.1, 'wince'], [1.12, 'wince'], [1.32, 'sad'], [1.62, 'sad'], [1.84, 'brave'], [2.35, 'brave'], [2.6, 'idle']]),
    squash: K(u, [[0, 0], [0.1, 0.18, 'o'], [0.36, 0.08], [1.12, 0.1], [1.5, 0.14], [1.62, 0.16], [1.84, -0.1, 'b'], [2.3, -0.07], [2.6, 0]]),
    lean: K(u, [[0, 0], [0.1, -0.06, 'o'], [0.36, 0.03], [1.62, 0.03], [1.84, -0.04, 'b'], [2.6, 0]]),
    look: XY(K(u, [[1.1, [0.5, 0.6]], [1.6, [0.3, 0.8]], [1.7, [0.9, -0.1], 'o'], [2.6, [0.5, 0]]])),
    head: { x: 0, y: K(u, [[0.2, 0], [0.36, 0.03, 'b'], [1.12, 0.03], [1.84, -0.01, 'b']]), a: K(u, [[0.2, 0], [0.36, 0.16, 'b'], [1.12, 0.16], [1.35, 0.08], [1.62, 0.1], [1.84, -0.1, 'b'], [2.3, -0.08], [2.6, 0]]) + sh },
    blink: blinks(u, [1.66]),
    wingN: K(u, [[0, FOLD], [0.18, [-0.5, -1.0, 0.3, 0], 'o'], [0.34, [2.8, -0.5, 0.75, 0.1], 'i'], [0.42, [2.7, -0.42, 0.7, 0.1], 'o'], [1.12, [2.7, -0.42, 0.7, 0.1]], [1.4, [-0.3, -0.35, 0.2, 0.2], 'o'], [1.62, [-0.4, -0.3, 0.2, 0.2]], [1.84, SHRN, 'b'], [2.3, SHRN], [2.6, FOLD, 'b']]),
    wingF: K(u, [[0, HIDE], [1.66, HIDE], [1.88, SHRF, 'b'], [2.3, SHRF], [2.6, HIDE]]),
  };
}
function cheer(u) { // crouch, a big hop with the wings thrown up (near wing leads), land with a squash, pump and grin
  const p = clamp((u - 0.27) / 0.34, 0, 1);
  return {
    mood: KM(u, [[0, 'idle'], [0.16, 'aim'], [0.26, 'aim'], [0.32, 'cheer'], [0.66, 'cheer'], [0.8, 'glee'], [1.6, 'glee']]),
    squash: K(u, [[0, 0], [0.2, 0.38, 'o'], [0.3, -0.32, 'o'], [0.52, -0.06], [0.61, -0.12], [0.67, 0.36, 'o'], [0.82, -0.1, 'o'], [0.98, 0.03], [1.12, 0], [1.6, 0]]),
    lift: 0.34 * 4 * p * (1 - p),
    lean: K(u, [[0, 0], [0.2, 0.07], [0.34, -0.09, 'o'], [0.61, 0.02], [0.67, 0.06], [0.84, -0.03, 'b'], [1.6, 0]]),
    look: XY(K(u, [[0, [0.5, 0]], [0.1, [0.7, -0.6], 'o'], [1.6, [0.6, -0.2]]])),
    head: { x: 0, y: K(u, [[0.2, 0.02], [0.32, -0.03, 'b'], [0.67, 0.02], [0.84, -0.02, 'b']]), a: K(u, [[0.2, 0.08], [0.34, -0.1, 'b'], [0.67, 0.06], [0.86, -0.06, 'b'], [1.6, 0]]) },
    blink: blinks(u, [0.08]),
    wingN: K(u, [[0, FOLD], [0.2, [-0.2, -1.0, 0.2, 0.6], 'o'], [0.33, [-2.4, 0.2, 1, 0], 'b'], [0.6, [-2.15, 0.25, 1, 0]], [0.68, [-1.5, 0.9, 0.6, 0.5], 'i'], [0.86, [-2.2, 0.25, 1, 0], 'b'], [1.02, [-1.6, 0.9, 0.5, 0.9]], [1.16, [-2.15, 0.25, 1, 0], 'b'], [1.6, UPN]]),
    wingF: K(u, [[0, HIDE], [0.23, HIDE], [0.37, [2.55, -0.2, 1, 0], 'b'], [0.62, [2.3, -0.25, 1, 0]], [0.71, [1.7, -0.9, 0.6, 0.5], 'i'], [0.9, [2.35, -0.25, 1, 0], 'b'], [1.6, UPF]]),
  };
}
const beat = (u) => { const b = u / 0.5, i = Math.floor(b) % 4, p = b - Math.floor(b); return { i, p, side: i % 2 ? -1 : 1 }; };
const swayAt = (u) => { const { p, side } = beat(((u % 2) + 2) % 2); return lerp(-side, side, back(clamp(p / 0.34, 0, 1), 2.2)); };
const dipAt = (u) => { const { p } = beat(((u % 2) + 2) % 2); return p < 0.16 ? lerp(-0.07, 0.2, ss(0, 0.16, p)) : lerp(0.2, -0.07, ss(0.16, 0.62, p)); };
function dance(u) { // the win dance on a 0.5 s beat: hips sway and hit, the wings point up in turn, the head bobs late, a hop on four
  const { i, p, side } = beat(u), k = back(clamp(p / 0.3, 0, 1), 2.6), kf = back(clamp((p - 0.05) / 0.3, 0, 1), 2.6);
  const NUP = [-2.25, 0.4, 1, 0], NDN = [-1.0, 2.25, 0.2, 0.5], FUP = [2.35, -0.35, 1, 0], FDN = [1.05, -2.3, 0.2, 0.5], hop = i === 3 ? clamp((p - 0.18) / 0.6, 0, 1) : 0;
  return {
    mood: p < 0.42 ? 'cheer' : p < 0.9 ? ['cheer', 'glee', ss(0.42, 0.5, p)] : ['glee', 'cheer', ss(0.9, 1, p)],
    face: { open: 0.5 + 0.4 * Math.max(0, 1 - p * 3) },
    squash: dipAt(u) + (i === 3 ? -0.12 * Math.sin(hop * Math.PI) : 0), lift: 0.1 * 4 * hop * (1 - hop), lean: swayAt(u) * 0.085,
    look: { x: 0.5 + side * 0.3, y: -0.2 },
    head: { x: swayAt(u - 0.08) * -0.012, y: dipAt(u - 0.06) * 0.07, a: swayAt(u - 0.08) * -0.1 },
    blink: 0,
    wingN: mix(side > 0 ? NDN : NUP, side > 0 ? NUP : NDN, k).map((v, j) => v + (j === 1 && side > 0 ? Math.sin(p * TAU * 2) * 0.12 * (1 - p) : 0)),
    wingF: mix(side > 0 ? FUP : FDN, side > 0 ? FDN : FUP, kf).map((v, j) => v + (j === 1 && side < 0 ? Math.sin(p * TAU * 2) * 0.12 * (1 - p) : 0)),
    tail: swayAt(u - 0.12) * 0.5,
  };
}
function proud(u) { // a slow, satisfied nod, then one eyebrow goes up and she dusts off her chest
  return {
    mood: KM(u, [[0, 'idle'], [0.25, 'idle'], [0.5, 'proud'], [0.98, 'proud'], [1.12, 'smug'], [2.4, 'smug']]),
    face: u > 1 ? { cock: K(u, [[1.0, 0], [1.12, 1.25, 'o'], [1.3, 1], [2.4, 1]]), lid: 0.5 } : null,
    squash: K(u, [[0, 0], [0.22, -0.05], [0.5, 0.1, 'o'], [0.66, 0.1], [0.92, -0.05, 'b'], [2.4, -0.03]]),
    lean: K(u, [[0, 0], [0.5, 0.05], [0.92, -0.03, 'b'], [2.4, 0]]),
    look: XY(K(u, [[0, [0.5, 0]], [1.0, [0.5, 0]], [1.08, [0.95, -0.1], 'o'], [1.22, [0.95, -0.1]], [1.3, [0.5, 0.9], 'o'], [1.82, [0.5, 0.9]], [1.9, [0.95, -0.15], 'o'], [2.4, [0.95, -0.15]]])),
    head: { x: 0, y: K(u, [[0.22, -0.01], [0.5, 0.035, 'o'], [0.66, 0.035], [0.92, -0.01, 'b']]), a: K(u, [[0, 0], [0.22, -0.07], [0.5, 0.26, 'o'], [0.66, 0.26], [0.92, -0.02, 'b'], [1.3, 0.04], [1.82, 0.04], [1.96, -0.03, 'b'], [2.4, 0]]) },
    blink: blinks(u, [1.0, 1.86]),
    wingN: K(u, [[0, FOLD], [0.95, FOLD], [1.14, CHEST, 'b'], [1.26, CHEST], [1.34, [0.98, 0.5, 0.9, 0], 'o'], [1.46, [0.8, 0.95, 0.4, 0.3]], [1.54, [0.98, 0.5, 0.9, 0], 'o'], [1.66, [0.8, 0.95, 0.4, 0.3]], [1.74, [0.98, 0.5, 0.9, 0], 'o'], [1.84, CHEST], [2.06, HIPN, 'b'], [2.4, HIPN]]),
    wingF: K(u, [[0, HIDE], [1.88, HIDE], [2.12, HIPF, 'b'], [2.4, HIPF]]),
  };
}

// ---------------------------------------------------------------- the wing launch
// u 0..1 over MAMA_LAUNCH_T (0.62 s), three beats. HOP (0 - 0.27): the charged chick crouches on the ground behind her and
// hops onto her back; she watches it come and dips under it. WIND (0.27 - 0.52): she scoops the near wing down and back
// under the chick and coils, eyes narrowed. SPIKE (0.52 - 0.62): she bats it up and forward over her head, stretching into
// the swing; the wing stops high behind her head (it never crosses her face), comb and tail whipping. Then a smug hold as
// she watches it fly, and she settles. Returns drawMama's options, plus `chick`: { x, y } of its feet in her s units from
// her feet (it faces +x), held (on her), air (the hop in), rot, squash, stretch, mood.
const REL = 0.6, START = [-0.74, 0];
function launchPose(u) {
  return {
    mood: KM(u, [[0, 'idle'], [0.3, 'idle'], [0.48, 'aim'], [0.55, 'angry'], [0.62, 'angry'], [0.72, 'smug'], [0.9, 'smug'], [1, 'idle']]),
    face: u > 0.5 && u < 0.72 ? { vein: 0, open: K(u, [[0.52, 0.1], [0.6, 0.85, 'o'], [0.72, 0]]) } : u < 0.3 ? { cock: K(u, [[0, 0.6], [0.08, 1.1, 'o'], [0.3, 0.6]]) } : null,
    squash: K(u, [[0, 0], [0.2, -0.04], [0.27, 0], [0.33, 0.3, 'o'], [0.42, 0.14], [0.52, 0.26], [0.6, -0.32, 'o'], [0.72, -0.08], [0.88, -0.03], [1, 0]]),
    lean: K(u, [[0, 0], [0.27, -0.03], [0.52, -0.15], [0.6, 0.09, 'o'], [0.74, 0.03], [1, 0]]),
    look: XY(K(u, [[0, [0.5, 0]], [0.05, [-0.95, 0.3], 'o'], [0.2, [-0.95, -0.7]], [0.3, [-0.8, -0.3]], [0.4, [0.95, -0.15], 'o'], [0.56, [0.95, -0.2]], [0.64, [0.85, -0.9], 'o'], [0.9, [0.9, -0.95]], [1, [0.5, 0]]])),
    head: { x: K(u, [[0.05, 0], [0.14, -0.03, 'b'], [0.3, -0.02], [0.44, 0.01], [0.52, -0.01], [0.6, 0.05, 'o'], [0.9, 0.03], [1, 0]]), y: K(u, [[0.52, 0], [0.6, -0.02, 'o'], [1, 0]]), a: K(u, [[0.05, 0], [0.14, -0.1, 'b'], [0.3, -0.06], [0.44, 0.04], [0.52, 0.06], [0.62, -0.12, 'o'], [0.9, -0.1], [1, 0]]) },
    blink: blinks(u * MAMA_LAUNCH_T, [0.215]),
    wingN: K(u, [[0, FOLD], [0.24, FOLD], [0.36, [-0.85, -1.0, 0.4, 0]], [0.49, [-1.55, -0.95, 0.6, 0.15], 'o'], [0.525, [-1.5, -1.0, 0.6, 0.15]], [0.61, [-3.1, -0.2, 1, 0], 'i'], [0.68, [-2.84, -0.5, 1, 0], 'o'], [0.9, [-2.9, -0.42, 1, 0]], [1, FOLD]]),
    wingF: K(u, [[0, HIDE], [0.52, HIDE], [0.61, [1.95, -0.3, 0.9, 0], 'o'], [0.9, [1.85, -0.4, 0.7, 0]], [1, HIDE]]),
  };
}
function palmAt(p) { const g = wingGeo(SH_N, wingOf(p.wingN, FOLD)), M = moodOf(p.mood, p.face); return bodyPt(g.palm[0], g.palm[1] - 0.04, p.squash + M.sq, p.lean + M.ln); }
export function mamaLaunch(u) {
  u = clamp(u, 0, 1);
  const p = launchPose(u), M = moodOf(p.mood, p.face), seat = bodyPt(SEAT[0], SEAT[1], p.squash + M.sq, p.lean + M.ln);
  let c;
  if (u < 0.27) { // the hop in: a crouch, then an arc onto her back
    const k = clamp((u - 0.06) / 0.21, 0, 1), s0 = bodyPt(SEAT[0], SEAT[1], 0, -0.03);
    c = { x: lerp(START[0], s0[0], k), y: lerp(START[1], s0[1], k) - Math.sin(k * Math.PI) * 0.3, held: false, air: k > 0, rot: -Math.sin(k * Math.PI) * 0.3, squash: u < 0.06 ? K(u, [[0, 0], [0.05, 0.4, 'o']]) : K(k, [[0, -0.3], [0.7, -0.1], [1, 0]]), stretch: 0, mood: u < 0.06 ? 'crouch' : 'ready' };
  } else if (u < REL) {
    const k = ss(0.36, 0.5, u), palm = palmAt(p);
    c = { x: lerp(seat[0], palm[0], k), y: lerp(seat[1], palm[1], k), held: true, air: false, rot: K(u, [[0.27, 0], [0.5, -0.22], [0.53, -0.22], [REL, 0.35]]), squash: K(u, [[0.27, 0], [0.32, 0.45, 'o'], [0.4, 0.05], [0.52, 0.3], [REL, -0.3, 'o']]), stretch: 0, mood: u < 0.52 ? 'crouch' : 'yell' };
  } else { // off the wing: up and out at the villain
    const p0 = palmAt(launchPose(REL)), v = u - REL;
    c = { x: p0[0] + v * 5.0, y: p0[1] - v * 4.2, held: false, air: true, rot: -0.6, squash: 0, stretch: 0.22, mood: 'yell' };
  }
  p.chick = c;
  return p;
}
const launchAnim = anim(MAMA_LAUNCH_T, false, [0.0, 0.11, 0.2, 0.31, 0.375, 0.47], (u) => launchPose(u / MAMA_LAUNCH_T));

export const MAMA_ANIMS = {
  idle: anim(6, true, [0.3, 2.5, 4.28, 4.5, 4.8, 5.3], idle),
  worried: anim(2.4, true, [0.05, 0.22, 0.85, 1.35, 2.05, 2.17], worried),
  gasp: anim(1.3, false, [0, 0.13, 0.22, 0.33, 0.5, 1.2], gasp),
  angry: anim(1.8, false, [0, 0.17, 0.25, 0.34, 0.5, 1.2], angry),
  cry: anim(2.4, true, [0.09, 0.3, 1.45, 1.68, 2.05, 2.3], cry),
  aww: anim(2.6, false, [0.1, 0.34, 0.8, 1.5, 1.9, 2.5], aww),
  cheer: anim(1.6, false, [0, 0.2, 0.33, 0.44, 0.67, 1.3], cheer),
  dance: anim(2, true, [0.08, 0.3, 0.58, 0.8, 1.08, 1.75], dance),
  proud: anim(2.4, false, [0.1, 0.5, 0.92, 1.14, 1.34, 2.3], proud),
  launch: { len: MAMA_LAUNCH_T, loop: false, keys: launchAnim.keys, pose(u) { const p = launchAnim.pose(u); p.chick = mamaLaunch(clamp(u / MAMA_LAUNCH_T, 0, 1)).chick; return p; } },
};
