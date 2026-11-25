// Coin economy: pure logic, no drawing and no DOM. Every function returns new objects and never
// mutates its input, so the game can persist a wallet as plain JSON.
//
// Pricing rationale: a typical win pays ~20-30 coins (see levelCoins), so a booster at 40-70
// coins is one purchase every ~2-3 levels from play alone. Watching an ad is a bonus, never a
// requirement: the free-coins ad pays 25 (about one extra level) every 3 minutes at most.
//
// Google Play later: each booster carries a `sku` id. Real-money coin packs would be added as
// new products that call addCoins(); buy() / useBooster() stay the only spend paths.

import { FAUCETS, winParts, treasureCoins, chestCoins } from './engine/mint.js'; // 0.8.17: the coin loop's one table

export const MAX_OWNED = 9;
// 0.8.15 (the coin loop measured: more than one free booster or charge a level arrived and none was needed, so none was
// ever bought). Free gifts fill a stack only up to GIFT_MAX; past that a gift pays GIFT_FULL of its price in coins.
// Buying is still open up to MAX_OWNED: the bag has room for what the player chooses to pay for.
export const GIFT_MAX = 3;
export const GIFT_FULL = FAUCETS.giftFull.share; // 0.8.17 the Mint: a quarter (was half)

export const BOOSTERS = {
  stone: {
    id: 'stone',
    name: 'Stone shell',
    line: 'One egg starts in a tough stone shell for 8 s.',
    price: 40,
    sku: 'booster_stone',
  },
  golden: {
    id: 'golden',
    name: 'Golden shell',
    line: 'One egg\u2019s golden shell survives a thorn hit.',
    price: 60,
    sku: 'booster_golden',
  },
  time: {
    id: 'time',
    name: 'Slow fuse',
    line: 'Adds 15 seconds to the fuse.',
    price: 50,
    sku: 'booster_time',
  },
  rewind: {
    id: 'rewind',
    name: 'Free rewind',
    line: 'Rewind 12 seconds once, for free.',
    price: 70,
    sku: 'booster_rewind',
  },
  sponge: {
    id: 'sponge',
    name: 'Sponge pad',
    line: 'A soft sponge pad under your first drop.',
    price: 40,
    sku: 'booster_sponge',
  },
  // 2026-11-16: two more start boosts (sim.js opts.nest, sim/strike.js stkSnipStep)
  nest: {
    id: 'nest',
    name: 'Wide Nest',
    line: 'The hen\u2019s basket is 35% wider this level.',
    price: 60,
    sku: 'booster_nest',
  },
  snips: {
    id: 'snips',
    name: 'Thorn Snips',
    line: 'Snips every thorn at the start.',
    price: 80,
    sku: 'booster_snips',
  },
  // 0.8.15 (mykee: "one time immunity from villains"): every villain in the vault keeps away while it stands
  scare: {
    id: 'scare',
    name: 'Scarecrow',
    line: 'Villains keep away for the first 20 seconds.',
    price: 90,
    sku: 'booster_scare',
  },
};

// A row of tiles that holds `fit` of them: all of `list` when it fits, else one page of it with the last place kept for
// the "next page" tile. Nothing is ever left out: every item is on exactly one page. -> { items, more: null | { pg, pages } }
export function pageOf(list, fit, page = 0) {
  if (list.length <= fit) return { items: list, more: null };
  if (fit < 2) return { items: list.slice(0, Math.max(1, fit)), more: null };
  const per = fit - 1, pages = Math.ceil(list.length / per), pg = (((page | 0) % pages) + pages) % pages;
  return { items: list.slice(pg * per, pg * per + per), more: { pg, pages } };
}
// Stable display order for UI lists.
export const BOOSTER_ORDER = ['stone', 'golden', 'time', 'rewind', 'sponge', 'nest', 'snips', 'scare'];
// the star chests hand out the first five in turn (their rewards were set before the newer boosts)
const CHEST_BOOSTS = BOOSTER_ORDER.slice(0, 5);

// ---------------------------------------------------------------- where the game runs (0.8.11)
// The app sells coins and bundles for real money; a web portal (Poki, CrazyGames, GameDistribution) cannot, so there
// the player EARNS everything and the game earns from the videos the player chooses to watch. One catalog and one set
// of prices for both; only the income differs, the same for every player of that platform:
//   wins and the daily gift pay double; the free-coins video pays more, eight times a day, a minute apart (the app's
//   shrinking ladder protects the coin packs, which do not exist here); the Golden Hen, a Premium gift in the app,
//   is a coin outfit.
export const PLATFORM = { web: false };
const WEB = { winMult: 2, ladder: [60, 60, 50, 50, 40, 40, 40, 40], cooldownSec: 60, goldenHen: 900 };
let HEN_GOLD_APP = null;
export function setPlatform(web) {
  PLATFORM.web = !!web;
  if (!HEN_GOLD_APP) HEN_GOLD_APP = { ...HEN_SKINS.golden };
  HEN_SKINS.golden = PLATFORM.web ? { ...HEN_GOLD_APP, price: WEB.goldenHen, premium: false, line: 'Shining gold feathers. The top prize.' } : { ...HEN_GOLD_APP };
}
export const AD_REWARDS = {
  doubleCoins: 'Double the coins from this level',
  // 2026-11-20 (research: CrazyGames caps currency videos at ~5 a day with shrinking rewards): the free-coins video pays
  // a little less each time, four a day since 0.8.17 (the Mint), a few minutes apart, so coins keep their worth and the shop keeps its pull
  // 0.8.17 (the Mint): four a day, 70 coins (was six, 150)
  freeCoins: { coins: FAUCETS.freeCoins.ladder[0], ladder: FAUCETS.freeCoins.ladder.slice(), cooldownSec: FAUCETS.freeCoins.cooldownSec },
};
// the coins the next free-coins video pays today (0: done for today). adDay: { day, n } in the save
export function freeCoinsNext(adDay, day) {
  const n = adDay && adDay.day === day ? Math.max(0, adDay.n | 0) : 0;
  return (PLATFORM.web ? WEB.ladder : AD_REWARDS.freeCoins.ladder)[n] || 0;
}
export function noteFreeCoins(adDay, day) {
  const n = adDay && adDay.day === day ? Math.max(0, adDay.n | 0) : 0;
  return { day, n: n + 1 };
}

export function defaultWallet() {
  return { coins: 0, owned: {}, skins: ['classic'], skin: 'classic', chests: 0, charges: 0, henSkins: ['classic'], henSkin: 'classic', noAds: false, daily: '',
    // 2026-11-16 shop revamp: owned power chicks, the Golden Egg Bank, coin items, and what real money bought
    chicks: [], bank: 0, golden: 0, tickets: { ally: 0, skip: 0 }, noInter: false, payer: false, spend: 0, lastBuyAt: 0, starter: false, season: '', premDay: '', tokens: [], treasures: [],
    // 2026-11-20 shop 2.0: The Whole Coop owned; the boosters tried free from the shop (Free sample), and today's claim
    collector: false, sampled: [], sampleDay: '', sampleId: '',
    // 0.8.15: a half-price ticket held (0 or 1)
    coupon: 0,
    // 0.8.9 TODAY'S DEAL: the day it was bought and what it was (once a day)
    dealDay: '', dealKey: '' };
}

