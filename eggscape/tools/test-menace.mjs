// The menace engine (0.8.19, sim/menace.js): node tools/test-menace.mjs (exits 1 on a failure). No browser. Checks the
// heat (opening, glide, finale for a cruising run, no rise on the edge), the attack tokens (per mode, a level's override,
// a boss's own), the breather after a loss, the player's ring turns, the margin's near misses and longer telegraphs, the
// three finale styles, the saved state (rewind, the planner) and determinism, and the budget a constructor checks.
import { Sim, DT } from '../src/sim/sim.js';
import { LEVELS } from '../src/data/levels.js';
import { HEAT, MARGIN, AMBUSH, menaceBudget, menaceStyleFor } from '../src/sim/menace.js';
import { DYN_MODE } from '../src/data/dynamism.js';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const L = (id) => LEVELS.find((l) => l.id === id);
const steps = (sim, secs, each) => { for (let i = 0, n = Math.round(secs / DT); i < n && sim.state === 'play'; i++) { sim.step(); if (each) each(sim); } };

// ---------- the heat: the opening, a glide, the finale
{
  const sim = new Sim(L(22), { mode: 'medium' });
  ok(Math.abs(sim.menaceHeat() - HEAT.open) < 1e-9, `the opening: heat ${HEAT.open} (they stalk, look, position)`);
  let jump = 0, prev = sim.menaceHeat();
  steps(sim, 20, (s) => { jump = Math.max(jump, Math.abs(s.menaceHeat() - prev)); prev = s.menaceHeat(); });
  ok(jump < 0.01, `the heat glides (largest change in one step ${jump.toFixed(4)})`);
  ok(sim.menaceHeat() >= HEAT.open - 1e-9 && sim.menaceHeat() <= HEAT.top + 1e-9, `never under ${HEAT.open}, never over ${HEAT.top} (${sim.menaceHeat().toFixed(3)})`);
  // a cruising finale: the rush (or the ambush on every third level)
  const c = new Sim(L(22), { mode: 'medium' });
  c.mn.fin = 1; steps(c, 8);
  ok(!c.mn.edge && c.mn.style === menaceStyleFor(c.level, 0) && c.menaceHeat() > 1.2, `a cruising run's finale: '${c.mn.style}', heat climbs to ${c.menaceHeat().toFixed(2)}`);
  ok(c.menaceNear() === 1 && c.menaceTell() === 1, 'a cruising run gets real takes and plain telegraphs');
  // on the edge (an egg lost moments ago): no rise, near misses, longer telegraphs, the shadow
  const e = new Sim(L(22), { mode: 'medium' });
  e.eggs[0].alive = false; steps(e, 0.1); e.mn.fin = 1; steps(e, 8);
  ok(e.mn.edge === 1 && e.mn.style === 'shadow' && e.menaceHeat() <= HEAT.mid + 1e-9, `a run on the edge: '${e.mn.style}', the heat does not rise (${e.menaceHeat().toFixed(2)})`);
  ok(e.menaceNear() === MARGIN.near && e.menaceTell() === MARGIN.tell, `on the edge: near misses (reach x ${MARGIN.near}) and telegraphs x ${MARGIN.tell}`);
}

// ---------- attack tokens
{
  const tok = (mode, lv = L(40)) => { const s = new Sim(lv, { mode }); s.mn.heat = 1; let n = 0; for (const id of ['a', 'b', 'c']) if (s.menaceMay(id, 'grab')) n++; return { s, n }; };
  ok(tok('easy').n === 1 && tok('medium').n === 1 && tok('hard').n === 2, `costly moves at once: Easy ${tok('easy').n}, Medium ${tok('medium').n}, Hard ${tok('hard').n}`);
  ok(tok('medium', { ...L(40), dyn: { tokens: 3 } }).n === 3, 'a level\'s dyn.tokens overrides the mode');
  const { s } = tok('medium');
  ok(s.menaceMay('a', 'grab') && !s.menaceMay('b', 'grab'), 'the holder may go on; another is refused');
  s.menaceDone('a', 'grab', 0);
  ok(s.menaceMay('b', 'grab'), 'the move over, the token passes on');
  ok(s.menaceMay('boss', 'reach', true), 'a boss holds its own token');
  const t = new Sim(L(40), { mode: 'medium' }); t.menaceMay('x', 'grab'); steps(t, 16);
  ok(!t.menaceHolds('x'), 'a forgotten token lapses');
}

