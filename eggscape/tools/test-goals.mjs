// The star goals (src/goals.js): node tools/test-goals.mjs
import * as GL from '../src/goals.js';
import { LEVELS } from '../src/data/levels.js';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const kinds = {}, rows = [];
let distinct = true, numbers = true, first = true;
for (const L of LEVELS) {
  const g = GL.levelGoals(L, 1, true);
  if (g.length !== 3 || g[0].kind !== 'home') first = false;
  if (new Set(g.map((x) => x.kind + (x.kind === 'home' ? x.n : ''))).size !== 3) distinct = false; // L1: 1, 2 and all 3 home are three goals
  for (const x of g) { if (x.kind === 'turns' && !(x.n > 0)) numbers = false; if (x.kind === 'time' && !(x.s > 0 && x.s < (L.time || 999))) numbers = false; if (!x.short || !x.long || x.short.length > 14) numbers = false; }
  kinds[g[2].kind] = (kinds[g[2].kind] || 0) + 1;
  rows.push(`L${L.id}: ${g.map((x) => x.short).join(' | ')}`);
}
console.log(rows.join('\n'));
ok(first, 'every level: three goals, the first is the level itself');
ok(distinct, 'the three goals of a level are different');
ok(numbers, 'turn and time goals carry their number (time under the level clock), labels are short');
ok(Object.keys(kinds).length >= 4, 'the third goal changes from level to level: ' + JSON.stringify(kinds));
{ // a star is its goal
  const g = [{ kind: 'home' }, { kind: 'all' }, { kind: 'turns', n: 9 }];
  const F = { won: true, saved: 2, target: 2, total: 3, broken: 1, crackedHome: 0, crackedLive: 0, used: 30, turns: 8, prizeHome: false, prizeGone: false, orbs: 0, orbsAll: 0 };
  const s = GL.score(g, F);
  ok(s.stars === 2 && s.met.join() === 'true,false,true', 'an egg lost but few turns: stars 1 and 3');
  ok(GL.score(g, { ...F, won: false, saved: 1 }).stars === 0, 'no win, no stars');
  ok(GL.judge({ kind: 'time', s: 40 }, { ...F, won: false, used: 41 }) === 'lost', 'past the time: the star is gone during play');
  ok(GL.judge({ kind: 'clean' }, { ...F, won: false, crackedLive: 1 }) === 'lost' && GL.judge({ kind: 'clean' }, { ...F, crackedLive: 1 }) === 'met', 'a cracked egg counts in play; at the end only cracked eggs that came home');
}
{ // the first five: L1 counts eggs home and wins with one; no time goal before L4
  const L1 = LEVELS.find((L) => L.id === 1), g = GL.levelGoals(L1, 1, true);
  ok(g.every((x) => x.kind === 'home') && g.map((x) => x.n).join() === '1,2,3', 'L1: 1 egg home, 2 home, all 3 home: ' + g.map((x) => x.short).join(' | '));
  const F = { won: true, saved: 2, target: 1, total: 3, broken: 1, crackedHome: 0, crackedLive: 0, used: 20, turns: 4, prizeHome: false, prizeGone: false, orbs: 0, orbsAll: 0 };
  ok(GL.score(g, F).stars === 2 && GL.score(g, { ...F, saved: 3, broken: 0 }).stars === 3 && GL.score(g, { ...F, saved: 1, broken: 2 }).stars === 1, 'L1: a star per egg home');
  ok(!L1.time, 'L1 has no clock');
  const early = LEVELS.filter((L) => L.id <= 3).flatMap((L) => GL.levelGoals(L, 1, true).map((x) => x.kind));
  ok(!early.includes('time') && !early.includes('turns'), 'no time or turn goal before L4');
  ok(GL.levelGoals(LEVELS.find((L) => L.id === 2), 1, true).some((x) => x.kind === 'all'), 'L2 adds: no egg broken');
}
{ // 0.8.19 the star rule: three stars always means every egg came home, on every level, side quest and mode
  const { WONDER_LEVELS } = await import('../src/data/wonder-levels.js'), { WonderGame } = await import('../src/sim/wonder.js');
  const un = [];
  for (const mode of ['easy', 'medium', 'hard']) for (const L of LEVELS) {
    if (!GL.starsSound(L, mode)) un.push(`L${L.id} ${mode}`);
    // and the rule itself, wherever the target is under the eggs: a "lose none" goal is one of the three
    if ((L.target || 1) < (L.eggs || 1) && L.id > 1 && !GL.levelGoals(L, 1, true, mode).some((g) => ['all', 'perfect'].includes(g.kind))) un.push(`L${L.id} ${mode} (no lose-none goal)`);
    if (!GL.starsSound(L, mode, false)) un.push(`L${L.id} ${mode} replayed off the road`);
  }
  ok(LEVELS.length === 60 && un.length === 0, `60 levels x 3 modes: no outcome with a lost egg shows three stars (${un.join(', ') || 'none'})`);
  // the side quests score themselves (sim/wonder.js stars()): the kindest win with a lost egg, through that very function
  const side = [];
  for (const L of WONDER_LEVELS) {
    const kind = L.wonder && L.wonder.kind, parts = (L.wonder && (L.wonder.sims || L.wonder.worlds)) || [L];
    const short = [L, ...parts].some((q) => q && q.eggs && (q.target || 1) < q.eggs); // could it be won with an egg lost?
    const st = WonderGame.prototype.stars.call({ state: 'won', kind, level: L, stats: () => ({ broken: 1, perfect: true, attempts: 1, saved: 1, total: 2 }) });
    if (kind === 'plan' ? short : st >= 3) side.push(L.key);
  }
  ok(WONDER_LEVELS.length >= 10 && side.length === 0, `${WONDER_LEVELS.length} side quests: a lost egg never shows three stars (${side.join(', ') || 'none'})`);
  const F = { won: true, saved: 2, target: 2, total: 3, broken: 1, crackedHome: 0, crackedLive: 0, used: 1, turns: 1, prizeHome: true, prizeGone: false, orbs: 0, orbsAll: 0 };
  { // an egg that is neither broken nor home (carried off, or left out when the player ends the level early) is not "lose none"
    const Fo = { won: true, saved: 2, target: 2, total: 3, broken: 0, fled: 0, crackedHome: 0, crackedLive: 0, used: 1, turns: 1, prizeHome: true, prizeGone: false, orbs: 0, orbsAll: 0 };
    ok(GL.judge({ kind: 'all' }, Fo) === 'lost' && GL.judge({ kind: 'perfect' }, Fo) === 'lost' && GL.judge({ kind: 'all' }, { ...Fo, saved: 3 }) === 'met', '2 of 3 home, none broken (one left out): "Lose none" is not met; 3 of 3: met');
    ok(GL.outcome({ kind: 'all' }, Fo) === '1 egg lost' && GL.judge({ kind: 'all' }, { ...Fo, won: false, fled: 1 }) === 'lost', 'its words: "1 egg lost"; an egg carried off loses the star at once');
    const bad2 = LEVELS.filter((L) => (L.target || 1) < (L.eggs || 1)).filter((L) => ['easy', 'medium', 'hard'].some((m) => GL.score(GL.levelGoals(L, 1, true, m), { ...Fo, saved: L.eggs - 1, target: L.target, total: L.eggs }).stars === 3));
    ok(bad2.length === 0, `no level gives three stars with an egg left out unbroken (${bad2.map((L) => L.id).join(',') || 'none'})`);
  }
  const L8 = LEVELS.find((L) => L.id === 8), g8 = GL.levelGoals(L8, 1, true);
  ok(GL.score(g8, F).stars === 2 && g8[2].kind === L8.bonus.kind, 'L8, 2 of 3 home with the prize: two stars, its own challenge still third: ' + g8.map((x) => x.short).join(' | '));
  ok(GL.score([{ kind: 'home' }, { kind: 'clean' }, { kind: 'prize' }], F).stars === 3, 'the old trio (home, no cracks, prize) did show three stars with an egg lost: the check sees it');
}
console.log(bad ? `${bad} FAILED` : 'all goal checks passed');
process.exit(bad ? 1 : 0);
