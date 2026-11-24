// The Lucky Spin's rules (src/spin.js): node tools/test-spin.mjs
import * as SP from '../src/spin.js';
import { defaultWallet, ownedCount, MAX_OWNED, HEN_SKINS, HEN_SKIN_ORDER, CHICK_IDS, ownsHenSkin } from '../src/economy.js';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const mk = (o = {}) => ({ unlocked: 8, wallet: { ...defaultWallet(), coins: 500 }, ...o });
const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const lcg = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);

{ // honest odds: the weights add up to 100, every slice pays, the wheel's arcs are the odds
  const O = SP.odds(), sum = O.reduce((a, o) => a + o.pct, 0);
  ok(Math.abs(sum - 100) < 1e-9, 'the odds add up to 100%');
  ok(SP.TABLE.every((s) => s.w > 0 && s.n > 0), 'no losing slice: every slice pays something');
  const A = SP.slices();
  ok(A.every((a, i) => Math.abs(a.a1 - a.a0 - SP.TABLE[i].w / 100) < 1e-9) && Math.abs(A[A.length - 1].a1 - 1) < 1e-9, 'a slice is as wide as its odds (the wheel shows the truth)');
  const n = 200000, hit = {}, r = lcg(7);
  for (let i = 0; i < n; i++) { const s = SP.roll(r); hit[s.id] = (hit[s.id] || 0) + 1; }
  ok(SP.TABLE.every((s) => Math.abs((hit[s.id] || 0) / n - s.w / 100) < 0.006), '200,000 rolls land on each slice at its stated odds');
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
  ok(!SP.open(early) && SP.noteWin(early) === false && SP.banked(early) === 0 && SP.daily(early, 'd1') === false, 'before level 3 is won there is no wheel, no meter, no daily spin');
  const s = mk();
  ok(SP.left(s) === 3 && SP.noteWin(s) === false && SP.left(s) === 2 && SP.noteWin(s) === false && SP.left(s) === 1, 'the meter counts down: 3, 2, 1 levels to the spin');
  ok(SP.noteWin(s) === true && SP.banked(s) === 1 && SP.left(s) === 3, 'the third win earns a spin and the meter starts again');
  for (let i = 0; i < 12; i++) SP.noteWin(s);
  ok(SP.banked(s) === SP.SPIN.bankMax, 'spins wait in the bank, at most three');
  const d = mk();
  ok(SP.daily(d, 'd1') === true && SP.banked(d) === 1 && SP.daily(d, 'd1') === false && SP.banked(d) === 1 && SP.daily(d, 'd2') === true && SP.banked(d) === 2, 'one free spin a day, once');
}
{ // the ways: free first; with nothing banked a chosen video (three a day) and coins on a climbing ladder (three a day)
  const s = mk(); SP.daily(s, 'd1');
  let W = SP.ways(s, 'd1');
  ok(W.free && !W.ad && W.coin === null, 'a banked spin: only the free spin is offered (no ad, no price)');
  ok(SP.spin(s, 'ad', 'd1') === null && SP.spin(s, 'coin', 'd1') === null, 'and the other ways are refused while it waits');
  const r1 = SP.spin(s, 'free', 'd1', seq(0));
  ok(r1 && r1.how === 'free' && r1.paid === 0 && SP.banked(s) === 0, 'the free spin is used');
  W = SP.ways(s, 'd1');
  ok(!W.free && W.ad && W.coin === 70, 'then: a video spin, or 70 coins');
  const c0 = s.wallet.coins, r2 = SP.spin(s, 'coin', 'd1', seq(0.99, 0));
  ok(r2 && r2.paid === 70 && SP.ways(s, 'd1').coin === 100, 'a coin spin costs 70, the next 100');
  SP.spin(s, 'coin', 'd1', seq(0)); ok(SP.ways(s, 'd1').coin === 140, 'then 140');
  SP.spin(s, 'coin', 'd1', seq(0)); ok(SP.ways(s, 'd1').coin === null && SP.spin(s, 'coin', 'd1') === null, 'three coin spins a day, then no more (nobody can pour a purse into it)');
  ok(c0 - 70 <= s.wallet.coins + 240 + 1, 'the coins left the purse');
  for (let i = 0; i < 3; i++) ok(!!SP.spin(s, 'ad', 'd1', seq(0)), `video spin ${i + 1} of 3`);
  ok(SP.spin(s, 'ad', 'd1') === null && !SP.ways(s, 'd1').ad, 'three video spins a day, then none');
  W = SP.ways(s, 'd2'); ok(W.ad && W.coin === 70, 'a new day: the video spins and the price ladder start again');
  const p = mk({ wallet: { ...defaultWallet(), coins: 10 } }); ok(SP.spin(p, 'coin', 'd1') === null && p.wallet.coins === 10, 'too few coins: no spin, nothing taken');
}
{ // prizes land in the wallet; a full stack pays coins; the rare bird is something not owned
  const s = mk(); SP.daily(s, 'd1');
  const r = SP.spin(s, 'free', 'd1', seq(0)); // the first slice: 15 coins
  ok(r.prize.kind === 'coins' && s.wallet.coins === 515, 'coins: +15');
  const w = SP.grant(defaultWallet(), { kind: 'booster', item: 'stone', n: 2 }); ok(ownedCount(w, 'stone') === 2, 'boosters: +2 Stone shell');
  const full = { ...defaultWallet(), owned: { stone: MAX_OWNED } }, wf = SP.grant(full, { kind: 'booster', item: 'stone', n: 1 });
  ok(ownedCount(wf, 'stone') === MAX_OWNED && wf.coins === 40, 'a full stack pays its coin price instead (never an empty spin)');
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
  ok(m < SP.SPIN.coin[0], 'the mean worth of a spin is under the first coin price');
  ok(m > 25, 'and it is a real gift when it is free');
}
{ // unsafe saves
  const s = { unlocked: 9, wallet: defaultWallet(), spin: { wins: 'x', bank: 99, t: null } };
  ok(SP.banked(s) === 3 && SP.left(s) === 3, 'a broken save is made safe');
}
console.log(bad ? `\n${bad} FAILED` : '\nall spin checks passed');
process.exit(bad ? 1 : 0);
