// Dev-only QA harness for the salamander art (not part of the game bundle).
// Runs inside the real dev build (dist/dev/index.html): starts a Volcano level through window.__egg, renders a
// real game frame, copies it, draws the salamander on top at true in-game scale in a ring channel, and
// returns cropped film strips. Driven by tools/salamander-qa/shoot.cjs.
import { drawSalamander } from '../../src/render/salamander.js';

const TAU = Math.PI * 2;
const E = () => window.__egg;
const SVL = 1.5; // snout to hips, metres (an egg is 0.56 m tall)

let shot = null, sctx = null;
function view() {
  const G = E().G, P = G.play, cv = document.querySelector('canvas');
  const dpr = cv.width / cv.clientWidth;
  return { k: G.rk, dpr, ox: P.x + P.w / 2 - G.cam.x * G.rk, oy: P.y + P.h / 2 + G.cam.y * G.rk, cv };
}
function setup(li = 20) {
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
  const k = V.k, R = 2.55 * k, s = SVL * k, th0 = 2.2;
  const tr = channelTrail(R, th0);
  const stride = 0.4 * s;
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
  const k = V.k, R = 2.55 * k, s = SVL * k, th0 = 2.2;
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
      if (sopt.head) { const c = trail(0.12 * k); pts.push({ x: c.x - 0.25 * k, y: c.y - 0.25 * k }, { x: c.x + 0.25 * k, y: c.y + 0.25 * k }); }
      else for (let d = -0.6 * k; d < s * 2; d += 5) pts.push(trail(d));
      crop = cropFor(f.V, pts.concat(extraPts ? extraPts(trail, k) : []), (sopt.head ? 0.42 : 0.6) * k);
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
}, (i) => `breath p=${(i / 11).toFixed(2)}`, (trail, k) => [trail(-1.0 * k)]); };

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

window.__salqa = { S, frame, setup };

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
