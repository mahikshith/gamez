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

const DAY = 864e5;
const dayKey = (now) => { const d = new Date(now); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
export const DIR = { trialsPerDay: 2, skinEvery: [5, 8], skinLevels: 3, welcomeDays: 2, welcomeCoins: 60 };

export function dirState(save) {
  const d = save.dir && typeof save.dir === 'object' ? save.dir : {};
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  save.dir = {
    att: obj(d.att),
    recent: Array.isArray(d.recent) ? d.recent.filter((x) => x === 'w' || x === 'f').slice(-12) : [],
    spent: { all: Math.max(0, Number(d.spent && d.spent.all) || 0), by: obj(d.spent && d.spent.by) },
    trials: { lv: obj(d.trials && d.trials.lv), day: d.trials && typeof d.trials.day === 'string' ? d.trials.day : '', n: Math.max(0, Number(d.trials && d.trials.n) || 0), chicks: Array.isArray(d.trials && d.trials.chicks) ? d.trials.chicks : [], skins: Array.isArray(d.trials && d.trials.skins) ? d.trials.skins : [], hens: Array.isArray(d.trials && d.trials.hens) ? d.trials.hens : [] },
    trial: d.trial && SKINS[d.trial.id] && d.trial.left > 0 ? { id: d.trial.id, left: Math.floor(d.trial.left), from: Number(d.trial.from) || 0 } : null,
    henTrial: d.henTrial && HEN_SKINS[d.henTrial.id] && d.henTrial.left > 0 ? { id: d.henTrial.id, left: Math.floor(d.henTrial.left), from: Number(d.henTrial.from) || 0 } : null,
    keepAsk: d.keepAsk && SKINS[d.keepAsk] ? d.keepAsk : null,
    keepAskHen: d.keepAskHen && HEN_SKINS[d.keepAskHen] ? d.keepAskHen : null,
    winsToSkin: Number.isFinite(d.winsToSkin) ? d.winsToSkin : DIR.skinEvery[0] + 1,
    lastSeen: Number(d.lastSeen) || 0,
    welcomeAt: Number(d.welcomeAt) || 0,
    afford: obj(d.afford), affordAt: Math.max(0, Number(d.affordAt) || 0),
    hot: Math.max(0, Number(d.hot) || 0), hotLost: Math.max(0, Number(d.hotLost) || 0),
  };
  return save.dir;
}

// ---- what happened
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
export const HOT = [[2, ['stone']], [3, ['stone', 'nest']], [5, ['stone', 'nest', 'sponge']]];
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
export function trials(save) { const D = dirState(save); return { skin: D.trial ? { id: D.trial.id, left: D.trial.left } : null, hen: D.henTrial ? { id: D.henTrial.id, left: D.henTrial.left } : null }; }

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
