// The lava salamander's moves (sim/salamander.js LASH, DIVE, FIRE, VOLC): node tools/test-lava.mjs   (exits 1 on a failure)
// No browser. The small vault of test-foes (five rings 1 m apart, gaps only where the test puts them) with one fire
// salamander in channel 2 and one egg at rest on the outer floor of channel 3.
// 0.8.19 Tongue Lash (it replaced the Ember Spit): a straight line through a gap gets a lock-on tell (dynamism tell x
// mode), the tongue flies, sticks and reels the egg through the gap to the bite; out of line in the tell = a clean miss;
// the gap turned away mid-reel = it lets go; dragged past reach + slack = it snaps and he tumbles (tug of war); water
// douses him, stone makes it snap. Lava Dive: far off, he sinks, bubbles show where, he rises by the egg. The volcano
// (L26) rumbles before its bombs. Fire-up as 0.8.18. Mid-reel, mid-dive and bomb-in-flight snapshots resume exactly.
// The boss gets its powers from its phase flags and roars before its Lava volley.
import { Sim, DT } from '../src/sim/sim.js';
import { SAL, BRAIN, FIRE, FIRE_M, LASH, DIVE, VOLC } from '../src/sim/salamander.js';
import { dyn } from '../src/data/dynamism.js';
import { LEVELS } from '../src/data/levels.js';
import { RING_TH } from '../src/sim/geom.js';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const deg = (d) => (d * Math.PI) / 180;
const SAL_A = -125, EGG_A = -80;

function level(gaps = {}, sal = {}, thorns = {}) {
  const rings = [0, 1, 2, 3, 4].map((i) => ({ gaps: (gaps[i] || [92]).map((a) => ({ a })), thorns: thorns[i] || [] }));
  return { id: 902, theme: 'volcano', name: 'Lava', eggs: 1, target: 1, spacing: 1, material: 'obsidian', nest: { w: 2.8 }, seed: 4242, world: 5,
    salamander: { delay: 0.3, every: 6, a: 90, ch: 2, ...sal }, rings };
}
function putEgg(sim, ch, a) {
  const e = sim.eggs[0], r = sim.rings[ch].r - 0.34;
  e.body.setTransform({ x: r * Math.cos(deg(a)), y: r * Math.sin(deg(a)) }, 0);
  e.body.setLinearVelocity({ x: 0, y: 0 }); e.body.setAngularVelocity(0); e.body.setAwake(true);
  return e;
}
function putSal(sim, ch, a, dir, C = sim.sals[0]) {
  const r = sim.salMid(ch), m = Math.ceil(sim.salBodyLen(C) / SAL.trail) + 2;
  C.dir = dir; C.rad = r; C.a = deg(a); C.pts = [];
  for (let i = 0; i < m; i++) C.pts.push(sim.salPt({}, C.a - dir * (i * SAL.trail) / r, r));
  C.ph = 'walk'; C.t = C.dur = 0; C.car = -1; C.climb = null; C.climbCD = 9; C.ht = -1; C.htT = BRAIN.quiet; C.tcd = 0; C.next = 30; C.brT = 9; C.scd = 0; C.bored = 9;
  sim.salCarry(C);
  return C;
}
function fresh(gaps, sal, mode = 'medium', thorns) {
  const sim = new Sim(level(gaps, sal, thorns), { mode });
  for (let i = 0; i < 1.5 / DT; i++) { sim.step(); sim.events.length = 0; }
  return sim;
}
function run(sim, secs, each = () => {}) {
  const evs = [];
  for (let i = 0; i < secs / DT; i++) { sim.step(); for (const e of sim.events) evs.push({ ...e, at: i * DT }); sim.events.length = 0; if (each(i * DT, evs) === false) break; if (sim.state !== 'play') break; }
  return evs;
}
const has = (evs, type) => evs.find((x) => x.type === type) || null;
// the gap on ring 2 where the line from the head (channel 2 at SAL_A) to the egg's landing spot (channel 3 at EGG_A) crosses it
const probe = fresh({}, {});
const spot = (() => { const r = probe.rings[3].r - (RING_TH / 2 + 0.14); return { x: r * Math.cos(deg(EGG_A)), y: r * Math.sin(deg(EGG_A)) }; })();
const head = { x: probe.salMid(2) * Math.cos(deg(SAL_A)), y: probe.salMid(2) * Math.sin(deg(SAL_A)) };
const X = probe.salCross(head.x, head.y, spot.x, spot.y);
const GAP2 = X.length ? (Math.atan2(X[0].y, X[0].x) * 180) / Math.PI : 0;
ok(X.length === 1 && X[0].ri === 2, `the line from the head to the egg crosses ring 2 once (at ${GAP2.toFixed(1)} deg)`);
const scene = (mode = 'medium', sal = {}, gaps = { 2: [GAP2, GAP2 + 180] }, thorns) => {
  const sim = fresh(gaps, sal, mode, thorns);
  const egg = putEgg(sim, 3, EGG_A), C = putSal(sim, 2, SAL_A, 1);
  run(sim, 0.4, () => { C.ph = C.ph === 'walk' ? 'rest' : C.ph; C.t = 9; }); // let the egg settle while it waits
  C.ph = 'walk'; C.scd = 0;
  return { sim, egg, C };
};
const at = (evs, type, why) => evs.find((x) => x.type === type && (!why || x.why === why)) || null;

