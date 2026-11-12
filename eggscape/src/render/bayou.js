// Gator Bayou creatures (v3.7): the alligator (and Grandpa Gator, the world boss), the snapping turtle and the mosquito
// swarm. Crisp cel-shaded code art in the house style: one dark outline, base + one hard shadow + one hard highlight, no light
// rim or halo. Frozen and stunned use the shared looks (render/status.js), drawn into the creature's own silhouette.
//
// drawGator(ctx, s, t, o): in a local px frame (y down), feet-middle at (0, 0), snout toward +x, s = body length px. o:
//   jaw 0..1 (open)   eye 'open' | 'half' | 'shut' | 'spiral' | 'squint'   gait (walk phase)   tail (curl rad, + = up)
//   roll 0..1 (death roll progress)   bend (floor radius px, Infinity = straight)   boss 1 (Grandpa: older skin, lily pad
//   hat, gold tooth, moss)   baby 1 (brighter, big eyes)   sneeze 0..1   stars 0..1
// drawTurtle(ctx, s, t, o): same frame, s = shell length px. o: head (-1 tucked .. 0 out .. 1 lunge), mouth 0..1, gait, flip
//   0..1 (on its back), flail, shell 0..1 (pulled in), eye
// drawMosquito(ctx, x, y, sz, t, o) one insect; drawSwarm(ctx, x, y, R, t, o) a buzzing cloud (o.tight, o.spread, o.fed)
import { TAU } from '../sim/geom.js';
import { GATOR, TURTLE } from '../sim/bayou.js';
import { statusClock, statusDraw, dizzyStars, spiralEye } from './status.js';

import { clamp, lerp, ss, hash, form, ik, limb, eye, blinkAt, zed, burst, contact, back, spline } from './castkit.js';

const SKIN = {
  gator: { line: '#122008', base: '#6c9c36', lo: '#3f6a28', hi: '#a3cc58', ridge: '#2c4a20', ridgeHi: '#4a7030', belly: '#f6e6a4', bellyLo: '#d3b25e', lip: '#8fb848', eye: '#ffd83a', eyeLo: '#e08a1a', mouth: '#9a2634', mouthLo: '#5e1220', tongue: '#f08a9a', teeth: '#fff8e2', claw: '#f2e2b0' },
  baby: { line: '#122008', base: '#8cc03e', lo: '#52882c', hi: '#c0e26a', ridge: '#3a6424', ridgeHi: '#5a8a34', belly: '#faedb0', bellyLo: '#d9bc68', lip: '#a8d258', eye: '#ffe44a', eyeLo: '#e89a20', mouth: '#a82e3c', mouthLo: '#661422', tongue: '#f59aa8', teeth: '#fff8e2', claw: '#f2e2b0' },
  boss: { line: '#0e160c', base: '#5f7f4c', lo: '#35503a', hi: '#93b078', ridge: '#22362a', ridgeHi: '#3e5a40', belly: '#eedc9a', bellyLo: '#c2a258', lip: '#7c9a5c', eye: '#ffb52a', eyeLo: '#cc6a12', mouth: '#8a2230', mouthLo: '#50101a', tongue: '#e07a8c', teeth: '#f8ecc8', claw: '#e6d6a6', moss: '#8cc63e', mossLo: '#56882a', pad: '#58b842', padLo: '#2f7a28', flower: '#ff86b2', flowerLo: '#e0528a', gold: '#ffd23a', goldLo: '#c8901a', brow: '#c9c7ac' },
};
const TURT = { line: '#161c0a', shell: '#7c8f3e', shellLo: '#4c5c28', shellDeep: '#33401c', shellHi: '#b4c868', moss: '#8cc63e', skin: '#b9b266', skinLo: '#857f44', skinHi: '#e0da96', plastron: '#ecd992', plastronLo: '#c4ad62', beak: '#4a4226', beakHi: '#7a6e44', eye: '#ffa62a', eyeLo: '#d8641a', mouth: '#8a2a30', claw: '#f2e2b0' };

// cosine-smoothed profile through [x, y] points
function prof(P) {
  return (x) => {
    if (x <= P[0][0]) return P[0][1];
    for (let i = 1; i < P.length; i++) if (x <= P[i][0]) { const [x0, y0] = P[i - 1], [x1, y1] = P[i], u = (x - x0) / (x1 - x0); return lerp(y0, y1, (1 - Math.cos(u * Math.PI)) / 2); }
    return P[P.length - 1][1];
  };
}
// gator profile in art units (x -50 tail tip .. 50 snout tip; y up): a low heavy body, a thick tail, a skull with a raised eye
// socket and a nostril bump, a long toothy snout
const G_TOP0 = prof([[-50, 2.4], [-42, 5.4], [-30, 10], [-16, 15.4], [-4, 18.6], [6, 19.6], [15, 18], [20.5, 15.6], [24, 17], [27.5, 20.4], [31, 17.6], [36, 12.6], [43, 11], [47, 12], [50, 8.2]]);
const scute = (x) => (x > 17 || x < -48 ? 0 : (x < -14 ? 2.3 : 1.7) * Math.pow(Math.abs(Math.sin((x + 50) * 0.66)), 0.7)); // the ridge of plates is part of the silhouette
const G_TOP = (x) => G_TOP0(x) + scute(x);
const G_BOT = prof([[-50, 1.4], [-30, 0.5], [-10, 0.1], [6, 0], [18, 0.7], [24, 2], [36, 1.5], [46, 2], [50, 4.2]]);
const G_MOUTH = prof([[21, 8.8], [30, 7.2], [40, 6.3], [50, 6.2]]);
const HINGE = [21, 8.8], TAIL0 = -16, TAILN = 14;

