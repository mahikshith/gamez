// STYLE PITCH, candidate A: "Etta". Not wired into the game.
// The sweet one with sass: a big round head on a plump pear body (the head is a separate mass, so it can lag, tilt and
// bob on its own), huge lashed eyes, a small smiling beak, a bouncy three-lobe comb. No ink contour: colour blocks,
// a soft 3-tone cel lit from the top-left, a rim light in the shade, a hair-thin same-hue edge.
// drawHenA(ctx, x, y, size, state, t, opts): (x, y) = the ground point between her feet; size = her height in px
// (feet to the top of the comb); state: one of HEN_STATES; t: seconds since the state began; opts: { face: 1 | -1
// (which way her three-quarter view looks; default -1 = toward the nest on her left), shadow: false to skip the
// ground shadow, from: { state, t } + mix: 0..1 to cross-fade from another state, blink: false, turn: override }.
import { TAU, clamp, REST, resolvePose, spline, addFeather, celFill, celLite, drawEye, drawBrow, drawBeak, drawWattle, wingPath, drawFoot, drawFx, groundShadow } from './hen_kit.js';

const C = {
  body: { hi: '#ffffff', base: '#fff4e3', mid: '#ffe3c4', shade: '#f6c49b', rim: '#ffeedd', edge: '#d9a273', ew: 1.1 },
  wing: { base: '#ffe6c6', mid: '#fbd0a4', shade: '#eeb07c', rim: '#ffe9d0', edge: '#d49a68', ew: 1 },
  tail: { base: '#ffd09c', mid: '#f9b677', shade: '#e8975a', edge: '#cf8248', ew: 1 },
  red: { base: '#ff4b3e', mid: '#ee2f38', shade: '#c9173a', rim: '#ff8a6a', hi: '#ff7a5c', edge: '#a8102f', ew: 0.9 },
  beak: { base: '#ffbe2e', mid: '#ffa41c', shade: '#f5820f', lo: '#ee7a0c', mouth: '#7d1730', tongue: '#ff7f93', gl: 'rgba(255,244,200,0.85)', nos: '#d9690a' },
  foot: { base: '#ffab24', mid: '#fb9416', shade: '#e9760c' },
  eye: { white: '#ffffff', shadow: '#e3e4f6', pupil: '#2a1730', iris: '#8a4a2c', lid: '#ffe2c4', lidLo: '#ffe8cf', lash: '#3d2130', rim: '#e3ad82', flick: 3.6, lashW: 1.9 },
  brow: '#8f4f2c', blush: '#ff8f8a', tick: '#eeb98c',
};
const PER = { id: 'a', lag: 1, rest: Object.assign({}, REST, { mo: 0.6, lidL: 0.15, lidR: 0.15, ps: 1.08, by: 0.4 }) };

const HEAD = [[0, -24], [14, -21.5], [24, -11.5], [27.5, 1.5], [26, 13], [17.5, 21], [6.5, 24.6], [0, 25], [-6.5, 24.6], [-17.5, 21], [-26, 13], [-27.5, 1.5], [-24, -11.5], [-14, -21.5]];
const BODY = [[0, -50], [18, -47], [30, -35], [33, -21], [27.5, -10], [13.5, -5.6], [0, -5], [-13.5, -5.6], [-27.5, -10], [-33, -21], [-30, -35], [-18, -47]];
const LOBE = [[0, 0.6], [0.3, 0.96], [0.62, 1], [0.86, 0.74]];

