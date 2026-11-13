// The clockwork cast of the Shape Lab (v4, sim/clockwork.js): the clockwork spider and its webs, the wind-up beetle and the
// spring jack. Crisp cel-shaded code art in the house style: a dark ink outline, a base colour with one shade band and one
// light band, no pale halos. Each creature is drawn in a local y-DOWN pixel space (pxSpace) at real scale (k px per metre),
// so it can also go through render/status.js for the shared FROZEN and STUNNED looks.
import { RING_TH, TAU } from '../sim/geom.js';
import { ringPt, ringSpd } from '../sim/shapes.js';
import { SPIDER, BEETLE, JACK } from '../sim/clockwork.js';
import { statusClock, statusDraw, dizzyStars, spiralEye } from './status.js';
import { form, ik, limb, back, zed } from './castkit.js';

const INK = '#1a120a';
const BRASS = { base: '#c8963e', light: '#f2cf7c', dark: '#7a5220' };
const STEEL = { base: '#56657a', light: '#8ea3bf', dark: '#2b3443' };
// the cast's own colours: a dark gunmetal body (it stands off the brass rings) with one bright accent each
const GUN = { base: '#3b4351', light: '#6d7b92', dark: '#1a1e26' };
const PEWTER = { base: '#617089', light: '#97a8c2', dark: '#2e3645' }; // lighter than gunmetal: the beetle's shell must also stand off the navy
const TEALK = { base: '#22b8b0', light: '#7fe6dc', dark: '#0f6660' };
const LW = (s) => Math.max(1.7, s * 0.024); // a heavy ink outline, so they read at phone scale
// art scale (the rigs are drawn in metres at 1): the sim's BEETLE.len is 0.62 * BS, JACK.w 0.44 * JS
const BS = BEETLE.len / 0.62, JS = JACK.w / 0.44, SPS = 1.5; // SPS: the spider's art scale (its rig is drawn in metres at 1)
const JACK_SINK = 0.12; // the jack's box is set into the ring (art units): only the lid stands proud of the floor
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const pxSpace = (ctx, x, y, k, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(1 / k, -1 / k); try { f(); } catch (e) { /* art never breaks the frame */ } ctx.restore(); };
const ell = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); };
const E = (c, x, y, rx, ry, rot = 0) => { c.moveTo(x + Math.max(0.1, rx), y); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); };
// cel shading: base fill, a dark crescent on the lower right, a light one on the upper left, an ink outline.
// shape(c) adds the subpaths (no beginPath).
function cel(c, shape, col, lw, shade = true) {
  c.beginPath(); shape(c); c.fillStyle = col.base; c.fill();
  if (shade) {
    const d = lw * 2.2, B = 1e4;
    c.save(); c.beginPath(); shape(c); c.clip();
    c.beginPath(); c.rect(-B, -B, 2 * B, 2 * B); c.save(); c.translate(-d, -d); shape(c); c.restore(); c.fillStyle = col.dark; c.globalAlpha = 0.85; c.fill('evenodd');
    c.beginPath(); c.rect(-B, -B, 2 * B, 2 * B); c.save(); c.translate(d * 0.8, d * 0.8); shape(c); c.restore(); c.fillStyle = col.light; c.globalAlpha = 0.7; c.fill('evenodd');
    c.restore();
  }
  c.beginPath(); shape(c); c.lineWidth = lw; c.strokeStyle = INK; c.stroke();
}
function want(ice, stun) { return ice > 0 ? { k: 'ice', left: ice } : stun > 0 ? { k: 'stun', zap: true, left: stun } : null; }
// a wind-up key seen from the side: the bow turns about the stem (ph), so its width breathes
function key(c, x, y, s, ph, lw, up = -1, K = BRASS) {
  const w = Math.abs(Math.cos(ph)) * 0.09 * s + 0.012 * s, h = 0.075 * s;
  c.lineCap = 'round';
  c.strokeStyle = INK; c.lineWidth = lw * 2.6; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + up * 0.06 * s); c.stroke();
  c.strokeStyle = K.base; c.lineWidth = lw * 1.3; c.stroke();
  for (const sd of [-1, 1]) { ell(c, x + sd * w * 0.55, y + up * (0.06 * s + h * 0.5), w * 0.55, h * 0.5); c.fillStyle = Math.cos(ph) * sd > 0 ? K.light : K.base; c.fill(); c.lineWidth = lw; c.strokeStyle = INK; c.stroke(); }
}

