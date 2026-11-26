// Spike the sea urchin (sim/urchin.js, level 46): node tools/test-urchin.mjs   (exits 1 on a failure)
// No browser. A small underwater vault (five rings, gaps only where the test wants them) with Spike in channel 2 on ring 1,
// and one egg put where the test wants it. Checks each trick (nap, roll, dash), each counter (shut the gap before he goes,
// shut it behind him, a stone egg, a chick, a burning egg), every booster and every chick power and Chick Strike, the live
// ring and the warp gate, determinism (two runs, and a snapshot taken mid-dash, match exactly), and "never unwinnable":
// he cracks, he never takes or throws an egg out, one crack a hit, a pause between two hits on the same egg, and a
// helpless spell after every counter.
import { Sim, DT } from '../src/sim/sim.js';
import { URCHIN } from '../src/sim/urchin.js';
import { LEVELS } from '../src/data/levels.js';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const deg = (d) => (d * Math.PI) / 180;

const level = (o = {}) => ({ id: 999, theme: 'reef', material: 'coral', spacing: 1.05, nest: { w: 2.6 }, eggs: 1, target: 1, time: 0, water: true, seed: 5, world: 8,
  urchin: { ch: 2, a: 62, delay: 0.1 },
  rings: [{ gaps: [{ a: -90 }] }, { gaps: [{ a: 170 }, { a: 10 }] }, { gaps: [{ a: 88 }] }, { gaps: [{ a: -40 }] }, { gaps: [{ a: -70 }] }], ...o });
const fresh = (mode = 'medium', opts = {}, L = {}) => new Sim(level(L), { mode, ...opts });
// an egg at rest against the outer wall of channel ch (eggs float up), at angle a (deg)
function put(sim, e, ch, a) {
  const r = sim.rings[ch].r - 0.08 - 0.24;
  e.body.setTransform({ x: r * Math.cos(deg(a)), y: r * Math.sin(deg(a)) }, 0);
  e.body.setLinearVelocity({ x: 0, y: 0 }); e.body.setAngularVelocity(0); e.body.setAwake(true);
}
// run for s seconds holding every ring still (hook(sim) runs before each step); returns the events of note
function run(sim, s, hook) {
  const log = [];
  for (let i = 0; i < s / DT && sim.state === 'play'; i++) {
    for (const q of sim.rings) if (!q.spin) q.target = q.body.getAngle();
    if (hook) hook(sim);
    sim.step();
    for (const ev of sim.events) if (/^ur|^crack$|^break|goldenSave/.test(ev.type)) log.push({ t: +sim.t.toFixed(3), type: ev.type, why: ev.why || ev.by || '' });
    sim.events.length = 0;
  }
  return log;
}
const U0 = (sim) => sim.urchins[0];
const at = (log, type) => log.find((x) => x.type === type);
const turnAt = (ring, d) => (sim) => { const r = sim.rings[ring]; r.target = r.body.getAngle() + d; };

