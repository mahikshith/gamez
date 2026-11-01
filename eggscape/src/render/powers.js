// Power-up art: floating orbs, egg overlays, and popup-card icons. Canvas 2D; known orbs use the raster sprites (sprites.js) when loaded, code-drawn otherwise.
// All drawing is local y-DOWN; flames rise toward -y. The caller handles any world flip.

import { drawSprite, spriteReady, isSpriteCalm } from './sprites.js';

const TAU = Math.PI * 2;
const mod = (a, b) => ((a % b) + b) % b;
// Stable pseudo-random in 0..1 (no Math.random so frames are repeatable).
const hash = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export const POWER_INFO = {
  fire_red: { name: 'Red flame', line: 'Burns away thorns it touches. Rings stay safe.', color: '#ff5a1f' },
  fire_black: { name: 'Black flame', line: 'Eats through the ring floor. Down you go!', color: '#8e3bd6' },
  fire_green: { name: 'Green flame', line: 'Mends every crack.', color: '#36cf63' },
  fire_gold: { name: 'Sun flame', line: 'Hatches a chick that flutters down. Mind the thorns!', color: '#ffb01f' },
  stone: { name: 'Stone shell', line: 'Can\u2019t crack or be eaten. Heavy: smashes thorns and cracked glass.', color: '#9b9189' },
  bubble: { name: 'Bubble', line: 'Floats the egg up. Pops on thorns instead.', color: '#8be6ff' },
  water: { name: 'Water shell', line: 'Soft landings hurt half as much. Cools lava rocks, shrugs off embers.', color: '#2f8dff' },
  thunder: { name: 'Thunder ball', line: 'Zap! The next ring locks up and the egg cracks.', color: '#7a6cff' },
  thorn: { name: 'Thorn ball', line: 'Ouch! It cracks the egg.', color: '#b3263a' },
  magnet: { name: 'Magnet', line: 'Ties this egg to its nearest friend for a while.', color: '#ff4f7b' },
  twin: { name: 'Twin egg', line: 'A second egg pops out, with one crack.', color: '#ffe38a' },
  golden: { name: 'Golden shell', line: 'Survives one thorn hit.', color: '#ffcf3a' },
  // v3
  hourglass: { name: 'Hourglass', line: 'Time slows for 6 s and the fuse stops.', color: '#e8c36a' },
  feather: { name: 'Guardian feather', line: 'Every egg is safe for 6 s. Nothing can crack or eat them.', color: '#7fe0ff' },
  rockskin: { name: 'Rock skin', line: 'Every egg turns to stone for 6 s. Snakes can\u2019t bite stone.', color: '#8f8a84' },
  foxcurse: { name: 'Fox curse', line: 'The fox\u2019s trick! Eggs go foxy and the fuse runs double for 6 s.', color: '#ff7a1a' },
};

// Glass tint per orb: [highlight side, mid, deep rim]. Darker glass makes the emblem pop.
const GLASS = {
  fire_red: ['#ff9a5c', '#a8280f', '#3d0904'],
  fire_black: ['#9a5ad8', '#3a1658', '#0f0518'],
  fire_green: ['#8af0a0', '#14713a', '#04220f'],
  fire_gold: ['#ffd77a', '#b5650a', '#3d1a02'],
  stone: ['#b4c2d2', '#3c4655', '#11161d'],
  bubble: ['#c9f6ff', '#2a8fb0', '#0a2d40'],
  water: ['#9fd2ff', '#1658b8', '#061a42'],
  thunder: ['#b9b0ff', '#3a2f9e', '#0e0a33'],
  thorn: ['#ff8a8a', '#6e1424', '#22040a'],
  magnet: ['#bfe9f0', '#1f5a66', '#06181d'],
  twin: ['#fff3c4', '#b88a2a', '#3d2a06'],
  golden: ['#fff0b0', '#b07a0c', '#3a2402'],
  hourglass: ['#fff1c0', '#8f5f12', '#2e1c04'],
  feather: ['#e2f9ff', '#1c6f94', '#062636'],
  rockskin: ['#cfc7bd', '#4d443d', '#15110e'],
  foxcurse: ['#ffb070', '#9c3406', '#2e0a00'],
};
const GLASS_DEFAULT = ['#e0e0e0', '#666666', '#222222'];

// "r,g,b" strings for the glow colours, parsed once.
const RGB = {};
for (const k in POWER_INFO) {
  const h = POWER_INFO[k].color;
  RGB[k] = `${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)}`;
}

// Flame palettes: [outer, mid, inner, core].
const FLAME = {
  fire_red: ['#d0230f', '#ff6a14', '#ffc02a', '#fff6c8'],
  fire_black: ['#14081f', '#2e1147', '#5d1f8c', '#d58cff'],
  fire_green: ['#0f8a3c', '#2fd35c', '#a6ff7e', '#f0ffe0'],
  fire_gold: ['#ff8a00', '#ffb81a', '#ffe76a', '#fffbe6'],
};

/* ------------------------------------------------------------ shared art */

// One flame tongue cluster with base at (x, y), half width w, height h, rising to -y.
function flamePath(ctx, x, y, w, h, t, ph) {
  const sw = Math.sin(t * 7 + ph) * w * 0.2 + Math.sin(t * 13.3 + ph * 2.1) * w * 0.09;
  const H = h * (1 + Math.sin(t * 11 + ph * 1.7) * 0.06);
  const rt = 0.64 + Math.sin(t * 9.1 + ph * 3) * 0.08; // right tongue height
  const lt = 0.72 + Math.sin(t * 8.3 + ph * 2.4) * 0.08; // left tongue height
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(x + w, y, x + w * 1.1, y - H * 0.25, x + w * 0.88, y - H * 0.42);
  ctx.quadraticCurveTo(x + w * 0.95 + sw * 0.3, y - H * 0.55, x + w * 0.8 + sw * 0.7, y - H * rt);
  ctx.quadraticCurveTo(x + w * 0.62, y - H * 0.5, x + w * 0.42 + sw * 0.2, y - H * 0.52);
  ctx.quadraticCurveTo(x + w * 0.6 + sw * 0.5, y - H * 0.8, x + sw, y - H);
  ctx.quadraticCurveTo(x - w * 0.45 + sw * 0.4, y - H * 0.78, x - w * 0.4 + sw * 0.2, y - H * 0.58);
  ctx.quadraticCurveTo(x - w * 0.6, y - H * 0.52, x - w * 0.8 + sw * 0.6, y - H * lt);
  ctx.quadraticCurveTo(x - w * 1.02, y - H * 0.45, x - w * 0.9, y - H * 0.32);
  ctx.bezierCurveTo(x - w * 1.1, y - H * 0.12, x - w * 0.95, y, x, y);
  ctx.closePath();
}

// Layered flame (outer → core) at (x, y). Sizes in caller units.
function drawFlame(ctx, pal, x, y, w, h, t, ph, edge) {
  const layers = [[1, 1, 0], [0.74, 0.74, 1.3], [0.5, 0.5, 2.2], [0.27, 0.3, 3.1]];
  for (let i = 0; i < 4; i++) {
    const [sw, sh, p] = layers[i];
    ctx.beginPath();
    flamePath(ctx, x, y - w * 0.05 * i, w * sw, h * sh, t, ph + p);
    ctx.fillStyle = pal[i];
    ctx.fill();
    if (i === 0 && edge) {
      ctx.strokeStyle = edge;
      ctx.lineWidth = w * 0.12;
      ctx.stroke();
    }
  }
}

