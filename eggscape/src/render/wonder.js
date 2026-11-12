// Wonder Vaults art: what the five mechanics need beyond the game's own rings, eggs, thorns, nest and hen.
// World-space helpers draw in metres, y up (the caller has scaled the context); the one light is top-left.
import { RING_TH, TAU, rng } from '../sim/geom.js';
import { mix, lighten, darken } from './ringart.js';
import { eggPath } from './world.js';

// ---------- space backdrop (screen space): deep sky, a soft nebula, stars that twinkle a little
let spaceKey = '', spaceCv = null;
export function drawSpace(ctx, W, H, t, hue = 0) {
  const key = W + 'x' + H + ':' + hue;
  if (key !== spaceKey) {
    spaceKey = key;
    spaceCv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H });
    const c = spaceCv.getContext('2d'), r = rng(31 + hue);
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, hue ? '#1a1030' : '#0a0c26'); g.addColorStop(0.55, hue ? '#33203f' : '#141a44'); g.addColorStop(1, hue ? '#5a3040' : '#27215a');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (const [fx, fy, fr, col] of [[0.2, 0.25, 0.5, hue ? 'rgba(255,150,90,0.16)' : 'rgba(90,120,255,0.18)'], [0.85, 0.7, 0.55, hue ? 'rgba(255,210,120,0.12)' : 'rgba(190,90,220,0.14)'], [0.6, 0.1, 0.35, 'rgba(80,220,220,0.08)']]) {
      const R = Math.max(W, H) * fr, n = c.createRadialGradient(W * fx, H * fy, 0, W * fx, H * fy, R);
      n.addColorStop(0, col); n.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = n; c.fillRect(0, 0, W, H);
    }
    const N = Math.round((W * H) / 2600);
    for (let i = 0; i < N; i++) {
      const x = r() * W, y = r() * H, s = 0.5 + r() * r() * 1.8;
      c.globalAlpha = 0.35 + r() * 0.6;
      c.fillStyle = r() < 0.2 ? '#ffe9b8' : r() < 0.3 ? '#bcd4ff' : '#ffffff';
      c.beginPath(); c.arc(x, y, s, 0, TAU); c.fill();
      if (s > 1.7) { c.globalAlpha *= 0.5; c.fillRect(x - s * 3, y - 0.4, s * 6, 0.8); c.fillRect(x - 0.4, y - s * 3, 0.8, s * 6); }
    }
    c.globalAlpha = 1;
  }
  ctx.drawImage(spaceCv, 0, 0, W, H);
  const r = rng(77); // a few live twinkles
  for (let i = 0; i < 14; i++) {
    const x = r() * W, y = r() * H, a = 0.5 + 0.5 * Math.sin(t * (1.2 + r() * 2) + r() * 6), s = 1.2 + 2.2 * a;
    ctx.globalAlpha = 0.25 + 0.6 * a; ctx.fillStyle = '#fff';
    ctx.beginPath();
    for (let k = 0; k < 8; k++) { const an = k * 0.7853982, rr = k & 1 ? s * 0.28 : s * 1.5; ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---------- the straw planet: a round nest at the centre of everything; saved eggs tuck into it where they landed
export function drawPlanet(ctx, sim, straw, t) {
  const R = sim.planetR, dk = mix(straw, '#3a1e04', 0.62), line = mix(straw, '#2a1402', 0.82);
  // glow of home
  const gl = ctx.createRadialGradient(0, 0, R * 0.6, 0, 0, R * 2.1);
  gl.addColorStop(0, 'rgba(255,214,120,0.34)'); gl.addColorStop(1, 'rgba(255,214,120,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, R * 2.1, 0, TAU); ctx.fill();
  // eggs already home, half sunk in the straw
  for (const s of sim.wsaved) {
    ctx.save();
    ctx.rotate(s.a - Math.PI / 2);
    ctx.translate(0, R - 0.02);
    ctx.scale(0.8, 0.8);
    eggPath(ctx);
    const g = ctx.createRadialGradient(-0.085, 0.12, 0.015, -0.02, 0.02, 0.36);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#fbeed6'); g.addColorStop(1, '#cfae80');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#6b4526'; ctx.lineWidth = 0.028; ctx.stroke();
    ctx.restore();
  }
  // the ball: lit top-left, shaded bottom-right
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU);
  const g = ctx.createRadialGradient(-R * 0.4, R * 0.45, R * 0.1, 0, 0, R * 1.05);
  g.addColorStop(0, lighten(straw, 0.4)); g.addColorStop(0.5, straw); g.addColorStop(1, mix(straw, '#2e1602', 0.7));
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  const r = rng(5);
  ctx.lineCap = 'round';
  for (let i = 0; i < 46; i++) { // woven straw: short arcs round the ball, light over dark
    const a0 = r() * TAU, rr = R * (0.25 + 0.75 * Math.sqrt(r())), len = 0.5 + r() * 0.8, lt = i % 3;
    ctx.strokeStyle = lt ? lighten(straw, 0.5, 0.75) : mix(straw, '#3a1e04', 0.7, 0.6);
    ctx.lineWidth = lt ? 0.022 : 0.04;
    ctx.beginPath(); ctx.arc((r() - 0.5) * 0.25, (r() - 0.5) * 0.25, rr, a0, a0 + len / Math.max(0.3, rr)); ctx.stroke();
  }
  ctx.restore();
  ctx.lineWidth = 0.045; ctx.strokeStyle = line; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
  // stray straws round the rim
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + 0.2 * Math.sin(i * 7.1), l = 0.1 + 0.07 * ((i * 37) % 5) / 4;
    ctx.strokeStyle = i % 2 ? lighten(straw, 0.3) : dk; ctx.lineWidth = 0.028;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * (R - 0.03), Math.sin(a) * (R - 0.03)); ctx.lineTo(Math.cos(a + 0.12) * (R + l), Math.sin(a + 0.12) * (R + l)); ctx.stroke();
  }
}

