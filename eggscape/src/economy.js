// Coin economy: pure logic, no drawing and no DOM. Every function returns new objects and never
// mutates its input, so the game can persist a wallet as plain JSON.
//
// Pricing rationale: a typical win pays ~20-30 coins (see levelCoins), so a booster at 40-70
// coins is one purchase every ~2-3 levels from play alone. Watching an ad is a bonus, never a
// requirement: the free-coins ad pays 25 (about one extra level) every 3 minutes at most.
//
// Google Play later: each booster carries a `sku` id. Real-money coin packs would be added as
// new products that call addCoins(); buy() / useBooster() stay the only spend paths.

export const MAX_OWNED = 9;

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
    line: 'Rewind 5 seconds once, for free.',
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
    line: 'Three thorns are snipped off as the level starts.',
    price: 80,
    sku: 'booster_snips',
  },
};

// Stable display order for UI lists.
export const BOOSTER_ORDER = ['stone', 'golden', 'time', 'rewind', 'sponge', 'nest', 'snips'];
// the star chests hand out the first five in turn (their rewards were set before the newer boosts)
const CHEST_BOOSTS = BOOSTER_ORDER.slice(0, 5);

export const AD_REWARDS = {
  doubleCoins: 'Double the coins from this level',
  freeCoins: { coins: 25, cooldownSec: 180 },
};

export function defaultWallet() {
  return { coins: 0, owned: {}, skins: ['classic'], skin: 'classic', chests: 0, charges: 0, henSkins: ['classic'], henSkin: 'classic', noAds: false, daily: '',
    // 2026-11-16 shop revamp: owned power chicks, the Golden Egg Bank, coin items, and what real money bought
    chicks: [], bank: 0, golden: 0, tickets: { ally: 0, skip: 0 }, noInter: false, payer: false, spend: 0, lastBuyAt: 0, starter: false, season: '', premDay: '', tokens: [], treasures: [] };
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
  return out;
}

export function ownedCount(wallet, id) {
  return (wallet && wallet.owned && wallet.owned[id]) || 0;
}

// Coins for finishing a level. result: { stars 0..3, saved, eggs, perfect, levelId }.
// A loss still pays a small consolation so a bad run never feels wasted.
//   base    4 for showing up, +2 per saved egg          (4..~16)
//   stars   5 per star                                  (0..15)
//   perfect +5 for a perfect clutch                     (0 or 5)
// Win examples: 1 star ~15-17, 2 stars ~22, 3 stars perfect ~32-36.
export function levelCoins(result) {
  const r = result || {};
  const stars = Math.max(0, Math.min(3, Math.floor(r.stars || 0)));
  const saved = Math.max(0, Math.min(r.eggs > 0 ? r.eggs : 6, Math.floor(r.saved || 0)));
  const base = 4 + 2 * saved;
  const starCoins = 5 * stars;
  const perfect = r.perfect && stars > 0 ? 5 : 0;
  return { base, stars: starCoins, perfect, total: base + starCoins + perfect };
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
  const left = AD_REWARDS.freeCoins.cooldownSec - (nowMs - lastClaimMs) / 1000;
  return left > 0 ? Math.ceil(left) : 0;
}

