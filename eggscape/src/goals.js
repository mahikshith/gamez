// The star goals (2026-11-20, mykee: "the stars are always the same: save these eggs, lose none, no cracks. They should
// change with the levels and raise the bar, a different aim to reach"). Each level has three goals, one star each:
//   1  the level itself: bring the target number of eggs home (without it there are no stars)
//   2  the care goal: lose no eggs, or bring them home uncracked; from world 7 on, both at once
//   3  the mastery goal, different from level to level: the level's own challenge from its data (few ring turns, beat
//      a time, bring the speckled prize egg home, collect every orb). The turn and time numbers come from the planner's
//      own solution with a margin (tools/gen.mjs), so every goal has been reached by a machine before a player meets it.
// World 1 keeps the plain trio (home, lose none, no cracks) while the game is being learned; L1 counts eggs home, L4-L5
// add their own challenge (see levelGoals).
// A star is its goal: the three are judged on their own, so a run can earn the 3rd without the 2nd.
// Pure data in, data out: main.js draws them (level card, HUD stars, win card) and asks which are met.

import { PER_ENV } from './road.js';
const PER_WORLD = PER_ENV; // 0.8.17: six a world

// -> [g1, g2, g3]; g = { kind, n?, s?, short (the level card, a few words), long (the win card's row) }
// fuse: the mode's time factor (sim.MD.fuse); level < 0 or no level data: the plain trio
// mode 'easy' (0.8.17, mykee: "they could beat the level in easy mode, but the goals need to be high-target goals in order
// to earn 3 stars"): the level is passed as on Medium (the first star: the target home), but the second star asks for
// every egg (and no cracks where every egg is already the target), and the third for that AND the level's bonus goal.
// The card and the win page show these goals as they are; no banner says why. Medium and Hard are unchanged.
export function levelGoals(L, fuse = 1, campaign = true, mode = 'medium') {
  if (mode === 'easy' && campaign) { const g = easyGoals(L, fuse); if (g) return g; }
  const n = L.eggs || 1, t = L.target || 1;
  const home = { kind: 'home', n: t, short: t === n ? `All ${n} home` : `${t} of ${n} home`, long: t === n ? `All ${n} eggs home` : `${t} of ${n} eggs home` };
  const all = { kind: 'all', short: 'Lose none', long: 'Lose no eggs' };
  const clean = { kind: 'clean', short: 'No cracks', long: 'No cracked eggs' };
  const perfect = { kind: 'perfect', short: 'Flawless', long: 'No egg lost or cracked' };
  const id = L.id || 0, world = Math.floor((id - 1) / PER_WORLD), slot = (id - 1) % PER_WORLD;
  // the first five (2026-11-20): always the same kind of thing early. L1 counts eggs home (1, 2, all 3: it wins with
  // one), L2-L3 add the care goals, the level's own challenge only from L4 (never a time goal before it)
  if (campaign && id === 1 && t < n) {
    const k = (m) => ({ kind: 'home', n: m, short: m === n ? `All ${n} home` : m === 1 ? '1 egg home' : `${m} home`, long: m === n ? `All ${n} eggs home` : m === 1 ? '1 egg home' : `${m} eggs home` });
    return [k(t), ...[t + 1, n].filter((m, i, a) => m <= n && a.indexOf(m) === i).map(k), clean].slice(0, 3);
  }
  if (campaign && id >= 4 && world < 1 && t < n) { const g3 = bonusGoal(L, fuse); if (g3) return [home, all, g3]; }
  if (!campaign || id < 1 || world < 1) return [home, t === n ? clean : all, t === n ? (bonusGoal(L, fuse) || all) : clean]; // t === n with no bonus: 'Lose none' is its own star where a twin orb makes an extra egg (L3)
  const g3 = bonusGoal(L, fuse) || clean;
  let g2 = t === n ? clean : world >= 6 ? perfect : slot % 2 ? clean : all;
  if (g2.kind === g3.kind) g2 = all;
  return [home, g2, g3];
}
// Easy: [the target home, every egg (flawless where Medium asks for no cracks or every egg is the target), every egg AND the bonus goal]. Levels 1-3
// (they teach, and have no bonus goal) and any level without one keep the Medium goals.
export const EASY_FROM = 4;
function easyGoals(L, fuse) {
  const n = L.eggs || 1, t = L.target || 1, b = bonusGoal(L, fuse);
  if ((L.id || 0) < EASY_FROM || !b) return null;
  const home = { kind: 'home', n: t, short: t === n ? `All ${n} home` : `${t} of ${n} home`, long: t === n ? `All ${n} eggs home` : `${t} of ${n} eggs home` };
  // every egg; and never less than Medium's second star asks: where that is "No cracks", every egg AND no cracks
  const m2 = levelGoals(L, fuse, true, 'medium')[1].kind;
  const every = t === n || m2 !== 'all' ? { kind: 'perfect', short: 'Flawless', long: 'No egg lost or cracked' } : { kind: 'all', short: 'Lose none', long: 'Lose no eggs' };
  // (the card's row reads star by star: "Lose none", then "+ Under 96 s" on top of it; the win page says it whole, short)
  return [home, every, { kind: 'both', a: every, b, short: `+ ${b.short}`, long: `${every.short} + ${b.short}` }]; // the win page's row at its full size, as the card reads it: "Flawless + Under 96 s"
}
function bonusGoal(L, fuse) {
  const B = L.bonus;
  if (!B) return null;
  if (B.kind === 'turns' && B.n) return { kind: 'turns', n: B.n, short: `${B.n} turns max`, long: `${B.n} ring turns or fewer` };
  if (B.kind === 'time' && B.s) { const s = Math.round(B.s * fuse); return { kind: 'time', s, short: `Under ${s} s`, long: `Finish within ${s} s` }; }
  if (B.kind === 'prize') return { kind: 'prize', short: 'Speckled egg', long: 'Bring the speckled egg home' };
  if (B.kind === 'orbs') return { kind: 'orbs', short: 'Every orb', long: 'Collect every orb' };
  return null;
}

