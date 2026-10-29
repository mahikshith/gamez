// One-move lookahead shared by the level planner (tools/planner.mjs) and the in-game hint (C4).
import { DT } from './sim.js';

const DEG = Math.PI / 180;
const DELTAS = [35, 75, 120, 180, 240].flatMap((d) => [d * DEG, -d * DEG]);

// Execute one action on a sim: turn ring i by delta at full speed, then let things settle.
export function act(sim, a, maxSettle = 2.5) {
  for (const _ of actSteps(sim, a, maxSettle)) { /* run to the end */ }
}

// The same as a generator that yields every `every` sim steps (the in-game hint spreads it over frames).
export function* actSteps(sim, a, maxSettle = 2.5, every = Infinity) {
  let n = 0;
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
    if (++n % every === 0) yield;
    if (ring && Math.abs(goal - ring.body.getAngle()) < 0.01) break;
  }
  // settle
  let s = 0;
  while (s < maxSettle && sim.state === 'play') {
    for (const r of sim.rings) if (!r.motor) r.target = r.body.getAngle();
    sim.step();
    sim.events.length = 0;
    s += DT;
    if (++n % every === 0) yield;
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

export function actions(sim) {
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

// The in-game hint: tries each ring move from state S, one per call of next(), so the caller can spread
// the work over frames. The best move found so far is kept in out.best.
export function* hintSearch(Sim, level, S, opts, out) {
  const acts = actions(Sim.fromState(level, S, opts)).filter((a) => a.ring >= 0).slice(0, 24);
  for (const a of acts) {
    const c = Sim.fromState(level, S, opts);
    yield* actSteps(c, a, 1.2, 30);
    const v = value(c);
    if (!out.best || v > out.best.v) out.best = { ring: a.ring, delta: a.delta, v };
    yield;
  }
}
