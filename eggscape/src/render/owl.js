// The Clockwork Owl (v4, sim/owl.js): the L50 boss, a brass mechanical owl in the house style (dark ink outline, base
// colour + one shade band + one light band, no pale halos). Drawn in a local y-DOWN pixel space at real scale.
// Poses: idle (hover, slow wingbeat, gear turning in its chest window), swoop telegraph (wings raised, red glare), swoop (dive,
// wings swept back, talons out), wind (key spinning fast, wings out), drop (belly hatch open), hit (egg saved: recoil),
// jammed (sparks, a sprung cog, X eyes), stunned (slack, spiral eyes, stars), frozen (render/status.js), broken down.
// Also: its gear bombs, the boss card, the boss-bar emblem and the gear-pip bar.
import { TAU } from '../sim/geom.js';
import { OWL } from '../sim/owl.js';
import { statusClock, statusDraw, statusKind, dizzyStars, spiralEye } from './status.js';
import { bossPip } from './boss.js';
import { clamp, form, spline, blinkAt } from './castkit.js';

const INK = '#1c1108';
const BRASS = { base: '#c99a40', light: '#f4d384', dark: '#7d5420' };
const COPPER = { base: '#c46a3a', light: '#eda070', dark: '#6e3218' };
const DARKB = { base: '#8a6428', light: '#b8893e', dark: '#4e3410' };
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (u) => u * u * (3 - 2 * u);
const pxSpace = (ctx, x, y, k, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(1 / k, -1 / k); try { f(); } catch (e) { /* art never breaks the frame */ } ctx.restore(); };
const E = (c, x, y, rx, ry, rot = 0) => { c.moveTo(x + Math.max(0.1, rx) * Math.cos(rot), y + Math.max(0.1, rx) * Math.sin(rot)); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); };
function cel(c, shape, col, lw, shade = true) {
  c.beginPath(); shape(c); c.fillStyle = col.base; c.fill();
  if (shade) {
    const d = lw * 2.4, B = 1e4;
    c.save(); c.beginPath(); shape(c); c.clip();
    c.beginPath(); c.rect(-B, -B, 2 * B, 2 * B); c.save(); c.translate(-d, -d); shape(c); c.restore(); c.fillStyle = col.dark; c.globalAlpha = 0.85; c.fill('evenodd');
    c.beginPath(); c.rect(-B, -B, 2 * B, 2 * B); c.save(); c.translate(d * 0.8, d * 0.8); shape(c); c.restore(); c.fillStyle = col.light; c.globalAlpha = 0.7; c.fill('evenodd');
    c.restore();
  }
  c.beginPath(); shape(c); c.lineWidth = lw; c.strokeStyle = INK; c.stroke();
}
// a brass cog: n teeth, radius r, turned by a
function cog(c, x, y, r, n, a, col, lw) {
  const shape = (c) => { for (let i = 0; i < n * 2; i++) { const a0 = a + (i / (n * 2)) * TAU, a1 = a + ((i + 1) / (n * 2)) * TAU, rr = i % 2 ? r * 0.8 : r; if (i === 0) c.moveTo(x + Math.cos(a0) * rr, y + Math.sin(a0) * rr); c.lineTo(x + Math.cos(a0) * rr, y + Math.sin(a0) * rr); c.lineTo(x + Math.cos(a1) * rr, y + Math.sin(a1) * rr); } c.closePath(); };
  cel(c, shape, col, lw, false);
  c.beginPath(); c.arc(x, y, r * 0.32, 0, TAU); c.fillStyle = INK; c.fill();
  c.beginPath(); c.arc(x, y, r * 0.16, 0, TAU); c.fillStyle = col.light; c.fill();
}

