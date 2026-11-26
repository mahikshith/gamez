// The frog's tricks (0.8.18, sim/frog.js): the tongue snatch (an egg into its cheeks, never cracked, never eaten, spat out
// again), the wall bonk, the belly bop (a held egg or a swallowed orb comes back), the fairness rules (Easy one snatch, none
// in the last seconds, one egg in a mouth) and the exact rewind of a frog holding an egg.
// node tools/test-frog.mjs
import { Sim, DT } from '../src/sim/sim.js';
import { FROG, FROG_MODE } from '../src/sim/frog.js';
import { LEVELS } from '../src/data/levels.js';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const D2R = Math.PI / 180;

const studio = (rings, frog, extra = {}) => ({ id: 904, kind: 'frog', theme: 'bramble', name: 'frog test', eggs: 2, target: 1, time: 0, spacing: 1.05, material: 'vine', nest: { w: 2.6 }, seed: 9044, tip: '', rings, frog, ...extra });
const R = (...g) => g.map((a) => ({ gaps: [{ a }] }));
// put egg i at rest in channel ch, angle a (deg)
const place = (s, i, ch, a, h = 0.27) => { const r = s.rings[ch].r - 0.08 - h, e = s.eggs[i]; e.body.setTransform({ x: r * Math.cos(a * D2R), y: r * Math.sin(a * D2R) }, 0); e.body.setLinearVelocity({ x: 0, y: 0 }); e.body.setAwake(true); return e; };
const run = (s, sec, on) => { for (let i = 0; i < sec / DT && s.state === 'play'; i++) { s.step(); if (on) for (const ev of s.events) on(ev, s); s.events.length = 0; } };

// ---- 1. the snatch: lock, tongue, cheeks, a hop inward, ptoo
{
  const s = new Sim(studio(R(90, -100, 90, 90), { ch: 2, a: -118, delay: 99, every: 99 }), {});
  const F = s.frogs[0]; F.snCD = 99;
  const e = place(s, 1, 2, -68);
  run(s, 1);
  F.snCD = 0;
  const seen = [], cracks0 = e.cracks;
  let held = 0, chIn = null, worst = 0;
  for (let i = 0; i < 8 / DT; i++) {
    s.step();
    if (e.hc === 4) { held++; worst = Math.max(worst, e.body.isActive() ? 1 : 0); }
    for (const ev of s.events) {
      if (/^frog(Lick|Snatch|Spit|Hop|Land)$/.test(ev.type)) seen.push(ev.type + (ev.kind ? ':' + ev.kind : '') + (ev.why ? ':' + ev.why : ''));
      if (ev.type === 'frogSpit') chIn = s.channelOf(e);
    }
    s.events.length = 0;
  }
  ok(seen[0] === 'frogLick:egg' && seen.includes('frogSnatch'), 'it locks on the egg in reach and snatches it (' + seen.join(' ') + ')');
  ok(held * DT > 1 && worst === 0, 'the egg sat in its cheeks with its body switched off (' + (held * DT).toFixed(1) + ' s)');
  ok(seen.includes('frogHop') && seen.indexOf('frogHop') > seen.indexOf('frogSnatch'), 'it hops away with the egg');
  ok(seen.includes('frogSpit:ptoo') && e.alive && e.hc === 0 && e.body.isActive(), 'it spits the egg out again, alive and loose ("ptoo")');
  ok(e.cracks === cracks0 && e.alive, 'the snatch cracked nothing');
  ok(chIn === 1, 'the egg came out one channel inward (a setback, not a loss): channel ' + chIn);
  ok(F.snN === 1 && F.snCD > 0, 'one snatch counted, a cooldown follows');
}

