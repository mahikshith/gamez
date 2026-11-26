// Offer engine scenarios (src/offers.js): node tools/test-offers.mjs   (exits 1 on a failure)
import * as OF from '../src/offers.js';
import * as E from '../src/economy.js';
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL', msg); } else console.log('ok  ', msg); };
const DAY = 864e5, HOUR = 36e5, T0 = Date.UTC(2026, 10, 2, 9);
const mk = (o = {}) => ({ unlocked: 1, wallet: { ...E.defaultWallet(), ...(o.wallet || {}) }, ...o, wallet: { ...E.defaultWallet(), ...(o.wallet || {}) } });
const id = (o) => (o ? o.id : null);
const app = { money: true };

// ---- new player
{
  const s = mk({ unlocked: 3 });
  OF.startSession(s, T0, () => 0.2);
  ok(s.offers.seed === 0 && s.offers.sessions === 1, 'A/B arm set once, first session counted');
  OF.startSession(s, T0 + DAY, () => 0.9);
  ok(s.offers.seed === 0, 'the arm never changes');
  s.unlocked = 8;
  ok(OF.evaluate(s, 'home', { ...app, now: T0 + DAY }) === null, 'nothing before level 9');
  s.unlocked = 12;
  const first = mk({ unlocked: 9 }); OF.startSession(first, T0);
  ok(OF.evaluate(first, 'win', { ...app, now: T0 }) === null, 'nothing in the first session');
  const o = OF.evaluate(s, 'win', { ...app, now: T0 + DAY });
  ok(id(o) === 'starter_nest' && o.sku === 'starter_nest', 'level 12, second session: Starter Nest');
  ok(OF.evaluate(s, 'play', { ...app, now: T0 + DAY }) === null, 'never during play');
  ok(OF.evaluate(s, 'win', { money: false, now: T0 + DAY }) === null, 'web: no purchase offers');
  // shown 3 times (three sessions) then never again
  let t = T0 + DAY;
  for (let k = 0; k < 3; k++) { const q = OF.evaluate(s, 'home', { ...app, now: t }); ok(id(q) === 'starter_nest', `starter shown #${k + 1}`); OF.markShown(s, q, t); t += DAY / 2; OF.startSession(s, t); }
  ok(id(OF.evaluate(s, 'home', { ...app, now: t })) !== 'starter_nest', 'starter at most 3 times');
  const late = mk({ unlocked: 12 }); OF.startSession(late, T0); OF.startSession(late, T0 + 8 * DAY);
  ok(id(OF.evaluate(late, 'home', { ...app, now: T0 + 8 * DAY })) !== 'starter_nest', 'starter only in the first 7 days');
  const bought = mk({ unlocked: 12, wallet: { starter: true } }); OF.startSession(bought, T0); OF.startSession(bought, T0 + HOUR);
  ok(id(OF.evaluate(bought, 'home', { ...app, now: T0 + HOUR })) !== 'starter_nest', 'never after bought');
}

// ---- stuck player
{
  const s = mk({ unlocked: 12 }); OF.startSession(s, T0); OF.startSession(s, T0 + DAY);
  s.offers.firstDay = T0 - 30 * DAY; // past the starter window
  const now = T0 + DAY;
  ok(OF.evaluate(s, 'fail', { ...app, now, levelId: 12, fails: 2 }) === null, 'two fails: nothing');
  const a = OF.evaluate(s, 'fail', { ...app, now, levelId: 12, fails: 3, nearMiss: true });
  ok(id(a) === 'charge_ad' && a.item === 'charge', '3 fails: a free Chick Charge for an ad first');
  OF.markShown(s, a, now, 12); OF.markDismissed(s, a, now, 12);
  OF.markShown(s, { id: 'egg_bank' }, now + HOUR, 12); // a second popup this session (CAPS.perSession = 2)
  ok(OF.evaluate(s, 'fail', { ...app, now: now + 2 * HOUR, levelId: 12, fails: 4 }) === null, 'two popups per session at most');
  OF.startSession(s, now + 2 * HOUR);
  const b = OF.evaluate(s, 'fail', { ...app, now: now + 2 * HOUR, levelId: 12, fails: 3 });
  ok(id(b) === 'bundle_helper', 'ad declined on this level: Helper Bundle next');
  OF.markShown(s, b, now + 2 * HOUR, 12); OF.startSession(s, now + 4 * HOUR);
  ok(id(OF.evaluate(s, 'fail', { ...app, now: now + 4 * HOUR, levelId: 12, fails: 5 })) !== 'bundle_helper', 'Helper Bundle once per level');
  const web = mk({ unlocked: 12 }); OF.startSession(web, T0); OF.startSession(web, T0 + DAY);
  ok(id(OF.evaluate(web, 'fail', { money: false, now: T0 + DAY, levelId: 7, fails: 3 })) === 'charge_ad', 'web: the free-charge ad still comes');
  // a level won after losing it twice, with a full bank
  const w = mk({ unlocked: 14, wallet: { bank: 650 } }); OF.startSession(w, T0); OF.startSession(w, T0 + DAY); w.offers.firstDay = T0 - 30 * DAY;
  ok(id(OF.evaluate(w, 'win', { ...app, now: T0 + DAY, prevFails: 2 })) === 'egg_bank', 'won after 2+ losses with 600+ in the bank: Golden Egg Bank');
  ok(id(OF.evaluate(w, 'win', { ...app, now: T0 + DAY, prevFails: 1 })) !== 'egg_bank', 'not after an easy win');
}

