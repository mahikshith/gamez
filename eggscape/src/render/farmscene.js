// The Farm's five level scenes (2026-11-20, mykee: "should we apply the same [hen house, hay bales] into the existing
// game as well, like backgrounds?"). World 1's map (mapfarm.js) shows the farm as one place with five landmarks; the
// five level backdrops are those same places seen side-on, at eye level, in the same painting language: light from
// the upper left, soft lit/shaded faces, thin dark-tinted outlines, warm storybook colours.
//
//   coop      Hen House     bright morning: the hen house on stilts right behind the hen and the nest
//   hayfield  Haystacks     late morning: a golden stubble field, big stacked bales both sides, a hay cart
//   pond      Duck Pond     midday: the pond across the mid-ground, a jetty, a willow, the goose paddling
//   windmill  Windmill      afternoon: the mill tall on its rise among the wheat, its sails turning
//   redbarn   Big Red Barn  golden dusk: the barn looming, doors open on a warm glow, crows on the ridge
//
// Each scene follows the ART contract in themes.js (sky / far / near painters baked ONCE per size into layer
// canvases; back / front are the few live touches drawn per frame). Layout: the vault covers the middle of the
// screen, so each landmark stands beside and behind it at the lower left or right, rising from the horizon; behind
// the vault the scene stays calm and hazy. Live touches are pure functions of the clock, a few path ops or one small
// sprite each, and hold still (or are left out) on Low graphics and with Reduced motion.
import { PERF } from '../perf.js';
import { drawRooster, roosterPose } from './allies.js';
import { drawChick } from './characters.js';

let CALM = false;
export function setSceneCalm(v) { CALM = !!v; } // main.js: save.calm, every frame
const still = () => CALM || PERF.low;
// the layer transform for live bits: on Low the backdrop is one flat picture without parallax, so they sit on it 1:1
// 2026-11-20 (mykee: "background should not distract... it shouldn't be that bright. It could be kind of off colour"):
// the whole scene stands behind a veil. The near layer is washed toward the sky's pale colour when it is baked (flat,
// and more behind the vault), every living thing is baked with the same wash, and whatever is drawn per frame goes
// on at LIVE_A. Nothing in the backdrop keeps a pure, saturated colour: those belong to rings, eggs and thorns.
const VEIL = { flat: 0.42, sprite: 0.36, col: '#eef3f0' }, LIVE_A = 0.8;
function veilSprite(c, cv) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop'; c.fillStyle = rgba(VEIL.col, VEIL.sprite); c.fillRect(0, 0, cv.width, cv.height); c.restore(); }
function tfL(ctx, S, f) { if (PERF.low) { ctx.save(); ctx.translate(-S.M, -S.M); } else S.tf(ctx, f); ctx.globalAlpha = LIVE_A; }

// ------------------------------------------------------------------ colour and painting kit
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const HEX = new Map();
const hexRgb = (h) => { let v = HEX.get(h); if (!v) { let s = h.slice(1); if (s.length === 3) s = s.replace(/./g, '$&$&'); const n = parseInt(s, 16); v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; HEX.set(h, v); } return v; };
const rgbHex = (c) => '#' + c.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const A = hexRgb(a), B = hexRgb(b); return rgbHex(A.map((v, i) => lerp(v, B[i], t))); };
const rgba = (h, a) => { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; };
const shade = (h, k) => (k >= 0 ? mix(h, '#ffffff', k) : mix(h, '#000000', -k));
const inkOf = (h, k = 0.6) => mix(h, '#2a1406', k); // thin dark-tinted outlines, never flat black
const warm = (h, k = 0.3) => mix(h, '#fff3d0', k);

function grad(c, x0, y0, x1, y1, stops) { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach((s, i) => (Array.isArray(s) ? g.addColorStop(s[0], s[1]) : g.addColorStop(i / (stops.length - 1), s))); return g; }
const vg = (c, y0, y1, stops) => grad(c, 0, y0, 0, y1, stops);
function radial(c, x, y, r0, r1, stops) { const g = c.createRadialGradient(x, y, r0, x, y, r1); stops.forEach((s, i) => (Array.isArray(s) ? g.addColorStop(s[0], s[1]) : g.addColorStop(i / (stops.length - 1), s))); return g; }
function path(c, p) { c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.closePath(); }
function shape(c, p, fill, ink, lw) { path(c, p); if (fill) { c.fillStyle = fill; c.fill(); } if (ink) { c.strokeStyle = ink; c.lineWidth = lw || 1; c.lineJoin = 'round'; c.stroke(); } }
function rect(c, x, y, w, h, f) { c.fillStyle = f; c.fillRect(x, y, w, h); }
function ell(c, x, y, rx, ry, f, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(0.05, rx), Math.max(0.05, ry), rot, 0, TAU); c.fillStyle = f; c.fill(); }
function circle(c, x, y, r, f) { ell(c, x, y, r, r, f); }
function line(c, x0, y0, x1, y1, col, w) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.strokeStyle = col; c.lineWidth = w; c.stroke(); }
function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); }
function glow(c, x, y, r, col, a = 1) { c.fillStyle = radial(c, x, y, 0, r, [rgba(col, a), rgba(col, a * 0.35), rgba(col, 0)]); c.fillRect(x - r, y - r, r * 2, r * 2); }
function softShadow(c, x, y, rx, ry, col, a) { c.save(); c.translate(x, y); c.scale(1, ry / rx); c.fillStyle = radial(c, 0, 0, 0, rx, [rgba(col, a), rgba(col, a * 0.55), rgba(col, 0)]); c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill(); c.restore(); }
// a wavy line across the layer: y(x)
function wave(R, y0, amp, wl) { const p = [R() * TAU, R() * TAU, R() * TAU]; return (x) => y0 + amp * (0.6 * Math.sin(x / wl * TAU + p[0]) + 0.3 * Math.sin(x / (wl * 0.43) * TAU + p[1]) + 0.1 * Math.sin(x / (wl * 0.17) * TAU + p[2])); }
function under(c, W, H, fn, step = 4) { c.beginPath(); c.moveTo(-4, H + 4); for (let x = -4; x <= W + step; x += step) c.lineTo(x, fn(x)); c.lineTo(W + step, H + 4); c.closePath(); }
function fillUnder(c, W, H, fn, f, step) { under(c, W, H, fn, step); c.fillStyle = f; c.fill(); }
function edge(c, W, fn, col, w, step = 4) { c.beginPath(); for (let x = -4; x <= W + step; x += step) x < 0 ? c.moveTo(x, fn(x)) : c.lineTo(x, fn(x)); c.strokeStyle = col; c.lineWidth = w; c.stroke(); }
// a lumpy closed blob through n points around (x, y)
function blob(c, x, y, rx, ry, R, n = 9, j = 0.18) {
  const pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, k = 1 + R.r(-j, j); pts.push([x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k]); }
  c.beginPath(); c.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; c.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
  c.closePath();
}
function blade(c, x, y, h, lean, wd, col) { c.beginPath(); c.moveTo(x - wd, y); c.quadraticCurveTo(x - wd * 0.4 + lean * 0.35, y - h * 0.6, x + lean, y - h); c.quadraticCurveTo(x + wd * 0.6 + lean * 0.3, y - h * 0.5, x + wd, y); c.closePath(); c.fillStyle = col; c.fill(); }
function tuft(c, x, y, h, R, cols, lean = 0) { const n = R.i(4, 7); for (let i = 0; i < n; i++) { const t = (i + 0.5) / n - 0.5; blade(c, x + t * h * 0.6, y, h * R.r(0.55, 1), t * h * 0.8 + lean * h + R.r(-0.1, 0.1) * h, h * 0.07, cols[i % cols.length]); } }
function daisy(c, x, y, r, col, mid = '#ffd23f') { for (let p = 0; p < 5; p++) { const a = p * 1.2566 - 1.57; ell(c, x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.48, r * 0.5, r * 0.36, col, a); } ell(c, x, y, r * 0.34, r * 0.3, mid); }

// a soft storybook cloud (static, baked): a flat-bottomed heap of puffs, lit from the upper left
function cloud(c, x, y, w, R, lit = '#ffffff', body = '#f2f8fc', sh = '#c9dcec', a = 1) {
  const n = 5 + R.i(0, 2), P = [];
  for (let i = 0; i < n; i++) { const t = i / (n - 1), r = w * (0.13 + 0.12 * Math.sin(t * Math.PI)) * R.r(0.85, 1.15); P.push([x - w / 2 + t * w, y - r * 0.55 - Math.sin(t * Math.PI) * w * 0.06, r]); }
  c.save(); c.globalAlpha = a;
  for (const [px, py, r] of P) circle(c, px + r * 0.08, py + r * 0.14, r, sh);
  rect(c, x - w / 2, y - w * 0.06, w, w * 0.07, sh);
  for (const [px, py, r] of P) circle(c, px, py, r * 0.97, body);
  rr(c, x - w / 2, y - w * 0.1, w, w * 0.08, w * 0.04); c.fillStyle = body; c.fill();
  for (const [px, py, r] of P) { c.save(); c.beginPath(); c.arc(px, py, r * 0.97, 0, TAU); c.clip(); circle(c, px - r * 0.25, py - r * 0.3, r * 0.8, lit); c.restore(); }
  c.restore();
}
// a round deciduous tree, side view: trunk, three tones of crown lit from the upper left
function tree(c, x, y, s, R, cols, trunk) {
  const [dk, md, lt] = cols;
  c.fillStyle = trunk; c.beginPath(); c.moveTo(x - s * 0.07, y); c.lineTo(x - s * 0.04, y - s * 0.55); c.lineTo(x + s * 0.04, y - s * 0.55); c.lineTo(x + s * 0.08, y); c.closePath(); c.fill();
  const L = [[0, -0.78, 0.36], [-0.26, -0.62, 0.27], [0.27, -0.6, 0.28], [-0.12, -1.0, 0.25], [0.16, -0.95, 0.24]];
  for (const [dx, dy, r] of L) circle(c, x + dx * s + s * 0.03, y + dy * s + s * 0.04, r * s, dk);
  for (const [dx, dy, r] of L) circle(c, x + dx * s, y + dy * s, r * s * 0.94, md);
  for (const [dx, dy, r] of L) circle(c, x + dx * s - r * s * 0.28, y + dy * s - r * s * 0.32, r * s * 0.55, lt);
}
// a leafy shrub: overlapping leaf clumps in three tones with a thin dark-tinted rim, lit from the upper left
function bush(c, x, y, w, h, R, cols, flowers) {
  const [dk, md, lt] = cols, ink = inkOf(dk, 0.45), n = Math.max(4, Math.round(w / h * 3)), L = [];
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, arch = Math.sin(t * Math.PI); L.push([x - w / 2 + t * w + R.r(-0.04, 0.04) * w, y - h * (0.28 + 0.42 * arch) * R.r(0.85, 1.1), h * (0.26 + 0.2 * arch) * R.r(0.85, 1.15)]); }
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; L.push([x - w / 2 + t * w, y - h * 0.22, h * 0.3]); }
  const lw = Math.max(0.8, h * 0.035);
  for (const [px, py, r] of L) circle(c, px, py, r + lw, ink);
  for (const [px, py, r] of L) circle(c, px, py, r, dk);
  for (const [px, py, r] of L) { c.save(); c.beginPath(); c.arc(px, py, r, 0, TAU); c.clip(); circle(c, px - r * 0.16, py - r * 0.2, r * 0.86, md); circle(c, px - r * 0.42, py - r * 0.5, r * 0.62, lt); c.restore(); }
  // leaf notches along the lit rims
  for (const [px, py, r] of L) for (let k = 0; k < 3; k++) { const a = -2.2 + k * 0.55 + R.r(-0.2, 0.2); ell(c, px + Math.cos(a) * r * 0.82, py + Math.sin(a) * r * 0.82, r * 0.16, r * 0.09, md, a); }
  if (flowers) for (let i = 0; i < n; i++) { const [px, py, r] = L[R.i(0, L.length - 1)]; daisy(c, px + R.r(-0.5, 0.5) * r, py + R.r(-0.4, 0.4) * r, h * 0.07, R.pick(flowers)); }
}
// a post-and-rail field fence along y = fn(x) between x0 and x1
function railFence(c, x0, x1, fn, gap, h, col, R) {
  const dk = shade(col, -0.38), lt = warm(col, 0.35), ink = inkOf(col, 0.55);
  for (const k of [0.42, 0.78]) {
    c.beginPath(); for (let x = x0; x <= x1 + 2; x += 3) { const y = fn(x) - h * k; x === x0 ? c.moveTo(x, y) : c.lineTo(x, y); }
    c.strokeStyle = ink; c.lineWidth = h * 0.15; c.stroke();
    c.save(); c.translate(0, -h * 0.02); c.strokeStyle = col; c.lineWidth = h * 0.1; c.stroke(); c.translate(0, -h * 0.03); c.strokeStyle = lt; c.lineWidth = h * 0.035; c.stroke(); c.restore();
  }
  for (let x = x0 + gap * 0.2; x <= x1; x += gap * (R ? R.r(0.85, 1.15) : 1)) {
    const y = fn(x), pw = h * 0.13, ph = h * (R ? R.r(0.98, 1.08) : 1);
    shape(c, [x - pw, y, x - pw, y - ph, x - pw * 0.3, y - ph - pw * 0.6, x + pw, y - ph, x + pw, y], col, ink, h * 0.04);
    rect(c, x + pw * 0.15, y - ph, pw * 0.85, ph, dk); rect(c, x - pw * 0.85, y - ph, pw * 0.45, ph, lt);
  }
}
// a swallow in flight (live): forked tail, swept wings, a few path ops
function swallow(ctx, x, y, s, flap, dir) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s);
  const f = flap;
  ctx.fillStyle = '#28324a';
  ctx.beginPath(); ctx.moveTo(4, 0); ctx.quadraticCurveTo(1, -1.2, -3, -0.4); ctx.lineTo(-7, -1.6); ctx.lineTo(-4.4, 0.1); ctx.lineTo(-7, 1.4); ctx.lineTo(-3, 0.5); ctx.quadraticCurveTo(1, 1.2, 4, 0); ctx.fill();
  ctx.beginPath(); ctx.moveTo(1.5, -0.3); ctx.quadraticCurveTo(-1, -4 * f - 1, -5.5, -6 * f); ctx.quadraticCurveTo(-2, -2.5 * f, -1.5, 0.2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(1.5, 0.2); ctx.quadraticCurveTo(-0.5, 3 * f + 0.6, -4.5, 4.2 * f); ctx.quadraticCurveTo(-1.6, 1.8 * f, -1.2, 0.4); ctx.fill();
  ctx.fillStyle = '#e8743a'; ctx.beginPath(); ctx.arc(3.3, 0.1, 0.7, 0, TAU); ctx.fill();
  ctx.restore();
}
function swallows(ctx, t, S, n = 2) {
  if (still()) return;
  const { u, W } = S; tfL(ctx, S, 0.15);
  for (let i = 0; i < n; i++) {
    const per = 15 + i * 4.3, k = ((t + i * 6.1) % per) / per, dir = i % 2 ? -1 : 1, span = W + 40 * u;
    const x = dir > 0 ? -20 * u + k * span : W + 20 * u - k * span, y = S.H * (0.16 + i * 0.07) + Math.sin(k * TAU * 1.5 + i) * 6 * u;
    const flap = 0.6 + 0.5 * Math.sin(t * (11 + i * 2) + i), glide = (Math.sin(k * TAU * 3 + i) > 0.3) ? 0.35 : flap;
    swallow(ctx, x, y, 0.55 * u, glide, dir);
  }
  ctx.restore();
}

// ------------------------------------------------------------------ the shared scene frame
// Screen-anchored placement: X(k) is a screen fraction in layer coords; the landmark stands beside the vault.
function frameOf(S) {
  const { M, w, h, u, port } = S, R0 = Math.min(w, h) * 0.5;
  // the side of the vault (screen px from the centre) where a landmark is seen clear of the rings
  const side = port ? w * 0.36 : Math.min(w * 0.36, R0 * 1.42 + 14 * u);
  return { X: (k) => M + w * k, Y: (k) => M + h * k, cx: M + w / 2, side, R0 };
}
// sky: a vertical gradient to the horizon, a soft sun glow at the upper left, a few baked clouds clear of the HUD
function paintSky(c, S, o) {
  const { W, H, u, hz, R } = S;
  rect(c, 0, 0, W, H, vg(c, 0, hz + 6 * u, o.sky));
  if (o.sun) { const [sx, sy, col, r] = o.sun; glow(c, W * sx, H * sy, r * u, col, 0.55); glow(c, W * sx, H * sy, r * 0.35 * u, col, 0.6); }
  if (o.band) rect(c, 0, hz - 30 * u, W, 36 * u, vg(c, hz - 30 * u, hz + 6 * u, [rgba(o.band, 0), rgba(o.band, 0.55)]));
  for (const [fx, fy, fw, a] of o.clouds || []) cloud(c, W * fx, H * fy, fw * u, R, o.cl[0], o.cl[1], o.cl[2], a);
}

// behind the vault the near layer goes a little lighter and hazier, so rings, eggs and red thorns read at a glance
// (baked; source-atop: only what the near layer painted, the sky and far layers have their own haze)
function vaultHaze(c, S, col, a) {
  const { w, h, M, port } = S, m = Math.min(w, h), x = M + w * (port ? 0.5 : 0.58), y = M + h * (port ? 0.49 : 0.46);
  c.save(); c.globalCompositeOperation = 'source-atop';
  c.fillStyle = rgba(col, VEIL.flat); c.fillRect(0, 0, S.W, S.H); // the whole near layer steps back
  c.fillStyle = radial(c, x, y, m * 0.2, m * 0.64, [[0, rgba(col, a)], [0.55, rgba(col, a * 0.7)], [1, rgba(col, 0)]]); c.fillRect(0, 0, S.W, S.H);
  c.restore();
}

// ------------------------------------------------------------------ 1. the Hen House
const WOOD = { base: '#c08a55', hi: '#e0b07a', lo: '#8e6038', ink: '#5a3418' };
const RED = { base: '#c8412f', hi: '#e05a43', lo: '#962d22', ink: '#5e1a12' };
const CREAM = { base: '#f6ead0', lo: '#d8c49e' };
const STRAW = { base: '#f1c55a', hi: '#fbe39a', lo: '#c8923a', ink: '#8a5a22' };

