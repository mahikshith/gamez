// The lava salamander's 0.8.18 powers (sim/salamander.js SPIT, FIRE): node tools/test-lava.mjs   (exits 1 on a failure)
// No browser. The small vault of test-foes (five rings 1 m apart, gaps only where the test puts them) with one fire
// salamander in channel 2 and one egg at rest on the outer floor of channel 3.
// Ember spit: a line through a gap gets a telegraph, then an ember that lands as a pool by the egg and cracks it (Medium),
// hops it off with no crack (Easy), is doused by a water egg, burns thorns where it lands; a ring turned during the telegraph
// takes the ember on its wall (a splat, a miffed salamander); off unless the level asks. Fire-up: a red flame orb in its
// channel is gulped, it goes white-hot (faster, a double-length breath, thorns by its feet burn), water knocks it back to
// grey. A snapshot with an ember in flight, a pool and a white-hot salamander resumes exactly. The boss gets the powers
// from its phase flags.
import { Sim, DT } from '../src/sim/sim.js';
import { SAL, BRAIN, SPIT, SPIT_M, FIRE, FIRE_M } from '../src/sim/salamander.js';
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
const SPIT_ON = { spit: 1 };
const scene = (mode = 'medium', sal = SPIT_ON, gaps = { 2: [GAP2, GAP2 + 180] }, thorns) => {
  const sim = fresh(gaps, sal, mode, thorns);
  const egg = putEgg(sim, 3, EGG_A), C = putSal(sim, 2, SAL_A, 1);
  run(sim, 0.4, () => { C.ph = C.ph === 'walk' ? 'rest' : C.ph; C.t = 9; }); // let the egg settle while it waits
  C.ph = 'walk'; C.scd = 0;
  return { sim, egg, C };
};

