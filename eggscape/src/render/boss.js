// ---------- bosses (v3.1): drawing ----------
// The boss actor (code-drawn: Old Frostbeard the mammoth, render/mammoth.js; the thief bosses live in the vault, others show only their effects), every telegraph (frost
// creeping over a ring, icicles shaking with a shadow under them, target marks for rocks and throws, the punch
// arrow, fog gathering), the gale streaks, temporary walls and ice patches, and the phase bar under the HUD.
// ctx is in world space (meters, y up) unless a function says otherwise.
import { RING_TH, TAU } from '../sim/geom.js';
import { ringPoint, galeNow, heatOf, bossPhases, bossProgress, BOSS_TITLE, ATTACK_NAME } from '../sim/boss.js';
import { isSpriteCalm } from './sprites.js';
import { drawThiefEmblem } from './thieves.js';
import { drawKingEmblem, drawKingBar } from './kingcrab.js'; // world 8 boss
import { drawOwlBoss, drawOwlRings, drawOwlEmblem, drawOwlBar } from './owl.js'; // v4 the Clockwork Owl
import { drawGatorEmblem } from './bayou.js'; // v3.7
import { drawIcicle } from './v3art.js';
import { drawMammoth, drawMammothEmblem, MAMMOTH_FOOT } from './mammoth.js'; // world 3 boss: Old Frostbeard
import { drawMovesRings, drawMovesOver } from './bossmoves.js'; // the variety moves (sim/bossmoves.js)
import { drawGolem } from './golem.js'; // world 4 boss: the Crystal Golem
import { drawOrb } from './powers.js';
import { statusClock, statusKind, statusDraw, dizzyStars } from './status.js';

const pxSpace = (ctx, x, y, k, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(1 / k, -1 / k); try { f(); } catch (e) { if (globalThis.__eggDebug) console.error(e); /* art never breaks the frame */ } ctx.restore(); };
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const band = (ctx, ri, ro, a0 = 0, a1 = TAU) => { ctx.beginPath(); ctx.arc(0, 0, ro, a0, a1); ctx.arc(0, 0, ri, a1, a0, true); ctx.closePath(); };

