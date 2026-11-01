// Power-up art: floating orbs, egg overlays, and popup-card icons. Pure Canvas 2D, no assets.
// All drawing is local y-DOWN; flames rise toward -y. The caller handles any world flip.

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
    else if (id === 'stone') overlayStone(ctx, t, h);
    else if (id === 'bubble') overlayBubble(ctx, t);
    else if (id === 'water') overlayWater(ctx, t);
    else if (id === 'thunder') overlayThunder(ctx, t);
    else if (id === 'golden') overlayGolden(ctx, t);
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
  eggPath(ctx, 100);
  const g = ctx.createRadialGradient(-12, -18, 6, 0, 0, 62);
  g.addColorStop(0, '#d4cdc4');
  g.addColorStop(0.55, '#9c938a');
  g.addColorStop(1, '#5e5650');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // broad facets
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.moveTo(-40, -20);
  ctx.lineTo(-6, -56);
  ctx.lineTo(10, -22);
  ctx.lineTo(-14, 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  ctx.moveTo(10, -22);
  ctx.lineTo(50, -6);
  ctx.lineTo(50, 60);
  ctx.lineTo(16, 24);
  ctx.closePath();
  ctx.fill();
  speckle(ctx, 0.9, 1);
  // chiselled bevel: light top-left, dark bottom-right
  eggPath(ctx, 86);
  const bv = ctx.createLinearGradient(-30, -40, 30, 40);
  bv.addColorStop(0, 'rgba(255,255,255,0.55)');
  bv.addColorStop(0.5, 'rgba(255,255,255,0)');
  bv.addColorStop(0.55, 'rgba(0,0,0,0)');
  bv.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.strokeStyle = bv;
  ctx.lineWidth = 7;
  ctx.stroke();
  // chisel marks
  ctx.strokeStyle = 'rgba(45,38,33,0.45)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-14, 2);
  ctx.lineTo(10, -22);
  ctx.lineTo(16, 24);
  ctx.moveTo(-14, 2);
  ctx.lineTo(-30, 28);
  ctx.moveTo(10, -22);
  ctx.lineTo(-6, -56);
  ctx.stroke();
  ctx.restore();
  eggPath(ctx, 100);
  ctx.strokeStyle = '#2e2924';
  ctx.lineWidth = Math.max(3, 150 / hpx);
  ctx.stroke();
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
  eggPath(ctx, 100);
  const g = ctx.createRadialGradient(-10, -14, 8, 0, 0, 60);
  g.addColorStop(0, 'rgba(140,210,255,0.12)');
  g.addColorStop(1, 'rgba(40,130,240,0.42)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,110,220,0.7)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.save();
  ctx.clip();
  // glossy sheen
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-24, 18);
  ctx.quadraticCurveTo(-30, -16, -10, -40);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(-4, -44, 3, 0, TAU);
  ctx.fill();
  ctx.restore();
  // drips sliding down the shell, then falling off the bottom
  for (let i = 0; i < 3; i++) {
    const k = mod(t * 0.45 + i / 3, 1);
    const x0 = [-18, 8, 24][i];
    let x, y, a = 1;
    if (k < 0.75) {
      const u = k / 0.75;
      y = -30 + u * 74;
      const [ex] = eggPoint(Math.asin(Math.max(-1, Math.min(1, y / 50))), 100);
      x = Math.sign(x0) * Math.min(Math.abs(x0), Math.abs(ex) * 0.8);
    } else {
      const u = (k - 0.75) / 0.25;
      x = x0 * 0.4;
      y = 46 + u * u * 30;
      a = 1 - u;
    }
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.moveTo(x, y - 9);
    ctx.quadraticCurveTo(x + 4.5, y - 2, x + 4, y);
    ctx.arc(x, y, 4, 0, Math.PI);
    ctx.quadraticCurveTo(x - 4.5, y - 2, x, y - 9);
    ctx.closePath();
    ctx.fillStyle = 'rgba(120,200,255,0.95)';
    ctx.fill();
    ctx.strokeStyle = '#1f6fc0';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x - 1.4, y - 1, 1.2, 0, TAU);
    ctx.fill();
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
