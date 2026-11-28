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
import { bake } from './castkit.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mod = (a, b) => ((a % b) + b) % b;
const LINE = '#6e3a12'; // warm brown outline, shared by every kind
const outlineW = (s) => Math.max(3.4, 120 / s);

export const KIND = {
  glow: { name: 'Glow chick', base: '#fff3b0', shade: '#f4c23c', hi: '#ffffff', belly: '#fffbe6', glow: '255,236,120', orb: ['#fff6c0', '#d99a12', '#4a2a02'], line: 'Tap it once: FLASH! Burns thorns near it, stuns snakes and scares the eagle. Nearby eggs get blown about.' },
  dash: { name: 'Dash chick', base: '#ff8a2e', shade: '#d9561a', hi: '#ffc58a', belly: '#ffe2bd', glow: '255,140,50', orb: ['#ffc898', '#c24a10', '#3d1202'], line: 'Tap it once: it zooms along its channel, bonks snakes dizzy and grabs orbs. It can zoom right past a gap!' },
  swoop: { name: 'Swoop chick', base: '#55aef7', shade: '#2f72cc', hi: '#b8e2ff', belly: '#e6f5ff', glow: '90,175,255', orb: ['#c4e6ff', '#1f63c4', '#061c42'], line: 'Tap it once: it flies up through the ring above, tearing down a thorn curtain, then glides down.' },
  bulk: { name: 'Bulk chick', base: '#8ad44c', shade: '#4f9a2a', hi: '#cdf596', belly: '#e8f8c8', glow: '130,215,80', orb: ['#d4f5a8', '#3f8a1e', '#0f2a06'], line: 'Tap it once: it puffs up big and heavy for 5 s. Squashes thorns, snakes bounce off. Too big for gaps!' },
  pick: { name: 'Drill Chick', base: '#ad78ea', shade: '#7444ba', hi: '#dcc2ff', belly: '#f1e6ff', glow: '175,120,240', orb: ['#e2ccff', '#6630b0', '#1d0840'], line: 'Tap it once: its drill beak shatters ice under it for 6 s. On a normal ring it only chips thorns.' },
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
const HLOOK = { x: 0, y: 0, shut: 0 }; // the hatch moment's look-around and blink (drawKindChick sets it, every eye adds it)
// 0.8.18 faces (weasel818): every eye is drawn 1.15x (one egg tall, the eyes have to carry the face) and drawKindChick
// sets a mood that every eye takes up: wow 0..1 (just hatched: round eyes, a pin of light), scare 0..1 (a predator close:
// wide eyes, worried brows), happy (the level is won: ^ ^ eyes)
const EYE_K = 1.15;
const HMOOD = { wow: 0, scare: 0, happy: 0 };
function eye(ctx, x, y, rx, ry, t, o, { shut = 0, look = { x: 0, y: 0 }, mood = null, side = 1, star = false } = {}) {
  if (HLOOK.x || HLOOK.shut) { look = { x: look.x + HLOOK.x, y: look.y + HLOOK.y }; shut = Math.max(shut, HLOOK.shut); }
  const wide = Math.max(HMOOD.wow, HMOOD.scare);
  rx *= EYE_K * (1 + 0.1 * wide); ry *= EYE_K * (1 + 0.22 * wide);
  if (HMOOD.happy > 0.5 && mood !== 'squint') mood = 'happy';
  if (wide > 0.3 && mood !== 'happy' && mood !== 'squint') { shut = Math.min(shut, 1 - wide); star = false; }
  if (HMOOD.scare > 0.05 && mood !== 'happy') { // worried brows: the inner ends up
    const sd = x < 0 ? -1 : 1, by = y - ry * 1.45;
    ctx.save(); ctx.globalAlpha *= HMOOD.scare; ctx.strokeStyle = LINE; ctx.lineWidth = Math.max(2.2, o * 0.85); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + sd * rx * 0.9, by + ry * 0.25); ctx.lineTo(x - sd * rx * 0.8, by - ry * 0.3); ctx.stroke(); ctx.restore();
  }
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
    ctx.ellipse(x - rx * 0.32 + look.x, y - h * 0.38 + look.y, rx * 0.42 * (1 - 0.35 * wide), rx * 0.46 * (1 - 0.35 * wide), -0.3, 0, TAU);
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

// ------------------------------------------------------------- the Drill Chick (2026-11-20 rebuild)
// mykee (3rd time): "Drill Chick was not properly designed. Its beak was not properly aligned... they look stale". She is now
// drawn three-quarter, facing +x like the dash chick: two eyes, and her BEAK is the drill: one orange spiral cone growing
// under and between the eyes, and a chunky two-tone spiral bit coming out of it, in line with her gaze (forward-down).
// The whole body turns so the bit points at the ring she drills (st.drillA), she stands on it head down, tail up.
// Times (sim/chicks.js, unchanged): drill PICK_T 0.55 s (pow 1), recoil 0.35 s (pow 2), then st.after (s since the recoil
// ended: dizzy, shake it off, proud, a glint along the bit, steam).
const PK = { x: 5, y: 14, a: 0.42, F: 7, L: 28, W: 8 }; // beak-root (100-units), bit angle (y-down), root length, bit length, bit radius
const PK_LEN = PK.F + PK.L - 1, PK_BEND = 0.9; // while she drills her neck straightens: the beak turns up this much, so she tips further
const PK_SPIN = 24; // turns/s at full drill speed
const backOut = (q) => 1 + 2.4 * Math.pow(q - 1, 3) + 1.4 * Math.pow(q - 1, 2); // ease out with a small overshoot
const env = (x, a, b, c, d) => (x <= a || x >= d ? 0 : x < b ? smooth((x - a) / (b - a)) : x <= c ? 1 : 1 - smooth((x - c) / (d - c)));

// Spin: p = turns so far, v = turns/s, q = the phase the grooves are DRAWN at (at full speed the grooves are shown
// creeping at 6 turns/s over a blurred bit, so the eye reads a spin instead of a strobe).
function drillSpin(t, st) {
  if (st.pow === 1) { const e = PICK_T - clamp(st.powT, 0, PICK_T), r = Math.exp(-e / 0.06), w = e - 0.06 * (1 - r); return { p: PK_SPIN * w, v: PK_SPIN * (1 - r), q: 6 * w }; }
  if (st.pow === 2) { const e = 0.35 - clamp(st.powT, 0, 0.35), r = Math.exp(-e / 0.1); return { p: PK_SPIN * 0.1 * (1 - r), v: PK_SPIN * r, q: 3 + 2.4 * (1 - r) }; }
  if (st.ready) return { p: t * 1.3, v: 1.3, q: t * 1.3 }; // waiting for the tap: a slow turn
  // idle: a quarter-turn twitch now and then (revving)
  const c = Math.floor(t / 2.4), u = t - c * 2.4, D = 0.13, p = c * 0.25 + (u < D ? 0.25 * smooth(u / D) : 0.25);
  return { p, v: u < D ? 3.5 : 0, q: p };
}

// Her beak IS the drill bit (mykee, 2026-11-20: "it looks like it put a drilling bit on top of its beak. Its beak should
// be a drill bit. That's it"). One piece, in beak orange: a stout cone from her face (rounded where it sits on the face,
// radius W) to its point at x L, cut by a dark spiral groove so the turn reads at 40 px, a lit band along the top and a
// shaded underside. No steel, no ring, nothing clipped on.
// Baked: 8 phases x (sharp | blurred), each a small picture (castkit bake), so a spinning beak costs one drawImage.
const BK_W = PK.W + 1.5, BK_BACK = 7;
function bitPath(c, L, W) { // a cone of three thread ridges, each a little proud of the next (the drill's stepped outline)
  const N = 3, n = 1.3, rad = (x) => W * Math.pow(1 - x / L, 0.62);
  c.beginPath();
  c.moveTo(-1, -W);
  for (let i = 0; i < N; i++) {
    const x0 = (L * i) / N, x1 = (L * (i + 1)) / N, r0 = rad(x0), r1 = rad(x1), last = i === N - 1;
    c.quadraticCurveTo((x0 + x1) / 2 + 1.5, -(r0 + r1) / 2 - 1.1, x1, last ? 0 : -(r1 - n));
    if (!last) c.lineTo(x1 + 0.4, -r1);
  }
  for (let i = N - 1; i >= 0; i--) {
    const x0 = (L * i) / N, x1 = (L * (i + 1)) / N, r0 = rad(x0), r1 = rad(x1), last = i === N - 1;
    if (!last) c.lineTo(x1, r1 - n);
    c.quadraticCurveTo((x0 + x1) / 2 + 1.5, (r0 + r1) / 2 + 1.1, i ? x0 + 0.4 : -1, r0);
  }
  c.bezierCurveTo(-BK_BACK, W, -BK_BACK, -W, -1, -W);
  c.closePath();
}
function paintBit(c, L, W, ph, blur, o) {
  bitPath(c, L, W);
  c.fillStyle = '#b9500c'; // the groove
  c.fill();
  c.save();
  c.clip();
  const P = L / 3, bw = P * 0.62, sl = W * 0.5;
  const band = (x, col) => {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(x - bw / 2 + sl, -W - 1);
    c.lineTo(x + bw / 2 + sl, -W - 1);
    c.quadraticCurveTo(x + bw / 2 + sl * 0.2 + 2.2, 0, x + bw / 2 - sl, W + 1);
    c.lineTo(x - bw / 2 - sl, W + 1);
    c.quadraticCurveTo(x - bw / 2 + sl * 0.2 + 2.2, 0, x - bw / 2 + sl, -W - 1);
    c.closePath();
    c.fill();
  };
  if (blur) { // a smear: both tones half way, faint threads
    c.fillStyle = '#f0921f';
    c.fillRect(-BK_BACK - 1, -W - 1, L + BK_BACK + 2, 2 * W + 2);
    for (let x = -2 * P + ph * P; x < L + P; x += P) band(x, 'rgba(255,205,96,0.55)');
  } else for (let x = -2 * P + ph * P; x < L + P; x += P) band(x, '#ffb52e');
  c.fillStyle = 'rgba(255,246,200,0.5)'; // lit band along the top
  c.beginPath(); c.moveTo(-BK_BACK, -W * 0.72); c.quadraticCurveTo(L * 0.5, -W * 0.56, L, -0.6); c.lineTo(L, 0.4); c.quadraticCurveTo(L * 0.5, -W * 0.3, -BK_BACK, -W * 0.42); c.closePath(); c.fill();
  c.fillStyle = 'rgba(120,40,6,0.3)'; // shaded underside
  c.beginPath(); c.moveTo(-BK_BACK, W * 0.3); c.quadraticCurveTo(L * 0.5, W * 0.22, L, 0.6); c.lineTo(L, W + 1); c.lineTo(-BK_BACK, W + 1); c.closePath(); c.fill();
  c.restore();
  bitPath(c, L, W);
  c.lineWidth = o * 0.8;
  c.strokeStyle = LINE;
  c.lineJoin = 'round';
  c.stroke();
  c.fillStyle = '#ffffff';
  c.beginPath(); c.arc(L - 4.2, -0.9, 1.05, 0, TAU); c.fill();
}
function drillBit(ctx, L, W, spin, o) {
  const blur = spin.v > 9 ? 1 : 0, n = 8, idx = Math.floor(mod(spin.q, 1) * n), ph = idx / n;
  const pad = o;
  if (!bake(ctx, 'pkBit|' + L + '|' + W + '|' + o.toFixed(2) + '|' + idx + '|' + blur, -BK_BACK - pad, -W - pad, L + pad, W + pad, (c) => paintBit(c, L, W, ph, blur, o))) paintBit(ctx, L, W, ph, blur, o);
  if (spin.v > 5) { // whirr arcs either side
    const a = clamp((spin.v - 5) / 8, 0, 1), f = mod(spin.p * 0.5, 1);
    ctx.strokeStyle = `rgba(255,255,255,${0.85 * a})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const sy of [-1, 1]) {
      const x = L * (0.18 + 0.5 * f);
      ctx.moveTo(x - 5, sy * (W + 3.5)); ctx.quadraticCurveTo(x, sy * (W + 6.5), x + 5, sy * (W + 3.5));
    }
    ctx.stroke();
  }
}
// the lamp's beam: a soft cone baked once (no gradient per frame), drawn from the lamp along +x
let LAMP = null;
function lampSprite() {
  if (LAMP !== null || typeof document === 'undefined') return LAMP;
  const cv = document.createElement('canvas'), W = 128, H = 72;
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  if (!c) return (LAMP = false);
  const g = c.createRadialGradient(4, H / 2, 2, 4, H / 2, W);
  g.addColorStop(0, 'rgba(255,248,200,0.95)');
  g.addColorStop(0.35, 'rgba(255,240,170,0.45)');
  g.addColorStop(1, 'rgba(255,236,160,0)');
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(4, H / 2 - 5);
  c.quadraticCurveTo(W * 0.6, 4, W, 0);
  c.lineTo(W, H);
  c.quadraticCurveTo(W * 0.6, H - 4, 4, H / 2 + 5);
  c.closePath();
  c.fill();
  return (LAMP = cv);
}
function pickBody(c, C, o) {
  fluffPath(c, 0, 10, 31, 31, 16, 1.07);
  cel(c, C, o, { x: -7, y: 2, r: 0.93 }, 36);
  c.save();
  fluffPath(c, 0, 10, 31, 31, 16, 1.07);
  c.clip();
  c.fillStyle = C.belly;
  c.beginPath();
  c.ellipse(-5, 32, 16, 10, 0, 0, TAU);
  c.fill();
  c.restore();
  fluffPath(c, 0, 10, 31, 31, 16, 1.07);
  c.lineWidth = o;
  c.strokeStyle = LINE;
  c.stroke();
}
function pickHelmet(c, o) {
  const helm = () => { c.beginPath(); c.moveTo(-25, -9); c.bezierCurveTo(-26, -37, 30, -37, 29, -9); c.closePath(); };
  helm();
  c.fillStyle = '#ffc531';
  c.fill();
  c.save();
  c.clip();
  c.fillStyle = '#e39a12';
  c.beginPath(); c.ellipse(12, -5, 26, 13, 0, 0, TAU); c.fill();
  c.fillStyle = '#fff2b0';
  c.beginPath(); c.ellipse(-10, -24, 8, 4, -0.5, 0, TAU); c.fill();
  c.restore();
  helm();
  c.lineWidth = o;
  c.strokeStyle = LINE;
  c.stroke();
  c.beginPath(); // brim
  c.roundRect ? c.roundRect(-29, -12, 64, 6, 3) : c.rect(-29, -12, 64, 6);
  c.fillStyle = '#f0ae1c';
  c.fill();
  c.stroke();
  c.beginPath(); // lamp housing
  c.ellipse(19, -22, 7.5, 7.5, 0, 0, TAU);
  c.fillStyle = '#8a8f9c';
  c.fill();
  c.stroke();
}
function dizzyEye(ctx, x, y, r, a, o) {
  ctx.strokeStyle = '#2a1d14';
  ctx.lineWidth = o * 0.75;
  ctx.beginPath();
  for (let i = 0; i <= 16; i++) { const q = i / 16, th = a + q * TAU * 1.6, rr = r * (0.15 + 0.85 * q); i ? ctx.lineTo(x + Math.cos(th) * rr, y + Math.sin(th) * rr * 1.15) : ctx.moveTo(x + Math.cos(th) * rr, y + Math.sin(th) * rr * 1.15); }
  ctx.stroke();
}
// kicking legs (drilling: in the air, alternately), local y-down
function kickLegs(ctx, t, amp, o) {
  for (const pass of [0, 1]) {
    ctx.lineWidth = pass ? 3.2 : 3.2 + o * 1.3;
    ctx.strokeStyle = pass ? '#ffa62b' : LINE;
    ctx.beginPath();
    for (let i = 0; i < 2; i++) {
      const x = i ? 7 : -9, a = Math.PI / 2 + 0.25 + amp * Math.sin(t * 26 + i * Math.PI), ex = x + Math.cos(a) * 10, ey = 36 + Math.sin(a) * 10;
      ctx.moveTo(x, 36);
      ctx.lineTo(ex, ey);
      for (const d of [-0.7, 0, 0.7]) { ctx.moveTo(ex, ey); ctx.lineTo(ex + Math.cos(a + d) * 4.5, ey + Math.sin(a + d) * 4.5); }
    }
    ctx.stroke();
  }
}

function pickChick(ctx, t, o, st) {
  const C = KIND.pick, drill = st.pow === 1, rec = st.pow === 2, af = !st.pow && st.after !== undefined ? st.after : -1, spin = drillSpin(t, st);
  let tgt = st.drillA ?? Math.PI / 2;
  if (st.face === -1) tgt = Math.PI - tgt;
  let R = tgt - (PK.a - PK_BEND); // the turn that points the (straightened) bit at the ring
  R = Math.atan2(Math.sin(R), Math.cos(R));
  let bend = 0;
  // pose: body turn, translation, squash (about the feet), eyes, wings, legs
  let rot = 0, tx = 0, ty = 0, sx = 1, sy = 1, pin = 0, sink = 0, kick = 0, wing = 0, helmJ = 0;
  let eyes = 'open', shut = 0, look = { x: 1.6, y: 1.1 }, browK = 0, lamp = st.ready || drill, steam = 0, glint = -1, ting = 0, sparks = st.ready;
  if (drill) {
    const e = PICK_T - clamp(st.powT, 0, PICK_T), A = 0.14, TIP = 0.1;
    browK = 1;
    if (e < A) { // anticipation: crouch, lean back, eyes narrow, the bit spins up
      const q = smooth(e / A);
      sy = 1 - 0.15 * q; sx = 1 + 0.11 * q; rot = -0.16 * q; shut = 0.5 * q; wing = 0.35 * q;
    } else if (e < A + TIP) { // tip over: the whole body swings the bit onto the ring (overshoot), stretched by the swing
      const u = (e - A) / TIP, k = backOut(u);
      rot = -0.16 + (R + 0.16) * k; pin = smooth(u); sink = 2 * u; bend = smooth(u);
      const s = Math.sin(u * Math.PI);
      sy = 1 - 0.15 * (1 - u) + 0.12 * s; sx = 1 + 0.11 * (1 - u) - 0.08 * s; eyes = 'squint'; wing = 0.35 + 0.65 * u; kick = 0.3 * u;
    } else { // drilling: standing on the bit, juddering, legs kicking, wings out, helmet rattling
      const d = clamp((e - A - TIP) / 0.3, 0, 1);
      rot = R + 0.06 * Math.sin(t * 71) + 0.035 * Math.sin(t * 43); pin = 1; sink = 2 + 6 * d; bend = 1;
      tx = Math.sin(t * 91) * 1.3; ty = Math.cos(t * 77) * 1.1;
      sx = 1 + 0.05 * Math.sin(t * 59); sy = 1 - 0.05 * Math.sin(t * 59);
      eyes = 'squint'; wing = 1; kick = 0.75; helmJ = 1.6;
    }
  } else if (rec) { // break-through: a pop, she springs back upright with a hop, stretch then a landing squash
    const e = 0.35 - clamp(st.powT, 0, 0.35);
    rot = R * Math.exp(-e * 13) * Math.cos(e * 11);
    pin = 1 - smooth(clamp(e / 0.16, 0, 1)); bend = pin;
    ty = -15 * Math.sin(Math.PI * clamp(e / 0.27, 0, 1));
    const up = Math.sin(Math.PI * clamp(e / 0.14, 0, 1)), land = Math.sin(Math.PI * clamp((e - 0.24) / 0.11, 0, 1));
    sy = 1 + 0.14 * up - 0.16 * land; sx = 1 - 0.09 * up + 0.13 * land;
    eyes = e < 0.06 ? 'squint' : 'dizzy'; wing = 1 - 0.4 * clamp(e / 0.35, 0, 1); kick = 0.5 * (1 - e / 0.35);
    steam = 1; lamp = true;
  } else if (af >= 0) {
    // dizzy (spiral eyes, then the pupils roll round once), shake it off, then proud: chest out, a glint runs along the bit
    if (af < 0.22) { eyes = 'dizzy'; rot = 0.07 * Math.sin(af * 18); }
    else if (af < 0.62) { const q = (af - 0.22) / 0.4, a = -Math.PI / 2 + q * TAU; look = { x: Math.cos(a) * 2.2, y: Math.sin(a) * 2.2 }; rot = 0.07 * Math.sin(af * 18) * (1 - q); }
    else if (af < 0.86) { const q = (af - 0.62) / 0.24; rot = 0.16 * Math.sin(q * Math.PI * 4) * (1 - q); helmJ = 1.4 * (1 - q); shut = 0.9 * Math.sin(q * Math.PI); }
    const pr = env(af, 0.84, 0.98, 1.32, 1.5);
    if (pr > 0) { rot += -0.13 * pr; sy *= 1 + 0.05 * pr; sx *= 1 + 0.03 * pr; if (af > 0.9 && af < 1.4) eyes = 'happy'; browK = -pr; }
    glint = af > 0.94 && af < 1.14 ? (af - 0.94) / 0.2 : -1;
    ting = env(af, 1.08, 1.13, 1.2, 1.32);
    steam = clamp(1 - af / 1.2, 0, 1);
    lamp = af < 0.3;
  }
  // pin the tip on the ring: the body hangs off the bit (the tip at the contact, 0.3 m + how far it has sunk)
  const ba = PK.a - PK_BEND * bend, TIPx = PK.x + PK_LEN * Math.cos(ba), TIPy = PK.y + PK_LEN * Math.sin(ba);
  if (pin > 0) {
    const cr = Math.cos(rot), sr = Math.sin(rot), D = 44 + sink;
    const wx = cr * TIPx * sx - sr * TIPy * sy, wy = sr * TIPx * sx + cr * TIPy * sy;
    tx += pin * (Math.cos(tgt) * D - wx); ty += pin * (Math.sin(tgt) * D - wy);
  }
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(rot);
  ctx.translate(0, 45); ctx.scale(sx, sy); ctx.translate(0, -45);
  // tail tuft (reads "tail up" when she tips over)
  for (const [r, l] of [[-0.42, 15], [0, 18], [0.42, 14]]) {
    ctx.save();
    ctx.translate(-28, 13);
    ctx.rotate(r + 2.2 + (drill ? 0.25 * Math.sin(t * 40 + r * 3) : 0.08 * Math.sin(t * 3 + r)));
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
  if (kick) kickLegs(ctx, t, kick, o);
  else legs(ctx, [-9, 7], 37, 8, st.flap, t, o);
  if (!bake(ctx, 'pkBody|' + o.toFixed(2), -36, -25, 36, 46, (c) => pickBody(c, C, o))) pickBody(ctx, C, o);
  // wings: tucked / idle flutter; out wide and beating for balance while she drills
  const wa = wing ? (0.5 + 0.9 * wing) + Math.sin(t * 38) * 0.22 * wing : Math.sin(t * (9 + 30 * st.flap)) * (0.25 + 0.5 * st.flap) + (st.ready ? 0.3 : 0);
  stubWing(ctx, -30, 13, -1, wa, 1.0, C, o);
  stubWing(ctx, 27, 17, 1, wa * 0.8 - 0.25, 0.85, C, o);
  // helmet (rattles while drilling) and the lamp
  const hx = helmJ ? Math.sin(t * 83) * helmJ : 0, hy = helmJ ? Math.abs(Math.sin(t * 61)) * -helmJ : 0;
  ctx.save();
  ctx.translate(hx, hy);
  if (!bake(ctx, 'pkHelm|' + o.toFixed(2), -32, -38, 38, -3, (c) => pickHelmet(c, o))) pickHelmet(ctx, o);
  if (lamp) {
    const L = lampSprite();
    if (L) {
      ctx.save();
      ctx.translate(23, -22);
      ctx.rotate(0.38 + (ba - 0.38) * bend); // the beam follows the bit down into the hole
      ctx.globalAlpha *= 0.55 + 0.15 * Math.sin(t * 7) + (drill ? 0.2 : 0);
      ctx.drawImage(L, -2, -16, drill ? 64 : 46, drill ? 36 : 30);
      ctx.restore();
    }
  }
  ctx.fillStyle = lamp ? '#fffbe0' : '#e8e0c0';
  ctx.beginPath(); ctx.arc(19.5, -22, 4.6, 0, TAU); ctx.fill();
  ctx.fillStyle = lamp ? '#ffffff' : '#ffffff';
  ctx.beginPath(); ctx.arc(18, -23.6, 1.5, 0, TAU); ctx.fill();
  ctx.restore();
  // face: two eyes three-quarter, the beak (drill) under and between them, in line with the gaze
  const bl = blinkAt(t, 5), E0 = [-4, 3, 6.4, 8.4], E1 = [14, 3, 5.6, 8.0];
  cheeks(ctx, [[-17, 15]], 5, 0.45);
  for (const [x, y, rx, ry] of [E0, E1]) {
    if (eyes === 'dizzy') dizzyEye(ctx, x, y, rx * 0.95, t * 14 + x, o);
    else if (eyes === 'squint') eye(ctx, x, y, rx, ry, t, o, { mood: 'squint', side: x < 5 ? 1 : -1 });
    else eye(ctx, x, y, rx, ry, t, o, { shut: Math.max(shut, drill || rec ? 0 : bl), look, mood: eyes === 'happy' ? 'happy' : null });
  }
  if (browK > 0) brows(ctx, [[-11, -9 + 2 * browK, 1, -6], [9, -6, 19, -9 + 2 * browK]], o);
  else if (browK < 0) brows(ctx, [[-10, -8, 0, -10], [9, -10, 18, -8]], o);
  // the drill beak
  ctx.save();
  ctx.translate(PK.x, PK.y);
  ctx.rotate(ba);
  ctx.fillStyle = 'rgba(80,40,140,0.28)'; // a soft shade under it on the chin
  ctx.beginPath(); ctx.ellipse(5, BK_W + 1.5, 10, 3, 0, 0, TAU); ctx.fill();
  ctx.save();
  drillBit(ctx, PK_LEN, BK_W, spin, o);
  if (glint >= 0) { // a glint running from the root to the point
    const gx = PK_LEN * glint, w = BK_W * (gx < PK_LEN * 0.42 ? 0.95 : clamp((PK_LEN - gx) / (PK_LEN * 0.58), 0, 1) * 0.9);
    ctx.strokeStyle = `rgba(255,255,255,${Math.sin(glint * Math.PI)})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(gx + w * 0.5, -w); ctx.lineTo(gx - w * 0.5, w); ctx.stroke();
  }
  if (ting > 0) { ctx.fillStyle = '#ffffff'; sparkle(ctx, PK_LEN + 2, -3, 9 * ting); ctx.fillStyle = 'rgba(255,240,170,0.9)'; sparkle(ctx, PK_LEN + 2, -3, 4 * ting); }
  if (sparks) { // ready: tiny sparks flick off the point
    for (let i = 0; i < 2; i++) { const ph = mod(t * 2.6 + i * 0.5, 1); if (ph > 0.35) continue; ctx.fillStyle = i ? '#fff6b0' : '#ffffff'; sparkle(ctx, PK_LEN + 3 + ph * 14, (i ? -1 : 1) * (2 + ph * 12), 3.2 * Math.sin((ph / 0.35) * Math.PI)); }
  }
  ctx.restore();
  ctx.restore();
  ctx.restore();
  // steam off the hot bit (world-up, so outside the body's turn)
  if (steam > 0) {
    const bx = tx + TIPx - 6, by = ty + TIPy - 4;
    for (let i = 0; i < 3; i++) {
      const q = mod(t * 1.4 + i / 3, 1);
      ctx.fillStyle = `rgba(255,255,255,${0.6 * steam * (1 - q)})`;
      ctx.beginPath();
      ctx.arc(bx + Math.sin(q * 6 + i) * 3 - 6 * i * q, by - q * 24, 2.5 + q * 5, 0, TAU);
      ctx.fill();
    }
  }
}


/* ------------------------------------------------------------- the hatch moment (2026-11-20)
   mykee: "when the eggs hatch, the chicks pop out: some of the chicks were not properly animated, they look stale."
   Before the hatch (the sim's 0.6 s HATCH_DELAY, drawTintedEgg): the egg wobbles on its bottom and bulges, cracks race
   across the shell in the power's colour, light leaks out, and it squashes just before it bursts. The hatch (h = s since
   the chick appeared; the chick is usable at once, as before, every beat here overlaps): a white hit-frame, the shell
   bursts into pieces that fly, bounce once and fade, the chick pops UP out of the lower shell half (stretch up, squash
   down, settle), a shell cap sits on its head for a moment and pops off, it looks left, right and blinks. The burst in the
   power's colour and the sound are the chickHatch event. Nothing here allocates per frame. */
const H_HIT = 0.06, H_END = 1.0;
const SHARDS = [ // start (egg units: x across, y up from the centre), velocity (m/s), spin, size
  [-0.12, 0.1, -1.6, 2.6, -9, 1], [0.12, 0.12, 1.5, 2.9, 8, 1], [-0.05, 0.22, -0.6, 3.4, 6, 0.8],
  [0.06, 0.2, 0.8, 3.2, -7, 0.85], [-0.17, -0.02, -2.1, 1.6, 11, 0.7], [0.17, 0.0, 2.2, 1.8, -10, 0.75],
];
// the chick's pop out of the lower shell: y lift (box units, y down) and squash about the feet
function hatchPose(ctx, h) {
  const u = clamp((h - H_HIT) / 0.26, 0, 1), rise = 1 - backOutH(u);
  const st = Math.sin(Math.PI * clamp((h - H_HIT) / 0.2, 0, 1)) * 0.2; // stretch on the way up
  const lnd = h - H_HIT - 0.2, sq = lnd > 0 ? Math.exp(-lnd * 9) * Math.sin(lnd * 24) * 0.16 : 0; // squash, settle
  ctx.translate(0, 34 * rise + 44);
  ctx.scale(1 - st * 0.55 + sq, 1 + st - sq);
  ctx.translate(0, -44);
  // look round and blink
  HLOOK.x = h > 0.38 && h < 0.56 ? -2.6 * Math.sin(((h - 0.38) / 0.18) * Math.PI) : h > 0.56 && h < 0.74 ? 2.6 * Math.sin(((h - 0.56) / 0.18) * Math.PI) : 0;
  HLOOK.shut = h > 0.78 && h < 0.88 ? Math.sin(((h - 0.78) / 0.1) * Math.PI) : 0;
}
function backOutH(q) { q = clamp(q, 0, 1); return 1 + 2.6 * Math.pow(q - 1, 3) + 1.6 * Math.pow(q - 1, 2); }
// the shell cap on its head (kinds without a hat of their own), then it pops off and tumbles away
function hatchCap(ctx, kind, h, o) {
  if (kind === 'pick' || kind === 'glow' || h < H_HIT || h > 1.0) return;
  const f = clamp((h - 0.68) / 0.3, 0, 1), y = kind === 'bulk' ? -18 : -22;
  ctx.save();
  if (f > 0) ctx.globalAlpha *= 1 - f * f;
  shellCap(ctx, 4 + 30 * f, y - 5 - 46 * f + 70 * f * f, -0.25 + 0.15 * Math.sin(h * 9) + 4 * f, 1.15, o);
  ctx.restore();
}
// px space, y down, at the egg's centre: the white hit-frame, the lower shell half (drawn over the chick's feet), the shards
function shellPath(ctx, k, lower, sc = 1) {
  ctx.beginPath();
  const n = 18;
  for (let i = 0; i <= n; i++) { const q = eggPoint(Math.PI + (i / n) * Math.PI); const x = q.x * k * sc, y = -q.y * k * sc; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  // the broken rim: zigzag back across
  const w = EGG_W * 0.5 * k * sc, z = 6;
  for (let i = 1; i < z; i++) ctx.lineTo(w - (2 * w * i) / z, (i % 2 ? -0.05 : 0.03) * k * sc - lower * 0.02 * k);
  ctx.closePath();
}
function hatchShell(ctx, kind, h, k, front) {
  const C = KIND[kind], shell = C ? C.belly : '#f7ecd6', inner = '#e9dcc0', lw = Math.max(1.6, k * 0.03);
  if (!front) {
    if (h < H_HIT) { // hit-frame: the whole egg flashes white, a touch bigger
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < 28; i++) { const q = eggPoint((i / 28) * TAU); i ? ctx.lineTo(q.x * k * 1.08, -q.y * k * 1.08) : ctx.moveTo(q.x * k * 1.08, -q.y * k * 1.08); }
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = lw * 1.4;
      ctx.strokeStyle = C ? `rgb(${C.glow})` : '#ffd23a';
      ctx.stroke();
      ctx.restore();
    }
    return;
  }
  if (h < H_HIT) return;
  // lower half: holds the chick, then sinks and fades
  const cf = clamp((h - 0.5) / 0.25, 0, 1);
  if (cf < 1) {
    ctx.save();
    ctx.globalAlpha *= 1 - cf;
    ctx.translate(0, k * 0.2 + cf * k * 0.1);
    ctx.scale(1.25, 0.62);
    shellPath(ctx, k, 0, 1);
    ctx.fillStyle = shell;
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = LINE;
    ctx.stroke();
    ctx.fillStyle = inner; // the inside of the rim
    ctx.beginPath(); ctx.ellipse(0, -0.012 * k, EGG_W * 0.42 * k, 0.04 * k, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // shards: thrown out, gravity, one bounce on the floor under the egg, spinning, fading
  const T = h - H_HIT, floor = 0.3 * k, g = 9 * k;
  if (T > 0.85) return;
  ctx.lineWidth = Math.max(1.2, k * 0.02);
  ctx.strokeStyle = LINE;
  for (let i = 0; i < SHARDS.length; i++) {
    const [x0, y0, vx, vy, w, sz] = SHARDS[i];
    let x = x0 * k + vx * k * T, vY = -vy * k, y = -y0 * k + vY * T + 0.5 * g * T * T; // y down
    const a = 0.5 * g, b = vY, c = -y0 * k - floor, disc = b * b - 4 * a * c;
    if (y > floor && disc > 0) { // bounce once: from the impact time, upward at 35% of the speed
      const t1 = (-b + Math.sqrt(disc)) / (2 * a), v1 = (b + g * t1) * 0.35, dt = T - t1;
      y = Math.min(floor, floor - v1 * dt + 0.5 * g * dt * dt);
      x = x0 * k + vx * k * (t1 + dt * 0.5);
    }
    const r = 0.07 * k * sz;
    ctx.save();
    ctx.globalAlpha *= 1 - clamp((T - 0.55) / 0.3, 0, 1);
    ctx.translate(x, y);
    ctx.rotate(w * T + i);
    ctx.beginPath();
    ctx.moveTo(-r, -r * 0.5); ctx.lineTo(r * 0.2, -r * 0.8); ctx.lineTo(r, -r * 0.1); ctx.lineTo(r * 0.5, r * 0.6); ctx.lineTo(-r * 0.6, r * 0.5);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? shell : inner;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  // a quick ring of rays in the power's colour
  if (T < 0.25 && C) {
    const q = T / 0.25;
    ctx.strokeStyle = `rgba(${C.glow},${1 - q})`;
    ctx.lineWidth = Math.max(2, k * 0.04) * (1 - q * 0.5);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a2 = (i / 8) * TAU + 0.2, r0 = k * (0.25 + 0.3 * q), r1 = k * (0.35 + 0.45 * q); ctx.moveTo(Math.cos(a2) * r0, Math.sin(a2) * r0); ctx.lineTo(Math.cos(a2) * r1, Math.sin(a2) * r1); }
    ctx.stroke();
  }
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
    HMOOD.scare = clamp(st.scare || 0, 0, 1); HMOOD.happy = st.happy ? 1 : 0;
    HMOOD.wow = st.hatch !== undefined ? Math.sin(Math.PI * clamp((st.hatch - H_HIT) / 0.5, 0, 1)) : 0; // pops out round-eyed, settles
    if (st.hatch !== undefined) hatchPose(ctx, st.hatch);
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
      if (st.hatch !== undefined) hatchCap(ctx, kind, st.hatch, o);
    }
  } catch (e) {
    // art must never break the frame
  }
  HLOOK.x = HLOOK.y = HLOOK.shut = 0;
  HMOOD.wow = HMOOD.scare = HMOOD.happy = 0;
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
  if (h > 0) { // wobble on its bottom (growing), bulge in pulses, and a squash just before it bursts
    const w = Math.sin(t * 26) * 0.16 * Math.pow(h, 0.7), bu = Math.max(0, Math.sin(t * 19)) * 0.06 * h, an = smooth(clamp((h - 0.82) / 0.18, 0, 1));
    const bx = p.x, by = p.y - EGG_H * 0.5;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(w * (1 - an));
    ctx.scale(1 + bu + 0.1 * an, 1 + bu * 0.6 - 0.13 * an);
    ctx.translate(-bx, -by);
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
    // cracks race across the shell in the power's colour (a glowing split with a dark core), light leaking out of them
    ctx.save();
    path();
    ctx.clip();
    ctx.beginPath();
    const n = 9, w = EGG_W * 0.6, f = clamp(h * 1.25, 0, 1);
    for (let i = 0; i <= n; i++) {
      const x = -w + (2 * w * i) / n;
      if (x > -w + 2 * w * f + 1e-3) break;
      const y = 0.06 + (i % 2 ? 0.035 : -0.02);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    if (h > 0.45) { // a branch up toward the top, then one down
      const g = clamp((h - 0.45) / 0.35, 0, 1);
      ctx.moveTo(-0.04, 0.07); ctx.lineTo(-0.02, 0.07 + 0.06 * g); ctx.lineTo(-0.06, 0.07 + 0.11 * g); ctx.lineTo(-0.03, 0.07 + 0.16 * g);
      ctx.moveTo(0.08, 0.05); ctx.lineTo(0.1, 0.05 - 0.05 * g); ctx.lineTo(0.07, 0.05 - 0.1 * g);
    }
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(5 / k, 0.05) * (0.6 + 0.4 * h);
    ctx.strokeStyle = `rgba(${C.glow},${0.75 + 0.25 * Math.sin(t * 30)})`;
    ctx.stroke();
    ctx.lineWidth = Math.max(1.6 / k, 0.016);
    ctx.strokeStyle = '#3a2210';
    ctx.stroke();
    ctx.restore();
    path(1 + 0.25 * h);
    ctx.strokeStyle = `rgba(${C.glow},${0.6 * h})`;
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
const HATCH = new WeakMap(); // egg -> game time it was first drawn hatched (-1: it was a chick when we first saw it)
export function drawChickEgg(ctx, egg, t, k) {
  if (!egg.chick) {
    if (HATCH.get(egg) !== 0) HATCH.set(egg, 0); // seen as an egg: its hatch will be shown
    if (!egg.tint || !KIND[egg.tint]) return false;
    drawTintedEgg(ctx, egg, t, k);
    return true;
  }
  let h0 = HATCH.get(egg);
  if (h0 === 0) HATCH.set(egg, (h0 = t || 1e-6));
  else if (h0 === undefined) HATCH.set(egg, (h0 = -1)); // a chick from the start (restore, pre-hatched): no hatch moment
  const hs = h0 > 0 && t - h0 < H_END ? t - h0 : -1; // s since it hatched, while the hatch moment plays
  const kind = egg.chickKind;
  if (!KIND[kind]) {
    if (hs < 0 || kind !== 'peck') return false;
    // the classic (gold flame) chick: the same pop out of its shell around world.js's chick art
    const p = egg.body.getPosition();
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(1 / k, -1 / k);
    hatchShell(ctx, null, hs, k, false);
    if (hs >= H_HIT) {
      ctx.save();
      const s = 0.5 * k * 1.5 / 100;
      ctx.scale(s, s);
      hatchPose(ctx, hs);
      ctx.scale(1 / s, 1 / s);
      ctx.scale(k, -k);
      ctx.translate(-p.x, -p.y);
      drawEgg(ctx, egg, t, k);
      ctx.restore();
      HLOOK.x = HLOOK.y = HLOOK.shut = 0;
    }
    hatchShell(ctx, null, hs, k, true);
    ctx.restore();
    return true;
  }
  const b = egg.body, p = b.getPosition(), v = b.getLinearVelocity();
  const st = { flap: v.y < -0.3 ? 1 : 0.3, ready: !egg.powU, pow: egg.powK || 0, powT: egg.powT || 0, face: egg.face || 1, scare: MOOD.get(egg) || 0, happy: WON };
  // phase changes, for the short after-anims the sim has no phase for (swoop landing settle, bulk deflate pfff)
  let ph = PHASE.get(egg);
  if (!ph) PHASE.set(egg, (ph = { k: st.pow, from: 0, at: -9 }));
  if (ph.k !== st.pow) { ph.from = ph.k; ph.k = st.pow; ph.at = t; }
  const since = t - ph.at;
  if (!st.pow && since >= 0 && since < 0.6) {
    if (kind === 'swoop' && ph.from === 2) st.land = since;
    if (kind === 'bulk' && ph.from === 1) st.deflate = since;
  }
  if (kind === 'pick' && !st.pow && ph.from === 2 && since >= 0 && since < 1.5) st.after = since; // dizzy, proud, steam
  if (kind === 'pick' && st.pow) { // aim the bit at the ring it drills: out (the floor) unless the FX found the ring inside
    const a = Math.atan2(p.y, p.x), out = DRILL_OUT.get(egg) || 1;
    st.drillA = Math.atan2(-Math.sin(a) * out, Math.cos(a) * out);
  }
  const T = t + egg.id * 0.37; // chicks out of step with each other
  if (hs >= 0) st.hatch = hs;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(1 / k, -1 / k);
  if (hs >= 0) hatchShell(ctx, kind, hs, k, false);
  if (hs >= 0 && hs < H_HIT) { ctx.restore(); return true; } // the hit-frame: only the flash
  if (st.ready && !(hs >= 0 && hs < 0.6)) { drawReady(ctx, kind, 0, 0, 0.36 * k, T); drawHint(ctx, kind, st.face, 0.36 * k, T); }
  if (kind === 'bulk' && st.pow) {
    // the puffed body lies along the channel: size from the fixture, scaled into the 100-unit box
    const u = (0.5 * k * 1.5) / 100, verts = egg.fix.getShape().m_vertices || [];
    const hb = verts.length > 2 ? Math.abs(verts[2].y) : 0.34;
    st.rx = ((BULK_LEN + 0.06) * k) / u;
    st.ry = ((hb + 0.07) * k) / u;
    st.rot = -(Math.atan2(p.y, p.x) + Math.PI / 2);
  }
  drawKindChick(ctx, kind, 0, 0, 0.5 * k, T, st);
  if (hs >= 0) hatchShell(ctx, kind, hs, k, true);
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

// the drill's look on each ring material: chips, the lit and dark edges of the crack, the hole, the dust
const DRILL_MAT = {
  ice: { chip: '#e6f6ff', lit: '#ffffff', core: '#2d6a9a', hole: 'rgba(20,52,92,0.85)', dust: 'rgba(236,248,255,0.9)' },
  wood: { chip: '#e2b77a', lit: '#f7deb0', core: '#5a3414', hole: 'rgba(48,26,10,0.85)', dust: 'rgba(232,212,178,0.85)' },
  stone: { chip: '#b9b4ac', lit: '#e8e4dc', core: '#3e3a36', hole: 'rgba(30,28,26,0.85)', dust: 'rgba(214,210,202,0.85)' },
  vine: { chip: '#8fbf5a', lit: '#d4efaa', core: '#2c4a14', hole: 'rgba(24,40,10,0.85)', dust: 'rgba(214,232,186,0.85)' },
  metal: { chip: '#c8ced8', lit: '#ffffff', core: '#3a404a', hole: 'rgba(26,30,36,0.85)', dust: 'rgba(255,236,170,0.85)' },
  glass: { chip: '#dff4ff', lit: '#ffffff', core: '#4a7a9a', hole: 'rgba(30,60,90,0.8)', dust: 'rgba(236,248,255,0.9)' },
};
const CRACKS = [[1, 0.26, 0.15], [-1, 0.24, 0.12], [1, 0.14, 0.9], [-1, 0.16, 0.8]];
// World space, drawn over the eggs: the flash, dash streaks, swoop wind, pick sparks, daze stars.
// 0.8.18 faces: what each hatched chick feels, for drawChickEgg (read one frame late, which nobody sees). Scared: a
// predator's mouth, a diving eagle's aim or a thief within about a metre and a half; happy: the level is won.
const MOOD = new WeakMap(); // egg -> eased scare 0..1
let WON = false, MOOD_T = 0;
function chickMoods(sim, t) {
  const dt = clamp(t - MOOD_T, 0, 0.1); MOOD_T = t;
  WON = sim.state === 'won' || sim.state === 'winning';
  const pts = [], E = sim.eagle;
  if (E && (E.phase === 'warn' || E.phase === 'dive' || E.phase === 'strike') && E.tx != null) pts.push(E.tx, E.ty);
  for (const C of sim.sals || []) if (C.rad > 0 && C.ph !== 'wait' && C.ph !== 'gone') pts.push(C.rad * Math.cos(C.a), C.rad * Math.sin(C.a));
  for (const T of sim.thieves || []) if (T.r > 0 && T.ph !== 'wait' && T.ph !== 'gone' && T.ph !== 'hide') pts.push(T.r * Math.cos(T.a), T.r * Math.sin(T.a));
  for (const S of sim.snakes || []) { const h = S.pts && S.pts[0]; if (h && !S.gone && h.x != null) pts.push(h.x, h.y); }
  for (const e of sim.eggs) {
    if (!e.chick || !e.alive || !e.body) continue;
    const p = e.body.getPosition();
    let near = 0;
    for (let i = 0; i < pts.length; i += 2) { const d = Math.hypot(pts[i] - p.x, pts[i + 1] - p.y); if (d < 1.5) near = Math.max(near, d < 0.8 ? 1 : (1.5 - d) / 0.7); }
    const m = MOOD.get(e) || 0;
    MOOD.set(e, m + (near - m) * (1 - Math.exp(-dt * (near > m ? 10 : 3))));
  }
}

export function drawChickFX(ctx, sim, t, k) {
  chickMoods(sim, t);
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
      const el = e.powK === 1 ? PICK_T - e.powT : PICK_T, u = clamp((el - 0.2) / 0.35, 0, 1), ue = 1 - (1 - u) * (1 - u);
      const fade = e.powK === 2 ? clamp(e.powT / 0.35, 0, 1) : 1, on = e.powK === 2 ? fade * fade : clamp((el - 0.2) / 0.05, 0, 1);
      const M = DRILL_MAT[ring.hardIce ? 'ice' : ring.mat] || DRILL_MAT.wood;
      if (u > 0) {
        // the crack grows out of the bit: a light split with a dark core, running mostly along the ring, and the bored hole
        const hx = x - nx * 0.03, hy = y - ny * 0.03;
        ctx.globalAlpha = fade;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        for (const [col, w] of [[M.lit, 3.4], [M.core, 1.5]]) {
          ctx.strokeStyle = col;
          ctx.lineWidth = Math.max(w * px, w * 0.006);
          ctx.beginPath();
          for (const [sd, cl, dip] of CRACKS) { // side along the ring, length, how far it bends into the ring
            const L = cl * ue;
            ctx.moveTo(hx, hy);
            for (let i = 1; i <= 3; i++) {
              const l = (L * i) / 3, j = (i % 2 ? 0.024 : -0.014) - dip * l;
              ctx.lineTo(hx + tx * sd * l - nx * j, hy + ty * sd * l - ny * j);
            }
          }
          ctx.stroke();
        }
        ctx.fillStyle = M.hole;
        ctx.beginPath();
        ctx.ellipse(hx, hy, 0.035 + 0.05 * ue, 0.02 + 0.022 * ue, Math.atan2(ty, tx), 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (on > 0) {
        // a dust ring puffs out at the contact, again and again
        for (let i = 0; i < 2; i++) {
          const ph = mod(t * 4.5 + i * 0.5, 1);
          ctx.strokeStyle = M.dust;
          ctx.globalAlpha = on * 0.7 * (1 - ph);
          ctx.lineWidth = Math.max(3 * px, 0.04 * (1 - ph));
          ctx.beginPath();
          ctx.ellipse(x + nx * (0.03 + 0.05 * ph), y + ny * (0.03 + 0.05 * ph), 0.06 + 0.2 * ph, 0.025 + 0.06 * ph, Math.atan2(ty, tx), 0, TAU);
          ctx.stroke();
        }
        // chips of the ring's own stuff spiral out to both sides (spinning off the bit), falling
        ctx.lineWidth = Math.max(1.2 * px, 0.01);
        ctx.strokeStyle = M.core;
        for (let i = 0; i < 10; i++) {
          const ph = mod(t * 3.4 + i * 0.1 + i * i * 0.013, 1), sd = i % 2 ? 1 : -1, sp = 0.35 + 0.9 * mod(i * 0.37, 1), v = 1.7 + 0.9 * mod(i * 0.61, 1), T = ph * 0.4;
          const sw = Math.sin(ph * 9 + i) * 0.05 * ph; // the swirl
          const dx = nx * Math.cos(sp) + tx * sd * Math.sin(sp), dy = ny * Math.cos(sp) + ty * sd * Math.sin(sp);
          const cx = x + dx * v * T - dy * sw, cy = y + dy * v * T + dx * sw - 5 * T * T, r = 0.03 + 0.025 * mod(i * 0.53, 1), ro = T * 22 + i;
          ctx.globalAlpha = on * (1 - ph * ph);
          ctx.fillStyle = i % 3 ? M.chip : M.lit;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(ro) * r, cy + Math.sin(ro) * r);
          ctx.lineTo(cx + Math.cos(ro + 2.3) * r * 0.8, cy + Math.sin(ro + 2.3) * r * 0.8);
          ctx.lineTo(cx + Math.cos(ro + 4.1) * r * 0.9, cy + Math.sin(ro + 4.1) * r * 0.9);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        if (e.powK === 1) { ctx.fillStyle = `rgba(255,255,255,${on})`; for (let i = 0; i < 2; i++) { const ph = mod(t * 6 + i * 0.5, 1); sparkle(ctx, x + tx * (i ? 0.09 : -0.08) + nx * 0.06, y + ty * (i ? 0.09 : -0.08) + ny * 0.06, 0.05 * Math.sin(ph * Math.PI)); } }
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
      if (ev.egg && !(HATCH.get(ev.egg) > 0)) HATCH.set(ev.egg, 0); // the hatch moment starts on the next draw
      if (!KIND[ev.kind]) break;
      audio.play('twin_hatch', { pitch: 1.15 });
      fx.wave(ev.x, ev.y, 0.75, `rgb(${KIND[ev.kind].glow})`, 0.35, 0.08);
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
