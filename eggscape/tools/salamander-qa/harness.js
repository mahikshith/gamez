// Dev-only QA harness for the salamander art (not part of the game bundle).
// Runs inside the real dev build (dist/dev/index.html): starts a Volcano level through window.__egg, renders a
// real game frame, copies it, draws the salamander on top at true in-game scale in a ring channel, and
// returns cropped film strips. Driven by tools/salamander-qa/shoot.cjs.
import { drawCrawler, crawlerAnim, SPECIES, drawCrawlerThorn } from '../../src/render/crawlers.js';
import { drawOrb } from '../../src/render/powers.js';

const TAU = Math.PI * 2;
const E = () => window.__egg;
let SPEC = 'salamander', SVL = 1.8; // species and its snout-to-hips length in metres (an egg is 0.56 m tall)
const drawSalamander = (ctx, x, y, s, t, o) => drawCrawler(ctx, x, y, s, t, { debug: true, ...o }, SPEC);
const salamanderAnim = crawlerAnim;
const LEVEL = { salamander: 20, gecko: 10, thornback: 15, chameleon: 25 }; // level index each species lives in
// walking radius (m): the salamander and most crawlers use channel 1-2; the frost gecko walks on top of ring 2
const ringsR = () => E().sim.rings.map((r) => r.r);
const RW = () => { const r = ringsR(); return SPEC === 'gecko' ? r[2] : (r[1] + r[2]) / 2; };
const TH0 = { salamander: 2.2, gecko: 2.2, thornback: 2.2, chameleon: 2.2 };
// the gecko walks on the ring itself: find a start angle where ring i has no gap from the tail (back m behind)
// to fwd m ahead, nearest to the preferred angle (px space, y down)
function solidStart(i, back, fwd, pref = 2.2) {
  const r = E().sim.rings[i], R = r.r, ang = r.body.getAngle();
  const gaps = r.gaps.map((g) => ({ th: -(g.a + ang), h: g.len / (2 * R) + 0.06 }));
  const ok = (th) => { for (let a = th - back / R; a <= th + fwd / R; a += 0.01) for (const g of gaps) { const d = Math.atan2(Math.sin(a - g.th), Math.cos(a - g.th)); if (Math.abs(d) < g.h) return false; } return true; };
  for (let k = 0; k < 320; k++) { const th = pref + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.02; if (ok(th)) return th; }
  return pref;
}
const th0For = () => (SPEC === 'gecko' ? solidStart(2, 1.25 * 1.78 * SVL, 2.2, 2.75) : TH0[SPEC]);

let shot = null, sctx = null;
function view() {
  const G = E().G, P = G.play, cv = document.querySelector('canvas');
  const dpr = cv.width / cv.clientWidth;
  return { k: G.rk, dpr, ox: P.x + P.w / 2 - G.cam.x * G.rk, oy: P.y + P.h / 2 + G.cam.y * G.rk, cv };
}
function setup(li = LEVEL[SPEC]) {
  const g = E();
  g.start(li);
  for (let i = 0; i < 30; i++) g.frame(1 / 60);
  if (g.G.screen === 'intro') { g.press('gotit'); g.press('go'); }
  for (let i = 0; i < 150; i++) g.frame(1 / 60); // let the camera settle at play zoom
  g.G.fx.shake = 0;
  g.G.toast = null;
  g.G.hintShow = null;
}
// Render one game frame and return a context in px space (y down, origin = world origin, 1 unit = 1 css px).
function frame(dt = 0) {
  const g = E();
  g.G.fx.shake = 0;
  if (dt) g.frame(dt); else g.frame(1 / 600);
  const V = view();
  if (!shot) { shot = document.createElement('canvas'); sctx = shot.getContext('2d'); }
  shot.width = V.cv.width; shot.height = V.cv.height;
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.drawImage(V.cv, 0, 0);
  sctx.setTransform(V.dpr, 0, 0, V.dpr, V.dpr * V.ox, V.dpr * V.oy);
  return { ctx: sctx, V };
}

// ---- paths in px space: polar channel arcs and arbitrary smoothed routes with an arc-length table
function channelTrail(Rpx, theta0, dir = 1) {
  // walking clockwise on screen (theta increasing) when dir = 1; head at arc position S
  return (S) => (d) => {
    const th = theta0 + dir * (S - d) / Rpx;
    return { x: Rpx * Math.cos(th), y: Rpx * Math.sin(th) };
  };
}
function routeTrail(pts) {
  // pts: dense polyline (px); returns S => d => point at arc S - d (straight extension before the start)
  const n = pts.length, A = new Float64Array(n);
  for (let i = 1; i < n; i++) A[i] = A[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  const at = (s) => {
    if (s <= 0) {
      const dx = pts[1].x - pts[0].x, dy = pts[1].y - pts[0].y, l = Math.hypot(dx, dy) || 1;
      return { x: pts[0].x + (dx / l) * s, y: pts[0].y + (dy / l) * s };
    }
    if (s >= A[n - 1]) {
      const dx = pts[n - 1].x - pts[n - 2].x, dy = pts[n - 1].y - pts[n - 2].y, l = Math.hypot(dx, dy) || 1;
      const e = s - A[n - 1];
      return { x: pts[n - 1].x + (dx / l) * e, y: pts[n - 1].y + (dy / l) * e };
    }
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (A[m] <= s) lo = m; else hi = m; }
    const k = (s - A[lo]) / (A[hi] - A[lo] || 1);
    return { x: pts[lo].x + (pts[hi].x - pts[lo].x) * k, y: pts[lo].y + (pts[hi].y - pts[lo].y) * k };
  };
  const tr = (S) => (d) => at(S - d);
  tr.length = A[n - 1];
  return tr;
}
function smoothPoly(raw, step, passes) {
  const out = [];
  for (let i = 1; i < raw.length; i++) {
    const a = raw[i - 1], b = raw[i], l = Math.hypot(b.x - a.x, b.y - a.y), m = Math.max(1, Math.ceil(l / step));
    for (let j = 0; j < m; j++) out.push({ x: a.x + ((b.x - a.x) * j) / m, y: a.y + ((b.y - a.y) * j) / m });
  }
  out.push(raw[raw.length - 1]);
  for (let p = 0; p < passes; p++) for (let i = 1; i < out.length - 1; i++) {
    out[i] = { x: (out[i - 1].x + 2 * out[i].x + out[i + 1].x) / 4, y: (out[i - 1].y + 2 * out[i].y + out[i + 1].y) / 4 };
  }
  return out;
}

