// Chick Strike powers: the six strike chicks, their flight, hits and effects, the HUD button and the intro picker.
// Rules: sim/strike.js. Data: data/strikes.js. One light top-left, cel bands (castkit form), thin same-hue lines.
// One rig for all six (the Frost Chick is the model): a just-hatched chick still wearing the top of its eggshell as a helmet.
// Each power dresses the shell and colours the chick, so they read apart by silhouette and colour:
//   freeze  ice blue, iced shell, icicles, a shard crest        thunder  storm yellow, scorched shell, two prongs and a spark
//   bomb    orange, a red firecracker casing, a lit fuse              decoy    cream, a nearly whole shell with eye-holes
//   tornado teal, a swirl of head feathers, a spiral crack      glue     purple, green goo dripping off the shell
// Chick art is drawn in px space, y down, centred on the body; s = the body height in px.
import { geckoAnchor } from './gecko15.js';
import { clamp, lerp, ss, hash, blinkAt, form, contact } from './castkit.js';
import { boltStroke } from './status.js';
import { STRIKE, STRIKES, FLIGHT } from '../data/strikes.js';

import { hitBegin, hitRage, drawHitFx } from './strikehit.js';
const TAU = Math.PI * 2;
export const strikeColor = (id) => (STRIKE[id] ? STRIKE[id].col[0] : '#fff');

