// Level 20: Duke Quartz (the crystal thorn-back, the golem fight's boss) and his sandy cousin Spike.
// RENDER ONLY. Their bodies are the sim's crawlers (sim/thornback.js, species 'thornback', roles 'duke' and 'spike'): they
// crawl in through gaps of the outer ring and walk the channel floors; the four golem attacks come from the Duke where he
// stands. Everything here is read from the sim and never written back. Modelled on render/gecko15.js.
// drawThorn20: from drawSalamanders (render/salamander.js), under the eggs. drawSpikes: the shed crystals and thorns
// (after the rings, render/boss.js drawBossRings). drawThornOver: attack effects over the eggs (render/boss.js drawBossOver).
import { RING_TH, TAU } from '../sim/geom.js';
import { THORN } from '../sim/thornback.js';
import { SPIKE, spikePt } from '../sim/boss.js';
import { drawCrawler, drawCrawlerThorn } from './crawlers.js';
import { crystalSpike } from './cousins.js';
import { statusClock } from './status.js';
import { hash } from './castkit.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
const lerp = (a, b, k) => a + (b - a) * k;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const CH = ['walk', 'rear', 'crouch', 'mouth', 'swell', 'dazed', 'angry', 'shake', 'splay', 'tongue', 'roll', 'flail'];
const RATE = { walk: 9, rear: 9, crouch: 16, mouth: 14, swell: 9, dazed: 6, angry: 8, shake: 30, splay: 8, tongue: 12, roll: 7, flail: 10 };
// the crystal colours (Duke) and the thorn colours (Spike) for effects drawn here
const CRY = { line: [52, 22, 95], spike: [223, 247, 255], spikeLo: [122, 82, 216], spikeTip: [244, 254, 255], facet: [165, 140, 246], glint: [255, 255, 255] };

export const isCrystal20 = (sim) => !!(sim && sim.level && sim.level.bossFight && sim.level.bossFight.thorn && sim.duke);
const shown = (C) => !!C && C.ph !== 'wait' && C.ph !== 'gone' && C.ph !== 'warp' && C.pts.length > 2;
const svlOf = (C) => C.size * 1.8; // m snout to hips

const ST = new Map(); // per crawler id: the art's own state
function stateOf(sim, C, t) {
  let S = ST.get(C.id);
  if (!S || S.sim !== sim || t < S.t - 0.5) {
    S = { sim, t, C, hx: 0, hy: 0, hd: 0, tr: [], odo: 0, B: {}, look: { x: 0.6, y: 0 }, aim: 0, hop: 0, flick: 0, lunge: 0, hurtT: -9, wasFl: 0, wasDz: 0, beatT: -1, bodo: 0, wide: false, lay: 0, fx: 0 };
    for (const c of CH) S.B[c] = 0;
    ST.set(C.id, S);
  }
  S.C = C;
  return S;
}
function pull(S, C) {
  S.tr = C.pts;
  const h = C.pts[0], q = C.pts[Math.min(C.pts.length - 1, 3)];
  S.hx = h.x; S.hy = h.y;
  if (Math.hypot(h.x - q.x, h.y - q.y) > 1e-4) S.hd = Math.atan2(h.y - q.y, h.x - q.x);
  S.odo = C.odo;
}
function trailAt(S, d) {
  const T = S.tr;
  let px = T[0].x, py = T[0].y, left = d;
  if (left <= 0) return { x: px - Math.cos(S.hd) * left, y: py - Math.sin(S.hd) * left };
  for (let i = 1; i < T.length; i++) {
    const q = T[i], l = Math.hypot(q.x - px, q.y - py);
    if (l >= left && l > 1e-6) { const f = left / l; return { x: px + (q.x - px) * f, y: py + (q.y - py) * f }; }
    left -= l; px = q.x; py = q.y;
  }
  const a = T[T.length - 2] || T[0], dx = px - a.x, dy = py - a.y, l = Math.hypot(dx, dy) || 1;
  return { x: px + (dx / l) * left, y: py + (dy / l) * left };
}
// the trail plus the body's own moves: the hurt hop, the forward lunge (hip-check), the tail swipe (out from the centre)
function bodyAt(S, d) {
  const L = svlOf(S.C), HIP = 0.72 * L, LEN = 1.5 * L;
  const q = trailAt(S, d - (d < HIP ? S.lunge * (1 - d / HIP) : 0)), l = Math.hypot(q.x, q.y) || 1, nx = q.x / l, ny = q.y / l;
  let o = S.hop;
  if (d > HIP && S.flick) { const f = (d - HIP) / (LEN - HIP); o += S.flick * Math.pow(f, 1.4) * 0.85; }
  return { x: q.x + nx * o, y: q.y + ny * o };
}