// 1. Tongue Lash (0.8.19): close, in front, a straight line through the gap: the lock-on tell (dynamism tell x mode), the
// tongue flies, sticks, and reels the egg through the gap to the mouth: the bite
for (const mode of ['easy', 'medium', 'hard']) {
  const { sim, egg, C } = scene(mode);
  let tell = 0;
  const evs = run(sim, 5, () => { if (C.ph === 'lash' && !tell) tell = C.dur; });
  const w = at(evs, 'salLashWarn'), f = at(evs, 'salLashFling'), s = at(evs, 'salLashStick'), e = at(evs, 'salEat');
  ok(Math.abs(tell - dyn('salamander', mode).tell) < 1e-6, `lash ${mode}: lock-on tell ${tell.toFixed(2)} s (dynamism ${dyn('salamander', mode).tell.toFixed(2)})`);
  ok(w && f && Math.abs(f.at - w.at - tell) < 0.05 && w.egg === egg, `lash ${mode}: warn at ${w ? w.at.toFixed(2) : '-'} s on the egg, fling at ${f ? f.at.toFixed(2) : '-'} s`);
  ok(s && Math.abs(s.at - f.at - LASH.fly) < 0.05, `lash ${mode}: stuck ${s && f ? (s.at - f.at).toFixed(2) : '-'} s after the fling (LASH.fly ${LASH.fly})`);
  ok(e && !egg.alive && e.at - s.at < LASH.maxReel, `lash ${mode}: reeled through the gap and bitten (${e && s ? (e.at - s.at).toFixed(2) : '-'} s of reel)`);
}
// 2. out of line during the tell: a clean miss, he blinks, annoyed (no tongue thrown at nothing)
{
  const { sim, egg, C } = scene();
  let moved = false;
  const evs = run(sim, 3, (t, E) => { if (!moved && C.ph === 'lash') { moved = true; putEgg(sim, 3, EGG_A + 60); } if (at(E, 'salLashMiss')) return false; });
  ok(moved && at(evs, 'salLashMiss', 'tell') && !at(evs, 'salLashFling') && egg.alive && egg.cracks === 0, 'miss: the egg left the line in the tell: a clean miss');
  ok(C.ph === 'miss' && C.lcd > 0, `miss: he blinks, annoyed (${C.ph}), then a cooldown (${C.lcd.toFixed(2)} s)`);
}
// 3. the gap turned away mid-reel: the tongue snags on the wall and lets go; the egg is safe
{
  const { sim, egg, C } = scene();
  let turned = false;
  const evs = run(sim, 4, () => { if (!turned && C.ph === 'reel') { turned = true; const r = sim.rings[2], a = r.body.getAngle() + deg(40); r.body.setTransform({ x: 0, y: 0 }, a); r.target = a; } });
  ok(turned && at(evs, 'salLashSnap', 'wall') && egg.alive, 'wall: the gap turned away mid-reel: the tongue lets go, the egg is safe');
}
// 4. tug of war: dragged away past reach + slack, the tongue snaps and he tumbles back, dazed LASH.tumble
{
  const { sim, egg, C } = scene();
  let ls = 0;
  const evs = run(sim, 4, (t, E) => {
    if (at(E, 'salLashSnap')) return false;
    if (C.ph === 'reel') { ls = Math.max(ls, C.ls); const p = egg.body.getPosition(), M = sim.salMouth(C), d = Math.hypot(p.x - M.x, p.y - M.y); egg.body.setLinearVelocity({ x: ((p.x - M.x) / d) * 2.5, y: ((p.y - M.y) / d) * 2.5 }); }
  });
  const t = at(evs, 'salLashSnap', 'tug');
  ok(t && egg.alive && C.ph === 'daze' && C.dk === 'tug', `tug: stretched past ${(LASH.reach + LASH.slack).toFixed(1)} m it snaps; he tumbles, dazed (${C.ph}/${C.dk})`);
  ok(ls > 0.6, `tug: the tension showed (C.ls up to ${ls.toFixed(2)})`);
  // the real way: turn the ring the egg rests on away from him while he reels: the ring drags it till the tongue snaps
  const S2 = scene(); let spun = false;
  const evs2 = run(S2.sim, 5, (t, E) => { if (at(E, 'salLashSnap')) return false; if (S2.C.ph === 'reel') { spun = true; const r = S2.sim.rings[3]; r.target = r.body.getAngle() + 0.5; } });
  const t2 = at(evs2, 'salLashSnap');
  ok(spun && t2 && t2.why === 'tug' && S2.egg.alive, `tug: turning the egg's ring away snaps the tongue (${t2 ? t2.why : 'no snap'})`);
}
// 5. a water egg: he will not lash it (he picks another move); a stone egg: he strains, it snaps, ouch
{
  const { sim, egg } = scene();
  egg.water = 30;
  const evs = run(sim, 4);
  ok(egg.alive && egg.cracks === 0 && !has(evs, 'salLashWarn'), 'water: he knows better than to lash a water egg');
  const S2 = scene(); S2.egg.stone = 30;
  const evs2 = run(S2.sim, 4);
  ok(S2.egg.alive && has(evs2, 'salLashStrain') && at(evs2, 'salLashSnap', 'stone'), 'stone: he strains on a stone egg, the tongue snaps');
}
// 6. Lava Dive: an egg two channels off with no gap near: he sinks into the floor, bubbles up by the egg, rises
{
  const sim = fresh({ 1: [], 2: [], 3: [] });
  const egg = putEgg(sim, 3, -90), C = putSal(sim, 1, -75, -1);
  const seen = new Set();
  const evs = run(sim, 9, () => { seen.add(C.ph); });
  const w = has(evs, 'salDiveWarn'), b = has(evs, 'salDiveBubble'), u = has(evs, 'salDiveUp');
  ok(w && b && u && w.at < b.at && b.at < u.at && seen.has('under'), `dive: sink ${w ? w.at.toFixed(2) : '-'} s, bubble ${b ? b.at.toFixed(2) : '-'} s, up ${u ? u.at.toFixed(2) : '-'} s`);
  ok(u && sim.salCh(C) === 3, `dive: he came up in the egg's channel (${sim.salCh(C)})`);
  ok(b && Math.hypot(b.ex - u.x, b.ey - u.y) < 0.05 && b.at > w.at + DIVE.sink, 'dive: the bubbles show where he will rise before he does');
  void egg;
}
// 6b. the volcano (L26): rumble first, then the bombs fall on the seeded spots and heat the floor; no blast
{
  const sim = new Sim(LEVELS.find((l) => l.id === 26), { mode: 'medium' });
  const evs = run(sim, 30);
  const r = evs.filter((e) => e.type === 'volcRumble'), w = evs.filter((e) => e.type === 'lavaWarn' && e.volc), l = evs.filter((e) => e.type === 'lavaLand' && e.volc);
  ok(r.length >= 3 && r.length === w.length && w.every((x, i) => Math.abs(x.at - r[i].at - VOLC.rumble) < 0.05), `volcano: ${r.length} rumbles, each ${VOLC.rumble} s before its bombs`);
  ok(l.length && !has(evs, 'lavaBlast'), `volcano: ${l.length} bombs landed, no blast`);
}
// 7. fire-up: a red flame orb ahead in its channel: greedy, gulp, white-hot; faster; a double breath; thorns by its feet burn
{
  const L = level({}, { fireup: 1 }, { 1: [{ a: -62, n: 2, side: 'out', h: 0.26 }] });
  L.orbs = [{ type: 'fire_red', ch: 2, a: -100 }];
  const sim = new Sim(L, { mode: 'medium' });
  for (let i = 0; i < 1.5 / DT; i++) { sim.step(); sim.events.length = 0; }
  const C = putSal(sim, 2, -150, 1);
  C.bored = 0; C.next = 30;
  const o = sim.orbs.find((q) => q.type === 'fire_red');
  let wantSeen = false;
  const evs = run(sim, 6, () => { if (C.og) wantSeen = true; });
  const g = has(evs, 'salGulp'), f = has(evs, 'salFireUp');
  ok(wantSeen && g && f && !o.alive, `fire-up: it wanted the orb, gulped it (${g ? g.at.toFixed(2) : '-'} s) and fired up (${f ? f.at.toFixed(2) : '-'} s)`);
  ok(f && Math.abs(C.whD - FIRE.t * FIRE_M.medium) < 1e-6, `fire-up: white-hot for ${C.whD} s on Medium`);
  // the next breath heats a double-length section
  const hot0 = sim.salHot.length;
  C.next = 0.01;
  const evs2 = run(sim, 2.5);
  const b = has(evs2, 'salFire');
  ok(b && b.dbl === 1 && b.n > 0, `fire-up: the next breath is double (dbl ${b && b.dbl}, ${b ? b.n : 0} segments)`);
  void hot0;
  // speed: white-hot it walks FIRE.speed x
  const odo0 = C.odo; C.next = 30; C.bored = 9;
  run(sim, 0.5, () => { if (C.ph !== 'walk') return false; });
  ok(C.wh > 0 && (C.odo - odo0) / 0.5 > SAL.speed * 1.15, `fire-up: walks faster (${((C.odo - odo0) / 0.5).toFixed(2)} m/s)`);
  // thorns by its feet burn (it walks on past the thorn at -62 on ring 1's outer side)
  const th = sim.rings[1].thorns;
  run(sim, 3);
  ok(th.some((t) => !t.alive) || evs.some((e) => e.type === 'salFootBurn'), `fire-up: thorns by its feet burnt (${th.filter((t) => !t.alive).length}/${th.length})`);
  // water knocks it back to grey and it sulks
  C.wh = 3; C.dbl = 1;
  const h = C.pts[0];
  sim.addOrb('water', 2, Math.atan2(h.y, h.x), 'test', Math.hypot(h.x, h.y));
  const evs3 = run(sim, 1);
  const c = has(evs3, 'salCool');
  ok(c && c.doused === 1 && C.wh === 0 && C.sulk > 0 && C.cool > 0, 'fire-up: water douses it straight back to grey, sulking');
}
// 8. lava under it fires it up at once (no orb); a breath off: a level without fireup never fires up
{
  const sim = fresh({}, { fireup: 1 });
  const C = putSal(sim, 2, -100, 1);
  sim.hitSalamander(C, 'lava', {});
  ok(C.wh > 0, 'lava: a lava hit fires it up');
  const sim2 = fresh({}, {});
  const C2 = putSal(sim2, 2, -100, 1);
  sim2.hitSalamander(C2, 'lava', {});
  ok(C2.wh === 0, 'lava: off unless the level asks');
}
// 9. rewind: mid-reel (tension and all), under the floor mid-dive, a volcano bomb in flight resume exactly
{
  const snaps = [];
  { const { sim, C } = scene('medium', { fireup: 1 }); run(sim, 4, () => { if (C.ph === 'reel' && C.dur - C.t > 0.2) { C.wh = 2.5; C.whD = 6; snaps.push(['mid-reel', sim]); return false; } }); }
  { const sim = fresh({ 1: [], 2: [], 3: [] }); putEgg(sim, 3, -90); const C = putSal(sim, 1, -75, -1); run(sim, 9, () => { if (C.ph === 'under') { snaps.push(['under the floor', sim]); return false; } }); }
  { const sim = new Sim(LEVELS.find((l) => l.id === 26), { mode: 'medium' }); run(sim, 20, () => { if (sim.lavaRocks.some((k) => k.v && k.ph === 'fly')) { snaps.push(['volcano bomb in flight', sim]); return false; } }); }
  ok(snaps.length === 3, `rewind: ${snaps.length}/3 snapshots taken (${snaps.map((x) => x[0]).join(', ')})`);
  for (const [name, sim] of snaps) {
    const S = sim.snapshot(), a = Sim.fromState(sim.level, S), b = Sim.fromState(sim.level, S);
    for (let i = 0; i < 3 / DT; i++) { sim.step(); a.step(); b.step(); }
    const strip = (s) => JSON.stringify({ c: s.sals.map((c) => ({ ...c, pts: c.pts.map((q) => [q.x, q.y]) })), k: s.eggs.map((e) => [e.cracks, e.alive, e.body.getPosition()]), l: s.lavaRocks }, (k, v) => (typeof v === 'number' ? +v.toFixed(6) : v));
    const rocks = (s) => JSON.stringify(s.lavaRocks, (k, v) => (typeof v === 'number' ? +v.toFixed(6) : v));
    ok(strip(a) === strip(b) && rocks(a) === rocks(sim), `${name}: two restores run the same (and the bombs as the original)`);
  }
}
// 10. the boss: the powers come from its phase flags (L30 The Eruption)
{
  const L = LEVELS.find((l) => l.id === 30);
  const ph = L.bossFight.phases;
  const sim = new Sim(L, { mode: 'medium' });
  for (let i = 0; i < 4 / DT; i++) { sim.step(); sim.events.length = 0; }
  const C = sim.sals.find((c) => c.boss);
  const B = sim.bx.boss;
  for (let i = 0; i < ph.length; i++) {
    B.phase = i;
    ok(sim.salPw(C, 'spit') === !!ph[i].spit && sim.salPw(C, 'fu') === !!ph[i].fire, `boss phase ${i + 1}: lash ${!!ph[i].spit}, fire-up ${!!ph[i].fire}`);
  }
  // 0.8.19: the Lava volley: a roar (the tell), then bombs from the crater on the eggs' floor; no blast
  const sim2 = new Sim(L, { mode: 'medium' });
  const evs = run(sim2, 40);
  const ro = evs.filter((e) => e.type === 'salRoar'), lv = evs.filter((e) => e.type === 'lavaLand' && e.volc);
  ok(ro.length >= 2 && lv.length >= ro.length, `boss volley: ${ro.length} roars, ${lv.length} crater bombs landed`);
  ok(ph.some((p) => p.spit) && ph.some((p) => p.fire) && !ph[0].spit && !ph[0].fire, 'boss: both powers in its later phases only');
}
if (bad) { console.log(`\n${bad} FAILED`); process.exit(1); }
console.log('\nall ok');
