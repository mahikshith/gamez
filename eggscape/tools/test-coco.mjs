// Coco the monkey (sim/coco.js, level 10): node tools/test-coco.mjs   (exits 1 on a failure)
// No browser. A small vault (four rings, gaps only where a test wants them) with Coco in channel 2 (he grips ring 1, sits on
// ring 2) and one egg put where the test wants it. Checks each trick (ride, crossing, tail snatch, banana peel), each
// counter (a hard flick, a turn mid-crossing, carried up the side, fire, a stone egg, a gap under the peel), every power,
// hazard, chick and strike that reaches him, determinism (the same moves twice, and a snapshot resumed), and "never
// unwinnable": he never holds an egg for long, never cracks one himself, a held egg is always answerable by a planner
// move, and the planner clears level 10.
import { Sim, DT } from '../src/sim/sim.js';
import { COCO } from '../src/sim/coco.js';
import { animalsHit } from '../src/sim/boss.js';
import { actions } from '../src/sim/search.js';
import { LEVELS } from '../src/data/levels.js';
import { solve } from './planner.mjs';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const deg = (d) => (d * Math.PI) / 180;
const wdeg = (a) => { let d = (a * 180) / Math.PI; while (d > 180) d -= 360; while (d < -180) d += 360; return d; };

// rings: per ring index {gaps: [deg], thorns: [deg]}; every ring is solid elsewhere (one gap at the top by default)
function level(R = {}, mk = {}) {
  const rings = [0, 1, 2, 3].map((i) => { const o = R[i] || {}; return { gaps: (o.gaps || [90]).map((a) => ({ a })), thorns: (o.thorns || []).map((a) => ({ a, n: 2 })) }; });
  return { id: 903, theme: 'jungle', name: 'Coco test', eggs: 3, target: 1, spacing: 1.0, material: 'wood', nest: { w: 2.8 }, seed: 1010, world: 2, time: 300,
    monkey: { ch: 2, a: -100, delay: 0.3, ...mk }, rings };
}
function putEgg(sim, ch, a, e = sim.eggs[0]) {
  const r = sim.rings[ch].r - 0.08 - 0.3;
  e.body.setTransform({ x: r * Math.cos(deg(a)), y: r * Math.sin(deg(a)) }, 0);
  e.body.setLinearVelocity({ x: 0, y: 0 }); e.body.setAngularVelocity(0); e.body.setAwake(true);
  e.ch = sim.channelOf(e);
  return e;
}
const eggA = (e) => { const p = e.body.getPosition(); return wdeg(Math.atan2(p.y, p.x)); };
// run s seconds, every ring held where it is, except turn: {ring, by (deg), at (s)} turned at full speed (planner style)
function run(sim, s, turn = null, each = null) {
  const ev = [], t0 = sim.t;
  let goal = null;
  for (let i = 0; i < s / DT && sim.state === 'play'; i++) {
    for (const r of sim.rings) if (!r.motor) r.target = r.body.getAngle();
    if (turn && sim.t - t0 >= turn.at) {
      const R = sim.rings[turn.ring];
      if (goal == null) goal = R.body.getAngle() + deg(turn.by);
      R.target = R.body.getAngle() + Math.max(-0.6, Math.min(0.6, goal - R.body.getAngle()));
      if (turn.slow) R.target = R.body.getAngle() + Math.max(-turn.slow * DT, Math.min(turn.slow * DT, goal - R.body.getAngle())) * (1 / (14 * DT));
    }
    sim.step();
    for (const e of sim.events) ev.push({ ...e, t: sim.t });
    sim.events.length = 0;
    if (each) each(sim);
  }
  return ev;
}
const has = (ev, type, f = () => true) => ev.some((e) => e.type === type && f(e));
const first = (ev, type, f = () => true) => ev.find((e) => e.type === type && f(e));
const fresh = (R = {}, mk = {}, mode = 'medium') => new Sim(level(R, mk), { mode });
const until = (sim, ph, max = 30) => { for (let i = 0; i < max / DT && sim.cocos[0].ph !== ph; i++) run(sim, DT); return sim.cocos[0].ph === ph; };