// Make any loaded/saved value safe to use (old saves, hand-edited saves).
export function sanitizeWallet(w) {
  const out = defaultWallet();
  if (!w || typeof w !== 'object') return out;
  out.coins = Math.max(0, Math.floor(Number(w.coins) || 0));
  out.chests = Math.max(0, Math.min(CHEST_COUNT, Math.floor(Number(w.chests) || 0)));
  const sk = Array.isArray(w.skins) ? w.skins.filter((id) => SKINS[id]) : [];
  out.skins = ['classic', ...sk.filter((id, i) => id !== 'classic' && sk.indexOf(id) === i)];
  out.skin = out.skins.includes(w.skin) ? w.skin : 'classic';
  out.charges = Math.max(0, Math.min(MAX_CHARGES, Math.floor(Number(w.charges) || 0)));
  const hs = Array.isArray(w.henSkins) ? w.henSkins.filter((id) => HEN_SKINS[id]) : [];
  out.henSkins = ['classic', ...hs.filter((id, i) => id !== 'classic' && hs.indexOf(id) === i)];
  out.noAds = !!w.noAds;
  out.henSkin = ownsHenSkin(out, w.henSkin) ? w.henSkin : 'classic';
  out.daily = typeof w.daily === 'string' ? w.daily : '';
  const owned = w.owned && typeof w.owned === 'object' ? w.owned : {};
  for (const id of BOOSTER_ORDER) {
    const n = Math.min(MAX_OWNED, Math.max(0, Math.floor(Number(owned[id]) || 0)));
    if (n > 0) out.owned[id] = n;
  }
  const ch = Array.isArray(w.chicks) ? w.chicks.filter((id) => CHICK_PRICES[id]) : [];
  out.chicks = ch.filter((id, i) => ch.indexOf(id) === i);
  const int = (v, hi) => Math.max(0, Math.min(hi, Math.floor(Number(v) || 0)));
  out.bank = int(w.bank, BANK_CAP);
  out.golden = int(w.golden, 99);
  const tk = w.tickets && typeof w.tickets === 'object' ? w.tickets : {};
  out.tickets = { ally: int(tk.ally, MAX_TICKETS), skip: int(tk.skip, MAX_TICKETS) };
  out.noInter = !!w.noInter;
  out.payer = !!w.payer;
  out.spend = Math.max(0, Math.round((Number(w.spend) || 0) * 100) / 100);
  out.lastBuyAt = Math.max(0, Number(w.lastBuyAt) || 0);
  out.starter = !!w.starter;
  out.season = HEN_SKINS[w.season] ? w.season : '';
  out.premDay = typeof w.premDay === 'string' ? w.premDay : '';
  // purchase tokens already granted: a re-delivered purchase must never pay twice (newest kept if it ever grows long)
  out.tokens = Array.isArray(w.tokens) ? w.tokens.filter((t) => typeof t === 'string' && t).slice(-MAX_TOKENS) : [];
  const tr = Array.isArray(w.treasures) ? w.treasures.filter((id) => BOSS_TREASURE_IDS.includes(id)) : [];
  out.treasures = tr.filter((id, i) => tr.indexOf(id) === i);
  const sa = Array.isArray(w.sampled) ? w.sampled.filter((id) => BOOSTERS[id]) : [];
  out.sampled = sa.filter((id, i) => sa.indexOf(id) === i);
  out.sampleDay = typeof w.sampleDay === 'string' ? w.sampleDay : '';
  out.sampleId = BOOSTERS[w.sampleId] ? w.sampleId : '';
  out.dealDay = typeof w.dealDay === 'string' ? w.dealDay : '';
  out.dealKey = typeof w.dealKey === 'string' ? w.dealKey : '';
  out.coupon = Number(w.coupon) > 0 ? 1 : 0;
  if (w.collector) Object.assign(out, collectAll(out));
  return out;
}

export function ownedCount(wallet, id) {
  return (wallet && wallet.owned && wallet.owned[id]) || 0;
}

// Coins for finishing a level. result: { stars 0..3, saved, eggs, perfect, levelId, hard, fresh }.
// 0.8.17 the amounts live in the Mint (engine/mint.js FAUCETS.win), paid OFFLINE; online play adds the Mint's online
// share on top (main.js onWin, its own line on the win page), so an online win pays what a win paid before:
//   base    8 for showing up, +2 per saved egg          (8..~20)
//   stars   4 per star                                  (0..12)
//   perfect +4 for a perfect clutch                     (0 or 4)
//   hard    a level marked hard pays half as much again
//   replay  fresh === false (no new star): only the Mint's replay share (40%) is paid
// Win examples offline: 1 star ~14, 2 stars ~20, 3 stars perfect ~30 (online ~17, ~24, ~36).
export const HARD_PAY = FAUCETS.win.hard;
export function levelCoins(result) {
  return winParts(result || {}, PLATFORM.web ? WEB.winMult : 1); // the web pays double: play is the only way to coins there
}

export function addCoins(wallet, n) {
  const w = sanitizeWallet(wallet);
  w.coins += Math.max(0, Math.floor(n || 0));
  return w;
}

export function canAfford(wallet, id) {
  const b = BOOSTERS[id];
  if (!b || !wallet) return false;
  return wallet.coins >= b.price && ownedCount(wallet, id) < MAX_OWNED;
}

// Spend coins on one booster. Returns a new wallet, or null if it cannot be bought.
export function buy(wallet, id) {
  if (!canAfford(wallet, id)) return null;
  return {
    ...wallet,
    coins: wallet.coins - BOOSTERS[id].price,
    owned: { ...wallet.owned, [id]: ownedCount(wallet, id) + 1 },
  };
}

// Consume one owned booster at level start. Returns a new wallet, or null if none owned.
export function useBooster(wallet, id) {
  if (!BOOSTERS[id] || !wallet || ownedCount(wallet, id) < 1) return null;
  const owned = { ...wallet.owned, [id]: ownedCount(wallet, id) - 1 };
  if (owned[id] === 0) delete owned[id];
  return { ...wallet, owned };
}

// Seconds until the free-coins ad is available again. lastClaimMs: Date.now() of last claim (0 = never).
export function adCooldownLeft(lastClaimMs, nowMs) {
  if (!lastClaimMs) return 0;
  const left = (PLATFORM.web ? WEB.cooldownSec : AD_REWARDS.freeCoins.cooldownSec) - (nowMs - lastClaimMs) / 1000;
  return left > 0 ? Math.ceil(left) : 0;
}

