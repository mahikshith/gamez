// In-game QA strips for the wired lava salamander: the real dev build at phone size (390x844, 2x), driven through
// window.__egg (sim steps + real rendered frames). Writes PNG strips to eggscape/qa/salwire/ (git-ignored).
// Usage: node tools/build.mjs --dev && node tools/salamander-qa/ingame.cjs [scenario ...]
//   scenarios: breath water carry rival boss intro
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '../..');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const OUT = path.join(ROOT, 'qa/salwire');

// ---- page-side helpers (run in the page)
const PAGE = () => {
  const E = () => window.__egg;
  const TAU = Math.PI * 2;
  const H = (window.__sw = {});
  H.setup = (li, mode = 'medium') => {
    const g = E();
    g.setSave({ mode, intro: { [g.LEVELS[li].id]: 1 }, unlocked: 40 });
    g.start(li);
    for (let i = 0; i < 20; i++) g.frame(1 / 60);
    if (g.G.screen === 'intro') { g.press('gotit'); g.press('go'); }
    for (let i = 0; i < 10; i++) g.frame(1 / 60);
  };
  H.sal = () => E().sim.sals[0];
  // world -> css px on the canvas
  H.toPx = (x, y) => { const G = E().G, P = G.play, k = G.rk; return { x: P.x + P.w / 2 + (x - G.cam.x) * k, y: P.y + P.h / 2 + (G.cam.y - y) * k }; };
  H.frames = [];
  H.grab = (label) => {
    const cv = document.querySelector('canvas'), c = document.createElement('canvas');
    c.width = cv.width; c.height = cv.height;
    c.getContext('2d').drawImage(cv, 0, 0);
    H.frames.push({ img: c, label });
  };
  H.frame = (n = 1, dt = 1 / 60) => { const g = E(); for (let i = 0; i < n; i++) { g.G.fx.shake = 0; g.frame(dt); } };
  // css-px crop box around world points
  H.box = (pts, pad) => {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of pts) { const q = H.toPx(p.x, p.y); x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
    const k = E().G.rk, cv = document.querySelector('canvas'), W = cv.clientWidth, Hh = cv.clientHeight;
    x0 = Math.max(0, x0 - pad * k); y0 = Math.max(0, y0 - pad * k); x1 = Math.min(W, x1 + pad * k); y1 = Math.min(Hh, y1 + pad * k);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  };
  H.strip = (crop, cols) => {
    const cv = document.querySelector('canvas'), dpr = cv.width / cv.clientWidth, F = H.frames;
    const cw = Math.round(crop.w * dpr), ch = Math.round(crop.h * dpr), gap = 6, rows = Math.ceil(F.length / cols);
    const c = document.createElement('canvas');
    c.width = cols * cw + (cols - 1) * gap; c.height = rows * (ch + 22) + (rows - 1) * gap;
    const x = c.getContext('2d');
    x.fillStyle = '#111'; x.fillRect(0, 0, c.width, c.height);
    F.forEach((f, i) => {
      const X = (i % cols) * (cw + gap), Y = Math.floor(i / cols) * (ch + 22 + gap);
      x.drawImage(f.img, crop.x * dpr, crop.y * dpr, cw, ch, X, Y + 22, cw, ch);
      x.fillStyle = '#ddd'; x.font = '15px sans-serif'; x.fillText(f.label, X + 4, Y + 16);
    });
    H.frames = [];
    return c.toDataURL('image/png');
  };
  H.full = () => document.querySelector('canvas').toDataURL('image/png');
  H.salPts = (C, extra = []) => C.pts.filter((q, i) => i % 6 === 0).concat(extra);
  // step the sim (no render) until fn() or the time runs out
  H.until = (fn, max = 60) => { const g = E(), t0 = g.sim.t; while (!fn() && g.sim.t - t0 < max && g.sim.state === 'play') { g.sim.step(); g.handle(); } return fn(); };
  H.feetRing = (ri) => { // the drawn feet in that ring's frame: [{r, la}] (world)
    const g = E(), R = g.salAnim.get(0), k = g.G.rk, ring = g.sim.rings[ri];
    if (!R || !R.out.feet) return null;
    return R.out.feet.map((f) => { const x = f.x / k, y = -f.y / k; return { r: Math.hypot(x, y), la: Math.atan2(y, x) - ring.body.getAngle(), lift: f.lift, x, y }; });
  };
};

