// The Pacer (0.8.17, mykee: "a proper gaming engine ... how long into the game they are, what exactly they are looking
// at on the screen, whether it is too difficult or not ... no two users will have the same kind of gameplay"; and
// "never ever reduce the time or increase the time for them ... push the struggling players"; "never ever remove the fun").
//
// It reads the player and fits what is AROUND the play to him: help, the offer of a skip, a free start booster, a free
// hint, optional dares, which level-card scenes play, and where the map points. It never touches the play itself: the
// fuse, the rings, thorns, villains, odds and prices are the same for everyone, and nothing here reads whether he paid,
// how many videos he watched or whether he is online (tools/test-pacer.mjs feeds pairs of saves and compares).
//
// What it reads (each with the reason it gives):
//   skill   0..1, from wins and losses against each level's own difficulty (tries on a level, stars; a win with help
//           counts half), so a player who wins hard levels reads higher than one who wins easy ones
//   mood    stuck (the Brain's model: 3 losses here, or 4 of the last 6) / cruising (PACE.cruiseRun first-try
//           three-star wins in a row) / steady
//   habits  from the level card's seconds: lingers on the how-to scenes, or skips every card; and from where sessions
//           ended (the Tally): leaves after a loss
// What it decides (one function each, pure over the save, every answer with a `why` for the decision trace):
//   failPlan   after a loss: the "Stuck? Skip this one" pop-up (PACE.stuckAsk losses in a row, soft ones count, once per
//              level per session, never in the early days), a free hint (loss 4; 3 for a lingerer or a leaver; 2 for a
//              stuck player; again every PACE.hintAgain more losses), a free Scarecrow at a boss (loss 3), and where no
//              skip is possible (a won level replayed for stars) the pop-up's free booster without the pop-up
//   retryGift  the try after the pop-up was declined starts with one free booster (once per level)
//   dareFor    one optional dare on the level card for a cruising player (never L1-5, never a first try at a boss);
//              fewer for a player who declines them
//   marks      the three levels where the next star is nearest, when the player waits at a star gate
//   cards      'new': a player who skips every card is shown only the scenes of new rules
// The Settings switch "Adaptive help" (save.adapt, on unless set false) turns off the pop-up, the dares, the marks and
// the habit-based timings; the free hint then comes at the plain loss 4. Easy mode's star goals are a mode rule
// (src/goals.js), not part of the switch.
import { slot } from './hub.js';
import * as BR from '../brain.js';
import { HARD_IDS } from '../sim/sim.js';
import * as MINT from './mint.js';

export const PACE = {
  stuckAsk: 3, // losses in a row on one level (a pause-page restart counts) before the skip pop-up
  hintAt: 4, hintLeaver: 3, hintStuck: 2, // the free hint: the plain loss, a lingerer or leaver, a struggling player
  hintAgain: 3, // ... and again after this many more losses in a row on the same level (adaptive help on; off: once)
  bossScare: 3, // a free Scarecrow on this loss in a row at a boss
  cruiseRun: 3, // first-try three-star wins in a row that read as cruising
  dareFrom: 6, // no dares on levels 1 to 5
  dareBonus: MINT.FAUCETS.dare.share, // a dare met pays this much more (the Mint's table: src/engine/mint.js FAUCETS.dare)
  dareWait: 2, // each dare declined holds the next ones back this many more levels (at most dareWaitMax)
  dareWaitMax: 8,
  softFuse: 0.5, // a restart from the pause page after this share of the fuse (or after an egg was lost) is a soft loss
  cardN: 4, linger: 9, skip: 2.5, // level-card seconds: averaged over the last cardN visits; >= linger, <= skip
  leaveN: 3, leaveShare: 0.6, // sessions that ended on the fail page: this share of the last few (at least leaveN)
  marks: 3,
  steep: 6, // skill against difficulty, the same curve tools/sim-players.mjs uses
  log: 16,
};

const num = (v) => (Number.isFinite(+v) ? +v : 0);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const on = (save) => !!save && save.adapt !== false;

// a level's difficulty, 0 (anyone) .. 1 (nearly nobody): the first five teach, then a slow climb; the hard levels and
// the bosses stand out. The same guess as tools/sim-players.mjs WORLD.guess (real logs replace it there).
export function diff(id) {
  return Math.min(0.92, (id <= 5 ? 0.08 + 0.03 * id : 0.26 + 0.0105 * (id - 5)) + (HARD_IDS.includes(id) ? 0.13 : 0) + (id % 5 === 0 ? 0.07 : 0));
}