// ================================================================= the gator
export function drawGator(ctx, s, t = 0, o = {}) {
  if (!(s > 0)) return;
  const C = o.boss ? SKIN.boss : o.baby ? SKIN.baby : SKIN.gator, U = s / 100, lw = clamp(2.1 / U, 1.25, 3.4); // ~2 px ink at any size
  const R = o.bend && isFinite(o.bend) ? o.bend / U : Infinity, jawU = clamp(o.jaw || 0, 0, 1), chomp = clamp(o.chomp || 0, 0, 1);
  const pres = o.boss ? 0 : 1; // regular gators and babies: a longer, chunkier head, a wider gape, a livelier tail (same collider)
  const jaw = jawU * (pres ? 1.02 : 0.74), tailIn = o.tail || 0, slam = tailIn < 0 ? clamp(-tailIn * 4, 0, 1) : 0;
  const rollU = clamp(o.roll || 0, 0, 1), rolling = rollU > 0.001 && rollU < 0.999, phi = rollU * TAU * 2;
  const g = o.gait || 0, walk = clamp(o.walk || 0, 0, 1), id = o.id || 0;
  const HY = o.boss ? 1.0 : 1.2; // the art is drawn a little taller than the collider (reads at phone scale)
  const breathe = 1 + 0.03 * Math.sin(t * 1.7 + id), eyeMode = o.eye || 'open', asleep = eyeMode === 'shut';
  // the tail: a chain that curls from its root (sweep wind-up), idles with a slow sway and swishes as it walks
  const tail = Math.max(0, tailIn), TP = [];
  { let x = TAIL0, y = 0; const ds = (50 + TAIL0) / TAILN;
    for (let i = 0; i <= TAILN; i++) {
      const f = i / TAILN, a = tail * 1.75 * Math.pow(f, 1.25) + (1 - tail) * (0.05 + (pres && !asleep ? 0.1 : 0.05) * Math.sin(t * (asleep ? 0.8 : 1.5) - f * 3 + id) + walk * (pres ? 0.2 : 0.1) * Math.sin(g * 2 - f * 4)) * f * (1 - slam) + pres * (1.25 * jawU * (1 - chomp) - 0.3 * chomp) * Math.pow(f, 1.3);
      TP.push([x, y, a]); x -= Math.cos(a) * ds; y += Math.sin(a) * ds;
    } }
  const squashY = 1 - 0.07 * jawU * (1 - chomp) + 0.05 * chomp, bob = walk * Math.sin(g * 2) * 0.35;
  // the art point (x, y up) -> ctx (x, y down): tail chain, squash, then the floor's curve
  const M = (x, y) => {
    if (pres && x > 10) { const h = ss(10, 22, x); y *= 1 + 0.2 * h; x += (x - 14) * 0.26 * h; }
    y *= HY;
    if (x < TAIL0) {
      const d = ((TAIL0 - x) / (50 + TAIL0)) * TAILN, i = Math.min(TAILN - 1, Math.floor(d)), f = d - i, A = TP[i], B = TP[i + 1], a = lerp(A[2], B[2], f), yc = 4.5 * HY, h = (y - yc) * (1 - 0.25 * slam);
      x = lerp(A[0], B[0], f) + Math.sin(a) * h; y = yc + lerp(A[1], B[1], f) + Math.cos(a) * h;
    } else if (y > 7) y = 7 + (y - 7) * breathe;
    y = y * squashY + bob * clamp((y - 3) / 10, 0, 1);
    const fy = isFinite(R) ? (x * x) / (2 * R) : 0;
    return [x, -(y + fy)];
  };
  const jawRot = (x, y) => { const dx = x - HINGE[0], dy = y - HINGE[1], c = Math.cos(jaw), sn = Math.sin(jaw); return [HINGE[0] + dx * c - dy * sn, HINGE[1] + dx * sn + dy * c]; };
  const pts = (list) => { ctx.beginPath(); list.forEach(([x, y], i) => { const [X, Y] = M(x, y); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.closePath(); };
  const line = (list) => { ctx.beginPath(); list.forEach(([x, y], i) => { const [X, Y] = M(x, y); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); };
  const range = (a, b, f, step = 1.5) => { const out = []; const n = Math.max(1, Math.ceil(Math.abs(b - a) / step)); for (let i = 0; i <= n; i++) { const x = a + ((b - a) * i) / n; out.push([x, f(x)]); } return out; };
  const ink = (w = lw) => { ctx.lineWidth = w; ctx.strokeStyle = C.line; ctx.stroke(); };
  const mid = (f) => (x) => lerp(G_BOT(x), G_TOP0(x), f);
  ctx.save();
  try {
    ctx.scale(U, U);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    // anticipation and follow-through: it rocks back as the jaws open and lunges on the chomp
    ctx.translate((pres ? -4.6 : -2.2) * jawU * (1 - chomp) + (pres ? 6 : 3.2) * chomp, 0);
    if (pres) { ctx.translate(-36, 0); ctx.rotate(-0.1 * jawU * (1 - chomp) + 0.03 * chomp); ctx.translate(36, 0); } // rears up to strike, slams down on the snap
    // contact shadow along the floor
    pts([...range(-47, 49, () => 1.1, 6), ...range(49, -47, () => -1.5, 6)]); ctx.fillStyle = 'rgba(0,0,0,0.26)'; ctx.fill();
    if (rolling) { rollBody(); ctx.restore(); return; }
    // ---- legs: two bones and a clawed foot; a diagonal walk whose feet stay planted through the stance
    const leg = (hipX, ph, far, hind) => {
      const c = (((g + ph) / TAU) % 1 + 1) % 1, st = 0.62, stride = 7.5 * walk;
      let fx, lift = 0;
      if (c < st) fx = stride * (0.5 - c / st); else { const u = (c - st) / (1 - st), e = u * u * (3 - 2 * u); fx = stride * (-0.5 + e); lift = Math.sin(u * Math.PI) * 3.2 * walk; }
      const hip = [hipX, 7.2], foot = [hipX + (hind ? -2.5 : 2.5) + fx, 1 + lift], K = ik(hip[0], hip[1], foot[0], foot[1], 5.4, 5.2, hind ? 1 : -1);
      const P = [hip, K, foot].map(([x, y]) => M(x, y)), col = far ? C.lo : C.base;
      limb(ctx, P, [3.5, 2.8, 2.1], col, C.line, lw * 0.85);
      // the foot: a flat pad with three claws
      const [fx0, fy0] = M(foot[0], foot[1]), [fx1, fy1] = M(foot[0] + 1, foot[1]), ang = Math.atan2(fy1 - fy0, fx1 - fx0) - lift * 0.08;
      ctx.save(); ctx.translate(fx0, fy0); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(-2.2, -1.9); ctx.quadraticCurveTo(1.5, -2.6, 5.2, -0.6); ctx.lineTo(5.4, 0.9); ctx.lineTo(-2.2, 0.9); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ink(lw * 0.85);
      ctx.fillStyle = C.claw; for (const q of [1.6, 3.4, 5.1]) { ctx.beginPath(); ctx.moveTo(q - 0.9, 0.9); ctx.lineTo(q + 1.1, 1.0); ctx.lineTo(q + 0.2, -0.5); ctx.closePath(); ctx.fill(); ink(lw * 0.45); }
      ctx.restore();
    };
    leg(-9, Math.PI, true, true); leg(16.5, 0, true, false);
    // ---- body + tail + lower jaw: one silhouette with the plate ridge in it
    const body = [...range(-50, 21, G_TOP, 0.8), ...range(21, 50, G_MOUTH), ...range(50, -50, G_BOT, 2)];
    const bodyPath = () => pts(body);
    form(ctx, bodyPath, { d: 3.4, lo: C.lo, base: C.base, hi: C.hi, hiK: 0.42, line: C.line, lw, inner: () => {
      // the dark armoured back: a band under the ridge, with a lighter plate edge
      pts([...range(-50, 21, (x) => G_TOP(x) + 2, 0.8), ...range(21, -50, (x) => G_TOP0(x) - 2.6 - 1.2 * clamp((x + 50) / 30, 0, 1), 2)]); ctx.fillStyle = C.ridge; ctx.fill();
      ctx.strokeStyle = C.ridgeHi; ctx.lineWidth = 0.9; for (let x = -44; x < 16; x += 4.76) { const [X0, Y0] = M(x - 1.2, G_TOP0(x) - 0.6), [X1, Y1] = M(x + 0.4, G_TOP(x) - 0.5); ctx.beginPath(); ctx.moveTo(X0, Y0); ctx.lineTo(X1, Y1); ctx.stroke(); }
      // belly: a pale scoop along the bottom with a darker underside and a few scale ticks
      pts([...range(-46, 50, mid(0.3), 2), ...range(50, -46, (x) => G_BOT(x) - 3, 6)]); ctx.fillStyle = C.belly; ctx.fill();
      pts([...range(-46, 50, mid(0.1), 2), ...range(50, -46, (x) => G_BOT(x) - 3, 6)]); ctx.fillStyle = C.bellyLo; ctx.fill();
      ctx.strokeStyle = C.bellyLo; ctx.lineWidth = 0.8; for (let x = -36; x < 20; x += 4.4) { line([[x, G_BOT(x) + 0.6], [x + 0.9, mid(0.3)(x) - 0.3]]); ctx.stroke(); }
      // flank scales: a staggered row of little open arcs
      ctx.strokeStyle = C.lo; ctx.lineWidth = 1;
      for (let i = 0, x = -30; x < 17; x += 5.2, i++) { const [X, Y] = M(x, mid(i % 2 ? 0.5 : 0.63)(x)); ctx.beginPath(); ctx.arc(X, Y, 1.5, 0.15, Math.PI - 0.15); ctx.stroke(); }
    } });
    // ---- the mouth: dark red inside, a pink tongue, the lower teeth
    const lowerTeeth = () => { for (let x = 26.5; x < 49; x += 3.4) { const y = G_MOUTH(x); pts([[x - 1.1, y - 0.2], [x, y + (pres ? 3 : 2.3)], [x + 1.1, y - 0.2]]); ctx.fillStyle = C.teeth; ctx.fill(); ink(lw * 0.5); } };
    if (jaw > 0.03) {
      const tip = jawRot(50, G_MOUTH(50) + 0.4);
      pts([HINGE, ...range(21, 50, (x) => G_MOUTH(x) + 0.2, 3).map(([x, y]) => jawRot(x, y)).slice(1), tip, ...range(50, 21, (x) => G_MOUTH(x) - 0.2, 3)]); ctx.fillStyle = C.mouth; ctx.fill();
      ctx.save(); ctx.clip();
      pts([[21, 6], ...range(24, 47, (x) => G_MOUTH(x) + 2.4 * Math.sin(clamp((x - 24) / 23, 0, 1) * Math.PI) * Math.min(1, jawU * 2.5), 2), [47, 4]]); ctx.fillStyle = C.tongue; ctx.fill();
      pts([HINGE, jawRot(34, G_MOUTH(34)), [34, G_MOUTH(34)]]); ctx.fillStyle = C.mouthLo; ctx.fill();
      ctx.restore();
      line(range(21, 50, G_MOUTH, 3)); ink(lw * 0.8);
    }
    lowerTeeth();
    // ---- the skull and upper jaw (turns up about the hinge)
    const headTop = range(16.5, 50, G_TOP0, 0.9), head = [...headTop, ...range(50, 21, G_MOUTH, 3)].map(([x, y]) => (x <= 16.6 ? [x, y] : jawRot(x, y)));
    head.unshift([15, G_TOP0(15) - 4], [14.5, 10]); // tucked into the neck
    form(ctx, () => pts(head), { d: 2.6, lo: C.lo, base: C.base, hi: C.hi, hiK: 0.45, line: C.line, lw, noWeight: true, inner: () => {
      pts([...range(21, 50, (x) => G_MOUTH(x) + 2.5, 3), ...range(50, 21, (x) => G_MOUTH(x) - 1, 3)].map(([x, y]) => jawRot(x, y))); ctx.fillStyle = C.lip; ctx.fill();
    } });
    // upper teeth: an overbite that always shows, so the snout reads as jaws even shut
    for (let x = 25; x < 49.5; x += 3.4) {
      const y = G_MOUTH(x), gold = o.boss && Math.abs(x - 42) < 1, big = (gold || Math.abs(x - 28.4) < 1 ? 1.5 : 1) * (pres ? 1.25 : 1);
      pts([[x - 1.2 * big, y + 0.5], [x, y - 2.4 * big], [x + 1.2 * big, y + 0.5]].map(([a, b]) => jawRot(a, b))); ctx.fillStyle = gold ? C.gold : C.teeth; ctx.fill(); ink(lw * 0.5);
    }
    // nostril
    { const [nx, ny] = jawRot(47, G_TOP0(47) - 1.5), [X, Y] = M(nx, ny); ctx.beginPath(); ctx.ellipse(X, Y, 1.1, 0.75, -0.3, 0, TAU); ctx.fillStyle = C.line; ctx.fill(); }
    // ---- the eye in its raised socket
    const big = o.baby ? 1.25 : 1, [ex0, ey0] = jawRot(27.3, G_TOP0(27.3) - 3.1), [EX, EY] = M(ex0, ey0), er = 3.3 * big * (pres ? 1.28 : 1);
    ctx.save(); ctx.translate(EX, EY); ctx.rotate(-jaw * 0.8);
    if (eyeMode === 'spiral') { ctx.beginPath(); ctx.arc(0, 0, er, 0, TAU); ctx.fillStyle = '#fff6d8'; ctx.fill(); ink(lw * 0.7); spiralEye(ctx, 0, 0, er, t, 1, C.line); }
    else {
      const bl = blinkAt(t, id * 3 + 1), lid = eyeMode === 'half' ? 0.55 : o.boss ? 0.36 : jawU > 0.2 ? 0.06 : 0.24;
      eye(ctx, 0, 0, { r: er, iris: C.eye, irisLo: C.eyeLo, pupil: 'slit', wide: jawU > 0.3, look: { x: o.look ?? 0.4, y: 0.1 }, lid: Math.max(lid, bl), lidCol: C.base, line: C.line, lw: lw * 0.75, shut: eyeMode === 'shut' ? 1 : eyeMode === 'squint' ? 'squint' : 0, mad: jawU > 0.2 || o.boss ? 0.28 : 0.1 });
      // brow ridge: a heavy lid line that scowls
      ctx.beginPath(); ctx.moveTo(-er * 1.25, -er * 0.5); ctx.quadraticCurveTo(-er * 0.2, -er * 1.45, er * 1.3, -er * 0.35);
      if (o.boss) { ctx.lineWidth = 2.4 + lw * 1.5; ctx.strokeStyle = C.line; ctx.stroke(); ctx.lineWidth = 2.4; ctx.strokeStyle = C.brow; ctx.stroke(); } else ink(lw * 1.1);
    }
    ctx.restore();
    // ---- Grandpa: moss on his back, the lily pad hat with its flower
    if (o.boss) {
      for (const [x, r] of [[-22, 3], [-7, 3.6], [8, 2.8]]) { const y = G_TOP0(x) + 0.6; pts(range(x - r * 1.7, x + r * 1.7, (q) => y + Math.max(0, r * Math.cos(((q - x) / (r * 1.7)) * Math.PI / 2)) * 1.0, 0.8)); ctx.fillStyle = C.moss; ctx.fill(); ink(lw * 0.7); const [X, Y] = M(x + r * 0.4, y + r * 0.3); ctx.fillStyle = C.mossLo; ctx.beginPath(); ctx.ellipse(X, Y, r * 0.7, r * 0.25, 0, 0, TAU); ctx.fill(); }
      const [hx0, hy0] = jawRot(20.5, G_TOP0(20.5) + 4.6), [HX, HYp] = M(hx0, hy0);
      ctx.save(); ctx.translate(HX, HYp); ctx.rotate(-0.22 - jaw * 0.7 + Math.sin(t * 2.1) * 0.03); ctx.scale(1.05, 1.05);
      const pad = () => { ctx.beginPath(); ctx.ellipse(0, 0, 9, 2.7, 0, 0.4, TAU - 0.05); ctx.lineTo(1, 0); ctx.closePath(); };
      form(ctx, pad, { d: 1, lo: C.padLo, base: C.pad, line: C.line, lw: lw * 0.8, noWeight: true });
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.55; ctx.beginPath(); ctx.ellipse(-2 + Math.cos(a) * 1.7, -2.7 + Math.sin(a) * 1.9, 1.4, 2.6, a + Math.PI / 2, 0, TAU); ctx.fillStyle = i % 2 ? C.flowerLo : C.flower; ctx.fill(); ink(lw * 0.55); }
      ctx.beginPath(); ctx.arc(-2, -2.9, 1.1, 0, TAU); ctx.fillStyle = C.gold; ctx.fill();
      ctx.restore();
    }
    // ---- near legs
    leg(-13, 0, false, true); leg(13.5, Math.PI, false, false);
    // ---- the chomp: bright snap lines off the teeth
    if (chomp > 0.05) { const [X, Y] = M(46, 8); burst(ctx, X + 4, Y, 3 + (1 - chomp) * 4, 8 + (1 - chomp) * 6, -1.1, 1.1, 5, 1.3 * chomp + 0.4, '#fff6d0', C.line); }
    // ---- the tail slam: whack lines over the tail
    if (slam > 0.05) { const [X, Y] = M(-38, 9); burst(ctx, X, Y, 4, 10, -Math.PI * 0.85, -Math.PI * 0.15, 4, 1.1, '#fff6d0', C.line); }
    // ---- sneeze spray
    if (o.sneeze > 0) { for (let i = 0; i < 6; i++) { const a = -0.45 + i * 0.2, d = 5 + (1 - o.sneeze) * 14 + (i % 3) * 2; const [X, Y] = M(51 + Math.cos(a) * d, 8 + Math.sin(a) * d); ctx.globalAlpha = o.sneeze; ctx.beginPath(); ctx.arc(X, Y, 1.5 - (i % 2) * 0.5, 0, TAU); ctx.fillStyle = i % 2 ? '#ffb07a' : '#e0502a'; ctx.fill(); ink(lw * 0.4); } ctx.globalAlpha = 1; }
    // ---- asleep: little z's drift off its snout (a sleeping gator is a safe bridge)
    if (asleep && !o.noZ) { const [X, Y] = M(31, G_TOP0(28) * HY / HY + 5); for (let i = 0; i < 2; i++) zed(ctx, X + i * 3, Y, 1.9, ((t * 0.45 + i * 0.5 + id * 0.3) % 1), C.line, '#eaf6c8'); }
  } catch (e) { if (!drawGator.w) { drawGator.w = 1; console.warn('gator art', e); } }
  ctx.restore();
  if (o.stars > 0) { const [X, Y] = [(28 * s) / 100, -(G_TOP0(28) * HY + 9) * (s / 100)]; dizzyStars(ctx, X, Y, s * 0.12, s * 0.035, t, { size: Math.max(3.2, s * 0.035), fade: o.stars }); }

  // the death roll: the body is a barrel turning about its long axis. The silhouette holds; the skin scrolls round it (the
  // dark ridge, the pale belly, the eyes and the legs come round in turn), with spin streaks.
  function rollBody() {
    const body = [...range(-50, 50, G_TOP0, 1.5), ...range(50, -50, G_BOT, 2)];
    const fOf = (b) => (1 - Math.cos(b)) / 2, wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const at = (f) => (x) => lerp(G_BOT(x), G_TOP0(x), f);
    form(ctx, () => pts(body), { d: 3.4, lo: C.lo, base: C.base, hi: C.hi, hiK: 0.42, line: C.line, lw, inner: () => {
      // skin bands over the visible half (b: 0 bottom edge .. PI top edge); skin angle = b + phi (0 = belly, PI = ridge)
      const N = 20; let run = null; const runs = { belly: [], ridge: [] };
      for (const [name, c0, hw] of [['belly', 0, 1.2], ['ridge', Math.PI, 0.5]]) {
        run = null;
        for (let i = 0; i <= N; i++) { const b = (i / N) * Math.PI, inside = Math.abs(wrap(b + phi - c0)) < hw; if (inside && run == null) run = b; if ((!inside || i === N) && run != null) { runs[name].push([run, b]); run = null; } }
      }
      for (const [b0, b1] of runs.belly) { pts([...range(-48, 50, at(fOf(b0) - (b0 <= 0 ? 0.3 : 0)), 3), ...range(50, -48, at(fOf(b1) + (b1 >= Math.PI ? 0.3 : 0)), 3)]); ctx.fillStyle = C.belly; ctx.fill(); ctx.strokeStyle = C.bellyLo; ctx.lineWidth = 0.9; for (let x = -40; x < 46; x += 4.4) { line([[x, at(fOf(b0))(x)], [x + 0.5, at(fOf(b1))(x)]]); ctx.stroke(); } }
      for (const [b0, b1] of runs.ridge) { pts([...range(-50, 20, at(fOf(b0) - (b0 <= 0 ? 0.3 : 0)), 3), ...range(20, -50, at(fOf(b1) + (b1 >= Math.PI ? 0.3 : 0)), 3)]); ctx.fillStyle = C.ridge; ctx.fill(); }
    } });
    // the ridge plates where they pass the top or bottom edge, the mouth line, the eyes, the paddling legs
    const vis = (sig) => { const b = wrap(sig - phi); return b >= 0 && b <= Math.PI ? b : -1; };
    const br = vis(Math.PI);
    if (br >= 0) for (let x = -44; x < 16; x += 4.76) { const y = at(fOf(br))(x), h = 2.2 * -Math.cos(br); if (Math.abs(h) > 0.5) { pts([[x - 1.6, y], [x, y + h], [x + 1.6, y]]); ctx.fillStyle = C.ridge; ctx.fill(); ink(lw * 0.6); } }
    for (const sg of [Math.PI / 2 + 0.1, -Math.PI / 2 - 0.1]) { const b = vis(sg); if (b > 0.15 && b < Math.PI - 0.15) { line(range(24, 50, at(fOf(b)), 3)); ink(lw * 0.8); for (let x = 27; x < 49; x += 3.6) { const y = at(fOf(b))(x); pts([[x - 1, y], [x, y - 1.8 * Math.sin(b)], [x + 1, y]]); ctx.fillStyle = C.teeth; ctx.fill(); ink(lw * 0.45); } } }
    for (const sg of [Math.PI - 0.55, Math.PI + 0.55]) { const b = vis(sg); if (b > 0.2 && b < Math.PI - 0.1) { const [X, Y] = M(27.3, at(fOf(b))(27.3)); eye(ctx, X, Y, { r: 3.1, iris: C.eye, irisLo: C.eyeLo, pupil: 'slit', wide: 1, lid: 0.1, lidCol: C.base, line: C.line, lw: lw * 0.7 }); } }
    for (const [sg, x0] of [[0.95, -11], [0.95, 14], [-0.95, -11], [-0.95, 14]]) {
      const b = vis(sg); if (b < 0) continue;
      const y = at(fOf(b))(x0), out = -Math.cos(b), wv = Math.sin(t * 18 + x0) * 2;
      const P = [[x0, y], [x0 + 2 + wv * 0.4, y + out * 4.5 + 1], [x0 + 5 + wv, y + out * 8]].map(([a, c]) => M(a, c));
      limb(ctx, P, [3, 2.4, 1.9], sg > 0 ? C.base : C.lo, C.line, lw * 0.8);
    }
    // spin streaks
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.3;
    for (let i = 0; i < 4; i++) { const x = -34 + i * 21 + ((phi * 3 + i * 1.7) % 6), yb = G_BOT(x) + 1, yt = G_TOP0(x) * 1.25 + 2, e = i % 2 ? 1 : -1; const [X0, Y0] = M(x - 3 * e, yb), [X1, Y1] = M(x + 4 * e, (yb + yt) / 2), [X2, Y2] = M(x - 2 * e, yt); ctx.beginPath(); ctx.moveTo(X0, Y0); ctx.quadraticCurveTo(X1, Y1, X2, Y2); ctx.stroke(); }
  }
}

// ================================================================= the snapping turtle (art units: 100 = shell length)
// A heavy keeled dome (three keel knobs in the silhouette, a serrated back rim), a big wedge head with a hooked beak on a neck
// that pulls back and strikes, thick clawed legs that plant as it crawls, a spiked tail. A flip is a real tumble in profile.
const T_DOME = prof([[-39, 7], [-34, 17], [-22, 26], [-6, 29.5], [10, 27], [22, 19.5], [30, 9.5], [32, 7]]);
const tKnob = (x) => Math.max(0, 1 - Math.abs(x + 22) / 4.5, 1 - Math.abs(x + 5) / 5, 1 - Math.abs(x - 11) / 4.5) * 3 + (x < -30 ? 1.2 * Math.abs(Math.sin((x + 39) * 1.05)) : 0);
const T_SHELL = (x) => T_DOME(x) + tKnob(x);
export function drawTurtle(ctx, s, t = 0, o = {}) {
  if (!(s > 0)) return;
  const C = TURT, U = s / 100, lw = clamp(2 / U, 1.2, 3.4), flip = clamp(o.flip || 0, 0, 1), tuck = clamp(o.shell || 0, 0, 1);
  const head = o.head || 0, mouth = clamp(o.mouth || 0, 0, 1), g = o.gait || 0, walk = clamp(o.walk || 0, 0, 1), flail = o.flail || 0;
  const P = (list) => { ctx.beginPath(); list.forEach(([x, y], i) => (i ? ctx.lineTo(x, -y) : ctx.moveTo(x, -y))); ctx.closePath(); };
  const S = (list, closed = true) => { ctx.beginPath(); spline(ctx, list.map(([x, y]) => [x, -y]), closed); };
  const range = (a, b, f, step = 1.5) => { const out = []; const n = Math.ceil(Math.abs(b - a) / step); for (let i = 0; i <= n; i++) { const x = a + ((b - a) * i) / n; out.push([x, f(x)]); } return out; };
  const ink = (w = lw) => { ctx.lineWidth = w; ctx.strokeStyle = C.line; ctx.stroke(); };
  const onBack = flip > 0.5;
  ctx.save();
  try {
    ctx.scale(U, U);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // contact shadow
    ctx.fillStyle = 'rgba(0,0,0,0.26)'; ctx.beginPath(); ctx.ellipse(-2, 0.4, 40 - 8 * Math.sin(flip * Math.PI), 2.4, 0, 0, TAU); ctx.fill();
    // the tumble: it rolls over its tail in profile with a little hop, then rocks on its dome
    if (flip > 0) { const e = flip * flip * (3 - 2 * flip); ctx.translate(-6 * Math.sin(e * Math.PI), -16 - Math.sin(e * Math.PI) * 13); ctx.rotate(-Math.PI * e + (onBack ? Math.sin(t * 5.5) * 0.09 * flail * flip : 0)); ctx.translate(0, 16); }
    else ctx.translate(0, -walk * Math.abs(Math.sin(g)) * 0.7 - (head > 0.3 ? 0 : 0)); // a slow rolling crawl
    const leg = (hipX, ph, far, hind) => {
      const c = (((g + ph) / TAU) % 1 + 1) % 1, st = 0.66, stride = 7 * walk;
      let fx, lift = 0;
      if (c < st) fx = stride * (0.5 - c / st); else { const u = (c - st) / (1 - st), e = u * u * (3 - 2 * u); fx = stride * (-0.5 + e); lift = Math.sin(u * Math.PI) * 3 * walk; }
      const hip = [hipX, 8.5];
      let foot = [hipX + (hind ? -3 : 3) + fx, 1.2 + lift];
      if (flip > 0.25) { const a = -Math.PI / 2 + (hind ? -0.5 : 0.5) + Math.sin(t * 13 + ph * 2 + hipX) * 0.55 * flail, k = clamp((flip - 0.25) * 2, 0, 1); foot = [lerp(foot[0], hip[0] + Math.cos(a) * 9.5, k), lerp(foot[1], hip[1] + Math.sin(a) * 9.5, k)]; }
      foot = [lerp(foot[0], hip[0], tuck * 0.9), lerp(foot[1], hip[1] - 2, tuck * 0.9)];
      const K = ik(hip[0], hip[1], foot[0], foot[1], 5.2, 5, hind ? 1 : -1), col = far ? C.skinLo : C.skin;
      limb(ctx, [hip, K, foot].map(([x, y]) => [x, -y]), [4.4, 3.8, 3.1], col, C.line, lw * 0.85);
      if (tuck < 0.7) {
        const ang = Math.atan2(-(foot[1] - K[1]), foot[0] - K[0]);
        ctx.save(); ctx.translate(foot[0], -foot[1]); ctx.rotate(flip > 0.25 ? ang : -lift * 0.07);
        ctx.fillStyle = C.claw; for (const q of [-1.6, 0.6, 2.8]) { ctx.beginPath(); ctx.moveTo(q + 0.4, 1.2); ctx.lineTo(q + 3.6, 1.6); ctx.lineTo(q + 1.6, -1); ctx.closePath(); ctx.fill(); ink(lw * 0.45); }
        ctx.restore();
      }
    };
    leg(-20, Math.PI, true, true); leg(15, 0, true, false);
    // tail: thick at the root, a row of spikes, a slow wag
    if (tuck < 0.95) {
      const wag = Math.sin(t * 2.2) * 1.2 + (onBack ? Math.sin(t * 9) * 2 * flail : 0), tx = -34 - 16 * (1 - tuck);
      S([[-33, 11], [-42, 8 + wag * 0.4], [tx - 1, 3.4 + wag], [tx, 2 + wag], [-42, 3.2 + wag * 0.3], [-33, 4]]); ctx.fillStyle = C.skinLo; ctx.fill(); ink();
      for (let i = 0; i < 3; i++) { const x = -37 - i * 4.2 * (1 - tuck), y = 9 - i * 1.5 + wag * (0.3 + i * 0.25); P([[x + 1.5, y - 0.6], [x - 0.4, y + 2.8], [x - 1.8, y - 1]]); ctx.fillStyle = C.shellDeep; ctx.fill(); ink(lw * 0.55); }
    }
    // neck and head: the neck pulls back into the shell (wind-up) and shoots out (strike)
    const hx = 39 + head * 8.5 - tuck * 18, hy = 13.5 + (head < 0 ? -head * 2.2 : 0) - tuck * 1.5 + (onBack ? Math.sin(t * 7) * 1.2 * flail : 0), tilt = (head < 0 ? head * 0.22 : head * 0.06) - (onBack ? 0.25 : 0);
    limb(ctx, [[24, -11], [(24 + hx) / 2 - 2, -(hy - 3 + head * 1.5)], [hx - 5, -(hy - 1)]], [6, 5.4, 5.6], C.skin, C.line, lw * 0.9);
    ctx.strokeStyle = C.skinLo; ctx.lineWidth = 1; for (let i = 1; i <= 2; i++) { const f = i / 3, x = lerp(26, hx - 7, f); if (hx - 7 > 30) { ctx.beginPath(); ctx.moveTo(x, -(hy - 5)); ctx.quadraticCurveTo(x + 1.6, -(hy - 1), x, -(hy + 2.5)); ctx.stroke(); } }
    ctx.save(); ctx.translate(hx, -hy); ctx.rotate(tilt);
    // lower jaw (drops open), mouth, then the skull with its hooked beak
    const mo = mouth * 0.55;
    ctx.save(); ctx.translate(-3, 2.5); ctx.rotate(mo);
    ctx.beginPath(); spline(ctx, [[-2, -1.5], [6, -1.2], [13.5, -0.4], [14.2, 1.2], [8, 4.6], [-1, 5.6], [-4.5, 2]], true); ctx.fillStyle = C.skinLo; ctx.fill(); ink(lw * 0.85);
    ctx.beginPath(); ctx.moveTo(8, -1.3); ctx.lineTo(14.4, -0.6); ctx.lineTo(13.6, 1.8); ctx.lineTo(9.5, 2.4); ctx.closePath(); ctx.fillStyle = C.beak; ctx.fill(); ink(lw * 0.6);
    ctx.restore();
    if (mouth > 0.08) { ctx.beginPath(); ctx.moveTo(-3, 2.2); ctx.lineTo(11, 0.6); ctx.lineTo(-3 + 14 * Math.cos(mo), 2.5 + 14 * Math.sin(mo) - 1.4); ctx.closePath(); ctx.fillStyle = C.mouth; ctx.fill(); }
    const skull = () => { ctx.beginPath(); spline(ctx, [[-9.5, -1], [-7.5, -7], [-1, -9.6], [6, -8], [11, -4.2], [15.2, 1.4], [14.4, 3.6], [11, 1.2], [4, 2.2], [-4, 3.2], [-9, 2.6]], true, 0.5); };
    form(ctx, skull, { d: 2.2, lo: C.skinLo, base: C.skin, hi: C.skinHi, hiK: 0.5, line: C.line, lw, noWeight: true, inner: () => {
      ctx.beginPath(); ctx.moveTo(7.5, -9); ctx.lineTo(18, -6); ctx.lineTo(18, 6); ctx.lineTo(6.5, 6); ctx.quadraticCurveTo(10, -1, 7.5, -9); ctx.fillStyle = C.beak; ctx.fill();
      ctx.beginPath(); ctx.moveTo(9, -6.6); ctx.quadraticCurveTo(12.5, -3.4, 14, 0); ctx.lineWidth = 1.3; ctx.strokeStyle = C.beakHi; ctx.stroke();
    } });
    ctx.beginPath(); ctx.arc(11.6, -3.4, 0.6, 0, TAU); ctx.fillStyle = C.line; ctx.fill(); // nostril
    if (o.eye === 'spiral') { ctx.beginPath(); ctx.arc(2.6, -3.6, 3, 0, TAU); ctx.fillStyle = '#fff6d8'; ctx.fill(); ink(lw * 0.7); spiralEye(ctx, 2.6, -3.6, 3, t, 1, C.line); }
    else eye(ctx, 2.6, -3.6, { r: 3, iris: C.eye, irisLo: C.eyeLo, pupil: 'round', pupilR: 0.36, look: { x: 0.5, y: 0.1 }, lid: Math.max(o.glare ? 0.3 : 0.16, blinkAt(t, 7)), mad: o.glare ? 0.42 : 0.12, lidCol: C.skin, line: C.line, lw: lw * 0.7, shut: o.eye === 'shut' ? 1 : 0 });
    if (o.glare) { ctx.beginPath(); ctx.moveTo(-1.6, -8); ctx.lineTo(6.4, -5.4); ink(lw * 1.2); }
    ctx.restore();
    // plastron (belly plate): on its back this is what faces up
    const plast = () => { S([[-33, 8], [-30, 3.4], [0, 2.2], [27, 3.4], [30, 8], [0, 9.5]]); };
    form(ctx, plast, { d: 1.6, lo: C.plastronLo, base: C.plastron, line: C.line, lw: lw * 0.85, noWeight: true, inner: () => { ctx.strokeStyle = C.plastronLo; ctx.lineWidth = 1; for (const x of [-20, -8, 4, 16]) { ctx.beginPath(); ctx.moveTo(x, -9); ctx.lineTo(x + 0.6, -2.4); ctx.stroke(); } } });
    // the shell
    const dome = range(-39, 32, T_SHELL, 0.9), shellPath = () => P([...dome, [32, 6.5], [-39, 6.5]]);
    form(ctx, shellPath, { d: 4.2, lo: C.shellLo, base: C.shell, hi: C.shellHi, hiK: 0.4, line: C.line, lw, inner: () => {
      // scute plates: seams from the rim up to the keel, a seam round the dome, darker keel knobs
      ctx.strokeStyle = C.shellDeep; ctx.lineWidth = 1.3;
      for (const [x0, x1] of [[-30, -28.5], [-14.5, -13.5], [2.5, 3], [18, 16.5]]) { ctx.beginPath(); ctx.moveTo(x0, -10.5); ctx.quadraticCurveTo((x0 + x1) / 2 + 1.5, -(T_DOME(x1) * 0.6), x1, -(T_DOME(x1) - 0.5)); ctx.stroke(); }
      ctx.beginPath(); range(-36, 30, (x) => lerp(8, T_DOME(x), 0.52), 3).forEach(([x, y], i) => (i ? ctx.lineTo(x, -y) : ctx.moveTo(x, -y))); ctx.stroke();
      for (const c of [-22, -5, 11]) { P([[c - 4.5, T_DOME(c) - 0.6], [c, T_DOME(c) + 4], [c + 4.5, T_DOME(c) - 0.6], [c, T_DOME(c) - 2.4]]); ctx.fillStyle = C.shellDeep; ctx.fill(); }
      for (const [x, r] of [[-13.5, 3.6], [4, 2.8]]) { ctx.beginPath(); ctx.ellipse(x, -(T_DOME(x) - 1), r * 1.6, r * 0.7, 0, 0, TAU); ctx.fillStyle = C.moss; ctx.fill(); }
      // the marginal rim
      P([[-40, 11.5], [33, 11.5], [33, 5], [-40, 5]]); ctx.fillStyle = C.shellLo; ctx.fill();
      ctx.strokeStyle = C.shellDeep; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-39, -11.5); ctx.lineTo(32, -11.5); for (let x = -32; x < 30; x += 6.2) { ctx.moveTo(x, -11.5); ctx.lineTo(x - 0.6, -6.5); } ctx.stroke();
    } });
    // tucked in: two eyes glint in the dark of the shell mouth
    if (tuck > 0.6) { ctx.globalAlpha = (tuck - 0.6) / 0.4; P([[24, 7.2], [31.4, 7.2], [30, 13.5], [25, 14.5]]); ctx.fillStyle = '#1a1c0c'; ctx.fill(); ink(lw * 0.7); const bl = blinkAt(t, 3) > 0.5; if (!bl) for (const x of [26.2, 29]) { ctx.beginPath(); ctx.ellipse(x, -10.6, 0.95, 1.3, 0, 0, TAU); ctx.fillStyle = C.eye; ctx.fill(); } ctx.globalAlpha = 1; }
    leg(-24, 0, false, true); leg(19, Math.PI, false, false);
  } catch (e) { if (!drawTurtle.w) { drawTurtle.w = 1; console.warn('turtle art', e); } }
  ctx.restore();
  if (o.stars > 0) dizzyStars(ctx, onBack ? -s * 0.36 : s * 0.38, -s * (onBack ? 0.3 : 0.34), s * 0.16, s * 0.05, t, { size: Math.max(3, s * 0.06), fade: o.stars });
}

// ================================================================= mosquitoes
// One insect, sz = body length px, nose toward +x. A round amber thorax and head with a big red eye, a long needle, a striped
// abdomen (a red balloon when fed), pale wings that blur as they beat, long legs that trail under it.
const MQ = { line: '#1c0e06', body: '#d07a2a', bodyLo: '#8a4616', bodyHi: '#f4a850', stripe: '#3a1e0e', pale: '#ffe6a8', fed: '#e23a34', fedLo: '#9a1c20', fedHi: '#ff8a6a', eye: '#ff4638', wing: 'rgba(232,244,250,0.82)', wingLo: 'rgba(170,200,214,0.55)' };
export function drawMosquito(ctx, x, y, sz, t, o = {}) {
  const lw = Math.max(1, sz * 0.075), face = o.face || 1, ph = t * 58 + (o.seed || 0) * 2.1, fl = Math.sin(ph), fed = o.fed ? 1 : 0, droop = o.droop || 0;
  ctx.save();
  ctx.translate(x, y); ctx.scale(face, 1); ctx.rotate(o.tilt || 0); ctx.scale(sz, sz);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const ink = (w = 1) => { ctx.lineWidth = (lw * w) / sz; ctx.strokeStyle = MQ.line; ctx.stroke(); };
  // legs: three long bent legs trailing down and back, swinging a little
  ctx.beginPath();
  for (const [x0, kx, ky, fx, fy, p] of [[0.1, 0.26, 0.2, 0.18, 0.5, 0], [0, -0.06, 0.26, -0.2, 0.52, 1.3], [-0.08, -0.3, 0.2, -0.52, 0.42, 2.6]]) { const sw = Math.sin(t * 7 + p + (o.seed || 0)) * 0.04; ctx.moveTo(x0, 0.1); ctx.lineTo(kx + sw, ky + 0.08); ctx.lineTo(fx + sw * 2, fy + droop * 0.1); }
  ink(0.75);
  // the far wing, then the body, then the near wing: each wing is drawn at its beat angle with a faint ghost at the other end
  const wing = (a, ghost) => { ctx.save(); ctx.translate(-0.02, -0.13); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-0.18, -0.2, -0.6, -0.2, -0.7, -0.02); ctx.bezierCurveTo(-0.6, 0.1, -0.2, 0.08, 0, 0); ctx.closePath(); ctx.fillStyle = ghost ? MQ.wingLo : MQ.wing; ctx.fill(); if (!ghost) ink(0.6); ctx.restore(); };
  const beat = droop ? 0.9 : 0.55 * fl;
  wing(0.75 - beat * 0.8, true); wing(0.95 + beat, false);
  // abdomen: a tapered striped tail, a round red balloon when it has fed
  const ab = () => { ctx.beginPath(); ctx.moveTo(-0.06, -0.1); ctx.bezierCurveTo(-0.3, -0.16 - fed * 0.1, -0.62, -0.06 - fed * 0.08, -0.74, 0.14 + droop * 0.08); ctx.bezierCurveTo(-0.62, 0.26 + fed * 0.12, -0.26, 0.24 + fed * 0.1, -0.04, 0.12); ctx.closePath(); };
  ab(); ctx.fillStyle = fed ? MQ.fedLo : MQ.bodyLo; ctx.fill();
  ctx.save(); ab(); ctx.clip();
  ctx.translate(-0.02, -0.05); ab(); ctx.fillStyle = fed ? MQ.fed : MQ.pale; ctx.fill();
  if (!fed) { ctx.strokeStyle = MQ.stripe; ctx.lineWidth = 0.085; ctx.beginPath(); for (const d of [-0.2, -0.36, -0.52, -0.66]) { ctx.moveTo(d, -0.3); ctx.lineTo(d - 0.05, 0.4); } ctx.stroke(); }
  else { ctx.fillStyle = MQ.fedHi; ctx.beginPath(); ctx.ellipse(-0.36, -0.06, 0.14, 0.05, 0.2, 0, TAU); ctx.fill(); }
  ctx.restore();
  ab(); ink();
  // thorax and head
  ctx.beginPath(); ctx.ellipse(0.02, 0, 0.21, 0.19, 0, 0, TAU); ctx.fillStyle = MQ.bodyLo; ctx.fill();
  ctx.save(); ctx.clip(); ctx.beginPath(); ctx.ellipse(-0.01, -0.04, 0.2, 0.18, 0, 0, TAU); ctx.fillStyle = MQ.body; ctx.fill(); ctx.beginPath(); ctx.ellipse(-0.04, -0.1, 0.1, 0.045, -0.3, 0, TAU); ctx.fillStyle = MQ.bodyHi; ctx.fill(); ctx.restore();
  ctx.beginPath(); ctx.ellipse(0.02, 0, 0.21, 0.19, 0, 0, TAU); ink();
  // the needle and the feelers
  ctx.beginPath(); ctx.moveTo(0.44, 0.06); ctx.lineTo(0.92, 0.3 + droop * 0.1); ink(1.5); ctx.lineWidth = (lw * 0.6) / sz; ctx.strokeStyle = MQ.pale; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.4, -0.1); ctx.quadraticCurveTo(0.52, -0.3, 0.66, -0.26 + fl * 0.02); ctx.moveTo(0.36, -0.12); ctx.quadraticCurveTo(0.42, -0.34, 0.54, -0.36 - fl * 0.02); ink(0.6);
  ctx.beginPath(); ctx.arc(0.33, 0, 0.16, 0, TAU); ctx.fillStyle = MQ.body; ctx.fill(); ink();
  if (o.dizzy) { ctx.beginPath(); for (const d of [-1, 1]) { ctx.moveTo(0.3, -0.08 * d - 0.02); ctx.lineTo(0.44, 0.06 * d - 0.02); } ink(0.9); }
  else { ctx.beginPath(); ctx.arc(0.37, -0.03, 0.095, 0, TAU); ctx.fillStyle = MQ.eye; ctx.fill(); ink(0.6); ctx.beginPath(); ctx.arc(0.345, -0.06, 0.032, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); }
  ctx.restore();
}
// a swarm: a big leader and its followers weaving round (x, y) in a cloud of radius R px. o.tight 0..1 (pulls in onto an egg),
// o.spread 0..1 (scatter), o.fall 0..1 (stunned: they droop), o.fed
export function drawSwarm(ctx, x, y, R, t, o = {}) {
  const n = o.n || 4, tight = o.tight || 0, spread = o.spread || 0, fall = o.fall || 0;
  ctx.save();
  // a faint dark haze so the cloud reads on light rings (never a pale halo)
  if (spread < 0.6) { ctx.globalAlpha = 0.12 * (1 - spread) * (o.alpha ?? 1); ctx.fillStyle = '#1a1208'; ctx.beginPath(); ctx.arc(x, y, R * 1.15, 0, TAU); ctx.fill(); ctx.globalAlpha = 0.5 * 0.14 * (1 - spread) * (o.alpha ?? 1); ctx.beginPath(); ctx.arc(x, y, R * 1.5, 0, TAU); ctx.fill(); }
  // far ones first, the leader last
  for (let j = n - 1; j >= 0; j--) {
    const i = j, lead = i === 0, sz = Math.max(9, R * (lead ? 1.12 : 0.74 + 0.12 * hash(i * 5.1))) * (1 - 0.2 * tight);
    const p = hash(i * 7.3 + (o.seed || 0)) * TAU, sp = (lead ? 1.5 : 2.2 + hash(i * 3.1) * 1.6), rr = R * (lead ? 0.36 : 0.62 + 0.38 * hash(i * 1.9)) * (1 - 0.5 * tight) * (1 + spread * 3.6);
    const a = p + t * sp * (i % 2 ? 1 : -1), jx = Math.sin(t * 23 + i * 5) * R * 0.05, jy = Math.cos(t * 19 + i * 3) * R * 0.05;
    let px = x + Math.cos(a) * rr + jx, py = y + Math.sin(a * 2) * rr * 0.55 + jy + fall * R * (0.5 + hash(i) * 0.7) + (lead ? -R * 0.18 : 0);
    if (tight > 0.5) py = Math.min(py, y - R * 0.05) - R * 0.3; // they hold the egg from above, so it stays in view
    const vx = -Math.sin(a) * (i % 2 ? 1 : -1), dive = Math.cos(a * 2) * 0.35 * (i % 2 ? 1 : -1);
    ctx.globalAlpha = (1 - spread * spread) * (o.alpha ?? 1);
    drawMosquito(ctx, px, py, sz, t, { face: vx > 0 ? 1 : -1, seed: i + (o.seed || 0), tilt: fall ? 1.1 + hash(i * 2.2) * 0.5 : dive * (1 - tight * 0.5) + tight * 0.5, fed: o.fed && (lead || i % 2 === 0), droop: fall, dizzy: fall > 0.5 });
  }
  ctx.restore();
}

