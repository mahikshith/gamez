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
console.log(bad ? `${bad} FAILED` : 'all goal checks passed');
process.exit(bad ? 1 : 0);
