// The KING CRAB (world 8 boss) drawing: a giant armoured crab on the sea floor under the vault, its two great claws on
// long segmented arms that hug the vault and reach in through lined-up gaps. Crisp cel-shaded code art in the house
// style (dark outline, two-tone shading, no pale rims). ctx is in world space (m, y up). The body is drawn in a local
// y-DOWN px space whose "up" (-y) points at the vault; the arms are stroked in world space round the outside.
// Also: the boss card, the boss-bar emblem and the boss-bar pips (screen space, y down).
import { TAU } from '../sim/geom.js';
import { KC } from '../sim/kingcrab.js';
import { ATTACK_NAME } from '../sim/boss.js';
import { dizzyStars, spiralEye, boltStroke } from './status.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
const wrapA = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const pxSpace = (ctx, x, y, k, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(1 / k, -1 / k); try { f(); } catch (e) { if (!pxSpace.w) { pxSpace.w = 1; console.warn('king crab art', e); } } ctx.restore(); };
const fillStroke = (ctx, fill, line, lw) => { ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = line; ctx.stroke(); };

// frozen (frost nova): the same crab in ice blues, two-tone, dark outline (no pale rim)
export const KCI = { line: '#12324a', shell: '#8fd0ee', lo: '#4f97c4', hi: '#c4ecfb', belly: '#b8e2f4', bellyLo: '#7ab8d8', spot: '#3f80ac', crown: '#d8eef8', crownLo: '#8fb8d0', eye: '#0c2234', white: '#eaf8ff', tip: '#1d4a6a', warn: '#ff5a3a', sand: '#d8b878', sandLo: '#a8864a' };
// the arms and great claws: deep orange with dark bands, so an arm reads apart from the red coral rings
export const KCA = { line: '#2a1004', shell: '#f2821e', lo: '#b0480c', hi: '#ffb35a', band: '#5a2206', belly: '#ffd08a', bellyLo: '#d89a50', spot: '#8a3a08', eye: '#140404', white: '#fff1dc', tip: '#3a1606' };
export const KC_BODY = 1.5; // the body is drawn this much bigger than its 1 px-per-m art (crown and eyes readable on a phone)
export const KCP = { line: '#2a0806', shell: '#d6402c', lo: '#8f1f16', hi: '#ff8a5e', belly: '#f0b07a', bellyLo: '#c07a48', spot: '#7a160e', crown: '#ffcf3a', crownLo: '#c88a12', eye: '#140404', white: '#fff1dc', tip: '#3a120c', warn: '#ff5a3a', sand: '#d8b878', sandLo: '#a8864a' };

