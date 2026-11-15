// Soak: random ring play on every level (all modes), looking for sim exceptions, slow steps (hangs) and NaN bodies.
// Usage: node tools/soak.mjs [ids] [--secs 90] [--seeds 3]
import { Sim, DT } from '../src/sim/sim.js';
import { LEVELS } from '../src/data/levels.js';
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? +args[i + 1] : d; };
const ids = args[0] && !args[0].startsWith('--') ? args[0].split(',').map(Number) : LEVELS.map((l) => l.id);
const SECS = opt('--secs', 90), SEEDS = opt('--seeds', 3);
let bad = 0;
for (const id of ids) {
  const L = LEVELS.find((l) => l.id === id);
  for (const mode of ['easy', 'medium', 'hard']) for (let seed = 1; seed <= SEEDS; seed++) {
    let r = seed * 9301 + id * 49297;
    const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    let sim, worst = 0, err = null, stepAt = 0;
    try {
      sim = new Sim(L, { mode, strike: ['freeze', 'thunder', 'bomb', 'decoy', 'tornado', 'glue'][seed % 6] });
      let ring = 0, until = 0, dir = 1;
      for (let s = 0; s < SECS / DT && sim.state !== 'won' && sim.state !== 'failed'; s++) {
        stepAt = s;
        if (sim.t >= until) { ring = Math.floor(rnd() * sim.rings.length); dir = rnd() < 0.5 ? -1 : 1; until = sim.t + 0.3 + rnd() * 1.5; if (rnd() < 0.3) ring = -1; }
        for (const rg of sim.rings) if (!rg.motor) rg.target = rg.body.getAngle();
        if (ring >= 0 && sim.rings[ring] && !sim.rings[ring].motor) sim.rings[ring].target = sim.rings[ring].body.getAngle() + 0.5 * dir;
        if (sim.stk && sim.stkReady && sim.stkReady() && rnd() < 0.01) sim.stkFire({});
        const t0 = performance.now();
        sim.step();
        sim.events.length = 0;
        const d = performance.now() - t0;
        if (d > worst) worst = d;
        for (const e of sim.aliveEggs()) { const p = e.body.getPosition(); if (!isFinite(p.x) || !isFinite(p.y)) throw new Error('NaN egg'); }
      }
    } catch (e) { err = e; }
    const slow = worst > 60;
    if (err || slow) { bad++; console.log(`L${id} ${mode} seed${seed} t=${sim ? sim.t.toFixed(1) : '-'} step#${stepAt} worst=${worst.toFixed(1)}ms ${err ? 'ERR ' + (err.stack || err).toString().split('\n').slice(0, 4).join(' | ') : 'SLOW'}`); }
    else if (process.env.V) console.log(`L${id} ${mode} seed${seed} ${sim.state} t=${sim.t.toFixed(1)} worst=${worst.toFixed(1)}ms`);
  }
}
console.log('soak done, problems:', bad);
