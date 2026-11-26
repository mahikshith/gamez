// Bandit the raccoon, the boss of level 6 (0.8.17, sim/bandit.js): node tools/test-bandit.mjs   (exits 1 on a failure)
// No browser: the real level 6 with its outer ring set where a test wants it and one egg resting on the outer channel's
// floor near a gap in his arc. Checks each trick (the sneak and the ~1 s lip-lick telegraph before a reach, the pinch,
// three pinches bag him and spill his sack back, the one whistle for the weasel), each counter (turn the ring, the glow
// flash, a zap, a hot or fast egg on his arm, a stone egg, the Scarecrow, the rooster, the frost, a saved egg), each store
// booster and chick power, determinism (the same run twice, a snapshot resumed mid-reach), and that he can never make
// the level unwinnable (he never breaks an egg, every bagged egg comes back, he goes fishing while his sack is full).
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

// the outer ring's first gap at angle gap (deg); egg 0 resting on the outer channel floor at angle egg (deg); every
// ring held where it is
function setup({ mode = 'medium', opts = {}, gap = -112, egg = -92, lv = L6 } = {}) {
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
    for (const ev of sim.events) if (/^band|^thief|^weasel/.test(ev.type)) { log.push({ t: +sim.t.toFixed(3), type: ev.type, why: ev.why, hits: ev.hits }); if (each) each(sim, ev); }
    sim.events.length = 0;
    if (stop && stop(sim)) break;
  }
  return log;
}
const outerOf = (sim) => sim.rings[sim.rings.length - 1];
const turn = (sim, d) => { const o = outerOf(sim); o.target = o.body.getAngle() + d; };
const has = (log, type) => log.some((e) => e.type === type);
const first = (log, type) => log.find((e) => e.type === type);
const count = (log, type) => log.filter((e) => e.type === type).length;
// ---------------------------------------------------------------- the level
{
  ok(L6 && L6.boss === 'raccoon' && L6.bossFight && L6.bossFight.kind === 'raccoon' && L6.raccoon, 'level 6 is Bandit\'s boss level (boss, bossFight, his own key)');
  ok(/turn/i.test(L6.tip) && L6.intro && /PINCH/.test(L6.intro.line) && L6.intro.line.length <= 90, 'the level card says the counter in one line: ' + L6.intro.line);
  const T = bossTreasure(6);
  ok(T && T.coins > 0 && BOOSTERS[T.booster] && T.charges === 1, `his chest: ${T && T.coins} coins, a ${T && T.booster} booster and a charge`);
  const sim = setup();
  const g = sim.bandGeo(), nl = sim.nestX0 - sim.nestW / 2;
  ok(g.x1 <= nl - BAND.room + 1e-9 && g.x0 < g.x1, `his yard (x ${g.x0.toFixed(2)} .. ${g.x1.toFixed(2)} m) stays left of the basket (rim at ${nl.toFixed(2)})`);
}

// ---------------------------------------------------------------- trick 1: sneak, telegraph, reach, grab, bag
for (const mode of ['easy', 'medium', 'hard']) {
  const sim = setup({ mode });
  const log = run(sim, 14);
  const pk = first(log, 'bandPeek'), rc = first(log, 'bandReach'), gr = first(log, 'bandGrab'), st = first(log, 'bandStuff');
  const tel = rc && pk ? rc.t - pk.t : 0;
  ok(pk && rc && tel >= 0.9 && tel <= 1.7, `${mode}: he sneaks up, licks his lips for ${tel.toFixed(2)} s (the telegraph), then reaches`);
  ok(gr && st && sim.eggs[0].hc === 3 && sim.band.sack.includes(sim.eggs[0].id), `${mode}: untouched, his paw takes the egg out through the gap and into his sack`);
  ok(!has(log, 'bandPinch'), `${mode}: no pinch without a turn`);
}

