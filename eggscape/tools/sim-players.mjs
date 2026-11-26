// A town of simulated players (0.8.15, mykee: "run simulations across multiple sets of users ... then we will be
// able to understand where it is going smooth or where it is going wrong"): node tools/sim-players.mjs [--n 300] [--days 30] [--seed 1] [--only quitter] [--json]
//
// Each player lives `days` days under the game's REAL rules: the purse and the shop (economy.js), the wheel (spin.js),
// the Director's streak and tastes (director.js), the Brain's gate for asks (brain.js), and the whole engine room
// (engine/: Ledger, Pulse, the learning Oracle, Conductor, Herald). Free, offline, repeatable (seeded).
//
// What is NOT real is the player. Two things are assumed and written down here, where they can be argued with:
//   WORLD     how hard a level is and what a booster is worth (replace with numbers from real speed logs when there are some)
//   PERSONAS  how eight kinds of people behave: skill, time, patience, videos, coins, money. By behaviour, never by who they are.
// So this proves what the RULES do to each kind of player (leaks, dead ends, starving, drowning in gifts, asks that
// come too often, a learner that never gets enough answers). It cannot say how many of each kind exist, or what real
// people will do. The win and fail flow below copies what src/main.js does (onWin, onFail); when that changes, this must too.
import * as E from '../src/economy.js';
import * as SP from '../src/spin.js';
import * as DR from '../src/director.js';
import * as BR from '../src/brain.js';
import * as OF from '../src/offers.js';
import * as OR from '../src/engine/oracle.js';
import * as HE from '../src/engine/herald.js';
import * as ENG from '../src/engine/index.js';
import { ROAD_N } from '../src/road.js';
import { BOSS_TREASURE_IDS } from '../src/economy.js';
import * as MINT from '../src/engine/mint.js';
import { LEVELS } from '../src/data/levels.js';
import { HARD_IDS } from '../src/sim/sim.js';
import { SKIP_COINS } from '../src/ads.js';
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';

// players/: the record of how players behave (README.md, kept by hand), the last report (latest.txt), one line per run
// (history.jsonl) and what real speed logs said (real.json, filled by tools/read-log.mjs)
export const HOME = join(dirname(fileURLToPath(import.meta.url)), '..', 'players');
export function realLevels() { try { const R = JSON.parse(readFileSync(join(HOME, 'real.json'), 'utf8')); return R && R.levels && typeof R.levels === 'object' ? R.levels : {}; } catch (_) { return {}; } }
const REAL = realLevels();

// ---------------------------------------------------------------- what is assumed
export const WORLD = {
  // how hard level id is, 0 (anyone) .. 1 (nearly nobody): the first five teach, then a slow climb; hard levels and bosses stand out
  // (0.8.17: sixty levels; the climb is spread over 55 levels instead of 45 and ends where it did)
  guess: (id) => Math.min(0.92, (id <= 5 ? 0.08 + 0.03 * id : 0.26 + (0.0105 * 45 * (id - 5)) / (ROAD_N - 5)) + (HARD_IDS.includes(id) ? 0.13 : 0) + (BOSS_TREASURE_IDS.includes(id) ? 0.07 : 0)),
  steep: 6, // how sharply skill against difficulty turns into winning
  // a level real players tried at least `realMin` times uses their win rate instead of the guess (taken as the rate of a
  // middling player, skill 0.5): players/real.json
  realMin: 8,
  diff(id) { const r = REAL[id]; if (!r || r[0] < this.realMin) return this.guess(id); const rate = Math.max(0.05, Math.min(0.95, r[1] / r[0])); return Math.max(0.02, Math.min(0.95, 0.5 - Math.log(rate / (1 - rate)) / this.steep)); },
  booster: 0.9, // what one booster adds (in the same units as steep x skill), at most two count
  learn: 0.22, // each earlier try of the same level helps this much, up to four tries
  rewind: 0.62, // the chance a Rewind turns a near miss into a win
  near: 0.35, // share of losses that end one egg short
  trySecs: (id, won) => (45 + 1.1 * id) * (won ? 1 : 0.6),
  // what moves a player's chance to stop playing for good, per day (hazard = persona.quit / (1 + day / 3), then these)
  leaveAfterLosses: 1.8, // the last session ended on a losing run
  leaveAfterWin: 0.8, // it ended on a win
  somethingWaits: 0.9, // a banked spin or a nearly full meter was left behind
  reminder: 0.9, // a note reached him since he last played: the chance to stop for good that day is this much
  // 0.8.17: what a note does (assumed, not measured; replace with real numbers when speed logs carry the notif line):
  // on a day he would not have played, a note that shows that day brings him in with his `tap`; after he stopped for
  // good, a note still brings him back with `tap` x lapsedBack (he had forgotten, not decided)
  lapsedBack: 0.35,
  askAgain: 0.6, // each later "Want a reminder?" card is said yes to this much less often than the one before
  cheerSpin: 0.7, // the cheer-up spin came during that losing run
  usdPerVideo: 0.01, // a rewarded video at a 10 dollar eCPM
  videoTire: 0.82, // each video already watched today makes the next "yes" this much less likely
  dailyFrom: 6, dailyDiff: 0.4, // the Daily Vault: one fresh level a day from here on, of middling difficulty
  // 0.8.17 the Pacer (src/engine/pacer.js) and Easy mode
  easy: 1.0, // what Easy adds to winning (its fuse x1.6, a wider nest, the free ally), in the same units as a booster
  easyEvery: 0.55, // Easy's second star (every egg home), given the win: a person who needed Easy often loses one
  easyBonus: 0.35, // Easy's third star also needs the bonus goal: the share of those who also meet it (tools/planner-easy.mjs says it is possible)
  hint: 0.6, // the free hint (the solver's next move) helps this much
  dareMet: 0.7, // a taken dare is met this share of the times the player would have three-starred anyway
  online: 0.85, // 0.8.17: share of sessions played online (offline: no videos, no online share of a win)
  gateBuy: 0.5, // a shut world gate he can pay for: bought at least this often (or as often as he spends coins on help)
};
// 0.8.17 the world gates (main.js envOpen / GATE_COINS, the Mint's rules): levels per world, counted from the levels
export const PER_ENV = LEVELS.filter((l) => l.world === LEVELS[0].world).length;
// skill 0..1; days: chance to play on a living day [weekday, weekend]; sess: sessions on such a day; mins: minutes each;
// patience: losses in a row on one level before the session ends; quit: base chance a day to stop for good;
// video: yes to an offered video; coin: spends coins on help when stuck; boost: uses a booster he holds on a level he lost;
// cosmetic: buys a skin, hen or chick his coins reach when he visits the shop; shop: visits the shop after a session;
// wheel: pays coins for another spin; pay: buys Unlock Everything when asked at a calm moment; notif: allows reminders;
// tap: opens the game from a reminder; stars: replays levels for three stars
// easy: drops to Easy after two losses in a row on a level (and star chasers replay on Easy at half this); dare: takes a dare
export const PERSONAS = {
  child: { skill: 0.34, days: [0.8, 0.95], sess: 2, mins: 22, patience: 5, quit: 0.16, video: 0.75, coin: 0.5, boost: 0.8, cosmetic: 0.9, shop: 0.6, wheel: 0.5, pay: 0, notif: 0.5, tap: 0.3, stars: 0.05, easy: 0.6, dare: 0.3 },
  commuter: { skill: 0.5, days: [0.85, 0.35], sess: 2, mins: 7, patience: 3, quit: 0.2, video: 0.3, coin: 0.35, boost: 0.6, cosmetic: 0.3, shop: 0.25, wheel: 0.15, pay: 0.02, notif: 0.55, tap: 0.3, stars: 0, easy: 0.3, dare: 0.2 },
  quitter: { skill: 0.42, days: [0.6, 0.6], sess: 1, mins: 10, patience: 3, quit: 0.42, video: 0.2, coin: 0.15, boost: 0.5, cosmetic: 0.1, shop: 0.1, wheel: 0.05, pay: 0, notif: 0.25, tap: 0.15, stars: 0, easy: 0.45, dare: 0.1 },
  grinder: { skill: 0.72, days: [0.9, 0.95], sess: 2, mins: 30, patience: 8, quit: 0.07, video: 0.25, coin: 0.1, boost: 0.25, cosmetic: 0.5, shop: 0.5, wheel: 0.1, pay: 0.04, notif: 0.6, tap: 0.4, stars: 0.45, easy: 0.35, dare: 0.8 },
  videoLover: { skill: 0.5, days: [0.8, 0.85], sess: 2, mins: 14, patience: 4, quit: 0.15, video: 0.95, coin: 0.3, boost: 0.7, cosmetic: 0.5, shop: 0.5, wheel: 0.3, pay: 0, notif: 0.6, tap: 0.35, stars: 0.1, easy: 0.3, dare: 0.3 },
  videoHater: { skill: 0.56, days: [0.75, 0.8], sess: 2, mins: 14, patience: 4, quit: 0.16, video: 0, coin: 0.7, boost: 0.7, cosmetic: 0.5, shop: 0.5, wheel: 0.35, pay: 0.05, notif: 0.4, tap: 0.3, stars: 0.1, easy: 0.3, dare: 0.3 },
  payer: { skill: 0.5, days: [0.8, 0.85], sess: 2, mins: 16, patience: 4, quit: 0.11, video: 0.15, coin: 0.6, boost: 0.8, cosmetic: 0.7, shop: 0.6, wheel: 0.4, pay: 0.6, notif: 0.6, tap: 0.4, stars: 0.1, easy: 0.25, dare: 0.3 },
  weekender: { skill: 0.55, days: [0.06, 0.95], sess: 3, mins: 25, patience: 5, quit: 0.09, video: 0.4, coin: 0.4, boost: 0.6, cosmetic: 0.4, shop: 0.4, wheel: 0.2, pay: 0.02, notif: 0.5, tap: 0.45, stars: 0.15, easy: 0.3, dare: 0.3 },
};

