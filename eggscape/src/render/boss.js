// ---------- bosses (v3.1): drawing ----------
// The boss actor (code-drawn: the fox / fox king, the Blizzard's storm cloud; others show only their effects), every telegraph (frost
// creeping over a ring, icicles shaking with a shadow under them, target marks for rocks and throws, the punch
// arrow, fog gathering), the gale streaks, temporary walls and ice patches, and the phase bar under the HUD.
// ctx is in world space (meters, y up) unless a function says otherwise.
import { RING_TH, TAU } from '../sim/geom.js';
import { ringPoint, galeNow, heatOf, bossPhases, bossProgress, BOSS_TITLE, ATTACK_NAME } from '../sim/boss.js';
import { isSpriteCalm, drawFoxActor } from './sprites.js';
import { drawFox } from './characters.js';
import { drawIcicle } from './v3art.js';
import { drawOrb } from './powers.js';

const pxSpace = (ctx, x, y, k, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(1 / k, -1 / k); try { f(); } catch (e) { /* art never breaks the frame */ } ctx.restore(); };
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const band = (ctx, ri, ro, a0 = 0, a1 = TAU) => { ctx.beginPath(); ctx.arc(0, 0, ro, a0, a1); ctx.arc(0, 0, ri, a1, a0, true); ctx.closePath(); };

