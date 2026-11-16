// Pictograms (owner 2026-11-16: "convey as much as possible with icons, players come to play, not to read").
// Small code-drawn glyphs shared by the intro, pause, win and fail cards and the info screen. Every one draws centred on
// (x, y) inside a box of about s px, so a row of them lines up. t is the clock, for the few that move.
import { drawEggIcon, drawStar } from './ui.js';

const TAU = Math.PI * 2;
const ink = 'rgba(60,30,8,0.9)';

export function pictoCheck(c, x, y, s, col = '#3eb42d') {
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(x - s * 0.3, y + s * 0.02); c.lineTo(x - s * 0.08, y + s * 0.26); c.lineTo(x + s * 0.34, y - s * 0.24);
  c.lineWidth = s * 0.3; c.strokeStyle = ink; c.stroke();
  c.lineWidth = s * 0.19; c.strokeStyle = col; c.stroke(); c.restore();
}
export function pictoCross(c, x, y, s, col = '#e0412d') {
  c.save(); c.lineCap = 'round';
  const r = s * 0.36;
  c.beginPath(); c.moveTo(x - r, y - r); c.lineTo(x + r, y + r); c.moveTo(x + r, y - r); c.lineTo(x - r, y + r);
  c.lineWidth = s * 0.3; c.strokeStyle = ink; c.stroke();
  c.lineWidth = s * 0.19; c.strokeStyle = col; c.stroke(); c.restore();
}
export function pictoWarn(c, x, y, s, col = '#ff9b2e') {
  c.save(); c.lineJoin = 'round';
  c.beginPath(); c.moveTo(x, y - s * 0.4); c.lineTo(x + s * 0.44, y + s * 0.34); c.lineTo(x - s * 0.44, y + s * 0.34); c.closePath();
  c.fillStyle = col; c.fill(); c.lineWidth = s * 0.1; c.strokeStyle = ink; c.stroke();
  c.fillStyle = ink; c.fillRect(x - s * 0.04, y - s * 0.16, s * 0.08, s * 0.28); c.fillRect(x - s * 0.04, y + s * 0.18, s * 0.08, s * 0.08);
  c.restore();
}
export function pictoClock(c, x, y, s, col = '#fff6e0') {
  c.save(); c.translate(x, y);
  c.beginPath(); c.arc(0, 0, s * 0.4, 0, TAU); c.fillStyle = col; c.fill(); c.lineWidth = s * 0.1; c.strokeStyle = ink; c.stroke();
  c.beginPath(); c.moveTo(0, -s * 0.24); c.lineTo(0, 0); c.lineTo(s * 0.17, s * 0.1); c.lineCap = 'round'; c.lineWidth = s * 0.09; c.stroke();
  c.restore();
}
export function pictoFlame(c, x, y, s) {
  c.save(); c.translate(x, y);
  c.beginPath(); c.moveTo(0, -s * 0.46);
  c.bezierCurveTo(s * 0.12, -s * 0.2, s * 0.4, -s * 0.1, s * 0.34, s * 0.14);
  c.bezierCurveTo(s * 0.3, s * 0.42, -s * 0.3, s * 0.42, -s * 0.34, s * 0.14);
  c.bezierCurveTo(-s * 0.38, -s * 0.06, -s * 0.12, -s * 0.12, 0, -s * 0.46); c.closePath();
  c.fillStyle = '#ff7a1c'; c.fill(); c.lineWidth = s * 0.08; c.strokeStyle = ink; c.stroke();
  c.beginPath(); c.ellipse(0, s * 0.18, s * 0.14, s * 0.19, 0, 0, TAU); c.fillStyle = '#ffd84a'; c.fill();
  c.restore();
}
// a gem for "points"
export function pictoGem(c, x, y, s) {
  c.save(); c.translate(x, y); c.lineJoin = 'round';
  c.beginPath(); c.moveTo(-s * 0.3, -s * 0.2); c.lineTo(-s * 0.15, -s * 0.4); c.lineTo(s * 0.15, -s * 0.4); c.lineTo(s * 0.3, -s * 0.2); c.lineTo(0, s * 0.4); c.closePath();
  c.fillStyle = '#5ec8ff'; c.fill(); c.lineWidth = s * 0.08; c.strokeStyle = ink; c.stroke();
  c.beginPath(); c.moveTo(-s * 0.3, -s * 0.2); c.lineTo(s * 0.3, -s * 0.2); c.moveTo(-s * 0.1, -s * 0.2); c.lineTo(0, s * 0.4); c.moveTo(s * 0.1, -s * 0.2); c.lineTo(0, s * 0.4);
  c.lineWidth = s * 0.05; c.stroke(); c.restore();
}
// a bullseye for the bonus goal
export function pictoTarget(c, x, y, s) {
  c.save(); c.translate(x, y);
  [[0.4, '#fff'], [0.3, '#e0412d'], [0.19, '#fff'], [0.09, '#e0412d']].forEach(([r, col]) => { c.beginPath(); c.arc(0, 0, s * r, 0, TAU); c.fillStyle = col; c.fill(); if (r === 0.4) { c.lineWidth = s * 0.07; c.strokeStyle = ink; c.stroke(); } });
  c.restore();
}
// the egg's shell, cracked: two halves and a zigzag. lost: the egg is gone (splat), else just cracked
export function pictoCracked(c, x, y, s) {
  drawEggIcon(c, x, y, s * 0.9, 'alive');
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(x - s * 0.2, y - s * 0.08); c.lineTo(x - s * 0.06, y + s * 0.06); c.lineTo(x + s * 0.04, y - s * 0.1); c.lineTo(x + s * 0.2, y + s * 0.06);
  c.lineWidth = s * 0.09; c.strokeStyle = '#5a2a0a'; c.stroke(); c.restore();
}
export function pictoBroken(c, x, y, s) {
  drawEggIcon(c, x, y, s * 0.9, 'broken');
}
export function pictoShinyEgg(c, x, y, s, t = 0) {
  drawEggIcon(c, x, y, s * 0.9, 'alive');
  c.save(); c.translate(x, y); c.fillStyle = '#fff3a0'; c.strokeStyle = ink; c.lineWidth = s * 0.04;
  const tw = 0.75 + 0.25 * Math.sin(t * 4);
  for (const [dx, dy, r] of [[0.32, -0.3, 0.16], [-0.34, -0.1, 0.11]]) {
    const R = s * r * tw; c.beginPath(); c.moveTo(dx * s, dy * s - R); c.quadraticCurveTo(dx * s, dy * s, dx * s + R, dy * s); c.quadraticCurveTo(dx * s, dy * s, dx * s, dy * s + R); c.quadraticCurveTo(dx * s, dy * s, dx * s - R, dy * s); c.quadraticCurveTo(dx * s, dy * s, dx * s, dy * s - R); c.fill();
  }
  c.restore();
}
// an icon with a red "no" cross over it (not lost, not cracked)
export function pictoNo(c, x, y, s, draw) {
  draw(c, x, y, s); pictoCross(c, x + s * 0.2, y + s * 0.18, s * 0.7);
}
export function pictoStarMinus(c, x, y, s) {
  drawStar(c, x - s * 0.1, y, s * 0.36, false, 1, true);
  c.save(); c.fillStyle = '#e0412d'; c.strokeStyle = ink; c.lineWidth = s * 0.05;
  c.beginPath(); c.arc(x + s * 0.3, y + s * 0.26, s * 0.17, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = '#fff'; c.fillRect(x + s * 0.2, y + s * 0.235, s * 0.2, s * 0.05); c.restore();
}

// the three star goals as pictograms (the same rule the result uses): kind 0 save the target, 1 lose none, 2 none cracked
export function pictoGoal(c, kind, x, y, s, o = {}) {
  if (kind === 0) {
    const n = Math.min(o.n || 1, 5), sp = s * 0.62, x0 = x - ((n - 1) * sp) / 2 - s * 0.2;
    for (let i = 0; i < n; i++) drawEggIcon(c, x0 + i * sp, y, s * 0.82, 'alive');
    pictoCheck(c, x0 + (n - 1) * sp / 2 + (n * sp) / 2 + s * 0.42, y, s * 0.62);
  } else if (kind === 1) pictoNo(c, x, y, s, (cc, X, Y, S) => pictoBroken(cc, X, Y, S));
  else pictoNo(c, x, y, s, (cc, X, Y, S) => pictoCracked(cc, X, Y, S));
}

// the strike chicks' powers as pictograms (animated a little). id: freeze thunder bomb decoy tornado glue
export function pictoPower(c, id, x, y, s, t = 0) {
  c.save(); c.translate(x, y); c.lineCap = 'round'; c.lineJoin = 'round';
  const r = s * 0.42;
  if (id === 'freeze') {
    c.rotate(t * 0.5); c.strokeStyle = '#bfeaff'; c.lineWidth = s * 0.1;
    c.beginPath();
    for (let i = 0; i < 6; i++) { const a = (i * TAU) / 6, ca = Math.cos(a), sa = Math.sin(a); c.moveTo(0, 0); c.lineTo(ca * r, sa * r);
      const bx = ca * r * 0.58, by = sa * r * 0.58, b = r * 0.32; c.moveTo(bx, by); c.lineTo(bx + Math.cos(a + 0.8) * b, by + Math.sin(a + 0.8) * b); c.moveTo(bx, by); c.lineTo(bx + Math.cos(a - 0.8) * b, by + Math.sin(a - 0.8) * b); }
    c.stroke();
  } else if (id === 'thunder') {
    const fl = 0.9 + 0.1 * Math.sin(t * 14);
    c.scale(fl, fl); c.beginPath(); c.moveTo(s * 0.1, -r * 1.05); c.lineTo(-r * 0.55, s * 0.04); c.lineTo(-s * 0.02, s * 0.04); c.lineTo(-s * 0.12, r * 1.05); c.lineTo(r * 0.6, -s * 0.08); c.lineTo(s * 0.04, -s * 0.08); c.closePath();
    c.fillStyle = '#ffe14a'; c.fill(); c.lineWidth = s * 0.07; c.strokeStyle = '#a56a00'; c.stroke();
  } else if (id === 'bomb') {
    const pu = 1 + 0.06 * Math.sin(t * 6);
    c.scale(pu, pu); c.beginPath(); c.arc(0, s * 0.08, r * 0.85, 0, TAU); c.fillStyle = '#3a3036'; c.fill(); c.lineWidth = s * 0.06; c.strokeStyle = ink; c.stroke();
    c.beginPath(); c.moveTo(r * 0.3, -r * 0.55); c.quadraticCurveTo(r * 0.7, -r * 1.0, r * 0.95, -r * 0.7); c.lineWidth = s * 0.07; c.strokeStyle = '#b08a5a'; c.stroke();
    c.beginPath(); c.arc(r * 1.0, -r * 0.8, s * (0.09 + 0.03 * Math.sin(t * 18)), 0, TAU); c.fillStyle = '#ff9b2e'; c.fill();
    c.beginPath(); c.arc(-r * 0.3, -r * 0.1, r * 0.2, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fill();
  } else if (id === 'decoy') {
    c.translate(0, -Math.abs(Math.sin(t * 3)) * s * 0.05); drawEggIcon(c, 0, 0, s * 0.9, 'alive');
    c.fillStyle = '#e8402e'; c.beginPath(); c.arc(-s * 0.1, -s * 0.06, s * 0.055, 0, TAU); c.arc(s * 0.1, -s * 0.06, s * 0.055, 0, TAU); c.fill();
  } else if (id === 'tornado') {
    c.strokeStyle = '#7fe0c4'; c.lineWidth = s * 0.1;
    for (let i = 0; i < 4; i++) { const k = i / 3, w = r * (1.05 - 0.6 * k), yy = -r * 0.85 + k * r * 1.7, ph = Math.sin(t * 5 + i) * s * 0.05;
      c.beginPath(); c.moveTo(-w + ph, yy); c.quadraticCurveTo(0, yy + s * 0.14, w + ph, yy); c.stroke(); }
  } else { // glue: a purple blob with a drip
    const dr = (t * 0.7) % 1;
    c.beginPath(); c.ellipse(0, -s * 0.06, r * 0.95, r * 0.6, 0, 0, TAU); c.fillStyle = '#b070ff'; c.fill(); c.lineWidth = s * 0.06; c.strokeStyle = '#5a2a9a'; c.stroke();
    c.beginPath(); c.ellipse(-r * 0.3, -r * 0.3, r * 0.22, r * 0.12, -0.4, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.45)'; c.fill();
    c.beginPath(); c.ellipse(r * 0.2, r * 0.3 + dr * r * 0.5, s * 0.07, s * 0.1, 0, 0, TAU); c.fillStyle = '#b070ff'; c.fill();
  }
  c.restore();
}
