// THE MENACE ENGINE (0.8.19): one deterministic director every villain obeys, so any mix of villains stays fair and a
// level can be built from a list of villains plus a budget. Mixed into Sim (sim.js: Object.assign(Sim.prototype,
// menaceMethods)), so `this` is the Sim. All state is plain data in this.mn, copied by menaceState() / menaceLoad(), so
// rewind, the planner and the hint stay exact. No randomness.
//
// The owner (0.8.19): "If we put too much hardness or too much aggressiveness in their moves ... the game is going to end
// too soon and the user will get frustrated and quit ... The dynamism should depend upon the way they move the rings and
// the way the level progresses ... replicated across multiple levels, even beyond level 60."
//
//   HEAT (menaceHeat): a tempo / rest factor from the level's PROGRESS. OPENING (no egg has gone 15 % of its way out yet):
//     about 0.8, they stalk, look and position; MIDDLE: 1; FINALE (the last egg needed for the target is out on its way,
//     or the last third of the level's time): about 1.2. It glides (HEAT.tau), never jumps. After a loss it drops a step
//     (HEAT.cool) for HEAT.coolT s. Villains multiply their travel speed by it and divide their rests by it (never their
//     telegraphs: those stay fair).
//   MARGIN (0.8.19, the owner: "not just one blunt rule of pushing harder ... it also depends on how the user moves"): the
//     heat also reads how the run stands: spare (eggs still alive and free minus eggs still needed), recent (a loss in the
//     last MARGIN.recent s), pace (a timed level: the time left against the way still to go), hands (the player's turns
//     lately: calm, or frantic back-and-forth). CRUISING (spare >= 1, nothing lost lately, on pace, calm hands): the heat
//     may climb to HEAT.top (the rush). ON THE EDGE (any of those not so): at the finish it eases to HEAT.edge instead,
//     the telegraphs get MARGIN.tell longer (menaceTell) and the villains play NEAR MISSES (menaceNear): their take's reach
//     closes to MARGIN.near of itself, so an egg the player keeps moving stays out of it (a real rule, not a fake).
//     Never under HEAT.open, never over HEAT.top, always gliding.
//   FINALE STYLE (mn.style, picked once when the finale starts, from the state and the level id): 'rush' (cruising: every
//     villain presses, turn taking still holds), 'ambush' (cruising, every third level: AMBUSH.quiet s of quiet, then ONE
//     big strike with an AMBUSH.tell longer telegraph, then the plain middle), 'shadow' (on the edge: near misses, one
//     villain at a time). menaceStyleFor(level, edge) is the same pick as a pure function (the report, a constructor).
//   ATTACK TOKENS (menaceMay / menaceDone): a move that can cost an egg (a reach, a pounce, a lift, a brace to roll) may only
//     START with a token; at most DYN_MODE[mode].tokens run at once (Easy 1, Medium 1, Hard 2; a level's dyn.tokens
//     overrides). A villain refused keeps stalking and positioning (it creeps, circles, eyes the egg), it never freezes.
//     A boss holds its own token (not counted). A token is handed back when the move is over (menaceDone, or the villain's
//     own release), and a forgotten one lapses after MN.stale s.
//   THE BREATHER: an egg taken, eaten or broken: no new costly move may start for DYN_MODE[mode].breather s (Easy 5,
//     Medium 3.5, Hard 2.5), bosses included, and the heat drops a step. One loss never snowballs into three.
//   RING REACTIONS (menaceTurned): the player's last turn of each ring (its way and when), so a villain can answer the
//     player's move: brace, hop off, go round the other way, switch egg.
//   BUDGET (menaceBudget, exported): the sum of the level's villains' threat (DYN) times their count, scaled by the mode,
//     against the level's budget number; what a level constructor checks: "these villains, this budget, this mode".
import { DYN, DYN_MODE } from '../data/dynamism.js';

export const HEAT = { open: 0.8, mid: 1, fin: 1.2, top: 1.25, edge: 0.9, edgeMid: 0.95, way: 0.15, late: 2 / 3, tau: 1.5, cool: 0.2, coolT: 8 };
export const MN = { stale: 15, turnT: 1.2 };
// the margin: a loss this recent (s) counts; behind the clock: time left / time under the way still to go x pace; frantic:
// this many reversals of a ring's turning (leaky, tau s); on the edge telegraphs x tell, takes reach x near
export const MARGIN = { recent: 20, pace: 0.6, flips: 3, tau: 4, tell: 1.15, near: 0.7 };
export const AMBUSH = { quiet: 4, tell: 1.3, every: 3 };
// the finale's style for a level and a run (edge: the run is on the edge when the finale starts)
export const menaceStyleFor = (L, edge) => (edge ? 'shadow' : (L.id || 0) % AMBUSH.every === 0 ? 'ambush' : 'rush');

