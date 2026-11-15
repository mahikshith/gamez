// node tools/planner-one.mjs <id> <mode> [key=value ...]: the planner on one level with level fields overridden (numbers)
import { solve } from './planner.mjs';
import { LEVELS } from '../src/data/levels.js';
const [id, mode, ...kv] = process.argv.slice(2);
const L = { ...LEVELS.find((l) => l.id === +id) };
for (const p of kv) { const [k, v] = p.split('='); L[k] = isNaN(+v) ? v : +v; }
const r = solve(L, { mode });
console.log(`${mode} L${id} ${kv.join(' ')} ${r.state} saved=${r.saved}/${r.total} t=${r.t} broken=${r.broken}`);
