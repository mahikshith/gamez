// Home screen scene (2026-11-05, mykee: "remove the chicken in the middle, make it fun"):
// a bouncy logo, a little vault whose rings spin until the gaps line up and an egg pops out,
// and a parade of egg friends hopping across the meadow. Tap an egg and it jumps and flips.
// Pure canvas art in screen pixels; no physics, no save state.

const TAU = Math.PI * 2;
const ease = (p) => (p <= 0 ? 0 : p >= 1 ? 1 : p * p * (3 - 2 * p));
const back = (p) => { const c = 1.9; p = Math.min(1, Math.max(0, p)); return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };

// egg looks: shell fill stops and an optional speckle colour
const KINDS = {
  classic: { hi: '#fffdf4', mid: '#f6e8cc', lo: '#d8bf96' },
  duck: { hi: '#f2fffa', mid: '#bfe3d6', lo: '#86bba9' },
  quail: { hi: '#fbf1dc', mid: '#e8cfa3', lo: '#c19a63', dots: '#6b4421' },
  golden: { hi: '#fff4bd', mid: '#ffcf45', lo: '#c08612' },
  choc: { hi: '#e8b98c', mid: '#b97a4c', lo: '#7d4a28' },
};
const ORDER = ['classic', 'duck', 'quail', 'classic', 'golden', 'choc', 'classic', 'duck'];
const LINE = '#4a2e15';

const S = { last: null, parade: [], spark: [], spawnN: 0, cycle: -1, popped: false, vaultEgg: null, layout: null };

function eggPath(ctx, h) {
  // y-down, centred on the egg's middle; narrower on top
  const w = h * 0.39, top = -h * 0.5, bot = h * 0.5;
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.bezierCurveTo(w * 0.78, top, w * 1.02, -h * 0.02, w, h * 0.12);
  ctx.bezierCurveTo(w * 0.98, h * 0.38, w * 0.56, bot, 0, bot);
  ctx.bezierCurveTo(-w * 0.56, bot, -w * 0.98, h * 0.38, -w, h * 0.12);
  ctx.bezierCurveTo(-w * 1.02, -h * 0.02, -w * 0.78, top, 0, top);
  ctx.closePath();
}

// One egg friend standing on (x, y) = the middle of its base. o: kind, sq (squash, +ve = flat), rot, blink 0..1,
// look (-1..1 eye shift), mouth 'smile' | 'open' | 'o', seed
export function drawEggFriend(ctx, x, y, h, o = {}) {
  const K = KINDS[o.kind] || KINDS.classic;
  const sq = o.sq || 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1 + sq * 0.6, 1 - sq);
  ctx.translate(0, -h * 0.5);
  ctx.rotate(o.rot || 0);
  // soft ground shadow is drawn by the caller; here the shell
  eggPath(ctx, h);
  const g = ctx.createRadialGradient(-h * 0.12, -h * 0.16, h * 0.04, 0, 0, h * 0.62);
  g.addColorStop(0, K.hi);
  g.addColorStop(0.5, K.mid);
  g.addColorStop(1, K.lo);
  ctx.fillStyle = g;
  ctx.fill();
  if (K.dots) {
    ctx.save();
    eggPath(ctx, h);
    ctx.clip();
    ctx.fillStyle = K.dots;
    let s = (o.seed || 7) * 9301 + 49297;
    const R = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.ellipse((R() - 0.5) * h * 0.7, (R() - 0.5) * h * 0.9, h * 0.025, h * 0.018, R() * 3, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  ctx.lineWidth = Math.max(1.5, h * 0.05);
  ctx.strokeStyle = LINE;
  eggPath(ctx, h);
  ctx.stroke();
  // face
  const ey = h * 0.02, ex = h * 0.13, lk = (o.look || 0) * h * 0.035;
  const bl = Math.max(0.08, 1 - (o.blink || 0));
  ctx.fillStyle = '#2a1a0c';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sx * ex + lk, ey, h * 0.05, h * 0.07 * bl, 0, 0, TAU);
    ctx.fill();
  }
  if (bl > 0.5) {
    ctx.fillStyle = '#fffaf0';
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * ex + lk + h * 0.016, ey - h * 0.025, h * 0.017, 0, TAU); ctx.fill(); }
  }
  ctx.fillStyle = 'rgba(240,110,110,0.45)';
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * h * 0.22, h * 0.13, h * 0.055, h * 0.035, 0, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = '#2a1a0c';
  ctx.fillStyle = '#7a2a1e';
  ctx.lineWidth = Math.max(1.2, h * 0.035);
  ctx.lineCap = 'round';
  const my = h * 0.16;
  if (o.mouth === 'open') {
    ctx.beginPath();
    ctx.moveTo(-h * 0.08 + lk, my);
    ctx.quadraticCurveTo(lk, my + h * 0.16, h * 0.08 + lk, my);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (o.mouth === 'o') {
    ctx.beginPath();
    ctx.ellipse(lk, my + h * 0.03, h * 0.035, h * 0.045, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(lk, my - h * 0.02, h * 0.07, 0.25, Math.PI - 0.25);
    ctx.stroke();
  }
  ctx.restore();
}

function shadow(ctx, x, y, h, lift) {
  const f = Math.max(0.35, 1 - lift / (h * 2.2));
  ctx.fillStyle = `rgba(40,30,10,${0.22 * f})`;
  ctx.beginPath();
  ctx.ellipse(x, y, h * 0.36 * f, h * 0.08 * f, 0, 0, TAU);
  ctx.fill();
}

function star(ctx, x, y, r, rot, col) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU - Math.PI / 2, rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = col;
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.22);
  ctx.strokeStyle = '#7a4a0a';
  ctx.stroke();
  ctx.restore();
}

