// Bandit the raccoon, the boss of level 6 (0.8.17; 0.8.18: he gets ON the rings, sim/bandit.js): node tools/test-bandit.mjs
// (exits 1 on a failure). No browser: the real level 6 with its outer ring set so no gap is near the bottom and one egg
// resting on the outer channel's floor. Checks each trick (the yard entry with its crouch telegraph, the climb onto the
// outer ring's floor, the spit telegraph, the crank that really turns his ring through ring.omega/target, the reach
// telegraph, the grab into his sack), the counter (his ring turned briskly against him: shaken, a hurt while he works, a
// hop to the next ring inward that cranks the other way, three hurts and he falls into his sack and it spills), the one
// whistle, every other counter (the glow flash, a zap, a hot or fast egg, a stone egg, the Scarecrow, the rooster, the
// frost, the yard catch), each store booster and chick power, determinism (the same fight twice, a snapshot resumed
// mid-crank), the lesson hooks, and that he can never make the level unwinnable.
import { Sim, DT } from '../src/sim/sim.js';
import { LEVELS } from '../src/data/levels.js';
import { BAND } from '../src/sim/bandit.js';
import { bossStun } from '../src/sim/boss.js';
import { BOOSTERS, bossTreasure } from '../src/economy.js';
import { STRIKES } from '../src/data/strikes.js';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const deg = (d) => (d * Math.PI) / 180;
const L6 = LEVELS.find((L) => L.id === 6);
const M = (o, mode = 'medium') => o[mode] ?? o;

// the outer ring turned so its first gap is at angle gap (deg, world); egg 0 resting on the outer channel floor at angle
// egg (deg); every ring held where it is
function setup({ mode = 'medium', opts = {}, gap = 150, egg = -90, lv = L6 } = {}) {
  const sim = new Sim(lv, { mode, ...opts }), outer = sim.rings[sim.rings.length - 1];
  outer.body.setTransform({ x: 0, y: 0 }, deg(gap) - outer.gaps[0].a);
  for (const r of sim.rings) r.target = r.body.getAngle();
  if (egg != null) {
    const e = sim.eggs[0], r = sim.bandEggR();
    e.body.setTransform({ x: r * Math.cos(deg(egg)), y: r * Math.sin(deg(egg)) }, 0);
    e.body.setLinearVelocity({ x: 0, y: 0 }); e.body.setAngularVelocity(0); e.body.setAwake(true); e.ch = sim.channelOf(e);
  }
  return sim;
}
// step for secs (or until stop() says so); every event of his (and the weasel's) with its time; each(sim, ev) may act
function run(sim, secs, each = null, stop = null) {
  const log = [];
  for (let i = 0, n = Math.round(secs / DT); i < n && sim.state === 'play'; i++) {
    sim.step();
    for (const ev of sim.events) if (/^band|^thief|^weasel/.test(ev.type)) { log.push({ t: +sim.t.toFixed(3), type: ev.type, why: ev.why, hits: ev.hits, ring: ev.ring, dir: ev.dir, hurt: ev.hurt }); if (each) each(sim, ev); }
    sim.events.length = 0;
    if (stop && stop(sim)) break;
  }
  return log;
}
const ringOf = (sim) => sim.rings[sim.band.ri];
const against = (sim, d) => { const r = ringOf(sim); r.target -= sim.band.dir * deg(d); }; // turn his ring against his crank
const has = (log, type) => log.some((e) => e.type === type);
const first = (log, type) => log.find((e) => e.type === type);
const count = (log, type) => log.filter((e) => e.type === type).length;
const until = (sim, ph, secs = 30) => { run(sim, secs, null, (s) => s.band.ph === ph); return sim.band.ph === ph; };
// ---------------------------------------------------------------- the level
{
  ok(L6 && L6.boss === 'raccoon' && L6.bossFight && L6.bossFight.kind === 'raccoon' && L6.raccoon, 'level 6 is Bandit\'s boss level (boss, bossFight, his own key)');
  ok(/turn/i.test(L6.tip) && L6.intro && /turn/i.test(L6.intro.line) && !/pinch/i.test(L6.intro.line + L6.tip) && L6.intro.line.split(' ').length <= 6, 'the level card says the counter in a few words: ' + L6.intro.line);
  const T = bossTreasure(6);
  ok(T && T.coins > 0 && BOOSTERS[T.booster] && T.charges === 1, `his chest: ${T && T.coins} coins, a ${T && T.booster} booster and a charge`);
  const sim = setup();
  const g = sim.bandGeo(), nl = sim.nestX0 - sim.nestW / 2;
  ok(g.x1 <= nl - BAND.room + 1e-9 && g.x0 < g.x1, `his yard (x ${g.x0.toFixed(2)} .. ${g.x1.toFixed(2)} m) stays left of the basket (rim at ${nl.toFixed(2)})`);
  ok(sim.bandRingsOk()[0] === sim.rings.length - 1 && !sim.bandRingsOk().includes(0), `he perches on the outer ring first and never on the nest ring (rings ${sim.bandRingsOk().join(', ')})`);
}

