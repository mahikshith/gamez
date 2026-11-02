// Studio copy of L13 "Duck Pond" with the octopus placed in it (v3.5). The exact field this adds to the level:
//   octopus: { ch: 3, a: -60, delay: 10, den: true }
// (a puddle on the floor of ring 3, in the pond's third channel; it wakes when an egg comes near, hunts across rings).
// Run the planner on it for every mode: node tools/octo-l13.mjs [easy|medium|hard]...
import { LEVELS } from '../src/data/levels.js';
import { solve } from './planner.mjs';
import { OCT } from '../src/sim/sea.js';
export const OCTO_L13 = { ch: 3, a: -60, delay: 10, den: true };
export function studioL13(octopus = OCTO_L13) {
  const L = LEVELS.find((l) => l.id === 13);
  return { ...JSON.parse(JSON.stringify(L)), id: 990, name: 'Studio: Duck Pond + octopus', octopus: { ...octopus } };
}
if (process.argv[1] && process.argv[1].endsWith('octo-l13.mjs')) {
  const opt = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? JSON.parse(a.slice(n.length + 3)) : null; };
  const over = opt('oct'); // experiments: --oct='{"ch":3,"a":-60,"delay":10,"den":true}' --hard='{"range":3}' --medium=...
  for (const m of ['easy', 'medium', 'hard']) if (opt(m)) Object.assign(OCT.mode[m], opt(m));
  if (opt('hold')) Object.assign(OCT.hold, opt('hold'));
  const modes = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  for (const mode of modes.length ? modes : ['easy', 'medium', 'hard']) {
    for (const [name, L] of [...(process.argv.includes('--skipbase') ? [] : [['L13 as shipped', LEVELS.find((l) => l.id === 13)]]), ['L13 + octopus', studioL13(over ? { ...OCTO_L13, ...over } : OCTO_L13)]]) {
      const t0 = Date.now();
      const r = solve(L, { mode, depth2: process.argv.includes('--depth2') });
      const stars = r.saved >= r.target ? (r.broken === 0 ? (r.perfect ? 3 : 2) : 1) : 0;
      console.log(`${mode.padEnd(6)} ${name.padEnd(15)} ${r.state.padEnd(7)} stars=${stars} t=${r.t} saved=${r.saved}/${r.total} moves=${r.moves} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
  }
}
