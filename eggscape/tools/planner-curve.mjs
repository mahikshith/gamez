// The difficulty curve of the road on the planner's measure (tools/gen.mjs hardness: the strong player's moves and time,
// the rough player's broken eggs, a 2-star finish, a 1-star Hard). One line per level and a small chart per world.
// Usage: node tools/planner-curve.mjs [ids] [--jobs N] [--out file.json]
import { fork } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LEVELS } from '../src/data/levels.js';
import { PER_ENV } from '../src/road.js';

export const hardness = (c) => c.moves * 1.5 + c.plannerT / 8 + (c.roughBroken || 0) * 2 + (c.stars === 2 ? 1 : 0) + (c.hard === 1 ? 2 : 0);

async function one(id) {
  const { solve } = await import('./planner.mjs');
  const L = LEVELS.find((l) => l.id === id);
  const p = solve(L), h = solve(L, { mode: 'hard' }), q = id <= 5 ? solve(L, { replay: true }) : null;
  const stars = p.state === 'won' ? (p.broken === 0 ? (p.perfect ? 3 : 2) : 1) : 0;
  const c = { id, name: L.name, world: L.world, stars, plannerT: p.t, moves: p.moves, roughBroken: q ? q.broken : 0, hard: h.state === 'won' ? (h.broken === 0 ? 2 : 1) : 0, hardT: h.t };
  return { ...c, hardness: +hardness(c).toFixed(1) };
}

if (process.argv[2] === '--one') {
  one(+process.argv[3]).then((r) => { process.send(r); process.exit(0); });
} else if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const ids = args[0] && !args[0].startsWith('--') ? args[0].split(',').map(Number) : LEVELS.map((l) => l.id);
  const queue = [...ids], out = [];
  const run = (id) => new Promise((res) => {
    const p = fork(fileURLToPath(import.meta.url), ['--one', String(id)], { stdio: ['inherit', 'inherit', 'inherit', 'ipc'] });
    p.on('message', (r) => { out.push(r); console.error(`L${r.id} ${r.name}: ${r.hardness} (stars ${r.stars}, ${r.moves} moves, ${r.plannerT}s, hard ${r.hard})`); });
    p.on('exit', res);
  });
  await Promise.all(Array.from({ length: +opt('--jobs', 3) }, async () => { while (queue.length) await run(queue.shift()); }));
  out.sort((a, b) => a.id - b.id);
  if (opt('--out')) writeFileSync(opt('--out'), JSON.stringify(out, null, 1));
  const max = Math.max(...out.map((r) => r.hardness));
  for (const r of out) {
    const k = (r.id - 1) % PER_ENV;
    console.log(`${k === 0 ? '\n' : ''}L${String(r.id).padStart(2)} ${r.name.padEnd(22)} ${String(r.hardness).padStart(5)} ${'#'.repeat(Math.round((r.hardness / max) * 40))}`);
  }
}
