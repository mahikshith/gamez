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
    line: 'Adds 15 seconds to the fox’s fuse.',
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
};

// Stable display order for UI lists.
export const BOOSTER_ORDER = ['stone', 'golden', 'time', 'rewind', 'sponge'];

export const AD_REWARDS = {
  doubleCoins: 'Double the coins from this level',
  freeCoins: { coins: 25, cooldownSec: 180 },
};

export function defaultWallet() {
  return { coins: 0, owned: {}, skins: ['classic'], skin: 'classic', chests: 0 };
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
  const owned = w.owned && typeof w.owned === 'object' ? w.owned : {};
  for (const id of BOOSTER_ORDER) {
    const n = Math.min(MAX_OWNED, Math.max(0, Math.floor(Number(owned[id]) || 0)));
    if (n > 0) out.owned[id] = n;
  }
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
};
export const SKIN_ORDER = ['classic', 'speckled', 'striped', 'dino', 'golden'];

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
    reward: { coins: 30 + 10 * index, booster: BOOSTER_ORDER[index % BOOSTER_ORDER.length] },
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
  w.chests = Math.max(w.chests, chest.index + 1);
  return w;
}
