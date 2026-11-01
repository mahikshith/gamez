// Run the planner on levels for one mode: node tools/planner-modes.mjs <easy|medium|hard> [ids]
import { solve } from './planner.mjs';
import { LEVELS } from '../src/data/levels.js';
const mode = process.argv[2] || 'medium';
const ids = process.argv[3] ? process.argv[3].split(',').map(Number) : LEVELS.map((l) => l.id);
for (const id of ids) {
  const L = LEVELS.find((l) => l.id === id);
  const t0 = Date.now();
  const r = solve(L, { mode, depth2: process.argv.includes('--depth2') });
  const stars = r.saved >= r.target ? (r.broken === 0 ? (r.perfect ? 3 : 2) : 1) : 0;
  console.log(`${mode} L${String(id).padStart(2)} ${r.state.padEnd(7)} stars=${stars} t=${r.t} saved=${r.saved}/${r.total} moves=${r.moves} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
