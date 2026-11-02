// Animated hen QA (V3-PLAN M7, hen redesign): film strips from the live dev build.
// Sheets written to <outDir>:
//   hen-states.png   one row per state (idle, walk, worried, cheer, cry, dance), 8 frames each, at in-level scale
//                    (hen 52 css px tall on a 390x844 phone, rendered at DPR 2)
//   hen-closeup.png  3x close-ups (156 px hen), one beat per state, both facings
//   hen-compare.png  (with --old) the previous build's hen beside the new one per mood, at phone scale and close up,
//                    plus the reference-sprite hen (drawHenLegacy) for the record
//   hen-family.png   the real game on six worlds (farm, barn, frozen, blizzard, crystal, volcano): the hen in place
//                    beside the nest with the rooster and the goose drawn on the same ground, phone scale and 3x
//   hen-live.png     the real game: an egg falls into the nest (she walks under it, then cheers), an egg breaks (cry)
//   hen-screens.png  full phone screens: title, a level, the win card, the fail card (old above new with --old)
// Usage: node tools/hen-strips.cjs [dist/dev] [outDir=qa/hen] [--port 8901] [--old <older dist/dev>]
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const args = argv.filter((a, i) => !a.startsWith('--') && !['--port', '--old'].includes(argv[i - 1]));
const dir = path.resolve(args[0] || 'dist/dev');
const out = path.resolve(args[1] || 'qa/hen');
const PORT = +(opt('--port') || 8901);
const OLD = opt('--old') ? path.resolve(opt('--old')) : null;
const VW = 390, VH = 844, DPR = 2;
fs.mkdirSync(out, { recursive: true });

const serve = (root, port) => http.createServer((q, r) => {
  const f = path.join(root, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); });
}).listen(port);
const servers = [serve(dir, PORT)];
if (OLD) servers.push(serve(OLD, PORT + 1));

// Row definitions. sched: [time, {mood, n, look, danger}] applied once t passes `time`. at: capture times (s).
const rows = [
  { name: 'idle: breathe, blink, peck, ruffle', idle: true },
  { name: 'walk: turns and shuffles left under the egg, stops, shuffles right, turns back to the nest (grey tick = home)', look: true,
    sched: [[0, { look: 0 }], [0.5, { look: -1 }], [1.45, { look: 0 }], [1.7, { look: 1 }], [2.4, { look: 0 }]], at: [0.45, 0.6, 0.8, 1.3, 1.62, 1.8, 2.2, 2.9] },
  { name: 'worried: a crack (gasp), head darts, feathers puff, then calms', sched: [[0.5, { mood: 'gasp', n: 1 }], [1.9, { mood: 'idle', n: 1 }]], at: [0.4, 0.52, 0.62, 0.8, 1.05, 1.45, 2.05, 2.6] },
  { name: 'cheer: an egg lands (crouch, hop, flap, land, burst)', sched: [[0.4, { mood: 'happy', n: 1 }], [2.0, { mood: 'idle', n: 1 }]], at: [0.38, 0.47, 0.58, 0.7, 0.86, 0.98, 1.2, 1.55] },
  { name: 'cry: an egg breaks (droop, sobs, wipe a tear), then recovers', sched: [[0.4, { mood: 'cry', n: 1 }], [2.6, { mood: 'idle', n: 1 }]], at: [0.35, 0.7, 1.1, 1.7, 2.2, 2.55, 3.0, 3.6] },
  { name: 'dance: win card (hops, kicks, wings in turns)', sched: [[0.2, { mood: 'dance', n: 0 }]], at: [0.1, 0.4, 0.55, 0.7, 0.85, 1.0, 1.15, 1.3] },
];
const WORLDS = ['farm', 'barn', 'frozen', 'blizzard', 'crystal', 'volcano'];
const STUDIO = (theme) => ({ eggs: 3, target: 1, time: 0, spacing: 1.05, material: 'wood', nest: { w: 2.6 }, seed: 77, tip: '', theme, rings: [{ gaps: [{ a: -90 }] }, { gaps: [{ a: -90 }] }, { gaps: [{ a: -90 }] }] });