// ---------------------------------------------------------------- trick 1: in on the yard, the climb, the crank, the grab
for (const mode of ['easy', 'medium', 'hard']) {
  const sim = setup({ mode, egg: null }), outer = sim.rings[sim.rings.length - 1]; // nothing on his floor: the crank alone
  const log = run(sim, 24, null, (s) => s.band.ph === 'crank');
  const cr = first(log, 'bandCrouch'), cl = first(log, 'bandClimb'), pe = first(log, 'bandPerch'), sp = first(log, 'bandSpit'), ck = first(log, 'bandCrank');
  ok(cr && cl && cl.t - cr.t >= 0.95, `${mode}: he tiptoes in on the yard and crouches ${cl && cr ? (cl.t - cr.t).toFixed(2) : '-'} s (the telegraph) before the leap`);
  const B = sim.band;
  ok(pe && B.ri === sim.rings.length - 1 && B.pa < deg(-100) && B.pa > deg(-140) && B.side === -1, `${mode}: he hauls himself onto the outer ring's floor low on his side (at ${(B.pa / deg(1)).toFixed(0)} deg)`);
  ok(sp && ck && ck.t - sp.t >= 1.0 && ck.ring === B.ri && ck.dir === -1, `${mode}: he spits in his paws ${ck && sp ? (ck.t - sp.t).toFixed(2) : '-'} s (the telegraph), then cranks his ring clockwise`);
  // the crank turns the ring through ring.omega / ring.target: about BAND.crank deg/s, and the target goes along (no tug)
  const a0 = outer.body.getAngle();
  run(sim, 1.5);
  const a1 = outer.body.getAngle(), w = ((a0 - a1) / deg(1)) / 1.5;
  ok(sim.band.ph === 'crank' && Math.abs(w - M(BAND.crank, mode)) < 0.25 * M(BAND.crank, mode) && Math.abs(outer.target - a1) < deg(1.5), `${mode}: his ring turns ${w.toFixed(1)} deg/s his way (BAND ${M(BAND.crank, mode)}), its target with it`);
  const sim2 = setup({ mode }), more = run(sim2, 40, null, (s) => s.band.ph === 'sit' && s.eggs[0].hc === 3);
  const rc = first(more, 'bandReach'), gr = first(more, 'bandGrab'), st = first(more, 'bandStuff');
  ok(rc && gr && gr.t - rc.t >= 1.0, `${mode}: the floor drags the egg up to him; he stretches for it ${gr && rc ? (gr.t - rc.t).toFixed(2) : '-'} s (the telegraph), then grabs it`);
  ok(st && sim2.eggs[0].hc === 3 && sim2.band.sack.includes(sim2.eggs[0].id), `${mode}: untouched, he stuffs the egg in his sack`);
  ok(!has(log.concat(more), 'bandShake') && !has(log.concat(more), 'bandHurt'), `${mode}: no shake and no hurt without a turn`);
}
{
  // the player's turning of his ring still works and adds to his crank
  const sim = setup({ egg: null });
  until(sim, 'crank'); run(sim, 0.6);
  const r = ringOf(sim), a0 = r.body.getAngle();
  r.target += deg(10) * sim.band.dir; // a turn WITH him (it never shakes him)
  const log = run(sim, 1.0);
  const turned = (r.body.getAngle() - a0) * sim.band.dir / deg(1);
  ok(Math.abs(turned - (10 + BAND.crank.medium)) < 1.5 && !has(log, 'bandShake'), `a turn of 10 deg with him adds to his crank (${turned.toFixed(1)} deg in 1 s) and does not shake him`);
}

// ---------------------------------------------------------------- the counter: his ring turned briskly against him
{
  const sim = setup();
  until(sim, 'crank'); run(sim, 0.5);
  const ri = sim.band.ri;
  against(sim, 20);
  const log = run(sim, 0.6);
  const S = first(log, 'bandShake'), H = first(log, 'bandHurt');
  ok(S && S.hurt === 1 && S.ring === ri && H && H.hits === 1 && sim.band.ph === 'shaken', 'turned 20 deg against him while he cranks: SHAKEN, a real hurt (1 of 3)');
  const hop = run(sim, 6, null, (s) => s.band.ph === 'crank');
  ok(has(hop, 'bandHop') && sim.band.ri === ri - 1 && sim.band.side === 1 && sim.band.dir === 1 && first(hop, 'bandCrank').dir === 1, `he hops to the next ring inward (ring ${sim.band.ri}), on the other side, and cranks the other way`);
}
{
  // a shake while he sits: he wobbles, no hurt; a slow turn against him never shakes him
  const sim = setup();
  until(sim, 'sit'); run(sim, 0.2);
  against(sim, 20);
  const log = run(sim, 0.6);
  ok(has(log, 'bandShake') && !has(log, 'bandHurt') && sim.band.hits === 0, 'shaken while he only sits: he wobbles, no hurt');
  const sim2 = setup();
  until(sim2, 'crank');
  const slow = run(sim2, 6, (s) => {}, (s) => { const r = ringOf(s); r.target -= s.band.dir * deg(2) * DT; return false; });
  ok(!has(slow, 'bandShake'), 'a slow turn against him (2 deg/s) never shakes him');
}
{
  // shaken while he holds an egg: he drops it back on his floor, unharmed
  const sim = setup();
  until(sim, 'grab'); run(sim, 0.3);
  const e = sim.eggs[0];
  ok(sim.band.eid === e.id && e.hc === 2, 'set-up: the egg is in his paw');
  against(sim, 20);
  const log = run(sim, 2);
  ok(has(log, 'bandHurt') && !sim.band.eid && e.alive && !e.hc && e.cracks === 0 && sim.channelOf(e) === sim.rings.length - 1, 'shaken mid-grab: hurt, and the egg drops back on his floor uncracked');
}
// the whole fight: he bags one egg, then three shakes; he whistles once (after the second) and the sack spills back
function fight(mode, secs = 90) {
  const sim = setup({ mode });
  let broke = 0;
  const log = [], freed = {};
  for (let i = 0; i < secs / DT && sim.state === 'play'; i++) {
    const B = sim.band;
    if (B.sack.length && (B.ph === 'crank' || B.ph === 'reach') && B.dur - B.t > 0.4 && B.hitCD <= 0) { const r = sim.rings[B.ri]; if (Math.abs(r.target - r.body.getAngle()) < 0.01) r.target -= B.dir * deg(25); }
    sim.step();
    for (const ev of sim.events) { if (ev.type === 'bandDrop' || ev.type === 'bandSpill') freed[ev.egg.id] = sim.t; if ((ev.type === 'break' || ev.type === 'crack') && ev.egg && (ev.egg.hc || sim.t - (freed[ev.egg.id] ?? -9) < 1.0)) broke++; }
    for (const ev of sim.events) if (/^band|^thief/.test(ev.type)) log.push({ t: +sim.t.toFixed(3), type: ev.type, why: ev.why, hits: ev.hits, n: ev.n, ring: ev.ring, dir: ev.dir });
    sim.events.length = 0;
    if (sim.band.done && !sim.band.spill.length && i % 60 === 0 && log.some((e) => e.type === 'bandSpill')) break;
  }
  return { sim, log, broke };
}
for (const mode of ['easy', 'medium', 'hard']) {
  const { sim, log, broke } = fight(mode);
  ok(broke === 0, `${mode}: no egg he held, bagged, dropped or spilled cracks`);
  const hurt = log.filter((e) => e.type === 'bandHurt'), D = first(log, 'bandDefeat'), F = first(log, 'bandFall');
  ok(first(log, 'bandStuff') && hurt.length === 3 && hurt.map((p) => p.hits).join() === '1,2,3', `${mode}: one egg bagged, then three hurts (${hurt.map((p) => p.t.toFixed(1)).join(', ')} s)`);
  ok(new Set(hurt.map((h) => h.ring)).size >= 2, `${mode}: the fight moves inward ring by ring (hurt on rings ${hurt.map((h) => h.ring).join(', ')})`);
  ok(F && D && D.t > F.t && D.n >= 1 && sim.band.done && sim.band.ph === 'defeated', `${mode}: the third hurt: he falls off (${F ? F.t.toFixed(1) : '-'} s) into his sack on the yard (${D ? D.t.toFixed(1) : '-'} s)`);
  const e = sim.eggs[0];
  ok(has(log, 'bandSpill') && e.alive && !e.hc && sim.channelOf(e) === sim.rings.length - 1 && sim.band.sack.length === 0, `${mode}: his sack spills every egg back into the vault`);
  ok(count(log, 'bandWhistle') === 1 && first(log, 'bandWhistle').t > hurt[1].t && first(log, 'bandWhistle').t < hurt[2].t, `${mode}: one whistle, after the second hurt`);
  ok(sim.bx.boss.t > 1e8, `${mode}: the boss bar is done with him`);
  const bar = sim.bandBossBar();
  ok(bar.hp === 0 && bar.icon && bar.icon.kind === 'sack' && !bar.label.trim(), `${mode}: the bar shows his tied sack, no words`);
  ok(!has(log.slice(log.indexOf(D)), 'bandCrank') && run(sim, 20).every((e) => !/^band(Crank|Climb|Reach)/.test(e.type)), `${mode}: beaten for the rest of the level`);
}

