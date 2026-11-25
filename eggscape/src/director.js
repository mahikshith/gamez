// The Director (2026-11-20, mykee: "a reasoning engine working in the background that manages ads, store, offers and
// money... if the player can't win after several retries, give them a way to spend on power-ups, ads or a skip; let them
// try freebies; keep the fun"). offers.js decides WHICH paid offer may pop up and when; the Director reads the player and
// decides the HELP and the HOOKS around play. Pure logic over the save: main.js asks, draws, and reports back.
//
// What it reads (save.dir, kept small):
//   att      per level: tries, wins, fails in a row, best eggs, help used        (the struggle on this level)
//   recent   the last 12 results, 'w' / 'f'                                       (frustration across levels)
//   spent    coins spent in all, and on what kind                                 (is this a coin spender?)
//   trials   the freebies given: per level, per day, the chicks and skins tried    (never the same freebie twice)
//   trial    an egg skin on trial: { id, left (levels), from }                    (try it, then keep it)
//   henTrial a hen outfit on trial, the same shape (2026-11-20: the shop's "Try it free" on any egg or outfit)
//   lastSeen the last time the app was open                                       (the welcome-back gift)
//
// The help ladder on the fail card (one extra card, under RETRY, never more):
//   1st loss   a near miss (one egg short): "Retry with a Slow Fuse / Stone Shell" for coins, only if they have them
//   2nd loss   a FREEBIE once per level (2 a day): a locked power chick to try free on the next go, else a free booster
//   3rd+ loss  the booster that fits why they lost, for coins (one tap: buy and retry) or for a short video;
//              Skip (ad / ticket / coins) and the Helper Bundle come from ads.js / offers.js at this point as before
// After a win: the occasional egg-skin trial (every 5-8 wins, a skin they do not own), worn for the next 3 levels;
// when it ends, home asks once "Keep it?" for its coin price (or shows how to get the coins).
// On home: a welcome-back gift after 2+ days away; "You can unlock X now" when the coins first reach a chick or skin.
// Win streak (Royal Match): 2+ levels won in a row start the next level with free boosters; a loss ends it, a Rewind on
// the fail card (video, or coins that cost more each time on the same level) brings it back.
// Research behind it (2026-11-20): Royal Match (Naavik, Udonis, Gamigion): coin continues that climb, win-streak boosters,
// no forced video; CrazyGames: revive once, coin videos ~5 a day with shrinking rewards, the reward on the button;
// Pangle: try-before-buy lifts purchases; Google Play: no interstitial as a level starts or between a tap and its action.
//
// Fun guards: never anything on a first loss unless it was a near miss; no popup and no interstitial on a losing
// streak (main.js asks frustration() before an interstitial); every level stays free to beat; one price for everyone;
// no timers. A payer is never shown ads-for-help first (coins and owned boosts first).
import { BOOSTERS, SKINS, SKIN_ORDER, CHICK_PRICES, HEN_SKINS } from './economy.js';
import { now as gameNow } from './clock.js'; // 0.8.17: a day that never goes back (moving the phone's date repeats nothing)

