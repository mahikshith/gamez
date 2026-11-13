// Farm allies, code-drawn: the Rooster and the Goose, mama hen's friends (cel-shaded, dark outline, same brown line and
// the hen's orange beak, so they read as one farm). Everything is side-on and faces +x; callers mirror with ctx.scale.
// Art functions draw in a local y-DOWN space centred on (cx, cy) in a 100-unit box scaled by s / 100, feet at cy + 0.48 s
// when standing. drawRooster / drawGoose take a pose from roosterPose / goosePose (anim + k 0..1 + a clock), so the game
// and the review strips share one code path. drawAllies() paints the live ally from sim.ally (render only; the state is
// in sim/allies.js and allyPlace() there says where it is).
import { ALLY, allyPlace, allyElapsed, flingAt } from '../sim/allies.js';
import { drawHenAnim } from './hen.js';
import { geckoAnchor } from './gecko15.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
const outlineW = (s, base = 2.8) => Math.max(base, 110 / s);

const LINE = '#6b4a2a'; // the hen's outline
const BEAK = { hi: '#ffc247', lo: '#e57d12', line: '#8a4a0a' };
const RED = { hi: '#f0402f', lo: '#b81f17', line: '#7a1810' };
const COCK = {
  gold: ['#fff0c2', '#f3c261', '#d58f35'], cream: '#fff6df', hackle: ['#ffc95a', '#e8782a'],
  wing: ['#d8622a', '#963211'], wingTip: '#2f9488', tail: ['#2f9488', '#d8622a', '#4fbfae'], tailLo: '#1a5e5b',
};
const GOOSE = { body: ['#ffffff', '#eef2f5', '#bccad6'], wing: ['#ffffff', '#d7e0e8'], tip: '#8fa3b5', brow: '#4a3220' };

// Fill several shapes as one silhouette: every outline first, then every fill (no seam where they overlap).
function union(ctx, o, items) {
  ctx.lineJoin = 'round';
  ctx.lineWidth = o * 2;
  ctx.strokeStyle = LINE;
  ctx.fillStyle = LINE;
  for (const it of items) { ctx.beginPath(); it.p(ctx); ctx.stroke(); ctx.fill(); }
  ctx.translate(o * 0.25, o * 0.6); // line weight: heavier underneath, away from the light
  for (const it of items) { ctx.beginPath(); it.p(ctx); ctx.stroke(); }
  ctx.translate(-o * 0.25, -o * 0.6);
  for (const it of items) { ctx.beginPath(); it.p(ctx); ctx.fillStyle = it.f; ctx.fill(); }
}
function solid(ctx, o, p, fill, line = LINE, w = 1) {
  ctx.beginPath(); p(ctx); ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = o * w; ctx.strokeStyle = line; ctx.stroke();
}
const grad = (ctx, x0, y0, x1, y1, stops) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c)); return g; };
const rgrad = (ctx, x, y, r0, r1, stops) => { const g = ctx.createRadialGradient(x, y, r0, x, y, r1); stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c)); return g; };
const glint = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };

