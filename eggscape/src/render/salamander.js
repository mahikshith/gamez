// The lava salamander: one species of the crawler rig (see crawlers.js for the options).
// drawSalamander(ctx, x, y, s, t, opts): snout at (x, y), s = snout-to-hips px (in game: 1.8 m * k).
// Poses: 'walk' | 'idle' | 'hiss' | 'breath' | 'dazed' | 'flee' | 'cool'.
//
// In game (v3.2): drawSalHeat() paints the red-hot ring sections and the breath's target mark (after the rings,
// under the eggs); drawSalamanders() draws each creature from the sim's trail (sim/salamander.js), with the leg
// cycle pinned to the distance it walked (C.odo), so planted feet stay put, and ride along when its ring turns.
// ctx is in world space (meters, y up) for both.
import { drawCrawler, crawlerAnim } from './crawlers.js';
import { drawVenom } from './v3art.js';
import { RING_TH, TAU } from '../sim/geom.js';
import { SAL } from '../sim/salamander.js';

export const drawSalamander = (ctx, x, y, s, t, opts) => drawCrawler(ctx, x, y, s, t, opts, 'salamander');
export const salamanderAnim = crawlerAnim;
export const SALAMANDER_LEN = 1.96; // snout to tail tip, in units of s

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const pxSpace = (ctx, x, y, k, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(1 / k, -1 / k); try { f(); } catch (e) { /* art never breaks the frame */ } ctx.restore(); };

