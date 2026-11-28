// The moving thorn (sim/creeper.js, 0.8.18 redone): node tools/test-creeper.mjs   (exits 1 on a failure)
// No browser. A small dry vault (four rings, gaps only where the test wants them) with a moving thorn on ring 1's inner
// face (the floor of channel 1) over the bottom, and one egg put where the test wants it. Checks that it IS a thorn of its
// ring (an entry of ring.thorns with the standing thorn's own triangle: the hit shape is the drawn thorn), the slide
// (eased, back and forth, a rest at each end, at least 0.8 s on Medium), ONE RULE for every moving thorn, the standing
// thorn's own (breaks on Medium and Hard, moving or at rest; one crack and a shove on Easy; the baby only shoves), every
// counter (a flaming egg burns it to a stub that springs back, a stone or golden egg snaps it, the glow chick's flash,
// the laser, Thorn Snips for good), that it rides with its ring, the teaching hook (creeperNear), determinism (two
// runs, and a snapshot taken mid-slide, match exactly), and the level data (one kind everywhere, a level in every
// world from 2 on, none in levels 1-5, a gentle baby first; each level proved by gen.mjs).
import { Sim, DT } from '../src/sim/sim.js';
import { CREEP } from '../src/sim/creeper.js';
import { LEVELS } from '../src/data/levels.js';
import { villainKinds, VILLAIN_INFO } from '../src/data/villain-info.js';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const deg = (d) => (d * Math.PI) / 180;

const level = (o = {}, creep = {}) => ({ id: 999, theme: 'bramble', material: 'wood', spacing: 1.05, nest: { w: 2.6 }, eggs: 1, target: 1, time: 0, seed: 5, world: 2,
  rings: [{ gaps: [{ a: 90 }] }, { gaps: [{ a: 0 }], thorns: [{ a: 150, n: 1 }], creep: { a0: -125, a1: -55, v: 0.5, rest: 1.0, delay: 0.4, ...creep } }, { gaps: [{ a: 90 }] }, { gaps: [{ a: -30 }] }], ...o });
const fresh = (mode = 'medium', opts = {}, L = {}, creep = {}) => new Sim(level(L, creep), { mode, ...opts });
// an egg at rest on the floor of channel ch at angle a (deg)
function put(sim, e, ch, a) {
  const r = sim.rings[ch].r - 0.08 - 0.23;
  e.body.setTransform({ x: r * Math.cos(deg(a)), y: r * Math.sin(deg(a)) }, 0);
  e.body.setLinearVelocity({ x: 0, y: 0 }); e.body.setAngularVelocity(0); e.body.setAwake(true);
}
function run(sim, s, hook) {
  const log = [];
  for (let i = 0; i < s / DT && sim.state === 'play'; i++) {
    for (const q of sim.rings) q.target = q.body.getAngle();
    if (hook) hook(sim);
    sim.step();
    for (const ev of sim.events) if (/^creep|^crack$|^break|goldenSave|stkSnip|^thorn|^graze/.test(ev.type)) log.push({ t: +sim.t.toFixed(3), type: ev.type, why: ev.why || '', mv: !!(ev.thorn && ev.thorn.mv) });
    sim.events.length = 0;
  }
  return log;
}
const C0 = (sim) => sim.creeps[0];
const T0 = (sim) => sim.creepThorn(C0(sim));
const at = (log, type) => log.find((x) => x.type === type);
const hold = (sim) => { const e = sim.eggs[0]; if (e.body) { put(sim, e, 2, 90); } }; // park the egg out of the way (channel 2, top)

