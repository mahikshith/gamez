// The Herald: the local notes that bring a player back (0.8.15; 0.8.17 rebuilt, mykee: "Notifications are the only way
// for the user to come back when they forgot about the game. We should have a different set of notifications for
// different sets of users ... a proper notification dynamic engine"). The phone shows them by itself; nothing is sent to
// or from any server. Pure: every input comes in `ctx`, so the tests and tools/sim-players.mjs run it as the game does.
//
//   CATALOGUE  every note there is: who it is for, what must be TRUE when it fires, the hen's words, where a tap lands
//   segment()  who is playing, from what the engines already know (Brain model, Oracle `back`)
//   plan()     on leaving: a series of up to six notes, each at this player's hour, each about something real then
//   opened()   on coming back: what fired, what was tapped; the series is cancelled (the game cancels it on the phone)
//   askNow()   whether the "Want a reminder?" card may show at this happy moment
//
// Rules (research: Google Play's own data, more notifications a day means more players switching them off; send only
// for real events; ask after the player has felt the value, and say what he gets):
//   - a note only about something that is really waiting at the moment it fires (each entry's `when`)
//   - at the hour this player usually opens the game (Pulse), never 21:00 to 09:00, one a day at most, three a week at most
//   - the series backs off by itself: day 1, 2 (then every other day), 4, 8 (then weekly), 15, 30; six unanswered and it
//     stops. Coming back (by a tap or by himself) cancels what is left and starts afresh next time he leaves.
//   - money is never the subject: no offer, price or shop in any note (Google Play: system notifications only for an
//     app's integral features; Apple 4.5.4: no promotions in notifications without an explicit opt-in)
//   - never for a child profile; a switch in Settings turns them off
import { slot } from './hub.js';
import { dayOf } from './pulse.js';
import { welcomeCoins } from '../director.js';

export const HERALD = {
  quietFrom: 21, quietTo: 9, hour: 18, minAheadH: 16,
  series: [1, 2, 4, 8, 15, 30], // days after leaving
  week: 3, // notes in any seven days, at most
  sent: 16, // notes remembered
  askFrom: 5, // the first "Want a reminder?" card: from the first boss win
  askEvery: 3, // later cards: one per three days of play at most
  backFrom: 3, // the welcome-back gift exists once level 3 is won
  giveUp: 6, // = series.length: six unanswered and the phone stays quiet until he comes back
};
const HOUR = 3600000, DAY = 24 * HOUR, num = (v) => Math.max(0, Number(v) || 0), str = (v, n = 12) => String(v || '').slice(0, n);

const SAFE = new WeakSet();
export function herState(save) {
  const cur = slot(save, 'her');
  if (cur && SAFE.has(cur)) return cur;
  const h = cur && typeof cur === 'object' ? cur : {};
  const at = (m) => m && num(m.at);
  const s = {
    ok: h.ok === 1 ? 1 : h.ok === -1 ? -1 : 0, // 1 allowed, -1 "not now" or refused on the phone, 0 never asked
    asked: num(h.asked), off: !!h.off, // off: the player's own switch in Settings
    asks: Math.floor(num(h.asks)), askT: num(h.askT), askSess: num(h.askSess), // the ask card: how often, when last, in which session
    plan: h.plan && typeof h.plan === 'object' && at(h.plan) ? { at: num(h.plan.at), id: str(h.plan.id), more: (Array.isArray(h.plan.more) ? h.plan.more : []).filter(at).slice(0, HERALD.series.length - 1).map((m) => ({ at: num(m.at), id: str(m.id) })) } : null,
    sent: Array.isArray(h.sent) ? h.sent.filter((q) => q && num(q.t)).slice(-HERALD.sent).map((q) => ({ t: num(q.t), id: str(q.id), open: q.open ? 1 : 0 })) : [],
    ignored: Math.floor(num(h.ignored)), n: Math.floor(num(h.n)), opened: Math.floor(num(h.opened)),
    seg: str(h.seg, 40), test: num(h.test),
  };
  save.eng.her = s; SAFE.add(s);
  return s;
}

