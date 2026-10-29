import { Sim, DT } from '../src/sim/sim.js';
function run(S, releaseDeg, mat='wood') {
  const L = { r0: 1.05, spacing: S, material: mat, eggs: 1, target: 1,
    rings: [ { gaps: [{ a: 0, len: 0.8 }] }, { gaps: [{ a: 90, len: 0.8 }] } ] };
  const sim = new Sim(L);
  // ring0 gap at local 0 => rotate ring to bring gap to releaseDeg (bottom = -90)
  const r0 = sim.rings[0];
  let maxV = 0, cracks = 0;
  const target = releaseDeg * Math.PI / 180;
  for (let i = 0; i < 120 * 6; i++) {
    if (sim.t > 0.8) r0.target = sim.t < 4 ? target : target;
    sim.step();
    for (const e of sim.eggs) maxV = Math.max(maxV, e.impact);
    for (const ev of sim.events) if (ev.type === 'crack' || ev.type === 'break') cracks++;
    sim.events.length = 0;
  }
  const e = sim.eggs[0];
  return `S=${S} rel=${releaseDeg} mat=${mat} maxV=${maxV.toFixed(2)} cracks=${e.cracks} alive=${e.alive} ch=${sim.channelOf(e)}`;
}
for (const S of [0.9, 1.0, 1.15, 1.3, 1.5]) for (const rel of [-90, -60, -35, -10]) console.log(run(S, rel));
console.log(run(1.15,-90,'mushroom'), run(1.15,-90,'ice'));