// ---------------------------------------------------------------- egg skins
// Every skin but Classic carries one small power (0.8.10): one thing, once a level or a modest passive. The sim runs it
// (src/sim/perks.js, `new Sim(level, { perk: id })`); the coin perks are paid here (perkCoins). A power is a pleasant
// edge, never a requirement: every level stays beatable, and three stars reachable, with the Classic egg.
// perk: { id (the skin), name, icon (ui/picto.js pictoPerk), line (at most four words on the cards) }
const PK = (id, name, icon, line) => ({ id, name, icon, line });
export const SKINS = {
  classic: { id: 'classic', name: 'Classic', line: 'The good old cream egg.', price: 0, sku: 'skin_classic' },
  speckled: { id: 'speckled', name: 'Speckled', line: 'Cream shell with brown freckles.', price: 120, sku: 'skin_speckled', perk: PK('speckled', 'Lucky Freckles', 'crack', 'First crack is free') },
  striped: { id: 'striped', name: 'Striped', line: 'Candy stripes in red and blue.', price: 120, sku: 'skin_striped', perk: PK('striped', 'Bouncy', 'bounce', 'Takes harder landings') },
  dino: { id: 'dino', name: 'Dino', line: 'A green dino egg with spots.', price: 200, sku: 'skin_dino', perk: PK('dino', 'Thick Shell', 'thorn', 'First thorn only cracks') },
  golden: { id: 'golden', name: 'Golden', line: 'Shiny gold, and richer wins.', price: 300, sku: 'skin_golden', perk: PK('golden', 'Midas', 'coin', '+15% win coins') },
  // 2026-11-16: a Christmas pair and one for each world theme
  bauble: { id: 'bauble', name: 'Bauble', line: 'A shiny red Christmas bauble.', price: 160, sku: 'skin_bauble', perk: PK('bauble', 'Shiny', 'coin', '+10% win coins') },
  candy: { id: 'candy', name: 'Candy Cane', line: 'Peppermint stripes, red and green.', price: 160, sku: 'skin_candy', perk: PK('candy', 'Sweet Seconds', 'clock', '+5 s each level') },
  frosty: { id: 'frosty', name: 'Frosty', line: 'Frosted ice and snowflakes.', price: 180, sku: 'skin_frosty', perk: PK('frosty', 'Frost Touch', 'frost', 'Freezes on touch') },
  galaxy: { id: 'galaxy', name: 'Galaxy', line: 'A swirl of stars from the crystal caves.', price: 240, sku: 'skin_galaxy', perk: PK('galaxy', 'Star Pull', 'pull', 'Longer orb reach') },
  lava: { id: 'lava', name: 'Lava Rock', line: 'Dark rock with glowing cracks.', price: 240, sku: 'skin_lava', perk: PK('lava', 'Hot Shell', 'flame', 'Burns a thorn') },
  thunder: { id: 'thunder', name: 'Thunder', line: 'Storm blue with a lightning bolt.', price: 200, sku: 'skin_thunder', perk: PK('thunder', 'Zap', 'zap', 'Stuns on touch') },
  treasure: { id: 'treasure', name: 'Treasure Map', line: 'X marks the spot.', price: 220, sku: 'skin_treasure', perk: PK('treasure', 'Treasure Sense', 'coin', '+3 coins an egg') },
  pearl: { id: 'pearl', name: 'Pearl', line: 'A pearly shell with a rainbow sheen.', price: 260, sku: 'skin_pearl', perk: PK('pearl', 'Pearl Shine', 'shell', 'First break only cracks') },
  gator: { id: 'gator', name: 'Gator', line: 'Green scales and a pale belly.', price: 220, sku: 'skin_gator', perk: PK('gator', 'Snap Back', 'drop', 'Drops a carried egg') },
  robot: { id: 'robot', name: 'Robo Egg', line: 'Steel plates, rivets and blinking lights.', price: 280, sku: 'skin_robot', perk: PK('robot', 'Grip', 'grip', 'Grips ice and drift') },
};
// the power of a skin (null for Classic), and the coins a win pays with it on
export function skinPerk(id) { return (SKINS[id] && SKINS[id].perk) || null; }
// Coin perks on a win: Shiny +10%, Midas +15%, Treasure Sense +3 per egg home. Prices and offers never change.
// coins = what the level paid (levelCoins + bonus); saved = eggs brought home. Returns the coins to pay.
export function perkCoins(skinId, coins, saved = 0) {
  const c = Math.max(0, Math.floor(coins || 0)), p = skinPerk(skinId);
  if (!c || !p) return c;
  if (p.id === 'bauble') return Math.round(c * 1.1);
  if (p.id === 'golden') return Math.round(c * 1.15);
  if (p.id === 'treasure') return c + 3 * Math.max(0, Math.floor(saved || 0));
  return c;
}

export const SKIN_ORDER = ['classic', 'speckled', 'striped', 'dino', 'bauble', 'candy', 'frosty', 'galaxy', 'lava', 'thunder', 'treasure', 'pearl', 'gator', 'robot', 'golden'];

export function ownsSkin(wallet, id) {
  if (id === 'classic') return true;
  return !!(wallet && Array.isArray(wallet.skins) && wallet.skins.includes(id));
}

export function equippedSkin(wallet) {
  return wallet && ownsSkin(wallet, wallet.skin) && SKINS[wallet.skin] ? wallet.skin : 'classic';
}

export function canAffordSkin(wallet, id) {
  return !!(SKINS[id] && wallet && !ownsSkin(wallet, id) && wallet.coins >= unlockPrice(wallet, SKINS[id].price).price);
}

// Buy a skin (and equip it right away). New wallet, or null if unknown / owned / too poor.
export function buySkin(wallet, id) {
  if (!canAffordSkin(wallet, id)) return null;
  const skins = Array.isArray(wallet.skins) ? wallet.skins : ['classic'];
  const U = unlockPrice(wallet, SKINS[id].price);
  return { ...wallet, coins: wallet.coins - U.price, coupon: U.coupon ? 0 : wallet.coupon || 0, skins: [...skins, id], skin: id };
}

// Equip an owned skin. New wallet, or null if not owned.
export function equipSkin(wallet, id) {
  if (!SKINS[id] || !ownsSkin(wallet, id)) return null;
  return { ...wallet, skin: id };
}

// ---------------------------------------------------------------- the half-price ticket (0.8.15)
// mykee: "a 50% off ... on the unlockables ... a proper cross mark". A prize of the Lucky Spin: one thing to own (an egg
// skin, a hen outfit, a power chick) at half its coin price, the player's choice: it is used by the first of them he
// buys. One held at a time, it never runs out and there is no clock on it. The shop shows the old price crossed out on
// everything it fits while he holds it. It is the one prize that makes coins leave the purse instead of adding to it.
export const COUPON = { off: 0.5, max: 1, coins: FAUCETS.spin.coupon }; // coins: what a second ticket pays while one is held (x the wheel's tier; 0.8.17 the Mint: 20, was 40)
export const couponHeld = (wallet) => (wallet && Number(wallet.coupon) > 0 ? 1 : 0);
// the coin price of a thing to own for this wallet: { price, was, coupon } (was = the list price; coupon: the ticket applies)
export function unlockPrice(wallet, list) {
  const was = Math.max(0, Math.floor(Number(list) || 0)), on = couponHeld(wallet) && was > 0;
  return { price: on ? Math.max(5, Math.round((was * (1 - COUPON.off)) / 5) * 5) : was, was, coupon: !!on };
}
// everything a ticket could be used on right now: [{ kind: 'skin' | 'hen' | 'chick', id, price }]
export function unlockables(wallet) {
  const w = wallet || {}, out = [];
  for (const id of SKIN_ORDER) if (SKINS[id] && SKINS[id].price > 0 && !ownsSkin(w, id)) out.push({ kind: 'skin', id, price: SKINS[id].price });
  for (const id of HEN_SKIN_ORDER) if (HEN_SKINS[id] && !HEN_SKINS[id].premium && HEN_SKINS[id].price > 0 && !ownsHenSkin(w, id)) out.push({ kind: 'hen', id, price: HEN_SKINS[id].price });
  for (const id of Object.keys(CHICK_PRICES)) if (!ownsChick(w, id)) out.push({ kind: 'chick', id, price: CHICK_PRICES[id] });
  return out;
}

