// Chick Strike powers: the six strike chicks, their flight, hits and effects, the HUD button and the intro picker.
// Rules: sim/strike.js. Data: data/strikes.js. One light top-left, cel bands (castkit form), thin same-hue lines, no outline
// heavier than the art around it. Each chick has its own silhouette:
//   freeze  Frost Chick   round, a crown of three ice spikes, frosty fringe   | cool squint
//   thunder Thunder Chick pear, one tall zigzag crest                          | fierce brows
//   bomb    Boom Chick    a ball, a curled fuse with a live spark on top        | scowl
//   decoy   Decoy Chick   egg-shaped, wears a cracked shell cap low             | sly side-eye
//   tornado Twister Chick teardrop leaning forward, a spiral swirl crest        | grin
//   glue    Sticky Chick  a blob with drips, a goo drop on its head             | smug half-lids
// Chick art is drawn in px space, y down, centred on the body; s = the chick's height in px.
import { clamp, lerp, ss, hash, blinkAt, form, limb, eye, contact } from './castkit.js';
import { boltStroke } from './status.js';
import { STRIKE, STRIKES, FLIGHT } from '../data/strikes.js';

const TAU = Math.PI * 2;
const BEAK = { base: '#ffab2e', lo: '#d9761a', hi: '#ffd27a', line: '#9a4a10' };
const PAL = {
  freeze: { base: '#9ad9fb', lo: '#5aa6d8', hi: '#e2f6ff', line: '#2f6f9f', brow: '#2c5f88', iris: '#1f5f9a', acc: '#ffffff', accLo: '#a9d8f2', accLine: '#4f8fbf' },
  thunder: { base: '#ffd23a', lo: '#e3a114', hi: '#fff19a', line: '#9a6408', brow: '#7a4a04', iris: '#2a3fa8', acc: '#fff3a6', accLo: '#ffc61a', accLine: '#2f3fae' },
  bomb: { base: '#ff6f3e', lo: '#cf3e1e', hi: '#ffb27c', line: '#8e2410', brow: '#6a1a08', iris: '#3a1a0a', acc: '#4a3a34', accLo: '#2a201c', accLine: '#1a1210' },
  decoy: { base: '#f4dcb4', lo: '#d2ad78', hi: '#fff4e2', line: '#8a6236', brow: '#6a4420', iris: '#4a2a12', acc: '#fffaf0', accLo: '#e0cfb0', accLine: '#9a7a52' },
  tornado: { base: '#79dcc0', lo: '#3fa88e', hi: '#d4fff1', line: '#1f6f5c', brow: '#1a5a4a', iris: '#14504a', acc: '#e8fffa', accLo: '#9fe8d4', accLine: '#2f8f7a' },
  glue: { base: '#c08af6', lo: '#8a52cc', hi: '#ecd6ff', line: '#5a2a92', brow: '#4a1f7a', iris: '#3a145e', acc: '#8dff6a', accLo: '#4fcf3a', accLine: '#2f8a1f' },
};
export const strikeColor = (id) => (STRIKE[id] ? STRIKE[id].col[0] : '#fff');

// ---------------------------------------------------------------- the chick
// body silhouettes, unit space (body height 1, centred), traced with the castkit form bands
function bodyPath(ctx, id, s, sq, t) {
  const w = s * (1 + sq * 0.35), h = s * (1 - sq * 0.3);
  ctx.beginPath();
  if (id === 'bomb') { ctx.ellipse(0, 0, w * 0.43, h * 0.42, 0, 0, TAU); return; }
  if (id === 'decoy') { // an egg: narrower on top
    ctx.moveTo(0, -h * 0.5);
    ctx.bezierCurveTo(w * 0.3, -h * 0.5, w * 0.4, -h * 0.08, w * 0.39, h * 0.12);
    ctx.bezierCurveTo(w * 0.37, h * 0.4, w * 0.2, h * 0.46, 0, h * 0.46);
    ctx.bezierCurveTo(-w * 0.2, h * 0.46, -w * 0.37, h * 0.4, -w * 0.39, h * 0.12);
    ctx.bezierCurveTo(-w * 0.4, -h * 0.08, -w * 0.3, -h * 0.5, 0, -h * 0.5);
    ctx.closePath(); return;
  }
  if (id === 'tornado') { // a teardrop leaning forward (to +x), its tail a swoosh behind
    ctx.moveTo(w * 0.36, -h * 0.12);
    ctx.bezierCurveTo(w * 0.38, h * 0.3, w * 0.1, h * 0.42, -w * 0.12, h * 0.4);
    ctx.bezierCurveTo(-w * 0.34, h * 0.38, -w * 0.46, h * 0.2, -w * 0.58, h * 0.02);
    ctx.quadraticCurveTo(-w * 0.4, h * 0.02, -w * 0.34, -h * 0.06);
    ctx.bezierCurveTo(-w * 0.3, -h * 0.36, -w * 0.06, -h * 0.44, w * 0.08, -h * 0.42);
    ctx.bezierCurveTo(w * 0.28, -h * 0.4, w * 0.36, -h * 0.3, w * 0.36, -h * 0.12);
    ctx.closePath(); return;
  }
  if (id === 'glue') { // a blob, three drips
    const d = Math.sin(t * 3) * 0.02;
    ctx.moveTo(-w * 0.38, h * 0.12);
    ctx.bezierCurveTo(-w * 0.44, -h * 0.3, -w * 0.18, -h * 0.44, 0, -h * 0.44);
    ctx.bezierCurveTo(w * 0.2, -h * 0.44, w * 0.44, -h * 0.3, w * 0.4, h * 0.12);
    ctx.quadraticCurveTo(w * 0.4, h * 0.3, w * 0.3, h * 0.33);
    ctx.quadraticCurveTo(w * 0.27, h * (0.5 + d), w * 0.21, h * 0.34);
    ctx.quadraticCurveTo(w * 0.06, h * 0.38, -w * 0.04, h * 0.37);
    ctx.quadraticCurveTo(-w * 0.09, h * (0.56 - d), -w * 0.15, h * 0.36);
    ctx.quadraticCurveTo(-w * 0.27, h * 0.34, -w * 0.3, h * 0.31);
    ctx.quadraticCurveTo(-w * 0.34, h * (0.44 + d), -w * 0.37, h * 0.28);
    ctx.closePath(); return;
  }
  if (id === 'thunder') { // a pear: fuller below
    ctx.moveTo(0, -h * 0.44);
    ctx.bezierCurveTo(w * 0.26, -h * 0.44, w * 0.32, -h * 0.2, w * 0.36, h * 0.02);
    ctx.bezierCurveTo(w * 0.44, h * 0.3, w * 0.24, h * 0.44, 0, h * 0.44);
    ctx.bezierCurveTo(-w * 0.24, h * 0.44, -w * 0.44, h * 0.3, -w * 0.36, h * 0.02);
    ctx.bezierCurveTo(-w * 0.32, -h * 0.2, -w * 0.26, -h * 0.44, 0, -h * 0.44);
    ctx.closePath(); return;
  }
  // freeze: round with a frosty fringe of points along the bottom
  const n = 9;
  ctx.moveTo(w * 0.4, 0);
  ctx.bezierCurveTo(w * 0.4, -h * 0.24, w * 0.22, -h * 0.42, 0, -h * 0.42);
  ctx.bezierCurveTo(-w * 0.22, -h * 0.42, -w * 0.4, -h * 0.24, -w * 0.4, 0);
  for (let i = 0; i <= n; i++) {
    const a = Math.PI - (i / n) * Math.PI, r = i % 2 ? 0.46 : 0.4;
    ctx.lineTo(Math.cos(a) * w * r, Math.sin(a) * h * r * 1.02);
  }
  ctx.closePath();
}

