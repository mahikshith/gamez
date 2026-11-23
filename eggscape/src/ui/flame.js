// The win streak's flame (owner 0.8.10: "a proper, animated flame, not a static one"). A burning body that flickers and
// licks upward, its tongues and embers are the game's own flame particles (render/fx.js flameAt, the 'flame' type), and a
// soft warm glow breathes behind it. Hotter and bigger for a longer streak. One little FX per spot (key), no shadowBlur,
// no big per-frame gradients: the glow is one small sprite. save.calm: a slow gentle flicker, no embers.
import { FX } from '../render/fx.js';
const TAU = Math.PI * 2, ink = 'rgba(70,24,4,0.92)';
const fires = new Map(); // key -> { fx, t, acc }
let glow = null;
function glowSprite() {
  if (glow) return glow;
  glow = document.createElement('canvas'); glow.width = glow.height = 64;
  const g = glow.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,170,60,0.85)'); r.addColorStop(0.45, 'rgba(255,110,30,0.32)'); r.addColorStop(1, 'rgba(255,90,20,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); return glow;
}
// one flame tongue: base at (0, 0), tip at (tx, -h), width w (screen y down)
function tongue(c, tx, h, w, fill, stroke, lw) {
  c.beginPath(); c.moveTo(0, -h);
  c.bezierCurveTo(tx * 0.2 + w * 0.15, -h * 0.62, w * 1.05, -h * 0.34, w * 0.9, -h * 0.06);
  c.bezierCurveTo(w * 0.7, h * 0.12, -w * 0.7, h * 0.12, -w * 0.9, -h * 0.06);
  c.bezierCurveTo(-w * 1.05, -h * 0.34, tx * 0.2 - w * 0.15, -h * 0.62, 0, -h); c.closePath();
  c.fillStyle = fill; c.fill(); if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
}
// centre (x, y), size s like pictoFlame (about 0.9 s tall), n wins in a row (2, 3, 4, 5+), t the clock
export function streakFlame(c, key, x, y, s, n, t, calm = false) {
  const heat = Math.max(0, Math.min(1, (n - 2) / 3)), sp = calm ? 0.3 : 1, T = t * sp, am = calm ? 0.45 : 1;
  let F = fires.get(key); if (!F || t < F.t || t - F.t > 0.3) { F = { fx: new FX(), t, acc: 0 }; fires.set(key, F); }
  const dt = Math.min(0.05, t - F.t); F.t = t;
  const m = s * 0.6; // metres to pixels for the particles
  if (!calm) {
    F.fx.update(dt); F.acc += dt * (14 + 22 * heat);
    while (F.acc >= 1) { F.acc -= 1; const a = (Math.random() - 0.5) * 0.5 * (1 + heat); F.fx.flameAt(a * 0.5, 0.35 + Math.random() * 0.25, 0.8 + 0.5 * heat, 0, 0.5); if (Math.random() < 0.2 + 0.25 * heat) F.fx.add({ x: a * 0.6, y: 0.7, vx: (Math.random() - 0.5) * 0.7, vy: 1.0 + Math.random() * 1.2, drag: 0.5, life: 0.9 + Math.random() * 0.6, size: 0.02 + Math.random() * 0.015, color: heat > 0.5 ? '#ffe27a' : '#ffb347', type: 'dot' }); }
  }
  const sc = 1 + 0.2 * heat, br = 0.5 + 0.5 * Math.sin(T * 2.4); // the body grows with the streak; the glow breathes
  c.save(); c.translate(x, y); c.lineJoin = 'round';
  c.globalAlpha = (0.55 + 0.25 * br + 0.2 * heat) * (calm ? 0.8 : 1); const gs = s * (1.9 + 0.4 * heat + 0.1 * br); c.drawImage(glowSprite(), -gs / 2, -gs * 0.58, gs, gs); c.globalAlpha = 1;
  const f1 = Math.sin(T * 9.1) * 0.5 + Math.sin(T * 15.7 + 1) * 0.5, f2 = Math.sin(T * 11.3 + 2) * 0.5 + Math.sin(T * 7.7) * 0.5, f3 = Math.sin(T * 13.1 + 4);
  c.translate(0, s * 0.3); c.scale(sc, sc);
  const H = s * (0.76 + 0.12 * f1 * am), W = s * 0.27 * (1 - 0.09 * f1 * am), lw = s * 0.04; // the whole body stretches and thins as it licks up, then sinks back wider
  c.save(); c.translate(-W * 0.9, 0); tongue(c, (-0.1 + 0.16 * f2 * am) * s, H * (0.6 + 0.17 * f2 * am), W * 0.55, '#ef4a18', ink, lw); c.restore(); // the side tongues lick up on their own beat
  c.save(); c.translate(W * 0.95, 0); tongue(c, (0.1 + 0.16 * f3 * am) * s, H * (0.5 + 0.17 * f3 * am), W * 0.5, '#ef4a18', ink, lw); c.restore();
  tongue(c, (0.26 * f2 + 0.1 * f3) * s * am, H, W, '#ff7a1c', ink, s * 0.055); // the body, its tip swaying
  tongue(c, (0.16 * f2 + 0.05 * f1) * s * am, H * (0.7 + 0.07 * f3 * am), W * 0.66, '#ffb02e', null, 0);
  tongue(c, (0.04 * f3) * s * am, H * (0.42 + 0.05 * f2 * am), W * 0.4, heat > 0.5 ? '#fff3b0' : '#ffe066', null, 0); // the core, whiter when hotter
  if (!calm) { c.save(); c.scale(m / sc, -m / sc); F.fx.draw(c, 'front'); c.restore(); } // the tongues and embers leaving the body (the game's flame particles)
  c.restore();
}