// 1. a line through the gap: telegraph, ember, a pool by the egg, a crack (Medium)
{
  const { sim, egg, C } = scene();
  const evs = run(sim, 4);
  const w = has(evs, 'salSpitWarn') || null, s = has(evs, 'salSpit'), p = has(evs, 'salPool');
  ok(C.spit === 1 && s && p, `spit: an ember flew (${s ? s.at.toFixed(2) : '-'} s) and landed (${p ? p.at.toFixed(2) : '-'} s)`);
  ok(s && p && Math.abs(p.at - s.at - SPIT.fly) < 0.1, `spit: flight ${s && p ? (p.at - s.at).toFixed(2) : '-'} s (SPIT.fly ${SPIT.fly})`);
  const ep = egg.body.getPosition();
  ok(p && Math.hypot(p.x - ep.x, p.y - ep.y) < 0.6, `spit: the pool is by the egg (${p ? Math.hypot(p.x - ep.x, p.y - ep.y).toFixed(2) : '-'} m)`);
  ok(has(evs, 'salPoolBurn') && egg.cracks === 1, `spit: the egg on the pool got one crack (cracks ${egg.cracks})`);
  ok(evs.filter((e) => e.type === 'salPoolBurn').length === 1, 'spit: one crack per pool');
  const wt = evs.find((e) => e.type === 'salSpit');
  void w; void wt;
  // the telegraph took SPIT.warn x mode
  const st = [];
  const sim2 = scene().sim; run(sim2, 3, () => { const c = sim2.sals[0]; if (c.ph === 'spitWarn' && !st.length) st.push(c.dur); });
  ok(st.length && Math.abs(st[0] - SPIT.warn * SPIT_M.medium.warn) < 1e-6, `spit: telegraph ${st[0]} s on Medium`);
  // the pool burns SPIT.pool s, then crusts SPIT.crust s and is gone
  run(sim, SPIT.pool + SPIT.crust);
  ok(sim.salPools.length === 0, 'spit: the pool is gone after it burned and crusted');
}
// 2. the ring turned during the telegraph: the ember splats on its wall, the salamander is miffed, no pool
{
  const { sim, egg, C } = scene();
  let turned = false;
  const evs = run(sim, 4, () => {
    if (!turned && C.ph === 'spitWarn') { turned = true; const r = sim.rings[2], a = r.body.getAngle() + deg(30); r.body.setTransform({ x: 0, y: 0 }, a); r.target = a; }
  });
  ok(turned && has(evs, 'salSpitSplat') && !has(evs, 'salPool'), 'turned away: the ember splats on the wall, no pool');
  ok(C.miff > 0 || evs.some((e) => e.type === 'salSpitSplat' && e.id === C.id), 'turned away: the salamander is miffed');
  ok(egg.cracks === 0, 'turned away: the egg is whole');
}
// 3. Easy: a longer telegraph, the egg hops off the pool with no crack
{
  const { sim, egg, C } = scene('easy');
  let dur = 0;
  const evs = run(sim, 5, () => { if (C.ph === 'spitWarn' && !dur) dur = C.dur; });
  ok(Math.abs(dur - SPIT.warn * SPIT_M.easy.warn) < 1e-6 && dur > SPIT.warn, `easy: telegraph ${dur.toFixed(2)} s (longer)`);
  ok(has(evs, 'salPoolHop') && egg.cracks === 0 && !has(evs, 'salPoolBurn'), `easy: hop, no crack (cracks ${egg.cracks})`);
}
// 4. a water egg douses the pool
{
  const { sim, egg } = scene();
  egg.water = 30;
  const evs = run(sim, 4);
  ok(has(evs, 'salPoolDouse') && egg.cracks === 0, 'water: the water egg douses the pool, no crack');
}
// 5. the upside: thorns where it lands burn away
{
  const la = EGG_A + 6;
  const { sim, egg } = scene('medium', SPIT_ON, { 2: [GAP2, GAP2 + 180] }, { 3: [{ a: la, n: 1 }] });
  egg.water = 30; // (keep the egg out of it)
  const th = sim.rings[3].thorns.filter((t) => t.alive);
  const evs = run(sim, 4);
  ok(th.length && has(evs, 'salPool') && th.every((t) => !t.alive), `burn: the thorn by the landing spot burnt (${th.length} thorn)`);
}
// 6. off unless the level asks
{
  const { sim } = scene('medium', {});
  const evs = run(sim, 5);
  ok(!has(evs, 'salSpitWarn') && !has(evs, 'salSpit'), 'off: no spit without level.salamander.spit');
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
// 9. rewind: an ember in flight, a pool, a white-hot salamander resume exactly
{
  const { sim, C } = scene('medium', { spit: 1, fireup: 1 });
  let S1 = null, S2 = null;
  run(sim, 5, () => {
    if (!S1 && sim.salEmbers.length) { C.wh = 2.5; C.whD = 6; C.dbl = 1; S1 = sim.snapshot(); }
    if (!S2 && sim.salPools.length && sim.salPools[0].t < SPIT.pool) S2 = sim.snapshot();
  });
  for (const [name, S] of [['ember in flight', S1], ['pool', S2]]) {
    ok(!!S, `${name}: snapshot taken`);
    if (!S) continue;
    const a = Sim.fromState(sim.level, S), b = Sim.fromState(sim.level, S);
    for (let i = 0; i < 3 / DT; i++) { a.step(); b.step(); }
    const strip = (s) => JSON.stringify({ c: s.sals[0], e: s.salEmbers, p: s.salPools, k: s.eggs.map((e) => e.cracks) }, (k, v) => (typeof v === 'number' ? +v.toFixed(9) : v));
    ok(strip(a) === strip(b), `${name}: two restores run the same`);
    const c = Sim.fromState(sim.level, S);
    ok(JSON.stringify(c.salEmbers) === JSON.stringify(S.sal.em) && JSON.stringify(c.salPools) === JSON.stringify(S.sal.pools) && c.sals[0].wh === S.sal.sals[0].wh, `${name}: embers, pools and white-hot restored`);
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
    ok(sim.salPw(C, 'spit') === !!ph[i].spit && sim.salPw(C, 'fu') === !!ph[i].fire, `boss phase ${i + 1}: spit ${!!ph[i].spit}, fire-up ${!!ph[i].fire}`);
  }
  ok(ph.some((p) => p.spit) && ph.some((p) => p.fire) && !ph[0].spit && !ph[0].fire, 'boss: both powers in its later phases only');
}
if (bad) { console.log(`\n${bad} FAILED`); process.exit(1); }
console.log('\nall ok');
