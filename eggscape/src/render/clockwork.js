// The clockwork cast of the Shape Lab (v4, sim/clockwork.js): the clockwork spider and its webs, the wind-up beetle and the
// spring jack. Crisp cel-shaded code art in the house style: a dark ink outline, a base colour with one shade band and one
// light band, no pale halos. Each creature is drawn in a local y-DOWN pixel space (pxSpace) at real scale (k px per metre),
// so it can also go through render/status.js for the shared FROZEN and STUNNED looks.
import { RING_TH, TAU } from '../sim/geom.js';
import { ringPt, ringSpd } from '../sim/shapes.js';
import { SPIDER, BEETLE, JACK } from '../sim/clockwork.js';
import { statusClock, statusDraw, dizzyStars, spiralEye } from './status.js';

const INK = '#1a120a';
const BRASS = { base: '#c8963e', light: '#f2cf7c', dark: '#7a5220' };
const STEEL = { base: '#56657a', light: '#8ea3bf', dark: '#2b3443' };
// the cast's own colours: a dark gunmetal body (it stands off the brass rings) with one bright accent each
const GUN = { base: '#3b4351', light: '#6d7b92', dark: '#1a1e26' };
const PEWTER = { base: '#617089', light: '#97a8c2', dark: '#2e3645' }; // lighter than gunmetal: the beetle's shell must also stand off the navy
const TEALK = { base: '#22b8b0', light: '#7fe6dc', dark: '#0f6660' };
const LW = (s) => Math.max(1.7, s * 0.024); // a heavy ink outline, so they read at phone scale
// art scale (the rigs are drawn in metres at 1): the sim's BEETLE.len is 0.62 * BS, JACK.w 0.44 * JS
const SS = 2.4, BS = BEETLE.len / 0.62, JS = JACK.w / 0.44;
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
// origin = the body's centre, local -y points up its thread. o: { legs (gait phase), spin (0..1 working the web), eye }
export function drawSpiderArt(c, s, t, o = {}) {
  const lw = LW(s), sp = o.spin || 0, slack = o.slack || 0;
  c.lineJoin = 'round'; c.lineCap = 'round';
  // legs: four a side, two joints each, steel with brass knees
  for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) {
    const ph = (o.legs || 0) * 9 + i * 1.7 + (sd > 0 ? 0.8 : 0), sw = Math.sin(ph) * (0.035 + sp * 0.05), dr = slack * 0.08;
    const hx = sd * 0.06 * s, hy = (-0.05 + i * 0.05) * s;
    const kx = sd * (0.2 + i * 0.012) * s, ky = (-0.16 + i * 0.09 + sw + dr) * s;
    const fx = sd * (0.27 - Math.abs(i - 1.5) * 0.02) * s, fy = (-0.02 + i * 0.1 + sw * 1.4 + dr * 2.5) * s;
    c.strokeStyle = INK; c.lineWidth = lw * 3.1; c.beginPath(); c.moveTo(hx, hy); c.lineTo(kx, ky); c.lineTo(fx, fy); c.stroke();
    c.strokeStyle = STEEL.light; c.lineWidth = lw * 1.4; c.stroke();
    c.beginPath(); c.arc(kx, ky, lw * 1.5, 0, TAU); c.fillStyle = TEALK.base; c.fill(); c.lineWidth = lw * 0.8; c.strokeStyle = INK; c.stroke();
  }
  // abdomen (up the thread) with brass bands and a wind-up key, the head below it
  key(c, 0, -0.2 * s, s, (o.legs || 0) * 2, lw);
  cel(c, (c) => E(c, 0, -0.06 * s, 0.13 * s, 0.15 * s), GUN, lw);
  c.save(); ell(c, 0, -0.06 * s, 0.13 * s, 0.15 * s); c.clip();
  c.strokeStyle = TEALK.base; c.lineWidth = 0.03 * s;
  for (const y of [-0.12, -0.03]) { c.beginPath(); c.moveTo(-0.15 * s, y * s); c.quadraticCurveTo(0, (y + 0.035) * s, 0.15 * s, y * s); c.stroke(); }
  c.restore();
  ell(c, 0, -0.06 * s, 0.13 * s, 0.15 * s); c.lineWidth = lw; c.strokeStyle = INK; c.stroke();
  cel(c, (c) => E(c, 0, 0.12 * s, 0.085 * s, 0.075 * s), GUN, lw);
  // fangs and two lens eyes (glowing red while it works a web)
  c.strokeStyle = INK; c.lineWidth = lw * 1.4;
  for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(sd * 0.03 * s, 0.18 * s); c.quadraticCurveTo(sd * 0.045 * s, 0.22 * s, sd * 0.02 * s, 0.235 * s); c.stroke(); }
  for (const sd of [-1, 1]) {
    const ex = sd * 0.04 * s, ey = 0.13 * s, r = 0.034 * s;
    c.beginPath(); c.arc(ex, ey, r, 0, TAU); c.fillStyle = INK; c.fill();
    if (o.eye === 'spiral') spiralEye(c, ex, ey, r * 0.9, t, sd, '#ffd0a0');
    else { c.beginPath(); c.arc(ex, ey, r * 0.62, 0, TAU); c.fillStyle = sp > 0 || o.eye === 'hot' ? '#ff7a3a' : '#ff3b2a'; c.fill(); c.beginPath(); c.arc(ex - r * 0.25, ey - r * 0.3, r * 0.22, 0, TAU); c.fillStyle = '#fff4d8'; c.fill(); }
  }
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
  const n = Math.ceil(clamp01(W.k) * anchors.length);
  const strand = (fn, w) => { ctx.beginPath(); fn(); ctx.lineWidth = w * 2.4; ctx.strokeStyle = 'rgba(16,14,20,0.85)'; ctx.stroke(); ctx.lineWidth = w; ctx.strokeStyle = '#d9e2ea'; ctx.stroke(); };
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (ending) ctx.globalAlpha = 1 - ending * 0.5;
  strand(() => { for (let i = 0; i < n; i++) { ctx.moveTo(...hub); ctx.lineTo(...anchors[order[i]]); } }, Math.max(1.3 * px, 0.012));
  if (W.k > 0.55) for (const f of [0.45, 0.8]) strand(() => order.forEach((j, i) => { const a = anchors[j], x = hub[0] + (a[0] - hub[0]) * f, y = hub[1] + (a[1] - hub[1]) * f; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }), Math.max(1.0 * px, 0.01));
  // dew-drop rivets where the threads meet the brass
  ctx.fillStyle = '#cfd8e2';
  for (let i = 0; i < n; i++) { const a = anchors[order[i]]; ctx.beginPath(); ctx.arc(a[0], a[1], 1.4 * px, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// ---------------------------------------------------------------- the wind-up beetle
// origin = between its feet on the floor, local +x forward, -y up. o: { walk (gait distance m), key (turn), lamp, tip, slack }
export function drawBeetleArt(c, s, t, o = {}) {
  const lw = LW(s);
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.save();
  if (o.tip) { c.translate(0, -0.15 * s); c.rotate(Math.PI); c.translate(0, 0.15 * s); }
  const g = (o.walk || 0) * 22, sag = (o.slack || 0) * 0.02 * s;
  // legs: three a side, stiff tin legs that step in turn (the far side darker)
  for (const far of [1, 0]) for (let i = 0; i < 3; i++) {
    const ph = g + i * 2.1 + far * Math.PI, lift = Math.max(0, Math.sin(ph)) * 0.035 * s, x0 = (-0.15 + i * 0.13) * s, sw = Math.cos(ph) * 0.035 * s;
    c.strokeStyle = INK; c.lineWidth = lw * 2.8; c.beginPath(); c.moveTo(x0, -0.07 * s); c.lineTo(x0 + sw + (o.tip ? Math.sin(t * 20 + i) * 0.04 * s : 0), -lift); c.stroke();
    c.strokeStyle = far ? '#3a2a24' : '#5c4a40'; c.lineWidth = lw * 1.3; c.stroke();
  }
  // plough: a steel scoop low at the front
  const plough = (c) => { c.moveTo(0.2 * s, -0.04 * s); c.lineTo(0.33 * s, -0.005 * s); c.quadraticCurveTo(0.37 * s, -0.08 * s, 0.31 * s, -0.15 * s); c.lineTo(0.22 * s, -0.12 * s); c.closePath(); };
  cel(c, plough, STEEL, lw, false);
  // shell: a red tin dome with a cream stripe and rivets, a dark skirt
  const shell = (c) => { c.moveTo(-0.31 * s, -0.06 * s + sag); c.bezierCurveTo(-0.3 * s, -0.33 * s + sag, 0.18 * s, -0.36 * s + sag, 0.24 * s, -0.08 * s + sag); c.closePath(); };
  c.fillStyle = '#2a1c18'; c.beginPath(); c.roundRect(-0.3 * s, -0.09 * s + sag, 0.55 * s, 0.05 * s, 0.02 * s); c.fill(); c.lineWidth = lw; c.strokeStyle = INK; c.stroke();
  cel(c, shell, PEWTER, lw);
  c.save(); c.beginPath(); shell(c); c.clip();
  c.strokeStyle = '#ec4a34'; c.lineWidth = 0.07 * s; c.beginPath(); c.moveTo(-0.33 * s, -0.12 * s + sag); c.bezierCurveTo(-0.2 * s, -0.27 * s + sag, 0.1 * s, -0.29 * s + sag, 0.27 * s, -0.14 * s + sag); c.stroke();
  c.fillStyle = BRASS.light; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc((-0.2 + i * 0.12) * s, (-0.1 - (i === 1 || i === 2 ? 0.02 : 0)) * s + sag, 0.016 * s, 0, TAU); c.fill(); }
  c.restore();
  c.beginPath(); shell(c); c.lineWidth = lw; c.strokeStyle = INK; c.stroke();
  // head with a headlamp eye, antennae
  cel(c, (c) => E(c, 0.24 * s, -0.12 * s + sag, 0.075 * s, 0.065 * s), { base: '#3a3036', light: '#6a5a62', dark: '#1a1418' }, lw);
  c.strokeStyle = INK; c.lineWidth = lw * 1.2;
  for (const d of [0, 0.03]) { c.beginPath(); c.moveTo(0.26 * s, -0.17 * s + sag); c.quadraticCurveTo((0.3 + d) * s, -0.27 * s, (0.36 + d) * s, -0.26 * s + d * s); c.stroke(); c.beginPath(); c.arc((0.36 + d) * s, -0.26 * s + d * s, 0.014 * s, 0, TAU); c.fillStyle = BRASS.base; c.fill(); c.stroke(); }
  const ex = 0.27 * s, ey = -0.125 * s + sag, er = 0.03 * s;
  c.beginPath(); c.arc(ex, ey, er, 0, TAU); c.fillStyle = INK; c.fill();
  if (o.eye === 'spiral') spiralEye(c, ex, ey, er, t, 1, '#ffe0a0');
  else if (o.eye === 'off') { c.beginPath(); c.moveTo(ex - er * 0.7, ey); c.lineTo(ex + er * 0.7, ey); c.strokeStyle = '#ffcf6a'; c.lineWidth = lw; c.stroke(); }
  else { c.beginPath(); c.arc(ex, ey, er * 0.65, 0, TAU); c.fillStyle = o.lamp ? '#ffe36a' : '#d9a040'; c.fill(); c.beginPath(); c.arc(ex + er * 0.2, ey - er * 0.25, er * 0.22, 0, TAU); c.fillStyle = '#fffbe8'; c.fill(); }
  // the key on its back
  key(c, -0.06 * s, -0.29 * s + sag, s, o.key || 0, lw, -1, TEALK);
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
  cel(c, (c) => { c.roundRect(-W / 2, top, W, H + 0.04 * s, 0.025 * s); }, TEAL, lw);
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
    const q = sim.cwBeetlePose(B), st = statusClock(sim, 'cb' + B.id, want(B.ice, B.stun), t), M = sim.cwMode || 'medium';
    const walking = B.ph === 'walk' && !(B.ice > 0) && !(B.stun > 0);
    const walk = (B.la * sim.rings[B.fi].r) * B.dir;
    const o = { walk: walking ? walk : 0, key: walking ? t * 3 * (B.wind / BEETLE.wind[M] + 0.3) : B.ph === 'click' ? t * 14 : 0.4, lamp: walking || B.ph === 'click', tip: B.ph === 'tip', eye: B.stun > 0 ? 'spiral' : B.ph === 'stop' ? 'off' : '', slack: B.ph === 'stop' ? 1 : 0 };
    pxSpace(ctx, q.x, q.y, k, () => {
      ctx.rotate(-q.a);
      if (B.dir < 0) ctx.scale(-1, 1);
      if (B.ph === 'click' && !(B.ice > 0)) ctx.translate(Math.sin(t * 60) * 0.006 * k, 0);
      const z = BS * k;
      statusDraw(ctx, { x0: -0.4 * z, y0: -0.45 * z, x1: 0.45 * z, y1: 0.05 * z }, (c) => drawBeetleArt(c, z, st ? st.hold : t, o), st, { quick: true });
      if (st && st.k === 'stun') dizzyStars(ctx, 0.05 * z, -0.42 * z, 0.16 * z, 0.05 * z, t, { size: Math.max(2.6, 0.045 * z) });
    });
  }
  for (const S of C.sp) {
    if (S.ph === 'flung') continue;
    const q = sim.cwSpider(S);
    if (!q) continue;
    const st = statusClock(sim, 'cs' + S.id, want(S.ice, S.stun), t), dx = q.x - q.ax, dy = q.y - q.ay, len = Math.hypot(dx, dy);
    // the thread
    if (len > 0.05) {
      ctx.save(); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(q.ax, q.ay); ctx.lineTo(q.x, q.y);
      ctx.lineWidth = 2.4 / k; ctx.strokeStyle = 'rgba(16,14,20,0.8)'; ctx.stroke();
      ctx.lineWidth = 1.1 / k; ctx.strokeStyle = '#d9e2ea'; ctx.stroke();
      ctx.restore();
    }
    // it hangs head-down toward the gap (its local +y), legs paddling while it winds down
    const ang = len > 0.05 ? Math.atan2(dy, dx) : q.gu + Math.PI;
    const o = { legs: S.ph === 'down' || S.ph === 'up' ? t : t * 0.15, spin: S.ph === 'spin' ? 1 : 0, eye: S.stun > 0 ? 'spiral' : S.ph === 'down' ? 'hot' : '', slack: S.stun > 0 ? 1 : 0 };
    pxSpace(ctx, q.x, q.y, k, () => {
      ctx.rotate(-ang - Math.PI / 2 + (S.stun > 0 ? Math.sin(t * 2.2) * 0.25 : 0)); // head (local +y) toward the gap
      const z = SS * k;
      statusDraw(ctx, { x0: -0.36 * z, y0: -0.32 * z, x1: 0.36 * z, y1: 0.34 * z }, (c) => drawSpiderArt(c, z, st ? st.hold : t, o), st, { quick: true });
      if (st && st.k === 'stun') dizzyStars(ctx, 0, -0.3 * z, 0.13 * z, 0.04 * z, t, { size: Math.max(2.6, 0.04 * z) });
    });
  }
}

