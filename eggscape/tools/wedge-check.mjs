// drop an egg onto each gator/turtle in L41-45 and see if it can get out (rotate rings back and forth)
import { Sim, DT } from '../src/sim/sim.js';
import { LEVELS } from '../src/data/levels.js';
import { Vec2 } from 'planck';
const spacing = process.argv[2] ? +process.argv[2] : null;
let stuckTotal = 0, trials = 0;
for (const id of [41, 42, 43, 44, 45]) {
  const L0 = LEVELS.find((l) => l.id === id);
  const L = spacing ? { ...L0, spacing } : L0;
  for (const kind of ['g', 't']) for (let k = 0; k < 2; k++) for (const da of [-0.25, 0, 0.25]) for (const flat of [0, 1]) {
    const sim = new Sim(L, { mode: 'medium' });
    const list = kind === 'g' ? sim.gators : sim.turtles;
    const C = list[k]; if (!C || C.ph === 'hid') continue;
    // put creatures asleep forever-ish
    for (let i = 0; i < 30; i++) sim.step();
    const F = sim.byFrame(C), along = da * (kind === 'g' ? 1.7 : 1.35);
    const h = kind === 'g' ? 0.36 : 0.38;
    const e = sim.aliveEggs()[0];
    const x = F.x + F.tx * along + F.nx * (h + 0.32), y = F.y + F.ty * along + F.ny * (h + 0.32);
    e.body.setTransform(Vec2(x, y), flat ? Math.PI / 2 + C.a : C.a + Math.PI / 2 - Math.PI / 2);
    e.body.setLinearVelocity(Vec2(0, 0));
    // other eggs out of the way: park them
    const ring = sim.rings[C.ch - 1] || sim.rings[0], floor = sim.rings[C.ch];
    const p0 = e.body.getPosition().clone();
    const hist = []; let moved = 0, t = 0, ch0 = sim.channelOf(e);
    // wiggle: rotate floor ring and ring above back and forth for 6 s
    for (let s = 0; s < 6 / DT && sim.state === 'play'; s++) {
      for (const r of sim.rings) if (!r.motor) r.target = r.body.getAngle();
      const dir = Math.sin(s * DT * 1.6) > 0 ? 1 : -1;
      floor.target = floor.body.getAngle() + 0.3 * dir; ring.target = ring.body.getAngle() - 0.3 * dir;
      sim.step(); sim.events.length = 0;
      if (!e.alive || e.saved) break;
      const p = e.body.getPosition();
      moved = Math.max(moved, Math.hypot(p.x - p0.x, p.y - p0.y));
      hist.push([p.x, p.y, e.clamp > 0 || !!e.thf]);
    }
    const tail = hist.slice(-Math.round(3 / DT));
    let span = 0; for (const q of tail) span = Math.max(span, Math.hypot(q[0] - tail[0][0], q[1] - tail[0][1]));
    const wedged = e.alive && !e.saved && tail.length > 100 && !tail.some((q) => q[2]) && span < 0.15;
    const pf = e.body.getPosition();
    // stuck = still within 0.5 m of start contact with creature after 6 s of wiggling
    const ang0 = Math.atan2(p0.y, p0.x), ang1 = Math.atan2(pf.y, pf.x);
    const arc = Math.abs(((ang1 - ang0 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) * Math.hypot(pf.x, pf.y);
    const stuck = e.alive && !e.saved && sim.channelOf(e) === ch0 && arc < 0.8 && Math.abs((Math.atan2(pf.y,pf.x)) - Math.atan2(sim.byFrame(C).y, sim.byFrame(C).x))*sim.byFloor(C.ch) < 1.0;
    let pos = ''; trials++; if (wedged) stuckTotal++;
    if (wedged || process.env.V) { const Fc = sim.byFrame(C), q = e.body.getPosition(), dx = q.x - Fc.x, dy = q.y - Fc.y; pos = ` along=${(dx*Fc.tx+dy*Fc.ty).toFixed(2)} up=${(dx*Fc.nx+dy*Fc.ny).toFixed(2)} ch=${sim.channelOf(e)}/${C.ch}`; } if (wedged || process.env.V) console.log(`${pos} L${id} ${kind}${k} da=${da} flat=${flat} ph=${C.ph} clamp=${e.clamp||0} moved=${moved.toFixed(2)} arc=${arc.toFixed(2)} alive=${e.alive} wedged=${wedged}`);
  }
}
console.log('wedged', stuckTotal, '/', trials);