function step(sim, C, S, dt, t) {
  const B = sim.bx.boss, A = B && B.atk, duke = C.role === 'duke';
  const warn = A && A.ph === 'warn', act = A && A.ph === 'act', u = warn ? clamp(1 - A.t / A.dur, 0, 1) : act ? 1 : 0;
  const W = {}; for (const c of CH) W[c] = 0;
  let look = { x: 0.6, y: 0 }, aim = 0, flick = 0, lunge = 0, lay = -1;
  const flinch = duke && B && B.flinch > 0, dazed = C.ph === 'daze';
  if (flinch && !S.wasFl) S.hurtT = t;
  S.wasFl = flinch;
  const hu = (t - S.hurtT) / 0.55;
  const moving = C.ph === 'walk' || C.ph === 'brake' || C.ph === 'retreat' || C.ph === 'in';
  const ra = Math.atan2(S.hy, S.hx), rr = Math.hypot(S.hx, S.hy);
  const aimAt = (x, y) => clamp(wrap(Math.atan2(y - S.hy, x - S.hx) - S.hd), -1.1, 1.1);
  const outward = (r) => (r > rr ? 1 : -1); // a flick toward a ring of radius r
  const D = duke ? C : sim.duke(), Q = D && D.duel;
  if (sim.state !== 'play' && C.ph === 'grin') { W.rear = 0.4; W.mouth = 0.6; W.angry = 0.8; aim = -0.25; }
  else if (C.ph === 'flip' || C.ph === 'thrown') { W.roll = C.ph === 'thrown' ? sstep((C.dur - C.t) / C.dur) : 1; W.flail = 1; W.dazed = C.ph === 'flip' && C.t < C.dur - 0.4 ? 1 : 0; W.mouth = 0.4; }
  else if (hu >= 0 && hu < 1) { W.shake = 1; W.mouth = 0.9; W.splay = 1; W.crouch = 0.4; look = { x: -0.2, y: 0 }; }
  else if (dazed) { W.dazed = 1; W.splay = 1; W.tongue = 0.6; }
  else if (C.ph === 'gloat') { const g = sstep((C.dur - C.t) / 0.25); W.rear = 0.45 * g; W.angry = 1; W.swell = g; W.mouth = 0.25; aim = -0.35 * g * Math.sign(Math.sin(S.hd - ra) || 1); look = { x: 0.2, y: 0.6 }; }
  else if (C.ph === 'duel' && Q) {
    const el = Q.t, [b1, b2, b3] = THORN.beats, hit = THORN.beatHit, other = (sim.sals || []).find((o) => o.id === (duke ? Q.sid : D.id));
    if (other && other.pts[0]) { aim = aimAt(other.pts[0].x, other.pts[0].y) * 0.7; }
    W.angry = 1; look = { x: 1, y: 0 };
    if (el < b1) { const k = sstep(el / 0.3); W.rear = 0.6 * k; W.shake = 0.6 * k; W.mouth = 0.5 * k; W.swell = k; } // square-up: rear, rattle, growl
    else if (el < b2) { // beat 1: Spike flicks a thorn; the Duke bats it away with his crest
      const f = (el - b1) / (b2 - b1);
      if (duke) { const sw = el > b1 + hit - 0.08 ? Math.sin(Math.PI * clamp((el - b1 - hit + 0.08) / 0.3, 0, 1)) : 0; aim += 0.9 * sw; W.rear = 0.3; W.crouch = 0.3 * (1 - sw); }
      else lay = f < 0.6 ? f / 0.6 : -1, W.crouch = 0.3;
    } else if (el < b3) { // beat 2: the Duke flicks a crystal; Spike ducks
      const f = (el - b2) / (b3 - b2);
      if (duke) lay = f < 0.6 ? f / 0.6 : -1, W.crouch = 0.3;
      else { W.crouch = el > b2 + 0.1 && el < b2 + hit + 0.25 ? 1 : 0.2; W.splay = W.crouch; }
    } else { // beat 3: both tail-swipe; the loser takes it
      const f = clamp((el - b3) / (THORN.duelT - b3), 0, 1), lose = Q.lose === C.id, side = other ? Math.sign(Math.hypot(other.pts[0].x, other.pts[0].y) - rr) || 1 : 1;
      flick = f < 0.35 ? -0.35 * side * sstep(f / 0.35) : side * (1 - 0.6 * sstep((f - 0.5) / 0.5));
      W.rear = 0.2; W.mouth = 0.6;
      if (lose && el > b3 + hit) { W.shake = 1; W.mouth = 1; W.crouch = 0.5; }
    }
  } else if (C.ph === 'hip') { // a shoulder shove: crouch, then lunge at the egg
    const el = C.dur - C.t, e = sim.eggs.find((x) => x.id === C.lk);
    if (e && e.alive && !e.saved) { const p = e.body.getPosition(); aim = aimAt(p.x, p.y) * 0.6; }
    W.crouch = el < THORN.hipAt ? 0.7 * sstep(el / 0.2) : 0.1; lunge = el < THORN.hipAt ? -0.06 : 0.22 * Math.sin(Math.PI * clamp((el - THORN.hipAt + 0.08) / 0.38, 0, 1)); W.angry = 0.7; W.mouth = el > THORN.hipAt ? 0.5 : 0;
  } else if (C.ph === 'drop') { lay = clamp((C.dur - C.t) / C.dur, 0, 1); W.angry = 0.4; }
  else if (C.ph === 'block') { W.angry = 0.8; aim = 0.25 * Math.sin(t * 2.2); look = { x: 1, y: 0 }; W.mouth = 0.15 + 0.15 * Math.sin(t * 5); }
  else if (duke && A && (C.ph === 'atk' || C.ph === 'brake')) {
    if (A.name === 'stomp') { // rear up high, then slam both front feet down
      if (warn) { W.rear = 0.95 * sstep(u / 0.75); W.swell = sstep(u / 0.6); W.mouth = 0.3 * u; W.angry = 1; }
      else { const f = clamp(1 - A.t / A.dur, 0, 1); W.rear = 0; W.crouch = 1 - f * 0.6; W.shake = 1 - f; W.mouth = 0.8; W.angry = 1; }
      look = { x: 1, y: 0 };
    } else if (A.name === 'punch') { // a tail swipe at the ring wall beside him
      const ring = sim.rings[A.ring], side = ring ? outward(ring.r) : 1;
      flick = warn ? (u < 0.6 ? -0.35 * side * sstep(u / 0.6) : -0.35 * side + 0.12 * Math.sin(t * 30) * side) : side * 1.15;
      W.angry = 0.9; W.crouch = warn ? 0.4 : 0; W.mouth = act ? 0.7 : 0.2;
      aim = 0.55 * side * Math.sign(Math.sin(S.hd - ra) || 1) * (warn ? -1 : 0); look = { x: 0.2, y: 0 };
    } else if (A.name === 'cage') { // he presses down: crystals race out from under him to the marked egg
      W.crouch = 0.8; W.angry = 1; W.mouth = 0.5 * u; W.swell = 0.6 * u; W.shake = 0.25;
      const ring = sim.rings[A.ri]; if (ring) { const a = ring.body.getAngle() + (A.spots[0] + A.spots[1]) / 2, rb = ring.r - RING_TH / 2; aim = aimAt(rb * Math.cos(a), rb * Math.sin(a)) * 0.6; }
    } else if (A.name === 'shards') { // he shakes his back: shards leave his spines
      W.shake = warn ? 0.4 + 0.6 * u : 1; W.swell = 1; W.crouch = 0.4; W.angry = 1; W.mouth = 0.4; look = { x: 0.3, y: 0.6 };
    }
  } else if (C.bored > 0 && moving) { look = { x: 0.6, y: 0.4 * Math.sin(t * 2) }; W.angry = 0.2; }
  W.walk = moving ? 1 : 0;
  for (const c of CH) S.B[c] += (W[c] - S.B[c]) * (1 - Math.exp(-dt * RATE[c]));
  S.hop = hu >= 0 && hu < 1 ? 0.12 * Math.sin(Math.PI * Math.min(1, hu * 1.6)) * (hu < 0.625 ? 1 : 0) : 0;
  S.flick += (flick - S.flick) * (1 - Math.exp(-dt * 24));
  S.lunge += (lunge - S.lunge) * (1 - Math.exp(-dt * 22));
  S.aim += (aim - S.aim) * (1 - Math.exp(-dt * 9));
  S.look.x += (look.x - S.look.x) * Math.min(1, dt * 7); S.look.y += (look.y - S.look.y) * Math.min(1, dt * 7);
  S.lay = lay;
  S.wide = hu >= 0 && hu < 1;
}
// beaten (the level is won): he goes limp, then trundles off along the channel and is gone in a glitter of dust
function beaten(S, dt, t) {
  if (S.beatT < 0) { S.beatT = t; S.hurtT = t; S.bodo = S.odo; }
  const el = t - S.beatT;
  for (const c of CH) S.B[c] += ((c === 'dazed' || c === 'splay' ? (el < 1.0 ? 1 : 0) : c === 'walk' ? (el >= 1.0 ? 1 : 0) : c === 'mouth' ? 0.5 : c === 'shake' ? (el < 0.4 ? 1 : 0) : 0) - S.B[c]) * (1 - Math.exp(-dt * 9));
  if (el >= 1.0) { S.bodo += 2.2 * dt; S.odo = S.bodo; S.lunge = -(S.bodo - (S.bodo0 ?? (S.bodo0 = S.bodo))); }
  S.hop = 0; S.flick *= 0.9; S.lay = -1; S.wide = el < 0.4;
  return el;
}