// the spider's telegraph: a dashed ring of the web to come on the gap it is winding down to
export function drawClockworkTele(ctx, sim, t, k) {
  const C = sim.cw;
  if (!C) return;
  for (const S of C.sp) {
    if (S.ph !== 'down') continue;
    const q = sim.cwSpider(S);
    if (!q) continue;
    const u = clamp01(1 - S.t / S.dur), a = 0.45 + 0.4 * Math.sin(t * 10);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.setLineDash([5 / k, 4 / k]);
    ctx.lineWidth = 2.2 / k; ctx.strokeStyle = '#ff6a3a';
    ctx.beginPath(); ctx.arc(q.gx, q.gy, 0.3 + 0.12 * (1 - u), 0, TAU); ctx.stroke();
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
    const z = h * 1.2;
    c.lineCap = 'round'; c.beginPath(); c.moveTo(cx, y); c.lineTo(cx, y + h * 0.4);
    c.lineWidth = 2.4; c.strokeStyle = 'rgba(16,14,20,0.8)'; c.stroke(); c.lineWidth = 1.1; c.strokeStyle = '#d9e2ea'; c.stroke();
    c.translate(cx, y + h * 0.58);
    drawSpiderArt(c, z, t, { legs: t * 0.3 });
  } else if (kind === 'beetle') {
    const z = h * 1.55;
    floor(y + h * 0.92, z * 0.7);
    c.translate(cx + Math.sin(t * 0.8) * h * 0.25, y + h * 0.92);
    if (Math.cos(t * 0.8) < 0) c.scale(-1, 1);
    drawBeetleArt(c, z, t, { walk: t * 0.5, key: t * 3, lamp: true });
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
    case 'spiderDown': audio.play('motor_tick', { vol: 0.5, pitch: 1.6 }); once('cwSpider', 'A clockwork spider! It winds down to a gap and webs it shut. The web catches eggs softly. Fire, iron or the laser tears it.', 4.6); break;
    case 'webUp': audio.play('squish', { vol: 0.35, pitch: 1.8 }); popup(ev.x, ev.y + 0.5, 'Webbed!', { color: '#d9e2ea', size: 16, life: 0.9 }); break;
    case 'webCatch': audio.play('bubble_on', { vol: 0.4, pitch: 0.8 }); popup(ev.x, ev.y + 0.5, 'Caught!', { color: '#bff0a0', size: 16, life: 0.9 }); break;
    case 'webTear': audio.play('thorn_snap', { vol: 0.6, pitch: 1.5 }); fx.sparkle(ev.x, ev.y, 8, '#e6eef5'); popup(ev.x, ev.y + 0.5, 'Torn!', { color: '#ffd36b', size: 16, life: 0.9 }); break;
    case 'webGone': audio.play('release', { vol: 0.3 }); break;
    case 'spiderFlung': audio.play('wind_gust', { vol: 0.5, pitch: 1.6 }); popup(ev.x, ev.y + 0.5, 'Flung off!', { color: '#bff0a0', size: 16, life: 1 }); break;
    case 'beetleWind': audio.play('motor_tick', { vol: 0.55, pitch: 1.2 }); once('cwBeetle', 'A wind-up beetle! It shoves eggs along the floor until its key runs down. Stopped, it is a wall. Turning its ring winds it up again.', 4.6); break;
    case 'beetleStop': audio.play('steel_on', { vol: 0.35, pitch: 0.7 }); break;
    case 'beetleTurn': audio.play('steel_clang', { vol: 0.3, pitch: 1.5 }); break;
    case 'beetleTip': audio.play('steel_clang', { vol: 0.5 }); popup(ev.x, ev.y + 0.5, 'Tipped over!', { color: '#bff0a0', size: 16, life: 1 }); break;
    case 'jackPop': audio.play('egg_bump', { vol: 0.7, pitch: 1.6 }); audio.play('release', { vol: 0.4, pitch: 1.3 }); popup(ev.x, ev.y + 0.9, 'Boing!', { color: '#ffd23a', size: 18, life: 0.8 }); once('cwJack', 'A spring jack! It bounces an egg back up. Time it to launch an egg across a gap. An iron egg jams it shut.', 4.4); break;
    case 'jackJam': audio.play('steel_clang', { vol: 0.7, pitch: 0.8 }); popup(ev.x, ev.y + 0.6, 'Jammed!', { color: '#bff0a0', size: 16, life: 1 }); break;
    case 'jackFree': audio.play('unlock', { vol: 0.35, pitch: 1.4 }); break;
  }
}
export { SPIDER };
