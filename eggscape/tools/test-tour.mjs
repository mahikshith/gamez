// The first levels' tour (src/tour.js): node tools/test-tour.mjs   (exits 1 on a failure)
// Each step happens once; nothing of the shop before level 3 is won; never in a busy moment of play; the free taste
// carries no price; the Brain's gate says a tour step is never money.
import * as TR from '../src/tour.js';
import * as BR from '../src/brain.js';
import * as E from '../src/economy.js';
import { readFileSync } from 'fs';
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL', msg); } else console.log('ok  ', msg); };
const mk = (stars = {}, o = {}) => ({ unlocked: Object.keys(stars).length + 1, stars, seen: {}, offers: { sessions: 1 }, dir: { recent: [], att: {}, spent: { all: 0 } }, wallet: { ...E.defaultWallet(), coins: 120 }, ...o });
const QUIET = { screen: 'play', levelId: 2, won1: true, quiet: true };

// ---- the pause button: after level 1 is won, a quiet spell of play, once
{
  const s = mk({ 1: 3 });
  ok(!TR.tourMay(mk(), 'pauseBtn', { ...QUIET, won1: false, levelId: 1 }), 'pause button: not before level 1 is won');
  ok(!TR.tourMay(s, 'pauseBtn', { ...QUIET, quiet: false }), 'pause button: never while the player is busy (hands on)');
  ok(!TR.tourMay(s, 'pauseBtn', { ...QUIET, busy: true }), 'pause button: never over a tip, a sheet or the fuse intro');
  ok(!TR.tourMay(s, 'pauseBtn', { ...QUIET, screen: 'levels' }), 'pause button: only in play');
  ok(TR.tourMay(s, 'pauseBtn', QUIET), 'pause button: the first quiet spell after level 1 is won');
  TR.tourMark(s, 'pauseBtn');
  ok(!TR.tourMay(s, 'pauseBtn', QUIET) && TR.tourSeen(s, 'pauseBtn'), 'pause button: once only');
}
// ---- the pause page: the first time it opens, once
{
  const s = mk();
  ok(TR.tourMay(s, 'pausePage', { screen: 'pause', levelId: 1 }), 'pause page: from level 1 on, the first time');
  ok(!TR.tourMay(s, 'pausePage', { screen: 'play', levelId: 1 }) && !TR.tourMay(s, 'pausePage', { screen: 'pause', levelId: 0 }), 'pause page: only on a road level\'s pause page');
  TR.tourMark(s, 'pausePage');
  ok(!TR.tourMay(s, 'pausePage', { screen: 'pause', levelId: 4 }), 'pause page: once only');
  const A = TR.tourPageAt(0.1), B = TR.tourPageAt(0.4), C = TR.tourPageAt(1.1), D = TR.tourPageAt(1.8), Z = TR.tourPageAt(2.7);
  ok(A.on.length === 0 && B.on[0] === 'rs' && C.on[0] === 'snd' && D.on[0] === 'go' && Z.done, 'pause page: ring speed, sound, Resume in turn, done in under 3 s');
  ok(TR.TOUR.pageDelay + TR.TOUR.pageLen <= 3, 'pause page: about 2 seconds in all');
  ok(TR.tourPageAt(1, true).on.length === 3, 'pause page, Calm motion: the three at once, steady');
  ok(TR.tourPageAt(0.4, false, { rs: true, snd: false, go: true }).on[0] === 'rs' && TR.tourPageAt(1.1, false, { rs: true, snd: false, go: true }).on[0] === 'go', 'pause page: a missing section (no sound switches) is skipped');
}
// ---- the shop: nothing before level 3 is won (any mode), never in play, once
{
  for (const st of [{}, { 1: 3 }, { 1: 3, 2: 3 }, { 1: 3, 2: 3, e4: 3 }]) for (const screen of ['levels', 'title', 'pause', 'play', 'intro'])
    ok(!TR.tourMay(mk(st), 'shop', { screen, levelId: 3 }), `shop: nothing before level 3 is won (stars ${JSON.stringify(st)}, ${screen})`);
  const s = mk({ 1: 3, 2: 3, 3: 1 });
  ok(TR.tourMay(s, 'shop', { screen: 'levels' }) && TR.tourMay(s, 'shop', { screen: 'pause', levelId: 4 }), 'shop: once level 3 is won, on the map or the pause page');
  ok(TR.tourMay(mk({ 1: 3, 2: 3, e3: 1 }), 'shop', { screen: 'levels' }) && TR.tourMay(mk({ 1: 3, 2: 3, h3: 2 }), 'shop', { screen: 'title' }), 'shop: level 3 won in Easy or Hard counts too');
  ok(!TR.tourMay(s, 'shop', { screen: 'play', levelId: 4, quiet: true }) && !TR.tourMay(s, 'shop', { screen: 'intro', levelId: 4 }), 'shop: never in play, never on the level card');
  ok(!TR.tourMay(s, 'shop', { screen: 'levels', busy: true }), 'shop: never over a sheet, the hen\'s trip or another hand');
  TR.tourMark(s, 'shop');
  ok(!TR.tourMay(s, 'shop', { screen: 'levels' }) && !TR.tourMay(s, 'shop', { screen: 'pause', levelId: 9 }), 'shop: once only');
}
// ---- the free taste: an egg first, never one owned or tried, only the key (no price)
{
  const items = [{ key: 'hen:farmer', owned: false, canTry: true }, { key: 'skin:gold', owned: true, canTry: false }, { key: 'skin:dino', owned: false, canTry: false }, { key: 'skin:speckled', owned: false, canTry: true, price: 120 }];
  const t = TR.shopTaste(items);
  ok(t === 'skin:speckled', 'free taste: the first egg that may be tried free');
  ok(typeof t === 'string' && !/\d/.test(t.replace(/^\w+:/, '')), 'free taste: only its key goes out (no price)');
  ok(TR.shopTaste(items.slice(0, 3)) === 'hen:farmer' && TR.shopTaste([]) === null, 'free taste: else an outfit, else none');
}
// ---- the Brain: a tour step is never money; in play only a quiet spell
{
  const s = mk({ 1: 3, 2: 3, 3: 3 });
  for (const m of ['home', 'win', 'fail', 'intro', 'pause', 'play']) { const g = BR.gate(s, m, { tour: true, quiet: true }); ok(g.money === false && g.nudge === true, `gate: a tour step at ${m} is never money`); }
  ok(BR.gate(s, 'play', { tour: true }).nudge === false, 'gate: in play a tour step waits for a quiet spell');
  ok(BR.gate(s, 'play').nudge === false && BR.gate(mk({ 1: 3 }), 'home').nudge === false, 'gate: without the tour flag nothing changed (play, the first levels)');
}
// ---- the drawing names no price (main.js: the tour's functions)
{
  const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  for (const fn of ['tourPauseHud', 'tourPausePage', 'drawShopTour']) {
    const i = src.indexOf('function ' + fn + '('), j = src.indexOf('\n}\n', i), body = src.slice(i, j);
    ok(i > 0 && !/price|coins|iap|offer|sku|buy/i.test(body), `${fn}: shows where things are, never a price or an offer`);
    ok(/TR\.tourMay|G\.ppTour/.test(body), `${fn}: asks tour.js (and through it the Brain's gate)`);
  }
}
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
