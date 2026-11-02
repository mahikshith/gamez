// The octopus, a villain (v3.5): crisp cel-shaded code art in the house style (dark outline, two-tone shading), no assets.
// Deep maroon (or violet / plum, picked by contrast per world like thornLook()), a lighter belly and arm undersides with
// sucker rows, a heavy brow ridge, narrowed glowing slit-pupil eyes, a sly grin with fangs. Eight arms that curl, and that
// grip the ring wall it sits on (the wall plane o.wall clamps them).
//
// drawOctopus(ctx, x, y, s, t, o)  local y-DOWN px space (wrap in pxSpace from world space); (x, y) = the centre of the
//   mantle, s = mantle size px (OCT_S m * k in game). o: {rot (screen angle the mantle top points to), A (octoAnim()
//   channels), pal (octoLook()), wall {nx, ny, d} (the wall plane in the octopus's frame, d px from the centre), look {x, y}
//   (px target), egg {x, y, rx, ry} (the egg its arms wrap), wrap 0..1, pulse 0..1 (red flush: about to grab), hit 'zap'|
//   'water'|'flash'|'dash'|'rock'|'ice'|'tired', hitK 0..1, alpha, scale, part 'all'|'back'|'front', sub 0..1 (sunk in its
//   den), fz {k 0..1 ice strength, left s, shake 0..1}, stn 0..1 (stunned: slack, spiral eyes, circling stars), zap 0..1
//   (the crisp arc flash), shake 0..1 (shaking off the ice)}.
// drawDen(ctx, x, y, w, rot, t, pal, o): the den (a puddle on the ring floor) it lurks in.
import { TAU } from '../sim/geom.js';

