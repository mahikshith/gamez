// The frog (v3.3 M8): crisp cel-shaded code art in the crawler family's style (dark outline, base + one hard shadow +
// one hard highlight), seen from the side. It hops through gaps, plugs them, and snatches orbs and chicks with its tongue.
//
// drawFrog(ctx, x, y, s, t, o): feet point at (x, y) px (y down), s = body width px (the sim's FROG.w m * ART), the
// frog faces +x and "up" is -y (the game rotates it onto the ring surface, see drawFrogs). o (all optional):
//   face  +1 | -1 (mirror)           crouch 0..1 (coiled, ready to hop)   stretch 0..1 (airborne, legs trailing)
//   squash -0.3..1 (landing)         puff 0..1 (throat sac)               blink 0..1   gulp 0..1 (swallow progress, -1 off)
//   mouth 0..1 (open)                lick -1 | 0..1 (lip-lick progress)   tongue {x, y} tip in art units, or null
//   scared 0..1 (wide eyes, sweat)   plug 0..1 (sitting in a gap: flat, belly through the opening)
//   look {x, y} pupils -1..1         lean rad (nose up/down)              shake px-ish wobble   um art units per metre
// In game: drawFrogs() reads the sim (sim/frog.js) and derives every channel from the frog's phase.
import { TAU } from '../sim/geom.js';
import { FROG, FROG_MODE } from '../sim/frog.js';
import { drawOrb } from './powers.js';
import { drawKindChick } from './chicks.js';
import { drawChick } from './characters.js';

export const FROG_ART = 1.12; // the art is a little larger than the body that collides
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
const lerp = (a, b, k) => a + (b - a) * k;
const mod = (a, b) => ((a % b) + b) % b;

const LINE = '#12301a';
const C = {
  base: '#5cc046', shade: '#3b9040', deep: '#2b6c33', hi: '#aaec74', belly: '#f1f6b6', bellyLo: '#cddd86',
  spot: '#2f7d37', thigh: '#f7a63a', thighLo: '#d9741f', eye: '#ffd83c', eyeLo: '#e7a418', pupil: '#101c0e',
  mouth: '#6e1a2a', tongue: '#f0607f', tongueLo: '#c93a5e', pad: '#e6f59a', sweat: '#a8e4ff',
};

// ---- joints (art units, y down, ground at y = 0, nose at +x): hip, knee, ankle, toe tip. The pose blends rest / crouch / air.
const HIND = {
  rest: [[-24, -19], [0, -15], [-27, -4], [-2, -1]],
  crouch: [[-25, -14], [-1, -11], [-30, -3], [-6, -1]],
  air: [[-22, -17], [-40, -13], [-56, -8], [-70, -3]],
};
const FORE = {
  rest: [[22, -14], [27, -7], [29, -2], [39, 0]],
  crouch: [[22, -11], [31, -8], [31, -2], [41, 0]],
  air: [[22, -17], [34, -19], [45, -17], [53, -13]],
};
const blendJ = (P, wc, wa) => P.rest.map((r, i) => [r[0] + (P.crouch[i][0] - r[0]) * wc + (P.air[i][0] - r[0]) * wa, r[1] + (P.crouch[i][1] - r[1]) * wc + (P.air[i][1] - r[1]) * wa]);