// ---- strip assembly: crop rect in css px around a set of px-space points
function cropFor(V, pts, pad) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  return { x: (x0 - pad + V.ox) * V.dpr, y: (y0 - pad + V.oy) * V.dpr, w: (x1 - x0 + 2 * pad) * V.dpr, h: (y1 - y0 + 2 * pad) * V.dpr };
}
function strip(frames, crop, opts = {}) {
  const sc = opts.scale || 1, gap = 6;
  const cw = Math.round(crop.w * sc), ch = Math.round(crop.h * sc);
  const cols = opts.cols || frames.length, rows = Math.ceil(frames.length / cols);
  const c = document.createElement('canvas');
  c.width = cols * cw + (cols - 1) * gap;
  c.height = rows * (ch + 18) + (rows - 1) * gap;
  const x = c.getContext('2d');
  x.fillStyle = '#111';
  x.fillRect(0, 0, c.width, c.height);
  frames.forEach((f, i) => {
    const X = (i % cols) * (cw + gap), Y = Math.floor(i / cols) * (ch + 18 + gap);
    x.imageSmoothingEnabled = sc !== 1;
    x.drawImage(f.img, crop.x, crop.y, crop.w, crop.h, X, Y + 18, cw, ch);
    x.fillStyle = '#ddd';
    x.font = '13px sans-serif';
    x.fillText(f.label, X + 4, Y + 13);
  });
  return c.toDataURL('image/png');
}
function grab() {
  const c = document.createElement('canvas');
  c.width = shot.width; c.height = shot.height;
  c.getContext('2d').drawImage(shot, 0, 0);
  return c;
}