// ---------- the fuse as a sun: it orbits once and sets where it rose. frac = time left 1..0
export function drawSun(ctx, R, frac, t, fx) {
  const a0 = Math.PI / 2, a = a0 - TAU * (1 - frac), low = frac < 0.2;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 0.035;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
  if (frac > 0) { // the way it still has to go
    ctx.strokeStyle = low ? 'rgba(255,110,80,0.75)' : 'rgba(255,222,150,0.55)'; ctx.lineWidth = 0.05;
    ctx.setLineDash([0.02, 0.14]);
    ctx.beginPath(); ctx.arc(0, 0, R, a0 - TAU, a); ctx.stroke();
    ctx.setLineDash([]);
  }
  const x = R * Math.cos(a), y = R * Math.sin(a), s = 0.3 * (1 + (low ? 0.08 * Math.sin(t * 12) : 0.03 * Math.sin(t * 3)));
  const gl = ctx.createRadialGradient(x, y, s * 0.4, x, y, s * 3.2);
  gl.addColorStop(0, low ? 'rgba(255,120,70,0.55)' : 'rgba(255,214,110,0.5)'); gl.addColorStop(1, 'rgba(255,200,90,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, s * 3.2, 0, TAU); ctx.fill();
  ctx.fillStyle = low ? '#ff8a4a' : '#ffc94a';
  ctx.beginPath();
  for (let i = 0; i < 24; i++) { const an = (i / 24) * TAU + t * 0.4, rr = i & 1 ? s * 1.02 : s * 1.34; ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); }
  ctx.fill();
  const g = ctx.createRadialGradient(x - s * 0.35, y + s * 0.35, s * 0.1, x, y, s);
  g.addColorStop(0, '#fffbe0'); g.addColorStop(0.6, low ? '#ffb05a' : '#ffd95a'); g.addColorStop(1, low ? '#e8602a' : '#f0a81c');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
  ctx.restore();
  if (fx && frac > 0 && Math.random() < 0.25) fx.add({ x, y, vx: (Math.random() - 0.5) * 0.8, vy: (Math.random() - 0.5) * 0.8, life: 0.5, size: 0.05, color: '#ffe9a0', type: 'star', rot: Math.random() * 3, vr: 3, layer: 'back' });
}