// the crest (behind the body for some, on top for others)
function crest(ctx, id, s, t, P, fire) {
  const lw = Math.max(0.8, s * 0.022);
  ctx.save();
  ctx.lineJoin = 'round';
  if (id === 'freeze') { // three ice spikes
    for (const [x, h, a] of [[-0.13, 0.26, -0.35], [0.02, 0.36, -0.05], [0.16, 0.24, 0.3]]) {
      const bx = x * s, by = -0.36 * s, tx = bx + Math.sin(a) * h * s, ty = by - Math.cos(a) * h * s, wv = 0.06 * s;
      const p = () => { ctx.beginPath(); ctx.moveTo(bx - wv, by + 0.02 * s); ctx.lineTo(tx, ty); ctx.lineTo(bx + wv, by + 0.02 * s); ctx.closePath(); };
      form(ctx, p, { d: s * 0.04, lo: P.accLo, base: '#dff4ff', hi: P.acc, line: P.accLine, lw });
      ctx.beginPath(); ctx.moveTo(lerp(bx, tx, 0.2) - wv * 0.2, lerp(by, ty, 0.2)); ctx.lineTo(lerp(bx, tx, 0.75), lerp(by, ty, 0.75)); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = lw; ctx.stroke();
    }
  } else if (id === 'thunder') { // one tall zigzag
    const p = () => { ctx.beginPath(); const q = [[-0.04, -0.36], [0.1, -0.62], [0.0, -0.58], [0.16, -0.86], [0.12, -0.6], [0.22, -0.64], [0.08, -0.36]]; ctx.moveTo(q[0][0] * s, q[0][1] * s); for (const [x, y] of q.slice(1)) ctx.lineTo(x * s, y * s); ctx.closePath(); };
    form(ctx, p, { d: s * 0.04, lo: P.accLo, base: '#ffe45a', hi: P.acc, line: P.accLine, lw });
  } else if (id === 'bomb') { // a curled fuse and its spark
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0.02 * s, -0.38 * s); ctx.bezierCurveTo(0.04 * s, -0.56 * s, 0.24 * s, -0.56 * s, 0.2 * s, -0.68 * s);
    ctx.strokeStyle = P.accLine; ctx.lineWidth = s * 0.075; ctx.stroke(); ctx.strokeStyle = '#8a6a52'; ctx.lineWidth = s * 0.045; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0.02 * s, -0.38 * s, 0.1 * s, 0.045 * s, 0, 0, TAU); ctx.fillStyle = P.acc; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = P.accLine; ctx.stroke();
    if (fire !== false) { // the spark is fire: it may glow
      const fx = 0.2 * s, fy = -0.7 * s, f = 0.8 + 0.3 * Math.sin(t * 40) * Math.sin(t * 17);
      const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 0.14 * s * f);
      g.addColorStop(0, 'rgba(255,250,200,1)'); g.addColorStop(0.4, 'rgba(255,190,60,0.9)'); g.addColorStop(1, 'rgba(255,90,20,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx, fy, 0.14 * s * f, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#fff3b0'; ctx.lineWidth = lw; ctx.beginPath();
      for (let i = 0; i < 4; i++) { const a = t * 9 + i * 1.6; ctx.moveTo(fx + Math.cos(a) * 0.05 * s, fy + Math.sin(a) * 0.05 * s); ctx.lineTo(fx + Math.cos(a) * 0.12 * s * f, fy + Math.sin(a) * 0.12 * s * f); }
      ctx.stroke();
    }
  } else if (id === 'decoy') { // the shell cap it hides under, tipped low over one eye
    ctx.save(); ctx.translate(-0.02 * s, -0.35 * s); ctx.rotate(-0.22);
    const p = () => { ctx.beginPath(); ctx.moveTo(-0.27 * s, 0.05 * s); ctx.bezierCurveTo(-0.26 * s, -0.2 * s, 0.26 * s, -0.2 * s, 0.27 * s, 0.05 * s); const z = [[0.18, 0.0], [0.11, 0.08], [0.03, 0.0], [-0.06, 0.09], [-0.14, 0.01], [-0.21, 0.08]]; for (const [x, y] of z) ctx.lineTo(x * s, y * s); ctx.closePath(); };
    form(ctx, p, { d: s * 0.035, lo: P.accLo, base: '#fbf3e4', hi: P.acc, line: P.accLine, lw, inner: (c) => { c.fillStyle = 'rgba(150,100,50,0.55)'; for (const [x, y, r] of [[-0.12, -0.06, 0.02], [0.06, -0.1, 0.016], [0.15, -0.02, 0.014]]) { c.beginPath(); c.arc(x * s, y * s, r * s, 0, TAU); c.fill(); } } });
    ctx.restore();
  } else if (id === 'tornado') { // a spiral swirl
    ctx.lineCap = 'round';
    const sw = (col, w) => { ctx.beginPath(); for (let i = 0; i <= 24; i++) { const u = i / 24, a = -Math.PI / 2 + u * TAU * 1.25 + Math.sin(t * 6) * 0.15, r = (0.03 + u * 0.13) * s; const x = 0.04 * s + Math.cos(a) * r, y = -0.5 * s + Math.sin(a) * r * 0.8 + (1 - u) * 0.0; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(); };
    sw(P.accLine, s * 0.075); sw(P.acc, s * 0.042);
    ctx.beginPath(); ctx.moveTo(0.02 * s, -0.4 * s); ctx.quadraticCurveTo(0.0, -0.46 * s, 0.04 * s, -0.52 * s); ctx.strokeStyle = P.accLine; ctx.lineWidth = s * 0.06; ctx.stroke();
  } else if (id === 'glue') { // a goo drop wobbling on its head
    const wob = Math.sin(t * 5) * 0.04;
    const p = () => { ctx.beginPath(); ctx.moveTo(0.02 * s, -0.66 * s); ctx.bezierCurveTo((0.14 + wob) * s, -0.5 * s, 0.14 * s, -0.38 * s, 0.02 * s, -0.37 * s); ctx.bezierCurveTo(-0.1 * s, -0.38 * s, (-0.1 + wob) * s, -0.5 * s, 0.02 * s, -0.66 * s); ctx.closePath(); };
    form(ctx, p, { d: s * 0.035, lo: P.accLo, base: P.acc, hi: '#e4ffd8', line: P.accLine, lw });
  }
  ctx.restore();
}