// red-hot ring section (proposal visual for the fire breath)
function hotArc(ctx, Rpx, th, half, heat, k, t) {
  if (heat <= 0) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(255,70,20,${0.35 * heat})`;
  ctx.lineWidth = 0.16 * k * 2.2;
  ctx.beginPath(); ctx.arc(0, 0, Rpx, th - half, th + half); ctx.stroke();
  ctx.strokeStyle = `rgba(255,${120 + 60 * Math.sin(t * 9)},40,${0.9 * heat})`;
  ctx.lineWidth = 0.16 * k;
  ctx.beginPath(); ctx.arc(0, 0, Rpx, th - half, th + half); ctx.stroke();
  ctx.strokeStyle = `rgba(255,240,170,${0.8 * heat})`;
  ctx.lineWidth = 0.05 * k;
  ctx.beginPath(); ctx.arc(0, 0, Rpx, th - half * 0.7, th + half * 0.7); ctx.stroke();
  ctx.restore();
}

// rings' gaps in px-space polar angles
function gapsOf(i) {
  const r = E().sim.rings[i];
  return r.gaps.map((g) => ({ th: -(g.a + r.body.getAngle()), len: g.len, r: r.r }));
}

// ---------------------------------------------------------------- scenarios
const S = {};
const N = 10;
const speed = 0.55; // m/s walking

S.walk = () => {
  setup();
  let { V } = frame();
  const k = V.k, R = RW() * k, s = SVL * k, th0 = th0For();
  const tr = channelTrail(R, th0);
  const stride = SPECIES[SPEC].stride / 100 * s;
  const frames = [], feetLog = [];
  let crop = null;
  for (let i = 0; i < N; i++) {
    const g = stride * (i / N) + stride * 0.3;
    const t = 1 + g / (speed * k);
    const f = frame();
    const trail = tr(g), hd = trail(0), out = {};
    drawSalamander(f.ctx, hd.x, hd.y, s, t, { trail, gait: g, pose: 'walk', glow: 0.8, out, look: { x: 1, y: 0 } });
    feetLog.push(out.feet);
    if (!crop) {
      const pts = [];
      for (let d = -stride * 1.2; d < s * 2; d += 5) pts.push(trail(d));
      crop = cropFor(f.V, pts, 0.55 * k);
    }
    frames.push({ img: grab(), label: `walk ${i + 1}/${N}` });
  }
  // foot sliding report: planted feet (lift 0) should not move between frames
  let maxSlide = 0;
  for (let i = 1; i < feetLog.length; i++) for (let j = 0; j < 4; j++) {
    const a = feetLog[i - 1][j], b = feetLog[i][j];
    if (a.lift === 0 && b.lift === 0) maxSlide = Math.max(maxSlide, Math.hypot(a.x - b.x, a.y - b.y));
  }
  return { png: strip(frames, crop, { cols: 5 }), info: { k, maxSlidePx: maxSlide, sPx: s } };
};

S.turn = () => {
  setup();
  let { V } = frame();
  const k = V.k, s = SVL * k;
  // climb from channel 1-2 (r 2.55) through the gap in ring 2 into channel 2-3 (r 3.55)
  const gp = gapsOf(2)[0];
  const R1 = 2.55 * k, R2 = 3.55 * k;
  const raw = [];
  for (let th = gp.th - 1.6; th <= gp.th; th += 0.02) raw.push({ x: R1 * Math.cos(th), y: R1 * Math.sin(th) });
  for (let th = gp.th; th <= gp.th + 1.2; th += 0.02) raw.push({ x: R2 * Math.cos(th), y: R2 * Math.sin(th) });
  const tr = routeTrail(smoothPoly(raw, 2, 60));
  const frames = [], feetLog = [];
  const atGap = 1.6 * R1 + 0.5 * (R2 - R1); // arc position of the gap crossing
  const L0 = atGap - 0.5 * k, L1 = atGap + 1.3 * k;
  let crop = null;
  for (let i = 0; i < N; i++) {
    const g = L0 + ((L1 - L0) * i) / (N - 1);
    const f = frame(), trail = tr(g), hd = trail(0), out = {};
    drawSalamander(f.ctx, hd.x, hd.y, s, 1 + g / (speed * k), { trail, gait: g, pose: 'walk', glow: 0.8, out, look: { x: 1, y: 0.3 } });
    feetLog.push(out.feet);
    if (!crop) {
      const pts = [];
      for (let q = L0 - 1.2 * s; q < L1 + 0.3 * k; q += 4) pts.push(tr(q)(0));
      crop = cropFor(f.V, pts, 0.85 * k);
    }
    frames.push({ img: grab(), label: `gap climb ${i + 1}/${N}` });
  }
  return { png: strip(frames, crop, { cols: 5 }), info: { gapTh: gp.th } };
};

function still(pose, n, fn, label, extraPts, sopt = {}) {
  setup();
  let { V } = frame();
  const k = V.k, R = RW() * k, s = SVL * k, th0 = sopt.th0 || th0For();
  const tr = channelTrail(R, th0);
  const g = 0.4 * s * 0.25;
  const frames = [];
  let crop = null;
  for (let i = 0; i < n; i++) {
    const f = frame();
    const trail = tr(g), hd = trail(0);
    const o = fn(i, f.ctx, k, R, s, trail);
    drawSalamander(f.ctx, hd.x, hd.y, s, o.t, { trail, gait: g, pose, glow: 0.8, ...o });
    if (o.after) o.after(f.ctx);
    if (!crop) {
      const pts = [];
      if (sopt.head) { const c = trail(SPECIES[SPEC].neck / 100 * s), h = 0.5 * s + 0.12 * k; pts.push({ x: c.x - h, y: c.y - h }, { x: c.x + h, y: c.y + h }); }
      else for (let d = -0.6 * k; d < s * 2; d += 5) pts.push(trail(d));
      crop = cropFor(f.V, pts.concat(extraPts ? extraPts(trail, k) : []), (sopt.head ? 0.02 : 0.6) * k);
    }
    frames.push({ img: grab(), label: label(i, o) });
  }
  return { png: strip(frames, crop, { cols: sopt.cols || 5, scale: sopt.scale || 1 }) };
}

S.idle = () => still('idle', N, (i) => {
  const t = 2 + i * 0.32; // 3.2 s: one breath cycle and a blink
  const glow = 0.55 + 0.4 * Math.sin(t * 2.3);
  return { t, glow, look: { x: Math.cos(t * 0.9), y: Math.sin(t * 1.3) }, blink: i === 5 ? 1 : i === 4 || i === 6 ? 0.45 : 0 };
}, (i) => `idle ${i + 1}/${N}`);

let hitTh = null;
S.breath = () => { hitTh = null; return still('breath', 12, (i, ctx, k, R, s) => {
  const p = i / 11, t = 4 + p * 2.6;
  // jet aimed at the outer ring wall; the wall heats up while it lands
  const heat = p < 0.86 ? Math.min(1, Math.max(0, (p - 0.47) / 0.2)) : 1;
  const out = {};
  return { t, p, aim: -0.62, fireLen: 44, out, after: (c) => { if (out.fire) hitTh = Math.atan2(out.fire.y, out.fire.x); if (hitTh !== null) hotArc(c, 3.05 * k, hitTh, 0.2, heat, k, t); } };
}, (i) => `breath p=${(i / 11).toFixed(2)}`, (trail, k) => [trail(-1.5 * k), { x: trail(-0.6 * k).x - 0.5 * k, y: trail(-0.6 * k).y + 0.4 * k }]); };

S.hiss = () => still('hiss', N, (i) => {
  const p = i / (N - 1), t = 3 + p * 2.4;
  const cool = Math.min(1, Math.max(0, (p - 0.25) / 0.5));
  const pr = Math.min(1, p / 0.6) * 0.85 + (p > 0.6 ? 0.15 * (p - 0.6) / 0.4 : 0);
  return { t, p: pr, cool, steam: 1, glow: 0.8 };
}, (i) => `hiss+cool ${i + 1}/${N}`);

S.dazed = () => still('dazed', N, (i) => ({ t: 5 + i * 0.12 }), (i) => `dazed ${i + 1}/${N}`);

S.flee = () => {
  setup();
  let { V } = frame();
  const k = V.k, R = 2.55 * k, s = SVL * k, th0 = 2.2;
  const tr = channelTrail(R, th0);
  const holeS = 1.2 * k; // the hole sits at arc 1.2 m
  const frames = [];
  let crop = null;
  const n = 12;
  for (let i = 0; i < n; i++) {
    const g = 0.2 * k + i * (3.4 * k / (n - 1));
    const f = frame(), trail = tr(g), hd = trail(0);
    const t = 1 + g / (1.6 * k);
    drawSalamander(f.ctx, hd.x, hd.y, s, t, { trail, gait: g, pose: 'flee', glow: 1, dive: g - holeS, look: { x: 1, y: 0 } });
    if (!crop) {
      const pts = [];
      for (let q = -2 * s; q < holeS + 0.5 * k; q += 5) pts.push(tr(q)(0));
      crop = cropFor(f.V, pts, 0.6 * k);
    }
    frames.push({ img: grab(), label: `flee ${i + 1}/${n}` });
  }
  return { png: strip(frames, crop, { cols: 6 }) };
};

// whole level, salamander walking in channel 2-3 next to a resting egg
S.level = () => {
  setup();
  const g0 = E();
  const eggs = g0.sim.aliveEggs();
  const e = eggs[0], P = e.body.getPosition();
  e.body.setPosition(new P.constructor(-0.35, -3.5));
  e.body.setLinearVelocity(new P.constructor(0, 0));
  for (let i = 0; i < 90; i++) g0.frame(1 / 60);
  const f = frame();
  const k = f.V.k, s = SVL * k, R = 3.55 * k;
  const g = 0.9 * k, tr = channelTrail(R, Math.PI / 2 - 0.22 - g / R, 1);
  const trail = tr(g), hd = trail(0);
  drawSalamander(f.ctx, hd.x, hd.y, s, 3, { trail, gait: g, pose: 'walk', glow: 0.85, look: { x: 1, y: 0.4 } });
  const c = grab();
  return { png: c.toDataURL('image/png'), info: { k, eggPx: 0.56 * k, salPx: s } };
};

S.head = () => still('idle', 8, (i) => {
  const poses = [
    { t: 2, look: { x: 1, y: 0 } }, { t: 2.3, look: { x: 0, y: -1 } }, { t: 2.6, blink: 1 },
    { t: 3, pose: 'hiss', p: 0.5 }, { t: 3.4, pose: 'breath', p: 0.6, aim: 0, fireLen: 30 },
    { t: 3.7, pose: 'dazed' }, { t: 4, pose: 'cool', p: 0.5 }, { t: 4.3, pose: 'breath', p: 0.36, aim: 0 },
  ];
  return poses[i];
}, (i) => ['look fwd', 'look side', 'blink', 'hiss', 'fire', 'dazed', 'cool', 'inhale'][i], null, { head: true, scale: 2, cols: 4 });

const X = {}; // per-species scenarios (gecko, thornback, chameleon), filled in at the end
window.__salqa = { S, frame, setup, run(sp, n) { SPEC = sp; SVL = SPECIES[sp].svl; return (sp === 'salamander' ? S : X[sp])[n](); } };

// cost per draw (ms), walking with fire, on the copied game frame
S.perf = () => {
  setup();
  const f = frame(), k = f.V.k, s = SVL * k, tr = channelTrail(2.55 * k, 2.2);
  const run = (pose, extra) => {
    const t0 = performance.now();
    for (let i = 0; i < 600; i++) { const g = i * 0.6, trail = tr(g), hd = trail(0); drawSalamander(f.ctx, hd.x, hd.y, s, i / 60, { trail, gait: g, pose, ...extra }); }
    return (performance.now() - t0) / 600;
  };
  return { png: shot.toDataURL('image/png'), info: { walkMs: run('walk', {}), breathMs: run('breath', { p: 0.6 }), fleeMs: run('flee', { dive: 20 }) } };
};

// big single-frame head check for art iteration (not part of the sheet)
S.headbig = () => still('idle', 4, (i) => [{ t: 2, look: { x: 1, y: 0 } }, { t: 3, pose: 'hiss', p: 0.5 }, { t: 3.4, pose: 'breath', p: 0.3, aim: 0 }, { t: 3.4, pose: 'walk' }][i], (i) => ['idle', 'hiss', 'rear', 'walk'][i], null, { head: true, scale: 4, cols: 4 });

// art-iteration view: large, on a plain dark ground, several poses (not part of the sheet)
const STUDIO = {
  salamander: [{ pose: 'idle', t: 2 }, { pose: 'hiss', p: 0.5, t: 3 }, { pose: 'breath', p: 0.3, t: 3.4 }, { pose: 'dazed', t: 3 }, { pose: 'idle', t: 2, heading: Math.PI / 2 }],
  gecko: [{ pose: 'idle', t: 2 }, { pose: 'frost', t: 3 }, { pose: 'melt', p: 0.3, t: 3 }, { pose: 'melt', p: 0.6, t: 3 }, { pose: 'idle', t: 1.5, heading: Math.PI / 2 }],
  thornback: [{ pose: 'idle', t: 2 }, { pose: 'lay', p: 0.5, t: 3 }, { pose: 'flipped', p: 0.1, t: 3 }, { pose: 'flipped', p: 0.5, t: 3 }, { pose: 'idle', t: 2, heading: Math.PI / 2 }],
  chameleon: [{ pose: 'idle', t: 2 }, { pose: 'snatch', p: 0.25, t: 3, target: 1 }, { pose: 'sick', t: 3 }, { pose: 'walk', t: 3, camo: 0.85, camoColor: [70, 80, 110] }, { pose: 'idle', t: 2, heading: Math.PI / 2 }],
};
S.studio = () => {
  const c = document.createElement('canvas');
  const list = STUDIO[SPEC], cw = 400;
  c.width = cw * list.length; c.height = 760;
  const x = c.getContext('2d');
  x.fillStyle = '#231c1e';
  x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = 'rgb(70,80,110)';
  x.fillRect(cw * 3, 0, cw, c.height);
  list.forEach((o, i) => {
    x.save();
    x.beginPath(); x.rect(i * cw, 0, cw, c.height); x.clip();
    const down = o.heading > 0, X = i * cw + cw / 2, Y = down ? 670 : 90;
    const oo = { heading: -Math.PI / 2, gait: 30, glow: 0.8, ...o };
    if (o.target) oo.target = { x: X + 150, y: Y - 60 };
    drawCrawler(x, X, Y, 420, o.t, { debug: true, ...oo }, SPEC);
    x.restore();
  });
  return { png: c.toDataURL('image/png') };
};

// pose blending through salamanderAnim at 60 fps: walk -> stop -> idle -> hiss -> breath -> walk.
// Reports foot slide while planted and the biggest single-frame foot jump (a pop would show up here).
S.blend = () => {
  setup();
  const f0 = frame(), k = f0.V.k, s = SVL * k, R = 2.55 * k;
  const tr = channelTrail(R, 1.9);
  const A = salamanderAnim();
  const plan = [[0, 'walk'], [1.3, 'idle'], [2.3, 'hiss'], [3.5, 'breath'], [5.9, 'walk']];
  const dur = { hiss: 1.2, breath: 2.4 };
  const shots = [1.0, 1.35, 1.55, 1.9, 2.45, 2.9, 3.6, 3.85, 4.5, 5.6, 6.1, 6.6];
  let pos = 0, prev = null, maxSlide = 0, maxJump = 0, crop = null, si = 0;
  const frames = [];
  for (let i = 0; i <= Math.round(6.7 * 60); i++) {
    const t = i / 60;
    let cur = plan[0];
    for (const q of plan) if (t >= q[0]) cur = q;
    const p = dur[cur[1]] ? Math.min(1, (t - cur[0]) / dur[cur[1]]) : 0;
    pos += A.update(1 / 60, { pose: cur[1], p, speed: 0.55 * k, stride: 0.4 * s });
    const take = si < shots.length && t >= shots[si] - 1e-6;
    const f = take ? frame() : { ctx: document.createElement('canvas').getContext('2d') };
    const trail = tr(pos), hd = trail(0), out = {};
    drawSalamander(f.ctx, hd.x, hd.y, s, 3 + t, { ...A.opts(), trail, glow: 0.8, aim: cur[1] === 'breath' ? -0.6 : 0, fireLen: 44, out });
    if (prev) for (let j = 0; j < 4; j++) {
      const a = prev[j], b = out.feet[j], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (a.lift === 0 && b.lift === 0) maxSlide = Math.max(maxSlide, d);
      maxJump = Math.max(maxJump, d);
    }
    prev = out.feet;
    if (take) {
      if (!crop) { const pts = []; for (let d = -1.0 * k; d < s * 2.2; d += 5) pts.push(tr(pos + 0.9 * k)(d)); crop = cropFor(f.V, pts, 0.6 * k); }
      frames.push({ img: grab(), label: `${t.toFixed(2)}s ${cur[1]}` });
      si++;
    }
  }
  return { png: strip(frames, crop, { cols: 6 }), info: { maxPlantedSlidePx: maxSlide, maxFootStepPerFramePx: maxJump, swingStepPx: 0.4 * s * 2 / 60 * 3 } };
};


// ---------------------------------------------------------------- the other crawlers
// seq: n frames; fn(i, ctx, env) draws any underlay and returns draw opts (+ g = gait/arc position, t, after);
// env = { k, R, s, tr, th0 }. crop(env) returns the px points the strip must show.
function seq(n, fn, label, crop, sopt = {}) {
  setup();
  const V = frame().V, k = V.k;
  const env = { k, R: (sopt.R || RW()) * k, s: SVL * k, th0: sopt.th0 || th0For() };
  env.tr = channelTrail(env.R, env.th0);
  env.stride = SPECIES[SPEC].stride / 100 * env.s;
  const frames = [];
  let box = null;
  for (let i = 0; i < n; i++) {
    const f = frame();
    const o = fn(i, f.ctx, env);
    const g = o.g !== undefined ? o.g : env.stride * 0.25;
    const trail = env.tr(g), hd = trail(0);
    if (!o.skip) drawSalamander(f.ctx, hd.x, hd.y, env.s, o.t, { trail, gait: g, glow: 0.8, ...o });
    if (o.after) o.after(f.ctx, trail);
    if (!box) box = cropFor(f.V, crop(env), (sopt.pad || 0.5) * k);
    frames.push({ img: grab(), label: label(i, o) });
  }
  return { png: strip(frames, box, { cols: sopt.cols || 5, scale: sopt.scale || 1 }), info: { k, R: env.R / k, sPx: env.s } };
}
const bodyPts = (env, g, back = 2.1, fwd = 0.4) => { const out = [], tr = env.tr(g); for (let d = -fwd * env.k; d < env.s * back; d += 5) out.push(tr(d)); return out; };
// average colour of the game frame under a set of px points (what a chameleon would match)
function colourUnder(V, pts) {
  const c = [0, 0, 0];
  let n = 0;
  for (const p of pts) {
    const d = sctx.getImageData(Math.round((p.x + V.ox) * V.dpr), Math.round((p.y + V.oy) * V.dpr), 1, 1).data;
    c[0] += d[0]; c[1] += d[1]; c[2] += d[2]; n++;
  }
  return c.map((v) => v / Math.max(1, n));
}
function stoneEgg(ctx, x, y, k, rot, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const rx = 0.28 * k, ry = 0.21 * k;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
  ctx.fillStyle = '#8f8a84';
  ctx.fill();
  ctx.lineWidth = Math.max(1, 0.03 * k);
  ctx.strokeStyle = '#2b2622';
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(-rx * 0.3, -ry * 0.35, rx * 0.4, ry * 0.25, -0.3, 0, TAU);
  ctx.fillStyle = 'rgba(230,224,214,0.7)';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(rx * 0.2, -ry * 0.6); ctx.lineTo(rx * 0.35, -ry * 0.1); ctx.lineTo(rx * 0.15, ry * 0.3);
  ctx.strokeStyle = '#4d443d';
  ctx.lineWidth = Math.max(0.8, 0.015 * k);
  ctx.stroke();
  ctx.restore();
  void t;
}
function speedLines(ctx, x, y, a, k, n = 3) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = Math.max(1, 0.03 * k);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const o = (i - (n - 1) / 2) * 0.11 * k, bx = x - Math.cos(a) * 0.32 * k - Math.sin(a) * o, by = y - Math.sin(a) * 0.32 * k + Math.cos(a) * o;
    ctx.moveTo(bx, by); ctx.lineTo(bx - Math.cos(a) * 0.3 * k, by - Math.sin(a) * 0.3 * k);
  }
  ctx.stroke();
  ctx.restore();
}
function impact(ctx, x, y, k, sz = 1) {
  ctx.save();
  ctx.beginPath();
  for (let j = 0; j < 16; j++) { const r = (j % 2 ? 0.1 : 0.24) * k * sz, a = (j * Math.PI) / 8; const X = x + Math.cos(a) * r, Y = y + Math.sin(a) * r; if (j) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }
  ctx.closePath();
  ctx.fillStyle = '#fff3a0';
  ctx.fill();
  ctx.lineWidth = Math.max(1, 0.025 * k);
  ctx.strokeStyle = '#6a3a08';
  ctx.stroke();
  ctx.restore();
}
function flameBurst(ctx, x, y, k, f, t) { // a fire puff (fire egg / fire orb) hitting the gecko
  if (f <= 0) return;
  ctx.save();
  for (const [col, sc] of [['#5a1206', 1.15], ['#ff7a1e', 0.92], ['#ffe27a', 0.5]]) {
    ctx.fillStyle = col;
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const a = i * 0.7 + t * 3, d = 0.18 * k * f * (0.6 + 0.4 * Math.sin(i * 2.3)), r = 0.13 * k * f * sc * (1 + 0.2 * Math.sin(t * 20 + i));
      const X = x + Math.cos(a) * d, Y = y + Math.sin(a) * d - 0.08 * k * f;
      ctx.moveTo(X + r, Y); ctx.arc(X, Y, r, 0, TAU);
    }
    ctx.fill();
  }
  ctx.restore();
}
// frozen ring section (frost gecko trail): an icy band on top of the ring with glints
function iceArc(ctx, R, th0, th1, k, t, a = 1) {
  if (Math.abs(th1 - th0) < 1e-3) return;
  const lo = Math.min(th0, th1), hi = Math.max(th0, th1);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(150,215,255,${0.55 * a})`;
  ctx.lineWidth = 0.34 * k;
  ctx.beginPath(); ctx.arc(0, 0, R, lo, hi); ctx.stroke();
  ctx.strokeStyle = `rgba(225,246,255,${0.95 * a})`;
  ctx.lineWidth = 0.2 * k;
  ctx.beginPath(); ctx.arc(0, 0, R, lo, hi); ctx.stroke();
  ctx.strokeStyle = `rgba(255,255,255,${a})`;
  ctx.lineWidth = 0.04 * k;
  ctx.beginPath(); ctx.arc(0, 0, R - 0.05 * k, lo, hi); ctx.stroke();
  ctx.beginPath(); // glints
  for (let th = lo + 0.05; th < hi; th += 0.13) {
    const tw = Math.sin(t * 4 + th * 37);
    if (tw < 0.3) continue;
    const X = Math.cos(th) * R, Y = Math.sin(th) * R, r = 0.07 * k * tw;
    ctx.moveTo(X - r, Y); ctx.lineTo(X + r, Y); ctx.moveTo(X, Y - r); ctx.lineTo(X, Y + r);
  }
  ctx.lineWidth = Math.max(1, 0.02 * k);
  ctx.stroke();
  ctx.restore();
}

