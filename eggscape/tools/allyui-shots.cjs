// Ally button QA (v3.5): HUD states (ad / free / hidden), the choice, a call in action, plus a headless run of each ally.
// Usage: node tools/allyui-shots.cjs [dist/dev] [outDir] [--port 9081]
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const argv = process.argv.slice(2), pi = argv.indexOf('--port'), PORT = pi >= 0 ? +argv[pi + 1] : 9081;
const args = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--port');
const dir = path.resolve(args[0] || 'dist/dev'), out = path.resolve(args[1] || 'qa/allyui');
fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => {
  const u = q.url.split('?')[0], f = path.join(dir, u === '/' ? 'index.html' : u);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); });
}).listen(PORT);
(async () => {
  const b = await chromium.launch(); let bad = 0;
  for (const [w, h] of [[390, 844], [844, 390]]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
    await p.goto(`http://localhost:${PORT}/`); await p.waitForTimeout(800);
    const fr = (n) => p.evaluate((n) => { for (let i = 0; i < n; i++) __egg.frame(1 / 60); return __egg.overlaps(); }, n);
    const shot = async (n) => { await p.screenshot({ path: path.join(out, `${w}x${h}-${n}.png`) }); };
    const pt = (id) => p.evaluate((id) => { const b = __egg.G.ui ? 0 : 0; return window.__egg.btn ? __egg.btn(id) : null; }, id);
    const start = (mode, i = 6) => p.evaluate(([m, i]) => { const E = __egg; E.setSave({ mode: m }); E.G.fails = {}; E.start(i); E.press('go'); if (document) E.press('gotit'); }, [mode, i]);
    await start('medium'); await fr(60); await shot('1-ad');
    await p.evaluate(() => { __egg.G.fails[__egg.G.level.id] = 1; }); await fr(5); await shot('2-free');
    await p.evaluate(() => __egg.press('ally')); await fr(10); let o = await fr(5); await shot('3-choice'); if (o.length) { bad++; console.log(w, 'overlap', JSON.stringify(o)); }
    await p.evaluate(() => __egg.press('ally:rooster')); await fr(110); await shot('4-rooster'); await fr(300); await shot('5-used-hidden');
    await start('easy'); await fr(60); await shot('6-easy'); await p.evaluate(() => __egg.press('ally')); await fr(5);
    await p.evaluate(() => __egg.press('ally:goose')); await fr(150); await shot('7-goose');
    // a real call on the studio level (snake + boss): rooster, then goose
    for (const k of ['rooster', 'goose']) { await p.evaluate((k) => { const E = __egg; E.setSave({ mode: 'easy' }); E.startAllyDemo(k); E.press('go'); E.press('gotit'); }, k); await fr(120); await shot(`8-${k}-pick`); await p.evaluate(() => __egg.press('ally')); await fr(3); await p.evaluate((k) => __egg.press('ally:' + k), k); await fr(k === 'rooster' ? 130 : 170); await shot(`9-${k}-call`); }
    // ad path: rewarded stub resolves true in the dev build?
    await start('hard'); await fr(30);
    const r = await p.evaluate(async () => { await __egg.press('ally'); return { open: __egg.G.allyOpen, ad: __egg.G.allyAd }; });
    console.log(w, 'ad press', JSON.stringify(r));
    // headless: every ally on a few levels; a mid-action snapshot must replay identically
    const res = await p.evaluate(() => { const E = __egg, rs = []; for (const k of ['rooster', 'goose']) for (const i of [-2]) { E.startAllyDemo(k); E.press('go'); E.press('gotit'); for (let j = 0; j < 200; j++) E.frame(1 / 60); const ok = E.G.sim.callAlly(k); for (let j = 0; j < 100; j++) E.frame(1 / 60); const s = E.G.sim, c = s.constructor.fromState(s.level, s.fullState(), s.opts); for (let j = 0; j < 600; j++) { s.step(); c.step(); } const same = JSON.stringify(s.fullState().ally) === JSON.stringify(c.fullState().ally) && !!s.ally.used[k]; rs.push(`${k}@${i}:${ok}:${same}`); } return rs; });
    console.log(w, res.join(' '));
    if (errs.length) { bad++; console.log(w, 'ERRORS', errs); }
    await p.close();
  }
  await b.close(); srv.close(); process.exit(bad ? 1 : 0);
})();
