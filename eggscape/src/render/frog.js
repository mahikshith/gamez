// The frog (v3.3 M8, redrawn v3.5): crisp cel-shaded code art in the crawler family's style (dark outline, base + one hard
// shadow + one hard highlight, no light rim), seen from the side. A plump squat frog with big glossy eyes on top of the head,
// a wide smile, folded back legs with toe pads and a pale belly. It hops through gaps, plugs them, and snatches orbs and
// chicks with a thick, sticky tongue.
//
// drawFrog(ctx, x, y, s, t, o): feet point at (x, y) px (y down), s = body width px (the sim's FROG.w m * FROG_ART),
// the frog faces +x and "up" is -y (the game rotates it onto the ring surface, see drawFrogs). o (all optional):
//   face  +1 | -1 (mirror)           crouch 0..1 (coiled, ready to hop)   stretch 0..1 (airborne, legs trailing)
//   squash -0.3..1 (landing)         puff 0..1 (throat sac)               blink 0..1   gulp 0..1 (swallow progress, -1 off)
//   mouth 0..1 (open)                lick -1 | 0..1 (lip-lick progress)   tongue {x, y} tip in art units, or null
//   tout 1 | 0 (tongue going out | coming back)    prey(ctx, ux, uy) draws what the tip carries
//   scared 0..1 (wide eyes, sweat)   plug 0..1 (sitting in a gap: flat, belly through the opening)
//   look {x, y} pupils -1..1         lean rad (nose up/down)              shake px-ish wobble   um art units per metre
// States drawn into the frog's own art (the shared creature-state look):
//   frozen 0..1 (ice shell grows in)  crack 0..1 (hairline cracks, shiver)   shards [{x,y,a,s,al}] (thaw pieces)
//   stun 0..1 (slack, spiral eyes, loose tongue, three stars)      zap 0..1 (jagged arcs and a flash, fades out)
// In game: drawFrogs() reads the sim (sim/frog.js) and derives every channel from the frog's phase and timers.
import { TAU } from '../sim/geom.js';
import { FROG, FROG_MODE } from '../sim/frog.js';
import { drawOrb } from './powers.js';
import { drawKindChick } from './chicks.js';
import { drawChick } from './characters.js';
import { RING_MAT_BASE } from './world.js';

