// p87 before/after pictures: the same play frame (seeded Math.random, the game's own rAF loop stopped, fixed dt), and
// close-ups of single creatures drawn through the dev art hooks, so two builds can be compared pixel for pixel.
// Usage: node tools/perf87/shots.cjs <index.html> <outdir> [ids=13,20,31,35,40,45,50] [tier=high] [secs=20]
// then: python3 tools/perf87/diff.py <dirA> <dirB>
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const [HTML, OUT, ids = '13,20,27,31,35,40,45,50', tier = 'high', secs = '20'] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8300 + Math.floor(Math.random() * 300);
const srv = http.createServer((q, r) => { fs.readFile(HTML, (e, d) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(d); }); }).listen(PORT);
const save = (name, url) => fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const id of ids.split(',').map(Number)) {
    const page = await b.newPage({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2.75, hasTouch: true });
    await page.addInitScript(() => { let s = 12345; window.__seed = (n) => { s = n; }; Math.random = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); let stop = false; const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (f) => (stop ? 0 : raf(f)); window.__stopLoop = () => { stop = true; }; window.__ft = 1000; performance.now = () => window.__ft; const D0 = 1.7e12; Date.now = () => D0 + window.__ft; });
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForFunction(() => window.__egg && __egg.G.screen === 'title', null, { timeout: 60000 });
    const url = await page.evaluate(({ id, tier, secs }) => { __stopLoop(); __seed(4242); window.__ft = 5000; __egg.G.t = 100; const E = __egg, s = E.save; s.unlocked = 50; s.intro = new Proxy({}, { get: () => 1 }); s.seen.pickN = 5; s.seen = new Proxy(s.seen, { get: (o, k) => (k in o ? o[k] : 5) });
      s.gfx = tier; E.perf.applySettings(); const i = E.LEVELS.findIndex((l) => l.id === id); E.start(i); E.press('go'); E.G.screen = 'play';
      for (let f = 0; f < secs * 60; f++) { window.__ft += 1000 / 60; E.frame(1 / 60); }
      return document.querySelector('canvas').toDataURL('image/png'); }, { id, tier, secs: +secs });
    save(`L${id}-${tier}`, url);
    await page.close();
  }
  // close-ups through the art hooks: each drawn twice (a baked part bakes on the second sighting), the second kept
  const page = await b.newPage({ viewport: { width: 600, height: 400 }, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__egg && __egg.G.screen, null, { timeout: 60000 });
  const shots = await page.evaluate(() => {
    const E = __egg, out = {};
    const shoot = (name, w, h, draw) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d');
      for (let k = 0; k < 3; k++) { c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#7fb0c8'; c.fillRect(0, 0, w, h); draw(c); }
      out[name] = cv.toDataURL('image/png'); };
    const ids = ['freeze', 'thunder', 'bomb', 'decoy', 'tornado', 'glue', 'phoenix', 'tock', 'bubble'];
    for (const [sc, rot] of [[1, 0], [2.75, 0], [2.75, 0.6]]) shoot(`chicks-x${sc}-r${rot}`, Math.ceil(ids.length * 70 * sc), Math.ceil(110 * sc), (c) => { ids.forEach((id, i) => { c.setTransform(sc, 0, 0, sc, 0, 0); c.translate(35 + i * 70, 60); c.rotate(rot); E.strikeArt.drawStrikeChick(c, id, 0, 0, 40, 1.234, {}); }); });
    shoot('strike-buttons', 9 * 150, 160, (c) => { ids.forEach((id, i) => { c.setTransform(1, 0, 0, 1, 0, 0); E.strikeArt.drawStrikeButton(c, 10 + i * 150, 10, 130, { id, m: i % 2 ? 1 : 0.5, busy: false, t: 2.2, fullT: 0, pressed: false, calm: false }); }); });
    shoot('octopus', 900, 300, (c) => { [0, 1.1, 2.3].forEach((t, i) => { c.setTransform(1, 0, 0, 1, 0, 0); E.art.drawOctopus(c, 150 + i * 300, 130, 80, t, { A: E.art.octoAnim().A, rot: -Math.PI / 2 + i * 0.3 }); }); });
    const kinds = ['weasel', 'rats', 'boss:ratking', 'boss:kingcrab', 'boss:owl', 'octopus'];
    for (const t of [0.4, 1.7]) shoot('portraits-t' + t, kinds.length * 200, 200, (c) => { kinds.forEach((k, i) => { c.setTransform(1, 0, 0, 1, 0, 0); E.villainArt(c, k, 100 + i * 200, 100, 170, t); }); });
    return out;
  });
  for (const [k, v] of Object.entries(shots)) save(k, v);
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
