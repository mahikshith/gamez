// The creeper family's other forms in play (0.8.18; the thorn and the bayou's swamp vine are render/creeper.js). Every form
// shares the thorn's pose (render/creeper.js pose(): the lean and stretch with speed, the wind-up's rear and bristle,
// the curl at each end), so they move alike; each has its own body:
//   frost    an ice-spike cluster with eyes; spikes bristle with speed; fire melts it (drips, a puddle that refreezes)
//   shard    the same crystal build in amethyst (crystal cave); a stone shatters it, a stub regrows
//   spark    a crackling ball of light running a copper wire; it dims to an ember at each end, flares in the wind-up
//   saw      a saw-tooth wheel in a slot (clockwork): it spins as it rolls, stops dead at each end
//   anemone  a stinging anemone on a sandy strip: open and swaying as it drifts, a closed bud at each end and when it flinches
//   lava     a slow flow of molten floor, no head: a glow runs ahead of where it is going; a water egg cools it to crust
// Frames as in render/creeper.js: the body is drawn in a local px frame, +x the way it goes, -y off the rim, the head at
// (hx, hy). Calm: no flicker or sway (it still moves: that is the game). PERF.low: no glow layers, fewer bits.
// Sprites (PERF): the crystal bodies and spikes are painted once per size and placed with one transform.
import { freeCanvas } from './cvfree.js';
import { stampStats } from './stamp.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
const outBack = (u, s = 1.9) => { u = clamp(u, 0, 1) - 1; return 1 + u * u * ((s + 1) * u + s); };
const mix = (a, b, k) => { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), c = (sh) => Math.round(((pa >> sh) & 255) + (((pb >> sh) & 255) - ((pa >> sh) & 255)) * k); return `rgb(${c(16)},${c(8)},${c(0)})`; };
const RIM = 'rgba(255,248,232,0.92)';

export const PAL = {
  frost: { lit: '#f2fdff', core: '#bfe9ff', mid: '#79c3ea', dark: '#2f6f9c', edge: '#11304a', spike: '#eafcff', spikeShade: '#8ccff0', eye: '#11304a', track: '#cdefff', trackEdge: '#4d8db8', melt: '#9fd8f5' },
  shard: { lit: '#fff0ff', core: '#f0c4ff', mid: '#b47fe4', dark: '#5f2f92', edge: '#26103f', spike: '#ffe8ff', spikeShade: '#c493ec', eye: '#26103f', track: '#e8cfff', trackEdge: '#6a3fa0', melt: '#d9b8f2' },
  spark: { core: '#fffbe0', glow: '#7fd8ff', arc: '#d9f6ff', ember: '#ffb347', wire: '#c07a3a', wireDark: '#5a3414', edge: '#1b2a40' },
  saw: { steel: '#d7dde4', steelDark: '#7c8794', edge: '#232a33', hub: '#d9a441', hubDark: '#7a5414', track: '#3a3f47', trackLit: '#8a929c' },
  anemone: { stalk: '#f08a5d', stalkDark: '#b04a36', tip: '#ffe17a', tent: '#ff7b9c', tentDark: '#b23a62', edge: '#3a1020', sand: '#e8d29a', sandDark: '#a88a52', eye: '#3a1020' },
  lava: { hot: '#fff3a8', mid: '#ffb02e', deep: '#f0541e', dark: '#9a1f12', crust: '#3b2b27', crustLit: '#5b4740', basalt: '#2a1d1b', glow: 'rgba(255,120,30,', edge: '#2a0c06' },
};

// ------------------------------------------------------------------ sprites
const SPR = new Map();
function sprite(key, W, H, paint) {
  let cv = SPR.get(key);
  if (cv) return cv;
  if (typeof document === 'undefined' || !stampStats.on) return null;
  cv = document.createElement('canvas'); cv.width = Math.max(2, Math.ceil(W)); cv.height = Math.max(2, Math.ceil(H));
  const c = cv.getContext('2d'); if (!c) return null;
  paint(c);
  SPR.set(key, cv); stampStats.builds++;
  if (SPR.size > 60) { const k0 = SPR.keys().next().value; freeCanvas(SPR.get(k0)); SPR.delete(k0); }
  return cv;
}
export function freeCreeperForms() { for (const cv of SPR.values()) freeCanvas(cv); SPR.clear(); }
const qpx = (r) => Math.pow(1.15, Math.ceil(Math.log(Math.max(2, r)) / Math.log(1.15)));

