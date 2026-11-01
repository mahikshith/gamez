// v3 art: new creatures, hazards and special eggs. Every function draws in LOCAL y-down space centred
// on (cx, cy) in the units given (world callers wrap with scale(1,-1)). Art must never throw.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mod = (a, b) => ((a % b) + b) % b;
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const safe = (ctx, f) => { ctx.save(); try { f(); } catch (e) { /* never break the frame */ } ctx.restore(); };
const lw = (px, base) => Math.max(px, base); // line width that never thins out below px

/* ------------------------------------------------------------------ EAGLE */
// A rigged bald eagle in side view, facing right, y down. Units: 100 = body length (beak tip to tail tip).
// The body, head and legs are flat profile art; each wing is one jointed limb (shoulder, elbow, wrist) laid
// out in its own plane, and that plane is turned in 3D (stroke elevation, bank) and projected with a camera
// a little above the bird, so a beating wing foreshortens, the far wing tucks behind the body and turns
// thin in a bank, and the tail fan tilts. Poses (glide, flap, hover, dive, strike, carry, dazed, perch) are
// parameter sets blended by weight, so every transition is smooth.

const EG = {
  line: '#3b2211', // thick warm dark-brown outline, never black
  body: '#8a5a2b', bodyHi: '#ad773d', bodyLo: '#674120', bodyDk: '#4f3118',
  cov: '#93602e', covHi: '#a7713a', covLt: '#b6824a', covLo: '#734a23',
  fl: '#5e3b1c', flHi: '#7e5328', flTip: '#3e2612',
  far: '#6e4622', farHi: '#865a2f', farFl: '#53341a', farTip: '#3a2410',
  white: '#fbf7ee', whiteLo: '#ddd3c2', whiteDk: '#bfb29c',
  beak: '#f2b632', beakLo: '#c98a16', beakHi: '#ffd977', mouth: '#7a2a1a',
  leg: '#f2b632', legLo: '#c98a16', talon: '#2e1b0d',
  iris: '#f5c542', pupil: '#1b1009',
};
const D2R = Math.PI / 180;
const CAM_EL = 34 * D2R, CAM_YAW = -18 * D2R; // the camera looks from a little above and in front
const CEL = Math.cos(CAM_EL), SEL = Math.sin(CAM_EL), CYW = Math.cos(CAM_YAW), SYW = Math.sin(CAM_YAW);
const proj = (x, y, z) => [x * CYW + z * SYW, y * CEL + (-x * SYW + z * CYW) * SEL];

// pose parameters (angles in degrees). e = wing elevation (+ up), a1 = humerus sweep (+ back), d2/d3 = elbow
// and wrist bend, spread = primaries fanned, fx/fy = foot target, toes = 0 clenched .. 1 spread wide.
const POSE_KEYS = ['fold', 'tw', 'eN', 'eF', 'a1', 'd2', 'd3', 'spread', 'alula', 'bob', 'pitch', 'head', 'neck', 'fan', 'lift', 'fx', 'fy', 'toes', 'squint', 'beak', 'wide'];
const TUCK = { fx: -17, fy: 13, toes: 0 };
function flapP(ph, amp, mid, fold) {
  ph += 0.55 * (Math.cos(ph) - 1); // a long, powerful downstroke and a quick recovery
  const s = Math.sin(ph), c0 = Math.cos(ph), up = Math.max(0, -s), dn = Math.max(0, s);
  // the stroke snaps through the middle and holds at the top and bottom: mid-beat the near wing points at
  // the camera and reads as a plank, so it spends as little time there as a drawn flap would
  const c = Math.sign(c0) * Math.abs(c0) ** 0.5;
  return {
    eN: mid + amp * c, eF: mid + amp * c + 4,
    a1: 12 - 24 * dn + 14 * up * fold, d2: -26 - 26 * up * fold, d3: 26 + 4 * dn + 52 * up * fold,
    spread: 0.62 + 0.38 * dn - 0.1 * up * fold, alula: 0.3 * dn, tw: 30 * up, bob: -3.2 * Math.sin(ph - 0.5) * amp / 55,
  };
}
const POSES = {
  glide: (o, t) => ({ eN: 2 + 3 * Math.sin(t * 1.3), eF: 8 + 3 * Math.sin(t * 1.3), a1: 10, d2: -24, d3: 24 + 3 * Math.sin(t * 1.7), spread: 0.85, alula: 0, bob: 0, pitch: 0, head: 0, neck: 0, fan: 0.55, lift: 2, ...TUCK, squint: 0.25, beak: 0, wide: 0 }),
  flap: (o) => ({ ...flapP(o.phase, 50, 35, 0.5), pitch: 0, head: 0, neck: 0, fan: 0.5, lift: 0, ...TUCK, squint: 0.25, beak: 0, wide: 0 }),
  hover: (o, t) => ({ ...flapP(o.phase, 52, 38, 0.6), pitch: -26, head: 26, neck: 2, fan: 1, lift: -12, fx: 12, fy: 27, toes: 0.55 + 0.45 * Math.sin(t * 2.6), squint: 0.85, beak: 0.15, wide: 0 }),
  dive: () => ({ eN: 20, eF: 30, a1: 68, d2: -22, d3: 14, fold: 1, spread: 0, alula: 0, bob: 0, pitch: 0, head: -6, neck: 5, fan: 0.08, lift: 0, ...TUCK, squint: 0.9, beak: 0, wide: 0 }),
  strike: () => ({ eN: 72, eF: 78, a1: 24, d2: -26, d3: 30, spread: 1, alula: 1, bob: 0, pitch: 0, head: 14, neck: 3, fan: 1, lift: -20, fx: 22, fy: 22, toes: 1, squint: 1, beak: 0.45, wide: 0 }),
  carry: (o) => ({ ...flapP(o.phase, 55, 32, 0.5), pitch: -10, head: 8, neck: 1, fan: 0.85, lift: -6, fx: 4, fy: 31, toes: 0.08, squint: 0.4, beak: 0, wide: 0 }),
  dazed: (o, t) => ({ eN: -28 + 16 * Math.sin(t * 7.1), eF: 6 + 22 * Math.sin(t * 6.3 + 1), a1: 24, d2: -48, d3: 58, spread: 0.35, alula: 0, bob: 2 * Math.sin(t * 5), pitch: 14 * Math.sin(t * 3.1), head: 22 + 14 * Math.sin(t * 2.3), neck: -1, fan: 0.3, lift: 16, fx: 1, fy: 27, toes: 0.65, squint: 0, beak: 0.35, wide: 1 }),
  perch: () => ({ eN: 20, eF: 24, a1: 82, d2: -14, d3: 8, fold: 1, spread: 0, alula: 0, bob: 0, pitch: -46, head: 42, neck: 1, fan: 0.12, lift: 28, fx: 4, fy: 33, toes: 0.2, squint: 0.35, beak: 0, wide: 0 }),
};

function blendPose(w, o, t) {
  const out = {};
  for (const k of POSE_KEYS) out[k] = 0;
  let sum = 0;
  for (const name in w) {
    const wt = w[name];
    if (!(wt > 0.001) || !POSES[name]) continue;
    const p = POSES[name](o, t);
    for (const k of POSE_KEYS) out[k] += (p[k] || 0) * wt;
    sum += wt;
  }
  if (sum <= 0) return blendPose({ glide: 1 }, o, t);
  for (const k of POSE_KEYS) out[k] /= sum;
  return out;
}

// feather outline along direction ang from (x, y) in plane units; M maps plane -> body space
function featherTo(path, M, x, y, ang, L, W, tipR = 0.32) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const P = (u, v) => M(x + u * c - v * s, y + u * s + v * c);
  const m = (q) => path.moveTo(q[0], q[1]), qd = (a, b) => path.quadraticCurveTo(a[0], a[1], b[0], b[1]);
  m(P(0, -W * 0.42));
  qd(P(L * 0.55, -W * 0.5), P(L * (1 - tipR * 0.5), -W * 0.3));
  qd(P(L * 1.02, 0), P(L * (1 - tipR * 0.6), W * 0.4));
  qd(P(L * 0.5, W * 0.62), P(0, W * 0.45));
  path.closePath();
}