// ---------------------------------------------------------------- the bar and the lesson hooks
{
  const sim = setup();
  until(sim, 'crank'); run(sim, 0.4);
  const bar = sim.bandBossBar(), L = sim.bandLesson();
  ok(bar.icon && bar.icon.kind === 'ringArrow' && bar.icon.dir === -sim.band.dir && bar.icon.hot === 1 && !bar.label.trim(), 'the bar: a ring with an arrow the way to turn it against him, lit while he cranks, no words');
  ok(L && L.ring === sim.band.ri && L.dir === -1 && L.counter === 1 && L.cranking === 1 && L.hurtable === 1, 'bandLesson(): which ring he turns, which way, which way beats him');
  against(sim, 20);
  const log = run(sim, 0.3), S = first(log, 'bandShake');
  ok(S && S.ring === L.ring && S.dir === L.dir, 'the counter is an event (bandShake: ring, dir, hurt) for a lesson to slow down on');
}

// ---------------------------------------------------------------- trick 3: the whistle (the level's waiting weasel hunts, then goes home)
{
  const { sim, log } = fight('medium', 90);
  const W = sim.bandWeaselT(), wh = first(log, 'bandWhistle');
  const out = log.filter((e) => /^thief/.test(e.type) && e.t > wh.t);
  ok(W && sim.band.whistled === 1 && sim.band.wid === W.id, 'the whistle calls the level\'s weasel');
  ok(out.length > 0, `it comes out for a hunt (${out.length} weasel events after the whistle)`);
  run(sim, BAND.hunt.medium + 20);
  ok(['hide', 'wait', 'gone'].includes(W.ph) && W.t > 1e8, `after its short hunt (${BAND.hunt.medium} s) it goes home and stays there (${W.ph})`);
  const sim2 = setup();
  run(sim2, 40);
  ok(sim2.bandWeaselT().ph === 'wait', 'without the whistle the weasel never comes out');
}