export const menaceMethods = {
  menaceInit() {
    this.mn = { heat: HEAT.open, br: 0, cool: 0, lost: 0, tok: {}, turn: {}, losses: [], flips: 0, edge: 0, fin: 0, style: '', st: 0, amb: 0 };
  },
  menaceTokens() { const d = this.level && this.level.dyn; return (d && d.tokens) || (DYN_MODE[this.mode] || DYN_MODE.medium).tokens || 1; },
  // ---------- every sim step (sim.js predStep, before the villains)
  menaceStep(dt) {
    const M = this.mn;
    if (!M || this.state !== 'play') return;
    if (M.br > 0) M.br = Math.max(0, M.br - dt);
    if (M.cool > 0) M.cool = Math.max(0, M.cool - dt);
    // a loss: an egg taken (in a paw, a sack, a den, jaws) or broken
    let lost = 0;
    for (const e of this.eggs) if ((!e.alive && !e.saved) || (e.alive && (e.hc || e.thf))) lost++;
    if (lost > M.lost) { M.br = (DYN_MODE[this.mode] || DYN_MODE.medium).breather; M.cool = HEAT.coolT; M.losses.push(+this.t.toFixed(3)); if (M.losses.length > 8) M.losses.shift(); }
    M.lost = lost;
    for (const id in M.tok) if (this.t - M.tok[id].t > MN.stale) delete M.tok[id];
    M.flips *= Math.exp(-dt / MARGIN.tau);
    M.edge = this.menaceEdge() ? 1 : 0;
    const raw = this.menaceHeatRaw();
    if (M.fin && !M.style) { M.style = menaceStyleFor(this.level, M.edge); M.st = +this.t.toFixed(4); M.amb = M.style === 'ambush' ? 1 : 0; }
    M.heat += (raw - M.heat) * (1 - Math.exp(-dt / HEAT.tau));
    M.heat = Math.min(HEAT.top, Math.max(HEAT.open, M.heat));
  },
  // the run's margin: on the edge when no egg is spare, a loss is recent, the clock is ahead of the eggs, or the hands are frantic
  menaceEdge() {
    const M = this.mn, need = Math.max(0, (this.level.target || 1) - this.savedLog.length);
    const free = this.aliveEggs().filter((e) => !e.saved && !e.hc && !e.thf).length;
    if (free - need < 1) return true;
    if (M.losses.length && this.t - M.losses[M.losses.length - 1] < MARGIN.recent) return true;
    if (M.flips > MARGIN.flips) return true;
    const T = this.level.time || 0;
    if (T > 0 && need > 0) {
      const n = this.rings.length, eggs = this.aliveEggs().filter((e) => !e.saved && !e.hc && !e.thf);
      const way = eggs.length ? eggs.reduce((a, e) => a + Math.min(1, (this.channelOf(e) + 0.5) / (n + 1)), 0) / eggs.length : 1;
      if ((T - this.t) / T < (1 - way) * MARGIN.pace) return true;
    }
    return false;
  },
  // the level's progress: opening, middle, finale (minus a step while the last loss is fresh)
  menaceHeatRaw() {
    const M = this.mn, n = this.rings.length, saved = this.savedLog.length, need = (this.level.target || 1) - saved;
    let way = saved ? 1 : 0;
    for (const e of this.aliveEggs()) if (!e.hc && !e.thf) way = Math.max(way, Math.min(1, (this.channelOf(e) + 0.5) / (n + 1)));
    const T = this.level.time || 0;
    let h = M.edge ? HEAT.edgeMid : HEAT.mid;
    if (way < HEAT.way && saved === 0 && !M.fin) h = HEAT.open;
    else if (M.fin || (need <= 1 && (this.level.target || 1) > 1 && saved > 0) || (T > 0 && this.t > T * HEAT.late)) {
      M.fin = 1;
      h = M.edge ? HEAT.edge : M.style === 'ambush' ? HEAT.mid : HEAT.top; // the rush only for a cruising run
    }
    return Math.max(HEAT.open, h - (M.cool > 0 ? HEAT.cool : 0));
  },
  // a telegraph's factor (>= 1): longer on the edge; the ambush's one strike longer still
  menaceTell() { const M = this.mn; if (!M) return 1; return M.amb === 2 ? AMBUSH.tell : M.edge && M.fin ? MARGIN.tell : 1; },
  // near misses: on the edge at the finish (the shadow), a take's reach closes to MARGIN.near of itself
  menaceNear() { const M = this.mn; return M && M.fin && (M.edge || M.style === 'shadow') ? MARGIN.near : 1; },
  menaceStyle() { return this.mn ? this.mn.style : ''; },
  menaceHeat() { return this.mn ? this.mn.heat : 1; },
  // may villain id START a costly move now? (boss: it holds its own token; the breather still holds it back)
  menaceMay(id, move, boss = false) {
    const M = this.mn;
    if (!M) return true;
    if (M.br > 0) return false;
    if (M.amb === 1) { if (this.t - M.st < AMBUSH.quiet) return false; M.amb = 2; } // the ambush: quiet, then the ONE strike
    if (M.style === 'shadow' || M.amb === 2) boss = false; // the shadow and the strike: one villain at a time, bosses too
    const k = String(id);
    if (M.tok[k]) { M.tok[k].move = move; return true; }
    if (!boss) { let used = 0; for (const q in M.tok) if (!M.tok[q].boss) used++; if (used >= this.menaceTokens()) return false; }
    M.tok[k] = { move, t: +this.t.toFixed(4), boss: boss ? 1 : 0 };
    return true;
  },
  // the move is over (tookEgg: it cost an egg: the breather starts now, the step will see the same loss)
  menaceDone(id, move, tookEgg) {
    const M = this.mn;
    if (!M) return;
    delete M.tok[String(id)];
    if (M.amb === 2) M.amb = 3; // the strike is over: the plain middle from here
    if (tookEgg && !(M.br > 0)) { M.br = (DYN_MODE[this.mode] || DYN_MODE.medium).breather; M.cool = HEAT.coolT; }
  },
  menaceHolds(id) { return !!(this.mn && this.mn.tok[String(id)]); },
  // sim.js step, for every ring the PLAYER turns (a villain's own slow crank stays under the moving speed)
  menaceTurnSeen(ring) {
    const M = this.mn;
    if (!M) return;
    const dir = ring.omega > 0 ? 1 : -1, o = M.turn[ring.i];
    if (o && o.dir !== dir && this.t - o.t < 1.0) M.flips += 1; // back and forth: frantic hands
    M.turn[ring.i] = { dir, t: +this.t.toFixed(4) };
  },
  // the player's last turn of ring ri within MN.turnT s: { dir (+1 counter-clockwise), ago (s) }, else null
  menaceTurned(ri, within = MN.turnT) {
    const T = this.mn && this.mn.turn[ri];
    return T && this.t - T.t <= within ? { dir: T.dir, ago: this.t - T.t } : null;
  },
  menaceState() { return this.mn ? JSON.parse(JSON.stringify(this.mn)) : null; },
  menaceLoad(S) { if (S) this.mn = JSON.parse(JSON.stringify(S)); },
};

