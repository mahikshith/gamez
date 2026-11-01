// Lookahead planner: a strong (not human) player. If it can't clear a level, the level is suspect.
// Usage: node tools/planner.mjs [ids] [--depth2]
import { Sim, DT } from '../src/sim/sim.js';
import { LEVELS } from '../src/data/levels.js';
import { act, value, actions as allActions } from '../src/sim/search.js';
import { CHICK_DEMOS } from '../src/data/chick-demos.js';

export { act, value };

// opts.mode: 'easy' | 'medium' | 'hard' (default medium)
// opts.noTap: never use chick powers (proves a demo needs them)
export function solve(level, opts = {}) {
  const actions = (s) => allActions(s).filter((a) => !(opts.noTap && a.tap));
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
      // the best few ring moves (waits are cheap and crowd the top when nothing helps at once) plus the best wait
      const moves = [...scored.filter((s) => s.a.ring >= 0).slice(0, opts.depth2 ? 4 : 5), ...scored.filter((s) => s.a.tap)]; // every chick tap is worth a look ahead
      for (const s of [...moves, scored.find((s) => s.a.ring < 0 && !s.a.tap)].filter(Boolean)) {
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
      // a chick power often needs a ring set up first (turn the curtain over it, then tap): every other
      // ring move also gets a look at a tap right after it (cheap: one sim per ready chick)
      if (scored.some((s) => s.a.tap)) {
        for (const s of scored) {
          if (s.v2 !== undefined || !s.S2 || s.a.ring < 0) continue;
          const c0 = Sim.fromState(level, s.S2);
          let best = s.v;
          for (const a2 of actions(c0).filter((a) => a.tap)) {
            const c = Sim.fromState(level, s.S2);
            act(c, a2);
            best = Math.max(best, value(c));
          }
          s.v2 = best;
        }
      }
      scored.sort((x, y) => (y.v2 ?? y.v) - (x.v2 ?? x.v));
    }
    const pick = scored[0];
    plan.push(pick.a);
    // 14 s of only waiting is longer than any nest or door cycle: stuck, so stop searching
    if (pick.a.ring >= 0 || pick.a.tap) lastMove = sim.t;
    // A restored sim drifts from the original (contact caches are not part of the state), so
    // replaying the move can end differently from what was scored. Continue from the scored
    // outcome itself: the plan is then exactly what was evaluated.
    if (opts.replay) act(sim, pick.a);
    else sim = pick.c;
  }
  const st = sim.stats();
  // special eggs (ostrich, quail, duck) must make it, not just the target count
  const sp = sim.eggs.filter((e) => e.kind);
  const special = { saved: sp.filter((e) => e.saved).length, total: sp.length };
  return { id: level.id, special, state: sim.state, t: +sim.t.toFixed(1), left: +sim.timeLeft.toFixed(1), moves: plan.length, turns: sim.turns, taps: plan.filter((a) => a.tap).length, plan, ...st };
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

if (import.meta.url === `file://${process.argv[1]}` && process.argv.includes('--demo')) {
  // v3.2 chick demos: each must clear with taps, and (where the power is the way through) fail without
  const only = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2].split(',') : null;
  const line = (r) => `${r.state.padEnd(7)} saved=${r.saved}/${r.total} broken=${r.broken} t=${String(r.t).padStart(5)} moves=${r.moves} taps=${r.taps}`;
  for (const L of CHICK_DEMOS) {
    if (only && !only.includes(L.kind)) continue;
    const t0 = Date.now(), a = solve(L, { depth2: true }), b = solve(L, { depth2: true, noTap: true });
    const won = (r) => r.saved >= r.target;
    console.log(`${L.kind.padEnd(6)} with taps: ${line(a)} | no taps: ${line(b)} | ${won(a) && !won(b) ? 'OK: power needed' : won(a) ? 'WARN: solvable without the power' : 'FAIL: not solved'} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    if (process.argv.includes('--plan')) console.log('   ' + a.plan.map((x) => (x.tap ? `TAP#${x.tap}` : x.ring >= 0 ? `r${x.ring}${x.delta > 0 ? '+' : ''}${Math.round((x.delta * 180) / Math.PI)}` : `w${x.wait}`)).join(' '));
  }
} else if (import.meta.url === `file://${process.argv[1]}`) {
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