// the face: eyes, brows (thin same-hue lines with attitude), beak. look: {x, y} -1..1, open 0..1 (squawk)
function face(ctx, id, s, t, P, o) {
  const lk = o.look || { x: 0.4, y: 0.1 }, open = o.open || 0, bl = o.blink ?? blinkAt(t, 13 + id.length * 7);
  const er = s * 0.085, ey = (id === 'decoy' ? -0.06 : id === 'bomb' ? -0.08 : -0.12) * s, ex = s * 0.11;
  const mood = { freeze: { lid: 0.42, mad: 0.25 }, thunder: { lid: 0.25, mad: 0.38 }, bomb: { lid: 0.35, mad: 0.45 }, decoy: { lid: 0.5, mad: -0.12 }, tornado: { lid: 0.18, mad: 0.18 }, glue: { lid: 0.55, mad: 0.1 } }[id];
  const fx = id === 'tornado' ? 0.07 * s : 0.04 * s;
  for (const sd of [-1, 1]) {
    const x = fx + sd * ex, look = id === 'decoy' ? { x: 0.9, y: 0.2 } : lk;
    if (bl > 0.6) eye(ctx, x, ey, { r: er, iris: P.iris, line: P.line, lw: Math.max(0.7, s * 0.016), shut: true, lidCol: P.base });
    else eye(ctx, x, ey, { r: er, white: '#fffdf8', iris: P.iris, irisR: 0.66, pupil: 'round', pupilR: 0.36, look, lid: clamp(mood.lid + bl * 0.5, 0, 1), lidCol: P.base, mad: -sd * mood.mad, line: P.line, lw: Math.max(0.7, s * 0.016) });
    // the brow: a thin tapered stroke angled in (mad) over each eye
    const a = sd * mood.mad, bx = x, by = ey - er * 1.25;
    ctx.save(); ctx.translate(bx, by); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(-er * 1.05, er * 0.12); ctx.quadraticCurveTo(0, -er * 0.28, er * 1.05, -er * 0.06); ctx.lineTo(er * 0.95, er * 0.16); ctx.quadraticCurveTo(0, -er * 0.02, -er * 1.05, er * 0.12);
    ctx.fillStyle = P.brow; ctx.fill(); ctx.restore();
  }
  // beak: a short wedge, opens on a squawk
  const bx = fx + s * 0.02, by = ey + er * 1.45, bw = s * 0.075, bh = s * 0.05;
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(0.7, s * 0.014); ctx.strokeStyle = BEAK.line;
  ctx.beginPath(); ctx.moveTo(bx - bw, by); ctx.quadraticCurveTo(bx, by - bh * 0.9, bx + bw, by); ctx.lineTo(bx + bw * 0.1, by + bh * 0.5 - open * bh * 0.2); ctx.closePath(); ctx.fillStyle = BEAK.base; ctx.fill(); ctx.stroke();
  if (open > 0.05) { ctx.beginPath(); ctx.moveTo(bx - bw * 0.8, by + bh * 0.25); ctx.lineTo(bx + bw * 0.1, by + bh * (0.5 + open * 1.6)); ctx.lineTo(bx + bw * 0.8, by + bh * 0.25); ctx.closePath(); ctx.fillStyle = BEAK.lo; ctx.fill(); ctx.stroke(); }
  ctx.restore();
}

