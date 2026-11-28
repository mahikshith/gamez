// Allocation by the sim alone (node heap sampling), per simulated second. Usage: node tools/perf87/simalloc.mjs [ids] [--secs 20]
import { Session } from 'node:inspector/promises';
import { Sim, DT } from '../../src/sim/sim.js';
import { LEVELS } from '../../src/data/levels.js';
const args = process.argv.slice(2);
const ids = args[0] && !args[0].startsWith('--') ? args[0].split(',').map(Number) : [20, 45];
const i = args.indexOf('--secs'); const SECS = i >= 0 ? +args[i + 1] : 20;
const ss = new Session(); ss.connect();
for (const id of ids) {
  const L = LEVELS.find((l) => l.id === id);
  const sim = new Sim(L, { mode: 'medium' });
  let r = 7; const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); let ring = 0, until = 0, dir = 1;
  const play = (n) => { for (let s = 0; s < n && sim.state === 'play'; s++) {
    if (sim.t >= until) { ring = Math.floor(rnd() * sim.rings.length); dir = rnd() < 0.5 ? -1 : 1; until = sim.t + 0.3 + rnd() * 1.5; }
    for (const rg of sim.rings) if (!rg.motor) rg.target = rg.body.getAngle(); const R = sim.rings[ring]; if (R && !R.motor) R.target = R.body.getAngle() + 0.5 * dir;
    sim.step(); sim.events.length = 0; } };
  play(240);
  await ss.post('HeapProfiler.enable'); await ss.post('HeapProfiler.collectGarbage');
  await ss.post('HeapProfiler.startSampling', { samplingInterval: 1024, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
  const t0 = sim.t; play(SECS / DT); const simSecs = sim.t - t0;
  const { profile } = await ss.post('HeapProfiler.stopSampling');
  const by = new Map(); let total = 0;
  const walk = (n, path) => { const cf = n.callFrame; const f = cf.url.replace(/.*\/(src|node_modules)\//, '$1/'); const key = `${cf.functionName || '(anon)'} ${f}:${cf.lineNumber + 1}`; total += n.selfSize; if (n.selfSize) { const p = path ? `${key}  <- ${path}` : key; by.set(p, (by.get(p) || 0) + n.selfSize); } for (const c of n.children) walk(c, /src\//.test(cf.url) ? key : path); };
  walk(profile.head, '');
  console.log(`\nL${id}: ${simSecs.toFixed(1)} sim s, ${(total / simSecs / 1024).toFixed(0)} KB per sim second (${(total / simSecs / 60 / 1024).toFixed(1)} KB per 60fps frame)`);
  for (const [k, v] of [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log(`  ${(v / simSecs / 1024).toFixed(0).padStart(6)} KB/s  ${k}`);
}
