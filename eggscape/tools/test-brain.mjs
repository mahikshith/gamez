// The Brain (src/brain.js): node tools/test-brain.mjs   (exits 1 on a failure)
import * as BR from '../src/brain.js';
import * as E from '../src/economy.js';
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL', msg); } else console.log('ok  ', msg); };
const MIN = 60e3, DAY = 864e5, T0 = Date.UTC(2026, 10, 2, 9);
const dk = (now) => { const d = new Date(now); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const mk = (o = {}) => ({ unlocked: 14, dir: { recent: [], att: {}, spent: { all: 0, by: {} }, hot: 0 }, offers: { sessions: 4, ads: 2, firstDay: T0 - 20 * DAY }, ...o, wallet: { ...E.defaultWallet(), coins: 200, ...(o.wallet || {}) } });
const levels = (s, n) => { for (let i = 0; i < n; i++) BR.note(s, 'level'); };

// ---- the model
{
  ok(BR.model(mk({ unlocked: 3 })).stage === 'new', 'before level 6: new');
  ok(BR.model(mk({ offers: { sessions: 1 } })).stage === 'new', 'first session: new');
  ok(BR.model(mk({ unlocked: 9 })).stage === 'learning' && BR.model(mk()).stage === 'regular' && BR.model(mk({ unlocked: 35 })).stage === 'veteran', 'stages by progress');
  const s = mk(); s.dir.att[14] = { streak: 3 };
  ok(BR.model(s).mood === 'stuck', '3 losses in a row here: stuck');
  ok(BR.model(mk({ dir: { recent: ['f', 'f', 'w', 'f', 'f', 'w'], att: {}, spent: { all: 0 } } })).mood === 'stuck', '4 of the last 6 lost: stuck');
  ok(BR.model(mk({ dir: { recent: [], att: {}, spent: { all: 0 }, hot: 3 } })).mood === 'flow' && BR.model(mk({ dir: { recent: [], att: {}, spent: { all: 0 }, hot: 7 } })).mood === 'cruising', 'win runs: flow, then cruising');
  ok(BR.model(mk({ wallet: { coins: 700 } })).purse === 'rich' && BR.model(mk({ wallet: { coins: 10 } })).purse === 'poor', 'purse');
  ok(BR.model(mk({ offers: { sessions: 4, ads: 9 } })).video === 'fan', '8+ videos in all: fan');
  ok(BR.model(mk({ offers: { sessions: 4, ads: 3, adsDay: { day: dk(T0), n: 3 } } }), { now: T0 }).video === 'fan', '3 videos today: fan');
  ok(BR.model(mk({ unlocked: 20, offers: { sessions: 4, ads: 0 } })).video === 'shy', 'no video by level 15: shy');
  ok(BR.model(mk({ wallet: { noAds: true }, offers: { sessions: 4, ads: 20 } })).video === 'none', 'Premium: no videos to speak of');
  ok(BR.model(mk({ wallet: { skins: ['classic', 'dino', 'lava'], henSkins: ['classic', 'santa'] } })).taste === 'looks', 'collects looks');
  ok(BR.model(mk({ wallet: { chicks: ['bomb'], owned: { stone: 2 } } })).taste === 'power', 'collects power');
}
// ---- the gate
{
  ok(!BR.gate(mk(), 'play', { now: T0 }).money && !BR.gate(mk(), 'play', { now: T0 }).nudge, 'never during play');
  ok(!BR.gate(mk({ unlocked: 4 }), 'home', { now: T0 }).money, 'nothing asked of a new player');
  ok(BR.gate(mk(), 'home', { now: T0 }).money, 'a regular player at home: may be asked');
  ok(BR.gate(mk({ unlocked: 4 }), 'shop', { now: T0 }).money, 'the shop is always open');
  const hot = mk(); hot.dir.hot = 4;
  ok(!BR.gate(hot, 'win', { now: T0 }).money && BR.gate(hot, 'home', { now: T0 }).money, 'a winning run is not interrupted on the win card, home is fine');
  const s = mk();
  BR.note(s, 'ask', { id: 'starter_nest', kind: 'money' }, T0);
  ok(!BR.gate(s, 'home', { now: T0 + 30 * MIN }).money, 'no second ask before 3 more levels');
  levels(s, 3);
  ok(!BR.gate(s, 'home', { now: T0 + 5 * MIN }).money, 'and not within 10 minutes');
  ok(BR.gate(s, 'home', { now: T0 + 11 * MIN }).money, '3 levels and 10 minutes later: ok');
  BR.note(s, 'no', { id: 'starter_nest' }, T0 + 11 * MIN);
  ok(!BR.gate(s, 'home', { now: T0 + 11 * MIN }).money, 'a "no" doubles the wait (6 levels, 20 minutes)');
  levels(s, 3);
  ok(BR.gate(s, 'home', { now: T0 + 21 * MIN }).money, 'after the doubled wait: ok');
  BR.note(s, 'ask', { id: 'eggscape_premium', kind: 'money' }, T0 + 21 * MIN); BR.note(s, 'no', { id: 'eggscape_premium' }, T0 + 22 * MIN);
  levels(s, 6);
  ok(!BR.gate(s, 'home', { now: T0 + 50 * MIN }).money, 'two "no" this week: four times the wait');
  levels(s, 6);
  ok(BR.gate(s, 'home', { now: T0 + 70 * MIN }).money, 'and then ok again');
  ok(BR.gate(s, 'home', { now: T0 + 9 * DAY }).why === 'ok', 'a week later the "no"s are forgotten');
  const p = mk(); BR.note(p, 'buy', { money: true }, T0);
  ok(!BR.gate(p, 'home', { now: T0 + 5 * 36e5 }).money && BR.gate(p, 'home', { now: T0 + 25 * 36e5 }).money, 'a purchase earns a day of rest');
  const n = mk(); BR.note(n, 'ask', { id: 'keep', kind: 'nudge' }, T0);
  ok(!BR.gate(n, 'home', { now: T0 + MIN }).nudge && !BR.gate(n, 'home', { now: T0 + MIN }).money, 'one ask at a time: nothing right after a nudge');
  levels(n, 1);
  ok(BR.gate(n, 'home', { now: T0 + 2 * MIN }).nudge && BR.gate(n, 'home', { now: T0 + 2 * MIN }).money, 'a level later both are fine');
}
// ---- the lean
{
  const fan = BR.lean(mk({ offers: { sessions: 4, ads: 9 } }));
  ok(fan.skip_videos > 1 && fan.eggscape_premium > 1, 'a video fan leans to "no videos"');
  const shy = BR.lean(mk({ unlocked: 20, offers: { sessions: 4, ads: 0 } }));
  ok(shy.charge_ad < 1 && shy.coins_ad < 1, 'videos are not pushed at someone who never takes them');
  const st = mk(); st.dir.att[14] = { streak: 4 };
  ok(BR.lean(st).bundle_helper > 1 && BR.lean(st).eggscape_collector < 1, 'stuck: help, not wardrobe');
  ok(Object.keys(BR.lean(mk({ wallet: { coins: 200 } }))).every((k) => typeof k === 'string'), 'a plain player: neutral or mild');
}
// ---- the shop plan
{
  const B3 = ['starter_nest', 'eggscape_premium', 'eggscape_collector'];
  const young = mk({ unlocked: 8, offers: { sessions: 3, ads: 0, firstDay: T0 - DAY } });
  ok(BR.shopPlan(young, { now: T0, bundles: B3 }).hero === 'starter_nest', 'a young account: the Starter Nest leads');
  ok(BR.shopPlan(mk({ offers: { sessions: 4, ads: 9, firstDay: T0 - DAY } }), { now: T0, bundles: B3 }).hero === 'eggscape_premium', 'a video fan: Unlock Everything leads');
  ok(BR.shopPlan(mk({ unlocked: 35 }), { now: T0, bundles: B3 }).order[0] === 'eggscape_premium', 'the hero is first in the order');
  ok(BR.shopPlan(mk({ wallet: { noAds: true, starter: true, payer: true } }), { now: T0, bundles: ['eggscape_collector'] }).hero === 'eggscape_collector', 'owns Premium: the Coop leads');
  const items = [{ key: 'skin:dino', kind: 'skin', price: 200, owned: false, tried: true }, { key: 'skin:golden', kind: 'skin', price: 300, owned: false }, { key: 'hen:santa', kind: 'hen', price: 250, owned: true }, { key: 'chick:bomb', kind: 'chick', price: 450, owned: false }, { key: 'boost:time', kind: 'boost', price: 50, owned: 0 }, { key: 'kit:rescue', kind: 'kit', price: 110, owned: false }];
  const P = BR.shopPlan(mk({ wallet: { coins: 320 } }), { now: T0, bundles: B3, items });
  ok(P.forYou.length >= 1 && P.forYou.length <= 3, 'up to three picks');
  ok(P.forYou[0].key === 'skin:dino' && P.forYou[0].why === 'You tried it', 'what was tried free comes first');
  ok(!P.forYou.some((p) => p.key === 'chick:bomb' || p.key === 'hen:santa'), 'never something too dear or already owned');
  ok(new Set(P.forYou.map((p) => p.key)).size === P.forYou.length, 'no pick twice');
  const st = mk({ wallet: { coins: 320 } }); st.dir.att[14] = { streak: 3 };
  ok(BR.shopPlan(st, { now: T0, bundles: B3, items, lastLoss: 'time' }).forYou[0].key === 'boost:time', 'stuck on the clock: the Slow fuse first');
  ok(BR.shopPlan(mk({ wallet: { coins: 0 } }), { now: T0, bundles: B3, items }).forYou.length === 0, 'an empty purse: no picks');
}
// ---- the log
{
  const s = mk();
  BR.why(s, 'home', 'starter_nest', 'fits', T0); BR.why(s, 'home', 'starter_nest', 'fits', T0 + MIN); BR.why(s, 'win', null, 'a winning run is not interrupted', T0 + 2 * MIN);
  const L = BR.trace(s);
  ok(L.length === 2 && L[0].pick === 'starter_nest' && L[1].pick === '-' && /regular/.test(L[0].who), 'decisions are logged once, with the player in a line');
  for (let i = 0; i < 50; i++) BR.why(s, 'home', 'x' + i, 'r', T0 + i * 10 * MIN);
  ok(BR.trace(s).length === 30, 'the log keeps the last 30');
  const bad = { unlocked: 9, brain: { asks: 'x', log: 7, done: -3 } };
  ok(BR.brainState(bad).asks.length === 0 && BR.brainState(bad).done === 0, 'a broken save is made safe');
}
console.log(fails ? `\n${fails} FAILED` : '\nall brain tests passed');
process.exit(fails ? 1 : 0);
