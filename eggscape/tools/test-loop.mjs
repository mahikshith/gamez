// The coin loop as a whole (0.8.15): node tools/test-loop.mjs
// What one clear of the 50 levels pays, from the game's own rules, against what there is to buy. Research (Google
// Play's sources-and-sinks advice, Unity's economy guide): audit every faucet against a sink before it ships; when
// free things arrive faster than they are used, nothing is ever bought. Measured before this build: 59 free boosters
// and charges in 50 levels (1.19 a level) while a good player used none. These checks hold the loop in its lane, so a
// new gift cannot be added without this file saying what it did to the whole.
import * as E from '../src/economy.js';
import * as SP from '../src/spin.js';
import { LEVELS } from '../src/data/levels.js';
import { HARD_IDS } from '../src/sim/sim.js';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const price = (id) => E.BOOSTERS[id].price, avgBoost = E.BOOSTER_ORDER.reduce((a, b) => a + price(b), 0) / E.BOOSTER_ORDER.length;

// one clear: every level won once with two stars and the eggs it asks for, no videos, no purchases
const src = {}, add = (k, coins, use = 0, own = 0) => { const s = (src[k] = src[k] || { coins: 0, use: 0, own: 0 }); s.coins += coins; s.use += use; s.own += own; };
let stars = 0;
for (const L of LEVELS.slice(0, 50)) {
  const c = E.levelCoins({ stars: 2, saved: L.target || 1, eggs: 3, perfect: false, hard: HARD_IDS.includes(L.id) });
  add('wins', c.total); stars += 2;
  const T = E.bossTreasure(L.id); if (T) add('boss treasures', T.coins, price(T.booster) + T.charges * E.CHARGE_ITEM.price);
}
for (let i = 0; i < Math.min(E.CHEST_COUNT, Math.floor(stars / E.STARS_PER_CHEST)); i++) { const C = E.chestFor(999, i); add('star chests', C.reward.coins, price(C.reward.booster), C.reward.skin ? E.SKINS[C.reward.skin].price : 0); }
let spins = 0;
{ // the wheel: one spin per SPIN.every fresh wins from level SPIN.from on, at the tier of that point of the game
  const save = { unlocked: 1, wallet: E.defaultWallet() }, W = (s) => (s.w / 100) * SP.hitRate(); // the villains take one free pull in five in the long run
  for (let lv = SP.SPIN.from; lv <= 50; lv++) {
    save.unlocked = lv + 1;
    if ((lv - SP.SPIN.from + 1) % SP.SPIN.every) continue;
    spins++;
    for (const s of SP.TABLE) {
      const P = SP.prizeFor(s, save.wallet, () => 0.5, SP.coinX(save));
      if (P.kind === 'coins') add('free spins', W(s) * P.n);
      else if (P.kind === 'booster' || P.kind === 'charge' || P.kind === 'skip') add('free spins', 0, W(s) * (s.kind === 'booster' ? s.n * avgBoost : P.worth));
      else add('free spins', 0, 0, W(s) * P.worth); // the ticket and the rare bird: things to own, not things to use up
    }
  }
}
add('win tastes', 0, Math.floor(45 / 4 / 4) * avgBoost);
const catalogue = Object.values(E.SKINS).reduce((a, s) => a + (s.price || 0), 0) + Object.values(E.HEN_SKINS).reduce((a, s) => a + (s.price || 0), 0) + Object.values(E.CHICK_PRICES).reduce((a, s) => a + s, 0);
const tot = (k) => Object.values(src).reduce((a, s) => a + s[k], 0), coins = tot('coins'), use = tot('use');
for (const [k, v] of Object.entries(src)) console.log('     ' + k.padEnd(16) + String(Math.round(v.coins)).padStart(6) + ' coins' + String(Math.round(v.use)).padStart(6) + ' to use up' + String(Math.round(v.own)).padStart(6) + ' to own');
console.log('     ' + 'ONE CLEAR'.padEnd(16) + String(Math.round(coins)).padStart(6) + ' coins' + String(Math.round(use)).padStart(6) + ' to use up' + String(Math.round(tot('own'))).padStart(6) + ` to own | ${spins} spins, ${stars} stars | everything to own costs ${catalogue}`);

const perLv = use / avgBoost / 50, share = coins / catalogue;
ok(perLv >= 0.4 && perLv <= 0.8, `free things to use up: ${perLv.toFixed(2)} booster-worths a level (lane 0.4 to 0.8; it was 1.19)`);
ok(share >= 0.3 && share <= 0.5, `one clear pays for ${Math.round(share * 100)}% of everything there is to own (lane 30 to 50%)`);
ok(src['boss treasures'].coins / coins <= 0.6, `boss treasures are ${Math.round(src['boss treasures'].coins / coins * 100)}% of the coins (at most 60%; it was 67%)`);
ok(src.wins.coins / coins >= 0.2, `plain wins are ${Math.round(src.wins.coins / coins * 100)}% of the coins (at least 20%; it was 18%)`);
ok(src.wins.coins / 50 >= 20 && src.wins.coins / 50 <= 35, `a two-star win pays about ${Math.round(src.wins.coins / 50)} coins: a booster is two or three wins away`);
// every recurring sink is dearer than the faucet that could feed it for free in one step
ok(SP.meanWorth(E.defaultWallet(), 1) < SP.SPIN.coin[0], `a coin spin costs more (${SP.SPIN.coin[0]}) than it pays on average (${SP.meanWorth(E.defaultWallet(), 1).toFixed(1)})`);
ok(E.BOOSTER_ORDER.every((b) => E.giftCoins(b) < price(b)), 'a gift into a full bag pays less than the booster costs');
ok(E.GIFT_MAX < E.MAX_OWNED, 'the bag takes more bought boosters than free ones');
const day = E.AD_REWARDS.freeCoins.ladder.reduce((a, b) => a + b, 0);
ok(day <= 160, `the free-coins videos are capped: ${day} coins a day at most`);
console.log(bad ? `\n${bad} FAILED` : '\nall loop checks passed');
process.exit(bad ? 1 : 0);
