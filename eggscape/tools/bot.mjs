import { Sim, DT } from '../src/sim/sim.js';
import { LEVELS } from '../src/data/levels.js';
import { botTick } from '../src/dev/bot.js';

export function playLevel(level, opts = {}) {
  const sim = new Sim(level, opts);
  const maxT = (level.time || 120) + 5;
  const mem = {};
  const log = [];
  while (sim.t < maxT && (sim.state === 'play' || sim.state === 'winning' || sim.state === 'failing')) {
    botTick(sim, mem);
    sim.step();
    for (const ev of sim.events) if (['crack', 'break', 'save', 'pickup', 'comet', 'gate', 'explode', 'timeout'].includes(ev.type)) log.push(`${ev.t.toFixed(1)} ${ev.type}${ev.why ? ':' + ev.why : ''}${ev.type === 'gate' ? ' x' + ev.gx : ''}${ev.type === 'pickup' ? ':' + ev.type : ''}`);
    sim.events.length = 0;
  }
  const st = sim.stats();
  return { id: level.id, state: sim.state, t: +sim.t.toFixed(1), timeLeft: +sim.timeLeft.toFixed(1), ...st, log };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv[2] ? process.argv[2].split(',').map(Number) : null;
  for (const L of LEVELS) {
    if (only && !only.includes(L.id)) continue;
    const r = playLevel(L);
    console.log(`L${String(r.id).padStart(2)} ${r.state.padEnd(7)} t=${String(r.t).padStart(5)} left=${String(r.timeLeft).padStart(5)} saved=${r.saved}/${r.total} broken=${r.broken} target=${r.target} score=${r.score}`);
    if (process.env.V) console.log('   ' + r.log.join(' | '));
  }
}
