// Pip the penguin (sim/pip.js, level 16): node tools/test-pip.mjs   (exits 1 on a failure)
// No browser. A small vault (four rings, gaps, thorns and pads only where a test wants them) with Pip in channel 2 and
// one egg put where the test wants it. Checks each trick (roam, gap drop, shove, carry), each counter (a wall turned
// into him, a sponge pad, Frost, a stone egg), every power, hazard, chick and strike that reaches him, determinism (the
// same seed twice, and a snapshot resumed), and "never unwinnable": he never leaves the vault with an egg, never holds
// one for long, never cracks one himself, and the planner clears level 16 on Medium.
import { Sim, DT } from '../src/sim/sim.js';
import { PIP } from '../src/sim/pip.js';
import { animalsHit } from '../src/sim/boss.js';
import { LEVELS } from '../src/data/levels.js';
import { solve } from './planner.mjs';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const deg = (d) => (d * Math.PI) / 180;
const wdeg = (a) => { let d = (a * 180) / Math.PI; while (d > 180) d -= 360; while (d < -180) d += 360; return d; };

// rings: per ring index, extra fields ({gaps: [deg], thorns: [deg], pads: [deg]}); every ring is solid elsewhere
function level(R = {}, pen = {}) {
  const rings = [0, 1, 2, 3].map((i) => {
    const o = R[i] || {};
    return { mat: i ? 'ice' : undefined, gaps: (o.gaps || [90]).map((a) => ({ a })), thorns: (o.thorns || []).map((a) => ({ a, n: 3 })), pads: (o.pads || []).map((a) => ({ a, len: 1.2 })) };
  });
  return { id: 902, theme: 'frozen', name: 'Pip test', eggs: 3, target: 1, spacing: 1.05, material: 'stone', nest: { w: 2.8 }, seed: 1616, world: 3, time: 300,
    penguin: { ch: 2, a: -150, delay: 0.2, ...pen }, rings };
}
function putEgg(sim, ch, a, e = sim.eggs[0]) {
  const r = sim.rings[ch].r - 0.08 - 0.3;
  e.body.setTransform({ x: r * Math.cos(deg(a)), y: r * Math.sin(deg(a)) }, 0);
  e.body.setLinearVelocity({ x: 0, y: 0 }); e.body.setAngularVelocity(0); e.body.setAwake(true);
  e.ch = sim.channelOf(e);
  return e;
}
const eggA = (e) => { const p = e.body.getPosition(); return wdeg(Math.atan2(p.y, p.x)); };
// run s seconds with every ring held still (turn: {ring, by (deg), at (s), over (s)}); returns the events seen
function run(sim, s, turn = null, each = null) {
  const ev = [], t0 = sim.t;
  let goal = null;
  for (let i = 0; i < s / DT && (sim.state === 'play'); i++) {
    for (const r of sim.rings) if (!r.motor) r.target = r.body.getAngle();
    if (turn && sim.t - t0 >= turn.at) {
      const R = sim.rings[turn.ring];
      if (goal == null) goal = R.body.getAngle() + deg(turn.by);
      R.target = R.body.getAngle() + Math.max(-0.6, Math.min(0.6, goal - R.body.getAngle()));
    }
    sim.step();
    for (const e of sim.events) ev.push({ ...e, t: sim.t });
    sim.events.length = 0;
    if (each) each(sim);
  }
  return ev;
}
const has = (ev, type, f = () => true) => ev.some((e) => e.type === type && f(e));
const first = (ev, type) => ev.find((e) => e.type === type);
function fresh(R, pen, mode = 'medium', egg = null) {
  const sim = new Sim(level(R, pen), { mode });
  if (egg) putEgg(sim, ...egg);
  return sim;
}

