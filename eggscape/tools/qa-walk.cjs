// A player who only ever taps the big button: every level card must reach play (2026-11-24: level 13 could not be
// opened, PLAY sent the player back to the Chicks tab until a tile was tapped). node tools/qa-walk.cjs [distDir]
// env SIZE=384x853 FROM=2 TO=50 [MODE=easy] [CRUISE=1]. Needs a dev build. Exit code 1 if any level is stuck.
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const dist = process.argv[2] || path.join(__dirname, '../dist/dev');
(async () => {
  const srv = http.createServer((rq, r) => { fs.readFile(path.join(dist, 'index.html'), (e, d) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(d); }); }).listen(0);
  const b = await chromium.launch();
  const [W, H] = (process.env.SIZE || '384x853').split('x').map(Number);
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${srv.address().port}/?shop=app&rec=0`);
  await p.waitForFunction(() => window.__egg && ['title', 'levels', 'play'].includes(__egg.G.screen), null, { timeout: 60000 });
  const CTA = ['stk:gotit', 'gotit', 'inext', 'go'];
  let bad = 0;
  for (let id = +(process.env.FROM || 2); id <= +(process.env.TO || 50); id++) {
    // MODE=easy|medium|hard plays the cards in that mode; CRUISE=1 reads as a cruising player (the Pacer's dare chip on the cards)
    await p.evaluate(([id, mode, cruise]) => { const E = __egg, s = E.save; s.unlocked = Math.max(s.unlocked || 1, id); s.seen = { ...(s.seen || {}), boot1: 1 }; if (mode) s.mode = mode; if (cruise) { s.stars = { ...(s.stars || {}), 3: 3 }; s.eng = { ...(s.eng || {}), pac: { ft3: 3 } }; } E.start(id - 1); }, [id, process.env.MODE || '', !!process.env.CRUISE]);
    await p.waitForTimeout(900);
    const seq = []; let ok = false;
    for (let n = 0; n < 9; n++) {
      const s = await p.evaluate(() => ({ screen: __egg.G.screen, stk: __egg.sim && __egg.sim.stk && __egg.sim.stk.id, any: __egg.sim && __egg.sim.stk && __egg.sim.stk.any, buttons: __egg.ui.buttons.map((q) => [q.id, q.x, q.y, q.w, q.h]) }));
      if (s.screen === 'play') { ok = true; seq.push('PLAY' + (s.any ? ' chick=' + s.stk : '')); break; }
      const q = CTA.map((c) => s.buttons.find((x) => x[0] === c)).find(Boolean);
      if (!q) { seq.push('?? ' + s.screen + ' [' + s.buttons.map((x) => x[0]).join(' ') + ']'); await p.waitForTimeout(600); continue; }
      seq.push(q[0]); await p.touchscreen.tap(q[1] + q[3] / 2, q[2] + q[4] / 2); await p.waitForTimeout(650);
    }
    if (!ok) bad++;
    console.log((ok ? 'ok  ' : 'STUCK ') + 'L' + id + ': ' + seq.join(' > '));
  }
  console.log('stuck levels:', bad, 'errors:', errs.slice(0, 3));
  await b.close(); srv.close();
  process.exit(bad ? 1 : 0);
})();