// in-page harness: draw a hen on a small ground cell, stepping its clock at 60 fps (works on old and new builds)
function harness() {
  const H = __egg.hen;
  window.requestAnimationFrame = () => 0; // the game loop stops: every frame from here is driven by the tool
  window.cell = (fn, w, hh, h) => {
    const c = document.createElement('canvas');
    c.width = w * 2; c.height = hh * 2;
    const x = c.getContext('2d');
    x.scale(2, 2);
    const g = x.createLinearGradient(0, 0, 0, hh);
    g.addColorStop(0, '#6f8fb3'); g.addColorStop(0.72, '#9ab6cf'); g.addColorStop(0.72, '#6b9a4a'); g.addColorStop(1, '#4f7a38');
    x.fillStyle = g; x.fillRect(0, 0, w, hh);
    const gy = hh * 0.8;
    x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 1; x.beginPath(); x.moveTo(w / 2, gy - 3); x.lineTo(w / 2, gy + 4); x.stroke();
    x.strokeStyle = '#c9a24a'; x.lineCap = 'round'; x.lineWidth = Math.max(1, h * 0.022);
    for (const [a, bb, cc] of [[-0.42, -0.02, -0.22], [-0.3, 0.01, -0.05], [0.18, -0.01, 0.4], [0.3, 0.02, 0.5]]) { x.beginPath(); x.moveTo(w / 2 + a * h, gy + bb * h); x.lineTo(w / 2 + cc * h, gy + bb * h - h * 0.03); x.stroke(); }
    fn(x, w / 2, gy - 0.49 * h, h);
    return c.toDataURL('image/png');
  };
  // run a row: returns a data URL for each capture time
  window.runRow = (spec, h, w, hh, face) => {
    H.reset('strip');
    const st = { mood: 'idle', n: 0, look: spec.look ? 0 : undefined, danger: 0 };
    const sched = (spec.sched || []).slice();
    const at = spec.at.slice();
    const outs = [];
    let t = 100;
    const t0 = t;
    const draw = (x, cx, cy, hh2) => H.anim(x, st.mood, cx, cy, hh2, t, { key: 'strip', n: st.n, look: st.look, danger: st.danger, shadow: 0.26, face });
    const tmp = document.createElement('canvas').getContext('2d');
    for (let i = 0; i < 60 * 40 && at.length; i++) {
      while (sched.length && t - t0 >= sched[0][0]) Object.assign(st, sched.shift()[1]);
      draw(tmp, 0, 0, h); // every frame, so the state advances exactly as in the game
      if (t - t0 >= at[0] - 1e-6) { outs.push(window.cell(draw, w, hh, h)); at.shift(); }
      t += 1 / 60;
    }
    return outs;
  };
  // times (in the hen's own clock) of the first blink peak, peck and ruffle
  window.evFind = () => {
    const r = { blink: null, peck: null, ruffle: null };
    for (let i = 0; i < 60 * 40; i++) {
      const tt = i / 60, e = H.events(tt);
      if (r.blink == null && e.blink > 0.97) r.blink = tt;
      if (r.peck == null && e.peck >= 0 && e.peck < 0.02) r.peck = tt;
      if (r.ruffle == null && e.ruffle >= 0 && e.ruffle < 0.02) r.ruffle = tt;
    }
    return r;
  };
  // one mood beat: idle for a moment, then `mood` for `secs`
  window.beat = (mood, secs, h, w, hh, key, face) => {
    H.reset(key);
    let tm = 100;
    const tmp = document.createElement('canvas').getContext('2d');
    const o = { key, n: 1, face };
    H.anim(tmp, 'idle', 0, 0, h, tm, o);
    for (let i = 0; i < Math.round(secs * 60); i++) { tm += 1 / 60; H.anim(tmp, mood, 0, 0, h, tm, o); }
    return window.cell((x, cx, cy, hh2) => H.anim(x, mood, cx, cy, hh2, tm, { ...o, shadow: 0.26 }), w, hh, h);
  };
  window.Q = {
    run(s) { for (let i = 0; i < Math.round(s * 60); i++) __egg.frame(1 / 60); },
    boot(L, idx) {
      const E = __egg;
      E.setSave({ mode: 'medium', calm: false, seen: {} });
      if (L) { E.G.demo = { id: 990, name: 'Studio', ...L }; E.start(-2, { direct: true }); } else E.start(idx || 0, { direct: true });
      E.G.toast = null; if (E.G.toasts) E.G.toasts.length = 0;
      E.G.paused = false;
    },
    // screen position of the hen's feet and of the nest's left rim (css px)
    where() {
      const G = __egg.G, s = G.sim, k = G.cam.k, P = G.play, sc = Math.max(0.95, Math.min(52, k * 1.5) / k), n = s.nest.getPosition();
      const x = n.x + s.nestW / 2 + 0.6 + (sc - 0.95) / 2;
      const sx = (wx) => P.x + P.w / 2 + (wx - G.cam.x) * k;
      return { x: sx(x), y: P.y + P.h / 2 - (s.groundY - G.cam.y) * k, k, nl: sx(n.x - s.nestW / 2), hs: sc * k };
    },
    put(i, x, y) { const e = __egg.G.sim.eggs[i]; e.body.setTransform({ x, y }, 0); e.body.setLinearVelocity({ x: 0, y: 0 }); },
    // the rooster and the goose on the same ground, left of the nest, at their in-game size (ALLY SIZE * k)
    family(t) {
      const A = __egg.allyArt, w = Q.where(), cv = document.querySelector('canvas'), c = cv.getContext('2d'), d = cv.width / innerWidth;
      c.save(); c.setTransform(d, 0, 0, d, 0, 0);
      const r = A.SIZE.rooster * w.k, g = A.SIZE.goose * w.k;
      for (const [x, s] of [[w.nl - 0.45 * r, r], [w.nl - r - 0.55 * g, g]]) { c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(x, w.y, 0.36 * s, 0.07 * s, 0, 0, Math.PI * 2); c.fill(); }
      A.drawRooster(c, w.nl - 0.45 * r, w.y - 0.48 * r, r, A.roosterPose('idle', 0, t));
      A.drawGoose(c, w.nl - r - 0.55 * g, w.y - 0.48 * g, g, A.goosePose('idle', 0, t));
      c.restore();
      return { x0: w.nl - r - 1.1 * g, x1: w.x + 0.62 * w.hs, y: w.y };
    },
  };
}

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const open = async (port, dpr = DPR) => {
    const p = await b.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: dpr });
    p.on('pageerror', (e) => errors.push(`:${port} ${e}`));
    await p.goto('http://localhost:' + port + '/');
    await p.waitForTimeout(1200);
    await p.evaluate(harness);
    return p;
  };
  const p = await open(PORT);
  const po = OLD ? await open(PORT + 1) : null;

  // ---- states at phone scale
  const imgs = {};
  const H1 = 52, W1 = 130, HH1 = 92;
  for (const r of rows) {
    if (r.idle) {
      const ev = await p.evaluate(() => evFind());
      r.at = [0.3, ev.blink, ev.peck + 0.25, ev.peck + 0.62, ev.peck + 0.95, ev.ruffle + 0.2, ev.ruffle + 0.5, ev.ruffle + 0.72].map((v) => Math.round(v * 60) / 60);
      r.sorted = r.at.map((v, i) => [v, i]).sort((a, b2) => a[0] - b2[0]);
    }
    const order = r.sorted;
    const spec = { ...r, at: order ? order.map((x) => x[0]) : r.at };
    let urls = await p.evaluate(([s, h, w, hh]) => runRow(s, h, w, hh), [spec, H1, W1, HH1]);
    if (order) { const o2 = []; order.forEach(([, i], k) => (o2[i] = urls[k])); urls = o2; }
    imgs[r.name] = { urls, at: r.at, tags: r.idle ? ['breathe', 'blink', 'peck 25%', 'peck 62%', 'peck 95%', 'ruffle 20%', 'ruffle 50%', 'ruffle 72%'] : null };
  }

  // ---- 3x close-ups: one beat of each state
  const ev = await p.evaluate(() => evFind());
  const CL = [['idle', 'idle', 1.2, -1], ['idle', 'peck', ev.peck + 0.5, -1], ['gasp', 'gasp', 0.7, -1], ['worried', 'worried', 1.1, -1], ['happy', 'cheer (up)', 0.3, -1],
    ['happy', 'cheer (land)', 0.62, -1], ['cry', 'cry', 1.0, -1], ['cry', 'cry: wipe', 1.55, -1], ['dance', 'dance', 0.55, -1], ['dance', 'dance', 0.85, -1], ['idle', 'idle, facing right', 1.2, 1], ['gasp', 'gasp, facing right', 0.9, 1]];
  const close = [];
  for (const [m, label, secs, face] of CL) close.push({ url: await p.evaluate(([a, s2, f]) => beat(a, s2, 156, 300, 230, 'cl', f), [m, secs, face]), label });

  // ---- old vs new
  const MOODS = [['idle', 'idle', 1.2], ['happy', 'cheer', 0.3], ['gasp', 'gasp', 0.8], ['worried', 'worried', 1.1], ['cry', 'cry', 1.0], ['dance', 'dance', 0.55]];
  const cmp = { oldS: [], newS: [], oldC: [], newC: [], legacy: [] };
  if (po) {
    for (const [m, lab, secs] of MOODS) {
      cmp.oldS.push({ url: await po.evaluate(([a, s2]) => beat(a, s2, 52, 130, 92, 'o'), [m, secs]), label: 'old ' + lab });
      cmp.newS.push({ url: await p.evaluate(([a, s2]) => beat(a, s2, 52, 130, 92, 'n'), [m, secs]), label: 'new ' + lab });
      cmp.oldC.push({ url: await po.evaluate(([a, s2]) => beat(a, s2, 156, 300, 230, 'o'), [m, secs]), label: 'old ' + lab });
      cmp.newC.push({ url: await p.evaluate(([a, s2]) => beat(a, s2, 156, 300, 230, 'n'), [m, secs]), label: 'new ' + lab });
      cmp.legacy.push({ url: await p.evaluate(([a]) => cell((x, cx, cy, h) => __egg.hen.legacy(x, a, cx, cy, h, 101, { key: 'leg' }), 130, 92, 52), [m]), label: 'sprite ' + lab });
    }
  }

  // ---- family: the real game on six worlds, rooster and goose on the same ground
  const fam = [];
  const pz = await open(PORT, 6); // the same scenes rendered at 6 device px per css px, for the 3x crops
  for (const w of WORLDS) {
    const shots = [];
    for (const pg of [p, pz]) {
      const box = await pg.evaluate(([L]) => { Q.boot(L); Q.run(0.6); return Q.family(100.3); }, [STUDIO(w)]);
      const x0 = Math.max(0, Math.floor(box.x0) - 4), x1 = Math.min(VW, Math.ceil(box.x1) + 4), y1 = Math.min(VH, box.y + 14), y0 = y1 - 96;
      shots.push('data:image/png;base64,' + (await pg.screenshot({ clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } })).toString('base64'));
      shots.push(x1 - x0);
    }
    fam.push({ world: w, small: shots[0], sw: shots[1], big: shots[2], bw: shots[3] });
  }
  await pz.close();
  // lineup: hen, rooster, goose all facing right on one ground line, at their in-game sizes (k = 41 px/m) and 3x
  const lineup = await p.evaluate(() => {
    const A = __egg.allyArt, k = 41.2, res = [];
    for (const zoom of [1, 3]) {
      const W = 250 * zoom, Hh = 90 * zoom, cv = document.createElement('canvas');
      cv.width = Math.round(W * 2); cv.height = Math.round(Hh * 2);
      const c = cv.getContext('2d');
      c.scale(2 * zoom, 2 * zoom);
      c.fillStyle = '#9fd3f2'; c.fillRect(0, 0, 250, 90);
      c.fillStyle = '#7bbf5a'; c.fillRect(0, 74, 250, 16);
      const gy = 76, hs = Math.max(0.95, Math.min(52, k * 1.5) / k) * k; // the game's hen size at this k
      A.drawHen(c, 45, gy - 0.48 * hs, hs, 'idle', 0.3);
      A.drawRooster(c, 125, gy - 0.48 * A.SIZE.rooster * k, A.SIZE.rooster * k, A.roosterPose('idle', 0, 0.3));
      A.drawGoose(c, 200, gy - 0.48 * A.SIZE.goose * k, A.SIZE.goose * k, A.goosePose('idle', 0, 0.3));
      res.push({ url: cv.toDataURL(), w: W, label: zoom === 1 ? 'phone scale' : '3x' });
    }
    return res;
  });

  // ---- live: the real game. An egg dropped near the nest lands (she walks under it, cheers), another breaks (cry).
  const live = [];
  await p.evaluate(([L]) => { Q.boot(L); Q.run(0.6); }, [STUDIO('farm')]);
  const CROP = 190;
  const shoot = async (label) => {
    const h = await p.evaluate(() => Q.where());
    const cx = Math.round(Math.min(Math.max(h.x - 50, CROP / 2), VW - CROP / 2)), cy = Math.round(Math.min(Math.max(h.y - 40, CROP / 2), VH - CROP / 2));
    const buf = await p.screenshot({ clip: { x: cx - CROP / 2, y: cy - CROP / 2, width: CROP, height: CROP } });
    live.push({ url: 'data:image/png;base64,' + buf.toString('base64'), label: label + ' (mood: ' + (await p.evaluate(() => __egg.G.hen.mood)) + ')' });
  };
  await shoot('idle in the level');
  const nest = await p.evaluate(() => { const s = __egg.G.sim, n = s.nest.getPosition(); return { x: n.x, y: s.groundY }; });
  await p.evaluate(([nx, gy]) => { Q.put(0, nx - 0.3, gy + 1.7); }, [nest.x, nest.y]);
  for (const lab of ['egg dropped', '+0.1 s', '+0.2 s']) { await p.evaluate(() => Q.run(0.1)); await shoot(lab); }
  for (let i = 0; i < 8; i++) { await p.evaluate(() => Q.run(0.1)); if (await p.evaluate(() => __egg.G.sim.savedLog.length)) break; }
  for (const lab of ['egg saved', '+0.13 s', '+0.26 s', '+0.39 s']) { await shoot(lab); await p.evaluate(() => Q.run(0.13)); }
  await p.evaluate(() => Q.run(1.5));
  await p.evaluate(([nx, gy]) => { Q.put(1, nx + 7, gy + 0.6); }, [nest.x, nest.y]);
  for (const lab of ['second egg dropped', '+0.28 s', '+0.56 s', '+0.84 s', '+1.12 s', '+1.4 s']) { await p.evaluate(() => Q.run(0.28)); await shoot(lab); }
  console.log('live end state', JSON.stringify(await p.evaluate(() => ({ hen: __egg.G.hen, saved: __egg.G.sim.savedLog.length }))));

  // ---- full phone screens: title, a level, win, fail
  const screens = async (pg) => {
    const res = [];
    await pg.reload(); await pg.waitForTimeout(1200); await pg.evaluate(harness);
    await pg.evaluate(() => Q.run(1.2));
    res.push({ url: 'data:image/png;base64,' + (await pg.screenshot()).toString('base64'), label: 'title' });
    await pg.evaluate(() => { Q.boot(null, 0); Q.run(1.5); });
    res.push({ url: 'data:image/png;base64,' + (await pg.screenshot()).toString('base64'), label: 'level 1' });
    await pg.evaluate(() => { __egg.showResult('win', 3); Q.run(1.6); });
    res.push({ url: 'data:image/png;base64,' + (await pg.screenshot()).toString('base64'), label: 'win' });
    await pg.evaluate(() => { Q.boot(null, 0); Q.run(0.3); __egg.showResult('fail'); Q.run(1.2); });
    res.push({ url: 'data:image/png;base64,' + (await pg.screenshot()).toString('base64'), label: 'fail' });
    return res;
  };
  const scrNew = await screens(p);
  const scrOld = po ? await screens(po) : [];

  // ---- sheets
  const grp = (title, cells, w) => `<div style="margin-bottom:12px"><div style="font-weight:bold;margin:2px 0 4px">${title}</div><div style="display:flex;gap:4px;flex-wrap:wrap">${cells.map((c) => `<div><img style="width:${c.w || w}px;display:block;border-radius:4px" src="${c.url}"><div style="font-size:11px;padding:1px 2px">${c.label || ''}</div></div>`).join('')}</div></div>`;
  const wrap = (body) => `<html><body style="margin:0;background:#1d1712;color:#f5e6c8;font:13px sans-serif;padding:8px">${body}</body></html>`;
  const shot = async (html, file, width) => {
    const p2 = await b.newPage({ viewport: { width, height: 300 } });
    await p2.setContent(html);
    await p2.waitForTimeout(100);
    await p2.screenshot({ path: path.join(out, file), fullPage: true });
    await p2.close();
  };
  const stateRows = rows.map((r) => grp(r.name, imgs[r.name].urls.map((u, i) => ({ url: u, label: (imgs[r.name].tags ? imgs[r.name].tags[i] + ' ' : '') + imgs[r.name].at[i].toFixed(2) + ' s' })), W1)).join('');
  await shot(wrap('<div style="margin-bottom:8px">phone scale: each cell is 130 css px wide, the hen 52 css px (the in-level size)</div>' + stateRows), 'hen-states.png', Math.round(W1 * 8 + 60));
  await shot(wrap(grp('3x close-ups (156 px hen), one beat per state; she faces the nest (left) unless told otherwise', close, 300)), 'hen-closeup.png', 300 * 4 + 50);
  if (po) {
    await shot(wrap(grp('phone scale (52 px): previous build', cmp.oldS, 130) + grp('phone scale (52 px): new', cmp.newS, 130) + grp('the reference-sprite hen (drawHenLegacy, not used in the game)', cmp.legacy, 130)
      + grp('3x: previous build', cmp.oldC, 200) + grp('3x: new', cmp.newC, 200)), 'hen-compare.png', 200 * 6 + 70);
  }
  const famHtml = fam.map((f) => grp(`${f.world}: phone scale, then 3x`, [{ url: f.small, w: f.sw, label: '' }, { url: f.big, w: f.bw * 3, label: '' }], 0)).join('');
  await shot(wrap(grp('the family: hen, rooster, goose, all facing right, in-game sizes', lineup, 0) + '<div style="margin-bottom:8px">the real game: goose, rooster (in-game size) and the hen beside her nest, one ground line</div>' + famHtml), 'hen-family.png', Math.round(VW * 4 + 60));
  await shot(wrap(grp('live: the real game, phone 390x844, crops shown at real size (190 css px)', live, 190)), 'hen-live.png', Math.round(194 * 7 + 30));
  await shot(wrap((po ? grp('previous build', scrOld, 300) : '') + grp(po ? 'new' : 'screens', scrNew, 300)), 'hen-screens.png', 300 * 4 + 50);
  for (const e of errors) console.log('PAGE ERROR: ' + e);
  console.log('wrote ' + out);
  await b.close();
  for (const s of servers) s.close();
})();
