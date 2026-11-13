// Boss variety moves (sim/bossmoves.js): telegraphs, effects, first-time tips and sounds. Bold on purpose: every mark
// reads at 360 px wide (thick strokes, saturated colours, pulsing), the first King Crab pass was too faint.
// ctx is in world space (meters, y up). drawMovesRings: after the rings (boss.js drawBossRings); drawMovesOver: over the
// eggs (boss.js drawBossOver); movesEvent: from main.js with the shared once/popup/audio api.
import { RING_TH, TAU } from '../sim/geom.js';
import { roofed, roofedWide, MV, wgustBeat } from '../sim/bossmoves.js';
import { isSpriteCalm } from './sprites.js';
import { drawEagle } from './v3art.js';
import { drawThief, thiefPose } from './thieves.js';
import { dizzyStars } from './status.js';
const pxSpace = (ctx, x, y, k, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(1 / k, -1 / k); try { f(); } catch (e) { if (globalThis.__eggDebug) console.error(e); } ctx.restore(); };

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const CRY = { cry: '#c9b5ff', hi: '#ffffff', lo: '#7a5ae0', line: '#1e1240', glow: '#5ff0e0' };
const P = (a, rad, da) => [rad * Math.cos(a + da / rad), rad * Math.sin(a + da / rad)];

// a crystal column standing on the floor ring at ring angle a (world), from radius base inward by h, half-width w
function crystalColumn(ctx, a, base, h, w, grow, lw) {
  const top = base - h * grow;
  const spikes = [[-w, 0.82], [w * 0.15, 1], [w * 0.95, 0.74]];
  for (const [dx, f] of spikes) {
    const r0 = base, r1 = base - h * grow * f, hw = w * 0.62;
    ctx.beginPath();
    ctx.moveTo(...P(a, r0, dx - hw)); ctx.lineTo(...P(a, r1 + hw * 1.4, dx - hw)); ctx.lineTo(...P(a, r1, dx)); ctx.lineTo(...P(a, r1 + hw * 1.4, dx + hw)); ctx.lineTo(...P(a, r0, dx + hw));
    ctx.closePath();
    ctx.fillStyle = CRY.lo; ctx.fill();
    ctx.lineWidth = lw; ctx.strokeStyle = CRY.line; ctx.stroke();
    ctx.beginPath(); // lit face (top-left light)
    ctx.moveTo(...P(a, r0, dx - hw)); ctx.lineTo(...P(a, r1 + hw * 1.4, dx - hw)); ctx.lineTo(...P(a, r1, dx)); ctx.lineTo(...P(a, r0, dx - hw * 0.1));
    ctx.closePath(); ctx.fillStyle = CRY.cry; ctx.fill();
    ctx.beginPath(); ctx.moveTo(...P(a, r0 - 0.06, dx - hw * 0.55)); ctx.lineTo(...P(a, r1 + hw * 1.6, dx - hw * 0.55));
    ctx.lineWidth = lw * 0.8; ctx.strokeStyle = CRY.hi; ctx.stroke();
  }
  void top;
}