// ---------------------------------------------------------------- RIDE
{
  const sim = fresh(), C = sim.cocos[0], R = sim.rings[1];
  let mn = 0, mx = 0;
  const ev = run(sim, 9, null, () => { const a = R.body.getAngle() * R.r; mn = Math.min(mn, a); mx = Math.max(mx, a); });
  const r0 = first(ev, 'cocoRide'), i0 = first(ev, 'cocoIn');
  ok(i0 && r0 && r0.t - i0.t > COCO.in + COCO.hang - 0.05, `ride: he swings in, hangs by his tail ${COCO.hang} s (the cheeky grin), then rides (in ${i0 && i0.t.toFixed(2)}, ride ${r0 && r0.t.toFixed(2)})`);
  ok(Math.abs(mx - COCO.rockA.medium) < 0.03 && Math.abs(mn + COCO.rockA.medium) < 0.03, `ride: he rocks his ring ${COCO.rockA.medium} m of rim each way by himself (${mn.toFixed(2)} .. ${mx.toFixed(2)})`);
  ok(Math.abs(R.body.getAngle() * R.r) < 0.01, 'ride: when the ride ends the ring is back where it was');
  ok(C.ph !== 'slip' && !has(ev, 'cocoSlip'), 'ride: his own rocking never throws him off');
}
// the counter: a hard flick throws him off, dizzy, then a sulk; a gentle turn just carries him
{
  const sim = fresh(), C = sim.cocos[0];
  until(sim, 'ride');
  const a0 = wdeg(sim.cocoA(C));
  const ev0 = run(sim, 1.5, { ring: 1, by: 12, at: 0, slow: 0.25 });
  ok(!has(ev0, 'cocoSlip') && Math.abs(wdeg(sim.cocoA(C)) - a0) > 5, `ride: a gentle turn of his ring carries him round (${a0.toFixed(0)} -> ${wdeg(sim.cocoA(C)).toFixed(0)} deg), he holds on`);
  const ev = run(sim, 1.4, { ring: 1, by: 40, at: 0 });
  ok(has(ev, 'cocoSlip', (e) => e.why === 'flick'), 'ride: a hard flick (40 deg at full speed) throws him off');
  const L = first(ev, 'cocoLand');
  ok(L && C.ph === 'dizzy' && C.at === 'floor', `ride: he lands on the floor below, dizzy (${C.ph}, ${COCO.slip} s in the air)`);
  const ev2 = run(sim, COCO.dizzy.medium + 0.2);
  ok(has(ev2, 'cocoSulk') && C.ph === 'sulk', `ride: after ${COCO.dizzy.medium} s dizzy he sulks (arms crossed) for ${COCO.sulk.medium} s`);
  const ev3 = run(sim, COCO.sulk.medium + COCO.cross.medium + 0.3);
  ok(has(ev3, 'cocoCross', (e) => e.dir < 0) && C.at === 'ceil', 'ride: then he climbs back up to his ring, hand over hand');
}
// carried too far up the side of the vault he cannot hold on
{
  const sim = fresh(), C = sim.cocos[0];
  until(sim, 'ride');
  const ev = run(sim, 9, { ring: 1, by: 80, at: 0, slow: 0.3 });
  ok(has(ev, 'cocoSlip', (e) => e.why === 'high'), `high: turned slowly round past ${(COCO.thMax * 180 / Math.PI).toFixed(0)} deg up the side, he loses his grip`);
}

// ---------------------------------------------------------------- CROSSING
{
  const sim = fresh(), C = sim.cocos[0];
  const ev = run(sim, 20);
  const d = first(ev, 'cocoCross', (e) => e.dir > 0), e1 = first(ev, 'cocoEat');
  ok(d && e1 && Math.abs(e1.t - d.t - COCO.cross.medium) < 0.05, `cross: after a ride he climbs down hand over hand (${COCO.cross.medium} s) to sit on the floor`);
  ok(has(ev, 'cocoCross', (e) => e.dir < 0), 'cross: and back up after the peel');
  // during the crossing he holds both rings: the planner's moves include both, and turning either one shakes him off
  const s2 = fresh(), C2 = s2.cocos[0];
  until(s2, 'down');
  run(s2, 0.5);
  const held = s2.cocoRingsHeld();
  ok(held.includes(1) && held.includes(2) && actions(s2).some((a) => a.ring === 1), `cross: mid-crossing he holds ring 1 and ring 2 (one hand on each: ${held.join(',')})`);
  const ev2 = run(s2, 1, { ring: 2, by: 20, at: 0 });
  ok(has(ev2, 'cocoSlip', (e) => e.why === 'cross'), 'cross: turning the floor ring mid-crossing shakes him off');
  const s3 = fresh(); until(s3, 'down'); run(s3, 0.4);
  const ev3 = run(s3, 1, { ring: 1, by: -15, at: 0, slow: 0.4 });
  ok(has(ev3, 'cocoSlip', (e) => e.why === 'cross'), 'cross: even a gentle turn of the ceiling ring mid-crossing shakes him off');
  void C; void C2;
}