// ---- payer lapsed
{
  const s = mk({ unlocked: 25, wallet: { payer: true, lastBuyAt: T0 - 8 * DAY, starter: true } }); OF.startSession(s, T0); OF.startSession(s, T0 + HOUR);
  const o = OF.evaluate(s, 'home', { ...app, now: T0 + HOUR });
  ok(id(o) === 'eggscape_collector', 'payer, last purchase 8 days ago: The Whole Coop');
  const recent = mk({ unlocked: 25, wallet: { payer: true, lastBuyAt: T0 - 2 * DAY, starter: true } }); OF.startSession(recent, T0); OF.startSession(recent, T0 + HOUR);
  ok(id(OF.evaluate(recent, 'home', { ...app, now: T0 + HOUR })) !== 'eggscape_collector', 'not within 7 days of a purchase');
  OF.markShown(s, o, T0 + HOUR); OF.startSession(s, T0 + 10 * DAY);
  ok(id(OF.evaluate(s, 'home', { ...app, now: T0 + 10 * DAY })) !== 'eggscape_collector', 'The Whole Coop every 14 days at most');
  const free = mk({ unlocked: 25, wallet: { starter: true } }); OF.startSession(free, T0); OF.startSession(free, T0 + HOUR); free.offers.firstDay = T0 - 30 * DAY;
  ok(id(OF.evaluate(free, 'home', { ...app, now: T0 + HOUR })) !== 'eggscape_collector', 'never offered to someone who neither paid nor owns Premium');
  const owner = mk({ unlocked: 25, wallet: { noAds: true, payer: true, lastBuyAt: T0 - 9 * DAY, starter: true, collector: true } }); OF.startSession(owner, T0); OF.startSession(owner, T0 + HOUR);
  ok(OF.evaluate(owner, 'home', { ...app, now: T0 + HOUR }) === null, 'owns The Whole Coop: nothing more to offer');
  ok(!('no_ads' in E.IAP) && !('bundle_flock' in E.IAP), 'No Ads and the Flock Bundle are gone');
  const prem = mk({ unlocked: 12 }); OF.startSession(prem, T0); prem.offers.firstDay = T0 - 30 * DAY; prem.offers.days = ['a', 'b']; OF.startSession(prem, T0 + HOUR);
  ok(id(OF.evaluate(prem, 'home', { ...app, now: T0 + HOUR })) === 'eggscape_premium', 'level 12+, 3 play days: Unlock Everything');
  OF.markShown(prem, { id: 'eggscape_premium' }, T0 + HOUR); OF.startSession(prem, T0 + 3 * DAY);
  ok(id(OF.evaluate(prem, 'home', { ...app, now: T0 + 3 * DAY })) !== 'eggscape_premium', 'Unlock Everything every 7 days at most');
  const early = mk({ unlocked: 11 }); OF.startSession(early, T0); early.offers.firstDay = T0 - 30 * DAY; early.offers.days = ['a', 'b']; OF.startSession(early, T0 + HOUR);
  ok(id(OF.evaluate(early, 'home', { ...app, now: T0 + HOUR })) !== 'eggscape_premium', 'not before level 12');
  ok(!/no ads/i.test(OF.evaluate(prem, 'shop', { ...app, now: T0 + 8 * DAY }).line || ''), 'its line does not lead with "no ads"');
}

