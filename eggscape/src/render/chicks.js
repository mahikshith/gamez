// Chick kinds art (v3.2 K5/K6): the five tap-power chicks, their ready sparkle and power poses, tinted eggs,
// hatch orbs, hard-ice rings and the power VFX. Same look as the classic chick (characters.js): thick warm-brown
// outline, flat cel shading (base, one hard shadow, one hard highlight), big glossy eyes.
// Character art draws in a local y-DOWN 100-unit box (s = egg size in px, the chick is 1.5x that); the world
// helpers at the bottom take world space (meters, y up) like world.js.
import { EGG_H, EGG_W, RING_TH, TAU, eggPoint } from '../sim/geom.js';
import { GLOW_R, BULK_LEN, DASH_T, PICK_T } from '../sim/chicks.js';
import { drawEgg } from './world.js';
import { POWER_INFO, ORB_ART } from './powers.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mod = (a, b) => ((a % b) + b) % b;
const LINE = '#6e3a12'; // warm brown outline, shared by every kind
const outlineW = (s) => Math.max(3.4, 120 / s);

export const KIND = {
  glow: { name: 'Glow chick', base: '#fff3b0', shade: '#f4c23c', hi: '#ffffff', belly: '#fffbe6', glow: '255,236,120', orb: ['#fff6c0', '#d99a12', '#4a2a02'], line: 'Tap it once: FLASH! Burns thorns near it, stuns snakes and scares the eagle. Nearby eggs get blown about.' },
  dash: { name: 'Dash chick', base: '#ff8a2e', shade: '#d9561a', hi: '#ffc58a', belly: '#ffe2bd', glow: '255,140,50', orb: ['#ffc898', '#c24a10', '#3d1202'], line: 'Tap it once: it zooms along its channel, bonks snakes dizzy and grabs orbs. It can zoom right past a gap!' },
  swoop: { name: 'Swoop chick', base: '#55aef7', shade: '#2f72cc', hi: '#b8e2ff', belly: '#e6f5ff', glow: '90,175,255', orb: ['#c4e6ff', '#1f63c4', '#061c42'], line: 'Tap it once: it flies up through the ring above, tearing down a thorn curtain, then glides down.' },
  bulk: { name: 'Bulk chick', base: '#8ad44c', shade: '#4f9a2a', hi: '#cdf596', belly: '#e8f8c8', glow: '130,215,80', orb: ['#d4f5a8', '#3f8a1e', '#0f2a06'], line: 'Tap it once: it puffs up big and heavy for 5 s. Squashes thorns, snakes bounce off. Too big for gaps!' },
  pick: { name: 'Pick chick', base: '#ad78ea', shade: '#7444ba', hi: '#dcc2ff', belly: '#f1e6ff', glow: '175,120,240', orb: ['#e2ccff', '#6630b0', '#1d0840'], line: 'Tap it once: its drill beak shatters ice under it for 6 s. On a normal ring it only chips thorns.' },
};
export const chickLabel = (egg) => (egg && KIND[egg.chickKind] ? KIND[egg.chickKind].name.replace(' chick', '') + ' chick!' : 'Chick!');

// orb info for the power card / discovery
for (const k in KIND) POWER_INFO['hatch_' + k] = { name: k[0].toUpperCase() + k.slice(1) + ' egg', line: 'Hatches a ' + KIND[k].name + '. ' + KIND[k].line, color: `rgb(${KIND[k].glow})` };

/* ------------------------------------------------------------- shared */

