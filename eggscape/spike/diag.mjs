import { Sim } from '../src/sim/sim.js';
import { LEVELS } from '../src/data/levels.js';
import { act } from '../tools/planner.mjs';
const id = +process.argv[2];
const L = LEVELS.find((l) => l.id === id);
const sim = new Sim(L);
const origStep = sim.step.bind(sim);
sim.step = () => { origStep(); for (const e of sim.events) if (['break','crack','pickup','save','portal'].includes(e.type)) { const r = e.x!==undefined? Math.hypot(e.x,e.y).toFixed(2):''; const a = e.x!==undefined? (Math.atan2(e.y,e.x)*180/Math.PI).toFixed(0):''; console.log(sim.t.toFixed(2), e.type, e.why||e.type2||'', 'r='+r, 'ang='+a, e.v?('v='+e.v.toFixed(2)):''); } };
const acts = JSON.parse(process.argv[3] || '[]');
for (const a of acts) { console.log('ACT', JSON.stringify(a)); act(sim, a.ring !== undefined ? { ring: a.ring, delta: a.d * Math.PI / 180 } : { ring: -1, wait: a.w }); }
console.log('state', sim.state, sim.stats());
for (const e of sim.aliveEggs()) { const p = e.body.getPosition(); console.log('egg', e.id, 'ch', sim.channelOf(e), 'ang', (Math.atan2(p.y,p.x)*180/Math.PI).toFixed(0)); }
sim.rings.forEach(r=>console.log('ring', r.i, 'angle', (r.body.getAngle()*180/Math.PI).toFixed(0), 'r', r.r.toFixed(2)));
