// Safe-area QA: every menu and in-game screen at phone sizes with fake Android insets (window.__eggSafe, as the shell
// injects them), the inset bands tinted red so overlap is visible, and the UI layer's own overlap/OFFSCREEN check
// (anything recorded outside the safe rect) printed per shot. Also films a swipe between two worlds on the level map.
// Usage: node tools/layout-shots.cjs <dev build dir> [outDir]
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const dir = path.resolve(process.argv[2] || 'dist/dev');
const out = path.resolve(process.argv[3] || 'qa/layout');
fs.mkdirSync(out, { recursive: true });
const PORT = +process.env.QA_PORT || 8791;
const PRESETS = [
  ['412x915', 412, 915, { t: 36, b: 28, l: 0, r: 0 }],
  ['360x780', 360, 780, { t: 28, b: 24, l: 0, r: 0 }],
  ['430x932', 430, 932, { t: 54, b: 34, l: 0, r: 0 }],
  ['915x412', 915, 412, { t: 0, b: 20, l: 36, r: 0 }],
  ['1280x720', 1280, 720, null],
];
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;

const srv = http.createServer((q, r) => {
  const u = q.url.split('?')[0];
  fs.readFile(path.join(dir, u === '/' ? 'index.html' : u), (e, d) => {
    if (e) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'content-type': u.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d);
  });
}).listen(PORT);

const SCREENS = {
  title: () => { const E = __egg; E.G.screen = 'title'; E.G.screenT = 5; },
  levels: () => { const E = __egg; E.setSave({ unlocked: 20, stars: { 1: 3, 2: 2, 3: 1 } }); E.G.screen = 'title'; E.press('levels'); },
  'levels-boss': () => { const E = __egg; E.setSave({ unlocked: 50, stars: { 1: 3, 2: 2, 3: 1 } }); E.G.screen = 'title'; E.press('levels'); E.G.world = 9; },
  extras: () => { const E = __egg; E.G.screen = 'title'; E.press('extras'); },
  practice: () => { const E = __egg; E.G.screen = 'title'; E.press('practice'); E.G.pscroll.y = 0; },
  store: () => { const E = __egg; E.setSave({ unlocked: 20, wallet: { coins: 120, owned: { stone: 2 } } }); E.G.screen = 'title'; E.press('shop'); },
  intro: () => { const E = __egg; E.start(4); },
  hud: () => { const E = __egg; E.start(30); E.press('go'); for (let i = 0; i < 60; i++) E.frame(1 / 60); const s = E.sim; if (s.stk) s.stk.m = 1; if (s.ally) { s.ally.avail = ['rooster', 'goose']; } E.G.fails[E.G.level.id] = 1; },
  'hud-boss': () => { const E = __egg; E.start(9); E.press('go'); },
  pause: () => { const E = __egg; E.start(4); E.press('go'); for (let i = 0; i < 20; i++) E.frame(1 / 60); E.press('pause'); },
  info: () => { const E = __egg; E.start(39); E.press('go'); for (let i = 0; i < 20; i++) E.frame(1 / 60); E.press('info'); },
  win: () => { const E = __egg; E.start(4); E.press('go'); E.frame(1 / 60); E.showResult('win', 3); },
  fail: () => { const E = __egg; E.start(4); E.press('go'); E.frame(1 / 60); E.showResult('fail'); },
  wonder: () => { const E = __egg; E.startDemo('plan'); },
};
const FRAMES = { win: 400, fail: 120, hud: 30 };

(async () => {
  const b = await chromium.launch();
  const report = [];
  for (const [name, w, h, safe] of PRESETS) {
    if (only && !only.includes(name)) continue;
    const p = await b.newPage({ viewport: { width: w, height: h } });
    const errors = [];
    p.on('pageerror', (e) => errors.push(String(e)));
    if (safe) await p.addInitScript((s) => { window.__eggSafe = s; }, safe);
    await p.goto(`http://localhost:${PORT}/`);
    await p.waitForFunction(() => window.__egg && __egg.G.screen === 'title', null, { timeout: 30000 });
    await p.evaluate(() => { // red overlay over the insets (the page's own safe rect: max of env(), __eggSafe and the floor)
      const d = document.createElement('div'); d.id = 'insets';
      d.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9';
      document.body.appendChild(d);
    });
    for (const [sc, fn] of Object.entries(SCREENS)) {
      const ov = await p.evaluate(([fn, n]) => {
        const E = __egg; (0, eval)('(' + fn + ')')();
        for (let i = 0; i < n; i++) E.frame(1 / 60);
        const s = window.__eggSafe || {}, d = document.getElementById('insets'), f = (k) => Math.max(8, s[k] || 0);
        d.innerHTML = `<div style="position:absolute;left:0;right:0;top:0;height:${f('t')}px;background:rgba(255,0,0,.35)"></div><div style="position:absolute;left:0;right:0;bottom:0;height:${f('b')}px;background:rgba(255,0,0,.35)"></div><div style="position:absolute;left:0;top:0;bottom:0;width:${f('l')}px;background:rgba(255,0,0,.35)"></div><div style="position:absolute;right:0;top:0;bottom:0;width:${f('r')}px;background:rgba(255,0,0,.35)"></div>`;
        return E.overlaps();
      }, [fn.toString(), FRAMES[sc] || 30]);
      await p.screenshot({ path: path.join(out, `${name}-${sc}.png`) });
      report.push(`${name} ${sc}: ${ov.length ? ov.map((o) => o.join(' x ')).join('; ') : 'ok'}`);
      await p.evaluate(() => { try { __egg.press('back'); } catch (_) {} __egg.G.screen = 'title'; });
    }
    if (name === '412x915') { // film the swipe: a finger drags world 1 -> world 2, 6 frames
      await p.evaluate(() => { const E = __egg; E.setSave({ unlocked: 20, stars: { 1: 3, 2: 2 } }); E.G.screen = 'title'; E.press('levels'); E.G.world = 0; for (let i = 0; i < 20; i++) E.frame(1 / 60); });
      const y = 560, steps = [380, 300, 220, 150];
      await p.mouse.move(390, y); await p.mouse.down();
      let k = 0;
      for (const x of steps) { await p.mouse.move(x, y, { steps: 3 }); await p.evaluate(() => __egg.frame(1 / 60)); await p.screenshot({ path: path.join(out, `swipe-${++k}.png`) }); }
      await p.mouse.up();
      for (const n of [4, 40]) { await p.evaluate((n) => { for (let i = 0; i < n; i++) __egg.frame(1 / 60); }, n); await p.screenshot({ path: path.join(out, `swipe-${++k}.png`) }); }
      report.push(`swipe: world now ${await p.evaluate(() => __egg.G.world)} (expected 1)`);
      // a tap on a tile still selects it (opens the level's intro)
      const r = await p.evaluate(() => { const E = __egg; E.G.world = 0; E.press('levels'); E.G.world = 0; E.frame(1 / 60); const t = E.uiRect('btn:lv:1'); return t; });
      if (r) { await p.mouse.click(r.x + r.w / 2, r.y + r.h / 2); await p.evaluate(() => __egg.frame(1 / 60)); report.push(`tap tile: screen ${await p.evaluate(() => __egg.G.screen)} (expected intro)`); }
    }
    for (const e of errors) report.push(`${name} PAGE ERROR: ${e}`);
    await p.close();
  }
  await b.close(); srv.close();
  console.log(report.join('\n'));
})();