// ---------------------------------------------------------------- it is a thorn of its ring
{
  const sim = fresh(), C = C0(sim), ring = sim.rings[1], th = T0(sim), st = ring.thorns[0];
  ok(!!C && C.side === 'in' && C.ri === 1, 'the moving thorn is built on ring 1, inner face');
  ok(ring.thorns.includes(th) && th.mv === C && th.alive && th.kind === 'hook', 'it is an entry of its ring\'s own thorns (a sharp one), so everything that reads ring.thorns sees it');
  ok(th.h === st.h && th.base === st.base && th.tip === st.tip && th.side === st.side, `the same size as a standing thorn of its ring (h ${th.h} m, base ${th.base.toFixed(2)}, tip ${th.tip.toFixed(2)})`);
  // hit shape = the drawn thorn: the fixture's triangle is the three points drawThorns draws from (base +- half, tip), where it is now
  const tri = (t) => { const s = t.shape || t.fix.getShape(), n = s.m_count, a = t.a; return [...Array(n)].map((_, i) => { const v = s.m_vertices[i], r = Math.hypot(v.x, v.y), da = Math.atan2(v.y, v.x) - a; return [+r.toFixed(4), +(Math.atan2(Math.sin(da), Math.cos(da)) * r).toFixed(3)]; }).sort((p, q) => p[0] - q[0] || p[1] - q[1]); };
  ok(JSON.stringify(tri(th)) === JSON.stringify(tri(st)), `its hit shape is the standing thorn's own triangle (${JSON.stringify(tri(th))})`);
  hold(sim); run(sim, 2.5);
  ok(C.ph === 'slide' && Math.abs(th.a - C.u) < 1e-9 && JSON.stringify(tri(th)) === JSON.stringify(tri(st)), `mid-slide the hit shape is still that triangle, where the thorn is drawn (thorn.a ${(th.a * 180 / Math.PI).toFixed(1)} deg)`);
  ok(Math.abs(th.shape.m_vertices.reduce((s, v) => s + Math.atan2(v.y, v.x), 0) / 3 - C.u) < 0.01, 'the hit shape moved with it');
  // it carries no fixture: a vault whose moving thorn nobody touches plays exactly as the vault without one
  const play = (withIt) => { const Lv = level(); if (!withIt) delete Lv.rings[1].creep; const q = new Sim(Lv, { mode: 'medium' }); put(q, q.eggs[0], 2, -60); const r1 = q.rings[2]; run(q, 6, (z) => { for (const g of z.rings) g.target = g.body.getAngle() + 0.3; }); const p = q.eggs[0].body ? q.eggs[0].body.getPosition() : { x: 0, y: 0 }; return JSON.stringify([p.x, p.y, q.rings.map((r) => r.body.getAngle()), q.eggs[0].alive]); };
  ok(th.fix === null && play(true) === play(false), 'no fixture: an egg that never meets it rolls exactly as in the same vault without it');
}

// ---------------------------------------------------------------- the core
{
  const sim = fresh();
  const C = C0(sim);
  hold(sim);
  const us = [], phs = [];
  run(sim, 14, () => { us.push(C.u); phs.push(C.ph); });
  const lo = Math.min(...us), hi = Math.max(...us);
  ok(Math.abs(lo - deg(-125)) < 0.01 && Math.abs(hi - deg(-55)) < 0.01, `it slides the whole groove and no further (${(lo * 180 / Math.PI).toFixed(1)}..${(hi * 180 / Math.PI).toFixed(1)} deg)`);
  const i0 = phs.indexOf('slide'), i1 = phs.indexOf('rest', i0), mid = Math.round((i0 + i1) / 2) + 20;
  const sp = (i) => Math.abs(us[i + 1] - us[i]) / DT;
  ok(sp(i0 + 2) < 0.3 * sp(mid), `it eases off the mark (${sp(i0 + 2).toFixed(3)} vs ${sp(mid).toFixed(3)} rad/s past the middle)`);
  ok(sp(i1 - 2) > 0.2 * sp(mid) && sp(i1 - 2) < 0.7 * sp(mid) && sp(i1 + 2) === 0, `it runs into its end stop still moving and stops dead (${sp(i1 - 2).toFixed(3)} rad/s, then 0)`);
  const runs = []; let k = i1; while (phs[k] === 'rest') k++; runs.push((k - i1) * DT);
  ok(runs[0] >= CREEP.minRest - 1e-6, `the rest at an end lasts ${runs[0].toFixed(2)} s (at least ${CREEP.minRest} s on Medium)`);
  ok(phs.slice(k).includes('slide') && us[k + 30] < us[k], 'then it slides back the other way');
}
{
  const sim = fresh('medium', {}, {}, { rest: 0.3 });
  ok(sim.creepRest(C0(sim)) >= 0.8, `rest 0.3 in the data still rests ${sim.creepRest(C0(sim)).toFixed(2)} s on Medium`);
  const e = fresh('easy'); ok(e.creepRest(C0(e)) > 1.3 && e.creepSlideT(C0(e)) > fresh().creepSlideT(C0(fresh())), 'Easy: a longer rest and a slower slide');
}

