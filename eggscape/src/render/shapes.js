// Shaped rings (v3.3 M10): square, hex and spiral rings drawn in the house ring style, and the rocking vault's gauge.
// ctx is in world space (metres, y up). Everything is laid out in the ring's (rad, angle) coordinates and mapped onto
// the shape by ringPt, so a ledge, a corner and the spiral's step all keep the same bands, outline and rim light.
import { RING_TH, TAU, rng } from '../sim/geom.js';
import { ringPt, ringSpd, ringReach, ringNormal, rockAt } from '../sim/shapes.js';

const PAD_H = 0.11;

// Polyline along the ring at radius `rad` from local angle a0 to a1 (ends nudged inside, so a spiral end stays on its
// own side of the step).
function edge(ctx, ring, rad, a0, a1, move) {
  const n = Math.max(2, Math.ceil((Math.abs(a1 - a0) * ringReach(ring)) / 0.035)), e = Math.sign(a1 - a0) * 1e-6;
  for (let i = 0; i <= n; i++) {
    const a = i === 0 ? a0 + e : i === n ? a1 - e : a0 + ((a1 - a0) * i) / n;
    const [x, y] = ringPt(ring, a, rad);
    if (i === 0 && move) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
}
function band(ctx, ring, r0, r1, a0, a1) {
  ctx.beginPath();
  edge(ctx, ring, r1, a0, a1, true);
  edge(ctx, ring, r0, a1, a0, false);
  ctx.closePath();
}
function line(ctx, ring, rad, a0, a1) {
  ctx.beginPath();
  edge(ctx, ring, rad, a0, a1, true);
}
const P = (ring, rad, a) => ringPt(ring, a, rad);

// Contiguous live arcs (a spiral never joins across its seam).
function shapeLiveArcs(ring) {
  const arcs = [], seam = ring.prof.kind === 'spiral';
  let cur = null;
  for (const s of ring.segs) {
    if (!s.alive || s.melt > 0) { cur = null; continue; }
    const cut = seam && Math.abs(s.a0 / TAU - Math.round(s.a0 / TAU)) < 1e-6;
    if (cur && !cut && Math.abs(cur[1] - s.a0) < 1e-4) cur[1] = s.a1;
    else { cur = [s.a0, s.a1]; arcs.push(cur); }
  }
  if (!seam && arcs.length > 1) {
    const f = arcs[0], l = arcs[arcs.length - 1];
    if (Math.abs(l[1] - (f[0] + TAU)) < 1e-4) { f[0] = l[0] - TAU; arcs.pop(); }
  }
  return arcs;
}

// Called from drawRing for a ring with a profile. H: { col, st, thorns() } from world.js.
export function drawShapedRing(ctx, ring, theme, k, t, opts, H) {
  const { col, st } = H, r = ring.r, ri = r - RING_TH / 2, ro = r + RING_TH / 2, px = 1 / k;
  ctx.save();
  ctx.rotate(ring.body.getAngle());
  const arcs = shapeLiveArcs(ring);
  ctx.lineJoin = 'round';
  // dark halo, body, inner shadow band, outer light band
  ctx.strokeStyle = 'rgba(10,6,4,0.45)';
  ctx.lineWidth = RING_TH + 7 * px;
  for (const [a0, a1] of arcs) { line(ctx, ring, r, a0, a1); ctx.stroke(); }
  for (const [a0, a1] of arcs) {
    band(ctx, ring, ri, ro, a0, a1);
    ctx.globalAlpha = st.alpha || 1;
    ctx.fillStyle = col.base;
    ctx.fill();
    band(ctx, ring, ri, ri + RING_TH * 0.28, a0, a1);
    ctx.fillStyle = col.dark;
    ctx.globalAlpha = 0.35;
    ctx.fill();
    band(ctx, ring, ro - RING_TH * 0.22, ro, a0, a1);
    ctx.fillStyle = col.light;
    ctx.globalAlpha = st.shine ? 0.75 : 0.45;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  for (const [a0, a1] of arcs) decorate(ctx, ring, st, col, a0, a1, px, t);
  // outline, rim light
  ctx.strokeStyle = col.dark;
  ctx.lineWidth = Math.max(1.4 * px, 0.016);
  for (const [a0, a1] of arcs) { line(ctx, ring, ro, a0, a1); ctx.stroke(); line(ctx, ring, ri, a0, a1); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,255,255,0.38)';
  ctx.lineWidth = Math.max(1.2 * px, 0.012);
  for (const [a0, a1] of arcs) { line(ctx, ring, ro - 1.5 * px, a0 + 0.01, a1 - 0.01); ctx.stroke(); }
  // charring where fire is working on a piece
  for (const s of ring.segs) {
    if (!s.alive || s.burn <= 0) continue;
    band(ctx, ring, ri, ro, s.a0, s.a1);
    ctx.fillStyle = '#1b0f08';
    ctx.globalAlpha = Math.min(0.85, s.burn * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (ring.motor) motorTeeth(ctx, ring, col, arcs, ro);
  drawShapedPads(ctx, ring, theme, px, t, opts.eggs || [], opts.simT || 0);
  H.thorns();
  if (opts.held || opts.hover) {
    ctx.strokeStyle = opts.held ? '#ffffff' : 'rgba(255,255,255,0.55)';
    ctx.lineWidth = (opts.held ? 3 : 2) * px;
    ctx.setLineDash(opts.held ? [] : [8 * px, 6 * px]);
    for (const [a0, a1] of arcs) { line(ctx, ring, ro + 3 * px, a0, a1); ctx.stroke(); line(ctx, ring, ri - 3 * px, a0, a1); ctx.stroke(); }
    ctx.setLineDash([]);
  }
  ctx.restore();
}

// Material details along an arc (the circle ring's seams, rivets, dots, leaves...) and the end caps.
function decorate(ctx, ring, st, col, a0, a1, px, t) {
  const r = ring.r, ri = r - RING_TH / 2, ro = r + RING_TH / 2, len = (a1 - a0) * ringSpd(ring, (a0 + a1) / 2);
  const at = (i, n, f = 0.5) => a0 + ((a1 - a0) * (i + f)) / n;
  const dot = (rad, a, s) => { const [x, y] = P(ring, rad, a); ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill(); };
  if (st.seam) {
    ctx.strokeStyle = col.dark;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = Math.max(px, 0.014);
    const n = Math.max(1, Math.round(len / st.seam));
    ctx.beginPath();
    for (let i = 1; i < n; i++) { const a = at(i, n, 0); ctx.moveTo(...P(ring, ri, a)); ctx.lineTo(...P(ring, ro, a)); }
    ctx.stroke();
    if (st.grain || st.blocks) {
      ctx.globalAlpha = st.grain ? 0.25 : 0.4;
      line(ctx, ring, r + (st.grain ? 0.012 : 0), a0 + 0.02, a1 - 0.02);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (st.rivets) { ctx.fillStyle = col.dark; const n = Math.max(1, Math.round(len / 0.32)); for (let i = 0; i < n; i++) dot(r, at(i, n), 0.022); }
  if (st.dots) { ctx.fillStyle = '#fff4ea'; const n = Math.max(1, Math.round(len / 0.3)); for (let i = 0; i < n; i++) dot(r + (i % 2 ? 0.025 : -0.02), at(i, n), i % 3 ? 0.028 : 0.04); }
  if (st.puffs) { ctx.fillStyle = col.light; const n = Math.max(1, Math.round(len / 0.22)); for (let i = 0; i < n; i++) dot(ro - 0.02, at(i, n), 0.07 + (i % 3) * 0.015); }
  if (st.bumps) { ctx.fillStyle = col.light; const n = Math.max(1, Math.round(len / 0.2)); for (let i = 0; i < n; i++) dot(r + (((i * 7) % 3) - 1) * 0.035, at(i, n), 0.026); }
  if (st.leaves) {
    const n = Math.max(1, Math.round(len / 0.6));
    ctx.lineWidth = 0.008;
    for (let i = 0; i < n; i++) {
      const a = at(i, n), [x, y] = P(ring, ro - 0.005, a);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ringNormal(ring, a) + Math.PI / 2 + (i % 2 ? 0.25 : -0.25));
      ctx.fillStyle = col.light;
      ctx.beginPath(); ctx.ellipse(0, 0, 0.065, 0.04, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = col.dark;
      ctx.beginPath(); ctx.moveTo(-0.05, 0); ctx.lineTo(0.05, 0); ctx.stroke();
      ctx.restore();
    }
  }
  if (st.veins) {
    ctx.strokeStyle = '#ff7a2a';
    ctx.lineWidth = 0.018;
    ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 2 + r);
    const n = Math.max(1, Math.round(len / 0.5));
    ctx.beginPath();
    for (let i = 0; i < n; i++) { const a = at(i, n, 0.3); ctx.moveTo(...P(ring, ri + 0.03, a)); ctx.lineTo(...P(ring, r, a + 0.06)); ctx.lineTo(...P(ring, ro - 0.03, a + 0.02)); }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // end caps
  ctx.strokeStyle = col.dark;
  ctx.lineWidth = Math.max(1.5 * px, 0.02);
  ctx.lineCap = 'round';
  for (const [a, e] of [[a0, 1e-6], [a1, -1e-6]]) { ctx.beginPath(); ctx.moveTo(...P(ring, ri, a + e)); ctx.lineTo(...P(ring, ro, a + e)); ctx.stroke(); }
}

function motorTeeth(ctx, ring, col, arcs, ro) {
  ctx.fillStyle = col.dark;
  for (const [a0, a1] of arcs) {
    const n = Math.max(1, Math.round(((a1 - a0) * ringSpd(ring, (a0 + a1) / 2)) / 0.22));
    for (let i = 0; i < n; i++) {
      const a = a0 + ((a1 - a0) * (i + 0.5)) / n, w = 0.05 / ringSpd(ring, a);
      ctx.beginPath();
      ctx.moveTo(...P(ring, ro, a - w)); ctx.lineTo(...P(ring, ro + 0.07, a - w * 0.6)); ctx.lineTo(...P(ring, ro + 0.07, a + w * 0.6)); ctx.lineTo(...P(ring, ro, a + w));
      ctx.fill();
    }
  }
}

// Sponge pads along the inner face: the circle ring's foam pillow, laid on the shape (eggs sink into it).
function drawShapedPads(ctx, ring, theme, px, t, eggs, simT) {
  const r = ring.r, ri = r - RING_TH / 2, ro = r + RING_TH / 2 + 0.025, A = ring.body.getAngle();
  const runs = [];
  let cur = null;
  for (const s of ring.segs) {
    if (!s.alive || !s.pad) { cur = null; continue; }
    if (cur && Math.abs(cur.a1 - s.a0) < 1e-4) { cur.a1 = s.a1; cur.segs.push(s); } else runs.push((cur = { a0: s.a0, a1: s.a1, segs: [s] }));
  }
  if (!runs.length) return;
  // eggs resting on the pad, as ring-local points
  const near = eggs.map((e) => ({ x: e.x * Math.cos(-A) - e.y * Math.sin(-A), y: e.x * Math.sin(-A) + e.y * Math.cos(-A) }));
  const base = theme?.palette?.sponge || '#ffd257';
  for (const R of runs) {
    const n = Math.max(6, Math.ceil(((R.a1 - R.a0) * ringReach(ring)) / 0.03)), top = [];
    for (let i = 0; i <= n; i++) {
      const th = R.a0 + ((R.a1 - R.a0) * i) / n, sp = ringSpd(ring, th);
      let h = PAD_H + 0.028 * Math.abs(Math.sin(((th - R.a0) * sp * Math.PI) / 0.24));
      const ed = Math.min(th - R.a0, R.a1 - th) * sp;
      if (ed < 0.1) h *= 0.3 + 0.7 * (ed / 0.1);
      const [sx, sy] = P(ring, ri - 0.27, th);
      for (const q of near) { const d = Math.hypot(q.x - sx, q.y - sy); if (d < 0.3) h -= 0.085 * (1 - d / 0.3) * (1 - d / 0.3); }
      const seg = R.segs[Math.min(R.segs.length - 1, Math.floor(((th - R.a0) / (R.a1 - R.a0)) * R.segs.length))], dt = simT - seg.hitT;
      if (dt >= 0 && dt < 0.6) h += Math.min(0.045, seg.hitV * 0.009) * Math.exp(-dt * 7) * Math.sin(dt * 45 + th * 12);
      top.push([th, ri - Math.max(0.015, h)]);
    }
    ctx.beginPath();
    edge(ctx, ring, ro, R.a0, R.a1, true);
    for (let i = top.length - 1; i >= 0; i--) ctx.lineTo(...P(ring, top[i][1], top[i][0]));
    ctx.closePath();
    ctx.fillStyle = base;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(170,105,20,0.45)';
    const pr = rng(Math.round(R.a0 * 1000) + ring.i * 97), pn = Math.ceil(((R.a1 - R.a0) * ring.r) / 0.025);
    for (let i = 0; i < pn; i++) {
      const th = R.a0 + pr() * (R.a1 - R.a0), [x, y] = P(ring, ro - 0.02 - pr() * (ro - ri + PAD_H - 0.04), th);
      ctx.beginPath(); ctx.ellipse(x, y, 0.008 + pr() * 0.01, 0.006 + pr() * 0.008, th, 0, TAU); ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,248,210,0.9)';
    ctx.lineWidth = Math.max(1.5 * px, 0.014);
    ctx.beginPath();
    top.forEach(([th, rr], i) => (i ? ctx.lineTo(...P(ring, rr + 0.008, th)) : ctx.moveTo(...P(ring, rr + 0.008, th))));
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120,70,10,0.85)';
    ctx.lineWidth = Math.max(1.2 * px, 0.012);
    ctx.beginPath();
    top.forEach(([th, rr], i) => (i ? ctx.lineTo(...P(ring, rr, th)) : ctx.moveTo(...P(ring, rr, th))));
    ctx.stroke();
  }
}

// The rocking vault: a spirit level over the vault shows the lean, and before each swing two chunky arrows round the
// vault pulse the way it is about to lean (fair warning, like the hot glow before thorns spring out).
export function drawRockHud(ctx, sim, k, t) {
  const K = sim.rock;
  if (!K) return;
  const R = rockAt(K, sim.t), px = 1 / k, top = sim.outerR + 0.42;
  // spirit level: a vial that leans with the vault, the bubble runs to the high end
  ctx.save();
  ctx.translate(0, top);
  ctx.rotate(R.a);
  const w = 0.95, h = 0.2;
  ctx.fillStyle = '#5a3a20';
  ctx.strokeStyle = '#1e120a';
  ctx.lineWidth = Math.max(2 * px, 0.02);
  ctx.beginPath(); ctx.roundRect(-w / 2 - 0.08, -h / 2 - 0.06, w + 0.16, h + 0.12, 0.08); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#c8f06a';
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h / 2); ctx.fill();
  ctx.strokeStyle = 'rgba(30,50,10,0.8)';
  ctx.lineWidth = Math.max(1.2 * px, 0.012);
  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-0.1, -h / 2); ctx.lineTo(-0.1, h / 2); ctx.moveTo(0.1, -h / 2); ctx.lineTo(0.1, h / 2); ctx.stroke();
  const bx = Math.max(-1, Math.min(1, -R.a / K.amp)) * (w / 2 - h / 2);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.ellipse(bx, 0, h * 0.62, h * 0.36, 0, 0, TAU); ctx.fill();
  ctx.restore();
  if (!(R.warn > 0) || !R.next) return;
  // warning arrows on both sides, curling the way the vault will turn
  const dir = Math.sign(R.next), pulse = 0.55 + 0.45 * Math.sin(t * 14), rr = sim.outerR + 0.3;
  ctx.save();
  ctx.globalAlpha = Math.min(1, R.warn * 2) * pulse;
  ctx.strokeStyle = '#ff9d2e';
  ctx.fillStyle = '#ff9d2e';
  ctx.lineCap = 'round';
  for (const mid of [0, Math.PI]) {
    const a0 = mid - dir * 0.3, a1 = mid + dir * 0.3;
    ctx.lineWidth = Math.max(0.2, 9 * px);
    ctx.strokeStyle = '#2a1408';
    ctx.beginPath(); ctx.arc(0, 0, rr, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke();
    ctx.lineWidth = Math.max(0.12, 5 * px);
    ctx.strokeStyle = '#ff9d2e';
    ctx.beginPath(); ctx.arc(0, 0, rr, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke();
    const hx = rr * Math.cos(a1), hy = rr * Math.sin(a1), tx = -Math.sin(a1) * dir, ty = Math.cos(a1) * dir, nx = Math.cos(a1), ny = Math.sin(a1), hs = Math.max(0.3, 12 * px);
    ctx.beginPath();
    ctx.moveTo(hx + tx * hs * 1.3, hy + ty * hs * 1.3);
    ctx.lineTo(hx + nx * hs, hy + ny * hs);
    ctx.lineTo(hx - nx * hs, hy - ny * hs);
    ctx.closePath();
    ctx.lineWidth = Math.max(0.04, 2 * px);
    ctx.strokeStyle = '#2a1408';
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
