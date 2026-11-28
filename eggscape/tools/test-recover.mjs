// The slow-drawing watchdog (src/recover.js): what counts as ill, what does not, and the ladder of cures.
// node tools/test-recover.mjs
import { REC, recInit, recWindow, recProbe, recDue, recPre, recGo, recIll, probeSlow } from '../src/recover.js';
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('FAIL', m); } };
const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m }; };
let clock = 1e6; const now = () => clock;
const logs = []; const log = (o) => logs.push(o);
const W = (scr, fps, js, o = {}) => recWindow({ scr, fps, js, dpr: 2, cap: 60, step: 0, ...o });
const healthy = (st, k = 30) => { for (let i = 0; i < k; i++) { W('play', 60, 8); W('intro', 60, 4); if (REC.want) recProbe({ n: 2 }); } };
let age = { s: 0, fr: 0 };
const start = (st, rungs = 3) => { logs.length = 0; return recInit({ storage: st, log, rungs, now, age: () => age }); };

// 1. mykee's session: healthy for minutes, then the level 13 card at 33 fps and play at 78 ms a frame
let st = mem(); ok(start(st) === null, 'a first start has nothing to come back to');
healthy(st);
ok(REC.state === 'ok' && REC.base === 2 && JSON.parse(st.m['eggscape.rec.v1']).base === 2, 'a healthy phone learns its probe time and keeps it');
W('intro', 33, 4); ok(REC.state === 'ok' && !recIll(), 'one slow second is nothing');
W('intro', 33, 4); ok(REC.state === 'suspect' && REC.want && recIll(), 'two slow seconds on a card that ran at 60: suspect, the probe is asked');
recProbe({ n: 31 }); ok(REC.state === 'sick' && REC.why === 'gpu' && REC.rung === 1, 'a probe 15 times slower: ill, first rung');
ok(recDue('intro', true) === 0, 'never while an ad, a sheet or a purchase is up');
ok(recDue('win', false) === 0 && recDue('pause', false) === 0 && recDue('store', false) === 0, 'not on the win page, the pause page or in the shop');
ok(recDue('play', false, 40) === 0 && recDue('play', false, 5) === 1, 'in play only in the first seconds of a level');
ok(recDue('intro', false) === 1, 'on the level card: now');
const m1 = recGo({ scr: 'intro', li: 12, world: 2 });
ok(m1.rung === 1 && m1.li === 12 && REC.state === 'off', 'the mark holds the card to come back to');

// 2. the page came back and is healthy: the rung is remembered
clock += 1500; let back = start(st);
ok(back && back.scr === 'intro' && back.li === 12 && REC.state === 'verify' && REC.want, 'the next page lands on the same card and checks itself');
recProbe({ n: 2.2 }); W('intro', 60, 4); W('intro', 59, 4); ok(REC.state === 'verify', 'the verdict waits for three seconds');
W('intro', 60, 4);
ok(REC.state === 'ok' && REC.note === 'ok' && JSON.parse(st.m['eggscape.rec.v1']).best === 1, 'cured by rung 1: remembered');
ok(logs.some((l) => l.e === 'back') && logs.some((l) => l.e === 'ok' && l.rung === 1), 'the log says what worked');
ok(!JSON.parse(st.m['eggscape.rec.v1']).mark, 'the mark is used once');