// ---------------------------------------------------------------- one rule: the standing thorn's
{ // Medium: it runs into a resting egg and breaks it
  const sim = fresh();
  put(sim, sim.eggs[0], 1, -90);
  const log = run(sim, 6);
  ok(!!at(log, 'break') && at(log, 'break').why === 'thorn', `Medium: it runs into the egg and breaks it, as a thorn (${log.map((x) => x.type + (x.why ? ':' + x.why : '')).join(' ')})`);
  ok(C0(sim).hits === 1 && C0(sim).ph === 'bite', 'one hit, and it holds for a beat');
}
{ // Hard: the same
  const sim = fresh('hard'); put(sim, sim.eggs[0], 1, -90);
  ok(!!at(run(sim, 6), 'break'), 'Hard: it breaks the egg');
}
{ // Easy: a crack and a shove, like every thorn on Easy
  const sim = fresh('easy');
  put(sim, sim.eggs[0], 1, -90);
  const log = run(sim, 5.8);
  ok(!at(log, 'break') && sim.eggs[0].alive && sim.eggs[0].cracks === 1 && C0(sim).hits >= 1, `Easy: it cracks the egg once and shoves it off (cracks ${sim.eggs[0].cracks})`);
  const l2 = run(sim, 12);
  ok(!at(l2, 'break') && sim.eggs[0].alive && sim.eggs[0].cracks <= 2, `Easy: it never breaks an egg (cracks ${sim.eggs[0].cracks} after 18 s in its way)`);
}
{ // at rest it is still a thorn: an egg dropped on its point breaks (a standing thorn does the same)
  const sim = fresh('medium', {}, {}, { delay: 30, a0: -90 });
  const e = sim.eggs[0], th = T0(sim), A = sim.rings[1].body.getAngle() + th.a, tx = th.tip * Math.cos(A), ty = th.tip * Math.sin(A);
  e.body.setTransform({ x: tx, y: ty + 0.45 }, 0); e.body.setLinearVelocity({ x: 0, y: -2 }); e.safeT = 0; // (past the grace every egg has at the start of a level) e.body.setAngularVelocity(0); e.body.setAwake(true);
  const log = run(sim, 3);
  ok(C0(sim).ph !== 'slide' && !!at(log, 'break') && at(log, 'break').why === 'thorn', `resting, it breaks an egg that falls on its point (${log.map((x) => x.type).join(' ') || 'nothing'})`);
}
{ // the same rule for every moving thorn, whatever its world or speed
  const outs = [];
  for (const [th, mat, v] of [['bramble', 'wood', 0.5], ['ice', 'ice', 0.3], ['volcano', 'obsidian', 0.9], ['reef', 'coral', 0.35], ['clockwork', 'metal', 0.8]]) {
    const sim = new Sim(level({ theme: th, material: mat }, { v }), { mode: 'medium' }); put(sim, sim.eggs[0], 1, -90);
    const log = run(sim, 9); outs.push((at(log, 'break') || {}).why || 'none');
    const s2 = new Sim(level({ theme: th, material: mat }, { v }), { mode: 'medium' }); const e = s2.eggs[0]; put(s2, e, 1, -90); e.fire = 9; e.fireKind = 'fire_red';
    const l2 = run(s2, 9); outs.push(at(l2, 'thornBurn') && C0(s2).ph !== 'gone' ? 'burnt' : 'unburnt');
  }
  ok(outs.every((x, i) => x === (i % 2 ? 'burnt' : 'thorn')), `one rule in every world: it breaks an egg and fire burns it (${[...new Set(outs)].join(', ')})`);
  ok(LEVELS.every((L) => L.rings.every((r) => !r.creep || (r.creep.form === undefined && r.creep.w === undefined))), 'no level gives a moving thorn a form of its own');
}
{ // it rides with its ring
  const sim = fresh();
  hold(sim);
  const C = C0(sim); C.t = 99; // keep it resting
  const h0 = sim.creepHead(C);
  const r = sim.rings[1], goal = r.body.getAngle() + deg(60);
  run(sim, 2, () => { r.target = r.body.getAngle() + Math.max(-0.6, Math.min(0.6, goal - r.body.getAngle())); });
  const h1 = sim.creepHead(C), turned = Math.atan2(h1.y, h1.x) - Math.atan2(h0.y, h0.x);
  ok(Math.abs(turned - deg(60)) < 0.03, `turning its ring carries it round (${(turned * 180 / Math.PI).toFixed(1)} deg for a 60 deg turn)`);
}

