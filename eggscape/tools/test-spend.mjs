// The spend moments (src/brain.js spendPick / spendNote, src/ui/spendfx.js): node tools/test-spend.mjs   (exits 1 on a failure)
import * as BR from '../src/brain.js';
import * as E from '../src/economy.js';
import * as FX from '../src/ui/spendfx.js';
import { createPurse } from '../src/ui/purse.js';
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL', msg); } else console.log('ok  ', msg); };
const DAY = 864e5, T0 = Date.UTC(2026, 10, 2, 9);
const won3 = { 1: 3, 2: 3, 3: 3, 4: 2, 5: 3, 6: 1, 7: 2, 8: 3, 9: 3, 10: 2, 11: 3, 12: 2, 13: 3 };
const mk = (o = {}) => ({ unlocked: 14, stars: won3, dir: { recent: [], att: {}, spent: { all: 0, by: {} }, hot: 0 }, offers: { sessions: 4, ads: 2, firstDay: T0 - 20 * DAY }, ...o, wallet: { ...E.defaultWallet(), coins: 300, ...(o.wallet || {}) } });
const levels = (s, n) => { for (let i = 0; i < n; i++) BR.note(s, 'level'); };
const afford = { id: 'afford', key: 'skin:dino', price: 150 }, strip = { id: 'strip', key: 'strip:14:stone', price: 60 };
const pick = (s, m, c, visit, now = T0) => BR.spendPick(s, m, c, { now, visit }).pick;