// ---------------------------------------------------------------- the owl
// s = its height in px; origin = its centre. o: { wing (-1 swept back .. 0 hovering .. 1 raised), flap (phase), eye ('idle' |
// 'glare' | 'x' | 'spiral' | 'shut' | 'broken'), hatch (0..1), key (turn), keyFast, talon (0..1 open), gear (chest cog turn),
// slump (0..1), sprung (a cog popped out of its head), glow (0..1 red eye glow), look (-1..1 pupils sideways) }
// A horned brass head sunk into a teardrop body (one silhouette, not two balls), a fan of five feather blades per wing that
// beats in a hover (the body bobs against the beat, the inner blades lag), rears up to threaten, folds into a stoop to dive and
// hangs limp when it is jammed; shutter eyelids and a brow plate that scowls; trousered legs whose talons spread to strike.
const FACE = { base: '#e8c47a', light: '#fbe6ad', dark: '#b08a42' };
const F = (col) => ({ lo: col.dark, base: col.base, hi: col.light, line: INK });
export function drawOwlArt(c, s, t, o = {}) {
  const lw = Math.max(1.4, s * 0.014), u = s, sl = o.slump || 0, wk = clamp(o.wing || 0, -1, 1), tal = o.talon || 0, eyeM = o.eye || 'idle';
  const limp = Math.max(clamp01(sl * 1.5), o.flap === 0 && wk <= 0 ? 0.85 : 0), ph = (o.flap || 0) * 2.2, beat = limp > 0.3 ? 0 : Math.sin(ph), free = 1 - Math.abs(wk);
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.save();
  c.translate(0, sl * 0.06 * u - beat * 0.014 * u * free);
  // tail fan (behind the body)
  for (let i = -1; i <= 1; i++) { c.save(); c.translate(i * 0.05 * u, 0.33 * u); c.rotate(i * 0.3 + Math.cos(ph) * 0.05 * free); const path = () => { c.beginPath(); c.moveTo(-0.04 * u, 0); c.quadraticCurveTo(-0.06 * u, 0.1 * u, 0, 0.16 * u); c.quadraticCurveTo(0.06 * u, 0.1 * u, 0.04 * u, 0); c.closePath(); }; form(c, path, { ...F(i ? DARKB : COPPER), d: lw * 2, lw, noWeight: true }); c.restore(); }
  // key in its back (it pokes up behind the head)
  {
    const kp = o.key || 0, w = Math.abs(Math.cos(kp)) * 0.13 * u + 0.02 * u, kx = 0.02 * u, ky = -0.52 * u;
    c.strokeStyle = INK; c.lineWidth = lw * 4; c.beginPath(); c.moveTo(kx, -0.3 * u); c.lineTo(kx, ky); c.stroke();
    c.strokeStyle = DARKB.base; c.lineWidth = lw * 2; c.stroke();
    for (const sd of [-1, 1]) cel(c, (c) => E(c, kx + sd * w * 0.55, ky - 0.05 * u, w * 0.55, 0.06 * u), Math.cos(kp) * sd > 0 ? BRASS : DARKB, lw, false);
    if (o.keyFast || Math.abs(kp - t * 30) < 1) { c.strokeStyle = 'rgba(255,240,200,0.7)'; c.lineWidth = lw; for (const sd of [-1, 1]) { c.beginPath(); c.arc(kx, ky - 0.05 * u, 0.17 * u, sd > 0 ? -0.5 : Math.PI - 0.5, sd > 0 ? 0.5 : Math.PI + 0.5); c.stroke(); } }
  }
  // wings: a fan of five blades from each shoulder. th = how high the leading blade points (rad above level)
  let th = (0.1 + 0.62 * beat) * free + (wk > 0 ? 1.05 + Math.sin(ph) * 0.06 : 1.32) * Math.abs(wk);
  th = th + (-1.3 - th) * limp;
  const spread = (1 - 0.6 * Math.max(0, -wk)) * (1 - 0.55 * limp), lag = -Math.cos(ph) * 0.16 * free * (1 - limp);
  for (const sd of [-1, 1]) {
    c.save(); c.translate(sd * 0.22 * u, -0.02 * u); c.scale(sd, 1);
    for (let i = 4; i >= 0; i--) {
      const f = i / 4, len = (0.42 - 0.15 * f) * u, wd = (0.075 - 0.012 * f) * u;
      c.save(); c.rotate(-th + f * spread * 1.15 + lag * (1 - f) + (sd < 0 ? 0.03 : 0));
      const blade = () => { c.beginPath(); c.moveTo(0, -wd * 0.55); c.quadraticCurveTo(len * 0.62, -wd * 1.05, len, wd * 0.1); c.quadraticCurveTo(len * 0.6, wd * 0.95, 0, wd * 0.55); c.closePath(); };
      form(c, blade, { ...F(i % 2 ? COPPER : BRASS), d: lw * 2, hiK: 0.55, lw, noWeight: true, inner: () => { c.strokeStyle = DARKB.dark; c.lineWidth = lw * 0.7; c.beginPath(); c.moveTo(len * 0.08, 0); c.lineTo(len * 0.86, wd * 0.05); c.stroke(); } });
      c.restore();
    }
    const cap = () => { c.beginPath(); c.ellipse(0.03 * u, 0, 0.085 * u, 0.07 * u, -th * 0.5, 0, TAU); };
    form(c, cap, { ...F(DARKB), d: lw * 2, lw, noWeight: true });
    c.beginPath(); c.arc(0.03 * u, 0, 0.016 * u, 0, TAU); c.fillStyle = BRASS.light; c.fill(); c.lineWidth = lw * 0.7; c.strokeStyle = INK; c.stroke();
    c.restore();
  }
  // legs and talons: tucked up in a hover, thrust down with the claws spread in the stoop
  for (const sd of [-1, 1]) {
    const x0 = sd * 0.105 * u, y0 = 0.34 * u, y1 = (0.42 + tal * 0.09 - limp * 0.0) * u, x1 = x0 + sd * tal * 0.01 * u;
    c.strokeStyle = INK; c.lineWidth = lw * 3.8; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    c.strokeStyle = '#9aa6b4'; c.lineWidth = lw * 1.8; c.stroke();
    for (let i = -1; i <= 1; i++) {
      const a = Math.PI / 2 + i * (0.5 + tal * 0.45), L = (0.065 + tal * 0.03) * u, curl = (1 - tal) * 0.9 * (i || 0.4);
      c.strokeStyle = INK; c.lineWidth = lw * 3; c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo(x1 + Math.cos(a) * L, y1 + Math.sin(a) * L * 0.8, x1 + Math.cos(a + curl) * L * 1.25, y1 + Math.sin(a + curl) * L * 1.2); c.stroke();
      c.strokeStyle = '#59626e'; c.lineWidth = lw * 1.4; c.stroke();
    }
  }
  // body: a riveted brass teardrop, feather plates, a chest window with a turning cog, a belly hatch
  const B = [[0, -0.16], [0.17, -0.12], [0.265, 0.02], [0.25, 0.2], [0.14, 0.345], [0, 0.385], [-0.14, 0.345], [-0.25, 0.2], [-0.265, 0.02], [-0.17, -0.12]].map(([x, y]) => [x * u, y * u]);
  const body = () => { c.beginPath(); spline(c, B, true); };
  form(c, body, { ...F(BRASS), d: lw * 3.2, hiK: 0.45, lw: lw * 1.15, inner: () => {
    c.strokeStyle = DARKB.dark; c.lineWidth = lw * 0.9;
    for (let r = 0; r < 3; r++) for (let i = -3; i <= 3; i++) { const x = (i + (r % 2) * 0.5) * 0.09 * u, y = (0.215 + r * 0.07) * u; c.beginPath(); c.arc(x, y, 0.045 * u, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); }
    for (const sd of [-1, 1]) { c.fillStyle = COPPER.base; c.beginPath(); c.ellipse(sd * 0.105 * u, 0.37 * u, 0.07 * u, 0.06 * u, 0, 0, TAU); c.fill(); c.lineWidth = lw * 0.8; c.strokeStyle = INK; c.stroke(); } // trousers
  } });
  const cy = 0.11 * u;
  c.beginPath(); c.arc(0, cy, 0.11 * u, 0, TAU); c.fillStyle = '#2a1c12'; c.fill();
  cog(c, 0, cy, 0.085 * u, 8, o.gear || 0, BRASS, lw);
  c.beginPath(); c.arc(0, cy, 0.11 * u, 0, TAU); c.lineWidth = lw * 2.4; c.strokeStyle = INK; c.stroke(); c.lineWidth = lw * 1.1; c.strokeStyle = COPPER.light; c.beginPath(); c.arc(0, cy, 0.11 * u, Math.PI * 1.05, Math.PI * 1.65); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.28)'; c.beginPath(); c.ellipse(-0.04 * u, cy - 0.045 * u, 0.04 * u, 0.018 * u, -0.6, 0, TAU); c.fill(); // glass glint
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; c.beginPath(); c.arc(Math.cos(a) * 0.137 * u, cy + Math.sin(a) * 0.137 * u, 0.011 * u, 0, TAU); c.fillStyle = DARKB.dark; c.fill(); }
  const hz = o.hatch || 0, hy = 0.3 * u;
  if (hz > 0.02) { c.beginPath(); c.ellipse(0, hy, 0.1 * u, 0.034 * u, 0, 0, TAU); c.fillStyle = '#140c06'; c.fill(); if (hz > 0.5) cog(c, 0, hy + 0.012 * u, 0.045 * u, 6, t * 4, BRASS, lw * 0.8); }
  if (hz > 0.02) for (const sd of [-1, 1]) { c.save(); c.translate(sd * 0.1 * u, hy); c.rotate(sd * hz * 1.2); cel(c, (c) => { c.roundRect(sd > 0 ? -0.1 * u : 0, -0.018 * u, 0.1 * u, 0.036 * u, 0.012 * u); }, COPPER, lw, false); c.restore(); }
  else { c.strokeStyle = DARKB.dark; c.lineWidth = lw; c.beginPath(); c.moveTo(-0.09 * u, hy + 0.012 * u); c.quadraticCurveTo(0, hy + 0.03 * u, 0.09 * u, hy + 0.012 * u); c.moveTo(0, hy + 0.005 * u); c.lineTo(0, hy + 0.04 * u); c.stroke(); }
  // head: a horned brass dome sunk into the shoulders, a pale face disc, lens eyes with shutter lids, a copper beak
  const hyC = -0.2 * u + sl * 0.05 * u, tilt = sl * 0.25 + (o.look || 0) * 0.05 + Math.cos(ph) * 0.012 * free;
  c.save(); c.translate(0, hyC); c.rotate(tilt);
  const H = [[-0.3, -0.3], [-0.15, -0.2], [0, -0.225], [0.15, -0.2], [0.3, -0.3], [0.29, -0.04], [0.245, 0.11], [0.11, 0.195], [0, 0.205], [-0.11, 0.195], [-0.245, 0.11], [-0.29, -0.04]].map(([x, y]) => [x * u, y * u]);
  const head = () => { c.beginPath(); spline(c, H, true, 0.42); };
  form(c, head, { ...F(BRASS), d: lw * 3, hiK: 0.45, lw: lw * 1.15, inner: () => {
    for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(sd * 0.3 * u, -0.31 * u); c.lineTo(sd * 0.17 * u, -0.17 * u); c.lineTo(sd * 0.3 * u, -0.1 * u); c.closePath(); c.fillStyle = COPPER.base; c.fill(); }
    c.fillStyle = DARKB.dark; for (let i = 0; i < 7; i++) { const a = Math.PI * (1.2 + (i / 6) * 0.6); c.beginPath(); c.arc(Math.cos(a) * 0.225 * u, Math.sin(a) * 0.185 * u, 0.011 * u, 0, TAU); c.fill(); }
  } });
  for (const sd of [-1, 1]) cel(c, (c) => E(c, sd * 0.115 * u, 0.015 * u, 0.125 * u, 0.13 * u), FACE, lw);
  const blink = eyeM === 'idle' ? blinkAt(t, 11) : 0;
  for (const sd of [-1, 1]) {
    const ex = sd * 0.115 * u, ey = 0.01 * u, er = 0.09 * u;
    c.beginPath(); c.arc(ex, ey, er, 0, TAU); c.fillStyle = '#56606c'; c.fill(); c.lineWidth = lw * 1.2; c.strokeStyle = INK; c.stroke();
    c.beginPath(); c.arc(ex, ey, er * 0.78, 0, TAU); c.fillStyle = '#163238'; c.fill();
    if (eyeM === 'spiral') spiralEye(c, ex, ey, er * 0.7, t, sd, '#ffc05a');
    else if (eyeM === 'x' || (eyeM === 'broken' && sd < 0)) { c.strokeStyle = '#ffb030'; c.lineWidth = lw * 1.8; c.beginPath(); c.moveTo(ex - er * 0.4, ey - er * 0.4); c.lineTo(ex + er * 0.4, ey + er * 0.4); c.moveTo(ex + er * 0.4, ey - er * 0.4); c.lineTo(ex - er * 0.4, ey + er * 0.4); c.stroke(); }
    else if (eyeM === 'broken') { c.strokeStyle = '#9fb8bc'; c.lineWidth = lw; c.beginPath(); c.moveTo(ex - er * 0.5, ey - er * 0.3); c.lineTo(ex + er * 0.1, ey + er * 0.1); c.lineTo(ex + er * 0.5, ey - er * 0.1); c.moveTo(ex + er * 0.1, ey + er * 0.1); c.lineTo(ex, ey + er * 0.6); c.stroke(); }
    else if (eyeM === 'shut') { c.strokeStyle = '#ffb030'; c.lineWidth = lw * 1.8; c.beginPath(); c.moveTo(ex - er * 0.5, ey); c.quadraticCurveTo(ex, ey + er * 0.35, ex + er * 0.5, ey); c.stroke(); }
    else {
      const glare = eyeM === 'glare', red = glare ? 1 : o.glow || 0, pr = er * (glare ? 0.36 : 0.46), lx = (o.look || 0) * er * 0.28;
      if (red > 0.5) { c.beginPath(); c.arc(ex + lx, ey, pr * 1.55, 0, TAU); c.fillStyle = 'rgba(255,74,38,0.32)'; c.fill(); }
      c.beginPath(); c.arc(ex + lx, ey, pr, 0, TAU); c.fillStyle = red > 0.5 ? '#ff4a26' : '#ffb030'; c.fill();
      c.beginPath(); c.arc(ex + lx, ey, pr * 0.45, 0, TAU); c.fillStyle = red > 0.5 ? '#fff0a0' : '#ffe9a8'; c.fill();
      // the shutter lid: half down at rest, a quick blink now and then, wide open in a glare
      const lid = Math.max(glare ? 0 : 0.24, blink);
      if (lid > 0.01) { c.save(); c.beginPath(); c.arc(ex, ey, er * 0.8, 0, TAU); c.clip(); c.fillStyle = BRASS.base; c.fillRect(ex - er, ey - er, er * 2, er * 2 * lid * 0.82); c.fillStyle = DARKB.dark; c.fillRect(ex - er, ey - er + er * 2 * lid * 0.82 - lw * 0.9, er * 2, lw * 0.9); c.restore(); }
    }
    c.beginPath(); c.arc(ex - er * 0.35, ey - er * 0.4, er * 0.16, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.8)'; c.fill();
  }
  // the brow plate: one copper V over both eyes that drops into a scowl
  { const g = eyeM === 'glare' ? 1 : eyeM === 'x' || eyeM === 'broken' || eyeM === 'spiral' ? -0.6 : 0, yo = (-0.105 + g * 0.012) * u, yi = (-0.075 + g * 0.05) * u;
    c.beginPath(); c.moveTo(-0.25 * u, yo - g * 0.03 * u); c.quadraticCurveTo(-0.12 * u, yo - 0.035 * u, 0, yi); c.quadraticCurveTo(0.12 * u, yo - 0.035 * u, 0.25 * u, yo - g * 0.03 * u);
    c.lineWidth = lw * 4.2; c.strokeStyle = INK; c.stroke(); c.lineWidth = lw * 2.2; c.strokeStyle = COPPER.base; c.stroke(); }
  cel(c, (c) => { c.moveTo(-0.05 * u, 0.065 * u); c.quadraticCurveTo(0, 0.045 * u, 0.05 * u, 0.065 * u); c.quadraticCurveTo(0.03 * u, 0.13 * u, 0, 0.17 * u); c.quadraticCurveTo(-0.03 * u, 0.13 * u, -0.05 * u, 0.065 * u); c.closePath(); }, COPPER, lw);
  // a cog sprung out of its head (jammed / broken down)
  if (o.sprung) { const p = o.sprung; c.strokeStyle = INK; c.lineWidth = lw * 2.2; c.beginPath(); c.moveTo(0.06 * u, -0.18 * u); for (let i = 0; i < 5; i++) c.lineTo(0.06 * u + (i % 2 ? 0.03 : -0.03) * u + Math.sin(t * 9 + i) * 0.006 * u, -0.18 * u - (i + 1) * 0.04 * u * p); c.stroke(); c.strokeStyle = '#c3ccd6'; c.lineWidth = lw; c.stroke(); cog(c, 0.06 * u + Math.sin(t * 9) * 0.012 * u, -0.2 * u - 0.22 * u * p, 0.05 * u, 6, 0.4 + Math.sin(t * 9) * 0.2, BRASS, lw * 0.8); }
  c.restore();
  c.restore();
}

