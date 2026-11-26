// Speed test (2026-11-20, Settings > Display > Speed test). Headless numbers have misled us before, so this runs on the
// player's own phone: about 13 s, then ONE results screen the owner can screenshot and send.
//
//   1. the screen's refresh interval (median gap of rAF callbacks while drawing almost nothing);
//   2. a villain-heavy play scene (level 20, Quartz Maze: the Duke Quartz boss, its thorn-back crawler, portals, three
//      eggs; a real Sim stepped at the normal 120 steps a second, the rings turned like a player) drawn with the game's
//      own art at each of Auto's six graphics steps (High 2x ... Low 0.8x);
//   3. four micro tests that separate the causes: one full-screen drawImage blit (compositing / fill rate), one
//      full-screen gradient fill (raster of a big gradient), 200 small path fills (path raster / command count), and
//      50 sprite drawImage calls (texture draws).
// For each: frame gap rAF-to-rAF (median and 95th percentile), how many frames came LATE (later than the game's
// cadence on this screen allows: every refresh at 60 / 90 Hz, every second one at 120 / 144 Hz, plus half a refresh),
// and the JS work per frame (time to step the world and issue the canvas commands; the raster happens after, off the
// JS thread, and shows only in the gap). The gap minus the JS work is the part the graphics chip / compositor takes.
//
// Nothing saved changes unless the player taps "Use best setting" (Auto then starts from the best step that held the
// pace). main.js passes in what this needs (see openSpeedTest) and hands its frame loop over while the test runs.

import { Sim, DT } from './sim/sim.js';
import { LEVELS } from './data/levels.js';
import { THEMES, createBackdrop } from './themes.js';
import { PERF, STEPS, TIER_NAME, deviceGuess, benchStep } from './perf.js';
import * as W from './render/world.js';
import { drawBossRings, drawBossUnder, drawBossOver, drawBossActor, setBossView } from './render/boss.js';
import { drawSalamanders, drawSalHeat } from './render/salamander.js';
import { drawBayou, drawBayouOver } from './render/bayou.js';
import { drawThieves, drawThievesOver } from './render/thieves.js';
import { drawClockwork } from './render/clockwork.js';
import { drawOrb } from './render/powers.js';
import { stampStats } from './render/stamp.js';

const LEVEL_ID = 24; // (0.8.17: 20 on the 50-level road; the same level)
// seconds per graphics step / per micro test. A step's warm-up lasts until the art stops baking pictures for the new
// resolution (at least WARM, at most WARM_MAX); frames right after a bake are not counted (like the Auto governor)
const WARM = 0.3, WARM_MAX = 1.6, MEASURE = 1.2, MWARM = 0.2, MMEASURE = 0.7;

let T = null; // the running test (null when closed)

export const speedTest = {
  get active() { return !!T; },
  frame(now) { if (T) step(now); },
};
if (typeof window !== 'undefined') window.__eggSpeed = speedTest; // for tools/perf87/speedshot.cjs (read-only)

// env: { canvas, ctx, save, persist(), done() (main re-sizes its canvas and goes on), font }
export function openSpeedTest(env) {
  if (T) return;
  const L = LEVELS.find((l) => l.id === LEVEL_ID) || LEVELS[0];
  T = {
    env, L, phase: 'hz', t0: 0, last: 0, gaps: [], work: [], hz: [], iv: 1000 / 60, every: 1,
    keep: { step: PERF.step, dprCap: PERF.dprCap },
    jobs: [], ji: -1, res: [], sim: null, bd: null, theme: null, simT: 0, acc: 0, rnd: 1,
    buttons: [], sprite: null, blit: null,
  };
  for (let i = 0; i < STEPS.length; i++) T.jobs.push({ kind: 'scene', step: i, name: `${TIER_NAME[STEPS[i][0]]} ${STEPS[i][1]}x` });
  for (const m of ['blit', 'gradient', 'paths200', 'sprites50']) T.jobs.push({ kind: m, step: 0, name: MICRO_NAME[m] });
  // input: while the test (or its results) shows, its taps never reach the game below
  T.down = (e) => { e.stopImmediatePropagation(); e.preventDefault(); tap(e); };
  T.swallow = (e) => { e.stopImmediatePropagation(); };
  env.canvas.addEventListener('pointerdown', T.down, { capture: true });
  for (const k of ['pointerup', 'pointermove', 'pointercancel']) window.addEventListener(k, T.swallow, { capture: true });
}

const MICRO_NAME = { blit: 'Full-screen image', gradient: 'Full-screen gradient', paths200: '200 small shapes', sprites50: '50 sprites' };