// ---------------------------------------------------------------- the clockwork spider
// Side view, crawling. origin = the middle of its feet on the face it walks on, local +x forward, -y away from the face, s = px
// per metre. o: { gait (m walked: drives the step cycle), spin (0..1 working a web with its front legs), eye ('hot' | 'spiral'),
// curl (0..1 legs tucked: stunned / frozen), key (rad: the wind-up key and the gear on its back) }.
// Eight steel legs in an alternating tetrapod gait (L1 R2 L3 R4 against R1 L2 R3 L4): one set plants while the other lifts and
// swings, so it walks in a readable tick-tock; the body bobs twice a cycle, the abdomen lags a little behind it.
const SP_STRIDE = 0.12, SP_CYCLE = 2 * SP_STRIDE; // m a foot slides through its stance; m walked per full step cycle
const SP_HIP = [0.12, 0.08, 0.035, -0.01], SP_FOOT = [0.41, 0.22, -0.08, -0.35], SP_L = [[0.22, 0.25], [0.19, 0.2], [0.18, 0.19], [0.23, 0.26]];
const SPB = { base: '#7d8ea8', light: '#c8d6ea', dark: '#323c4e' }; // polished steel: it must stand off the navy board
export function drawSpiderArt(c, s, t, o = {}) {
  const lw = LW(s * 1.8), curl = clamp01(o.curl || 0), sp = o.spin || 0;
  const cyc = (((o.gait || 0) / SP_CYCLE) % 1 + 1) % 1, walking = o.gait != null && !curl && !sp && o.moving ? 1 : 0;
  const bob = walking ? -Math.abs(Math.sin(cyc * TAU)) * 0.03 * s : 0, sink = curl * 0.06 * s;
  const lag = walking ? Math.sin(cyc * TAU * 2 - 0.9) * 0.05 : 0; // the abdomen swings after the step
  c.lineJoin = 'round'; c.lineCap = 'round';
  const hipY = -0.17 * s + bob + sink;
  // one leg: i = 0 front .. 3 back; far = the other side (drawn behind, darker); set: which half of the tetrapod it is in
  const leg = (i, far) => {
    const set = (i + far) % 2, ph = (cyc + set * 0.5) % 1, hx = (SP_HIP[i] + (far ? -0.012 : 0)) * s;
    let fx = (SP_FOOT[i] + (far ? 0.03 : 0)) * s, fy = 0, lift = 0;
    if (walking) {
      if (ph < 0.5) fx += SP_STRIDE * s * (0.5 - ph * 2); // stance: planted, the body passes over it
      else { const q = (ph - 0.5) * 2, e = q * q * (3 - 2 * q); fx += SP_STRIDE * s * (-0.5 + e); lift = Math.sin(q * Math.PI) * 0.07 * s; }
    }
    if (sp && i === 0) { const w = Math.sin(t * 16 + far * 2.2); fx = (0.3 + 0.03 * w) * s; lift = (0.12 + 0.07 * w) * s; } // front legs pull silk
    if (sp && i === 1) { fx += Math.sin(t * 16 + 1.4 + far) * 0.02 * s; }
    if (curl) { const tx = hx + (i < 2 ? 0.07 : -0.05) * s, ty = -0.05 * s; fx += (tx - fx) * curl; lift += (-ty - lift) * curl; }
    fy = -lift;
    const hy = hipY + (far ? -0.008 * s : 0), [l1, l2] = SP_L[i];
    let K = ik(hx, hy, fx, fy, l1 * s * (1 - curl * 0.35), l2 * s * (1 - curl * 0.35), 1);
    const K2 = ik(hx, hy, fx, fy, l1 * s * (1 - curl * 0.35), l2 * s * (1 - curl * 0.35), -1);
    if (K2[1] < K[1]) K = K2; // the knee is always the high joint
    const col = far ? '#55657c' : '#c8d6ea';
    limb(c, [[hx, hy], K, [fx, fy]], [lw * 0.62, lw * 0.5, lw * 0.2], col, INK, lw * 0.62);
    c.beginPath(); c.arc(K[0], K[1], lw * (far ? 0.75 : 0.95), 0, TAU); c.fillStyle = far ? TEALK.dark : TEALK.base; c.fill(); c.lineWidth = lw * 0.55; c.strokeStyle = INK; c.stroke();
  };
  for (let i = 3; i >= 0; i--) leg(i, 1);
  // abdomen: a banded gunmetal drum tipped up at the back, a brass gear on its flank and the wind-up key on top
  c.save(); c.translate(-0.15 * s, -0.23 * s + bob + sink * 0.8); c.rotate(-0.28 + lag - curl * 0.15);
  const abd = () => { c.beginPath(); c.ellipse(-0.05 * s, 0, 0.21 * s, 0.16 * s, 0, 0, TAU); };
  form(c, abd, { d: lw * 2.4, lo: SPB.dark, base: SPB.base, hi: SPB.light, hiK: 0.5, line: INK, lw, inner: () => {
    c.strokeStyle = TEALK.base; c.lineWidth = 0.03 * s;
    for (const x of [-0.15, 0.03]) { c.beginPath(); c.moveTo(x * s, -0.17 * s); c.quadraticCurveTo((x + 0.04) * s, 0, x * s, 0.17 * s); c.stroke(); }
    c.strokeStyle = TEALK.light; c.lineWidth = 0.008 * s; for (const x of [-0.16, 0.02]) { c.beginPath(); c.moveTo(x * s, -0.12 * s); c.quadraticCurveTo((x + 0.028) * s, -0.06 * s, (x + 0.03) * s, -0.01 * s); c.stroke(); }
  } });
  // the gear: it turns as the spring drives the legs
  const gr = 0.062 * s, ga = o.key || 0;
  c.beginPath(); for (let k = 0; k < 16; k++) { const a = ga + (k * TAU) / 16, r = k % 2 ? gr : gr * 1.3; c.lineTo(-0.05 * s + Math.cos(a) * r, 0.01 * s + Math.sin(a) * r); } c.closePath();
  c.fillStyle = BRASS.base; c.fill(); c.lineWidth = lw * 0.75; c.strokeStyle = INK; c.stroke();
  c.beginPath(); c.arc(-0.05 * s, 0.01 * s, gr * 0.45, 0, TAU); c.fillStyle = BRASS.light; c.fill(); c.stroke();
  c.beginPath(); c.moveTo(-0.05 * s, 0.01 * s); c.lineTo(-0.05 * s + Math.cos(ga) * gr * 0.9, 0.01 * s + Math.sin(ga) * gr * 0.9); c.lineWidth = lw * 0.6; c.stroke();
  key(c, -0.05 * s, -0.15 * s, s * 1.8, (o.key || 0) * 1.6, lw);
  c.restore();
  // cephalothorax and head, fangs, lens eyes facing forward
  c.save(); c.translate(0, bob + sink);
  for (const sd of [0, 1]) { const a = sp ? Math.sin(t * 20 + sd * 2) * 0.012 * s : 0; c.beginPath(); c.moveTo((0.22 - sd * 0.015) * s, -0.14 * s); c.quadraticCurveTo((0.27 - sd * 0.015) * s + a, -0.09 * s, (0.235 - sd * 0.02) * s, -0.06 * s); c.strokeStyle = INK; c.lineWidth = lw * 2; c.stroke(); c.strokeStyle = '#e8eef6'; c.lineWidth = lw * 0.8; c.stroke(); }
  const body = () => { c.beginPath(); c.ellipse(0.08 * s, -0.19 * s, 0.15 * s, 0.1 * s, -0.08, 0, TAU); };
  form(c, body, { d: lw * 2, lo: SPB.dark, base: SPB.base, hi: SPB.light, hiK: 0.5, line: INK, lw });
  c.fillStyle = BRASS.light; for (const x of [0.0, 0.08]) { c.beginPath(); c.arc(x * s, -0.25 * s, 0.013 * s, 0, TAU); c.fill(); }
  const hot = o.eye === 'hot' || sp > 0;
  for (const [ex, ey, r, far] of [[0.205, -0.22, 0.033, 1], [0.19, -0.18, 0.045, 0]]) {
    const X = ex * s, Y = ey * s, R = r * s;
    c.beginPath(); c.arc(X, Y, R, 0, TAU); c.fillStyle = INK; c.fill();
    if (o.eye === 'spiral') { spiralEye(c, X, Y, R * 0.9, t, far ? -1 : 1, '#ffd0a0'); continue; }
    if (hot) { c.save(); c.globalAlpha = 0.35 + 0.15 * Math.sin(t * 12); c.beginPath(); c.arc(X, Y, R * 1.9, 0, TAU); c.fillStyle = '#ff7a2a'; c.fill(); c.restore(); }
    const pu = hot ? 0.74 + 0.07 * Math.sin(t * 14) : 0.6;
    c.beginPath(); c.arc(X, Y, R * pu, 0, TAU); c.fillStyle = hot ? '#ff8a3a' : (curl ? '#7a2a20' : '#ff3b2a'); c.fill();
    if (hot) { c.beginPath(); c.arc(X + R * 0.1, Y, R * 0.34, 0, TAU); c.fillStyle = '#ffe9a0'; c.fill(); }
    c.beginPath(); c.arc(X - R * 0.28, Y - R * 0.32, R * 0.22, 0, TAU); c.fillStyle = '#fff4d8'; c.fill();
  }
  if (hot && o.eye !== 'spiral') { c.beginPath(); c.moveTo(0.13 * s, -0.27 * s); c.lineTo(0.235 * s, -0.23 * s); c.strokeStyle = INK; c.lineWidth = lw * 1.3; c.stroke(); } // a mean brow
  c.restore();
  for (let i = 3; i >= 0; i--) leg(i, 0);
}

