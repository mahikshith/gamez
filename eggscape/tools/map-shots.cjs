// Level-map QA: shots of the scrolling world map at phone and desktop sizes. Usage: node tools/map-shots.cjs <dev dir> <outDir> [scrolls...]
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dir = path.resolve(process.argv[2] || 'dist/dev'), out = path.resolve(process.argv[3] || 'qa/map');
fs.mkdirSync(out, { recursive: true });
const PORT = +process.env.QA_PORT || 8793;
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; fs.readFile(path.join(dir, u === '/' ? 'index.html' : u), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': u.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); }); }).listen(PORT);
const SIZES = (process.env.SIZES || '390x844').split(',').map((s) => s.split('x').map(Number));
const WORLDS = (process.env.WORLDS || '0').split(',').map(Number);
const UNL = +process.env.UNL || 13;
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of SIZES) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    p.on('pageerror', (e) => console.log('ERR', String(e)));
    await p.goto(`http://localhost:${PORT}/`);
    await p.waitForFunction(() => window.__egg && __egg.G.screen === 'title', null, { timeout: 30000 });
    if (process.env.TITLE) { await p.evaluate(() => { for (let i = 0; i < 120; i++) __egg.frame(1 / 60); }); await p.screenshot({ path: `${out}/title-${w}x${h}.png` }); }
    await p.evaluate((n) => { const E = __egg; const st = {}; for (let i = 1; i < n; i++) st[i] = 1 + (i % 3); E.setSave({ unlocked: n, stars: st, wallet: { coins: 300 } }); E.G.screen = 'title'; E.press('levels'); }, UNL);
    for (const wi of WORLDS) {
      await p.evaluate((wi) => { const E = __egg; if (E.mapJump) E.mapJump(wi); else E.G.world = wi; for (let i = 0; i < 90; i++) E.frame(1 / 60); }, wi);
      await p.screenshot({ path: `${out}/map-${w}x${h}-w${wi}.png` });
    }
    const ov = await p.evaluate(() => __egg.overlaps && __egg.overlaps());
    if (ov && ov.length) console.log(w + 'x' + h, 'overlaps', JSON.stringify(ov).slice(0, 400));
    await p.close();
  }
  await b.close(); srv.close();
})();
