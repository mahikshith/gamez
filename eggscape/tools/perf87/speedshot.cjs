// Runs the in-game speed test headless and screenshots the results: node tools/perf87/speedshot.cjs [out.png] [w h dpr]
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '../../dist/dev');
const [out = '/tmp/speedtest.png', W = 360, H = 640, D = 3] = process.argv.slice(2);
const PORT = 8600 + Math.floor(Math.random() * 300);
const srv = http.createServer((q, r) => { fs.readFile(path.join(dir, 'index.html'), (e, d) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(d); }); }).listen(PORT);
(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: +D, hasTouch: true });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__egg && __egg.G.screen === 'title', null, { timeout: 90000 });
  const before = await page.evaluate(() => { const E = __egg; E.save.unlocked = 50; E.press('settings'); return JSON.stringify({ gfx: E.save.gfx, fps: E.save.fps, step: E.save.gfxStep, p: E.perf.PERF.step, cap: E.perf.PERF.dprCap }); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: out.replace('.png', '-settings.png') });
  await page.evaluate(() => __egg.press('set:speed'));
  await page.waitForTimeout(6000); await page.screenshot({ path: out.replace('.png', '-running.png') });
  await page.waitForTimeout(12000);
  await page.screenshot({ path: out });
  const after = await page.evaluate(() => { const E = __egg; return JSON.stringify({ gfx: E.save.gfx, fps: E.save.fps, step: E.save.gfxStep, p: E.perf.PERF.step, cap: E.perf.PERF.dprCap }); });
  // tap Close
  // tap "Use best setting" (left button, under the table): scan down until the test closes
  for (let y = Math.round(+H * 0.55); y < +H; y += 8) { await page.mouse.click(+W * 0.25, y); await page.waitForTimeout(80); if (await page.evaluate(() => !window.__eggSpeed.active)) break; }
  await page.waitForTimeout(400);
  const closed = await page.evaluate(() => JSON.stringify({ screen: __egg.G.screen, settings: __egg.G.settingsOpen, w: document.getElementById('game').width, gfx: __egg.save.gfx, gfxStep: __egg.save.gfxStep, p: __egg.perf.PERF.step, cap: __egg.perf.PERF.dprCap }));
  await page.screenshot({ path: out.replace('.png', '-closed.png') });
  console.log('before', before, '\nafter ', after, '\nclosed', closed, '\nerrors', errs.slice(0, 5));
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
