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
//   rewind   rewind 12 s after a fail       double   double the level's coins     coins   free coins (cooldown)
//   ally     a farm friend for this attempt booster  a free booster on the intro  (0.8.19: the hint is gone; the pause page's Help is a booster)
//   skip     skip a level you are stuck on  charge   one Chick Charge             gate    open the next world early
// Stuck help: after STUCK_FAILS fails in a row on one level the fail card offers Skip (ad, or coins) and a free charge.
// Interstitials (app only): off since 2026-11-20 (INTER.on). Their cadence (never before level INTER.from, INTER.gapS
// seconds and INTER.levels finished levels apart) now offers the win card's Bonus chest video instead.
// Real-money products (2026-11-16 shop revamp): the table lives in economy.js (IAP). The Android shell buys through Play
// Billing and hands every purchase it sees to window.__eggGrant(sku, token); the grant is idempotent per token, and the
// shell consumes or acknowledges a purchase only after that call returned true (so a crash mid-way never loses one).
// Payers (any purchase) and No Ads owners get no interstitials; rewarded ads stay their choice.
import portal from './sdk/portal.js';
import { IAP, grantIap, usdHint, SKIP_PRICE } from './economy.js';
import * as GD from './guard.js'; // 0.8.17: refunds take the unlock back (the store's own record decides)

/* global __APP__, __DEV__ */
const APP = typeof __APP__ !== 'undefined' && __APP__;
// Real money lives in the app only. Web portals (Poki and the like) allow no in-game purchases and run their own ads:
// there the shop is coins only. A dev build previews the app's shop with ?shop=app (screenshots and QA).
const DEV = typeof __DEV__ !== 'undefined' && __DEV__;
const MONEY = APP || (DEV && typeof location !== 'undefined' && /[?&]shop=app\b/.test(location.search || ''));
export const PREMIUM_SKU = 'eggscape_premium';
export const PREMIUM_PRICE_HINT = usdHint(PREMIUM_SKU); // shown until the store returns the real localized price
export const STUCK_FAILS = 3;
export const SKIP_COINS = SKIP_PRICE; // 0.8.19: economy.js decides it (near a mid booster)
// 2026-11-20 shop 2.0 (mykee: "every ad should be beneficial, for the player and for us"): the app shows no
// interstitials (on: false). The same cadence now decides when the win card offers the Bonus chest video instead of
// "Double coins" (bonusDue). Web portals keep their own commercialBreak exactly as before: portals require it.
export const INTER = { on: false, from: 9, /* 0.8.17: 8 on the 50-level road */ gapS: 240, levels: 3 };

const st = { busy: false, lastInter: 0, sinceInter: 0, prices: {}, fails: {}, seq: 0, pending: new Map(), adWait: new Set(), childSafe: false };
let save = null, persist = () => {}, onGrant = () => {}, onRevoke = () => {};