// ---------------------------------------------------------------- the body (local px, y down, "up" = toward the vault)
// s px per metre. o: { look {x, y} (unit, local), eye 'normal'|'x'|'squeeze'|'spiral'|'mad', flash 0..1, stamp 0..1,
//      legs (walk phase), sweat, mouth 0..1, crown (bool) }
export function drawCrabBody(ctx, s, t, o = {}) {
  const lw = Math.max(1.3, s * 0.035), C = o.ice ? KCI : KCP;
  const br = 1 + 0.015 * Math.sin(t * 2.2), stamp = o.stamp || 0;
  ctx.save();
  ctx.translate(0, -stamp * 0.12 * s);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // walking legs: four a side, splayed down onto the sea floor (local +y)
  for (let i = 0; i < 4; i++) {
    for (const sd of [-1, 1]) {
      const q = (o.legs || 0) + i * 1.7 + (sd > 0 ? 1.3 : 0), lift = Math.max(0, Math.sin(q)) * 0.05 * s;
      const hx = sd * (0.42 + i * 0.13) * s, hy = (0.12 + i * 0.03) * s;
      const kx = sd * (0.82 + i * 0.17) * s, ky = (-0.05 + i * 0.05) * s - lift;
      const fx = sd * (1.0 + i * 0.16) * s, fy = (0.42 + stamp * 0.12) * s - lift * 0.4;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy);
      ctx.strokeStyle = C.line; ctx.lineWidth = lw * 3.6; ctx.stroke();
      ctx.strokeStyle = i % 2 ? C.lo : C.shell; ctx.lineWidth = lw * 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(kx, ky, lw * 1.1, 0, TAU); ctx.fillStyle = C.line; ctx.fill(); // knee
    }
  }
  // the carapace: broad and armoured, a serrated front edge, crown spikes along the top
  const W = 0.98 * s, H = 0.5 * s * br, top = -0.42 * s * br;
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(-W, 0.02 * s);
    ctx.bezierCurveTo(-W * 1.04, top * 0.9, -W * 0.5, top * 1.25, 0, top * 1.22);
    ctx.bezierCurveTo(W * 0.5, top * 1.25, W * 1.04, top * 0.9, W, 0.02 * s);
    for (let i = 0; i <= 10; i++) { const q = i / 10, x = W - q * 2 * W; ctx.lineTo(x, (0.14 + (i % 2 ? 0.05 : 0)) * s + Math.sin(q * Math.PI) * 0.08 * s); }
    ctx.closePath();
  };
  shape();
  ctx.fillStyle = o.flash > 0 && Math.floor(t * 16) % 2 ? C.hi : C.shell; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = C.lo; ctx.beginPath(); ctx.ellipse(0, H * 0.55, W * 1.2, H * 0.55, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = C.hi; ctx.beginPath(); ctx.ellipse(-W * 0.35, top * 0.85, W * 0.32, H * 0.14, -0.15, 0, TAU); ctx.fill();
  ctx.fillStyle = C.spot;
  for (const [x, y, r] of [[-0.55, -0.12, 0.07], [0.5, -0.16, 0.06], [-0.2, -0.3, 0.05], [0.25, -0.33, 0.045], [0.7, 0.0, 0.05], [-0.75, 0.01, 0.045]]) { ctx.beginPath(); ctx.arc(x * s, y * s, r * s, 0, TAU); ctx.fill(); }
  // armour plate lines
  ctx.strokeStyle = C.lo; ctx.lineWidth = lw * 1.1;
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * W * 0.2, top * 1.1); ctx.quadraticCurveTo(sx * W * 0.32, top * 0.3, sx * W * 0.22, 0.12 * s); ctx.stroke(); }
  ctx.restore();
  shape(); ctx.lineWidth = lw * 1.2; ctx.strokeStyle = C.line; ctx.stroke();
  // side spikes on the shell rim
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
    const a = -0.35 - i * 0.32, bx = sx * W * (0.98 - i * 0.07) * 1, by = top * (0.35 + i * 0.3);
    ctx.beginPath(); ctx.moveTo(bx, by - 0.05 * s); ctx.lineTo(bx + sx * 0.13 * s * Math.cos(a), by + 0.13 * s * Math.sin(a) - 0.02 * s); ctx.lineTo(bx - sx * 0.02 * s, by + 0.05 * s); ctx.closePath();
    fillStroke(ctx, C.shell, C.line, lw);
  }
  // the crown: three gold points on its brow
  if (o.crown !== false) {
    const cy = top * 1.18, cw = 0.26 * s;
    ctx.beginPath(); ctx.moveTo(-cw, cy + 0.04 * s);
    ctx.lineTo(-cw * 1.05, cy - 0.17 * s); ctx.lineTo(-cw * 0.5, cy - 0.06 * s); ctx.lineTo(0, cy - 0.23 * s); ctx.lineTo(cw * 0.5, cy - 0.06 * s); ctx.lineTo(cw * 1.05, cy - 0.17 * s); ctx.lineTo(cw, cy + 0.04 * s);
    ctx.closePath();
    ctx.fillStyle = C.crown; ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = C.crownLo; ctx.fillRect(-cw * 1.2, cy - 0.02 * s, cw * 2.4, 0.08 * s); ctx.restore();
    ctx.lineWidth = lw; ctx.strokeStyle = C.line; ctx.stroke();
    ctx.fillStyle = '#2f8ad8'; ctx.beginPath(); ctx.arc(0, cy - 0.03 * s, 0.035 * s, 0, TAU); ctx.fill(); ctx.lineWidth = lw * 0.7; ctx.stroke();
  }
  // eye stalks and eyes
  const lk = o.look || { x: 0, y: -1 }, eye = o.eye || 'normal';
  for (const sx of [-1, 1]) {
    const bx = sx * 0.28 * s, by = top * 0.95, len = 0.3 * s, tx = bx + sx * 0.06 * s + Math.sin(t * 1.7 + sx) * 0.02 * s, ty = by - len;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.strokeStyle = C.line; ctx.lineWidth = lw * 3; ctx.stroke(); ctx.strokeStyle = C.shell; ctx.lineWidth = lw * 1.5; ctx.stroke();
    const er = 0.1 * s;
    ctx.beginPath(); ctx.arc(tx, ty, er, 0, TAU); fillStroke(ctx, C.white, C.line, lw);
    if (eye === 'spiral') spiralEye(ctx, tx, ty, er * 0.85, t, sx, C.line);
    else if (eye === 'x') { ctx.strokeStyle = C.line; ctx.lineWidth = lw * 1.3; ctx.beginPath(); ctx.moveTo(tx - er * 0.5, ty - er * 0.5); ctx.lineTo(tx + er * 0.5, ty + er * 0.5); ctx.moveTo(tx + er * 0.5, ty - er * 0.5); ctx.lineTo(tx - er * 0.5, ty + er * 0.5); ctx.stroke(); }
    else if (eye === 'squeeze') { ctx.strokeStyle = C.line; ctx.lineWidth = lw * 1.4; ctx.beginPath(); ctx.moveTo(tx + sx * er * 0.5, ty - er * 0.45); ctx.lineTo(tx - sx * er * 0.35, ty); ctx.lineTo(tx + sx * er * 0.5, ty + er * 0.45); ctx.stroke(); }
    else { ctx.fillStyle = C.eye; ctx.beginPath(); ctx.arc(tx + lk.x * er * 0.45, ty + lk.y * er * 0.45, er * 0.5, 0, TAU); ctx.fill(); ctx.fillStyle = C.white; ctx.beginPath(); ctx.arc(tx + lk.x * er * 0.45 - er * 0.18, ty + lk.y * er * 0.45 - er * 0.18, er * 0.14, 0, TAU); ctx.fill(); }
    if (eye === 'mad' || eye === 'normal') { // a heavy brow; steep when it is mad
      const st = eye === 'mad' ? 0.55 : 0.2;
      ctx.strokeStyle = C.line; ctx.lineWidth = lw * 1.6; ctx.beginPath(); ctx.moveTo(tx - sx * er * 1.1, ty - er * (1.2 + st)); ctx.lineTo(tx + sx * er * 0.9, ty - er * (1.2 - st)); ctx.stroke();
    }
  }
  // mouth plates
  const mo = o.mouth || 0, my = top * 0.45;
  ctx.beginPath(); ctx.ellipse(0, my, 0.16 * s, (0.05 + 0.05 * mo) * s, 0, 0, TAU); fillStroke(ctx, '#4a0e08', C.line, lw);
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * 0.09 * s, my - 0.01 * s, 0.07 * s, 0.05 * s, sx * 0.4, 0, TAU); fillStroke(ctx, C.belly, C.line, lw * 0.8); }
  // sweat drops when a claw is stuck
  if (o.sweat) {
    for (let i = 0; i < 2; i++) {
      const q = (t * 1.6 + i * 0.5) % 1, x = (i ? 0.55 : -0.6) * s, y = top * 1.0 + q * 0.25 * s;
      ctx.globalAlpha = 1 - q;
      ctx.beginPath(); ctx.moveTo(x, y - 0.07 * s); ctx.quadraticCurveTo(x + 0.05 * s, y, x, y + 0.04 * s); ctx.quadraticCurveTo(x - 0.05 * s, y, x, y - 0.07 * s);
      fillStroke(ctx, '#7ad0ff', '#174a6a', lw * 0.8);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ---------------------------------------------------------------- one great claw (local px, +x = where it points)
// (0, 0) = the base of its fingers; the hand sits behind (-x), the fingers reach ahead (+x).
// open 0..1, part 'all' | 'back' (hand + moving finger) | 'front' (the fixed finger, over a held egg)
export function drawClawHead(ctx, s, t, open, part = 'all', o = {}) {
  const lw = Math.max(1.3, s * 0.035), C = o.ice ? KCI : KCA, L = 0.42 * s, a = 0.08 + clamp(open, 0, 1) * 0.62;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const finger = (sg, ang, fill) => {
    ctx.save(); ctx.rotate(sg * ang);
    ctx.beginPath();
    ctx.moveTo(-0.04 * s, 0);
    ctx.bezierCurveTo(L * 0.2, sg * 0.2 * s, L * 0.75, sg * 0.16 * s, L, sg * 0.02 * s);
    ctx.quadraticCurveTo(L * 0.6, sg * 0.02 * s, L * 0.3, sg * 0.05 * s);
    ctx.lineTo(L * 0.1, sg * 0.01 * s);
    ctx.closePath();
    fillStroke(ctx, fill, C.line, lw);
    // teeth on the inner edge and a dark tip
    ctx.fillStyle = C.tip; ctx.beginPath(); ctx.arc(L * 0.93, sg * 0.03 * s, 0.035 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = C.belly;
    for (let i = 0; i < 3; i++) { const x = L * (0.35 + i * 0.17); ctx.beginPath(); ctx.moveTo(x, sg * 0.04 * s); ctx.lineTo(x + 0.03 * s, sg * 0.0 * s); ctx.lineTo(x + 0.06 * s, sg * 0.045 * s); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  };
  if (part !== 'front') {
    finger(-1, a, C.shell); // the moving finger (dactyl)
    // the hand: a big armoured mitt
    ctx.beginPath(); ctx.ellipse(-0.2 * s, 0, 0.27 * s, 0.2 * s, 0, 0, TAU);
    ctx.fillStyle = o.flash > 0 && Math.floor(t * 16) % 2 ? C.hi : C.shell; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = C.lo; ctx.beginPath(); ctx.ellipse(-0.2 * s, 0.14 * s, 0.32 * s, 0.13 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = C.hi; ctx.beginPath(); ctx.ellipse(-0.25 * s, -0.11 * s, 0.13 * s, 0.045 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = C.spot; ctx.beginPath(); ctx.arc(-0.12 * s, -0.02 * s, 0.035 * s, 0, TAU); ctx.arc(-0.3 * s, 0.04 * s, 0.03 * s, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.ellipse(-0.2 * s, 0, 0.27 * s, 0.2 * s, 0, 0, TAU); ctx.lineWidth = lw * 1.1; ctx.strokeStyle = C.line; ctx.stroke();
  }
  if (part !== 'back') finger(1, a * 0.35, C.lo); // the fixed finger
  ctx.restore();
}

// ---------------------------------------------------------------- in game
const up = (sim) => sim.gy || 1;
const flipOf = (sim) => -up(sim); // +1 underwater (the crab below, looking up), -1 on top (turned round)
// a body-local point (m, y down) to world
const toWorld = (sim, K, lx, ly) => { const f = flipOf(sim); return { x: K.bx + lx * f, y: K.by - ly * f }; };
function shoulder(sim, K, id) { return toWorld(sim, K, (id ? 1 : -1) * 0.78 * KC_BODY * flipOf(sim), -0.12 * KC_BODY); }
// the arm's path (world points from the shoulder to the claw's finger base) and the claw's pointing direction
function armPath(sim, K, C, t) {
  const R = sim.outerR, S = shoulder(sim, K, C.id), a0 = Math.atan2(S.y, S.x);
  const sg = (C.id ? -1 : 1) * up(sim); // the left claw wraps round the left side, the right one the right
  let u = ((C.th - a0) * sg) % TAU; if (u < 0) u += TAU; if (u > TAU - 0.35) u -= TAU;
  const ra = Math.max(R + 0.42, Math.min(C.d, R + 1.1)), pts = [S];
  const n = Math.max(2, Math.ceil((Math.abs(u) * ra) / 0.12));
  for (let i = 1; i <= n; i++) { const q = i / n, a = a0 + sg * u * q, r = Math.hypot(S.x, S.y) + (ra - Math.hypot(S.x, S.y)) * sstep(Math.min(1, q * 4)); pts.push({ x: r * Math.cos(a), y: r * Math.sin(a) }); }
  if (C.d < ra - 0.01) { const m = Math.ceil((ra - C.d) / 0.12); for (let i = 1; i <= m; i++) { const r = ra - ((ra - C.d) * i) / m; pts.push({ x: r * Math.cos(C.th), y: r * Math.sin(C.th) }); } }
  const sw = C.sw || 0;
  if (sw) { const m = Math.max(1, Math.ceil((Math.abs(sw) * C.d) / 0.12)); for (let i = 1; i <= m; i++) { const a = C.th + (sw * i) / m; pts.push({ x: C.d * Math.cos(a), y: C.d * Math.sin(a) }); } }
  const tipA = C.th + sw, tip = { x: C.d * Math.cos(tipA), y: C.d * Math.sin(tipA) };
  // the claw points in toward the centre; outside the vault, idle, it points along its arm a little
  let dir = tipA + Math.PI;
  if (C.d >= R + 0.3 && (C.ph === 'idle' || C.ph === 'away' || C.ph === 'hurt' || C.ph === 'warp')) dir += sg * 0.9;
  return { pts, tip, dir };
}
function strokeArm(ctx, pts, w, col) {
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.lineWidth = w; ctx.strokeStyle = col; ctx.stroke();
}
function clawOpen(C, t) {
  switch (C.ph) {
    case 'aim': return 0.45 + 0.55 * sstep(C.warn * 1.4) + (C.warn > 0.6 ? Math.sin(t * 28) * 0.08 : 0);
    case 'reach': case 'sweep': return 0.95;
    case 'snap': return 0.9 * clamp(C.t / Math.max(1e-3, C.dur), 0, 1);
    case 'pull': return C.eid ? 0.05 : 0.15;
    case 'stuck': return 0.35 + 0.25 * Math.sin(t * 22);
    case 'bonk': return 0.12;
    case 'hurt': return 0.6 + 0.3 * Math.sin(t * 30);
    default: return 0.28 + 0.1 * Math.sin(t * 2.3 + C.id * 2);
  }
}
const RA = new Map();
function drawArm(ctx, sim, K, C, t, k, part, ice = false) {
  const A = armPath(sim, K, C, t), lw = Math.max(0.03, 1.3 / k);
  const shake = C.ph === 'stuck' ? Math.sin(t * 40) * 0.025 : C.ph === 'aim' && C.warn > 0.6 ? Math.sin(t * 34) * 0.02 : 0;
  const tip = { x: A.tip.x + Math.cos(A.dir + Math.PI / 2) * shake, y: A.tip.y + Math.sin(A.dir + Math.PI / 2) * shake };
  if (part !== 'front') {
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const pts = A.pts.slice(); pts[pts.length - 1] = tip;
    // the arm: a thick armoured tube, two-tone, with joint bands
    const P = ice ? KCI : KCA;
    strokeArm(ctx, pts, 0.27, P.line);
    strokeArm(ctx, pts, 0.27 - lw * 2.2, P.lo);
    ctx.save(); ctx.translate(-0.018, 0.018); strokeArm(ctx, pts, 0.12, P.shell); ctx.restore();
    let acc = 0;
    ctx.strokeStyle = P.band || P.line; ctx.lineWidth = lw * 2;
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i - 1]; acc += Math.hypot(p.x - q.x, p.y - q.y);
      if (acc < 0.42) continue;
      acc = 0;
      const a = Math.atan2(p.y - q.y, p.x - q.x) + Math.PI / 2, h = 0.115;
      ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * h, p.y + Math.sin(a) * h); ctx.lineTo(p.x - Math.cos(a) * h, p.y - Math.sin(a) * h); ctx.stroke();
    }
    // the pinch: a stuck claw is squeezed by the ring wall it crossed
    if (C.ph === 'stuck' && C.ri >= 0 && sim.rings[C.ri]) {
      const r = sim.rings[C.ri].r, x = r * Math.cos(C.th), y = r * Math.sin(C.th), tg = C.th + Math.PI / 2;
      ctx.strokeStyle = KCP.warn; ctx.lineWidth = Math.max(0.035, 2.2 / k);
      for (const sd of [-1, 1]) for (let j = 0; j < 3; j++) {
        const o = 0.17 + j * 0.045, rr = (j - 1) * 0.07;
        ctx.beginPath(); ctx.moveTo(x + Math.cos(tg) * o * sd + Math.cos(C.th) * rr, y + Math.sin(tg) * o * sd + Math.sin(C.th) * rr);
        ctx.lineTo(x + Math.cos(tg) * (o + 0.09) * sd + Math.cos(C.th) * rr * 1.4, y + Math.sin(tg) * (o + 0.09) * sd + Math.sin(C.th) * rr * 1.4); ctx.stroke();
      }
    }
    ctx.restore();
  }
  const held = !!C.eid;
  pxSpace(ctx, tip.x, tip.y, k, () => {
    ctx.rotate(-A.dir);
    ctx.globalAlpha *= C.ph === 'warp' ? clamp(C.t / 1.1, 0, 1) : 1;
    drawClawHead(ctx, k, t, ice ? 0.3 : clawOpen(C, t), part === 'front' ? 'front' : held ? 'back' : 'all', { flash: C.ph === 'hurt' ? 1 : 0, ice });
    if (ice && part !== 'front') iceShards(ctx, k, -0.2 * k, 0, 0.32 * k, C.id * 3 + 1);
    if (C.ph === 'bonk' && part !== 'front') dizzyStars(ctx, -0.2 * k, 0, 0.3 * k, 0.1 * k, t, { n: 3, size: Math.max(4, k * 0.1), tilt: 0 });
  });
  return A;
}
// the telegraph: chevrons on the outer ring gap it is about to come through, a reticle on the egg it wants
function drawAimMark(ctx, sim, C, t, k) {
  const R = sim.outerR, th = C.goal ?? C.th, w = C.warn, lock = w >= 0.7;
  ctx.save();
  ctx.lineJoin = 'round';
  for (let i = 0; i < 2; i++) {
    const r = R - 0.3 - i * 0.24 - ((t * 2.5) % 1) * 0.1;
    ctx.save(); ctx.translate(r * Math.cos(th), r * Math.sin(th)); ctx.rotate(th + Math.PI / 2);
    ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(t * (6 + 10 * w)));
    ctx.beginPath(); ctx.moveTo(-0.2, 0.06); ctx.lineTo(0, -0.12); ctx.lineTo(0.2, 0.06); ctx.lineTo(0, -0.03); ctx.closePath();
    ctx.fillStyle = lock ? KCP.warn : '#ff9a3d'; ctx.fill(); ctx.lineWidth = Math.max(0.03, 1.6 / k); ctx.strokeStyle = KCP.line; ctx.stroke();
    ctx.restore();
  }
  const e = C.tgt ? sim.eggs.find((q) => q.id === C.tgt && q.alive) : null;
  if (e) {
    const p = e.body.getPosition(), r = 0.42 + (1 - w) * 0.25, rot = t * 2;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = Math.max(0.04, 2.6 / k);
    for (const [col, wd] of [[KCP.line, 2.2], [lock ? KCP.warn : '#ff9a3d', 1]]) {
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.04, 2.6 / k) * wd;
      for (let i = 0; i < 4; i++) { const a = rot + (i * TAU) / 4; ctx.beginPath(); ctx.arc(p.x, p.y, r, a + 0.25, a + TAU / 4 - 0.25); ctx.stroke(); }
    }
  }
  ctx.restore();
}
// the sand mound it sits on
function drawSeaFloor(ctx, sim, K, k) {
  const f = flipOf(sim), y = K.by - 0.4 * KC_BODY * f, x = K.bx;
  ctx.save();
  ctx.beginPath(); ctx.ellipse(x, y - 0.3 * f, 3.5, 0.7, 0, 0, TAU);
  ctx.fillStyle = KCP.sandLo; ctx.fill();
  ctx.beginPath(); ctx.ellipse(x, y - 0.22 * f, 3.25, 0.55, 0, 0, TAU);
  ctx.fillStyle = KCP.sand; ctx.fill(); ctx.lineWidth = Math.max(0.03, 1.4 / k); ctx.strokeStyle = '#5a4020'; ctx.stroke();
  ctx.restore();
}
export function kcLook(sim, K) {
  const aim = K.claws.find((C) => C.ph === 'aim' || C.ph === 'reach' || C.ph === 'sweep');
  let tgt = aim && aim.tgt ? sim.eggs.find((q) => q.id === aim.tgt && q.alive) : null;
  if (!tgt) { let best = 1e9; for (const e of sim.aliveEggs()) { if (e.hc === 3) continue; const p = e.body.getPosition(), d = Math.hypot(p.x - K.bx, p.y - K.by); if (d < best) { best = d; tgt = e; } } }
  if (!tgt) return { x: 0, y: -1 };
  const p = tgt.body.getPosition(), f = flipOf(sim), dx = (p.x - K.bx) * f, dy = -(p.y - K.by) * f, n = Math.hypot(dx, dy) || 1;
  return { x: dx / n, y: dy / n };
}
// crisp ice crystals stuck on a frozen part (local px): dark-outlined, two-tone, no glow
export function iceShards(ctx, k, cx, cy, r, seed) {
  const lw = Math.max(1, k * 0.025);
  for (let i = 0; i < 5; i++) {
    const h = Math.sin((seed + i) * 91.7) * 43758.5453, q = h - Math.floor(h), a = i * 1.3 + seed, d = r * (0.35 + 0.6 * q);
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.6, L = k * (0.1 + 0.08 * q), w = L * 0.32, rot = a + 0.4;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.beginPath(); ctx.moveTo(0, -L); ctx.lineTo(w, 0); ctx.lineTo(0, L * 0.5); ctx.lineTo(-w, 0); ctx.closePath();
    fillStroke(ctx, '#bfe8fa', '#12324a', lw);
    ctx.beginPath(); ctx.moveTo(0, -L); ctx.lineTo(w, 0); ctx.lineTo(0, L * 0.5); ctx.closePath(); ctx.fillStyle = '#7cc0e4'; ctx.fill();
    ctx.restore();
  }
}
// before the eggs: the sea floor, the body, both arms and claws, the telegraph marks
export function drawKingCrab(ctx, sim, t, k) {
  const K = sim.kc;
  if (!K) return;
  const B = sim.bx && sim.bx.boss, A = B && B.atk;
  const ice = K.fz > 0 || K.claws.some((C) => C.fz > 0);
  const R = RA.get(sim) || { legs: 0, x: K.bx, t, hold: t }; RA.set(sim, R);
  if (!ice) R.hold = t; // a frozen crab holds its pose
  const th = ice ? R.hold : t;
  R.legs += Math.abs(K.bx - R.x) * 9; R.x = K.bx;
  const stuck = K.claws.some((C) => C.ph === 'stuck'), hurt = (B && B.flinch > 0) || K.claws.some((C) => C.ph === 'hurt');
  const silt = A && A.name === 'silt', stamp = silt && !ice ? (A.ph === 'warn' ? Math.abs(Math.sin(t * 9)) * sstep(1 - A.t / A.dur) : 0) : 0;
  const eye = K.done ? 'x' : ice ? 'normal' : B && B.dizzy > 0 ? 'spiral' : hurt ? 'x' : stuck ? 'squeeze' : A && A.ph === 'warn' ? 'mad' : 'normal';
  const alpha = K.done ? clamp(1 - (K.sink - 1.2) / 1.0, 0, 1) : 1;
  if (alpha <= 0) return;
  const f = flipOf(sim);
  ctx.save();
  ctx.globalAlpha *= alpha;
  drawSeaFloor(ctx, sim, K, k);
  pxSpace(ctx, K.bx, K.by, k, () => {
    if (f < 0) ctx.rotate(Math.PI);
    const bs = k * KC_BODY;
    drawCrabBody(ctx, bs, th, { look: kcLook(sim, K), eye, flash: hurt && !ice ? 1 : 0, stamp, legs: R.legs, sweat: stuck && !ice, mouth: silt || hurt ? 1 : 0.3 + 0.2 * Math.sin(th * 2), ice });
    if (ice) iceShards(ctx, bs, 0, -0.15 * bs, 0.9 * bs, 7);
    if (B && B.dizzy > 0 && !ice) dizzyStars(ctx, 0, -0.95 * bs, 0.45 * bs, 0.12 * bs, t, { n: 4, size: Math.max(5, bs * 0.13) });
  });
  for (const C of K.claws) drawArm(ctx, sim, K, C, C.fz > 0 ? th : t, k, 'back', C.fz > 0 || K.fz > 0);
  if (!K.done) for (const C of K.claws) if (C.ph === 'aim') drawAimMark(ctx, sim, C, t, k);
  ctx.restore();
  // a stuck claw: a bouncing arrow says "hit me"
  if (!K.done) for (const C of K.claws) {
    if (C.ph !== 'stuck') continue;
    const r = C.d + 0.75 + Math.abs(Math.sin(t * 6)) * 0.18, x = r * Math.cos(C.th), y = r * Math.sin(C.th);
    ctx.save(); ctx.translate(x, y); ctx.rotate(C.th + Math.PI / 2 + Math.PI); // its point toward the claw
    ctx.beginPath(); ctx.moveTo(-0.16, -0.02); ctx.lineTo(0, -0.2); ctx.lineTo(0.16, -0.02); ctx.lineTo(0.06, -0.02); ctx.lineTo(0.06, 0.14); ctx.lineTo(-0.06, 0.14); ctx.lineTo(-0.06, -0.02); ctx.closePath();
    ctx.fillStyle = '#ffd93b'; ctx.fill(); ctx.lineWidth = Math.max(0.03, 1.5 / k); ctx.strokeStyle = '#6b3d05'; ctx.stroke();
    ctx.restore();
  }
  // a zapped claw crackles
  for (const C of K.claws) {
    if (!(C.zp > 0)) continue;
    const A2 = armPath(sim, K, C, t), p = A2.tip;
    ctx.save(); ctx.beginPath();
    for (let i = 0; i < 4; i++) { const a = i * 1.7 + t * 30, r = 0.25 + 0.1 * Math.sin(t * 50 + i); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(a) * r * 0.5 + 0.05, p.y + Math.sin(a) * r * 0.5); ctx.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r); }
    boltStroke(ctx, Math.max(0.012, 0.8 / k), clamp(C.zp / 0.3, 0, 1));
    ctx.restore();
  }
}
// after the eggs: the fixed finger closes over an egg a claw holds
export function drawKingOver(ctx, sim, t, k) {
  const K = sim.kc;
  if (!K || K.done) return;
  for (const C of K.claws) if (C.eid) drawArm(ctx, sim, K, C, t, k, 'front');
}

