// The win streak's flame (owner 0.8.10: "a proper, animated flame, not a static one"; 0.8.17: "we have already built the flame
// animation for eggs when they get an egg power up ... we could have simply used that"). It IS the fire egg's flame: the same
// layered tongues, colours and motion (render/powers.js drawFireBody, the body of overlayFire without the face), the same
// flame particles (render/fx.js flameAt, the 'flame' type) and a soft warm glow behind, scaled to the icon. Hotter and taller
// for a longer streak (2, 3, 4, 5+). One little FX per spot (key), no shadowBlur, no big per-frame gradients: the glow is one
// small sprite. save.calm: a slow steady flame, no embers.
import { FX } from '../render/fx.js';
import { drawFireBody } from '../render/powers.js';
import { EGG_H } from '../sim/geom.js';
const fires = new Map(); // key -> { fx, t, acc }
let glow = null;
function glowSprite() {
  if (glow) return glow;
  glow = document.createElement('canvas'); glow.width = glow.height = 64;
  const g = glow.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,170,60,0.85)'); r.addColorStop(0.45, 'rgba(255,110,30,0.32)'); r.addColorStop(1, 'rgba(255,90,20,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); return glow;
}
// centre (x, y), size s like pictoFlame (about 0.9 s tall), n wins in a row (2, 3, 4, 5+), t the clock
export function streakFlame(c, key, x, y, s, n, t, calm = false) {
  const heat = Math.max(0, Math.min(1, (n - 2) / 3)), T = calm ? t * 0.3 : t;
  let F = fires.get(key); if (!F || t < F.t || t - F.t > 0.3) { F = { fx: new FX(), t, acc: 0 }; fires.set(key, F); }
  const dt = Math.min(0.05, t - F.t); F.t = t;
  const hE = s * 0.63 * (1 + 0.17 * heat), m = hE / EGG_H; // the egg's height in pixels, and metres to pixels for the particles
  if (!calm) { // what the fire egg throws every frame (main.js: two flameAt a frame), a little less when the streak is short
    F.fx.update(dt); F.acc += dt * (26 + 30 * heat);
    while (F.acc >= 1) { F.acc -= 1; const a = (Math.random() - 0.5) * 0.26; F.fx.flameAt(a, 0.12 + Math.random() * 0.06, 0.8 + 0.3 * heat); F.fx.flameAt(a * 0.6, 0.02, 0.6); }
  }
  const br = 0.5 + 0.5 * Math.sin(T * 2.4); // the glow breathes
  c.save(); c.translate(x, y);
  c.globalAlpha = (0.55 + 0.25 * br + 0.2 * heat) * (calm ? 0.8 : 1); const gs = s * (1.9 + 0.4 * heat + 0.1 * br); c.drawImage(glowSprite(), -gs / 2, -gs * 0.58, gs, gs); c.globalAlpha = 1;
  c.translate(0, hE * 0.2); // the egg's centre: the flame's middle sits on the icon's centre (the licks rise behind its crown)
  if (!calm) { c.save(); c.scale(m, -m); F.fx.draw(c, 'front'); c.restore(); }
  c.save(); c.scale(hE / 100, hE / 100); drawFireBody(c, T, heat, calm); c.restore();
  c.restore();
}
if (typeof __DEV__ === 'undefined' || __DEV__) { try { window.__flame = { streakFlame, drawFireBody }; } catch (_) { /* no window */ } }
