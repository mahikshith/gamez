// The pause page's "Skip level" rule (src/skip.js): node tools/test-skip.mjs
import { canSkip, applySkip, isSkipped } from '../src/skip.js';
import { defaultWallet } from '../src/economy.js';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const mk = (o = {}) => ({ unlocked: 7, stars: { 3: 2 }, best: { 3: 900 }, streak: 3, wallet: defaultWallet(), dir: { hot: 4, hotLost: 0 }, ...o });
const lv = (id, o = {}) => ({ id, count: 50, journey: true, coaching: false, won: false, ...o });

{ // unlocks the next level, as a win would
  const s = mk(), w0 = JSON.stringify(s.wallet), st0 = JSON.stringify(s.stars), b0 = JSON.stringify(s.best);
  ok(applySkip(s, lv(7)) === true, 'level 7 (the frontier, unwon) can be skipped');
  ok(s.unlocked === 8, 'the next level opens: unlocked 7 -> 8');
  ok(isSkipped(s, 7), 'level 7 is marked skipped');
  ok(JSON.stringify(s.wallet) === w0, 'grants nothing: the wallet is untouched (no coins, boosts, charges, treasure)');
  ok(JSON.stringify(s.stars) === st0 && !s.stars[7] && JSON.stringify(s.best) === b0, 'no stars and no best score for the skipped level');
  ok(s.streak === 0 && s.dir.hot === 0 && s.dir.hotLost === 0, 'the star streak and the win streak end');
}
{ // never twice
  const s = mk();
  applySkip(s, lv(7));
  const snap = JSON.stringify(s);
  ok(!canSkip(s, lv(7)) && applySkip(s, lv(7)) === false, 'a skipped level cannot be skipped again');
  ok(JSON.stringify(s) === snap, 'a refused skip changes nothing');
}
{ // never on the last level
  const s = mk({ unlocked: 50 });
  ok(!canSkip(s, lv(50)) && applySkip(s, lv(50)) === false && s.unlocked === 50 && !isSkipped(s, 50), 'level 50 (the last) cannot be skipped');
  ok(canSkip(mk({ unlocked: 49 }), lv(49)), 'level 49 can');
  const s2 = mk({ unlocked: 49 }); applySkip(s2, lv(49)); ok(s2.unlocked === 50, 'skipping 49 opens 50, never past the end');
}
{ // where it is not offered
  const s = mk();
  ok(!canSkip(s, lv(3, { won: true })), 'not on a level already won');
  ok(!canSkip(s, lv(1, { coaching: true })), 'not on level 1 while the first-run coach teaches');
  ok(!canSkip(s, lv(-1, { journey: false })) && !canSkip(s, lv(5, { journey: false })), 'not in the Daily, a practice or Extras vault');
  ok(!canSkip(s, lv(0)) && !canSkip(s, null), 'nonsense input: no');
}
{ // an earlier level: unlocked never goes down
  const s = mk({ unlocked: 12 });
  applySkip(s, lv(4));
  ok(s.unlocked === 12 && isSkipped(s, 4), 'skipping an older unwon level keeps the frontier where it is');
}
if (bad) { console.log(bad + ' FAILED'); process.exit(1); }
console.log('all skip checks pass');