export const FROG_ART = 1.12; // 100 art units = FROG.w * FROG_ART metres (the body that collides is a bit narrower)
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
const lerp = (a, b, k) => a + (b - a) * k;
const mod = (a, b) => ((a % b) + b) % b;
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// Two skins, picked by contrast like thornLook(): a green tree frog on brown, dark, blue, red worlds; a golden-orange frog with
// dark spots and black eyes where the rings or the backdrop are green (bramble, jungle, vines), so it never melts into them.
const LINE0 = '#0b2012';
let LINE = LINE0; // the skin's outline (set per draw)
const COMMON = { pupil: '#0b1509', mouth: '#5e1426', tongue: '#ec4d70', tongueLo: '#bd2f55', tongueHi: '#ff9db4', sweat: '#a8e4ff', blush: 'rgba(255,112,136,0.55)' };
const SKINS = {
  tree: { ...COMMON, base: '#62c94a', shade: '#3d9a42', deep: '#2a6e35', hi: '#b4f07c', belly: '#f4f8c4', bellyLo: '#d3e594', spot: '#2f7d37', flank: '#f7a63a', eye: '#ffd23a', eyeLo: '#e8961a', pad: '#f3ffb0' },
  gold: { ...COMMON, line: '#2a0f06', base: '#ffb02e', shade: '#e8761a', deep: '#b04a10', hi: '#ffe28a', belly: '#fff3d0', bellyLo: '#f0d49a', spot: '#4a1c08', flank: '#8a3010', eye: '#4a2410', eyeLo: '#2a1408', pupil: '#070302', pad: '#fff0b8' },
};
// frozen: the skin's own colours pulled 55% toward ice
const ICE = '#bfe6ff', RIM = '#2f6f9e', ICE_LINE = '#16364f';
const hexRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return [0.5, 0.5, 0.5]; const n = parseInt(m[1], 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const mix = (a, b, k) => { const p = hexRgb(a), q = hexRgb(b); return '#' + [0, 1, 2].map((i) => Math.round((p[i] + (q[i] - p[i]) * k) * 255).toString(16).padStart(2, '0')).join(''); };
const ICED = {};
const iced = (name) => ICED[name] || (ICED[name] = Object.fromEntries(Object.entries(SKINS[name]).map(([k, v]) => [k, /^#[0-9a-f]{6}$/i.test(v) ? mix(v, ICE, 0.55) : v])));
let C = SKINS.tree;
const greenish = (h) => { const [r, g, b] = hexRgb(h); return g > r * 1.04 && g > b * 1.04 && g > 0.18; };
const LOOK = new Map();
export function frogSkin(theme, mat) {
  const key = (theme?.id || '') + '|' + (mat || '');
  let L = LOOK.get(key);
  if (L) return L;
  const P = theme?.palette || {}, ring = RING_MAT_BASE[mat] || P.ring?.base || '#8f8a83';
  L = greenish(ring) || (greenish(P.skyTop) && greenish(P.skyBottom)) ? 'gold' : 'tree';
  LOOK.set(key, L);
  return L;
}

// ---- joints (art units, y down, ground at y = 0, nose at +x): hip, knee, ankle, toe base. The pose blends rest / crouch / air.
const HIND = {
  rest: [[-27, -19], [-5, -12], [-31, -5], [-4, -2]],
  crouch: [[-28, -15], [-4, -10], [-33, -4], [-8, -2]],
  air: [[-26, -17], [-44, -14], [-60, -8], [-72, -4]],
};
const FORE = {
  rest: [[20, -17], [24, -9], [26, -2], [33, 0]],
  crouch: [[20, -12], [28, -7], [28, -2], [35, 0]],
  air: [[20, -17], [32, -19], [43, -17], [51, -13]],
};
const blendJ = (P, wc, wa) => P.rest.map((r, i) => [r[0] + (P.crouch[i][0] - r[0]) * wc + (P.air[i][0] - r[0]) * wa, r[1] + (P.crouch[i][1] - r[1]) * wc + (P.air[i][1] - r[1]) * wa]);
const MOUTH = [42, -14]; // where the tongue starts inside the mouth
export const FROG_MOUTH = { x: 56, y: -15 }; // where it leaves the lips (art units)

function blinkAt(t, seed = 0) {
  const p = mod(t + seed * 1.7, 3.3 + seed * 0.6);
  return p < 0.18 ? Math.sin((p / 0.18) * Math.PI) : 0;
}
// a tapered capsule (circle ra at a, circle rb at b) as a path
function capPath(ctx, a, b, ra, rb) {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  ctx.beginPath();
  ctx.arc(a[0], a[1], ra, ang + Math.PI / 2, ang + Math.PI * 1.5);
  ctx.arc(b[0], b[1], rb, ang - Math.PI / 2, ang + Math.PI / 2);
  ctx.closePath();
}
// a plump limb piece: hard shadow crescent below, one hard highlight stripe above, dark outline
function plump(ctx, a, b, ra, rb, o, fill, shade, hi) {
  capPath(ctx, a, b, ra, rb);
  ctx.fillStyle = shade; ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.translate(-0.7, -Math.max(ra, rb) * 0.36);
  capPath(ctx, a, b, ra, rb);
  ctx.fillStyle = fill; ctx.fill();
  ctx.restore();
  if (hi) {
    const n = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = (b[1] - a[1]) / n, ny = -(b[0] - a[0]) / n; // up-side normal
    ctx.beginPath();
    ctx.moveTo(lerp(a[0], b[0], 0.22) + nx * ra * 0.5, lerp(a[1], b[1], 0.22) + ny * ra * 0.5);
    ctx.lineTo(lerp(a[0], b[0], 0.7) + nx * rb * 0.5, lerp(a[1], b[1], 0.7) + ny * rb * 0.5);
    ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1.6, Math.min(ra, rb) * 0.34); ctx.strokeStyle = hi; ctx.stroke();
  }
  capPath(ctx, a, b, ra, rb);
  ctx.lineWidth = o; ctx.strokeStyle = LINE; ctx.stroke();
}
function disc(ctx, x, y, r, o, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = o; ctx.strokeStyle = LINE; ctx.stroke(); }
// splayed toes ending in round pads (the tree frog's sticky fingertips)
function toes(ctx, wx, wy, n, len, w, pr, o, spread = 0.36) {
  for (let i = 0; i < n; i++) {
    const a = (i - (n - 1) / 2) * spread, tx = wx + Math.cos(a) * len, ty = wy + Math.sin(a) * len * 0.55;
    ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(tx, ty);
    ctx.lineCap = 'round'; ctx.lineWidth = w + o * 2; ctx.strokeStyle = LINE; ctx.stroke();
    ctx.lineWidth = w; ctx.strokeStyle = C.base; ctx.stroke();
  }
  for (let i = 0; i < n; i++) { const a = (i - (n - 1) / 2) * spread; disc(ctx, wx + Math.cos(a) * len, wy + Math.sin(a) * len * 0.55, pr, o * 0.8, C.pad); }
}
function star(ctx, x, y, r, rot, o, fill) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = rot + (i / 10) * TAU - Math.PI / 2, d = i % 2 ? r * 0.46 : r; i ? ctx.lineTo(x + d * Math.cos(a), y + d * Math.sin(a)) : ctx.moveTo(x + d * Math.cos(a), y + d * Math.sin(a)); }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = o * 0.8; ctx.strokeStyle = LINE; ctx.lineJoin = 'round'; ctx.stroke();
}

// The tongue: thick, tapering, curved a little, with a sticky bulb at the tip that holds the prey.
// root/tip in art units. bend = sideways bow as a share of its length (+ bows up). prey(ctx, ux, uy) draws the catch.
function tongue(ctx, root, tp, o, bend, w0, w1, tipR, prey) {
  const dx = tp.x - root[0], dy = tp.y - root[1], len = Math.hypot(dx, dy) || 1, nx = dy / len, ny = -dx / len;
  const cx = (root[0] + tp.x) / 2 + nx * bend * len, cy = (root[1] + tp.y) / 2 + ny * bend * len;
  const N = 16, pts = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
    const x = a * root[0] + b * cx + c * tp.x, y = a * root[1] + b * cy + c * tp.y;
    const tx = 2 * (1 - u) * (cx - root[0]) + 2 * u * (tp.x - cx), ty = 2 * (1 - u) * (cy - root[1]) + 2 * u * (tp.y - cy), l = Math.hypot(tx, ty) || 1;
    pts.push({ x, y, nx: ty / l, ny: -tx / l, h: lerp(w0, w1, Math.pow(u, 0.85)) / 2 });
  }
  const shaft = () => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x + p.nx * p.h, p.y + p.ny * p.h) : ctx.moveTo(p.x + p.nx * p.h, p.y + p.ny * p.h))); for (let i = N; i >= 0; i--) ctx.lineTo(pts[i].x - pts[i].nx * pts[i].h, pts[i].y - pts[i].ny * pts[i].h); ctx.closePath(); };
  const band = (off, wf, from, to) => { ctx.beginPath(); for (let i = from; i <= to; i++) { const p = pts[i]; i === from ? ctx.moveTo(p.x + p.nx * p.h * off, p.y + p.ny * p.h * off) : ctx.lineTo(p.x + p.nx * p.h * off, p.y + p.ny * p.h * off); } ctx.lineCap = 'round'; ctx.lineWidth = lerp(w0, w1, 0.4) * wf; };
  shaft(); ctx.fillStyle = C.tongueLo; ctx.fill();
  ctx.save(); ctx.clip();
  band(0.35, 0.78, 0, N); ctx.strokeStyle = C.tongue; ctx.stroke(); // the lit upper side; the lower rim stays darker
  band(0.5, 0.2, 2, N - 3); ctx.strokeStyle = C.tongueHi; ctx.stroke();
  ctx.restore();
  shaft(); ctx.lineWidth = o; ctx.strokeStyle = LINE; ctx.lineJoin = 'round'; ctx.stroke();
  const ux = dx / len, uy = dy / len;
  if (prey) prey(ctx, ux, uy);
  // the sticky bulb
  const bx = tp.x, by = tp.y;
  ctx.beginPath(); ctx.arc(bx, by, tipR, 0, TAU); ctx.fillStyle = C.tongueLo; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.beginPath(); ctx.arc(bx - tipR * 0.2, by - tipR * 0.24, tipR, 0, TAU); ctx.fillStyle = C.tongue; ctx.fill();
  ctx.restore();
  ctx.beginPath(); ctx.arc(bx, by, tipR, 0, TAU); ctx.lineWidth = o; ctx.strokeStyle = LINE; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(bx - tipR * 0.32, by - tipR * 0.36, tipR * 0.3, tipR * 0.2, -0.6, 0, TAU); ctx.fillStyle = C.tongueHi; ctx.fill();
}