// ------------------------------------------------------------------ crystal (frost, shard)
// the body: a faceted gem, lit from the top left, a cream rim so it reads on any ring; m = melt (0..1: bluer, glassier)
function paintGem(c, R, Q, m) {
  const ol = Math.max(1.2, R * 0.12), pts = [];
  for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i * TAU) / 7 + 0.2, rr = R * (i % 2 ? 0.93 : 1.04); pts.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.95]); }
  const poly = (s = 1) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x * s, y * s) : c.moveTo(x * s, y * s))); c.closePath(); };
  c.lineJoin = 'round';
  poly(1.08); c.lineWidth = ol * 1.4; c.strokeStyle = RIM; c.stroke();
  poly(); c.fillStyle = Q.edge; c.fill();
  const g = c.createLinearGradient(-R * 0.6, -R * 0.8, R * 0.6, R * 0.9);
  g.addColorStop(0, m ? mix(Q.lit, Q.melt, m) : Q.lit); g.addColorStop(0.35, m ? mix(Q.core, Q.melt, m) : Q.core); g.addColorStop(1, m ? mix(Q.mid, Q.melt, m) : Q.mid);
  poly(0.88); c.fillStyle = g; c.fill();
  // facets: two darker planes and a light one
  c.save(); poly(0.88); c.clip();
  c.beginPath(); c.moveTo(0, R * 0.05); c.lineTo(R, R * 0.2); c.lineTo(R * 0.4, R); c.lineTo(-R * 0.3, R); c.closePath(); c.fillStyle = Q.dark; c.globalAlpha = 0.35; c.fill();
  c.beginPath(); c.moveTo(0, R * 0.05); c.lineTo(-R, -R * 0.1); c.lineTo(-R, R * 0.6); c.closePath(); c.fillStyle = Q.mid; c.globalAlpha = 0.3; c.fill();
  c.beginPath(); c.moveTo(0, R * 0.05); c.lineTo(-R * 0.55, -R * 0.9); c.lineTo(R * 0.35, -R * 0.95); c.closePath(); c.fillStyle = Q.lit; c.globalAlpha = 0.55; c.fill();
  c.globalAlpha = 1; c.restore();
  // the glint
  c.beginPath(); c.ellipse(-R * 0.38, -R * 0.45, R * 0.16, R * 0.08, -0.7, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.85)'; c.fill();
}
// one spike: a long thin crystal, two facets, root at (0, 0) pointing up
function paintSpike(c, L, W, Q) {
  const shape = () => { c.beginPath(); c.moveTo(-W / 2, 0); c.lineTo(-W * 0.18, -L * 0.82); c.lineTo(0, -L); c.lineTo(W * 0.2, -L * 0.8); c.lineTo(W / 2, 0); c.closePath(); };
  c.lineJoin = 'round';
  shape(); c.lineWidth = Math.max(2.2, W * 0.4); c.strokeStyle = RIM; c.stroke();
  c.lineWidth = Math.max(1.1, W * 0.16); c.strokeStyle = Q.edge; c.stroke();
  c.fillStyle = Q.spike; c.fill();
  c.save(); shape(); c.clip(); c.beginPath(); c.moveTo(0, 0); c.lineTo(W, 0); c.lineTo(W * 0.2, -L * 1.1); c.lineTo(0, -L); c.closePath(); c.fillStyle = Q.spikeShade; c.fill(); c.restore();
}
function gemSprite(form, Rpx, m) {
  const R = qpx(Rpx), mq = Math.round(m * 4) / 4, P = Math.ceil(R * 0.3) + 2, S = Math.ceil(2 * R + 2 * P);
  const cv = sprite('g' + form + R.toFixed(1) + ':' + mq, S, S, (c) => { c.translate(S / 2, S / 2); paintGem(c, R, PAL[form], mq); });
  return cv ? { cv, R, S } : null;
}
function spikeSprite(form, Lpx) {
  const L = qpx(Lpx), W = L * 0.42, P = Math.ceil(W * 0.4) + 2, w = Math.ceil(W + 2 * P), h = Math.ceil(L * 1.1 + 2 * P);
  const cv = sprite('s' + form + L.toFixed(1), w, h, (c) => { c.translate(w / 2, h - P); paintSpike(c, L, W, PAL[form]); });
  return cv ? { cv, L, w, h, P } : null;
}
function crystalHead(c, form, R, P, t, calm, H) {
  const Q = PAL[form], m = P.ch || 0, br = Math.max(0.1, P.bristle) * (1 - m);
  const SS = spikeSprite(form, R * 1.0);
  const TH = form === 'frost' ? [-1.9, -1.2, -0.55, 0.1, 0.75, 1.4] : [-1.6, -0.75, 0.05, 0.85, 1.55];
  for (let i = 0; i < TH.length; i++) {
    const a = TH[i] + (calm ? 0 : Math.sin(t * 8 + i * 1.3) * 0.04 * (P.wiggle || 0)), len = br * (0.75 + 0.3 * ((i * 0.618) % 1)) * (form === 'shard' && i === 2 ? 1.3 : 1);
    if (len < 0.05) continue;
    c.save(); c.rotate(a); c.translate(0, -R * 0.72); c.scale(0.9 + 0.1 * br, len);
    if (SS) { const s = R / SS.L; c.drawImage(SS.cv, (-SS.w / 2) * s, -(SS.h - SS.P) * s, SS.w * s, SS.h * s); } else paintSpike(c, R, R * 0.42, Q);
    c.restore();
  }
  const GS = gemSprite(form, R, m);
  if (GS) { const s = R / GS.R; c.drawImage(GS.cv, (-GS.S / 2) * s, (-GS.S / 2) * s, GS.S * s, GS.S * s); } else paintGem(c, R, Q, m);
  H.eyes(c, R, P.eyes, t, calm, 0, Q.eye);
  if (P.eyes === 'shut' && P.zz) H.snooze(c, R, t, calm, P.zz);
}
// frost: a trail of rime behind it on the rim (little stars that fade); shard: glittering grit
function crystalTrail(c, C, P, k, t, calm, low, R, hx, bend, form) {
  if (low) return;
  const Q = PAL[form], back = (P.dir > 0 ? P.u - C.a0 : C.a1 - P.u) * C.rh * k, TL = Math.min(back, 0.55 * k * (1 - (P.curl || 0) * 0.7));
  c.save();
  for (let i = 1; i <= 6; i++) {
    const d = (i / 6) * TL; if (d <= R * 0.4) continue;
    const x = hx - d, y = bend(x) - R * 0.12, s = R * (0.26 - i * 0.025);
    c.save(); c.globalAlpha *= 0.85 * (1 - i / 7);
    c.translate(x, y); c.rotate(i * 0.7);
    c.beginPath(); for (let j = 0; j < 4; j++) { const a = (j * Math.PI) / 4; c.moveTo(Math.cos(a) * s, Math.sin(a) * s); c.lineTo(-Math.cos(a) * s, -Math.sin(a) * s); }
    c.lineWidth = Math.max(1.5, R * 0.1); c.strokeStyle = Q.edge; c.lineCap = 'round'; c.stroke(); c.lineWidth = Math.max(0.8, R * 0.05); c.strokeStyle = Q.spike; c.stroke();
    c.restore();
  }
  c.restore();
}
// melting (frost's burn): drips fall off it; the puddle it leaves (the stump) and the crystals that refreeze (the sprout)
function drawPuddle(c, k, a, t, calm, form, refreeze = 0) {
  const Q = PAL[form], w = 0.34 * k * (0.5 + 0.5 * a), h = 0.05 * k * a;
  if (a <= 0.02) return;
  c.save();
  c.beginPath(); c.ellipse(0, -h * 0.3, w / 2, h + 1, 0, 0, TAU); c.fillStyle = RIM; c.globalAlpha *= 0.8; c.fill(); c.globalAlpha /= 0.8;
  c.beginPath(); c.ellipse(0, -h * 0.3, w / 2 - 2, h, 0, 0, TAU);
  const g = c.createLinearGradient(0, -h, 0, h); g.addColorStop(0, form === 'shard' ? Q.core : Q.lit); g.addColorStop(1, Q.mid); c.fillStyle = g; c.fill();
  c.lineWidth = Math.max(1, 0.008 * k); c.strokeStyle = Q.edge; c.stroke();
  c.beginPath(); c.ellipse(-w * 0.18, -h * 0.6, w * 0.12, h * 0.25, 0, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.8)'; c.fill();
  if (refreeze > 0) { // little crystals rising out of it
    const SS = spikeSprite(form, 0.12 * k);
    for (const [x, a2, s] of [[-0.06, -0.5, 0.8], [0, 0.05, 1.1], [0.06, 0.55, 0.9]]) {
      const L = 0.12 * k * s * outBack(clamp((refreeze - Math.abs(x) * 2) / 0.6, 0, 1), 2.2);
      if (L < 1) continue;
      c.save(); c.translate(x * k, -h * 0.5); c.rotate(a2); if (SS) { const q = L / SS.L; c.drawImage(SS.cv, (-SS.w / 2) * q, -(SS.h - SS.P) * q, SS.w * q, SS.h * q); } else paintSpike(c, L, L * 0.42, Q); c.restore();
    }
  }
  c.restore();
}
function drawDrips(c, x, y, R, a, t, calm, form) {
  const Q = PAL[form];
  c.save(); c.fillStyle = Q.melt; c.strokeStyle = Q.edge; c.lineWidth = Math.max(1, R * 0.05);
  for (let i = 0; i < 4; i++) {
    const q = calm ? 0.5 : (t * 1.6 + i * 0.27) % 1, dx = (i - 1.5) * R * 0.45, dy = R * (0.2 + 1.3 * q * q);
    c.globalAlpha = a * (1 - q);
    c.beginPath(); c.moveTo(x + dx, y + dy - R * 0.22); c.quadraticCurveTo(x + dx + R * 0.12, y + dy, x + dx, y + dy + R * 0.08); c.quadraticCurveTo(x + dx - R * 0.12, y + dy, x + dx, y + dy - R * 0.22); c.fill(); c.stroke();
  }
  c.restore();
}