// ---------------------------------------------------------------- pose from the sim
// the owl is drawn 1.5x its sim height so the final boss reads at phone scale (2026-11-05); it perches higher to match
const OWL_SC = 1.5, OWL_LIFT = (OWL_SC - 1) * 0.55 * OWL.h;
export function owlPose(sim, t) {
  const B = sim.bx && sim.bx.boss, O = sim.owl;
  if (!B || !O) return null;
  const A = B.atk, warn = A && A.ph === 'warn' ? clamp01(1 - A.t / A.dur) : 0, M = sim.mode;
  const R = sim.outerR;
  let x = B.x, y = B.y + OWL_LIFT, rot = 0;
  const o = { flap: t * 4.2, key: t * 1.5, gear: t * 1.2, wing: 0, eye: 'idle', hatch: 0, talon: 0, slump: 0 };
  if (A && A.name === 'swoop' && A.ph === 'warn') { o.wing = 0.4 + 0.5 * warn; o.eye = 'glare'; o.flap = t * 9; o.look = clamp01(Math.abs(A.tx - B.x) / 2) * Math.sign(A.tx - B.x); rot = clamp01(warn) * 0.25 * Math.sign(A.tx - B.x); }
  if (A && A.name === 'wind') { o.key = t * (A.ph === 'warn' ? 6 + 18 * warn : 30); o.wing = 0.55; o.eye = 'shut'; o.flap = t * 6; }
  if (A && (A.name === 'gears' || A.name === 'gears2')) { o.hatch = A.ph === 'warn' ? ease(warn) : 1; o.eye = 'idle'; o.look = 0; o.wing = 0.25; }
  if (O.sw) {
    const u = clamp01(1 - O.sw.t / 0.75), f = u < 0.4 ? ease(u / 0.4) : 1 - ease((u - 0.4) / 0.6);
    const tx = O.sw.x, ty = O.sw.y + OWL.h * OWL_SC * 0.42; // talons at the strike point
    const y0 = B.y + OWL_LIFT;
    x = B.x + (tx - B.x) * f; y = y0 + (ty - y0) * f;
    o.wing = -0.8 * f + (1 - f) * 0.3; o.talon = f; o.eye = O.sw.res === 'slam' && u > 0.4 ? 'spiral' : 'glare';
    rot = Math.atan2(tx - B.x, -(ty - B.y)) * 0.5 * f;
  }
  if (B.flinch > 0 && !O.jam) { rot += Math.sin(B.flinch * 20) * 0.12; o.eye = 'shut'; }
  if (O.jam > 0) { o.eye = 'x'; o.sprung = clamp01((OWL.jam[M] - O.jam) / 0.3); o.gear = 0; o.key = 0.4 + Math.sin(t * 30) * 0.15; o.slump = 0.5; o.wing = -0.1; o.flap = 0; }
  if (O.down) { o.eye = 'broken'; o.sprung = 1; o.slump = 1; o.wing = -0.3; o.flap = 0; o.key = 0.4; o.gear = 0.2; y = R + OWL.h * OWL_SC * 0.42; rot = -0.35; x = B.x; }
  return { x, y, rot, o, warn, A };
}

