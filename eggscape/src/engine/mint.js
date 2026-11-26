// The Mint: one table for the whole coin loop (0.8.17). Pure, no DOM, no imports. node tools/test-mint.mjs
//
// mykee (2026-11-25): "From the rewarded videos, the slot machine and the daily unlockables the user could unlock
// everything in the game without spending a single dollar. We need a proper engine for the whole coin system." and
// "users cannot unlock a far distant world without unlocking the previous one".
//
// Measured before this table (players/README.md, findings 19 to 24): a player who took every video and spin held 1,497
// coins at level 12 (enough for every world gate up to world 6, or three chicks); Double coins paid on every win with
// no daily limit; a level already won at three stars paid in full again, for ever; any world gate could be bought from
// the first world on; the middle player (commuter, never leaving, buying all he could) owned 81% of everything to own
// on day 30 and all of it by day 41 (the earliest on day 23).
//
// Every faucet and every sink of the played economy is a row here: its amount, its ceiling and the reason for it. The
// game reads its amounts from this table (economy.js, spin.js, main.js), and tools/test-mint.mjs checks the rest of the
// game against it, so a later change cannot quietly break the balance. Nothing here depends on who the player is
// (no per-player price), and nothing has a clock on it (the "day" is the calendar day, never a countdown).

// ---------------------------------------------------------------- faucets: what puts coins in the purse
export const FAUCETS = {
  // a level won. The parts are paid offline; online play adds `online` on top (below). Hard levels pay `hard` times.
  win: { show: 7, egg: 2, star: 4, perfect: 4, hard: 1.5, ceiling: 'once per win', why: 'the backbone: a booster is two or three wins away' },
  // a win that earns no new star (a level replayed for the stars it already has) pays this share: replaying is not a farm
  replay: { share: 0.4, ceiling: 'per win, no limit, at 40%', why: 'a new star pays in full; the same stars again pay little' },
  // online play pays this share on top of a win, shown on the win page as its own line. Offline players see no videos,
  // so the engine says it in the open, the same for everyone: the base is set so ONLINE play earns what was intended.
  online: { share: 0.2, ceiling: 'per win', why: 'offline play earns less (no videos), so online play is paid a little more, openly' },
  bossTreasure: { base: 40, step: 8, ceiling: 'once per boss', why: 'the big moment of each world; it was 120 + 40 a world, a third of all coins' },
  starChest: { base: 10, step: 5, ceiling: 'once per 15 stars', why: 'stars are the reason to replay; the chest skins are the prize, not the coins' },
  dailyChest: { coins: [8, 8, 10, 8, 15, 8, 20], ceiling: 'once a day', why: 'a reason to come back, never a wage' },
  freeCoins: { ladder: [20, 15, 10, 5], cooldownSec: 180, ceiling: 'four videos a day, 50 coins', why: 'a chosen video is worth a little, never a living' },
  // the win page's videos: Double coins and the Bonus chest's coins share one pot a day. Once it is spent, the win page
  // offers neither until tomorrow (the video was a chosen reward, so nothing is cut short after it is offered).
  winVideo: { perDay: 50, ceiling: '50 coins a day', why: 'Double coins on every win was a second wage with no limit' },
  bonusChest: { coins: 30, ceiling: 'inside the win-video pot', why: 'a boost and a few coins' },
  // the Lucky Spin's coin prizes (spin.js TABLE ids c1, c2, c3) and the wheel's size by the world reached
  // coupon: what a second half-price ticket pays while one is held (economy.js COUPON.coins, x the wheel size; was 40);
  // a Chick Charge won into a full sack pays the giftFull share of its price (was its whole price)
  spin: { coins: [10, 20, 50], tierX: [1, 1.1, 1.2, 1.3], coupon: 20, ceiling: 'three video spins a day, two spins for time played, two cheer-up spins', why: 'the wheel is for fun and items, not a second purse' },
  dailyVault: { coins: 5, ceiling: 'once a day, won', why: 'main.js DAILY_COINS: on top of the level\'s own coins; at 40 it paid more than the daily chest' },
  // a free booster into a full stack (GIFT_MAX) pays this share of its price in coins (economy.js GIFT_FULL): was 0.5,
  // which made every booster prize of a strong player's spins a coin prize
  giftFull: { share: 0.25, ceiling: 'per gift into a full stack', why: 'a winning pull is never empty, but a full bag is no coin mine' },
  bonusGoal: { coins: 15, ceiling: 'once per level and mode', why: 'main.js BONUS_COINS' },
  // the combo album (src/album.js): every power combo found in play. Paid once ever, on the album page.
  album: { coins: 50, ceiling: 'once ever', why: 'a thank-you for finding all seven combos, not a wage' },
};

// ---------------------------------------------------------------- sinks: what takes coins out
export const SINKS = {
  // a world opens by stars, or for the stars it is missing. Only the NEXT world can be opened, and only once the world
  // before it is open and its boss is won (or skipped). A player at the star target pays nothing: it simply opens.
  gate: { starsPerLevel: 1.4, perStar: 75, floor: 150, why: 'a star is worth about three wins; a world is earned in order' },
  things: { why: 'egg skins, hen outfits and the premium chicks: the coin catalogue (economy.js), counted by tools/test-mint.mjs' },
  boosters: { why: 'boosters, kits, charges and tickets: endless, counted apart' },
  coinSpin: { why: 'three a day at a climbing price (spin.js SPIN.coin x the wheel size): always more than a pull is worth' },
};