function blinkAt(t, seed = 0) {
  const p = mod(t + seed * 1.7, 3.1 + seed * 0.7);
  return p < 0.16 ? Math.sin((p / 0.16) * Math.PI) : 0;
}
// Four-point sparkle.
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
// Scalloped fluffy ellipse (path only).
function fluffPath(ctx, cx, cy, rx, ry, n = 16, puff = 1.1, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU - Math.PI / 2 + rot;
    const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
    if (i === 0) ctx.moveTo(x, y);
    else { const am = a - Math.PI / n; ctx.quadraticCurveTo(cx + Math.cos(am) * rx * puff, cy + Math.sin(am) * ry * puff, x, y); }
  }
  ctx.closePath();
}
// Cel-shaded fill of the current path: base, a hard shadow crescent (lower right), a hard highlight (upper left).
function cel(ctx, C, o, sh = { x: -9, y: -10, r: 1.0 }, box = 40) {
  ctx.fillStyle = C.shade;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = C.base;
  ctx.beginPath();
  ctx.ellipse(sh.x, sh.y, box * sh.r, box * sh.r * 0.95, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.hi;
  ctx.beginPath();
  ctx.ellipse(sh.x - box * 0.42, sh.y - box * 0.36, box * 0.3, box * 0.2, -0.6, 0, TAU);
  ctx.fill();
  ctx.restore();
}
// Big glossy eye. look: {x, y}; shut 0..1; mood: 'happy' (^), 'squint' (><), 'fierce' (flat top lid)
function eye(ctx, x, y, rx, ry, t, o, { shut = 0, look = { x: 0, y: 0 }, mood = null, side = 1, star = false } = {}) {
  if (mood === 'squint') {
    ctx.strokeStyle = '#2a1d14';
    ctx.lineWidth = o * 0.95;
    ctx.beginPath();
    ctx.moveTo(x - rx * side, y - ry * 0.55);
    ctx.lineTo(x + rx * 0.7 * side, y);
    ctx.lineTo(x - rx * side, y + ry * 0.55);
    ctx.stroke();
    return;
  }
  if (mood === 'happy' || shut > 0.85) {
    ctx.strokeStyle = '#2a1d14';
    ctx.lineWidth = o * 0.95;
    ctx.beginPath();
    if (mood === 'happy') ctx.arc(x, y + ry * 0.35, rx * 0.95, Math.PI * 1.1, Math.PI * 1.9);
    else { ctx.moveTo(x - rx, y + 1); ctx.quadraticCurveTo(x, y + ry * 0.45, x + rx, y + 1); }
    ctx.stroke();
    return;
  }
  const h = ry * (1 - shut);
  ctx.fillStyle = '#2a1d14';
  ctx.beginPath();
  ctx.ellipse(x, y + (ry - h) * 0.5, rx, h, 0, 0, TAU);
  ctx.fill();
  if (mood === 'fierce') { // a flat upper lid: determined
    ctx.fillStyle = 'rgba(0,0,0,0)';
  }
  ctx.fillStyle = '#ffffff';
  if (star) sparkle(ctx, x - rx * 0.3 + look.x, y - h * 0.32 + look.y, rx * 0.62);
  else {
    ctx.beginPath();
    ctx.ellipse(x - rx * 0.32 + look.x, y - h * 0.38 + look.y, rx * 0.42, rx * 0.46, -0.3, 0, TAU);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(x + rx * 0.36 + look.x * 0.5, y + h * 0.42 + look.y * 0.5, rx * 0.17, 0, TAU);
  ctx.fill();
}
function brows(ctx, pts, o) {
  ctx.strokeStyle = LINE;
  ctx.lineWidth = Math.max(2.6, o * 0.95);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const [x0, y0, x1, y1] of pts) { ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }
  ctx.stroke();
}
function cheeks(ctx, pts, rx = 5.5, a = 0.5) {
  ctx.fillStyle = `rgba(255,110,100,${a})`;
  ctx.beginPath();
  for (const [x, y] of pts) ctx.ellipse(x, y, rx, rx * 0.62, 0, 0, TAU);
  ctx.fill();
}
// little open beak pointing down (classic) at (x, y)
function beakDown(ctx, x, y, w, open, o) {
  ctx.lineWidth = o * 0.8;
  ctx.strokeStyle = LINE;
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x, y + w * 0.6 + open);
  ctx.closePath();
  ctx.fillStyle = '#ee7f16';
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - w * 1.15, y);
  ctx.quadraticCurveTo(x, y - w * 1.4, x + w * 1.15, y);
  ctx.lineTo(x, y + 2);
  ctx.closePath();
  ctx.fillStyle = '#ffb12e';
  ctx.fill();
  ctx.stroke();
}
function legs(ctx, xs, y0, len, flap, t, o) {
  for (const pass of [0, 1]) {
    ctx.lineWidth = pass ? 3.2 : 3.2 + o * 1.3;
    ctx.strokeStyle = pass ? '#ffa62b' : LINE;
    ctx.beginPath();
    for (const x of xs) {
      const sw = Math.sin(t * 10 + x) * flap * 2.5;
      ctx.moveTo(x, y0);
      ctx.lineTo(x + sw, y0 + len);
      ctx.moveTo(x + sw - 4.5, y0 + len + 2);
      ctx.lineTo(x + sw, y0 + len);
      ctx.lineTo(x + sw + 4.5, y0 + len + 2);
    }
    ctx.stroke();
  }
}
// small classic wing at (x, y), sx = side, ang = raise
function stubWing(ctx, x, y, sx, ang, sc, C, o) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx * sc, sc);
  ctx.rotate(-0.5 + ang);
  ctx.beginPath();
  ctx.moveTo(-2, -5);
  ctx.quadraticCurveTo(16, -9, 20, 1);
  ctx.quadraticCurveTo(15, 2, 16, 6);
  ctx.quadraticCurveTo(10, 5, 9, 9);
  ctx.quadraticCurveTo(2, 9, -2, 5);
  ctx.closePath();
  ctx.fillStyle = C.shade;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = C.base;
  ctx.fillRect(-4, -12, 30, 12);
  ctx.restore();
  ctx.lineWidth = o / sc;
  ctx.strokeStyle = LINE;
  ctx.stroke();
  ctx.restore();
}
function shellCap(ctx, x, y, rot, sc, o) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(sc, sc);
  ctx.beginPath();
  ctx.moveTo(-15, 3);
  ctx.bezierCurveTo(-15, -9, -8, -14, 0, -14);
  ctx.bezierCurveTo(8, -14, 15, -9, 15, 3);
  for (const [xx, yy] of [[11, -1], [7, 4], [3, 0], [-1, 5], [-5, 0], [-9, 4], [-12, -1]]) ctx.lineTo(xx, yy);
  ctx.closePath();
  ctx.fillStyle = '#f7ecd6';
  ctx.fill();
  ctx.lineWidth = o / sc;
  ctx.strokeStyle = LINE;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(-6, -7, 2.5, 3.5, 0.5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/* ------------------------------------------------------------- kinds */
// st: { flap 0..1, ready bool, pow (0 none | phase), powT (s left), face (-1|1), puff 0..1 (bulk), bulkRx/Ry (px),
//       drillA (rad, pick: where the drill points), dir }

function glowChick(ctx, t, o, st) {
  const C = KIND.glow, P = st.pow ? clamp(1 - st.powT / 0.7, 0, 1) : 0; // 0..1 through the flash
  const burst = st.pow ? Math.sin(Math.min(1, P * 2.2) * Math.PI) : 0;
  const sc = 1 + 0.16 * burst;
  ctx.scale(sc, sc);
  // aura
  const ar = 52 + 6 * Math.sin(t * 3) + 30 * burst, al = st.ready ? 0.42 + 0.12 * Math.sin(t * 4) : 0.18;
  const g = ctx.createRadialGradient(0, 4, 8, 0, 4, ar);
  g.addColorStop(0, `rgba(${C.glow},${Math.min(0.9, al + burst * 0.5)})`);
  g.addColorStop(1, `rgba(${C.glow},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 4, ar, 0, TAU);
  ctx.fill();
  legs(ctx, [-9, 9], 37, 8, st.flap, t, o);
  const wa = Math.sin(t * (9 + 30 * st.flap)) * (0.25 + 0.6 * st.flap) - 0.45 * st.flap + (st.ready ? 0.35 : 0) + burst * 0.9;
  for (const sx of [-1, 1]) stubWing(ctx, sx * 31, 10, sx, wa, 1.1, C, o);
  // star crest: three rounded spark points
  // little light rays turning round it (stronger while the power is ready)
  ctx.save();
  ctx.rotate(t * 0.6);
  ctx.strokeStyle = `rgba(255,214,60,${st.ready ? 0.85 : 0.35})`;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU, l = 6 + 3 * Math.sin(t * 6 + i * 1.7) + 20 * burst;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 44, 6 + Math.sin(a) * 44);
    ctx.lineTo(Math.cos(a) * (44 + l), 6 + Math.sin(a) * (44 + l));
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.translate(0, -29);
  const cs = 1.3 + 0.08 * Math.sin(t * 5) + 0.6 * burst;
  ctx.scale(cs, cs);
  ctx.beginPath();
  const pts = 5;
  for (let i = 0; i <= pts * 2; i++) {
    const a = (i / (pts * 2)) * TAU - Math.PI / 2, r = i % 2 ? 6 : 14;
    const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.9 - 2;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.fillStyle = '#ffd23a';
  ctx.fill();
  ctx.lineWidth = o / cs;
  ctx.strokeStyle = LINE;
  ctx.stroke();
  ctx.fillStyle = '#fffbe0';
  ctx.beginPath();
  ctx.arc(0, -2, 4.5, 0, TAU);
  ctx.fill();
  ctx.restore();
  // round body
  fluffPath(ctx, 0, 8, 34, 34, 18, 1.08);
  cel(ctx, C, o, { x: -8, y: 0, r: 0.95 }, 40);
  // glowing belly
  ctx.save();
  fluffPath(ctx, 0, 8, 34, 34, 18, 1.08);
  ctx.clip();
  const bg = ctx.createRadialGradient(0, 20, 2, 0, 20, 22);
  bg.addColorStop(0, 'rgba(255,255,240,0.95)');
  bg.addColorStop(1, 'rgba(255,250,200,0)');
  ctx.fillStyle = bg;
  ctx.fillRect(-30, -4, 60, 46);
  if (burst > 0) { ctx.fillStyle = `rgba(255,255,255,${burst * 0.75})`; ctx.fillRect(-45, -40, 90, 90); }
  ctx.restore();
  fluffPath(ctx, 0, 8, 34, 34, 18, 1.08);
  ctx.lineWidth = o;
  ctx.strokeStyle = LINE;
  ctx.stroke();
  // face
  const fy = 6, bl = blinkAt(t, 1);
  cheeks(ctx, [[-21, fy + 10], [21, fy + 10]], 6, 0.45);
  for (const sx of [-1, 1]) eye(ctx, sx * 12, fy, 7.6, 9.6, t, o, { shut: bl, mood: burst > 0.15 ? 'squint' : null, side: sx, star: true });
  beakDown(ctx, 0, fy + 10, 5, burst > 0.15 ? 7 : 2.5 + Math.sin(t * 7) * 0.6, o);
}

function dashChick(ctx, t, o, st) {
  const C = KIND.dash, on = st.pow === 1;
  if (on) ctx.scale(1.18, 0.88); // stretched by speed
  // headband tails stream back, faster when it zooms
  const wv = t * (on ? 26 : 7);
  for (const k of [0, 1]) {
    ctx.beginPath();
    const y0 = -12 + k * 5;
    ctx.moveTo(-18, y0);
    for (let i = 1; i <= 6; i++) ctx.lineTo(-18 - i * (on ? 7 : 5), y0 + i * (on ? 0.6 : 2.2) + Math.sin(wv + i * 0.9 + k) * (2 + i * 0.6));
    ctx.lineWidth = 7 + o * 1.5;
    ctx.strokeStyle = LINE;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.lineWidth = 7;
    ctx.strokeStyle = k ? '#c4202a' : '#ee3a3e';
    ctx.stroke();
  }
  if (!on) legs(ctx, [-6, 10], 35, 8, st.flap, t, o);
  // swept crest feathers
  for (const [x, y, r, l] of [[-6, -27, -2.5, 20], [2, -29, -2.2, 16]]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(r + Math.sin(t * 6 + x) * 0.08);
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.quadraticCurveTo(l * 0.6, -6, l, 0);
    ctx.quadraticCurveTo(l * 0.6, 5, 0, 4);
    ctx.closePath();
    ctx.fillStyle = C.shade;
    ctx.fill();
    ctx.lineWidth = o;
    ctx.strokeStyle = LINE;
    ctx.stroke();
    ctx.restore();
  }
  // teardrop body: round front (+x), tail to the back
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(-46, 2);
    ctx.bezierCurveTo(-30, -20, -14, -30, 8, -28);
    ctx.bezierCurveTo(30, -26, 38, -6, 36, 10);
    ctx.bezierCurveTo(34, 30, 14, 40, -4, 38);
    ctx.bezierCurveTo(-22, 36, -34, 22, -46, 2);
    ctx.closePath();
  };
  body();
  cel(ctx, C, o, { x: 0, y: -2, r: 0.95 }, 40);
  // belly and speed stripes
  ctx.save();
  body();
  ctx.clip();
  ctx.fillStyle = C.belly;
  ctx.beginPath();
  ctx.ellipse(8, 26, 26, 14, -0.1, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,200,0.9)';
  ctx.lineWidth = 3.2;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-40 + i * 4, -2 + i * 7); ctx.lineTo(-20 + i * 2, -2 + i * 7); ctx.stroke(); }
  ctx.restore();
  // headband across the forehead
  ctx.save();
  body();
  ctx.clip();
  ctx.fillStyle = '#ee3a3e';
  ctx.beginPath();
  ctx.moveTo(-30, -16); ctx.quadraticCurveTo(8, -26, 40, -14); ctx.lineTo(40, -6); ctx.quadraticCurveTo(8, -18, -30, -8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(-30, -17, 70, 2.4);
  ctx.restore();
  body();
  ctx.lineWidth = o;
  ctx.strokeStyle = LINE;
  ctx.stroke();
  // little wing swept back
  stubWing(ctx, -12, 12, -1, on ? -0.6 : Math.sin(t * (8 + 26 * st.flap)) * 0.3 + (st.ready ? 0.2 : 0), 1.15, C, o);
  // face: eyes toward the front, determined brows
  const bl = blinkAt(t, 2);
  cheeks(ctx, [[30, 12]], 5, 0.45);
  eye(ctx, 12, 0, 6.8, 8.8, t, o, { shut: on ? 0.3 : bl, look: { x: 1.5, y: 0 } });
  eye(ctx, 27, -1, 5.6, 8.2, t, o, { shut: on ? 0.3 : bl, look: { x: 1.5, y: 0 } });
  brows(ctx, [[4, -11, 17, -8], [22, -9, 32, -12]], o);
  // beak pointing forward
  ctx.beginPath();
  ctx.moveTo(32, 2);
  ctx.quadraticCurveTo(46, 5, 50, 9);
  ctx.quadraticCurveTo(44, 13, 32, 14);
  ctx.closePath();
  ctx.fillStyle = '#ffb12e';
  ctx.fill();
  ctx.lineWidth = o * 0.8;
  ctx.strokeStyle = LINE;
  ctx.stroke();
}

function swoopWing(ctx, sx, ang, span, C, o) {
  ctx.save();
  ctx.translate(sx * 22, 4);
  ctx.scale(sx, 1);
  ctx.rotate(-ang);
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.bezierCurveTo(span * 0.35, -20, span * 0.8, -18, span, -10);
  // three feather tips along the trailing edge
  ctx.quadraticCurveTo(span * 0.98, -2, span * 0.82, 0);
  ctx.quadraticCurveTo(span * 0.82, 7, span * 0.62, 6);
  ctx.quadraticCurveTo(span * 0.58, 13, span * 0.4, 10);
  ctx.quadraticCurveTo(span * 0.2, 14, 0, 8);
  ctx.closePath();
  ctx.fillStyle = C.shade;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = C.base;
  ctx.beginPath();
  ctx.ellipse(span * 0.4, -16, span * 0.7, 12, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,70,140,0.55)';
  ctx.lineWidth = 2;
  for (const f of [0.4, 0.62, 0.82]) { ctx.beginPath(); ctx.moveTo(span * f * 0.7, -8); ctx.lineTo(span * f, 4); ctx.stroke(); }
  ctx.restore();
  ctx.lineWidth = o;
  ctx.strokeStyle = LINE;
  ctx.stroke();
  ctx.restore();
}
function swoopChick(ctx, t, o, st) {
  const C = KIND.swoop, rise = st.pow === 1, glide = st.pow === 2;
  // wing pose: idle half folded with a small flutter, ready lifted, rising = big fast strokes, glide = spread
  let ang, span = 40;
  if (rise) ang = Math.sin(t * 30) * 0.9 + 0.2;
  else if (glide) { ang = 0.25 + Math.sin(t * 3) * 0.06; span = 46; }
  else ang = -0.75 + Math.sin(t * (8 + 26 * st.flap)) * (0.15 + 0.5 * st.flap) + (st.ready ? 0.45 + 0.12 * Math.sin(t * 5) : 0);
  if (rise) ctx.translate(0, Math.sin(t * 30) * 2);
  // tail feathers
  for (const [r, l] of [[-0.35, 16], [0, 19], [0.35, 16]]) {
    ctx.save();
    ctx.translate(-4, 34);
    ctx.rotate(r + 2.7);
    ctx.beginPath();
    ctx.moveTo(-4, 0); ctx.quadraticCurveTo(-5, l * 0.7, 0, l); ctx.quadraticCurveTo(5, l * 0.7, 4, 0);
    ctx.closePath();
    ctx.fillStyle = C.shade;
    ctx.fill();
    ctx.lineWidth = o;
    ctx.strokeStyle = LINE;
    ctx.stroke();
    ctx.restore();
  }
  if (!rise && !glide) legs(ctx, [-8, 8], 36, 8, st.flap, t, o);
  swoopWing(ctx, -1, ang, span, C, o);
  // body
  fluffPath(ctx, 0, 10, 30, 30, 16, 1.07);
  cel(ctx, C, o, { x: -7, y: 2, r: 0.92 }, 36);
  ctx.save();
  fluffPath(ctx, 0, 10, 30, 30, 16, 1.07);
  ctx.clip();
  ctx.fillStyle = C.belly;
  ctx.beginPath();
  ctx.ellipse(4, 28, 18, 14, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  fluffPath(ctx, 0, 10, 30, 30, 16, 1.07);
  ctx.lineWidth = o;
  ctx.strokeStyle = LINE;
  ctx.stroke();
  swoopWing(ctx, 1, ang, span, C, o);
  // curl crest
  ctx.beginPath();
  ctx.moveTo(-2, -19);
  ctx.bezierCurveTo(-4, -34, 12, -36, 10, -26);
  ctx.bezierCurveTo(9, -22, 4, -24, 5, -27);
  ctx.lineWidth = 5 + o;
  ctx.strokeStyle = LINE;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.lineWidth = 5;
  ctx.strokeStyle = C.shade;
  ctx.stroke();
  // face
  const fy = 6, bl = blinkAt(t, 3);
  cheeks(ctx, [[-18, fy + 10], [20, fy + 10]], 5, 0.4);
  for (const sx of [-1, 1]) eye(ctx, sx * 10 + 3, fy, 6.6, 8.8, t, o, { shut: bl, mood: glide ? 'happy' : null, look: { x: rise ? 0 : 1, y: rise ? -2 : 0 } });
  // pointy beak, a little to the front
  ctx.beginPath();
  ctx.moveTo(-1, fy + 9);
  ctx.lineTo(16, fy + 13);
  ctx.lineTo(-1, fy + 17);
  ctx.closePath();
  ctx.fillStyle = '#ffb12e';
  ctx.fill();
  ctx.lineWidth = o * 0.8;
  ctx.strokeStyle = LINE;
  ctx.stroke();
}

function bulkChick(ctx, t, o, st) {
  const C = KIND.bulk;
  legs(ctx, [-14, 14], 37, 7, st.flap, t, o);
  const wa = Math.sin(t * (9 + 30 * st.flap)) * (0.3 + 0.5 * st.flap) + (st.ready ? 0.3 : 0);
  for (const sx of [-1, 1]) stubWing(ctx, sx * 37, 14, sx, wa, 0.85, C, o);
  // three hair tufts
  ctx.lineCap = 'round';
  for (const [x, r] of [[-5, -0.4], [0, 0], [5, 0.4]]) {
    ctx.save();
    ctx.translate(x, -18);
    ctx.rotate(r + Math.sin(t * 4 + x) * 0.1);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-3, -7, 1, -12);
    ctx.lineWidth = 4 + o;
    ctx.strokeStyle = LINE;
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.strokeStyle = C.base;
    ctx.stroke();
    ctx.restore();
  }
  fluffPath(ctx, 0, 12, 40, 31, 18, 1.07);
  cel(ctx, C, o, { x: -8, y: 4, r: 1.05 }, 40);
  ctx.save();
  fluffPath(ctx, 0, 12, 40, 31, 18, 1.07);
  ctx.clip();
  ctx.fillStyle = C.belly;
  ctx.beginPath();
  ctx.ellipse(0, 32, 26, 13, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  fluffPath(ctx, 0, 12, 40, 31, 18, 1.07);
  ctx.lineWidth = o;
  ctx.strokeStyle = LINE;
  ctx.stroke();
  const fy = 8, bl = blinkAt(t, 4);
  cheeks(ctx, [[-25, fy + 11], [25, fy + 11]], 7.5, 0.5);
  for (const sx of [-1, 1]) eye(ctx, sx * 13, fy, 7, 8.6, t, o, { shut: bl });
  beakDown(ctx, 0, fy + 10, 4.5, 2 + Math.sin(t * 6) * 0.5, o);
}
// the puffed bulk chick: a big spiky fluff ball lying along the channel (rx, ry in 100-units), face upright
function bulkPuffed(ctx, t, o, st, rx, ry, rot) {
  const C = KIND.bulk, P = clamp(st.powT, 0, 5), grow = clamp((5 - P) / 0.25, 0, 1), end = P < 0.6 ? 0.5 + 0.5 * Math.sin(t * 40) : 1;
  const sx = rx * (0.45 + 0.55 * grow) * (0.97 + 0.03 * end), sy = ry * (0.6 + 0.4 * grow);
  ctx.save();
  ctx.rotate(rot);
  // feet stick out under it
  ctx.fillStyle = '#ffa62b';
  for (const fx of [-0.45, 0.45]) {
    ctx.beginPath();
    ctx.ellipse(fx * sx, sy * 0.95, 7, 4, 0, 0, TAU);
    ctx.fill();
    ctx.lineWidth = o * 0.8;
    ctx.strokeStyle = LINE;
    ctx.stroke();
  }
  // spiky fluff
  const n = 28;
  const path = () => {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU, w = 1 + 0.05 * Math.sin(t * 9 + i * 1.3);
      const x = Math.cos(a) * sx * w, y = Math.sin(a) * sy * w;
      if (!i) ctx.moveTo(x, y);
      else { const am = a - Math.PI / n; ctx.quadraticCurveTo(Math.cos(am) * sx * 1.1, Math.sin(am) * sy * 1.12, x, y); }
    }
    ctx.closePath();
  };
  path();
  ctx.fillStyle = C.shade;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = C.base;
  ctx.beginPath();
  ctx.ellipse(-sx * 0.12, -sy * 0.14, sx * 0.98, sy * 0.92, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.hi;
  ctx.beginPath();
  ctx.ellipse(-sx * 0.45, -sy * 0.5, sx * 0.28, sy * 0.2, -0.3, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.belly;
  ctx.beginPath();
  ctx.ellipse(0, sy * 0.72, sx * 0.55, sy * 0.3, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  path();
  ctx.lineWidth = o * 1.1;
  ctx.strokeStyle = LINE;
  ctx.stroke();
  // tiny wings flapping at the ends
  for (const s2 of [-1, 1]) stubWing(ctx, s2 * sx * 0.97, sy * 0.05, s2, Math.sin(t * 16) * 0.4, 0.8, C, o);
  ctx.restore();
  // face upright: puffed cheeks, squeezed determined eyes
  const fy = -sy * 0.12;
  cheeks(ctx, [[-sx * 0.36, fy + 14], [sx * 0.36, fy + 14]], 11, 0.55);
  for (const s2 of [-1, 1]) eye(ctx, s2 * 15, fy, 7.5, 7.5, t, o, { shut: 0.35 });
  brows(ctx, [[-24, fy - 13, -8, fy - 9], [24, fy - 13, 8, fy - 9]], o);
  ctx.beginPath(); // puffed cheeks hold the breath: a tiny pursed beak
  ctx.ellipse(0, fy + 13, 5, 3.6, 0, 0, TAU);
  ctx.fillStyle = '#ffb12e';
  ctx.fill();
  ctx.lineWidth = o * 0.8;
  ctx.strokeStyle = LINE;
  ctx.stroke();
}

function pickChick(ctx, t, o, st) {
  const C = KIND.pick, drill = st.pow === 1, recoil = st.pow === 2;
  ctx.save();
  if (drill) { ctx.translate(Math.sin(t * 70) * 1.2, 4); ctx.rotate(0.95); } // nose down into the ring
  else if (recoil) { ctx.translate(0, -4 * Math.sin(clamp(st.powT / 0.35, 0, 1) * Math.PI)); ctx.rotate(0.25); }
  if (!drill) legs(ctx, [-8, 8], 37, 8, st.flap, t, o);
  // body
  fluffPath(ctx, 0, 10, 31, 31, 16, 1.07);
  cel(ctx, C, o, { x: -7, y: 2, r: 0.93 }, 36);
  ctx.save();
  fluffPath(ctx, 0, 10, 31, 31, 16, 1.07);
  ctx.clip();
  ctx.fillStyle = C.belly;
  ctx.beginPath();
  ctx.ellipse(0, 30, 19, 13, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  fluffPath(ctx, 0, 10, 31, 31, 16, 1.07);
  ctx.lineWidth = o;
  ctx.strokeStyle = LINE;
  ctx.stroke();
  const wa = drill ? 0.9 + Math.sin(t * 30) * 0.2 : Math.sin(t * (9 + 30 * st.flap)) * (0.25 + 0.5 * st.flap) + (st.ready ? 0.3 : 0);
  stubWing(ctx, -30, 12, -1, wa, 1.05, C, o);
  // miner's helmet with a lamp
  ctx.beginPath();
  ctx.moveTo(-27, -10);
  ctx.bezierCurveTo(-27, -36, 27, -36, 27, -10);
  ctx.closePath();
  ctx.fillStyle = '#ffc531';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#e39a12';
  ctx.beginPath();
  ctx.ellipse(10, -6, 26, 14, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff2b0';
  ctx.beginPath();
  ctx.ellipse(-12, -24, 8, 4, -0.5, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = o;
  ctx.strokeStyle = LINE;
  ctx.stroke();
  ctx.beginPath(); // brim
  ctx.roundRect ? ctx.roundRect(-31, -12, 64, 6, 3) : ctx.rect(-31, -12, 64, 6);
  ctx.fillStyle = '#f0ae1c';
  ctx.fill();
  ctx.stroke();
  // lamp
  ctx.beginPath();
  ctx.arc(14, -24, 6.5, 0, TAU);
  ctx.fillStyle = '#fffbe0';
  ctx.fill();
  ctx.stroke();
  if (st.ready || drill) {
    const lg = ctx.createLinearGradient(18, -24, 54, -24);
    lg.addColorStop(0, `rgba(255,250,200,${0.55 + 0.15 * Math.sin(t * 6)})`);
    lg.addColorStop(1, 'rgba(255,250,200,0)');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(18, -28); ctx.lineTo(52, -38); ctx.lineTo(52, -10); ctx.lineTo(18, -20);
    ctx.closePath();
    ctx.fill();
  }
  // face
  const fy = 6, bl = blinkAt(t, 5);
  cheeks(ctx, [[-17, fy + 11]], 5, 0.45);
  for (const sx of [-1, 1]) eye(ctx, sx * 10 + 2, fy, 6.6, 8.6, t, o, { shut: drill ? 0.4 : bl });
  brows(ctx, [[-14, fy - 11, -3, fy - 9], [6, fy - 9, 17, fy - 12]], o);
  // drill beak: a metal cone with spiral grooves that spin while it drills
  ctx.save();
  ctx.translate(14, fy + 11);
  ctx.rotate(0.35);
  const L = 34, W = 9.5;
  ctx.beginPath();
  ctx.moveTo(0, -W);
  ctx.lineTo(L, 0);
  ctx.lineTo(0, W);
  ctx.quadraticCurveTo(-4, 0, 0, -W);
  ctx.closePath();
  const dg = ctx.createLinearGradient(0, -W, 0, W);
  dg.addColorStop(0, '#f4f6fa');
  dg.addColorStop(0.45, '#aeb7c4');
  dg.addColorStop(1, '#5e6878');
  ctx.fillStyle = dg;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(40,46,58,0.75)';
  ctx.lineWidth = 2.2;
  const ph = mod(t * (drill ? 60 : 4), 8);
  for (let x = -8 + ph; x < L; x += 8) { ctx.beginPath(); ctx.moveTo(x, -W); ctx.lineTo(x + 6, W); ctx.stroke(); }
  ctx.restore();
  ctx.lineWidth = o * 0.85;
  ctx.strokeStyle = LINE;
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

// Draws one chick kind at (cx, cy) (y-down px), egg size s. st as above.
export function drawKindChick(ctx, kind, cx, cy, s, t = 0, st = {}) {
  if (!(s > 0) || !KIND[kind]) return;
  ctx.save();
  try {
    ctx.translate(cx, cy - s * 0.04);
    s *= 1.5;
    ctx.scale(s / 100, s / 100);
    const o = outlineW(s);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const flap = clamp(st.flap || 0, 0, 1);
    const S = { ...st, flap };
    if (kind === 'bulk' && st.pow) {
      bulkPuffed(ctx, t, o, S, st.rx || 70, st.ry || 40, st.rot || 0);
    } else {
      // idle flutter; the ready pose bounces eagerly
      const bob = st.pow ? 0 : Math.sin(t * (st.ready ? 5 : 3) + (flap * 9)) * (st.ready ? 2.2 : 1 + flap * 1.5);
      ctx.translate(0, bob);
      if (st.face === -1) ctx.scale(-1, 1);
      if (kind === 'glow') glowChick(ctx, t, o, S);
      else if (kind === 'dash') dashChick(ctx, t, o, S);
      else if (kind === 'swoop') swoopChick(ctx, t, o, S);
      else if (kind === 'bulk') bulkChick(ctx, t, o, S);
      else if (kind === 'pick') pickChick(ctx, t, o, S);
    }
  } catch (e) {
    // art must never break the frame
  }
  ctx.restore();
}

// Ready cue (the power is unused): a soft halo in the kind's colour, a turning dashed ring and two sparkles
// orbiting, plus a little bouncing tap dot above the head. y-down px, r = chick radius in px.
export function drawReady(ctx, kind, cx, cy, r, t) {
  const C = KIND[kind];
  if (!C) return;
  ctx.save();
  ctx.translate(cx, cy);
  const p = 0.5 + 0.5 * Math.sin(t * 4);
  const g = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 1.6);
  g.addColorStop(0, `rgba(${C.glow},0)`);
  g.addColorStop(0.7, `rgba(${C.glow},${0.18 + 0.14 * p})`);
  g.addColorStop(1, `rgba(${C.glow},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.6, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.rotate(t * 0.8);
  ctx.setLineDash([r * 0.32, r * 0.22]);
  ctx.lineWidth = Math.max(2, r * 0.07);
  ctx.strokeStyle = `rgba(255,255,255,${0.55 + 0.3 * p})`;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.32, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  for (let i = 0; i < 2; i++) {
    const a = t * 2.2 + i * Math.PI, rr = r * 1.32;
    const tw = 0.6 + 0.4 * Math.sin(t * 7 + i * 2);
    ctx.fillStyle = `rgba(${C.glow},1)`;
    sparkle(ctx, Math.cos(a) * rr, Math.sin(a) * rr, r * 0.3 * tw + 1);
    ctx.fillStyle = '#ffffff';
    sparkle(ctx, Math.cos(a) * rr, Math.sin(a) * rr, r * 0.16 * tw + 0.5);
  }
  ctx.restore();
}

// Which way the power goes, on the ready cue: dash = chevrons ahead (the way it faces), swoop = up, pick = down.
export function drawHint(ctx, kind, face, r, t) {
  const dir = kind === 'dash' ? [face || 1, 0] : kind === 'swoop' ? [0, -1] : kind === 'pick' ? [0, 1] : null;
  if (!dir) return;
  ctx.save();
  ctx.rotate(Math.atan2(dir[1], dir[0]));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < 2; i++) {
    const ph = mod(t * 1.6 - i * 0.5, 1), x = r * (1.55 + 0.35 * i + 0.25 * ph), w = r * 0.22, a = Math.sin(ph * Math.PI);
    ctx.beginPath();
    ctx.moveTo(x - w, -w * 1.1);
    ctx.lineTo(x, 0);
    ctx.lineTo(x - w, w * 1.1);
    ctx.lineWidth = Math.max(4, r * 0.2);
    ctx.strokeStyle = `rgba(80,40,10,${0.6 * a})`;
    ctx.stroke();
    ctx.lineWidth = Math.max(2, r * 0.1);
    ctx.strokeStyle = `rgba(255,255,255,${a})`;
    ctx.stroke();
  }
  ctx.restore();
}

/* ------------------------------------------------------------- symbols, eggs, orbs */

// Kind symbol (white with a dark outline), centred, size h px. Same symbol on the tinted egg and the hatch orb.
export function drawSymbol(ctx, kind, x, y, h, col = '#ffffff', edge = LINE) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(h / 20, h / 20);
  ctx.beginPath();
  if (kind === 'glow') { // star
    for (let i = 0; i <= 10; i++) { const a = (i / 10) * TAU - Math.PI / 2, r = i % 2 ? 4.2 : 10; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  } else if (kind === 'dash') { // double chevron
    for (const dx of [-5, 3]) { ctx.moveTo(dx - 3, -9); ctx.lineTo(dx + 5, 0); ctx.lineTo(dx - 3, 9); ctx.lineTo(dx - 7, 9); ctx.lineTo(dx + 1, 0); ctx.lineTo(dx - 7, -9); ctx.closePath(); }
  } else if (kind === 'swoop') { // wing
    ctx.moveTo(-10, 4); ctx.bezierCurveTo(-6, -8, 4, -11, 10, -8); ctx.quadraticCurveTo(8, -3, 4, -2); ctx.quadraticCurveTo(6, 1, 2, 3); ctx.quadraticCurveTo(2, 6, -3, 6); ctx.quadraticCurveTo(-7, 9, -10, 4);
  } else if (kind === 'bulk') { // puffed ball with puff marks
    ctx.arc(0, 1, 7.5, 0, TAU);
    for (const a of [-2.4, -1.57, -0.74]) { ctx.moveTo(Math.cos(a) * 9.5 + 1, Math.sin(a) * 9.5); ctx.arc(Math.cos(a) * 9.5, Math.sin(a) * 9.5 + 1, 1.6, 0, TAU); }
  } else if (kind === 'pick') { // drill cone
    ctx.moveTo(-8, -7); ctx.lineTo(9, 0); ctx.lineTo(-8, 7); ctx.quadraticCurveTo(-11, 0, -8, -7);
  }
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4.5;
  ctx.strokeStyle = edge;
  ctx.stroke();
  ctx.fillStyle = col;
  ctx.fill();
  if (kind === 'pick') { ctx.strokeStyle = edge; ctx.lineWidth = 1.6; for (const x of [-4, 1]) { ctx.beginPath(); ctx.moveTo(x, -5); ctx.lineTo(x + 2.5, 4.5); ctx.stroke(); } }
  ctx.restore();
}

// Hatch orb (powers.js drawOrb hook): kind-coloured glass, the kind symbol, a cracked-egg rim glint.
function drawHatchOrb(kind, ctx, cx, cy, r, t) {
  const C = KIND[kind];
  if (!(r > 0) || !C) return;
  ctx.save();
  ctx.translate(cx, cy + Math.sin(t * 2.2) * r * 0.04);
  const pulse = 1 + 0.07 * Math.sin(t * 3 + kind.length);
  const halo = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, r * 1.8 * pulse);
  halo.addColorStop(0, `rgba(${C.glow},0.65)`);
  halo.addColorStop(1, `rgba(${C.glow},0)`);
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.8 * pulse, 0, TAU);
  ctx.fill();
  const gl = C.orb;
  const body = ctx.createRadialGradient(-r * 0.3, -r * 0.36, r * 0.06, 0, 0, r);
  body.addColorStop(0, gl[0]);
  body.addColorStop(0.55, gl[1]);
  body.addColorStop(1, gl[2]);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fillStyle = body;
  ctx.fill();
  // a little egg inside with the kind symbol
  ctx.save();
  ctx.rotate(Math.sin(t * 2.4 + kind.length) * 0.18);
  const eh = r * 1.2;
  ctx.beginPath();
  for (let i = 0; i < 30; i++) { const q = eggPoint((i / 30) * TAU, eh, eh * 0.76); i ? ctx.lineTo(q.x, -q.y) : ctx.moveTo(q.x, -q.y); }
  ctx.closePath();
  const eg = ctx.createRadialGradient(-eh * 0.15, -eh * 0.2, 1, 0, 0, eh * 0.6);
  eg.addColorStop(0, '#ffffff');
  eg.addColorStop(1, C.base);
  ctx.fillStyle = eg;
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.strokeStyle = LINE;
  ctx.stroke();
  drawSymbol(ctx, kind, 0, eh * 0.04, eh * 0.5, '#ffffff', LINE);
  ctx.restore();
  // gloss
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, -r * 0.58, r * 0.42, r * 0.2, -0.4, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  ctx.strokeStyle = gl[2];
  ctx.stroke();
  // glint circling the rim
  const a = -t * 1.3 + kind.length;
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 5);
  sparkle(ctx, Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, r * 0.16);
  ctx.restore();
}
for (const k in KIND) ORB_ART['hatch_' + k] = (ctx, cx, cy, r, t) => drawHatchOrb(k, ctx, cx, cy, r, t);

