// The Lucky Spin (0.8.15, mykee: "a celebration wheel ... the user pushes the lever ... a reward, or try again by
// watching an ad"). Pure rules, on the phone only. node tools/test-spin.mjs
//
// Honest by design (the owner's guardrails, and Google Play's rule for random items that can be bought):
//   - every spin wins something; there is no losing slice and no staged near miss;
//   - the odds are fixed, the same for every player, and shown: TABLE's weights ARE the wheel's slice sizes and the
//     numbers behind the info button (odds());
//   - a roll is one uniform draw over the weights; nothing about the player (purse, spend, mood) changes it;
//   - no timer anywhere: a spin never expires.
//
// How spins are earned: by progress only (mykee: "as the user keeps progressing levels one by one it should be like an
// unlockable", and a wheel that hands out gifts every day would give the shop away). One spin for every SPIN.every
// FRESH wins: a level passed for the first time, or with more stars than before, or the day's Daily Vault. Replaying
// an old level for the same stars moves nothing. The meter on the map and the win card counts down ("2 more levels to
// your spin"). Never before level SPIN.from is won. Spins wait in the bank (at most SPIN.bankMax). With no spin banked, the wheel offers a spin by a chosen video (SPIN.adPerDay a day) and a
// spin for coins at a price that climbs through the day (SPIN.coin: three a day at most, so nobody can pour a purse
// into it), the odds beside the price.
//
// The engine around it (mykee: "the reward should also depend on how much time the user spends on the game, level and
// a lot of other factors"). What it may change, the same for every player at the same point of the game:
//   - how fast spins come: fresh wins, and time in the game (every SPIN.playEvery levels PLAYED in a day, won or lost,
//     is one more step, at most SPIN.playMax a day), so a stuck player still gets there;
//   - how big the prizes are: tier(save) grows with the world reached and multiplies the coin slices (the wheel shows
//     the real amounts);
//   - when the wheel is shown (main.js asks brain.gate).
// What it may never change: the odds. Not by purse, spend, mood or anything else about the player.
//
//   - a cheer-up spin (mykee: "when the user feels down and cannot win a level and tried at least three times, we could
//     show it so that they feel great"): the third loss in a row on a level banks one free spin, once per level, at
//     most SPIN.cheerMax a day. A gift, not a sale: nothing is asked for it.
//
// save.spin = { wins, bank, t: { day, ad, coin, played, steps, cheer }, n, cheered: [levelId, ...] }   (state() makes any save safe)
import { BOOSTERS, BOOSTER_ORDER, HEN_SKINS, HEN_SKIN_ORDER, CHICK_IDS, CHICK_PRICES, ITEMS, CHARGE_ITEM, GIFT_MAX, MAX_CHARGES, MAX_TICKETS, COUPON, couponHeld, unlockables, giftBooster, sanitizeWallet, ownedCount, ownsHenSkin, ownsChick } from './economy.js';

export const SPIN = { every: 3, from: 3, bankMax: 3, adPerDay: 3, coin: [80, 110, 150], rareCoins: 300, playEvery: 4, playMax: 2, tierAt: [11, 26, 41], tierX: [1, 1.5, 2, 2.5], cheerAt: 3, cheerMax: 2 };

