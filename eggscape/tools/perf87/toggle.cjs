// p87: the same page, the same frames, the baked pictures on and off in turn (a build where castkit's bake() checks
// window.__noBake). node tools/perf87/toggle.cjs <toggle.html> [ids] [tier]   (GPU=1 for GPU raster flags)
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs');
const [HTML, ids = '13,40,50', tier = 'high'] = process.argv.slice(2);
const PORT = 8200 + Math.floor(Math.random() * 300);
const srv = http.createServer((q, r) => { fs.readFile(HTML, (e, d) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(d); }); }).listen(PORT);
(async () => {
  const args = process.env.GPU ? ['--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--enable-accelerated-2d-canvas', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'];
  const b = await chromium.launch({ args });
  const page = await b.newPage({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2.75 });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__egg && __egg.G.screen === 'title', null, { timeout: 60000 });
  for (const id of ids.split(',').map(Number)) {
    const r = await page.evaluate(({ id, tier }) => { const E = __egg, s = E.save; s.unlocked = 50; s.intro = new Proxy({}, { get: () => 1 }); s.seen.pickN = 5; s.gfx = tier; E.perf.applySettings();
      const i = E.LEVELS.findIndex((l) => l.id === id); E.start(i); E.press('go'); E.G.screen = 'play'; E.step(20); for (let f = 0; f < 40; f++) E.frame(1 / 60);
      const c = document.querySelector('canvas').getContext('2d'); const T = { on: [], off: [] };
      for (let k = 0; k < 16; k++) { const m = k % 2 ? 'off' : 'on'; window.__noBake = m === 'off'; E.frame(0); c.getImageData(0, 0, 1, 1); for (let f = 0; f < 8; f++) { const t0 = performance.now(); E.frame(f ? 0 : 1 / 60); c.getImageData(0, 0, 1, 1); T[m].push(performance.now() - t0); } }
      window.__noBake = false; const med = (a) => { a.sort((x, y) => x - y); return +a[a.length >> 1].toFixed(1); }; return { on: med(T.on), off: med(T.off) }; }, { id, tier });
    console.log(`L${id} ${tier} ${process.env.GPU ? 'GPU' : 'sw'} frame+flush median ms: baked ${r.on}  live ${r.off}`);
  }
  await b.close(); srv.close();
})();