// The logo: each letter bobs on its own beat and drops in with a bounce when the screen opens.
export function drawLogo(ctx, text, cx, cy, size, t, enter, font) {
  ctx.save();
  ctx.font = `600 ${Math.round(size)}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const ws = [...text].map((c) => ctx.measureText(c).width * 0.98);
  const total = ws.reduce((a, b) => a + b, 0);
  let x = cx - total / 2;
  [...text].forEach((c, i) => {
    const lx = x + ws[i] / 2;
    x += ws[i];
    const p = (enter - i * 0.07) / 0.55;
    if (p <= 0) return;
    const drop = (1 - back(p)) * -size * 1.4;
    const bob = Math.sin(t * 3.2 - i * 0.7) * size * 0.045;
    const rot = Math.sin(t * 2.1 - i * 0.9) * 0.06;
    ctx.save();
    ctx.translate(lx, cy + drop + bob);
    ctx.rotate(rot);
    ctx.lineWidth = size * 0.2;
    ctx.strokeStyle = '#5a2e0e';
    ctx.strokeText(c, 0, 0);
    const g = ctx.createLinearGradient(0, -size * 0.4, 0, size * 0.4);
    g.addColorStop(0, '#fff6d8');
    g.addColorStop(0.55, '#ffe08a');
    g.addColorStop(1, '#f5a623');
    ctx.fillStyle = g;
    ctx.fillText(c, 0, 0);
    ctx.restore();
  });
  ctx.restore();
  return { x: cx - total / 2 - size * 0.1, y: cy - size * 0.6, w: total + size * 0.2, h: size * 1.2 };
}

// ring layout for the toy vault: gap angle (screen, y-down) of ring i at cycle time
const CYCLE = 6.2, ALIGN = 3.4, OUT = 4.9;
const GAP_DOWN = Math.PI / 2; // straight down on screen
function offFor(c, i) {
  const r = Math.sin(c * 12.9898 + i * 78.233) * 43758.5453;
  const f = r - Math.floor(r);
  return (i % 2 ? -1 : 1) * (2.2 + f * 2.6);
}
function ringAngle(i, ct, c) {
  if (ct < ALIGN) return GAP_DOWN + offFor(c, i) * (1 - ease(ct / ALIGN));
  if (ct < OUT + 0.5) return GAP_DOWN;
  return GAP_DOWN + offFor(c + 1, i) * ease((ct - OUT - 0.5) / (CYCLE - OUT - 0.5));
}

function drawVault(ctx, cx, cy, R, t, c, ct) {
  const rings = 3;
  for (let i = 0; i < rings; i++) {
    const r = R * (0.42 + 0.29 * i), th = R * 0.1;
    const gap = (R * 0.36) / r; // the gap fits an egg
    const a0 = ringAngle(i, ct, c) + gap / 2, a1 = a0 + TAU - gap;
    // ring body: dark outline, wood, lighter top line
    ctx.lineCap = 'round';
    ctx.strokeStyle = LINE;
    ctx.lineWidth = th + 4;
    ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke();
    ctx.strokeStyle = ['#c9824a', '#b06f3c', '#9a5f33'][i];
    ctx.lineWidth = th;
    ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,214,150,0.55)';
    ctx.lineWidth = th * 0.22;
    ctx.beginPath(); ctx.arc(cx, cy, r - th * 0.22, a0 + 0.05, a1 - 0.05); ctx.stroke();
    // a sponge pad and a couple of thorns ride on each ring
    const pad = a0 + (TAU - gap) * (0.3 + 0.2 * i);
    ctx.strokeStyle = LINE; ctx.lineWidth = th * 0.75 + 3;
    ctx.beginPath(); ctx.arc(cx, cy, r, pad, pad + 0.5); ctx.stroke();
    ctx.strokeStyle = '#f2cf5b'; ctx.lineWidth = th * 0.75;
    ctx.beginPath(); ctx.arc(cx, cy, r, pad, pad + 0.5); ctx.stroke();
    for (const f of [0.68, 0.82]) {
      const a = a0 + (TAU - gap) * ((f + i * 0.09) % 1);
      const px = cx + Math.cos(a) * (r - th / 2), py = cy + Math.sin(a) * (r - th / 2);
      const nx = -Math.cos(a), ny = -Math.sin(a), tx = -ny, ty = nx, L = th * 0.9;
      ctx.beginPath();
      ctx.moveTo(px + tx * L * 0.4, py + ty * L * 0.4);
      ctx.lineTo(px + nx * L, py + ny * L);
      ctx.lineTo(px - tx * L * 0.4, py - ty * L * 0.4);
      ctx.closePath();
      ctx.fillStyle = '#c0392b'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = LINE; ctx.stroke();
    }
  }
}

function addFriend(x, h, kind) {
  S.parade.push({ x, kind, phase: Math.random(), jy: 0, jv: 0, spin: 0, rot: 0, seed: (S.spawnN++ * 37) % 97 + 3, cheer: 0, drop: null, h });
}

// State update + draw for the whole scene. L: { cx, cy, R (vault), ground, h (egg height), W, H, u }
export function drawTitleScene(ctx, L, t, calm) {
  const dt = S.last == null ? 0 : Math.min(0.05, Math.max(0, t - S.last));
  S.last = t;
  S.layout = L;
  const { u, ground, h } = L;
  const speed = (calm ? 18 : 34) * u;
  if (!S.parade.length) for (let i = 0; i < 4; i++) addFriend(L.W * (0.12 + i * 0.2), h, ORDER[i]);

  // the toy vault: rings spin until the gaps line up, the egg inside slips out and drops to the meadow
  const c = Math.floor(t / CYCLE), ct = t - c * CYCLE;
  if (c !== S.cycle) { S.cycle = c; S.popped = false; S.vaultKind = ORDER[(c + 4) % ORDER.length]; }
  if (L.R > 0) {
    drawVault(ctx, L.cx, L.cy, L.R, t, c, ct);
    const eh = Math.min(h, L.R * 0.34);
    if (ct < ALIGN + 0.35) {
      // waiting in the middle: looks around, a new egg pops in at the start of each cycle
      const pop = back(ct / 0.4);
      const look = Math.sin(t * 1.7) * 0.9;
      drawEggFriend(ctx, L.cx, L.cy + eh * 0.5, eh * pop, { kind: S.vaultKind, look, blink: (t * 0.7) % 1 < 0.06 ? 1 : 0, mouth: ct > ALIGN - 0.6 ? 'o' : 'smile', sq: Math.sin(t * 6) * 0.03, seed: c });
    } else if (!S.popped) {
      // sliding out through the lined-up gaps, then falling to the ground
      const p = (ct - ALIGN - 0.35) / (OUT - ALIGN - 0.35);
      const y0 = L.cy + eh * 0.5, y1 = ground;
      const y = y0 + (y1 - y0) * (p * p);
      drawEggFriend(ctx, L.cx, y, eh + (h - eh) * p, { kind: S.vaultKind, mouth: 'open', rot: Math.sin(t * 20) * 0.08, seed: c });
      if (p >= 1) {
        S.popped = true;
        addFriend(L.cx, h, S.vaultKind);
        const f = S.parade[S.parade.length - 1];
        f.jv = -h * 5.5; f.cheer = 1.2;
        burst(L.cx, ground - h * 0.3, u);
        L.onLand && L.onLand();
      }
    }
  }

  // the parade: everyone hops to the right; whoever leaves the screen comes back from the left
  for (const f of S.parade) {
    f.x += speed * dt * (f.jy < 0 ? 1.4 : 1);
    if (f.x > L.W + h) f.x = -h;
    if (f.jy < 0 || f.jv < 0) {
      f.jv += h * 22 * dt;
      f.jy += f.jv * dt;
      if (f.spin) f.rot = Math.min(1, f.rot + dt / 0.7);
      if (f.jy >= 0) { f.jy = 0; f.jv = 0; f.spin = 0; f.rot = 0; f.land = 0.18; }
    }
    if (f.land > 0) f.land -= dt;
    f.cheer = Math.max(0, f.cheer - dt);
  }
  // keep the line tidy: at most 7 friends (the oldest wanders off)
  while (S.parade.length > 7) S.parade.shift();
  const sorted = [...S.parade].sort((a, b) => a.x - b.x);
  for (const f of sorted) {
    const ph = (t * 1.9 + f.phase) % 1;
    const hop = f.jy < 0 ? 0 : Math.sin(ph * Math.PI) * h * 0.32;
    const lift = hop - f.jy;
    const sq = f.land > 0 ? 0.16 * (f.land / 0.18) : ph < 0.08 || ph > 0.92 ? 0.1 : -0.05 * Math.sin(ph * Math.PI);
    shadow(ctx, f.x, ground, h, lift);
    drawEggFriend(ctx, f.x, ground - lift, h, {
      kind: f.kind, sq, rot: f.spin ? f.rot * TAU : Math.sin(ph * TAU) * 0.08,
      blink: (t * 0.5 + f.phase) % 1 < 0.05 ? 1 : 0, look: 0.6,
      mouth: f.jy < 0 || f.cheer > 0 ? 'open' : 'smile', seed: f.seed,
    });
  }

  // sparkles from taps and landings: small gold stars, no glow
  for (const s of S.spark) {
    s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 300 * u * dt; s.rot += dt * 6;
    if (s.life > 0) star(ctx, s.x, s.y, s.r * Math.min(1, s.life / 0.3), s.rot, '#ffd23a');
  }
  S.spark = S.spark.filter((s) => s.life > 0);
}

function burst(x, y, u) {
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.38;
    S.spark.push({ x, y, vx: Math.cos(a) * 160 * u, vy: Math.sin(a) * 200 * u, r: (5 + (i % 3) * 1.5) * u, life: 0.7, rot: i });
  }
}

// A tap on a parade egg makes it jump and flip. Returns true when an egg took the tap.
export function titleTap(x, y) {
  const L = S.layout;
  if (!L) return false;
  for (const f of S.parade) {
    const top = L.ground - L.h * 1.4 + f.jy;
    if (Math.abs(x - f.x) < L.h * 0.75 && y > top && y < L.ground + L.h * 0.3) {
      if (f.jy < 0) return true;
      f.jv = -L.h * 7.5; f.jy = -0.01; f.spin = 1; f.rot = 0; f.cheer = 1;
      burst(f.x, L.ground - L.h * 0.5, L.u);
      return true;
    }
  }
  return false;
}
