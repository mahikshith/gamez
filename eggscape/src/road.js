// The road (0.8.17, mykee: "instead of having 5 levels per world we could include more for each world"): ten worlds of
// six levels. Level ids are the position on the road (1..60), so code keyed by a level id keeps working. World 1 keeps
// its tuned first five (ids 1..5, the weasel boss at 5) and gains Midnight Raid as level 6; in worlds 2 to 10 the new
// level is the fourth, so the hard level and the boss stay last. Pure data and functions: no imports.
export const PER_ENV = 6, WORLD_N = 10, ROAD_N = PER_ENV * WORLD_N;
const OLD_PER = 5, OLD_N = 50;

// world w (0-based) -> the id of its first level, its boss, the hard level before the boss (none in world 1)
export const firstOf = (w) => w * PER_ENV + 1;
export const bossOf = (w) => (w === 0 ? 5 : (w + 1) * PER_ENV);
export const hardOf = (w) => (w === 0 ? 0 : bossOf(w) - 1);
export const worldOfId = (id) => Math.floor((id - 1) / PER_ENV);

// an id on the 50-level road -> its id on this one
export function fromOld(id) {
  id = Math.floor(+id);
  if (!(id >= 1 && id <= OLD_N)) return 0;
  const w = Math.floor((id - 1) / OLD_PER), k = (id - 1) % OLD_PER;
  return w === 0 ? id : w * PER_ENV + [1, 2, 3, 5, 6][k];
}
// an id on this road -> the id it had on the 50-level road (0: one of the ten new levels)
const BACK = {};
for (let i = 1; i <= OLD_N; i++) BACK[fromOld(i)] = i;
export const oldOf = (id) => BACK[id] || 0;
export const isNew = (id) => id >= 1 && id <= ROAD_N && !BACK[id];

// a level's backdrop look (themes.js createBackdrop: seed = id * 97). An old level keeps the scenery seed and the
// time-of-day variant it had at its old number; a new one gets its own seed and a variant of its own (Midnight Raid:
// the farm by moonlight, ART.farm's sixth variant). Anything off the road (Daily, Wonder, demos) is left as it was.
export function lookOf(id) {
  const o = oldOf(id);
  if (o) return { seed: o * 97, slot: (o - 1) % OLD_PER };
  if (isNew(id)) return { seed: (200 + id) * 97, slot: id === 6 ? 5 : 1 };
  return { seed: id * 97, slot: id > 0 ? (id - 1) % OLD_PER : 0 };
}

// ---- save migration (one pure function; main.js loadSave runs it once, save.road marks it done)
// Every field keyed by a level id moves to the new numbering: stars / best / bonus (keys '12', 'e12', 'h12'), intro,
// skipped, the Lucky Spin's cheer-ups, the Director's tries and freebies per level, the offer engine's per-level marks, the boss treasures opened,
// the engine's per-level tallies and recent results; `unlocked` becomes the new frontier: a player who had finished old
// level N may play new level fromOld(N) + 1; the new levels behind them are open and unplayed.
export const ROAD_V = 1;
const reKey = (k) => { const m = /^([a-z]?)(\d+)$/.exec(String(k)); if (!m) return k; const n = fromOld(+m[2]); return n ? m[1] + n : k; };
const mapObj = (o) => { if (!o || typeof o !== 'object' || Array.isArray(o)) return o; const out = {}; for (const [k, v] of Object.entries(o)) out[reKey(k)] = v; return out; };
export function migrateRoad(s) {
  if (!s || typeof s !== 'object' || s.road >= ROAD_V) return s;
  const out = { ...s, road: ROAD_V };
  for (const k of ['stars', 'best', 'bonus', 'intro', 'skipped']) if (s[k]) out[k] = mapObj(s[k]);
  if (s.seen && typeof s.seen === 'object') { // only its 'strip:12' keys (the level page's booster strip) name a level
    const sn = {}; for (const [k, v] of Object.entries(s.seen)) { const m = /^strip:(\d+)$/.exec(k); sn[m && fromOld(+m[1]) ? 'strip:' + fromOld(+m[1]) : k] = v; } out.seen = sn; }
  const u = Math.min(OLD_N, Math.floor(+s.unlocked || 1)); // (the old road capped it at 50: level 50 open, won or not)
  out.unlocked = u <= 1 ? 1 : fromOld(u - 1) + 1;
  if (s.dir && typeof s.dir === 'object') {
    out.dir = { ...s.dir, att: mapObj(s.dir.att) };
    if (s.dir.trials && typeof s.dir.trials === 'object') out.dir.trials = { ...s.dir.trials, lv: mapObj(s.dir.trials.lv) };
  }
  if (s.offers && typeof s.offers === 'object') out.offers = { ...s.offers, lvAd: mapObj(s.offers.lvAd), lvDeclined: mapObj(s.offers.lvDeclined), lvHelper: mapObj(s.offers.lvHelper) };
  if (s.spin && Array.isArray(s.spin.cheered)) out.spin = { ...s.spin, cheered: s.spin.cheered.map((id) => fromOld(id) || id) }; // levels a cheer-up spin was given on
  if (s.wallet && Array.isArray(s.wallet.treasures)) out.wallet = { ...s.wallet, treasures: s.wallet.treasures.map((id) => fromOld(id) || id) };
  if (s.eng && typeof s.eng === 'object') {
    const e = { ...s.eng };
    if (e.tal && typeof e.tal === 'object') e.tal = { ...e.tal, lv: mapObj(e.tal.lv), end: Array.isArray(e.tal.end) ? e.tal.end.map((q) => (q && q.lv ? { ...q, lv: fromOld(q.lv) || q.lv } : q)) : e.tal.end };
    if (e.pulse && Array.isArray(e.pulse.res)) e.pulse = { ...e.pulse, res: e.pulse.res.map((q) => (q && q.id ? { ...q, id: fromOld(q.id) || q.id } : q)) };
    out.eng = e;
  }
  return out;
}