// ---------- mama's rail: a wooden track round the vault that she runs on (feet out, head to the centre)
export function drawRail(ctx, R, col) {
  ctx.save();
  ctx.lineCap = 'butt';
  ctx.strokeStyle = 'rgba(8,4,16,0.3)'; ctx.lineWidth = 0.2; ctx.beginPath(); ctx.arc(0.03, -0.05, R, 0, TAU); ctx.stroke();
  ctx.strokeStyle = darken(col, 0.45); ctx.lineWidth = 0.15; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = 0.09; ctx.beginPath(); ctx.arc(0, 0, R - 0.015, 0, TAU); ctx.stroke();
  ctx.strokeStyle = lighten(col, 0.4, 0.8); ctx.lineWidth = 0.02; ctx.beginPath(); ctx.arc(0, 0, R - 0.05, 1.7, 3.6); ctx.stroke();
  ctx.strokeStyle = darken(col, 0.5, 0.7); ctx.lineWidth = 0.1;
  ctx.setLineDash([0.035, (TAU * R) / 48 - 0.035]);
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
  ctx.restore();
}
// the gravity compass: chevrons in the heart of the vault that point at her, and a soft warm pull on her side
export function drawPull(ctx, sim, t) {
  const H = sim.hen, ux = Math.cos(H.a), uy = Math.sin(H.a), R = sim.outerR;
  ctx.save();
  const g = ctx.createRadialGradient(ux * (R + 0.9), uy * (R + 0.9), 0.2, ux * (R + 0.9), uy * (R + 0.9), R * 1.25);
  g.addColorStop(0, 'rgba(255,214,120,0.26)'); g.addColorStop(1, 'rgba(255,214,120,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R + 0.5, 0, TAU); ctx.fill();
  ctx.rotate(H.a);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.9 + i / 3) % 1, x = R + 0.22 + ph * 0.55, a = Math.sin(ph * Math.PI) * 0.8;
    for (const [lw, col] of [[0.07, `rgba(60,30,0,${0.35 * a})`], [0.04, `rgba(255,232,150,${a})`]]) {
      ctx.strokeStyle = col; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(x - 0.09, 0.13); ctx.lineTo(x, 0); ctx.lineTo(x - 0.09, -0.13); ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------- the warm lamp (hatch): hangs from the ring above on a cord, a cone of light on the floor under it
export function drawLamp(ctx, sim, t, part) {
  const L = sim.lamp, top = sim.rings[L.ch - 1], ux = Math.cos(L.a), uy = Math.sin(L.a);
  const r0 = top ? top.r + RING_TH / 2 : 0, rs = Math.hypot(L.x, L.y) - 0.1, rf = sim.rings[L.ch].r - RING_TH / 2;
  const on = L.glow > 0 ? 1 : 0.75 + 0.08 * Math.sin(t * 5);
  ctx.save();
  ctx.rotate(L.a + Math.PI / 2); // local: y points from the floor up to the ring above (toward the centre)
  const yS = -rs, yF = -rf, y0 = -r0;
  if (part === 'light') {
    const g = ctx.createLinearGradient(0, yS, 0, yF);
    g.addColorStop(0, `rgba(255,205,110,${0.6 * on})`); g.addColorStop(1, `rgba(255,190,90,${0.1 * on})`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-0.16, yS); ctx.lineTo(0.16, yS); ctx.lineTo(0.62, yF); ctx.lineTo(-0.62, yF); ctx.closePath(); ctx.fill();
    const p = ctx.createRadialGradient(0, yF, 0, 0, yF, 0.7);
    p.addColorStop(0, `rgba(255,220,130,${0.5 * on})`); p.addColorStop(1, 'rgba(255,220,130,0)');
    ctx.save(); ctx.translate(0, yF); ctx.scale(1, 0.3); ctx.translate(0, -yF);
    ctx.fillStyle = p; ctx.beginPath(); ctx.arc(0, yF, 0.7, 0, TAU); ctx.fill(); ctx.restore();
  } else {
    ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(0, yS + 0.16); ctx.stroke();
    // bulb
    const b = ctx.createRadialGradient(-0.03, yS - 0.0, 0.01, 0, yS - 0.03, 0.13);
    b.addColorStop(0, '#fffbe6'); b.addColorStop(0.6, '#ffd35a'); b.addColorStop(1, '#f09a1c');
    ctx.fillStyle = b; ctx.beginPath(); ctx.arc(0, yS - 0.03, 0.1, 0, TAU); ctx.fill();
    // shade: a red enamel cone, lit on its left
    ctx.beginPath(); ctx.moveTo(-0.07, yS + 0.2); ctx.lineTo(0.07, yS + 0.2); ctx.lineTo(0.25, yS + 0.02); ctx.quadraticCurveTo(0, yS - 0.03, -0.25, yS + 0.02); ctx.closePath();
    const s = ctx.createLinearGradient(-0.25, 0, 0.25, 0);
    s.addColorStop(0, '#ff8a6a'); s.addColorStop(0.45, '#d8402c'); s.addColorStop(1, '#7a1a14');
    ctx.fillStyle = s; ctx.fill();
    ctx.strokeStyle = 'rgba(60,10,6,0.7)'; ctx.lineWidth = 0.018; ctx.stroke();
    ctx.fillStyle = '#3a2416'; ctx.fillRect(-0.045, yS + 0.19, 0.09, 0.05);
  }
  ctx.restore();
  void ux; void uy;
}

// a ring that cannot be turned: iron bolts round it
export function drawBolts(ctx, ring) {
  const n = Math.max(6, Math.round(ring.r * 3.2));
  for (let i = 0; i < n; i++) {
    const a = ring.body.getAngle() + (i / n) * TAU + 0.2, la = (i / n) * TAU + 0.2;
    if (!ring.segs.some((s) => s.alive && la >= s.a0 % TAU - 0.02 && la <= (s.a0 % TAU) + (s.a1 - s.a0) + 0.02)) continue;
    const x = ring.r * Math.cos(a), y = ring.r * Math.sin(a);
    ctx.fillStyle = 'rgba(10,6,4,0.45)'; ctx.beginPath(); ctx.arc(x + 0.012, y - 0.016, 0.05, 0, TAU); ctx.fill();
    const g = ctx.createRadialGradient(x - 0.015, y + 0.018, 0.004, x, y, 0.046);
    g.addColorStop(0, '#f2f4f7'); g.addColorStop(0.55, '#8d96a2'); g.addColorStop(1, '#3d444e');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 0.044, 0, TAU); ctx.fill();
  }
}

// an arrow along a ring showing which way it is turning (twin link). dir 1 = ccw
export function drawTurnArrow(ctx, R, at, dir, alpha, col = '#ffe08a') {
  if (alpha <= 0.01) return;
  const span = Math.min(1.1, 1.6 / R), a0 = at - (dir * span) / 2, a1 = at + (dir * span) / 2;
  ctx.save();
  ctx.globalAlpha = alpha; ctx.lineCap = 'round';
  for (const [lw, c] of [[0.13, 'rgba(40,20,0,0.5)'], [0.075, col]]) {
    ctx.strokeStyle = c; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(0, 0, R, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke();
    const hx = R * Math.cos(a1), hy = R * Math.sin(a1), tx = -Math.sin(a1) * dir, ty = Math.cos(a1) * dir, w = lw * 1.9;
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.moveTo(hx + tx * w * 1.5, hy + ty * w * 1.5); ctx.lineTo(hx + ty * w, hy - tx * w); ctx.lineTo(hx - ty * w, hy + tx * w); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// ---------- screen-space bits
// frozen time: a cold wash over the play area with slow frost motes
export function drawFrost(ctx, W, H, t, a) {
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = a;
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(120,190,255,0.10)'); g.addColorStop(1, 'rgba(60,120,220,0.42)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const r = rng(9);
  ctx.strokeStyle = 'rgba(235,248,255,0.85)'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const x = r() * W, y = r() * H, s = 3 + r() * 5, rot = t * 0.15 * (r() - 0.5) + r() * 3;
    ctx.globalAlpha = a * (0.35 + 0.4 * r());
    ctx.beginPath();
    for (let k = 0; k < 3; k++) { const an = rot + (k * Math.PI) / 3; ctx.moveTo(x - Math.cos(an) * s, y - Math.sin(an) * s); ctx.lineTo(x + Math.cos(an) * s, y + Math.sin(an) * s); }
    ctx.stroke();
  }
  ctx.restore();
}
// a stopped clock (plan): face, hands held at ten past ten, a frost cap
export function drawStopClock(ctx, x, y, s, frozen) {
  ctx.save();
  ctx.fillStyle = 'rgba(10,6,20,0.3)'; ctx.beginPath(); ctx.arc(x + s * 0.04, y + s * 0.07, s * 0.52, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(x - s * 0.2, y - s * 0.2, s * 0.05, x, y, s * 0.55);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, frozen ? '#b9dcff' : '#ffe9b8');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, s * 0.5, 0, TAU); ctx.fill();
  ctx.lineWidth = s * 0.09; ctx.strokeStyle = frozen ? '#3f7fd0' : '#c9882a'; ctx.stroke();
  ctx.strokeStyle = '#2a2440'; ctx.lineCap = 'round'; ctx.lineWidth = s * 0.08;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - s * 0.2, y - s * 0.16); ctx.moveTo(x, y); ctx.lineTo(x + s * 0.24, y - s * 0.2); ctx.stroke();
  ctx.restore();
}
// the teaching hand: a soft white glove with one finger out, pressed (smaller, ring under the tip) or lifted
export function drawHand(ctx, x, y, s, press, alpha) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  if (press) { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = s * 0.06; ctx.beginPath(); ctx.arc(0, 0, s * 0.3, 0, TAU); ctx.stroke(); }
  const k = press ? 0.92 : 1;
  ctx.scale(k, k);
  ctx.rotate(-0.35);
  const body = (ox, oy, col) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(ox - s * 0.11, oy + s * 0.02);
    ctx.quadraticCurveTo(ox, oy - s * 0.12, ox + s * 0.11, oy + s * 0.02); // finger tip
    ctx.lineTo(ox + s * 0.12, oy + s * 0.42);
    ctx.quadraticCurveTo(ox + s * 0.42, oy + s * 0.4, ox + s * 0.4, oy + s * 0.72);
    ctx.quadraticCurveTo(ox + s * 0.36, oy + s * 1.02, ox + s * 0.05, oy + s * 1.02);
    ctx.quadraticCurveTo(ox - s * 0.3, oy + s * 1.0, ox - s * 0.34, oy + s * 0.7);
    ctx.quadraticCurveTo(ox - s * 0.42, oy + s * 0.5, ox - s * 0.12, oy + s * 0.5);
    ctx.closePath(); ctx.fill();
  };
  body(s * 0.05, s * 0.08, 'rgba(10,6,20,0.3)');
  body(0, 0, '#ffffff');
  ctx.strokeStyle = 'rgba(60,50,80,0.55)'; ctx.lineWidth = Math.max(1, s * 0.035); ctx.stroke();
  ctx.fillStyle = 'rgba(120,130,170,0.22)';
  ctx.beginPath(); ctx.ellipse(s * 0.12, s * 0.78, s * 0.2, s * 0.17, 0, 0, TAU); ctx.fill();
  ctx.restore();
}
