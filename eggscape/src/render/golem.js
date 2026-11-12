// The Crystal Golem: the world 4 boss (sim kind 'golem'). A crystal brute on a slab of cave rock over the vault: a small
// head sunk between spiked shoulders, a glowing core, forearms like pillars. Faceted planes instead of soft bands (it is
// crystal): one light, top-left; thin same-hue lines. Fists, body, head and jaw ride springs, so every move overshoots.
//   stomp: crouches, heaves both fists overhead, hammers the slab (the vault quakes, crystal walls rise)
//   punch: cocks the fist on the side the ring will spin toward, then throws it across
//   hurt:  recoils, chips fly off; dizzy / frozen: the shared status looks; beaten: slumps, core and eyes go dark
// Drawn in px space at the boss pose, y down; s = pose height in px.
import { clamp, lerp, ss, hash, blinkAt, ik, contact, burst } from './castkit.js';
import { dizzyStars } from './status.js';

const TAU = Math.PI * 2;
const C = { cry: '#ab8ff0', hi: '#ece2ff', lo: '#6a4cc6', deep: '#3f2c86', rock: '#2c2150', rockHi: '#4d3f80', line: '#231746', glow: '#5ff0e0', glowHi: '#dafffb', glowLo: '#1c8f92', dead: '#3f5a66' };
let S = null;
function spr(key, target, dt, k = 170, d = 15) {
  if (S[key] === undefined) { S[key] = target; S[key + 'V'] = 0; }
  S[key + 'V'] += ((target - S[key]) * k - S[key + 'V'] * d) * dt;
  S[key] += S[key + 'V'] * dt;
  return S[key];
}
function stateOf(sim, B) {
  if (sim.state === 'won' || sim.state === 'winning') return 'beaten';
  if (sim.state === 'failed') return 'gloat';
  if (B.dizzy > 0) return 'dizzy';
  if (B.flinch > 0) return 'hurt';
  const A = B.atk;
  if (A && (A.name === 'stomp' || A.name === 'punch')) return A.name;
  return 'idle';
}
function poly(ctx, P, fill, line, lw) {
  ctx.beginPath();
  for (let i = 0; i < P.length; i++) if (i) ctx.lineTo(P[i][0], P[i][1]); else ctx.moveTo(P[0][0], P[0][1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (line) { ctx.lineWidth = lw; ctx.strokeStyle = line; ctx.stroke(); }
}
// a crystal prism growing from (x, y) along ang (0 = up): lit left face, shaded right face
function prism(ctx, x, y, w, h, ang, lw, glow) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  poly(ctx, [[-w / 2, 0], [-w / 2, -h * 0.68], [0, -h], [w / 2, -h * 0.68], [w / 2, 0]], glow ? C.glowLo : C.lo, C.line, lw);
  poly(ctx, [[-w / 2, 0], [-w / 2, -h * 0.68], [0, -h], [-w * 0.08, -h * 0.6], [-w * 0.08, 0]], glow ? C.glow : C.cry);
  poly(ctx, [[-w / 2, -h * 0.68], [0, -h], [-w * 0.08, -h * 0.6]], glow ? C.glowHi : C.hi);
  ctx.restore();
}
// a faceted limb segment from a to b with half-widths w0, w1
function seg(ctx, a, b, w0, w1, lo, base, hi, lw) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, sgn = nx * -0.55 + ny * -1 > 0 ? 1 : -1; // which side faces the light
  const A1 = [a[0] + nx * w0, a[1] + ny * w0], A2 = [a[0] - nx * w0, a[1] - ny * w0], B1 = [b[0] + nx * w1, b[1] + ny * w1], B2 = [b[0] - nx * w1, b[1] - ny * w1];
  poly(ctx, [A1, B1, B2, A2], lo, C.line, lw);
  const q = 0.15 * sgn, M1 = [a[0] + nx * w0 * q, a[1] + ny * w0 * q], M2 = [b[0] + nx * w1 * q, b[1] + ny * w1 * q];
  poly(ctx, sgn > 0 ? [A1, B1, M2, M1] : [A2, B2, M2, M1], base);
  if (hi) { const h = 0.62 * sgn, H1 = [a[0] + nx * w0 * h, a[1] + ny * w0 * h], H2 = [b[0] + nx * w1 * h, b[1] + ny * w1 * h]; poly(ctx, sgn > 0 ? [A1, B1, H2, H1] : [A2, B2, H2, H1], hi); }
}

