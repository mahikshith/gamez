// The Director's rules (src/director.js): node tools/test-director.mjs
import * as DR from '../src/director.js';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const DAY = 864e5, T0 = Date.UTC(2026, 10, 20, 10);
const mk = (o = {}) => ({ unlocked: 12, wallet: { coins: 0, skins: ['classic'], owned: {} }, offers: { ads: 0 }, ...o });
const ctx = (o = {}) => ({ levelId: 12, now: T0, nearMiss: false, timeout: false, thorns: true, villains: true, chickLevel: true, lockedChick: { id: 'bomb', name: 'Bomb Chick' }, owned: {}, adReady: true, ...o });

{ // the ladder
  const s = mk();
  DR.noteResult(s, 12, false, { saved: 0 });
  ok(DR.failHelp(s, ctx()) === null, '1st loss, not close: nothing but Retry');
  s.wallet.coins = 500;
  const n = DR.failHelp(s, ctx({ nearMiss: true }));
  ok(n && n.kind === 'buyBoost' && n.id === 'golden', '1st loss, one egg short, has coins: the Golden Shell for coins');
  DR.noteResult(s, 12, false, {});
  const f = DR.failHelp(s, ctx());
  ok(f && f.kind === 'trialChick' && f.id === 'bomb', '2nd loss: a locked chick to try free');
  DR.noteTrial(s, 12, f, T0);
  ok(DR.failHelp(s, ctx()) === null, '2nd loss again after the freebie: nothing new');
  DR.noteResult(s, 12, false, {});
  const b = DR.failHelp(s, ctx({ timeout: true }));
  ok(b && b.kind === 'buyBoost' && b.id === 'time', '3rd loss, out of time: the Slow Fuse for coins');
  s.wallet.coins = 0;
  const a = DR.failHelp(s, ctx());
  ok(a && a.kind === 'adBoost', '3rd loss, no coins: the booster for a video');
  ok(DR.failHelp(s, ctx({ owned: { snips: 2 } })) === null, 'owns the right booster: no sale (the intro card offers it)');
  ok(DR.frustration(s, 12) > 0.5, 'three losses in a row: frustrated (no ad breaks)');
}
{ // freebies are rationed
  const s = mk();
  for (const lv of [20, 21, 22]) { DR.noteResult(s, lv, false, {}); DR.noteResult(s, lv, false, {}); }
  const h1 = DR.failHelp(s, ctx({ levelId: 20 })); DR.noteTrial(s, 20, h1, T0);
  const h2 = DR.failHelp(s, ctx({ levelId: 21 })); DR.noteTrial(s, 21, h2, T0);
  ok(h1.kind === 'trialChick' && h2.kind === 'trialBoost', 'a chick is tried free once, then a booster');
  const h3 = DR.failHelp(s, ctx({ levelId: 22 }));
  ok(!h3 || (h3.kind !== 'trialChick' && h3.kind !== 'trialBoost'), 'two freebies a day at most');
  const h4 = DR.failHelp(s, ctx({ levelId: 22, now: T0 + DAY }));
  ok(h4 && h4.kind === 'trialBoost', 'next day: freebies again');
}
{ // skin trials
  const s = mk({ unlocked: 10 });
  let gift = null, wins = 0;
  while (!gift && wins < 20) { DR.noteResult(s, 30 + wins, true, {}); gift = DR.winGift(s, { rand: () => 0 }); wins++; }
  ok(gift && wins >= 5 && wins <= 8, `a skin trial after ${wins} wins`);
  DR.startSkinTrial(s, gift.id, T0, () => 0);
  ok(DR.trialSkin(s) === gift.id, 'the trial skin is worn');
  ok(DR.winGift(s) === null, 'no second gift while one runs');
  DR.tickTrial(s); DR.tickTrial(s);
  ok(DR.tickTrial(s) === gift.id && DR.trialSkin(s) === null, 'it ends after 3 levels');
  const n = DR.homeNudge(s, { now: T0 });
  ok(n && n.kind === 'keep' && n.id === gift.id, 'home asks: keep it?');
  DR.clearKeepAsk(s);
  ok(!DR.homeNudge(s, { now: T0 }) || DR.homeNudge(s, { now: T0 }).kind !== 'keep', 'asked once');
}
{ // welcome back and "you can afford"
  const s = mk();
  DR.noteSeen(s, T0);
  ok(DR.homeNudge(s, { now: T0 + DAY }) === null, 'one day away: nothing');
  const w = DR.homeNudge(s, { now: T0 + 3 * DAY });
  ok(w && w.kind === 'welcome', 'three days away: a welcome-back gift');
  DR.noteNudge(s, w, T0 + 3 * DAY); DR.noteSeen(s, T0 + 3 * DAY);
  s.wallet.coins = 400;
  const a = DR.homeNudge(s, { now: T0 + 3 * DAY, chicks: [{ id: 'bomb', name: 'Bomb Chick', price: 350 }] });
  ok(a && a.kind === 'afford' && a.item === 'chick:bomb', 'coins reach a locked chick: say so');
  DR.noteNudge(s, a, T0 + 3 * DAY);
  const a2 = DR.homeNudge(s, { now: T0 + 3 * DAY, chicks: [{ id: 'bomb', name: 'Bomb Chick', price: 350 }] });
  ok(!a2 || a2.item !== 'chick:bomb', 'only once per item');
}
{ // spend tracking and the profile
  const s = mk();
  DR.noteSpend(s, 250, 'store'); DR.noteSpend(s, 200, 'fail');
  ok(DR.profile(s).segment === 'spender', 'coin spender spotted');
  s.wallet.payer = true;
  ok(DR.profile(s).segment === 'payer', 'payer first');
  DR.noteResult(s, 5, false, {}); DR.noteResult(s, 5, false, {}); DR.noteResult(s, 5, false, {});
  s.wallet.coins = 0;
  const h = DR.failHelp(s, ctx({ levelId: 5, chickLevel: false }));
  ok(!h || h.kind !== 'adBoost', 'a payer is not sent to ads for help');
}
{ // the win streak and the rewind price
  const s = mk({ unlocked: 10 });
  DR.noteResult(s, 40, true, {});
  ok(DR.hotBoosts(s).length === 0, 'one win: no streak boosters yet');
  DR.noteResult(s, 41, true, {});
  ok(DR.hotBoosts(s).join() === 'stone', 'two in a row: a free Stone shell');
  DR.noteResult(s, 42, true, {});
  ok(DR.hotBoosts(s).join() === 'stone,sponge', 'three in a row: Stone shell + Sponge pad');
  DR.noteResult(s, 43, false, {});
  ok(DR.hotBoosts(s).length === 0 && DR.hotLost(s) === 3, 'a loss ends it (and remembers it)');
  DR.keepHot(s);
  ok(DR.hotCount(s) === 3, 'a rewind brings it back');
  DR.noteResult(s, 43, false, {}); DR.noteResult(s, 43, false, {});
  DR.keepHot(s);
  ok(DR.hotCount(s) === 0, 'an old streak is not brought back by a later rewind');
  ok(DR.hotBoosts(mk({ unlocked: 3 })).length === 0, 'no streak boosters in the first levels');
  ok(DR.rewindPrice(0) === 60 && DR.rewindPrice(1) === 120 && DR.rewindPrice(9) === 200, 'rewind price climbs, then holds');
}
{ // the early days: nothing sold before level 3 is won (any mode)
  ok(DR.earlyDays({ stars: {} }) && DR.earlyDays({}) && DR.earlyDays({ stars: { 1: 3, 2: 3 } }), 'a new player, or L1-L2 won: early days');
  ok(!DR.earlyDays({ stars: { 3: 1 } }) && !DR.earlyDays({ stars: { e3: 2 } }) && !DR.earlyDays({ stars: { h3: 1 } }), 'level 3 won in any mode: the shop and offers may show');
  ok(DR.SELL_AFTER === 3, 'the gate sits at level 3');
}
{ // tastes: a free try of a store item at a win, in a fixed rotation (0.8.9)
  const CH = [{ id: 'bomb', name: 'Boom Chick', price: 450 }, { id: 'freeze', name: 'Frost Chick', price: 400 }];
  const win = (s, lv, o = {}) => { DR.noteResult(s, lv, true, {}); DR.tickTrial(s); const T = DR.winTaste(s, { levelId: lv, boss: lv % 5 === 0, chicks: CH, rand: () => 0, ...o }); if (T) DR.startTaste(s, T, T0, () => 0); return T; };
  const s = mk({ unlocked: 1 });
  const early = [1, 2, 3, 4].map((lv) => win(s, lv));
  ok(early.every((T) => T === null), 'no taste before the first boss');
  const t1 = win(s, 5);
  ok(t1 && t1.kind === 'skin' && t1.id === 'speckled', 'the first taste comes with the level 5 boss win: the cheapest egg skin');
  ok(DR.trialSkin(s) === 'speckled', 'the egg skin is worn');
  ok(DR.dirState(s).winsToSkin === 4, 'the counter winds up to 4..6');
  let got = [], lv = 6;
  while (got.length < 3 && lv < 40) { const T = win(s, lv++); if (T) got.push(T); }
  ok(got.map((T) => T.kind).join() === 'hen,chick,boost', `then the rotation: ${got.map((T) => T.kind).join()}`);
  ok(got[0].id === 'farmer' && !got.some((T) => T.kind === 'hen' && T.id === 'golden'), 'the cheapest outfit, never a premium one');
  ok(got[1].id === 'freeze', 'the cheapest locked chick');
  { const { BOOSTERS } = await import('../src/economy.js'); const top = Math.max(...Object.values(BOOSTERS).map((b) => b.price)); ok(BOOSTERS[got[2].id].price === top, `the dearest booster the bag has none of (${got[2].id})`); }
  { const c = mk({ unlocked: 12 }), D = DR.dirState(c); D.tasteN = 2; D.winsToSkin = 0; DR.startTaste(c, { kind: 'chick', id: 'freeze', name: 'Frost Chick' }, T0, () => 0);
    ok(DR.trialChick(c) === 'freeze', 'a chick on trial is open'); DR.tickTrial(c); DR.tickTrial(c); DR.tickTrial(c);
    ok(DR.trialChick(c) === null && !DR.homeNudge(c, { now: T0 }), 'after 3 levels it is locked again, and nothing asks'); }
  const gaps = []; let since = 0;
  for (let i = 0; i < 40; i++) { since++; const T = win(s, 40 + i); if (T) { gaps.push(since); since = 0; } }
  ok(gaps.length > 0 && gaps.every((g) => g >= 4 && g <= 6), `one taste every 4 to 6 wins (${gaps.join(',')})`);
  const seen = DR.dirState(s).trials;
  ok(new Set(seen.skins).size === seen.skins.length && new Set(seen.hens).size === seen.hens.length && new Set(seen.chicks).size === seen.chicks.length, 'each item once');
}
{ // skip rules: a kind still running or asking "Keep it?" is passed over; a chick only where the next level can use one
  const s = mk({ unlocked: 10 });
  const set = (o) => Object.assign(DR.dirState(s), o); // (dirState rebuilds save.dir: set it fresh each time)
  set({ tasteN: 4, winsToSkin: 0, trial: { id: 'dino', left: 2, from: T0 } });
  const T = DR.winTaste(s, { levelId: 20, chicks: [] });
  ok(T && T.kind === 'hen', 'egg skin running: the hen outfit instead');
  set({ tasteN: 2 });
  const C = DR.winTaste(s, { levelId: 20, chicks: [] });
  ok(C && C.kind === 'boost', 'no chick the next level can use: a booster instead');
  set({ trial: null, keepAsk: 'dino', tasteN: 0 });
  ok(DR.winTaste(s, { levelId: 20, chicks: [] }).kind === 'hen', 'a "Keep it?" pending: no new egg skin');
}
{ // a player who owns everything gets nothing
  const { SKINS, HEN_SKINS, BOOSTERS } = await import('../src/economy.js');
  const s = mk({ unlocked: 30, wallet: { coins: 0, skins: Object.keys(SKINS), henSkins: Object.keys(HEN_SKINS), owned: Object.fromEntries(Object.keys(BOOSTERS).map((b) => [b, 2])) } });
  Object.assign(DR.dirState(s), { winsToSkin: 0, tasteN: 1 });
  ok(DR.winTaste(s, { levelId: 30, chicks: [] }) === null, 'owns everything: no taste');
}
console.log(bad ? `${bad} FAILED` : 'all director checks passed');
process.exit(bad ? 1 : 0);