// ---------------------------------------------------------------- the Frost Chick (hero art: the style the other five follow)
// A just-hatched chick with attitude, facing +x in three-quarter view, still wearing the top of its eggshell as a helmet (the
// shared mark of every strike chick). Pear body, downy chest and cheek tufts, stubby acting wings, legs and big feet, a fan
// tail, a short beak. Its shell is iced over: icicles off the rim, a shard crest. s = the BODY height (helmet and crest add ~0.6 s).
// o: { mood ('idle' | 'crouch' | 'yell' | 'hit' | 'smug' | 'ready', or [from, to, k]), squash (about the feet), stretch (along
//      the facing axis), trail (-1 crest whipped forward .. 1 streaming back), wing 0..1, look {x, y}, feet, fog (false = none) }
const FROSTP = {
  base: '#38aef0', lo: '#1873c4', hi: '#8fdcff', line: '#114a86', down: '#bfeaff', downLo: '#7fc4f0',
  ice: '#f4fcff', iceLo: '#74bff0', iceLine: '#2a78ba', frost: '#d6f1ff',
  shell: '#fff1d6', shellLo: '#d6bd90', shellLine: '#8a6a3c',
  wing: '#2379cf', wingLo: '#154f99', wingHi: '#56b6f6',
  brow: '#0d2f5c', lid: '#2585d8', white: '#ffffff', eyeSh: '#c4dcf0', iris: '#0f5aa8', irisHi: '#35b8f2', pupil: '#0a1626',
  beak: '#ffb21e', beakHi: '#ffe27e', beakLo: '#e07a10', beakLine: '#9a4a0a', mouth: '#5a1022', tongue: '#ff7282', teeth: '#fffdf2',
};
const MOODS = { // lid / low: upper / lower lid 0..1; brow: inward tilt (rad); cock: lifts the near brow; pup: pupil size; open: beak
  idle: { lid: 0.44, low: 0, brow: 0.2, cock: 0.55, pup: 1, open: 0, grit: 0, smirk: 0.5, shut: 0 },
  crouch: { lid: 0.36, low: 0.36, brow: 0.5, cock: 0, pup: 0.85, open: 0.16, grit: 1, smirk: 0, shut: 0 },
  yell: { lid: 0.1, low: 0, brow: 0.46, cock: 0, pup: 0.66, open: 1, grit: 0, smirk: 0, shut: 0 },
  hit: { lid: 0.3, low: 0.2, brow: 0.55, cock: 0, pup: 0.8, open: 0.2, grit: 1, smirk: 0, shut: 1 },
  smug: { lid: 0.5, low: 0.4, brow: -0.12, cock: 0.9, pup: 1, open: 0, grit: 0, smirk: 1, shut: 0 },
  ready: { lid: 0.16, low: 0.12, brow: 0.4, cock: 0, pup: 0.82, open: 0.5, grit: 0, smirk: 0.3, shut: 0 },
};
let FR = FROSTP; // the palette of the chick being drawn
function moodOf(o) {
  const m = o.mood || (o.open > 0.5 ? 'yell' : 'idle');
  if (!Array.isArray(m)) return MOODS[m] || MOODS.idle;
  const a = MOODS[m[0]] || MOODS.idle, b = MOODS[m[1]] || MOODS.idle, k = clamp(m[2], 0, 1), r = {};
  for (const f in a) r[f] = lerp(a[f], b[f], k);
  r.shut = k > 0.5 ? b.shut : a.shut; r.grit = k > 0.5 ? b.grit : a.grit;
  return r;
}
function frBody(ctx, s) { // a pear: small head, full chest and rump, downy tufts at the cheek and the back
  ctx.beginPath();
  ctx.moveTo(0.02 * s, -0.44 * s);
  ctx.bezierCurveTo(0.26 * s, -0.44 * s, 0.4 * s, -0.27 * s, 0.4 * s, -0.08 * s);
  ctx.bezierCurveTo(0.41 * s, 0.03 * s, 0.53 * s, 0.1 * s, 0.53 * s, 0.23 * s);
  ctx.bezierCurveTo(0.53 * s, 0.37 * s, 0.32 * s, 0.45 * s, 0.03 * s, 0.45 * s);
  ctx.bezierCurveTo(-0.26 * s, 0.45 * s, -0.5 * s, 0.4 * s, -0.53 * s, 0.22 * s);
  ctx.lineTo(-0.62 * s, 0.13 * s); ctx.lineTo(-0.49 * s, 0.1 * s); ctx.lineTo(-0.57 * s, -0.01 * s); ctx.lineTo(-0.44 * s, -0.02 * s); ctx.lineTo(-0.5 * s, -0.13 * s); ctx.lineTo(-0.4 * s, -0.12 * s);
  ctx.bezierCurveTo(-0.38 * s, -0.3 * s, -0.22 * s, -0.44 * s, 0.02 * s, -0.44 * s);
  ctx.closePath();
}
// an ice shard from its base to its tip: a lit facet and a shaded one, a thin same-hue edge, one glint
function shard(ctx, bx, by, tx, ty, hw, lw) {
  const dx = tx - bx, dy = ty - by, l = Math.hypot(dx, dy) || 1, nx = (-dy / l) * hw, ny = (dx / l) * hw, lit = nx * -0.5 + ny * -0.87 > 0;
  const ex = bx - (dx / l) * hw * 0.5, ey = by - (dy / l) * hw * 0.5; // the root, sunk into what it grows from
  ctx.beginPath(); ctx.moveTo(bx + nx, by + ny); ctx.lineTo(tx, ty); ctx.lineTo(ex, ey); ctx.closePath(); ctx.fillStyle = lit ? FR.ice : FR.iceLo; ctx.fill();
  ctx.beginPath(); ctx.moveTo(bx - nx, by - ny); ctx.lineTo(tx, ty); ctx.lineTo(ex, ey); ctx.closePath(); ctx.fillStyle = lit ? FR.iceLo : FR.ice; ctx.fill();
  ctx.beginPath(); ctx.moveTo(bx + nx, by + ny); ctx.lineTo(tx, ty); ctx.lineTo(bx - nx, by - ny); ctx.lineJoin = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = FR.iceLine; ctx.stroke();
  const k = lit ? 0.45 : -0.45;
  ctx.beginPath(); ctx.moveTo(lerp(bx, tx, 0.18) + nx * k, lerp(by, ty, 0.18) + ny * k); ctx.lineTo(lerp(bx, tx, 0.62) + nx * k * 0.5, lerp(by, ty, 0.62) + ny * k * 0.5);
  ctx.lineCap = 'round'; ctx.lineWidth = lw * 1.5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
}
// a stubby wing that acts: back = swept behind (a: down .. up), or thrown forward as a fist
function frWing(ctx, s, x, y, a, far, lw, fwd) {
  ctx.save(); ctx.translate(x * s, y * s); if (!fwd) ctx.scale(-1, 1); ctx.rotate(a);
  const p = () => {
    ctx.beginPath(); ctx.moveTo(-0.04 * s, -0.08 * s); ctx.quadraticCurveTo(0.14 * s, -0.16 * s, 0.29 * s, -0.05 * s);
    ctx.quadraticCurveTo(0.31 * s, -0.01 * s, 0.22 * s, 0.01 * s); ctx.quadraticCurveTo(0.3 * s, 0.05 * s, 0.25 * s, 0.08 * s); ctx.quadraticCurveTo(0.2 * s, 0.08 * s, 0.17 * s, 0.07 * s); ctx.quadraticCurveTo(0.21 * s, 0.13 * s, 0.14 * s, 0.14 * s);
    ctx.quadraticCurveTo(-0.02 * s, 0.15 * s, -0.06 * s, 0.03 * s); ctx.closePath();
  };
  form(ctx, p, { d: s * 0.035, lo: FR.wingLo, base: far ? FR.wingLo : FR.wing, hi: far ? FR.wing : FR.wingHi, line: FR.line, lw, noWeight: true });
  ctx.restore();
}
function frEye(ctx, s, E, M, lk, bl, lw) {
  const { cx, cy, rx, ry, sd } = E, lid = lerp(M.lid - (sd > 0 ? M.cock * 0.16 : 0), 1.04, bl), ang = M.brow * 0.8 * (sd > 0 ? 1 - M.cock * 0.7 : 1);
  const yb = cy - ry * 1.08 + 2 * ry * lid, sl = sd * Math.tan(ang), Y = (x) => yb + (x - cx) * sl;
  const el = () => { ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); };
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (M.shut) { // scrunched shut: > <
    el(); ctx.fillStyle = FR.lid; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = FR.line; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - sd * rx * 0.55, cy - ry * 0.3); ctx.lineTo(cx + sd * rx * 0.5, cy + ry * 0.12); ctx.lineTo(cx - sd * rx * 0.55, cy + ry * 0.5);
    ctx.lineWidth = s * 0.034; ctx.strokeStyle = FR.brow; ctx.stroke();
  } else {
    el(); ctx.fillStyle = FR.white; ctx.fill(); ctx.save(); ctx.clip();
    ctx.beginPath(); ctx.ellipse(cx + rx * 0.16, cy + ry * 0.2, rx, ry, 0, 0, TAU); ctx.rect(cx - rx * 2, cy - ry * 2, rx * 4, ry * 4); ctx.fillStyle = FR.eyeSh; ctx.fill('evenodd'); // the socket's shade, top-left
    const ir = s * 0.098 * (0.55 + 0.45 * M.pup) * (sd > 0 ? 1 : 0.86), pxx = cx + lk.x * (rx - ir * 0.8) * 0.8 + sd * rx * 0.06, pyy = Math.max(cy + lk.y * ry * 0.3, Math.min(cy + ry * 0.4, Y(pxx) + ir * 0.55));
    ctx.beginPath(); ctx.arc(pxx, pyy, ir, 0, TAU); ctx.fillStyle = FR.iris; ctx.fill();
    ctx.beginPath(); ctx.arc(pxx, pyy + ir * 0.25, ir * 0.72, 0, TAU); ctx.fillStyle = FR.irisHi; ctx.fill();
    ctx.beginPath(); ctx.arc(pxx, pyy, ir * 0.52 * (1.25 - 0.25 * M.pup), 0, TAU); ctx.fillStyle = FR.pupil; ctx.fill();
    ctx.beginPath(); ctx.arc(pxx - ir * 0.38, pyy - ir * 0.4, ir * 0.27, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - rx * 2, Y(cx - rx * 2)); ctx.lineTo(cx + rx * 2, Y(cx + rx * 2)); ctx.lineTo(cx + rx * 2, cy - ry * 2); ctx.lineTo(cx - rx * 2, cy - ry * 2); ctx.closePath(); ctx.fillStyle = FR.lid; ctx.fill();
    ctx.lineWidth = Math.max(0.9, s * 0.026); ctx.strokeStyle = FR.brow; ctx.stroke(); // the lid's edge carries the attitude
    if (M.low > 0.01) { // the lower lid: the cheek pushes up in an arc
      const yl = cy + ry - 2 * ry * M.low;
      ctx.beginPath(); ctx.moveTo(cx - rx * 1.4, cy + ry * 1.3); ctx.lineTo(cx - rx * 1.4, yl + ry * 0.3); ctx.quadraticCurveTo(cx, yl - ry * 0.4, cx + rx * 1.4, yl + ry * 0.3); ctx.lineTo(cx + rx * 1.4, cy + ry * 1.3); ctx.closePath();
      ctx.fillStyle = FR.base; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = FR.line; ctx.stroke();
    }
    ctx.restore();
    el(); ctx.lineWidth = lw; ctx.strokeStyle = FR.line; ctx.stroke();
  }
  ctx.restore();
}
function frBeak(ctx, s, M, lw) { // a short chick beak; it gapes wide for the yell
  const open = clamp(M.open, 0, 1), a = open * 0.95, hx = -0.09 * s, hy = 0.035 * s, c = Math.cos(a), sn = Math.sin(a);
  const R = (x, y) => [hx + (x * s - hx) * c - (y * s - hy) * sn, hy + (x * s - hx) * sn + (y * s - hy) * c]; // the lower beak swings on its hinge
  ctx.save(); ctx.translate(0.31 * s, 0.1 * s); ctx.rotate(-0.06 * M.smirk); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const t0 = R(0.15, 0.045), t1 = R(0.07, 0.14), t3 = R(-0.07, 0.12), h0 = R(-0.1, 0.04);
  const ua = -open * 0.42, uc = Math.cos(ua), us = Math.sin(ua), U = (x, y) => [hx + (x * s - hx) * uc - (y * s - hy) * us, hy + (x * s - hx) * us + (y * s - hy) * uc];
  if (open > 0.04) { // the mouth
    const u0 = U(0.2, 0.035);
    ctx.beginPath(); ctx.moveTo(hx - 0.03 * s, hy - 0.01 * s); ctx.lineTo(u0[0], u0[1]); ctx.lineTo(t0[0], t0[1]); ctx.lineTo(t3[0], t3[1]); ctx.closePath(); ctx.fillStyle = FR.mouth; ctx.fill();
    ctx.save(); ctx.clip();
    if (M.grit) { ctx.fillStyle = FR.teeth; ctx.fillRect(-0.2 * s, -0.2 * s, 0.6 * s, 0.6 * s); ctx.strokeStyle = '#b9a98a'; ctx.lineWidth = lw; ctx.beginPath(); for (let i = 0; i < 4; i++) { const x = (-0.04 + i * 0.06) * s; ctx.moveTo(x, -0.05 * s); ctx.lineTo(x + 0.01 * s, 0.2 * s); } ctx.stroke(); }
    else { const q = R(0.03, 0.1); ctx.beginPath(); ctx.ellipse(q[0], q[1], 0.09 * s, 0.05 * s, a, 0, TAU); ctx.fillStyle = FR.tongue; ctx.fill(); }
    ctx.restore();
  }
  ctx.beginPath(); ctx.moveTo(h0[0], h0[1]); ctx.lineTo(t0[0], t0[1]); ctx.quadraticCurveTo(t1[0], t1[1], t3[0], t3[1]); ctx.closePath();
  ctx.fillStyle = FR.beakLo; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = FR.beakLine; ctx.stroke();
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(ua); ctx.translate(-hx, -hy);
  const up = () => { ctx.beginPath(); ctx.moveTo(-0.12 * s, 0.01 * s); ctx.quadraticCurveTo(-0.04 * s, -0.11 * s, 0.06 * s, -0.07 * s); ctx.lineTo(0.21 * s, 0.035 * s); ctx.lineTo(-0.1 * s, 0.05 * s); ctx.closePath(); };
  form(ctx, up, { d: s * 0.035, lo: FR.beakLo, base: FR.beak, hi: FR.beakHi, line: FR.beakLine, lw, noWeight: true, hiK: 0.7 });
  ctx.restore();
  if (M.smirk > 0.05 && open < 0.3) { ctx.beginPath(); ctx.moveTo(-0.1 * s, 0.045 * s); ctx.quadraticCurveTo(-0.17 * s, 0.055 * s, -0.2 * s, (0.045 - 0.1 * M.smirk) * s); ctx.lineWidth = Math.max(0.9, s * 0.026); ctx.strokeStyle = FR.line; ctx.stroke(); }
  ctx.restore();
}
// the eggshell helmet every strike chick still wears; the Frost Chick's is iced over: a frost coat, icicles off the cracked
// rim, the shard crest growing from the shell. It tips down over the eyes when the chick means business.
function frHelmet(ctx, s, t, M, tr, sw, lw) {
  const id = CID; ctx.save();
  if (id === 'decoy') { ctx.translate(0, -0.03 * s); ctx.rotate(0.02 - tr * 0.06 + M.brow * 0.06); ctx.scale(1.04, 1.3); } // a nearly whole shell, down past the eyes
  else { ctx.translate(0.0, (-0.3 + M.lid * 0.07 - M.cock * 0.03) * s); ctx.rotate(0.02 + M.brow * 0.34 * (1 - M.cock * 0.9) - M.cock * 0.12 - tr * 0.1); }
  if (id !== 'freeze') helmCrest(ctx, id, s, t, tr, sw, lw);
  else for (const [x, y, len, a0, hw, k] of [[-0.21, -0.36, 0.3, 0.95, 0.08, 1.0], [0.19, -0.38, 0.22, 0.05, 0.07, 0.55], [-0.01, -0.46, 0.42, 0.45, 0.095, 0.8]]) {
    const a = a0 + tr * 0.62 * k + sw * 0.035 * k, L = len * (1 + Math.abs(tr) * 0.12);
    shard(ctx, x * s, y * s, (x - Math.sin(a) * L) * s, (y - Math.cos(a) * L) * s, hw * s, lw);
  }
  const Z = [[0.38, 0.1], [0.29, -0.01], [0.19, 0.11], [0.09, 0.0], [-0.02, 0.11], [-0.13, 0.0], [-0.24, 0.1], [-0.35, -0.01]];
  const dome = () => { ctx.beginPath(); ctx.moveTo(-0.45 * s, 0.02 * s); ctx.bezierCurveTo(-0.47 * s, -0.28 * s, -0.25 * s, -0.5 * s, 0.01 * s, -0.5 * s); ctx.bezierCurveTo(0.27 * s, -0.5 * s, 0.49 * s, -0.28 * s, 0.47 * s, 0.02 * s); for (const [x, y] of Z) ctx.lineTo(x * s, y * s); ctx.closePath(); };
  form(ctx, dome, { d: s * 0.07, lo: FR.shellLo, base: FR.shell, hi: FR.shellHi || '#ffffff', line: FR.shellLine, lw, noWeight: true, hiK: 0.5,
    inner: (c) => {
      if (id !== 'freeze') { helmInner(c, id, s, t, lw); return; }
      const C = [[-0.5, -0.3], [-0.36, -0.22], [-0.29, -0.33], [-0.19, -0.25], [-0.1, -0.37], [0.02, -0.29], [0.11, -0.4], [0.22, -0.33], [0.3, -0.42], [0.5, -0.4], [0.5, -0.6], [-0.5, -0.6]];
      for (const [ox, oy, col] of [[0.015, 0.03, FR.iceLo], [0, 0, FR.frost]]) { c.beginPath(); C.forEach(([x, y], i) => (i ? c.lineTo((x + ox) * s, (y + oy) * s) : c.moveTo((x + ox) * s, (y + oy) * s))); c.closePath(); c.fillStyle = col; c.fill(); }
      c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.ellipse(-0.22 * s, -0.37 * s, 0.08 * s, 0.03 * s, -0.6, 0, TAU); c.fill();
      c.fillStyle = FR.shellLo; for (const [x, y, r] of [[0.3, -0.1, 0.024], [0.08, -0.12, 0.017], [-0.3, -0.06, 0.02], [-0.12, -0.16, 0.014], [0.33, -0.24, 0.015]]) { c.beginPath(); c.arc(x * s, y * s, r * s, 0, TAU); c.fill(); }
      c.strokeStyle = FR.shellLine; c.lineWidth = lw; c.beginPath(); c.moveTo(0.19 * s, 0.11 * s); c.lineTo(0.21 * s, -0.02 * s); c.lineTo(0.16 * s, -0.08 * s); c.stroke(); // a crack up from the rim
    } });
  if (id !== 'freeze') helmRim(ctx, id, s, t, tr, sw, lw);
  else for (const [x, y, len] of [[-0.4, 0.0, 0.17], [-0.3, 0.02, 0.1], [0.43, 0.02, 0.12]]) shard(ctx, x * s, y * s, (x + sw * 0.01 - tr * 0.05) * s, (y + len) * s, 0.04 * s, lw); // icicles off the rim
  ctx.restore();
}
function frostChick(ctx, s, t, o) {
  const M = moodOf(o), sq = clamp(o.squash || 0, -0.6, 0.8), st = clamp(o.stretch || 0, -0.5, 0.6), tr = clamp(o.trail || 0, -1, 1), wing = clamp(o.wing || 0, 0, 1);
  const lw = Math.max(1.1, s * 0.02), sw = Math.sin(t * 2.6), lk = o.look || { x: 0.5, y: 0 };
  const bl = M.shut ? 0 : (o.blink ?? blinkAt(t, 34));
  if (o.shadow) contact(ctx, 0, s * 0.56, s * 0.44 * (1 + sq * 0.3), s * 0.06, 0.25);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (o.feet !== false) { // little legs, big planted feet
    const top = (0.4 + sq * 0.05) * s;
    for (const fx of [-0.2, 0.1]) {
      ctx.beginPath(); ctx.moveTo((fx + 0.02) * s, top); ctx.lineTo(fx * s, 0.53 * s); ctx.lineWidth = s * 0.06; ctx.strokeStyle = FR.beakLine; ctx.stroke(); ctx.lineWidth = s * 0.04; ctx.strokeStyle = FR.beakLo; ctx.stroke();
      ctx.beginPath(); ctx.moveTo((fx - 0.07) * s, 0.53 * s); ctx.quadraticCurveTo((fx - 0.03) * s, 0.47 * s, (fx + 0.05) * s, 0.485 * s);
      ctx.lineTo((fx + 0.21) * s, 0.5 * s); ctx.lineTo((fx + 0.12) * s, 0.525 * s); ctx.lineTo((fx + 0.23) * s, 0.55 * s); ctx.lineTo((fx + 0.1) * s, 0.553 * s); ctx.lineTo((fx + 0.16) * s, 0.585 * s); ctx.lineTo((fx - 0.05) * s, 0.57 * s); ctx.closePath();
      ctx.fillStyle = FR.beak; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = FR.beakLine; ctx.stroke();
    }
  }
  ctx.save();
  ctx.translate(0, s * 0.5); ctx.scale(1 + sq * 0.32, 1 - sq * 0.34); ctx.translate(0, -s * 0.5);
  if (st) ctx.scale(1 + st, 1 - st * 0.5);
  // a short fan tail: three stubby feathers (they stream back in flight)
  for (let i = 0; i < 3; i++) {
    const b = (0.95 - i * 0.5) * (1 - Math.max(0, tr) * 0.7) - Math.min(0, tr) * 0.5 + sw * 0.05, L = (0.25 - Math.abs(i - 1) * 0.03) * (1 + Math.max(0, tr) * 0.3) * s, c = Math.cos(b), sn = Math.sin(b);
    ctx.save(); ctx.translate(-0.46 * s, 0.24 * s); ctx.transform(-c, -sn, sn, -c, 0, 0);
    form(ctx, () => { ctx.beginPath(); ctx.moveTo(0, -0.07 * s); ctx.quadraticCurveTo(L * 0.8, -0.1 * s, L, 0); ctx.quadraticCurveTo(L * 0.8, 0.09 * s, 0, 0.07 * s); ctx.closePath(); }, { d: s * 0.03, lo: FR.wingLo, base: FR.wing, hi: FR.wingHi, line: FR.line, lw, noWeight: true });
    ctx.restore();
  }
  if (wing > 0.25) frWing(ctx, s, -0.1, -0.02, lerp(0.5, -0.85, wing), true, lw);
  form(ctx, () => frBody(ctx, s), { d: s * 0.085, lo: FR.lo, base: FR.base, hi: FR.hi, line: FR.line, lw, noWeight: true, hiK: 0.55,
    inner: (c) => {
      // the downy chest: a ruff of pale tufts
      const T = [[0.6, 0.06], [0.4, 0.1], [0.44, 0.17], [0.27, 0.17], [0.33, 0.25], [0.15, 0.25], [0.22, 0.33], [0.03, 0.34], [0.1, 0.42], [-0.1, 0.5], [0.6, 0.5]];
      for (const [ox, oy, col] of [[0.02, 0.025, FR.downLo], [0, 0, FR.down]]) { c.beginPath(); T.forEach(([x, y], i) => (i ? c.lineTo((x + ox) * s, (y + oy) * s) : c.moveTo((x + ox) * s, (y + oy) * s))); c.closePath(); c.fillStyle = col; c.fill(); }
      c.strokeStyle = FR.lo; c.lineWidth = Math.max(0.8, s * 0.02); c.beginPath(); // cheek fluff
      for (const [x, y] of [[-0.3, 0.02], [-0.22, 0.1], [-0.33, 0.16]]) { c.moveTo((x - 0.05) * s, (y - 0.03) * s); c.lineTo(x * s, (y + 0.03) * s); c.lineTo((x + 0.05) * s, (y - 0.03) * s); }
      c.stroke();
      if (CID === 'decoy') { c.fillStyle = '#c9a468'; for (const [x, y, r] of [[-0.3, 0.3, 0.03], [0.36, 0.12, 0.022], [-0.1, 0.36, 0.02], [-0.38, 0.14, 0.018]]) { c.beginPath(); c.arc(x * s, y * s, r * s, 0, TAU); c.fill(); } } // painted like an egg
    } });
  // the near wing: tucked, flapping, swept back, or thrown forward as a fist when it grits its beak
  if (M.grit && wing < 0.5) frWing(ctx, s, -0.02, 0.2, -0.75, false, lw, true);
  else frWing(ctx, s, -0.2, 0.14, lerp(0.8, -0.5, wing) + (wing > 0.9 ? Math.sin(t * 30) * 0.06 : 0), false, lw);
  const e0 = { cx: 0.27 * s, cy: -0.07 * s, rx: 0.108 * s, ry: 0.15 * s, sd: -1 }, e1 = { cx: 0.03 * s, cy: -0.065 * s, rx: 0.15 * s, ry: 0.168 * s, sd: 1 };
  if (CID === 'freeze') { frEye(ctx, s, e0, M, lk, bl, lw); frEye(ctx, s, e1, M, lk, bl, lw); frBeak(ctx, s, M, lw); frHelmet(ctx, s, t, M, tr, sw, lw); }
  else castFace(ctx, s, t, M, lk, bl, lw, tr, sw, e0, e1, o);
  ctx.restore();
  // cold breath: a few pale puffs off the beak
  const fog = CID !== 'freeze' || o.fog === false ? -1 : typeof o.fog === 'number' ? o.fog : (o.mood === undefined || o.mood === 'idle' || o.mood === 'smug') ? ((t * 0.42) % 1) / 0.5 : -1;
  if (fog >= 0 && fog < 1) {
    ctx.save(); ctx.fillStyle = '#eefaff';
    for (let i = 0; i < 3; i++) { const v = clamp(fog * 1.25 - i * 0.12, 0, 1); if (v <= 0) continue; ctx.globalAlpha = 0.6 * (1 - v) * (1 - i * 0.2); ctx.beginPath(); ctx.arc((0.6 + v * 0.42 + i * 0.05) * s, (0.14 - v * 0.16 - i * 0.07 * v) * s, (0.045 + v * 0.1) * s * (1 - i * 0.18), 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  // a glint on the tall shard now and then
  const g = (t * 0.6 + 0.3) % 1;
  if (g < 0.22 && o.fog !== false && CID === 'freeze') { const q = Math.sin((g / 0.22) * Math.PI), gx = -0.19 * s, gy = -1.0 * s, r = s * 0.11 * q; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(gx, gy - r); ctx.quadraticCurveTo(gx, gy, gx + r, gy); ctx.quadraticCurveTo(gx, gy, gx, gy + r); ctx.quadraticCurveTo(gx, gy, gx - r, gy); ctx.quadraticCurveTo(gx, gy, gx, gy - r); ctx.fill(); }
}

// ---------------------------------------------------------------- the other five: the same rig, their own colours, shells and wakes
const CAST_COMMON = { ice: '#f4fcff', iceLo: '#74bff0', iceLine: '#2a78ba', frost: '#d6f1ff', white: '#ffffff', eyeSh: '#d6d8e2', pupil: '#0a1626', shell: '#fff1d6', shellLo: '#d6bd90', shellHi: '#ffffff', shellLine: '#8a6a3c',
  beak: '#ffb21e', beakHi: '#ffe27e', beakLo: '#e07a10', beakLine: '#9a4a0a', mouth: '#5a1022', tongue: '#ff7282', teeth: '#fffdf2' };
const CAST = {
  freeze: FROSTP,
  thunder: { ...CAST_COMMON, base: '#ffcc1f', lo: '#e08a0a', hi: '#fff08a', line: '#8a5200', down: '#fff3b8', downLo: '#f2c14a', wing: '#f09a10', wingLo: '#b86a04', wingHi: '#ffc23a', brow: '#5a3200', lid: '#f4b012', iris: '#2a3fb0', irisHi: '#5a86ff', shell: '#f3e6c8', shellLo: '#b89e74', shellLine: '#6a4e2a' },
  bomb: { ...CAST_COMMON, base: '#f08a24', lo: '#c25e12', hi: '#ffb45a', line: '#7a3408', down: '#ffe2a0', downLo: '#f2b866', wing: '#d9661a', wingLo: '#a8440c', wingHi: '#ffa64a', brow: '#6a2a06', lid: '#d9741c', iris: '#b02a0e', irisHi: '#ff8a2a', shell: '#c8302a', shellLo: '#8c1a16', shellHi: '#f0635a', shellLine: '#4c0c0a' },
  decoy: { ...CAST_COMMON, base: '#f0d49e', lo: '#c79a58', hi: '#fff0cc', line: '#7a5426', down: '#fff6de', downLo: '#e6c88e', wing: '#d8a860', wingLo: '#a87a38', wingHi: '#f0cc8a', brow: '#4a2e10', lid: '#e2c084', iris: '#5a3410', irisHi: '#b87a2a', shell: '#fff6e2', shellLo: '#dcc7a0' },
  tornado: { ...CAST_COMMON, base: '#35cdb0', lo: '#12907e', hi: '#9af2dc', line: '#0c5a4e', down: '#d2fff2', downLo: '#8ae0cc', wing: '#17a08c', wingLo: '#0c6e60', wingHi: '#58dcc4', brow: '#083f38', lid: '#22b49a', iris: '#0c6a5c', irisHi: '#3fe0c0' },
  glue: { ...CAST_COMMON, base: '#a866ee', lo: '#6f34bc', hi: '#d6acff', line: '#3f1680', down: '#ecd6ff', downLo: '#c096f0', wing: '#7e3fd0', wingLo: '#52209a', wingHi: '#b07af0', brow: '#2c0c5e', lid: '#9450e0', iris: '#4a1a90', irisHi: '#b46aff', goo: '#8cf56a', gooLo: '#3fb83a', gooLine: '#1f7a22' },
};
let CID = 'freeze', FUSE = 1; // the chick being drawn; how much of the Boom Chick's fuse is left
function spike(ctx, bx, by, tx, ty, hw, c1, c2, line, lw) { // a pointed feather / shell prong: lit half, shaded half, thin edge
  const dx = tx - bx, dy = ty - by, l = Math.hypot(dx, dy) || 1, nx = (-dy / l) * hw, ny = (dx / l) * hw, k = nx * -0.5 + ny * -0.87 > 0 ? 1 : -1;
  ctx.beginPath(); ctx.moveTo(bx + nx, by + ny); ctx.lineTo(tx, ty); ctx.lineTo(bx - nx, by - ny); ctx.closePath(); ctx.fillStyle = c2; ctx.fill();
  ctx.beginPath(); ctx.moveTo(bx + nx * k, by + ny * k); ctx.lineTo(tx, ty); ctx.lineTo(bx, by); ctx.closePath(); ctx.fillStyle = c1; ctx.fill();
  ctx.beginPath(); ctx.moveTo(bx + nx, by + ny); ctx.lineTo(tx, ty); ctx.lineTo(bx - nx, by - ny); ctx.lineJoin = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = line; ctx.stroke();
}
const poly = (c, P, s, ox = 0, oy = 0) => { c.beginPath(); P.forEach(([x, y], i) => (i ? c.lineTo((x + ox) * s, (y + oy) * s) : c.moveTo((x + ox) * s, (y + oy) * s))); };
const two = (c, w1, c1, w2, c2) => { c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = w1; c.strokeStyle = c1; c.stroke(); c.lineWidth = w2; c.strokeStyle = c2; c.stroke(); };
const PRONG = [[-0.33, -0.3, -0.5, -0.6], [0.3, -0.32, 0.45, -0.6]];
// behind the shell: what sticks up out of it
function helmCrest(ctx, id, s, t, tr, sw, lw) {
  if (id === 'thunder') { // feathers on end, two broken shell prongs
    for (let i = 0; i < 5; i++) { const x = -0.3 + i * 0.14, a = 0.8 - i * 0.32 + tr * 0.5 + Math.sin(t * 31 + i * 2) * 0.04, L = 0.34 + (i % 2) * 0.12; spike(ctx, x * s, -0.4 * s, (x - Math.sin(a) * L) * s, (-0.4 - Math.cos(a) * L) * s, 0.05 * s, FR.hi, FR.base, FR.line, lw); }
    for (const [bx, by, tx, ty] of PRONG) spike(ctx, bx * s, by * s, tx * s, ty * s, 0.075 * s, FR.shellHi, FR.shellLo, FR.shellLine, lw);
  } else if (id === 'bomb') { // the fuse twig, burning down
    const f = clamp(FUSE, 0.12, 1), tx = (0.03 + 0.2 * f) * s, ty = (-0.5 - 0.26 * f) * s, fl = 0.8 + 0.3 * Math.sin(t * 40) * Math.sin(t * 17);
    ctx.beginPath(); ctx.moveTo(0.02 * s, -0.46 * s); ctx.quadraticCurveTo(0.03 * s, (-0.5 - 0.22 * f) * s, tx, ty); two(ctx, s * 0.085, '#1a1210', s * 0.05, '#a2805a');
    ctx.fillStyle = 'rgba(255,110,30,0.4)'; ctx.beginPath(); ctx.arc(tx, ty, s * 0.15 * fl, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.arc(tx, ty, s * 0.085 * fl, 0, TAU); ctx.fill(); ctx.fillStyle = '#fffbe0'; ctx.beginPath(); ctx.arc(tx, ty, s * 0.04, 0, TAU); ctx.fill();
    ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = t * 9 + i * 1.57; ctx.moveTo(tx + Math.cos(a) * 0.07 * s, ty + Math.sin(a) * 0.07 * s); ctx.lineTo(tx + Math.cos(a) * 0.17 * s * fl, ty + Math.sin(a) * 0.17 * s * fl); }
    ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1, s * 0.022); ctx.strokeStyle = '#ffe27a'; ctx.stroke();
  } else if (id === 'tornado') { // head feathers swept into a swirl
    const cx = (-0.06 - tr * 0.12) * s, cy = -0.66 * s;
    ctx.beginPath(); ctx.moveTo(0.02 * s, -0.44 * s);
    for (let i = 24; i >= 0; i--) { const u = i / 24, a = 1.2 + u * TAU * 1.15 + sw * 0.12, r = (0.035 + u * 0.19) * s; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.85); }
    two(ctx, s * 0.12, FR.line, s * 0.085, FR.base);
    ctx.beginPath(); for (let i = 20; i >= 4; i--) { const u = i / 24, a = 1.2 + u * TAU * 1.15 + sw * 0.12, r = (0.035 + u * 0.19) * s - s * 0.018; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.85; if (i === 20) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.lineWidth = s * 0.025; ctx.strokeStyle = FR.hi; ctx.stroke();
  } else if (id === 'glue') { // a blob of goo sat on top
    const w = Math.sin(t * 5) * 0.02;
    ctx.beginPath(); ctx.ellipse(0.02 * s, -0.5 * s, (0.2 + w) * s, (0.11 - w) * s, 0, 0, TAU); ctx.fillStyle = FR.goo; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = FR.gooLine; ctx.stroke();
    ctx.beginPath(); ctx.arc((0.05 + w) * s, -0.66 * s, 0.055 * s, 0, TAU); ctx.fill(); ctx.stroke();
  }
}
// painted on the shell (clipped to it)
function helmInner(c, id, s, t, lw) {
  if (id === 'thunder') { // scorched, a zigzag crack that glows
    c.fillStyle = 'rgba(52,36,22,0.6)'; poly(c, [[-0.5, -0.3], [-0.36, -0.22], [-0.29, -0.33], [-0.19, -0.25], [-0.1, -0.37], [0.02, -0.29], [0.11, -0.4], [0.22, -0.33], [0.3, -0.42], [0.5, -0.4], [0.5, -0.6], [-0.5, -0.6]], s); c.fill();
    poly(c, [[-0.02, -0.52], [0.08, -0.36], [-0.03, -0.27], [0.11, -0.15], [0.03, -0.07], [0.13, 0.06]], s); two(c, s * (0.075 + 0.02 * Math.sin(t * 9)), '#ff9a1a', s * 0.03, '#fff6b0');
  } else if (id === 'bomb') { // a blackened casing: one hard glint, a seam
    c.fillStyle = 'rgba(255,255,255,0.32)'; c.beginPath(); c.ellipse(-0.23 * s, -0.3 * s, 0.11 * s, 0.045 * s, -0.75, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(-0.5 * s, -0.1 * s); c.quadraticCurveTo(0, -0.02 * s, 0.5 * s, -0.12 * s); c.lineWidth = s * 0.09; c.strokeStyle = '#ffcf3a'; c.stroke(); c.lineWidth = s * 0.03; c.strokeStyle = '#fff3b0'; c.stroke(); // a yellow band round the firecracker casing
  } else if (id === 'decoy') { // painted like an egg: speckles, one hairline crack
    c.fillStyle = '#c9a468'; for (const [x, y, r] of [[-0.3, -0.3, 0.035], [0.08, -0.38, 0.028], [0.32, -0.26, 0.03], [-0.12, -0.2, 0.02], [0.2, -0.16, 0.022], [-0.36, -0.1, 0.02], [0.38, -0.06, 0.018], [-0.02, -0.44, 0.016]]) { c.beginPath(); c.arc(x * s, y * s, r * s, 0, TAU); c.fill(); }
    poly(c, [[-0.2, -0.5], [-0.16, -0.4], [-0.22, -0.34], [-0.17, -0.27]], s); c.lineWidth = lw; c.strokeStyle = FR.shellLine; c.stroke();
  } else if (id === 'tornado') { // a spiral crack
    c.beginPath(); for (let i = 0; i <= 26; i++) { const u = i / 26, a = u * TAU * 1.6 + 0.6, r = (0.02 + u * 0.2) * s, x = 0.06 * s + Math.cos(a) * r, y = -0.2 * s + Math.sin(a) * r * 0.8; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
    c.lineCap = 'round'; c.lineWidth = Math.max(1, s * 0.022); c.strokeStyle = FR.shellLine; c.stroke();
    c.fillStyle = FR.shellLo; for (const [x, y, r] of [[-0.3, -0.12, 0.02], [0.33, -0.28, 0.018]]) { c.beginPath(); c.arc(x * s, y * s, r * s, 0, TAU); c.fill(); }
  } else if (id === 'glue') { // goo running down from the top
    for (const [oy, col] of [[0.025, FR.gooLo], [0, FR.goo]]) { c.fillStyle = col; c.fillRect(-0.6 * s, -0.7 * s, 1.2 * s, (0.44 + oy) * s); for (const [x, d] of [[-0.36, 0.1], [-0.2, 0.02], [-0.04, 0.14], [0.13, 0.04], [0.28, 0.11], [0.42, 0.0]]) { c.beginPath(); c.ellipse(x * s, (-0.27 + oy + d * 0.5) * s, 0.085 * s, (0.08 + d) * s, 0, 0, TAU); c.fill(); } }
    c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.ellipse(-0.22 * s, -0.37 * s, 0.08 * s, 0.03 * s, -0.6, 0, TAU); c.fill();
  }
}
// in front of the shell: what hangs off it or jumps across it
function helmRim(ctx, id, s, t, tr, sw, lw) {
  if (id === 'thunder') { // static jumps between the two prongs
    const q = Math.floor(t * 16);
    if (q % 4 !== 3) { const R = rnd(q * 7 + 3), [, , ax, ay] = PRONG[0], [, , bx, by] = PRONG[1]; ctx.beginPath(); ctx.moveTo(ax * s, ay * s); for (let i = 1; i < 5; i++) ctx.lineTo(lerp(ax, bx, i / 5) * s, (lerp(ay, by, i / 5) + (R() - 0.5) * 0.2) * s); ctx.lineTo(bx * s, by * s); two(ctx, s * 0.06, '#ffc61a', s * 0.024, '#fffbe0'); }
    ctx.fillStyle = '#fffbe0'; for (const [, , x, y] of PRONG) { ctx.beginPath(); ctx.arc(x * s, y * s, s * 0.035, 0, TAU); ctx.fill(); }
  } else if (id === 'bomb') { // the fuse's collar
    ctx.beginPath(); ctx.ellipse(0.02 * s, -0.48 * s, 0.1 * s, 0.045 * s, 0, 0, TAU); ctx.fillStyle = '#8d858b'; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = FR.shellLine; ctx.stroke();
  } else if (id === 'glue') { // strands dripping off the rim
    for (const [x, len, ph] of [[-0.4, 0.2, 0], [-0.27, 0.1, 2], [0.43, 0.26, 4]]) { const L = len * (1 + 0.25 * Math.sin(t * 2.4 + ph)), ex = (x - tr * 0.08 + sw * 0.01) * s, ey = (0.02 + L) * s; ctx.beginPath(); ctx.moveTo(x * s, 0); ctx.lineTo(ex, ey); two(ctx, s * 0.075, FR.gooLine, s * 0.05, FR.goo); ctx.beginPath(); ctx.arc(ex, ey, s * 0.045, 0, TAU); ctx.fillStyle = FR.goo; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = FR.gooLine; ctx.stroke(); }
  }
}
// the face of the other five: the decoy peeks through eye-holes in a nearly whole shell, the twister's eyes roll, one of the
// sticky chick's is half glued shut
function castFace(ctx, s, t, M, lk, bl, lw, tr, sw, e0, e1, o) {
  const id = CID, calm = M === MOODS.idle; let l0 = lk, l1 = lk, M1 = M;
  if (id === 'decoy') {
    frHelmet(ctx, s, t, M, tr, sw, lw);
    ctx.fillStyle = '#3b2812'; for (const E of [e0, e1]) { ctx.beginPath(); ctx.ellipse(E.cx, E.cy, E.rx * 1.22, E.ry * 1.16, 0, 0, TAU); ctx.fill(); }
    if (calm) l0 = l1 = { x: Math.sin(t * 2.4) > 0 ? 0.95 : -0.95, y: 0.15 }; // shifty
  }
  if (id === 'tornado' && calm) { l0 = { x: Math.cos(t * 5), y: Math.sin(t * 5) }; l1 = { x: Math.cos(t * 5 + 2.4), y: Math.sin(t * 5 + 2.4) }; } // dizzy
  if (id === 'glue' && !M.shut) M1 = { ...M, lid: Math.max(M.lid, 0.64), cock: 0 };
  frEye(ctx, s, e0, M, l0, bl, lw); frEye(ctx, s, e1, M1, l1, bl, lw);
  if (id === 'glue') { ctx.beginPath(); ctx.moveTo(e1.cx - e1.rx * 0.45, e1.cy - e1.ry * 1.05); ctx.quadraticCurveTo(e1.cx - e1.rx * 0.6, e1.cy, e1.cx - e1.rx * 0.25, e1.cy + e1.ry * 0.95); two(ctx, s * 0.07, FR.gooLine, s * 0.045, FR.goo); }
  frBeak(ctx, s, M, lw);
  if (id !== 'decoy') frHelmet(ctx, s, t, M, tr, sw, lw);
}
// the wake behind each of the five in flight (the Frost Chick's is iceWake)
const WAKE = {
  thunder: { chip: 'star', c1: '#fffbe0', c2: '#ffd23a' },
  bomb: { rib: ['#ff7a1a', '#ffe08a', 0.3], puff: '#352d30', pa: 0.5, chip: 'ember', c1: '#ffe27a', c2: '#ff5a1a' },
  decoy: { puff: '#fff6e2', pa: 0.55, chip: 'feather', c1: '#fff6e2', c2: '#dcc08a' },
  tornado: { puff: '#dcfff4', pa: 0.25, chip: 'feather', c1: '#eafffa', c2: '#58dcc4' },
  glue: { rib: ['#3fb83a', '#a8ff86', 0.62], chip: 'drop', c1: '#8cf56a', c2: '#3fb83a' },
};
function castWake(ctx, id, a, tgt, ue, k, S, t) {
  const W = WAKE[id]; if (!W) return;
  const fade = clamp((1.34 - ue) / 0.2, 0, 1), N = 14, u1 = Math.min(1, ue), len = W.rib ? W.rib[2] : 0.4, u0 = Math.max(0, ue - len);
  const at = (u) => { const p = arcAt(a, tgt, u), q = arcAt(a, tgt, u + 0.01), dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1; return [p.x, p.y, -dy / l, dx / l]; };
  if (u1 - u0 > 0.01 && fade > 0) {
    if (W.rib) for (const [kk, col, al] of [[1, W.rib[0], 0.75], [0.4, W.rib[1], 0.9]]) { // a tapered ribbon (flame / a rope of goo)
      ctx.beginPath();
      for (let j = 0; j <= N; j++) { const f = j / N, [x, y, nx, ny] = at(lerp(u0, u1, f)), w = (S * 0.3 * (id === 'glue' ? 0.35 + 0.65 * f * f : f) * kk) / k; if (j) ctx.lineTo(x + nx * w, y + ny * w); else ctx.moveTo(x + nx * w, y + ny * w); }
      for (let j = N; j >= 0; j--) { const f = j / N, [x, y, nx, ny] = at(lerp(u0, u1, f)), w = (S * 0.3 * (id === 'glue' ? 0.35 + 0.65 * f * f : f) * kk) / k; ctx.lineTo(x - nx * w, y - ny * w); }
      ctx.closePath(); ctx.globalAlpha = al * fade; ctx.fillStyle = col; ctx.fill();
    }
    if (id === 'thunder') { // a crackling bolt down the path
      const R = rnd(Math.floor(t * 24) + 11); ctx.globalAlpha = fade; ctx.beginPath();
      for (let j = 0; j <= 9; j++) { const f = j / 9, [x, y, nx, ny] = at(lerp(u0, u1, f)), o2 = j && j < 9 ? ((R() - 0.5) * S * 0.7) / k : 0; if (j) ctx.lineTo(x + nx * o2, y + ny * o2); else ctx.moveTo(x, y); }
      boltStroke(ctx, Math.max(0.03, 2.4 / k), 1);
    }
    if (id === 'tornado') for (const [ph, col, lw] of [[0, '#2fb89e', 3.2], [Math.PI, '#eafffa', 2.2]]) { // two strands wound round the path
      ctx.beginPath(); for (let j = 0; j <= 30; j++) { const f = j / 30, [x, y, nx, ny] = at(lerp(u0, u1, f)), w = (Math.sin(f * 16 - t * 22 + ph) * S * 0.42 * (0.25 + 0.75 * f)) / k; if (j) ctx.lineTo(x + nx * w, y + ny * w); else ctx.moveTo(x + nx * w, y + ny * w); }
      ctx.globalAlpha = 0.85 * fade; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = lw / k; ctx.strokeStyle = col; ctx.stroke();
    }
  }
  for (let i = 0; i < 9; i++) { // puffs and bits, each born as the chick passes its point on the arc
    const ub = 0.06 + i * 0.105, age = (ue - ub) * FLIGHT.fly; if (age <= 0) continue;
    const [x, y, nx, ny] = at(ub), sd = i % 2 ? 1 : -1, m = clamp(age / 0.5, 0, 1), c = clamp(age / 0.4, 0, 1);
    if (W.puff && m < 1) { ctx.globalAlpha = W.pa * (1 - m); ctx.fillStyle = W.puff; ctx.beginPath(); ctx.arc(x + sd * 0.05, y + age * 0.3, (S * (0.16 + m * 0.34)) / k, 0, TAU); ctx.fill(); }
    if (c >= 1) continue;
    const g = W.chip === 'drop' ? 9 : W.chip === 'feather' ? 1.5 : 4, sp = W.chip === 'drop' ? 0.5 : 1.6, r = S * (0.09 + hash(i) * 0.06) * (1 - c * 0.4);
    px(ctx, x + nx * sd * age * sp + ny * age * 0.5, y + ny * sd * age * sp - nx * age * 0.5 - age * age * g, k, () => {
      ctx.globalAlpha = 1 - c * c; ctx.rotate(W.chip === 'drop' ? 0 : i * 1.3 + age * (W.chip === 'feather' ? 5 : 13) * sd);
      ctx.beginPath();
      if (W.chip === 'star') { ctx.moveTo(0, -r * 1.3); ctx.quadraticCurveTo(0, 0, r * 1.3, 0); ctx.quadraticCurveTo(0, 0, 0, r * 1.3); ctx.quadraticCurveTo(0, 0, -r * 1.3, 0); ctx.quadraticCurveTo(0, 0, 0, -r * 1.3); }
      else if (W.chip === 'feather') ctx.ellipse(0, 0, r * 1.2, r * 0.45, 0, 0, TAU);
      else ctx.arc(0, 0, r * 0.7, 0, TAU);
      ctx.fillStyle = W.c2; ctx.fill();
      ctx.beginPath(); if (W.chip === 'feather') ctx.ellipse(-r * 0.1, -r * 0.1, r * 0.9, r * 0.22, 0, 0, TAU); else ctx.arc(-r * 0.12, -r * 0.12, r * 0.36, 0, TAU); ctx.fillStyle = W.c1; ctx.fill();
    });
  }
  ctx.globalAlpha = 1;
}

// o: see the rig (frostChick), plus rot, flip, shadow
export function drawStrikeChick(ctx, id, x, y, s, t, o = {}) {
  ctx.save();
  ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  if (o.flip) ctx.scale(-1, 1);
  CID = CAST[id] ? id : 'freeze'; FR = CAST[CID];
  frostChick(ctx, s, t, o);
  ctx.restore();
}

// ---------------------------------------------------------------- world: the rider, the flight, the effects
function px(ctx, x, y, k, draw) { ctx.save(); ctx.translate(x, y); ctx.scale(1 / k, -1 / k); draw(); ctx.restore(); }
function zig(ctx, x0, y0, x1, y1, n, amp, R) {
  ctx.beginPath(); ctx.moveTo(x0, y0);
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  for (let i = 1; i < n; i++) { const f = i / n, o = (R() - 0.5) * 2 * amp; ctx.lineTo(x0 + dx * f + nx * o, y0 + dy * f + ny * o); }
  ctx.lineTo(x1, y1);
}
const rnd = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

// where the chick rides (world, y up): on the hen's back. hen = { x, y (her feet), s (her height, m), gy }
export function strikeSeat(hen) { return { x: hen.x + 0.16 * hen.s, y: hen.y + (0.86 * hen.s) * (hen.gy || 1) }; }
function nestSpot(hen) { return { x: hen.x - 0.42 * hen.s, y: hen.y + 0.14 * (hen.gy || 1) }; }
// the arc of the flight at u (0..1)
function arcAt(a, b, u) {
  const d = Math.hypot(b.x - a.x, b.y - a.y), h = 0.35 * d + 0.6;
  return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) + h * 4 * u * (1 - u) };
}

// ---------------------------------------------------------------- the chick in the world (rider, hop, flight, the beat after)
const FROST_H = 0.44; // riding, the chick (feet to helmet top) stands this fraction of the hen's height: clearly her small chick
const POST = { sim: null, was: false, t0: -99, a: null, tgt: null, ang: 0 };
// the icy wake: a serrated ribbon of cold along the arc, chips of ice thrown off it, mist that hangs. ue may run past 1.
function iceWake(ctx, a, tgt, ue, k, S) {
  const N = 14, u1 = Math.min(1, ue), u0 = Math.max(0, ue - 0.34);
  if (u1 - u0 > 0.01) {
    const L = [], Rr = [];
    for (let j = 0; j <= N; j++) {
      const f = j / N, u = lerp(u0, u1, f), p = arcAt(a, tgt, u), q = arcAt(a, tgt, u + 0.01), dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1;
      const w = (S * 0.36 * f * (j % 2 ? 1 : 0.62)) / k;
      L.push([p.x - (dy / l) * w, p.y + (dx / l) * w]); Rr.push([p.x + (dy / l) * w, p.y - (dx / l) * w]);
    }
    for (const [kk, col, al] of [[1, '#9fdcff', 0.5], [0.45, '#ffffff', 0.85]]) {
      ctx.beginPath(); const p0 = arcAt(a, tgt, u0); ctx.moveTo(p0.x, p0.y);
      for (let j = 1; j <= N; j++) { const p = arcAt(a, tgt, lerp(u0, u1, j / N)); ctx.lineTo(lerp(p.x, L[j][0], kk), lerp(p.y, L[j][1], kk)); }
      for (let j = N; j >= 1; j--) { const p = arcAt(a, tgt, lerp(u0, u1, j / N)); ctx.lineTo(lerp(p.x, Rr[j][0], kk), lerp(p.y, Rr[j][1], kk)); }
      ctx.closePath(); ctx.globalAlpha = al * clamp((1.34 - ue) / 0.2, 0, 1); ctx.fillStyle = col; ctx.fill();
    }
  }
  for (let i = 0; i < 9; i++) { // mist puffs and ice chips, each born as the chick passes its point on the arc
    const ub = 0.06 + i * 0.105, age = (ue - ub) * FLIGHT.fly; if (age <= 0) continue;
    const p = arcAt(a, tgt, ub), q = arcAt(a, tgt, ub + 0.01), dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1, sd = i % 2 ? 1 : -1;
    const m = clamp(age / 0.45, 0, 1);
    if (m < 1) { ctx.globalAlpha = 0.42 * (1 - m); ctx.fillStyle = '#e8f8ff'; ctx.beginPath(); ctx.arc(p.x + sd * 0.05, p.y + age * 0.25, (S * (0.16 + m * 0.3)) / k, 0, TAU); ctx.fill(); }
    const c = clamp(age / 0.38, 0, 1);
    if (c < 1) {
      const cx = p.x - (dy / l) * sd * age * 1.7 - (dx / l) * age * 0.6, cy = p.y + (dx / l) * sd * age * 1.7 - age * age * 5, r = S * (0.1 + hash(i) * 0.07) * (1 - c * 0.5);
      px(ctx, cx, cy, k, () => { ctx.rotate(i * 1.3 + age * 14 * sd); ctx.globalAlpha = 1 - c * c; ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.5, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.5, 0); ctx.closePath(); ctx.fillStyle = '#f4fcff'; ctx.fill(); ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.5, 0); ctx.lineTo(0, r); ctx.closePath(); ctx.fillStyle = '#8ccdf4'; ctx.fill(); });
    }
  }
  ctx.globalAlpha = 1;
}
function frostWorld(ctx, sim, K, k, t, hen, S, id) {
  const wake = (a, tg, ue) => (id === 'freeze' ? iceWake(ctx, a, tg, ue, k, S) : castWake(ctx, id, a, tg, ue, k, S, t));
  FUSE = 1;
  const gy = hen.gy || 1, s0 = strikeSeat(hen), seat = { x: s0.x + 0.05 * hen.s, y: s0.y - 0.21 * hen.s * gy }, F = K.fly, R = clamp((hen.s * k * FROST_H) / 1.38, 15, S), B = R * 1.3; S = B * 0.85; // R: riding body height (px), B: in flight
  const up = (s) => (s * 0.47 / k) * gy; // body centre above the spot its feet stand on
  if (POST.sim !== sim) { POST.sim = sim; POST.was = false; POST.t0 = -99; }
  const at = (x, y, draw) => px(ctx, x, y, k, () => { if (globalThis.__stkDbg) { const m = ctx.getTransform(); globalThis.__stkDbg.x = m.e; globalThis.__stkDbg.y = m.f; } draw(); }); // (QA strips follow the chick)
  const chick = (x, y, s, o) => at(x, y, () => drawStrikeChick(ctx, id, 0, 0, s, t, o));
  if (!F) {
    if (POST.was) { POST.was = false; POST.t0 = id === 'decoy' ? -99 : t; } // the decoy stays out there, posing as an egg
    if (id === 'decoy' && sim.p2d && sim.p2d.alive && sim.p2.decoy && sim.p2.decoy.stk) return;
    const tau = t - POST.t0;
    if (tau >= 0 && tau < 2.6 && POST.tgt) { // the beat after the hit: smack, recoil in a backflip to her back, land, gloat
      const tg = POST.tgt, dir = Math.cos(POST.ang) < 0 ? -1 : 1;
      ctx.save(); wake(POST.a, tg, 1 + tau / FLIGHT.fly); ctx.restore();
      if (tau < 0.1) { // flat against it
        at(tg.x - Math.cos(POST.ang) * 0.12, tg.y - Math.sin(POST.ang) * 0.12, () => { ctx.rotate(-POST.ang); if (dir < 0) ctx.scale(1, -1); drawStrikeChick(ctx, id, 0, 0, B, t, { mood: 'hit', stretch: -0.32, feet: false, wing: 0.7, trail: -1, fog: false }); });
      } else if (tau < 0.78) {
        const v = (tau - 0.1) / 0.68, e = 1 - Math.pow(1 - v, 1.6), to = { x: seat.x, y: seat.y + up(R) }, p = { x: lerp(tg.x, to.x, e), y: lerp(tg.y, to.y, e) + (0.9 + 0.12 * Math.abs(tg.y - to.y)) * 4 * e * (1 - e) * gy };
        at(p.x, p.y, () => { ctx.rotate(dir * TAU * ss(0, 0.9, v)); drawStrikeChick(ctx, id, 0, 0, lerp(B, R, e), t, { flip: v > 0.5 ? true : dir < 0, mood: ['hit', 'smug', ss(0.3, 0.8, v)], squash: 0.12, feet: false, wing: v > 0.75 ? 0.8 : 0.1, trail: -0.5 * (1 - v), fog: false }); });
      } else {
        const v = tau - 0.78, sq = 0.5 * Math.exp(-7 * v) * Math.cos(v * 15), out = ss(2.1, 2.6, tau);
        chick(seat.x, seat.y + up(R), R, { flip: true, mood: ['smug', 'idle', out], squash: sq, wing: 0, trail: -0.6 * Math.exp(-6 * v) * Math.cos(v * 13), look: { x: -0.5, y: 0.25 }, blink: 0, fog: v > 0.25 && v < 1.15 ? (v - 0.25) / 0.9 : false, rot: Math.sin(v * 3.2) * 0.07 * (1 - out) });
      }
      return;
    }
    // riding: cocky and bored on her back (breathing, a slow look around); full: up on its toes, bouncing, raring to go
    const full = K.m >= 1;
    if (full) { const h = Math.abs(Math.sin(t * 6.5)), land = 1 - h; chick(seat.x, seat.y + up(R) + (h * R * 0.14 / k) * gy, R, { flip: true, mood: 'ready', squash: land > 0.8 ? (land - 0.8) * 1.6 : -0.1 * h, wing: 0.55 + 0.45 * Math.sin(t * 26), trail: 0.25 - h * 0.5, look: { x: 0.7, y: -0.3 }, fog: false }); }
    else chick(seat.x, seat.y + up(R), R, { flip: true, mood: 'idle', squash: Math.sin(t * 2.3) * 0.035, rot: Math.sin(t * 0.9) * 0.035, look: { x: Math.sin(t * 0.7) > 0.55 ? -0.7 : 0.6, y: -0.1 } });
    return;
  }
  const tgt = (F.key === 'bx' && geckoAnchor(sim)) || { x: F.tx, y: F.ty }, sp = nestSpot(hen), a = { x: sp.x, y: sp.y + up(B) };
  FUSE = F.ph === 'hop' ? 1 - 0.55 * clamp(F.t / FLIGHT.hop, 0, 1) : 0.45 - 0.4 * clamp(F.t / FLIGHT.fly, 0, 1); // the Boom Chick's fuse burns down
  if (F.ph === 'hop') { // anticipation crouch on her back, hop down by the nest, land in a deep squash, coil
    const u = clamp(F.t / FLIGHT.hop, 0, 1), left = tgt.x < sp.x;
    if (u < 0.3) { const v = u / 0.3; chick(seat.x, seat.y + up(R), R, { flip: true, mood: ['idle', 'crouch', v * 2], squash: ss(0, 1, v) * 0.55, trail: -0.5 * v, wing: 0.15, look: { x: 1, y: 0.2 }, fog: false }); }
    else if (u < 0.72) { const v = (u - 0.3) / 0.42, s = lerp(R, B, v); chick(lerp(seat.x, sp.x, v), lerp(seat.y + up(R), a.y, v) + 0.55 * 4 * v * (1 - v) * gy, s, { flip: v < 0.5 ? true : left, rot: (left ? 1 : -1) * 0.35 * Math.sin(v * Math.PI), mood: 'ready', squash: -0.38 * Math.sin(v * Math.PI), wing: 1, trail: 0.7, feet: false, look: { x: 0.6, y: 0.6 }, fog: false }); }
    else { const v = (u - 0.72) / 0.28; chick(sp.x, a.y, B, { flip: left, shadow: true, mood: 'crouch', squash: 0.7 * Math.sin(Math.min(1, v * 1.7) * Math.PI * 0.5) * (1 - 0.3 * ss(0.6, 1, v)), trail: lerp(-0.8, 0.3, v), wing: 0.2 + 0.5 * v, look: { x: 1, y: -0.6 }, fog: false }); }
    return;
  }
  // the flight: launch stretched, tuck into one fast spin, snap open into a screaming dive, the crest and tail streaming
  const u = clamp(F.t / FLIGHT.fly, 0, 1), ue = Math.pow(u, 1.15), p = arcAt(a, tgt, ue), q = arcAt(a, tgt, Math.min(1, ue + 0.02));
  const ang = Math.atan2(q.y - p.y, q.x - p.x), dir = Math.cos(ang) < 0 ? -1 : 1, spin = ss(0.16, 0.6, u), tuck = Math.sin(spin * Math.PI);
  POST.was = true; POST.a = a; POST.tgt = tgt; POST.ang = ang;
  ctx.save(); wake(a, tgt, ue); ctx.restore();
  at(p.x, p.y, () => {
    ctx.rotate(-ang); if (dir < 0) ctx.scale(1, -1);
    ctx.rotate(-TAU * spin);
    drawStrikeChick(ctx, id, 0, 0, B * 1.05, t, { mood: tuck > 0.5 ? 'crouch' : 'yell', stretch: lerp(0.24, -0.06, tuck), feet: false, wing: 1 - tuck * 0.9, trail: lerp(1, 0.35, tuck), look: { x: 1, y: 0 }, fog: false });
  });
}