// ---- who is playing. m: the Brain's model (brain.js model: stage, mood, spender, video); o: { back: the Oracle's
// chance he comes back tomorrow, 0..1 }
export function segment(m = {}, o = {}) {
  const life = ['new', 'learning', 'regular', 'veteran'].includes(m.stage) ? m.stage : 'new';
  const play = m.mood === 'stuck' ? 'stuck' : m.mood === 'cruising' || m.mood === 'flow' ? 'cruising' : 'steady';
  const money = m.spender === 'payer' ? 'payer' : m.video === 'fan' ? 'fan' : m.video === 'shy' || m.video === 'none' ? 'shy' : 'neither';
  const back = o.back == null || !Number.isFinite(o.back) ? 'unknown' : o.back >= 0.55 ? 'likely' : 'unlikely';
  return { life, play, money, back, key: `${life}/${play}/${money}/${back}` };
}
// each segment's own order: points added to an entry's priority
export const LEAN = {
  stuck: { helper: 30, world: -15, boss: -15, flame: -25 },
  cruising: { world: 15, boss: 15, chest1: 10, flame: 10 },
  new: { newbie: 25, spin: 5 },
  veteran: { world: 5, fresh: 10 },
  fan: { videos: 25 },
  payer: { charge: 25 },
};

// ---- the catalogue. ctx (what is true when the player leaves; main.js waitingCtx, sim-players waiting):
//   spins (banked), spinLeft (wins to the next), chestDay (the day the daily chest was last opened), dailyOn,
//   videosOn (free-coin videos exist for him), videoDay (the day he last took one), premium, charges, chargeMax, premDay,
//   starsToWorld, nextWorld (name), starsToChest, chestSkin, nextBoss (level id), quest (name), flame (wins in a row),
//   stuck (level id lost 3+ times in a row), stuckBoost (name of a booster really in the bag), unlocked, allDone,
//   newContent, giftOk (the welcome-back gift exists: level 3 won)
// when(ctx, at, now): is it TRUE at `at`? text(ctx, at, now): [title, line]. kind: the Conductor's kind (gift, rescue,
// progress, video). land: where a tap opens the game (main.js remLand). cool: hours before the same note again.
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const away = (at, now) => Math.floor((at - now) / DAY + 0.34); // whole days away when the note shows (the first note comes 16 to 40 hours after leaving)
const backNote = (id, from, to, text) => ({ id, kind: 'gift', pri: 100, cool: 24 * 40, land: 'home', back: from,
  when: (c, at, now) => !!c.giftOk && away(at, now) >= from && away(at, now) < to, text: (c, at, now) => text(welcomeCoins((at - now)), away(at, now)) });