// ---------------------------------------------------------------- TAIL SNATCH
{
  const sim = fresh({}, { delay: 0.3 }), C = sim.cocos[0], e = sim.eggs[0];
  putEgg(sim, 2, -86);
  const ev = run(sim, 4);
  const a = first(ev, 'cocoAim'), s = first(ev, 'cocoSnatch'), g = first(ev, 'cocoGrab');
  ok(a && s && Math.abs(s.t - a.t - COCO.warn.medium) < 0.05, `snatch: an egg resting in reach: his eyes lock on, the tail wiggles ${COCO.warn.medium} s (the telegraph), then it curls down`);
  ok(g && C.eid === e.id && Math.abs(g.t - s.t - COCO.snatch) < 0.05, `snatch: ${COCO.snatch} s later he holds it dangling from his tail`);
  const p = e.body.getPosition(), h = sim.cocoFloorR(C) - Math.hypot(p.x, p.y);
  ok(h > 0.35 && e.cracks === 0, `snatch: it is lifted off the floor (its middle ${h.toFixed(2)} m up), whole`);
  // a flick: he flies off, the egg drops where he was, unharmed
  const a0 = eggA(e);
  const ev2 = run(sim, 2.5, { ring: 1, by: -40, at: 0 });
  ok(has(ev2, 'cocoSlip', (x) => x.why === 'flick') && has(ev2, 'cocoDrop', (x) => x.why === 'slip') && C.eid === 0, 'snatch: a flick of his ring throws him off and he lets the egg go');
  ok(e.alive && e.cracks === 0 && sim.channelOf(e) === 2, `snatch: the egg drops into his channel unharmed (cracks ${e.cracks}, ${a0.toFixed(0)} -> ${eggA(e).toFixed(0)} deg)`);
  const ev3 = run(sim, 6);
  ok(!has(ev3, 'cocoGrab'), 'snatch: dizzy and sulking, he leaves eggs alone');
}
// left alone he gets bored and sets it down where he took it
{
  const sim = fresh(), C = sim.cocos[0], e = sim.eggs[0];
  putEgg(sim, 2, -86);
  let hold = 0;
  const ev = run(sim, 14, null, () => { if (C.eid) hold += DT; });
  const d = first(ev, 'cocoDrop', (x) => x.why === 'bored');
  ok(d && Math.abs(hold - COCO.snatch - COCO.hold.medium - COCO.bored) < 0.1 && e.alive && e.cracks === 0, `snatch: left alone he holds it ${COCO.hold.medium} s, then sets it down, whole (held ${hold.toFixed(2)} s)`);
  ok(Math.abs(wdeg(Math.atan2(d.y, d.x)) - wdeg(sim.cocoA(C))) < 20, 'snatch: it is put down right under him');
}
// too hot, too heavy
{
  const sim = fresh(), e = sim.eggs[0];
  putEgg(sim, 2, -86); e.fire = 30; e.fireKind = 'red';
  const ev = run(sim, 4);
  ok(!has(ev, 'cocoAim') && sim.cocos[0].eid === 0, 'fire: a flaming egg is too hot to grab');
  const s2 = fresh(), e2 = s2.eggs[0];
  putEgg(s2, 2, -86); s2.setStone(e2, true); e2.stone = 99;
  const ev2 = run(s2, 4);
  ok(!has(ev2, 'cocoAim') && s2.cocos[0].eid === 0, 'stone: a stone egg is too heavy to grab');
}

