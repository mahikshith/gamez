// Purchase grants: idempotent per token, non-consumables re-granted by restore, payers get no interstitials.
// node tools/test-grants.mjs   (exits 1 on a failure)
globalThis.window = globalThis.window || {};
const E = await import('../src/economy.js');
const { ads } = await import('../src/ads.js');
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL', msg); } else console.log('ok  ', msg); };

let w = E.defaultWallet();
let r = E.grantIap(w, 'coins_850', 'tokA', 1000);
ok(r.granted && r.wallet.coins === 850, 'consumable pays once');
r = E.grantIap(r.wallet, 'coins_850', 'tokA', 2000);
ok(!r.granted && r.wallet.coins === 850, 're-delivered consumable token pays nothing');
ok(r.wallet.payer && r.wallet.spend === 2.99 && r.wallet.lastBuyAt === 1000, 'payer flag, spend and last purchase time');
r = E.grantIap(r.wallet, 'coins_250', '', 3000);
ok(!r.granted && r.wallet.coins === 850, 'consumable without a token pays nothing');

w = E.grantIap(E.defaultWallet(), 'starter_nest', 'tokS', 1).wallet;
ok(w.coins === 600 && w.charges === 3 && E.ownedCount(w, 'stone') === 2 && w.henSkins.includes('cocoa') && w.starter, 'starter nest contents');
const again = E.grantIap(w, 'starter_nest', 'tokS', 2);
ok(!again.granted && again.wallet.coins === 600 && again.wallet.charges === 3, 'starter nest restore with a known token: no second payout');
ok(!E.iapAvailable(again.wallet, 'starter_nest'), 'starter nest no longer for sale');

// restore after a reinstall: a fresh save, the same token from Play
const fresh = E.grantIap(E.defaultWallet(), 'starter_nest', 'tokS', 5);
ok(fresh.granted && fresh.wallet.starter && fresh.wallet.coins === 600, 'restore on a new install grants the non-consumable again');

// entitlement re-applied even when the token is known (a flag lost from the save)
let nw = E.grantIap(E.defaultWallet(), 'eggscape_premium', 'tokN', 1).wallet;
nw = { ...nw, noAds: false };
r = E.grantIap(nw, 'eggscape_premium', 'tokN', 2);
ok(!r.granted && r.wallet.noAds && r.wallet.coins === 1500, 'non-consumable entitlement comes back with a known token');

const p = E.grantIap(E.defaultWallet(), 'eggscape_premium', 'tokP', 1).wallet;
ok(p.noAds && p.coins === 1500 && p.chicks.length === E.CHICK_IDS.length && p.henSkin === 'golden' && E.ownsHenSkin(p, 'golden') && E.ownsSkin(p, 'golden'), 'premium contents (Golden Hen and Golden egg)');
ok(E.IAP.eggscape_premium.usd === 2.99 && !/no ads/i.test(E.IAP.eggscape_premium.line), 'Unlock Everything is $2.99 and does not lead with "no ads"');
ok(E.grantIap(p, 'eggscape_premium', 'tokP', 2).wallet.coins === 1500, 'premium coins once');
const legacy = E.grantIap(E.defaultWallet(), 'eggscape_premium', '', 1);
ok(!legacy.granted && legacy.wallet.noAds && legacy.wallet.coins === 0, 'old shell (no token): entitlement only');

let b = { ...E.defaultWallet(), bank: 700 };
ok(E.iapAvailable(b, 'egg_bank') && !E.iapAvailable({ ...b, bank: 599 }, 'egg_bank'), 'bank opens at 600');
b = E.grantIap(b, 'egg_bank', 'tokB', 1).wallet;
ok(b.coins === 700 && b.bank === 0, 'bank pays its coins and empties');
ok(E.grantIap(b, 'egg_bank', 'tokB', 2).wallet.coins === 700, 'bank token not paid twice');

const f = E.grantIap({ ...E.defaultWallet(), charges: 27 }, 'bundle_helper', 'tokF', 1).wallet;
ok(f.charges === E.MAX_CHARGES && f.coins === 800 + 2 * E.CHARGE_ITEM.price && f.tickets.ally === 3 && E.ownedCount(f, 'snips') === 2, 'helper bundle: charges over the cap paid as coins');
ok(E.iapAvailable(f, 'bundle_helper') && E.IAP.bundle_helper.usd === 1.99, 'helper bundle is repeatable, $1.99');

// the catalogue (2026-11-20 shop 2.0): exactly these products, nothing removed left behind
ok(Object.keys(E.IAP).sort().join() === ['bundle_helper', 'coins_1500', 'coins_250', 'coins_3300', 'coins_850', 'eggscape_collector', 'eggscape_premium', 'egg_bank', 'starter_nest'].sort().join(), 'catalogue: 9 products');
ok(E.COIN_PACKS.join() === 'coins_250,coins_850,coins_1500,coins_3300' && E.IAP.starter_nest.usd === 0.99 && E.IAP.eggscape_collector.usd === 5.99, 'prices: starter $0.99, coop $5.99, four coin packs');
const old = E.sanitizeWallet({ noInter: true, season: 'skier', henSkins: ['classic', 'skier'], coins: 5 });
ok(old.noInter && old.season === 'skier' && old.henSkins.includes('skier') && old.coins === 5, 'old saves keep their old flags harmlessly');

// the JS bridge the Android shell calls
const save = { wallet: E.defaultWallet() };
let saved = 0, thanked = 0;
ads.attach(save, () => saved++, () => thanked++);
ok(window.__eggGrant('coins_1500', 'tokJ') === true && save.wallet.coins === 1500 && thanked === 1, '__eggGrant grants and confirms');
ok(window.__eggGrant('coins_1500', 'tokJ') === true && save.wallet.coins === 1500 && thanked === 1, '__eggGrant again: confirmed (so the shell consumes) but not paid');
ok(window.__eggGrant('nope', 'x') === false, 'unknown product is refused');
ok(saved >= 2, 'every grant is persisted');
ok(!ads.interstitialAllowed({ levelId: 30 }), 'payers get no interstitials');
const s2 = { wallet: { ...E.defaultWallet(), noInter: true } };
ads.rebind(s2);
ok(!ads.interstitialAllowed({ levelId: 30 }), 'old No Ads owners still get no interstitials');
const { INTER } = await import('../src/ads.js');
ok(INTER.on === false, 'the app shows no interstitials at all (INTER.on false)');
ads.rebind({ wallet: E.defaultWallet() });

const tok = E.sanitizeWallet({ tokens: Array.from({ length: E.MAX_TOKENS + 50 }, (_, i) => 't' + i) });
ok(tok.tokens.length === E.MAX_TOKENS && tok.tokens[tok.tokens.length - 1] === 't' + (E.MAX_TOKENS + 49), 'token list keeps the newest');

console.log(fails ? `${fails} FAILED` : 'all grant checks passed');
process.exit(fails ? 1 : 0);