// ---------- the budget a level constructor checks (pure: a level object, a mode)
// what a level brings: [kind, count]; kinds without a DYN row count DEF_THREAT each
const DEF_THREAT = 3;
export function menaceVillains(L) {
  const out = [], F = L.bossFight || {}, add = (k, n = 1) => { if (n > 0) out.push([k, n]); };
  if (L.raccoon) add('raccoon');
  if (L.weasel) add('weasel', L.weasel.delay >= 999 ? 0.5 : 1); // a whistled weasel (L6) counts half
  if (F.kind === 'weasel') add('weasel');
  if (L.rats) add('rat', L.rats.delay >= 999 ? 0 : L.rats.n || 2);
  if (F.kind === 'ratking') add('ratking');
  if (L.kits) add('kits');
  if (L.monkey) add('monkey');
  if (L.penguin) add('penguin');
  if (L.urchin) add('urchin', Array.isArray(L.urchin) ? L.urchin.length : 1);
  if (F.kind === 'kingcrab') add('crab');
  if (F.kind === 'owl') add('owl');
  for (const k of ['snake', 'salamander', 'frog', 'chameleon', 'thornback', 'eagle', 'octopus', 'gator', 'golem', 'blizzard']) {
    const v = L[k] || (F.kind === k ? F : null);
    if (v) add(k, Array.isArray(v) ? v.length : v.n || 1);
  }
  if (L.snakes) add('snake', L.snakes.length || 1);
  return out;
}
// the level's budget number: its own (level.budget) or one that grows along the road (about 4 at level 1, 10 at 60)
export const budgetOf = (L) => L.budget ?? +(4 + (Math.max(1, L.id || 1) - 1) * 0.1).toFixed(1);
// { load, budget, ratio, list }: load = sum of threat x count x the mode's pressure (tempo / rest of DYN_MODE)
export function menaceBudget(L, mode = 'medium') {
  const m = DYN_MODE[mode] || {}, k = (m.tempo ?? 1) / (m.rest ?? 1);
  const list = menaceVillains(L).map(([kind, n]) => ({ kind, n, threat: (DYN[kind] && DYN[kind].threat) || DEF_THREAT }));
  const load = +(list.reduce((a, v) => a + v.threat * v.n, 0) * k).toFixed(2), budget = budgetOf(L);
  return { load, budget, ratio: +(load / budget).toFixed(2), list };
}