// o: { squash (-1 stretch .. 1 squash), look, open (beak), wing (0 tucked .. 1 spread), feet (true: standing), fire (bomb spark) }
export function drawStrikeChick(ctx, id, x, y, s, t, o = {}) {
  const P = PAL[id] || PAL.freeze, sq = clamp(o.squash || 0, -0.6, 0.8), lw = Math.max(0.8, s * 0.022);
  ctx.save();
  ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  if (o.flip) ctx.scale(-1, 1);
  if (o.shadow) contact(ctx, 0, s * 0.45, s * 0.34, s * 0.06, 0.25);
  // feet (standing) or tucked
  if (o.feet !== false) {
    ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = BEAK.line; ctx.lineWidth = s * 0.05;
    for (const sd of [-1, 1]) { const fx = sd * s * 0.1, fy = s * (0.42 - sq * 0.12); ctx.beginPath(); ctx.moveTo(fx, fy - s * 0.06); ctx.lineTo(fx, fy); ctx.moveTo(fx - s * 0.05, fy + s * 0.01); ctx.lineTo(fx + s * 0.06, fy + s * 0.01); ctx.stroke(); }
    ctx.strokeStyle = BEAK.base; ctx.lineWidth = s * 0.026;
    for (const sd of [-1, 1]) { const fx = sd * s * 0.1, fy = s * (0.42 - sq * 0.12); ctx.beginPath(); ctx.moveTo(fx, fy - s * 0.06); ctx.lineTo(fx, fy); ctx.moveTo(fx - s * 0.05, fy + s * 0.01); ctx.lineTo(fx + s * 0.06, fy + s * 0.01); ctx.stroke(); }
    ctx.restore();
  }
  ctx.save();
  ctx.translate(0, s * sq * 0.12);
  if (id === 'tornado' || id === 'decoy') crest(ctx, id, s * (1 - sq * 0.25), t, P, o.fire);
  // the far wing
  const wing = clamp(o.wing || 0, 0, 1);
  const wingAt = (sd) => {
    const wx = -sd * s * 0.3, wy = s * 0.04, a = sd * (0.3 + wing * 1.1);
    ctx.save(); ctx.translate(wx, wy); ctx.rotate(-a);
    const p = () => { ctx.beginPath(); ctx.ellipse(0, s * 0.08, s * 0.08, s * 0.16, 0, 0, TAU); };
    form(ctx, p, { d: s * 0.03, lo: P.lo, base: P.base, hi: P.hi, line: P.line, lw: lw * 0.9 });
    ctx.restore();
  };
  if (wing > 0.2) wingAt(1);
  form(ctx, () => bodyPath(ctx, id, s, sq, t), { d: s * 0.07, lo: P.lo, base: P.base, hi: P.hi, line: P.line, lw, hiK: 0.6,
    inner: (c) => { // a soft belly fluff, lighter
      c.globalAlpha *= 0.55; c.fillStyle = P.hi; c.beginPath(); c.ellipse(s * 0.04, s * 0.17, s * 0.17, s * 0.12, 0, 0, TAU); c.fill(); c.globalAlpha /= 0.55;
      if (id === 'decoy') { c.fillStyle = 'rgba(150,100,50,0.4)'; for (const [x2, y2, r] of [[-0.2, 0.1, 0.025], [0.22, 0.2, 0.02], [-0.08, 0.3, 0.018], [0.25, -0.05, 0.016]]) { c.beginPath(); c.arc(x2 * s, y2 * s, r * s, 0, TAU); c.fill(); } }
      if (id === 'glue') { c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.ellipse(-s * 0.2, -s * 0.22, s * 0.05, s * 0.09, -0.5, 0, TAU); c.fill(); }
    } });
  wingAt(-1);
  if (id !== 'tornado' && id !== 'decoy') crest(ctx, id, s * (1 - sq * 0.25), t, P, o.fire);
  face(ctx, id, s, t, P, o);
  if (id === 'decoy') crest(ctx, 'decoy', s, t, P); // the cap sits over the brow
  ctx.restore();
  ctx.restore();
}

// ---------------------------------------------------------------- world: the rider, the flight, the effects
function px(ctx, x, y, k, draw) { ctx.save(); ctx.translate(x, y); ctx.scale(1 / k, -1 / k); draw(); ctx.restore(); }
function zig(ctx, x0, y0, x1, y1, n, amp, R) {
  ctx.beginPath(); ctx.moveTo(x0, y0);
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  for (let i = 1; i < n; i++) { const f = i / n, o = (R() - 0.5) * 2 * amp; ctx.lineTo(x0 + dx * f + nx * o, y0 + dy * f + ny * o); }
  ctx.lineTo(x1, y1);
}
const rnd = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

