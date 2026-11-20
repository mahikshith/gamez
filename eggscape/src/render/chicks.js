// Chick kinds art (v3.2 K5/K6): the five tap-power chicks, their ready sparkle and power poses, tinted eggs,
// hatch orbs, hard-ice rings and the power VFX. Same look as the classic chick (characters.js): thick warm-brown
// outline, flat cel shading (base, one hard shadow, one hard highlight), big glossy eyes.
// Character art draws in a local y-DOWN 100-unit box (s = egg size in px, the chick is 1.5x that); the world
// helpers at the bottom take world space (meters, y up) like world.js.
import { EGG_H, EGG_W, RING_TH, TAU, eggPoint } from '../sim/geom.js';
import { GLOW_R, BULK_LEN, DASH_T, PICK_T } from '../sim/chicks.js';
import { drawEgg } from './world.js';
import { POWER_INFO, ORB_ART } from './powers.js';
import { stamp } from './stamp.js';

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

// bend: the wing tip trails the stroke (follow-through): > 0 curls the outer wing up, < 0 down
function swoopWing(ctx, sx, ang, span, C, o, bend = 0) {
  ctx.save();
  ctx.translate(sx * 22, 4);
  ctx.scale(sx, 1);
  ctx.rotate(-ang);
  const Y = (f, y) => y - bend * 15 * f * f; // f: 0 at the shoulder .. 1 at the tip
  const wing = () => {
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.bezierCurveTo(span * 0.35, Y(0.35, -20), span * 0.8, Y(0.8, -18), span, Y(1, -10));
    // three feather tips along the trailing edge
    ctx.quadraticCurveTo(span * 0.98, Y(0.98, -2), span * 0.82, Y(0.82, 0));
    ctx.quadraticCurveTo(span * 0.82, Y(0.82, 7), span * 0.62, Y(0.62, 6));
    ctx.quadraticCurveTo(span * 0.58, Y(0.58, 13), span * 0.4, Y(0.4, 10));
    ctx.quadraticCurveTo(span * 0.2, Y(0.2, 14), 0, 8);
    ctx.closePath();
  };
  wing();
  ctx.fillStyle = C.shade;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = C.base;
  ctx.beginPath();
  ctx.ellipse(span * 0.4, Y(0.4, -16), span * 0.7, 12, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,70,140,0.4)';
  ctx.lineWidth = 1.6;
  for (const f of [0.4, 0.62, 0.82]) { ctx.beginPath(); ctx.moveTo(span * f * 0.8, Y(f * 0.8, -6)); ctx.quadraticCurveTo(span * f * 0.95, Y(f, -1), span * f, Y(f, 3)); ctx.stroke(); }
  ctx.restore();
  wing(); // (2026-11-16) outline the wing itself: the stroke used to draw the last feather line, sticking out past the wing
  ctx.lineWidth = o;
  ctx.strokeStyle = LINE;
  ctx.stroke();
  ctx.restore();
}
// grab pose: both legs reach forward-down with the toes spread (ext 0 tucked under .. 1 reaching)
function talons(ctx, ext, o) {
  const a = Math.PI / 2 - 1.0 * ext, len = 7 + 6 * ext, sp = 0.45 + 0.35 * ext;
  for (const pass of [0, 1]) {
    ctx.lineWidth = pass ? 3.2 : 3.2 + o * 1.3;
    ctx.strokeStyle = pass ? '#ffa62b' : LINE;
    ctx.beginPath();
    for (const x of [-7, 6]) {
      const y = 34, ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
      ctx.moveTo(x, y);
      ctx.lineTo(ex, ey);
      for (const d of [-sp, 0, sp]) { ctx.moveTo(ex, ey); ctx.lineTo(ex + Math.cos(a + d) * 5, ey + Math.sin(a + d) * 5); }
    }
    ctx.stroke();
  }
}
const SWOOP_RISE = 1.1, SWOOP_GLIDE = 1.6; // = SWOOP_RISE_MAX, SWOOP_GLIDE in sim/chicks.js (phase lengths)
const smooth = (q) => q * q * (3 - 2 * q);
function swoopChick(ctx, t, o, st) {
  const C = KIND.swoop, rise = st.pow === 1, glide = st.pow === 2, land = st.land;
  // wing pose: idle half folded with a small flutter, ready lifted. Rising: a crouch, then strong flaps (fast
  // downstroke, slower recovery) with the tips trailing each stroke and the body bobbing on the beat. Gliding: the
  // wings snap open and ride the air, then the feet reach forward to grab. Landing: a springy squash, wings fold.
  let ang, span = 40, bend = 0, by = 0, sx = 1, sy = 1, lean = 0, grab = -1, mood = null, look = { x: 1, y: 0 };
  if (rise) {
    const e = SWOOP_RISE - clamp(st.powT, 0, SWOOP_RISE);
    look = { x: 0, y: -2 };
    if (e < 0.07) { const q = Math.sin((e / 0.07) * Math.PI / 2); ang = 1.1 * q; sy = 1 - 0.14 * q; sx = 1 + 0.1 * q; by = 4 * q; }
    else {
      const f = mod((e - 0.07) * 5.5, 1), D = 0.38;
      if (f < D) { const q = f / D; ang = 1.1 - 1.75 * smooth(q); bend = 0.9 * Math.sin(q * Math.PI); by = -3 * Math.sin(q * Math.PI); }
      else { const q = (f - D) / (1 - D); ang = -0.65 + 1.75 * smooth(q); bend = -0.5 * Math.sin(q * Math.PI); by = 1.5 * Math.sin(q * Math.PI); }
      sy = 1.07; sx = 0.95;
    }
  } else if (glide) {
    const g = SWOOP_GLIDE - clamp(st.powT, 0, SWOOP_GLIDE);
    span = 46;
    ang = 0.25 + Math.sin(t * 3) * 0.06 + 0.7 * Math.exp(-g * 9) * Math.cos(g * 17);
    bend = 0.25 + 0.08 * Math.sin(t * 3 + 1) + 0.5 * Math.exp(-g * 8);
    lean = 0.14 * clamp(g / 0.3, 0, 1);
    grab = clamp((g - 0.3) / 0.25, 0, 1);
    if (g < 0.35) mood = 'happy';
    else look = { x: 1.5, y: 1.8 };
  } else if (land !== undefined) {
    const k = Math.exp(-land * 7) * Math.cos(land * 20);
    sy = 1 - 0.16 * k; sx = 1 + 0.12 * k;
    ang = -0.75 + 1.0 * Math.exp(-land * 6) * Math.cos(land * 13);
    if (land < 0.3) mood = 'happy';
  } else ang = -0.75 + Math.sin(t * (8 + 26 * st.flap)) * (0.15 + 0.5 * st.flap) + (st.ready ? 0.45 + 0.12 * Math.sin(t * 5) : 0);
  ctx.translate(0, by + 44);
  ctx.scale(sx, sy); // squash and stretch about the feet
  ctx.translate(0, -44);
  if (lean) { ctx.translate(0, 10); ctx.rotate(lean); ctx.translate(0, -10); }
  // tail feathers
  for (const [r, l] of [[-0.35, 16], [0, 19], [0.35, 16]]) {
    ctx.save();
    ctx.translate(-4, 34);
    ctx.rotate(r + 2.7 - lean * 1.5);
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
  if (grab >= 0) talons(ctx, grab, o);
  else if (rise) legs(ctx, [-7, 7], 35, 7, 0, t, o); // dangling
  else legs(ctx, [-8, 8], 36, 8, st.flap, t, o);
  swoopWing(ctx, -1, ang, span, C, o, bend);
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
  swoopWing(ctx, 1, ang, span, C, o, bend);
  // curl crest (blown back while it flies)
  const cb = rise ? 0.35 : glide ? 0.2 : 0;
  ctx.save();
  ctx.translate(-2, -19);
  ctx.rotate(-cb);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-2, -15, 14, -17, 12, -7);
  ctx.bezierCurveTo(11, -3, 6, -5, 7, -8);
  ctx.lineWidth = 5 + o;
  ctx.strokeStyle = LINE;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.lineWidth = 5;
  ctx.strokeStyle = C.shade;
  ctx.stroke();
  ctx.restore();
  // face
  const fy = 6, bl = blinkAt(t, 3);
  cheeks(ctx, [[-18, fy + 10], [20, fy + 10]], 5, 0.4);
  for (const s2 of [-1, 1]) eye(ctx, s2 * 10 + 3, fy, 6.6, 8.8, t, o, { shut: rise || glide ? 0 : bl, mood, look });
  // a small hooked beak between the eyes (2026-11-16: the old long wedge cut across the face)
  ctx.beginPath();
  ctx.moveTo(-2.5, fy + 9);
  ctx.quadraticCurveTo(3, fy + 6.5, 9, fy + 9);
  ctx.quadraticCurveTo(10, fy + 13, 4.5, fy + 17.5);
  ctx.quadraticCurveTo(3, fy + 18.5, 2, fy + 16);
  ctx.quadraticCurveTo(-1, fy + 13, -2.5, fy + 9);
  ctx.closePath();
  const bg = ctx.createLinearGradient(0, fy + 7, 0, fy + 18);
  bg.addColorStop(0, '#ffd04a'); bg.addColorStop(1, '#f39a1c');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.lineWidth = o * 0.8;
  ctx.strokeStyle = LINE;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath(); ctx.ellipse(1.5, fy + 10, 2.4, 1.2, -0.2, 0, TAU); ctx.fill();
}

