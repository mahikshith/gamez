// Brain (2026-11-23, mykee: "a robust, dynamic engine that handles the shop, suggestions, ads and others, maximising
// revenue without inhibiting the fun"). One arbiter over the two engines the game already has. Pure logic, on the
// phone only: nothing here talks to a server.
//
// The Director (director.js: help after losses, free tries, win streaks, home nudges) and the offer engine (offers.js:
// paid offers with caps) each keep their own rules and tests. The Brain reads the whole save and answers:
//   model(save, ctx)             who is playing: stage, mood, purse, spender, video habit, taste
//   gate(save, moment, ctx)      may the player be ASKED anything at this moment? { money, nudge, why }
//   lean(save, ctx)              how well each offer fits this player: { offerId: factor } (order only, never prices)
//   shopPlan(save, ctx)          the Featured tab: the bundle that leads, the order, up to three "for you" picks
//   note(save, event, data, now) what happened: 'level', 'ask', 'yes', 'no', 'buy', 'video', 'videoNo'
//   why(save, moment, pick, reason, now) / trace(save)   the last decisions with their reasons (in the speed log)
//
// Fun first, in this order: free help, coin help, a chosen video, real money. An ask backs off after a "no" (the gap
// doubles, up to eight times) and rests a day after a "yes". Never a different price per player, never a changed
// difficulty, never a timer, never an ask during play or inside a winning run.