// Tinted egg (world space): the normal egg, its shell washed with the kind's colour, the kind symbol on top;
// while it is about to hatch it trembles and a crack runs round it.
function drawTintedEgg(ctx, egg, t, k) {
  const C = KIND[egg.tint];
  const b = egg.body, p = b.getPosition();
  const h = egg.hatchT > 0 ? clamp(1 - egg.hatchT / 0.6, 0, 1) : 0;
  if (h > 0) { // tremble: the whole egg (shell and face) jitters
    ctx.save();
    ctx.translate(Math.sin(t * 70) * 0.012 * (0.4 + h), 0);
  }
  drawEgg(ctx, egg, t, k);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(b.getAngle());
  const path = (s = 1) => { ctx.beginPath(); for (let i = 0; i < 36; i++) { const q = eggPoint((i / 36) * TAU); i ? ctx.lineTo(q.x * s, q.y * s) : ctx.moveTo(q.x * s, q.y * s); } ctx.closePath(); };
  path();
  ctx.globalCompositeOperation = 'multiply';
  const g = ctx.createLinearGradient(0, EGG_H / 2, 0, -EGG_H / 2);
  g.addColorStop(0, C.hi);
  g.addColorStop(1, C.base);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  // a soft glow rim so it reads at a glance
  path(1.12);
  ctx.strokeStyle = `rgba(${C.glow},${0.55 + 0.25 * Math.sin(t * 4)})`;
  ctx.lineWidth = Math.max(2.5 / k, 0.03);
  ctx.stroke();
  // the symbol, on the narrow top of the shell
  ctx.save();
  ctx.translate(0, EGG_H * 0.33);
  ctx.scale(1 / k, -1 / k);
  drawSymbol(ctx, egg.tint, 0, 0, EGG_W * 0.42 * k, '#ffffff', LINE);
  ctx.restore();
  if (h > 0) {
    // the hatching crack runs round the middle
    ctx.save();
    path();
    ctx.clip();
    ctx.beginPath();
    const n = 9, w = EGG_W * 0.6;
    for (let i = 0; i <= n; i++) {
      const x = -w + (2 * w * i) / n;
      if (x > -w + 2 * w * h + 1e-3) break;
      const y = 0.09 + (i % 2 ? 0.035 : -0.02);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.lineWidth = Math.max(2.4 / k, 0.022);
    ctx.strokeStyle = '#3a2210';
    ctx.stroke();
    ctx.restore();
    path(1 + 0.25 * h);
    ctx.strokeStyle = `rgba(255,255,255,${0.5 * h})`;
    ctx.lineWidth = 0.05 * h;
    ctx.stroke();
  }
  ctx.restore();
  if (h > 0) ctx.restore();
}

// World entry for every egg: kind chicks and tinted eggs are drawn here (returns true); anything else
// (plain eggs, the classic chick) is left to world.js drawEgg.
export function drawChickEgg(ctx, egg, t, k) {
  if (!egg.chick) {
    if (!egg.tint || !KIND[egg.tint]) return false;
    drawTintedEgg(ctx, egg, t, k);
    return true;
  }
  const kind = egg.chickKind;
  if (!KIND[kind]) return false;
  const b = egg.body, p = b.getPosition(), v = b.getLinearVelocity();
  const st = { flap: v.y < -0.3 ? 1 : 0.3, ready: !egg.powU, pow: egg.powK || 0, powT: egg.powT || 0, face: egg.face || 1 };
  const T = t + egg.id * 0.37; // chicks out of step with each other
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(1 / k, -1 / k);
  if (st.ready) { drawReady(ctx, kind, 0, 0, 0.36 * k, T); drawHint(ctx, kind, st.face, 0.36 * k, T); }
  if (kind === 'bulk' && st.pow) {
    // the puffed body lies along the channel: size from the fixture, scaled into the 100-unit box
    const u = (0.5 * k * 1.5) / 100, verts = egg.fix.getShape().m_vertices || [];
    const hb = verts.length > 2 ? Math.abs(verts[2].y) : 0.34;
    st.rx = ((BULK_LEN + 0.06) * k) / u;
    st.ry = ((hb + 0.07) * k) / u;
    st.rot = -(Math.atan2(p.y, p.x) + Math.PI / 2);
  }
  drawKindChick(ctx, kind, 0, 0, 0.5 * k, T, st);
  ctx.restore();
  return true;
}

/* ------------------------------------------------------------- hard ice rings */

// Over the ring drawn by world.js: glossy pale-blue ice on hard-ice segments, frost cracks, and a hole
// that freezes over again from its edges.
export function drawHardIce(ctx, ring, k, t) {
  if (!ring.hardIce) return;
  const A = ring.body.getAngle(), r = ring.r, ri = r - RING_TH / 2, ro = r + RING_TH / 2;
  const runs = [], holes = [];
  let run = null, hole = null;
  for (const sg of ring.segs) {
    if (!sg.hardIce) { run = hole = null; continue; }
    if (sg.alive) { if (run && Math.abs(run.a1 - sg.a0) < 1e-4) run.a1 = sg.a1; else runs.push((run = { a0: sg.a0, a1: sg.a1 })); hole = null; }
    else if (sg.iceT > 0) { if (hole && Math.abs(hole.a1 - sg.a0) < 1e-4) { hole.a1 = sg.a1; hole.t = Math.min(hole.t, sg.iceT); } else holes.push((hole = { a0: sg.a0, a1: sg.a1, t: sg.iceT })); run = null; }
    else run = hole = null;
  }
  const px = 1 / k;
  ctx.save();
  ctx.rotate(A);
  for (const R of runs) {
    const arc = (r0, r1) => { ctx.beginPath(); ctx.arc(0, 0, r1, R.a0, R.a1); ctx.arc(0, 0, r0, R.a1, R.a0, true); ctx.closePath(); };
    // thick glacier blue, a touch fatter than the ring so it reads as a different material
    arc(ri - 0.02, ro + 0.02);
    const g = ctx.createRadialGradient(0, 0, ri - 0.02, 0, 0, ro + 0.02);
    g.addColorStop(0, '#3fa6dc');
    g.addColorStop(0.35, '#8ad8f8');
    g.addColorStop(0.62, '#e4f8ff');
    g.addColorStop(0.8, '#a8e4fb');
    g.addColorStop(1, '#4fb2e2');
    ctx.fillStyle = g;
    ctx.fill();
    // crystal blocks: a seam every ~0.4 m, each block with a bright facet
    const n = Math.max(1, Math.round(((R.a1 - R.a0) * r) / 0.4));
    ctx.save();
    arc(ri - 0.02, ro + 0.02);
    ctx.clip();
    for (let i = 0; i < n; i++) {
      const b0 = R.a0 + (i / n) * (R.a1 - R.a0), b1 = R.a0 + ((i + 1) / n) * (R.a1 - R.a0), bm = (b0 + b1) / 2;
      ctx.beginPath();
      ctx.moveTo((ri - 0.02) * Math.cos(b0), (ri - 0.02) * Math.sin(b0));
      ctx.lineTo((ro + 0.02) * Math.cos(bm), (ro + 0.02) * Math.sin(bm));
      ctx.lineTo((ro + 0.02) * Math.cos(b0), (ro + 0.02) * Math.sin(b0));
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.32)';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo((ri - 0.02) * Math.cos(b1), (ri - 0.02) * Math.sin(b1));
      ctx.lineTo((ro + 0.02) * Math.cos(b1), (ro + 0.02) * Math.sin(b1));
      ctx.strokeStyle = 'rgba(25,90,140,0.7)';
      ctx.lineWidth = Math.max(1.4 * px, 0.012);
      ctx.stroke();
      // a frost crack in every other block
      if (i % 2 === 0) {
        const da = (0.05 / r) * (1 + 0.5 * Math.sin(i * 12.9898 + r * 7));
        ctx.beginPath();
        ctx.moveTo((ri - 0.01) * Math.cos(bm), (ri - 0.01) * Math.sin(bm));
        ctx.lineTo(r * Math.cos(bm + da), r * Math.sin(bm + da));
        ctx.lineTo((r + 0.05) * Math.cos(bm - da), (r + 0.05) * Math.sin(bm - da));
        ctx.moveTo(r * Math.cos(bm + da), r * Math.sin(bm + da));
        ctx.lineTo((r + 0.03) * Math.cos(bm + da * 3), (r + 0.03) * Math.sin(bm + da * 3));
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.lineWidth = Math.max(1.6 * px, 0.013);
        ctx.stroke();
      }
    }
    ctx.restore();
    // glossy streak and a frosted rim
    ctx.beginPath();
    ctx.arc(0, 0, ro - RING_TH * 0.18, R.a0 + 0.03, R.a1 - 0.03);
    ctx.lineWidth = Math.max(2 * px, RING_TH * 0.13);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.stroke();
    arc(ri - 0.02, ro + 0.02);
    ctx.lineWidth = Math.max(2.5 * px, 0.024);
    ctx.strokeStyle = '#1b5a86';
    ctx.stroke();
    // twinkles
    for (let i = 0; i < n; i++) {
      const a = R.a0 + ((i + 0.3) / n) * (R.a1 - R.a0), tw = Math.max(0, Math.sin(t * 2.3 + i * 2.1 + r));
      if (tw < 0.55) continue;
      ctx.save();
      ctx.translate((ro - 0.03) * Math.cos(a), (ro - 0.03) * Math.sin(a));
      ctx.scale(px, px);
      ctx.fillStyle = `rgba(255,255,255,${(tw - 0.55) * 2.2})`;
      sparkle(ctx, 0, 0, 6);
      ctx.restore();
    }
  }
  // holes: jagged ice teeth at both ends, and new ice creeping in for the last 1.5 s
  for (const H of holes) {
    const f = clamp(1 - H.t / 1.5, 0, 1);
    for (const [a, dir] of [[H.a0, 1], [H.a1, -1]]) {
      ctx.beginPath();
      ctx.moveTo(ri * Math.cos(a), ri * Math.sin(a));
      const teeth = 3;
      for (let i = 0; i <= teeth; i++) {
        const rr = ri + ((ro - ri) * i) / teeth, d = (i % 2 ? 0.1 : 0.04) / r + (f * (H.a1 - H.a0)) / 2;
        ctx.lineTo(rr * Math.cos(a + dir * d), rr * Math.sin(a + dir * d));
      }
      ctx.lineTo(ro * Math.cos(a), ro * Math.sin(a));
      ctx.closePath();
      ctx.fillStyle = 'rgba(214,241,255,0.95)';
      ctx.fill();
      ctx.lineWidth = Math.max(1.5 * px, 0.014);
      ctx.strokeStyle = '#3d7ea8';
      ctx.stroke();
    }
    if (f > 0) { // a thin film across, thickening
      ctx.beginPath();
      ctx.arc(0, 0, r + RING_TH * 0.1, H.a0, H.a1);
      ctx.lineWidth = RING_TH * 0.5 * f;
      ctx.strokeStyle = `rgba(200,236,255,${0.35 + 0.4 * f})`;
      ctx.stroke();
    }
  }
  ctx.restore();
}