// One wing. S = shoulder in body space, U/V = projected span/chord axes (the wing plane's 3D turn, already
// projected). Draws a thick silhouette for the whole limb first, then each part painter-style (fill + thin
// edge, back to front) so feathers overlap cleanly and the limb reads as one shape.
function eagleWing(ctx, P, S, U, V, N, far, ow, t) {
  // A flat wing seen edge-on (mid-beat, the plane through the eye) collapses to a plank. Real wings are cupped
  // and the hand twists against the arm, so as the plane turns edge-on the trailing edge and the outer hand
  // bend out of it along the normal N: the feathers stay fanned and the wing keeps a readable width.
  const cr = Math.abs(U[0] * V[1] - U[1] * V[0]) / ((Math.hypot(U[0], U[1]) * Math.hypot(V[0], V[1])) || 1);
  const cup = clamp((0.6 - cr) / 0.6, 0, 1) ** 1.3 * 0.62;
  const M = (a, b) => { const c = cup * Math.max(0, b) * (0.35 + Math.max(0, a) / 95); return [S[0] + a * U[0] + b * V[0] + c * N[0], S[1] + a * U[1] + b * V[1] + c * N[1]]; };
  const r = (d) => d * D2R;
  const a1 = r(P.a1), a2 = a1 + r(P.d2), a3 = a2 + r(P.d3);
  const L1 = 24, L2 = 30, L3 = 17;
  const Ex = L1 * Math.cos(a1), Ey = L1 * Math.sin(a1);
  const Wx = Ex + L2 * Math.cos(a2), Wy = Ey + L2 * Math.sin(a2);
  const Hx = Wx + L3 * Math.cos(a3), Hy = Wy + L3 * Math.sin(a3);
  const fold = Math.max(clamp((-a2 - 0.2) / 1.7, 0, 1), clamp(P.fold || 0, 0, 1)), sp = clamp(P.spread, 0, 1);
  const col = far
    ? { cov: EG.far, covHi: EG.farHi, covLt: EG.farHi, covLo: EG.farFl, sec: EG.farFl, secHi: EG.far, fl: EG.farFl, tip: EG.farTip, edge: 'rgba(24,12,4,0.6)' }
    : { cov: EG.cov, covHi: EG.covHi, covLt: EG.covLt, sec: EG.fl, secHi: EG.flHi, fl: EG.fl, tip: EG.flTip, edge: 'rgba(48,26,10,0.7)' };
  const mv = (path, a, b) => { const q = M(a, b); path.moveTo(q[0], q[1]); };
  const ln = (path, a, b) => { const q = M(a, b); path.lineTo(q[0], q[1]); };
  const qc = (path, a, b, c, d) => { const q1 = M(a, b), q2 = M(c, d); path.quadraticCurveTo(q1[0], q1[1], q2[0], q2[1]); };
  // a row of feather tips: bases along a bone, tips scalloped (one shape, not nine outlines)
  const row = (bx0, by0, bx1, by1, n, dirAt, lenAt, bulge) => {
    const path = new Path2D(), tips = [];
    for (let j = 0; j <= n; j++) { const f = j / n, bx = bx0 + (bx1 - bx0) * f, by = by0 + (by1 - by0) * f, d = dirAt(f), L = lenAt(f); tips.push([bx + Math.cos(d) * L, by + Math.sin(d) * L]); }
    mv(path, bx0, by0);
    ln(path, tips[0][0], tips[0][1]);
    for (let j = 1; j <= n; j++) {
      const [x0, y0] = tips[j - 1], [x1, y1] = tips[j], mx = (x0 + x1) / 2, my = (y0 + y1) / 2, dx = x1 - x0, dy = y1 - y0;
      const s = bulge * (j % 2 ? 1 : 0.8);
      qc(path, mx + dy * s, my - dx * s, x1, y1);
    }
    ln(path, bx1, by1);
    path.closePath();
    return { path, tips };
  };
  const secDir = (f) => (a2 + Math.PI / 2 - 0.42 + f * 0.5) * (1 - fold) + (Math.PI / 2 + 0.12) * fold;
  const sec = row(Wx, Wy, Ex, Ey, 8, secDir, (f) => 29 + 9 * Math.sin(Math.min(1, f * 1.4) * Math.PI * 0.5) - f * 2 - fold * 8, 0.3);
  const tert = row(Ex, Ey, Ex * 0.25, Ey * 0.25 + 1, 3, (f) => Math.PI / 2 + 0.18 + f * 0.25, (f) => 33 - f * 12 - fold * 6, 0.3);
  // primaries: ten fingers fanned from the hand; spread opens the slots (downstroke), folded they stack
  const PL = [45, 51, 53, 51, 48, 44, 40, 37, 34, 32];
  const prim = [];
  for (let i = 9; i >= 0; i--) { // innermost first, the long outer fingers end on top
    const f = i / 9, bx = Hx + (Wx - Hx) * f * 0.9, by = Hy + (Wy - Hy) * f * 0.9;
    const ang = a3 - 0.06 * sp + Math.pow(f, 0.75) * (0.14 + 1.05 * sp) + (1 - f) * 0.04 * Math.sin(t * 2.3 + i) * (1 - fold);
    const p = new Path2D(), q = new Path2D(), L = PL[i] * (1 - 0.1 * fold), w = i < 6 ? 5.2 + i * 0.35 : 7.6;
    featherTo(p, M, bx, by, ang, L, w * 1.15, 0.45);
    featherTo(q, M, bx, by, ang, L * 0.6, w, 0.1);
    prim.push([p, q]);
  }
  // coverts: the smooth leading edge (shoulder, elbow, wrist, hand) and two scalloped bands over the bases
  const nrm = (ax, ay) => { const l = Math.hypot(ax, ay) || 1; return [-ay / l, ax / l]; };
  const n1 = nrm(Ex, Ey), n2 = nrm(Wx - Ex, Wy - Ey), n3 = nrm(Hx - Wx, Hy - Wy);
  const avg = (p, q) => { const x = p[0] + q[0], y = p[1] + q[1], l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
  const nE = avg(n1, n2), nW = avg(n2, n3);
  const band = (wS, wE, wW, wH, sc) => {
    const path = new Path2D();
    mv(path, -n1[0] * 5, -n1[1] * 5 - 1);
    qc(path, Ex - nE[0] * 6.5, Ey - nE[1] * 6.5, Wx - nW[0] * 4.5, Wy - nW[1] * 4.5);
    qc(path, Wx + (Hx - Wx) * 0.5 - n3[0] * 3.5, Wy + (Hy - Wy) * 0.5 - n3[1] * 3.5, Hx - n3[0] * 1.2, Hy - n3[1] * 1.2);
    const pts = [[Hx + n3[0] * wH, Hy + n3[1] * wH]];
    for (let i = 1; i <= 3; i++) { const f = i / 3; pts.push([Hx + (Wx - Hx) * f + (n3[0] * (1 - f) + nW[0] * f) * (wH + (wW - wH) * f), Hy + (Wy - Hy) * f + (n3[1] * (1 - f) + nW[1] * f) * (wH + (wW - wH) * f)]); }
    for (let i = 1; i <= 5; i++) { const f = i / 5; pts.push([Wx + (Ex - Wx) * f + (nW[0] * (1 - f) + nE[0] * f) * (wW + (wE - wW) * f), Wy + (Ey - Wy) * f + (nW[1] * (1 - f) + nE[1] * f) * (wW + (wE - wW) * f)]); }
    for (let i = 1; i <= 3; i++) { const f = i / 3; pts.push([Ex * (1 - f) + (nE[0] * (1 - f) + n1[0] * f) * (wE + (wS - wE) * f), Ey * (1 - f) + (nE[1] * (1 - f) + n1[1] * f) * (wE + (wS - wE) * f)]); }
    ln(path, pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], mx = (x0 + x1) / 2, my = (y0 + y1) / 2, dx = x1 - x0, dy = y1 - y0;
      qc(path, mx - dy * sc, my + dx * sc, x1, y1);
    }
    path.closePath();
    return path;
  };
  const gc = band(17, 18, 15, 12, 0.32), mc = band(11.5, 12.5, 10, 7.5, 0.3), lc = band(6, 6, 5, 3.5, 0.25);
  const alu = new Path2D();
  featherTo(alu, M, Wx, Wy, a3 - 0.4 - 0.55 * P.alula, 10 + 4 * P.alula, 5, 0.4);
  // pass 1: silhouette of the whole limb
  ctx.strokeStyle = EG.line;
  ctx.lineWidth = ow * 2;
  for (const [p] of prim) ctx.stroke(p);
  ctx.stroke(sec.path); ctx.stroke(tert.path); ctx.stroke(gc); ctx.stroke(alu);
  // pass 2: painter's order, each part filled then edged thinly so only visible edges stay
  const part = (p, fill, w = 0.55) => { ctx.fillStyle = fill; ctx.fill(p); ctx.lineWidth = ow * w; ctx.strokeStyle = col.edge; ctx.stroke(p); };
  for (const [p, q] of prim) { ctx.fillStyle = col.tip; ctx.fill(p); ctx.fillStyle = col.fl; ctx.fill(q); ctx.lineWidth = ow * 0.55; ctx.strokeStyle = col.edge; ctx.stroke(p); }
  part(sec.path, col.sec);
  // darker trailing tips on the secondaries (a band of shade, clipped to the row)
  ctx.save(); ctx.clip(sec.path);
  ctx.strokeStyle = col.secHi; ctx.lineWidth = 14; ctx.beginPath();
  for (let j = 0; j <= 8; j++) { const f = j / 8, q = M(Wx + (Ex - Wx) * f, Wy + (Ey - Wy) * f); j ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }
  ctx.stroke();
  ctx.strokeStyle = col.tip; ctx.lineWidth = 6; ctx.beginPath();
  sec.tips.forEach(([x, y], j) => { const q = M(x, y); j ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
  ctx.stroke(); ctx.restore();
  ctx.lineWidth = ow * 0.55; ctx.strokeStyle = col.edge; ctx.stroke(sec.path);
  part(tert.path, col.cov);
  // three layered covert rows (greater, median, lesser), each scalloped over the one behind and lighter
  part(gc, col.cov);
  ctx.save(); ctx.clip(gc); ctx.strokeStyle = col.covLo || EG.covLo; ctx.lineWidth = 5; ctx.globalAlpha = 0.45; ctx.stroke(mc); ctx.restore();
  part(mc, col.covHi, 0.5);
  part(lc, col.covLt, 0.4);
  // the leading edge catches the light
  ctx.save(); ctx.clip(lc);
  ctx.strokeStyle = far ? col.covHi : '#c48f52'; ctx.lineWidth = 2.6; ctx.beginPath();
  { const q0 = M(-n1[0] * 5, -n1[1] * 5 - 1), q1 = M(Ex - nE[0] * 6.5, Ey - nE[1] * 6.5), q2 = M(Wx - nW[0] * 4.5, Wy - nW[1] * 4.5); ctx.moveTo(q0[0], q0[1]); ctx.quadraticCurveTo(q1[0], q1[1], q2[0], q2[1]); }
  ctx.stroke(); ctx.restore();
  part(alu, col.cov);
}

// A wing folded against the body (perched, or tucked in a stoop): drawn as one layered leaf along the back,
// coverts in front, secondaries, then the long dark primaries crossing over the tail.
function foldedWing(ctx, sx, sy, len, far, ow, ang) {
  const c = Math.cos(ang), s = Math.sin(ang), Q = (u, v) => [sx + u * c - v * s, sy + u * s + v * c];
  const leaf = (u0, u1, v0, v1, bulge) => {
    const p = new Path2D();
    let q = Q(u0, v0); p.moveTo(q[0], q[1]);
    let a = Q((u0 + u1) / 2, v0 - bulge), b = Q(u1, (v0 + v1) / 2); p.quadraticCurveTo(a[0], a[1], b[0], b[1]);
    a = Q((u0 + u1) / 2, v1 + bulge); b = Q(u0, v1); p.quadraticCurveTo(a[0], a[1], b[0], b[1]);
    q = Q(u0 + 4, (v0 + v1) / 2); p.quadraticCurveTo(q[0], q[1], ...Q(u0, v0));
    p.closePath();
    return p;
  };
  const prim = [0, 1, 2, 3].map((i) => leaf(-len * 0.35, -len * (1.0 - i * 0.05), -1 + i * 2.2, 5 + i * 2.2, 2));
  const sec = leaf(-len * 0.15, -len * 0.7, -3, 11, 3);
  const cov = leaf(8, -len * 0.48, -6, 9, 4);
  const all = [...prim, sec, cov];
  ctx.strokeStyle = EG.line; ctx.lineWidth = ow * 2;
  for (const p of all) ctx.stroke(p);
  const edge = far ? 'rgba(24,12,4,0.6)' : 'rgba(48,26,10,0.7)';
  prim.forEach((p) => { ctx.fillStyle = far ? EG.farTip : EG.flTip; ctx.fill(p); ctx.lineWidth = ow * 0.55; ctx.strokeStyle = edge; ctx.stroke(p); });
  ctx.fillStyle = far ? EG.farFl : EG.fl; ctx.fill(sec); ctx.lineWidth = ow * 0.55; ctx.strokeStyle = edge; ctx.stroke(sec);
  ctx.fillStyle = far ? EG.far : EG.cov; ctx.fill(cov); ctx.stroke(cov);
  // scalloped covert rows
  ctx.beginPath();
  for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) {
    const u = 4 - i * len * 0.1 - r * 6, v = 2 + r * 4, a = Q(u, v), b = Q(u - len * 0.05, v + 3), d = Q(u - len * 0.1, v);
    ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(b[0], b[1], d[0], d[1]);
  }
  ctx.stroke();
}

// 3D wing frame: shoulder (x, y, z) in body units, elevation e (deg, + up). Span axis turns about the body axis.
function wingFrame(sx, sy, sz, e, side, roll, tw = 0) {
  const ee = (e + side * roll) * D2R, tt = tw * D2R;
  const S = proj(sx, sy, sz);
  const s3 = [0, -Math.sin(ee), side * Math.cos(ee)];
  // chord axis, twisted about the span (the hand turns its leading edge up on the upstroke)
  const v3 = [-Math.cos(tt), 0.06 - Math.cos(ee) * Math.sin(tt), -Math.sin(ee) * Math.sin(tt)];
  // the wing's underside normal: cupping (below) bends the trailing edge and the hand along it
  const n3 = [s3[2] * v3[1] - s3[1] * v3[2], s3[0] * v3[2] - s3[2] * v3[0], s3[1] * v3[0] - s3[0] * v3[1]];
  return { S, U: proj(...s3), V: proj(...v3), N: proj(-n3[0], -n3[1], -n3[2]) };
}

// leg: hip (hx, hy) to foot target, two-bone IK, feathered thigh, yellow tarsus, four toes with talons
function eagleLeg(ctx, hx, hy, fx, fy, toes, ow, dark) {
  const l1 = 15, l2 = 15;
  let dx = fx - hx, dy = fy - hy, d = Math.hypot(dx, dy);
  const maxd = (l1 + l2) * 0.98;
  if (d > maxd) { dx *= maxd / d; dy *= maxd / d; d = maxd; }
  if (d < 4) { dy = 4; d = 4; dx = 0; }
  const base = Math.atan2(dy, dx), k = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const a = base + k; // the joint bends backward (bird ankle)
  const kx = hx + l1 * Math.cos(a), ky = hy + l1 * Math.sin(a);
  const Fx = hx + dx, Fy = hy + dy, ta = Math.atan2(Fy - ky, Fx - kx);
  const leg = dark ? EG.legLo : EG.leg;
  ctx.lineCap = 'round';
  // tarsus
  ctx.strokeStyle = EG.line; ctx.lineWidth = 5.4 + ow * 2;
  ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(Fx, Fy); ctx.stroke();
  // toes: three forward, the hallux back; each two segments that curl as the foot clenches
  const curl = 1 - clamp(toes, 0, 1);
  const toe = (ang, len, cl) => {
    const x1 = Fx + Math.cos(ang) * len * 0.55, y1 = Fy + Math.sin(ang) * len * 0.55;
    const a2 = ang + cl, x2 = x1 + Math.cos(a2) * len * 0.45, y2 = y1 + Math.sin(a2) * len * 0.45;
    const a3 = a2 + 0.9 + cl * 0.5, x3 = x2 + Math.cos(a3) * 4.6, y3 = y2 + Math.sin(a3) * 4.6;
    return [x1, y1, x2, y2, x3, y3];
  };
  const fwd = ta - Math.PI / 2 * (0.75 + 0.25 * (1 - curl)); // toes reach forward of the tarsus
  const T = [toe(fwd - 0.55 * toes - 0.1, 10, 1.2 * curl), toe(fwd, 11, 1.25 * curl), toe(fwd + 0.5 * toes + 0.15, 9.5, 1.2 * curl), toe(ta + Math.PI * 0.62 - 0.3 * toes, 8, -1.1 * curl)];
  for (const [x1, y1, x2, y2] of T) { ctx.lineWidth = 3.4 + ow * 2; ctx.beginPath(); ctx.moveTo(Fx, Fy); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  // talons (dark hooks)
  ctx.strokeStyle = EG.talon;
  ctx.lineWidth = 2.6;
  for (let i = 0; i < 4; i++) {
    const [, , x2, y2, x3, y3] = T[i], hk = i === 3 ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.quadraticCurveTo(x2 + (x3 - x2) * 0.4 - (y3 - y2) * 0.35 * hk, y2 + (y3 - y2) * 0.4 + (x3 - x2) * 0.35 * hk, x3, y3);
    ctx.stroke();
  }
  ctx.strokeStyle = leg;
  ctx.lineWidth = 5.4;
  ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(Fx, Fy); ctx.stroke();
  ctx.lineWidth = 3.4;
  for (const [x1, y1, x2, y2] of T) { ctx.beginPath(); ctx.moveTo(Fx, Fy); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  // scale ridges on the tarsus
  ctx.strokeStyle = 'rgba(150,95,10,0.6)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let i = 1; i < 4; i++) { const f = i / 4, x = kx + (Fx - kx) * f, y = ky + (Fy - ky) * f, nx = -Math.sin(ta) * 2.4, ny = Math.cos(ta) * 2.4; ctx.moveTo(x - nx, y - ny); ctx.lineTo(x + nx * 0.6, y + ny * 0.6); }
  ctx.stroke();
  // feathered thigh ("trousers"): a soft fluffy mass over the joint with a shaggy hem
  const mx = (hx + kx) / 2 + Math.cos(a) * 2, my = (hy + ky) / 2 + Math.sin(a) * 2, c = Math.cos(a), s = Math.sin(a);
  const tp = new Path2D(), R1 = l1 * 0.62, R2 = 7.2;
  const TP = (u, v) => [mx + u * c - v * s, my + u * s + v * c];
  let q = TP(-R1, 0); tp.moveTo(q[0], q[1]);
  for (let i = 1; i <= 16; i++) {
    const th = Math.PI + (i / 16) * TAU, hem = Math.cos(th) > 0.2 ? 1 + 0.18 * (i % 2) : 1; // jagged toward the ankle
    q = TP(Math.cos(th) * R1 * hem, Math.sin(th) * R2 * (Math.cos(th) > 0 ? 1.05 : 0.9));
    tp.lineTo(q[0], q[1]);
  }
  tp.closePath();
  ctx.lineWidth = ow * 2; ctx.strokeStyle = EG.line; ctx.stroke(tp);
  ctx.fillStyle = dark ? EG.bodyDk : EG.body; ctx.fill(tp);
  ctx.save(); ctx.clip(tp); ctx.fillStyle = dark ? EG.bodyDk : EG.bodyLo;
  q = TP(R1 * 0.3, R2 * 0.6); ctx.beginPath(); ctx.ellipse(q[0], q[1], R1, R2 * 0.7, a, 0, TAU); ctx.fill(); ctx.restore();
  return { x: Fx, y: Fy };
}

// Eagle. s = body length in px (wingspan is about 2.3 s). opts: face 1|-1, turn (0..1 squash while it turns
// round), pitch (rad, + nose down), roll (-1..1 bank), w {glide, flap, hover, dive, strike, carry, dazed, perch}
// pose weights, phase (wing beat, rad), grab {x, y} foot target in px from the centre (y down, screen space),
// toes (0..1, overrides the pose), eye (0..1 blink), stars (0..1 dazed stars), t time.
export function drawEagle(ctx, cx, cy, s, t = 0, opts = {}) {
  if (!(s > 0)) return;
  safe(ctx, () => {
    opts = opts || {};
    const face = opts.face === -1 ? -1 : 1, k = s / 100;
    const P = blendPose(opts.w || { glide: 1 }, { phase: opts.phase || 0 }, t);
    if (opts.toes != null) P.toes = clamp(opts.toes, 0, 1);
    if (opts.beak != null) P.beak = Math.max(P.beak, opts.beak);
    const pitch = (opts.pitch || 0) + P.pitch * D2R, bank = clamp(opts.roll || 0, -1, 1), roll = bank * 30;
    P.eF -= Math.abs(bank) * 34; P.eN -= Math.abs(bank) * 14;
    const ow = clamp(s * 0.021, 1.15, 3.4) / k; // outline in body units: about 1.2..3.4 px whatever the size
    ctx.translate(cx, cy);
    ctx.scale(face * k * (1 - 0.5 * clamp(opts.turn || 0, 0, 1)), k);
    ctx.rotate(pitch);
    ctx.translate(0, P.bob);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // foot target: from screen px (relative to centre) into body units
    let fx = P.fx, fy = P.fy;
    if (opts.grab) {
      const gx = opts.grab.x * face / k, gy = opts.grab.y / k, c = Math.cos(-pitch), sn = Math.sin(-pitch);
      fx = gx * c - gy * sn; fy = gx * sn + gy * c - P.bob;
    }

    // far wing (behind everything), shoulder a little higher and further back
    const folded = (P.fold || 0) > 0.55; // tucked wings are drawn as folded leaves along the back
    const fW = wingFrame(4, -10, -6, P.eF, -1, 0, P.tw);
    if (folded) foldedWing(ctx, 6, -13, 62, true, ow, -0.06 + (P.eF - 20) * 0.004);
    else eagleWing(ctx, P, fW.S, fW.U, fW.V, fW.N, true, ow, t);

    // tail: seven white feathers fanned in the tail plane; a bank tilts the fan toward or away from us
    const tailA = (180 + P.lift) * D2R, rr = roll * D2R;
    const tails = [];
    for (let i = 0; i < 7; i++) {
      const f = (i - 3) / 3, fa = f * (0.08 + 0.42 * P.fan);
      const dx = Math.cos(tailA) * Math.cos(fa), dy = Math.sin(tailA) * Math.cos(fa) + Math.sin(fa) * Math.sin(rr) * 0.9, dz = Math.sin(fa) * Math.cos(rr);
      const [x2, y2] = proj(dx, dy, dz), l = Math.hypot(x2, y2) || 1;
      tails.push([x2 / l, y2 / l, 29 + 3 * (1 - Math.abs(f)) * P.fan, i]);
    }
    tails.sort((a, b) => Math.abs(b[3] - 3) - Math.abs(a[3] - 3)); // outer feathers first, middle on top
    // each tail feather: squared-off tip with a small notch where the vane splits, and a shaft
    const tailF = (ux, uy, L, W) => {
      const c = ux, sn = uy, Q = (u, v) => [-22 + u * c - v * sn, -1 + u * sn + v * c], p = new Path2D();
      const pts = [[0, -W * 0.42], [L * 0.62, -W * 0.56], [L * 0.97, -W * 0.48], [L * 1.01, -W * 0.16], [L * 0.9, 0], [L * 1.01, W * 0.16], [L * 0.97, W * 0.48], [L * 0.62, W * 0.56], [0, W * 0.42]];
      let q = Q(...pts[0]); p.moveTo(q[0], q[1]);
      q = Q(...pts[1]); const q2 = Q(...pts[2]); p.quadraticCurveTo(q[0], q[1], q2[0], q2[1]);
      for (let i = 3; i <= 5; i++) { q = Q(...pts[i]); p.lineTo(q[0], q[1]); }
      q = Q(...pts[6]); p.lineTo(q[0], q[1]); q = Q(...pts[7]); const q3 = Q(...pts[8]); p.quadraticCurveTo(q[0], q[1], q3[0], q3[1]);
      p.closePath();
      return { p, a: Q(L * 0.15, 0), b: Q(L * 0.86, 0) };
    };
    const tp = tails.map(([ux, uy, L]) => tailF(ux, uy, L, 9.5));
    ctx.strokeStyle = EG.line; ctx.lineWidth = ow * 2;
    for (const { p } of tp) ctx.stroke(p);
    tp.forEach(({ p, a, b }, i) => {
      ctx.fillStyle = i === tp.length - 1 ? EG.white : EG.whiteLo; ctx.fill(p);
      ctx.lineWidth = ow * 0.45; ctx.strokeStyle = 'rgba(110,92,70,0.55)'; ctx.stroke(p);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineWidth = ow * 0.35; ctx.strokeStyle = 'rgba(150,130,104,0.6)'; ctx.stroke();
    });

    // far leg (behind the body)
    const tuck = clamp((fy - 16) / 14, 0, 1); // 0 tucked up under the tail .. 1 reaching out
    if (tuck > 0.15) eagleLeg(ctx, 1, 7, fx + 3, fy - 1.5, P.toes, ow, true);

    // torso
    const body = new Path2D();
    body.moveTo(22, -15);
    body.bezierCurveTo(10, -16, -6, -14.5, -17, -8.5);
    body.bezierCurveTo(-23, -5, -27, -3, -28, 0);
    body.bezierCurveTo(-27, 4, -22, 8, -15, 11);
    body.bezierCurveTo(-6, 15, 6, 16, 14, 12.5);
    body.bezierCurveTo(22, 9, 27, 2, 27, -5);
    body.bezierCurveTo(27, -10, 25, -14, 22, -15);
    body.closePath();
    // head (white) + beak, turned about the neck
    const hr = P.head * D2R, nx = 23 + P.neck, ny = -9;
    const head = new Path2D();
    const H = (x, y) => { const c = Math.cos(hr), sn = Math.sin(hr), X = x - 23, Y = y + 9; return [nx + X * c - Y * sn, ny + X * sn + Y * c]; };
    const hm = (x, y) => { const q = H(x, y); head.moveTo(q[0], q[1]); };
    const hb = (a, b, c, d, e, f) => { const q1 = H(a, b), q2 = H(c, d), q3 = H(e, f); head.bezierCurveTo(q1[0], q1[1], q2[0], q2[1], q3[0], q3[1]); };
    const hl = (a, b) => { const q = H(a, b); head.lineTo(q[0], q[1]); };
    hm(15, -14);
    hb(17, -23, 27, -27, 35, -25.5);
    hb(40, -24.5, 44, -21, 44.5, -16.5);
    hb(45, -12, 43, -8, 40, -6.5);
    hb(36, -4.5, 31, -3, 28, -1);
    // ragged collar where the white neck meets the brown body
    hl(26, 2); hl(24, -1.5); hl(21.5, 2.5); hl(19.5, -2.5); hl(17, 1); hl(16, -4); hl(13.5, -2.5); hl(14, -8);
    head.closePath();
    ctx.strokeStyle = EG.line; ctx.lineWidth = ow * 2;
    ctx.stroke(body);
    ctx.stroke(head);
    // body fill + cel shading (lit back, shadowed belly) and breast scallops
    ctx.fillStyle = EG.body; ctx.fill(body);
    ctx.save();
    ctx.clip(body);
    ctx.fillStyle = EG.bodyLo;
    ctx.beginPath(); ctx.ellipse(-2, 17, 30, 10, -0.08, 0, TAU); ctx.fill();
    ctx.fillStyle = EG.bodyHi;
    ctx.beginPath(); ctx.ellipse(2, -17.5, 26, 6.5, -0.05, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(60,34,14,0.55)'; ctx.lineWidth = ow * 0.6;
    ctx.beginPath();
    for (const [x, y] of [[19, 3], [13, 7], [7, 10], [0, 11], [15, -2], [9, 3], [2, 6], [-6, 7], [-12, 5], [-5, 1]]) { ctx.moveTo(x - 3, y - 1); ctx.quadraticCurveTo(x, y + 2.6, x + 3, y - 1); }
    ctx.stroke();
    ctx.restore();
    // upper tail coverts: brown feathers laid over the root of the white tail
    for (let i = 0; i < 3; i++) {
      const p = new Path2D(), ta = tailA + (i - 1) * 0.16 * (0.4 + P.fan);
      featherTo(p, (a, b) => [a, b], -14 - i * 1.5, -4 + i * 2.5, ta, 18 - i * 2, 8, 0.5);
      ctx.lineWidth = ow * 1.6; ctx.strokeStyle = EG.line; ctx.stroke(p);
      ctx.fillStyle = i === 1 ? EG.bodyHi : EG.body; ctx.fill(p);
    }
    ctx.fillStyle = EG.white; ctx.fill(head);
    ctx.save();
    ctx.clip(head);
    ctx.fillStyle = EG.whiteLo;
    const q0 = H(30, 4);
    ctx.beginPath(); ctx.ellipse(q0[0], q0[1], 17, 10, hr - 0.25, 0, TAU); ctx.fill();
    ctx.restore();

    // near leg (in front of the body); tucked legs vanish into the belly feathers
    if (tuck > 0.15) eagleLeg(ctx, -3, 8, fx, fy, P.toes, ow, false);
    // with the legs tucked the belly feathers cover the thighs
    if (tuck < 0.6) {
      ctx.save();
      ctx.globalAlpha = 1 - tuck / 0.6;
      const bl = new Path2D();
      bl.moveTo(-18, 6); bl.bezierCurveTo(-12, 13, 2, 16, 10, 12); bl.bezierCurveTo(4, 10, -6, 9, -18, 6); bl.closePath();
      ctx.fillStyle = EG.bodyLo; ctx.fill(bl);
      ctx.restore();
    }

    // beak: hooked upper mandible, lower mandible drops open
    const bo = clamp(P.beak, 0, 1) * 0.55;
    const lower = new Path2D(), upper = new Path2D(), mouth = new Path2D();
    const L = (x, y) => { const c = Math.cos(bo), sn = Math.sin(bo), X = x - 41, Y = y + 13; return H(41 + X * c - Y * sn, -13 + X * sn + Y * c); };
    const pth = (path, f, pts) => { let q = f(pts[0][0], pts[0][1]); path.moveTo(q[0], q[1]); for (let i = 1; i < pts.length; i += 2) { const a = f(pts[i][0], pts[i][1]), b = f(pts[i + 1][0], pts[i + 1][1]); path.quadraticCurveTo(a[0], a[1], b[0], b[1]); } path.closePath(); };
    for (const [f, x, y] of [[H, 41, -13], [H, 50, -12.2], [L, 50, -11], [L, 41.5, -9.5]]) { const q = f(x, y); mouth.lineTo(q[0], q[1]); }
    mouth.closePath();
    pth(lower, L, [[41, -12.5], [46, -11.8], [50, -11], [47, -8], [43, -8.6], [41.5, -9.5], [41, -12.5]]);
    pth(upper, H, [[40, -21.5], [48, -22], [53.5, -17], [56, -12], [54, -8.5], [53, -11.5], [50, -12.2], [45, -12.8], [40.5, -12.5]]);
    ctx.strokeStyle = EG.line; ctx.lineWidth = ow * 2;
    if (bo > 0.05) { ctx.fillStyle = EG.mouth; ctx.fill(mouth); }
    ctx.stroke(lower); ctx.fillStyle = EG.beakLo; ctx.fill(lower);
    ctx.stroke(upper); ctx.fillStyle = EG.beak; ctx.fill(upper);
    ctx.save(); ctx.clip(upper);
    const qh = H(46, -21); ctx.fillStyle = EG.beakHi; ctx.beginPath(); ctx.ellipse(qh[0], qh[1], 6, 2.4, hr + 0.15, 0, TAU); ctx.fill();
    const ql = H(50, -12); ctx.fillStyle = EG.beakLo; ctx.beginPath(); ctx.ellipse(ql[0], ql[1], 8, 2.6, hr + 0.3, 0, TAU); ctx.fill();
    ctx.restore();
    // cere line + nostril
    ctx.lineWidth = ow * 0.7; ctx.strokeStyle = EG.beakLo;
    let a0 = H(43.2, -21.4), a1 = H(42.6, -13.2);
    ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.lineTo(a1[0], a1[1]); ctx.stroke();
    a0 = H(45.8, -17.6); ctx.fillStyle = EG.line; ctx.beginPath(); ctx.arc(a0[0], a0[1], 0.9, 0, TAU); ctx.fill();

    // eye under a heavy brow: squints to a slit when it locks on, goes wide and empty when dazed
    const ec = H(35.5, -17.5), blink = clamp(opts.eye == null ? 1 : opts.eye, 0, 1);
    const wide = clamp(P.wide, 0, 1), sq = clamp(P.squint, 0, 1) * (1 - wide);
    const er = 3.5 + wide * 0.9, open = blink * (1 - 0.55 * sq);
    ctx.save();
    ctx.translate(ec[0], ec[1]);
    ctx.rotate(hr);
    const eye = new Path2D();
    eye.ellipse(0, 0, er * 1.1, er, 0, 0, TAU);
    ctx.save();
    ctx.clip(eye);
    ctx.fillStyle = EG.iris; ctx.fill(eye);
    ctx.fillStyle = EG.pupil;
    ctx.beginPath(); ctx.arc(0.9 + sq * 0.5, 0.2, er * (wide ? 0.32 : 0.56), 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-0.4, -1.3, er * 0.24, 0, TAU); ctx.fill();
    // lids close from the top (blink, squint)
    ctx.fillStyle = EG.white;
    ctx.fillRect(-er * 1.4, -er * 1.2, er * 2.8, er * 2.2 * (1 - open) + 0.01);
    ctx.restore();
    ctx.lineWidth = ow * 0.9; ctx.strokeStyle = EG.line; ctx.stroke(eye);
    if (open < 0.98) { const ly = -er + 2 * er * (1 - open); ctx.beginPath(); ctx.moveTo(-er * 1.1, ly); ctx.lineTo(er * 1.1, ly + 0.3); ctx.stroke(); }
    if (wide > 0.5) { // dazed: a swirl in the eye
      ctx.lineWidth = ow * 0.6; ctx.strokeStyle = EG.pupil; ctx.beginPath();
      for (let i = 0; i < 14; i++) { const a = i * 0.7 + t * 9, rr2 = 0.4 + i * 0.17; i ? ctx.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2) : ctx.moveTo(Math.cos(a) * rr2, Math.sin(a) * rr2); }
      ctx.stroke();
    }
    // brow ridge: a white shelf with a dark underside, lower and steeper as it squints
    const bt = -er - 0.8 + sq * 1.6 - wide * 1.8;
    const brow = new Path2D();
    brow.moveTo(-er * 1.9, bt - 2.2 - wide);
    brow.quadraticCurveTo(0, bt - 3.8 - wide, er * 1.9, bt + 0.6 + sq * 1.6);
    brow.lineTo(er * 1.5, bt + 2.0 + sq * 1.8);
    brow.quadraticCurveTo(0, bt - 0.8, -er * 1.6, bt - 0.2);
    brow.closePath();
    ctx.fillStyle = EG.white; ctx.fill(brow);
    ctx.lineWidth = ow * 1.15; ctx.strokeStyle = EG.line;
    ctx.beginPath(); ctx.moveTo(-er * 1.55, bt - 0.2); ctx.quadraticCurveTo(0, bt - 0.8, er * 1.5, bt + 2.0 + sq * 1.8); ctx.stroke();
    ctx.restore();

    // near wing: in front of the body; its root disappears under the scapular feathers
    const nW = wingFrame(5, -8, 6, P.eN, 1, 0, P.tw);
    if (folded) foldedWing(ctx, 9, -6, 66, false, ow, 0.05 + (P.eN - 20) * 0.003);
    else eagleWing(ctx, P, nW.S, nW.U, nW.V, nW.N, false, ow, t);
    // scapulars: a patch of body feathers laid over the wing root, so wing and body are one surface
    const sx = nW.S[0], sy = nW.S[1];
    const sc = new Path2D();
    sc.moveTo(sx + 11, sy - 6.5);
    sc.bezierCurveTo(sx + 4, sy - 9, sx - 10, sy - 8, sx - 17, sy - 3);
    sc.quadraticCurveTo(sx - 13, sy + 1.5, sx - 9, sy + 1);
    sc.quadraticCurveTo(sx - 6, sy + 5, sx - 1.5, sy + 3);
    sc.quadraticCurveTo(sx + 2, sy + 6.5, sx + 6, sy + 3.5);
    sc.quadraticCurveTo(sx + 11, sy + 4, sx + 12, sy - 1);
    sc.closePath();
    ctx.fillStyle = EG.body; ctx.fill(sc);
    ctx.save(); ctx.clip(sc); ctx.fillStyle = EG.bodyHi; ctx.beginPath(); ctx.ellipse(sx - 2, sy - 8, 16, 5, 0, 0, TAU); ctx.fill(); ctx.restore();
    ctx.lineWidth = ow * 0.6; ctx.strokeStyle = 'rgba(60,34,14,0.6)';
    ctx.beginPath();
    ctx.moveTo(sx - 17, sy - 3); ctx.quadraticCurveTo(sx - 13, sy + 1.5, sx - 9, sy + 1); ctx.quadraticCurveTo(sx - 6, sy + 5, sx - 1.5, sy + 3); ctx.quadraticCurveTo(sx + 2, sy + 6.5, sx + 6, sy + 3.5); ctx.quadraticCurveTo(sx + 11, sy + 4, sx + 12, sy - 1);
    ctx.stroke();

    // dazed: stars circling the head
    const st = clamp(opts.stars || 0, 0, 1);
    if (st > 0.02) {
      const hc = H(32, -30);
      for (let i = 0; i < 3; i++) {
        const a = t * 4 + (i * TAU) / 3, x = hc[0] + Math.cos(a) * 13, y = hc[1] + Math.sin(a) * 4.5, r = (3.4 + Math.sin(a) * 0.8) * st;
        ctx.beginPath();
        for (let j = 0; j < 10; j++) { const b = (j * Math.PI) / 5 - Math.PI / 2, rr2 = j % 2 ? r * 0.45 : r; j ? ctx.lineTo(x + Math.cos(b) * rr2, y + Math.sin(b) * rr2) : ctx.moveTo(x + Math.cos(b) * rr2, y + Math.sin(b) * rr2); }
        ctx.closePath();
        ctx.fillStyle = '#ffd94a'; ctx.fill();
        ctx.lineWidth = ow * 0.8; ctx.strokeStyle = EG.line; ctx.stroke();
      }
    }
  });
}

// The eagle's shadow on the vault, seen from straight above: wings spread across `ang`. lock 0..1 = soft and
// faint (high up) .. sharp and dark (locked on). span in px.
export function drawEagleShadow(ctx, cx, cy, span, ang, lock = 1, t = 0) {
  if (!(span > 0)) return;
  safe(ctx, () => {
    lock = clamp(lock, 0, 1);
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    const shape = (sc) => {
      const w = span / 2 * sc, flap = 0.06 * Math.sin(t * 6);
      ctx.beginPath();
      ctx.moveTo(w * 0.2, -w * 0.06); // head
      ctx.quadraticCurveTo(w * 0.3, 0, w * 0.2, w * 0.06);
      ctx.lineTo(w * 0.07, w * 0.08);
      // near wing out to fingered tips
      ctx.bezierCurveTo(w * 0.12, w * 0.4, w * 0.12, w * (0.75 + flap), w * 0.02, w * 1.0);
      for (let i = 0; i < 4; i++) { const y = w * (1.0 - i * 0.07), x = -w * (0.02 + i * 0.07); ctx.lineTo(x, y + w * 0.05); ctx.lineTo(x - w * 0.03, y - w * 0.02); }
      ctx.bezierCurveTo(-w * 0.2, w * 0.55, -w * 0.18, w * 0.3, -w * 0.14, w * 0.1);
      // tail fan
      ctx.lineTo(-w * 0.42, w * 0.13);
      ctx.quadraticCurveTo(-w * 0.47, 0, -w * 0.42, -w * 0.13);
      ctx.lineTo(-w * 0.14, -w * 0.1);
      // far wing
      ctx.bezierCurveTo(-w * 0.18, -w * 0.3, -w * 0.2, -w * 0.55, -w * 0.23, -w * 0.76);
      for (let i = 3; i >= 0; i--) { const y = -w * (1.0 - i * 0.07), x = -w * (0.02 + i * 0.07); ctx.lineTo(x - w * 0.03, y + w * 0.02); ctx.lineTo(x, y - w * 0.05); }
      ctx.bezierCurveTo(w * 0.12, -w * (0.75 + flap), w * 0.12, -w * 0.4, w * 0.07, -w * 0.08);
      ctx.closePath();
    };
    // a soft shadow is three stacked, slightly larger copies; locking on pulls them together
    const blur = 1 - lock, a = 0.1 + 0.32 * lock;
    for (let i = 2; i >= 0; i--) {
      shape(1 + blur * 0.35 + i * (0.05 + 0.12 * blur));
      ctx.fillStyle = `rgba(16,8,2,${(a * (i ? 0.38 : 0.7)).toFixed(3)})`;
      ctx.fill();
    }
  });
}

/* ---------------------------------------------------------------- BARRIER */

// Wooden barrier standing across a channel. Local box: x in [-w/2, w/2], y in [-h, 0] (base at cy).
// melt 0..1 = venom eating it (green drips, sagging); burn 0..1 = fire eating it.
export function drawBarrier(ctx, cx, cy, w, h, t = 0, melt = 0, burn = 0) {
  if (!(w > 0 && h > 0)) return;
  safe(ctx, () => {
    melt = clamp(melt || 0, 0, 1);
    burn = clamp(burn || 0, 0, 1);
    ctx.translate(cx, cy);
    const eat = Math.max(melt, burn);
    const hv = h * (1 - 0.92 * eat); // what is left standing
    const o = lw(1.3, w * 0.05);
    // jagged top edge where it is eaten
    const edgeY = (x) => -hv + (eat > 0 ? Math.sin(x * 0.9 + t) * 1.3 + (hash(Math.round(x * 1.7)) - 0.5) * Math.min(6, h * 0.08) * (melt > burn ? 1 : 1.6) : 0);
    // contact shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 1.5, w * 0.62, Math.max(2, w * 0.12), 0, 0, TAU);
    ctx.fill();
    const steps = 10;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-w / 2 - 1, 0);
    for (let i = 0; i <= steps; i++) { const x = -w / 2 + (w * i) / steps; ctx.lineTo(x, Math.min(0, edgeY(x))); }
    ctx.lineTo(w / 2 + 1, 0);
    ctx.closePath();
    ctx.clip();
    // horizontal planks stacked up the wall
    const ph = clamp(w * 0.62, 7, Math.max(8, h / 3));
    const n = Math.max(2, Math.round(h / ph));
    const pH = h / n;
    for (let i = 0; i < n; i++) {
      const y1 = -i * pH, y0 = y1 - pH;
      const v = hash(i * 3.7 + 1);
      const base = [[182, 125, 72], [166, 110, 62], [194, 140, 84], [158, 104, 58]][i % 4];
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, `rgb(${base[0] + 26},${base[1] + 24},${base[2] + 20})`);
      g.addColorStop(0.5, `rgb(${base[0]},${base[1]},${base[2]})`);
      g.addColorStop(1, `rgb(${base[0] - 48},${base[1] - 40},${base[2] - 30})`);
      ctx.fillStyle = g;
      ctx.fillRect(-w / 2, y0 + 0.4, w, pH - 0.4);
      // grain
      ctx.strokeStyle = 'rgba(90,52,24,0.45)';
      ctx.lineWidth = Math.max(0.7, o * 0.6);
      ctx.beginPath();
      for (let k = 0; k < 2; k++) {
        const gy = y0 + pH * (0.3 + 0.4 * k) + v * 1.2;
        ctx.moveTo(-w / 2 + w * 0.05, gy);
        ctx.quadraticCurveTo(0, gy + (k ? 1.4 : -1.4), w / 2 - w * 0.05, gy + 0.6);
      }
      ctx.stroke();
      // knot
      if (v > 0.45) {
        ctx.beginPath();
        ctx.ellipse(-w * 0.12 + v * w * 0.2, y0 + pH * 0.5, Math.max(1, w * 0.07), Math.max(0.8, pH * 0.16), 0, 0, TAU);
        ctx.fillStyle = 'rgba(90,52,24,0.6)';
        ctx.fill();
      }
      // top light line and dark seam
      ctx.fillStyle = 'rgba(255,235,190,0.45)';
      ctx.fillRect(-w / 2, y0 + 0.4, w, Math.max(0.8, o * 0.7));
      ctx.fillStyle = 'rgba(40,20,8,0.7)';
      ctx.fillRect(-w / 2, y1 - Math.max(0.8, o * 0.8), w, Math.max(0.8, o * 0.8));
    }
    // vertical posts hugging the sides with nails
    ctx.fillStyle = 'rgba(70,40,18,0.5)';
    const pw = Math.max(1.5, w * 0.17);
    ctx.fillRect(-w / 2, -h, pw, h);
    ctx.fillRect(w / 2 - pw, -h, pw, h);
    ctx.fillStyle = '#4a4a50';
    for (let i = 0; i < n; i++) for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * (w / 2 - pw * 0.5), -i * pH - pH / 2, Math.max(0.8, w * 0.045), 0, TAU); ctx.fill(); }
    // char
    if (burn > 0) {
      ctx.fillStyle = `rgba(14,8,6,${0.78 * burn})`;
      ctx.fillRect(-w / 2, -h, w, h);
      ctx.strokeStyle = `rgba(255,120,30,${0.7 * burn * (1 - burn * 0.5)})`;
      ctx.lineWidth = Math.max(0.8, o * 0.8);
      ctx.beginPath();
      for (let i = 0; i < 4; i++) { const yy = -h * (0.15 + i * 0.22); ctx.moveTo(-w / 2, yy); ctx.lineTo(-w * 0.1, yy - 3); ctx.lineTo(w * 0.15, yy + 2); ctx.lineTo(w / 2, yy - 2); }
      ctx.stroke();
    }
    // venom soaking down from the top
    if (melt > 0) {
      const vg = ctx.createLinearGradient(0, -hv, 0, -hv + Math.max(10, hv * 0.8));
      vg.addColorStop(0, 'rgba(140,240,60,0.85)');
      vg.addColorStop(1, 'rgba(110,210,50,0)');
      ctx.fillStyle = vg;
      ctx.fillRect(-w / 2, -hv - 4, w, Math.max(10, hv * 0.8) + 4);
    }
    ctx.restore();
    // outline of what remains
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    for (let i = 0; i <= steps; i++) { const x = -w / 2 + (w * i) / steps; ctx.lineTo(x, Math.min(0, edgeY(x))); }
    ctx.lineTo(w / 2, 0);
    ctx.lineWidth = o * 1.3;
    ctx.strokeStyle = melt > 0 && melt >= burn ? '#2d6a14' : '#3d2210';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(-w / 2, -hv);
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, -hv);
    ctx.lineWidth = o * 1.3;
    ctx.strokeStyle = '#3d2210';
    ctx.stroke();
    // venom: slime gobs along the cut edge, drips and bubbles
    if (melt > 0) {
      for (let i = 0; i < 4; i++) {
        const x = -w / 2 + w * (0.12 + i * 0.25) + Math.sin(t * 1.2 + i) * w * 0.04;
        const y = Math.min(0, edgeY(x));
        const r = Math.max(1.4, w * 0.11) * (0.8 + 0.4 * hash(i + 5));
        ctx.beginPath();
        ctx.ellipse(x, y, r * 1.2, r, 0, 0, TAU);
        ctx.fillStyle = '#7bea38';
        ctx.fill();
        ctx.lineWidth = o * 0.8;
        ctx.strokeStyle = '#2d6a14';
        ctx.stroke();
        const k = mod(t * 0.7 + i * 0.27, 1), dl = (6 + hash(i) * 10) * k * Math.min(1, hv / 8 + 0.3);
        ctx.beginPath();
        ctx.moveTo(x - r * 0.5, y);
        ctx.lineTo(x - r * 0.3, y + dl);
        ctx.arc(x, y + dl, r * 0.45, Math.PI, 0, true);
        ctx.lineTo(x + r * 0.5, y);
        ctx.fillStyle = `rgba(123,234,56,${1 - k * 0.5})`;
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(210,255,170,0.85)';
      for (let i = 0; i < 3; i++) {
        const k = mod(t * 0.9 + i / 3, 1);
        ctx.globalAlpha = Math.sin(k * Math.PI);
        ctx.beginPath();
        ctx.arc((hash(i + 9) - 0.5) * w, -hv - k * h * 0.15, Math.max(0.9, w * 0.05), 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // flames licking the burning edge
    if (burn > 0 && burn < 1) {
      for (let i = 0; i < 4; i++) {
        const x = -w / 2 + w * (0.15 + i * 0.23), y = Math.min(0, edgeY(x)) + 1, fh = (5 + hash(i + 2) * 6) * (0.8 + 0.4 * Math.sin(t * 12 + i * 2)) * (1 - burn * 0.4) + h * 0.05;
        const fw = Math.max(2, w * 0.14);
        for (const [sc, col] of [[1, '#ff5a1a'], [0.65, '#ffb42a'], [0.3, '#fff2a0']]) {
          ctx.beginPath();
          ctx.moveTo(x - fw * sc, y);
          ctx.quadraticCurveTo(x - fw * sc * 0.9, y - fh * sc * 0.5, x + Math.sin(t * 9 + i) * fw * 0.4, y - fh * sc);
          ctx.quadraticCurveTo(x + fw * sc * 0.9, y - fh * sc * 0.5, x + fw * sc, y);
          ctx.closePath();
          ctx.fillStyle = col;
          ctx.fill();
        }
      }
    }
  });
}

/* --------------------------------------------------------------- LAVA ROCK */

const ROCK_SHAPE = [1, 0.86, 1.04, 0.9, 0.98, 0.84, 1.02, 0.92, 1.05, 0.88];

// Glowing lava rock (volcano). r = radius. heat 0..1 (cools to dark crust).
export function drawLavaRock(ctx, cx, cy, r, t = 0, heat = 1) {
  if (!(r > 0)) return;
  safe(ctx, () => {
    heat = clamp(heat == null ? 1 : heat, 0, 1);
    ctx.translate(cx, cy);
    const pulse = 0.85 + 0.15 * Math.sin(t * 5);
    // heat halo
    if (heat > 0.05) {
      const g = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * (1.9 + 0.2 * pulse));
      g.addColorStop(0, `rgba(255,120,30,${0.55 * heat})`);
      g.addColorStop(1, 'rgba(255,90,10,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r * 2.1, 0, TAU);
      ctx.fill();
    }
    const o = lw(1.4, r * 0.09);
    ctx.save();
    ctx.rotate(t * 1.3);
    const rock = () => {
      ctx.beginPath();
      const n = ROCK_SHAPE.length;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU, a2 = ((i + 0.5) / n) * TAU;
        const rr = r * ROCK_SHAPE[i], rm = r * (ROCK_SHAPE[(i + 1) % n] + ROCK_SHAPE[i]) * 0.5 * 1.02;
        const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        ctx.lineTo(Math.cos(a2) * rm, Math.sin(a2) * rm);
      }
      ctx.closePath();
    };
    rock();
    // crust
    const cg = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.1);
    cg.addColorStop(0, heat > 0.3 ? '#6a4a40' : '#5e5652');
    cg.addColorStop(0.6, '#352826');
    cg.addColorStop(1, '#170d0d');
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.save();
    ctx.clip();
    // molten glow under the crust
    const hot = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    hot.addColorStop(0, `rgba(255,214,90,${0.9 * heat * pulse})`);
    hot.addColorStop(0.5, `rgba(255,98,20,${0.55 * heat})`);
    hot.addColorStop(1, 'rgba(120,20,0,0)');
    ctx.fillStyle = hot;
    ctx.fillRect(-r, -r, 2 * r, 2 * r);
    // glowing cracks
    const lava = heat > 0.5 ? `rgb(255,${Math.round(150 + 90 * (heat - 0.5))},40)` : `rgb(${Math.round(110 + 290 * heat)},${Math.round(40 + 160 * heat)},24)`;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const cracks = [[[-0.9, -0.1], [-0.5, 0.05], [-0.2, -0.15], [0.15, 0.05], [0.55, -0.25], [0.95, -0.1]], [[-0.1, -0.95], [0.0, -0.55], [-0.2, -0.2], [0.05, 0.2], [0.3, 0.6], [0.25, 0.95]], [[0.15, 0.05], [0.5, 0.35], [0.85, 0.5]], [[-0.2, -0.15], [-0.5, -0.5], [-0.75, -0.6]]];
    for (const pass of [0, 1]) {
      ctx.strokeStyle = pass ? lava : `rgba(255,70,10,${0.45 * heat})`;
      ctx.lineWidth = r * (pass ? 0.1 : 0.22) * (0.6 + 0.4 * heat);
      ctx.beginPath();
      for (const c of cracks) c.forEach(([x, y], i) => (i ? ctx.lineTo(x * r, y * r) : ctx.moveTo(x * r, y * r)));
      ctx.stroke();
    }
    ctx.restore();
    rock();
    ctx.lineWidth = o * 1.4;
    ctx.strokeStyle = '#120808';
    ctx.stroke();
    ctx.restore();
    // glossy facet highlight (does not spin)
    ctx.fillStyle = `rgba(255,220,200,${0.2 + 0.1 * (1 - heat)})`;
    ctx.beginPath();
    ctx.ellipse(-r * 0.38, -r * 0.42, r * 0.28, r * 0.13, -0.7, 0, TAU);
    ctx.fill();
    // flying sparks
    if (heat > 0.2) {
      ctx.fillStyle = '#ffd36a';
      for (let i = 0; i < 4; i++) {
        const k = mod(t * 1.5 + i / 4, 1), a = hash(i + 3) * TAU;
        ctx.globalAlpha = (1 - k) * heat;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * (1 + k * 0.9), Math.sin(a) * r * (1 + k * 0.9) - k * r * 0.5, Math.max(0.8, r * 0.07 * (1 - k)), 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  });
}

/* --------------------------------------------------------------- MELT HOLE */

// Molten patch on a ring where a lava rock melted it (a temporary hole). len = arc length in px, th = ring thickness px.
export function drawMeltHole(ctx, cx, cy, len, th, t = 0, life = 1, venom = false) { // venom: a spitter's green burn
  if (!(len > 0 && th > 0)) return;
  safe(ctx, () => {
    life = clamp(life == null ? 1 : life, 0, 1);
    ctx.translate(cx, cy);
    const hl = len / 2, ht = th / 2 * 1.08;
    const cool = 1 - life; // solidifying
    const jag = (x, s) => ht * (1 + 0.16 * Math.sin(x * 0.7 + s) + (hash(Math.round(x * 0.6) + s) - 0.5) * 0.3);
    const env = (x) => Math.sqrt(Math.max(0, 1 - (x / (hl + 0.001)) ** 2) * 0.6 + 0.4);
    const outline = (k) => {
      ctx.beginPath();
      const n = Math.max(6, Math.round(len / 3));
      for (let i = 0; i <= n; i++) { const x = -hl * k + (2 * hl * k * i) / n; const y = -jag(x, 1) * k * env(x); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      for (let i = n; i >= 0; i--) { const x = -hl * k + (2 * hl * k * i) / n; ctx.lineTo(x, jag(x, 5) * k * env(x)); }
      ctx.closePath();
    };
    // scorched rim, then the glowing melt
    outline(1.28);
    ctx.fillStyle = `rgba(20,10,8,${0.75 * (0.4 + 0.6 * life)})`;
    ctx.fill();
    outline(1.06);
    ctx.fillStyle = venom ? `rgba(20,60,10,${0.9 * (0.5 + 0.5 * life)})` : `rgba(80,20,8,${0.9 * (0.5 + 0.5 * life)})`;
    ctx.fill();
    ctx.save();
    outline(1);
    ctx.clip();
    const g = ctx.createLinearGradient(0, -ht, 0, ht);
    const glow = life;
    if (venom) {
      g.addColorStop(0, `rgba(${Math.round(60 + 60 * glow)},200,40,${0.5 + 0.5 * glow})`);
      g.addColorStop(0.5, `rgba(${Math.round(150 + 60 * glow)},250,${Math.round(70 * glow)},${0.35 + 0.65 * glow})`);
      g.addColorStop(1, `rgba(40,${Math.round(130 + 40 * glow)},20,${0.5 + 0.5 * glow})`);
    } else {
      g.addColorStop(0, `rgba(255,${Math.round(90 + 80 * glow)},20,${0.5 + 0.5 * glow})`);
      g.addColorStop(0.5, `rgba(255,${Math.round(180 + 60 * glow)},${Math.round(60 * glow)},${0.35 + 0.65 * glow})`);
      g.addColorStop(1, `rgba(220,${Math.round(60 + 40 * glow)},10,${0.5 + 0.5 * glow})`);
    }
    ctx.fillStyle = g;
    ctx.fillRect(-hl * 1.3, -ht * 1.4, len * 1.3, ht * 3);
    // crust forming as it cools
    if (cool > 0.05) {
      ctx.fillStyle = `rgba(40,22,18,${cool * 0.8})`;
      for (let i = 0; i < 5; i++) { const x = -hl + len * (i + 0.5) / 5; ctx.beginPath(); ctx.ellipse(x, (hash(i + 8) - 0.5) * th * 0.4, len / 11, ht * 0.5, hash(i) * 2, 0, TAU); ctx.fill(); }
    }
    // flowing bright streaks
    ctx.strokeStyle = venom ? `rgba(230,255,160,${0.7 * glow})` : `rgba(255,240,150,${0.7 * glow})`;
    ctx.lineWidth = Math.max(1, th * 0.12);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const y = (i - 1) * ht * 0.45, off = Math.sin(t * 2 + i * 2) * len * 0.08;
      ctx.moveTo(-hl * 0.5 + off, y);
      ctx.quadraticCurveTo(0, y + Math.sin(t * 3 + i) * ht * 0.2, hl * 0.5 + off, y);
    }
    ctx.stroke();
    ctx.restore();
    // bubbles and sparks
    for (let i = 0; i < 4; i++) {
      const k = mod(t * 0.8 + i * 0.25, 1), x = (hash(i * 2 + 1) - 0.5) * len * 0.8;
      ctx.globalAlpha = Math.sin(k * Math.PI) * life;
      ctx.beginPath();
      ctx.arc(x, ht * 0.2 - k * ht * 1.8, Math.max(0.8, th * 0.1) * (0.5 + k), 0, TAU);
      ctx.fillStyle = venom ? (k > 0.8 ? '#efffa0' : '#8be04e') : k > 0.8 ? '#fff2a0' : '#ffb03a';
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
}

/* ----------------------------------------------------------------- ICICLE */

// Falling icicle (frozen lake). h = length, pointing down (+y).
export function drawIcicle(ctx, cx, cy, h, t = 0) {
  if (!(h > 0)) return;
  safe(ctx, () => {
    ctx.translate(cx, cy);
    const w = h * 0.17, top = -h / 2, o = lw(1.2, h * 0.04);
    ctx.lineJoin = 'round';
    // faint cold glow
    const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, h * 0.7);
    gl.addColorStop(0, 'rgba(180,235,255,0.35)');
    gl.addColorStop(1, 'rgba(180,235,255,0)');
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.arc(0, 0, h * 0.7, 0, TAU);
    ctx.fill();
    // small side shard
    ctx.beginPath();
    ctx.moveTo(w * 0.9, top);
    ctx.lineTo(w * 1.9, top);
    ctx.lineTo(w * 1.5, top + h * 0.45);
    ctx.closePath();
    ctx.fillStyle = '#bfe8fa';
    ctx.fill();
    ctx.lineWidth = o;
    ctx.strokeStyle = '#3d7fa8';
    ctx.stroke();
    // main spike: two facets
    const spike = () => {
      ctx.beginPath();
      ctx.moveTo(-w * 1.15, top);
      ctx.lineTo(w * 1.15, top);
      ctx.lineTo(w * 0.7, top + h * 0.35);
      ctx.lineTo(w * 0.12, h / 2);
      ctx.lineTo(-w * 0.1, h / 2 - h * 0.03);
      ctx.lineTo(-w * 0.75, top + h * 0.3);
      ctx.closePath();
    };
    spike();
    const g = ctx.createLinearGradient(-w, 0, w, 0);
    g.addColorStop(0, '#f2fbff');
    g.addColorStop(0.45, '#bfe9fb');
    g.addColorStop(1, '#6fb6e0');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(30,110,190,0.28)'; // shaded right facet
    ctx.beginPath();
    ctx.moveTo(w * 0.12, top);
    ctx.lineTo(w * 1.3, top);
    ctx.lineTo(w * 0.12, h / 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; // gloss streak
    ctx.beginPath();
    ctx.moveTo(-w * 0.75, top + h * 0.03);
    ctx.lineTo(-w * 0.4, top + h * 0.03);
    ctx.lineTo(-w * 0.2, top + h * 0.5);
    ctx.lineTo(-w * 0.4, top + h * 0.5);
    ctx.fill();
    ctx.restore();
    spike();
    ctx.lineWidth = o * 1.2;
    ctx.strokeStyle = '#2f6f9c';
    ctx.stroke();
    // frost cap
    ctx.beginPath();
    ctx.ellipse(0, top, w * 1.3, h * 0.045, 0, 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.stroke();
    // twinkle
    const k = Math.sin(t * 4) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(255,255,255,${0.4 + 0.6 * k})`;
    const sx = -w * 0.15, sy = top + h * 0.28, sr = w * (0.5 + 0.5 * k);
    ctx.beginPath();
    ctx.moveTo(sx, sy - sr * 1.4);
    ctx.quadraticCurveTo(sx, sy, sx + sr, sy);
    ctx.quadraticCurveTo(sx, sy, sx, sy + sr * 1.4);
    ctx.quadraticCurveTo(sx, sy, sx - sr, sy);
    ctx.quadraticCurveTo(sx, sy, sx, sy - sr * 1.4);
    ctx.fill();
  });
}

/* ------------------------------------------------------------------ VENOM */

// Venom spit blob in flight / splash. r = radius, k 0..1 life.
export function drawVenom(ctx, cx, cy, r, t = 0, k = 1) {
  if (!(r > 0)) return;
  safe(ctx, () => {
    k = clamp(k == null ? 1 : k, 0, 1);
    ctx.translate(cx, cy);
    const o = lw(1.2, r * 0.12), sp = 1 - k;
    const gl = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 2.2);
    gl.addColorStop(0, `rgba(150,255,60,${0.5 * k})`);
    gl.addColorStop(1, 'rgba(150,255,60,0)');
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.2, 0, TAU);
    ctx.fill();
    const blob = (x, y, rr, wob) => {
      ctx.beginPath();
      for (let i = 0; i <= 20; i++) {
        const a = (i / 20) * TAU, q = rr * (1 + wob * Math.sin(a * 3 + t * 9) + wob * 0.6 * Math.sin(a * 5 - t * 7));
        const px = x + Math.cos(a) * q, py = y + Math.sin(a) * q;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
      const g = ctx.createRadialGradient(x - rr * 0.35, y - rr * 0.4, rr * 0.1, x, y, rr * 1.1);
      g.addColorStop(0, '#d8ff8a');
      g.addColorStop(0.45, '#7bea38');
      g.addColorStop(1, '#2f9a1c');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = o;
      ctx.strokeStyle = '#1d5e12';
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.ellipse(x - rr * 0.35, y - rr * 0.38, rr * 0.2, rr * 0.12, -0.7, 0, TAU);
      ctx.fill();
    };
    ctx.globalAlpha = Math.min(1, 0.25 + k * 1.6);
    blob(0, 0, r * (0.62 + 0.38 * k + sp * 0.35), 0.07 + sp * 0.12);
    // satellite drops: trail in flight, spray when it splashes
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + hash(i) * 0.8, d = r * (0.9 + sp * 2.2 + hash(i + 4) * 0.6), rr = r * (0.18 + 0.1 * hash(i + 2)) * (0.4 + k * 0.7);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * d, Math.sin(a) * d * (0.7 + sp * 0.3) + sp * sp * r, rr, 0, TAU);
      ctx.fillStyle = '#7bea38';
      ctx.fill();
      ctx.lineWidth = o * 0.7;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}

/* ------------------------------------------------------------- SPECIAL EGGS */

// Crack polylines in unit egg space (x/rx, y/ry), fixed so they never jump between frames.
const KIND_CRACKS = [
  [[0.78, -0.55], [0.6, -0.4], [0.5, -0.22], [0.28, -0.14], [0.2, 0.06], [0.0, 0.14], [-0.06, 0.34]],
  [[-0.82, 0.3], [-0.62, 0.22], [-0.5, 0.4], [-0.3, 0.38], [-0.2, 0.55]],
];

// Special eggs (Angry-Birds-style traits): 'ostrich' (big, cream, pores), 'quail' (small, speckled brown),
// 'duck' (pale blue-green). rx, ry = egg radii in px, rot = body angle, cracks 0..2. Shell only, no face.
export function drawEggKind(ctx, kind, cx, cy, rx, ry, rot = 0, t = 0, cracks = 0) {
  if (!(rx > 0 && ry > 0)) return;
  safe(ctx, () => {
    ctx.translate(cx, cy);
    ctx.rotate(rot || 0);
    const path = (k = 1) => {
      ctx.beginPath();
      for (let i = 0; i <= 36; i++) {
        const a = (i / 36) * TAU, sy = Math.sin(a);
        const x = rx * k * Math.cos(a) * (1 + 0.13 * sy), y = ry * k * sy;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
    };
    const pal = {
      ostrich: ['#fffbe8', '#f1e4c0', '#cdb887', 'rgba(120,90,50,0.8)'],
      quail: ['#f6ead0', '#e3cfa2', '#b99a66', 'rgba(70,45,22,0.9)'],
      duck: ['#f2fffa', '#cfeadf', '#8fc0b4', 'rgba(40,90,86,0.85)'],
    }[kind] || ['#ffffff', '#f7ecd6', '#d9c3a0', 'rgba(90,64,40,0.85)'];
    path();
    const g = ctx.createRadialGradient(-rx * 0.3, -ry * 0.25, ry * 0.05, 0, 0, ry * 1.05);
    g.addColorStop(0, pal[0]);
    g.addColorStop(0.55, pal[1]);
    g.addColorStop(1, pal[2]);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    const u = Math.min(rx, ry);
    if (kind === 'ostrich') {
      // pitted shell: little pores with a lit lip
      for (let i = 0; i < 30; i++) {
        const a = hash(i) * TAU, d = Math.sqrt(hash(i + 50)) * 0.92, x = Math.cos(a) * d * rx, y = Math.sin(a) * d * ry, pr = u * (0.035 + 0.03 * hash(i + 9));
        ctx.beginPath();
        ctx.ellipse(x, y, pr * 1.3, pr, hash(i) * 3, 0, TAU);
        ctx.fillStyle = 'rgba(150,120,70,0.5)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x - pr * 0.3, y - pr * 0.3, pr * 0.4, 0, TAU);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fill();
      }
    } else if (kind === 'quail') {
      // brown blotches and speckles
      for (let i = 0; i < 26; i++) {
        const a = hash(i + 1) * TAU, d = Math.sqrt(hash(i + 60)) * 0.95, x = Math.cos(a) * d * rx, y = Math.sin(a) * d * ry, big = i % 4 === 0;
        ctx.beginPath();
        ctx.ellipse(x, y, u * (big ? 0.2 : 0.09) * (0.7 + hash(i + 3)), u * (big ? 0.13 : 0.075) * (0.7 + hash(i + 4)), hash(i + 5) * 3, 0, TAU);
        ctx.fillStyle = big ? 'rgba(120,80,44,0.65)' : 'rgba(62,40,22,0.85)';
        ctx.fill();
      }
    } else if (kind === 'duck') {
      // soft sheen band and a few mottles
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(-rx * 0.45, -ry * 0.05, rx * 0.12, ry * 0.5, 0.15, 0, TAU);
      ctx.fill();
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.arc((hash(i + 20) - 0.5) * rx * 1.6, (hash(i + 30) - 0.5) * ry * 1.7, u * 0.045, 0, TAU);
        ctx.fillStyle = 'rgba(80,150,140,0.28)';
        ctx.fill();
      }
    }
    // bottom shade for volume
    const sh = ctx.createLinearGradient(0, -ry * 0.2, 0, ry);
    sh.addColorStop(0, 'rgba(0,0,0,0)');
    sh.addColorStop(1, 'rgba(60,30,10,0.22)');
    ctx.fillStyle = sh;
    ctx.fillRect(-rx * 1.3, -ry * 1.1, rx * 2.6, ry * 2.3);
    ctx.restore();
    path();
    ctx.lineWidth = lw(1.4, u * 0.06);
    ctx.strokeStyle = kind === 'ostrich' ? 'rgba(110,80,40,0.9)' : pal[3];
    ctx.stroke();
    // glossy highlight
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.ellipse(-rx * 0.38, -ry * 0.42, rx * 0.12, ry * 0.2, 0.5, 0, TAU);
    ctx.fill();
    // cracks
    const n = clamp(Math.round(cracks || 0), 0, 2);
    if (n > 0) {
      ctx.strokeStyle = '#4a3420';
      ctx.lineWidth = lw(1.2, u * 0.05);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        KIND_CRACKS[i].forEach(([x, y], j) => (j ? ctx.lineTo(x * rx, y * ry) : ctx.moveTo(x * rx, y * ry)));
        const m = KIND_CRACKS[i][3];
        ctx.moveTo(m[0] * rx, m[1] * ry);
        ctx.lineTo((m[0] + 0.22 * (i ? -1 : 1)) * rx, (m[1] + 0.2) * ry);
        ctx.stroke();
      }
    }
  });
}

/* --------------------------------------------------------- THORN CURTAIN */

// Thorn curtain hanging across a gap (only fire clears it). len = gap width px, h = hang length px.
export function drawThornCurtain(ctx, cx, cy, len, h, t = 0, burn = 0) {
  if (!(len > 0 && h > 0)) return;
  safe(ctx, () => {
    burn = clamp(burn || 0, 0, 1);
    ctx.translate(cx, cy);
    const o = lw(1.2, h * 0.025), n = Math.max(3, Math.round(len / Math.max(6, h * 0.34)));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const reach = h * (1 - burn * 0.92);
    const sway = (x, y) => Math.sin(t * 2 + x * 0.25 + y * 0.05) * Math.min(2.5, len * 0.02) * (y / h);
    const sp = [];
    for (let i = 0; i < n; i++) sp.push({ x0: -len / 2 + (len * (i + 0.5)) / n, ln: reach * (0.78 + 0.22 * hash(i * 2 + 1)), ph: hash(i + 7) * 6 });
    // rail the curtain grows from
    ctx.beginPath();
    ctx.moveTo(-len / 2 - 2, 0);
    ctx.lineTo(len / 2 + 2, 0);
    ctx.lineWidth = o * 3.2;
    ctx.strokeStyle = '#2a0a12';
    ctx.stroke();
    ctx.lineWidth = o * 1.6;
    ctx.strokeStyle = '#8a2234';
    ctx.stroke();
    const charred = burn > 0;
    const vineCol = charred ? `rgb(${Math.round(122 - 80 * burn)},${Math.round(29 - 10 * burn)},${Math.round(46 - 24 * burn)})` : '#8a1f33';
    // cross vines weaving between strands
    ctx.lineWidth = o * 1.4;
    ctx.strokeStyle = vineCol;
    for (const yk of [0.35, 0.65]) {
      const y = reach * yk;
      ctx.beginPath();
      sp.forEach((s, i) => { const x = s.x0 + sway(s.x0, y), yy = y + Math.sin(i * 1.7 + yk * 9) * h * 0.04; i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); });
      ctx.stroke();
    }
    for (const s of sp) {
      const segs = Math.max(4, Math.round(h / (len / n * 0.5)));
      const pts = [];
      for (let k = 0; k <= segs; k++) { const y = (s.ln * k) / segs; pts.push([s.x0 + sway(s.x0, y) + Math.sin(k * 1.3 + s.ph) * len * 0.015, y]); }
      for (const [w, col] of [[o * 3.6, '#2a0a12'], [o * 2.2, vineCol]]) {
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.lineWidth = w;
        ctx.strokeStyle = col;
        ctx.stroke();
      }
      // thorns alternate sides
      const tl = Math.max(3, Math.min(len / n * 0.4, h * 0.14));
      for (let k = 1; k < segs; k++) {
        const [x, y] = pts[k], d = k % 2 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(x, y - tl * 0.3);
        ctx.lineTo(x + d * tl, y + tl * 0.5);
        ctx.lineTo(x, y + tl * 0.35);
        ctx.closePath();
        ctx.fillStyle = charred ? `rgb(${Math.round(240 - 150 * burn)},${Math.round(56 - 30 * burn)},${Math.round(79 - 40 * burn)})` : '#f04058';
        ctx.fill();
        ctx.lineWidth = o * 0.8;
        ctx.strokeStyle = '#2a0a12';
        ctx.stroke();
      }
      // sharp tip
      const [ex, ey] = pts[segs];
      ctx.beginPath();
      ctx.moveTo(ex - tl * 0.35, ey - tl * 0.2);
      ctx.lineTo(ex, ey + tl * 0.9);
      ctx.lineTo(ex + tl * 0.35, ey - tl * 0.2);
      ctx.closePath();
      ctx.fillStyle = charred ? '#5a2030' : '#f04058';
      ctx.fill();
      ctx.stroke();
      // fire eating the strand from below
      if (burn > 0 && burn < 1) {
        const fh = (4 + 8 * hash(s.ph)) * (0.8 + 0.4 * Math.sin(t * 13 + s.ph)) + h * 0.05;
        for (const [sc, col] of [[1, '#ff5a1a'], [0.65, '#ffb42a'], [0.3, '#fff2a0']]) {
          ctx.beginPath();
          ctx.moveTo(ex - 3 * sc - 1, ey + 1);
          ctx.quadraticCurveTo(ex - 3 * sc, ey - fh * sc * 0.5, ex + Math.sin(t * 9 + s.ph) * 1.5, ey - fh * sc);
          ctx.quadraticCurveTo(ex + 3 * sc, ey - fh * sc * 0.5, ex + 3 * sc + 1, ey + 1);
          ctx.closePath();
          ctx.fillStyle = col;
          ctx.fill();
        }
      }
    }
  });
}

/* ------------------------------------------------------------------ GRATE */

// Grate set into a ring floor: only small (quail) eggs pass. len = arc length px, th = ring thickness px.
export function drawGrate(ctx, cx, cy, len, th, t = 0) {
  if (!(len > 0 && th > 0)) return;
  safe(ctx, () => {
    ctx.translate(cx, cy);
    const hl = len / 2, ht = th / 2, o = lw(1.2, th * 0.07), fr = Math.max(1.5, th * 0.2);
    const box = () => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-hl, -ht, len, th, fr); else ctx.rect(-hl, -ht, len, th); };
    // dark opening
    ctx.fillStyle = 'rgba(8,6,14,0.82)';
    box();
    ctx.fill();
    // bars across the thickness, gaps small enough for a quail egg only
    const n = Math.max(3, Math.round(len / (th * 0.55)));
    const pitch = (len - fr * 2) / n, bw = Math.max(1.4, pitch * 0.42);
    for (let i = 0; i <= n; i++) {
      const x = -hl + fr + pitch * i;
      const g = ctx.createLinearGradient(x - bw / 2, 0, x + bw / 2, 0);
      g.addColorStop(0, '#d5dbe3');
      g.addColorStop(0.45, '#8f99a6');
      g.addColorStop(1, '#46505c');
      ctx.fillStyle = g;
      ctx.fillRect(x - bw / 2, -ht + fr * 0.4, bw, th - fr * 0.8);
      ctx.lineWidth = o * 0.6;
      ctx.strokeStyle = '#1c222a';
      ctx.strokeRect(x - bw / 2, -ht + fr * 0.4, bw, th - fr * 0.8);
    }
    // frame
    box();
    ctx.lineWidth = fr * 0.9;
    ctx.strokeStyle = '#6b7684';
    ctx.stroke();
    ctx.lineWidth = o;
    ctx.strokeStyle = '#1c222a';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-hl + fr, -ht + fr * 0.45);
    ctx.lineTo(hl - fr, -ht + fr * 0.45);
    ctx.lineWidth = Math.max(0.8, o * 0.6);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.stroke();
    // rivets
    ctx.fillStyle = '#c9d0d9';
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * (hl - fr * 0.55), sy * (ht - fr * 0.55), Math.max(0.8, fr * 0.22), 0, TAU); ctx.fill(); }
    // a tiny glint sliding along the bars
    const k = mod(t * 0.5, 1.4) - 0.2;
    if (k > 0 && k < 1) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(-hl + len * k, -ht + fr * 0.5, Math.max(1, len * 0.015), th - fr);
    }
  });
}

/* --------------------------------------------------------------- ONE WAY */

// One-way ring marker: chevrons pointing the allowed direction (dir 1 = counter-clockwise). size px.
export function drawOneWayMark(ctx, cx, cy, size, dir = 1, t = 0) {
  if (!(size > 0)) return;
  safe(ctx, () => {
    ctx.translate(cx, cy);
    ctx.scale(dir < 0 ? -1 : 1, 1);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // dark pill so the mark reads on any ring colour
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-size * 0.72, -size * 0.5, size * 1.44, size, size * 0.5);
    else ctx.rect(-size * 0.72, -size * 0.5, size * 1.44, size);
    ctx.fillStyle = 'rgba(30,18,4,0.62)';
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * size * 0.4 - size * 0.06;
      ctx.globalAlpha = 0.35 + 0.65 * Math.max(0, Math.sin(t * 5 - i * 1.2));
      ctx.beginPath();
      ctx.moveTo(x - size * 0.12, -size * 0.3);
      ctx.lineTo(x + size * 0.14, 0);
      ctx.lineTo(x - size * 0.12, size * 0.3);
      ctx.lineWidth = size * 0.34;
      ctx.strokeStyle = '#4a2c00';
      ctx.stroke();
      ctx.lineWidth = size * 0.19;
      ctx.strokeStyle = '#ffd34a';
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}
