// King Crab soak: N random-input runs of level 40 (all modes); checks no exception, no NaN, the fight always ends.
import { Sim, DT } from '../src/sim/sim.js';
import { LEVELS } from '../src/data/levels.js';
const L = LEVELS.find((l) => l.id === 40), N = +process.argv[2] || 20;
let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const res = { won: 0, lost: 0, other: 0, bad: 0, atk: {} };
for (let run = 0; run < N; run++) {
  const mode = ['easy', 'medium', 'hard'][run % 3], s = new Sim(L, { mode });
  let next = 0, steps = 0, bad = '';
  const max = (L.time + 30) / DT;
  while (s.state === 'play' || s.state === 'winning' || s.state === 'failing') {
    if (steps++ > max) { bad = 'stuck ' + s.state; break; }
    if (s.t >= next) { next = s.t + 0.2 + rnd() * 0.8; const r = s.rings[Math.floor(rnd() * s.rings.length)]; if (r && !r.motor) r.target = r.body.getAngle() + (rnd() - 0.5) * 3; }
    try { s.step(); } catch (e) { bad = 'exception ' + e.message; break; }
    for (const ev of s.events) if (ev.type === 'bossAct') res.atk[ev.attack] = (res.atk[ev.attack] || 0) + 1;
    s.events.length = 0;
    if (steps % 120 === 0) for (const e of s.eggs) { const p = e.body.getPosition(); if (!isFinite(p.x) || !isFinite(p.y)) bad = 'NaN egg'; }
    const K = s.kc; if (K && (K.bar.length > 3 || !isFinite(K.bx))) bad = bad || 'kc bad';
    if (bad) break;
  }
  if (bad) res.bad++; else if (s.state === 'won') res.won++; else if (s.state === 'failed') res.lost++; else res.other++;
  console.log(`run ${run} ${mode} ${bad || s.state} t=${s.t.toFixed(1)}`);
}
console.log(JSON.stringify(res));