function blinkAt(t, seed = 0) {
  const p = mod(t + seed * 1.7, 3.3 + seed * 0.6);
  return p < 0.18 ? Math.sin((p / 0.18) * Math.PI) : 0;
}
function limb(ctx, pts, w, o, fill, hi) {
  const path = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  path(); ctx.lineWidth = w + o * 2; ctx.strokeStyle = LINE; ctx.stroke();
  path(); ctx.lineWidth = w; ctx.strokeStyle = fill; ctx.stroke();
  if (hi) { ctx.save(); ctx.translate(-0.9, -1.4); path(); ctx.lineWidth = w * 0.3; ctx.strokeStyle = hi; ctx.stroke(); ctx.restore(); }
}
function blob(ctx, x, y, rx, ry, rot, o, fill, hi) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = o; ctx.strokeStyle = LINE; ctx.stroke();
  if (hi) { ctx.beginPath(); ctx.ellipse(x - rx * 0.28, y - ry * 0.34, rx * 0.5, ry * 0.3, rot, 0, TAU); ctx.fillStyle = hi; ctx.fill(); }
}
function toes(ctx, wx, wy, dir, n, len, o) { // splayed toe pads at a foot
  for (let i = 0; i < n; i++) {
    const a = (i - (n - 1) / 2) * 0.34, tx = wx + Math.cos(a) * len * dir, ty = wy + Math.sin(a) * len * 0.5;
    ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(tx, ty);
    ctx.lineCap = 'round'; ctx.lineWidth = 5.2 + o * 2; ctx.strokeStyle = LINE; ctx.stroke();
    ctx.lineWidth = 5.2; ctx.strokeStyle = C.base; ctx.stroke();
    ctx.beginPath(); ctx.arc(tx, ty, 2.7, 0, TAU); ctx.fillStyle = C.pad; ctx.fill();
  }
}

