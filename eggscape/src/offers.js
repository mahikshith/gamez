// Offer engine (2026-11-16): which one offer, if any, to show the player at a calm moment. Pure logic: it reads the
// save and a few signals, and returns an offer or null; the game draws the card and reports back (shown / dismissed).
//
// Moments: 'win' | 'fail' (on the end card, after its first second), 'home', 'intro' (a gentle line, never a popup),
// 'shop' (the featured card on Deals: no popup caps). Never 'play'.
// Rules (the reviewed plan):
//   starter_nest  non-payer, level 8+ or 3+ sessions, shown at most 3 times, only in the first 7 days, never once bought
//   charge_ad     3+ fails in a row on a level: a free Chick Charge for a rewarded ad (once per level)
//   bundle_helper the same, but only if that ad was declined on this level (once per level, at most once a day)
//   egg_bank      won a level lost 2+ times before, and the bank holds 600+ (every 3 days)
//   premium       level 12+ and 3+ distinct play days (every 7 days)
//   skip_videos   non-payer of Unlock Everything who watched 3+ videos today or 8+ in all, at a win or home (every 3 days):
//                 'Skip the videos' leads to the Unlock Everything sheet; outranks the generic premium rule, no level 12 / play-day need
//   collector     owns Premium or paid before, last purchase 7+ days old (every 14 days)
//   (2026-11-20 shop 2.0: No Ads and the Flock Bundle are gone; Unlock Everything is $2.99 and comes earlier)
//   chick_tip     intro: a locked power chick the player can afford right now (a line on the card, daily at most)
//   coins_ad      web: free coins for a rewarded ad when the player came up short (daily at most)
// Caps (CAPS): 2 popups per session, 3 per day, 20 min apart; none in the first session or before level 6; 3 dismissals of one
// offer silence it for 14 days; nothing at all for a child (save.age 'u13'). Score = fit x value - fatigue; a tie goes
// to the cheaper offer. No timers and no countdowns anywhere: an offer is the same price for everyone, every time.
// Web portals sell nothing: there only the rewarded suggestions (charge_ad, coins_ad) can come up.
import { IAP, iapAvailable, BANK_OPEN } from './economy.js';
import { now as gameNow } from './clock.js'; // 0.8.17: a day that never goes back (moving the phone's date repeats nothing)

// The first-launch age question and the child-safe mode behind it (no offer popups, a parent check before any
// real-money purchase, child-directed ad requests). One switch, in case the owner picks another audience.
// 2026-11-19 (mykee): off, no age question on the home screen. Store listing must then target 13+ (Play Console >
// Target audience); a kids audience would need child-directed ads for everyone instead.
export const AGE_GATE = false;