// A wing: pivots at the shoulder, points along `ang` (0 = forward, 2.35 = folded back-down, -2.5 = swept up and back);
// `sp` 0..1 grows it into a spread wing with separate feather tips. cols = [light, dark], tip = the feather-tip colour.
function wing(ctx, o, x, y, ang, sp, cols, tip, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.scale(1, -1); // the feathered trailing edge faces back and down when the wing is raised
  const L = (36 + 34 * sp) * scale, W = (11 + 13 * sp) * scale, n = 3 + Math.round(sp * 2);
  const path = (c) => {
    c.moveTo(0, -W * 0.5);
    c.bezierCurveTo(L * 0.3, -W * 1.25, L * 0.75, -W * 0.95, L, W * 0.1);
    if (sp < 0.3) { c.bezierCurveTo(L * 0.8, W * 1.0, L * 0.35, W * 1.25, 0, W * 0.7); c.closePath(); return; } // folded: one smooth teardrop
    for (let i = 0; i < n; i++) { // scalloped trailing edge, tip by tip, back to the shoulder
      const a = i / n, b = (i + 1) / n, tx = L * (1 - b * 0.82), ty = W * (0.1 + b * 1.05);
      c.quadraticCurveTo(L * (1 - (a + b) * 0.41) + 2 * scale, W * (0.1 + (a + b) * 0.55) + 3.2 * scale, tx, ty);
    }
    c.quadraticCurveTo(-3 * scale, W * 0.9, 0, -W * 0.5);
  };
  solid(ctx, o, path, grad(ctx, 0, -W, 0, W * 1.4, cols));
  // feather tips and quills
  ctx.save();
  ctx.beginPath(); path(ctx); ctx.clip();
  if (tip) { const tg = ctx.createLinearGradient(L * 0.56, 0, L * 0.8, 0); tg.addColorStop(0, tip + '00'); tg.addColorStop(1, tip); ctx.fillStyle = tg; ctx.fillRect(L * 0.3, -W * 2, L, W * 4.4); }
  // form: the leading edge catches the light, the flight feathers under the coverts sit in soft shade
  { const sg = ctx.createLinearGradient(0, -W, 0, W * 1.3); sg.addColorStop(0, 'rgba(255,255,255,0.3)'); sg.addColorStop(0.35, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(50,30,40,0)'); sg.addColorStop(1, 'rgba(50,30,40,0.24)'); ctx.fillStyle = sg; ctx.fillRect(-8, -W * 2, L + 16, W * 4.4); }
  ctx.strokeStyle = LINE; ctx.lineWidth = o * 0.55; ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(L * 0.62, -W * 0.1);
  for (let i = 0; i < 4; i++) { const x0 = L * (0.62 - i * 0.155), x1 = L * (0.62 - (i + 1) * 0.155), yy = W * (-0.1 + i * 0.13); ctx.quadraticCurveTo((x0 + x1) / 2, yy + W * 0.42, x1, yy + W * 0.13); }
  if (sp < 0.3) for (let i = 1; i <= 2; i++) { ctx.moveTo(L * (0.86 - i * 0.2), W * (0.55 + i * 0.12)); ctx.lineTo(L * (0.5 - i * 0.1), W * (0.16 + i * 0.1)); } // folded: two primaries
  for (let i = 1; i < n; i++) { const b = i / n; ctx.moveTo(L * (1 - b * 0.82) + 2 * scale, W * (0.1 + b * 1.0)); ctx.lineTo(L * (0.35 + 0.1 * i / n), W * (0.0 + 0.1 * i)); }
  ctx.stroke();
  ctx.restore();
  ctx.lineWidth = o; ctx.strokeStyle = LINE;
  ctx.beginPath(); path(ctx); ctx.stroke();
  ctx.restore();
}

// The rooster's wing: the same pivot, angles and footprint as wing() above, but built from real feathers: six flight
// feathers that stack when folded and splay into separate rounded tips as `sp` opens, under three scalloped covert rows.
function featherWing(ctx, o, x, y, ang, sp, cols, tip, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.scale(1, -1);
  const L = (36 + 34 * sp) * scale, W = (11 + 13 * sp) * scale, n = 6, open = sstep((sp - 0.05) / 0.6);
  const dark = cols[1], fw = W * (0.5 - 0.04 * open) + 1.5 * scale, hem = 0.8 - 0.42 * open, cv = 1 - 0.3 * open;
  const F = [];
  for (let i = n - 1; i >= 0; i--) { // inner secondaries first, the long outer primaries end on top
    const b = i / (n - 1);
    const tx = lerp(L * (1 - b * 0.5), L * (1 - b * 0.8), open), ty = lerp(W * (0.12 + b * 0.78), W * (0.1 + b * 1.12), open);
    const bx = L * (0.5 - 0.44 * b), by = W * (-0.3 + 0.2 * b), a = Math.atan2(ty - by, tx - bx), len = Math.hypot(tx - bx, ty - by), c = Math.cos(a), sn = Math.sin(a);
    const Q = (u, v) => [bx + u * c - v * sn, by + u * sn + v * c];
    const path = (k) => { const m = Q(0, -fw * 0.3); k.moveTo(m[0], m[1]); k.bezierCurveTo(...Q(len * 0.4, -fw * 0.56), ...Q(len * 0.98, -fw * 0.6), ...Q(len, 0)); k.bezierCurveTo(...Q(len * 0.98, fw * 0.6), ...Q(len * 0.4, fw * 0.56), ...Q(0, fw * 0.3)); k.closePath(); };
    F.push({ path, Q, len, b });
  }
  const covert = (k) => { // the covert mass: smooth leading edge, scalloped hem
    k.moveTo(0, -W * 0.5);
    k.bezierCurveTo(L * 0.3, -W * 1.25 * cv, L * 0.72, -W * 0.98 * cv, L * 0.9, -W * 0.12);
    const m = 4;
    for (let j = 1; j <= m; j++) { const u0 = (j - 1) / m, u1 = j / m, um = (u0 + u1) / 2; k.quadraticCurveTo(L * 0.9 * (1 - um) + 1.5 * scale, W * (-0.12 + hem * um) + W * 0.3, L * 0.9 * (1 - u1), W * (-0.12 + hem * u1)); }
    k.quadraticCurveTo(-4 * scale, W * 0.2, 0, -W * 0.5);
  };
  // one silhouette: every outline first
  ctx.lineJoin = 'round'; ctx.strokeStyle = LINE; ctx.lineWidth = o * 2;
  for (const f of F) { ctx.beginPath(); f.path(ctx); ctx.stroke(); }
  ctx.beginPath(); covert(ctx); ctx.stroke();
  // flight feathers: dark vane, a coloured tip, lit leading half, pale shaft
  for (const f of F) {
    const a0 = f.Q(0, 0), a1 = f.Q(f.len, 0), g = ctx.createLinearGradient(a0[0], a0[1], a1[0], a1[1]);
    g.addColorStop(0, cols[0]); g.addColorStop(0.45, dark);
    if (tip) { g.addColorStop(0.62, dark); g.addColorStop(0.86, tip); g.addColorStop(1, tip); } else g.addColorStop(1, '#6e2209');
    ctx.beginPath(); f.path(ctx); ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = fw * 0.42; ctx.beginPath(); ctx.moveTo(...f.Q(f.len * 0.25, -fw * 0.42)); ctx.lineTo(...f.Q(f.len * 0.95, -fw * 0.42)); ctx.stroke();
    ctx.strokeStyle = 'rgba(40,20,30,0.22)'; ctx.beginPath(); ctx.moveTo(...f.Q(f.len * 0.2, fw * 0.5)); ctx.lineTo(...f.Q(f.len, fw * 0.5)); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = LINE; ctx.lineWidth = o * 0.6; ctx.globalAlpha = 0.8; ctx.beginPath(); f.path(ctx); ctx.stroke();
    ctx.globalAlpha = 0.5; ctx.strokeStyle = '#ffe2b0'; ctx.lineWidth = o * 0.35; ctx.beginPath(); ctx.moveTo(...f.Q(f.len * 0.3, 0)); ctx.lineTo(...f.Q(f.len * 0.88, 0)); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // coverts: three nested scalloped rows, lighter toward the leading edge
  const rows = [[1, cols[0], cols[1], 0.75], [0.7, '#f08a48', cols[0], 0.6], [0.42, '#ffb070', '#f08a48', 0.5]];
  for (const [k, hi, lo, lw] of rows) {
    ctx.save();
    ctx.translate(0, -W * 0.5); ctx.scale(k, k * (k < 1 ? 0.92 : 1)); ctx.translate(0, W * 0.5);
    ctx.beginPath(); covert(ctx);
    ctx.fillStyle = cols[0].length === 7 && k < 1 && cols !== COCK.wing ? (k < 0.5 ? cols[0] : cols[1]) : grad(ctx, 0, -W, 0, W * 0.8, [hi, lo]);
    ctx.fill();
    if (k < 1) { ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(60,20,10,0.28)'; ctx.lineWidth = 3.4 / k; ctx.beginPath(); covert(ctx); ctx.stroke(); ctx.restore(); } // soft shade under each row's hem
    ctx.strokeStyle = LINE; ctx.lineWidth = o * lw / k; ctx.globalAlpha = k < 1 ? 0.75 : 1; ctx.beginPath(); covert(ctx); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.restore();
  }
  // the leading edge catches the light
  ctx.save(); ctx.beginPath(); covert(ctx); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.38)'; ctx.lineWidth = 2.2 * scale; ctx.beginPath(); ctx.moveTo(2, -W * 0.5 + 2.6 * scale); ctx.bezierCurveTo(L * 0.3, -W * 1.25 * cv + 3 * scale, L * 0.66, -W * 0.98 * cv + 3 * scale, L * 0.84, -W * 0.2); ctx.stroke();
  ctx.restore();
  ctx.restore();
}

// a pointed plume (hackle, saddle): root at (x, y), pointing along ang; cols = [root, tip]
function plume(ctx, o, x, y, ang, L, W, cols, lw = 0.6) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.beginPath(); ctx.moveTo(0, -W * 0.32); ctx.quadraticCurveTo(L * 0.5, -W * 0.8, L, 0); ctx.quadraticCurveTo(L * 0.5, W * 0.8, 0, W * 0.32); ctx.closePath();
  ctx.fillStyle = grad(ctx, 0, 0, L, 0, cols); ctx.fill();
  ctx.lineWidth = o * lw; ctx.strokeStyle = LINE; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = o * 0.3; ctx.beginPath(); ctx.moveTo(L * 0.15, -W * 0.12); ctx.quadraticCurveTo(L * 0.5, -W * 0.3, L * 0.8, -W * 0.04); ctx.stroke();
  ctx.restore();
}

// a sickle tail feather from the origin: rises along ang, arches over and droops behind (curl 0..1). A tapered ribbon,
// glossy on the outside of the arch, shaded underneath.
function sickle(ctx, o, ang, L, W, curl, cols) {
  ctx.save(); ctx.rotate(ang);
  const B = [[0, 0], [L * 0.5, L * 0.16], [L * 1.02, L * 0.04], [L * 0.8, -L * 0.6 * curl]];
  const N = 16, up = [], dn = [], mid = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, m = 1 - t;
    const px = m * m * m * B[0][0] + 3 * m * m * t * B[1][0] + 3 * m * t * t * B[2][0] + t * t * t * B[3][0], py = m * m * m * B[0][1] + 3 * m * m * t * B[1][1] + 3 * m * t * t * B[2][1] + t * t * t * B[3][1];
    const dx = 3 * m * m * (B[1][0] - B[0][0]) + 6 * m * t * (B[2][0] - B[1][0]) + 3 * t * t * (B[3][0] - B[2][0]), dy = 3 * m * m * (B[1][1] - B[0][1]) + 6 * m * t * (B[2][1] - B[1][1]) + 3 * t * t * (B[3][1] - B[2][1]);
    const l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, w = W * 0.5 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.6)), 0.6);
    up.push([px + nx * w, py + ny * w]); dn.push([px - nx * w, py - ny * w]); mid.push([px, py, nx, ny, w]);
  }
  const path = (c) => { c.moveTo(up[0][0], up[0][1]); for (let i = 1; i <= N; i++) c.lineTo(up[i][0], up[i][1]); for (let i = N - 1; i >= 0; i--) c.lineTo(dn[i][0], dn[i][1]); c.closePath(); };
  solid(ctx, o, path, grad(ctx, 0, 0, L * 0.9, -L * 0.3 * curl, cols));
  ctx.save(); ctx.beginPath(); path(ctx); ctx.clip();
  ctx.strokeStyle = 'rgba(10,30,40,0.3)'; ctx.lineWidth = W * 0.5; ctx.beginPath(); for (let i = 1; i <= N; i++) ctx[i === 1 ? 'moveTo' : 'lineTo'](dn[i][0], dn[i][1]); ctx.stroke(); // underside in shade
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = Math.max(0.9, W * 0.16); ctx.beginPath(); // gloss along the outside of the arch
  for (let i = 3; i <= N - 4; i++) { const q = mid[i]; ctx[i === 3 ? 'moveTo' : 'lineTo'](q[0] + q[2] * q[4] * 0.45, q[1] + q[3] * q[4] * 0.45); }
  ctx.stroke();
  ctx.restore();
  ctx.lineWidth = o; ctx.strokeStyle = LINE; ctx.beginPath(); path(ctx); ctx.stroke();
  ctx.restore();
}

// ---------- legs (orange, drawn like the hen's feet: a dark underlay, then the colour)
function legs(ctx, o, top, ground, L, web) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const pass of [0, 1]) {
    ctx.strokeStyle = pass ? BEAK.hi : BEAK.line;
    ctx.lineWidth = (web ? 4.6 : 4.2) + (pass ? 0 : o * 1.4);
    ctx.beginPath();
    for (const l of L) { // {x: hip x, fx: foot x, fy: foot y, kx, ky: knee}
      ctx.moveTo(l.x, top);
      if (l.kx != null) ctx.lineTo(l.kx, l.ky);
      ctx.lineTo(l.fx, l.fy);
      if (web) { ctx.moveTo(l.fx - 3, l.fy + 1); ctx.lineTo(l.fx + 11, l.fy + 1); }
      else { ctx.moveTo(l.fx - 5, l.fy + 1); ctx.lineTo(l.fx, l.fy); ctx.lineTo(l.fx + 8, l.fy + 1.5); ctx.moveTo(l.fx, l.fy); ctx.lineTo(l.fx + 5, l.fy - 3); }
    }
    ctx.stroke();
  }
  if (web) { // webbed feet: a little triangle
    ctx.fillStyle = BEAK.hi; ctx.strokeStyle = BEAK.line; ctx.lineWidth = o * 0.7;
    for (const l of L) { if (l.fy < ground - 8) continue; ctx.beginPath(); ctx.moveTo(l.fx - 2, l.fy - 2); ctx.lineTo(l.fx + 13, l.fy + 1.5); ctx.lineTo(l.fx - 3, l.fy + 3); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  }
}
// walking feet for a stride phase ph: the two legs at hip x0 and x1 (alternating)
function strideLegs(ph, hips, ground, reach = 9, lift = 7) {
  return hips.map((x, i) => { const s = Math.sin(ph + i * Math.PI), c = Math.cos(ph + i * Math.PI), up = Math.max(0, c) * lift; return { x, fx: x + s * reach, fy: ground - up, kx: x + s * reach * 0.5 + 3, ky: ground - 8 - up * 0.6 }; });
}

/* =================================================================== ROOSTER */

