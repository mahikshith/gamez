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
//   no_ads        5+ rewarded ads watched, non-payer (every 5 days)
//   premium       level 20+ and 5+ distinct play days (every 14 days)
//   bundle_flock  a payer whose last purchase is 7+ days old (weekly)
//   chick_tip     intro: a locked power chick the player can afford right now (a line on the card, daily at most)
//   coins_ad      web: free coins for a rewarded ad when the player came up short (daily at most)
// Caps: 1 popup per session, 2 per day, 30 min apart; none in the first session or before level 6; 3 dismissals of one
// offer silence it for 14 days; nothing at all for a child (save.age 'u13'). Score = fit x value - fatigue; a tie goes
// to the cheaper offer. No timers and no countdowns anywhere: an offer is the same price for everyone, every time.
// Web portals sell nothing: there only the rewarded suggestions (charge_ad, coins_ad) can come up.
import { IAP, iapAvailable, BANK_OPEN } from './economy.js';

// The first-launch age question and the child-safe mode behind it (no offer popups, a parent check before any
// real-money purchase, child-directed ad requests). One switch, in case the owner picks another audience.
export const AGE_GATE = true;

export const CAPS = { perSession: 1, perDay: 2, gapMin: 30, fromLevel: 6, silenceAfter: 3, silenceDays: 14 };
const DAY = 864e5, MIN = 6e4;
const dayKey = (now) => { const d = new Date(now); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

const TEXT = {
  starter_nest: { title: 'Starter Nest', line: '600 coins, 3 Chick Charges, 2 of every boost and the Cocoa Hen. Only once.' },
  bundle_helper: { title: 'Helper Bundle', line: 'Stuck here? 1000 coins, 5 Chick Charges, 3 Ally Tickets and 2 of every boost.' },
  egg_bank: { title: 'Your Golden Egg Bank is full', line: 'Crack it open and take every coin inside.' },
  no_ads: { title: 'No more ad breaks', line: 'Play on without breaks between levels. Bonus videos stay your choice.' },
  eggscape_premium: { title: 'Premium', line: 'No ad breaks, every ad bonus at once, all power chicks, the Golden Hen and a free Chick Charge every day.' },
  bundle_flock: { title: 'Flock Bundle', line: '3000 coins, 15 Chick Charges, 10 Ally Tickets and every power chick.' },
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
    sessionPopup: !!o.sessionPopup,
    ads: Math.max(0, Math.floor(Number(o.ads) || 0)), // rewarded ads watched in all
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
  o.sessionPopup = false;
  return o;
}

export function noteRewarded(save) { offerState(save).ads += 1; }

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
  if (o.sessionPopup) return 'session';
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
  // starter nest
  if ((calm || shop) && !payer && !w.starter && (unlocked >= 8 || o.sessions >= 3) && (shop || shownCount(o, 'starter_nest') < 3) && now - (o.firstDay || now) < 7 * DAY) sku('starter_nest', 1 + (short ? 0.2 : 0), 3);
  // stuck: a free charge for an ad first; the helper bundle only after that ad was declined on this level
  if (moment === 'fail' && (ctx.fails || 0) >= 3 && lv != null) {
    if (!o.lvAd[lv]) C.push({ id: 'charge_ad', item: 'charge', fit: 1 + (ctx.nearMiss ? 0.2 : 0), value: 1, usd: 0, ...TEXT.charge_ad });
    else if (o.lvDeclined[lv] && !o.lvHelper[lv] && shownSince(o, 'bundle_helper', now - DAY) < 1) sku('bundle_helper', 0.9 + (short ? 0.2 : 0), 2);
  }
  if ((moment === 'win' || shop) && (shop || (ctx.prevFails || 0) >= 2) && (w.bank || 0) >= BANK_OPEN && (shop || every(o, 'egg_bank', now, 3))) sku('egg_bank', 0.9, 1.5);
  if ((calm || shop) && o.ads >= 5 && !payer && (shop || every(o, 'no_ads', now, 5))) sku('no_ads', 0.6, 1.2);
  if ((calm || shop) && unlocked >= 20 && o.days.length >= 5 && (shop || every(o, 'eggscape_premium', now, 14))) sku('eggscape_premium', 0.7, 2.5);
  if ((calm || shop) && payer && now - (w.lastBuyAt || 0) >= 7 * DAY && (shop || every(o, 'bundle_flock', now, 7))) sku('bundle_flock', 0.8, 2);
  if (moment === 'intro' && ctx.chick && (w.coins || 0) >= ctx.chick.price && every(o, 'chick_tip', now, 1)) {
    C.push({ id: 'chick_tip', item: 'chick:' + ctx.chick.id, gentle: true, fit: 0.5, value: 1, usd: 0, title: ctx.chick.name, line: `Unlock ${ctx.chick.name} now for ${ctx.chick.price} coins` });
  }
  if (!money && calm && short && ctx.adReady && every(o, 'coins_ad', now, 1)) C.push({ id: 'coins_ad', item: 'coins', fit: 0.6, value: 1, usd: 0, ...TEXT.coins_ad });
  let best = null;
  for (const c of C) {
    if (silenced(o, c.id, now)) continue;
    if (shop && !c.sku) continue;
    const d = o.dismissed[c.id], fatigue = 0.25 * shownSince(o, c.id, now - 14 * DAY) + 0.4 * (d ? Math.min(d.n, CAPS.silenceAfter) : 0);
    c.score = c.fit * c.value - fatigue;
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
  o.sessionPopup = true;
  if (offer.id === 'charge_ad' && levelId != null) o.lvAd[levelId] = 1;
  if (offer.id === 'bundle_helper' && levelId != null) o.lvHelper[levelId] = 1;
}

// "No thanks"
export function markDismissed(save, offer, now, levelId) {
  const o = offerState(save), d = o.dismissed[offer.id] || { n: 0, lastAt: 0 };
  o.dismissed[offer.id] = { n: d.n + 1, lastAt: now };
  if (offer.id === 'charge_ad' && levelId != null) o.lvDeclined[levelId] = 1;
}