export const CATALOGUE = [
  // a refill is ready
  { id: 'spin', kind: 'gift', pri: 90, cool: 20, land: 'spin', when: (c) => num(c.spins) > 0, text: () => ['Your Lucky Spin is ready', 'The hen is holding the lever for you.'],
    voice: { new: ['Your first Lucky Spin is ready', 'Pull the lever. See what falls out.'] } },
  { id: 'daily', kind: 'gift', pri: 60, cool: 44, land: 'daily', when: (c, at) => c.dailyOn !== false && c.chestDay !== dayOf(at), text: () => ['A fresh chest landed in the coop', 'The hen sat on it all night. Still warm.'] },
  { id: 'videos', kind: 'video', pri: 50, cool: 68, land: 'coins', who: (g) => g.money === 'fan', when: (c, at) => !!c.videosOn && !!c.videoDay && c.videoDay !== dayOf(at), text: () => ['The coin videos are back', 'A new day, a full set. Watch when you like.'] },
  { id: 'charge', kind: 'gift', pri: 65, cool: 44, land: 'charge', who: (g) => g.money === 'payer', when: (c, at) => !!c.premium && num(c.charges) < num(c.chargeMax) && c.premDay !== dayOf(at), text: () => ['Your Chick Charge of the day is here', 'The chicks are doing their warm-ups.'] },
  // progress within reach
  { id: 'spin1', kind: 'progress', pri: 74, cool: 44, land: 'level', when: (c) => !num(c.spins) && num(c.spinLeft) === 1, text: () => ['One win to your Lucky Spin', 'Win one more and the wheel is yours.'] },
  { id: 'world', kind: 'progress', pri: 72, cool: 70, land: 'map', when: (c) => num(c.starsToWorld) >= 1 && num(c.starsToWorld) <= 3 && !!c.nextWorld, text: (c) => [`${plural(num(c.starsToWorld), 'star')} to ${c.nextWorld}`, 'The gate is creaking open. Peek inside?'] },
  { id: 'chest1', kind: 'progress', pri: 70, cool: 70, land: 'chest', when: (c) => num(c.starsToChest) === 1, text: (c) => ['One star to your next chest', c.chestSkin ? 'There is an egg skin inside.' : 'Coins and a booster are inside.'] },
  { id: 'boss', kind: 'progress', pri: 68, cool: 70, land: 'level', when: (c) => num(c.nextBoss) > 0, text: (c) => [`The boss of level ${c.nextBoss} is waiting`, 'He practised his scary face. It is not very good.'] },
  { id: 'quest', kind: 'progress', pri: 66, cool: 70, land: 'quest', when: (c) => !!c.quest, text: (c) => ['A side quest just opened', `${str(c.quest, 40)}: the hen found a secret path.`] },
  // a streak alive (it ends only with a loss, so it can always still be kept)
  { id: 'flame', kind: 'progress', pri: 80, cool: 44, land: 'level', when: (c) => num(c.flame) >= 2, text: (c) => [`Your ${num(c.flame)}-win flame is still burning`, 'One more win keeps it going.'] },
  // stuck: the booster is really in the bag
  { id: 'helper', kind: 'rescue', pri: 85, cool: 70, land: 'level', when: (c) => num(c.stuck) > 0 && !!c.stuckBoost, text: (c) => [`Mama found a helper for level ${c.stuck}`, `A ${str(c.stuckBoost, 24)} is in your bag, ready to go.`] },
  // a new player who stopped early; a player who has finished everything (only when there is something new)
  { id: 'newbie', kind: 'progress', pri: 75, cool: 44, land: 'level', who: (g) => g.life === 'new', when: (c) => num(c.unlocked) >= 1 && num(c.unlocked) <= 5, text: (c) => ['The eggs miss you', `Level ${num(c.unlocked) || 1} is right where you left it.`] },
  { id: 'fresh', kind: 'gift', pri: 95, cool: 160, land: 'map', when: (c) => !!c.allDone && !!c.newContent, text: () => ['New levels just hatched', 'Fresh vaults nobody has played yet.'] },
  // away: the welcome-back gift (director.js welcomeCoins: it grows with the days away and is given on return), then silence
  backNote('back3', 3, 7, (c) => ['The hen kept a gift for you', `${c} coins and a booster for coming back.`]),
  backNote('back7', 7, 14, (c) => ['Your welcome-back gift grew', `${c} coins and a booster, waiting in the coop.`]),
  backNote('back14', 14, 30, (c) => ['The gift is getting heavy', `${c} coins now. The hen can barely lift it.`]),
  backNote('back30', 30, 999, (c) => ['One last note from the hen', `${c} coins and a booster, kept safe. Then she stays quiet.`]),
];
const BY_ID = Object.fromEntries(CATALOGUE.map((e) => [e.id, e]));
export const entry = (id) => BY_ID[id] || null;

