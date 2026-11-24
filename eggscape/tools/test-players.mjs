// The rules against simulated players (tools/sim-players.mjs): node tools/test-players.mjs
// A small town, a small crowd and the random clickers. It fails when a RULE breaks (a purse under zero, two reminders
// in one day, a reminder at night or without permission, a paid offer before level 3 is won, more offer cards in a
// session than the cap, a subsystem down, a save that cannot be written), never because of how players behave.
import { town, crowd, clickers, life, PERSONAS, WORLD } from './sim-players.mjs';
import { parseLog, merge } from './read-log.mjs';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const T = town({ n: 25, days: 30, seed: 3 }), names = Object.keys(T);
ok(names.length === Object.keys(PERSONAS).length && names.every((k) => T[k].n === 25), `${names.length} kinds of players lived 30 days`);
const broke = names.flatMap((k) => T[k].bad.map((b) => k + ': ' + b));
ok(!broke.length, 'no rule broke in the town' + (broke.length ? ': ' + broke.slice(0, 3).join('; ') : ''));
ok(names.every((k) => T[k].cardsMax <= 2), 'never more offer cards in a session than the cap');
ok(names.every((k) => T[k].d1 > 0 && T[k].tries > 0 && T[k].coinsIn > 0), 'everyone played, won coins and some came back');
ok(T.videoHater.videos === 0 && T.payer.premium > T.quitter.premium, 'a player who never watches sees no video counted; payers pay more often than quitters');
const a = life(PERSONAS.commuter, 42, 20), b = life(PERSONAS.commuter, 42, 20);
ok(JSON.stringify(a) === JSON.stringify(b), 'the same seed gives the same life (a finding can be shown again)');
ok(WORLD.diff(1) < WORLD.diff(9) && WORLD.diff(9) > WORLD.diff(8) && WORLD.diff(50) <= 0.95, 'the assumed difficulty climbs, and a hard level stands out');
const C = crowd({ n: 150, days: 20, seed: 5 });
ok(!C.bad.length && Object.keys(C.rows).length >= 12, `a crowd of ${C.n} with every trait at random broke no rule` + (C.bad.length ? ': ' + C.bad[0] : ''));
const K = clickers({ n: 40, steps: 300, seed: 7 });
ok(!K.bad.length, `${K.acts} random actions broke no rule` + (K.bad.length ? ': ' + K.bad.slice(0, 3).join('; ') : ''));
{ // a shared speed log is filed as counts, per phone, and a newer log of the same phone replaces the older
  const log = (lv, first) => ['Eggscape speed log 0.8.15 / 2026-11-24T12:00:00Z', '3 levels', JSON.stringify({ k: 'fps', v: 60 }), JSON.stringify({ k: 'note', t: 1, mode: 'medium', first, tal: { b: { double: [5, 1], 'a b': 3 }, sc: { play: 300 }, lv, end: [{ sc: 'fail', lv: 7 }], shop: { n: 2, first: 6 } } })].join('\n');
  const one = parseLog(log({ 7: [4, 1, 200, 2, 1, 0] }, 111));
  ok(one && one.phone === '111' && one.lv[7].join() === '4,1,200,2,1,0' && one.b.double.join() === '5,1' && !one.b['a b'] && one.ends.fail === 1, 'a log gives up its counts and nothing else');
  let R = merge({}, one, '2026-11-24'); R = merge(R, parseLog(log({ 7: [9, 3, 500, 3, 1, 2] }, 111)), '2026-11-25'); R = merge(R, parseLog(log({ 7: [2, 2, 90, 0, 0, 0], 8: [1, 0, 30, 1, 0, 0] }, 222)), '2026-11-25');
  ok(R.logs === 2 && R.levels[7].join() === '11,5,590,3,1,2' && R.levels[8][0] === 1 && R.buttons.double.join() === '10,2', 'two phones add up; the same phone again replaces its older counts');
  ok(parseLog('nothing here') === null && parseLog('{"k":"note","tries":"7:4/1 8:2/2"}').lv[7].join() === '4,1,0,0,0,0', 'a log without a play record is refused; an older one with tries as text is still read');
}
console.log(bad ? `\n${bad} FAILED` : '\nall player checks passed');
process.exit(bad ? 1 : 0);