const headCrop = (env, g) => { const c = env.tr(g)(SPECIES[SPEC].neck / 100 * env.s), h = 0.5 * env.s + 0.12 * env.k; return [{ x: c.x - h, y: c.y - h }, { x: c.x + h, y: c.y + h }]; };
const thAt = (env, g, d = 0) => { const q = env.tr(g)(d); return Math.atan2(q.y, q.x); };

function commonScenarios(sp, poses) {
  return {
    studio: S.studio,
    walk: () => { const r = S.walk(); return r; },
    idle: () => seq(10, (i) => {
      const t = poses.idleT + i * 0.14;
      return { t, pose: 'idle', look: { x: Math.cos(t * 0.9), y: Math.sin(t * 1.3) } };
    }, (i) => `idle ${i + 1}/10`, (env) => bodyPts(env, env.stride * 0.25, 2.0, 0.3)),
    head: () => seq(8, (i, ctx, env) => ({ ...poses.head[i], g: env.stride * 0.25 }), (i) => poses.headLabels[i], (env) => headCrop(env, env.stride * 0.25), { scale: 2, cols: 4, pad: 0.02 }),
    level: () => {
      setup();
      const f = frame(), k = f.V.k, s = SVL * k, R = RW() * k;
      const g = 0.9 * k, tr = channelTrail(R, (SPEC === 'gecko' ? solidStart(2, 1.25 * 1.78 * SVL + 2.2, 0.5, poses.levelTh) : poses.levelTh) - g / R, 1);
      const trail = tr(g), hd = trail(0);
      if (poses.levelUnder) poses.levelUnder(f.ctx, k, R, tr, g);
      drawSalamander(f.ctx, hd.x, hd.y, s, 3, { trail, gait: g, pose: 'walk', glow: 0.8, look: { x: 1, y: 0.4 }, ...(poses.levelOpts ? poses.levelOpts(f, trail) : {}) });
      const c = grab();
      return { png: c.toDataURL('image/png'), info: { k, eggPx: 0.56 * k, sPx: s, rings: ringsR() } };
    },
    perf: () => {
      setup();
      const f = frame(), k = f.V.k, s = SVL * k, tr = channelTrail(RW() * k, 2.2);
      const run = (pose, extra) => {
        const t0 = performance.now();
        for (let i = 0; i < 600; i++) { const g = i * 0.6, trail = tr(g), hd = trail(0); drawSalamander(f.ctx, hd.x, hd.y, s, i / 60, { trail, gait: g, pose, ...extra }); }
        return (performance.now() - t0) / 600;
      };
      const info = {};
      for (const [name, pose, extra] of poses.perf) info[name] = +run(pose, extra || {}).toFixed(2);
      return { png: shot.toDataURL('image/png'), info };
    },
  };
}

