// The combo album (0.8.17): one page for every power combo in the game (sim/powers2.js COMBOS). Pure rules here, the
// page is drawn in main.js (drawAlbum).
// - A combo is found the first time it fires in play: main.js's COMBO! card sets save.seen['combo_<id>'] (P2_API.combo).
// - A find is "new" until its tile was shown on the album page (save.seen['album:<id>']): the new mark on the way in
//   (home's Extras button, the album row on the Extras page) leads to that tile.
// - An unfound combo shows a dark silhouette and a hint that names ONE of its two powers. The hints are spread over the
//   powers so two locked tiles rarely name the same one.
// - The whole album found: a one-time prize, the Mint's 'album' faucet (src/engine/mint.js), claimed on the page
//   (save.seen.albumPrize).
import { COMBOS } from './sim/powers2.js';
import { FAUCETS } from './engine/mint.js';

export const ALBUM_PRIZE = FAUCETS.album.coins;

// which of the two powers each locked tile names: a different power on every tile when the pairs allow it (a small
// matching, tried in COMBOS order with the first power first), else the first power
const HINT = (() => {
  const out = {}, used = new Set();
  const go = (i) => {
    if (i >= COMBOS.length) return true;
    const C = COMBOS[i];
    for (const p of [C.a, C.b]) if (!used.has(p)) { used.add(p); out[C.id] = p; if (go(i + 1)) return true; used.delete(p); }
    return false;
  };
  if (!go(0)) for (const C of COMBOS) out[C.id] = C.a;
  return out;
})();
export const hintPower = (id) => HINT[id] || null;
// "Something with Iron shell..." (nameOf: power id -> its name on the power card)
export const hintText = (id, nameOf) => `Something with ${nameOf(HINT[id])}...`;

// the album as the page shows it: tiles in discovery order, the count, what is new, whether the prize waits
export function albumOf(seen) {
  const S = seen && typeof seen === 'object' ? seen : {};
  const list = COMBOS.map((C) => {
    const found = !!S['combo_' + C.id];
    return { id: C.id, a: C.a, b: C.b, name: C.name, line: C.line, found, fresh: found && !S['album:' + C.id] };
  });
  const n = list.filter((c) => c.found).length, total = list.length;
  return { list, n, total, done: n === total, fresh: list.filter((c) => c.fresh).map((c) => c.id), prize: n === total && !S.albumPrize };
}
// the page showed these tiles: their new marks go (returns the new seen object)
export const albumSeen = (seen, ids) => { const o = { ...(seen || {}) }; for (const id of ids) o['album:' + id] = 1; return o; };
