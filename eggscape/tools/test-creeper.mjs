// The thorn creeper (sim/creeper.js, 0.8.18): node tools/test-creeper.mjs   (exits 1 on a failure)
// No browser. A small dry vault (four rings, gaps only where the test wants them) with a creeper on ring 1's inner face
// (the floor of channel 1) over the bottom, and one egg put where the test wants it. Checks the crawl (eased, back and
// forth), the coil (the safe window: at least 0.8 s on Medium, harmless, an egg rolls over it), a hit (breaks on Medium,
// one crack on Easy), every counter (a flaming egg burns it to a stump that regrows, a stone egg snaps it, the glow
// chick's flash, the laser, Thorn Snips), that it rides with its ring, the teaching hook (creeperNear), determinism (two
// runs, and a snapshot taken mid-crawl, match exactly), and the level data (each level that has one: proved by gen.mjs).
import { Sim, DT } from '../src/sim/sim.js';
import { CREEP } from '../src/sim/creeper.js';
import { LEVELS } from '../src/data/levels.js';
import { villainKinds, VILLAIN_INFO } from '../src/data/villain-info.js';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const deg = (d) => (d * Math.PI) / 180;

const level = (o = {}, creep = {}) => ({ id: 999, theme: 'bramble', material: 'wood', spacing: 1.05, nest: { w: 2.6 }, eggs: 1, target: 1, time: 0, seed: 5, world: 2,
  rings: [{ gaps: [{ a: 90 }] }, { gaps: [{ a: 0 }], creep: { a0: -125, a1: -55, v: 0.5, rest: 1.0, delay: 0.4, ...creep } }, { gaps: [{ a: 90 }] }, { gaps: [{ a: -30 }] }], ...o });
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
    for (const ev of sim.events) if (/^creep|^crack$|^break|goldenSave|stkSnip/.test(ev.type)) log.push({ t: +sim.t.toFixed(3), type: ev.type, why: ev.why || '' });
    sim.events.length = 0;
  }
  return log;
}
const C0 = (sim) => sim.creeps[0];
const at = (log, type) => log.find((x) => x.type === type);
const hold = (sim) => { const e = sim.eggs[0]; if (e.body) { put(sim, e, 2, 90); } }; // park the egg out of the way (channel 2, top)

// ---------------------------------------------------------------- the crawl and the coil
{
  const sim = fresh();
  const C = C0(sim);
  ok(!!C && C.side === 'in' && C.ri === 1, 'the creeper is built on ring 1, inner face');
  // keep the egg out of its way: channel 0 holds it (ring 0's gap is at the top)
  const us = [], phs = [];
  for (let i = 0; i < 9 / DT; i++) { for (const q of sim.rings) q.target = q.body.getAngle(); sim.step(); sim.events.length = 0; us.push(C.u); phs.push(C.ph); }
  const lo = Math.min(...us), hi = Math.max(...us);
  ok(Math.abs(lo - deg(-125)) < 0.01 && Math.abs(hi - deg(-55)) < 0.01, `it crawls the whole stretch and no further (${(lo * 180 / Math.PI).toFixed(1)}..${(hi * 180 / Math.PI).toFixed(1)} deg)`);
  // eased: slow off the mark, fastest mid-stretch
  const i0 = phs.indexOf('crawl'); const sp = (i) => Math.abs(us[i + 1] - us[i]) / DT;
  let j = i0; while (phs[j] === 'crawl') j++;
  const mid = (i0 + j) >> 1;
  ok(sp(i0 + 2) < 0.3 * sp(mid), `it eases off the mark (${sp(i0 + 2).toFixed(3)} vs ${sp(mid).toFixed(3)} rad/s mid-crawl)`);
  // the coils between crawls: each at least the Medium safe window
  const runs = []; let k = j, n = 0; while (k < phs.length && phs[k] === 'coil') { n++; k++; } runs.push(n * DT);
  ok(runs[0] >= CREEP.minRest - 1e-6, `the coil at an end lasts ${runs[0].toFixed(2)} s (the safe window, at least ${CREEP.minRest} s on Medium)`);
  ok(phs.slice(k).includes('crawl') && us[k + 30] < us[k], 'then it crawls back the other way');
}
{ // a short rest in the data is never under the Medium floor
  const sim = fresh('medium', {}, {}, { rest: 0.3 });
  ok(sim.creepRest(C0(sim)) >= 0.8, `rest 0.3 in the data still coils ${sim.creepRest(C0(sim)).toFixed(2)} s on Medium`);
  const e = fresh('easy'); ok(e.creepRest(C0(e)) > 1.3 && e.creepCrawlT(C0(e)) > fresh().creepCrawlT(C0(fresh())), 'Easy: a longer coil and a slower crawl');
}

