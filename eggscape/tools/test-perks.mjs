// Egg skin powers (src/sim/perks.js, src/economy.js SKINS[id].perk): node tools/test-perks.mjs
// Each perk gets a small scripted situation: the effect with the skin on, no effect with Classic, and never more often
// than its rule says. Pure sim (no canvas), like tools/test-goals.mjs. A level literal is the scripted vault; where a
// villain has to touch or carry an egg the egg is put there by hand (a carried egg is out of the physics world, exactly
// as a thief's or the eagle's hold leaves it).
import { Sim, DT, REWIND_S } from '../src/sim/sim.js';
import { Vec2 } from 'planck';
import { LEVELS } from '../src/data/levels.js';
import * as E from '../src/economy.js';

let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const V = { id: -901, theme: 'barn', material: 'wood', eggs: 1, target: 1, time: 60, spacing: 1.1, nest: { w: 2.4 }, rings: [{ gaps: [{ a: 90 }] }, { gaps: [{ a: -90 }] }] };
const lvl = (o) => ({ ...V, ...o, rings: o.rings || V.rings });
// step for `secs`, collecting the events; fn(sim, i) runs after each step with that step's events still on sim.events
const run = (sim, secs, fn) => { const got = []; for (let i = 0; i < secs / DT; i++) { sim.step(); got.push(...sim.events); if (fn) fn(sim, i); sim.events.length = 0; } return got; };
const ids = (evs, type = 'perk') => evs.filter((e) => e.type === type).map((e) => e.id || e.why || 1);

// ---------------------------------------------------------------- every skin's power is declared, Classic has none
{
  const miss = E.SKIN_ORDER.filter((id) => id !== 'classic').filter((id) => { const p = E.skinPerk(id); return !(p && p.id === id && p.name && p.icon && p.line && p.line.split(' ').length <= 4); });
  ok(!miss.length, 'every skin but Classic has a power with a name, an icon and at most four words: ' + (miss.join() || 'all good'));
  ok(!E.skinPerk('classic'), 'Classic has no power');
}

// ---------------------------------------------------------------- speckled: the first crack of the level is shrugged off
{
  const two = (perk) => { const s = new Sim(lvl({}), { mode: 'medium', perk }); const e = s.eggs[0]; s.crack(e, 5, 'impact'); e.crackCD = 0; s.crack(e, 5, 'impact'); return [e.cracks, ids(s.events).length]; };
  const [sc, fired] = two('speckled'), [cc] = two(null);
  ok(cc === 2 && sc === 1, `Lucky Freckles: two cracks leave 1 crack (Classic 2): ${sc} vs ${cc}`);
  ok(fired === 1, 'Lucky Freckles fires once, not on the second crack');
}

// ---------------------------------------------------------------- striped: the crack threshold is 25% higher
{
  const a = new Sim(lvl({}), { mode: 'medium' }), b = new Sim(lvl({}), { mode: 'medium', perk: 'striped' });
  ok(Math.abs(b.crackV / a.crackV - 1.25) < 1e-9, `Bouncy: the crack speed is x1.25 (${a.crackV.toFixed(2)} -> ${b.crackV.toFixed(2)})`);
  // a landing just over the plain threshold: Classic cracks, Bouncy does not
  const drop = (perk) => {
    const s = new Sim(lvl({}), { mode: 'medium', perk }), e = s.eggs[0];
    for (let i = 0; i < 90; i++) s.step();
    e.safeT = 0; e.crackCD = 0; e.cracks = 0;
    e.body.setTransform(Vec2(0, 0.1), 0); e.body.setLinearVelocity(Vec2(0, -(a.crackV * 1.05))); // lands at ~1.22x the plain threshold
    return ids(run(s, 0.6, null), 'crack').length;
  };
  ok(drop(null) > 0 && drop('striped') === 0, `Bouncy: a landing that cracks a Classic egg (${drop(null)}) leaves the Striped one whole (${drop('striped')})`);
}