// ---------------------------------------------------------------- ROAM
{
  const sim = fresh({}, {});
  const P = sim.pips[0];
  let signs = new Set(), slideT = 0, standT = 0, chs = new Set();
  const ev = run(sim, 16, null, (s) => { if (P.ph === 'slide') { slideT += DT; if (Math.abs(P.v) > 0.2) signs.add(Math.sign(P.v)); } else if (P.ph !== 'wait' && P.ph !== 'in') standT += DT; chs.add(P.ch); });
  const w = first(ev, 'pipWarn'), s0 = first(ev, 'pipSlide');
  ok(w && s0 && Math.abs(s0.t - w.t - PIP.warn.medium) < 0.05, `roam: a wind-up telegraph of ${PIP.warn.medium} s before the slide (warn ${w && w.t.toFixed(2)}, slide ${s0 && s0.t.toFixed(2)})`);
  ok(signs.size === 2, 'roam: on the ice he swings both ways through the channel (a pendulum)');
  ok(slideT > 12 && standT < 3, `roam: he does not stop by himself (sliding ${slideT.toFixed(1)} s of 16, standing ${standT.toFixed(1)} s)`);
  ok(chs.size === 1 && chs.has(2), 'roam: no gap in his way: he stays in his channel');
}
// a gap turned under him: wheee, into the next channel out; from the outermost channel out of the vault and back home
{
  const sim = fresh({ 2: { gaps: [-90] } }, { a: -130 });
  const ev = run(sim, 8);
  const f = first(ev, 'pipFall'), l = first(ev, 'pipLand');
  ok(f && l && sim.pips[0].ch === 3, `gap: he drops through a gap under his slide and lands in channel 3 (fall ${f && f.t.toFixed(2)}, land ${l && l.t.toFixed(2)})`);
  const sim2 = fresh({ 3: { gaps: [-90] } }, { a: -130, ch: 3 });
  const P = sim2.pips[0];
  const ev2 = run(sim2, 4);
  ok(has(ev2, 'pipFall', (e) => e.out === 1) && (P.ph === 'away' || P.ph === 'out'), 'gap: from the outermost channel he drops out of the vault');
  const ev3 = run(sim2, PIP.away.medium + 2.5);
  ok(has(ev3, 'pipIn') && P.ch === 3, `gap: ${PIP.away.medium} s later he pops back in at home`);
}

// ---------------------------------------------------------------- SHOVE
{
  const sim = fresh({ 2: { gaps: [150] } }, { a: -150, delay: 1.2 }, 'medium', [2, -84]);
  const e = sim.eggs[0], P = sim.pips[0], a0 = eggA(e);
  const ev = run(sim, 5.5);
  ok(has(ev, 'pipShove'), 'shove: he winds up at a resting egg in his channel and shoves it ahead of him');
  ok(Math.abs(eggA(e) - a0) > 20 && e.alive && e.cracks === 0, `shove: it travels with him, unharmed (${a0.toFixed(0)} -> ${eggA(e).toFixed(0)} deg)`);
  void P;
  // lined up: a gap in front of the shove drops the egg through, uncracked; the egg is left alone a beat so it can fall
  const sim2 = fresh({ 2: { gaps: [-42, 150] } }, { a: -150, delay: 1.2 }, 'medium', [2, -84]);
  const e2 = sim2.eggs[0];
  const ev2 = run(sim2, 7);
  ok(has(ev2, 'pipShoveIn') && sim2.channelOf(e2) >= 3 && e2.cracks === 0, `shove: through a lined-up gap the egg drops to the next channel out, whole (ch ${sim2.channelOf(e2)})`);
  ok(ev2.filter((x) => x.type === 'pipShoveIn').length === 1, 'shove: the egg he let fall through the gap is not caught again');
  // into a thorn wall: the egg meets the thorns (a thorn cracks it), he stops behind it
  const sim3 = fresh({ 2: { gaps: [150], thorns: [-55] } }, { a: -150, delay: 1.2 }, 'medium', [2, -84]);
  const e3 = sim3.eggs[0];
  const ev3 = run(sim3, 6);
  ok(has(ev3, 'pipShove') && (e3.cracks > 0 || !e3.alive) && has(ev3, 'pipBump'), 'shove: shoved into thorns the egg is hurt by the thorns, and he bumps');
}