// the Android shell answers through these globals: window.__eggAd(id, ok), window.__eggBuy(id, ok, state),
// window.__eggGrant(sku, token) -> true once the grant is saved, window.__eggPrice(sku, price)
function bridge() { try { return APP && typeof window !== 'undefined' && window.EggApp ? window.EggApp : null; } catch (_) { return null; } }
// apply a purchase to the save. True when it is safely recorded (also when the token was granted before), so the shell
// may consume / acknowledge it; false when the game cannot take it yet (no save loaded): the shell keeps it for later.
// again: a one-time product the store says was granted and acknowledged before (a reinstall or a cleared save): the unlock
// comes back, its coins and boosts are not paid twice (the token list went with the old save)
function grant(sku, token, again) {
  if (!save || !save.wallet || !IAP[sku]) return false;
  const before = save.wallet, r = grantIap(before, sku, again === true && IAP[sku].type === 'once' ? '' : token, Date.now());
  const g = GD.onGrant(save.guard, sku, token, before, r.wallet, r.granted, Date.now()); // remembered with its token (src/guard.js)
  save.wallet = g.wallet; save.guard = g.guard;
  persist();
  if (r.granted) { try { onGrant(sku); } catch (_) { /* the game's thank-you is cosmetic */ } }
  return true;
}
if (typeof window !== 'undefined') {
  window.__eggAd = (id, ok) => { st.adWait.delete(id); const p = st.pending.get(id); if (p) { st.pending.delete(id); p(!!ok); } };
  window.__eggBuy = (id, ok, state) => { const p = st.pending.get(id); if (p) { st.pending.delete(id); p(ok ? true : state === 'pending' ? 'pending' : false); } };
  window.__eggGrant = (sku, token, again) => grant(String(sku || ''), String(token || ''), again === true);
  // older shells only report Premium ownership (no token): the entitlement is applied, nothing is paid twice
  window.__eggOwned = (sku, on) => { if (on && sku === PREMIUM_SKU) grant(PREMIUM_SKU, ''); };
  window.__eggPrice = (sku, price) => { if (IAP[sku] && price) st.prices[sku] = String(price); };
  // 0.8.17: the one-time products the store lists for this account, after a SUCCESSFUL query only (Monetization.java
  // restore). A purchase it stops listing is taken back after two such checks an hour apart (src/guard.js).
  window.__eggStore = (json) => {
    if (!save || !save.wallet) return false;
    let owned = null;
    try { owned = JSON.parse(String(json)); } catch (_) { return false; }
    if (!Array.isArray(owned) || !online()) return false; // a phone that is offline may answer from a cache: not counted
    const r = GD.check(save.guard, save.wallet, owned, Date.now());
    save.guard = r.guard; save.wallet = r.wallet;
    persist();
    if (r.revoked.length) { try { onRevoke(r.revoked); } catch (_) { /* the game's line is cosmetic */ } }
    return true;
  };
}
const online = () => { try { return typeof navigator === 'undefined' || navigator.onLine !== false; } catch (_) { return true; } };
// 0.8.17 the iPhone shell (window.EGG_APP, no __APP__) has no ad SDK yet: its videos are unavailable, never free
const iosShell = () => { try { return !APP && typeof window !== 'undefined' && window.EGG_APP === true && !(window.EggApp && typeof window.EggApp.showRewarded === 'function'); } catch (_) { return false; } };
// is a rewarded ad loaded (Android: Monetization.adReady), asked at most once a second
const rdy = { t: -1e9, v: true };
function adLoaded(b) {
  if (typeof b.adReady !== 'function') return true; // an older shell: it cannot tell
  const now = Date.now();
  if (now - rdy.t > 1000) { rdy.t = now; try { rdy.v = b.adReady() !== false; } catch (_) { rdy.v = true; } }
  return rdy.v;
}
function callNative(fn, ...args) {
  const b = bridge();
  if (!b || typeof b[fn] !== 'function') return Promise.resolve(false);
  const id = 'r' + ++st.seq;
  const ad = fn === 'showRewarded' || fn === 'showInterstitial';
  return new Promise((resolve) => {
    st.pending.set(id, resolve);
    if (ad) st.adWait.add(id);
    // never hold the game (main.js also lets go of an ad wait after a few seconds of the game showing again: ads.cancelWait)
    setTimeout(() => { st.adWait.delete(id); if (st.pending.has(id)) { st.pending.delete(id); resolve(false); } }, 120000);
    try { b[fn](...args, id); } catch (_) { st.adWait.delete(id); st.pending.delete(id); resolve(false); }
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
  // the game's calm line when a refunded purchase was taken back (skus)
  onRevoke(fn) { onRevoke = fn || onRevoke; },
  // 0.8.17: can a video be shown right now? Offline, no ad loaded, or the iPhone shell (no ads wired): no. Unlock
  // Everything owners need no video. Every video button shows its offline state when this is false.
  get videoOk() {
    if (this.premium) return true;
    if (!online() || iosShell()) return false;
    const b = bridge();
    if (b) return typeof b.showRewarded === 'function' && adLoaded(b);
    return true;
  },
  // why not: 'offline' (no connection) or 'none' (online, but no video loaded, or no ads on this phone yet: the iPhone)
  get videoWhy() { return this.videoOk ? '' : !online() ? 'offline' : 'none'; },
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
  // 0.8.1: mykee's test ad left the game greyed out with no way back. When the ad's screen closes without telling us
  // (the system dropped it, the app was reopened from its icon), the player gets out with "Back to game" or Back.
  // A rewarded ad given up this way pays nothing (Android already answers with the real result when it can).
  cancelWait() {
    let n = 0;
    for (const id of st.adWait) { const p = st.pending.get(id); st.pending.delete(id); if (p) { p(false); n++; } }
    st.adWait.clear();
    return n;
  },

  // a rewarded placement: resolves true when the reward is earned. Premium players get it without an ad.
  async rewarded(tag) {
    if (this.premium) return true;
    if (st.busy || !this.videoOk) return false; // no free reward in place of a video (the iPhone shell used to pay after 1.2 s)
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
    if (!INTER.on || !this.interstitialAllowed(info)) return;
    st.busy = true;
    try { if (await callNative('showInterstitial')) { st.lastInter = Date.now(); st.sinceInter = 0; } } catch (_) { /* fail open */ }
    st.busy = false;
  },
  interstitialAllowed({ levelId = 0, afterFail = false } = {}) {
    if (this.premium || this.payer || afterFail || levelId < INTER.from) return false;
    return this.cadence();
  },
  cadence() { return st.sinceInter >= INTER.levels && Date.now() - st.lastInter >= INTER.gapS * 1000; },
  // the win card's Bonus chest (app only): when an ad break would have been due by the old cadence, never on a losing
  // streak (main.js passes frustrated: DR.frustration >= 0.5). Payers and Premium get it too (Premium: no video).
  // The caller reports it shown (noteBonus) so the cadence restarts, as a shown interstitial did.
  bonusDue({ levelId = 0, frustrated = false } = {}) {
    if (!MONEY || frustrated || levelId < INTER.from) return false;
    return this.cadence();
  },
  noteBonus() { st.lastInter = Date.now(); st.sinceInter = 0; },

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