export function drawFrog(ctx, x, y, s, t = 0, op = {}) {
  if (!(s > 0)) return;
  if (!op.inner && (op.frozen > 0 || op.zap > 0) && typeof document !== 'undefined') { drawFrogShell(ctx, x, y, s, t, op); return; }
  const face = op.face === -1 ? -1 : 1, crouch = clamp(op.crouch || 0, 0, 1), st = clamp(op.stretch || 0, 0, 1);
  const stun = clamp(op.stun || 0, 0, 1), q = (op.squash || 0) + 0.3 * stun;
  const plug = clamp(op.plug || 0, 0, 1), puff = clamp(op.puff || 0, 0, 1), scared = clamp(op.scared || 0, 0, 1);
  const mouth = clamp(Math.max(op.mouth || 0, 0.5 * stun), 0, 1), gulp = op.gulp == null ? -1 : op.gulp, lick = op.lick == null ? -1 : op.lick;
  const look = op.look || { x: 0.3, y: 0 }, tip = op.tongue || null;
  const U = s / 100, o = clamp(1.9 / U, 2.8, 7);
  const skinName = SKINS[op.skin] ? op.skin : 'tree', ice = op.tint === 'ice';
  C = ice ? iced(skinName) : SKINS[skinName];
  LINE = ice ? ICE_LINE : C.line || LINE0;
  ctx.save();
  try {
    ctx.translate(x, y);
    ctx.scale(U * face, U);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const idle = Math.sin(t * 2.4 + (op.id || 0));
    // ground shadow (not in a gap: there the ring is under it)
    if (plug < 0.5 && !op.inner) { ctx.fillStyle = `rgba(10,30,14,${0.28 * (1 - st) * (1 - plug * 2)})`; ctx.beginPath(); ctx.ellipse(-2, 1.5, 48 + 6 * q, 5, 0, 0, TAU); ctx.fill(); }
    // global pose: tilt (nose up/down), then squash and stretch about the ground / the body's middle
    const slack = stun * Math.sin(t * 2.1 + (op.id || 0));
    ctx.translate(0, -17 * st);
    ctx.rotate((op.lean || 0) + stun * (0.1 + 0.05 * slack));
    ctx.translate(op.shake ? Math.sin(t * 52) * op.shake : 0, 0);
    ctx.translate(0, 17 * st);
    const sy = (1 - 0.15 * crouch - 0.1 * plug - 0.26 * q + 0.02 * stun * slack) * (1 + 0.012 * idle * (1 - stun)) * (1 - 0.1 * st), sx = (1 + 0.07 * crouch + 0.05 * plug + 0.2 * q) * (1 + 0.1 * st);
    ctx.translate(0, -17 * st); ctx.scale(sx, sy); ctx.translate(0, 17 * st);
    // far stars of the stun circle pass behind the head
    const stars = (back) => {
      if (!(stun > 0.05)) return;
      for (let i = 0; i < 3; i++) {
        const th = t * 3.4 + (i / 3) * TAU, d = Math.sin(th);
        if ((d < 0) !== back) continue;
        const sx2 = 30 + Math.cos(th) * 36, sy2 = -68 - Math.cos(th) * 6 + d * 9, r = 10 + 2 * d;
        ctx.globalAlpha = stun;
        star(ctx, sx2, sy2, r, t * 2 + i, o, '#ffe14a');
        ctx.globalAlpha = 1;
      }
    };
    stars(true);
    if (plug > 0) { // the belly hangs through the opening
      ctx.save(); ctx.globalAlpha = plug; ctx.beginPath(); ctx.ellipse(-3, -2, 42, 13, 0, 0, TAU); ctx.fillStyle = C.bellyLo; ctx.fill(); ctx.lineWidth = o; ctx.strokeStyle = LINE; ctx.stroke(); ctx.restore();
    }
    const wa = st, wc = clamp(crouch + 0.55 * plug, 0, 1) * (1 - st);
    const H = blendJ(HIND, wc, wa), F = blendJ(FORE, wc * 0.8, wa);

    // eyes: big, glossy, on top of the head. The far one sits behind the near one, a size smaller.
    const lid = Math.max(op.blink || 0, gulp >= 0 ? sstep((gulp - 0.05) / 0.2) * (1 - sstep((gulp - 0.7) / 0.25)) : 0);
    const eyeSink = gulp >= 0 ? 5 * Math.sin(Math.PI * clamp(gulp, 0, 1)) : 0, bulge = 1 + 0.16 * scared;
    const eyeAt = (ex, ey, er, far) => {
      ey += eyeSink;
      const R = er * bulge;
      ctx.beginPath(); ctx.ellipse(ex, ey + er * 0.62, er * 1.12, er * 0.55, 0, 0, TAU); ctx.fillStyle = far ? C.shade : C.base; ctx.fill(); // the socket bump the eye pops out of
      ctx.save();
      ctx.beginPath(); ctx.arc(ex, ey, R, 0, TAU);
      ctx.fillStyle = stun > 0.3 ? '#fffbe8' : far ? C.eyeLo : C.eye; ctx.fill();
      ctx.lineWidth = o; ctx.strokeStyle = LINE; ctx.stroke();
      ctx.clip();
      if (stun > 0.3) { // spiral eyes: a dark spiral, slowly turning
        ctx.beginPath();
        for (let a = 0; a < TAU * 2.2; a += 0.25) { const rr = (a / (TAU * 2.2)) * R * 0.82, aa = a - t * 3 * (far ? -1 : 1); a ? ctx.lineTo(ex + rr * Math.cos(aa), ey + rr * Math.sin(aa)) : ctx.moveTo(ex, ey); }
        ctx.lineWidth = Math.max(1.6, R * 0.2); ctx.strokeStyle = LINE; ctx.stroke();
      } else {
        // iris: the lower half a shade darker (a hard cel crescent), then a big round pupil that follows `look`
        if (!far) { ctx.fillStyle = C.eyeLo; ctx.beginPath(); ctx.arc(ex, ey + R * 0.28, R * 0.98, 0, Math.PI); ctx.fill(); ctx.beginPath(); ctx.arc(ex, ey, R, 0, TAU); ctx.fillStyle = C.eye; ctx.save(); ctx.clip(); ctx.beginPath(); ctx.arc(ex - R * 0.1, ey - R * 0.12, R * 0.98, 0, TAU); ctx.fill(); ctx.restore(); }
        const pr = R * (0.62 - 0.2 * scared), px = ex + look.x * R * 0.3, py = ey + look.y * R * 0.26;
        ctx.fillStyle = C.pupil; ctx.beginPath(); ctx.ellipse(px, py, pr * (far ? 0.85 : 1), pr * 0.96, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(px - pr * 0.36, py - pr * 0.4, pr * (far ? 0.26 : 0.34), 0, TAU); ctx.fill(); // the glossy glint
        if (!far) { ctx.beginPath(); ctx.arc(px + pr * 0.42, py + pr * 0.38, pr * 0.14, 0, TAU); ctx.fill(); }
      }
      // the eyelid slides down from the top (a blink, or shut for a gulp); the brow ridge always covers a bit
      const cover = clamp(0.1 - 0.1 * scared + lid * 0.95 + 0.3 * stun, 0, 1.1);
      ctx.fillStyle = far ? C.shade : C.base;
      ctx.fillRect(ex - R * 1.4, ey - R * 1.4, R * 2.8, R * (0.2 + cover * 1.8));
      ctx.fillStyle = far ? C.deep : C.shade;
      ctx.fillRect(ex - R * 1.4, ey - R * 1.4 + R * (0.2 + cover * 1.8) - 2.4, R * 2.8, 2.4);
      if (lid > 0.5 || stun > 0.3) { ctx.strokeStyle = LINE; ctx.lineWidth = o * 0.8; ctx.beginPath(); ctx.moveTo(ex - R * 0.9, ey + R * 0.05); ctx.quadraticCurveTo(ex, ey + R * 0.5, ex + R * 0.9, ey + R * 0.05); ctx.stroke(); }
      ctx.restore();
      ctx.beginPath(); ctx.arc(ex, ey, R, 0, TAU); ctx.lineWidth = o; ctx.strokeStyle = LINE; ctx.stroke();
    };
    eyeAt(44, -43, 9, true);

    const body = () => {
      ctx.beginPath();
      ctx.moveTo(-45, -3);
      ctx.bezierCurveTo(-55, -10, -51, -22, -38, -26);
      ctx.bezierCurveTo(-24, -30, -8, -36, 8, -40);
      ctx.bezierCurveTo(22, -43, 40, -42, 50, -34);
      ctx.bezierCurveTo(57, -28, 58, -18, 52, -12);
      ctx.bezierCurveTo(44, -6, 34, -3, 22, -2);
      ctx.bezierCurveTo(4, 0, -32, 1, -45, -3);
      ctx.closePath();
    };
    body();
    ctx.fillStyle = C.shade; ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = C.base; ctx.beginPath(); ctx.ellipse(8, -36, 64, 24, -0.3, 0, TAU); ctx.fill(); // lit back, the shadow stays underneath
    ctx.fillStyle = C.hi; ctx.beginPath(); ctx.ellipse(-6, -33, 24, 3, -0.3, 0, TAU); ctx.fill(); // highlight along the spine
    ctx.fillStyle = C.spot; // mottled spots
    for (const [px, py, pr] of [[-10, -29, 4.2], [0, -35, 3.4], [-40, -14, 3.2], [14, -37, 2.6], [-18, -22, 2.8]]) { ctx.beginPath(); ctx.ellipse(px, py, pr * 1.2, pr, 0.4, 0, TAU); ctx.fill(); }
    // pale belly and throat: one hard-edged scoop along the bottom
    ctx.beginPath(); ctx.moveTo(62, -13); ctx.bezierCurveTo(44, -11, 24, -13, 4, -11); ctx.bezierCurveTo(-18, -9, -34, -10, -52, -5); ctx.lineTo(-50, 8); ctx.lineTo(60, 8); ctx.closePath();
    ctx.fillStyle = C.belly; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-50, 1); ctx.bezierCurveTo(-20, -2, 20, -4, 60, -5); ctx.lineTo(60, 8); ctx.lineTo(-50, 8); ctx.closePath();
    ctx.fillStyle = C.bellyLo; ctx.fill();
    ctx.restore();
    body(); ctx.lineWidth = o; ctx.strokeStyle = LINE; ctx.stroke();
    // cheek blush and ear drum
    ctx.beginPath(); ctx.ellipse(22, -20, 5.6, 3.4, 0.1, 0, TAU); ctx.fillStyle = C.blush; ctx.fill();
    ctx.beginPath(); ctx.arc(7, -27, 5.6, 0, TAU); ctx.fillStyle = C.shade; ctx.fill(); ctx.lineWidth = o * 0.8; ctx.strokeStyle = LINE; ctx.stroke();
    ctx.beginPath(); ctx.arc(6.6, -27.4, 2.8, 0, TAU); ctx.fillStyle = C.base; ctx.fill();

    // hind leg, folded at the side: a big plump thigh over the flank, the shin laid back, a long foot with toe pads
    const [hh, hk, ha, ht] = H;
    plump(ctx, ha, ht, 5.2, 4.4, o, C.base, C.shade, null); // the foot, lying along the ground
    toes(ctx, ht[0], ht[1], 4, 11, 4.4, 3.6, o, 0.34);
    plump(ctx, hk, ha, 7.5, 6, o, C.shade, C.deep, null); // the shin, folded back
    plump(ctx, hh, hk, 15.5, 9, o, C.base, C.shade, C.hi); // the thigh: a round haunch with the knee out front
    ctx.save(); // two bright flank stripes across the thigh
    ctx.strokeStyle = C.flank; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (const d of [-3.4, 3.4]) { const nx = hk[1] - hh[1], ny = hh[0] - hk[0], l = Math.hypot(nx, ny) || 1; ctx.beginPath(); ctx.moveTo(lerp(hh[0], hk[0], 0.28) + (nx / l) * d, lerp(hh[1], hk[1], 0.28) + (ny / l) * d + 1); ctx.lineTo(lerp(hh[0], hk[0], 0.72) + (nx / l) * d, lerp(hh[1], hk[1], 0.72) + (ny / l) * d + 1); ctx.stroke(); }
    ctx.restore();

    // throat sac (under the chin): pulses when idle, swells before a hop, a lump travels down it when swallowing
    const idlePulse = 0.08 + 0.06 * (0.5 + 0.5 * Math.sin(t * 2.6 + (op.id || 0))), pf = Math.max(puff, idlePulse);
    const sacX = 39, sacY = -6 + 2 * pf, sr = 6 + 13 * pf;
    ctx.beginPath(); ctx.ellipse(sacX, sacY, sr * 1.05, sr * (0.8 + 0.12 * pf), 0.15, 0, TAU);
    ctx.fillStyle = C.belly; ctx.fill(); ctx.lineWidth = o; ctx.strokeStyle = LINE; ctx.stroke();
    ctx.save(); ctx.clip(); ctx.fillStyle = C.bellyLo; ctx.beginPath(); ctx.ellipse(sacX + sr * 0.15, sacY + sr * 0.5, sr * 1.1, sr * 0.5, 0.15, 0, TAU); ctx.fill(); ctx.restore();
    if (pf > 0.45) { ctx.strokeStyle = C.bellyLo; ctx.lineWidth = 1.4; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(sacX - sr * 0.6, sacY + i * sr * 0.28); ctx.quadraticCurveTo(sacX, sacY + i * sr * 0.28 + 3, sacX + sr * 0.6, sacY + i * sr * 0.28); ctx.stroke(); } }
    if (gulp >= 0 && gulp < 1) { // the swallowed lump rolls down the throat: a bulge that stretches the skin
      const u = sstep(gulp / 0.75), lx = lerp(46, 32, u), ly = lerp(-12, -3, u), lr = lerp(9.5, 6.5, u);
      ctx.beginPath(); ctx.ellipse(lx, ly, lr * 1.08, lr, 0.2, 0, TAU); ctx.fillStyle = C.belly; ctx.fill(); ctx.lineWidth = o; ctx.strokeStyle = LINE; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(lx - lr * 0.25, ly - lr * 0.3, lr * 0.45, lr * 0.28, 0.2, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.8; ctx.fill(); ctx.globalAlpha = 1;
    }

    // front leg: short upper arm, straight forearm, a hand of toe pads
    const [fs, fe, fw, ft] = F;
    plump(ctx, fs, fe, 7.2, 5.6, o, C.base, C.shade, C.hi);
    plump(ctx, fe, fw, 5.6, 4.8, o, C.base, C.shade, null);
    toes(ctx, ft[0] - 1, ft[1] - 1, 3, 7, 3.6, 3, o, 0.42);

    // mouth: a wide smile; open, the lower jaw drops and a dark red cavity shows
    const mO = Math.max(mouth, tip ? 0.95 : 0, lick >= 0 ? 0.3 : 0);
    const lipTop = () => { ctx.moveTo(57.5, -20); ctx.quadraticCurveTo(40, -14, 19, -15.5); };
    if (mO > 0.04) {
      const jaw = 6.5 * mO;
      ctx.beginPath(); lipTop(); ctx.lineTo(17, -12); ctx.quadraticCurveTo(36, -10 + jaw * 0.7, 53, -10.5 + jaw); ctx.closePath();
      ctx.fillStyle = C.mouth; ctx.fill();
      // the lowered chin covers the old jaw line
      ctx.beginPath(); ctx.moveTo(17, -12); ctx.quadraticCurveTo(36, -10 + jaw * 0.7, 53, -10.5 + jaw); ctx.bezierCurveTo(54, -5 + jaw, 46, -1 + jaw * 0.6, 36, -1.5); ctx.lineTo(18, -2); ctx.closePath();
      ctx.fillStyle = C.belly; ctx.fill(); ctx.lineWidth = o; ctx.strokeStyle = LINE; ctx.stroke();
      ctx.beginPath(); lipTop(); ctx.lineWidth = o; ctx.strokeStyle = LINE; ctx.stroke();
    } else {
      ctx.beginPath(); lipTop(); ctx.quadraticCurveTo(14, -16.5, 11.5, -22); ctx.lineWidth = o * 0.9; ctx.strokeStyle = LINE; ctx.stroke();
    }
    // tongue: from the floor of the mouth, bowed a little, a sticky bulb at the tip
    let tp = tip;
    if (!tp && stun > 0.3) tp = { x: 56, y: 3, loll: 1 };
    else if (!tp && lick >= 0) { // the lip-lick telegraph: the tip sweeps up over the lip and back, twice
      const a = Math.sin(lick * TAU * 2) * 0.5 + 0.35, e = 10 + 6 * Math.sin(lick * Math.PI);
      tp = { x: FROG_MOUTH.x + Math.cos(a) * e * 0.9, y: FROG_MOUTH.y - 4 - Math.sin(a) * e, lickOnly: true };
    }
    if (tp) {
      const lickOnly = tp.lickOnly, loll = tp.loll;
      const bend = loll ? -0.22 + 0.05 * slack : lickOnly ? 0.18 : op.tout === 0 ? -0.1 + 0.05 * Math.sin(t * 40) : 0.13;
      const pr = op.prey && tip ? (c2, ux, uy) => op.prey(c2, ux, uy) : null;
      tongue(ctx, MOUTH, tp, o, bend, loll ? 12 : lickOnly ? 12 : 16, loll ? 9 : lickOnly ? 8 : 9, loll ? 6.4 : lickOnly ? 6.4 : pr ? 11 : 9.6, pr);
    }
    // nostril
    ctx.fillStyle = LINE; ctx.beginPath(); ctx.ellipse(53, -26, 1.8, 1.3, 0.3, 0, TAU); ctx.fill();
    // near eye (the big one)
    eyeAt(25, -46, 12, false);
    stars(false);
    // sweat drops when scared
    if (scared > 0.05) {
      ctx.fillStyle = C.sweat; ctx.strokeStyle = LINE; ctx.lineWidth = o * 0.6;
      for (let i = 0; i < 2; i++) {
        const ph = mod(t * 2.2 + i * 0.5, 1), dx = -20 - 12 * i - ph * 14, dy = -66 - 8 * i - Math.sin(ph * Math.PI) * 10 + ph * 10;
        ctx.globalAlpha = scared * (1 - ph);
        ctx.beginPath(); ctx.moveTo(dx, dy - 5); ctx.quadraticCurveTo(dx + 4.2, dy + 1, dx, dy + 3.4); ctx.quadraticCurveTo(dx - 4.2, dy + 1, dx, dy - 5); ctx.fill(); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  } catch (e) { /* art never breaks the frame */ }
  ctx.restore();
}

// ---------- ice and zap: the frog is drawn once into a scratch canvas, then its OWN silhouette is grown into the shell
let SCR = null;
const scratch = (i, w, h) => {
  SCR = SCR || [];
  const c = SCR[i] || (SCR[i] = document.createElement('canvas'));
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } else c.getContext('2d').clearRect(0, 0, w, h);
  return c;
};
// the silhouette of src grown by r px, filled with one colour
function grow(src, r, color, i) {
  const c = scratch(i, src.width, src.height), g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  const n = r > 4 ? 20 : 14;
  for (let k = 0; k < n; k++) { const a = (k / n) * TAU; g.drawImage(src, Math.cos(a) * r, Math.sin(a) * r); }
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'source-over';
  return c;
}
function crystal(ctx, x, y, a, len, o) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.beginPath(); ctx.moveTo(-1.5, -2.2); ctx.lineTo(len, 0); ctx.lineTo(-1.5, 2.2); ctx.lineTo(-0.5, 0); ctx.closePath();
  ctx.moveTo(0, -1.6); ctx.lineTo(len * 0.62, -len * 0.5); ctx.lineTo(1.8, 0.4); ctx.closePath();
  ctx.moveTo(0, 1.6); ctx.lineTo(len * 0.55, len * 0.46); ctx.lineTo(1.8, -0.4); ctx.closePath();
  ctx.fillStyle = '#eaf9ff'; ctx.fill(); ctx.lineWidth = o * 0.45; ctx.strokeStyle = RIM; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.restore();
}
const CRACKS = [[[-36, -27], [-26, -22], [-28, -14], [-16, -9], [-18, -3]], [[18, -29], [24, -22], [17, -16], [23, -9]], [[-6, -34], [0, -26], [-5, -21], [5, -17]], [[44, -28], [40, -22], [46, -17]]];
const FACETS = [[[-31, -30], [-12, -34], [-15, -30], [-33, -26]], [[11, -30], [20, -31], [16, -25]], [[-38, -22], [-31, -27], [-28, -20]], [[30, -44], [34, -48], [35, -42]]];
const CRYST = [[-9, -35, -1.5, 9], [-46, -16, -2.6, 8], [48, -29, -0.8, 8], [57, -16, -0.1, 7], [-24, 1, 1.6, 6]];

