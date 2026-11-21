// The hen runs the basket under a falling egg (nest.reach, src/sim/henreach.js): node tools/test-catch.mjs
// No browser. Checks: reach 0 / unset is the old fixed basket; a near drop is caught (lunge + catch events), a far one is
// not; eggs already in the basket ride a hard lunge without spilling or cracking; the basket walks home; the same
// inputs give the same run twice; a snapshot taken mid-lunge resumes exactly; the hint search still finds moves.
import { Sim, DT } from '../src/sim/sim.js';
import { LEVELS } from '../src/data/levels.js';
import { CATCH_LEVELS } from './fixtures/catch-levels.mjs'; // the drop tests use frozen vaults, section 1 uses the live levels
import { hintSearch } from '../src/sim/search.js';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const lvl = (id, reach, src = CATCH_LEVELS) => { const L = { ...(src.find((l) => l.id === id) || LEVELS.find((l) => l.id === id)) }; L.nest = { ...(L.nest || {}) }; if (reach == null) delete L.nest.reach; else L.nest.reach = reach; return L; };
// for the drop tests: the same level with the outer ring's gaps always open and its thorns gone, so the egg we put in a
// gap falls straight out (the test is about the basket, not the vault)
const plain = (id, reach) => { const L = lvl(id, reach), n = L.rings.length - 1; L.rings = L.rings.map((r, i) => (i < n ? r : { ...r, thorns: [], gaps: r.gaps.map(({ shut, curtain, ...g }) => g) })); return L; };

// turn the outer ring so a plain gap sits d m beside the home basket's rim (side +1 right, -1 left) and put an egg in it
function drop(sim, d, side = 1, v = null) {
  const ring = sim.rings[sim.rings.length - 1];
  const g = ring.gaps.filter((q) => !q.curtain && !q.grate && !q.shut).sort((a, b) => b.len - a.len)[0] || ring.gaps[0]; // the widest plain gap
  const x = sim.nestX0 + side * (sim.nestW / 2 + d), th = -Math.PI / 2 + Math.asin(Math.max(-1, Math.min(1, x / ring.r)));
  ring.body.setTransform(ring.body.getPosition(), th - g.a); ring.target = th - g.a;
  const r = ring.r - 0.28, egg = sim.addEgg(r * Math.cos(th), r * Math.sin(th));
  if (v) egg.body.setLinearVelocity(v);
  egg.ch = sim.channelOf(egg); // it was put there: no fall through the rings above
  return egg;
}
const park = (sim, keep = []) => { for (const e of sim.eggs) if (!keep.includes(e) && e.alive && !e.saved) e.body.setActive(false); };
function run(sim, secs, until = () => false) {
  const evs = [];
  for (let i = 0; i < secs / DT && !until(); i++) { sim.step(); for (const e of sim.events) evs.push(e); sim.events.length = 0; }
  return evs;
}
const has = (evs, type, egg) => evs.some((e) => e.type === type && (!egg || e.egg === egg));
function single(id, reach, d, side = 1, mode = 'medium', v = null) {
  const sim = new Sim(plain(id, reach), { mode });
  park(sim);
  const egg = drop(sim, d, side, v);
  const evs = run(sim, 4, () => !egg.alive || egg.saved);
  evs.push(...run(sim, 3.5));
  return { sim, egg, evs };
}

if (process.env.DBG) { const [id, d, side, mode] = process.env.DBG.split(','); const sim = new Sim(plain(+id, 1.0), { mode }); park(sim); const egg = drop(sim, +d, +side);
  for (let i = 0; i < 3 / DT && egg.alive && !egg.saved; i++) { sim.step(); const ev = sim.events.map((e) => e.type).join(' '); sim.events.length = 0; if (i % 6 === 0 || ev) { const p = egg.body.getPosition(), v = egg.body.getLinearVelocity(), L = sim.reachLand(egg); console.log(sim.t.toFixed(2), p.x.toFixed(2), p.y.toFixed(2), v.x.toFixed(2), v.y.toFixed(2), 'ch' + sim.channelOf(egg), L ? L.x.toFixed(2) + '/' + L.tf.toFixed(2) : '-', sim.hr.mode, sim.hr.x.toFixed(2), sim.hr.v.toFixed(2), ev); } }
  console.log('nestW', sim.nestW, 'nestY', sim.nestY, egg.saved ? 'SAVED' : egg.alive ? 'alive' : 'BROKE'); process.exit(0); }

