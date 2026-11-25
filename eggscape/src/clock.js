// The game's own day (0.8.17). Every daily thing (the chest, the free sample, Today's Deal, the free-coins ladder, the
// Lucky Spin's day, the Director's freebies, the Daily Vault's pay) used to check only that the stored day DIFFERS from
// the phone's date, so moving the date back and forth repeated them all. Now:
// - the game's day only moves forward: the latest moment seen is remembered (max); a clock that goes back keeps the
//   remembered day, and coming forward again to a day already seen gives nothing new;
// - any move forward is ONE new day for the daily rules (they only ask "is it a new day?"), and the count of days that
//   passed (n, gap) takes a jump of more than 2 days with no run of the app in between as one day, unless the phone's
//   uptime (time since it started, which the date setting cannot change; the Android bridge's uptime()) shows those
//   days really passed;
// - no network time: nothing here needs a connection.
// Pure: step(state, now, up) -> state. main.js keeps the state in save.clock and binds it here (bind), so the rules
// that keep their own day keys (director.js, offers.js, brain.js) read a "now" that never goes back (at / now).
export const CLOCK = { jumpDays: 2, slackMs: 3 * 3600 * 1000 };
const DAY = 864e5;
export const dayOf = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
// calendar days from one day key to another (local dates; DST-safe through UTC)
const utc = (k) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / DAY);
const isDay = (k) => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k);

export function clean(c) {
  const o = c && typeof c === 'object' ? c : {};
  return { day: isDay(o.day) ? o.day : '', max: Number(o.max) > 0 ? Number(o.max) : 0, up: Number.isFinite(+o.up) && o.up !== null && o.up !== '' ? +o.up : -1, n: Math.max(0, Math.floor(+o.n || 0)), gap: Math.max(0, Math.floor(+o.gap || 0)) };
}

// one look at the clocks. now: the phone's date (ms); up: its uptime in ms when the shell offers one (else undefined)
export function step(state, now, up) {
  const s = clean(state), u = Number.isFinite(up) ? up : -1;
  if (!(now > 0)) return s;
  if (!s.day) return { day: dayOf(now), max: now, up: u, n: 0, gap: 0 };
  if (now <= s.max) return s; // the clock went back (or did not move): the remembered day stays
  const nd = dayOf(now), md = dayOf(s.max);
  if (nd === md) return { ...s, max: now, up: u };
  const g = Math.max(1, daysBetween(md, nd));
  // a long jump is real only when the uptime (same start of the phone) covers it
  const proven = u >= 0 && s.up >= 0 && u >= s.up && u - s.up >= now - s.max - CLOCK.slackMs;
  const gap = g <= CLOCK.jumpDays || proven ? g : 1;
  return { day: nd > s.day ? nd : s.day, max: now, up: u, n: s.n + gap, gap };
}

// a "now" (ms) that never goes back: the rules with their own day keys read this
export const at = (state, now) => Math.max(now, clean(state).max);

// ---- the bound clock: main.js hands over save.clock once it is loaded; everyone else asks here
let bound = null, upFn = null;
export function bind(save, uptime) {
  bound = save || null; upFn = typeof uptime === 'function' ? uptime : null;
  if (bound) bound.clock = clean(bound.clock);
}
function look() {
  if (!bound) return null;
  let up;
  try { up = upFn ? Number(upFn()) : undefined; } catch (_) { up = undefined; }
  bound.clock = step(bound.clock, Date.now(), up);
  return bound.clock;
}
// the game's day key 'YYYY-MM-DD' (the phone's date when nothing is bound: tests, tools)
export function today() { const c = look(); return c ? c.day : dayOf(Date.now()); }
// a "now" that never goes back (for the rules that make their own day keys from a time)
export function now(t = Date.now()) { const c = look(); return c ? Math.max(t, c.max) : t; }