function drawFrogShell(ctx, x, y, s, t, op) {
  const U = s / 100, m = ctx.getTransform(), ds = Math.hypot(m.a, m.b) || 1, sc = U * ds, face = op.face === -1 ? -1 : 1;
  const o = clamp(1.9 / U, 2.8, 7), fz = clamp(op.frozen || 0, 0, 1), zp = clamp(op.zap || 0, 0, 1), crack = clamp(op.crack || 0, 0, 1);
  const W = Math.ceil(190 * sc) + 2, Hh = Math.ceil(100 * sc) + 2, ox = 95 * sc, oy = 80 * sc;
  const A = scratch(0, W, Hh), a = A.getContext('2d');
  a.setTransform(ds, 0, 0, ds, ox, oy);
  const shiv = crack > 0.05 ? Math.sin(t * 61) * 1.1 * crack * U : 0;
  drawFrog(a, shiv, 0, s, t, { ...op, inner: 1, frozen: 0, zap: 0, tint: fz > 0 ? 'ice' : null, blink: fz > 0 ? 0.55 : op.blink });
  const blit = (cv) => ctx.drawImage(cv, -ox / ds, -oy / ds, W / ds, Hh / ds);
  ctx.save();
  ctx.translate(x, y);
  // ground shadow under the shell
  ctx.fillStyle = 'rgba(10,30,40,0.26)'; ctx.beginPath(); ctx.ellipse(-2 * U * face, 1.5 * U, 52 * U, 5 * U, 0, 0, TAU); ctx.fill();
  if (fz > 0) {
    const r = Math.max(2, 3.4 * sc) * sstep(fz * 1.4), rim = Math.max(1.4, 1.7 * sc);
    blit(grow(A, r + rim, RIM, 1));
    blit(grow(A, r, '#d7f1ff', 2));
    blit(A);
    ctx.globalAlpha = 0.3 * sstep(fz * 1.4); blit(grow(A, r, '#9fd8ff', 2)); ctx.globalAlpha = 1; // the glaze over the creature
    ctx.save();
    ctx.scale(U * face, U);
    const g = sstep(fz * 1.5);
    ctx.globalAlpha = g;
    ctx.fillStyle = '#ffffff';
    for (const f of FACETS) { ctx.beginPath(); f.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill(); }
    for (const [cx, cy, ca, cl] of CRYST) crystal(ctx, cx, cy, ca, cl * g, o);
    if (crack > 0) { // hairline cracks spread over the shell in the last second
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      CRACKS.forEach((cr, ci) => {
        const n = Math.max(0, Math.min(cr.length, 1 + crack * cr.length * 1.2 - ci * 0.25));
        if (n < 1.01) return;
        const path = () => { ctx.beginPath(); ctx.moveTo(cr[0][0], cr[0][1]); for (let i = 1; i < Math.ceil(n); i++) { const f = Math.min(1, n - i); ctx.lineTo(lerp(cr[i - 1][0], cr[i][0], f), lerp(cr[i - 1][1], cr[i][1], f)); } };
        path(); ctx.lineWidth = o * 0.9; ctx.strokeStyle = RIM; ctx.stroke();
        path(); ctx.lineWidth = o * 0.32; ctx.strokeStyle = '#ffffff'; ctx.stroke();
      });
    }
    ctx.restore();
  } else blit(A);
  if (zp > 0) { // the zap: a white flash over the silhouette and crisp jagged arcs along the body
    ctx.globalAlpha = 0.85 * zp * zp; blit(grow(A, 0.01, '#fffbe0', 2)); ctx.globalAlpha = 1;
    ctx.save();
    ctx.scale(U * face, U);
    const sd = Math.floor(t * 26) + (op.id || 0) * 17;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      let px = -44 + hash(sd + i * 3.3) * 20 + i * 22, py = -30 + hash(sd + i * 5.1) * 22;
      const pts = [[px, py]];
      for (let k = 0; k < 6; k++) { px += 6 + hash(sd * 1.7 + i * 9 + k) * 6; py += (hash(sd * 3.1 + i * 7 + k * 2) - 0.5) * 20; py = clamp(py, -36, 2); pts.push([px, py]); }
      const path = () => { ctx.beginPath(); pts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); };
      ctx.globalAlpha = Math.min(1, zp * 1.6);
      path(); ctx.lineWidth = o * 1.5; ctx.strokeStyle = '#e8a800'; ctx.stroke();
      path(); ctx.lineWidth = o * 0.7; ctx.strokeStyle = '#fff7b0'; ctx.stroke();
      path(); ctx.lineWidth = o * 0.28; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

// the pieces that pop off at thaw (art units, relative to the feet; the game animates them)
export function drawFrogShards(ctx, x, y, s, shards) {
  const U = s / 100, o = clamp(1.9 / U, 2.8, 7);
  ctx.save(); ctx.translate(x, y); ctx.scale(U, U); ctx.lineJoin = 'round';
  for (const p of shards) {
    ctx.save(); ctx.globalAlpha = p.al; ctx.translate(p.x, p.y); ctx.rotate(p.a);
    ctx.beginPath(); ctx.moveTo(-p.s, p.s * 0.4); ctx.lineTo(p.s * 0.1, -p.s); ctx.lineTo(p.s, p.s * 0.5); ctx.closePath();
    ctx.fillStyle = '#d7f1ff'; ctx.fill(); ctx.lineWidth = o * 0.55; ctx.strokeStyle = RIM; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-p.s * 0.2, -p.s * 0.2); ctx.lineTo(p.s * 0.1, -p.s * 0.7); ctx.lineTo(p.s * 0.3, -p.s * 0.1); ctx.closePath(); ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// ================================================================= in game
export const frogAnim = new Map(); // id -> per-frog render state (eased looks); reset with a new sim

// Hop telegraph: while it crouches, a faint dotted arc to where it will land. Under the frog, after the rings.
export function drawFrogTele(ctx, sim, k, t) {
  for (const F of sim.frogs || []) {
    if (F.ph !== 'crouch' || !F.hk || F.sc) continue;
    const p = clamp(F.t / F.dur, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.18 + 0.4 * sstep(p * 1.6);
    ctx.setLineDash([0.07, 0.1]);
    ctx.lineDashOffset = -t * 0.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    let c = null;
    for (let i = 0; i <= 24; i++) { c = sim.frogCurve(F, i / 24); const x = c.r * Math.cos(c.w), y = c.r * Math.sin(c.w); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.save(); ctx.setLineDash([]); ctx.globalAlpha *= 0.55; ctx.lineWidth = 0.07; ctx.strokeStyle = '#0b2012'; ctx.stroke(); ctx.restore(); // a dark underlay so it reads on any world
    ctx.lineWidth = 0.04; ctx.strokeStyle = '#c6ef5a'; ctx.stroke();
    ctx.setLineDash([]);
    const x = c.r * Math.cos(c.w), y = c.r * Math.sin(c.w), pu = 0.5 + 0.5 * Math.sin(t * 9);
    ctx.lineWidth = 0.04; ctx.strokeStyle = `rgba(198,239,90,${0.6 + 0.4 * pu})`;
    ctx.beginPath(); ctx.ellipse(x, y, 0.3 + 0.04 * pu, 0.1 + 0.015 * pu, Math.atan2(y, x) + Math.PI / 2 + 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }
}

// Marks what it is about to lick (a thin ring round the orb or chick), under the frog.
function lickMark(ctx, F, t) {
  if (F.ph !== 'lick') return;
  const p = clamp(F.t / F.dur, 0, 1), pu = 0.5 + 0.5 * Math.sin(t * 14);
  ctx.save();
  ctx.lineWidth = 0.035; ctx.strokeStyle = `rgba(255,120,150,${0.35 + 0.4 * p + 0.2 * pu})`;
  ctx.beginPath(); ctx.arc(F.lx, F.ly, 0.34 - 0.08 * p + 0.02 * pu, 0, TAU); ctx.stroke();
  ctx.restore();
}

export function drawFrogs(ctx, sim, t, k, theme) {
  const list = sim.frogs || [];
  if (!list.length) return;
  for (const F of list) {
    let R = frogAnim.get(F.id);
    const fresh = !R || R.sim !== sim || t < R.t - 0.5;
    if (fresh) { R = { sim, t, fx: F.face, plug: F.gi >= 0 ? 1 : 0, look: { x: 0.3, y: 0 }, lean: 0, tip: null, ft: t, thaw: -9, shards: null }; frogAnim.set(F.id, R); }
    const dt = clamp(t - R.t, 0, 0.1);
    R.t = t;
    const ease = (a, b, r) => a + (b - a) * Math.min(1, dt * r);
    R.fx = ease(R.fx, F.face, 14);
    R.plug = ease(R.plug, F.gi >= 0 && F.ph !== 'hop' ? 1 : 0, 9);
    // basis: e1 along the surface in the frog's facing direction, e2 out of the surface
    const tx = F.ny * F.face, ty = -F.nx * F.face, nx = F.nx, ny = F.ny;
    const toLocal = (wx, wy, um) => ({ x: ((wx - F.x) * tx + (wy - F.y) * ty) * um, y: -((wx - F.x) * nx + (wy - F.y) * ny) * um });
    const sPx = FROG.w * FROG_ART * k, um = 100 / (FROG.w * FROG_ART);
    const ch = { face: F.face, id: F.id, um, scared: F.sc ? 1 : 0, skin: frogSkin(theme, sim.rings[F.fi].mat) };
    // ---- pose from the phase
    let air = 0;
    const p = F.dur > 0 ? clamp(F.t / F.dur, 0, 1) : 0;
    switch (F.ph) {
      case 'crouch': {
        const a = F.sc ? 0.16 : 0.45;
        ch.crouch = sstep(F.t / (F.dur * a));
        ch.puff = F.sc ? 0.4 : clamp(p * 1.6, 0, 1) * (0.9 + 0.1 * Math.sin(t * 28));
        ch.shake = F.sc ? 1.2 : p > 0.55 ? ((p - 0.55) / 0.45) * 1.3 : 0;
        break;
      }
      case 'hop': {
        const u = F.u;
        air = sstep(u / 0.14) * (1 - sstep((u - 0.8) / 0.2));
        ch.stretch = air * (F.hh > 1 ? 1 : 0.85);
        ch.crouch = 1 - sstep(u / 0.14);
        ch.puff = Math.max(0, 0.7 - u * 2);
        break;
      }
      case 'land': {
        const tau = clamp(F.t / FROG.land, 0, 1);
        ch.squash = (1 - tau) * (0.62 + 0.38 * Math.cos(tau * Math.PI * 2.2));
        ch.crouch = 0.5 * (1 - tau);
        ch.puff = 0.35 * (1 - tau);
        break;
      }
      case 'lick': ch.lick = p; ch.lean = 0; break;
      case 'tongue': {
        const g = F.t / FROG.tongueT, e = g < FROG.grab ? Math.pow(sstep(g / FROG.grab), 0.6) : 1 - sstep((g - FROG.grab) / (1 - FROG.grab));
        ch.mouth = g < 0.9 ? 1 : 0.4;
        ch.tongueE = e;
        break;
      }
      case 'gulp': ch.gulp = clamp(F.t / F.dur, 0, 1); ch.puff = 0.55 + 0.45 * Math.sin(Math.min(1, ch.gulp / 0.6) * Math.PI); ch.squash = 0.42 * Math.sin(Math.PI * clamp(ch.gulp / 0.5, 0, 1)); break; // a quick body squash for ~0.3 s
    }
    if (F.bump > 0 && F.ph === 'sit') ch.squash = 0.3 * F.bump;
    ch.plug = R.plug;
    ch.blink = blinkAt(t, F.id);
    // ---- states (thunderclap, rooster, zap: stunned; frost nova: frozen). Frozen holds the pose it froze in.
    const frz = F.frz || 0, stn = F.stn || 0, zapT = F.zapT || 0;
    if (frz > 0) {
      if (!R.frozen) { R.frozen = 1; R.ft = t; }
      ch.frozen = Math.min(1, (F.frzMax - frz) / 0.3 + 0.01);
      ch.crack = frz < 1 ? 1 - frz : 0;
      R.thaw = -9;
    } else if (R.frozen) { // thaw: shards pop off and fall, then it shakes itself off
      R.frozen = 0; R.thaw = t;
      R.shards = Array.from({ length: 8 }, (_, i) => ({ x: -40 + i * 11 + (i % 2) * 4, y: -14 - (i % 3) * 9, vx: (i - 3.5) * 16 + (i % 2 ? 9 : -9), vy: -50 - (i % 4) * 16, a: i * 1.3, w: (i % 2 ? 1 : -1) * (4 + i % 3), s: 5 + (i % 3) * 2.2 }));
    }
    const th = t - R.thaw;
    if (th >= 0 && th < 0.7) ch.shake = Math.max(ch.shake || 0, th > 0.25 ? 2.2 * (1 - (th - 0.25) / 0.45) : 0);
    if (zapT > 0) ch.zap = clamp(zapT / 0.3, 0, 1);
    if (stn > 0 && !(zapT > 0)) ch.stun = Math.min(1, (F.stnMax - stn) / 0.3 + 0.01, stn / 0.25);
    if (frz > 0 || ch.stun > 0) { ch.crouch = ch.puff = ch.gulp = ch.lick = ch.tongue = ch.prey = undefined; ch.stretch = ch.squash = 0; ch.scared = 0; if (frz > 0) { ch.blink = 0.55; ch.look = { x: 0.3, y: 0 }; } }
    // ---- what it looks at: the prey, the threat, else the nearest egg
    let tgt = null;
    if (F.ph === 'lick' || F.ph === 'tongue') tgt = { x: F.lx, y: F.ly };
    else if (F.ph !== 'hop') {
      let bd = 3;
      for (const e of sim.aliveEggs()) { const q = e.body.getPosition(), d = Math.hypot(q.x - F.x, q.y - F.y); if (d < bd) { bd = d; tgt = { x: q.x, y: q.y }; } }
    }
    const lk = tgt ? toLocal(tgt.x, tgt.y, 1) : { x: 0.35 + 0.3 * Math.sin(t * 0.6 + F.id), y: -0.05 };
    const ll = Math.hypot(lk.x, lk.y) || 1;
    R.look.x = ease(R.look.x, tgt ? clamp(lk.x / ll, -1, 1) : lk.x, 8);
    R.look.y = ease(R.look.y, tgt ? clamp(lk.y / ll, -1, 1) : lk.y, 8);
    ch.look = R.look;
    // ---- tongue: from the mouth toward where the prey was, out and back
    const mouth = { x: 46, y: -12 }; // the tongue's rest point, inside the mouth
    if (F.ph === 'tongue') {
      const T = toLocal(F.got ? F.px : F.lx, F.got ? F.py : F.ly, um), e = ch.tongueE;
      const far = clamp(Math.hypot(T.x - mouth.x, T.y - mouth.y), 1, 1e9), cap = Math.min(1, (FROG_MODE.hard.tongue * 1.1 * um) / far);
      ch.tongue = { x: mouth.x + (T.x - mouth.x) * e * cap, y: mouth.y + (T.y - mouth.y) * e * cap };
      ch.tout = F.t < FROG.tongueT * FROG.grab ? 1 : 0;
      if (F.got && F.t >= FROG.tongueT * FROG.grab) { const pk = F.pk, ty2 = F.pty; ch.prey = (c2, ux, uy) => frogPrey(c2, pk, ty2, ch.tongue.x + ux * 7, ch.tongue.y + uy * 7, um, e, t); }
    }
    if (F.ph === 'gulp') ch.lick = -1;
    if (frz > 0 || ch.stun > 0) { ch.tongue = null; ch.prey = undefined; }
    // ---- orientation: lie on the surface; in the air nose along the flight
    let phi = 0;
    if (air > 0.01) {
      const vx = F.vx * tx + F.vy * ty, vy = F.vx * nx + F.vy * ny; // local velocity (e1 forward, e2 up)
      if (Math.hypot(vx, vy) > 0.4) phi = clamp(Math.atan2(vy, vx), -0.7, 0.9);
    }
    R.lean = ease(R.lean, phi * air, 18);
    ch.lean = -R.lean * 0.9 + (ch.lean || 0);
    ch.face = R.fx;
    // ---- draw: rotate onto the surface (local up = the normal), at the feet point
    const theta = Math.atan2(-F.nx, F.ny);
    ch.mouth = ch.mouth || 0;
    lickMark(ctx, F, t);
    ctx.save();
    ctx.translate(F.x, F.y);
    ctx.scale(1 / k, -1 / k);
    try {
      ctx.rotate(-theta);
      drawFrog(ctx, 0, 0, sPx, frz > 0 ? R.ft : t, ch);
      if (R.shards && th >= 0 && th < 0.7) drawFrogShards(ctx, 0, 0, sPx, R.shards.map((p) => ({ x: p.x * ch.face + p.vx * th, y: p.y + p.vy * th + 330 * th * th, a: p.a + p.w * th, s: p.s, al: 1 - th / 0.7 })));
    } catch (e) { /* art never breaks the frame */ }
    ctx.restore();
  }
}

// the swallowed thing riding the tongue tip (art units; the frame is the frog's)
function frogPrey(ctx, kind, type, x, y, um, e, t) {
  const sc = clamp(0.4 + 0.6 * sstep(e / 0.75), 0.3, 1); // it shrinks as the tongue drags it in, and slips into the mouth
  ctx.save();
  ctx.globalAlpha = clamp(e / 0.25, 0, 1);
  ctx.translate(x, y);
  if (kind === 'orb') drawOrb(ctx, type, 0, 0, 0.2 * um * sc, t, true);
  else if (type === 'peck') drawChick(ctx, 0, 0, 0.5 * um * sc, t, 1, 0);
  else drawKindChick(ctx, type, 0, 0, 0.5 * um * sc, t, { flap: 1 });
  ctx.restore();
}

// ---------------------------------------------------------------- events -> SFX/VFX
export function frogEvent(ev, fx, api) {
  const { popup, audio, once } = api;
  switch (ev.type) {
    case 'frogCrouch':
      audio.play('bubble_on', { vol: 0.35, pitch: 0.55 });
      break;
    case 'frogHop':
      audio.play('squish', { intensity: 0.5, pitch: 1.1, vol: 0.7 });
      fx.dust(ev.x, ev.y, 4, 'rgba(190,230,150,0.7)');
      once('frog', 'A frog! It hops through gaps, plugs them, and swallows orbs and chicks. Eggs bounce softly on its back.');
      break;
    case 'frogLand':
      audio.play('egg_bump', { vol: 0.45, pitch: 0.6 });
      fx.dust(ev.x, ev.y, 5, 'rgba(190,230,150,0.7)');
      if (ev.plug) once('frogPlug', 'The frog is plugging a gap: eggs cannot fall through, and they land softly on it. Until it hops away!');
      break;
    case 'frogLick':
      audio.play('squish', { intensity: 0.3, pitch: 1.7, vol: 0.5 });
      once('frogLick', 'The frog licks its lips: it is about to snatch that orb or chick!');
      break;
    case 'frogTongue':
      audio.play('thorn_snap', { vol: 0.45, pitch: 2 });
      break;
    case 'frogEat':
      audio.play('squish', { intensity: 0.9, pitch: 0.8 });
      fx.sparkle(ev.x, ev.y, 6, ev.kind === 'chick' ? '#ffe066' : '#d8ffb0');
      popup(ev.x, ev.y + 0.6, ev.kind === 'chick' ? 'Chick gulped!' : 'Orb gulped!', { color: '#c9ff9e', size: 18, life: 1.1 });
      break;
    case 'frogGulp':
      audio.play('bubble_pop', { vol: 0.5, pitch: 0.6 });
      break;
    case 'frogMiss':
      if (!ev.early) { audio.play('rock_hit', { vol: 0.3, pitch: 1.8 }); popup(ev.x, ev.y + 0.5, 'Missed!', { color: '#ffd6e0', size: 15, life: 0.8 }); }
      break;
    case 'frogScare':
      audio.play('wind_gust', { vol: 0.5, pitch: 1.9 });
      popup(ev.x, ev.y + 1.1, 'Ribbit!', { color: '#a8e4ff', size: 15, life: 0.9 });
      once('frogScare', ev.by === 'dash' ? 'The dash chick scares the frog away!' : 'A flame scares the frog: it leaps clear of the egg.');
      break;
    case 'frogState':
      audio.play(ev.kind === 'ice' ? 'thorn_snap' : 'rock_hit', { vol: 0.3, pitch: ev.kind === 'ice' ? 2.4 : 1.3 });
      break;
    case 'frogBounce':
      audio.play('egg_bump', { vol: 0.5, pitch: 0.7 });
      fx.dust(ev.x, ev.y, 3, 'rgba(190,230,150,0.7)');
      popup(ev.x, ev.y + 0.9, 'Boing!', { color: '#c9ff9e', size: 13, life: 0.7 });
      once('frogBounce', 'Soft landing! An egg that falls on the frog never cracks.');
      break;
  }
}