// ---------------------------------------------------------------- egg skins (cosmetic only)
// Never sold as an advantage: a skin changes how the egg looks and nothing else.
export const SKINS = {
  classic: { id: 'classic', name: 'Classic', line: 'The good old cream egg.', price: 0, sku: 'skin_classic' },
  speckled: { id: 'speckled', name: 'Speckled', line: 'Cream shell with brown freckles.', price: 120, sku: 'skin_speckled' },
  striped: { id: 'striped', name: 'Striped', line: 'Candy stripes in red and blue.', price: 120, sku: 'skin_striped' },
  dino: { id: 'dino', name: 'Dino', line: 'A green dino egg with spots.', price: 200, sku: 'skin_dino' },
  golden: { id: 'golden', name: 'Golden', line: 'Shiny gold, for looks only.', price: 300, sku: 'skin_golden' },
  // 2026-11-16: a Christmas pair and one for each world theme
  bauble: { id: 'bauble', name: 'Bauble', line: 'A shiny red Christmas bauble.', price: 160, sku: 'skin_bauble' },
  candy: { id: 'candy', name: 'Candy Cane', line: 'Peppermint stripes, red and green.', price: 160, sku: 'skin_candy' },
  frosty: { id: 'frosty', name: 'Frosty', line: 'Frosted ice and snowflakes.', price: 180, sku: 'skin_frosty' },
  galaxy: { id: 'galaxy', name: 'Galaxy', line: 'A swirl of stars from the crystal caves.', price: 240, sku: 'skin_galaxy' },
  lava: { id: 'lava', name: 'Lava Rock', line: 'Dark rock with glowing cracks.', price: 240, sku: 'skin_lava' },
  thunder: { id: 'thunder', name: 'Thunder', line: 'Storm blue with a lightning bolt.', price: 200, sku: 'skin_thunder' },
  treasure: { id: 'treasure', name: 'Treasure Map', line: 'X marks the spot.', price: 220, sku: 'skin_treasure' },
  pearl: { id: 'pearl', name: 'Pearl', line: 'A pearly shell with a rainbow sheen.', price: 260, sku: 'skin_pearl' },
  gator: { id: 'gator', name: 'Gator', line: 'Green scales and a pale belly.', price: 220, sku: 'skin_gator' },
  robot: { id: 'robot', name: 'Robo Egg', line: 'Steel plates, rivets and blinking lights.', price: 280, sku: 'skin_robot' },
};
export const SKIN_ORDER = ['classic', 'speckled', 'striped', 'dino', 'bauble', 'candy', 'frosty', 'galaxy', 'lava', 'thunder', 'treasure', 'pearl', 'gator', 'robot', 'golden'];

export function ownsSkin(wallet, id) {
  if (id === 'classic') return true;
  return !!(wallet && Array.isArray(wallet.skins) && wallet.skins.includes(id));
}

export function equippedSkin(wallet) {
  return wallet && ownsSkin(wallet, wallet.skin) && SKINS[wallet.skin] ? wallet.skin : 'classic';
}

export function canAffordSkin(wallet, id) {
  return !!(SKINS[id] && wallet && !ownsSkin(wallet, id) && wallet.coins >= SKINS[id].price);
}

// Buy a skin (and equip it right away). New wallet, or null if unknown / owned / too poor.
export function buySkin(wallet, id) {
  if (!canAffordSkin(wallet, id)) return null;
  const skins = Array.isArray(wallet.skins) ? wallet.skins : ['classic'];
  return { ...wallet, coins: wallet.coins - SKINS[id].price, skins: [...skins, id], skin: id };
}

// Equip an owned skin. New wallet, or null if not owned.
export function equipSkin(wallet, id) {
  if (!SKINS[id] || !ownsSkin(wallet, id)) return null;
  return { ...wallet, skin: id };
}

