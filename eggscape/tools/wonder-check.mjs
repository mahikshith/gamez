// Wonder Vaults proof: replays each level's scripted clear headlessly through the sim (win / saved / time), then a
// random-input soak per level (no crashes, no NaNs, no egg outside the world).
// Usage: node tools/wonder-check.mjs [key,key] [--soak N] [-v]
import { WonderGame } from '../src/sim/wonder.js';
import { WONDER_LEVELS } from '../src/data/wonder-levels.js';
import { DT } from '../src/sim/sim.js';

const deg = (d) => (d * Math.PI) / 180;
const V = process.argv.includes('-v');

// Plays a script on a fresh game. Returns the game (ended or timed out).
export function play(level, script = level.solve || [], o = {}) {
  const g = new WonderGame(level);
  const log = [];
  const tick = () => {
    g.step();
    for (const ev of g.events) {
      if (['crack', 'break', 'save', 'explode', 'timeout', 'wHatch', 'runOver', 'portal', 'bombLit'].includes(ev.type)) log.push(`${g.t.toFixed(1)} ${ev.type}${ev.why ? ':' + ev.why : ''}${g.sims.length > 1 ? '@' + ev.si : ''}`);
      if (o.onEvent) o.onEvent(ev, g);
    }
    g.events.length = 0;
    if (o.onStep) o.onStep(g);
  };
  const live = () => g.state === 'play' && g.t < (level.time || 60) + 30;
  const settle = (s) => { for (let i = 0; i < s / DT && live(); i++) tick(); };
  for (const a of script) {
    if (!live()) break;
    if (a[0] === 'wait') settle(a[1]);
    else if (a[0] === 'hen') { // ['hen', angle, way (1 ccw / -1 cw / 0 shorter), pace 0..1, waitAfter]: walk her round the rail to an angle
      const H = g.sim.hen, want = deg(a[1]), pace = a[3] || 0.5;
      let d = Math.atan2(Math.sin(want - H.target), Math.cos(want - H.target));
      if (a[2] && Math.sign(d) !== a[2]) d += a[2] * 2 * Math.PI;
      let cmd = H.target, left = d;
      while (Math.abs(left) > 1e-4 && live()) { const st = Math.sign(left) * Math.min(Math.abs(left), pace * H.speed * DT); if (!lags(g.sim, cmd, Math.sign(left))) { cmd += st; left -= st; } g.setHen(cmd); tick(); }
      settle(a[4] ?? 1.5);
    } else if (a[0] === 'set') g.turn(0, a[1], deg(a[2]));
    else if (a[0] === 'hatch') { g.hatch(); while (g.phase === 'run' && live()) tick(); if (g.phase === 'over') settle(0.5); }
    else if (a[0] === 'rewind') g.rewind();
    else if (a[0] === 'drop') { // ['drop', vault, ring, eggId, dir]: bring that ring's nearest gap (going dir) to the egg and wait for it to pass (closed loop, like a player watching)
      const [, si, ri, id, dir, w] = a, sim = g.sims[si], ring = sim.rings[ri], egg = id ? sim.eggs.find((e) => e.id === id) : sim.eggs.find((e) => e.alive && !e.saved && sim.channelOf(e) === ri) || sim.eggs.find((e) => e.alive && !e.saved), /* id 0: whichever egg waits on that ring */ rate = sim.maxOmega(ring) * 0.8, ch0 = egg ? sim.channelOf(egg) : -1;
      const off = () => { // how far the ring still has to turn (in dir) for a gap centre to reach the egg
        const p = egg.body.getPosition(), ea = Math.atan2(p.y, p.x) + (a[6] ? deg(a[6]) : 0);
        let best = 9;
        for (const gp of ring.gaps) { let d = ((ea - (ring.body.getAngle() + gp.a)) * dir) % (2 * Math.PI); if (d < -0.5) d += 2 * Math.PI; if (d < best) best = d; }
        return best;
      };
      for (let i = 0; i < 30 / DT && live() && egg && egg.alive && !egg.saved && sim.channelOf(egg) === ch0; i++) { const d = off(); if (d > 0.004) g.turn(si, ri, dir * Math.min(d, rate * DT)); tick(); }
      settle(w ?? 1.2);
    }
    else { // [vault, ring, degrees, waitAfter]
      const [si, ri, dd, w] = a, ring = g.sims[si].rings[ri], rate = g.sims[si].maxOmega(ring);
      let left = deg(dd);
      while (Math.abs(left) > 1e-4 && live()) { const s = Math.sign(left) * Math.min(Math.abs(left), rate * DT); g.turn(si, ri, s); left -= s; tick(); }
      for (let i = 0; i < 240 && live() && Math.abs(ring.target - ring.body.getAngle()) > 0.004; i++) tick();
      settle(w ?? 1.2);
    }
  }
  settle(o.tail ?? 6);
  g.log = log;
  return g;
}