// where the chick rides (world, y up): on the hen's back. hen = { x, y (her feet), s (her height, m), gy }
export function strikeSeat(hen) { return { x: hen.x + 0.16 * hen.s, y: hen.y + (0.86 * hen.s) * (hen.gy || 1) }; }
function nestSpot(hen) { return { x: hen.x - 0.42 * hen.s, y: hen.y + 0.14 * (hen.gy || 1) }; }
// the arc of the flight at u (0..1)
function arcAt(a, b, u) {
  const d = Math.hypot(b.x - a.x, b.y - a.y), h = 0.35 * d + 0.6;
  return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) + h * 4 * u * (1 - u) };
}

export function drawStrikeWorld(ctx, sim, k, t, hen) {
  const K = sim.stk;
  if (!K || !K.id) return;
  const cs = Math.min(0.95, Math.max(0.6, 40 / k)), S = cs * k; // the chick: 0.6 m, never under ~40 px (it must read on a phone)
  // glue patches (under everything else here)
  for (const P of K.glue) drawGoo(ctx, P, k, t);
  // tornado funnels, thunder chains
  for (const E of K.fx) {
    if (E.k === 'tornado') drawTwister(ctx, E, k, t);
    else if (E.k === 'thunder') drawChain(ctx, E, k, t);
    else if (E.k === 'freeze') drawFrost(ctx, E, k, t);
  }
  // goo on held eggs
  for (const id in K.held) {
    const H = K.held[id];
    if (H.cd > 0) continue;
    px(ctx, H.x, H.y, k, () => gooStrands(ctx, 0.3 * k, t, H.t));
  }
  // the decoy chick sits where the decoy egg is
  const D = sim.p2d;
  if (D && D.alive && sim.p2.decoy && sim.p2.decoy.stk) {
    const p = D.body.getPosition(), dc = sim.p2.decoy, blink = dc.t < 1.5 && Math.sin(t * 22) < -0.2;
    px(ctx, p.x, p.y, k, () => { ctx.globalAlpha = blink ? 0.5 : 1; ctx.rotate(-D.body.getAngle() * 0.6); drawStrikeChick(ctx, 'decoy', 0, -S * 0.02, S * 1.25, t, { feet: false, squash: Math.sin(t * 3) * 0.05, look: { x: 1, y: 0 } }); });
  }
  // rage: the fooled creatures fume
  if (K.rage > 0) for (const T of sim.stkTargets()) px(ctx, T.x, T.y + 0.45, k, () => rageMark(ctx, S * 0.5, t + T.x));
  if (!hen || !K.on) return;
  const seat = strikeSeat(hen), gy = hen.gy || 1, F = K.fly;
  if (!F) { // riding: bobs with her, looks around; full: it stands up tall and flaps
    const full = K.m >= 1, b = Math.sin(t * (full ? 7 : 2.2)) * (full ? 0.06 : 0.025);
    px(ctx, seat.x, seat.y + S * 0.36 / k * gy, k, () => drawStrikeChick(ctx, K.id, 0, 0, S * 0.8, t, { flip: true, squash: b, wing: full ? 0.5 + 0.5 * Math.sin(t * 14) : 0, look: { x: 0.6, y: -0.2 } }));
    return;
  }
  const tgt = { x: F.tx, y: F.ty };
  if (F.ph === 'hop') { // crouch on her back, hop down by the nest, squash on landing
    const u = clamp(F.t / FLIGHT.hop, 0, 1), sp = nestSpot(hen);
    let x, y, sq, rot = 0;
    if (u < 0.3) { x = seat.x; y = seat.y; sq = ss(0, 0.3, u) * 0.5; }
    else if (u < 0.72) { const v = (u - 0.3) / 0.42; x = lerp(seat.x, sp.x, v); y = lerp(seat.y, sp.y, v) + 0.5 * 4 * v * (1 - v) * gy; sq = -0.35 * Math.sin(v * Math.PI); rot = -0.4 * v; }
    else { const v = (u - 0.72) / 0.28; x = sp.x; y = sp.y; sq = 0.6 * (1 - v) + 0.3 * v; }
    px(ctx, x, y + S * 0.36 / k * gy, k, () => drawStrikeChick(ctx, K.id, 0, 0, S, t, { flip: tgt.x < x, squash: sq, rot, wing: u > 0.3 && u < 0.72 ? 1 : 0.2, look: { x: 1, y: -0.4 } }));
    return;
  }
  // the flight: a streak behind, the chick stretched along its path, beak open (squawk)
  const a = nestSpot(hen), u = clamp(F.t / FLIGHT.fly, 0, 1), ue = Math.pow(u, 1.15), p = arcAt(a, tgt, ue), q = arcAt(a, tgt, Math.min(1, ue + 0.02));
  const ang = Math.atan2(q.y - p.y, q.x - p.x), col = STRIKE[K.id].col;
  ctx.save(); ctx.lineCap = 'round';
  for (let j = 10; j >= 1; j--) {
    const u0 = Math.max(0, ue - j * 0.028), u1 = Math.max(0, ue - (j - 1) * 0.028), p0 = arcAt(a, tgt, u0), p1 = arcAt(a, tgt, u1), f = 1 - j / 11;
    ctx.globalAlpha = 0.85 * f; ctx.strokeStyle = col[0]; ctx.lineWidth = (S * 0.5 * f) / k; ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    ctx.globalAlpha = 0.9 * f; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = (S * 0.16 * f) / k; ctx.stroke();
  }
  ctx.restore();
  px(ctx, p.x, p.y, k, () => {
    ctx.rotate(-ang);
    drawStrikeChick(ctx, K.id, 0, 0, S * 1.05, t, { squash: -0.35, feet: false, wing: 1, open: 1, look: { x: 1, y: 0 }, rot: Math.PI / 2 * 0 });
  });
}