import { now as gameNow } from './clock.js'; // 0.8.17: a day that never goes back (moving the phone's date repeats nothing)
import { earlyDays } from './director.js'; // nothing sold or advertised before level 3 is won
const MIN = 60e3, DAY = 864e5;
export const BRAIN = { gapLevels: 3, gapMin: 10, nudgeLevels: 1, backoffMax: 8, restDays: 1, richCoins: 600, poorCoins: 40, fanToday: 3, fanAll: 8, shyFrom: 18, flowWins: 3, cruiseWins: 6 };
const dayKey = (now) => { const d = new Date(gameNow(now)); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const num = (v) => Math.max(0, Number(v) || 0);

const SAFE = new WeakSet(); // states made safe already: brainState hands the same object back (callers hold on to it)
export function brainState(save) {
  if (save.brain && SAFE.has(save.brain)) return save.brain;
  const b = save.brain && typeof save.brain === 'object' ? save.brain : {};
  save.brain = {
    done: Math.floor(num(b.done)), // levels finished in all (won or lost)
    asks: Array.isArray(b.asks) ? b.asks.filter((a) => a && typeof a.id === 'string').slice(-24) : [], // { t, id, kind: 'money' | 'nudge' | 'video', at (done then), res: 'yes' | 'no' | '' }
    restUntil: num(b.restUntil), // after a real-money purchase: no money asks until then
    videoNo: Math.floor(num(b.videoNo)), // offered videos the player turned down
    log: Array.isArray(b.log) ? b.log.slice(-30) : [],
    fx: fxClean(b.fx), // the spend moments (spendPick below)
  };
  SAFE.add(save.brain);
  return save.brain;
}

// ---- who is playing. ctx: { now, levelId (the level in hand, else the furthest one) }
export function model(save, ctx = {}) {
  const now = ctx.now || Date.now(), D = save.dir || {}, o = save.offers || {}, w = save.wallet || {}, B = brainState(save);
  const unlocked = save.unlocked || 1, recent = Array.isArray(D.recent) ? D.recent : [];
  const lv = ctx.levelId != null ? ctx.levelId : unlocked, a = (D.att && D.att[lv]) || null;
  const f6 = recent.slice(-6).filter((x) => x === 'f').length, here = a ? a.streak || 0 : 0, hot = num(D.hot);
  const stage = unlocked < 6 || num(o.sessions) <= 1 ? 'new' : unlocked < 14 ? 'learning' : unlocked < 36 ? 'regular' : 'veteran'; // (0.8.17: 12 and 30 on the 50-level road)
  const mood = here >= 3 || f6 >= 4 ? 'stuck' : hot >= BRAIN.cruiseWins ? 'cruising' : hot >= BRAIN.flowWins ? 'flow' : 'steady';
  const coins = num(w.coins), purse = coins >= BRAIN.richCoins ? 'rich' : coins < BRAIN.poorCoins ? 'poor' : 'ok';
  const payer = !!w.payer || !!w.noAds || !!w.collector, spent = num(D.spent && D.spent.all);
  const spender = payer ? 'payer' : spent >= 400 ? 'spender' : 'saver';
  const today = o.adsDay && o.adsDay.day === dayKey(now) ? num(o.adsDay.n) : 0, all = num(o.ads);
  const video = w.noAds ? 'none' : today >= BRAIN.fanToday || all >= BRAIN.fanAll ? 'fan' : all === 0 && (unlocked >= BRAIN.shyFrom || B.videoNo >= 3) ? 'shy' : 'some';
  // taste: what the player collected so far (looks: eggs and outfits beyond the classic pair; power: chicks, boosters, charges)
  const looks = Math.max(0, (Array.isArray(w.skins) ? w.skins.length : 1) - 1) + Math.max(0, (Array.isArray(w.henSkins) ? w.henSkins.length : 1) - 1);
  const power = (Array.isArray(w.chicks) ? w.chicks.length : 0) * 2 + Object.values(w.owned || {}).reduce((s, n) => s + num(n), 0) * 0.5 + num(w.charges) * 0.5;
  const taste = looks > power * 1.3 && looks >= 1 ? 'looks' : power > looks * 1.3 && power >= 1 ? 'power' : 'mixed';
  return { stage, mood, purse, spender, video, taste, coins, unlocked, hot, here, videosToday: today, videosAll: all };
}

// ---- may the player be asked something now? 'money' = a paid offer popup, 'nudge' = a free or coin suggestion,
// 'spend' = a spend moment (spendPick: one short animation on a control already on screen, never a popup).
// moment: 'home' | 'win' | 'fail' | 'intro' | 'spin' | 'shop' | 'play'. The shop never needs a gate: the player walked in.
export function gate(save, moment, ctx = {}) {
  const now = ctx.now || Date.now(), B = brainState(save), M = model(save, ctx);
  const no = (why) => ({ money: false, nudge: false, spend: false, why });
  // 0.8.17 the first levels' tour (tour.js): showing once where a control lives is not an ask (nothing sold, nothing to
  // answer). Any moment but play; in play only a quiet spell (ctx.quiet: hands off, nothing else on screen). Never money.
  if (ctx.tour) return moment === 'play' && !ctx.quiet ? no('a tour step in play waits for a quiet spell') : { money: false, nudge: true, spend: false, why: 'a tour step: it only shows where something is' };
  if (moment === 'play') return no('never during play');
  if (moment === 'shop') return { money: true, nudge: true, spend: true, why: 'the player opened the shop' };
  if (M.stage === 'new') return no('first levels: nothing is asked');
  const asks = B.asks, last = asks[asks.length - 1] || null, lastMoney = [...asks].reverse().find((a) => a.kind === 'money') || null;
  const noes = asks.filter((a) => a.kind === 'money' && a.res === 'no' && now - a.t < 7 * DAY).length;
  const back = Math.min(BRAIN.backoffMax, 2 ** noes); // every "no" this week doubles the wait
  const nudge = !last || B.done - last.at >= BRAIN.nudgeLevels;
  let money = true, why = 'ok';
  if (now < B.restUntil) { money = false; why = 'resting after a purchase'; }
  else if (moment === 'win' && (M.mood === 'flow' || M.mood === 'cruising')) { money = false; why = 'a winning run is not interrupted'; }
  else if (lastMoney && (B.done - lastMoney.at < BRAIN.gapLevels * back || now - lastMoney.t < BRAIN.gapMin * MIN * back)) { money = false; why = noes ? `backing off after ${noes} no` : 'too soon after the last ask'; }
  else if (last && last.kind !== 'money' && B.done - last.at < BRAIN.nudgeLevels) { money = false; why = 'one ask at a time'; }
  return { money, nudge, spend: spendOk(save, B, now), why: money ? why : nudge ? why : why + ', and one ask at a time' };
}

// ---- how well each offer fits this player (multiplies the offer engine's fit; 1 = neutral). Prices never change.
export function lean(save, ctx = {}) {
  const M = model(save, ctx), L = {};
  const up = (id, f) => { L[id] = (L[id] || 1) * f; };
  if (M.video === 'fan') { up('skip_videos', 1.5); up('eggscape_premium', 1.4); }
  if (M.video === 'shy') { up('charge_ad', 0.6); up('coins_ad', 0.6); } // never pushes videos at someone who never takes them
  if (M.mood === 'stuck') { up('charge_ad', 1.3); up('bundle_helper', 1.3); up('eggscape_collector', 0.7); }
  if (M.taste === 'looks') { up('eggscape_collector', 1.3); }
  if (M.taste === 'power') { up('bundle_helper', 1.2); up('eggscape_premium', 1.1); }
  if (M.purse === 'poor') { up('starter_nest', 1.2); up('egg_bank', 1.2); }
  if (M.purse === 'rich') { up('starter_nest', 0.8); } // coins to spend first: the shop's "for you" row does that
  if (M.stage === 'veteran' && M.spender !== 'payer') up('eggscape_premium', 1.2);
  return L;
}

// ---- the Featured tab for this player.
// ctx: { now, money, bundles: [sku] for sale, items: [{ key, kind: 'skin' | 'hen' | 'chick' | 'boost' | 'kit' | 'set',
//   price, owned (bool or a count for boosts), tried (was on a free try) }], lastLoss: 'time' | 'thorns' | 'villains' | 'nest' | null }
// -> { hero: sku | null, order: [sku], forYou: [{ key, why }] (at most 3, things the player can pay for in coins right now) }
const LOSS_BOOST = { time: 'time', thorns: 'snips', villains: 'stone', nest: 'nest' };
const LOSS_SKIN = { thorns: { ids: ['dino', 'lava'], why: 'Helps with thorns' }, villains: { ids: ['frosty', 'thunder', 'gator'], why: 'Helps with villains' }, time: { ids: ['candy'], why: 'Helps with the clock' } };
export function shopPlan(save, ctx = {}) {
  const M = model(save, ctx), w = save.wallet || {}, now = ctx.now || Date.now(), o = save.offers || {};
  const bundles = Array.isArray(ctx.bundles) ? ctx.bundles : [], has = (s) => bundles.includes(s);
  const young = now - (num(o.firstDay) || now) < 7 * DAY;
  let hero = null;
  if (has('eggscape_premium') && (M.video === 'fan' || M.stage === 'veteran' || (M.unlocked >= 14 && !young))) hero = 'eggscape_premium';
  else if (has('starter_nest') && !w.starter && M.spender !== 'payer') hero = 'starter_nest';
  else if (has('eggscape_premium')) hero = 'eggscape_premium';
  else if (has('eggscape_collector')) hero = 'eggscape_collector';
  const order = [...bundles].sort((x, y) => (y === hero) - (x === hero));
  const items = (Array.isArray(ctx.items) ? ctx.items : []).filter((i) => i && i.price > 0 && i.price <= M.coins);
  const free = (i) => !i.owned, pick = [], take = (i, why) => { if (i && pick.length < 3 && !pick.some((p) => p.key === i.key)) pick.push({ key: i.key, why }); };
  const cheap = (a, b) => b.price - a.price; // the best the purse can pay for comes first
  if (M.mood === 'stuck' && ctx.lastLoss) take(items.find((i) => i.kind === 'boost' && i.key === 'boost:' + LOSS_BOOST[ctx.lastLoss]), 'Helps on your level');
  // 0.8.10: egg skins carry a power, so the same stuck rule can answer with one whose power fits the last loss
  if (M.mood === 'stuck' && LOSS_SKIN[ctx.lastLoss]) take(items.filter((i) => i.kind === 'skin' && free(i) && LOSS_SKIN[ctx.lastLoss].ids.includes(i.key.slice(5))).sort(cheap)[0], LOSS_SKIN[ctx.lastLoss].why);
  take(items.filter((i) => i.tried && free(i) && (i.kind === 'skin' || i.kind === 'hen' || i.kind === 'chick')).sort(cheap)[0], 'You tried it');
  const fav = M.taste === 'looks' ? ['set', 'hen', 'skin'] : M.taste === 'power' ? ['chick', 'kit', 'boost'] : ['chick', 'hen', 'skin', 'kit'];
  for (const k of fav) take(items.filter((i) => i.kind === k && (k === 'boost' || k === 'kit' ? true : free(i))).sort(cheap)[0], 'You can get it now');
  return { hero, order, forYou: pick, model: M };
}

// ---- spend moments (0.8.17, mykee: "come up with points or situations where users are more likely to spend coins and
// build proper animations ... for those scenarios"). One short animation (under 1.5 s, any tap skips it) on a control
// already on screen: the purse and the Shop button on home and the map, the fail card's help and its coin Rewind, the
// level card's booster strip, the keep card, the Lucky Spin's coin button. Never a popup, never a new button, never a
// different price. The Brain picks at most ONE a screen visit, and only when the gate says spend:
//   never during play; nothing before level 3 is won (director.js earlyDays) nor for a new player; nothing while the
//   rest after a real-money purchase runs; SPEND.restLevels levels of rest after a coin purchase made from a moment;
//   a moment left untaken is a "no": each "no" in a row doubles the levels before the next (1, 2, 4, 8), and the same
//   thing is never shown twice (sameMax); SPEND.perDay a day at most.
// ids, the first that fits leads: save (the booster that would have saved a near miss), streak (the coin Rewind that
// keeps a win streak), keep (a free try ended), deal (today's deal, a returning player), fresh (new coins reach
// something), world (a new world's outfit), afford (the purse crossed a wanted thing's price), strip (the level card's
// booster for a boss or a lost level), spin (one more coin spin after a lost pull), chick (a locked chick the coins reach)
export const SPEND = { restLevels: 2, backoffMax: 8, sameMax: 1, perDay: 6, rank: { save: 0, streak: 1, keep: 2, deal: 3, fresh: 4, world: 5, afford: 6, strip: 7, spin: 8, chick: 9 } };
function fxClean(f) {
  const o = f && typeof f === 'object' ? f : {};
  const last = o.last && typeof o.last.id === 'string' ? { id: o.last.id, key: String(o.last.key || ''), at: Math.floor(num(o.last.at)), t: num(o.last.t), res: o.last.res === 'yes' || o.last.res === 'no' ? o.last.res : '' } : null;
  const seen = {}; if (o.seen && typeof o.seen === 'object') for (const k of Object.keys(o.seen).slice(-120)) seen[k] = Math.floor(num(o.seen[k]));
  return { visit: typeof o.visit === 'string' ? o.visit : '', last, noes: Math.min(4, Math.floor(num(o.noes))), restAt: Number.isFinite(o.restAt) ? o.restAt : -1, seen, day: typeof o.day === 'string' ? o.day : '', n: Math.floor(num(o.n)) };
}
// the levels to wait after the last moment: none after a "yes", 1, 2, 4, 8 after "no"s in a row
export const spendGap = (noes) => (noes > 0 ? Math.min(SPEND.backoffMax, 2 ** (noes - 1)) : 0);
function spendOk(save, B, now) {
  const F = B.fx;
  if (earlyDays(save)) return false; // nothing before level 3 is won
  if (now < B.restUntil) return false;
  if (F.restAt >= 0 && B.done - F.restAt < SPEND.restLevels) return false;
  if (F.last && F.last.res !== 'yes' && B.done - F.last.at < spendGap(F.noes || (F.last.res === 'no' ? 1 : 0))) return false;
  if (F.day === dayKey(now) && F.n >= SPEND.perDay) return false;
  return true;
}
// cands: [{ id (a SPEND.rank key), key (what it shows: 'boost:stone', 'skin:dino', 'strip:14:stone' ...), price, taste? ('looks' | 'power') }]
// ctx: { now, visit (a name for this screen visit: one moment a visit) } -> { pick: cand | null, why }
export function spendPick(save, moment, cands, ctx = {}) {
  const now = ctx.now || Date.now(), B = brainState(save), F = B.fx;
  const list = (Array.isArray(cands) ? cands : []).filter((c) => c && SPEND.rank[c.id] != null);
  if (!list.length) return { pick: null, why: 'nothing to show' };
  if (ctx.visit && F.visit === ctx.visit) return { pick: null, why: 'one a visit' };
  const G = gate(save, moment, ctx);
  if (!G.spend) return { pick: null, why: earlyDays(save) ? 'nothing before level 3 is won' : G.why === 'ok' || G.money || G.nudge ? 'spend moments are resting' : G.why };
  const M = model(save, ctx);
  const fresh = list.filter((c) => (F.seen[c.id + ':' + (c.key || '')] || 0) < SPEND.sameMax);
  if (!fresh.length) return { pick: null, why: 'shown before' };
  const score = (c) => SPEND.rank[c.id] - (c.taste && c.taste === M.taste ? 0.5 : 0);
  const pick = fresh.slice().sort((a, b) => score(a) - score(b))[0];
  return { pick, why: `${pick.id} leads of ${fresh.length}` };
}
// what happened to a moment: 'show' (it played), 'take' (the player went for it), 'no' (the visit ended without),
// 'buy' (a coin purchase made from it: the moments rest SPEND.restLevels levels)
export function spendNote(save, event, data = {}, now = Date.now()) {
  const B = brainState(save), F = B.fx;
  if (event === 'show') {
    const d = dayKey(now), k = String(data.id) + ':' + String(data.key || '');
    F.visit = String(data.visit || ''); F.last = { id: String(data.id), key: String(data.key || ''), at: B.done, t: now, res: '' };
    F.seen = { ...F.seen, [k]: (F.seen[k] || 0) + 1 };
    if (F.day !== d) { F.day = d; F.n = 0; }
    F.n++;
  } else if (event === 'take' || event === 'buy') {
    if (F.last && !F.last.res) F.last.res = 'yes';
    F.noes = 0;
    if (event === 'buy') F.restAt = B.done;
  } else if (event === 'no') {
    if (F.last && !F.last.res) { F.last.res = 'no'; F.noes = Math.min(4, F.noes + 1); }
  }
}

// ---- what happened
export function note(save, event, data = {}, now = Date.now()) {
  const B = brainState(save);
  if (event === 'level') B.done++;
  else if (event === 'ask') B.asks = [...B.asks, { t: now, id: String(data.id || '?'), kind: data.kind || 'money', at: B.done, res: '' }].slice(-24);
  else if (event === 'yes' || event === 'no') { const a = [...B.asks].reverse().find((q) => q.id === String(data.id) && !q.res); if (a) a.res = event; }
  else if (event === 'buy') { if (data.money) B.restUntil = now + BRAIN.restDays * DAY; }
  else if (event === 'videoNo') B.videoNo++;
  else if (event === 'video') B.videoNo = 0;
}
// one line in the decision log: what was chosen (or nothing) and why
export function why(save, moment, pick, reason, now = Date.now()) {
  const B = brainState(save), M = model(save, { now });
  const e = { t: now, m: moment, pick: pick || '-', why: String(reason || ''), who: `${M.stage}/${M.mood}/${M.purse}/${M.spender}/${M.video}/${M.taste}` };
  const l = B.log[B.log.length - 1];
  if (l && l.m === e.m && l.pick === e.pick && l.why === e.why && now - l.t < 5 * MIN) return e; // the same answer again: not logged twice
  B.log = [...B.log, e].slice(-30);
  return e;
}
export const trace = (save) => brainState(save).log.slice();
