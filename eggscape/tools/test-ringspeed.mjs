// Fast rings must not push eggs through walls: node tools/test-ringspeed.mjs [speeds=1,3,5] [secs=40]
// Random hard ring play on plain-ring levels at each ring speed; an egg whose centre crosses a ring's radius while it
// is far (in angle) from every gap of that ring counts as a wall crossing. The count at high speed is compared with
// the count at speed 1 (creatures that carry eggs and powers cause a few honest crossings at any speed).
import { Sim, DT } from '../src/sim/sim.js';
import { LEVELS } from '../src/data/levels.js';
const [speeds = '1,3,5', secs = '40'] = process.argv.slice(2);
const TAU = Math.PI * 2, wrap = (a) => ((a % TAU) + TAU + Math.PI) % TAU - Math.PI;
const ids = [1, 2, 3, 6, 8, 11, 12, 16, 17, 21, 22, 26, 28, 33, 36];
const out = {};
for (const sp of speeds.split(',').map(Number)) {
  let cross = 0, steps = 0, lost = 0, nan = 0;
  for (const id of ids) for (let seed = 1; seed <= 3; seed++) {
    const L = LEVELS.find((l) => l.id === id);
    let r = seed * 9301 + id * 49297; const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const sim = new Sim(L, { mode: 'medium' }); sim.ringSpeed = sp;
    if (sim.rings.some((g) => g.prof)) continue;
    let ring = 0, until = 0, dir = 1; const prev = new Map();
    for (let s = 0; s < +secs / DT && sim.state === 'play'; s++) {
      if (sim.t >= until) { ring = Math.floor(rnd() * sim.rings.length); dir = rnd() < 0.5 ? -1 : 1; until = sim.t + 0.15 + rnd() * 0.6; } // quick, jerky turns: the worst case
      for (const rg of sim.rings) if (!rg.motor) rg.target = rg.body.getAngle();
      const R = sim.rings[ring]; if (R && !R.motor) R.target = R.body.getAngle() + 3 * dir;
      sim.step(); sim.events.length = 0; steps++;
      for (const e of sim.aliveEggs()) {
        const p = e.body.getPosition(), d = Math.hypot(p.x, p.y), a = Math.atan2(p.y, p.x), q = prev.get(e.id);
        if (!isFinite(d)) { nan++; continue; }
        if (q && Math.abs(d - q.d) < 0.6) for (const rg of sim.rings) {
          if ((q.d - rg.r) * (d - rg.r) < 0) { // crossed this ring's centre line
            const la = wrap(a - rg.body.getAngle());
            const near = rg.gaps.some((g) => Math.abs(wrap(la - g.a)) * rg.r < g.len / 2 + 0.6) || (rg.segs || []).some((sg) => sg.alive === false || sg.broken);
            if (!near) cross++;
          }
        }
        prev.set(e.id, { d });
      }
    }
    lost += sim.stats().broken;
  }
  out[sp] = { cross, steps, per100k: +(cross / steps * 1e5).toFixed(2), lost, nan };
  console.log(`speed ${sp}:`, JSON.stringify(out[sp]));
}
