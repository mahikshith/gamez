// UI overlap QA: renders every screen of every level at several viewport sizes and asks the UI
// layer which recorded text/button rects overlap or leave the screen. Also saves a contact sheet.
// Usage: node tools/qa-overlap.cjs <dir with index.html + game.js (dev build)> [outDir]
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const dir = path.resolve(process.argv[2] || '.');
const out = path.resolve(process.argv[3] || path.join(dir, 'out'));
fs.mkdirSync(out, { recursive: true });

const ALL_SIZES = [[390, 844], [360, 640], [1280, 720], [640, 360], [600, 600], [768, 1024], [1024, 768], [800, 1280], [1280, 800], [1180, 820], [820, 1180]]; // 2026-11-16: tablets too (mykee)
// QA_SIZES="390x844,1024x768" runs a subset (a full run takes ~20 min)
const SIZES = process.env.QA_SIZES ? process.env.QA_SIZES.split(',').map((s) => s.split('x').map(Number)) : ALL_SIZES;

const srv = http.createServer((q, r) => {
  const u = q.url.split('?')[0];
  const f = path.join(dir, u === '/' ? 'index.html' : u);
  fs.readFile(f, (e, d) => {
    if (e) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' });
    r.end(d);
  });
}).listen(+process.env.QA_PORT || 8768); // QA_PORT: parallel runs each take their own port