// ------------------------------------------------------------------ spark
function sparkHead(c, R, P, t, calm, low, H) {
  const Q = PAL.spark, rest = P.curl || 0, br = Math.max(0.1, P.bristle), live = 1 - 0.6 * rest;
  const flick = calm ? 1 : 0.85 + 0.15 * Math.sin(t * 37) * Math.sin(t * 23);
  if (!low) { // the glow
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(0, 0, 0, 0, 0, R * (2.4 + 0.6 * br) * live);
    g.addColorStop(0, `rgba(160,230,255,${0.75 * live * flick})`); g.addColorStop(0.4, `rgba(90,180,255,${0.3 * live})`); g.addColorStop(1, 'rgba(60,120,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, R * (2.4 + 0.6 * br), 0, TAU); c.fill(); c.restore();
  }
  // the arcs: jagged rays that flare with its speed and in the wind-up
  const n = low ? 4 : 6, seed = calm ? 0 : Math.floor(t * 18);
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + (calm ? 0 : t * 2), L = R * (0.9 + 1.0 * br) * live * (0.7 + 0.3 * (((i + seed) * 0.618) % 1));
    if (rest > 0.8 && i % 2) continue;
    c.beginPath(); let x = Math.cos(a) * R * 0.5, y = Math.sin(a) * R * 0.5; c.moveTo(x, y);
    for (let j = 1; j <= 3; j++) { const s = j / 3, off = ((((i * 7 + j * 3 + seed) * 0.37) % 1) - 0.5) * R * 0.6; x = Math.cos(a) * (R * 0.5 + L * s) - Math.sin(a) * off; y = Math.sin(a) * (R * 0.5 + L * s) + Math.cos(a) * off; c.lineTo(x, y); }
    c.lineWidth = Math.max(2.4, R * 0.26); c.strokeStyle = Q.edge; c.globalAlpha = 0.7; c.stroke();
    c.lineWidth = Math.max(1.2, R * 0.12); c.strokeStyle = Q.arc; c.globalAlpha = 1; c.stroke();
  }
  // the core: a white-hot ball with a cream rim; an amber ember when it rests
  c.beginPath(); c.arc(0, 0, R * 1.08, 0, TAU); c.fillStyle = RIM; c.fill();
  c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fillStyle = Q.edge; c.fill();
  const g2 = c.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R * 0.9);
  g2.addColorStop(0, '#ffffff'); g2.addColorStop(0.5, rest > 0.5 ? mix(Q.core, Q.ember, (rest - 0.5) * 2) : Q.core); g2.addColorStop(1, rest > 0.5 ? Q.ember : Q.glow);
  c.beginPath(); c.arc(0, 0, R * 0.86, 0, TAU); c.fillStyle = g2; c.fill();
  H.eyes(c, R * 0.95, P.eyes, t, calm, 0, Q.edge);
  if (P.eyes === 'shut' && P.zz) H.snooze(c, R, t, calm, P.zz);
}
function sparkTrail(c, C, P, k, t, calm, low, R, hx, hy, bend) {
  const sp = clamp((P.wiggle || 0), 0, 1); if (sp < 0.05) return;
  const back = (P.dir > 0 ? P.u - C.a0 : C.a1 - P.u) * C.rh * k, TL = Math.min(back, 0.7 * k * sp);
  c.save(); c.lineCap = 'round';
  const N = 10; c.beginPath(); for (let i = 0; i <= N; i++) { const d = (i / N) * TL, x = hx - d, y = hy * (1 - (i / N) * 0.6) + bend(x) - bend(hx) + (calm ? 0 : Math.sin(t * 40 + i * 2) * R * 0.15 * (i / N)); i ? c.lineTo(x, y) : c.moveTo(x, y); }
  c.lineWidth = R * 1.1; c.strokeStyle = 'rgba(120,210,255,0.25)'; c.stroke(); c.lineWidth = R * 0.45; c.strokeStyle = 'rgba(230,250,255,0.85)'; c.stroke();
  c.restore();
}