// planks: vertical boards clipped to the current path
function boards(c, x0, x1, y0, y1, step, R, dark, light) {
  for (let x = x0 + step; x < x1; x += step) { line(c, x, y0, x, y1, dark, 0.9); line(c, x + 1.1, y0, x + 1.1, y1, light, 0.6); }
  for (let x = x0; x < x1; x += step) { if (R() < 0.35) rect(c, x + 1.5, y0, step - 2, y1 - y0, R() < 0.5 ? 'rgba(255,240,210,0.1)' : 'rgba(70,36,12,0.08)'); if (R() < 0.3) ell(c, x + step * R.r(0.3, 0.7), lerp(y0, y1, R()), 1.1, 1.6, 'rgba(80,44,16,0.45)'); }
}
// the hen house, side view (unit space: c translated to the front foot centre and scaled; y up is negative).
// The gable front faces the viewer, lit; the long side recedes to the right in shade with two nest boxes on it.
function paintCoop(c, R) {
  const W1 = WOOD.base, ink = WOOD.ink, D = [40, -9], SH = 50, WT = -122, AP = -158, FX = 40;
  // the shade under the house on the ground, and its cast shadow thrown to the lower right
  softShadow(c, 18, 2, 92, 9, '#2a3a10', 0.38);
  // back stilts and the floor's underside
  for (const x of [-34, 34]) shape(c, [x + D[0] - 3, D[1] + 3, x + D[0] - 3, -SH + D[1], x + D[0] + 3, -SH + D[1], x + D[0] + 3, D[1] + 3], mix(W1, '#3a2410', 0.55));
  shape(c, [-FX, -SH, FX, -SH, FX + D[0], -SH + D[1], -FX + D[0], -SH + D[1]], mix(W1, '#3a2410', 0.6));
  rect(c, -FX + 4, -SH, FX * 2 + D[0] - 6, 6, 'rgba(40,20,6,0.35)');
  // the side wall (in shade): boards, two nest boxes with red lids
  const side = [FX, -SH, FX + D[0], -SH + D[1], FX + D[0], WT + D[1], FX, WT];
  shape(c, side, grad(c, FX, 0, FX + D[0], 0, [WOOD.lo, mix(W1, '#3a2410', 0.4)]), ink, 1.1);
  c.save(); path(c, side); c.clip();
  for (let k = 1; k < 6; k++) { const a = k / 6, x = FX + D[0] * a; line(c, x, -SH + D[1] * a + 2, x, WT + D[1] * a - 2, 'rgba(50,26,8,0.45)', 0.9); }
  rect(c, FX, WT - 20, D[0], 16, 'rgba(30,14,4,0.35)'); // under the eave
  c.restore();
  // the front: a gable end of vertical boards, lit from the upper left
  const front = [-FX, -SH, FX, -SH, FX, WT, 0, AP + 4, -FX, WT];
  shape(c, front, grad(c, -FX, AP, FX, -SH, [warm(WOOD.hi, 0.2), W1, mix(W1, WOOD.lo, 0.45)]), ink, 1.2);
  c.save(); path(c, front); c.clip();
  boards(c, -FX, FX, AP, -SH, 8, R, 'rgba(90,48,18,0.5)', 'rgba(255,232,190,0.4)');
  rect(c, -FX, -SH - 8, FX * 2, 8, 'rgba(70,34,10,0.2)'); // weathering low down
  rect(c, -FX, WT - 2, FX * 2, 10, 'rgba(50,24,6,0.28)'); // the eave's shadow on the wall
  c.restore();
  // corner trims
  shape(c, [-FX - 1.5, -SH + 1, -FX + 4, -SH + 1, -FX + 4, WT + 1, -FX - 1.5, WT + 1], CREAM.base, CREAM.lo, 0.7);
  shape(c, [FX - 4, -SH + 1, FX + 1.5, -SH + 1, FX + 1.5, WT + 1, FX - 4, WT + 1], CREAM.lo, inkOf(CREAM.lo, 0.4), 0.7);
  shape(c, [-FX - 2, -SH + 3, FX + 2, -SH + 3, FX + 2, -SH - 2, -FX - 2, -SH - 2], WOOD.lo, ink, 0.8); // sill board
  // the round window in the gable
  circle(c, 0, -134, 9.5, CREAM.base); circle(c, 0, -134, 7.4, '#3a2a1e');
  c.save(); c.beginPath(); c.arc(0, -134, 7.4, 0, TAU); c.clip(); circle(c, -3, -137, 7, 'rgba(160,214,242,0.55)'); c.restore();
  c.strokeStyle = CREAM.base; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-7.4, -134); c.lineTo(7.4, -134); c.moveTo(0, -141.4); c.lineTo(0, -126.6); c.stroke();
  c.strokeStyle = inkOf(CREAM.lo, 0.3); c.lineWidth = 0.7; c.beginPath(); c.arc(0, -134, 9.5, 0, TAU); c.stroke();
  // a square window with shutters and a flower box (right of the door)
  const wx = 8, wy = -108, ww = 22, wh = 20;
  shape(c, [wx - 2, wy - 2, wx + ww + 2, wy - 2, wx + ww + 2, wy + wh + 2, wx - 2, wy + wh + 2], CREAM.base, inkOf(CREAM.lo, 0.35), 0.8);
  shape(c, [wx, wy, wx + ww, wy, wx + ww, wy + wh, wx, wy + wh], '#3a2a20');
  c.save(); path(c, [wx, wy, wx + ww, wy, wx + ww, wy + wh, wx, wy + wh]); c.clip(); shape(c, [wx, wy, wx + ww * 0.7, wy, wx, wy + wh * 0.8], 'rgba(170,220,245,0.5)'); c.restore();
  line(c, wx + ww / 2, wy, wx + ww / 2, wy + wh, CREAM.base, 1.4); line(c, wx, wy + wh / 2, wx + ww, wy + wh / 2, CREAM.base, 1.4);
  shape(c, [wx - 9, wy - 1, wx - 3, wy - 1, wx - 3, wy + wh + 1, wx - 9, wy + wh + 1], RED.base, RED.ink, 0.8);
  line(c, wx - 8, wy + 4, wx - 4, wy + wh - 4, 'rgba(90,20,10,0.5)', 0.7);
  shape(c, [wx - 4, wy + wh + 2, wx + ww + 4, wy + wh + 2, wx + ww + 3, wy + wh + 8, wx - 3, wy + wh + 8], WOOD.lo, ink, 0.8);
  for (let k = 0; k < 6; k++) { const fx = wx - 2 + k * 5, fy = wy + wh + 1 + (k % 2) * 1.5; circle(c, fx, fy + 1, 2.6, '#4f8f36'); daisy(c, fx + 0.5, fy - 1, 3.3, k % 3 === 1 ? '#ff8fb8' : k % 3 ? '#ffffff' : '#ffd84a', k % 3 === 0 ? '#e88a1a' : '#ffd23f'); }
  // the pop hole: an arched little door at the lower left, dark inside, straw spilling out
  c.beginPath(); c.moveTo(-31, -SH); c.lineTo(-31, -70); c.arc(-21, -70, 10, Math.PI, 0); c.lineTo(-11, -SH); c.closePath(); c.fillStyle = CREAM.base; c.fill(); c.strokeStyle = inkOf(CREAM.lo, 0.35); c.lineWidth = 0.8; c.stroke();
  c.beginPath(); c.moveTo(-28.5, -SH); c.lineTo(-28.5, -70); c.arc(-21, -70, 7.5, Math.PI, 0); c.lineTo(-13.5, -SH); c.closePath(); c.fillStyle = vg(c, -78, -SH, ['#1e1208', '#3e2814']); c.fill();
  c.strokeStyle = STRAW.base; c.lineWidth = 1.2; c.lineCap = 'round'; for (const [x, a] of [[-26, -0.5], [-23, 0.2], [-19, -0.25], [-16, 0.45], [-21, 0.9]]) { c.beginPath(); c.moveTo(x, -SH - 0.5); c.lineTo(x + Math.sin(a) * 6, -SH - 3.5); c.stroke(); }
  // the roof: the right plane in red shingles going back over the side wall, barge boards on the gable
  const r0 = [FX + 6, WT + 4], ap = [0, AP - 2], ra = [ap[0] + D[0], ap[1] + D[1]], rb = [r0[0] + D[0], r0[1] + D[1]];
  const roof = [r0[0], r0[1], ap[0], ap[1], ra[0], ra[1], rb[0], rb[1]];
  shape(c, roof, grad(c, ap[0], ap[1], rb[0], rb[1], [RED.hi, RED.base, RED.lo]), RED.ink, 1.1);
  c.save(); path(c, roof); c.clip();
  for (let k = 1; k <= 7; k++) {
    const a = k / 7.4, xa = lerp(ap[0], r0[0], a), ya = lerp(ap[1], r0[1], a);
    line(c, xa, ya, xa + D[0], ya + D[1], 'rgba(90,18,8,0.55)', 1);
    for (let q = 0; q < 6; q++) { const v = (q + (k % 2) * 0.5) / 6, x = xa + D[0] * v, y = ya + D[1] * v; line(c, x, y, x - 2.6, y - 4.2, 'rgba(90,18,8,0.4)', 0.7); }
  }
  shape(c, [ap[0], ap[1], ra[0], ra[1], ra[0] + 5, ra[1] + 5, ap[0] + 5, ap[1] + 5], 'rgba(255,214,190,0.3)');
  c.restore();
  // barge boards: a thick red edge with a light top
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.strokeStyle = RED.ink; c.lineWidth = 7; c.beginPath(); c.moveTo(-FX - 8, WT + 7); c.lineTo(ap[0], ap[1] - 1); c.lineTo(r0[0] + 2, r0[1] + 3); c.stroke();
  c.strokeStyle = '#b23a2a'; c.lineWidth = 4.8; c.stroke();
  c.strokeStyle = 'rgba(255,196,176,0.7)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-FX - 7, WT + 5); c.lineTo(ap[0], ap[1] - 3); c.stroke();
  line(c, ap[0], ap[1] - 1, ra[0], ra[1] - 1, RED.ink, 3); line(c, ap[0], ap[1] - 2, ra[0], ra[1] - 2, '#d9533e', 1.2); // ridge cap
  // a little rooster weather vane on the ridge
  const vx = ap[0] + D[0] * 0.35, vy = ap[1] + D[1] * 0.35;
  line(c, vx, vy, vx, vy - 26, '#3a3438', 1.4); line(c, vx - 8, vy - 12, vx + 8, vy - 12, '#3a3438', 1.1); circle(c, vx, vy - 2, 1.8, '#3a3438');
  c.fillStyle = '#3a3438'; c.beginPath(); c.moveTo(vx - 9, vy - 22); c.quadraticCurveTo(vx - 4, vy - 29, vx + 2, vy - 25); c.lineTo(vx + 4, vy - 30); c.lineTo(vx + 7, vy - 27); c.lineTo(vx + 5, vy - 22); c.quadraticCurveTo(vx, vy - 19, vx - 9, vy - 22); c.fill();
  c.beginPath(); c.moveTo(vx - 9, vy - 22); c.lineTo(vx - 13, vy - 28); c.lineTo(vx - 12, vy - 21); c.fill();
  // two nest boxes bolted to the side wall: a box, a sloped red lid, straw, an egg in the near one
  for (let i = 0; i < 2; i++) {
    const bx = FX + 6 + i * 17, by = -70 + D[1] * ((bx - FX) / D[0]) - 2;
    shape(c, [bx - 1, by, bx + 14, by - 3, bx + 14, by - 19, bx - 1, by - 16], mix(W1, WOOD.lo, 0.5), ink, 0.9);
    c.beginPath(); c.ellipse(bx + 6.5, by - 7.5, 6, 3.6, -0.18, 0, TAU); c.fillStyle = '#2e1c0c'; c.fill();
    c.strokeStyle = STRAW.base; c.lineWidth = 1; for (let k = 0; k < 6; k++) { const x = bx + 1.5 + k * 2.2; line(c, x, by - 5 - (k % 3) * 0.8, x + (k % 2 ? 2.2 : -1.6), by - 1.5, k % 2 ? STRAW.hi : STRAW.base, 1); }
    if (i === 0) { ell(c, bx + 7, by - 8, 3, 3.8, '#fbf3e2', -0.15); ell(c, bx + 6, by - 9.4, 1, 1.4, '#ffffff'); }
    shape(c, [bx - 3, by - 15, bx + 16, by - 19, bx + 17, by - 24, bx - 2, by - 21], RED.base, RED.ink, 0.9);
    line(c, bx - 2.5, by - 16.5, bx + 16.5, by - 20.5, 'rgba(255,190,170,0.6)', 0.8);
  }
  // front stilts (lit) with a cross brace
  for (const x of [-34, 34]) shape(c, [x - 3.5, 2, x - 3.5, -SH, x + 3.5, -SH, x + 3.5, 2], grad(c, x - 3.5, 0, x + 3.5, 0, [WOOD.hi, W1, WOOD.lo]), ink, 1);
  c.lineCap = 'butt'; line(c, -31, -8, 31, -SH + 6, inkOf(W1, 0.4), 3); line(c, -31, -8.6, 31, -SH + 5.4, W1, 1.6);
  // the ramp: from the pop hole down to the yard on the left, with cleats
  const rp = [[-31, -SH + 1], [-11, -SH + 1], [-60, 2], [-82, 2]];
  shape(c, [rp[3][0], rp[3][1], rp[2][0], rp[2][1], rp[2][0] + 1, rp[2][1] + 3.5, rp[3][0] + 1, rp[3][1] + 3.5], inkOf(W1, 0.5));
  shape(c, [rp[0][0], rp[0][1], rp[1][0], rp[1][1], rp[2][0], rp[2][1], rp[3][0], rp[3][1]], grad(c, -82, 0, -11, -SH, [W1, WOOD.hi]), ink, 1);
  for (let k = 1; k < 6; k++) { const a = k / 6; line(c, lerp(-31, -82, a) + 1, lerp(-SH, 2, a), lerp(-11, -60, a) - 1, lerp(-SH, 2, a), inkOf(W1, 0.45), 2.2); line(c, lerp(-31, -82, a) + 1, lerp(-SH, 2, a) - 1.3, lerp(-11, -60, a) - 1, lerp(-SH, 2, a) - 1.3, WOOD.hi, 0.8); }
  // the yard under it: a feed trough and a water dish to the right
  shape(c, [FX + 12, -1, FX + 46, -4, FX + 47, -13, FX + 12, -10], WOOD.lo, ink, 0.9); shape(c, [FX + 12, -10, FX + 47, -13, FX + 50, -16, FX + 15, -13], '#e8b84a', STRAW.ink, 0.8);
  for (let k = 0; k < 7; k++) circle(c, FX + 16 + k * 4.4, -12.6 - (k % 2) * 0.6, 1, '#f6d27a');
  ell(c, FX + 58, 0, 8, 2.8, '#6e7e8a'); ell(c, FX + 58, -1, 6.4, 1.9, '#a8e0f2'); ell(c, FX + 56, -1.5, 2.2, 0.6, 'rgba(255,255,255,0.8)');
}
export const COOP_SIZE = { w: 150, h: 190 }; // unit extents (ramp foot .. dish, ground .. vane)

