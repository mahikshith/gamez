// The hub: the one board the game's background subsystems talk through (0.8.15, mykee: "multiple subsystems ... those
// systems should talk to each other ... if the main engine crashes all the subsystems also crash": so there is no main
// engine to crash). Each subsystem registers a name and a table of plain functions. Nobody calls a subsystem directly:
//   hub.ask(name, fn, args, fallback)  one answer from one subsystem
//   hub.emit(type, data)               a thing that happened, told to every subsystem that listens (its `on`)
// Every call is wrapped. A throw is counted and its message kept; after HUB.trip throws in a session that subsystem is
// switched off (its asks give the fallback, it hears no more events) and the rest carry on. Playing a level never
// depends on any of this: every caller passes a fallback that is the plain game (fixed reward, no offer, no reminder).
export const HUB = { trip: 3 };
const subs = new Map();
let errs = {}, down = {}, last = {};

export function add(name, api) { subs.set(String(name), api || {}); return api; }
export const names = () => [...subs.keys()];
export const isDown = (name) => !!down[name];
function fail(name, at, e) {
  errs[name] = (errs[name] || 0) + 1;
  last[name] = `${at}: ${String((e && e.message) || e).slice(0, 80)}`;
  if (errs[name] >= HUB.trip) down[name] = last[name];
}
export function ask(name, fn, args = [], fallback = null) {
  const S = subs.get(name);
  if (!S || down[name] || typeof S[fn] !== 'function') return fallback;
  try { const r = S[fn](...args); return r === undefined ? fallback : r; } catch (e) { fail(name, fn, e); return fallback; }
}
export function emit(type, data = {}) {
  for (const [name, S] of subs) {
    if (down[name] || typeof S.on !== 'function') continue;
    try { S.on(type, data); } catch (e) { fail(name, 'on ' + type, e); }
  }
}
// for the speed log: who is up, who tripped and on what
export function health() {
  const o = {};
  for (const name of subs.keys()) o[name] = down[name] ? 'DOWN ' + down[name] : errs[name] ? `ok (${errs[name]} err: ${last[name]})` : 'ok';
  return o;
}
export const healthLine = () => Object.entries(health()).map(([k, v]) => (v === 'ok' ? k : `${k} ${v}`)).join(', ');
export function reset() { errs = {}; down = {}; last = {}; } // a new session (and the tests)
export function clear() { subs.clear(); reset(); }

// each subsystem keeps its saved state under save.eng[key], made safe by its own function: a broken part of the save
// can only cost that one subsystem its memory
export function slot(save, key) {
  if (!save.eng || typeof save.eng !== 'object' || Array.isArray(save.eng)) save.eng = {};
  return save.eng[key];
}