// ------------------------------------------------------------------ saw
function sawHead(c, R, P, t, calm, H, spin) {
  const Q = PAL.saw, n = 11, tooth = R * (0.24 + 0.12 * clamp(P.bristle, 0, 1.3));
  c.save(); c.rotate(spin);
  const ring = () => { c.beginPath(); for (let i = 0; i < n; i++) { const a = (i / n) * TAU, a2 = a + TAU / n * 0.55, a3 = a + TAU / n; c.lineTo(Math.cos(a) * R, Math.sin(a) * R); c.lineTo(Math.cos(a2) * (R + tooth), Math.sin(a2) * (R + tooth)); c.lineTo(Math.cos(a3) * R * 0.98, Math.sin(a3) * R * 0.98); } c.closePath(); };
  c.lineJoin = 'round'; ring(); c.lineWidth = Math.max(3, R * 0.3); c.strokeStyle = RIM; c.stroke();
  c.lineWidth = Math.max(1.4, R * 0.12); c.strokeStyle = Q.edge; c.stroke();
  const g = c.createLinearGradient(-R, -R, R, R); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, Q.steel); g.addColorStop(1, Q.steelDark); c.fillStyle = g; c.fill();
  // lightening holes and the sheen line
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + 0.5; c.beginPath(); c.arc(Math.cos(a) * R * 0.58, Math.sin(a) * R * 0.58, R * 0.13, 0, TAU); c.fillStyle = Q.steelDark; c.fill(); c.lineWidth = Math.max(1, R * 0.05); c.strokeStyle = Q.edge; c.stroke(); }
  c.restore();
  c.beginPath(); c.arc(0, 0, R * 0.92, -2.4, -1.5); c.lineWidth = R * 0.08; c.strokeStyle = 'rgba(255,255,255,0.8)'; c.stroke();
  // the brass hub with its face
  c.beginPath(); c.arc(0, 0, R * 0.46, 0, TAU); c.fillStyle = Q.hub; c.fill(); c.lineWidth = Math.max(1.2, R * 0.08); c.strokeStyle = Q.hubDark; c.stroke();
  H.eyes(c, R * 0.62, P.eyes, t, calm, 0, Q.edge);
}