const coop = {
  atmo: { haze: ['#e8f6ff', 0.34, 22], bloom: ['#fffbe8', 0.35, 10], key: ['#fff1c0', 0.07], shadow: ['#14361e', 0.2] },
  frame: { kit: 'leafy', cols: ['#3a2a1a', '#1c5a2a', '#2c7a34', '#4c9c40'], flowers: ['#ffffff', '#ffe066', '#ff9ec7'], tone: ['#0a2a1c', 0.2], noTop: true },
  stage: { top: '#cfa458', soil: '#6b4a2b', straw: ['#f3d27a', '#e2b955', '#c99a3c', '#fff0b0'], tufts: ['#4f9a36', '#6ab443', '#8acb52'] },
  veil: ['#dff2ff', 0.2], punch: 0.2,
  prep(S) { S.F = frameOf(S); S.live = null; },
  sky(c, S) {
    paintSky(c, S, {
      sky: [[0, '#3f9fe6'], [0.55, '#8ccff3'], [0.85, '#d4effa'], [1, '#f4fbf6']],
      sun: [0.1, 0.07, '#fff6c8', 70], band: '#fffbe8',
      cl: ['#ffffff', '#f3f8fb', '#cfe0ee'],
      clouds: S.port ? [[0.12, 0.27, 34, 1], [0.86, 0.2, 40, 1], [0.6, 0.36, 22, 0.8]] : [[0.1, 0.42, 30, 1], [0.86, 0.3, 36, 1], [0.32, 0.22, 20, 0.85], [0.7, 0.5, 18, 0.7]],
    });
  },
  back(ctx, t, S) { swallows(ctx, t, S, 2); },
  far(c, S) {
    const F = S.F;
    farmland(c, S, {
      hills: ['#b4d8cf', '#a4cdbf'], hills2: ['#a6d39e', '#98c98f'], trees: ['#6fa77a', '#82b886', '#a2cf9c'], trunk: '#7a8a6a',
      fields: ['#a3d27a', '#bcd96c', '#e2cf72', '#93c86c', '#cdb37c', '#aad57e', '#dcc568'], hedge: '#5f9a5a',
      barn: S.port ? F.X(0.12) : F.X(0.31),
    });
  },
  near(c, S) {
    const { W, H, u, R, gy, port } = S, F = S.F;
    // the meadow before the yard, then the trodden yard
    const m0 = wave(R, S.by(0.22), 1.5 * u, 110 * u);
    fillUnder(c, W, H, m0, vg(c, S.by(0.15), gy, [[0, '#8fd06a'], [0.55, '#6db84e'], [1, '#5aa640']]));
    edge(c, W, m0, 'rgba(210,245,160,0.7)', 0.6 * u);
    // mown stripes in the meadow
    c.save(); under(c, W, H, m0); c.clip(); for (let k = 0; k < 4; k++) rect(c, 0, m0(W / 2) + (k * k * 1.6 + 2.5) * u, W, (1.2 + k * 0.6) * u, 'rgba(255,255,210,0.08)'); c.restore();
    // a post-and-rail fence across the yard
    const fy = (x) => m0(x) + 7 * u, fh = 9 * u;
    railFence(c, -4 * u, W + 4 * u, fy, 17 * u, fh, '#b4865a', R);
    // the yard: packed straw and dirt in front of the fence
    const y0 = wave(R, S.by(0.62), 1.2 * u, 80 * u);
    fillUnder(c, W, H, y0, vg(c, S.by(0.55), gy + 6 * u, [[0, '#a7b25a'], [0.4, '#c6a865'], [1, '#b08a50']]));
    c.save(); under(c, W, H, y0); c.clip();
    for (let i = 0; i < W / u * 1.4; i++) { const x = R() * W, y = lerp(y0(x), gy + 4 * u, R() ** 0.7), a = R.r(-0.5, 0.5), L = R.r(1, 2.6) * u; line(c, x, y, x + Math.cos(a) * L, y + Math.sin(a) * L * 0.4, R.pick(['#f3d27a', '#e2b955', '#fff0b0', '#c99a3c']), R.r(0.18, 0.32) * u); }
    c.restore();
    edge(c, W, y0, 'rgba(120,150,60,0.6)', 0.5 * u);
    for (let x = R() * 6 * u; x < W; x += R.r(5, 12) * u) tuft(c, x, y0(x) + 0.5 * u, R.r(1.6, 3.2) * u, R, ['#4f9a36', '#6ab443', '#8acb52']);
    // the rooster's post at the left: a tall capped post, a little crowing perch
    // bushes and flowers framing the left edge
    bush(c, port ? F.X(-0.04) : F.X(0.03), fy(F.X(0.03)) + 3 * u, 30 * u, 12 * u, R, ['#2f7a34', '#47993d', '#7cc455'], ['#ffffff', '#ff9ec7', '#ffe066']);
    const rx = port ? F.X(0.11) : F.X(0.13), rby = y0(rx) + 4 * u;
    roosterPost(c, rx, rby, u);
    for (let i = 0; i < 12; i++) { const x = R.r(-4, port ? 40 : 60) * u + S.M, y = lerp(fy(x) + 2 * u, y0(x) + 2 * u, R()); circle(c, x, y + 1.2 * u, 0.9 * u, '#3f8a34'); daisy(c, x, y, 1.3 * u, R.pick(['#ffffff', '#ffe066', '#ff9ec7', '#ffffff'])); }
    // the hen house itself: right behind the hen and the nest (the hen stands at the right of the basket)
    const cxp = port ? F.X(0.8) : F.X(0.8), d = u * (port ? 0.36 : 0.28);
    const foot = gy - (port ? 9 : 14) * u;
    c.save(); c.translate(cxp, foot); c.scale(d, d); paintCoop(c, R); c.restore();
    const ly = (x) => y0(x) + R.r(3, 6) * u;
    S.live = {
      post: [rx, rby - 30 * u * 0.86, 1], roo: roosterSprites(S.dpr, 8.5 * u), chk: chickSprites(S.dpr, 4.4 * u),
      chicks: port ? [[F.X(0.06), ly(F.X(0.06))], [F.X(0.2), S.by(0.66)]] : [[F.X(0.2), ly(F.X(0.2))], [F.X(0.94), ly(F.X(0.94))], [F.X(0.06), ly(F.X(0.06))]],
      ramp: [cxp - 71 * d, foot + 1 * d, cxp - 21 * d, foot - 47 * d], rampDir: 1, fly: [port ? F.X(0.14) : F.X(0.08), fy(F.X(0.1)) - 5 * u],
    };
    // grass tufts and flowers at the screen edges, low
    for (let x = R() * 4 * u; x < W; x += R.r(3, 8) * u) { const e = Math.abs(x - W / 2) / (W / 2); if (R() < e * e) tuft(c, x, gy + R.r(0, 3) * u, R.r(3, 6) * u * (0.6 + e), R, ['#3f8a2e', '#5aa63c', '#7cc455']); }
    vaultHaze(c, S, '#eef8ff', 0.3);
  },
  front(ctx, t, S) { coopLive(ctx, t, S); },
};
// the farmland far behind: two rows of soft hills with tree groups, then a patchwork of hedged fields to the horizon.
// o.barn / o.mill: x of the little barn / windmill on the hills (the journey's end, or the next stop)
function farmland(c, S, o) {
  const { W, H, u, R, hz } = S;
  const h0 = wave(R, hz - 17 * u, 4 * u, 120 * u);
  fillUnder(c, W, H, h0, vg(c, hz - 26 * u, hz, o.hills));
  const bump = (x0, w, hgt) => (x) => (x0 === undefined ? 0 : hgt * Math.exp(-(((x - x0) / w) ** 2)));
  const bb = bump(o.barn, 22 * u, 7 * u), bm = bump(o.mill, 16 * u, 6 * u);
  const h1 = wave(R, hz - 9 * u, 3 * u, 80 * u), h1b = (x) => h1(x) - bb(x) - bm(x);
  fillUnder(c, W, H, h1b, vg(c, hz - 22 * u, hz, o.hills2));
  edge(c, W, h1b, rgba(shade(o.hills2[0], 0.4), 0.6), 0.4 * u);
  // tree groups on the hills
  for (let x = R.r(0, 30) * u; x < W; x += R.r(22, 46) * u) {
    if ((o.barn !== undefined && Math.abs(x - o.barn) < 18 * u) || (o.mill !== undefined && Math.abs(x - o.mill) < 12 * u)) continue;
    const n = R.i(1, 3); for (let k = 0; k < n; k++) { const xx = x + k * R.r(2.5, 4) * u; tree(c, xx, h1b(xx) + 1.2 * u, R.r(3.2, 5) * u, R, o.trees, o.trunk); }
  }
  if (o.barn !== undefined) farBarn(c, o.barn, h1b(o.barn) + 0.8 * u, 0.36 * u);
  if (o.mill !== undefined) farMill(c, o.mill, h1b(o.mill) + 0.8 * u, 0.3 * u);
  // the patchwork: strips of field between hedgerows, each row a little taller as it nears
  const ys = [hz - 6 * u, hz - 2.5 * u, hz + 2 * u, hz + 8 * u], f = ys.map((y, i) => wave(R, y, (0.6 + i * 0.3) * u, (60 + i * 20) * u));
  for (let r = 0; r < ys.length; r++) {
    for (let x = -R.r(0, 30) * u; x < W;) {
      const fw = R.r(24, 56) * u * (1 + r * 0.3), col = o.fields[R.i(0, o.fields.length - 1)];
      c.save(); c.beginPath(); c.rect(x, 0, fw + 1, H); c.clip();
      fillUnder(c, W, H, f[r], vg(c, ys[r], ys[r] + 8 * u, [shade(col, 0.1), shade(col, -0.05)]));
      if (R() < 0.5) { c.strokeStyle = rgba(shade(col, -0.22), 0.3); c.lineWidth = 0.3 * u; for (let k = 1; k < 3 + r; k++) { c.beginPath(); for (let xx = x; xx <= x + fw + 6; xx += 6) { const yy = f[r](xx) + k * (1 + r * 0.4) * u; xx === x ? c.moveTo(xx, yy) : c.lineTo(xx, yy); } c.stroke(); } }
      c.restore();
      x += fw;
    }
    // the hedgerow along the top of the row: a dark band of little bumps
    c.strokeStyle = o.hedge; c.lineWidth = (0.9 + r * 0.35) * u; c.lineCap = 'round'; c.beginPath(); for (let x = -4; x <= W + 6; x += 4) x < 0 ? c.moveTo(x, f[r](x) - 0.3 * u) : c.lineTo(x, f[r](x) - 0.3 * u); c.stroke();
    for (let x = -2 * u; x < W + 2 * u; x += R.r(0.6, 1.3) * u) { const rr2 = R.r(0.35, 0.6) * u * (1 + r * 0.3); circle(c, x, f[r](x) - rr2 * 0.5, rr2, o.hedge); }
    for (let x = -2 * u; x < W + 2 * u; x += R.r(1.4, 3) * u) { const rr2 = R.r(0.22, 0.38) * u * (1 + r * 0.3); circle(c, x - rr2 * 0.3, f[r](x) - rr2 * 1.6, rr2, rgba(shade(o.hedge, 0.4), 0.7)); }
    if (r > 0) for (let x = R.r(10, 50) * u; x < W; x += R.r(40, 90) * u) tree(c, x, f[r](x) + 0.5 * u, R.r(3, 4.5) * u * (1 + r * 0.25), R, o.trees, o.trunk);
  }
}
// the big red barn far off on the hill (a few shapes; the haze softens it)
function farBarn(c, x, y, s) {
  rect(c, x + 13 * s, y - 24 * s, 7 * s, 24 * s, '#c9cfd4'); rect(c, x + 16.5 * s, y - 24 * s, 3.5 * s, 24 * s, '#a8b0b8');
  c.beginPath(); c.arc(x + 16.5 * s, y - 24 * s, 3.5 * s, Math.PI, 0); c.fillStyle = '#9aa3ad'; c.fill();
  shape(c, [x - 12 * s, y, x + 12 * s, y, x + 12 * s, y - 11 * s, x + 8 * s, y - 17 * s, x, y - 21 * s, x - 8 * s, y - 17 * s, x - 12 * s, y - 11 * s], '#cf4a3a');
  shape(c, [x + 12 * s, y, x + 16 * s, y - 1.5 * s, x + 16 * s, y - 12 * s, x + 12 * s, y - 11 * s], '#9a3328');
  shape(c, [x, y - 21 * s, x + 4 * s, y - 22.5 * s, x + 12 * s, y - 18.5 * s, x + 16 * s, y - 12 * s, x + 12 * s, y - 11 * s, x + 8 * s, y - 17 * s], '#6f7c88');
  c.strokeStyle = '#fff1e0'; c.lineWidth = 0.9 * s; c.strokeRect(x - 5 * s, y - 9 * s, 10 * s, 9 * s);
  c.beginPath(); c.moveTo(x - 5 * s, y - 9 * s); c.lineTo(x + 5 * s, y); c.moveTo(x + 5 * s, y - 9 * s); c.lineTo(x - 5 * s, y); c.stroke();
  rect(c, x - 2 * s, y - 16 * s, 4 * s, 3 * s, '#fff1e0');
}
// the windmill far off (a stone-and-board tower, a red cap, four still sails)
function farMill(c, x, y, s) {
  shape(c, [x - 9 * s, y, x + 9 * s, y, x + 5.5 * s, y - 38 * s, x - 5.5 * s, y - 38 * s], '#f2ead8'); shape(c, [x + 2 * s, y, x + 9 * s, y, x + 5.5 * s, y - 38 * s, x + 2 * s, y - 38 * s], '#d4c6aa');
  c.beginPath(); c.moveTo(x - 7 * s, y - 37 * s); c.quadraticCurveTo(x, y - 49 * s, x + 7 * s, y - 37 * s); c.closePath(); c.fillStyle = '#c8412f'; c.fill();
  c.save(); c.translate(x, y - 40 * s); c.strokeStyle = '#7a5a3a'; c.lineWidth = 1.2 * s; c.fillStyle = 'rgba(250,244,228,0.95)';
  for (let q = 0; q < 4; q++) { c.rotate(TAU / 4 + (q ? 0 : 0.35)); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -22 * s); c.stroke(); c.fillRect(0.8 * s, -21 * s, 4 * s, 15 * s); }
  c.restore();
}
function roosterPost(c, x, y, u) {
  const h = 30 * u, w = 2.4 * u;
  softShadow(c, x + 3 * u, y, 7 * u, 1.6 * u, '#2a3a10', 0.35);
  shape(c, [x - w, y, x - w, y - h, x + w, y - h, x + w, y], grad(c, x - w, 0, x + w, 0, [WOOD.hi, WOOD.base, WOOD.lo]), WOOD.ink, 0.35 * u);
  for (let k = 1; k < 5; k++) line(c, x - w * 0.5, y - h * k / 5, x + w * 0.2, y - h * k / 5 + 0.6 * u, 'rgba(80,44,16,0.35)', 0.25 * u);
  shape(c, [x - w * 1.9, y - h, x + w * 1.9, y - h, x + w * 1.6, y - h - 1.4 * u, x - w * 1.6, y - h - 1.4 * u], WOOD.lo, WOOD.ink, 0.3 * u);
  shape(c, [x - w * 1.6, y - h - 1.4 * u, x + w * 1.6, y - h - 1.4 * u, x, y - h - 4.4 * u], RED.base, RED.ink, 0.3 * u);
  line(c, x - w * 1.4, y - h - 1.7 * u, x, y - h - 4.1 * u, 'rgba(255,190,170,0.7)', 0.25 * u);
  // the perch: a crossbar near the top where the rooster stands to crow
  shape(c, [x - 6 * u, y - h * 0.86, x + 6 * u, y - h * 0.86, x + 6 * u, y - h * 0.86 + 1.3 * u, x - 6 * u, y - h * 0.86 + 1.3 * u], WOOD.base, WOOD.ink, 0.3 * u); line(c, x - 5.7 * u, y - h * 0.86 + 0.25 * u, x + 5.7 * u, y - h * 0.86 + 0.25 * u, WOOD.hi, 0.3 * u);
  // a perch peg
  line(c, x + w, y - h * 0.62, x + w + 3.4 * u, y - h * 0.62, WOOD.ink, 0.6 * u); line(c, x + w, y - h * 0.62 - 0.2 * u, x + w + 3.2 * u, y - h * 0.62 - 0.2 * u, WOOD.hi, 0.25 * u);
}

