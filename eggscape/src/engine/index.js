// The engine room: registers the background subsystems on the hub and gives the game ONE small, safe face to them
// (0.8.15). The game (main.js) calls only what is exported here; every export goes through the hub, so nothing in here
// can throw into the game, and one subsystem failing leaves the others running.
//
//   Ledger   coins and items in and out            src/engine/ledger.js
//   Pulse    the record of play                    src/engine/pulse.js
//   Oracle   predictions, graded                   src/engine/oracle.js
//   Conduct  one thing leads at each moment        src/engine/conduct.js   (asks the Brain's gate, src/brain.js)
//   Herald   one local reminder                    src/engine/herald.js
//   Tally    what was shown and what was taken     src/engine/tally.js
//   Pacer    help, skips and dares fit to the player (never the play itself)   src/engine/pacer.js
// The Director (help on a hard level), the Spin (wheel rules), the shop and the offers keep their own modules; the
// Conductor is where they meet.
import * as HUB from './hub.js';
import * as LE from './ledger.js';
import * as PU from './pulse.js';
import * as OR from './oracle.js';
import * as CO from './conduct.js';
import * as HE from './herald.js';
import * as TA from './tally.js';
import * as PA from './pacer.js';
import * as BR from '../brain.js';

const HOUR = 3600000;
HUB.add('ledger', {
  prime: LE.prime, sync: LE.sync, flow: LE.flow, line: LE.line,
  on(type, d) {
    if (type === 'result') LE.level(d.save);
  },
});
HUB.add('pulse', {
  facts: PU.facts, line: PU.line,
  away: (save, now) => { const P = PU.pulseState(save); return P.seen ? (now - P.seen) / HOUR : 0; },
  open: PU.open,
  on(type, d) {
    if (type === 'tick') PU.tick(d.save, d.now);
    else if (type === 'result') PU.result(d.save, d.r, d.now);
  },
});
HUB.add('oracle', {
  predict: OR.predict, line: OR.line, trusted: OR.trusted, learned: OR.learned,
  on(type, d) {
    const s = d.save;
    if (type === 'levelStart') {
      // what was offered on the last card and not taken is a "no"
      OR.settle(s, 'video', false); OR.settle(s, 'coins', false);
      OR.pose(s, 'win', OR.predict(s, d.ctx).win, 'L' + d.ctx.levelId, d.now);
    } else if (type === 'result') {
      OR.settle(s, 'win', !!d.r.won, 'L' + d.r.id);
      const P = OR.predict(s, { ...d.ctx, levelId: d.r.id, now: d.now });
      if (d.ctx && d.ctx.videoShown) OR.pose(s, 'video', P.video, 'card', d.now);
      if (d.ctx && d.ctx.coinShown) OR.pose(s, 'coins', P.coins, 'card', d.now);
    } else if (type === 'video') OR.settle(s, 'video', true);
    else if (type === 'spent') OR.settle(s, 'coins', true);
    else if (type === 'close') OR.pose(s, 'back', OR.predict(s, { ...d.ctx, now: d.now }).back, 'day', d.now);
    else if (type === 'open' && d.fresh) {
      // "comes back" means the next day, not five minutes later: a short pause leaves the prediction open
      const q = OR.openOf(s, 'back');
      if (q && d.now - q.t >= 6 * HOUR) OR.settle(s, 'back', d.now - q.t <= 36 * HOUR);
    }
  },
});
HUB.add('conduct', { lead: CO.lead, suggest: CO.suggest });
HUB.add('herald', {
  plan: HE.plan, opened: HE.opened, shouldAsk: HE.shouldAsk, askNow: HE.askNow, noteAsk: HE.noteAsk, waiting: HE.waiting, answer: HE.answer, setOff: HE.setOff, line: HE.line,
  state: (save) => { const H = HE.herState(save); return { ok: H.ok, off: H.off, ignored: H.ignored, asks: H.asks, plan: H.plan, sent: H.sent.length, opened: H.opened, test: H.test, seg: H.seg }; },
});
// who is playing, for the Herald: the Brain's model and the Oracle's "comes back tomorrow"
export function segment(save, now = Date.now()) {
  let m = {}, back = null;
  try { m = BR.model(save, { now }); } catch (_) { /* a plain segment */ }
  const P = HUB.ask('oracle', 'predict', [save, { now }], null);
  if (P && P.back) back = P.back.p;
  return HE.segment(m, { back });
}
HUB.add('tally', {
  seen: TA.seen, took: TA.took, screen: TA.screen, table: TA.table, line: TA.line,
  on(type, d) {
    if (type === 'result') TA.level(d.save, d.r, d.ctx || {});
    else if (type === 'close') TA.leave(d.save, d.ctx && d.ctx.screen, d.ctx && d.ctx.level, d.ctx && d.ctx.lastWon, d.now);
  },
});
HUB.add('pacer', {
  read: PA.read, failPlan: PA.failPlan, asked: PA.asked, declined: PA.declined, retryGift: PA.retryGift, gave: PA.gave, losses: PA.losses,
  restart: PA.restart, result: PA.result, card: PA.card, cards: PA.cards, dareFor: PA.dareFor, dareTake: PA.dareTake, dareStart: PA.dareStart,
  dareMet: PA.dareMet, dareCoins: PA.dareCoins, dared: PA.dared, marks: PA.marks, line: PA.line, trace: PA.trace,
  on(type, d) { if (type === 'open' && d.fresh) PA.session(d.save); },
});