(async () => {
  const b = await chromium.launch();
  const problems = [];
  const shots = [];
  for (const [w, h] of SIZES) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    const errors = [];
    p.on('pageerror', (e) => errors.push(String(e)));
    await p.goto(`http://localhost:${+process.env.QA_PORT || 8768}/`);
    await p.waitForTimeout(800);
    const n = await p.evaluate(() => __egg.LEVELS.length);
    const check = async (label, fn, arg, shoot) => {
      const ov = await p.evaluate(fn, arg);
      if (ov.length) problems.push(`${w}x${h} ${label}: ${ov.map((o) => o.join(' x ')).join('; ')}`);
      if (shoot) { const f = path.join(out, `qa-${w}x${h}-${label}.png`); await p.screenshot({ path: f }); shots.push({ f, label: `${w}x${h} ${label}` }); }
    };
    const frames = (k) => { for (let i = 0; i < k; i++) __egg.frame(1 / 60); };
    await check('title', (k) => { const E = __egg; E.G.screen = 'title'; E.G.screenT = 5; for (let i = 0; i < 3; i++) E.frame(1 / 60); return E.overlaps(); }, 0, true);
    await check('levels', (k) => { const E = __egg; E.setSave({ unlocked: 20, stars: { 1: 3, 2: 2, 3: 1 } }); E.press('levels'); for (let i = 0; i < 30; i++) E.frame(1 / 60); return E.overlaps(); }, 0, true);
    await check('store', () => { const E = __egg; E.setSave({ unlocked: 20, wallet: { coins: 120, owned: { stone: 2, rewind: 1 } } }); E.press('shop'); for (let i = 0; i < 30; i++) E.frame(1 / 60); return E.overlaps(); }, 0, true);
    await check('store-skins', () => { const E = __egg; E.press('tab:skins'); for (let i = 0; i < 30; i++) E.frame(1 / 60); const o = E.overlaps(); E.press('back'); return o; }, 0, false);
    await check('extras', () => { const E = __egg; E.G.screen = 'title'; E.press('extras'); for (let i = 0; i < 30; i++) E.frame(1 / 60); return E.overlaps(); }, 0, true); // WONDER: the Extras screen
    await check('practice', () => { const E = __egg; E.G.screen = 'title'; E.press('practice'); E.G.pscroll.y = 0; for (let i = 0; i < 30; i++) E.frame(1 / 60); return E.overlaps(); }, 0, true);
    await check('practice-scrolled', () => { const E = __egg; E.G.pscroll.y = 400; for (let i = 0; i < 5; i++) E.frame(1 / 60); const o = E.overlaps(); E.G.pscroll.y = 1e6; for (let i = 0; i < 5; i++) E.frame(1 / 60); return o.concat(E.overlaps()); }, 0, true);
    for (const k of ['planet', 'plan', 'mama', 'twin', 'hatch']) { // WONDER: each bonus vault in play, then its end cards
      await check(`wonder-${k}`, (k) => { const E = __egg; E.startDemo(k); for (let i = 0; i < 60; i++) E.frame(1 / 60); return E.overlaps(); }, k, k === 'plan' || k === 'twin');
      await check(`wonder-${k}-won`, () => { const E = __egg, g = E.wonder.state.game; g.end('won'); for (let i = 0; i < 200; i++) E.frame(1 / 60); return E.overlaps(); }, 0, k === 'twin');
      await check(`wonder-${k}-failed`, (k) => { const E = __egg; E.startDemo(k); E.frame(1 / 60); E.wonder.state.game.end('failed'); for (let i = 0; i < 200; i++) E.frame(1 / 60); const o = E.overlaps(); E.press('wv:quit'); E.frame(1 / 60); return o; }, k, false);
    }
    await check('power-card', () => { const E = __egg; E.start(0); E.press('go'); E.G.card = { id: 'fire_gold', t: 0.3, dur: 2 }; for (let i = 0; i < 3; i++) E.frame(1 / 60); return E.overlaps(); }, 0, false);
    for (let i = 0; i < n; i++) {
      const shoot = i === 0 || i === n - 1 || i === 12;
      await check(`L${i + 1}-intro`, (i) => { const E = __egg; E.start(i); for (let k = 0; k < 40; k++) E.frame(1 / 60); return E.overlaps(); }, i, shoot);
      // 0.8.14: the level card's Chicks tab, with the chick in the middle of the carousel and, at the row's end, a locked one
      if (await p.evaluate(() => __egg.ui.buttons.some((b) => b.id === 'itab:chicks'))) {
        await check(`L${i + 1}-intro-chicks`, () => { const E = __egg; E.press('itab:chicks'); for (let k = 0; k < 30; k++) E.frame(1 / 60); return E.overlaps(); }, 0, shoot);
        await check(`L${i + 1}-intro-chicks-end`, () => { const E = __egg, R = E.G.car; if (R) { R.to = null; R.v = 0; R.y = R.max; } for (let k = 0; k < 20; k++) E.frame(1 / 60); const o = E.overlaps(); E.press('itab:level'); for (let k = 0; k < 5; k++) E.frame(1 / 60); return o; }, 0, false);
      }
      if (await p.evaluate((i) => !!__egg.LEVELS[i].intro, i)) await check(`L${i + 1}-intro-after`, () => { const E = __egg; E.press('gotit'); for (let k = 0; k < 10; k++) E.frame(1 / 60); return E.overlaps(); }, 0, false);
      await check(`L${i + 1}-play`, (i) => { const E = __egg; E.press('go'); for (let k = 0; k < 90; k++) E.frame(1 / 60); return E.overlaps(); }, i, shoot);
    }
    await check('daily-intro', () => { const E = __egg; E.start(-1); for (let k = 0; k < 40; k++) E.frame(1 / 60); return E.overlaps(); }, 0, false);
    await check('pause', () => { const E = __egg; E.start(4); E.press('go'); for (let k = 0; k < 20; k++) E.frame(1 / 60); E.press('pause'); for (let k = 0; k < 30; k++) E.frame(1 / 60); return E.overlaps(); }, 0, true);
    // the "i" panel (who is in this vault): a boss level, a full list, the scrolled middle, a practice vault, and from the pause card
    for (const i of [4, 29, 39, 49]) await check(`info-L${i + 1}`, (i) => { const E = __egg; E.start(i); E.press('go'); for (let k = 0; k < 30; k++) E.frame(1 / 60); E.press('info'); for (let k = 0; k < 30; k++) E.frame(1 / 60); return E.overlaps(); }, i, i === 39);
    await check('info-scrolled', () => { const E = __egg, S = E.G.iscroll; S.y = S.max / 2; S.v = 0; E.frame(1 / 60); const o = E.overlaps(); S.y = S.max; E.frame(1 / 60); const o2 = o.concat(E.overlaps()); E.press('info:close'); E.frame(1 / 60); return o2; }, 0, false);
    await check('info-practice', () => { const E = __egg; E.startDemo('beetle'); E.press('go'); for (let k = 0; k < 30; k++) E.frame(1 / 60); E.press('info'); for (let k = 0; k < 30; k++) E.frame(1 / 60); const o = E.overlaps(); E.press('info:close'); return o; }, 0, false);
    await check('info-from-pause', () => { const E = __egg; E.start(46); E.press('go'); for (let k = 0; k < 20; k++) E.frame(1 / 60); E.press('pause'); for (let k = 0; k < 30; k++) E.frame(1 / 60); const o = E.overlaps(); E.press('info'); for (let k = 0; k < 30; k++) E.frame(1 / 60); return o.concat(E.overlaps()); }, 0, false);
    for (const s of [3, 2, 1]) await check(`win${s}`, (s) => { const E = __egg; E.start(4); E.press('go'); E.frame(1 / 60); E.showResult('win', s); for (let k = 0; k < 400; k++) E.frame(1 / 60); return E.overlaps(); }, s, s === 3);
    await check('fail', () => { const E = __egg; E.start(4); E.press('go'); E.frame(1 / 60); E.showResult('fail'); for (let k = 0; k < 120; k++) E.frame(1 / 60); return E.overlaps(); }, 0, true);
    // 0.8.14: the fail page's rows (stuck with the coin way, a help offer, a Skip Ticket, a level with no skip), the shop
    // mark (map hand, level card, pause banner, win chip), the ring speed strip (levels 2 to 5, before and after a change)
    const mkSave = (o) => `(() => { const E = __egg, st = {}; for (let i = 1; i < ${o.lv}; i++) st[i] = 3; ${o.won ? `st[${o.lv}] = 1;` : ''}
      E.setSave({ unlocked: ${o.lv}, stars: st, wallet: { coins: ${o.coins || 400}, tickets: { ally: 0, skip: ${o.tk || 0} } }, seen: ${JSON.stringify(o.seen || { pickN: 2, rsTried: 1, setOpen: 1, shopHand: 1 })} });
      const s = E.save; for (let i = 1; i <= 60; i++) s.intro[i] = 1; s.strikeSeen = new Proxy({}, { get: () => 1 }); })()`;
    const toPlay = `(() => { const E = __egg; for (let k = 0; k < 4 && E.G.screen === 'intro'; k++) { E.press(k % 2 ? 'inext' : 'go'); for (let i = 0; i < 3; i++) E.frame(1 / 60); } if (E.G.screen === 'intro') E.G.screen = 'play'; })()`;
    for (const [lab, o] of [['stuck', { lv: 12, stuck: 1 }], ['help', { lv: 12, help: 1 }], ['ticket', { lv: 12, tk: 2 }], ['noskip', { lv: 12, won: 1 }], ['streak', { lv: 12, hot: 1 }]]) {
      await check(`fail-${lab}`, ([sv, tp, o]) => { const E = __egg; eval(sv); E.ads.won(o.lv); if (o.stuck) { E.ads.fail(o.lv); E.ads.fail(o.lv); E.ads.fail(o.lv); } if (o.hot) E.save.dir = { ...(E.save.dir || {}), hotLost: 4, hotAt: Date.now() };
        E.start(o.lv - 1); for (let k = 0; k < 20; k++) E.frame(1 / 60); eval(tp); E.step(14); E.showResult('fail');
        if (o.help) E.G.failHelp = { kind: 'trialBoost', id: 'stone', label: 'Free Stone Shell', line: 'One crack shrugged off, on us.', price: 0 };
        for (let k = 0; k < 120; k++) E.frame(1 / 60); const ov = E.overlaps(); const S = E.G.fscroll; if (S && S.max > 0) { S.y = S.max; S.v = 0; E.frame(1 / 60); return ov.concat(E.overlaps()); } return ov; }, [mkSave(o), toPlay, o], lab === 'stuck');
    }
    await check('mark-map', (sv) => { const E = __egg; eval(sv); E.G.toasts = []; E.G.toast = null; E.G.screen = 'title'; E.press('levels'); for (let k = 0; k < 90; k++) E.frame(1 / 60); return E.overlaps(); }, mkSave({ lv: 12, coins: 340, seen: { pickN: 2, rsTried: 1, setOpen: 0, shopSawN: 0 } }), true);
    await check('mark-home', () => { const E = __egg; E.G.toasts = []; E.G.toast = null; E.G.screen = 'title'; E.G.screenT = 5; for (let k = 0; k < 5; k++) E.frame(1 / 60); return E.overlaps(); }, 0, false);
    await check('mark-card', () => { const E = __egg; E.start(11); for (let k = 0; k < 40; k++) E.frame(1 / 60); return E.overlaps(); }, 0, false);
    await check('mark-pause', (tp) => { const E = __egg; eval(tp); for (let k = 0; k < 20; k++) E.frame(1 / 60); E.press('pause'); for (let k = 0; k < 30; k++) E.frame(1 / 60); const o = E.overlaps(); const S = E.G.ppage; if (S && S.max > 0) { S.y = S.max; S.v = 0; E.frame(1 / 60); return o.concat(E.overlaps()); } return o; }, toPlay, true);
    await check('mark-win', () => { const E = __egg; E.save.wallet.coins = 900; E.start(11); E.frame(1 / 60); E.showResult('win', 3); for (let k = 0; k < 400; k++) E.frame(1 / 60); return E.overlaps(); }, 0, false);
    for (const lv of [2, 3, 4, 5]) await check(`rs-strip-L${lv}`, (sv) => { const E = __egg; eval(sv); E.start(+sv.match(/unlocked: (\d+)/)[1] - 1); for (let k = 0; k < 40; k++) E.frame(1 / 60); const o = E.overlaps(); E.press('rs:+'); for (let k = 0; k < 10; k++) E.frame(1 / 60); return o.concat(E.overlaps()); }, mkSave({ lv, seen: { pickN: 2 } }), lv === 2);
    await check('settings-first', (sv) => { const E = __egg; eval(sv); E.G.screen = 'title'; E.press('settings'); for (let k = 0; k < 30; k++) E.frame(1 / 60); const o = E.overlaps(); E.press('set:close'); return o; }, mkSave({ lv: 4, seen: {} }), false);
    for (const e of errors) problems.push(`${w}x${h} PAGE ERROR: ${e}`);
    await p.close();
  }
  // contact sheet: an HTML page next to the shots (file references; inlining 11 sizes of base64 PNGs crashed the tab)
  try {
    const html = `<html><body style="margin:0;background:#222;color:#ddd;font:12px sans-serif;display:flex;flex-wrap:wrap;gap:6px">${shots.map((s) => `<div><div>${s.label}</div><img src="${path.basename(s.f)}" style="height:300px"></div>`).join('')}</body></html>`;
    const sheet = path.join(out, 'qa-sheet.html');
    fs.writeFileSync(sheet, html);
    const p2 = await b.newPage({ viewport: { width: 1800, height: 900 } });
    await p2.goto('file://' + path.resolve(sheet), { waitUntil: 'load' });
    await p2.screenshot({ path: path.join(out, 'qa-sheet.png'), fullPage: true });
    shots.forEach((s) => fs.unlinkSync(s.f)); fs.unlinkSync(sheet);
  } catch (e) { console.log('contact sheet skipped:', e.message.split('\n')[0]); }
  await b.close();
  srv.close();
  console.log(problems.length ? problems.join('\n') : 'NO OVERLAPS');
  console.log(`checked ${SIZES.length} sizes; problems: ${problems.length}`);
})();
