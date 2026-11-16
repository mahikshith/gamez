// L15: during the blizzard's gale, how far do free rings turn and eggs move? node tools/galecheck.mjs
import { Sim, DT } from '../src/sim/sim.js';
import { LEVELS } from '../src/data/levels.js';
const sim = new Sim(LEVELS.find((l) => l.id === 15), { mode: 'medium' });
let inGale = 0, a0 = null, e0 = null;
for (let s = 0; s < 40 / DT && sim.state === 'play'; s++) {
  for (const r of sim.rings) if (!r.motor && !(sim.bx.boss.atk && sim.bx.boss.atk.ph === 'act')) r.target = r.body.getAngle();
  sim.step(); sim.events.length = 0;
  const A = sim.bx.boss.atk, on = A && A.name === 'gale' && A.ph === 'act';
  if (on && !inGale) { a0 = sim.rings.map((r) => r.body.getAngle()); e0 = sim.aliveEggs().map((e) => ({ ...e.body.getPosition() })); }
  if (!on && inGale) { console.log(`t=${sim.t.toFixed(1)} ring turn deg ${sim.rings.map((r, i) => Math.round((r.body.getAngle() - a0[i]) * 57.3)).join(',')} egg move m ${sim.aliveEggs().map((e, i) => e0[i] ? Math.hypot(e.body.getPosition().x - e0[i].x, e.body.getPosition().y - e0[i].y).toFixed(2) : '?').join(',')}`); }
  inGale = on;
}
