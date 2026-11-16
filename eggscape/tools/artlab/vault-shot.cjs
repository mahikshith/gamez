// Captures a level's vault from the dev build at high resolution (icon / store art source).
// node tools/artlab/vault-shot.cjs <dev dir> <out.png> <levelIndex> <seconds>
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const [, , dirA, out, li = '9', secs = '3'] = process.argv; const dir = path.resolve(dirA || 'dist/dev'); const PORT = 8795;
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; fs.readFile(path.join(dir, u === '/' ? 'index.html' : u), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': u.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); }); }).listen(PORT);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3 });
  p.on('pageerror', (e) => console.log('ERR', String(e)));
  await p.goto(`http://localhost:${PORT}/`);
  await p.waitForFunction(() => window.__egg && __egg.G.screen === 'title', null, { timeout: 30000 });
  await p.evaluate(([li, secs]) => { const E = __egg; E.start(+li); E.press('go'); const n = Math.round(+secs * 60); for (let i = 0; i < n; i++) E.frame(1 / 60); E.G.toast = null; E.G.toasts.length = 0; E.frame(1 / 60); }, [li, secs]);
  await p.screenshot({ path: out }); await b.close(); srv.close();
})();
