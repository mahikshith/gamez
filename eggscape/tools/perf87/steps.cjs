// Physics steps per drawn frame during real-time play (rAF), and the frame gaps: node tools/perf87/steps.cjs [id] [secs] [gfx]
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '../../dist/dev');
const [id = 20, secs = 8, gfx = 'low'] = process.argv.slice(2);
const PORT = 8600 + Math.floor(Math.random() * 300);
const srv = http.createServer((q, r) => { fs.readFile(path.join(dir, 'index.html'), (e, d) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(d); }); }).listen(PORT);
(async () => {
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 1, hasTouch: true });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__egg && __egg.G.screen === 'title', null, { timeout: 90000 });
  await page.evaluate(([id, gfx]) => { const E = __egg; const s = E.save; s.unlocked = 50; s.intro = new Proxy({}, { get: () => 1 }); s.seen.pickN = 5; s.gfx = gfx; E.perf.applySettings(); const i = E.LEVELS.findIndex((l) => l.id === +id); E.start(i); E.press('go'); try { E.press('stk:gotit'); E.press('gotit'); } catch (_) {} }, [id, gfx]);
  await page.waitForTimeout(2000);
  const r = await page.evaluate((secs) => new Promise((res) => {
    const sim = __egg.G.sim, st = sim.step.bind(sim); let n = 0; sim.step = () => { n++; return st(); };
    const hist = {}, gaps = []; let last = 0, t0 = 0;
    const f = (t) => { if (last) { gaps.push(t - last); } last = t; if (!t0) t0 = t; hist[n] = (hist[n] || 0) + 1; n = 0; if (t - t0 < secs * 1000) requestAnimationFrame(f); else res({ hist, p50: gaps.sort((a, b) => a - b)[gaps.length >> 1], frames: gaps.length }); };
    requestAnimationFrame(f);
  }), +secs);
  console.log(`L${id} ${gfx}:`, JSON.stringify(r));
  await b.close(); srv.close();
})();
