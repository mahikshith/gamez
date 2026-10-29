import { DT } from '../sim/sim.js';
import { wrap } from '../sim/geom.js';

const TAU = Math.PI * 2;
const pos = (a) => ((a % TAU) + TAU) % TAU;

function eggAngle(e) {
  const p = e.body.getPosition();
  return Math.atan2(p.y, p.x);
}

// How bad is turning `ring` by delta (radians) for the eggs around it?
function sweepCost(sim, ring, delta, fireOk) {
  let cost = 0;
  const a0 = ring.body.getAngle();
  for (const e of sim.aliveEggs()) {
    const ch = sim.channelOf(e);
    const phi = eggAngle(e);
    const spd = e.body.getLinearVelocity().length();
    for (const th of ring.thorns) {
      if (!th.alive) continue;
      const hits = (th.side === 'in' && ch === ring.i) || (th.side === 'out' && ch === ring.i + 1);
      if (!hits) continue;
      if (fireOk && (e.fire > 0 || e.steel > 0)) continue;
      const tw = a0 + th.a;
      // thorn sweeps from tw to tw+delta; does it cross phi (with margin)?
      const m = 0.32;
      const d = delta >= 0 ? pos(phi - tw + m) : pos(tw - phi + m);
      if (d < Math.abs(delta) + 2 * m) cost += ring.retract ? 0.4 : 1;
    }
    void spd;
  }
  return cost;
}

function planFor(sim, egg) {
  const ch = sim.channelOf(egg);
  if (ch >= sim.rings.length) return null;
  const ring = sim.rings[ch];
  const phi = eggAngle(egg);
  const a0 = ring.body.getAngle();
  let best = null;
  const gaps = ring.gaps.map((g) => ({ a: g.a, x: g.x }));
  // burnt/blasted holes count as gaps too
  for (const s of ring.segs) if (!s.alive) gaps.push({ a: (s.a0 + s.a1) / 2, x: 1 });
  for (const g of gaps) {
    const gw = a0 + g.a;
    const d = wrap(phi - gw);
    for (const delta of [d, d > 0 ? d - TAU : d + TAU]) {
      const cost = sweepCost(sim, ring, delta, true);
      const score = cost * 100 + Math.abs(delta) - (g.x - 1) * 0.6;
      if (!best || score < best.score) best = { ring, delta, score, cost, gate: g };
    }
  }
  return best;
}


// One decision + control application per physics step. mem persists between calls.
export function botTick(sim, mem) {
  mem.think = (mem.think || 0) - DT;
  if (mem.think <= 0 && sim.state === 'play') {
    mem.think = 0.1;
    const eggs = sim.aliveEggs().filter((e) => e.body.getLinearVelocity().length() < 0.8 && sim.channelOf(e) < sim.rings.length);
    eggs.sort((a, b) => sim.channelOf(b) - sim.channelOf(a));
    let plan = null;
    for (const e of eggs) {
      const p = planFor(sim, e);
      if (!p || !p.ring.grabbable) continue;
      if (p.cost > 0 && eggs.length > 1) continue;
      if (p.ring.i === sim.rings.length - 1 && sim.nestAmp) {
        const ex = e.body.getPosition().x;
        const nx = sim.nest.getPosition().x;
        if (Math.abs(p.delta) < 0.5 && Math.abs(nx - ex) > 0.45) { plan = { hold: p.ring }; break; }
      }
      plan = p;
      break;
    }
    if (!plan && eggs.length) {
      const p = planFor(sim, eggs[0]);
      if (p && p.ring.grabbable && p.cost < 1) plan = p;
    }
    mem.plan = plan;
  }
  for (const r of sim.rings) if (!r.motor) { r.target = r.body.getAngle(); r.held = false; }
  const plan = mem.plan;
  if (plan && plan.ring && plan.delta !== undefined && sim.state === 'play') {
    const r = plan.ring;
    r.held = true;
    const step = Math.sign(plan.delta) * Math.min(Math.abs(plan.delta) + 0.15, 0.6);
    r.target = r.body.getAngle() + step;
  }
}