// ---------------------------------------------------------------- one life
const HOUR = 3600000, DAY = 24 * HOUR, T0 = new Date(2026, 10, 23, 0, 0, 0).getTime(); // a Monday
const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const sig = (z) => 1 / (1 + Math.exp(-z));
const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const stock = (w) => Object.values(w.owned || {}).reduce((a, b) => a + b, 0);
const totalStars = (save) => LEVELS.reduce((a, L) => a + (save.stars[L.id] || 0), 0);
// the same rule as main.js: world k is open when every world up to it is ready (the one before open, its boss passed)
// and has its stars or its bought gate
const envBoss = (save, k) => { const Lw = LEVELS.slice(k * PER_ENV, (k + 1) * PER_ENV), b = Lw.find((L) => L.boss) || Lw[Lw.length - 1]; return !!b && ((save.stars[b.id] || 0) > 0 || !!(save.skipped && save.skipped[b.id])); };
export function envOpen(save, k) {
  if (save.wallet.noAds) return true; // Unlock Everything opens every level
  const st = totalStars(save);
  for (let j = 0; j <= k; j++) if (!MINT.worldReady(j, () => true, (i) => envBoss(save, i)) || !(st >= MINT.worldNeed(j, PER_ENV) || !!(save.gates && save.gates[j]))) return false;
  return true;
}