// ================================================================= in game
const pxSpace = (ctx, x, y, k, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(1 / k, -1 / k); try { f(); } catch (e) { /* art never breaks the frame */ } ctx.restore(); };
const ANIM = new Map(); // per creature: eased face, gait, last position (render only)
function look(key, sim, x, y, face, t) {
  let A = ANIM.get(key);
  if (!A || A.sim !== sim) { A = { sim, f: face, g: 0, x, y, t, sp: 0 }; ANIM.set(key, A); }
  const dt = clamp(t - A.t, 0, 0.1), d = Math.hypot(x - A.x, y - A.y);
  A.g += d * 9; A.sp = lerp(A.sp, dt > 0 ? d / dt : 0, 0.2); A.f = lerp(A.f, face, 1 - Math.exp(-dt * 10)); A.x = x; A.y = y; A.t = t;
  return A;
}
// the creature's local frame (px, y down, +x = along the floor toward its head)
function frame(ctx, C, rad, k, f) {
  const a = C.a, c = Math.cos(a), s = Math.sin(a), x = rad * c, y = rad * s;
  pxSpace(ctx, x, y, k, () => { const tx = -s, ty = c, nx = -c, ny = -s; ctx.transform(tx, -ty, -nx, ny, 0, 0); f(); });
}
const want = (C) => (C.frz > 0 ? { k: 'ice', left: C.frz } : C.stn > 0 || C.zap > 0 ? { k: 'stun', zap: C.zap > 0, left: C.stn } : null);