// ---------------------------------------------------------------- star chests
// Every 15 stars unlocks a chest on the level map: some coins plus one booster.
// 0.8.15: ten chests (150 stars = 50 levels x 3), and every second one holds an egg skin that the map shows ahead of
// time (research: a visible prize is the reason to replay for three stars). A skin already owned pays half its price.
export const STARS_PER_CHEST = 15;
export const CHEST_COUNT = 10;
export const CHEST_SKINS = ['speckled', 'striped', 'bauble', 'candy', 'frosty']; // chests 2, 4, 6, 8, 10

// The next chest to open, given total stars earned and how many chests were opened already
// (wallet.chests). Returns { index, at, ready, reward: { coins, booster } } or null when all are
// opened. `ready` says the star total has reached `at`.
export function chestFor(totalStars, opened) {
  const index = Math.max(0, Math.floor(opened || 0));
  if (index >= CHEST_COUNT) return null;
  const at = STARS_PER_CHEST * (index + 1);
  return {
    index,
    at,
    ready: (totalStars || 0) >= at,
    reward: { coins: chestCoins(index), booster: CHEST_BOOSTS[index % CHEST_BOOSTS.length], skin: index % 2 ? CHEST_SKINS[(index - 1) / 2] || null : null },
  };
}

// Open a chest: adds its coins and booster to the wallet and counts it as opened.
// Returns a new wallet, or null if the chest is missing or not ready. A booster the player
// already holds MAX_OWNED of is paid out as its price in coins instead.
export function openChest(wallet, chest) {
  if (!wallet || !chest || chest.ready === false) return null;
  const w = sanitizeWallet(wallet);
  w.coins += chest.reward.coins;
  const id = chest.reward.booster;
  giveBooster(w, id);
  const sk = chest.reward.skin;
  if (sk && SKINS[sk]) { if (!w.skins.includes(sk)) w.skins = [...w.skins, sk]; else w.coins += Math.round(SKINS[sk].price / 2); }
  w.chests = Math.max(w.chests, chest.index + 1);
  return w;
}

// ---------------------------------------------------------------- boss treasure (2026-11-19)
// A treasure chest stands beside every boss on the level map (mykee: "after clearing a boss level, show some treasure
// and the unlockables"). Beating the boss opens it, once: coins, a booster and Chick Charges, growing world by world.
// The chick that joins at the next level (strikes.js unlock = boss + 1) is shown in it as part of the reward.
export const BOSS_TREASURE_IDS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
const TREASURE_BOOSTS = ['stone', 'time', 'golden', 'rewind', 'sponge', 'nest', 'snips', 'golden', 'time', 'stone'];
export function bossTreasure(bossId) {
  const w = BOSS_TREASURE_IDS.indexOf(bossId);
  if (w < 0) return null;
  return { id: bossId, coins: treasureCoins(w), booster: TREASURE_BOOSTS[w], charges: 1 }; // 0.8.17 the Mint: 100 to 280 coins (was 120 to 480) and one charge
}
// +1 of a booster into a wallet (a full stack pays its price in coins instead): the boss treasure and a win's taste
function giveBooster(w, id, n = 1) {
  if (!BOOSTERS[id]) return;
  const k = Math.max(0, Math.min(n, GIFT_MAX - ownedCount(w, id)));
  if (k > 0) w.owned = { ...w.owned, [id]: ownedCount(w, id) + k };
  w.coins += giftCoins(id, n - k);
}
// what n gifts of a booster pay when the stack is full (GIFT_FULL of the price, rounded to 5)
export const giftCoins = (id, n = 1) => (BOOSTERS[id] && n > 0 ? Math.round((BOOSTERS[id].price * GIFT_FULL * n) / 5) * 5 : 0);
export function giftBooster(wallet, id, n = 1) { const w = sanitizeWallet(wallet); giveBooster(w, id, n); return w; }
export function tasteBooster(wallet, id) { const w = sanitizeWallet(wallet); giveBooster(w, id); return w; }
export function treasureOpened(wallet, bossId) { return !!(wallet && Array.isArray(wallet.treasures) && wallet.treasures.includes(bossId)); }
// Returns a new wallet with the treasure paid, or null when it was opened already (never pays twice)
export function openBossTreasure(wallet, bossId) {
  const T = bossTreasure(bossId);
  if (!T || treasureOpened(wallet, bossId)) return null;
  const w = sanitizeWallet(wallet);
  w.coins += T.coins;
  giveBooster(w, T.booster);
  w.charges = Math.min(MAX_CHARGES, (w.charges || 0) + T.charges);
  w.treasures = [...w.treasures, bossId];
  return w;
}

// ---------------------------------------------------------------- Chick Charges (2026-11-15 power economy)
// The strike meter no longer refills by waiting. A Chick Charge sends the equipped power chick at once, meter or not.
// Bought in the shop, found in chests (star chests and the daily treasure chest). Never needed to finish a level.
export const CHARGE_ITEM = { id: 'chick', name: 'Chick Charge', line: 'Send your power chick right now, meter or not.', price: 45, sku: 'chick_charge' };
export const CHARGE_PACK = { id: 'chick3', name: 'Chick Charge x3', line: 'Three charges in one bag.', price: 120, n: 3, sku: 'chick_charge3' };
export const CHARGE_PACK10 = { id: 'chick10', name: 'Chick Charge x10', line: 'A big sack of ten charges.', price: 350, n: 10, sku: 'chick_charge10' };
export const CHARGE_PACKS = [CHARGE_ITEM, CHARGE_PACK, CHARGE_PACK10];
export const MAX_CHARGES = 30;
export function buyCharges(wallet, pack) {
  const P = CHARGE_PACKS.find((q) => q.id === pack) || CHARGE_ITEM, n = P.n || 1, w = sanitizeWallet(wallet);
  if (w.coins < P.price || w.charges + n > MAX_CHARGES) return null;
  w.coins -= P.price; w.charges += n;
  return w;
}
export function useCharge(wallet) {
  const w = sanitizeWallet(wallet);
  if (w.charges < 1) return null;
  w.charges -= 1;
  return w;
}