export function drawMovesRings(ctx, sim, k, t) {
  SIM = sim;
  const X = sim.bx, B = X && X.boss;
  if (!B) return;
  const A = B.atk, pulse = 0.5 + 0.5 * Math.sin(t * 14), calm = isSpriteCalm();
  // cage crystals (walls of kind 'cage'): tall clusters across the channel, they flicker as they are about to go
  for (const W of X.walls) {
    if (!W.alive || W.kind !== 'cage') continue;
    const ring = sim.rings[W.ri], base = ring.r - RING_TH / 2 + 0.01, a = ring.body.getAngle() + W.la;
    const grow = clamp01((W.max - W.life) / 0.3), fade = W.life < 1 ? 0.55 + 0.45 * Math.sin(t * 30) : 1;
    // stress: how far toward a shear the rings have turned (cracks glow white)
    const st = clamp01(Math.max(Math.abs(ring.body.getAngle() - (W.a0 ?? 0)), Math.abs(sim.rings[W.ri - 1].body.getAngle() - (W.b0 ?? 0))) / MV.shear);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.save(); ctx.globalAlpha *= 0.55; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.1; ctx.beginPath(); ctx.moveTo(...P(a, base, -W.w * 0.75)); ctx.lineTo(...P(a, base - W.h * grow, -W.w * 0.2)); ctx.lineTo(...P(a, base - W.h * grow, W.w * 0.2)); ctx.lineTo(...P(a, base, W.w * 0.75)); ctx.stroke(); ctx.restore(); // a white halo so it pops off the dark board
    crystalColumn(ctx, a, base, W.h, W.w * 0.95, grow, 0.03);
    if (st > 0.15) {
      ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.5 * st})`; ctx.lineWidth = 0.035;
      ctx.beginPath();
      for (let j = 0; j < 3; j++) { const r = base - W.h * (0.25 + 0.25 * j); ctx.moveTo(...P(a, r, -W.w * 0.5)); ctx.lineTo(...P(a, r - 0.08 * st, W.w * 0.1)); ctx.lineTo(...P(a, r + 0.03, W.w * 0.5)); }
      ctx.stroke();
    }
    ctx.restore();
  }
  if (!A || A.ph !== 'warn') return;
  const u = clamp01(1 - A.t / A.dur);
  if (A.name === 'cage') {
    // the cell: a violet band on the channel between the two marks, and at each mark the dashed outline of the
    // crystal that will grow there, filling in, with seed crystals sprouting from the floor
    const ring = sim.rings[A.ri], inner = sim.rings[A.ri - 1], base = ring.r - RING_TH / 2, top = inner.r + RING_TH / 2, ra = ring.body.getAngle();
    const [l0, l1] = A.spots;
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.2 * pulse;
    ctx.fillStyle = '#b49bff';
    ctx.beginPath(); ctx.arc(0, 0, base, ra + l0, ra + l1); ctx.arc(0, 0, top, ra + l1, ra + l0, true); ctx.closePath(); ctx.fill();
    ctx.restore();
    for (const la of A.spots) {
      const a = ra + la, w = 0.15;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(...P(a, base, -w)); ctx.lineTo(...P(a, top, -w)); ctx.lineTo(...P(a, top, w)); ctx.lineTo(...P(a, base, w)); ctx.closePath();
      ctx.globalAlpha = 0.25 + 0.45 * u; ctx.fillStyle = '#8f7bff'; ctx.fill();
      ctx.globalAlpha = 0.75 + 0.25 * pulse; ctx.setLineDash([0.12, 0.08]); ctx.lineDashOffset = -t * 0.8;
      ctx.lineWidth = 0.1; ctx.strokeStyle = '#ffffff'; ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      crystalColumn(ctx, a, base, (base - top) * (0.15 + 0.35 * u), 0.1, 1, 0.025);
      ctx.restore();
    }
  } else if (A.name === 'shards') {
    drawWedge(ctx, sim, A.aw, A.hw, t, u, pulse, calm, false);
  } else if (A.name === 'magma') {
    // the ring heats up: an orange glow that pulses faster and brighter, embers lifting off it
    const ring = sim.rings[A.ri], fq = 6 + 16 * u, pz = 0.5 + 0.5 * Math.sin(t * fq);
    ctx.save();
    ctx.lineCap = 'butt';
    ctx.globalAlpha = 0.35 + 0.45 * pz * (0.4 + 0.6 * u);
    ctx.strokeStyle = '#ff5a14'; ctx.lineWidth = RING_TH + 0.22;
    ctx.beginPath(); ctx.arc(0, 0, ring.r, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.5 + 0.5 * pz;
    ctx.strokeStyle = u > 0.6 ? '#fff0a0' : '#ffb347'; ctx.lineWidth = 0.06;
    ctx.setLineDash([0.18, 0.12]); ctx.lineDashOffset = -t * 1.2;
    ctx.beginPath(); ctx.arc(0, 0, ring.r - RING_TH / 2 - 0.03, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    for (let j = 0; j < 18; j++) {
      const a = (j / 18) * TAU + hash(j) * 0.3, lift = (t * 0.7 + hash(j * 5)) % 1, rr = ring.r - RING_TH / 2 - 0.05 - lift * 0.45;
      ctx.globalAlpha = (1 - lift) * (0.5 + 0.5 * u);
      ctx.fillStyle = j % 2 ? '#ffd23a' : '#ff7a1a';
      ctx.beginPath(); ctx.arc(rr * Math.cos(a), rr * Math.sin(a), 0.05 + 0.03 * (1 - lift), 0, TAU); ctx.fill();
    }
    ctx.restore();
  } else if (A.name === 'whip') {
    // the coiled tail: the ring flashes and a fat flame-coloured arrow sweeps along it the quarter turn it will take;
    // it curls tighter (shorter, then snaps long) as the telegraph runs out
    const ring = sim.rings[A.ring], len = (Math.PI / 2) * (0.35 + 0.65 * u);
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.4 * pulse;
    ctx.strokeStyle = '#ff7a1a'; ctx.lineWidth = RING_TH + 0.12;
    ctx.beginPath(); ctx.arc(0, 0, ring.r, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
    for (const mid of [Math.PI / 2, -Math.PI / 2]) fatArrow(ctx, ring.r + RING_TH / 2 + 0.32, mid, A.dir, len);
    ctx.restore();
  }
}

// a bold curved arrow: dark outline, flame fill, along radius R centred on angle mid, pointing dir (+1 ccw)
function fatArrow(ctx, R, mid, dir, len) {
  const a0 = mid - (dir * len) / 2, a1 = mid + (dir * len) / 2, hw = 0.11;
  const pth = () => {
    ctx.beginPath();
    ctx.arc(0, 0, R + hw, a0, a1, dir < 0);
    const tip = a1 + dir * 0.22, ux = Math.cos(a1), uy = Math.sin(a1);
    ctx.lineTo((R + hw * 2.4) * ux, (R + hw * 2.4) * uy);
    ctx.lineTo(R * Math.cos(tip), R * Math.sin(tip));
    ctx.lineTo((R - hw * 2.4) * ux, (R - hw * 2.4) * uy);
    ctx.arc(0, 0, R - hw, a1, a0, dir > 0);
    ctx.closePath();
  };
  pth(); ctx.lineJoin = 'round'; ctx.lineWidth = 0.09; ctx.strokeStyle = '#3a0d00'; ctx.stroke();
  const g = ctx.createLinearGradient(R * Math.cos(a0), R * Math.sin(a0), R * Math.cos(a1), R * Math.sin(a1));
  g.addColorStop(0, '#c43a14'); g.addColorStop(1, '#ffd23a');
  pth(); ctx.fillStyle = g; ctx.fill();
}

// the shard wedge: a bold dashed sector from the core to past the outer ring; glints fall through it while it is
// marked (sparse), shards pour through it while it rains (dense). Eggs inside without a roof get a red ring.
function drawWedge(ctx, sim, aw, hw, t, u, pulse, calm, raining) {
  const R0 = 0.25, R1 = sim.outerR + 0.45;
  const path = () => { ctx.beginPath(); ctx.arc(0, 0, R1, aw - hw, aw + hw); ctx.arc(0, 0, R0, aw + hw, aw - hw, true); ctx.closePath(); };
  ctx.save();
  path();
  ctx.globalAlpha = raining ? 0.42 : 0.2 + 0.25 * u + 0.1 * pulse;
  ctx.fillStyle = raining ? '#a88cff' : '#8f72ff';
  ctx.fill();
  ctx.globalAlpha = 0.85 + 0.15 * pulse;
  ctx.setLineDash(raining ? [] : [0.16, 0.1]); ctx.lineDashOffset = -t * 0.9;
  ctx.lineWidth = 0.1; ctx.strokeStyle = raining ? '#ffffff' : '#e9e0ff';
  ctx.stroke();
  ctx.setLineDash([]);
  // falling glints / shards, clipped to the wedge
  path(); ctx.clip();
  const x0 = Math.min(0, R1 * Math.cos(aw - hw), R1 * Math.cos(aw + hw)) - 0.3, x1 = Math.max(0, R1 * Math.cos(aw - hw), R1 * Math.cos(aw + hw)) + 0.3;
  const n = raining ? 30 : 14, H = 2 * R1;
  for (let j = 0; j < n; j++) {
    const sp = raining ? 7 + 3 * hash(j) : 2.2 + hash(j);
    const x = x0 + (x1 - x0) * hash(j * 7 + 1), y = R1 - ((t * sp + hash(j * 3) * H) % H);
    ctx.globalAlpha = raining ? 0.95 : 0.6 + 0.4 * u;
    if (raining) { // a falling shard: a long white-violet sliver
      ctx.fillStyle = j % 3 ? '#ece2ff' : '#ffffff';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 0.1, y + 0.45); ctx.lineTo(x, y + 0.75); ctx.lineTo(x - 0.1, y + 0.45); ctx.closePath();
      ctx.strokeStyle = '#2b1670'; ctx.lineWidth = 0.05; ctx.stroke(); ctx.fill();
    } else { // a glint: a four-point star
      const r = 0.16 + 0.06 * Math.sin(t * 9 + j);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.3, y - r * 0.3); ctx.lineTo(x + r, y); ctx.lineTo(x + r * 0.3, y + r * 0.3); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.3, y + r * 0.3); ctx.lineTo(x - r, y); ctx.lineTo(x - r * 0.3, y - r * 0.3); ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
  // exposed eggs: a red warning ring; sheltered ones: a white roof tick over them
  for (const e of sim.aliveEggs()) {
    const p = e.body.getPosition();
    if (Math.abs(Math.atan2(Math.sin(Math.atan2(p.y, p.x) - aw), Math.cos(Math.atan2(p.y, p.x) - aw))) >= hw || sim.channelOf(e) >= sim.rings.length) continue;
    const safe = roofed(sim, p);
    ctx.save();
    ctx.lineWidth = 0.09;
    ctx.strokeStyle = safe ? '#9cff8a' : '#ff4d4d';
    ctx.globalAlpha = safe ? 0.9 : 0.6 + 0.4 * pulse;
    ctx.beginPath(); ctx.arc(p.x, p.y, 0.42, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  void calm;
}

// the eagle's shadow from above: a dark wing silhouette with a pale rim so it reads on a dark storm board
function wingShadow(ctx, x, y, span, head, t) {
  const w = span / 2, flap = 0.12 * Math.sin(t * 7);
  ctx.save();
  ctx.translate(x, y); ctx.rotate(head);
  const f = 1 + flap, side = (q) => [
    [w * 0.3, q * w * 0.1], [w * 0.22, q * w * 0.45 * f], [w * 0.05, q * w * 0.95 * f], [-w * 0.08, q * w * 1.0 * f], // leading edge to the tip
    [-w * 0.18, q * w * 0.82 * f], [-w * 0.3, q * w * 0.7 * f], [-w * 0.34, q * w * 0.5 * f], [-w * 0.3, q * w * 0.18], // feathered trailing edge
    [-w * 0.55, q * w * 0.2], [-w * 0.68, q * w * 0.08], // tail fan
  ];
  const L = side(1), R = side(-1).reverse();
  ctx.beginPath();
  ctx.moveTo(w * 0.62, 0); // beak
  ctx.lineTo(w * 0.42, w * 0.08);
  for (const q of L) ctx.lineTo(q[0], q[1]);
  ctx.lineTo(-w * 0.62, 0);
  for (const q of R) ctx.lineTo(q[0], q[1]);
  ctx.lineTo(w * 0.42, -w * 0.08);
  ctx.closePath();
  ctx.fillStyle = 'rgba(6,10,26,0.82)'; ctx.fill();
  ctx.lineJoin = 'round'; ctx.lineWidth = 0.05; ctx.strokeStyle = 'rgba(200,230,255,0.85)'; ctx.stroke();
  ctx.restore();
}

export function drawMovesOver(ctx, sim, k, t) {
  const B = sim.bx && sim.bx.boss, mv = B && B.mv;
  if (!mv) return;
  const pulse = 0.5 + 0.5 * Math.sin(t * 14);
  if (mv.rain) drawWedge(ctx, sim, mv.rain.aw, mv.rain.hw, t, 1, pulse, isSpriteCalm(), true);
  const A = B.atk;
  // dive snatch: the shadow circles wide, then shrinks and darkens onto the locked egg; a red/green ring on the egg
  // says whether a wall covers it right now
  if (A && A.name === 'dive' && A.ph === 'warn' && A.x != null) {
    const u = clamp01(1 - A.t / A.dur), orbit = 2.4 * (1 - u) * (1 - u), ang = t * 2.6;
    const x = A.x + Math.cos(ang) * orbit, y = A.y + Math.sin(ang) * orbit * 0.6, safe = roofedWide(sim, { x: A.x, y: A.y });
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.45 * u;
    wingShadow(ctx, x, y, 3.4 - 1.6 * u, ang + Math.PI / 2, t);
    ctx.restore();
    ctx.save();
    ctx.lineWidth = 0.09; ctx.strokeStyle = safe ? '#9cff8a' : '#ff4d4d';
    ctx.globalAlpha = 0.6 + 0.4 * pulse;
    ctx.setLineDash([0.14, 0.09]); ctx.lineDashOffset = -t;
    ctx.beginPath(); ctx.arc(A.x, A.y, 0.5 - 0.12 * u, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    if (!safe) { // crosshair ticks
      ctx.beginPath();
      for (const q of [0, 1, 2, 3]) { const a = q * Math.PI / 2; ctx.moveTo(A.x + Math.cos(a) * 0.55, A.y + Math.sin(a) * 0.55); ctx.lineTo(A.x + Math.cos(a) * 0.8, A.y + Math.sin(a) * 0.8); }
      ctx.stroke();
    }
    ctx.restore();
  }
  // the dive itself (the act beat): the eagle stoops from above onto the spot
  if (A && A.name === 'dive' && A.ph === 'act' && A.x != null) {
    const f = clamp01(1 - A.t / A.dur), y = A.y + 3 * (1 - f) + 0.6;
    pxSpace(ctx, A.x, y, k, () => drawEagle(ctx, 0, 0, 1.25 * k, t, { w: { dive: 1 }, pitch: 1.2, face: A.x > 0 ? -1 : 1 }));
  }
  // carrying an egg up: talons over the egg, wings beating
  if (mv.carry) {
    const K = mv.carry, f = clamp01(K.t / K.dur), s2 = f * f * (3 - 2 * f), x = K.x0 + (K.x1 - K.x0) * s2, y = K.y0 + (K.y1 - K.y0) * s2 + Math.sin(Math.PI * f) * 0.5;
    pxSpace(ctx, x, y + 0.55, k, () => drawEagle(ctx, 0, 0, 1.25 * k, t, { w: { carry: 1 }, phase: t * 14, face: 1, grab: { x: 0, y: 0.5 * k } }));
  }
  // tunnel pop: dirt puffs and a cracking mound mark the spot; then the weasel stands there, popped out of its tunnel
  if (A && A.name === 'pop' && A.ph === 'warn') {
    const u = clamp01(1 - A.t / A.dur), ring = sim.rings[A.ri], rb = ring.r - RING_TH / 2, a = ring.body.getAngle() + A.la;
    const cx = (rb - MV.popR) * Math.cos(a), cy = (rb - MV.popR) * Math.sin(a), ux = -Math.cos(a), uy = -Math.sin(a), tx = -uy, ty = ux;
    ctx.save();
    // the body's outline: where it will stand
    ctx.globalAlpha = 0.6 + 0.4 * pulse; ctx.lineWidth = 0.1; ctx.strokeStyle = '#ffcf3a';
    ctx.setLineDash([0.12, 0.08]); ctx.lineDashOffset = -t;
    ctx.beginPath(); ctx.arc(cx, cy, MV.popR + 0.05, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    // the mound on the floor, swelling
    const fx0 = rb * Math.cos(a), fy0 = rb * Math.sin(a), mh = 0.1 + 0.22 * u;
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.ellipse(fx0, fy0, 0.46, mh, Math.atan2(ty, tx), Math.PI, TAU); ctx.fillStyle = '#6b4a2a'; ctx.fill();
    ctx.lineWidth = 0.035; ctx.strokeStyle = '#2e1c0c'; ctx.stroke();
    // puffs of dirt thrown up from it, more and faster as it gets close
    const n = 16;
    for (let j = 0; j < n; j++) {
      const ph = (t * (1.2 + 1.6 * u) + hash(j)) % 1, side = (hash(j * 3) - 0.5) * 0.6, up = ph * (0.35 + 0.35 * u);
      ctx.globalAlpha = (1 - ph) * (0.6 + 0.4 * u);
      ctx.fillStyle = j % 2 ? '#a07a4a' : '#7a5530';
      ctx.beginPath(); ctx.arc(fx0 + tx * side + ux * up, fy0 + ty * side + uy * up, 0.09 + 0.1 * ph, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  if (mv.pop) {
    const W = mv.pop, ring = sim.rings[W.ri], rb = ring.r - RING_TH / 2, a = ring.body.getAngle() + W.la, el = W.dur - W.t;
    const rise = Math.min(clamp01(el / 0.25), clamp01(W.t / 0.3));
    ctx.save();
    // the tunnel mouth: a dark hole in the floor
    ctx.beginPath(); ctx.ellipse(rb * Math.cos(a), rb * Math.sin(a), 0.34, 0.09, a + Math.PI / 2, 0, TAU); ctx.fillStyle = '#1a0f06'; ctx.fill();
    // clip to the inside of the floor so it comes up out of the hole
    ctx.beginPath(); ctx.arc(0, 0, rb + 0.01, 0, TAU); ctx.clip();
    const fx0 = (rb + 0.55 * (1 - rise)) * Math.cos(a), fy0 = (rb + 0.55 * (1 - rise)) * Math.sin(a);
    pxSpace(ctx, fx0, fy0, k, () => {
      ctx.rotate(Math.atan2(-Math.cos(a), -Math.sin(a)));
      drawThief(ctx, 0, 0, 1.15 * k, t, thiefPose('weasel', 'stand', t), { face: Math.cos(a) > 0 ? -1 : 1, eye: 'normal' }, 'weasel');
    });
    ctx.restore();
  }
  // dizzy after a bonk
  if (B.kind === 'eagle' && mv.bonk && mv.bonk.t > sim.t - MV.diveDizzy) {
    pxSpace(ctx, mv.bonk.x, mv.bonk.y + 0.4, k, () => dizzyStars(ctx, 0, 0, 0.7 * k, 0.25 * k, t, { size: 0.22 * k }));
  }
  // wing gust: bold chevrons along every channel, the way it will blow (they fill in through the telegraph and
  // pulse with each wing beat while it blows)
  const G = mv.wgust, warnG = A && A.name === 'wgust' && A.ph === 'warn';
  if (warnG || G) {
    const dir = G ? G.dir : A.dir, amt = G ? 0.45 + 0.55 * wgustBeat(G) : clamp01(1 - A.t / A.dur);
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (let c = 1; c < sim.rings.length; c++) {
      const r = (sim.rings[c - 1].r + sim.rings[c].r) / 2, n = Math.max(6, Math.round(r * 2.2));
      for (let j = 0; j < n; j++) {
        const a = (j / n) * TAU + dir * t * (G ? 1.6 : 0.5) + c * 0.4, h = 0.2, d = 0.16 * dir;
        const tx = -Math.sin(a), ty = Math.cos(a), rx = Math.cos(a), ry = Math.sin(a), x = r * rx, y = r * ry;
        ctx.globalAlpha = (G ? 0.85 : 0.35 + 0.6 * amt) * (0.6 + 0.4 * hash(j + c * 9));
        ctx.beginPath();
        ctx.moveTo(x - tx * d + rx * h, y - ty * d + ry * h); ctx.lineTo(x + tx * d, y + ty * d); ctx.lineTo(x - tx * d - rx * h, y - ty * d - ry * h);
        ctx.strokeStyle = '#1b2a4a'; ctx.lineWidth = 0.13; ctx.stroke();
        ctx.strokeStyle = G ? '#ffffff' : '#bfe6ff'; ctx.lineWidth = 0.07; ctx.stroke();
      }
    }
    ctx.restore();
  }
}

let SIM = null; // the sim drawn last (popups need a ring radius)
const sim0 = (ev) => (SIM && SIM.rings[ev.ring] ? SIM.rings[ev.ring].r + 0.5 : 2);
// ---------- events: first-time tips, sounds, popups. U: { popup, audio, once }
export function movesEvent(ev, fx, U) {
  const { popup, audio, once } = U;
  switch (ev.type) {
    case 'bossWarn':
      if (ev.attack === 'cage') { audio.play('glass_crack', { vol: 0.6, pitch: 0.7 }); once('mvCage', 'Crystal cage! Crystals will seal the marked egg in. Turn either ring of that channel to shear them off, or roll the egg out first.', 4.4); }
      else if (ev.attack === 'magma') { audio.play('lava_sizzle', { vol: 0.6, pitch: 0.7 }); once('mvMagma', 'Magma ring! The glowing ring turns red-hot. Get your eggs off it in time; its thorns burn away too.', 4.4); }
      else if (ev.attack === 'whip') { audio.play('wind_gust', { vol: 0.5, pitch: 0.6 }); once('mvWhip', 'Tail whip! He will knock the marked ring a quarter turn. Hold that ring as it lands and it barely moves.', 4.4); }
      else if (ev.attack === 'dive') { audio.play('wind_gust', { vol: 0.5, pitch: 1.5 }); once('mvDive', 'Dive snatch! The eagle will carry the marked egg back up a ring. Turn a solid wall over it and the eagle bonks.', 4.4); }
      else if (ev.attack === 'wgust') { audio.play('wind_gust', { vol: 0.6, pitch: 0.8 }); once('mvGust', 'Wing gust! Three wing beats will push every loose egg the way the arrows point. Put a wall end in the way, or ride it to a gap.', 4.4); }
      else if (ev.attack === 'pop') { audio.play('rock_hit', { vol: 0.4, pitch: 1.4 }); once('mvPop', 'Tunnel pop! The weasel will pop up where the dirt flies and block the channel. Roll an egg into him to bonk him!', 4.4); }
      else if (ev.attack === 'shards') { audio.play('glass_crack', { vol: 0.5, pitch: 1.6 }); once('mvShards', 'Shard rain! Shards fall through the marked wedge. Turn a solid wall over your egg, or roll it out of the wedge.', 4.4); }
      break;
    case 'mvCage': if (ev.n) { audio.play('glass_break', { vol: 0.8, pitch: 0.6 }); fx.shake = Math.max(fx.shake, 0.18); } break;
    case 'mvMagma': audio.play('fire_ignite', { vol: 0.8, pitch: 0.6 }); fx.shake = Math.max(fx.shake, 0.15); popup(ev.x, ev.y - 0.2, 'Red-hot!', { color: '#ffb347', size: 20, life: 1 }); break;
    case 'mvMagmaBurn': audio.play('fire_burn', { vol: 0.6 }); break;
    case 'mvWhip': audio.play('steel_clang', { vol: ev.held ? 0.5 : 0.9, pitch: ev.held ? 1.4 : 0.6 }); fx.shake = Math.max(fx.shake, ev.held ? 0.08 : 0.3); popup(0, sim0(ev), ev.held ? 'Held!' : 'Whip!', { color: ev.held ? '#9cff8a' : '#ffb347', size: 20, life: 0.9 }); break;
    case 'mvDiveBonk': audio.play('steel_clang', { vol: 0.8, pitch: 0.7 }); fx.shake = Math.max(fx.shake, 0.25); popup(ev.x, ev.y + 0.3, 'Bonk!', { color: '#fff2a8', size: 22, life: 1 }); break;
    case 'mvDiveGrab': audio.play('wind_gust', { vol: 0.8, pitch: 1.3 }); popup(ev.x, ev.y + 0.5, 'Snatched!', { color: '#ff8a7a', size: 18, life: 0.9 }); break;
    case 'mvGust': audio.play('wind_gust', { vol: 1, pitch: 0.7 }); fx.shake = Math.max(fx.shake, 0.15); break;
    case 'mvPop': audio.play('hen_hop', { vol: 0.7, pitch: 1.5 }); fx.chips(ev.x, ev.y - 0.2, '#8a6236', 10, 2.2); popup(ev.x, ev.y + 0.6, 'Pop!', { color: '#ffd23a', size: 18, life: 0.8 }); break;
    case 'mvPopBonk': audio.play('egg_bump', { vol: 0.9, pitch: 0.8 }); fx.shake = Math.max(fx.shake, 0.2); popup(ev.x, ev.y + 0.7, 'Bonk!', { color: '#fff2a8', size: 22, life: 1 }); break;
    case 'mvPopEnd': if (ev.why === 'down') fx.chips(ev.x, ev.y - 0.2, '#8a6236', 6, 1.5); break;
    case 'mvShards': audio.play('glass_break', { vol: 0.7, pitch: 1.5 }); fx.shake = Math.max(fx.shake, 0.12); break;
    case 'mvShardHit': audio.play('glass_crack', { vol: 0.8, pitch: 1.1 }); popup(ev.x, ev.y + 0.5, 'Shards!', { color: '#d9ccff', size: 18, life: 0.9 }); break;
    case 'wallGone':
      if (ev.kind === 'cage' && ev.how === 'shear') {
        audio.play('star', { vol: 0.7, pitch: 1.5 }); // the chime
        for (let i = 0; i < 12; i++) { const an = (i / 12) * TAU, sp = 2.5 + hash(i) * 3; fx.add({ x: ev.x, y: ev.y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp + 1.5, drag: 2.5, g: 9, life: 0.5 + hash(i + 5) * 0.3, size: 0.07, len: 0.08, color: i % 2 ? '#d9ccff' : '#ffffff', type: 'spark' }); }
        popup(ev.x, ev.y + 0.45, 'Sheared!', { color: '#e9e0ff', size: 18, life: 0.9 });
      }
      break;
  }
}