// ---------------------------------------------------------------- CARRY, and the wall counter
{
  const sim = fresh({ 2: { gaps: [100, 150], thorns: [5, 175] } }, { a: -104, delay: 1.6 }, 'medium', [2, -91]);
  const e = sim.eggs[0], P = sim.pips[0];
  const ev = run(sim, 4.3);
  ok(has(ev, 'pipTuck') && has(ev, 'pipGrab') && P.eid === e.id, 'carry: an egg resting beside him is tucked under his flipper');
  const a0 = eggA(e);
  // he winds up to carry it off: turn the thorn cluster on the side he faces into his path
  const ev2 = run(sim, 3, { ring: 2, by: P.face > 0 ? -62 : 62, at: 0 });
  ok(has(ev2, 'pipBump', (x) => x.why === 'thorn'), 'carry: a thorn wall turned into his slide: he bumps');
  ok(P.eid === 0 && e.alive && e.cracks === 0, `carry: the bump makes him drop the egg, unharmed (eid ${P.eid}, cracks ${e.cracks}, ${ev2.filter((x) => x.type.startsWith('pip') || x.type === 'crack').map((x) => x.type + ':' + (x.why || '') + '@' + x.t.toFixed(2)).join(' ')})`);
  ok(Math.abs(eggA(e) - a0) > 5, 'carry: he carried it off along the channel first');
  ok(P.ph === 'dizzy' && P.t > PIP.dizzy.medium - 2, `carry: then he is dizzy for ${PIP.dizzy.medium} s`);
  const ev3 = run(sim, PIP.dizzy.medium + PIP.sulk - 3);
  ok(!has(ev3, 'pipGrab'), 'carry: after a bump he leaves eggs alone for a while (dizzy + sulk)');
}
// never out of the vault with an egg: carrying in the outermost channel over a gap, the egg is set down inside
{
  const sim = fresh({ 3: { gaps: [-50] } }, { a: -99, delay: 1.6, ch: 3 }, 'medium', [3, -90]);
  const e = sim.eggs[0], P = sim.pips[0];
  for (let i = 0; i < 6 / DT && !P.eid; i++) run(sim, DT);
  ok(P.eid === e.id, `out: (he holds an egg in the outermost channel: ${P.ph} ${wdeg(P.a).toFixed(0)} egg ${eggA(e).toFixed(0)} ch ${sim.channelOf(e)})`);
  const ev = run(sim, 2.5, { ring: 3, by: wdeg(P.a - sim.rings[3].body.getAngle()) + 50, at: 0 }); // the gap (at -50) comes under him while he winds up
  ok(has(ev, 'pipFall', (x) => x.out === 1), `out: a gap turned under him: he drops out of the vault (${ev.filter((x) => x.type.startsWith('pip')).map((x) => x.type + '@' + x.t.toFixed(2)).join(' ')} ${P.ph} ${wdeg(P.a).toFixed(0)})`);
  const f = first(ev, 'pipFall');
  ok(f && has(ev, 'pipDrop', (x) => x.why === 'stop' && x.t === f.t) && P.eid === 0 && e.alive && e.cracks === 0, 'out: as he drops he sets the egg down on the floor first, whole (he never takes it with him)');
}
// a stone egg is too heavy to carry
{
  const sim = fresh({ 2: { gaps: [100, 170] } }, { a: -104, delay: 1.6 }, 'medium', [2, -91]);
  sim.setStone(sim.eggs[0], true); sim.eggs[0].stone = 99;
  const ev = run(sim, 4);
  ok(!has(ev, 'pipGrab') && sim.pips[0].eid === 0, 'stone: a stone egg is never tucked away');
}

// ---------------------------------------------------------------- the sponge pad
{
  const sim = fresh({ 2: { gaps: [160], pads: [-70] } }, { a: -150, delay: 0.2 });
  const ev = run(sim, 6);
  const b = first(ev, 'pipBoing');
  ok(!!b && has(ev, 'pipSlide'), `pad: a sponge pad in his slide stops him: boing (${b && b.t.toFixed(2)} s)`);
  ok(ev.findIndex((x) => x.type === 'pipBoing') > ev.findIndex((x) => x.type === 'pipSlide'), 'pad: the boing comes after a real slide, not on the push-off');
}

