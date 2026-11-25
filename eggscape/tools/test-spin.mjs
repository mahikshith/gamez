// The Lucky Spin's rules (src/spin.js): node tools/test-spin.mjs
import * as SP from '../src/spin.js';
import { defaultWallet, ownedCount, GIFT_MAX, HEN_SKINS, HEN_SKIN_ORDER, CHICK_IDS, ownsHenSkin, SKINS, SKIN_ORDER, CHICK_PRICES, BOOSTERS, COUPON, unlockPrice, unlockables, buySkin, buyHenSkin, buyChick, canAffordSkin } from '../src/economy.js';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const mk = (o = {}) => ({ unlocked: 8, wallet: { ...defaultWallet(), coins: 500 }, ...o });
const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const lcg = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);

{ // honest odds: the shown odds add up to 100 with the villains' row in them, every prize row pays
  const O = SP.odds(), sum = O.reduce((a, o) => a + o.pct, 0);
  ok(Math.abs(sum - 100) < 1e-9, 'the odds shown add up to 100%');
  ok(O[O.length - 1].kind === 'villain' && O[O.length - 1].pct === SP.SPIN.miss && O.filter((o) => o.kind === 'villain').length === 1, 'the villains have a row of their own on the odds sheet: 25%');
  ok(SP.TABLE.every((s) => s.w > 0 && s.n > 0), 'every prize row pays something');
  const A = SP.slices();
  ok(A.every((a, i) => Math.abs(a.a1 - a.a0 - SP.TABLE[i].w / 100) < 1e-9) && Math.abs(A[A.length - 1].a1 - 1) < 1e-9, 'a slice is as wide as its odds (the wheel shows the truth)');
  const n = 200000, hit = {}, r = lcg(7);
  for (let i = 0; i < n; i++) { const s = SP.roll(r); hit[s.id] = (hit[s.id] || 0) + 1; }
  ok(SP.TABLE.every((s) => Math.abs((hit[s.id] || 0) / n - s.w / 100) < 0.006), '200,000 rolls land on each prize at its weight');
}
{ // the roll does not look at the player
  const rich = mk({ wallet: { ...defaultWallet(), coins: 99999, payer: true, spend: 50 } }), poor = mk({ wallet: defaultWallet() });
  const a = [], b = []; let r = lcg(3); for (let i = 0; i < 300; i++) a.push(SP.roll(r).id); r = lcg(3); for (let i = 0; i < 300; i++) b.push(SP.roll(r).id);
  ok(a.join() === b.join(), 'the same draws give the same slices');
  ok(SP.roll.length <= 1 && !/wallet|save|spend|payer/.test(String(SP.roll)), 'roll() takes no player data at all');
  void rich; void poor;
}
{ // earning: nothing in the first levels, then one spin per three wins, banked up to three
  const early = mk({ unlocked: 3 });
  ok(!SP.open(early) && SP.noteWin(early) === false && SP.banked(early) === 0, 'before level 3 is won there is no wheel and no meter');
  const s = mk();
  ok(SP.left(s) === 3 && SP.noteWin(s) === false && SP.left(s) === 2 && SP.noteWin(s) === false && SP.left(s) === 1, 'the meter counts down: 3, 2, 1 levels to the spin');
  ok(SP.noteWin(s) === true && SP.banked(s) === 1 && SP.left(s) === 3, 'the third win earns a spin and the meter starts again');
  for (let i = 0; i < 12; i++) SP.noteWin(s);
  ok(SP.banked(s) === SP.SPIN.bankMax, 'spins wait in the bank, at most three');
  const d = mk();
  for (let i = 0; i < 30; i++) SP.noteWin(d, false);
  ok(SP.banked(d) === 0 && SP.left(d) === 3, 'replaying old levels for the same stars earns nothing (spins come from progress only)');
  ok(typeof SP.daily === 'undefined', 'there is no free daily spin');
}
{ // the ways: free first; with nothing banked a chosen video (three a day) and coins on a climbing ladder (three a day)
  const s = mk(); for (let i = 0; i < 3; i++) SP.noteWin(s);
  let W = SP.ways(s, 'd1');
  ok(W.free && !W.ad && W.coin === null, 'a banked spin: only the free spin is offered (no ad, no price)');
  ok(SP.spin(s, 'ad', 'd1') === null && SP.spin(s, 'coin', 'd1') === null, 'and the other ways are refused while it waits');
  const r1 = SP.spin(s, 'free', 'd1', seq(0.99, 0));
  ok(r1 && r1.how === 'free' && r1.paid === 0 && SP.banked(s) === 0, 'the free spin is used');
  ok(!r1.miss && r1.prize, 'a player\'s very first pull always wins, whatever the draw');
  W = SP.ways(s, 'd1');
  ok(!W.free && W.ad && W.coin === 80, 'then: a video spin, or 80 coins');
  const c0 = s.wallet.coins, r2 = SP.spin(s, 'coin', 'd1', seq(0.5, 0));
  ok(r2 && r2.paid === 80 && SP.ways(s, 'd1').coin === 110, 'a coin spin costs 80, the next 110');
  SP.spin(s, 'coin', 'd1', seq(0)); ok(SP.ways(s, 'd1').coin === 150, 'then 150');
  SP.spin(s, 'coin', 'd1', seq(0)); ok(SP.ways(s, 'd1').coin === null && SP.spin(s, 'coin', 'd1') === null, 'three coin spins a day, then no more (nobody can pour a purse into it)');
  ok(c0 - 80 <= s.wallet.coins + 260 + 1, 'the coins left the purse');
  for (let i = 0; i < 3; i++) ok(!!SP.spin(s, 'ad', 'd1', seq(0)), `video spin ${i + 1} of 3`);
  ok(SP.spin(s, 'ad', 'd1') === null && !SP.ways(s, 'd1').ad, 'three video spins a day, then none');
  W = SP.ways(s, 'd2'); ok(W.ad && W.coin === 80, 'a new day: the video spins and the price ladder start again');
  const p = mk({ wallet: { ...defaultWallet(), coins: 10 } }); ok(SP.spin(p, 'coin', 'd1') === null && p.wallet.coins === 10, 'too few coins: no spin, nothing taken');
}
{ // prizes land in the wallet; a full stack pays coins; the rare bird is something not owned
  const s = mk(); for (let i = 0; i < 3; i++) SP.noteWin(s);
  const r = SP.spin(s, 'free', 'd1', seq(0)); // the first prize: 30 coins
  ok(r.prize.kind === 'coins' && s.wallet.coins === 530, 'coins: +30');
  const w = SP.grant(defaultWallet(), { kind: 'booster', item: 'stone', n: 2 }); ok(ownedCount(w, 'stone') === 2, 'boosters: +2 Stone shell');
  const full = { ...defaultWallet(), owned: { stone: GIFT_MAX } }, wf = SP.grant(full, { kind: 'booster', item: 'stone', n: 1 });
  ok(ownedCount(wf, 'stone') === GIFT_MAX && wf.coins === 20, 'a gift into a full stack pays half its price in coins (never an empty spin, never a flood)');
  ok(SP.grant(defaultWallet(), { kind: 'charge', n: 1 }).charges === 1 && SP.grant(defaultWallet(), { kind: 'skip', n: 1 }).tickets.skip === 1, 'a Chick Charge and a Skip Ticket land');
  const rare = SP.TABLE.find((t) => t.kind === 'rare'), P = SP.prizeFor(rare, defaultWallet(), seq(0));
  ok((P.kind === 'hen' && !HEN_SKINS[P.item].premium) || P.kind === 'chick', 'the rare slice gives a hen outfit or a chick, never a real-money one');
  const wr = SP.grant(defaultWallet(), P); ok(P.kind === 'hen' ? ownsHenSkin(wr, P.item) : wr.chicks.includes(P.item), 'and it is owned afterwards');
  const all = { ...defaultWallet(), henSkins: HEN_SKIN_ORDER.filter((h) => !HEN_SKINS[h].premium), chicks: [...CHICK_IDS] }, PA = SP.prizeFor(rare, all, seq(0));
  ok(PA.kind === 'coins' && PA.n === SP.SPIN.rareCoins, 'everything owned: the rare slice pays 300 coins');
}
{ // the economy: a coin spin is a sink on average
  const m = SP.meanWorth(defaultWallet());
  console.log('     mean worth of a spin: ' + m.toFixed(1) + ' coins');
  ok(m * SP.hitRate() < SP.SPIN.coin[0] * 0.75, 'a pull is worth well under the first coin price (' + (m * SP.hitRate()).toFixed(1) + ' against ' + SP.SPIN.coin[0] + ')');
  ok(m * SP.hitRate() > 25, 'and a free pull is a real gift even with the villains counted (' + (m * SP.hitRate()).toFixed(1) + ')');
}
{ // the engine: time in the game moves the meter, the wheel grows with the world reached, the odds never move
  const s = mk();
  let got = 0; for (let i = 0; i < 4; i++) got += SP.notePlayed(s, 'd1') ? 1 : 0;
  ok(SP.left(s) === 2 && got === 0, 'four levels played in a day (won or lost): one step on the meter');
  for (let i = 0; i < 40; i++) SP.notePlayed(s, 'd1');
  ok(SP.left(s) === 1 && SP.banked(s) === 0, 'at most two such steps a day (playing all day cannot farm spins)');
  for (let i = 0; i < 4; i++) SP.notePlayed(s, 'd2');
  ok(SP.banked(s) === 1, 'the next day the third step opens the spin');
  ok(SP.tier(mk({ unlocked: 5 })) === 0 && SP.tier(mk({ unlocked: 13 })) === 1 && SP.tier(mk({ unlocked: 36 })) === 2 && SP.tier(mk({ unlocked: 54 })) === 3, 'the wheel has four sizes: worlds 1-2, 3-5, 6-8, 9-10');
  const w0 = SP.wheel(mk({ unlocked: 5 })), w3 = SP.wheel(mk({ unlocked: 54 }));
  ok(w0.find((o) => o.id === 'c1').n === 30 && w3.find((o) => o.id === 'c1').n === 75 && w3.find((o) => o.id === 'c3').n === 375, 'coin prizes grow with the world: 30 -> 75, 150 -> 375');
  ok(w0.every((o, i) => o.pct === w3[i].pct), 'the odds are the same at every size');
  const late = mk({ unlocked: 54 }); for (let i = 0; i < 3; i++) SP.noteWin(late);
  const c0 = late.wallet.coins, r = SP.spin(late, 'free', 'd1', seq(0));
  ok(r.prize.n === 75 && late.wallet.coins === c0 + 75, 'and the prize paid is the amount the wheel showed');
  ok([5, 13, 36, 54].every((u) => { const sv = mk({ unlocked: u }); return SP.meanWorth(defaultWallet(), SP.coinX(sv)) * SP.hitRate() < SP.ways(sv, 'd9').coin; }), 'at every size the first coin spin costs more than a spin is worth on average');
  ok(SP.ways(mk({ unlocked: 54 }), 'd9').coin === 200, 'the coin price grows with the wheel (80 -> 200 in the last worlds)');
}
{ // the cheer-up spin: the third loss in a row on a level, once per level, two a day
  const s = mk();
  ok(SP.noteLoss(s, 7, 1, 'd1') === false && SP.noteLoss(s, 7, 2, 'd1') === false && SP.banked(s) === 0, 'one or two losses: nothing yet');
  ok(SP.noteLoss(s, 7, 3, 'd1') === true && SP.banked(s) === 1, 'the third loss in a row on a level banks a free spin');
  ok(SP.noteLoss(s, 7, 4, 'd1') === false && SP.noteLoss(s, 7, 9, 'd1') === false && SP.banked(s) === 1, 'once per level');
  ok(SP.noteLoss(s, 8, 3, 'd1') === true && SP.noteLoss(s, 9, 3, 'd1') === false && SP.banked(s) === 2, 'two cheer-up spins a day at most');
  ok(SP.noteLoss(s, 9, 3, 'd2') === true && SP.banked(s) === 3 && SP.noteLoss(s, 7, 3, 'd3') === false, 'the next day another level can cheer again, a cheered level never twice');
  ok(SP.noteLoss(mk({ unlocked: 2 }), 2, 5, 'd1') === false, 'never in the first levels');
  const w = SP.ways(s, 'd2'); ok(w.free && !w.ad && w.coin === null, 'it is a plain free spin: no video, no price');
}
{ // the villains (0.8.16): 45 pulls in a hundred, never three times in a row, a lost pull is lost
  const fresh = (bank = 0) => { const s = mk(); s.spin = { n: 5, bank }; return s; };
  let s = fresh(1);
  const c0 = s.wallet.coins, m = SP.spin(s, 'free', 'd1', seq(0.56, 0));
  ok(m && m.miss && m.prize === null && m.slice.kind === 'villain' && s.wallet.coins === c0 && SP.banked(s) === 0, 'a draw in the top 45 hundredths: three villains, no prize, the banked spin is used');
  ok(!SP.spin(fresh(1), 'free', 'd1', seq(0.54, 0)).miss, 'a draw just under it wins');
  let W = SP.ways(s, 'd1');
  ok(W.retry === null && !W.sure && SP.spin(s, 'retry', 'd1') === null, 'there is no Try again: after one villain row the next pull can lose too');
  s = fresh(0);
  const a = SP.spin(s, 'ad', 'd1', seq(0.9));
  ok(a.miss && SP.ways(s, 'd1').retry === null && SP.state(s).t.ad === 1, 'a video pull the villains took is used up: one of the day\'s three');
  s = fresh(0);
  const p0 = s.wallet.coins, c = SP.spin(s, 'coin', 'd1', seq(0.8));
  ok(c.miss && c.paid === 80 && s.wallet.coins === p0 - 80 && SP.ways(s, 'd1').coin === 110, 'a coin pull the villains took is paid for, and the price climbs');
  const c2 = SP.spin(s, 'coin', 'd1', seq(0.99));
  ok(c2.miss && c2.paid === 110 && SP.ways(s, 'd1').sure, 'a second villain row can follow; after two in a row the next pull is the sure one');
  const c3 = SP.spin(s, 'coin', 'd1', seq(0.99, 0));
  ok(!c3.miss && c3.paid === 150 && SP.ways(s, 'd1').coin === null && !SP.ways(s, 'd1').sure, 'the third pull wins whatever the draw (never three in a row), and the day\'s three coin spins are used');
  s = fresh(3);
  ok(SP.spin(s, 'free', 'd1', seq(0.9)).miss && SP.spin(s, 'free', 'd1', seq(0.9)).miss && !SP.spin(s, 'free', 'd1', seq(0.9, 0)).miss, 'banked spins lose the same way: two villain rows, then the sure one');
  s = fresh(0); s.spin = { n: 5, bank: 0, miss: true, again: 2 };
  ok(SP.state(s).miss === 1 && SP.state(s).again === 0 && SP.ways(s, 'd1').retry === null, 'a 0.8.15 save with a Try again open: it is simply gone, one villain row counted');
  s = fresh(0); SP.noteLoss(s, 7, 3, 'd1');
  ok(SP.ways(s, 'd1').sure && !SP.spin(s, 'free', 'd1', seq(0.99, 0)).miss, 'a cheer-up spin always wins');
  // the long run, by the rules alone: banked pulls only
  s = fresh(0); const r = lcg(11); let miss = 0, two = 0, last = false, run = 0; const n = 60000, hit = {};
  for (let i = 0; i < n; i++) { s.spin.bank = 1; const q = SP.spin(s, 'free', 'd1', r); if (q.miss) { miss++; run++; if (run > 2) two++; } else { run = 0; hit[q.slice.id] = (hit[q.slice.id] || 0) + 1; } last = q.miss; s.wallet.coins = 500; }
  ok(two === 0, '60,000 pulls: the villains never came three times in a row');
  ok(Math.abs(miss / n - (1 - SP.hitRate())) < 0.006 && Math.abs(SP.hitRate() - 1 / 1.6525) < 1e-9, `and they took ${(miss / n * 100).toFixed(1)}% of all pulls (about 4 in 10 in the long run, as hitRate() says)`);
  ok(SP.TABLE.every((t2) => Math.abs((hit[t2.id] || 0) / (n - miss) - t2.w / 100) < 0.008), 'among the winning pulls every prize comes at its weight');
  const rich = fresh(0), poor = fresh(0); rich.wallet = { ...defaultWallet(), coins: 99999, payer: true, spend: 50 }; poor.wallet = { ...defaultWallet(), coins: 0 };
  let same = true; const ra = lcg(5), rb = lcg(5);
  for (let i = 0; i < 400; i++) { rich.spin.bank = 1; poor.spin.bank = 1; const x = SP.spin(rich, 'free', 'd1', ra), y = SP.spin(poor, 'free', 'd1', rb); if (x.miss !== y.miss) same = false; }
  ok(same, 'a rich payer and an empty purse meet the villains on exactly the same draws');
}
{ // unsafe saves
  const s = { unlocked: 9, wallet: defaultWallet(), spin: { wins: 'x', bank: 99, t: null } };
  ok(SP.banked(s) === 3 && SP.left(s) === 3, 'a broken save is made safe');
}
{ // 0.8.15: the half-price ticket and the Scarecrow
  const cp = SP.TABLE.find((t) => t.kind === 'coupon'), sh = SP.TABLE.find((t) => t.kind === 'scare');
  const w0 = { ...defaultWallet(), coins: 500 }, P = SP.prizeFor(cp, w0, () => 0, 1);
  ok(P.kind === 'coupon' && P.worth > 100, 'the ticket slice gives a half-price ticket');
  const w1 = SP.grant(w0, P);
  ok(w1.coupon === 1 && w1.coins === 500, 'it is held in the purse and adds no coins');
  const P2 = SP.prizeFor(cp, w1, () => 0, 1.5);
  ok(P2.kind === 'coins' && P2.n === 60 && P2.instead === 'coupon', 'a second ticket while one is held pays coins instead (40 x the tier), as the odds sheet says');
  const U = unlockPrice(w1, SKINS.dino.price), U0 = unlockPrice(w0, SKINS.dino.price);
  ok(U.price === 100 && U.was === 200 && U.coupon && U0.price === 200 && !U0.coupon, 'with a ticket the Dino egg costs 100, crossed out 200; without one 200');
  const poor = { ...w1, coins: 110 };
  ok(canAffordSkin(poor, 'dino') && !canAffordSkin({ ...poor, coupon: 0 }, 'dino'), 'the ticket brings a thing within reach');
  const b = buySkin(poor, 'dino');
  ok(b && b.coins === 10 && b.coupon === 0 && b.skins.includes('dino'), 'buying uses the ticket up: once, on the thing he chose');
  ok(buySkin({ ...b, coins: 500 }, 'lava').coins === 500 - SKINS.lava.price, 'the next thing is at its list price again');
  const h = buyHenSkin({ ...w1 }, 'royal'), c = buyChick({ ...w1, coins: 500 }, 'bomb');
  ok(h && h.coins === 500 - 200 && h.coupon === 0 && c && c.coins === 500 - CHICK_PRICES.bomb / 2 && c.coupon === 0, 'it works on hen outfits and power chicks the same way');
  const all = { ...defaultWallet(), skins: SKIN_ORDER.slice(), henSkins: HEN_SKIN_ORDER.slice(), chicks: Object.keys(CHICK_PRICES) };
  ok(unlockables(all).length === 0 && SP.prizeFor(cp, all, () => 0, 1).kind === 'coins', 'nothing left to own: the ticket slice pays coins');
  const S = SP.prizeFor(sh, w0, () => 0, 1), ws = SP.grant(w0, S);
  ok(S.kind === 'booster' && S.item === 'scare' && ownedCount(ws, 'scare') === 1, 'the Scarecrow slice gives one Scarecrow');
  let seen = false; const r = lcg(3);
  for (let i = 0; i < 400; i++) if (SP.prizeFor(SP.TABLE.find((t) => t.id === 'b1'), w0, r, 1).item === 'scare') seen = true;
  ok(!seen && BOOSTERS.scare.price === 90, 'the random booster slice never gives a Scarecrow (it has its own slice and its own odds)');
  ok(COUPON.max === 1, 'one ticket at a time');
}
console.log(bad ? `\n${bad} FAILED` : '\nall spin checks passed');
process.exit(bad ? 1 : 0);