// ---------- the breather after a loss
for (const mode of ['easy', 'medium', 'hard']) {
  const s = new Sim(L(40), { mode });
  steps(s, 1);
  s.eggs[0].alive = false; // broken
  steps(s, 0.05);
  const br = DYN_MODE[mode].breather;
  ok(!s.menaceMay('a', 'grab') && !s.menaceMay('boss', 'reach', true), `${mode}: an egg lost: no new costly move (bosses too)`);
  steps(s, br - 0.3);
  ok(!s.menaceMay('a', 'grab'), `${mode}: still none ${(br - 0.25).toFixed(2)} s on`);
  steps(s, 0.4);
  ok(s.menaceMay('a', 'grab') && s.mn.cool > 0, `${mode}: after the breather (${br} s) moves may start again; the heat is a step down for a while`);
}

// ---------- the player's ring turns
{
  const s = new Sim(L(22), { mode: 'medium' }), r = s.rings[1];
  steps(s, 0.5);
  ok(!s.menaceTurned(1), 'no turn seen before the player turns');
  r.target += 1.2; steps(s, 0.4);
  const T = s.menaceTurned(1);
  ok(T && T.dir === 1 && T.ago < 0.2, `the player's turn of ring 1 is seen (way ${T && T.dir})`);
  steps(s, 2.5);
  ok(!s.menaceTurned(1), 'and forgotten a while after');
  for (let k = 0; k < 6; k++) { r.target += k % 2 ? -0.8 : 0.8; steps(s, 0.35); }
  ok(s.mn.flips > MARGIN.flips, `frantic back-and-forth turning is seen (${s.mn.flips.toFixed(1)} reversals)`);
}

// ---------- the ambush: quiet, then ONE clearly telegraphed strike
{
  const s = new Sim(L(21), { mode: 'medium' }); // 21 % 3 === 0
  s.mn.fin = 1; steps(s, 0.05);
  ok(s.mn.style === 'ambush' && !s.menaceMay('a', 'grab'), `level 21 cruising: the ambush goes quiet (style ${s.mn.style})`);
  steps(s, AMBUSH.quiet);
  ok(s.menaceMay('a', 'grab') && s.menaceTell() === AMBUSH.tell && !s.menaceMay('b', 'grab'), `then ONE strike, its telegraph x ${AMBUSH.tell}`);
  s.menaceDone('a', 'grab', 0);
  ok(s.menaceTell() === 1 && s.mn.amb === 3, 'the strike over: the plain middle');
}

// ---------- the saved state and determinism
{
  const a = new Sim(L(40), { mode: 'medium' });
  steps(a, 12); a.menaceMay('q', 'grab');
  const b = Sim.fromState(a.level, a.fullState(), { mode: 'medium' });
  ok(JSON.stringify(a.mn) === JSON.stringify(b.mn), 'the engine is in the saved state (rewind, the planner)');
  steps(a, 6); steps(b, 6);
  ok(JSON.stringify(a.mn) === JSON.stringify(b.mn), 'a restored run carries on exactly');
  const c = new Sim(L(40), { mode: 'medium' }), d = new Sim(L(40), { mode: 'medium' });
  steps(c, 20); steps(d, 20);
  ok(JSON.stringify(c.mn) === JSON.stringify(d.mn), 'deterministic');
}

// ---------- the budget a level constructor checks
{
  const all = LEVELS.map((lv) => menaceBudget(lv, 'medium'));
  ok(all.every((b) => b.budget > 0 && b.load >= 0 && Number.isFinite(b.ratio)), `every level has a budget and a load (${all.length} levels)`);
  const b6 = menaceBudget(L(6), 'medium');
  ok(b6.list.some((v) => v.kind === 'raccoon') && b6.load > 0, `level 6: ${b6.list.map((v) => v.kind + 'x' + v.n).join(' ')} load ${b6.load} / budget ${b6.budget}`);
  ok(menaceBudget(L(40), 'easy').load < menaceBudget(L(40), 'medium').load && menaceBudget(L(40), 'medium').load < menaceBudget(L(40), 'hard').load, 'the same villains weigh less on Easy, more on Hard');
  ok(menaceBudget({ id: 70, raccoon: { delay: 3 }, kits: { delay: 8 } }).load === 10, 'a new level from two villains: raccoon + kits = 6 + 4');
}

console.log(bad ? `\n${bad} FAILED` : '\nall menace checks passed');
process.exit(bad ? 1 : 0);