// ---------------------------------------------------------------- trick 2: the pinch, three pinches bag him
{
  // one pinch while his paw is in: he yelps, drops what he holds, hits 1
  const sim = setup();
  let reachAt = -1, turned = 0;
  const log = [];
  for (let i = 0; i < 12 / DT && sim.state === 'play'; i++) {
    sim.step();
    for (const ev of sim.events) { if (/^band/.test(ev.type)) log.push({ t: sim.t, ...ev }); if (ev.type === 'bandReach') reachAt = sim.t; }
    sim.events.length = 0;
    if (!turned && reachAt > 0 && sim.t > reachAt + BAND.shoot + 0.2) { turn(sim, 0.3); turned = 1; }
    if (log.some((e) => e.type === 'bandPinch')) break;
  }
  const P = log.find((e) => e.type === 'bandPinch');
  ok(P && P.why === 'pinch' && P.hits === 1 && P.left === 2, 'turning the ring while his paw is in pinches it: hit 1, 2 to go');
  ok(sim.band.ph === 'pinch' && !sim.band.eid, 'he yelps and holds nothing');
  run(sim, 4);
  ok(sim.eggs[0].alive && !sim.eggs[0].hc && sim.channelOf(sim.eggs[0]) === sim.rings.length - 1, 'the egg stays in the vault (on the outer channel floor)');
}
// the whole fight: he bags one egg, then three pinches; he whistles once (after the second) and the sack spills back
function fight(mode, delay = 0.25, secs = 70) {
  const sim = setup({ mode });
  let at = -1, sgn = -1, broke = 0;
  const log = [], freed = {};
  for (let i = 0; i < secs / DT && sim.state === 'play'; i++) {
    sim.step();
    for (const ev of sim.events) { if (ev.type === 'bandDrop' || ev.type === 'bandSpill') freed[ev.egg.id] = sim.t; if ((ev.type === 'break' || ev.type === 'crack') && ev.egg && (ev.egg.hc || sim.t - (freed[ev.egg.id] ?? -9) < 1.0)) broke++; }
    for (const ev of sim.events) { if (/^band|^thief/.test(ev.type)) log.push({ t: +sim.t.toFixed(3), type: ev.type, why: ev.why, hits: ev.hits, n: ev.n }); if (ev.type === 'bandReach' && sim.band.sack.length) at = sim.t + BAND.shoot + delay; }
    sim.events.length = 0;
    if (at > 0 && sim.t >= at) { turn(sim, 0.3 * sgn); sgn = -sgn; at = -1; }
    if (sim.band.done && !sim.band.spill.length && i % 60 === 0 && log.some((e) => e.type === 'bandSpill')) break;
  }
  return { sim, log, broke };
}
for (const mode of ['easy', 'medium', 'hard']) {
  const { sim, log, broke } = fight(mode);
  ok(broke === 0, `${mode}: no egg he held, bagged, dropped or spilled cracks`);
  const pin = log.filter((e) => e.type === 'bandPinch'), D = first(log, 'bandDefeat');
  ok(first(log, 'bandStuff') && pin.length === 3 && pin.map((p) => p.hits).join() === '1,2,3', `${mode}: one egg bagged, then three pinches (${pin.map((p) => p.t.toFixed(1)).join(', ')} s)`);
  ok(D && D.n >= 1 && sim.band.done && sim.band.ph === 'defeated', `${mode}: the third pinch bags HIM: dizzy, then he tumbles into his sack (${D ? D.t.toFixed(1) : '-'} s)`);
  const e = sim.eggs[0];
  ok(has(log, 'bandSpill') && e.alive && !e.hc && sim.channelOf(e) === sim.rings.length - 1 && sim.band.sack.length === 0, `${mode}: his sack spills every egg back into the vault`);
  ok(count(log, 'bandWhistle') === 1 && first(log, 'bandWhistle').t > pin[1].t && first(log, 'bandWhistle').t < pin[2].t, `${mode}: one whistle, after the second pinch`);
  ok(sim.bx.boss.t > 1e8, `${mode}: the boss bar is done with him`);
  ok(sim.bandBossBar().label === 'BAGGED!' && sim.bandBossBar().hp === 0, `${mode}: the bar says BAGGED!`);
}