// ---------- red-hot sections and the breath's target mark
export function drawSalHeat(ctx, sim, k, t) {
  if (!sim.sals || !sim.sals.length) return;
  // the target: a dashed ember arc on the wall that grows hotter through the telegraph
  for (const C of sim.sals) {
    const warn = C.ph === 'warn' ? clamp(1 - C.t / C.dur, 0, 1) : C.ph === 'fire' ? 1 : -1;
    if (warn < 0) continue;
    const T = sim.salTarget(C), ring = sim.rings[T.ri], half = (SAL.hotLen * C.size) / (2 * ring.r), pulse = 0.5 + 0.5 * Math.sin(t * (10 + 14 * warn));
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(255,110,30,${0.25 + 0.35 * warn * pulse})`;
    ctx.lineWidth = RING_TH * (1.6 + 0.8 * warn);
    ctx.beginPath(); ctx.arc(0, 0, ring.r, T.a - half, T.a + half); ctx.stroke();
    ctx.setLineDash([0.12, 0.09]);
    ctx.lineDashOffset = -t * 0.6;
    ctx.strokeStyle = `rgba(255,${200 - 80 * warn},80,${0.65 + 0.35 * warn})`;
    ctx.lineWidth = 0.045;
    for (const dr of [-1, 1]) { ctx.beginPath(); ctx.arc(0, 0, ring.r + dr * (RING_TH / 2 + 0.05), T.a - half, T.a + half); ctx.stroke(); }
    ctx.restore();
  }
  // hot sections: a glowing arc over the ring (runs of hot segments), brightest just after the breath
  for (const ring of sim.rings) {
    const ra = ring.body.getAngle();
    let run = null;
    const runs = [];
    for (const sg of ring.segs) {
      if (sg.hot > 0 && sg.alive) {
        if (run && Math.abs(run.a1 - sg.a0) < 1e-4 && run.k === sg.hotK) { run.a1 = sg.a1; run.h = Math.max(run.h, sg.hot); }
        else runs.push((run = { a0: sg.a0, a1: sg.a1, h: sg.hot, k: sg.hotK }));
      } else run = null;
    }
    for (const R of runs) {
      const f = Math.min(1, R.h / 0.9), fresh = clamp((R.h - (SAL.hotT - 0.4)) / 0.4, 0, 1), a0 = ra + R.a0, a1 = ra + R.a1;
      ctx.save();
      ctx.lineCap = 'butt';
      ctx.strokeStyle = `rgba(255,60,10,${0.35 * f})`;
      ctx.lineWidth = RING_TH * 2.4;
      ctx.beginPath(); ctx.arc(0, 0, ring.r, a0, a1); ctx.stroke();
      ctx.strokeStyle = `rgba(255,${110 + 50 * Math.sin(t * 9 + R.k)},30,${0.95 * f})`;
      ctx.lineWidth = RING_TH * 1.05;
      ctx.beginPath(); ctx.arc(0, 0, ring.r, a0, a1); ctx.stroke();
      ctx.strokeStyle = `rgba(255,240,170,${(0.55 + 0.45 * fresh) * f})`;
      ctx.lineWidth = RING_TH * 0.32;
      const m = (a1 - a0) * 0.12;
      ctx.beginPath(); ctx.arc(0, 0, ring.r, a0 + m, a1 - m); ctx.stroke();
      // rising embers
      const n = Math.max(2, Math.round(((a1 - a0) * ring.r) / 0.25));
      ctx.fillStyle = `rgba(255,190,80,${0.8 * f})`;
      for (let i = 0; i < n; i++) {
        const u = (t * 0.9 + i * 0.37 + R.k * 0.13) % 1, a = a0 + ((i + 0.5) / n) * (a1 - a0), rr = ring.r + (i % 2 ? 1 : -1) * (RING_TH / 2 + 0.05 + 0.3 * u);
        ctx.beginPath(); ctx.arc(rr * Math.cos(a), rr * Math.sin(a), 0.035 * (1 - u) + 0.01, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  }
}

// ---------- the creatures
export const salAnim = new Map(); // id -> per-creature render state (pose blender, eased looks, last feet); reset with a new sim
const ANIM = salAnim;
function pathOf(C, k) {
  // the trail in px (y down), lightly smoothed so corners at a gap read as a bend
  let P = C.pts.map((q) => ({ x: q.x * k, y: -q.y * k }));
  for (let pass = 0; pass < 2; pass++) {
    const Q = P.slice();
    for (let i = 2; i < P.length - 1; i++) Q[i] = { x: (P[i - 1].x + 2 * P[i].x + P[i + 1].x) / 4, y: (P[i - 1].y + 2 * P[i].y + P[i + 1].y) / 4 };
    P = Q;
  }
  const n = P.length, A = new Float64Array(n);
  for (let i = 1; i < n; i++) A[i] = A[i - 1] + Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y);
  const at = (d) => {
    if (d <= 0) { const dx = P[0].x - P[1].x, dy = P[0].y - P[1].y, l = Math.hypot(dx, dy) || 1; return { x: P[0].x - (dx / l) * d, y: P[0].y - (dy / l) * d }; }
    if (d >= A[n - 1]) { const dx = P[n - 1].x - P[n - 2].x, dy = P[n - 1].y - P[n - 2].y, l = Math.hypot(dx, dy) || 1, e = d - A[n - 1]; return { x: P[n - 1].x + (dx / l) * e, y: P[n - 1].y + (dy / l) * e }; }
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (A[m] <= d) lo = m; else hi = m; }
    const f = (d - A[lo]) / (A[hi] - A[lo] || 1);
    return { x: P[lo].x + (P[hi].x - P[lo].x) * f, y: P[lo].y + (P[hi].y - P[lo].y) * f };
  };
  return { P, at };
}

// pose for the sim phase: { pose, p, ... }
function poseOf(C) {
  const u = C.dur > 0 ? clamp(1 - C.t / C.dur, 0, 1) : 1;
  switch (C.ph) {
    case 'walk': case 'brake': case 'retreat': return { pose: 'walk' };
    case 'warn': return { pose: 'breath', p: 0.42 * u, aimAt: 'target' };
    case 'fire': return { pose: 'breath', p: 0.42 + 0.44 * u, aimAt: 'target' };
    case 'settle': return { pose: 'breath', p: 0.86 + 0.14 * u, aimAt: 'target' };
    case 'hiss': return { pose: 'hiss', p: 0.15 + 0.6 * u };
    case 'rest': return { pose: C.cool > 0 ? 'cool' : 'idle' };
    case 'daze': return { pose: 'dazed' };
    case 'dive': return { pose: 'flee' };
    case 'grin': return { pose: 'idle', grin: 1 };
    case 'in': return { pose: 'idle' };
    case 'rival': {
      const el = C.dur - C.t;
      if (el < 1.3) return { pose: 'hiss', p: 0.12 + 0.6 * (el / 1.3), aimAt: 'snake' };
      if (el < 2.3) return { pose: 'breath', p: 0.3 + 0.55 * ((el - 1.3) / 1.0), aimAt: 'snake', puff: 1 };
      return { pose: 'hiss', p: 0.55 + 0.45 * ((el - 2.3) / 0.7), aimAt: 'snake' };
    }
  }
  return { pose: 'idle' };
}

export function drawSalamanders(ctx, sim, t, k) {
  const after = [];
  for (const C of sim.sals || []) {
    if (C.ph === 'wait' || C.ph === 'gone' || C.pts.length < 3) continue;
    let R = ANIM.get(C.id);
    const fresh = !R || R.sim !== sim || t < R.t - 0.5;
    if (fresh) { R = { sim, A: crawlerAnim(), t, cool: C.cool > 0 ? 1 : 0, lookX: 1, lookY: 0, aim: 0, out: {} }; ANIM.set(C.id, R); }
    const dt = clamp(t - R.t, 0, 0.1);
    R.t = t;
    const W = poseOf(C);
    if (fresh) for (let i = 0; i < 12; i++) R.A.update(0.1, { pose: W.pose, p: W.p, speed: 0 }); // no blend-in on the first frame
    else R.A.update(dt, { pose: W.pose, p: W.p, speed: 0 });
    const B = R.A.st.B;
    const coolT = C.cool > 0.8 ? 1 : C.cool / 0.8;
    R.cool += (coolT - R.cool) * Math.min(1, dt * 4);
    const { P, at } = pathOf(C, k);
    const s = SAL.svl * C.size * k, U = s / 100;
    // aim the head (and the jet) at the target: the breath's spot on the wall, or the rival snake's head
    let aim = 0, fireLen = 44, tgt = null;
    if (W.aimAt === 'target') { const T = sim.salTarget(C); tgt = { x: T.x * k, y: -T.y * k }; }
    else if (W.aimAt === 'snake') { const S = sim.snakes.find((x) => x.id === C.rid) || sim.snakes.find((x) => x.rivalId === C.id && x.rival > 0); if (S && S.pts.length) tgt = { x: S.pts[0].x * k, y: -S.pts[0].y * k }; }
    if (tgt) {
      const hip = at(82 * U), hd = at(13 * U), hb = at(25 * U);
      const fore = 0.22 * B.crouch + 0.26 * Math.sin(Math.PI * clamp(B.rear, 0, 1)) * (1 - B.crouch * 0.5), f = (82 - 13) / 82, c = 1 - f * fore + 0.07 * B.rear * f;
      const hc = { x: hip.x + (hd.x - hip.x) * c, y: hip.y + (hd.y - hip.y) * c };
      const base = Math.atan2(hd.y - hb.y, hd.x - hb.x), want = Math.atan2(tgt.y - hc.y, tgt.x - hc.x);
      aim = clamp(wrapA(want - base), -1.15, 1.15);
      const ha = base + aim, hs = (1.28 + 0.3 * B.rear) * U, m = (16 + 6 * B.mouth) * hs;
      fireLen = clamp(Math.hypot(tgt.x - (hc.x + Math.cos(ha) * m), tgt.y - (hc.y + Math.sin(ha) * m)) / U, 12, 90);
      if (W.puff) fireLen = Math.min(fireLen * 0.55, 26);
    }
    R.aim += (aim - R.aim) * Math.min(1, dt * 10);
    // eyes: toward the target, else ahead
    const lx = tgt ? 1 : 0.85, ly = tgt ? clamp(R.aim, -1, 1) : 0.15 * Math.sin(t * 0.7 + C.id);
    R.lookX += (lx - R.lookX) * Math.min(1, dt * 6); R.lookY += (ly - R.lookY) * Math.min(1, dt * 6);
    const glow = clamp(0.72 + 0.28 * (C.charge || 0) + (C.ph === 'walk' && C.next < 1.2 ? 0.15 * (1 - C.next / 1.2) : 0), 0, 1);
    const alpha = C.ph === 'in' ? sstep(1 - C.t / C.dur) : 1;
    const o = {
      ...R.A.opts(), gait: C.odo * k, trail: at, id: 50 + C.id, glow, cool: R.cool, aim: R.aim, fireLen, look: { x: R.lookX, y: R.lookY }, out: R.out,
    };
    if (W.grin) { o.mouth = 0.32; }
    if (C.ph === 'dive') o.dive = (C.odo - C.hole) * k;
    // boss: the lava rocks come out of its mouth (mouth open, glowing) while it throws
    const BX = sim.bx && sim.bx.boss;
    if (C.boss && BX && BX.atk && (BX.atk.name === 'rock' || BX.atk.name === 'rock2') && C.ph === 'walk') o.mouth = BX.atk.ph === 'warn' ? 0.4 + 0.5 * clamp(1 - BX.atk.t / BX.atk.dur, 0, 1) : 0.9;
    if (C.ph === 'in') { // it climbs out of a lava pool
      const h = P[0];
      pxSpace(ctx, 0, 0, k, () => {
        const g = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, 0.9 * s);
        g.addColorStop(0, `rgba(255,200,80,${0.9 * (1 - alpha * 0.6)})`); g.addColorStop(0.5, `rgba(255,90,20,${0.6 * (1 - alpha * 0.5)})`); g.addColorStop(1, 'rgba(120,20,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(h.x, h.y, 0.9 * s, 0, TAU); ctx.fill();
      });
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    pxSpace(ctx, 0, 0, k, () => drawCrawler(ctx, P[0].x, P[0].y, s, t, o, 'salamander'));
    ctx.restore();
    // a face-off: the snake's venom in flight at it
    if (C.ph === 'rival') {
      const el = C.dur - C.t, S = sim.snakes.find((x) => x.id === C.rid);
      if (S && S.pts.length && el > 1.0 && el < 1.4) after.push(() => {
        const u = (el - 1.0) / 0.4, a = S.pts[0], b = C.pts[0];
        for (let j = 3; j >= 0; j--) {
          const v = Math.max(0, u - j * 0.08), x = a.x + (b.x - a.x) * v, y = a.y + (b.y - a.y) * v + Math.sin(Math.PI * v) * 0.3;
          pxSpace(ctx, x, y, k, () => drawVenom(ctx, 0, 0, 0.1 * k * (1 - j * 0.15), t, j ? 0.6 - j * 0.12 : 1));
        }
      });
    }
  }
  for (const f of after) f();
}
