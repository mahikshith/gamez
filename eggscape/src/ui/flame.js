// The win streak's flame (owner 0.8.18: "We need one single flame, that's it ... a proper burning kind of animated flame").
// ONE teardrop: a single silhouette whose tip licks and sways (waves of layered sines climbing the body), whose body
// breathes, and whose tip now and then splits off a tongue that rises and dies. Nested flat colour layers in the fire
// power-up's own colours (render/fx.js 'flame', render/premium.js flameTongue): a deep red rim, red-orange, orange, yellow
// and a pale hot core low in the body, where the streak number sits. A soft glow on the ground side (one cached sprite),
// a few rising sparks and embers. A longer streak burns taller, wider, faster and hotter; 10 and more get a blue-white
// core. No state, no per-frame gradients, no shadowBlur: every layer is one flat path. save.calm: a still flame, the glow
// breathing slowly, no sparks.
import { FONT } from './ui.js';
const TAU = Math.PI * 2;
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const fract = (x) => x - Math.floor(x);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
let glow = null;
function glowSprite() {
  if (glow) return glow;
  glow = document.createElement('canvas'); glow.width = glow.height = 64;
  const g = glow.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,176,64,0.9)'); r.addColorStop(0.4, 'rgba(255,120,34,0.36)'); r.addColorStop(1, 'rgba(255,90,20,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); return glow;
}
// how hot n wins in a row burn: 0 at 2, about 0.45 at 5, 1 from 10 on
const heatOf = (n) => Math.pow(clamp((n - 2) / 8, 0, 1), 0.72);
// where the hot core (the number's place) sits for a flame of size s: its centre below the flame's centre, and its radius
export function flameCore(s, n = 2) { const h = heatOf(n); return { dx: 0, dy: s * 0.2, r: s * (0.19 + 0.03 * h) }; }

// the teardrop's width along its height (h 0 base .. 1 tip): a round belly low down, a long hollow neck up to the point
const prof = (h) => Math.sqrt(Math.max(0, 1 - Math.pow(1 - Math.min(1, h / 0.34), 2))) * Math.pow(1 - h, 0.95) * (1 - 0.2 * Math.sin(Math.PI * clamp((h - 0.34) / 0.66, 0, 1))) * 1.48;
// the flame's centre line at height ya (0..1 of the whole flame): waves that climb, so the tip whips behind the body
const sway = (ya, T, W) => Math.pow(ya, 1.7) * W * (0.5 * Math.sin(T * 5.3 - ya * 3.1) + 0.3 * Math.sin(T * 8.9 - ya * 5.2 + 1.3) + 0.17 * Math.sin(T * 14.1 - ya * 7.6 + 4));
// one closed teardrop layer: base centre (0, by), H tall, half-width W; yk/H0: this layer's place inside the whole flame
function layer(c, by, H, W, T, H0, W0, N, rip) {
  const pt = (h, sd) => {
    const y = h * H, ya = (by0 - by + y) / H0, env = Math.sin(Math.PI * h);
    const w = W * prof(h) * (1 + rip * env * Math.sin(T * 9.5 - h * 8.5 + sd * 1.9 + 0.6)) + rip * 0.5 * W * env * h * Math.sin(T * 15.3 - h * 12 + sd);
    return [sway(ya, T, W0) + sd * Math.max(0, w), by - y];
  };
  const tip = pt(1, 0);
  c.moveTo(tip[0], tip[1]);
  let prev = tip, pm = null;
  // down the right side, round the base, up the left side: mid-point quadratics, a sharp point only at the tip
  for (let i = 1; i <= 2 * N - 1; i++) {
    const q = i < N ? pt(1 - i / N, 1) : i === N ? [sway((by0 - by) / H0, T, W0), by + W * 0.02] : pt((i - N) / N, -1);
    const m = [(prev[0] + q[0]) / 2, (prev[1] + q[1]) / 2];
    if (!pm) c.lineTo(m[0], m[1]); else c.quadraticCurveTo(prev[0], prev[1], m[0], m[1]);
    pm = m; prev = q;
  }
  c.quadraticCurveTo(prev[0], prev[1], (prev[0] + tip[0]) / 2, (prev[1] + tip[1]) / 2);
  c.lineTo(tip[0], tip[1]);
  c.closePath();
}
let by0 = 0;
// a loose tongue: a little leaf of flame at (x, y), h tall, leaning a
function leaf(c, x, y, h, w, a) {
  const ca = Math.cos(a), sa = Math.sin(a), P = (lx, ly) => [x + lx * ca - ly * sa, y + lx * sa + ly * ca];
  const t = P(0, -h), r = P(w, -h * 0.22), b = P(0, h * 0.18), l = P(-w, -h * 0.22), r2 = P(w * 0.5, -h * 0.62), l2 = P(-w * 0.35, -h * 0.6);
  c.moveTo(t[0], t[1]); c.quadraticCurveTo(r2[0], r2[1], r[0], r[1]); c.quadraticCurveTo(P(w, h * 0.18)[0], P(w, h * 0.18)[1], b[0], b[1]);
  c.quadraticCurveTo(P(-w, h * 0.18)[0], P(-w, h * 0.18)[1], l[0], l[1]); c.quadraticCurveTo(l2[0], l2[1], t[0], t[1]); c.closePath();
}

