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
let nw = E.grantIap(E.defaultWallet(), 'no_ads', 'tokN', 1).wallet;
nw = { ...nw, noInter: false };
r = E.grantIap(nw, 'no_ads', 'tokN', 2);
ok(!r.granted && r.wallet.noInter, 'non-consumable entitlement comes back with a known token');

const p = E.grantIap(E.defaultWallet(), 'eggscape_premium', 'tokP', 1).wallet;
ok(p.noAds && p.coins === 1500 && p.chicks.length === E.CHICK_IDS.length && p.henSkin === 'golden' && E.ownsHenSkin(p, 'golden'), 'premium contents');
ok(E.grantIap(p, 'eggscape_premium', 'tokP', 2).wallet.coins === 1500, 'premium coins once');
const legacy = E.grantIap(E.defaultWallet(), 'eggscape_premium', '', 1);
ok(!legacy.granted && legacy.wallet.noAds && legacy.wallet.coins === 0, 'old shell (no token): entitlement only');

let b = { ...E.defaultWallet(), bank: 700 };
ok(E.iapAvailable(b, 'egg_bank') && !E.iapAvailable({ ...b, bank: 599 }, 'egg_bank'), 'bank opens at 600');
b = E.grantIap(b, 'egg_bank', 'tokB', 1).wallet;
ok(b.coins === 700 && b.bank === 0, 'bank pays its coins and empties');
ok(E.grantIap(b, 'egg_bank', 'tokB', 2).wallet.coins === 700, 'bank token not paid twice');

const f = E.grantIap({ ...E.defaultWallet(), charges: 25 }, 'bundle_flock', 'tokF', 1).wallet;
ok(f.charges === E.MAX_CHARGES && f.coins === 3000 + 10 * E.CHARGE_ITEM.price && f.tickets.ally === 10 && f.chicks.length === 6, 'flock bundle: charges over the cap paid as coins');

const sp = E.grantIap(E.defaultWallet(), 'season_pack', 'tokSe', 1).wallet;
ok(sp.season === 'skier' && sp.henSkin === 'skier' && sp.skins.includes('frosty') && sp.coins === 800, 'season pack: Ski Champ + Frosty + 800');
const sp2 = E.grantIap({ ...E.defaultWallet(), henSkins: ['classic', 'skier'] }, 'season_pack', 'tokSe2', 1).wallet;
ok(sp2.season && sp2.season !== 'skier', 'season pack picks an outfit not owned yet');

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
ok(!ads.interstitialAllowed({ levelId: 30 }), 'No Ads owners get no interstitials');
ads.rebind({ wallet: E.defaultWallet() });

const tok = E.sanitizeWallet({ tokens: Array.from({ length: E.MAX_TOKENS + 50 }, (_, i) => 't' + i) });
ok(tok.tokens.length === E.MAX_TOKENS && tok.tokens[tok.tokens.length - 1] === 't' + (E.MAX_TOKENS + 49), 'token list keeps the newest');

console.log(fails ? `${fails} FAILED` : 'all grant checks passed');
process.exit(fails ? 1 : 0);
