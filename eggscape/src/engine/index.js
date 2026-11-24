// The engine room: registers the background subsystems on the hub and gives the game ONE small, safe face to them
// (0.8.15). The game (main.js) calls only what is exported here; every export goes through the hub, so nothing in here
// can throw into the game, and one subsystem failing leaves the others running.
//
//   Ledger   coins and items in and out            src/engine/ledger.js
//   Pulse    the record of play                    src/engine/pulse.js
//   Oracle   predictions, graded                   src/engine/oracle.js
//   Conduct  one thing leads at each moment        src/engine/conduct.js   (asks the Brain's gate, src/brain.js)
//   Herald   one local reminder                    src/engine/herald.js
// The Director (help on a hard level), the Spin (wheel rules), the shop and the offers keep their own modules; the
// Conductor is where they meet.
import * as HUB from './hub.js';
import * as LE from './ledger.js';
import * as PU from './pulse.js';
import * as OR from './oracle.js';
import * as CO from './conduct.js';
import * as HE from './herald.js';

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
  predict: OR.predict, line: OR.line, trusted: OR.trusted,
  on(type, d) {
    const s = d.save;
    if (type === 'levelStart') {
      // what was offered on the last card and not taken is a "no"
      OR.settle(s, 'video', false); OR.settle(s, 'coins', false);
      OR.pose(s, 'win', OR.predict(s, d.ctx).win.p, 'L' + d.ctx.levelId, d.now);
    } else if (type === 'result') {
      OR.settle(s, 'win', !!d.r.won, 'L' + d.r.id);
      const P = OR.predict(s, { ...d.ctx, levelId: d.r.id, now: d.now });
      if (d.ctx && d.ctx.videoShown) OR.pose(s, 'video', P.video.p, 'card', d.now);
      if (d.ctx && d.ctx.coinShown) OR.pose(s, 'coins', P.coins.p, 'card', d.now);
    } else if (type === 'video') OR.settle(s, 'video', true);
    else if (type === 'spent') OR.settle(s, 'coins', true);
    else if (type === 'close') OR.pose(s, 'back', OR.predict(s, { ...d.ctx, now: d.now }).back.p, 'day', d.now);
    else if (type === 'open' && d.fresh) {
      // "comes back" means the next day, not five minutes later: a short pause leaves the prediction open
      const q = OR.openOf(s, 'back');
      if (q && d.now - q.t >= 6 * HOUR) OR.settle(s, 'back', d.now - q.t <= 36 * HOUR);
    }
  },
});
HUB.add('conduct', { lead: CO.lead, suggest: CO.suggest });
HUB.add('herald', {
  plan: HE.plan, opened: HE.opened, shouldAsk: HE.shouldAsk, answer: HE.answer, setOff: HE.setOff, line: HE.line,
  state: (save) => { const H = HE.herState(save); return { ok: H.ok, off: H.off, ignored: H.ignored }; },
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
// the game went to the background. ctx: what is waiting (see herald.reasons) + { hour, child, waiting }. -> the reminder to schedule, or null
export function close(save, ctx = {}, now = Date.now()) {
  HUB.emit('close', { save, ctx, now });
  const F = HUB.ask('pulse', 'facts', [save, now], null);
  return HUB.ask('herald', 'plan', [save, { ...ctx, hour: F ? F.bestHour : -1 }, now], null);
}
export function levelStart(save, ctx = {}, now = Date.now()) { HUB.emit('levelStart', { save, ctx, now }); }
// a level ended. r: { id, won, secs, near }; ctx: { hard, videoShown, coinShown }
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
  answer: (save, yes, now = Date.now()) => HUB.ask('herald', 'answer', [save, yes, now]),
  setOff: (save, off) => HUB.ask('herald', 'setOff', [save, off]),
  state: (save) => HUB.ask('herald', 'state', [save], { ok: 0, off: false, ignored: 0 }),
};
// the speed log's lines: one per subsystem, and who is up
export function lines(save, ctx = {}) {
  return {
    hub: HUB.healthLine(),
    ledger: HUB.ask('ledger', 'line', [save], 'off'),
    pulse: HUB.ask('pulse', 'line', [save, ctx.now || Date.now()], 'off'),
    oracle: HUB.ask('oracle', 'line', [save, ctx], 'off'),
    herald: HUB.ask('herald', 'line', [save], 'off'),
  };
}
export { HUB };
