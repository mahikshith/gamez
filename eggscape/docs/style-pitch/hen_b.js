// STYLE PITCH, candidate B: "Bertha". Not wired into the game.
// The chunky one, all attitude: ONE wide gumdrop mass (head and body are the same shape, the face slides and tilts
// on it), heavy violet-shadowed lids at half mast, thick low brows, a big pouting beak, a comb flopped over like a
// quiff, caramel wings planted on her hips, a caramel fan of a tail. No ink contour: colour blocks, a soft 3-tone cel
// lit from the top-left, a rim light in the shade, a hair-thin same-hue edge.
// drawHenB(ctx, x, y, size, state, t, opts): same contract as drawHenA (see hen_a.js).
import { TAU, clamp, REST, resolvePose, spline, addFeather, celFill, celLite, drawEye, drawBrow, drawBeak, drawWattle, wingPath, drawFoot, drawFx, groundShadow } from './hen_kit.js';

const C = {
  body: { hi: '#ffffff', base: '#fff3dd', mid: '#ffdfb6', shade: '#f3b87a', rim: '#fff0da', edge: '#cf9458', ew: 1.1 },
  wing: { base: '#f8a94f', mid: '#ee9038', shade: '#d26f24', edge: '#b3591b', ew: 1 },
  tail: { base: '#f8a94f', mid: '#ee9038', shade: '#d26f24', edge: '#b3591b', ew: 1 },
  red: { base: '#ff4b3e', mid: '#ee2f38', shade: '#c9173a', edge: '#a8102f', ew: 0.9 },
  beak: { base: '#ffc02e', mid: '#ffa41c', shade: '#f5820f', lo: '#ee7a0c', mouth: '#7d1730', tongue: '#ff7f93', gl: 'rgba(255,244,200,0.85)', nos: '#d9690a' },
  foot: { base: '#ffab24', mid: '#fb9416', shade: '#e9760c' },
  eye: { white: '#ffffff', shadow: '#dcdcf4', pupil: '#2a1730', iris: '#8a4a2c', lid: '#b98ae6', lidHi: 'rgba(240,222,255,0.55)', lidLo: '#ffe3c2', lash: '#3d2130', rim: '#dba36e', lashW: 2.3 },
  brow: '#5b3320', blush: '#ff8f8a', tick: '#eeb277', speck: '#f1a04a',
};
const PER = { id: 'b', lag: 1.25, rest: Object.assign({}, REST, { lidL: 0.34, lidR: 0.34, arc: 0.14, bl: 0.2, br: 0.2, by: -0.9, mo: -0.55, ps: 0.92, px: 0.36, py: 0.1, blush: 0.45 }) };

const BODY = [[0, -85], [19, -82.5], [33, -70], [39.5, -51], [42.5, -31], [38, -14], [21, -6.5], [0, -5.5], [-21, -6.5], [-38, -14], [-42.5, -31], [-39.5, -51], [-33, -70], [-19, -82.5]];
const LOBE = [[0, 0.6], [0.3, 0.96], [0.62, 1], [0.86, 0.74]];