// ---------------------------------------------------------------- 0.8.18 the stand-off: the whistled weasel comes for its share
{
  const { DUEL } = await import('../src/sim/bandit.js');
  const egg0 = (sim) => sim.eggs.map((e) => `${e.id}:${e.hc}:${e.alive}:${e.cracks}`).join(' ');
  // he sits on his first perch; the weasel is whistled up with a short hunt left; bag = an egg in his sack first
  const duelSim = (mode, bag) => {
    const sim = setup({ mode }), B = sim.band;
    until(sim, 'sit');
    if (bag) { const e = sim.eggs[0]; e.hc = 3; B.sack.push(e.id); e.body.setActive(false); }
    B.whistled = 1; sim.bandCall(B); B.wz = 1.0;
    return sim;
  };
  const duelRun = (sim, secs = 40) => {
    const L = [];
    run(sim, secs, (s, ev) => { if (/^bandDuel/.test(ev.type)) L.push({ t: s.t, type: ev.type, ph: ev.ph, eggs: egg0(s), W: s.bandWeaselT().ph }); }, (s) => s.band.dueled && !s.band.duel && s.bandWeaselT().ph === 'hide');
    return L;
  };
  for (const mode of ['easy', 'medium', 'hard']) {
    const sim = duelSim(mode, false), B = sim.band, W = sim.bandWeaselT(), eggsAt = egg0(sim);
    const evs = [], L = [];
    run(sim, 40, (s, ev) => { evs.push({ t: s.t, type: ev.type }); if (/^bandDuel/.test(ev.type)) L.push({ t: s.t, type: ev.type, ph: ev.ph }); }, (s) => s.band.dueled && !s.band.duel && W.ph === 'hide');
    const at = (ph) => (L.find((e) => e.ph === ph) || {}).t, win = L.find((e) => e.type === 'bandDuelWin');
    const order = ['come', 'freeze', 'stare', 'circle', 'fight'].map(at);
    ok(order.every((x) => x != null) && order.every((x, i) => !i || x > order[i - 1]) && win && win.t > order[4], `${mode}: the stand-off plays out: it comes, they freeze, stare, circle, scuffle (${order.map((x) => x && x.toFixed(1)).join(', ')}; ${win ? win.t.toFixed(1) : '-'} s)`);
    ok(win && Math.abs(win.t - order[4] - DUEL.fight) < 0.05 && Math.abs(order[2] - order[1] - DUEL.freeze) < 0.05, `${mode}: the scuffle lasts ${win ? (win.t - order[4]).toFixed(2) : '-'} s (DUEL.fight ${DUEL.fight})`);
    const mid = evs.filter((e) => e.t >= order[0] && e.t <= (win ? win.t : 1e9));
    ok(!mid.some((e) => /^(bandReach|bandGrab|bandCrank|thiefGrab|thiefPounce|thiefCarry)/.test(e.type)) && egg0(sim) === eggsAt, `${mode}: neither bothers an egg while it lasts`);
    ok(win && W.ph === 'hide' && W.t > 1e8 && (B.ph === 'sit' || B.ph === 'spit' || B.ph === 'crank'), `${mode}: his sack empty, he wins: the weasel slinks home for good (${W.ph}) and he goes back to work (${B.ph})`);
  }
  { // the slink and the dust, mid-scene
    const sim = duelSim('medium', false), B = sim.band, W = sim.bandWeaselT();
    run(sim, 40, null, (s) => s.band.ph === 'dust');
    ok(B.ph === 'dust' && W.ph === 'home' && W.k === 'slink' && B.duel && B.duel.win === 'band', 'he dusts his paws while the weasel slinks off dizzy');
    ok(!B.rip, 'his sack is whole when he wins');
  }
  { // an egg in his sack: the weasel grabs the sack, it rips, the egg rolls free into the vault
    const sim = duelSim('medium', true), B = sim.band, W = sim.bandWeaselT(), e = sim.eggs[0];
    const L = []; let spill = null;
    run(sim, 40, (s, ev) => { if (ev.type === 'bandDuelRip') L.push(ev); if (ev.type === 'bandSpill' && !spill) spill = s.t; }, (s) => spill != null && s.t > spill + 0.5);
    ok(L.length === 1 && L[0].n === 1 && B.ph !== 'duel' && W.k !== 'slink', `with an egg in his sack the sack rips (${L.length ? L[0].n : 0} egg rolls free) and the weasel bolts`);
    ok(spill != null && e.alive && e.cracks === 0 && !e.hc && sim.channelOf(e) === sim.rings.length - 1, 'the egg rolls back onto the outer floor, uncracked');
    run(sim, 20, null, (s) => W.ph === 'hide');
    ok(W.ph === 'hide' && W.t > 1e8, 'and the weasel stays home');
    ok(B.rip === 1 && Sim.fromState(sim.level, sim.fullState(), { mode: 'medium' }).band.rip === 1, 'his sack stays torn (the rip is in the saved state)');
  }
  { // rewind and the planner: a snapshot mid-scuffle carries on exactly
    const a = duelSim('medium', true);
    run(a, 40, null, (s) => s.band.duel && s.band.duel.ph === 'fight' && s.band.duel.t > DUEL.freeze + DUEL.stare + DUEL.circle + 1);
    const b = Sim.fromState(L6, a.fullState());
    run(a, 6); run(b, 6);
    const key = (s) => JSON.stringify([s.band.ph, s.band.duel, s.band.sack, s.band.spill.length, s.bandWeaselT().ph, +s.bandWeaselT().a.toFixed(6), s.eggs.map((e) => e.hc)]);
    ok(key(a) === key(b), 'a snapshot mid-scuffle carries on exactly (rewind, the planner)');
    const c = duelSim('medium', true), d = duelSim('medium', true);
    run(c, 25); run(d, 25);
    ok(key(c) === key(d), 'the stand-off is deterministic');
  }
}

// ---------------------------------------------------------------- the other counters
// his paw on the egg: returns the sim mid-grab (the egg in his paw)
function grabbing(o = {}) { const sim = setup(o); until(sim, 'grab'); run(sim, 0.2); return sim; }
function cranking(o = {}) { const sim = setup(o); until(sim, 'crank'); run(sim, 0.3); return sim; }
{
  const sim = cranking();
  const n = sim.bandHit('flash', { ...sim.bandHead(sim.band), r: 1.0 });
  ok(n === 1 && sim.band.hits === 1 && sim.band.why === 'flash', 'the glow chick\'s flash on him is a hurt');
}
{
  const sim = cranking();
  sim.bandHit('bolt', { ...sim.bandHead(sim.band), r: 1.0 });
  ok(sim.band.hits === 1 && sim.band.why === 'zap', 'lightning on him is a hurt (a zap)');
}
{
  const sim = cranking();
  const p = sim.bandBody(sim.band, 0.6, 0.15), e = sim.eggs[1];
  e.body.setTransform({ x: p.x + 0.1, y: p.y + 0.05 }, 0); e.body.setLinearVelocity({ x: 2.5, y: 0 }); e.body.setActive(true); e.hc = 0;
  run(sim, 0.1);
  ok(sim.band.hits === 1 && sim.band.why === 'bump', 'a fast egg slamming into him is a hurt');
}
{
  const sim = cranking();
  const p = sim.bandBody(sim.band, 0.6, 0.15), e = sim.eggs[1];
  e.body.setTransform({ x: p.x + 0.1, y: p.y + 0.05 }, 0); e.body.setLinearVelocity({ x: 0, y: 0 }); e.fire = 3; e.fireKind = 'fire_red';
  run(sim, 0.1);
  ok(sim.band.hits === 1 && sim.band.why === 'hot', 'a burning egg by him burns him (a hurt)');
}
{
  const sim = setup();
  sim.eggs[0].stone = 60;
  const log = run(sim, 30);
  ok(has(log, 'bandStrain') && has(log, 'bandHeavy') && !has(log, 'bandGrab') && !sim.eggs[0].hc, 'a stone egg is too heavy: he tugs, gives up, the egg stays');
}
{
  const sim = setup({ opts: { scare: true } });
  const log = run(sim, 19);
  ok(has(log, 'bandScared') && !has(log, 'bandClimb') && sim.band.x <= sim.bandGeo().x0 + 0.05, 'the Scarecrow: he keeps to the far end of his yard while it stands (no climb in 19 s)');
  const more = run(sim, 15);
  ok(has(more, 'bandClimb'), 'and he is back once it is gone');
  const s2 = cranking();
  s2.scareT = 6;
  const l2 = run(s2, 4);
  ok(s2.band.ph === 'cower' && !has(l2, 'bandReach') && !has(l2, 'bandCrank'), 'the Scarecrow while he is on a ring: he cowers and leaves the ring and the eggs alone');
}
{
  const sim = grabbing();
  const held = !!sim.band.eid;
  bossStun(sim, 3);
  const log = run(sim, 0.2);
  ok(held && has(log, 'bandStun') && has(log, 'bandDrop') && !sim.band.eid, 'Papa Rooster\'s crow: he lets go of the egg and reels');
  run(sim, 1.2);
  ok(sim.band.ph === 'perchStun', 'dizzy on his perch while the crow lasts (' + sim.band.ph + ')');
}
{
  const sim = grabbing();
  sim.bx.boss.stk = 4;
  let log = run(sim, 0.2);
  ok(has(log, 'bandFreeze') && has(log, 'bandDrop') && sim.band.held === 1 && !sim.band.eid, 'the Frost chick: frozen on his perch, the egg dropped back on his floor');
  against(sim, 20);
  log = run(sim, 1.0);
  ok(has(log, 'bandHurt') && sim.band.hits === 1 && !sim.band.held, 'a frozen Bandit shaken off his ring is hurt (and thawed)');
}
{
  // an egg falling out of the vault over his yard while he is still on it: caught (into the sack), not broken
  const sim = setup({ egg: null });
  const e = sim.eggs[0], g = sim.bandGeo();
  sim.band.t = 0; sim.band.ph = 'sneak'; sim.band.x = g.x0 + 0.6;
  e.body.setTransform({ x: g.x0 + 0.2, y: sim.groundY + 2.2 }, 0); e.body.setLinearVelocity({ x: 0, y: -1 }); e.ch = sim.rings.length; e.body.setAwake(true);
  const log = run(sim, 3);
  ok(has(log, 'bandCatch') && e.alive && (e.hc === 3 || e.hc === 2), 'an egg falling into his yard is caught, not broken (it is in his sack)');
}