// 1. reach 0 / unset: the old basket. Random ring play on every level with the field stripped and with reach: 0 gives
//    the same run, the basket never moves (fixed-basket levels) and none of the new events fire.
{
  let same = true, still = true, quiet = true;
  for (const L0 of LEVELS) {
    const outs = [];
    for (const reach of [null, 0]) {
      const L = lvl(L0.id, reach, LEVELS), sim = new Sim(L, { mode: 'medium' });
      let r = L.id * 7919 + 3; const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      let ring = 0, until = 0, dir = 1, sig = '';
      for (let s = 0; s < 12 / DT && sim.state !== 'won' && sim.state !== 'failed'; s++) {
        if (sim.t >= until) { ring = Math.floor(rnd() * sim.rings.length); dir = rnd() < 0.5 ? -1 : 1; until = sim.t + 0.3 + rnd() * 1.2; }
        for (const rg of sim.rings) if (!rg.motor) rg.target = rg.body.getAngle();
        if (sim.rings[ring] && !sim.rings[ring].motor) sim.rings[ring].target = sim.rings[ring].body.getAngle() + 0.5 * dir;
        sim.step();
        for (const e of sim.events) { if (e.type === 'lunge' || e.type === 'catch' || e.type === 'catchMiss') quiet = false; sig += e.type[0]; }
        sim.events.length = 0;
        if (!sim.nestAmp && !L.wonder && Math.abs(sim.nest.getPosition().x - sim.nestX0) > 1e-9) still = false;
      }
      outs.push(sig + '|' + sim.state + '|' + sim.stats().saved + '|' + sim.aliveEggs().map((e) => e.body.getPosition().x.toFixed(6)).join());
      if (sim.reach) still = false;
    }
    if (outs[0] !== outs[1]) { same = false; console.log('  differs: L' + L0.id); }
  }
  ok(same, 'reach unset and reach 0 give the same run on every level');
  ok(still, 'reach 0: the basket never moves (and sim.reach stays 0)');
  ok(quiet, 'reach 0: no lunge / catch / catchMiss events');
  const a = new Sim({ ...lvl(1, 1), nest: { ...lvl(1, 1).nest, amp: 1, pattern: 'slide' } }, {});
  ok(!a.reach, 'a sliding basket (nest.amp) ignores reach');
}

// 2. near drops are caught, 3. far ones are not (Farm levels 1-3, reach 1.0, every mode, both sides)
{
  let near = 0, nearN = 0, far = 0, ev = true, fails = [];
  for (const id of [1, 2, 3]) for (const mode of ['easy', 'medium', 'hard']) for (const side of [1, -1]) {
    for (const d of [0.3, 0.6]) {
      const R = single(id, 1.0, d, side, mode); nearN++;
      if (R.egg.saved && R.egg.cracks === 0) near++; else fails.push(`L${id} ${mode} ${side} d=${d}`);
      if (R.egg.saved && !(has(R.evs, 'lunge') && has(R.evs, 'catch', R.egg) && has(R.evs, 'save', R.egg))) ev = false;
    }
    const F = single(id, 1.0, 2.2, side, mode);
    if (!F.egg.saved) far++; else fails.push(`far L${id} ${mode} ${side}`);
  }
  ok(near === nearN, `near drops (gap 0.3 / 0.6 m past the rim) caught clean: ${near}/${nearN}` + (fails.length ? ' ' + fails.join(', ') : ''));
  ok(ev, 'a catch comes with lunge, save and catch events');
  ok(far === 18, `far drops (gap 2.2 m past the rim) are not caught: ${far}/18`);
  const W = single(1, 0, 0.3), C = single(1, 1.0, 0.3);
  ok(!W.egg.saved && C.egg.saved, 'L1 gap 0.3 m past the rim: broken without the hen, saved with her');
}

// a miss she ran for: an egg flung out fast reaches the basket's rim before she does. catchMiss fires.
{
  let found = null;
  for (const vx of [2, 3, 4, 5]) for (const d of [0.4, 0.7, 1.0]) {
    if (found) break;
    const R = single(1, 1.0, d, 1, 'medium', { x: vx, y: -1 });
    if (!R.egg.saved && has(R.evs, 'lunge') && has(R.evs, 'catchMiss', R.egg)) found = `vx ${vx} d ${d}`;
  }
  ok(!!found, 'a fast egg she runs for and misses: catchMiss (' + found + ')');
}