// ---------------------------------------------------------------- counters
{ // a flaming egg burns it back to a stub, and the stub springs back out
  const sim = fresh();
  const e = sim.eggs[0]; put(sim, e, 1, -90); e.fire = 6; e.fireKind = 'fire_red';
  const log = run(sim, 6);
  ok(!!at(log, 'thornBurn') && at(log, 'thornBurn').mv && e.alive && e.cracks === 0, 'a flaming egg in its way burns it back, with the thorn\'s own burn (the egg is fine)');
  ok(C0(sim).ph === 'stub' && T0(sim).alive && T0(sim).ext === 0, `then it is the retracted stub (${C0(sim).ph}, ext ${T0(sim).ext})`);
  e.fire = 0; const u = C0(sim).u, a = (u + sim.rings[1].body.getAngle()) * 180 / Math.PI; put(sim, e, 1, a); e.body.setAwake(false);
  const l1 = run(sim, 3, () => put(sim, e, 1, a));
  ok(!at(l1, 'break') && !at(l1, 'crack') && e.alive, 'the stub is harmless: an egg resting right on it is fine');
  hold(sim);
  const seq = [];
  const l2 = run(sim, CREEP.regrow.medium + 3, () => { if (seq[seq.length - 1] !== C0(sim).ph) seq.push(C0(sim).ph); });
  ok(!!at(l2, 'creepGrow'), `the stub springs back out after about ${CREEP.regrow.medium} s`);
  ok(seq.join(' ').includes('stub grow rest slide') && T0(sim).ext === 1, `it springs out and rests before it slides on (${seq.join(' ')})`);
  ok(Math.abs(C0(sim).u - u) > 0.01 && C0(sim).u >= C0(sim).a0 - 1e-9 && C0(sim).u <= C0(sim).a1 + 1e-9, 'it goes on from where it was cut, inside its groove');
}
{ // it will not spring out under an egg
  const sim = fresh(); hold(sim); run(sim, 2); sim.removeThorn(T0(sim), 'burn');
  const e = sim.eggs[0], a = (C0(sim).u + sim.rings[1].body.getAngle()) * 180 / Math.PI;
  const l = run(sim, CREEP.regrow.medium + 4, () => put(sim, e, 1, a));
  ok(C0(sim).ph === 'stub' && !at(l, 'break') && e.alive, 'the stub waits while an egg sits right on it');
}
{ // a stone egg snaps it
  const sim = fresh();
  const e = sim.eggs[0]; put(sim, e, 1, -90); e.stone = 8;
  const log = run(sim, 6);
  ok(!!at(log, 'thornSnap') && e.alive && C0(sim).ph === 'stub', 'a stone egg snaps it off (it grows back)');
}
{ // a golden egg: saved once, and it is snapped
  const sim = fresh();
  const e = sim.eggs[0]; put(sim, e, 1, -90); e.golden = 1;
  const log = run(sim, 6);
  ok(!!at(log, 'goldenSave') && !!at(log, 'thornSnap') && e.alive, 'the golden shell saves the egg and snaps it');
}
{ // fire from elsewhere: the glow chick's flash and the laser read ring.thorns, so they burn it with the rest
  const sim = fresh(); hold(sim);
  const s2 = fresh(); hold(s2);
  const H2 = s2.creepHead(C0(s2)), c = Math.cos(Math.atan2(H2.y, H2.x)), s = Math.sin(Math.atan2(H2.y, H2.x));
  ok(s2.p2Cut((x, y, r) => x * c + y * s > -r && Math.abs(x * s - y * c) < 0.2 + r, 'laser') >= 1 && C0(s2).ph === 'stub', 'the laser beam burns it');
  sim.removeThorn(T0(sim), 'burn');
  ok(C0(sim).ph === 'stub' && T0(sim).alive, 'removeThorn (every burn, snap and peck in the game) cuts it to a stub, never for good');
}
{ // Thorn Snips: snipped for good at the start, with every other thorn
  const sim = fresh('medium', { snips: true });
  hold(sim);
  const log = run(sim, 4);
  ok(!!at(log, 'stkSnip') && C0(sim).ph === 'gone' && !T0(sim).alive, 'Thorn Snips snips it off at the start, for good');
  put(sim, sim.eggs[0], 1, -90);
  const l2 = run(sim, 12);
  ok(!at(l2, 'break') && sim.eggs[0].alive, 'and it never comes back');
}

// ---------------------------------------------------------------- the teaching hook, the planner's caution
{
  const sim = fresh();
  put(sim, sim.eggs[0], 1, -90);
  const evs = [];
  for (let i = 0; i < 6 / DT && sim.state === 'play'; i++) { for (const q of sim.rings) q.target = q.body.getAngle(); sim.step(); for (const ev of sim.events) evs.push({ ...ev }); sim.events.length = 0; }
  const n = evs.findIndex((x) => x.type === 'creeperNear'), h = evs.findIndex((x) => x.type === 'break');
  ok(n >= 0 && (h < 0 || n < h), 'creeperNear fires before the thorn reaches an egg on its groove (the teaching hook)');
  ok(evs.filter((x) => x.type === 'creeperNear').length === 1, 'once per approach');
  const ev = evs[n];
  ok(!!ev && ev.ring === 1 && (ev.away === 1 || ev.away === -1) && ev.form === undefined, `creeperNear carries its ring and the way away, and no form (${ev && ev.away})`);
  const s2 = fresh(); put(s2, s2.eggs[0], 1, -90); run(s2, 2);
  const s3 = fresh(); put(s3, s3.eggs[0], 2, 90); run(s3, 2);
  ok(s2.creepThreat(s2.eggs[0]) > 0.4 && s3.creepThreat(s3.eggs[0]) === 0, `an egg on its groove is under threat (${s2.creepThreat(s2.eggs[0]).toFixed(2)}), one off it is not`);
}

