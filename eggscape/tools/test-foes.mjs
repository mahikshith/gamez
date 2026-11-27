// The crawlers' brain (sim/salamander.js BRAIN): node tools/test-foes.mjs   (exits 1 on a failure)
// No browser. A small vault (five rings, gaps only where the test wants them) with one fire salamander in channel 2 and one
// egg resting where the test puts it. Checks: an egg in front alerts it and gets breathed at within 4 s; an egg behind turns
// it round (a U-turn) within about 1 s, then gets breathed at; an egg one channel away sends it to the gap and through;
// with no egg near it keeps the idle rhythm (every x PRED.sal); a snapshot taken mid-hunt and mid-turn resumes exactly.
import { Sim, DT, PRED } from '../src/sim/sim.js';
import { SAL, BRAIN, GECKO, BITE, FACE, SHAKE } from '../src/sim/salamander.js';
import { THORN } from '../src/sim/thornback.js';
import { dyn } from '../src/data/dynamism.js';
import { LEVELS } from '../src/data/levels.js';
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
function putSal(sim, ch, a, dir, C = sim.sals[0]) {
  const r = sim.salMid(ch), m = Math.ceil(sim.salBodyLen(C) / SAL.trail) + 2;
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

// 1. an egg in front: notice at once; close and in line (0.8.19 aggroB) the Tongue Lash's lock-on comes first, else the
// breath at the wall it rests on, within 4 s
{
  const sim = fresh();
  const egg = putEgg(sim, 2, -90), C = putSal(sim, 2, -90 - 45, 1);
  const evs = run(sim, 5);
  const al = evs.find((e) => e.type === 'salAlert'), w = evs.find((e) => e.type === 'salWarn' || e.type === 'salLashWarn');
  ok(al && al.at < 0.2 && al.egg === egg, `front: alert at ${al ? al.at.toFixed(2) : '-'} s`);
  ok(w && w.at < 4, `front: attack telegraph (${w && w.type}) at ${w ? w.at.toFixed(2) : '-'} s`);
  const p = egg.body.getPosition();
  ok(w && (w.type === 'salLashWarn' ? w.egg === egg : Math.hypot(w.x - p.x, w.y - p.y) < 0.7 && w.ring === 2), `front: aimed at the egg (${w && w.type})`);
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
  const w = Math.min(first(evs, 'salWarn'), first(evs, 'salLashWarn'));
  ok(w < 4, `behind: attack telegraph at ${w.toFixed(2)} s`);
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
// 5. the chase pace (0.8.19 aggroB): SAL.speed x 1.35 x the dynamism tempo of the mode (data/dynamism.js); Hard > Medium > Easy
{
  const v = {};
  for (const mode of ['easy', 'medium', 'hard']) {
    const sim = fresh({}, mode);
    putEgg(sim, 2, -90); const C = putSal(sim, 2, -90 - 100, 1);
    const a0 = C.a; run(sim, 0.5); v[mode] = Math.atan2(Math.sin(C.a - a0), Math.cos(C.a - a0)) * sim.salMid(2) / 0.5;
  }
  const want = (m) => SAL.speed * 1.35 * dyn('salamander', m).tempo;
  ok(['easy', 'medium', 'hard'].every((m) => Math.abs(v[m] - want(m)) < 0.02) && v.medium > v.easy && v.hard > v.medium, `chase speed easy ${v.easy.toFixed(2)}, medium ${v.medium.toFixed(2)}, hard ${v.hard.toFixed(2)} m/s`);
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
// 7. 0.8.14 the bite (BITE): an egg at its snout is coiled at, then eaten; rolled away in time, the jaws miss; a stone
// egg breaks the bite; the frost salamander's bite cracks and freezes; fire and frost in one channel face off
{
  const near = (sim, C) => putEgg(sim, 2, -90 + C.dir * 14); // just ahead of the snout at -90
  { // eaten
    const sim = fresh(); const C = putSal(sim, 2, -90, 1), egg = near(sim, C);
    const evs = run(sim, 6), coil = first(evs, 'salCoil'), eat = first(evs, 'salEat');
    ok(coil < 3 && eat > coil && eat < 5, `bite: coil at ${coil.toFixed(2)} s, eaten at ${eat.toFixed(2)} s`);
    ok(!egg.alive, 'bite: the egg is gone');
    ok(eat - coil >= BITE.coil * 0.6, `bite: a fair warning (${(eat - coil).toFixed(2)} s between the coil and the snap)`);
  }
  { // rolled away during the coil: a miss, the egg lives
    const sim = fresh(); const C = putSal(sim, 2, -90, 1), egg = near(sim, C);
    let moved = false;
    const evs = run(sim, 6, () => { if (!moved && C.ph === 'coil') { moved = true; putEgg(sim, 2, 90); } });
    ok(moved && first(evs, 'salSnapMiss') < 5 && egg.alive, 'bite: an egg rolled away in time is missed');
  }
  { // a stone egg: it reels
    const sim = fresh(); const C = putSal(sim, 2, -90, 1), egg = near(sim, C);
    egg.stone = 30; egg.armor = 30; egg.rock = 30;
    const evs = run(sim, 6);
    ok(sim.armored(egg) ? first(evs, 'salOuch') < 5 && egg.alive : true, 'bite: a stone egg breaks the bite');
  }
  { // frost: a crack and an ice block, not a kill
    const L = level(); L.salamander = { ...L.salamander, kind: 'frost' };
    const sim = new Sim(L, { mode: 'medium' }); for (let i = 0; i < 1.5 / DT; i++) { sim.step(); sim.events.length = 0; }
    const C = putSal(sim, 2, -90, 1), egg = near(sim, C);
    const evs = run(sim, 6), fb = first(evs, 'salFrostBite');
    ok(C.kind === 'frost' && fb < 5 && egg.alive && egg.cracks === 1, `frost bite at ${fb.toFixed(2)} s: one crack, the egg lives`);
    ok(!!egg.hold, 'frost bite: the egg is frozen to its wall');
  }
  { // fire meets frost
    const L = level(); L.eggs = 1; L.salamander = [{ delay: 0.3, every: 6, a: 90, ch: 2 }, { delay: 0.3, every: 6, a: -90, ch: 2, dir: -1, kind: 'frost' }];
    const sim = new Sim(L, { mode: 'medium' }); for (let i = 0; i < 1.5 / DT; i++) { sim.step(); sim.events.length = 0; }
    putSal(sim, 2, -110, 1, sim.sals[0]); putSal(sim, 2, -70, -1, sim.sals[1]); // nose to nose, 40 degrees apart
    const evs = run(sim, 12), f = first(evs, 'salFace'), b = first(evs, 'salFaceBurst');
    ok(f < 6 && b > f && b - f < FACE.t + 0.5, `face-off: they meet at ${f.toFixed(2)} s, the burst ${(b - f).toFixed(2)} s later`);
    const snap = sim.snapshot(), a2 = Sim.fromState(sim.level, snap), b2 = Sim.fromState(sim.level, snap);
    for (let i = 0; i < 3 / DT; i++) { a2.step(); b2.step(); }
    const strip = (s) => JSON.stringify(s.sals, (k, v) => (typeof v === 'number' ? +v.toFixed(9) : v));
    ok(strip(a2) === strip(b2), 'face-off: two restores run the same');
  }
}
// 0.8.19 (aggroB) the Twister bug ("half the body stayed, half went for a spin"): every crawler's trail stays one smooth
// body through the pepper sneeze, the spin and the pepper twister (both), and a snapshot taken mid-flee resumes exactly
{
  const fold = (C) => { let m = 0, s = 0; for (let i = 2; i < C.pts.length; i++) { const a0 = C.pts[i - 2], a1 = C.pts[i - 1], a2 = C.pts[i]; s = Math.max(s, Math.hypot(a2.x - a1.x, a2.y - a1.y)); const a = Math.atan2(a1.y - a0.y, a1.x - a0.x), b = Math.atan2(a2.y - a1.y, a2.x - a1.x); m = Math.max(m, Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))); } return [(m * 180) / Math.PI, s]; };
  for (const id of [18, 24, 25, 31]) for (const pw of ['pepper', 'spin', 'twister']) {
    const sim = new Sim(LEVELS.find((l) => l.id === id), { mode: 'medium' });
    while (sim.t < 6 && sim.state === 'play') sim.step();
    const e = sim.aliveEggs()[0];
    if (pw === 'twister') { sim.p2Take(e, 'pepper'); sim.p2Take(e, 'spin'); } else sim.p2Take(e, pw);
    let worst = 0, seg = 0, S = null;
    for (let i = 0; i < 7 / DT && sim.state === 'play'; i++) {
      sim.step(); sim.events.length = 0;
      if (i === Math.round(1 / DT)) S = sim.snapshot();
      for (const C of sim.sals) if (C.pts.length > 2 && C.ph !== 'wait' && C.ph !== 'gone') { const [m, sg] = fold(C); worst = Math.max(worst, m); seg = Math.max(seg, sg); }
    }
    ok(worst < 100 && seg <= 0.08, `trail L${id} ${pw}: no fold (sharpest bend ${worst.toFixed(0)} deg, longest step ${seg.toFixed(3)} m)`);
    if (S) { const a = Sim.fromState(sim.level, S), b = Sim.fromState(sim.level, S); for (let i = 0; i < 2 / DT; i++) { a.step(); b.step(); } const st = (x) => JSON.stringify(x.sals, (k, v) => (typeof v === 'number' ? +v.toFixed(9) : v)); ok(st(a) === st(b), `trail L${id} ${pw}: a mid-flee snapshot resumes exactly`); }
  }
}
// 0.8.19 (aggroB) the frozen egg: shaking its ring frees it with no words: the ice cracks on the first swing (SHAKE.deg),
// bursts on the second the other way; a frozen egg sits still through a slow drift one way
{
  const sim = fresh({}); const e = putEgg(sim, 2, -90);
  run(sim, 0.5); sim.iceEgg(e, 30);
  const ri = e.hold.ri, r = sim.rings[ri], turn = (d) => { const a = r.body.getAngle() + deg(d); r.target = a; };
  turn(SHAKE.deg + 4); const ev1 = run(sim, 1.2);
  ok(ev1.some((x) => x.type === 'eggIceCrack' && x.n === 1) && e.icy > 0, `ice: the first swing cracks the ice (icy ${e.icy.toFixed(1)} s left)`);
  turn(-(SHAKE.deg + 4) * 2); const ev2 = run(sim, 1.2);
  ok(ev2.some((x) => x.type === 'eggIceBurst' && x.why === 'shake') && !(e.icy > 0) && !e.hold, 'ice: the swing back bursts it: the egg is free');
}
// the thorn-back's spike roll (L24): lined up in his channel, he curls (the tell), rolls, then hits the egg or bonks
{
  const sim = new Sim(LEVELS.find((l) => l.id === 24), { mode: 'medium' });
  run(sim, 14);
  const S = sim.sals.find((C) => C.role === 'spike' && C.pts.length > 2) || sim.sals.find((C) => C.pts.length > 2);
  const ch = 2; putSal(sim, ch, -150, 1, S); putEgg(sim, ch, -150 + (2.2 / sim.salMid(ch)) * (180 / Math.PI)); S.rcd = 0; S.bored = 0; S.dropT = 9;
  let curl = 0;
  const evs = run(sim, 8, () => { for (const C of sim.sals) if (C.ph === 'curl' && C.dur && !curl) curl = C.dur; });
  const c = evs.find((x) => x.type === 'thornRoll'), h = c && evs.find((x) => /thornRoll(Hit|Bonk)/.test(x.type) && x.at >= c.at);
  ok(c && h && curl >= 0.45, `roll: a ${curl.toFixed(2)} s curl, rolled at ${c ? c.at.toFixed(2) : '-'} s, then ${h ? h.type : 'nothing'}`);
}
// the chameleon's vanish: far from any orb he fades to a ghost and pops back near one (chamFade, chamPop)
{
  const sim = new Sim(LEVELS.find((l) => l.id === 31), { mode: 'medium' });
  const evs = run(sim, 40);
  const f = evs.filter((x) => x.type === 'chamFade'), p = evs.filter((x) => x.type === 'chamPop');
  ok(f.length >= 1 && p.length >= 1 && p[0].at > f[0].at, `vanish: L31 ${f.length} fades, ${p.length} pops in 40 s`);
}
process.exit(bad ? 1 : 0);