// Egg outline (y-down: narrow end up), height h, width 0.75h.
function eggPath(ctx, h, x = 0, y = 0, fresh = true) {
  const w = h * 0.75;
  if (fresh) ctx.beginPath();
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * TAU;
    const sy = Math.sin(a);
    const px = x + (w / 2) * Math.cos(a) * (1 + 0.13 * sy);
    const py = y + (h / 2) * sy;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
}
function eggPoint(a, h) {
  const sy = Math.sin(a);
  return [(h * 0.375) * Math.cos(a) * (1 + 0.13 * sy), (h / 2) * sy];
}

// Four-point sparkle star.
function sparkle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.closePath();
  ctx.fill();
}

// Granite speckles, fixed per module: [x, y, r, colour index] in a ±50 box.
const SPECKS = [];
for (let i = 0; i < 70; i++) SPECKS.push([hash(i) * 100 - 50, hash(i + 99) * 100 - 50, 0.8 + hash(i + 7) * 2.2, (hash(i + 3) * 4) | 0]);
const SPECK_COL = ['#2c2825', '#f2ece4', '#b98f80', '#57504a'];

function speckle(ctx, scale, alpha) {
  for (let c = 0; c < 4; c++) {
    ctx.fillStyle = SPECK_COL[c];
    ctx.globalAlpha = alpha * (c === 1 ? 0.8 : 0.7);
    ctx.beginPath();
    for (const [x, y, r, ci] of SPECKS) {
      if (ci !== c) continue;
      ctx.moveTo(x * scale + r, y * scale);
      ctx.arc(x * scale, y * scale, r, 0, TAU);
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Iridescent rim colours: conic where supported, else a linear sweep.
function rainbow(ctx, r, rot) {
  let g;
  if (ctx.createConicGradient) g = ctx.createConicGradient(rot, 0, 0);
  else g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, 'rgba(255,120,200,0.95)');
  g.addColorStop(0.2, 'rgba(255,230,120,0.95)');
  g.addColorStop(0.4, 'rgba(120,255,190,0.95)');
  g.addColorStop(0.6, 'rgba(110,200,255,0.95)');
  g.addColorStop(0.8, 'rgba(190,140,255,0.95)');
  g.addColorStop(1, 'rgba(255,120,200,0.95)');
  return g;
}

/* ------------------------------------------------------------- emblems */
// Emblems are drawn in a space where the orb radius is 100.

const ROCK = [[-46, 6], [-40, -22], [-14, -42], [18, -38], [44, -16], [48, 12], [30, 38], [-6, 44], [-36, 32]];

function emblemStone(ctx) {
  const rock = () => {
    ctx.beginPath();
    ROCK.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  };
  rock();
  const g = ctx.createLinearGradient(-40, -40, 40, 40);
  g.addColorStop(0, '#d2cbc2');
  g.addColorStop(0.5, '#958b82');
  g.addColorStop(1, '#5a524b');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // facets
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.moveTo(-40, -22);
  ctx.lineTo(-14, -42);
  ctx.lineTo(18, -38);
  ctx.lineTo(6, -12);
  ctx.lineTo(-22, -6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.beginPath();
  ctx.moveTo(18, -38);
  ctx.lineTo(44, -16);
  ctx.lineTo(48, 12);
  ctx.lineTo(16, 8);
  ctx.lineTo(6, -12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.26)';
  ctx.beginPath();
  ctx.moveTo(48, 12);
  ctx.lineTo(30, 38);
  ctx.lineTo(-6, 44);
  ctx.lineTo(-10, 16);
  ctx.lineTo(16, 8);
  ctx.closePath();
  ctx.fill();
  speckle(ctx, 1, 1);
  ctx.restore();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(40,34,30,0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-22, -6);
  ctx.lineTo(6, -12);
  ctx.lineTo(16, 8);
  ctx.lineTo(-10, 16);
  ctx.moveTo(6, -12);
  ctx.lineTo(18, -38);
  ctx.stroke();
  rock();
  ctx.strokeStyle = '#26211d';
  ctx.lineWidth = 6;
  ctx.stroke();
}

function emblemBubble(ctx, t) {
  const wob = Math.sin(t * 4) * 0.04;
  ctx.save();
  ctx.scale(1 + wob, 1 - wob);
  ctx.beginPath();
  ctx.arc(0, 0, 50, 0, TAU);
  const g = ctx.createRadialGradient(0, 0, 20, 0, 0, 50);
  g.addColorStop(0, 'rgba(200,245,255,0.05)');
  g.addColorStop(0.8, 'rgba(200,245,255,0.22)');
  g.addColorStop(1, 'rgba(230,250,255,0.6)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = rainbow(ctx, 50, t * 0.8);
  ctx.stroke();
  // reflections
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, 36, Math.PI * 1.08, Math.PI * 1.42);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-17, -33, 4.5, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 38, Math.PI * 0.15, Math.PI * 0.4);
  ctx.stroke();
  ctx.restore();
  // little companion bubbles
  ctx.lineWidth = 3;
  for (let i = 0; i < 2; i++) {
    const k = mod(t * 0.4 + i * 0.5, 1);
    const x = i ? 50 : -54, y = 40 - k * 30, r = i ? 9 : 7;
    ctx.globalAlpha = Math.sin(k * Math.PI);
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = rainbow(ctx, r, t);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function emblemWater(ctx, t) {
  const drop = () => {
    ctx.beginPath();
    ctx.moveTo(0, -58);
    ctx.bezierCurveTo(10, -38, 38, -8, 38, 16);
    ctx.arc(0, 16, 38, 0, Math.PI);
    ctx.bezierCurveTo(-38, -8, -10, -38, 0, -58);
    ctx.closePath();
  };
  ctx.save();
  ctx.translate(0, Math.sin(t * 2.5) * 2.5);
  drop();
  const g = ctx.createRadialGradient(-10, 4, 4, 0, 10, 56);
  g.addColorStop(0, '#d6f2ff');
  g.addColorStop(0.45, '#4fb0ff');
  g.addColorStop(1, '#1250c2');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#0b2f73';
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 16, 26, Math.PI * 0.95, Math.PI * 1.25);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-19, -10, 4, 0, TAU);
  ctx.fill();
  ctx.restore();
}

const BOLT = [[14, -60], [-30, 6], [-4, 6], [-18, 60], [32, -12], [6, -12], [22, -60]];

function emblemThunder(ctx, t) {
  const flick = mod(t * 3, 1) < 0.08 ? 1.08 : 1;
  ctx.save();
  ctx.scale(flick, flick);
  ctx.lineJoin = 'round';
  // glow
  ctx.beginPath();
  BOLT.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.strokeStyle = 'rgba(160,200,255,0.45)';
  ctx.lineWidth = 18;
  ctx.stroke();
  const g = ctx.createLinearGradient(0, -60, 0, 60);
  g.addColorStop(0, '#fffde8');
  g.addColorStop(0.5, '#ffe14a');
  g.addColorStop(1, '#ffab00');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#5a3a00';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.restore();
  // crackle sparks
  const f = Math.floor(t * 10);
  ctx.strokeStyle = '#d9f1ff';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = hash(f * 3 + i) * TAU;
    let x = Math.cos(a) * 46, y = Math.sin(a) * 46;
    ctx.moveTo(x, y);
    for (let j = 0; j < 3; j++) {
      x += Math.cos(a) * 7 + (hash(f + i * 7 + j) - 0.5) * 12;
      y += Math.sin(a) * 7 + (hash(f + i * 5 + j + 40) - 0.5) * 12;
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}

function emblemThorn(ctx, t) {
  ctx.save();
  ctx.rotate(t * 0.6);
  const n = 11;
  // spikes
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const a0 = a - 0.27, a1 = a + 0.27;
    const L = i % 2 ? 54 : 62;
    ctx.moveTo(Math.cos(a0) * 26, Math.sin(a0) * 26);
    ctx.lineTo(Math.cos(a + 0.08) * L, Math.sin(a + 0.08) * L);
    ctx.lineTo(Math.cos(a1) * 26, Math.sin(a1) * 26);
    ctx.closePath();
  }
  const sg = ctx.createRadialGradient(0, 0, 26, 0, 0, 62);
  sg.addColorStop(0, '#8a6a34');
  sg.addColorStop(0.55, '#c99a52');
  sg.addColorStop(1, '#ff4a3a');
  ctx.fillStyle = sg;
  ctx.fill();
  ctx.strokeStyle = '#1f0c06';
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.restore();
  // body
  ctx.beginPath();
  ctx.arc(0, 0, 32, 0, TAU);
  const g = ctx.createRadialGradient(-10, -12, 3, 0, 0, 32);
  g.addColorStop(0, '#8a6a3a');
  g.addColorStop(1, '#3a2412');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#1f0c06';
  ctx.lineWidth = 5;
  ctx.stroke();
  // angry eyes and a jagged grimace
  ctx.fillStyle = '#ffe14a';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * 4, -6);
    ctx.lineTo(sx * 20, -14);
    ctx.lineTo(sx * 18, -2);
    ctx.quadraticCurveTo(sx * 9, 2, sx * 4, -6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#c4141f';
  ctx.beginPath();
  ctx.arc(-11, -5, 3.4, 0, TAU);
  ctx.arc(11, -5, 3.4, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#ffe14a';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-14, 14);
  ctx.lineTo(-7, 9);
  ctx.lineTo(0, 14);
  ctx.lineTo(7, 9);
  ctx.lineTo(14, 14);
  ctx.stroke();
}

function emblemMagnet(ctx, t) {
  ctx.save();
  ctx.translate(0, 2);
  const shoe = () => {
    ctx.beginPath();
    ctx.moveTo(-44, -6);
    ctx.arc(0, -6, 44, Math.PI, TAU);
    ctx.lineTo(44, 42);
    ctx.lineTo(18, 42);
    ctx.lineTo(18, -6);
    ctx.arc(0, -6, 18, 0, Math.PI, true);
    ctx.lineTo(-18, 42);
    ctx.lineTo(-44, 42);
    ctx.closePath();
  };
  shoe();
  const g = ctx.createLinearGradient(-44, -50, 44, 40);
  g.addColorStop(0, '#ff8a8a');
  g.addColorStop(0.5, '#e8232f');
  g.addColorStop(1, '#9a0f1a');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  const sg = ctx.createLinearGradient(-44, 0, 44, 0);
  sg.addColorStop(0, '#f4f7fb');
  sg.addColorStop(0.5, '#aeb8c4');
  sg.addColorStop(1, '#6a7480');
  ctx.fillStyle = sg;
  ctx.fillRect(-50, 22, 100, 30);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, -6, 32, Math.PI * 1.12, Math.PI * 1.45);
  ctx.stroke();
  ctx.restore();
  shoe();
  ctx.strokeStyle = '#3a0a0e';
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-44, 22);
  ctx.lineTo(-18, 22);
  ctx.moveTo(18, 22);
  ctx.lineTo(44, 22);
  ctx.lineWidth = 4;
  ctx.stroke();
  // pull lines pulsing below the poles
  const k = mod(t * 1.5, 1);
  ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - k)})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (const sx of [-1, 1]) {
    const y = 50 + k * 10;
    ctx.moveTo(sx * 31 - 10, y);
    ctx.quadraticCurveTo(sx * 31, y + 6, sx * 31 + 10, y);
  }
  ctx.stroke();
  ctx.restore();
}