// ------------------------------------------------------------------ 2. the Haystacks
// straw texture: short strokes along x, light upper left, dark lower right, clipped to the current path by the caller
function strawTex(c, x, y, w, h, R, dens, lw) {
  c.lineCap = 'round';
  for (let k = 0; k < w * h * dens; k++) {
    const xx = x + R() * w, yy = y + R() * h, a = R.r(-0.35, 0.35), l = R.r(2.2, 5.5), lo = (xx - x) / w * 0.5 + (yy - y) / h > 0.9;
    c.strokeStyle = lo ? 'rgba(150,92,22,0.5)' : R() < 0.45 ? 'rgba(196,130,40,0.38)' : 'rgba(255,248,206,0.7)'; c.lineWidth = lw;
    c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx + Math.cos(a) * l, yy + Math.sin(a) * l); c.stroke();
  }
}
// a square bale, side view (unit space): front face x..x+w, y-h..y; its top and right side go back by D
function bale(c, x, y, w, h, D, R, side = true) {
  const r = 4, ink = STRAW.ink;
  const top = [x + 2, y - h, x + w - 1, y - h, x + w + D[0] - 1, y - h + D[1], x + D[0] + 2, y - h + D[1]];
  const sd = [x + w, y - 1, x + w + D[0], y + D[1] - 1, x + w + D[0], y - h + D[1] + 1, x + w, y - h + 1];
  if (side) shape(c, sd, grad(c, x + w, 0, x + w + D[0], 0, ['#c38a32', '#9a6a22']), ink, 0.9);
  shape(c, top, grad(c, x, y - h + D[1], x + w, y - h, ['#fff1bc', '#f4d27a']), ink, 0.9);
  c.save(); path(c, top); c.clip(); c.strokeStyle = 'rgba(200,140,50,0.45)'; c.lineWidth = 0.7; for (let k = 0; k < w * 0.7; k++) { const xx = x + R() * (w + D[0]), yy = y - h + D[1] * R(); c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx + 3, yy - 1.2); c.stroke(); } c.restore();
  if (side) { c.save(); path(c, sd); c.clip(); strawTex(c, x + w, y - h + D[1], D[0], h - D[1], R, 0.12, 0.7); c.restore(); }
  rr(c, x, y - h, w, h, r); c.fillStyle = ink; c.fill();
  rr(c, x + 0.9, y - h + 0.9, w - 1.8, h - 1.8, r - 0.9); c.fillStyle = grad(c, x, y - h, x + w * 0.45, y + 6, ['#ffe796', '#f3c656', '#d89e3e']); c.fill();
  c.save(); rr(c, x, y - h, w, h, r); c.clip(); strawTex(c, x, y - h, w, h, R, 0.1, 0.75); rect(c, x, y - 5, w, 5, 'rgba(130,74,10,0.2)'); c.restore();
  for (const f of [0.26, 0.74]) { const tx = x + w * f; c.strokeStyle = 'rgba(122,54,22,0.8)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(tx, y); c.lineTo(tx, y - h); c.lineTo(tx + D[0], y - h + D[1]); c.stroke(); }
  c.strokeStyle = '#fff2b8'; c.lineWidth = 0.8; for (let k = 0; k < 6; k++) { const xx = x + 3 + R() * (w - 6); c.beginPath(); c.moveTo(xx, y - h + 1); c.lineTo(xx + R.r(-3.5, 3.5), y - h - R.r(2, 5)); c.stroke(); }
}
// the haystack: square bales stacked 2 - 2 - 1 with loose straw at the foot and a pitchfork leaning on it
function paintStack(c, R) {
  softShadow(c, 30, 2, 100, 10, '#4a3a10', 0.42);
  const w = 52, h = 30, D = [16, -8];
  bale(c, -50, -h - 4, w, h, D, R); bale(c, 4, -h - 4, w, h, D, R); // the back pair, a row up and set back
  bale(c, -60, 0, w, h, D, R); bale(c, -6, 0, w, h, D, R); // the front pair
  bale(c, -24, -2 * h - 6, w, h, D, R); // the top
  // the pitchfork leaning on the right of the stack
  c.save(); c.translate(64, 2); c.rotate(-0.32);
  shape(c, [-1.8, 0, -1.8, -96, 1.8, -96, 1.8, 0], grad(c, -2, 0, 2, 0, [WOOD.hi, WOOD.lo]), WOOD.ink, 0.8);
  c.strokeStyle = '#4e545e'; c.lineWidth = 2.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(-6, -96); c.quadraticCurveTo(0, -99, 6, -96); for (const x of [-6, 0, 6]) { c.moveTo(x, -96); c.lineTo(x * 1.1, -116); } c.stroke();
  c.strokeStyle = '#aab2bc'; c.lineWidth = 0.8; c.beginPath(); for (const x of [-6, 0, 6]) { c.moveTo(x - 0.6, -98); c.lineTo(x * 1.1 - 0.6, -114); } c.stroke();
  c.restore();
  // loose straw at the foot
  c.lineCap = 'round'; for (let k = 0; k < 70; k++) { const x = R.r(-80, 80), y = R.r(-2, 6); c.strokeStyle = R() < 0.5 ? STRAW.base : R() < 0.5 ? STRAW.hi : STRAW.lo; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x + R.r(-6, 6), y - R.r(0, 3)); c.stroke(); }
}
// a hay cart, side view, facing left: a slatted bed heaped with hay, one big spoked wheel, the shafts resting down
function paintCart(c, R) {
  softShadow(c, 8, 2, 70, 7, '#4a3a10', 0.4);
  const ink = WOOD.ink;
  // the shafts resting on the ground
  c.lineCap = 'round'; line(c, -46, -36, -98, -3, ink, 4.6); line(c, -46, -36.6, -98, -3.6, WOOD.base, 2.6);
  // the hay heap
  c.beginPath(); c.moveTo(-54, -44); c.bezierCurveTo(-58, -78, -26, -96, 4, -92); c.bezierCurveTo(34, -96, 60, -76, 56, -44); c.closePath();
  c.fillStyle = STRAW.ink; c.fill(); c.save(); c.clip();
  rect(c, -60, -100, 120, 60, grad(c, -40, -96, 30, -44, ['#ffe796', '#f1c55a', '#cf9a3e']));
  strawTex(c, -58, -98, 116, 56, R, 0.09, 0.8);
  c.restore();
  c.strokeStyle = '#fff2b8'; c.lineWidth = 0.9; for (let k = 0; k < 16; k++) { const a = Math.PI + k / 15 * Math.PI, x = 2 + Math.cos(a) * 56, y = -48 + Math.sin(a) * 46; c.beginPath(); c.moveTo(x, y); c.lineTo(x + R.r(-5, 5), y - R.r(3, 7)); c.stroke(); }
  // the bed: slatted side boards
  shape(c, [-56, -30, 56, -30, 58, -52, -58, -52], grad(c, 0, -52, 0, -30, [WOOD.hi, WOOD.base, WOOD.lo]), ink, 1.1);
  for (const y of [-45, -38]) line(c, -56, y, 56, y, 'rgba(80,42,14,0.55)', 0.9);
  for (const x of [-50, -16, 18, 50]) shape(c, [x - 2.2, -28, x + 2.2, -28, x + 2.2, -55, x - 2.2, -55], WOOD.lo, ink, 0.7);
  shape(c, [-58, -27, 58, -27, 58, -31, -58, -31], mix(WOOD.lo, '#3a2410', 0.3), ink, 0.8);
  // the wheel: rim, spokes, hub
  const wx = 14, wy = -24, wr = 23;
  c.beginPath(); c.arc(wx, wy, wr, 0, TAU); c.strokeStyle = ink; c.lineWidth = 7; c.stroke(); c.strokeStyle = WOOD.base; c.lineWidth = 4.6; c.stroke();
  c.beginPath(); c.arc(wx, wy, wr - 0.6, Math.PI * 1.05, Math.PI * 1.6); c.strokeStyle = WOOD.hi; c.lineWidth = 1.4; c.stroke();
  for (let k = 0; k < 10; k++) { const a = k / 10 * TAU + 0.2; line(c, wx + Math.cos(a) * 4, wy + Math.sin(a) * 4, wx + Math.cos(a) * (wr - 3), wy + Math.sin(a) * (wr - 3), ink, 2.4); line(c, wx + Math.cos(a) * 4, wy + Math.sin(a) * 4, wx + Math.cos(a) * (wr - 3), wy + Math.sin(a) * (wr - 3), WOOD.base, 1.2); }
  circle(c, wx, wy, 5.5, ink); circle(c, wx, wy, 4.2, WOOD.lo); circle(c, wx - 1.2, wy - 1.2, 1.6, WOOD.hi);
  // a prop leg at the front
  line(c, -44, -30, -42, 0, ink, 3.2); line(c, -44, -30, -42, 0, WOOD.base, 1.6);
}
// the stubble field: golden, with rows of cut stalks and long windrows of drying hay
function stubble(c, S, y0fn, R, cols) {
  const { W, H, u, gy } = S;
  fillUnder(c, W, H, y0fn, vg(c, y0fn(W / 2) - 4 * u, gy, [[0, cols[0]], [0.5, cols[1]], [1, cols[2]]]));
  c.save(); under(c, W, H, y0fn); c.clip();
  for (let r = 0; r < 14; r++) {
    const k = (r + 0.5) / 14, y = lerp(y0fn(W / 2) + 1 * u, gy + 4 * u, k * k), hh = (0.5 + 2.2 * k) * u, step = (1 + 3 * k) * u;
    c.strokeStyle = rgba('#8a5a1a', 0.22 + 0.2 * k); c.lineWidth = (0.18 + 0.3 * k) * u; c.beginPath();
    for (let x = -R.r(0, step); x < W; x += step * R.r(0.7, 1.3)) { c.moveTo(x, y); c.lineTo(x + R.r(-0.3, 0.3) * u, y - hh); } c.stroke();
    c.strokeStyle = rgba('#fff0b0', 0.25 + 0.2 * k); c.lineWidth = (0.12 + 0.18 * k) * u; c.beginPath();
    for (let x = -R.r(0, step); x < W; x += step * R.r(0.9, 1.6)) { c.moveTo(x + 0.3 * u, y - 0.2 * u); c.lineTo(x + 0.4 * u, y - hh * 0.8); } c.stroke();
  }
  c.restore();
}
function windrow(c, x0, x1, y, h, R, u) {
  c.beginPath(); c.moveTo(x0, y); for (let x = x0; x <= x1; x += 3 * u) c.lineTo(x, y - h * (0.6 + 0.4 * Math.sin((x - x0) / (x1 - x0) * Math.PI)) - R.r(0, 0.3) * h); c.lineTo(x1, y); c.closePath();
  c.fillStyle = vg(c, y - h, y, ['#ffe58c', '#e0aa48']); c.fill();
  c.strokeStyle = 'rgba(255,248,200,0.7)'; c.lineWidth = 0.25 * u; for (let k = 0; k < (x1 - x0) / u * 1.2; k++) { const x = lerp(x0, x1, R()), yy = y - R() * h * 0.9; c.beginPath(); c.moveTo(x, yy); c.lineTo(x + R.r(-1.2, 1.2) * u, yy - R.r(0.3, 1) * u); c.stroke(); }
  rect(c, x0, y - 0.5 * u, x1 - x0, 0.6 * u, 'rgba(120,70,10,0.25)');
}
function roundBale(c, x, y, r, R) {
  ell(c, x + r * 0.6, y, r * 1.4, r * 0.25, 'rgba(90,60,10,0.25)');
  ell(c, x, y - r, r, r, '#d9a848'); ell(c, x - r * 0.25, y - r * 1.05, r * 0.72, r * 0.8, '#f3cf72');
  c.strokeStyle = 'rgba(150,100,30,0.6)'; c.lineWidth = r * 0.08; c.beginPath(); c.arc(x - r * 0.2, y - r * 1.02, r * 0.45, 0.4, 5.4); c.stroke(); void R;
}
const hayfield = {
  atmo: { haze: ['#fff2d4', 0.36, 22], bloom: ['#fff6dc', 0.4, 10], key: ['#ffe9b0', 0.08], shadow: ['#3a2a0a', 0.2] },
  frame: { kit: 'leafy', cols: ['#4a321c', '#6a7a2a', '#8a9a36', '#b0b84a'], tone: ['#2a1a06', 0.18], noTop: true },
  stage: { top: '#d8b25a', soil: '#7a5530', straw: ['#f3d27a', '#e2b955', '#fff0b0', '#c99a3c'], tufts: ['#8a9a36', '#a8b048', '#c9c060'] },
  prep(S) { S.F = frameOf(S); S.live = null; },
  stageFx(c, k) { const { w, u, y0, R, quiet } = k; c.lineCap = 'round'; for (let x = R() * 2 * u; x < w; x += R.r(0.7, 1.5) * u) { const h = R.r(1, 2.6) * u * (0.5 + 0.5 * quiet(x)); line(c, x, y0 + 0.8 * u, x + R.r(-0.4, 0.4) * u, y0 + 0.8 * u - h, R() < 0.5 ? '#c9963e' : '#efd07a', 0.3 * u); } },
  veil: ['#fff4dc', 0.18], punch: 0.2,
  sky(c, S) {
    paintSky(c, S, {
      sky: [[0, '#4f9fdc'], [0.5, '#93cdee'], [0.82, '#e9eedc'], [1, '#fde8b4']],
      sun: [0.12, 0.06, '#fff0b8', 78], band: '#fff2cc',
      cl: ['#fffdf6', '#f6f0e4', '#e2d2bc'],
      clouds: S.port ? [[0.84, 0.24, 36, 1], [0.16, 0.31, 26, 0.95], [0.5, 0.38, 16, 0.7]] : [[0.86, 0.36, 32, 1], [0.34, 0.24, 22, 0.9], [0.62, 0.5, 14, 0.7]],
    });
  },
  back(ctx, t, S) { swallows(ctx, t, S, 2); },
  far(c, S) {
    const F = S.F;
    farmland(c, S, {
      hills: ['#c2d8c2', '#b4cfb0'], hills2: ['#b6d494', '#a8c986'], trees: ['#7fa870', '#93b97e', '#b0cf96'], trunk: '#8a8a64',
      fields: ['#e8cf72', '#ddc066', '#c9d77a', '#f0d888', '#d4b45c', '#b8d27c'], hedge: '#7a9a56',
      mill: S.port ? F.X(0.86) : F.X(0.66),
    });
    // round bales dotting the far field
    const { W, u, R, hz } = S; for (let x = R.r(10, 40) * u; x < W; x += R.r(30, 60) * u) roundBale(c, x, hz + R.r(3, 7) * u, R.r(1.1, 1.6) * u, R);
  },
  near(c, S) {
    const { W, u, R, gy, port } = S, F = S.F;
    const f0 = wave(R, S.by(0.06), 1.2 * u, 120 * u);
    stubble(c, S, f0, R, ['#ecd27c', '#dcb65a', '#c99a46']);
    // two long windrows of drying hay across the field, broken where the vault is
    windrow(c, -4 * u, F.X(0.34), S.by(0.32), 2.2 * u, R, u); windrow(c, F.X(0.66), S.W + 4 * u, S.by(0.28), 2 * u, R, u);
    windrow(c, F.X(0.05), F.X(0.4), S.by(0.62), 3 * u, R, u);
    // the haystack: big, on the left, framing the basket
    const sx = port ? F.X(0.08) : F.X(0.3), sk = u * (port ? 0.5 : 0.36);
    const sy0 = gy - (port ? 10 : 13) * u; c.save(); c.translate(sx, sy0); c.scale(sk, sk); paintStack(c, R); c.restore();
    // the hay cart on the right, set back, so the hen stands below it against the open stubble
    const cx2 = port ? F.X(0.86) : F.X(0.8), ck = u * (port ? 0.36 : 0.36);
    c.save(); c.translate(cx2, S.by(port ? 0.36 : 0.42)); c.scale(ck, ck); paintCart(c, R); c.restore();
    // a couple of loose bales by the cart
    c.save(); c.translate(cx2 + 30 * ck, S.by(port ? 0.4 : 0.46)); c.scale(ck * 0.9, ck * 0.9); bale(c, 0, 0, 44, 26, [12, -6], R); c.restore();
    for (let x = R() * 4 * u; x < W; x += R.r(3, 8) * u) { const e = Math.abs(x - W / 2) / (W / 2); if (R() < e * e) tuft(c, x, gy + R.r(0, 3) * u, R.r(3, 5.5) * u * (0.6 + e), R, ['#a89a3a', '#c4b04a', '#8a8a30']); }
    vaultHaze(c, S, '#fff8e6', 0.28);
    S.live = {
      mouse: [sx - 7 * sk, sy0 - 1 * sk, 0.9 * u], fly: [F.X(port ? 0.72 : 0.66), S.by(0.14)], trac: [S.hz - 2.6 * u, -10 * u, S.W + 10 * u],
      sway: mkStrips(R, u, [[-2 * u, F.X(0.1)], [F.X(0.9), W + 2 * u]], gy, 4, 8, 1.2, { col: '#c9a840', lw: 0.3 }),
    };
  },
  mid(ctx, t, S) { tractorMid(ctx, t, S); },
  front(ctx, t, S) { hayLive(ctx, t, S); },
};

