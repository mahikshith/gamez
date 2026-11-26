// Reset progress (0.8.17, Settings): the rule, pure. main.js asks twice (a card that says what goes and what stays, then a
// two-second hold), then calls resetSave and starts again on the title.
// Erased: levels, stars, coins, power-ups, Chick Charges, tickets, hens, eggs and chicks won or bought with coins, the
// Lucky Spin, the combo album and every "seen" mark.
// Kept: the settings (sound, music, feel, ring speed, difficulty, graphics), the age answer (child-safe mode), the
// game's day (src/clock.js, so a reset is no way to open today's gifts again, nor today's claims), the support id, the
// reminder answer, and every real-money purchase: the one-time products come back here through grantIap's restore path
// (no token: the unlock only, no coins twice), and the store's own restore confirms them again when the game asks it
// (ads.restore, Monetization.restore on Android). The refund record (src/guard.js) stays with them.
import { grantIap, sanitizeWallet } from './economy.js';
import { clean as guardClean, ONCE } from './guard.js';

export const RESET_KEEP = ['sfx', 'music', 'vibe', 'shake', 'calm', 'ringSpeed', 'rsDef', 'gfx', 'fps', 'gfxStep', 'saver', 'showFps', 'mode', 'age', 'clock', 'sid', 'real', 'adDay', 'adClaim', 'mint'];
// today's claims in the wallet (a reset must not hand them out again) and the purchase history
const WALLET_KEEP = ['daily', 'premDay', 'sampleDay', 'sampleId', 'tokens', 'payer', 'spend', 'lastBuyAt', 'noInter'];

// the one-time purchases this save holds: the ones the refund guard tracks (and has not taken back), plus an unlock
// granted before the guard existed (an older shell's Unlock Everything, a Starter Nest)
export function purchasesOf(old) {
  const o = old || {}, w = sanitizeWallet(o.wallet), g = guardClean(o.guard);
  const out = ONCE.filter((k) => g.ents[k] && !g.ents[k].off);
  if (w.noAds && !out.some((k) => k === 'eggscape_premium' || k === 'eggscape_collector')) out.push('eggscape_premium');
  if (w.starter && !out.includes('starter_nest')) out.push('starter_nest');
  return out;
}

// old: the save now; fresh: a brand-new save (main.js defaultSave()). Returns the save to start again with.
export function resetSave(old, fresh) {
  const o = old || {}, s = { ...fresh };
  for (const k of RESET_KEEP) if (o[k] !== undefined) s[k] = o[k];
  if (o.eng && o.eng.her) s.eng = { her: o.eng.her }; // the reminder answer
  s.seen = { ...(s.seen || {}), ...(o.seen && o.seen.setOpen ? { setOpen: 1 } : {}) };
  const ow = sanitizeWallet(o.wallet);
  let w = sanitizeWallet(s.wallet);
  for (const k of WALLET_KEEP) w[k] = ow[k];
  const skus = purchasesOf(o);
  for (const sku of skus) w = grantIap(w, sku, '').wallet;
  s.wallet = w;
  s.guard = guardClean(o.guard);
  return s;
}