function goldEgg(ctx, x, y, h, a, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  eggPath(ctx, h);
  const g = ctx.createLinearGradient(-h * 0.4, -h * 0.5, h * 0.4, h * 0.5);
  g.addColorStop(0, '#fff6c2');
  g.addColorStop(0.45, '#ffcf3a');
  g.addColorStop(1, '#b0700a');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // moving shine band
  const sx = (mod(t * 0.5, 1) * 2 - 1) * h;
  const sh = ctx.createLinearGradient(sx - h * 0.2, 0, sx + h * 0.2, 0);
  sh.addColorStop(0, 'rgba(255,255,255,0)');
  sh.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  sh.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sh;
  ctx.rotate(0.4);
  ctx.fillRect(-h, -h, h * 2, h * 2);
  ctx.restore();
  eggPath(ctx, h);
  ctx.strokeStyle = '#6b4300';
  ctx.lineWidth = Math.max(4, h * 0.07);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(-h * 0.14, -h * 0.2, h * 0.07, h * 0.12, 0.4, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function emblemTwin(ctx, t) {
  goldEgg(ctx, -18, -2, 70, -0.28, t);
  goldEgg(ctx, 17, 8, 74, 0.22, t + 0.6);
  ctx.fillStyle = '#ffffff';
  const k = 0.6 + 0.4 * Math.sin(t * 5);
  sparkle(ctx, 40, -38, 12 * k);
  sparkle(ctx, -44, 34, 8 * (1.4 - k));
}

function emblemGolden(ctx, t) {
  goldEgg(ctx, 0, 2, 98, 0, t);
  ctx.fillStyle = '#ffffff';
  const k = 0.6 + 0.4 * Math.sin(t * 5);
  sparkle(ctx, 32, -40, 13 * k);
  sparkle(ctx, -36, 30, 9 * (1.4 - k));
}

function emblemFire(ctx, id, t) {
  const pal = FLAME[id];
  if (id === 'fire_gold') {
    // sun rays behind the flame
    ctx.save();
    ctx.rotate(t * 0.5);
    ctx.fillStyle = 'rgba(255,214,90,0.9)';
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const L = i % 2 ? 58 : 68;
      ctx.moveTo(Math.cos(a - 0.13) * 34, Math.sin(a - 0.13) * 34);
      ctx.lineTo(Math.cos(a) * L, Math.sin(a) * L);
      ctx.lineTo(Math.cos(a + 0.13) * 34, Math.sin(a + 0.13) * 34);
    }
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, TAU);
    const sg = ctx.createRadialGradient(0, 0, 5, 0, 0, 40);
    sg.addColorStop(0, '#fff6c0');
    sg.addColorStop(1, '#ffb21a');
    ctx.fillStyle = sg;
    ctx.fill();
    drawFlame(ctx, pal, 0, 44, 34, 92, t, 0.5, '#a84a00');
    return;
  }
  if (id === 'fire_black') {
    // purple ember haze behind the dark flame
    const hg = ctx.createRadialGradient(0, 10, 5, 0, 10, 60);
    hg.addColorStop(0, 'rgba(200,90,255,0.6)');
    hg.addColorStop(1, 'rgba(200,90,255,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(-70, -60, 140, 130);
    drawFlame(ctx, pal, 0, 48, 40, 104, t, 0, '#c35cff');
    embers(ctx, t, '#e3a0ff', 6, 40, 1);
    return;
  }
  drawFlame(ctx, pal, 0, 48, 40, 104, t, id === 'fire_green' ? 2 : 0, id === 'fire_green' ? '#0a4f22' : '#7a1204');
  embers(ctx, t, pal[2], 4, 36, 1);
}

// Rising sparks above a flame (emblem space).
function embers(ctx, t, col, n, spread, scale) {
  ctx.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const k = mod(t * 0.9 + i / n, 1);
    const x = (hash(i * 3.1) - 0.5) * spread * 2 + Math.sin(t * 3 + i) * 5;
    const y = (20 - k * 80) * scale;
    ctx.globalAlpha = Math.sin(k * Math.PI);
    ctx.beginPath();
    ctx.arc(x * scale, y, 3.5 * scale * (1 - k * 0.5), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Hourglass: sand runs from the top bulb to the bottom while a gold ring turns slowly behind it.
function emblemHourglass(ctx, t) {
  const k = mod(t * 0.35, 1); // top empties, bottom fills, then it flips
  const flip = k > 0.92 ? Math.sin(((k - 0.92) / 0.08) * Math.PI * 0.5) : 0;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.rotate(flip * Math.PI);
  const fill = k > 0.92 ? 1 : k / 0.92;
  const bulb = (dir) => {
    ctx.beginPath();
    ctx.moveTo(-30, dir * -50);
    ctx.bezierCurveTo(-34, dir * -18, -8, dir * -10, -5, 0);
    ctx.lineTo(5, 0);
    ctx.bezierCurveTo(8, dir * -10, 34, dir * -18, 30, dir * -50);
    ctx.closePath();
  };
  // glass
  for (const dir of [1, -1]) {
    bulb(dir);
    ctx.fillStyle = 'rgba(255,248,225,0.55)';
    ctx.fill();
  }
  // sand: top (shrinking) and bottom (growing)
  const sandTop = 1 - fill, sandBot = fill;
  ctx.save();
  bulb(1);
  ctx.clip();
  ctx.fillStyle = '#f0b43a';
  ctx.fillRect(-40, -50 + 44 * (1 - sandTop) , 80, 44 * sandTop + 6);
  ctx.restore();
  ctx.save();
  bulb(-1);
  ctx.clip();
  ctx.fillStyle = '#f0b43a';
  ctx.beginPath();
  ctx.moveTo(-34, 50);
  ctx.lineTo(34, 50);
  ctx.lineTo(0, 50 - 40 * sandBot - 3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  if (k < 0.92) {
    ctx.strokeStyle = '#f0b43a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.lineTo(0, 50 - 40 * sandBot);
    ctx.stroke();
  }
  for (const dir of [1, -1]) {
    bulb(dir);
    ctx.strokeStyle = '#4a2c06';
    ctx.lineWidth = 6;
    ctx.stroke();
  }
  // glass shine
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-23, -44);
  ctx.quadraticCurveTo(-26, -24, -12, -14);
  ctx.moveTo(-23, 44);
  ctx.quadraticCurveTo(-26, 26, -16, 20);
  ctx.stroke();
  // caps
  for (const y of [-56, 56]) {
    const g = ctx.createLinearGradient(0, y - 7, 0, y + 7);
    g.addColorStop(0, '#ffe08a');
    g.addColorStop(1, '#a8701a');
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-40, y - 7, 80, 14, 5) : ctx.rect(-40, y - 7, 80, 14);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#4a2c06';
    ctx.stroke();
  }
  ctx.restore();
  // twinkles
  ctx.fillStyle = '#fff8d0';
  for (let i = 0; i < 3; i++) {
    const a = t * 0.8 + (i / 3) * TAU, r = 66;
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4 + i * 2);
    sparkle(ctx, Math.cos(a) * r, Math.sin(a) * r, 8);
  }
  ctx.globalAlpha = 1;
}

// Guardian feather: one big shimmering feather over a faint shield ring.
function emblemFeather(ctx, t) {
  ctx.save();
  ctx.scale(1.16, 1.16);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // shield ring
  ctx.beginPath();
  ctx.arc(0, 0, 66, 0, TAU);
  ctx.strokeStyle = 'rgba(190,245,255,0.55)';
  ctx.lineWidth = 7;
  ctx.setLineDash([16, 10]);
  ctx.lineDashOffset = -t * 18;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.translate(0, Math.sin(t * 2.2) * 2);
  ctx.rotate(0.62 + Math.sin(t * 1.4) * 0.05);
  // vane
  const vane = () => {
    ctx.beginPath();
    ctx.moveTo(0, 62);
    ctx.bezierCurveTo(-34, 36, -40, -22, -6, -66);
    ctx.bezierCurveTo(8, -52, 30, -50, 36, -20);
    ctx.bezierCurveTo(40, 18, 22, 46, 0, 62);
    ctx.closePath();
  };
  vane();
  const g = ctx.createLinearGradient(-30, -50, 30, 50);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.5, '#a8ecff');
  g.addColorStop(1, '#3fb6ea');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // barbs
  ctx.strokeStyle = 'rgba(20,100,150,0.4)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const y = -50 + i * 12.5;
    ctx.moveTo(0, y + 8);
    ctx.lineTo(-34, y - 6);
    ctx.moveTo(0, y + 8);
    ctx.lineTo(36, y - 8);
  }
  ctx.stroke();
  // notch cut and shimmer sweep
  const sx = (mod(t * 0.6, 1.6) - 0.3) * 120 - 60;
  const sh = ctx.createLinearGradient(sx - 14, 0, sx + 14, 0);
  sh.addColorStop(0, 'rgba(255,255,255,0)');
  sh.addColorStop(0.5, 'rgba(255,255,255,0.85)');
  sh.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sh;
  ctx.fillRect(-60, -80, 120, 160);
  ctx.restore();
  vane();
  ctx.strokeStyle = '#0f4a6e';
  ctx.lineWidth = 6;
  ctx.stroke();
  // quill
  ctx.beginPath();
  ctx.moveTo(0, 78);
  ctx.quadraticCurveTo(2, 20, -2, -62);
  ctx.strokeStyle = '#0f4a6e';
  ctx.lineWidth = 9;
  ctx.stroke();
  ctx.strokeStyle = '#eafcff';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 3; i++) {
    const a = -t * 1.1 + (i / 3) * TAU;
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4 + i * 2);
    sparkle(ctx, Math.cos(a) * 66, Math.sin(a) * 66, 9);
  }
  ctx.globalAlpha = 1;
}

