// Sea creatures (v3.3 M8, Coral Reef): the octopus and the fish school. Pure Canvas 2D code art in the house style
// (dark outline, two-tone cel shading), no assets.
//
// drawOctopus(ctx, x, y, s, t, o)  local y-DOWN px space (wrap in pxSpace from world space); (x, y) = the octopus's
//   centre, s = mantle size px (OCT_S m * k in game). o: {rot (screen angle the mantle top points to), A (octoAnim()
//   channels), egg {x, y, rx, ry} (the egg its arms wrap, px, long axis across the arms), wrap 0..1, look {x, y} (px target), pulse 0..1
//   (about-to-grab flush), hit 'zap'|'water'|'flash'|'dash'|'rock'|'ice'|'tired', hitK 0..1, alpha, part 'all'|'back'|'front'}.
// drawFish(ctx, x, y, L, ang, t, o)  one fish, nose at +x of ang; L = length px; o: {beat (tail phase), flip 0..1, alarm}.
//
// In game: drawSeaUnder() (before the eggs: fish, the current, ink, the octopus or the arms behind a held egg) and
// drawSeaOver() (after the eggs: the arms that wrap a held egg, and the mantle over it). ctx in world space (m, y up).
import { RING_TH, TAU } from '../sim/geom.js';
import { FISH } from '../sim/sea.js';
import { statusClock, statusDraw, dizzyStars } from './status.js';