// ---------------------------------------------------------------- dino and lava: the first thorn
{
  const T = lvl({ rings: [{ gaps: [{ a: 90 }], thorns: [{ a: -90, n: 1 }] }] });
  const hit = (perk, opts = {}) => {
    const s = new Sim(T, { mode: 'medium', perk, ...opts }), e = s.eggs[0];
    e.safeT = 0; e.body.setTransform(Vec2(0, 0.45), 0); e.body.setLinearVelocity(Vec2(0, -6));
    const evs = run(s, 0.7, null);
    return { perk: ids(evs), alive: e.alive, cracks: e.cracks, thorns: s.rings[0].thorns.filter((t) => t.alive).length, broke: ids(evs, 'break').length, gold: ids(evs, 'goldenSave').length, used: s.pk ? s.pk.used : -1 };
  };
  const c = hit(null), d = hit('dino'), l = hit('lava');
  ok(c.broke === 1 && !c.alive, 'Classic: that thorn pops the egg');
  ok(d.alive && d.cracks === 1 && d.perk.join() === 'dino', `Thick Shell: the egg lives with one crack (cracks ${d.cracks})`);
  ok(l.alive && l.cracks === 0 && l.thorns === 0 && l.perk.join() === 'lava', 'Hot Shell: the thorn burns away, the egg is unharmed');
  // a booster acts first and leaves the power unspent (no double immunity)
  const st = hit('dino', { stone: true }), gl = hit('dino', { golden: true });
  ok(st.alive && st.thorns === 0 && st.used === 0, 'the Stone Shell booster smashes the thorn and Thick Shell stays unspent');
  ok(gl.alive && gl.gold > 0 && gl.used === 0, 'the golden shell saves the egg and Thick Shell stays unspent');
  // twice in a level: only the first thorn
  const twice = (perk) => {
    const s = new Sim(lvl({ rings: [{ gaps: [{ a: 90 }], thorns: [{ a: -90, n: 1 }, { a: -30, n: 1 }] }] }), { mode: 'medium', perk });
    let n = 0;
    for (let k = 0; k < 2; k++) {
      const e = s.eggs.find((q) => q.alive && !q.saved) || s.addEgg(0, 0.45, 0);
      e.safeT = 0; e.spk.clear(); e.body.setTransform(Vec2(0, 0.45), 0); e.body.setLinearVelocity(Vec2(0, -6));
      n += ids(run(s, 0.7, null)).length;
    }
    return n;
  };
  ok(twice('dino') === 1 && twice('lava') === 1, 'Thick Shell and Hot Shell fire once per level, whatever happens next');
}

// ---------------------------------------------------------------- candy: +5 s on the clock
{
  const a = new Sim(lvl({ time: 60 }), { mode: 'medium' }), b = new Sim(lvl({ time: 60 }), { mode: 'medium', perk: 'candy' });
  const c = new Sim(lvl({ time: 60 }), { mode: 'medium', perk: 'candy', time: true });
  ok(b.timeLimit - a.timeLimit === 5, `Sweet Seconds: +5 s (${a.timeLimit} -> ${b.timeLimit})`);
  ok(c.timeLimit - a.timeLimit === 20, `Sweet Seconds and the +15 s booster stack plainly: ${c.timeLimit}`);
  ok(new Sim(lvl({ time: 0 }), { mode: 'medium', perk: 'candy' }).timeLimit === 0, 'a level with no clock gets no seconds');
}

// ---------------------------------------------------------------- frosty and thunder: the first villain that reaches an egg
{
  const S = lvl({ snake: [{ delay: 0.2, speed: 1.2, a: 0 }] });
  const touch = (perk) => {
    const s = new Sim(S, { mode: 'medium', perk });
    let fired = null, look = null, n = 0;
    run(s, 12, (sim, i) => {
      const t = sim.stkTargets(), e = sim.eggs[0];
      if (t.length && e.alive && !e.saved) e.body.setTransform(Vec2(t[0].x, t[0].y), 0);
      for (const q of sim.events) if (q.type === 'perk') { n++; fired = q.id; look = { stun: sim.snakes[0].stun, hurt: sim.snakes[0].hurt, fx: (sim.p2.fx.s0 || {}).k }; }
      return null;
    });
    return { fired, look, n, used: s.pk ? s.pk.used : -1 };
  };
  const f = touch('frosty'), z = touch('thunder'), c = touch(null);
  ok(!c.fired, 'Classic: a snake that reaches the egg is not frozen or stunned');
  ok(f.fired === 'frosty' && f.look && f.look.fx === 'ice' && f.look.stun >= 3 - 1e-6 && f.look.hurt === 'ice', `Frost Touch: the snake is frozen 3 s in the real freeze look (${JSON.stringify(f.look)})`);
  ok(z.fired === 'thunder' && z.look && z.look.fx === 'zap' && z.look.stun >= 2.5 - 1e-6 && z.look.hurt === 'bolt', `Zap: the snake is stunned 2.5 s with the real zap look (${JSON.stringify(z.look)})`);
  ok(f.n === 1 && z.n === 1 && f.used === 1, 'Frost Touch and Zap fire once per level');
}