// ------------------------------------------------------------------ anemone
function anemoneHead(c, R, P, t, calm, low, H) {
  const Q = PAL.anemone, open = clamp(1 - (P.curl || 0), 0, 1) * (P.ph === 'shut' ? 0 : 1), br = clamp(P.bristle, 0, 1.4);
  // the column: from the rim up to the crown
  const top = -R * 0.55, foot = R * 1.0;
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(-R * 0.7, foot); c.quadraticCurveTo(-R * 0.95, R * 0.2, -R * 0.62, top); c.lineTo(R * 0.62, top); c.quadraticCurveTo(R * 0.95, R * 0.2, R * 0.7, foot); c.closePath();
  c.lineWidth = Math.max(3, R * 0.26); c.strokeStyle = RIM; c.stroke();
  c.lineWidth = Math.max(1.4, R * 0.1); c.strokeStyle = Q.edge; c.stroke();
  const g = c.createLinearGradient(-R, 0, R, 0); g.addColorStop(0, Q.stalkDark); g.addColorStop(0.35, Q.stalk); g.addColorStop(1, Q.stalkDark); c.fillStyle = g; c.fill();
  for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-R * 0.5, top + R * (0.4 + i * 0.4)); c.quadraticCurveTo(0, top + R * (0.55 + i * 0.4), R * 0.5, top + R * (0.4 + i * 0.4)); c.lineWidth = R * 0.06; c.strokeStyle = Q.stalkDark; c.stroke(); }
  // the tentacles: open, a fan that sways and reaches (it stings what it touches); closed, folded into a bud over the crown
  const n = low ? 7 : 10;
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) {
    const s = i / (n - 1) - 0.5, fan = s * (0.4 + 2.2 * open * (0.75 + 0.25 * br)), L = R * (0.55 + (1.05 + 0.35 * br) * open), sway = calm ? 0 : Math.sin(t * 2.6 + i * 0.7) * 0.22 * open;
    const a = -Math.PI / 2 + fan + sway, mx = Math.cos(a - sway * 0.8) * L * 0.55, my = top + Math.sin(a - sway * 0.8) * L * 0.55, ex = Math.cos(a) * L, ey = top + Math.sin(a) * L * (0.6 + 0.4 * open) - (1 - open) * R * 0.1;
    c.beginPath(); c.moveTo(s * R * 0.9, top + R * 0.1); c.quadraticCurveTo(mx, my, ex, ey);
    if (!pass) { c.lineWidth = R * 0.34; c.strokeStyle = Q.edge; c.stroke(); }
    else { c.lineWidth = R * 0.2; c.strokeStyle = i % 2 ? Q.tent : Q.tentDark; c.stroke(); c.beginPath(); c.arc(ex, ey, R * 0.13, 0, TAU); c.fillStyle = Q.tip; c.fill(); c.lineWidth = Math.max(1, R * 0.05); c.strokeStyle = Q.edge; c.stroke(); }
  }
  c.save(); c.translate(0, R * 0.05); H.eyes(c, R * 0.85, P.eyes, t, calm, 0, Q.eye); c.restore();
  if (P.eyes === 'shut' && P.zz) H.snooze(c, R, t, calm, P.zz);
}

