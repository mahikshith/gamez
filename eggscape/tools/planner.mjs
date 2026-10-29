// Lookahead planner: a strong (not human) player. If it can't clear a level, the level is suspect.
// Usage: node tools/planner.mjs [ids] [--depth2]
import { Sim, DT } from '../src/sim/sim.js';
import { LEVELS } from '../src/data/levels.js';

const DEG = Math.PI / 180;
const DELTAS = [35, 75, 120, 180, 240].flatMap((d) => [d * DEG, -d * DEG]);

// Execute one action on a sim: turn ring i by delta at full speed, then let things settle.
export function act(sim, a, maxSettle = 2.5) {
  const ring = a.ring >= 0 ? sim.rings[a.ring] : null;
  const goal = ring ? ring.body.getAngle() + a.delta : 0;
  let t = 0;
  const cap = ring ? Math.abs(a.delta) / sim.maxOmega(ring) + 1.5 : a.wait;
  while (t < cap && sim.state === 'play') {
    for (const r of sim.rings) if (!r.motor) r.target = r.body.getAngle();
    if (ring) ring.target = ring.body.getAngle() + Math.max(-0.6, Math.min(0.6, goal - ring.body.getAngle()));
    sim.step();
    sim.events.length = 0;
    t += DT;
    if (ring && Math.abs(goal - ring.body.getAngle()) < 0.01) break;
  }
  // settle
  let s = 0;
  while (s < maxSettle && sim.state === 'play') {
    for (const r of sim.rings) if (!r.motor) r.target = r.body.getAngle();
    sim.step();
    sim.events.length = 0;
    s += DT;
    if (s > 0.4 && sim.aliveEggs().every((e) => e.body.getLinearVelocity().length() < 0.25)) break;
  }
  while ((sim.state === 'winning' || sim.state === 'failing')) { sim.step(); sim.events.length = 0; }
}

export function value(sim) {
  const st = sim.stats();
  if (sim.state === 'failed') return -1e6 + st.saved * 1000;
  let v = st.saved * 1500 - st.broken * 2500 + st.score * 0.2;
  for (const e of sim.aliveEggs()) {
    const c = sim.channelOf(e);
    v += c * 300 - e.cracks * 200 + e.mult * 15;
    // shaping: how far the floor ring's nearest gap is from the egg, so "bring a gap round" scores
    const ring = sim.rings[c];
    if (ring && ring.gaps.length) {
      const p = e.body.getPosition();
      const local = Math.atan2(p.y, p.x) - ring.body.getAngle();
      let d = Math.PI;
      for (const g of ring.gaps) d = Math.min(d, Math.abs(Math.atan2(Math.sin(local - g.a), Math.cos(local - g.a))));
      v -= d * 60;
    }
  }
  if (sim.state === 'won') v += 20000 + sim.timeLeft * 20;
  v += sim.timeLeft * 2;
  return v;
}

function actions(sim) {
  const out = [{ ring: -1, wait: 0.4 }, { ring: -1, wait: 1.2 }];
  const floors = new Set();
  for (const e of sim.aliveEggs()) {
    const c = sim.channelOf(e);
    if (c < sim.rings.length) floors.add(c);
    if (c + 1 < sim.rings.length) floors.add(c + 1);
    if (c - 1 >= 0) floors.add(c - 1);
  }
  for (const i of floors) if (sim.rings[i].grabbable) for (const d of DELTAS) out.push({ ring: i, delta: d });
  return out;
}

export function solve(level, opts = {}) {
  let sim = new Sim(level);
  const plan = [];
  let guard = 0;
  while (sim.state === 'play' && guard++ < 60) {
    const S = sim.fullState();
    const scored = [];
    for (const a of actions(sim)) {
      const c = Sim.fromState(level, S);
      act(c, a);
      scored.push({ a, v: value(c), c, S2: c.state === 'play' ? c.fullState() : null });
    }
    scored.sort((x, y) => y.v - x.v);
    if (opts.depth2) {
      for (const s of scored.slice(0, 4)) {
        if (!s.S2) continue;
        let best = -Infinity;
        const c0 = Sim.fromState(level, s.S2);
        for (const a2 of actions(c0)) {
          const c = Sim.fromState(level, s.S2);
          act(c, a2);
          best = Math.max(best, value(c));
        }
        s.v2 = Math.max(s.v, best);
      }
      scored.sort((x, y) => (y.v2 ?? y.v) - (x.v2 ?? x.v));
    }
    const pick = scored[0];
    plan.push(pick.a);
    // A restored sim drifts from the original (contact caches are not part of the state), so
    // replaying the move can end differently from what was scored. Continue from the scored
    // outcome itself: the plan is then exactly what was evaluated.
    if (opts.replay) act(sim, pick.a);
    else sim = pick.c;
  }
  const st = sim.stats();
  return { id: level.id, state: sim.state, t: +sim.t.toFixed(1), left: +sim.timeLeft.toFixed(1), moves: plan.length, ...st };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ids = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2].split(',').map(Number) : LEVELS.map((l) => l.id);
  const depth2 = process.argv.includes('--depth2');
  for (const id of ids) {
    const L = LEVELS.find((l) => l.id === id);
    const t0 = Date.now();
    const r = solve(L, { depth2 });
    const stars = r.saved >= r.target ? (r.broken === 0 ? (r.perfect ? 3 : 2) : 1) : 0;
    console.log(`L${String(id).padStart(2)} ${r.state.padEnd(7)} stars=${stars} t=${String(r.t).padStart(5)} left=${String(r.left).padStart(5)} saved=${r.saved}/${r.total} broken=${r.broken} moves=${r.moves} score=${r.score} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
}