// ---------------------------------------------------------------- the hit
{ // Medium: the crawling head breaks an egg resting on its stretch
  const sim = fresh();
  put(sim, sim.eggs[0], 1, -90);
  const log = run(sim, 5);
  ok(!!at(log, 'creepHit') && !!at(log, 'break'), `Medium: it runs into the egg and breaks it (${log.map((x) => x.type).join(' ')})`);
  ok(C0(sim).hits === 1, 'one hit');
}
{ // Easy: one crack and a shove, never the break
  const sim = fresh('easy');
  put(sim, sim.eggs[0], 1, -90);
  const log = run(sim, 8);
  ok(!!at(log, 'creepHit') && !at(log, 'break') && sim.eggs[0].alive && sim.eggs[0].cracks >= 1, `Easy: it cracks the egg and shoves it off (cracks ${sim.eggs[0].cracks})`);
}
{ // coiled, it is harmless: an egg parked right on the coiled head is untouched until it sets off
  const sim = fresh('medium', {}, {}, { delay: 3 });
  const C = C0(sim);
  const p = { x: 0, y: 0 }; const a = sim.rings[1].body.getAngle() + C.u; p.x = C.rh * Math.cos(a); p.y = C.rh * Math.sin(a);
  put(sim, sim.eggs[0], 1, (a * 180) / Math.PI);
  const log = run(sim, 2.2);
  ok(!at(log, 'creepHit') && sim.eggs[0].alive && sim.eggs[0].cracks === 0, 'curled up, it never hurts an egg on top of it (the safe window)');
}
{ // the egg crosses the stretch while it is coiled: turning the ring rolls the egg right over it, unharmed
  const sim = fresh('medium', {}, {}, { delay: 2.5 });
  put(sim, sim.eggs[0], 1, -150);
  run(sim, 0.8);
  const r = sim.rings[1], goal = r.body.getAngle() + deg(-110); // the floor slides under the egg: the stretch passes it
  const log = run(sim, 1.4, (s) => { r.target = r.body.getAngle() + Math.max(-0.6, Math.min(0.6, goal - r.body.getAngle())); });
  ok(!at(log, 'creepHit') && sim.eggs[0].alive, `crossing the stretch during the coil is safe (${log.map((x) => x.type).join(' ') || 'nothing happened'})`);
}

// ---------------------------------------------------------------- it rides with its ring
{
  const sim = fresh('medium', {}, {}, { delay: 50 });
  hold(sim);
  const C = C0(sim), h0 = sim.creepHead(C), r = sim.rings[1], goal = r.body.getAngle() + deg(60);
  run(sim, 2, () => { r.target = r.body.getAngle() + Math.max(-0.6, Math.min(0.6, goal - r.body.getAngle())); });
  const h1 = sim.creepHead(C), turned = Math.atan2(h1.y, h1.x) - Math.atan2(h0.y, h0.x);
  ok(Math.abs(turned - deg(60)) < 0.03, `turning its ring carries it round (${(turned * 180 / Math.PI).toFixed(1)} deg for a 60 deg turn)`);
}

// ---------------------------------------------------------------- counters
{ // a flaming egg burns it back to a stump, and the stump regrows
  const sim = fresh();
  const e = sim.eggs[0]; put(sim, e, 1, -90); e.fire = 6; e.fireKind = 'fire_red';
  const log = run(sim, 4);
  ok(!!at(log, 'creepBurn') && e.alive && e.cracks === 0, 'a flaming egg in its way burns it back (the egg is fine)');
  ok(C0(sim).ph === 'stump', `then it is a stump (${C0(sim).ph})`);
  e.fire = 0; hold(sim);
  const seq = [];
  const l2 = run(sim, CREEP.regrow.medium + CREEP.burn + CREEP.grow + 2.5, (s) => { const ph = C0(s).ph; if (seq[seq.length - 1] !== ph) seq.push(ph); });
  ok(!!at(l2, 'creepGrow'), `the stump sprouts again after about ${CREEP.regrow.medium} s`);
  ok(seq.join(' ').includes('stump grow coil crawl'), `it unfurls and coils before it crawls on (${seq.join(' ')})`);
}
{ // a stone egg snaps it off
  const sim = fresh();
  const e = sim.eggs[0]; put(sim, e, 1, -90); sim.setStone(e, true);
  const log = run(sim, 4);
  ok(!!at(log, 'creepSnap') && e.alive, 'a stone egg snaps it off');
}
{ // a golden egg: the shell takes it (once) and snaps it
  const sim = fresh('medium', { golden: true });
  const e = sim.eggs[0]; put(sim, e, 1, -90);
  const log = run(sim, 4);
  ok(!!at(log, 'goldenSave') && !!at(log, 'creepSnap') && e.alive, 'the golden shell saves the egg and snaps it');
}
{ // the glow chick's flash, the laser beam
  const sim = fresh();
  hold(sim);
  const H = sim.creepHead(C0(sim));
  ok(sim.creepBurnAt(H.x + 0.5, H.y, 1.0) === 1 && C0(sim).ph === 'burn', 'fire in range (the glow flash) burns it');
  const s2 = fresh(); hold(s2);
  const H2 = s2.creepHead(C0(s2)), c = Math.cos(Math.atan2(H2.y, H2.x)), s = Math.sin(Math.atan2(H2.y, H2.x));
  ok(s2.p2Cut((x, y, r) => x * c + y * s > -r && Math.abs(x * s - y * c) < 0.2 + r, 'laser') >= 1 && C0(s2).ph === 'burn', 'the laser beam burns it');
}
{ // Thorn Snips: snipped for good at the start
  const sim = fresh('medium', { snips: true });
  hold(sim);
  const log = run(sim, 3);
  ok(!!at(log, 'creepSnip') && C0(sim).ph === 'gone', 'Thorn Snips snips it off at the start, for good');
  put(sim, sim.eggs[0], 1, -90);
  const l2 = run(sim, 6);
  ok(!at(l2, 'creepHit') && sim.eggs[0].alive, 'and it never comes back');
}