// ---- scenarios (page side): each returns [{name, png, info}]
const SC = {};
SC.breath = () => {
  const H = window.__sw, g = window.__egg;
  H.setup(20); // L21
  H.until(() => H.sal().ph === 'walk', 20);
  const C = H.sal(), sim = g.sim, ring = sim.rings[2];
  // an egg resting at the bottom of channel 2, and the salamander walking up to it (its breath lands there)
  const e = sim.aliveEggs()[0], P = e.body.getPosition(), V = P.constructor, ea = -Math.PI / 2;
  e.body.setTransform(new V(0, -(ring.r - 0.3)), 0); e.body.setLinearVelocity(new V(0, 0)); e.cracks = 0; e.safeT = 0;
  C.ch = 2; C.a0 = ea - C.dir * (0.85 + 1.4) / sim.salMid(2); sim.salEnter(C); C.ph = 'walk'; C.t = 0;
  C.next = 1.4 / 0.5 - 0.1;
  H.frame(20);
  const T0 = { x: 0, y: -ring.r }, crop = H.box(H.salPts(C, [T0, { x: 1.7, y: -ring.r - 0.4 }, { x: -1.2, y: -ring.r - 0.4 }]), 0.6);
  let n = 0, cracked = false;
  for (let i = 0; i < 60 * 7 && H.frames.length < 15; i++) {
    H.frame(1);
    const ph = C.ph + (C.pend ? '>' + C.pend : '');
    if (!cracked && e.cracks > 0) { cracked = true; H.grab(`${sim.t.toFixed(2)} crack! (${e.cracks})`); continue; }
    if (C.ph === 'fire' && !H.fullFire) H.fullFire = H.full();
    if ((C.ph === 'walk' && n % 40 === 0 && H.frames.length < 2) || (ph.startsWith('brake') && n % 8 === 0) || (C.ph === 'warn' && n % 10 === 0) || (C.ph === 'fire' && n % 9 === 0) || (C.ph === 'settle' && n % 14 === 0) || (C.ph === 'walk' && H.frames.length > 6 && n % 50 === 0)) H.grab(`${sim.t.toFixed(2)} ${ph}`);
    n++;
  }
  const png = H.strip(crop, 5);
  return [{ name: '1-L21-breath', png, info: { cracks: e.cracks, hot: sim.salHot.length } }, { name: '1b-L21-full', png: H.fullFire || H.full() }];
};
SC.water = () => {
  const H = window.__sw, g = window.__egg;
  H.setup(20);
  H.until(() => H.sal().ph === 'walk' && Math.sin(H.sal().a) < -0.75 && g.sim.salCh(H.sal()) === 2 && g.sim.salCrossing && !g.sim.salCrossing(H.sal()), 80);
  const C = H.sal(), a = C.a + C.dir * 1.2 / C.rad, e = g.sim.aliveEggs()[1], P = e.body.getPosition();
  e.body.setTransform(new P.constructor((C.rad + 0.15) * Math.cos(a), (C.rad + 0.15) * Math.sin(a)), 0);
  e.body.setLinearVelocity(new P.constructor(0, 0));
  e.water = 8;
  C.next = 9;
  H.frame(2);
  const crop = H.box(H.salPts(C, [{ x: (C.rad + 0.6) * Math.cos(a), y: (C.rad + 0.6) * Math.sin(a) }]), 0.8);
  let n = 0;
  for (let i = 0; i < 60 * 8 && H.frames.length < 15; i++) {
    H.frame(1);
    const ph = C.ph + (C.pend ? '>' + C.pend : '');
    if (C.ph === 'hiss' && !H.fullHiss) H.fullHiss = 1;
    else if (C.ph === 'hiss' && H.fullHiss === 1 && n > 12) H.fullHiss = H.full();
    if ((C.ph === 'hiss' && n % 8 === 0) || (C.ph === 'retreat' && n % 25 === 0) || ((C.ph === 'rest' || ph.startsWith('brake')) && n % 40 === 0) || (C.ph === 'walk' && C.cool <= 0 && n % 60 === 0 && H.frames.length > 4)) H.grab(`${g.sim.t.toFixed(2)} ${ph} cool ${C.cool.toFixed(1)}`);
    n++;
  }
  const full = H.fullHiss; H.fullHiss = 0;
  return [{ name: '2-L21-water-cool', png: H.strip(crop, 5) }, { name: '2b-L21-water-full', png: typeof full === 'string' ? full : H.full() }];
};
SC.carry = () => {
  const H = window.__sw, g = window.__egg;
  H.setup(20);
  H.until(() => H.sal().ph === 'walk' && g.sim.salCh(H.sal()) === 2 && Math.sin(H.sal().a) < 0.3, 80);
  const C = H.sal(), ring = g.sim.rings[2];
  C.next = 99;
  // walk a little, then the player turns the ring under it (it keeps walking), then it stands (rest) while turned
  const log = [], seen = [];
  const turn = (secs, dir, label, every) => {
    for (let i = 0; i < secs * 60; i++) {
      ring.target = ring.body.getAngle() + 0.5 * dir;
      H.frame(1);
      const F = H.feetRing(2);
      if (F) log.push({ ph: C.ph, F });
      if (i % every === 0) { H.grab(`${label} ${C.ph}`); seen.push(...C.pts.filter((q, j) => j % 6 === 0).map((q) => ({ x: q.x, y: q.y }))); }
    }
    ring.target = ring.body.getAngle();
  };
  H.frame(30);
  const crop0 = C.pts.filter((q, i) => i % 6 === 0);
  turn(1.5, 1, 'turn ccw', 18);
  // stand still while carried: force a rest
  C.cool = 0; g.sim.salHalt(C, 'rest', 3);
  H.frame(30);
  log.length = 0;
  turn(1.6, -1, 'stand, turn cw', 16);
  // feet drift in the ring frame while it stands and the ring turns (planted feet must ride with the ring)
  let drift = 0;
  for (let i = 1; i < log.length; i++) for (let j = 0; j < 4; j++) {
    const a = log[i - 1].F[j], b = log[i].F[j];
    if (a.lift === 0 && b.lift === 0 && log[i].ph === 'rest' && log[i - 1].ph === 'rest') drift = Math.max(drift, Math.hypot(a.r * Math.cos(a.la) - b.r * Math.cos(b.la), a.r * Math.sin(a.la) - b.r * Math.sin(b.la)));
  }
  const crop = H.box(crop0.concat(seen), 0.5);
  return [{ name: '3-L21-ring-carry', png: H.strip(crop, 5), info: { plantedFootDriftInRingFrame_m: +drift.toFixed(4) } }];
};
SC.rival = () => {
  const H = window.__sw, g = window.__egg;
  H.setup(22); // L23 (lava + snake)
  // natural meeting first; else bring the salamander in just ahead of the snake's head
  let met = H.until(() => H.sal().ph === 'rival', 45), natural = met;
  const C = H.sal();
  if (!met) {
    H.until(() => g.sim.snakes[0].inside && g.sim.chAt(g.sim.snakes[0].rad) >= 1 && g.sim.chAt(g.sim.snakes[0].rad) < g.sim.rings.length && g.sim.snakes[0].pts.length > 20, 40);
    const S = g.sim.snakes[0], ch = g.sim.chAt(S.rad), d = Math.sign(Math.atan2(Math.sin(S.pts[0].a - S.pts[4].a), Math.cos(S.pts[0].a - S.pts[4].a))) || 1;
    C.ch = ch; C.dir = -d; C.a0 = S.a + d * 2.2 / S.rad; g.sim.salEnter(C); C.ph = 'walk'; C.next = 9;
    met = H.until(() => C.ph === 'rival' || C.pend === 'rival', 12);
  }
  H.frame(1);
  const S = g.sim.snakes[0];
  const heads = [];
  let n = 0;
  const fulls = [];
  for (let i = 0; i < 60 * 6 && H.frames.length < 15; i++) {
    H.frame(1);
    const el = C.ph === 'rival' ? C.dur - C.t : -1;
    if (fulls.length === 0 && el > 1.1) fulls.push(H.full());
    if (fulls.length === 1 && el > 1.62) fulls.push(H.full());
    if (n % 22 === 0) { H.grab(`${g.sim.t.toFixed(2)} sal ${C.ph} / snake ${S.rival > 0 ? 'rival' : S.back > 0 ? 'back' : 'hunt'}`); heads.push({ x: C.pts[0].x, y: C.pts[0].y }, { x: S.pts[0].x, y: S.pts[0].y }); }
    n++;
  }
  // the heads over the whole face-off, at least 3.6 m wide, kept on the canvas
  const crop = H.box(heads, 1.0), W = document.querySelector('canvas').clientWidth, side = 3.6 * g.G.rk;
  if (crop.w < side) { crop.x = Math.max(0, Math.min(W - side, crop.x - (side - crop.w) / 2)); crop.w = side; }
  return [{ name: '4-L23-snake-rivalry', png: H.strip(crop, 5), info: { met, natural } }, ...fulls.map((f, i) => ({ name: '4' + 'bc'[i] + '-L23-rivalry-full', png: f }))];
};
SC.boss = () => {
  const H = window.__sw, g = window.__egg, out = [];
  H.setup(24); // L25
  // QA only: the eggs cannot break, so an idle run reaches the later phases (t 30, t 60)
  g.sim.crack = () => {}; g.sim.breakEgg = () => {};
  const C = H.sal();
  const vault = () => [{ x: -g.sim.outerR, y: -g.sim.outerR }, { x: g.sim.outerR, y: g.sim.outerR + 0.6 }];
  // emerging, a lava throw from its mouth, a breath
  H.until(() => C.ph === 'in', 10);
  for (let i = 0; i < 3; i++) { H.frame(12); H.grab(`${g.sim.t.toFixed(1)} emerge`); }
  H.until(() => g.sim.bx.boss.atk && g.sim.bx.boss.atk.ph === 'warn', 20);
  for (let i = 0; i < 4; i++) { H.frame(10); H.grab(`${g.sim.t.toFixed(1)} rock ${g.sim.bx.boss.atk ? g.sim.bx.boss.atk.ph : '-'}`); }
  H.until(() => C.ph === 'warn', 20);
  for (let i = 0; i < 5; i++) { H.frame(14); H.grab(`${g.sim.t.toFixed(1)} breath ${C.ph}`); }
  // phase 2 (t 30) and 3 (t 60): the reel, then the next breath
  for (const ph of [1, 2]) {
    H.until(() => g.sim.bx.boss.phase >= ph, 70);
    for (let i = 0; i < 2; i++) { H.frame(20); H.grab(`${g.sim.t.toFixed(1)} phase ${ph + 1} ${C.ph}`); }
    H.until(() => C.ph === 'warn', 20);
    H.frame(30); H.grab(`${g.sim.t.toFixed(1)} phase ${ph + 1} ${C.ph}`);
    H.frame(20); H.grab(`${g.sim.t.toFixed(1)} phase ${ph + 1} ${C.ph}`);
    if (ph === 2) out.push({ name: '5b-L25-full', png: H.full() });
  }
  out.unshift({ name: '5-L25-boss', png: H.strip(H.box(vault(), 0.3), 4), info: { phase: g.sim.bx.boss.phase, state: g.sim.state } });
  return out;
};
SC.end = () => {
  const H = window.__sw, g = window.__egg;
  H.setup(20);
  H.until(() => H.sal().ph === 'walk', 20);
  H.frame(60);
  const C = H.sal(), crop = H.box(H.salPts(C), 1.2);
  // win: every egg into the nest at once
  for (const e of g.sim.aliveEggs()) { const P = e.body.getPosition(); e.body.setTransform(new P.constructor(g.sim.nest.getPosition().x, g.sim.nestY + 0.4), 0); e.body.setLinearVelocity(new P.constructor(0, 0)); }
  for (let i = 0; i < 9; i++) { H.frame(9); H.grab(`${g.sim.t.toFixed(2)} ${g.sim.state} ${C.ph}`); }
  const png = H.strip(crop, 5);
  H.setup(20);
  H.until(() => H.sal().ph === 'walk', 20);
  H.frame(60);
  for (const e of g.sim.aliveEggs()) g.sim.breakEgg(e, 'lost');
  const C2 = H.sal(), crop2 = H.box(H.salPts(C2), 1.0);
  for (let i = 0; i < 5; i++) { H.frame(14); H.grab(`${g.sim.state} ${C2.ph}`); }
  return [{ name: '6-L21-win-dive', png }, { name: '6b-L21-loss-grin', png: H.strip(crop2, 5) }];
};
SC.intro = () => {
  const g = window.__egg, out = [];
  g.setSave({ intro: {}, unlocked: 40 });
  g.start(20);
  for (let i = 0; i < 40; i++) g.frame(1 / 60);
  out.push({ name: '0-L21-intro-card', png: window.__sw.full(), info: { overlaps: g.overlaps() } });
  return out;
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const list = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SC);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await p.goto('file://' + path.join(ROOT, 'dist/dev/index.html'));
  await p.waitForFunction(() => window.__egg && window.__egg.G, null, { timeout: 15000 });
  await p.waitForTimeout(400);
  await p.evaluate(`(${PAGE.toString()})()`);
  for (const name of list) {
    const t0 = Date.now();
    const res = await p.evaluate(`(${SC[name].toString()})()`);
    for (const r of res) {
      const f = path.join(OUT, r.name + '.png');
      fs.writeFileSync(f, Buffer.from(r.png.split(',')[1], 'base64'));
      console.log(name, '->', f, r.info ? JSON.stringify(r.info) : '', `${Date.now() - t0}ms`);
    }
  }
  if (errs.length) console.log('PAGE ERRORS:\n' + errs.join('\n'));
  await b.close();
})();
