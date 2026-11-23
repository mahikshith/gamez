// The crawlers' brain (sim/salamander.js BRAIN): node tools/test-foes.mjs   (exits 1 on a failure)
// No browser. A small vault (five rings, gaps only where the test wants them) with one fire salamander in channel 2 and one
// egg resting where the test puts it. Checks: an egg in front alerts it and gets breathed at within 4 s; an egg behind turns
// it round (a U-turn) within about 1 s, then gets breathed at; an egg one channel away sends it to the gap and through;
// with no egg near it keeps the idle rhythm (every x PRED.sal); a snapshot taken mid-hunt and mid-turn resumes exactly.
import { Sim, DT, PRED } from '../src/sim/sim.js';
import { SAL, BRAIN, GECKO } from '../src/sim/salamander.js';
import { THORN } from '../src/sim/thornback.js';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const deg = (d) => (d * Math.PI) / 180;

// gaps: per ring, the angles (deg) of its gaps; every ring is solid elsewhere and has no thorns
function level(gaps = {}) {
  const rings = [0, 1, 2, 3, 4].map((i) => ({ gaps: (gaps[i] || [92]).map((a) => ({ a })), thorns: [] }));
  return { id: 901, theme: 'volcano', name: 'Foes', eggs: 1, target: 1, spacing: 1, material: 'obsidian', nest: { w: 2.8 }, seed: 4242, world: 5,
    salamander: { delay: 0.3, every: 6, a: 90, ch: 2 }, rings };
}
// the egg at rest against the outer wall of channel ch, at angle a (deg)
function putEgg(sim, ch, a) {
  const e = sim.eggs[0], r = sim.rings[ch].r - 0.34;
  e.body.setTransform({ x: r * Math.cos(deg(a)), y: r * Math.sin(deg(a)) }, 0);
  e.body.setLinearVelocity({ x: 0, y: 0 }); e.body.setAngularVelocity(0); e.body.setAwake(true);
  e.ch = sim.channelOf(e);
  return e;
}
// lay the salamander down along channel ch with its snout at angle a (deg), walking dir (+1 ccw)
function putSal(sim, ch, a, dir) {
  const C = sim.sals[0], r = sim.salMid(ch), m = Math.ceil(sim.salBodyLen(C) / SAL.trail) + 2;
  C.dir = dir; C.rad = r; C.a = deg(a); C.pts = [];
  for (let i = 0; i < m; i++) C.pts.push(sim.salPt({}, C.a - dir * (i * SAL.trail) / r, r));
  C.ph = 'walk'; C.t = C.dur = 0; C.car = -1; C.climb = null; C.climbCD = 0; C.ht = -1; C.htT = BRAIN.quiet; C.tcd = 0; C.next = 30; C.brT = 9;
  sim.salCarry(C);
  return C;
}
function fresh(gaps, mode = 'medium') {
  const sim = new Sim(level(gaps), { mode });
  for (let i = 0; i < 1.5 / DT; i++) { sim.step(); sim.events.length = 0; } // the salamander is in, the egg has landed
  return sim;
}
function run(sim, secs, each = () => {}) {
  const evs = [];
  for (let i = 0; i < secs / DT; i++) { sim.step(); for (const e of sim.events) evs.push({ ...e, at: i * DT }); sim.events.length = 0; each(i * DT); if (sim.state !== 'play') break; }
  return evs;
}
const first = (evs, type) => { const e = evs.find((x) => x.type === type); return e ? e.at : Infinity; };