// ---------------------------------------------------------------- the teaching hook, the planner's caution
{
  const sim = fresh();
  const e = sim.eggs[0]; put(sim, e, 1, -75);
  const evs = [];
  for (let i = 0; i < 4 / DT && e.alive; i++) { for (const q of sim.rings) q.target = q.body.getAngle(); sim.step(); for (const ev of sim.events) if (ev.type === 'creeperNear' || ev.type === 'creepHit') evs.push(ev); sim.events.length = 0; }
  const n = evs.findIndex((x) => x.type === 'creeperNear'), h = evs.findIndex((x) => x.type === 'creepHit');
  ok(n >= 0 && (h < 0 || n < h), 'creeperNear fires before the head reaches an egg on its stretch (the teaching hook)');
  ok(evs.filter((x) => x.type === 'creeperNear').length === 1, 'once per approach');
  const s2 = fresh(); put(s2, s2.eggs[0], 1, -90); run(s2, 0.2);
  const s3 = fresh(); put(s3, s3.eggs[0], 1, 60); run(s3, 0.2);
  ok(s2.creepThreat(s2.eggs[0]) > 0.4 && s3.creepThreat(s3.eggs[0]) === 0, `an egg on its stretch is under threat (${s2.creepThreat(s2.eggs[0]).toFixed(2)}), one off it is not`);
}

// ---------------------------------------------------------------- determinism
{
  const go = () => { const sim = fresh(); put(sim, sim.eggs[0], 1, -60); run(sim, 6); return JSON.stringify(sim.creepState()) + sim.eggs[0].alive; };
  ok(go() === go(), 'two runs match exactly');
  const a = fresh(); put(a, a.eggs[0], 2, 90); run(a, 1.3);
  const S = a.fullState(), b = Sim.fromState(level(), S);
  run(a, 3); run(b, 3);
  ok(JSON.stringify(a.creepState()) === JSON.stringify(b.creepState()), 'a snapshot taken mid-crawl plays on the same');
}

// ---------------------------------------------------------------- the levels
{
  const with_ = LEVELS.filter((L) => L.rings.some((r) => r.creep));
  ok(with_.length >= 5 && with_.length <= 7, `the creeper is in ${with_.length} levels (${with_.map((L) => 'L' + L.id).join(' ')})`);
  ok(with_.every((L) => L.id > 5 && L.id !== 23), 'never in levels 1-5 or level 23');
  const first = with_[0];
  ok(first && first.world === 2, `its first level is in world 2 (L${first && first.id})`);
  if (first) {
    const c = first.rings.find((r) => r.creep).creep;
    ok(c.v <= 0.45 && c.a1 - c.a0 <= 50 && c.rest >= 1.2, `its first appearance is gentle (v ${c.v} m/s, stretch ${c.a1 - c.a0} deg, coil ${c.rest} s)`);
  }
  for (const L of with_) {
    ok(villainKinds(L).includes('creeper'), `L${L.id}: the level card lists the creeper`);
    for (const r of L.rings) if (r.creep) ok(r.creep.rest >= 0.8, `L${L.id}: coil ${r.creep.rest} s (at least 0.8 s on Medium)`);
  }
  ok(!!VILLAIN_INFO.creeper, 'the creeper is in the villain table');
}

console.log(bad ? `\n${bad} FAILED` : '\nall ok');
process.exit(bad ? 1 : 0);