function drawGoo(ctx, P, k, t) {
  const a = Math.min(1, P.t / 0.6, (P.max - P.t) / 0.25 + 0.3), r = P.r;
  ctx.save(); ctx.globalAlpha *= a;
  ctx.beginPath();
  for (let i = 0; i <= 16; i++) { const an = (i / 16) * TAU, w = r * (0.85 + 0.15 * Math.sin(an * 3 + t * 2) + 0.08 * Math.sin(an * 5 - t)); if (i) ctx.lineTo(P.x + Math.cos(an) * w, P.y + Math.sin(an) * w * 0.8); else ctx.moveTo(P.x + Math.cos(an) * w, P.y + Math.sin(an) * w * 0.8); }
  ctx.closePath();
  ctx.fillStyle = 'rgba(168,104,236,0.72)'; ctx.fill();
  ctx.lineWidth = 1.6 / k; ctx.strokeStyle = '#5a2a92'; ctx.stroke();
  ctx.fillStyle = 'rgba(236,214,255,0.8)'; ctx.beginPath(); ctx.ellipse(P.x - r * 0.3, P.y + r * 0.25, r * 0.22, r * 0.09, 0.3, 0, TAU); ctx.fill();
  for (let i = 0; i < 3; i++) { const u = (t * 0.7 + i / 3) % 1, bx = P.x + (hash(i + 3) - 0.5) * r, by = P.y + (hash(i + 7) - 0.5) * r * 0.6; ctx.globalAlpha = a * Math.sin(u * Math.PI) * 0.9; ctx.beginPath(); ctx.arc(bx, by, r * 0.07 * (0.5 + u), 0, TAU); ctx.strokeStyle = '#f0dcff'; ctx.lineWidth = 1.2 / k; ctx.stroke(); }
  ctx.restore();
}
function gooStrands(ctx, s, t, left) {
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * s * 0.28, sag = s * (0.35 + 0.12 * Math.sin(t * 3 + i));
    ctx.beginPath(); ctx.moveTo(x, -s * 0.3); ctx.quadraticCurveTo(x + s * 0.08, sag * 0.4, x - s * 0.02, sag);
    ctx.strokeStyle = '#7a3fc0'; ctx.lineWidth = s * 0.12; ctx.stroke(); ctx.strokeStyle = '#d4a8ff'; ctx.lineWidth = s * 0.06; ctx.stroke();
    ctx.fillStyle = '#c08af6'; ctx.beginPath(); ctx.arc(x - s * 0.02, sag, s * 0.07, 0, TAU); ctx.fill();
  }
  if (left < 0.6) { ctx.globalAlpha = 0.8; ctx.fillStyle = '#ecd6ff'; ctx.beginPath(); ctx.arc(0, -s * 0.5, s * 0.08 * (1 + Math.sin(t * 20)), 0, TAU); ctx.fill(); }
  ctx.restore();
}
function rageMark(ctx, s, t) { // a throbbing anger vein
  const p = 1 + 0.18 * Math.max(0, Math.sin(t * 12));
  ctx.save(); ctx.scale(p, p); ctx.lineCap = 'round'; ctx.strokeStyle = '#e8302a'; ctx.lineWidth = s * 0.14;
  for (const [a, b] of [[0, 1], [Math.PI / 2, 1], [Math.PI, 1], [-Math.PI / 2, 1]]) { const c = Math.cos(a), d = Math.sin(a); ctx.beginPath(); ctx.moveTo(c * s * 0.12 - d * s * 0.2, d * s * 0.12 + c * s * 0.2); ctx.quadraticCurveTo(c * s * 0.32 * b, d * s * 0.32 * b, c * s * 0.12 + d * s * 0.2, d * s * 0.12 - c * s * 0.2); ctx.stroke(); }
  ctx.restore();
}
function drawTwister(ctx, E, k, t) {
  const u = 1 - E.t / E.max, a = Math.min(1, E.t / 0.35, u / 0.12);
  ctx.save(); ctx.globalAlpha *= a; ctx.lineCap = 'round';
  const H = 1.9, x0 = E.x, y0 = E.y - 0.2;
  for (let i = 0; i < 9; i++) {
    const v = i / 8, y = y0 + v * H, w = 0.12 + v * v * 0.75, ph = t * 11 + i * 0.9;
    ctx.strokeStyle = i % 2 ? 'rgba(220,255,245,0.85)' : 'rgba(110,200,180,0.75)'; ctx.lineWidth = (2.6 + v * 2.5) / k;
    ctx.beginPath(); ctx.ellipse(x0 + Math.sin(t * 5 + v * 3) * 0.12 * v, y, w, w * 0.22, 0, ph % TAU, (ph % TAU) + 4.2); ctx.stroke();
  }
  for (let i = 0; i < 6; i++) { const v = (t * 1.6 + i / 6) % 1, an = t * 9 + i * 2.1, r = 0.15 + v * 0.7; ctx.fillStyle = '#5a8a6a'; ctx.globalAlpha = a * (1 - v); ctx.beginPath(); ctx.ellipse(x0 + Math.cos(an) * r, y0 + v * H, 0.05, 0.025, an, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function drawChain(ctx, E, k, t) {
  const f = E.t / E.max, R = rnd(Math.floor(t * 18) + 7), pts = E.pts || [{ x: E.x, y: E.y }];
  ctx.save(); ctx.globalAlpha *= Math.min(1, f * 1.6);
  zig(ctx, pts[0].x + (R() - 0.5) * 1.5, pts[0].y + 6, pts[0].x, pts[0].y, 10, 0.3, R); boltStroke(ctx, Math.max(0.03, 2.4 / k), 1);
  for (let i = 1; i < pts.length; i++) { zig(ctx, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, 7, 0.22, R); boltStroke(ctx, Math.max(0.022, 1.6 / k), 1); }
  ctx.restore();
}
function drawFrost(ctx, E, k, t) {
  const u = 1 - E.t / E.max; if (u > 0.25) return;
  const a = 1 - u / 0.25;
  ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = '#e6f8ff'; ctx.lineWidth = 2 / k; ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) { const an = (i / 8) * TAU + 0.3, r0 = 0.3 + u * 2, r1 = r0 + 0.35; ctx.beginPath(); ctx.moveTo(E.x + Math.cos(an) * r0, E.y + Math.sin(an) * r0); ctx.lineTo(E.x + Math.cos(an) * r1, E.y + Math.sin(an) * r1); ctx.stroke(); }
  ctx.restore();
}

// ---------------------------------------------------------------- events -> feel, SFX, VFX
// api: { audio, popup, once, sim, hitStop(s), punch(amt, x, y), slow(left, scale) }
export function strikeEvent(ev, fx, api) {
  const { audio, popup, once } = api;
  switch (ev.type) {
    case 'stkReady': audio.play('cluck', { pitch: 2.6, vol: 0.45 }); return true;
    case 'stkFire': api.slow(0.3, 0.4); audio.play('hen_hop', { pitch: 1.6, vol: 0.6 }); return true;
    case 'stkLaunch': {
      audio.play('cluck', { intensity: 1, pitch: 1.75 }); audio.play('wind_gust', { vol: 0.35, pitch: 2.2 });
      fx.whoosh(ev.x, ev.y, ev.tx - ev.x, ev.ty - ev.y);
      fx.dust(ev.x, ev.y - 0.1, 6);
      return true;
    }
    case 'stkHit': {
      const S = STRIKE[ev.id], col = S ? S.col : ['#fff', '#fff', '#fff'];
      if (ev.miss) { audio.play('bubble_pop', { pitch: 0.8 }); popup(ev.x, ev.y + 0.5, 'Missed!', { color: '#ffe0b0', size: 18 }); return true; }
      api.hitStop(ev.boss ? 0.12 : 0.08); api.punch(ev.boss ? 0.09 : 0.06, ev.x, ev.y); fx.kick(ev.boss ? 0.55 : 0.4);
      fx.impact(ev.x, ev.y, 0.6, col[2]);
      if (ev.id === 'freeze') { audio.play('glass_crack', { pitch: 0.75 }); audio.play('glass_break', { vol: 0.5, pitch: 1.3 }); fx.wave(ev.x, ev.y, 1.4, '#dff6ff', 0.5, 0.14); fx.chips(ev.x, ev.y, '#cfefff', 12, 3); fx.sparkle(ev.x, ev.y, 10, '#ffffff'); }
      else if (ev.id === 'thunder') { audio.play('thunder', { vol: 0.8, pitch: 1.2 }); fx.flash = 0.35; fx.flashColor = '#fff6c0'; fx.sparkle(ev.x, ev.y, 14, '#fff27a'); }
      else if (ev.id === 'bomb') { audio.play('bomb_explode'); fx.explosion(ev.x, ev.y, 0.9); }
      else if (ev.id === 'decoy') { audio.play('hen_land', { pitch: 1.6 }); fx.dust(ev.x, ev.y, 8); }
      else if (ev.id === 'tornado') { audio.play('wind_gust', { vol: 0.9, pitch: 1.1 }); fx.wave(ev.x, ev.y, 1.1, '#dcfff4', 0.5, 0.12); }
      else if (ev.id === 'glue') { audio.play('squish', { intensity: 1, pitch: 0.7 }); fx.burst(ev.x, ev.y, 12, (i, a, b) => ({ x: ev.x, y: ev.y, vx: (a - 0.5) * 5, vy: b * 4, g: 9, life: 0.6 + b * 0.4, size: 0.05 + a * 0.05, color: i % 2 ? '#c08af6' : '#8a52cc', type: 'drop', floor: ev.y - 0.3 })); }
      if (ev.cancel) popup(ev.x, ev.y + 0.8, ev.hurt ? 'Interrupted! Hit!' : 'Interrupted!', { color: '#ffd76a', size: 22 });
      else if (ev.id !== 'freeze') popup(ev.x, ev.y + 0.7, { freeze: '', thunder: 'Thunderstruck!', bomb: 'Boom!', decoy: 'Peep?', tornado: 'Whirled away!', glue: 'Glued!' }[ev.id] || '', { color: col[2], size: 20 });
      return true;
    }
    case 'stkIcy': once('stkIcy', 'Frost Chick: the rings near it are icy for a while. Eggs slide!', 3); return true;
    case 'stkJolt': fx.sparkle(ev.x, ev.y, 5, '#fff27a'); once('stkJolt', 'Thunder Chick: eggs near the bolt got a jolt.', 2.6); return true;
    case 'stkShove': fx.dust(ev.x, ev.y, 3); return true;
    case 'stkBlast': if (ev.thorns) popup(ev.x, ev.y - 0.5, `${ev.thorns} thorn${ev.thorns > 1 ? 's' : ''} gone`, { color: '#ffc18a', size: 16 }); once('stkShove', 'Boom Chick: the shockwave shoves your eggs too.', 2.6); return true;
    case 'stkRage': audio.play('thorn_hit', { pitch: 0.6, vol: 0.6 }); popup(ev.x, ev.y + 0.6, 'They noticed!', { color: '#ff7a5a', size: 20 }); once('stkRage', 'Decoy Chick: the fooled creatures are furious and rush for a while.', 3); return true;
    case 'stkSpin': audio.play('wind_gust', { vol: 0.5, pitch: 1.5 }); once('stkSpin', 'Twister Chick: the nearest ring got spun round.', 2.6); return true;
    case 'stkStick': audio.play('squish', { pitch: 1.3, vol: 0.6 }); popup(ev.x, ev.y + 0.45, 'Stuck!', { color: '#d4a8ff', size: 15, life: 0.8 }); return true;
    case 'stkUnstick': audio.play('bubble_pop', { pitch: 1.2, vol: 0.5 }); return true;
  }
  return false;
}

// ---------------------------------------------------------------- the HUD button
// st: { id, m (0..1), busy, t, fullT (when it filled), wobT (last "not yet" tap), pressed, calm }
export function drawStrikeButton(ctx, x, y, d, st) {
  const id = st.id, col = STRIKE[id].col, full = st.m >= 1 && !st.busy, t = st.t, r = d / 2;
  let sc = 1, rot = 0;
  if (!st.calm) {
    if (full) { const p = ((t - (st.fullT || 0)) % 1.2 + 1.2) % 1.2; sc = 1 + 0.11 * Math.exp(-5 * p) * Math.sin(p * 17) * (p < 0.7 ? 1 : 0); }
    const w = t - (st.wobT ?? -9); if (w < 0.55) rot = 0.22 * Math.exp(-7 * w) * Math.sin(w * 34);
    if (st.pressed) sc *= 0.92;
  }
  const cx = x + r, cy = y + r;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(sc, sc);
  // drop shadow and the rim
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, r * 0.1, r * 0.98, r * 0.98, 0, 0, TAU); ctx.fill();
  const g = ctx.createLinearGradient(0, -r, 0, r); g.addColorStop(0, '#5a3c26'); g.addColorStop(1, '#2c1a10');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  // the well the chick sits in
  const ri = r * 0.74, g2 = ctx.createRadialGradient(-ri * 0.3, -ri * 0.4, ri * 0.1, 0, 0, ri);
  g2.addColorStop(0, full ? '#fff3c4' : '#e9dcc4'); g2.addColorStop(1, full ? '#f0b54a' : '#a88e70');
  ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(0, 0, ri, 0, TAU); ctx.fill();
  // the ring: a track, the charge clockwise from the top (gold when full)
  const rr = r * 0.87, lw = r * 0.17;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(20,10,4,0.55)'; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke();
  const m = clamp(st.m, 0, 1);
  if (m > 0.005) {
    ctx.strokeStyle = full ? '#ffcf3a' : col[0]; ctx.lineWidth = lw * 0.78;
    ctx.beginPath(); ctx.arc(0, 0, rr, -Math.PI / 2, -Math.PI / 2 + TAU * m); ctx.stroke();
    ctx.strokeStyle = full ? '#fff6c8' : col[2]; ctx.lineWidth = lw * 0.26; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.arc(0, 0, rr - lw * 0.12, -Math.PI / 2, -Math.PI / 2 + TAU * m); ctx.stroke(); ctx.globalAlpha = 1;
  }
  if (full && !st.calm) { // a glint travels round the gold ring
    const a = -Math.PI / 2 + ((t * 1.4) % 1) * TAU;
    ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, lw * 0.32, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  }
  // the chick
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, ri, 0, TAU); ctx.clip();
  if (st.busy) ctx.globalAlpha = 0.35;
  drawStrikeChick(ctx, id, 0, ri * 0.12, ri * 1.45, t, { feet: false, squash: full ? Math.sin(t * 8) * 0.05 : 0, look: { x: 0.5, y: 0.2 }, wing: full ? 0.4 : 0 });
  ctx.restore();
  if (!full && !st.busy) { // dim it a touch while it charges
    ctx.fillStyle = `rgba(30,18,8,${0.32 * (1 - m)})`; ctx.beginPath(); ctx.arc(0, 0, ri, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the intro picker and the unlock card
// a token: the chick in a little round frame; sel: the one equipped
export function drawStrikeToken(ctx, id, cx, cy, r, t, sel) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.arc(cx, cy + r * 0.08, r, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r);
  g.addColorStop(0, sel ? '#fff3c4' : '#f4e6cc'); g.addColorStop(1, sel ? '#f0b54a' : '#cdb48e');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  ctx.lineWidth = sel ? r * 0.14 : r * 0.07; ctx.strokeStyle = sel ? '#e8962a' : 'rgba(110,74,42,0.6)'; ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r * 0.94, 0, TAU); ctx.clip();
  drawStrikeChick(ctx, id, cx, cy + r * 0.16, r * 1.5, sel ? t : 0.4, { feet: false, squash: sel ? Math.sin(t * 6) * 0.04 : 0, fire: true });
  ctx.restore();
  ctx.restore();
}
export function drawStrikeStage(ctx, id, x, y, w, h, t) {
  const s = h * 0.82, u = (t % 1.6) / 1.6, hop = Math.max(0, Math.sin(u * TAU)) * h * 0.08, sq = u > 0.5 ? 0.25 * Math.exp(-(u - 0.5) * 18) : -0.1 * Math.sin(u * TAU);
  contact(ctx, x + w / 2, y + h * 0.9, s * 0.3, s * 0.05, 0.3);
  drawStrikeChick(ctx, id, x + w / 2, y + h * 0.48 - hop, s, t, { squash: sq, wing: hop > 2 ? 0.8 : 0.1, look: { x: 0.2, y: 0.3 }, fire: true });
}
export { STRIKES };
