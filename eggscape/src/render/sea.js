// Sea creatures (v3.3 M8, Coral Reef): the fish school, plus the in-game wiring for the octopus (art: render/octopus.js).
// drawFish(ctx, x, y, L, ang, t, o)  one fish, nose at +x of ang; L = length px; o: {beat (tail phase), flip 0..1, alarm}.
//
// In game: drawSeaUnder() (before the eggs: fish, the current, den, ink, the octopus or the arms behind a held egg) and
// drawSeaOver() (after the eggs: the arms that wrap a held egg, the squirt cloud that blacks out a sector, ice shards).
// ctx in world space (m, y up).
import { RING_TH, TAU } from '../sim/geom.js';
import { FISH } from '../sim/sea.js';
import { statusClock, statusDraw, dizzyStars } from './status.js';
import { OCT_S, octoAnim, octoLook, drawOctopus, drawDen, drawInkCloud, iceShards, stepShards, drawShards } from './octopus.js';
export { OCT_S, octoAnim, drawOctopus };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const sstep = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const rgb = (c, al = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${al})`;
const pxSpace = (ctx, x, y, k, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(1 / k, -1 / k); try { f(); } catch (e) { if (typeof console !== "undefined" && !pxSpace.w) { pxSpace.w = 1; console.warn("sea art", e); } } ctx.restore(); };

const FP = { line: hex('#2a1a06'), body: hex('#ffcf2e'), hi: hex('#fff1a0'), lo: hex('#e89a10'), stripe: hex('#2b6fe8'), fin: hex('#ff8a1e'), eye: hex('#ffffff') };

// the ink cloud: a cluster of dark puffs that spread and fade (age 0..INK_T s)
export const INK_T = 2.6;
export function drawInk(ctx, x, y, s, age, seed = 0, amt = 1) {
  if (age >= INK_T) return;
  const u = age / INK_T, grow = 1 - Math.exp(-age * 2.4);
  ctx.save();
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < 8; i++) {
      const a = i * 2.39996 + seed, d = (0.15 + 0.85 * ((i * 0.37 + seed * 0.1) % 1)) * s * 1.1 * grow * amt, r = s * (0.25 + 0.35 * grow) * (0.7 + 0.3 * ((i * 0.61) % 1)) * amt;
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d - age * 0.15 * s;
      ctx.fillStyle = pass ? `rgba(26,18,48,${0.82 * (1 - u) * (1 - u * 0.4)})` : `rgba(92,70,140,${0.45 * (1 - u)})`;
      ctx.beginPath(); ctx.arc(px, py, pass ? r : r * 1.15, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- fish
export function drawFish(ctx, x, y, L, ang, t, o = {}) {
  const flip = o.flip ?? 1, beat = o.beat ?? t * 10, lw = Math.max(0.8, L * 0.075);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const up = (Math.cos(ang) < 0 ? -1 : 1) * (o.belly ? -1 : 1); // keep the back up on screen (stunned: belly up)
  ctx.scale(Math.max(0.12, Math.abs(flip)), up);
  const tail = Math.sin(beat) * 0.5;
  ctx.rotate(Math.sin(beat - 1.1) * 0.07); // the body yaws against the tail
  const line = rgb(FP.line);
  // tail
  ctx.save();
  ctx.translate(-0.3 * L, 0); ctx.rotate(tail);
  ctx.beginPath(); ctx.moveTo(0.04 * L, 0); ctx.quadraticCurveTo(-0.1 * L, -0.06 * L, -0.28 * L - tail * 0.05 * L, -0.23 * L); ctx.quadraticCurveTo(-0.17 * L, 0, -0.28 * L - tail * 0.05 * L, 0.23 * L); ctx.quadraticCurveTo(-0.1 * L, 0.06 * L, 0.04 * L, 0); ctx.closePath();
  ctx.fillStyle = rgb(FP.fin); ctx.fill(); ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.restore();
  // dorsal fin
  ctx.beginPath(); ctx.moveTo(-0.12 * L, -0.15 * L); ctx.quadraticCurveTo(0.0, -0.36 * L, 0.12 * L, -0.17 * L); ctx.closePath();
  ctx.fillStyle = rgb(FP.fin); ctx.fill(); ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.stroke();
  // body
  ctx.beginPath(); ctx.ellipse(0.04 * L, 0, 0.36 * L, 0.21 * L, 0, 0, TAU);
  ctx.fillStyle = rgb(FP.body); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = rgb(FP.lo); ctx.beginPath(); ctx.ellipse(0.02 * L, 0.16 * L, 0.42 * L, 0.14 * L, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = rgb(FP.stripe); ctx.fillRect(-0.07 * L, -0.3 * L, 0.11 * L, 0.6 * L);
  ctx.fillStyle = rgb(FP.hi); ctx.beginPath(); ctx.ellipse(0.12 * L, -0.1 * L, 0.14 * L, 0.05 * L, -0.1, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.beginPath(); ctx.ellipse(0.04 * L, 0, 0.36 * L, 0.21 * L, 0, 0, TAU);
  ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.stroke();
  // eye (wide when alarmed)
  const er = 0.09 * L * (1 + 0.35 * (o.alarm || 0));
  ctx.fillStyle = rgb(FP.eye); ctx.beginPath(); ctx.arc(0.24 * L, -0.04 * L, er, 0, TAU); ctx.fill(); ctx.lineWidth = lw * 0.6; ctx.strokeStyle = line; ctx.stroke();
  if (o.dizzy) { // stunned: an X eye and a little open mouth
    ctx.strokeStyle = line; ctx.lineWidth = Math.max(1, L * 0.05); ctx.lineCap = 'round'; ctx.beginPath();
    const ex = 0.24 * L, ey = -0.04 * L, d = er * 0.85;
    ctx.moveTo(ex - d, ey - d); ctx.lineTo(ex + d, ey + d); ctx.moveTo(ex + d, ey - d); ctx.lineTo(ex - d, ey + d);
    ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0.4 * L, 0.04 * L, L * 0.03, L * 0.045, 0, 0, TAU); ctx.fillStyle = line; ctx.fill();
  } else { ctx.fillStyle = line; ctx.beginPath(); ctx.arc(0.25 * L + er * 0.2, -0.04 * L, er * 0.58, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0.25 * L, -0.04 * L - er * 0.25, er * 0.22, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// ---------------------------------------------------------------- in game
export const seaAnim = new Map(); // 'o' + id / 'f' + id -> per-creature render state; reset with a new sim
const toPx = (x, y, k) => ({ x: x * k, y: -y * k });

function octPose(C) {
  if (C.stn > 0 || C.zp > 0) return 'slack';
  switch (C.ph) {
    case 'seek': case 'home': return 'seek';
    case 'rise': return 'seek';
    case 'warn': return 'warn';
    case 'grab': return 'grab';
    case 'squirt': return 'squirt';
    case 'carry': return 'carry';
    case 'let': return C.hit === 'zap' || C.hit === 'flash' ? 'slack' : 'struck';
    case 'jet': return 'jet';
    default: return 'idle';
  }
}
function octState(sim, C, t) {
  let R = seaAnim.get('o' + C.id);
  const fresh = !R || R.sim !== sim || t < R.t - 0.5;
  if (fresh) { R = { sim, t, an: octoAnim(), rot: null, wrap: 0, hitK: 0, hit: '', pulse: 0, sub: C.ph === 'lurk' ? 1 : 0, fzK: 0, t0: t, wasFz: 0, shards: [], shake: 0, stn: 0, zap: 0 }; seaAnim.set('o' + C.id, R); R.an.snap(octPose(C)); }
  const dt = clamp(t - R.t, 0, 0.1);
  R.t = t;
  R.dt = dt;
  return R;
}
function octFrame(sim, C, R, t, k, pal) {
  const dt = R.dt, pose = octPose(C), frozen = C.fz > 0;
  if (!frozen) R.an.update(dt, pose, pose === 'struck' || pose === 'jet' ? 14 : 7);
  const A = R.an.A;
  const p = toPx(C.rad * Math.cos(C.a), C.rad * Math.sin(C.a), k), s = OCT_S * k;
  // the mantle points away from the wall it grips (toward the centre), leaning into its travel; jetting, it leads
  const inward = Math.atan2(Math.sin(C.a), -Math.cos(C.a));
  const vx = C.vx * k, vy = -C.vy * k, sp = Math.hypot(vx, vy);
  let want = inward;
  const tan = (vx * Math.sin(C.a) + vy * Math.cos(C.a)) / Math.max(1, k);
  want += clamp(-tan * 0.5, -0.45, 0.45);
  if (A.stream > 0.05 && sp > 5) want = wrapA(inward + wrapA(Math.atan2(vy, vx) - inward) * clamp(A.stream, 0, 1));
  if (R.rot == null) R.rot = want;
  if (!frozen) R.rot += wrapA(want - R.rot) * Math.min(1, dt * (pose === 'jet' ? 12 : 5));
  // the about-to-grab flush: faster as it nears the grab, solid at the grab; the squirt swells in red too
  const u = C.dur > 0 ? clamp(1 - C.t / C.dur, 0, 1) : 1;
  const pw = C.ph === 'warn' ? 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * (9 + 16 * u))) * (0.5 + 0.5 * u) + 0.25 * u : C.ph === 'grab' ? 1 : C.ph === 'squirt' ? 0.35 + 0.5 * u : 0;
  R.pulse += (clamp(pw, 0, 1) - R.pulse) * Math.min(1, dt * 18);
  if (C.ph === 'let') { R.hit = C.hit; R.hitK = Math.min(1, R.hitK + dt * 10); }
  else R.hitK = Math.max(0, R.hitK - dt * (C.ph === 'jet' ? 1.2 : 3));
  // the zap flash: the arcs fade over the let-go / the first 0.3 s of a stun
  const zap = (C.ph === 'let' && C.hit === 'zap') ? clamp(C.t / C.dur + 0.3, 0, 1) : C.zp > 0 ? clamp(C.zp / 0.3, 0.2, 1) : 0;
  R.zap = zap;
  // wrap: the grab closes the arms over the egg; carrying, they hold
  const egg = C.eid ? sim.eggs.find((e) => e.id === C.eid && e.alive && e.body) : C.ph === 'grab' ? sim.eggs.find((e) => e.id === C.tgt && e.alive && e.body) : null;
  const ww = C.ph === 'carry' && egg ? 1 : C.ph === 'grab' ? clamp(u * 1.4, 0, 1) : 0;
  R.wrap += (ww - R.wrap) * Math.min(1, dt * (ww > R.wrap ? 14 : 9));
  if (egg) { const q = egg.body.getPosition(); R.egg = { ...toPx(q.x, q.y, k), rx: 0.28 * k, ry: 0.21 * k }; }
  else if (R.wrap < 0.02) R.egg = null;
  // sunk in the den (lurk) and rising from it
  const subWant = C.ph === 'lurk' ? 1 : C.ph === 'rise' ? clamp(C.t / C.dur, 0, 1) : C.ph === 'in' && C.den ? 1 : 0;
  R.sub += (subWant - R.sub) * Math.min(1, dt * (C.ph === 'lurk' ? 5 : 9));
  // frozen: ice grows in 0.3 s; the pose is held; on thaw the shards fall and it shakes itself off
  if (frozen && !R.wasFz) { R.t0 = t; R.fzMax = C.fzMax; }
  if (!frozen && R.wasFz) { R.shards = iceShards(p.x, p.y, s, C.id); R.shake = 1; }
  R.wasFz = frozen ? 1 : 0;
  R.fzK += ((frozen ? 1 : 0) - R.fzK) * Math.min(1, dt * (frozen ? 14 : 30));
  if (!frozen && R.fzK < 0.03) R.fzK = 0;
  R.shake = Math.max(0, R.shake - dt * 2.2);
  R.stn += ((C.stn > 0 || C.zp > 0 || (C.ph === 'let' && (C.hit === 'zap' || C.hit === 'flash')) ? 1 : 0) - R.stn) * Math.min(1, dt * 10);
  if (R.shards.length) R.shards = stepShards(R.shards, dt, s * 9);
  // eyes: the target egg (locked), else ahead
  let look = null;
  const tg = C.tgt && sim.eggs.find((e) => e.id === C.tgt && e.alive && e.body);
  if (tg && (C.ph === 'seek' || C.ph === 'warn' || C.ph === 'grab' || C.ph === 'squirt' || C.ph === 'rise')) { const q = tg.body.getPosition(); look = toPx(q.x, q.y, k); }
  else if (sp > 3) look = { x: p.x + vx * 0.3, y: p.y + vy * 0.3 };
  const alpha = C.ph === 'in' ? (C.den ? 1 : sstep(1 - C.t / C.dur)) : 1, scale = C.ph === 'in' && !C.den ? 0.5 + 0.5 * sstep(1 - C.t / C.dur) : 1;
  // the wall plane it grips, in its own frame: distance d px from the centre, normal n (toward the wall)
  const c = clamp(sim.chAt(C.rad), 1, sim.rings.length - 1), wd = Math.max(0.05, sim.rings[c].r - RING_TH / 2 - C.rad) * k;
  const th = R.rot + Math.PI / 2, ox = Math.cos(C.a), oy = -Math.sin(C.a), ca = Math.cos(-th), sa = Math.sin(-th);
  const wall = { nx: ox * ca - oy * sa, ny: ox * sa + oy * ca, d: wd };
  const fz = R.fzK > 0.01 ? { k: R.fzK, left: C.fz > 0 ? C.fz : 9, t0: R.t0 - 0 } : null;
  if (fz) fz.t0 = R.t0;
  return { p, s, wd, o: { rot: R.rot, A, pal, wall, egg: R.egg, wrap: R.wrap, look, pulse: R.pulse, hit: R.hit, hitK: R.hitK, alpha, scale, seed: C.id * 1.7, sub: R.sub, fz, stn: R.stn, zap: R.zap, shake: R.shake } };
}

function fishState(sim, S, t) {
  let R = seaAnim.get('f' + S.id);
  if (!R || R.sim !== sim || t < R.t - 0.5) { R = { sim, t, f: S.f.map(() => ({ h: null, flip: 1, beat: 0, alarm: 0 })), cur: 1 }; seaAnim.set('f' + S.id, R); }
  R.dt = clamp(t - R.t, 0, 0.1); R.t = t;
  return R;
}

export function drawSeaUnder(ctx, sim, t, k, theme) {
  if (!(sim.octos && sim.octos.length) && !(sim.schools && sim.schools.length)) return;
  const pal = octoLook(theme);
  for (const S of sim.schools || []) drawSchool(ctx, sim, S, t, k);
  for (const C of sim.octos || []) {
    // its den: a puddle on the floor of its home channel, drawn on (and turning with) that ring
    if (C.den && sim.rings[C.home]) {
      const ring = sim.rings[C.home], a = ring.body.getAngle() + C.dnA, r = ring.r - RING_TH / 2 - 0.01;
      const q = toPx(r * Math.cos(a), r * Math.sin(a), k), inward = Math.atan2(Math.sin(a), -Math.cos(a));
      pxSpace(ctx, 0, 0, k, () => drawDen(ctx, q.x, q.y, OCT_S * k * 1.7, inward, t, pal, { seed: C.id * 0.37 }));
    }
    if (C.ph === 'wait') continue;
    const R = octState(sim, C, t), F = octFrame(sim, C, R, t, k, pal);
    R.F = F;
    if (C.inkT < INK_T) pxSpace(ctx, 0, 0, k, () => drawInk(ctx, C.inkX * k, -C.inkY * k, OCT_S * k, C.inkT, C.id * 2.3, C.hit === 'tired' ? 0.65 : 1));
    if (C.ph === 'jet') { // puffs of ink behind it as it shoots off
      const u = clamp(1 - C.t / C.dur, 0, 1);
      pxSpace(ctx, 0, 0, k, () => {
        for (let j = 1; j <= 4; j++) {
          const q = F.p, b = Math.hypot(C.vx, C.vy) || 1, dx = (-C.vx / b) * j * 0.18 * k, dy = (C.vy / b) * j * 0.18 * k;
          ctx.fillStyle = `rgba(26,18,48,${0.55 * (1 - u) * (1 - j / 5)})`;
          ctx.beginPath(); ctx.arc(q.x + dx, q.y + dy, (0.07 + 0.03 * j) * k, 0, TAU); ctx.fill();
        }
      });
    }
    const split = F.o.wrap > 0.05 && F.o.egg;
    pxSpace(ctx, 0, 0, k, () => drawOctopus(ctx, F.p.x, F.p.y, F.s, t, { ...F.o, part: split ? 'back' : 'all' }));
  }
}
export function drawSeaOver(ctx, sim, t, k) {
  for (const C of sim.octos || []) {
    const R = seaAnim.get('o' + C.id);
    if (C.ph === 'wait' || !R || !R.F || R.sim !== sim) continue;
    const F = R.F;
    if (F.o.wrap > 0.05 && F.o.egg) pxSpace(ctx, 0, 0, k, () => drawOctopus(ctx, F.p.x, F.p.y, F.s, t, { ...F.o, part: 'front' }));
    // the squirt: ink over the eggs, blacking out the sector round its target
    if (C.sqT < C.sqD + 0.2) pxSpace(ctx, 0, 0, k, () => drawInkCloud(ctx, C.sqX * k, -C.sqY * k, C.sqR * k, C.sqT, C.sqD, C.id * 3.1, C.sqT < 0.35 ? F.p : null));
    if (R.shards.length) pxSpace(ctx, 0, 0, k, () => drawShards(ctx, R.shards, k));
  }
}

function drawSchool(ctx, sim, S, t, k) {
  const R = fishState(sim, S, t), dt = R.dt, c = S.ch, r0 = sim.rings[c - 1].r + RING_TH / 2, r1 = sim.rings[c].r - RING_TH / 2;
  const L = FISH.len * k * 1.4; // draw scale only (1.4x so a fish reads on a phone); the collider keeps FISH.len
  // the current they make: faint streaks through the school, flowing their way (gone while they scatter)
  const cur = S.push * (S.ph === 'scatter' ? 0 : 1);
  R.cur += (cur - R.cur) * Math.min(1, dt * 6);
  if (R.cur > 0.03) {
    let sx = 0, sy = 0;
    for (const f of S.f) { sx += Math.cos(f.a); sy += Math.sin(f.a); }
    const ca = Math.atan2(sy, sx), span = 0.85 / ((r0 + r1) / 2);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.setLineDash([0.16, 0.22]);
    for (let j = 0; j < 3; j++) {
      const rr = lerp(r0, r1, 0.25 + j * 0.25);
      ctx.lineDashOffset = S.dir * t * S.speed * 0.9 + j * 0.13;
      ctx.strokeStyle = `rgba(225,250,255,${0.42 * R.cur})`;
      ctx.lineWidth = 0.035;
      ctx.beginPath();
      ctx.arc(0, 0, rr, ca - span * 1.15, ca + span * 1.15);
      ctx.stroke();
    }
    ctx.restore();
  }
  // frozen: stopped mid-swim in a thin ice glaze (held pose); stunned: adrift belly up, wobbling, stars; zapped: arcs first
  const st = statusClock(sim, 'y' + S.id, S.fz > 0 ? { k: 'ice', left: S.fz } : S.sn > 0 ? { k: 'stun', zap: S.zp > 0, left: S.sn } : null, t);
  const frozen = st && st.k === 'ice', stunned = st && st.k === 'stun';
  pxSpace(ctx, 0, 0, k, () => {
    S.f.forEach((f, j) => {
      const F = R.f[j], x = f.r * Math.cos(f.a), y = f.r * Math.sin(f.a);
      if (frozen) { // nothing moves: the same heading, the same tail
        const fs = { ...st, seed: st.seed + j * 13 };
        statusDraw(ctx, { x0: x * k - L, y0: -y * k - L, x1: x * k + L, y1: -y * k + L }, (c) => drawFish(c, x * k, -y * k, L, F.h ?? 0, st.hold, { flip: Math.abs(F.flip), beat: F.beat + j, alarm: 0 }), fs, { off: Math.max(0.8, L * 0.045), rim: Math.max(1, L * 0.07), crys: Math.max(0.6, L / 26), quick: true });
        return;
      }
      // heading from its velocity (va along the channel, vr out)
      const ux = Math.cos(f.a), uy = Math.sin(f.a), vx = -uy * f.va + ux * f.vr, vy = ux * f.va + uy * f.vr, sp = Math.hypot(vx, vy);
      const want = sp > 0.08 ? Math.atan2(-vy, vx) : F.h ?? Math.atan2(-ux * f.d, -uy * f.d);
      if (F.h == null) F.h = want;
      const d = wrapA(want - F.h);
      if (Math.abs(d) > 2.2 && F.flip >= 0.999) F.flip = -1; // a reversal: the body flips round (narrows through side-on)
      if (F.flip < 1) { F.flip = Math.min(1, F.flip + dt * 7); if (F.flip >= 0 && F.flip - dt * 7 < 0) F.h = want; }
      else F.h += d * Math.min(1, dt * 8);
      F.beat += dt * (6 + 5 * clamp(sp, 0, 3));
      F.alarm += ((S.ph === 'scatter' ? 1 : 0) - F.alarm) * Math.min(1, dt * 6);
      if (stunned) {
        const wob = Math.sin(t * 1.9 + j * 2.1) * 0.32, bob = Math.sin(t * 1.3 + j * 1.7) * L * 0.1, fs = { ...st, seed: st.seed + j * 13 };
        statusDraw(ctx, { x0: x * k - L, y0: -y * k - L * 1.6, x1: x * k + L, y1: -y * k + L }, (c) => drawFish(c, x * k, -y * k + bob, L, F.h + wob, t, { flip: Math.abs(F.flip), beat: t * 1.4 + j, alarm: 0, belly: 1, dizzy: 1 }), fs, { quick: true, crys: 0.6 });
        dizzyStars(ctx, x * k, -y * k + bob - L * 0.38, L * 0.34, L * 0.1, t + j * 0.7, { size: Math.max(1.7, L * 0.1), tilt: -0.15 });
        return;
      }
      drawFish(ctx, x * k, -y * k, L, F.h, t, { flip: Math.abs(F.flip), beat: F.beat + j, alarm: F.alarm });
    });
  });
}

// ---------------------------------------------------------------- events -> SFX/VFX (main.js handleEvents)
export function seaEvent(ev, fx, U) {
  const { popup, audio, once } = U;
  switch (ev.type) {
    case 'octIn':
      audio.play('bubble_on', { vol: 0.6, pitch: 0.7 });
      fx.sparkle(ev.x, ev.y, 6, '#d9b8ff');
      once('octIn', ev.den ? 'An octopus lurks in that puddle. It hunts eggs, squirts ink to hide them, and carries them off. Water, a zap or a glow flash makes it let go.' : 'An octopus! It hunts eggs and carries them off. Water, a zap or a glow flash makes it let go.');
      break;
    case 'octRise':
      audio.play('squish', { vol: 0.5, pitch: 0.8 });
      fx.sparkle(ev.x, ev.y, 5, '#ff8fb0');
      break;
    case 'octSquirt':
      audio.play('squish', { vol: 0.6, pitch: 1.6 });
      break;
    case 'octInk':
      audio.play('bubble_pop', { vol: 0.6, pitch: 0.5 });
      once('octInk', 'Ink! It hides the eggs in the cloud for a moment. They are still there: wait it out.');
      break;
    case 'octThaw':
      audio.play('glass_crack', { vol: 0.5, pitch: 1.3 });
      break;
    case 'octWarn':
      audio.play('squish', { vol: 0.5, pitch: 1.4 });
      break;
    case 'octGrab':
      audio.play('grab', { vol: 0.8, pitch: 0.8 });
      popup(ev.x, ev.y + 0.75, 'Grabbed!', { color: '#ff8fb0', size: 18, life: 0.9 });
      once('octGrab', 'It holds the egg safe from thorns and snakes, but it is carrying it away.');
      break;
    case 'octLetGo': {
      const T = { water: ['Washed off!', '#8fd8ff', 'splash'], zap: ['Zapped!', '#fff27a', 'thunder'], flash: ['Dazzled!', '#fff6c2', 'glass_crack'], dash: ['Bonk!', '#ffd6a0', 'rock_hit'], rock: ['Bonk!', '#ffb070', 'rock_hit'], ice: ['Brr!', '#bfe9ff', 'glass_crack'], tired: ['Let go', '#e6d8ff', 'release'] }[ev.kind];
      if (!T) break;
      audio.play(T[2], { vol: ev.kind === 'zap' ? 0.4 : 0.6, pitch: 1.2 });
      fx.sparkle(ev.x, ev.y, 8, T[1]);
      popup(ev.x, ev.y + 0.75, T[0], { color: T[1], size: 18, life: 0.9 });
      break;
    }
    case 'octJet':
      audio.play('bubble_pop', { vol: 0.7, pitch: 0.6 });
      break;
    case 'fishScatter':
      audio.play('splash', { vol: 0.35, pitch: 1.6 });
      fx.sparkle(ev.x, ev.y, 5, '#ffe9a0');
      once('fishScatter', 'The school scattered: no current for a moment. They regroup soon.');
      break;
    case 'fishIn':
      once('fishIn', 'Fish push eggs along as they swim past. Drop an egg on them and they scatter.');
      break;
  }
}