export function drawStrikeWorld(ctx, sim, k, t, hen) {
  const K = sim.stk;
  if (!K || !K.id) return;
  const cs = Math.min(0.95, Math.max(0.6, 40 / k)), S = cs * k; // the chick: 0.6 m, never under ~40 px (it must read on a phone)
  // glue patches (under everything else here)
  for (const P of K.glue) drawGoo(ctx, P, k, t);
  // tornado funnels, thunder chains
  const done = drawHitFx(ctx, sim, k, t, S, (id, x, y, s, o) => drawStrikeChick(ctx, id, x, y, s, t, o)); // the villain's reaction props (strikehit.js)
  const gk = geckoAnchor(sim);
  for (let E of K.fx) {
    if (gk && E.key === 'bx') E = { ...E, x: gk.x, y: gk.y }; // L15: the boss is the gecko on the ring
    if (done.has(E.key)) { if (E.k === 'thunder') drawChain(ctx, E, k, t); continue; }
    if (E.k === 'tornado') drawTwister(ctx, E, k, t);
    else if (E.k === 'thunder') drawChain(ctx, E, k, t);
    else if (E.k === 'freeze') drawFrost(ctx, E, k, t);
  }
  // goo on held eggs
  for (const id in K.held) {
    const H = K.held[id];
    if (H.cd > 0) continue;
    px(ctx, H.x, H.y, k, () => gooStrands(ctx, 0.3 * k, t, H.t));
  }
  // the decoy chick sits where the decoy egg is
  const D = sim.p2d;
  if (D && D.alive && sim.p2.decoy && sim.p2.decoy.stk) {
    const p = D.body.getPosition(), dc = sim.p2.decoy, blink = dc.t < 1.5 && Math.sin(t * 22) < -0.2;
    px(ctx, p.x, p.y, k, () => { ctx.globalAlpha = blink ? 0.5 : 1; ctx.rotate(-D.body.getAngle() * 0.6); drawStrikeChick(ctx, 'decoy', 0, S * 0.1, S * 0.5, t, { feet: false, wing: 0, squash: Math.sin(t * 3) * 0.05 }); });
  }
  // rage: the fooled creatures fume
  if (K.rage > 0) for (const T of sim.stkTargets()) px(ctx, T.x, T.y + 0.45, k, () => rageMark(ctx, S * 0.5, t + T.x));
  if (!hen || !K.on) return;
  frostWorld(ctx, sim, K, k, t, hen, S, K.fly ? K.fly.id : K.id);
}

