// p87: canvases created while playing (a cache that keeps baking is worse than none). node tools/perf87/churn.cjs [html] [ids] [tier]
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const [HTML = path.join(__dirname, '../../dist/dev/index.html'), ids = '13,20,31,40,45,50', tier = 'high'] = process.argv.slice(2);
const PORT = 8100 + Math.floor(Math.random() * 300);
const srv = http.createServer((q, r) => { fs.readFile(HTML, (e, d) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(d); }); }).listen(PORT);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await b.newPage({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2.75 });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__egg && __egg.G.screen === 'title', null, { timeout: 60000 });
  for (const id of ids.split(',').map(Number)) {
    const r = await page.evaluate(({ id, tier }) => { const E = __egg, s = E.save; s.unlocked = 50; s.intro = new Proxy({}, { get: () => 1 }); s.seen.pickN = 5; s.gfx = tier; E.perf.applySettings();
      const i = E.LEVELS.findIndex((l) => l.id === id); E.start(i); E.press('go'); E.G.screen = 'play';
      const ce = document.createElement; let n = [0, 0, 0]; let ph = 0; document.createElement = function (t, ...a) { if (String(t).toLowerCase() === 'canvas') n[ph]++; return ce.call(this, t, ...a); };
      for (let f = 0; f < 1800; f++) { ph = f < 300 ? 0 : f < 900 ? 1 : 2; E.frame(1 / 60); }
      document.createElement = ce; return { first5s: n[0], s5to15: n[1], s15to30: n[2], screen: E.G.screen }; }, { id, tier });
    console.log('L' + id, tier, 'canvases created', JSON.stringify(r));
  }
  await b.close(); srv.close();
})();