export function life(P, seed, days = 30, watch = null, opt = {}) {
  const PAC = opt.pacer !== false; // the Pacer and the Easy star rule (0.8.17); false = the rules before them
  const R = rng(seed), yes = (p) => R() < p;
  const save = { unlocked: 1, stars: {}, best: {}, wallet: E.defaultWallet(), streak: 0, daily: {}, adDay: null, gates: {}, skipped: {}, mint: null, adapt: PAC };
  const S = { // what happened, for the report
    daysPlayed: 0, sessions: 0, cards: 0, cardsMax: 0, buys: {}, tries: 0, wins: 0, videos: 0, usd: 0, moneyAsks: 0, moneyAskEarly: 0, spins: { free: 0, ad: 0, coin: 0, miss: 0, retry: 0 }, bought: 0, used: 0, rewinds: 0, skips: 0, popups: 0, popSkips: 0, hints: 0, easyStars: 0, dares: 0, daresTook: 0, daresMet: 0, dareCoins: 0, leftOnLoss: false, unlocks: 0, coupons: 0, starved: 0, freeHelp: 0, asks: {},
    gates: 0, gateCoins: 0, gatesStars: 0, replays: 0, replayCoins: 0, online: 0, dbl: 0, dblCoins: 0, chests: 0, dayMax: 0, gatedBy: 0,
    notes: 0, notesGone: 0, notesSameDay: 0, notesTapped: 0, notesPulled: 0, lapsedBack: 0, noteIds: {}, remAsks: 0, askedDay: -1, allowed: false, quitDay: -1, quitAt: 0, levelAt: {}, doneDay: -1, idleDays: 0, maxStock: 0, maxPurse: 0, stuckMax: 0, down: '', bad: [],
  };
  const fail = (m) => { if (S.bad.length < 5) S.bad.push(m); };
  ENG.boot(save);
  let alive = true, lastEnd = '', cheered = false, plan = null, lastNoteDay = '', premium = false, cardsNow = 0, pending = { id: 0, n: 0 }, online = true, bonusWins = 0, bonusAt = 0, dayIn = { day: '', n: 0 };
  // coins from videos, video spins and daily gifts in one day (the Mint's DAY ceiling). Banked free spins are counted
  // apart (freeSpins): most come from fresh wins, one for every three new levels, so they are paid by progress, not by the day
  const dayAdd = (now, n, why) => { const k = dayKey(now); if (dayIn.day !== k) dayIn = { day: k, n: 0, by: {} }; dayIn.by[why] = (dayIn.by[why] || 0) + Math.max(0, n); if (why !== 'freeSpins') dayIn.n += Math.max(0, n); if (dayIn.n > S.dayMax) { S.dayMax = dayIn.n; S.dayTop = { ...dayIn.by }; } S.freeSpinMax = Math.max(S.freeSpinMax || 0, dayIn.by.freeSpins || 0); };
  let lastC = 0; S.src = {}; S.spinBy = {}; // coins in by where they came from (the report's faucet table)
  const sync = (why, now) => { const dc = save.wallet.coins - lastC; if (dc > 0) S.src[why] = (S.src[why] || 0) + dc; lastC = save.wallet.coins; return ENG.sync(save, why, dayKey(now), now); };
  const video = (now) => { if (premium) return; if (!online) fail('a video offline'); S.videos++; S.usd += WORLD.usdPerVideo; OF.noteRewarded(save, now); ENG.video(save); };
  const wantsVideo = (now) => premium || (online && yes(P.video * WORLD.videoTire ** OF.adsToday(save, now))); // Unlock Everything gives the reward without one; offline: no videos
  // an offer card at a calm moment: the offer engine picks (its caps included), the Brain's gate allows, as in main.js offerMoments
  const offer = (moment, now, ctx) => {
    if (DR.earlyDays(save)) { if (BR.gate(save, moment, { now, levelId: ctx.levelId }).money) S.moneyAskEarly++; return; }
    const c2 = { now, money: true, adReady: E.freeCoinsNext(save.adDay, dayKey(now)) > 0, ...ctx };
    const o = OF.evaluate(save, moment, c2); if (!o) return;
    const gt = BR.gate(save, moment, c2), paid = !!o.sku;
    if (paid ? !gt.money : !gt.nudge) return;
    OF.markShown(save, o, now, ctx.levelId); BR.note(save, 'ask', { id: o.id, kind: paid ? 'money' : 'video' }, now);
    S.cards++; cardsNow++; S.asks[o.id] = (S.asks[o.id] || 0) + 1;
    if (paid || o.id === 'skip_videos') {
      S.moneyAsks++;
      const sku = o.sku || 'eggscape_premium', usd = E.IAP[sku].usd;
      if (yes(Math.min(0.9, P.pay * Math.sqrt(2.99 / usd)))) {
        save.wallet = E.grantIap(save.wallet, sku, `sim-${seed}-${S.cards}`, now).wallet; S.usd += usd; S.buys[sku] = (S.buys[sku] || 0) + 1; premium = !!save.wallet.noAds;
        BR.note(save, 'yes', { id: o.id }, now); BR.note(save, 'buy', { money: true }, now); ENG.sync(save, 'iap', dayKey(now), now);
      } else { OF.markDismissed(save, o, now, ctx.levelId); BR.note(save, 'no', { id: o.id }, now); }
    } else if (wantsVideo(now)) { // a free thing for a video: a Chick Charge, or coins
      video(now); BR.note(save, 'yes', { id: o.id }, now);
      if (o.item === 'coins') { const c = E.freeCoinsNext(save.adDay, dayKey(now)); save.wallet = E.addCoins(save.wallet, c); save.adDay = E.noteFreeCoins(save.adDay, dayKey(now)); dayAdd(now, c, 'freeCoins'); }
      else save.wallet = { ...save.wallet, charges: Math.min(E.MAX_CHARGES, (save.wallet.charges || 0) + 1) };
      sync('video', now);
    } else { OF.markDismissed(save, o, now, ctx.levelId); BR.note(save, 'no', { id: o.id }, now); BR.note(save, 'videoNo', {}, now); }
  };
  // what is waiting (as main.js waitingCtx: what each note of the Herald's catalogue needs to be true)
  const waiting = () => { const tot = totalStars(save), ch = E.chestFor(tot, save.wallet.chests), on = SP.open(save), spins = on ? SP.banked(save) : 0, left = on ? SP.left(save) : 0, w = save.wallet, lv = save.unlocked;
    const att = (save.dir && save.dir.att && save.dir.att[lv]) || {}, bag = Object.keys(w.owned || {}).filter((b) => w.owned[b] > 0), wk = Math.floor((lv - 1) / PER_ENV) + 1, need = MINT.worldNeed(wk, PER_ENV) - tot, stuck = att.streak >= 3 && !save.stars[lv] ? lv : 0;
    return { spins, spinLeft: spins ? 0 : left, starsToChest: ch && !ch.ready ? ch.at - tot : 0, chestSkin: !!(ch && ch.reward.skin && !E.ownsSkin(w, ch.reward.skin)), daily: true, child: false, waiting: spins > 0 || left === 1,
      chestDay: w.daily || '', dailyOn: true, videosOn: !premium, videoDay: save.adDay && save.adDay.n > 0 ? save.adDay.day : '', premium, charges: w.charges || 0, chargeMax: E.MAX_CHARGES, premDay: w.premDay || '',
      starsToWorld: wk < 10 && need > 0 ? need : 0, nextWorld: wk < 10 ? 'World ' + (wk + 1) : '', nextBoss: BOSS_TREASURE_IDS.includes(lv) && !save.stars[lv] ? lv : 0, flame: DR.hotCount(save), stuck, stuckBoost: stuck && bag.length ? bag[0] : '', unlocked: lv, allDone: lv >= LEVELS.length && !!save.stars[LEVELS.length], newContent: false, giftOk: !DR.earlyDays(save) }; };
  // the reminder question at a happy moment (main.js remAskOk): the new rules, or (opt.before) 0.8.15's: once, on a good win with a spin near
  const ask = (moment, stars, d, now) => {
    if (S.allowed) return;
    const P2 = save.eng && save.eng.pulse, Ss = P2 && P2.sess && P2.sess[P2.sess.length - 1];
    const can = opt.before ? S.askedDay < 0 && ENG.herald.shouldAsk(save, { unlocked: save.unlocked, stars, ...waiting() })
      : ENG.herald.askNow(save, { moment, on: false, child: false, won3: !DR.earlyDays(save), won5: (save.stars[5] || 0) > 0, sess: Ss ? Ss.t : 0, days: (P2 && P2.days) || [] }, now);
    if (!can) return;
    if (!opt.before) ENG.herald.noteAsk(save, { sess: Ss ? Ss.t : 0 }, now);
    if (S.askedDay < 0) S.askedDay = d;
    S.remAsks++; S.allowed = yes(P.notif * WORLD.askAgain ** (S.remAsks - 1)); ENG.herald.answer(save, S.allowed, now);
  };
  const spinAll = (now) => { // every banked spin, then the video spin, then perhaps one for coins
    const day = dayKey(now);
    // (the villains take some pulls; since 0.8.16 a lost pull is lost: its coins or its video are spent)
    const got = (r) => { if (r.miss) S.spins.miss++; else { if (r.prize.kind === 'coupon') S.coupons++; const k = r.prize.id + (r.prize.instead ? '>coins' : ''); S.spinBy[k] = (S.spinBy[k] || 0) + Math.max(0, save.wallet.coins - lastC + (r.paid || 0)); } sync('spin', now); };
    let c0 = save.wallet.coins;
    while (SP.ways(save, day).free) { const r = SP.spin(save, 'free', day, R); if (!r) break; S.spins.free++; got(r); }
    dayAdd(now, save.wallet.coins - c0, 'freeSpins'); c0 = save.wallet.coins;
    while (SP.ways(save, day).ad && wantsVideo(now)) { video(now); const r = SP.spin(save, 'ad', day, R); if (!r) break; S.spins.ad++; got(r); }
    dayAdd(now, save.wallet.coins - c0, 'videoSpins');
    const c = SP.ways(save, day).coin;
    if (c != null && save.wallet.coins >= c + 60 && yes(P.wheel)) { const c0 = save.wallet.coins, r = SP.spin(save, 'coin', day, R); if (r) { S.spins.coin++; if (save.wallet.coins > c0 - c && r.miss) fail('a coin pull the villains took was not paid for'); got(r); } }
  };
  const shop = (now) => { // the best thing the purse reaches (the Conductor's suggestion), bought by those who buy such things
    const items = E.unlockables(save.wallet).map((u) => ({ key: u.kind + ':' + u.id, kind: u.kind, id: u.id, price: E.unlockPrice(save.wallet, u.price).price }));
    const g = ENG.suggest(save, items);
    if (!g || g.short > 0 || !yes(P.cosmetic)) return;
    const it = items.find((i) => i.key === g.key), w = it.kind === 'skin' ? E.buySkin(save.wallet, it.id) : it.kind === 'hen' ? E.buyHenSkin(save.wallet, it.id) : E.buyChick(save.wallet, it.id);
    if (w) { save.wallet = w; S.unlocks++; sync('shop', now); }
  };

  let noted = false; // a note showed since he last played
  for (let d = 0; d < days; d++) {
    const dow = (1 + d) % 7, weekend = dow === 6 || dow === 0; // day 0 is a Monday
    const note = plan ? [plan, ...(plan.more || [])].find((q) => dayKey(q.at) === dayKey(T0 + d * DAY)) : null; // a note that shows today
    if (note) noted = true;
    let pulled = null; // the note he opened the game from today
    if (!alive) { // he stopped; a note may still bring him back (he had forgotten): the assumed part
      if (note && yes(P.tap * WORLD.lapsedBack)) { alive = true; S.lapsedBack++; S.quitDay = -1; pulled = note; } else { if ([1, 3, 7].includes(d)) S.levelAt[d] = null; continue; }
    } else if (d > 0) { // does he stop for good? (the assumed part: WORLD's leave numbers)
      let h = P.quit / (1 + d / 3);
      h *= lastEnd === 'lost' ? WORLD.leaveAfterLosses * (cheered ? WORLD.cheerSpin : 1) : lastEnd === 'won' ? WORLD.leaveAfterWin : 1;
      if (waiting().waiting) h *= WORLD.somethingWaits;
      if (noted) h *= WORLD.reminder;
      if (yes(Math.min(0.95, h))) { alive = false; S.quitDay = d; S.quitAt = save.unlocked; S.leftOnLoss = lastEnd === 'lost'; if ([1, 3, 7].includes(d)) S.levelAt[d] = null; continue; }
      if (!yes(P.days[weekend ? 1 : 0])) {
        if (note && yes(P.tap)) { pulled = note; S.notesPulled++; } // he would not have played today: the note brought him
        else { if ([1, 3, 7].includes(d)) S.levelAt[d] = save.unlocked; continue; }
      }
    }
    noted = false;
    S.daysPlayed++;
    let newToday = false;
    for (let s = 0; s < P.sess; s++) {
      let now = T0 + d * DAY + (s === 0 ? 8 : s === 1 ? 18 : 21) * HOUR + Math.floor(R() * 40) * 60000;
      if (pulled && s === 0) now = Math.max(now, pulled.at + Math.floor(R() * 30) * 60000); // he opens it from the note
      // a reminder planned on the last leaving: it showed if its time has passed; some open the game from it
      let from = '';
      for (const q of plan ? [plan, ...(plan.more || [])] : []) if (now >= q.at) {
        S.notes++; S.noteIds[q.id] = (S.noteIds[q.id] || 0) + 1; const nd = dayKey(q.at), hr = new Date(q.at).getHours();
        if (opt.check && !opt.before) { const e = HE.entry(q.id); if (!e) fail('a note not in the catalogue: ' + q.id); }
        if (nd === lastNoteDay) { S.notesSameDay++; fail('two reminders on ' + nd); } lastNoteDay = nd;
        if (hr >= HE.HERALD.quietFrom || hr < HE.HERALD.quietTo) fail('a reminder in the quiet hours: ' + hr);
        if (!from && (pulled ? q === pulled : yes(P.tap))) { from = q.id; S.notesTapped++; }
      }
      plan = null;
      ENG.open(save, now, from); OF.startSession(save, now, R); S.sessions++;
      online = yes(WORLD.online); if (online) S.online++;
      if (DR.welcomeDue(save, now)) { const c = DR.welcomeCoins(now - DR.dirState(save).lastSeen); DR.noteNudge(save, { kind: 'welcome' }, now); save.wallet = E.addCoins(save.wallet, c); dayAdd(now, c, 'welcome'); sync('gift', now); ask('welcome', 0, d, now); } // the welcome-back gift (main.js nudge:yes), then perhaps the question
      { const w = E.openDailyChest(save.wallet, dayKey(now)); if (w) { dayAdd(now, w.coins - save.wallet.coins, 'dailyChest'); save.wallet = w; sync('daily', now); } }
      const end = now + P.mins * 60000; let run = 0; cheered = false; lastEnd = ''; cardsNow = 0;
      offer('home', now, { levelId: save.unlocked });
      if (save.unlocked >= WORLD.dailyFrom && save.daily.paid !== dayKey(now)) { // the Daily Vault: one fresh run a day
        now += 80000; S.tries++;
        if (yes(sig(WORLD.steep * (P.skill - WORLD.dailyDiff)))) { S.wins++; save.daily = { day: dayKey(now), paid: dayKey(now) }; const vc = E.levelCoins({ stars: 2, saved: 2, eggs: 3 }).total + MINT.FAUCETS.dailyVault.coins; save.wallet = E.payWin(save.wallet, vc + MINT.onlineBonus(vc, online), true).wallet; sync('vault', now); SP.noteWin(save, true); SP.notePlayed(save, dayKey(now)); spinAll(now); }
      }
      while (now < end) {
        // which level: the next one, or (those who chase stars) an old one with stars missing; after the last level only old ones are left
        const done = save.unlocked >= LEVELS.length && (save.stars[LEVELS.length] || 0) > 0;
        let L = LEVELS[Math.min(LEVELS.length, save.unlocked) - 1];
        if (done || yes(P.stars)) { const old = LEVELS.filter((l) => l.id < save.unlocked + (done ? 1 : 0) && (save.stars[l.id] || 0) < 3); if (old.length) L = old[Math.floor(R() * old.length)]; else if (done) break; }
        if (!done && L.id === Math.min(LEVELS.length, save.unlocked)) { // 0.8.17 the world gate: shut, he pays for the stars it misses (when he can and will), else replays for stars
          const k = Math.floor((L.id - 1) / PER_ENV);
          if (!envOpen(save, k)) {
            const B = MINT.gateBuy(k, { stars: totalStars(save), perEnv: PER_ENV, coins: save.wallet.coins, open: (j) => envOpen(save, j), bossPassed: (j) => envBoss(save, j) });
            if (B.why === 'order') fail('a gate in front of a world whose boss was not passed');
            if (B.ok && yes(Math.max(WORLD.gateBuy, P.coin))) { save.wallet = { ...save.wallet, coins: save.wallet.coins - B.price }; save.gates = { ...save.gates, [k]: 1 }; S.gates++; S.gateCoins += B.price; sync('shop', now); }
            else { const old = LEVELS.filter((l) => l.id < L.id && (save.stars[l.id] || 0) < 3); S.gatedBy++; if (old.length) L = old[Math.floor(R() * old.length)]; else break; }
          }
        }
        if (done && S.doneDay < 0) S.doneDay = d;
        const id = L.id, hard = HARD_IDS.includes(id), att = (save.dir && save.dir.att && save.dir.att[id]) || { tries: 0, streak: 0 };
        // Easy: after two losses in a row here some drop to it for the next try; star chasers replay old levels on it
        const chase = id < save.unlocked && (save.stars[id] || 0) > 0, easy = (att.streak >= 2 && yes(P.easy || 0)) || (chase && yes((P.easy || 0) * 0.5));
        // the Pacer's dare (a cruising player, by choice); a "no boosters" dare takes the streak's free ones' place
        let dare = null;
        if (PAC && !DR.earlyDays(save)) { const dd = ENG.pacer.dareFor(save, { levelId: id, boss: !!L.boss, tries: att.tries, eggs: 3, target: L.target || 2, turns: 0, chick: id >= 13, goals: ['home', 'clean', 'time'] }); if (dd) { S.dares++; if (yes(P.dare || 0)) ENG.pacer.dareTake(save, id, true); dare = ENG.pacer.dareStart(save, id); if (dare) S.daresTook++; } }
        // help before the try: a booster he holds (on a level that already beat him, or a hard one), bought if he is stuck and buys
        let help = (DR.hotCount(save) >= 2 && !(dare && dare.kind === 'noboost') ? 0.5 : 0) + (pending.id === id ? pending.n * WORLD.booster + (pending.hint ? WORLD.hint : 0) : 0);
        if (PAC && !(dare && dare.kind === 'noboost') && ENG.pacer.retryGift(save, id)) help += WORLD.booster; // the Pacer's free booster after "Keep trying" (main.js pacerRetry: on the retry of that level)
        if (att.streak >= 3 && !help && !stock(save.wallet)) S.starved++; // a try on a level that beat him three times, with no help at all
        pending = { id: 0, n: 0 };
        if (!(dare && dare.kind === 'noboost') && (att.streak >= 1 || hard) && stock(save.wallet) && yes(P.boost)) for (let k = 0; k < 2 && stock(save.wallet) && (k === 0 || att.streak >= 3); k++) { const own = Object.keys(save.wallet.owned).filter((b) => save.wallet.owned[b] > 0), b = own[Math.floor(R() * own.length)]; save.wallet = E.useBooster(save.wallet, b); S.used++; help += WORLD.booster; sync('use', now); }
        ENG.levelStart(save, { levelId: id, hard }, now);
        const ez = easy ? WORLD.easy : 0;
        let won = yes(Math.max(0.03, Math.min(0.97, sig(WORLD.steep * (P.skill - WORLD.diff(id)) + help + ez + WORLD.learn * Math.min(4, att.tries)))));
        const near = !won && yes(WORLD.near), early = DR.earlyDays(save);
        if (near && !early) { // one egg short: Rewind for a video, or for coins
          const price = DR.rewindPrice(0);
          if (wantsVideo(now)) { video(now); S.rewinds++; won = yes(WORLD.rewind); }
          else if (save.wallet.coins >= price && yes(P.coin)) { save.wallet = { ...save.wallet, coins: save.wallet.coins - price }; sync('rewind', now); S.rewinds++; won = yes(WORLD.rewind); }
        }
        const secs = WORLD.trySecs(id, won); now += secs * 1000 + 20000; S.tries++;
        if (won) {
          S.wins++; run = 0; lastEnd = 'won';
          const pw = sig(WORLD.steep * (P.skill - WORLD.diff(id)) + help + ez), old = save.stars[id] || 0;
          // Easy's stars (after): every egg for the second, every egg AND the bonus for the third; before: as Medium
          const stars = easy && PAC ? (yes(WORLD.easyEvery) ? (yes(pw * pw * WORLD.easyBonus / WORLD.easyEvery) ? 3 : 2) : 1) : yes(pw * pw) ? 3 : yes(0.75) ? 2 : 1;
          if (easy) S.easyStars += Math.max(0, stars - old);
          bonusWins++;
          let c = E.levelCoins({ stars, saved: L.target || 1, eggs: 3, perfect: stars === 3 && yes(0.5), hard, fresh: stars > old, easy: easy && PAC });
          if (dare) { const met = stars === 3 ? yes(WORLD.dareMet) : dare.kind === 'noboost' && yes(0.5); if (met) { S.daresMet++; S.dareCoins += ENG.pacer.dareCoins(c.total); c = { ...c, total: c.total + ENG.pacer.dareCoins(c.total) }; } dare.met = met; }
          const cOn = c.total + MINT.onlineBonus(c.total, online);
          if (stars <= old) { S.replays++; S.replayCoins += c.total; }
          const pay = E.payWin(save.wallet, cOn, true); save.wallet = pay.wallet; sync(stars > old ? 'win' : 'replay', now);
          if (PAC) ENG.pacer.result(save, { id, won: true, stars, first: !att.tries, dare: dare ? { kind: dare.kind, met: dare.met } : null });
          DR.noteResult(save, id, true, { saved: L.target || 1 }); BR.note(save, 'level', {}, now);
          const vShown = !premium && !early;
          ENG.result(save, { id, won: true, secs, near: false }, { hard, videoShown: vShown, coinShown: false }, now);
          DR.tickTrial(save);
          if (stars > old) { save.stars[id] = stars; newToday = true; }
          save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, id + 1));
          let spinGot = SP.noteWin(save, stars > old); if (secs >= 15 && SP.notePlayed(save, dayKey(now))) spinGot = true;
          if (L.boss && stars > old) ask('boss', stars, d, now); else if (spinGot) ask('spin', stars, d, now);
          // the win page's one video (0.8.17: inside the Mint's win-video pot a day): the Bonus chest when an ad break would
          // have been due (ads.js bonusDue: from level 8, three wins and four minutes apart), else Double coins
          const day = dayKey(now), chest = id >= 9 /* ads.js INTER.from (8 on the 50-level road) */ && bonusWins >= 3 && now - bonusAt >= 240000 && MINT.winVideoOk(save.mint, day, E.BONUS_CHEST.coins);
          if (chest) { bonusWins = 0; bonusAt = now; }
          if (!early && (chest || MINT.winVideoOk(save.mint, day, pay.coins)) && wantsVideo(now)) {
            video(now);
            if (chest) { save.wallet = E.openBonusChest(save.wallet, id); save.mint = MINT.winVideoTake(save.mint, day, E.BONUS_CHEST.coins); S.chests++; dayAdd(now, E.BONUS_CHEST.coins, 'winVideo'); }
            else { save.wallet = E.addCoins(save.wallet, pay.coins); save.mint = MINT.winVideoTake(save.mint, day, pay.coins); S.dbl++; S.dblCoins += pay.coins; dayAdd(now, pay.coins, 'winVideo'); }
            sync('video', now);
          }
          if (E.bossTreasure(id) && !E.treasureOpened(save.wallet, id)) { const w = E.openBossTreasure(save.wallet, id); if (w) { save.wallet = w; sync('treasure', now); } }
          { const T = DR.winTaste(save, { levelId: id, boss: !!L.boss, chicks: [], rand: R }); if (T) { DR.startTaste(save, T, now, R); if (T.kind === 'boost') { save.wallet = E.tasteBooster(save.wallet, T.id); sync('gift', now); } } }
          for (let ch = E.chestFor(totalStars(save), save.wallet.chests); ch && ch.ready; ch = E.chestFor(totalStars(save), save.wallet.chests)) { const w = E.openChest(save.wallet, ch); if (!w) break; save.wallet = w; sync('chest', now); }
          offer('win', now, { levelId: id, prevFails: att.streak });
          spinAll(now);
        } else {
          run++; lastEnd = 'lost'; S.stuckMax = Math.max(S.stuckMax, att.streak + 1);
          DR.noteResult(save, id, false, { saved: Math.max(0, (L.target || 1) - (near ? 1 : 2)) }); BR.note(save, 'level', {}, now);
          ENG.result(save, { id, won: false, secs, near }, { hard, near, videoShown: !premium, coinShown: near && !premium, price: DR.rewindPrice(0) }, now);
          DR.tickTrial(save);
          const streak = ((save.dir && save.dir.att && save.dir.att[id]) || {}).streak || 0;
          if (SP.noteLoss(save, id, streak, dayKey(now))) { cheered = true; spinAll(now); }
          if (secs >= 15) SP.notePlayed(save, dayKey(now));
          if (PAC) { // the Pacer after the loss: "Stuck? Skip this one" (a video or coins, or Keep trying: a free booster next), a free hint, a boss Scarecrow
            ENG.pacer.result(save, { id, won: false });
            const early2 = DR.earlyDays(save), canSkip = id < LEVELS.length && !save.skipped[id] && !(save.stars[id] > 0);
            const F = ENG.pacer.failPlan(save, { levelId: id, boss: !!L.boss, early: early2, canSkip, now });
            if (F.scare) { ENG.pacer.gave(save, id, 'scare'); pending = { id, n: 1 }; S.freeHelp++; }
            else if (F.hint) { ENG.pacer.gave(save, id, 'hint'); pending = { id, n: 0, hint: true }; S.hints++; }
            if (F.ask) {
              ENG.pacer.asked(save, id); S.popups++;
              let gone = false;
              if (wantsVideo(now)) { video(now); gone = true; }
              else if (save.wallet.coins >= SKIP_COINS && yes(P.coin)) { save.wallet = { ...save.wallet, coins: save.wallet.coins - SKIP_COINS }; sync('skip', now); gone = true; }
              if (gone) { save.skipped = { ...save.skipped, [id]: 1 }; save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, id + 1)); S.skips++; S.popSkips++; run = 0; offer('fail', now, { levelId: id, fails: streak }); continue; }
              ENG.pacer.declined(save, id); // "Keep trying": the next try on this level starts with a free booster (taken at the try's start)
            }
            else if (F.gift) ENG.pacer.declined(save, id); // no skip here (a won level): the same free booster
          }
          if (streak >= P.patience + 2 && E.itemCount(save.wallet, 'skip') > 0) { const w = E.useTicket(save.wallet, 'skip'); if (w) { save.wallet = w; if (!save.stars[id]) save.skipped = { ...save.skipped, [id]: 1 }; save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, id + 1)); S.skips++; sync('skip', now); run = 0; } }
          if (!early) { // the fail page's one help (the Director): a free try of the fitting booster, or that booster for coins or a video
            const H = DR.failHelp(save, { struggling: PAC && !!ENG.pacer.read(save, { levelId: id, now }).struggling, levelId: id, now, nearMiss: near, timeout: yes(0.3), villains: id >= 6, thorns: false, owned: save.wallet.owned || {}, adReady: true });
            const keep = (n) => ({ id, n: (pending.id === id ? pending.n : 0) + n, hint: pending.id === id && pending.hint }); // (the Pacer's gifts above stay)
            if (H && H.kind === 'trialBoost') { DR.noteTrial(save, id, H, now); pending = keep(1); S.freeHelp++; }
            else if (H && H.kind === 'buyBoost' && yes(P.coin)) { const w = E.buy(save.wallet, H.id); if (w) { save.wallet = E.useBooster(w, H.id) || w; S.bought++; S.used++; pending = keep(1); sync('shop', now); } }
            else if (H && H.kind === 'adBoost' && wantsVideo(now)) { video(now); pending = keep(1); }
          }
          offer('fail', now, { levelId: id, fails: streak, nearMiss: near, lastPrice: near ? DR.rewindPrice(0) : 0 });
          if (run >= P.patience) break; // enough for now
        }
        S.maxStock = Math.max(S.maxStock, stock(save.wallet)); S.maxPurse = Math.max(S.maxPurse, save.wallet.coins);
        if (save.wallet.coins < 0) fail('the purse went under zero');
        if (Object.values(save.wallet.owned || {}).some((n) => n > E.MAX_OWNED)) fail('more of one booster than the bag takes');
      }
      S.cardsMax = Math.max(S.cardsMax, cardsNow);
      if (cardsNow > OF.CAPS.perSession) fail(`${cardsNow} offer cards in one session`);
      if (yes(P.shop)) shop(now);
      if (watch) { watch(save, d, now, S); sync('other', now); }
      DR.noteSeen(save, now);
      plan = ENG.close(save, { ...waiting(), unlocked: save.unlocked, screen: lastEnd === 'won' ? 'win' : 'fail', level: save.unlocked, lastWon: lastEnd === 'won' }, now);
      if (plan && plan.at - now < HE.HERALD.minAheadH * HOUR) fail('a reminder planned too soon after leaving');
      if (plan && !S.allowed) fail('a reminder was planned without permission');
    }
    if (!newToday) S.idleDays++;
    if ([1, 3, 7].includes(d)) S.levelAt[d] = save.unlocked;
  }
  if (plan && !alive) { const n = [plan, ...(plan.more || [])].filter((q) => q.at < T0 + days * DAY).length; S.notes += n; S.notesGone = n; } // what still reaches a player who left: then nothing more, ever
  S.levelAt[days] = save.unlocked;
  for (const d of [1, 3, 7]) if (S.levelAt[d] == null) S.levelAt[d] = S.quitDay >= 0 && S.quitDay <= d ? null : save.unlocked;
  // what the engine saw
  const F = ENG.flow(save) || {}, O = OR.oraState(save), H = HE.herState(save);
  S.level = save.unlocked; S.stars = totalStars(save); S.purse = save.wallet.coins; S.stock = stock(save.wallet); S.premium = premium;
  S.in = F.allIn || 0; S.out = F.allOut || 0; { const A = (save.eng.led && save.eng.led.all) || {}; S.gifts = A.gi || 0; }
  S.oracle = Object.fromEntries(['win', 'back', 'video', 'coins'].map((k) => [k, { n: O.cal[k].n, rules: O.base[k].n ? O.base[k].sq / O.base[k].n : null, fit: O.fit[k].n ? O.fit[k].sq / O.fit[k].n : null, served: O.cal[k].n ? O.cal[k].sq / O.cal[k].n : null, learned: OR.learned(O, k), trusted: OR.trusted(save, k) }]));
  S.heraldIgnored = H.ignored;
  S.down = ENG.HUB.healthLine();
  if (/DOWN/.test(S.down)) fail('a subsystem went down: ' + S.down);
  if (S.moneyAskEarly) fail('the money gate opened before level 3 was won');
  return S;
}

