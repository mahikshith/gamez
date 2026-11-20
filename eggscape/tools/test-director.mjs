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
  ok(DR.hotBoosts(s).join() === 'stone,nest', 'three in a row: Stone shell + Wide Nest');
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
console.log(bad ? `${bad} FAILED` : 'all director checks passed');
process.exit(bad ? 1 : 0);
