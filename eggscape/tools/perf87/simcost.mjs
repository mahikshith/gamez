// Sim step cost per level (node, src/sim directly). Usage: node tools/perf87/simcost.mjs [ids] [--secs 30]
import { Sim, DT } from '../../src/sim/sim.js';
import { LEVELS } from '../../src/data/levels.js';
const args = process.argv.slice(2);
const ids = args[0] && !args[0].startsWith('--') ? args[0].split(',').map(Number) : [13, 20, 31, 45, 50];
const i = args.indexOf('--secs'); const SECS = i >= 0 ? +args[i + 1] : 30;
for (const id of ids) {
  const L = LEVELS.find((l) => l.id === id);
  const all = [];
  for (const mode of ['easy', 'medium', 'hard']) for (let seed = 1; seed <= 2; seed++) {
    let r = seed * 9301 + id * 49297; const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const sim = new Sim(L, { mode }); let ring = 0, until = 0, dir = 1;
    for (let s = 0; s < SECS / DT && sim.state !== 'won' && sim.state !== 'failed'; s++) {
      if (sim.t >= until) { ring = Math.floor(rnd() * sim.rings.length); dir = rnd() < 0.5 ? -1 : 1; until = sim.t + 0.3 + rnd() * 1.5; if (rnd() < 0.3) ring = -1; }
      for (const rg of sim.rings) if (!rg.motor) rg.target = rg.body.getAngle();
      if (ring >= 0 && sim.rings[ring] && !sim.rings[ring].motor) sim.rings[ring].target = sim.rings[ring].body.getAngle() + 0.5 * dir;
      const t0 = performance.now(); sim.step(); const d = performance.now() - t0; sim.events.length = 0;
      if (s > 120) all.push(d);
    }
  }
  all.sort((a, b) => a - b); const q = (p) => all[Math.min(all.length - 1, Math.floor(all.length * p))];
  const mean = all.reduce((a, b) => a + b, 0) / all.length;
  console.log(`L${id} steps=${all.length} mean=${mean.toFixed(3)}ms p50=${q(.5).toFixed(3)} p95=${q(.95).toFixed(3)} p99=${q(.99).toFixed(3)} max=${all[all.length - 1].toFixed(2)}  per 60fps frame (2 steps) ~${(2 * mean).toFixed(2)}ms`);
}