export const OCT_S = 0.44; // m: mantle size (the art's s)
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const sstep = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const rgb = (c, al = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${al})`;
const pxSpace = (ctx, x, y, k, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(1 / k, -1 / k); try { f(); } catch (e) { if (typeof console !== "undefined" && !pxSpace.w) { pxSpace.w = 1; console.warn("sea art", e); } } ctx.restore(); };

const OP = { // octopus palette: violet on blue water and coral rings; flushes hot red before it grabs
  line: hex('#2a0f3e'), body: hex('#9a4fd6'), hi: hex('#c993f2'), lo: hex('#6328a0'), arm: hex('#8a44c8'), armLo: hex('#5a2490'),
  spot: hex('#6d2fae'), under: hex('#f0c8ff'), eye: hex('#fffbe8'), pupil: hex('#1a0a24'),
  warn: hex('#ff3b5c'), warnHi: hex('#ffa0b0'), warnLo: hex('#b8183a'), warnSpot: hex('#ffe14d'),
};
const TINT = { zap: hex('#fff27a'), water: hex('#8fd8ff'), flash: hex('#fffbe0'), dash: hex('#ffd6a0'), rock: hex('#ffb070'), ice: hex('#cfefff') };
const FP = { line: hex('#2a1a06'), body: hex('#ffcf2e'), hi: hex('#fff1a0'), lo: hex('#e89a10'), stripe: hex('#2b6fe8'), fin: hex('#ff8a1e'), eye: hex('#ffffff') };

// ---------------------------------------------------------------- pose blender
// channels: curl (tips curl out), spread (arm fan, rad), wave, swim (bell pulse), reach (front arms toward look),
// stream (arms trail, jet), splay (struck), squash (mantle), lift (arms raised for the grab)
const POSES = {
  idle: { curl: 0.85, spread: 0.72, wave: 0.35, swim: 0.35, reach: 0, stream: 0, splay: 0, squash: 0, lift: 0 },
  seek: { curl: 0.55, spread: 0.6, wave: 0.3, swim: 1, reach: 0.25, stream: 0.15, splay: 0, squash: 0, lift: 0 },
  warn: { curl: 0.35, spread: 0.95, wave: 0.18, swim: 0, reach: 0.75, stream: 0, splay: 0, squash: -0.25, lift: 1 },
  grab: { curl: 0.2, spread: 0.85, wave: 0.1, swim: 0, reach: 1, stream: 0, splay: 0, squash: 0.25, lift: 0.4 },
  carry: { curl: 0.7, spread: 0.7, wave: 0.25, swim: 0.55, reach: 0, stream: 0, splay: 0, squash: 0, lift: 0 },
  struck: { curl: 0.1, spread: 1.45, wave: 0.9, swim: 0, reach: 0, stream: 0, splay: 1, squash: 0.35, lift: 0.3 },
  jet: { curl: 0.15, spread: 0.12, wave: 0.25, swim: 0, reach: 0, stream: 1, splay: 0, squash: -0.4, lift: 0 },
};
export function octoAnim() {
  const A = { ...POSES.idle };
  return {
    A,
    update(dt, pose, rate = 7) { const P = POSES[pose] || POSES.idle, k = 1 - Math.exp(-rate * dt); for (const c in P) A[c] += (P[c] - A[c]) * k; },
    snap(pose) { Object.assign(A, POSES[pose] || POSES.idle); },
  };
}

// ---------------------------------------------------------------- octopus rig
const NA = 8, NS = 11; // arms, points per arm
const armPts = Array.from({ length: NA }, () => Array.from({ length: NS }, () => ({ x: 0, y: 0 })));
function freeArm(i, s, t, A, look, seed) {
  const f = (2 * i) / (NA - 1) - 1, side = f < 0 ? 1 : -1, back = i % 2;
  const sw = A.swim * Math.sin(t * 3.2 + seed) * 0.28; // bell pulse
  const bx = f * 0.27 * s * (1 + 0.15 * A.splay), by = 0.2 * s + 0.05 * s * (1 - f * f) - (back ? 0.03 * s : 0);
  let th = Math.PI / 2 - f * (A.spread + sw) * (back ? 0.8 : 1) - A.lift * f * 0.5;
  if (A.reach > 0 && look && !back) { // front arms reach for the target
    const want = Math.atan2(look.y - by, look.x - bx), w = A.reach * (0.55 + 0.45 * (1 - Math.abs(f)));
    th += wrapA(want - th) * w;
  }
  const len = (back ? 1.0 : 1.12) * s * (1 + 0.12 * A.stream), ds = len / (NS - 1), P = armPts[i];
  let x = bx, y = by;
  P[0].x = x; P[0].y = y;
  for (let j = 1; j < NS; j++) {
    const u = j / (NS - 1);
    const curl = A.curl * side * (f === 0 ? 1 : 1) * 4.2 * u * u * (1 - 0.6 * A.stream) * (1 - A.reach * 0.7);
    const wave = A.wave * Math.sin(t * (2.2 + 5 * A.splay + 2 * A.stream) + seed + i * 1.7 - u * 3.2) * (0.6 + u) * (A.splay ? 1 : 0.8);
    const stream = A.stream * (Math.PI / 2 - th) * 0.35; // jet: the arms bunch into a trailing bundle
    th += (curl + wave) / (NS - 1) * 1.6 + stream;
    x += Math.cos(th) * ds; y += Math.sin(th) * ds;
    P[j].x = x; P[j].y = y;
  }
  return P;
}
// an arm wrapped round the egg: base -> a contact point on the egg -> round it (ellipse rx, ry, angle ea, centre ex, ey)
const wrapPts = Array.from({ length: NS }, () => ({ x: 0, y: 0 }));
function wrapArm(P, E, k0, sweep) {
  const b = P[0], ca = Math.cos(E.a), sa = Math.sin(E.a);
  const on = (q) => ({ x: E.x + Math.cos(q) * E.rx * 1.08 * ca - Math.sin(q) * E.ry * 1.12 * sa, y: E.y + Math.cos(q) * E.rx * 1.08 * sa + Math.sin(q) * E.ry * 1.12 * ca });
  const c0 = on(k0), m = 3; // three points to reach the egg, the rest round it
  for (let j = 0; j < NS; j++) {
    let q;
    if (j <= m) { const u = j / m; q = { x: lerp(b.x, c0.x, u), y: lerp(b.y, c0.y, u) - Math.sin(Math.PI * u) * 0.05 * Math.hypot(c0.x - b.x, c0.y - b.y) }; }
    else q = on(k0 + sweep * ((j - m) / (NS - 1 - m)));
    wrapPts[j].x = q.x; wrapPts[j].y = q.y;
  }
  return wrapPts;
}

function strokeArm(ctx, P, w0, w1, fill, line, lw) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = pass ? fill : line;
    for (let j = 0; j < NS - 1; j++) {
      const u = (j + 0.5) / (NS - 1), w = lerp(w0, w1, u);
      ctx.lineWidth = pass ? w : w + 2 * lw;
      ctx.beginPath(); ctx.moveTo(P[j].x, P[j].y); ctx.lineTo(P[j + 1].x, P[j + 1].y); ctx.stroke();
    }
  }
}
function armUnder(ctx, P, w0, col) { // a pale sucker line along the inside of the curl (front arms)
  ctx.strokeStyle = col; ctx.lineCap = 'round';
  for (let j = 2; j < NS - 2; j++) {
    const dx = P[j + 1].x - P[j].x, dy = P[j + 1].y - P[j].y, l = Math.hypot(dx, dy) || 1, w = lerp(w0, w0 * 0.25, j / (NS - 1));
    const ox = (-dy / l) * w * 0.28, oy = (dx / l) * w * 0.28;
    ctx.lineWidth = Math.max(0.6, w * 0.32);
    ctx.beginPath(); ctx.moveTo(P[j].x + ox, P[j].y + oy); ctx.lineTo(P[j + 1].x + ox, P[j + 1].y + oy); ctx.stroke();
  }
}

function mantlePath(ctx, s, sx, sy) {
  const X = (v) => v * s * sx, Y = (v) => v * s * sy;
  ctx.beginPath();
  ctx.moveTo(X(-0.3), Y(0.22));
  ctx.bezierCurveTo(X(-0.5), Y(0.1), X(-0.52), Y(-0.36), X(-0.3), Y(-0.6));
  ctx.bezierCurveTo(X(-0.14), Y(-0.76), X(0.14), Y(-0.76), X(0.3), Y(-0.6));
  ctx.bezierCurveTo(X(0.52), Y(-0.36), X(0.5), Y(0.1), X(0.3), Y(0.22));
  ctx.quadraticCurveTo(0, Y(0.32), X(-0.3), Y(0.22));
  ctx.closePath();
}

export function drawOctopus(ctx, x, y, s, t, o = {}) {
  const A = o.A || POSES.idle, part = o.part || 'all', rot = o.rot ?? -Math.PI / 2, seed = o.seed || 0;
  const lw = Math.max(1, s * 0.07);
  // colours: the about-to-grab flush, then a struck tint
  const pk = clamp(o.pulse || 0, 0, 1), tint = o.hit && TINT[o.hit], hk = tint ? clamp(o.hitK || 0, 0, 1) : 0;
  const tone = (c, w) => { let r = mix(c, w, pk); if (hk) r = mix(r, tint, hk * 0.5); return r; };
  const body = tone(OP.body, OP.warn), hi = tone(OP.hi, OP.warnHi), lo = tone(OP.lo, OP.warnLo), arm = tone(OP.arm, OP.warn), armLo = tone(OP.armLo, OP.warnLo);
  const spot = mix(OP.spot, OP.warnSpot, pk), line = OP.line;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot + Math.PI / 2); // local -y = mantle top
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  const sc = o.scale || 1;
  if (sc !== 1) ctx.scale(sc, sc);
  // the egg and the look target in the local frame
  const toL = (p) => { const dx = p.x - x, dy = p.y - y, c = Math.cos(-(rot + Math.PI / 2)), sn = Math.sin(-(rot + Math.PI / 2)); return { x: (dx * c - dy * sn) / sc, y: (dx * sn + dy * c) / sc }; };
  const look = o.look ? toL(o.look) : null;
  let E = null;
  if (o.egg && o.wrap > 0) { const q = toL(o.egg); E = { x: q.x, y: q.y, rx: o.egg.rx / sc, ry: o.egg.ry / sc, a: 0 }; } // held lying along the channel
  // the arms: three wrap the egg (the front ones nearest it), the rest stay free
  const order = [1, 7, 3, 5, 0, 6, 2, 4]; // back arms first
  const wrapIx = E ? [2, 4, 6] : [];
  const drawArmI = (i) => {
    let P = freeArm(i, s, t, A, look, seed);
    const wi = wrapIx.indexOf(i);
    if (wi >= 0) {
      // left arm: from the egg's upper left down round its belly; right arm: the mirror; middle arm: a cup under it
      // (none crosses the egg's face or the octopus's eyes)
      const k0 = [Math.PI + 0.45, Math.PI / 2 + 1.1, -0.45][wi], sweep = [-2.5, -2.2, 2.5][wi];
      const W = wrapArm(P, E, k0, sweep), w = sstep(o.wrap) * (0.92 + 0.08 * Math.sin(t * 3 + i));
      for (let j = 0; j < NS; j++) { P[j].x = lerp(P[j].x, W[j].x, w); P[j].y = lerp(P[j].y, W[j].y, w); }
    }
    const back = i % 2 && wi < 0, w0 = s * (back ? 0.13 : wi >= 0 ? 0.12 : 0.155), w1 = s * 0.035;
    strokeArm(ctx, P, w0, w1, rgb(back ? armLo : arm), rgb(line), lw * 0.85);
    if (!back && s > 9) armUnder(ctx, P, w0, rgb(mix(OP.under, OP.warnHi, pk), 0.85));
  };
  // part 'back': the free arms and the mantle (under a held egg); 'front': the arms wrapped over it
  const front = part !== 'back', backP = part !== 'front';
  if (backP) for (const i of order) if (wrapIx.indexOf(i) < 0) drawArmI(i);
  // the mantle: squash/stretch, breathing
  const br = 1 + 0.04 * Math.sin(t * 2.1 + seed) + A.swim * 0.06 * Math.sin(t * 3.2 + seed + 1.2);
  const sx = (1 + 0.22 * A.squash) * br * (1 - 0.2 * A.stream), sy = (1 - 0.18 * A.squash) / br * (1 + 0.22 * A.stream);
  if (front && wrapIx.length) for (const i of wrapIx) drawArmI(i);
  if (part === 'front' && wrapIx.length) drawOctoFace(ctx, s, sx, sy, t, o, look, lw, A); // the eyes stay over the egg it holds
  if (backP) {
    if (pk > 0.02) {
      ctx.save();
      ctx.globalAlpha *= 0.5 * pk * (0.6 + 0.4 * Math.sin(t * 20));
      ctx.fillStyle = rgb(OP.warn);
      ctx.beginPath(); ctx.ellipse(0, -0.22 * s * sy, 0.62 * s * sx, 0.7 * s * sy, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    mantlePath(ctx, s, sx, sy);
    ctx.fillStyle = rgb(body); ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = rgb(lo); // cel shadow: the lower right
    ctx.beginPath(); ctx.ellipse(0.24 * s * sx, 0.02 * s * sy, 0.46 * s * sx, 0.62 * s * sy, -0.4, 0, TAU); ctx.fill();
    ctx.fillStyle = rgb(body);
    ctx.beginPath(); ctx.ellipse(-0.06 * s * sx, -0.3 * s * sy, 0.42 * s * sx, 0.46 * s * sy, -0.4, 0, TAU); ctx.fill();
    ctx.fillStyle = rgb(hi); // highlight top left
    ctx.beginPath(); ctx.ellipse(-0.18 * s * sx, -0.48 * s * sy, 0.11 * s * sx, 0.16 * s * sy, -0.5, 0, TAU); ctx.fill();
    ctx.fillStyle = rgb(spot, pk > 0.3 ? 0.95 : 0.8); // chromatophore spots (they light up in the flush)
    for (const [px, py, r] of [[0.16, -0.42, 0.06], [0.28, -0.18, 0.05], [-0.04, -0.6, 0.045], [0.06, -0.12, 0.04]]) { ctx.beginPath(); ctx.arc(px * s * sx, py * s * sy, r * s * (1 + 0.5 * pk), 0, TAU); ctx.fill(); }
    ctx.restore();
    mantlePath(ctx, s, sx, sy);
    ctx.strokeStyle = rgb(line); ctx.lineWidth = lw; ctx.stroke();
    drawOctoFace(ctx, s, sx, sy, t, o, look, lw, A);
    if (hk > 0.05) drawHitFX(ctx, s, t, o.hit, hk, lw);
  }
  ctx.restore();
}

function drawOctoFace(ctx, s, sx, sy, t, o, look, lw, A) {
  const ey = 0.06 * s * sy, ex = 0.19 * s * sx, er = 0.15 * s, hit = o.hitK > 0.05 ? o.hit : null;
  const blink = hit === 'tired' ? 0.55 : ((t + (o.seed || 0)) % 3.7 < 0.12 ? 1 : 0);
  for (const sd of [-1, 1]) {
    const cx = sd * ex;
    ctx.fillStyle = rgb(OP.eye);
    ctx.beginPath(); ctx.ellipse(cx, ey, er, er * 1.1, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgb(OP.line); ctx.lineWidth = lw * 0.85; ctx.stroke();
    if (hit === 'zap' || hit === 'flash') { // dazzled: x eyes
      ctx.lineWidth = Math.max(1, er * 0.38); ctx.lineCap = 'round';
      const d = er * 0.5;
      ctx.beginPath(); ctx.moveTo(cx - d, ey - d); ctx.lineTo(cx + d, ey + d); ctx.moveTo(cx + d, ey - d); ctx.lineTo(cx - d, ey + d); ctx.stroke();
      continue;
    }
    let lx = 0, ly = 0.15;
    if (look) { const dx = look.x - cx, dy = look.y - ey, l = Math.hypot(dx, dy) || 1; lx = dx / l; ly = dy / l; }
    const pr = er * (A.lift > 0.5 ? 0.42 : 0.52);
    ctx.fillStyle = rgb(OP.pupil); // a wide octopus pupil
    ctx.beginPath(); ctx.ellipse(cx + lx * er * 0.38, ey + ly * er * 0.38, pr * 1.15, pr * 0.78, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(cx + lx * er * 0.38 - pr * 0.4, ey + ly * er * 0.38 - pr * 0.35, Math.max(0.6, pr * 0.32), 0, TAU); ctx.fill();
    if (blink) { // lid
      ctx.fillStyle = rgb(mix(OP.body, OP.warn, clamp(o.pulse || 0, 0, 1)));
      ctx.beginPath(); ctx.ellipse(cx, ey - er * (1.1 - 1.1 * blink), er * 1.04, er * 1.1 * blink, 0, Math.PI, TAU); ctx.fill();
      ctx.beginPath(); ctx.rect(cx - er * 1.04, ey - er * 1.1, er * 2.08, er * 1.1 * blink * 1.9 * 0.5); ctx.fill();
      ctx.strokeStyle = rgb(OP.line); ctx.lineWidth = lw * 0.7;
      ctx.beginPath(); ctx.moveTo(cx - er, ey - er * 1.1 + er * 2.2 * blink * 0.5); ctx.lineTo(cx + er, ey - er * 1.1 + er * 2.2 * blink * 0.5); ctx.stroke();
    }
  }
  // brows: a mean slant while it flushes to grab
  if ((o.pulse || 0) > 0.15) {
    ctx.strokeStyle = rgb(OP.line); ctx.lineWidth = Math.max(1, er * 0.42); ctx.lineCap = 'round';
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * (ex + er * 0.95), ey - er * 1.45); ctx.lineTo(sd * (ex - er * 0.75), ey - er * 1.0); ctx.stroke(); }
  }
}

function drawHitFX(ctx, s, t, kind, k, lw) {
  ctx.save();
  ctx.globalAlpha *= k;
  if (kind === 'zap') { // little bolts round the mantle
    ctx.strokeStyle = '#fff27a'; ctx.lineWidth = Math.max(1, lw * 0.9); ctx.lineJoin = 'round';
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.floor(t * 14) * 0.9, r0 = 0.55 * s, r1 = 0.9 * s;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0 - 0.25 * s);
      ctx.lineTo(Math.cos(a + 0.25) * (r0 + r1) / 2, Math.sin(a + 0.25) * (r0 + r1) / 2 - 0.25 * s);
      ctx.lineTo(Math.cos(a - 0.05) * r1, Math.sin(a - 0.05) * r1 - 0.25 * s); ctx.stroke();
    }
  } else if (kind === 'water') { // drops fly off
    ctx.fillStyle = '#bfe9ff'; ctx.strokeStyle = 'rgba(20,60,110,0.8)'; ctx.lineWidth = Math.max(0.6, lw * 0.5);
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.55, r = (0.7 + 0.35 * (1 - k)) * s; ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r - 0.2 * s, 0.07 * s, 0, TAU); ctx.fill(); ctx.stroke(); }
  } else if (kind !== 'tired') { // stars
    ctx.fillStyle = '#fff6c2';
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + (i / 3) * TAU, cx = Math.cos(a) * 0.5 * s, cy = -0.8 * s + Math.sin(a) * 0.14 * s, r = 0.1 * s;
      ctx.beginPath();
      for (let j = 0; j < 10; j++) { const q = (j / 10) * TAU - Math.PI / 2, rr = j % 2 ? r * 0.45 : r; ctx.lineTo(cx + Math.cos(q) * rr, cy + Math.sin(q) * rr); }
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
}

// the ink cloud: a cluster of dark puffs that spread and fade (age 0..INK_T s)
export const INK_T = 2.6;
export function drawInk(ctx, x, y, s, age, seed = 0, amt = 1) {
  if (age >= INK_T) return;
  const u = age / INK_T, grow = 1 - Math.exp(-age * 2.4);
  ctx.save();
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < 8; i++) {
      const a = i * 2.39996 + seed, d = (0.15 + 0.85 * ((i * 0.37 + seed * 0.1) % 1)) * s * 1.1 * grow * amt, r = s * (0.25 + 0.35 * grow) * (0.7 + 0.3 * ((i * 0.61) % 1)) * amt;
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d - age * 0.15 * s;
      ctx.fillStyle = pass ? `rgba(26,18,48,${0.82 * (1 - u) * (1 - u * 0.4)})` : `rgba(92,70,140,${0.45 * (1 - u)})`;
      ctx.beginPath(); ctx.arc(px, py, pass ? r : r * 1.15, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- fish
export function drawFish(ctx, x, y, L, ang, t, o = {}) {
  const flip = o.flip ?? 1, beat = o.beat ?? t * 10, lw = Math.max(0.8, L * 0.075);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const up = (Math.cos(ang) < 0 ? -1 : 1) * (o.belly ? -1 : 1); // keep the back up on screen (stunned: belly up)
  ctx.scale(Math.max(0.12, Math.abs(flip)), up);
  const tail = Math.sin(beat) * 0.38;
  const line = rgb(FP.line);
  // tail
  ctx.save();
  ctx.translate(-0.3 * L, 0); ctx.rotate(tail);
  ctx.beginPath(); ctx.moveTo(0.04 * L, 0); ctx.lineTo(-0.26 * L, -0.2 * L); ctx.quadraticCurveTo(-0.16 * L, 0, -0.26 * L, 0.2 * L); ctx.closePath();
  ctx.fillStyle = rgb(FP.fin); ctx.fill(); ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.restore();
  // dorsal fin
  ctx.beginPath(); ctx.moveTo(-0.12 * L, -0.15 * L); ctx.quadraticCurveTo(0.0, -0.36 * L, 0.12 * L, -0.17 * L); ctx.closePath();
  ctx.fillStyle = rgb(FP.fin); ctx.fill(); ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.stroke();
  // body
  ctx.beginPath(); ctx.ellipse(0.04 * L, 0, 0.36 * L, 0.21 * L, 0, 0, TAU);
  ctx.fillStyle = rgb(FP.body); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = rgb(FP.lo); ctx.beginPath(); ctx.ellipse(0.02 * L, 0.16 * L, 0.42 * L, 0.14 * L, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = rgb(FP.stripe); ctx.fillRect(-0.07 * L, -0.3 * L, 0.11 * L, 0.6 * L);
  ctx.fillStyle = rgb(FP.hi); ctx.beginPath(); ctx.ellipse(0.12 * L, -0.1 * L, 0.14 * L, 0.05 * L, -0.1, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.beginPath(); ctx.ellipse(0.04 * L, 0, 0.36 * L, 0.21 * L, 0, 0, TAU);
  ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.stroke();
  // eye (wide when alarmed)
  const er = 0.075 * L * (1 + 0.35 * (o.alarm || 0));
  ctx.fillStyle = rgb(FP.eye); ctx.beginPath(); ctx.arc(0.24 * L, -0.04 * L, er, 0, TAU); ctx.fill();
  if (o.dizzy) { // stunned: an X eye and a little open mouth
    ctx.strokeStyle = line; ctx.lineWidth = Math.max(1, L * 0.05); ctx.lineCap = 'round'; ctx.beginPath();
    const ex = 0.24 * L, ey = -0.04 * L, d = er * 0.85;
    ctx.moveTo(ex - d, ey - d); ctx.lineTo(ex + d, ey + d); ctx.moveTo(ex + d, ey - d); ctx.lineTo(ex - d, ey + d);
    ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0.4 * L, 0.04 * L, L * 0.03, L * 0.045, 0, 0, TAU); ctx.fillStyle = line; ctx.fill();
  } else { ctx.fillStyle = line; ctx.beginPath(); ctx.arc(0.25 * L + er * 0.2, -0.04 * L, er * 0.55, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// ---------------------------------------------------------------- in game
export const seaAnim = new Map(); // 'o' + id / 'f' + id -> per-creature render state; reset with a new sim
const toPx = (x, y, k) => ({ x: x * k, y: -y * k });

function octPose(C) {
  switch (C.ph) {
    case 'seek': case 'home': return 'seek';
    case 'warn': return 'warn';
    case 'grab': return 'grab';
    case 'carry': return 'carry';
    case 'let': return 'struck';
    case 'jet': return 'jet';
    default: return 'idle';
  }
}
function octState(sim, C, t, k) {
  let R = seaAnim.get('o' + C.id);
  const fresh = !R || R.sim !== sim || t < R.t - 0.5;
  if (fresh) { R = { sim, t, an: octoAnim(), rot: null, wrap: 0, hitK: 0, hit: '', pulse: 0, lx: 0, ly: 0 }; seaAnim.set('o' + C.id, R); R.an.snap(octPose(C)); }
  const dt = clamp(t - R.t, 0, 0.1);
  R.t = t;
  R.dt = dt;
  return R;
}
function octFrame(sim, C, R, t, k) {
  const dt = R.dt, pose = octPose(C);
  R.an.update(dt, pose, pose === 'struck' || pose === 'jet' ? 14 : 7);
  const A = R.an.A;
  const p = toPx(C.rad * Math.cos(C.a), C.rad * Math.sin(C.a), k), s = OCT_S * k;
  // the mantle points away from the wall it grips (toward the centre), leaning into its travel; jetting, it leads
  const inward = Math.atan2(Math.sin(C.a), -Math.cos(C.a));
  const vx = C.vx * k, vy = -C.vy * k, sp = Math.hypot(vx, vy);
  let want = inward;
  const tan = (vx * Math.sin(C.a) + vy * Math.cos(C.a)) / Math.max(1, k); // m/s along the channel, + = clockwise on screen
  want += clamp(-tan * 0.5, -0.45, 0.45);
  if (A.stream > 0.05 && sp > 5) want = wrapA(inward + wrapA(Math.atan2(vy, vx) - inward) * clamp(A.stream, 0, 1));
  if (R.rot == null) R.rot = want;
  R.rot += wrapA(want - R.rot) * Math.min(1, dt * (pose === 'jet' ? 12 : 5));
  // the about-to-grab flush: faster as it nears the grab, solid at the grab
  const u = C.dur > 0 ? clamp(1 - C.t / C.dur, 0, 1) : 1;
  const pw = C.ph === 'warn' ? 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * (9 + 16 * u))) * (0.5 + 0.5 * u) + 0.25 * u : C.ph === 'grab' ? 1 : 0;
  R.pulse += (clamp(pw, 0, 1) - R.pulse) * Math.min(1, dt * 18);
  // struck: the tint flashes and fades through the let-go and the jet
  if (C.ph === 'let') { R.hit = C.hit; R.hitK = Math.min(1, R.hitK + dt * 10); }
  else R.hitK = Math.max(0, R.hitK - dt * (C.ph === 'jet' ? 1.2 : 3));
  // wrap: the grab closes the arms over the egg; carrying, they hold
  const egg = C.eid ? sim.eggs.find((e) => e.id === C.eid && e.alive && e.body) : C.ph === 'grab' ? sim.eggs.find((e) => e.id === C.tgt && e.alive && e.body) : null;
  const ww = C.ph === 'carry' && egg ? 1 : C.ph === 'grab' ? clamp(u * 1.4, 0, 1) : 0;
  R.wrap += (ww - R.wrap) * Math.min(1, dt * (ww > R.wrap ? 14 : 9));
  if (egg) { const q = egg.body.getPosition(); R.egg = { ...toPx(q.x, q.y, k), rx: 0.28 * k, ry: 0.21 * k }; }
  else if (R.wrap < 0.02) R.egg = null;
  // eyes: the target egg, else ahead
  let look = null;
  const tg = C.tgt && sim.eggs.find((e) => e.id === C.tgt && e.alive && e.body);
  if (tg && (C.ph === 'seek' || C.ph === 'warn' || C.ph === 'grab')) { const q = tg.body.getPosition(); look = toPx(q.x, q.y, k); }
  else if (sp > 3) look = { x: p.x + vx * 0.3, y: p.y + vy * 0.3 };
  const alpha = C.ph === 'in' ? sstep(1 - C.t / C.dur) : 1, scale = C.ph === 'in' ? 0.5 + 0.5 * sstep(1 - C.t / C.dur) : 1;
  return { p, s, o: { rot: R.rot, A, egg: R.egg, wrap: R.wrap, look, pulse: R.pulse, hit: R.hit, hitK: R.hitK, alpha, scale, seed: C.id * 1.7 } };
}

function fishState(sim, S, t) {
  let R = seaAnim.get('f' + S.id);
  if (!R || R.sim !== sim || t < R.t - 0.5) { R = { sim, t, f: S.f.map(() => ({ h: null, flip: 1, beat: 0, alarm: 0 })), cur: 1 }; seaAnim.set('f' + S.id, R); }
  R.dt = clamp(t - R.t, 0, 0.1); R.t = t;
  return R;
}

export function drawSeaUnder(ctx, sim, t, k) {
  if (!(sim.octos && sim.octos.length) && !(sim.schools && sim.schools.length)) return;
  for (const S of sim.schools || []) drawSchool(ctx, sim, S, t, k);
  for (const C of sim.octos || []) {
    if (C.ph === 'wait') continue;
    const R = octState(sim, C, t, k), F = octFrame(sim, C, R, t, k);
    R.F = F;
    if (C.inkT < INK_T) pxSpace(ctx, 0, 0, k, () => drawInk(ctx, C.inkX * k, -C.inkY * k, OCT_S * k, C.inkT, C.id * 2.3, C.hit === 'tired' ? 0.65 : 1));
    if (C.ph === 'jet') { // puffs of ink behind it as it shoots off
      const u = clamp(1 - C.t / C.dur, 0, 1);
      pxSpace(ctx, 0, 0, k, () => {
        for (let j = 1; j <= 4; j++) {
          const q = F.p, b = Math.hypot(C.vx, C.vy) || 1, dx = (-C.vx / b) * j * 0.18 * k, dy = (C.vy / b) * j * 0.18 * k;
          ctx.fillStyle = `rgba(26,18,48,${0.55 * (1 - u) * (1 - j / 5)})`;
          ctx.beginPath(); ctx.arc(q.x + dx, q.y + dy, (0.07 + 0.03 * j) * k, 0, TAU); ctx.fill();
        }
      });
    }
    // with an egg in its arms (or closing on one), the arms behind the egg go here, the rest after the eggs
    const split = F.o.wrap > 0.05 && F.o.egg;
    pxSpace(ctx, 0, 0, k, () => drawOctopus(ctx, F.p.x, F.p.y, F.s, t, { ...F.o, part: split ? 'back' : 'all' }));
  }
}
export function drawSeaOver(ctx, sim, t, k) {
  for (const C of sim.octos || []) {
    const R = seaAnim.get('o' + C.id);
    if (C.ph === 'wait' || !R || !R.F || R.sim !== sim) continue;
    const F = R.F;
    if (F.o.wrap > 0.05 && F.o.egg) pxSpace(ctx, 0, 0, k, () => drawOctopus(ctx, F.p.x, F.p.y, F.s, t, { ...F.o, part: 'front' }));
  }
}

function drawSchool(ctx, sim, S, t, k) {
  const R = fishState(sim, S, t), dt = R.dt, c = S.ch, r0 = sim.rings[c - 1].r + RING_TH / 2, r1 = sim.rings[c].r - RING_TH / 2;
  const L = FISH.len * k;
  // the current they make: faint streaks through the school, flowing their way (gone while they scatter)
  const cur = S.push * (S.ph === 'scatter' ? 0 : 1);
  R.cur += (cur - R.cur) * Math.min(1, dt * 6);
  if (R.cur > 0.03) {
    let sx = 0, sy = 0;
    for (const f of S.f) { sx += Math.cos(f.a); sy += Math.sin(f.a); }
    const ca = Math.atan2(sy, sx), span = 0.85 / ((r0 + r1) / 2);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.setLineDash([0.16, 0.22]);
    for (let j = 0; j < 3; j++) {
      const rr = lerp(r0, r1, 0.25 + j * 0.25);
      ctx.lineDashOffset = S.dir * t * S.speed * 0.9 + j * 0.13;
      ctx.strokeStyle = `rgba(225,250,255,${0.42 * R.cur})`;
      ctx.lineWidth = 0.035;
      ctx.beginPath();
      ctx.arc(0, 0, rr, ca - span * 1.15, ca + span * 1.15);
      ctx.stroke();
    }
    ctx.restore();
  }
  // frozen: stopped mid-swim in a thin ice glaze (held pose); stunned: adrift belly up, wobbling, stars; zapped: arcs first
  const st = statusClock(sim, 'y' + S.id, S.fz > 0 ? { k: 'ice', left: S.fz } : S.sn > 0 ? { k: 'stun', zap: S.zp > 0, left: S.sn } : null, t);
  const frozen = st && st.k === 'ice', stunned = st && st.k === 'stun';
  pxSpace(ctx, 0, 0, k, () => {
    S.f.forEach((f, j) => {
      const F = R.f[j], x = f.r * Math.cos(f.a), y = f.r * Math.sin(f.a);
      if (frozen) { // nothing moves: the same heading, the same tail
        const fs = { ...st, seed: st.seed + j * 13 };
        statusDraw(ctx, { x0: x * k - L, y0: -y * k - L, x1: x * k + L, y1: -y * k + L }, (c) => drawFish(c, x * k, -y * k, L, F.h ?? 0, st.hold, { flip: Math.abs(F.flip), beat: F.beat + j, alarm: 0 }), fs, { off: Math.max(1.6, L * 0.12), rim: Math.max(1, L * 0.07), crys: Math.max(0.6, L / 26), quick: true });
        return;
      }
      // heading from its velocity (va along the channel, vr out)
      const ux = Math.cos(f.a), uy = Math.sin(f.a), vx = -uy * f.va + ux * f.vr, vy = ux * f.va + uy * f.vr, sp = Math.hypot(vx, vy);
      const want = sp > 0.08 ? Math.atan2(-vy, vx) : F.h ?? Math.atan2(-ux * f.d, -uy * f.d);
      if (F.h == null) F.h = want;
      const d = wrapA(want - F.h);
      if (Math.abs(d) > 2.2 && F.flip >= 0.999) F.flip = -1; // a reversal: the body flips round (narrows through side-on)
      if (F.flip < 1) { F.flip = Math.min(1, F.flip + dt * 7); if (F.flip >= 0 && F.flip - dt * 7 < 0) F.h = want; }
      else F.h += d * Math.min(1, dt * 8);
      F.beat += dt * (6 + 5 * clamp(sp, 0, 3));
      F.alarm += ((S.ph === 'scatter' ? 1 : 0) - F.alarm) * Math.min(1, dt * 6);
      if (stunned) {
        const wob = Math.sin(t * 1.9 + j * 2.1) * 0.32, bob = Math.sin(t * 1.3 + j * 1.7) * L * 0.1, fs = { ...st, seed: st.seed + j * 13 };
        statusDraw(ctx, { x0: x * k - L, y0: -y * k - L * 1.6, x1: x * k + L, y1: -y * k + L }, (c) => drawFish(c, x * k, -y * k + bob, L, F.h + wob, t, { flip: Math.abs(F.flip), beat: t * 1.4 + j, alarm: 0, belly: 1, dizzy: 1 }), fs, { quick: true, crys: 0.6 });
        dizzyStars(ctx, x * k, -y * k + bob - L * 0.38, L * 0.34, L * 0.1, t + j * 0.7, { size: Math.max(1.7, L * 0.1), tilt: -0.15 });
        return;
      }
      drawFish(ctx, x * k, -y * k, L, F.h, t, { flip: Math.abs(F.flip), beat: F.beat + j, alarm: F.alarm });
    });
  });
}

// ---------------------------------------------------------------- events -> SFX/VFX (main.js handleEvents)
export function seaEvent(ev, fx, U) {
  const { popup, audio, once } = U;
  switch (ev.type) {
    case 'octIn':
      audio.play('bubble_on', { vol: 0.6, pitch: 0.7 });
      fx.sparkle(ev.x, ev.y, 6, '#d9b8ff');
      once('octIn', 'An octopus! It grabs eggs and carries them off. Water, a zap or a glow flash makes it let go.');
      break;
    case 'octWarn':
      audio.play('squish', { vol: 0.5, pitch: 1.4 });
      break;
    case 'octGrab':
      audio.play('grab', { vol: 0.8, pitch: 0.8 });
      popup(ev.x, ev.y + 0.75, 'Grabbed!', { color: '#ff8fb0', size: 18, life: 0.9 });
      once('octGrab', 'It holds the egg safe from thorns and snakes, but it is carrying it away.');
      break;
    case 'octLetGo': {
      const T = { water: ['Washed off!', '#8fd8ff', 'splash'], zap: ['Zapped!', '#fff27a', 'thunder'], flash: ['Dazzled!', '#fff6c2', 'glass_crack'], dash: ['Bonk!', '#ffd6a0', 'rock_hit'], rock: ['Bonk!', '#ffb070', 'rock_hit'], ice: ['Brr!', '#bfe9ff', 'glass_crack'], tired: ['Let go', '#e6d8ff', 'release'] }[ev.kind];
      if (!T) break;
      audio.play(T[2], { vol: ev.kind === 'zap' ? 0.4 : 0.6, pitch: 1.2 });
      fx.sparkle(ev.x, ev.y, 8, T[1]);
      popup(ev.x, ev.y + 0.75, T[0], { color: T[1], size: 18, life: 0.9 });
      break;
    }
    case 'octJet':
      audio.play('bubble_pop', { vol: 0.7, pitch: 0.6 });
      break;
    case 'fishScatter':
      audio.play('splash', { vol: 0.35, pitch: 1.6 });
      fx.sparkle(ev.x, ev.y, 5, '#ffe9a0');
      once('fishScatter', 'The school scattered: no current for a moment. They regroup soon.');
      break;
    case 'fishIn':
      once('fishIn', 'Fish push eggs along as they swim past. Drop an egg on them and they scatter.');
      break;
  }
}