// ---------------------------------------------------------------- the tricks
{ // nap: harmless. An egg pushed against him while he naps rides over him, uncracked
  const sim = fresh();
  const U = U0(sim);
  run(sim, 1.2);
  ok(U.ph === 'nap', `he comes in and naps (${U.ph})`);
  const e = sim.eggs[0], a = Math.atan2(U.y, U.x), r = Math.hypot(U.x, U.y) + 0.3;
  e.body.setTransform({ x: r * Math.cos(a), y: r * Math.sin(a) }, 0);
  const log = run(sim, 1.5);
  ok(e.cracks === 0 && !at(log, 'urHit'), 'napping, his folded spines never crack an egg (a soft bump)');
}
{ // the puff before a roll: a telegraph of URCHIN.puff s, then the roll at URCHIN.roll m/s, spines out
  const sim = fresh();
  const U = U0(sim);
  put(sim, sim.eggs[0], 0, 90);
  const log = run(sim, 5);
  const p = at(log, 'urPuff');
  ok(!!p, 'after his nap he puffs up');
  const t0 = sim.t; let a0 = null;
  const l2 = run(sim, 0.05);
  void l2;
  if (U.ph === 'roll') a0 = Math.atan2(U.y, U.x);
  run(sim, 1);
  const da = a0 == null ? 0 : Math.abs(Math.atan2(Math.sin(Math.atan2(U.y, U.x) - a0), Math.cos(Math.atan2(U.y, U.x) - a0))) * (sim.rings[1].r + 0.08);
  ok(U.ph === 'roll' && Math.abs(da - URCHIN.roll.medium * (sim.t - t0 - 0.05)) < 0.08, `then rolls along his floor at ${URCHIN.roll.medium} m/s (${da.toFixed(2)} m in ${(sim.t - t0 - 0.05).toFixed(2)} s)`);
}
{ // roll: spines out, a touch cracks an egg ONCE (then that egg is safe from him for URCHIN.ban s) and shoves it
  const sim = fresh();
  const U = U0(sim);
  run(sim, 4.5); // puffed, rolling
  U.cd = 99; // no dash in this test
  const e = sim.eggs[0], a = Math.atan2(U.y, U.x) + U.face * 0.18;
  put(sim, e, 2, (a * 180) / Math.PI);
  const log = run(sim, 2.5);
  const hits = log.filter((x) => x.type === 'urHit');
  ok(hits.length === 1 && e.cracks === 1, `a rolling touch cracks the egg once (${hits.length} hit, ${e.cracks} crack)`);
  ok(e.alive && e.body.isActive(), 'the egg stays in the vault (he never takes an egg)');
}
{ // dash: he spots the egg past ring 2 through its gap, puffs (the telegraph, URCHIN.puff s), dashes, cracks it once, rolls home
  const sim = fresh();
  put(sim, sim.eggs[0], 3, 95);
  const log = run(sim, 12);
  const aim = log.find((x) => x.type === 'urPuff' && x.why === '' && sim) && log.filter((x) => x.type === 'urPuff'), dash = at(log, 'urDash'), hit = log.find((x) => x.type === 'urHit');
  const lastPuff = dash ? aim.filter((x) => x.t <= dash.t).pop() : null;
  ok(!!dash && !!hit, 'he spots an egg through a gap and dashes at it');
  ok(lastPuff && Math.abs(dash.t - lastPuff.t - URCHIN.puff.medium) < 0.05, `the telegraph: he puffs ${lastPuff ? (dash.t - lastPuff.t).toFixed(2) : '?'} s before the dash (Medium ${URCHIN.puff.medium})`);
  ok(sim.eggs[0].cracks === 1 && sim.eggs[0].alive, `the hit cracks it once (${sim.eggs[0].cracks})`);
  ok(!!at(log, 'urLaugh'), 'he rolls home and snickers');
}
{ // telegraph per mode
  for (const mode of ['easy', 'hard']) {
    const sim = fresh(mode);
    put(sim, sim.eggs[0], 3, 95);
    const log = run(sim, 14), dash = at(log, 'urDash'), puff = dash && log.filter((x) => x.type === 'urPuff' && x.t <= dash.t).pop();
    ok(dash && Math.abs(dash.t - puff.t - URCHIN.puff[mode]) < 0.05, `${mode}: ${URCHIN.puff[mode]} s of puff before the dash`);
  }
}

// ---------------------------------------------------------------- the counters
const dashScene = (mode = 'medium', hook, opts = {}, L = {}, secs = 16) => {
  const sim = fresh(mode, opts, L);
  put(sim, sim.eggs[0], 3, 95);
  let mark = -1;
  const log = run(sim, secs, (s) => { const U = U0(s); if (hook) mark = hook(s, U, mark); });
  return { sim, log };
};
{ // shut the gap he aims through while he puffs: SPLAT, on his back for URCHIN.flip s, the egg is fine
  for (const mode of ['easy', 'medium', 'hard']) {
    const { sim, log } = dashScene(mode, (s, U, m) => { if (U.ph === 'puff' && U.aim && m < 0) m = s.t; if (m > 0 && s.t - m < 1.2) turnAt(2, 0.03)(s); return m; });
    const sp = at(log, 'urSplat'), up = at(log, 'urUp');
    ok(!!sp && sim.eggs[0].cracks === 0, `${mode}: a wall turned into his dash: SPLAT, and the egg is not touched`);
    ok(sp && up && up.t - sp.t >= URCHIN.flip[mode] + URCHIN.splat - 0.05, `${mode}: helpless on his back ${sp && up ? (up.t - sp.t).toFixed(2) : '?'} s (flip ${URCHIN.flip[mode]} s)`);
  }
}
{ // shut it behind him on his way home: SPLAT on the way back
  const { log } = dashScene('medium', (s, U, m) => { if (U.ph === 'back' && m < 0) m = s.t; if (m > 0 && s.t - m < 1.2) turnAt(2, 0.03)(s); return m; });
  ok(!!at(log, 'urSplat'), 'a gap shut behind him: SPLAT on his way home');
}
{ // no wall: no splat (the way home is never shut by itself)
  const { log } = dashScene('medium');
  ok(!at(log, 'urSplat'), 'left alone he never splats by himself');
}
{ // the Stone Shell (or any stone egg) takes his dash: he bonks and flips, no crack
  const { sim, log } = dashScene('medium', null, { stone: true }, {}, 9); // (the booster's stone lasts 8 s: his first dash comes in time)
  ok(at(log, 'urBonk') && at(log, 'urFlip') && sim.eggs[0].cracks === 0, 'Stone Shell booster: his dash bonks off the stone egg and he flips; no crack');
}
{ // the Golden Shell takes one spine hit, as it does a thorn's
  const { sim, log } = dashScene('medium', null, { golden: true });
  ok(at(log, 'goldenSave') && sim.eggs[0].cracks === 0, 'Golden Shell booster: his hit spends the gold, no crack');
}
{ // a chick touching him flips him; a burning egg flips him; a zapped egg flips him
  for (const [name, set] of [['a chick', (e) => { e.chick = 1; }], ['a burning egg', (e) => { e.fire = 5; e.fireKind = 'fire_red'; }], ['a zapped egg', (e) => { e.zap = 3; }]]) {
    const sim = fresh();
    const U = U0(sim);
    run(sim, 4.5); U.cd = 99;
    const e = sim.eggs[0];
    set(e);
    const a = Math.atan2(U.y, U.x) + U.face * 0.18;
    put(sim, e, 2, (a * 180) / Math.PI);
    const log = run(sim, 2);
    ok(at(log, 'urFlip') && e.cracks === 0, `${name} touching him flips him (no crack)`);
  }
}

