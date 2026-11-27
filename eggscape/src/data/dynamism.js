// THE VILLAIN DYNAMISM TABLE (0.8.19). One row per villain kind: how it moves, how long it waits, how long it warns,
// how fast it snatches, how hard it follows. Every villain sim reads its temper from here (dynOf below), and a level
// constructor reads `threat` to budget a level. docs/dynamism.md says each field, each row and how threat adds up.
//
// The owner (0.8.19): "Raccoons and other villains are not aggressive enough ... They are moving way too slow. We are not
// putting urgency in the user's mind." The pressure is the villain, never the clock: no field here touches level time.
//
// Fields (multipliers on the sim's own MEDIUM numbers, so 1 = the 0.8.18 Medium temper):
//   tempo  travel speed while it has a target (and the speed of its moves: a crank, a crossing, a hop)
//   rest   idle time between two actions while a target exists (lower = meaner)
//   tell   the visible warning before a move that can cost an egg; never under TELL_MIN seconds (fairness; a tell that
//          was already shorter, a lunge's flight, keeps its own length)
//   snatch from "egg in reach" to "egg taken" (the player's window)
//   chase  0..1 how hard it re-targets and follows when the player moves the egg away (1 = at once, across rings,
//          0 = never leaves its spot)
//   threat 1..10 the pressure it puts on a level (set by hand; checked by the hardness tables)
//   moves  what it can do (docs/dynamism.md: one line each)
// DYN_MODE scales tempo, rest, tell, snatch and chase per mode (Easy softer, never sleepy), and sets the menace engine's
// attack tokens (costly moves at once in a level) and breather (s of no new costly move after a loss): sim/menace.js.
// The pure speed-ups here are moderate on purpose (the owner: too much hardness and the player quits): the pressure is
// paced by sim/menace.js (heat from the level's progress, tokens, the breather, answers to the player's ring turns). A level may carry
// `dyn: { raccoon: { tempo: 1.2 } }`: those fields replace the row's before the mode is applied.
// No randomness: the result is a pure function of (kind, mode, level), so sims stay deterministic and the planner exact.
export const TELL_MIN = 0.45; // s

export const DYN = {
  // --- den and yard villains (aggroA)
  raccoon: { tempo: 1.25, rest: 0.6, tell: 0.7, snatch: 0.8, chase: 1, threat: 6, moves: ['sneak', 'climb', 'crank', 'reach', 'grab', 'shift', 'hop', 'whistle', 'catch', 'standoff'] },
  weasel: { tempo: 1.25, rest: 0.7, tell: 0.75, snatch: 0.8, chase: 1, threat: 5, moves: ['prowl', 'dart', 'stalk', 'lunge', 'pounce', 'carry', 'stash', 'standoff'] },
  rat: { tempo: 1.15, rest: 0.75, tell: 0.8, snatch: 0.85, chase: 0.8, threat: 3, moves: ['scurry', 'brace', 'roll', 'stash', 'squabble'] },
  kits: { tempo: 1.3, rest: 0.7, tell: 0.8, snatch: 0.8, chase: 1, threat: 4, moves: ['pop', 'scamper', 'climb', 'cross', 'lift', 'carry', 'lookout'] },
  monkey: { tempo: 1.08, rest: 0.85, tell: 0.85, snatch: 0.85, chase: 0.6, threat: 4, moves: ['swing', 'aim', 'snatch', 'ride', 'peel'] },
  penguin: { tempo: 1.08, rest: 0.85, tell: 1, snatch: 0.85, chase: 0.6, threat: 3, moves: ['waddle', 'windup', 'slide', 'tuck', 'shove'] },
  urchin: { tempo: 1, rest: 1, tell: 1, snatch: 1, chase: 0.5, threat: 3, moves: ['puff', 'roll', 'dash', 'nap'] },
  crab: { tempo: 1.05, rest: 0.9, tell: 0.9, snatch: 0.9, chase: 0.7, threat: 6, moves: ['reach', 'snap', 'pull', 'bubble', 'whirl', 'bar'] },
  owl: { tempo: 1, rest: 1, tell: 0.9, snatch: 1, chase: 0, threat: 6, moves: ['wind', 'grab', 'gearbomb'] },
};

export const DYN_MODE = {
  easy: { tempo: 0.85, rest: 1.35, tell: 1.35, snatch: 1.3, chase: 0.8, tokens: 1, breather: 5 },
  medium: { tokens: 1, breather: 3.5 },
  hard: { tempo: 1.12, rest: 0.85, tell: 0.85, snatch: 0.9, chase: 1, tokens: 2, breather: 2.5 },
};
const ONE = { tempo: 1, rest: 1, tell: 1, snatch: 1, chase: 1, threat: 1, moves: [] };
const SCALED = ['tempo', 'rest', 'tell', 'snatch', 'chase'];

// the temper of kind on mode, with a level's own overrides (over = level.dyn?.[kind])
export function dyn(kind, mode = 'medium', over) {
  const row = { ...ONE, ...(DYN[kind] || {}), ...(over || {}) }, m = DYN_MODE[mode] || {};
  for (const k of SCALED) row[k] *= m[k] ?? 1;
  row.chase = Math.min(1, Math.max(0, row.chase));
  return row;
}
// the sim's cached temper for kind (a pure function of level and mode, so it is not part of the sim's saved state)
export function dynOf(sim, kind) {
  const c = sim._dyn || (sim._dyn = {});
  return c[kind] || (c[kind] = dyn(kind, sim.mode || 'medium', sim.level && sim.level.dyn && sim.level.dyn[kind]));
}
// the row without the mode, for a sim whose own tables are already per mode (monkey, penguin, urchin, crab: their m3
// tables stay the mode's say, the row is the temper on top)
export function dynRowOf(sim, kind) {
  const c = sim._dynRow || (sim._dynRow = {});
  return c[kind] || (c[kind] = dyn(kind, 'medium', sim.level && sim.level.dyn && sim.level.dyn[kind]));
}
// a telegraph of base seconds under factor f: never under TELL_MIN (one that was already shorter keeps its length)
export const tellS = (base, f) => Math.max(Math.min(base, TELL_MIN), base * f);