/* ------------------------------------------------------------- power VFX */

function starsAround(ctx, x, y, R, t, n, col) {
  ctx.save();
  ctx.translate(x, y);
  for (let i = 0; i < n; i++) {
    const a = t * 4 + (i / n) * TAU;
    ctx.fillStyle = col;
    sparkle(ctx, Math.cos(a) * R, Math.sin(a) * R * 0.45, R * 0.32);
  }
  ctx.restore();
}

// World space, drawn over the eggs: the flash, dash streaks, swoop wind, pick sparks, daze stars.
export function drawChickFX(ctx, sim, t, k) {
  const px = 1 / k;
  for (const e of sim.eggs) {
    if (!e.alive || e.saved || !e.chick || !e.powK || !e.body) continue;
    const p = e.body.getPosition(), kind = e.chickKind;
    if (kind === 'glow') {
      const u = clamp(1 - e.powT / 0.7, 0, 1), R = GLOW_R * (0.25 + 0.75 * Math.sqrt(u)), a = 1 - u;
      const x = e.powX ?? p.x, y = e.powY ?? p.y;
      const g = ctx.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, `rgba(255,255,235,${0.85 * a})`);
      g.addColorStop(0.6, `rgba(255,236,120,${0.45 * a})`);
      g.addColorStop(1, 'rgba(255,220,90,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, R, 0, TAU);
      ctx.fill();
      // the shock ring and rays
      ctx.lineWidth = Math.max(3 * px, 0.05 * a);
      ctx.strokeStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, R, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,240,150,${0.9 * a})`;
      ctx.lineWidth = Math.max(2 * px, 0.03);
      for (let i = 0; i < 12; i++) {
        const b = (i / 12) * TAU + 0.2, r0 = R * 0.35, r1 = R * (0.7 + 0.25 * (i % 2));
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(b) * r0, y + Math.sin(b) * r0);
        ctx.lineTo(x + Math.cos(b) * r1, y + Math.sin(b) * r1);
        ctx.stroke();
      }
    } else if (kind === 'dash') {
      const v = e.body.getLinearVelocity(), sp = Math.hypot(v.x, v.y) || 1, ux = v.x / sp, uy = v.y / sp;
      const f = clamp(e.powT / DASH_T, 0, 1);
      ctx.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const off = (i - 2) * 0.08, L = (0.25 + 0.15 * ((i * 7) % 3)) * (0.5 + f), sh = mod(t * 9 + i * 0.37, 1) * 0.15;
        const x0 = p.x - uy * off - ux * (0.3 + sh), y0 = p.y + ux * off - uy * (0.3 + sh);
        ctx.strokeStyle = i % 2 ? 'rgba(255,255,255,0.75)' : 'rgba(255,170,80,0.7)';
        ctx.lineWidth = Math.max(2.5 * px, 0.035);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 - ux * L, y0 - uy * L);
        ctx.stroke();
      }
    } else if (kind === 'swoop') {
      const v = e.body.getLinearVelocity(), sp = Math.hypot(v.x, v.y) || 1, ux = v.x / sp, uy = v.y / sp;
      ctx.lineCap = 'round';
      const back = Math.atan2(-uy, -ux), al = e.powK === 1 ? 0.9 : 0.5;
      for (let i = 0; i < 3; i++) {
        const ph = mod(t * 3 + i / 3, 1), d = 0.32 + ph * 0.45, R = 0.22 + ph * 0.12;
        ctx.strokeStyle = `rgba(225,245,255,${al * (1 - ph)})`;
        ctx.lineWidth = Math.max(2.5 * px, 0.04 * (1 - ph * 0.6));
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(back) * d, p.y + Math.sin(back) * d, R, back + Math.PI - 0.9, back + Math.PI + 0.9);
        ctx.stroke();
      }
    } else if (kind === 'pick' && e.powK === 1) {
      const ring = sim.rings[e.powA];
      if (!ring) continue;
      const a = Math.atan2(p.y, p.x), d = Math.hypot(p.x, p.y), rr = d < ring.r ? ring.r - RING_TH / 2 : ring.r + RING_TH / 2;
      const x = rr * Math.cos(a), y = rr * Math.sin(a), u = clamp(1 - e.powT / PICK_T, 0, 1);
      // a crack spreading on the ring from the drill point
      ctx.strokeStyle = 'rgba(30,50,80,0.85)';
      ctx.lineWidth = Math.max(1.6 * px, 0.016);
      const tx = -Math.sin(a), ty = Math.cos(a);
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let i = 1; i <= 4; i++) { const l = 0.1 * i * u * 1.6, w = (i % 2 ? 0.03 : -0.02); ctx.lineTo(x + tx * l * s + Math.cos(a) * w, y + ty * l * s + Math.sin(a) * w); }
        ctx.stroke();
      }
      // sparks / ice chips spraying
      for (let i = 0; i < 7; i++) {
        const ph = mod(t * 5 + i * 0.143, 1), ang = a + Math.PI + (i - 3) * 0.32 + (d < ring.r ? 0 : Math.PI);
        const sx = x + Math.cos(ang) * ph * 0.45, sy = y + Math.sin(ang) * ph * 0.45 + ph * ph * 0.1;
        ctx.fillStyle = ring.hardIce ? `rgba(220,245,255,${1 - ph})` : `rgba(255,220,120,${1 - ph})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 0.025 * (1 - ph * 0.5), 0, TAU);
        ctx.fill();
      }
    }
  }
  // dizzy stars over stunned snakes and a dazed eagle
  for (const S of sim.snakes || []) if (S.daze > 0 && !S.gone && S.pts.length) { const h = S.pts[0]; starsAround(ctx, h.x, h.y + 0.25, 0.22, t, 3, '#ffe14d'); }
  const E = sim.eagle;
  if (E && E.daze > 0) starsAround(ctx, E.x, E.y + 0.45, 0.32, t, 4, '#ffe14d');
}