// a web across a gap: spokes from a hub to both gap edges and two cross threads; k = how much is spun, sag in m
function drawWeb(ctx, sim, W, k, t) {
  const ring = sim.rings[W.ri], g = ring.gaps[W.gi];
  if (!g || !(W.k > 0)) return;
  const A = ring.body.getAngle(), half = g.len / (2 * ringSpd(ring, g.a)), px = 1 / k;
  const P = (rad, la) => { const [x, y] = ringPt(ring, la, rad); return [x * Math.cos(A) - y * Math.sin(A), x * Math.sin(A) + y * Math.cos(A)]; };
  const ending = W.k >= 1 && W.life < 0.8 ? 1 - W.life / 0.8 : 0;
  const sag = 0.05 + (W.held ? 0.07 : 0) + ending * 0.12;
  const ri = ring.r - RING_TH / 2 - 0.02, ro = ring.r + RING_TH / 2 + 0.02;
  const hub = P(ring.r + sag, g.a);
  const anchors = [P(ri, g.a - half), P(ring.r, g.a - half), P(ro, g.a - half), P(ro, g.a + half), P(ring.r, g.a + half), P(ri, g.a + half), P(ri, g.a - half * 0.3), P(ri, g.a + half * 0.3)];
  const order = [0, 6, 7, 5, 4, 3, 2, 1];
  // strand by strand while it is spun (sv 0..1): the spokes by SPIDER.open (then it holds), the cross threads after
  const vis = W.sv == null ? 1 : clamp01(W.sv), so = SPIDER.open / SPIDER.spin, spun = W.k >= 1 ? 1 : clamp01(W.k);
  const n = Math.ceil(Math.min(clamp01(vis / so), spun < 1 ? spun : 1) * anchors.length), cross = clamp01((vis - so) / (1 - so));
  const strand = (fn, w) => { ctx.beginPath(); fn(); ctx.lineWidth = w * 2.4; ctx.strokeStyle = 'rgba(16,14,20,0.85)'; ctx.stroke(); ctx.lineWidth = w; ctx.strokeStyle = '#d9e2ea'; ctx.stroke(); };
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (ending) ctx.globalAlpha = 1 - ending * 0.5;
  else if (W.k < 1) ctx.globalAlpha = 0.7; // not holding yet: the gap is still open
  strand(() => { for (let i = 0; i < n; i++) { ctx.moveTo(...hub); ctx.lineTo(...anchors[order[i]]); } }, Math.max(1.3 * px, 0.012));
  if (W.k >= 1 && cross > 0) { const m = Math.max(2, Math.ceil(cross * order.length)); for (const f of [0.45, 0.8]) strand(() => order.slice(0, m).forEach((j, i) => { const a = anchors[j], x = hub[0] + (a[0] - hub[0]) * f, y = hub[1] + (a[1] - hub[1]) * f; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }), Math.max(1.0 * px, 0.01)); }
  // dew-drop rivets where the threads meet the brass
  ctx.fillStyle = '#cfd8e2';
  for (let i = 0; i < n; i++) { const a = anchors[order[i]]; ctx.beginPath(); ctx.arc(a[0], a[1], 1.4 * px, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// ---------------------------------------------------------------- the wind-up beetle
// origin = between its feet on the floor, local +x forward, -y up. o: { walk (gait distance m), key (turn), lamp, tip, slack,
//   gauge (0..1 of a full wind, null = none), yawn (0..1), zz (asleep: a Z drifts up) }
// A tin toy: a glossy red wing-case dome split by a seam, a pewter skirt with brass rivets, six jointed tin legs that plant
// as it marches (the shell rocks, the feelers spring after it), a round head with a headlamp eye and a steel plough.
const TIN = { base: '#e2452f', light: '#ff8f6a', dark: '#96201a' };
const HEADC = { base: '#4a4450', light: '#847a8c', dark: '#221e28' };
export function drawBeetleArt(c, s, t, o = {}) {
  const lw = LW(s);
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.save();
  if (!o.tip) { c.fillStyle = 'rgba(0,0,0,0.26)'; c.beginPath(); c.ellipse(0.01 * s, 0.004 * s, 0.34 * s, 0.022 * s, 0, 0, TAU); c.fill(); }
  if (o.tip) { c.translate(0, -0.16 * s); c.rotate(Math.PI + Math.sin(t * 6) * 0.07); c.translate(0, 0.16 * s); }
  const g = (o.walk || 0) * 22, slack = o.slack || 0, sag = slack * 0.022 * s, walking = o.walk ? 1 : 0;
  const rock = walking * Math.sin(g * 2) * 0.012, bob = walking * Math.abs(Math.sin(g)) * 0.008 * s;
  // legs: three a side, two-jointed, feet planted through the stance (the far side darker)
  const leg = (i, far) => {
    const c0 = ((((g + i * 2.1 + far * Math.PI) / TAU) % 1) + 1) % 1, st = 0.62, stride = 0.088 * s * walking;
    let fx, lift = 0;
    if (o.tip) { fx = Math.sin(t * 17 + i * 2 + far) * 0.05 * s; lift = 0.06 * s + Math.cos(t * 17 + i * 2 + far) * 0.03 * s; }
    else if (c0 < st) fx = stride * (0.5 - c0 / st); else { const q = (c0 - st) / (1 - st); fx = stride * (-0.5 + q * q * (3 - 2 * q)); lift = Math.sin(q * Math.PI) * 0.04 * s; }
    const hip = [(-0.16 + i * 0.13) * s, -0.075 * s + sag], foot = [(-0.235 + i * 0.2 + (far ? -0.02 : 0.02)) * s + fx, -lift - 0.004 * s];
    const K = ik(hip[0], hip[1], foot[0], foot[1], 0.06 * s, 0.075 * s, i === 0 ? 1 : -1);
    limb(c, [hip, K, foot], [lw * 0.95, lw * 0.8, lw * 0.5], far ? '#3a2e32' : '#7a6a70', INK, lw * 0.75);
    c.beginPath(); c.ellipse(foot[0] + 0.01 * s, foot[1], 0.018 * s, 0.009 * s, 0, 0, TAU); c.fillStyle = far ? '#3a2e32' : '#6a5a5e'; c.fill(); c.lineWidth = lw * 0.7; c.strokeStyle = INK; c.stroke();
  };
  for (let i = 0; i < 3; i++) leg(i, 1);
  c.save(); c.translate(0, -bob + sag); c.rotate(rock - slack * 0.04);
  // the big wind-up key on its back (behind the shell; drawn again over the gauge below)
  const bigKey = () => key(c, -0.07 * s, -0.3 * s, s * 1.55, o.key || 0, lw * 1.1, -1, TEALK);
  bigKey();
  // plough: a steel scoop low at the front
  const plough = () => { c.beginPath(); c.moveTo(0.2 * s, -0.035 * s); c.lineTo(0.345 * s, -0.004 * s); c.quadraticCurveTo(0.385 * s, -0.085 * s, 0.32 * s, -0.165 * s); c.lineTo(0.22 * s, -0.12 * s); c.closePath(); };
  form(c, plough, { d: lw * 1.6, lo: STEEL.dark, base: STEEL.base, hi: STEEL.light, hiK: 0.6, line: INK, lw, noWeight: true });
  // head with a headlamp eye, sprung feelers
  const wob = walking * Math.sin(g * 2 - 1) * 0.02 * s + (o.tip ? Math.sin(t * 9) * 0.02 * s : 0) - slack * 0.03 * s;
  c.strokeStyle = INK; c.lineWidth = lw * 1.2;
  for (const d of [0, 0.035]) { const tx = (0.375 + d) * s + wob, ty = (-0.275 + d * 0.9) * s - wob * 0.5 + slack * 0.07 * s; c.beginPath(); c.moveTo(0.265 * s, -0.175 * s); c.quadraticCurveTo((0.305 + d) * s, -0.285 * s, tx, ty); c.stroke(); c.beginPath(); c.arc(tx, ty, 0.017 * s, 0, TAU); c.fillStyle = BRASS.light; c.fill(); c.stroke(); }
  const head = () => { c.beginPath(); c.ellipse(0.245 * s, -0.125 * s, 0.085 * s, 0.075 * s, 0, 0, TAU); };
  form(c, head, { d: lw * 1.8, lo: HEADC.dark, base: HEADC.base, hi: HEADC.light, hiK: 0.5, line: INK, lw, noWeight: true });
  const ex = 0.275 * s, ey = -0.135 * s, er = 0.038 * s;
  c.beginPath(); c.arc(ex, ey, er, 0, TAU); c.fillStyle = INK; c.fill();
  if (o.eye === 'spiral') spiralEye(c, ex, ey, er, t, 1, '#ffe0a0');
  else if (o.eye === 'off') { c.beginPath(); c.arc(ex, ey, er * 0.66, 0, TAU); c.fillStyle = '#5a4a30'; c.fill(); c.beginPath(); c.moveTo(ex - er * 0.6, ey + er * 0.1); c.quadraticCurveTo(ex, ey + er * 0.5, ex + er * 0.6, ey + er * 0.1); c.strokeStyle = '#d9a040'; c.lineWidth = lw * 0.9; c.stroke(); }
  else { c.beginPath(); c.arc(ex, ey, er * 0.7, 0, TAU); c.fillStyle = o.lamp ? '#ffe36a' : '#d9a040'; c.fill(); if (o.lamp) { c.beginPath(); c.arc(ex, ey, er * 0.36, 0, TAU); c.fillStyle = '#fffbe0'; c.fill(); } c.beginPath(); c.arc(ex - er * 0.25, ey - er * 0.3, er * 0.2, 0, TAU); c.fillStyle = '#ffffff'; c.fill(); }
  // skirt, then the wing-case dome
  const skirt = () => { c.beginPath(); c.roundRect(-0.315 * s, -0.105 * s, 0.56 * s, 0.062 * s, 0.022 * s); };
  form(c, skirt, { d: lw * 1.4, lo: PEWTER.dark, base: PEWTER.base, hi: PEWTER.light, hiK: 0.6, line: INK, lw, noWeight: true });
  c.fillStyle = BRASS.light; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc((-0.26 + i * 0.115) * s, -0.074 * s, 0.013 * s, 0, TAU); c.fill(); c.lineWidth = lw * 0.5; c.strokeStyle = INK; c.stroke(); }
  const shell = () => { c.beginPath(); c.moveTo(-0.325 * s, -0.095 * s); c.bezierCurveTo(-0.33 * s, -0.36 * s, 0.16 * s, -0.4 * s, 0.245 * s, -0.1 * s); c.closePath(); };
  form(c, shell, { d: lw * 3, lo: TIN.dark, base: TIN.base, hi: TIN.light, hiK: 0.4, line: INK, lw: lw * 1.1, inner: () => {
    c.strokeStyle = TIN.dark; c.lineWidth = lw * 1.1; c.beginPath(); c.moveTo(-0.05 * s, -0.33 * s); c.quadraticCurveTo(-0.02 * s, -0.2 * s, -0.06 * s, -0.09 * s); c.stroke(); // the seam between the wing cases
    c.fillStyle = '#fff1d0'; for (const [px, py, pr] of [[-0.2, -0.2, 0.034], [-0.12, -0.28, 0.024], [0.07, -0.25, 0.034], [0.15, -0.16, 0.024]]) { c.beginPath(); c.arc(px * s, py * s, pr * s, 0, TAU); c.fill(); }
    c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = lw * 1.3; c.beginPath(); c.moveTo(-0.26 * s, -0.2 * s); c.quadraticCurveTo(-0.22 * s, -0.3 * s, -0.12 * s, -0.335 * s); c.stroke(); // gloss
  } });
  // a yawn as the spring gives out
  if (o.yawn > 0) { const m = Math.sin(clamp01(o.yawn) * Math.PI); ell(c, 0.3 * s, -0.085 * s, 0.03 * s, 0.006 * s + m * 0.03 * s); c.fillStyle = '#3a0e0a'; c.fill(); c.lineWidth = lw * 0.8; c.strokeStyle = INK; c.stroke(); }
  // the wind gauge: four segments (one per 30 degrees of ring turn, 1.5 s each) in an arc round the key's foot
  if (o.gauge != null) {
    const gx = -0.07 * s, gy = -0.36 * s, gr = 0.15 * s, f = clamp01(o.gauge), seg = (Math.PI * 1.2) / 4, a00 = Math.PI * 0.9, gap = 0.1;
    const col = f > 0.5 ? '#6af0c8' : f > 0.2 ? '#ffd04a' : '#ff6a4a';
    c.lineCap = 'butt';
    for (let i = 0; i < 4; i++) {
      const a0 = a00 + i * seg + gap / 2, a1 = a00 + (i + 1) * seg - gap / 2, fill = clamp01(f * 4 - i);
      c.beginPath(); c.arc(gx, gy, gr, a0, a1); c.lineWidth = lw * 4.4; c.strokeStyle = INK; c.stroke();
      c.lineWidth = lw * 2.6; c.strokeStyle = '#4a4458'; c.stroke();
      if (fill > 0) { c.beginPath(); c.arc(gx, gy, gr, a0, a0 + (a1 - a0) * fill); c.strokeStyle = col; c.stroke(); }
    }
    c.lineCap = 'round';
    bigKey();
  }
  c.restore();
  for (let i = 0; i < 3; i++) leg(i, 0);
  if (o.zz) { const u = (t * 0.45) % 1; zed(c, 0.2 * s, -0.36 * s, 0.035 * s, u, INK, '#e8f0ff'); }
  c.restore();
}

// ---------------------------------------------------------------- the spring jack
// origin = floor centre of the box, -y up. o: { lid (0 shut .. 1 open), out (0..1 spring), rattle, jam, crank, eye, slack }
export function drawJackArt(c, s, t, o = {}) {
  const lw = LW(s), TEAL = GUN;
  const W = 0.44 * s, H = 0.22 * s, rx = o.rattle ? Math.sin(t * 46) * 0.012 * s * o.rattle : 0, ry = o.rattle ? -Math.abs(Math.sin(t * 31)) * 0.02 * s * o.rattle : 0;
  c.lineJoin = 'round'; c.lineCap = 'round';
  const top = -H;
  // the jack on its spring (behind the box front)
  const ext = o.out || 0;
  if (ext > 0.02) {
    const hy = top - ext * 0.5 * s, wob = Math.sin(t * 13) * 0.03 * s * ext * (o.slack ? 0.3 : 1);
    c.strokeStyle = INK; c.lineWidth = lw * 2.6;
    const coil = () => { c.beginPath(); const N = 9; for (let i = 0; i <= N; i++) { const y = top + ((hy - top) * i) / N, x = (i % 2 ? 1 : -1) * 0.06 * s + wob * (i / N); i ? c.lineTo(x, y) : c.moveTo(0, top); } };
    coil(); c.stroke(); coil(); c.strokeStyle = '#c3ccd6'; c.lineWidth = lw * 1.1; c.stroke();
    const hx = wob, hr = 0.11 * s;
    // ruff collar
    c.beginPath(); for (let i = 0; i <= 10; i++) { const a = Math.PI + (i / 10) * Math.PI, r = i % 2 ? hr * 1.05 : hr * 1.35; c.lineTo(hx + Math.cos(a) * r, hy + hr * 0.75 - Math.sin(a) * r * 0.45); } c.closePath();
    c.fillStyle = '#e8452e'; c.fill(); c.lineWidth = lw; c.strokeStyle = INK; c.stroke();
    cel(c, (c) => E(c, hx, hy, hr, hr * 0.95), { base: '#f6dfb6', light: '#fff2d6', dark: '#c99a6a' }, lw);
    // hat
    cel(c, (c) => { c.moveTo(hx - hr * 0.8, hy - hr * 0.55); c.quadraticCurveTo(hx + hr * 0.2, hy - hr * 2.2, hx + hr * 0.9, hy - hr * 1.7); c.lineTo(hx + hr * 0.75, hy - hr * 0.6); c.closePath(); }, { base: '#7b4bc4', light: '#a982e6', dark: '#45237a' }, lw);
    c.beginPath(); c.arc(hx + hr * 0.95, hy - hr * 1.75, hr * 0.24, 0, TAU); c.fillStyle = '#ffd23a'; c.fill(); c.lineWidth = lw; c.strokeStyle = INK; c.stroke();
    // face: eyes, red nose, a wide grin
    for (const sd of [-1, 1]) {
      const ex = hx + sd * hr * 0.38, ey = hy - hr * 0.12;
      if (o.eye === 'spiral') spiralEye(c, ex, ey, hr * 0.2, t, sd);
      else { c.beginPath(); c.arc(ex, ey, hr * 0.13, 0, TAU); c.fillStyle = INK; c.fill(); c.beginPath(); c.arc(ex - hr * 0.04, ey - hr * 0.05, hr * 0.045, 0, TAU); c.fillStyle = '#fff'; c.fill(); }
    }
    c.beginPath(); c.arc(hx, hy + hr * 0.1, hr * 0.17, 0, TAU); c.fillStyle = '#e0302a'; c.fill(); c.lineWidth = lw; c.strokeStyle = INK; c.stroke();
    c.beginPath(); c.moveTo(hx - hr * 0.55, hy + hr * 0.32); c.quadraticCurveTo(hx, hy + hr * 0.85, hx + hr * 0.55, hy + hr * 0.32); c.lineWidth = lw * 1.3; c.stroke();
  }
  // the box: teal with a yellow star, brass corners; the lid hinges at its back (left) edge
  c.save(); c.translate(rx, ry);
  form(c, () => { c.beginPath(); c.roundRect(-W / 2, top, W, H + 0.04 * s, 0.03 * s); }, { d: lw * 2.6, lo: TEAL.dark, base: TEAL.base, hi: TEAL.light, hiK: 0.45, line: INK, lw: lw * 1.1, inner: () => {
    c.fillStyle = 'rgba(0,0,0,0.22)'; c.beginPath(); c.roundRect(-W / 2 + 0.05 * s, top + 0.035 * s, W - 0.1 * s, H - 0.03 * s, 0.02 * s); c.fill(); // an inset panel
    c.strokeStyle = TEALK.base; c.lineWidth = lw * 0.9; c.beginPath(); c.roundRect(-W / 2 + 0.05 * s, top + 0.035 * s, W - 0.1 * s, H - 0.03 * s, 0.02 * s); c.stroke();
  } });
  const st = (x, y, r) => { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); };
  st(0, top + H * 0.52, H * 0.32); c.fillStyle = '#ffd23a'; c.fill(); c.lineWidth = lw * 0.8; c.strokeStyle = INK; c.stroke();
  c.fillStyle = BRASS.base; for (const sx of [-1, 1]) { c.beginPath(); c.roundRect(sx > 0 ? W / 2 - 0.05 * s : -W / 2, top, 0.05 * s, 0.05 * s, 0.01 * s); c.fill(); c.lineWidth = lw * 0.8; c.strokeStyle = INK; c.stroke(); }
  // crank on the side (turns while it reloads)
  const cr = o.crank || 0, cx = W / 2 + 0.01 * s, cy = top + H * 0.5;
  c.strokeStyle = INK; c.lineWidth = lw * 2.4; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(cr) * 0.07 * s, cy + Math.sin(cr) * 0.07 * s); c.stroke();
  c.strokeStyle = BRASS.light; c.lineWidth = lw * 1.1; c.stroke();
  c.beginPath(); c.arc(cx, cy, 0.018 * s, 0, TAU); c.fillStyle = BRASS.base; c.fill(); c.lineWidth = lw * 0.8; c.strokeStyle = INK; c.stroke();
  // lid
  const la = -(o.lid || 0) * 1.65; // just past upright, so it still reads as a lid
  c.save(); c.translate(-W / 2, top); c.rotate(la);
  cel(c, (c) => { c.roundRect(-0.01 * s, -0.045 * s, W + 0.02 * s, 0.05 * s, 0.015 * s); }, TEALK, lw, false);
  c.restore();
  // jammed: a brass bolt shot through the hasp and a dent
  if (o.jam) {
    c.fillStyle = BRASS.light; c.beginPath(); c.roundRect(W * 0.18, top - 0.06 * s, 0.11 * s, 0.1 * s, 0.015 * s); c.fill(); c.lineWidth = lw; c.strokeStyle = INK; c.stroke();
    c.strokeStyle = INK; c.lineWidth = lw * 2.2; c.beginPath(); c.moveTo(W * 0.1, top - 0.01 * s); c.lineTo(W * 0.42, top - 0.01 * s); c.stroke();
    c.strokeStyle = '#9aa6b2'; c.lineWidth = lw * 1.1; c.stroke();
    c.strokeStyle = TEAL.dark; c.lineWidth = lw; c.beginPath(); c.moveTo(-W * 0.3, top + H * 0.2); c.lineTo(-W * 0.18, top + H * 0.35); c.lineTo(-W * 0.26, top + H * 0.48); c.stroke();
  }
  c.restore();
}