// ------------------------------------------------------------------ the tracks (per form; the thorn's is render/creeper.js)
export function formTrack(ctx, ring, C, k, t, calm, low, P, gone, pt, n, rf) {
  const path = () => { ctx.beginPath(); for (let i = 0; i <= n; i++) { const [x, y] = pt(C.a0 + ((C.a1 - C.a0) * i) / n, 0); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } };
  const ends = (r, fill, stroke) => { for (const a of [C.a0, C.a1]) { const [x, y] = pt(a, 0.01); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 0.012; ctx.strokeStyle = stroke; ctx.stroke(); } };
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha *= gone ? 0.3 : 0.7;
  const f = C.form;
  if (f === 'frost' || f === 'shard') {
    const Q = PAL[f]; path(); ctx.lineWidth = 0.05; ctx.strokeStyle = Q.trackEdge; ctx.stroke(); path(); ctx.lineWidth = 0.028; ctx.strokeStyle = Q.track; ctx.stroke();
    if (!low) { const m = Math.max(2, Math.round(((C.a1 - C.a0) * rf) / 0.18)); for (let i = 1; i < m; i++) { const [x, y] = pt(C.a0 + ((C.a1 - C.a0) * i) / m, 0.02); ctx.beginPath(); ctx.moveTo(x - 0.018, y); ctx.lineTo(x, y + 0.03); ctx.lineTo(x + 0.018, y); ctx.lineTo(x, y - 0.03); ctx.closePath(); ctx.fillStyle = Q.spike; ctx.fill(); ctx.lineWidth = 0.006; ctx.strokeStyle = Q.edge; ctx.stroke(); } }
    ends(0.04, Q.mid, Q.edge);
  } else if (f === 'spark') {
    const Q = PAL.spark; path(); ctx.lineWidth = 0.034; ctx.strokeStyle = Q.wireDark; ctx.stroke(); path(); ctx.lineWidth = 0.018; ctx.strokeStyle = Q.wire; ctx.stroke();
    ends(0.04, '#d9d2c4', Q.edge);
  } else if (f === 'saw') {
    const Q = PAL.saw; path(); ctx.lineWidth = 0.05; ctx.strokeStyle = Q.track; ctx.stroke(); path(); ctx.lineWidth = 0.012; ctx.strokeStyle = Q.trackLit; ctx.stroke();
    ends(0.035, Q.hub, Q.hubDark);
  } else if (f === 'anemone') {
    const Q = PAL.anemone; path(); ctx.lineWidth = 0.07; ctx.strokeStyle = Q.sandDark; ctx.stroke(); path(); ctx.lineWidth = 0.05; ctx.strokeStyle = Q.sand; ctx.stroke();
    if (!low) { const m = Math.max(2, Math.round(((C.a1 - C.a0) * rf) / 0.15)); for (let i = 1; i < m; i++) { const [x, y] = pt(C.a0 + ((C.a1 - C.a0) * i) / m, 0.02); ctx.beginPath(); ctx.arc(x, y, 0.012 + 0.006 * (i % 2), 0, TAU); ctx.fillStyle = i % 3 ? '#fff4e0' : '#f6b2c4'; ctx.fill(); } }
    ends(0.035, Q.stalk, Q.edge);
  } else if (f === 'lava') { // the basalt bed it flows in, glowing faintly in its cracks
    const Q = PAL.lava; path(); ctx.lineWidth = 0.075; ctx.strokeStyle = Q.edge; ctx.stroke(); path(); ctx.lineWidth = 0.055; ctx.strokeStyle = Q.basalt; ctx.stroke();
    if (!gone) { ctx.globalAlpha *= 0.6 + (calm ? 0 : 0.2 * Math.sin(t * 2)); path(); ctx.setLineDash([0.03, 0.07]); ctx.lineWidth = 0.012; ctx.strokeStyle = Q.deep; ctx.stroke(); ctx.setLineDash([]); }
  }
  ctx.restore();
}

