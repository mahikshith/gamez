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
// QA_ONLY="spin|leave" runs only the states whose name matches (each of the 0.8.15 states sets up its own save)
const ONLY = process.env.QA_ONLY ? new RegExp(process.env.QA_ONLY) : null;
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
      if (ONLY && !ONLY.test(label)) return;
      const ov = await p.evaluate(fn, arg);
      if (ov.length) problems.push(`${w}x${h} ${label}: ${ov.map((o) => o.join(' x ')).join('; ')}`);
      if (shoot) { const f = path.join(out, `qa-${w}x${h}-${label}.png`); await p.screenshot({ path: f }); shots.push({ f, label: `${w}x${h} ${label}` }); }
    };
    const frames = (k) => { for (let i = 0; i < k; i++) __egg.frame(1 / 60); };
    await check('title', (k) => { const E = __egg; E.G.screen = 'title'; E.G.screenT = 5; for (let i = 0; i < 3; i++) E.frame(1 / 60); return E.overlaps(); }, 0, true);
    await check('levels', (k) => { const E = __egg; E.setSave({ unlocked: 20, stars: { 1: 3, 2: 2, 3: 1 } }); E.press('levels'); for (let i = 0; i < 30; i++) E.frame(1 / 60); return E.overlaps(); }, 0, true);
    // 0.8.17 map states: a world's gate in the scene (the first shut world with its coin button), a trip with the padlock
    // breaking, a gate opening
    await check('map-gate', () => { const E = __egg, st = {}; for (let i = 1; i <= 18; i++) st[i] = 1; E.setSave({ unlocked: 19, stars: st, wallet: { coins: 900 } }); E.G.screen = 'title'; E.press('levels'); E.mapJump(3); for (let i = 0; i < 40; i++) E.frame(1 / 60); return E.overlaps(); }, 0, true);
    await check('map-trip', () => { const E = __egg, st = {}; for (let i = 1; i < 14; i++) st[i] = 2; E.setSave({ unlocked: 14, stars: st }); E.G.screen = 'title'; E.press('levels'); for (let i = 0; i < 5; i++) E.frame(1 / 60); E.save.stars[14] = 2; E.save.unlocked = 15; E.G.mapTravel = { from: 13, to: 14, t0: -1 }; /* 0.8.17: 14 -> 15 (12 -> 13 on the 50-level road; 12 is a boss now and its won chest would open over every later state) */ E.G.mscroll.focus = ''; for (let i = 0; i < 40; i++) E.frame(1 / 60); const o = E.overlaps(); for (let i = 0; i < 60; i++) E.frame(1 / 60); const o2 = o.concat(E.overlaps()); E.G.mapTravel = null; E.G.treasure = null; return o2; } /* (0.8.17: a trip or a gate that lands a boss chest leaves it open over the states after it) */, 0, true);
    await check('map-open', () => { const E = __egg, st = {}; for (let i = 1; i <= 18; i++) st[i] = 1; E.setSave({ unlocked: 19, stars: st, wallet: { coins: 900 } }); E.G.screen = 'title'; E.press('levels'); E.mapJump(3); for (let i = 0; i < 30; i++) E.frame(1 / 60); E.save.gates = { 3: 1 }; for (let i = 0; i < 50; i++) E.frame(1 / 60); const o = E.overlaps(); for (let i = 0; i < 120; i++) E.frame(1 / 60); const o2 = o.concat(E.overlaps()); E.G.mapTravel = null; E.G.treasure = null; return o2; } /* (0.8.17: a trip or a gate that lands a boss chest leaves it open over the states after it) */, 0, true);
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
        // 0.8.16: the picker's arrows: two chicks on (both arrows over the row's ends), and they must have moved the focus
        await check(`L${i + 1}-intro-chicks-mid`, () => { const E = __egg, R = E.G.car, y0 = R ? R.y : 0, many = R && R.max > 2.5 * R.step; if (!many) return []; E.press('car:next'); for (let k = 0; k < 20; k++) E.frame(1 / 60); E.press('car:next'); for (let k = 0; k < 30; k++) E.frame(1 / 60);
          const o = E.overlaps(), has = ['car:prev', 'car:next'].every((id) => E.ui.buttons.some((b) => b.id === id)); return Math.abs(R.y - y0 - 2 * R.step) < 1 && has ? o : o.concat([['picker arrows', 'did not step two chicks or are missing']]); }, 0, i === 12);
        await check(`L${i + 1}-intro-chicks-end`, () => { const E = __egg, R = E.G.car; if (R) { R.to = null; R.v = 0; R.y = R.max; } for (let k = 0; k < 20; k++) E.frame(1 / 60); const o = E.overlaps(); E.press('itab:level'); for (let k = 0; k < 5; k++) E.frame(1 / 60); return o; }, 0, false);
      }
      if (await p.evaluate((i) => !!__egg.LEVELS[i].intro, i)) await check(`L${i + 1}-intro-after`, () => { const E = __egg; E.press('gotit'); for (let k = 0; k < 10; k++) E.frame(1 / 60); return E.overlaps(); }, 0, false);
      await check(`L${i + 1}-play`, (i) => { const E = __egg; E.press('go'); for (let k = 0; k < 90; k++) E.frame(1 / 60); return E.overlaps(); }, i, shoot);
    }
    await check('daily-intro', () => { const E = __egg; E.start(-1); for (let k = 0; k < 40; k++) E.frame(1 / 60); return E.overlaps(); }, 0, false);
    await check('pause', () => { const E = __egg; E.start(4); E.press('go'); for (let k = 0; k < 20; k++) E.frame(1 / 60); E.press('pause'); for (let k = 0; k < 30; k++) E.frame(1 / 60); return E.overlaps(); }, 0, true);
    // 0.8.17 urchin: level 46 in play with Spike puffed up at an egg (the aim line, the SPLAT popup), and its "i" panel
    await check('urchin-play', () => { const E = __egg; E.start(45); for (let k = 0; k < 6; k++) { E.frame(1 / 60); if (E.ui.buttons.some((b) => b.id === 'stk:gotit')) E.press('stk:gotit'); } for (let k = 0; k < 4 && E.G.screen === 'intro'; k++) { E.press(E.ui.buttons.some((b) => b.id === 'gotit') ? 'gotit' : 'go'); E.frame(1 / 60); } for (let k = 0; k < 400; k++) E.frame(1 / 60); const S = E.sim; for (let k = 0; k < 2400 && !(S.urchins[0] && S.urchins[0].ph === 'puff'); k++) S.step(); for (let k = 0; k < 30; k++) E.frame(1 / 60); return E.overlaps(); }, 0, true);
    await check('urchin-info', () => { const E = __egg; E.start(45); E.press('go'); for (let k = 0; k < 30; k++) E.frame(1 / 60); E.press('info'); for (let k = 0; k < 30; k++) E.frame(1 / 60); const o = E.overlaps(); return E.G.screen === 'info' ? o : o.concat([['the info panel', 'did not open']]); }, 0, true);
    // the "i" panel (who is in this vault): a boss level, a full list, the scrolled middle, a practice vault, and from the pause card
    for (const i of [4, 35, 47, 59]) await check(`info-L${i + 1}`, (i) => { const E = __egg; E.start(i); E.press('go'); for (let k = 0; k < 30; k++) E.frame(1 / 60); E.press('info'); for (let k = 0; k < 30; k++) E.frame(1 / 60); return E.overlaps(); }, i, i === 39);
    await check('info-scrolled', () => { const E = __egg, S = E.G.iscroll; S.y = S.max / 2; S.v = 0; E.frame(1 / 60); const o = E.overlaps(); S.y = S.max; E.frame(1 / 60); const o2 = o.concat(E.overlaps()); E.press('info:close'); E.frame(1 / 60); return o2; }, 0, false);
    await check('info-practice', () => { const E = __egg; E.startDemo('beetle'); E.press('go'); for (let k = 0; k < 30; k++) E.frame(1 / 60); E.press('info'); for (let k = 0; k < 30; k++) E.frame(1 / 60); const o = E.overlaps(); E.press('info:close'); return o; }, 0, false);
    await check('info-from-pause', () => { const E = __egg; E.start(55); E.press('go'); for (let k = 0; k < 20; k++) E.frame(1 / 60); E.press('pause'); for (let k = 0; k < 30; k++) E.frame(1 / 60); const o = E.overlaps(); E.press('info'); for (let k = 0; k < 30; k++) E.frame(1 / 60); return o.concat(E.overlaps()); }, 0, false);
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
    // 0.8.17 the Pacer (src/engine/pacer.js): the Stuck? pop-up arriving and settled, the free hint on the fail page's
    // help card, the dare chip (off and taken), Easy's goals on the level card and the win page, the map's marks, the switch
    await check('pacer-stuck', ([sv, tp]) => { const E = __egg; eval(sv); const o = []; for (let n = 0; n < 3; n++) { if (n && E.G.screen === 'fail') E.press('retry'); else { E.start(11); for (let k = 0; k < 20; k++) E.frame(1 / 60); eval(tp); } for (let k = 0; k < 30; k++) E.frame(1 / 60); E.G.sim.state = 'failed'; E.endRun(false); for (let k = 0; k < 300 && E.G.screen !== 'fail'; k++) E.frame(1 / 60); }
      if (!E.G.stuckAsk) return [['pacer-stuck', 'no pop-up after three losses']];
      for (let k = 0; k < 40; k++) E.frame(1 / 60); o.push(...E.overlaps()); for (let k = 0; k < 60; k++) E.frame(1 / 60); return o.concat(E.overlaps()); }, [mkSave({ lv: 12 }), toPlay], true);
    await check('pacer-hint', () => { const E = __egg; E.press('stuck:no'); for (let k = 0; k < 20; k++) E.frame(1 / 60); const o = E.overlaps(); const S = E.G.fscroll; if (S && S.max > 0) { S.y = S.max; S.v = 0; E.frame(1 / 60); return o.concat(E.overlaps()); } return o; }, 0, true);
    const pacSave = (mode) => /* 0.8.17: at level 14 (Icicle Hollow, 12 on the 50-level road; 12 is a boss now) */ `(() => { const E = __egg, st = {}; for (let i = 1; i < 14; i++) st[i] = 3; E.setSave({ unlocked: 14, stars: st, mode: '${mode}', wallet: { coins: 230 }, eng: { pac: { ft3: 3 } }, seen: { pickN: 2, rsTried: 1, setOpen: 1, shopHand: 1 } }); const s = E.save; for (let i = 1; i <= 60; i++) s.intro[i] = 1; s.strikeSeen = new Proxy({}, { get: () => 1 }); })()`;
    await check('pacer-dare', (sv) => { const E = __egg; eval(sv); E.start(13); for (let k = 0; k < 40; k++) E.frame(1 / 60); const o = E.overlaps(); if (!E.ui.buttons.some((b) => b.id === 'dare:chip')) return [['pacer-dare', 'no dare chip']]; E.press('dare:chip'); for (let k = 0; k < 40; k++) E.frame(1 / 60); return o.concat(E.overlaps()); }, pacSave('medium'), true);
    await check('pacer-easy-card', (sv) => { const E = __egg; eval(sv); E.start(13); for (let k = 0; k < 40; k++) E.frame(1 / 60); return E.overlaps(); }, pacSave('easy'), true);
    await check('pacer-easy-win', (tp) => { const E = __egg; eval(tp); const goals = E.G.goals.map((g, i) => ({ long: g.long, ok: i < 2, res: ['3 home', 'None lost', '96 s'][i] })); E.showResult('win', 2, null, 9, { goals, hasBonus: false, dare: { long: 'Dare: no boosters', ok: true, res: '+17 coins' } }); for (let k = 0; k < 60; k++) E.frame(1 / 60); return E.overlaps(); }, toPlay, true);
    await check('pacer-map', () => { const E = __egg, st = { 1: 1, 2: 2, 3: 1, 4: 2, 5: 1, 6: 1, 7: 2, 8: 1, 9: 1, 10: 1 }; E.setSave({ unlocked: 11, stars: st, best: { 2: 900, 4: 1200, 7: 700, 6: 2000 }, wallet: { coins: 30 }, eng: { pac: { dared: { 8: 1, 9: 1 } } }, seen: { pickN: 2, rsTried: 1, setOpen: 1, shopHand: 1 } }); E.G.toasts = []; E.G.toast = null; E.G.screen = 'title'; E.press('levels'); for (let k = 0; k < 90; k++) E.frame(1 / 60); const S = E.G.mscroll; S.y = Math.min(S.max, S.y + innerHeight * 0.9); S.v = 0; S.to = null; for (let k = 0; k < 30; k++) E.frame(1 / 60); return E.overlaps(); }, 0, true); // (scrolled down to the marked stops: the gate card's own frame records over its words, a map matter)
    await check('pacer-settings', () => { const E = __egg; E.G.screen = 'title'; E.press('settings'); for (let k = 0; k < 30; k++) E.frame(1 / 60); const o = E.overlaps(); const S = E.G.setpage; if (S && S.max > 0) { S.y = Math.min(S.max, 260); S.v = 0; S.to = null; E.frame(1 / 60); o.push(...E.overlaps()); } E.press('set:close'); return o; }, 0, false);
    await check('mark-map', (sv) => { const E = __egg; eval(sv); E.G.toasts = []; E.G.toast = null; E.G.screen = 'title'; E.press('levels'); for (let k = 0; k < 90; k++) E.frame(1 / 60); return E.overlaps(); }, mkSave({ lv: 12, coins: 340, seen: { pickN: 2, rsTried: 1, setOpen: 0, shopSawN: 0 } }), true);
    await check('mark-home', () => { const E = __egg; E.G.toasts = []; E.G.toast = null; E.G.screen = 'title'; E.G.screenT = 5; for (let k = 0; k < 5; k++) E.frame(1 / 60); return E.overlaps(); }, 0, false);
    await check('mark-card', () => { const E = __egg; E.start(11); for (let k = 0; k < 40; k++) E.frame(1 / 60); return E.overlaps(); }, 0, false);
    await check('mark-pause', (tp) => { const E = __egg; eval(tp); for (let k = 0; k < 20; k++) E.frame(1 / 60); E.press('pause'); for (let k = 0; k < 30; k++) E.frame(1 / 60); const o = E.overlaps(); const S = E.G.ppage; if (S && S.max > 0) { S.y = S.max; S.v = 0; E.frame(1 / 60); return o.concat(E.overlaps()); } return o; }, toPlay, true);
    await check('mark-win', () => { const E = __egg; E.save.wallet.coins = 900; E.start(11); E.frame(1 / 60); E.showResult('win', 3); for (let k = 0; k < 400; k++) E.frame(1 / 60); return E.overlaps(); }, 0, false);
    // 0.8.16: the marked shop button lands on the thing (its tab, scrolled to it, the ring and the hand): mid-trip and settled
    await check('shop-focus', (sv) => { const E = __egg; eval(sv); E.G.toasts = []; E.G.toast = null; E.G.screen = 'title'; E.G.screenT = 5; for (let k = 0; k < 5; k++) E.frame(1 / 60); E.press('shop'); for (let k = 0; k < 8; k++) E.frame(1 / 60); const o = E.overlaps(); for (let k = 0; k < 60; k++) E.frame(1 / 60); const S = E.G.sscroll; return o.concat(E.overlaps(), E.G.screen === 'store' && S.hl && S.hl.point ? [] : [['shop-focus', 'no ring on the pick']]); }, mkSave({ lv: 12, coins: 340, seen: { pickN: 2, rsTried: 1, setOpen: 1, shopSawN: 0 } }), true);
    for (const lv of [2, 3, 4, 5]) await check(`rs-strip-L${lv}`, (sv) => { const E = __egg; eval(sv); E.start(+sv.match(/unlocked: (\d+)/)[1] - 1); for (let k = 0; k < 40; k++) E.frame(1 / 60); const o = E.overlaps(); E.press('rs:+'); for (let k = 0; k < 10; k++) E.frame(1 / 60); return o.concat(E.overlaps()); }, mkSave({ lv, seen: { pickN: 2 } }), lv === 2);
    await check('settings-first', (sv) => { const E = __egg; eval(sv); E.G.screen = 'title'; E.press('settings'); for (let k = 0; k < 30; k++) E.frame(1 / 60); const o = E.overlaps(); E.press('set:close'); return o; }, mkSave({ lv: 4, seen: {} }), false);
    // 0.8.15: the Lucky Spin (resting, the odds, the ways to pay, a villain row and the Try again after it, a prize),
    // its rows on the map and the fail page, the leaving card, the reminder question, the booster row's second page,
    // the Scarecrow in a level, the shop with a half-price ticket
    const spinSave = (o) => `(() => { const E = __egg, st = {}; for (let i = 1; i < 12; i++) st[i] = 2;
      E.setSave({ unlocked: 12, stars: st, age: '13+', wallet: { coins: ${o.coins ?? 420}, coupon: ${o.coupon || 0}, owned: ${JSON.stringify(o.owned || {})} }, spin: ${JSON.stringify(o.spin || { wins: 1, bank: 2, n: 5 })}, seen: { pickN: 2, rsTried: 1, setOpen: 1, shopHand: 1 } });
      const s = E.save; for (let i = 1; i <= 60; i++) s.intro[i] = 1; s.strikeSeen = new Proxy({}, { get: () => 1 }); E.G.toasts = []; E.G.toast = null; E.G.leftAsked = false; E.G.leaveAsk = null; E.G.remAsk = null; })()`;
    const toSpin = `(() => { const E = __egg; E.G.screen = 'title'; E.press('levels'); for (let k = 0; k < 40; k++) E.frame(1 / 60); E.press('spin'); for (let k = 0; k < 40; k++) E.frame(1 / 60); })()`;
    await check('spin-map', (sv) => { const E = __egg; eval(sv); E.G.screen = 'title'; E.press('levels'); for (let k = 0; k < 60; k++) E.frame(1 / 60); return E.overlaps(); }, spinSave({}), false);
    await check('spin-idle', ([sv, ts]) => { const E = __egg; eval(sv); eval(ts); return E.G.screen === 'spin' ? E.overlaps() : [['the spin page', 'did not open']]; }, [spinSave({}), toSpin], true);
    await check('spin-odds', () => { const E = __egg; E.press('spin:odds'); for (let k = 0; k < 20; k++) E.frame(1 / 60); return E.overlaps(); }, 0, true);
    await check('spin-pay', ([sv, ts]) => { const E = __egg; eval(sv); eval(ts); const o = E.overlaps(); E.save.wallet.coins = 5; E.press('spin:coin'); for (let k = 0; k < 10; k++) E.frame(1 / 60); return o.concat(E.overlaps()); }, [spinSave({ spin: { wins: 2, bank: 0, n: 5 } }), toSpin], false);
    await check('spin-villains', ([sv, ts]) => { const E = __egg; eval(sv); eval(ts); const r = Math.random; let n = 0; Math.random = () => (n++ === 0 ? 0.9 : 0.5); E.press('spin:go'); Math.random = r;
      let o = []; for (let k = 0; k < 330; k++) { E.frame(1 / 60); if (k % 30 === 29) o = o.concat(E.overlaps()); } return o; }, [spinSave({ spin: { wins: 1, bank: 1, n: 5 } }), toSpin], true);
    await check('spin-tryagain', () => { const E = __egg; for (let k = 0; k < 200; k++) E.frame(1 / 60); const o = E.overlaps(), ids = E.ui.buttons.map((b) => b.id); return ids.includes('spin:retry') ? o.concat([['Try again', 'is still offered after a villain row (0.8.16: a lost pull is lost)']]) : ids.includes('spin:coin') || ids.includes('spin:ad') ? o : o.concat([['after a villain row', 'no way to spin again is offered']]); }, 0, true);
    await check('spin-prize', ([sv, ts]) => { const E = __egg; eval(sv); eval(ts); const r = Math.random; let n = 0; Math.random = () => (n++ === 0 ? 0.01 : 0.5); E.press('spin:go'); Math.random = r;
      let o = []; for (let k = 0; k < 480; k++) { E.frame(1 / 60); if (k % 20 === 19) o = o.concat(E.overlaps()); } return o.concat(E.overlaps()); }, [spinSave({ coins: 100 }), toSpin], true);
    // 0.8.17: no result card; the prize rises out of the tray with its name and what it does, then flies to the bag (the
    // title gives way to the bag chip); taps stop the reels one by one
    await check('spin-booster', ([sv, ts]) => { const E = __egg; eval(sv); eval(ts); const r = Math.random; let n = 0; Math.random = () => (n++ === 0 ? 0.15 : 0.5); E.press('spin:go'); Math.random = r;
      let o = []; for (let k = 0; k < 540; k++) { E.frame(1 / 60); if (k % 20 === 19) o = o.concat(E.overlaps()); } return o; }, [spinSave({}), toSpin], true);
    await check('spin-tapstop', ([sv, ts]) => { const E = __egg; eval(sv); eval(ts); const r = Math.random; let n = 0; Math.random = () => (n++ === 0 ? 0.3 : 0.5); E.press('spin:go'); Math.random = r;
      let o = []; for (let k = 0; k < 400; k++) { E.frame(1 / 60); if (k === 40 || k === 60 || k === 80) E.press('spin:skip'); if (k % 20 === 19) o = o.concat(E.overlaps()); }
      return E.G.spin.st === 'spinning' ? o.concat([['taps on the reels', 'did not stop them']]) : o; }, [spinSave({}), toSpin], true);
    await check('spin-failrow', ([sv, tp]) => { const E = __egg; eval(sv); E.start(10); for (let k = 0; k < 20; k++) E.frame(1 / 60); eval(tp); E.step(14); E.showResult('fail'); for (let k = 0; k < 120; k++) E.frame(1 / 60); const o = E.overlaps(); const S = E.G.fscroll; if (S && S.max > 0) { S.y = S.max; S.v = 0; E.frame(1 / 60); return o.concat(E.overlaps()); } return o; }, [spinSave({}), toPlay], true);
    await check('leave-card', ([sv, tp]) => { const E = __egg; eval(sv); E.start(10); for (let k = 0; k < 20; k++) E.frame(1 / 60); eval(tp); for (let k = 0; k < 20; k++) E.frame(1 / 60); E.press('pause'); for (let k = 0; k < 30; k++) E.frame(1 / 60); const o = E.overlaps(); E.press('levels'); for (let k = 0; k < 30; k++) E.frame(1 / 60);
      const o2 = E.G.leaveAsk ? E.overlaps() : [['the leaving card', 'did not show with a spin waiting']]; return o.concat(o2); }, [spinSave({}), toPlay], true);
    await check('reminder-ask', (sv) => { const E = __egg; eval(sv); E.G.screen = 'title'; E.press('levels'); for (let k = 0; k < 30; k++) E.frame(1 / 60); E.G.remAsk = { spins: 1, spinLeft: 0 }; for (let k = 0; k < 30; k++) E.frame(1 / 60); return E.overlaps(); }, spinSave({}), true);
    // 0.8.17: reminders off: the bell chip on the home and the map; the question when Android will not ask; Settings'
    // Reminders card in its three states (a stand-in for the app's bridge, removed after)
    const fakeApp = (st, inf) => `window.__nst = '${st}'; window.EggApp = { notifyAsk() {}, notifyState() { return window.__nst; }, notifyAt() {}, notifyMore() {}, notifyCancel() {}, openedFrom() { return ''; }, notifyTest() {}, notifySettings() {}, notifyInfo() { return '${JSON.stringify(inf || { chan: 'default', battery: 'saver', strict: true, maker: 'vivo', sdk: 34, plan: [] })}'; } };`;
    await check('reminder-chip', ([sv, fa]) => { const E = __egg; eval(fa); eval(sv); E.G.offerTried = true; E.G.screen = 'title'; E.G.screenT = 5; for (let k = 0; k < 20; k++) E.frame(1 / 60); const o = E.overlaps(), h = E.ui.buttons.some((b) => b.id === 'rem:chip'); E.press('levels'); for (let k = 0; k < 40; k++) E.frame(1 / 60); const m = E.ui.buttons.some((b) => b.id === 'rem:chip'); return o.concat(E.overlaps(), h && m ? [] : [['the bell chip', 'missing on the home or the map']]); }, [spinSave({}), fakeApp('ask')], true);
    await check('reminder-ask-sys', ([sv, fa]) => { const E = __egg; eval(fa); eval(sv); E.G.offerTried = true; E.press('levels'); for (let k = 0; k < 30; k++) E.frame(1 / 60); E.press('rem:chip'); for (let k = 0; k < 60; k++) E.frame(1 / 60); const o = E.overlaps(); E.G.remAsk = null; return o; }, [spinSave({}), fakeApp('never')], true);
    for (const [st, ok] of [['ask', 0], ['granted', 1], ['off', 1]]) await check('settings-reminders-' + st, ([sv, fa, ok]) => { const E = __egg; eval(fa); eval(sv); if (ok) { E.save.eng = E.save.eng || {}; E.save.eng.her = { ok: 1 }; } E.G.screen = 'title'; E.press('settings'); for (let k = 0; k < 30; k++) E.frame(1 / 60); const o = E.overlaps(), has = E.ui.buttons.some((b) => b.id === 'set:remtest'); E.press('set:close'); delete window.EggApp; return o.concat(has ? [] : [['the Reminders card', 'has no test button']]); }, [spinSave({}), fakeApp(st), ok], st === 'granted');
    // 0.8.17 the Pacer's "Adaptive help" switch with the app's Notifications card above it: the page at the top, then scrolled down step by step
    await check('pacer-settings-rem', ([sv, fa]) => { const E = __egg; eval(fa); eval(sv); E.save.eng = E.save.eng || {}; E.save.eng.her = { ok: 1 }; E.G.screen = 'title'; E.press('settings'); for (let k = 0; k < 30; k++) E.frame(1 / 60); const o = E.overlaps(), S = E.G.setpage; let seen = E.ui.buttons.some((b) => b.id === 'set:adapt');
      for (let y = 0; S && y <= S.max + 1; y += Math.max(60, innerHeight * 0.4)) { S.y = Math.min(S.max, y); S.v = 0; S.to = null; E.frame(1 / 60); o.push(...E.overlaps()); seen = seen || E.ui.buttons.some((b) => b.id === 'set:adapt'); }
      E.press('set:close'); delete window.EggApp; return o.concat(seen ? [] : [['Adaptive help', 'never shown']]); }, [spinSave({}), fakeApp('granted')], true);
    await check('boosters-page2', (sv) => { const E = __egg; eval(sv); E.start(11); for (let k = 0; k < 40; k++) E.frame(1 / 60); const has = E.ui.buttons.some((b) => b.id === 'strip:more'); const o = E.overlaps(); E.press('strip:more'); for (let k = 0; k < 10; k++) E.frame(1 / 60);
      return has ? o.concat(E.overlaps()) : o.concat([['eight boosters owned', 'and no next-page tile on the row']]); }, spinSave({ owned: { stone: 2, golden: 1, time: 1, rewind: 1, sponge: 2, nest: 1, snips: 1, scare: 2 } }), true);
    await check('scarecrow', (tp) => { const E = __egg; E.press('boost:scare'); eval(tp); for (let k = 0; k < 120; k++) E.frame(1 / 60); const on = E.G.sim && E.G.sim.scareT > 0; const o = E.overlaps(); return on ? o : o.concat([['the Scarecrow', 'was picked and does not stand in the level']]); }, toPlay, true);
    await check('ticket-shop', (sv) => { const E = __egg; eval(sv); E.G.screen = 'title'; E.press('shop'); for (let k = 0; k < 30; k++) E.frame(1 / 60); let o = E.overlaps(); for (const t of ['tab:skins', 'tab:hens']) { E.press(t); for (let k = 0; k < 30; k++) E.frame(1 / 60); o = o.concat(E.overlaps()); } return o; }, spinSave({ coupon: 1 }), true);
    // 0.8.16: the home page with Unlock all in its button block (and the bank egg), the shop's header with a five-digit
    // purse (the title whole), the boss treasure page, a shop item's sheet
    await check('home-unlock', (sv) => { const E = __egg; eval(sv); E.save.wallet.bank = 60; Object.defineProperty(E.ads, 'canBuyPremium', { get: () => true, configurable: true }); E.G.screen = 'title'; E.G.screenT = 5; for (let k = 0; k < 10; k++) E.frame(1 / 60);
      const o = E.overlaps(), has = E.ui.buttons.some((b) => b.id === 'home:premium'); Object.defineProperty(E.ads, 'canBuyPremium', { get: () => false, configurable: true }); return has ? o : o.concat([['Unlock all', 'is not on the home page']]); }, spinSave({}), true);
    await check('rich-shop', (sv) => { const E = __egg; eval(sv); E.G.screen = 'title'; E.press('shop'); for (let k = 0; k < 30; k++) E.frame(1 / 60); const o = E.overlaps(); E.press('tile:' + (E.ui.buttons.find((b) => /^tile:(skin|hen|item|boost)/.test(b.id)) || { id: 'tile:skin:galaxy' }).id.slice(5)); for (let k = 0; k < 30; k++) E.frame(1 / 60); const o2 = o.concat(E.overlaps()); E.G.detail = null; return o2; }, spinSave({ coins: 60000 }), true);
    await check('treasure', (sv) => { const E = __egg; eval(sv); E.G.screen = 'title'; E.press('levels'); for (let k = 0; k < 30; k++) E.frame(1 / 60); E.G.treasure = { id: 12, t: E.G.t, openedAt: null }; for (let k = 0; k < 40; k++) E.frame(1 / 60); const o = E.overlaps(); E.G.treasure = { id: 15, t: E.G.t, openedAt: null }; for (let k = 0; k < 40; k++) E.frame(1 / 60); const o2 = o.concat(E.overlaps()); E.G.treasure = null; return o2; }, spinSave({}), true);
    // 0.8.17 the reward landing (ui/landing.js) and the prize pop: every reward page with its purse and bag chips,
    // sampled while the coins fly; a video's prize popping (earned, and the sad hen when it was not); the treasure
    // opening on its page; the win page's reveals; the level card's booster strip calling for a tap
    const runs = (n) => `(() => { let o = []; for (let k = 0; k < ${n}; k++) { __egg.frame(1 / 60); if (k % 20 === 19) o = o.concat(__egg.overlaps()); } return o; })()`;
    await check('land-chest', ([sv, rn]) => { const E = __egg; eval(sv); E.G.screen = 'title'; E.press('levels'); for (let k = 0; k < 30; k++) E.frame(1 / 60); E.press('chest'); if (!E.G.got) return [['the star chest', 'did not open']]; const o = eval(rn); E.press('got:tap'); E.press('got:tap'); return o; }, [spinSave({}), runs(160)], true);
    await check('land-daily', ([sv, rn]) => { const E = __egg; eval(sv); E.save.wallet.daily = ''; E.G.screen = 'title'; E.G.screenT = 5; E.press('home:chest'); if (!E.G.got) return [['the daily chest', 'did not open']]; const o = eval(rn); E.press('got:tap'); E.press('got:tap'); return o; }, [spinSave({}), runs(160)], true);
    await check('land-video', async ([sv, rn]) => { const E = __egg; eval(sv); const r0 = E.ads.rewarded; E.ads.rewarded = async () => true; E.G.screen = 'title'; E.press('shop'); for (let k = 0; k < 20; k++) E.frame(1 / 60); E.save.adClaim = 0; await E.press('ad:coins'); E.ads.rewarded = r0; if (!E.G.got) return [['the free-coins video', 'showed no YOU GOT!']]; const o = eval(rn); E.press('got:tap'); E.press('got:tap'); return o; }, [spinSave({}), runs(150)], true);
    await check('land-treasure', ([sv, rn]) => { const E = __egg; eval(sv); E.G.screen = 'title'; E.press('levels'); for (let k = 0; k < 30; k++) E.frame(1 / 60); E.G.treasure = { id: 12, t: E.G.t, openedAt: null }; for (let k = 0; k < 20; k++) E.frame(1 / 60); let o = E.overlaps(); E.press('tr:open'); o = o.concat(eval(rn)); E.press('tr:close'); E.press('tr:close'); return o; }, [spinSave({}), runs(120)], true);
    await check('land-reveal', ([sv, rn]) => { const E = __egg; eval(sv); E.start(10); for (let k = 0; k < 20; k++) E.frame(1 / 60); E.showResult('win', 3, null, 0, { treasure: { id: 12, coins: 150, booster: 'stone', charges: 2 }, gift: { kind: 'boost', id: 'stone', name: 'Stone Shell' }, hot: 0, hotB: [] }); return eval(rn); }, [spinSave({}), runs(560)], true);
    await check('pop-booster', async ([sv, rn]) => { const E = __egg; eval(sv); const r0 = E.ads.rewarded; E.ads.rewarded = async () => true; E.start(11); for (let k = 0; k < 40; k++) E.frame(1 / 60); await E.press('adboost'); E.ads.rewarded = r0; return E.prizePop.active() ? eval(rn) : [['the free booster video', 'showed nothing']]; }, [spinSave({}), runs(80)], true);
    await check('pop-sad', async ([sv, rn]) => { const E = __egg; eval(sv); const r0 = E.ads.rewarded; E.ads.rewarded = async () => false; E.start(11); for (let k = 0; k < 40; k++) E.frame(1 / 60); await E.press('adboost'); E.ads.rewarded = r0; return E.prizePop.state && E.prizePop.state.sad ? eval(rn) : [['a closed video', 'said nothing']]; }, [spinSave({}), runs(60)], true);
    // 0.8.17: every pay page (the stage, the perk tiles or the amount, the buy button and its sticker), a tile's detail
    // in place, the unlock party (the show, then its end with PLAY after the coins' reveal), Get more's pack row, and a
    // chick sheet the purse cannot pay (the covering pack inline)
    for (const sku of ['eggscape_premium', 'starter_nest', 'eggscape_collector', 'bundle_helper', 'egg_bank', 'coins_250', 'coins_3300']) {
      await check(`iap-page-${sku}`, ([sv, sku]) => { const E = __egg; eval(sv); E.save.wallet.bank = 900; E.G.screen = 'title'; E.press('shop'); for (let k = 0; k < 10; k++) E.frame(1 / 60); E.G.detail = 'iap:' + sku; for (let k = 0; k < 50; k++) E.frame(1 / 60);
        const o = E.overlaps(), has = E.ui.buttons.some((b) => b.id === 'iap:' + sku); E.press('pay:tip:0'); E.frame(1 / 60); const o2 = o.concat(E.overlaps()); E.G.detail = null; return has ? o2 : o2.concat([['pay page', 'no buy button']]); }, [spinSave({}), sku], sku === 'eggscape_premium' || sku === 'coins_250');
    }
    await check('iap-party-show', (sv) => { const E = __egg; eval(sv); E.G.screen = 'title'; E.press('shop'); for (let k = 0; k < 10; k++) E.frame(1 / 60); E.G.detail = 'iap:eggscape_premium'; E.frame(1 / 60); window.__eggGrant('eggscape_premium', 'qa' + Math.random());
      let o = []; for (let k = 0; k < 150; k++) { E.frame(1 / 60); if (k % 30 === 29) o = o.concat(E.overlaps()); } return E.G.party ? o : o.concat([['the unlock party', 'did not start']]); }, spinSave({}), true);
    await check('iap-party-end', () => { const E = __egg; for (let k = 0; k < 120; k++) E.frame(1 / 60); E.press('got:tap'); E.frame(1 / 60); E.press('got:tap'); for (let k = 0; k < 40; k++) E.frame(1 / 60);
      const o = E.overlaps(), has = E.ui.buttons.some((b) => b.id === 'party:play'); E.G.party = null; E.G.got = null; return has ? o : o.concat([['the unlock party', 'no PLAY at its end']]); }, 0, true);
    await check('chickbuy-short', (sv) => { const E = __egg; eval(sv); Object.defineProperty(E.ads, 'moneyShop', { get: () => true, configurable: true }); E.start(11); for (let k = 0; k < 40; k++) E.frame(1 / 60); E.G.chickBuy = 'decoy'; for (let k = 0; k < 30; k++) E.frame(1 / 60); const o = E.overlaps(); E.G.chickBuy = null; Object.defineProperty(E.ads, 'moneyShop', { get: () => false, configurable: true }); return o; }, spinSave({ coins: 120 }), true);
    await check('strip-attn', (sv) => { const E = __egg; eval(sv); E.G.stripVisits = 0; E.start(11); let o = []; for (let k = 0; k < 150; k++) { E.frame(1 / 60); if (k % 25 === 24) o = o.concat(E.overlaps()); } return o; }, spinSave({ owned: { stone: 2 } }), true);
    // 0.8.17 rewards that waited for a connection: the gift on home, the mark on the map, their page; and a video button
    // while no video can be shown (its offline state, the one line a tap says)
    const waitSv = (sv) => `${sv}; __egg.save.waiting = { list: [{ kind: 'coins', n: 52, key: 'double:7:1' }, { kind: 'spin', n: 1, key: 'spin:d:0' }, { kind: 'coins', n: 1500, key: 'free:d:1' }] };`;
    await check('wait-home', (sv) => { const E = __egg; eval(sv); E.G.screen = 'title'; E.G.screenT = 5; for (let k = 0; k < 30; k++) E.frame(1 / 60); const has = E.ui.buttons.some((b) => b.id === 'wait:open'); return has ? E.overlaps() : [['the gift', 'is not on the home page']]; }, waitSv(spinSave({})), true);
    await check('wait-map', (sv) => { const E = __egg; eval(sv); E.G.screen = 'title'; E.press('levels'); for (let k = 0; k < 40; k++) E.frame(1 / 60); const has = E.ui.buttons.some((b) => b.id === 'wait:open'); return has ? E.overlaps() : [['the gift mark', 'is not on the map']]; }, waitSv(spinSave({})), true);
    await check('wait-page', (sv) => { const E = __egg; eval(sv); E.G.screen = 'title'; E.press('levels'); for (let k = 0; k < 20; k++) E.frame(1 / 60); E.press('wait:open'); for (let k = 0; k < 30; k++) E.frame(1 / 60); const o = E.overlaps(), n = E.ui.buttons.filter((b) => /^wait:go:/.test(b.id)).length; E.press('wait:close'); return n === 2 ? o : o.concat([['the waiting page', `shows ${n} Watch buttons`]]); }, waitSv(spinSave({})), true);
    await check('video-off', async ([sv, rn]) => { const E = __egg; eval(sv); const d0 = Object.getOwnPropertyDescriptor(E.ads, 'videoOk'); Object.defineProperty(E.ads, 'videoOk', { get: () => false, configurable: true }); E.start(10); for (let k = 0; k < 20; k++) E.frame(1 / 60); E.showResult('win', 3, null, 0, {}); for (let k = 0; k < 400; k++) E.frame(1 / 60); let o = E.overlaps(); const has = E.ui.buttons.some((b) => b.id === 'double'); if (has) { await E.press('double'); o = o.concat(eval(rn)); } Object.defineProperty(E.ads, 'videoOk', d0); return has ? o : o.concat([['Double coins', 'is not on the win page']]); }, [spinSave({}), runs(40)], true);
    // 0.8.17 extras: the combo album (none, some with new finds, all with the prize waiting), the daily chest's "Opens in"
    // on home and in the shop, the bottom of Settings, the privacy page, Reset progress's two steps (held, not finished)
    const combos = (ids, shown) => `(() => { const s = __egg.save; for (const id of ${JSON.stringify(ids)}) { s.seen['combo_' + id] = 1; if (${JSON.stringify(shown)}.includes(id)) s.seen['album:' + id] = 1; } })()`;
    const ALL7 = ['shatter', 'sweep', 'cannon', 'twister', 'magnet', 'bait', 'stink'];
    for (const [lab, ids, shown] of [['album-empty', [], []], ['album-some', ['shatter', 'cannon', 'twister'], ['shatter']], ['album-all', ALL7, ALL7]]) {
      await check(lab, async ([sv, cb, lab]) => { const E = __egg; if (E.G.album) await E.press('xs:alback'); eval(sv); eval(cb); E.G.screen = 'title'; await E.press('extras'); for (let k = 0; k < 40; k++) E.frame(1 / 60); let o = E.overlaps(); const S0 = E.G.escroll; S0.y = S0.max; S0.to = null; for (let k = 0; k < 5; k++) E.frame(1 / 60); o = o.concat(E.overlaps()); const row = E.ui.buttons.some((b) => b.id === 'xs:album');
        await E.press('xs:album'); for (let k = 0; k < 150; k++) { E.frame(1 / 60); if (k % 30 === 29) o = o.concat(E.overlaps()); } const S = E.G.escroll; S.y = S.max; S.to = null; for (let k = 0; k < 5; k++) E.frame(1 / 60); o = o.concat(E.overlaps());
        const prize = E.ui.buttons.some((b) => b.id === 'xs:prize');
        return o.concat(row ? [] : [['the Extras page', 'has no album row']], (lab === 'album-all') === prize ? [] : [['the album prize', prize ? 'offered before the album is full' : 'not offered on a full album']]); }, [spinSave({}), combos(ids, shown), lab], true);
    }
    await check('chest-countdown', async (sv) => { const E = __egg; if (E.G.album) await E.press('xs:alback'); eval(sv); E.save.wallet.daily = ''; E.G.screen = 'title'; E.G.screenT = 5; await E.press('home:chest'); E.press('got:tap'); E.press('got:tap'); E.G.got = null; for (let k = 0; k < 30; k++) E.frame(1 / 60);
      let o = E.overlaps(); const tag = !!E.save.wallet.daily && E.ui.rects.some((r) => r.tag === 'title:chesttag');
      await E.press('shop'); for (let k = 0; k < 10; k++) E.frame(1 / 60); await E.press('tab:deals'); E.G.sscroll.y = 0; E.G.sscroll.to = null; for (let k = 0; k < 20; k++) E.frame(1 / 60); o = o.concat(E.overlaps()); await E.press('back');
      return tag ? o : o.concat([['the daily chest', 'shows no "Opens in" tag after the claim']]); }, spinSave({}), true);
    await check('settings-bottom', async (sv) => { const E = __egg; eval(sv); E.G.screen = 'title'; await E.press('settings'); for (let k = 0; k < 20; k++) E.frame(1 / 60); const S = E.G.setpage; S.y = S.max; S.to = null; for (let k = 0; k < 10; k++) E.frame(1 / 60);
      let o = E.overlaps(); const ids = E.ui.buttons.map((b) => b.id), miss = ['xs:privacy', 'xs:reset', 'xs:sid'].filter((id) => !ids.includes(id)); await E.press('xs:sid'); for (let k = 0; k < 8; k++) E.frame(1 / 60); o = o.concat(E.overlaps());
      return miss.length ? o.concat([['Settings bottom', 'missing ' + miss.join(', ')]]) : o; }, spinSave({}), true);
    await check('privacy', async () => { const E = __egg; for (let k = 0; k < 100; k++) E.frame(1 / 60); await E.press('xs:privacy'); for (let k = 0; k < 30; k++) E.frame(1 / 60); let o = E.overlaps(); const S = E.G.setpage; S.y = S.max; S.to = null; for (let k = 0; k < 10; k++) E.frame(1 / 60); o = o.concat(E.overlaps()); const done = E.ui.buttons.some((b) => b.id === 'xs:subback'); return done ? o : o.concat([['the privacy page', 'has no way back']]); }, 0, true);
    await check('reset-1', async () => { const E = __egg; if (E.G.setSub) await E.press('xs:subback'); await E.press('xs:reset'); for (let k = 0; k < 40; k++) E.frame(1 / 60); const o = E.overlaps(), S = E.G.setpage; S.y = S.max; S.to = null; for (let k = 0; k < 5; k++) E.frame(1 / 60); o.push(...E.overlaps()); const ids = E.ui.buttons.map((b) => b.id); return ids.includes('xs:next') && ids.includes('xs:subback') ? o : o.concat([['the reset card', 'misses its buttons']]); }, 0, true);
    await check('reset-2', async () => { const E = __egg; await E.press('xs:next'); for (let k = 0; k < 20; k++) E.frame(1 / 60); let o = E.overlaps(); E.ui.pressedId = 'xs:hold'; for (let k = 0; k < 50; k++) E.frame(1 / 60); o = o.concat(E.overlaps()); E.ui.pressedId = null;
      const still = E.save.unlocked === 12 && E.G.setSub && E.G.setSub.kind === 'reset2'; for (let k = 0; k < 60; k++) E.frame(1 / 60); const drained = E.G.setSub && E.G.setSub.k === 0;
      return o.concat(still ? [] : [['a short hold', 'reset the game']], drained ? [] : [['letting go', 'did not drain the ring']]); }, 0, true);
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