export const OCT_S = 0.7; // m: mantle size (the art's s), 1.6x the first octopus
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const sstep = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const rgb = (c, al = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${al})`;
const hash = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

// ---------------------------------------------------------------- colours by contrast
// water / light worlds: deep maroon pops on blue and on snow. dark worlds (and brown ones): a brighter plum with a pale rim
// light. red / orange worlds: indigo violet with a rim light (maroon would melt into them).
const mk = (body, hi, lo, arm, armLo, under, brow, rim, rimA) => ({ body: hex(body), hi: hex(hi), lo: hex(lo), arm: hex(arm), armLo: hex(armLo), under: hex(under), brow: hex(brow), rim: hex(rim), rimA });
const PALS = {
  water: mk('#9c2468', '#d45ea0', '#5f1442', '#8c1f5c', '#52113a', '#f6b0c9', '#2e0a20', '#ffd8e8', 0.4),
  light: mk('#821a58', '#b84a8c', '#4c0d34', '#721450', '#440a2e', '#f2a0bf', '#240718', '#ffd8e8', 0.0),
  dark: mk('#a8407e', '#e07ab4', '#6a2354', '#9a3472', '#661f4e', '#ffc4da', '#3a0f2c', '#ffe6f2', 0.8),
  warm: mk('#5c3fba', '#9078ee', '#33257f', '#523aa8', '#2e2272', '#d2c6ff', '#1f1550', '#f3eeff', 0.8),
};
const C = { line: hex('#1c0614'), eye: hex('#ffd23a'), eyeHi: hex('#fff2a0'), eyeWarn: hex('#ff4a24'), pupil: hex('#16060c'), mouth: hex('#2a0714'), fang: hex('#fff3d6'),
  warn: hex('#ff2e4a'), warnHi: hex('#ff9aa8'), warnLo: hex('#a8102c'), spot: hex('#b8396f'), spotWarn: hex('#ffe14d'),
  ice: hex('#bfe6ff'), iceRim: hex('#2f6f9e'), iceFill: hex('#d8f2ff') };
const TINT = { zap: hex('#fff27a'), water: hex('#8fd8ff'), flash: hex('#fffbe0'), dash: hex('#ffd6a0'), rock: hex('#ffb070'), ice: hex('#cfefff') };

const hexRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return [0.5, 0.5, 0.5]; const n = parseInt(m[1], 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const luma = (h) => { const [r, g, b] = hexRgb(h).map((v) => (v <= 0.04 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const reddish = (h) => { const [r, g, b] = hexRgb(h); return r > 0.45 && r > g * 1.45 && r > b * 1.25; };
const sunset = (h) => { const [r, g, b] = hexRgb(h); return r > 0.7 && r > g * 1.15 && b < 0.5; };
const LOOKS = new Map();
export function octoLook(theme) {
  const key = theme?.id || '';
  let L = LOOKS.get(key);
  if (L) return L;
  const P = theme?.palette || {}, top = P.skyTop || '#3fd0e0', bot = P.skyBottom || '#0a3f6e', bg = (luma(top) + luma(bot)) / 2;
  let v = 'water';
  if (reddish(top) || reddish(bot) || sunset(top) || sunset(bot) || reddish(P.ground)) v = 'warm';
  else if (bg < 0.12) v = 'dark';
  else if (bg > 0.5) v = 'light';
  L = { v, ...PALS[v] };
  LOOKS.set(key, L);
  return L;
}

// ---------------------------------------------------------------- pose blender
// channels: curl (tips curl), spread (arm fan, rad), wave, swim (bell pulse), reach (front arms toward look), stream (arms trail,
// jet), splay (struck), squash (mantle), lift (arms raised), grip (arms pressed on the wall), scheme (front arms twirl),
// menace (brow slant / narrowed eyes), mouth (open), smug (half-lidded, wide grin), slack (stunned)
const POSES = {
  idle: { curl: 0.7, spread: 0.85, wave: 0.28, swim: 0.3, reach: 0, stream: 0, splay: 0, squash: 0, lift: 0, grip: 1, scheme: 1, menace: 0.6, mouth: 0, smug: 0.2, slack: 0 },
  seek: { curl: 0.3, spread: 0.62, wave: 0.2, swim: 0.7, reach: 0.5, stream: 0.1, splay: 0, squash: 0, lift: 0.15, grip: 0.9, scheme: 0, menace: 1, mouth: 0.1, smug: 0, slack: 0 },
  warn: { curl: 0.15, spread: 1.0, wave: 0.15, swim: 0, reach: 0.85, stream: 0, splay: 0, squash: -0.25, lift: 1, grip: 0.2, scheme: 0, menace: 1, mouth: 0.6, smug: 0, slack: 0 },
  grab: { curl: 0.15, spread: 0.85, wave: 0.1, swim: 0, reach: 1, stream: 0, splay: 0, squash: 0.25, lift: 0.4, grip: 0, scheme: 0, menace: 1, mouth: 1, smug: 0, slack: 0 },
  carry: { curl: 0.8, spread: 0.72, wave: 0.2, swim: 0.45, reach: 0, stream: 0, splay: 0, squash: 0, lift: 0, grip: 1, scheme: 0, menace: 0.35, mouth: 0, smug: 1, slack: 0 },
  squirt: { curl: 0.2, spread: 1.1, wave: 0.12, swim: 0, reach: 0.35, stream: 0, splay: 0, squash: -0.4, lift: 0.9, grip: 0.3, scheme: 0, menace: 1, mouth: 0.8, smug: 0, slack: 0 },
  struck: { curl: 0.1, spread: 1.45, wave: 0.9, swim: 0, reach: 0, stream: 0, splay: 1, squash: 0.35, lift: 0.3, grip: 0, scheme: 0, menace: 0, mouth: 0.5, smug: 0, slack: 0 },
  jet: { curl: 0.15, spread: 0.12, wave: 0.25, swim: 0, reach: 0, stream: 1, splay: 0, squash: -0.4, lift: 0, grip: 0, scheme: 0, menace: 0.7, mouth: 0, smug: 0, slack: 0 },
  slack: { curl: 0.55, spread: 1.25, wave: 0.1, swim: 0, reach: 0, stream: 0, splay: 0, squash: 0.3, lift: -0.25, grip: 1, scheme: 0, menace: 0, mouth: 0.5, smug: 0, slack: 1 },
};
export function octoAnim() {
  const A = { ...POSES.idle };
  return {
    A,
    update(dt, pose, rate = 7) { const P = POSES[pose] || POSES.idle, k = 1 - Math.exp(-rate * dt); for (const c in P) A[c] += (P[c] - A[c]) * k; },
    snap(pose) { Object.assign(A, POSES[pose] || POSES.idle); },
  };
}

// ---------------------------------------------------------------- rig
const NA = 8, NS = 11; // arms, points per arm
const armPts = Array.from({ length: NA }, () => Array.from({ length: NS }, () => ({ x: 0, y: 0 })));
const armSide = new Array(NA).fill(1);
const ARM_W0 = 0.17, ARM_W1 = 0.032; // x s
function freeArm(i, s, t, A, look, seed, W) {
  const f = (2 * i) / (NA - 1) - 1, side = f < 0 ? 1 : -1, back = i % 2, front = Math.abs(f) < 0.5;
  armSide[i] = side;
  const sw = A.swim * Math.sin(t * 3.2 + seed) * 0.26;
  const bx = f * 0.3 * s * (1 + 0.15 * A.splay), by = 0.22 * s + 0.05 * s * (1 - f * f) - (back ? 0.03 * s : 0);
  let th = Math.PI / 2 - f * (A.spread + sw) * (back ? 0.82 : 1) - A.lift * f * 0.55;
  if (A.lift < 0) th += A.lift * f * 0.4; // slack: they sprawl
  if (A.reach > 0 && look && !back) {
    const want = Math.atan2(look.y - by, look.x - bx), w = A.reach * (0.55 + 0.45 * (1 - Math.abs(f)));
    th += wrapA(want - th) * w;
  }
  const len = (back ? 1.0 : 1.15) * s * (1 + 0.12 * A.stream), ds = len / (NS - 1), P = armPts[i];
  let x = bx, y = by;
  P[0].x = x; P[0].y = y;
  if (front && A.scheme > 0.4) th -= side * 0.5 * A.scheme; // the front arms lift off the wall, tips curling like drumming fingers
  const tw = A.scheme * (front ? 1.4 : 0.35) * (0.55 + 0.45 * Math.sin(t * 1.4 + seed + i * 0.9)); // the scheming curl and twirl
  for (let j = 1; j < NS; j++) {
    const u = j / (NS - 1);
    const curl = (A.curl * 4.2 + tw * 2.6) * side * u * u * (1 - 0.6 * A.stream) * (1 - A.reach * 0.7);
    const wave = A.wave * Math.sin(t * (2.2 + 5 * A.splay + 2 * A.stream) + seed + i * 1.7 - u * 3.2) * (0.6 + u) * (A.splay ? 1 : 0.8);
    const stream = A.stream * (Math.PI / 2 - th) * 0.35;
    th += (curl + wave) / (NS - 1) * 1.6 + stream;
    x += Math.cos(th) * ds; y += Math.sin(th) * ds;
    if (W && A.grip > 0.01 && !(front && A.scheme > 0.4 && j > 2)) { // pressed on the wall (the scheming front arms lift off it): pushed back onto its plane, then along it
      const lim = W.d - ARM_W0 * s * (1 - u) * 0.5 - 0.03 * s, dot = x * W.nx + y * W.ny;
      if (dot > lim) {
        x -= W.nx * (dot - lim) * A.grip; y -= W.ny * (dot - lim) * A.grip;
        const tx = -W.ny, ty = W.nx, sg = Math.cos(th) * tx + Math.sin(th) * ty >= 0 ? 1 : -1;
        th += wrapA(Math.atan2(sg * ty, sg * tx) - th) * 0.85 * A.grip;
      }
    }
    P[j].x = x; P[j].y = y;
  }
  return P;
}
// an arm wrapped round the egg
const wrapPts = Array.from({ length: NS }, () => ({ x: 0, y: 0 }));
function wrapArm(P, E, k0, sweep) {
  const b = P[0], ca = Math.cos(E.a), sa = Math.sin(E.a);
  const on = (q) => ({ x: E.x + Math.cos(q) * E.rx * 1.08 * ca - Math.sin(q) * E.ry * 1.12 * sa, y: E.y + Math.cos(q) * E.rx * 1.08 * sa + Math.sin(q) * E.ry * 1.12 * ca });
  const c0 = on(k0), m = 3;
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
function fillArm(ctx, P, w0, w1, fill, grow = 0) { // the arm silhouette in one colour (ice shells, overlays)
  ctx.strokeStyle = fill; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let j = 0; j < NS - 1; j++) { ctx.lineWidth = lerp(w0, w1, (j + 0.5) / (NS - 1)) + grow; ctx.beginPath(); ctx.moveTo(P[j].x, P[j].y); ctx.lineTo(P[j + 1].x, P[j + 1].y); ctx.stroke(); }
}
// the lighter underside: a pale strip along the concave side of the arm, with a row of suckers on it
function armUnder(ctx, P, w0, side, col, line, big) {
  ctx.lineCap = 'round';
  for (let j = 1; j < NS - 1; j++) {
    const dx = P[j + 1].x - P[j - 1].x, dy = P[j + 1].y - P[j - 1].y, l = Math.hypot(dx, dy) || 1, w = lerp(w0, w0 * 0.2, j / (NS - 1));
    const nx = (-dy / l) * side, ny = (dx / l) * side, o = w * 0.22;
    ctx.strokeStyle = rgb(col, 0.95); ctx.lineWidth = Math.max(0.7, w * 0.46);
    ctx.beginPath(); ctx.moveTo(P[j].x + nx * o - (dx / l) * w * 0.3, P[j].y + ny * o - (dy / l) * w * 0.3); ctx.lineTo(P[j].x + nx * o + (dx / l) * w * 0.3, P[j].y + ny * o + (dy / l) * w * 0.3); ctx.stroke();
    if (big && j % 2 === 1) { // sucker row: pale discs with a dark centre dot
      ctx.fillStyle = rgb(line, 0.9);
      ctx.beginPath(); ctx.arc(P[j].x + nx * o, P[j].y + ny * o, Math.max(0.45, w * 0.1), 0, TAU); ctx.fill();
    }
  }
}

function mantlePath(ctx, s, sx, sy) {
  const X = (v) => v * s * sx, Y = (v) => v * s * sy;
  ctx.beginPath();
  ctx.moveTo(X(-0.36), Y(0.24));
  ctx.bezierCurveTo(X(-0.56), Y(0.1), X(-0.58), Y(-0.4), X(-0.32), Y(-0.64));
  ctx.bezierCurveTo(X(-0.18), Y(-0.84), X(0.2), Y(-0.86), X(0.34), Y(-0.62)); // a heavy hood, a little crest at the back
  ctx.bezierCurveTo(X(0.58), Y(-0.4), X(0.56), Y(0.1), X(0.36), Y(0.24));
  ctx.quadraticCurveTo(0, Y(0.36), X(-0.36), Y(0.24));
  ctx.closePath();
}

// ---------------------------------------------------------------- the octopus
export function drawOctopus(ctx, x, y, s, t, o = {}) {
  const A = o.A || POSES.idle, part = o.part || 'all', rot = o.rot ?? -Math.PI / 2, seed = o.seed || 0;
  const pal = o.pal || octoLook(null), lw = Math.max(1.1, s * 0.065);
  const pk = clamp(o.pulse || 0, 0, 1), tint = o.hit && TINT[o.hit], hk = tint ? clamp(o.hitK || 0, 0, 1) : 0;
  const fz = o.fz && o.fz.k > 0.01 ? o.fz : null, fk = fz ? fz.k : 0;
  const tone = (c, w) => {
    let r = mix(c, w, pk);
    if (hk) r = mix(r, tint, hk * 0.5);
    if (fk) r = mix(r, C.ice, 0.55 * fk); // frozen: its own colours blended toward icy
    return r;
  };
  const body = tone(pal.body, C.warn), hi = tone(pal.hi, C.warnHi), lo = tone(pal.lo, C.warnLo), arm = tone(pal.arm, C.warn), armLo = tone(pal.armLo, C.warnLo);
  const under = tone(pal.under, C.warnHi), brow = tone(pal.brow, C.warnLo), spot = mix(C.spot, C.spotWarn, pk), line = fk ? mix(C.line, hex('#16324a'), 0.5 * fk) : C.line;
  const sub = clamp(o.sub || 0, 0, 1), stn = clamp(o.stn || 0, 0, 1);
  ctx.save();
  ctx.translate(x, y);
  let shiver = 0;
  if (fz && fz.left < 1) shiver = (1 - fz.left) * 0.9 + 0.1; // the last second: it shivers
  if (shiver) ctx.translate(Math.sin(t * 61) * 0.7 * shiver, Math.cos(t * 53) * 0.5 * shiver);
  ctx.rotate(rot + Math.PI / 2 + (o.shake ? Math.sin(t * 38) * 0.16 * o.shake : 0) + (stn ? Math.sin(t * 1.3 + seed) * 0.16 * stn : 0)); // local -y = mantle top
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  const sc = o.scale || 1;
  if (sc !== 1) ctx.scale(sc, sc);
  // sunk in its den: clip to this side of the wall, then slide it down into the puddle
  const W = o.wall || null;
  if (sub > 0.01) {
    const wd = W ? W.d : 0.6 * s;
    ctx.beginPath(); ctx.rect(-4 * s, -4 * s, 8 * s, 4 * s + wd - 0.02 * s); ctx.clip();
    ctx.translate(0, sub * (wd + 0.0 * s)); // eyes just above the surface
    ctx.scale(1 - 0.18 * sub, 1 - 0.18 * sub);
  }
  const toL = (p) => { const dx = p.x - x, dy = p.y - y, c = Math.cos(-(rot + Math.PI / 2)), sn = Math.sin(-(rot + Math.PI / 2)); return { x: (dx * c - dy * sn) / sc, y: (dx * sn + dy * c) / sc }; };
  const look = o.look ? toL(o.look) : null;
  let E = null;
  if (o.egg && o.wrap > 0) { const q = toL(o.egg); E = { x: q.x, y: q.y, rx: o.egg.rx / sc, ry: o.egg.ry / sc, a: 0 }; }
  const frz = !!fz; // frozen: a held pose (no motion at all)
  const tt = frz ? fz.t0 : t;
  const order = [1, 7, 3, 5, 0, 6, 2, 4];
  const wrapIx = E ? [2, 4, 6] : [];
  const geom = []; // the arm points (shared pool) after the wrap
  const buildArm = (i) => {
    const P = freeArm(i, s, tt, A, look, seed, W), wi = wrapIx.indexOf(i);
    if (wi >= 0) {
      const k0 = [Math.PI + 0.3, Math.PI / 2 + 0.9, -0.3][wi], sweep = [-1.5, -1.3, 1.5][wi];
      const Wr = wrapArm(P, E, k0, sweep), w = sstep(o.wrap) * (0.92 + 0.08 * Math.sin(tt * 3 + i));
      for (let j = 0; j < NS; j++) { P[j].x = lerp(P[j].x, Wr[j].x, w); P[j].y = lerp(P[j].y, Wr[j].y, w); }
    }
    geom[i] = wi;
  };
  for (let i = 0; i < NA; i++) buildArm(i);
  const widths = (i) => { const back = i % 2 && geom[i] < 0; return [s * ARM_W0 * (back ? 0.82 : geom[i] >= 0 ? 0.46 : 1), s * ARM_W1]; };
  const drawArmI = (i) => {
    const back = i % 2 && geom[i] < 0, [w0, w1] = widths(i), P = armPts[i];
    if (pal.rimA > 0.05) strokeArm(ctx, P, w0 + lw * 0.6, w1 + lw * 0.6, rgb(pal.rim, pal.rimA), rgb(pal.rim, pal.rimA), lw * 1.1); // rim light for dark worlds
    strokeArm(ctx, P, w0, w1, rgb(back ? armLo : arm), rgb(line), lw * 0.8);
    if (s > 8) armUnder(ctx, P, w0, armSide[i], under, mix(line, under, 0.15), s > 12);
  };
  const front = part !== 'back', backP = part !== 'front';
  // frozen: the shell first (it follows the silhouette: rims, then the ice, then the creature on top)
  const br = frz ? 1 : 1 + 0.04 * Math.sin(t * 2.1 + seed) + A.swim * 0.06 * Math.sin(t * 3.2 + seed + 1.2);
  const sx = (1 + 0.22 * A.squash) * br * (1 - 0.2 * A.stream) * (1 + 0.04 * pk), sy = (1 - 0.18 * A.squash) / br * (1 + 0.22 * A.stream) * (1 + 0.04 * pk);
  if (backP && frz) iceShell(ctx, s, sx, sy, geom, widths, fz, 0);
  if (backP) {
    // stars of a stun that pass behind the head
    if (stn) dizzyStars(ctx, s, t, stn, seed, -1);
    for (const i of order) if (wrapIx.indexOf(i) < 0) drawArmI(i);
  }
  if (front && wrapIx.length) for (const i of wrapIx) drawArmI(i);
  if (part === 'front' && wrapIx.length) drawOctoFace(ctx, s, sx, sy, t, tt, o, look, lw, A, pal, brow, pk, frz, stn);
  if (backP) {
    if (pk > 0.02) { // the flush glows round the mantle
      ctx.save();
      ctx.globalAlpha *= 0.55 * pk * (0.6 + 0.4 * Math.sin(t * 20));
      ctx.fillStyle = rgb(C.warn);
      ctx.beginPath(); ctx.ellipse(0, -0.22 * s * sy, 0.72 * s * sx, 0.78 * s * sy, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    if (pal.rimA > 0.05) { mantlePath(ctx, s * 1.03, sx, sy); ctx.strokeStyle = rgb(pal.rim, pal.rimA); ctx.lineWidth = lw * 2.2; ctx.lineJoin = 'round'; ctx.stroke(); }
    mantlePath(ctx, s, sx, sy);
    ctx.fillStyle = rgb(body); ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = rgb(lo); // cel shadow: the lower right
    ctx.beginPath(); ctx.ellipse(0.36 * s * sx, 0.06 * s * sy, 0.42 * s * sx, 0.66 * s * sy, -0.3, 0, TAU); ctx.fill();
    ctx.fillStyle = rgb(body);
    ctx.beginPath(); ctx.ellipse(-0.04 * s * sx, -0.34 * s * sy, 0.46 * s * sx, 0.54 * s * sy, -0.4, 0, TAU); ctx.fill();
    ctx.fillStyle = rgb(hi); // highlight top left
    ctx.beginPath(); ctx.ellipse(-0.2 * s * sx, -0.58 * s * sy, 0.12 * s * sx, 0.17 * s * sy, -0.5, 0, TAU); ctx.fill();
    ctx.fillStyle = rgb(spot, pk > 0.3 ? 0.95 : 0.7); // chromatophore spots (they light up in the flush)
    for (const [px, py, r] of [[0.2, -0.5, 0.065], [0.33, -0.22, 0.05], [-0.02, -0.7, 0.05], [0.1, -0.28, 0.04], [-0.3, -0.36, 0.035]]) { ctx.beginPath(); ctx.arc(px * s * sx, py * s * sy, r * s * (1 + 0.5 * pk), 0, TAU); ctx.fill(); }
    ctx.fillStyle = rgb(under, 0.92); // the lighter underside: chin and belly
    ctx.beginPath(); ctx.ellipse(0, 0.34 * s * sy, 0.52 * s * sx, 0.2 * s * sy, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = rgb(mix(under, body, 0.45), 0.9);
    ctx.beginPath(); ctx.ellipse(0, 0.2 * s * sy, 0.5 * s * sx, 0.09 * s * sy, 0, 0, TAU); ctx.fill();
    ctx.restore();
    mantlePath(ctx, s, sx, sy);
    ctx.strokeStyle = rgb(line); ctx.lineWidth = lw * 1.1; ctx.lineJoin = 'round'; ctx.stroke();
    if (part === 'all') drawOctoFace(ctx, s, sx, sy, t, tt, o, look, lw, A, pal, brow, pk, frz, stn); // (split: the face is drawn over the egg)
    if (hk > 0.05 && o.hit !== 'zap') drawHitFX(ctx, s, t, o.hit, hk, lw);
    if (stn) dizzyStars(ctx, s, t, stn, seed, 1);
  }
  if (backP && frz) iceOver(ctx, s, sx, sy, geom, widths, fz, tt, lw);
  if (backP && o.zap > 0.02) zapArcs(ctx, s, t, o.zap, geom, widths, sx, sy);
  ctx.restore();
}

function drawOctoFace(ctx, s, sx, sy, t, tt, o, look, lw, A, pal, brow, pk, frz, stn) {
  const hit = o.hitK > 0.05 ? o.hit : null;
  const ey = -0.14 * s * sy, ex = 0.22 * s * sx, rx = 0.175 * s, ry = 0.125 * s;
  const menace = clamp(A.menace, -0.2, 1), smug = clamp(A.smug, 0, 1);
  const slack = stn > 0.01, X = hit === 'zap' || hit === 'flash';
  const heavy = frz ? 0.55 : smug * 0.55 + (hit === 'tired' ? 0.5 : 0); // half-lidded: smug, tired, or frozen mid-blink
  const blink = !frz && !slack && ((tt + (o.seed || 0)) % 4.1 < 0.11) ? 1 : 0;
  const glow = mix(C.eye, C.eyeWarn, clamp(pk + (A.reach > 0.5 ? 0.25 : 0), 0, 1));
  for (const sd of [-1, 1]) {
    const cx = sd * ex;
    // glow halo
    if (!frz && !slack) { const g = ctx.createRadialGradient(cx, ey, 0, cx, ey, rx * 2.4); g.addColorStop(0, rgb(glow, 0.42)); g.addColorStop(1, rgb(glow, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, ey, rx * 2.4, 0, TAU); ctx.fill(); }
    ctx.save();
    ctx.beginPath(); ctx.ellipse(cx, ey, rx, ry, 0, 0, TAU); ctx.clip();
    ctx.fillStyle = rgb(frz ? mix(glow, C.ice, 0.5) : glow); ctx.fillRect(cx - rx, ey - ry, 2 * rx, 2 * ry);
    ctx.fillStyle = rgb(mix(glow, C.eyeHi, 0.7), frz ? 0.5 : 0.9); ctx.beginPath(); ctx.ellipse(cx - rx * 0.1, ey - ry * 0.3, rx * 0.7, ry * 0.5, 0, 0, TAU); ctx.fill();
    if (slack) { // a spiral eye
      ctx.fillStyle = rgb(C.eyeHi, 0.9); ctx.fillRect(cx - rx, ey - ry, 2 * rx, 2 * ry);
      ctx.strokeStyle = rgb(C.pupil); ctx.lineWidth = Math.max(0.9, ry * 0.3); ctx.lineCap = 'round'; ctx.beginPath();
      const ph = t * 5 * (sd > 0 ? 1 : -1);
      for (let a = 0; a < 3.3 * TAU; a += 0.35) { const r = (a / (3.3 * TAU)) * ry * 1.05; const px = cx + Math.cos(a + ph) * r * (rx / ry) * 0.95, py = ey + Math.sin(a + ph) * r; a ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke();
    } else if (X) { // dazzled: X eyes
      ctx.fillStyle = rgb(C.eyeHi, 0.9); ctx.fillRect(cx - rx, ey - ry, 2 * rx, 2 * ry);
      ctx.strokeStyle = rgb(C.pupil); ctx.lineWidth = Math.max(1, ry * 0.36); ctx.lineCap = 'round';
      const d = ry * 0.62; ctx.beginPath(); ctx.moveTo(cx - d, ey - d); ctx.lineTo(cx + d, ey + d); ctx.moveTo(cx + d, ey - d); ctx.lineTo(cx - d, ey + d); ctx.stroke();
    } else { // the slit pupil, eyes locked on the target
      let lx = 0, ly = 0.12;
      if (look) { const dx = look.x - cx, dy = look.y - ey, l = Math.hypot(dx, dy) || 1; lx = dx / l; ly = dy / l; }
      const dil = A.reach > 0.5 ? 1.35 : 1;
      ctx.fillStyle = rgb(C.pupil);
      ctx.beginPath(); ctx.ellipse(cx + lx * rx * 0.34, ey + ly * ry * 0.34, Math.max(0.7, rx * 0.17 * dil), ry * 1.05, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(cx + lx * rx * 0.34 - rx * 0.28, ey + ly * ry * 0.34 - ry * 0.42, Math.max(0.5, ry * 0.2), 0, TAU); ctx.fill();
    }
    // the lid: a slanted cut, low on the inside (narrowed, mean); a smug octopus is half-lidded
    const yo = ey - ry * (1.2 - 0.25 * slack) + ry * 2 * heavy * 0.7, yi = yo + ry * (slack ? -0.55 : 0.2 + 1.35 * menace) * (1 - heavy * 0.2) + (blink ? ry * 2 : 0);
    const xo = cx + sd * rx * 1.4, xi = cx - sd * rx * 1.4;
    ctx.fillStyle = rgb(brow);
    ctx.beginPath(); ctx.moveTo(xo, yo); ctx.lineTo(xi, yi); ctx.lineTo(xi, ey - ry * 2.2); ctx.lineTo(xo, ey - ry * 2.2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = rgb(C.line); ctx.lineWidth = Math.max(0.9, lw * 0.9); ctx.beginPath(); ctx.moveTo(xo, yo); ctx.lineTo(xi, yi); ctx.stroke();
    ctx.restore();
    ctx.beginPath(); ctx.ellipse(cx, ey, rx, ry, 0, 0, TAU);
    ctx.strokeStyle = rgb(C.line); ctx.lineWidth = lw * 0.9; ctx.stroke();
  }
  // the brow ridge: one heavy V of dark maroon over both eyes (one side raised when it is smug, drooping when stunned)
  const up = smug * 0.1 * s;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const bro = (w, col) => {
    ctx.strokeStyle = col; ctx.lineWidth = w;
    for (const sd of [-1, 1]) {
      const raise = sd > 0 ? up : 0, drop = slack ? 0.1 * s : 0; // smug: one brow arched; stunned: both droop outward
      ctx.beginPath();
      ctx.moveTo(sd * (ex + rx * 1.5), ey - ry * (1.2 + 1.5 * menace) - raise + drop * 1.6);
      ctx.lineTo(sd * (ex - rx * 1.25), ey - ry * (1.35 - 1.25 * menace) - raise * 0.3 - drop * 0.6);
      ctx.lineTo(sd * 0.02 * s, ey - ry * (1.25 - 1.15 * menace) - drop * 0.4);
      ctx.stroke();
    }
  };
  bro(0.085 * s + lw * 1.6, rgb(C.line)); bro(0.085 * s, rgb(brow));
  // the grin: lopsided, with fangs; open and snarling when it grabs
  const my = 0.24 * s * sy, mo = clamp(A.mouth, 0, 1), g = 0.1 + 0.1 * smug;
  const mw = 0.27 * s * sx * (1 + 0.2 * smug);
  ctx.beginPath();
  ctx.moveTo(-mw, my - 0.01 * s);
  ctx.quadraticCurveTo(-mw * 0.1, my + (g + 0.16 * mo) * s, mw * 0.95, my - (0.06 + 0.05 * smug - 0.02 * mo) * s);
  ctx.quadraticCurveTo(mw * 0.1, my + (0.02 + 0.06 * mo) * s, -mw, my - 0.01 * s);
  ctx.fillStyle = rgb(C.mouth); ctx.fill();
  ctx.strokeStyle = rgb(C.line); ctx.lineWidth = lw * 0.85; ctx.stroke();
  if (s > 12) { // fangs along the top lip
    ctx.fillStyle = rgb(C.fang);
    for (const fx of [-0.45, -0.05, 0.38]) {
      const px = fx * mw * 1.4, py = my + 0.005 * s + (px / mw) * -0.025 * s;
      ctx.beginPath(); ctx.moveTo(px - 0.03 * s, py); ctx.lineTo(px + 0.03 * s, py); ctx.lineTo(px, py + (0.05 + 0.04 * mo) * s); ctx.closePath(); ctx.fill();
    }
  }
}

function dizzyStars(ctx, s, t, k, seed, side) { // side -1: behind the head, +1: in front. Three stars on a tilted ellipse above the head
  ctx.save();
  ctx.globalAlpha *= clamp(k, 0, 1);
  const cx = 0, cy = -0.92 * s, rx = 0.6 * s, ry = 0.15 * s, tilt = -0.2;
  for (let i = 0; i < 3; i++) {
    const a = t * 3.4 + (i / 3) * TAU + seed, ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
    if ((Math.sin(a) > 0 ? 1 : -1) !== -side) continue; // far half passes behind the head
    const px = cx + ex * Math.cos(tilt) - ey * Math.sin(tilt), py = cy + ex * Math.sin(tilt) + ey * Math.cos(tilt), r = 0.14 * s;
    ctx.beginPath();
    for (let j = 0; j < 10; j++) { const q = (j / 10) * TAU - Math.PI / 2, rr = j % 2 ? r * 0.45 : r; ctx.lineTo(px + Math.cos(q) * rr, py + Math.sin(q) * rr); }
    ctx.closePath();
    ctx.fillStyle = '#ffe14a'; ctx.fill(); ctx.strokeStyle = rgb(C.line); ctx.lineWidth = Math.max(0.8, s * 0.04); ctx.lineJoin = 'round'; ctx.stroke();
  }
  ctx.restore();
}

// crisp jagged yellow-white arcs along the body, with a bright flash
function zapArcs(ctx, s, t, k, geom, widths, sx, sy) {
  const n = Math.floor(t * 18);
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.globalAlpha *= clamp(k * 1.4, 0, 1);
  ctx.fillStyle = 'rgba(255,252,220,0.55)';
  mantlePath(ctx, s, sx, sy); ctx.globalAlpha *= clamp(k, 0, 1); ctx.fill();
  ctx.globalAlpha = clamp(k * 1.4, 0, 1);
  const bolt = (pts, w) => {
    for (const pass of [0, 1]) {
      ctx.beginPath();
      pts.forEach((p, j) => { const j1 = j % 2 ? 1 : -1, nx = j && j < pts.length - 1 ? j1 * s * 0.06 * (0.5 + hash(j + n * 3.1)) : 0; j ? ctx.lineTo(p.x + nx, p.y - nx * 0.6) : ctx.moveTo(p.x, p.y); });
      ctx.strokeStyle = pass ? '#ffffff' : '#ffd21a'; ctx.lineWidth = pass ? w * 0.4 : w; ctx.stroke();
    }
  };
  for (let i = 0; i < NA; i += 2) bolt(armPts[i].filter((_, j) => j % 2 === 0), Math.max(1.4, s * 0.07));
  for (let i = 0; i < 3; i++) {
    const a0 = hash(n + i * 7.7) * TAU, a1 = a0 + 0.9 + hash(n + i) * 0.8;
    bolt([0, 1, 2, 3, 4].map((j) => { const a = lerp(a0, a1, j / 4), r = (0.5 + 0.16 * hash(j + n + i)) * s; return { x: Math.cos(a) * r * sx, y: -0.2 * s + Math.sin(a) * r * 1.05 * sy }; }), Math.max(1.4, s * 0.07));
  }
  ctx.restore();
}

// ---------------------------------------------------------------- frozen
function crystal(ctx, x, y, ang, L, w) { // a crisp angular frost crystal
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  ctx.beginPath(); ctx.moveTo(0, -w); ctx.lineTo(L, 0); ctx.lineTo(0, w); ctx.lineTo(-L * 0.25, 0); ctx.closePath();
  ctx.fillStyle = rgb(C.iceFill); ctx.fill(); ctx.strokeStyle = rgb(C.iceRim); ctx.lineWidth = Math.max(0.8, w * 0.7); ctx.lineJoin = 'round'; ctx.stroke();
  ctx.restore();
}
// the ice shell: rims, then the ice, behind the creature (a thick stroke along the very same silhouette)
function iceShell(ctx, s, sx, sy, geom, widths, fz, _p) {
  const off = Math.max(2, s * 0.1) * sstep(fz.k * 1.5), rim = Math.max(1.1, s * 0.05);
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // pass 1: the dark blue rims, pass 2: the ice (so the rims of overlapping parts never cut across the inside)
  for (let pass = 0; pass < 2; pass++) {
    const col = pass ? rgb(C.iceFill) : rgb(C.iceRim), g = off + (pass ? 0 : rim);
    for (let i = 0; i < NA; i++) { const [w0, w1] = widths(i); fillArm(ctx, armPts[i], w0, w1, col, 2 * g); }
    mantlePath(ctx, s, sx, sy);
    ctx.strokeStyle = col; ctx.lineWidth = 2 * g; ctx.stroke();
    ctx.fillStyle = col; ctx.fill();
  }
  ctx.restore();
}
// over the creature: a translucent sheen, white facet glints, frost crystals on the outline, cracks near the thaw
function iceOver(ctx, s, sx, sy, geom, widths, fz, t, lw) {
  const k = fz.k, off = Math.max(2, s * 0.1);
  ctx.save();
  ctx.globalAlpha *= k;
  // sheen over the whole silhouette
  const sheen = 'rgba(205,240,255,0.17)';
  for (let i = 0; i < NA; i++) { const [w0, w1] = widths(i); fillArm(ctx, armPts[i], w0, w1, sheen, off); }
  mantlePath(ctx, s * 1.08, sx, sy); ctx.fillStyle = sheen; ctx.fill();
  // facet glints on the mantle
  ctx.save();
  mantlePath(ctx, s * 1.08, sx, sy); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath(); ctx.moveTo(-0.5 * s, -0.62 * s); ctx.lineTo(-0.28 * s, -0.78 * s); ctx.lineTo(-0.08 * s, -0.62 * s); ctx.lineTo(-0.3 * s, -0.46 * s); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.moveTo(0.3 * s, 0.05 * s); ctx.lineTo(0.55 * s, -0.12 * s); ctx.lineTo(0.55 * s, 0.1 * s); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(1, s * 0.035); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0.14 * s, -0.7 * s); ctx.lineTo(0.38 * s, -0.46 * s); ctx.moveTo(-0.5 * s, 0.0); ctx.lineTo(-0.36 * s, 0.18 * s); ctx.stroke();
  ctx.restore();
  // glints on two arms
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = Math.max(0.9, s * 0.03); ctx.lineCap = 'round';
  for (const i of [0, 7]) { const P = armPts[i]; ctx.beginPath(); ctx.moveTo(P[3].x, P[3].y); ctx.lineTo(P[4].x, P[4].y); ctx.stroke(); }
  // frost crystals on the outline: mantle crest, flanks, arm tips
  const cr = Math.max(2.4, s * 0.15);
  crystal(ctx, 0.04 * s * sx, -0.9 * s * sy - off * 0.6, -Math.PI / 2, cr * 1.1, cr * 0.34);
  crystal(ctx, -0.6 * s * sx - off * 0.4, -0.35 * s * sy, Math.PI + 0.3, cr, cr * 0.3);
  crystal(ctx, 0.6 * s * sx + off * 0.4, -0.3 * s * sy, -0.3, cr * 0.9, cr * 0.3);
  for (const i of [0, 3, 6]) { const P = armPts[i], a = P[NS - 1], b = P[NS - 2]; crystal(ctx, a.x, a.y, Math.atan2(a.y - b.y, a.x - b.x) + (i % 2 ? 0.4 : -0.3), cr * 0.9, cr * 0.28); }
  // the last second: hairline cracks spread over the shell
  if (fz.left < 1) {
    const c = clamp(1 - fz.left, 0, 1);
    ctx.lineWidth = Math.max(0.8, lw * 0.6); ctx.lineJoin = 'round';
    const cracks = [[[-0.1, -0.84], [0.02, -0.56], [-0.12, -0.34], [0.04, -0.14]], [[0.5, -0.5], [0.3, -0.38], [0.34, -0.14], [0.2, 0.0]], [[-0.5, -0.4], [-0.3, -0.3], [-0.38, -0.08]], [[-0.1, 0.35], [0.1, 0.5], [0.0, 0.7]]];
    cracks.forEach((pts, ci) => {
      const n = Math.ceil(pts.length * clamp(c * 1.6 - ci * 0.18, 0, 1));
      if (n < 2) return;
      for (const pass of [0, 1]) {
        ctx.strokeStyle = pass ? 'rgba(255,255,255,0.95)' : rgb(C.iceRim); ctx.lineWidth = Math.max(0.7, lw * (pass ? 0.3 : 0.6));
        ctx.beginPath(); pts.slice(0, n).forEach((p, j) => (j ? ctx.lineTo(p[0] * s, p[1] * s) : ctx.moveTo(p[0] * s, p[1] * s))); ctx.stroke();
      }
    });
  }
  ctx.restore();
}

// angular ice shards that pop off at the thaw and fall (px, y down; the owner holds the list): {x, y, vx, vy, a, va, r, age}
export function iceShards(x, y, s, seed = 0) {
  return Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * TAU + hash(i + seed) * 0.8, sp = (0.9 + hash(i * 3 + seed)) * s * 2.2;
    return { x: x + Math.cos(a) * s * 0.4, y: y + Math.sin(a) * s * 0.5 - s * 0.3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - s * 2, a: hash(i) * TAU, va: (hash(i + 9) - 0.5) * 14, r: s * (0.12 + 0.14 * hash(i + 4)), age: 0 };
  });
}
export function stepShards(list, dt, g) { for (const p of list) { p.age += dt; p.vy += g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - 1.5 * dt; p.a += p.va * dt; } return list.filter((p) => p.age < 0.9); }
export function drawShards(ctx, list, k) {
  for (const p of list) {
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.a);
    ctx.globalAlpha = clamp(1.5 - p.age / 0.6, 0, 1);
    ctx.beginPath(); ctx.moveTo(p.r, 0); ctx.lineTo(-p.r * 0.5, p.r * 0.55); ctx.lineTo(-p.r * 0.3, -p.r * 0.6); ctx.closePath();
    ctx.fillStyle = rgb(C.iceFill); ctx.fill(); ctx.strokeStyle = rgb(C.iceRim); ctx.lineWidth = Math.max(0.9, 1.1); ctx.lineJoin = 'round'; ctx.stroke();
    ctx.restore();
  }
  void k;
}

function drawHitFX(ctx, s, t, kind, k, lw) {
  ctx.save();
  ctx.globalAlpha *= k;
  if (kind === 'water') {
    ctx.fillStyle = '#bfe9ff'; ctx.strokeStyle = 'rgba(20,60,110,0.8)'; ctx.lineWidth = Math.max(0.6, lw * 0.5);
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.55, r = (0.85 + 0.35 * (1 - k)) * s; ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r - 0.2 * s, 0.07 * s, 0, TAU); ctx.fill(); ctx.stroke(); }
  } else if (kind !== 'tired') {
    ctx.fillStyle = '#fff6c2';
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + (i / 3) * TAU, cx = Math.cos(a) * 0.55 * s, cy = -0.95 * s + Math.sin(a) * 0.14 * s, r = 0.1 * s;
      ctx.beginPath();
      for (let j = 0; j < 10; j++) { const q = (j / 10) * TAU - Math.PI / 2, rr = j % 2 ? r * 0.45 : r; ctx.lineTo(cx + Math.cos(q) * rr, cy + Math.sin(q) * rr); }
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the squirt: a cloud that blacks out a ring sector
export function drawInkCloud(ctx, x, y, R, age, dur, seed = 0, from = null) {
  if (age >= dur + 0.2) return;
  const grow = 1 - Math.exp(-age * 7), fade = clamp((dur - age) / 0.6, 0, 1);
  ctx.save();
  if (from && age < 0.35) { // the jet from the octopus to the egg
    const u = age / 0.35;
    for (let i = 0; i < 6; i++) {
      const q = clamp(u * 1.3 - i * 0.12, 0, 1);
      ctx.fillStyle = `rgba(28,14,44,${0.9 * (1 - u * 0.6)})`; ctx.beginPath(); ctx.arc(lerp(from.x, x, q), lerp(from.y, y, q), R * (0.1 + 0.07 * i) * (1 - 0.4 * u), 0, TAU); ctx.fill();
    }
  }
  const puffs = [];
  for (let i = 0; i < 14; i++) {
    const a = i * 2.39996 + seed, d = (i < 4 ? 0.08 : 0.35 + 0.55 * ((i * 0.37 + seed * 0.1) % 1)) * R * grow, r = R * (i < 4 ? 0.55 : 0.28 + 0.2 * ((i * 0.61) % 1)) * (0.5 + 0.5 * grow);
    puffs.push([x + Math.cos(a) * d + Math.sin(age * 2 + i) * R * 0.02, y + Math.sin(a) * d * 0.8 + Math.cos(age * 1.7 + i) * R * 0.02, r]);
  }
  ctx.globalAlpha = fade;
  for (const [px, py, r] of puffs) { ctx.fillStyle = 'rgba(112,82,170,0.85)'; ctx.beginPath(); ctx.arc(px, py, r + Math.max(1, R * 0.03), 0, TAU); ctx.fill(); }
  for (const [px, py, r] of puffs) { ctx.fillStyle = 'rgba(18,9,32,0.96)'; ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// ---------------------------------------------------------------- the den: a puddle on the ring floor
// (x, y) the point on the wall surface; rot: the octopus's rot there (local -y points into the vault). w: width px.
export function drawDen(ctx, x, y, w, rot, t, pal, o = {}) {
  const v = pal ? pal.v : 'water', dark = v === 'dark' || v === 'warm';
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot + Math.PI / 2);
  const h = w * 0.24, rimW = Math.max(1.2, w * 0.035);
  // the puddle: a pool sunk into the floor (an ellipse straddling the wall surface), dark water, pale rim, a glint
  const cy = -h * 0.2, ry = h * 0.72;
  const g = ctx.createLinearGradient(0, cy - ry, 0, cy + ry);
  g.addColorStop(0, dark ? '#3aa0c8' : '#1d6fa0'); g.addColorStop(1, dark ? '#16506f' : '#0b2c4a');
  ctx.beginPath(); ctx.ellipse(0, cy, w / 2, ry, 0, 0, TAU);
  ctx.strokeStyle = 'rgba(8,24,46,0.9)'; ctx.lineWidth = rimW * 2.6; ctx.stroke();
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = dark ? 'rgba(210,245,255,0.95)' : 'rgba(255,255,255,0.9)'; ctx.lineWidth = rimW; ctx.stroke();
  // ripples and a glint
  ctx.lineWidth = Math.max(0.8, rimW * 0.6);
  for (let i = 0; i < 2; i++) {
    const u = (t * 0.5 + i * 0.5 + (o.seed || 0)) % 1;
    ctx.strokeStyle = `rgba(220,248,255,${0.7 * (1 - u)})`;
    ctx.beginPath(); ctx.ellipse(0, cy, w * (0.1 + 0.34 * u), ry * (0.2 + 0.6 * u), 0, 0, TAU); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1, rimW * 0.9);
  ctx.beginPath(); ctx.moveTo(-w * 0.3, cy - ry * 0.55); ctx.lineTo(-w * 0.16, cy - ry * 0.7); ctx.stroke();
  ctx.restore();
}
