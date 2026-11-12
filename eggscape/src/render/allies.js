// Farm allies, code-drawn: the Rooster and the Goose, mama hen's friends (cel-shaded, dark outline, same brown line and
// the hen's orange beak, so they read as one farm). Everything is side-on and faces +x; callers mirror with ctx.scale.
// Art functions draw in a local y-DOWN space centred on (cx, cy) in a 100-unit box scaled by s / 100, feet at cy + 0.48 s
// when standing. drawRooster / drawGoose take a pose from roosterPose / goosePose (anim + k 0..1 + a clock), so the game
// and the review strips share one code path. drawAllies() paints the live ally from sim.ally (render only; the state is
// in sim/allies.js and allyPlace() there says where it is).
import { ALLY, allyPlace, flingAt } from '../sim/allies.js';
import { drawHenAnim } from './hen.js';

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
  const P = { dy: 0, lean: 0, chest: 1, hx: 0, hy: 0, hr: 0, beak: 0, eye: 'open', wa: 2.6, sp: 0, tail: 0, legs: 'stand', ph: 0, sqy: 1, far: 0 };
  const f = Math.sin(tt * 18);
  if (anim === 'fly') { P.wa = lerp(-2.05, -4.25, (f + 1) / 2); P.sp = 1; P.far = 1; P.hx = 6; P.hy = 2; P.beak = 0.3; P.legs = 'tuck'; P.lean = 0.1; P.tail = -0.25 + f * 0.1; P.eye = 'wide'; }
  else if (anim === 'land') {
    const fold = sstep((k - 0.55) / 0.45);
    P.wa = lerp(-1.95 + Math.sin(tt * 24) * 0.3, -3.68, fold); P.sp = 1 - fold; P.far = 1 - fold; P.legs = 'reach'; P.tail = 0.5 * (1 - fold); P.lean = -0.2 * (1 - fold); P.beak = 0.3 * (1 - fold); P.hx = 3; P.eye = 'wide';
  } else if (anim === 'crouch') { P.dy = 6 * k; P.sqy = 1 - 0.1 * k; P.wa = 1.7; P.sp = 0.3 * k; P.legs = 'bent'; P.lean = 0.12 * k; P.tail = -0.1; P.eye = 'glare'; }
  else if (anim === 'puff') {
    const a = sstep(k), pop = Math.sin(clamp(k * 1.6, 0, 1) * Math.PI) * 0.04;
    P.chest = 1 + 0.42 * a + pop; P.hr = -0.28 * a; P.hy = -2 * a; P.wa = 2.6 - 0.45 * a; P.sp = 0.15 * a; P.lean = -0.14 * a; P.dy = -2 * a; P.tail = 0.3 * a; P.eye = 'closed'; P.legs = 'stand'; P.sqy = 1 + 0.02 * Math.sin(k * 30) * a;
  } else if (anim === 'crow') {
    const r = sstep(k * 5);
    P.chest = 1.3; P.hr = -0.9 * r; P.hx = 1 * r; P.hy = -6 * r; P.beak = (0.75 + 0.25 * Math.sin(tt * 28)) * r; P.eye = 'closed'; P.wa = -2.95 + Math.sin(tt * 34) * 0.07; P.sp = 0.55 * r; P.far = 1;
    P.tail = 0.5; P.dy = -3 * r; P.lean = -0.16 * r; P.legs = 'stand'; P.sqy = 1 + 0.015 * Math.sin(tt * 34);
  } else if (anim === 'strut') {
    const ph = tt * 8;
    P.ph = ph; P.legs = 'walk'; P.chest = 1.14; P.hx = 3 + 3 * Math.sin(ph * 2 - 0.8); P.hy = -3; P.tail = 0.35; P.lean = -0.08; P.dy = -2 - Math.abs(Math.sin(ph)) * 1.6; P.eye = 'proud'; P.wa = 2.6;
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
      for (const l of L.slice(0, 1)) { ctx.beginPath(); ctx.moveTo(l.fx - 1, l.fy - 9); ctx.lineTo(l.fx - 6, l.fy - 6); ctx.lineTo(l.fx, l.fy - 6); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    }
    ctx.save();
    ctx.translate(2, 40 + dy); ctx.rotate(P.lean); ctx.scale(1, P.sqy); ctx.translate(-2, -40 - dy);
    // far wing (flight): behind the body, darker
    if (P.far > 0.2) { ctx.save(); ctx.globalAlpha = 1; wing(ctx, o, 4, bodyY - 12, P.wa - 0.35, P.sp, [COCK.wing[1], '#6e2209'], null, 0.92); ctx.restore(); }
    // tail: five sickle feathers fanned up and back
    ctx.save();
    ctx.translate(-26, bodyY - 6);
    for (let i = 0; i < 5; i++) {
      const j = [0, 4, 1, 3, 2][i], a = -2.5 + (j - 2) * 0.3 + P.tail, len = 50 - Math.abs(j - 2) * 6, w = 7.4 - Math.abs(j - 2) * 0.6;
      ctx.save(); ctx.rotate(a);
      const col = j === 2 ? COCK.tail[2] : j % 2 ? COCK.tail[0] : COCK.tail[1];
      solid(ctx, o, (c) => { c.moveTo(0, 0); c.quadraticCurveTo(len * 0.45, -w * 1.7, len, -len * 0.18); c.quadraticCurveTo(len * 0.55, w * 1.5, 0, 0); }, grad(ctx, 0, -w, len, w, [col, j % 2 === 0 && j !== 2 ? '#b34414' : COCK.tailLo]));
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = o * 0.5;
      ctx.beginPath(); ctx.moveTo(len * 0.18, -w * 0.2); ctx.quadraticCurveTo(len * 0.5, -w * 0.85, len * 0.88, -len * 0.14); ctx.stroke();
      ctx.restore();
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
    // hackle: pointed golden feathers lying over the shoulder
    ctx.save();
    ctx.fillStyle = '#ffd36b'; ctx.strokeStyle = LINE; ctx.lineWidth = o * 0.6;
    for (let i = 0; i < 4; i++) {
      const u = i / 3, hx = lerp(H.x - 9, nb.x - 14, u), hy = lerp(H.y + 14, bodyY - 13, u);
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(hx + 7, hy + 4, hx + 2, hy + 15); ctx.quadraticCurveTo(hx - 5, hy + 7, hx, hy); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
    // near wing
    wing(ctx, o, 2, bodyY - 12, P.wa, P.sp, COCK.wing, P.sp > 0.3 ? COCK.wingTip : null, 1.2);
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
    ctx.lineWidth = o * 2; ctx.strokeStyle = RED.line; ctx.beginPath(); combPath(ctx); ctx.stroke();
    ctx.fillStyle = grad(ctx, -4, -27, 4, -5, ['#ff5a43', RED.hi, RED.lo]); ctx.beginPath(); combPath(ctx); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-12.4, -12); ctx.quadraticCurveTo(-12, -14, -10, -14); ctx.moveTo(-8.4, -19); ctx.quadraticCurveTo(-7, -21, -5, -20.4); ctx.moveTo(0, -23); ctx.quadraticCurveTo(1.6, -25, 3.6, -24.2); ctx.moveTo(9, -20.6); ctx.quadraticCurveTo(10.4, -21.4, 11.6, -20); ctx.stroke();
    // earlobe, wattle
    ctx.fillStyle = 'rgba(255,250,236,0.85)'; ctx.beginPath(); ctx.ellipse(-3.5, 7, 2.6, 3.4, 0.3, 0, TAU); ctx.fill(); // earlobe: a soft pale patch (never a second eye)
    const open = P.beak;
    solid(ctx, o * 0.8, (c) => { c.moveTo(7, 7 + open * 5); c.quadraticCurveTo(14, 10 + open * 5, 9, 19 + open * 5); c.quadraticCurveTo(4, 17 + open * 5, 4, 8 + open * 4); c.closePath(); }, grad(ctx, 0, 6, 0, 20, [RED.hi, RED.lo]), RED.line);
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
    // eye
    ctx.fillStyle = '#2a1d14'; ctx.strokeStyle = '#2a1d14'; ctx.lineCap = 'round';
    const ex = 5, ey = -3;
    if (P.eye === 'closed') { ctx.lineWidth = o * 1.3; ctx.beginPath(); ctx.moveTo(ex - 5, ey + 1); ctx.quadraticCurveTo(ex, ey - 5, ex + 5, ey + 1); ctx.stroke(); }
    else if (P.eye === 'wide') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, ey, 5.2, 6, 0, 0, TAU); ctx.fill(); ctx.lineWidth = o * 0.8; ctx.stroke(); ctx.fillStyle = '#2a1d14'; ctx.beginPath(); ctx.arc(ex + 1, ey + 0.5, 2.8, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; glint(ctx, ex + 0.2, ey - 0.9, 1); }
    else {
      const lid = P.eye === 'proud' ? 0.42 : 0;
      ctx.beginPath(); ctx.ellipse(ex, ey + lid * 2, 4.2, 5.3 * (1 - lid), 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(215,130,50,0.8)'; ctx.beginPath(); ctx.ellipse(ex, ey + lid * 2 + 3.8 * (1 - lid), 4, 2.6, 0, 0, TAU); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#fff'; glint(ctx, ex - 1.3, ey - 1.8 + lid * 2.4, 1.6); glint(ctx, ex + 1.5, ey + 1.6 + lid, 0.7);
      ctx.fillStyle = '#2a1d14';
      ctx.lineWidth = o * 1.1; ctx.beginPath();
      if (P.eye === 'glare') { ctx.moveTo(ex - 6, ey - 9); ctx.lineTo(ex + 6, ey - 4.5); }
      else if (P.eye === 'proud') { ctx.moveTo(ex - 6, ey - 3.2); ctx.lineTo(ex + 6, ey - 3.2); }
      ctx.stroke();
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
function soundRings(ctx, x, y, tau, k) {
  if (tau < 0 || tau > 1.0) return;
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const a = tau - i * 0.13;
    if (a <= 0) continue;
    const r = 0.5 + a * 7.2, al = clamp(1 - a / 0.85, 0, 1) * (1 - i * 0.18);
    ctx.globalAlpha = al;
    ctx.strokeStyle = LINE; ctx.lineWidth = (9 - i * 1.5) / k + 3 / k;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#fffbea'; ctx.lineWidth = (9 - i * 1.5) / k;
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
export function drawAllyAct(ctx, act, R, groundY, k, victim) {
  const P = allyPlace(act, R, groundY), tt = P.tt, s = SIZE[act.kind] * k;
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
      if (act.t > 0.22 - 1e-6) soundRings(ctx, bx, by, act.t - 0.22, k);
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

// In the game: draw the ally of sim.ally (called after the vault, so it stands in front). `victim`: the snake or eagle it flung draws itself.
export function drawAllies(ctx, sim, t, k) {
  const act = sim.ally && sim.ally.act;
  if (!act) return;
  try { drawAllyAct(ctx, act, sim.outerR, sim.groundY, k, true); } catch (e) { /* art never breaks the frame */ }
}

// QA: what the strips draw (the game's hen for scale too, facing right like them, held still)
const drawHen = (ctx, cx, cy, s, mood = 'idle', t = 0) => drawHenAnim(ctx, mood, cx, cy, s, t, { key: 'ally-qa', face: 1, calm: true });
export const ALLY_ART = { drawRooster, drawGoose, roosterPose, goosePose, drawAllyAct, drawHen, ALLY, allyPlace, SIZE };