/* ---- frost gecko: walks on top of the ring; its trail freezes the ring (eggs slide); fire melts it for a while */
X.gecko = commonScenarios('gecko', {
  idleT: 3.0,
  head: [{ t: 2, pose: 'idle', look: { x: 1, y: 0 } }, { t: 2.2, pose: 'idle', look: { x: 0, y: 1 } }, { t: 2, pose: 'idle', blink: 1 },
    { t: 3.55, pose: 'idle' }, { t: 3, pose: 'frost' }, { t: 3, pose: 'melt', p: 0.3 }, { t: 3, pose: 'melt', p: 0.55 }, { t: 3, pose: 'dazed' }],
  headLabels: ['look fwd', 'look side', 'blink', 'eye lick', 'frost', 'melting', 'melted', 'dazed'],
  levelTh: Math.PI / 2 - 0.5,
  levelUnder: (ctx, k, R, tr, g) => iceArc(ctx, R, Math.atan2(tr(g)(SVL * k * 1.2).y, tr(g)(SVL * k * 1.2).x), Math.atan2(tr(g)(SVL * k * 1.2 + 2.2 * k).y, tr(g)(SVL * k * 1.2 + 2.2 * k).x), k, 3),
  perf: [['walkMs', 'walk'], ['meltMs', 'melt', { p: 0.4 }], ['frostMs', 'frost']],
});
X.gecko.trait = () => seq(10, (i, ctx, env) => {
  // the gecko walks 1.6 m along the ring; behind it the ring ices over; an egg below hits the ice and shoots off
  const g = env.stride * 0.3 + i * (1.6 * env.k / 9), t = 2 + i * 0.25;
  const th1 = thAt(env, g, env.s * 1.1), th0 = thAt(env, -1.1 * env.k, env.s * 1.1);
  iceArc(ctx, env.R, th0, th1, env.k, t);
  // egg in the channel below the ring, sliding fast once the ice under it is laid
  const Re = env.R - 0.3 * env.k, thE = thAt(env, -0.8 * env.k, env.s * 1.1) + (i > 4 ? (i - 4) * 0.075 : 0);
  const ex = Re * Math.cos(thE), ey = Re * Math.sin(thE), a = thE + Math.PI / 2;
  return { t, g, pose: 'frost', after: (c) => {
    if (i > 4) speedLines(c, ex, ey, a, env.k);
    stoneEggLike(c, ex, ey, env.k, a);
  } };
}, (i) => (i < 5 ? `freezing the ring ${i + 1}/10` : `egg slides ${i + 1}/10`), (env) => {
  const pts = bodyPts(env, env.stride * 0.3 + 1.6 * env.k, 2.0, 0.3).concat(bodyPts(env, env.stride * 0.3, 2.0, 0.3));
  const Re = env.R - 0.3 * env.k, th = thAt(env, -0.8 * env.k, env.s * 1.1);
  pts.push({ x: Re * Math.cos(th), y: Re * Math.sin(th) });
  return pts;
}, { cols: 5, pad: 0.55 });
function stoneEggLike(ctx, x, y, k, rot) { // a plain white game egg (for scale and the slide)
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.28 * k, 0.21 * k, 0, 0, TAU);
  ctx.fillStyle = '#fff8ec';
  ctx.fill();
  ctx.lineWidth = Math.max(1, 0.03 * k);
  ctx.strokeStyle = '#3a2a1a';
  ctx.stroke();
  ctx.restore();
}
X.gecko.weak = () => seq(12, (i, ctx, env) => {
  // a fire puff lands on it: it melts into a puddle (eyes bobbing), then pulls itself back together
  const p = i < 2 ? 0 : (i - 2) / 9, t = 3 + i * 0.3;
  const g = env.stride * 0.25, hd = env.tr(g)(env.s * 0.4);
  return { t, g, pose: 'melt', p, after: (c) => { if (i >= 1 && i <= 3) flameBurst(c, hd.x, hd.y, env.k, i === 1 ? 0.7 : i === 2 ? 1 : 0.5, t); } };
}, (i) => (i < 1 ? 'calm' : i < 2 ? 'fire hits' : `melt p=${((i - 2) / 9).toFixed(2)}`), (env) => bodyPts(env, env.stride * 0.25, 1.9, 0.35), { cols: 6 });