// anim: 'fly' 'land' 'crouch' 'puff' 'crow' 'strut' 'idle'; k 0..1 through it; tt = clock (s)
export function roosterPose(anim, k = 0, tt = 0) {
  const P = { dy: 0, lean: 0, chest: 1, hx: 0, hy: 0, hr: 0, beak: 0, eye: 'open', wa: 2.6, sp: 0, tail: 0, legs: 'stand', ph: 0, sqy: 1, far: 0,
    // face (drawing only): upper / lower lid cover 0..1, brow tilt (+ = furrowed, the beak end lowered) and lift (- = raised),
    // shut 0..1 (squeezed closed), wide 0..1 (a startled bigger eye), px = where the pupil looks. Idle = cocky half-lids.
    lidU: 0.36, lidL: 0.1, browA: -0.1, browY: 0, shut: 0, wide: 0, px: 0.7 };
  const f = Math.sin(tt * 18);
  if (anim === 'fly') { P.wa = lerp(-2.05, -4.25, (f + 1) / 2); P.sp = 1; P.far = 1; P.hx = 6; P.hy = 2; P.beak = 0.3; P.legs = 'tuck'; P.lean = 0.1; P.tail = -0.25 + f * 0.1; P.eye = 'wide'; P.lidU = 0.14; P.lidL = 0; P.wide = 0.45; P.browA = 0.42; P.browY = 0.8; P.px = 1.2; }
  else if (anim === 'land') {
    const fold = sstep((k - 0.55) / 0.45);
    P.wa = lerp(-1.95 + Math.sin(tt * 24) * 0.3, -3.68, fold); P.sp = 1 - fold; P.far = 1 - fold; P.legs = 'reach'; P.tail = 0.5 * (1 - fold); P.lean = -0.2 * (1 - fold); P.beak = 0.3 * (1 - fold); P.hx = 3; P.eye = 'wide';
    { const e = 1 - fold; P.wide = 0.9 * e; P.lidU = lerp(0.36, 0, e); P.lidL = lerp(0.1, 0, e); P.browA = lerp(-0.1, -0.32, e); P.browY = -1.8 * e; } // braking: a startled take that settles into his usual look
  } else if (anim === 'crouch') { P.dy = 6 * k; P.sqy = 1 - 0.1 * k; P.wa = 1.7; P.sp = 0.3 * k; P.legs = 'bent'; P.lean = 0.12 * k; P.tail = -0.1; P.eye = 'glare'; P.lidU = 0.2 + 0.14 * k; P.lidL = 0.16 * k; P.browA = 0.15 + 0.4 * k; P.browY = 1.2 * k; P.px = 1.3; }
  else if (anim === 'puff') {
    const a = sstep(k), pop = Math.sin(clamp(k * 1.6, 0, 1) * Math.PI) * 0.04;
    P.chest = 1 + 0.42 * a + pop; P.hr = -0.28 * a; P.hy = -2 * a; P.wa = 2.6 - 0.45 * a; P.sp = 0.15 * a; P.lean = -0.14 * a; P.dy = -2 * a; P.tail = 0.3 * a; P.eye = 'closed'; P.legs = 'stand'; P.sqy = 1 + 0.02 * Math.sin(k * 30) * a;
    P.shut = sstep(k * 4); P.browA = lerp(0.42, -0.12, a); P.browY = lerp(0.8, -1.6, a); // a fierce breath in, then the eyes squeeze shut
  } else if (anim === 'crow') {
    const r = sstep(k * 5);
    P.chest = 1.3; P.hr = -0.9 * r; P.hx = 1 * r; P.hy = -6 * r; P.beak = (0.75 + 0.25 * Math.sin(tt * 28)) * r; P.eye = 'closed'; P.wa = -2.95 + Math.sin(tt * 34) * 0.07; P.sp = 0.55 * r; P.far = 1;
    P.tail = 0.5; P.dy = -3 * r; P.lean = -0.16 * r; P.legs = 'stand'; P.sqy = 1 + 0.015 * Math.sin(tt * 34);
    P.shut = Math.max(r, 0.9); P.browA = -0.3 * r; P.browY = -1.6 - 1.8 * r; // eyes squeezed shut, brows thrown up
  } else if (anim === 'strut') {
    const ph = tt * 8;
    P.ph = ph; P.legs = 'walk'; P.chest = 1.14; P.hx = 3 + 3 * Math.sin(ph * 2 - 0.8); P.hy = -3; P.tail = 0.35; P.lean = -0.08; P.dy = -2 - Math.abs(Math.sin(ph)) * 1.6; P.eye = 'proud'; P.wa = 2.6; P.lidU = 0.5; P.lidL = 0.2; P.browA = -0.2; P.browY = -1.4; P.px = 1.2;
  } else { P.chest = 1.05 + Math.sin(tt * 2.4) * 0.01; P.eye = 'open'; }
  return P;
}

// head centre, neck base and beak tip (unit box, relative to the body centre): shared by the art and the sound-ring effect
export function roosterHead(P) {
  const dy = P.dy - 5, hn = { x: 26 + P.hx, y: -31 + P.hy + dy }, nb = { x: 14, y: -4 + dy };
  const cs = Math.cos(P.hr * 0.3), sn = Math.sin(P.hr * 0.3); // the neck arches: the head swings less than it turns
  const H = { x: nb.x + (hn.x - nb.x) * cs - (hn.y - nb.y) * sn, y: nb.y + (hn.x - nb.x) * sn + (hn.y - nb.y) * cs };
  return { H, nb, beak: { x: H.x + Math.cos(P.hr) * 27 - Math.sin(P.hr), y: H.y + Math.sin(P.hr) * 27 + Math.cos(P.hr) } };
}