// ---------------------------------------------------------------- a town
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const med = (a) => { if (!a.length) return 0; const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
const pct = (a, f) => (a.length ? Math.round((a.filter(f).length * 100) / a.length) : 0);
export function town({ n = 300, days = 30, seed = 1, only = null, pacer = true, opt = {} } = {}) {
  const out = {};
  for (const [name, P] of Object.entries(PERSONAS)) {
    if (only && name !== only) continue;
    const L = []; for (let i = 0; i < n; i++) L.push(life(P, seed * 100003 + i * 7919 + name.length * 31 + name.charCodeAt(0), days, null, { ...opt, pacer }));
    const alive = (d) => (s) => s.quitDay < 0 || s.quitDay > d, quitAt = {}; for (const s of L) if (s.quitDay >= 0) quitAt[s.quitAt] = (quitAt[s.quitAt] || 0) + 1;
    const ora = (k, f) => L.map((s) => s.oracle[k]).filter((o) => o.n >= OR.LEARN.min && o.rules != null).map(f);
    out[name] = {
      n, d1: pct(L, alive(1)), d7: pct(L, alive(7)), d30: pct(L, alive(days - 1)),
      level7: med(L.filter(alive(7)).map((s) => s.levelAt[7] || 0)), level30: med(L.filter(alive(days - 1)).map((s) => s.level)), finished: pct(L, (s) => s.doneDay >= 0),
      quitTop: Object.entries(quitAt).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([lv, c]) => `L${lv} ${Math.round((c * 100) / n)}%`).join(', '),
      tries: mean(L.map((s) => s.tries)), winRate: mean(L.map((s) => (s.tries ? s.wins / s.tries : 0))), stuckMax: med(L.map((s) => s.stuckMax)),
      coinsIn: mean(L.map((s) => s.in)), coinsOut: mean(L.map((s) => s.out)), sink: mean(L.map((s) => (s.in ? s.out / s.in : 0))), purse: med(L.map((s) => s.purse)), maxPurse: med(L.map((s) => s.maxPurse)),
      gifts: mean(L.map((s) => s.gifts)), bought: mean(L.map((s) => s.bought)), used: mean(L.map((s) => s.used)), stock: mean(L.map((s) => s.stock)), starved: mean(L.map((s) => (s.tries ? (s.starved * 100) / s.tries : 0))), freeHelp: mean(L.map((s) => s.freeHelp)),
      gates: mean(L.map((s) => s.gates)), gateCoins: mean(L.map((s) => s.gateCoins)), gatedBy: mean(L.map((s) => s.gatedBy)), replays: mean(L.map((s) => s.replays)), dbl: mean(L.map((s) => s.dbl)), src: (() => { const A = {}; for (const s of L) for (const [k, v] of Object.entries(s.src || {})) A[k] = (A[k] || 0) + v / L.length; return A; })(), dayMax: Math.max(...L.map((s) => s.dayMax)), dayMed: med(L.map((s) => s.dayMax)),
      unlocks: mean(L.map((s) => s.unlocks)), coupons: mean(L.map((s) => s.coupons)), spinsFree: mean(L.map((s) => s.spins.free)), spinsAd: mean(L.map((s) => s.spins.ad)), spinsCoin: mean(L.map((s) => s.spins.coin)), spinsMiss: mean(L.map((s) => s.spins.miss)), spinsRetry: mean(L.map((s) => s.spins.retry)),
      videos: mean(L.map((s) => s.videos)), videosDay: mean(L.map((s) => (s.daysPlayed ? s.videos / s.daysPlayed : 0))), usd: mean(L.map((s) => s.usd)), premium: pct(L, (s) => s.premium), paid: pct(L, (s) => Object.keys(s.buys).length > 0),
      moneyAsks: mean(L.map((s) => s.moneyAsks)), asksPerSession: mean(L.map((s) => (s.sessions ? s.moneyAsks / s.sessions : 0))), askTop: (() => { const A = {}; for (const s of L) for (const [k, v] of Object.entries(s.asks)) A[k] = (A[k] || 0) + v; return Object.entries(A).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${(v / n).toFixed(1)}`).join(', '); })(), cards: mean(L.map((s) => s.cards)), cardsMax: Math.max(...L.map((s) => s.cardsMax)),
      remAsks: mean(L.map((s) => s.remAsks)), pulled: mean(L.filter((s) => s.allowed).map((s) => s.notesPulled)), lapsedBack: pct(L, (s) => s.lapsedBack > 0), noteIds: (() => { const A = {}; for (const s of L) for (const [k, v] of Object.entries(s.noteIds)) A[k] = (A[k] || 0) + v; return Object.fromEntries(Object.entries(A).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(v / n).toFixed(2)])); })(),
      asked: pct(L, (s) => s.askedDay >= 0), askedDay: med(L.filter((s) => s.askedDay >= 0).map((s) => s.askedDay)), allowed: pct(L, (s) => s.allowed), notes: mean(L.filter((s) => s.allowed).map((s) => s.notes)), notesGone: mean(L.filter((s) => s.allowed && s.quitDay >= 0).map((s) => s.notesGone)), tapped: mean(L.filter((s) => s.allowed).map((s) => s.notesTapped)),
      idle: mean(L.map((s) => (s.daysPlayed ? s.idleDays / s.daysPlayed : 0))),
      oracle: Object.fromEntries(['win', 'back', 'video', 'coins'].map((k) => [k, { graded: pct(L, (s) => s.oracle[k].n >= OR.LEARN.min), n: med(L.map((s) => s.oracle[k].n)), rules: mean(ora(k, (o) => o.rules)), fit: mean(ora(k, (o) => o.fit)), learned: pct(L, (s) => s.oracle[k].learned), trusted: pct(L, (s) => s.oracle[k].trusted) }])),
      leftOnLoss: pct(L, (s) => s.leftOnLoss), doneDays: med(L.filter((s) => s.doneDay >= 0).map((s) => s.doneDay)), easyStars: mean(L.map((s) => s.easyStars)), popups: mean(L.map((s) => s.popups)), popSkips: mean(L.map((s) => s.popSkips)), hints: mean(L.map((s) => s.hints)),
      dares: mean(L.map((s) => s.dares)), daresTook: mean(L.map((s) => s.daresTook)), daresMet: mean(L.map((s) => s.daresMet)), dareCoins: mean(L.map((s) => s.dareCoins)), skips: mean(L.map((s) => s.skips)),
      bad: L.flatMap((s) => s.bad),
    };
  }
  return out;
}

// ---------------------------------------------------------------- owning everything (0.8.17, the Mint's targets)
// Each kind of player, never leaving and never paying, buys after every session every thing to own his purse reaches,
// cheapest first: the most anyone of his habits can own. The coin catalogue: egg skins, hen outfits and the premium
// chicks (the six level chicks come free with their level). -> { kind: { day (median day all owned, 999: not inside
// `days`), first (the earliest), at30 (share of the catalogue's coins owned on day 30), level30 } }
export const catalogue = (w) => E.unlockables(w || {}).filter((u) => u.kind !== 'chick' || E.PREMIUM_CHICKS[u.id]);
export const CATALOGUE = catalogue({}).reduce((a, u) => a + u.price, 0);
function buyAll(save) {
  for (;;) {
    const U = catalogue(save.wallet).sort((a, b) => a.price - b.price);
    const u = U[0], w = u && (u.kind === 'skin' ? E.buySkin(save.wallet, u.id) : u.kind === 'hen' ? E.buyHenSkin(save.wallet, u.id) : E.buyChick(save.wallet, u.id));
    if (!w) return; save.wallet = w;
  }
}
export function owning({ n = 40, days = 90, seed = 1, only = null } = {}) {
  const out = {}, owned = (save) => CATALOGUE - catalogue(save.wallet).reduce((a, u) => a + u.price, 0);
  for (const [name, P0] of Object.entries(PERSONAS)) {
    if (only && name !== only) continue;
    const P = { ...P0, quit: 0, pay: 0 }, all = [], at30 = [], lv30 = [];
    for (let i = 0; i < n; i++) {
      let done = 999, w30 = 0, l30 = 0;
      life(P, seed * 7001 + i * 7919 + name.length * 31, days, (save, d) => { buyAll(save); if (d < 30) { w30 = owned(save); l30 = save.unlocked; } if (done === 999 && owned(save) >= CATALOGUE) done = d + 1; });
      all.push(done); at30.push(w30 / CATALOGUE); lv30.push(l30);
    }
    out[name] = { day: med(all), first: Math.min(...all), at30: mean(at30), level30: med(lv30) };
  }
  return out;
}

// ---------------------------------------------------------------- the purse along the way (0.8.17, the Mint's targets)
// A player who wins every level at the first try with two stars, `perDay` levels a day, online, and spends nothing.
// all: he also takes every free thing: each day's free-coins videos, the win page's video on every win (the Bonus chest
// when it is due, else Double coins, while the day's pot holds it), every video spin, and the Daily Vault (won) from
// its level. Without `all`: no video at all (the daily chest, the free spins, chests and treasures only).
// -> { [level]: coins held after it } for the levels in `at` (the mean over `seeds` draws of the wheel)
export function purse({ all = false, perDay = 6, seeds = 200, at = [5, 10, 12, 20, 30, LEVELS.length] } = {}) {
  const out = Object.fromEntries(at.map((l) => [l, 0]));
  for (let sd = 0; sd < seeds; sd++) {
    const R = rng(sd * 7919 + 17), save = { unlocked: 1, stars: {}, wallet: E.defaultWallet(), adDay: null, mint: null };
    let wins = 0, day = '';
    for (let i = 0; i < LEVELS.length; i++) {
      const L = LEVELS[i];
      if (i % perDay === 0) {
        day = dayKey(T0 + (i / perDay) * DAY);
        const w = E.openDailyChest(save.wallet, day); if (w) save.wallet = w;
        if (all) {
          for (let c = E.freeCoinsNext(save.adDay, day); c > 0; c = E.freeCoinsNext(save.adDay, day)) { save.wallet = E.addCoins(save.wallet, c); save.adDay = E.noteFreeCoins(save.adDay, day); }
          if (L.id > WORLD.dailyFrom) { const vc = E.levelCoins({ stars: 2, saved: 2, eggs: 3 }).total + MINT.FAUCETS.dailyVault.coins; save.wallet = E.payWin(save.wallet, vc + MINT.onlineBonus(vc), true).wallet; SP.noteWin(save, true); }
        }
      }
      const c = E.levelCoins({ stars: 2, saved: L.target || 1, eggs: 3, hard: HARD_IDS.includes(L.id) }).total, p = E.payWin(save.wallet, c + MINT.onlineBonus(c), true);
      save.wallet = p.wallet; save.stars[L.id] = 2; save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, L.id + 1)); wins++;
      SP.noteWin(save, true); SP.notePlayed(save, day);
      if (all && !DR.earlyDays(save)) {
        if (L.id >= 9 && wins % 3 === 0 && MINT.winVideoOk(save.mint, day, E.BONUS_CHEST.coins)) { save.wallet = E.openBonusChest(save.wallet, L.id); save.mint = MINT.winVideoTake(save.mint, day, E.BONUS_CHEST.coins); }
        else if (MINT.winVideoOk(save.mint, day, p.coins)) { save.wallet = E.addCoins(save.wallet, p.coins); save.mint = MINT.winVideoTake(save.mint, day, p.coins); }
      }
      if (E.bossTreasure(L.id)) save.wallet = E.openBossTreasure(save.wallet, L.id) || save.wallet;
      for (let ch = E.chestFor(totalStars(save), save.wallet.chests); ch && ch.ready; ch = E.chestFor(totalStars(save), save.wallet.chests)) save.wallet = E.openChest(save.wallet, ch);
      while (SP.ways(save, day).free) SP.spin(save, 'free', day, R);
      if (all) while (SP.ways(save, day).ad) SP.spin(save, 'ad', day, R);
      if (out[L.id] != null) out[L.id] += save.wallet.coins / seeds;
    }
  }
  for (const k of Object.keys(out)) out[k] = Math.round(out[k]);
  return out;
}

// ---------------------------------------------------------------- a crowd: every mix of traits, drawn at random
// Each trait is drawn on its own across the whole range, so mixes exist that no named kind covers. The report then
// works backwards: for each trait, what happened to the third of the crowd lowest in it against the third highest.
const RANGE = { easy: [0, 0.6], dare: [0, 0.8], skill: [0.25, 0.8], mins: [5, 35], sess: [1, 3], patience: [2, 8], quit: [0.05, 0.4], video: [0, 1], coin: [0, 0.8], boost: [0.1, 0.9], cosmetic: [0, 0.9], shop: [0, 0.7], wheel: [0, 0.5], pay: [0, 0], notif: [0.1, 0.8], tap: [0.05, 0.5], stars: [0, 0.4] };
export function crowd({ n = 2000, days = 30, seed = 1 } = {}) {
  const R = rng(seed * 7 + 99), people = [];
  for (let i = 0; i < n; i++) {
    const P = {}; for (const [k, [a, b]] of Object.entries(RANGE)) P[k] = k === 'sess' || k === 'patience' ? Math.round(a + R() * (b - a)) : a + R() * (b - a);
    P.days = [0.5 + R() * 0.45, 0.5 + R() * 0.45];
    P.pay = R() < 0.05 ? 0.2 + R() * 0.5 : 0; // about one in twenty would ever pay; the rest never do
    people.push({ P, S: life(P, seed * 50021 + i * 104729, days) });
  }
  const OUT = { 'left by day 7 %': (s) => (s.quitDay >= 0 && s.quitDay <= 7 ? 100 : 0), 'level on day 30': (s) => s.level, [`finished all ${LEVELS.length} %`]: (s) => (s.doneDay >= 0 ? 100 : 0), 'spent of earned %': (s) => (s.in ? (s.out * 100) / s.in : 0), 'boosters left unused': (s) => s.stock,
    'tries stuck, no help %': (s) => (s.tries ? (s.starved * 100) / s.tries : 0), 'videos a play day': (s) => (s.daysPlayed ? s.videos / s.daysPlayed : 0), 'offer cards a session': (s) => (s.sessions ? s.cards / s.sessions : 0), 'paid anything %': (s) => (Object.keys(s.buys).length ? 100 : 0), 'things to own bought': (s) => s.unlocks };
  const rows = {};
  for (const t of Object.keys(RANGE)) {
    const sorted = [...people].sort((a, b) => a.P[t] - b.P[t]), lo = sorted.slice(0, Math.floor(n / 3)), hi = sorted.slice(-Math.floor(n / 3));
    rows[t] = Object.fromEntries(Object.entries(OUT).map(([k, f]) => [k, [mean(lo.map((p) => f(p.S))), mean(hi.map((p) => f(p.S)))]]));
  }
  const all = Object.fromEntries(Object.entries(OUT).map(([k, f]) => [k, mean(people.map((p) => f(p.S)))]));
  return { n, all, rows, bad: people.flatMap((p) => p.S.bad), outs: Object.keys(OUT) };
}

// ---------------------------------------------------------------- random clickers: not people, a test of the rules
// Each does `steps` allowed things in any order: wins and losses, every way to buy, spend, spin and watch, leaving and
// coming back after minutes or days, the save written out and read back in between. After every step the rules that
// must always hold are checked. A line in the result is a way to break the game.
export function clickers({ n = 200, steps = 400, seed = 1 } = {}) {
  const bad = [], seenBad = new Set(), note = (m) => { if (!seenBad.has(m)) { seenBad.add(m); bad.push(m); } };
  let acts = 0;
  for (let i = 0; i < n; i++) {
    const R = rng(seed * 9973 + i * 31337), pick = (a) => a[Math.floor(R() * a.length)];
    let save = { unlocked: 1 + Math.floor(R() * 12), stars: {}, best: {}, wallet: { ...E.defaultWallet(), coins: Math.floor(R() * 900) }, daily: {}, adDay: null }, now = T0 + Math.floor(R() * 20) * HOUR, plan = null, allowed = false, coinsVideoToday = { day: '', n: 0 };
    for (let l = 1; l < save.unlocked; l++) save.stars[l] = 1 + Math.floor(R() * 3);
    ENG.boot(save); ENG.open(save, now, '');
    const day = () => dayKey(now), w = (x) => { if (x) save.wallet = x; return !!x; };
    const A = [
      () => { const id = 1 + Math.floor(R() * Math.min(LEVELS.length, save.unlocked)), won = R() < 0.55; ENG.levelStart(save, { levelId: id }, now); now += 30000 + R() * 90000;
        if (won) { w(E.payWin(save.wallet, E.levelCoins({ stars: 1 + Math.floor(R() * 3), saved: 2, eggs: 3, hard: HARD_IDS.includes(id) }).total, true).wallet); const old = save.stars[id] || 0, st = 1 + Math.floor(R() * 3); if (st > old) save.stars[id] = st; save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, id + 1)); SP.noteWin(save, st > old); }
        DR.noteResult(save, id, won, { saved: won ? 2 : 1 }); BR.note(save, 'level', {}, now); ENG.result(save, { id, won, secs: 40, near: !won && R() < 0.4 }, { videoShown: true, coinShown: R() < 0.5, price: 60, rewound: R() < 0.2, boosts: Math.floor(R() * 3) }, now);
        if (!won) SP.noteLoss(save, id, ((save.dir.att[id] || {}).streak) || 0, day()); SP.notePlayed(save, day()); },
      () => w(E.buy(save.wallet, pick(E.BOOSTER_ORDER))),
      () => w(E.useBooster(save.wallet, pick(E.BOOSTER_ORDER))),
      () => { const u = pick(E.unlockables(save.wallet)); if (u) w(u.kind === 'skin' ? E.buySkin(save.wallet, u.id) : u.kind === 'hen' ? E.buyHenSkin(save.wallet, u.id) : E.buyChick(save.wallet, u.id)); },
      () => w(E.buyKit(save.wallet, pick(E.KIT_ORDER))),
      () => w(E.buyItem(save.wallet, pick(E.ITEM_ORDER))),
      () => w(E.buyCharges(save.wallet, pick(E.CHARGE_PACKS))),
      () => w(E.useTicket(save.wallet, pick(['ally', 'skip']))),
      () => w(E.useCharge(save.wallet)),
      () => w(E.buyDeal(save.wallet, day())),
      () => w(E.claimSample(save.wallet, day())),
      () => w(E.openDailyChest(save.wallet, day())),
      () => { const ch = E.chestFor(totalStars(save), save.wallet.chests); if (ch && ch.ready) w(E.openChest(save.wallet, ch)); },
      () => { const b = pick(E.BOSS_TREASURE_IDS); if ((save.stars[b] || 0) > 0) w(E.openBossTreasure(save.wallet, b)); },
      () => { const b = save.spin && save.spin.miss >= SP.SPIN.missRow, r = SP.spin(save, pick(['free', 'ad', 'coin', 'retry']), day(), R); if (r && r.miss && b) note('the villains came three times in a row'); },
      () => { const c = E.freeCoinsNext(save.adDay, day()); if (c > 0) { w(E.addCoins(save.wallet, c)); save.adDay = E.noteFreeCoins(save.adDay, day()); OF.noteRewarded(save, now); ENG.video(save); if (coinsVideoToday.day !== day()) coinsVideoToday = { day: day(), n: 0 }; coinsVideoToday.n += c; } },
      () => { const o = OF.evaluate(save, pick(['home', 'win', 'fail', 'shop']), { now, money: true, levelId: save.unlocked, fails: Math.floor(R() * 5), prevFails: Math.floor(R() * 4), adReady: true }); if (o && o.sku && R() < 0.3) w(E.grantIap(save.wallet, o.sku, 't' + i + '-' + acts, now).wallet); else if (o) OF.markShown(save, o, now, save.unlocked); },
      () => { if (!allowed && ENG.herald.shouldAsk(save, { unlocked: save.unlocked, stars: 3, spins: SP.banked(save), spinLeft: SP.left(save) })) { allowed = R() < 0.7; ENG.herald.answer(save, allowed, now); } },
      () => { ENG.herald.setOff(save, R() < 0.5); },
      () => { // leaves, and comes back after minutes, hours or days (now and then from a reminder); the save goes through the disk
        plan = ENG.close(save, { spins: SP.banked(save), spinLeft: SP.left(save), starsToChest: Math.floor(R() * 3), daily: true, unlocked: save.unlocked, screen: 'levels' }, now);
        if (plan) { const H = HE.herState(save); if (H.ok !== 1 || H.off) note('a reminder planned without permission or while switched off'); const ats = [plan.at, ...(plan.more || []).map((m) => m.at)];
          if (plan.at - now < HE.HERALD.minAheadH * HOUR) note('a reminder sooner than ' + HE.HERALD.minAheadH + ' h after leaving');
          for (let k = 0; k < ats.length; k++) { const hr = new Date(ats[k]).getHours(); if (hr >= HE.HERALD.quietFrom || hr < HE.HERALD.quietTo) note('a reminder in the quiet hours'); if (k && dayKey(ats[k]) === dayKey(ats[k - 1])) note('two reminders on one day'); } }
        now += pick([60000, 20 * 60000, 3 * HOUR, 26 * HOUR, 4 * DAY, 12 * DAY]);
        const text = JSON.stringify(save); if (/NaN|Infinity|undefined/.test(text.replace(/"[^"]*"/g, ''))) note('the save holds a number that cannot be written');
        save = JSON.parse(text); ENG.boot(save); ENG.open(save, now, plan && now >= plan.at && R() < 0.4 ? plan.id : ''); },
    ];
    for (let k = 0; k < steps; k++) {
      acts++;
      try { pick(A)(); ENG.sync(save, pick(['win', 'shop', 'spin', 'gift', 'other']), day(), now); } catch (e) { note('a rule threw: ' + String((e && e.message) || e).slice(0, 80)); }
      now += Math.floor(R() * 60000);
      const W = save.wallet, sp = save.spin;
      if (!Number.isInteger(W.coins) || W.coins < 0) note('the purse is not a whole number at or above zero: ' + W.coins);
      for (const [b, c] of Object.entries(W.owned || {})) if (!Number.isInteger(c) || c < 0 || c > E.MAX_OWNED) note(`${c} of booster ${b}`);
      if ((W.charges || 0) > E.MAX_CHARGES || (W.charges || 0) < 0) note('charges outside 0..' + E.MAX_CHARGES);
      if (E.couponHeld(W) > E.COUPON.max) note('more than one half-price ticket');
      if (sp && (sp.bank > SP.SPIN.bankMax || sp.bank < 0 || sp.wins >= SP.SPIN.every)) note('the spin bank or meter is out of range');
      if (sp && sp.t && (sp.t.ad > SP.SPIN.adPerDay || sp.t.coin > SP.SPIN.coin.length)) note('more video or coin spins in a day than allowed');
      if (coinsVideoToday.n > E.AD_REWARDS.freeCoins.ladder.reduce((a, b) => a + b, 0)) note('more free-coins video coins in a day than the ladder holds');
      if (/DOWN/.test(ENG.HUB.healthLine())) note('a subsystem went down: ' + ENG.HUB.healthLine());
      const P = ENG.predict(save, { levelId: save.unlocked, now }); if (!P || ['win', 'back', 'video', 'coins', 'pay'].some((q) => !(P[q].p >= 0.02 && P[q].p <= 0.98))) note('a prediction outside 2..98%');
    }
  }
  return { n, steps, acts, bad };
}

// what the numbers say, in words: each line is a thing to look at, not a verdict on real players
export function findings(T) {
  const out = [], say = (who, m) => out.push(`${who}: ${m}`);
  for (const [who, r] of Object.entries(T)) {
    if (r.bad.length) say(who, `RULE BROKEN ${r.bad.length} times, first: ${r.bad[0]}`);
    if (r.sink < 0.2) say(who, `spends only ${Math.round(r.sink * 100)}% of the coins earned (purse at the end ${r.purse}): coins pile up with nothing he wants`);
    if (r.starved > 5) say(who, `${r.starved.toFixed(1)}% of his tries are on a level that beat him three times, with no booster, no free help and no streak`);
    if (r.stock > 12) say(who, `ends with ${r.stock.toFixed(1)} boosters unused: gifts arrive faster than he uses them`);
    if (r.used < 1 && r.gifts > 5) say(who, `was given ${r.gifts.toFixed(1)} boosters and used ${r.used.toFixed(1)}`);
    if (r.asksPerSession > 0.4) say(who, `a paid offer card in ${Math.round(r.asksPerSession * 100)}% of sessions (${r.askTop})`);
    if (r.videosDay > 10) say(who, `${r.videosDay.toFixed(1)} videos on a day he plays: more than a person sits through`);
    if (r.finished > 40) say(who, `${r.finished}% finish all ${LEVELS.length} levels inside the month, and then ${Math.round(r.idle * 100)}% of their days bring nothing new`);
    if (r.asked < 40 && r.d7 > 30) say(who, `only ${r.asked}% are ever asked about reminders`);
    for (const k of ['win', 'back', 'video', 'coins']) { const o = r.oracle[k]; if (o.graded >= 30 && o.fit > o.rules + 0.01) say(who, `the Oracle's learned "${k}" guess is worse than its rules (${o.fit.toFixed(3)} against ${o.rules.toFixed(3)}); it stays unused, as designed`); }
    if (r.oracle.back.graded < 15) say(who, `"comes back" is graded ${OR.LEARN.min} times for only ${r.oracle.back.graded}%: most leave before the phone can learn it`);
  }
  return out;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (isMain) {
  const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; }, has = (k) => process.argv.includes('--' + k);
  const n = Number(arg('n', 300)), days = Number(arg('days', 30)), seed = Number(arg('seed', 1)), only = arg('only', null);
  const out = [], say = (l = '') => { out.push(l); };
  // --herald <file>: another Herald (a module with the same exports) for a before/after comparison; --before: its ask rule (once, on a good win)
  const alt = arg('herald', null);
  if (alt) { const H2 = await import(new URL(alt, 'file://' + process.cwd() + '/').href); ENG.HUB.add('herald', { plan: H2.plan, opened: H2.opened, shouldAsk: H2.shouldAsk, answer: H2.answer, setOff: H2.setOff, line: H2.line, state: (sv) => { const H = H2.herState(sv); return { ok: H.ok, off: H.off, ignored: H.ignored }; } }); }
  if (has('compare')) { // the Pacer, before and after (0.8.17): the same people, the same seeds, the rules without it and with it
    const t1 = Date.now(), B0 = town({ n, days, seed, only, pacer: false }), A1 = town({ n, days, seed, only, pacer: true }), ks = Object.keys(A1);
    const line = (label, f) => console.log(label.padEnd(30) + ks.map((k) => `${f(B0[k])} > ${f(A1[k])}`.padStart(15)).join(''));
    console.log(`THE PACER, BEFORE > AFTER: ${n} of each kind, ${days} days, seed ${seed}\n` + ''.padEnd(30) + ks.map((k) => k.padStart(15)).join(''));
    line('tries stuck with no help %', (r) => r.starved.toFixed(1));
    line('worst losing run (median)', (r) => r.stuckMax);
    line('* left after a losing run %', (r) => r.leftOnLoss);
    line('* playing on day 30 %', (r) => r.d30);
    line(`finished all ${LEVELS.length} % (day)`, (r) => `${r.finished}${r.finished ? '(' + r.doneDays + ')' : ''}`);
    line('level on day 30 (median)', (r) => r.level30);
    line('stars won on Easy', (r) => r.easyStars.toFixed(1));
    line('coins in', (r) => Math.round(r.coinsIn));
    line('skip pop-ups / skipped there', (r) => `${r.popups.toFixed(1)}/${r.popSkips.toFixed(1)}`);
    line('free hints', (r) => r.hints.toFixed(1));
    line('dares offered/taken/met', (r) => `${r.dares.toFixed(0)}/${r.daresTook.toFixed(0)}/${r.daresMet.toFixed(0)}`);
    line('coins from dares', (r) => Math.round(r.dareCoins));
    line('videos a play day', (r) => r.videosDay.toFixed(1));
    console.log(`(${((Date.now() - t1) / 1000).toFixed(0)} s)`);
    const broken = ks.reduce((a, k) => a + A1[k].bad.length + B0[k].bad.length, 0);
    if (broken) console.log('RULES BROKEN: ' + ks.flatMap((k) => A1[k].bad).slice(0, 3).join('; '));
    process.exit(broken ? 1 : 0);
  }
  const t0 = Date.now(), T = town({ n, days, seed, only, opt: { before: has('before') } });
  if (has('json')) { console.log(JSON.stringify(T, null, 1)); process.exit(0); }
  const names = Object.keys(T), col = (v) => String(v).padStart(13), row = (label, f) => say(label.padEnd(32) + names.map((k) => col(f(T[k]))).join(''));
  const real = Object.values(REAL).filter((r) => r[0] >= WORLD.realMin).length;
  say(`EIGHT KINDS OF PLAYERS: ${n} of each, ${days} days, seed ${seed}. Difficulty: ${real ? `${real} levels from real logs, the rest guessed` : 'guessed (no real logs yet)'}.`);
  say('Rows marked * follow from what was assumed about people; the others from the game\'s own rules.\n');
  say(''.padEnd(32) + names.map(col).join(''));
  row('* playing on day 1 / 7 / 30 %', (r) => `${r.d1}/${r.d7}/${r.d30}`);
  row('* most left at', (r) => (r.quitTop.split(',')[0] || '-'));
  row('level reached day 7 / 30', (r) => `${r.level7}/${r.level30}`);
  row(`finished all ${LEVELS.length} %`, (r) => r.finished);
  row('tries, win rate', (r) => `${Math.round(r.tries)}, ${Math.round(r.winRate * 100)}%`);
  row('worst losing run (median)', (r) => r.stuckMax);
  row('tries stuck with no help %', (r) => r.starved.toFixed(1));
  row('free help from the Director', (r) => r.freeHelp.toFixed(1));
  say('-- coins');
  row('coins in / out', (r) => `${Math.round(r.coinsIn)}/${Math.round(r.coinsOut)}`);
  row('spent of earned %', (r) => Math.round(r.sink * 100));
  row('purse at the end (median)', (r) => r.purse);
  row('boosters given/bought/used', (r) => `${r.gifts.toFixed(0)}/${r.bought.toFixed(0)}/${r.used.toFixed(0)}`);
  row('boosters left unused', (r) => r.stock.toFixed(1));
  row('things to own bought', (r) => r.unlocks.toFixed(1));
  row('world gates bought (coins)', (r) => `${r.gates.toFixed(1)} (${Math.round(r.gateCoins)})`);
  row('tries turned back by a gate', (r) => r.gatedBy.toFixed(1));
  row('wins with no new star (40%)', (r) => r.replays.toFixed(1));
  row('videos+spins+gifts a day, most', (r) => `${r.dayMed}/${r.dayMax}`);
  row('spins free / video / coins', (r) => `${r.spinsFree.toFixed(0)}/${r.spinsAd.toFixed(0)}/${r.spinsCoin.toFixed(0)}`);
  row('villain rows / tried again', (r) => `${r.spinsMiss.toFixed(1)}/${r.spinsRetry.toFixed(1)}`);
  say('-- videos and money');
  row('videos in all / a play day', (r) => `${r.videos.toFixed(0)} / ${r.videosDay.toFixed(1)}`);
  row('offer cards, most in a session', (r) => `${r.cards.toFixed(1)}, ${r.cardsMax}`);
  row('paid offers a session', (r) => r.asksPerSession.toFixed(2));
  row('* paid anything / Unlock Ev. %', (r) => `${r.paid} / ${r.premium}`);
  row('* dollars a player in 30 days', (r) => r.usd.toFixed(2));
  say('-- reminders');
  row('asked % (on day), cards a player', (r) => `${r.asked} (${r.askedDay}) ${r.remAsks.toFixed(1)}`);
  row('* allowed %', (r) => r.allowed);
  row('notes shown / opened from', (r) => `${r.notes.toFixed(1)} / ${r.tapped.toFixed(1)}`);
  row('* days a note brought him in', (r) => r.pulled.toFixed(1));
  row('* back after stopping, by a note %', (r) => r.lapsedBack);
  row('notes after he left for good', (r) => r.notesGone.toFixed(1));
  say('-- the Oracle on the phone: graded 8+ times % | error by rules > learned | learned in use % | trusted %');
  for (const k of ['win', 'back', 'video', 'coins']) row('  ' + k, (r) => { const o = r.oracle[k]; return `${o.graded}|${o.graded ? o.rules.toFixed(2) + '>' + o.fit.toFixed(2) : '-'}|${o.learned}|${o.trusted}`; });
  let OW = null;
  if (!has('quick')) {
    OW = owning({ n: Number(arg('own', 40)), days: 90, seed, only });
    say(`-- owning everything (${Math.round(CATALOGUE)} coins of things to own; never leaving, never paying, buying all he can after every session)`);
    say('all owned on day (first)'.padEnd(32) + names.map((k) => col(OW[k] ? `${OW[k].day > 90 ? '>90' : OW[k].day} (${OW[k].first > 90 ? '-' : OW[k].first})` : '-')).join(''));
    say('owned on day 30 %'.padEnd(32) + names.map((k) => col(OW[k] ? Math.round(OW[k].at30 * 100) : '-')).join(''));
  }
  const F = findings(T);
  say('\nWhat stands out:'); for (const f of F.length ? F : ['nothing']) say('  - ' + f);
  let C = null, K = null;
  if (!only && !has('quick')) {
    C = crowd({ n: Number(arg('crowd', 2000)), days, seed });
    say(`\nA CROWD: ${C.n} players, every trait drawn at random. For each trait: the lowest third against the highest third.`);
    say('Only pairs that differ clearly are listed (a fifth or more).');
    for (const [t, r] of Object.entries(C.rows)) { const d = Object.entries(r).filter(([, [a, b]]) => Math.abs(a - b) >= Math.max(0.5, 0.2 * Math.max(Math.abs(a), Math.abs(b)))); if (d.length) say(`  ${t.padEnd(9)} ${d.map(([k, [a, b]]) => `${k} ${a.toFixed(a < 10 ? 1 : 0)} > ${b.toFixed(b < 10 ? 1 : 0)}`).join(' | ')}`); }
    say('  the whole crowd: ' + Object.entries(C.all).map(([k, v]) => `${k} ${v.toFixed(v < 10 ? 1 : 0)}`).join(' | '));
    K = clickers({ n: Number(arg('clickers', 200)), steps: 400, seed });
    say(`\nRANDOM CLICKERS: ${K.n} of them, ${K.acts} things done in any order. Rules broken: ${K.bad.length ? '' : 'none'}`); for (const b of K.bad) say('  - ' + b);
  }
  say(`\n(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  console.log(out.join('\n'));
  const broken = names.reduce((a, k) => a + T[k].bad.length, 0) + (C ? C.bad.length : 0) + (K ? K.bad.length : 0);
  if (has('save')) { // the record: the last report, and one line of key numbers for the history
    if (!existsSync(HOME)) mkdirSync(HOME, { recursive: true });
    let commit = ''; try { commit = execSync('git rev-parse --short HEAD', { cwd: HOME, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (_) { /* no git */ }
    const day = new Date().toISOString().slice(0, 10), note = arg('note', '');
    writeFileSync(join(HOME, 'latest.txt'), `${day} at ${commit || '?'}${note ? ' (' + note + ')' : ''}\n\n` + out.join('\n') + '\n');
    const key = (r, k) => ({ ownDay: OW && OW[k] ? OW[k].day : null, own30: OW && OW[k] ? Math.round(OW[k].at30 * 100) : null, gates: +r.gates.toFixed(1), d7: r.d7, lv7: r.level7, done: r.finished, sink: Math.round(r.sink * 100), stock: +r.stock.toFixed(1), stuck: +r.starved.toFixed(1), vid: +r.videosDay.toFixed(1), cards: +r.asksPerSession.toFixed(2), own: +r.unlocks.toFixed(1), notes: +r.notes.toFixed(1) });
    appendFileSync(join(HOME, 'history.jsonl'), JSON.stringify({ day, commit, note, n, days, seed, real, broken, kinds: Object.fromEntries(names.map((k) => [k, key(T[k], k)])), crowd: C ? Object.fromEntries(Object.entries(C.all).map(([k, v]) => [k, +v.toFixed(1)])) : null }) + '\n');
    console.log(`\nsaved: players/latest.txt, and one line added to players/history.jsonl`);
  }
  process.exit(broken ? 1 : 0);
}