// The wheel, clockwise from the top. w = weight = slice size = odds in percent (they add up to 100).
export const TABLE = [
  { id: 'c1', kind: 'coins', n: 15, w: 22 },
  { id: 'b1', kind: 'booster', n: 1, w: 17 },
  { id: 'cp', kind: 'coupon', n: 1, w: 8 }, // 0.8.15: a half-price ticket for one thing to own (economy.js COUPON)
  { id: 'c2', kind: 'coins', n: 30, w: 16 },
  { id: 'ch', kind: 'charge', n: 1, w: 12 },
  { id: 'sh', kind: 'scare', n: 1, w: 6 }, // 0.8.15: a Scarecrow (villains keep away at the start of one level)
  { id: 'b2', kind: 'booster', n: 2, w: 7 },
  { id: 'c3', kind: 'coins', n: 80, w: 5 },
  { id: 'sk', kind: 'skip', n: 1, w: 4 },
  { id: 'rare', kind: 'rare', n: 1, w: 3 },
];
const TOTAL = TABLE.reduce((a, s) => a + s.w, 0);
// the odds as shown to the player: [{ id, kind, n, pct }]
export const odds = () => TABLE.map((s) => ({ id: s.id, kind: s.kind, n: s.n, pct: (s.w * 100) / TOTAL }));
// the wheel as drawn for this save: [{ id, kind, n (coins already x tier), pct }]
export const wheel = (save) => odds().map((o) => (o.kind === 'coins' ? { ...o, n: Math.round((o.n * coinX(save)) / 5) * 5 } : o));
// each slice's arc on the wheel as fractions of a turn, clockwise from the top: [{ id, a0, a1 }]
export function slices() { let a = 0; return TABLE.map((s) => { const a0 = a; a += s.w / TOTAL; return { id: s.id, a0, a1: a }; }); }

const int = (v, hi) => Math.max(0, Math.min(hi, Math.floor(Number(v) || 0)));
export function state(save) {
  const s = save.spin && typeof save.spin === 'object' ? save.spin : {};
  const v = s.t && typeof s.t === 'object' ? s.t : {};
  return (save.spin = { wins: int(s.wins, SPIN.every - 1), bank: int(s.bank, SPIN.bankMax), t: { day: typeof v.day === 'string' ? v.day : '', ad: int(v.ad, 99), coin: int(v.coin, 99), played: int(v.played, 999), steps: int(v.steps, 99), cheer: int(v.cheer, 99) }, n: int(s.n, 1e9), cheered: Array.isArray(s.cheered) ? s.cheered.filter((x) => Number.isFinite(x)).slice(-80) : [] });
}
// the wheel exists for this player (nothing is offered in the first levels)
export const open = (save) => (save.unlocked || 1) > SPIN.from;
export const banked = (save) => (open(save) ? state(save).bank : 0);
// levels still to win for the next spin (the meter): 1..SPIN.every
export const left = (save) => SPIN.every - state(save).wins;
export const meter = (save) => ({ have: state(save).wins, of: SPIN.every, left: left(save), bank: banked(save) });

// the wheel's size: 0..3 by the level reached (worlds 3, 6 and 9 open the next one). Coins on the wheel are x tierX.
export const tier = (save) => SPIN.tierAt.filter((lv) => (save.unlocked || 1) >= lv).length;
export const coinX = (save) => SPIN.tierX[tier(save)];
const step = (S) => { S.wins++; if (S.wins < SPIN.every) return false; S.wins = 0; if (S.bank < SPIN.bankMax) S.bank++; return true; };
// a level was played to its end, won or lost (the caller leaves out runs given up in the first seconds): time in the
// game. Every SPIN.playEvery of them in a day is one step on the meter, at most SPIN.playMax steps a day.
export function notePlayed(save, dayStr) {
  if (!open(save)) return false;
  const S = today(save, dayStr);
  S.t.played++;
  if (S.t.played % SPIN.playEvery || S.t.steps >= SPIN.playMax) return false;
  S.t.steps++;
  return step(S);
}
// a level was lost. failsInRow: losses in a row on this level, this one included (director.js keeps it). The third
// banks a cheer-up spin: once per level, at most SPIN.cheerMax a day, never over the bank's size. true when given now.
export function noteLoss(save, levelId, failsInRow, dayStr) {
  if (!open(save) || !(levelId > 0) || failsInRow < SPIN.cheerAt) return false;
  const S = today(save, dayStr);
  if (S.cheered.includes(levelId) || S.t.cheer >= SPIN.cheerMax || S.bank >= SPIN.bankMax) return false;
  S.cheered = [...S.cheered, levelId].slice(-80); S.t.cheer++; S.bank++;
  return true;
}
// a level was won. fresh: first time passed, or more stars than before, or today's Daily Vault (the caller knows).
// The meter moves only on a fresh win; returns true when this win earned a spin.
export function noteWin(save, fresh = true) {
  if (!open(save) || !fresh) return false;
  return step(state(save));
}
// ---- the ways to spin right now (dayStr: the game's own day key; the video and coin counts start again each day).
// free: a banked spin. ad: a chosen video, only with nothing banked. coin: the price of the next coin spin today
// (null once today's ladder is used up, or while a free spin waits).
function today(save, dayStr) { const S = state(save); if (dayStr && S.t.day !== dayStr) S.t = { day: dayStr, ad: 0, coin: 0, played: 0, steps: 0, cheer: 0 }; return S; }
export function ways(save, dayStr) {
  const S = today(save, dayStr), on = open(save);
  const coin = S.t.coin < SPIN.coin.length ? Math.round((SPIN.coin[S.t.coin] * coinX(save)) / 10) * 10 : null; // the price grows with the wheel
  return { free: on && S.bank > 0, ad: on && !S.bank && S.t.ad < SPIN.adPerDay, coin: on && !S.bank ? coin : null, adLeft: Math.max(0, SPIN.adPerDay - S.t.ad) };
}