// ---- 2. the bonk: a wall turned into the tongue's line
{
  const s = new Sim(studio(R(90, -72, 90, 90), { ch: 2, a: -57, delay: 99, every: 99, face: -1 }), {});
  const F = s.frogs[0]; F.snCD = 99;
  const e = place(s, 1, 1, -90);
  run(s, 1);
  F.snCD = 0;
  let locked = false;
  for (let i = 0; i < 240 && !locked; i++) { s.step(); s.events.length = 0; locked = F.ph === 'lick'; }
  ok(locked && F.lk === 'egg', 'it locks on the egg in the next channel, seen through the gap');
  const ring = s.rings[1]; ring.target = ring.body.getAngle() + 32 * D2R; // the player turns the gap away: a wall in the line
  let bonk = 0, snatch = 0;
  run(s, 2, (ev) => { if (ev.type === 'frogBonk') bonk++; if (ev.type === 'frogSnatch') snatch++; });
  ok(bonk === 1 && snatch === 0, 'the tongue slaps the wall: a bonk, no snatch');
  ok(F.stn > 0 && e.hc === 0 && e.alive, 'it sits dizzy (' + F.stn.toFixed(1) + ' s left), the egg untouched');
}

// ---- 3. the bop: an egg landing on it gives back the swallowed orb, and a held egg
{
  const s = new Sim(studio(R(90, -100, 90, 90), { ch: 2, a: -100, delay: 99, every: 99 }, { orbs: [{ type: 'water', ch: 2, a: -75 }] }), {});
  const F = s.frogs[0]; F.snCD = 99;
  run(s, 3);
  ok(F.belly === 'water' && !s.orbs.some((o) => o.alive && o.type === 'water'), 'it licks the orb up: it sits in its belly');
  const e = s.eggs[1], A = Math.atan2(F.y, F.x), r = s.rings[1].r - 0.6;
  e.body.setTransform({ x: r * Math.cos(A), y: r * Math.sin(A) }, 0); e.body.setLinearVelocity({ x: 0, y: -1 }); e.body.setAwake(true);
  let bop = 0, cough = 0;
  const taken0 = s.orbsTaken;
  run(s, 1.5, (ev) => { if (ev.type === 'frogBop') bop++; if (ev.type === 'frogCough') cough++; });
  ok(bop >= 1 && cough === 1 && F.belly === '', 'an egg dropped on its back: a bop, and it coughs the orb up');
  ok(s.orbs.some((o) => o.type === 'water' && o.alive) || s.orbsTaken > taken0, 'the orb is back in play (as an orb, or already on the egg)');
}
{ // a bop on a frog with an egg in its cheeks: out it comes
  const s = new Sim(studio(R(90, 90, 90, 90), { ch: 2, a: -100, delay: 99, every: 99 }), {});
  const F = s.frogs[0]; F.snCD = 99;
  const e = place(s, 1, 2, -70);
  run(s, 0.5);
  F.snCD = 0;
  for (let i = 0; i < 400 && F.eg < 0; i++) { s.step(); s.events.length = 0; }
  ok(F.eg === e.id, 'set-up: it holds the egg');
  F.bopReq = 1;
  let why = '';
  run(s, 0.2, (ev) => { if (ev.type === 'frogSpit') why = ev.why; });
  ok(why === 'bop' && e.hc === 0 && e.body.isActive(), 'a bop makes it spit the egg out at once');
}

// ---- 4. a brisk turn of its ring makes it dizzy: out comes the egg
{
  const s = new Sim(studio(R(90, 90, 90, 90), { ch: 2, a: -100, delay: 99, every: 99 }), {});
  const F = s.frogs[0]; F.snCD = 99;
  const e = place(s, 1, 2, -70);
  run(s, 0.5);
  F.snCD = 0;
  for (let i = 0; i < 400 && F.eg < 0; i++) { s.step(); s.events.length = 0; }
  const ring = s.rings[2];
  let why = '';
  for (let i = 0; i < 120 && !why; i++) { ring.target = ring.body.getAngle() + 0.6; s.step(); for (const ev of s.events) if (ev.type === 'frogSpit') why = ev.why; s.events.length = 0; }
  ok(why === 'dizzy' && e.hc === 0, 'its ring turned briskly: dizzy, it spits the egg (' + why + ')');
}