// the next allowed moment at or after `from` that falls on the player's hour, outside the quiet hours
export function slotAt(from, hour) {
  let h = hour >= 0 ? hour : HERALD.hour;
  if (h >= HERALD.quietFrom || h < HERALD.quietTo) h = h < HERALD.quietTo ? HERALD.quietTo : HERALD.quietFrom - 1; // a night owl is told in the evening, an early bird at nine
  const d = new Date(from); d.setHours(h, 0, 0, 0);
  if (d.getTime() < from) d.setDate(d.getDate() + 1);
  return d.getTime();
}
const addDays = (t, k) => { const d = new Date(t); d.setDate(d.getDate() + k); return d.getTime(); };

// what is true at `at`, best first for this segment. hist: [{ t, id }] already sent or planned before `at`.
// lead(cands, moment): the Conductor (engine/index.js wires conduct.lead); without it the priorities decide.
export function candidates(ctx, seg, at, now, hist = [], lead = null) {
  const last = hist[hist.length - 1];
  const list = CATALOGUE.filter((e) => (!e.who || e.who(seg)) && e.when(ctx, at, now)
    && !(last && last.id === e.id) && !hist.some((q) => q.id === e.id && at - q.t < e.cool * HOUR));
  const score = (e) => e.pri + ((LEAN[seg.play] || {})[e.id] || 0) + ((LEAN[seg.life] || {})[e.id] || 0) + ((LEAN[seg.money] || {})[e.id] || 0);
  let out = list.map((e) => ({ id: e.id, kind: seg.money === 'fan' && e.id === 'videos' ? 'gift' : e.kind, near: Math.min(1, score(e) / 150), score: score(e) })).sort((a, b) => b.score - a.score);
  if (out.some((c) => c.id.startsWith('back'))) out = out.filter((c) => c.id.startsWith('back')); // the gift of a long absence is the note of its day
  if (typeof lead === 'function' && out.length > 1) {
    try { const o = lead(out, seg.play === 'stuck' ? 'fail' : 'note'); if (Array.isArray(o) && o.length) { const ids = o.map((c) => c.id); out = [...out].sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)); } } catch (_) { /* the Herald's own order */ }
  }
  return out;
}
const words = (e, ctx, seg, at, now) => (e.voice && (e.voice[seg.life] || e.voice[seg.money] || e.voice[seg.play])) || e.text(ctx, at, now);

// what to schedule when the game goes to the background. ctx: as the CATALOGUE, plus { hour (Pulse, -1 unknown),
// child, seg (segment()), lead }. -> { at, id, title, text, land, more: [{ at, id, title, text, land }] } | null
export function plan(save, ctx = {}, now = Date.now()) {
  const H = herState(save);
  H.plan = null;
  if (H.ok !== 1 || H.off || ctx.child) return null;
  const seg = ctx.seg && ctx.seg.key ? ctx.seg : segment();
  H.seg = seg.key;
  const hour = ctx.hour == null ? -1 : ctx.hour, first = slotAt(now + HERALD.minAheadH * HOUR, hour);
  const hist = H.sent.map((q) => ({ t: q.t, id: q.id })), out = [];
  for (const d of HERALD.series) {
    const at = d === 1 ? first : slotAt(addDays(first, d - 1), hour);
    if (out.length && at <= out[out.length - 1].at) continue;
    if (hist.some((q) => dayOf(q.t) === dayOf(at))) continue; // one a day
    if (hist.filter((q) => q.t > at - 7 * DAY && q.t <= at).length >= HERALD.week) continue; // three in any seven days
    let C = candidates(ctx, seg, at, now, hist, ctx.lead);
    if (d === 1 && seg.back === 'likely') C = C.filter((c) => c.kind === 'gift' || c.kind === 'rescue'); // he comes back anyway: day one only for a gift
    const c = C[0];
    if (!c) continue;
    const e = BY_ID[c.id], [title, text] = words(e, ctx, seg, at, now);
    out.push({ at, id: e.id, title, text, land: e.land });
    hist.push({ t: at, id: e.id });
  }
  if (!out.length) return null;
  H.plan = { at: out[0].at, id: out[0].id, more: out.slice(1).map((m) => ({ at: m.at, id: m.id })) };
  return { ...out[0], more: out.slice(1) };
}
// the game came to the front. from: the note it was opened from ('' = by himself, 'test' = the Settings test).
// Settles the series that was pending: what fired is filed, the rest is cancelled.
export function opened(save, from = '', now = Date.now()) {
  const H = herState(save), P = H.plan;
  if (from === 'test') H.test = now;
  H.plan = null;
  if (!P) return from === 'test' ? { fired: false, test: true } : null;
  if (now < P.at) return { fired: false, test: from === 'test' }; // back before the first was due: all cancelled, nothing to grade
  const shown = [P, ...(P.more || [])].filter((q) => q.at <= now), hit = !!from && from !== 'test', by = hit ? shown.find((q) => q.id === from) || shown[shown.length - 1] : null;
  H.sent = [...H.sent, ...shown.map((q) => ({ t: q.at, id: q.id, open: q === by ? 1 : 0 }))].slice(-HERALD.sent);
  H.n += shown.length;
  if (hit) H.opened += 1;
  H.ignored = hit ? shown.length - 1 : shown.length; // unanswered in that absence (the next series starts afresh)
  return { fired: true, hit, id: by ? by.id : P.id, shown: shown.length, land: by && BY_ID[by.id] ? BY_ID[by.id].land : '' };
}
// is something waiting right now that a note would have told him about? (the dot on the bell chip)
export function waiting(ctx = {}, now = Date.now()) { return num(ctx.spins) > 0 || (ctx.dailyOn !== false && typeof ctx.chestDay === 'string' && ctx.chestDay !== dayOf(now)); }