const SAFE = new WeakSet();
export function pacState(save) {
  const cur = slot(save, 'pac');
  if (cur && SAFE.has(cur)) return cur;
  const o = obj(cur), map = (m) => { const r = {}; for (const [k, v] of Object.entries(obj(m)).slice(0, 120)) if (+k > 0) r[+k] = num(v); return r; };
  const d = obj(o.dare);
  const s = {
    sid: Math.max(0, Math.floor(num(o.sid))), // the session (a fresh open counts one up)
    soft: map(o.soft), // per level: losses in a row, pause-page restarts included; a win clears it
    asked: map(o.asked), // per level: the session the skip pop-up was shown in
    gift: map(o.gift), // per level: 1 = the pop-up was declined, the next try gets a free booster; 2 = given
    hint: map(o.hint), scare: map(o.scare), // per level: the loss in a row the free hint was given on / the Scarecrow was given
    dared: map(o.dared), // per level: a dare was met here (the map's flame mark)
    ft3: Math.max(0, Math.floor(num(o.ft3))), // first-try three-star wins in a row
    dare: { off: num(d.off), took: num(d.took), no: num(d.no), met: num(d.met), wait: num(d.wait) },
    cur: o.cur && +o.cur.lv > 0 && o.cur.d && typeof o.cur.d.kind === 'string' ? { lv: +o.cur.lv, d: { ...o.cur.d }, took: !!o.cur.took } : null,
    cards: (Array.isArray(o.cards) ? o.cards : []).map(num).filter((v) => v >= 0).slice(-PACE.cardN),
    log: (Array.isArray(o.log) ? o.log : []).filter((e) => e && typeof e === 'object').slice(-PACE.log),
  };
  save.eng.pac = s; SAFE.add(s);
  return s;
}
// every decision leaves a line (the speed log carries the last few; main.js also files it with the Brain's trace)
function note(P, what, why, now = Date.now()) {
  const e = { t: Math.floor(now / 1000), what, why };
  const l = P.log[P.log.length - 1];
  if (!l || l.what !== what || l.why !== why) P.log = [...P.log, e].slice(-PACE.log);
  return why;
}

// ---- reading the player
// skill: each level played gives an estimate (its difficulty, moved by how its tries went); weighted by tries (up to 4)
export function skill(save) {
  const A = obj(save.dir && save.dir.att);
  let sum = 0, wt = 0;
  for (const [k, a] of Object.entries(A)) {
    const id = +k, tries = num(a && a.tries);
    if (!(id > 0) || !(tries > 0)) continue;
    const wins = Math.min(tries, num(a.wins)), helped = Math.min(wins, num(a.help));
    const rate = (wins - helped * 0.5 + 0.5) / (tries + 1);
    const w = Math.min(4, tries);
    sum += (diff(id) + Math.log(rate / (1 - rate)) / PACE.steep) * w; wt += w;
  }
  if (!wt) return 0.5;
  // stars: a player who comes away with three stars reads a little higher than one who scrapes one
  const st = Object.entries(obj(save.stars)).filter(([k, v]) => /^\d+$/.test(k) && v > 0).map(([, v]) => num(v));
  const starAdj = st.length >= 3 ? ((st.reduce((a, b) => a + b, 0) / st.length) - 2) * 0.04 : 0;
  return Math.round(clamp(sum / wt + starAdj, 0, 1) * 100) / 100;
}
export function habits(save) {
  const P = pacState(save), c = P.cards, avg = c.length ? c.reduce((a, b) => a + b, 0) / c.length : 0;
  const T = save.eng && save.eng.tal, ends = T && Array.isArray(T.end) ? T.end.slice(-6) : [];
  const fails = ends.filter((e) => e && e.sc === 'fail').length;
  return {
    linger: c.length >= PACE.cardN && avg >= PACE.linger,
    skipper: c.length >= PACE.cardN && avg <= PACE.skip,
    leaver: ends.length >= PACE.leaveN && fails / ends.length >= PACE.leaveShare,
    cardSecs: Math.round(avg * 10) / 10,
  };
}
// ctx: { levelId }. -> { skill, mood, linger, skipper, leaver, struggling, why }
export function read(save, ctx = {}) {
  const P = pacState(save), lv = ctx.levelId || save.unlocked || 1;
  const sk = skill(save), H = habits(save), m = BR.model(save, { levelId: lv, now: ctx.now }).mood;
  const mood = m === 'stuck' ? 'stuck' : P.ft3 >= PACE.cruiseRun ? 'cruising' : 'steady';
  const lost = losses(save, lv), struggling = mood === 'stuck' || (lost >= 2 && sk + 0.1 < diff(lv));
  const why = `skill ${sk.toFixed(2)} on a ${diff(lv).toFixed(2)} level, ${mood}${struggling ? ', struggling' : ''}${H.linger ? ', lingers on the cards' : ''}${H.skipper ? ', skips the cards' : ''}${H.leaver ? ', leaves after a loss' : ''}`;
  return { skill: sk, mood, ...H, struggling, lost, why };
}