// ------------------------------------------------------------------ 3. the Duck Pond
function lily(c, x, y, r, fl) {
  c.beginPath(); c.ellipse(x, y, r, r * 0.38, 0, 0.25, TAU - 0.25); c.lineTo(x, y); c.closePath(); c.fillStyle = '#3f8a3a'; c.fill();
  c.beginPath(); c.ellipse(x - r * 0.1, y - r * 0.05, r * 0.8, r * 0.28, 0, 0.3, TAU - 0.3); c.lineTo(x, y); c.closePath(); c.fillStyle = '#62ac4a'; c.fill();
  if (fl) { for (let p = 0; p < 6; p++) { const a = p / 6 * Math.PI - Math.PI; ell(c, x - r * 0.2 + Math.cos(a) * r * 0.22, y - r * 0.18 + Math.sin(a) * r * 0.2, r * 0.18, r * 0.09, p % 2 ? '#ffb8d0' : '#ff8fb4', a); } circle(c, x - r * 0.2, y - r * 0.2, r * 0.08, '#ffd84a'); }
}
function reedClump(c, x, y, h, R, n = 9, cat = true) {
  c.lineCap = 'round';
  for (let k = 0; k < n; k++) {
    const bx = x + R.r(-0.5, 0.5) * h * 0.4, l = h * R.r(0.6, 1.1), a = R.r(-0.25, 0.25);
    c.strokeStyle = R() < 0.5 ? '#3f7f2e' : '#5a9c3e'; c.lineWidth = Math.max(1, h * 0.04); c.beginPath(); c.moveTo(bx, y); c.quadraticCurveTo(bx + a * l * 0.3, y - l * 0.6, bx + a * l, y - l); c.stroke();
    if (cat && k % 3 === 0) { const tx = bx + a * l * 0.82, ty = y - l * 0.84; ell(c, tx, ty, h * 0.05, h * 0.12, '#7a4a26', a); ell(c, tx - h * 0.015, ty - h * 0.03, h * 0.016, h * 0.05, 'rgba(255,220,180,0.5)', a); }
  }
}
// the willow, leaning in over the water from one side (sd = 1: trunk at the left leaning right)
function willow(c, x0, y0, s, sd0, R) {
  c.save(); c.translate(x0, y0); c.scale(sd0, 1); willowAt(c, 0, 0, s, 1, R); c.restore();
}
function willowAt(c, x, y, s, sd, R) {
  const tk = '#6e5236', tkd = '#4a3420', ink = '#3a2818';
  // trunk: a thick leaning bole with two forks
  const tx = x + sd * s * 0.42, ty = y - s * 0.9;
  c.beginPath(); c.moveTo(x - s * 0.1, y); c.bezierCurveTo(x - s * 0.06 + sd * s * 0.05, y - s * 0.4, tx - sd * s * 0.1, ty + s * 0.25, tx, ty); c.lineTo(tx + sd * s * 0.07, ty + s * 0.04); c.bezierCurveTo(tx + s * 0.02, ty + s * 0.3, x + s * 0.1 + sd * s * 0.06, y - s * 0.4, x + s * 0.13, y); c.closePath();
  c.fillStyle = grad(c, x - s * 0.1, 0, x + s * 0.15, 0, [shade(tk, 0.15), tk, tkd]); c.fill(); c.strokeStyle = ink; c.lineWidth = s * 0.012; c.stroke();
  c.strokeStyle = 'rgba(40,24,10,0.4)'; c.lineWidth = s * 0.008; for (let k = 0; k < 5; k++) { const yy = y - s * (0.1 + k * 0.15); c.beginPath(); c.moveTo(x + sd * s * k * 0.06, yy); c.lineTo(x + sd * s * (k * 0.06 + 0.05), yy - s * 0.12); c.stroke(); }
  // the crown: a dark mass, then curtains of drooping fronds in three greens
  const cx = tx + sd * s * 0.12, cy = ty - s * 0.08, cw = s * 0.75;
  const mass = [[0, 0, 0.42], [-0.32, 0.08, 0.3], [0.34, 0.1, 0.32], [0.1, -0.16, 0.3], [-0.18, -0.12, 0.26]];
  for (const [dx, dy, r] of mass) circle(c, cx + dx * cw, cy + dy * cw, r * cw + s * 0.012, ink);
  for (const [dx, dy, r] of mass) circle(c, cx + dx * cw, cy + dy * cw, r * cw, '#3f7a34');
  const strand = (x0, y0, len, col, w) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.bezierCurveTo(x0 + sd * len * 0.12, y0 + len * 0.3, x0 + sd * len * 0.06, y0 + len * 0.7, x0 + sd * len * 0.02, y0 + len); c.stroke(); };
  c.lineCap = 'round';
  for (const [col, n, lmul, wmul] of [['#2f6a2c', 40, 1, 1.4], ['#4f9440', 46, 0.92, 1.1], ['#7cbc56', 30, 0.75, 0.9], ['#a6d872', 14, 0.5, 0.7]]) {
    for (let k = 0; k < n; k++) { const a = R.r(-1, 1), x0 = cx + a * cw * 0.95, y0 = cy - Math.sqrt(1 - a * a) * cw * 0.35 + R.r(-0.05, 0.15) * cw, len = (s * 0.55 + (1 - Math.abs(a)) * s * 0.3) * lmul * R.r(0.75, 1.1); strand(x0, y0, len, col, s * 0.022 * wmul); }
  }
  // little leaves along the lit strands
  for (let k = 0; k < 60; k++) { const a = R.r(-0.9, 0.9), x0 = cx + a * cw * 0.9 + R.r(-2, 2), y0 = cy + R.r(-0.2, 0.9) * s * 0.7; ell(c, x0, y0, s * 0.012, s * 0.03, R() < 0.5 ? '#8ccc62' : '#5aa244', R.r(-0.4, 0.4)); }
}
// a little jetty going out into the water: posts, a plank deck, a bucket
function paintJetty(c, R, sd) {
  const ink = WOOD.ink, L = 150;
  for (const x of [8, 56, 104, 146]) { const px = sd * x; shape(c, [px - 2.6, 12, px - 2.6, -10, px + 2.6, -10, px + 2.6, 12], grad(c, px - 3, 0, px + 3, 0, [WOOD.base, WOOD.lo]), ink, 0.8); ell(c, px, 12, 6, 1.4, 'rgba(230,250,255,0.6)'); }
  shape(c, [0, -8, sd * L, -14, sd * L, -9, 0, -3], mix(WOOD.lo, '#3a2410', 0.35), ink, 0.8); // the deck's edge
  shape(c, [0, -8, sd * L, -14, sd * (L - 10), -19, sd * -8, -13], grad(c, 0, -19, 0, -8, [WOOD.hi, WOOD.base]), ink, 1);
  c.save(); path(c, [0, -8, sd * L, -14, sd * (L - 10), -19, sd * -8, -13]); c.clip();
  for (let k = 0; k < 16; k++) { const x = sd * (k * 10 - 4); line(c, x, -6, x - sd * 9, -20, 'rgba(80,44,16,0.5)', 0.8); }
  c.restore();
  // a bucket and a coiled rope
  const bx = sd * 112; shape(c, [bx - 6, -16, bx + 6, -16, bx + 5, -27, bx - 5, -27], grad(c, bx - 6, 0, bx + 6, 0, ['#9aa8b2', '#5e6a74']), '#3e4a52', 0.8); ell(c, bx, -27, 5, 1.6, '#c8d2da'); c.strokeStyle = '#3e4a52'; c.lineWidth = 0.8; c.beginPath(); c.arc(bx, -27, 5, Math.PI, 0); c.stroke();
  for (let k = 0; k < 3; k++) { c.beginPath(); c.ellipse(sd * 80, -16 - k * 1.2, 6 - k, 2 - k * 0.3, 0, 0, TAU); c.strokeStyle = k % 2 ? '#d8b878' : '#b89858'; c.lineWidth = 1.4; c.stroke(); }
}
// the goose (baked once into a small sprite; paddled per frame)
function gooseSprite(dpr, s, dip) {
  const w = Math.ceil(s * 1.3), h = Math.ceil(s * 1.05), cv = document.createElement('canvas');
  dpr = Math.min(2, dpr || 1); cv.width = Math.ceil(w * dpr); cv.height = Math.ceil(h * dpr); const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.translate(w * 0.5, h * 0.78); const k = s / 40; c.scale(k, k);
  if (dip) { // head under, tail up: the body tipped forward, ripples where the neck goes in
    c.rotate(0.45); c.beginPath(); c.moveTo(-15, 2); c.bezierCurveTo(-18, -8, -10, -14, 2, -12); c.bezierCurveTo(10, -11, 15, -5, 15, 2); c.closePath(); c.fillStyle = '#ffffff'; c.fill(); c.strokeStyle = '#4a4a52'; c.lineWidth = 1.1; c.stroke();
    c.beginPath(); c.moveTo(-15, -4); c.lineTo(-22, -12); c.lineTo(-17, -1); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-12, -3); c.bezierCurveTo(-10, -9, -2, -10, 6, -8); c.bezierCurveTo(0, -5, -6, -3, -12, -3); c.fillStyle = '#e4e6ec'; c.fill();
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, Math.floor((h * 0.78 + 0.5) * dpr), cv.width, cv.height); // cut at the waterline
    return { cv, w, h };
  }
  // body afloat (cut at the waterline), neck up, head right
  const ink = '#4a4a52';
  c.beginPath(); c.moveTo(-17, 0); c.bezierCurveTo(-20, -9, -12, -15, 0, -14); c.bezierCurveTo(9, -14, 14, -9, 15, -3); c.lineTo(16, 0); c.closePath(); c.fillStyle = '#ffffff'; c.fill(); c.strokeStyle = ink; c.lineWidth = 1.1; c.stroke();
  c.beginPath(); c.moveTo(-15, -2); c.bezierCurveTo(-14, -9, -6, -11, 4, -9); c.bezierCurveTo(-2, -6, -8, -3, -15, -2); c.fillStyle = '#e4e6ec'; c.fill();
  c.beginPath(); c.moveTo(-17, -6); c.lineTo(-24, -11); c.lineTo(-19, -4); c.closePath(); c.fillStyle = '#ffffff'; c.fill(); c.stroke();
  c.beginPath(); c.moveTo(8, -12); c.bezierCurveTo(12, -20, 8, -28, 11, -33); c.lineTo(17, -33); c.bezierCurveTo(15, -27, 18, -20, 14, -10); c.closePath(); c.fillStyle = '#ffffff'; c.fill(); c.stroke();
  c.beginPath(); c.ellipse(14, -34, 4.6, 4, 0, 0, TAU); c.fillStyle = '#ffffff'; c.fill(); c.stroke();
  c.beginPath(); c.moveTo(18, -35.5); c.lineTo(25, -33.5); c.lineTo(18, -31.6); c.closePath(); c.fillStyle = '#ff9a2a'; c.fill(); c.strokeStyle = '#a85a10'; c.lineWidth = 0.8; c.stroke();
  circle(c, 15.4, -35, 1.1, '#2a2a30'); circle(c, 15.7, -35.4, 0.4, '#ffffff');
  veilSprite(c, cv); return { cv, w, h };
}
const pond = {
  atmo: { haze: ['#e6f6ff', 0.34, 22], bloom: ['#ffffff', 0.35, 10], key: ['#fff6d0', 0.07], shadow: ['#0c3020', 0.2] },
  frame: { kit: 'leafy', cols: ['#3a2a1a', '#1c5a2a', '#2c7a34', '#4c9c40'], tone: ['#0a2a1c', 0.2], noTop: true },
  stage: { top: '#5cb43c', soil: '#5a4428', flowers: null },
  stageFx(c, k) { const { w, u, y0, R, quiet } = k; for (let x = R() * 10 * u; x < w; x += R.r(10, 22) * u) { const q = quiet(x); if (R() < q) reedClump(c, x, y0 + 1 * u, R.r(7, 12) * u * q, R, 7); } },
  veil: ['#e2f4ff', 0.2], punch: 0.2,
  prep(S) { S.F = frameOf(S); S.live = null; },
  sky(c, S) {
    paintSky(c, S, {
      sky: [[0, '#3c9ce4'], [0.55, '#86cbf2'], [0.85, '#d2eef9'], [1, '#effaf6']],
      sun: [0.12, 0.06, '#fff8d0', 70], band: '#ffffff',
      cl: ['#ffffff', '#f2f8fb', '#cddff0'],
      clouds: S.port ? [[0.82, 0.25, 32, 1], [0.1, 0.33, 24, 0.95]] : [[0.84, 0.3, 30, 1], [0.32, 0.2, 22, 0.9]],
    });
  },
  back(ctx, t, S) { swallows(ctx, t, S, 1); },
  far(c, S) {
    const F = S.F;
    farmland(c, S, {
      hills: ['#b2d6d0', '#a2ccc0'], hills2: ['#a8d6a0', '#98ca90'], trees: ['#62a070', '#78b47e', '#9ccb96'], trunk: '#7a8a6a',
      fields: ['#a6d47c', '#bcd96c', '#94c86c', '#cbd877', '#aad57e'], hedge: '#5a965a',
      mill: S.port ? F.X(0.62) : F.X(0.62),
    });
  },
  near(c, S) {
    const { W, H, u, R, gy, port } = S, F = S.F;
    const fb = wave(R, S.by(0.1), 0.8 * u, 90 * u), wb = wave(R, S.by(port ? 0.58 : 0.55), 0.6 * u, 70 * u);
    // the far bank: a strip of grass and reeds
    fillUnder(c, W, H, (x) => fb(x) - 3 * u, vg(c, S.by(0.02), S.by(0.14), ['#8fcf6a', '#6cb84e']));
    // the water: the sky mirrored (pale at the far bank, bluer near), clipped between the banks
    c.save(); c.beginPath(); c.moveTo(-4, fb(-4)); for (let x = -4; x <= W + 4; x += 4) c.lineTo(x, fb(x)); for (let x = W + 4; x >= -4; x -= 4) c.lineTo(x, wb(x) + 2 * u); c.closePath(); c.clip();
    rect(c, 0, S.by(0.05), W, S.by(0.7) - S.by(0.05), vg(c, S.by(0.08), S.by(0.6), [[0, '#d6f0f8'], [0.35, '#9fd6ee'], [1, '#5aaad6']]));
    // reflections: the far bank's reeds and bushes, soft and dark; cloud glints
    for (let x = R() * 4 * u; x < W; x += R.r(2, 6) * u) rect(c, x, fb(x), R.r(0.6, 1.6) * u, R.r(2, 6) * u, 'rgba(60,110,70,0.22)');
    for (let i = 0; i < 18; i++) { const x = R() * W, y = lerp(S.by(0.16), S.by(0.56), R()); rect(c, x, y, R.r(6, 22) * u, R.r(0.25, 0.45) * u, R() < 0.6 ? 'rgba(255,255,255,0.55)' : 'rgba(40,110,160,0.25)'); }
    c.restore();
    // the far bank's reeds and a few bushes on it
    for (let x = R() * 8 * u; x < W; x += R.r(8, 18) * u) reedClump(c, x, fb(x) + 0.5 * u, R.r(5, 8) * u, R, 6);
    for (let x = R.r(0, 20) * u; x < W; x += R.r(40, 70) * u) bush(c, x, fb(x) - 1 * u, R.r(10, 16) * u, R.r(4, 6) * u, R, ['#3f8a3a', '#5aa244', '#8ccc62']);
    // lily pads (kept to the sides, the middle stays calm)
    for (let i = 0; i < 14; i++) { const side = i % 2 ? 1 : -1, x = W / 2 + side * R.r(0.22, 0.5) * W, y = lerp(S.by(0.22), S.by(0.52), R()); lily(c, x, y, R.r(1.6, 2.8) * u * (0.6 + 0.6 * (y - S.by(0.2)) / (S.by(0.5) - S.by(0.2))), R() < 0.3); }
    // the near bank: a muddy lip and grass down to the ground line
    c.beginPath(); c.moveTo(-4, H); for (let x = -4; x <= W + 4; x += 4) c.lineTo(x, wb(x)); c.lineTo(W + 4, H); c.closePath(); c.fillStyle = vg(c, S.by(0.55), gy, [[0, '#6aa848'], [0.2, '#78bf52'], [1, '#5aa640']]); c.fill();
    edge(c, W, wb, '#7a6038', 0.9 * u); edge(c, W, (x) => wb(x) - 0.5 * u, 'rgba(220,250,255,0.75)', 0.35 * u);
    // the willow leaning in from one side, the jetty from the other
    const wl = port ? -1 : 1; // portrait: the willow on the left; landscape: on the right (clear of the HUD)
    const wxp = port ? F.X(0.02) : F.X(0.84), ws = u * (port ? 36 : 30);
    willow(c, wxp, fb(wxp) + 2 * u, ws, port ? 1 : -1, R);
    const jx = port ? F.X(0.97) : F.X(0.22), js = u * 0.36;
    c.save(); c.translate(jx, wb(jx) - 2 * u); c.scale(js, js); paintJetty(c, R, port ? -1 : 1); c.restore();
    // reeds and cattails at the near corners
    for (const x of [F.X(port ? 0.02 : 0.03), F.X(port ? 0.98 : 0.97)]) { reedClump(c, x, wb(x) + 2 * u, 13 * u, R, 12); reedClump(c, x + (x < W / 2 ? 5 : -5) * u, wb(x) + 4 * u, 10 * u, R, 8); }
    for (let x = R() * 4 * u; x < W; x += R.r(3, 8) * u) { const e = Math.abs(x - W / 2) / (W / 2); if (R() < e * e) tuft(c, x, gy + R.r(0, 3) * u, R.r(3, 5.5) * u * (0.6 + e), R, ['#3f8a2e', '#5aa63c', '#7cc455']); }
    vaultHaze(c, S, '#eef8ff', 0.28);
    // where the goose paddles (front, live): the right part of the pond, behind the hen's head, clear of the vault centre
    const gy2 = S.by(port ? 0.3 : 0.3), lilyF = [port ? F.X(0.72) : F.X(0.3), S.by(0.46), -1];
    lily(c, lilyF[0], lilyF[1] + 0.3 * u, 3.4 * u, false);
    const frog = [lilyF[0], lilyF[1], port ? -1 : 1]; frog.sp = frogSprite(S.dpr, 4.2 * u);
    S.live = {
      goose: { xa: port ? F.X(0.6) : F.X(0.68), xb: port ? F.X(0.92) : F.X(0.86), y: gy2, sp: [gooseSprite(S.dpr, 9 * u, 0), gooseSprite(S.dpr, 9 * u, 1)] },
      frog, rings: [[F.X(0.12), S.by(0.36)], [F.X(0.85), S.by(0.22)], [F.X(port ? 0.2 : 0.35), S.by(0.2)]],
      dfly: [[F.X(port ? 0.16 : 0.12), S.by(0.12), '#2a7ab8'], [F.X(port ? 0.8 : 0.9), S.by(0.06), '#c84a2a']],
      sway: mkStrips(R, u, [[-2 * u, F.X(0.1)], [F.X(0.9), W + 2 * u]], gy, 7, 13, 1.6, { col: '#4f8f36', ear: '#7a4a26', lw: 0.32, er: 0.55 }),
    };
  },
  front(ctx, t, S) { pondLive(ctx, t, S); },
};
void wave;