// regular gators and babies are drawn this much bigger than their sim body (the collider, jaw point and reach are unchanged);
// Grandpa Gator already fills his channel.
const GATOR_DRAW = 1.22;
export function drawBayou(ctx, sim, t, k) {
  if (!sim.gators) return;
  const B = sim.bx && sim.bx.boss;
  for (const G of sim.gators) {
    if (G.ph === 'hid' || G.ph === 'gone') continue;
    const rf = sim.byFloor(G.ch), A = look('g' + G.id, sim, G.x, G.y, G.face, t), len = GATOR.L * G.s * k, st = statusClock(sim, 'bg' + G.id, want(G), t);
    const atk = G.boss && B && B.atk, warnU = atk && atk.ph === 'warn' ? clamp(1 - atk.t / atk.dur, 0, 1) : 0;
    let jaw = 0, eye = 'open', tail = 0, alpha = 1, sink = 0;
    if (G.ph === 'log') eye = G.next > 0.6 ? 'shut' : 'half';
    if (G.ph === 'warn') { jaw = ss(0, 0.6, G.t / G.dur); eye = 'open'; }
    if (G.ph === 'after') jaw = G.t < 0.1 ? 1 - G.t / 0.1 : 0;
    if (G.ph === 'flee') eye = 'squint';
    if (G.ph === 'dizzy') { eye = 'spiral'; jaw = 0.3; }
    if (G.ph === 'hurt') { eye = 'squint'; jaw = 0.5; }
    if (G.ph === 'beaten') { eye = 'spiral'; alpha = 1 - ss(0.4, 1, G.t / G.dur); sink = ss(0.2, 1, G.t / G.dur) * 0.35 * G.s; }
    if (G.ph === 'in') alpha = ss(0, 1, G.t / G.dur);
    if (atk && atk.name === 'sweep') tail = atk.ph === 'warn' ? 0.95 * ss(0, 0.6, warnU) + Math.sin(t * 30) * 0.05 * warnU : -0.25;
    if (atk && atk.name === 'roll' && atk.ph === 'warn') { jaw = 0.9 * ss(0, 0.5, warnU); eye = 'open'; }
    const stun = st && (st.k === 'stun');
    if (stun) { eye = 'spiral'; jaw = 0.25; }
    const o = { jaw, eye, tail, boss: G.boss, baby: G.call && !G.boss, gait: (A.g / 9 / (0.121 * GATOR.L * G.s)) * TAU, walk: clamp(A.sp / 0.07, 0, 1), chomp: G.ph === 'after' ? clamp(1 - G.t / 0.32, 0, 1) : 0, bend: rf * k, roll: G.roll > 0 ? 1 - G.roll / 0.9 : 0, sneeze: G.sneeze > 0 ? G.sneeze / 0.8 : 0, stars: G.ph === 'dizzy' || stun ? 1 : 0, alpha, id: G.id, look: 0.35, noZ: !!st };
    // the telegraph: a red bite mark over the jaws while they open at an egg
    if (G.ph === 'warn') biteMark(ctx, sim.gJaw(G), t, k, ss(0, 1, G.t / G.dur), G.s);
    frame(ctx, G, rf + sink, k, () => {
      ctx.scale(A.f >= 0 ? 1 : -1, 1);
      if (Math.abs(A.f) < 0.999) ctx.scale(Math.max(0.15, Math.abs(A.f)), 1);
      const S = len * (G.boss ? 1 : GATOR_DRAW), box = { x0: -S * 0.66, y0: -S * 0.7, x1: S * 0.76, y1: S * 0.1 }; // drawn bigger than the collider, about its feet
      statusDraw(ctx, box, (c) => drawGator(c, S, st ? st.hold : t, o), st, { off: Math.max(1.1, S * 0.012), crys: Math.max(1, S / 90) });
    });
  }
  for (const T of sim.turtles) {
    const rf = sim.byFloor(T.ch), A = look('t' + T.id, sim, T.x, T.y, T.face, t), L = TURTLE.L * k, st = statusClock(sim, 'bt' + T.id, want(T), t);
    const flipU = T.ph === 'flip' ? ss(0, 0.25, T.t) : T.ph === 'right' ? 1 - ss(0, 1, T.t / T.dur) : 0;
    const o = { head: T.ph === 'warn' ? -0.9 : T.ph === 'clamp' ? 0.75 : 0, mouth: T.ph === 'warn' ? ss(0, 1, T.t / Math.max(0.01, T.dur)) : 0, gait: (A.g / 9 / (0.106 * TURTLE.L)) * TAU, walk: clamp(A.sp / 0.05, 0, 1), flip: flipU, flail: 1, shell: T.ph === 'shell' ? 1 - ss(0.75, 1, T.t / T.dur) : 0, eye: st && st.k === 'stun' ? 'spiral' : T.ph === 'flip' ? 'spiral' : undefined, glare: T.ph === 'warn' || T.ph === 'clamp', stars: (st && st.k === 'stun') || (T.ph === 'flip' && T.t > 0.3) ? 1 : 0 };
    frame(ctx, T, rf, k, () => {
      ctx.scale(A.f >= 0 ? 1 : -1, 1);
      const box = { x0: -L * 0.62, y0: -L * 0.5, x1: L * 0.7, y1: L * 0.1 };
      statusDraw(ctx, box, (c) => drawTurtle(c, L, st ? st.hold : t, o), st, { off: Math.max(1, L * 0.02), crys: Math.max(1, L / 60) });
    });
  }
}
// over the eggs: the turtle's beak round a clamped egg, the swarms
export function drawBayouOver(ctx, sim, t, k) {
  if (!sim.gators) return;
  for (const T of sim.turtles) {
    if (!T.eid || T.ph !== 'clamp') continue;
    const rf = sim.byFloor(T.ch), A = ANIM.get('t' + T.id), L = TURTLE.L * k;
    frame(ctx, T, rf, k, () => {
      ctx.scale(A && A.f < 0 ? -1 : 1, 1);
      ctx.save(); ctx.beginPath(); ctx.rect(L * 0.35, -L * 0.4, L * 0.4, L * 0.4); ctx.clip();
      drawTurtle(ctx, L, t, { head: 0.75, glare: 1 });
      ctx.restore();
    });
  }
  for (const Q of sim.mosqs) {
    if (Q.ph === 'hid') continue;
    const st = statusClock(sim, 'bq' + Q.id, Q.frz > 0 ? { k: 'ice', left: Q.frz } : null, t);
    const R = 0.5 * k, spread = Q.ph === 'scatter' ? ss(0, 0.8, Q.t) : 0, tight = Q.ph === 'latch' || Q.ph === 'lift' ? 1 : Q.ph === 'hunt' ? 0.3 : 0;
    if (Q.ph === 'scatter' && Q.t > 0.9) continue;
    pxSpace(ctx, Q.x, Q.y, k, () => {
      const o = { tight, spread, fall: Q.stn > 0 ? 1 : 0, fed: Q.ph === 'lift', seed: Q.id * 13 };
      statusDraw(ctx, { x0: -R * 2, y0: -R * 2, x1: R * 2, y1: R * 2 }, (c) => drawSwarm(c, 0, 0, R, st ? st.hold : t, o), st, { quick: true, off: 0.8, crys: 0.6 });
      if (Q.stn > 0) dizzyStars(ctx, 0, -R * 1.2, R * 0.9, R * 0.25, t, { size: Math.max(2.6, R * 0.22) });
      if (Q.ph === 'lift') liftMark(ctx, R, t);
    });
  }
}
// a red bite mark: two jaw arcs that close in as the snap nears (the snap zone)
function biteMark(ctx, J, t, k, u, s) {
  const r = (0.42 + 0.12 * (1 - u)) * Math.sqrt(s) * k, pulse = 0.75 + 0.25 * Math.sin(t * 16);
  pxSpace(ctx, J.x, J.y, k, () => {
    ctx.save(); ctx.lineCap = 'round';
    for (const [w, col] of [[Math.max(3.4, r * 0.2), '#3a0808'], [Math.max(1.8, r * 0.1), `rgba(255,${80 + 60 * pulse | 0},60,1)`]]) {
      ctx.lineWidth = w; ctx.strokeStyle = col;
      for (const d of [-1, 1]) { ctx.beginPath(); ctx.arc(0, d * r * 0.25 * (1 - u), r, d < 0 ? Math.PI * 1.15 : Math.PI * 0.15, d < 0 ? Math.PI * 1.85 : Math.PI * 0.85); ctx.stroke(); }
      for (let i = -2; i <= 2; i++) for (const d of [-1, 1]) { const x = i * r * 0.32; ctx.beginPath(); ctx.moveTo(x, d * r * 0.55 * (1 - u * 0.7)); ctx.lineTo(x, d * r * 0.3 * (1 - u * 0.7)); ctx.stroke(); }
    }
    ctx.restore();
  });
}
function liftMark(ctx, R, t) {
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    const y = -R * 1.3 - ((t * 1.4 + i * 0.5) % 1) * R * 0.9, a = 1 - ((t * 1.4 + i * 0.5) % 1);
    ctx.globalAlpha = a;
    for (const [w, col] of [[3.2, '#2a1a08'], [1.6, '#ffcf5a']]) { ctx.lineWidth = w; ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(-R * 0.35, y + R * 0.25); ctx.lineTo(0, y); ctx.lineTo(R * 0.35, y + R * 0.25); ctx.stroke(); }
  }
  ctx.restore();
}

