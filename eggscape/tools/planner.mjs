// Lookahead planner: a strong (not human) player. If it can't clear a level, the level is suspect.
// Usage: node tools/planner.mjs [ids] [--depth2]
import { Sim } from '../src/sim/sim.js';
import { LEVELS } from '../src/data/levels.js';
import { act, value, actions } from '../src/sim/search.js';

export { act, value };

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
