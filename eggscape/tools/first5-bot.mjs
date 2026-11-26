// The clumsy first-timer (2026-11-20, the first-five ladder): plays a level the way a new player does, with no
// look-ahead about thorns. Each move: take the lowest egg (the one furthest out of the vault), turn the ring under it
// toward the nearest open gap, overshooting by 15-25 degrees, then wait a human beat and repeat. A thorn curtain is only
// turned onto once the egg carries a flame (until then it waits for the swaying flame orb). It reacts to a crouching
// weasel about half the time (a short turn of the ring under its target, after a reaction delay) and taps Papa Rooster
// most of the time once an egg has been stolen; a hatched chick gets tapped a moment after it hatches, the way the coach bubble asks (from L5, where his button first shows).
//
// Usage: node tools/first5-bot.mjs [ids=1,2,3,4,5] [--runs 200] [--mode medium]
//   -> per level: win rate, median time to win, mean eggs lost, why runs failed
import { Sim, DT } from '../src/sim/sim.js';
import { LEVELS } from '../src/data/levels.js';
import { rng } from '../src/sim/geom.js';

const DEG = Math.PI / 180;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function hold(sim) { for (const r of sim.rings) if (!r.motor) r.target = r.body.getAngle(); }
// every sim step goes through here: it notes why eggs broke, then drops the events
function tick(sim, B) {
  sim.step();
  for (const ev of sim.events) if (ev.type === 'break') B.why[ev.why] = (B.why[ev.why] || 0) + 1;
  for (const ev of sim.events) if (ev.type === 'bandReach') B.paw = 1; else if (ev.type === 'bandGrab') B.steal++; else if (ev.type === 'bandPinch') B.pinch++; // 0.8.17 bandit
  sim.events.length = 0;
}
function wait(sim, s, B) {
  for (let t = 0; t < s && sim.state === 'play'; t += DT) { hold(sim); tick(sim, B); react(sim, B); }
}
// turn ring i by delta at a finger's pace (a little under the ring's top speed)
function turn(sim, i, delta, B) {
  const ring = sim.rings[i], goal = ring.body.getAngle() + delta, cap = Math.abs(delta) / (sim.maxOmega(ring) * 0.8) + 1.2;
  for (let t = 0; t < cap && sim.state === 'play'; t += DT) {
    hold(sim);
    ring.target = ring.body.getAngle() + Math.max(-0.45, Math.min(0.45, goal - ring.body.getAngle()));
    tick(sim, B);
    if (Math.abs(goal - ring.body.getAngle()) < 0.02) break;
  }
}
// reflexes that run while waiting: Papa Rooster, a crouching weasel
function react(sim, B) {
  const R = B.R;
  // a hatched chick with its power unused: the player taps it a little while after it hatches (no aiming)
  for (const e of sim.eggs) {
    if (!e.alive || e.saved || !e.chick || e.powU || !sim.tapChick) continue;
    if (e.tapAt == null) e.tapAt = sim.t + 0.8 + R() * 2.5;
    else if (sim.t >= e.tapAt) { sim.tapChick(e.id); e.tapAt = Infinity; B.taps++; }
  }
  if (B.paw) { B.paw = 0; if (R() < 0.5) B.pending = { at: sim.t + 0.3 + R() * 0.5, ring: sim.rings.length - 1, d: (R() < 0.5 ? -1 : 1) * (20 + R() * 20) * DEG }; } // 0.8.17 bandit: half the time the player turns the outer ring on his paw
  if (B.pending && !(sim.thieves && sim.thieves.length) && sim.t >= B.pending.at) { const P = B.pending; B.pending = null; turn(sim, P.ring, P.d, B); }
  if (!sim.thieves || !sim.thieves.length) return;
  if (sim.level.id >= 5 && sim.allyAvailable && sim.allyAvailable('rooster') && sim.eggs.some((e) => e.thf || (e.alive && !e.saved && sim.thiefThreat(e) >= 1))) {
    if (B.roosterAt == null) B.roosterAt = sim.t + 0.8 + R() * 2.5;
    if (sim.t >= B.roosterAt && B.roosterWill) { if (sim.callAlly('rooster')) B.rooster++; B.roosterAt = Infinity; }
  }
  for (const T of sim.thieves) {
    if (T.ph !== 'crouch' || T.tgt == null || B.crouch === T) continue;
    B.crouch = T;
    if (R() > 0.5) continue; // half the time the player does not notice
    const e = sim.eggs.find((q) => q.id === T.tgt);
    if (!e || !e.alive || e.saved) continue;
    B.pending = { at: sim.t + 0.2 + R() * 0.4, ring: Math.min(sim.channelOf(e), sim.rings.length - 1), d: (R() < 0.5 ? -1 : 1) * (25 + R() * 20) * DEG };
  }
  if (B.crouch && B.crouch.ph !== 'crouch' && B.crouch.ph !== 'leap') B.crouch = null;
  if (B.pending && sim.t >= B.pending.at) { const P = B.pending; B.pending = null; B.bonks++; turn(sim, P.ring, P.d, B); }
}