/* ------------------------------------------------------------- events */
// api: { popup(x, y, text, o), audio, hen(mood, t), toast(text) }
export function chickEvent(ev, fx, api) {
  const { popup, audio } = api;
  const C = KIND[ev.kind] || (ev.egg && KIND[ev.egg.chickKind]);
  switch (ev.type) {
    case 'chickTint':
      audio.play('unlock', { pitch: 1.2 });
      fx.sparkle(ev.x, ev.y, 6, `rgb(${KIND[ev.kind].glow})`);
      break;
    case 'chickHatch':
      if (!KIND[ev.kind]) break;
      audio.play('twin_hatch', { pitch: 1.15 });
      fx.chips(ev.x, ev.y, '#f7ecd6', 8, 2.2);
      api.toast?.(`${KIND[ev.kind].name}: tap it to use its power!`);
      break;
    case 'chickPower':
      if (C) fx.wave(ev.x, ev.y, 0.6, `rgb(${C.glow})`, 0.3, 0.06);
      if (ev.kind === 'dash') { audio.play('wind_gust', { pitch: 1.8, vol: 0.8 }); fx.dust(ev.x, ev.y - 0.2, 6); }
      if (ev.kind === 'swoop') audio.play('wind_gust', { pitch: 1.3, vol: 0.7 });
      if (ev.kind === 'bulk') { audio.play('bubble_on', { pitch: 0.6 }); fx.dust(ev.x, ev.y - 0.25, 10, 'rgba(200,240,160,0.8)'); popup(ev.x, ev.y + 0.7, 'PUFF!', { color: '#b6f070', size: 24, life: 0.9 }); }
      if (ev.kind === 'pick') audio.play('motor_tick', { pitch: 2.2 });
      break;
    case 'chickFlash':
      audio.play('thunder', { pitch: 1.6, vol: 0.8 });
      audio.play('fire_ignite', { pitch: 1.4 });
      fx.flash = Math.max(fx.flash || 0, 0.55);
      fx.flashColor = '#fff6c8';
      fx.sparkle(ev.x, ev.y, 24, '#fff2a0');
      fx.shake = Math.max(fx.shake, 0.3);
      popup(ev.x, ev.y + 0.75, 'FLASH!', { sub: ev.n ? `${ev.n} thorns burnt` : '', color: '#fff27a', size: 28, life: 1.1 });
      break;
    case 'snakeDaze':
      audio.play('steel_clang', { pitch: 1.4, vol: 0.6 });
      popup(ev.x, ev.y + 0.5, 'Dizzy!', { color: '#ffe14d', size: 20, life: 1 });
      break;
    case 'eagleDaze':
      audio.play('glass_crack', { pitch: 1.4, vol: 0.6 });
      popup(ev.x, ev.y + 0.6, 'Dazzled!', { color: '#ffe14d', size: 20, life: 1 });
      break;
    case 'chickDashEnd':
      fx.dust(ev.x, ev.y - 0.2, 5);
      break;
    case 'chickGlide':
      fx.sparkle(ev.x, ev.y, 8, '#bfe6ff');
      break;
    case 'swoopClear':
      popup(ev.x, ev.y + 0.5, 'Swoosh!', { color: '#9fd8ff', size: 22, life: 1 });
      fx.chips(ev.x, ev.y, '#5a8a3a', 10, 3);
      break;
    case 'chickPluck':
      if (ev.n) { audio.play('thorn_snap', { pitch: 1.4 }); popup(ev.x, ev.y + 0.6, 'Pluck!', { color: '#9fd8ff', size: 20 }); }
      break;
    case 'chickDeflate':
      audio.play('bubble_pop', { pitch: 0.7 });
      fx.dust(ev.x, ev.y, 6, 'rgba(200,240,160,0.8)');
      break;
    case 'iceShatter':
      audio.play('glass_break');
      fx.chips(ev.x, ev.y, '#d6f2ff', 16, 3.2);
      fx.sparkle(ev.x, ev.y, 10, '#ffffff');
      fx.shake = Math.max(fx.shake, 0.35);
      popup(ev.x, ev.y + 0.6, 'CRACK!', { color: '#bfeaff', size: 26, life: 1 });
      break;
    case 'chickDrill':
      audio.play('rock_hit', { pitch: 1.5, vol: 0.7 });
      fx.chips(ev.x, ev.y, '#e8d2a0', 8, 2);
      popup(ev.x, ev.y + 0.6, ev.n ? 'Chip!' : 'Too hard!', { color: '#e2ccff', size: 18, life: 0.9 });
      break;
    case 'iceHeal':
      audio.play('glass_crack', { pitch: 1.8, vol: 0.4 });
      fx.sparkle(ev.x, ev.y, 6, '#e8f8ff');
      break;
  }
}