function drawGoo(ctx, P, k, t) {
  const a = Math.min(1, P.t / 0.6, (P.max - P.t) / 0.25 + 0.3), r = P.r;
  ctx.save(); ctx.globalAlpha *= a;
  ctx.beginPath();
  for (let i = 0; i <= 16; i++) { const an = (i / 16) * TAU, w = r * (0.85 + 0.15 * Math.sin(an * 3 + t * 2) + 0.08 * Math.sin(an * 5 - t)); if (i) ctx.lineTo(P.x + Math.cos(an) * w, P.y + Math.sin(an) * w * 0.8); else ctx.moveTo(P.x + Math.cos(an) * w, P.y + Math.sin(an) * w * 0.8); }
  ctx.closePath();
  ctx.fillStyle = 'rgba(168,104,236,0.72)'; ctx.fill();
  ctx.lineWidth = 1.6 / k; ctx.strokeStyle = '#5a2a92'; ctx.stroke();
  ctx.fillStyle = 'rgba(236,214,255,0.8)'; ctx.beginPath(); ctx.ellipse(P.x - r * 0.3, P.y + r * 0.25, r * 0.22, r * 0.09, 0.3, 0, TAU); ctx.fill();
  for (let i = 0; i < 3; i++) { const u = (t * 0.7 + i / 3) % 1, bx = P.x + (hash(i + 3) - 0.5) * r, by = P.y + (hash(i + 7) - 0.5) * r * 0.6; ctx.globalAlpha = a * Math.sin(u * Math.PI) * 0.9; ctx.beginPath(); ctx.arc(bx, by, r * 0.07 * (0.5 + u), 0, TAU); ctx.strokeStyle = '#f0dcff'; ctx.lineWidth = 1.2 / k; ctx.stroke(); }
  ctx.restore();
}
function gooStrands(ctx, s, t, left) {
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * s * 0.28, sag = s * (0.35 + 0.12 * Math.sin(t * 3 + i));
    ctx.beginPath(); ctx.moveTo(x, -s * 0.3); ctx.quadraticCurveTo(x + s * 0.08, sag * 0.4, x - s * 0.02, sag);
    ctx.strokeStyle = '#7a3fc0'; ctx.lineWidth = s * 0.12; ctx.stroke(); ctx.strokeStyle = '#d4a8ff'; ctx.lineWidth = s * 0.06; ctx.stroke();
    ctx.fillStyle = '#c08af6'; ctx.beginPath(); ctx.arc(x - s * 0.02, sag, s * 0.07, 0, TAU); ctx.fill();
  }
  if (left < 0.6) { ctx.globalAlpha = 0.8; ctx.fillStyle = '#ecd6ff'; ctx.beginPath(); ctx.arc(0, -s * 0.5, s * 0.08 * (1 + Math.sin(t * 20)), 0, TAU); ctx.fill(); }
  ctx.restore();
}
function rageMark(ctx, s, t) { // a throbbing anger vein
  const p = 1 + 0.18 * Math.max(0, Math.sin(t * 12));
  ctx.save(); ctx.scale(p, p); ctx.lineCap = 'round'; ctx.strokeStyle = '#e8302a'; ctx.lineWidth = s * 0.14;
  for (const [a, b] of [[0, 1], [Math.PI / 2, 1], [Math.PI, 1], [-Math.PI / 2, 1]]) { const c = Math.cos(a), d = Math.sin(a); ctx.beginPath(); ctx.moveTo(c * s * 0.12 - d * s * 0.2, d * s * 0.12 + c * s * 0.2); ctx.quadraticCurveTo(c * s * 0.32 * b, d * s * 0.32 * b, c * s * 0.12 + d * s * 0.2, d * s * 0.12 - c * s * 0.2); ctx.stroke(); }
  ctx.restore();
}
function drawTwister(ctx, E, k, t) {
  const u = 1 - E.t / E.max, a = Math.min(1, E.t / 0.35, u / 0.12);
  ctx.save(); ctx.globalAlpha *= a; ctx.lineCap = 'round';
  const H = 1.9, x0 = E.x, y0 = E.y - 0.2;
  for (let i = 0; i < 9; i++) {
    const v = i / 8, y = y0 + v * H, w = 0.12 + v * v * 0.75, ph = t * 11 + i * 0.9;
    ctx.strokeStyle = i % 2 ? 'rgba(220,255,245,0.85)' : 'rgba(110,200,180,0.75)'; ctx.lineWidth = (2.6 + v * 2.5) / k;
    ctx.beginPath(); ctx.ellipse(x0 + Math.sin(t * 5 + v * 3) * 0.12 * v, y, w, w * 0.22, 0, ph % TAU, (ph % TAU) + 4.2); ctx.stroke();
  }
  for (let i = 0; i < 6; i++) { const v = (t * 1.6 + i / 6) % 1, an = t * 9 + i * 2.1, r = 0.15 + v * 0.7; ctx.fillStyle = '#5a8a6a'; ctx.globalAlpha = a * (1 - v); ctx.beginPath(); ctx.ellipse(x0 + Math.cos(an) * r, y0 + v * H, 0.05, 0.025, an, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function drawChain(ctx, E, k, t) {
  const f = E.t / E.max, R = rnd(Math.floor(t * 18) + 7), pts = E.pts || [{ x: E.x, y: E.y }];
  ctx.save(); ctx.globalAlpha *= Math.min(1, f * 1.6);
  zig(ctx, pts[0].x + (R() - 0.5) * 1.5, pts[0].y + 6, pts[0].x, pts[0].y, 10, 0.3, R); boltStroke(ctx, Math.max(0.03, 2.4 / k), 1);
  for (let i = 1; i < pts.length; i++) { zig(ctx, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, 7, 0.22, R); boltStroke(ctx, Math.max(0.022, 1.6 / k), 1); }
  ctx.restore();
}
function drawFrost(ctx, E, k, t) {
  const u = 1 - E.t / E.max; if (u > 0.25) return;
  const a = 1 - u / 0.25;
  ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = '#e6f8ff'; ctx.lineWidth = 2 / k; ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) { const an = (i / 8) * TAU + 0.3, r0 = 0.3 + u * 2, r1 = r0 + 0.35; ctx.beginPath(); ctx.moveTo(E.x + Math.cos(an) * r0, E.y + Math.sin(an) * r0); ctx.lineTo(E.x + Math.cos(an) * r1, E.y + Math.sin(an) * r1); ctx.stroke(); }
  ctx.restore();
}

// ---------------------------------------------------------------- events -> feel, SFX, VFX
// api: { audio, popup, once, sim, hitStop(s), punch(amt, x, y), slow(left, scale) }
export function strikeEvent(ev, fx, api) {
  const { audio, popup, once } = api;
  switch (ev.type) {
    case 'stkReady': audio.play('cluck', { pitch: 2.6, vol: 0.45 }); return true;
    case 'stkFire': api.slow(0.3, 0.4); audio.play('hen_hop', { pitch: 1.6, vol: 0.6 }); return true;
    case 'stkLaunch': {
      audio.play('cluck', { intensity: 1, pitch: 1.75 }); audio.play('wind_gust', { vol: 0.35, pitch: 2.2 });
      fx.whoosh(ev.x, ev.y, ev.tx - ev.x, ev.ty - ev.y);
      fx.dust(ev.x, ev.y - 0.1, 6);
      return true;
    }
    case 'stkHit': {
      const S = STRIKE[ev.id], col = S ? S.col : ['#fff', '#fff', '#fff'];
      if (ev.miss) { audio.play('bubble_pop', { pitch: 0.8 }); popup(ev.x, ev.y + 0.5, 'Missed!', { color: '#ffe0b0', size: 18 }); return true; }
      hitBegin(ev, POST.ang);
      api.hitStop(ev.boss ? 0.12 : 0.08); api.punch(ev.boss ? 0.09 : 0.06, ev.x, ev.y); fx.kick(ev.boss ? 0.55 : 0.4);
      fx.impact(ev.x, ev.y, 0.6, col[2]);
      if (ev.id === 'freeze') { audio.play('glass_crack', { pitch: 0.75 }); audio.play('glass_break', { vol: 0.5, pitch: 1.3 }); fx.wave(ev.x, ev.y, 1.4, '#dff6ff', 0.5, 0.14); fx.chips(ev.x, ev.y, '#cfefff', 12, 3); fx.sparkle(ev.x, ev.y, 10, '#ffffff'); }
      else if (ev.id === 'thunder') { audio.play('thunder', { vol: 0.8, pitch: 1.2 }); fx.flash = 0.35; fx.flashColor = '#fff6c0'; fx.sparkle(ev.x, ev.y, 14, '#fff27a'); }
      else if (ev.id === 'bomb') { audio.play('bomb_explode'); fx.explosion(ev.x, ev.y, 0.9); }
      else if (ev.id === 'decoy') { audio.play('hen_land', { pitch: 1.6 }); fx.dust(ev.x, ev.y, 8); }
      else if (ev.id === 'tornado') { audio.play('wind_gust', { vol: 0.9, pitch: 1.1 }); fx.wave(ev.x, ev.y, 1.1, '#dcfff4', 0.5, 0.12); }
      else if (ev.id === 'glue') { audio.play('squish', { intensity: 1, pitch: 0.7 }); fx.burst(ev.x, ev.y, 12, (i, a, b) => ({ x: ev.x, y: ev.y, vx: (a - 0.5) * 5, vy: b * 4, g: 9, life: 0.6 + b * 0.4, size: 0.05 + a * 0.05, color: i % 2 ? '#c08af6' : '#8a52cc', type: 'drop', floor: ev.y - 0.3 })); }
      if (ev.cancel) popup(ev.x, ev.y + 0.8, ev.hurt ? 'Interrupted! Hit!' : 'Interrupted!', { color: '#ffd76a', size: 22 });
      else popup(ev.x, ev.y + 1.45, { freeze: 'Frozen solid!', thunder: 'Thunderstruck!', bomb: 'Boom!', decoy: 'Peep?', tornado: 'Whirled away!', glue: 'Glued!' }[ev.id] || '', { color: col[2], size: 18 });
      return true;
    }
    case 'stkIcy': once('stkIcy', 'Frost Chick: the rings near it are icy for a while. Eggs slide!', 3); return true;
    case 'stkJolt': fx.sparkle(ev.x, ev.y, 5, '#fff27a'); once('stkJolt', 'Thunder Chick: eggs near the bolt got a jolt.', 2.6); return true;
    case 'stkShove': fx.dust(ev.x, ev.y, 3); return true;
    case 'stkBlast': if (ev.thorns) popup(ev.x, ev.y - 0.5, `${ev.thorns} thorn${ev.thorns > 1 ? 's' : ''} gone`, { color: '#ffc18a', size: 16 }); once('stkShove', 'Boom Chick: the shockwave shoves your eggs too.', 2.6); return true;
    case 'stkRage': hitRage(ev); audio.play('thorn_hit', { pitch: 0.6, vol: 0.6 }); popup(ev.x, ev.y + 0.6, 'They noticed!', { color: '#ff7a5a', size: 20 }); once('stkRage', 'Decoy Chick: the fooled creatures are furious and rush for a while.', 3); return true;
    case 'stkSpin': audio.play('wind_gust', { vol: 0.5, pitch: 1.5 }); once('stkSpin', 'Twister Chick: the nearest ring got spun round.', 2.6); return true;
    case 'stkStick': audio.play('squish', { pitch: 1.3, vol: 0.6 }); popup(ev.x, ev.y + 0.45, 'Stuck!', { color: '#d4a8ff', size: 15, life: 0.8 }); return true;
    case 'stkUnstick': audio.play('bubble_pop', { pitch: 1.2, vol: 0.5 }); return true;
  }
  return false;
}

// ---------------------------------------------------------------- the HUD button
// st: { id, m (0..1), busy, t, fullT (when it filled), wobT (last "not yet" tap), pressed, calm }
export function drawStrikeButton(ctx, x, y, d, st) {
  const id = st.id, col = STRIKE[id].col, full = st.m >= 1 && !st.busy, t = st.t, r = d / 2;
  let sc = 1, rot = 0;
  if (!st.calm) {
    if (full) { const p = ((t - (st.fullT || 0)) % 1.2 + 1.2) % 1.2; sc = 1 + 0.11 * Math.exp(-5 * p) * Math.sin(p * 17) * (p < 0.7 ? 1 : 0); }
    const w = t - (st.wobT ?? -9); if (w < 0.55) rot = 0.22 * Math.exp(-7 * w) * Math.sin(w * 34);
    if (st.pressed) sc *= 0.92;
  }
  const cx = x + r, cy = y + r;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(sc, sc);
  // drop shadow and the rim
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, r * 0.1, r * 0.98, r * 0.98, 0, 0, TAU); ctx.fill();
  const g = ctx.createLinearGradient(0, -r, 0, r); g.addColorStop(0, '#5a3c26'); g.addColorStop(1, '#2c1a10');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  // the well the chick sits in
  const ri = r * 0.74, g2 = ctx.createRadialGradient(-ri * 0.3, -ri * 0.4, ri * 0.1, 0, 0, ri);
  g2.addColorStop(0, full ? '#fff3c4' : '#e9dcc4'); g2.addColorStop(1, full ? '#f0b54a' : '#a88e70');
  ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(0, 0, ri, 0, TAU); ctx.fill();
  // the ring: a track, the charge clockwise from the top (gold when full)
  const rr = r * 0.87, lw = r * 0.17;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(20,10,4,0.55)'; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke();
  const m = clamp(st.m, 0, 1);
  if (m > 0.005) {
    ctx.strokeStyle = full ? '#ffcf3a' : col[0]; ctx.lineWidth = lw * 0.78;
    ctx.beginPath(); ctx.arc(0, 0, rr, -Math.PI / 2, -Math.PI / 2 + TAU * m); ctx.stroke();
    ctx.strokeStyle = full ? '#fff6c8' : col[2]; ctx.lineWidth = lw * 0.26; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.arc(0, 0, rr - lw * 0.12, -Math.PI / 2, -Math.PI / 2 + TAU * m); ctx.stroke(); ctx.globalAlpha = 1;
  }
  if (full && !st.calm) { // a glint travels round the gold ring
    const a = -Math.PI / 2 + ((t * 1.4) % 1) * TAU;
    ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, lw * 0.32, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  }
  // the chick
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, ri, 0, TAU); ctx.clip();
  if (st.busy) ctx.globalAlpha = 0.35;
  drawStrikeChick(ctx, id, -ri * 0.22, ri * 0.2 - (full && !st.calm ? Math.abs(Math.sin(t * 6.5)) * ri * 0.07 : 0), ri * 1.62, st.calm ? 0.4 : t, { feet: false, fog: false, mood: full ? 'ready' : 'idle', look: { x: 0.6, y: full ? -0.2 : 0.1 }, wing: 0, trail: full && !st.calm ? Math.sin(t * 6.5) * 0.2 : 0 }); // the face fills the well
  ctx.restore();
  if (!full && !st.busy) { // dim it a touch while it charges
    ctx.fillStyle = `rgba(30,18,8,${0.32 * (1 - m)})`; ctx.beginPath(); ctx.arc(0, 0, ri, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the intro picker and the unlock card
// a token: the chick in a little round frame; sel: the one equipped
export function drawStrikeToken(ctx, id, cx, cy, r, t, sel) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.arc(cx, cy + r * 0.08, r, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r);
  g.addColorStop(0, sel ? '#fff3c4' : '#f4e6cc'); g.addColorStop(1, sel ? '#f0b54a' : '#cdb48e');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  ctx.lineWidth = sel ? r * 0.14 : r * 0.07; ctx.strokeStyle = sel ? '#e8962a' : 'rgba(110,74,42,0.6)'; ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r * 0.94, 0, TAU); ctx.clip();
  drawStrikeChick(ctx, id, cx - r * 0.2, cy + r * 0.26, r * 1.45, sel ? t : 0.4, { feet: false, fog: false, mood: sel ? 'smug' : 'idle', squash: sel ? Math.sin(t * 6) * 0.03 : 0 });
  ctx.restore();
  ctx.restore();
}
export function drawStrikeStage(ctx, id, x, y, w, h, t) {
  const s = h * 0.82, u = (t % 1.6) / 1.6, hop = Math.max(0, Math.sin(u * TAU)) * h * 0.08, sq = u > 0.5 ? 0.25 * Math.exp(-(u - 0.5) * 18) : -0.1 * Math.sin(u * TAU);
  contact(ctx, x + w / 2, y + h * 0.9, s * 0.3, s * 0.05, 0.3);
  const f = s * 0.6; drawStrikeChick(ctx, id, x + w / 2 - f * 0.05, y + h * 0.9 - f * 0.56 - hop, f, t, { squash: sq, wing: hop > 2 ? 0.9 : 0, mood: hop > 2 ? 'ready' : 'smug', trail: hop > 2 ? 0.5 : -sq, look: { x: 0.3, y: 0.2 } });
}
export { STRIKES };
