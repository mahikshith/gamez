// Refunds (0.8.17, mykee: "people could unlock this game ... play the entire game and ask for a refund"). The one-time
// purchases (Starter Nest, Unlock Everything, The Whole Coop) follow the store's own record: when the store stops listing
// a purchase the game had granted, it is taken back, gently, and only after two separate checks.
//
// The rule, pure (no window, no clock of its own; the Android shell feeds it, see ads.js window.__eggStore):
// - Every one-time grant is remembered here with its purchase token and what it really added to this save (the outfits,
//   eggs and chicks the player did not have yet, the coins it paid). A grant without a token (an older shell, a dev or
//   test unlock) is never tracked, so it is never taken back.
// - A check is the full list of one-time product ids the store lists for this account, sent only after a SUCCESSFUL
//   query (never on an error, never offline, never from a build whose products Play does not know).
// - A tracked purchase missing from TWO checks at least GUARD.gapMs apart is revoked: its unlock flags go, the items it
//   added go (equipped ones fall back to the defaults), its coins come back out of the purse only as far as the purse
//   goes. What the player bought with coins, stars, levels won and consumables are never touched. One calm line once.
// - Seen again (a flaky answer after all): the same purchase token brings it all back, the coins taken included.
//   Bought again: a new token, a normal purchase, everything comes back.
import { IAP, grantIap, sanitizeWallet } from './economy.js';

export const GUARD = { gapMs: 3600 * 1000 };
export const ONCE = Object.keys(IAP).filter((k) => IAP[k].type === 'once');

const list = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string') : []);
// a clean guard record (old saves have none)
export function clean(g) {
  const o = g && typeof g === 'object' ? g : {}, ents = {}, miss = {};
  for (const sku of ONCE) {
    const r = o.ents && o.ents[sku];
    if (r && typeof r === 'object' && typeof r.tok === 'string' && r.tok) {
      ents[sku] = { tok: r.tok, at: +r.at || 0, coins: Math.max(0, Math.floor(+r.coins || 0)), add: { hens: list(r.add && r.add.hens), eggs: list(r.add && r.add.eggs), chicks: list(r.add && r.add.chicks) }, off: +r.off || 0, took: Math.max(0, Math.floor(+r.took || 0)) };
    }
    if (o.miss && +o.miss[sku] > 0) miss[sku] = +o.miss[sku];
  }
  return { ents, miss, note: list(o.note).filter((s) => ONCE.includes(s)) };
}
const minus = (a, b) => list(a).filter((x) => !list(b).includes(x));
const union = (a, b) => [...list(a), ...minus(b, a)];

// A grant just happened (ads.js grant): before / after are the wallets around grantIap, granted: it paid now.
// -> { guard, wallet } (wallet: after, plus the coins a revoke had taken when the same purchase comes back)
export function onGrant(guard, sku, token, before, after, granted, now = 0) {
  const g = clean(guard);
  let w = after;
  if (!ONCE.includes(sku) || typeof token !== 'string' || !token) return { guard: g, wallet: w };
  const b = before || {}, a = after || {}, old = g.ents[sku];
  const add = { hens: minus(a.henSkins, b.henSkins), eggs: minus(a.skins, b.skins), chicks: minus(a.chicks, b.chicks) };
  if (old && old.tok === token) {
    if (old.off && old.took) w = { ...w, coins: (w.coins || 0) + old.took }; // a revoke the store now contradicts: undone
    g.ents[sku] = { ...old, off: 0, took: 0, add: { hens: union(old.add.hens, add.hens), eggs: union(old.add.eggs, add.eggs), chicks: union(old.add.chicks, add.chicks) } };
  } else {
    g.ents[sku] = { tok: token, at: now, coins: granted ? IAP[sku].coins || 0 : 0, add, off: 0, took: 0 };
  }
  delete g.miss[sku];
  return { guard: g, wallet: w };
}

// take one purchase back. Exported for the tests.
export function revoke(guard, wallet, sku, now = 0) {
  const g = clean(guard), rec = g.ents[sku], P = IAP[sku];
  if (!rec || rec.off || !P) return { guard: g, wallet };
  let w = sanitizeWallet(wallet);
  if (P.premium) w.noAds = false;
  if (P.collector) w.collector = false;
  if (sku === 'starter_nest') w.starter = false;
  const keep = (id) => id === 'classic';
  w.henSkins = w.henSkins.filter((id) => keep(id) || !rec.add.hens.includes(id));
  w.skins = w.skins.filter((id) => keep(id) || !rec.add.eggs.includes(id));
  w.chicks = w.chicks.filter((id) => !rec.add.chicks.includes(id));
  const took = Math.min(w.coins, rec.coins);
  w.coins -= took;
  // whatever another one-time purchase still held gives stays (its entitlement, no coins)
  for (const s of ONCE) if (s !== sku && g.ents[s] && !g.ents[s].off) w = grantIap(w, s, '').wallet;
  w = sanitizeWallet(w); // equipped things no longer owned fall back to the defaults
  g.ents[sku] = { ...rec, off: now || 1, took };
  delete g.miss[sku];
  if (!g.note.includes(sku)) g.note.push(sku);
  return { guard: g, wallet: w };
}

// A successful store check. owned: the one-time product ids the store lists now. Anything else (an error, a cache miss,
// a string that is not a list) changes nothing. -> { guard, wallet, revoked: [sku] }
export function check(guard, wallet, owned, now) {
  const g = clean(guard);
  if (!Array.isArray(owned) || !(now > 0)) return { guard: g, wallet, revoked: [] };
  const have = list(owned);
  let G = g, w = wallet;
  const revoked = [];
  for (const sku of ONCE) {
    const rec = G.ents[sku];
    if (!rec || rec.off) continue;
    if (have.includes(sku)) { delete G.miss[sku]; continue; }
    const first = G.miss[sku];
    if (!first) { G.miss[sku] = now; continue; } // once is never enough: one flaky answer never punishes a payer
    if (now - first < GUARD.gapMs) continue;
    const r = revoke(G, w, sku, now);
    G = r.guard; w = r.wallet; revoked.push(sku);
  }
  return { guard: G, wallet: w, revoked };
}

// the line said once for each purchase taken back (and then forgotten)
export const noteLine = (sku) => `Your ${IAP[sku] ? IAP[sku].name : 'purchase'} purchase was refunded, so it has been removed.`;
export function takeNote(guard) {
  const g = clean(guard), sku = g.note.shift();
  return { guard: g, line: sku ? noteLine(sku) : '' };
}