// ---------------------------------------------------------------- every store booster
{
  const runs = {};
  for (const id of Object.keys(BOOSTERS)) {
    const sim = setup({ opts: { [id]: true } });
    if (id === 'golden') sim.eggs[0].golden = true;
    if (id === 'stone') sim.eggs[0].stone = Math.max(sim.eggs[0].stone || 0, 30); // a shell that lasts until he reaches for it (he climbs up first)
    runs[id] = { sim, log: run(sim, 30) };
  }
  const R = runs;
  { const L = R.stone.log, h = first(L, 'bandHeavy'), g = first(L, 'bandGrab'), s = R.stone.sim.eggs[0]; ok((h && (!g || g.t > h.t + 1)) || (!g && !s.hc), `Stone shell: while it lasts the stone egg is too heavy for him (${h ? 'gives up at ' + h.t.toFixed(1) + ' s' : 'never taken'}${g ? ', takes it at ' + g.t.toFixed(1) + ' s once the shell is gone' : ''})`); }
  ok(has(R.golden.log, 'bandGrab') && R.golden.sim.eggs[0].hc === 3, 'Golden shell: no help against him (he bags it; his defeat gives it back)');
  ok(R.time.sim.timeLimit === new Sim(L6, { mode: 'medium' }).timeLimit + 15 && has(R.time.log, 'bandStuff'), 'Extra time: 15 s more fuse; he is unchanged');
  ok(has(R.sponge.log, 'bandStuff') && has(R.snips.log, 'bandStuff'), 'Sponge pad, Snips: nothing of his changes');
  { const s = R.nest.sim, g = s.bandGeo(), nl = s.nestX0 - s.nestW / 2; ok(g.x1 <= nl - BAND.room + 1e-9 && has(R.nest.log, 'bandClimb'), `Wider basket: his yard shrinks with it (to x ${g.x1.toFixed(2)}), he still works`); }
  ok(has(R.scare.log, 'bandScared') && !R.scare.log.some((e) => e.type === 'bandClimb' && e.t < 20), 'Scarecrow: he keeps away while it stands (20 s)');
  {
    const s = R.rewind.sim, S = s.fullState(), back = Sim.fromState(L6, S, { mode: 'medium' });
    ok(back.band && back.band.sack.join() === s.band.sack.join() && back.eggs.every((e, i) => e.hc === s.eggs[i].hc), 'Rewind: his sack and the eggs in it come back exactly');
  }
}

// ---------------------------------------------------------------- every chick power
{
  const tgt = (sim) => sim.stkTargets().find((T) => T.type === 'bx');
  ok(!!tgt(setup()), 'a chick strike can target him (the boss target sits on him)');
  for (const S of STRIKES) {
    const sim = grabbing();
    const T = tgt(sim);
    const ice = ['freeze', 'glue', 'tock'].includes(S.id);
    if (S.id === 'phoenix' || S.id === 'bubble') {
      ok(!sim.reefFit(sim.eggs.find((e) => e.id === sim.band.eid) || sim.eggs[0]) || !sim.band.eid, `${S.name}: works on eggs; the one in his paw is his until a shake or a stun`);
      continue;
    }
    sim.stkApply(T, ice ? 'ice' : S.id === 'tornado' ? 'spin' : 'bolt', 3, S.id, true);
    const log = run(sim, 0.3);
    ok(!sim.band.eid && (ice ? has(log, 'bandFreeze') : has(log, 'bandStun')), `${S.name}: ${ice ? 'frozen' : 'stunned'}, he lets go of the egg`);
  }
  for (const k of ['ice', 'bolt', 'out', 'zap', 'pepper']) {
    const sim = grabbing();
    sim.p2Boss(k, 3);
    const log = run(sim, 0.3);
    ok(k === 'pepper' ? sim.bx.boss.flinch > 0 : has(log, 'bandStun'), `power ${k}: ${k === 'pepper' ? 'a flinch' : 'dizzy, he lets go'}`);
  }
}

