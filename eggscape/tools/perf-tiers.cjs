// Speed check per graphics tier (2026-11-19 speed pass). Needs a dev build (node tools/build.mjs --dev).
// Usage: node tools/perf-tiers.cjs [ids=1,27,50] [tiers=high,medium,low] [throttle=4]
// For each tier and level: "flushMs" = one frame drawn and flushed (getImageData forces the canvas to finish), then
// "fps" and "world" (world seconds per real second) for 5 s of real time with Chrome's CPU slowed `throttle` times,
// a stand-in for a 2-3 year old phone. Headless Chromium draws in software, so absolute numbers are pessimistic; the
// ratios between tiers are what to watch. World < 0.95 means the game is running in slow motion.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '../dist/dev');
const [ids = '1,27,50', tiers = 'high,medium,low', thr = '4'] = process.argv.slice(2);
process.env.IDS = ids; process.env.TIERS = tiers; process.env.THROTTLE = thr;
const PORT = 8900 + Math.floor(Math.random() * 90);
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; fs.readFile(path.join(dir, u === '/' ? 'index.html' : u), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': 'text/html' }); r.end(d); }); }).listen(PORT);
const run =
// per graphics tier: flushed frame cost (probe) and real-time fps / world speed under CPU throttle
  async (page) => {
  const ids = (process.env.IDS || '1,27,50').split(',').map(Number), tiers = (process.env.TIERS || 'high,medium,low').split(',');
  const cdp = await page.context().newCDPSession(page);
  for (const tier of tiers) {
    await page.evaluate((tier) => { const E = __egg; E.save.gfx = tier; E.save.fps = 'auto'; E.perf.applySettings(); }, tier);
    for (const id of ids) {
      const p = await page.evaluate((id) => { const E = __egg, G = E.G, i = E.LEVELS.findIndex((l) => l.id === id); E.start(i); E.press('go'); G.screen = 'play'; for (let f = 0; f < 120; f++) E.frame(1 / 60);
        const cv = document.querySelector('canvas'), c = cv.getContext('2d'); let tot = 0; const N = 40; for (let f = 0; f < N; f++) { const t0 = performance.now(); E.frame(1 / 60); c.getImageData(0, 0, 1, 1); tot += performance.now() - t0; } return { w: cv.width, flushMs: +(tot / N).toFixed(1) }; }, id);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: +(process.env.THROTTLE || 4) });
      await page.waitForTimeout(800);
      const r = await page.evaluate(() => new Promise((res) => { const E = __egg; const iv = []; let last = 0, t0 = performance.now(); const simT0 = E.sim.t; let rr = 7; const rnd = () => ((rr = (rr * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); let ring = 0, until = 0, dir = 1;
        function f(now) { if (last) iv.push(now - last); last = now; const s = E.sim; if (s && s.rings) { if (s.t >= until) { ring = Math.floor(rnd() * s.rings.length); dir = rnd() < 0.5 ? -1 : 1; until = s.t + 0.3 + rnd() * 1.5; } const R = s.rings[ring]; if (R && !R.motor) R.target = R.body.getAngle() + 0.5 * dir; }
          if (now - t0 < 5000) requestAnimationFrame(f); else { const avg = iv.reduce((a, b) => a + b, 0) / iv.length; res({ fps: +(1000 / avg).toFixed(1), world: +((E.sim.t - simT0) / ((now - t0) / 1000)).toFixed(2), screen: E.G.screen }); } }
        requestAnimationFrame(f); }));
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      console.log(tier.padEnd(7), 'L' + id, JSON.stringify({ ...p, ...r }));
    }
  }
};
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await b.newPage({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2.75, hasTouch: true });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__egg && __egg.G.screen, null, { timeout: 60000 });
  await run(page);
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
