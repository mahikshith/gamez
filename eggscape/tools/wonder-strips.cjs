// Wonder Vaults film strips: plays every bonus level's scripted clear in headless Chromium with SYNTHETIC POINTER INPUT
// (pointerdown / pointermove / pointerup on the canvas: the same handlers a finger reaches), frame by frame, and saves
// a film strip + hero shot per level and one combined sheet.
// Usage: node tools/wonder-strips.cjs <dir with the dev build> <outDir> [key,key] [WxH]
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const dir = path.resolve(process.argv[2] || 'dist/dev');
const out = path.resolve(process.argv[3] || 'out');
const only = process.argv[4] && process.argv[4] !== 'all' ? process.argv[4].split(',') : null;
const [VW, VH] = (process.argv[5] || '390x844').split('x').map(Number);
fs.mkdirSync(out, { recursive: true });
const PORT = +process.env.QA_PORT || 8791;
const srv = http.createServer((q, r) => {
  const f = path.join(dir, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); });
}).listen(PORT);

// runs in the page: a frame-stepped bot that plays level.solve with pointer events
function installBot(key) {
  const E = window.__egg, Wd = E.wonder, canvas = document.getElementById('game');
  E.G.paused = true; // the page's own loop stops; the bot steps frames itself
  E.startDemo(key);
  const S = Wd.state, L = S.level, g = () => S.game, D = Math.PI / 180, wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  window.__wlog = [];
  const hook = () => { for (const sim of S.game.sims) if (!sim.__hooked) { sim.__hooked = 1; const b = sim.breakEgg.bind(sim), sv = sim.saveEgg.bind(sim); sim.breakEgg = (e, why) => { const p = e.body.getPosition(); window.__wlog.push(`${sim.t.toFixed(1)} break:${why} at(${p.x.toFixed(2)},${p.y.toFixed(2)})${sim.hen ? ' hen' + Math.round(sim.hen.a * 57.3) : ''}`); return b(e, why); }; sim.saveEgg = (e) => { window.__wlog.push(`${sim.t.toFixed(1)} save`); return sv(e); }; } };
  const ev = (type, x, y) => (type === 'pointerdown' ? canvas : window).dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', bubbles: true, cancelable: true }));
  const live = () => g().state === 'play';
  // mama, like a player watching (same rule as tools/wonder-check.mjs): she waits when even her lead egg lags 0.8 rad behind
  const lags = (sim, cmd, way) => { const eggs = sim.eggs.filter((e) => e.alive && !e.saved); if (!eggs.length) return false; let best = -9; for (const e of eggs) { const p = e.body.getPosition(), q = Math.atan2(p.y, p.x); best = Math.max(best, -wrap(cmd - q) * way); } return -best > 0.8; };
  function* frames(n) { for (let i = 0; i < n; i++) yield; }
  // press on a ring and drag along it until left() says nothing is left; rate rad/s
  function* drag(si, ri, left, rate) {
    const sim = g().sims[si], ring = sim.rings[ri], R = g().kind === 'planet' ? ring.r : ring.r - 0.2;
    let th = Math.PI * 0.9;
    const at = (a) => Wd.toScreen(si, R * Math.cos(a), R * Math.sin(a)), c = Wd.toScreen(si, 0, 0);
    let p = at(th);
    const px = Math.hypot(p.x - c.x, p.y - c.y), gain = Math.pow(Math.max(px, 70 * Math.max(0.78, Math.min(1.5, Math.min(innerWidth, innerHeight) / 420))) / px, 2); // a touch near the hub turns less per pixel
    ev('pointerdown', p.x, p.y);
    yield;
    for (let i = 0; i < 60 * 40 && live(); i++) {
      const l = left();
      if (l == null || Math.abs(l) < 0.003) break;
      th += Math.sign(l) * Math.min(Math.abs(l), rate / 60) * gain;
      p = at(th); ev('pointermove', p.x, p.y);
      yield;
    }
    ev('pointerup', p.x, p.y);
  }
  function* run() {
    yield* frames(100); // the level opens: tip, the teaching hand
    for (const a of L.solve) {
      if (!live()) break;
      if (a[0] === 'wait') yield* frames(Math.round(a[1] * 60));
      else if (a[0] === 'hen') {
        const sim = g().sim, H = sim.hen, want = a[1] * D, pace = a[3] || 0.5, R = sim.nestR + 0.1;
        let d = wrap(want - H.target); if (a[2] && Math.sign(d) !== a[2]) d += a[2] * 2 * Math.PI;
        let cmd = H.target, leftA = d, p = Wd.toScreen(0, R * Math.cos(cmd), R * Math.sin(cmd));
        ev('pointerdown', p.x, p.y); yield;
        while (Math.abs(leftA) > 1e-4 && live()) { const st = Math.sign(leftA) * Math.min(Math.abs(leftA), (pace * H.speed) / 60); if (!lags(sim, cmd, Math.sign(leftA))) { cmd += st; leftA -= st; } p = Wd.toScreen(0, R * Math.cos(cmd), R * Math.sin(cmd)); ev('pointermove', p.x, p.y); yield; }
        ev('pointerup', p.x, p.y);
        yield* frames(Math.round((a[4] ?? 1.5) * 60));
      } else if (a[0] === 'set') {
        const ring = g().sim.rings[a[1]], a0 = ring.body.getAngle(), goal = wrap(a[2] * D);
        yield* drag(0, a[1], () => goal - (ring.body.getAngle() - a0), 1.6);
        yield* frames(25);
      } else if (a[0] === 'hatch') {
        yield* frames(50);
        const b = E.uiRect('btn:wv:hatch'), x = b.x + b.w / 2, y = b.y + b.h / 2;
        ev('pointerdown', x, y); yield* frames(4); ev('pointerup', x, y);
        for (let i = 0; i < 60 * 45 && live() && g().phase === 'run'; i++) yield;
      } else if (a[0] === 'drop') {
        const [, si, ri, id, dir, w] = a, sim = g().sims[si], ring = sim.rings[ri], egg = sim.eggs.find((e) => e.id === id), ch0 = sim.channelOf(egg);
        yield* drag(si, ri, () => {
          if (!egg.alive || egg.saved || sim.channelOf(egg) !== ch0) return null;
          const p = egg.body.getPosition(), ea = Math.atan2(p.y, p.x);
          let best = 9;
          for (const gp of ring.gaps) { let d = ((ea - (ring.target + gp.a)) * dir) % (2 * Math.PI); if (d < -0.5) d += 2 * Math.PI; if (d < best) best = d; }
          return best < 0.004 ? 0.0031 * 0 + (Math.abs(ring.target - ring.body.getAngle()) > 0.01 ? 1e-9 + 0.004 : 0.004) * 0 + 0.0001 + 0.004 : best * dir; // keep holding until it falls
        }, sim.maxOmega(ring) * 0.8);
        yield* frames(Math.round((w ?? 1.2) * 60));
      } else {
        const [si, ri, dd, w] = a, sim = g().sims[si], ring = sim.rings[ri], t0 = ring.target, goal = dd * D;
        yield* drag(si, ri, () => goal - (ring.target - t0), sim.maxOmega(ring) * 0.8);
        for (let i = 0; i < 240 && live() && Math.abs(ring.target - ring.body.getAngle()) > 0.004; i++) yield;
        yield* frames(Math.round((w ?? 1.2) * 60));
      }
    }
    for (let i = 0; i < 60 * 40 && !S.card; i++) yield; // play out to the end card
    yield* frames(150);
  }
  const it = run();
  window.__bot = { done: false, n: 0, tick(k) { for (let i = 0; i < k && !this.done; i++) { hook(); this.done = !!it.next().done; if (window.__trace && this.n % 60 === 0) { const sm = g().sims[Math.min(g().sims.length, window.__trace) - 1]; window.__wlog.push(`T${sm.t.toFixed(1)}${sm.hen ? ' h' + Math.round(sm.hen.a * 57.3) : ''} ` + sm.eggs.map((e) => { const q = e.body.getPosition(); return `${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join(' ')); } E.frame(1 / 60); this.n++; } return { done: this.done, n: this.n, state: g().state, card: S.card, stars: g().stars(), st: g().stats(), t: g().t, overlaps: E.overlaps(), log: window.__wlog }; } };
}

(async () => {
  const b = await chromium.launch();
  const strips = [];
  let problems = 0;
  const keys = ['planet', 'plan', 'mama', 'twin', 'hatch'].filter((k) => !only || only.includes(k));
  for (const key of keys) {
    const p = await b.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 });
    const errors = [];
    p.on('pageerror', (e) => errors.push(String(e)));
    p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await p.goto(`http://localhost:${PORT}/`);
    await p.waitForTimeout(900);
    if (process.env.TRACE) await p.evaluate((n) => { window.__trace = n; }, +process.env.TRACE);
    await p.evaluate(installBot, key);
    const shots = [];
    let r = { done: false }, ov = new Set();
    while (!r.done && shots.length < 400) {
      r = await p.evaluate(() => window.__bot.tick(24));
      for (const o of r.overlaps || []) ov.add(o.join(' x '));
      shots.push(await p.screenshot({ type: 'jpeg', quality: 82 }));
    }
    const name = await p.evaluate(() => __egg.wonder.state.level.name);
    console.log(`${key.padEnd(7)} ${r.state} stars=${r.stars} saved=${r.st.saved}/${r.st.total} t=${r.t.toFixed(1)}s frames=${r.n} card=${r.card} pageErrors=${errors.length} overlaps=${ov.size ? [...ov].join('; ') : 'none'}`);
    for (const e of errors.slice(0, 4)) console.log('   ' + e);
    if (r.log && r.log.length) console.log('   events: ' + r.log.join(' | '));
    if (r.state !== 'won' || errors.length || ov.size) problems++;
    // 12 frames: the opening, ten through the run, the end card
    const N = 12, pick = [];
    for (let i = 0; i < N; i++) pick.push(shots[Math.min(shots.length - 1, Math.round(1 + (i * (shots.length - 2)) / (N - 1)))]);
    const hero = shots[Math.round(shots.length * (key === 'plan' ? 0.82 : 0.45))];
    fs.writeFileSync(path.join(out, `hero-${key}-${VW}x${VH}.jpg`), hero);
    strips.push({ key, name, pick, line: `${r.state.toUpperCase()}  stars ${r.stars}  saved ${r.st.saved}/${r.st.total}  ${r.t.toFixed(0)} s` });
    await p.close();
  }
  const cellW = Math.floor(1980 / 12);
  const row = (s) => `<div style="padding:6px 10px 10px"><div style="font:600 20px sans-serif;margin:4px 0 6px">${s.name} <span style="font:14px sans-serif;color:#bbb">(${s.key}) pointer-played in Chromium: ${s.line}</span></div><div style="display:flex;gap:2px">${s.pick.map((f, i) => `<div style="position:relative"><img src="data:image/jpeg;base64,${f.toString('base64')}" style="width:${cellW - 2}px;display:block"><div style="position:absolute;left:3px;bottom:3px;background:#000a;padding:0 4px;font:11px sans-serif">${i + 1}</div></div>`).join('')}</div></div>`;
  const pg = await b.newPage({ viewport: { width: 2000, height: 600 } });
  for (const s of strips) {
    await pg.setContent(`<html><body style="margin:0;background:#1b1b22;color:#eee;width:2000px">${row(s)}</body></html>`);
    await pg.waitForTimeout(150);
    await pg.screenshot({ path: path.join(out, `strip-${s.key}-${VW}x${VH}.jpg`), fullPage: true, type: 'jpeg', quality: 78 });
  }
  if (strips.length > 1) {
    await pg.setContent(`<html><body style="margin:0;background:#1b1b22;color:#eee;width:2000px">${strips.map(row).join('')}</body></html>`);
    await pg.waitForTimeout(300);
    let q = 74; const f = path.join(out, `wonder-sheet-${VW}x${VH}.jpg`);
    do { await pg.screenshot({ path: f, fullPage: true, type: 'jpeg', quality: q }); q -= 8; } while (fs.statSync(f).size > 1.45e6 && q > 30);
    console.log('sheet', f, (fs.statSync(f).size / 1e6).toFixed(2), 'MB');
  }
  await b.close();
  srv.close();
  console.log(problems ? `PROBLEMS: ${problems}` : 'ALL PLAYED AND WON, NO PAGE ERRORS, NO OVERLAPS');
  process.exit(problems ? 1 : 0);
})();