// ---------------------------------------------------------------- determinism
{
  const a = fight('medium').log, b = fight('medium').log;
  ok(a.length > 10 && JSON.stringify(a) === JSON.stringify(b), `the same fight twice is the same fight (${a.length} events)`);
  // (taken with the egg in his paw: an egg rolling on a turning floor would differ only by the physics engine's contact
  // warm start, which no snapshot in the game carries)
  const s1 = grabbing(), S = s1.fullState(), s2 = Sim.fromState(L6, S, { mode: 'medium' });
  const l1 = run(s1, 14), l2 = run(s2, 14);
  ok(has(l1, 'bandCrank') && JSON.stringify(l1) === JSON.stringify(l2) && JSON.stringify(s1.bandState()) === JSON.stringify(s2.bandState()) && Math.abs(s1.rings[3].body.getAngle() - s2.rings[3].body.getAngle()) < 1e-9, `a snapshot taken mid-grab resumes exactly through his next crank (${l1.length} events, the same ring angle)`);
}

// ---------------------------------------------------------------- never unwinnable
{
  // he never breaks an egg; with nothing to take he still cranks every cycle (so there is always a ring to shake); when
  // only bagged eggs are left and the target is saved, the level is won; bagged eggs come back when he is beaten
  let broke = 0, cranky = 0, runs = 0;
  for (const mode of ['easy', 'medium', 'hard']) for (const gap of [0, 60, 150]) for (const egg of [-90, -70, null]) {
    const sim = setup({ mode, gap, egg });
    runs++;
    const log = [], freed = {};
    for (let i = 0; i < 50 / DT && sim.state === 'play'; i++) {
      sim.step();
      for (const ev of sim.events) {
        if (ev.type === 'bandDrop' || ev.type === 'bandSpill') freed[ev.egg.id] = sim.t;
        if ((ev.type === 'break' || ev.type === 'crack') && ev.egg && (ev.egg.hc || sim.t - (freed[ev.egg.id] ?? -9) < 1.0)) broke++;
        if (/^band/.test(ev.type)) log.push(ev);
      }
      sim.events.length = 0;
    }
    if (count(log, 'bandCrank') >= 3) cranky++;
  }
  ok(broke === 0, `he never breaks an egg (${runs} runs, all modes)`);
  ok(cranky === runs, `he cranks again and again, egg or no egg, so there is always a ring to shake (${cranky} of ${runs} runs crank 3+ times in 50 s)`);
  const sim = setup();
  run(sim, 30, null, (s) => s.eggs[0].hc === 3);
  const e0 = sim.eggs[0];
  ok(e0.hc === 3, 'set-up: one egg in his sack');
  for (const e of sim.eggs) if (e !== e0 && e.alive) { sim.savedLog.push({ id: e.id, cracks: 0 }); e.saved = true; e.alive = false; if (e.body) e.body.setActive(false); }
  run(sim, 1);
  ok(sim.state !== 'play' && sim.savedLog.length >= L6.target && sim.state !== 'lost', `the target home and only his bagged egg left: the level is won (${sim.state})`);
}