// ---- the ask card. ctx: { moment: 'boss' | 'spin' | 'welcome' | 'chip' | anything else (never), on (reminders
// already work), child, won3, won5, sess (this session's start), days (the days played, Pulse) }
export function askNow(save, ctx = {}, now = Date.now()) {
  const H = herState(save);
  if (ctx.on || ctx.child || !ctx.won3) return false;
  if (ctx.moment === 'chip') return true; // he tapped the bell himself
  if (!['boss', 'spin', 'welcome'].includes(ctx.moment)) return false; // happy moments only: never after a loss
  if (H.askSess && ctx.sess && H.askSess === ctx.sess) return false; // never twice in a session
  if (!H.asks) return !!ctx.won5; // the first: from the first boss win
  const since = dayOf(H.askT), days = (Array.isArray(ctx.days) ? ctx.days : []).filter((d) => d > since);
  return days.length >= HERALD.askEvery;
}
export function noteAsk(save, ctx = {}, now = Date.now()) { const H = herState(save); H.asks += 1; H.askT = now; H.askSess = num(ctx.sess); }
// kept for older callers: the first ask's rule
export function shouldAsk(save, ctx = {}) { return askNow(save, { moment: num(ctx.unlocked) > HERALD.askFrom && num(ctx.spins) > 0 ? 'spin' : 'boss', won3: num(ctx.unlocked) > 3, won5: num(ctx.unlocked) > HERALD.askFrom, ...ctx }); }
export function answer(save, yes, now = Date.now()) { const H = herState(save); H.ok = yes ? 1 : -1; H.asked = now; if (yes) H.off = false; }
export function setOff(save, off) { const H = herState(save); H.off = !!off; if (!off) H.ignored = 0; }
export function line(save) {
  const H = herState(save), P = H.plan, t = (ms) => new Date(ms).toISOString().slice(5, 16).replace('T', ' ');
  return `${H.ok === 1 ? (H.off ? 'switched off' : 'allowed') : H.ok === -1 ? 'not now' : 'not asked'}, asked ${H.asks}x, sent ${H.n}, opened ${H.opened}, unanswered last time ${H.ignored}, seg ${H.seg || '?'}${P ? `, next ${[P, ...P.more].map((q) => `${q.id}@${t(q.at)}`).join(' ')}` : ''}${H.test ? `, test ${t(H.test)}` : ''}`;
}