// ------------------------------------------------------------------ 4. the Windmill
// the tower (unit space, foot centre at 0,0): a stone footing, a tapering smock of white weatherboards, a gallery,
// a red boat cap. The sails are live (millSails), turning about HUB.
const HUB = [0, -238];
function paintMillTower(c, R) {
  const yb = -18, yt = -222, hw0 = 40, hw1 = 22;
  softShadow(c, 40, 2, 90, 9, '#3a3a10', 0.4);
  // the stone footing
  const st = [-hw0 - 6, 0, hw0 + 6, 0, hw0 + 3, yb, -hw0 - 3, yb];
  shape(c, st, grad(c, -hw0, 0, hw0, 0, ['#ddd3c0', '#b8ac94', '#8d8270']), '#5e5444', 1.2);
  c.save(); path(c, st); c.clip(); for (let row = 0; row < 3; row++) for (let k = 0; k < 10; k++) { const x = -hw0 - 6 + k * 10 + (row % 2) * 5, y = -3 - row * 6; c.beginPath(); c.ellipse(x, y, 5, 2.8, 0, 0, TAU); c.strokeStyle = 'rgba(80,70,52,0.5)'; c.lineWidth = 0.8; c.stroke(); c.fillStyle = `rgba(255,255,255,${0.06 + R() * 0.16})`; c.fill(); } c.restore();
  // the smock: three faces, lit left, front, shaded right
  const fb = 14, ft = 8;
  const faces = [[[-hw0, yb], [-fb, yb + 2], [-ft, yt + 2], [-hw1, yt], '#fffaf0', '#ebe0c8'], [[-fb, yb + 2], [fb, yb + 2], [ft, yt + 2], [-ft, yt + 2], '#efe4cc', '#d8c8a6'], [[fb, yb + 2], [hw0, yb], [hw1, yt], [ft, yt + 2], '#c8b28c', '#a89170']];
  for (const [a, b, cc, dd, c0, c1] of faces) {
    const pts = [a[0], a[1], b[0], b[1], cc[0], cc[1], dd[0], dd[1]];
    shape(c, pts, vg(c, yt, yb, [c0, c1]), '#6e5e44', 1);
    c.save(); path(c, pts); c.clip(); for (let y = yb - 6; y > yt; y -= 7) { line(c, -50, y + 1.5, 50, y + 1.5, 'rgba(120,100,70,0.35)', 0.8); line(c, -50, y + 2.5, 50, y + 2.5, 'rgba(255,255,255,0.35)', 0.6); } c.restore();
  }
  // door, windows
  c.beginPath(); c.moveTo(-8, yb + 2); c.lineTo(-8, yb - 20); c.arc(0, yb - 20, 8, Math.PI, 0); c.lineTo(8, yb + 2); c.closePath(); c.fillStyle = '#6e4426'; c.fill(); c.strokeStyle = '#3e2412'; c.lineWidth = 1; c.stroke();
  for (const x of [-4, 0, 4]) line(c, x, yb + 1, x, yb - 24, 'rgba(40,20,8,0.5)', 0.7); circle(c, 5.2, yb - 9, 1, '#e8c060');
  for (const [x, y, w, h, col] of [[-22, -92, 9, 12, '#4a6a84'], [-5, -150, 9, 12, '#4a6a84'], [18, -78, 7, 11, '#38526a']]) { shape(c, [x, y, x + w, y + 0.6, x + w, y + h, x, y + h], col, '#5a4a36', 0.9); shape(c, [x, y, x + w * 0.55, y + 0.3, x, y + h * 0.6], 'rgba(255,255,255,0.35)'); line(c, x - 1, y + h + 1, x + w + 1, y + h + 1.4, '#8a6a4a', 1.4); }
  // the gallery around the middle
  c.strokeStyle = WOOD.ink; c.lineWidth = 2.6; c.beginPath(); c.moveTo(-40, -118); c.quadraticCurveTo(0, -111, 40, -118); c.stroke(); c.strokeStyle = WOOD.base; c.lineWidth = 1.4; c.stroke();
  c.strokeStyle = WOOD.ink; c.lineWidth = 2; c.beginPath(); c.moveTo(-40, -130); c.quadraticCurveTo(0, -123, 40, -130); c.stroke(); c.strokeStyle = WOOD.hi; c.lineWidth = 0.9; c.stroke();
  for (const x of [-36, -24, -12, 0, 12, 24, 36]) line(c, x, -128 + Math.abs(x) * 0.06, x, -116 + Math.abs(x) * 0.06, WOOD.ink, 1.1);
  // the cap
  c.beginPath(); c.moveTo(-28, yt + 2); c.quadraticCurveTo(-30, yt - 26, 0, yt - 33); c.quadraticCurveTo(30, yt - 26, 28, yt + 2); c.closePath();
  c.fillStyle = grad(c, -28, yt - 33, 28, yt, [RED.hi, RED.base, RED.lo]); c.fill(); c.strokeStyle = RED.ink; c.lineWidth = 1.1; c.stroke();
  c.save(); c.clip(); for (let k = 0; k < 5; k++) { const y = yt - 3 - k * 6; c.strokeStyle = 'rgba(80,16,8,0.4)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-30, y); c.quadraticCurveTo(0, y - 4, 30, y); c.stroke(); } ell(c, -9, yt - 22, 10, 5, 'rgba(255,220,200,0.3)', -0.4); c.restore();
  shape(c, [-30, yt + 3, 30, yt + 3, 28, yt - 1, -28, yt - 1], WOOD.lo, WOOD.ink, 0.9);
  circle(c, 0, yt - 34, 2.6, '#e8c060');
  shape(c, [-4, HUB[1] + 5, 4, HUB[1] + 5, 5, HUB[1] - 5, -5, HUB[1] - 5], WOOD.lo, WOOD.ink, 0.9);
}
// the sails (live): four lattice sails with canvas, turning about the hub (k: px per unit)
function sails(ctx, x, y, k, ang) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  for (let q = 0; q < 4; q++) {
    ctx.save(); ctx.rotate(ang + q * TAU / 4);
    ctx.fillStyle = '#8f7c68'; ctx.fillRect(-2.6, -4, 5.2, -106);
    ctx.fillStyle = 'rgba(246,244,236,0.96)'; ctx.fillRect(2.6, -20, 20, -84);
    ctx.fillStyle = 'rgba(222,214,198,0.75)'; ctx.fillRect(14, -20, 8.6, -84);
    ctx.strokeStyle = '#a48f78'; ctx.lineWidth = 1.6; ctx.strokeRect(2.6, -20, 20, -84);
    ctx.beginPath(); for (let i = 1; i < 7; i++) { ctx.moveTo(2.6, -20 - i * 12); ctx.lineTo(22.6, -20 - i * 12); } ctx.moveTo(12.6, -20); ctx.lineTo(12.6, -104); ctx.lineWidth = 0.9; ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = '#857362'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill(); ctx.fillStyle = '#b39a80'; ctx.beginPath(); ctx.arc(-1.4, -1.4, 4, 0, TAU); ctx.fill();
  ctx.restore();
}
// a wheat field: golden stalks with ears, denser and taller at the screen edges
function wheat(c, S, y0fn, R, cols, dens = 1) {
  const { W, H, u, gy } = S;
  fillUnder(c, W, H, y0fn, vg(c, y0fn(W / 2), gy, [[0, cols[0]], [1, cols[1]]]));
  c.save(); under(c, W, H, y0fn); c.clip();
  c.lineCap = 'round';
  for (let r = 0; r < 12; r++) {
    const k = (r + 0.5) / 12, base = lerp(y0fn(W / 2) + 2 * u, gy + 6 * u, k), hh = (2 + 7 * k) * u;
    for (let x = -R.r(0, 3) * u; x < W + 2 * u; x += (0.8 + 2.2 * k) * u / dens) {
      const e = Math.abs(x - W / 2) / (W / 2), h = hh * R.r(0.75, 1.1) * (0.75 + 0.35 * e), lean = R.r(-0.08, 0.12) * h, y = base + R.r(-1, 1) * u * k;
      c.strokeStyle = R() < 0.5 ? cols[2] : cols[3]; c.lineWidth = (0.15 + 0.22 * k) * u; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + lean * 0.3, y - h * 0.6, x + lean, y - h); c.stroke();
      ell(c, x + lean, y - h - 0.6 * k * u, (0.35 + 0.35 * k) * u, (0.9 + 1.1 * k) * u, R() < 0.5 ? cols[4] : cols[5], lean / h * 0.8);
    }
  }
  c.restore();
}
function scarecrowSide(c, x, y, s) {
  const ink = '#3a2614';
  line(c, x, y, x, y - 40 * s, ink, 2.4 * s); line(c, x, y, x, y - 40 * s, WOOD.base, 1.3 * s);
  line(c, x - 15 * s, y - 30 * s, x + 15 * s, y - 30 * s, ink, 2.2 * s); line(c, x - 15 * s, y - 30 * s, x + 15 * s, y - 30 * s, WOOD.base, 1.1 * s);
  shape(c, [x - 7 * s, y - 31 * s, x + 7 * s, y - 31 * s, x + 8 * s, y - 15 * s, x + 3 * s, y - 17 * s, x, y - 14 * s, x - 3 * s, y - 17 * s, x - 8 * s, y - 15 * s], '#4a6a9a', '#23304a', 0.8 * s);
  shape(c, [x - 15 * s, y - 31.5 * s, x - 7 * s, y - 31.5 * s, x - 7 * s, y - 28 * s, x - 15 * s, y - 28.5 * s], '#4a6a9a', '#23304a', 0.6 * s); shape(c, [x + 7 * s, y - 31.5 * s, x + 15 * s, y - 31.5 * s, x + 15 * s, y - 28.5 * s, x + 7 * s, y - 28 * s], '#3e5a86', '#23304a', 0.6 * s);
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) line(c, x + sx * 15 * s, y - 30 * s, x + sx * (16.5 + k * 0.6) * s, y - (28 - k * 1.4) * s, STRAW.base, 0.7 * s);
  rect(c, x - 2 * s, y - 26 * s, 3 * s, 3 * s, '#c8412f');
  circle(c, x, y - 35.5 * s, 4.6 * s, '#f0d8a0'); c.strokeStyle = '#8a6a3a'; c.lineWidth = 0.6 * s; c.beginPath(); c.arc(x, y - 35.5 * s, 4.6 * s, 0, TAU); c.stroke();
  circle(c, x - 1.6 * s, y - 36.2 * s, 0.6 * s, '#3a2a1a'); circle(c, x + 1.6 * s, y - 36.2 * s, 0.6 * s, '#3a2a1a'); c.beginPath(); c.arc(x, y - 34.8 * s, 1.8 * s, 0.3, Math.PI - 0.3); c.stroke();
  ell(c, x, y - 39.6 * s, 9 * s, 1.4 * s, '#a8823e'); c.beginPath(); c.ellipse(x, y - 40 * s, 4.6 * s, 4 * s, 0, Math.PI, 0); c.fillStyle = '#b8924a'; c.fill(); rect(c, x - 4.6 * s, y - 41.6 * s, 9.2 * s, 1.3 * s, '#8a3a2a');
}
const windmill = {
  atmo: { haze: ['#fff0d0', 0.34, 22], bloom: ['#fff4dc', 0.38, 10], key: ['#ffe2a8', 0.08], shadow: ['#2a2008', 0.2] },
  frame: { kit: 'leafy', cols: ['#4a321c', '#2a6a2a', '#3f8a36', '#6aac48'], tone: ['#142a10', 0.2], noTop: true },
  stage: { flowers: ['#ffffff', '#ffe066', '#ff9ec7'] },
  veil: ['#fff2dc', 0.18], punch: 0.2,
  prep(S) { S.F = frameOf(S); S.live = null; S.mill = null; },
  sky(c, S) {
    paintSky(c, S, {
      sky: [[0, '#4e98d6'], [0.5, '#8ec4e6'], [0.8, '#e6e4d2'], [1, '#fddfa4']],
      sun: [0.14, 0.08, '#ffe9a8', 80], band: '#ffe8bc',
      cl: ['#fffaf0', '#f8ecdc', '#e6ccb0'],
      clouds: S.port ? [[0.16, 0.26, 30, 1], [0.5, 0.17, 18, 0.8]] : [[0.36, 0.22, 26, 1], [0.1, 0.48, 18, 0.8]],
    });
  },
  back(ctx, t, S) { swallows(ctx, t, S, 2); },
  far(c, S) {
    const F = S.F;
    farmland(c, S, {
      hills: ['#c4d4c4', '#b6cbb2'], hills2: ['#b8d090', '#aac684'], trees: ['#6e9a5e', '#84ae6c', '#a8c88a'], trunk: '#7a7a58',
      fields: ['#e6c866', '#d8bc5c', '#bcd27a', '#efd27e', '#a8c870'], hedge: '#6a904c',
      barn: S.port ? F.X(0.14) : F.X(0.3),
    });
  },
  near(c, S) {
    const { W, H, u, R, gy, hz, port } = S, F = S.F;
    // the rise the mill stands on
    const mx = port ? F.X(0.82) : F.X(0.8), top = hz - (port ? 4 : 2) * u;
    const rise = (x) => lerp(S.by(0.28), top, Math.exp(-(((x - mx) / ((port ? 34 : 44) * u)) ** 2)));
    fillUnder(c, W, H, rise, vg(c, top, S.by(0.4), ['#9fd06a', '#76b84c']));
    edge(c, W, rise, 'rgba(230,250,170,0.7)', 0.5 * u);
    // a path winding up to the mill door
    c.strokeStyle = 'rgba(214,180,120,0.9)'; c.lineWidth = 2.4 * u; c.lineCap = 'round'; c.beginPath(); c.moveTo(mx, rise(mx) + 0.5 * u); c.bezierCurveTo(mx - 6 * u, rise(mx) + 4 * u, mx - 2 * u, S.by(0.25), mx - 12 * u, S.by(0.35)); c.stroke();
    // the windmill: tall on its rise; the sails turn (front)
    const avail = rise(mx) - (S.M + S.h * (port ? 0.2 : 0.1)), k = Math.min(u * (port ? 0.28 : 0.3), avail / 300);
    c.save(); c.translate(mx, rise(mx) + 1 * u); c.scale(k, k); paintMillTower(c, R); c.restore();
    S.mill = { x: mx, y: rise(mx) + 1 * u + HUB[1] * k, k: k * 1.08 };
    // the wheat field in front of it, a scarecrow keeping watch at the left
    const f0 = wave(R, S.by(0.3), 1 * u, 90 * u);
    wheat(c, S, f0, R, ['#e2c066', '#c99a46', '#c08a3a', '#d8a84a', '#f2d27a', '#e8bc58']);
    const scx = port ? F.X(0.12) : F.X(0.22); scarecrowSide(c, scx, S.by(0.62), u * 0.62);
    wheat(c, S, wave(R, S.by(0.66), 0.8 * u, 70 * u), R, ['#d9b65c', '#c4963e', '#b8823a', '#d09e44', '#f6d886', '#ecc262'], 0.8);
    vaultHaze(c, S, '#fff6e2', 0.28);
    // the living bits: the wheat at the corners waves (the phase rolls along x), a crow on the scarecrow, a butterfly
    S.live = {
      sway: mkStrips(R, u, [[-2 * u, F.X(port ? 0.2 : 0.2)], [F.X(port ? 0.82 : 0.8), W + 2 * u]], gy, 8, 13, 1.9, { col: '#c8963e', ear: '#f0cc6a', lw: 0.35, er: 0.7, kx: 0.06 / u }),
      crow: [scx + 9 * u * 0.62, S.by(0.62) - 30 * u * 0.62, 5.5 * u], fly: [port ? F.X(0.2) : F.X(0.14), S.by(0.45)],
    };
  },
  front(ctx, t, S) { millLive(ctx, t, S); },

};