// ---------------------------------------------------------------- trick 3: the whistle (the level's waiting weasel hunts, then goes home)
{
  const { sim, log } = fight('medium', 0.25, 90);
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

// ---------------------------------------------------------------- the counters
// reach and wait until his paw is in the vault: returns the sim at that moment
function pawIn(o = {}) {
  const sim = setup(o);
  run(sim, 12, null, (s) => s.bandIn(s.band) && s.band.ph === 'grope');
  return sim;
}
{
  const sim = pawIn();
  ok(sim.bandIn(sim.band), 'set-up: his paw is through the gap');
  const n = sim.bandHit('flash', { ...sim.bandPaw(sim.band), r: 1.0 });
  ok(n === 1 && sim.band.hits === 1 && sim.band.why === 'flash', 'the glow chick\'s flash on his paw counts as a pinch');
}
{
  const sim = pawIn();
  sim.bandHit('bolt', { ...sim.bandPaw(sim.band), r: 1.0 });
  ok(sim.band.hits === 1 && sim.band.why === 'zap', 'lightning on his paw counts as a pinch (a zap)');
}
{
  const sim = pawIn();
  const p = sim.bandPaw(sim.band), e = sim.eggs[1];
  e.body.setTransform({ x: p.x + 0.1, y: p.y + 0.05 }, 0); e.body.setLinearVelocity({ x: 2.5, y: 0 }); e.body.setActive(true); e.hc = 0;
  const log = run(sim, 0.1);
  ok(sim.band.hits === 1 && sim.band.why === 'bump', 'a fast egg rolling into his arm knocks it (a hit)');
}
{
  const sim = pawIn();
  const p = sim.bandPaw(sim.band), e = sim.eggs[1];
  e.body.setTransform({ x: p.x + 0.1, y: p.y + 0.05 }, 0); e.body.setLinearVelocity({ x: 0, y: 0 }); e.fire = 3; e.fireKind = 'fire_red';
  run(sim, 0.1);
  ok(sim.band.hits === 1 && sim.band.why === 'hot', 'a burning egg by his paw burns it (a hit)');
}
{
  const sim = setup();
  sim.eggs[0].stone = 30;
  const log = run(sim, 12);
  ok(has(log, 'bandStrain') && has(log, 'bandHeavy') && !has(log, 'bandGrab') && !sim.eggs[0].hc, 'a stone egg is too heavy: he tugs, gives up, the egg stays');
}
{
  const sim = setup({ opts: { scare: true } });
  const log = run(sim, 19);
  ok(has(log, 'bandScared') && !has(log, 'bandReach') && sim.band.x <= sim.bandGeo().x0 + 0.05, 'the Scarecrow: he keeps to the far end of his yard while it stands (no reach in 19 s)');
  const more = run(sim, 15);
  ok(has(more, 'bandReach'), 'and he is back once it is gone');
}
{
  const sim = pawIn();
  run(sim, 2, null, (s) => !!s.band.eid);
  const held = !!sim.band.eid;
  bossStun(sim, 3);
  const log = run(sim, 0.2);
  ok(held && has(log, 'bandStun') && has(log, 'bandDrop') && !sim.band.eid, 'Papa Rooster\'s crow: he lets go of the egg and reels');
  run(sim, 1.2);
  ok(sim.band.ph === 'stun' || sim.band.ph === 'retract', 'dizzy while the crow lasts (' + sim.band.ph + ')');
}
{
  const sim = pawIn();
  run(sim, 2, null, (s) => !!s.band.eid);
  sim.bx.boss.stk = 4;
  let log = run(sim, 0.2);
  ok(has(log, 'bandFreeze') && has(log, 'bandDrop') && sim.band.held === 1 && !sim.band.eid, 'the Frost chick: frozen where he stands, the egg dropped back into the vault');
  turn(sim, 0.3);
  log = run(sim, 1.5);
  ok(has(log, 'bandPinch') && sim.band.hits === 1, 'a frozen arm in the gap is still pinched by a turn (and the pinch thaws him)');
}
{
  const sim = setup();
  run(sim, 12, null, (s) => s.band.ph === 'peek');
  sim.bx.boss.flinch = 0.9;
  const log = run(sim, 0.1);
  ok(has(log, 'bandHuh') && sim.band.ph === 'huh', 'an egg saved while he licks his lips startles him off the reach ("huh?")');
}
{
  const sim = setup();
  run(sim, 12, null, (s) => s.band.ph === 'peek');
  turn(sim, 0.45);
  const log = run(sim, 1.5);
  ok(has(log, 'bandHuh') && !has(log, 'bandReach'), 'turning his gap away while he licks his lips loses it ("huh?")');
}
{
  // an egg falling out of the vault over his yard: he catches it (into the sack) instead of letting it break
  const sim = setup({ egg: null });
  const e = sim.eggs[0], g = sim.bandGeo();
  sim.band.cd = 0; sim.band.x = g.home;
  e.body.setTransform({ x: g.home + 0.3, y: sim.groundY + 3.4 }, 0); e.body.setLinearVelocity({ x: 0, y: -1 }); e.ch = sim.rings.length; e.body.setAwake(true);
  const log = run(sim, 3);
  ok(has(log, 'bandCatch') && e.alive && (e.hc === 3 || e.hc === 2), 'an egg falling into his yard is caught, not broken (it is in his sack)');
}

// ---------------------------------------------------------------- every store booster
{
  const runs = {};
  for (const id of Object.keys(BOOSTERS)) {
    const sim = setup({ opts: { [id]: true } });
    if (id === 'golden') sim.eggs[0].golden = true;
    if (id === 'stone') sim.eggs[0].stone = Math.max(sim.eggs[0].stone || 0, 8);
    runs[id] = { sim, log: run(sim, 16) };
  }
  const R = runs;
  { const L = R.stone.log, h = first(L, 'bandHeavy'), g = first(L, 'bandGrab'); ok(h && (!g || g.t > h.t + 1), `Stone shell: while it lasts (8 s) the stone egg is too heavy for him (gives up at ${h ? h.t.toFixed(1) : '-'} s${g ? ', takes it at ' + g.t.toFixed(1) + ' s once the shell is gone' : ''})`); }
  ok(has(R.golden.log, 'bandGrab') && R.golden.sim.eggs[0].hc === 3, 'Golden shell: no help against him (he bags it; a pinch or his defeat gives it back)');
  ok(R.time.sim.timeLimit === new Sim(L6, { mode: 'medium' }).timeLimit + 15 && has(R.time.log, 'bandStuff'), 'Extra time: 15 s more fuse; he is unchanged');
  ok(has(R.sponge.log, 'bandStuff') && has(R.snips.log, 'bandStuff'), 'Sponge pad, Snips: nothing of his changes');
  { const s = R.nest.sim, g = s.bandGeo(), nl = s.nestX0 - s.nestW / 2; ok(g.x1 <= nl - BAND.room + 1e-9 && has(R.nest.log, 'bandPeek'), `Wider basket: his yard shrinks with it (to x ${g.x1.toFixed(2)}), he still works`); }
  ok(has(R.scare.log, 'bandScared') && !has(R.scare.log, 'bandReach'), 'Scarecrow: he keeps away while it stands');
  // Rewind: a snapshot taken with an egg in his sack comes back exactly
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
    const sim = pawIn();
    run(sim, 2, null, (s) => !!s.band.eid);
    const T = tgt(sim);
    // what each chick does to a boss (sim/strike.js): ice (freeze, glue, tock), else a stun
    const ice = ['freeze', 'glue', 'tock'].includes(S.id);
    if (S.id === 'phoenix' || S.id === 'bubble') {
      // they act on an egg, not on him: an egg in his paw or sack cannot be carried or bubbled (reefFit)
      ok(!sim.reefFit(sim.eggs.find((e) => e.id === sim.band.eid) || sim.eggs[0]) || !sim.band.eid, `${S.name}: works on eggs; the one in his paw is his until a pinch or a stun`);
      continue;
    }
    sim.stkApply(T, ice ? 'ice' : S.id === 'tornado' ? 'spin' : 'bolt', 3, S.id, true);
    const log = run(sim, 0.3);
    ok(!sim.band.eid && (ice ? has(log, 'bandFreeze') : has(log, 'bandStun')), `${S.name}: ${ice ? 'frozen' : 'stunned'}, he lets go of the egg`);
  }
  // the practice powers (sim/powers2.js p2Boss) and the glow chick's flash
  for (const k of ['ice', 'bolt', 'out', 'zap', 'pepper']) {
    const sim = pawIn();
    sim.p2Boss(k, 3);
    const log = run(sim, 0.3);
    ok(k === 'pepper' ? sim.bx.boss.flinch > 0 : has(log, 'bandStun'), `power ${k}: ${k === 'pepper' ? 'a flinch (a peek is spoiled)' : 'dizzy, he lets go'}`);
  }
}

