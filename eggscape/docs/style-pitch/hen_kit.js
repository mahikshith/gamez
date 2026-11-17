// Shared kit for the hen style pitch (hen_a.js, hen_b.js). Nothing here is wired into the game.
//   - shape helpers: closed splines, bendy feathers (a leaf on a curved spine), tapered capsules
//   - celFill: the new look. No ink contour: every form is a colour block with a soft 3-tone cel (lit / mid / shade
//     crescent on the lower right), a rim light inside the shade, and at most a hair-thin same-hue edge.
//   - drawEye: the acting eye (upper + lower lid, tilt, arc, pupil dart, wet shimmer, highlights)
//   - henPose(state, t, persona): the animation. Every state is authored as timed key poses with eases (anticipation,
//     overshoot, settle) plus procedural layers (breathing, blinks, darts, tremble). It is a pure function of time, so
//     secondary motion is derived by sampling the pose slightly in the past: comb, wattle, tail and wing tips trail
//     the body and overshoot (follow-through) without any stored state.
//   - drawFx: tears, sweat, steam, notes, Zs, shock lines, sparkles, loose feathers.
// Units: the hen is authored in a 100-unit tall box, origin at the ground between the feet, y down.

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, k) => a + (b - a) * k;
export const ss = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
export const fract = (x) => x - Math.floor(x);
export const hash = (n) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);

const EASE = {
  lin: (x) => x,
  in: (x) => x * x * x,
  out: (x) => 1 - Math.pow(1 - x, 3),
  io: (x) => x * x * (3 - 2 * x),
  back: (x) => 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2), // overshoots, then settles
  snap: (x) => 1 - Math.pow(1 - x, 5),
};

export const HEN_STATES = ['idle', 'worried', 'cheer', 'cry', 'peck', 'walk', 'angry', 'dance', 'wave', 'sleepy'];
export const HEN_STATE_LABEL = { idle: 'Idle', worried: 'Worried gasp', cheer: 'Cheer jump', cry: 'Cry', peck: 'Peck', walk: 'Flap-walk', angry: 'Angry', dance: 'Celebrate dance', wave: 'Wave (front)', sleepy: 'Sleepy' };

/* ------------------------------------------------------------------ shapes */
// Closed Catmull-Rom spline through pts ([x, y] pairs) appended to a Path2D.
export function addSpline(path, pts, k = 1 / 6) {
  const n = pts.length;
  path.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    path.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k, p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k, p2[0], p2[1]);
  }
  path.closePath();
  return path;
}
export const spline = (pts, k) => addSpline(new Path2D(), pts, k);

// A feather / leaf on a curved spine. a: direction (0 = up, + = clockwise), bend: extra turn reached at the tip.
const LEAF = [[0, 0.62], [0.24, 0.94], [0.5, 1], [0.74, 0.82], [0.92, 0.46]];
export function addFeather(path, x0, y0, a, len, w, bend = 0, prof = LEAF) {
  const L = [], R = [];
  let x = x0, y = y0, pu = 0;
  for (let i = 0; i < prof.length; i++) {
    const u = prof[i][0], ang = a + bend * Math.pow(u, 1.5), du = u - pu;
    const am = a + bend * Math.pow((u + pu) / 2, 1.5);
    x += Math.sin(am) * len * du; y -= Math.cos(am) * len * du; pu = u;
    const nx = Math.cos(ang), ny = Math.sin(ang), hw = w * 0.5 * prof[i][1];
    L.push([x - nx * hw, y - ny * hw]); R.push([x + nx * hw, y + ny * hw]);
  }
  const at = a + bend;
  const tip = [x + Math.sin(at) * len * (1 - pu), y - Math.cos(at) * len * (1 - pu)];
  return addSpline(path, [...L, tip, ...R.reverse()]);
}
export function featherTip(x0, y0, a, len, bend = 0) { // where the tip of that feather ends up
  let x = x0, y = y0, pu = 0;
  for (let i = 1; i <= 6; i++) { const u = i / 6, am = a + bend * Math.pow((u + pu) / 2, 1.5); x += Math.sin(am) * len * (u - pu); y -= Math.cos(am) * len * (u - pu); pu = u; }
  return [x, y];
}

// Tapered capsule from (x1, y1, r1) to (x2, y2, r2).
export function addCapsule(path, x1, y1, r1, x2, y2, r2) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  path.moveTo(x1 + Math.cos(a + Math.PI / 2) * r1, y1 + Math.sin(a + Math.PI / 2) * r1);
  path.arc(x1, y1, r1, a + Math.PI / 2, a - Math.PI / 2);
  path.arc(x2, y2, r2, a - Math.PI / 2, a + Math.PI / 2);
  path.closePath();
  return path;
}

// The look. c: { base, hi?, mid, shade, rim?, edge?, ew? }. The lit copy is the same path slid toward the light
// (top-left), so the shade is a crescent that follows the form; `g` = [x0, y0, x1, y1] adds a hi -> base gradient.
export function celFill(ctx, path, c, sx = 3, sy = 4, g = null) {
  if (c.edge) { ctx.strokeStyle = c.edge; ctx.lineWidth = c.ew || 1.2; ctx.lineJoin = 'round'; ctx.stroke(path); }
  ctx.fillStyle = c.shade; ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  if (c.rim) { ctx.strokeStyle = c.rim; ctx.lineWidth = 2.2; ctx.stroke(path); }
  if (c.mid) { ctx.translate(-sx * 0.42, -sy * 0.42); ctx.fillStyle = c.mid; ctx.fill(path); ctx.translate(-sx * 0.58, -sy * 0.58); } else ctx.translate(-sx, -sy);
  if (g && c.hi) { const gr = ctx.createLinearGradient(g[0], g[1], g[2], g[3]); gr.addColorStop(0, c.hi); gr.addColorStop(1, c.base); ctx.fillStyle = gr; } else ctx.fillStyle = c.base;
  ctx.fill(path);
  ctx.restore();
}

// The cheap cel for small parts (no clip): the shade copy sits a hair down-right of the lit copy. The thin edge is
// only on the shade side, so the line is lost on the lit side.
export function celLite(ctx, path, c, sx = 1.6, sy = 2) {
  ctx.save();
  ctx.translate(sx * 0.5, sy * 0.5);
  if (c.edge) { ctx.strokeStyle = c.edge; ctx.lineWidth = c.ew || 1; ctx.lineJoin = 'round'; ctx.stroke(path); }
  ctx.fillStyle = c.shade; ctx.fill(path);
  if (c.mid) { ctx.translate(-sx * 0.45, -sy * 0.45); ctx.fillStyle = c.mid; ctx.fill(path); ctx.translate(-sx * 0.55, -sy * 0.55); } else ctx.translate(-sx, -sy);
  ctx.fillStyle = c.base; ctx.fill(path);
  ctx.restore();
}

