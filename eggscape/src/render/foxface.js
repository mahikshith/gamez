// The fox's face (v3.5 redesign): ONE fox everywhere. A sly, cunning villain in the house cel style: a narrow muzzle,
// angular cheek tufts, half-lidded clever eyes with slit pupils, a smirk that shows one fang, tall ears with dark
// tips. The full-body den fox (foxden.js) wears the same face in profile; drawFox (characters.js), the fox actor
// (sprites.js), the boss cards and the Fox King all call this.
//
// drawFoxFace(ctx, cx, cy, s, mood, t, o): local y-DOWN space, s = head width (tuft to tuft) in px, centred on the
// head. Moods: idle smug evil laugh shocked cry angry. o: {look: {x, y} -1..1, bust: true (neck and chest ruff
// under the head, for cards), crown: true (the Fox King), calm: true (no idle motion)}.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const fract = (x) => x - Math.floor(x);
// the palette (the same orange, cream and dark as ever; characters.js re-exports it as FOX)
export const FOX = {
  fur: '#ef7a24', furHi: '#ffa04a', furLo: '#c9520f', line: '#5a240b',
  cream: '#fff4e6', creamLo: '#f1d9bd', dark: '#3a1608', earIn: '#6b2c12',
  iris: '#b0641c', irisEvil: '#ffd02a', pupil: '#1d0b04', mouth: '#4a0f0a', tongue: '#ff6f7a',
};
export const FACE = { ...FOX, fur: '#e9671c', furHi: '#f98d3c', furLo: '#b8450e', mask: '#8a2f0a', iris: '#ffc21f', irisLo: '#e08a0c', lid: '#c9520f' };

// per mood: lid (0 open .. 1 shut, the upper lid's flat line), brow tilt (+ = inner end down: cunning), raise (one brow up),
// mouth kind, ears (0 up .. 1 drooped / flattened back), eye width scale
const MOODS = {
  idle: { lid: 0.3, brow: 0.35, raise: 0, mouth: 'smirk', ears: 0, eye: 1 },
  smug: { lid: 0.4, brow: 0.4, raise: 1, mouth: 'smirk', ears: 0, eye: 1 },
  evil: { lid: 0.42, brow: 1, raise: 0, mouth: 'grin', ears: 0.2, eye: 1, shade: 1 },
  angry: { lid: 0.3, brow: 1.1, raise: 0, mouth: 'snarl', ears: 0.75, eye: 1, shade: 1 },
  laugh: { closed: 'happy', brow: 0.1, raise: 0, mouth: 'laugh', ears: 0.05, eye: 1 },
  shocked: { lid: 0, brow: -0.9, raise: 0, mouth: 'o', ears: -0.1, eye: 1.25, small: 1 },
  cry: { closed: 'squeeze', brow: -1, raise: 0, mouth: 'wail', ears: 0.9, eye: 1, tears: 1 },
};

function blink(t) { const p = (t + 0.7) % 3.9; return p < 0.16 ? Math.sin((p / 0.16) * Math.PI) : 0; }

