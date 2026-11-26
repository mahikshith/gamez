// The pause page's "Skip level" rule (src/skip.js): node tools/test-skip.mjs
import { canSkip, applySkip, isSkipped, skipWays } from '../src/skip.js';
import { defaultWallet } from '../src/economy.js';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const mk = (o = {}) => ({ unlocked: 7, stars: { 3: 2 }, best: { 3: 900 }, streak: 3, wallet: defaultWallet(), dir: { hot: 4, hotLost: 0 }, ...o });
const lv = (id, o = {}) => ({ id, count: 60, journey: true, coaching: false, won: false, ...o });

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
  const s = mk({ unlocked: 60 });
  ok(!canSkip(s, lv(60)) && applySkip(s, lv(60)) === false && s.unlocked === 60 && !isSkipped(s, 60), 'level 60 (the last) cannot be skipped');
  ok(canSkip(mk({ unlocked: 59 }), lv(59)), 'level 59 can');
  const s2 = mk({ unlocked: 59 }); applySkip(s2, lv(59)); ok(s2.unlocked === 60, 'skipping 59 opens 60, never past the end');
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
{ // 0.8.14 the fail card: Skip level from the first loss, paid with a ticket the player owns, else a video; coins only while stuck
  const s = mk();
  ok(JSON.stringify(skipWays(s, lv(7))) === '["ad"]', 'first loss, no ticket: one video');
  ok(JSON.stringify(skipWays(s, lv(7), { tickets: 2 })) === '["ticket"]', 'a Skip Ticket owned: the ticket, no video');
  ok(JSON.stringify(skipWays(s, lv(7), { stuck: true })) === '["ad","coins"]', 'stuck (3 losses): the coin way joins as a second button');
  ok(JSON.stringify(skipWays(s, lv(7), { stuck: true, tickets: 1 })) === '["ticket","coins"]', 'stuck with a ticket: ticket first, then coins');
  ok(skipWays(s, lv(60), { stuck: true }).length === 0 && skipWays(s, lv(3, { won: true }), { stuck: true, tickets: 3 }).length === 0, 'level 60 and a level won before: no skip at all, not even for coins');
  // the fail card ends the same way as the pause page: applySkip
  const f = mk(); ok(skipWays(f, lv(7)).length && applySkip(f, lv(7)) && f.unlocked === 8 && skipWays(f, lv(7)).length === 0, 'after the skip the level is passed and offers no skip again');
}
if (bad) { console.log(bad + ' FAILED'); process.exit(1); }
console.log('all skip checks pass');