// a loose feather (leaf shape) at (x, y), turned a
function feather(ctx, x, y, a, sz, col, o) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(-sz, 0);
  ctx.quadraticCurveTo(0, -sz * 0.5, sz, 0);
  ctx.quadraticCurveTo(0, sz * 0.5, -sz, 0);
  ctx.closePath();
  ctx.fillStyle = col;
  ctx.fill();
  ctx.lineWidth = Math.min(o * 0.45, sz * 0.3);
  ctx.strokeStyle = LINE;
  ctx.stroke();
  ctx.restore();
}
// st.inhale 0..1: the breath in before the puff (cheeks full, eyes screwed shut); st.deflate (s since it went
// flat): a springy boing back to size, a relieved face and a little "pfff" of air and feathers
function bulkChick(ctx, t, o, st) {
  const C = KIND.bulk, inh = st.inhale || 0, df = st.deflate;
  if (df !== undefined) {
    const k = Math.exp(-df * 7) * Math.cos(df * 19);
    ctx.translate(0, 44);
    ctx.scale(1 + 0.14 * k, 1 - 0.16 * k);
    ctx.translate(0, -44);
  }
  legs(ctx, [-14, 14], 37, 7, st.flap, t, o);
  const wa = inh ? 0.6 * inh : Math.sin(t * (9 + 30 * st.flap)) * (0.3 + 0.5 * st.flap) + (st.ready ? 0.3 : 0);
  for (const sx of [-1, 1]) stubWing(ctx, sx * 37, 14, sx, wa, 0.85, C, o);
  // three hair tufts
  ctx.lineCap = 'round';
  for (const [x, r] of [[-5, -0.4], [0, 0], [5, 0.4]]) {
    ctx.save();
    ctx.translate(x, -18);
    ctx.rotate(r * (1 + inh) + Math.sin(t * 4 + x) * 0.1);
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
  const fy = 8, bl = blinkAt(t, 4), relief = df !== undefined && df < 0.4;
  cheeks(ctx, [[-25, fy + 11], [25, fy + 11]], 7.5 + 4 * inh, 0.5 + 0.2 * inh);
  for (const sx of [-1, 1]) eye(ctx, sx * 13, fy, 7, 8.6, t, o, { shut: bl, mood: inh > 0.3 ? 'squint' : relief ? 'happy' : null, side: sx });
  if (inh) { // cheeks full: a pursed beak
    ctx.beginPath();
    ctx.ellipse(0, fy + 12, 4, 3, 0, 0, TAU);
    ctx.fillStyle = '#ffb12e';
    ctx.fill();
    ctx.lineWidth = o * 0.8;
    ctx.strokeStyle = LINE;
    ctx.stroke();
  } else beakDown(ctx, 0, fy + 10, 4.5, relief ? 5 : 2 + Math.sin(t * 6) * 0.5, o);
  if (df !== undefined) {
    const f = clamp(df / 0.6, 0, 1);
    // pfff: the last air out of the beak, and a few feathers floating down
    ctx.fillStyle = `rgba(240,255,225,${0.85 * (1 - f)})`;
    ctx.strokeStyle = `rgba(110,58,18,${0.5 * (1 - f)})`;
    ctx.lineWidth = o * 0.5;
    for (let i = 0; i < 3; i++) {
      const q = clamp(f * 1.6 - i * 0.15, 0, 1);
      if (!q) continue;
      ctx.beginPath();
      ctx.arc(9 + q * (22 + i * 7), fy + 16 - q * (4 + i * 3), 3 + q * (4 + i), 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    ctx.globalAlpha = 1 - f * f;
    for (let i = 0; i < 4; i++) {
      const sd = i % 2 ? 1 : -1, x = sd * (16 + 10 * i + 14 * f), y = -6 + 34 * f * f - 14 * f + Math.sin(f * 9 + i) * 3;
      feather(ctx, x, y, sd * (0.5 + f * 2.5) + Math.sin(f * 8 + i) * 0.4, 8, i % 3 ? C.base : C.belly, o);
    }
    ctx.globalAlpha = 1;
  }
}
// the puffed bulk chick: a big spiky fluff ball lying along the channel (rx, ry in 100-units), face upright.
// Puff: a breath in (anticipation squash, 0.1 s), then it springs out past full size and settles (spring k 9, w 17),
// throwing out a ring of feathers. Big: a jelly wobble. Last 0.6 s: it shudders, then sags as the air leaks out.
function bulkPuffed(ctx, t, o, st, rx, ry, rot) {
  const C = KIND.bulk, P = clamp(st.powT, 0, 5), e = 5 - P;
  if (e < 0.1) {
    const q = Math.sin((e / 0.1) * Math.PI / 2);
    ctx.save();
    ctx.translate(0, 44);
    ctx.scale(1 + 0.12 * q, 1 - 0.15 * q);
    ctx.translate(0, -44);
    bulkChick(ctx, t, o, { ...st, inhale: q, ready: false });
    ctx.restore();
    return;
  }
  const tau = e - 0.1, t2 = Math.max(0, tau - 0.035), g = 1 - Math.exp(-tau * 9) * Math.cos(tau * 17), g2 = 1 - Math.exp(-t2 * 9) * Math.cos(t2 * 17);
  const wob = Math.sin(t * 6.5) * 0.035 * clamp(tau / 0.5, 0, 1), end = P < 0.6 ? 0.5 + 0.5 * Math.sin(t * 40) : 1, sag = clamp(1 - P / 0.25, 0, 1);
  const sx = rx * (0.42 + 0.58 * g) * (1 + wob) * (0.97 + 0.03 * end) * (1 - 0.25 * sag), sy = ry * (0.55 + 0.45 * g2) * (1 - wob) * (1 - 0.2 * sag);
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
  // the pop: a ring of feathers flung out, slowing, then drifting down
  if (tau < 0.8) {
    const f = tau / 0.8, d = 1 - Math.exp(-f * 5);
    ctx.globalAlpha = 1 - f * f;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + 0.3, r = 0.9 + 0.35 * d;
      feather(ctx, Math.cos(a) * rx * r, Math.sin(a) * ry * r + f * f * 22, a + f * 4 * (i % 2 ? 1 : -1), 9, i % 3 ? C.base : C.belly, o);
    }
    ctx.globalAlpha = 1;
  }
  // face upright: puffed cheeks, squeezed determined eyes; the air leaking out at the end puffs from the beak
  const fy = -sy * 0.12;
  cheeks(ctx, [[-sx * 0.36, fy + 14], [sx * 0.36, fy + 14]], 11 * (1 - 0.3 * sag), 0.55);
  for (const s2 of [-1, 1]) eye(ctx, s2 * 15, fy, 7.5, 7.5, t, o, { shut: 0.35 + 0.3 * sag });
  brows(ctx, [[-24, fy - 13, -8, fy - 9], [24, fy - 13, 8, fy - 9]], o);
  ctx.beginPath(); // puffed cheeks hold the breath: a tiny pursed beak
  ctx.ellipse(0, fy + 13, 5, 3.6, 0, 0, TAU);
  ctx.fillStyle = '#ffb12e';
  ctx.fill();
  ctx.lineWidth = o * 0.8;
  ctx.strokeStyle = LINE;
  ctx.stroke();
  if (P < 0.4) {
    ctx.fillStyle = 'rgba(240,255,225,0.85)';
    ctx.strokeStyle = 'rgba(110,58,18,0.5)';
    ctx.lineWidth = o * 0.5;
    for (let i = 0; i < 2; i++) {
      const q = mod(t * 3 + i * 0.5, 1);
      ctx.globalAlpha = 1 - q;
      ctx.beginPath();
      ctx.arc(6 + q * 14, fy + 12 - q * 12, 2 + q * 3, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

// Drill bit spin: p = groove pitches turned so far (the grooves scroll toward the tip as the bit turns), v = pitches/s.
// Idle: a lazy turn. Ready: a little rev every 1.9 s. Drilling: spin-up (tau 0.07 s) to 24/s, just under the 30/s
// where 60 fps would freeze the grooves; the recoil spins down.
const SPIN = 24;
function drillSpin(t, st) {
  if (st.pow === 1) { const e = PICK_T - clamp(st.powT, 0, PICK_T), r = Math.exp(-e / 0.07); return { p: SPIN * (e - 0.07 * (1 - r)), v: SPIN * (1 - r) }; }
  if (st.pow === 2) { const e = 0.35 - clamp(st.powT, 0, 0.35), r = Math.exp(-e / 0.12); return { p: SPIN * 0.12 * (1 - r), v: SPIN * r }; }
  let p = t * 0.9, v = 0.9;
  if (st.ready) {
    const c = Math.floor(t / 1.9), q = t - c * 1.9, D = 0.42, A = 3.4;
    p += c * A + (q < D ? A * (q / D - Math.sin((TAU * q) / D) / TAU) : A);
    if (q < D) v += (A / D) * (1 - Math.cos((TAU * q) / D));
  }
  return { p, v };
}
// The drill bit: a steel cone along +x from its base (x 0, radius W) to the tip (x L). Round, not flat: tone bands
// run its length and close in at the tip (lit top, dark underside), and the thread is a helix seen side-on: each
// turn is a curve bowing toward the tip with a glint on its lit flank. As it spins the turns slide toward the tip, so
// the glints wrap round and travel along the bit; fast, they smear into a blur with whirr marks either side.
const BIT_TONES = [[-1, -0.62, '#c3ccd8'], [-0.62, -0.2, '#eef2f7'], [-0.2, 0.3, '#a4aebd'], [0.3, 0.68, '#7d8898'], [0.68, 1, '#5d6676']];
function drillBit(ctx, L, W, spin, o) {
  const cone = () => { ctx.beginPath(); ctx.moveTo(0, -W); ctx.lineTo(L, 0); ctx.lineTo(0, W); ctx.closePath(); };
  cone();
  ctx.save();
  ctx.clip();
  for (const [a, b, c] of BIT_TONES) { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(-1, a * W); ctx.lineTo(L, 0); ctx.lineTo(-1, b * W); ctx.closePath(); ctx.fill(); }
  const P = 7.5, blur = clamp((spin.v - 9) / 12, 0, 1);
  // one thread turn's visible front half, top (th -PI/2) to bottom (th PI/2), starting at axial x0
  const turn = (x0, th0, th1) => {
    for (let i = 0; i <= 6; i++) {
      const th = th0 + ((th1 - th0) * i) / 6, xa = x0 + (P * (th + Math.PI / 2)) / TAU, r = W * clamp(1 - xa / L, 0, 1), x = xa + 0.45 * r * Math.cos(th), y = r * Math.sin(th);
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
  };
  for (const [off, a] of blur ? [[0, 0.85 - 0.35 * blur], [P / 2, 0.4 * blur]] : [[0, 0.9]]) {
    const ph = mod(spin.p, 1) * P + off;
    ctx.beginPath();
    for (let x = -P + ph; x < L; x += P) turn(x, -Math.PI / 2, Math.PI / 2);
    ctx.strokeStyle = `rgba(52,58,72,${a})`;
    ctx.lineWidth = 2.1;
    ctx.stroke();
    ctx.beginPath();
    for (let x = -P + ph; x < L; x += P) turn(x - P * 0.42, -1.3, -0.35);
    ctx.strokeStyle = `rgba(255,255,255,${a})`;
    ctx.lineWidth = 1.7;
    ctx.stroke();
  }
  if (blur) { ctx.fillStyle = `rgba(214,222,232,${0.3 * blur})`; ctx.fillRect(0, -W, L, 2 * W); }
  ctx.restore();
  cone();
  ctx.lineWidth = o * 0.85;
  ctx.strokeStyle = LINE;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.fillStyle = '#ffffff'; // tip glint
  ctx.beginPath(); ctx.arc(L - 4, -0.9, 1.1, 0, TAU); ctx.fill();
  if (spin.v > 6) { // whirr marks
    const a = clamp((spin.v - 6) / 10, 0, 1), f = mod(spin.p * 0.37, 1) > 0.5 ? 1 : 0;
    ctx.strokeStyle = `rgba(110,58,18,${0.65 * a})`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (const sy of [-1, 1]) { const x = L * (0.3 + 0.12 * f); ctx.moveTo(x - 4, sy * (W + 4)); ctx.quadraticCurveTo(x, sy * (W + 6.5), x + 4, sy * (W + 4)); }
    ctx.stroke();
  }
}
// The pick's beak (2026-11-16, mykee: "it looks like a 2D drill added to its face"): its own beak turned into a drill.
// A ruff of face feathers where it grows out of the head, the orange beak base (two mandibles, the mouth line between
// them) narrowing into a brass ring, and the steel bit coming out of the ring. In the PB frame: +x along the bit.
function drillBeak(ctx, C, spin, o) {
  const W = PB.W, base = () => {
    ctx.beginPath();
    ctx.moveTo(-11, -10.5);
    ctx.bezierCurveTo(-5, -11.5, 0, -W - 2, 3, -W - 1);
    ctx.lineTo(3, W + 1);
    ctx.bezierCurveTo(0, W + 2, -5, 11.5, -11, 10.5);
    ctx.closePath();
  };
  base();
  ctx.fillStyle = '#ee7f16';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#ffb12e'; // upper mandible
  ctx.fillRect(-12, -13, 16, 14);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath(); ctx.ellipse(-3.5, -6.5, 3.4, 1.5, -0.15, 0, TAU); ctx.fill();
  ctx.restore();
  base();
  ctx.lineWidth = o * 0.8;
  ctx.strokeStyle = LINE;
  ctx.stroke();
  ctx.lineWidth = o * 0.55; // the mouth line between the mandibles
  ctx.beginPath(); ctx.moveTo(-7, 1.5); ctx.quadraticCurveTo(-2.5, 2.8, 2, 1.2); ctx.stroke();
  // face feathers lying over the root: the beak grows out of the head
  const fringe = (close) => {
    ctx.beginPath();
    ctx.moveTo(-9.5, -11.5);
    for (let i = 0; i < 3; i++) { const y0 = -11.5 + i * 7.67; ctx.quadraticCurveTo(-3.6, y0 + 3.83, -9.5 + (i === 1 ? 0.8 : 0), y0 + 7.67); }
    if (close) { ctx.lineTo(-15, 13); ctx.lineTo(-15, -13); ctx.closePath(); }
  };
  fringe(true);
  ctx.fillStyle = C.base;
  ctx.fill();
  fringe(false);
  ctx.lineWidth = o * 0.6;
  ctx.stroke();
  ctx.save();
  ctx.translate(4, 0);
  drillBit(ctx, PB.L, W, spin, o);
  ctx.restore();
  // brass ring: a short cylinder, lit top, its front rim showing
  const ring = () => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(1, -W - 2.5, 6, 2 * W + 5, 2.2) : ctx.rect(1, -W - 2.5, 6, 2 * W + 5); };
  ring();
  ctx.fillStyle = '#d08a18';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#ffc94a';
  ctx.fillRect(0, -W - 3, 8, W + 1.5);
  ctx.fillStyle = '#fff1b8';
  ctx.fillRect(0, -W - 1.6, 8, 1.8);
  ctx.restore();
  ring();
  ctx.lineWidth = o * 0.8;
  ctx.stroke();
  ctx.lineWidth = o * 0.45;
  ctx.beginPath(); ctx.moveTo(4, -W - 2); ctx.lineTo(4, W + 2); ctx.stroke();
}
// pick beak: rooted low on the face's front, the bit points forward-down out of it
const PB = { x: 2, y: 21, a: 0.7, L: 32, W: 8.5 };
const PB_TIP = { x: PB.x + (PB.L + 4) * Math.cos(PB.a), y: PB.y + (PB.L + 4) * Math.sin(PB.a) };
const PB_TA = Math.atan2(PB_TIP.y, PB_TIP.x), PB_TD = Math.hypot(PB_TIP.x, PB_TIP.y);
const backOut = (q) => 1 + 2.4 * Math.pow(q - 1, 3) + 1.4 * Math.pow(q - 1, 2); // ease out with a small overshoot

function pickChick(ctx, t, o, st) {
  const C = KIND.pick, drill = st.pow === 1, recoil = st.pow === 2, spin = drillSpin(t, st);
  // aim: the whole chick tips so the bit's tip points at the drill spot (st.drillA, y-down screen angle; already
  // mirrored by the face flip), then pushes in a little. Drilling: rear back (wind-up), dive in with an overshoot,
  // then brace: shudder, squashed along the bit. Recoil: springs back upright with a hop while the bit spins down.
  let tgt = st.drillA ?? Math.PI / 2;
  if (st.face === -1) tgt = Math.PI - tgt;
  const R = clamp(tgt - PB_TA, -0.9, 1.35);
  let rot = 0, dx = 0, dy = 0, sq = 0, reach = 0, eff = 0;
  if (drill) {
    const e = PICK_T - clamp(st.powT, 0, PICK_T);
    if (e < 0.09) rot = -0.28 * Math.sin((e / 0.09) * Math.PI / 2);
    else if (e < 0.2) { const q = (e - 0.09) / 0.11; rot = -0.28 + (R + 0.28) * backOut(q); reach = q; }
    else { rot = R + Math.sin(t * 83) * 0.03; reach = 1 + clamp((e - 0.2) / 0.3, 0, 1) * 0.5; }
    eff = clamp((e - 0.05) / 0.1, 0, 1);
    sq = eff * (0.07 + 0.03 * Math.sin(t * 67));
    dx = eff * Math.sin(t * 91) * 1.4; dy = eff * Math.cos(t * 77) * 1.1;
  } else if (recoil) {
    const e = 0.35 - clamp(st.powT, 0, 0.35);
    rot = R * Math.exp(-e * 11) * Math.cos(e * 15);
    dy = -7 * Math.sin(clamp(e / 0.3, 0, 1) * Math.PI);
  } else if (spin.v > 4) { dx = Math.sin(t * 90) * 0.7; sq = 0.03; } // ready rev: a little buzz
  // drilling: the tip sinks into the floor (contact 0.3 m = 40 units, tip at 47..51), the chick stood up on the bit
  if (reach) { const d = (PB_TD - 47 - 8 * (reach - 1)) * Math.min(reach, 1); dx -= Math.cos(tgt) * d; dy -= Math.sin(tgt) * d; }
  ctx.save();
  ctx.translate(dx, dy);
  ctx.rotate(rot);
  if (sq) { ctx.rotate(PB_TA); ctx.scale(1 - sq, 1 + sq * 0.7); ctx.rotate(-PB_TA); }
  // legs: idle hop; drilling they brace apart and kick
  if (drill && eff) legs(ctx, [-13, 3], 35, 9, 1, t * 2, o);
  else legs(ctx, [-8, 8], 37, 8, st.flap, t, o);
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
  const wa = drill ? 1.15 + Math.sin(t * 47) * 0.12 : Math.sin(t * (9 + 30 * st.flap)) * (0.25 + 0.5 * st.flap) + (st.ready ? 0.3 : 0);
  stubWing(ctx, -30, 12, -1, wa, 1.05, C, o);
  // miner's helmet with a lamp
  const helm = () => { ctx.beginPath(); ctx.moveTo(-27, -10); ctx.bezierCurveTo(-27, -36, 27, -36, 27, -10); ctx.closePath(); };
  helm();
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
  helm(); // outline the helmet (the stroke used to outline the shine spot instead)
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
    ctx.fillStyle = `rgba(255,250,200,${0.4 + 0.12 * Math.sin(t * 6)})`; // flat beam (no per-frame gradient)
    ctx.beginPath();
    ctx.moveTo(19, -27); ctx.lineTo(50, -36); ctx.lineTo(50, -12); ctx.lineTo(19, -21);
    ctx.closePath();
    ctx.fill();
  }
  // face: drilling = squeezed eyes and hard brows (effort), looking at the bit
  const fy = 6, bl = blinkAt(t, 5), lk = { x: 1.2, y: drill ? 1.5 : 0.5 };
  cheeks(ctx, [[-17, fy + 11]], 5, 0.45);
  for (const sx of [-1, 1]) eye(ctx, sx * 10 + 1, fy - 2.5, 6.6, 8.6, t, o, { shut: drill || recoil ? 0 : bl, look: lk, mood: drill && eff ? 'squint' : null, side: sx });
  brows(ctx, drill && eff ? [[-15, fy - 15, -4, fy - 10], [5, fy - 10, 17, fy - 15]] : [[-14, fy - 12, -3, fy - 10], [5, fy - 10, 16, fy - 13]], o);
  // the drill beak, with a soft shade under it on the cheek
  ctx.save();
  ctx.translate(PB.x, PB.y);
  ctx.rotate(PB.a);
  ctx.fillStyle = 'rgba(80,40,140,0.3)';
  ctx.beginPath(); ctx.ellipse(-4, 9, 10, 3.5, 0, 0, TAU); ctx.fill();
  drillBeak(ctx, C, spin, o);
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
const PHASE = new WeakMap(); // egg -> { k: powK seen last, from: the one before, at: when it changed (game time) }
const DRILL_OUT = new WeakMap(); // egg -> 1 the pick drills the ring outside it (its floor), -1 the one inside
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
  // phase changes, for the short after-anims the sim has no phase for (swoop landing settle, bulk deflate pfff)
  let ph = PHASE.get(egg);
  if (!ph) PHASE.set(egg, (ph = { k: st.pow, from: 0, at: -9 }));
  if (ph.k !== st.pow) { ph.from = ph.k; ph.k = st.pow; ph.at = t; }
  const since = t - ph.at;
  if (!st.pow && since >= 0 && since < 0.6) {
    if (kind === 'swoop' && ph.from === 2) st.land = since;
    if (kind === 'bulk' && ph.from === 1) st.deflate = since;
  }
  if (kind === 'pick' && st.pow) { // aim the bit at the ring it drills: out (the floor) unless the FX found the ring inside
    const a = Math.atan2(p.y, p.x), out = DRILL_OUT.get(egg) || 1;
    st.drillA = Math.atan2(-Math.sin(a) * out, Math.cos(a) * out);
  }
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
const ICE_SLOT = new WeakMap(); // ring -> its own stamp slot (the ring object itself is the pads' slot)
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
  // 2026-11-20 speed pass: the ice runs only change when a block breaks or refreezes, so they are one stamp in the
  // ring's own frame (turning with it); only the twinkles and the holes are drawn live
  const paintRuns = (ctx) => {
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
    }
  };
  if (runs.length) {
    let key = r.toFixed(3);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const RO = ro + 0.05, RI = ri - 0.05;
    for (const R of runs) {
      key += '|' + R.a0.toFixed(4) + ':' + R.a1.toFixed(4);
      const n = Math.max(2, Math.ceil((R.a1 - R.a0) / 0.2));
      for (let i = 0; i <= n; i++) {
        const q = R.a0 + ((R.a1 - R.a0) * i) / n, c = Math.cos(q), sn = Math.sin(q);
        for (const rr of [RI, RO]) { x0 = Math.min(x0, rr * c); x1 = Math.max(x1, rr * c); y0 = Math.min(y0, rr * sn); y1 = Math.max(y1, rr * sn); }
      }
    }
    let slot = ICE_SLOT.get(ring);
    if (!slot) ICE_SLOT.set(ring, (slot = {}));
    if (!stamp(ctx, slot, key, x0 - 0.05, y0 - 0.05, x1 + 0.05, y1 + 0.05, paintRuns)) paintRuns(ctx);
  }
  for (const R of runs) {
    const n = Math.max(1, Math.round(((R.a1 - R.a0) * r) / 0.4));
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
      g.addColorStop(0, `rgba(255,236,120,${0.85 * a})`);
      g.addColorStop(0.6, `rgba(255,236,120,${0.45 * a})`);
      g.addColorStop(1, 'rgba(255,220,90,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, R, 0, TAU);
      ctx.fill();
      // the shock ring and rays
      ctx.lineWidth = Math.max(3 * px, 0.05 * a);
      ctx.strokeStyle = `rgba(70,40,0,${0.8 * a})`; ctx.lineWidth = Math.max(5 * px, 0.08 * a);
      ctx.beginPath();
      ctx.arc(x, y, R, 0, TAU);
      ctx.stroke();
      ctx.lineWidth = Math.max(3 * px, 0.05 * a);
      ctx.strokeStyle = `rgba(255,210,50,${a})`;
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
      // a tapered speed streak along the path behind it, and wind lines peeling off both sides (softer in the glide)
      const v = e.body.getLinearVelocity(), sp = Math.hypot(v.x, v.y) || 1, ux = v.x / sp, uy = v.y / sp, nx = -uy, ny = ux, rise = e.powK === 1;
      const L = clamp(sp / 4.5, 0.3, 1) * (rise ? 1.0 : 0.5), w = rise ? 0.17 : 0.11, bx = p.x - ux * 0.26, by = p.y - uy * 0.26; // starts behind the chick (FX draw over it)
      ctx.fillStyle = `rgba(205,236,255,${rise ? 0.38 : 0.22})`;
      ctx.beginPath();
      ctx.moveTo(bx + nx * w, by + ny * w);
      ctx.quadraticCurveTo(bx - ux * L * 0.45 + nx * w * 0.7, by - uy * L * 0.45 + ny * w * 0.7, bx - ux * L, by - uy * L);
      ctx.quadraticCurveTo(bx - ux * L * 0.45 - nx * w * 0.7, by - uy * L * 0.45 - ny * w * 0.7, bx - nx * w, by - ny * w);
      ctx.closePath();
      ctx.fill();
      ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const ph = mod(t * (rise ? 4 : 2.2) + i * 0.27, 1), sd = i % 2 ? 1 : -1, off = sd * (0.2 + 0.09 * (i >> 1)), d = 0.22 + ph * 0.7 * L, l = 0.1 + 0.22 * (1 - ph) * L;
        const x0 = p.x - ux * d + nx * off, y0 = p.y - uy * d + ny * off;
        ctx.strokeStyle = `rgba(240,250,255,${(rise ? 0.9 : 0.6) * (1 - ph)})`;
        ctx.lineWidth = Math.max(2.2 * px, 0.035 * (1 - ph * 0.5));
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(x0 - ux * l * 0.5 + nx * sd * 0.04, y0 - uy * l * 0.5 + ny * sd * 0.04, x0 - ux * l, y0 - uy * l);
        ctx.stroke();
      }
    } else if (kind === 'pick' && (e.powK === 1 || e.powK === 2)) {
      const ring = sim.rings[e.powA];
      if (!ring) continue;
      const a = Math.atan2(p.y, p.x), d = Math.hypot(p.x, p.y), out = d < ring.r ? 1 : -1, rr = ring.r - (out * RING_TH) / 2;
      DRILL_OUT.set(e, out); // the art aims the bit at this side (next frame)
      const x = rr * Math.cos(a), y = rr * Math.sin(a), nx = -Math.cos(a) * out, ny = -Math.sin(a) * out, tx = -ny, ty = nx; // n: back at the chick
      const el = e.powK === 1 ? PICK_T - e.powT : PICK_T, u = clamp((el - 0.15) / 0.4, 0, 1), ue = 1 - (1 - u) * (1 - u);
      const fade = e.powK === 2 ? clamp(e.powT / 0.35, 0, 1) : 1, on = e.powK === 2 ? fade * fade : clamp((el - 0.15) / 0.06, 0, 1), ice = !!ring.hardIce;
      if (u > 0) {
        // the hole the bit bores, growing, with a lit far rim; jagged cracks running out of it along and into the ring
        const ang = Math.atan2(ty, tx), hx = x - nx * 0.02, hy = y - ny * 0.02;
        ctx.globalAlpha = fade;
        ctx.fillStyle = ice ? 'rgba(24,46,78,0.85)' : 'rgba(40,24,12,0.8)';
        ctx.beginPath();
        ctx.ellipse(hx, hy, 0.04 + 0.08 * ue, 0.025 + 0.035 * ue, ang, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = Math.max(1.5 * px, 0.012);
        ctx.beginPath();
        ctx.ellipse(hx, hy, 0.04 + 0.08 * ue, 0.025 + 0.035 * ue, ang, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
        ctx.strokeStyle = ice ? 'rgba(30,50,80,0.85)' : 'rgba(50,28,10,0.8)';
        ctx.lineWidth = Math.max(1.6 * px, 0.016);
        ctx.beginPath();
        for (const [ca, cl] of [[1.45, 0.24], [-1.5, 0.22], [2.5, 0.15], [-2.4, 0.17], [3.1, 0.12]]) { // angle from n, length
          const dx = nx * Math.cos(ca) + tx * Math.sin(ca), dy = ny * Math.cos(ca) + ty * Math.sin(ca), L = cl * ue;
          ctx.moveTo(hx + dx * 0.05, hy + dy * 0.05);
          for (let i = 1; i <= 3; i++) { const l = 0.05 + (L * i) / 3, w = (i % 2 ? 0.022 : -0.016) * ue; ctx.lineTo(hx + dx * l - dy * w, hy + dy * l + dx * w); }
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (on > 0) {
        // dust puffing out to both sides of the bit, then chips flung off in little arcs
        for (let i = 0; i < 4; i++) {
          const ph = mod(t * 2.3 + i * 0.25, 1), sd = i % 2 ? 1 : -1;
          ctx.fillStyle = ice ? `rgba(236,246,255,${0.55 * on * (1 - ph)})` : `rgba(226,206,176,${0.55 * on * (1 - ph)})`;
          ctx.beginPath();
          ctx.arc(x + nx * (0.05 + 0.12 * ph) + tx * sd * (0.07 + 0.22 * ph), y + ny * (0.05 + 0.12 * ph) + ty * sd * (0.07 + 0.22 * ph), 0.05 + 0.11 * ph, 0, TAU);
          ctx.fill();
        }
        ctx.lineWidth = Math.max(1.2 * px, 0.01);
        ctx.strokeStyle = ice ? 'rgba(40,80,120,0.8)' : 'rgba(80,46,16,0.8)';
        for (let i = 0; i < 10; i++) {
          const ph = mod(t * 3.4 + i * 0.1 + i * i * 0.013, 1), sd = i % 2 ? 1 : -1, sp = 0.3 + 0.95 * mod(i * 0.37, 1), v = 1.7 + 0.9 * mod(i * 0.61, 1), T = ph * 0.38;
          const dx = nx * Math.cos(sp) + tx * sd * Math.sin(sp), dy = ny * Math.cos(sp) + ty * sd * Math.sin(sp);
          const cx = x + dx * v * T, cy = y + dy * v * T - 5 * T * T, r = 0.03 + 0.025 * mod(i * 0.53, 1), ro = T * 22 + i;
          ctx.globalAlpha = on * (1 - ph * ph);
          ctx.fillStyle = ice ? (i % 3 ? '#e6f6ff' : '#ffffff') : (i % 3 ? '#e2b77a' : '#b98444');
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(ro) * r, cy + Math.sin(ro) * r);
          ctx.lineTo(cx + Math.cos(ro + 2.3) * r * 0.8, cy + Math.sin(ro + 2.3) * r * 0.8);
          ctx.lineTo(cx + Math.cos(ro + 4.1) * r * 0.9, cy + Math.sin(ro + 4.1) * r * 0.9);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        if (ice && e.powK === 1) { ctx.fillStyle = `rgba(255,255,255,${on})`; for (let i = 0; i < 2; i++) { const ph = mod(t * 6 + i * 0.5, 1); sparkle(ctx, x + tx * (i ? 0.09 : -0.08) + nx * 0.06, y + ty * (i ? 0.09 : -0.08) + ny * 0.06, 0.05 * Math.sin(ph * Math.PI)); } }
      }
    }
  }
  // dizzy stars over a dazed eagle (a dazed snake draws its own, render/snake.js)
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
      fx.flashColor = '#ffd84a';
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
    case 'chickPluck': // the swoop lands: a puff of air under it
      fx.dust(ev.x, ev.y - 0.25, 5, 'rgba(225,242,255,0.8)');
      if (ev.n) { audio.play('thorn_snap', { pitch: 1.4 }); popup(ev.x, ev.y + 0.6, 'Pluck!', { color: '#9fd8ff', size: 20 }); }
      break;
    case 'chickDeflate':
      audio.play('bubble_pop', { pitch: 0.7 });
      fx.dust(ev.x, ev.y, 6, 'rgba(200,240,160,0.8)');
      popup(ev.x, ev.y + 0.55, 'pfff...', { color: '#d4f5a8', size: 16, life: 0.8 });
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