// ---- caps
{
  const s = mk({ unlocked: 12 }); OF.startSession(s, T0); OF.startSession(s, T0 + HOUR);
  let now = T0 + HOUR;
  const a = OF.evaluate(s, 'home', { ...app, now }); OF.markShown(s, a, now);
  OF.startSession(s, now + 10 * 6e4);
  ok(OF.blocked(s, now + 10 * 6e4, 'home') === 'gap', '20 minutes between popups');
  OF.startSession(s, now + 40 * 6e4);
  const b = OF.evaluate(s, 'home', { ...app, now: now + 40 * 6e4 }); OF.markShown(s, b, now + 40 * 6e4);
  OF.startSession(s, now + 90 * 6e4);
  OF.markShown(s, { id: 'egg_bank' }, now + 90 * 6e4);
  OF.startSession(s, now + 140 * 6e4);
  ok(OF.blocked(s, now + 140 * 6e4, 'home') === 'day', 'three popups a day at most');
  // three dismissals silence an offer for 14 days
  const d = mk({ unlocked: 12 }); OF.startSession(d, T0);
  now = T0;
  for (let k = 0; k < 3; k++) { now += DAY; OF.startSession(d, now); d.offers.days = d.offers.days.slice(0, 2); /* keep Unlock Everything (3 play days) out of this one */ const q = OF.evaluate(d, 'home', { ...app, now }); ok(id(q) === 'starter_nest', `starter offered, dismissal ${k + 1}`); OF.markShown(d, q, now); OF.markDismissed(d, q, now); }
  d.offers.shown.starter_nest = []; // make the show-count rule not the reason
  now += DAY; OF.startSession(d, now);
  ok(id(OF.evaluate(d, 'home', { ...app, now })) !== 'starter_nest', 'three "No thanks": silent for 14 days');
  // child-safe: no popups at all
  const kid = mk({ unlocked: 9, age: 'u13' }); OF.startSession(kid, T0); OF.startSession(kid, T0 + HOUR);
  if (OF.AGE_GATE) ok(OF.evaluate(kid, 'home', { ...app, now: T0 + HOUR }) === null && OF.blocked(kid, T0, 'home') === 'child', 'u13: no offers');
  else ok(OF.blocked(kid, T0, 'home') !== 'child', 'age gate off (2026-11-19): an old u13 answer no longer blocks offers');
  ok(OF.childSafe(kid) === OF.AGE_GATE, 'child-safe follows AGE_GATE');
  ok(OF.needsAge(mk(), true) === OF.AGE_GATE && !OF.needsAge(mk(), false) && !OF.needsAge(mk({ age: '13+' }), true), 'the age question: app only, once');
  const q = OF.parentQuestion(() => 0.5);
  ok(q.choices.length === 3 && q.choices.includes(q.answer) && new Set(q.choices).size === 3, 'parent check: three different choices, one right');
  // tie goes to the cheaper offer; the shop pick ignores popup caps
  const shop = mk({ unlocked: 9 }); OF.startSession(shop, T0);
  ok(id(OF.evaluate(shop, 'shop', { ...app, now: T0 })) === 'starter_nest', 'shop featured pick needs no popup budget');
  // intro: a locked chick the player can afford, as a line
  const intro = mk({ unlocked: 9, wallet: { coins: 500 } }); OF.startSession(intro, T0); OF.startSession(intro, T0 + HOUR);
  const tip = OF.evaluate(intro, 'intro', { ...app, now: T0 + HOUR, chick: { id: 'thunder', name: 'Thunder Chick', price: 400 } });
  ok(id(tip) === 'chick_tip' && tip.gentle && /400 coins/.test(tip.line), 'intro: affordable locked chick suggested');
  ok(OF.evaluate(intro, 'intro', { ...app, now: T0 + HOUR, chick: { id: 'glue', name: 'Sticky Chick', price: 600 } }) === null, 'intro: not when too expensive');
}

