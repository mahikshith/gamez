// 0.8.15 creature and power left-overs: node tools/test-cast.mjs   (exits 1 on a failure). No browser.
// The hermit crab's entrance keeps its timing; the spring jack telegraphs before it pops; the Pepper twister sneezes first and
// the sneeze throws; the Electromagnet says when it is on and off; Bait and switch works on bayou creatures; a snapshot taken
// in the middle of each restores and runs the same.
import { Sim, DT } from '../src/sim/sim.js';
import { LEVELS } from '../src/data/levels.js';
import { HERMIT } from '../src/sim/reef.js';
import { JACK } from '../src/sim/clockwork.js';
import { P2 } from '../src/sim/powers2.js';
import { POWER_DEMOS } from '../src/data/power-demos.js';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const lv = (id) => LEVELS.find((l) => l.id === id);
const hold = (sim) => { for (const r of sim.rings) if (!r.motor) r.target = r.body.getAngle(); };
// run T s; returns the events as [t, type, ev]
function run(sim, T, each) { const out = []; for (let i = 0; i < T / DT; i++) { hold(sim); if (each) each(sim); sim.step(); for (const e of sim.events) out.push([sim.t, e.type, e]); sim.events.length = 0; } return out; }
const at = (evs, type) => { const e = evs.find((x) => x[1] === type); return e ? e[0] : -1; };
const same = (level, sim, T, pick) => { const s = sim.snapshot(), a = Sim.fromState(level, s), b = Sim.fromState(level, s); run(a, T); run(b, T); const f = (x) => JSON.stringify(pick(x), (k, v) => (typeof v === 'number' ? +v.toFixed(9) : v)); return f(a) === f(b); };