export function drawHenA(ctx, x, y, size, state = 'idle', t = 0, opts = {}) {
  if (!(size > 0)) return;
  const o = Object.assign({ face: -1 }, opts);
  const p = resolvePose(state, t, PER, o);
  const T = clamp(p.turn, -1.35, 1.35), aT = Math.abs(T), sg = T < 0 ? -1 : 1;
  const sxk = 1 + p.sq * 0.7, syk = 1 - p.sq, cl = Math.cos(p.lean), sl = Math.sin(p.lean);
  const toBase = (bx, by) => { const X = bx * sxk, Y = by * syk; return [X * cl - Y * sl, X * sl + Y * cl]; };
  const hcx = p.hx + T * 2.4, hcy = -62 + p.hy + p.hlag + p.nod * 2.2;
  const ch = Math.cos(p.hr), sh = Math.sin(p.hr);
  const headTo = (lx, ly) => toBase(hcx + lx * ch - ly * sh, hcy + lx * sh + ly * ch);

  // face layout (head-local)
  const fc = T * 9.4, eyeY = -2.6 + p.nod * 3.6;
  const eye = (w) => {
    const far = w * T > 0;
    return { x: fc + w * 9.6 - (far ? w * aT * 2.7 : 0), rx: 8.7 * (0.9 + 0.1 * p.open) * (far ? 1 - 0.2 * aT : 1 + 0.03 * aT), ry: 10.9 * p.open * (1 - 0.1 * Math.abs(p.nod)) };
  };
  const EL = eye(-1), ER = eye(1);
  const bkx = fc + T * 6.8, bky = eyeY + 8.6;

  ctx.save();
  try {
    ctx.translate(x, y); ctx.scale(size / 100, size / 100);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (o.shadow !== false) groundShadow(ctx, p, 25, o.shadowColor);
    ctx.translate(p.x, -p.y);
    const hc = toBase(hcx, hcy);
    const A = { hx: hc[0], hy: hc[1], hr: 27, eL: headTo(EL.x, eyeY), eR: headTo(ER.x, eyeY), beak: headTo(bkx + T * 4, bky + 3), dir: sg, bx: 0, by: -40, feather: '#fff1dc', wave: null };
    drawFx(ctx, p, t, A, true);

    // feet (planted: outside the lean and the squash)
    const air = clamp(p.y / 8, 0, 1);
    for (const w of [-1, 1]) {
      const st = w < 0 ? p.sl : p.sr, lf = w < 0 ? p.fl : p.fr, fx = w * 9.5 + T * 1.5 + st - p.x * (1 - air) * 0, hip = toBase(w * 9 + T * 2, -11);
      drawFoot(ctx, fx, -lf, hip[0], Math.min(hip[1], -lf - 5), T * 0.8, C.foot, 1.15);
    }

    ctx.save();
    ctx.rotate(p.lean); ctx.scale(sxk, syk);

    // tail: three plumes off the back, only once she turns
    if (aT > 0.1) {
      const k = Math.min(1, aT * 1.5), tp = new Path2D(), mag = 0.55 - 0.4 * p.ta + p.tr * 0.7;
      const L = [21, 29, 24];
      for (let i = -1; i <= 1; i++) addFeather(tp, -sg * Math.min(25, aT * 38), -26 - i * 3, -sg * (mag + i * 0.42), L[i + 1] * k, 11.5 * k, sg * (0.35 - p.tr * 0.9 - i * 0.12));
      celLite(ctx, tp, C.tail, 2, 2.6);
    }
    // wings
    const wing = (w) => {
      const near = w * T <= 0, sx = w * 23.5 + T * (near ? 9 : 3);
      return wingPath(sx * 1.05, -37.5, w, w < 0 ? p.wl : p.wr, w < 0 ? p.wbl : p.wbr, p.ws, 24, 13, near ? 0.2 : 0.3);
    };
    const WL = wing(-1), WR = wing(1);
    const behind = (w) => w * T > 0.25;
    for (const [w, W] of [[-1, WL], [1, WR]]) if (behind(w)) celLite(ctx, W.path, C.wing, 1.8, 2.4);

    // body
    const bp = spline(BODY.map((q) => [q[0] + T * 2, q[1]]));
    celFill(ctx, bp, C.body, 3.4, 4.4, [-22, -52, 6, -14]);
    ctx.strokeStyle = C.tick; ctx.lineWidth = 1.15; // a few feather ticks on the chest
    for (const [qx, qy] of [[-5, -24], [4, -22.5], [-1, -17]]) { ctx.beginPath(); ctx.arc(qx + T * 9, qy, 2.6, 0.25, Math.PI - 0.25); ctx.stroke(); }

    // the head's cast shadow on the chest (this, not a line, separates the two masses)
    const hp = spline(HEAD);
    addFeather(hp, 24.5, 11, 1.95 + p.cr * 0.5, 8, 6.5, 0.5); addFeather(hp, 22, 16.5, 2.35 + p.cr * 0.5, 6.5, 5.5, 0.5);
    addFeather(hp, -24.5, 11, -1.95 + p.cr * 0.5, 8, 6.5, -0.5); addFeather(hp, -22, 16.5, -2.35 + p.cr * 0.5, 6.5, 5.5, -0.5);
    ctx.save(); ctx.clip(bp); ctx.translate(hcx + 1.6, hcy + 4.6); ctx.rotate(p.hr); ctx.fillStyle = C.body.shade; ctx.fill(hp); ctx.restore();

    // head
    ctx.save();
    ctx.translate(hcx, hcy); ctx.rotate(p.hr);
    { // comb: three bouncy lobes; the base is tucked behind the head
      const cp = new Path2D(), sp = 0.6 + 0.4 * aT, st = 1 + p.cs + p.cb * 0.14, dr = p.cb < 0 ? -p.cb : 0;
      const cx0 = -T * 1.5, a0 = p.cr + T * 0.25 - sg * dr * 0.5;
      addFeather(cp, cx0 - 6.5 * sp, -17.5, a0 - 0.7 * sp - 0.1, 13 * st * (1 - dr * 0.2), 11.5, p.cr * 1.2 - sg * dr * 0.6, LOBE);
      addFeather(cp, cx0 + 7 * sp, -17.5, a0 + 0.7 * sp + 0.1, 13.5 * st * (1 - dr * 0.2), 11.8, p.cr * 1.2 - sg * dr * 0.6, LOBE);
      addFeather(cp, cx0, -18, a0, 20 * st * (1 - dr * 0.25), 13.5, p.cr * 1.5 - sg * dr * 0.9, LOBE);
      celLite(ctx, cp, C.red, 1.9, 2.3);
      ctx.fillStyle = 'rgba(255,214,190,0.7)'; const q = Math.sin(a0) * 12; ctx.beginPath(); ctx.ellipse(cx0 - 2.6 + q, -18 - 15 * st, 2.3, 1.3, -0.6, 0, TAU); ctx.fill();
    }
    celFill(ctx, hp, C.body, 3.4, 4.4, [-20, -24, 4, 12]);
    // blush
    const bl = clamp(p.blush + p.flush * 0.5, 0, 1.4);
    if (bl > 0.02) {
      ctx.save(); ctx.globalAlpha *= Math.min(1, 0.55 * bl); ctx.fillStyle = p.flush > 0.3 ? '#ff6a5e' : C.blush;
      for (const w of [-1, 1]) { const far = w * T > 0; ctx.beginPath(); ctx.ellipse(fc + w * (17.5 - (far ? aT * 5 : 0)), eyeY + 12.5, 5.2 * (far ? 1 - aT * 0.45 : 1), 3.1, 0, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    // eyes
    const lidTilt = (b) => (b > 0 ? b * 0.5 : b * 0.3);
    drawEye(ctx, EL.x, eyeY, EL.rx, EL.ry, { lidU: p.lidL, lidL: p.low, tilt: lidTilt(p.bl), arc: p.arc, px: p.px, py: p.py, ps: p.ps, wet: p.wet, side: -1 }, C.eye, t);
    drawEye(ctx, ER.x, eyeY, ER.rx, ER.ry, { lidU: p.lidR, lidL: p.low, tilt: lidTilt(p.br), arc: p.arc, px: p.px, py: p.py, ps: p.ps, wet: p.wet, side: 1 }, C.eye, t);
    // wattle, beak
    drawWattle(ctx, bkx + T * 2.2, bky + 5.4 + p.beak * 6.5, 7.5, 6.4, p.wtr, p.wts, C.red);
    drawBeak(ctx, bkx, bky, 7.6, 8.4, T, p.beak, p.mo, C.beak);
    // brows (drawn last: they may press down over the lids)
    drawBrow(ctx, EL.x - 0.5, eyeY - EL.ry - 1.9 - p.by + Math.max(0, p.bl) * 1.2, 5.6 * (EL.rx / 8.7), p.bl * 0.5, -1, C.brow, 1.9, 1.1);
    drawBrow(ctx, ER.x + 0.5, eyeY - ER.ry - 1.9 - p.by + Math.max(0, p.br) * 1.2, 5.6 * (ER.rx / 8.7), p.br * 0.5, 1, C.brow, 1.9, 1.1);
    ctx.restore();

    // near wings in front (in front of the head too: hands to the cheeks, a wipe, a wave)
    for (const [w, W] of [[-1, WL], [1, WR]]) if (!behind(w)) {
      const rs = w < 0 ? p.wl : p.wr;
      if (rs < 0.7) { ctx.save(); ctx.globalAlpha *= 1 - rs / 0.7; ctx.translate(1.5, 2.4); ctx.fillStyle = 'rgba(226,160,110,0.55)'; ctx.fill(W.path); ctx.restore(); } // contact shadow while it lies on the body
      celLite(ctx, W.path, C.wing, 1.8, 2.4);
    }
    if (state === 'wave') { const W = p.wl > p.wr ? WL : WR; A.wave = toBase(W.tip[0], W.tip[1]); }
    ctx.restore();

    drawFx(ctx, p, t, A, false);
  } catch (e) {
    if (o.debug) throw e; // art must never break the frame
  }
  ctx.restore();
}
export default drawHenA;