// centre (x, y), size s (a 2-streak is about 0.95 s tall and its base sits 0.45 s under the centre), n wins in a row, t the
// clock. o.num: draw the count in the hot core (callers that write their own number beside the flame leave it off).
export function streakFlame(c, key, x, y, s, n, t, calm = false, o = null) {
  if (!(s > 0)) return;
  const heat = heatOf(n), blue = n >= 10, small = s < 60;
  const T = calm ? 1.7 : t * (1 + 0.35 * heat) + (key ? key.length * 0.37 : 0);
  const br = 0.5 + 0.5 * Math.sin(t * (calm ? 1.3 : 2.6)); // the glow breathes
  const beat = calm ? 0 : 0.05 * Math.sin(T * 6.1) + 0.035 * Math.sin(T * 10.3 + 2) + 0.025 * Math.sin(T * 17.9 + 1);
  const H = s * (0.95 + 0.4 * heat) * (1 + beat), W = s * (0.3 + 0.045 * heat) * (1 - beat * 0.5);
  const N = small ? 7 : 12, rip = calm ? 0 : small ? 0.07 : 0.11;
  by0 = s * 0.45;
  c.save(); c.translate(x, y); c.lineJoin = 'round';
  // the glow: a halo round the body and a pool of light on the ground side
  const G = glowSprite(), ga = (0.5 + 0.22 * br + 0.2 * heat) * (calm ? 0.85 : 1);
  c.globalAlpha = ga * 0.7; const gs = s * (1.45 + 0.4 * heat + 0.1 * br); c.drawImage(G, -gs / 2, by0 - gs * 0.74, gs, gs);
  c.globalAlpha = ga; const gw = s * (1.05 + 0.2 * heat + 0.08 * br), gh = s * 0.26; c.drawImage(G, -gw / 2, by0 - gh * 0.42, gw, gh);
  c.globalAlpha = 1;
  // tongues that split off the tip, rise and die (two slots, each its own rhythm)
  const tongues = [];
  if (!calm) for (let i = 0; i < (heat > 0.3 ? 3 : 2); i++) {
    const per = 0.9 + i * 0.37, ph = T / per + i * 0.41, k = Math.floor(ph), q = fract(ph);
    if (hash(k * 7.3 + i * 31) < 0.4) continue; // some beats stay quiet
    const sd = hash(k * 3.1 + i) > 0.5 ? 1 : -1, h0 = 0.62 + 0.2 * hash(k + i * 9), up = q * q;
    const ya = h0 + up * 0.5, size = Math.sin(Math.min(1, q * 2.4) * Math.PI * 0.5) * (1 - Math.pow(q, 1.2));
    const wb = W * prof(Math.min(0.97, h0)) * (1 - q), lx = sway(Math.min(1.15, ya), T, W) + sd * (wb * 0.55 + W * 0.3 * q);
    tongues.push([lx, by0 - ya * H, H * (0.16 + 0.08 * hash(k * 1.7 + i)) * size, W * 0.26 * size, sd * (0.18 + 0.35 * q) + 0.12 * Math.sin(T * 11 + i)]);
  }
  const shape = () => { c.beginPath(); layer(c, by0, H, W, T, H, W, N, rip); for (const g of tongues) leaf(c, g[0], g[1], g[2], g[3], g[4]); };
  const C = blue ? ['#b81f0a', '#ff4a12', '#ff9a1c', '#ffe27a', '#8fd6ff', '#f4fcff'] : heat > 0.3 ? ['#c0240b', '#ff5214', '#ff9a1c', '#ffd83a', '#fff6cc'] : ['#c9290d', '#ff5a14', '#ff9420', '#ffd23a', '#fff3b8'];
  // the rim and the red-orange body, loose tongues and all, as one silhouette
  shape(); c.lineWidth = Math.max(1.2, s * 0.045); c.strokeStyle = C[0]; c.stroke(); c.fillStyle = C[1]; c.fill();
  if (!small) { c.beginPath(); for (const g of tongues) leaf(c, g[0], g[1] + g[2] * 0.08, g[2] * 0.55, g[3] * 0.5, g[4]); c.fillStyle = C[2]; c.fill(); }
  // nested layers: orange, yellow (bigger when hotter), each lagging the one outside it so the flame rolls
  const lay = (kh, kw, lift, lag, col) => { c.beginPath(); layer(c, by0 - lift * s, H * kh, W * kw, T - lag, H, W, N, rip * 0.8); c.fillStyle = col; c.fill(); };
  lay(0.74, 0.76, 0.035, 0.05, C[2]);
  lay(0.5 + 0.06 * heat, 0.56 + 0.04 * heat, 0.065, 0.1, C[3]);
  if (blue) lay(0.43, 0.5, 0.075, 0.13, C[4]);
  // the hot core, low in the body: steady, so the number in it is easy to read
  const K = flameCore(s, n);
  c.beginPath(); layer(c, by0 - 0.085 * s, s * (0.4 + 0.04 * heat), s * (blue ? 0.168 : 0.185), calm ? T : T - 0.14, H, W * 0.5, N, 0); c.fillStyle = C[C.length - 1]; c.fill();
  // sparks and embers climbing off it
  if (!calm) {
    const ns = (small ? 3 : 5) + Math.round(5 * heat);
    for (let i = 0; i < ns; i++) {
      const sp = 0.55 + 0.5 * hash(i * 3.7), ph = t * sp * (1 + 0.3 * heat) + hash(i * 9.1) * 7, k = fract(ph), cyc = Math.floor(ph), r1 = hash(cyc * 5.3 + i * 17), r2 = hash(cyc * 2.9 + i * 5);
      const ember = i % 3 === 2, px = (r1 - 0.5) * W * 1.9 + Math.sin(k * 6 + r2 * 9) * s * 0.06 * (0.4 + k), py = by0 - H * (0.45 + 0.35 * r2) - k * H * (0.55 + 0.4 * r1);
      const a = Math.sin(Math.min(1, k * 4) * Math.PI * 0.5) * (1 - k * k), r = Math.max(0.7, s * (ember ? 0.016 : 0.024) * (1 - k * 0.6));
      c.globalAlpha = a; c.fillStyle = ember ? '#ff6a1a' : k < 0.4 ? '#fff0a8' : '#ffc23a';
      c.beginPath();
      if (ember || small) c.arc(px, py, r, 0, TAU); else { c.moveTo(px, py - r * 1.9); c.quadraticCurveTo(px + r, py, px, py + r); c.quadraticCurveTo(px - r, py, px, py - r * 1.9); }
      c.fill();
    }
    c.globalAlpha = 1;
  }
  if (o && o.num) { // the count in the core: dark outline, cream fill, never moving with the fire
    const str = String(n), fs = K.r * (str.length > 1 ? 1.25 : 1.6);
    c.font = `700 ${fs.toFixed(1)}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    c.lineWidth = Math.max(1.5, fs * 0.2); c.strokeStyle = '#5a1c06'; c.strokeText(str, 0, K.dy + fs * 0.06);
    c.fillStyle = '#fffaf0'; c.fillText(str, 0, K.dy + fs * 0.06);
  }
  c.restore();
}
if (typeof __DEV__ === 'undefined' || __DEV__) { try { window.__flame = { streakFlame, flameCore }; } catch (_) { /* no window */ } }