export function drawFoxFace(ctx, cx, cy, s, mood = 'idle', t = 0, o = {}) {
  if (!(s > 0)) return;
  const m = MOODS[mood] || MOODS.idle, C = FACE;
  const look = o.look || { x: 0, y: 0 };
  ctx.save();
  try {
    ctx.translate(cx, cy);
    ctx.scale(s / 100, s / 100);
    const ow = Math.max(3, 120 / s); // outline (units): ~1.2 px at the smallest
    let by = 0, rot = 0, bx = 0;
    if (!o.calm) {
      if (mood === 'laugh') { by = -Math.abs(Math.sin(t * 9)) * 4 + 2; rot = Math.sin(t * 9) * 0.05; }
      else if (mood === 'evil') { by = Math.sin(t * 7) * 1.2; rot = -0.05 + Math.sin(t * 1.3) * 0.03; }
      else if (mood === 'angry') bx = Math.sin(t * 38) * 0.8;
      else if (mood === 'shocked') by = -1 + Math.sin(t * 30) * 0.4;
      else if (mood === 'cry') { by = Math.abs(Math.sin(t * 10)) * 2.5 + 1; rot = Math.sin(t * 10) * 0.025; }
      else { by = Math.sin(t * 2.2) * 0.8; rot = (mood === 'smug' ? -0.06 : -0.03) + Math.sin(t * 0.9) * 0.02; }
    }
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (o.bust) bust(ctx, C, ow, t);
    ctx.translate(bx, by);
    ctx.rotate(rot);
    const tw = o.calm ? 0 : earTwitch(t);
    ear(ctx, C, -1, ow, m.ears, tw * 0.5);
    ear(ctx, C, 1, ow, m.ears, tw);
    // head: outline pass then fill
    const head = (c) => { c.beginPath(); headHalf(c, -1); headHalf(c, 1, true); c.closePath(); };
    head(ctx);
    ctx.lineWidth = 2 * ow; ctx.strokeStyle = C.line; ctx.stroke();
    ctx.fillStyle = C.fur; ctx.fill();
    ctx.save();
    head(ctx); ctx.clip();
    // two-tone: the darker side of the face (light from upper left), then the cream lower face and cheek tufts
    ctx.fillStyle = C.furLo;
    ctx.beginPath(); ctx.moveTo(22, -40); ctx.quadraticCurveTo(34, -24, 30, -4); ctx.lineTo(62, -4); ctx.lineTo(62, -40); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.furHi;
    ctx.beginPath(); ctx.moveTo(-26, -30); ctx.quadraticCurveTo(-12, -38, 4, -34); ctx.quadraticCurveTo(-10, -30, -22, -22); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.cream;
    ctx.beginPath();
    [[-62, -3], [-38, 3], [-46, 13], [-26, 10], [-16, 3], [-6, 7], [0, 12], [6, 7], [16, 3], [26, 10], [46, 13], [38, 3], [62, -3], [62, 70], [-62, 70]]
      .forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.creamLo;
    ctx.beginPath(); ctx.moveTo(4, 30); ctx.quadraticCurveTo(14, 26, 22, 18); ctx.lineTo(30, 30); ctx.lineTo(4, 56); ctx.closePath(); ctx.fill();
    // the orange bridge of the muzzle, down to the nose
    ctx.fillStyle = C.fur;
    ctx.beginPath(); ctx.moveTo(-7, 0); ctx.quadraticCurveTo(-4, 20, -2.5, 30); ctx.lineTo(2.5, 30); ctx.quadraticCurveTo(4, 20, 7, 0); ctx.closePath(); ctx.fill();
    // a mask of shadow over the brow when it means harm
    if (m.shade) {
      const g = ctx.createLinearGradient(0, -36, 0, 0);
      g.addColorStop(0, 'rgba(70,10,20,0.45)'); g.addColorStop(1, 'rgba(70,10,20,0)');
      ctx.fillStyle = g; ctx.fillRect(-60, -40, 120, 40);
    }
    ctx.restore();
    // eyes, brows, nose, mouth
    const bl = o.calm ? 0 : blink(t);
    for (const sx of [-1, 1]) eye(ctx, C, sx, m, ow, look, bl, t);
    for (const sx of [-1, 1]) brow(ctx, C, sx, m, ow);
    ctx.save(); ctx.translate(0, 30); ctx.scale(1.25, 1.25); ctx.translate(0, -34);
    nose(ctx, C, ow / 1.25);
    mouth(ctx, C, m, ow / 1.25, t);
    ctx.restore();
    if (m.tears) tears(ctx, ow, t);
    if (o.crown) crown(ctx, ow, t);
  } catch (e) { /* art never breaks the frame */ }
  ctx.restore();
}
function earTwitch(t) { const k = Math.floor(t / 2.7), f = fract(t / 2.7); return fract(Math.sin(k * 91.7) * 4375.5) > 0.55 ? Math.sin(clamp((f - 0.4) / 0.07, 0, 1) * Math.PI) : 0; }