// 3. the page reload does not help: rung 2, then rung 3, each checked
st = mem(); clock += 1e6; start(st); healthy(st);
for (let i = 0; i < 3; i++) W('play', 13, 78);
ok(REC.state === 'suspect', 'play at 78 ms a frame where it was 8: suspect');
recProbe({ n: 40 }); ok(REC.state === 'sick' && recDue('play', false, 60) === 0, 'ill deep in a level: wait for a calm screen');
ok(recDue('levels', false) === 1, 'the map is calm'); recGo({ scr: 'levels', li: 12, world: 2 });
clock += 1200; back = start(st); recProbe({ n: 38 }); W('levels', 30, 3); W('levels', 31, 3); W('levels', 30, 3);
ok(REC.state === 'sick' && REC.rung === 2 && recDue('levels', false) === 2, 'still slow after the reload: rung 2 at once');
recGo({ scr: 'levels', li: 12, world: 2 });
clock += 1800; back = start(st); recProbe({ n: 39 }); W('levels', 30, 3); W('levels', 31, 3); W('levels', 30, 3);
ok(REC.state === 'sick' && REC.rung === 3, 'still slow: rung 3'); recGo({ scr: 'levels', li: 12, world: 2 });
clock += 2500; back = start(st); recProbe({ n: 2.1 }); W('levels', 60, 3); W('levels', 60, 3); W('levels', 60, 3);
ok(REC.state === 'ok' && JSON.parse(st.m['eggscape.rec.v1']).best === 3, 'cured by the app restart: remembered');
// the next time it starts on the rung that worked
clock += 660000; healthy(st, 12); W('intro', 30, 4); W('intro', 30, 4); recProbe({ n: 35 });
ok(REC.state === 'sick' && REC.rung === 3, 'the next time: straight to rung 3');

// 4. nothing helps: rest for a day, no loop
st = mem(); clock += 1e7; start(st, 1); healthy(st);
W('intro', 30, 4); W('intro', 30, 4); recProbe({ n: 35 }); recGo({ scr: 'intro', li: 3, world: 0 });
clock += 1000; start(st, 1); recProbe({ n: 36 }); W('intro', 30, 4); W('intro', 30, 4); W('intro', 30, 4);
ok(REC.state === 'off' && logs.some((l) => l.e === 'gaveup'), 'the ladder is spent: the watchdog rests');
clock += 3600000; start(st, 1); ok(REC.state === 'off', 'an hour later: still resting');
clock += 86400000; start(st, 1); ok(REC.state === 'ok', 'a day later: watching again');

// 5. what is NOT the fault
st = mem(); clock += 1e7; start(st); healthy(st);
for (let i = 0; i < 12; i++) W('play', 34, 22); // a heavy level on a weaker phone: play slows, its work is not 3x
ok(REC.state === 'ok', 'a heavy level (22 ms of work, 34 fps) is the quality steps\' business');
for (let i = 0; i < 12; i++) W('intro', 30, 4, { hot: true });
ok(REC.state === 'ok', 'a phone throttling for heat is not cured by a restart');
for (let i = 0; i < 12; i++) W('intro', 30, 4, { dpr: 3 });
ok(REC.state === 'ok', 'a sharper picture than the healthy one was measured at is not compared');
W('intro', 30, 4); W('intro', 30, 4); recProbe({ n: 2.4 });
ok(REC.state === 'suspect', 'a fast probe is no proof: still only suspect');
for (let i = 0; i < 8; i++) W('intro', 30, 4);
ok(REC.state === 'suspect', 'one slow screen alone, with a fast probe, never starts a cure');
W('intro', 60, 4); ok(REC.state === 'ok' && REC.bad === 0, 'a healthy second clears it');
// only the game's own canvas slow (fresh canvases fine): every screen slow, menus too
W('intro', 30, 4); W('intro', 30, 4); recProbe({ n: 2.4 }); W('play', 14, 70); W('play', 14, 70); W('play', 14, 70); W('play', 14, 70);
ok(REC.state === 'sick' && REC.why === 'fps', 'card and play both slow for six seconds: ill without the probe\'s proof');

// 6. a new phone: no judgement before 20 healthy seconds; a phone that never drew fast has no probe verdict
st = mem(); clock += 1e7; start(st); for (let i = 0; i < 5; i++) { W('intro', 60, 4); } for (let i = 0; i < 5; i++) W('intro', 20, 4);
ok(REC.state === 'ok', 'ten seconds into a session nothing is judged');
ok(probeSlow(40, 0) === false && probeSlow(40, 15) === false && probeSlow(9, 2) === false && probeSlow(11, 2) === true, 'the probe verdict needs a healthy time under 12 ms; slow is 3x and 8 ms more');