// ---- when a moment may play
{
  ok(!pick(mk({ stars: {} }), 'home', [afford], 'a'), 'nothing before level 3 is won');
  ok(!pick(mk({ stars: { 1: 3, 2: 3 } }), 'home', [afford], 'a'), '... not even with levels 1 and 2 won');
  ok(pick(mk(), 'home', [afford], 'a'), 'level 3 won, a regular player at home: one plays');
  ok(!pick(mk(), 'play', [afford], 'a'), 'never during play');
  ok(BR.spendPick(mk(), 'play', [afford], { now: T0 }).why === 'never during play', '... and the log says why');
  ok(!pick(mk({ unlocked: 4 }), 'home', [afford], 'a'), 'nothing for a new player (the gate)');
  ok(!pick(mk({ offers: { sessions: 1 } }), 'home', [afford], 'a'), 'nothing in the very first session');
  ok(BR.gate(mk(), 'home', { now: T0 }).spend === true && BR.gate(mk(), 'play', { now: T0 }).spend === false, 'the gate answers spend');
  const p = mk(); BR.note(p, 'buy', { money: true }, T0);
  ok(!pick(p, 'home', [afford], 'a', T0 + 3600e3) && pick(p, 'home', [afford], 'a', T0 + 25 * 3600e3), 'a real-money purchase: a day of rest');
}
// ---- one a visit, and the order
{
  const s = mk();
  const P = pick(s, 'fail', [afford, { id: 'save', key: 'boost:stone', price: 60 }, strip], 'fail:1');
  ok(P && P.id === 'save', 'on a fail card the saving booster leads');
  BR.spendNote(s, 'show', { ...P, visit: 'fail:1' }, T0);
  ok(!pick(s, 'fail', [strip], 'fail:1'), 'one moment a visit');
  BR.spendNote(s, 'take', P, T0);
  ok(pick(s, 'intro', [strip], 'intro:2'), 'taken: the next visit may have one');
  ok(!pick(s, 'fail', [P], 'fail:3'), 'the same thing is not shown twice');
  const L = mk({ wallet: { skins: ['classic', 'dino', 'lava'], henSkins: ['classic', 'santa'] } });
  ok(pick(L, 'home', [{ id: 'afford', key: 'chick:bomb', price: 200, taste: 'power' }, { id: 'afford', key: 'skin:candy', price: 200, taste: 'looks' }], 'h').key === 'skin:candy', 'a collector of looks sees a look first');
}
// ---- the back-off
{
  const s = mk();
  const show = (c, v) => { const P = pick(s, 'home', [c], v); if (P) BR.spendNote(s, 'show', { ...P, visit: v }, T0); return P; };
  ok(show({ id: 'afford', key: 'k1' }, 'v1'), 'first moment plays');
  BR.spendNote(s, 'no', {}, T0);
  ok(!show({ id: 'afford', key: 'k2' }, 'v2'), 'a "no": not again in the same level');
  levels(s, 1);
  ok(show({ id: 'afford', key: 'k2' }, 'v3'), 'one level later: ok');
  BR.spendNote(s, 'no', {}, T0);
  levels(s, 1);
  ok(!show({ id: 'afford', key: 'k3' }, 'v4'), 'two "no" in a row: two levels');
  levels(s, 1);
  ok(show({ id: 'afford', key: 'k3' }, 'v5'), '... and then ok');
  BR.spendNote(s, 'no', {}, T0); BR.spendNote(s, 'no', {}, T0); // (a second "no" on the same moment counts once)
  levels(s, 3);
  ok(!show({ id: 'afford', key: 'k4' }, 'v6'), 'three "no": four levels');
  levels(s, 1);
  const P = show({ id: 'afford', key: 'k4' }, 'v7');
  ok(P, '... and then ok');
  BR.spendNote(s, 'buy', P, T0);
  ok(!show({ id: 'afford', key: 'k5' }, 'v8'), 'a coin purchase from a moment: they rest');
  levels(s, BR.SPEND.restLevels);
  ok(show({ id: 'afford', key: 'k5' }, 'v9'), `... ${BR.SPEND.restLevels} levels`);
  ok(BR.brainState(s).fx.noes === 0, 'a purchase forgets the "no"s');
  const d = mk();
  for (let i = 0; i < 10; i++) { const Q = pick(d, 'home', [{ id: 'afford', key: 'd' + i }], 'w' + i); if (Q) { BR.spendNote(d, 'show', { ...Q, visit: 'w' + i }, T0); BR.spendNote(d, 'take', Q, T0); } }
  ok(BR.brainState(d).fx.n === BR.SPEND.perDay, `at most ${BR.SPEND.perDay} a day`);
  ok(pick(d, 'home', [{ id: 'afford', key: 'next' }], 'x', T0 + DAY), 'the next day: again');
}
// ---- a broken save
{
  const s = mk({ brain: { fx: { last: 5, seen: 'x', noes: 99, restAt: 'q' } } });
  ok(pick(s, 'home', [afford], 'a'), 'a broken spend record is made safe');
  ok(BR.brainState(s).fx.noes === 4 || BR.brainState(s).fx.noes <= 4, 'noes are capped');
}
// ---- the animation kit: calm and low graphics show the end state, every animation is short, a tap skips
{
  let t = 0, calm = false, low = false;
  const fx = FX.createSpendFx({ clock: () => t, calm: () => calm, low: () => low, sound: () => {}, buzz: () => {} });
  for (const k of Object.keys(FX.FX_LEN)) ok(FX.FX_LEN[k] <= 1.5, `${k}: ${FX.FX_LEN[k]} s, under 1.5 s`);
  fx.play({ id: 'afford', kind: 'peek', slot: 'shop', key: 'skin:dino', price: 150, scr: 'levels', seq: 1 });
  ok(fx.k('shop') === 0 && fx.k('fail') < 0, 'a moment runs on its own control only');
  t = 0.5; ok(fx.k('shop') > 0 && fx.k('shop') < 1, 'it moves');
  fx.skip(); ok(fx.k('shop') === 1, 'a tap: the end state at once');
  t = 0.5 + FX.HOLD + 1; fx.tick('levels', 1); ok(!fx.on('shop'), 'it goes by itself (no button to close)');
  calm = true; t = 10; fx.play({ id: 'afford', kind: 'peek', slot: 'shop', scr: 'levels', seq: 2 });
  ok(fx.k('shop') === 1, 'calm: the end state, still');
  calm = false; low = true; fx.play({ id: 'afford', kind: 'peek', slot: 'shop', scr: 'levels', seq: 3 });
  ok(fx.k('shop') === 0 && fx.cheap(), 'low graphics: it plays, the cheap way');
  low = false; fx.play({ id: 'afford', kind: 'peek', slot: 'shop', scr: 'levels', seq: 4 });
  const ended = fx.tick('fail', 9); ok(!fx.on('shop') && ended && ended.id === 'afford', 'the screen changed: the moment ends and says so');
  ok(FX.ease.back(1) === 1 && FX.ease.out(0) === 0, 'easing');
}
// ---- every coin spend counts the purse DOWN (src/ui/purse.js)
{
  let t = 0, coins = 300, scr = 'fail';
  const P = createPurse({ clock: () => t, calm: () => false, wallet: () => coins, screen: () => scr, sound: () => {}, buzz: () => {} });
  const nop = () => {}, ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : nop), set: (o, k, v) => { o[k] = v; return true; } });
  const UI = { measure: () => 10, glass: nop, text: nop }, A = { x: 0, y: 0, x1: 400, y1: 800 }, draw = () => P.draw(ctx, 1, A, nop, UI);
  draw(); coins = 240; P.spend({ dst: { x: 50, y: 400 } });
  ok(P.shown() === 300, 'a spend: the counter still shows the old total');
  t = 0.3; draw(); const mid = P.shown();
  ok(mid < 300 && mid > 240, `it counts down (${mid})`);
  t = 3; draw(); draw(); ok(P.shown() === 240, 'and lands on the purse');
  coins = 200; draw(); t = 3.2; draw(); ok(P.shown() < 240 && P.shown() > 200, 'a drop with no spend call counts down by itself');
  scr = 'play'; coins = 100; draw(); ok(P.shown() === 100, 'during play the number simply follows the purse');
}
console.log(fails ? `\n${fails} spend test(s) FAILED` : '\nall spend tests passed');
process.exit(fails ? 1 : 0);
