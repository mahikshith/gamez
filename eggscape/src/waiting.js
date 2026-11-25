// Rewards that wait for a connection (0.8.17, mykee: "when the user is offline there is no way to display those ads").
// A video reward tied to a moment that passes (double coins on a win, the free-coins video of the day, the Lucky Spin's
// video spin), tapped while no video can be shown, is kept: at most WAIT.max, the newest replace the oldest, each with
// what it pays. Back online, the map and home show one gift mark; each is claimed by watching one video. They never
// expire and are never sold; nothing waits before level 3 is won (the caller says early). Unlock Everything owners never
// get here (their rewards come at once, no video).
// Pure: the state lives in save.waiting; main.js draws the mark and the page and calls the reward moment.
// MINT: amounts and the daily ceiling belong to src/engine/mint.js (another helper is writing it). Until it lands, the
// amount is the one the moment would have paid (economy.js) and WAIT.dayCap stands in for the mint's daily ceiling.
export const WAIT = { max: 3, dayCap: 600 }; // MINT: dayCap -> the mint's daily ceiling for free coins
const KINDS = ['coins', 'spin'];
const ok = (it) => it && typeof it === 'object' && KINDS.includes(it.kind) && typeof it.key === 'string' && it.key && Math.floor(+it.n) > 0;

export function clean(s) {
  const o = s && typeof s === 'object' ? s : {};
  const list = (Array.isArray(o.list) ? o.list : []).filter(ok).map((it) => ({ id: it.key, key: it.key, kind: it.kind, n: Math.floor(+it.n), at: +it.at || 0 })).slice(-WAIT.max);
  const p = o.paid && typeof o.paid === 'object' && typeof o.paid.day === 'string' ? { day: o.paid.day, n: Math.max(0, Math.floor(+o.paid.n || 0)) } : null;
  return { list, paid: p };
}

// keep one. item: { kind: 'coins' | 'spin', n (coins, or spins), key (the moment: the same one is kept once) }
export function keep(list, item, now = 0, o = {}) {
  const L = clean({ list }).list;
  if (o.early || !ok(item) || L.some((it) => it.key === item.key)) return L;
  return [...L, { id: item.key, key: item.key, kind: item.kind, n: Math.floor(+item.n), at: now }].slice(-WAIT.max);
}

// the coins still free under the day's ceiling
export const room = (state, day) => { const p = clean(state).paid; return Math.max(0, WAIT.dayCap - (p && p.day === day ? p.n : 0)); };

// claim one after its video. -> { state, item } (item null: not there, or over today's ceiling: it keeps waiting)
export function claim(state, id, day) {
  const S = clean(state), it = S.list.find((x) => x.id === id);
  if (!it) return { state: S, item: null };
  if (it.kind === 'coins' && room(S, day) < it.n) return { state: S, item: null };
  const paid = it.kind === 'coins' ? { day, n: (S.paid && S.paid.day === day ? S.paid.n : 0) + it.n } : S.paid;
  return { state: { list: S.list.filter((x) => x.id !== id), paid }, item: it };
}
