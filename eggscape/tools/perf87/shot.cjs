// Deterministic play screenshot (main loop held, 180 frames of __egg.frame): node tools/perf87/shot.cjs out.png [id] [gfx]
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '../../dist/dev');
const [out, id = 20, gfx = 'high'] = process.argv.slice(2);
const PORT = 8600 + Math.floor(Math.random() * 300);
const srv = http.createServer((q, r) => { fs.readFile(path.join(dir, 'index.html'), (e, d) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(d); }); }).listen(PORT);
(async () => {
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2, hasTouch: true });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__egg && __egg.G.screen === 'title', null, { timeout: 90000 });
  await page.evaluate(([id, gfx]) => { const E = __egg; const s = E.save; s.unlocked = 50; s.intro = new Proxy({}, { get: () => 1 }); s.seen.pickN = 5; s.gfx = gfx; E.perf.applySettings(); const i = E.LEVELS.findIndex((l) => l.id === +id); E.G.paused = true; E.start(i); E.press('go'); try { E.press('stk:gotit'); E.press('gotit'); } catch (_) {} for (let f = 0; f < 180; f++) E.frame(1 / 60); }, [id, gfx]);
  await page.waitForTimeout(300);
  const data = await page.evaluate(() => document.getElementById('game').toDataURL('image/png'));
  fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
  await b.close(); srv.close();
})();