function close(useBest) {
  const { env } = T;
  env.canvas.removeEventListener('pointerdown', T.down, { capture: true });
  for (const k of ['pointerup', 'pointermove', 'pointercancel']) window.removeEventListener(k, T.swallow, { capture: true });
  benchStep(T.keep.step, T.keep.dprCap);
  if (useBest && T.best >= 0) {
    env.save.gfx = 'auto'; env.save.gfxStep = T.best;
    env.applySettings();
    env.persist();
  }
  T = null;
  env.done();
}

function tap(e) {
  if (!T) return;
  const r = T.env.canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  if (T.phase !== 'done') { if (y < 70) close(false); return; } // a tap on the top bar stops the test early
  for (const b of T.buttons) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { close(b.id === 'best'); return; }
}

function size(dpr) {
  const { canvas } = T.env, w = Math.max(320, window.innerWidth), h = Math.max(320, window.innerHeight);
  const cw = Math.round(w * dpr), ch = Math.round(h * dpr);
  if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
  T.w = w; T.h = h; T.dpr = dpr;
}
const devDpr = () => window.devicePixelRatio || 1;

function startJob(i, now) {
  T.ji = i; T.gaps = []; T.work = []; T.t0 = now; T.last = 0; T.bakeT = now; T.mt0 = 0; T.bakedPrev = false;
  const J = T.jobs[i];
  if (!J) { finish(); return; }
  if (J.kind === 'scene') {
    benchStep(J.step);
    size(Math.min(devDpr(), STEPS[J.step][1]));
    if (!T.sim) {
      T.sim = new Sim(T.L, { mode: 'medium' });
      T.theme = THEMES.find((t) => t.id === T.L.theme) || THEMES[0];
      T.bd = createBackdrop(T.theme, T.L.id * 97);
    }
    try { T.bd.resize(T.w, T.h, T.dpr); } catch (_) { /* a backdrop that cannot size: drawn plain */ }
  } else {
    benchStep(0);
    size(Math.min(devDpr(), 2));
    prepMicro();
  }
}

function finish() {
  T.phase = 'done';
  benchStep(T.keep.step, T.keep.dprCap);
  size(Math.min(devDpr(), 2));
  const budget = Math.max(T.iv * T.every, 1000 / 60) * 1.5;
  T.best = -1;
  for (const r of T.res) if (r.kind === 'scene' && r.late <= 5 && r.p95 <= budget * 1.1) { T.best = r.step; break; }
  if (T.best < 0) T.best = STEPS.length - 1;
  try { T.gpu = (PERF.guess || deviceGuess()).gpu || ''; } catch (_) { T.gpu = ''; }
}

function step(now) {
  const dt = T.last ? now - T.last : 0;
  if (T.phase === 'done') { drawResults(); return; }
  if (T.phase === 'hz') { // the screen's refresh: callbacks while drawing almost nothing
    if (!T.t0) { T.t0 = now; size(Math.min(devDpr(), 2)); }
    if (T.last && dt > 3 && dt < 60) T.hz.push(dt);
    T.last = now;
    const { ctx } = T.env; ctx.setTransform(T.dpr, 0, 0, T.dpr, 0, 0); ctx.fillStyle = '#1b1410'; ctx.fillRect(0, 0, T.w, T.h); label('Speed test: measuring the screen...');
    if (now - T.t0 > 600 && T.hz.length >= 20) {
      const s = T.hz.slice().sort((a, b) => a - b); T.iv = s[s.length >> 1];
      T.every = Math.max(1, Math.floor((1000 / 60) / T.iv + 0.1)); // the game's own cap: never faster than 60 fps
      T.phase = 'run'; startJob(0, now);
    }
    return;
  }
  // the game's pacing: draw every `every` refreshes
  if (T.last && now - T.last < T.every * T.iv - T.iv * 0.5) return;
  const J = T.jobs[T.ji], el = (now - T.t0) / 1000;
  const meas = J.kind === 'scene' ? MEASURE : MMEASURE;
  if (!T.mt0 && (J.kind === 'scene' ? (el > WARM && now - T.bakeT > 250) || el > WARM_MAX : el > MWARM)) T.mt0 = now;
  const w0 = performance.now(), b0 = stampStats.builds;
  try { if (J.kind === 'scene') scene(T.last ? Math.min(0.1, dt / 1000) : 1 / 60); else micro(J.kind); } catch (e) { J.err = String(e && e.message || e).slice(0, 60); }
  const work = performance.now() - w0, baked = stampStats.builds !== b0;
  if (baked) T.bakeT = now;
  label(`Speed test ${T.ji + 1}/${T.jobs.length}: ${J.name}   (tap here to stop)`);
  if (T.last && T.mt0 && !T.bakedPrev) { T.gaps.push(dt); T.work.push(work); }
  T.bakedPrev = baked;
  T.last = now;
  if (T.mt0 && now - T.mt0 > meas * 1000) {
    const g = T.gaps.slice().sort((a, b) => a - b), q = (p) => g.length ? g[Math.min(g.length - 1, Math.floor(g.length * p))] : 0;
    const lateAt = (T.every + 0.5) * T.iv;
    T.res.push({ kind: J.kind, step: J.step, name: J.name, n: g.length, med: q(0.5), p95: q(0.95), late: g.length ? 100 * g.filter((x) => x > lateAt).length / g.length : 0, js: T.work.length ? T.work.reduce((a, b) => a + b, 0) / T.work.length : 0, err: J.err });
    startJob(T.ji + 1, now);
  }
}