// what happened, from a sim (during play or after it)
export function facts(sim) {
  const st = sim.stats(), log = sim.savedLog || [];
  const used = sim.timeLimit ? Math.max(0, sim.timeLimit - Math.max(0, sim.timeLeft)) : sim.t;
  const prizeEgg = sim.eggs.find((e) => e.prize);
  return {
    won: sim.state === 'won', saved: st.saved, target: st.target, total: st.total, broken: st.broken,
    crackedHome: log.filter((q) => q.cracks > 0).length,
    crackedLive: sim.eggs.filter((e) => e.alive && !e.fled && e.cracks > 0).length, // a cracked egg still on its way
    used, turns: sim.turns || 0,
    prizeHome: log.some((q) => q.prize), prizeGone: !!prizeEgg && !prizeEgg.alive && !log.some((q) => q.prize),
    orbs: sim.orbsTaken || 0, orbsAll: sim.orbsStart || 0,
  };
}

// one goal against the facts: 'met' | 'lost' | 'open' (open: still possible, decided at the end)
export function judge(g, F) {
  const done = F.won;
  switch (g.kind) {
    case 'home': return F.saved >= (g.n || F.target) ? 'met' : done ? 'lost' : 'open'; // n: a count of its own (L1: 1, 2, all 3 home)
    case 'all': return F.broken > 0 ? 'lost' : done ? 'met' : 'open';
    case 'clean': return F.crackedHome > 0 || (!done && F.crackedLive > 0) ? 'lost' : done ? 'met' : 'open'; // in play a cracked egg already counts
    case 'perfect': return F.broken > 0 || F.crackedHome > 0 || (!done && F.crackedLive > 0) ? 'lost' : done ? 'met' : 'open';
    case 'turns': return F.turns > g.n ? 'lost' : done ? 'met' : 'open';
    case 'time': return F.used > g.s ? 'lost' : done ? 'met' : 'open';
    case 'prize': return F.prizeHome ? 'met' : F.prizeGone || done ? 'lost' : 'open';
    case 'orbs': return F.orbsAll > 0 && F.orbs >= F.orbsAll ? (done ? 'met' : 'open') : done ? 'lost' : 'open';
    case 'both': { const a = judge(g.a, F), b = judge(g.b, F); return a === 'lost' || b === 'lost' ? 'lost' : a === 'met' && b === 'met' ? 'met' : 'open'; } // Easy's third star: two goals at once
    default: return 'open';
  }
}
// after a win: which of the three are met, and the stars (0 without the win)
export function score(goals, F) {
  const met = goals.map((g) => F.won && judge(g, F) === 'met');
  return { met, stars: met[0] ? met.filter(Boolean).length : 0 };
}
// the win card's right-hand words for a goal: what happened
export function outcome(g, F, ok) {
  const eggs = (k) => k + (k === 1 ? ' egg' : ' eggs');
  switch (g.kind) {
    case 'home': return `${F.saved} home`;
    case 'all': return F.broken ? `${eggs(F.broken)} lost` : 'None lost';
    case 'clean': return F.crackedHome ? `${eggs(F.crackedHome)} cracked` : 'No cracks';
    case 'perfect': return F.broken ? `${eggs(F.broken)} lost` : F.crackedHome ? `${eggs(F.crackedHome)} cracked` : 'Perfect';
    case 'turns': return `${F.turns} turns`;
    case 'time': return `${Math.round(F.used)} s`;
    case 'prize': return ok ? 'It is home' : 'It was lost';
    case 'orbs': return `${F.orbs} of ${F.orbsAll}`;
    case 'both': { const a = judge(g.a, F) === 'met'; return !a ? outcome(g.a, F, false) : outcome(g.b, F, judge(g.b, F) === 'met'); } // what kept the star, else the bonus's own words
    default: return '';
  }
}
// during play: a goal just slipped away; a short line for the toast
export function lostLine(g) {
  if (g.kind === 'both') return lostLine(g.a) || lostLine(g.b);
  return ({ all: 'An egg was lost', clean: 'An egg cracked', perfect: 'An egg was lost or cracked', turns: `More than ${g.n} turns`, time: `Past ${g.s} s`, prize: 'The speckled egg was lost' })[g.kind] || '';
}