// ---------------------------------------------------------------- in the level (main.js: after the rings, before the eggs)
export function drawClockwork(ctx, sim, t, k) {
  const C = sim.cw;
  if (!C || !(C.sp.length || C.bt.length || C.jk.length)) return;
  for (const W of C.webs) drawWeb(ctx, sim, W, k, t);
  const eggs = sim.aliveEggs().map((e) => e.body.getPosition());
  for (const J of C.jk) {
    const q = sim.cwFloor(J.fi, J.la, 0), up = q.up, st = statusClock(sim, 'cj' + J.id, want(J.ice, J.stun), t);
    const near = J.ph === 'ready' ? Math.max(0, ...eggs.map((p) => clamp01(1 - (Math.hypot(p.x - q.x, p.y - q.y) - 0.35) / 0.6))) : 0;
    const M = sim.cwMode || 'medium', rel = JACK.reload[M] - JACK.out;
    const o = J.ph === 'out' ? { lid: 1, out: clamp01((JACK.out - J.t) / 0.08) } : J.ph === 'reload' ? { lid: J.t > 0.25 ? 1 : J.t / 0.25, out: clamp01((J.t - 0.3) / Math.max(0.1, rel - 0.3)), crank: t * 9 } : { lid: 0, out: 0, rattle: near, jam: J.ph === 'jam' };
    if (st && st.k === 'stun') o.eye = 'spiral';
    pxSpace(ctx, q.x, q.y, k, () => { ctx.rotate(-(up - Math.PI / 2)); const z = JS * k; ctx.translate(0, JACK_SINK * z); statusDraw(ctx, { x0: -0.35 * z, y0: -0.9 * z, x1: 0.35 * z, y1: 0.08 * z }, (c) => drawJackArt(c, z, st ? st.hold : t, o), st, { quick: true }); });
  }
  for (const B of C.bt) {
    const q = sim.cwBeetlePose(B), st = statusClock(sim, 'cb' + B.id, want(B.ice, B.stun), t), held = B.ice > 0 || B.stun > 0;
    const walking = B.ph === 'walk' && !held, ring = sim.rings[B.fi];
    // marching: the gait follows the floor it covers; stalled at a gap edge it treads on the spot
    const walk = walking ? (B.stall ? t * 0.5 : B.la * ring.r * B.dir) : 0, asleep = B.ph === 'sleep';
    const sl = asleep ? clamp01(B.st / 0.8) : 0;
    const o = { walk, key: B.ka || 0, lamp: walking, tip: B.ph === 'tip', gauge: B.ph === 'tip' ? null : B.wind / BEETLE.max,
      eye: B.stun > 0 ? 'spiral' : asleep ? 'off' : '', slack: sl, yawn: asleep && B.st < 1.4 ? B.st / 1.4 : 0, zz: asleep && B.st > 1.4 && !held };
    pxSpace(ctx, q.x, q.y, k, () => {
      ctx.rotate(-q.a);
      if (B.dir < 0) ctx.scale(-1, 1);
      if (walking && B.stall) ctx.translate(Math.sin(t * 40) * 0.008 * k, 0); // straining at the edge
      const z = BS * k;
      statusDraw(ctx, { x0: -0.4 * z, y0: -0.5 * z, x1: 0.45 * z, y1: 0.05 * z }, (c) => drawBeetleArt(c, z, st ? st.hold : t, o), st, { quick: true });
      if (st && st.k === 'stun') dizzyStars(ctx, 0.05 * z, -0.42 * z, 0.16 * z, 0.05 * z, t, { size: Math.max(2.6, 0.045 * z) });
    });
  }
  for (const S of C.sp) {
    const q = sim.cwSpider(S);
    if (!q) continue;
    // flung off by a spin storm: gone, then it lowers itself back onto the same spot on a thread
    let drop = 0;
    if (S.ph === 'flung') { if (S.t > 0.7) continue; drop = S.t / 0.7; }
    const st = statusClock(sim, 'cs' + S.id, want(S.ice, S.stun), t), held = S.ice > 0 || S.stun > 0;
    const ring = sim.rings[S.ri], gait = S.la * ring.r * (S.dir > 0 ? 1 : -1), up = q.up, ux = Math.cos(up), uy = Math.sin(up);
    const dx = q.fx + ux * drop * 1.6, dy = q.fy + uy * drop * 1.6;
    if (drop > 0) { ctx.save(); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(q.fx + ux * 3, q.fy + uy * 3); ctx.lineTo(dx + ux * 0.3, dy + uy * 0.3); ctx.lineWidth = 2.4 / k; ctx.strokeStyle = 'rgba(16,14,20,0.8)'; ctx.stroke(); ctx.lineWidth = 1.1 / k; ctx.strokeStyle = '#d9e2ea'; ctx.stroke(); ctx.restore(); }
    // working a web: a silk line from its front legs to the web's hub
    if (S.ph === 'spin' && !held) {
      const g = ring.gaps[S.gi];
      if (g) {
        const A = ring.body.getAngle(), [hx, hy] = ringPt(ring, g.a, ring.r), Hx = hx * Math.cos(A) - hy * Math.sin(A), Hy = hx * Math.sin(A) + hy * Math.cos(A);
        const fa = up + (S.dir > 0 ? Math.PI / 2 : -Math.PI / 2), w = Math.sin(t * 16) * 0.03, mx = q.fx + Math.cos(fa) * 0.3 * SPS + ux * (0.12 + w) * SPS, my = q.fy + Math.sin(fa) * 0.3 * SPS + uy * (0.12 + w) * SPS;
        ctx.save(); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(Hx, Hy); ctx.lineWidth = 2.2 / k; ctx.strokeStyle = 'rgba(16,14,20,0.7)'; ctx.stroke(); ctx.lineWidth = 1.0 / k; ctx.strokeStyle = '#eef3f8'; ctx.stroke(); ctx.restore();
      }
    }
    const o = { gait, moving: S.ph === 'walk' && !held && !drop, spin: S.ph === 'spin' && !held ? 1 : 0, curl: held || drop ? 1 - (drop ? 0 : 0) : 0, key: gait * 9 + (S.ph === 'spin' && !held ? t * 6 : 0),
      eye: S.stun > 0 ? 'spiral' : S.ph === 'walk' || S.ph === 'spin' ? 'hot' : '' };
    if (drop) o.curl = 0.6;
    pxSpace(ctx, dx, dy, k, () => {
      ctx.rotate(-(up - Math.PI / 2));
      if (S.dir > 0) ctx.scale(-1, 1); // on the outer face, +la runs to its left
      const z = SPS * k;
      statusDraw(ctx, { x0: -0.5 * z, y0: -0.48 * z, x1: 0.48 * z, y1: 0.04 * z }, (c) => drawSpiderArt(c, z, st ? st.hold : t, o), st, { quick: true });
      if (st && st.k === 'stun') dizzyStars(ctx, 0, -0.42 * z, 0.16 * z, 0.05 * z, t, { size: Math.max(2.6, 0.06 * z) });
    });
  }
}