// ---------------------------------------------------------------- BANANA PEEL
function peelOut(R = {}) {
  const sim = fresh(R);
  for (let i = 0; i < 30 / DT && !(sim.peels.length && sim.peels[0].ph === 'lie'); i++) run(sim, DT);
  return sim;
}
{
  const sim = fresh(), C = sim.cocos[0];
  const ev = run(sim, 17);
  const e0 = first(ev, 'cocoEat'), t0 = first(ev, 'cocoToss'), th = first(ev, 'cocoThrow'), pl = first(ev, 'cocoPeel');
  ok(e0 && t0 && Math.abs(t0.t - e0.t - COCO.eat) < 0.05, `peel: he eats a banana for ${COCO.eat} s (the telegraph: three bites, a gulp, a sly look at the peel)`);
  ok(th && Math.abs(th.t - t0.t - COCO.toss * COCO.release) < 0.05 && pl && Math.abs(pl.t - th.t - COCO.fly) < 0.05, `peel: the peel leaves his hand ${(COCO.toss * COCO.release).toFixed(2)} s into the toss and lands ${COCO.fly} s later`);
  const P = sim.peels[0], d = P ? Math.abs(sim.cocoPeelA(P) - C.wa) * sim.cocoFloorR(C) : 0;
  ok(P && P.ph === 'lie' && Math.abs(d - COCO.peelD) < 0.3, `peel: it lies on his floor about ${COCO.peelD} m from him (${d.toFixed(2)} m)`);
  const a0 = wdeg(sim.cocoPeelA(P));
  run(sim, 1.5, { ring: 2, by: 25, at: 0 });
  ok(Math.abs(wdeg(sim.cocoPeelA(P)) - a0 - 25) < 2, 'peel: it lies on the floor ring and turns with it');
}
{
  const sim = peelOut(), P = sim.peels[0], e = sim.eggs[0], a = wdeg(sim.cocoPeelA(P));
  putEgg(sim, 2, a + (a < -90 ? -14 : 14)); // up the slope from it: it rolls down onto it
  const ev = run(sim, 2.5);
  const s = first(ev, 'cocoPeelSlip');
  let vmax = 0; for (const x of ev) void x;
  ok(!!s && e.alive && e.cracks === 0, 'peel: an egg rolling onto it slips (whee!), unharmed');
  ok(P.ph === 'slip' || !sim.peels.includes(P), 'peel: one slip uses it up');
  const s2 = peelOut(), P2 = s2.peels[0], e2 = s2.eggs[0], a2 = wdeg(s2.cocoPeelA(P2));
  putEgg(s2, 2, a2 + (a2 < -90 ? -14 : 14));
  for (let i = 0; i < 2.5 / DT && !s2.events.some((x) => x.type === 'cocoPeelSlip'); i++) { for (const r of s2.rings) r.target = r.body.getAngle(); s2.step(); if (!s2.events.some((x) => x.type === 'cocoPeelSlip')) s2.events.length = 0; }
  const v = e2.body.getLinearVelocity();
  vmax = Math.hypot(v.x, v.y);
  ok(Math.abs(vmax - COCO.slipV.medium) < 0.6, `peel: it shoots off along the channel at about ${COCO.slipV.medium} m/s (${vmax.toFixed(2)})`);
}
{
  const sim = peelOut(), P = sim.peels[0], e = sim.eggs[0], a = wdeg(sim.cocoPeelA(P));
  e.fire = 30; e.fireKind = 'red'; putEgg(sim, 2, a + (a < -90 ? -14 : 14));
  const ev = run(sim, 2.5);
  ok(has(ev, 'cocoPeelBurn') && !has(ev, 'cocoPeelSlip'), 'peel: a flaming egg burns it up (no slip)');
  const s2 = peelOut(), P2 = s2.peels[0], e2 = s2.eggs[0], a2 = wdeg(s2.cocoPeelA(P2));
  s2.setStone(e2, true); e2.stone = 99; putEgg(s2, 2, a2 + (a2 < -90 ? -14 : 14));
  const ev2 = run(s2, 2.5);
  ok(!has(ev2, 'cocoPeelSlip') && P2.ph === 'lie', 'peel: a stone egg rolls over it without a slip (the peel stays)');
  const s3 = peelOut(), P3 = s3.peels[0], la = wdeg(s3.cocoPeelA(P3));
  const ev3 = run(s3, 4, { ring: 2, by: la < -90 ? -100 : 100, at: 0 });
  ok(has(ev3, 'cocoPeelGone', (x) => x.drop) && !s3.peels.some((p) => p.ph === 'lie'), `peel: its ring turned to carry it up past the side (${(COCO.peelTh * 180 / Math.PI).toFixed(0)} deg), it slides off`);
  const s5 = peelOut(), P5 = s5.peels[0];
  run(s5, 1.5, { ring: 2, by: wdeg(s5.cocoPeelA(P5)) < -90 ? -40 : 40, at: 0 });
  ok(P5.ph === 'lie', 'peel: a smaller turn just carries it along (it stays)');
  const s4 = peelOut(), P4 = s4.peels[0];
  run(s4, COCO.peelLife.medium + 1.5);
  ok(!s4.peels.includes(P4) || P4.ph !== 'lie', `peel: left alone it shrivels away after ${COCO.peelLife.medium} s`);
}

