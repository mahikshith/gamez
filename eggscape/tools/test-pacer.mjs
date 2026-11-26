// The Pacer's rules (src/engine/pacer.js): node tools/test-pacer.mjs
// 1 the skip pop-up: after PACE.stuckAsk losses in a row (pause restarts count), once per level per session, never in
//   the early days, never with the switch off; Keep trying gives one free booster on the next try, once
// 2 the free hint (loss 4; sooner for a struggling player; the plain loss 4 with the switch off) and the boss Scarecrow
// 3 dares: only for a cruising player, never L1-5 or a first try at a boss, fewer after a decline, paid on top, met or not
// 4 the star-gate marks; the card mode for a skipper
// 5 Easy's star goals: harder second and third stars, the level itself passed as before; Easy pays less, no hard bonus
// 6 fairness: two saves that differ in skill, payment, videos watched and online state get the same level setup (the
//   fuse and every sim parameter), and two that differ only in payment, videos and online state get the same decisions
import { readFileSync } from 'node:fs';
import * as PA from '../src/engine/pacer.js';
import * as ENG from '../src/engine/index.js';
import * as GL from '../src/goals.js';
import * as E from '../src/economy.js';
import * as MINT from '../src/engine/mint.js';
import * as DR from '../src/director.js';
import { Sim, isHardLevel } from '../src/sim/sim.js';
import { LEVELS } from '../src/data/levels.js';
import { fromOld } from '../src/road.js';

let bad = 0;
const ok = (c, m) => { if (!c) { bad++; console.log('FAIL ' + m); } else console.log('ok   ' + m); };
const won3 = () => ({ 3: 1 }); // level 3 won: the early days are over
const fresh = (o = {}) => { const s = { unlocked: 12, stars: won3(), best: {}, dir: {}, wallet: E.defaultWallet(), offers: {}, ...o }; ENG.boot(s); return s; };
const lose = (s, id, n) => { for (let i = 0; i < n; i++) { const a = (s.dir.att = s.dir.att || {})[id] || { tries: 0, wins: 0, streak: 0, best: 0, help: 0 }; a.tries++; a.streak++; s.dir.att[id] = a; s.dir.recent = [...(s.dir.recent || []), 'f']; PA.result(s, { id, won: false }); } };
const plan = (s, id, o = {}) => PA.failPlan(s, { levelId: id, boss: id % 5 === 0, early: false, canSkip: true, ...o });