// ---------------------------------------------------------------- boosters and powers
{ // Scarecrow: spines flat, harmless, as long as it stands
  const sim = fresh('medium', { scare: true });
  const U = U0(sim);
  run(sim, 2);
  ok(U.ph === 'scare', `Scarecrow booster: he is scared (${U.ph})`);
  put(sim, sim.eggs[0], 3, 95);
  const log = run(sim, 10);
  ok(!at(log, 'urDash') && sim.eggs[0].cracks === 0, 'while the Scarecrow stands he never dashes or cracks');
}
{ // the other boosters do not touch him: Slow fuse, Free rewind (he rewinds with the vault), Sponge pad, Wide Nest, Thorn Snips
  const sim = fresh('medium', { time: 15, sponge: true, nest: true, snips: true });
  put(sim, sim.eggs[0], 3, 95);
  const log = run(sim, 12);
  ok(at(log, 'urDash'), 'Slow fuse, Sponge pad, Wide Nest and Thorn Snips leave him as he is');
}
const p2 = (kind, T = 4) => { const sim = fresh(); run(sim, 4.5); const U = U0(sim); sim.p2All(kind, T); return { sim, U }; };
{
  let { U } = p2('ice'); ok(U.fz > 0, 'Frost (ice): frozen on his ring');
  ({ U } = p2('bolt')); ok(U.ph === 'flip', 'Thunder (bolt): flipped, spiral eyes');
  ({ U } = p2('zap')); ok(U.ph === 'flip', 'zap: flipped');
  ({ U } = p2('spin')); ok(U.ph === 'flip', 'spin: flipped');
  ({ U } = p2('pepper')); ok(U.ph === 'scare', 'Pepper: scared, spines flat');
  ({ U } = p2('scare')); ok(U.ph === 'scare', 'scare: scared');
  const o = p2('out', 3); ok(o.U.ph === 'out', 'Boom (out): knocked out of the vault');
  run(o.sim, 3.2); ok(o.U.ph === 'in' || o.U.ph === 'nap', `...and back home later (${o.U.ph})`);
}
{ // Chick Strike: every strike reaches him through stkTargets / stkApply
  for (const [kind, why, want] of [['ice', '', (U) => U.fz > 0], ['bolt', '', (U) => U.ph === 'flip'], ['out', '', (U) => U.ph === 'out'], ['spin', 'tornado', (U) => U.ph === 'flip'], ['bolt', 'tock', (U) => U.fz > 0], ['bolt', 'glue', (U) => U.ph === 'flip']]) {
    const sim = fresh();
    run(sim, 4.5);
    const T = sim.stkTargets().find((q) => q.type === 'urchin');
    sim.stkApply(T, kind, 3, why);
    ok(T && want(U0(sim)), `Chick Strike ${why || kind}: ${U0(sim).ph}${U0(sim).fz > 0 ? ' (frozen)' : ''}`);
  }
}
{ // the live ring under him, and the reef's chick hits (glow flash, dash chick)
  const sim = fresh(); run(sim, 4.5);
  sim.urShock(1, 3);
  ok(U0(sim).ph === 'flip', 'the live ring under him: zapped onto his back');
  const s2 = fresh(); run(s2, 4.5);
  const U = U0(s2), n = s2.urHit('glow', { x: U.x, y: U.y, r: 1 });
  ok(n === 1 && U.ph === 'flip', 'a chick power that hits him (glow flash, dash chick): flipped');
}
{ // the warp gate (picked up): it swallows him as he dashes and spits him out far across his channel, dazed
  const sim = fresh(); put(sim, sim.eggs[0], 3, 95); run(sim, 4.5);
  sim.warpArm();
  const U = U0(sim), a0 = Math.atan2(U.y, U.x);
  let warped = false;
  const log = run(sim, 4, (s) => { if (U0(s).ph === 'warp') warped = true; });
  const a1 = Math.atan2(U.y, U.x), da = Math.abs(Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0)));
  ok(warped && !at(log, 'urHit') && sim.eggs[0].cracks === 0 && da > 1.5 && U.ch === 2, `warp gate: swallowed as he dashes, out ${((da * 180) / Math.PI).toFixed(0)} deg away, the egg untouched`);
}