// ---------------------------------------------------------------- powers, hazards, chicks, strikes
function holding() {
  const sim = fresh(); putEgg(sim, 2, -86); until(sim, 'hold', 8);
  return sim;
}
{
  const S = (f) => { const sim = holding(); const C = sim.cocos[0]; const had = C.eid; f(sim, C); return { sim, C, had }; };
  const offAndDrop = (r) => r.had && r.C.eid === 0 && (r.C.ph === 'slip' || r.C.ph === 'dizzy');
  let r = S((sim) => sim.p2All('ice', 4));
  ok(r.had && r.C.ph === 'frozen' && r.C.eid === 0 && r.C.ice > 3, 'Frost (ice power): frozen stiff where he hangs, the egg drops');
  run(r.sim, 4.2); ok(r.C.ph === 'hang' || r.C.ph === 'ride' || r.C.ph === 'aim', 'Frost: then he thaws and carries on');
  r = S((sim) => sim.p2All('bolt', 3)); ok(offAndDrop(r) && (run(r.sim, 1.3), r.C.ph === 'dizzy'), 'Thunderclap: knocked off, dizzy, egg dropped');
  r = S((sim) => sim.p2All('pepper', 5)); ok(offAndDrop(r) && r.C.flee > 4, 'Pepper: ah-CHOO, knocked off, and he leaves eggs alone while it lasts');
  r = S((sim) => sim.p2All('spin', 1.5)); ok(offAndDrop(r), 'Spin: flung off his ring');
  r = S((sim) => sim.p2All('out', 8)); ok(r.C.ph === 'out' && r.C.eid === 0, 'Shatter (a blast): out of the vault for a while');
  run(r.sim, 1.2); ok(r.C.ph === 'away', 'a blast: he is gone, then comes back later');
  r = S((sim) => sim.p2All('scare', 2.5)); ok(r.C.ph === 'out' && r.C.eid === 0, 'Scarecrow / scare: off he goes, out of the vault');
  r = S((sim, C) => { const b = sim.cocoBody(C); sim.cocoHit('flash', { x: b.x, y: b.y, r: 1 }); }); ok(offAndDrop(r) && r.C.dizT === 2.2, 'Glow chick flash: knocked off, dazed 2.2 s');
  r = S((sim, C) => { const b = sim.cocoBody(C); sim.cocoHit('dash', { x: b.x, y: b.y, r: 0.3 }); }); ok(offAndDrop(r), 'Dash chick: bonked off, egg dropped');
  r = S((sim, C) => { const b = sim.cocoBody(C); animalsHit(sim, 'rock', { x: b.x, y: b.y, r: 0.5 }); }); ok(offAndDrop(r), 'a lava rock or boulder: knocked off');
  r = S((sim) => animalsHit(sim, 'quake', {})); ok(offAndDrop(r), 'a quake: shaken off');
  r = S((sim) => animalsHit(sim, 'gust', { dir: 1 })); ok(r.C.eid === r.had && r.C.ph === 'hold', 'a gust: he holds on (no effect)');
  r = S((sim) => { sim.p2.shock = 5; sim.p2.shockR = 1; sim.p2ShockCreatures(); }); ok(offAndDrop(r), 'Live ring (shock) on the ring he holds: zapped off');
  r = S((sim) => { sim.p2.shock = 5; sim.p2.shockR = 1; sim.p2ShockCreatures(); run(sim, 1.2); sim.p2ShockCreatures(); }); ok(r.C.ph === 'dizzy', 'Live ring: then a breather (not zapped every step)');
  r = S((sim, C) => { sim.p2LaserFoes((x, y, rr) => { const b = sim.cocoBody(C); return Math.hypot(x - b.x, y - b.y) < rr + 0.1; }); }); ok(offAndDrop(r), 'Laser beam across him: knocked off');
  r = S((sim) => { const T = sim.stkTargets().find((x) => x.type === 'coco'); sim.stkApply(T, 'ice', 4, 'test'); }); ok(r.C.ph === 'frozen' && r.C.eid === 0, 'Strike (ice chick): picked as a target; frozen, the egg dropped');
  r = S((sim) => { const T = sim.stkTargets().find((x) => x.type === 'coco'); sim.stkApply(T, 'bolt', 3, 'glue'); }); ok(offAndDrop(r), 'Strike (bolt / glue / tock): knocked off');
  r = S((sim) => { const T = sim.stkTargets().find((x) => x.type === 'coco'); sim.stkApply(T, 'out', 4, 'test'); }); ok(r.C.ph === 'out', 'Strike (bomb / tornado): out of the vault');
  { const sim = fresh(); putEgg(sim, 2, -86); sim.p2Decoy(sim.eggs[2]); const ev = run(sim, 3); ok(!has(ev, 'cocoAim'), 'Decoy: while it is out he leaves the eggs alone'); }
}