// ================================================================= events (popups, sound, particles)
export function bayouEvent(ev, fx, api) {
  const { popup, audio, once } = api;
  switch (ev.type) {
    case 'gatorWarn': audio.play('squish', { vol: 0.7, pitch: 0.45 }); once('gator', 'A gator! Its jaws open under a gap: turn that gap away.'); break;
    case 'gatorSnap':
      audio.play('steel_clang', { vol: ev.hit ? 0.8 : 0.5, pitch: ev.boss ? 0.4 : 0.7 });
      fx.shake = Math.max(fx.shake, ev.hit ? 0.3 : 0.12);
      popup(ev.x, ev.y + 0.55, ev.decoy ? 'Wood!' : ev.stone ? 'Clonk!' : ev.hit ? 'Chomp!' : 'Missed!', { color: ev.hit ? '#ff8a6a' : '#e8f4c8', size: 20, life: 0.9 });
      break;
    case 'gatorFlee': if (ev.why === 'pepper') { audio.play('bubble_on', { vol: 0.6, pitch: 1.6 }); popup(ev.x, ev.y + 0.6, 'Achoo!', { color: '#ffb07a', size: 20, life: 0.9 }); } break;
    case 'gatorDizzy': once('gdizzy', 'He is dizzy! Drop an egg on him, or hit him with pepper or the laser.'); break;
    case 'gatorHit':
      audio.play('egg_bump', { vol: 0.9, pitch: 0.5 }); audio.play('steel_clang', { vol: 0.6, pitch: 1.4 });
      fx.shake = Math.max(fx.shake, 0.4);
      fx.chips(ev.x, ev.y + 0.2, '#fff1cc', 6, 2.2); // a tooth flies
      popup(ev.x, ev.y + 0.7, ev.hp > 0 ? `Ouch! ${ev.hp} left` : 'Beaten!', { color: '#fff2a8', size: 22, life: 1.2 });
      break;
    case 'gatorBeaten': audio.play('unlock', { vol: 0.8, pitch: 0.8 }); break;
    case 'gatorIn': audio.play('splash', { vol: 0.6, pitch: 0.8 }); fx.dust(ev.x, ev.y, 6); break;
    case 'turtleClamp': audio.play('steel_clang', { vol: 0.5, pitch: 1.1 }); popup(ev.x, ev.y + 0.5, 'Clamped!', { color: '#e8e2a0', size: 18, life: 0.9 }); once('turtle', 'The turtle holds your egg: it is safe, but stuck. Drop an egg on its shell to flip it.'); break;
    case 'turtleFlip': audio.play('rock_hit', { vol: 0.7, pitch: 1.2 }); popup(ev.x, ev.y + 0.6, 'Flipped!', { color: '#ffe08a', size: 20, life: 0.9 }); break;
    case 'mosqLatch': audio.play('wind_gust', { vol: 0.3, pitch: 2.6 }); once('mosq', 'Mosquitoes lift eggs up. A flame or pepper scatters them.'); break;
    case 'mosqLift': popup(ev.x, ev.y + 0.4, 'Bzzz!', { color: '#ffd76a', size: 16, life: 0.8 }); break;
    case 'mosqScatter': audio.play('wind_gust', { vol: 0.35, pitch: 2.2 }); if (ev.why !== 'stone') popup(ev.x, ev.y + 0.4, 'Shoo!', { color: '#e8f4c8', size: 16, life: 0.8 }); break;
  }
}