// ---------------------------------------------------------------- gator: a villain carrying an egg drops it after 1.5 s
{
  const S = lvl({ snake: [{ delay: 0.2, speed: 1.2, a: 0 }] });
  const carry = (perk) => {
    const s = new Sim(S, { mode: 'medium', perk });
    let t0 = -1, fired = null, at = 0, n = 0, back = 0;
    run(s, 14, (sim) => {
      const T = sim.stkTargets(), e = sim.eggs[0];
      if (T.length && e.alive) {
        if (t0 < 0) { t0 = sim.t; e.body.setActive(false); } // carried off: out of the physics world
        e.body.setTransform(Vec2(T[0].x, T[0].y), 0);
      }
      for (const q of sim.events) if (q.type === 'perk') { n++; fired = q.id; at = sim.t - t0; back = sim.snakes[0].back; }
      return null;
    });
    return { fired, at, n, back };
  };
  const g = carry('gator'), c = carry(null);
  ok(!c.fired, 'Classic: a carried egg is not dropped by itself');
  ok(g.fired === 'gator' && g.at >= 1.5 - 0.05 && g.at < 1.9, `Snap Back: the carrier lets go after 1.5 s (${g.at.toFixed(2)} s)`);
  ok(g.n === 1 && g.back > 0, 'Snap Back fires once per level and the villain backs off');
}

// ---------------------------------------------------------------- pearl: the first break from a hard landing is a crack
{
  const smash = (perk, why) => { const s = new Sim(lvl({}), { mode: 'medium', perk }), e = s.eggs[0]; s.breakEgg(e, why); return { alive: e.alive, cracks: e.cracks, fired: ids(s.events).join() }; };
  const p = smash('pearl', 'impact'), c = smash(null, 'impact'), th = smash('pearl', 'thorn');
  ok(!c.alive && p.alive && p.cracks === 2 && p.fired === 'pearl', `Pearl Shine: a smashing landing leaves it on its last crack (cracks ${p.cracks})`);
  ok(!th.alive, 'Pearl Shine is for hard landings and falls, not for a thorn');
  const s2 = new Sim(lvl({}), { mode: 'medium', perk: 'pearl' }), e2 = s2.eggs[0];
  s2.breakEgg(e2, 'fall'); s2.breakEgg(e2, 'impact');
  ok(!e2.alive, 'Pearl Shine fires once: the second break is real');
}

// ---------------------------------------------------------------- galaxy: orbs are taken from 40% farther away
{
  const L2 = LEVELS.find((l) => l.id === 2);
  const reach = (perk, d) => {
    const s = new Sim(L2, { mode: 'medium', perk });
    s.step();
    const o = s.orbs[0], e = s.eggs[0];
    let took = null, pf = null;
    run(s, 0.8, (sim) => {
      const q = o.alive ? o.body.getPosition() : null;
      if (q && e.alive) { e.body.setTransform(Vec2(q.x + d, q.y), 0); e.body.setLinearVelocity(Vec2(0, 0)); }
      for (const ev of sim.events) { if (ev.type === 'pickup') took = ev.power; if (ev.type === 'perk') pf = ev.id; }
      return null;
    });
    return { took, pf };
  };
  const far = reach('galaxy', 0.58), none = reach(null, 0.58), close = reach(null, 0.3);
  ok(close.took, 'Classic: an orb the egg touches is taken (0.30 m)');
  ok(!none.took, 'Classic: an orb 0.58 m away is not taken');
  ok(far.took && far.pf === 'galaxy', 'Star Pull: the same orb 0.58 m away flies in');
}

// ---------------------------------------------------------------- robot: 35% less slide on ice, 35% less current
{
  const ICE = lvl({ theme: 'frozen', material: 'ice' });
  const slide = (perk) => {
    const s = new Sim(ICE, { mode: 'medium', perk }), e = s.eggs[0];
    for (let i = 0; i < 120; i++) s.step();
    e.body.setTransform(Vec2(-0.3, -0.5), 0); e.body.setLinearVelocity(Vec2(2.2, 0));
    let d = 0, p = e.body.getPosition().x, spark = 0;
    for (let i = 0; i < 360; i++) { s.step(); const x = e.body.getPosition().x; d += Math.abs(x - p); p = x; spark += ids(s.events).length; s.events.length = 0; }
    return { d, spark };
  };
  const a = slide(null), b = slide('robot'), cut = 1 - b.d / a.d;
  ok(cut > 0.25 && cut < 0.45, `Grip: it slides ${(cut * 100).toFixed(0)}% less on ice (${a.d.toFixed(2)} m -> ${b.d.toFixed(2)} m)`);
  ok(b.spark > 0 && a.spark === 0, 'Grip: a servo sparkle while it brakes, and nothing for a Classic egg');
  const cur = (perk) => { const s = new Sim(lvl({ weather: 'current', weatherOpts: { strength: 1.4 } }), { mode: 'medium', perk }); return s.gripK(); };
  ok(Math.abs(cur('robot') - 0.65) < 1e-9 && cur(null) === 1, `Grip: a current pushes it ${(100 - cur('robot') * 100).toFixed(0)}% less`);
}