// ---------------------------------------------------------------- determinism
{
  const go = () => { const sim = fresh(); putEgg(sim, 2, -60); run(sim, 16, { ring: 1, by: 40, at: 11 }); return JSON.stringify(sim.cocoState()) + eggA(sim.eggs[0]).toFixed(4); };
  ok(go() === go(), 'determinism: the same vault and moves twice end exactly alike');
  const L = level();
  const a = new Sim(L, { mode: 'medium' }); putEgg(a, 2, -86);
  for (let i = 0; i < 8 / DT && a.cocos[0].ph !== 'hold'; i++) run(a, DT);
  const b = Sim.fromState(L, a.fullState());
  ok(a.cocos[0].ph === 'hold' && b.cocos[0].ph === 'hold' && b.cocos[0].eid === a.cocos[0].eid, 'determinism: a snapshot mid-hold restores him and the egg in his tail');
  run(a, 8); run(b, 8);
  ok(JSON.stringify(a.cocoState()) === JSON.stringify(b.cocoState()), 'determinism: the snapshot resumes exactly (his state and his peels)');
}

// ---------------------------------------------------------------- never unwinnable (level 10 itself)
{
  const L = LEVELS.find((l) => l.id === 10);
  ok(L && L.monkey && L.name === 'Monkey Business', 'level 10 is Monkey Business with Coco in it');
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const mode of ['easy', 'medium', 'hard']) {
    const sim = new Sim(L, { mode });
    let worst = 0, cur = 0, selfCrack = 0, n = 0, unanswerable = 0;
    for (let k = 0; k < 50 && sim.state === 'play'; k++) {
      const ring = Math.floor(rnd() * sim.rings.length), by = (rnd() - 0.5) * 240;
      const ev = run(sim, 2, { ring, by, at: 0 }, (s) => {
        const C = s.cocos[0];
        if (C.eid) { cur += DT; worst = Math.max(worst, cur); if (!actions(s).some((a) => a.ring === C.ch - 1)) unanswerable++; } else cur = 0;
      });
      for (const e of ev) if ((e.type === 'crack' || e.type === 'eggBreak') && sim.cocos.some((C) => C.eid === e.egg.id)) selfCrack++;
      n += ev.filter((x) => x.type.startsWith('coco')).length;
    }
    const cap = COCO.snatch + COCO.hold[mode] + COCO.bored + 0.1;
    ok((n >= 3 || sim.state !== 'play') && worst <= cap && selfCrack === 0 && unanswerable === 0, `${mode}: a random player, 100 s: Coco acted (${n} events), longest hold ${worst.toFixed(1)} s (cap ${cap.toFixed(1)}), never cracked an egg himself, a held egg always had a move that answers it`);
  }
  const r = solve(L, { mode: 'medium' });
  ok(r.state === 'won' && r.saved >= r.target, `the planner clears level 10 on Medium (${r.state}, ${r.saved}/${r.total}, ${r.t} s)`);
}

console.log(bad ? `\n${bad} FAILED` : '\nall ok');
process.exit(bad ? 1 : 0);
