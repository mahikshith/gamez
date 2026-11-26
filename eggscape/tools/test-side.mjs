// node tools/test-side.mjs : the side quests' forks on the map (0.8.18, mykee: "show a split path towards that level, and
// it could merge back. If it is unlocked they could tap on it and the hen will move there"). Drives the dev build
// (dist/dev, `node tools/build.mjs --target web --dev` first):
//   layout, at four screen sizes: every world's quest has a fork that leaves the road at its branch stop and joins it
//     again one or two stops on, never crosses or runs along the road between, stays on the screen, its door off the
//     road and clear of every other stop;
//   play, on the phone: shut = no tap; open = the door and the fork take a tap; the hen WALKS (no jump between two frames)
//     from her nest to the door and the vault's card opens; back from the vault she walks home to her nest; the road's
//     own stops still take their taps.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // (as the .cjs QA tools: found through NODE_PATH)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), page = path.join(root, 'dist/dev/index.html');
if (!fs.existsSync(page)) { console.log('FAIL no dev build: node tools/build.mjs --target web --dev'); process.exit(1); }
const srv = http.createServer((q, r) => fs.readFile(page, (e, d) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(d); })).listen(0);
const url = `http://localhost:${srv.address().port}/?shop=app`;
let fails = 0, n = 0;
const ok = (c, m) => { n++; console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

const b = await chromium.launch();
const open = async (W, H) => {
  const p = await b.newPage({ viewport: { width: W, height: H } });
  p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  await p.goto(url);
  await p.waitForFunction(() => window.__egg && ['title', 'levels', 'play'].includes(__egg.G.screen), null, { timeout: 60000 });
  await p.evaluate(() => {
    const E = __egg; window.requestAnimationFrame = () => 0; window.F = (k) => { for (let i = 0; i < k; i++) E.frame(1 / 60); };
    // a player whose road stands at `top` (levels 1..top won), every world open, every side quest already shown
    window.SAVE = (top) => { const stars = {}; for (let i = 1; i <= top; i++) stars[i] = 2; const seen = {}; E.sidePlan().forEach((q) => { seen[q.key] = 1; }); E.setSave({ unlocked: top + 1, stars, age: '13+', gates: Object.fromEntries([...Array(10).keys()].map((k) => [k, 1])), wonder: {}, side: { seen } }); const s = E.save; for (let i = 1; i <= 60; i++) s.intro[i] = 1; E.G.toasts = []; E.G.toast = null; E.G.offer = null; E.G.nudge = null; E.G.remAsk = null; E.G.leaveAsk = null; };
    window.MAP = (w) => { E.G.screen = 'title'; E.G.screenT = 5; E.press('levels'); F(3); E.sideFocus(w); F(40); };
  });
  return p;
};

// ---- layout at four sizes
for (const [W, H] of [[450, 1000], [384, 853], [360, 640], [853, 384]]) {
  const p = await open(W, H);
  const geo = await p.evaluate(() => {
    MAP(0);
    const L = __egg.G.mapL, A = L.A, fw = L.roadW * 0.56, out = [];
    const roadD = (q) => { let m = 1e9; for (let y = q.y - 80 * L.u; y <= q.y + 80 * L.u; y += 2) m = Math.min(m, Math.hypot(L.pathX(y) - q.x, y - q.y)); return m; };
    for (const q of L._side) {
      const P = q.fork.A.concat(q.fork.B.slice(1)), S = q.fork.S, E = q.fork.E, st = L.stops[q.i], en = L.stops[q.j];
      let cross = 0, off = 0, stopHit = -1;
      for (const pt of P) {
        if (Math.hypot(pt.x - q.x, pt.y - q.y) < q.R) continue;
        if (pt.x - fw / 2 < A.x - 1 || pt.x + fw / 2 > A.x1 + 1) off++;
        if (Math.min(Math.hypot(pt.x - S.x, pt.y - S.y), Math.hypot(pt.x - E.x, pt.y - E.y)) > L.stopR * 1.5 && roadD(pt) < L.roadW * 0.5 + fw * 0.5) cross++;
        L.stops.forEach((s2, k) => { if (k !== q.i && k !== q.j && Math.hypot(pt.x - s2.x, pt.y - s2.y) < L.stopR * 1.1) stopHit = k; });
      }
      const doorRoad = roadD({ x: q.x, y: q.y }) < L.roadW * 0.5 + q.R;
      const doorStop = L.stops.findIndex((s2) => Math.hypot(q.x - s2.x, q.y - s2.y) < L.stopR + q.R);
      out.push({ w: q.w, i: q.i, j: q.j, sOk: Math.hypot(S.x - st.x, S.y - st.y) < 1, eOk: en && Math.hypot(E.x - en.x, E.y - en.y) < 1 && en.w === q.w, la: Math.round(q.fork.la), lb: Math.round(q.fork.lb), cross, off, stopHit, doorRoad, doorStop });
    }
    return out;
  });
  ok(geo.length === 10, `${W}x${H}: ten side quests with a fork (${geo.length})`);
  for (const g of geo) ok(g.sOk && g.eOk && (g.j === g.i + 1 || g.j === g.i + 2) && !g.cross && !g.off && g.stopHit < 0 && !g.doorRoad && g.doorStop < 0 && g.la > 20 && g.lb > 20,
    `${W}x${H} world ${g.w + 1}: leaves at stop ${g.i + 1}, joins at ${g.j + 1}, legs ${g.la}/${g.lb} px, crosses the road ${g.cross}, off screen ${g.off}, over stop ${g.stopHit + 1 || '-'}, door on road ${g.doorRoad}, door on stop ${g.doorStop + 1 || '-'}`);
  ok(!p.errs.length, `${W}x${H}: no page errors ${p.errs.join(' | ')}`);
  await p.close();
}

// ---- play on the phone
const p = await open(450, 1000);
// shut: its branch level not won yet -> neither the door nor the fork takes a tap
const shut = await p.evaluate(() => { SAVE(9); MAP(1); return __egg.ui.buttons.filter((x) => /^sq:1/.test(x.id)).length; });
ok(shut === 0, `shut side quest: no tap on its door or fork (${shut})`);
for (const w of [1, 0, 7]) {
  const top = w === 0 ? 4 : w * 6 + 5; // world 1: the hen at level 5 (its quest opens once level 4 is won); else at the boss, past the fork
  const r = await p.evaluate(([w, top]) => {
    const E = __egg; SAVE(top); MAP(w);
    const ids = E.ui.buttons.filter((x) => x.id === 'sq:' + w || x.id === 'sq:' + w + ':path').map((x) => x.id), lv = E.ui.buttons.filter((x) => /^lv:/.test(x.id)).length;
    const nest = E.G.mapHen && { x: E.G.mapHen.x, y: E.G.mapHen.y };
    E.press(ids.includes('sq:' + w + ':path') ? 'sq:' + w + ':path' : 'sq:' + w);
    const track = []; let k = 0;
    for (; k < 400 && E.G.screen === 'levels'; k++) { F(1); if (E.G.mapHen) track.push([E.G.mapHen.x, E.G.mapHen.y + E.G.mscroll.y]); }
    let jump = 0; for (let i = 1; i < track.length; i++) jump = Math.max(jump, Math.hypot(track[i][0] - track[i - 1][0], track[i][1] - track[i - 1][1]));
    const went = track.length > 1 ? Math.hypot(track[track.length - 1][0] - track[0][0], track[track.length - 1][1] - track[0][1]) : 0;
    const out = { ids, lv, frames: k, screen: E.G.screen, key: E.wonder.state.level && E.wonder.state.level.key, jump: Math.round(jump), went: Math.round(went), nest };
    // back to the map: she walks home
    E.press('wv:map'); F(2);
    const back = { screen: E.G.screen, walk: !!(E.G.sideWalk && E.G.sideWalk.back) }, bt = [];
    for (let i = 0; i < 300 && E.G.sideWalk; i++) { F(1); if (E.G.mapHen) bt.push([E.G.mapHen.x, E.G.mapHen.y + E.G.mscroll.y]); }
    F(5);
    let bj = 0; for (let i = 1; i < bt.length; i++) bj = Math.max(bj, Math.hypot(bt[i][0] - bt[i - 1][0], bt[i][1] - bt[i - 1][1]));
    back.jump = Math.round(bj); back.done = !E.G.sideWalk; back.home = E.G.mapHen && E.G.mapHen.to === E.save.unlocked - 1;
    back.frames = bt.length;
    return { out, back };
  }, [w, top]);
  const o = r.out, bk = r.back;
  ok(o.ids.length >= 1 && o.ids.includes('sq:' + w), `world ${w + 1}: the open door takes a tap (${o.ids.join(', ')})`);
  ok(o.ids.includes('sq:' + w + ':path'), `world ${w + 1}: its fork takes a tap too`);
  ok(o.lv > 0, `world ${w + 1}: the road's stops keep their taps (${o.lv})`);
  ok(o.screen === 'wonder' && o.frames < 200, `world ${w + 1}: the hen walks to the door and its vault opens (${o.key}, ${o.frames} frames)`);
  ok(o.went > 40 && o.jump < 24, `world ${w + 1}: she walks ${o.went} px, never more than ${o.jump} px in a frame (no jump)`);
  ok(bk.screen === 'levels' && bk.walk && bk.done && bk.home && bk.jump < 24 && bk.frames > 30, `world ${w + 1}: back on the map she walks home to her nest (${bk.frames} frames, step ${bk.jump} px)`);
}
// the road's own stop still opens its level beside a fork
const lvOk = await p.evaluate(() => { const E = __egg; SAVE(11); MAP(1); const id = 'lv:11'; if (!E.ui.buttons.some((x) => x.id === id)) return 'no ' + id; E.press(id); F(5); return E.G.screen; });
ok(lvOk === 'intro' || lvOk === 'play', `a road stop by the fork still opens its level (${lvOk})`);
ok(!p.errs.length, `play: no page errors ${p.errs.join(' | ')}`);
await b.close(); srv.close();
console.log(`${n - fails}/${n} ok`);
process.exit(fails ? 1 : 0);