// ================================================================ 0.8.18 MAMA RACCOON AND HER KITS (sim/kits.js)
{
  const { KITS } = await import('../src/sim/kits.js');
  const { costumeOf } = await import('../src/render/costume.js');
  const KL = LEVELS.filter((L) => L.kits);
  const banned = new Set([1, 2, 3, 4, 5, 6, 9, 25, 26, 27, 28, 29, 30, 49, 52]);
  const worlds = KL.map((L) => L.world);
  ok(KL.length >= 1 && KL.length <= 5 && new Set(worlds).size === worlds.length && KL.every((L) => !banned.has(L.id) && !L.water && !L.shape && !L.raccoon), `the kits play in ${KL.map((L) => 'L' + L.id).join(', ')}: at most five, one per world, never L1-6, the frog's, Volcano, underwater or shaped vaults`);
  ok(KL.every((L) => costumeOf(L.theme) !== 'bow') && new Set(KL.map((L) => costumeOf(L.theme))).size === KL.length, `each wears its world's costume (${KL.map((L) => costumeOf(L.theme)).join(', ')})`);
  const KLV = KL.find((L) => L.id === 19) || KL[0];
  const lvK = { ...KLV, icicles: undefined, kits: { ...KLV.kits, n: undefined, delay: 1 } }; // (no falling ice: the kits alone; the mode's own number of kits)
  ok(KL.every((L) => new Sim(L, { mode: 'medium' }).kit.n === (L.kits.n || KITS.n.medium)), `a level may set its number of kits (${KL.map((L) => 'L' + L.id + ' ' + new Sim(L, { mode: 'medium' }).kit.n).join(', ')})`);
  // the outer ring turned so no gap is near the bottom; egg 0 resting on the outer floor at angle egg (deg)
  const kset = ({ mode = 'medium', egg = -100, gap = 90, lv = lvK } = {}) => {
    const sim = new Sim(lv, { mode }), outer = sim.rings[sim.rings.length - 1];
    outer.body.setTransform({ x: 0, y: 0 }, deg(gap) - outer.gaps[0].a);
    for (const g of outer.gaps.slice(1)) { /* every other gap of the outer ring goes with it */ }
    for (const r of sim.rings) r.target = r.body.getAngle();
    if (egg != null) { const e = sim.eggs[0], r = sim.kitFloor(sim.rings.length - 1) - 0.3; e.body.setTransform({ x: r * Math.cos(deg(egg)), y: r * Math.sin(deg(egg)) }, 0); e.body.setLinearVelocity({ x: 0, y: 0 }); e.body.setAwake(true); e.ch = sim.channelOf(e); }
    return sim;
  };
  const krun = (sim, secs, each = null, stop = null) => {
    const log = [];
    for (let i = 0, n = Math.round(secs / DT); i < n && sim.state === 'play'; i++) {
      sim.step();
      for (const ev of sim.events) { if (/^kit|^break|^crack/.test(ev.type)) log.push({ t: +sim.t.toFixed(3), type: ev.type, why: ev.why, ring: ev.ring, n: ev.n, egg: ev.egg && ev.egg.id }); if (each) each(sim, ev); }
      sim.events.length = 0;
      if (stop && stop(sim)) break;
    }
    return log;
  };
  const kuntil = (sim, f, secs = 60) => { krun(sim, secs, null, f); return f(sim); };
  const cracked = (log) => log.some((e) => e.type === 'break' || e.type === 'crack');
  for (const mode of ['easy', 'medium', 'hard']) {
    const sim = kset({ mode }), log = krun(sim, 90, null, (s) => s.kit.ph === 'smug');
    const pop = first(log, 'kitPop'), lift = first(log, 'kitLift'), car = first(log, 'kitCarry'), home = first(log, 'kitHome'), e = sim.eggs[0];
    ok(first(log, 'kitWalk') && first(log, 'kitUntie') && pop && pop.n === M(KITS.n, mode), `${mode}: mama walks in, unties her sack and ${pop && pop.n} kits tumble out`);
    ok(first(log, 'kitClimb') && first(log, 'kitIn') && first(log, 'kitIn').ring === sim.rings.length - 1, `${mode}: they climb over the rim onto the outer floor at her side`);
    ok(lift && car && car.t - lift.t >= M(KITS.lift, mode) - 0.05, `${mode}: they gather round the egg and heave ${car && lift ? (car.t - lift.t).toFixed(2) : '-'} s (the telegraph) before it moves`);
    ok(home && e.hc === 3 && sim.kit.sack.includes(e.id) && !cracked(log) && e.cracks === 0, `${mode}: untouched, they carry it home into her sack (${home ? home.t.toFixed(1) : '-'} s), not a crack`);
    const sp = M(KITS.carry, mode);
    ok(home && home.t - car.t > 2.0, `${mode}: the carry is slow (${home ? (home.t - car.t).toFixed(1) : '-'} s at ${sp} m/s)`);
  }
  // the counters, each during the carry
  const carrying = (o = {}) => { const sim = kset(o); kuntil(sim, (s) => s.kit.g.ph === 'carry' && s.kit.g.eid && s.t > 0); krun(sim, 0.4); return sim; };
  {
    const sim = carrying(), G = sim.kit.g, r = sim.rings[G.c], e = sim.eggs[0];
    const gs = r.gaps.map((g) => Math.atan2(Math.sin(r.body.getAngle() + g.a - G.a), Math.cos(r.body.getAngle() + g.a - G.a))).sort((x, y) => Math.abs(x) - Math.abs(y));
    r.target += Math.sign(gs[0]) * deg(35); // (the way that takes the nearest gap away from them)
    const log = krun(sim, 2.0, null, (s2) => s2.kit.g.ph === 'tumble');
    ok(has(log, 'kitTumble') && !e.hc && e.alive && e.cracks === 0 && sim.channelOf(e) < sim.rings.length, 'their floor turned briskly: they tumble and the egg drops back on the floor, uncracked');
    const more = krun(sim, 8, null, (s) => s.kit.ph === 'comfort');
    ok(has(more, 'kitFlee') && sim.kit.fails === 1 && sim.kit.ph === 'comfort', 'they run home crying (a failed fetch) and mama comforts them');
    const sim2 = carrying(), r2 = sim2.rings[sim2.kit.g.c];
    const slow = krun(sim2, 3, () => {}, (s) => { r2.target += deg(3) * DT; return false; });
    ok(!has(slow, 'kitTumble') && !has(slow, 'kitDangle'), 'a slow turn of their floor (3 deg/s) only carries them along');
  }
  {
    const sim = carrying({ gap: 154, egg: -85 }), G = sim.kit.g, ring = sim.rings[G.c], e = sim.eggs[0]; // (a gap waits to their right)
    // turn the floor gently (about 9 deg/s: no tumble) so its nearest gap slides under them
    const gs = ring.gaps.map((g) => Math.atan2(Math.sin(ring.body.getAngle() + g.a - G.a), Math.cos(ring.body.getAngle() + g.a - G.a))).sort((x, y) => Math.abs(x) - Math.abs(y)), way = -Math.sign(gs[0]);
    const log = krun(sim, 12, null, (s2) => { if (s2.kit.g.ph !== 'dangle' && s2.kit.g.ph !== 'flee') ring.target = ring.body.getAngle() + way * deg(9) / 14; return s2.kit.g.ph === 'flee'; });
    ok(has(log, 'kitDangle') && e.alive && e.cracks === 0 && !cracked(log) && (e.saved || e.hc === 0 || e.hc === 3), `a gap turned under them: they dangle, and the egg drops on safely (${e.saved ? 'into the basket' : e.hc === 3 ? 'caught in her sack' : 'on solid floor'})`);
    krun(sim, 8, null, (s) => s.kit.ph === 'scold');
    ok(sim.kit.fails === 1 && sim.kit.ph === 'scold', 'home again, mama scolds them');
  }
  {
    const sim = carrying(), e = sim.eggs[0];
    const n = sim.kitHit('crow');
    const log = krun(sim, 0.3);
    ok(n === 1 && has(log, 'kitDive') && !e.hc && e.cracks === 0, "Papa Rooster's crow: they drop the egg and dive back into the sack");
    const s2 = carrying(), P = s2.kitBody(s2.kit.g);
    ok(s2.kitHit('flash', { x: P.x, y: P.y, r: 1 }) === 1 && s2.kitHit('flash', { x: 99, y: 99, r: 1 }) === 0, 'a glow flash by them sends them diving; one far away does not');
  }
  {
    // three failed fetches (Easy two): she gives up, scoops them up, the eggs in her sack spill back, she trudges off
    for (const mode of ['easy', 'medium']) {
      const sim = kset({ mode }), max = M(KITS.fails, mode);
      kuntil(sim, (s) => s.kit.ph === 'smug', 90);
      const bag = sim.kit.sack.slice();
      let guard = 0;
      while (sim.kit.fails < max && guard++ < 30 && sim.state === 'play') { kuntil(sim, (s) => s.kit.g.ph === 'go' || s.kit.g.ph === 'carry' || s.kit.ph === 'sulk', 40); if (sim.kit.ph === 'sulk') break; sim.kitHit('crow'); krun(sim, 0.2); kuntil(sim, (s) => s.kit.g.ph === 'sack', 20); }
      const log = krun(sim, 20, null, (s) => s.kit.done);
      const e = sim.eggs.find((q) => q.id === bag[0]);
      ok(sim.kit.fails === max && has(log, 'kitSulk') && has(log, 'kitSpill') && sim.kit.done && sim.kit.sack.length === 0, `${mode}: ${max} failed fetches and she gives up: the eggs pop out of her sack and she trudges off`);
      ok(bag.length === 1 && e && e.alive && !e.hc && e.cracks === 0 && sim.channelOf(e) === sim.rings.length - 1, `${mode}: her egg is back on the outer floor, uncracked`);
    }
  }
  {
    // never unwinnable: with the target saved and only her sack's eggs left the level is won; when the eggs outside her
    // sack can no longer make the target she gives up at once
    const sim = kset();
    kuntil(sim, (s) => s.kit.ph === 'smug', 90);
    for (const e of sim.eggs) if (e.alive && e.hc !== 3) { sim.savedLog.push({ id: e.id, cracks: 0 }); e.saved = true; e.alive = false; if (e.body) e.body.setActive(false); }
    krun(sim, 1);
    ok(sim.state !== 'play' && sim.state !== 'lost' && sim.state !== 'failing', `target home and only her egg left: the level is won (${sim.state})`);
    const s2 = kset();
    kuntil(s2, (s) => s.kit.ph === 'smug', 90);
    const others = s2.eggs.filter((e) => e.alive && e.hc !== 3);
    others.slice(0, others.length - (s2.level.target - 1) + 0).forEach((e) => { e.alive = false; if (e.body) e.body.setActive(false); }); // broken by something else
    const lg = krun(s2, 6);
    ok(has(lg, 'kitSulk') && lg.find((e) => e.type === 'kitSulk').why === 'fair' && has(lg, 'kitSpill'), 'the eggs outside her sack can no longer make the target: she gives up at once and spills them back');
  }
  {
    // an egg falling out of the vault by her sack is caught, not broken
    const sim = kset({ egg: null });
    kuntil(sim, (s) => s.kit.ph === 'watch' || s.kit.ph === 'untie', 30);
    const e = sim.eggs[0], S = sim.kitSackPt(sim.kit);
    e.body.setTransform({ x: S.x, y: sim.groundY + 2.4 }, 0); e.body.setLinearVelocity({ x: 0, y: -1 }); e.ch = sim.rings.length; e.body.setAwake(true);
    const log = krun(sim, 2);
    ok(has(log, 'kitCatch') && e.alive && e.hc === 3, 'an egg falling by her sack is caught in it, not broken');
  }
  {
    const sim = kset({ egg: null });
    sim.scareT = 30;
    const log = krun(sim, 25);
    ok(!has(log, 'kitClimb') && sim.kit.fails === 0, 'the Scarecrow: she keeps them in the sack while it stands (no fetch, no failure)');
  }
  {
    const sim = carrying(), L = sim.kitLesson();
    ok(L && L.ring === sim.kit.g.c && L.carrying === 1, `kitLesson(): the ring they carry the egg on (ring ${L && L.ring})`);
    // determinism: the same run twice; a snapshot taken mid-carry resumes exactly
    const a = krun(kset(), 60), b = krun(kset(), 60);
    ok(a.length > 8 && JSON.stringify(a) === JSON.stringify(b), `the same fetch twice is the same fetch (${a.length} events)`);
    const S = sim.fullState(), s2 = Sim.fromState(lvK, S, { mode: 'medium' });
    const l1 = krun(sim, 12), l2 = krun(s2, 12);
    ok(has(l1, 'kitHome') && JSON.stringify(l1) === JSON.stringify(l2) && JSON.stringify(sim.kitState()) === JSON.stringify(s2.kitState()), `a snapshot taken mid-carry resumes exactly to the sack (${l1.length} events)`);
  }
  {
    // never cracks an egg, whatever the rings do (random-free sweep of brisk turns)
    let broke = 0, runs = 0;
    for (const mode of ['easy', 'medium', 'hard']) for (const step of [0, 1, 2]) {
      const sim = kset({ mode, egg: -95 + step * 10 }); runs++;
      const freed = {};
      for (let i = 0; i < 70 / DT && sim.state === 'play'; i++) {
        if (i % Math.round((3 + step) / DT) === 0) { const G = sim.kit.g; if (G.c >= 0) sim.rings[G.c].target += deg(step % 2 ? 40 : -25); }
        sim.step();
        for (const ev of sim.events) { if (/^kit(Fumble|Drop|Spill)/.test(ev.type) && ev.egg) freed[ev.egg.id] = sim.t; if ((ev.type === 'break' || ev.type === 'crack') && ev.egg && (ev.egg.hc || sim.t - (freed[ev.egg.id] ?? -9) < 1.2)) broke++; }
        sim.events.length = 0;
      }
    }
    ok(broke === 0, `the kits never crack an egg (${runs} runs of brisk turning, all modes)`);
    { // falling ice on the egg they carry: it bonks the kit riding on top, they tumble, the egg is spared
      const sim = carrying(), G = sim.kit.g, e = sim.eggs[0], p = e.body.getPosition(), c0 = e.cracks;
      const okX = !!(sim.bx && sim.bx.ice);
      if (okX) sim.bx.ice.push({ ri: -1, la: 0, rad: 0, ph: 'fall', t: 0, dur: 1, x: p.x, y: p.y + 0.62, vy: 0, big: 0, eid: e.id, fell: 1 });
      const log = krun(sim, 0.5);
      ok(okX && has(log, 'kitTumble') && log.find((q) => q.type === 'kitTumble').why === 'ice' && e.alive && e.cracks === c0 && !cracked(log), 'falling ice on the egg they carry bonks the kit on top: they tumble, the egg is not cracked');
    }
  }
}

console.log(bad ? `\n${bad} FAILED` : '\nall bandit checks passed');
process.exit(bad ? 1 : 0);