// ---------------------------------------------------------------- daily treasure chest (home page)
// Free once per local day. Reward is fixed by the date (no randomness to farm): coins, and a Chick Charge on most days.
export function dailyChest(dayStr) {
  let h = 0;
  for (const c of String(dayStr)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const D = FAUCETS.dailyChest.coins, coins = D[h % D.length] * (PLATFORM.web ? WEB.winMult : 1), charges = h % 3 === 0 ? 2 : 1;
  return { coins, charges };
}
export function openDailyChest(wallet, dayStr) {
  const w = sanitizeWallet(wallet);
  if (w.daily === dayStr) return null;
  const R = dailyChest(dayStr);
  w.coins += R.coins; w.charges = Math.min(MAX_CHARGES, w.charges + R.charges); w.daily = dayStr;
  return w;
}

// ---------------------------------------------------------------- hen and rooster skins (cosmetic, 2026-11-15)
// Each skin dresses the hen on the nest (and the rooster ally, who wears the matching set). Looks only.
export const HEN_SKINS = {
  classic: { id: 'classic', name: 'Farm Classic', line: 'Cream feathers, red comb.', price: 0, sku: 'hen_classic' },
  santa: { id: 'santa', name: 'Santa Hen', line: 'A fur-trimmed Santa coat, a belt and a Santa hat.', price: 250, sku: 'hen_santa' },
  snowy: { id: 'snowy', name: 'Snowy Owl Look', line: 'Frosted feathers, a Christmas jumper and a fur trapper hat.', price: 220, sku: 'hen_snowy' },
  elf: { id: 'elf', name: 'Little Elf', line: 'A green elf tunic and a pointy cap with a jingle bell.', price: 220, sku: 'hen_elf' },
  reindeer: { id: 'reindeer', name: 'Reindeer', line: 'A cosy reindeer suit, antlers and a shiny red nose.', price: 260, sku: 'hen_reindeer' },
  cocoa: { id: 'cocoa', name: 'Cocoa Hen', line: 'Chocolate feathers, a striped jumper and a bobble beanie.', price: 180, sku: 'hen_cocoa' },
  royal: { id: 'royal', name: 'Royal Hen', line: 'A velvet robe with ermine trim and a jewelled crown.', price: 400, sku: 'hen_royal' },
  golden: { id: 'golden', name: 'Golden Hen', line: 'Shining gold feathers. Comes with Premium.', price: 0, premium: true, sku: 'hen_golden' },
  // 2026-11-16: one outfit for each world (world: the world it belongs to, 1..10)
  farmer: { id: 'farmer', name: 'Farmer Hen', line: 'Denim dungarees and a straw hat.', price: 160, world: 1, sku: 'hen_farmer' },
  lumberjack: { id: 'lumberjack', name: 'Lumberjack', line: 'A red check shirt and a knit beanie.', price: 180, world: 2, sku: 'hen_lumberjack' },
  skier: { id: 'skier', name: 'Ski Champ', line: 'A puffy ski jacket and a bobble hat.', price: 200, world: 3, sku: 'hen_skier' },
  miner: { id: 'miner', name: 'Crystal Miner', line: 'A hi-vis vest and a hard hat with a lamp.', price: 220, world: 4, sku: 'hen_miner' },
  firefighter: { id: 'firefighter', name: 'Firefighter', line: 'A turnout coat and a red fire helmet.', price: 240, world: 5, sku: 'hen_firefighter' },
  raincoat: { id: 'raincoat', name: 'Storm Chaser', line: 'A yellow raincoat and a sou\'wester.', price: 240, world: 6, sku: 'hen_raincoat' },
  pirate: { id: 'pirate', name: 'Pirate Captain', line: 'A captain\'s coat, a red sash and a tricorn hat.', price: 300, world: 7, sku: 'hen_pirate' },
  diver: { id: 'diver', name: 'Deep Diver', line: 'A wetsuit, a dive mask and a snorkel.', price: 280, world: 8, sku: 'hen_diver' },
  fisher: { id: 'fisher', name: 'Bayou Fisher', line: 'A fishing vest and a bucket hat with a fly.', price: 260, world: 9, sku: 'hen_fisher' },
  scientist: { id: 'scientist', name: 'Professor Hen', line: 'A white lab coat and round glasses.', price: 300, world: 10, sku: 'hen_scientist' },
};
export const HEN_SKIN_ORDER = ['classic', 'santa', 'snowy', 'elf', 'reindeer', 'cocoa', 'farmer', 'lumberjack', 'skier', 'miner', 'firefighter', 'raincoat', 'pirate', 'diver', 'fisher', 'scientist', 'royal', 'golden'];
export function ownsHenSkin(w, id) {
  if (!HEN_SKINS[id]) return false;
  if (id === 'classic') return true;
  if (HEN_SKINS[id].premium) return !!(w && w.noAds);
  return !!(w && Array.isArray(w.henSkins) && w.henSkins.includes(id));
}
export function buyHenSkin(wallet, id) {
  const w = sanitizeWallet(wallet), k = HEN_SKINS[id];
  const U = k ? unlockPrice(w, k.price) : null;
  if (!k || k.premium || ownsHenSkin(w, id) || w.coins < U.price) return null;
  w.coins -= U.price; if (U.coupon) w.coupon = 0; w.henSkins = [...w.henSkins, id]; w.henSkin = id;
  return w;
}
export function equipHenSkin(wallet, id) {
  const w = sanitizeWallet(wallet);
  if (!HEN_SKINS[id] || !ownsHenSkin(w, id)) return null;
  w.henSkin = id;
  return w;
}

// ---------------------------------------------------------------- shop revamp (2026-11-16): coin items, power chicks, the bank
// Coin items: an Ally Ticket calls the rooster or goose without an ad, Golden Hour doubles the coins of the next wins,
// a Skip Ticket skips a level not won yet (the fail card and the pause page take it before a video; 0.8.14).
export const MAX_TICKETS = 99;
export const ITEMS = {
  ally: { id: 'ally', name: 'Ally Ticket', line: 'Call the rooster or the goose this try, no ad needed.', price: 80 },
  goldhour: { id: 'goldhour', name: 'Golden Hour', line: 'Double coins on your next 3 wins.', price: 120, wins: 3 },
  skip: { id: 'skip', name: 'Skip Ticket', line: 'Skip a level you have not won yet.', price: 150 },
};
export const ITEM_ORDER = ['ally', 'goldhour', 'skip'];
export function itemCount(w, id) {
  if (!w) return 0;
  if (id === 'goldhour') return w.golden || 0;
  return (w.tickets && w.tickets[id]) || 0;
}
export function buyItem(wallet, id) {
  const I = ITEMS[id], w = sanitizeWallet(wallet);
  if (!I || w.coins < I.price) return null;
  if (id === 'goldhour') { if (w.golden + I.wins > 99) return null; w.golden += I.wins; }
  else { if (w.tickets[id] >= MAX_TICKETS) return null; w.tickets = { ...w.tickets, [id]: w.tickets[id] + 1 }; }
  w.coins -= I.price;
  return w;
}
// spend one Ally or Skip Ticket; null if none
export function useTicket(wallet, id) {
  const w = sanitizeWallet(wallet);
  if (!(w.tickets[id] > 0)) return null;
  w.tickets = { ...w.tickets, [id]: w.tickets[id] - 1 };
  return w;
}

// Power chicks: free when the player reaches their level (data/strikes.js unlock), or bought early for coins.
// Prices rise with the unlock level, so the earliest chick is the cheapest shortcut.
// 2026-11-16 premium chicks (data/strikes.js premium): coins only, no level ever unlocks them, and the real-money chick
// products (All Power Chicks, Premium, the Flock Bundle) give the six level chicks, not these: CHICK_IDS stays those six.
export const PREMIUM_CHICKS = { phoenix: 1800, tock: 1500, bubble: 1200 };
export const CHICK_PRICES = { freeze: 400, thunder: 400, bomb: 450, decoy: 500, tornado: 550, glue: 600, ...PREMIUM_CHICKS };
export const CHICK_IDS = Object.keys(CHICK_PRICES).filter((id) => !PREMIUM_CHICKS[id]);
export const ownsChick = (w, id) => !!(w && Array.isArray(w.chicks) && w.chicks.includes(id));
export function buyChick(wallet, id) {
  const w = sanitizeWallet(wallet), p = CHICK_PRICES[id];
  const U = p ? unlockPrice(w, p) : null;
  if (!p || ownsChick(w, id) || w.coins < U.price) return null;
  w.coins -= U.price; if (U.coupon) w.coupon = 0; w.chicks = [...w.chicks, id];
  return w;
}

// The Golden Egg Bank: every win drops 10% of its coins (at least 2) into a glass egg, up to BANK_CAP. The coins inside
// are only paid out by the egg_bank purchase ("Crack it open"), which unlocks at BANK_OPEN.
export const BANK_CAP = 2000;
export const BANK_OPEN = 600;
// A win's coins: Golden Hour doubles them (one of its wins used up), then the bank takes its share on top (it is
// not taken from the player's coins). bank false: no bank (web portals sell nothing). Returns { wallet, coins, doubled, bankAdd }.
export function payWin(wallet, coins, bank = true) {
  const w = sanitizeWallet(wallet);
  let c = Math.max(0, Math.floor(coins || 0)), doubled = false;
  if (c > 0 && w.golden > 0) { c *= 2; w.golden -= 1; doubled = true; }
  w.coins += c;
  const bankAdd = c > 0 && bank ? Math.min(BANK_CAP - w.bank, Math.max(2, Math.round(c * 0.1))) : 0;
  w.bank += bankAdd;
  return { wallet: w, coins: c, doubled, bankAdd };
}

// Premium's free Chick Charge, claimed on home once per local day
export function claimPremiumCharge(wallet, dayStr) {
  const w = sanitizeWallet(wallet);
  if (!w.noAds || w.premDay === dayStr || w.charges >= MAX_CHARGES) return null;
  w.charges += 1; w.premDay = dayStr;
  return w;
}

// ---------------------------------------------------------------- real-money products (Google Play in-app products)
// usd: the hint shown until Play returns the localized price (the store's price is what the player pays).
// type: 'consumable' (bought again and again; Play consumes it after the grant) or 'once' (non-consumable; restore()
// gives it back on a new install). One price for everyone: nothing here depends on who is buying.
export const MAX_TOKENS = 400;
// 2026-11-20 shop 2.0 (mykee: "$2.99 to unlock everything", "sell bundles, not single items", "the user must not feel
// bad in the shop"): one clear ladder of three one-time bundles (Starter $0.99 < Unlock Everything $2.99 < The Whole Coop
// $5.99), one repeatable Helper Bundle, the bank and four coin packs. Gone: the $19.99 vault, the Flock Bundle, the
// Season Pack, All Chicks and No Ads (each sat beside a bundle that already held it). Old saves keep their old flags
// (noInter, season) harmlessly; nothing was ever sold live, so nothing needs migrating.
export const IAP = {
  coins_250: { sku: 'coins_250', usd: 0.99, type: 'consumable', name: 'Pouch of coins', coins: 250 },
  coins_850: { sku: 'coins_850', usd: 2.99, type: 'consumable', name: 'Bag of coins', coins: 850 },
  coins_1500: { sku: 'coins_1500', usd: 4.99, type: 'consumable', name: 'Sack of coins', coins: 1500, tag: 'Most popular' },
  coins_3300: { sku: 'coins_3300', usd: 9.99, type: 'consumable', name: 'Chest of coins', coins: 3300, tag: 'Best value' },
  starter_nest: { sku: 'starter_nest', usd: 0.99, type: 'once', name: 'Starter Nest', line: '600 coins, 3 Chick Charges, 2 of every boost and the Cocoa Hen. Only once.', coins: 600, charges: 3, boosts: 2, hen: 'cocoa' },
  eggscape_premium: { sku: 'eggscape_premium', usd: 2.99, type: 'once', name: 'Unlock Everything', line: 'Every bonus at once, every level open, the six power chicks, the Golden Hen and egg, 1500 coins and a free Chick Charge every day.', coins: 1500, chicks: true, premium: true, egg: 'golden', daily: 1 },
  eggscape_collector: { sku: 'eggscape_collector', usd: 5.99, type: 'once', name: 'The Whole Coop', line: 'All of Unlock Everything, every hen outfit, every egg, the three premium chicks and 3000 coins. Forever.', coins: 3000, chicks: true, premium: true, egg: 'golden', daily: 1, collector: true },
  bundle_helper: { sku: 'bundle_helper', usd: 1.99, type: 'consumable', name: 'Helper Bundle', line: '800 coins, 5 Chick Charges, 3 Ally Tickets and 2 of every boost.', coins: 800, charges: 5, ally: 3, boosts: 2 },
  egg_bank: { sku: 'egg_bank', usd: 1.99, type: 'consumable', name: 'Golden Egg Bank', line: 'Every win drops coins in. Crack it open for all of them.', bank: true },
};
export const COIN_PACKS = ['coins_250', 'coins_850', 'coins_1500', 'coins_3300'];
export const BUNDLES = ['starter_nest', 'eggscape_premium', 'eggscape_collector']; // the shop's good / better / best
export const usdHint = (sku) => (IAP[sku] ? '$' + IAP[sku].usd.toFixed(2) : '');

// What a bundle holds, counted from the tables (the shop's content strip and its badges): coins, charges, boosts each,
// ally tickets, the hen, the eggs, the chicks, and the premium perks (no videos, every level, a charge a day)
export function bundleParts(sku) {
  const P = IAP[sku];
  if (!P) return null;
  const hens = P.collector ? HEN_SKIN_ORDER.filter((id) => id !== 'classic') : [P.hen, P.premium && 'golden'].filter(Boolean);
  const eggs = P.collector ? SKIN_ORDER.filter((id) => id !== 'classic') : P.egg ? [P.egg] : [];
  const chicks = P.collector ? Object.keys(CHICK_PRICES) : P.chicks ? CHICK_IDS.slice() : [];
  return { coins: P.coins || 0, charges: P.charges || 0, boosts: P.boosts || 0, ally: P.ally || 0, hens, eggs, chicks, premium: !!P.premium, daily: P.daily || 0 };
}
// the coin worth of a bundle, priced from the tables: coins + boosts at their coin price + charges at CHARGE_ITEM.price
// + tickets + hen outfits, egg skins and chicks at their coin prices.
export function bundleValue(sku) {
  const B = bundleParts(sku);
  if (!B) return 0;
  const boosts = B.boosts * BOOSTER_ORDER.reduce((a, id) => a + BOOSTERS[id].price, 0);
  // the charge a day counts as one month of them (30); the other perks (no videos, levels open) count 0
  return B.coins + boosts + (B.charges + B.daily * 30) * CHARGE_ITEM.price + B.ally * ITEMS.ally.price
    + B.hens.reduce((a, id) => a + HEN_SKINS[id].price, 0) + B.eggs.reduce((a, id) => a + SKINS[id].price, 0) + B.chicks.reduce((a, id) => a + CHICK_PRICES[id], 0);
}
// how many times more than the same money buys in plain coins (at the smallest pack's rate), rounded DOWN: the card's
// "6x value" is never a typed-in number and never overclaims. 0 for a product that is not a bundle.
export const COIN_RATE = IAP.coins_250.coins / IAP.coins_250.usd;
export function bundleTimes(sku) {
  const P = IAP[sku];
  if (!P || P.bank || COIN_PACKS.includes(sku)) return 0;
  return Math.floor(bundleValue(sku) / (P.usd * COIN_RATE));
}

// Can this product be bought right now? (one-time products already owned, the bank before it is full enough)
export function iapAvailable(wallet, sku) {
  const P = IAP[sku], w = wallet || {};
  if (!P) return false;
  if (sku === 'starter_nest') return !w.starter;
  if (sku === 'egg_bank') return (w.bank || 0) >= BANK_OPEN;
  if (sku === 'eggscape_premium') return !w.noAds;
  if (sku === 'eggscape_collector') return !w.collector;
  return true;
}

// the cheapest coin pack that covers a shortfall (the biggest one if none does)
export function packFor(short) {
  return COIN_PACKS.find((sku) => IAP[sku].coins >= short) || COIN_PACKS[COIN_PACKS.length - 1];
}

// the six level chicks added to what the player owns (a premium chick bought with coins is kept)
const withChicks = (have) => [...CHICK_IDS, ...(have || []).filter((id) => !CHICK_IDS.includes(id))];
// The Whole Coop: every hen outfit, egg skin and chick in the tables (sanitizeWallet runs it again on every load, so a
// skin added in a later update is the collector's too)
function collectAll(w) {
  const add = (have, all) => [...have, ...all.filter((id) => !have.includes(id))];
  return { collector: true, noAds: true, skins: add(w.skins, SKIN_ORDER), henSkins: add(w.henSkins, HEN_SKIN_ORDER.filter((id) => !HEN_SKINS[id].premium)), chicks: add(w.chicks, Object.keys(CHICK_PRICES)) };
}

function addBoosts(w, n) {
  for (const id of BOOSTER_ORDER) {
    const room = MAX_OWNED - ownedCount(w, id), k = Math.min(n, room);
    if (k > 0) w.owned = { ...w.owned, [id]: ownedCount(w, id) + k };
    if (n > k) w.coins += (n - k) * BOOSTERS[id].price; // a full slot is paid out at its price, as chests do
  }
}

// Grant a purchase. Idempotent per purchase token: the token is remembered in the wallet, and a token seen before pays
// nothing again. Non-consumables also carry an entitlement (No Ads, the chicks, a skin) that is (re)applied every time
// their purchase is reported, with or without a new token; that is what restore() relies on after a reinstall.
// Consumables are paid only against a new token. Returns { wallet, granted } (granted: coins and items were paid now).
export function grantIap(wallet, sku, token, now = 0) {
  const P = IAP[sku], w = sanitizeWallet(wallet);
  if (!P) return { wallet: w, granted: false };
  const tok = typeof token === 'string' ? token : '';
  const fresh = !!tok && !w.tokens.includes(tok);
  if (P.type === 'once') { // the entitlement
    if (P.premium) w.noAds = true;
    if (P.chicks) w.chicks = withChicks(w.chicks);
    if (P.hen && !w.henSkins.includes(P.hen)) w.henSkins = [...w.henSkins, P.hen];
    if (sku === 'starter_nest') w.starter = true;
    if (P.egg && !w.skins.includes(P.egg)) w.skins = [...w.skins, P.egg];
    if (P.collector) Object.assign(w, collectAll(w)); // every outfit, egg and chick, also those added in later updates
  }
  if (!fresh) return { wallet: w, granted: false };
  w.coins += P.coins || 0;
  if (P.charges) { const k = Math.min(P.charges, MAX_CHARGES - w.charges); w.charges += k; w.coins += (P.charges - k) * CHARGE_ITEM.price; }
  if (P.boosts) addBoosts(w, P.boosts);
  if (P.ally) w.tickets = { ...w.tickets, ally: Math.min(MAX_TICKETS, w.tickets.ally + P.ally) };
  if (P.bank) { w.coins += Math.max(BANK_OPEN, w.bank); w.bank = 0; } // the buy button only shows from BANK_OPEN coins up
  if (P.hen) w.henSkin = P.hen; // the new look is put on right away
  if (P.premium && !P.collector) w.henSkin = 'golden';
  w.tokens = [...w.tokens, tok].slice(-MAX_TOKENS);
  w.payer = true;
  w.spend = Math.round((w.spend + P.usd) * 100) / 100;
  w.lastBuyAt = now || w.lastBuyAt;
  return { wallet: w, granted: true };
}

// ---------------------------------------------------------------- shop 2.0 (2026-11-20): kits, sets, free samples, bonus chest
// Kits: bundles for coins on the Power-ups tab. Price = the parts at their coin prices, less the discount, rounded to
// 10. All or nothing: a kit is "Full" while any of its parts is at MAX_OWNED (nothing is paid out as coins here).
export const KITS = {
  rescue: { id: 'rescue', name: 'Rescue Kit', parts: ['stone', 'nest', 'sponge'], off: 0.2 },
  time: { id: 'time', name: 'Time Kit', parts: ['time', 'rewind', 'golden'], off: 0.2 },
  toolbox: { id: 'toolbox', name: 'Full Toolbox', parts: BOOSTER_ORDER.slice(), off: 0.25 },
};
export const KIT_ORDER = ['rescue', 'time', 'toolbox'];
const round10 = (n) => Math.round(n / 10) * 10;
const partsCoins = (K) => K.parts.reduce((a, id) => a + BOOSTERS[id].price, 0);
export const kitPrice = (id) => (KITS[id] ? round10(partsCoins(KITS[id]) * (1 - KITS[id].off)) : 0);
export const kitSave = (id) => (KITS[id] ? partsCoins(KITS[id]) - kitPrice(id) : 0);
export const kitFull = (wallet, id) => !!KITS[id] && KITS[id].parts.some((b) => ownedCount(wallet, b) >= MAX_OWNED);
export function buyKit(wallet, id) {
  const K = KITS[id];
  if (!K || !wallet || kitFull(wallet, id) || wallet.coins < kitPrice(id)) return null;
  const owned = { ...wallet.owned };
  for (const b of K.parts) owned[b] = ownedCount(wallet, b) + 1;
  return { ...wallet, coins: wallet.coins - kitPrice(id), owned };
}

// Sets: a hen outfit and the egg that goes with it, at the top of the Hens tab. Price = 75% of the parts still not
// owned, rounded to 10; shown only while two or more parts are missing. Buying owns and equips both.
export const SETS = {
  winter: { id: 'winter', name: 'Winter', hen: 'santa', egg: 'candy' },
  explorer: { id: 'explorer', name: 'Explorer', hen: 'pirate', egg: 'treasure' },
  crystal: { id: 'crystal', name: 'Crystal', hen: 'miner', egg: 'galaxy' },
  storm: { id: 'storm', name: 'Storm', hen: 'raincoat', egg: 'thunder' },
};
export const SET_ORDER = ['winter', 'explorer', 'crystal', 'storm'];
export const SET_OFF = 0.25;
function setMissing(wallet, id) {
  const S = SETS[id];
  if (!S) return null;
  return { hen: ownsHenSkin(wallet, S.hen) ? 0 : HEN_SKINS[S.hen].price, egg: ownsSkin(wallet, S.egg) ? 0 : SKINS[S.egg].price, n: (ownsHenSkin(wallet, S.hen) ? 0 : 1) + (ownsSkin(wallet, S.egg) ? 0 : 1) };
}
export const setAvailable = (wallet, id) => { const M = setMissing(wallet, id); return !!M && M.n >= 2; };
export const setPrice = (wallet, id) => { const M = setMissing(wallet, id); return M ? round10((M.hen + M.egg) * (1 - SET_OFF)) : 0; };
export const setSave = (wallet, id) => { const M = setMissing(wallet, id); return M ? M.hen + M.egg - setPrice(wallet, id) : 0; };
export function buySet(wallet, id) {
  const S = SETS[id];
  if (!S || !wallet || !setAvailable(wallet, id)) return null;
  const w = sanitizeWallet(wallet), price = setPrice(w, id);
  if (w.coins < price) return null;
  w.coins -= price;
  if (!w.henSkins.includes(S.hen)) w.henSkins = [...w.henSkins, S.hen];
  if (!w.skins.includes(S.egg)) w.skins = [...w.skins, S.egg];
  w.henSkin = S.hen; w.skin = S.egg;
  return w;
}

// Free sample (the shop's FREE TODAY row): one booster the player never tried, free once a local day, no video. After
// all seven were sampled the tile becomes "Free boost": today's booster (it rotates by date) for a short video, once a
// day. -> { id, video (needs a video), done (claimed today) }
const dayHash = (day) => { let h = 0; for (const c of String(day)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
export function sampleFor(wallet, day) {
  const w = wallet || {}, sampled = Array.isArray(w.sampled) ? w.sampled : [];
  if (w.sampleDay === day && BOOSTERS[w.sampleId]) return { id: w.sampleId, video: false, done: true };
  const fresh = BOOSTER_ORDER.filter((id) => !sampled.includes(id));
  if (fresh.length) return { id: fresh.find((id) => !ownedCount(w, id)) || fresh[0], video: false, done: false };
  return { id: BOOSTER_ORDER[dayHash(day) % BOOSTER_ORDER.length], video: true, done: false };
}
// claim today's sample (the game shows the video first when sampleFor says so). New wallet, or null if done today.
// A booster already at MAX_OWNED is paid at its coin price, as chests do.
export function claimSample(wallet, day) {
  const S = sampleFor(wallet, day);
  if (S.done) return null;
  const w = sanitizeWallet(wallet);
  giveBooster(w, S.id);
  if (!w.sampled.includes(S.id)) w.sampled = [...w.sampled, S.id];
  w.sampleDay = day; w.sampleId = S.id;
  return w;
}

// TODAY'S DEAL (0.8.9, mykee: "they should feel like they are hitting a jackpot", "no pressure"): one coin item a day
// at 30% off, picked by the day from the kits, sets, eggs and outfits the player does not own yet. The pick depends only
// on the day and what the wallet owns (no per-player pricing), the price only on the item's own coin price. Once a day;
// no clock, no countdown: the shop only says "New deal tomorrow".
export const DEAL_OFF = 0.3;
// the item's normal coin price (kits and sets at their own bundle price), 0 when it cannot be the deal today
function dealWas(w, key) {
  const [k, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
  if (k === 'kit') return KITS[id] && !kitFull(w, id) ? kitPrice(id) : 0;
  if (k === 'set') return setAvailable(w, id) ? setPrice(w, id) : 0;
  if (k === 'skin') return SKINS[id] && !ownsSkin(w, id) ? SKINS[id].price : 0;
  if (k === 'hen') return HEN_SKINS[id] && !HEN_SKINS[id].premium && !ownsHenSkin(w, id) ? HEN_SKINS[id].price : 0;
  return 0;
}
// every candidate, the four kinds dealt in turn (so the days do not run through all the eggs first)
const DEAL_ALL = (() => {
  const L = [KIT_ORDER.map((id) => 'kit:' + id), SET_ORDER.map((id) => 'set:' + id), SKIN_ORDER.map((id) => 'skin:' + id), HEN_SKIN_ORDER.map((id) => 'hen:' + id)], out = [];
  for (let i = 0; L.some((a) => i < a.length); i++) for (const a of L) if (i < a.length) out.push(a[i]);
  return out;
})();
// what can be the deal for this wallet (not owned, not full), in that fixed order
export const dealPool = (wallet) => DEAL_ALL.filter((k) => dealWas(wallet || {}, k) > 0);
export const dealPrice = (was) => round10(was * (1 - DEAL_OFF));
// -> { key, price, was, done } (done: bought today, the card says "Got it"), or null when nothing is left to offer
export function dailyDeal(wallet, day) {
  const w = wallet || {};
  if (w.dealDay === day && w.dealKey) return { key: w.dealKey, price: 0, was: 0, done: true };
  // the day picks a place in the fixed list; the first item from there on that this wallet can take is the deal (buying
  // something else does not move it, only the deal item itself becoming owned does)
  const n = DEAL_ALL.length, at = (Math.imul(dayHash(day), 2654435761) >>> 0) % n;
  for (let i = 0; i < n; i++) { const key = DEAL_ALL[(at + i) % n], was = dealWas(w, key); if (was > 0) return { key, price: dealPrice(was), was, done: false }; }
  return null;
}
// buy today's deal: the item is the player's (outfits and eggs put on, as a normal buy does). New wallet, or null.
export function buyDeal(wallet, day) {
  const D = dailyDeal(wallet, day);
  if (!D || D.done || !wallet || wallet.coins < D.price) return null;
  const w = sanitizeWallet(wallet), [k, id] = [D.key.slice(0, D.key.indexOf(':')), D.key.slice(D.key.indexOf(':') + 1)];
  if (k === 'kit') { for (const b of KITS[id].parts) w.owned = { ...w.owned, [b]: ownedCount(w, b) + 1 }; } // kitFull was checked: no slot is at MAX_OWNED
  else if (k === 'set') { const S = SETS[id]; if (!w.henSkins.includes(S.hen)) w.henSkins = [...w.henSkins, S.hen]; if (!w.skins.includes(S.egg)) w.skins = [...w.skins, S.egg]; w.henSkin = S.hen; w.skin = S.egg; }
  else if (k === 'skin') { w.skins = [...w.skins, id]; w.skin = id; }
  else if (k === 'hen') { w.henSkins = [...w.henSkins, id]; w.henSkin = id; }
  w.coins -= D.price; w.dealDay = day; w.dealKey = D.key;
  return w;
}

// Bonus chest (the win card's one video when an ad break would have been due, ads.js bonusDue): 30 coins (the Mint) and one
// booster picked by the level id, so the same level always shows the same chest
export const BONUS_CHEST = { coins: FAUCETS.bonusChest.coins }; // 0.8.17: 30 (was 40), inside the Mint's win-video pot
export const bonusChest = (levelId) => ({ coins: BONUS_CHEST.coins, booster: BOOSTER_ORDER[Math.abs(Math.floor(levelId || 0)) % BOOSTER_ORDER.length] });
export function openBonusChest(wallet, levelId) {
  const R = bonusChest(levelId), w = sanitizeWallet(wallet);
  w.coins += R.coins;
  giveBooster(w, R.booster);
  return w;
}