// ---------------------------------------------------------------- powers, hazards, chicks, strikes
function standing(egg = true) {
  const sim = fresh({ 2: { gaps: [100, 170] } }, { a: -104, delay: 1.6 }, 'medium', egg ? [2, -91] : null);
  run(sim, 4.3);
  return sim;
}
{
  const S = (f) => { const sim = standing(); const P = sim.pips[0]; const had = P.eid; const n = sim.events.length; f(sim, P); const ev = sim.events.slice(n); sim.events.length = 0; return { sim, P, had, ev }; };
  let r = S((sim) => sim.p2All('ice', 4));
  ok(r.had && r.P.ph === 'wave' && r.P.eid === 0, 'Frost (ice power): he loves it: a wave, and he lets go of the egg');
  r = S((sim) => sim.p2All('bolt', 3));
  ok(r.P.ph === 'bump' && r.P.eid === 0 && (run(r.sim, 1), r.P.ph === 'dizzy'), 'Thunderclap: knocked flat, then dizzy, egg dropped');
  r = S((sim) => sim.p2All('pepper', 5));
  ok(r.P.ph === 'sneeze' && r.P.flee > 4 && r.P.eid === 0, 'Pepper: ah-CHOO, he drops it and leaves eggs alone while it lasts');
  r = S((sim) => sim.p2All('spin', 1.5));
  ok(r.P.ch === 3 && r.P.eid === 0, 'Spin: thrown to the outermost channel, dizzy');
  r = S((sim) => sim.p2All('out', 8));
  ok((r.P.ph === 'out' || r.P.ph === 'away') && r.P.eid === 0, 'Shatter (a blast): out of the vault for a while');
  r = S((sim) => sim.p2All('scare', 2.5));
  ok(r.P.ph === 'out' && r.P.eid === 0, 'Scarecrow / scare: he hops out of the vault and stays away');
  r = S((sim, P) => { const b = sim.pipBody(P); sim.pipHit('flash', { x: b.x, y: b.y, r: 1 }); });
  ok(r.P.ph === 'bump' && r.P.dizT === 2.2, 'Glow chick flash: dazed 2.2 s');
  r = S((sim, P) => { const b = sim.pipBody(P); sim.pipHit('dash', { x: b.x, y: b.y, r: 0.3 }); });
  ok(r.P.ph === 'bump' && r.P.eid === 0, 'Dash chick: bonked dizzy, egg dropped');
  r = S((sim, P) => { const b = sim.pipBody(P); animalsHit(sim, 'rock', { x: b.x, y: b.y, r: 0.5 }); });
  ok(r.P.ph === 'bump', 'a lava rock or boulder: dazed');
  r = S((sim) => { animalsHit(sim, 'quake', {}); });
  ok(r.P.ph === 'slide', 'a quake: knocked onto his belly into a slide');
  r = S((sim) => { sim.p2.shock = 5; sim.p2.shockR = 2; sim.p2ShockCreatures(); });
  ok(r.P.ph === 'bump' && r.P.eid === 0, 'Live ring (shock) under him: zapped once');
  r = S((sim) => { sim.p2.shock = 5; sim.p2.shockR = 2; sim.p2ShockCreatures(); run(sim, 1.2); sim.p2ShockCreatures(); });
  ok(r.P.ph === 'dizzy', 'Live ring: then a breather (not zapped every step)');
  r = S((sim, P) => { sim.p2LaserFoes((x, y, rr) => { const b = sim.pipBody(P); return Math.hypot(x - b.x, y - b.y) < rr + 0.1; }); });
  ok(r.P.ph === 'bump', 'Laser beam across him: dazed');
  r = S((sim) => { const T = sim.stkTargets().find((x) => x.type === 'pip'); sim.stkApply(T, 'ice', 4, 'test'); });
  ok(r.P.ph === 'wave' && r.P.eid === 0, 'Strike (ice chick): picked as a target; a wave, the egg dropped');
  r = S((sim) => { const T = sim.stkTargets().find((x) => x.type === 'pip'); sim.stkApply(T, 'bolt', 3, 'glue'); });
  ok(r.P.ph === 'bump', 'Strike (bolt / glue / tock): dazed');
  r = S((sim) => { const T = sim.stkTargets().find((x) => x.type === 'pip'); sim.stkApply(T, 'out', 4, 'test'); });
  ok(r.P.ph === 'out', 'Strike (bomb / tornado): out of the vault');
  { const sim = standing(false); putEgg(sim, 2, -91); sim.p2.decoy = { t: 5 }; const P = sim.pips[0]; sim.pipThink(P); ok(sim.pipDecoy() && P.ph === 'windup' && !P.tgt, 'Decoy: while it is out he ignores eggs (no tuck, he just slides)'); }
  // the frost orb freezes his floor ring: he waves
  {
    const sim = fresh({ 2: { gaps: [100, 170] } }, { a: -104, delay: 1.6 });
    run(sim, 2.5); // he has just popped in and looks round
    sim.bx.rl[2].frost = 3;
    const ev = run(sim, 0.1);
    ok(has(ev, 'pipHit', (x) => x.kind === 'ice') && sim.pips[0].ph === 'wave', 'Frost orb: his floor freezes, he waves (no other effect)');
  }
  // the gust shoves him along while he slides
  {
    const sim = fresh({}, { a: -150, delay: 0.2 });
    run(sim, 2.5);
    const P = sim.pips[0], v = P.v;
    animalsHit(sim, 'gust', { dir: 1 });
    ok(P.ph === 'slide' && P.v > v, 'a gust: a shove along his channel');
  }
}