/* ------------------------------------------------------------------ the eye */
// e: { lidU, lidL (0..1 cover from the top / the bottom), tilt (+ = inner end lower: angry), arc (+ = lid edge bows
// up: a happy shut eye is lidU + lidL >= 1 with arc 1), px, py (-1..1), ps (pupil scale), wet, side (-1 screen-left eye) }
// st: { white, shadow, pupil, iris, lid, lidLo, lash, rim, flick }
export function drawEye(ctx, cx, cy, rx, ry, e, st, t = 0) {
  const side = e.side || 1;
  // socket: a same-hue darker ring, heavier on top, so the white reads on a pale face without an ink line
  ctx.fillStyle = st.rim;
  ctx.beginPath(); ctx.ellipse(cx, cy - 0.35, rx + 0.95, ry + 1.05, 0, 0, TAU); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.clip();
  ctx.fillStyle = st.white; ctx.fillRect(cx - rx - 1, cy - ry - 1, rx * 2 + 2, ry * 2 + 2);
  ctx.fillStyle = st.shadow; // the lid's cast shadow on the eyeball
  ctx.beginPath(); ctx.ellipse(cx, cy - ry * 1.12, rx * 1.3, ry * 0.5, 0, 0, TAU); ctx.fill();
  const shut = clamp((e.lidU + e.lidL - 0.86) / 0.14, 0, 1);
  if (shut < 1) {
    const rp = Math.min(rx, ry) * 0.6 * e.ps;
    const px = cx + clamp(e.px, -1, 1) * Math.max(0.5, rx - rp * 0.82), py = cy + clamp(e.py, -1, 1) * Math.max(0.5, ry - rp * 0.86);
    ctx.fillStyle = st.pupil; ctx.beginPath(); ctx.arc(px, py, rp, 0, TAU); ctx.fill();
    ctx.fillStyle = st.iris; ctx.beginPath(); ctx.ellipse(px, py + rp * 0.4, rp * 0.6, rp * 0.4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    const wob = e.wet ? Math.sin(t * 9) * 0.06 * e.wet : 0;
    ctx.beginPath(); ctx.arc(px - rp * (0.34 + wob), py - rp * 0.38, rp * (0.36 + 0.1 * (e.wet || 0)), 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(px + rp * 0.4, py + rp * (0.4 - wob), rp * (0.15 + 0.12 * (e.wet || 0)), 0, TAU); ctx.fill();
    if (e.wet) { // a pool of tears welling along the lower lid
      ctx.fillStyle = 'rgba(120,200,255,0.55)';
      ctx.beginPath(); ctx.ellipse(cx, cy + ry * (1.02 - e.lidL * 2), rx * 1.2, ry * (0.3 + 0.05 * Math.sin(t * 7)) * e.wet, 0, 0, TAU); ctx.fill();
    }
  }
  // lids
  const yTop = cy - ry + e.lidU * 2 * ry, tl = e.tilt * rx * 0.55 * (1 - shut * 0.6);
  const yIn = yTop + tl, yOut = yTop - tl;
  const yL = side < 0 ? yOut : yIn, yR = side < 0 ? yIn : yOut; // left end, right end of the edge
  const mid = yTop - e.arc * ry * 0.42, cY = 2 * mid - (yL + yR) / 2;
  if (e.lidL > 0.01) {
    const yb = cy + ry - e.lidL * 2 * ry;
    ctx.fillStyle = st.lidLo || st.lid;
    ctx.beginPath(); ctx.moveTo(cx - rx - 2, cy + ry + 2); ctx.lineTo(cx - rx - 2, yb + ry * 0.36); ctx.quadraticCurveTo(cx, yb - ry * 0.36, cx + rx + 2, yb + ry * 0.36); ctx.lineTo(cx + rx + 2, cy + ry + 2); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = st.lid;
  ctx.beginPath(); ctx.moveTo(cx - rx - 2, cy - ry - 2); ctx.lineTo(cx + rx + 2, cy - ry - 2); ctx.lineTo(cx + rx + 2, yR); ctx.quadraticCurveTo(cx, cY, cx - rx - 2, yL); ctx.closePath(); ctx.fill();
  if (st.lidHi) { // a soft sheen on the lid (eyeshadow)
    ctx.fillStyle = st.lidHi; ctx.beginPath(); ctx.ellipse(cx - rx * 0.25, Math.min(cy - ry * 0.55, yTop - ry * 0.5), rx * 0.6, ry * 0.22, 0, 0, TAU); ctx.fill();
  }
  // lash line along the upper lid edge
  ctx.strokeStyle = st.lash; ctx.lineWidth = (st.lashW || 1.9) + shut * 0.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - rx - 2, yL); ctx.quadraticCurveTo(cx, cY, cx + rx + 2, yR); ctx.stroke();
  ctx.restore();
  if (st.flick) { // lashes: two little flicks at the outer corner, riding the lid
    const ox = cx + side * (rx + 0.2), oy = clamp(side < 0 ? yL : yR, cy - ry * 0.75, cy + ry * 0.6);
    ctx.fillStyle = st.lash;
    for (let i = 0; i < 2; i++) {
      const a = side * (0.9 + i * 0.55) - 0.0, l = st.flick * (i ? 0.75 : 1);
      ctx.beginPath();
      ctx.moveTo(ox - side * 1.6, oy - 1.3 + i * 1.6);
      ctx.quadraticCurveTo(ox + Math.sin(a) * l * 0.6, oy - Math.cos(a) * l * 0.3 + i * 1.2, ox + Math.sin(a) * l, oy - Math.cos(a) * l + i * 1.6);
      ctx.quadraticCurveTo(ox + Math.sin(a) * l * 0.4, oy + 0.9 + i * 1.4, ox - side * 1.2, oy + 1.2 + i * 1.2);
      ctx.closePath(); ctx.fill();
    }
  }
}

// A brow: tapered capsule, thick at the inner end. ang > 0 = angry (inner end down). side -1 = screen-left eye.
export function drawBrow(ctx, cx, cy, half, ang, side, col, r1 = 2.1, r2 = 1.2) {
  const dx = Math.cos(ang) * half, dy = Math.sin(ang) * half;
  const p = new Path2D(); addCapsule(p, cx - side * dx, cy + dy, r1, cx + side * dx, cy - dy, r2);
  ctx.fillStyle = col; ctx.fill(p);
}

// Beak, seen from the front to three-quarter (T slides the tip toward where she faces). (bx, by) = the mouth line
// centre, w = half width, h = upper beak length. open 0..1 drops the lower beak (a bowl with the tongue in it);
// mo lifts (+) or drops (-) the corners: a smile or a pout.
export function drawBeak(ctx, bx, by, w, h, T, open, mo, c) {
  by -= open * h * 0.12;
  const cy = by - mo * h * 0.13, tx = bx + T * w * 0.7;
  const ly = by + h * 0.62 + open * h * 1.0, lx = T * w * 0.35;
  const lo = new Path2D();
  lo.moveTo(bx - w * 0.84, cy + 0.4); lo.bezierCurveTo(bx - w * 0.8 + lx, ly + h * 0.42, bx + w * 0.8 + lx, ly + h * 0.42, bx + w * 0.84, cy + 0.4); lo.closePath();
  ctx.fillStyle = c.lo; ctx.fill(lo);
  if (open > 0.06) {
    ctx.save(); ctx.clip(lo);
    ctx.fillStyle = c.mouth;
    ctx.beginPath(); ctx.moveTo(bx - w * 0.68, cy); ctx.bezierCurveTo(bx - w * 0.62 + lx, ly + h * 0.2, bx + w * 0.62 + lx, ly + h * 0.2, bx + w * 0.68, cy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = c.tongue;
    ctx.beginPath(); ctx.ellipse(bx + lx * 0.9, ly + h * 0.12, w * 0.4, h * 0.3 * Math.min(1, open * 1.6), 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  const up = new Path2D();
  up.moveTo(bx - w, cy);
  up.quadraticCurveTo(bx, by - h * 0.7, bx + w, cy);
  up.quadraticCurveTo(bx + w * 0.86 + T * w * 0.45, by + h * 0.52, tx, by + h);
  up.quadraticCurveTo(bx - w * 0.86 + T * w * 0.45, by + h * 0.52, bx - w, cy);
  up.closePath();
  celLite(ctx, up, c, w * 0.16, h * 0.2);
  ctx.fillStyle = c.gl; ctx.beginPath(); ctx.ellipse(bx - w * 0.3 + T * w * 0.2, by - h * 0.12, w * 0.3, h * 0.11, -0.25, 0, TAU); ctx.fill();
  ctx.fillStyle = c.nos;
  ctx.beginPath(); ctx.ellipse(bx - w * 0.24 + T * w * 0.42, by + h * 0.2, w * 0.07, h * 0.06, 0.5, 0, TAU); ctx.ellipse(bx + w * 0.24 + T * w * 0.42, by + h * 0.2, w * 0.07, h * 0.06, -0.5, 0, TAU); ctx.fill();
}

// Wattle: two soft drops that swing late.
const DROP = [[0, 0.5], [0.35, 0.8], [0.68, 1], [0.9, 0.7]];
export function drawWattle(ctx, x, y, len, w, swing, stretch, c) {
  const p = new Path2D(), l = len * (1 + stretch);
  addFeather(p, x - w * 0.36, y, Math.PI - swing * 0.8 + 0.1, l * 0.92, w * (1 - stretch * 0.4), -swing * 0.9, DROP);
  addFeather(p, x + w * 0.36, y, Math.PI - swing - 0.1, l, w * (1 - stretch * 0.4), -swing * 1.1, DROP);
  celLite(ctx, p, c, w * 0.2, len * 0.16);
}

// Wing: three finger feathers from one root (they overlap into one leaf when the wing is folded and fan out on a fling).
// w: -1 screen-left wing, +1 screen-right. Returns { path, tip }.
export function wingPath(sx, sy, w, raise, bend, spread, len, wid, rest = 0.16) {
  const a = Math.PI - w * (raise + rest * (1 - ss(0.3, 1.2, raise))), path = new Path2D(), F = [0.82, 1, 0.8];
  len *= 1 + 0.28 * ss(0.7, 2.1, raise); // a flung wing reaches
  for (let j = -1; j <= 1; j++) addFeather(path, sx, sy, a + w * j * spread * 0.44, len * F[j + 1], wid * (j ? 0.86 : 1), -w * bend * (1 - 0.18 * j));
  return { path, tip: featherTip(sx, sy, a, len, -w * bend) };
}

// Foot: a short leg and three stubby toes. (fx, fy) = the sole; hip = where the leg leaves the body.
export function drawFoot(ctx, fx, fy, hipx, hipy, T, c, k = 1) {
  const p = new Path2D();
  addCapsule(p, hipx, hipy, 2.1 * k, fx, fy - 2.4 * k, 1.9 * k);
  for (let j = -1; j <= 1; j++) addCapsule(p, fx, fy - 2.4 * k, 2.1 * k, fx + (j * 5.6 + T * 4) * k, fy - (j ? 1.7 : 1.1) * k, (j ? 1.8 : 2.05) * k);
  celLite(ctx, p, c, 0.9 * k, 1.1 * k);
}

/* ------------------------------------------------------------------ animation */
// wl / wr: wing raise of the screen-left / screen-right wing (0 folded, PI/2 straight out, PI straight up);
// wbl / wbr: wing curl (+ = the tip leads further round, - = the tip curls back to the body: a hand on the hip);
// ws: finger-feather spread. bl / br: brow angle (+ angry, - sad), by: brow raise. turn: 0 front .. 1 three-quarter ..
// 1.3 near profile (written for a hen facing screen-right; resolvePose mirrors for face -1).
export const REST = {
  x: 0, y: 0, sq: 0, lean: 0, turn: 0.62, hx: 0, hy: 0, hr: 0, nod: 0,
  open: 1, lidL: 0.08, lidR: 0.08, low: 0, arc: 0.45, bl: 0, br: 0, by: 0, px: 0.3, py: 0.08, ps: 1, wet: 0,
  beak: 0, mo: 0.3, wl: 0.06, wr: 0.06, wbl: 0, wbr: 0, ws: 0.2, fl: 0, fr: 0, sl: 0, sr: 0, ta: 0, cb: 0,
  tear: 0, wail: 0, sweat: 0, blush: 0.55, flush: 0, zz: 0, notes: 0, steam: 0, shock: 0, sparkle: 0, puff: 0, bubble: 0,
};
const KEYS = Object.keys(REST);

// keys: [[time, poseDelta, ease]], each delta is over `R` (so every key is a complete pose)
function track(u, R, keys) {
  let i = 0;
  while (i < keys.length - 1 && u >= keys[i + 1][0]) i++;
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
  const out = Object.assign({}, R, a[1]);
  if (a === b || u <= a[0]) return out;
  const k = (EASE[b[2] || 'io'])(clamp((u - a[0]) / (b[0] - a[0]), 0, 1));
  const B = b[1];
  for (const key of KEYS) { const vb = key in B ? B[key] : R[key]; out[key] = out[key] + (vb - out[key]) * k; }
  return out;
}
function slot(tt, period, seed, dur, prob) {
  const k = Math.floor(tt / period);
  if (hash(k * 1.7 + seed) > prob) return { u: -1, k };
  const start = hash(k * 3.1 + seed + 9) * (period - dur - 0.2) + 0.1;
  const u = (tt - k * period - start) / dur;
  return { u: u >= 0 && u <= 1 ? u : -1, k };
}
export function blinkAt(t, seed = 0) {
  const b = slot(t + seed * 7.3, 2.9, 1 + seed, 0.2, 0.95);
  let v = b.u < 0 ? 0 : Math.sin(b.u * Math.PI);
  if (hash(b.k * 7.7 + 2) > 0.6) { const b2 = slot(t + seed * 7.3 - 0.27, 2.9, 1 + seed, 0.2, 0.95); if (b2.u >= 0) v = Math.max(v, Math.sin(b2.u * Math.PI)); }
  return Math.pow(v, 0.6);
}

// a moment in the middle of the idle "look at the player" (for the pose sheets)
export function idleLookTime() { for (let t = 0; t < 80; t += 0.02) { const g = slot(t, 5.6, 3, 1.9, 0.9); if (g.u > 0.4 && g.u < 0.5) return t; } return 0; }

const STATES = {
  idle(t, R, per) {
    const p = Object.assign({}, R), br = Math.sin(t * 2.5);
    p.sq = 0.016 * br; p.hy = 0.7 * Math.sin(t * 2.5 - 0.7); p.lean = 0.022 * Math.sin(t * 0.9);
    p.wl += 0.05 * Math.sin(t * 2.5 - 1.1); p.wr += 0.05 * Math.sin(t * 2.5 - 1.1);
    // eye darts: snap, hold, snap back
    const d = slot(t, 2.1, 6, 0.85, 0.75), de = d.u < 0 ? 0 : ss(0, 0.09, d.u) * (1 - ss(0.88, 1, d.u));
    p.px += de * (hash(d.k * 4.1) * 1.3 - 0.9); p.py += de * (hash(d.k * 2.3 + 1) - 0.55) * 0.9;
    // a look at the player: the head turns to the front with a tilt, brows pop
    const g = slot(t, 5.6, 3, 1.9, 0.9);
    if (g.u >= 0) {
      const e = EASE.back(clamp(g.u / 0.16, 0, 1)) * (1 - ss(0.84, 1, g.u));
      p.turn = lerp(R.turn, 0.06, e); p.hr += 0.15 * e * (hash(g.k) > 0.5 ? 1 : -1); p.px = lerp(p.px, 0, e); p.py = lerp(p.py, 0, e);
      p.by += 1.6 * e; p.mo += 0.5 * e;
      if (per.id === 'b') { p.bl += 0.25 * e; p.br -= 0.5 * e; p.lidR = lerp(p.lidR, 0.12, e); } // one brow up: "really?"
    }
    // tail wiggle
    const w = slot(t, 3.7, 8, 0.6, 0.75);
    if (w.u >= 0) p.ta += Math.sin(w.u * TAU * 3) * 0.3 * Math.sin(w.u * Math.PI);
    if (per.id === 'b') { const f = slot(t, 4.3, 5, 1.3, 0.8); if (f.u >= 0) p.fl = Math.max(0, Math.sin(f.u * TAU * 4)) * 2.4; } // impatient foot tap
    return p;
  },
  worried(t, R, per) {
    const W = { sq: 0, y: 0, open: 1.26, lidL: 0, lidR: 0, ps: 0.42, beak: 1, mo: -0.6, wl: 2.3, wr: 2.3, wbl: 1.1, wbr: 1.1, ws: 0.75, bl: -0.55, br: -0.55, by: 2.2, cb: 1, shock: 0, sweat: 1, turn: 0.22, px: 0, py: 0, blush: 0.2, hy: -1 };
    let p = track(t, R, [
      [0, {}],
      [0.1, { sq: 0.18, lidL: 0.62, lidR: 0.62, hy: 2.5, by: -1.2, wl: -0.1, wr: -0.1, beak: 0.1, turn: 0.4 }, 'out'], // anticipation: a flinch down
      [0.22, Object.assign({}, W, { sq: -0.22, y: 8, shock: 1, puff: 1, sweat: 0 }), 'snap'],
      [0.4, Object.assign({}, W, { sq: 0.07, shock: 0.8, puff: 0.5 }), 'io'],
      [0.56, Object.assign({}, W, { sq: -0.02, shock: 0.3 }), 'io'],
      [0.7, W, 'io'],
    ]);
    if (t > 0.5) {
      const k = ss(0.5, 0.8, t), u = t - 0.5;
      const gl = Math.sin(u * 4.4), side = (ss(-0.25, 0.25, gl) * 2 - 1);
      p.x += Math.sin(t * 41) * 0.55 * k; // tremble
      p.px = side * 0.62 * k; p.turn = 0.22 + side * 0.22 * k; p.hr = side * 0.05 * k;
      p.fl = Math.max(0, Math.sin(t * 21)) * 1.8 * k; p.fr = Math.max(0, -Math.sin(t * 21)) * 1.8 * k; // pitter-patter panic feet
      p.beak = 0.8 + 0.2 * Math.sin(t * 17);
      const j = fract(u / 1.9); // every so often the panic spikes again
      const jo = Math.exp(-j * 7) * Math.sin(j * 16) * k * (u > 1 ? 1 : 0);
      p.y += Math.max(0, jo) * 5; p.sq -= jo * 0.09;
    }
    return p;
  },
  cheer(t, R, per) {
    const u = t % 1.5, H = { lidL: 0.56, lidR: 0.56, low: 0.5, arc: 1, by: 3, mo: 1 };
    const hgt = per.id === 'b' ? 30 : 38;
    return track(u, R, [
      [0, {}],
      [0.17, { sq: 0.25, wl: -0.28, wr: -0.28, wbl: -0.3, wbr: -0.3, lidL: 0.42, lidR: 0.42, py: -0.5, px: 0, hy: 2, by: -1, ta: -0.4, turn: 0.4, mo: 0.6 }, 'out'], // crouch (anticipation)
      [0.27, { sq: -0.26, y: 10, wl: 0.9, wr: 0.9, ws: 0.5, beak: 0.6, by: 2, turn: 0.3, mo: 1 }, 'in'], // launch, stretched
      [0.5, Object.assign({ y: hgt, sq: -0.04, wl: 2.25, wr: 2.25, ws: 1, beak: 1, fl: 6, fr: 6, sl: -5, sr: 5, turn: 0.18, ta: 0.5, sparkle: 1, px: 0, py: -0.2 }, H), 'out'], // apex: star pose
      [0.6, Object.assign({ y: hgt - 1.5, sq: 0.0, wl: 2.15, wr: 2.15, ws: 1, beak: 1, fl: 6.5, fr: 6.5, sl: -6, sr: 6, turn: 0.18, ta: 0.5, sparkle: 1 }, H), 'io'], // hang time
      [0.76, Object.assign({ y: 7, sq: -0.18, wl: 2.6, wr: 2.6, ws: 0.8, beak: 0.9, fl: 1.5, fr: 1.5, turn: 0.25 }, H), 'in'], // fall, wings trail up
      [0.84, Object.assign({ y: 0, sq: 0.27, wl: 1.3, wr: 1.3, ws: 0.6, beak: 0.5, puff: 1, turn: 0.3 }, H), 'lin'], // land: squash
      [1.0, { sq: -0.08, y: 3, wl: 0.25, wr: 0.25, beak: 0.45, mo: 1, by: 1.5, turn: 0.4 }, 'out'], // rebound
      [1.16, { sq: 0.035, beak: 0.3, mo: 1, turn: 0.5 }, 'io'],
      [1.34, { mo: 0.8 }, 'io'],
      [1.5, {}, 'io'],
    ]);
  },
  cry(t, R, per) {
    const p = Object.assign({}, R, { turn: 0.34, hy: 3, nod: 0.55, bl: -0.85, br: -0.85, by: 1.4, lidL: 0.2, lidR: 0.2, low: 0.2, arc: 0.2, wet: 1, ps: 1.16, px: 0.05, py: 0.4, beak: 0.2, mo: -1, tear: 1, ta: -0.55, cb: -0.7, sq: 0.05, blush: 0.75, wl: 0.0, wr: 0.0 });
    const k = ss(0, 0.35, t); for (const key of KEYS) p[key] = lerp(R[key], p[key], k);
    const s = fract(t / 0.8), hic = Math.exp(-s * 6.5) * Math.sin(Math.min(1, s * 5) * Math.PI * 0.5 + 0.4); // sobs: a sharp hitch up, then sink
    p.y += 2.6 * hic * k; p.sq -= 0.06 * hic * k; p.beak = 0.16 + 0.3 * hic; p.hy -= 1.5 * hic;
    const u = t % 4.6;
    const wipe = ss(0.5, 0.75, u) * (1 - ss(1.75, 2.0, u)); // a wing wipes the near eye
    if (wipe > 0) { p.wl = lerp(p.wl, 2.3 + 0.14 * Math.sin(u * 13), wipe); p.wbl = lerp(p.wbl, 1.2, wipe); p.lidL = lerp(p.lidL, 0.8, wipe); p.hr -= 0.08 * wipe; }
    const w = ss(2.5, 2.72, u) * (1 - ss(4.0, 4.3, u)); // the wail: head back, beak wide, fountains
    if (w > 0) {
      p.nod = lerp(p.nod, -0.85, w); p.hy = lerp(p.hy, -3, w); p.beak = lerp(p.beak, 1, w); p.lidL = lerp(p.lidL, 0.6, w); p.lidR = lerp(p.lidR, 0.6, w); p.low = lerp(p.low, 0.42, w); p.arc = lerp(p.arc, -0.5, w);
      p.wail = w; p.tear = 1 - w; p.x += Math.sin(t * 33) * 0.6 * w; p.sq = lerp(p.sq, -0.06, w); p.turn = lerp(p.turn, 0.12, w);
      p.wl = 0.9 * w + 0.25 * Math.sin(t * 15) * w; p.wr = 0.9 * w - 0.25 * Math.sin(t * 15) * w; p.ws = 0.6; p.cb = lerp(p.cb, 0.4, w); p.by += 1.5 * w;
    }
    return p;
  },
  peck(t, R, per) {
    const u = t % 2.1, S = { turn: 1.15, px: 0.5, py: 0.75, x: -9 }, dn = per.id === 'b' ? 0.7 : 0.8;
    const p = track(u, R, [
      [0, {}],
      [0.2, Object.assign({ by: 1.5, hy: -1 }, S), 'io'], // spots something
      [0.4, Object.assign({ lean: -0.16, hy: -3, sq: -0.06, by: 2, ta: -0.4, wl: 0.3, wr: 0.3 }, S), 'out'], // wind up
      [0.5, Object.assign({ lean: dn, sq: 0.05, hx: 2, hy: 4, nod: 0.6, ta: 0.8, wl: 0.9, wr: 0.9, ws: 0.6, lidL: 0.45, lidR: 0.45, beak: 0.3 }, S), 'in'], // strike
      [0.62, Object.assign({ lean: 0.42, hy: -1, ta: 0.2, wl: 0.4, wr: 0.4, beak: 0 }, S), 'out'],
      [0.72, Object.assign({ lean: dn + 0.04, sq: 0.05, hx: 2, hy: 4, nod: 0.6, ta: 0.85, wl: 0.9, wr: 0.9, ws: 0.6, lidL: 0.45, lidR: 0.45, beak: 0.3 }, S), 'in'], // strike two
      [0.92, Object.assign({ lean: -0.08, sq: -0.05, hy: -2.5, ta: -0.2, by: 1 }, S), 'back'], // up, overshoot
      [1.3, Object.assign({ lean: 0, hy: 0, mo: 0.8 }, S), 'io'], // chew (layer below)
      [1.48, { turn: 0.08, hr: 0.13, by: 2.2, px: 0, py: 0, mo: 1, lidL: 0.3, lidR: 0.3, low: 0.3 }, 'back'], // pleased look at the player
      [1.85, { turn: 0.08, hr: 0.13, by: 2.2, px: 0, py: 0, mo: 1, lidL: 0.3, lidR: 0.3, low: 0.3 }, 'io'],
      [2.1, {}, 'io'],
    ]);
    const ch = ss(0.9, 1.0, u) * (1 - ss(1.3, 1.42, u));
    p.beak += ch * 0.3 * Math.max(0, Math.sin((u - 0.9) * 30)); p.hy += ch * 0.8 * Math.sin((u - 0.9) * 30);
    return p;
  },
  walk(t, R, per) {
    const ph = t * TAU / 0.62, p = Object.assign({}, R, { turn: 0.95, ws: 0.55, mo: 0.9, beak: 0.25, by: 1.2, px: 0.45, py: 0 });
    const s = Math.sin(ph), c = Math.cos(ph);
    p.fl = Math.max(0, s) * 6; p.fr = Math.max(0, -s) * 6; p.sl = c * 6.5; p.sr = -c * 6.5;
    p.y = 2.6 * Math.abs(s); p.sq = 0.045 * Math.cos(ph * 2); // down on the contact, up on the passing pose
    p.lean = 0.1 * c + 0.04; p.hr = -0.085 * c; // waddle; the head counter-tilts
    const hb = fract(ph / Math.PI); // the chicken head bob: hold, hold, then dart forward
    p.hx = 3.4 * (hb < 0.7 ? -hb / 0.7 : -1 + EASE.snap((hb - 0.7) / 0.3)) + 1.7;
    p.wl = 0.75 + 0.6 * Math.sin(ph * 2 + 0.6); p.wr = 0.75 + 0.6 * Math.sin(ph * 2 + 0.6); p.wbl = 0; p.wbr = 0;
    p.ta = 0.25 * Math.sin(ph * 2 - 1);
    p.beak = 0.2 + 0.2 * Math.max(0, Math.sin(ph * 2));
    return p;
  },
  angry(t, R, per) {
    const A = { sq: 0.06, lean: 0.11, bl: 1.05, br: 1.05, by: -2.6, lidL: 0.34, lidR: 0.34, low: 0.2, arc: 0.1, ps: 0.72, beak: 0, mo: -1, wl: 0.75, wr: 0.75, wbl: -2.1, wbr: -2.1, ws: 0.3, steam: 1, flush: 1, turn: 0.42, cb: 1, px: 0.3, py: 0.25, blush: 0.9 };
    const p = track(t, R, [
      [0, {}],
      [0.16, { sq: -0.12, by: 3.2, lidL: 0, lidR: 0, wl: 0.5, wr: 0.5, hy: -2, turn: 0.42, beak: 0.5, ps: 0.8, lean: -0.06 }, 'out'], // the sharp inhale
      [0.3, Object.assign({}, A, { sq: 0.16, lean: 0.16 }), 'in'], // slam down into the glare
      [0.46, A, 'back'],
    ]);
    if (t > 0.4) {
      const k = ss(0.4, 0.6, t), u = t - 0.4;
      p.x += Math.sin(t * 47) * 0.4 * k; // seething
      const st = fract(u / 0.62); // foot stomp: lift, slam, the body jolts
      p.fl = (st < 0.5 ? Math.sin(st / 0.5 * Math.PI) : 0) * 5 * k;
      const jolt = st > 0.5 ? Math.exp(-(st - 0.5) * 16) : 0;
      p.sq += jolt * 0.07 * k; p.lean += jolt * 0.03;
      const q = u % 2.6; // every so often she lets rip: wings slam down, beak wide
      const sq = ss(1.5, 1.62, q) * (1 - ss(2.1, 2.3, q));
      if (sq > 0) { p.beak = lerp(p.beak, 1, sq); p.lean += 0.12 * sq; p.wl = lerp(p.wl, 0.55, sq); p.wr = lerp(p.wr, 0.55, sq); p.wbl = lerp(p.wbl, 0.1, sq); p.wbr = lerp(p.wbr, 0.1, sq); p.ws = lerp(p.ws, 0.9, sq); p.sq -= 0.08 * sq; p.x += Math.sin(t * 60) * 0.5 * sq; p.lidL = lerp(p.lidL, 0.2, sq); p.lidR = lerp(p.lidR, 0.2, sq); p.shock = sq * 0.8; }
    }
    return p;
  },
  dance(t, R, per) {
    const b = 0.46, n = Math.floor(t / b), f = fract(t / b);
    const H = { lidL: 0.56, lidR: 0.56, low: 0.5, arc: 1, by: 2.5, mo: 1, beak: 0.7, notes: 1 };
    const beat = (k) => {
      k = ((k % 8) + 8) % 8;
      if (k < 4) { const s = k % 2 ? -1 : 1; // the point: hip one way, the far wing to the sky, the other on the hip
        return Object.assign({ lean: 0.15 * s, hr: -0.13 * s, turn: 0.4 * s, x: 3 * s, wl: s > 0 ? 2.5 : 0.75, wr: s > 0 ? 0.75 : 2.5, wbl: s > 0 ? 0.2 : -2.1, wbr: s > 0 ? -2.1 : 0.2, ws: 0.8, fl: s > 0 ? 3.5 : 0, fr: s > 0 ? 0 : 3.5, sl: s > 0 ? 3 : 0, sr: s > 0 ? 0 : -3, ta: 0.3 * s }, H); }
      if (k < 6) { const s = k % 2 ? -1 : 1; // raise the roof, looking right at you
        return { lean: 0.05 * s, turn: 0.0, wl: 2.5, wr: 2.5, ws: 1, beak: 0.9, mo: 1, by: 3, px: 0, py: 0, x: -2 * s, hr: 0.1 * s, sparkle: 1, notes: 1, lidL: s > 0 ? 0.08 : 0.9, arc: s > 0 ? 0.45 : 1, low: s > 0 ? 0.2 : 0.2 }; }
      if (k === 6) return { sq: 0.24, wl: -0.25, wr: -0.25, turn: 0.3, mo: 1, py: -0.5, px: 0, lidL: 0.4, lidR: 0.4, notes: 1, ta: -0.4 }; // crouch for the big one
      return Object.assign({ y: 22, sq: -0.14, wl: 2.3, wr: 2.3, ws: 1, fl: 5, fr: 5, sl: -6, sr: 6, turn: 0.1, sparkle: 1, ta: 0.5 }, H); // star jump
    };
    const A = Object.assign({}, R, beat(n - 1)), B = Object.assign({}, R, beat(n));
    const fast = (n % 8) >= 6;
    const e = fast ? EASE.out(clamp(f / 0.7, 0, 1)) : EASE.back(clamp(f / 0.42, 0, 1));
    const p = {}; for (const key of KEYS) p[key] = lerp(A[key], B[key], e);
    if ((n % 8) < 6) { p.sq += 0.11 * Math.exp(-f * 6) - 0.03 * Math.sin(f * Math.PI); p.y += 3.2 * Math.sin(clamp((f - 0.15) / 0.85, 0, 1) * Math.PI); } // every beat lands with a bounce
    if ((n % 8) === 4 || (n % 8) === 5) { p.wl += 0.22 * Math.sin(t * 26); p.wr -= 0.22 * Math.sin(t * 26); }
    if ((n % 8) === 0 && n > 0) p.sq += 0.14 * Math.exp(-f * 7); // the landing after the star jump
    return p;
  },
  wave(t, R, per) {
    const W = { turn: 0, px: 0, py: 0, wr: 2.5, wbr: 0, ws: 0.95, hr: 0.12, beak: 0.65, mo: 1, by: 2.6, sparkle: 1, wl: 0.75, wbl: -2.1, low: 0.26, lidL: 0.1, lidR: 0.1 };
    const p = track(t, R, [
      [0, {}],
      [0.16, { turn: 0.2, sq: 0.13, wr: -0.15, px: 0, py: 0, mo: 0.8 }, 'out'],
      [0.36, Object.assign({}, W, { sq: -0.08, y: 2 }), 'back'],
      [0.55, W, 'io'],
    ]);
    if (t > 0.3) {
      const k = ss(0.3, 0.5, t), u = t - 0.3;
      p.wr += 0.36 * Math.sin(u * 10.5) * k; p.hr += 0.045 * Math.sin(u * 5.25 + 0.5) * k; p.x += 0.8 * Math.sin(u * 5.25) * k;
      p.y += 1.6 * Math.abs(Math.sin(u * 5.25)) * k; p.sq += 0.02 * Math.cos(u * 10.5) * k;
      const q = u % 2.4, wk = ss(1.25, 1.33, q) * (1 - ss(1.6, 1.7, q)); // a wink
      p.lidL = lerp(p.lidL, 0.62, wk); p.low = lerp(p.low, 0.42, wk * 0.0) ; if (wk > 0) { p.arc = lerp(p.arc, 1, wk); p.winkL = wk; }
    }
    return p;
  },
  sleepy(t, R, per) {
    const u = t % 4.4, p = Object.assign({}, R);
    const k = u < 2.7 ? u / 2.7 : 0, kk = EASE.io(k);
    const dz = { turn: 0.5, lidL: lerp(0.5, 0.97, kk), lidR: lerp(0.64, 1, Math.min(1, kk * 1.25)), arc: -0.25, nod: 0.15 + 0.85 * kk, hy: 4.5 * kk, lean: 0.13 * kk, sq: 0.05, beak: 0.12 + 0.1 * kk, mo: -0.2, bl: -0.35, br: -0.35, by: -1.2, cb: -0.9, px: 0.1, py: 0.5, zz: 1, bubble: kk, wl: -0.05, wr: -0.05, ta: -0.6, blush: 0.6 };
    if (u < 2.7) {
      Object.assign(p, dz);
      for (const at of [0.42, 0.72]) { const d = (k - at) / 0.07; if (d > 0 && d < 1) { const j = Math.sin(d * Math.PI); p.nod -= 0.35 * j; p.hy -= 2 * j; p.lidL -= 0.25 * j; p.lean -= 0.04 * j; } } // catches herself, nearly
      p.sq += 0.02 * Math.sin(t * 1.9); // slow, heavy breath
    } else {
      const awake = { turn: 0.5, y: 0, sq: 0, lidL: 0, lidR: 0, open: 1.22, ps: 0.5, by: 4, cb: 1, shock: 0, px: 0, py: 0, mo: -0.3, beak: 0.3, blush: 0.9 };
      const q = track(u, Object.assign({}, R, dz, { lidL: 0.97, lidR: 1, nod: 1, hy: 4.5, lean: 0.13, bubble: 0, zz: 0 }), [
        [2.7, {}],
        [2.8, Object.assign({}, awake, { y: 5, sq: -0.16, shock: 1, nod: 0, hy: -2, lean: 0, zz: 0, bubble: 0 }), 'snap'], // the bubble pops: bolt upright
        [2.96, Object.assign({}, awake, { sq: 0.06, shock: 0.5, nod: 0, hy: 0, lean: 0, zz: 0, bubble: 0 }), 'io'],
        [3.2, Object.assign({}, awake, { px: -0.7, turn: 0.2, nod: 0, hy: 0, lean: 0, zz: 0, bubble: 0, open: 1.1, ps: 0.7 }), 'back'], // did anyone see?
        [3.5, Object.assign({}, awake, { px: 0.7, turn: 0.7, nod: 0, hy: 0, lean: 0, zz: 0, bubble: 0, open: 1.1, ps: 0.7 }), 'back'],
        [3.8, Object.assign({}, awake, { px: 0.7, turn: 0.7, nod: 0, hy: 0, lean: 0, zz: 0, bubble: 0, open: 1.05, ps: 0.8, by: 1 }), 'io'],
        [4.4, Object.assign({}, dz, { lidL: 0.5, lidR: 0.64, nod: 0.15, hy: 0, lean: 0, bubble: 0, beak: 0.12 }), 'io'], // and the lids sink again
      ]);
      Object.assign(p, q);
    }
    return p;
  },
};
STATES.gasp = STATES.worried; STATES.happy = STATES.cheer; STATES.sad = STATES.cry; STATES.determined = STATES.angry; STATES.celebrate = STATES.dance;

export function henPose(state, t, per) {
  const R = per.rest || REST;
  return (STATES[state] || STATES.idle)(Math.max(0, t), R, per);
}

const headPos = (p) => ({ x: p.x + p.hx + Math.sin(p.lean) * 62, y: -p.y + p.hy + p.sq * 62 + (1 - Math.cos(p.lean)) * 62, r: p.hr + p.lean });
const NO_BLINK = { cheer: 1, dance: 0, sleepy: 1 };

// The full pose for a frame: the state's pose (optionally cross-faded from opts.from = { state, t } by opts.mix),
// blinks, the follow-through layer, then mirrored for opts.face === -1.
export function resolvePose(state, t, per, opts = {}) {
  const sample = (tt) => {
    let p = henPose(state, tt, per);
    if (opts.from && opts.mix != null && opts.mix < 1) {
      const a = henPose(opts.from.state, opts.from.t + (tt - t), per), k = EASE.io(clamp(opts.mix, 0, 1));
      for (const key of KEYS) p[key] = lerp(a[key], p[key], k);
    }
    return p;
  };
  const p = sample(t), p1 = sample(t - 0.07), p2 = sample(t - 0.14);
  const H0 = headPos(p), H1 = headPos(p1), H2 = headPos(p2);
  const bY = (q) => -q.y + q.sq * 28;
  const lag = per.lag || 1;
  // comb: trails the head sideways and stretches when the head drops under it
  p.cr = clamp(((H1.x - H0.x) * 0.075 + (H2.x - H1.x) * 0.04 + (H1.r - H0.r) * 1.6) * lag, -0.75, 0.75) + 0.035 * Math.sin(t * 2.5 - 1.3);
  p.cs = clamp(((H0.y - H1.y) * 0.03 + (H1.y - H2.y) * 0.012) * lag, -0.3, 0.42);
  // wattle: a heavier pendulum, later than the comb
  p.wtr = clamp(((H1.x - H0.x) * 0.05 + (H2.x - H0.x) * 0.045 + (H2.r - H0.r) * 1.2) * lag, -0.9, 0.9) + 0.05 * Math.sin(t * 2.5 - 2);
  p.wts = clamp(((H1.y - H0.y) * 0.03 + (H2.y - H1.y) * 0.02) * lag, -0.25, 0.3);
  // tail: droops behind a rise, flicks up on a drop
  p.tr = clamp((bY(p1) - bY(p)) * 0.045 * lag + (p2.lean - p.lean) * 0.6, -0.6, 0.6);
  // wings: the air lifts them on the way down and pins them on the way up; the tips trail the root
  const air = clamp((bY(p) - bY(p1)) * 0.05, -0.35, 0.55) * lag;
  p.wbl += clamp((p1.wl - p.wl) * 1.25 + (p2.wl - p1.wl) * 0.5, -1, 1) * lag - air * 0.6;
  p.wbr += clamp((p1.wr - p.wr) * 1.25 + (p2.wr - p1.wr) * 0.5, -1, 1) * lag - air * 0.6;
  p.wl = Math.max(-0.35, p.wl + air); p.wr = Math.max(-0.35, p.wr + air);
  // the head (when it is a separate mass) sinks into the shoulders on a launch and floats on a drop
  p.hlag = clamp((bY(p1) - bY(p)) * 0.16, -2.5, 3) * lag;
  // blink
  if (!NO_BLINK[state] && opts.blink !== false) {
    const b = opts.blinkV != null ? opts.blinkV : blinkAt(t, per.id === 'b' ? 1 : 0);
    if (b > 0 && p.lidL < 0.9) { p.lidL = lerp(p.lidL, 1, b); p.lidR = lerp(p.lidR, 1, b); p.arc = lerp(p.arc, -0.1, b); }
  }
  if ((opts.face || 1) < 0) {
    for (const k of ['turn', 'x', 'lean', 'hx', 'hr', 'px', 'cr', 'wtr']) p[k] = -p[k];
    let s;
    s = p.wl; p.wl = p.wr; p.wr = s; s = p.wbl; p.wbl = p.wbr; p.wbr = s; s = p.lidL; p.lidL = p.lidR; p.lidR = s;
    s = p.bl; p.bl = p.br; p.br = s; s = p.fl; p.fl = p.fr; p.fr = s; s = p.sl; p.sl = -p.sr; p.sr = -s;
  }
  if (opts.turn != null) p.turn = opts.turn;
  return p;
}

/* ------------------------------------------------------------------ effects */
function drop(ctx, x, y, r, rot = 0, a = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha *= a;
  ctx.beginPath(); ctx.moveTo(0, -r * 2.2); ctx.bezierCurveTo(r * 0.9, -r * 0.9, r, -r * 0.3, r, 0); ctx.arc(0, 0, r, 0, Math.PI); ctx.bezierCurveTo(-r, -r * 0.3, -r * 0.9, -r * 0.9, 0, -r * 2.2); ctx.closePath();
  ctx.fillStyle = '#58c4ff'; ctx.fill();
  ctx.fillStyle = '#d9f4ff'; ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.25, r * 0.28, r * 0.5, 0.3, 0, TAU); ctx.fill();
  ctx.restore();
}
function star4(ctx, x, y, r, col, a = 1) {
  if (r <= 0.05 || a <= 0.02) return;
  ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = col; ctx.beginPath();
  for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.32 : r, an = i * Math.PI / 4; ctx[i ? 'lineTo' : 'moveTo'](x + Math.sin(an) * rr, y - Math.cos(an) * rr); }
  ctx.closePath(); ctx.fill(); ctx.restore();
}
function note(ctx, x, y, s, col, rot, a) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); ctx.globalAlpha *= a; ctx.fillStyle = col;
  ctx.beginPath(); ctx.ellipse(0, 0, 2.3, 1.7, -0.4, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(1.5, -0.4); ctx.lineTo(1.5, -8); ctx.quadraticCurveTo(4.6, -7.4, 5.2, -4.2); ctx.quadraticCurveTo(3.8, -5.6, 2.4, -5.6); ctx.lineTo(2.4, -0.2); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function zee(ctx, x, y, s, a) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.18); ctx.scale(s, s); ctx.globalAlpha *= a;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-2.2, -2.6); ctx.lineTo(2.2, -2.6); ctx.lineTo(-2.2, 2.6); ctx.lineTo(2.2, 2.6);
  ctx.strokeStyle = '#3f58b8'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.strokeStyle = '#cfe0ff'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.restore();
}
function loose(ctx, x, y, rot, s, col, a) { // a loose feather
  const p = new Path2D(); addFeather(p, 0, 0, 0, 7, 3.6, 0.5);
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); ctx.globalAlpha *= a; ctx.fillStyle = col; ctx.fill(p); ctx.restore();
}

