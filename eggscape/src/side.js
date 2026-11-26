// Side quests (0.8.17, mykee: "We could include the bonus levels kind of like a side quest. From the map we could build a
// different pathway where there could be bonus levels ... People could always skip them, but if we make those bonus levels
// even tougher, then users could earn more points."). One Wonder Vault per world, on a short trail off the road at the
// world's fourth stop. It opens once that road level is won, pays coins (the Mint's sideQuest row) and its stars count in
// the map's star total (world gates, star chests). The road never needs it: PLAY never points at one.
// Pure: no DOM. main.js draws and runs it, tools/sim-players.mjs plays it, tools/test-mint.mjs checks the pay.
import { wonderByKey } from './data/wonder-levels.js';
import { FAUCETS } from './engine/mint.js';

export const BRANCH_K = 3; // the trail leaves the road at each world's fourth stop (level 4 in world 1: never before level 3 is won)
// world (0-based) -> its vault. A world whose vault is not in wonder-levels.js simply has no side path.
const PLAN = [
  { w: 0, key: 'hatch' }, { w: 1, key: 'mama' }, { w: 2, key: 'twin2' }, { w: 3, key: 'planet' }, { w: 4, key: 'twin' },
  { w: 5, key: 'mama2' }, { w: 6, key: 'plan' }, { w: 7, key: 'planet2' }, { w: 8, key: 'plan2' }, { w: 9, key: 'hatch2' },
];
export const SIDE = PLAN.filter((q) => wonderByKey(q.key)).map((q) => ({ ...q, at: q.w * 6 + BRANCH_K + 1, i: q.w * 6 + BRANCH_K, level: wonderByKey(q.key) }));
export const sideOf = (w) => SIDE.find((q) => q.w === w) || null;
export const sideByKey = (k) => SIDE.find((q) => q.key === k) || null;
export const SIDE_MAX = SIDE.length * 3; // the most bonus stars there are

const won = (save, id) => !!(save && save.stars && ['', 'e', 'h'].some((m) => (save.stars[m + id] || 0) > 0));
// open: its branch level is won (or every level is open: Unlock Everything, the test builds)
export const sideOpen = (save, q, all = false) => !!q && (all || won(save, q.at));
export const sideStars = (save, key) => Math.max(0, Math.min(3, Math.floor(+((save && save.wonder && save.wonder[key]) || 0))));
// the bonus stars of every side quest: they count in the map's total (main.js bestTotal)
export const sideTotal = (save) => SIDE.reduce((a, q) => a + sideStars(save, q.key), 0);
// what a side-quest win pays: its first win (save.side.paid has no mark for it yet) the Mint's `first`, later wins `replay`
export const sidePaid = (save, key) => !!(save && save.side && save.side.paid && save.side.paid[key]);
export function sideCoins(save, key) { const F = FAUCETS.sideQuest; return sidePaid(save, key) ? F.replay : F.first; }
// file a win: stars (best kept in save.wonder, as the Extras page always did), the first-win mark. -> { coins, fresh, stars, prev }
export function sideWin(save, key, stars) {
  const prev = sideStars(save, key), coins = sideCoins(save, key), fresh = !sidePaid(save, key);
  save.wonder = { ...(save.wonder || {}) };
  if (stars > prev) save.wonder[key] = stars;
  save.side = { ...(save.side || {}), paid: { ...((save.side && save.side.paid) || {}), [key]: 1 } };
  return { coins, fresh, stars, prev };
}
// the first open side quest a player has not seen opening yet (the map's reveal), or null
export function sideUnseen(save, all = false) {
  const seen = (save && save.side && save.side.seen) || {};
  return SIDE.find((q) => sideOpen(save, q, all) && !seen[q.key]) || null;
}
export function markSeen(save, key) { save.side = { ...(save.side || {}), seen: { ...((save.side && save.side.seen) || {}), [key]: 1 } }; }