// 1. an egg in front: notice at once, breathe at the wall it rests on within 4 s
{
  const sim = fresh();
  const egg = putEgg(sim, 2, -90), C = putSal(sim, 2, -90 - 45, 1);
  const evs = run(sim, 5);
  const al = evs.find((e) => e.type === 'salAlert'), w = evs.find((e) => e.type === 'salWarn');
  ok(al && al.at < 0.2 && al.egg === egg, `front: alert at ${al ? al.at.toFixed(2) : '-'} s`);
  ok(w && w.at < 4, `front: breath telegraph at ${w ? w.at.toFixed(2) : '-'} s`);
  const p = egg.body.getPosition();
  ok(w && Math.hypot(w.x - p.x, w.y - p.y) < 0.7 && w.ring === 2, `front: aimed at the egg's wall (${w ? Math.hypot(w.x - p.x, w.y - p.y).toFixed(2) : '-'} m off, ring ${w && w.ring})`);
  ok(evs.filter((e) => e.type === 'salAlert').length === 1, 'front: one alert, not one per step');
  void C;
}
// 2. an egg behind: a U-turn (all four feet down first) within about 1 s, then the breath
{
  const sim = fresh();
  putEgg(sim, 2, -90); const C = putSal(sim, 2, -90 + 25, 1);
  let turned = Infinity, sawTurn = false;
  const evs = run(sim, 6, (t) => { if (C.ph === 'turn') sawTurn = true; if (C.dir === -1 && turned === Infinity) turned = t; });
  ok(first(evs, 'salAlert') < 0.2, 'behind: alert');
  ok(sawTurn && turned < 1.2, `behind: U-turn done at ${turned.toFixed(2)} s`);
  const w = first(evs, 'salWarn');
  ok(w < 4, `behind: breath telegraph at ${w.toFixed(2)} s`);
}
// 3. an egg one channel out: it turns toward the gap that leads there and climbs through
{
  const sim = fresh({ 2: [-40] });
  putEgg(sim, 3, -90); const C = putSal(sim, 2, -100, -1); // walking away from the gap at -40
  let turned = Infinity, inCh3 = Infinity;
  const evs = run(sim, 12, (t) => { if (C.dir === 1 && turned === Infinity) turned = t; if (sim.salCh(C) === 3 && inCh3 === Infinity) inCh3 = t; });
  ok(first(evs, 'salAlert') < 0.2, 'one channel out: alert');
  ok(turned < 1.2, `one channel out: turned toward the gap at ${turned.toFixed(2)} s`);
  ok(inCh3 < 10, `one channel out: through the gap into its channel at ${inCh3.toFixed(2)} s`);
}
// 4. no egg near: the idle rhythm (every x PRED.sal, plus the telegraph, the breath and the settle)
for (const mode of ['easy', 'medium', 'hard']) {
  const sim = fresh({ 1: [], 2: [], 3: [] }, mode); // no way out of channel 1
  putEgg(sim, 4, -90); const C = putSal(sim, 1, 90, 1); C.next = 1;
  const evs = run(sim, 30);
  const fires = evs.filter((e) => e.type === 'salFire').map((e) => e.at), gaps = fires.slice(1).map((t, i) => t - fires[i]);
  const want = 6 * PRED[mode].sal + SAL.warn * PRED[mode].warn + SAL.fire + SAL.settle;
  ok(fires.length >= 3 && gaps.every((g) => Math.abs(g - want) < 0.45), `${mode}: idle breaths every ${gaps.map((g) => g.toFixed(2)).join(', ')} s (about ${want.toFixed(2)})`);
  ok(!evs.some((e) => e.type === 'salAlert'), `${mode}: no egg near, no alert`);
}
// 5. Easy: no faster chase; Hard: faster than Medium
{
  const v = {};
  for (const mode of ['easy', 'medium', 'hard']) {
    const sim = fresh({}, mode);
    putEgg(sim, 2, -90); const C = putSal(sim, 2, -90 - 100, 1);
    const a0 = C.a; run(sim, 0.5); v[mode] = Math.atan2(Math.sin(C.a - a0), Math.cos(C.a - a0)) * sim.salMid(2) / 0.5;
  }
  ok(Math.abs(v.easy - SAL.speed) < 0.02 && v.medium > v.easy * 1.25 && v.hard > v.medium, `chase speed easy ${v.easy.toFixed(2)}, medium ${v.medium.toFixed(2)}, hard ${v.hard.toFixed(2)} m/s`);
}
// 7. the frost gecko and a thorn-back use the same brain for their own moves: an egg behind turns them round, then the
//    gecko licks it frozen and the thorn-back hip-checks it
for (const sp of ['gecko', 'thornback']) {
  const sim = fresh();
  const C = sim.sals[0];
  if (sp === 'gecko') Object.assign(C, { sp, size: GECKO.svl / SAL.svl });
  else Object.assign(C, { sp, size: THORN.svl / SAL.svl, role: 'spike', dropT: 30, fcd: 0, flipCD: 0, weakT: null, duel: null, duels: 0, fk: '' });
  const egg = putEgg(sim, 2, -90); putSal(sim, 2, -90 + 30, 1);
  if (sp === 'thornback') C.dropT = 30;
  let turned = Infinity;
  const evs = run(sim, 8, (t) => { if (C.dir === -1 && turned === Infinity) turned = t; });
  const hit = evs.find((e) => e.type === (sp === 'gecko' ? 'geckoLick' : 'thornHip') && e.egg === egg);
  ok(first(evs, 'salAlert') < 0.2 && turned < 1.2, `${sp}: alert, and the U-turn done at ${turned.toFixed(2)} s`);
  ok(hit && hit.at < 6, `${sp}: ${sp === 'gecko' ? 'licks' : 'hip-checks'} the egg at ${hit ? hit.at.toFixed(2) : '-'} s`);
}
// 6. rewind: a snapshot mid-hunt and one mid-turn resume exactly (the new fields go through salState / salLoad)
{
  const sim = fresh();
  putEgg(sim, 2, -90); const C = putSal(sim, 2, -90 + 25, 1);
  let snapTurn = null;
  run(sim, 0.4, () => { if (!snapTurn && C.ph === 'turn' && C.t < C.dur * 0.6) snapTurn = sim.snapshot(); });
  const keys = ['ht', 'htT', 'alT', 'brT', 'tcd', 'jet', 'jk', 'ut', 'uA', 'uR', 'uD'];
  ok(snapTurn && keys.every((k) => snapTurn.sal.sals[0][k] !== undefined), 'the snapshot carries the brain fields');
  for (const [name, S] of [['mid-turn', snapTurn], ['mid-hunt', sim.snapshot()]]) {
    if (!S) continue;
    const a = Sim.fromState(sim.level, S), b = Sim.fromState(sim.level, S);
    for (let i = 0; i < 3 / DT; i++) { a.step(); b.step(); }
    const strip = (s) => JSON.stringify(s.sals[0], (k, v) => (typeof v === 'number' ? +v.toFixed(9) : v));
    ok(strip(a) === strip(b), `${name}: two restores run the same`);
    const c = Sim.fromState(sim.level, S);
    ok(keys.every((k) => c.sals[0][k] === S.sal.sals[0][k]), `${name}: restored fields equal the snapshot`);
  }
}
process.exit(bad ? 1 : 0);