// 4. eggs already in the basket ride a hard lunge: two eggs resting in it (held unsaved), then a drop she runs for
{
  let fine = true, lunged = 0;
  for (const side of [1, -1]) for (const mode of ['easy', 'medium', 'hard']) {
    const sim = new Sim(lvl(1, 1.0), { mode });
    park(sim);
    const n = sim.nest.getPosition(), ins = [-0.35, 0.35].map((x) => sim.addEgg(n.x + x, sim.nestY + 0.3));
    const save0 = sim.saveEgg; sim.saveEgg = function (e) { if (!ins.includes(e)) save0.call(this, e); }; // keep these two in the basket as bodies (normally saved after 0.15 s)
    run(sim, 0.6);
    const egg = drop(sim, 0.6, side);
    park(sim, [...ins, egg]);
    let maxV = 0;
    const evs = [];
    for (let i = 0; i < 3 / DT; i++) { sim.step(); evs.push(...sim.events); sim.events.length = 0; maxV = Math.max(maxV, Math.abs(sim.hr.v)); }
    if (has(evs, 'lunge')) lunged++;
    for (const e of ins) if (!e.alive || e.cracks || e.inNest <= 0) { fine = false; console.log(`  spilled/cracked: side ${side} ${mode} alive=${e.alive} cracks=${e.cracks} inNest=${e.inNest}`); }
    if (!egg.alive) { fine = false; console.log('  the third egg broke', side, mode); }
  }
  ok(lunged === 6, 'she lunges with two eggs in the basket');
  ok(fine, 'eggs in the basket stay in, uncracked, through the lunge and the stop');
}

// 5. home: after a catch she holds, then walks the basket back and stands still at home
{
  const R = single(1, 1.0, 0.6, -1);
  const sim = R.sim, H = sim.hr, x = sim.nest.getPosition().x;
  ok(R.egg.saved && H.mode === 'idle' && Math.abs(x - sim.nestX0) < 1e-6 && H.v === 0, `back home and still after a catch (x ${x.toFixed(4)}, ${H.mode})`);
  // the walk is unhurried
  const sim2 = new Sim(lvl(1, 1.0), {}); park(sim2); const e2 = drop(sim2, 0.6, 1);
  let walkMax = 0, held = 0;
  for (let i = 0; i < 6 / DT; i++) { sim2.step(); sim2.events.length = 0; if (sim2.hr.mode === 'home') walkMax = Math.max(walkMax, Math.abs(sim2.hr.v)); if (sim2.hr.mode === 'hold') held += DT; }
  ok(e2.saved && walkMax > 1 && walkMax <= 1.5 + 1e-9 && held >= 0.35, `holds ${held.toFixed(2)} s, walks home at ${walkMax.toFixed(2)} m/s`);
}

// two eggs at once: she goes for the one that lands first
{
  const sim = new Sim(lvl(1, 1.0), {}); park(sim);
  const a = drop(sim, 0.5, 1);
  const ring = sim.rings[sim.rings.length - 1], b = sim.addEgg(-1.2, -2.6); // a second egg dropping later on the other side, outside the vault
  b.body.setLinearVelocity({ x: -0.5, y: 2.5 });
  const evs = run(sim, 4);
  const first = evs.find((e) => e.type === 'lunge');
  ok(first && first.egg === a && a.saved, 'two eggs falling: she runs for the one that lands first and catches it');
  void ring; void b;
}

// 6. determinism, and a snapshot taken mid-lunge resumes exactly
{
  const go = () => { const R = single(2, 1.0, 0.6, 1, 'hard'); return R.evs.map((e) => e.type + e.t.toFixed(4)).join() + '|' + R.sim.nest.getPosition().x.toFixed(9) + '|' + R.egg.saved; };
  ok(go() === go(), 'same inputs, same run (twice)');
  const sim = new Sim(lvl(1, 1.0), {}); park(sim); drop(sim, 0.6, 1);
  let S = null;
  for (let i = 0; i < 3 / DT; i++) { sim.step(); sim.events.length = 0; if (!S && sim.hr.mode === 'run' && Math.abs(sim.hr.v) > 2) S = sim.fullState(); }
  const a = Sim.fromState(lvl(1, 1.0), S, {}), b = Sim.fromState(lvl(1, 1.0), S, {});
  const trace = (s) => { let o = ''; for (let i = 0; i < 2.5 / DT; i++) { s.step(); o += s.events.map((e) => e.type).join(''); s.events.length = 0; } return o + s.nest.getPosition().x.toFixed(9) + s.stats().saved; };
  const ta = trace(a), tb = trace(b);
  ok(!!S && ta === tb && /catch/.test(ta), 'a mid-lunge snapshot resumes the same run (and still catches)');
}

// 7. the hint search on a reach level still returns moves
{
  const L = lvl(1, 1.0), sim = new Sim(L, {});
  for (let i = 0; i < 1 / DT; i++) sim.step();
  const out = {}, gen = hintSearch(Sim, L, sim.fullState(), { mode: 'medium' }, out);
  let n = 0; while (!gen.next().done && n < 1e6) n++;
  ok(out.best && out.best.ring >= 0, 'hintSearch on a reach level returns a move: ' + JSON.stringify(out.best && { ring: out.best.ring, delta: out.best.delta }));
}

console.log(bad ? `${bad} FAILED` : 'all catch checks passed');
process.exit(bad ? 1 : 0);
