// Thorn Snips (start boost): every thorn on the rings at the start is snipped, in about 3 s: node tools/test-snips.mjs
import { Sim, DT } from '../src/sim/sim.js';
import { LEVELS } from '../src/data/levels.js';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const live = (s) => s.rings.reduce((n, r) => n + r.thorns.filter((t) => t.alive).length, 0);
const thorny = LEVELS.filter((L) => L.rings.some((r) => (r.thorns || []).length)).filter((L) => !L.bossFight);
const pick = [thorny[1], thorny[Math.floor(thorny.length / 2)], thorny.reduce((a, b) => (JSON.stringify(b.rings).length > JSON.stringify(a.rings).length ? b : a))];
for (const L of pick) {
  const s = new Sim(L, { mode: 'medium', snips: true }), n0 = live(s); let snips = 0, tFirst = 0, tLast = 0;
  for (let i = 0; i < 4.5 / DT; i++) { s.step(); for (const e of s.events) if (e.type === 'stkSnip') { snips++; tFirst = tFirst || i * DT; tLast = i * DT; } s.events.length = 0; }
  ok(n0 > 0 && live(s) === 0, `level ${L.id}: ${n0} thorns at the start, ${live(s)} left`);
  ok(snips === n0 && tFirst > 0.85 && tFirst < 1.0 && tLast <= 3.2, `level ${L.id}: ${snips} snips, first ${tFirst.toFixed(2)}s, last ${tLast.toFixed(2)}s`);
  const c = new Sim(L, { mode: 'medium' }); for (let i = 0; i < 4.5 / DT; i++) c.step();
  ok(live(c) === n0, `level ${L.id}: without the boost nothing is snipped`);
}
process.exit(bad ? 1 : 0);