// ---- 5. fair: Easy snatches once a level, never in the last seconds, rewind is exact
{
  const cnt = (mode, time) => {
    const s = new Sim(studio(R(90, 90, 90, 90), { ch: 2, a: -100, delay: 99, every: 99 }, { time }), { mode });
    const F = s.frogs[0]; F.snCD = 0;
    let n = 0;
    for (let k = 0; k < 3; k++) {
      place(s, 1, 2, -72);
      run(s, 7, (ev) => { if (ev.type === 'frogSnatch') n++; });
      F.snCD = 0;
    }
    return n;
  };
  ok(cnt('easy', 0) === 1, 'Easy: one snatch a level');
  ok(cnt('medium', 0) >= 2, 'Medium: more than one, with a cooldown between');
  const s = new Sim(studio(R(90, 90, 90, 90), { ch: 2, a: -100, delay: 99, every: 99 }, { time: 60 }), {});
  s.timeLeft = FROG.snTail + 0.5; s.frogs[0].snCD = 0; place(s, 1, 2, -72);
  let n = 0; run(s, 0.4, (ev) => { if (ev.type === 'frogLick' && ev.kind === 'egg') n++; });
  ok(n === 0, 'no lock-on in the last ' + FROG.snTail + ' s of the fuse');
  ok(FROG_MODE.easy.snWarn > FROG_MODE.medium.snWarn && FROG_MODE.easy.snReach < FROG_MODE.medium.snReach, 'Easy: a longer warning and a shorter tongue');
}
{
  const s = new Sim(studio(R(90, -100, 90, 90), { ch: 2, a: -118, delay: 99, every: 99 }), {});
  const F = s.frogs[0]; F.snCD = 99; place(s, 1, 2, -68); run(s, 1); F.snCD = 0;
  for (let i = 0; i < 600 && !(F.eg >= 0 && F.ph === 'sit'); i++) { s.step(); s.events.length = 0; }
  const L = studio(R(90, -100, 90, 90), { ch: 2, a: -118, delay: 99, every: 99 });
  const S = s.fullState(), c = Sim.fromState(L, S);
  const eA = s.eggs.find((e) => e.id === F.eg), eB = c.eggs.find((e) => e.id === F.eg);
  ok(F.eg >= 0 && eB && eB.hc === 4 && !eB.body.isActive() && c.frogs[0].eg === F.eg, 'a saved state restores the frog holding the egg (body off)');
  run(s, 4); run(c, 4);
  const pa = eA.body.getPosition(), pb = eB.body.getPosition();
  ok(Math.hypot(pa.x - pb.x, pa.y - pb.y) < 0.05 && s.frogs[0].ph === c.frogs[0].ph, 'and plays on the same: the spit lands the egg at the same spot');
}

// ---- 6. its level: the frog of Woodcutter Glade snatches in a game played without care, and the egg survives it
{
  const L = LEVELS.find((l) => l.id === 9);
  const s = new Sim(L, {});
  let sn = 0, broke = 0;
  const hold = new Set();
  // a slow player: every ring goes round a little, now and then, so the eggs wander the vault
  for (let i = 0; i < 75 / DT && s.state === 'play'; i++) {
    if (i % 300 === 0) { const r = s.rings[(i / 300) % s.rings.length]; r.target = r.body.getAngle() + (((i / 300) % 2) ? 1 : -1) * 40 * D2R; }
    s.step();
    for (const ev of s.events) { if (ev.type === 'frogSnatch') { sn++; hold.add(ev.egg); } if (ev.type === 'eggBreak' && hold.has(ev.egg?.id)) broke++; }
    s.events.length = 0;
  }
  ok(broke === 0, 'L9: no egg the frog held broke while it held it');
}

console.log(bad ? `\n${bad} FAILED` : '\nall frog checks passed');
process.exit(bad ? 1 : 0);