// ---------------------------------------------------------------- the whole day
// coins from videos + spins + daily gifts in one day, however many are taken (the Daily Vault and level wins are play)
export const DAY = { ceiling: 250 };
// targets the simulator must show (tools/test-mint.mjs)
export const TARGETS = { ownAllDay: 45, commuterDay30: 0.4, purseAt: 12 };

// ---------------------------------------------------------------- the rules, pure
const int = (v) => Math.max(0, Math.floor(Number(v) || 0));
// what a win pays before the online share: fresh = it earned a new star (or it is the first clear); k = platform factor
export function winParts(r, k = 1) {
  const W = FAUCETS.win, stars = Math.max(0, Math.min(3, int(r.stars))), saved = Math.max(0, Math.min(r.eggs > 0 ? r.eggs : 6, int(r.saved)));
  const base = (W.show + W.egg * saved) * k, star = W.star * stars * k, perfect = r.perfect && stars > 0 ? W.perfect * k : 0;
  const sum = base + star + perfect, hard = r.hard && stars > 0 ? Math.round(sum * (W.hard - 1)) : 0;
  const replay = r.fresh === false ? -Math.round((sum + hard) * (1 - FAUCETS.replay.share)) : 0;
  return { base, stars: star, perfect, hard, replay, total: sum + hard + replay };
}
// the online share of a win's coins (shown as its own line); 0 offline
export const onlineBonus = (coins, online = true) => (online && coins > 0 ? Math.max(1, Math.round(coins * FAUCETS.online.share)) : 0);
// is the device online? A web portal build always counts as online (it cannot run without the network). The app asks
// its shell when it can tell (EggApp.isOnline), else the WebView's navigator.onLine. Never blocks play: offline only
// means the online line is not paid.
export function isOnline({ web = false, nav = null, bridge = null } = {}) {
  if (web) return true;
  try { if (bridge && typeof bridge.isOnline === 'function') return !!bridge.isOnline(); } catch (_) { /* an older shell */ }
  return !(nav && nav.onLine === false);
}

export const treasureCoins = (w) => FAUCETS.bossTreasure.base + FAUCETS.bossTreasure.step * int(w);
export const chestCoins = (i) => FAUCETS.starChest.base + FAUCETS.starChest.step * int(i);

// the win-video pot: mint = save.mint ({ day, wv }), day = the game's day key
const pot = (mint, day) => (mint && typeof mint === 'object' && mint.day === day ? int(mint.wv) : 0);
export const winVideoLeft = (mint, day) => Math.max(0, FAUCETS.winVideo.perDay - pot(mint, day));
// a win page may offer a video worth n coins (Double coins: the win's coins; Bonus chest: its coins)
export const winVideoOk = (mint, day, n) => int(n) <= winVideoLeft(mint, day);
// count n coins paid by a win-page video: returns the new mint object
export const winVideoTake = (mint, day, n) => ({ day, wv: pot(mint, day) + int(n) });

// worlds: k is 0-based. need = stars that open world k; ready = the world before is open and its boss passed.
export const worldNeed = (k, perEnv) => Math.round(SINKS.gate.starsPerLevel * perEnv * int(k));
// open(j): world j is open; bossPassed(j): world j's boss is won (or skipped). World 0 is always ready.
export const worldReady = (k, open, bossPassed) => int(k) <= 0 || (!!open(k - 1) && !!bossPassed(k - 1));
// the coin price of opening world k with `stars` stars: the stars it is missing, at least the floor; 0 when no star
// is missing (it opens by itself)
export function gatePrice(k, stars, perEnv) {
  const missing = Math.max(0, worldNeed(k, perEnv) - int(stars));
  return missing ? Math.max(SINKS.gate.floor, SINKS.gate.perStar * missing) : 0;
}
// may world k be opened for coins now? -> { ok, why: 'open' | 'order' | 'free' | 'coins', price }
export function gateBuy(k, { stars, perEnv, coins, open, bossPassed }) {
  if (open(k)) return { ok: false, why: 'open', price: 0 };
  if (!worldReady(k, open, bossPassed)) return { ok: false, why: 'order', price: 0 };
  const price = gatePrice(k, stars, perEnv);
  if (!price) return { ok: true, why: 'free', price: 0 };
  return int(coins) >= price ? { ok: true, why: 'coins', price } : { ok: false, why: 'coins', price };
}

// the day's ceiling: what videos, spins and daily gifts can pay in one day with every one of them taken.
// spinCoins: the coins one pull pays on average at the biggest wheel (spin.js), spinsPerDay: pulls a day not earned by
// a fresh win (videos, time played, cheer-up). -> { parts, total, ok }
export function dayBudget(spinCoins, spinsPerDay) {
  const F = FAUCETS, parts = {
    'free-coins videos': F.freeCoins.ladder.reduce((a, b) => a + b, 0),
    'win-page videos': F.winVideo.perDay,
    'daily chest (most)': Math.max(...F.dailyChest.coins),
    'spins (mean, biggest wheel)': Math.round(spinCoins * spinsPerDay),
  };
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  return { parts, total, ok: total <= DAY.ceiling };
}
