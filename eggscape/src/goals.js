// The star goals (2026-11-20, mykee: "the stars are always the same: save these eggs, lose none, no cracks. They should
// change with the levels and raise the bar, a different aim to reach"). Each level has three goals, one star each:
//   1  the level itself: bring the target number of eggs home (without it there are no stars)
//   2  the care goal: lose no eggs, or bring them home uncracked; from world 7 on, both at once
//   3  the mastery goal, different from level to level: the level's own challenge from its data (few ring turns, beat
//      a time, bring the speckled prize egg home, collect every orb). The turn and time numbers come from the planner's
//      own solution with a margin (tools/gen.mjs), so every goal has been reached by a machine before a player meets it.
// World 1 keeps the plain trio (home, lose none, no cracks) while the game is being learned.
// A star is its goal: the three are judged on their own, so a run can earn the 3rd without the 2nd.
// Pure data in, data out: main.js draws them (level card, HUD stars, win card) and asks which are met.

const PER_WORLD = 5;

// -> [g1, g2, g3]; g = { kind, n?, s?, short (the level card, a few words), long (the win card's row) }
// fuse: the mode's time factor (sim.MD.fuse); level < 0 or no level data: the plain trio
export function levelGoals(L, fuse = 1, campaign = true) {
  const n = L.eggs || 1, t = L.target || 1;
  const home = { kind: 'home', n: t, short: t === n ? `All ${n} home` : `${t} of ${n} home`, long: t === n ? `All ${n} eggs home` : `${t} of ${n} eggs home` };
  const all = { kind: 'all', short: 'Lose none', long: 'Lose no eggs' };
  const clean = { kind: 'clean', short: 'No cracks', long: 'No cracked eggs' };
  const perfect = { kind: 'perfect', short: 'Flawless', long: 'No egg lost or cracked' };
  const id = L.id || 0, world = Math.floor((id - 1) / PER_WORLD), slot = (id - 1) % PER_WORLD;
  if (!campaign || id < 1 || world < 1) return [home, t === n ? clean : all, t === n ? (bonusGoal(L, fuse) || clean) : clean];
  const g3 = bonusGoal(L, fuse) || clean;
  let g2 = t === n ? clean : world >= 6 ? perfect : slot % 2 ? clean : all;
  if (g2.kind === g3.kind) g2 = all;
  return [home, g2, g3];
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
    case 'home': return F.saved >= F.target ? 'met' : done ? 'lost' : 'open';
    case 'all': return F.broken > 0 ? 'lost' : done ? 'met' : 'open';
    case 'clean': return F.crackedHome > 0 || (!done && F.crackedLive > 0) ? 'lost' : done ? 'met' : 'open'; // in play a cracked egg already counts
    case 'perfect': return F.broken > 0 || F.crackedHome > 0 || (!done && F.crackedLive > 0) ? 'lost' : done ? 'met' : 'open';
    case 'turns': return F.turns > g.n ? 'lost' : done ? 'met' : 'open';
    case 'time': return F.used > g.s ? 'lost' : done ? 'met' : 'open';
    case 'prize': return F.prizeHome ? 'met' : F.prizeGone || done ? 'lost' : 'open';
    case 'orbs': return F.orbsAll > 0 && F.orbs >= F.orbsAll ? (done ? 'met' : 'open') : done ? 'lost' : 'open';
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
    default: return '';
  }
}
// during play: a goal just slipped away; a short line for the toast
export function lostLine(g) {
  return ({ all: 'An egg was lost', clean: 'An egg cracked', perfect: 'An egg was lost or cracked', turns: `More than ${g.n} turns`, time: `Past ${g.s} s`, prize: 'The speckled egg was lost' })[g.kind] || '';
}