// ---- losses in a row (soft ones count)
export const losses = (save, id) => num(pacState(save).soft[id]);
// a restart from the pause page: a soft loss when much of the fuse was used or an egg was already lost
// info: { used (share of the fuse used, 0..1), lost (eggs lost so far) }
export function restart(save, id, info = {}) {
  if (!(id > 0)) return false;
  const P = pacState(save);
  if (!(num(info.used) >= PACE.softFuse || num(info.lost) > 0)) return false;
  P.soft[id] = num(P.soft[id]) + 1;
  note(P, 'soft:' + id, `a restart on level ${id} after ${Math.round(num(info.used) * 100)}% of the fuse${info.lost ? ', an egg lost' : ''} counts as a loss`);
  return true;
}
// a run ended. r: { id, won, stars, first (no try on this level before), mode, dare: { kind, met } | null }
export function result(save, r = {}) {
  const P = pacState(save), id = +r.id;
  if (!(id > 0)) return;
  if (r.won) {
    delete P.soft[id]; delete P.hint[id]; delete P.gift[id]; // (a replay for stars that goes badly gets its hint and its booster again)
    P.ft3 = r.first && r.stars >= 3 ? P.ft3 + 1 : 0;
    if (r.dare && r.dare.met) { P.dare.met++; P.dared[id] = 1; }
    if (P.cur && P.cur.lv === id) P.cur = null;
  } else { P.soft[id] = num(P.soft[id]) + 1; P.ft3 = 0; }
  if (P.dare.wait > 0) P.dare.wait--;
}
// the level card was left after `secs` seconds (the Tally's clock): what he looks at
export function card(save, secs) {
  const P = pacState(save), v = clamp(num(secs), 0, 120);
  P.cards = [...P.cards, Math.round(v * 10) / 10].slice(-PACE.cardN);
}
// which level-card scenes play: 'new' (only new rules) for a player who skips every card, else 'all'
export function cards(save) {
  if (!on(save)) return 'all';
  return habits(save).skipper ? 'new' : 'all';
}

// ---- after a loss
// ctx: { levelId, boss, early (nothing is offered yet: earlyDays), canSkip, now }
// -> { ask, hint, scare, gift (call declined: the next try's free booster), why }
export function failPlan(save, ctx = {}) {
  const P = pacState(save), id = +ctx.levelId, adapt = on(save);
  if (!(id > 0)) return { ask: false, hint: false, scare: false, why: '' };
  const R = read(save, { levelId: id, now: ctx.now }), n = losses(save, id);
  const hintAt = !adapt ? PACE.hintAt : R.struggling ? PACE.hintStuck : R.linger || R.leaver ? PACE.hintLeaver : PACE.hintAt;
  const ask = adapt && !ctx.early && !!ctx.canSkip && n >= PACE.stuckAsk && P.asked[id] !== P.sid + 1;
  // no skip here (a level already won, replayed for its stars; the last level): the pop-up's "Keep trying" booster comes anyway
  const gift = adapt && !ctx.early && !ctx.canSkip && n >= PACE.stuckAsk && !P.gift[id];
  const scare = !!ctx.boss && !ctx.early && n >= PACE.bossScare && !P.scare[id];
  const hint = !ctx.early && !scare && n >= hintAt && (!P.hint[id] || (adapt && n - P.hint[id] >= PACE.hintAgain));
  const bits = [`${n} in a row on level ${id}`, R.why];
  if (ask) bits.push('the skip pop-up (once this session)');
  if (scare) bits.push('a free Scarecrow at the boss');
  if (hint) bits.push(`a free hint (at loss ${hintAt})`);
  if (gift) bits.push('no skip here: a free booster on the next try');
  const why = bits.join('; ');
  if (ask || scare || hint || gift) note(P, 'fail:' + id, why, ctx.now);
  return { ask, hint, scare, gift, why, hintAt, n };
}
// the pop-up was put up (it does not come back on this level this session)
export function asked(save, id) { const P = pacState(save); P.asked[id] = P.sid + 1; }
// "Keep trying": the next try starts with one free booster, once per level
export function declined(save, id) { const P = pacState(save); if (!P.gift[id]) { P.gift[id] = 1; note(P, 'keep:' + id, `kept trying on level ${id}: the next try starts with a free booster`); } }
// the retry: -> true once after a declined pop-up (the caller picks the level's most useful booster)
export function retryGift(save, id) { const P = pacState(save); if (P.gift[id] !== 1) return false; P.gift[id] = 2; return true; }
// the free hint or Scarecrow was given here
export function gave(save, id, kind) { const P = pacState(save); if (kind === 'hint') P.hint[id] = Math.max(1, losses(save, id)); else if (kind === 'scare') P.scare[id] = 1; }

