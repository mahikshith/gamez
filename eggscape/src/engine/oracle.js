// The Oracle: what this player will probably do next, from the Pulse (play record) and the Ledger (coin flow) (0.8.15,
// mykee: "a proper prediction engine ... how close they are to beat the villain, how likely they are to open the
// application ... how many coins they would likely spend"). No server and no trained model: a few plain rules on the
// signals research found strongest (hours away, days played, rounds, fail streaks, what was watched and bought).
// Every prediction carries its reasons, and every one is GRADED: pose() notes it, settle() notes what then happened,
// so the speed log shows how often each one is right. A prediction never changes odds, prices or a level's difficulty;
// it only helps choose what is shown and when (engine/conduct.js).
import { slot } from './hub.js';
import * as PU from './pulse.js';
import * as LE from './ledger.js';

export const ORACLE = { trust: 12, good: 0.2 }; // a prediction may steer once it was graded `trust` times with a Brier score under `good`
const clamp = (v, a = 0.02, b = 0.98) => Math.max(a, Math.min(b, v));
const num = (v) => Math.max(0, Number(v) || 0);
const KEYS = ['win', 'back', 'video', 'coins', 'pay'];
const SAFE = new WeakSet();
export function oraState(save) {
  const cur = slot(save, 'ora');
  if (cur && SAFE.has(cur)) return cur;
  const o = cur && typeof cur === 'object' ? cur : {}, cal = {}, open = {};
  for (const k of KEYS) {
    const c = (o.cal && o.cal[k]) || {}; cal[k] = { n: Math.floor(num(c.n)), hit: Math.floor(num(c.hit)), sq: num(c.sq) };
    const q = o.open && o.open[k]; if (q && typeof q === 'object') open[k] = { p: clamp(num(q.p), 0, 1), id: String(q.id || '').slice(0, 24), t: num(q.t) };
  }
  const s = { cal, open };
  save.eng.ora = s; SAFE.add(s);
  return s;
}

// ctx: { levelId, hard, near (the last try was one egg short), waiting (something is banked for the next visit),
//        price (the coin price of the thing in view), now }
export function predict(save, ctx = {}) {
  const now = ctx.now || Date.now(), F = PU.facts(save, now), L = LE.flow(save);
  const w = save.wallet || {}, D = save.dir || {}, o = save.offers || {}, B = save.brain || {};
  const out = {};
  { // wins the next try of this level
    const a = (D.att && D.att[ctx.levelId]) || {}, tries = num(a.tries), wins = num(a.wins), run = num(a.streak), why = [];
    let p = F.winRate10; why.push(`wins ${Math.round(F.winRate10 * 10)} of the last 10`);
    if (tries >= 2) { const own = (wins + 1) / (tries + 2); p = (p + own) / 2; why.push(`${wins}/${tries} on this level`); }
    if (run) { p *= 1 - 0.12 * Math.min(4, run); why.push(`${run} lost in a row here`); }
    if (ctx.near) { p += 0.12; why.push('last try was one egg short'); }
    if (ctx.hard) { p -= 0.1; why.push('a hard level'); }
    out.win = { p: clamp(p), why };
  }
  { // opens the game again within a day and a half
    const why = [`played ${F.days7} of the last 7 days`];
    let p = 0.22 + 0.08 * F.days7;
    if (F.ageDays < 1) { p -= 0.1; why.push('first day: most new players never return'); }
    if (F.sessToday >= 2) { p += 0.06; why.push('came back already today'); }
    if (F.roundsNow >= Math.max(3, F.roundsPerSess)) { p += 0.04; why.push('a full session'); }
    if (F.lastEnd === 'lost' && F.failRun >= 3) { p -= 0.15; why.push(`leaving on ${F.failRun} losses`); }
    if (F.lastEnd === 'won') p += 0.03;
    if (ctx.waiting) { p += 0.07; why.push('something is waiting for him'); }
    out.back = { p: clamp(p), why };
  }
  { // says yes to a chosen video when one is offered
    const seen = num(o.ads), no = num(B.videoNo), why = [`watched ${seen}, turned down ${no}`];
    let p = (seen + 1) / (seen + no + 3);
    if (w.noAds) { p = 0.02; why.push('Premium: no videos needed'); }
    out.video = { p: clamp(p), why };
  }
  { // spends coins when shown something that fits
    const spent = num(D.spent && D.spent.all), coins = num(w.coins), price = num(ctx.price), why = [];
    let p = spent > 0 ? 0.32 : 0.14; why.push(spent > 0 ? `has spent ${spent} coins` : 'never spent a coin');
    if (price) { if (coins >= price) { p += 0.25; why.push(`holds ${coins}, it costs ${price}`); } else { p -= 0.25 * Math.min(1, (price - coins) / price); why.push(`${price - coins} coins short`); } }
    if (L.sinkShare > 0.5) { p += 0.1; why.push('spends most of what he earns'); }
    if (L.glut) { p -= 0.08; why.push('bag full of unused boosters'); }
    out.coins = { p: clamp(p), why };
  }
  { // pays real money in the coming days
    const payer = !!w.payer || !!w.noAds || !!w.collector, why = [];
    let p = payer ? 0.3 : 0.02; why.push(payer ? 'has paid before' : 'has never paid (1 to 3 in 100 players do)');
    if (!payer && F.days7 >= 5) { p += 0.03; why.push('plays most days'); }
    if (!payer && num(o.ads) >= 8) { p += 0.02; why.push('watches many videos'); }
    out.pay = { p: clamp(p), why };
  }
  // the coins he will likely spend over the next ten levels: what he spent over the last ten, never more than he holds and earns
  out.spendNext10 = Math.round(Math.min(num(w.coins) + L.perLevel * 10, L.levels ? L.out / L.levels * 10 : 0));
  out.trySecs = Math.round(F.avgTrySecs);
  out.hour = F.bestHour;
  return out;
}

// ---- grading: note a prediction when it is made, and what happened when it is known
export function pose(save, key, p, id = '', now = Date.now()) {
  const O = oraState(save);
  if (!KEYS.includes(key)) return;
  O.open[key] = { p: clamp(num(p), 0, 1), id: String(id).slice(0, 24), t: now };
}
export function settle(save, key, yes, id = null) {
  const O = oraState(save), q = O.open[key];
  if (!q || (id != null && q.id !== String(id))) return null;
  delete O.open[key];
  const c = O.cal[key], y = yes ? 1 : 0;
  c.n += 1; c.hit += (q.p >= 0.5) === !!yes ? 1 : 0; c.sq += (q.p - y) * (q.p - y);
  return { p: q.p, yes: !!yes };
}
export const openOf = (save, key) => oraState(save).open[key] || null;
// may this prediction steer yet? Only once it has been right often enough on this phone
export function trusted(save, key) { const c = oraState(save).cal[key]; return !!c && c.n >= ORACLE.trust && c.sq / c.n < ORACLE.good; }
export function line(save, ctx = {}) {
  const P = predict(save, ctx), O = oraState(save), r = (v) => Math.round(v * 100);
  return KEYS.map((k) => { const c = O.cal[k]; return `${k} ${r(P[k].p)}%${c.n ? ` (right ${c.hit}/${c.n}, brier ${(c.sq / c.n).toFixed(2)}${trusted(save, k) ? ', trusted' : ''})` : ''}`; }).join(' | ') + ` | spend next 10 lv ~${P.spendNext10} | try ${P.trySecs} s`;
}