// the owl itself (main.js through render/boss.js drawBossActor)
export function drawOwlBoss(ctx, sim, k, t) {
  const B = sim.bx && sim.bx.boss, O = sim.owl, Q = owlPose(sim, t);
  if (!Q) return;
  const fxb = sim.p2 && sim.p2.fx && sim.p2.fx.b, iced = B.dizzy > 0 && !O.jam && ((fxb && fxb.k === 'ice') || statusKind('b') === 'ice');
  const stunned = B.dizzy > 0 && !iced && !O.jam && !O.down;
  const st = statusClock(sim, 'b', iced ? { k: 'ice', left: B.dizzy } : stunned ? { k: 'stun', zap: !!(fxb && fxb.k === 'zap'), left: B.dizzy } : null, t);
  const tt = st && st.k === 'ice' ? st.hold : t, s = OWL.h * OWL_SC * k;
  if (stunned) { Q.o.eye = 'spiral'; Q.o.slump = Math.max(Q.o.slump, 0.6); Q.o.wing = -0.15; Q.o.flap = 0; Q.rot += Math.sin(t * 2.2) * 0.08; }
  const bob = O.down || stunned || iced ? 0 : Math.sin(t * 2.1) * 0.05 * k;
  pxSpace(ctx, Q.x, Q.y, k, () => {
    ctx.translate(0, bob);
    ctx.rotate(Q.rot);
    statusDraw(ctx, { x0: -0.62 * s, y0: -0.62 * s, x1: 0.62 * s, y1: 0.55 * s }, (c) => drawOwlArt(c, s, tt, Q.o), st, {});
    if (stunned && st) dizzyStars(ctx, 0, -0.52 * s, 0.24 * s, 0.07 * s, t, { size: Math.max(3, 0.05 * s) });
    // jammed / broken: sparks from the chest window and puffs of smoke
    if (O.jam > 0 || O.down) {
      const n = O.down ? 2 : 5;
      for (let i = 0; i < n; i++) {
        const f = (t * 1.6 + i / n) % 1, a = i * 2.4;
        ctx.globalAlpha = 0.65 * (1 - f);
        ctx.fillStyle = '#4a4440';
        ctx.beginPath(); ctx.arc(Math.cos(a) * 0.08 * s + f * 0.12 * s * Math.cos(a), -0.4 * s - f * 0.35 * s, (0.04 + f * 0.06) * s, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (O.jam > 0 && Math.floor(t * 14) % 2 === 0) for (let i = 0; i < 4; i++) { const a = t * 7 + i * 1.6, r1 = 0.12 * s, r2 = 0.2 * s; ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = Math.max(1.4, s * 0.012); ctx.beginPath(); ctx.moveTo(Math.cos(a) * r1, 0.1 * s + Math.sin(a) * r1); ctx.lineTo(Math.cos(a) * r2, 0.1 * s + Math.sin(a) * r2); ctx.stroke(); }
    }
  });
}

// on the rings (render/boss.js drawBossRings): the swoop's target mark, the wind-up arrows, the gear bombs
export function drawOwlRings(ctx, sim, k, t) {
  const B = sim.bx && sim.bx.boss, O = sim.owl;
  if (!B || !O) return;
  const A = B.atk, px = 1 / k;
  if (A && A.ph === 'warn' && A.name === 'swoop') {
    const e = sim.eggs.find((q) => q.id === A.eid && q.alive && q.body), p = e ? e.body.getPosition() : { x: A.tx, y: A.ty }, u = clamp01(1 - A.t / A.dur);
    const exposed = e && sim.owlExposed(e);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(t * 2);
    const r = 0.42 - 0.12 * u;
    ctx.lineWidth = Math.max(0.05, 4 * px); ctx.strokeStyle = 'rgba(20,10,6,0.8)';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.lineWidth = Math.max(0.03, 2.2 * px); ctx.strokeStyle = exposed ? '#ff4a26' : '#ffd23a';
    ctx.setLineDash([0.12, 0.08]); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * (r + 0.02), Math.sin(a) * (r + 0.02)); ctx.lineTo(Math.cos(a) * (r + 0.16), Math.sin(a) * (r + 0.16)); ctx.lineWidth = Math.max(0.04, 3 * px); ctx.stroke(); }
    ctx.restore();
  }
  if (A && A.name === 'wind' && A.ph === 'warn') {
    const u = clamp01(1 - A.t / A.dur), pulse = 0.55 + 0.45 * Math.sin(t * 14);
    A.rings.forEach((ri, j) => {
      const ring = sim.rings[ri], dir = A.dirs[j], rr = ring.r;
      ctx.save(); ctx.globalAlpha = pulse;
      for (const mid of [Math.PI / 2, -Math.PI / 2]) {
        const a0 = mid - dir * 0.35, a1 = mid + dir * 0.35 * (0.4 + 0.6 * u);
        for (const [w, col] of [[9, '#2a1408'], [5, '#ffb030']]) { ctx.lineWidth = Math.max(0.06, w * px); ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(0, 0, rr, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke(); }
        const hx = rr * Math.cos(a1), hy = rr * Math.sin(a1), tx = -Math.sin(a1) * dir, ty = Math.cos(a1) * dir, nx = Math.cos(a1), ny = Math.sin(a1), hs = Math.max(0.16, 10 * px);
        ctx.beginPath(); ctx.moveTo(hx + tx * hs * 1.3, hy + ty * hs * 1.3); ctx.lineTo(hx + nx * hs, hy + ny * hs); ctx.lineTo(hx - nx * hs, hy - ny * hs); ctx.closePath();
        ctx.fillStyle = '#ffb030'; ctx.fill(); ctx.lineWidth = Math.max(0.03, 2 * px); ctx.strokeStyle = '#2a1408'; ctx.stroke();
      }
      ctx.restore();
    });
  }
  for (const G of O.gb) {
    const q = sim.gearAt(G), M = sim.mode in OWL.tick ? sim.mode : 'medium', left = G.ph === 'fly' ? 9 : OWL.tick[M] - G.t;
    pxSpace(ctx, q.x, q.y, k, () => drawGearBomb(ctx, 0.22 * k, t, { spin: G.ph === 'fly' ? t * 8 : Math.floor(G.t * 4) * 0.4, left, dud: G.dud }));
  }
}
// a gear bomb: a brass cog with a dark core and a red lamp that blinks faster and faster; a dud is grey and bent
export function drawGearBomb(c, r, t, o = {}) {
  const lw = Math.max(1.1, r * 0.09), left = o.left ?? 9;
  const col = o.dud ? { base: '#8a8478', light: '#b8b2a6', dark: '#4a463e' } : BRASS;
  cog(c, 0, 0, r, 8, o.spin || 0, col, lw);
  c.beginPath(); c.arc(0, 0, r * 0.5, 0, TAU); c.fillStyle = '#2a1a10'; c.fill(); c.lineWidth = lw; c.strokeStyle = INK; c.stroke();
  const rate = left < 0.6 ? 16 : left < 1.2 ? 9 : 4, on = !o.dud && Math.sin(t * rate * Math.PI) > -0.2;
  c.beginPath(); c.arc(0, 0, r * 0.26, 0, TAU); c.fillStyle = o.dud ? '#3a3632' : on ? '#ff3a1a' : '#6a1a0c'; c.fill();
  if (on) { c.beginPath(); c.arc(-r * 0.08, -r * 0.08, r * 0.08, 0, TAU); c.fillStyle = '#ffe0a0'; c.fill(); }
  if (o.dud) { c.strokeStyle = INK; c.lineWidth = lw * 1.4; c.beginPath(); c.moveTo(r * 0.7, -r * 0.7); c.lineTo(r * 1.05, -r * 1.1); c.stroke(); }
}

// ---------------------------------------------------------------- boss card, emblem, the bar
// the intro card: the owl over a blueprint workbench, an egg in its sights
export function drawOwlCard(ctx, x, y, w, h, t, age) {
  const H0 = Math.min(h, w * 2.06), W0 = H0 / 2.06, pad = Math.max(2, H0 * 0.025);
  const e = age == null ? 1 : Math.min(1, Math.max(0, age / 0.45));
  const pop = e < 1 ? 0.6 + 0.4 * (1 - Math.pow(1 - e, 3)) + Math.sin(e * Math.PI) * 0.08 : 1;
  const dw = (W0 - pad * 2) * pop, dh = (H0 - pad * 2) * pop, cx = x + w / 2, cy = y + h / 2 + Math.sin(t * 2.1) * h * 0.012, r = dw * 0.07;
  const rr = (px, py, pw, ph, rad) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(px, py, pw, ph, rad) : ctx.rect(px, py, pw, ph); };
  ctx.save();
  ctx.globalAlpha *= Math.min(1, e * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; rr(cx - dw / 2 + pad * 0.6, cy - dh / 2 + pad * 1.2, dw, dh, r); ctx.fill();
  ctx.fillStyle = '#5a3a1c'; rr(cx - dw / 2 - pad, cy - dh / 2 - pad, dw + pad * 2, dh + pad * 2, r + pad); ctx.fill();
  ctx.fillStyle = '#f2c25a'; rr(cx - dw / 2 - pad * 0.45, cy - dh / 2 - pad * 0.45, dw + pad * 0.9, dh + pad * 0.9, r + pad * 0.45); ctx.fill();
  rr(cx - dw / 2, cy - dh / 2, dw, dh, r);
  ctx.save(); ctx.clip();
  const g = ctx.createLinearGradient(0, cy - dh / 2, 0, cy + dh / 2);
  g.addColorStop(0, '#102038'); g.addColorStop(0.65, '#1d3a5c'); g.addColorStop(1, '#3a2a1a');
  ctx.fillStyle = g; ctx.fillRect(cx - dw / 2, cy - dh / 2, dw, dh);
  // blueprint grid and a drawn cog
  ctx.strokeStyle = 'rgba(140,190,240,0.22)'; ctx.lineWidth = Math.max(1, dw * 0.006);
  for (let gx = cx - dw / 2; gx < cx + dw / 2; gx += dw / 9) { ctx.beginPath(); ctx.moveTo(gx, cy - dh / 2); ctx.lineTo(gx, cy + dh * 0.3); ctx.stroke(); }
  for (let gy = cy - dh / 2; gy < cy + dh * 0.3; gy += dw / 9) { ctx.beginPath(); ctx.moveTo(cx - dw / 2, gy); ctx.lineTo(cx + dw / 2, gy); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(160,210,255,0.4)'; ctx.beginPath(); ctx.arc(cx - dw * 0.28, cy - dh * 0.34, dw * 0.12, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(cx - dw * 0.28, cy - dh * 0.34, dw * 0.05, 0, TAU); ctx.stroke();
  // a warm lamp glow
  const lg = ctx.createRadialGradient(cx + dw * 0.3, cy - dh * 0.1, 0, cx + dw * 0.3, cy - dh * 0.1, dw * 0.6);
  lg.addColorStop(0, 'rgba(255,190,90,0.35)'); lg.addColorStop(1, 'rgba(255,190,90,0)'); ctx.fillStyle = lg; ctx.fillRect(cx - dw / 2, cy - dh / 2, dw, dh);
  // the workbench
  const fy = cy + dh * 0.36;
  ctx.fillStyle = '#6a4424'; ctx.fillRect(cx - dw / 2, fy, dw, dh); ctx.fillStyle = '#4a2e18'; ctx.fillRect(cx - dw / 2, fy + dh * 0.05, dw, dh);
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, dw * 0.012); ctx.beginPath(); ctx.moveTo(cx - dw / 2, fy); ctx.lineTo(cx + dw / 2, fy); ctx.stroke();
  // an egg it has in its sights, the owl
  const eh = dh * 0.13, ex = cx - dw * 0.3;
  ctx.save(); ctx.translate(ex, fy - eh * 0.5); ctx.beginPath(); for (let i = 0; i <= 24; i++) { const a = (i / 24) * TAU, s2 = Math.sin(a); ctx.lineTo(eh * 0.375 * Math.cos(a) * (1 + 0.13 * s2), (eh / 2) * s2); } ctx.closePath(); ctx.fillStyle = '#fbf3e0'; ctx.fill(); ctx.lineWidth = Math.max(1, eh * 0.06); ctx.strokeStyle = '#3a2410'; ctx.stroke(); ctx.restore();
  ctx.save(); ctx.translate(cx + dw * 0.1, cy - dh * 0.02);
  drawOwlArt(ctx, dw * 0.95, t, { flap: t * 3, key: t * 1.5, gear: t, wing: 0.35, eye: 'glare', look: -0.8, talon: 0.3 });
  ctx.restore();
  ctx.restore();
  ctx.restore();
  return true;
}
// the head in a round chip (boss bar emblem); r = chip radius, origin at its centre
export function drawOwlEmblem(ctx, r, t) {
  ctx.save();
  ctx.translate(0, r * 0.7);
  drawOwlArt(ctx, r * 3.1, t, { eye: 'glare', key: t, gear: t, wing: 0 });
  ctx.restore();
}
// the bar: one gear pip per jam it can take (lit = gears left), and what it is doing
export function drawOwlBar(ctx, ui, sim, B, bx, bw, y, by, bh, h, gap, t) {
  const O = sim.owl, u = ui.u, n = Math.max(1, O.max), sw = (bw - gap * (n - 1)) / n;
  const warn = B.atk && B.atk.ph === 'warn';
  for (let i = 0; i < n; i++) {
    const sx = bx + i * (sw + gap);
    bossPip(ctx, ui, sx, by, sw, bh, null);
    if (i < O.hp) bossPip(ctx, ui, sx, by, sw, bh, O.jam > 0 ? (Math.floor(t * 6) % 2 ? '#ffd63c' : '#ffb03c') : warn ? '#ff6a3d' : '#ff9a3d');
  }
  const NAME = { swoop: 'SWOOP!', wind: 'WIND-UP!', gears: 'GEAR BOMB!', gears2: 'GEAR BOMBS!' };
  const label = O.down ? 'BROKEN DOWN!' : O.jam > 0 ? 'JAMMED!' : warn ? NAME[B.atk.name] || 'LOOK OUT!' : 'JAM ITS GEARS!';
  ui.text(label, bx + bw / 2, y + h / 2, { size: 12 * u, align: 'center', maxW: bw - 8 * u, color: '#fff', stroke: 'rgba(0,0,0,0.75)', tag: 'hud:bossPhase' });
}

// events -> popups, sounds, one-time tips
export function owlEvent(ev, fx, U) {
  const { popup, audio, once } = U;
  switch (ev.type) {
    case 'bossWarn':
      if (ev.kind !== 'owl') break;
      if (ev.attack === 'swoop') { audio.play('wind_gust', { vol: 0.5, pitch: 0.7 }); once('owlSwoop', 'The owl marks an egg in the outer channel. Turn the outer gap away and it hits the brass. An iron egg jams its gears!', 4.6); }
      else if (ev.attack === 'wind') { audio.play('motor_tick', { vol: 0.7, pitch: 0.8 }); once('owlWind', 'It winds the vault: the rings with arrows will spin a quarter turn.', 3.6); }
      else { audio.play('bomb_fuse', { vol: 0.4 }); once('owlGears', 'Gear bombs! Turn the ring to carry a bomb away from your eggs. The blast also snaps thorns off.', 4.2); }
      break;
    case 'owlGrab': audio.play('grab', { vol: 0.8, pitch: 0.8 }); popup(ev.x, ev.y + 0.6, 'Snatched!', { color: '#ff9a6a', size: 18, life: 0.9 }); break;
    case 'owlSlam': audio.play('steel_clang', { vol: 0.9, pitch: 0.7 }); fx.sparkle(ev.x, ev.y, 10, '#ffe08a'); fx.shake = Math.max(fx.shake || 0, 0.3); popup(ev.x, ev.y + 0.7, 'CLANG!', { color: '#bff0a0', size: 20, life: 1 }); break;
    case 'owlMiss': audio.play('wind_gust', { vol: 0.3, pitch: 1.4 }); break;
    case 'owlJam': audio.play('steel_clang', { vol: 1, pitch: 0.55 }); audio.play('glass_crack', { vol: 0.5, pitch: 0.6 }); fx.sparkle(ev.bx, ev.by, 16, '#ffd63c'); fx.shake = Math.max(fx.shake || 0, 0.5); popup(ev.bx, ev.by + 1.3, ev.down ? 'BROKEN DOWN!' : `JAMMED! ${ev.hp} left`, { color: '#ffd63c', size: 22, life: 1.4 }); break;
    case 'owlWind': audio.play('motor_tick', { vol: 0.8, pitch: 0.6 }); break;
    case 'owlDrop': audio.play('release', { vol: 0.5, pitch: 0.8 }); break;
    case 'gearLand': audio.play('steel_on', { vol: 0.5, pitch: 1.3 }); break;
    case 'gearDud': audio.play('steel_clang', { vol: 0.5, pitch: 1.4 }); popup(ev.x, ev.y + 0.5, 'Jammed!', { color: '#bff0a0', size: 16, life: 0.9 }); break;
    case 'gearFizz': fx.smoke(ev.x, ev.y, 4); break;
    case 'gearBurst': audio.play('bomb_explode', { vol: 0.7, pitch: 1.2 }); fx.explosion(ev.x, ev.y, ev.R); fx.flash = 0.2; fx.shake = 0.4; fx.chips(ev.x, ev.y, '#c99a40', 10, 3); break; // a small blast: no full-screen flash
  }
}