// ------------------------------------------------------------------ the lava flow (no head: a length of molten floor)
// local px frame (the head's), x from -L to +L along the rim; P.ch = crust (cooling 0..1), P.flame unused
function lavaBody(c, C, P, k, t, calm, low, bend) {
  const Q = PAL.lava, L = C.hr * k, D = 0.18 * k, cr = clamp(P.lavaCrust || 0, 0, 1), sp = clamp(P.wiggle || 0, 0, 1), wind = P.rear || 0;
  const front = 1 + 0.25 * sp + 0.18 * wind; // the front swells as it goes (and in the wind-up)
  const top = (x) => { const u = x / L; if (Math.abs(u) >= 1) return bend(x); const prof = Math.sqrt(1 - u * u) * (u > 0 ? front : 1) * (1 - 0.12 * Math.sin(u * 3 + (calm ? 0 : t * 2))); return bend(x) - D * prof; };
  const N = 28, shape = (grow = 0) => { c.beginPath(); c.moveTo(-L - grow, bend(-L) + 2); for (let i = 0; i <= N; i++) { const x = -L + (2 * L * i) / N; c.lineTo(x, top(x) - grow); } c.lineTo(L + grow, bend(L) + 2); c.closePath(); };
  // the glow ahead of where it is going (big and soft: read it from afar), and over it
  if (!low && cr < 0.9) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const ahead = (0.35 + 0.65 * Math.max(sp, wind)) * (1 - cr), gx = L * 1.25;
    const g = c.createRadialGradient(gx, -D * 0.5, 0, gx, -D * 0.5, L * 1.2);
    g.addColorStop(0, `${Q.glow}${0.55 * ahead})`); g.addColorStop(1, `${Q.glow}0)`);
    c.fillStyle = g; c.beginPath(); c.ellipse(gx, -D * 0.5, L * 1.2, L * 0.75, 0, 0, TAU); c.fill();
    const g2 = c.createRadialGradient(0, -D, 0, 0, -D, L * 1.4);
    g2.addColorStop(0, `${Q.glow}${0.55 * (1 - cr)})`); g2.addColorStop(1, `${Q.glow}0)`);
    c.fillStyle = g2; c.beginPath(); c.ellipse(0, -D, L * 1.5, L * 0.9, 0, 0, TAU); c.fill();
    c.restore();
  }
  // the cream rim and dark edge, then the melt
  shape(Math.max(2, 0.012 * k)); c.fillStyle = RIM; c.fill();
  shape(Math.max(1, 0.006 * k)); c.fillStyle = Q.edge; c.fill();
  shape();
  const g = c.createLinearGradient(0, -D * 1.1, 0, 2);
  if (cr < 1) { g.addColorStop(0, mix(Q.hot, Q.crustLit, cr)); g.addColorStop(0.45, mix(Q.mid, Q.crust, cr)); g.addColorStop(1, mix(Q.dark, Q.basalt, cr)); }
  else { g.addColorStop(0, Q.crustLit); g.addColorStop(1, Q.basalt); }
  c.fillStyle = g; c.fill();
  // crust plates drifting back along the surface (the flow moving), cracks glowing between them when crusted
  c.save(); shape(); c.clip();
  const off = calm ? 0 : ((P.u * C.rh * k * 0.6) % (L * 0.5));
  for (let i = -3; i < 6; i++) {
    const x = -L + i * L * 0.5 - off, y = top(x) + D * 0.35;
    c.beginPath(); c.ellipse(x, y, L * 0.16, D * 0.2, 0.1, 0, TAU); c.fillStyle = cr > 0.5 ? 'rgba(255,110,40,' + (0.25 + 0.25 * (1 - cr)) + ')' : `rgba(120,30,10,${0.35 * (1 - cr)})`; c.fill();
  }
  if (cr > 0.2) { c.globalAlpha = cr * (P.remelt ? 0.4 + 0.6 * P.remelt : 0.35); c.strokeStyle = '#ff7a2a'; c.lineWidth = Math.max(1, 0.01 * k); c.beginPath(); for (let i = 0; i < 5; i++) { const x = -L * 0.8 + i * L * 0.4; c.moveTo(x, top(x) + D * 0.2); c.lineTo(x + L * 0.12, top(x) + D * 0.55); c.lineTo(x + L * 0.05, top(x) + D * 0.9); } c.stroke(); c.globalAlpha = 1; }
  c.restore();
  // bubbles (they pop more in the wind-up); a few rising sparks
  if (!low && !calm && cr < 0.6) {
    for (let i = 0; i < 4; i++) {
      const q = (t * (0.8 + 0.4 * wind) + i * 0.31) % 1, x = -L * 0.7 + ((i * 0.37 + 0.2) % 1) * L * 1.4, y = top(x) + D * 0.15, r = D * (0.12 + 0.25 * q) * (1 - cr);
      c.globalAlpha = 1 - q; c.beginPath(); c.arc(x, y - r * 0.4, r, Math.PI, TAU); c.lineWidth = Math.max(1, 0.006 * k); c.strokeStyle = Q.hot; c.stroke();
    }
    c.globalAlpha = 1;
  }
  // steam while it cools
  if (P.steam > 0 && !calm) {
    c.save(); c.strokeStyle = 'rgba(235,235,235,0.6)'; c.lineCap = 'round'; c.lineWidth = 0.025 * k;
    for (let i = 0; i < 3; i++) { const x0 = (i - 1) * L * 0.5; c.globalAlpha = P.steam * 0.7; c.beginPath(); for (let j = 0; j <= 6; j++) { const yy = top(x0) - j * D * 0.6, xx = x0 + Math.sin(t * 3 + j + i) * D * 0.3; j ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } c.stroke(); }
    c.restore();
  }
}