// one uniform draw over the weights: rand() in [0, 1). Returns the slice.
export function roll(rand = Math.random) {
  let x = Math.min(0.999999, Math.max(0, rand())) * TOTAL;
  for (const s of TABLE) { if (x < s.w) return s; x -= s.w; }
  return TABLE[TABLE.length - 1];
}
// what a slice turns into for this wallet (which booster, which rare bird). rand picks among equals.
// -> { id, kind, n, item?, name, worth }   kind: coins | booster | charge | skip | hen | chick
export function prizeFor(slice, wallet, rand = Math.random, x = 1) {
  const pick = (list) => list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
  if (slice.kind === 'coins') { const n = Math.round((slice.n * x) / 5) * 5; return { id: slice.id, kind: 'coins', n, name: `${n} coins`, worth: n }; }
  if (slice.kind === 'charge') return { id: slice.id, kind: 'charge', n: slice.n, name: CHARGE_ITEM.name, worth: CHARGE_ITEM.price * slice.n };
  if (slice.kind === 'skip') return { id: slice.id, kind: 'skip', n: 1, name: ITEMS.skip.name, worth: ITEMS.skip.price };
  if (slice.kind === 'booster') { // any booster but the Scarecrow (it has its own slice), one with room in the bag first
    const all = BOOSTER_ORDER.filter((b) => b !== 'scare'), room = all.filter((b) => ownedCount(wallet, b) + slice.n <= GIFT_MAX), b = pick(room.length ? room : all);
    return { id: slice.id, kind: 'booster', n: slice.n, item: b, name: BOOSTERS[b].name, worth: BOOSTERS[b].price * slice.n };
  }
  if (slice.kind === 'scare') return { id: slice.id, kind: 'booster', n: slice.n, item: 'scare', name: BOOSTERS.scare.name, worth: BOOSTERS.scare.price * slice.n };
  if (slice.kind === 'coupon') { // a ticket already held, or nothing left to use one on: coins instead (said on the odds sheet)
    const U = unlockables(wallet);
    if (couponHeld(wallet) || !U.length) { const n = Math.round((COUPON.coins * x) / 5) * 5; return { id: slice.id, kind: 'coins', n, name: `${n} coins`, worth: n, instead: 'coupon' }; }
    return { id: slice.id, kind: 'coupon', n: 1, name: 'Half-price ticket', worth: Math.round(U.reduce((a, u) => a + u.price, 0) / U.length * COUPON.off) };
  }
  // the rare bird: a hen outfit or a power chick the player does not own (never a real-money one); none left: coins
  const hens = HEN_SKIN_ORDER.filter((h) => !HEN_SKINS[h].premium && HEN_SKINS[h].price > 0 && !ownsHenSkin(wallet, h));
  const chicks = CHICK_IDS.filter((c) => !ownsChick(wallet, c));
  const pool = [...hens.map((h) => ({ kind: 'hen', item: h, name: HEN_SKINS[h].name, worth: HEN_SKINS[h].price })), ...chicks.map((c) => ({ kind: 'chick', item: c, name: c, worth: CHICK_PRICES[c] }))];
  if (!pool.length) return { id: slice.id, kind: 'coins', n: SPIN.rareCoins, name: `${SPIN.rareCoins} coins`, worth: SPIN.rareCoins, rare: true };
  return { id: slice.id, n: 1, rare: true, ...pick(pool) };
}
// put a prize into a wallet (a full stack pays its coin price instead, so a spin is never empty)
export function grant(wallet, P) {
  const w = sanitizeWallet(wallet);
  if (P.kind === 'coins') w.coins += P.n;
  else if (P.kind === 'booster') return giftBooster(w, P.item, P.n); // a full stack pays half the price in coins, so a spin is never empty
  else if (P.kind === 'coupon') w.coupon = 1;
  else if (P.kind === 'charge') { const n = Math.min(P.n, MAX_CHARGES - w.charges); w.charges += n; w.coins += (P.n - n) * CHARGE_ITEM.price; }
  else if (P.kind === 'skip') { if (w.tickets.skip < MAX_TICKETS) w.tickets = { ...w.tickets, skip: w.tickets.skip + 1 }; else w.coins += ITEMS.skip.price; }
  else if (P.kind === 'hen') { if (!ownsHenSkin(w, P.item)) w.henSkins = [...w.henSkins, P.item]; else w.coins += P.worth; }
  else if (P.kind === 'chick') { if (!ownsChick(w, P.item)) w.chicks = [...w.chicks, P.item]; else w.coins += P.worth; }
  return w;
}