export function clumsy(L, seed, mode = 'medium') {
  const sim = new Sim(L, { mode });
  const R = rng(seed);
  const B = { R, taps: 0, why: {}, crouch: null, pending: null, bonks: 0, rooster: 0, roosterAt: null, roosterWill: R() < 0.75, paw: 0, steal: 0, pinch: 0 };
  wait(sim, 0.6 + R() * 0.8, B); // looking at the vault first
  let moves = 0;
  while (sim.state === 'play' && sim.t < 400 && moves < 200) {
    const eggs = sim.aliveEggs().filter((e) => !e.thf);
    if (!eggs.length) { wait(sim, 0.5, B); continue; }
    // the lowest egg: furthest out (ties: lowest on screen)
    eggs.sort((a, b) => sim.channelOf(b) - sim.channelOf(a) || a.body.getPosition().y - b.body.getPosition().y);
    const hot = eggs.find((q) => q.fire > 0.8 && sim.rings[sim.channelOf(q)] && sim.rings[sim.channelOf(q)].gaps.some((g) => g.curtain && g.curtain.alive));
    if (hot) eggs.unshift(hot); // the glowing egg is the one to follow (the tip says so)
    const e = eggs[0], c = sim.channelOf(e);
    if (c < sim.rings.length && R() < 0.85) { wait(sim, 0.5 + R() * 1.1, B); if (sim.state !== 'play') break; } // a first-timer looks before each move
    if (c >= sim.rings.length) { wait(sim, 0.3, B); continue; } // falling out to the basket
    const ring = sim.rings[c], p = e.body.getPosition(), local = Math.atan2(p.y, p.x) - ring.body.getAngle();
    let gaps = ring.gaps.filter((g) => !g.grate && sim.gapOpenFor(g, e));
    if (!gaps.length) {
      const cur = ring.gaps.filter((g) => g.curtain && g.curtain.alive);
      if (cur.length && e.fire > 0.8) gaps = cur; // carrying the flame: onto the curtain
      else if (cur.length) { // wait for the flame to sway past; nudge now and then
        // a nudge, the way that keeps the curtain from coming round under the egg
        const cd = wrap(local - cur[0].a);
        if (R() < 0.35) turn(sim, c, -Math.sign(cd || 1) * (20 + R() * 30) * DEG, B); else wait(sim, 0.8 + R() * 0.8, B);
        moves++; continue;
      }
    }
    if (!gaps.length) { turn(sim, c, (R() < 0.5 ? -1 : 1) * 60 * DEG, B); moves++; continue; }
    let best = null;
    for (const g of gaps) { const d = wrap(local - g.a); if (!best || Math.abs(d) < Math.abs(best)) best = d; }
    const over = (15 + R() * 10) * DEG * Math.sign(best || 1);
    turn(sim, c, best + over, B);
    moves++;
    // a human beat: let it roll, then look again
    wait(sim, 0.35 + R() * 0.9, B);
    for (let s = 0; s < 2.5 && sim.state === 'play' && sim.aliveEggs().some((q) => q.body.getLinearVelocity().length() > 0.4); s += 0.1) wait(sim, 0.1, B);
  }
  while (sim.state === 'winning' || sim.state === 'failing') tick(sim, B);
  const st = sim.stats();
  return { won: sim.state === 'won', t: sim.t, saved: st.saved, lost: st.total - st.saved, broken: st.broken, timeout: sim.timeLimit > 0 && sim.timeLeft <= 0, moves, bonks: B.bonks, rooster: B.rooster, why: B.why, steal: B.steal, pinch: B.pinch, beaten: sim.band ? sim.band.done : 0 };
}

if (process.argv[1] && process.argv[1].endsWith('first5-bot.mjs')) {
  const args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const ids = args[0] && !args[0].startsWith('--') ? args[0].split(',').map(Number) : [1, 2, 3, 4, 5];
  const runs = +opt('--runs', 200), mode = opt('--mode', 'medium');
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
  for (const id of ids) {
    const L = LEVELS.find((q) => q.id === id);
    const res = [];
    for (let k = 0; k < runs; k++) res.push(clumsy(L, 1000 + k * 7919 + id, mode));
    const W = res.filter((r) => r.won), why = {};
    for (const r of res) for (const [k, v] of Object.entries(r.why)) why[k] = (why[k] || 0) + v;
    console.log(`L${id} ${L.name}: rings ${L.rings.length}, fuse ${L.time || 'none'} | wins ${W.length}/${runs} = ${((100 * W.length) / runs).toFixed(1)}% | median win ${med(W.map((r) => r.t)).toFixed(1)} s | eggs lost/run ${(res.reduce((a, r) => a + r.lost, 0) / runs).toFixed(2)} (broken ${(res.reduce((a, r) => a + r.broken, 0) / runs).toFixed(2)}) | fails: timeout ${res.filter((r) => !r.won && r.timeout).length}, other ${res.filter((r) => !r.won && !r.timeout).length} | eggs broke by ${JSON.stringify(why)}${L.raccoon ? ` | Bandit: steals/run ${(res.reduce((a, r) => a + r.steal, 0) / runs).toFixed(2)}, pinches/run ${(res.reduce((a, r) => a + r.pinch, 0) / runs).toFixed(2)}, beaten ${res.filter((r) => r.beaten).length}` : ''}`); // 0.8.17 bandit
  }
}
