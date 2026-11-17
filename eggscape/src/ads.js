// Ads and purchases: one engine for every build (2026-11-15).
//
// The game asks this module, never a portal or the app shell directly. It decides WHETHER an ad may be offered or shown
// (the policy), and HOW (the provider: the portal SDK on the web, the Android shell's AdMob / Play Billing bridge in the
// app). Nothing here draws.
//
// Business model (mykee, 2026-11-12 / 11-15): the app is free. Revenue = rewarded ads, a few interstitials in the app
// only, cosmetic skins and coins, and one PREMIUM purchase ("buy the game"): no interstitials ever again, and every
// rewarded bonus is granted at once without an ad, plus the Golden Hen skin. Web portals keep "every ad is a reward"
// (the portal itself runs its between-level breaks through commercialBreak).
//
// Rewarded placements (always the player's choice, always a reward):
//   rewind   rewind 5 s after a fail        double   double the level's coins     coins   free coins (cooldown)
//   ally     a farm friend for this attempt booster  a free booster on the intro  hint    a hint
//   skip     skip a level you are stuck on  charge   one Chick Charge             gate    open the next world early
// Stuck help: after STUCK_FAILS fails in a row on one level the fail card offers Skip (ad, or coins) and a free charge.
// Interstitials (app only): never before level INTER.from, never right after a fail, at least INTER.gapS seconds and
// INTER.levels finished levels apart, never for premium players.
// Real-money products (2026-11-16 shop revamp): the table lives in economy.js (IAP). The Android shell buys through Play
// Billing and hands every purchase it sees to window.__eggGrant(sku, token); the grant is idempotent per token, and the
// shell consumes or acknowledges a purchase only after that call returned true (so a crash mid-way never loses one).
// Payers (any purchase) and No Ads owners get no interstitials; rewarded ads stay their choice.
import portal from './sdk/portal.js';
import { IAP, grantIap, usdHint } from './economy.js';

/* global __APP__, __DEV__ */
const APP = typeof __APP__ !== 'undefined' && __APP__;
// Real money lives in the app only. Web portals (Poki and the like) allow no in-game purchases and run their own ads:
// there the shop is coins only. A dev build previews the app's shop with ?shop=app (screenshots and QA).
const DEV = typeof __DEV__ !== 'undefined' && __DEV__;
const MONEY = APP || (DEV && typeof location !== 'undefined' && /[?&]shop=app\b/.test(location.search || ''));
export const PREMIUM_SKU = 'eggscape_premium';
export const PREMIUM_PRICE_HINT = usdHint(PREMIUM_SKU); // shown until the store returns the real localized price
export const STUCK_FAILS = 3;
export const SKIP_COINS = 150;
export const INTER = { from: 8, gapS: 240, levels: 3 };

const st = { busy: false, lastInter: 0, sinceInter: 0, prices: {}, fails: {}, seq: 0, pending: new Map(), childSafe: false };
let save = null, persist = () => {}, onGrant = () => {};

// the Android shell answers through these globals: window.__eggAd(id, ok), window.__eggBuy(id, ok, state),
// window.__eggGrant(sku, token) -> true once the grant is saved, window.__eggPrice(sku, price)
function bridge() { try { return APP && typeof window !== 'undefined' && window.EggApp ? window.EggApp : null; } catch (_) { return null; } }
// apply a purchase to the save. True when it is safely recorded (also when the token was granted before), so the shell
// may consume / acknowledge it; false when the game cannot take it yet (no save loaded): the shell keeps it for later.
// again: a one-time product the store says was granted and acknowledged before (a reinstall or a cleared save): the unlock
// comes back, its coins and boosts are not paid twice (the token list went with the old save)
function grant(sku, token, again) {
  if (!save || !save.wallet || !IAP[sku]) return false;
  const r = grantIap(save.wallet, sku, again === true && IAP[sku].type === 'once' ? '' : token, Date.now());
  save.wallet = r.wallet;
  persist();
  if (r.granted) { try { onGrant(sku); } catch (_) { /* the game's thank-you is cosmetic */ } }
  return true;
}
if (typeof window !== 'undefined') {
  window.__eggAd = (id, ok) => { const p = st.pending.get(id); if (p) { st.pending.delete(id); p(!!ok); } };
  window.__eggBuy = (id, ok, state) => { const p = st.pending.get(id); if (p) { st.pending.delete(id); p(ok ? true : state === 'pending' ? 'pending' : false); } };
  window.__eggGrant = (sku, token, again) => grant(String(sku || ''), String(token || ''), again === true);
  // older shells only report Premium ownership (no token): the entitlement is applied, nothing is paid twice
  window.__eggOwned = (sku, on) => { if (on && sku === PREMIUM_SKU) grant(PREMIUM_SKU, ''); };
  window.__eggPrice = (sku, price) => { if (IAP[sku] && price) st.prices[sku] = String(price); };
}
function callNative(fn, ...args) {
  const b = bridge();
  if (!b || typeof b[fn] !== 'function') return Promise.resolve(false);
  const id = 'r' + ++st.seq;
  return new Promise((resolve) => {
    st.pending.set(id, resolve);
    setTimeout(() => { if (st.pending.has(id)) { st.pending.delete(id); resolve(false); } }, 120000); // never hold the game
    try { b[fn](...args, id); } catch (_) { st.pending.delete(id); resolve(false); }
  });
}