// A: anchors in the hen's unsquashed frame: { hx, hy, hr (head centre, half-width), eL: [x, y], eR, beak: [x, y], wave: [x, y] | null, feather }
export function drawFx(ctx, p, t, A, behind = false) {
  const { hx, hy, hr } = A;
  if (behind) {
    if (p.shock > 0.02) {
      ctx.save(); ctx.lineCap = 'round'; ctx.globalAlpha *= clamp(p.shock * 1.3, 0, 1);
      for (let i = 0; i < 7; i++) {
        const an = -1.35 + i * 0.45, r0 = hr * 1.25 + 3, r1 = r0 + (i % 2 ? 5 : 8.5) * (0.5 + 0.5 * p.shock);
        ctx.strokeStyle = i % 2 ? '#ffd23e' : '#ff9a2e'; ctx.lineWidth = i % 2 ? 1.6 : 2.2;
        ctx.beginPath(); ctx.moveTo(hx + Math.sin(an) * r0, hy - 4 - Math.cos(an) * r0 * 0.92); ctx.lineTo(hx + Math.sin(an) * r1, hy - 4 - Math.cos(an) * r1 * 0.92); ctx.stroke();
      }
      ctx.restore();
    }
    return;
  }
  if (p.tear > 0.02) {
    for (const [e, s] of [[A.eL, -1], [A.eR, 1]]) for (let i = 0; i < 2; i++) {
      const u = fract(t * 1.25 + i * 0.5 + (s > 0 ? 0.27 : 0));
      drop(ctx, e[0] + s * (5 + 5 * u), e[1] + 6 + 30 * u * u, 2.3 - u * 0.5, -s * 0.25, p.tear * (1 - ss(0.75, 1, u)));
    }
  }
  if (p.wail > 0.02) {
    for (const [e, s] of [[A.eL, -1], [A.eR, 1]]) for (let i = 0; i < 5; i++) {
      const u = fract(t * 1.7 + i * 0.2 + (s > 0 ? 0.1 : 0)), vx = s * (15 + 9 * (i % 3));
      const x = e[0] + s * 5 + vx * u, y = e[1] - 2 - 26 * u + 46 * u * u;
      drop(ctx, x, y, 2.5 - u * 0.6, Math.atan2(vx, 26 - 92 * u) + Math.PI, p.wail * (1 - ss(0.8, 1, u)));
    }
  }
  if (p.sweat > 0.02) {
    for (let i = 0; i < 3; i++) {
      const u = fract(t * 1.5 + i * 0.37), s = i % 2 ? 1 : -1, x = hx + s * (hr * 0.8 + 9 * u + i), y = hy - hr * 0.75 - 13 * u + 22 * u * u;
      drop(ctx, x, y, 2.1, s * 0.9, p.sweat * (1 - ss(0.7, 1, u)));
    }
  }
  if (p.steam > 0.02) {
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const u = fract(t * 1.6 + i / 3 + (s > 0 ? 0.17 : 0)), x = hx + s * (hr * 0.95 + 9 * u), y = hy - hr * 0.55 - 15 * u, r = 1.6 + 4.2 * u, a = p.steam * (1 - ss(0.55, 1, u));
      ctx.save(); ctx.globalAlpha *= a;
      ctx.fillStyle = '#e8b9a6'; ctx.beginPath(); ctx.arc(x + 0.5, y + 0.7, r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, r * 0.92, 0, TAU); ctx.arc(x + s * r * 0.8, y + r * 0.5, r * 0.6, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // the classic cross vein, pulsing on the temple
    const vx = hx - (A.dir || 1) * hr * 0.62, vy = hy - hr * 0.66, k = 1 + 0.18 * Math.sin(t * 12);
    ctx.save(); ctx.globalAlpha *= p.steam; ctx.translate(vx, vy); ctx.scale(k, k); ctx.strokeStyle = '#e02d3c'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(1.1, 3.6); ctx.quadraticCurveTo(1.1, 1.1, 3.6, 1.1); ctx.stroke(); }
    ctx.restore();
  }
  if (p.notes > 0.02) {
    const cols = ['#ff5d8f', '#3ec6ff', '#ffc02e'];
    for (let i = 0; i < 3; i++) {
      const u = fract(t * 0.7 + i / 3), s = i % 2 ? 1 : -1, x = hx + s * (hr * 1.05 + 6 + 8 * u) + Math.sin(t * 5 + i * 2) * 2.5, y = hy - hr * 0.3 - 30 * u;
      note(ctx, x, y, 1.05 + 0.25 * Math.sin(u * Math.PI), cols[i], 0.25 * Math.sin(t * 6 + i), p.notes * Math.sin(Math.min(1, u * 1.15) * Math.PI));
    }
  }
  if (p.zz > 0.02) {
    for (let i = 0; i < 3; i++) {
      const u = fract(t * 0.42 + i / 3), d = -(A.dir || 1), x = hx + d * (hr * 0.75 + 16 * u + 3 * Math.sin(u * 7)), y = hy - hr * 0.7 - 24 * u;
      zee(ctx, x, y, 0.7 + 1.0 * u, p.zz * Math.sin(Math.min(1, u * 1.2) * Math.PI));
    }
  }
  if (p.bubble > 0.03 && A.beak) {
    const r = 1.2 + 6.5 * p.bubble * (1 + 0.07 * Math.sin(t * 3.2)), x = A.beak[0] + (A.dir || 1) * (2 + r * 0.75), y = A.beak[1] + 0.5 + r * 0.55;
    ctx.fillStyle = 'rgba(150,215,255,0.5)'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(235,250,255,0.95)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(x, y, r - 0.5, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x - r * 0.38, y - r * 0.4, r * 0.24, r * 0.14, -0.7, 0, TAU); ctx.fill();
  }
  if (p.sparkle > 0.02) {
    const pts = A.wave ? [[A.wave[0] + 7, A.wave[1] - 5], [A.wave[0] - 7, A.wave[1] - 9], [A.wave[0] + 2, A.wave[1] - 13]] : [[hx - hr * 1.25, hy - hr * 0.5], [hx + hr * 1.3, hy - hr * 0.2], [hx + hr * 0.7, hy - hr * 1.35]];
    pts.forEach((q, i) => { const k = 0.5 + 0.5 * Math.sin(t * 9 + i * 2.1); star4(ctx, q[0], q[1], (2.2 + 2.6 * k) * p.sparkle, i % 2 ? '#fff6c2' : '#ffd23e', p.sparkle); });
  }
  if (p.puff > 0.02) {
    for (let i = 0; i < 5; i++) {
      const u = 1 - p.puff + 0.08 * i, an = -1.9 + i * 0.95 + 0.3 * Math.sin(i * 7), r = 18 + 30 * u;
      loose(ctx, A.bx + Math.sin(an) * r * 1.25, A.by - Math.cos(an) * r * 0.55 + 14 * u * u, an + t * 3 + i, 0.9, A.feather || '#fff', clamp(p.puff * 1.6, 0, 1));
    }
  }
}

// Ground contact shadow (drawn in the hen's frame at the feet).
export function groundShadow(ctx, p, w, col = 'rgba(40,24,60,0.22)') {
  const k = 1 - clamp(p.y / 60, 0, 0.55);
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.ellipse(p.x * 0.6 + Math.sin(p.lean) * 8, 0.6, w * k * (1 + p.sq * 0.5), 3.6 * k, 0, 0, TAU); ctx.fill();
}