const DAY = 864e5;
const dayKey = (now) => { const d = new Date(gameNow(now)); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
export const DIR = { trialsPerDay: 2, skinEvery: [5, 8], tasteEvery: [4, 6], skinLevels: 3, welcomeDays: 2, welcomeCoins: 60 };

export function dirState(save) {
  const d = save.dir && typeof save.dir === 'object' ? save.dir : {};
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  save.dir = {
    att: obj(d.att),
    recent: Array.isArray(d.recent) ? d.recent.filter((x) => x === 'w' || x === 'f').slice(-12) : [],
    spent: { all: Math.max(0, Number(d.spent && d.spent.all) || 0), by: obj(d.spent && d.spent.by) },
    trials: { lv: obj(d.trials && d.trials.lv), day: d.trials && typeof d.trials.day === 'string' ? d.trials.day : '', n: Math.max(0, Number(d.trials && d.trials.n) || 0), chicks: Array.isArray(d.trials && d.trials.chicks) ? d.trials.chicks : [], skins: Array.isArray(d.trials && d.trials.skins) ? d.trials.skins : [], hens: Array.isArray(d.trials && d.trials.hens) ? d.trials.hens : [], boosts: Array.isArray(d.trials && d.trials.boosts) ? d.trials.boosts : [] },
    trial: d.trial && SKINS[d.trial.id] && d.trial.left > 0 ? { id: d.trial.id, left: Math.floor(d.trial.left), from: Number(d.trial.from) || 0 } : null,
    henTrial: d.henTrial && HEN_SKINS[d.henTrial.id] && d.henTrial.left > 0 ? { id: d.henTrial.id, left: Math.floor(d.henTrial.left), from: Number(d.henTrial.from) || 0 } : null,
    chickTrial: d.chickTrial && CHICK_PRICES[d.chickTrial.id] && d.chickTrial.left > 0 ? { id: d.chickTrial.id, left: Math.floor(d.chickTrial.left), from: Number(d.chickTrial.from) || 0 } : null,
    tasteN: Math.max(0, Number(d.tasteN) || 0),
    keepAsk: d.keepAsk && SKINS[d.keepAsk] ? d.keepAsk : null,
    keepAskHen: d.keepAskHen && HEN_SKINS[d.keepAskHen] ? d.keepAskHen : null,
    winsToSkin: Number.isFinite(d.winsToSkin) ? d.winsToSkin : DIR.skinEvery[0] + 1, // (0.8.9: the wins until the next taste)
    lastSeen: Number(d.lastSeen) || 0,
    welcomeAt: Number(d.welcomeAt) || 0,
    afford: obj(d.afford), affordAt: Math.max(0, Number(d.affordAt) || 0),
    hot: Math.max(0, Number(d.hot) || 0), hotLost: Math.max(0, Number(d.hotLost) || 0),
  };
  return save.dir;
}

// ---- what happened
// every level played, as "id:tries/wins" (the speed log carries it: real first-try win rates, on the phone only)
export function triesLine(save) {
  const A = dirState(save).att || {};
  return Object.keys(A).map(Number).filter((k) => k > 0).sort((x, y) => x - y).map((k) => `${k}:${A[k].tries | 0}/${A[k].wins | 0}`).join(' ');
}
export function noteResult(save, levelId, won, info = {}) {
  const D = dirState(save);
  const a = D.att[levelId] || { tries: 0, wins: 0, streak: 0, best: 0, help: 0 };
  a.tries++;
  if (won) { a.wins++; a.streak = 0; D.hot++; D.hotLost = 0; } else { a.streak++; D.hotLost = D.hot; D.hot = 0; }
  a.best = Math.max(a.best, info.saved || 0);
  if (info.helped) a.help++;
  D.att[levelId] = a;
  D.recent = [...D.recent, won ? 'w' : 'f'].slice(-12);
  if (won) D.winsToSkin = Math.max(0, D.winsToSkin - 1);
  return a;
}
export function noteSpend(save, coins, kind) {
  const D = dirState(save);
  if (!(coins > 0)) return;
  D.spent.all += coins;
  D.spent.by[kind] = (D.spent.by[kind] || 0) + coins;
}
// ---- the win streak (research: Royal Match's win-streak start boosters). Levels won in a row, any level: from 2 in a
// row the next level starts with free boosters, more as it grows. A loss ends it; a Rewind on the fail card (video or
// coins) brings it back, so the streak is worth saving. Shown on the level card; from level 6 on.
export const HOT = [[2, ['stone']], [3, ['stone', 'sponge']], [5, ['stone', 'sponge', 'golden']]]; // 0.8.15: no Wide Nest here (nobody could see it); every one of these shows on the board
export function hotBoosts(save) {
  const D = dirState(save);
  if ((save.unlocked || 1) < 6) return [];
  let out = [];
  for (const [n, b] of HOT) if (D.hot >= n) out = b;
  return out;
}
export const hotCount = (save) => dirState(save).hot;
export const hotLost = (save) => dirState(save).hotLost;
export function keepHot(save) { const D = dirState(save); if (D.hotLost && !D.hot) { D.hot = D.hotLost; D.hotLost = 0; } }
// the coin price of a Rewind on the fail card: it climbs with each one bought on the same level (Royal Match's continue)
export const REWIND_COINS = [60, 120, 200];
export const rewindPrice = (n) => REWIND_COINS[Math.min(REWIND_COINS.length - 1, Math.max(0, n | 0))];
export function noteSeen(save, now) { dirState(save).lastSeen = now; }

// ---- the player, in a few numbers
// frustration 0..1: losses in a row here and across the last few levels. High = help, not ads.
export function frustration(save, levelId) {
  const D = dirState(save), a = levelId != null ? D.att[levelId] : null;
  const recentF = D.recent.slice(-6).filter((x) => x === 'f').length / 6;
  const here = a ? Math.min(1, a.streak / 4) : 0;
  return Math.min(1, here * 0.65 + recentF * 0.5);
}
export function profile(save) {
  const D = dirState(save), w = save.wallet || {}, o = save.offers || {};
  const payer = !!w.payer || !!w.noAds;
  const spender = D.spent.all >= 400;
  const adFan = (o.ads || 0) >= 5;
  return { payer, spender, adFan, coins: w.coins || 0, segment: payer ? 'payer' : spender ? 'spender' : adFan ? 'watcher' : (save.unlocked || 1) < 9 ? 'new' : 'free' };
}

// ---- the fail card's one help card
// ctx: { levelId, nearMiss, timeout, thorns (the level has thorns), villains (it has thieves/hunters), lockedChick
//   ({ id, name } the best locked chick to try), owned ({ boosterId: count }), adReady, now, chickLevel (chicks exist) }
// -> { kind: 'trialChick' | 'trialBoost' | 'buyBoost' | 'adBoost', id, price?, label, line } | null
// The early days (2026-11-20 first-five ladder): until level SELL_AFTER is won (any mode) nothing is sold or advertised:
// main.js asks this before the level page's Boosters tab, Free booster video and coin chip, the win card's Bonus chest,
// every offer card, the home nudge and the fail help. One switch, easy to tune.
export const SELL_AFTER = 3;
export function earlyDays(save) {
  const st = (save && save.stars) || {};
  return !['', 'e', 'h'].some((m) => (st[m + SELL_AFTER] || 0) > 0);
}

export function failHelp(save, ctx) {
  const D = dirState(save), lv = ctx.levelId;
  if (lv == null) return null;
  const a = D.att[lv] || { streak: 0 }, streak = a.streak, P = profile(save), coins = P.coins;
  const fit = bestBoost(ctx);
  const B = BOOSTERS[fit];
  const owns = ctx.owned && ctx.owned[fit] > 0;
  // 2nd loss here: a freebie, once per level, a couple a day
  const today = dayKey(ctx.now || Date.now()), nToday = D.trials.day === today ? D.trials.n : 0;
  if (streak >= 2 && !D.trials.lv[lv] && nToday < DIR.trialsPerDay) {
    const c = ctx.lockedChick;
    if (c && ctx.villains && ctx.chickLevel && !D.trials.chicks.includes(c.id)) return { kind: 'trialChick', id: c.id, label: `Try ${c.name} free`, line: 'Free for your next try.' };
    if (B && !owns) return { kind: 'trialBoost', id: fit, label: `Free ${B.name}`, line: B.line };
  }
  if (owns) return null; // they already have the right tool: the intro card offers it on the retry
  // a near miss on the first loss, or stuck (3+): the fitting booster for coins, else for a video
  if ((streak === 1 && ctx.nearMiss) || streak >= 3) {
    if (B && coins >= B.price) return { kind: 'buyBoost', id: fit, price: B.price, label: `Retry with ${B.name}`, line: B.line };
    if (B && ctx.adReady && !P.payer && streak >= 3) return { kind: 'adBoost', id: fit, label: `Watch: retry with ${B.name}`, line: B.line };
  }
  return null;
}
// the booster that answers why this level was lost
function bestBoost(ctx) {
  if (ctx.timeout) return 'time';
  if (ctx.thorns) return ctx.nearMiss ? 'golden' : 'snips';
  if (ctx.villains) return 'stone';
  return 'nest';
}
export function noteTrial(save, levelId, help, now) {
  const D = dirState(save), today = dayKey(now);
  if (D.trials.day !== today) { D.trials.day = today; D.trials.n = 0; }
  D.trials.n++;
  D.trials.lv[levelId] = 1;
  if (help.kind === 'trialChick') D.trials.chicks = [...D.trials.chicks, help.id].slice(-20);
}

// ---- egg-skin trials after wins
// -> { id, name } a skin to wear for the next few levels, or null
export function winGift(save, ctx = {}) {
  const D = dirState(save), w = save.wallet || {};
  if (D.trial || D.keepAsk || D.keepAskHen || D.winsToSkin > 0 || (save.unlocked || 1) < 6) return null;
  const owned = new Set(Array.isArray(w.skins) ? w.skins : ['classic']);
  const pool = SKIN_ORDER.filter((id) => id !== 'classic' && !owned.has(id) && !D.trials.skins.includes(id) && SKINS[id].price <= 300);
  if (!pool.length) return null;
  const pick = pool[Math.floor((ctx.rand ? ctx.rand() : Math.random()) * pool.length)];
  return { id: pick, name: SKINS[pick].name };
}
export function startSkinTrial(save, id, now, rand = Math.random) {
  const D = dirState(save);
  D.trial = { id, left: DIR.skinLevels, from: now };
  D.trials.skins = [...D.trials.skins, id].slice(-30);
  D.winsToSkin = DIR.skinEvery[0] + Math.floor(rand() * (DIR.skinEvery[1] - DIR.skinEvery[0] + 1));
}
// a level finished (won or lost): one level less on each trial; at the end home asks "Keep it?". Returns the egg skin
// whose trial just ended (or null); a hen outfit's end is noted the same way (keepAskHen)
export function tickTrial(save) {
  const D = dirState(save), w = save.wallet || {};
  if (D.henTrial && --D.henTrial.left <= 0) {
    const h = D.henTrial.id;
    D.henTrial = null;
    if (!(Array.isArray(w.henSkins) && w.henSkins.includes(h))) D.keepAskHen = h;
  }
  if (D.chickTrial && --D.chickTrial.left <= 0) D.chickTrial = null; // a chick on trial simply goes back to locked: no ask
  if (!D.trial) return null;
  D.trial.left--;
  if (D.trial.left > 0) return null;
  const id = D.trial.id;
  D.trial = null;
  if (!(Array.isArray(w.skins) && w.skins.includes(id))) D.keepAsk = id;
  return id;
}
export const trialSkin = (save) => { const D = dirState(save); return D.trial ? D.trial.id : null; };
export const trialHen = (save) => { const D = dirState(save); return D.henTrial ? D.henTrial.id : null; };
export const trialChick = (save) => { const D = dirState(save); return D.chickTrial ? D.chickTrial.id : null; };

// ---- tastes (0.8.9, mykee: "give the user the taste of the skins... test them out for a limited period, so the user
// understands what is in the store"): now and then a win gives a free try of a store item the player does not own,
// in a fixed rotation: an egg skin, a hen outfit, a power chick, a booster sample. The first comes with the first boss
// win (level 5, with the treasure), then one every DIR.tasteEvery wins (winsToSkin counts them down). One a win at most;
// a kind with nothing to give or still running is passed over. Same for every player; no clocks, no prices.
export const TASTE_KINDS = ['skin', 'hen', 'chick', 'boost'];
// ctx: { levelId, boss (this win was a boss), chicks: [{ id, name, price }] locked chicks the next level could use
// (empty when it cannot), rand } -> { kind, id, name } | null
export function winTaste(save, ctx = {}) {
  const D = dirState(save);
  if (D.tasteN === 0 ? !((ctx.levelId || 0) >= 5 && (ctx.boss || D.winsToSkin <= 0)) : D.winsToSkin > 0) return null;
  for (let k = 0; k < TASTE_KINDS.length; k++) {
    const kind = TASTE_KINDS[(D.tasteN + k) % TASTE_KINDS.length], T = tasteOf(save, kind, ctx);
    if (T) return T;
  }
  return null;
}
// the first three tastes give the cheapest of a kind, later ones any (so the pricey ones feel like a climb)
function pickOf(D, pool, price, rand) {
  if (!pool.length) return null;
  const by = [...pool].sort((a, b) => price(a) - price(b));
  return D.tasteN < 3 ? by[0] : by[Math.floor((rand ? rand() : Math.random()) * by.length)];
}
function tasteOf(save, kind, ctx) {
  const D = dirState(save), w = save.wallet || {};
  if (kind === 'skin') {
    if (D.trial || D.keepAsk) return null;
    const own = new Set(Array.isArray(w.skins) ? w.skins : ['classic']);
    const id = pickOf(D, SKIN_ORDER.filter((q) => q !== 'classic' && !own.has(q) && !D.trials.skins.includes(q)), (q) => SKINS[q].price, ctx.rand);
    return id ? { kind, id, name: SKINS[id].name } : null;
  }
  if (kind === 'hen') {
    if (D.henTrial || D.keepAskHen) return null;
    const own = new Set(Array.isArray(w.henSkins) ? w.henSkins : ['classic']);
    const id = pickOf(D, Object.keys(HEN_SKINS).filter((q) => q !== 'classic' && !HEN_SKINS[q].premium && !own.has(q) && !D.trials.hens.includes(q)), (q) => HEN_SKINS[q].price, ctx.rand);
    return id ? { kind, id, name: HEN_SKINS[id].name } : null;
  }
  if (kind === 'chick') {
    if (D.chickTrial) return null;
    const c = (ctx.chicks || []).filter((q) => !D.trials.chicks.includes(q.id)).sort((a, b) => a.price - b.price)[0];
    return c ? { kind, id: c.id, name: c.name } : null;
  }
  // a booster sample: one the bag has none of, the dearest first, each once while others are left
  const own = (id) => (w.owned && w.owned[id]) || 0, ids = Object.keys(BOOSTERS).filter((id) => own(id) === 0).sort((a, b) => BOOSTERS[b].price - BOOSTERS[a].price);
  const id = ids.find((q) => !D.trials.boosts.includes(q)) || null;
  return id ? { kind, id, name: BOOSTERS[id].name } : null;
}
// switch the taste on (a booster's +1 is paid by the caller: economy.tasteBooster) and wind the counter up again
export function startTaste(save, T, now, rand = Math.random) {
  const D = dirState(save), L = { id: T.id, left: DIR.skinLevels, from: now };
  if (T.kind === 'skin') { D.trial = L; D.trials.skins = [...D.trials.skins, T.id].slice(-30); }
  else if (T.kind === 'hen') { D.henTrial = L; D.trials.hens = [...D.trials.hens, T.id].slice(-40); }
  else if (T.kind === 'chick') { D.chickTrial = L; D.trials.chicks = [...D.trials.chicks, T.id].slice(-20); }
  else D.trials.boosts = [...D.trials.boosts, T.id].slice(-20);
  D.tasteN++;
  D.winsToSkin = DIR.tasteEvery[0] + Math.floor(rand() * (DIR.tasteEvery[1] - DIR.tasteEvery[0] + 1));
}
export function clearKeepAsk(save, kind = 'skin') { const D = dirState(save); if (kind === 'hen') D.keepAskHen = null; else D.keepAsk = null; }

// ---- "Try it free" in the shop (2026-11-20): any egg skin or hen outfit the player does not own, worn for the next
// DIR.skinLevels levels. Each one once (trials.skins / trials.hens remember it); one trial per kind at a time: trying
// another egg ends the egg on trial (and the same for outfits). Premium-only outfits (the Golden Hen) are not tried.
// kind: 'skin' | 'hen'. owned: the player already owns it (the caller asks economy.js)
export function canTry(save, kind, id, owned) {
  const D = dirState(save);
  if (owned) return false;
  if (kind === 'skin') return !!SKINS[id] && id !== 'classic' && !D.trials.skins.includes(id);
  if (kind === 'hen') return !!HEN_SKINS[id] && id !== 'classic' && !HEN_SKINS[id].premium && !D.trials.hens.includes(id);
  return false;
}
export function startTry(save, kind, id, now, owned = false) {
  if (!canTry(save, kind, id, owned)) return false;
  const D = dirState(save), T = { id, left: DIR.skinLevels, from: now };
  if (kind === 'hen') { D.henTrial = T; D.trials.hens = [...D.trials.hens, id].slice(-40); if (D.keepAskHen === id) D.keepAskHen = null; }
  else { D.trial = T; D.trials.skins = [...D.trials.skins, id].slice(-30); if (D.keepAsk === id) D.keepAsk = null; }
  return true;
}
// the player put on (bought or equipped) something else of that kind: the trial ends quietly, no "Keep it?"
export function endTrial(save, kind) { const D = dirState(save); if (kind === 'hen') D.henTrial = null; else D.trial = null; }
// what is on trial right now, and how many levels are left: { skin: { id, left } | null, hen: { id, left } | null }
export function trials(save) { const D = dirState(save); return { skin: D.trial ? { id: D.trial.id, left: D.trial.left } : null, hen: D.henTrial ? { id: D.henTrial.id, left: D.henTrial.left } : null, chick: D.chickTrial ? { id: D.chickTrial.id, left: D.chickTrial.left } : null }; }

// ---- home: one thing at most, in this order
// ctx: { now, chicks: [{ id, name, price }] locked chicks, money }
// -> { kind: 'keep', id, price } | { kind: 'welcome', coins } | { kind: 'afford', item, name, price } | null
export function homeNudge(save, ctx) {
  const D = dirState(save), now = ctx.now || Date.now(), coins = (save.wallet && save.wallet.coins) || 0;
  if (D.keepAsk) return { kind: 'keep', what: 'skin', id: D.keepAsk, name: SKINS[D.keepAsk].name, price: SKINS[D.keepAsk].price };
  if (D.keepAskHen) return { kind: 'keep', what: 'hen', id: D.keepAskHen, name: HEN_SKINS[D.keepAskHen].name, price: HEN_SKINS[D.keepAskHen].price };
  if (D.lastSeen && now - D.lastSeen >= DIR.welcomeDays * DAY && now - D.welcomeAt >= DIR.welcomeDays * DAY && (save.unlocked || 1) >= 3) return { kind: 'welcome', coins: DIR.welcomeCoins };
  // the first time the coins reach a locked chick (the strongest pull) or a skin: say so once
  // 0.8.7: and at most one of these a day. A player sitting on a pile of coins used to get one on every visit to the
  // map, a new item each time, until every affordable item had been named: a popup in the way of playing.
  if (D.affordAt && now - D.affordAt < DAY && now >= D.affordAt) return null;
  const c = (ctx.chicks || []).find((q) => coins >= q.price && !D.afford['c:' + q.id]);
  if (c) return { kind: 'afford', item: 'chick:' + c.id, name: c.name, price: c.price };
  const w = save.wallet || {}, owned = new Set(Array.isArray(w.skins) ? w.skins : ['classic']);
  const sk = SKIN_ORDER.find((id) => !owned.has(id) && SKINS[id].price > 0 && coins >= SKINS[id].price && !D.afford['s:' + id] && coins >= SKINS[id].price * 1.5);
  if (sk) return { kind: 'afford', item: 'skin:' + sk, name: SKINS[sk].name, price: SKINS[sk].price };
  return null;
}
export function noteNudge(save, n, now) {
  const D = dirState(save);
  if (n.kind === 'welcome') D.welcomeAt = now;
  if (n.kind === 'afford') D.affordAt = now;
  if (n.kind === 'afford') D.afford[(n.item.startsWith('chick:') ? 'c:' : 's:') + n.item.split(':')[1]] = 1;
}
export { CHICK_PRICES };

// ---- the shop mark (0.8.14, mykee: "users were not aware of the skins inside the shop ... whenever the number of coins
// are higher ... show a blinking mark, so they will be able to identify that they are eligible for the shop"):
// a badge on every shop button while the coins reach something new the player has not seen in the shop yet.
// ctx: { items: [{ key, kind: 'skin' | 'hen' | 'chick' | 'set' | ..., price, owned, tried }] (things sold for coins;
//   consumables such as boosters, kits, charges and tickets are not passed or are ignored) }
// -> { on, n (things not owned the coins pay for now), pick: { key, kind, price, why: 'tried' | 'dear' } | null }
// on: n is more than the player saw the last time the shop was open (seenShop), never in the early days.
const MARK_KINDS = { skin: 1, hen: 1, chick: 1, set: 1 };
export function shopMark(save, ctx = {}) {
  const coins = (save && save.wallet && save.wallet.coins) || 0;
  const can = (Array.isArray(ctx.items) ? ctx.items : []).filter((i) => i && MARK_KINDS[i.kind] && !i.owned && i.price > 0 && i.price <= coins);
  const dear = (a, b) => b.price - a.price || String(a.key).localeCompare(String(b.key));
  const tried = can.filter((i) => i.tried).sort(dear)[0];
  const look = can.filter((i) => i.kind === 'skin' || i.kind === 'hen').sort(dear)[0];
  const best = tried || look || can.slice().sort(dear)[0] || null;
  const pick = best ? { key: best.key, kind: best.kind, price: best.price, why: tried ? 'tried' : 'dear' } : null;
  const n = can.length, saw = Math.max(0, Number(save && save.seen && save.seen.shopSawN) || 0);
  return { on: !earlyDays(save) && n > saw, n, pick };
}
// the shop was opened (or closed after a purchase): what it showed is seen; the mark waits for the coins to reach more
export function seenShop(save, mark) { save.seen = { ...(save.seen || {}), shopSawN: Math.max(0, (mark && mark.n) | 0) }; }
