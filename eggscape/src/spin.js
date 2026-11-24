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
// How spins are earned: one for every SPIN.every journey levels won (the meter on the map and the win card:
// "2 more levels to your spin"), one free each day, never before level SPIN.from is won. Spins wait in the bank
// (at most SPIN.bankMax). With no spin banked, the wheel offers a spin by a chosen video (SPIN.adPerDay a day) and a
// spin for coins at a price that climbs through the day (SPIN.coin: three a day at most, so nobody can pour a purse
// into it), the odds beside the price.
//
// save.spin = { wins, bank, day, t: { day, ad, coin }, n }   (state() makes any save safe)
import { BOOSTERS, BOOSTER_ORDER, HEN_SKINS, HEN_SKIN_ORDER, CHICK_IDS, CHICK_PRICES, ITEMS, CHARGE_ITEM, MAX_OWNED, MAX_CHARGES, MAX_TICKETS, sanitizeWallet, ownedCount, ownsHenSkin, ownsChick } from './economy.js';

export const SPIN = { every: 3, from: 3, bankMax: 3, adPerDay: 3, coin: [70, 100, 140], rareCoins: 300 };

// The wheel, clockwise from the top. w = weight = slice size = odds in percent (they add up to 100).
export const TABLE = [
  { id: 'c1', kind: 'coins', n: 15, w: 24 },
  { id: 'b1', kind: 'booster', n: 1, w: 20 },
  { id: 'c2', kind: 'coins', n: 30, w: 18 },
  { id: 'ch', kind: 'charge', n: 1, w: 14 },
  { id: 'b2', kind: 'booster', n: 2, w: 8 },
  { id: 'c3', kind: 'coins', n: 80, w: 7 },
  { id: 'sk', kind: 'skip', n: 1, w: 6 },
  { id: 'rare', kind: 'rare', n: 1, w: 3 },
];
const TOTAL = TABLE.reduce((a, s) => a + s.w, 0);
// the odds as shown to the player: [{ id, kind, n, pct }]
export const odds = () => TABLE.map((s) => ({ id: s.id, kind: s.kind, n: s.n, pct: (s.w * 100) / TOTAL }));
// each slice's arc on the wheel as fractions of a turn, clockwise from the top: [{ id, a0, a1 }]
export function slices() { let a = 0; return TABLE.map((s) => { const a0 = a; a += s.w / TOTAL; return { id: s.id, a0, a1: a }; }); }

const int = (v, hi) => Math.max(0, Math.min(hi, Math.floor(Number(v) || 0)));
export function state(save) {
  const s = save.spin && typeof save.spin === 'object' ? save.spin : {};
  const v = s.t && typeof s.t === 'object' ? s.t : {};
  return (save.spin = { wins: int(s.wins, SPIN.every - 1), bank: int(s.bank, SPIN.bankMax), day: typeof s.day === 'string' ? s.day : '', t: { day: typeof v.day === 'string' ? v.day : '', ad: int(v.ad, 99), coin: int(v.coin, 99) }, n: int(s.n, 1e9) });
}
// the wheel exists for this player (nothing is offered in the first levels)
export const open = (save) => (save.unlocked || 1) > SPIN.from;
export const banked = (save) => (open(save) ? state(save).bank : 0);
// levels still to win for the next spin (the meter): 1..SPIN.every
export const left = (save) => SPIN.every - state(save).wins;
export const meter = (save) => ({ have: state(save).wins, of: SPIN.every, left: left(save), bank: banked(save) });

// a journey level was won: the meter moves; returns true when this win earned a spin
export function noteWin(save) {
  if (!open(save)) return false;
  const S = state(save);
  S.wins++;
  if (S.wins < SPIN.every) return false;
  S.wins = 0;
  if (S.bank < SPIN.bankMax) S.bank++;
  return true;
}
// the day's free spin (dayStr: the game's own day key); true when it was given now
export function daily(save, dayStr) {
  if (!open(save)) return false;
  const S = state(save);
  if (!dayStr || S.day === dayStr) return false;
  S.day = dayStr;
  if (S.bank < SPIN.bankMax) S.bank++;
  return true;
}

// ---- the ways to spin right now (dayStr: the game's own day key; the video and coin counts start again each day).
// free: a banked spin. ad: a chosen video, only with nothing banked. coin: the price of the next coin spin today
// (null once today's ladder is used up, or while a free spin waits).
const today = (save, dayStr) => { const S = state(save); if (dayStr && S.t.day !== dayStr) S.t = { day: dayStr, ad: 0, coin: 0 }; return S; };
export function ways(save, dayStr) {
  const S = today(save, dayStr), on = open(save);
  const coin = S.t.coin < SPIN.coin.length ? SPIN.coin[S.t.coin] : null;
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
export function prizeFor(slice, wallet, rand = Math.random) {
  const pick = (list) => list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
  if (slice.kind === 'coins') return { id: slice.id, kind: 'coins', n: slice.n, name: `${slice.n} coins`, worth: slice.n };
  if (slice.kind === 'charge') return { id: slice.id, kind: 'charge', n: slice.n, name: CHARGE_ITEM.name, worth: CHARGE_ITEM.price * slice.n };
  if (slice.kind === 'skip') return { id: slice.id, kind: 'skip', n: 1, name: ITEMS.skip.name, worth: ITEMS.skip.price };
  if (slice.kind === 'booster') {
    const room = BOOSTER_ORDER.filter((b) => ownedCount(wallet, b) + slice.n <= MAX_OWNED), b = pick(room.length ? room : BOOSTER_ORDER);
    return { id: slice.id, kind: 'booster', n: slice.n, item: b, name: BOOSTERS[b].name, worth: BOOSTERS[b].price * slice.n };
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
  else if (P.kind === 'booster') { const room = MAX_OWNED - ownedCount(w, P.item), n = Math.min(P.n, room); if (n > 0) w.owned[P.item] = ownedCount(w, P.item) + n; w.coins += (P.n - n) * BOOSTERS[P.item].price; }
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
  const slice = roll(rand), prize = prizeFor(slice, save.wallet, rand);
  save.wallet = grant(save.wallet, prize);
  S.n++;
  return { prize, slice, how, paid };
}
// the mean worth of one spin in coins (boosters at shop price, the rare bird at the mean of what is left): the test
// holds it under the first coin price, so a coin spin is a sink on average
export function meanWorth(wallet) {
  let v = 0;
  for (const s of TABLE) {
    if (s.kind === 'booster') v += (s.w / TOTAL) * s.n * (BOOSTER_ORDER.reduce((a, b) => a + BOOSTERS[b].price, 0) / BOOSTER_ORDER.length);
    else if (s.kind === 'rare') {
      const hens = HEN_SKIN_ORDER.filter((h) => !HEN_SKINS[h].premium && HEN_SKINS[h].price > 0 && !ownsHenSkin(wallet, h)).map((h) => HEN_SKINS[h].price), ch = CHICK_IDS.filter((c) => !ownsChick(wallet, c)).map((c) => CHICK_PRICES[c]), all = [...hens, ...ch];
      v += (s.w / TOTAL) * (all.length ? all.reduce((a, b) => a + b, 0) / all.length : SPIN.rareCoins);
    } else v += (s.w / TOTAL) * prizeFor(s, wallet, () => 0).worth;
  }
  return v;
}