// 2026-11-20 (mykee: monetise properly, keep the fun): 2 a session, 3 a day, 20 min apart; the Director's help cards on
// the fail screen are not popups and do not count
export const CAPS = { perSession: 2, perDay: 3, gapMin: 20, fromLevel: 9, silenceAfter: 3, silenceDays: 14 };
const DAY = 864e5, MIN = 6e4;
const dayKey = (now) => { const d = new Date(gameNow(now)); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

const TEXT = {
  starter_nest: { title: 'Starter Nest', line: 'A small start: 600 coins, 3 Chick Charges, 2 of every boost and the Cocoa Hen. Only once.' },
  bundle_helper: { title: 'Helper Bundle', line: 'Stuck here? 800 coins, 5 Chick Charges, 3 Ally Tickets and 2 of every boost.' },
  egg_bank: { title: 'Your Golden Egg Bank is full', line: 'Crack it open and take every coin inside.' },
  skip_videos: { title: 'Skip the videos', line: 'Unlock Everything gives every video reward at once. One payment, yours for good.' },
  eggscape_premium: { title: 'Unlock Everything', line: 'One payment and the game is yours: every bonus without a video, every level open, all six power chicks and the Golden Hen.' },
  eggscape_collector: { title: 'The Whole Coop', line: 'Every hen outfit, every egg, the three premium chicks and 3000 coins. Forever.' },
  charge_ad: { title: 'A free Chick Charge', line: 'Watch a short video and your power chick is ready at once next try.' },
  coins_ad: { title: 'Free coins', line: 'Watch a short video for 25 coins.' },
};

// the offer state in the save, filled in and made safe (old saves, hand edits)
export function offerState(save) {
  const o = save.offers && typeof save.offers === 'object' ? save.offers : {};
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  save.offers = {
    seed: o.seed === 0 || o.seed === 1 ? o.seed : null, // the A/B arm, set once
    sessions: Math.max(0, Math.floor(Number(o.sessions) || 0)),
    firstDay: Number(o.firstDay) || 0,
    days: Array.isArray(o.days) ? o.days.filter((d) => typeof d === 'string').slice(-30) : [], // distinct play days
    shown: obj(o.shown), dismissed: obj(o.dismissed),
    lastPopupAt: Number(o.lastPopupAt) || 0,
    popupsToday: o.popupsToday && typeof o.popupsToday.day === 'string' ? { day: o.popupsToday.day, n: Math.floor(Number(o.popupsToday.n) || 0) } : { day: '', n: 0 },
    sessionPopup: o.sessionPopup === true ? 1 : Math.max(0, Math.floor(Number(o.sessionPopup) || 0)), // popups this session
    ads: Math.max(0, Math.floor(Number(o.ads) || 0)), // rewarded ads watched in all
    adsDay: o.adsDay && typeof o.adsDay.day === 'string' ? { day: o.adsDay.day, n: Math.max(0, Math.floor(Number(o.adsDay.n) || 0)) } : { day: '', n: 0 }, // ... and today
    chipDay: typeof o.chipDay === 'string' ? o.chipDay : '', // the day the "Skip videos for good" chip last showed
    lvAd: obj(o.lvAd), lvDeclined: obj(o.lvDeclined), lvHelper: obj(o.lvHelper), // per level: charge ad shown / declined, helper shown
  };
  return save.offers;
}

// a new app session: count it, remember the play day, set the A/B arm once
export function startSession(save, now, rand = Math.random) {
  const o = offerState(save);
  if (o.seed == null) o.seed = rand() < 0.5 ? 0 : 1;
  o.sessions += 1;
  if (!o.firstDay) o.firstDay = now;
  const d = dayKey(now);
  if (!o.days.includes(d)) o.days = [...o.days, d].slice(-30);
  o.sessionPopup = 0;
  return o;
}

export function noteRewarded(save, now = Date.now()) {
  const o = offerState(save), d = dayKey(now);
  o.ads += 1;
  o.adsDay = o.adsDay.day === d ? { day: d, n: o.adsDay.n + 1 } : { day: d, n: 1 };
}
// videos watched today
export const adsToday = (save, now = Date.now()) => { const o = offerState(save); return o.adsDay.day === dayKey(now) ? o.adsDay.n : 0; };
export const VIDEOS = { today: 3, all: 8 }; // the "too many videos" line
// the small "Skip videos for good" chip after a rewarded video: money shop, not premium, not a child, 3+ videos today, once a day
export function skipChip(save, now, money) {
  const o = offerState(save);
  if (!money || childSafe(save) || (save.wallet || {}).noAds || o.chipDay === dayKey(now) || adsToday(save, now) < VIDEOS.today) return false;
  return true;
}
export function markChip(save, now) { offerState(save).chipDay = dayKey(now); }

// ---- the age question and child-safe mode
export const needsAge = (save, money) => AGE_GATE && !!money && save.age !== 'u13' && save.age !== '13+';
export const childSafe = (save) => AGE_GATE && save.age === 'u13';
// "What is 7 x 6?" with three choices, one right (the parent check before a purchase in child-safe mode)
export function parentQuestion(rand = Math.random) {
  const a = 6 + Math.floor(rand() * 4), b = 6 + Math.floor(rand() * 4), answer = a * b;
  const opts = [answer, answer + a, answer - b], k = Math.floor(rand() * 3); // the right answer lands in any of the three spots
  return { a, b, answer, choices: [...opts.slice(k), ...opts.slice(0, k)] };
}

const lastShown = (o, id) => { const L = o.shown[id]; return Array.isArray(L) && L.length ? L[L.length - 1] : 0; };
const shownCount = (o, id) => (Array.isArray(o.shown[id]) ? o.shown[id].length : 0);
const shownSince = (o, id, t) => (Array.isArray(o.shown[id]) ? o.shown[id].filter((x) => x >= t).length : 0);
const every = (o, id, now, days) => now - lastShown(o, id) >= days * DAY;
function silenced(o, id, now) {
  const d = o.dismissed[id];
  return !!(d && d.n >= CAPS.silenceAfter && now - (d.lastAt || 0) < CAPS.silenceDays * DAY);
}

// Why no popup may show right now (null: one may). The shop's featured card ignores these.
export function blocked(save, now, moment) {
  const o = offerState(save);
  if (moment === 'play') return 'play';
  if (childSafe(save)) return 'child';
  if (o.sessions <= 1) return 'first session';
  if ((save.unlocked || 1) < CAPS.fromLevel) return 'early';
  if (o.sessionPopup >= CAPS.perSession) return 'session';
  if (o.popupsToday.day === dayKey(now) && o.popupsToday.n >= CAPS.perDay) return 'day';
  if (now - o.lastPopupAt < CAPS.gapMin * MIN) return 'gap';
  return null;
}

// ctx: { now, money (real money sold here), levelId, fails (losses in a row on this level), prevFails (losses before
// this win), nearMiss (lost one egg short), lastPrice (the last price the player could not pay), adReady (the free-coins
// ad is off cooldown), chick: { id, name, price } (intro: the cheapest locked chick) }
export function evaluate(save, moment, ctx = {}) {
  const now = ctx.now || Date.now(), o = offerState(save), w = save.wallet || {};
  const shop = moment === 'shop';
  if (!shop && blocked(save, now, moment)) return null;
  const money = !!ctx.money, payer = !!w.payer, unlocked = save.unlocked || 1, lv = ctx.levelId;
  const short = ctx.lastPrice > 0 && (w.coins || 0) < ctx.lastPrice;
  const C = [];
  const sku = (id, fit, value) => { if (money && iapAvailable(w, id)) C.push({ id, sku: id, fit, value, usd: IAP[id].usd, ...TEXT[id] }); };
  const end = moment === 'win' || moment === 'fail', calm = end || moment === 'home';
  // starter nest: only after the first two bosses (2026-11-20, mykee: the $1.99 popup came far too early)
  if ((calm || shop) && !payer && !w.starter && (shop || unlocked >= 12) && (shop || shownCount(o, 'starter_nest') < 3) && now - (o.firstDay || now) < 7 * DAY) sku('starter_nest', 1 + (short ? 0.2 : 0), 3);
  // stuck: a free charge for an ad first; the helper bundle only after that ad was declined on this level
  if (moment === 'fail' && (ctx.fails || 0) >= 3 && lv != null) {
    if (!o.lvAd[lv]) C.push({ id: 'charge_ad', item: 'charge', fit: 1 + (ctx.nearMiss ? 0.2 : 0), value: 1, usd: 0, ...TEXT.charge_ad });
    else if (o.lvDeclined[lv] && !o.lvHelper[lv] && shownSince(o, 'bundle_helper', now - DAY) < 1) sku('bundle_helper', 0.9 + (short ? 0.2 : 0), 2);
  }
  if ((moment === 'win' || shop) && (shop || (ctx.prevFails || 0) >= 2) && (w.bank || 0) >= BANK_OPEN && (shop || every(o, 'egg_bank', now, 3))) sku('egg_bank', 0.9, 1.5);
  // too many videos: a calm moment only, never the shop card; the button opens the bundle's sheet, it never pays
  if ((moment === 'win' || moment === 'home') && money && !w.noAds && iapAvailable(w, 'eggscape_premium') && (adsToday(save, now) >= VIDEOS.today || o.ads >= VIDEOS.all) && every(o, 'skip_videos', now, 3)) C.push({ id: 'skip_videos', sku: 'eggscape_premium', fit: 1, value: 2.5, usd: IAP.eggscape_premium.usd, ...TEXT.skip_videos });
  if ((calm || shop) && unlocked >= 12 && o.days.length >= 3 && (shop || every(o, 'eggscape_premium', now, 7))) sku('eggscape_premium', 0.7, 2.5);
  if ((calm || shop) && (payer || w.noAds) && now - (w.lastBuyAt || 0) >= 7 * DAY && (shop || every(o, 'eggscape_collector', now, 14))) sku('eggscape_collector', 0.8, 2);
  if (moment === 'intro' && ctx.chick && (w.coins || 0) >= ctx.chick.price && every(o, 'chick_tip', now, 1)) {
    C.push({ id: 'chick_tip', item: 'chick:' + ctx.chick.id, gentle: true, fit: 0.5, value: 1, usd: 0, title: ctx.chick.name, line: `Unlock ${ctx.chick.name} now for ${ctx.chick.price} coins` });
  }
  if (!money && calm && short && ctx.adReady && every(o, 'coins_ad', now, 1)) C.push({ id: 'coins_ad', item: 'coins', fit: 0.6, value: 1, usd: 0, ...TEXT.coins_ad });
  let best = null;
  for (const c of C) {
    if (silenced(o, c.id, now)) continue;
    if (shop && !c.sku) continue;
    const d = o.dismissed[c.id], fatigue = 0.25 * shownSince(o, c.id, now - 14 * DAY) + 0.4 * (d ? Math.min(d.n, CAPS.silenceAfter) : 0);
    c.score = c.fit * ((ctx.lean && ctx.lean[c.id]) || 1) * c.value - fatigue; // lean: the Brain's fit for this player (brain.js), order only
    if (!best || c.score > best.score + 1e-9 || (Math.abs(c.score - best.score) <= 1e-9 && c.usd < best.usd)) best = c;
  }
  if (!best) return null;
  const { fit, value, ...out } = best; // eslint-disable-line no-unused-vars
  return out;
}

// the game showed an offer (any moment but 'shop'): it counts against the caps
export function markShown(save, offer, now, levelId) {
  const o = offerState(save);
  o.shown[offer.id] = [...(Array.isArray(o.shown[offer.id]) ? o.shown[offer.id] : []), now].slice(-20);
  o.lastPopupAt = now;
  const d = dayKey(now);
  o.popupsToday = o.popupsToday.day === d ? { day: d, n: o.popupsToday.n + 1 } : { day: d, n: 1 };
  o.sessionPopup += 1;
  if (offer.id === 'charge_ad' && levelId != null) o.lvAd[levelId] = 1;
  if (offer.id === 'bundle_helper' && levelId != null) o.lvHelper[levelId] = 1;
}

// "No thanks"
export function markDismissed(save, offer, now, levelId) {
  const o = offerState(save), d = o.dismissed[offer.id] || { n: 0, lastAt: 0 };
  o.dismissed[offer.id] = { n: d.n + 1, lastAt: now };
  if (offer.id === 'charge_ad' && levelId != null) o.lvDeclined[levelId] = 1;
}