/* ---- thorn-back: drops thorns behind it; a stone egg / dash chick knocks it on its back and its thorns crumble */
X.thornback = commonScenarios('thornback', {
  idleT: 2.2,
  head: [{ t: 2, pose: 'idle', look: { x: 1, y: 0 } }, { t: 2.2, pose: 'idle', look: { x: 0, y: 1 } }, { t: 2, pose: 'idle', blink: 1 },
    { t: 3, pose: 'lay', p: 0.3 }, { t: 3, pose: 'lay', p: 0.6 }, { t: 3, pose: 'flipped', p: 0.1 }, { t: 3, pose: 'flipped', p: 0.5 }, { t: 3.3, pose: 'flipped', p: 0.6 }],
  headLabels: ['look fwd', 'look side', 'blink', 'hunch', 'thorn pops', 'rolling', 'on its back', 'flailing'],
  levelTh: Math.PI / 2 - 0.4,
  perf: [['walkMs', 'walk'], ['layMs', 'lay', { p: 0.5 }], ['flippedMs', 'flipped', { p: 0.5 }]],
});
let dropped = []; // thorns on the floor (px space), from the lay strip
X.thornback.trait = () => {
  dropped = [];
  return seq(10, (i, ctx, env) => {
    const st = env.stride, t = 2 + i * 0.2;
    // walk 2 frames, stop and lay (5 frames), walk on (3 frames); two older thorns lie further back
    const g = i < 2 ? st * (0.1 + i * 0.4) : i < 7 ? st * 0.5 : st * (0.5 + (i - 6) * 0.45);
    if (i === 0) { const tr = env.tr(0); for (const d of [0.3, 0.95]) { const q = tr(env.s * 1.55 + d * env.k); dropped.push({ x: q.x, y: q.y, rot: d * 4 }); } }
    for (const d of dropped) drawCrawlerThorn(ctx, d.x, d.y, 0.12 * env.k, d.rot);
    const out = {};
    const o = i >= 2 && i < 7 ? { pose: 'lay', p: (i - 2) / 4 } : { pose: 'walk' };
    return { t, g, ...o, out, after: () => { if (i === 6 && out.thorn) dropped.push({ x: out.thorn.x, y: out.thorn.y, rot: 0.4 }); else if (i === 6) { const q = env.tr(g)(env.s * 1.4); dropped.push({ x: q.x, y: q.y, rot: 0.4 }); } } };
  }, (i) => (i < 2 ? `walk ${i + 1}` : i < 7 ? `lay p=${((i - 2) / 4).toFixed(2)}` : `walk on ${i - 6}`), (env) => bodyPts(env, env.stride * 2, 1.6, 0.3).concat([env.tr(0)(env.s * 1.55 + 1.1 * env.k)]), { cols: 5 });
};
X.thornback.weak = () => seq(12, (i, ctx, env) => {
  // a stone egg rolls down the channel into its face: thud, it flips on its back, flails, rights itself;
  // the thorns it dropped crumble away
  const t = 3 + i * 0.22, g = env.stride * 0.25, tr = env.tr(g);
  const crumble = i < 3 ? 0 : Math.min(1, (i - 3) / 5);
  for (const d of [0.3, 0.9]) { const q = tr(env.s * 1.55 + d * env.k); drawCrawlerThorn(ctx, q.x, q.y, 0.12 * env.k, d * 4, crumble); }
  const eggD = i < 2 ? 1.0 - i * 0.35 : 0.42 + Math.min(0.25, (i - 2) * 0.05); // ahead of the snout, then bounces back
  const e = tr(-eggD * env.k), e2 = tr(-eggD * env.k - 2), rot = Math.atan2(e.y - e2.y, e.x - e2.x);
  const p = i < 2 ? 0 : (i - 2) / 9;
  return { t, g, pose: i < 2 ? 'idle' : 'flipped', p, after: (c) => {
    stoneEgg(c, e.x, e.y, env.k, i * 0.9, t);
    if (i < 2) speedLines(c, e.x, e.y, rot + Math.PI, env.k);
    if (i === 2) { const h = tr(-0.15 * env.k); impact(c, (e.x + h.x) / 2, (e.y + h.y) / 2, env.k); }
  } };
}, (i) => (i < 2 ? `stone egg ${i + 1}` : `flipped p=${((i - 2) / 9).toFixed(2)}`),
(env) => bodyPts(env, env.stride * 0.25, 1.55, 1.3).concat([env.tr(env.stride * 0.25)(env.s * 1.55 + 1.05 * env.k)]), { cols: 6 });

