// Character art: fox head, mama hen, hatched chick, snake. Pure Canvas 2D, no assets.
// Every function draws in a local y-DOWN space centred on (cx, cy); the caller flips if needed.
// Shapes are authored in a 100-unit box and scaled by s / 100.

import SNAKE_SHEET from '../../assets/ref/breaker-snake-head.webp';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mod = (a, b) => ((a % b) + b) % b;

// Outline width in 100-unit space: ~3 units, but never thinner than ~1.1 px on screen.
const outlineW = (s, base = 3.2) => Math.max(base, 110 / s);

// 0..1 eyelid closure: a quick blink every few seconds (seed staggers characters).
function blinkAt(t, seed = 0) {
  const period = 3.4 + seed * 0.9;
  const p = mod(t + seed * 1.7, period);
  const d = 0.17;
  return p < d ? Math.sin((p / d) * Math.PI) : 0;
}

// Mirror-symmetric shapes: build one half per side, fill as one path (no seam).
function symFill(ctx, half, fill) {
  ctx.beginPath();
  half(ctx, -1);
  ctx.closePath();
  half(ctx, 1);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
function symStroke(ctx, half) {
  ctx.beginPath();
  half(ctx, -1);
  half(ctx, 1);
  ctx.stroke();
}

// Little white specular glints for eyes.
function glint(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

/* ------------------------------------------------------------------ FOX */

const FOX = {
  fur: '#ef7a24', furHi: '#ffa04a', furLo: '#c9520f', line: '#5a240b',
  cream: '#fff4e6', creamLo: '#f1d9bd', dark: '#3a1608', earIn: '#6b2c12',
  iris: '#b0641c', irisEvil: '#ffd02a', pupil: '#1d0b04', mouth: '#4a0f0a', tongue: '#ff6f7a',
};

// Per-mood face settings. lid* = 0 open .. 1 closed; brow = [inner x,y, outer x,y, arch].
const FOX_MOODS = {
  idle: { lidIn: 0.12, lidOut: 0.1, lidBot: 0, eye: 1, pupil: 1, brow: [9, -24, 29, -25, -3] },
  smug: { lidIn: 0.46, lidOut: 0.52, lidBot: 0.18, eye: 1, pupil: 0.95, brow: [9, -21, 29, -22, -2], browR: [9, -27, 29, -32, -3], sly: 0.7 },
  evil: { lidIn: 0.62, lidOut: 0.22, lidBot: 0.22, eye: 1.06, pupil: 0.9, brow: [6, -13, 31, -28, 1], evil: true },
  laugh: { closed: true, brow: [9, -27, 29, -27, -5] },
  shocked: { lidIn: 0, lidOut: 0, lidBot: 0, eye: 1.2, pupil: 0.5, brow: [9, -33, 29, -32, -5] },
  cry: { squeeze: true, ears: 0.85, brow: [8, -34, 29, -25, -3] },
  angry: { lidIn: 0.55, lidOut: 0.18, lidBot: 0.14, eye: 1, pupil: 0.72, brow: [7, -13, 31, -25, 0] },
};

function foxHeadHalf(ctx, sx) {
  ctx.moveTo(0, -41);
  ctx.bezierCurveTo(sx * 24, -41, sx * 42, -33, sx * 46, -15);
  ctx.bezierCurveTo(sx * 48, -5, sx * 48, 2, sx * 54, 10); // temple to first cheek tuft
  ctx.quadraticCurveTo(sx * 47, 14, sx * 51, 21); // tuft 2
  ctx.quadraticCurveTo(sx * 43, 24, sx * 44, 31); // tuft 3
  ctx.bezierCurveTo(sx * 33, 40, sx * 16, 48, 0, 49); // jaw to chin
}

function foxEar(ctx, sx, t, o, drop = 0) {
  // twitch: a quick flick every few seconds, per ear
  const ph = mod(t * 0.31 + (sx > 0 ? 0.5 : 0), 1);
  const tw = ph < 0.07 ? Math.sin((ph / 0.07) * TAU) * 0.16 : 0;
  ctx.save();
  ctx.translate(sx * 30, -26 + drop * 5);
  ctx.rotate(sx * (tw * (1 - drop) + Math.sin(t * 1.6 + sx) * 0.02 + drop * (0.78 + Math.sin(t * 10) * 0.03)));
  ctx.translate(-sx * 30, 26);
  const ear = () => {
    ctx.beginPath();
    ctx.moveTo(sx * 11, -30);
    ctx.quadraticCurveTo(sx * 20, -49, sx * 37, -57);
    ctx.quadraticCurveTo(sx * 45, -60, sx * 46, -52);
    ctx.quadraticCurveTo(sx * 51, -33, sx * 47, -10);
    ctx.closePath();
  };
  ear();
  ctx.fillStyle = FOX.fur;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // inner ear
  ctx.beginPath();
  ctx.moveTo(sx * 20, -28);
  ctx.quadraticCurveTo(sx * 27, -45, sx * 38, -50);
  ctx.quadraticCurveTo(sx * 44, -36, sx * 41, -16);
  ctx.closePath();
  ctx.fillStyle = FOX.earIn;
  ctx.fill();
  // cream fluff at the base of the inner ear
  ctx.beginPath();
  ctx.moveTo(sx * 22, -22);
  ctx.lineTo(sx * 27, -36);
  ctx.lineTo(sx * 30, -27);
  ctx.lineTo(sx * 35, -40);
  ctx.lineTo(sx * 37, -24);
  ctx.closePath();
  ctx.fillStyle = FOX.cream;
  ctx.fill();
  // dark ear tip
  ctx.beginPath();
  ctx.moveTo(sx * 20, -70);
  ctx.lineTo(sx * 70, -70);
  ctx.lineTo(sx * 70, -44);
  ctx.quadraticCurveTo(sx * 40, -50, sx * 28, -52);
  ctx.closePath();
  ctx.fillStyle = FOX.dark;
  ctx.fill();
  ctx.restore();
  ear();
  ctx.lineWidth = o;
  ctx.strokeStyle = FOX.line;
  ctx.stroke();
  ctx.restore();
}

function foxEye(ctx, sx, m, t, look, o) {
  const rx = 10.5 * m.eye, ry = 12.5 * m.eye;
  ctx.save();
  ctx.translate(sx * 19, -5);
  if (m.closed) {
    // happy squeezed eyes: ^ ^
    ctx.beginPath();
    ctx.moveTo(-rx, 3);
    ctx.quadraticCurveTo(0, -12, rx, 3);
    ctx.lineWidth = o * 1.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = FOX.dark;
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (m.squeeze) {
    // sobbing: eyes squeezed shut > <
    ctx.beginPath();
    ctx.moveTo(sx * 9, -6);
    ctx.lineTo(-sx * 5, 0);
    ctx.lineTo(sx * 9, 6);
    ctx.lineWidth = o * 1.7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = FOX.dark;
    ctx.stroke();
    ctx.restore();
    return;
  }
  const bl = blinkAt(t, sx > 0 ? 0 : 0.0);
  const lidIn = Math.max(m.lidIn, bl), lidOut = Math.max(m.lidOut, bl);
  if (lidIn > 0.93 && lidOut > 0.93) {
    // fully shut: a lash line
    ctx.beginPath();
    ctx.moveTo(-rx, 1);
    ctx.quadraticCurveTo(0, 8, rx, 1);
    ctx.lineWidth = o * 1.3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = FOX.dark;
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
  ctx.fillStyle = '#fffdf8';
  ctx.fill();
  ctx.save();
  ctx.clip();
  // pupils track look (sly moods glance sideways)
  let lx = clamp(look.x || 0, -1, 1), ly = clamp(look.y || 0, -1, 1);
  if (m.sly) lx = clamp(lx + m.sly * 0.8, -1, 1);
  const ri = rx * 0.74 * (m.pupil < 0.6 ? 0.78 : 1) * Math.min(1, m.pupil + 0.25);
  const px = lx * (rx - ri) * 0.95, py = ly * (ry - ri) * 0.8 + 1.5;
  ctx.beginPath();
  ctx.arc(px, py, ri, 0, TAU);
  const ig = ctx.createRadialGradient(px, py + ri * 0.4, ri * 0.1, px, py, ri);
  const iris = m.evil ? FOX.irisEvil : FOX.iris;
  ig.addColorStop(0, m.evil ? '#fff3a0' : '#e7a24a');
  ig.addColorStop(1, iris);
  ctx.fillStyle = ig;
  ctx.fill();
  ctx.fillStyle = FOX.pupil;
  ctx.beginPath();
  if (m.evil) ctx.ellipse(px, py, ri * 0.24, ri * 0.82, 0, 0, TAU);
  else ctx.arc(px, py, ri * 0.62 * m.pupil, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  glint(ctx, px - ri * 0.36, py - ri * 0.38, ri * 0.32);
  glint(ctx, px + ri * 0.34, py + ri * 0.36, ri * 0.14);
  // upper lid: inner corner (toward the snout) and outer corner can close by different amounts
  const ix = -sx * rx * 1.3, ox = sx * rx * 1.3;
  const yi = -ry + 2 * ry * lidIn, yo = -ry + 2 * ry * lidOut;
  if (lidIn > 0.02 || lidOut > 0.02) {
    ctx.beginPath();
    ctx.moveTo(ix, -ry - 4);
    ctx.lineTo(ox, -ry - 4);
    ctx.lineTo(ox, yo);
    ctx.quadraticCurveTo(0, (yi + yo) / 2 + 2.5, ix, yi);
    ctx.closePath();
    ctx.fillStyle = FOX.fur;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(ox, yo);
    ctx.quadraticCurveTo(0, (yi + yo) / 2 + 2.5, ix, yi);
    ctx.lineWidth = o * 1.6;
    ctx.strokeStyle = FOX.dark;
    ctx.stroke();
  }
  if (m.lidBot > 0) {
    const yb = ry - 2 * ry * m.lidBot;
    ctx.beginPath();
    ctx.moveTo(-rx - 2, ry + 4);
    ctx.lineTo(rx + 2, ry + 4);
    ctx.lineTo(rx + 2, yb + 2);
    ctx.quadraticCurveTo(0, yb - 3, -rx - 2, yb + 2);
    ctx.closePath();
    ctx.fillStyle = FOX.fur;
    ctx.fill();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
  ctx.lineWidth = o;
  ctx.strokeStyle = FOX.dark;
  ctx.stroke();
  ctx.restore();
}

function foxBrow(ctx, sx, b, o) {
  const [ix, iy, ox, oy, arch] = b;
  ctx.beginPath();
  ctx.moveTo(sx * ix, iy);
  ctx.quadraticCurveTo(sx * (ix + ox) / 2, (iy + oy) / 2 + arch, sx * ox, oy);
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(o * 1.9, 5.5);
  ctx.strokeStyle = FOX.dark;
  ctx.stroke();
}

function foxMouth(ctx, mood, t, o) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = FOX.dark;
  ctx.lineWidth = o * 1.1;
  if (mood === 'evil') {
    // wide crescent grin full of pointy teeth
    const grin = () => {
      ctx.beginPath();
      ctx.moveTo(-29, 15);
      ctx.quadraticCurveTo(0, 32, 29, 15);
      ctx.quadraticCurveTo(22, 46, 0, 46);
      ctx.quadraticCurveTo(-22, 46, -29, 15);
      ctx.closePath();
    };
    grin();
    ctx.fillStyle = FOX.mouth;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.beginPath();
    ctx.ellipse(0, 47, 14, 8, 0, 0, TAU);
    ctx.fillStyle = '#c23a45';
    ctx.fill();
    // upper fangs along the lip curve
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const u0 = i / 8, u1 = (i + 1) / 8, um = (u0 + u1) / 2;
      const lip = (u) => { const x = -29 + 58 * u; return [x, 15 + 34 * u * (1 - u) * 1]; };
      const [x0, y0] = lip(u0), [x1, y1] = lip(u1), [xm, ym] = lip(um);
      const long = i === 1 || i === 6 ? 10 : 6.5;
      ctx.moveTo(x0, y0 - 2);
      ctx.lineTo(xm, ym + long);
      ctx.lineTo(x1, y1 - 2);
    }
    ctx.fill();
    // a few lower teeth
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const x = -13 + i * 8.6;
      ctx.moveTo(x - 4, 47);
      ctx.lineTo(x, 39.5);
      ctx.lineTo(x + 4, 47);
    }
    ctx.fill();
    ctx.restore();
    grin();
    ctx.stroke();
    // smirk creases
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx * 27, 11);
      ctx.quadraticCurveTo(sx * 33, 15, sx * 30, 21);
      ctx.stroke();
    }
    return;
  }
  if (mood === 'cry') {
    // wailing mouth, corners turned down
    const op = 0.85 + 0.15 * Math.sin(t * 14);
    const m = () => {
      ctx.beginPath();
      ctx.moveTo(-16, 33);
      ctx.quadraticCurveTo(0, 20, 16, 33);
      ctx.quadraticCurveTo(14, 33 + 15 * op, 0, 33 + 15 * op);
      ctx.quadraticCurveTo(-14, 33 + 15 * op, -16, 33);
      ctx.closePath();
    };
    m();
    ctx.fillStyle = FOX.mouth;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.beginPath();
    ctx.ellipse(0, 50, 10, 8, 0, 0, TAU);
    ctx.fillStyle = FOX.tongue;
    ctx.fill();
    ctx.restore();
    m();
    ctx.stroke();
    return;
  }
  if (mood === 'laugh') {
    const open = 0.85 + 0.15 * Math.sin(t * 18);
    const m = () => {
      ctx.beginPath();
      ctx.moveTo(-17, 23);
      ctx.quadraticCurveTo(0, 29, 17, 23);
      ctx.quadraticCurveTo(16, 23 + 22 * open, 0, 23 + 22 * open);
      ctx.quadraticCurveTo(-16, 23 + 22 * open, -17, 23);
      ctx.closePath();
    };
    m();
    ctx.fillStyle = FOX.mouth;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.beginPath();
    ctx.ellipse(0, 25 + 22 * open, 11, 9, 0, 0, TAU);
    ctx.fillStyle = FOX.tongue;
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (const sx of [-1, 1]) {
      ctx.moveTo(sx * 12, 24);
      ctx.lineTo(sx * 9, 31);
      ctx.lineTo(sx * 6, 26);
    }
    ctx.fill();
    ctx.restore();
    m();
    ctx.stroke();
    return;
  }
  if (mood === 'shocked') {
    ctx.beginPath();
    ctx.ellipse(0, 32, 6, 8, 0, 0, TAU);
    ctx.fillStyle = FOX.mouth;
    ctx.fill();
    ctx.stroke();
    return;
  }
  if (mood === 'angry') {
    // gritted teeth, corners pulled down
    const m = () => {
      ctx.beginPath();
      ctx.moveTo(-17, 34);
      ctx.quadraticCurveTo(-16, 25, -8, 25);
      ctx.lineTo(8, 25);
      ctx.quadraticCurveTo(16, 25, 17, 34);
      ctx.quadraticCurveTo(0, 37, -17, 34);
      ctx.closePath();
    };
    m();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.lineWidth = o * 0.7;
    ctx.beginPath();
    ctx.moveTo(-18, 30.5);
    ctx.lineTo(18, 30.5);
    for (const x of [-10, -3.5, 3.5, 10]) {
      ctx.moveTo(x, 24);
      ctx.lineTo(x, 38);
    }
    ctx.stroke();
    ctx.restore();
    ctx.lineWidth = o * 1.1;
    m();
    ctx.stroke();
    return;
  }
  ctx.beginPath();
  if (mood === 'smug') {
    // lopsided smirk
    ctx.moveTo(0, 21);
    ctx.lineTo(0, 25);
    ctx.moveTo(-11, 26);
    ctx.quadraticCurveTo(3, 32, 15, 21);
    ctx.moveTo(13, 19);
    ctx.quadraticCurveTo(17, 21, 16, 25);
  } else {
    // idle: soft "w"
    ctx.moveTo(0, 21);
    ctx.lineTo(0, 25);
    ctx.moveTo(-10, 25);
    ctx.quadraticCurveTo(-5, 31, 0, 25);
    ctx.quadraticCurveTo(5, 31, 10, 25);
  }
  ctx.stroke();
}

// Fox HEAD. s ≈ head width; fits ~s × 1.2s around (cx, cy).
export function drawFox(ctx, cx, cy, s, mood = 'idle', t = 0, look = { x: 0, y: 0 }) {
  if (!(s > 0)) return;
  const m = FOX_MOODS[mood] || FOX_MOODS.idle;
  if (!FOX_MOODS[mood]) mood = 'idle';
  look = look || { x: 0, y: 0 };
  ctx.save();
  try {
    ctx.translate(cx, cy);
    ctx.scale(s / 100, s / 100);
    const o = outlineW(s);
    // head motion per mood
    let by = 0, rot = 0, bx = 0;
    if (mood === 'laugh') { by = -Math.abs(Math.sin(t * 9)) * 5 + 2; rot = Math.sin(t * 9) * 0.05; }
    else if (mood === 'evil') { by = Math.sin(t * 7) * 1.4; rot = Math.sin(t * 1.3) * 0.04; }
    else if (mood === 'angry') bx = Math.sin(t * 38) * 0.8;
    else if (mood === 'shocked') { by = -1 + Math.sin(t * 30) * 0.4; }
    else if (mood === 'cry') { by = Math.abs(Math.sin(t * 10)) * 2.5 + 1; rot = Math.sin(t * 10) * 0.025; }
    else { by = Math.sin(t * 2.2) * 0.9; rot = Math.sin(t * 0.9) * 0.02; }
    ctx.translate(bx, by);
    ctx.rotate(rot);
    ctx.lineJoin = 'round';

    foxEar(ctx, -1, t, o, m.ears || 0);
    foxEar(ctx, 1, t, o, m.ears || 0);

    // forehead tuft peeking over the crown
    ctx.beginPath();
    ctx.moveTo(-9, -38);
    ctx.lineTo(-4, -46);
    ctx.lineTo(-1, -40);
    ctx.lineTo(4, -47);
    ctx.lineTo(8, -38);
    ctx.closePath();
    ctx.fillStyle = FOX.fur;
    ctx.fill();
    ctx.lineWidth = o;
    ctx.strokeStyle = FOX.line;
    ctx.stroke();

    // head
    const g = ctx.createRadialGradient(-6, -22, 4, 0, 0, 62);
    g.addColorStop(0, FOX.furHi);
    g.addColorStop(0.55, FOX.fur);
    g.addColorStop(1, FOX.furLo);
    symFill(ctx, foxHeadHalf, g);
    ctx.save();
    ctx.beginPath();
    foxHeadHalf(ctx, -1);
    ctx.closePath();
    foxHeadHalf(ctx, 1);
    ctx.closePath();
    ctx.clip();
    // cream cheeks and muzzle
    const cg = ctx.createLinearGradient(0, 6, 0, 50);
    cg.addColorStop(0, FOX.cream);
    cg.addColorStop(1, FOX.creamLo);
    symFill(ctx, (c, sx) => {
      c.moveTo(0, 2);
      c.bezierCurveTo(sx * 7, 2, sx * 10, 11, sx * 20, 12);
      c.bezierCurveTo(sx * 32, 13, sx * 44, 5, sx * 62, 2);
      c.lineTo(sx * 62, 70);
      c.lineTo(0, 70);
    }, cg);
    // menacing shadow over the brow when evil / angry
    if (mood === 'evil' || mood === 'angry') {
      const sg = ctx.createLinearGradient(0, -45, 0, 5);
      sg.addColorStop(0, 'rgba(60,10,30,0.42)');
      sg.addColorStop(1, 'rgba(60,10,30,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(-60, -50, 120, 56);
    }
    ctx.restore();
    ctx.lineWidth = o;
    ctx.strokeStyle = FOX.line;
    symStroke(ctx, foxHeadHalf);

    // blush
    if (mood === 'idle' || mood === 'laugh' || mood === 'smug' || mood === 'cry') {
      ctx.fillStyle = mood === 'laugh' ? 'rgba(255,110,120,0.45)' : 'rgba(255,120,120,0.28)';
      ctx.beginPath();
      ctx.ellipse(-32, 15, 7, 4.5, 0, 0, TAU);
      ctx.ellipse(32, 15, 7, 4.5, 0, 0, TAU);
      ctx.fill();
    }

    foxEye(ctx, -1, m, t, look, o);
    foxEye(ctx, 1, m, t, look, o);
    // brows (smug raises one)
    foxBrow(ctx, -1, m.brow, o);
    foxBrow(ctx, 1, m.browR || m.brow, o);

    // tears of joy when laughing
    if (mood === 'laugh') {
      ctx.fillStyle = '#7fd3ff';
      for (const sx of [-1, 1]) {
        const k = mod(t * 1.6 + (sx > 0 ? 0.5 : 0), 1);
        ctx.beginPath();
        ctx.arc(sx * (31 + k * 6), -2 + k * 8, 3.2 * (1 - k * 0.5), 0, TAU);
        ctx.fill();
      }
    }
    // streaming tears
    if (mood === 'cry') {
      ctx.lineCap = 'round';
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sx * 21, 1);
        ctx.quadraticCurveTo(sx * (30 + Math.sin(t * 8) * 1.5), 14, sx * 31, 36);
        ctx.strokeStyle = 'rgba(70,160,230,0.9)';
        ctx.lineWidth = 6.5;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(190,235,255,0.95)';
        ctx.lineWidth = 3.2;
        ctx.stroke();
        for (let i = 0; i < 2; i++) {
          const k = mod(t * 1.7 + i * 0.5 + (sx > 0 ? 0.25 : 0), 1);
          drawDrop(ctx, sx * (31 + k * 6), 38 + k * 26, 3.2, o * 0.8, 1 - k * 0.7);
        }
      }
    }
    // anger vein on the forehead
    if (mood === 'angry') {
      ctx.save();
      ctx.translate(30, -30);
      ctx.scale(1 + Math.sin(t * 10) * 0.08, 1 + Math.sin(t * 10) * 0.08);
      ctx.strokeStyle = '#d4192b';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const [qx, qy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        ctx.moveTo(qx * 2, qy * 8);
        ctx.quadraticCurveTo(qx * 2, qy * 2, qx * 8, qy * 2);
      }
      ctx.stroke();
      ctx.restore();
    }

    foxMouth(ctx, mood, t, o);
    // nose
    ctx.beginPath();
    ctx.moveTo(-7.5, 13);
    ctx.quadraticCurveTo(0, 10, 7.5, 13);
    ctx.quadraticCurveTo(6, 20, 0, 21);
    ctx.quadraticCurveTo(-6, 20, -7.5, 13);
    ctx.closePath();
    ctx.fillStyle = FOX.dark;
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.ellipse(-2.5, 13.5, 2.6, 1.3, -0.2, 0, TAU);
    ctx.fill();
  } catch (e) {
    // art must never break the frame
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ HEN */

const HEN = {
  body: '#fffaf2', bodyMid: '#f4eadb', bodyLo: '#d9c7ae', belly: '#fffdf8', line: '#6b4a2a',
  comb: '#f0402f', combLo: '#b81f17', combLine: '#7a1810',
  beak: '#ffb02e', beakLo: '#e57d12', beakLine: '#8a4a0a', eye: '#2a1d14',
};

function henBodyHalf(ctx, sx) {
  ctx.moveTo(0, -36);
  ctx.bezierCurveTo(sx * 19, -36, sx * 26, -23, sx * 28, -10);
  ctx.bezierCurveTo(sx * 41, 2, sx * 43, 24, sx * 31, 35);
  ctx.bezierCurveTo(sx * 22, 43, sx * 10, 44, 0, 44);
}

function henWing(ctx, sx, x, y, ang, sc, o) {
  ctx.save();
  ctx.translate(sx * x, y);
  ctx.scale(sx * sc, sc);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(-6, -1);
  ctx.bezierCurveTo(-11, 9, -7, 22, 1, 29);
  ctx.quadraticCurveTo(3, 25, 5, 27);
  ctx.quadraticCurveTo(6, 22, 9, 22);
  ctx.bezierCurveTo(11, 12, 10, 3, 6, -2);
  ctx.quadraticCurveTo(0, -6, -6, -1);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -4, 0, 30);
  g.addColorStop(0, '#fffdf8');
  g.addColorStop(1, '#e2d3bd');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = o;
  ctx.strokeStyle = HEN.line;
  ctx.stroke();
  // feather lines
  ctx.beginPath();
  ctx.moveTo(-1, 10);
  ctx.quadraticCurveTo(2, 17, 1, 23);
  ctx.moveTo(5, 9);
  ctx.quadraticCurveTo(6, 14, 6, 19);
  ctx.lineWidth = o * 0.6;
  ctx.stroke();
  ctx.restore();
}

function henFeet(ctx, lift, o) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const pass of [0, 1]) {
    ctx.strokeStyle = pass ? HEN.beak : HEN.beakLine;
    ctx.lineWidth = pass ? 3.4 : 3.4 + o * 1.4;
    ctx.beginPath();
    for (const sx of [-1, 1]) {
      const x = sx * 10, fy = 48 - lift;
      ctx.moveTo(x, 38 - lift);
      ctx.lineTo(x, fy);
      ctx.moveTo(x - 6, fy + 1.5);
      ctx.lineTo(x, fy);
      ctx.lineTo(x + 6, fy + 1.5);
      ctx.moveTo(x, fy);
      ctx.lineTo(x + sx * 1.5, fy + 2.5);
    }
    ctx.stroke();
  }
}