// Rock skin: an egg wrapped in chiselled stone plates (the egg shape tells it from the plain stone orb).
function emblemRockskin(ctx, t) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.translate(0, Math.sin(t * 2) * 2);
  eggPath(ctx, 128);
  const g = ctx.createLinearGradient(-40, -50, 40, 50);
  g.addColorStop(0, '#dcd5cb');
  g.addColorStop(0.5, '#9a9086');
  g.addColorStop(1, '#4e4640');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // plates
  const plates = [[[-60, -20], [-10, -30], [6, 6], [-34, 22]], [[-10, -30], [40, -14], [30, 20], [6, 6]], [[-34, 22], [6, 6], [30, 20], [0, 70]], [[-10, -64], [-10, -30], [-60, -20], [-40, -52]]];
  plates.forEach((pl, i) => {
    ctx.beginPath();
    pl.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = ['rgba(255,255,255,0.2)', 'rgba(0,0,0,0.14)', 'rgba(0,0,0,0.26)', 'rgba(255,255,255,0.1)'][i];
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,24,20,0.7)';
    ctx.lineWidth = 3.4;
    ctx.stroke();
  });
  speckle(ctx, 1, 0.8);
  ctx.restore();
  eggPath(ctx, 128);
  ctx.strokeStyle = '#26211d';
  ctx.lineWidth = 6.5;
  ctx.stroke();
  // little pebbles circling
  ctx.fillStyle = '#9a9086';
  ctx.strokeStyle = '#26211d';
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    const a = t * 1.3 + (i / 3) * TAU;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 70, Math.sin(a) * 18 + 50, 6.5 - (Math.sin(a) < 0 ? 1.5 : 0), 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