// ---- dares, by choice
const DARE = {
  noboost: () => ({ kind: 'noboost', short: 'No boosters', long: 'Dare: no boosters' }),
  every: () => ({ kind: 'every', short: 'Every egg home', long: 'Dare: every egg home' }),
  turns: (n) => ({ kind: 'turns', n, short: `${n} turns max`, long: `Dare: ${n} ring turns or fewer` }),
  nochick: () => ({ kind: 'nochick', short: 'No chick', long: 'Dare: no chick sent' }),
};
// ctx: { levelId, boss, tries (on this level before), eggs, target, turns (the level's own turn count to beat, 0 when
//   it has none), chick (a chick can be sent here), goals (the star goals' kinds: a dare never repeats one), now }
// -> { kind, n?, short, long, why } | null. The same dare stays on the card while it is this level's.
export function dareFor(save, ctx = {}) {
  const P = pacState(save), id = +ctx.levelId;
  if (!on(save) || !(id >= PACE.dareFrom) || (ctx.boss && !(ctx.tries > 0))) return null;
  if (P.cur && P.cur.lv === id) return { ...P.cur.d, took: P.cur.took };
  const R = read(save, { levelId: id, now: ctx.now });
  if (R.mood !== 'cruising' || P.dare.wait > 0) return null;
  const goals = ctx.goals || [], has = (k) => goals.includes(k);
  const fits = [DARE.noboost(), ctx.eggs > ctx.target && !has('all') && !has('perfect') ? DARE.every() : null, ctx.turns > 0 && !has('turns') ? DARE.turns(ctx.turns) : null, ctx.chick ? DARE.nochick() : null].filter(Boolean);
  const d = fits[(id + P.dare.off) % fits.length];
  P.cur = { lv: id, d, took: false }; P.dare.off++;
  d.why = note(P, 'dare:' + id, `${R.why}: one dare on level ${id} (${d.short}), ${P.dare.no} declined so far`, ctx.now);
  return { ...d, took: false };
}
// the dare chip was tapped (on) or tapped again (off)
export function dareTake(save, id, took) { const P = pacState(save); if (P.cur && P.cur.lv === id) P.cur.took = !!took; }
// play started from the level card with a dare on it: taken or declined (declining is free; it makes the next ones rarer)
export function dareStart(save, id) {
  const P = pacState(save);
  if (!P.cur || P.cur.lv !== id) return null;
  if (P.cur.took) { P.dare.took++; return { ...P.cur.d }; }
  P.dare.no++; P.dare.wait = Math.min(PACE.dareWaitMax, P.dare.no * PACE.dareWait);
  note(P, 'dare:no:' + id, `dare declined on level ${id}: the next waits ${P.dare.wait} levels`);
  P.cur = null;
  return null;
}
// was it met? F: { broken, saved, total, turns, boosts (boosters used), chicks (chicks sent) }
export function dareMet(d, F = {}) {
  if (!d) return false;
  if (d.kind === 'noboost') return !(F.boosts > 0);
  if (d.kind === 'every') return !(F.broken > 0) && F.saved >= F.total;
  if (d.kind === 'turns') return num(F.turns) <= d.n;
  if (d.kind === 'nochick') return !(F.chicks > 0);
  return false;
}
// the coins of a met dare, on top of the win's own (the win pays its normal amount whatever happens to the dare)
export const dareCoins = (coins) => MINT.dareCoins(coins);
export const dared = (save, id) => !!pacState(save).dared[id];

// ---- the star gate: where the next star is nearest
// ctx: { short (stars still needed for the gate he waits at; 0 = none), rows: [{ id, stars (best), best (best score) }] }
// -> level ids, nearest first
export function marks(save, ctx = {}) {
  if (!on(save) || !(ctx.short > 0)) return [];
  return (ctx.rows || []).filter((r) => r.stars > 0 && r.stars < 3).sort((a, b) => b.stars - a.stars || b.best - a.best || a.id - b.id).slice(0, PACE.marks).map((r) => r.id);
}

// ---- for the speed log
export function line(save) {
  const P = pacState(save), R = read(save), D = P.dare, soft = Object.entries(P.soft).filter(([, v]) => v > 0).map(([k, v]) => `L${k}x${v}`).join(' ');
  const last = P.log[P.log.length - 1];
  return `${on(save) ? 'on' : 'OFF'} | ${R.why} | in a row: ${soft || '-'} | dares ${D.took}/${D.off} taken, ${D.met} met, ${D.no} no${D.wait ? `, wait ${D.wait}` : ''} | card ${R.cardSecs}s${last ? ` | last: ${last.why}` : ''}`;
}
export const trace = (save) => pacState(save).log.slice();
// a fresh session (the Pulse says so): the skip pop-up may come again
export function session(save) { pacState(save).sid++; }
