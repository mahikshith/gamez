// The Easy star rule against the planner (0.8.17, src/goals.js easyGoals): node tools/planner-easy.mjs [ids] [--json]
// For every level the planner plays Easy and Medium; each finished world is scored with the goals of its mode, and on
// Easy also with the old rule (Medium's goals on the Easy fuse). Prints the share of levels the planner still takes
// to three stars on Easy, before and after. The planner plays for the eggs, not for a bonus goal, so this is "is three
// stars still possible", not how often a person gets them.
import { solve } from './planner.mjs';
import { LEVELS } from '../src/data/levels.js';
import * as GL from '../src/goals.js';
const arg = process.argv.slice(2).find((a) => /^\d/.test(a));
const ids = arg ? arg.split(',').map(Number) : LEVELS.map((l) => l.id);
const rows = [];
for (const id of ids) {
  const L = LEVELS.find((l) => l.id === id), row = { id };
  for (const mode of ['easy', 'medium']) {
    const r = solve(L, { mode, sim: true }), F = { ...GL.facts(r.sim), won: r.sim.state === 'won' };
    row[mode] = GL.score(GL.levelGoals(L, r.sim.MD.fuse, true, mode), F).stars;
    if (mode === 'easy') row.easyOld = GL.score(GL.levelGoals(L, r.sim.MD.fuse, true, 'medium'), F).stars;
  }
  rows.push(row);
  if (!process.argv.includes('--json')) console.log(`L${String(id).padStart(2)}  easy ${row.easy} (old rule ${row.easyOld})  medium ${row.medium}`);
}
const pct = (f) => Math.round((rows.filter(f).length * 100) / Math.max(1, rows.length));
const sum = { n: rows.length, easy3: pct((r) => r.easy === 3), easyOld3: pct((r) => r.easyOld === 3), medium3: pct((r) => r.medium === 3), easyWon: pct((r) => r.easy > 0) };
if (process.argv.includes('--json')) console.log(JSON.stringify({ rows, sum }));
else console.log(`\nthree stars on Easy: ${sum.easy3}% of ${sum.n} levels (old rule ${sum.easyOld3}%); on Medium ${sum.medium3}%; Easy won ${sum.easyWon}%`);
