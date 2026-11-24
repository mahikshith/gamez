// The Ledger: every coin and every item into and out of the purse, by where it came from and where it went (0.8.15).
// Research (Google Play's sources-and-sinks chart, Unity's economy guide): plot what is earned against what is spent;
// earn far above spend means nothing is scarce and nothing gets bought. Before this the game could not say where its
// coins went, and free boosters arrived faster than anyone used them.
// It does not ask every call site to report. It compares the purse with the purse it saw last (sync) and files the
// difference under the reason the caller names ('win', 'treasure', 'chest', 'spin', 'video', 'shop', 'rewind', ...).
// Coins bought with real money are filed apart ('iap'): they are not part of the played economy's curves.
import { BOOSTERS, CHARGE_ITEM, ITEMS } from '../economy.js';
import { slot } from './hub.js';

export const LEDGER = { window: 10, reasons: 14 };
const num = (v) => Math.max(0, Math.floor(Number(v) || 0));
const bag = (o) => { const r = {}; if (o && typeof o === 'object') for (const [k, v] of Object.entries(o).slice(0, LEDGER.reasons * 2)) if (num(v)) r[String(k).slice(0, 16)] = num(v); return r; };
const part = (p) => ({ in: bag(p && p.in), out: bag(p && p.out), gi: num(p && p.gi), gw: num(p && p.gw), bought: num(p && p.bought), used: num(p && p.used) });
const SAFE = new WeakSet();
export function ledState(save) {
  const cur = slot(save, 'led');
  if (cur && SAFE.has(cur)) return cur;
  const l = cur && typeof cur === 'object' ? cur : {};
  const s = { day: typeof l.day === 'string' ? l.day : '', d: part(l.d), all: part(l.all), cur: part(l.cur), win: Array.isArray(l.win) ? l.win.slice(-LEDGER.window).map(part) : [], lv: num(l.lv), iap: num(l.iap) };
  save.eng.led = s; SAFE.add(s);
  return s;
}

// what the purse holds, counted: coins, and every consumable with its worth at shop price
export function count(wallet) {
  const w = wallet || {}, items = {};
  for (const id of Object.keys(BOOSTERS)) items['b:' + id] = num(w.owned && w.owned[id]);
  items.charge = num(w.charges);
  for (const id of ['ally', 'skip']) items['t:' + id] = num(w.tickets && w.tickets[id]);
  items.goldhour = num(w.golden);
  items.scarecrow = num(w.scare);
  return { coins: num(w.coins), items };
}
export const SCARE_PRICE = 90;
export const worthOf = (key) => (key.startsWith('b:') ? BOOSTERS[key.slice(2)].price : key === 'charge' ? CHARGE_ITEM.price : key === 't:ally' ? ITEMS.ally.price : key === 't:skip' ? ITEMS.skip.price : key === 'goldhour' ? Math.round(ITEMS.goldhour.price / ITEMS.goldhour.wins) : key === 'scarecrow' ? SCARE_PRICE : 0);
export function stock(wallet) {
  const c = count(wallet); let n = 0, worth = 0;
  for (const [k, v] of Object.entries(c.items)) { if (k === 'goldhour') continue; n += v; worth += v * worthOf(k); }
  return { n, worth, coins: c.coins };
}

let snap = null; // the purse as last seen
export function prime(save) { snap = count(save.wallet); } // look without filing: on load, after a save swap
// file what changed since the last look under `why`. Returns { coins, items } (the signed change) for the caller's own use.
export function sync(save, why, day) {
  const now = count(save.wallet);
  if (!snap) { snap = now; return { coins: 0, items: 0 }; }
  const L = ledState(save), dc = now.coins - snap.coins, key = String(why || 'other').slice(0, 16);
  if (day && L.day !== day) { L.day = day; L.d = part(null); }
  let up = 0, upW = 0, dn = 0;
  for (const k of Object.keys(now.items)) {
    const d = now.items[k] - (snap.items[k] || 0);
    if (d > 0) { up += d; upW += d * worthOf(k); } else if (d < 0 && k !== 'goldhour') dn -= d;
  }
  snap = now;
  if (!dc && !up && !dn) return { coins: 0, items: 0 };
  if (key === 'iap') { L.iap += Math.max(0, dc); return { coins: dc, items: up }; }
  for (const P of [L.d, L.all, L.cur]) {
    if (dc > 0) P.in[key] = (P.in[key] || 0) + dc;
    if (dc < 0) P.out[key] = (P.out[key] || 0) - dc;
    if (up) { if (dc < 0) P.bought += up; else { P.gi += up; P.gw += upW; } } // items that came with coins leaving were bought, the rest were given
    if (dn) P.used += dn;
  }
  return { coins: dc, items: up - dn };
}
// a level ended (won or lost): close its page in the rolling window
export function level(save) {
  const L = ledState(save);
  L.win = [...L.win, L.cur].slice(-LEDGER.window); L.cur = part(null); L.lv += 1;
}

const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
// the last LEDGER.window levels in numbers. sinkShare: coins spent per coin earned (1 = everything earned is spent);
// giftRate / useRate: free consumables arriving and consumables used, per level; glut: free ones arrive faster than any are used
export function flow(save) {
  const L = ledState(save), W = [...L.win, L.cur], n = Math.max(1, L.win.length);
  const inC = W.reduce((a, p) => a + sum(p.in), 0), outC = W.reduce((a, p) => a + sum(p.out), 0);
  const gi = W.reduce((a, p) => a + p.gi, 0), used = W.reduce((a, p) => a + p.used, 0), bought = W.reduce((a, p) => a + p.bought, 0), S = stock(save.wallet);
  return { levels: L.win.length, in: inC, out: outC, perLevel: inC / n, sinkShare: inC ? outC / inC : 0, gifts: gi, used, bought, giftRate: gi / n, useRate: used / n,
    glut: L.win.length >= 5 && gi > used + bought + 2 && S.n >= 8, stock: S.n, stockWorth: S.worth, coins: S.coins, allIn: sum(L.all.in), allOut: sum(L.all.out), iap: L.iap };
}
const top = (o, k = 4) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, k).map(([a, b]) => `${a} ${b}`).join(', ');
// one line for the speed log
export function line(save) {
  const L = ledState(save), F = flow(save);
  return `all in ${sum(L.all.in)} (${top(L.all.in)}) out ${sum(L.all.out)} (${top(L.all.out)}) | last ${F.levels} lv: in ${F.in} out ${F.out} gifts ${F.gifts} bought ${F.bought} used ${F.used} | bag ${F.stock} worth ${F.stockWorth}${F.glut ? ' GLUT' : ''}${L.iap ? ' | iap coins ' + L.iap : ''}`;
}