// Fox curse: a sly fox face, purple curse sparkles around it.
function emblemFoxcurse(ctx, t) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const bob = Math.sin(t * 3) * 2;
  ctx.translate(0, bob + 4);
  // swirling curse wisps
  ctx.strokeStyle = 'rgba(190,90,255,0.65)';
  ctx.lineWidth = 6;
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    const a0 = t * 1.5 + i * Math.PI;
    ctx.arc(0, 0, 68, a0, a0 + 1.1);
    ctx.stroke();
  }
  // ears
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * 14, -26);
    ctx.lineTo(sx * 42, -62);
    ctx.lineTo(sx * 52, -12);
    ctx.closePath();
    ctx.fillStyle = '#ff8a2a';
    ctx.fill();
    ctx.strokeStyle = '#3a1608';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx * 24, -28);
    ctx.lineTo(sx * 40, -50);
    ctx.lineTo(sx * 44, -22);
    ctx.closePath();
    ctx.fillStyle = '#5a1f3a';
    ctx.fill();
  }
  // head
  ctx.beginPath();
  ctx.moveTo(-50, -14);
  ctx.quadraticCurveTo(-50, -34, 0, -34);
  ctx.quadraticCurveTo(50, -34, 50, -14);
  ctx.quadraticCurveTo(52, 20, 26, 40);
  ctx.quadraticCurveTo(0, 62, -26, 40);
  ctx.quadraticCurveTo(-52, 20, -50, -14);
  ctx.closePath();
  ctx.fillStyle = '#ff8a2a';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#3a1608';
  ctx.stroke();
  // cream muzzle
  ctx.beginPath();
  ctx.moveTo(-44, 6);
  ctx.quadraticCurveTo(-20, 14, 0, 2);
  ctx.quadraticCurveTo(20, 14, 44, 6);
  ctx.quadraticCurveTo(40, 30, 24, 40);
  ctx.quadraticCurveTo(0, 60, -24, 40);
  ctx.quadraticCurveTo(-40, 30, -44, 6);
  ctx.closePath();
  ctx.fillStyle = '#fff1dc';
  ctx.fill();
  // sly eyes: slanted, glowing yellow
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * 10, -8);
    ctx.quadraticCurveTo(sx * 24, -22, sx * 40, -8);
    ctx.quadraticCurveTo(sx * 26, -2, sx * 10, -8);
    ctx.closePath();
    ctx.fillStyle = '#ffe14a';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#3a1608';
    ctx.beginPath();
    ctx.ellipse(sx * 28, -10, 3, 4.6, 0, 0, TAU);
    ctx.fill();
  }
  // nose and grin
  ctx.fillStyle = '#3a1608';
  ctx.beginPath();
  ctx.ellipse(0, 16, 7, 5, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-24, 28);
  ctx.quadraticCurveTo(0, 50, 28, 24);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#3a1608';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(8, 38);
  ctx.lineTo(13, 46);
  ctx.lineTo(18, 34);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#d9a0ff';
  for (let i = 0; i < 3; i++) {
    const a = -t * 1.2 + (i / 3) * TAU + 1;
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4 + i * 2);
    sparkle(ctx, Math.cos(a) * 72, Math.sin(a) * 72 - 4, 9);
  }
  ctx.globalAlpha = 1;
}

function drawEmblem(ctx, id, t) {
  if (id && id.startsWith('fire_') && FLAME[id]) emblemFire(ctx, id, t);
  else if (id === 'stone') emblemStone(ctx);
  else if (id === 'bubble') emblemBubble(ctx, t);
  else if (id === 'water') emblemWater(ctx, t);
  else if (id === 'thunder') emblemThunder(ctx, t);
  else if (id === 'thorn') emblemThorn(ctx, t);
  else if (id === 'magnet') emblemMagnet(ctx, t);
  else if (id === 'twin') emblemTwin(ctx, t);
  else if (id === 'golden') emblemGolden(ctx, t);
  else if (id === 'hourglass') emblemHourglass(ctx, t);
  else if (id === 'feather') emblemFeather(ctx, t);
  else if (id === 'rockskin') emblemRockskin(ctx, t);
  else if (id === 'foxcurse') emblemFoxcurse(ctx, t);
}

