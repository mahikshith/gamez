// Lookahead planner: a strong (not human) player. If it can't clear a level, the level is suspect.
// Usage: node tools/planner.mjs [ids] [--depth2]
import { Sim, DT } from '../src/sim/sim.js';
import { LEVELS } from '../src/data/levels.js';
import { act, value, actions } from '../src/sim/search.js';

export { act, value };

// opts.mode: 'easy' | 'medium' | 'hard' (default medium)
export function solve(level, opts = {}) {
  let sim = new Sim(level, { mode: opts.mode });
  const plan = [];
  let guard = 0;
  let lastMove = 0;
  while (sim.state === 'play' && guard++ < 70 && sim.t - lastMove < 14) {
    const S = sim.fullState();
    const v0 = value(sim);
    const scored = [];
    for (const a of actions(sim)) {
      const c = Sim.fromState(level, S);
      act(c, a);
      if (a.ring >= 0 && c.turns === S.turns) continue; // a locked (stunned) ring did not move
      scored.push({ a, v: value(c), c, S2: c.state === 'play' ? c.fullState() : null });
    }
    scored.sort((x, y) => y.v - x.v);
    // no single move makes progress: look two moves ahead from the best few (always with depth2)
    if (opts.depth2 || scored[0].v <= v0 + 5) {
      for (const s of scored.slice(0, opts.depth2 ? 4 : 5)) {
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
    // 14 s of only waiting is longer than any nest or door cycle: stuck, so stop searching
    if (pick.a.ring >= 0) lastMove = sim.t;
    // A restored sim drifts from the original (contact caches are not part of the state), so
    // replaying the move can end differently from what was scored. Continue from the scored
    // outcome itself: the plan is then exactly what was evaluated.
    if (opts.replay) act(sim, pick.a);
    else sim = pick.c;
  }
  const st = sim.stats();
  return { id: level.id, state: sim.state, t: +sim.t.toFixed(1), left: +sim.timeLeft.toFixed(1), moves: plan.length, turns: sim.turns, plan, ...st };
}

// The exploit check (F15): turn every ring so a gap sits at the bottom, all at once, and wait.
// Returns the stars that earns; a level a player can clear this way (2+ stars) is rejected.
export function alignAll(level, opts = {}) {
  const sim = new Sim(level, { mode: opts.mode });
  for (const r of sim.rings) {
    if (r.motor || !r.gaps.length) continue;
    const a = r.body.getAngle();
    let best = Infinity;
    for (const g of r.gaps) {
      let d = Math.atan2(Math.sin(-Math.PI / 2 - a - g.a), Math.cos(-Math.PI / 2 - a - g.a));
      if (r.oneway && Math.sign(d) !== r.oneway) d += r.oneway * 2 * Math.PI; // one-way: the long way round
      if (Math.abs(d) < Math.abs(best)) best = d;
    }
    r.goal = a + best;
  }
  for (let i = 0; i < 12 / DT && (sim.state === 'play' || sim.state === 'winning' || sim.state === 'failing'); i++) {
    for (const r of sim.rings) if (r.goal !== undefined && !r.follower) r.target = r.goal;
    sim.step();
    sim.events.length = 0;
  }
  const st = sim.stats();
  return sim.state === 'won' || (sim.state === 'play' && st.saved >= st.target) ? (st.broken === 0 && st.alive === 0 ? (st.perfect ? 3 : 2) : 1) : 0;
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