// ------------------------------------------------------------------ 5. the Big Red Barn (the weasel boss)
const BARN = { red: '#c4402e', hi: '#e05c42', lo: '#8e2a20', ink: '#4e140c', slate: '#5e6874', slateHi: '#7a8692', slateLo: '#454e5a' };
// the barn, side view (unit space, front foot centre at 0,0): a gambrel front with white trim, its side wall going
// back to the LEFT (sd = -1) in shade; the big doors stand open on a warm lit inside; the hayloft door open too.
function paintBarn(c, R, sd) {
  const fx0 = -62, fx1 = 62, wh = 74, knee = 34, AP = -168, D = [sd * 56, -12];
  // the side wall going back (shade), roof planes above it
  const s0 = sd < 0 ? fx0 : fx1, side = [s0, 0, s0 + D[0], D[1], s0 + D[0], -wh + D[1], s0, -wh];
  shape(c, side, grad(c, s0, 0, s0 + D[0], 0, [BARN.lo, mix(BARN.red, '#2a0c10', 0.5)]), BARN.ink, 1.2);
  c.save(); path(c, side); c.clip(); for (let k = 1; k < 10; k++) { const a = k / 10, x = s0 + D[0] * a; line(c, x, D[1] * a + 2, x, -wh + D[1] * a - 2, 'rgba(50,8,4,0.45)', 0.9); } rect(c, Math.min(s0, s0 + D[0]), -wh - 20, Math.abs(D[0]), 18, 'rgba(30,6,4,0.35)'); c.restore();
  // a small window on the side wall, lit warm
  const wx = s0 + D[0] * 0.5, wy = -46 + D[1] * 0.5; shape(c, [wx - 7, wy, wx + 7, wy - 1, wx + 7, wy - 14, wx - 7, wy - 13], '#ffcf7a', '#f3e6c6', 1.8); line(c, wx, wy, wx, wy - 14, '#f3e6c6', 1.2);
  const k1 = [s0 + sd * 8, -wh - knee], e0 = [s0 + sd * 3, -wh + 2];
  const lower = [e0[0], e0[1], k1[0], k1[1], k1[0] + D[0], k1[1] + D[1], e0[0] + D[0], e0[1] + D[1]];
  const upper = [k1[0], k1[1], 0, AP, D[0], AP + D[1], k1[0] + D[0], k1[1] + D[1]];
  for (const [pl, c0, c1] of [[lower, BARN.slate, BARN.slateLo], [upper, BARN.slateHi, BARN.slate]]) {
    shape(c, pl, grad(c, pl[2], pl[3], pl[6], pl[7], [c0, c1]), '#2e343c', 1.1);
    c.save(); path(c, pl); c.clip(); for (let k = 1; k < 9; k++) { const a = k / 9, xa = lerp(pl[0], pl[2], a), ya = lerp(pl[1], pl[3], a); line(c, xa, ya, xa + D[0], ya + D[1], 'rgba(24,28,36,0.5)', 0.9); for (let q = 0; q < 9; q++) { const v = (q + (k % 2) * 0.5) / 9; line(c, xa + D[0] * v, ya + D[1] * v, xa + D[0] * v + 1.6, ya + D[1] * v - 3.6, 'rgba(24,28,36,0.35)', 0.6); } } c.restore();
  }
  // the gambrel front
  const front = [fx0, 0, fx1, 0, fx1, -wh, fx1 - 10, -wh - knee, 0, AP, fx0 + 10, -wh - knee, fx0, -wh];
  shape(c, front, grad(c, fx0, AP, fx1, 0, [BARN.hi, BARN.red, mix(BARN.red, BARN.lo, 0.5)]), BARN.ink, 1.3);
  c.save(); path(c, front); c.clip();
  for (let x = fx0 + 7; x < fx1; x += 7) { line(c, x, 0, x, AP, 'rgba(80,14,8,0.38)', 0.9); line(c, x + 1.1, 0, x + 1.1, AP, 'rgba(255,170,150,0.2)', 0.6); }
  rect(c, fx0, -10, fx1 - fx0, 10, 'rgba(60,10,4,0.18)');
  c.restore();
  // white trim along the gambrel edge and the corners
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.strokeStyle = mix(CREAM.lo, '#3a2010', 0.35); c.lineWidth = 6.2; c.beginPath(); c.moveTo(fx0 - 4, -wh + 2); c.lineTo(fx0 + 9, -wh - knee - 1); c.lineTo(0, AP - 2); c.lineTo(fx1 - 9, -wh - knee - 1); c.lineTo(fx1 + 4, -wh + 2); c.stroke();
  c.strokeStyle = CREAM.base; c.lineWidth = 4.2; c.stroke();
  for (const x of [fx0 + 2, fx1 - 2]) shape(c, [x - 2.6, 0, x + 2.6, 0, x + 2.6, -wh, x - 2.6, -wh], x < 0 ? CREAM.base : CREAM.lo);
  // the hayloft: an open door with hay, a beam and pulley above
  const hy = -wh - 18;
  shape(c, [-16, hy, 16, hy, 16, hy - 32, -16, hy - 32], CREAM.base, mix(CREAM.lo, '#3a2010', 0.3), 0.8);
  shape(c, [-12.5, hy - 1, 12.5, hy - 1, 12.5, hy - 28.5, -12.5, hy - 28.5], '#2a1610');
  c.save(); path(c, [-12.5, hy - 1, 12.5, hy - 1, 12.5, hy - 28.5, -12.5, hy - 28.5]); c.clip(); glow(c, 0, hy - 4, 24, '#ffb04a', 0.6);
  c.beginPath(); c.moveTo(-14, hy); c.quadraticCurveTo(-7, hy - 15, 0, hy - 12); c.quadraticCurveTo(7, hy - 17, 14, hy); c.closePath(); c.fillStyle = vg(c, hy - 17, hy, [STRAW.hi, STRAW.lo]); c.fill(); c.restore();
  c.strokeStyle = STRAW.hi; c.lineWidth = 1.1; for (let k = 0; k < 8; k++) { const x = -11 + k * 3.1; line(c, x, hy - 1, x + (k % 2 ? 2.4 : -2.4), hy + 4.5, STRAW.hi, 1.1); }
  shape(c, [-sd * 12.5, hy - 1, -sd * 24, hy + 3, -sd * 24, hy - 26, -sd * 12.5, hy - 28.5], '#b03a2a', CREAM.base, 1.6); // the open shutter
  shape(c, [-3, hy - 40, 3, hy - 40, 3 + 10, hy - 47, -3 + 10, hy - 47], WOOD.lo, WOOD.ink, 0.9);
  line(c, 9, hy - 42, 9, hy - 22, '#6a5a40', 0.9); circle(c, 9, hy - 42, 2.6, '#6e7480');
  // the big doors, open: a warm lit inside with bales and a lantern, the two door leaves swung out
  const dx0 = -36, dx1 = 36, dh = 56;
  shape(c, [dx0 - 4, 0, dx1 + 4, 0, dx1 + 4, -dh - 4, dx0 - 4, -dh - 4], CREAM.base, mix(CREAM.lo, '#3a2010', 0.3), 0.9);
  shape(c, [dx0, 0, dx1, 0, dx1, -dh, dx0, -dh], '#3a1c10');
  c.save(); path(c, [dx0, 0, dx1, 0, dx1, -dh, dx0, -dh]); c.clip();
  rect(c, dx0, -dh, dx1 - dx0, dh, vg(c, -dh, 0, ['#5a2a14', '#a8521c', '#e88a2e']));
  glow(c, 4, -24, 50, '#ffc860', 0.75); glow(c, 4, -24, 20, '#fff0b0', 0.55);
  for (const [bx, by] of [[-30, 0], [-12, 0], [-22, -14], [16, 0]]) { rr(c, bx, by - 14, 17, 14, 2); c.fillStyle = '#c8822e'; c.fill(); rect(c, bx, by - 14, 17, 4, '#e8a83e'); }
  line(c, 22, -dh, 22, -36, '#2a1608', 0.8); rr(c, 19.5, -36, 5, 7, 1.4); c.fillStyle = '#ffe9a0'; c.fill(); glow(c, 22, -32, 12, '#fff2b0', 0.8);
  rect(c, dx0, -6, dx1 - dx0, 6, 'rgba(255,200,110,0.35)');
  c.restore();
  // the door leaves swung open against the wall: red with white X braces, seen a little edge-on
  for (const s of [-1, 1]) {
    const xa = s < 0 ? dx0 - 4 : dx1 + 4, xb = xa + s * 26, pts = [xa, 0, xb, 3, xb, -dh - 1, xa, -dh - 4];
    shape(c, pts, grad(c, xa, 0, xb, 0, s < 0 ? [BARN.lo, BARN.red] : [BARN.red, BARN.lo]), BARN.ink, 1);
    c.save(); path(c, pts); c.clip(); c.strokeStyle = CREAM.base; c.lineWidth = 3; c.beginPath(); c.moveTo(xa, -2); c.lineTo(xb, -dh + 1); c.moveTo(xb, 1); c.lineTo(xa, -dh - 2); c.stroke(); c.lineWidth = 2.4; c.beginPath(); path(c, pts); c.stroke(); c.restore();
  }
  shape(c, [dx0 - 8, -dh - 8, dx1 + 8, -dh - 8, dx1 + 8, -dh - 4, dx0 - 8, -dh - 4], '#4a4440'); // the door track
  // the warm light spilling out onto the yard
  c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = radial(c, 0, 4, 0, 60, [rgba('#ffb050', 0.45), rgba('#ff9a3a', 0.15), rgba('#ff9a3a', 0)]); c.beginPath(); c.ellipse(0, 6, 60, 10, 0, 0, TAU); c.fill(); c.restore();
  // the weather vane on the ridge
  const vx = D[0] * 0.25, vy = AP + D[1] * 0.25;
  line(c, vx, vy, vx, vy - 40, '#3a3438', 1.8); line(c, vx - 10, vy - 21, vx + 10, vy - 21, '#3a3438', 1.4); circle(c, vx, vy - 3, 2.6, '#3a3438');
}
// a crow, perched (unit space s ~ body length): ink body, a little lit edge
function crow(c, x, y, s, face, tilt = 0) {
  c.save(); c.translate(x, y); c.scale(face * s / 20, s / 20); c.rotate(tilt);
  const ink = '#16161e', body = '#2a2c3a', hi = '#4a5266';
  line(c, -1, 0, -2, 5, '#3a3020', 1.2); line(c, 3, 0, 3, 5, '#3a3020', 1.2);
  c.beginPath(); c.moveTo(-12, -2); c.lineTo(-17, 2); c.lineTo(-12, 1); c.bezierCurveTo(-6, 4, 6, 3, 9, -3); c.bezierCurveTo(10, -9, 4, -11, -2, -9); c.bezierCurveTo(-7, -8, -10, -5, -12, -2); c.closePath(); c.fillStyle = body; c.fill(); c.strokeStyle = ink; c.lineWidth = 1; c.stroke();
  c.beginPath(); c.moveTo(-8, -6); c.bezierCurveTo(-3, -9, 4, -8, 6, -4); c.bezierCurveTo(1, -5, -4, -4, -8, -6); c.fillStyle = hi; c.fill();
  c.beginPath(); c.arc(9, -9, 4.2, 0, TAU); c.fillStyle = body; c.fill(); c.stroke();
  c.beginPath(); c.moveTo(12.5, -10); c.lineTo(18.5, -8.4); c.lineTo(12.5, -7.2); c.closePath(); c.fillStyle = '#4a4440'; c.fill();
  circle(c, 10.4, -9.8, 1, '#ffd84a'); circle(c, 10.6, -10, 0.45, '#16161e');
  c.restore();
}
const redbarn = {
  atmo: { haze: ['#ffcf9a', 0.3, 22], bloom: ['#ffd8a0', 0.45, 12], key: ['#ffc888', 0.08], shadow: ['#2a0c20', 0.24] },
  frame: { kit: 'leafy', cols: ['#2a1420', '#5a2a1c', '#8a4a1e', '#c9772b'], tone: ['#1c0c1c', 0.3], noTop: true },
  stage: { top: '#b8904a', soil: '#4a3020', straw: ['#e8b85a', '#c99a3c', '#f3d27a'], leaves: ['#d9772b', '#b8461f', '#e0a33a'] },
  veil: ['#ffe6c8', 0.16], punch: 0.2,
  prep(S) { S.F = frameOf(S); S.barn = null; },
  sky(c, S) {
    const { W, H, u, R, hz, port } = S;
    rect(c, 0, 0, W, H, vg(c, 0, hz + 6 * u, [[0, '#4a3c7c'], [0.3, '#8a5a8a'], [0.6, '#e88a6a'], [0.85, '#ffbe6e'], [1, '#ffd890']]));
    // the low sun on the right, a long warm glow
    const sx = W * (port ? 0.86 : 0.88), sy = hz - 16 * u;
    glow(c, sx, sy, 90 * u, '#ffb050', 0.5); glow(c, sx, sy, 30 * u, '#ffe0a0', 0.6); circle(c, sx, sy, 7 * u, '#fff0c0'); circle(c, sx, sy, 6 * u, '#fff8e0');
    // long streaks of cloud lit gold underneath
    for (let i = 0; i < 9; i++) { const y = H * R.r(0.08, 0.42), x = R() * W, w = R.r(20, 50) * u, hi = y > H * 0.25; ell(c, x, y, w, R.r(1, 2) * u, rgba(hi ? '#ff9a7a' : '#a8608a', 0.5)); ell(c, x - w * 0.15, y + 0.8 * u, w * 0.7, 0.6 * u, rgba('#ffd0a0', hi ? 0.6 : 0.3)); }
    for (const [fx, fy, fw] of port ? [[0.2, 0.28, 30], [0.72, 0.18, 24]] : [[0.4, 0.24, 26], [0.66, 0.14, 20]]) cloud(c, W * fx, H * fy, fw * u, R, '#ffd6b0', '#e8a8a0', '#a86a8a', 0.95);
  },
  back(ctx, t, S) { void ctx; void t; void S; },
  far(c, S) {
    const F = S.F;
    farmland(c, S, {
      hills: ['#b88a9a', '#c4908e'], hills2: ['#b8946e', '#a8865e'], trees: ['#6a5a5a', '#7e6a62', '#9a7c6a'], trunk: '#5a4a4a',
      fields: ['#d8a65e', '#c89452', '#e0b46a', '#b88a50', '#a8945a'], hedge: '#6a5a46',
      mill: S.port ? F.X(0.72) : F.X(0.62),
    });
  },
  near(c, S) {
    const { W, H, u, R, gy, port } = S, F = S.F;
    // the yard: packed earth, warm in the low light
    const y0 = wave(R, S.by(0.16), 1 * u, 100 * u);
    fillUnder(c, W, H, y0, vg(c, S.by(0.1), gy + 4 * u, [[0, '#c69a5a'], [0.5, '#b08048'], [1, '#9a6c3c']]));
    edge(c, W, y0, 'rgba(255,214,150,0.7)', 0.5 * u);
    // wheel ruts and straw on the yard
    c.strokeStyle = 'rgba(110,70,30,0.35)'; c.lineWidth = 0.5 * u; for (const k of [0.45, 0.52]) { c.beginPath(); c.moveTo(-4, S.by(k)); c.bezierCurveTo(W * 0.3, S.by(k + 0.1), W * 0.6, S.by(k - 0.05), W + 4, S.by(k + 0.08)); c.stroke(); }
    for (let i = 0; i < W / u * 0.6; i++) { const x = R() * W, y = lerp(y0(x) + 2 * u, gy + 4 * u, R()), a = R.r(-0.6, 0.6); line(c, x, y, x + Math.cos(a) * 2 * u, y + Math.sin(a) * 0.6 * u, R.pick(['#e8b85a', '#c99a3c', '#f3d27a']), 0.25 * u); }
    // a fence at the right with long shadows thrown left by the low sun, and a lantern post
    const fy = (x) => y0(x) + 6 * u, fh = 8 * u, fx0 = port ? F.X(0.5) : F.X(0.62);
    c.save(); c.globalAlpha = 0.28; c.fillStyle = '#3a1830'; for (let x = fx0 + 2 * u; x < W; x += 15 * u) { c.beginPath(); c.moveTo(x - 0.8 * u, fy(x)); c.lineTo(x + 0.8 * u, fy(x)); c.lineTo(x - 18 * u, fy(x) + 3.4 * u); c.lineTo(x - 20 * u, fy(x) + 3.4 * u); c.closePath(); c.fill(); } c.restore();
    railFence(c, fx0, W + 4 * u, fy, 15 * u, fh, '#a87a50', R);
    const lx = port ? F.X(0.94) : F.X(0.93); lanternPost(c, lx, fy(lx) + 1 * u, u);
    // pumpkins and a bale by the fence
    for (const [px, ps] of port ? [[0.6, 2.2], [0.66, 1.6]] : [[0.7, 2.4], [0.75, 1.7], [0.98, 2]]) pumpkin(c, F.X(px), fy(F.X(px)) + 2 * u, ps * u);
    // the barn: big, on the left, its doors open on a warm glow; its side wall goes back off the left edge
    const bx = port ? F.X(0.27) : F.X(0.335), bk = u * (port ? 0.42 : 0.27), by = gy - (port ? 9 : 12) * u;
    // its long shadow on the yard, to the left
    softShadow(c, bx - 40 * bk, by + 2 * u, 120 * bk, 9 * bk, '#3a1020', 0.35);
    c.save(); c.translate(bx, by); c.scale(bk, bk); paintBarn(c, R, -1); c.restore();
    // crows on the gambrel ridge
    const ridge = (fx) => [bx + fx * bk, by + (-168 + Math.abs(fx) * (34 / 52)) * bk];
    const cs = 10 * bk * 1.6;
    for (const [fx, face] of [[-30, 1], [-14, -1], [20, -1]]) { const [x, y] = ridge(fx); crow(c, x, y - 4 * bk, cs, face, face > 0 ? 0.05 : -0.05); }
    const [lx2, ly2] = ridge(34), vane = [bx + 56 * -0.25 * bk, by + (-168 - 12 * 0.25) * bk, bk];
    S.barn = { crow: (() => { const [x, y] = ridge(-14); return [x, y - 4 * bk, cs, -1]; })(), gx: bx, gy: by - 28 * bk, glow: glowSprite(S.dpr, 62 * bk, '#ffb04a'),
      lamp: [lx - 4.6 * u, fy(lx) + 1 * u - 22 * u + 5.4 * u], lglow: glowSprite(S.dpr, 9 * u, '#ffc060'), vane,
      land: [lx2, ly2 - 4 * bk, cs], from: [S.W + 10 * u, S.H * 0.18], to: [-10 * u, S.H * 0.12] };
    for (let x = R() * 4 * u; x < W; x += R.r(3, 8) * u) { const e = Math.abs(x - W / 2) / (W / 2); if (R() < e * e * 0.8) tuft(c, x, gy + R.r(0, 3) * u, R.r(3, 5) * u * (0.6 + e), R, ['#6a6a2a', '#8a7a34', '#a88a3a']); }
    vaultHaze(c, S, '#ffe8cc', 0.24);
  },
  front(ctx, t, S) { barnLive(ctx, t, S); },
};
function glowSprite(dpr, r, col) {
  const w = Math.ceil(r * 2), cv = document.createElement('canvas'); cv.width = Math.ceil(w * Math.min(dpr, 1)); cv.height = cv.width;
  const c = cv.getContext('2d'), q = cv.width / 2; c.fillStyle = radial(c, q, q, 0, q, [rgba(col, 0.8), rgba(col, 0.3), rgba(col, 0)]); c.fillRect(0, 0, cv.width, cv.height);
  return { cv, w, h: w };
}
function lanternPost(c, x, y, u) {
  const h = 22 * u; line(c, x, y, x, y - h, WOOD.ink, 1.6 * u); line(c, x - 0.3 * u, y, x - 0.3 * u, y - h, WOOD.base, 0.9 * u);
  line(c, x, y - h + 1 * u, x - 5 * u, y - h + 1 * u, WOOD.ink, 0.9 * u); line(c, x - 4.6 * u, y - h + 1 * u, x - 4.6 * u, y - h + 3 * u, '#2a1608', 0.25 * u);
  glow(c, x - 4.6 * u, y - h + 5.4 * u, 14 * u, '#ffb04a', 0.55);
  rect(c, x - 6.4 * u, y - h + 2.6 * u, 3.6 * u, 0.9 * u, '#2b1c12'); rr(c, x - 6 * u, y - h + 3.4 * u, 2.8 * u, 4 * u, 0.8 * u); c.fillStyle = '#ffd27a'; c.fill(); circle(c, x - 4.6 * u, y - h + 5.6 * u, 0.9 * u, '#fff4c8'); rect(c, x - 6.4 * u, y - h + 7.3 * u, 3.6 * u, 0.8 * u, '#2b1c12');
}
function pumpkin(c, x, y, s) {
  softShadow(c, x - s * 0.8, y + s * 0.1, s * 2, s * 0.35, '#3a1020', 0.35);
  for (const [dx, k, col] of [[-0.55, 0.62, '#c95d14'], [0.55, 0.62, '#b85212'], [0, 0.72, '#e8771f']]) ell(c, x + dx * s, y - s * 0.8, s * k, s * 0.82, col);
  c.strokeStyle = 'rgba(90,30,6,0.5)'; c.lineWidth = s * 0.06; c.beginPath(); c.ellipse(x, y - s * 0.8, s * 1.15, s * 0.82, 0, 0, TAU); c.stroke();
  ell(c, x + 0.25 * s, y - s * 1.05, s * 0.2, s * 0.45, '#f6a04a');
  rect(c, x - 0.1 * s, y - s * 1.85, 0.2 * s, 0.4 * s, '#4c5a24');
}

// ------------------------------------------------------------------ the living things (per frame, cheap)
// Every creature here is a small sprite baked once per size (characters from allies.js / characters.js) or a few path
// ops, placed by a pure function of the clock on its own timer, culled off screen, never dead centre behind the vault.
// With Reduced motion or on Low graphics the scene is one still picture: the creatures that belong in the picture
// (the rooster on his post, the goose, the frog, the mill's sails, the vane) hold their rest pose; the passers-by
// (birds, butterflies, moths, the tractor, fish rings) are left out.
const fract = (x) => x - Math.floor(x);
const win = (t, a, b, f = 0.25) => sstep(0, 1, (t - a) / f) * (1 - sstep(0, 1, (t - b) / f));
const cyc = (t, per, off = 0) => fract((t + off) / per) * per; // seconds into a repeating routine
function bake(dpr, w, h, fn) {
  const cv = document.createElement('canvas'), d = Math.min(2, dpr || 1); cv.width = Math.max(1, Math.ceil(w * d)); cv.height = Math.max(1, Math.ceil(h * d));
  const c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); fn(c, w, h); veilSprite(c, cv); return { cv, w, h };
}
// draw a baked sprite with its anchor (ax, ay as fractions of its box) at x, y; mirrored when face < 0
function stamp(ctx, sp, x, y, ax = 0.5, ay = 1, face = 1, sc = 1) {
  if (face < 0 || sc !== 1) { ctx.save(); ctx.translate(x, y); ctx.scale(face * sc, sc); ctx.drawImage(sp.cv, -sp.w * ax, -sp.h * ay, sp.w, sp.h); ctx.restore(); }
  else ctx.drawImage(sp.cv, x - sp.w * ax, y - sp.h * ay, sp.w, sp.h);
}
const vis = (S, x, pad) => x > -pad && x < S.W + pad;
function chickSprites(dpr, cs) {
  const mk = (peck, flap) => bake(dpr, cs * 1.6, cs * 1.7, (c, w, h) => drawChick(c, w / 2, h - cs * 0.72, cs, peck ? 0.12 : 0, flap, peck));
  return [mk(0, 0), mk(1, 0), mk(0, 1)];
}
function roosterSprites(dpr, s) {
  const mk = (P) => bake(dpr, s * 1.7, s * 1.75, (c, w, h) => drawRooster(c, w * 0.5, h - s * 0.08 - s * 0.48, s, P));
  return [mk(roosterPose('idle', 0, 0)), mk(roosterPose('puff', 1, 0)), mk(roosterPose('crow', 1, 0.05))];
}
function butterflyAt(ctx, t, x0, y0, rx, ry, s, col, ph) {
  const th = t * 0.55 + ph, x = x0 + Math.sin(th) * rx + Math.sin(th * 2.3) * rx * 0.25, y = y0 + Math.sin(th * 1.7) * ry - Math.abs(Math.sin(t * 3 + ph)) * s * 0.6;
  const f = 0.25 + 0.75 * Math.abs(Math.sin(t * 13 + ph));
  ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x - s * 0.42 * f, y - s * 0.12, s * 0.42 * f, s * 0.5, -0.35, 0, TAU); ctx.ellipse(x + s * 0.42 * f, y - s * 0.12, s * 0.42 * f, s * 0.5, 0.35, 0, TAU);
  ctx.ellipse(x - s * 0.28 * f, y + s * 0.28, s * 0.28 * f, s * 0.3, -0.2, 0, TAU); ctx.ellipse(x + s * 0.28 * f, y + s * 0.28, s * 0.28 * f, s * 0.3, 0.2, 0, TAU); ctx.fill();
  ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - s * 0.06, y - s * 0.4, s * 0.12, s * 0.8);
}
// a little flying bird (V wings), for circling and passing
function vBird(ctx, x, y, s, flap, col = '#2e2a34') {
  const f = Math.sin(flap); ctx.strokeStyle = col; ctx.lineWidth = s * 0.22; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - s, y - f * s * 0.6); ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.35, x, y); ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.35, x + s, y - f * s * 0.6); ctx.stroke();
}
// swaying strips of grass, reeds or wheat (a few path ops each); the phase can run along x so waves roll across
function swayStrips(ctx, t, S, strips) {
  ctx.lineCap = 'round';
  for (const st of strips) {
    ctx.strokeStyle = st.col; ctx.lineWidth = st.lw; ctx.beginPath();
    for (const p of st.pts) { const sw = (Math.sin(t * 1.3 + st.p - p[0] * st.kx) * 0.6 + Math.sin(t * 2.1 + st.p * 2) * 0.25) * p[2] * 0.16; ctx.moveTo(p[0], p[1]); ctx.quadraticCurveTo(p[0] + sw * 0.3, p[1] - p[2] * 0.6, p[0] + sw, p[1] - p[2]); }
    ctx.stroke();
    if (st.ear) { ctx.fillStyle = st.ear; ctx.beginPath(); for (const p of st.pts) { const sw = (Math.sin(t * 1.3 + st.p - p[0] * st.kx) * 0.6 + Math.sin(t * 2.1 + st.p * 2) * 0.25) * p[2] * 0.16, ex = p[0] + sw, ey = p[1] - p[2] - st.er * 2.2; ctx.moveTo(ex + st.er, ey); ctx.ellipse(ex, ey, st.er, st.er * 2.4, sw / p[2], 0, TAU); } ctx.fill(); }
  }
}
function mkStrips(R, u, ranges, y, hmin, hmax, step, o) {
  return ranges.map(([x0, x1], i) => { const pts = []; for (let x = x0; x < x1; x += R.r(step * 0.7, step * 1.3) * u) pts.push([x, y + R.r(0.5, 3.5) * u, R.r(hmin, hmax) * u]); return { pts, p: i * 1.7, kx: o.kx || 0, col: o.col, ear: o.ear, lw: o.lw * u, er: (o.er || 0.7) * u }; });
}

