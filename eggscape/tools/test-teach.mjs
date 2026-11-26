// Teaching moments (src/engine/teach.js): node tools/test-teach.mjs   (exits 1 on a failure)
// The two-meetings rule, a skipped level, spacing and the quiet spells, a finger on another ring, Adaptive help off,
// calm mode, the moment's time curve, and the level clock: over a real level the fuse burns exactly the sim time spent
// outside moments, the moment never changes what the sim does (same eggs, same positions as a run with no moment, with
// the clock shifted only), and a subject can give back at most 2 x 1.5 s of clock in a player's life.
import * as T from '../src/engine/teach.js';
import { Sim, DT } from '../src/sim/sim.js';
import { LEVELS } from '../src/data/levels.js';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const ctx = (o = {}) => ({ now: 100, timeLeft: 60, held: null, ring: 2, adapt: true, calm: false, busy: false, replayWon: false, ...o });

{ // two meetings, one moment each, then never again
  const save = {};
  let shown = 0;
  for (let lv = 0; lv < 4; lv++) {
    const run = T.newRun();
    const n = T.meet(save, run, 'snake');
    T.meet(save, run, 'snake'); // a second snake in the same try is the same meeting
    const p = T.want(save, run, 'snake', ctx());
    if (p) { shown++; const m = T.begin(run, p, 100); while (!T.tick(m, 1 / 60)); T.end(save, run, m, 102); }
    ok(n === lv + 1, `try ${lv + 1}: meeting ${n}, ${p ? 'a moment' : 'no moment'}`);
  }
  ok(shown === 2 && save.met.snake === 4, 'the first two meetings get a moment, the third and fourth do not');
}
{ // a skipped level cannot hide the lesson: the first meeting is wherever the snake first shows up (level 9, not 7)
  const save = { met: { gator: 2 } };
  const run = T.newRun();
  T.meet(save, run, 'snake');
  ok(!!T.want(save, run, 'snake', ctx()), 'the snake met first on a later level still gets its moment');
  ok(!T.want(save, T.newRun(), 'gator', ctx()), 'a creature met twice before does not');
}
{ // one at a time, 6 s apart, never in the last 5 s, never under a finger on another ring
  const save = {}, run = T.newRun();
  T.meet(save, run, 'snake'); T.meet(save, run, 'gator');
  const p = T.want(save, run, 'snake', ctx({ now: 10 }));
  const m = T.begin(run, p, 10);
  ok(!T.want(save, run, 'gator', ctx({ now: 10.5 })), 'no second moment while one is on');
  while (!T.tick(m, 1 / 60));
  T.end(save, run, m, 12);
  ok(!T.want(save, run, 'gator', ctx({ now: 17.9 })), 'not within 6 s of the last one');
  ok(!!T.want(save, run, 'gator', ctx({ now: 18.1 })), '6 s later it may');
  ok(!T.want(save, run, 'gator', ctx({ now: 30, timeLeft: 4.9 })), 'never in the last 5 s of the fuse');
  ok(!!T.want(save, run, 'gator', ctx({ now: 30, timeLeft: null })), 'a level with no fuse has no last 5 s');
  ok(!T.want(save, run, 'gator', ctx({ now: 30, held: 1, ring: 2 })), 'never while a finger turns another ring');
  ok(!!T.want(save, run, 'gator', ctx({ now: 30, held: 2, ring: 2 })), 'a finger on the lesson ring itself is fine');
  ok(!T.want(save, run, 'gator', ctx({ now: 30, busy: true })), 'never over a card or the fuse intro');
  ok(!T.want(save, run, 'snake', ctx({ now: 30 })), 'one moment per subject per try');
}
{ // a replay of a level already won, with the subject met twice: nothing
  const save = { met: { owlSwoop: 2 } }, run = T.newRun();
  T.meet(save, run, 'owlSwoop');
  ok(!T.want(save, run, 'owlSwoop', ctx({ replayWon: true })), 'a won level replayed: no moment for a subject met twice');
}
{ // Adaptive help off: shorter, first meeting only
  const s1 = {}, r1 = T.newRun(); T.meet(s1, r1, 'pip');
  const p = T.want(s1, r1, 'pip', ctx({ adapt: false }));
  ok(p && p.hold === T.TEACH.holdShort, `adaptive help off: the first meeting still gets a moment, ${p && p.hold} s`);
  const r2 = T.newRun(); T.meet(s1, r2, 'pip');
  ok(!T.want(s1, r2, 'pip', ctx({ adapt: false })), 'adaptive help off: no second moment');
  const r3 = T.newRun(), s3 = {}; T.meet(s3, r3, 'pip');
  ok(T.want(s3, r3, 'pip', ctx()).hold === T.TEACH.hold, `adaptive help on: the full ${T.TEACH.hold} s`);
}
{ // answered on the first meeting: the second is short
  const save = {}, r1 = T.newRun(); T.meet(save, r1, 'gator');
  const m = T.begin(r1, T.want(save, r1, 'gator', ctx()), 0);
  T.tick(m, 0.4); T.finish(m, true);
  ok(m.out === 0.4 && T.length(m) < 0.4 + T.TEACH.snapOut + 1e-9, 'the answer snaps time back at once');
  while (!T.tick(m, 1 / 60)); T.end(save, r1, m, 1);
  const r2 = T.newRun(); T.meet(save, r2, 'gator');
  ok(save.metOk.gator === 1 && T.want(save, r2, 'gator', ctx()).hold === T.TEACH.holdShort, 'understood once: the second moment is short');
}
{ // calm: no camera lean, a soft dim
  const save = {}, run = T.newRun(); T.meet(save, run, 'snake');
  const p = T.want(save, run, 'snake', ctx({ calm: true }));
  ok(p && p.lean === false && p.dim === 'soft', 'calm mode: no camera move, a soft dim');
  const q = T.want({}, Object.assign(T.newRun(), { n: { snake: 1 } }), 'snake', ctx());
  ok(q && q.lean === true && q.dim === 'spot', 'otherwise the camera leans in and a spotlight sits on it');
}
{ // the time curve: eases to 0.2 in 0.15 s, holds, eases back; never below 0.2, never above 1
  const m = T.begin(T.newRun(), { subject: 'x', n: 1, hold: 1.5 }, 0);
  const at = (a) => T.scaleAt(m, a);
  ok(at(0) === 1 && Math.abs(at(0.15) - 0.2) < 1e-9 && Math.abs(at(1.0) - 0.2) < 1e-9 && at(T.length(m)) === 1, 'scale: 1, 0.2 at 0.15 s, 0.2 held, 1 at the end');
  let lo = 1, hi = 0; for (let a = 0; a <= T.length(m); a += 0.01) { lo = Math.min(lo, at(a)); hi = Math.max(hi, at(a)); }
  ok(lo >= 0.2 - 1e-9 && hi <= 1, 'it never goes below 0.2 or above 1');
  const n = T.begin(T.newRun(), { subject: 'y', n: 1, hold: 1.5 }, 0); T.tick(n, 0.05); T.finish(n, false);
  ok(Math.abs(T.scaleAt(n, 0.05) - T.scaleAt(m, 0.05)) < 1e-9, 'let go while easing in: no jump in speed');
}
{ // every lesson in the table is a known gesture with at most three words
  const G = new Set(['away', 'open', 'spin', 'tap', 'look', 'none']);
  const rows = Object.entries(T.LESSONS);
  ok(rows.every(([, v]) => G.has(v.g)), `${rows.length} lessons, each a known gesture`);
  ok(rows.every(([, v]) => !v.w || v.w.split(/\s+/).length <= 3), 'no lesson says more than three words');
  ok(rows.filter(([, v]) => v.g === 'look').every(([, v]) => v.w), 'a look lesson always has its words');
  ok(T.lessonOf('lv:15') === T.LESSONS.lv, "a level's caption is a lesson");
}
{ // the level clock: over a real level the fuse burns only the sim time outside moments; the sim's play is unchanged
  const lv = LEVELS.find((l) => l.id === 7); // Bramble Path: a snake, a 75 s fuse
  const play = (moments) => {
    const sim = new Sim(lv, { mode: 'medium' }), save = {}, run = T.newRun();
    let wall = 0, outside = 0, held = 0, acc = 0;
    const heldBy = {};
    for (let f = 0; f < 60 * 50 && sim.state === 'play'; f++) {
      const dt = 1 / 60;
      wall += dt;
      for (const ev of sim.events) if (moments && ev.type === 'snakeIn') T.meet(save, run, 'snake');
      if (moments && !run.active && run.n.snake) { const p = T.want(save, run, 'snake', { now: wall, timeLeft: sim.timeLeft, held: null, ring: 0 }); if (p) T.begin(run, p, wall); }
      if (moments && sim.t > 20 && !run.n.gust) { T.meet(save, run, 'gust'); }
      if (moments && !run.active && run.n.gust) { const p = T.want(save, run, 'gust', { now: wall, timeLeft: sim.timeLeft, held: null, ring: null }); if (p) T.begin(run, p, wall); }
      const m = run.active, k = m ? T.scaleAt(m) : 1;
      sim.events.length = 0;
      acc += dt * k;
      while (acc >= DT * 0.75) {
        sim.clockHold = T.holdsClock(m);
        const live = sim.state === 'play';
        sim.step(); acc -= DT;
        if (sim.clockHold) { m.simIn += DT; if (live) { held += DT; heldBy[m.subject] = (heldBy[m.subject] || 0) + DT; } } else if (live) outside += DT;
      }
      sim.clockHold = false;
      if (m && T.tick(m, dt)) T.end(save, run, m, wall);
    }
    return { sim, outside, held, heldBy, used: sim.timeLimit - sim.timeLeft, moments: run.moments };
  };
  const A = play(true), B = play(false);
  ok(A.moments === 2, `two moments ran (the snake, the gust), ${A.held.toFixed(2)} s of sim time with the fuse still`);
  ok(Math.abs(A.used - A.outside) < 1e-6, `fuse burnt ${A.used.toFixed(3)} s = sim time outside moments ${A.outside.toFixed(3)} s`);
  ok(Object.values(A.heldBy).every((s) => s <= T.TEACH.clockCap + 1e-9), 'each moment holds the clock for at most 1.5 s of sim time');
  ok(Math.abs(A.used - (A.sim.t - A.held)) < 1e-6 && Math.abs(B.used - B.sim.t) < 1e-6, `same rule for everyone: fuse = sim time - held time (${A.used.toFixed(2)} = ${A.sim.t.toFixed(2)} - ${A.held.toFixed(2)}; no moment: ${B.used.toFixed(2)} = ${B.sim.t.toFixed(2)})`);
  // the play itself: the same sim time reached, the same eggs at the same spots (pacing differs, the world does not)
  const pos = (s) => s.eggs.map((e) => { const p = e.body.getPosition(); return `${e.alive ? 1 : 0}${e.saved ? 1 : 0}:${p.x.toFixed(4)},${p.y.toFixed(4)}`; }).join(' ');
  const steps = Math.round(A.sim.t / DT), C = new Sim(lv, { mode: 'medium' });
  for (let i = 0; i < steps && C.state === 'play'; i++) C.step();
  const same = new Sim(lv, { mode: 'medium' });
  for (let i = 0; i < steps && same.state === 'play'; i++) { same.clockHold = i % 7 === 0; same.step(); }
  ok(pos(same) === pos(C) && same.snakes.length === C.snakes.length, 'holding the clock changes nothing else in the sim (eggs, snakes at the same spots)');
  // the lifetime cap: a subject meets 2 moments at most, each holding at most clockCap
  const save = {}; let life = 0;
  for (let i = 0; i < 6; i++) { const run = T.newRun(); T.meet(save, run, 'snake'); const p = T.want(save, run, 'snake', ctx()); if (p) life += T.TEACH.clockCap; }
  ok(life <= 2 * 1.5 + 1e-9, `a subject gives back at most ${life} s of clock in a player's life (cap 2 x 1.5 s)`);
}
console.log(bad ? `${bad} FAILED` : 'all ok');
process.exit(bad ? 1 : 0);