// ---------- on and around the rings (after the rings, before the eggs)
export function drawBossRings(ctx, sim, k, t) {
  const X = sim.bx;
  if (!X) return;
  const B = X.boss, A = B && B.atk;
  if (B && B.kind === 'owl') drawOwlRings(ctx, sim, k, t); // v4: swoop mark, wind-up arrows, gear bombs
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
    if (!W.alive || W.kind === 'cage') continue; // cage crystals: render/bossmoves.js
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
  drawMovesRings(ctx, sim, k, t); // the variety moves: telegraphs and what they leave on the rings
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
    ctx.strokeStyle = egg ? `rgba(255,80,60,${0.6 + 0.4 * u})` : 'rgba(210,240,255,0.7)';
    ctx.lineWidth = 0.04;
    ctx.setLineDash([0.08, 0.07]);
    ctx.beginPath();
    ctx.moveTo(I.x, tip - 0.05);
    ctx.lineTo(I.x, hy);
    ctx.stroke();
    ctx.setLineDash([]);
    // the landing mark: a dark shadow that grows and darkens, ringed (red when an egg is under it)
    const mw = (I.big ? 0.48 : 0.36) * (0.65 + 0.35 * u), my = hy - (egg ? 0.24 : 0), pulse = 1 + 0.08 * Math.sin(t * 18);
    ctx.fillStyle = egg ? `rgba(120,0,0,${0.3 + 0.35 * u})` : `rgba(10,30,60,${0.3 + 0.3 * u})`;
    ctx.beginPath();
    ctx.ellipse(I.x, my, mw, 0.1, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = egg ? `rgba(255,70,50,${0.7 + 0.3 * u})` : 'rgba(225,245,255,0.85)';
    ctx.lineWidth = 0.045;
    ctx.beginPath();
    ctx.ellipse(I.x, my, mw * pulse, 0.13 * pulse, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

// ---------- over the eggs: icicles, thrown orbs, gale streaks, fog
export function drawBossOver(ctx, sim, k, t) {
  const X = sim.bx;
  if (!X) return;
  drawMovesOver(ctx, sim, k, t); // the variety moves: shard rain, dive shadow, gust streaks
  const B = X.boss, calm = isSpriteCalm();
  // icicles: drawn about twice the sim size (wide, a little long) so they read on a phone, with a travelling glint
  for (const I of X.ice) {
    const len = (I.big ? 0.5 : 0.42) * 1.25, sc = I.big ? 2.6 : 1.9;
    const shake = I.ph === 'hang' && !calm ? Math.sin(t * 55 + I.la * 10) * 0.03 * (0.4 + clamp01(1 - I.t / I.dur)) : 0;
    const grow = I.ph === 'hang' ? Math.min(1, (I.dur - I.t) / 0.25) : 1;
    pxSpace(ctx, I.x + shake, I.y - (len / 2) * grow, k, () => {
      ctx.save();
      ctx.scale(sc, 1);
      drawIcicle(ctx, 0, 0, len * k * grow, t);
      ctx.restore();
      if (!calm) { // a white glint sliding down the spike
        const g = (t * 1.3 + I.la) % 1, gy = (-0.4 + 0.75 * g) * len * k * grow, r = len * k * 0.12 * Math.sin(Math.PI * g);
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.beginPath();
        ctx.moveTo(0, gy - r); ctx.lineTo(r * 0.25, gy - r * 0.25); ctx.lineTo(r, gy); ctx.lineTo(r * 0.25, gy + r * 0.25);
        ctx.lineTo(0, gy + r); ctx.lineTo(-r * 0.25, gy + r * 0.25); ctx.lineTo(-r, gy); ctx.lineTo(-r * 0.25, gy - r * 0.25);
        ctx.closePath();
        ctx.fill();
      }
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
  // gale / gust streaks: arcs that swirl along the channels (the way the wind shoves), dir +1 = counter-clockwise
  const g = galeNow(sim);
  if (Math.abs(g) > 0.02) {
    const Ro = sim.outerR, n = calm ? 18 : 48, dir = Math.sign(g), a = Math.min(1, Math.abs(g) * 1.2);
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const r = 0.7 + hash(i + 7) * (Ro + 0.3), sp = 7 + 5 * hash(i), L = 1.2 + 1.6 * hash(i + 3);
      const head = hash(i + 11) * TAU + (t * sp * dir) / r, span = Math.min(1.2, L / r);
      const a0 = dir > 0 ? head - span : head, a1 = dir > 0 ? head : head + span;
      for (const [c, w, al] of [['rgba(30,70,120,1)', 0.13, 0.35], ['#ffffff', 0.06, 0.9]]) {
        ctx.globalAlpha = a * al * (0.5 + 0.5 * hash(i + 5));
        ctx.strokeStyle = c;
        ctx.lineWidth = w * (0.7 + 0.6 * hash(i + 9));
        ctx.beginPath();
        ctx.arc(0, 0, r, a0, a1);
        ctx.stroke();
      }
    }
    // while it winds up: chevrons around the rim point the way it will blow
    const B = sim.bx.boss, A = B && B.atk, G2 = sim.bx.gust;
    const warn = (A && A.name === 'gale' && A.ph === 'warn') || (G2 && G2.ph === 'warn');
    if (warn) {
      const u = A && A.name === 'gale' && A.ph === 'warn' ? clamp01(1 - A.t / A.dur) : clamp01(1 - G2.t / G2.dur);
      const rr = Ro + 0.45, sz = 0.4;
      ctx.lineJoin = 'round';
      for (let i = 0; i < 8; i++) {
        const an = (i * TAU) / 8 + dir * ((t * 0.6) % (TAU / 8)), cx = rr * Math.cos(an), cy = rr * Math.sin(an);
        const tx = -Math.sin(an) * dir, ty = Math.cos(an) * dir, nx = Math.cos(an), ny = Math.sin(an);
        ctx.globalAlpha = 0.75 * u;
        for (const [c, w] of [['rgba(30,70,120,1)', 0.3], ['#ffffff', 0.15]]) {
          ctx.strokeStyle = c;
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.moveTo(cx - tx * sz + nx * sz, cy - ty * sz + ny * sz);
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx - tx * sz - nx * sz, cy - ty * sz - ny * sz);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }
}

// ---------- the boss itself. Code-drawn only (no portrait sprites inside a level):
// blizzard: Old Frostbeard, a woolly mammoth on an ice floe (render/mammoth.js). golem: render/golem.js.
// The weasel and the Rat King live inside the vault (render/thieves.js).
const ACTOR = { blizzard: 1, golem: 1, owl: 1 };
// the view this frame (main sets it): world y of the top of the play area, pixels per meter, ui scale
let VIEW = null;
export function setBossView(v) { VIEW = v; }
// view = false: where the boss is in the world (for framing); default: where it is drawn this frame
export function bossPose(sim, view = VIEW) {
  const B = sim.bx && sim.bx.boss;
  if (!B || !ACTOR[B.kind] || B.den) return null; // v3.6: a thief boss is drawn inside the vault (render/thieves.js)
  const R = sim.outerR;
  if (B.kind === 'owl') return { x: B.x, y: B.y, h: 1.9, dir: B.face || 1 }; // v4 (render/owl.js)
  if (B.kind === 'blizzard' || B.kind === 'golem') {
    // big: about a third of the vault wide (at most ~150 px tall on screen), its belly just above the outer ring.
    // When the camera is zoomed in on the eggs it comes down into view at the top of the play area.
    const A = B.atk, cap = view ? (160 * (view.u || 1)) / view.k : 1e9, h = Math.min(Math.max(3.4, R * 0.95), cap);
    // the golem never steers the camera (no framing pose): L20 keeps the camera it always had, and the golem is simply
    // brought into view at the top of the play area below. (Opening on it zoomed the six big rings in far enough to
    // blow the ring caches up and cost ~50 ms a frame.)
    if (!view && B.kind === 'golem') return null;
    let y = R + 0.25 + h * 0.44 + (B.y - (R + 1.0));
    if (view) y = Math.min(y, view.top - h * 0.5);
    const x = B.kind === 'golem' ? Math.max(-R * 0.28, Math.min(R * 0.28, B.x)) : B.x; // the golem's sim point roams wider than a body this size can (it would leave a phone screen)
    return { x, y, h, dir: A && A.name === 'gale' ? -A.dir : B.face || 1 };
  }
  return null;
}
export function drawBossActor(ctx, sim, k, t) {
  const B = sim.bx && sim.bx.boss, Q = bossPose(sim);
  if (!Q) return;
  const A = B.atk, calm = isSpriteCalm();
  const warnU = A && A.ph === 'warn' ? clamp01(1 - A.t / A.dur) : 0, acting = A && A.ph === 'act';
  // blizzard (L15): no figure. The owner wants villains inside the vault or none; the storm itself attacks.
  if (B.kind === 'golem') drawBigBoss(ctx, drawGolem, sim, B, Q, k, t, warnU, acting, calm);
  if (B.kind === 'owl') drawOwlBoss(ctx, sim, k, t);
  // the frost stomp: once the foot is down (45% into the warning) frost cracks race from it to the ring it freezes
  if (A && A.name === 'freeze' && B.kind === 'blizzard' && !calm) {
    const ring = sim.rings[A.ring], u = acting ? 1 : clamp01((warnU - 0.45) / 0.55), d = Q.dir || 1;
    const fa0 = Math.atan2(Q.y, Q.x), fx = Math.cos(fa0) * (sim.outerR + 0.15), fy = Math.sin(fa0) * (sim.outerR + 0.15), fa = fa0, rr = ring.r + RING_TH * 0.5;
    const ex = Math.cos(fa) * rr, ey = Math.sin(fa) * rr, L = Math.hypot(ex - fx, ey - fy) || 1, nx = -(ey - fy) / L, ny = (ex - fx) / L, n = 8;
    if (u > 0) {
      ctx.save();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const P = [];
      for (let i = 0; i <= n; i++) { const f = i / n, o = i && i < n ? (hash(i + A.ring * 7) - 0.5) * 0.34 : 0; P.push([fx + (ex - fx) * f + nx * o, fy + (ey - fy) * f + ny * o]); }
      const m = u * n, fade = acting ? clamp01(A.t / A.dur) : 1;
      ctx.beginPath();
      ctx.moveTo(P[0][0], P[0][1]);
      for (let i = 1; i <= n; i++) {
        const g = clamp01(m - (i - 1));
        if (g <= 0) break;
        const x = P[i - 1][0] + (P[i][0] - P[i - 1][0]) * g, y = P[i - 1][1] + (P[i][1] - P[i - 1][1]) * g;
        ctx.lineTo(x, y);
        if (g >= 1 && i % 2 === 0 && i < n) { const sgn = hash(i + 3) < 0.5 ? -1 : 1, bl = 0.22 + 0.2 * hash(i + 5); ctx.lineTo(x + nx * sgn * bl + (ex - fx) / L * 0.14, y + ny * sgn * bl + (ey - fy) / L * 0.14); ctx.moveTo(x, y); }
      }
      ctx.globalAlpha = 0.7 * fade; ctx.strokeStyle = '#4f9ed6'; ctx.lineWidth = 0.13; ctx.stroke();
      ctx.globalAlpha = fade; ctx.strokeStyle = '#f2fbff'; ctx.lineWidth = 0.055; ctx.stroke();
      ctx.restore();
    }
  }
}

// Old Frostbeard (render/mammoth.js) and the Crystal Golem (render/golem.js), inside the shared status looks
// (frozen = holds its pose in an ice shell; stunned = dizzy, a bolt zaps first).
function drawBigBoss(ctx, draw, sim, B, Q, k, t, warnU, acting, calm) {
  const fxb = sim.p2 && sim.p2.fx && sim.p2.fx.b, iced = B.dizzy > 0 && ((fxb && fxb.k === 'ice') || statusKind('b') === 'ice');
  const st = statusClock(sim, 'b', iced ? { k: 'ice', left: B.dizzy } : B.dizzy > 0 ? { k: 'stun', zap: !!(fxb && fxb.k === 'zap'), left: B.dizzy } : null, t);
  const frozen = !!(st && st.k === 'ice');
  if (frozen) { t = st.hold; calm = true; }
  const s = Q.h * k;
  pxSpace(ctx, Q.x, Q.y, k, () => statusDraw(ctx, { x0: -0.82 * s, y0: -0.8 * s, x1: 0.82 * s, y1: 0.58 * s }, (c) => draw(c, sim, B, Q, s, t, warnU, acting, calm, frozen), st, { off: Math.max(1.2, s * 0.011), rim: 1.8, crys: Math.max(1.2, s / 110) }));
}
function drawStar(ctx, x, y, r, col) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath();
  ctx.fillStyle = col;
  ctx.fill();
  ctx.strokeStyle = '#8a5a00';
  ctx.lineWidth = r * 0.15;
  ctx.stroke();
}

// the bar's portrait chip: a small code-drawn emblem per boss (screen space, y down)
const EMBLEM_BG = { weasel: '#4f7a3a', ratking: '#6a2f8a', snake: '#2f7a3a', blizzard: '#3f7fb8', golem: '#6a4fc8', salamander: '#c43a14', eagle: '#3a4a78', storm: '#3a4a78', kingcrab: '#1f6a96', owl: '#1d3a5c', gator: '#2f5a3a' };
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
  if (kind === 'weasel' || kind === 'ratking') {
    drawThiefEmblem(ctx, kind, r, t);
  } else if (kind === 'kingcrab') {
    drawKingEmblem(ctx, r, t);
  } else if (kind === 'owl') {
    drawOwlEmblem(ctx, r, t);
  } else if (kind === 'gator') {
    drawGatorEmblem(ctx, r, t);
  } else if (kind === 'blizzard') {
    ctx.strokeStyle = '#eaf6ff'; ctx.lineWidth = Math.max(1.5, r * 0.16); ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const q = (i * Math.PI) / 3; ctx.beginPath(); ctx.moveTo(-Math.cos(q) * r * 0.62, -Math.sin(q) * r * 0.62); ctx.lineTo(Math.cos(q) * r * 0.62, Math.sin(q) * r * 0.62); ctx.stroke(); }
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
    ctx.lineJoin = 'round'; ctx.strokeStyle = '#3a2a00'; ctx.lineWidth = r * 0.12; ctx.stroke();
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
  const F = (B.den && sim.thiefBoss && sim.thiefBoss()) || (B.kind === 'gator' && sim.gatorBossBar && sim.gatorBossBar()); // v3.7: Grandpa's teeth
  if (F) { drawDenBar(ctx, ui, F, B, bx, bw, y, by, bh, h, gap, t); ctx.restore(); return; } // v3.5: hit pips
  if (B.kind === 'kingcrab' && sim.kc) { drawKingBar(ctx, ui, sim, B, bx, bw, y, by, bh, h, gap, t); ctx.restore(); return; } // world 8: shell pips
  if (B.kind === 'owl' && sim.owl) { drawOwlBar(ctx, ui, sim, B, bx, bw, y, by, bh, h, gap, t); ctx.restore(); return; } // v4: gear pips
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

// v3.6 thief boss: one pip per hit it can take (lit = hits left), and what it is doing now
function drawDenBar(ctx, ui, F, B, bx, bw, y, by, bh, h, gap, t) {
  const u = ui.u, n = Math.max(1, F.hpMax), sw = (bw - gap * (n - 1)) / n;
  const warn = B.atk && B.atk.ph === 'warn', ph = F.ph;
  const hot = ph === 'trapped' || ph === 'hurt';
  for (let i = 0; i < n; i++) {
    const sx = bx + i * (sw + gap);
    ui.roundRect(sx, by, sw, bh, bh / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fill();
    if (i < F.hp) {
      ui.roundRect(sx, by, sw, bh, bh / 2);
      ctx.fillStyle = hot ? (Math.floor(t * 6) % 2 ? '#ffd63c' : '#ffb03c') : ph === 'crouch' ? '#ff6a3d' : '#ff9a3d';
      ctx.fill();
    }
  }
  const label = F.label || (F.hp <= 0 || ph === 'defeated' || ph === 'flee' || ph === 'gone' ? 'DEFEATED!'
    : ph === 'trapped' ? 'TRAPPED! HIT IT' : ph === 'crouch' ? 'POUNCE!' : F.eid ? 'STOLE AN EGG!'
      : warn ? (ATTACK_NAME[B.atk.name] || '').toUpperCase() + '!' : 'TRAP IT!');
  ui.text(label, bx + bw / 2, y + h / 2, { size: 12 * u, align: 'center', maxW: bw - 8 * u, color: '#fff', stroke: 'rgba(0,0,0,0.75)', tag: 'hud:bossPhase' });
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
