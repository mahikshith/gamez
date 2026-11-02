// Mechanic coverage (K2): which level teaches each mechanic, and how often it comes back.
// Rule: a mechanic is taught in one level, then reused in at least 3 later levels; otherwise players
// learn a thing and never need it again (or meet it once, cold). Bosses and one-off set pieces are exempt.
// Usage: node tools/coverage.mjs [--matrix]     (exit code 1 when a mechanic breaks the rule)
import { LEVELS } from '../src/data/levels.js';

const rings = (L) => L.rings || [];
const anyRing = (f) => (L) => rings(L).some(f);
const anyGap = (f) => anyRing((r) => (r.gaps || []).some(f));
const orbs = (L) => [...(L.orbs || []).map((o) => o.type), ...(L.portals || []).flatMap((p) => p.emit || [])];
const hasOrb = (...t) => (L) => orbs(L).some((o) => t.includes(o));
const list = (x) => (Array.isArray(x) ? x : x ? [x] : []);

// [name, test, exempt from the reuse rule]
const MECHANICS = [
  ['gears', anyRing((r) => r.gear != null)],
  ['gear train (3+)', anyRing((r, i, a) => r.gear != null && a[r.gear]?.gear != null)],
  ['gate doors', anyGap((g) => g.shut)],
  ['thorn curtain', anyGap((g) => g.curtain)],
  ['portals', (L) => (L.portals || []).length > 0],
  ['one-way rings', anyRing((r) => r.oneway)],
  ['blunt spikes', anyRing((r) => (r.thorns || []).some((t) => t.kind === 'blunt'))],
  ['ceiling thorns', anyRing((r) => (r.thorns || []).some((t) => t.side === 'out'))],
  ['retracting thorns', anyRing((r) => r.retract)],
  ['motor rings', anyRing((r) => r.motor)],
  ['solid ring', anyRing((r) => !(r.gaps || []).length)],
  ['wooden walls', (L) => (L.barriers || []).length > 0],
  ['grates', anyGap((g) => g.grate)],
  ['honey', anyRing((r) => (r.honey || []).length)],
  ['ice rings', anyRing((r) => r.mat === 'ice')],
  ['glass rings', (L) => L.material === 'glass' || rings(L).some((r) => r.mat === 'glass')],
  ['cloud rings', anyRing((r) => r.mat === 'cloud')],
  ['moving nest', (L) => !!(L.nest && (L.nest.amp || L.nest.pattern))],
  ['snake', (L) => list(L.snake).length > 0],
  ['two snakes', (L) => list(L.snake).length > 1],
  ['fox thrower', (L) => !!L.fox],
  ['eagle', (L) => !!L.eagle],
  ['salamander', (L) => list(L.salamander).length > 0],
  ['icicles', (L) => !!L.icicles || L.bossFight?.kind === 'blizzard'],
  ['lava rocks', (L) => !!(L.lava && L.lava.every)],
  ['gusts', (L) => !!L.gusts],
  ['lightning', (L) => L.weather === 'thunder'],
  ['quake', (L) => L.weather === 'quake'],
  ['current', (L) => L.weather === 'current'],
  ['quail egg', (L) => (L.eggKinds || []).includes('quail')],
  ['ostrich egg', (L) => (L.eggKinds || []).includes('ostrich')],
  ['duck egg', (L) => (L.eggKinds || []).includes('duck')],
  ['chick (sun flame)', hasOrb('fire_gold')],
  ['red flame', hasOrb('fire_red')],
  ['green flame', hasOrb('fire_green')],
  ['black flame', hasOrb('fire_black')],
  ['rock skin', hasOrb('rockskin', 'stone')],
  ['water shell', hasOrb('water')],
  ['bubble', hasOrb('bubble')],
  ['twin', hasOrb('twin')],
  ['thunder orb', hasOrb('thunder')],
  ['magnet', hasOrb('magnet')],
  ['hourglass', hasOrb('hourglass')],
  ['feather', hasOrb('feather')],
  ['frost orb', hasOrb('frost')],
  ['glow chick', hasOrb('hatch_glow')],
  ['dash chick', hasOrb('hatch_dash')],
  ['swoop chick', hasOrb('hatch_swoop')],
  ['bulk chick', hasOrb('hatch_bulk')],
  ['pick chick', hasOrb('hatch_pick')],
  ['hard ice', anyRing((r) => r.ice)],
  ['fox curse', (L) => orbs(L).includes('foxcurse') || [L.fox?.throws, L.bossFight?.throws].flat().includes('foxcurse')],
];

const REUSE = 3;
const rows = MECHANICS.map(([name, test]) => {
  const ids = LEVELS.filter((L) => { try { return !!test(L); } catch { return false; } }).map((L) => L.id);
  return { name, ids, first: ids[0], later: ids.length - 1 };
});

// a level that introduces more than two mechanics at once teaches none of them well
const firsts = new Map();
for (const r of rows) if (r.first) firsts.set(r.first, [...(firsts.get(r.first) || []), r.name]);

if (process.argv.includes('--matrix')) {
  const pad = Math.max(...rows.map((r) => r.name.length));
  console.log(' '.repeat(pad) + ' ' + LEVELS.map((L) => String(L.id % 10)).join(''));
  for (const r of rows) console.log(r.name.padEnd(pad) + ' ' + LEVELS.map((L) => (L.id === r.first ? 'T' : r.ids.includes(L.id) ? '#' : '.')).join(''));
  console.log();
}

let bad = 0;
for (const r of rows) {
  const ok = r.ids.length === 0 || r.later >= REUSE;
  if (!ok) bad++;
  console.log(`${ok ? '  ok ' : 'FAIL '} ${r.name.padEnd(20)} taught L${r.first ?? '-'}, reused ${r.later}x${r.ids.length ? ` (L${r.ids.join(' L')})` : ' (never used)'}`);
}
for (const [id, names] of [...firsts].sort((a, b) => a[0] - b[0])) if (id > 1 && names.length > 2) console.log(`WARN  L${id} introduces ${names.length} things at once: ${names.join(', ')}`);
console.log(bad ? `\n${bad} mechanic(s) are reused fewer than ${REUSE} times after they are taught.` : `\nEvery mechanic is reused at least ${REUSE} times.`);
process.exit(bad ? 1 : 0);