// ---------------------------------------------------------------- determinism
{
  const go = () => { const sim = fresh({ 2: { gaps: [-42, 150] } }, { a: -150, delay: 1.2 }, 'medium', [2, -84]); run(sim, 9, { ring: 2, by: 40, at: 4 }); return JSON.stringify(sim.pipState()) + eggA(sim.eggs[0]).toFixed(4); };
  ok(go() === go(), 'determinism: the same vault and moves twice end exactly alike');
  const L = level({ 2: { gaps: [150] } }, { a: -150, delay: 1.2 });
  const a = new Sim(L, { mode: 'medium' }); putEgg(a, 2, -84);
  run(a, 3.9);
  const S = a.fullState(), b = Sim.fromState(L, S);
  ok(a.pips[0].ph === 'slide' && b.pips[0].ph === 'slide' && b.pips[0].train.length === a.pips[0].train.length, 'determinism: a snapshot mid-shove restores his slide and the eggs he pushes');
  run(a, 2); run(b, 2);
  ok(JSON.stringify(a.pipState()) === JSON.stringify(b.pipState()), 'determinism: the snapshot resumes exactly (his state)');
}

// ---------------------------------------------------------------- never unwinnable (level 16 itself)
{
  const L = LEVELS.find((l) => l.id === 16);
  ok(L && L.penguin && L.name === "Pip's Rink", 'level 16 is Pip\'s Rink with Pip in it');
  // a clumsy player: turns rings at random (seeded) for 100 s. Pip never holds an egg more than 12 s at a stretch, never
  // holds one while out of the vault, and never cracks one himself (the only harm is a thorn an egg is shoved into)
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const mode of ['easy', 'medium', 'hard']) {
    const sim = new Sim(L, { mode });
    const held = {};
    let worst = 0, outHeld = 0, selfCrack = 0, n = 0;
    for (let k = 0; k < 50 && sim.state === 'play'; k++) {
      const ring = Math.floor(rnd() * sim.rings.length), by = (rnd() - 0.5) * 240;
      const ev = run(sim, 2, { ring, by, at: 0 }, (s) => {
        for (const P of s.pips) {
          const ids = [P.eid, ...P.train].filter(Boolean);
          for (const id of ids) { held[id] = (held[id] || 0) + DT; worst = Math.max(worst, held[id]); }
          for (const id in held) if (!ids.includes(+id)) delete held[id];
          if (ids.length && (P.ph === 'away' || P.ph === 'out')) outHeld++;
        }
      });
      for (const e of ev) if (e.type === 'crack' && e.why !== 'spike' && e.why !== 'thorn' && sim.pips.some((P) => P.eid === e.egg.id)) selfCrack++;
      n += ev.filter((x) => x.type.startsWith('pip')).length;
    }
    ok((n >= 3 || sim.state !== 'play') && worst < 12 && outHeld === 0 && selfCrack === 0, `${mode}: a random player, 100 s: Pip acted (${n} events), longest hold ${worst.toFixed(1)} s, never out with an egg, never cracked one himself`);
  }
  const r = solve(L, { mode: 'medium' });
  ok(r.state === 'won' && r.saved >= r.target, `the planner clears level 16 on Medium (${r.state}, ${r.saved}/${r.total}, ${r.t} s)`);
}

console.log(bad ? `\n${bad} FAILED` : '\nall ok');
process.exit(bad ? 1 : 0);
