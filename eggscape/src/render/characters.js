// Character art: mama hen, hatched chick (the snake is in snake.js). Pure Canvas 2D, no assets.
// Every function draws in a local y-DOWN space centred on (cx, cy); the caller flips if needed.
// Shapes are authored in a 100-unit box and scaled by s / 100.


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

// shared with the animated rig (hen.js): one hen look, one set of shapes
export { HEN, henBodyHalf, henWing, drawDrop, symFill, symStroke, outlineW, glint };

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

// Fluffy hatched chick with a shell cap, drawn 1.5x the egg size s (it must read next to the creatures). flap 0..1 flutters;
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
// The snake lives in its own module now (code-drawn, house style); re-exported for older callers.
export { drawSnake, snakeHeadAnim, SNAKE_SKIN } from './snake.js';