// ---------------------------------------------------------------- the coin powers' arithmetic (prices and offers untouched)
{
  ok(E.perkCoins('bauble', 30, 3) === 33 && E.perkCoins('bauble', 0, 3) === 0, 'Shiny: +10% on a win (30 -> 33), nothing on nothing');
  ok(E.perkCoins('golden', 30, 3) === 35 && E.perkCoins('golden', 20, 0) === 23, 'Midas: +15% on a win (30 -> 35, 20 -> 23)');
  ok(E.perkCoins('treasure', 30, 3) === 39 && E.perkCoins('treasure', 30, 0) === 30, 'Treasure Sense: +3 per egg home (3 home: 30 -> 39)');
  ok(E.perkCoins('classic', 30, 3) === 30 && E.perkCoins('frosty', 30, 3) === 30, 'a skin without a coin power pays the plain coins');
  const w = E.sanitizeWallet({ ...E.defaultWallet(), coins: 0 });
  ok(E.payWin(w, E.perkCoins('golden', 30, 3), false).coins === 35, 'the win pays the power coins through payWin');
  ok(E.SKINS.golden.price === 300 && E.SKINS.treasure.price === 220, 'no power changed a price');
}

// ---------------------------------------------------------------- a rewind keeps what the power has spent
{
  const s = new Sim(lvl({}), { mode: 'medium', perk: 'speckled' }), e = s.eggs[0];
  s.crack(e, 5, 'impact');
  const st = s.fullState();
  const back = Sim.fromState(lvl({}), st, { mode: 'medium', perk: 'speckled' });
  ok(back.pk && back.pk.used === 1, 'the rewind snapshot carries the used-up flag');
  const b2 = back.eggs[0];
  b2.crackCD = 0; back.crack(b2, 5, 'impact');
  ok(b2.cracks === 1, 'after a rewind the shrugged crack is not given again');
}

// ---------------------------------------------------------------- the fail card's Rewind goes back REWIND_S (12 s)
{
  const s = new Sim(lvl({ time: 90 }), { mode: 'medium' });
  run(s, 20);
  const n = s.snaps.length, span = n ? s.t - s.snaps[0].t : 0;
  ok(REWIND_S === 12 && n === 26 && span >= REWIND_S, `26 snapshots, one every 0.5 s, cover ${span.toFixed(1)} s (>= ${REWIND_S})`);
  const t0 = s.t, back = s.rewind(REWIND_S);
  ok(back && Math.abs(t0 - back.t - REWIND_S) <= 0.5 + 1e-6, `a rewind after 20 s lands ${back ? (t0 - back.t).toFixed(2) : '?'} s back`);
  const y = new Sim(lvl({ time: 90 }), { mode: 'medium' });
  run(y, 4);
  const by = y.rewind(REWIND_S);
  ok(by && by.t <= 0.5 + 1e-6, 'a run shorter than 12 s goes back to its first snapshot');
}

// ---------------------------------------------------------------- no perk: the sim is exactly as it was
{
  const a = new Sim(lvl({ snake: [{ delay: 0.5, speed: 1, a: 0 }] }), { mode: 'medium' });
  const b = new Sim(lvl({ snake: [{ delay: 0.5, speed: 1, a: 0 }] }), { mode: 'medium', perk: 'nonesuch' });
  for (let i = 0; i < 600; i++) { a.step(); b.step(); }
  const pos = (s) => s.eggs.map((e) => (e.body ? [e.body.getPosition().x.toFixed(6), e.body.getPosition().y.toFixed(6)] : 0)).join();
  ok(a.pk === null && b.pk === null && pos(a) === pos(b), 'an unknown or missing perk leaves the sim untouched');
}

console.log(bad ? `${bad} FAILED` : 'all egg power checks passed');
process.exit(bad ? 1 : 0);
