// The Mint (src/engine/mint.js): the whole coin loop against one table, and the targets the simulator must show.
// node tools/test-mint.mjs
// mykee (2026-11-25): "users cannot unlock a far distant world without unlocking the previous one" and "from the
// rewarded videos, the slot machine and the daily unlockables the user could unlock everything in the game without
// spending a single dollar. We need a proper engine for the whole coin system."
import { readFileSync } from 'node:fs';
import * as M from '../src/engine/mint.js';
import * as E from '../src/economy.js';
import * as SP from '../src/spin.js';
import { LEVELS } from '../src/data/levels.js';
import { HARD_IDS } from '../src/sim/sim.js';
import { bossOf } from '../src/road.js';
import { purse, owning, town, life, PERSONAS, PER_ENV, CATALOGUE, envOpen } from './sim-players.mjs';
import * as SQ from '../src/side.js';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const F = M.FAUCETS, sum = (a) => a.reduce((x, y) => x + y, 0);
const MAIN = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8'), MINT_SRC = readFileSync(new URL('../src/engine/mint.js', import.meta.url), 'utf8');

// ---- 1. the game reads its amounts from the table (or is checked against it here)
E.setPlatform(false);
{
  const r = { stars: 2, saved: 2, eggs: 3, hard: false };
  ok(E.levelCoins(r).total === F.win.show + 2 * F.win.egg + 2 * F.win.star, `a win pays the table's parts (${E.levelCoins(r).total} offline for two stars)`);
  ok(E.levelCoins({ ...r, hard: true }).total === Math.round((F.win.show + 2 * F.win.egg + 2 * F.win.star) * F.win.hard), 'a hard level pays the table\'s share more');
  ok(JSON.stringify(E.AD_REWARDS.freeCoins.ladder) === JSON.stringify(F.freeCoins.ladder) && E.AD_REWARDS.freeCoins.cooldownSec === F.freeCoins.cooldownSec, 'the free-coins videos: the table\'s ladder ' + F.freeCoins.ladder.join('/'));
  ok(E.BOSS_TREASURE_IDS.every((b, w) => E.bossTreasure(b).coins === M.treasureCoins(w)), 'boss treasures: ' + E.BOSS_TREASURE_IDS.map((b) => E.bossTreasure(b).coins).join('/'));
  ok(Array.from({ length: E.CHEST_COUNT }, (_, i) => E.chestFor(999, i).reward.coins).every((c, i) => c === M.chestCoins(i)), 'star chests: the table\'s coins');
  ok(['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26'].every((d) => F.dailyChest.coins.includes(E.dailyChest(d).coins)), 'the daily chest pays one of the table\'s amounts');
  ok(E.BONUS_CHEST.coins === F.bonusChest.coins && E.GIFT_FULL === F.giftFull.share && E.COUPON.coins === F.spin.coupon, 'bonus chest, full-stack gifts and a second ticket: the table\'s amounts');
  ok(['c1', 'c2', 'c3'].every((id, i) => SP.TABLE.find((s) => s.id === id).n === F.spin.coins[i]) && JSON.stringify(SP.SPIN.tierX) === JSON.stringify(F.spin.tierX), 'the wheel\'s coin prizes and sizes: the table\'s');
  ok(/const DAILY_COINS = MINT\.FAUCETS\.dailyVault\.coins/.test(MAIN) && new RegExp(`const BONUS_COINS = ${F.bonusGoal.coins};`).test(MAIN), 'main.js: the Daily Vault reads the table; the bonus goal matches it');
  ok(/const GATE_COINS = \(k\) => MINT\.gatePrice\(k, bestTotal\(\), PER_ENV\)/.test(MAIN) && /MINT\.worldNeed\(k, PER_ENV\)/.test(MAIN) && /MINT\.gateBuy\(/.test(MAIN), 'main.js: the world gates use the table\'s rules (GATE_COINS keeps its name)');
  ok(/MINT\.onlineBonus\(/.test(MAIN) && /MINT\.winVideoOk\(/.test(MAIN) && /fresh: G\.li >= 0 \? stars > bestStarsOf\(L\.id\)/.test(MAIN), 'main.js: the online share, the win-video pot and the replay share are paid through the table');
  ok(!/Date\.now|setTimeout|setInterval|performance\.now|wallet\.spend|\.payer/.test(MINT_SRC.replace(/\/\/.*$/gm, '')), 'the table has no clock and nothing in it reads who the player is');
}

// ---- 2. the rules
{ // worlds open in order; the price is the stars missing
  ok(M.worldNeed(1, 5) === 7 && M.worldNeed(3, 5) === 21 && M.worldNeed(1, 6) === 8 && M.worldNeed(2, 6) === 17, 'stars per world scale with the levels in a world (7 a world of five, about 8.4 of six)');
  ok(M.gatePrice(1, 7, 5) === 0 && M.gatePrice(1, 6, 5) === 150 && M.gatePrice(1, 4, 5) === 225 && M.gatePrice(2, 0, 5) === 1050, 'the price: 75 a missing star, at least 150, nothing at the star target');
  const open = (set) => (j) => set.includes(j), boss = (set) => (j) => set.includes(j);
  const ahead = M.gateBuy(3, { stars: 99, perEnv: 5, coins: 99999, open: open([0, 1]), bossPassed: boss([0, 1]) });
  ok(!ahead.ok && ahead.why === 'order', 'a world two ahead is refused, however rich and however many stars');
  const noBoss = M.gateBuy(2, { stars: 0, perEnv: 5, coins: 99999, open: open([0, 1]), bossPassed: boss([0]) });
  ok(!noBoss.ok && noBoss.why === 'order', 'the next world is refused until the boss before it is won');
  const next = M.gateBuy(2, { stars: 10, perEnv: 5, coins: 400, open: open([0, 1]), bossPassed: boss([0, 1]) });
  ok(next.ok && next.price === 300, 'the next world with its boss won: 4 stars missing cost 300');
  ok(!M.gateBuy(2, { stars: 10, perEnv: 5, coins: 299, open: open([0, 1]), bossPassed: boss([0, 1]) }).ok, 'too few coins: refused');
  // the simulator's copy of main.js envOpen: a bought far gate opens nothing before its turn
  const S = { stars: {}, wallet: E.defaultWallet(), gates: { 4: 1 }, skipped: {} };
  for (let id = 1; id <= 12; id++) S.stars[id] = 2;
  ok(envOpen(S, 2) && !envOpen(S, 3) && !envOpen(S, 4), 'a gate bought far ahead (an old save) opens nothing before the worlds in front of it');
  S.skipped = { [bossOf(2)]: 1 }; for (let id = 13; id < bossOf(2); id++) S.stars[id] = 3; // (0.8.17: world 3's boss is 18 on the 60-level road; it was 15)
  ok(envOpen(S, 3), 'a skipped boss counts as passed (a skip never leaves a dead end)');
}
{ // replays, the online share, the pot
  const r = { stars: 3, saved: 3, eggs: 3, perfect: true };
  const full = E.levelCoins(r).total, again = E.levelCoins({ ...r, fresh: false }).total, star = E.levelCoins({ ...r, fresh: true }).total;
  ok(again === Math.round(full * F.replay.share) && star === full, `a level replayed for the stars it has pays ${again} of ${full} (40%); a new star pays in full`);
  ok(M.onlineBonus(24) === 5 && M.onlineBonus(29) === 6 && M.onlineBonus(0) === 0 && M.onlineBonus(24, false) === 0, 'the online share: +5 on 24, +6 on 29; nothing offline or on nothing');
  ok(E.levelCoins({ stars: 3, saved: 3, eggs: 3, perfect: true }).total + M.onlineBonus(29) === 35, 'online, a perfect three-star win pays 35 (37 before 0.8.17: about what was intended)');
  ok(M.isOnline({ web: true, nav: { onLine: false } }) && !M.isOnline({ nav: { onLine: false } }) && M.isOnline({ nav: { onLine: true } }) && M.isOnline({}), 'online: a web portal always; the app by navigator.onLine; unknown counts as online');
  ok(!M.isOnline({ nav: { onLine: true }, bridge: { isOnline: () => false } }) && M.isOnline({ nav: { onLine: false }, bridge: { isOnline: () => true } }) && !M.isOnline({ nav: { onLine: false }, bridge: { isOnline: () => { throw new Error('x'); } } }), 'the app shell\'s own signal wins when it has one');
  let m = null; const day = '2026-12-01';
  ok(M.winVideoLeft(m, day) === F.winVideo.perDay && M.winVideoOk(m, day, 30), 'a new day: the win-video pot is full');
  m = M.winVideoTake(m, day, 30); ok(!M.winVideoOk(m, day, 30) && M.winVideoOk(m, day, F.winVideo.perDay - 30) && M.winVideoOk(m, '2026-12-02', F.winVideo.perDay), 'used up: no Double worth more than what is left today; tomorrow it is full again');
}

// ---- 3. the day's ceiling: videos + spins + daily gifts, every one taken
{
  const top = SP.SPIN.tierX[SP.SPIN.tierX.length - 1];
  let coinEV = 0; for (const s of SP.TABLE) if (s.kind === 'coins') coinEV += (s.w / 100) * Math.round((s.n * top) / 5) * 5;
  const B = M.dayBudget(coinEV * SP.hitRate(), SP.SPIN.adPerDay + SP.SPIN.playMax + SP.SPIN.cheerMax);
  ok(B.ok, `the day's most from videos, spins and daily gifts: ${B.total} (ceiling ${M.DAY.ceiling}: ${Object.entries(B.parts).map(([k, v]) => k + ' ' + v).join(', ')})`);
  const days = {}; for (const [k, P] of Object.entries(PERSONAS)) { const L = []; for (let i = 0; i < 40; i++) L.push(life(P, 900 + i * 31, 30).dayMax); L.sort((a, b) => a - b); days[k] = [L[20], L[39]]; }
  ok(Object.values(days).every(([m]) => m <= M.DAY.ceiling), 'in the town, the best day of the middle player of every kind stays under it: ' + Object.entries(days).map(([k, [m, x]]) => `${k} ${m} (most ${x})`).join(', '));
}

// ---- 4. the purse along the way
{
  const all = purse({ all: true }), none = purse({ all: false }), chick = Math.min(...E.CHICK_IDS.map((id) => E.CHICK_PRICES[id]));
  console.log('     purse after level ' + Object.keys(all).join(' / ') + ': every free thing ' + Object.values(all).join(' / ') + '; no videos ' + Object.values(none).join(' / '));
  const at = M.TARGETS.purseAt, p = all[at], w = Math.floor((at - 1) / PER_ENV); // the world he is in at level 12
  ok(p >= chick && p < 2 * chick, `through level ${at} with every free thing taken: ${p} coins, about one chick (${chick})`);
  const S = { stars: Object.fromEntries(LEVELS.slice(0, at).map((L) => [L.id, 2])), wallet: E.defaultWallet(), gates: {}, skipped: {} }, stars = 2 * at;
  const two = M.gateBuy(w + 2, { stars, perEnv: PER_ENV, coins: p, open: (j) => envOpen(S, j), bossPassed: () => false });
  ok(!two.ok && two.why === 'order', `and the purse cannot open world ${w + 3} (two ahead): refused by the order rule`);
  ok(none[10] >= 300, `the first ten levels are not stingy without videos: ${none[10]} coins at level 10 (a booster is 40 to 90)`);
}

// ---- 5. owning everything: the simulator's targets
{
  const O = owning({ n: 60, days: 90, seed: 1 });
  console.log(`     catalogue ${CATALOGUE} coins; all owned on day (earliest life), owned on day 30: ` + Object.entries(O).map(([k, v]) => `${k} ${v.first > 90 ? '>90' : v.first} ${Math.round(v.at30 * 100)}%`).join(', '));
  ok(Object.values(O).every((v) => v.first >= M.TARGETS.ownAllDay), `no kind of player owns the whole coin catalogue before day ${M.TARGETS.ownAllDay}`);
  ok(O.commuter.at30 <= M.TARGETS.commuterDay30, `the middle player (commuter) owns ${(O.commuter.at30 * 100).toFixed(1)}% of it on day 30 (at most 40%)`);
}

// ---- 6. what stays as it was
{
  const T = town({ n: 15, days: 30, seed: 4 }), broke = Object.entries(T).flatMap(([k, r]) => r.bad.map((b) => k + ': ' + b));
  ok(!broke.length, 'the town under the new rules breaks no rule (no video offline, no gate out of order)' + (broke.length ? ': ' + broke.slice(0, 2).join('; ') : ''));
  const rich = E.addCoins(E.defaultWallet(), 99999);
  ok(E.buyHenSkin(rich, 'golden') === null && E.HEN_SKINS.golden.premium, 'money only: the Golden Hen (with Unlock Everything; no videos and every level open come only with it too)');
  ok(E.SKINS.golden.price > 0 && Object.keys(E.PREMIUM_CHICKS).every((id) => E.CHICK_PRICES[id] > 0), 'coin-buyable, as before: the golden egg and the three premium chicks (they are part of the coin catalogue)');
  ok(HARD_IDS.length > 0 && LEVELS.length % PER_ENV === 0, 'every world is whole (the gate rules count levels per world, never 50 or 5)');
}
// ---- 7. side quests (0.8.17, src/side.js): the Mint's sideQuest row, paid once in full, then a little; their stars count
{
  const Q = F.sideQuest, s = {}, key = SQ.SIDE[0].key, one = E.levelCoins({ stars: 2, saved: 2, eggs: 3 }).total + M.onlineBonus(E.levelCoins({ stars: 2, saved: 2, eggs: 3 }).total);
  const a = SQ.sideWin(s, key, 2), b = SQ.sideWin(s, key, 3), c = SQ.sideWin(s, key, 1);
  ok(a.coins === Q.first && a.fresh && b.coins === Q.replay && c.coins === Q.replay && SQ.sideStars(s, key) === 3, `a side quest pays ${Q.first} on its first win, ${Q.replay} on every later one; its best stars are kept (${SQ.sideStars(s, key)})`);
  ok(Q.first <= 3 * one && Q.replay * 2 < Q.first, `its first win is ${(Q.first / one).toFixed(1)} normal first clears (${one} online, two stars; three would be ${3 * one}: the commuter target leaves room for ${Q.first})`);
  ok(/const bestTotal = \(\) => LEVELS\.reduce\([^\n]*\+ SQ\.sideTotal\(save\)/.test(MAIN) && /SQ\.sideWin\(save/.test(MAIN) && /LEVELS\.length \* 3 \+ SQ\.SIDE_MAX/.test(MAIN), 'main.js: the map\'s star total (gates, chests, the header\'s maximum) counts the bonus stars; a side-quest win pays through side.js');
  const W = []; for (let i = 0; i < 24; i++) W.push(life(PERSONAS.commuter, 500 + i * 13, 30).sideWins);
  ok(W.filter((n) => n > 0).length >= 6, `the simulator plays them: ${W.filter((n) => n > 0).length} of 24 commuters won a side quest by day 30 (${W.reduce((x, y) => x + y, 0)} wins), so the day-30 target above includes their coins`);
}
console.log(bad ? `\n${bad} FAILED` : '\nall mint checks passed');
process.exit(bad ? 1 : 0);