// ---- too many videos: "Skip the videos"
{
  const NOW = T0 + 2 * DAY + HOUR;
  const mkv = (o = {}) => { const s = mk({ unlocked: 9, ...o, wallet: { starter: true, ...(o.wallet || {}) } }); OF.startSession(s, T0); OF.startSession(s, T0 + HOUR); return s; };
  const watch = (s, n, t = NOW) => { for (let k = 0; k < n; k++) OF.noteRewarded(s, t); };
  const s = mkv(); watch(s, 2);
  ok(id(OF.evaluate(s, 'home', { ...app, now: NOW })) !== 'skip_videos', '2 videos today, 2 in all: nothing');
  watch(s, 1);
  const o = OF.evaluate(s, 'home', { ...app, now: NOW });
  ok(id(o) === 'skip_videos' && o.sku === 'eggscape_premium' && o.title === 'Rewards without waiting' && /every reward at once/.test(o.line), '3 videos today: Rewards without waiting, selling Unlock Everything');
  ok(id(OF.evaluate(s, 'win', { ...app, now: NOW })) === 'skip_videos', 'also at a win');
  ok(OF.evaluate(s, 'fail', { ...app, now: NOW, fails: 1 }) === null && OF.evaluate(s, 'play', { ...app, now: NOW }) === null, 'never on a fail card, never in play');
  ok(id(OF.evaluate(s, 'shop', { ...app, now: NOW })) !== 'skip_videos', 'not the shop featured card');
  const old = mkv(); old.offers.ads = 8; OF.noteRewarded(old, NOW - 5 * DAY); // 9 in all, 1 today (the old day does not count)
  ok(OF.adsToday(old, NOW) === 0 && id(OF.evaluate(old, 'home', { ...app, now: NOW })) === 'skip_videos', '8+ videos in all counts without today');
  const few = mkv(); few.offers.ads = 7; ok(id(OF.evaluate(few, 'home', { ...app, now: NOW })) !== 'skip_videos', '7 in all and none today: nothing');
  ok(OF.evaluate(s, 'home', { money: false, now: NOW }) === null, 'web: nothing');
  const own = mkv({ wallet: { noAds: true } }); watch(own, 5); ok(id(OF.evaluate(own, 'home', { ...app, now: NOW })) !== 'skip_videos', 'owns Unlock Everything: nothing');
  const early = mk({ unlocked: 5, wallet: { starter: true } }); OF.startSession(early, T0); OF.startSession(early, T0 + HOUR); watch(early, 4);
  ok(OF.evaluate(early, 'home', { ...app, now: NOW }) === null, 'level 9 floor (CAPS.fromLevel) still holds');
  const first = mk({ unlocked: 9, wallet: { starter: true } }); OF.startSession(first, T0); watch(first, 4, T0);
  ok(OF.evaluate(first, 'home', { ...app, now: T0 }) === null, 'first session: nothing');
  const kid = mkv({ age: 'u13' }); watch(kid, 4);
  ok(OF.childSafe(kid) ? OF.evaluate(kid, 'home', { ...app, now: NOW }) === null : true, 'child-safe: nothing');
  const gap = mkv(); watch(gap, 4); OF.markShown(gap, { id: 'egg_bank' }, NOW - 5 * 6e4);
  ok(OF.evaluate(gap, 'home', { ...app, now: NOW }) === null, 'obeys the 20 min gap');
  const sil = mkv(); watch(sil, 4); sil.offers.dismissed.skip_videos = { n: 3, lastAt: NOW - DAY };
  ok(id(OF.evaluate(sil, 'home', { ...app, now: NOW })) !== 'skip_videos', 'silenced after 3 "No thanks"');
  OF.markShown(s, o, NOW); OF.startSession(s, NOW + 2 * HOUR);
  ok(id(OF.evaluate(s, 'home', { ...app, now: NOW + 2 * HOUR })) !== 'skip_videos', 'not again within 3 days');
  s.offers.ads = 8; OF.startSession(s, NOW + 3 * DAY);
  ok(id(OF.evaluate(s, 'home', { ...app, now: NOW + 3 * DAY + HOUR })) === 'skip_videos', 'again after 3 days');
  // outranks the generic premium rule (level 12, 3 play days)
  const pr = mkv({ unlocked: 12 }); pr.offers.firstDay = T0 - 30 * DAY; pr.offers.days = ['a', 'b']; watch(pr, 3);
  ok(id(OF.evaluate(pr, 'home', { ...app, now: NOW })) === 'skip_videos', 'outranks the generic Unlock Everything offer');
  // the chip
  const c = mkv(); watch(c, 2);
  ok(!OF.skipChip(c, NOW, true), 'chip: not before 3 videos today'); watch(c, 1);
  ok(OF.skipChip(c, NOW, true) && !OF.skipChip(c, NOW, false), 'chip: 3 videos today, real-money shop only');
  OF.markChip(c, NOW); ok(!OF.skipChip(c, NOW, true) && OF.skipChip(c, NOW + DAY, true) === false, 'chip: once a day (and tomorrow needs 3 new videos)');
  watch(c, 3, NOW + DAY); ok(OF.skipChip(c, NOW + DAY, true), 'chip: again the next day after 3 videos');
  const co = mkv({ wallet: { noAds: true } }); watch(co, 4); ok(!OF.skipChip(co, NOW, true), 'chip: not for Premium owners');
}

console.log(fails ? `${fails} FAILED` : 'all offer checks passed');
process.exit(fails ? 1 : 0);
