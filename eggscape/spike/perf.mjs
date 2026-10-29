import { Sim } from '../src/sim/sim.js';
import { LEVELS } from '../src/data/levels.js';
const s = new Sim(LEVELS[19]); const t0 = performance.now();
for (let i = 0; i < 2400; i++) s.step();
console.log('ms/step', ((performance.now() - t0) / 2400).toFixed(3));
let t1=performance.now(); for (let i=0;i<20;i++) new Sim(LEVELS[19]); console.log('ms/build',((performance.now()-t1)/20).toFixed(2));