export function drawRooster(ctx, cx, cy, s, P) {
  if (!(s > 0)) return;
  ctx.save();
  try {
    ctx.translate(cx, cy);
    ctx.scale(s / 100, s / 100);
    const o = outlineW(s);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const dy = P.dy - 5, bodyY = 10 + dy, hip = 31 + dy;
    // legs (fixed to the ground at y = 48, the hips ride the body)
    let L;
    if (P.legs === 'walk') L = strideLegs(P.ph, [2, 13], 48, 9, 8);
    else if (P.legs === 'tuck') L = [{ x: 0, fx: -22, fy: 26, kx: -9, ky: 38 }, { x: 10, fx: -12, fy: 30, kx: 4, ky: 40 }];
    else if (P.legs === 'reach') L = [{ x: 2, fx: 10, fy: 50, kx: 4, ky: 41 }, { x: 13, fx: 22, fy: 48, kx: 15, ky: 41 }];
    else if (P.legs === 'bent') L = [{ x: 2, fx: 2, fy: 48, kx: 11, ky: 40 }, { x: 13, fx: 13, fy: 48, kx: 22, ky: 41 }];
    else L = [{ x: 2, fx: 3, fy: 48 }, { x: 13, fx: 14, fy: 48 }];
    legs(ctx, o, hip, 48, L, false);
    if (P.legs !== 'tuck') { // a spur on the back of each leg
      ctx.fillStyle = BEAK.lo; ctx.strokeStyle = LINE; ctx.lineWidth = o * 0.6;
      for (const l of L) { // curved, pointing back and up, on both legs
        const ax = l.kx != null ? l.kx : l.x, ay = l.kx != null ? l.ky : hip, dl = Math.hypot(l.fx - ax, l.fy - ay) || 1, ux = (l.fx - ax) / dl, uy = (l.fy - ay) / dl;
        const sx = l.fx - ux * 7, sy = l.fy - uy * 7;
        ctx.beginPath(); ctx.moveTo(sx - ux * 2.2, sy - uy * 2.2); ctx.quadraticCurveTo(sx - 5, sy - 0.5, sx - 8.5, sy - 4.5); ctx.quadraticCurveTo(sx - 4, sy + 2.5, sx + ux * 2, sy + uy * 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
    ctx.save();
    ctx.translate(2, 40 + dy); ctx.rotate(P.lean); ctx.scale(1, P.sqy); ctx.translate(-2, -40 - dy);
    // far wing (flight): behind the body, darker
    if (P.far > 0.2) { ctx.save(); ctx.globalAlpha = 1; featherWing(ctx, o, 4, bodyY - 12, P.wa - 0.35, P.sp, [COCK.wing[1], '#6e2209'], null, 0.92); ctx.restore(); }
    // tail: a real sickle tail. Short orange coverts, then five long arched glossy sickles (back to front), all on his tail angle
    ctx.save();
    ctx.translate(-25, bodyY - 5);
    { const T = P.tail, cu = 1 - 0.25 * T; // a raised tail (crow, strut) stands prouder and curls a touch less
      const teal = [COCK.tail[2], COCK.tail[0], COCK.tailLo], deep = [COCK.tail[0], COCK.tailLo, '#12474a'], rust = ['#f08a48', COCK.tail[1], '#963211'];
      sickle(ctx, o, -2.92 + T, 36, 13, 0.8 * cu, rust);
      sickle(ctx, o, -2.02 + T * 0.9, 56, 15, 1.0 * cu, deep);
      sickle(ctx, o, -2.62 + T, 45, 14, 0.92 * cu, teal);
      sickle(ctx, o, -2.3 + T * 0.95, 52, 15.5, 1.0 * cu, teal);
      sickle(ctx, o, -3.12 + T, 28, 12, 0.6 * cu, rust);
    }
    ctx.restore();
    // body + neck + head as one silhouette
    const { H, nb } = roosterHead(P);
    const bodyFill = rgrad(ctx, -10, bodyY - 12, 4, 56, COCK.gold);
    union(ctx, o, [
      { p: (c) => { c.save(); c.translate(10, bodyY + 2); c.scale(P.chest, 1 + (P.chest - 1) * 0.5); c.translate(-10, -bodyY - 2); c.ellipse(-2, bodyY, 34, 26, -0.38, 0, TAU); c.restore(); }, f: bodyFill },
      { p: (c) => { c.moveTo(32, bodyY - 4); c.quadraticCurveTo(H.x + 17, H.y + 24, H.x + 10, H.y + 4); c.lineTo(H.x - 10, H.y + 4); c.quadraticCurveTo(H.x - 16, H.y + 26, -4, bodyY - 12); c.closePath(); }, f: grad(ctx, 0, H.y, 0, bodyY - 6, ['#ffd36b', '#f4ad4c', '#f3c261']) },
      { p: (c) => c.arc(H.x, H.y, 13.6, 0, TAU), f: rgrad(ctx, H.x - 4, H.y - 5, 2, 17, ['#fff3d2', '#f4cf86', '#e5a24c']) },
    ]);
    // cream chest patch with scalloped feathers
    ctx.save();
    ctx.beginPath(); ctx.save(); ctx.translate(10, bodyY + 2); ctx.scale(P.chest, 1 + (P.chest - 1) * 0.5); ctx.translate(-10, -bodyY - 2); ctx.ellipse(-2, bodyY, 34, 26, -0.38, 0, TAU); ctx.restore(); ctx.clip();
    ctx.beginPath(); ctx.ellipse(22 + (P.chest - 1) * 14, bodyY + 14, 17 * P.chest, 20, 0.2, 0, TAU);
    ctx.fillStyle = 'rgba(255,248,226,0.9)'; ctx.fill();
    ctx.strokeStyle = 'rgba(160,110,60,0.5)'; ctx.lineWidth = o * 0.6; ctx.beginPath();
    for (const [x, y] of [[16, 8], [27, 11], [20, 20], [31, 22], [14, 29], [25, 31]]) { ctx.moveTo(x - 4, y + dy + bodyY - 10); ctx.quadraticCurveTo(x, y + 4 + dy + bodyY - 10, x + 4, y + dy + bodyY - 10); }
    ctx.stroke();
    ctx.restore();
    // saddle: pointed golden plumes draping from the back over the hips and the tail root (they ride the puffed chest)
    { const bx = (x) => 10 + (x - 10) * P.chest, by = (y) => bodyY + 2 + (y - bodyY - 2) * (1 + (P.chest - 1) * 0.5);
      const SD = [[-27, -9, 2.78, 16], [-21, -13.5, 2.6, 18], [-14, -17.5, 2.44, 19], [-7, -20, 2.34, 17]];
      SD.forEach(([x, y, a, l], i) => plume(ctx, o, bx(x), by(bodyY + y), a - P.tail * 0.25, l, 8.2, ['#f6a94a', COCK.tail[1]], 0.5));
    }
    // hackle: three tiers of pointed feathers cascading from the head down over the shoulders (a cape, lower tier first)
    { const x0 = H.x - 4, y0 = H.y + 9, x1 = 5, y1 = bodyY - 9, dl = Math.hypot(x1 - x0, y1 - y0) || 1, dx = (x1 - x0) / dl, dy2 = (y1 - y0) / dl, base = Math.atan2(dy2, dx);
      const tiers = [[1.0, 5, 19, 15, [COCK.hackle[0], COCK.hackle[1]]], [0.58, 4, 16, 11.5, ['#ffd36b', '#f09a36']], [0.22, 3, 12, 8, ['#ffe08a', COCK.hackle[0]]]];
      for (const [u, n, len, half, cols] of tiers) for (let i = 0; i < n; i++) {
        const t = n > 1 ? i / (n - 1) : 0.5, lat = lerp(-1, 0.72, t) * half; // lat: - = toward the back, + = toward the throat
        const px = lerp(x0, x1, u) - dx * len * 0.55 + dy2 * lat, py = lerp(y0, y1, u) - dy2 * len * 0.55 - dx * lat;
        plume(ctx, o, px, py, base + lerp(0.5, -0.42, t), len * (1 - 0.16 * Math.abs(t - 0.4)), 8.4, cols, 0.5);
      }
    }
    // near wing
    featherWing(ctx, o, 2, bodyY - 12, P.wa, P.sp, COCK.wing, COCK.wingTip, 1.2);
    // head details, in the head's own frame
    ctx.save();
    ctx.translate(H.x, H.y); ctx.rotate(P.hr); ctx.scale(1.09, 1.09);
    // comb: five lobes
    const combPath = (c) => { // five flame-like lobes, tallest in the middle, sweeping back
      c.moveTo(-11, -6);
      c.bezierCurveTo(-16, -10, -14, -16.5, -9, -14.5);
      c.bezierCurveTo(-11, -20.5, -5, -23.5, -2.5, -18.5);
      c.bezierCurveTo(-2.5, -25.5, 5.5, -27.5, 6.2, -20);
      c.bezierCurveTo(9, -24, 14.5, -21.5, 12.2, -15.5);
      c.bezierCurveTo(16, -15.5, 17.2, -10.5, 14, -8.6);
      c.bezierCurveTo(14.6, -6.4, 13, -4.6, 11, -4.6);
      c.closePath();
    };
    ctx.save(); ctx.translate(0.5, -8); ctx.scale(0.96, 1.24); ctx.translate(0, 6); // a bigger, upright comb, sat on the crown (room for the brow)
    ctx.lineWidth = o * 2 / 1.1; ctx.strokeStyle = RED.line; ctx.beginPath(); combPath(ctx); ctx.stroke();
    ctx.fillStyle = grad(ctx, -4, -27, 4, -5, ['#ff5a43', RED.hi, RED.lo]); ctx.beginPath(); combPath(ctx); ctx.fill();
    ctx.save(); ctx.beginPath(); combPath(ctx); ctx.clip(); ctx.fillStyle = 'rgba(120,10,10,0.3)'; ctx.beginPath(); ctx.ellipse(2, -5.5, 15, 3.4, 0.05, 0, TAU); ctx.fill(); ctx.restore(); // where it meets the crown
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-12.4, -12); ctx.quadraticCurveTo(-12, -14, -10, -14); ctx.moveTo(-8.4, -19); ctx.quadraticCurveTo(-7, -21, -5, -20.4); ctx.moveTo(0, -23); ctx.quadraticCurveTo(1.6, -25, 3.6, -24.2); ctx.moveTo(9, -20.6); ctx.quadraticCurveTo(10.4, -21.4, 11.6, -20); ctx.stroke();
    ctx.restore();
    // earlobe, wattle
    ctx.fillStyle = 'rgba(255,250,236,0.85)'; ctx.beginPath(); ctx.ellipse(-3.5, 7, 2.6, 3.4, 0.3, 0, TAU); ctx.fill(); // earlobe: a soft pale patch (never a second eye)
    const open = P.beak;
    { const wy = open * 5; // two long wattles: the far one darker behind, the near one a full teardrop
      solid(ctx, o * 0.8, (c) => { c.moveTo(10, 6.5 + wy); c.quadraticCurveTo(17, 11 + wy, 13, 20 + wy); c.quadraticCurveTo(8.5, 19 + wy, 8, 8 + wy); c.closePath(); }, RED.lo, RED.line);
      solid(ctx, o * 0.8, (c) => { c.moveTo(6.6, 6.5 + wy * 0.9); c.bezierCurveTo(13.5, 9 + wy, 13, 21.5 + wy, 8.2, 23.5 + wy); c.bezierCurveTo(3, 22 + wy, 3, 12 + wy, 3.6, 7.5 + wy * 0.8); c.closePath(); }, grad(ctx, 0, 6, 0, 24, [RED.hi, RED.lo]), RED.line);
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(6.2, 13 + wy, 1.2, 3, 0.15, 0, TAU); ctx.fill();
    }
    // beak: upper and lower, hinged at the face
    ctx.save(); ctx.translate(10, 1);
    if (open > 0.15) { // mouth: dark inside, tongue
      ctx.save(); ctx.rotate(open * 0.72);
      solid(ctx, o * 0.8, (c) => { c.moveTo(0, 0); c.lineTo(16, 1); c.lineTo(15, 4.5); c.lineTo(0, 5); c.closePath(); }, grad(ctx, 0, 0, 16, 5, [BEAK.hi, BEAK.lo]), BEAK.line);
      ctx.restore();
      ctx.fillStyle = '#5a1710'; ctx.beginPath(); ctx.moveTo(0.5, 0); ctx.lineTo(14, -0.5 + 0.2); ctx.lineTo(14.5 * Math.cos(open * 0.72), 4.4 * Math.cos(open * 0.72) + 14.5 * Math.sin(open * 0.72) - 0.8); ctx.lineTo(0.5, 4.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff7a8a'; ctx.beginPath(); ctx.ellipse(6, 3.2 + open * 2.4, 4.6, 1.5 + open * 0.9, open * 0.18, 0, TAU); ctx.fill();
    }
    solid(ctx, o * 0.8, (c) => { c.moveTo(0, -4.5); c.quadraticCurveTo(9, -5.5, 17.5, 0); c.quadraticCurveTo(9, 3.2, 0, 3); c.closePath(); }, grad(ctx, 0, -5, 0, 4, [BEAK.hi, BEAK.lo]), BEAK.line);
    ctx.restore();
    // eye: the hen's face recipe (big dark iris, near-black pupil, highlights, skin lids, thick brown brow), driven by the pose
    {
      const fv = (v, d) => (v == null ? d : v), EYE = '#2a1d14', ex = 4.3, ey = -0.9;
      const shut = clamp(fv(P.shut, P.eye === 'closed' ? 1 : 0), 0, 1), wide = clamp(fv(P.wide, P.eye === 'wide' ? 1 : 0), 0, 1);
      const browA = fv(P.browA, P.eye === 'glare' ? 0.4 : 0), browY = fv(P.browY, 0);
      const lidU = Math.max(fv(P.lidU, 0.2), shut * 0.62), lidL = Math.max(fv(P.lidL, 0), shut * 0.42);
      const rx = 5.3 + 0.6 * wide, ry = 6 + 0.9 * wide;
      ctx.lineCap = 'round';
      if (shut > 0.8) { // squeezed shut: one thick happy-effort arc with a little crease
        ctx.strokeStyle = EYE; ctx.lineWidth = o * 1.35;
        ctx.beginPath(); ctx.moveTo(ex - 4.8, ey + 1.6); ctx.quadraticCurveTo(ex, ey - 4.2, ex + 4.8, ey + 1.6); ctx.stroke();
        ctx.lineWidth = o * 0.6; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.moveTo(ex - 6.2, ey + 0.2); ctx.lineTo(ex - 7.8, ey - 1); ctx.moveTo(ex - 6.2, ey + 2.4); ctx.lineTo(ex - 8, ey + 3); ctx.stroke(); ctx.globalAlpha = 1;
      } else {
        const ball = () => { ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, 0, 0, TAU); };
        ball(); ctx.fillStyle = '#fffdf6'; ctx.fill();
        ctx.save(); ball(); ctx.clip();
        const ix = ex + fv(P.px, 0.7) * (1 - 0.5 * wide), iy = ey + 0.4 + (lidU - lidL) * 1.6, ir = 4 - 0.6 * wide;
        ctx.fillStyle = rgrad(ctx, ix, iy + 1.6, 0.5, ir * 1.25, ['#9a5f2a', '#5c3517', '#3d2210']); ctx.beginPath(); ctx.ellipse(ix, iy, ir, ir * 1.12, 0, 0, TAU); ctx.fill(); // big dark iris, warmer low
        ctx.fillStyle = '#1a100a'; glint(ctx, ix + 0.2, iy, ir * 0.56); // near-black pupil
        ctx.fillStyle = '#fff'; glint(ctx, ix - 1.4, iy - 1.9, 1.5); glint(ctx, ix + 1.5, iy + 1.8, 0.65);
        // lids: skin over the top and bottom of the eye, the upper one tilting with the brow
        ctx.fillStyle = '#eeb866'; ctx.strokeStyle = EYE; ctx.lineWidth = o * 0.75;
        if (lidU > 0.02) { const ly = ey - ry + 2 * ry * lidU, sl = browA * 4.2; ctx.beginPath(); ctx.moveTo(ex - rx - 2, ey - ry - 3); ctx.lineTo(ex + rx + 2, ey - ry - 3); ctx.lineTo(ex + rx + 2, ly + sl); ctx.quadraticCurveTo(ex, ly - 1.2 * (1 - lidU), ex - rx - 2, ly - sl); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        if (lidL > 0.02) { const ly = ey + ry - 2 * ry * lidL; ctx.fillStyle = '#f2c57a'; ctx.beginPath(); ctx.moveTo(ex - rx - 2, ey + ry + 3); ctx.lineTo(ex + rx + 2, ey + ry + 3); ctx.lineTo(ex + rx + 2, ly); ctx.quadraticCurveTo(ex, ly + 1.4, ex - rx - 2, ly); ctx.closePath(); ctx.fill(); ctx.lineWidth = o * 0.55; ctx.stroke(); }
        ctx.restore();
        ball(); ctx.strokeStyle = EYE; ctx.lineWidth = o * 0.6; ctx.stroke();
      }
      // brow: thick, outline brown; + tilt lowers the beak end (fierce), - lift raises it
      ctx.save();
      ctx.translate(ex + 0.6, ey - ry - 2.6 + browY + (shut > 0.8 ? 1.2 : 0)); ctx.rotate(browA);
      ctx.strokeStyle = '#5a3a1e'; ctx.lineWidth = o * 1.6;
      ctx.beginPath(); ctx.moveTo(-5.8, 0.6); ctx.quadraticCurveTo(-0.5, -1.9 + browA * 2.2, 5.6, 0.2); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    ctx.restore();
  } catch (e) {
    // art must never break the frame
  }
  ctx.restore();
}

/* =================================================================== GOOSE */

// anim: 'waddle' 'hiss' 'charge' 'hit' 'idle'; k 0..1; tt = clock (s); walk = stride distance clock (waddle)
export function goosePose(anim, k = 0, tt = 0, walk = tt * 6) {
  const P = { dy: 0, lean: 0, hx: 0, hy: 0, kink: 1, beak: 0, eye: 'open', wa: 2.95, sp: 0, legs: 'stand', ph: 0, sqx: 1, sqy: 1, roll: 0 };
  if (anim === 'waddle') {
    const ph = walk * 1.6;
    P.ph = ph; P.legs = 'walk'; P.roll = Math.sin(ph) * 0.1; P.dy = -Math.abs(Math.sin(ph)) * 2.4; P.hx = Math.sin(ph * 2) * 1.5; P.hy = Math.cos(ph * 2) * 1.2;
    P.beak = k > 0.8 && k < 0.9 ? 0.4 : 0;
  } else if (anim === 'hiss') {
    const r = sstep(k * 3.2), e = Math.sin(tt * 30) * 0.15;
    P.hx = 34 * r; P.hy = 30 * r; P.kink = 0.25 * (1 - r) + 0.12; P.beak = (0.9 + e) * r; P.eye = 'glare'; P.wa = lerp(-3.33, -2.7, r); P.sp = 0.85 * r; P.dy = 3 * r; P.lean = 0.12 * r; P.legs = 'bent'; P.sqy = 1 - 0.05 * r;
  } else if (anim === 'charge') {
    const f = Math.sin(tt * 17);
    P.hx = 40; P.hy = 36; P.kink = 0.05; P.beak = 0.55 + 0.4 * Math.max(0, Math.sin(tt * 22)); P.eye = 'glare'; P.wa = -2.9 + f * 0.5; P.sp = 1; P.lean = 0.2; P.legs = 'trail'; P.dy = -4;
  } else if (anim === 'hit') {
    const rb = sstep(k);
    P.hx = lerp(46, 30, rb); P.hy = lerp(40, 22, rb); P.kink = 0.05; P.beak = 1; P.eye = 'glare'; P.wa = lerp(-1.5, -2.6, rb); P.sp = 1; P.lean = lerp(0.35, 0.05, rb); P.legs = 'trail'; P.dy = -2; P.sqx = lerp(0.94, 1, rb); P.sqy = lerp(1.06, 1, rb);
  } else { P.hy = Math.sin(tt * 2) * 0.8; }
  return P;
}

export function drawGoose(ctx, cx, cy, s, P) {
  if (!(s > 0)) return;
  ctx.save();
  try {
    ctx.translate(cx, cy);
    ctx.scale(s / 100, s / 100);
    const o = outlineW(s);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const dy = P.dy - 5, bodyY = 14 + dy, hip = 34 + dy;
    let L;
    if (P.legs === 'walk') L = strideLegs(P.ph, [-2, 12], 48, 7, 6);
    else if (P.legs === 'trail') L = [{ x: -4, fx: -30, fy: 36 + dy, kx: -16, ky: 42 + dy }, { x: 8, fx: -20, fy: 40 + dy, kx: -6, ky: 44 + dy }];
    else if (P.legs === 'bent') L = [{ x: -2, fx: -4, fy: 48, kx: 6, ky: 41 }, { x: 12, fx: 10, fy: 48, kx: 20, ky: 41 }];
    else L = [{ x: -2, fx: -3, fy: 48 }, { x: 12, fx: 11, fy: 48 }];
    legs(ctx, o, hip, 48, L, true);
    ctx.save();
    ctx.translate(2, 44 + dy); ctx.rotate(P.lean + P.roll); ctx.scale(P.sqx, P.sqy); ctx.translate(-2, -44 - dy);
    const sw = P.sp > 0.3;
    if (sw) wing(ctx, o, 8, bodyY - 12, P.wa - 0.3, P.sp, ['#d7e0e8', '#aebdcb'], GOOSE.tip, 1.12); // far wing
    // pointed tail tuft
    solid(ctx, o, (c) => { c.moveTo(-26, bodyY - 6); c.quadraticCurveTo(-42, bodyY - 14, -52, bodyY - 20); c.quadraticCurveTo(-44, bodyY - 4, -34, bodyY + 8); c.closePath(); }, grad(ctx, -50, bodyY - 20, -30, bodyY, ['#e6edf2', '#bccad6']));
    // neck: a thick S-curve from the shoulder to the head
    const S = { x: 22, y: bodyY - 8 }, H = { x: 34 + P.hx, y: -40 + P.hy + dy };
    const c1 = { x: S.x + (H.x - S.x) * 0.3 + 13 * P.kink, y: S.y + (H.y - S.y) * 0.3 - 14 * P.kink };
    const c2 = { x: S.x + (H.x - S.x) * 0.72 - 11 * P.kink, y: S.y + (H.y - S.y) * 0.72 - 6 * P.kink };
    const neck = (c, w) => { // ribbon of width w along the cubic, then back
      const pts = [], n = 14;
      for (let i = 0; i <= n; i++) { const u = i / n, v = 1 - u; pts.push([v * v * v * S.x + 3 * v * v * u * c1.x + 3 * v * u * u * c2.x + u * u * u * H.x, v * v * v * S.y + 3 * v * v * u * c1.y + 3 * v * u * u * c2.y + u * u * u * H.y, w * (1 - 0.22 * u)]); }
      const nrm = (i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)], dx = b[0] - a[0], dy2 = b[1] - a[1], l = Math.hypot(dx, dy2) || 1; return [-dy2 / l, dx / l]; };
      pts.forEach((p, i) => { const [nx, ny] = nrm(i); (i ? c.lineTo.bind(c) : c.moveTo.bind(c))(p[0] + nx * p[2] / 2, p[1] + ny * p[2] / 2); });
      for (let i = n; i >= 0; i--) { const p = pts[i], [nx, ny] = nrm(i); c.lineTo(p[0] - nx * p[2] / 2, p[1] - ny * p[2] / 2); }
      c.closePath();
    };
    union(ctx, o, [
      { p: (c) => c.ellipse(-2, bodyY, 38, 25, -0.12, 0, TAU), f: rgrad(ctx, -12, bodyY - 12, 4, 58, GOOSE.body) },
      { p: (c) => neck(c, 12.5), f: grad(ctx, 0, H.y, 0, S.y, ['#ffffff', '#e4ebf1']) },
      { p: (c) => c.ellipse(H.x, H.y, 11.5, 10, 0, 0, TAU), f: rgrad(ctx, H.x - 3, H.y - 4, 2, 14, ['#ffffff', '#eef2f5', '#d3dde6']) },
    ]);
    // form: a cool shade under the belly and down the back of the neck, a warm bounce at the very bottom
    ctx.save();
    ctx.beginPath(); ctx.ellipse(-2, bodyY, 38, 25, -0.12, 0, TAU); neck(ctx, 12.5); ctx.clip();
    { const bg = ctx.createLinearGradient(-4, bodyY - 2, 2, bodyY + 26); bg.addColorStop(0, 'rgba(110,145,185,0)'); bg.addColorStop(1, 'rgba(110,145,185,0.5)'); ctx.fillStyle = bg; ctx.fillRect(-60, bodyY - 30, 130, 70); }
    ctx.restore();
    // neck shading line + chest feather scallops
    ctx.save();
    ctx.strokeStyle = 'rgba(120,140,160,0.45)'; ctx.lineWidth = o * 0.6;
    ctx.beginPath();
    for (const [x, y] of [[14, 12], [24, 14], [8, 22], [19, 24], [2, 30], [13, 32]]) { ctx.moveTo(x - 4, y + dy + bodyY - 14); ctx.quadraticCurveTo(x, y + 4 + dy + bodyY - 14, x + 4, y + dy + bodyY - 14); }
    ctx.stroke();
    ctx.restore();
    // head: beak and knob, eye
    ctx.save();
    ctx.translate(H.x, H.y);
    const rot = Math.atan2(H.y - c2.y, H.x - c2.x) * 0.7; // the head follows the neck's end
    ctx.rotate(clamp(rot, -0.6, 0.6) * 0.5);
    const open = P.beak;
    ctx.save(); ctx.translate(8, 2);
    if (open > 0.15) {
      ctx.save(); ctx.rotate(open * 0.45);
      solid(ctx, o * 0.8, (c) => { c.moveTo(0, 0); c.lineTo(17, 0.5); c.quadraticCurveTo(19, 3, 16, 5); c.lineTo(0, 5); c.closePath(); }, grad(ctx, 0, 0, 0, 5, [BEAK.hi, BEAK.lo]), BEAK.line);
      ctx.restore();
      ctx.fillStyle = '#6a1c14'; ctx.beginPath(); ctx.moveTo(1, 0.5); ctx.lineTo(16, 0.6); ctx.lineTo(16 * Math.cos(open * 0.45) - 1, 5 * Math.cos(open * 0.45) + 16 * Math.sin(open * 0.45) - 1); ctx.lineTo(1, 5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff7a8a'; ctx.beginPath(); ctx.ellipse(8, 3.4 + open * 2.6, 6, 1.4 + open, open * 0.15, 0, TAU); ctx.fill();
    }
    solid(ctx, o * 0.8, (c) => { c.moveTo(-3, -5); c.quadraticCurveTo(8, -7, 19, -1); c.quadraticCurveTo(20, 1.2, 17, 2.6); c.lineTo(-2, 3.5); c.closePath(); }, grad(ctx, 0, -6, 0, 4, [BEAK.hi, BEAK.lo]), BEAK.line);
    solid(ctx, o * 0.6, (c) => c.ellipse(1.5, -6.2, 4.4, 3.2, -0.2, 0, TAU), '#ffb02e'); // the knob
    ctx.restore();
    ctx.fillStyle = '#2a1d14'; ctx.strokeStyle = '#2a1d14'; ctx.lineCap = 'round';
    const ex = 1.5, ey = -2.5;
    if (P.eye === 'glare') {
      ctx.beginPath(); ctx.ellipse(ex, ey, 3.9, 4.3, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(90,150,210,0.85)'; ctx.beginPath(); ctx.ellipse(ex, ey + 3.2, 3.7, 2.2, 0, 0, TAU); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#fff'; glint(ctx, ex - 1.2, ey - 1.4, 1.35);
      ctx.strokeStyle = GOOSE.brow; ctx.lineWidth = o * 1.3; ctx.beginPath(); ctx.moveTo(ex - 6, ey - 7.5); ctx.lineTo(ex + 6, ey - 2.4); ctx.stroke();
    } else {
      const bl = Math.sin(P.ph * 0) ; void bl;
      ctx.beginPath(); ctx.ellipse(ex, ey, 3.9, 4.8, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(90,150,210,0.85)'; ctx.beginPath(); ctx.ellipse(ex, ey + 3.5, 3.7, 2.4, 0, 0, TAU); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#fff'; glint(ctx, ex - 1.2, ey - 1.6, 1.45); glint(ctx, ex + 1.3, ey + 1.5, 0.65);
    }
    ctx.restore();
    // wing (near)
    if (sw) wing(ctx, o, 6, bodyY - 12, P.wa, P.sp, GOOSE.wing, GOOSE.tip, 1.12);
    else wing(ctx, o, 6, bodyY - 8, P.wa, 0, GOOSE.wing, null, 1.3);
    ctx.restore();
  } catch (e) {
    // art must never break the frame
  }
  ctx.restore();
}

/* =================================================================== EFFECTS (world space, metres, y up) */

// rings of sound spreading from the beak
// the crow's sound rings: 3 bold rings from the beak that sweep the whole vault in WAVE_T s (tau = s since the blast).
// Dark brown underlay, warm gold body, cream core: readable on every backdrop. Calm: thinner and fainter.
const WAVE_T = 0.45, BLAST = 0.22;
function soundRings(ctx, x, y, tau, k, speed = 20, reach = 9, calm = false) {
  if (tau < 0 || tau > WAVE_T + 0.3) return;
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const a = tau - i * 0.07;
    if (a <= 0) continue;
    const r = 0.4 + a * speed, f = r / reach;
    if (f > 1.25) continue;
    const al = clamp(a / 0.04, 0, 1) * (1 - sstep((f - 0.7) / 0.55)) * (1 - i * 0.12) * (calm ? 0.6 : 1), w = (calm ? 0.7 : 1) * (15 - i * 2.5) * (1 - 0.35 * clamp(f, 0, 1));
    ctx.globalAlpha = al;
    ctx.strokeStyle = LINE; ctx.lineWidth = (w + 5) / k;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#ffc44d'; ctx.lineWidth = w / k;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#fff6d8'; ctx.lineWidth = w * 0.42 / k;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}
// short arcs hugging the beak while it sings: ((
function voiceMarks(ctx, x, y, face, aim, t, k, n = 3) {
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const ph = (t * 3.2 + i / n) % 1, r = (0.32 + ph * 0.55), a = aim + face * 0, w = 1.0 - ph;
    ctx.globalAlpha = w;
    ctx.strokeStyle = LINE; ctx.lineWidth = 6 / k; ctx.beginPath(); ctx.arc(x, y, r, a - 0.5, a + 0.5); ctx.stroke();
    ctx.strokeStyle = '#fff6d8'; ctx.lineWidth = 3.4 / k; ctx.beginPath(); ctx.arc(x, y, r, a - 0.5, a + 0.5); ctx.stroke();
  }
  ctx.restore();
}
function star(ctx, x, y, r, pts, rot, fill, k) {
  ctx.beginPath();
  for (let i = 0; i < pts * 2; i++) { const a = rot + (i * Math.PI) / pts, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2.2 / k; ctx.strokeStyle = LINE; ctx.lineJoin = 'round'; ctx.stroke();
}

const SIZE = { rooster: 1.3, goose: 1.1 };

// Draw the live ally. ctx is the world transform (metres, y up). act = sim.ally.act; k = px per metre; t = clock.
export function drawAllyAct(ctx, act, R, groundY, k, victim, P0) {
  const P = P0 || allyPlace(act, R, groundY), tt = P.tt, s = SIZE[act.kind] * k;
  const { x, y, tilt, face } = P;
  // ground shadow while it walks
  if (!P.fly && (act.kind === 'goose' || act.ph === 'land')) {
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, groundY, 0.4 * SIZE[act.kind], 0.07 * SIZE[act.kind], 0, 0, TAU); ctx.fill(); ctx.restore();
  }
  // goose charge: speed streaks behind it
  if (act.kind === 'goose' && act.ph === 'charge' && P.anim === 'charge') {
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const yy = (0.18 + i * 0.16) * SIZE.goose, l = (0.5 + 0.35 * ((i * 7) % 3)) * SIZE.goose, ph = (tt * 6 + i * 0.37) % 1;
      ctx.globalAlpha = 0.75 * (1 - ph);
      ctx.strokeStyle = LINE; ctx.lineWidth = 5.4 / k; ctx.beginPath(); ctx.moveTo(-face * (0.5 + ph * 0.5) * SIZE.goose, yy); ctx.lineTo(-face * (0.5 + ph * 0.5 + l) * SIZE.goose, yy); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 / k; ctx.beginPath(); ctx.moveTo(-face * (0.5 + ph * 0.5) * SIZE.goose, yy); ctx.lineTo(-face * (0.5 + ph * 0.5 + l) * SIZE.goose, yy); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(face / k, -1 / k);
  const feet = 0.48 * s;
  if (act.kind === 'rooster') {
    const pose = roosterPose(P.anim, P.k, tt);
    drawRooster(ctx, 0, -feet, s, pose);
  } else {
    const pose = goosePose(P.anim, P.k, tt, P.walk != null ? P.walk : tt * 6);
    drawGoose(ctx, 0, -feet, s, pose);
  }
  ctx.restore();
  // effects
  if (act.kind === 'rooster') {
    // beak tip in world metres, from the pose's own beak point (unit box, relative to the body centre)
    const bo = roosterHead(roosterPose(P.anim, P.k, tt)).beak, sm = SIZE.rooster, lx = face * (bo.x / 100) * sm, ly = -(-0.48 + bo.y / 100) * sm;
    const bx = x + lx * Math.cos(tilt) - ly * Math.sin(tilt), by = y + lx * Math.sin(tilt) + ly * Math.cos(tilt);
    if (act.ph === 'crow') {
      voiceMarks(ctx, bx, by, tilt + (face > 0 ? 0.6 : Math.PI - 0.6), 0, tt, k, 3);
      if (act.t > BLAST - 1e-6) { const W = WAVE; soundRings(ctx, W ? W.ox : bx, W ? W.oy : by, act.t - BLAST, k, W ? W.speed : 20, W ? W.reach : 9, W ? W.calm : false); }
    }
    if (act.ph === 'land' || (act.ph === 'in' && act.t > 1.1)) { // a few feathers shaken loose on landing
      ctx.save();
      for (let i = 0; i < 4; i++) {
        const age = clamp((act.ph === 'land' ? act.t + 0.4 : act.t - 1.1) / 1.2, 0, 1), fx = x + (i - 1.5) * 0.35 + Math.sin(age * 5 + i) * 0.12, fy = y + 0.9 + 0.2 * i - age * 0.9;
        ctx.globalAlpha = 1 - age; ctx.translate(fx, fy); ctx.rotate(i + age * 3); ctx.beginPath(); ctx.ellipse(0, 0, 0.05, 0.12, 0, 0, TAU); ctx.fillStyle = '#fff6df'; ctx.fill(); ctx.lineWidth = 1.6 / k; ctx.strokeStyle = LINE; ctx.stroke(); ctx.rotate(-i - age * 3); ctx.translate(-fx, -fy);
      }
      ctx.restore();
    }
  } else {
    const beakOpen = (P.anim === 'hiss' && P.k > 0.25) || P.anim === 'charge' || P.anim === 'hit';
    if (beakOpen) {
      // honk lines fan out from the beak, along the direction the goose is looking
      const sm = SIZE.goose, gp = goosePose(P.anim, P.k, tt, P.walk != null ? P.walk : tt * 6), bo = { x: 34 + gp.hx + 28, y: -40 + gp.hy + gp.dy - 5 + 1 };
      const lx = face * (bo.x / 100) * sm, ly = -(-0.48 + bo.y / 100) * sm;
      const hx = x + lx * Math.cos(tilt) - ly * Math.sin(tilt), hy = y + lx * Math.sin(tilt) + ly * Math.cos(tilt);
      const base = tilt + (face > 0 ? 0 : Math.PI);
      ctx.save(); ctx.lineCap = 'round';
      const pulse = (Math.sin(tt * 26) + 1) / 2;
      for (let i = -1; i <= 1; i++) {
        const a = base + i * 0.55, r0 = 0.1 + pulse * 0.04, r1 = r0 + 0.2 + pulse * 0.1;
        ctx.strokeStyle = LINE; ctx.lineWidth = 6.2 / k; ctx.beginPath(); ctx.moveTo(hx + Math.cos(a) * r0, hy + Math.sin(a) * r0); ctx.lineTo(hx + Math.cos(a) * r1, hy + Math.sin(a) * r1); ctx.stroke();
        ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 3.4 / k; ctx.beginPath(); ctx.moveTo(hx + Math.cos(a) * r0, hy + Math.sin(a) * r0); ctx.lineTo(hx + Math.cos(a) * r1, hy + Math.sin(a) * r1); ctx.stroke();
      }
      ctx.restore();
    }
    // the collision: a star burst where it hits, and the victim thrown out
    if (act.hit && act.tau >= 0) {
      const tau = act.tau;
      ctx.save();
      const a = clamp(1 - tau / 0.6, 0, 1);
      if (a > 0) { ctx.globalAlpha = a; star(ctx, act.ox, act.oy, 0.5 + 0.35 * (1 - a), 9, tt * 2, '#fff2a0', k); star(ctx, act.ox, act.oy, 0.25 + 0.15 * (1 - a), 7, -tt, '#ffd23f', k); }
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------- perch: the rooster never lands on a villain
// Render only: the sim still thinks he lands at +-1.8 (that only sets which way the egg nudge points). The art picks the
// spot on the top arc (candidates round the rim) with the most room round every creature / boss anchor and under the HUD,
// and sidesteps with a flap if something moves into him.
let WAVE = null; // the live crow wave: {ox, oy, speed, reach, tau, calm}
const PERCH = { sim: null, lx: 1.8, sd: 1, mv: null, wo: null, fired: new Set(), init: false };
const rimYr = (R, x) => Math.sqrt(Math.max(0, R * R - x * x));
const CANDS = [1.8, -1.8, 1.0, -1.0, 2.8, -2.8, 0.4, -0.4, 3.6, -3.6, 2.3, -2.3, 4.4, -4.4];

// creature / boss anchors: {x, y, r} in world metres (what the rooster must keep clear of)
function anchorsOf(sim) {
  const A = [], add = (x, y, r) => { if (isFinite(x) && isFinite(y)) A.push({ x, y, r }); };
  try {
    const B = sim.bx && sim.bx.boss, gk = B && geckoAnchor(sim), R = sim.outerR;
    if (gk) add(gk.x, gk.y, 2.1); else if (B) add(B.x, B.y, 1.5);
    const F0 = sim.level.bossFight;
    if (B && B.den && F0 && F0.den) { const a = (F0.den.a * Math.PI) / 180; add(R * Math.cos(a), R * Math.sin(a), 0.9); }
    const E = sim.eagle; if (E && !E.end && E.phase !== 'away') add(E.x, E.y, 1.4);
    for (const S of sim.snakes || []) {
      if (S.gone) continue;
      if (S.pts && S.pts.length > 1) for (let i = 0; i < S.pts.length; i += 5) add(S.pts[i].x, S.pts[i].y, 0.8);
      else if (S.rad > R) add(S.rad * Math.cos(S.a), S.rad * Math.sin(S.a), 0.9);
    }
    for (const C of sim.sals || []) if (C.pts && C.pts.length > 1) for (let i = 0; i < C.pts.length; i += 5) add(C.pts[i].x, C.pts[i].y, 0.8);
    for (const F of sim.frogs || []) add(F.x, F.y, 0.9);
    for (const T of sim.thieves || []) if (sim.thLive(T)) { const b = sim.thBody(T); add(b.x, b.y, 0.9); }
  } catch (e) { /* art never breaks the frame */ }
  return A;
}
// room (metres) between his body and the nearest anchor, over the spot and the little walk of the strut
function room(R, lx, sd, A) {
  let m = 9;
  for (const f of [0, 0.5, 1]) { const x = lx + sd * ALLY.rooster.strut * f, y = rimYr(R, x) + 0.65; for (const a of A) m = Math.min(m, Math.hypot(x - a.x, y - a.y) - a.r - 0.75); }
  return m;
}
function okView(R, lx, view) {
  if (!view) return true;
  const x0 = lx - 1.0, x1 = lx + 1.0 + Math.sign(lx || 1) * ALLY.rooster.strut; // body + the walk
  return Math.min(x0, x1) > view.x0 && Math.max(x0, x1) < view.x1 && rimYr(R, lx) + 1.9 < view.top;
}
function pickPerch(sim, view, A, avoid) {
  const R = sim.outerR;
  const cands = CANDS.filter((c) => Math.abs(c) <= 0.85 * R && (avoid == null || Math.abs(c - avoid) > 0.4));
  let best = null, bs = -1e9;
  for (const c of cands) {
    const sd = c >= 0 ? 1 : -1, ok = okView(R, c, view), sc = room(R, c, sd, A) - (ok ? 0 : 6) - 0.04 * Math.abs(c);
    if (sc > bs) { bs = sc; best = c; }
  }
  return best == null ? 1.8 : best;
}

// every frame, early in the world draw: settle the perch, sidestep if needed, set the crow wave and its dust.
// view = {x0, x1, top}: the world box under the HUD. fx: the particle layer.
export function allyFrame(sim, view, calm, fx) {
  WAVE = null;
  const act = sim.ally && sim.ally.act;
  if (!act || act.kind !== 'rooster') { if (!act) PERCH.sim = null; return; }
  const R = sim.outerR, el = allyElapsed(act);
  if (PERCH.sim !== sim || !PERCH.init || (act.ph === 'in' && act.t < 0.05)) {
    const A = anchorsOf(sim);
    PERCH.sim = sim; PERCH.init = true; PERCH.mv = null; PERCH.wo = null; PERCH.fired = new Set();
    const keep = room(R, act.lx, act.sd, A) >= 0.5 && okView(R, act.lx, view);
    PERCH.lx = keep ? act.lx : pickPerch(sim, view, A, null); PERCH.sd = PERCH.lx >= 0 ? 1 : -1;
  } else if (PERCH.mv && el - PERCH.mv.t0 >= PERCH.mv.d) PERCH.mv = null;
  // something walked into him while he is perched: flap to the roomiest spot
  if (!PERCH.mv && (act.ph === 'puff' || act.ph === 'crow' || (act.ph === 'land' && act.t > 0.3))) {
    const A = anchorsOf(sim);
    if (room(R, PERCH.lx, PERCH.sd, A) < -0.15) {
      const to = pickPerch(sim, view, A, PERCH.lx);
      PERCH.mv = { from: PERCH.lx, t0: el, d: 0.4 }; PERCH.lx = to; PERCH.sd = to >= 0 ? 1 : -1;
    }
  }
  if (act.ph !== 'crow' || act.t < BLAST) return;
  const P = ralloc(sim, act), bo = roosterHead(roosterPose(P.anim, P.k, P.tt)).beak, sm = SIZE.rooster, face = P.face;
  const lx = face * (bo.x / 100) * sm, ly = -(-0.48 + bo.y / 100) * sm;
  if (!PERCH.wo) PERCH.wo = { x: P.x + lx * Math.cos(P.tilt) - ly * Math.sin(P.tilt), y: P.y + lx * Math.sin(P.tilt) + ly * Math.cos(P.tilt) };
  const ox = PERCH.wo.x, oy = PERCH.wo.y, reach = Math.hypot(ox, oy) + R + 2.5;
  WAVE = { ox, oy, speed: reach / WAVE_T, reach, tau: act.t - BLAST, calm: !!calm };
  if (fx && !calm) { // a few dust motes shaken off each ring as the wave front reaches it
    const base = Math.atan2(oy, ox);
    sim.rings.forEach((rg, i) => [0, 1, -1].forEach((o, j) => {
      const key = i * 3 + j; if (PERCH.fired.has(key)) return;
      const a = base + o * 1.15, px = rg.r * Math.cos(a), py = rg.r * Math.sin(a);
      if (WAVE.tau - Math.hypot(px - ox, py - oy) / WAVE.speed < 0) return;
      PERCH.fired.add(key); fx.dust(px, py, 2 + (j === 0 ? 1 : 0), 'rgba(238,226,200,0.85)');
    }));
  }
}
// the place the art draws him this frame: the perch (not the sim's), or the flap between two perches
function ralloc(sim, act) {
  const R = sim.outerR, ra = { ...act, lx: PERCH.lx, sd: PERCH.sd }, P = allyPlace(ra, R, sim.groundY), mv = PERCH.mv;
  if (!mv || !(act.ph === 'land' || act.ph === 'puff' || act.ph === 'crow')) return P;
  const u = clamp((allyElapsed(act) - mv.t0) / mv.d, 0, 1), e = sstep(u), x = lerp(mv.from, PERCH.lx, e), face = PERCH.lx >= mv.from ? 1 : -1;
  const arc = Math.sin(Math.PI * u), y = rimYr(R, x) + 0.9 * arc, rt = -Math.asin(clamp(x / R, -1, 1)) * 0.8;
  return { x, y: y + 0.05 * Math.sin(P.tt * 16), tilt: rt * (1 - arc * 0.5) + face * 0.3 * arc, face, anim: 'fly', k: u, fly: u > 0.08 && u < 0.92 ? 1 : 0, tt: P.tt };
}
// seconds since the wave front passed a point (negative: not there yet); null when there is no wave
const waveAge = (x, y) => (WAVE ? WAVE.tau - Math.hypot(x - WAVE.ox, y - WAVE.oy) / WAVE.speed : null);
// a ring shivers: a 2-3 px radial wobble for ~0.3 s once the front crosses it (call with ctx at the vault centre)
export function crowRingXf(ctx, ringR, k) {
  if (!WAVE || WAVE.calm) return;
  const a = WAVE.tau - Math.max(Math.hypot(WAVE.ox, WAVE.oy), ringR) / WAVE.speed;
  if (a < 0 || a > 0.4) return;
  const s = 1 + ((2.7 / k) / Math.max(0.5, ringR)) * Math.sin(a * 58) * Math.exp(-a / 0.1);
  ctx.scale(s, s);
}
// an egg's startled hop and squash (ctx in world metres; call inside save/restore). up = +1 or -1 (against gravity)
export function crowEggXf(ctx, x, y, up = 1) {
  const a = waveAge(x, y);
  if (a == null || WAVE.calm || a < 0 || a > 0.32) return;
  const hop = Math.sin(Math.PI * clamp(a / 0.22, 0, 1)) * 0.075 * up, q = Math.sin(a * 36) * Math.exp(-a / 0.12);
  ctx.translate(x, y + hop); ctx.scale(1 - 0.12 * q, 1 + 0.16 * q); ctx.translate(-x, -y);
}
// a creature flinches as the front reaches it: types are the strike-layer names ('bx' 'sal' 'frog' 'thief' 'snake' 'eagle')
export function crowFlinch(ctx, sim, types, fn) {
  if (!WAVE || WAVE.calm) return fn(ctx);
  let at = null;
  try {
    const pts = [], has = (t) => types.includes(t);
    if (has('bx') && sim.bx && sim.bx.boss) { const g = geckoAnchor(sim), B = sim.bx.boss; pts.push(g || { x: B.x, y: B.y }); }
    if (has('sal')) for (const C of sim.sals || []) if (C.pts && C.pts[0]) pts.push(C.pts[0]);
    if (has('frog')) for (const F of sim.frogs || []) pts.push({ x: F.x, y: F.y });
    if (has('thief')) for (const T of sim.thieves || []) if (sim.thLive(T)) pts.push(sim.thBody(T));
    if (has('snake')) for (const S of sim.snakes || []) if (S.pts && S.pts[0] && !S.gone) pts.push(S.pts[0]);
    if (has('eagle') && sim.eagle && !sim.eagle.end && sim.eagle.phase !== 'away') pts.push(sim.eagle);
    if (pts.length) at = { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
  } catch (e) { at = null; }
  const a = at ? waveAge(at.x, at.y) : null;
  if (a == null || a < 0 || a > 0.4) return fn(ctx);
  const e = Math.sin(Math.PI * clamp(a / 0.28, 0, 1)) * Math.exp(-a / 0.35), d = Math.hypot(at.x - WAVE.ox, at.y - WAVE.oy) || 1;
  ctx.save();
  ctx.translate(at.x + ((at.x - WAVE.ox) / d) * 0.1 * e, at.y + ((at.y - WAVE.oy) / d) * 0.1 * e); ctx.scale(1 + 0.14 * e, 1 - 0.2 * e); ctx.translate(-at.x, -at.y);
  try { fn(ctx); } finally { ctx.restore(); }
}

// In the game: draw the live ally, in front of everything (main calls it after the creature layers). `victim`: the snake or eagle it flung draws itself.
export function drawAllies(ctx, sim, t, k) {
  const act = sim.ally && sim.ally.act;
  if (!act) return;
  try {
    if (act.kind === 'rooster' && PERCH.sim === sim) drawAllyAct(ctx, { ...act, lx: PERCH.lx, sd: PERCH.sd }, sim.outerR, sim.groundY, k, true, ralloc(sim, act));
    else drawAllyAct(ctx, act, sim.outerR, sim.groundY, k, true);
  } catch (e) { /* art never breaks the frame */ }
}

// QA: what the strips draw (the game's hen for scale too, facing right like them, held still)
const drawHen = (ctx, cx, cy, s, mood = 'idle', t = 0) => drawHenAnim(ctx, mood, cx, cy, s, t, { key: 'ally-qa', face: 1, calm: true });
export const ALLY_ART = { drawRooster, drawGoose, roosterPose, goosePose, drawAllyAct, drawHen, ALLY, allyPlace, SIZE };