{ // hermit crab (level 36: delay 1.5)
  const L = lv(43), sim = new Sim(L, { mode: 'medium' }), d = L.hermit.delay;
  const evs = run(sim, d + HERMIT.in + 0.2), roll = at(evs, 'hermitRoll'), inn = at(evs, 'hermitIn'), pop = at(evs, 'hermitPop');
  ok(Math.abs(roll - (d - HERMIT.roll)) < 0.02 && Math.abs(inn - d) < 0.02 && Math.abs(pop - (d + HERMIT.in - HERMIT.pop)) < 0.02, `hermit: rolls in at ${roll.toFixed(2)} s, lands at ${inn.toFixed(2)} s, pops out at ${pop.toFixed(2)} s`);
  ok(sim.hermitLive(sim.hermits[0]) && sim.hermits[0].ph !== 'in', `hermit: live ${(d + HERMIT.in).toFixed(2)} s in, as before (delay + in)`);
  const s2 = new Sim(L, { mode: 'medium' }); run(s2, d - 0.2);
  ok(same(L, s2, 1.5, (x) => x.hermits), 'hermit: a snapshot in the middle of the entrance runs the same');
}
{ // spring jack (level 48)
  const L = lv(57), sim = new Sim(L, { mode: 'medium' }); run(sim, 1);
  const J = sim.cw.jk[0], ring = sim.rings[J.fi], q = sim.cwFloor(J.fi, J.la + 1.7 / ring.r, 0.3), j = sim.cwFloor(J.fi, J.la, 0.3), e = sim.eggs[0], d = Math.hypot(j.x - q.x, j.y - q.y);
  e.body.setTransform({ x: q.x, y: q.y }, 0);
  const evs = run(sim, 4, () => { if (J.ph === 'ready') { const p = e.body.getPosition(), dd = Math.hypot(j.x - p.x, j.y - p.y) || 1; e.body.setLinearVelocity({ x: ((j.x - p.x) / dd) * 1.3, y: ((j.y - p.y) / dd) * 1.3 }); } });
  const peek = at(evs, 'jackPeek'), pop = at(evs, 'jackPop');
  ok(peek > 0 && pop > peek + 0.5, `jack: it peeks ${(pop - peek).toFixed(2)} s before it pops (an egg from ${d.toFixed(1)} m at 1.3 m/s; it sees ${JACK.see} m)`);
}
{ // Pepper twister
  const L = { ...POWER_DEMOS.find((d) => d.kind === 'combo_twister') }, sim = new Sim(L, { mode: 'medium' }); run(sim, 12.5);
  const S = sim.snakes[0]; if (S.inside) sim.p2Fling(S, (sim.rings[1].r + sim.rings[2].r) / 2); sim.events.length = 0;
  const r0 = Math.hypot(S.pts[0].x, S.pts[0].y), e = sim.aliveEggs()[0];
  sim.p2Take(e, 'pepper'); run(sim, 0.2); sim.p2Take(e, 'spin');
  const pre = sim.events.filter((x) => x.type === 'p2Fling').length; sim.events.length = 0;
  run(sim, P2.twist.wind - 0.1);
  const rMid = Math.hypot(S.pts[0].x, S.pts[0].y);
  const evs = run(sim, 0.3), sn = at(evs, 'p2Sneeze'), fl = at(evs, 'p2Fling'), r1 = Math.hypot(S.pts[0].x, S.pts[0].y);
  ok(pre === 0 && rMid < r0 + 0.6, `twister: nobody is flung during the wind-up (the snake at ${r0.toFixed(1)} m is at ${rMid.toFixed(1)} m ${(P2.twist.wind - 0.1).toFixed(2)} s in)`);
  ok(sn > 0 && fl >= sn && r1 > sim.outerR, `twister: the sneeze comes first and throws it out (to ${r1.toFixed(1)} m, the rim is ${sim.outerR.toFixed(1)} m)`);
  const s2 = new Sim(L, { mode: 'medium' }); run(s2, 12.5); s2.p2Take(s2.aliveEggs()[0], 'pepper'); s2.p2Take(s2.aliveEggs()[0], 'spin'); run(s2, 0.3);
  ok(s2.p2.tw > 0 && same(L, s2, 2, (x) => [x.snakes.map((q) => [q.a, q.rad, q.stun, q.back]), x.p2.tw]), 'twister: a snapshot in the wind-up runs the same');
}
{ // Electromagnet (level 47)
  const L = lv(56), sim = new Sim(L, { mode: 'medium' }); run(sim, 2);
  const e = sim.aliveEggs()[0]; sim.p2Take(e, 'iron'); sim.p2Take(e, 'shock');
  const evs = run(sim, 8), on = at(evs, 'emagOn'), off = at(evs, 'emagOff'), hum = evs.filter((x) => x[1] === 'emagHum').length;
  ok(on > 0 && off > on + 5 && hum >= 8, `electromagnet: on at ${on.toFixed(2)} s, off at ${off.toFixed(2)} s, ${hum} hums between`);
}
{ // Bait and switch on a snapping turtle (level 43)
  const L = lv(51), sim = new Sim(L, { mode: 'medium' }); run(sim, 6);
  const e = sim.aliveEggs()[0], r = sim.rings[3].r - 0.3, a = (-55 * Math.PI) / 180, T = sim.turtles[0], a0 = T.a;
  e.body.setTransform({ x: r * Math.cos(a), y: r * Math.sin(a) }, 0); sim.p2Take(e, 'decoy'); sim.p2Take(e, 'warp'); e.body.setTransform({ x: 0, y: 0.2 }, 0);
  const evs = run(sim, 2.2), lure = at(evs, 'baitLure'), open = at(evs, 'warpOpen'), bait = at(evs, 'warpBait');
  ok(lure > 0 && open > lure && bait === open, `bait: the turtle goes for the decoy at ${lure.toFixed(2)} s and its snap is swallowed at ${open.toFixed(2)} s, the decoy with it`);
  ok(T.ph === 'warp' && same(L, sim, 3, (x) => [x.turtles, x.gators, x.p2.decoy]), 'bait: a snapshot inside the gate runs the same');
  const g = sim.p2.warp.gates.find((x) => x.k === 'in' && x.pull); e.body.setTransform({ x: g.x, y: g.y }, 0);
  const ev2 = run(sim, 0.3), p = e.body.getPosition();
  ok(at(ev2, 'warpEgg') > 0 && Number.isFinite(p.x + p.y) && Math.hypot(p.x - g.ex, p.y - g.ey) < 3, `bait: an egg that rolls into the gate comes out by its exit (${Math.hypot(p.x - g.ex, p.y - g.ey).toFixed(1)} m from it)`);
  run(sim, 1.2);
  ok(Math.abs(T.a - a0) > 0.5 && T.stn > 0 && T.ph === 'crawl', `bait: it comes out ${(Math.abs(T.a - a0) * sim.byFloor(T.ch)).toFixed(1)} m along its floor, dazed`);
}
process.exit(bad ? 1 : 0);