// ---------------------------------------------------------------- boss bar: one pip per shell it has left
export function drawKingBar(ctx, ui, sim, B, bx, bw, y, by, bh, h, gap, t) {
  const K = sim.kc, u = ui.u, n = Math.max(1, K.hpMax), sw = (bw - gap * (n - 1)) / n;
  const stuck = K.claws.some((C) => C.ph === 'stuck'), held = K.claws.some((C) => C.eid), warn = B.atk && B.atk.ph === 'warn';
  for (let i = 0; i < n; i++) {
    const sx = bx + i * (sw + gap);
    ui.roundRect(sx, by, sw, bh, bh / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fill();
    if (i < K.hp) {
      ui.roundRect(sx, by, sw, bh, bh / 2);
      ctx.fillStyle = stuck ? (Math.floor(t * 6) % 2 ? '#ffd63c' : '#ffb03c') : warn ? '#ff6a3d' : '#ff9a3d';
      ctx.fill();
    }
  }
  const label = K.hp <= 0 || K.done ? 'DEFEATED!' : stuck ? 'STUCK! HIT IT' : held ? 'GRABBED AN EGG!'
    : warn ? (ATTACK_NAME[B.atk.name] || '').toUpperCase() + '!' : 'PINCH A CLAW!';
  ui.text(label, bx + bw / 2, y + h / 2, { size: 12 * u, align: 'center', maxW: bw - 8 * u, color: '#fff', stroke: 'rgba(0,0,0,0.75)', tag: 'hud:bossPhase' });
}

// ---------------------------------------------------------------- the boss-bar emblem (chip of radius r at 0,0)
export function drawKingEmblem(ctx, r, t) {
  ctx.save();
  ctx.translate(0, r * 0.42);
  const s = r * 0.95;
  for (const sd of [-1, 1]) { // two claws raised beside its face
    ctx.save(); ctx.translate(sd * r * 0.62, -r * 0.62); ctx.rotate(-Math.PI / 2 - sd * 0.35); ctx.scale(1, sd);
    drawClawHead(ctx, s * 0.95, t, 0.55 + 0.15 * Math.sin(t * 3), 'all');
    ctx.restore();
  }
  drawCrabBody(ctx, s, t, { look: { x: 0, y: 0.3 }, eye: 'mad', mouth: 0.4 });
  ctx.restore();
}

// ---------------------------------------------------------------- the boss card (screen space, y down)
// The same frame as the painted cards: a deep reef backdrop with light from the surface, the King Crab on the sand with
// its claws up, and an egg it has its eye on. Code-drawn: the same crab as in the level.
export function drawKingCard(ctx, x, y, w, h, t, age) {
  const H0 = Math.min(h, w * 2.06), W0 = H0 / 2.06, pad = Math.max(2, H0 * 0.025);
  const e = age == null ? 1 : Math.min(1, Math.max(0, age / 0.45));
  const pop = e < 1 ? 0.6 + 0.4 * (1 - Math.pow(1 - e, 3)) + Math.sin(e * Math.PI) * 0.08 : 1;
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
  g.addColorStop(0, '#2a8fc0'); g.addColorStop(0.55, '#145a86'); g.addColorStop(1, '#0b3354');
  ctx.fillStyle = g; ctx.fillRect(cx - dw / 2, cy - dh / 2, dw, dh);
  // light from the surface: soft shafts, darker blue between (no pale glow)
  ctx.fillStyle = 'rgba(120,210,240,0.16)';
  for (let i = 0; i < 3; i++) { const sx = cx - dw * 0.35 + i * dw * 0.32 + Math.sin(t * 0.4 + i) * dw * 0.02; ctx.beginPath(); ctx.moveTo(sx, cy - dh / 2); ctx.lineTo(sx + dw * 0.1, cy - dh / 2); ctx.lineTo(sx + dw * 0.26, cy + dh * 0.3); ctx.lineTo(sx + dw * 0.08, cy + dh * 0.3); ctx.closePath(); ctx.fill(); }
  // coral on the sides
  const fy = cy + dh * 0.28;
  const coral = (bx, sc, col, lo) => {
    ctx.save(); ctx.translate(bx, fy); ctx.lineCap = 'round';
    const br = (x0, y0, a, L, d) => { if (d > 3) return; const x1 = x0 + Math.cos(a) * L, y1 = y0 + Math.sin(a) * L; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.strokeStyle = '#3a0e1c'; ctx.lineWidth = sc * (0.11 - d * 0.02) + 2.2; ctx.stroke(); ctx.strokeStyle = d % 2 ? lo : col; ctx.lineWidth = sc * (0.11 - d * 0.02); ctx.stroke(); br(x1, y1, a - 0.45, L * 0.72, d + 1); br(x1, y1, a + 0.4, L * 0.68, d + 1); };
    br(0, 0, -Math.PI / 2, sc * 0.32, 0);
    ctx.restore();
  };
  coral(cx - dw * 0.4, dw * 0.55, '#ff7a8a', '#d0485e');
  coral(cx + dw * 0.43, dw * 0.45, '#ffa04a', '#d06a20');
  // rising bubbles
  ctx.lineWidth = Math.max(1, dw * 0.008); ctx.strokeStyle = '#a8e4ff';
  for (let i = 0; i < 6; i++) { const q = (t * 0.25 + i / 6) % 1, bx = cx - dw * 0.3 + ((i * 37) % 60) / 100 * dw, by = cy + dh * 0.3 - q * dh * 0.75; ctx.globalAlpha = 1 - q; ctx.beginPath(); ctx.arc(bx + Math.sin(q * 8 + i) * dw * 0.02, by, dw * (0.012 + 0.01 * (i % 3)), 0, TAU); ctx.stroke(); }
  ctx.globalAlpha = 1;
  // the sand
  ctx.fillStyle = KCP.sand; ctx.beginPath(); ctx.moveTo(cx - dw / 2, fy); ctx.quadraticCurveTo(cx, fy - dh * 0.05, cx + dw / 2, fy); ctx.lineTo(cx + dw / 2, cy + dh / 2); ctx.lineTo(cx - dw / 2, cy + dh / 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = KCP.sandLo; ctx.fillRect(cx - dw / 2, fy + dh * 0.06, dw, dh);
  ctx.strokeStyle = '#3a2a10'; ctx.lineWidth = Math.max(1, dw * 0.01); ctx.beginPath(); ctx.moveTo(cx - dw / 2, fy); ctx.quadraticCurveTo(cx, fy - dh * 0.05, cx + dw / 2, fy); ctx.stroke();
  // the crab: claws up (one of them holding the egg it stole)
  const s = dw * 0.4, by = fy - s * 0.42;
  for (const sd of [-1, 1]) {
    const shx = cx + sd * 0.72 * s, shy = by - 0.1 * s, ex = cx + sd * 1.12 * s, ey = by - 0.8 * s, hx = cx + sd * 0.86 * s, hy = by - 1.6 * s;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(shx, shy); ctx.lineTo(ex, ey); ctx.lineTo(hx, hy);
    ctx.strokeStyle = KCA.line; ctx.lineWidth = s * 0.24; ctx.stroke(); ctx.strokeStyle = KCA.lo; ctx.lineWidth = s * 0.18; ctx.stroke(); ctx.strokeStyle = KCA.shell; ctx.lineWidth = s * 0.08; ctx.stroke();
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(-Math.PI / 2 - sd * 0.25); ctx.scale(1, sd);
    if (sd > 0) {
      drawClawHead(ctx, s, t, 0.12, 'back');
      ctx.save(); ctx.translate(0.2 * s, 0); ctx.rotate(Math.PI / 2 * sd); eggIcon(ctx, 0, 0, s * 0.5, t); ctx.restore();
      drawClawHead(ctx, s, t, 0.12, 'front');
    } else drawClawHead(ctx, s, t, 0.6 + 0.2 * Math.sin(t * 3), 'all');
    ctx.restore();
  }
  ctx.save(); ctx.translate(cx, by); drawCrabBody(ctx, s, t, { look: { x: 0.2, y: 0.4 }, eye: 'mad', mouth: 0.4, legs: t * 0.5 }); ctx.restore();
  ctx.restore();
  ctx.restore();
  return true;
}
function eggIcon(ctx, x, y, h, t) {
  const w = h * 0.75;
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 2) * 0.05);
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) { const a = (i / 24) * TAU, s2 = Math.sin(a); ctx.lineTo((w / 2) * Math.cos(a) * (1 + 0.13 * s2), (h / 2) * s2); }
  ctx.closePath();
  ctx.fillStyle = '#fbf3e0'; ctx.fill(); ctx.lineWidth = Math.max(1, h * 0.06); ctx.strokeStyle = '#3a2410'; ctx.stroke();
  ctx.fillStyle = '#e6d4b0'; ctx.beginPath(); ctx.ellipse(w * 0.12, h * 0.16, w * 0.26, h * 0.22, 0, 0, TAU); ctx.fill();
  ctx.restore();
}
void KC; void wrapA;