// ---------------------------------------------------------------- determinism
{
  const a = dashScene('medium'), b = dashScene('medium');
  const same = JSON.stringify(a.log) === JSON.stringify(b.log) && JSON.stringify(a.sim.urState()) === JSON.stringify(b.sim.urState());
  ok(same, 'same level, same seed: the same run, event for event');
  // a snapshot mid-dash resumes exactly
  const sim = fresh(); put(sim, sim.eggs[0], 3, 95);
  run(sim, 30, null);
  const s1 = fresh(); put(s1, s1.eggs[0], 3, 95);
  let S = null;
  for (let i = 0; i < 30 / DT && !S; i++) { for (const q of s1.rings) q.target = q.body.getAngle(); s1.step(); s1.events.length = 0; if (U0(s1).ph === 'dash') S = s1.fullState(); }
  const c1 = Sim.fromState(level(), S), c2 = Sim.fromState(level(), S);
  run(c1, 5); run(c2, 5);
  ok(!!S && JSON.stringify(c1.urState()) === JSON.stringify(c2.urState()) && c1.eggs[0].cracks === c2.eggs[0].cracks, 'a snapshot taken mid-dash resumes the same way twice');
  ok(!!S && U0(Sim.fromState(level(), S)).ph === 'dash', 'his state is in the snapshot (rewind, the planner)');
}

// ---------------------------------------------------------------- never unwinnable
{ // left alone with an egg in reach, he never breaks it in one go: one crack a hit, and a pause between two hits on it
  for (const mode of ['easy', 'medium', 'hard']) {
    const sim = fresh(mode);
    put(sim, sim.eggs[0], 3, 95);
    let gone = false;
    const ts = run(sim, 60, (s) => { const e = s.eggs[0]; if (e.alive && !e.saved && (!e.body || !e.body.isActive())) gone = true; }).filter((x) => x.type === 'urHit').map((x) => x.t);
    let minGap = Infinity;
    for (let i = 1; i < ts.length; i++) minGap = Math.min(minGap, ts[i] - ts[i - 1]);
    ok(!gone, `${mode}: the egg is never taken out of play`);
    ok(minGap >= URCHIN.ban - 0.01, `${mode}: at least ${URCHIN.ban} s between two of his hits on the same egg (${ts.length} hits in 60 s, closest ${isFinite(minGap) ? minGap.toFixed(1) : '-'} s)`);
  }
}
{ // level 46 itself: he is there, he fits his channel, and with no player he never ends the level by himself in 20 s
  const L = LEVELS.find((q) => q.id === 46);
  ok(L && L.urchin, 'level 46 has Spike');
  if (L && L.urchin) {
    for (const mode of ['easy', 'medium', 'hard']) {
      const sim = new Sim(L, { mode });
      const log = run(sim, 20);
      const U = U0(sim), ch = sim.urChOf(U), clear = sim.rings[ch].r - sim.rings[ch - 1].r - 0.16;
      ok(sim.state === 'play' && sim.stats().broken === 0, `${mode}: level 46 is still in play after 20 s of nothing (${log.filter((x) => x.type === 'urHit').length} hits)`);
      ok(URCHIN.h + URCHIN.reach * 0.95 <= clear, `${mode}: spines out he fits his ${clear.toFixed(2)} m channel`);
    }
  }
}

console.log(bad ? `\n${bad} FAILED` : '\nall ok');
process.exit(bad ? 1 : 0);
