// The web platform profile (economy.js PLATFORM): a portal sells nothing, so income is higher there; prices are the same.
// node tools/test-web.mjs
import * as E from '../src/economy.js';
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('FAIL', m); } };
const win = { stars: 3, saved: 3, eggs: 3, perfect: true, levelId: 10 };
const day = '2026-11-23';
const sum = (f) => { let ad = null, t = 0, k = 0; for (;;) { const c = f(ad, day); if (!c || k > 20) break; t += c; k++; ad = E.noteFreeCoins(ad, day); } return [t, k]; };

// the app: as it was
E.setPlatform(false);
const appWin = E.levelCoins(win), [appVid, appN] = sum(E.freeCoinsNext), appChest = E.dailyChest(day).coins;
ok(appWin.total === 37, 'app: a perfect 3-star win pays 37');
ok(appWin.base + appWin.stars + appWin.perfect === appWin.total, 'app: the parts add up');
ok(appVid === 150 && appN === 6, 'app: six videos a day, 150 coins');
ok(E.HEN_SKINS.golden.premium === true && E.HEN_SKINS.golden.price === 0, 'app: the Golden Hen comes with Premium');
ok(E.buyHenSkin(E.addCoins(E.defaultWallet ? E.defaultWallet() : {}, 5000), 'golden') === null, 'app: coins cannot buy the Golden Hen');
ok(E.adCooldownLeft(1000, 1000 + 61000) > 0, 'app: the video rests three minutes');

// the web: double income, the same prices
const prices = JSON.stringify([E.SKIN_ORDER.map((id) => E.SKINS[id].price), E.CHICK_PRICES, E.BOOSTER_ORDER.map((id) => E.BOOSTERS[id].price)]);
E.setPlatform(true);
const webWin = E.levelCoins(win), [webVid, webN] = sum(E.freeCoinsNext);
ok(webWin.total === 74, 'web: the same win pays 74');
ok(webWin.base + webWin.stars + webWin.perfect === webWin.total, 'web: the parts add up');
ok(webVid === 380 && webN === 8, 'web: eight videos a day, 380 coins');
ok(E.dailyChest(day).coins === appChest * 2, 'web: the daily gift pays double');
ok(E.adCooldownLeft(1000, 1000 + 61000) === 0, 'web: the video rests one minute');
ok(prices === JSON.stringify([E.SKIN_ORDER.map((id) => E.SKINS[id].price), E.CHICK_PRICES, E.BOOSTER_ORDER.map((id) => E.BOOSTERS[id].price)]), 'web: prices are the same as the app');
ok(E.HEN_SKINS.golden.premium === false && E.HEN_SKINS.golden.price > 0, 'web: the Golden Hen is a coin outfit');
const w0 = E.addCoins(E.defaultWallet ? E.defaultWallet() : {}, 5000), w1 = E.buyHenSkin(w0, 'golden');
ok(w1 && E.ownsHenSkin(w1, 'golden') && w1.coins === w0.coins - E.HEN_SKINS.golden.price, 'web: coins buy the Golden Hen');
ok(!/Premium/.test(E.HEN_SKINS.golden.line), 'web: no word of Premium on the Golden Hen');

// and back
E.setPlatform(false);
ok(E.levelCoins(win).total === 37 && E.HEN_SKINS.golden.premium === true, 'switching back restores the app profile');
console.log(bad ? `${bad} of ${n} FAILED` : `web profile: ${n} checks passed`);
process.exit(bad ? 1 : 0);