// ---------------------------------------------------------------- determinism
{
  const go = () => { const s = fresh(); put(s, s.eggs[0], 1, -70); const l = run(s, 8); return JSON.stringify([l, s.creepState()]); };
  ok(go() === go(), 'two runs match exactly');
  const a = fresh(); hold(a); run(a, 1.5);
  const b = Sim.fromState(level(), a.fullState()); run(a, 3); run(b, 3);
  ok(JSON.stringify(a.creepState()) === JSON.stringify(b.creepState()), 'a snapshot taken mid-slide plays on the same');
  const v = (s) => JSON.stringify([...Array(3)].map((_, i) => { const q = T0(s).shape.m_vertices[i]; return [q.x.toFixed(6), q.y.toFixed(6)]; }).sort());
  ok(v(a) === v(b) && T0(a).a === T0(b).a, 'and its hit shape is where the snapshot put it');
}

// ---------------------------------------------------------------- the baby (a first meeting)
{
  for (const m of ['easy', 'medium', 'hard']) {
    const sb = fresh(m, {}, {}, { baby: 1 }); put(sb, sb.eggs[0], 1, -90);
    const lb = run(sb, 7);
    ok(C0(sb).hits >= 1 && !at(lb, 'break') && sb.eggs[0].alive && sb.eggs[0].cracks === 0, `baby, ${m}: a hit only shoves (cracks ${sb.eggs[0].cracks}, ${sb.eggs[0].alive ? 'alive' : 'broken'})`);
  }
  const sb = fresh('medium', {}, {}, { baby: 1 });
  ok(T0(sb).h < sb.rings[1].thorns[0].h, `the baby is a shorter thorn (${T0(sb).h} m against ${sb.rings[1].thorns[0].h} m), so the picture says it is not a grown one`);
}

// ---------------------------------------------------------------- the levels
{
  const with_ = LEVELS.filter((L) => L.rings.some((r) => r.creep));
  ok(with_.length >= 5, `moving thorns are in ${with_.length} levels (${with_.map((L) => 'L' + L.id).join(' ')})`);
  ok(with_.every((L) => L.id > 5 && L.id !== 23 && ![25, 27, 29, 30].includes(L.id)), 'never in levels 1-5 or level 23; L25, L27, L29, L30 are left alone');
  const first = with_[0];
  ok(first && first.world === 2, `its first level is in world 2 (L${first && first.id})`);
  if (first) {
    const c = first.rings.find((r) => r.creep).creep;
    ok(c.v <= 0.35 && c.a1 - c.a0 <= 40 && c.rest >= 1.4, `its first appearance is gentle (v ${c.v} m/s, groove ${c.a1 - c.a0} deg, rest ${c.rest} s)`);
    ok(c.baby === 1 && !first.intro, `its first level marks it a baby (only shoves) and introduces nothing else (L${first.id})`);
  }
  ok(with_.filter((L) => L.rings.some((r) => r.creep && r.creep.baby)).length === 1, 'only the first meeting is a baby');
  for (const w of [2, 3, 4, 5, 6, 7, 8, 9, 10]) { const L = with_.filter((q) => q.world === w); ok(L.length >= 1, `world ${w}: ${L.map((q) => 'L' + q.id).join(', ') || 'none'}`); }
  for (const L of with_) {
    ok(villainKinds(L).includes('creeper'), `L${L.id}: the level card lists the moving thorn`);
    for (const r of L.rings) if (r.creep) ok(r.creep.rest >= 0.8, `L${L.id}: rest ${r.creep.rest} s (at least 0.8 s on Medium)`);
  }
  ok(!!VILLAIN_INFO.creeper && VILLAIN_INFO.creeper.name === 'Moving thorn', 'one entry in the villain table: Moving thorn');
  ok(!['swampvine', 'frostcrawler', 'lavaflow', 'anemone', 'spark', 'sawtooth', 'shard'].some((k) => VILLAIN_INFO[k]), 'the old family\'s entries are gone');
}

console.log(bad ? `\n${bad} FAILED` : '\nall ok');
process.exit(bad ? 1 : 0);