// ---- spin once. how: 'free' | 'ad' | 'coin'. (For 'ad' the caller has already shown the chosen video.)
// -> null when that way is not open, else { prize, slice, how, paid } with save.wallet and save.spin updated.
export function spin(save, how, dayStr, rand = Math.random) {
  const W = ways(save, dayStr), S = state(save);
  let paid = 0;
  if (how === 'free') { if (!W.free) return null; S.bank--; }
  else if (how === 'ad') { if (!W.ad) return null; S.t.ad++; }
  else if (how === 'coin') {
    if (W.coin == null || sanitizeWallet(save.wallet).coins < W.coin) return null;
    paid = W.coin; save.wallet = sanitizeWallet(save.wallet); save.wallet.coins -= paid; S.t.coin++;
  } else return null;
  const slice = roll(rand), prize = prizeFor(slice, save.wallet, rand, coinX(save));
  save.wallet = grant(save.wallet, prize);
  S.n++;
  return { prize, slice, how, paid };
}
// the mean worth of one spin in coins (boosters at shop price, the rare bird at the mean of what is left): the test
// holds it under the first coin price, so a coin spin is a sink on average
export function meanWorth(wallet, x = 1) {
  let v = 0;
  for (const s of TABLE) {
    if (s.kind === 'booster') { const all = BOOSTER_ORDER.filter((b) => b !== 'scare'); v += (s.w / TOTAL) * s.n * (all.reduce((a, b) => a + BOOSTERS[b].price, 0) / all.length); }
    else if (s.kind === 'rare') {
      const hens = HEN_SKIN_ORDER.filter((h) => !HEN_SKINS[h].premium && HEN_SKINS[h].price > 0 && !ownsHenSkin(wallet, h)).map((h) => HEN_SKINS[h].price), ch = CHICK_IDS.filter((c) => !ownsChick(wallet, c)).map((c) => CHICK_PRICES[c]), all = [...hens, ...ch];
      v += (s.w / TOTAL) * (all.length ? all.reduce((a, b) => a + b, 0) / all.length : SPIN.rareCoins);
    } else v += (s.w / TOTAL) * prizeFor(s, wallet, () => 0, x).worth;
  }
  return v;
}