// ---------------------------------------------------------------- star chests
// Every 15 stars unlocks a chest on the level map: some coins plus one booster.
export const STARS_PER_CHEST = 15;
export const CHEST_COUNT = 6; // 90 stars = 30 levels x 3

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
    reward: { coins: 30 + 10 * index, booster: CHEST_BOOSTS[index % CHEST_BOOSTS.length] },
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
  if (BOOSTERS[id]) {
    if (ownedCount(w, id) < MAX_OWNED) w.owned[id] = ownedCount(w, id) + 1;
    else w.coins += BOOSTERS[id].price;
  }
  w.charges = Math.min(MAX_CHARGES, (w.charges || 0) + 1);
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
  return { id: bossId, coins: 150 + 50 * w, booster: TREASURE_BOOSTS[w], charges: w < 5 ? 2 : 3 };
}
export function treasureOpened(wallet, bossId) { return !!(wallet && Array.isArray(wallet.treasures) && wallet.treasures.includes(bossId)); }
// Returns a new wallet with the treasure paid, or null when it was opened already (never pays twice)
export function openBossTreasure(wallet, bossId) {
  const T = bossTreasure(bossId);
  if (!T || treasureOpened(wallet, bossId)) return null;
  const w = sanitizeWallet(wallet);
  w.coins += T.coins;
  if (BOOSTERS[T.booster]) {
    if (ownedCount(w, T.booster) < MAX_OWNED) w.owned[T.booster] = ownedCount(w, T.booster) + 1;
    else w.coins += BOOSTERS[T.booster].price;
  }
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
  const coins = [25, 30, 40, 30, 50, 35, 60][h % 7], charges = h % 3 === 0 ? 2 : 1;
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
  if (!k || k.premium || ownsHenSkin(w, id) || w.coins < k.price) return null;
  w.coins -= k.price; w.henSkins = [...w.henSkins, id]; w.henSkin = id;
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
// a Skip Ticket skips a level the player is stuck on (the fail card offers it after STUCK_FAILS losses).
export const MAX_TICKETS = 99;
export const ITEMS = {
  ally: { id: 'ally', name: 'Ally Ticket', line: 'Call the rooster or the goose this try, no ad needed.', price: 80 },
  goldhour: { id: 'goldhour', name: 'Golden Hour', line: 'Double coins on your next 3 wins.', price: 120, wins: 3 },
  skip: { id: 'skip', name: 'Skip Ticket', line: 'Skip a level after 3 losses on it.', price: 150 },
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
  if (!p || ownsChick(w, id) || w.coins < p) return null;
  w.coins -= p; w.chicks = [...w.chicks, id];
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
export const IAP = {
  coins_250: { sku: 'coins_250', usd: 0.99, type: 'consumable', name: 'Pouch of coins', coins: 250 },
  coins_850: { sku: 'coins_850', usd: 2.99, type: 'consumable', name: 'Bag of coins', coins: 850 },
  coins_1500: { sku: 'coins_1500', usd: 4.99, type: 'consumable', name: 'Sack of coins', coins: 1500, tag: 'Most popular' },
  coins_3300: { sku: 'coins_3300', usd: 9.99, type: 'consumable', name: 'Chest of coins', coins: 3300, tag: 'Best value' },
  coins_7000: { sku: 'coins_7000', usd: 19.99, type: 'consumable', name: 'Vault of coins', coins: 7000 },
  starter_nest: { sku: 'starter_nest', usd: 1.99, type: 'once', name: 'Starter Nest', line: '600 coins, 3 Chick Charges, 2 of every boost and the Cocoa Hen.', coins: 600, charges: 3, boosts: 2, hen: 'cocoa' },
  bundle_helper: { sku: 'bundle_helper', usd: 3.99, type: 'consumable', name: 'Helper Bundle', line: '1000 coins, 5 Chick Charges, 3 Ally Tickets and 2 of every boost.', coins: 1000, charges: 5, ally: 3, boosts: 2 },
  bundle_flock: { sku: 'bundle_flock', usd: 9.99, type: 'consumable', name: 'Flock Bundle', line: '3000 coins, 15 Chick Charges, 10 Ally Tickets and the six level power chicks.', coins: 3000, charges: 15, ally: 10, chicks: true },
  season_pack: { sku: 'season_pack', usd: 4.99, type: 'once', name: 'Season Pack', line: 'A world outfit for the hen, the Frosty egg and 800 coins.', coins: 800, egg: 'frosty', seasonHen: true },
  egg_bank: { sku: 'egg_bank', usd: 1.99, type: 'consumable', name: 'Golden Egg Bank', line: 'Every win drops coins in. Crack it open for all of them.', bank: true },
  all_chicks: { sku: 'all_chicks', usd: 4.99, type: 'once', name: 'All Power Chicks', line: 'The six level power chicks, ready in every level with villains.', chicks: true },
  no_ads: { sku: 'no_ads', usd: 2.99, type: 'once', name: 'No Ads', line: 'No more ad breaks between levels. Bonus videos stay your choice.', noInter: true },
  eggscape_premium: { sku: 'eggscape_premium', usd: 3.99, type: 'once', name: 'Unlock Everything', line: 'No ads ever. Every level, all six power chicks, the Golden Hen and 1500 coins.', coins: 1500, chicks: true, premium: true },
};
export const COIN_PACKS = ['coins_250', 'coins_850', 'coins_1500', 'coins_3300', 'coins_7000'];
export const usdHint = (sku) => (IAP[sku] ? '$' + IAP[sku].usd.toFixed(2) : '');

// the world outfit a Season Pack gives: Ski Champ, or the first world outfit the player does not own yet
export function seasonHen(w) {
  const outfits = HEN_SKIN_ORDER.filter((id) => HEN_SKINS[id].world);
  if (!ownsHenSkin(w, 'skier')) return 'skier';
  return outfits.find((id) => !ownsHenSkin(w, id)) || 'skier';
}

// Can this product be bought right now? (one-time products already owned, the bank before it is full enough)
export function iapAvailable(wallet, sku) {
  const P = IAP[sku], w = wallet || {};
  if (!P) return false;
  if (sku === 'starter_nest') return !w.starter;
  if (sku === 'season_pack') return !w.season;
  if (sku === 'egg_bank') return (w.bank || 0) >= BANK_OPEN;
  if (sku === 'all_chicks') return !w.noAds && CHICK_IDS.some((id) => !ownsChick(w, id));
  if (sku === 'no_ads') return !w.noInter && !w.noAds;
  if (sku === 'eggscape_premium') return !w.noAds;
  return true;
}

// the cheapest coin pack that covers a shortfall (the biggest one if none does)
export function packFor(short) {
  return COIN_PACKS.find((sku) => IAP[sku].coins >= short) || COIN_PACKS[COIN_PACKS.length - 1];
}

// the six level chicks added to what the player owns (a premium chick bought with coins is kept)
const withChicks = (have) => [...CHICK_IDS, ...(have || []).filter((id) => !CHICK_IDS.includes(id))];

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
    if (P.noInter) w.noInter = true;
    if (P.premium) w.noAds = true;
    if (P.chicks) w.chicks = withChicks(w.chicks);
    if (P.hen && !w.henSkins.includes(P.hen)) w.henSkins = [...w.henSkins, P.hen];
    if (sku === 'starter_nest') w.starter = true;
    if (P.seasonHen) {
      const hen = w.season || seasonHen(w);
      w.season = hen;
      if (!w.henSkins.includes(hen)) w.henSkins = [...w.henSkins, hen];
    }
    if (P.egg && !w.skins.includes(P.egg)) w.skins = [...w.skins, P.egg];
  }
  if (!fresh) return { wallet: w, granted: false };
  w.coins += P.coins || 0;
  if (P.charges) { const k = Math.min(P.charges, MAX_CHARGES - w.charges); w.charges += k; w.coins += (P.charges - k) * CHARGE_ITEM.price; }
  if (P.boosts) addBoosts(w, P.boosts);
  if (P.ally) w.tickets = { ...w.tickets, ally: Math.min(MAX_TICKETS, w.tickets.ally + P.ally) };
  if (P.chicks && P.type === 'consumable') w.chicks = withChicks(w.chicks);
  if (P.bank) { w.coins += Math.max(BANK_OPEN, w.bank); w.bank = 0; } // the buy button only shows from BANK_OPEN coins up
  if (P.hen) w.henSkin = P.hen; // the new look is put on right away
  if (P.seasonHen) w.henSkin = w.season;
  if (P.premium) w.henSkin = 'golden';
  w.tokens = [...w.tokens, tok].slice(-MAX_TOKENS);
  w.payer = true;
  w.spend = Math.round((w.spend + P.usd) * 100) / 100;
  w.lastBuyAt = now || w.lastBuyAt;
  return { wallet: w, granted: true };
}