// ================================================================= the boss card and the boss bar emblem (screen space, y down)
export function drawGatorCard(ctx, x, y, w, h, t, age) {
  const H0 = Math.min(h, w * 1.3), W0 = H0 / 1.3, pad = Math.max(2, H0 * 0.025);
  const e = age == null ? 1 : clamp(age / 0.45, 0, 1), pop = e < 1 ? 0.6 + 0.4 * (1 - Math.pow(1 - e, 3)) + Math.sin(e * Math.PI) * 0.08 : 1;
  const dw = (W0 - pad * 2) * pop, dh = (H0 - pad * 2) * pop, cx = x + w / 2, cy = y + h / 2 + Math.sin(t * 2.1) * h * 0.012, r = dw * 0.07;
  const rr = (px, py, pw, ph, rad) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(px, py, pw, ph, rad) : ctx.rect(px, py, pw, ph); };
  ctx.save();
  ctx.globalAlpha *= Math.min(1, e * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; rr(cx - dw / 2 + pad * 0.6, cy - dh / 2 + pad * 1.2, dw, dh, r); ctx.fill();
  ctx.fillStyle = '#5a3a1c'; rr(cx - dw / 2 - pad, cy - dh / 2 - pad, dw + pad * 2, dh + pad * 2, r + pad); ctx.fill();
  ctx.fillStyle = '#f2c25a'; rr(cx - dw / 2 - pad * 0.45, cy - dh / 2 - pad * 0.45, dw + pad * 0.9, dh + pad * 0.9, r + pad * 0.45); ctx.fill();
  rr(cx - dw / 2, cy - dh / 2, dw, dh, r);
  ctx.save(); ctx.clip();
  const g = ctx.createLinearGradient(0, cy - dh / 2, 0, cy + dh / 2);
  g.addColorStop(0, '#2a1a44'); g.addColorStop(0.45, '#8a3a5a'); g.addColorStop(0.62, '#e08a4a'); g.addColorStop(0.63, '#2f4a3a'); g.addColorStop(1, '#16281e');
  ctx.fillStyle = g; ctx.fillRect(cx - dw / 2, cy - dh / 2, dw, dh);
  // a low sun and cypress silhouettes
  ctx.fillStyle = '#ffcf7a'; ctx.beginPath(); ctx.arc(cx + dw * 0.18, cy + dh * 0.12, dw * 0.13, Math.PI, TAU); ctx.fill();
  ctx.fillStyle = '#1a1424';
  for (const [fx, fh] of [[-0.4, 0.42], [-0.28, 0.3], [0.38, 0.46]]) { const bx = cx + dw * fx, by = cy + dh * 0.13; ctx.fillRect(bx - dw * 0.012, by - dh * fh, dw * 0.024, dh * fh); ctx.beginPath(); ctx.moveTo(bx - dw * 0.06, by); ctx.lineTo(bx, by - dh * fh * 0.25); ctx.lineTo(bx + dw * 0.06, by); ctx.fill(); ctx.beginPath(); ctx.ellipse(bx, by - dh * fh, dw * 0.07, dh * 0.05, 0, 0, TAU); ctx.fill(); }
  // water lines and lily pads
  const wy = cy + dh * 0.13;
  ctx.strokeStyle = 'rgba(160,200,160,0.35)'; ctx.lineWidth = Math.max(1, dw * 0.008);
  for (let i = 0; i < 4; i++) { const yy = wy + dh * (0.06 + i * 0.07); ctx.beginPath(); ctx.moveTo(cx - dw * 0.45, yy); ctx.lineTo(cx - dw * 0.1 + i * dw * 0.08, yy); ctx.stroke(); }
  for (const [px, pr] of [[-0.36, 0.07], [0.34, 0.06]]) { ctx.fillStyle = '#3f8a34'; ctx.beginPath(); ctx.ellipse(cx + dw * px, wy + dh * 0.3, dw * pr, dw * pr * 0.32, 0, 0.3, TAU - 0.1); ctx.lineTo(cx + dw * px, wy + dh * 0.3); ctx.fill(); }
  // Grandpa, lying in the water, jaws a little open
  ctx.save(); ctx.translate(cx - dw * 0.02, wy + dh * 0.2);
  drawGator(ctx, dw * 0.98, t, { boss: 1, jaw: 0.35 + 0.1 * Math.sin(t * 1.5), eye: 'open', look: -0.6, tail: 0.15 * Math.sin(t * 1.2) });
  ctx.restore();
  ctx.restore();
  ctx.restore();
  return true;
}
export function drawGatorEmblem(ctx, r, t) {
  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.94, 0, TAU); ctx.clip();
  ctx.translate(-r * 1.6, r * 0.72);
  drawGator(ctx, r * 4.2, t, { boss: 1, jaw: 0.45, eye: 'open', look: -0.4 });
  ctx.restore();
}