// Mystery core: swirling cloudy arms and drifting motes, no emblem.
function drawMystery(ctx, rgb, t) {
  ctx.save();
  ctx.rotate(t * 0.9);
  ctx.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    ctx.save();
    ctx.rotate((k / 3) * TAU);
    ctx.beginPath();
    for (let i = 0; i <= 14; i++) {
      const u = i / 14;
      const a = u * 3.4;
      const rr = 8 + u * 74;
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.strokeStyle = `rgba(${rgb},0.55)`;
    ctx.lineWidth = 26;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  // glowing heart of the swirl
  const p = 0.8 + 0.2 * Math.sin(t * 3);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 44 * p);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.35, `rgba(${rgb},0.75)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 44 * p, 0, TAU);
  ctx.fill();
  // orbiting motes
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 3; i++) {
    const a = -t * 1.6 + (i / 3) * TAU;
    const rr = 48 + Math.sin(t * 2 + i) * 10;
    ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 4 + i * 2);
    sparkle(ctx, Math.cos(a) * rr, Math.sin(a) * rr, 9);
  }
  ctx.globalAlpha = 1;
}

/* ---------------------------------------------------------------- orbs */

// Floating power-up orb at (cx, cy), radius r. known = false shows the mystery swirl.
export function drawOrb(ctx, id, cx, cy, r, t = 0, known = true) {
  if (!(r > 0)) return;
  ctx.save();
  try {
    const rgb = RGB[id] || '200,200,200';
    const gl = GLASS[id] || GLASS_DEFAULT;
    const pulse = 1 + 0.06 * Math.sin(t * 3 + (id ? id.length : 0));
    ctx.translate(cx, cy + Math.sin(t * 2.2) * r * 0.04);
    // soft glow
    const halo = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, r * 1.75 * pulse);
    halo.addColorStop(0, `rgba(${rgb},0.6)`);
    halo.addColorStop(0.45, `rgba(${rgb},0.22)`);
    halo.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.75 * pulse, 0, TAU);
    ctx.fill();
    // sprite art for known orbs (glow/bob/pulse above stay); falls back to the code-drawn glass below
    if (known && spriteReady('orb_' + id)) {
      const calm = isSpriteCalm(), seed = id ? id.length : 0;
      if (!calm) {
        // slow-turning light rays behind the orb, breathing with the pulse
        ctx.save();
        ctx.rotate(t * 0.45 + seed);
        ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 6; k++) {
          ctx.save();
          ctx.rotate((k / 6) * TAU);
          const len = r * (1.75 + 0.2 * Math.sin(t * 2.4 + k * 1.7));
          const ray = ctx.createLinearGradient(r * 0.5, 0, len, 0);
          ray.addColorStop(0, `rgba(${rgb},0.4)`);
          ray.addColorStop(1, `rgba(${rgb},0)`);
          ctx.fillStyle = ray;
          ctx.beginPath();
          ctx.moveTo(0, -r * 0.2);
          ctx.lineTo(len, -r * 0.05);
          ctx.lineTo(len, r * 0.05);
          ctx.lineTo(0, r * 0.2);
          ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      }
      ctx.save();
      if (!calm) {
        ctx.rotate(Math.sin(t * 1.7 + seed) * 0.07); // a lazy wobble
        const sq = 1 + 0.045 * Math.sin(t * 3 + seed);
        ctx.scale(sq, 2 - sq); // pulse as a squash and stretch, volume kept
      }
      drawSprite(ctx, 'orb_' + id, 0, 0, r * 2);
      ctx.restore();
      if (!calm) {
        // a glint circling the rim
        const a = -t * 1.3 + seed;
        ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 5 + seed);
        ctx.fillStyle = '#ffffff';
        sparkle(ctx, Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, r * 0.13);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      return;
    }
    ctx.scale(r / 100, r / 100);
    // glass body
    const body = ctx.createRadialGradient(-30, -36, 6, 0, 0, 100);
    body.addColorStop(0, gl[0]);
    body.addColorStop(0.5, gl[1]);
    body.addColorStop(1, gl[2]);
    ctx.beginPath();
    ctx.arc(0, 0, 100, 0, TAU);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.save();
    ctx.clip();
    // inner light behind the emblem
    const core = ctx.createRadialGradient(0, 8, 0, 0, 8, 70);
    core.addColorStop(0, `rgba(${rgb},0.75)`);
    core.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = core;
    ctx.fillRect(-100, -100, 200, 200);
    if (known) {
      ctx.save();
      ctx.scale(1.12, 1.12);
      drawEmblem(ctx, id, t);
      ctx.restore();
    } else drawMystery(ctx, rgb, t);
    // rim shading and coloured bounce light
    const rim = ctx.createRadialGradient(0, 0, 70, 0, 0, 100);
    rim.addColorStop(0, 'rgba(0,0,0,0)');
    rim.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = rim;
    ctx.fillRect(-100, -100, 200, 200);
    const bounce = ctx.createRadialGradient(28, 70, 0, 28, 70, 70);
    bounce.addColorStop(0, `rgba(${rgb},0.7)`);
    bounce.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = bounce;
    ctx.fillRect(-100, -100, 200, 200);
    ctx.restore();
    // glossy highlights
    const hi = ctx.createLinearGradient(0, -92, 0, -20);
    hi.addColorStop(0, 'rgba(255,255,255,0.68)');
    hi.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hi;
    ctx.beginPath();
    ctx.ellipse(-12, -56, 54, 32, -0.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-50, -42, 11, 7, -0.8, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(52, 50, 5, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    // outline
    ctx.beginPath();
    ctx.arc(0, 0, 100, 0, TAU);
    ctx.strokeStyle = gl[2];
    ctx.lineWidth = Math.max(6, 120 / r);
    ctx.stroke();
  } catch (e) {
    // art must never break the frame
  }
  ctx.restore();
}

/* -------------------------------------------------------- egg overlays */

// Fire hugging the shell (egg-local units: h = 100): a wavy rim of flame plus tongues on top.
function eggFlames(ctx, pal, t, edge) {
  for (let layer = 0; layer < 2; layer++) {
    const base = layer ? 1.03 : 1.1, amp = layer ? 0.035 : 0.06, lift = layer ? 6 : 12;
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * TAU;
      const [ex, ey] = eggPoint(a, 100);
      const up = Math.max(0, -Math.sin(a));
      const k = 0.3 + 0.7 * (1 - Math.sin(a)) / 2; // thinner rim at the bottom: fire rises
      const sc = 1 + ((base - 1) + amp * (Math.sin(a * 7 + t * 9) + 0.6 * Math.sin(a * 11 - t * 13))) * k;
      const x = ex * sc, y = ey * sc - up * up * lift;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.closePath();
    eggPath(ctx, 100, 0, 0, false); // hole: keeps the face readable
    ctx.fillStyle = pal[layer];
    ctx.fill('evenodd');
    if (!layer && edge) {
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }
  const n = 5;
  for (let layer = 0; layer < 4; layer++) {
    const sc = [1, 0.74, 0.5, 0.27][layer];
    ctx.fillStyle = pal[layer];
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      if (layer === 3 && (i === 0 || i === n - 1)) continue;
      const a = Math.PI * (1.15 + (i / (n - 1)) * 0.7);
      const [px, py] = eggPoint(a, 100);
      const up = -Math.sin(a);
      const w = 12 + up * 6;
      const h = 22 + up * 22 + hash(i) * 6;
      flamePath(ctx, px * 0.96, py * 0.96 + 4, w * sc, h * (layer ? sc * 1.1 : 1), t, i * 1.9 + layer);
    }
    ctx.fill();
    if (layer === 0 && edge) {
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }
}

// Overlay on an egg while a power is active. Egg at (0,0), height h, y-down, already rotated.
export function drawEggPower(ctx, id, t, h) {
  if (!(h > 0)) return;
  ctx.save();
  try {
    ctx.scale(h / 100, h / 100);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (id === 'fire_red' || id === 'fire_black') overlayFire(ctx, id, t);
    else if (id === 'stone' || id === 'rockskin') overlayStone(ctx, t, h);
    else if (id === 'bubble') overlayBubble(ctx, t);
    else if (id === 'water') overlayWater(ctx, t);
    else if (id === 'thunder') overlayThunder(ctx, t);
    else if (id === 'golden') overlayGolden(ctx, t);
    else if (id === 'feather') overlayFeather(ctx, t);
    else if (id === 'foxcurse') overlayFoxcurse(ctx, t);
  } catch (e) {
    // art must never break the frame
  }
  ctx.restore();
}

function overlayFire(ctx, id, t) {
  const black = id === 'fire_black';
  const rgb = black ? '170,70,255' : '255,120,30';
  const g = ctx.createRadialGradient(0, -10, 20, 0, -10, 95);
  g.addColorStop(0, `rgba(${rgb},0.45)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(-100, -110, 200, 200);
  // heat tint on the shell
  eggPath(ctx, 100);
  const tg = ctx.createLinearGradient(0, -50, 0, 50);
  tg.addColorStop(0, black ? 'rgba(40,10,60,0.55)' : 'rgba(255,120,30,0.5)');
  tg.addColorStop(1, black ? 'rgba(40,10,60,0.1)' : 'rgba(255,120,30,0.05)');
  ctx.fillStyle = tg;
  ctx.fill();
  ctx.globalAlpha = 0.95;
  eggFlames(ctx, FLAME[id], t, black ? '#c35cff' : null);
  ctx.globalAlpha = 1;
  // sparks
  ctx.fillStyle = black ? '#e3a0ff' : '#ffd36a';
  for (let i = 0; i < 7; i++) {
    const k = mod(t * 0.8 + i / 7, 1);
    const x = (hash(i * 5.3) - 0.5) * 70 + Math.sin(t * 4 + i) * 6;
    const y = -40 - k * 70;
    ctx.globalAlpha = Math.sin(k * Math.PI);
    ctx.beginPath();
    ctx.arc(x, y, (black ? 3.2 : 2.6) * (1 - k * 0.5), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function overlayStone(ctx, t, hpx) {
  // heavy contact shadow so the egg feels like it weighs a ton
  ctx.save();
  ctx.scale(1, 0.34);
  const sg = ctx.createRadialGradient(0, 150, 4, 0, 150, 60);
  sg.addColorStop(0, 'rgba(0,0,0,0.38)');
  sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(-70, 80, 140, 140);
  ctx.restore();
  ctx.save();
  ctx.scale(1.07, 1.07);
  eggPath(ctx, 100);
  const g = ctx.createRadialGradient(-14, -22, 4, 0, 0, 66);
  g.addColorStop(0, '#e6e0d6');
  g.addColorStop(0.5, '#948b82');
  g.addColorStop(1, '#4a423c');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // bold plates: lit, mid and shadowed slabs
  const slabs = [[[-46, -18], [-8, -52], [12, -20], [-20, 2], 'rgba(255,255,255,0.3)'], [[12, -20], [52, -4], [52, 30], [18, 14], 'rgba(0,0,0,0.2)'], [[-20, 2], [12, -20], [18, 14], [-6, 36], 'rgba(255,255,255,0.08)'], [[-46, -18], [-20, 2], [-34, 30], [-52, 14], 'rgba(0,0,0,0.12)'], [[-6, 36], [18, 14], [52, 30], [28, 64], [-10, 60], 'rgba(0,0,0,0.34)']];
  for (const sl of slabs) {
    ctx.beginPath();
    for (let i = 0; i < sl.length - 1; i++) ctx.lineTo(sl[i][0], sl[i][1]);
    ctx.closePath();
    ctx.fillStyle = sl[sl.length - 1];
    ctx.fill();
  }
  speckle(ctx, 0.9, 1);
  // deep cracks: dark groove with a lit lip
  const crack = () => {
    ctx.beginPath();
    ctx.moveTo(-46, -18);
    ctx.lineTo(-20, 2);
    ctx.lineTo(12, -20);
    ctx.lineTo(18, 14);
    ctx.lineTo(-6, 36);
    ctx.lineTo(-20, 2);
    ctx.moveTo(12, -20);
    ctx.lineTo(-8, -52);
    ctx.moveTo(18, 14);
    ctx.lineTo(52, 30);
    ctx.moveTo(-6, 36);
    ctx.lineTo(-10, 60);
  };
  crack();
  ctx.translate(1.2, 1.4);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  crack();
  ctx.stroke();
  ctx.translate(-1.2, -1.4);
  crack();
  ctx.strokeStyle = 'rgba(25,20,17,0.85)';
  ctx.lineWidth = 3.2;
  ctx.stroke();
  // chiselled bevel
  eggPath(ctx, 84);
  const bv = ctx.createLinearGradient(-30, -40, 30, 40);
  bv.addColorStop(0, 'rgba(255,255,255,0.7)');
  bv.addColorStop(0.5, 'rgba(255,255,255,0)');
  bv.addColorStop(0.55, 'rgba(0,0,0,0)');
  bv.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.strokeStyle = bv;
  ctx.lineWidth = 9;
  ctx.stroke();
  ctx.restore();
  eggPath(ctx, 100);
  ctx.strokeStyle = '#1f1b18';
  ctx.lineWidth = Math.max(4, 190 / hpx);
  ctx.stroke();
  ctx.restore();
  // a few pebbles bounce off the shell
  ctx.fillStyle = '#8c8379';
  ctx.strokeStyle = '#1f1b18';
  ctx.lineWidth = 2.2;
  for (let i = 0; i < 3; i++) {
    const k = mod(t * 0.9 + i / 3, 1), a = Math.PI * (0.15 + 0.7 * hash(i + 4));
    const x = Math.cos(a) * (46 + k * 14) * (i % 2 ? -1 : 1), y = 40 - k * 30 + k * k * 70;
    ctx.globalAlpha = 1 - k * k;
    ctx.beginPath();
    ctx.moveTo(x - 4, y + 3);
    ctx.lineTo(x - 2, y - 4);
    ctx.lineTo(x + 4, y - 2);
    ctx.lineTo(x + 3, y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function overlayBubble(ctx, t) {
  const w = Math.sin(t * 5);
  ctx.save();
  ctx.scale(1 + w * 0.045, 1 - w * 0.045);
  const R = 66;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  const g = ctx.createRadialGradient(0, 0, R * 0.55, 0, 0, R);
  g.addColorStop(0, 'rgba(190,240,255,0.04)');
  g.addColorStop(0.85, 'rgba(190,240,255,0.18)');
  g.addColorStop(1, 'rgba(225,250,255,0.45)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 4;
  ctx.strokeStyle = rainbow(ctx, R, t * 0.9);
  ctx.stroke();
  ctx.restore();
  // window reflection and glints
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.8, Math.PI * 1.1, Math.PI * 1.4);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-R * 0.3, -R * 0.66, 3.6, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.84, Math.PI * 0.15, Math.PI * 0.38);
  ctx.stroke();
  ctx.restore();
}

function overlayWater(ctx, t) {
  // ripples spreading from the shell
  for (let i = 0; i < 2; i++) {
    const k = mod(t * 0.7 + i * 0.5, 1);
    ctx.save();
    ctx.globalAlpha = (1 - k) * 0.7;
    ctx.scale(1 + 0.3 * k, 1 + 0.26 * k);
    eggPath(ctx, 104);
    ctx.strokeStyle = '#6fc4ff';
    ctx.lineWidth = 3.5 * (1 - k * 0.5);
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.scale(1.05, 1.05);
  eggPath(ctx, 100);
  const g = ctx.createLinearGradient(0, -50, 0, 52);
  g.addColorStop(0, 'rgba(120,200,255,0.35)');
  g.addColorStop(0.5, 'rgba(40,140,255,0.62)');
  g.addColorStop(1, 'rgba(10,70,200,0.82)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // lapping water surface and caustic ribbons
  for (let i = 0; i < 3; i++) {
    const y0 = -18 + i * 26;
    ctx.beginPath();
    for (let x = -50; x <= 50; x += 5) {
      const y = y0 + Math.sin(x * 0.11 + t * 3 + i * 1.7) * 3.4;
      if (x === -50) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = i ? 'rgba(170,225,255,0.55)' : 'rgba(255,255,255,0.85)';
    ctx.lineWidth = i ? 2.4 : 3.4;
    ctx.stroke();
  }
  // glossy sheen
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(-26, 22);
  ctx.quadraticCurveTo(-34, -14, -12, -42);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.arc(-4, -46, 3.4, 0, TAU);
  ctx.fill();
  // rising bubbles
  for (let i = 0; i < 4; i++) {
    const k = mod(t * 0.5 + i / 4, 1);
    ctx.globalAlpha = Math.sin(k * Math.PI);
    ctx.strokeStyle = 'rgba(230,246,255,0.95)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc((hash(i + 12) - 0.5) * 50 + Math.sin(t * 2 + i) * 4, 44 - k * 88, 2.6 + hash(i) * 2.6, 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  eggPath(ctx, 100);
  ctx.strokeStyle = '#0d4aa8';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(190,230,255,0.7)';
  ctx.lineWidth = 1.6;
  eggPath(ctx, 94);
  ctx.stroke();
  ctx.restore();
  // drops shaken off the shell
  for (let i = 0; i < 4; i++) {
    const k = mod(t * 0.55 + i / 4, 1);
    const side = i % 2 ? 1 : -1, x = side * (44 + k * 12), y = -6 + k * 62;
    ctx.globalAlpha = 1 - k * k;
    ctx.beginPath();
    ctx.moveTo(x, y - 9);
    ctx.quadraticCurveTo(x + 5, y - 2, x + 4.4, y);
    ctx.arc(x, y, 4.4, 0, Math.PI);
    ctx.quadraticCurveTo(x - 5, y - 2, x, y - 9);
    ctx.closePath();
    ctx.fillStyle = '#5fb8ff';
    ctx.fill();
    ctx.strokeStyle = '#0d4aa8';
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Guardian feather: a bright shield of light around the egg, feathers circling, a shimmer sweeping across the shell.
function overlayFeather(ctx, t) {
  const pulse = 0.85 + 0.15 * Math.sin(t * 4);
  const g = ctx.createRadialGradient(0, 0, 30, 0, 0, 92 * pulse);
  g.addColorStop(0, 'rgba(160,240,255,0)');
  g.addColorStop(0.7, 'rgba(160,240,255,0.32)');
  g.addColorStop(1, 'rgba(160,240,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-100, -100, 200, 200);
  // shield rim: dashed ring turning around the egg
  ctx.save();
  ctx.scale(1.18, 1.12);
  eggPath(ctx, 100);
  ctx.fillStyle = 'rgba(190,245,255,0.14)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(235,252,255,0.95)';
  ctx.lineWidth = 3.4;
  ctx.setLineDash([22, 12]);
  ctx.lineDashOffset = -t * 40;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(70,190,240,0.7)';
  ctx.lineWidth = 1.6;
  ctx.scale(1.03, 1.03);
  eggPath(ctx, 100);
  ctx.stroke();
  ctx.restore();
  // shimmer sweeping over the shell
  ctx.save();
  eggPath(ctx, 100);
  ctx.clip();
  ctx.rotate(0.5);
  const sx = (mod(t * 0.7, 1.5) - 0.25) * 140 - 70;
  const sh = ctx.createLinearGradient(sx - 16, 0, sx + 16, 0);
  sh.addColorStop(0, 'rgba(255,255,255,0)');
  sh.addColorStop(0.5, 'rgba(255,255,255,0.7)');
  sh.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sh;
  ctx.fillRect(-120, -120, 240, 240);
  ctx.restore();
  // three little feathers orbiting
  for (let i = 0; i < 3; i++) {
    const a = t * 1.6 + (i / 3) * TAU, x = Math.cos(a) * 62, y = Math.sin(a) * 58 - 4;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a + Math.PI / 2 + 0.6);
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(a - 0.4);
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.quadraticCurveTo(-8, 0, 0, -12);
    ctx.quadraticCurveTo(8, 0, 0, 10);
    ctx.fillStyle = '#e8fbff';
    ctx.fill();
    ctx.strokeStyle = '#1f86b8';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 14);
    ctx.lineTo(0, -8);
    ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 4; i++) {
    const k = Math.sin(t * 3 + i * 1.7);
    if (k <= 0) continue;
    const [ex, ey] = eggPoint(hash(i + 31) * TAU, 100);
    sparkle(ctx, ex * 1.2, ey * 1.2, 6 * k);
  }
}

// Fox curse: orange fox ears, whisker cheeks and a sly grin on the shell, purple curse haze.
function overlayFoxcurse(ctx, t) {
  const g = ctx.createRadialGradient(0, 0, 20, 0, 0, 88);
  g.addColorStop(0, 'rgba(180,70,255,0)');
  g.addColorStop(0.75, 'rgba(180,70,255,0.28)');
  g.addColorStop(1, 'rgba(180,70,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-100, -100, 200, 200);
  // orange fur tint
  eggPath(ctx, 100);
  const tg = ctx.createLinearGradient(0, -50, 0, 50);
  tg.addColorStop(0, 'rgba(255,130,30,0.7)');
  tg.addColorStop(1, 'rgba(230,90,10,0.45)');
  ctx.fillStyle = tg;
  ctx.fill();
  // cream muzzle patch
  ctx.save();
  eggPath(ctx, 100);
  ctx.clip();
  ctx.beginPath();
  ctx.ellipse(0, 40, 36, 24, 0, 0, TAU);
  ctx.fillStyle = 'rgba(255,241,220,0.85)';
  ctx.fill();
  ctx.restore();
  eggPath(ctx, 100);
  ctx.strokeStyle = '#4a1c08';
  ctx.lineWidth = 3.4;
  ctx.stroke();
  // ears (flick now and then)
  const fl = mod(t * 0.4, 1) < 0.08 ? Math.sin(mod(t * 0.4, 1) / 0.08 * TAU) * 0.15 : 0;
  for (const sx of [-1, 1]) {
    ctx.save();
    ctx.translate(sx * 24, -38);
    ctx.rotate(sx * (0.22 + fl));
    ctx.beginPath();
    ctx.moveTo(-sx * 13, 6);
    ctx.lineTo(sx * 2, -34);
    ctx.lineTo(sx * 17, 4);
    ctx.closePath();
    ctx.fillStyle = '#ff8a2a';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#4a1c08';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-sx * 6, 2);
    ctx.lineTo(sx * 2, -22);
    ctx.lineTo(sx * 9, 2);
    ctx.closePath();
    ctx.fillStyle = '#6b2c4a';
    ctx.fill();
    ctx.fillStyle = '#3a1608'; // dark tip
    ctx.beginPath();
    ctx.moveTo(sx * 2 - 4, -26);
    ctx.lineTo(sx * 2, -34);
    ctx.lineTo(sx * 2 + 4, -26);
    ctx.fill();
    ctx.restore();
  }
  // whisker marks on the cheeks
  ctx.strokeStyle = '#4a1c08';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) { ctx.moveTo(sx * 30, 22 + i * 7); ctx.lineTo(sx * 46, 17 + i * 11); }
  ctx.stroke();
  // sly grin, wide with one fang
  ctx.beginPath();
  ctx.moveTo(-22, 18);
  ctx.quadraticCurveTo(0, 40, 24, 14);
  ctx.lineWidth = 3.6;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(6, 30);
  ctx.lineTo(10, 38);
  ctx.lineTo(15, 25);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.stroke();
  // wisps
  ctx.fillStyle = '#d9a0ff';
  for (let i = 0; i < 3; i++) {
    const k = mod(t * 0.7 + i / 3, 1);
    ctx.globalAlpha = Math.sin(k * Math.PI) * 0.9;
    sparkle(ctx, (i - 1) * 40 + Math.sin(t * 2 + i) * 6, -50 - k * 40, 7);
  }
  ctx.globalAlpha = 1;
}

function overlayThunder(ctx, t) {
  const g = ctx.createRadialGradient(0, 0, 30, 0, 0, 90);
  g.addColorStop(0, 'rgba(110,170,255,0.3)');
  g.addColorStop(1, 'rgba(110,170,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-100, -100, 200, 200);
  const f = Math.floor(t * 14);
  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = pass ? '#f2fbff' : 'rgba(90,160,255,0.55)';
    ctx.lineWidth = pass ? 2.4 : 8;
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const a0 = hash(f * 4 + k) * TAU;
      const span = 0.8 + hash(f * 4 + k + 50) * 0.7;
      for (let j = 0; j <= 7; j++) {
        const a = a0 + (j / 7) * span;
        const [ex, ey] = eggPoint(a, 100);
        const jit = (hash(f * 31 + k * 9 + j) - 0.5) * 16;
        const sc = 1.12 + jit / 60;
        const x = ex * sc, y = ey * sc;
        if (j) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
    }
    ctx.stroke();
  }
  // sparks
  ctx.fillStyle = '#e6f6ff';
  for (let i = 0; i < 4; i++) {
    const a = hash(f * 7 + i) * TAU;
    const [ex, ey] = eggPoint(a, 100);
    sparkle(ctx, ex * 1.25, ey * 1.25, 5);
  }
}

function overlayGolden(ctx, t) {
  eggPath(ctx, 100);
  const g = ctx.createLinearGradient(-30, -45, 30, 45);
  g.addColorStop(0, 'rgba(255,246,190,0.9)');
  g.addColorStop(0.45, 'rgba(255,205,60,0.88)');
  g.addColorStop(1, 'rgba(180,115,10,0.9)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  const sx = (mod(t * 0.4, 1) * 2.4 - 1.2) * 100;
  ctx.rotate(0.45);
  const sh = ctx.createLinearGradient(sx - 18, 0, sx + 18, 0);
  sh.addColorStop(0, 'rgba(255,255,255,0)');
  sh.addColorStop(0.5, 'rgba(255,255,255,0.7)');
  sh.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sh;
  ctx.fillRect(-120, -120, 240, 240);
  ctx.restore();
  eggPath(ctx, 100);
  ctx.strokeStyle = '#7a4f06';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 3; i++) {
    const k = Math.sin(t * 3 + i * 2.1);
    if (k <= 0) continue;
    const [x, y] = [[-22, -26], [26, 10], [-6, 34]][i];
    sparkle(ctx, x, y, 7 * k);
  }
}

/* ---------------------------------------------------------- popup card */

// Icon part of a power popup card: a big orb on the left of the rect. The caller writes the text.
export function drawPowerCard(ctx, id, x, y, w, h, t = 0, ui) {
  const r = Math.max(4, Math.min(h * 0.36, w * 0.18));
  drawOrb(ctx, id, x + Math.min(h * 0.5, r * 1.45), y + h / 2, r, t, true);
}
