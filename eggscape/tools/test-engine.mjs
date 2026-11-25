// The background subsystems (src/engine/*): node tools/test-engine.mjs
import * as HUB from '../src/engine/hub.js';
import * as LE from '../src/engine/ledger.js';
import * as PU from '../src/engine/pulse.js';
import * as OR from '../src/engine/oracle.js';
import * as CO from '../src/engine/conduct.js';
import * as HE from '../src/engine/herald.js';
import * as TA from '../src/engine/tally.js';
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
{ // the oracle learns on the phone: the rules' guess is corrected by what this player really did, and only while that is better
  const run = (s, key, p0, yesOf10, n) => { for (let i = 0; i < n; i++) { OR.pose(s, key, { p: OR.predict(s, {}).win.p, p0 }, 'q' + i); OR.settle(s, key, (i % 10) < yesOf10, 'q' + i); } return OR.oraState(s); };
  const s = mk(), O = run(s, 'win', 0.7, 3, 40), f = O.fit.win, b = O.base.win;
  const p1 = 1 / (1 + Math.exp(-(f.a * Math.log(0.7 / 0.3) + f.b)));
  ok(f.n === 40 && b.n === 40 && f.sq / f.n < b.sq / b.n && OR.learned(s, 'win'), `rules say 70%, he wins 3 in 10: after 40 grades the learned guess is better (brier ${(f.sq / f.n).toFixed(3)} against ${(b.sq / b.n).toFixed(3)}) and in use`);
  ok(Math.abs(p1 - 0.3) < 0.15, `and it now says ${(p1 * 100).toFixed(0)}% where the rules say 70%`);
  const few = run(mk(), 'win', 0.7, 3, OR.LEARN.min - 1);
  ok(!OR.learned(few, 'win'), `under ${OR.LEARN.min} grades nothing learned is used`);
  const s3 = mk(), O3 = run(s3, 'win', 0.7, 7, 60), f3 = O3.fit.win, q3 = 1 / (1 + Math.exp(-(f3.a * Math.log(0.7 / 0.3) + f3.b)));
  ok(!OR.learned(s3, 'win') || Math.abs(q3 - 0.7) < 0.08, `rules that are already right are left alone (learned ${OR.learned(s3, 'win') ? 'in use' : 'not in use'}, it would say ${(q3 * 100).toFixed(0)}%)`);
  // inside predict(): the served chance moves, the rules' own chance stays readable, and the reason is said
  const s4 = mk({ dir: { att: {}, spent: { all: 0 } } }), ctx = { levelId: 5, now: T0 };
  const before = OR.predict(s4, ctx).win;
  for (let i = 0; i < 30; i++) { OR.pose(s4, 'win', OR.predict(s4, ctx).win, 'L5'); OR.settle(s4, 'win', false, 'L5'); }
  const after = OR.predict(s4, ctx).win;
  ok(!before.fit && before.p === before.p0 && after.fit && after.p0 === before.p0 && after.p < after.p0 - 0.1 && after.why.some((w) => /learned on this phone/.test(w)), `a player who keeps losing where the rules expect wins: ${(after.p0 * 100).toFixed(0)}% by the rules, ${(after.p * 100).toFixed(0)}% learned, with the reason`);
  const P5 = OR.predict(s4, ctx); ok(['back', 'video', 'coins', 'pay'].every((k) => !P5[k].fit && P5[k].p === P5[k].p0), 'what was learned about one kind of guess changes no other');
  // the way back: the day the learned guess is no better than the rules, the rules answer again
  const O4 = OR.oraState(s4); O4.fit.win.sq = O4.base.win.sq + 1;
  ok(!OR.learned(s4, 'win') && OR.predict(s4, ctx).win.p === before.p0 && !OR.predict(s4, ctx).win.fit, 'when the learned guess stops being better, the rules are back by themselves');
  // it cannot run away, and a broken save cannot poison it
  const s6 = mk(), O6 = run(s6, 'pay', 0.02, 10, 600), f6 = O6.fit.pay;
  ok(f6.a >= OR.LEARN.aMin && f6.a <= OR.LEARN.aMax && Math.abs(f6.b) <= OR.LEARN.bMax && OR.predict(s6, {}).pay.p <= 0.98 && OR.predict(s6, {}).pay.p >= 0.02, `600 grades one way: lean ${f6.b.toFixed(2)} and sharpness ${f6.a.toFixed(2)} stay inside their limits`);
  const bust = OR.oraState({ eng: { ora: { fit: { win: { a: 'x', b: 1e9, n: -4, sq: NaN } }, base: 7, open: { win: { p: 0.4, id: 'L1', t: 1 } } } } });
  ok(bust.fit.win.a === 1 && bust.fit.win.b === OR.LEARN.bMax && bust.fit.win.n === 0 && bust.fit.win.sq === 0 && bust.base.win.n === 0 && bust.open.win.p0 === 0.4, 'a broken or older save is read safely (a guess noted before this build is graded as the rules\' own)');
  ok(/rules \d\.\d\d learned \d\.\d\d in use/.test(OR.line(s, {})), 'the speed log shows rules against learned: ' + OR.line(s, {}).split(' | ')[0]);
}
{ // the tally: what was shown, what was taken, where the time went; counts only
  const s = mk();
  for (let i = 0; i < 5; i++) TA.seen(s, 'double'); TA.took(s, 'double'); TA.took(s, 'win:shop');
  const T = TA.talState(s);
  ok(T.b.double[0] === 5 && T.b.double[1] === 1 && T.b['win:shop'][0] === 1 && T.b['win:shop'][1] === 1, 'shown five times, taken once; a tap on something never counted as shown still counts as shown once');
  TA.screen(s, 'play', 62.4, 7); TA.screen(s, 'store', 20, 7); TA.screen(s, 'store', 9000, 9);
  ok(T.sc.play === 62 && T.sc.store === 20 + TA.TALLY.maxSecs && T.shop.n === 2 && T.shop.first === 7, 'seconds per screen (a phone left lying counts ten minutes at most), the shop\'s visits and the level of the first one');
  TA.level(s, { id: 7, won: false, secs: 40, near: true }, { rewound: true, boosts: 2 }); TA.level(s, { id: 7, won: true, secs: 55 }, {});
  ok(T.lv[7].join(',') === '2,1,95,1,1,2', 'a row per level: tries, wins, seconds, one egg short, Rewinds, boosters: ' + T.lv[7].join(','));
  for (let i = 0; i < 20; i++) TA.leave(s, i % 2 ? 'fail' : 'levels', 7, false, T0 + i);
  ok(T.end.length === TA.TALLY.ends && T.end[T.end.length - 1].sc === 'fail', 'the last sessions\' ends are kept, the oldest dropped');
  for (let i = 0; i < 300; i++) TA.seen(s, 'x' + i);
  ok(Object.keys(T.b).length === TA.TALLY.ids && JSON.stringify(TA.table(s)).length < 6000, `it cannot grow without end: ${Object.keys(T.b).length} names, ${JSON.stringify(TA.table(s)).length} bytes`);
  const back = TA.talState({ eng: { tal: JSON.parse(JSON.stringify(TA.table(s))) } });
  ok(back.b.double[0] === 5 && back.lv[7][2] === 95 && back.shop.first === 7, 'it survives being saved and loaded');
  const bust = TA.talState({ eng: { tal: { b: { 'a<b>': [1, 2], ok: 'x', fine: [-3, 2.7] }, sc: 7, lv: { x: [1], 3: [1, 'a'] }, end: [null, { sc: 'play<', lv: -2 }] } } });
  ok(!bust.b.ok && bust.b.fine[0] === 0 && bust.b.fine[1] === 2 && bust.lv[3].join(',') === '1,0,0,0,0,0' && bust.end.length === 1 && bust.end[0].sc === 'play', 'a broken save is read safely');
  ok(/double 1\/5 \(20%\)/.test(TA.line(s)) && /shop opened 2 \(first at level 7\)/.test(TA.line(s)), 'one line for the speed log: ' + TA.line(s).slice(0, 150));
}
{ // the conductor: one thing leads; what is his first, asking last; the Brain's gate holds asks back
  const s = mk({ unlocked: 14, offers: { sessions: 3 } });
  const C = [{ id: 'offer', sys: 'offers', kind: 'money' }, { id: 'meter', sys: 'spin', kind: 'progress', near: 0.67 }, { id: 'chest', sys: 'chest', kind: 'progress', near: 0.9 }, { id: 'spin', sys: 'spin', kind: 'gift' }, { id: 'vid', sys: 'ads', kind: 'video' }];
  const R = CO.lead(s, 'win', C, { now: T0 });
  ok(R.lead.id === 'spin' && R.order.map((c) => c.id).join() === 'spin,chest,meter,vid,offer', 'a gift waiting leads; the nearer progress comes before the farther; asks come last: ' + R.why);
  const young = mk({ unlocked: 3 }), R2 = CO.lead(young, 'win', C, { now: T0 });
  ok(R2.order.every((c) => c.kind !== 'money' && c.kind !== 'video') && R2.held.length === 2 && R2.lead.id === 'spin', 'in the first levels nothing is asked: ' + R2.why);
  ok(CO.lead(young, 'spin', C, { now: T0, walked: true }).order.length === 5, 'on a page the player opened himself the asks are shown');
  { const two = [{ id: 'gift', kind: 'gift', near: 1 }, { id: 'back', kind: 'rescue', near: 0.5 }]; ok(CO.lead(s, 'fail', two, { now: T0, quiet: true }).lead.id === 'back' && CO.lead(s, 'pause', two, { now: T0, quiet: true }).lead.id === 'gift', 'after a loss the way back in leads; anywhere else what is already his leads'); }
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
{ // the herald (0.8.17): a catalogue of true notes, per segment, at his hour, never at night, capped, backing off
  const SEG = (o = {}) => HE.segment({ stage: 'regular', mood: 'steady', spender: 'saver', video: 'some', ...o.m }, { back: o.back ?? 0.3 });
  const C = (o = {}) => ({ unlocked: 12, chestDay: '2026-11-24', dailyOn: true, hour: 18, seg: SEG(), giftOk: true, ...o });
  const s = mk({ unlocked: 9 });
  ok(HE.plan(s, C({ spins: 1 }), T0) === null, 'never asked: nothing is planned');
  // the ask card: from the first boss win, at happy moments only, once a session, then every three days of play, no cap
  const A = (o) => HE.askNow(s, { won3: true, won5: true, sess: 1, days: [], ...o }, T0);
  ok(A({ moment: 'boss' }) && A({ moment: 'spin' }) && A({ moment: 'welcome' }) && !A({ moment: 'fail' }) && !A({ moment: 'win' }), 'asked at a boss win, a banked spin, a welcome back; never after a loss');
  ok(!A({ moment: 'boss', won5: false }) && !A({ moment: 'boss', won3: false, won5: false }) && !A({ moment: 'boss', child: true }) && !A({ moment: 'boss', on: true }), 'not before the first boss win, never for a child, never once they are on');
  ok(A({ moment: 'chip', won5: false }) && !A({ moment: 'chip', won3: false }), 'the bell chip opens the card whenever he taps it, from level 3 won');
  HE.noteAsk(s, { sess: 1 }, T0); HE.answer(s, false, T0);
  ok(!A({ moment: 'boss', sess: 1 }) && !A({ moment: 'boss', sess: 2, days: ['2026-11-25', '2026-11-26'] }) && A({ moment: 'boss', sess: 3, days: ['2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'] }), '"not now": never twice in a session, back after three days of play');
  for (let i = 0; i < 6; i++) HE.noteAsk(s, { sess: 10 + i }, T0 + i * 4 * DAY);
  ok(HE.askNow(s, { moment: 'spin', won3: true, won5: true, sess: 99, days: ['2026-12-20', '2026-12-21', '2026-12-22'] }, T0) && HE.herState(s).asks === 7, 'no cap in total: it keeps coming back at that pace');
  HE.answer(s, true, T0);
  const P = HE.plan(s, C({ spins: 1 }), T0), at = new Date(P.at);
  ok(P.id === 'spin' && P.land === 'spin' && at.getHours() === 18 && P.at - T0 >= HE.HERALD.minAheadH * HOUR && P.at - T0 <= 48 * HOUR, 'a banked spin, tomorrow at the hour he plays: ' + P.title);
  const night = HE.plan(s, C({ spins: 1, hour: 23 }), T0), early = HE.plan(s, C({ spins: 1, hour: 5 }), T0);
  ok([night, ...night.more].every((q) => new Date(q.at).getHours() === 20) && [early, ...early.more].every((q) => new Date(q.at).getHours() === 9), 'a night owl is told at 20:00, an early bird at 09:00: never in the quiet hours');
  // truthfulness: every note's thing is true at the moment it shows; nothing true, nothing sent
  const all = [];
  const states = [C({ spins: 1 }), C({ spinLeft: 1 }), C({ starsToChest: 1, chestSkin: true }), C({ chestDay: '2026-11-24' }), C({ flame: 4 }), C({ stuck: 14, stuckBoost: 'Stone Shell', seg: SEG({ m: { mood: 'stuck' } }) }), C({ starsToWorld: 2, nextWorld: 'Frost Peak' }), C({ nextBoss: 15 }), C({ quest: 'The Lost Egg' }),
    C({ premium: true, charges: 0, chargeMax: 3, premDay: '2026-11-24', seg: SEG({ m: { spender: 'payer' } }) }), C({ videosOn: true, videoDay: '2026-11-24', seg: SEG({ m: { video: 'fan' } }) }), C({ unlocked: 3, seg: SEG({ m: { stage: 'new' } }) }), C({ allDone: true, newContent: true })];
  for (const c of states) { const p = HE.plan(mk({ eng: { her: { ok: 1 } } }), c, T0); if (p) for (const q of [p, ...p.more]) all.push({ q, c }); }
  const lie = all.filter(({ q, c }) => !HE.entry(q.id).when(c, q.at, T0) || (HE.entry(q.id).who && !HE.entry(q.id).who(c.seg)));
  const ids = new Set(all.map(({ q }) => q.id));
  ok(!lie.length && ['spin', 'spin1', 'chest1', 'daily', 'flame', 'helper', 'world', 'boss', 'quest', 'charge', 'videos', 'newbie', 'fresh', 'back3', 'back7', 'back14', 'back30'].every((i) => ids.has(i)), `${all.length} notes over ${states.length} players, every catalogue entry used, none untrue at its moment` + (lie.length ? ': ' + lie[0].q.id : ''));
  const bare = HE.plan(mk({ eng: { her: { ok: 1 } } }), { hour: 18, chestDay: '', dailyOn: false, unlocked: 2, giftOk: false, seg: SEG() }, T0);
  ok(bare === null, 'nothing real waiting (no chest, no spin, no gift yet): no note at all');
  ok(HE.plan(mk({ eng: { her: { ok: 1 } } }), C({ chestDay: '2026-11-25' }), new Date(2026, 10, 25, 7).getTime()).at > new Date(2026, 10, 26, 0).getTime(), 'the daily chest already opened today: its note is for a day when it is really back');
  ok(!HE.CATALOGUE.some((e) => { const t = JSON.stringify(e.text(C({ spins: 1, flame: 3, stuck: 4, stuckBoost: 'x', starsToWorld: 2, nextWorld: 'W', nextBoss: 5, quest: 'Q', unlocked: 3 }), T0 + 5 * DAY, T0)) + JSON.stringify(e.voice || {}); return /buy|sale|offer|deal|price|\$|discount|shop|store|premium|unlock everything|limited|hurry|last chance/i.test(t); }), 'no note speaks of money, prices, the shop or pressure');
  // timing and restraint: one a day, three a week, the series backs off, six unanswered and it stops
  const w = mk({ eng: { her: { ok: 1 } } }), W = HE.plan(w, C({ spins: 1, flame: 3, starsToChest: 1 }), T0), ats = [W.at, ...W.more.map((m) => m.at)], dd = ats.map((t) => Math.round((t - T0) / DAY));
  const week = Math.max(...ats.map((t) => ats.filter((u) => u > t - 7 * DAY && u <= t).length)), gaps = dd.slice(1).map((d, i) => d - dd[i]);
  ok(ats.length === 6 && new Set(ats.map((t) => new Date(t).toDateString())).size === 6 && week <= HE.HERALD.week && gaps[2] >= 2 && gaps[4] >= 7, `a series of ${ats.length} on days ${dd.join(', ')}: one a day, at most ${week} in any seven, every other day after two, weekly after four, then nothing`);
  ok(W.more.slice(-4).map((m) => m.id).join() === 'back3,back7,back14,back30' && /200/.test(W.more[5 - 1].text), 'away 3, 7, 14, 30 days: the welcome-back gift, growing (director.js gives it on return): ' + W.more.slice(-4).map((m) => m.text.match(/\d+/)[0]).join(' > '));
  HE.opened(w, '', W.more[1].at + HOUR);
  ok(HE.herState(w).n === 3 && HE.herState(w).ignored === 3, 'he came back by himself after three: three filed as sent, unanswered');
  const W2 = HE.plan(w, C({ spins: 1 }), W.more[1].at + 2 * HOUR), w2 = [W2.at, ...W2.more.map((m) => m.at)], sent = HE.herState(w).sent.map((q) => q.t);
  ok(w2.every((t) => sent.filter((u) => u > t - 7 * DAY && u <= t).length + w2.filter((u) => u > t - 7 * DAY && u <= t).length <= HE.HERALD.week), 'the weekly cap counts the notes that already fired');
  ok(HE.opened(w, '', W2.at - HOUR).fired === false && HE.herState(w).n === 3, 'he opened the game before the next was due: all cancelled, not counted');
  const r = (HE.plan(w, C({ spins: 1 }), T0 + 40 * DAY), HE.opened(w, 'spin', HE.herState(w).plan.at + HOUR));
  ok(r.hit && r.land === 'spin' && HE.herState(w).opened === 1 && HE.herState(w).ignored === 0, 'opened from a note: counted, and the tap lands on the spin page');
  ok(HE.opened(w, 'test', T0).test && HE.herState(w).test === T0 && HE.herState(w).opened === 1, 'the Settings test note is filed apart');
  HE.setOff(w, true);
  ok(HE.plan(w, C({ spins: 1 }), T0) === null && HE.plan(mk({ eng: { her: { ok: -1 } } }), C({ spins: 1 }), T0) === null && HE.plan(mk({ eng: { her: { ok: 1 } } }), C({ spins: 1, child: true }), T0) === null, 'switched off, "not now" or a child: nothing, ever');
  // segments differ
  const one = (seg, c = {}) => { const p = HE.plan(mk({ eng: { her: { ok: 1 } } }), C({ seg, ...c }), T0); return p ? [p, ...p.more].map((q) => q.id) : []; };
  const rich = { spins: 0, flame: 3, stuck: 9, stuckBoost: 'Stone Shell', starsToWorld: 2, nextWorld: 'Frost Peak', videosOn: true, videoDay: '2026-11-24', premium: true, charges: 0, chargeMax: 3, premDay: '2026-11-24' };
  const plain = { ...rich, flame: 0, stuck: 0 };
  const stuck = one(SEG({ m: { mood: 'stuck' } }), rich), cruise = one(SEG({ m: { mood: 'cruising' } }), rich), fan = one(SEG({ m: { video: 'fan' } }), plain), shy = one(SEG({ m: { video: 'shy' } }), plain), payer = one(SEG({ m: { spender: 'payer' } }), plain);
  ok(stuck[0] === 'helper' && cruise[0] !== 'helper' && fan.includes('videos') && !shy.includes('videos') && !payer.includes('videos') && payer.includes('charge') && !shy.includes('charge'), `segments get their own order: stuck ${stuck[0]}, cruising ${cruise[0]}; videos for the fan only (${fan.join(' ')}); the free charge for the payer (${payer.join(' ')})`);
  const day1 = (b) => { const p = HE.plan(mk({ eng: { her: { ok: 1 } } }), C({ seg: SEG({ back: b }), starsToWorld: 2, nextWorld: 'W', dailyOn: false }), T0); return Math.round((p.at - T0) / DAY); };
  ok(day1(0.9) > 1 && day1(0.1) === 1, `likely to come back anyway: no day-one note about progress (first note on day ${day1(0.9)}, against day ${day1(0.1)})`);
  ok(HE.segment({ stage: 'veteran', mood: 'flow', spender: 'payer', video: 'none' }, { back: 0.7 }).key === 'veteran/cruising/payer/likely', 'a segment from the Brain and the Oracle: ' + HE.segment({ stage: 'veteran', mood: 'flow', spender: 'payer', video: 'none' }, { back: 0.7 }).key);
  let led = null; HE.plan(mk({ eng: { her: { ok: 1 } } }), C({ spins: 1, flame: 3, lead: (c, m) => { led = m; return [...c].reverse(); } }), T0);
  ok(led === 'note', 'the Conductor is asked which engine\'s note leads');
  const back = HE.herState({ eng: { her: JSON.parse(JSON.stringify(HE.herState(mk({ unlocked: 9, eng: { her: { ok: 1, plan: { at: 5, id: 'spin', more: [{ at: 9, id: 'back3' }, null, { at: 0 }] } } } })))) } });
  ok(back.plan.more.length === 1 && back.plan.more[0].id === 'back3', 'the plan survives being saved and loaded');
  ok(/allowed|switched off/.test(HE.line(w)), 'one line for the speed log: ' + HE.line(w));
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