// ---------- on and around the rings (after the rings, before the eggs)
export function drawBossRings(ctx, sim, k, t) {
  const X = sim.bx;
  if (!X) return;
  const B = X.boss, A = B && B.atk;
  // ice patches: glossy, pale, with a moving shine
  for (const ring of sim.rings) {
    const a0 = ring.body.getAngle();
    for (const sg of ring.segs) {
      if (!(sg.ice > 0) || !sg.alive) continue;
      const f = Math.min(1, sg.ice / 0.8);
      ctx.save();
      ctx.globalAlpha = 0.85 * f;
      ctx.fillStyle = '#dff6ff';
      band(ctx, ring.r - RING_TH / 2 - 0.035, ring.r + RING_TH / 2 * 0.2, a0 + sg.a0, a0 + sg.a1);
      ctx.fill();
      ctx.globalAlpha = 0.9 * f;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.02;
      const m = a0 + sg.a0 + (sg.a1 - sg.a0) * ((t * 0.6 + sg.a0) % 1);
      ctx.beginPath();
      ctx.arc(0, 0, ring.r - RING_TH / 2 - 0.01, m - 0.03, m + 0.03);
      ctx.stroke();
      ctx.restore();
    }
  }
  // frozen rings (and the frost creeping over the one the freeze breath is aimed at)
  sim.rings.forEach((ring, i) => {
    const fr = X.rl[i].frost;
    let cover = fr > 0 ? 1 : 0, alpha = fr > 0 ? Math.min(1, fr / 0.6) : 0;
    if (A && A.name === 'freeze' && A.ring === i && A.ph === 'warn') { cover = clamp01(1 - A.t / A.dur); alpha = 0.55 + 0.45 * cover; }
    if (!cover) return;
    const top = Math.PI / 2, half = Math.PI * cover;
    ctx.save();
    ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(0, 0, ring.r - 0.3, 0, 0, ring.r + 0.3);
    g.addColorStop(0, 'rgba(170,225,255,0)');
    g.addColorStop(0.5, 'rgba(225,248,255,0.85)');
    g.addColorStop(1, 'rgba(170,225,255,0)');
    ctx.fillStyle = g;
    band(ctx, ring.r - RING_TH / 2 - 0.12, ring.r + RING_TH / 2 + 0.12, top - half, top + half);
    ctx.fill();
    // crystal spikes on both faces
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 0.022;
    const n = Math.max(8, Math.round(ring.r * 9));
    for (let j = 0; j < n; j++) {
      const a = (j / n) * TAU;
      if (Math.abs(((a - top + 3 * Math.PI) % TAU) - Math.PI) > half) continue;
      const out = j % 2 ? 1 : -1, h = 0.08 + 0.06 * hash(j + i * 31);
      const r0 = ring.r + out * RING_TH / 2;
      ctx.beginPath();
      ctx.moveTo(r0 * Math.cos(a - 0.02), r0 * Math.sin(a - 0.02));
      ctx.lineTo((r0 + out * h) * Math.cos(a), (r0 + out * h) * Math.sin(a));
      ctx.lineTo(r0 * Math.cos(a + 0.02), r0 * Math.sin(a + 0.02));
      ctx.stroke();
    }
    ctx.restore();
  });
  // temporary walls: crystal shards (golem) or ice blocks
  for (const W of X.walls) {
    if (!W.alive) continue;
    const ring = sim.rings[W.ri], base = ring.r - RING_TH / 2 + 0.01, top = base - W.h, a = ring.body.getAngle() + W.la;
    const fade = W.life < 1 ? 0.5 + 0.5 * Math.sin(t * 30) : 1;
    const P = (rad, da) => [rad * Math.cos(a + da / rad), rad * Math.sin(a + da / rad)];
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.beginPath();
    const w = W.w / 2;
    if (W.kind === 'crystal') {
      for (const [r, d] of [[base, -w], [top + W.h * 0.25, -w * 1.1], [top, -w * 0.2], [top + W.h * 0.12, w * 0.5], [base - W.h * 0.35, w * 1.15], [base, w]]) ctx.lineTo(...P(r, d));
      ctx.closePath();
      ctx.fillStyle = '#8f7bff';
      ctx.fill();
      ctx.strokeStyle = '#2b1f7a';
      ctx.lineWidth = 0.025;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(...P(base - 0.04, -w * 0.4));
      ctx.lineTo(...P(top + 0.08, -w * 0.1));
      ctx.strokeStyle = 'rgba(235,225,255,0.9)';
      ctx.stroke();
    } else {
      for (const [r, d] of [[base, -w], [top, -w * 0.85], [top - 0.02, w * 0.8], [base, w]]) ctx.lineTo(...P(r, d));
      ctx.closePath();
      ctx.fillStyle = 'rgba(205,240,255,0.92)';
      ctx.fill();
      ctx.strokeStyle = '#4f9cc8';
      ctx.lineWidth = 0.025;
      ctx.stroke();
    }
    ctx.restore();
  }
  if (!A || A.ph !== 'warn') return;
  const u = clamp01(1 - A.t / A.dur), pulse = 0.5 + 0.5 * Math.sin(t * 18);
  if (A.name === 'punch') {
    // the ring glows hot and a fat arrow shows which way it will be knocked
    const ring = sim.rings[A.ring];
    ctx.save();
    ctx.strokeStyle = `rgba(255,140,40,${0.45 + 0.45 * pulse})`;
    ctx.lineWidth = RING_TH + 0.1;
    ctx.beginPath();
    ctx.arc(0, 0, ring.r, 0, TAU);
    ctx.stroke();
    arcArrow(ctx, ring.r + RING_TH / 2 + 0.3, Math.PI / 2, A.dir, 1.2 * (0.4 + 0.6 * u), '#ffb347');
    ctx.restore();
  } else if (A.name === 'stomp') {
    for (const s of A.spots || []) {
      const q = ringPoint(sim, s.ri, s.la, sim.rings[s.ri].r - RING_TH / 2 - 0.12);
      ctx.save();
      ctx.globalAlpha = 0.4 + 0.5 * pulse;
      ctx.fillStyle = '#b7a6ff';
      ctx.beginPath();
      ctx.arc(q.x, q.y, 0.12 + 0.18 * u, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  } else if (A.name === 'rock' || A.name === 'rock2') {
    for (const s of A.spots || []) {
      const q = ringPoint(sim, s.ri, s.la, sim.rings[s.ri].r);
      target(ctx, q.x, q.y, 0.5 - 0.1 * u, '#ffb347', t);
    }
  } else if (A.name === 'throw' || A.name === 'throw2') {
    for (const s of A.spots || []) target(ctx, s.x, s.y, 0.45 - 0.08 * u, '#ff4d4d', t, true);
  } else if (A.name === 'fog') {
    const ring = sim.rings[A.ring];
    ctx.save();
    for (let j = 0; j < 14; j++) {
      const a = (j / 14) * TAU + t * 0.6, rr = ring.r + (hash(j) - 0.5) * 0.7 * (1 - u);
      ctx.globalAlpha = 0.25 + 0.4 * u;
      ctx.fillStyle = '#7a3fbf';
      ctx.beginPath();
      ctx.arc(rr * Math.cos(a), rr * Math.sin(a), 0.12 + 0.2 * u, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

function target(ctx, x, y, r, col, t, cross) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = col;
  ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 16);
  ctx.lineWidth = 0.045;
  ctx.setLineDash([0.1, 0.07]);
  ctx.lineDashOffset = -t * 0.6;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  if (cross) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.45, -r * 0.45); ctx.lineTo(r * 0.45, r * 0.45);
    ctx.moveTo(-r * 0.45, r * 0.45); ctx.lineTo(r * 0.45, -r * 0.45);
    ctx.stroke();
  }
  ctx.restore();
}

function arcArrow(ctx, R, mid, dir, len, col) {
  const a0 = mid - (dir * len) / 2, a1 = mid + (dir * len) / 2;
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineWidth = 0.12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, R, Math.min(a0, a1), Math.max(a0, a1));
  ctx.stroke();
  const hx = R * Math.cos(a1), hy = R * Math.sin(a1), tx = -Math.sin(a1) * dir, ty = Math.cos(a1) * dir;
  ctx.beginPath();
  ctx.moveTo(hx + tx * 0.32, hy + ty * 0.32);
  ctx.lineTo(hx - tx * 0.05 + Math.cos(a1) * 0.24, hy - ty * 0.05 + Math.sin(a1) * 0.24);
  ctx.lineTo(hx - tx * 0.05 - Math.cos(a1) * 0.24, hy - ty * 0.05 - Math.sin(a1) * 0.24);
  ctx.closePath();
  ctx.fill();
}

// ---------- under the eggs: heat glow, icicle shadows
export function drawBossUnder(ctx, sim, k, t) {
  const X = sim.bx;
  if (!X) return;
  for (const e of sim.aliveEggs()) {
    const h = heatOf(sim, e);
    if (h < 0.35) continue;
    const p = e.body.getPosition(), f = (h - 0.35) / 0.65, beat = h > 0.85 ? 0.5 + 0.5 * Math.sin(t * 20) : 1;
    const g = ctx.createRadialGradient(p.x, p.y, 0.1, p.x, p.y, 0.55);
    g.addColorStop(0, `rgba(255,120,30,${0.7 * f * beat})`);
    g.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 0.55, 0, TAU);
    ctx.fill();
  }
  for (const I of X.ice) {
    if (I.ph !== 'hang') continue;
    // shadow on whatever it will hit, darker as the drop nears, with a dashed drop line
    const len = I.big ? 0.5 : 0.42, tip = I.y - len, u = clamp01(1 - I.t / I.dur);
    let hy = null, egg = false;
    for (let y = tip - 0.05; y > tip - 5; y -= 0.04) {
      if (sim.aliveEggs().some((e) => { const p = e.body.getPosition(); return Math.hypot(p.x - I.x, p.y - y) < 0.28; })) { hy = y; egg = true; break; }
      const d = Math.hypot(I.x, y);
      if (sim.rings.some((r) => (r.i !== I.ri || y < tip - 0.25) && Math.abs(d - r.r) < RING_TH / 2 && sim.solidAt(r, I.x, y))) { hy = y; break; }
    }
    if (hy == null) continue;
    ctx.save();
    ctx.strokeStyle = egg ? `rgba(255,80,60,${0.5 + 0.4 * u})` : 'rgba(210,240,255,0.55)';
    ctx.lineWidth = 0.025;
    ctx.setLineDash([0.06, 0.06]);
    ctx.beginPath();
    ctx.moveTo(I.x, tip - 0.05);
    ctx.lineTo(I.x, hy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = egg ? `rgba(120,0,0,${0.25 + 0.35 * u})` : `rgba(10,30,60,${0.2 + 0.3 * u})`;
    ctx.beginPath();
    ctx.ellipse(I.x, hy - (egg ? 0.22 : 0), (I.big ? 0.32 : 0.22) * (0.6 + 0.4 * u), 0.07, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

// ---------- over the eggs: icicles, thrown orbs, gale streaks, fog
export function drawBossOver(ctx, sim, k, t) {
  const X = sim.bx;
  if (!X) return;
  const B = X.boss, calm = isSpriteCalm();
  for (const I of X.ice) {
    const len = I.big ? 0.5 : 0.42, sc = I.big ? 1.45 : 1;
    const shake = I.ph === 'hang' && !calm ? Math.sin(t * 55 + I.la * 10) * 0.025 * (0.4 + clamp01(1 - I.t / I.dur)) : 0;
    const grow = I.ph === 'hang' ? Math.min(1, (I.dur - I.t) / 0.25) : 1;
    pxSpace(ctx, I.x + shake, I.y - (len / 2) * grow, k, () => {
      if (I.big) ctx.scale(sc, 1);
      drawIcicle(ctx, 0, 0, len * k * grow, t);
    });
  }
  if (B) {
    for (const T of B.throws) {
      const Q = bossPose(sim) || { x: T.x0, y: T.y0 }, f = clamp01(T.t / 0.6), x = Q.x + (T.x - Q.x) * f, y = Q.y + (T.y - Q.y) * f + Math.sin(Math.PI * f) * 1.2;
      pxSpace(ctx, x, y, k, () => drawOrb(ctx, T.type, 0, 0, 0.2 * k, t, true));
    }
    if (B.fog) {
      const ring = sim.rings[B.fog.ri], f = Math.min(1, B.fog.t / 0.5, (B.fog.dur - B.fog.t) / 0.4);
      ctx.save();
      ctx.globalAlpha = 0.92 * f;
      ctx.fillStyle = '#3d1b5e';
      band(ctx, ring.r - 0.55, ring.r + 0.55);
      ctx.fill();
      for (let j = 0; j < 22; j++) {
        const a = (j / 22) * TAU + t * (j % 2 ? 0.25 : -0.18), rr = ring.r + (hash(j * 3) - 0.5) * 0.8;
        ctx.globalAlpha = 0.6 * f;
        ctx.fillStyle = j % 3 ? '#5b2a8a' : '#7d47b3';
        ctx.beginPath();
        ctx.arc(rr * Math.cos(a), rr * Math.sin(a), 0.28 + 0.12 * hash(j), 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }
  // gale streaks across the whole vault, in the wind's direction
  const g = galeNow(sim);
  if (Math.abs(g) > 0.02) {
    const R = sim.outerR + 1.2, n = calm ? 16 : 44, dir = Math.sign(g), a = Math.min(1, Math.abs(g) * 1.2);
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const sp = 9 + 6 * hash(i), y = (hash(i + 7) * 2 - 1) * R, L = 1.3 + 1.8 * hash(i + 3);
      const x = ((((t * sp * dir + hash(i + 11) * 2 * R) % (2 * R)) + 2 * R) % (2 * R)) - R;
      const wob = 0.06 * Math.sin(t * 6 + i);
      // a dark blue under-stroke so the streaks read on snow, then the white streak
      for (const [c, w, al] of [['rgba(30,70,120,1)', 0.15, 0.4], ['#ffffff', 0.07, 0.95]]) {
        ctx.globalAlpha = a * al * (0.5 + 0.5 * hash(i + 5));
        ctx.strokeStyle = c;
        ctx.lineWidth = w * (0.7 + 0.6 * hash(i + 9));
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x - dir * L * 0.5, y + wob, x - dir * L, y - wob * 0.5);
        ctx.stroke();
      }
    }
    // while it winds up: big chevrons across the top of the vault show which way it will blow
    const B = sim.bx.boss, A = B && B.atk;
    if (A && A.name === 'gale' && A.ph === 'warn') {
      const u = clamp01(1 - A.t / A.dur), y0 = sim.outerR * 0.15;
      ctx.lineWidth = 0.22;
      ctx.lineJoin = 'round';
      for (let i = -2; i <= 2; i++) {
        const x = i * 1.4 + dir * ((t * 2.5) % 1.4), sz = 0.55;
        ctx.globalAlpha = 0.55 * u * (1 - Math.abs(i) / 3);
        for (const [c, w] of [['rgba(30,70,120,1)', 0.34], ['#ffffff', 0.18]]) {
          ctx.strokeStyle = c;
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.moveTo(x - dir * sz, y0 + sz);
          ctx.lineTo(x, y0);
          ctx.lineTo(x - dir * sz, y0 - sz);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }
}

// ---------- the boss itself. Code-drawn only (no portrait sprites inside a level):
// fox / fox king: the game's fox actor peeking over the vault (like the old fox thrower), the king wears a code crown.
// blizzard: a living snow cloud. golem and salamander have no body yet (a creature pass adds them): only their effects.
const ACTOR = { fox: 1, foxking: 1, blizzard: 1 };
export function bossPose(sim) {
  const B = sim.bx && sim.bx.boss;
  if (!B || !ACTOR[B.kind]) return null;
  const R = sim.outerR;
  if (B.kind === 'blizzard') { const h = Math.max(2, R * 0.58); return { x: B.x, y: B.y + h * 0.22, h }; }
  const h = B.kind === 'foxking' ? 1.6 : 1.35;
  return { x: B.x, y: R + 0.45 + (h - 1.15) * 0.4 + (B.y - (R + 0.75)), h };
}
export function drawBossActor(ctx, sim, k, t) {
  const B = sim.bx && sim.bx.boss, Q = bossPose(sim);
  if (!Q) return;
  const A = B.atk, calm = isSpriteCalm();
  const warnU = A && A.ph === 'warn' ? clamp01(1 - A.t / A.dur) : 0, acting = A && A.ph === 'act';
  if (B.kind === 'blizzard') drawCloudBoss(ctx, sim, B, Q, k, t, warnU, acting, calm);
  else drawFoxBoss(ctx, B, Q, k, t, warnU, acting, calm);
  // the freeze breath: a cone of frost from the spirit to the ring it is freezing
  if (A && A.name === 'freeze' && !calm) {
    const ring = sim.rings[A.ring], u = A.ph === 'warn' ? clamp01(1 - A.t / A.dur) : 1;
    ctx.save();
    for (let i = 0; i < 12; i++) {
      const f = ((t * 1.6 + i / 12) % 1) * u, ex = Q.x * (1 - f), ey = Q.y + (ring.r + RING_TH - Q.y) * f;
      ctx.globalAlpha = 0.7 * (1 - f * 0.5);
      ctx.fillStyle = '#e8f8ff';
      ctx.beginPath();
      ctx.arc(ex + (hash(i) - 0.5) * 0.4 * f, ey, 0.05 + 0.08 * f, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

// fox / fox king over the vault: sways, rears back before a throw, laughs after, shocked when it flinches
function drawFoxBoss(ctx, B, Q, k, t, warnU, acting, calm) {
  const sz = Q.h * k;
  let rot = 0, sx = 1, sy = 1, dy = 0, mood = 'smug';
  if (warnU) { mood = 'evil'; rot = -0.24 * warnU; sx = 1 + 0.06 * warnU; sy = 1 - 0.09 * warnU; dy = -0.08 * sz * warnU; }
  else if (acting) mood = 'laugh';
  if (B.flinch > 0) { mood = 'shocked'; rot += Math.sin(t * 40) * 0.1 * B.flinch; }
  if (!calm) { rot += Math.sin(t * 1.4) * 0.04; dy += Math.sin(t * 2.1) * 0.012 * sz; } else rot = 0;
  pxSpace(ctx, Q.x, Q.y, k, () => {
    ctx.translate(0, dy);
    ctx.rotate(rot);
    ctx.scale(sx * (B.face < 0 ? -1 : 1), sy);
    drawFoxActor(ctx, mood, 0, 0, sz, t, { key: 'boss' });
    if (B.kind === 'foxking') drawCrown(ctx, 0, -sz * 0.42, sz * 0.36, t);
  });
}
function drawCrown(ctx, x, y, w, t) {
  const h = w * 0.55;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.12);
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.lineTo(-w / 2, -h * 0.75);
  ctx.lineTo(-w / 4, -h * 0.35);
  ctx.lineTo(0, -h);
  ctx.lineTo(w / 4, -h * 0.35);
  ctx.lineTo(w / 2, -h * 0.75);
  ctx.lineTo(w / 2, 0);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -h, 0, 0);
  g.addColorStop(0, '#fff2a0');
  g.addColorStop(1, '#e0a020');
  ctx.fillStyle = g;
  ctx.strokeStyle = '#7a4a10';
  ctx.lineWidth = Math.max(1, w * 0.05);
  ctx.lineJoin = 'round';
  ctx.fill();
  ctx.stroke();
  const tw = 0.5 + 0.5 * Math.sin(t * 3);
  for (const [gx, col] of [[-w / 4, '#e8344a'], [0, '#3ad1ff'], [w / 4, '#e8344a']]) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(gx, -h * 0.2, w * 0.07, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 0.6 * tw;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, -h, w * 0.06, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// the Blizzard: a living storm cloud. Puffs churn, ice eyes glare; it swells and shivers while winding up, blows
// (round mouth, cheeks out) during a gale, gapes for the freeze breath, and flashes white when an egg is saved.
const PUFFS = [[-0.36, 0.06, 0.24], [-0.17, -0.1, 0.3], [0.08, -0.14, 0.32], [0.3, -0.02, 0.26], [0.42, 0.12, 0.18], [-0.48, 0.16, 0.16], [0.0, 0.12, 0.3]];
function drawCloudBoss(ctx, sim, B, Q, k, t, warnU, acting, calm) {
  const A = B.atk, s = Q.h * k, blow = A && A.name === 'gale' && acting, breathe = A && A.name === 'freeze';
  const dir = A && A.name === 'gale' ? A.dir : B.face || 1;
  const swell = 1 + 0.12 * warnU + (blow ? 0.06 : 0), shiver = calm ? 0 : warnU * Math.sin(t * 50) * 0.012 * s;
  const fl = B.flinch > 0 && !calm && Math.floor(t * 18) % 2 === 0;
  pxSpace(ctx, Q.x, Q.y, k, () => {
    ctx.translate(shiver, 0);
    ctx.scale(swell, swell * (blow ? 0.95 : 1));
    // falling snow under it
    if (!calm) {
      ctx.fillStyle = 'rgba(240,250,255,0.85)';
      for (let i = 0; i < 9; i++) {
        const f = (t * 0.5 + hash(i)) % 1, x = (hash(i + 3) - 0.5) * s * 0.8 + Math.sin(t * 2 + i) * s * 0.03;
        ctx.globalAlpha = 1 - f;
        ctx.beginPath();
        ctx.arc(x, s * 0.2 + f * s * 0.45, s * 0.016, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // body: dark underside first, then light puffs
    for (const pass of [0, 1]) {
      for (let i = 0; i < PUFFS.length; i++) {
        const [px, py, pr] = PUFFS[i], bob = calm ? 0 : Math.sin(t * 1.3 + i * 1.7) * 0.025;
        const x = px * s, y = (py + bob) * s + (pass ? 0 : s * 0.05), r = pr * s * (pass ? 1 : 1.04) * (1 + (calm ? 0 : Math.sin(t * 2 + i) * 0.03));
        if (pass) {
          const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r);
          g.addColorStop(0, fl ? '#ffffff' : '#e2ecf7');
          g.addColorStop(1, fl ? '#e8f4ff' : '#7d93ad');
          ctx.fillStyle = g;
        } else ctx.fillStyle = '#34465e';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
      }
    }
    // face
    ctx.save();
    ctx.scale(dir, 1);
    const ey = -s * 0.04, ex = s * 0.12, er = s * 0.05, glow = 0.6 + 0.4 * (warnU || (acting ? 1 : 0.3 + 0.2 * Math.sin(t * 2)));
    const blink = !calm && (t % 4.3) < 0.12 && !warnU;
    for (const sgn of [-1, 1]) {
      const x = sgn * ex + s * 0.03;
      ctx.fillStyle = '#123a5c';
      ctx.beginPath();
      ctx.ellipse(x, ey, er * 1.25, blink ? er * 0.15 : er, 0, 0, TAU);
      ctx.fill();
      if (!blink) {
        ctx.fillStyle = `rgba(120,230,255,${glow})`;
        ctx.beginPath();
        ctx.arc(x + er * 0.35, ey + er * 0.1, er * 0.55, 0, TAU);
        ctx.fill();
      }
      // angry brow, steeper while winding up
      ctx.strokeStyle = '#123a5c';
      ctx.lineWidth = s * 0.028;
      ctx.lineCap = 'round';
      const tilt = 0.35 + 0.35 * warnU;
      ctx.beginPath();
      ctx.moveTo(x - er * 1.3 * sgn, ey - er * 0.95 + tilt * er * 0.3); // inner end low: an angry V
      ctx.lineTo(x + er * 1.4 * sgn, ey - er * 1.9 - tilt * er * 0.5);
      ctx.stroke();
    }
    // mouth
    const mx = s * 0.05, my = s * 0.09;
    ctx.fillStyle = '#123a5c';
    ctx.beginPath();
    if (blow) ctx.ellipse(mx + s * 0.1, my, s * 0.045, s * 0.055, 0, 0, TAU); // round blowing mouth, to the side
    else if (breathe && (acting || warnU > 0.5)) ctx.ellipse(mx, my + s * 0.01, s * 0.09, s * 0.06, 0, 0, TAU);
    else if (warnU) ctx.ellipse(mx, my, s * 0.08, s * 0.018, 0, 0, TAU); // pressed lips, cheeks full
    else { ctx.moveTo(mx - s * 0.07, my + s * 0.01); ctx.quadraticCurveTo(mx, my - s * 0.03, mx + s * 0.07, my + s * 0.01); ctx.lineWidth = s * 0.022; ctx.strokeStyle = '#123a5c'; ctx.stroke(); }
    ctx.fill();
    if (warnU && !blow) { // cheeks puffed out
      ctx.fillStyle = 'rgba(160,215,255,0.55)';
      for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.arc(mx + sgn * s * 0.15, my - s * 0.01, s * 0.05 * (0.6 + warnU * 0.6), 0, TAU); ctx.fill(); }
    }
    ctx.restore();
  });
}

// the bar's portrait chip: a small code-drawn emblem per boss (screen space, y down)
const EMBLEM_BG = { fox: '#c8601e', foxking: '#8a3fb0', snake: '#2f7a3a', blizzard: '#3f7fb8', golem: '#6a4fc8', salamander: '#c43a14', eagle: '#3a4a78', storm: '#3a4a78' };
function drawBossEmblem(ctx, kind, cx, cy, d, t) {
  const r = d / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fillStyle = EMBLEM_BG[kind] || '#555';
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.strokeStyle = '#ffe3b0';
  ctx.stroke();
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (kind === 'fox' || kind === 'foxking') {
    drawFox(ctx, 0, r * 0.18, r * 1.25, 'smug', t);
    if (kind === 'foxking') { ctx.restore(); ctx.save(); drawCrown(ctx, cx, cy - r * 0.5, r * 0.75, t); }
  } else if (kind === 'blizzard') {
    ctx.strokeStyle = '#eaf8ff';
    ctx.lineWidth = r * 0.14;
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62);
      ctx.lineTo(-Math.cos(a) * r * 0.62, -Math.sin(a) * r * 0.62);
      ctx.stroke();
    }
  } else if (kind === 'golem') {
    ctx.fillStyle = '#d9c8ff';
    ctx.strokeStyle = '#3a2a70';
    ctx.lineWidth = r * 0.08;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.7); ctx.lineTo(r * 0.4, -r * 0.1); ctx.lineTo(r * 0.25, r * 0.6); ctx.lineTo(-r * 0.25, r * 0.6); ctx.lineTo(-r * 0.4, -r * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'salamander') {
    ctx.fillStyle = '#ffd04a';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.72);
    ctx.quadraticCurveTo(r * 0.55, -r * 0.1, r * 0.35, r * 0.4);
    ctx.quadraticCurveTo(0, r * 0.75, -r * 0.35, r * 0.4);
    ctx.quadraticCurveTo(-r * 0.55, -r * 0.1, 0, -r * 0.72);
    ctx.fill();
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.25, r * 0.18, r * 0.28, 0, 0, TAU);
    ctx.fill();
  } else if (kind === 'snake') {
    ctx.strokeStyle = '#9be36a';
    ctx.lineWidth = r * 0.22;
    ctx.beginPath();
    ctx.moveTo(-r * 0.45, r * 0.5);
    ctx.bezierCurveTo(r * 0.6, r * 0.45, -r * 0.6, -r * 0.2, r * 0.35, -r * 0.45);
    ctx.stroke();
  } else { // eagle / storm: a lightning bolt
    ctx.fillStyle = '#ffe14a';
    ctx.beginPath();
    ctx.moveTo(r * 0.15, -r * 0.75); ctx.lineTo(-r * 0.35, r * 0.1); ctx.lineTo(-r * 0.02, r * 0.1); ctx.lineTo(-r * 0.15, r * 0.75); ctx.lineTo(r * 0.38, -r * 0.12); ctx.lineTo(r * 0.04, -r * 0.12);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ---------- the phase bar (screen space, under the HUD plate). Returns nothing; records its text for the QA check.
export function drawBossBar(ctx, ui, sim, x, y, w, h, t) {
  const B = sim.bx && sim.bx.boss;
  if (!B) return;
  const u = ui.u, P = bossPhases(sim), n = Math.max(1, P.length);
  ctx.save();
  ui.roundRect(x, y, w, h, h / 2);
  ctx.fillStyle = 'rgba(20,10,30,0.72)';
  ctx.fill();
  // portrait chip
  const ic = h * 1.15;
  drawBossEmblem(ctx, B.kind, x + ic * 0.45, y + h / 2, ic, t);
  const title = BOSS_TITLE[B.kind] || 'Boss';
  const nameX = x + ic * 0.95, nameW = Math.min(w * 0.34, ui.measure(title, 13 * u) + 4);
  ui.text(title, nameX, y + h / 2, { size: 13 * u, maxW: nameW, color: '#ffe3b0', stroke: 'rgba(0,0,0,0.6)', tag: 'hud:bossName' });
  // phase segments
  const bx = nameX + nameW + 8 * u, bw = x + w - 6 * u - bx, by = y + h * 0.22, bh = h * 0.56, gap = 4 * u;
  const sw = (bw - gap * (n - 1)) / n, prog = bossProgress(sim);
  const warn = B.atk && B.atk.ph === 'warn';
  for (let i = 0; i < n; i++) {
    const sx = bx + i * (sw + gap);
    ui.roundRect(sx, by, sw, bh, bh / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fill();
    const f = i < B.phase ? 1 : i === B.phase ? (i === n - 1 ? 1 : prog) : 0;
    if (f > 0) {
      ui.roundRect(sx, by, Math.max(bh, sw * f), bh, bh / 2);
      const hot = i === B.phase;
      ctx.fillStyle = hot ? (warn && Math.floor(t * 8) % 2 ? '#ff6a3d' : '#ff9a3d') : 'rgba(255,154,61,0.45)';
      ctx.fill();
    }
  }
  const label = warn ? (ATTACK_NAME[B.atk.name] || '').toUpperCase() + '!' : `PHASE ${B.phase + 1}/${n}`;
  ui.text(label, bx + bw / 2, y + h / 2, { size: 12 * u, align: 'center', maxW: bw - 8 * u, color: '#fff', stroke: 'rgba(0,0,0,0.75)', tag: 'hud:bossPhase' });
  ctx.restore();
}

// ---------- magnet (v3.1): no tether line. Each egg of a magnet pair wears a pulsing horseshoe field: thin arcs
// that ripple outward on the side facing its partner, red at one tip and blue at the other.
export function drawMagnetField(ctx, sim, t) {
  for (const e of sim.aliveEggs()) {
    if (!(e.magnet > 0) || !e.joint) continue;
    const o = e.joint.a === e ? e.joint.b : e.joint.a;
    if (!o || !o.alive || o.saved || !o.body) continue;
    const p = e.body.getPosition(), q = o.body.getPosition(), dir = Math.atan2(q.y - p.y, q.x - p.x);
    const fade = Math.min(1, e.magnet / 0.6);
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const f = (t * 0.9 + i / 3 + (e.id % 2) * 0.17) % 1, R = 0.33 + 0.34 * f, span = 1.0 - 0.35 * f;
      ctx.globalAlpha = fade * (1 - f) * 0.9;
      ctx.lineWidth = 0.028 * (1 - 0.4 * f);
      ctx.strokeStyle = '#ff4f5e';
      ctx.beginPath();
      ctx.arc(p.x, p.y, R, dir - span, dir);
      ctx.stroke();
      ctx.strokeStyle = '#4f8dff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, R, dir, dir + span);
      ctx.stroke();
      // tips
      for (const [a, c] of [[dir - span, '#ff4f5e'], [dir + span, '#4f8dff']]) {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(p.x + R * Math.cos(a), p.y + R * Math.sin(a), 0.03 * (1 - 0.4 * f), 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