// ctx: world space (meters, y up). k: pixels per meter. From drawSalamanders (render/salamander.js) for each thorn-back.
export function drawThorn20(ctx, sim, C, k, t) {
  const S = stateOf(sim, C, t);
  const dt = clamp(t - S.t, 0, 0.05);
  S.t = t;
  if (!shown(C)) return;
  pull(S, C);
  const st = statusClock(sim, 'c' + C.id, C.ph === 'daze' ? (C.dk === 'frost' ? { k: 'ice', left: C.t } : { k: 'stun', zap: C.dk === 'bolt', left: C.t }) : null, t);
  const frozen = !!(st && st.k === 'ice'), won = C.ph === 'beat';
  let alpha = C.ph === 'in' ? sstep(C.dur / 0.45) : 1;
  if (won) { const el = beaten(S, dt, t); alpha = 1 - sstep((el - 1.7) / 0.5); if (alpha <= 0) return; }
  else if (!frozen) step(sim, C, S, dt, t);
  const L = svlOf(C), duke = C.role === 'duke';
  ctx.save();
  ctx.globalAlpha = alpha;
  const sn = bodyAt(S, 0), out = {}, o = {
    pose: 'idle', blend: { ...S.B, lay: S.lay >= 0 ? S.lay : 0 }, gait: S.odo * k, id: 200 + C.id, heading: -S.hd, aim: -S.aim, look: S.wide ? { x: 0.1, y: 0 } : S.look, noShadow: frozen ? 1 : 0,
    trail: (d) => { const q = bodyAt(S, d / k); return { x: q.x * k, y: -q.y * k }; }, status: st, out, skin: duke ? 'crystal' : undefined,
  };
  if (S.wide) o.blink = 0;
  ctx.scale(1 / k, -1 / k);
  drawCrawler(ctx, sn.x * k, -sn.y * k, L * k, frozen ? st.hold : t, o, 'thornback');
  ctx.scale(k, -k);
  if (C.ph === 'in' && C.dur < 0.7) { // a puff of grit where he squeezes in through the gap
    const f = C.dur / 0.7, n = sim.rings.length, ring = sim.rings[n - 1], ga = ring.body.getAngle() + C.ent.la, r = ring.r + 0.1;
    ctx.globalAlpha = 0.7 * (1 - f); ctx.fillStyle = duke ? '#e6dcff' : '#e8d3a0';
    for (let i = 0; i < 6; i++) { const aa = ga + (hash(i + 1) - 0.5) * 0.25, rr = r + (hash(i + 7) - 0.3) * 0.5 * f; ctx.beginPath(); ctx.arc(rr * Math.cos(aa), rr * Math.sin(aa), 0.05 + 0.12 * f, 0, TAU); ctx.fill(); }
  }
  if (won && t - S.beatT > 1.6) { // gone in a puff
    const f = clamp((t - S.beatT - 1.6) / 0.7, 0, 1), c = bodyAt(S, L * 0.5);
    ctx.globalAlpha = 0.8 * (1 - f); ctx.fillStyle = duke ? '#efe6ff' : '#f2e2b8';
    for (let i = 0; i < 7; i++) { const aa = hash(i + 3) * TAU; ctx.beginPath(); ctx.arc(c.x + Math.cos(aa) * 0.5 * f, c.y + Math.sin(aa) * 0.5 * f, 0.08 + 0.15 * f, 0, TAU); ctx.fill(); }
  }
  if (C.ph === 'hip' && C.dur - C.t > THORN.hipAt - 0.02 && C.dur - C.t < THORN.hipAt + 0.3) { // the bump: a little burst at his snout
    const f = (C.dur - C.t - THORN.hipAt + 0.02) / 0.32, h = bodyAt(S, 0), ha = S.hd + S.aim;
    ctx.globalAlpha = 0.9 * (1 - f); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.04; ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) { const a = ha + i * 0.6, r0 = 0.18 + 0.2 * f; ctx.beginPath(); ctx.moveTo(h.x + Math.cos(a) * r0, h.y + Math.sin(a) * r0); ctx.lineTo(h.x + Math.cos(a) * (r0 + 0.16), h.y + Math.sin(a) * (r0 + 0.16)); ctx.stroke(); }
  }
  ctx.restore();
}