export const ads = {
  // the game hands over its save (wallet.noAds lives there) and how to persist it
  attach(s, persistFn, grantFn) {
    save = s; persist = persistFn || persist; onGrant = grantFn || onGrant;
    const b = bridge();
    if (b && typeof b.restorePurchases === 'function') { try { b.restorePurchases(); } catch (_) { /* optional */ } }
  },
  rebind(s) { save = s; },
  get premium() { return !!(save && save.wallet && save.wallet.noAds); },
  get canBuyPremium() { return this.canBuy && !this.premium; },
  get premiumPrice() { return this.price(PREMIUM_SKU); },
  // real-money products are shown at all (the app; never on a web portal)
  get moneyShop() { return MONEY; },
  // the app can take real money right now (the Android bridge is there)
  get canBuy() { const b = bridge(); return !!(b && typeof b.buy === 'function'); },
  // the localized price from Google once it arrived, else the USD hint from the table
  price(sku) { return st.prices[sku] || usdHint(sku); },
  get payer() { return !!(save && save.wallet && (save.wallet.payer || save.wallet.noInter)); },
  // child-safe ads (the age gate in offers.js): ad requests are tagged child-directed from now on
  setChildSafe(on) {
    st.childSafe = !!on;
    const b = bridge();
    if (b && typeof b.setChildSafe === 'function') { try { b.setChildSafe(st.childSafe); } catch (_) { /* older shell */ } }
  },
  get childSafe() { return st.childSafe; },
  get busy() { return st.busy; },

  // a rewarded placement: resolves true when the reward is earned. Premium players get it without an ad.
  async rewarded(tag) {
    if (this.premium) return true;
    if (st.busy) return false;
    st.busy = true;
    let ok = false;
    try {
      const b = bridge();
      ok = b && typeof b.showRewarded === 'function' ? await callNative('showRewarded', String(tag || 'reward')) : await portal.rewarded(tag);
    } catch (_) { ok = false; }
    st.busy = false;
    return ok;
  },

  // between levels. App: an interstitial when the policy allows it. Web: the portal's own break (it paces itself).
  async between(info = {}) {
    st.sinceInter++;
    const b = bridge();
    if (!b) { try { await portal.commercialBreak(); } catch (_) { /* fail open */ } return; }
    if (!this.interstitialAllowed(info)) return;
    st.busy = true;
    try { if (await callNative('showInterstitial')) { st.lastInter = Date.now(); st.sinceInter = 0; } } catch (_) { /* fail open */ }
    st.busy = false;
  },
  interstitialAllowed({ levelId = 0, afterFail = false } = {}) {
    if (this.premium || this.payer || afterFail || levelId < INTER.from) return false;
    if (st.sinceInter < INTER.levels) return false;
    return Date.now() - st.lastInter >= INTER.gapS * 1000;
  },

  // stuck detection: the fail card asks how many times in a row this level was lost
  fail(levelId) { st.fails[levelId] = (st.fails[levelId] || 0) + 1; return st.fails[levelId]; },
  won(levelId) { delete st.fails[levelId]; },
  fails(levelId) { return st.fails[levelId] || 0; },
  stuck(levelId) { return (st.fails[levelId] || 0) >= STUCK_FAILS; },

  // buy a real-money product (app only). Resolves 'web' (no store here), true (bought; the grant already arrived through
  // __eggGrant), 'pending' (the payment is still being processed: granted later when Play reports it), or false.
  async purchase(sku) {
    if (!IAP[sku] || !MONEY) return false;
    if (!this.canBuy) return 'web';
    if (st.busy) return false;
    st.busy = true;
    let r = false;
    try { r = await callNative('buy', sku); } catch (_) { r = false; }
    st.busy = false;
    return r;
  },
  async buyPremium() { return this.premium || (await this.purchase(PREMIUM_SKU)) === true; },
  restore() { const b = bridge(); if (b && typeof b.restorePurchases === 'function') { try { b.restorePurchases(); } catch (_) { /* optional */ } } },
};
export default ads;