// the spider's telegraph: a dashed ring of the web to come on the gap it is winding down to
export function drawClockworkTele(ctx, sim, t, k) {
  const C = sim.cw;
  if (!C) return;
  for (const S of C.sp) {
    if (S.ph !== 'walk' && !(S.ph === 'spin' && !S.done)) continue;
    const q = sim.cwSpider(S);
    if (!q) continue;
    // a dashed ring on the gap it is heading for; it tightens and goes solid as the web is spun
    const u = S.ph === 'spin' ? clamp01((1 - S.t / S.dur) * SPIDER.spin / SPIDER.open) : 0, a = S.ph === 'spin' ? 0.8 : 0.45 + 0.35 * Math.sin(t * 8);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.setLineDash([5 / k, 4 / k]); ctx.lineDashOffset = -t * 12 / k;
    ctx.lineWidth = 2.2 / k; ctx.strokeStyle = '#ff6a3a';
    ctx.beginPath(); ctx.arc(q.gx, q.gy, 0.42 - 0.12 * u, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}

// events -> popups, sounds, one-time tips
// intro card art (main.js drawIntro, level.intro.cw): the creature at rest on a brass floor, about h px tall
export function drawCwIntro(c, kind, x, y, w, h, t) {
  c.save();
  const cx = x + w / 2, floor = (fy, half) => { c.fillStyle = BRASS.dark; c.fillRect(cx - half, fy, half * 2, Math.max(3, h * 0.05)); c.fillStyle = BRASS.base; c.fillRect(cx - half, fy, half * 2, Math.max(1.5, h * 0.022)); };
  if (kind === 'spider') {
    // it crawls to and fro along a brass beam, eyes hot, then stops and works its front legs (spinning)
    const z = h * 1.25, u = t % 5, walk = u < 3.6, x0 = Math.sin((Math.min(u, 3.6) / 3.6) * Math.PI) * w * 0.12;
    floor(y + h * 0.88, w * 0.42);
    c.translate(cx + x0 - w * 0.06, y + h * 0.88);
    const gait = (Math.min(u, 3.6) / 3.6) * 0.75 + Math.floor(t / 5) * 0.75;
    if (walk && Math.cos((u / 3.6) * Math.PI) < 0) c.scale(-1, 1);
    drawSpiderArt(c, z, t, { gait, moving: walk, spin: walk ? 0 : 1, eye: 'hot', key: gait * 9 });
  } else if (kind === 'beetle') {
    const z = h * 1.55;
    floor(y + h * 0.92, z * 0.7);
    c.translate(cx + Math.sin(t * 0.8) * h * 0.25, y + h * 0.92);
    if (Math.cos(t * 0.8) < 0) c.scale(-1, 1);
    drawBeetleArt(c, z, t, { walk: t * 0.5, key: -t * 3, lamp: true, gauge: 1 - ((t * 0.8 / Math.PI) % 1) * 0.8 });
  } else if (kind === 'jack') {
    const z = h * 1.0, ph = t % 3.2;
    floor(y + h * 0.95, z * 0.6);
    c.translate(cx, y + h * 0.95);
    drawJackArt(c, z, t, ph < 2 ? { lid: 0, out: 0, rattle: ph > 1.3 ? 1 : 0 } : { lid: 1, out: Math.min(1, (ph - 2) / 0.1) });
  } else if (kind === 'rock') {
    // the rocking vault: a square ring leans one way and back, and the egg parked on its floor slides to the low corner
    const u = (t % 6) / 6, leg = [0, 1, 0, -1], i = Math.floor(u * 4), f = u * 4 - i, w = f < 0.5 ? 0 : (f - 0.5) * 2, e = w * w * (3 - 2 * w);
    const lean = 0.42 * (leg[i] + (leg[(i + 1) % 4] - leg[i]) * e), R = h * 0.4, th = Math.max(3, h * 0.06);
    c.translate(cx, y + h * 0.5); c.rotate(lean);
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-R * 0.22, -R); c.lineTo(-R * 0.58, -R); c.arcTo(-R, -R, -R, -R * 0.58, R * 0.42); c.lineTo(-R, R * 0.58); c.arcTo(-R, R, -R * 0.58, R, R * 0.42);
    c.lineTo(R * 0.58, R); c.arcTo(R, R, R, R * 0.58, R * 0.42); c.lineTo(R, -R * 0.58); c.arcTo(R, -R, R * 0.58, -R, R * 0.42); c.lineTo(R * 0.22, -R);
    c.lineWidth = th * 1.7; c.strokeStyle = INK; c.stroke(); c.lineWidth = th; c.strokeStyle = BRASS.base; c.stroke();
    const eh = h * 0.24, ew = eh * 0.75, slide = clamp01(Math.abs(lean) / 0.42) * Math.sign(lean), ex = slide * (R - ew * 0.5 - R * 0.42 * 0.5), ey = R - th * 0.85 - eh / 2;
    c.save(); c.translate(ex, ey); c.rotate(slide * 0.5);
    c.beginPath(); c.ellipse(0, 0, ew / 2, eh / 2, 0, 0, TAU); c.fillStyle = '#fbefd6'; c.fill(); c.lineWidth = Math.max(1.5, h * 0.022); c.strokeStyle = INK; c.stroke();
    c.restore();
  }
  c.restore();
}

export function cwEvent(ev, fx, U) {
  const { popup, audio, once } = U;
  switch (ev.type) {
    case 'spiderWalk': audio.play('motor_tick', { vol: 0.45, pitch: 1.8 }); once('cwSpider', 'Clockwork spider: it crawls to a gap and webs it shut. Slip an egg past while it spins. Fire, iron or laser tear webs.', 7); break;
    case 'spiderSpin': audio.play('motor_tick', { vol: 0.4, pitch: 2.2 }); break;
    case 'webUp': audio.play('squish', { vol: 0.35, pitch: 1.8 }); popup(ev.x, ev.y + 0.5, 'Webbed!', { color: '#d9e2ea', size: 16, life: 0.9 }); break;
    case 'webCatch': audio.play('bubble_on', { vol: 0.4, pitch: 0.8 }); popup(ev.x, ev.y + 0.5, 'Caught!', { color: '#bff0a0', size: 16, life: 0.9 }); break;
    case 'webTear': audio.play('thorn_snap', { vol: 0.6, pitch: 1.5 }); fx.sparkle(ev.x, ev.y, 8, '#e6eef5'); popup(ev.x, ev.y + 0.5, 'Torn!', { color: '#ffd36b', size: 16, life: 0.9 }); break;
    case 'webGone': audio.play('release', { vol: 0.3 }); break;
    case 'spiderFlung': audio.play('wind_gust', { vol: 0.5, pitch: 1.6 }); popup(ev.x, ev.y + 0.5, 'Flung off!', { color: '#bff0a0', size: 16, life: 1 }); break;
    case 'beetleWind': audio.play('unlock', { vol: 0.4, pitch: 1.5 }); once('cwBeetle', 'Wind-up beetle: turn his ring to wind him. He marches that way and crushes thorns.', 7); break;
    case 'beetleTick': audio.play('motor_tick', { vol: 0.16 + 0.14 * ev.f, pitch: 1.5 + 0.7 * ev.f }); break;
    case 'beetleStop': audio.play('steel_on', { vol: 0.35, pitch: 0.6 }); popup(ev.x, ev.y + 0.6, 'Wound down', { color: '#d9e2ea', size: 14, life: 0.9 }); break;
    case 'beetleTurn': audio.play('steel_clang', { vol: 0.3, pitch: 1.5 }); break;
    case 'beetleBump': audio.play('steel_clang', { vol: 0.25, pitch: 1.8 }); break;
    case 'beetleCrush': audio.play('thorn_snap', { vol: 0.6, pitch: 0.9 }); popup(ev.x, ev.y + 0.6, 'Crunch!', { color: '#ffd36b', size: 16, life: 0.8 }); break;
    case 'beetleTip': audio.play('steel_clang', { vol: 0.5 }); popup(ev.x, ev.y + 0.5, 'Tipped over!', { color: '#bff0a0', size: 16, life: 1 }); break;
    case 'jackPop': audio.play('egg_bump', { vol: 0.7, pitch: 1.6 }); audio.play('release', { vol: 0.4, pitch: 1.3 }); popup(ev.x, ev.y + 0.9, 'Boing!', { color: '#ffd23a', size: 18, life: 0.8 }); once('cwJack', 'A spring jack! It bounces an egg back up. Time it to launch an egg across a gap. An iron egg jams it shut.', 4.4); break;
    case 'jackJam': audio.play('steel_clang', { vol: 0.7, pitch: 0.8 }); popup(ev.x, ev.y + 0.6, 'Jammed!', { color: '#bff0a0', size: 16, life: 1 }); break;
    case 'jackFree': audio.play('unlock', { vol: 0.35, pitch: 1.4 }); break;
  }
}
export { SPIDER };