export function drawGolem(ctx, sim, B, Q, s, t, warnU, acting, calm, frozen) {
  if (!S || S.sim !== sim || S.B !== B) S = { sim, B, t, st: 'idle', land: 9, beat: 0, wasUp: false, chip: 9 };
  const dt = clamp(t - S.t, 0, 0.05); S.t = t;
  const st = frozen ? S.st : stateOf(sim, B);
  if (st === 'hurt' && S.st !== 'hurt') S.chip = 0;
  S.st = st; S.chip += dt;
  const A = B.atk, face = Q.dir || 1, FY = 0.44;
  // ---- targets: fists (left, right), body, head
  let lift = 0, rot = 0, sq = 0, jaw = 0.1, anger = 0.6, core = 0.55 + 0.15 * Math.sin(t * 2.2), headY = 0, headR = 0, shake = 0, eyes = 'on';
  const F = [[-0.56, FY - 0.085], [0.56, FY - 0.085]];
  let look = { x: face * 0.5, y: 0.6 }, landed = false, pdir = 0;
  if (st === 'idle') {
    sq = 0.012 * Math.sin(t * 1.5); headR = 0.05 * Math.sin(t * 0.8);
    const f = t % 5.3; if (f < 0.5 && !calm) { const i = Math.floor(t / 5.3) % 2; F[i][1] -= 0.07 * Math.sin((f / 0.5) * Math.PI); } // drums a fist now and then
  } else if (st === 'stomp') {
    const dip = ss(0, 0.2, warnU) * (1 - ss(0.2, 0.4, warnU)), up = ss(0.2, 0.75, warnU);
    landed = acting;
    if (!landed) {
      for (const i of [0, 1]) { const sg = i ? 1 : -1; F[i] = [sg * lerp(0.56, 0.33, up), lerp(FY - 0.085, -0.74, up)]; }
      lift = -0.03 * dip + 0.06 * up; sq = 0.05 * dip - 0.05 * up; jaw = 0.2 + 0.8 * up; headY = -0.03 * up; look = { x: 0, y: -0.6 + 1.6 * warnU };
      if (!calm) shake = Math.sin(t * 55) * 0.006 * ss(0.7, 1, warnU);
    } else { F[0] = [-0.42, FY - 0.085]; F[1] = [0.42, FY - 0.085]; lift = -0.05; sq = 0.07; jaw = 0.5; headY = 0.03; look = { x: 0, y: 1 }; }
    anger = 1; core = 0.6 + 0.4 * warnU;
  } else if (st === 'punch') {
    pdir = A.dir > 0 ? 1 : -1; // world dir +1 = counter-clockwise: over the top that runs toward -x on screen
    const sd = -pdir, i = sd > 0 ? 1 : 0, cock = ss(0, 0.5, warnU);
    if (!acting) { F[i] = [sd * lerp(0.56, 0.62, cock), lerp(FY - 0.085, -0.34, cock)]; rot = sd * 0.13 * cock; jaw = 0.15; if (!calm) shake = Math.sin(t * 55) * 0.005 * ss(0.6, 1, warnU); }
    else { F[i] = [-sd * 0.5, 0.02]; rot = -sd * 0.2; lift = -0.02; jaw = 0.9; }
    anger = 1; core = 0.6 + 0.4 * warnU; look = { x: -sd, y: 0.4 };
  } else if (st === 'hurt') {
    const u = 1 - clamp(B.flinch / 0.9, 0, 1);
    rot = -0.12 * face * (1 - u * 0.6); lift = 0.03 * (1 - u); jaw = 1; anger = -0.6; eyes = 'shut'; headR = -0.25 * face * (1 - u); headY = -0.03 * (1 - u);
    F[0][1] -= 0.16 * (1 - u); F[1][1] -= 0.16 * (1 - u);
  } else if (st === 'dizzy') {
    rot = calm ? 0 : 0.07 * Math.sin(t * 2.2); headR = calm ? 0 : 0.3 * Math.sin(t * 2.2 - 0.9); jaw = 0.6; anger = -0.3; eyes = 'spiral'; sq = 0.03; core = 0.3 + 0.2 * Math.sin(t * 9);
  } else if (st === 'beaten') {
    S.beat += dt;
    lift = -0.11; sq = 0.08; headY = 0.2; headR = 0.5 * face; jaw = 0.25; anger = -0.7; eyes = 'dead'; core = 0.05; rot = 0.04 * face;
    F[0] = [-0.66, FY - 0.07]; F[1] = [0.66, FY - 0.07];
  } else if (st === 'gloat') {
    const b = calm ? 0 : Math.sin(t * 9); F[0] = [-0.14, -0.1 + 0.05 * b]; F[1] = [0.14, -0.1 - 0.05 * b]; jaw = 0.8; lift = 0.02 * Math.abs(b); eyes = 'happy'; anger = 0.2; // pounds its chest
  }
  if (st !== 'beaten') S.beat = 0;
  if (st === 'stomp' && landed && S.wasUp) { S.sqV = (S.sqV || 0) + 1.8; S.land = 0; }
  if (st === 'punch' && acting && S.wasUp) S.land = 0;
  S.wasUp = (st === 'stomp' || st === 'punch') && !acting;
  S.land += dt;
  const h2 = dt / 2, slam = (st === 'stomp' || st === 'punch') && acting ? 900 : 190, sd = (st === 'stomp' || st === 'punch') && acting ? 34 : 15;
  let L = 0, R = 0, SQ = 0, JAW = 0, ANG = 0, HY = 0, HR = 0, CORE = 0;
  const FX = [0, 0], FYs = [0, 0];
  for (let q = 0; q < 2; q++) {
    L = spr('lift', lift, h2, 190, 16); R = spr('rot', rot, h2, 140, 12); SQ = spr('sq', sq, h2, 260, 15); JAW = spr('jaw', jaw, h2, 240, 16); ANG = spr('ang', anger, h2, 200, 20);
    HY = spr('hy', headY, h2, 150, 11); HR = spr('hr', headR, h2, 120, 9); CORE = spr('core', core, h2, 120, 20);
    for (const i of [0, 1]) { FX[i] = spr('fx' + i, F[i][0], h2, slam, sd); FYs[i] = spr('fy' + i, F[i][1], h2, slam, sd); }
  }
  const lw = 0.0085, glowA = clamp(CORE, 0, 1), eyeCol = eyes === 'dead' ? C.dead : C.glow;

  ctx.save();
  ctx.scale(s, s);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // ---- the slab
  contact(ctx, 0.02, FY + 0.085, 0.62, 0.035, 0.22);
  poly(ctx, [[-0.7, FY], [0.7, FY], [0.62, FY + 0.06], [0.3, FY + 0.09], [0.02, FY + 0.07], [-0.3, FY + 0.095], [-0.6, FY + 0.055]], C.rock, C.line, lw);
  poly(ctx, [[-0.7, FY], [0.7, FY], [0.66, FY + 0.022], [-0.66, FY + 0.022]], C.rockHi);
  prism(ctx, -0.64, FY + 0.01, 0.06, 0.12, -0.5, lw); prism(ctx, 0.66, FY + 0.012, 0.05, 0.1, 0.6, lw); prism(ctx, 0.12, FY + 0.07, 0.04, 0.07, Math.PI, lw, true); prism(ctx, -0.36, FY + 0.085, 0.05, 0.085, Math.PI + 0.15, lw);
  if (S.land < 1.4 && st === 'stomp') { const g = clamp(S.land / 0.1, 0, 1); ctx.strokeStyle = C.line; ctx.lineWidth = lw * 1.3; ctx.beginPath(); for (const x of [-0.42, 0.42]) for (const d of [-1, 0.3, 1]) { ctx.moveTo(x, FY + 0.004); ctx.lineTo(x + d * 0.06 * g, FY + 0.035 * g); ctx.lineTo(x + d * 0.13 * g, FY + 0.06 * g); } ctx.stroke(); }
  // ---- legs: two stubby blocks
  for (const sg of [-1, 1]) {
    const hx = sg * 0.2, top = 0.2 - L * 0.7;
    contact(ctx, sg * 0.22, FY, 0.14, 0.02, 0.25);
    seg(ctx, [hx, top], [sg * 0.22, FY - 0.07], 0.085, 0.1, C.deep, C.lo, null, lw);
    poly(ctx, [[sg * 0.22 - 0.13, FY], [sg * 0.22 - 0.115, FY - 0.085], [sg * 0.22 + 0.115, FY - 0.085], [sg * 0.22 + 0.13, FY]], C.lo, C.line, lw);
    poly(ctx, [[sg * 0.22 - 0.13, FY], [sg * 0.22 - 0.115, FY - 0.085], [sg * 0.22 - 0.01, FY - 0.085], [sg * 0.22 - 0.03, FY]], C.cry);
  }
  // ---- body (pivots on the feet)
  ctx.save();
  ctx.translate(0, FY); ctx.rotate(R + shake); ctx.scale(1 + SQ * 0.7, 1 - SQ); ctx.translate(0, -FY - L);
  const SH = [[-0.43, -0.2], [0.43, -0.2]];
  // the far arm's shoulder spikes sit behind the torso
  for (const sg of [-1, 1]) { prism(ctx, sg * 0.4, -0.25, 0.13, 0.27, sg * 0.42, lw); prism(ctx, sg * 0.3, -0.31, 0.1, 0.19, sg * 0.12, lw, sg > 0); prism(ctx, sg * 0.5, -0.17, 0.09, 0.17, sg * 0.95, lw, sg < 0); }
  // torso: faceted planes
  const T = [[-0.42, -0.25], [-0.2, -0.36], [0.2, -0.36], [0.42, -0.25], [0.36, 0.02], [0.21, 0.27], [-0.21, 0.27], [-0.36, 0.02]];
  poly(ctx, T, C.cry, C.line, lw);
  poly(ctx, [T[0], T[1], [-0.02, -0.36], [-0.13, -0.1], T[7]], C.hi);
  poly(ctx, [T[2], T[3], T[4], T[5], [0.13, 0.02], [0.1, -0.2]], C.lo);
  poly(ctx, [T[7], [-0.13, -0.1], [0, 0.08], [0.13, 0.02], T[5], T[6]], C.lo);
  poly(ctx, [T[6], [0, 0.08], [0.13, 0.02], T[5]], C.deep);
  ctx.strokeStyle = 'rgba(35,23,70,0.45)'; ctx.lineWidth = lw * 0.8; ctx.beginPath(); ctx.moveTo(-0.13, -0.1); ctx.lineTo(0, 0.08); ctx.lineTo(0.13, 0.02); ctx.lineTo(0.1, -0.2); ctx.moveTo(-0.13, -0.1); ctx.lineTo(-0.02, -0.36); ctx.stroke();
  // the core: a glowing shard set in the chest, cracks of light round it
  ctx.globalAlpha = 0.25 + 0.75 * glowA; ctx.strokeStyle = C.glow; ctx.lineWidth = lw * 1.5; ctx.beginPath();
  for (const [x, y] of [[-0.15, -0.2], [0.14, -0.17], [-0.1, 0.1], [0.12, 0.08], [0, -0.24]]) { ctx.moveTo(x * 0.45, -0.06 + (y + 0.06) * 0.45); ctx.lineTo(x * 0.8 + 0.02, -0.06 + (y + 0.06) * 0.75); ctx.lineTo(x, y); }
  ctx.stroke(); ctx.globalAlpha = 1;
  poly(ctx, [[0, -0.16], [0.075, -0.06], [0, 0.05], [-0.075, -0.06]], C.glowLo, C.line, lw);
  ctx.globalAlpha = 0.2 + 0.8 * glowA; poly(ctx, [[0, -0.16], [0.075, -0.06], [0, 0.05], [-0.075, -0.06]], C.glow); poly(ctx, [[0, -0.16], [0, -0.06], [-0.075, -0.06]], C.glowHi); ctx.globalAlpha = 1;
  // ---- head: a small block sunk between the shoulders, heavy brow, underbite
  ctx.save();
  ctx.translate(0.03 * face, -0.4 + HY); ctx.rotate(HR - clamp((S.rotV || 0) * 0.04, -0.15, 0.15));
  const jo = 0.012 + 0.06 * clamp(JAW, 0, 1.2);
  poly(ctx, [[-0.1, 0.02], [0.1, 0.02], [0.1, 0.06 + jo], [-0.1, 0.06 + jo]], '#170c2c'); // mouth
  if (JAW > 0.3 && eyes !== 'dead') { ctx.globalAlpha = 0.5 * glowA; poly(ctx, [[-0.07, 0.04 + jo * 0.5], [0.07, 0.04 + jo * 0.5], [0.08, 0.06 + jo], [-0.08, 0.06 + jo]], C.glow); ctx.globalAlpha = 1; }
  poly(ctx, [[-0.125, 0.05 + jo], [0.125, 0.05 + jo], [0.1, 0.125 + jo], [-0.1, 0.125 + jo]], C.lo, C.line, lw); // jaw
  poly(ctx, [[-0.125, 0.05 + jo], [0, 0.05 + jo], [-0.02, 0.125 + jo], [-0.1, 0.125 + jo]], C.cry);
  for (const sg of [-1, 1]) poly(ctx, [[sg * 0.095, 0.055 + jo], [sg * 0.05, 0.055 + jo], [sg * 0.078, 0.055 + jo - 0.06]], '#f1eaff', C.line, lw * 0.7); // two tusk teeth
  prism(ctx, -0.05, -0.12, 0.07, 0.13, -0.3, lw); prism(ctx, 0.04, -0.13, 0.085, 0.17, 0.12, lw, true);
  const HD = [[-0.14, -0.1], [-0.07, -0.15], [0.08, -0.15], [0.14, -0.09], [0.13, 0.05], [-0.13, 0.05]];
  poly(ctx, HD, C.cry, C.line, lw);
  poly(ctx, [HD[0], HD[1], [0, -0.15], [-0.03, -0.02], HD[5]], C.hi);
  poly(ctx, [HD[3], HD[4], [0.05, 0.05], [0.07, -0.06]], C.lo);
  // eye sockets and the glowing eyes
  const a = clamp(ANG, -1, 1), bl = eyes === 'on' && st === 'idle' ? blinkAt(t, 5) : 0;
  for (const sg of [-1, 1]) {
    const ex = sg * 0.068, ey = -0.022;
    poly(ctx, [[ex - 0.042, ey - 0.03], [ex + 0.042, ey - 0.03], [ex + 0.04, ey + 0.03], [ex - 0.04, ey + 0.03]], '#170c2c');
    if (eyes === 'spiral') { ctx.strokeStyle = C.glow; ctx.lineWidth = lw; ctx.beginPath(); for (let q = 0; q < 3 * Math.PI; q += 0.4) { const rr = 0.028 * (q / (3 * Math.PI)), aa = q + t * 8 * sg; ctx.lineTo(ex + Math.cos(aa) * rr, ey + Math.sin(aa) * rr); } ctx.stroke(); }
    else if (eyes === 'shut' || eyes === 'happy') { ctx.strokeStyle = C.glow; ctx.lineWidth = lw * 1.5; ctx.beginPath(); if (eyes === 'shut') { ctx.moveTo(ex - sg * 0.028, ey - 0.02); ctx.lineTo(ex + sg * 0.02, ey); ctx.lineTo(ex - sg * 0.028, ey + 0.02); } else { ctx.moveTo(ex - 0.028, ey + 0.012); ctx.quadraticCurveTo(ex, ey - 0.03, ex + 0.028, ey + 0.012); } ctx.stroke(); }
    else {
      const hgt = (eyes === 'dead' ? 0.006 : 0.021) * (1 - bl * 0.9), px = ex + look.x * 0.012, py = ey + look.y * 0.006;
      poly(ctx, [[ex - 0.034, ey - hgt], [ex + 0.034, ey - hgt], [ex + 0.034, ey + hgt], [ex - 0.034, ey + hgt]], eyeCol);
      if (eyes !== 'dead') poly(ctx, [[px - 0.012, py - hgt * 0.8], [px + 0.012, py - hgt * 0.8], [px + 0.012, py + hgt * 0.8], [px - 0.012, py + hgt * 0.8]], C.glowHi);
    }
    // brow slab: the inner end drops over the eye when it is angry
    poly(ctx, [[sg * 0.008, -0.045 + a * 0.028], [sg * 0.13, -0.075 - a * 0.022], [sg * 0.145, -0.115 - a * 0.015], [sg * 0.008, -0.085 + a * 0.012]], C.rock, C.line, lw * 0.8);
    poly(ctx, [[sg * 0.008, -0.085 + a * 0.012], [sg * 0.145, -0.115 - a * 0.015], [sg * 0.14, -0.1 - a * 0.016], [sg * 0.008, -0.07 + a * 0.016]], C.rockHi);
  }
  ctx.restore(); // head
  // ---- arms: dark rock upper arm, a crystal pillar of a forearm, a block fist (body space, so they swing with it)
  for (const i of [0, 1]) {
    const sg = i ? 1 : -1, sh = SH[i], fx = FX[i], fy = FYs[i] + L, el = ik(sh[0], sh[1], fx, fy, 0.27, 0.3, sg);
    seg(ctx, sh, el, 0.06, 0.05, C.rock, C.rockHi, null, lw);
    const dx = fx - el[0], dy = fy - el[1], l = Math.hypot(dx, dy) || 1, wr = [fx - (dx / l) * 0.07, fy - (dy / l) * 0.07];
    seg(ctx, el, wr, 0.075, 0.115, C.lo, C.cry, C.hi, lw);
    prism(ctx, el[0], el[1], 0.07, 0.12, Math.atan2(el[0] - wr[0], -(el[1] - wr[1])) , lw); // elbow spike
    const fa = Math.atan2(dy, dx);
    ctx.save(); ctx.translate(fx, fy); ctx.rotate(fa - Math.PI / 2);
    poly(ctx, [[-0.125, -0.085], [0.125, -0.085], [0.14, 0.02], [0.1, 0.085], [-0.1, 0.085], [-0.14, 0.02]], C.lo, C.line, lw);
    ctx.restore();
    ctx.save(); ctx.translate(fx, fy); ctx.rotate(fa - Math.PI / 2);
    poly(ctx, [[-0.125, -0.085], [0.02, -0.085], [-0.01, 0.02], [-0.14, 0.02]], C.cry); poly(ctx, [[-0.125, -0.085], [-0.05, -0.085], [-0.08, 0.02], [-0.14, 0.02]], C.hi);
    ctx.strokeStyle = 'rgba(35,23,70,0.5)'; ctx.lineWidth = lw * 0.8; ctx.beginPath(); for (const x of [-0.05, 0.02, 0.085]) { ctx.moveTo(x, 0.03); ctx.lineTo(x - 0.008, 0.085); } ctx.moveTo(-0.14, 0.02); ctx.lineTo(0.14, 0.02); ctx.stroke();
    ctx.restore();
  }
  // shoulder caps over the arm roots
  for (const sg of [-1, 1]) { poly(ctx, [[sg * 0.33, -0.3], [sg * 0.47, -0.25], [sg * 0.5, -0.13], [sg * 0.4, -0.1], [sg * 0.32, -0.17]], sg < 0 ? C.hi : C.lo, C.line, lw); poly(ctx, [[sg * 0.33, -0.3], [sg * 0.47, -0.25], [sg * 0.41, -0.2]], sg < 0 ? '#f3ecff' : C.cry); }
  if (!calm && !frozen) {
    if (st === 'punch' && acting) { const d = -pdir > 0 ? -1 : 1, i = d < 0 ? 1 : 0; burst(ctx, FX[i] - d * 0.12, FYs[i] + L, 0.1, 0.42, d > 0 ? Math.PI - 0.5 : -0.5, d > 0 ? Math.PI + 0.5 : 0.5, 5, 0.014, '#ffffff'); }
    if (S.chip < 0.7) { // chips fly off when an egg gets home
      const u = S.chip / 0.7;
      for (let i = 0; i < 8; i++) { const sg = i % 2 ? 1 : -1, x = sg * (0.15 + 0.3 * hash(i)) + sg * u * (0.2 + 0.3 * hash(i + 3)), y = -0.3 + 0.3 * hash(i + 5) - 0.3 * u + 0.8 * u * u; ctx.globalAlpha = 1 - u * u; prism(ctx, x, y, 0.035, 0.07, sg * (0.5 + u * 6), lw * 0.7, i % 3 === 0); }
      ctx.globalAlpha = 1;
      burst(ctx, 0, -0.3, 0.42, 0.54, -Math.PI * 0.9, -Math.PI * 0.1, 7, 0.012 * (1 - u), '#ffffff');
    }
  }
  ctx.restore(); // body
  // ---- the fists hit the slab: lines, dust, shards
  if (!calm && !frozen && st === 'stomp' && S.land < 0.5) {
    const u = S.land / 0.5;
    for (const x of [-0.42, 0.42]) {
      if (u < 0.5) burst(ctx, x, FY - 0.02, 0.17 + u * 0.1, 0.27 + u * 0.24, -Math.PI * 0.95, -Math.PI * 0.05, 6, 0.014 * (1 - u * 2), '#ffffff');
      for (let i = 0; i < 4; i++) { const sg = i % 2 ? 1 : -1; ctx.globalAlpha = 1 - u; prism(ctx, x + sg * (0.12 + u * 0.2 * (1 + hash(i))), FY - 0.02 - u * 0.16 * (1 + hash(i + 4)) + u * u * 0.14, 0.03, 0.06, sg * (0.6 + u * 5), lw * 0.7, i === 0); }
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  if (st === 'dizzy' && !calm && !frozen) dizzyStars(ctx, 0, -0.62 * s, s * 0.22, s * 0.06, t, { layer: 'all', size: s * 0.05 });
}