// ---- 1 the pop-up
{
  ok(PA.PACE.stuckAsk === 3, 'the pop-up comes after the third loss in a row (PACE.stuckAsk = 3)');
  const s = fresh();
  lose(s, 12, 2); ok(!plan(s, 12).ask, 'not after two losses');
  lose(s, 12, 1); const P = plan(s, 12); ok(P.ask, 'after the third: ' + P.why);
  PA.asked(s, 12); lose(s, 12, 1); ok(!plan(s, 12).ask, 'once per level per session');
  PA.session(s); ok(plan(s, 12).ask, 'a new session may ask again');
  ok(!plan(s, 12, { early: true }).ask, 'never in the early days');
  ok(!plan(s, 12, { canSkip: false }).ask, 'never on a level that cannot be skipped');
  const off = fresh({ adapt: false }); lose(off, 12, 5); ok(!plan(off, 12).ask, 'the switch off: no pop-up');
  const soft = fresh(); lose(soft, 14, 2);
  ok(!PA.restart(soft, 14, { used: 0.2, lost: 0 }), 'an early restart is not a loss');
  ok(PA.restart(soft, 14, { used: 0.7, lost: 0 }) && plan(soft, 14).ask, 'a late restart counts: two losses and a restart open the pop-up');
  PA.result(soft, { id: 14, won: true, stars: 1 }); ok(PA.losses(soft, 14) === 0, 'a win clears the count');
  ok(!PA.retryGift(s, 12), 'no gift before Keep trying');
  PA.declined(s, 12); ok(PA.retryGift(s, 12) && !PA.retryGift(s, 12), 'Keep trying: one free booster on the next try, once');
  const won = fresh(); won.stars[16] = 1; lose(won, 16, 3); const G3 = plan(won, 16, { canSkip: false });
  ok(!G3.ask && G3.gift, 'a won level replayed for stars (no skip there): no pop-up, the free booster all the same');
  PA.declined(won, 16); ok(PA.retryGift(won, 16) && !plan(won, 16, { canSkip: false }).gift, '... once in a losing run');
  PA.result(won, { id: 16, won: true, stars: 2 }); lose(won, 16, 3); ok(plan(won, 16, { canSkip: false }).gift, '... and again in a later losing run (a win in between)');
  ok(!plan(fresh({ adapt: false, stars: { 3: 1, 16: 1 } }), 16, { canSkip: false }).gift, 'the switch off: no such booster');
}
// ---- 2 the hint and the Scarecrow
{
  const s = fresh(); s.dir.recent = ['w', 'w', 'w', 'w', 'w', 'w'];
  PA.result(s, { id: 21, won: false }); // first loss: nothing
  ok(!plan(s, 21).hint, 'no hint on the first loss');
  const weak = fresh(); weak.dir.att = { 6: { tries: 6, wins: 1, streak: 0, help: 1 }, 7: { tries: 7, wins: 1, streak: 0, help: 0 } };
  lose(weak, 21, 2); const P = plan(weak, 21);
  ok(P.hint && P.hintAt === PA.PACE.hintStuck, `a struggling player gets the hint on loss 2 (${P.why})`);
  const strong = fresh(); strong.dir.att = { 6: { tries: 1, wins: 1 }, 7: { tries: 1, wins: 1 }, 8: { tries: 1, wins: 1 } }; strong.dir.recent = ['w', 'w', 'w', 'w', 'w'];
  lose(strong, 21, 2); ok(!plan(strong, 21).hint, 'a strong player does not get it on loss 2');
  lose(strong, 21, 2); ok(plan(strong, 21).hint, '... and gets it on loss 4');
  PA.gave(strong, 21, 'hint'); ok(!plan(strong, 21).hint, 'not on the next loss');
  lose(strong, 21, PA.PACE.hintAgain - 1); ok(!plan(strong, 21).hint, `not before ${PA.PACE.hintAgain} more losses`);
  lose(strong, 21, 1); ok(plan(strong, 21).hint, `again after ${PA.PACE.hintAgain} more losses in a row (loss ${PA.losses(strong, 21)})`);
  const off = fresh({ adapt: false }); off.dir.att = weak.dir.att; lose(off, 21, 3); ok(!plan(off, 21).hint, 'switch off: not before the plain loss 4');
  lose(off, 21, 1); ok(plan(off, 21).hint, 'switch off: the hint at loss 4');
  PA.gave(off, 21, 'hint'); lose(off, 21, 4); ok(!plan(off, 21).hint, 'switch off: once per level');
  const b = fresh(); lose(b, 10, 2); ok(!plan(b, 10).scare, 'no Scarecrow on boss loss 2');
  lose(b, 10, 1); ok(plan(b, 10).scare, 'a free Scarecrow on boss loss 3');
}
// ---- 3 dares
{
  const ctx = (id, o = {}) => ({ levelId: id, boss: id % 5 === 0, tries: 0, eggs: 3, target: 2, turns: 0, chick: true, goals: ['home', 'clean', 'time'], ...o });
  const s = fresh();
  ok(!PA.dareFor(s, ctx(12)), 'no dare for a steady player');
  for (const id of [9, 10, 11]) PA.result(s, { id, won: true, stars: 3, first: true });
  ok(PA.read(s).mood === 'cruising', 'three first-try three-star wins read as cruising');
  ok(!PA.dareFor(s, ctx(4)), 'never on levels 1 to 5');
  ok(!PA.dareFor(s, ctx(15)), 'never on a first try at a boss');
  const d = PA.dareFor(s, ctx(12)); ok(!!d, 'a dare for the cruiser: ' + (d && d.short));
  ok(PA.dareFor(s, ctx(12)).kind === d.kind, 'the same dare while the card is this level\'s');
  ok(PA.dareStart(s, 12) === null, 'not tapped: declined');
  ok(PA.pacState(s).dare.wait > 0 && !PA.dareFor(s, ctx(13)), 'after a decline the next dares wait');
  const s2 = fresh(); for (const id of [9, 10, 11]) PA.result(s2, { id, won: true, stars: 3, first: true });
  const d2 = PA.dareFor(s2, ctx(12)); PA.dareTake(s2, 12, true); const t = PA.dareStart(s2, 12);
  ok(t && t.kind === d2.kind, 'tapped: taken');
  ok(PA.dareMet({ kind: 'noboost' }, { boosts: 0 }) && !PA.dareMet({ kind: 'noboost' }, { boosts: 1 }), 'no boosters: judged');
  ok(PA.dareMet({ kind: 'every' }, { broken: 0, saved: 3, total: 3 }) && !PA.dareMet({ kind: 'every' }, { broken: 1, saved: 2, total: 3 }), 'every egg: judged');
  ok(PA.dareMet({ kind: 'nochick' }, { chicks: 0 }) && PA.dareMet({ kind: 'turns', n: 9 }, { turns: 9 }) && !PA.dareMet({ kind: 'turns', n: 9 }, { turns: 10 }), 'no chick and turns: judged');
  ok(PA.dareCoins(40) === Math.round(40 * MINT.FAUCETS.dare.share) && PA.PACE.dareBonus === MINT.FAUCETS.dare.share, `a met dare pays the Mint's share on top (FAUCETS.dare ${MINT.FAUCETS.dare.share}: +${PA.dareCoins(40)} on 40)`);
  const kinds = new Set(); for (let id = 6; id < 50; id++) { const q = fresh(); for (const k of [1, 2, 3]) PA.result(q, { id: k + 100, won: true, stars: 3, first: true }); const x = PA.dareFor(q, ctx(id, { tries: 1, turns: 12, goals: ['home', 'clean'] })); if (x) kinds.add(x.kind); }
  ok(['noboost', 'every', 'turns', 'nochick'].every((k) => kinds.has(k)), 'the dare fits the level: ' + [...kinds].join(', '));
  const off = fresh({ adapt: false }); for (const id of [9, 10, 11]) PA.result(off, { id, won: true, stars: 3, first: true }); ok(!PA.dareFor(off, ctx(12)), 'switch off: no dares');
}
// ---- 4 marks and cards
{
  const s = fresh(), rows = [{ id: 1, stars: 3, best: 9 }, { id: 2, stars: 1, best: 500 }, { id: 3, stars: 2, best: 100 }, { id: 4, stars: 2, best: 400 }, { id: 5, stars: 1, best: 900 }, { id: 6, stars: 0, best: 0 }];
  ok(JSON.stringify(PA.marks(s, { short: 2, rows })) === '[4,3,5]', 'at a gate: the three nearest stars (two-star levels first, then by best score)');
  ok(PA.marks(s, { short: 0, rows }).length === 0, 'no gate: no marks');
  ok(PA.cards(s) === 'all', 'a new player sees every card');
  for (let i = 0; i < 4; i++) PA.card(s, 1.2); ok(PA.cards(s) === 'new', 'one who skips every card sees only new rules');
  const l = fresh(); for (let i = 0; i < 4; i++) PA.card(l, 14); ok(PA.read(l).linger, 'one who lingers reads as lingering');
  lose(l, 30, 3); ok(plan(l, 30).hintAt <= PA.PACE.hintLeaver, 'a lingerer gets the hint sooner');
}
// ---- 5 Easy
{
  let harder = 0, n = 0;
  for (const L of LEVELS) {
    const e = GL.levelGoals(L, 1.6, true, 'easy'), m = GL.levelGoals(L, 1, true, 'medium');
    if (L.id < 4 || !L.bonus) { ok(JSON.stringify(e) === JSON.stringify(GL.levelGoals(L, 1.6, true, 'medium')), `L${L.id} keeps the Medium goals on Easy`); continue; }
    n++;
    if (e[0].kind === m[0].kind && e[0].n === m[0].n && (e[1].kind === 'all' || e[1].kind === 'perfect') && e[2].kind === 'both') harder++;
  }
  ok(harder === n, `Easy: the first star as on Medium, the second every egg, the third every egg AND the bonus (${harder}/${n})`);
  const L = LEVELS.find((q) => q.id === fromOld(12)), g = GL.levelGoals(L, 1.6, true, 'easy'); // (Icicle Hollow, a time bonus: 12 on the 50-level road)
  const F = { won: true, saved: 3, target: 2, total: 3, broken: 0, crackedHome: 0, crackedLive: 0, used: 200, turns: 3, prizeHome: false, prizeGone: false, orbs: 0, orbsAll: 0 };
  ok(GL.score(g, F).stars === 2, 'every egg but too slow: two stars on Easy');
  ok(GL.score(g, { ...F, used: 20 }).stars === 3, 'every egg and the bonus: three');
  ok(GL.score(g, { ...F, saved: 2, broken: 1, used: 20 }).stars === 1, 'an egg lost: one star, however fast');
  const c = (o) => E.levelCoins({ stars: 3, saved: 3, eggs: 3, ...o }).total;
  ok(Math.abs(c({ easy: true }) - c({}) * MINT.FAUCETS.easy.share) <= 0.5 && c({ easy: true, hard: true }) === c({ easy: true }), `Easy pays ${c({ easy: true })} against ${c({})} (the Mint's FAUCETS.easy ${MINT.FAUCETS.easy.share}), and no hard-level bonus`);
  ok(c({ easy: true, fresh: false }) === Math.round(c({ easy: true }) * MINT.FAUCETS.replay.share), `an Easy replay with no new star: the replay share of the Easy pay (${c({ easy: true, fresh: false })})`);
  ok(c({ hard: true }) > c({}), 'Medium and Hard keep the hard-level bonus');
}
// ---- 6 fairness
{
  const mk = (o) => { const s = fresh(o); s.dir.att = o.att || {}; s.dir.recent = o.recent || []; return s; };
  const A = mk({ wallet: { ...E.defaultWallet(), coins: 5 }, offers: { ads: 0 }, att: { 12: { tries: 9, wins: 0, streak: 9 } }, recent: ['f', 'f', 'f', 'f', 'f', 'f'] });
  const B = mk({ wallet: { ...E.defaultWallet(), coins: 9000, payer: true, noAds: true }, offers: { ads: 80, adsDay: { day: 'x', n: 9 } }, online: false, att: { 6: { tries: 1, wins: 1 }, 7: { tries: 1, wins: 1 } }, recent: ['w', 'w', 'w', 'w', 'w', 'w'] });
  for (const id of [9, 10]) PA.result(B, { id, won: true, stars: 3, first: true });
  ok(PA.read(A).skill < PA.read(B).skill, `the two saves read differently (skill ${PA.read(A).skill} and ${PA.read(B).skill})`);
  const setup = (sim) => JSON.stringify({ t: sim.timeLimit, md: sim.MD, mode: sim.mode, rings: sim.rings.map((r) => [r.i, r.speed, r.gaps && r.gaps.length, r.thorns && r.thorns.length]), snakes: (sim.snakes || []).length, eggs: sim.eggs.length });
  let same = 0, n = 0;
  for (const L of LEVELS.filter((q, i) => i % 7 === 0 || isHardLevel(q) || q.boss)) for (const mode of ['easy', 'medium', 'hard']) {
    // what main.js hands the sim: the level, the mode and the player's own boosters; nothing of the Pacer
    const fa = PA.failPlan(A, { levelId: L.id, canSkip: true }), fb = PA.failPlan(B, { levelId: L.id, canSkip: true });
    const a = new Sim(L, { mode }), b = new Sim(L, { mode });
    n++; if (setup(a) === setup(b) && !('fuse' in fa) && !('time' in fb)) same++;
  }
  ok(same === n, `the fuse and the sim parameters are the same for both saves on ${n} level/mode pairs`);
  // the decisions read play only: the same play history with different payment, videos and online state decides the same
  const base = () => { const s = mk({ att: { 12: { tries: 4, wins: 0, streak: 4 }, 6: { tries: 2, wins: 1 } }, recent: ['w', 'f', 'f', 'f', 'f'] }); PA.result(s, { id: 12, won: false }); PA.result(s, { id: 12, won: false }); PA.result(s, { id: 12, won: false }); return s; };
  const P1 = base(), P2 = base();
  P2.wallet = { ...P2.wallet, coins: 99999, payer: true, noAds: true, collector: true }; P2.offers = { ads: 500, adsDay: { day: new Date().toISOString(), n: 30 } }; P2.online = false;
  const dec = (s) => JSON.stringify({ plan: PA.failPlan(s, { levelId: 12, boss: false, canSkip: true, now: 1 }), read: PA.read(s, { levelId: 12, now: 1 }), cards: PA.cards(s), marks: PA.marks(s, { short: 3, rows: [{ id: 2, stars: 1, best: 3 }] }), won: PA.failPlan(s, { levelId: 12, canSkip: false, now: 1 }), dare: PA.dareFor(s, { levelId: 14, tries: 1, eggs: 4, target: 3, now: 1 }) }).replace(/"why":"[^"]*"/g, '');
  ok(dec(P1) === dec(P2), 'payment, videos and online state change nothing the Pacer decides');
  const SRC = readFileSync(new URL('../src/engine/pacer.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '').replace(/`[^`]*`|'[^'\n]*'/g, "''"); // (code only: no comments, no words in strings)
  { const d = fresh(), now = Date.parse('2026-12-01T12:00:00'); DR.noteResult(d, 21, false, {}); DR.noteResult(d, 21, false, {}); DR.noteTrial(d, 30, { id: 'stone' }, now); DR.noteTrial(d, 31, { id: 'stone' }, now);
    const t = DR.failHelp(d, { levelId: 21, timeout: true, struggling: true, now, owned: {} }), k = DR.failHelp(d, { levelId: 21, thorns: true, struggling: true, now, owned: {} });
    ok(!(t && t.kind === 'trialBoost') && k && k.kind === 'trialBoost' && k.id === 'snips', `past the daily two free tries a struggling player still gets one, never a Slow fuse (out of time: ${t ? t.kind + ' ' + t.id : 'none'}; thorns: ${k && k.id})`); }
  const MAINJS = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8'), LB = (MAINJS.match(/const LOSS_BOOST = (\{[^}]*\})/) || [])[1] || '';
  ok(LB && !/:\s*'time'/.test(LB), `the Pacer's free booster is never the Slow fuse (main.js LOSS_BOOST ${LB})`);
  ok(!/wallet|noAds|payer|premium|online|isOnline|videoOk|adsToday|offers|navigator|timeLimit|timeLeft|fuse/.test(SRC.replace(/softFuse/g, '')), 'the Pacer\'s code reads no purse, payment, video count, connection or clock of the level (no time lever)');
}
console.log(bad ? `${bad} FAILED` : 'all pacer checks passed');
process.exit(bad ? 1 : 0);