// half the head, sx = -1 left, 1 right: forehead, temple, two angular cheek tufts, jaw, a narrow muzzle to the chin
function headHalf(c, sx, rev = false) {
  const P = [[0, -38], [16, -37], [30, -30], [38, -16], [41, -4], [56, -2], [44, 6], [52, 15], [36, 15], [38, 22], [24, 22], [15, 36], [8, 48], [0, 52]];
  const pts = rev ? [...P].reverse() : P;
  pts.forEach(([x, y], i) => (i || rev ? c.lineTo(sx * x, y) : c.moveTo(sx * x, y)));
}
// tall pointed ears leaning out, dark backs at the tip, dark inner with cream fluff
function ear(ctx, C, sx, ow, droop, tw) {
  ctx.save();
  ctx.translate(sx * 24, -28);
  ctx.rotate(sx * (0.32 + droop * 0.9 + tw * 0.08));
  const path = () => { ctx.beginPath(); ctx.moveTo(-sx * 14, 8); ctx.quadraticCurveTo(-sx * 10, -20, sx * 2, -44); ctx.quadraticCurveTo(sx * 12, -18, sx * 15, 6); ctx.closePath(); };
  path(); ctx.lineWidth = 2 * ow; ctx.strokeStyle = C.line; ctx.stroke(); ctx.fillStyle = C.fur; ctx.fill();
  ctx.save(); path(); ctx.clip();
  ctx.fillStyle = C.dark; ctx.fillRect(-20, -50, 40, 24);
  ctx.fillStyle = C.earIn;
  ctx.beginPath(); ctx.moveTo(-sx * 8, 8); ctx.quadraticCurveTo(-sx * 5, -14, sx * 2, -32); ctx.quadraticCurveTo(sx * 7, -12, sx * 9, 8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.cream;
  ctx.beginPath(); ctx.moveTo(-sx * 9, 9); ctx.lineTo(-sx * 4, -6); ctx.lineTo(-sx * 1, 2); ctx.lineTo(sx * 3, -10); ctx.lineTo(sx * 5, 1); ctx.lineTo(sx * 10, 9); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
}
// almond eyes tilted up at the outer corner, gold iris, slit pupil, a heavy flat upper lid, a dark liner flick
function eye(ctx, C, sx, m, ow, look, bl, t) {
  ctx.save();
  ctx.translate(sx * 17, -6);
  ctx.scale(sx, 1);
  ctx.rotate(-0.32);
  const W = 12.5 * m.eye, H = 7 * m.eye;
  if (m.closed === 'happy') { ctx.strokeStyle = C.line; ctx.lineWidth = ow * 1.1; ctx.beginPath(); ctx.moveTo(-W, 2); ctx.quadraticCurveTo(0, -8, W, 1); ctx.stroke(); ctx.restore(); return; }
  if (m.closed === 'squeeze') { ctx.strokeStyle = C.line; ctx.lineWidth = ow * 1.1; ctx.beginPath(); ctx.moveTo(-W, -1); ctx.quadraticCurveTo(0, 4, W, -2); ctx.moveTo(W * 0.4, -5); ctx.lineTo(W, -2); ctx.stroke(); ctx.restore(); return; }
  const shape = () => { ctx.beginPath(); ctx.moveTo(-W, 1.5); ctx.quadraticCurveTo(-2, -H * 1.5, W, -1); ctx.quadraticCurveTo(2, H * 1.25, -W, 1.5); ctx.closePath(); };
  shape(); ctx.fillStyle = '#fffbe8'; ctx.fill();
  ctx.save(); shape(); ctx.clip();
  const lx = clamp(look.x * sx, -1, 1) * 3.5 + 1.5, ly = 1 + clamp(look.y, -1, 1) * 1.5, R = m.small ? 5 : 6.4;
  const g = ctx.createRadialGradient(lx - 1, ly - 2, 0.5, lx, ly, R);
  g.addColorStop(0, C.iris); g.addColorStop(1, C.irisLo);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, R, 0, TAU); ctx.fill();
  ctx.fillStyle = C.pupil; ctx.beginPath(); ctx.ellipse(lx, ly, m.small ? 1.1 : 1.7, R * 0.88, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(lx + 2, ly - 2.4, 1.3, 0, TAU); ctx.fill();
  // the upper lid comes down flat (half-lidded); a blink closes it
  const lid = clamp(Math.max(m.lid || 0, bl), 0, 1);
  if (lid > 0.02) { const ly0 = -H * 1.4 + lid * H * 2.2; ctx.fillStyle = C.lid; ctx.fillRect(-W - 2, -H * 2, 2 * W + 4, ly0 + H * 2); ctx.restore(); ctx.strokeStyle = C.line; ctx.lineWidth = ow * 1.2; ctx.beginPath(); ctx.moveTo(-W, Math.max(-H * 0.6, ly0 + 1.6)); ctx.lineTo(W + 1, ly0 - 0.6); ctx.stroke(); ctx.save(); }
  ctx.restore();
  ctx.strokeStyle = C.line; ctx.lineWidth = ow * 0.9; shape(); ctx.stroke();
  // liner flick at the outer corner
  ctx.lineWidth = ow * 1.1; ctx.beginPath(); ctx.moveTo(W - 2, -1.5); ctx.lineTo(W + 5, -4.5); ctx.stroke();
  ctx.restore();
}
function brow(ctx, C, sx, m, ow) {
  const up = m.raise && sx > 0 ? 7 : 0, b = m.brow;
  const xi = sx * 7, yi = -18 + b * 5 - up * 0.6, xo = sx * 30, yo = -24 - b * 3 - up;
  ctx.fillStyle = C.dark;
  ctx.beginPath();
  ctx.moveTo(xi, yi + 1.8); ctx.quadraticCurveTo((xi + xo) / 2, (yi + yo) / 2 - 3 - (b < 0 ? 3 : 0), xo, yo); ctx.quadraticCurveTo((xi + xo) / 2, (yi + yo) / 2 + 1, xi, yi + 5.4); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = C.dark; ctx.lineWidth = ow * 0.5; ctx.stroke();
}
function nose(ctx, C, ow) {
  ctx.fillStyle = '#1d0b04';
  ctx.beginPath(); ctx.moveTo(-6, 31); ctx.quadraticCurveTo(0, 28, 6, 31); ctx.quadraticCurveTo(4, 36, 0, 37.5); ctx.quadraticCurveTo(-4, 36, -6, 31); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(-1.8, 31, 1.6, 0.9, 0, 0, TAU); ctx.fill();
}
function fang(ctx, x, y, h, ow) { ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#5a240b'; ctx.lineWidth = ow * 0.45; ctx.beginPath(); ctx.moveTo(x - 1.8, y); ctx.lineTo(x + 1.8, y); ctx.lineTo(x + 0.2, y + h); ctx.closePath(); ctx.fill(); ctx.stroke(); }
function mouth(ctx, C, m, ow, t) {
  ctx.strokeStyle = C.line; ctx.lineWidth = ow * 0.9;
  ctx.beginPath(); ctx.moveTo(0, 37.5); ctx.lineTo(0, 40); ctx.stroke();
  switch (m.mouth) {
    case 'smirk': { // lopsided: the right corner hooks up and a fang peeks out under it
      ctx.beginPath(); ctx.moveTo(-9, 41); ctx.quadraticCurveTo(-3, 44, 0, 40); ctx.quadraticCurveTo(6, 43, 14, 36); ctx.stroke();
      ctx.lineWidth = ow * 0.7; ctx.beginPath(); ctx.moveTo(12.5, 34); ctx.quadraticCurveTo(15.5, 35, 15, 38.5); ctx.stroke();
      fang(ctx, 8.5, 41.2, 5.6, ow);
      break;
    }
    case 'grin': case 'snarl': { // a wide sharp grin full of teeth (snarl: lips pulled flatter)
      const w = m.mouth === 'grin' ? 15 : 13, d = m.mouth === 'grin' ? 7 : 5;
      const p = () => { ctx.beginPath(); ctx.moveTo(-w, 36); ctx.quadraticCurveTo(0, 42 + d * 0.2, w, 34); ctx.quadraticCurveTo(0, 42 + d, -w, 36); ctx.closePath(); };
      p(); ctx.fillStyle = C.mouth; ctx.fill();
      ctx.save(); p(); ctx.clip();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); for (let i = -3; i <= 3; i++) { const x = i * (w / 3.6); ctx.moveTo(x - 2.4, 37); ctx.lineTo(x + 2.4, 37); ctx.lineTo(x, 41.5 + (Math.abs(i) === 2 ? 2 : 0)); } ctx.fill();
      ctx.restore();
      p(); ctx.lineWidth = ow * 0.9; ctx.stroke();
      break;
    }
    case 'laugh': {
      const open = 0.8 + 0.2 * Math.sin(t * 18);
      const p = () => { ctx.beginPath(); ctx.moveTo(-14, 38); ctx.quadraticCurveTo(0, 41, 14, 37); ctx.quadraticCurveTo(10, 38 + 16 * open, 0, 38 + 17 * open); ctx.quadraticCurveTo(-11, 38 + 16 * open, -14, 38); ctx.closePath(); };
      p(); ctx.fillStyle = C.mouth; ctx.fill();
      ctx.save(); p(); ctx.clip(); ctx.fillStyle = C.tongue; ctx.beginPath(); ctx.ellipse(0, 40 + 17 * open, 9, 7, 0, 0, TAU); ctx.fill(); ctx.restore();
      p(); ctx.stroke();
      fang(ctx, -8, 38.5, 4.4, ow); fang(ctx, 8, 38, 4.4, ow);
      break;
    }
    case 'o': ctx.fillStyle = C.mouth; ctx.beginPath(); ctx.ellipse(0, 44, 4.5, 6, 0, 0, TAU); ctx.fill(); ctx.stroke(); break;
    case 'wail': {
      const p = () => { ctx.beginPath(); ctx.moveTo(-12, 46); ctx.quadraticCurveTo(0, 34, 12, 46); ctx.quadraticCurveTo(0, 50, -12, 46); ctx.closePath(); };
      p(); ctx.fillStyle = C.mouth; ctx.fill(); ctx.stroke(); fang(ctx, -6, 40.5, 3.4, ow); fang(ctx, 6, 40.5, 3.4, ow);
      break;
    }
  }
}
function tears(ctx, ow, t) {
  ctx.fillStyle = '#7fd3ff'; ctx.strokeStyle = '#2f6f9e'; ctx.lineWidth = ow * 0.5;
  for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) {
    const f = fract(t * 1.3 + i * 0.5 + (sx > 0 ? 0.25 : 0)), x = sx * (16 + f * 10), y = -2 + f * 26;
    ctx.globalAlpha = 1 - f * 0.7; ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.quadraticCurveTo(x + 3.5, y + 1, x, y + 3); ctx.quadraticCurveTo(x - 3.5, y + 1, x, y - 4); ctx.fill(); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
// neck and chest ruff under the head (cards, intro portraits): a lean neck, a pointed cream bib, the dark collar line
function bust(ctx, C, ow, t) {
  const path = () => { ctx.beginPath(); ctx.moveTo(-26, 20); ctx.quadraticCurveTo(-34, 50, -60, 70); ctx.lineTo(60, 70); ctx.quadraticCurveTo(34, 50, 26, 20); ctx.closePath(); };
  path(); ctx.lineWidth = 2 * ow; ctx.strokeStyle = C.line; ctx.stroke(); ctx.fillStyle = C.fur; ctx.fill();
  ctx.save(); path(); ctx.clip();
  ctx.fillStyle = C.furLo; ctx.fillRect(10, 20, 60, 60);
  ctx.fillStyle = C.cream;
  ctx.beginPath(); ctx.moveTo(-22, 30); ctx.lineTo(-30, 72); ctx.lineTo(30, 72); ctx.lineTo(22, 30); ctx.lineTo(12, 46); ctx.lineTo(6, 36); ctx.lineTo(0, 52); ctx.lineTo(-6, 36); ctx.lineTo(-12, 46); ctx.closePath(); ctx.fill();
  ctx.restore();
  void t;
}
// the Fox King's crown: a gold crown tilted over one ear
function crown(ctx, ow, t) {
  ctx.save();
  ctx.translate(-4, -46);
  ctx.rotate(-0.14);
  const w = 40, h = 22;
  const p = () => { ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(-w / 2 - 2, -h * 0.8); ctx.lineTo(-w / 4, -h * 0.4); ctx.lineTo(0, -h); ctx.lineTo(w / 4, -h * 0.4); ctx.lineTo(w / 2 + 2, -h * 0.8); ctx.lineTo(w / 2, 0); ctx.closePath(); };
  p(); ctx.lineWidth = 2 * ow; ctx.strokeStyle = '#5a3008'; ctx.stroke();
  const g = ctx.createLinearGradient(0, -h, 0, 0); g.addColorStop(0, '#fff2a0'); g.addColorStop(1, '#e0a020');
  ctx.fillStyle = g; ctx.fill();
  ctx.fillStyle = '#c98a10'; ctx.fillRect(-w / 2, -5, w, 5);
  for (const [gx, col] of [[-w / 4, '#e8344a'], [0, '#3ad1ff'], [w / 4, '#e8344a']]) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(gx, -2.5, 2.8, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -h, 2.2, 0, TAU); ctx.fill();
  ctx.restore();
}
