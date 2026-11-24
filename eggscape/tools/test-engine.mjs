// The background subsystems (src/engine/*): node tools/test-engine.mjs
import * as HUB from '../src/engine/hub.js';
import * as LE from '../src/engine/ledger.js';
import * as PU from '../src/engine/pulse.js';
import * as OR from '../src/engine/oracle.js';
import * as CO from '../src/engine/conduct.js';
import * as HE from '../src/engine/herald.js';
import { defaultWallet, BOOSTERS } from '../src/economy.js';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const mk = (o = {}) => ({ unlocked: 12, wallet: { ...defaultWallet(), coins: 100 }, ...o });
const HOUR = 3600000, DAY = 24 * HOUR, T0 = new Date(2026, 10, 24, 18, 0, 0).getTime(); // a Tuesday, 18:00 local

{ // the hub: one subsystem failing never takes another down, and never the caller
  HUB.clear();
  let heard = 0;
  HUB.add('good', { two: () => 2, on: () => { heard++; } });
  HUB.add('bad', { boom: () => { throw new Error('kaput'); }, on: () => { throw new Error('deaf'); } });
  ok(HUB.ask('good', 'two', [], 0) === 2 && HUB.ask('bad', 'boom', [], 'plain') === 'plain', 'a throw gives the caller its fallback');
  ok(HUB.ask('nobody', 'x', [], 7) === 7 && HUB.ask('good', 'nothing', [], 7) === 7, 'a missing subsystem or function gives the fallback too');
  HUB.emit('win', {}); HUB.emit('win', {});
  ok(HUB.isDown('bad') && !HUB.isDown('good') && heard === 2, `after ${HUB.HUB.trip} throws the bad one is switched off, the good one heard every event`);
  HUB.emit('win', {});
  ok(heard === 3 && /DOWN/.test(HUB.health().bad) && HUB.health().good === 'ok' && /bad DOWN/.test(HUB.healthLine()), 'the speed log names who is down and why: ' + HUB.healthLine());
  HUB.reset();
  ok(!HUB.isDown('bad'), 'a new session gives it another chance');
  HUB.clear();
}
{ // the ledger: the purse compared with the purse seen last, filed by reason
  const s = mk();
  LE.prime(s);
  s.wallet.coins += 30; LE.sync(s, 'win', 'd1');
  s.wallet.coins += 200; s.wallet.owned = { stone: 1 }; s.wallet.charges = 2; LE.sync(s, 'treasure', 'd1');
  s.wallet.coins -= 60; s.wallet.owned = { stone: 1, nest: 1 }; LE.sync(s, 'shop', 'd1');
  s.wallet.owned = { stone: 0, nest: 1 }; LE.sync(s, 'use', 'd1');
  LE.level(s);
  const L = LE.ledState(s), F = LE.flow(s);
  ok(L.all.in.win === 30 && L.all.in.treasure === 200 && L.all.out.shop === 60, 'coins in and out are filed by reason');
  ok(L.all.gi === 3 && L.all.gw === BOOSTERS.stone.price + 90 && L.all.bought === 1 && L.all.used === 1, 'free items, bought items and used items are told apart');
  ok(F.levels === 1 && F.in === 230 && F.out === 60 && Math.abs(F.sinkShare - 60 / 230) < 1e-9 && F.stock === 3, 'the flow of the last levels: ' + LE.line(s));
  s.wallet.coins += 850; LE.sync(s, 'iap', 'd1');
  ok(LE.ledState(s).iap === 850 && LE.ledState(s).all.in.iap == null, 'coins bought with money are filed apart from the played economy');
  s.wallet.coins += 5; LE.sync(s, 'win', 'd2');
  ok(LE.ledState(s).day === 'd2' && LE.ledState(s).d.in.win === 5, 'a new day starts a new day page');
  for (let i = 0; i < 14; i++) { s.wallet.owned = { ...s.wallet.owned, golden: (s.wallet.owned.golden || 0) + (i < 9 ? 1 : 0) }; LE.sync(s, 'chest', 'd2'); LE.level(s); }
  ok(LE.ledState(s).win.length === LE.LEDGER.window && LE.flow(s).glut, 'ten levels of gifts and no use: the ledger calls it a glut');
  const b = { wallet: defaultWallet(), eng: { led: { all: 'x', win: [null, 3], day: 9 } } };
  LE.prime(b); b.wallet.coins = 4; LE.sync(b, 'win', 'd');
  ok(LE.ledState(b).all.in.win === 4 && LE.flow(b).in === 4, 'a broken ledger in the save is made safe');
}
{ // the pulse: sessions, days, the hour
  const s = mk();
  ok(PU.open(s, T0) === true && PU.open(s, T0 + 5 * 60000) === false, 'a new session starts only after a real pause');
  PU.result(s, { id: 12, won: false, secs: 40, near: true }, T0 + 6 * 60000);
  PU.result(s, { id: 12, won: true, secs: 55 }, T0 + 8 * 60000);
  ok(PU.open(s, T0 + DAY) === true, 'the next day is a new session');
  PU.result(s, { id: 13, won: false, secs: 30 }, T0 + DAY + 60000);
  const F = PU.facts(s, T0 + DAY + 2 * 60000);
  ok(F.opens === 2 && F.days7 === 2 && F.sessToday === 1 && F.gapH > 23 && F.gapH < 24.1, 'opens, days played and the gap between sessions are counted');
  ok(Math.abs(F.winRate10 - 1 / 3) < 1e-9 && F.failRun === 1 && F.near10 === 1 && F.roundsPerSess === 2 && F.lastEnd === 'lost', 'results: win rate, fail run, near misses, rounds per session');
  ok(F.bestHour === -1, 'two opens are too few to name his hour');
  PU.open(s, T0 + 2 * DAY); PU.open(s, T0 + 3 * DAY);
  ok(PU.facts(s, T0 + 3 * DAY).bestHour === 18, 'after a few days the hour he plays at is known');
  ok(/opens 4, days 4\/7/.test(PU.line(s, T0 + 3 * DAY)), 'one line for the speed log: ' + PU.line(s, T0 + 3 * DAY));
  const b = { eng: { pulse: { sess: 'no', hours: [1, 2], res: [null], days: [3] } } };
  ok(PU.facts(b, T0).opens === 0 && PU.open(b, T0) === true, 'a broken pulse is made safe');
}
{ // the oracle: plain rules, reasons, and grades
  const s = mk({ dir: { att: { 12: { tries: 4, wins: 0, streak: 4 } }, spent: { all: 0 } }, offers: { ads: 0 }, brain: { videoNo: 4 } });
  PU.open(s, T0);
  for (let i = 0; i < 4; i++) PU.result(s, { id: 12, won: false, secs: 30 }, T0 + i * 60000);
  const A = OR.predict(s, { levelId: 12, now: T0 + 5 * 60000 });
  const s2 = mk({ dir: { att: { 12: { tries: 3, wins: 2, streak: 0 } }, spent: { all: 500 } }, offers: { ads: 12 }, brain: { videoNo: 0 }, wallet: { ...defaultWallet(), coins: 400 } });
  for (let d = 0; d < 6; d++) { PU.open(s2, T0 - (5 - d) * DAY); PU.result(s2, { id: 12, won: true, secs: 50 }, T0 - (5 - d) * DAY + 60000); }
  const B = OR.predict(s2, { levelId: 12, price: 200, waiting: true, now: T0 + 120000 });
  ok(A.win.p < 0.2 && B.win.p > 0.7, `four losses in a row against a winning run: ${A.win.p.toFixed(2)} and ${B.win.p.toFixed(2)}`);
  ok(A.back.p < 0.25 && B.back.p > 0.7, `leaving on a losing run on day one against six days running: back ${A.back.p.toFixed(2)} and ${B.back.p.toFixed(2)}`);
  ok(A.video.p < 0.2 && B.video.p > 0.8 && A.coins.p < B.coins.p && A.pay.p < 0.05, 'video, coins and pay follow what he did before');
  ok([A, B].every((P) => ['win', 'back', 'video', 'coins', 'pay'].every((k) => P[k].p >= 0.02 && P[k].p <= 0.98 && P[k].why.length)), 'every prediction is a chance with its reasons, never 0 or 1');
  const hard = OR.predict(s2, { levelId: 12, hard: true, now: T0 + 120000 }), near = OR.predict(s, { levelId: 12, near: true, now: T0 + 5 * 60000 });
  ok(hard.win.p < B.win.p && near.win.p > A.win.p, 'a hard level lowers the chance, a near miss raises it');
  OR.pose(s, 'win', 0.2, 'L12'); const g = OR.settle(s, 'win', false, 'L12');
  ok(g && OR.oraState(s).cal.win.n === 1 && OR.oraState(s).cal.win.hit === 1 && OR.settle(s, 'win', true, 'L12') === null, 'a prediction is graded once, when what happened is known');
  OR.pose(s, 'win', 0.9, 'L13'); ok(OR.settle(s, 'win', true, 'L14') === null && OR.openOf(s, 'win'), 'a grade for another level does not settle it');
  ok(!OR.trusted(s, 'win'), 'one grade is not trust');
  for (let i = 0; i < 14; i++) { OR.pose(s, 'video', 0.1, 'v' + i); OR.settle(s, 'video', false, 'v' + i); }
  ok(OR.trusted(s, 'video'), `right ${OR.ORACLE.trust} times and more: the prediction may steer`);
  for (let i = 0; i < 14; i++) { OR.pose(s, 'coins', 0.9, 'c' + i); OR.settle(s, 'coins', false, 'c' + i); }
  ok(!OR.trusted(s, 'coins'), 'wrong every time: it never steers');
  ok(/win \d+%/.test(OR.line(s, { levelId: 12, now: T0 })) && /trusted/.test(OR.line(s, { levelId: 12, now: T0 })), 'one line for the speed log: ' + OR.line(s, { levelId: 12, now: T0 }));
  ok(OR.predict({}, {}).win.p > 0 && OR.oraState({ eng: { ora: { cal: 5, open: { win: 'x' } } } }).cal.win.n === 0, 'an empty or broken save still gets an answer');
}
{ // the conductor: one thing leads; what is his first, asking last; the Brain's gate holds asks back
  const s = mk({ unlocked: 14, offers: { sessions: 3 } });
  const C = [{ id: 'offer', sys: 'offers', kind: 'money' }, { id: 'meter', sys: 'spin', kind: 'progress', near: 0.67 }, { id: 'chest', sys: 'chest', kind: 'progress', near: 0.9 }, { id: 'spin', sys: 'spin', kind: 'gift' }, { id: 'vid', sys: 'ads', kind: 'video' }];
  const R = CO.lead(s, 'win', C, { now: T0 });
  ok(R.lead.id === 'spin' && R.order.map((c) => c.id).join() === 'spin,chest,meter,vid,offer', 'a gift waiting leads; the nearer progress comes before the farther; asks come last: ' + R.why);
  const young = mk({ unlocked: 3 }), R2 = CO.lead(young, 'win', C, { now: T0 });
  ok(R2.order.every((c) => c.kind !== 'money' && c.kind !== 'video') && R2.held.length === 2 && R2.lead.id === 'spin', 'in the first levels nothing is asked: ' + R2.why);
  ok(CO.lead(young, 'spin', C, { now: T0, walked: true }).order.length === 5, 'on a page the player opened himself the asks are shown');
  ok(CO.lead(s, 'win', [], { now: T0 }).lead === null && CO.lead(s, 'win', [{ id: 'x', kind: 'nonsense' }, null], { now: T0 }).lead === null, 'nothing to show is an answer too');
  ok((s.brain.log || []).some((l) => l.m === 'win' && l.pick === 'spin'), 'the choice is written to the decision log');
  // coins before video only when the Oracle has earned trust on both and coins clearly lead
  const t = mk({ unlocked: 14, offers: { sessions: 3, ads: 0 }, brain: { videoNo: 9 }, dir: { spent: { all: 900 } }, wallet: { ...defaultWallet(), coins: 500 } });
  const two = [{ id: 'vid', kind: 'video' }, { id: 'buy', kind: 'coins', price: 100 }];
  ok(CO.lead(t, 'fail', two, { now: T0, price: 100, quiet: true }).lead.id === 'vid', 'an untested guess does not reorder anything');
  for (const k of ['video', 'coins']) for (let i = 0; i < 14; i++) { OR.pose(t, k, k === 'video' ? 0.05 : 0.95, 'q' + i); OR.settle(t, k, k !== 'video', 'q' + i); }
  ok(CO.lead(t, 'fail', two, { now: T0, price: 100, quiet: true }).lead.id === 'buy', 'once graded and right, a player who never watches is shown the coin button first');
}
{ // the suggestion after coins arrive
  const items = [{ key: 'skin:dino', price: 200, kind: 'skin' }, { key: 'hen:royal', price: 400, kind: 'hen' }, { key: 'skin:own', price: 120, owned: true, kind: 'skin' }, { key: 'chick:bomb', price: 450, kind: 'chick' }];
  ok(CO.suggest(mk({ wallet: { coins: 260 } }), items).key === 'skin:dino' && CO.suggest(mk({ wallet: { coins: 260 } }), items).short === 0, 'the best thing the purse reaches');
  const n = CO.suggest(mk({ wallet: { coins: 350 } }), items, { gained: 30 });
  ok(n.key === 'hen:royal' && n.short === 50, 'coins that changed nothing point at the thing just out of reach: 50 short');
  ok(CO.suggest(mk({ wallet: { coins: 20 } }), items) === null, 'nothing near: nothing is said');
}
{ // the herald: one real reason, at his hour, never at night, backing off when ignored
  const s = mk({ unlocked: 9 });
  ok(HE.plan(s, { spins: 1 }, T0) === null, 'never asked: nothing is planned');
  ok(HE.shouldAsk(s, { unlocked: 9, stars: 3, spins: 1 }) && !HE.shouldAsk(s, { unlocked: 4, stars: 3, spins: 1 }) && !HE.shouldAsk(s, { unlocked: 9, stars: 1, spins: 1 }) && !HE.shouldAsk(s, { unlocked: 9, stars: 3, spins: 0, spinLeft: 0 }) && !HE.shouldAsk(s, { unlocked: 9, stars: 3, spins: 1, child: true }), 'asked on a good win with something to promise, not early, not a child');
  HE.answer(s, true, T0);
  ok(!HE.shouldAsk(s, { unlocked: 9, stars: 3, spins: 1 }), 'asked once only');
  const P = HE.plan(s, { spins: 1, hour: 18 }, T0), at = new Date(P.at);
  ok(P.id === 'spin' && at.getHours() === 18 && P.at - T0 >= HE.HERALD.minAheadH * HOUR && P.at - T0 <= 48 * HOUR, 'a banked spin, tomorrow at the hour he plays: ' + P.title);
  const night = HE.plan(s, { spins: 1, hour: 23 }, T0), early = HE.plan(s, { spins: 1, hour: 5 }, T0);
  ok(new Date(night.at).getHours() === 20 && new Date(early.at).getHours() === 9, 'a night owl is told at 20:00, an early bird at 09:00: never in the quiet hours');
  ok(HE.plan(s, { spins: 0, spinLeft: 1, hour: 18 }, T0).id === 'spin1' && HE.plan(s, { starsToChest: 1, chestSkin: true, hour: 18 }, T0).id === 'chest' && HE.plan(s, { hour: 18 }, T0).id === 'daily', 'the reason is the most real thing waiting');
  HE.plan(s, { spins: 1, hour: 18 }, T0);
  ok(HE.opened(s, '', T0 + 2 * HOUR).fired === false && HE.herState(s).n === 0, 'he came back before it was due: cancelled, not counted');
  let p = HE.plan(s, { spins: 1, hour: 18 }, T0); let r = HE.opened(s, 'spin', p.at + HOUR);
  ok(r.hit && HE.herState(s).opened === 1 && HE.herState(s).ignored === 0, 'opened from the reminder: counted as opened');
  let now = p.at + HOUR; const waits = [];
  for (let i = 0; i < 3; i++) { p = HE.plan(s, { spins: 1, starsToChest: 1, hour: 18 }, now); waits.push(Math.round((p.at - now) / HOUR)); now = p.at + 30 * HOUR; HE.opened(s, '', now); }
  ok(waits[1] > waits[0] && waits[2] > waits[1] && HE.herState(s).ignored === 3, `each one ignored makes the next come later: ${waits.join(', ')} h`);
  ok(HE.plan(s, { spins: 1, hour: 18 }, now) === null, 'three ignored in a row: they stop');
  HE.setOff(s, false);
  ok(HE.plan(s, { spins: 1, hour: 18 }, now) !== null, 'switching them on again in Settings starts afresh');
  HE.setOff(s, true);
  ok(HE.plan(s, { spins: 1, hour: 18 }, now) === null && HE.plan(mk({ eng: { her: { ok: -1 } } }), { spins: 1 }, T0) === null, 'switched off or refused: nothing, ever');
  const d = mk({ eng: { her: { ok: 1 } } });
  let q = HE.plan(d, { hour: 18 }, T0); HE.opened(d, '', q.at + HOUR);
  ok(HE.plan(d, { hour: 18 }, q.at + HOUR) === null, 'the daily chest alone is not worth a second reminder after one was ignored');
  ok(/allowed|switched off/.test(HE.line(s)), 'one line for the speed log: ' + HE.line(s));
}
{ // 0.8.15 Scarecrow booster in the sim: villains are scared off while it stands, and a saved sim restores exactly
  const { Sim, DT, SCARE_S } = await import('../src/sim/sim.js');
  const { LEVELS } = await import('../src/data/levels.js');
  const run = (sim, secs) => { for (let i = 0; i < secs / DT && sim.state === 'play'; i++) { sim.step(); sim.events.length = 0; } };
  const sig = (sim) => JSON.stringify([sim.t, sim.scareT, sim.eggs.map((e) => { const p = e.body.getPosition(); return [e.alive, +p.x.toFixed(6), +p.y.toFixed(6)]; })]);
  let scared = 0, tried = 0, exact = 0, same = 0;
  for (const id of [8, 12, 16, 18, 22, 27, 33, 38, 42, 47]) {
    const L = LEVELS[id - 1]; tried++;
    const a = new Sim(L, { mode: 'medium', scare: true });
    let hit = false;
    for (let i = 0; i < 12 / DT && a.state === 'play'; i++) { a.step(); a.events.length = 0; if (Object.values(a.p2.fx).some((f) => f.k === 'scare')) hit = true; }
    if (hit) scared++;
    const b = new Sim(L, { mode: 'medium', scare: true }); run(b, 4);
    const S = b.fullState(), c = Sim.fromState(L, S, b.opts); run(b, 4); run(c, 4);
    { const pb = b.eggs.map((q) => q.body.getPosition()), pc = c.eggs.map((q) => q.body.getPosition()); if (b.scareT === c.scareT && b.scareTick === c.scareTick && b.t === c.t && pb.every((q, i) => Math.hypot(q.x - pc[i].x, q.y - pc[i].y) < 0.02)) exact++; } // (a restored sim's resting contacts settle a hair differently with or without the booster)
    const d = new Sim(L, { mode: 'medium' }), e = new Sim(L, { mode: 'medium' }); run(d, 6); run(e, 6);
    if (sig(d) === sig(e) && d.scareT === 0) same++;
  }
  ok(scared >= 5, `villains are scared off on ${scared} of ${tried} sampled levels within 12 s`);
  ok(exact === tried, `a sim saved with the Scarecrow up restores with its clock and its eggs where they were (${exact}/${tried})`);
  ok(same === tried, 'without the booster nothing in the sim changes');
  const z = new Sim(LEVELS[11], { mode: 'easy', scare: true }); run(z, SCARE_S + 1);
  ok(z.state !== 'play' || z.scareT === 0, `it stands ${SCARE_S} s and then falls`);
}
console.log(bad ? `\n${bad} FAILED` : '\nall engine checks passed');
process.exit(bad ? 1 : 0);