// ---------------------------------------------------------------- determinism
{
  const a = fight('medium').log, b = fight('medium').log;
  ok(a.length > 10 && JSON.stringify(a) === JSON.stringify(b), `the same fight twice is the same fight (${a.length} events)`);
  // a snapshot mid-reach resumes exactly
  const s1 = pawIn(), S = s1.fullState(), s2 = Sim.fromState(L6, S, { mode: 'medium' });
  for (const s of [s1, s2]) for (const r of s.rings) r.target = r.body.getAngle();
  const l1 = run(s1, 8), l2 = run(s2, 8);
  ok(JSON.stringify(l1) === JSON.stringify(l2) && JSON.stringify(s1.bandState()) === JSON.stringify(s2.bandState()), `a snapshot taken with his paw in the vault resumes exactly (${l1.length} events)`);
}

// ---------------------------------------------------------------- never unwinnable
{
  // he never breaks an egg; with the sack full he goes fishing through the gap (so he can always be pinched); when only
  // bagged eggs are left and the target is saved, the level is won; bagged eggs come back when he is beaten
  let broke = 0, fish = 0, runs = 0;
  for (const mode of ['easy', 'medium', 'hard']) for (const gap of [-140, -120, -105]) for (const egg of [-80, -95, -110]) {
    const sim = setup({ mode, gap, egg });
    runs++;
    const log = [], freed = {};
    for (let i = 0; i < 40 / DT && sim.state === 'play'; i++) {
      sim.step();
      for (const ev of sim.events) {
        if (ev.type === 'bandDrop' || ev.type === 'bandSpill') freed[ev.egg.id] = sim.t;
        if ((ev.type === 'break' || ev.type === 'crack') && ev.egg && (ev.egg.hc || sim.t - (freed[ev.egg.id] ?? -9) < 1.0)) broke++; // in his paw or sack, or just let go
        if (/^band/.test(ev.type)) log.push(ev);
      }
      sim.events.length = 0;
    }
    if (sim.band.sack.length && log.some((e) => e.type === 'bandReach' && !sim.band.done)) fish++;
  }
  ok(broke === 0, `he never breaks an egg (${runs} runs, all modes)`);
  ok(fish > 0, `with an egg in his sack he keeps reaching (fishing) through his gap, so he can always be pinched (${fish} of ${runs} runs)`);
  // the target saved and only bagged eggs left: the level ends as a win
  const sim = setup();
  run(sim, 14);
  const e0 = sim.eggs[0];
  ok(e0.hc === 3, 'set-up: one egg in his sack');
  for (const e of sim.eggs) if (e !== e0 && e.alive) { sim.savedLog.push({ id: e.id, cracks: 0 }); e.saved = true; e.alive = false; if (e.body) e.body.setActive(false); }
  run(sim, 1);
  ok(sim.state !== 'play' && sim.savedLog.length >= L6.target && sim.state !== 'lost', `the target home and only his bagged egg left: the level is won (${sim.state})`);
}

console.log(bad ? `\n${bad} FAILED` : '\nall bandit checks passed');
process.exit(bad ? 1 : 0);