// 7. three cures in ten minutes: stop
st = mem(); clock += 1e7;
for (let k = 0; k < 4; k++) {
  start(st); if (REC.state === 'verify') { recProbe({ n: 2 }); W('intro', 60, 4); W('intro', 60, 4); W('intro', 60, 4); }
  healthy(st, 12); W('intro', 30, 4); W('intro', 30, 4); recProbe({ n: 35 });
  if (k < 3) { ok(REC.state === 'sick', 'cure ' + (k + 1) + ' allowed'); recGo({ scr: 'intro', li: 1, world: 0 }); clock += 60000; }
}
ok(REC.state === 'off' && logs.some((l) => l.e === 'limit'), 'the fourth in ten minutes is refused');

// 8. switched off (tests, demos, ?rec=0) and an old mark
st = mem(); recInit({ storage: st, log, now, off: true }); W('intro', 10, 4); ok(REC.state === 'off' && recDue('intro', false) === 0, 'off is off');
st = mem(); st.setItem('eggscape.rec.v1', JSON.stringify({ mark: { at: clock - 60000, scr: 'intro', li: 2, rung: 1, why: 'gpu' } }));
ok(start(st) === null && REC.state === 'ok', 'a mark older than 25 s is a normal start');

// 9. ahead of time: the phone fell ill 657 s into a session (9000 pictures handed back) and rung 1 cured it
st = mem(); clock += 1e8; age = { s: 657, fr: 9000 }; start(st); healthy(st);
ok(recPre('levels', false) === 0, 'a phone that was never ill is never refreshed ahead of time');
W('intro', 33, 4); W('intro', 33, 4); recProbe({ n: 31 }); recGo({ scr: 'intro', li: 12, world: 2 });
ok(JSON.parse(st.m['eggscape.rec.v1']).ill.s === 657, 'the point where it struck is remembered');
clock += 1500; age = { s: 2, fr: 0 }; start(st); recProbe({ n: 2 }); W('intro', 60, 4); W('intro', 60, 4); W('intro', 60, 4);
ok(REC.state === 'ok' && recPre('levels', false) === 0, 'cured; two seconds into the new page nothing is due');
// the next session
clock += 3600000; age = { s: 10, fr: 50 }; start(st); healthy(st, 12);
age = { s: 500, fr: 3000 }; ok(recPre('levels', false) === 0, 'at 500 s of 657: not yet');
age = { s: 530, fr: 3000 }; ok(recPre('play', false) === 0 && recPre('win', false) === 0 && recPre('levels', true) === 0, 'at 530 s: due, but never in play, on the win page or under a sheet');
ok(recPre('levels', false) === 1, 'on the map: the rung that cured it');
age = { s: 200, fr: 7300 }; ok(recPre('intro', false) === 1, 'or when as many pictures have gone by, whichever comes first');
const mp = recGo({ scr: 'levels', li: 10, world: 2 }, 1);
ok(mp.why === 'pre' && mp.rung === 1 && mp.scr === 'levels', 'the mark says it was ahead of time');
clock += 1200; age = { s: 1, fr: 0 }; back = start(st); recProbe({ n: 2 }); W('levels', 60, 3); W('levels', 60, 3); W('levels', 60, 3);
ok(back.why === 'pre' && REC.state === 'ok' && logs.some((l) => l.e === 'fresh') && REC.note !== 'ok', 'back on the map, no verdict, no toast');
// a phone that fell ill early (under five minutes) is not refreshed ahead of time: too often
st = mem(); clock += 1e8; age = { s: 120, fr: 800 }; start(st); healthy(st); W('intro', 33, 4); W('intro', 33, 4); recProbe({ n: 31 }); recGo({ scr: 'intro', li: 2, world: 0 });
clock += 1500; age = { s: 2, fr: 0 }; start(st); recProbe({ n: 2 }); W('intro', 60, 4); W('intro', 60, 4); W('intro', 60, 4);
age = { s: 119, fr: 799 }; ok(recPre('levels', false) === 0, 'struck at two minutes: no refresh ahead of time');
console.log(bad ? `${bad} of ${n} FAILED` : `recover: ${n} checks passed`);
process.exit(bad ? 1 : 0);