// the shed spikes: crystals (the Duke) and thorns (Spike) standing on a channel floor; they grow in, and crumble at the end
export function drawSpikes(ctx, sim, k, t) {
  const X = sim.bx;
  if (!X) return;
  for (const W of X.walls) {
    if (!W.alive || W.kind !== 'spike') continue;
    const ring = sim.rings[W.ri], a = ring.body.getAngle() + W.la, el = W.max - W.life, grow = sstep(el / 0.18);
    const base = W.base, tip = base + (W.tip - base) * grow, end = W.life < 0.7 ? 1 - W.life / 0.7 : 0;
    const bx = base * Math.cos(a), by = base * Math.sin(a), tx = tip * Math.cos(a), ty = tip * Math.sin(a);
    const shk = end > 0 ? Math.sin(t * 60 + W.id) * 0.012 * end : 0, tg = { x: -Math.sin(a), y: Math.cos(a) };
    ctx.save();
    ctx.translate(tg.x * shk, tg.y * shk);
    // a soft dark contact patch on the floor, so it reads on the violet board
    ctx.globalAlpha = 0.45 * (1 - end); ctx.fillStyle = '#12051f';
    ctx.beginPath(); ctx.ellipse(bx, by, 0.2, 0.06, a + Math.PI / 2, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1 - 0.8 * end;
    if (W.sk === 'crystal') {
      // a cluster: one tall crystal and a short one leaning out beside it, white halo first so it pops off the board
      const hw = SPIKE.w * 0.62;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.1;
      ctx.beginPath(); ctx.moveTo(bx - tg.x * hw, by - tg.y * hw); ctx.lineTo(tx, ty); ctx.lineTo(bx + tg.x * hw, by + tg.y * hw); ctx.stroke();
      const sx = bx + tg.x * hw * 0.8, sy = by + tg.y * hw * 0.8, h2 = (tip - base) * 0.5, n = { x: Math.cos(a), y: Math.sin(a) };
      crystalSpike(ctx, CRY, sx, sy, sx + n.x * h2 + tg.x * Math.abs(h2) * 0.55, sy + n.y * h2 + tg.y * Math.abs(h2) * 0.55, hw * 0.55, 0.025);
      crystalSpike(ctx, CRY, bx, by, tx, ty, hw, 0.028);
      if (grow < 1 || end <= 0) { const f = (t * 0.8 + W.id * 0.37) % 1; twinkle(ctx, lerp(bx, tx, 0.75) - tg.x * 0.04, lerp(by, ty, 0.75) - tg.y * 0.04, 0.09 * Math.sin(Math.PI * f), 0.95 * Math.sin(Math.PI * f)); }
    } else {
      // a thorn: bone base, red hooked tip (the game's thorn language), a pale halo
      const len = Math.abs(tip - base), mx = (bx + tx) / 2, my = (by + ty) / 2;
      ctx.translate(mx, my); ctx.rotate(a + (W.tip > W.base ? -Math.PI / 2 : Math.PI / 2));
      ctx.strokeStyle = 'rgba(255,240,210,0.6)'; ctx.lineWidth = 0.09; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-0.13, -len / 2); ctx.lineTo(0, len / 2); ctx.lineTo(0.13, -len / 2); ctx.stroke();
      ctx.scale(1 / k, -1 / k);
      drawCrawlerThorn(ctx, 0, 0, len * 0.55 * k, 0, 0, null);
    }
    ctx.restore();
    if (end > 0) { // crumbling: grit falls off
      ctx.save(); ctx.fillStyle = W.sk === 'crystal' ? '#d8c8ff' : '#c9a160';
      for (let i = 0; i < 5; i++) { const f = (end + hash(i + W.id) * 0.4) % 1, q = spikePt(sim, W, 0.3 + 0.6 * hash(i + 3)); ctx.globalAlpha = 1 - f; ctx.beginPath(); ctx.arc(q.x + (hash(i + 9) - 0.5) * 0.2, q.y - f * 0.25, 0.025 + 0.02 * hash(i), 0, TAU); ctx.fill(); }
      ctx.restore();
    }
  }
}
function twinkle(ctx, x, y, r, al) {
  if (al <= 0.02 || r <= 0.002) return;
  ctx.fillStyle = `rgba(255,255,255,${al})`; ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r); ctx.fill();
}
// one shard in flight (world space): a small crystal pointing along its way
function shard(ctx, x, y, ang, s) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  crystalSpike(ctx, CRY, x - ca * s * 0.6, y - sa * s * 0.6, x + ca * s, y + sa * s, s * 0.45, Math.max(0.012, s * 0.12));
}
function thornFly(ctx, x, y, ang, s, k) { ctx.save(); ctx.translate(x, y); ctx.rotate(ang - Math.PI / 2); ctx.scale(1 / k, -1 / k); drawCrawlerThorn(ctx, 0, 0, s * k, 0, 0, null); ctx.restore(); }