/* ---- chameleon: matches the ring until it moves; tongue steals an orb from ~2 m; a fox-curse orb makes it
   flash bright, run off and drop everything it stole */
let camoC = null;
const camoFor = (env, g) => { const V = view(); return colourUnder(V, bodyPts(env, g, 1.5, 0).filter((_, j) => j % 4 === 0)); };
X.chameleon = commonScenarios('chameleon', {
  idleT: 2.2,
  head: [{ t: 2, pose: 'idle', look: { x: 1, y: 0 } }, { t: 2.2, pose: 'idle' }, { t: 2.4, pose: 'idle' },
    { t: 3, pose: 'snatch', p: 0.15 }, { t: 3, pose: 'snatch', p: 0.85 }, { t: 3, pose: 'sick' }, { t: 3.2, pose: 'sick' }, { t: 3, pose: 'dazed' }],
  headLabels: ['look fwd', 'eyes roam', 'eyes roam', 'tongue out', 'gulp', 'cursed', 'cursed', 'dazed'],
  levelTh: Math.PI / 2 - 0.4,
  levelOpts: () => ({}),
  perf: [['walkMs', 'walk'], ['snatchMs', 'snatch', { p: 0.2 }], ['sickMs', 'sick'], ['camoMs', 'idle', { camo: 0.9, camoColor: [80, 90, 120] }]],
});
X.chameleon.walk = () => seq(10, (i, ctx, env) => {
  // sitting still it is nearly invisible; as soon as it walks the colour drains out of the disguise
  if (!camoC) camoC = camoFor(env, env.stride * 0.25);
  const mv = Math.max(0, i - 3), g = env.stride * (0.25 + mv * 0.18), t = 2 + i * 0.2;
  const camo = i < 4 ? 0.92 : Math.max(0.15, 0.92 - mv * 0.18);
  return { t, g, pose: i < 4 ? 'idle' : 'walk', camo, camoColor: camoC };
}, (i) => (i < 4 ? `hiding ${i + 1}` : `walks, camo fades ${i - 3}`), (env) => bodyPts(env, env.stride * 1.3, 1.9, 0.3).concat(bodyPts(env, 0, 1.9, 0)), { cols: 5 });
X.chameleon.trait = () => seq(10, (i, ctx, env) => {
  // an orb 2 m ahead in the channel: the tongue shoots out, sticks, reels it in, gulp
  if (!camoC) camoC = camoFor(env, env.stride * 0.25);
  const g = env.stride * 0.25, t = 3 + i * 0.12, p = i / 9;
  const orb = env.tr(g + 2 * env.k)(0), out = {};
  return { t, g, pose: 'snatch', p, target: orb, camo: 0.5 * (1 - Math.min(1, i / 2)), camoColor: camoC, out, after: (c) => {
    const tk = out.tongue;
    const held = p > 0.22 && tk; // stuck to the tongue from the moment it lands
    if (!held && p < 0.3) drawOrb(c, 'water', orb.x, orb.y, 0.2 * env.k, t, true);
    else if (held && p < 0.7) drawOrb(c, 'water', tk.x, tk.y, 0.2 * env.k * (0.7 + 0.3 * tk.k), t, true);
  } };
}, (i) => `snatch p=${(i / 9).toFixed(2)}`, (env) => bodyPts(env, env.stride * 0.25, 1.3, 0).concat([env.tr(env.stride * 0.25 + 2.2 * env.k)(0)]), { cols: 5 });
X.chameleon.weak = () => seq(12, (i, ctx, env) => {
  // it grabs a fox-curse orb by mistake: flashes every colour, bolts, and drops the orbs it had stolen
  const t = 3 + i * 0.15;
  if (i < 4) {
    const g = env.stride * 0.25, orb = env.tr(g + 1.6 * env.k)(0), out = {}, p = [0.12, 0.3, 0.55, 0.85][i];
    return { t, g, pose: 'snatch', p, target: orb, out, after: (c) => {
      if (p < 0.25) drawOrb(c, 'foxcurse', orb.x, orb.y, 0.2 * env.k, t, true);
      else if (out.tongue && p < 0.7) drawOrb(c, 'foxcurse', out.tongue.x, out.tongue.y, 0.18 * env.k, t, true);
    } };
  }
  const step = 0.36 * env.k, g0 = env.stride * 0.25, g = g0 + (i - 3) * step;
  // each stolen orb pops out at its hips the moment it is dropped and stays there
  const drops = [{ id: 'water', at: g0 + step, from: 4 }, { id: 'feather', at: g0 + 3 * step, from: 6 }];
  return { t, g, pose: 'sick', after: () => {
    for (const d of drops) if (i >= d.from) {
      const q = env.tr(d.at)(env.s * 0.8), pop = Math.min(1, (i - d.from + 1) / 2);
      drawOrb(ctx, d.id, q.x, q.y - 0.15 * env.k * Math.sin(Math.PI * Math.min(1, (i - d.from) / 2)), 0.2 * env.k * (0.5 + 0.5 * pop), t, true);
    }
  } };
}, (i) => (i < 4 ? `grabs fox curse ${i + 1}` : `cursed, drops loot ${i - 3}`), (env) => bodyPts(env, env.stride * 0.25 + 8 * 0.36 * env.k, 0.8, 0.2).concat(bodyPts(env, env.stride * 0.25 + 1.6 * env.k, 2.2, 0)), { cols: 6 });

