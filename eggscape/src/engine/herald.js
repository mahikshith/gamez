// The Herald: one local reminder, planned when the game goes to the background (0.8.15, mykee: "we also need to have
// a notification system ... streak notification or slot machine notification"). The phone shows it by itself; nothing
// is sent to or from any server. Rules, from research (Google Play's own data: more notifications a day means more
// players switching them off and fewer coming back; send only for real events; ask once, after the player has felt
// the value, and say what he gets):
//   - only for something real that is waiting: a banked spin, a spin one level away, the daily chest, a chest one star away
//   - one a day at most, never between 21:00 and 09:00, at the hour this player usually plays
//   - each one ignored makes the next come later; three ignored in a row and they stop until he comes back by himself
//   - asked once, on a win, from level HERALD.askFrom, never for a child profile; a switch in Settings turns them off
import { slot } from './hub.js';

export const HERALD = { askFrom: 6, quietFrom: 21, quietTo: 9, hour: 18, minAheadH: 18, giveUp: 3, sent: 6 };
const HOUR = 3600000, num = (v) => Math.max(0, Number(v) || 0);
const SAFE = new WeakSet();
export function herState(save) {
  const cur = slot(save, 'her');
  if (cur && SAFE.has(cur)) return cur;
  const h = cur && typeof cur === 'object' ? cur : {};
  const s = {
    ok: h.ok === 1 ? 1 : h.ok === -1 ? -1 : 0, // 1 allowed, -1 refused, 0 never asked
    asked: num(h.asked), off: !!h.off, // off: the player's own switch in Settings
    plan: h.plan && typeof h.plan === 'object' && num(h.plan.at) ? { at: num(h.plan.at), id: String(h.plan.id || '').slice(0, 12) } : null,
    sent: Array.isArray(h.sent) ? h.sent.filter((q) => q && num(q.t)).slice(-HERALD.sent).map((q) => ({ t: num(q.t), id: String(q.id || '').slice(0, 12), open: q.open ? 1 : 0 })) : [],
    ignored: Math.floor(num(h.ignored)), n: Math.floor(num(h.n)), opened: Math.floor(num(h.opened)),
  };
  save.eng.her = s; SAFE.add(s);
  return s;
}

// what could be said, best first. ctx: { spins (banked), spinLeft (levels to the next spin, 0 = none coming),
//   daily (tomorrow's chest will be there: always true unless switched off), starsToChest, chestSkin (bool) }
const TEXT = {
  spin: ['Your Lucky Spin is ready', 'The hen is holding the lever for you.'],
  spin1: ['One level to your Lucky Spin', 'Win one more and the wheel is yours.'],
  chest: ['One star to your next chest', 'There is an egg skin inside.'],
  chest0: ['One star to your next chest', 'Coins and a booster are inside.'],
  daily: ['A new treasure chest is in the coop', 'Today’s coins are waiting.'],
};
export function reasons(ctx = {}) {
  const r = [];
  if (num(ctx.spins) > 0) r.push('spin');
  if (num(ctx.spinLeft) === 1) r.push('spin1');
  if (num(ctx.starsToChest) === 1) r.push(ctx.chestSkin ? 'chest' : 'chest0');
  if (ctx.daily !== false) r.push('daily');
  return r;
}
// the next allowed moment at or after `from` that falls on the player's hour, outside the quiet hours
export function slotAt(from, hour) {
  let h = hour >= 0 ? hour : HERALD.hour;
  if (h >= HERALD.quietFrom || h < HERALD.quietTo) h = h < HERALD.quietTo ? HERALD.quietTo : HERALD.quietFrom - 1; // a night owl is told in the evening, an early bird at nine
  const d = new Date(from); d.setHours(h, 0, 0, 0);
  if (d.getTime() < from) d.setDate(d.getDate() + 1);
  return d.getTime();
}
// what to schedule when the game goes to the background. ctx as reasons(), plus { hour (the Pulse's best hour, -1 unknown), child }
// -> { at, id, title, text } | null
export function plan(save, ctx = {}, now = Date.now()) {
  const H = herState(save);
  H.plan = null;
  if (H.ok !== 1 || H.off || ctx.child || H.ignored >= HERALD.giveUp) return null;
  const why = reasons(ctx), last = H.sent[H.sent.length - 1];
  // not the same reason twice running when another exists; the daily chest alone is not worth a second reminder in a row
  let id = why.find((w) => !last || w !== last.id) || why[0];
  if (!id || (id === 'daily' && last && last.id === 'daily' && !last.open)) return null;
  const wait = HERALD.minAheadH * (1 + H.ignored); // ignored once: a day later still; twice: later again
  const at = slotAt(now + wait * HOUR, ctx.hour == null ? -1 : ctx.hour);
  H.plan = { at, id };
  return { at, id, title: TEXT[id][0], text: TEXT[id][1] };
}
// the game came to the front. from: the reminder id it was opened from ('' = by himself). Settles the plan that was pending.
export function opened(save, from = '', now = Date.now()) {
  const H = herState(save), P = H.plan;
  H.plan = null;
  if (!P) return null;
  if (now < P.at) return { fired: false }; // he came back before it was due: it is cancelled, nothing to grade
  const hit = !!from;
  H.sent = [...H.sent, { t: P.at, id: P.id, open: hit ? 1 : 0 }].slice(-HERALD.sent);
  H.n += 1;
  if (hit) { H.opened += 1; H.ignored = 0; } else H.ignored += 1;
  if (!hit && H.ignored >= HERALD.giveUp && now - P.at > 5 * 24 * HOUR) H.ignored = HERALD.giveUp - 1; // he came back by himself after days away: one more chance
  return { fired: true, hit, id: P.id };
}
// is this win the moment to ask for permission? Once, on a good win, when there is something real to promise.
export function shouldAsk(save, ctx = {}) {
  const H = herState(save);
  return H.ok === 0 && !H.off && !ctx.child && num(ctx.unlocked) >= HERALD.askFrom && num(ctx.stars) >= 2 && (num(ctx.spins) > 0 || (num(ctx.spinLeft) > 0 && num(ctx.spinLeft) <= 2));
}
export function answer(save, yes, now = Date.now()) { const H = herState(save); H.ok = yes ? 1 : -1; H.asked = now; }
export function setOff(save, off) { const H = herState(save); H.off = !!off; if (!off) H.ignored = 0; }
export function line(save) {
  const H = herState(save);
  return `${H.ok === 1 ? (H.off ? 'switched off' : 'allowed') : H.ok === -1 ? 'refused' : 'not asked'}, sent ${H.n}, opened ${H.opened}, ignored in a row ${H.ignored}${H.plan ? `, next ${H.plan.id} at ${new Date(H.plan.at).toISOString().slice(0, 16)}` : ''}`;
}