// the Duke's attacks and the duel's thrown spikes, over the eggs
export function drawThornOver(ctx, sim, k, t) {
  if (!isCrystal20(sim)) return;
  const B = sim.bx.boss, A = B && B.atk, D = sim.duke();
  const SD = D && shown(D) ? ST.get(D.id) : null;
  if (SD && SD.sim === sim && A && (D.ph === 'atk' || D.ph === 'brake')) {
    pull(SD, D);
    const u = A.ph === 'warn' ? clamp(1 - A.t / A.dur, 0, 1) : 1, L = svlOf(D);
    if (A.name === 'cage' && A.ph === 'warn') { // crystals race out from under him along the floor to the two marks
      const ring = sim.rings[A.ri], c = bodyAt(SD, L * 0.45), rb = ring.r - RING_TH / 2 - 0.1;
      for (const la of A.spots) {
        const a = ring.body.getAngle() + la, ex = rb * Math.cos(a), ey = rb * Math.sin(a), n = 9;
        for (let i = 0; i < n; i++) {
          const f = (i + 1) / n; if (f > u * 1.15) break;
          const x = lerp(c.x, ex, f), y = lerp(c.y, ey, f), r = Math.hypot(x, y) || 1, s = 0.14 + 0.09 * f; // big enough to read on a phone
          shard(ctx, x + (hash(i + la * 9) - 0.5) * 0.06, y, Math.atan2(-y, -x) + (hash(i * 3 + la) - 0.5) * 0.8, s * (1 - 0.3 * Math.sin(t * 20 + i)));
          void r;
        }
      }
    } else if (A.name === 'shards') { // shards arc up off his spines (they then fall through the marked wedge)
      const R1 = sim.outerR + 0.5, n = A.ph === 'warn' ? 9 : 4;
      for (let i = 0; i < n; i++) {
        const f = (t * 1.3 + hash(i + 2)) % 1, from = bodyAt(SD, L * (0.3 + 0.5 * hash(i + 5))), wa = A.aw + (hash(i + 8) - 0.5) * 2 * A.hw;
        const ex = R1 * Math.cos(wa), ey = R1 * Math.sin(wa), x = lerp(from.x, ex, f), y = lerp(from.y, ey, f) + Math.sin(Math.PI * f) * 1.2;
        const x2 = lerp(from.x, ex, f + 0.03), y2 = lerp(from.y, ey, f + 0.03) + Math.sin(Math.PI * (f + 0.03)) * 1.2;
        ctx.save(); ctx.globalAlpha = (A.ph === 'warn' ? 0.35 + 0.65 * u : 1) * (1 - f * 0.4); shard(ctx, x, y, Math.atan2(y2 - y, x2 - x), 0.16); ctx.restore();
      }
    } else if (A.name === 'stomp' && A.ph === 'act') { // the shock leaves his front feet: a ring of grit runs out from him
      const f = clamp(1 - A.t / A.dur, 0, 1), c = bodyAt(SD, L * 0.3);
      ctx.save(); ctx.lineWidth = 0.08 * (1 - f) + 0.02;
      for (const [col, w] of [['rgba(40,10,70,0.6)', 1.8], ['#f2ecff', 1]]) { ctx.strokeStyle = col; ctx.lineWidth *= w; ctx.globalAlpha = 1 - f; ctx.beginPath(); ctx.arc(c.x, c.y, 0.3 + 2.4 * f, 0, TAU); ctx.stroke(); ctx.lineWidth /= w; }
      ctx.restore();
    } else if (A.name === 'punch' && A.ph === 'act') { // the tail cracks against the wall
      const tip = bodyAt(SD, L * 1.45), f = clamp(1 - A.t / A.dur, 0, 1);
      ctx.save(); ctx.globalAlpha = 1 - f; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.05; ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.3, r0 = 0.12 + 0.3 * f; ctx.beginPath(); ctx.moveTo(tip.x + Math.cos(a) * r0, tip.y + Math.sin(a) * r0); ctx.lineTo(tip.x + Math.cos(a) * (r0 + 0.18), tip.y + Math.sin(a) * (r0 + 0.18)); ctx.stroke(); }
      ctx.restore();
    }
  }
  // the duel: Spike's thorn flies at the Duke's crest and is batted off; the Duke's crystal flies over the ducking Spike
  const Q = D && D.duel, Sp = Q && (sim.sals || []).find((o) => o.id === Q.sid), SS = Sp ? ST.get(Sp.id) : null;
  if (Q && SD && SS && SS.sim === sim) {
    pull(SD, D); pull(SS, Sp);
    const [b1, b2] = THORN.beats, hit = THORN.beatHit, el = Q.t;
    const fly = (from, to, f, crystal) => { const x = lerp(from.x, to.x, f), y = lerp(from.y, to.y, f), l = Math.hypot(x, y) || 1, bow = -Math.sin(Math.PI * f) * 0.6, x1 = x + (x / l) * bow, y1 = y + (y / l) * bow, ang = Math.atan2(to.y - from.y, to.x - from.x); if (crystal) shard(ctx, x1, y1, ang, 0.14); else thornFly(ctx, x1, y1, ang, 0.1, k); };
    // where the sim lands each spike (sim/thornback.js thornDuelStep: 2.7 m past the duel spot, beyond the one it is thrown at)
    const land = (from, to) => { const a0 = Math.atan2(Q.hy, Q.hx), r = Math.hypot(Q.hx, Q.hy), side = Math.sign(wrap(Math.atan2(to.y, to.x) - Math.atan2(from.y, from.x))) || 1, a = a0 + side * 2.7 / r; return { x: r * Math.cos(a), y: r * Math.sin(a) }; };
    const t1 = b1 + 0.1, tm = b1 + 0.1 + (hit - 0.1) * 0.55, crest = bodyAt(SD, 0.1);
    if (el > t1 && el < tm) fly(bodyAt(SS, svlOf(Sp) * 0.75), crest, (el - t1) / (tm - t1), false);
    else if (el >= tm && el < b1 + hit) fly(crest, land(SS.C.pts[0], SD.C.pts[0]), (el - tm) / (b1 + hit - tm), false); // batted off the crest
    if (el > b2 + 0.1 && el < b2 + hit) fly(bodyAt(SD, svlOf(D) * 0.75), land(SD.C.pts[0], SS.C.pts[0]), (el - b2 - 0.1) / (hit - 0.1), true);
    if (el > tm - 0.04 && el < tm + 0.2) burst(ctx, crest, (el - tm + 0.04) / 0.24, '#fff3c8');
    if (el > THORN.beats[2] + hit - 0.02 && el < THORN.beats[2] + hit + 0.3) { const L = Q.lose === D.id ? SD : SS, Cc = Q.lose === D.id ? D : Sp; burst(ctx, bodyAt(L, svlOf(Cc) * 0.5), (el - THORN.beats[2] - hit + 0.02) / 0.32, '#ffffff', 1.6); }
    if (el < b1) { // square-up: rattling lines over both backs
      for (const [Ss, Cc] of [[SD, D], [SS, Sp]]) { const c = bodyAt(Ss, svlOf(Cc) * 0.5); ctx.save(); ctx.globalAlpha = 0.7 * sstep(el / 0.3); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.035; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { const a = Math.atan2(c.y, c.x) + (i - 1) * 0.35 + Math.sin(t * 40 + i) * 0.05, r = Math.hypot(c.x, c.y) + 0.45; ctx.beginPath(); ctx.moveTo(r * Math.cos(a), r * Math.sin(a)); ctx.lineTo((r + 0.16) * Math.cos(a), (r + 0.16) * Math.sin(a)); ctx.stroke(); } ctx.restore(); }
    }
  }
}
function burst(ctx, p, f, col, s = 1) {
  if (f <= 0 || f >= 1) return;
  ctx.save(); ctx.globalAlpha = 1 - f; ctx.strokeStyle = col; ctx.lineWidth = 0.05 * s; ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU + 0.2, r0 = (0.1 + 0.3 * f) * s; ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * r0, p.y + Math.sin(a) * r0); ctx.lineTo(p.x + Math.cos(a) * (r0 + 0.15 * s), p.y + Math.sin(a) * (r0 + 0.15 * s)); ctx.stroke(); }
  ctx.restore();
}

// the Duke's body centre in the world, where he is drawn now (boss popups, the boss pose)
export function thornAnchor(sim) {
  if (!isCrystal20(sim)) return null;
  const C = sim.duke();
  if (!shown(C)) return null;
  const S = ST.get(C.id); // read only: the art's state runs on the render clock, never reset from here
  if (!S || S.sim !== sim || !S.tr.length) { const q = C.pts[Math.min(C.pts.length - 1, 14)]; return { x: q.x, y: q.y }; }
  return bodyAt(S, svlOf(C) * 0.4);
}
// his face, for the boss bar chip (screen space, y down; drawn inside the chip's clip)
export function drawThornEmblem(ctx, r, t) {
  drawCrawler(ctx, 0, -r * 0.55, r * 2.3, t, { heading: -Math.PI / 2, pose: 'idle', id: 216, noShadow: 1, look: { x: 0.5, y: 0.5 }, skin: 'crystal', blend: { angry: 0.7 } }, 'thornback');
}