// the hen house: the rooster crows on his post now and then; chicks peck in the yard; one hops up the ramp and in;
// a butterfly over the flowers; swallows overhead (back)
function coopLive(ctx, t, S) {
  const L = S.live; if (!L) return;
  const st = still(), u = S.u;
  tfL(ctx, S, 1);
  // the rooster: stands, puffs up, crows, settles (a 9 s routine), now and then glances back
  { const c = st ? 0 : cyc(t, 9.2, 1.6), sp = c > 5.2 && c < 6.9 ? L.roo[2] : c > 4.7 && c < 7.2 ? L.roo[1] : L.roo[0], look = !st && Math.sin(t * 0.6) > 0.7 ? -1 : 1;
    stamp(ctx, sp, L.post[0], L.post[1] - (st ? 0 : Math.max(0, Math.sin(c * 1.3)) * 0.15 * u), 0.5, 1, L.post[2] * look);
    if (!st && c > 5.3 && c < 7.6) for (let k = 0; k < 3; k++) { const a = (c - 5.3 - k * 0.35) / 1.5; if (a <= 0 || a >= 1) continue; const nx = L.post[0] + L.post[2] * (5 + a * 9) * u, ny = L.post[1] - L.roo[0].h * 0.9 - a * 12 * u; ctx.globalAlpha = Math.min(1, a * 5) * (1 - a); ctx.fillStyle = '#5a3a6a'; ctx.beginPath(); ctx.ellipse(nx, ny, 1 * u, 0.75 * u, -0.4, 0, TAU); ctx.fill(); ctx.fillRect(nx + 0.75 * u, ny - 3.6 * u, 0.3 * u, 3.6 * u); ctx.globalAlpha = LIVE_A; } }
  // chicks: one pecks and hops between three spots, one scratches and looks about
  for (let i = 0; i < L.chicks.length; i++) {
    const ch = L.chicks[i]; if (!vis(S, ch[0], 20 * u)) continue;
    const per = 3.4 + i * 0.9, c = st ? 0 : cyc(t, per, i * 1.3), step = st ? 0 : Math.floor((t + i * 1.3) / per), hopK = st ? 0 : sstep(per - 0.5, per, c);
    const xs = [0, 5, -4], x = ch[0] + lerp(xs[step % 3], xs[(step + 1) % 3], hopK) * u, y = ch[1] - Math.sin(hopK * Math.PI) * 2 * u;
    const peck = !st && win(c, 0.2, per - 1.2, 0.15) > 0.5 && Math.sin(t * 9 + i) > 0;
    stamp(ctx, peck ? L.chk[1] : L.chk[0], x, y, 0.5, 1, (step + i) % 2 ? -1 : 1);
  }
  // a chick hops up the ramp and goes in, then comes back down a while later
  if (!st && L.ramp) { const c = cyc(t, 16, 3), [ax, ay, bx, by] = L.ramp; let k = -1, face = 1; if (c < 4) { k = c / 4; } else if (c > 9 && c < 13) { k = 1 - (c - 9) / 4; face = -1; }
    if (k >= 0 && k < 0.96) { const hop = Math.abs(Math.sin(c * 7)) * 1.2 * u, x = lerp(ax, bx, k), y = lerp(ay, by, k) - hop; stamp(ctx, L.chk[2], x, y, 0.5, 1, face * L.rampDir, 0.85); } }
  if (!st && L.fly) butterflyAt(ctx, t, L.fly[0], L.fly[1], 10 * u, 4 * u, 1.6 * u, '#ffd23a', 0.4);
  ctx.restore();
}

// the haystacks: a field mouse pops out between the bales; a red tractor creeps along a far field (mid); the stubble
// tufts sway at the corners; a cabbage white flits over the field; swallows swoop (back)
function hayLive(ctx, t, S) {
  const L = S.live; if (!L || still()) return;
  const u = S.u;
  tfL(ctx, S, 1);
  swayStrips(ctx, t, S, L.sway);
  { const c = cyc(t, 9, 2), up = win(c, 1, 4.2, 0.35); if (up > 0.01) {
    const [x, y, k] = L.mouse, h = up * 2.6 * k, sn = Math.sin(t * 14) * 0.15 * k;
    ctx.save(); ctx.beginPath(); ctx.rect(x - 6 * k, y - 8 * k, 12 * k, 8 * k); ctx.clip();
    ctx.fillStyle = '#8a7a72'; ctx.beginPath(); ctx.ellipse(x, y - h + 1.6 * k, 2.2 * k, 1.8 * k, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x - 1.6 * k, y - h, 1 * k, 0, TAU); ctx.arc(x + 1.6 * k, y - h, 1 * k, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f0b0b8'; ctx.beginPath(); ctx.arc(x - 1.6 * k, y - h, 0.55 * k, 0, TAU); ctx.arc(x + 1.6 * k, y - h, 0.55 * k, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1e1a1c'; ctx.fillRect(x - 0.9 * k, y - h + 1.2 * k, 0.5 * k, 0.5 * k); ctx.fillRect(x + 0.4 * k, y - h + 1.2 * k, 0.5 * k, 0.5 * k);
    ctx.fillStyle = '#e88a9a'; ctx.beginPath(); ctx.arc(x + sn, y - h + 2.6 * k, 0.4 * k, 0, TAU); ctx.fill();
    ctx.restore(); } }
  butterflyAt(ctx, t, L.fly[0], L.fly[1], 14 * u, 5 * u, 1.4 * u, '#fbfbf2', 1.1);
  ctx.restore();
}
function tractorMid(ctx, t, S) {
  const L = S.live; if (!L || !L.trac || still()) return;
  const u = S.u, [y, x0, x1] = L.trac, per = 70, k = cyc(t, per) / per, x = lerp(x0, x1, k), b = Math.sin(t * 8) * 0.08 * u;
  tfL(ctx, S, 0.35);
  ctx.fillStyle = '#c8412f'; ctx.fillRect(x - 2.4 * u, y - 2.4 * u + b, 3.4 * u, 1.6 * u); ctx.fillRect(x - 0.4 * u, y - 3.8 * u + b, 1.6 * u, 1.6 * u);
  ctx.fillStyle = '#d8eef6'; ctx.fillRect(x - 0.1 * u, y - 3.5 * u + b, 1 * u, 0.8 * u);
  ctx.fillStyle = '#2e2a2a'; ctx.beginPath(); ctx.arc(x + 0.4 * u, y - 0.9 * u, 1 * u, 0, TAU); ctx.arc(x - 2 * u, y - 0.6 * u, 0.6 * u, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(240,226,200,0.6)'; for (let q = 0; q < 3; q++) { const a = fract(t * 0.6 + q / 3); ctx.beginPath(); ctx.arc(x - 1.6 * u - a * 3 * u, y - 4.4 * u - a * 3 * u, (0.4 + a * 0.8) * u, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// the duck pond: the goose paddles, turns and dips its head; a frog on a lily pad blinks and hops off; fish rings;
// two dragonflies dart and hover; the reeds at the corners sway
function pondLive(ctx, t, S) {
  const L = S.live; if (!L) return;
  const st = still(), u = S.u;
  tfL(ctx, S, 1);
  if (!st) swayStrips(ctx, t, S, L.sway);
  // fish rings now and then (one at a time)
  if (!st) { const c = cyc(t, 6.5, 1), i = Math.floor((t + 1) / 6.5) % L.rings.length, a = c / 2.2; if (a < 1) { const [x, y] = L.rings[i]; ctx.strokeStyle = `rgba(235,252,255,${(1 - a) * 0.75})`; ctx.lineWidth = 0.3 * u; ctx.beginPath(); ctx.ellipse(x, y, (0.6 + a * 5) * u, (0.2 + a * 1.4) * u, 0, 0, TAU); ctx.stroke(); if (a > 0.3) { ctx.beginPath(); ctx.ellipse(x, y, (a - 0.3) * 5 * u, (a - 0.3) * 1.4 * u, 0, 0, TAU); ctx.stroke(); } } }
  // the goose: paddles across its stretch, turns, dips its head under at each end
  { const G = L.goose, per = 26, c = st ? 3 : cyc(t, per, 4);
    let k, dir, dip = 0; if (c < 9) { k = sstep(0, 9, c); dir = 1; } else if (c < 13) { k = 1; dir = 1; dip = win(c, 9.6, 12, 0.3); } else if (c < 22) { k = 1 - sstep(13, 22, c); dir = -1; } else { k = 0; dir = -1; dip = win(c, 22.6, 25, 0.3); }
    const x = lerp(G.xa, G.xb, k), y = G.y + (st ? 0 : Math.sin(t * 2.1) * 0.2 * u), mv = (c < 9 || (c > 13 && c < 22)) && !st ? 1 : 0;
    if (!st) { ctx.strokeStyle = 'rgba(235,252,255,0.55)'; ctx.lineWidth = 0.3 * u; for (let q = 0; q < 2; q++) { const a = fract(t * 0.5 + q * 0.5); ctx.globalAlpha = (1 - a) * 0.8; ctx.beginPath(); ctx.ellipse(x, y, (3 + a * 5) * u, (0.7 + a * 1.2) * u, 0, 0, TAU); ctx.stroke(); }
      if (mv) { ctx.globalAlpha = 0.6; const tx = x - dir * 3.5 * u; ctx.beginPath(); ctx.moveTo(tx, y - 0.2 * u); ctx.lineTo(tx - dir * 7 * u, y - 1.2 * u); ctx.moveTo(tx, y + 0.4 * u); ctx.lineTo(tx - dir * 7 * u, y + 1.6 * u); ctx.stroke(); } ctx.globalAlpha = LIVE_A; }
    stamp(ctx, dip > 0.5 ? G.sp[1] : G.sp[0], x, y, 0.5, 0.78, dir); }
  // the frog on its pad: blinks; every so often hops off into the water (a splash ring) and climbs back later
  { const F = L.frog, c = st ? 0 : cyc(t, 15, 5); let fx = F[0], fy = F[1], show = 1, sc = 1;
    if (c > 10 && c < 10.7) { const a = (c - 10) / 0.7; fx += a * 8 * u * F[2]; fy -= Math.sin(a * Math.PI) * 4 * u - a * 1 * u; sc = 1 - a * 0.3; }
    else if (c >= 10.7 && c < 13.6) { show = 0; const a = (c - 10.7) / 1.6; if (a < 1) { ctx.strokeStyle = `rgba(235,252,255,${(1 - a) * 0.8})`; ctx.lineWidth = 0.3 * u; ctx.beginPath(); ctx.ellipse(F[0] + 8 * u * F[2], F[1] + 1 * u, (0.5 + a * 4) * u, (0.2 + a * 1.1) * u, 0, 0, TAU); ctx.stroke(); } }
    else if (c >= 13.6) { ctx.globalAlpha = sstep(13.6, 14.4, c); }
    if (show) { stamp(ctx, F.sp, fx, fy, 0.5, 1, F[2], sc); const blink = !st && (cyc(t, 3.1) < 0.14 || cyc(t, 7.3) < 0.12); if (blink && sc === 1) { ctx.fillStyle = '#4f9a36'; ctx.beginPath(); ctx.ellipse(fx - F[2] * 0.6 * u, fy - 2.5 * u, 0.6 * u, 0.6 * u, 0, 0, TAU); ctx.ellipse(fx + F[2] * 0.9 * u, fy - 2.5 * u, 0.6 * u, 0.6 * u, 0, 0, TAU); ctx.fill(); } }
    ctx.globalAlpha = LIVE_A; }
  // dragonflies: dart to a new spot, hover with a shimmer
  if (!st) for (let i = 0; i < L.dfly.length; i++) {
    const [x0, y0, col] = L.dfly[i], per = 3.2 + i, c = cyc(t, per, i * 1.7), n = Math.floor((t + i * 1.7) / per), e = sstep(0, 0.45, c);
    const px = (m) => x0 + Math.sin(m * 2.3 + i) * 9 * u, py = (m) => y0 + Math.cos(m * 1.7 + i) * 3 * u;
    const x = lerp(px(n), px(n + 1), e) + Math.sin(t * 9) * 0.2 * u, y = lerp(py(n), py(n + 1), e) + Math.sin(t * 7 + i) * 0.3 * u, dir = px(n + 1) > px(n) ? 1 : -1;
    ctx.strokeStyle = col; ctx.lineWidth = 0.3 * u; ctx.beginPath(); ctx.moveTo(x - dir * 2.2 * u, y); ctx.lineTo(x + dir * 1 * u, y); ctx.stroke();
    ctx.fillStyle = 'rgba(220,240,255,0.55)'; const f = Math.sin(t * 40 + i) * 0.4; ctx.beginPath(); ctx.ellipse(x, y - 0.7 * u, 1.6 * u, 0.45 * u, -0.3 + f, 0, TAU); ctx.ellipse(x, y + 0.6 * u, 1.5 * u, 0.4 * u, 0.3 - f, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
function frogSprite(dpr, s) {
  return bake(dpr, s * 1.4, s * 1.1, (c, w, h) => {
    c.translate(w / 2, h - 0.5); const k = s / 10; c.scale(k, k);
    ell(c, 0, -2.6, 4.8, 3, '#2f6a2a'); ell(c, 0, -2.9, 4.4, 2.6, '#5aa83c'); ell(c, 0.6, -2, 3, 1.4, '#cde68a');
    ell(c, -3.6, -1, 1.8, 1.1, '#4a9a34'); ell(c, 3.6, -1, 1.8, 1.1, '#4a9a34');
    for (const x of [-1.6, 2]) { circle(c, x, -5.2, 1.5, '#2f6a2a'); circle(c, x, -5.3, 1.25, '#7cc455'); circle(c, x + 0.2, -5.3, 0.75, '#ffffff'); circle(c, x + 0.35, -5.3, 0.45, '#1a2a12'); }
    c.strokeStyle = '#2a4a1c'; c.lineWidth = 0.4; c.beginPath(); c.arc(0.3, -3.6, 1.6, 0.4, Math.PI - 0.4); c.stroke();
  });
}

// the windmill: the sails turn; wheat waves roll across the field corners; two birds circle the cap; a crow on the
// scarecrow hops and flaps now and then; a butterfly
function millLive(ctx, t, S) {
  const L = S.live, m = S.mill; if (!m) return;
  const st = still(), u = S.u;
  tfL(ctx, S, 1);
  sails(ctx, m.x, m.y, m.k, st ? 0.5 : t * 0.2);
  if (L && !st) {
    swayStrips(ctx, t, S, L.sway);
    for (let i = 0; i < 2; i++) { const a = t * (0.32 + i * 0.07) + i * 3, r = (34 + i * 10) * m.k; vBird(ctx, m.x + Math.cos(a) * r, m.y - 8 * m.k + Math.sin(a) * r * 0.35, 1.3 * u, t * 9 + i, '#3a3440'); }
    { const [x, y, s] = L.crow, c = cyc(t, 8, 1), hop = Math.max(0, Math.sin(c * 6)) * win(c, 2, 2.6, 0.1) * 1.4 * u, fl = win(c, 5, 6.2, 0.15);
      crow(ctx, x, y - hop, s, c > 4 ? -1 : 1, 0); if (fl > 0.1) { const f = Math.sin(t * 22); ctx.fillStyle = '#22242e'; ctx.beginPath(); ctx.moveTo(x, y - s * 0.35); ctx.quadraticCurveTo(x - s * 0.5, y - s * (0.8 + 0.3 * f), x - s * 0.9, y - s * (0.6 + 0.4 * f)); ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.45, x, y - s * 0.2); ctx.fill(); } }
    butterflyAt(ctx, t, L.fly[0], L.fly[1], 12 * u, 4 * u, 1.5 * u, '#ff9a3a', 2.3);
  }
  ctx.restore();
}

// the big red barn at dusk: the lamp glow in the doorway breathes; crows fly in to the ridge, sit, and leave; one on
// the ridge shakes out its wings; moths flutter round the lantern; the weather vane swings round in the gusts
function barnLive(ctx, t, S) {
  const B = S.barn; if (!B) return;
  const st = still(), u = S.u;
  tfL(ctx, S, 1);
  if (!st) { ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.26 + 0.1 * Math.sin(t * 2.3) * Math.sin(t * 0.9 + 1); stamp(ctx, B.glow, B.gx, B.gy, 0.5, 0.5);
    ctx.globalAlpha = 0.32 + 0.12 * Math.sin(t * 7.3) * Math.sin(t * 3.1); stamp(ctx, B.lglow, B.lamp[0], B.lamp[1], 0.5, 0.5);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = LIVE_A; }
  // the weather vane: a cockerel that swings about its pole in the gusts (edge-on as it turns)
  { const g = st ? 1 : Math.cos(Math.sin(t * 0.37) * 1.4 + Math.sin(t * 1.9) * 0.25 * win(cyc(t, 11), 0, 3, 0.5)), [vx, vy, k] = B.vane, sx = Math.abs(g) < 0.12 ? 0.12 * Math.sign(g || 1) : g;
    ctx.save(); ctx.translate(vx, vy); ctx.scale(sx * k, k); ctx.fillStyle = '#3a3438';
    ctx.beginPath(); ctx.moveTo(-13, -34); ctx.quadraticCurveTo(-6, -43, 2, -38); ctx.lineTo(6, -44); ctx.lineTo(9, -40); ctx.lineTo(6, -34); ctx.quadraticCurveTo(0, -31, -13, -34); ctx.moveTo(-13, -34); ctx.lineTo(-18, -41); ctx.lineTo(-16, -33); ctx.fill(); ctx.restore(); }
  if (!st) {
    // one crow on the ridge shakes out its wings now and then
    const k = cyc(t, 7.5, 2); if (k < 0.9) { const f = Math.sin(k / 0.9 * Math.PI * 3), [x, y, s, face] = B.crow; ctx.fillStyle = '#22242e'; ctx.save(); ctx.translate(x, y); ctx.scale(face * s / 20, s / 20); ctx.beginPath(); ctx.moveTo(-2, -7); ctx.quadraticCurveTo(-8, -16 - 6 * f, -16, -12 - 8 * f); ctx.quadraticCurveTo(-8, -9, -2, -4); ctx.fill(); ctx.restore(); }
    // a crow flies in from the sky, lands on the ridge, sits, and flies off again
    { const per = 21, c = cyc(t, per, 6), [lx, ly, s] = B.land, ax = B.from[0], ay = B.from[1]; let x, y, fly = 0, face = lx > ax ? 1 : -1;
      if (c < 3) { const e = sstep(0, 3, c); x = lerp(ax, lx, e); y = lerp(ay, ly, e) - Math.sin(e * Math.PI) * 10 * u; fly = 1; }
      else if (c < 11) { x = lx; y = ly; face = -face; }
      else if (c < 14) { const e = sstep(11, 14, c); x = lerp(lx, B.to[0], e); y = lerp(ly, B.to[1], e) - Math.sin(e * Math.PI) * 8 * u; fly = 1; face = B.to[0] > lx ? 1 : -1; }
      if (x !== undefined && vis(S, x, 10 * u)) { if (fly) vBird(ctx, x, y, s * 0.55, t * 12, '#1e1e28'); else crow(ctx, x, y, s, face, 0); } }
    // moths round the lantern
    for (let i = 0; i < 3; i++) { const a = t * (1.6 + i * 0.4) + i * 2, x = B.lamp[0] + Math.cos(a) * (2.5 + i) * u + Math.sin(t * 5 + i) * 0.6 * u, y = B.lamp[1] + Math.sin(a * 1.3) * (2 + i * 0.7) * u, f = Math.abs(Math.sin(t * 25 + i)); ctx.fillStyle = 'rgba(255,236,200,0.85)'; ctx.beginPath(); ctx.ellipse(x - 0.35 * u * f, y, 0.4 * u * f + 0.08 * u, 0.3 * u, 0, 0, TAU); ctx.ellipse(x + 0.35 * u * f, y, 0.4 * u * f + 0.08 * u, 0.3 * u, 0, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

export const FARM_ART = { coop, hayfield, pond, windmill, redbarn };