// the family at true relative size (snout-to-hips from SPECIES[].svl) next to an egg, 3x in-game zoom
S.lineup = () => {
  setup(20);
  const k = view().k * 3, c = document.createElement('canvas');
  const list = ['salamander', 'gecko', 'thornback', 'chameleon'], cw = 330;
  c.width = cw * list.length + 160; c.height = 560;
  const x = c.getContext('2d');
  x.fillStyle = '#231c1e';
  x.fillRect(0, 0, c.width, c.height);
  list.forEach((sp, i) => {
    x.save();
    x.beginPath(); x.rect(i * cw, 0, cw, c.height); x.clip();
    drawCrawler(x, i * cw + cw / 2, 60, SPECIES[sp].svl * k, 2, { heading: -Math.PI / 2, gait: 20, pose: 'idle', glow: 0.8, look: { x: 1, y: 0 }, debug: true, id: 50 + i }, sp);
    x.fillStyle = '#ddd';
    x.font = '22px sans-serif';
    x.fillText(`${sp} ${SPECIES[sp].svl} m`, i * cw + 12, c.height - 14);
    x.restore();
  });
  const ex = cw * list.length + 80, ey = 140;
  x.beginPath();
  x.ellipse(ex, ey, 0.21 * k, 0.28 * k, 0, 0, TAU);
  x.fillStyle = '#fff8ec';
  x.fill();
  x.lineWidth = 3;
  x.strokeStyle = '#3a2a1a';
  x.stroke();
  x.fillStyle = '#ddd';
  x.font = '22px sans-serif';
  x.fillText('egg 0.56 m', ex - 60, ey + 0.28 * k + 30);
  return { png: c.toDataURL('image/png') };
};