export function drawFrog(ctx, x, y, s, t = 0, op = {}) {
  if (!(s > 0)) return;
  const face = op.face === -1 ? -1 : 1, crouch = clamp(op.crouch || 0, 0, 1), st = clamp(op.stretch || 0, 0, 1), q = op.squash || 0;
  const plug = clamp(op.plug || 0, 0, 1), puff = clamp(op.puff || 0, 0, 1), scared = clamp(op.scared || 0, 0, 1);
  const mouth = clamp(op.mouth || 0, 0, 1), gulp = op.gulp == null ? -1 : op.gulp, lick = op.lick == null ? -1 : op.lick;
  const look = op.look || { x: 0.3, y: 0 }, tip = op.tongue || null;
  const U = s / 100, o = clamp(1.75 / U, 2.6, 6.5);
  ctx.save();
  try {
    ctx.translate(x, y);
    ctx.scale(U * face, U);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const idle = Math.sin(t * 2.4 + (op.id || 0));
    // ground shadow (not in a gap: there the ring is under it)
    if (plug < 0.5) { ctx.fillStyle = `rgba(10,30,14,${0.28 * (1 - st) * (1 - plug * 2)})`; ctx.beginPath(); ctx.ellipse(-2, 1.5, 44 + 6 * q, 5, 0, 0, TAU); ctx.fill(); }
    // global pose: tilt (nose up/down), then squash and stretch about the ground / the body's middle
    ctx.translate(0, -17 * st);
    ctx.rotate(op.lean || 0);
    ctx.translate(op.shake ? Math.sin(t * 52) * op.shake : 0, 0);
    ctx.translate(0, 17 * st);
    const sy = (1 - 0.2 * crouch - 0.1 * plug - 0.26 * q) * (1 + 0.012 * idle) * (1 - 0.1 * st), sx = (1 + 0.07 * crouch + 0.05 * plug + 0.2 * q) * (1 + 0.1 * st);
    ctx.translate(0, -17 * st); ctx.scale(sx, sy); ctx.translate(0, 17 * st);
    if (plug > 0) { // the belly hangs through the opening
      ctx.save(); ctx.globalAlpha = plug; blob(ctx, -3, -2, 38, 12, 0, o, C.bellyLo, null); ctx.restore();
    }
    const wa = st, wc = clamp(crouch + 0.55 * plug, 0, 1) * (1 - st);
    const H = blendJ(HIND, wc, wa), F = blendJ(FORE, wc * 0.8, wa);

    // far eye (behind the head), then the body
    const lid = Math.max(op.blink || 0, gulp >= 0 ? sstep((gulp - 0.05) / 0.2) * (1 - sstep((gulp - 0.7) / 0.25)) : 0);
    const eyeSink = gulp >= 0 ? 5 * Math.sin(Math.PI * clamp(gulp, 0, 1)) : 0, bulge = 1 + 0.18 * scared;
    const eyeAt = (ex, ey, er, far) => {
      ey += eyeSink;
      ctx.save();
      ctx.beginPath(); ctx.arc(ex, ey, er * bulge, 0, TAU);
      ctx.fillStyle = far ? C.eyeLo : C.eye; ctx.fill();
      ctx.lineWidth = o; ctx.strokeStyle = LINE; ctx.stroke();
      ctx.clip();
      // pupil: a horizontal oval that follows `look`; shrinks when scared
      const pr = er * (0.5 - 0.16 * scared);
      ctx.fillStyle = C.pupil;
      ctx.beginPath(); ctx.ellipse(ex + look.x * er * 0.34, ey + look.y * er * 0.3, pr * (far ? 0.8 : 1) * 1.05, pr * 0.82, 0, 0, TAU); ctx.fill();
      if (!far) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(ex + look.x * er * 0.34 - pr * 0.3, ey + look.y * er * 0.3 - pr * 0.35, pr * 0.28, 0, TAU); ctx.fill(); }
      // the eyelid slides down from the top (a blink, or shut for a gulp); the brow ridge always covers a bit
      const cover = clamp(0.2 - 0.2 * scared + lid * 0.9, 0, 1.1);
      ctx.fillStyle = far ? C.shade : C.base;
      ctx.fillRect(ex - er * 1.4, ey - er * 1.4, er * 2.8, er * (0.22 + cover * 1.78));
      ctx.fillStyle = far ? C.deep : C.shade;
      ctx.fillRect(ex - er * 1.4, ey - er * 1.4 + er * (0.22 + cover * 1.78) - 2.4, er * 2.8, 2.4);
      if (lid > 0.5) { ctx.strokeStyle = LINE; ctx.lineWidth = o * 0.8; ctx.beginPath(); ctx.moveTo(ex - er * 0.8, ey + er * 0.1); ctx.quadraticCurveTo(ex, ey + er * 0.5, ex + er * 0.8, ey + er * 0.1); ctx.stroke(); }
      ctx.restore();
      ctx.beginPath(); ctx.arc(ex, ey, er * bulge, 0, TAU); ctx.lineWidth = o; ctx.strokeStyle = LINE; ctx.stroke();
    };
    eyeAt(38, -38, 7.2, true);

    const body = () => {
      ctx.beginPath();
      ctx.moveTo(-40, -3);
      ctx.bezierCurveTo(-47, -17, -38, -31, -18, -35);
      ctx.bezierCurveTo(-4, -39, 10, -37, 24, -36);
      ctx.bezierCurveTo(38, -35, 50, -30, 53, -21);
      ctx.bezierCurveTo(54, -16, 50, -12, 44, -11);
      ctx.bezierCurveTo(36, -9, 30, -5, 20, -3);
      ctx.bezierCurveTo(6, -1, -24, -1, -40, -3);
      ctx.closePath();
    };
    body();
    ctx.fillStyle = C.shade; ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = C.base; ctx.beginPath(); ctx.ellipse(-4, -30, 56, 21, -0.06, 0, TAU); ctx.fill(); // lit back
    ctx.fillStyle = C.hi; ctx.beginPath(); ctx.ellipse(-12, -34, 24, 3.6, -0.1, 0, TAU); ctx.fill(); // highlight along the spine
    ctx.fillStyle = C.spot; // mottled spots
    for (const [px, py, pr] of [[-22, -27, 4.2], [-8, -31, 3.4], [-31, -17, 3.2], [6, -30, 2.6], [-15, -21, 2.6]]) { ctx.beginPath(); ctx.ellipse(px, py, pr * 1.2, pr, 0.4, 0, TAU); ctx.fill(); }
    ctx.fillStyle = C.belly; ctx.beginPath(); ctx.ellipse(12, 0, 44, 11, 0, 0, TAU); ctx.fill(); // pale belly
    ctx.restore();
    body(); ctx.lineWidth = o + 3.2; ctx.strokeStyle = 'rgba(235,255,190,0.5)'; ctx.stroke(); // a pale rim keeps it readable on green walls
    body(); ctx.lineWidth = o; ctx.strokeStyle = LINE; ctx.stroke();

    // hind leg: thigh mass over the flank, a slimmer shin, a long foot
    const [hh, hk, ha, ht] = H;
    limb(ctx, [hh, hk], 17, o, C.base, C.hi);
    limb(ctx, [hk, ha], 8.5, o, C.shade, null);
    limb(ctx, [ha, ht], 5.6, o, C.base, null);
    ctx.save(); // the bright flash on the inner thigh: two stripes
    ctx.strokeStyle = C.thigh; ctx.lineWidth = 3.2;
    for (const d of [-3.2, 3.2]) { const nx = hk[1] - hh[1], ny = hh[0] - hk[0], l = Math.hypot(nx, ny) || 1; ctx.beginPath(); ctx.moveTo(lerp(hh[0], hk[0], 0.25) + (nx / l) * d, lerp(hh[1], hk[1], 0.25) + (ny / l) * d); ctx.lineTo(lerp(hh[0], hk[0], 0.8) + (nx / l) * d, lerp(hh[1], hk[1], 0.8) + (ny / l) * d); ctx.stroke(); }
    ctx.restore();
    toes(ctx, ht[0], ht[1], 1, 3, 8, o);

    // throat sac (under the chin): pulses when idle, swells before a hop, a lump travels down it when swallowing
    const idlePulse = 0.1 + 0.07 * (0.5 + 0.5 * Math.sin(t * 2.6 + (op.id || 0))), pf = Math.max(puff, idlePulse);
    const sacX = 35, sacY = -9 + 2 * pf, sr = 7 + 11 * pf;
    ctx.beginPath(); ctx.ellipse(sacX, sacY, sr * 1.05, sr * (0.8 + 0.12 * pf), 0.15, 0, TAU);
    ctx.fillStyle = C.belly; ctx.fill(); ctx.lineWidth = o; ctx.strokeStyle = LINE; ctx.stroke();
    ctx.fillStyle = C.bellyLo; ctx.beginPath(); ctx.ellipse(sacX + sr * 0.15, sacY + sr * 0.32, sr * 0.8, sr * 0.34, 0.15, 0, TAU); ctx.fill();
    if (pf > 0.45) { ctx.strokeStyle = C.bellyLo; ctx.lineWidth = 1.4; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(sacX - sr * 0.6, sacY + i * sr * 0.28); ctx.quadraticCurveTo(sacX, sacY + i * sr * 0.28 + 3, sacX + sr * 0.6, sacY + i * sr * 0.28); ctx.stroke(); } }
    if (gulp >= 0 && gulp < 1) { // the swallowed lump
      const u = sstep(gulp / 0.7), lx = lerp(44, 30, u), ly = lerp(-17, -5, u);
      blob(ctx, lx, ly, 5.5 * (1 - 0.3 * u), 5, 0, o * 0.8, C.base, C.hi);
    }

    // front leg: shoulder, elbow, wrist, toes
    const [fs, fe, fw, ft] = F;
    limb(ctx, [fs, fe, fw], 7.6, o, C.base, C.hi);
    limb(ctx, [fw, ft], 5, o, C.base, null);
    toes(ctx, ft[0] - 2, ft[1], 1, 3, 6, o);

    // mouth
    const mO = Math.max(mouth, tip ? 0.85 : 0, lick >= 0 ? 0.26 : 0);
    if (mO > 0.04) { // open: a dark wedge between the lip line and a dropped lower jaw
      const jaw = 10 * mO;
      ctx.beginPath(); ctx.moveTo(23, -17); ctx.quadraticCurveTo(38, -20, 52, -19.5); ctx.lineTo(48, -11 + jaw * 0.55); ctx.quadraticCurveTo(36, -10 + jaw, 23, -14); ctx.closePath();
      ctx.fillStyle = C.mouth; ctx.fill(); ctx.lineWidth = o; ctx.strokeStyle = LINE; ctx.stroke();
      ctx.fillStyle = C.tongueLo; ctx.beginPath(); ctx.ellipse(37, -11 + jaw * 0.7, 10, 2.6 + jaw * 0.12, 0, 0, TAU); ctx.fill();
    } else { // closed: a long smile that curls up behind the cheek
      ctx.beginPath(); ctx.moveTo(53, -19); ctx.quadraticCurveTo(38, -15, 22, -17.5); ctx.quadraticCurveTo(19, -18, 17.5, -21.5);
      ctx.lineWidth = o * 0.85; ctx.strokeStyle = LINE; ctx.stroke();
    }
    // tongue: from the front of the jaw; sags a little in the middle; a sticky bulb at the tip
    const root = [48, -15];
    let tp = tip;
    if (!tp && lick >= 0) { // the lip-lick telegraph: the tip sweeps up over the lip and back, twice
      const a = Math.sin(lick * TAU * 2) * 0.5 + 0.35, e = 9 + 5 * Math.sin(lick * Math.PI);
      tp = { x: root[0] + Math.cos(a) * e * 0.9 - 2, y: root[1] - 4 - Math.sin(a) * e, lickOnly: true };
    }
    if (tp) {
      const n = 10, mx = (root[0] + tp.x) / 2, my = (root[1] + tp.y) / 2 + (tp.lickOnly ? 0 : clamp(Math.hypot(tp.x - root[0], tp.y - root[1]) * 0.06, 0, 9));
      const P = (u) => [(1 - u) * (1 - u) * root[0] + 2 * u * (1 - u) * mx + u * u * tp.x, (1 - u) * (1 - u) * root[1] + 2 * u * (1 - u) * my + u * u * tp.y];
      const path = () => { ctx.beginPath(); ctx.moveTo(root[0], root[1]); for (let i = 1; i <= n; i++) { const p = P(i / n); ctx.lineTo(p[0], p[1]); } };
      path(); ctx.lineWidth = 7.4 + o * 2; ctx.strokeStyle = LINE; ctx.stroke();
      path(); ctx.lineWidth = 7.4; ctx.strokeStyle = C.tongue; ctx.stroke();
      ctx.save(); ctx.translate(-0.8, -1.2); path(); ctx.lineWidth = 2.2; ctx.strokeStyle = '#ff9fb4'; ctx.stroke(); ctx.restore();
      const tr = tp.lickOnly ? 4 : 5.8;
      ctx.beginPath(); ctx.arc(tp.x, tp.y, tr, 0, TAU); ctx.fillStyle = C.tongue; ctx.fill(); ctx.lineWidth = o * 0.9; ctx.strokeStyle = LINE; ctx.stroke();
      ctx.beginPath(); ctx.arc(tp.x - 1.4, tp.y - 1.6, tr * 0.32, 0, TAU); ctx.fillStyle = '#ffc2d0'; ctx.fill();
    }
    // nostril, ear drum, cheek
    ctx.fillStyle = LINE; ctx.beginPath(); ctx.ellipse(47, -26.5, 1.9, 1.3, 0.3, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(13, -24, 6.2, 0, TAU); ctx.fillStyle = C.shade; ctx.fill(); ctx.lineWidth = o * 0.8; ctx.strokeStyle = LINE; ctx.stroke();
    ctx.beginPath(); ctx.arc(12.4, -24.4, 3.2, 0, TAU); ctx.fillStyle = C.base; ctx.fill();
    // near eye (the big one, on top of the head)
    eyeAt(27, -39.5, 10.6, false);
    // sweat drops when scared
    if (scared > 0.05) {
      ctx.fillStyle = C.sweat; ctx.strokeStyle = LINE; ctx.lineWidth = o * 0.6;
      for (let i = 0; i < 2; i++) {
        const ph = mod(t * 2.2 + i * 0.5, 1), dx = -20 - 12 * i - ph * 14, dy = -48 - 8 * i - Math.sin(ph * Math.PI) * 10 + ph * 10;
        ctx.globalAlpha = scared * (1 - ph);
        ctx.beginPath(); ctx.moveTo(dx, dy - 5); ctx.quadraticCurveTo(dx + 4.2, dy + 1, dx, dy + 3.4); ctx.quadraticCurveTo(dx - 4.2, dy + 1, dx, dy - 5); ctx.fill(); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (op.prey && tip) op.prey(ctx);
  } catch (e) { /* art never breaks the frame */ }
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
    ctx.lineWidth = 0.035; ctx.strokeStyle = '#d8ffb0'; ctx.lineCap = 'round';
    ctx.beginPath();
    let c = null;
    for (let i = 0; i <= 24; i++) { c = sim.frogCurve(F, i / 24); const x = c.r * Math.cos(c.w), y = c.r * Math.sin(c.w); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.stroke();
    ctx.setLineDash([]);
    const x = c.r * Math.cos(c.w), y = c.r * Math.sin(c.w), pu = 0.5 + 0.5 * Math.sin(t * 9);
    ctx.lineWidth = 0.04; ctx.strokeStyle = `rgba(216,255,176,${0.5 + 0.4 * pu})`;
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

export function drawFrogs(ctx, sim, t, k) {
  const list = sim.frogs || [];
  if (!list.length) return;
  for (const F of list) {
    let R = frogAnim.get(F.id);
    const fresh = !R || R.sim !== sim || t < R.t - 0.5;
    if (fresh) { R = { sim, t, fx: F.face, plug: F.gi >= 0 ? 1 : 0, look: { x: 0.3, y: 0 }, lean: 0, tip: null }; frogAnim.set(F.id, R); }
    const dt = clamp(t - R.t, 0, 0.1);
    R.t = t;
    const ease = (a, b, r) => a + (b - a) * Math.min(1, dt * r);
    R.fx = ease(R.fx, F.face, 14);
    R.plug = ease(R.plug, F.gi >= 0 && F.ph !== 'hop' ? 1 : 0, 9);
    // basis: e1 along the surface in the frog's facing direction, e2 out of the surface
    const tx = F.ny * F.face, ty = -F.nx * F.face, nx = F.nx, ny = F.ny;
    const toLocal = (wx, wy, um) => ({ x: ((wx - F.x) * tx + (wy - F.y) * ty) * um, y: -((wx - F.x) * nx + (wy - F.y) * ny) * um });
    const sPx = FROG.w * FROG_ART * k, um = 100 / (FROG.w * FROG_ART);
    const ch = { face: F.face, id: F.id, um, scared: F.sc ? 1 : 0 };
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
      case 'gulp': ch.gulp = clamp(F.t / F.dur, 0, 1); ch.puff = 0.3 + 0.35 * Math.sin(ch.gulp * Math.PI); break;
    }
    if (F.bump > 0 && F.ph === 'sit') ch.squash = 0.3 * F.bump;
    ch.plug = R.plug;
    ch.blink = blinkAt(t, F.id);
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
    const mouth = { x: 48, y: -15 };
    if (F.ph === 'tongue') {
      const T = toLocal(F.got ? F.px : F.lx, F.got ? F.py : F.ly, um), e = ch.tongueE;
      const far = clamp(Math.hypot(T.x - mouth.x, T.y - mouth.y), 1, 1e9), cap = Math.min(1, (FROG_MODE.hard.tongue * 1.1 * um) / far);
      ch.tongue = { x: mouth.x + (T.x - mouth.x) * e * cap, y: mouth.y + (T.y - mouth.y) * e * cap };
      if (F.got && F.t >= FROG.tongueT * FROG.grab) { const pk = F.pk, ty2 = F.pty; ch.prey = (c2) => frogPrey(c2, pk, ty2, ch.tongue.x, ch.tongue.y, um, e, t); }
    }
    if (F.ph === 'gulp') ch.lick = -1;
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
    const th = Math.atan2(-F.nx, F.ny);
    ch.mouth = ch.mouth || 0;
    lickMark(ctx, F, t);
    ctx.save();
    ctx.translate(F.x, F.y);
    ctx.scale(1 / k, -1 / k);
    try { ctx.rotate(-th); drawFrog(ctx, 0, 0, sPx, t, ch); } catch (e) { /* art never breaks the frame */ }
    ctx.restore();
  }
}

// the swallowed thing riding the tongue tip (art units; the frame is the frog's)
function frogPrey(ctx, kind, type, x, y, um, e, t) {
  const sc = clamp(0.35 + 0.65 * e, 0.3, 1);
  ctx.save();
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
    case 'frogBounce':
      audio.play('egg_bump', { vol: 0.5, pitch: 0.7 });
      fx.dust(ev.x, ev.y, 3, 'rgba(190,230,150,0.7)');
      popup(ev.x, ev.y + 0.9, 'Boing!', { color: '#c9ff9e', size: 13, life: 0.7 });
      once('frogBounce', 'Soft landing! An egg that falls on the frog never cracks.');
      break;
  }
}
