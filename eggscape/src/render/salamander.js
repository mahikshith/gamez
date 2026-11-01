// Salamander (Volcano world): a four-legged lava lizard that crawls inside a ring channel, seen from above.
// Pure Canvas 2D, no assets, no offscreen canvases. Draws in a local y-DOWN pixel space like the other
// character helpers (wrap it in pxSpace from world space).
//
// drawSalamander(ctx, x, y, s, t, opts)
//   x, y   snout position (px). s = snout-to-hips length in px (the tail adds ~0.95 s; legs span ~0.6 s).
//   t      seconds (idle motion, blink, flicker).
//   opts.heading  travel direction (rad, y-down) used when no trail is given
//   opts.curve    path curvature (1/px, + turns clockwise on screen); a ring channel of radius R px is 1/R
//   opts.trail    optional d => {x, y}: the walked path, d px behind the snout (same space as x, y). The spine
//                 and the planted feet follow it, so the body bends round any curve the head took.
//   opts.gait     distance walked (px). Drives the leg cycle and body wave; feet stay planted while it grows.
//   opts.pose     'walk' | 'idle' | 'hiss' | 'breath' | 'dazed' | 'flee' | 'cool'
//   opts.p        0..1 progress through a one-shot pose (breath: rear, inhale, fire, settle)
//   opts.glow     0..1 magma brightness (cracks pulse around it)
//   opts.cool     0..1 override for the cooled grey look (pose 'cool' = 1)
//   opts.aim      head turn (rad) off the body line, e.g. to breathe at a ring wall
//   opts.look     {x, y} pupils, -1..1 (x = toward the snout)
//   opts.blink    0..1 override (else it blinks on its own)
//   opts.dive     px past a lava hole (pose 'flee'): the hole sits this far behind the snout, the body sinks in
//   opts.fireLen  fire jet length in units of s/100 (default 60); opts.rear / opts.mouth override the pose (0..1)
//   opts.out      optional object; receives feet [{x, y, lift}] and the fire tip {x, y} (QA and gameplay hooks)
// In game: s = 1.5 m * k (k = px per metre) so the body is ~2.7 eggs long and the feet reach the channel walls.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mod = (a, b) => ((a % b) + b) % b;
const sstep = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
const lerp = (a, b, k) => a + (b - a) * k;