function label(text) {
  const { ctx } = T.env;
  ctx.setTransform(T.dpr, 0, 0, T.dpr, 0, 0);
  ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, T.w, 44);
  ctx.fillStyle = '#fff'; ctx.font = `600 14px ${T.env.font}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillText(text, 12, 22, T.w - 24);
}

// ---- the play scene: the game's own art for level 20, laid out like play (vault fitted to the screen)
function scene(dt) {
  const { ctx } = T.env, sim = T.sim;
  // a player turning rings: a new target now and then
  if (sim.state === 'play' && sim.t >= (T.until || 0)) {
    T.rnd = (T.rnd * 1103515245 + 12345) & 0x7fffffff;
    const R = sim.rings[T.rnd % sim.rings.length]; T.until = sim.t + 0.4 + (T.rnd % 1000) / 1000;
    if (R && !R.motor) R.target = R.body.getAngle() + ((T.rnd >> 3) % 2 ? 0.6 : -0.6);
  }
  T.acc = Math.min(T.acc + dt, 0.1);
  while (T.acc >= DT * 0.75) { if (sim.state === 'play') sim.step(); sim.events.length = 0; T.acc -= DT; }
  if (sim.state !== 'play') { T.sim = new Sim(T.L, { mode: 'medium' }); } // a decided level starts over (keeps the scene busy)
  T.simT += dt;
  const t = T.simT, w = T.w, h = T.h;
  ctx.setTransform(T.dpr, 0, 0, T.dpr, 0, 0);
  ctx.globalAlpha = 1;
  const R = sim.outerR + 0.6, k = Math.min(w / (2 * R), (h * 0.78) / (2 * R + 1.4)), cx = w / 2, cy = h * 0.47;
  const cam = { x: 0, y: 0, zoom: 1 };
  try { T.bd.draw(ctx, t, cam); } catch (_) { ctx.fillStyle = '#2a3550'; ctx.fillRect(0, 0, w, h); }
  const gy = cy - (sim.groundY - 0) * k;
  try { if (gy < h && !sim.water) T.bd.drawGround(ctx, 0, gy, w, h - gy, t, { x: cx + sim.nest.getPosition().x * k, k, nw: sim.nestW }); } catch (_) { /* no ground art */ }
  ctx.setTransform(T.dpr, 0, 0, T.dpr, 0, 0);
  ctx.translate(cx, cy); ctx.scale(k, -k);
  const L = (f) => { try { ctx.save(); f(); } catch (_) { /* one layer missing never stops the test */ } finally { ctx.restore(); } };
  L(() => W.drawVaultBack(ctx, sim, T.theme));
  L(() => { for (const pt of sim.portals) { W.drawPortalLink && W.drawPortalLink(ctx, pt, t); W.drawPortalPull && W.drawPortalPull(ctx, pt, t); W.drawPortal(ctx, pt.ax, pt.ay, t, false); W.drawPortal(ctx, pt.bx, pt.by, t, true); } });
  L(() => W.drawNest(ctx, sim, T.theme, t, sim.savedLog.length, null, t));
  const eggs = sim.aliveEggs(), eggPts = eggs.map((e) => e.body.getPosition());
  for (const ring of sim.rings) L(() => { W.drawRing(ctx, ring, T.theme, k, t, { eggs: eggPts, simT: sim.t, stuck: [], water: sim.water }); W.drawV3Ring(ctx, ring, k, t, T.theme); });
  setBossView({ top: (h * 0.47) / k, k, u: Math.min(w, h) / 400 });
  L(() => drawBossRings(ctx, sim, k, t));
  L(() => drawSalHeat(ctx, sim, k, t));
  L(() => drawBossActor(ctx, sim, k, t));
  L(() => { for (const o of sim.orbs) if (o.alive) { ctx.save(); ctx.translate(o.x, o.y); ctx.scale(1 / k, -1 / k); drawOrb(ctx, o.type, 0, 0, 0.2 * k, t, true); ctx.restore(); } });
  L(() => drawBossUnder(ctx, sim, k, t));
  L(() => drawSalamanders(ctx, sim, t, k));
  L(() => drawThieves(ctx, sim, t, k));
  L(() => drawClockwork(ctx, sim, t, k));
  L(() => drawBayou(ctx, sim, t, k));
  for (const e of eggs) L(() => W.drawEgg(ctx, e, t, k));
  L(() => drawThievesOver(ctx, sim, t, k));
  L(() => drawBayouOver(ctx, sim, t, k));
  L(() => W.drawSnakes && W.drawSnakes(ctx, sim, t, k));
  L(() => drawBossOver(ctx, sim, k, t));
  L(() => W.drawEagleAt && W.drawEagleAt(ctx, sim, t, k));
  ctx.setTransform(T.dpr, 0, 0, T.dpr, 0, 0);
  try { T.bd.drawAmbient(ctx, t, cam); } catch (_) { /* none */ }
}

// ---- micro tests (all at the High resolution, the same pictures every frame)
function prepMicro() {
  const { w, h, dpr } = T;
  if (!T.blit || T.blit.width !== Math.round(w * dpr)) {
    const c = document.createElement('canvas'); c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, c.width, c.height);
    g.addColorStop(0, '#3a6ea5'); g.addColorStop(0.5, '#e8c070'); g.addColorStop(1, '#6a3a80');
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 60; i++) { x.fillStyle = `hsl(${i * 37 % 360},60%,60%)`; x.beginPath(); x.arc((i * 97) % c.width, (i * 53) % c.height, 30 * dpr, 0, 6.283); x.fill(); }
    T.blit = c;
    T.grad = null;
  }
  if (!T.sprite) {
    const s = document.createElement('canvas'); s.width = s.height = 96;
    const x = s.getContext('2d'), g = x.createRadialGradient(40, 36, 4, 48, 48, 46);
    g.addColorStop(0, '#fffbe8'); g.addColorStop(0.6, '#f3c860'); g.addColorStop(1, 'rgba(160,90,20,0)');
    x.fillStyle = g; x.beginPath(); x.ellipse(48, 50, 34, 44, 0, 0, 6.283); x.fill();
    T.sprite = s;
  }
}
function micro(kind) {
  const { ctx } = T.env, { w, h, dpr } = T, t = performance.now() / 1000;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (kind === 'blit') { ctx.drawImage(T.blit, 0, 0); return; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (kind === 'gradient') {
    // a new gradient each frame, like a per-frame sky or vignette in draw code
    const g = ctx.createLinearGradient(0, 0, w * (0.8 + 0.2 * Math.sin(t)), h);
    g.addColorStop(0, '#0d2a4a'); g.addColorStop(0.5, '#2f7fb8'); g.addColorStop(1, '#f0d890');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    return;
  }
  ctx.fillStyle = '#20304a'; ctx.fillRect(0, 0, w, h);
  if (kind === 'paths200') {
    for (let i = 0; i < 200; i++) {
      const x = ((i * 73) % 100) / 100 * w, y = ((i * 41) % 100) / 100 * h, r = 6 + (i % 7) * 2, a = t * 2 + i;
      ctx.fillStyle = PAL[i % PAL.length];
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      for (let j = 1; j < 6; j++) ctx.lineTo(x + Math.cos(a + j * 1.257) * r * (j % 2 ? 0.55 : 1), y + Math.sin(a + j * 1.257) * r * (j % 2 ? 0.55 : 1));
      ctx.closePath(); ctx.fill();
    }
    return;
  }
  if (kind === 'sprites50') {
    for (let i = 0; i < 50; i++) {
      const x = ((i * 61) % 100) / 100 * w, y = ((i * 29) % 100) / 100 * h, s = 30 + (i % 5) * 8;
      ctx.save(); ctx.translate(x, y); ctx.rotate(t + i); ctx.drawImage(T.sprite, -s / 2, -s / 2, s, s * 1.1); ctx.restore();
    }
  }
}
const PAL = ['#ff6b5a', '#ffd23a', '#7dff6a', '#5ac8ff', '#c08aff', '#ff9ad5'];

// ---- the results: one screen, big text, fits 360 x 640
function drawResults() {
  const { ctx, font } = T.env, { w, h, dpr } = T;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#16120f'; ctx.fillRect(0, 0, w, h);
  const s = Math.min(1.25, Math.max(0.85, Math.min(w / 360, h / 640))), X = Math.max(8, (w - 360 * s) / 2), cw = Math.min(w - 16, 360 * s);
  let y = 10 * s;
  const txt = (t, x, size, col = '#fff', weight = 600, align = 'left') => { ctx.font = `${weight} ${size * s}px ${font}`; ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = 'top'; ctx.fillText(t, x, y, cw); };
  txt('Speed test', X, 22, '#ffd36b', 700); y += 28 * s;
  const ua = navigator.userAgent || '', chrome = (/Chrome\/([\d.]+)/.exec(ua) || [])[1] || '?', android = (/Android ([\d.]+)/.exec(ua) || [])[1] || '-';
  const wv = /; wv\)/.test(ua) ? 'WebView' : 'Chrome';
  txt(`${wv} ${chrome} · Android ${android}`, X, 12.5, '#cfc6b8', 500); y += 16 * s;
  txt(`GPU: ${T.gpu || 'unknown'}`, X, 12.5, '#cfc6b8', 500); y += 16 * s;
  txt(`Screen ${Math.round(1000 / T.iv)} Hz (${T.iv.toFixed(1)} ms), game draws every ${T.every === 1 ? 'refresh' : T.every + ' refreshes'} · ${devDpr().toFixed(2)}x · ${Math.round(T.w)}x${Math.round(T.h)}`, X, 12.5, '#cfc6b8', 500); y += 22 * s;
  // table
  const cols = [0, 0.43, 0.58, 0.73, 0.87].map((f) => X + f * cw);
  const head = ['Level 20 at', 'gap', 'p95', 'late', 'JS'];
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(X - 4, y - 3 * s, cw + 8, 20 * s);
  head.forEach((c, i) => txt(c, cols[i], 13, '#ffd36b', 700)); y += 21 * s;
  const row = (r, hl) => {
    if (hl) { ctx.fillStyle = 'rgba(125,255,106,0.14)'; ctx.fillRect(X - 4, y - 3 * s, cw + 8, 21 * s); }
    const col = r.err ? '#ff6a5a' : r.late <= 5 ? '#7dff6a' : r.late <= 20 ? '#ffd23a' : '#ff6a5a';
    txt(r.name, cols[0], 14, '#fff', 600);
    txt(r.med.toFixed(1), cols[1], 14, col, 700);
    txt(r.p95.toFixed(0), cols[2], 14, col, 600);
    txt(r.late.toFixed(0) + '%', cols[3], 14, col, 700);
    txt(r.js.toFixed(1), cols[4], 14, '#cfe3ff', 600);
    y += 21 * s;
  };
  for (const r of T.res) if (r.kind === 'scene') row(r, r.step === T.best);
  y += 6 * s;
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(X - 4, y - 3 * s, cw + 8, 20 * s);
  txt('Draw test (High res)', cols[0], 13, '#ffd36b', 700); y += 21 * s;
  for (const r of T.res) if (r.kind !== 'scene') row(r, false);
  y += 6 * s;
  txt('gap / p95: ms between frames (median / worst 5%)', X, 11.5, '#a89f92', 500); y += 14 * s;
  txt('late: frames that missed the screen  ·  JS: game code ms', X, 11.5, '#a89f92', 500); y += 18 * s;
  const B = STEPS[T.best];
  txt(`Best: ${TIER_NAME[B[0]]} ${B[1]}x · now ${TIER_NAME[STEPS[T.keep.step][0]]} ${STEPS[T.keep.step][1]}x`, X, 14, '#7dff6a', 700); y += 24 * s;
  // buttons
  const bh = 44 * s, bw = (cw - 10 * s) / 2, by = Math.min(y, h - bh - 12 * s);
  T.buttons = [{ id: 'best', x: X, y: by, w: bw, h: bh, t: 'Use best setting', c: '#3eb42d' }, { id: 'close', x: X + bw + 10 * s, y: by, w: bw, h: bh, t: 'Close', c: '#4a5568' }];
  for (const b of T.buttons) {
    ctx.fillStyle = b.c; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(b.x, b.y, b.w, b.h, 10 * s); else ctx.rect(b.x, b.y, b.w, b.h); ctx.fill();
    ctx.font = `700 ${15 * s}px ${font}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.t, b.x + b.w / 2, b.y + b.h / 2, b.w - 8);
  }
}
