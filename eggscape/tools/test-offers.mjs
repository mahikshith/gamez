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
  ok(OF.evaluate(s, 'home', { ...app, now: T0 + DAY }) === null, 'nothing before level 6');
  s.unlocked = 8;
  const first = mk({ unlocked: 9 }); OF.startSession(first, T0);
  ok(OF.evaluate(first, 'win', { ...app, now: T0 }) === null, 'nothing in the first session');
  const o = OF.evaluate(s, 'win', { ...app, now: T0 + DAY });
  ok(id(o) === 'starter_nest' && o.sku === 'starter_nest', 'level 8, second session: Starter Nest');
  ok(OF.evaluate(s, 'play', { ...app, now: T0 + DAY }) === null, 'never during play');
  ok(OF.evaluate(s, 'win', { money: false, now: T0 + DAY }) === null, 'web: no purchase offers');
  // shown 3 times (three sessions) then never again
  let t = T0 + DAY;
  for (let k = 0; k < 3; k++) { const q = OF.evaluate(s, 'home', { ...app, now: t }); ok(id(q) === 'starter_nest', `starter shown #${k + 1}`); OF.markShown(s, q, t); t += DAY / 2; OF.startSession(s, t); }
  ok(id(OF.evaluate(s, 'home', { ...app, now: t })) !== 'starter_nest', 'starter at most 3 times');
  const late = mk({ unlocked: 9 }); OF.startSession(late, T0); OF.startSession(late, T0 + 8 * DAY);
  ok(id(OF.evaluate(late, 'home', { ...app, now: T0 + 8 * DAY })) !== 'starter_nest', 'starter only in the first 7 days');
  const bought = mk({ unlocked: 9, wallet: { starter: true } }); OF.startSession(bought, T0); OF.startSession(bought, T0 + HOUR);
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
  ok(OF.evaluate(s, 'fail', { ...app, now: now + HOUR, levelId: 12, fails: 4 }) === null, 'one popup per session');
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
  ok(id(o) === 'bundle_flock', 'payer, last purchase 8 days ago: Flock Bundle');
  const recent = mk({ unlocked: 25, wallet: { payer: true, lastBuyAt: T0 - 2 * DAY, starter: true } }); OF.startSession(recent, T0); OF.startSession(recent, T0 + HOUR);
  ok(id(OF.evaluate(recent, 'home', { ...app, now: T0 + HOUR })) !== 'bundle_flock', 'not within 7 days of a purchase');
  OF.markShown(s, o, T0 + HOUR); OF.startSession(s, T0 + 3 * DAY);
  ok(id(OF.evaluate(s, 'home', { ...app, now: T0 + 3 * DAY })) !== 'bundle_flock', 'Flock Bundle weekly at most');
  const ads = mk({ unlocked: 9 }); OF.startSession(ads, T0); OF.startSession(ads, T0 + HOUR); ads.offers.firstDay = T0 - 30 * DAY; ads.offers.ads = 5;
  ok(id(OF.evaluate(ads, 'home', { ...app, now: T0 + HOUR })) === 'no_ads', '5 rewarded ads, non-payer: No Ads');
  const prem = mk({ unlocked: 22 }); OF.startSession(prem, T0); prem.offers.firstDay = T0 - 30 * DAY; prem.offers.days = ['a', 'b', 'c', 'd']; OF.startSession(prem, T0 + HOUR);
  ok(id(OF.evaluate(prem, 'home', { ...app, now: T0 + HOUR })) === 'eggscape_premium', 'level 20+, 5 play days: Premium');
}

// ---- caps
{
  const s = mk({ unlocked: 9 }); OF.startSession(s, T0); OF.startSession(s, T0 + HOUR);
  let now = T0 + HOUR;
  const a = OF.evaluate(s, 'home', { ...app, now }); OF.markShown(s, a, now);
  OF.startSession(s, now + 10 * 6e4);
  ok(OF.blocked(s, now + 10 * 6e4, 'home') === 'gap', '30 minutes between popups');
  OF.startSession(s, now + 40 * 6e4);
  const b = OF.evaluate(s, 'home', { ...app, now: now + 40 * 6e4 }); OF.markShown(s, b, now + 40 * 6e4);
  OF.startSession(s, now + 90 * 6e4);
  ok(OF.blocked(s, now + 90 * 6e4, 'home') === 'day', 'two popups a day');
  // three dismissals silence an offer for 14 days
  const d = mk({ unlocked: 9 }); OF.startSession(d, T0);
  now = T0;
  for (let k = 0; k < 3; k++) { now += DAY; OF.startSession(d, now); const q = OF.evaluate(d, 'home', { ...app, now }); ok(id(q) === 'starter_nest', `starter offered, dismissal ${k + 1}`); OF.markShown(d, q, now); OF.markDismissed(d, q, now); }
  d.offers.shown.starter_nest = []; // make the show-count rule not the reason
  now += DAY; OF.startSession(d, now);
  ok(id(OF.evaluate(d, 'home', { ...app, now })) !== 'starter_nest', 'three "No thanks": silent for 14 days');
  // child-safe: no popups at all
  const kid = mk({ unlocked: 9, age: 'u13' }); OF.startSession(kid, T0); OF.startSession(kid, T0 + HOUR);
  ok(OF.evaluate(kid, 'home', { ...app, now: T0 + HOUR }) === null && OF.blocked(kid, T0, 'home') === 'child', 'u13: no offers');
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

console.log(fails ? `${fails} FAILED` : 'all offer checks passed');
process.exit(fails ? 1 : 0);