// ------------------------------------------------------------------ one creeper of a non-thorn form, in its local px frame
// H: helpers from render/creeper.js (eyes, snooze). R: the head's radius in px (with the pose's scale).
export function drawFormBody(c, sim, C, P, k, t, calm, low, R, hx, hy, bend, H) {
  const f = C.form;
  if (f === 'lava') { lavaBody(c, C, P, k, t, calm, low, bend); return; }
  // what is left where it was knocked back: a puddle (frost), a stub (shard), a scorch (spark), an empty axle (saw)
  if (P.stump > 0) {
    if (f === 'frost') drawPuddle(c, k, P.stump, t, calm, f, P.sprout);
    else if (f === 'shard') drawPuddle(c, k, P.stump * 0.6, t, calm, f, P.sprout);
    else if (f === 'spark') { c.save(); c.globalAlpha *= P.stump * 0.8; c.beginPath(); c.ellipse(0, -2, 0.09 * k, 0.025 * k, 0, 0, TAU); c.fillStyle = '#2b2622'; c.fill(); c.restore(); }
    else if (f === 'saw') { c.save(); c.beginPath(); c.arc(0, -0.05 * k, 0.035 * k * P.stump, 0, TAU); c.fillStyle = PAL.saw.hub; c.fill(); c.lineWidth = Math.max(1, 0.01 * k); c.strokeStyle = PAL.saw.hubDark; c.stroke(); c.restore(); }
  }
  // the trail behind it
  if (P.head > 0.3 && !P.snap) {
    if (f === 'frost' || f === 'shard') crystalTrail(c, C, P, k, t, calm, low, R, hx, bend, f);
    else if (f === 'spark') sparkTrail(c, C, P, k, t, calm, low, R, hx, hy, bend);
  }
  const head = (cc, PP) => {
    if (f === 'frost' || f === 'shard') crystalHead(cc, f, R, PP, t, calm, H);
    else if (f === 'spark') sparkHead(cc, R, PP, t, calm, low, H);
    else if (f === 'saw') sawHead(cc, R, PP, t, calm, H, (PP.u * C.rh * k) / R * (PP.dir || 1));
    else if (f === 'anemone') anemoneHead(cc, R, PP, t, calm, low, H);
  };
  if (P.snap > 0) { // knocked off by a stone: it flies off backwards, spinning, and fades (a shard shatters into bits)
    const q = P.snap, X = hx - R * 4 * q, Y = hy - R * 3.2 * Math.sin(q * Math.PI * 0.8) + R * 3 * q * q;
    c.save(); c.globalAlpha *= 1 - sstep((q - 0.5) / 0.5); c.translate(X, Y); c.rotate(-q * 7); head(c, { ...P, eyes: 'x', bristle: 0.6 }); c.restore();
    return;
  }
  if (P.head <= 0.01) return;
  c.save(); c.translate(hx, hy);
  c.save(); c.globalAlpha *= 0.22 * P.head; c.fillStyle = '#000'; c.beginPath(); c.ellipse(R * 0.1, -hy - R * 0.05, R * 1.05, R * 0.25, 0, 0, TAU); c.fill(); c.restore();
  c.rotate(f === 'anemone' ? P.lean * 0.4 : P.lean); c.scale(P.sx * P.head, P.sy * P.head);
  if (P.crumble > 0) { c.globalAlpha *= 1 - P.crumble; c.translate(0, R * 0.8 * P.crumble); c.scale(1 + 0.3 * P.crumble, 1 - 0.7 * P.crumble); }
  head(c, P);
  c.restore();
  if (f === 'frost' && P.ch > 0.05 && P.crumble < 1) drawDrips(c, hx, hy, R, Math.min(1, P.ch * 1.5) * (1 - P.crumble), t, calm, f);
}

// ------------------------------------------------------------------ the lava's heat on an egg resting on it (over the eggs)
export function drawCreeperOver(ctx, sim, t, k, calm = false) {
  if (!sim.creeps || !sim.creeps.length) return;
  for (const C of sim.creeps) {
    if (C.form !== 'lava' || !C.heat) continue;
    const T = sim.creepM ? sim.creepM({ easy: 2.4, medium: 1.5, hard: 1.2 }) : 1.5;
    for (const id in C.heat) {
      const e = sim.eggs.find((q) => String(q.id) === id); if (!e || !e.alive || !e.body) continue;
      const h = clamp(C.heat[id] / T, 0, 1), p = e.body.getPosition(), d = Math.hypot(p.x, p.y) || 1;
      const dn = C.side === 'in' ? 1 : -1, nx = (p.x / d) * dn, ny = (p.y / d) * dn; // toward the rim (the hot side)
      ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, 0.21, 0, TAU); ctx.clip();
      const g = ctx.createLinearGradient(p.x + nx * 0.25, p.y + ny * 0.25, p.x - nx * 0.25, p.y - ny * 0.25);
      g.addColorStop(0, `rgba(255,90,20,${0.85 * h})`); g.addColorStop(clamp(0.15 + 0.7 * h, 0, 1), `rgba(255,170,60,${0.45 * h})`); g.addColorStop(clamp(0.25 + 0.75 * h, 0, 1), 'rgba(255,200,80,0)');
      ctx.fillStyle = g; ctx.fillRect(p.x - 0.3, p.y - 0.3, 0.6, 0.6); ctx.restore();
      if (!calm && h > 0.35) { // steam off its top
        ctx.save(); ctx.strokeStyle = 'rgba(240,240,240,0.55)'; ctx.lineCap = 'round'; ctx.lineWidth = 0.03;
        for (let i = 0; i < 2; i++) { const q = (t * 0.9 + i * 0.5) % 1, ox = p.x - nx * (0.25 + 0.3 * q) + (i - 0.5) * 0.12 * ny, oy = p.y - ny * (0.25 + 0.3 * q) - (i - 0.5) * 0.12 * nx; ctx.globalAlpha = (h - 0.35) * 1.4 * Math.sin(q * Math.PI); ctx.beginPath(); ctx.arc(ox, oy, 0.05, 0, Math.PI * 1.5); ctx.stroke(); }
        ctx.restore();
      }
    }
  }
}
