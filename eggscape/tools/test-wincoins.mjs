// node tools/test-wincoins.mjs : the coins of a boss win (0.8.19, mykee: "when the first boss or a couple of bosses were
// beaten, the coin animations do not show properly"). Drives the dev build (dist/dev) through REAL wins of the boss
// levels 6, 12 and 18, the first time each is beaten (the boss treasure and the other reward reveals fire), once left
// alone and once with a player tapping all the way through. Every frame it reads the purse the page shows, and checks:
//   - the count never runs ahead: until the win's own coins fly it shows the purse before the win (plus the treasure's
//     coins once those have flown), and it never goes down;
//   - the treasure's coins fly to the purse (the landing ran with coins), the win's coins fly from the pill (a roll
//     with a source up to the wallet), also when the player taps through;
//   - no question or offer opens over the page while the coins are still to come;
//   - at the end the shown total, the wallet, and "before + treasure + this win's coins" are the same number.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), page = path.join(root, 'dist/dev/index.html');
if (!fs.existsSync(page)) { console.log('FAIL no dev build: node tools/build.mjs --target web --dev'); process.exit(1); }
const srv = http.createServer((q, r) => fs.readFile(page, (e, d) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(d); })).listen(0);
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const b = await chromium.launch();
for (const lv of [6, 12, 18]) for (const taps of [false, true]) {
  const p = await b.newPage({ viewport: { width: 450, height: 1000 }, hasTouch: true });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${srv.address().port}/?shop=app`);
  await p.waitForFunction(() => window.__egg && ['title', 'levels', 'play'].includes(__egg.G.screen), null, { timeout: 60000 });
  await p.evaluate((lv) => {
    const E = __egg; window.requestAnimationFrame = () => 0; window.F = (k) => { for (let i = 0; i < k; i++) E.frame(1 / 60); };
    const st = {}; for (let i = 1; i < lv; i++) st[i] = 3;
    E.setSave({ unlocked: lv, stars: st, wallet: { coins: 230 } }); const s = E.save; for (let i = 1; i <= 60; i++) s.intro[i] = 1; s.strikeSeen = new Proxy({}, { get: () => 1 });
    E.start(lv - 1); F(20);
    for (let k = 0; k < 4 && E.G.screen === 'intro'; k++) { E.press(k % 2 ? 'inext' : 'go'); F(3); } if (E.G.screen === 'intro') E.G.screen = 'play'; F(2);
    E.step(1);
    window.T = { c0: E.save.wallet.coins, ahead: 0, down: 0, last: 0, flew: 0, landCoins: 0, modal: 0, frames: 0, max: 0 };
    for (const e of E.G.sim.aliveEggs()) E.G.sim.saveEgg(e); // every egg home: the game's own win follows
    window.RUN = (n) => { for (let i = 0; i < n; i++) { F(1); const G = E.G, r = G.result; if (G.screen !== 'win' || !r) continue;
      const sh = E.purse.shown(), P = E.purse.state, Ls = E.land.state, tr = r.treasure ? r.treasure.coins : 0, w = E.save.wallet.coins; T.frames++;
      if (Ls && Ls.coins > 0) T.landCoins = Math.max(T.landCoins, Ls.coins);
      const flying = !!(P && P.from != null && P.to === w);
      if (flying && P.src) T.flew = 1;
      if (!flying && !r.purseGo && sh > r.purse0 + tr) T.ahead++; // the win's own coins counted before they flew
      if (sh < T.last) T.down++;
      T.last = sh; T.max = Math.max(T.max, sh);
      if ((G.remAsk || G.offer || G.nudge) && (!r.purseGo || E.purse.active())) T.modal++;
    } return E.G.screen; };
  }, lv);
  let n = 0;
  for (let k = 0; k < 60; k++) { const sc = await p.evaluate(() => RUN(30)); if (taps && sc === 'win') { await p.touchscreen.tap(225, 420); n++; } }
  const R = await p.evaluate(() => { const E = __egg, r = E.G.result; return { ...T, shown: E.purse.shown(), wallet: E.save.wallet.coins, coins: r && r.coins, tr: r && r.treasure ? r.treasure.coins : 0, rv: r && r.rv ? r.rv.list.map((x) => x.kind).join('+') : '' }; });
  const tag = `L${lv} first win${taps ? `, ${n} taps` : ''} (${R.rv || 'no reveal'}): `;
  ok(R.frames > 100 && errs.length === 0, tag + `the win page ran (${R.frames} frames, ${errs.length} errors)`);
  ok(R.wallet === R.c0 + R.coins + R.tr && R.shown === R.wallet, tag + `purse ${R.c0} + treasure ${R.tr} + win ${R.coins} = ${R.wallet}, shown ${R.shown}`);
  ok(R.ahead === 0 && R.down === 0, tag + `the count never ran ahead of the coins (${R.ahead} frames) nor went down (${R.down})`);
  ok(R.flew === 1, tag + 'the win\'s coins flew from the pill into the purse');
  ok(R.tr === 0 || R.landCoins > 0, tag + `the treasure's coins flew (${R.landCoins} coins)`);
  ok(R.modal === 0, tag + `nothing opened over the page before the coins were in (${R.modal} frames)`);
  await p.close();
}
await b.close(); srv.close();
console.log(fails ? `${fails} FAILED` : 'all win coin checks passed');
process.exit(fails ? 1 : 0);
