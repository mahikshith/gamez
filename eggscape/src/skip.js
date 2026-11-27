// 2026-11-23 (mykee: "we also need to have a skip button in the menu for the users to skip the level ... when the user
// try to skip, we might want to show a short ad kind of a thing"): the pause page's "Skip level", paid with one rewarded
// video the player chooses. The rule lives here, pure, so tools/test-skip.mjs can check it.
//
// A skip counts the level as passed with no stars and no coins: the next level opens exactly as a win would open it
// (save.unlocked), the level is marked skipped (the map shows it open with three empty stars, the Play button moves on),
// and the star streak ends, as when a level is left unwon. Nothing is paid out: no coins, stars, best score, treasure,
// goals or streak boosters. A skipped level stays playable for its stars. World star gates still apply after it.
//
// lv: { id, count (levels in the journey), journey (a real journey level: not a demo, practice, Daily or Extras vault),
//       coaching (level 1's first-run coach is teaching), won (best stars > 0 in any mode) }
export function canSkip(save, lv) {
  if (!lv || !lv.journey || lv.coaching || lv.won) return false;
  if (!(lv.id >= 1) || !(lv.count > 0) || lv.id >= lv.count) return false; // the last level has nothing after it
  return !(save.skipped && save.skipped[lv.id]); // never twice
}

// applies the skip to the save (it mutates save, like the rest of the save code); false when not allowed
export function applySkip(save, lv) {
  if (!canSkip(save, lv)) return false;
  save.unlocked = Math.max(save.unlocked || 1, Math.min(lv.count, lv.id + 1)); // the same line a win runs (recordResult)
  save.skipped = { ...(save.skipped || {}), [lv.id]: 1 };
  save.streak = 0; // the 3-star streak ends
  if (save.dir && typeof save.dir === 'object') { save.dir.hot = 0; save.dir.hotLost = 0; } // the win streak too (and no "rewind keeps it")
  return true;
}

export const isSkipped = (save, id) => !!(save && save.skipped && save.skipped[id]);

// 0.8.14 (mykee: "along with the retry ... we might want to show an option to skip the level as well"): the fail card
// offers Skip level from the first loss, whenever canSkip says yes. One skip, one ending (applySkip and the trip to the
// next level, the same as the pause page); this says how it can be paid, in the order the buttons show:
//   a Skip Ticket the player owns, else one rewarded video (Premium: free, rewarded() handles it), then coins.
// 0.8.19 (mykee: "we can always provide a skip button in the pause menu for a set of coins or watching an ad"): coins
// are always the second way (economy.js SKIP_PRICE), on the pause page and the fail card alike. Every way costs
// something or shows a video, so there is none before level 3 is won (o.early: director.js earlyDays).
// o: { early, tickets (Skip Tickets owned) }. [] when the level cannot be skipped.
export function skipWays(save, lv, o = {}) {
  if (o.early || !canSkip(save, lv)) return [];
  return [(o.tickets | 0) > 0 ? 'ticket' : 'ad', 'coins'];
}