// Mama hen, full body. s ≈ body height; feet rest at cy + 0.5·s.
export function drawHen(ctx, cx, cy, s, mood = 'idle', t = 0) {
  if (!(s > 0)) return;
  ctx.save();
  try {
    ctx.translate(cx, cy);
    ctx.scale(s / 100, s / 100);
    const o = outlineW(s, 2.8);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    let lift = 0, sqx = 1, sqy = 1, faceY = 0, puff = 1, sway = 0;
    if (mood === 'happy') {
      const h = Math.abs(Math.sin(t * 6));
      lift = h * 9;
      sqy = 1 + h * 0.04 - (1 - h) * 0.03;
      sqx = 2 - sqy;
    } else if (mood === 'dance') {
      const h = Math.abs(Math.sin(t * 7));
      lift = h * 13;
      sqy = 1 + h * 0.05 - (1 - h) * 0.04;
      sqx = 2 - sqy;
      sway = Math.sin(t * 3.5) * 0.14;
    } else if (mood === 'gasp') {
      puff = 1.08 + Math.sin(t * 20) * 0.01;
    } else if (mood === 'sad') {
      sqy = 0.95;
      sqx = 1.04;
      faceY = 4;
    } else if (mood === 'worried') {
      lift = Math.abs(Math.sin(t * 16)) * 1.2; // nervous jitter
    } else if (mood === 'cry') {
      sqy = 0.97 + Math.sin(t * 9) * 0.015; // sobbing
      sqx = 2 - sqy;
    } else {
      sqy = 1 + Math.sin(t * 2.4) * 0.018; // breathing
      sqx = 2 - sqy;
    }
    henFeet(ctx, lift, o);
    ctx.save();
    // squash around the feet so the hen stays planted
    ctx.translate(0, 44 - lift);
    ctx.rotate(sway);
    ctx.scale(sqx * puff, sqy * puff);
    ctx.translate(0, -44);

    // tail fan behind the body
    ctx.save();
    ctx.translate(26, -8);
    ctx.rotate(0.25 + Math.sin(t * 3) * 0.05 + (mood === 'sad' ? 0.6 : 0) + (mood === 'happy' ? -0.2 : 0) + (mood === 'dance' ? Math.sin(t * 7) * 0.3 : 0));
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate(-0.55 + i * 0.45);
      ctx.beginPath();
      ctx.ellipse(0, -13, 6.5, 15, 0, 0, TAU);
      ctx.fillStyle = i === 1 ? '#fffaf0' : '#efe2cd';
      ctx.fill();
      ctx.lineWidth = o;
      ctx.strokeStyle = HEN.line;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // puffed feathers (gasp)
    if (mood === 'gasp') {
      ctx.fillStyle = HEN.body;
      ctx.strokeStyle = HEN.line;
      ctx.lineWidth = o;
      for (const [x, y, a] of [[-33, 6, -2.2], [-38, 20, -1.7], [34, 4, -0.9], [38, 19, -1.4]]) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.quadraticCurveTo(9, -3, 12, 0);
        ctx.quadraticCurveTo(9, 3, 0, 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    // comb (droops when sad)
    ctx.save();
    ctx.translate(0, -33);
    if (mood === 'sad' || mood === 'cry') ctx.rotate(-0.35);
    ctx.beginPath();
    ctx.moveTo(-11, 2);
    ctx.arc(-7, -3, 5.5, Math.PI * 0.85, Math.PI * 1.75);
    ctx.arc(0, -8, 6.5, Math.PI * 1.1, Math.PI * 1.9);
    ctx.arc(7.5, -3, 5.5, Math.PI * 1.25, Math.PI * 2.15);
    ctx.lineTo(9, 4);
    ctx.closePath();
    const cg = ctx.createLinearGradient(0, -15, 0, 4);
    cg.addColorStop(0, HEN.comb);
    cg.addColorStop(1, HEN.combLo);
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.lineWidth = o;
    ctx.strokeStyle = HEN.combLine;
    ctx.stroke();
    ctx.restore();

    // body
    const bg = ctx.createRadialGradient(-9, -14, 4, 0, 6, 52);
    bg.addColorStop(0, '#ffffff');
    bg.addColorStop(0.5, HEN.bodyMid);
    bg.addColorStop(1, HEN.bodyLo);
    symFill(ctx, henBodyHalf, bg);
    // belly patch
    ctx.save();
    ctx.beginPath();
    henBodyHalf(ctx, -1);
    ctx.closePath();
    henBodyHalf(ctx, 1);
    ctx.closePath();
    ctx.clip();
    ctx.beginPath();
    ctx.ellipse(0, 22, 22, 19, 0, 0, TAU);
    ctx.fillStyle = 'rgba(255,253,246,0.85)';
    ctx.fill();
    // scalloped chest feathers
    ctx.strokeStyle = 'rgba(160,130,95,0.45)';
    ctx.lineWidth = o * 0.6;
    ctx.beginPath();
    for (const [x, y] of [[-10, 16], [0, 19], [10, 16], [-5, 27], [5, 27]]) {
      ctx.moveTo(x - 4, y);
      ctx.quadraticCurveTo(x, y + 4, x + 4, y);
    }
    ctx.stroke();
    ctx.restore();
    ctx.lineWidth = o;
    ctx.strokeStyle = HEN.line;
    symStroke(ctx, henBodyHalf);

    // face
    ctx.save();
    ctx.translate(0, faceY);
    henFace(ctx, mood, t, o);
    ctx.restore();

    // wings
    let ang = -0.12 + Math.sin(t * 2.4) * 0.04, wx = 26, wy = -2, sc = 1;
    if (mood === 'happy') { ang = -2.35 + Math.sin(t * 12) * 0.35; wx = 26; wy = -6; }
    else if (mood === 'worried') { ang = 2.75 + Math.sin(t * 16) * 0.05; wx = 25; wy = 10; sc = 0.85; }
    else if (mood === 'gasp') { ang = -0.85 + Math.sin(t * 22) * 0.12; wx = 30; wy = -2; }
    else if (mood === 'cry') { ang = 0.12 + Math.sin(t * 9) * 0.05; wx = 25; wy = 2; }
    else if (mood === 'sad') { ang = 0.18; wx = 25; wy = 4; }
    let angL = ang, angR = ang;
    if (mood === 'dance') { // wings up, flapping in turns
      const sw = Math.sin(t * 7) * 0.7;
      angL = -2.15 + sw;
      angR = -2.15 - sw;
      wy = -6;
    }
    henWing(ctx, -1, wx, wy, angL, sc, o);
    henWing(ctx, 1, wx, wy, angR, sc, o);
    if (mood === 'dance') {
      // music notes drifting up
      ctx.fillStyle = '#ff7a9a';
      ctx.strokeStyle = HEN.line;
      ctx.lineWidth = o * 0.8;
      for (let i = 0; i < 3; i++) {
        const k = mod(t * 0.6 + i / 3, 1);
        const nx = (i - 1) * 40 + Math.sin(t * 2 + i) * 4, ny = -44 - k * 30;
        ctx.globalAlpha = Math.sin(k * Math.PI);
        ctx.beginPath();
        ctx.ellipse(nx, ny, 4.5, 3.4, -0.4, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(nx + 3.8, ny - 1);
        ctx.lineTo(nx + 3.8, ny - 14);
        ctx.quadraticCurveTo(nx + 10, ny - 11, nx + 8, ny - 6);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // loose feathers when gasping
    if (mood === 'gasp') {
      for (let i = 0; i < 2; i++) {
        const k = mod(t * 0.7 + i * 0.5, 1);
        ctx.save();
        ctx.globalAlpha = 1 - k;
        ctx.translate((i ? 30 : -32) + Math.sin(t * 4 + i) * 4, -20 - k * 25);
        ctx.rotate(Math.sin(t * 3 + i * 2) * 0.8);
        ctx.beginPath();
        ctx.ellipse(0, 0, 2.6, 6, 0, 0, TAU);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = o * 0.7;
        ctx.stroke();
        ctx.restore();
      }
    }
    // sweat drop when worried
    if (mood === 'worried') {
      const k = mod(t * 0.8, 1);
      drawDrop(ctx, 27, -30 + k * 8, 4.5, o * 0.7, 1 - k * 0.6);
    }
    ctx.restore();
  } catch (e) {
    // art must never break the frame
  }
  ctx.restore();
}

// Light-blue water drop (sweat or tear) with the round end at (x, y).
function drawDrop(ctx, x, y, r, o, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  ctx.moveTo(x, y - r * 2.1);
  ctx.quadraticCurveTo(x + r * 1.05, y - r * 0.6, x + r, y);
  ctx.arc(x, y, r, 0, Math.PI);
  ctx.quadraticCurveTo(x - r * 1.05, y - r * 0.6, x, y - r * 2.1);
  ctx.closePath();
  ctx.fillStyle = '#8fdcff';
  ctx.fill();
  ctx.lineWidth = o;
  ctx.strokeStyle = '#2f7fb8';
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(x - r * 0.35, y - r * 0.2, r * 0.3, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function henFace(ctx, mood, t, o) {
  if (mood === 'dance') mood = 'happy';
  const ey = -16;
  // blush
  ctx.fillStyle = mood === 'cry' || mood === 'happy' ? 'rgba(255,110,120,0.5)' : 'rgba(255,130,130,0.35)';
  ctx.beginPath();
  ctx.ellipse(-17, -6, 5, 3.2, 0, 0, TAU);
  ctx.ellipse(17, -6, 5, 3.2, 0, 0, TAU);
  ctx.fill();
  ctx.lineCap = 'round';
  ctx.strokeStyle = HEN.eye;
  ctx.fillStyle = HEN.eye;
  if (mood === 'happy') {
    ctx.lineWidth = o * 1.3;
    ctx.beginPath();
    for (const sx of [-1, 1]) {
      ctx.moveTo(sx * 10 - 5, ey + 2);
      ctx.quadraticCurveTo(sx * 10, ey - 6, sx * 10 + 5, ey + 2);
    }
    ctx.stroke();
  } else if (mood === 'cry') {
    // squeezed shut: > <
    ctx.lineWidth = o * 1.2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (const sx of [-1, 1]) {
      ctx.moveTo(sx * 15, ey - 4);
      ctx.lineTo(sx * 7, ey);
      ctx.lineTo(sx * 15, ey + 3);
    }
    ctx.stroke();
    // worried brows
    ctx.lineWidth = o;
    ctx.beginPath();
    for (const sx of [-1, 1]) {
      ctx.moveTo(sx * 5, ey - 10);
      ctx.lineTo(sx * 14, ey - 7);
    }
    ctx.stroke();
  } else if (mood === 'worried' || mood === 'gasp') {
    // wide eyes with small pupils
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(sx * 10, ey, 5.6, 6.8, 0, 0, TAU);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = o * 0.8;
      ctx.stroke();
      ctx.fillStyle = HEN.eye;
      const jit = mood === 'worried' ? Math.sin(t * 13 + sx) * 0.7 : 0;
      ctx.beginPath();
      ctx.arc(sx * 10 + jit, ey + 0.5, 2.7, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      glint(ctx, sx * 10 + jit - 0.9, ey - 0.6, 0.9);
    }
    ctx.lineWidth = o;
    ctx.beginPath();
    for (const sx of [-1, 1]) {
      if (mood === 'worried') {
        ctx.moveTo(sx * 5, ey - 13);
        ctx.lineTo(sx * 14, ey - 9);
      } else {
        ctx.moveTo(sx * 6, ey - 12);
        ctx.quadraticCurveTo(sx * 10, ey - 15, sx * 15, ey - 11);
      }
    }
    ctx.stroke();
  } else {
    // idle / sad: dot eyes (sad: half-lidded, looking down)
    const bl = mood === 'idle' ? blinkAt(t, 1) : 0;
    for (const sx of [-1, 1]) {
      ctx.fillStyle = HEN.eye;
      ctx.beginPath();
      if (bl > 0.6) {
        ctx.ellipse(sx * 10, ey + 1, 4, 1, 0, 0, TAU);
        ctx.fill();
        continue;
      }
      if (mood === 'sad') {
        ctx.ellipse(sx * 10, ey + 1.5, 3.6, 3, 0, 0, Math.PI);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        glint(ctx, sx * 10 - 1.2, ey + 2.4, 0.9);
      } else {
        ctx.ellipse(sx * 10, ey, 3.7, 4.7 * (1 - bl * 0.6), 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        glint(ctx, sx * 10 - 1.2, ey - 1.6, 1.3);
      }
    }
    if (mood === 'sad') {
      ctx.strokeStyle = HEN.eye;
      ctx.lineWidth = o;
      ctx.beginPath();
      for (const sx of [-1, 1]) {
        ctx.moveTo(sx * 5, ey - 6);
        ctx.lineTo(sx * 14, ey - 3);
      }
      ctx.stroke();
    }
  }
  // tears streaming
  if (mood === 'cry') {
    ctx.save();
    ctx.lineCap = 'round';
    for (const sx of [-1, 1]) {
      ctx.strokeStyle = 'rgba(120,205,255,0.9)';
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(sx * 12, ey + 3);
      ctx.quadraticCurveTo(sx * (17 + Math.sin(t * 8) * 1.5), ey + 12, sx * 16, ey + 24);
      ctx.stroke();
      for (let i = 0; i < 2; i++) {
        const k = mod(t * 1.8 + i * 0.5 + (sx > 0 ? 0.25 : 0), 1);
        drawDrop(ctx, sx * (16 + k * 9), ey + 22 + k * 22, 2.6, 1, 1 - k * 0.7);
      }
    }
    ctx.restore();
  }
  // beak (open for gasp / cry / happy)
  const open = mood === 'gasp' ? 7.5 : mood === 'cry' ? 5.5 + Math.sin(t * 9) * 1.5 : mood === 'happy' ? 4.5 : mood === 'worried' ? 2 : 0;
  const op = open > 0.5;
  // wattle hangs below the (lower) beak
  ctx.beginPath();
  ctx.ellipse(0, (op ? 1 : -1) + open * 1.05, 3.6, 5.2, 0, 0, TAU);
  ctx.fillStyle = HEN.comb;
  ctx.fill();
  ctx.lineWidth = o * 0.8;
  ctx.strokeStyle = HEN.combLine;
  ctx.stroke();
  ctx.strokeStyle = HEN.beakLine;
  if (op) {
    // mouth and lower beak
    ctx.beginPath();
    ctx.moveTo(-5.5, -8);
    ctx.lineTo(5.5, -8);
    ctx.lineTo(0, -2 + open * 1.4);
    ctx.closePath();
    ctx.fillStyle = '#7a1f1a';
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-4.2, -5 + open * 0.9);
    ctx.quadraticCurveTo(0, -3 + open * 0.9, 4.2, -5 + open * 0.9);
    ctx.lineTo(0, -1 + open * 1.4);
    ctx.closePath();
    ctx.fillStyle = HEN.beakLo;
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-6, -9.5);
  ctx.quadraticCurveTo(0, -13, 6, -9.5);
  ctx.lineTo(0, op ? -5 : -2.5);
  ctx.closePath();
  const bk = ctx.createLinearGradient(0, -12, 0, -3);
  bk.addColorStop(0, HEN.beak);
  bk.addColorStop(1, HEN.beakLo);
  ctx.fillStyle = bk;
  ctx.fill();
  ctx.stroke();
}

/* ---------------------------------------------------------------- CHICK */

const CHICK_BUMPS = 16;

// Fluffy hatched chick with a shell cap, drawn 1.5x the egg size s (it must read next to the fox). flap 0..1 flutters;
// peck 0..1 bows it down to peck the floor (it pecks thorns away), with crumbs flying.
export function drawChick(ctx, cx, cy, s, t = 0, flap = 0, peck = 0) {
  if (!(s > 0)) return;
  ctx.save();
  try {
    ctx.translate(cx, cy - s * 0.04);
    s *= 1.5;
    ctx.scale(s / 100, s / 100);
    const o = outlineW(s, 2.8);
    flap = clamp(flap || 0, 0, 1);
    peck = clamp(peck || 0, 0, 1);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const bob = peck ? 0 : Math.sin(t * (3 + flap * 9)) * (1 + flap * 1.5);
    const dip = peck ? Math.pow(0.5 + 0.5 * Math.sin(t * 13), 3) * peck : 0;
    ctx.translate(0, bob);

    // legs (dangle when fluttering)
    ctx.strokeStyle = '#8a4a0a';
    for (const pass of [0, 1]) {
      ctx.lineWidth = pass ? 3 : 3 + o * 1.3;
      ctx.strokeStyle = pass ? '#ffa62b' : '#8a4a0a';
      ctx.beginPath();
      for (const sx of [-1, 1]) {
        const sw = Math.sin(t * 10 + sx) * flap * 2;
        ctx.moveTo(sx * 8, 38);
        ctx.lineTo(sx * 8 + sw, 46);
        ctx.moveTo(sx * 8 + sw - 4, 48);
        ctx.lineTo(sx * 8 + sw, 46);
        ctx.lineTo(sx * 8 + sw + 4, 48);
      }
      ctx.stroke();
    }

    // pecking: the body bows over the planted feet
    if (dip > 0) {
      ctx.translate(0, 40);
      ctx.rotate(Math.sin(t * 13 + 1) * 0.04 + dip * 0.1);
      ctx.scale(1 + dip * 0.07, 1 - dip * 0.15);
      ctx.translate(0, -40 + dip * 6);
    }
    // fluffy body: scalloped circle
    const fluff = () => {
      ctx.beginPath();
      for (let i = 0; i <= CHICK_BUMPS; i++) {
        const a = (i / CHICK_BUMPS) * TAU - Math.PI / 2;
        const x = Math.cos(a) * 33, y = 8 + Math.sin(a) * 35;
        if (i === 0) ctx.moveTo(x, y);
        else {
          const am = a - Math.PI / CHICK_BUMPS;
          ctx.quadraticCurveTo(Math.cos(am) * 37.5, 8 + Math.sin(am) * 39.5, x, y);
        }
      }
      ctx.closePath();
    };
    fluff();
    const g = ctx.createRadialGradient(-8, -4, 4, 0, 10, 42);
    g.addColorStop(0, '#fff7a8');
    g.addColorStop(0.55, '#ffd93a');
    g.addColorStop(1, '#f2a91c');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = o;
    ctx.strokeStyle = '#a8661a';
    ctx.stroke();

    // wings: tiny, beat faster and wider as flap rises
    const wa = Math.sin(t * (9 + 34 * flap)) * (0.25 + 0.6 * flap) - 0.45 * flap;
    for (const sx of [-1, 1]) {
      ctx.save();
      ctx.translate(sx * (29 + flap * 4), 12);
      ctx.scale(1.15, 1.15);
      ctx.scale(sx, 1);
      ctx.rotate(-0.5 + wa);
      ctx.beginPath();
      ctx.moveTo(-2, -5);
      ctx.quadraticCurveTo(16, -9, 20, 1);
      ctx.quadraticCurveTo(15, 2, 16, 6);
      ctx.quadraticCurveTo(10, 5, 9, 9);
      ctx.quadraticCurveTo(2, 9, -2, 5);
      ctx.closePath();
      ctx.fillStyle = '#ffcf33';
      ctx.fill();
      ctx.lineWidth = o;
      ctx.strokeStyle = '#a8661a';
      ctx.stroke();
      ctx.restore();
    }

    // face
    const fy = 6;
    ctx.fillStyle = 'rgba(255,120,110,0.45)';
    ctx.beginPath();
    ctx.ellipse(-20, fy + 9, 5.5, 3.5, 0, 0, TAU);
    ctx.ellipse(20, fy + 9, 5.5, 3.5, 0, 0, TAU);
    ctx.fill();
    for (const sx of [-1, 1]) {
      ctx.fillStyle = '#2a1d14';
      ctx.beginPath();
      ctx.ellipse(sx * 11.5, fy, 5.8, 7.2 * (dip > 0.5 ? 0.6 : 1), 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      glint(ctx, sx * 11.5 - 1.9, fy - 2.6, 2.3);
      glint(ctx, sx * 11.5 + 1.8, fy + 2.8, 1);
    }
    // worried brows (inner ends raised)
    ctx.strokeStyle = '#a8661a';
    ctx.lineWidth = Math.max(2.4, o * 0.9);
    ctx.beginPath();
    for (const sx of [-1, 1]) {
      ctx.moveTo(sx * 6, fy - 11);
      ctx.lineTo(sx * 16, fy - 8);
    }
    ctx.stroke();
    // little open beak
    ctx.lineWidth = o * 0.8;
    ctx.strokeStyle = '#8a4a0a';
    const bo = 2.5 + flap * 2 + (peck ? dip * 4 : Math.sin(t * 7) * 0.6);
    ctx.beginPath();
    ctx.moveTo(-4.5, fy + 9);
    ctx.lineTo(4.5, fy + 9);
    ctx.lineTo(0, fy + 10 + bo);
    ctx.closePath();
    ctx.fillStyle = '#f08a1a';
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-5.5, fy + 9);
    ctx.quadraticCurveTo(0, fy + 2, 5.5, fy + 9);
    ctx.lineTo(0, fy + 11);
    ctx.closePath();
    ctx.fillStyle = '#ffb22e';
    ctx.fill();
    ctx.stroke();

    // head tuft under the shell
    ctx.strokeStyle = '#d99a1a';
    ctx.lineWidth = Math.max(2.4, o * 0.9);
    ctx.beginPath();
    ctx.moveTo(-11, -24);
    ctx.quadraticCurveTo(-16, -31, -11, -34);
    ctx.stroke();

    // eggshell cap, tilted, with a zigzag broken edge
    ctx.save();
    ctx.translate(3, -27);
    ctx.rotate(0.22 + Math.sin(t * (2 + flap * 10)) * (0.04 + flap * 0.06));
    ctx.beginPath();
    ctx.moveTo(-24, 4);
    ctx.bezierCurveTo(-24, -14, -12, -23, 0, -23);
    ctx.bezierCurveTo(12, -23, 24, -14, 24, 4);
    const zz = [[18, -1], [13, 6], [7, 0], [1, 7], [-5, 0], [-11, 6], [-17, -1]];
    for (const [x, y] of zz) ctx.lineTo(x, y);
    ctx.closePath();
    const sg = ctx.createLinearGradient(-10, -22, 10, 6);
    sg.addColorStop(0, '#fffdf6');
    sg.addColorStop(1, '#e7d6b6');
    ctx.fillStyle = sg;
    ctx.fill();
    ctx.lineWidth = o;
    ctx.strokeStyle = '#6b4a2a';
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.ellipse(-9, -12, 3.5, 5, 0.5, 0, TAU);
    ctx.fill();
    ctx.restore();

    if (peck > 0) {
      // crumbs of thorn fly off the floor at each peck
      const u = mod(t * 13 / TAU - 0.25, 1);
      ctx.globalAlpha = peck * (1 - u);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? '#b3263a' : '#6b4a2a';
        ctx.beginPath();
        ctx.arc((i - 1.5) * 9 + Math.sin(i * 3) * 3, 46 - Math.sin(u * Math.PI) * (10 + i * 3), 2.2, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // flutter puffs when falling hard
    if (flap > 0.4) {
      ctx.fillStyle = `rgba(255,255,255,${(flap - 0.4) * 0.9})`;
      for (const sx of [-1, 1]) {
        const k = mod(t * 3 + (sx > 0 ? 0.5 : 0), 1);
        ctx.beginPath();
        ctx.arc(sx * (40 + k * 8), 4 - k * 14, 3.5 * (1 - k), 0, TAU);
        ctx.fill();
      }
    }
  } catch (e) {
    // art must never break the frame
  }
  ctx.restore();
}

/* ---------------------------------------------------------------- SNAKE */
// Modelled on the Breaker serpent: a lit, tapered purple body with a peach belly and rose diamonds, under a rendered
// head sprite (13 expressions, faces left or right). A vector head stands in while the sheet loads.

const SN_CELL = 176;
const SN_EXPR = { idle: 0, blink: 1, taste: 2, hunt: 3, chew0: 4, chew1: 5, hiss: 6, ouch: 7, dizzy: 8, shock: 9, snarl: 10, strike: 11, grin: 12 };
let snImg = null, snOk = false;
function snakeSheet() {
  if (snImg === null) {
    snImg = false;
    try {
      if (typeof Image !== 'undefined') {
        const im = new Image();
        im.onload = () => { snOk = true; };
        im.src = SNAKE_SHEET;
        snImg = im;
      }
    } catch (e) { /* stays on the vector head */ }
  }
  return snOk ? snImg : null;
}

// Reused sample buffers so a slithering snake does not allocate every frame.
const SN_MAX = 360;
const snX = new Float32Array(SN_MAX), snY = new Float32Array(SN_MAX);
const snNX = new Float32Array(SN_MAX), snNY = new Float32Array(SN_MAX);
const snTX = new Float32Array(SN_MAX), snTY = new Float32Array(SN_MAX);
const snW = new Float32Array(SN_MAX), snA = new Float32Array(SN_MAX);
const snSG = new Float32Array(SN_MAX), snBW = new Float32Array(SN_MAX);
const tmpX = new Float32Array(SN_MAX), tmpY = new Float32Array(SN_MAX);
const snFace = {}; // last facing per snake id (hysteresis so a vertical stretch never flips the head)

// Resample pts at even spacing, then smooth so polyline corners turn into curves.
function snakeSample(pts, step) {
  let n = 0;
  snX[0] = pts[0].x;
  snY[0] = pts[0].y;
  n = 1;
  let carry = 0;
  for (let i = 1; i < pts.length && n < SN_MAX; i++) {
    const ax = pts[i - 1].x, ay = pts[i - 1].y;
    const dx = pts[i].x - ax, dy = pts[i].y - ay;
    const len = Math.hypot(dx, dy);
    if (!(len > 1e-9)) continue;
    let d = step - carry;
    while (d <= len && n < SN_MAX) {
      snX[n] = ax + (dx * d) / len;
      snY[n] = ay + (dy * d) / len;
      n++;
      d += step;
    }
    carry = len - (d - step);
  }
  const last = pts[pts.length - 1];
  if (n < SN_MAX && Math.hypot(last.x - snX[n - 1], last.y - snY[n - 1]) > step * 0.3) {
    snX[n] = last.x;
    snY[n] = last.y;
    n++;
  }
  for (let pass = 0; pass < 14; pass++) {
    for (let i = 1; i < n - 1; i++) {
      tmpX[i] = (snX[i - 1] + 2 * snX[i] + snX[i + 1]) / 4;
      tmpY[i] = (snY[i - 1] + 2 * snY[i] + snY[i + 1]) / 4;
    }
    for (let i = 1; i < n - 1; i++) {
      snX[i] = tmpX[i];
      snY[i] = tmpY[i];
    }
  }
  return n;
}

// Snake along pts (head first, y-down). r = body radius of the old thin snake: the body is now ~2r wide (x thick).
// opts: mouthOpen 0..1, expr (idle blink taste hunt chew0 chew1 hiss ouch dizzy shock snarl strike grin),
// thick (body thickness multiplier, default 1), venom 0..1 (green drip at the mouth), id (keeps facing stable per snake).
export function drawSnake(ctx, pts, r, t = 0, opts = {}) {
  if (!pts || pts.length < 2 || !(r > 0)) return;
  ctx.save();
  try {
    opts = opts || {};
    const Wh = r * 1.9 * clamp(opts.thick || 1, 0.4, 3); // body half width at the neck
    const step = Math.max(Wh * 0.26, 0.5);
    let n = snakeSample(pts, step);
    if (n < 3) {
      n = 3;
      const dx = pts[1].x - pts[0].x, dy = pts[1].y - pts[0].y;
      const l = Math.hypot(dx, dy) || 1;
      for (let i = 0; i < 3; i++) {
        snX[i] = pts[0].x + (dx / l) * step * i;
        snY[i] = pts[0].y + (dy / l) * step * i;
      }
    }
    // tangents (toward the head), arc length
    snA[0] = 0;
    for (let i = 1; i < n; i++) snA[i] = snA[i - 1] + Math.hypot(snX[i] - snX[i - 1], snY[i] - snY[i - 1]);
    const len = Math.max(snA[n - 1], step);
    for (let i = 0; i < n; i++) {
      const a = Math.min(n - 1, i + 1), b = Math.max(0, i - 1);
      let tx = snX[b] - snX[a], ty = snY[b] - snY[a];
      const l = Math.hypot(tx, ty) || 1;
      snTX[i] = tx / l;
      snTY[i] = ty / l;
      snNX[i] = -snTY[i];
      snNY[i] = snTX[i];
    }
    // travelling wiggle (not at the head, which is a sprite)
    const wl = 0.22 * 7 / Wh;
    for (let i = 1; i < n; i++) {
      const f = snA[i] / len;
      const w = Math.sin(t * 4.5 - snA[i] * wl) * Wh * 0.17 * Math.min(1, f * 4);
      tmpX[i] = snX[i] + snNX[i] * w;
      tmpY[i] = snY[i] + snNY[i] * w;
    }
    for (let i = 1; i < n; i++) { snX[i] = tmpX[i]; snY[i] = tmpY[i]; }
    // width profile, belly side (the lower flank, fading out where the body stands vertical)
    const wmin = Math.max(0.6, Wh * 0.06);
    for (let i = 0; i < n; i++) {
      const f = snA[i] / len;
      const prof = f < 0.12 ? 0.86 + (f / 0.12) * 0.14 : Math.pow((1 - f) / 0.88, 0.7);
      snW[i] = Wh * prof + wmin;
      snSG[i] = snNY[i] >= 0 ? 1 : -1;
      const q = clamp(Math.abs(snNY[i]) / 0.55, 0, 1);
      snBW[i] = q * q * (3 - 2 * q);
    }
    const E = (k, o) => { // outline edge at k * w along the normal on one side (o = 1 or -1), fresh sub-path
      for (let i = 0; i < n; i++) {
        const x = snX[i] + snNX[i] * snW[i] * k * o, y = snY[i] + snNY[i] * snW[i] * k * o;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
    };
    const outline = () => {
      ctx.beginPath();
      E(1, 1);
      for (let i = n - 1; i >= 0; i--) ctx.lineTo(snX[i] - snNX[i] * snW[i], snY[i] - snNY[i] * snW[i]);
      ctx.closePath();
    };
    const lw = Math.max(1.2, Wh * 0.13);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // contact shadow
    ctx.save();
    ctx.translate(Wh * 0.36, Wh * 0.58);
    outline();
    ctx.fillStyle = 'rgba(0,0,0,0.33)';
    ctx.fill();
    ctx.restore();

    ctx.save();
    outline();
    ctx.fillStyle = '#7a3ccc';
    ctx.fill();
    ctx.clip();
    // peach belly along the lower flank
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const k = 1.05 - 0.63 * snBW[i], o = snSG[i];
      const x = snX[i] + snNX[i] * snW[i] * k * o, y = snY[i] + snNY[i] * snW[i] * k * o;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(snX[i] + snNX[i] * snW[i] * 1.1 * snSG[i], snY[i] + snNY[i] * snW[i] * 1.1 * snSG[i]);
    ctx.closePath();
    ctx.fillStyle = '#ffc49a';
    ctx.fill();
    // belly plates
    ctx.strokeStyle = 'rgba(150,70,60,0.4)';
    ctx.lineWidth = Math.max(0.8, Wh * 0.1);
    ctx.beginPath();
    const plate = Math.max(Wh * 0.45, 2.2);
    for (let i = 0, next = 0; i < n; i++) {
      if (snA[i] < next) continue;
      next += plate;
      const k0 = 1.05 - 0.61 * snBW[i], o = snSG[i];
      ctx.moveTo(snX[i] + snNX[i] * snW[i] * k0 * o, snY[i] + snNY[i] * snW[i] * k0 * o);
      ctx.lineTo(snX[i] + snNX[i] * snW[i] * 1.1 * o, snY[i] + snNY[i] * snW[i] * 1.1 * o);
    }
    ctx.stroke();
    // rose diamonds down the back
    ctx.fillStyle = '#ff6fae';
    ctx.strokeStyle = '#1e0a40';
    ctx.lineWidth = Math.max(0.8, Wh * 0.1);
    const dstep = Wh * 1.3;
    for (let i = 0, next = Wh * 2.3; i < n; i++) {
      if (snA[i] < next) continue;
      next += dstep;
      if (snA[i] > len * 0.9) break;
      const w = snW[i], o = snSG[i];
      const cx = snX[i] - snNX[i] * w * 0.3 * o * snBW[i], cy = snY[i] - snNY[i] * w * 0.3 * o * snBW[i];
      const L = w * 0.95, Wd = w * 0.42;
      ctx.beginPath();
      ctx.moveTo(cx + snTX[i] * L, cy + snTY[i] * L);
      ctx.lineTo(cx - snNX[i] * Wd, cy - snNY[i] * Wd);
      ctx.lineTo(cx - snTX[i] * L, cy - snTY[i] * L);
      ctx.lineTo(cx + snNX[i] * Wd, cy + snNY[i] * Wd);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // light: shadow lower right, soft key light upper left, glossy streak
    const lit = (ox, oy, wk, col) => {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = snX[i] + ox * snW[i] + snNX[i] * snW[i] * wk, y = snY[i] + oy * snW[i] + snNY[i] * snW[i] * wk;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      for (let i = n - 1; i >= 0; i--) ctx.lineTo(snX[i] + ox * snW[i] - snNX[i] * snW[i] * wk, snY[i] + oy * snW[i] - snNY[i] * snW[i] * wk);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
    };
    lit(0.5, 0.65, 0.75, 'rgba(18,4,40,0.26)');
    lit(-0.3, -0.4, 0.3, 'rgba(225,190,255,0.3)');
    lit(-0.38, -0.5, 0.09, 'rgba(255,255,255,0.55)');
    ctx.restore();
    outline();
    ctx.strokeStyle = '#1e0a40';
    ctx.lineWidth = lw;
    ctx.stroke();

    // ---- head
    const hx = snX[0], hy = snY[0];
    const j = Math.min(n - 1, Math.max(2, Math.round(Wh * 1.6 / step)));
    const dx = hx - snX[j], dy = hy - snY[j], dl = Math.hypot(dx, dy) || 1;
    const id = opts.id | 0;
    let left = snFace[id] === undefined ? dx < 0 : snFace[id];
    if (Math.abs(dx) > dl * 0.3) left = dx < 0;
    snFace[id] = left;
    const base = left ? Math.PI : 0, a = Math.atan2(dy, dx);
    const rot = clamp(Math.atan2(Math.sin(a - base), Math.cos(a - base)), -0.95, 0.95);
    const mo = clamp(opts.mouthOpen || 0, 0, 1), venom = clamp(opts.venom || 0, 0, 1);
    let ex = SN_EXPR[opts.expr] === undefined ? null : opts.expr;
    if (!ex) {
      if (venom > 0.05) ex = 'snarl';
      else if (mo > 0.6) ex = 'strike';
      else if (mo > 0.15) ex = 'hiss';
      else if (mod(t, 3.4) < 0.13) ex = 'blink';
      else if (mod(t * 0.9, 2.4) < 0.5) ex = 'taste';
      else ex = 'idle';
    }
    const size = Wh * 2 * 3.9;
    const shake = ex === 'ouch' ? Math.sin(t * 60) * 0.06 : ex === 'dizzy' ? Math.sin(t * 9) * 0.1 : Math.sin(t * 2.6) * 0.04;
    const bob = (Math.sin(t * 3.2) * 0.8 + (ex === 'hiss' || ex === 'strike' ? -1.5 : 0)) * (Wh / 7);
    ctx.translate(hx, hy + bob);
    ctx.rotate(rot + shake);
    const img = snakeSheet();
    if (img) ctx.drawImage(img, SN_EXPR[ex] * SN_CELL, (left ? 1 : 0) * SN_CELL, SN_CELL, SN_CELL, -size / 2, -size / 2, size, size);
    else snakeHeadVec(ctx, size, left ? -1 : 1, ex);
    if (venom > 0.05) snakeVenom(ctx, size, left ? -1 : 1, venom, t);
  } catch (e) {
    // art must never break the frame
  }
  ctx.restore();
}

// Green venom welling at the mouth: a swelling blob, a drip stretching down, and a spray when it spits.
function snakeVenom(ctx, size, d, v, t) {
  const mx = d * size * 0.2, my = size * 0.1, u = size / 20;
  ctx.save();
  ctx.lineJoin = 'round';
  const blob = (x, y, rx, ry) => {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.fillStyle = '#7bea38';
    ctx.fill();
    ctx.lineWidth = Math.max(1, u * 0.28);
    ctx.strokeStyle = '#1c6a14';
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(x - rx * 0.3, y - ry * 0.3, Math.max(0.5, rx * 0.22), 0, TAU);
    ctx.fill();
  };
  const L = u * (1 + 3.5 * v);
  ctx.beginPath(); // strand from the lip
  ctx.moveTo(mx - u * 0.6, my);
  ctx.quadraticCurveTo(mx - u * 0.3, my + L * 0.6, mx, my + L);
  ctx.quadraticCurveTo(mx + u * 0.3, my + L * 0.6, mx + u * 0.6, my);
  ctx.closePath();
  ctx.fillStyle = '#7bea38';
  ctx.fill();
  blob(mx, my + L, u * (0.8 + 0.5 * v), u * (0.95 + 0.5 * v));
  for (let i = 0; i < 3; i++) { // flying droplets
    const k = mod(t * 2.2 + i / 3, 1);
    ctx.globalAlpha = (1 - k) * v;
    blob(mx + d * (k * u * 7 + i * u), my + k * u * 5 + Math.sin(i * 2) * u, u * 0.55 * (1 - k * 0.4), u * 0.55 * (1 - k * 0.4));
  }
  ctx.restore();
}

// Stand-in head while the sprite sheet loads: same purple, same pose.
function snakeHeadVec(ctx, size, d, ex) {
  const u = size / 100;
  ctx.scale(d, 1);
  ctx.beginPath();
  ctx.moveTo(-34 * u, 2 * u);
  ctx.bezierCurveTo(-34 * u, -14 * u, -10 * u, -22 * u, 12 * u, -14 * u);
  ctx.bezierCurveTo(30 * u, -8 * u, 44 * u, 2 * u, 44 * u, 8 * u);
  ctx.bezierCurveTo(30 * u, 20 * u, 0 * u, 20 * u, -34 * u, 2 * u);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -20 * u, 0, 20 * u);
  g.addColorStop(0, '#9a62e8');
  g.addColorStop(1, '#5a24a8');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(1.1, u * 1.6);
  ctx.strokeStyle = '#1e0a40';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-4 * u, -4 * u, 8 * u, 0, TAU);
  ctx.fillStyle = ex === 'blink' ? '#7a3ccc' : '#e6f5a0';
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1e0a40';
  ctx.beginPath();
  ctx.ellipse(-3 * u, -4 * u, 1.6 * u, 5 * u, 0, 0, TAU);
  ctx.fill();
}
