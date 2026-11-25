// The 60-level road (0.8.17): ids, the level data, and the one-time move of a save from the 50-level road.
// node tools/test-road.mjs
import * as R from '../src/road.js';
import { LEVELS } from '../src/data/levels.js';
import { SPECS } from '../src/data/specs.js';
import { HARD_IDS } from '../src/sim/sim.js';
import * as E from '../src/economy.js';
import { STRIKES } from '../src/data/strikes.js';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };

// ---- the numbering
{
  const ids = Array.from({ length: 50 }, (_, i) => R.fromOld(i + 1));
  ok(ids.slice(0, 5).join() === '1,2,3,4,5' && R.fromOld(6) === 7 && R.fromOld(9) === 11 && R.fromOld(10) === 12 && R.fromOld(50) === 60, 'world 1 keeps 1..5; old 6 -> 7, 9 -> 11, 10 -> 12, 50 -> 60');
  ok(new Set(ids).size === 50 && ids.every((id, i) => R.oldOf(id) === i + 1), 'the map is one to one and oldOf undoes it');
  const fresh = Array.from({ length: 60 }, (_, i) => i + 1).filter(R.isNew);
  ok(fresh.join() === '6,10,16,22,28,34,40,46,52,58', 'the ten new levels: 6 (world 1, after its boss) and the fourth of every other world');
  ok(Array.from({ length: 10 }, (_, w) => R.bossOf(w)).join() === '5,12,18,24,30,36,42,48,54,60' && HARD_IDS.join() === '11,17,23,29,35,41,47,53,59', 'bosses and hard levels');
}

// ---- the level data
{
  ok(LEVELS.length === 60 && SPECS.length === 60 && LEVELS.every((L, i) => L.id === i + 1 && SPECS[i].id === L.id), 'sixty levels, ids 1..60 in road order, spec and level alike');
  ok(LEVELS.every((L) => L.world === R.worldOfId(L.id) + 1), 'every level is in its world (six a world)');
  ok(LEVELS.filter((L) => L.boss).map((L) => L.id).join() === E.BOSS_TREASURE_IDS.join(), 'the boss levels are the treasure chests\' bosses');
  ok(LEVELS.every((L) => !R.isNew(L.id) || (L.name && L.theme && L.rings && L.rings.length && L.tip)), 'every new level has a name, a theme, rings and a tip');
  ok(SPECS.every((S) => R.isNew(S.id) ? S.gid == null : (S.gid || S.id) === R.oldOf(S.id)), 'an old level\'s spec carries its old number (gid) for the generator; a new one none');
  ok(STRIKES.filter((S) => !S.premium).map((S) => S.unlock).join() === '6,13,19,25,31,37', 'each power chick joins the level after a boss');
  const seen = new Set();
  ok(LEVELS.every((L) => { const k = L.seed; if (seen.has(k)) return false; seen.add(k); return true; }), 'no two levels share a seed');
}

// ---- the save
{
  const old = {
    v: 3, unlocked: 24, stars: { 1: 3, 2: 2, 5: 3, 6: 2, 9: 1, 10: 3, 11: 2, 23: 1, e7: 2, h10: 1 }, best: { 10: 3400, e7: 900 }, bonus: { 10: 1 },
    intro: { 2: 1, 6: 1, 11: 1 }, skipped: { 14: 1 }, gates: { 1: 1 }, seen: { fire_red: 1, 'strip:12': 1, 'v:snake': 1 },
    wallet: { coins: 300, treasures: [5, 10] }, dir: { att: { 9: { tries: 3, wins: 0 } }, trials: { lv: { 22: 1 }, skins: [] } },
    offers: { lvAd: { 12: 1 }, lvDeclined: {}, lvHelper: { 23: 1 } }, spin: { cheered: [9, 21] },
    eng: { tal: { lv: { 6: [4, 1, 0, 0, 0, 0] }, end: [{ sc: 'fail', lv: 9 }] }, pulse: { res: [{ id: 23, w: 1 }] } },
  };
  const s = R.migrateRoad(JSON.parse(JSON.stringify(old)));
  ok(s.road === R.ROAD_V && s.stars[1] === 3 && s.stars[5] === 3 && s.stars[7] === 2 && s.stars[11] === 1 && s.stars[12] === 3 && s.stars[13] === 2 && s.stars[27] === 1, 'stars move with their levels');
  ok(!s.stars[6] && !s.stars[10] && s.stars.e8 === 2 && s.stars.h12 === 1, 'the new levels have none; Easy and Hard keys move too');
  ok(s.best[12] === 3400 && s.best.e8 === 900 && s.bonus[12] === 1 && s.intro[7] && s.intro[13] && s.intro[2] && !s.intro[6] && s.skipped[17], 'best, bonus, intro and skipped move');
  ok(s.unlocked === 28, 'old frontier 24 (23 finished) -> 28: the level after new 27; the new ones behind are open');
  ok(s.wallet.treasures.join() === '5,12' && s.gates[1] === 1, 'opened treasures follow their bosses; a bought gate stays (worlds keep their number)');
  ok(s.seen['strip:14'] && !s.seen['strip:12'] && s.seen.fire_red && s.seen['v:snake'], 'only level keys in seen move');
  ok(s.dir.att[11].tries === 3 && !s.dir.att[9] && s.dir.trials.lv[26] && s.offers.lvAd[14] && s.offers.lvHelper[27] && s.spin.cheered.join() === '11,25', 'the Director, the offers and the spin follow');
  ok(s.eng.tal.lv[7] && s.eng.tal.end[0].lv === 11 && s.eng.pulse.res[0].id === 27, 'the engine\'s tallies follow');
  ok(R.migrateRoad(s) === s, 'it runs once (save.road)');
  ok(R.migrateRoad({ unlocked: 50 }).unlocked === 60 && R.migrateRoad({ unlocked: 1 }).unlocked === 1 && R.migrateRoad({}).unlocked === 1 && R.migrateRoad({ unlocked: 6 }).unlocked === 6 && R.migrateRoad({ unlocked: 7 }).unlocked === 8, 'frontiers: 50 -> 60, nothing played stays 1, just past the weasel stays 6 (Midnight Raid), old 7 -> 8');
  ok(old.stars[6] === 2 && old.unlocked === 24, 'the old save object is not touched');
}

console.log(bad ? `\n${bad} FAILED` : '\nall road checks passed');
process.exit(bad ? 1 : 0);
