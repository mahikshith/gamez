// How often rings cannot be turned (locked by a creature, not grabbable) during random play. node tools/lockstat.mjs <id> [mode]
import { Sim, DT } from '../src/sim/sim.js';
import { LEVELS } from '../src/data/levels.js';
const id = +process.argv[2], mode = process.argv[3] || 'medium';
const L = LEVELS.find((l) => l.id === id);
for (let seed = 1; seed <= 3; seed++) {
  const sim = new Sim(L, { mode });
  let r = seed * 7771; const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const lk = sim.rings.map(() => 0), ng = sim.rings.map(() => 0); let n = 0, ring = 0, until = 0, dir = 1, allLocked = 0;
  const why = {};
  for (let s = 0; s < 90 / DT && sim.state === 'play'; s++) {
    if (sim.t >= until) { ring = Math.floor(rnd() * sim.rings.length); dir = rnd() < 0.5 ? -1 : 1; until = sim.t + 0.4 + rnd() * 2; }
    for (const rg of sim.rings) if (!rg.motor) rg.target = rg.body.getAngle();
    if (!sim.rings[ring].motor) sim.rings[ring].target = sim.rings[ring].body.getAngle() + 0.5 * dir;
    sim.step(); sim.events.length = 0;
    if (s % 12) continue;
    n++; let all = true;
    sim.rings.forEach((rg, i) => { if (rg.lock > 0) lk[i]++; if (!rg.grabbable) ng[i]++; if (rg.lock <= 0 && rg.grabbable) all = false; for (const k of ['lock', 'stun', 'frozen', 'ice', 'coil', 'held']) if (rg[k] > 0 || rg[k] === true) why[k] = (why[k] || 0) + 1; });
    if (all) allLocked++;
  }
  console.log(`L${id} ${mode} seed${seed} t=${sim.t.toFixed(0)} state=${sim.state} lock% ${lk.map((v) => Math.round(100 * v / n)).join(',')} notGrab% ${ng.map((v) => Math.round(100 * v / n)).join(',')} allLocked% ${Math.round(100 * allLocked / n)} why ${JSON.stringify(why)}`);
}
