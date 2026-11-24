// The Tally: what was put in front of the player and what he did with it (0.8.15, mykee: "we maintain a separate
// file on how users are interacting ... think one more time, do we need to add anything else in the logs"). Counts
// only, kept on the phone, and they travel only inside the speed log the player shares himself:
//   b    every tracked button and offer: [times it was on a page he saw, times he tapped it]
//   sc   seconds on each screen (map, level card, play, win, fail, shop ...)
//   lv   one row per level: [tries, wins, seconds played, losses one egg short, Rewinds, boosters used]
//   end  where the last sessions ended: the screen, the level, and whether the last run was won
// The simulated players (tools/sim-players.mjs) are tuned from these rows (tools/read-log.mjs files them in players/real.json).
import { slot } from './hub.js';

export const TALLY = { ids: 90, levels: 80, screens: 20, ends: 12, maxSecs: 600 }; // one visit to a screen never counts more than maxSecs (a phone left lying)
const int = (v) => Math.max(0, Math.floor(Number(v) || 0));
const key = (k) => String(k == null ? '' : k).replace(/[^\w:.-]/g, '').slice(0, 28);
const SAFE = new WeakSet();
export function talState(save) {
  const cur = slot(save, 'tal');
  if (cur && SAFE.has(cur)) return cur;
  const o = cur && typeof cur === 'object' ? cur : {}, b = {}, sc = {}, lv = {};
  for (const [k, v] of Object.entries(o.b && typeof o.b === 'object' ? o.b : {}).slice(0, TALLY.ids)) if (key(k) && Array.isArray(v)) b[key(k)] = [int(v[0]), int(v[1])];
  for (const [k, v] of Object.entries(o.sc && typeof o.sc === 'object' ? o.sc : {}).slice(0, TALLY.screens)) if (key(k)) sc[key(k)] = int(v);
  for (const [k, v] of Object.entries(o.lv && typeof o.lv === 'object' ? o.lv : {}).slice(0, TALLY.levels)) if (int(k) > 0 && Array.isArray(v)) lv[int(k)] = [0, 1, 2, 3, 4, 5].map((i) => int(v[i]));
  const end = (Array.isArray(o.end) ? o.end : []).filter((e) => e && typeof e === 'object').slice(-TALLY.ends).map((e) => ({ sc: key(e.sc), lv: int(e.lv), w: e.w ? 1 : 0, t: int(e.t) }));
  const s = { b, sc, lv, end, shop: { n: int(o.shop && o.shop.n), first: int(o.shop && o.shop.first) } };
  save.eng.tal = s; SAFE.add(s);
  return s;
}
const cell = (T, id) => { const k = key(id); if (!k) return null; if (!T.b[k]) { if (Object.keys(T.b).length >= TALLY.ids) return null; T.b[k] = [0, 0]; } return T.b[k]; };
// a tracked button or offer was on a page he saw (the caller counts one per visit of that page, not one per frame)
export function seen(save, id) { const c = cell(talState(save), id); if (c) c[0]++; }
// he tapped it
export function took(save, id) { const c = cell(talState(save), id); if (c) { c[1]++; if (c[0] < c[1]) c[0] = c[1]; } }
// seconds spent on a screen; the shop also notes how often it was opened and at which level first
export function screen(save, name, secs, level = 0) {
  const T = talState(save), k = key(name); if (!k) return;
  if (T.sc[k] == null && Object.keys(T.sc).length >= TALLY.screens) return;
  T.sc[k] = int((T.sc[k] || 0) + Math.min(TALLY.maxSecs, Math.max(0, Number(secs) || 0)));
  if (k === 'store') { T.shop.n++; if (!T.shop.first) T.shop.first = int(level) || 1; }
}
// a run ended. r: { id, won, secs, near }, x: { rewound, boosts }
export function level(save, r = {}, x = {}) {
  const T = talState(save), id = int(r.id); if (!id) return;
  if (!T.lv[id]) { if (Object.keys(T.lv).length >= TALLY.levels) return; T.lv[id] = [0, 0, 0, 0, 0, 0]; }
  const L = T.lv[id];
  L[0]++; if (r.won) L[1]++; L[2] += int(r.secs); if (!r.won && r.near) L[3]++; if (x.rewound) L[4]++; L[5] += int(x.boosts);
}
// the game went to the background: where he was
export function leave(save, sc, lv, won, now = Date.now()) { const T = talState(save); T.end = [...T.end, { sc: key(sc), lv: int(lv), w: won ? 1 : 0, t: int(now) }].slice(-TALLY.ends); }

// ---- for the speed log
const rate = (c) => (c[0] ? Math.round((c[1] * 100) / c[0]) : 0);
// the whole record, small enough to travel (a few kB)
export function table(save) { const T = talState(save); return { b: T.b, sc: T.sc, lv: T.lv, end: T.end, shop: T.shop }; }
// one line: the buttons shown most with how often they were taken, the shop, where time went, where sessions ended
export function line(save) {
  const T = talState(save);
  const b = Object.entries(T.b).sort((a, c) => c[1][0] - a[1][0]).slice(0, 10).map(([k, c]) => `${k} ${c[1]}/${c[0]} (${rate(c)}%)`).join(', ');
  const all = Object.values(T.sc).reduce((a, v) => a + v, 0) || 1, sc = Object.entries(T.sc).sort((a, c) => c[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${Math.round((v * 100) / all)}%`).join(' ');
  const ends = {}; for (const e of T.end) ends[e.sc] = (ends[e.sc] || 0) + 1;
  const hard = Object.entries(T.lv).filter(([, L]) => L[0] >= 3).sort((a, c) => c[1][0] - c[1][1] - (a[1][0] - a[1][1])).slice(0, 3).map(([id, L]) => `L${id} ${L[1]}/${L[0]}`).join(' ');
  return `taken/shown: ${b || 'nothing yet'} | shop opened ${T.shop.n}${T.shop.first ? ` (first at level ${T.shop.first})` : ''} | time: ${sc || '-'} | left from: ${Object.entries(ends).map(([k, v]) => `${k} ${v}`).join(' ') || '-'}${hard ? ` | most lost: ${hard}` : ''}`;
}
