// Softlock hunt: random play on levels with 2+ creatures; flags a creature stuck in one busy phase too long, an egg held
// by a creature too long, or a level where nothing (no egg, no creature) moved for 25 s while still in play.
// Usage: node tools/softlock.mjs [ids] [--secs 120] [--seeds 4]
import { Sim, DT } from '../src/sim/sim.js';
import { LEVELS } from '../src/data/levels.js';
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? +args[i + 1] : d; };
const SECS = opt('--secs', 120), SEEDS = opt('--seeds', 4);
const lists = (s) => {
  const o = [];
  const add = (name, arr) => (arr || []).forEach((c, i) => o.push([name + i, c]));
  add('sal', s.sals); add('th', s.thieves); add('ga', s.gators); add('tu', s.turtles); add('mq', s.mosqs); add('fr', s.frogs); add('oc', s.octos);
  add('he', s.hermits); add('pu', s.puffs); add('je', s.jellies); add('sn', s.snakes);
  if (s.cw) { add('sp', s.cw.sp); add('bt', s.cw.bt); add('jk', s.cw.jk); }
  return o;
};
const IDLE = new Set(['wait', 'gone', 'hid', 'log', 'walk', 'crawl', 'roam', 'idle', 'away', 'float', 'hide', 'patrol', 'sit', 'swim', 'home', 'beaten', 'out', 'den', 'lurk', 'stalk', 'in', 'school', 'sleep', 'rest', 'crawlback']);
const ids = args[0] && !args[0].startsWith('--') ? args[0].split(',').map(Number) : LEVELS.map((l) => l.id);
let found = 0;
for (const id of ids) {
  const L = LEVELS.find((l) => l.id === id);
  for (const mode of ['easy', 'medium', 'hard']) for (let seed = 1; seed <= SEEDS; seed++) {
    let r = seed * 7771 + id * 31337;
    const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const sim = new Sim(L, { mode });
    const cs = lists(sim);
    if (cs.length < 2 && !process.env.ALL) break;
    const ph = new Map(), since = new Map(), held = new Map();
    let ring = 0, until = 0, dir = 1, lastMove = 0, prev = null, why = '';
    for (let s = 0; s < SECS / DT && sim.state === 'play'; s++) {
      if (sim.t >= until) { ring = Math.floor(rnd() * sim.rings.length); dir = rnd() < 0.5 ? -1 : 1; until = sim.t + 0.4 + rnd() * 2; if (rnd() < 0.25) ring = -1; }
      for (const rg of sim.rings) if (!rg.motor) rg.target = rg.body.getAngle();
      if (ring >= 0 && !sim.rings[ring].motor) sim.rings[ring].target = sim.rings[ring].body.getAngle() + 0.5 * dir;
      sim.step(); sim.events.length = 0;
      if (s % 60) continue;
      for (const [k, c] of lists(sim)) {
        const p = c.ph ?? c.phase;
        if (p !== ph.get(k)) { ph.set(k, p); since.set(k, sim.t); }
        else if (p && !IDLE.has(p) && sim.t - since.get(k) > 20) { why = `${k} stuck in '${p}' ${(sim.t - since.get(k)).toFixed(0)}s`; break; }
      }
      for (const e of sim.aliveEggs()) {
        const h = e.clamp > 0 || e.thf || e.octo || e.held;
        if (!h) { held.delete(e.id); continue; }
        if (!held.has(e.id)) held.set(e.id, sim.t);
        else if (sim.t - held.get(e.id) > 25) { why = `egg ${e.id} held ${(sim.t - held.get(e.id)).toFixed(0)}s (clamp=${e.clamp} thf=${!!e.thf} octo=${!!e.octo})`; break; }
      }
      const pos = sim.aliveEggs().map((e) => { const p = e.body.getPosition(); return [p.x, p.y]; });
      if (prev && pos.length === prev.length && pos.some((p, i) => Math.hypot(p[0] - prev[i][0], p[1] - prev[i][1]) > 0.05)) lastMove = sim.t;
      else if (prev && pos.length !== prev.length) lastMove = sim.t;
      prev = pos;
      if (sim.t - lastMove > 25) why = 'no egg moved for 25 s';
      if (why) break;
    }
    if (why && process.env.DIAG) for (const e of sim.aliveEggs()) { const p = e.body.getPosition(), v = e.body.getLinearVelocity(); console.log(`   egg ${e.id} p=(${p.x.toFixed(2)},${p.y.toFixed(2)}) r=${Math.hypot(p.x, p.y).toFixed(2)} ch=${sim.channelOf ? sim.channelOf(e) : '?'} v=${Math.hypot(v.x, v.y).toFixed(3)} awake=${e.body.isAwake()} flags=${['clamp', 'thf', 'octo', 'held', 'stone', 'iron', 'frozen', 'stuck', 'saved', 'inNest'].filter((k) => e[k]).join(',')}`); }
    if (why) { found++; console.log(`L${id} ${mode} seed${seed} t=${sim.t.toFixed(1)}: ${why} | creatures ${lists(sim).map(([k, c]) => k + ':' + (c.ph ?? c.phase)).join(' ')}`); }
  }
}
console.log('softlock hunt done:', found);