// ---- the game's side
// a save was loaded or swapped: look at the purse without filing anything
export function boot(save) { HUB.reset(); HUB.ask('ledger', 'prime', [save]); }
// the game came to the front. from: the reminder it was opened from ('' = by himself). -> { fresh, awayH, reminder }
export function open(save, now = Date.now(), from = '') {
  const awayH = HUB.ask('pulse', 'away', [save, now], 0);
  const fresh = !!HUB.ask('pulse', 'open', [save, now], false);
  HUB.emit('open', { save, now, fresh, awayH, from });
  const reminder = HUB.ask('herald', 'opened', [save, from, now], null);
  return { fresh, awayH, reminder };
}
// the game went to the background. ctx: what is waiting (see herald.reasons) + { hour, child, waiting, screen, level, lastWon }. -> the reminder to schedule, or null
export function close(save, ctx = {}, now = Date.now()) {
  HUB.emit('close', { save, ctx, now });
  const F = HUB.ask('pulse', 'facts', [save, now], null), P = HUB.ask('oracle', 'predict', [save, { now }], null);
  // the Conductor decides between the engines that want the same day's note (one leads): the spin's, the Director's, the chest's
  const lead = (cands, moment) => { const r = HUB.ask('conduct', 'lead', [save, moment, cands, { now, walked: true, quiet: true, predict: P || undefined }], null); return r && r.order; };
  return HUB.ask('herald', 'plan', [save, { ...ctx, hour: F ? F.bestHour : -1, seg: segment(save, now), lead }, now], null);
}
export function levelStart(save, ctx = {}, now = Date.now()) { HUB.emit('levelStart', { save, ctx, now }); }
// a level ended. r: { id, won, secs, near }; ctx: { hard, videoShown, coinShown, rewound, boosts }
export function result(save, r, ctx = {}, now = Date.now()) { HUB.emit('result', { save, r, ctx, now }); }
export function video(save) { HUB.emit('video', { save }); }
// file what changed in the purse since the last look, and note the sign of life
export function sync(save, why, day, now = Date.now()) {
  const d = HUB.ask('ledger', 'sync', [save, why, day], null);
  if (d && d.coins < 0) HUB.emit('spent', { save, coins: -d.coins });
  HUB.emit('tick', { save, now });
  return d;
}
export const lead = (save, moment, cands, ctx = {}) => HUB.ask('conduct', 'lead', [save, moment, cands, ctx], { lead: null, order: [], held: [], why: 'conductor off' });
export const suggest = (save, items, ctx = {}) => HUB.ask('conduct', 'suggest', [save, items, ctx], null);
export const predict = (save, ctx = {}) => HUB.ask('oracle', 'predict', [save, ctx], null);
export const flow = (save) => HUB.ask('ledger', 'flow', [save], null);
export const facts = (save, now = Date.now()) => HUB.ask('pulse', 'facts', [save, now], null);
export const herald = {
  shouldAsk: (save, ctx) => !!HUB.ask('herald', 'shouldAsk', [save, ctx], false),
  askNow: (save, ctx, now = Date.now()) => !!HUB.ask('herald', 'askNow', [save, ctx, now], false),
  noteAsk: (save, ctx, now = Date.now()) => HUB.ask('herald', 'noteAsk', [save, ctx, now]),
  waiting: (save, ctx, now = Date.now()) => !!HUB.ask('herald', 'waiting', [ctx, now], false),
  answer: (save, yes, now = Date.now()) => HUB.ask('herald', 'answer', [save, yes, now]),
  setOff: (save, off) => HUB.ask('herald', 'setOff', [save, off]),
  state: (save) => HUB.ask('herald', 'state', [save], { ok: 0, off: false, ignored: 0, asks: 0, plan: null }),
};
// what was shown and taken: ids are the game's own button names; seconds per screen
export const tally = {
  seen: (save, id) => HUB.ask('tally', 'seen', [save, id]),
  took: (save, id) => HUB.ask('tally', 'took', [save, id]),
  screen: (save, name, secs, level) => HUB.ask('tally', 'screen', [save, name, secs, level]),
  table: (save) => HUB.ask('tally', 'table', [save], null),
};
// the Pacer (src/engine/pacer.js): every answer falls back to the plain game (no pop-up, no dare, no gift, no mark)
const NO_PLAN = { ask: false, hint: false, scare: false, gift: false, why: 'pacer off' };
export const pacer = {
  read: (save, ctx = {}) => HUB.ask('pacer', 'read', [save, ctx], null),
  failPlan: (save, ctx = {}) => HUB.ask('pacer', 'failPlan', [save, ctx], NO_PLAN),
  asked: (save, id) => HUB.ask('pacer', 'asked', [save, id]),
  declined: (save, id) => HUB.ask('pacer', 'declined', [save, id]),
  retryGift: (save, id) => !!HUB.ask('pacer', 'retryGift', [save, id], false),
  gave: (save, id, kind) => HUB.ask('pacer', 'gave', [save, id, kind]),
  losses: (save, id) => HUB.ask('pacer', 'losses', [save, id], 0),
  restart: (save, id, info) => !!HUB.ask('pacer', 'restart', [save, id, info], false),
  result: (save, r) => HUB.ask('pacer', 'result', [save, r]),
  card: (save, secs) => HUB.ask('pacer', 'card', [save, secs]),
  cards: (save) => HUB.ask('pacer', 'cards', [save], 'all'),
  dareFor: (save, ctx = {}) => HUB.ask('pacer', 'dareFor', [save, ctx], null),
  dareTake: (save, id, took) => HUB.ask('pacer', 'dareTake', [save, id, took]),
  dareStart: (save, id) => HUB.ask('pacer', 'dareStart', [save, id], null),
  dareMet: (d, F) => !!HUB.ask('pacer', 'dareMet', [d, F], false),
  dareCoins: (coins) => HUB.ask('pacer', 'dareCoins', [coins], 0),
  dared: (save, id) => !!HUB.ask('pacer', 'dared', [save, id], false),
  marks: (save, ctx = {}) => HUB.ask('pacer', 'marks', [save, ctx], []),
  trace: (save) => HUB.ask('pacer', 'trace', [save], []),
};
// the speed log's lines: one per subsystem, and who is up
export function lines(save, ctx = {}) {
  return {
    hub: HUB.healthLine(),
    ledger: HUB.ask('ledger', 'line', [save], 'off'),
    pulse: HUB.ask('pulse', 'line', [save, ctx.now || Date.now()], 'off'),
    oracle: HUB.ask('oracle', 'line', [save, ctx], 'off'),
    herald: HUB.ask('herald', 'line', [save], 'off'),
    tally: HUB.ask('tally', 'line', [save], 'off'),
    pacer: HUB.ask('pacer', 'line', [save], 'off'),
  };
}
export { HUB };