/* ---------------------------------------------------------------- palette */
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const C = {
  line: hex('#2a1209'), lineCool: hex('#25211f'),
  rock: hex('#5a3022'), rockHi: hex('#8e5a40'), rockLo: hex('#2c150f'),
  coolRock: hex('#6b6560'), coolHi: hex('#a29a92'), coolLo: hex('#3f3b38'),
  magLo: hex('#8c2208'), magMid: hex('#ff6512'), magHot: hex('#ffc43c'), coolMag: hex('#4a4542'),
  jaw: hex('#ffb04a'), coolJaw: hex('#8d8780'),
  eye: hex('#ffd52e'), eyeLo: hex('#e58a12'), coolEye: hex('#e6dcb0'),
};
const mixA = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const rgb = (c, al = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${al})`;

/* ---------------------------------------------------------------- rig constants (U = s / 100) */
const UMAX = 196; // snout .. tail tip
const NS = 50; // spine samples
const DU = UMAX / (NS - 1);
const U_SH = 32, U_HIP = 82, U_HEAD = 13; // shoulders, hips, head centre
const STRIDE = 40, DUTY = 0.6;
// body half-width (U) along the spine
const HW = [[14, 8.5], [24, 9.5], [32, 11.5], [44, 13], [58, 13.6], [72, 12.8], [84, 11.2], [96, 8.2], [112, 6.4], [140, 4.4], [168, 2.6], [196, 0.7]];
function hwAt(u) {
  if (u <= HW[0][0]) return HW[0][1];
  for (let i = 1; i < HW.length; i++) {
    if (u <= HW[i][0]) {
      const a = HW[i - 1], b = HW[i], k = (u - a[0]) / (b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * (k * k * (3 - 2 * k));
    }
  }
  return HW[HW.length - 1][1];
}
// legs: girdle u, side (-1 left, +1 right), phase offset (diagonal pairs), front?
const LEGS = [
  { g: U_SH, side: -1, off: 0, front: true },
  { g: U_SH, side: 1, off: 0.5, front: true },
  { g: U_HIP, side: -1, off: 0.5, front: false },
  { g: U_HIP, side: 1, off: 0, front: false },
];

// Rock plates in spine space (u, v = fraction of half-width), laid out once. Edges stay clear of the outline
// so a hot magma rim runs round the silhouette and reads against dark rings.
let PLATES = null;
function plates() {
  if (PLATES) return PLATES;
  PLATES = [];
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const crack = 2; // U
  const E = 0.8; // plates stop short of the flank: a hot rim runs round the silhouette
  // two staggered columns along neck and trunk, split by a glowing seam down the spine
  for (const side of [-1, 1]) {
    let u = side < 0 ? 22 : 27;
    while (u < 100) {
      const w = hwAt(u + 5);
      const sp = clamp(w * 0.92, 7, 12.5);
      const v0 = (crack / 2) / w, v1 = E;
      PLATES.push({ u0: u + crack / 2, u1: Math.min(u + sp, 104) - crack / 2, a: side * v0, b: side * v1, r: rnd(), s: side });
      u += sp;
    }
  }
  // tail: one plate per segment, shrinking toward the tip
  for (let u = 104; u < 186;) {
    const w = hwAt(u);
    const sp = clamp(w * 1.25, 3.6, 9);
    PLATES.push({ u0: u + crack / 2, u1: u + sp - crack / 2, a: -E, b: E, r: rnd(), s: 0 });
    u += sp;
  }
  return PLATES;
}

/* ---------------------------------------------------------------- reused buffers */
const sx = new Float32Array(NS), sy = new Float32Array(NS), sw = new Float32Array(NS);
const snx = new Float32Array(NS), sny = new Float32Array(NS); // right-hand normal
const bx = new Float32Array(NS), by = new Float32Array(NS); // unreared spine (for the ground shadow)
const PT = { x: 0, y: 0, a: 0 };

function blinkAt(t, seed = 0) {
  const period = 3.1 + seed * 0.9;
  const p = mod(t + seed * 1.7, period);
  const d = 0.16;
  return p < d ? Math.sin((p / d) * Math.PI) : 0;
}

// spine point at fractional u (U units) -> {x, y, nx, ny, w}; spInto fills a caller's object (no allocation)
function spInto(u, o) {
  const f = clamp(u / DU, 0, NS - 1.001), i = f | 0, k = f - i;
  o.x = sx[i] + (sx[i + 1] - sx[i]) * k;
  o.y = sy[i] + (sy[i + 1] - sy[i]) * k;
  o.nx = snx[i] + (snx[i + 1] - snx[i]) * k;
  o.ny = sny[i] + (sny[i + 1] - sny[i]) * k;
  o.w = sw[i] + (sw[i + 1] - sw[i]) * k;
  return o;
}
const spAt = (u) => spInto(u, { x: 0, y: 0, nx: 0, ny: 0, w: 0 });

/* ---------------------------------------------------------------- pose parameters */
function poseParams(pose, p, t, opts) {
  const P = { walk: 0, rear: 0, mouth: 0, fire: 0, swell: 0, dazed: 0, angry: 0, shake: 0, flee: 0, splay: 0, tongue: 0, steam: 0, lift: 0 };
  switch (pose) {
    case 'walk': P.walk = 1; break;
    case 'flee': P.walk = 1; P.flee = 1; break;
    case 'idle': break;
    case 'hiss': {
      const k = sstep(p / 0.15) * (1 - sstep((p - 0.85) / 0.15));
      P.rear = 0.4 * k; P.mouth = k; P.angry = k; P.shake = k; P.tongue = k; break;
    }
    case 'breath': {
      // 0-.25 rear up, .25-.42 inhale (swell, glow), .42-.86 fire, .86-1 settle
      const up = sstep(p / 0.22) * (1 - sstep((p - 0.86) / 0.14));
      P.rear = up;
      P.swell = sstep((p - 0.2) / 0.2) * (1 - sstep((p - 0.44) / 0.06));
      P.mouth = up * (0.25 + 0.75 * sstep((p - 0.36) / 0.08));
      P.fire = sstep((p - 0.42) / 0.05) * (1 - sstep((p - 0.82) / 0.07));
      P.angry = up;
      P.lift = up;
      break;
    }
    case 'dazed': P.dazed = 1; P.splay = 1; P.tongue = 0.6; break;
    case 'cool': P.steam = 1; break;
  }
  if (opts.rear !== undefined) P.rear = opts.rear;
  if (opts.mouth !== undefined) P.mouth = opts.mouth;
  return P;
}

/* ---------------------------------------------------------------- main */
export function drawSalamander(ctx, x, y, s, t = 0, opts = {}) {
  if (!(s > 0)) return;
  opts = opts || {};
  ctx.save();
  try {
    drawSal(ctx, x, y, s, t, opts);
  } catch (e) {
    // art must never break the frame
  }
  ctx.restore();
}

function drawSal(ctx, x0, y0, s, t, opts) {
  const U = s / 100;
  const pose = opts.pose || 'walk';
  const p = clamp(opts.p || 0, 0, 1);
  const P = poseParams(pose, p, t, opts);
  const cool = clamp(opts.cool !== undefined ? opts.cool : pose === 'cool' ? 1 : 0, 0, 1);
  if (cool > 0.3) P.steam = Math.max(P.steam, cool);
  const glow = clamp(opts.glow !== undefined ? opts.glow : 0.75, 0, 1) * (1 - cool) + P.swell * 0.5 * (1 - cool);
  const gaitPx = opts.gait || 0;
  const gait = gaitPx / U; // in U
  ctx.translate(x0, y0);

  // ---- path: d (px) behind the snout -> PT {x, y, a (travel angle)}
  const trail = opts.trail;
  const h0 = opts.heading || 0, kap = opts.curve || 0;
  let path;
  if (typeof trail === 'function') {
    const e = 2 * U;
    path = (d) => {
      const dd = Math.max(0, d);
      const q = trail(dd), qa = trail(dd + e), qb = trail(Math.max(0, dd - e));
      let a = Math.atan2(qb.y - qa.y, qb.x - qa.x);
      if (!(dd > e)) { const qc = trail(dd + 2 * e); a = Math.atan2(q.y - qc.y, q.x - qc.x); }
      PT.x = q.x - x0 + (d < 0 ? Math.cos(a) * -d : 0);
      PT.y = q.y - y0 + (d < 0 ? Math.sin(a) * -d : 0);
      PT.a = a;
      return PT;
    };
  } else {
    path = (d) => {
      const a = h0 - kap * d;
      if (Math.abs(kap) < 1e-7) { PT.x = -d * Math.cos(h0); PT.y = -d * Math.sin(h0); }
      else { PT.x = -(Math.sin(h0) - Math.sin(a)) / kap; PT.y = -(-Math.cos(h0) + Math.cos(a)) / kap; }
      PT.a = a;
      return PT;
    };
  }

  // ---- spine
  const ph = (gait / STRIDE) * TAU; // body wave phase
  const wk = P.walk * (1 - P.rear * 0.8);
  const A = (P.flee ? 6.5 : 5.2) * wk;
  const breathe = 1 + 0.035 * Math.sin(t * 2.3) * (1 - P.walk) + P.swell * 0.12;
  const idleSway = (1 - P.walk) * (1 - P.dazed * 0.5);
  const cph = Math.cos(ph);
  for (let i = 0; i < NS; i++) {
    const u = i * DU;
    const q = path(u * U);
    let lat;
    if (u < U_SH) lat = A * 0.42 * cph * (1 - u / U_SH);
    else if (u < U_HIP) lat = -A * cph * Math.sin((Math.PI * (u - U_SH)) / (U_HIP - U_SH));
    else {
      const r = clamp((u - U_HIP) / 26, 0, 1), f = (u - U_HIP) / (UMAX - U_HIP);
      lat = -(2.5 + 11 * f) * r * Math.cos(ph - (u - U_HIP) * (TAU / 120)) * wk;
      lat += idleSway * r * (Math.sin(t * 1.25 - u * 0.045) * (2 + 9 * f * f)); // lazy tail curl
      lat += P.shake * r * Math.sin(t * 22 - u * 0.1) * 5 * f; // rattling tail tip on a hiss
    }
    const nx = -Math.sin(q.a), ny = Math.cos(q.a);
    bx[i] = q.x + nx * lat * U;
    by[i] = q.y + ny * lat * U;
    let w = hwAt(u);
    if (u > U_SH - 6 && u < U_HIP + 6) w *= breathe;
    sw[i] = w * U;
  }
  // rear up: the front half lifts toward the camera (shorter, wider)
  const hipI = Math.round(U_HIP / DU);
  for (let i = 0; i < NS; i++) {
    let X = bx[i], Y = by[i];
    if (P.rear > 0 && i < hipI) {
      const f = (U_HIP - i * DU) / U_HIP;
      const c = 1 - 0.2 * P.rear * f;
      X = bx[hipI] + (X - bx[hipI]) * c;
      Y = by[hipI] + (Y - by[hipI]) * c;
      sw[i] *= 1 + 0.32 * P.rear * f;
    }
    sx[i] = X; sy[i] = Y;
  }
  for (let i = 0; i < NS; i++) {
    const a = Math.max(0, i - 1), b = Math.min(NS - 1, i + 1);
    const tx = sx[a] - sx[b], ty = sy[a] - sy[b], l = Math.hypot(tx, ty) || 1;
    snx[i] = -ty / l; sny[i] = tx / l;
  }

  const lw = Math.max(1.15, 2.3 * U);
  const lineC = mixA(C.line, C.lineCool, cool);
  const rockC = mixA(C.rock, C.coolRock, cool), rockHi = mixA(C.rockHi, C.coolHi, cool), rockLo = mixA(C.rockLo, C.coolLo, cool);
  const magAt = (k) => (cool > 0.98 ? C.coolMag : mixA(k < 0.5 ? mixA(C.magLo, C.magMid, k * 2) : mixA(C.magMid, C.magHot, k * 2 - 1), C.coolMag, cool));
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // ---- dive clip (flee into a lava hole): everything past the hole's centre line is under the lava
  let hole = null;
  if (opts.dive !== undefined && opts.dive !== null) {
    const q = path(opts.dive);
    hole = { x: q.x, y: q.y, a: q.a, r: 21 * U };
    drawHole(ctx, hole, U, t, cool, true);
    ctx.save();
    ctx.beginPath();
    ctx.rect(-1e4, -1e4, 2e4, 2e4);
    const ca = Math.cos(hole.a), sa = Math.sin(hole.a), L = 1e4;
    ctx.moveTo(hole.x - sa * L, hole.y + ca * L);
    ctx.lineTo(hole.x - sa * L + ca * L, hole.y + ca * L + sa * L);
    ctx.lineTo(hole.x + sa * L + ca * L, hole.y - ca * L + sa * L);
    ctx.lineTo(hole.x + sa * L, hole.y - ca * L);
    ctx.closePath();
    ctx.clip('evenodd');
  }

  // ---- feet
  const feet = [];
  for (const L of LEGS) feet.push(footFor(L, gait, P, path, U, t));
  if (opts.out) opts.out.feet = feet.map((f) => ({ x: f.fx + x0, y: f.fy + y0, lift: f.lift }));

  // ---- ground shadow (unreared body, offset down-right like the snake)
  const so = 3.2 * U;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  outlineFrom(ctx, bx, by, so, so * 1.25, 1);
  ctx.fill();
  ctx.beginPath();
  const q0 = path(U_HEAD * U);
  ctx.ellipse(bx[0] * 0.5 + q0.x * 0.5 + so, by[0] * 0.5 + q0.y * 0.5 + so * 1.25, 15 * U, 14 * U, 0, 0, TAU);
  ctx.fill();

  // ---- legs (under the body: shoulders and hips are hidden by the body outline)
  const limbC = mixA(mixA(C.magMid, C.rock, 0.5), C.coolRock, cool);
  // reared up, the front legs come off the ground toward the camera and are drawn over the chest
  const upFront = P.rear > 0.35;
  drawLegs(ctx, upFront ? feet.filter((f) => !f.L.front) : feet, U, lw, lineC, limbC, rockHi, magAt(glow), cool);

  // ---- body
  const bodyPath = (ox, oy) => {
    for (let i = 1; i < NS; i++) {
      const X = sx[i] + snx[i] * sw[i] + ox, Y = sy[i] + sny[i] * sw[i] + oy;
      if (i === 1) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    }
    for (let i = NS - 1; i >= 1; i--) ctx.lineTo(sx[i] - snx[i] * sw[i] + ox, sy[i] - sny[i] * sw[i] + oy);
    ctx.closePath();
  };
  // magma base, brightness pulsing down the body
  const g0 = spAt(0), hx = g0.x, hy = g0.y;
  const tl = spAt(UMAX), tx2 = tl.x, ty2 = tl.y;
  const grad = ctx.createLinearGradient(hx, hy, tx2, ty2);
  for (let k = 0; k <= 5; k++) {
    const f = k / 5;
    const gl = clamp(glow * (0.78 + 0.3 * Math.sin(t * 2.4 - f * 7)) - f * 0.25 * glow, 0, 1);
    grad.addColorStop(f, rgb(magAt(gl)));
  }
  if (glow > 0.05 && !cool) {
    ctx.beginPath();
    bodyPath(0, 0);
    ctx.strokeStyle = `rgba(255,110,30,${0.2 * glow})`;
    ctx.lineWidth = lw + 5 * U;
    ctx.stroke();
  }
  ctx.beginPath();
  bodyPath(0, 0);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // rock plates: a light pass, then the base shifted down-right (top-left rim catches the light)
  const PL = plates();
  const platePath = (ox, oy) => {
    ctx.beginPath();
    for (const pl of PL) plateShape(ctx, pl, ox, oy);
  };
  platePath(0, 0);
  ctx.fillStyle = rgb(rockHi);
  ctx.fill();
  ctx.save();
  ctx.clip();
  platePath(0.9 * U, 1.1 * U);
  ctx.fillStyle = rgb(rockC);
  ctx.fill();
  ctx.restore();
  // cel shadow: lower-right crescent of the whole body
  ctx.beginPath();
  ctx.rect(-1e4, -1e4, 2e4, 2e4);
  bodyPath(-3.4 * U, -4.2 * U);
  ctx.fillStyle = rgb(rockLo, 0.5);
  ctx.fill('evenodd');
  // a soft hot highlight down the spine
  ctx.beginPath();
  for (let i = 3; i < NS - 8; i++) {
    const X = sx[i] - snx[i] * sw[i] * 0.25 - 0.8 * U, Y = sy[i] - sny[i] * sw[i] * 0.25 - 0.8 * U;
    if (i === 3) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
  }
  ctx.strokeStyle = rgb(rockHi, 0.35);
  ctx.lineWidth = 2.2 * U;
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  bodyPath(0, 0);
  ctx.strokeStyle = rgb(lineC);
  ctx.lineWidth = lw;
  ctx.stroke();

  if (upFront) drawLegs(ctx, feet.filter((f) => f.L.front), U, lw, lineC, limbC, rockHi, magAt(glow), cool);

  // ---- head
  const hc = spAt(U_HEAD);
  const hb = spAt(U_HEAD + 12);
  const hcx = hc.x, hcy = hc.y;
  let ha = Math.atan2(hcy - hb.y, hcx - hb.x) + (opts.aim || 0);
  if (P.dazed) ha += Math.sin(t * 3.1) * 0.28;
  if (P.shake) ha += Math.sin(t * 31) * 0.05 * P.shake;
  const hs = (1.14 + 0.3 * P.rear) * U; // reared head is closer to the camera
  ctx.save();
  ctx.translate(hcx, hcy);
  ctx.rotate(ha);
  ctx.scale(hs, hs);
  drawHead(ctx, t, opts, P, glow, cool, lw / hs, { lineC, rockC, rockHi, rockLo, magAt });
  ctx.restore();

  // ---- fire jet
  if (P.fire > 0.01) {
    const ca = Math.cos(ha), sa = Math.sin(ha);
    const mx = hcx + ca * (15 + 6 * P.mouth) * hs, my = hcy + sa * (15 + 6 * P.mouth) * hs;
    const tip = drawFire(ctx, mx, my, ha, P.fire, U, t, opts.fireLen || 60);
    if (opts.out) opts.out.fire = { x: tip.x + x0, y: tip.y + y0 };
  }

  if (hole) {
    ctx.restore();
    drawHole(ctx, hole, U, t, cool, false, opts.dive > 0 && opts.dive < UMAX * U ? 1 : 0);
  }

  // ---- steam (cooling) and dizzy stars
  if (P.steam > 0.01) drawSteam(ctx, U, t, P.steam * (opts.steam !== undefined ? opts.steam : 1));
  if (P.dazed) drawStars(ctx, hcx, hcy, U, t);
}

// Foot position for one leg: planted feet sit at a fixed spot on the walked path (no sliding); a swinging
// foot travels to the next plant and lifts toward the camera.
function footFor(L, gait, P, path, U, t) {
  const rf = DUTY * STRIDE / 2 + (L.front ? 4 : -6);
  const lat = (L.front ? 25 : 27) + P.splay * 6;
  const q = gait / STRIDE + L.off;
  const n = Math.floor(q), psi = q - n;
  const plantS = (m) => (m - L.off) * STRIDE - L.g + rf;
  let S, lift = 0;
  if (psi < DUTY || !P.walk) S = psi < DUTY ? plantS(n) : plantS(n + 1);
  else {
    const w = (psi - DUTY) / (1 - DUTY);
    S = lerp(plantS(n), plantS(n + 1), sstep(w));
    lift = Math.sin(Math.PI * w);
  }
  const d = (gait - S) * U;
  const pt = path(d);
  const nx = -Math.sin(pt.a), ny = Math.cos(pt.a);
  const ll = lat - lift * 5;
  let fx = pt.x + nx * L.side * ll * U, fy = pt.y + ny * L.side * ll * U;
  let fa = pt.a + L.side * (L.front ? 0.55 : 1.2);
  // rearing: front feet come off the ground and paddle at the chest
  if (L.front && P.rear > 0) {
    const g = spAt(L.g + 12); // beside the chest, clear of the (now bigger) head
    const tx = g.x + g.nx * L.side * 21 * U, ty = g.y + g.ny * L.side * 21 * U;
    const wv = Math.sin(t * 9 + L.side) * 2 * U * P.rear;
    const k = P.rear;
    fx = lerp(fx, tx + wv, k);
    fy = lerp(fy, ty - wv, k);
    lift = Math.max(lift, k);
  }
  const g = spAt(L.g);
  const hip = { x: g.x + g.nx * L.side * g.w * 0.5, y: g.y + g.ny * L.side * g.w * 0.5 };
  // body heading at the girdle (toward the head)
  const g2 = spAt(L.g - 4);
  const ba = Math.atan2(g2.y - g.y, g2.x - g.x);
  return { L, hip, fx, fy, fa, lift, ba };
}

function ik(hx, hy, fx, fy, l1, l2, prefer) {
  let dx = fx - hx, dy = fy - hy, D = Math.hypot(dx, dy) || 1e-6;
  const max = (l1 + l2) * 0.995;
  if (D > max) { fx = hx + (dx / D) * max; fy = hy + (dy / D) * max; dx = fx - hx; dy = fy - hy; D = max; }
  const a = Math.acos(clamp((l1 * l1 + D * D - l2 * l2) / (2 * l1 * D), -1, 1));
  const b = Math.atan2(dy, dx);
  const k1x = hx + Math.cos(b + a) * l1, k1y = hy + Math.sin(b + a) * l1;
  const k2x = hx + Math.cos(b - a) * l1, k2y = hy + Math.sin(b - a) * l1;
  const d1 = k1x * prefer.x + k1y * prefer.y, d2 = k2x * prefer.x + k2y * prefer.y;
  return d1 > d2 ? { kx: k1x, ky: k1y, fx, fy } : { kx: k2x, ky: k2y, fx, fy };
}

function drawLegs(ctx, feet, U, lw, lineC, limbC, hiC, magC, cool) {
  const up = 7.4 * U, lo = 5.6 * U, toe = 2.3 * U, pad = 3.6 * U;
  const J = feet.map((F) => {
    const L = F.L;
    const l1 = (L.front ? 12 : 13.5) * U, l2 = (L.front ? 12 : 13) * U;
    // elbows point back, knees point forward, both away from the body
    const ca = Math.cos(F.ba), sa = Math.sin(F.ba), nx = -sa * L.side, ny = ca * L.side;
    const pref = L.front ? { x: -ca + nx * 1.2, y: -sa + ny * 1.2 } : { x: ca + nx * 1.2, y: sa + ny * 1.2 };
    const r = ik(F.hip.x, F.hip.y, F.fx, F.fy, l1, l2, pref);
    return { F, ...r };
  });
  const sc = (F) => 1 + 0.18 * F.lift;
  const toes = (F, fx, fy, grow) => {
    const n = F.L.front ? 4 : 5, spread = F.L.front ? 1.5 : 1.7;
    const curl = 1 - 0.45 * F.lift;
    for (let i = 0; i < n; i++) {
      const a = F.fa + (i / (n - 1) - 0.5) * spread;
      const len = (F.L.front ? 5.2 : 5.8) * U * curl * (1 + (i === n - 2 ? 0.25 : 0)) * sc(F) + grow;
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + Math.cos(a) * len, fy + Math.sin(a) * len);
    }
  };
  const pass = (extra, col) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = up + extra;
    ctx.beginPath();
    for (const j of J) { ctx.moveTo(j.F.hip.x, j.F.hip.y); ctx.lineTo(j.kx, j.ky); }
    ctx.stroke();
    ctx.lineWidth = lo + extra;
    ctx.beginPath();
    for (const j of J) { ctx.moveTo(j.kx, j.ky); ctx.lineTo(j.fx, j.fy); }
    ctx.stroke();
    ctx.lineWidth = toe + extra;
    ctx.beginPath();
    for (const j of J) toes(j.F, j.fx, j.fy, 0);
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath();
    for (const j of J) { const r = (pad + extra / 2) * sc(j.F); ctx.moveTo(j.fx + r, j.fy); ctx.arc(j.fx, j.fy, r, 0, TAU); }
    ctx.fill();
  };
  // lifted feet cast a little shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  for (const j of J) if (j.F.lift > 0.15) { const r = pad * 1.2; ctx.moveTo(j.fx + r + 3 * U * j.F.lift, j.fy + 4 * U * j.F.lift); ctx.arc(j.fx + 3 * U * j.F.lift, j.fy + 4 * U * j.F.lift, r, 0, TAU); }
  ctx.fill();
  pass(lw * 2, rgb(lineC));
  pass(0, rgb(limbC));
  // claw tips glow; a highlight along the upper limbs
  ctx.strokeStyle = rgb(hiC, 0.7);
  ctx.lineWidth = up * 0.32;
  ctx.beginPath();
  for (const j of J) {
    const ox = -0.22 * up, oy = -0.26 * up;
    ctx.moveTo(j.F.hip.x + ox, j.F.hip.y + oy);
    ctx.lineTo(j.kx + ox, j.ky + oy);
    ctx.lineTo(j.fx + ox * 0.6, j.fy + oy * 0.6);
  }
  ctx.stroke();
  if (cool < 0.9) {
    ctx.fillStyle = rgb(magC, 1 - cool);
    ctx.beginPath();
    for (const j of J) {
      const F = j.F, n = F.L.front ? 4 : 5, spread = F.L.front ? 1.5 : 1.7, curl = 1 - 0.45 * F.lift;
      for (let i = 0; i < n; i++) {
        const a = F.fa + (i / (n - 1) - 0.5) * spread;
        const len = (F.L.front ? 5.2 : 5.8) * U * curl * (1 + (i === n - 2 ? 0.25 : 0)) * sc(F);
        const X = j.fx + Math.cos(a) * len, Y = j.fy + Math.sin(a) * len;
        ctx.moveTo(X + 1.1 * U, Y);
        ctx.arc(X, Y, 1.1 * U, 0, TAU);
      }
    }
    ctx.fill();
  }
}

// Angular rock plate in spine space: a jittered hexagon, the outer corners chamfered.
const PQ = { x: 0, y: 0, nx: 0, ny: 0, w: 0 };
function plateShape(ctx, pl, ox, oy) {
  const j = (pl.r - 0.5) * 1.2;
  const L = pl.u1 - pl.u0, um = (pl.u0 + pl.u1) / 2 + j * 0.6;
  const a = pl.a, b = pl.b, vm = (a + b) / 2 + (pl.r - 0.5) * 0.12;
  const pts = pl.s === 0
    ? [pl.u0 + L * 0.18, a, um, a * 1.02, pl.u1 - L * 0.12, a * 0.9, pl.u1, vm, pl.u1 - L * 0.12, b * 0.9, pl.u0 + L * 0.2, b, pl.u0, vm]
    : [pl.u0, a, pl.u1, a, pl.u1 + 0.4, vm, pl.u1 - L * 0.22, b, pl.u0 + L * 0.25, b, pl.u0 - 0.3, vm + (b - a) * 0.12];
  const n = pts.length / 2;
  for (let i = 0; i < n; i++) {
    const q = spInto(pts[2 * i], PQ);
    const X = q.x + q.nx * q.w * pts[2 * i + 1] + ox, Y = q.y + q.ny * q.w * pts[2 * i + 1] + oy;
    if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
  }
  ctx.closePath();
}

function outlineFrom(ctx, X, Y, ox, oy, i0) {
  // shadow outline from an arbitrary spine (normals approximated from neighbours)
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 0; j < NS - i0; j++) {
      const i = pass ? NS - 1 - j : i0 + j;
      const a = Math.max(0, i - 1), b = Math.min(NS - 1, i + 1);
      const tx = X[a] - X[b], ty = Y[a] - Y[b], l = Math.hypot(tx, ty) || 1;
      const nx = -ty / l, ny = tx / l, w = sw[i] * (pass ? -1 : 1);
      const px = X[i] + nx * w + ox, py = Y[i] + ny * w + oy;
      if (!pass && !j) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
}

/* ---------------------------------------------------------------- head (local: +x = snout, units = U) */
// The face reads like a front-on cartoon face seen from above: forehead toward the body, mouth at the snout.
function drawHead(ctx, t, opts, P, glow, cool, lw, K) {
  const m = clamp(P.mouth, 0, 1);
  const tipX = 15 - 4 * m; // the upper lip pulls back as the jaw drops toward the camera
  // broad shovel head: widest across the cheeks, round blunt snout
  const headShape = () => {
    ctx.beginPath();
    ctx.moveTo(tipX, 0);
    ctx.bezierCurveTo(tipX, 8, 12, 15.5, 4, 17);
    ctx.bezierCurveTo(-4, 18.2, -12, 15, -14.5, 9);
    ctx.quadraticCurveTo(-16, 4, -15.5, 0);
    ctx.quadraticCurveTo(-16, -4, -14.5, -9);
    ctx.bezierCurveTo(-12, -15, -4, -18.2, 4, -17);
    ctx.bezierCurveTo(12, -15.5, tipX, -8, tipX, 0);
    ctx.closePath();
  };
  const line = rgb(K.lineC);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // lower jaw + open mouth, under the upper head
  if (m > 0.02) {
    const jx = 8 + 13 * m; // jaw tip
    ctx.beginPath();
    ctx.moveTo(-2, -16);
    ctx.bezierCurveTo(6, -17, jx, -12 * (0.6 + 0.4 * m), jx, 0);
    ctx.bezierCurveTo(jx, 12 * (0.6 + 0.4 * m), 6, 17, -2, 16);
    ctx.closePath();
    ctx.fillStyle = rgb(mixA(C.jaw, C.coolJaw, cool));
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = line;
    ctx.stroke();
    ctx.beginPath(); // mouth cavity
    ctx.moveTo(1, -13);
    ctx.bezierCurveTo(7, -13.5, jx - 3, -9 * m, jx - 3, 0);
    ctx.bezierCurveTo(jx - 3, 9 * m, 7, 13.5, 1, 13);
    ctx.closePath();
    ctx.fillStyle = P.fire > 0.05 ? '#ffd860' : '#6e0d0a';
    ctx.fill();
    ctx.fillStyle = '#fff4dc'; // lower fangs
    ctx.beginPath();
    for (const sd of [-1, 1]) {
      const bx = jx - 5 - 1.5 * m, by = sd * 7 * m;
      ctx.moveTo(bx + 1.2, by - 1.8 * sd);
      ctx.lineTo(bx - 3, by - 0.4 * sd);
      ctx.lineTo(bx + 1.6, by + 1.8 * sd);
    }
    ctx.fill();
    if (P.fire < 0.3) drawTongue(ctx, 4, 0, jx - 4 + 3 * P.tongue + Math.sin(t * 18) * 1.5 * P.tongue, t, lw);
  } else if (P.tongue > 0 || mod(t, 2.7) < 0.32) {
    const fl = P.tongue > 0 ? 0.7 : Math.sin((mod(t, 2.7) / 0.32) * Math.PI);
    drawTongue(ctx, tipX - 2, 0, tipX + 10 * fl, t, lw);
  }

  // upper head: hot face, dark crusted skull cap and brow plates
  headShape();
  ctx.fillStyle = rgb(K.magAt(clamp(glow * 0.72 + 0.24, 0, 1)));
  ctx.fill();
  ctx.save();
  ctx.clip();
  const plate = (ox, oy) => {
    ctx.beginPath();
    // skull cap between and behind the eyes
    ctx.moveTo(-17 + ox, -5.5 + oy);
    ctx.lineTo(-8 + ox, -4.8 + oy);
    ctx.lineTo(-3.5 + ox, -2 + oy);
    ctx.lineTo(-2.5 + ox, 0 + oy);
    ctx.lineTo(-3.5 + ox, 2 + oy);
    ctx.lineTo(-8 + ox, 4.8 + oy);
    ctx.lineTo(-17 + ox, 5.5 + oy);
    ctx.closePath();
    // brow ridges over the eyes
    for (const sd of [-1, 1]) {
      ctx.moveTo(-15 + ox, sd * 7.5 + oy);
      ctx.lineTo(-8.5 + ox, sd * 6.6 + oy);
      ctx.lineTo(-6.5 + ox, sd * 12 + oy);
      ctx.lineTo(-9 + ox, sd * 19 + oy);
      ctx.lineTo(-16 + ox, sd * 13 + oy);
      ctx.closePath();
    }
  };
  plate(0, 0);
  ctx.fillStyle = rgb(K.rockHi);
  ctx.fill();
  plate(0.6, 0.8);
  ctx.fillStyle = rgb(K.rockC);
  ctx.fill();
  ctx.beginPath(); // glossy hot spot on the snout
  ctx.ellipse(6, -4, 5.5, 3.2, -0.5, 0, TAU);
  ctx.fillStyle = `rgba(255,236,170,${0.45 * (1 - cool)})`;
  ctx.fill();
  ctx.beginPath(); // cel shadow on the lower-right of the head
  ctx.rect(-40, -40, 80, 80);
  ctx.ellipse(-3, -3.5, 20.5, 20.5, 0, 0, TAU);
  ctx.fillStyle = rgb(K.rockLo, 0.3);
  ctx.fill('evenodd');
  ctx.restore();
  headShape();
  ctx.lineWidth = lw;
  ctx.strokeStyle = line;
  ctx.stroke();

  // nostrils
  ctx.fillStyle = line;
  ctx.beginPath();
  ctx.ellipse(tipX - 2.4, -3.6, 1, 1.3, 0, 0, TAU);
  ctx.ellipse(tipX - 2.4, 3.6, 1, 1.3, 0, 0, TAU);
  ctx.fill();

  if (m <= 0.02) {
    // closed: a wide cheeky grin across the snout, one corner hooked up higher, one fang out
    ctx.beginPath();
    ctx.moveTo(2.6, -11.6);
    ctx.bezierCurveTo(7, -8.6, 9.6, -4, 9.6, 0.4);
    ctx.bezierCurveTo(9.4, 4.6, 7, 9, 1.8, 11.6);
    ctx.lineWidth = lw * 1.05;
    ctx.strokeStyle = line;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(2.6, -11.6);
    ctx.quadraticCurveTo(0.6, -12.4, 0.2, -10.2);
    ctx.moveTo(1.8, 11.6);
    ctx.quadraticCurveTo(-1, 13.2, -2.2, 10.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8.7, 4.8);
    ctx.lineTo(11.4, 6.6);
    ctx.lineTo(7.8, 7.4);
    ctx.closePath();
    ctx.fillStyle = '#fff4dc';
    ctx.fill();
    ctx.lineWidth = lw * 0.55;
    ctx.stroke();
  } else {
    ctx.fillStyle = '#fff4dc';
    ctx.strokeStyle = line;
    ctx.lineWidth = lw * 0.55;
    ctx.beginPath();
    for (const sd of [-1, 1]) {
      const bx = tipX - 3.5, by = sd * 6;
      ctx.moveTo(bx - 1.6, by - 1.6 * sd);
      ctx.lineTo(bx + 4 + 1.5 * m, by + 0.3 * sd);
      ctx.lineTo(bx - 1.2, by + 2 * sd);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
  }

  const blink = opts.blink !== undefined ? clamp(opts.blink, 0, 1) : P.dazed ? 0 : blinkAt(t, 0.4);
  const look = opts.look || { x: 0, y: 0 };
  for (const sd of [-1, 1]) drawEye(ctx, -2, sd * 12, sd, t, blink, look, P, cool, lw, K);
}

function drawTongue(ctx, x0, y0, x1, t, lw) {
  if (x1 <= x0 + 0.5) return;
  const wob = Math.sin(t * 20) * 1.2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo((x0 + x1) / 2, y0 + wob, x1, y0 + wob * 0.6);
  ctx.moveTo(x1, y0 + wob * 0.6);
  ctx.lineTo(x1 + 3, y0 - 2.4 + wob);
  ctx.moveTo(x1, y0 + wob * 0.6);
  ctx.lineTo(x1 + 3, y0 + 2.8 + wob);
  ctx.strokeStyle = '#4a0a10';
  ctx.lineWidth = 2.8 + lw;
  ctx.stroke();
  ctx.strokeStyle = '#ff5470';
  ctx.lineWidth = 2.6;
  ctx.stroke();
}

// Eye in head space; the face's "up" is toward the body (-x), so lids close from -x toward the snout.
function drawEye(ctx, ex, ey, sd, t, blink, look, P, cool, lw, K) {
  const R = 7;
  const line = rgb(K.lineC);
  ctx.beginPath(); // thin rock socket, bulging past the head outline
  ctx.arc(ex, ey, R + 0.9, 0, TAU);
  ctx.fillStyle = rgb(K.rockC);
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = line;
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.arc(ex, ey, R, 0, TAU);
  ctx.clip();
  ctx.fillStyle = rgb(mixA(C.eye, C.coolEye, cool));
  ctx.fillRect(ex - R, ey - R, 2 * R, 2 * R);
  ctx.beginPath(); // lower shade toward the snout
  ctx.arc(ex - 2.4, ey - sd * 0.5, R, 0, TAU);
  ctx.rect(ex - R * 2, ey - R * 2, R * 4, R * 4);
  ctx.fillStyle = rgb(mixA(C.eyeLo, C.coolEye, cool * 0.7), 0.75);
  ctx.fill('evenodd');
  if (P.dazed) {
    ctx.beginPath();
    const rot = t * 7 * sd;
    for (let i = 0; i <= 34; i++) {
      const a = rot + i * 0.52, r = 0.2 + i * 0.165;
      const X = ex + Math.cos(a) * r, Y = ey + Math.sin(a) * r;
      if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
    }
    ctx.strokeStyle = line;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  } else {
    const lx = clamp(look.x || 0, -1, 1), ly = clamp(look.y || 0, -1, 1);
    const px = ex + lx * 2.2 + 0.8, py = ey + ly * 2.2;
    const pr = P.angry ? 2.6 : 3.2;
    ctx.beginPath();
    ctx.ellipse(px, py, pr * (P.angry ? 1.15 : 0.95), pr * (P.angry ? 0.75 : 1.05), 0, 0, TAU);
    ctx.fillStyle = '#1e0a04';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px - 1.5, py - 1.3 * sd, 1.3, 0, TAU);
    ctx.arc(px + 1.1, py + 1.1 * sd, 0.55, 0, TAU);
    ctx.fill();
  }
  // upper lid from the forehead side; the inner corner sits lower (mischief, or anger on a hiss)
  const base = P.dazed ? 0.4 : 0.22 + 0.24 * P.angry;
  const lid = Math.max(blink, base);
  const back = ex - R - 3, edge = lerp(ex - R - 0.5, ex + R + 0.5, lid);
  const slant = (P.angry ? 3.4 : 2) * (1 - blink);
  const yIn = ey - sd * (R + 2), yOut = ey + sd * (R + 2);
  ctx.beginPath();
  ctx.moveTo(back, yIn);
  ctx.lineTo(edge + slant, yIn);
  ctx.lineTo(edge - slant, yOut);
  ctx.lineTo(back, yOut);
  ctx.closePath();
  ctx.fillStyle = rgb(K.rockC);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(edge + slant, yIn);
  ctx.lineTo(edge - slant, yOut);
  ctx.strokeStyle = line;
  ctx.lineWidth = lw * 1.1;
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(ex, ey, R, 0, TAU);
  ctx.strokeStyle = line;
  ctx.lineWidth = lw * 0.9;
  ctx.stroke();
}

/* ---------------------------------------------------------------- effects */
function drawFire(ctx, x, y, a, k, U, t, len) {
  const reach = sstep(k * 1.6);
  const L = len * U * (0.3 + 0.7 * reach);
  const ca = Math.cos(a), sa = Math.sin(a);
  ctx.save();
  // outlined like the rest of the cast: a dark ember rim, then red, orange, yellow and a white-hot core
  const layers = [['#5a1206', 1.12], ['#e2361a', 1], ['#ff8a1e', 0.76], ['#ffd648', 0.52], ['#fff8d8', 0.26]];
  for (const [col, wk] of layers) {
    ctx.fillStyle = col;
    ctx.beginPath();
    for (let i = 0; i < 15; i++) {
      const f = i / 14;
      const fl = Math.sin(t * 37 + i * 2.1) * 0.5 + Math.sin(t * 23 + i * 1.3) * 0.5;
      const d = L * f;
      const r = (4 + 16 * Math.pow(f, 0.75)) * U * wk * k * (1 + 0.16 * fl) * (f > 0.88 ? 1 - (f - 0.88) * 2.5 : 1);
      const off = fl * 2 * U * f;
      const X = x + ca * d - sa * off, Y = y + sa * d + ca * off;
      ctx.moveTo(X + r, Y);
      ctx.arc(X, Y, Math.max(0.5, r), 0, TAU);
    }
    ctx.fill();
  }
  // where it lands: a flat splash fanning sideways, sparks flying back
  const tx = x + ca * L, ty = y + sa * L;
  if (reach > 0.9) {
    ctx.fillStyle = 'rgba(255,200,80,0.9)';
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const f = mod(t * 3.1 + i * 0.23, 1), sd = i % 2 ? 1 : -1;
      const d = f * 16 * U, X = tx - sa * sd * d - ca * f * 6 * U, Y = ty + ca * sd * d - sa * f * 6 * U;
      const r = 1.6 * U * (1 - f) * k;
      ctx.moveTo(X + r, Y);
      ctx.arc(X, Y, Math.max(0.3, r), 0, TAU);
    }
    ctx.fill();
  }
  ctx.fillStyle = '#ffe680';
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const f = mod(t * 2.6 + i * 0.37, 1);
    const d = L * (0.2 + f * 0.8), off = Math.sin(i * 7.3 + t * 3) * 9 * U * f;
    const X = x + ca * d - sa * off, Y = y + sa * d + ca * off, r = 1.3 * U * (1 - f) * k;
    ctx.moveTo(X + r, Y);
    ctx.arc(X, Y, Math.max(0.3, r), 0, TAU);
  }
  ctx.fill();
  ctx.restore();
  return { x: tx, y: ty };
}

function drawSteam(ctx, U, t, k) {
  ctx.save();
  for (let i = 0; i < 9; i++) {
    const f = mod(t * 0.55 + i * 0.29, 1);
    const q = spAt(8 + i * 17);
    const X = q.x + Math.sin(i * 4.1 + t * 1.3) * 4 * U, Y = q.y - f * 26 * U;
    const r = (3 + f * 6) * U;
    ctx.globalAlpha = k * 0.6 * Math.sin(f * Math.PI);
    ctx.fillStyle = '#f6f8fa';
    ctx.beginPath();
    ctx.arc(X, Y, r, 0, TAU);
    ctx.arc(X + r * 0.7, Y + r * 0.2, r * 0.7, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawStars(ctx, hx, hy, U, t) {
  ctx.save();
  ctx.lineJoin = 'round';
  for (let i = 0; i < 3; i++) {
    const a = t * 3.2 + (i * TAU) / 3;
    const X = hx + Math.cos(a) * 22 * U, Y = hy + Math.sin(a) * 12 * U - 6 * U;
    const r = (5.4 + 1.2 * Math.sin(a)) * U;
    ctx.beginPath();
    for (let j = 0; j < 10; j++) {
      const rr = j % 2 ? r * 0.45 : r, b = -Math.PI / 2 + (j * Math.PI) / 5 + t * 2;
      const px = X + Math.cos(b) * rr, py = Y + Math.sin(b) * rr;
      if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = '#ffe14a';
    ctx.fill();
    ctx.lineWidth = Math.max(1, 0.9 * U);
    ctx.strokeStyle = '#5a3008';
    ctx.stroke();
  }
  ctx.restore();
}

// A lava hole in the channel floor; back = the pool (before the body), front = the molten surface over whatever
// has gone in, the crusted near lip and a splash while something is diving.
function drawHole(ctx, H, U, t, cool, back, splash = 0) {
  ctx.save();
  ctx.translate(H.x, H.y);
  ctx.rotate(H.a);
  const r = H.r;
  const rim = (rr, k) => {
    ctx.beginPath();
    for (let i = 0; i <= 32; i++) {
      const a = (i / 32) * TAU, j = 1 + 0.06 * Math.sin(a * 5 + 1.3) * Math.sin(a * 3) * k;
      const X = Math.cos(a) * rr * j, Y = Math.sin(a) * rr * 0.92 * j;
      if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
    }
    ctx.closePath();
  };
  if (back) {
    rim(r * 1.28, 1);
    ctx.fillStyle = '#2a1209';
    ctx.fill();
    rim(r * 1.16, 1);
    ctx.fillStyle = '#4d2a1f';
    ctx.fill();
    const g = ctx.createRadialGradient(r * 0.15, r * 0.12, r * 0.05, 0, 0, r);
    g.addColorStop(0, '#fff2a8');
    g.addColorStop(0.3, '#ffb432');
    g.addColorStop(0.7, '#ff5a12');
    g.addColorStop(1, '#6a1404');
    rim(r, 0.6);
    ctx.fillStyle = g;
    ctx.fill();
    // inner shadow under the far-left lip: the hole has depth
    ctx.save();
    ctx.clip();
    ctx.beginPath();
    ctx.rect(-2 * r, -2 * r, 4 * r, 4 * r);
    ctx.ellipse(r * 0.22, r * 0.26, r * 1.02, r * 0.95, 0, 0, TAU);
    ctx.fillStyle = 'rgba(60,8,2,0.6)';
    ctx.fill('evenodd');
    ctx.restore();
    ctx.fillStyle = 'rgba(255,244,190,0.85)';
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const f = mod(t * 0.9 + i * 0.33, 1);
      const X = Math.cos(i * 2.4) * r * 0.45, Y = Math.sin(i * 2.4) * r * 0.4, rr = r * 0.13 * Math.sin(f * Math.PI);
      ctx.moveTo(X + rr, Y);
      ctx.arc(X, Y, Math.max(0.2, rr), 0, TAU);
    }
    ctx.fill();
  } else {
    // whatever is in the hole sinks under a molten film that thickens toward the far side
    ctx.save();
    rim(r, 0.6);
    ctx.clip();
    const g = ctx.createLinearGradient(-r, 0, r * 0.1, 0);
    g.addColorStop(0, 'rgba(255,100,20,0)');
    g.addColorStop(0.6, 'rgba(255,120,30,0.65)');
    g.addColorStop(1, 'rgba(255,190,60,0.95)');
    ctx.fillStyle = g;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
    rim(r * 1.02, 0.6);
    ctx.lineWidth = Math.max(1.2, 2.4 * U);
    ctx.strokeStyle = '#2a1209';
    ctx.stroke();
    if (splash > 0) {
      ctx.fillStyle = '#ffb030';
      ctx.strokeStyle = '#5a1206';
      ctx.lineWidth = Math.max(0.8, 1 * U);
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const f = mod(t * 2.2 + i * 0.31, 1), a = -1.2 + (i / 6) * 2.4 + Math.PI;
        const d = r * (0.5 + f * 0.9), X = Math.cos(a) * d, Y = Math.sin(a) * d * 0.9 - Math.sin(f * Math.PI) * r * 0.25;
        const rr = r * 0.13 * (1 - f) * splash;
        ctx.moveTo(X + rr, Y);
        ctx.arc(X, Y, Math.max(0.2, rr), 0, TAU);
      }
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

export const SALAMANDER_LEN = 1.96; // snout to tail tip, in units of s
