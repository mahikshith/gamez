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
import portal from './sdk/portal.js';

/* global __APP__ */
const APP = typeof __APP__ !== 'undefined' && __APP__;
export const PREMIUM_SKU = 'eggscape_premium';
export const PREMIUM_PRICE_HINT = '$3.99'; // shown until the store returns the real localized price
export const STUCK_FAILS = 3;
export const SKIP_COINS = 150;
export const INTER = { from: 8, gapS: 240, levels: 3 };

const st = { busy: false, lastInter: 0, sinceInter: 0, price: '', fails: {}, seq: 0, pending: new Map() };
let save = null, persist = () => {};

// the Android shell answers through these globals: window.__eggAd(id, ok) and window.__eggBuy(id, ok, owned)
function bridge() { try { return APP && typeof window !== 'undefined' && window.EggApp ? window.EggApp : null; } catch (_) { return null; } }
if (typeof window !== 'undefined') {
  window.__eggAd = (id, ok) => { const p = st.pending.get(id); if (p) { st.pending.delete(id); p(!!ok); } };
  window.__eggBuy = (id, ok) => { const p = st.pending.get(id); if (p) { st.pending.delete(id); p(!!ok); } };
  window.__eggOwned = (sku, on) => { if (sku === PREMIUM_SKU && save) { save.wallet.noAds = !!on; persist(); } };
  window.__eggPrice = (sku, price) => { if (sku === PREMIUM_SKU) st.price = String(price || ''); };
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
  attach(s, persistFn) {
    save = s; persist = persistFn || persist;
    const b = bridge();
    if (b && typeof b.restorePurchases === 'function') { try { b.restorePurchases(); } catch (_) { /* optional */ } }
  },
  rebind(s) { save = s; },
  get premium() { return !!(save && save.wallet && save.wallet.noAds); },
  get canBuyPremium() { const b = bridge(); return !!(b && typeof b.buy === 'function') && !this.premium; },
  get premiumPrice() { return st.price || PREMIUM_PRICE_HINT; },
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
    if (this.premium || afterFail || levelId < INTER.from) return false;
    if (st.sinceInter < INTER.levels) return false;
    return Date.now() - st.lastInter >= INTER.gapS * 1000;
  },

  // stuck detection: the fail card asks how many times in a row this level was lost
  fail(levelId) { st.fails[levelId] = (st.fails[levelId] || 0) + 1; return st.fails[levelId]; },
  won(levelId) { delete st.fails[levelId]; },
  fails(levelId) { return st.fails[levelId] || 0; },
  stuck(levelId) { return (st.fails[levelId] || 0) >= STUCK_FAILS; },

  // the one-time Premium purchase (app only). Resolves true when owned.
  async buyPremium() {
    if (this.premium) return true;
    if (!bridge()) return false;
    st.busy = true;
    const ok = await callNative('buy', PREMIUM_SKU);
    st.busy = false;
    if (ok && save) { save.wallet.noAds = true; persist(); }
    return ok;
  },
  restore() { const b = bridge(); if (b && typeof b.restorePurchases === 'function') { try { b.restorePurchases(); } catch (_) { /* optional */ } } },
};
export default ads;