export function drawHenB(ctx, x, y, size, state = 'idle', t = 0, opts = {}) {
  if (!(size > 0)) return;
  const o = Object.assign({ face: -1 }, opts);
  const p = resolvePose(state, t, PER, o);
  const T = clamp(p.turn, -1.35, 1.35), aT = Math.abs(T), sg = T < 0 ? -1 : 1;
  const lean = p.lean + p.hr * 0.65;
  const sxk = 1 + p.sq * 0.7, syk = 1 - p.sq, cl = Math.cos(lean), sl = Math.sin(lean);
  const toBase = (bx, by) => { const X = bx * sxk, Y = by * syk; return [X * cl - Y * sl, X * sl + Y * cl]; };

  // face layout (it slides on the mass)
  const fc = T * 12.5 + p.hx * 0.8, eyeY = -57.5 + (p.hy + p.hlag) * 0.8 + p.nod * 4.4;
  const eye = (w) => {
    const far = w * T > 0;
    return { x: fc + w * 12 - (far ? w * aT * 3.4 : 0), rx: 10.8 * (0.9 + 0.1 * p.open) * (far ? 1 - 0.2 * aT : 1 + 0.03 * aT), ry: 10.4 * p.open * (1 - 0.1 * Math.abs(p.nod)) };
  };
  const EL = eye(-1), ER = eye(1);
  const bkx = fc + T * 8.5, bky = eyeY + 10.5;

  ctx.save();
  try {
    ctx.translate(x, y); ctx.scale(size / 100, size / 100);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (o.shadow !== false) groundShadow(ctx, p, 33, o.shadowColor);
    ctx.translate(p.x, -p.y);
    const hc = toBase(fc * 0.4, -56);
    const A = { hx: hc[0], hy: hc[1], hr: 35, eL: toBase(EL.x, eyeY), eR: toBase(ER.x, eyeY), beak: toBase(bkx + T * 5, bky + 4), dir: sg, bx: 0, by: -45, feather: '#fff1dc', wave: null };
    drawFx(ctx, p, t, A, true);

    for (const w of [-1, 1]) {
      const st = w < 0 ? p.sl : p.sr, lf = w < 0 ? p.fl : p.fr, fx = w * 14 + T * 2 + st, hip = toBase(w * 13 + T * 2, -11);
      drawFoot(ctx, fx, -lf, hip[0], Math.min(hip[1], -lf - 5.5), T * 0.8, C.foot, 1.42);
    }

    ctx.save();
    ctx.rotate(lean); ctx.scale(sxk, syk);

    if (aT > 0.1) { // tail: a caramel fan off the back
      const k = Math.min(1, aT * 1.5), tp = new Path2D(), mag = 0.5 - 0.4 * p.ta + p.tr * 0.7, L = [26, 36, 30];
      for (let i = -1; i <= 1; i++) addFeather(tp, -sg * Math.min(33, aT * 52), -36 - i * 3, -sg * (mag + i * 0.42), L[i + 1] * k, 14 * k, sg * (0.4 - p.tr * 0.9 - i * 0.12));
      celLite(ctx, tp, C.tail, 2.2, 2.8);
    }
    const wing = (w) => {
      const near = w * T <= 0, sx = w * 37 + T * (near ? 10 : 2);
      return wingPath(sx, -39, w, w < 0 ? p.wl : p.wr, w < 0 ? p.wbl : p.wbr, p.ws, 27, 15.5, 0.12);
    };
    const WL = wing(-1), WR = wing(1);
    const behind = (w) => w * T > 0.25;
    for (const [w, W] of [[-1, WL], [1, WR]]) if (behind(w)) celLite(ctx, W.path, C.wing, 2, 2.6);

    { // comb: a quiff of four lobes, flopped toward where she faces (to her left when she looks straight at you)
      const cp = new Path2D(), f = clamp(T * 3 + 0.7, -1, 1), st = 1 + p.cs + p.cb * 0.16, dr = p.cb < 0 ? -p.cb : 0, up = p.cb > 0 ? p.cb : 0;
      const cx0 = fc * 0.45, flop = (0.9 + dr * 0.5) * (1 - up * 0.7);
      const cr = p.cr;
      addFeather(cp, cx0 - f * 10, -80, cr - f * 0.55, 9 * st, 10, cr, LOBE);
      addFeather(cp, cx0 - f * 4, -82, cr - f * 0.05 * flop, 13.5 * st, 12.5, f * 0.3 * flop + cr * 1.2, LOBE);
      addFeather(cp, cx0 + f * 9, -79, cr + f * 1.15 * flop, 14 * st, 12, f * 0.85 * flop + cr * 1.5, LOBE);
      addFeather(cp, cx0 + f * 3, -82, cr + f * 0.5 * flop, 17.5 * st, 14, f * 0.75 * flop + cr * 1.6, LOBE);
      celLite(ctx, cp, C.red, 2, 2.4);
      ctx.fillStyle = 'rgba(255,214,190,0.7)'; ctx.beginPath(); ctx.ellipse(cx0 - f * 3 + Math.sin(cr) * 10, -82 - 9.5 * st, 2.6, 1.4, -0.5, 0, TAU); ctx.fill();
    }

    // the one big mass, with fluffy hips
    const bp = spline(BODY.map((q) => [q[0] + T * 1.5 * (1 + q[1] / 85), q[1]]));
    addFeather(bp, 38.5, -22, 2.0 - p.tr * 0.4, 9.5, 8, 0.5); addFeather(bp, 34, -14, 2.4 - p.tr * 0.4, 8, 7, 0.5);
    addFeather(bp, -38.5, -22, -2.0 - p.tr * 0.4, 9.5, 8, -0.5); addFeather(bp, -34, -14, -2.4 - p.tr * 0.4, 8, 7, -0.5);
    celFill(ctx, bp, C.body, 4.2, 5.4, [-30, -86, 8, -20]);
    // feather ticks on the belly
    ctx.strokeStyle = C.tick; ctx.lineWidth = 1.25;
    for (const [qx, qy] of [[-9, -19], [2, -16.5], [12, -20]]) { ctx.beginPath(); ctx.arc(qx + T * 9, qy, 3, 0.25, Math.PI - 0.25); ctx.stroke(); }

    // face
    ctx.save();
    ctx.translate(fc, eyeY + 6); ctx.rotate(p.hr * 0.35); ctx.translate(-fc, -eyeY - 6);
    const bl = clamp(p.blush + p.flush * 0.5, 0, 1.4);
    if (bl > 0.02) {
      ctx.save(); ctx.globalAlpha *= Math.min(1, 0.55 * bl); ctx.fillStyle = p.flush > 0.3 ? '#ff6a5e' : C.blush;
      for (const w of [-1, 1]) { const far = w * T > 0; ctx.beginPath(); ctx.ellipse(fc + w * (23.5 - (far ? aT * 7 : 0)), eyeY + 13.5, 6 * (far ? 1 - aT * 0.5 : 1), 3.5, 0, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    const lidTilt = (b) => (b > 0 ? b * 0.55 : b * 0.3);
    drawEye(ctx, EL.x, eyeY, EL.rx, EL.ry, { lidU: p.lidL, lidL: p.low, tilt: lidTilt(p.bl), arc: p.arc, px: p.px, py: p.py, ps: p.ps, wet: p.wet, side: -1 }, C.eye, t);
    drawEye(ctx, ER.x, eyeY, ER.rx, ER.ry, { lidU: p.lidR, lidL: p.low, tilt: lidTilt(p.br), arc: p.arc, px: p.px, py: p.py, ps: p.ps, wet: p.wet, side: 1 }, C.eye, t);
    drawWattle(ctx, bkx + T * 3, bky + 7.5 + p.beak * 8.5, 11.5, 8.8, p.wtr, p.wts, C.red);
    drawBeak(ctx, bkx, bky, 11.2, 11, T, p.beak, p.mo, C.beak);
    drawBrow(ctx, EL.x - 0.5, eyeY - EL.ry - 2.2 - p.by + Math.max(0, p.bl) * 1.6, 8 * (EL.rx / 10.8), p.bl * 0.5, -1, C.brow, 2.9, 1.7);
    drawBrow(ctx, ER.x + 0.5, eyeY - ER.ry - 2.2 - p.by + Math.max(0, p.br) * 1.6, 8 * (ER.rx / 10.8), p.br * 0.5, 1, C.brow, 2.9, 1.7);
    ctx.restore();

    for (const [w, W] of [[-1, WL], [1, WR]]) if (!behind(w)) celLite(ctx, W.path, C.wing, 2, 2.6);
    if (state === 'wave') { const W = p.wl > p.wr ? WL : WR; A.wave = toBase(W.tip[0], W.tip[1]); }
    ctx.restore();

    drawFx(ctx, p, t, A, false);
  } catch (e) {
    if (o.debug) throw e; // art must never break the frame
  }
  ctx.restore();
}
export default drawHenB;