// mama, like a player watching: she waits for her eggs when they lag more than LAG behind her (closed loop)
export const LAG = 0.8;
export function lags(sim, cmd, way) {
  const eggs = sim.eggs.filter((e) => e.alive && !e.saved);
  if (!eggs.length) return false;
  let best = -9;
  for (const e of eggs) { const p = e.body.getPosition(), d = Math.atan2(Math.sin(cmd - Math.atan2(p.y, p.x)), Math.cos(cmd - Math.atan2(p.y, p.x))) * way; best = Math.max(best, -d); }
  return -best > LAG; // even the egg furthest along is LAG behind her
}

const bad = (g) => {
  for (const s of g.sims) for (const e of s.eggs) {
    if (!e.alive || e.saved) continue;
    const p = e.body.getPosition(), v = e.body.getLinearVelocity();
    if (![p.x, p.y, v.x, v.y, e.body.getAngle()].every(Number.isFinite)) return 'NaN';
    if (Math.hypot(p.x, p.y) > s.outerR + 6) return 'escaped';
  }
  for (const s of g.sims) for (const r of s.rings) if (!Number.isFinite(r.body.getAngle())) return 'NaN ring';
  return null;
};

// random input: rings (or the hen) are thrown about for the whole fuse
export function soak(level, seed) {
  let s = seed >>> 0;
  const rnd = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const g = new WonderGame(level);
  let steps = 0, act = null, problem = null;
  const maxT = (level.time || 40) + 12;
  if (g.kind === 'plan') { for (const r of g.sim.rings) g.turn(0, r.i, rnd() * 6.28); g.hatch(); }
  while (g.t < maxT && steps < maxT / DT) {
    if (!act || act.n-- <= 0) act = { si: (rnd() * g.sims.length) | 0, ri: (rnd() * g.sims[0].rings.length) | 0, d: (rnd() - 0.5) * 0.06, n: 20 + ((rnd() * 200) | 0), hen: rnd() * 6.28 };
    if (g.kind === 'mama') g.setHen(act.hen);
    else if (g.kind === 'plan') { if (g.phase === 'over' || (g.state !== 'play')) { if (g.state !== 'play') break; g.rewind(); for (const r of g.sim.rings) g.turn(0, r.i, rnd() * 6.28); g.hatch(); } }
    else g.turn(act.si, act.ri, act.d);
    g.step(); steps++;
    g.events.length = 0;
    if ((problem = bad(g))) break;
    if (g.state !== 'play' && g.endT > 2) break;
  }
  return { state: g.state, t: g.t, problem, attempts: g.attempts };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv[2] && !process.argv[2].startsWith('-') ? process.argv[2].split(',') : null;
  const si = process.argv.indexOf('--soak'), N = si > 0 ? +process.argv[si + 1] : 12;
  let ok = true;
  for (const L of WONDER_LEVELS) {
    if (only && !only.includes(L.key)) continue;
    const t0 = Date.now(), g = play(L), st = g.stats();
    const won = g.state === 'won';
    ok = ok && won;
    console.log(`${L.key.padEnd(7)} ${(won ? 'WON' : g.state.toUpperCase()).padEnd(6)} stars=${g.stars()} saved=${st.saved}/${st.total} (need ${st.target}) broken=${st.broken} t=${g.t.toFixed(1)}s of ${L.time || '-'}${g.kind === 'plan' ? ' attempts=' + st.attempts : ''} g=${g.sim.g} (${Date.now() - t0} ms)`);
    if (V) console.log('   ' + g.log.join(' | '));
    let crashes = 0, probs = [], wins = 0;
    for (let k = 0; k < N; k++) {
      try { const r = soak(L, 1000 + k * 77); if (r.problem) probs.push(r.problem); if (r.state === 'won') wins++; } catch (e) { crashes++; probs.push(String(e && e.stack || e).split('\n').slice(0, 3).join(' / ')); }
    }
    ok = ok && !crashes && !probs.length;
    console.log(`        soak x${N}: crashes=${crashes} problems=${probs.length ? probs.slice(0, 3).join('; ') : 'none'} random wins=${wins}`);
  }
  console.log(ok ? 'ALL WONDER LEVELS PROVEN' : 'FAILURES ABOVE');
  process.exit(ok ? 0 : 1);
}
