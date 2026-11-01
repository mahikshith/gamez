// ---------- bosses (v3.1) ----------
// Boss fights, falling ice and the temporary walls/locks they leave behind. Everything here is plain data in
// sim.bx (copied by v31State / restored by v31Load), so rewind, the planner and the in-game hint stay exact.
//
// level.bossFight = { kind, hp?, delay?, gale?, throws?, phases: [{ at?: {saved, t}, attacks: [names], every, ... }] }
//   kind: fox snake blizzard golem salamander storm foxking. A phase starts when `saved` eggs are in the nest or
//   `t` seconds have passed (Medium; scaled by the mode), whichever comes first. Attacks run in the listed order,
//   one every `every` seconds, each with a telegraph (WARN) first. Saving an egg staggers the boss: the attack it
//   is winding up is cancelled.
//   attacks: gale (blizzard wind), freeze (one ring can't turn), icicles (volley over the eggs), stomp (golem:
//   quake, crystal walls, glass cracks), punch (golem: spins a ring 90 deg), rock / rock2 (salamander: aimed lava
//   rocks), throw / throw2 (fox: aimed orbs), fog (fox king: hides a ring), bolt / bolt2 (storm: lightning aimed at
//   the ring section under an egg). Phase flags: heat (salamander: eggs that wait too long in one channel crack),
//   summon (the level's waiting snakes come in).
// level.gusts = { every, delay, strength, dur }: telegraphed wind (streaks first) that shoves eggs and snakes.
// level.icicles = { every, delay, big } (Frozen Lake): an icicle grows on the ring right above an egg, shakes,
//   then drops. It cracks an egg it hits; on a ring floor it leaves a frictionless ice patch. Every `big`-th drop
//   is a big chunk: it cracks twice, freezes the ring it lands on and stands as an ice wall that melts.
// orb 'frost': the ring under the egg that takes it freezes for 3 s.
import { Vec2, Polygon } from 'planck';
import { RING_TH, TAU, wrap, clamp } from './geom.js';

// mode scaling: every = attack gap x, warn = telegraph x, power = gale x, hold = freeze/fog/wall time x, heat = heat limit x
export const BOSS_MODE = {
  easy: { every: 1.45, warn: 1.3, power: 0.6, hold: 0.75, heat: 1.5, n: 2 },
  medium: { every: 1, warn: 1, power: 1, hold: 1, heat: 1, n: 3 },
  hard: { every: 0.85, warn: 0.85, power: 1.12, hold: 1.1, heat: 0.85, n: 3 },
};
const WARN = { gale: 1.1, freeze: 1.0, icicles: 1.0, stomp: 1.0, punch: 1.1, rock: 0.45, rock2: 0.45, throw: 0.9, throw2: 0.9, fog: 1.0, bolt: 1.0, bolt2: 1.0, gust: 1.0 };
const GALE_T = 2.6, FREEZE_T = 4, FROST_ORB_T = 3, CHUNK_FREEZE_T = 3, FOG_T = 3.5, WALL_T = 8, ICE_WALL_T = 6, PATCH_T = 6;
const ICE_HANG = 1.1; // s an icicle shakes before it drops (level icicles; a volley uses WARN.icicles)
const THROW_FLY = 0.6, PUNCH_W = 2.4, HEAT_T = 9;
export const BOSS_TITLE = { fox: 'The Fox', snake: 'Serpent Hollow', blizzard: 'The Blizzard', golem: 'Crystal Golem', salamander: 'Lava Salamander', storm: 'Thunderstorm', eagle: 'Storm Eagle', foxking: 'The Fox King' };
export const ATTACK_NAME = { gale: 'Gale', freeze: 'Freeze breath', icicles: 'Icicle volley', stomp: 'Stomp', punch: 'Ring punch', rock: 'Lava rock', rock2: 'Lava volley', throw: 'Throw', throw2: 'Double throw', fog: 'Curse fog', bolt: 'Lightning', bolt2: 'Twin lightning' };
const RING_FILT = { filterCategoryBits: 1, filterMaskBits: 2 | 4 | 64 | 128 }; // sim.js CAT.RING / MASK.RING

const M_ = (sim) => BOSS_MODE[sim.mode] || BOSS_MODE.medium;

export function v31Init(sim) {
  const L = sim.level, F = L.bossFight, IC = L.icicles;
  sim.bx = {
    ice: [], walls: [], patches: 0, rl: sim.rings.map(() => ({ frost: 0, spin: 0, dir: 0 })), wallId: 0,
    iceT: IC ? (IC.delay ?? 4) : -1, iceK: 0, boss: null,
    gust: L.gusts ? { ph: 'wait', t: L.gusts.delay ?? 6, dur: 1, dir: 1 } : null,
  };
  if (!F) return;
  const M = M_(sim);
  sim.bx.boss = {
    kind: F.kind, phase: 0, saved: 0, t: (F.delay ?? 4) * M.every, k: 0, tk: 0, atk: null, flinch: 0, quake: 0, qk: 0,
    x: 0, y: sim.outerR + 1.0, face: 1, throws: [], fog: null, heat: {}, phaseAt: 0, phaseSaved: 0, lastDir: 1,
  };
  bossPhaseOn(sim, sim.bx.boss, true);
}

// ---------- queries used by sim.js, the planner and the renderer
export function ringLocked(sim, ring) {
  const R = sim.bx && sim.bx.rl[ring.i];
  return !!R && (R.frost > 0 || R.spin > 0);
}
export function bossPhases(sim) {
  return sim.level.bossFight ? sim.level.bossFight.phases : [];
}
// progress toward the next phase, 0..1 (by eggs saved or by time, whichever is further)
export function bossProgress(sim) {
  const B = sim.bx && sim.bx.boss;
  if (!B) return 0;
  const nx = bossPhases(sim)[B.phase + 1];
  if (!nx || !nx.at) return 1;
  const M = M_(sim), a = nx.at;
  const ts = a.t ? clamp((sim.t - B.phaseAt) / Math.max(0.1, a.t * M.every - B.phaseAt), 0, 1) : 0;
  const ss = a.saved != null ? clamp((sim.savedLog.length - B.phaseSaved) / Math.max(1, a.saved - B.phaseSaved), 0, 1) : 0;
  return Math.max(ts, ss);
}
// world point of something stuck to a ring at ring-local angle la, radius rad
export function ringPoint(sim, ri, la, rad) {
  const a = sim.rings[ri].body.getAngle() + la;
  return { x: rad * Math.cos(a), y: rad * Math.sin(a), a };
}

// ---------- every step (from Sim.v3Step, before the world steps)
export function v31Step(sim, dt) {
  const X = sim.bx;
  if (!X) return;
  // hook for the salamander creature (added by a later creature pass); its lava attacks below work without it
  if (sim.level.boss === 'salamander') sim.salamanderStep?.(dt);
  for (const R of X.rl) if (R.frost > 0 && (R.frost -= dt) <= 0) { R.frost = 0; sim.emit('thaw', { ring: X.rl.indexOf(R) }); }
  sim.rings.forEach((ring, i) => {
    const R = X.rl[i];
    if (R.spin > 0) {
      // a punched ring spins round by itself; the player's hold is ignored until it stops
      const step = Math.min(R.spin, PUNCH_W * dt);
      R.spin -= step;
      ring.body.setAngularVelocity(R.dir * step / dt);
      ring.target = ring.body.getAngle() + R.dir * step;
      if (R.spin <= 1e-6) R.spin = 0;
    }
    ring.lock = R.frost > 0 || R.spin > 0 ? 1 : 0;
  });
  for (const ring of sim.rings) for (const sg of ring.segs) if (sg.ice > 0 && (sg.ice -= dt) <= 0) sg.ice = 0;
  wallsStep(sim, dt);
  iceStep(sim, dt);
  if (X.gust && sim.state === 'play') gustStep(sim, X.gust, dt);
  if (X.boss && sim.state === 'play') bossStep(sim, X.boss, dt);
}

// ---------- the weather and the bosses hit the animals too
// kind: 'gust' 'rock' 'lava' 'ice' 'bolt' 'quake'. Snakes get sim.hitSnake (the snakes' own reaction, when it
// exists), the eagle sim.hitEagle (its own, when it exists); the fox flinches on a quake or lightning and misses
// his next throw.
// o: {x, y, r (reach; Infinity = everywhere), dir, power}. Returns how many animals it reached.
export function animalsHit(sim, kind, o = {}) {
  const x = o.x ?? 0, y = o.y ?? 0, r = o.r ?? Infinity;
  let n = 0;
  for (const S of sim.snakes || []) {
    if (S.gone || !S.inside || !S.pts || !S.pts.length) continue;
    if (r < Infinity && !S.pts.some((q) => Math.hypot(q.x - x, q.y - y) < r)) continue;
    n++;
    sim.hitSnake?.(S, kind, { x, y, dir: o.dir || 0, power: o.power ?? 1 });
  }
  // the eagle's own reaction (gust blows it off course, lightning stuns it, a rock or icicle scares it off), when it exists
  const E = sim.eagle;
  if (E && sim.hitEagle && (r === Infinity || Math.hypot((E.x ?? 0) - x, (E.y ?? 0) - y) < (kind === 'bolt' ? 3 : r + 0.6))) { n++; sim.hitEagle(kind, { x, y, dir: o.dir || 0, power: o.power ?? 1 }); }
  if (kind === 'quake' || kind === 'bolt') {
    const F = sim.fox, B = sim.bx && sim.bx.boss;
    if (F) { F.t += F.every * 0.5; F.mood = 'shocked'; F.moodT = 1.2; sim.emit('foxFlinch', { x: F.x, y: sim.outerR + 0.45 }); }
    if (B && (B.kind === 'fox' || B.kind === 'foxking') && B.atk && B.atk.ph === 'warn') { B.atk = null; B.t = 1.5; B.flinch = 0.8; sim.emit('foxFlinch', { x: B.x, y: B.y }); }
  }
  return n;
}

// ---------- falling ice
// Spot straight above p where a ring is solid (an icicle can hang there), within 3.4 m.
function ceilingAbove(sim, p) {
  for (let h = 0.32; h < 3.4; h += 0.04) {
    const y = p.y + h, d = Math.hypot(p.x, y);
    for (const ring of sim.rings) {
      if (Math.abs(d - ring.r) < RING_TH / 2 && sim.solidAt(ring, p.x, y)) return { ri: ring.i, la: Math.atan2(y, p.x) - ring.body.getAngle(), rad: d, h };
    }
  }
  return null;
}
// eggs an icicle can target: inside the vault, most advanced first
function targets(sim) {
  const n = sim.rings.length;
  return sim.aliveEggs().filter((e) => sim.channelOf(e) < n).sort((a, b) => sim.channelOf(b) - sim.channelOf(a) || a.id - b.id);
}
function hangIcicle(sim, egg, big, hang) {
  const c = ceilingAbove(sim, egg.body.getPosition());
  if (!c) return null;
  const I = { ri: c.ri, la: c.la, rad: c.rad, ph: 'hang', t: hang, dur: hang, x: 0, y: 0, vy: 0, big: big ? 1 : 0, eid: egg.id, fell: 0 };
  const q = ringPoint(sim, I.ri, I.la, I.rad);
  I.x = q.x; I.y = q.y;
  sim.bx.ice.push(I);
  sim.emit('iceWarn', { x: q.x, y: q.y, big: I.big });
  return I;
}
function iceStep(sim, dt) {
  const X = sim.bx, IC = sim.level.icicles, M = M_(sim);
  if (IC && sim.state === 'play' && (X.iceT -= dt) <= 0) {
    X.iceT = (IC.every || 6) * M.every;
    const T = targets(sim);
    if (T.length) {
      const big = IC.big && ++X.iceK % IC.big === 0;
      hangIcicle(sim, T[Math.floor(sim.rand() * Math.min(2, T.length))], big, ICE_HANG * M.warn);
    } else X.iceT = 1;
  }
  for (let i = X.ice.length - 1; i >= 0; i--) {
    const I = X.ice[i];
    if (I.ph === 'hang') {
      const q = ringPoint(sim, I.ri, I.la, I.rad); // it turns with its ring: turning that ring swings it away
      I.x = q.x; I.y = q.y;
      if ((I.t -= dt) <= 0) { I.ph = 'fall'; sim.emit('iceDrop', { x: I.x, y: I.y, big: I.big }); }
      continue;
    }
    I.vy = Math.max(-12, I.vy - sim.g * dt);
    I.y += I.vy * dt;
    I.fell -= I.vy * dt;
    const len = I.big ? 0.5 : 0.42, tip = I.y - len, d = Math.hypot(I.x, tip);
    let gone = I.y < sim.groundY;
    for (const e of sim.aliveEggs()) {
      if (gone) break;
      const p = e.body.getPosition();
      if (Math.hypot(p.x - I.x, p.y - tip) < (I.big ? 0.36 : 0.3)) {
        gone = true;
        sim.emit('icicleHit', { egg: e, x: I.x, y: tip, big: I.big });
        sim.crack(e, 0, 'icicle', I.big ? 2 : 1);
      }
    }
    if (!gone && animalsHit(sim, 'ice', { x: I.x, y: tip, r: 0.3, power: I.big ? 2 : 1 })) { gone = true; sim.emit('icicleShatter', { x: I.x, y: tip, big: I.big }); }
    for (const ring of sim.rings) {
      if (gone) break;
      if (ring.i === I.ri && I.fell < 0.25) continue; // leaving the ring it hung from
      if (Math.abs(d - ring.r) < RING_TH / 2 + 0.05 && sim.solidAt(ring, I.x, tip)) {
        gone = true;
        iceLand(sim, ring, I, tip, d);
      }
    }
    if (gone) X.ice.splice(i, 1);
  }
}
// an icicle shatters on a ring: an ice patch there; a big chunk freezes the ring and, on a channel floor, stands as a wall
function iceLand(sim, ring, I, tip, d) {
  const la = Math.atan2(tip, I.x) - ring.body.getAngle();
  const floor = d < ring.r && tip < -0.2; // it came down onto the floor of the channel inside this ring
  for (const sg of ring.segs) if (sg.alive && Math.abs(wrap((sg.a0 + sg.a1) / 2 - la)) * ring.r < 0.6) sg.ice = PATCH_T;
  sim.emit('icicleShatter', { x: I.x, y: tip, big: I.big, ring: ring.i, patch: 1 });
  if (!I.big) return;
  const R = sim.bx.rl[ring.i];
  if (ring.grabbable) { R.frost = Math.max(R.frost, CHUNK_FREEZE_T * M_(sim).hold); sim.emit('freeze', { ring: ring.i, why: 'chunk', x: I.x, y: tip }); }
  if (floor) addWall(sim, 'ice', ring.i, la, ICE_WALL_T);
}

// the frost orb: the ring the egg rests on can't turn for 3 s
export function frostOrb(sim, egg) {
  const c = sim.channelOf(egg), n = sim.rings.length;
  const ring = sim.rings[Math.min(c, n - 1)];
  const p = egg.body.getPosition();
  if (ring.grabbable) sim.bx.rl[ring.i].frost = Math.max(sim.bx.rl[ring.i].frost, FROST_ORB_T);
  sim.emit('freeze', { ring: ring.i, why: 'orb', x: p.x, y: p.y });
}

// ---------- temporary walls on a channel floor (golem crystals, ice blocks)
function wallFix(sim, W) {
  const ring = sim.rings[W.ri];
  const base = ring.r - RING_TH / 2 + 0.01, inner = W.ri ? sim.rings[W.ri - 1].r + RING_TH / 2 + 0.1 : 0;
  const h = Math.min(W.kind === 'ice' ? 0.5 : 0.62, base - inner), w = W.kind === 'ice' ? 0.3 : 0.2, top = base - h;
  const p = (rad, ang) => Vec2(rad * Math.cos(ang), rad * Math.sin(ang));
  W.h = h; W.w = w;
  W.fix = ring.body.createFixture({
    shape: new Polygon([p(base, W.la - w / 2 / base), p(base, W.la + w / 2 / base), p(top, W.la + w / 2 / top), p(top, W.la - w / 2 / top)]),
    friction: W.kind === 'ice' ? 0.05 : 0.6, restitution: 0.1, ...RING_FILT, userData: { kind: 'wall', wall: W },
  });
}
function addWall(sim, kind, ri, la, life) {
  const W = { id: ++sim.bx.wallId, kind, ri, la, life: life * M_(sim).hold, max: life * M_(sim).hold, alive: true, fix: null, h: 0, w: 0 };
  wallFix(sim, W);
  sim.bx.walls.push(W);
  const q = ringPoint(sim, ri, la, sim.rings[ri].r - RING_TH / 2 - 0.25);
  sim.emit('wallUp', { kind, x: q.x, y: q.y });
  return W;
}
function removeWall(sim, W, how) {
  if (!W.alive) return;
  W.alive = false;
  sim.killFix.push([sim.rings[W.ri].body, W.fix]);
  const q = ringPoint(sim, W.ri, W.la, sim.rings[W.ri].r - RING_TH / 2 - 0.25);
  sim.emit('wallGone', { kind: W.kind, how, x: q.x, y: q.y });
}
function wallsStep(sim, dt) {
  const X = sim.bx;
  for (const W of X.walls) if (W.alive && (W.life -= dt) <= 0) removeWall(sim, W, 'melt');
  if (X.walls.length > 12) X.walls = X.walls.filter((W) => W.alive);
}

// contacts (from Sim.v3Contact): ice is frictionless; fire or water melts an ice wall, stone shatters a crystal one
export function v31Contact(sim, c, egg, other) {
  if (other.kind === 'seg' && other.seg.ice > 0) c.setFriction(0);
  if (other.kind !== 'wall') return false;
  const W = other.wall;
  if (!W.alive) { c.setEnabled(false); return true; }
  if (W.kind === 'ice' && (egg.fire > 0 || egg.water > 0)) { c.setEnabled(false); sim.defer(() => removeWall(sim, W, egg.fire > 0 ? 'fire' : 'water')); return true; }
  if (W.kind === 'crystal' && egg.stone > 0) { c.setEnabled(false); sim.defer(() => removeWall(sim, W, 'smash')); return true; }
  return false;
}

// ---------- the boss
function bossPhaseOn(sim, B, first) {
  const P = bossPhases(sim)[B.phase] || {};
  B.phaseAt = sim.t;
  B.phaseSaved = sim.savedLog.length;
  B.k = 0;
  if (P.summon) for (const S of sim.snakes) if (!S.gone && S.wait > 1.5) { S.wait = 1.5; sim.emit('bossSummon', { x: B.x, y: B.y }); }
  if (!first) sim.emit('bossPhase', { kind: B.kind, phase: B.phase, n: bossPhases(sim).length, attacks: P.attacks || [], x: B.x, y: B.y });
}

function bossStep(sim, B, dt) {
  const M = M_(sim), P = bossPhases(sim), R = sim.outerR;
  // hits: an egg in the nest staggers the boss and cancels the attack it is winding up
  const saved = sim.savedLog.length;
  if (saved > B.saved) {
    B.saved = saved;
    B.flinch = 0.9;
    if (B.atk && B.atk.ph === 'warn' && B.atk.name !== 'icicles') { B.atk = null; B.t = 1.6 * M.every; }
    sim.emit('bossHit', { kind: B.kind, x: B.x, y: B.y, n: saved });
  }
  if (B.flinch > 0) B.flinch -= dt;
  const nx = P[B.phase + 1];
  if (nx && nx.at && (saved >= (nx.at.saved ?? 99) || sim.t >= (nx.at.t ?? 1e9) * M.every)) {
    B.phase++;
    B.t = Math.min(B.t, 2.2 * M.every);
    bossPhaseOn(sim, B, false);
  }
  const ph = P[B.phase] || {};
  // where the boss hovers: drifting over the top, leaning toward what it attacks
  let gx = Math.sin(sim.t * 0.45) * R * 0.45, gy = R + 1.0;
  const A = B.atk;
  if (A && A.name === 'gale') gx = -A.dir * R * 0.55;
  else if (A && A.aim) gx = clamp(A.aim, -R * 0.6, R * 0.6);
  if (B.kind === 'golem' || B.kind === 'salamander' || B.kind === 'fox' || B.kind === 'foxking') gy = R + 0.75;
  if (A && A.name === 'stomp' && A.ph === 'warn') gy += 0.7 * Math.sin(Math.PI * clamp(1 - A.t / A.dur, 0, 1) * 0.5); // rises before the slam
  const s = Math.min(1, dt * 3);
  if (Math.abs(gx - B.x) > 0.02) B.face = gx > B.x ? 1 : -1;
  B.x += (gx - B.x) * s;
  B.y += (gy - B.y) * Math.min(1, dt * (A && A.name === 'stomp' && A.ph === 'act' ? 30 : 4));
  // quake after a stomp
  if (B.quake > 0) {
    B.quake -= dt;
    if ((B.qk -= dt) <= 0) {
      B.qk = 0.12;
      for (const e of sim.aliveEggs()) if (e.honey <= 0) { const m = e.body.getMass() * M.power; e.body.applyLinearImpulse(Vec2((sim.rand() - 0.5) * 1.1 * m, sim.rand() * 0.55 * m), e.body.getPosition(), true); }
    }
  }
  thrownStep(sim, B, dt);
  if (ph.heat) heatStep(sim, B, dt, M);
  if (B.fog && (B.fog.t -= dt) <= 0) { B.fog = null; sim.emit('fogGone', {}); }
  if (B.kind === 'snake') return; // its attacks are the snakes' own
  if (!A) {
    if ((B.t -= dt) > 0 || !ph.attacks || !ph.attacks.length) return;
    const name = ph.attacks[B.k++ % ph.attacks.length];
    const a = startAttack(sim, B, name, M);
    if (!a) { B.t = 1; return; }
    a.name = name;
    a.ph = 'warn';
    a.dur = a.t = (WARN[name] || 1) * M.warn;
    B.atk = a;
    sim.emit('bossWarn', { kind: B.kind, attack: name, x: B.x, y: B.y, ring: a.ring, dir: a.dir });
    return;
  }
  if (A.ph === 'warn') {
    if ((A.t -= dt) > 0) return;
    A.ph = 'act';
    A.t = A.name === 'gale' ? GALE_T : 0.35;
    A.dur = A.t;
    actAttack(sim, B, A, M);
    if (A.name === 'gale') animalsHit(sim, 'gust', { dir: A.dir, power: (sim.level.bossFight.gale ?? 5) * M.power / 5, dur: GALE_T });
    sim.emit('bossAct', { kind: B.kind, attack: A.name, x: B.x, y: B.y, ring: A.ring, dir: A.dir });
    return;
  }
  if (A.name === 'gale') galeForce(sim, A, M, dt);
  if ((A.t -= dt) <= 0) { B.atk = null; B.t = (ph.every || 6) * M.every; }
}

// pick targets and set up the telegraph; null = nothing worth attacking now
function startAttack(sim, B, name, M) {
  const T = targets(sim), n = sim.rings.length, F = sim.level.bossFight;
  const floorOf = (e) => sim.rings[Math.min(n - 1, sim.channelOf(e))];
  switch (name) {
    case 'gale': {
      // blows the way that pushes the most advanced egg toward its nearest thorns or gap, else alternates
      const dir = sim.rand() < 0.7 ? -B.lastDir : B.lastDir;
      B.lastDir = dir;
      return { dir };
    }
    case 'freeze': {
      // the ring under the most eggs (ties: the furthest egg's floor) that the player can still turn
      const cnt = new Map();
      for (const e of T) { const r = floorOf(e); if (r.grabbable && !ringLocked(sim, r)) cnt.set(r.i, (cnt.get(r.i) || 0) + 1 + sim.channelOf(e) * 0.01); }
      if (!cnt.size) return null;
      const ri = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0][0];
      return { ring: ri };
    }
    case 'icicles': {
      const hang = WARN.icicles * M.warn, list = [];
      for (const e of T.slice(0, M.n)) { const I = hangIcicle(sim, e, false, hang); if (I) list.push(I); }
      return list.length ? { n: list.length } : null;
    }
    case 'stomp': {
      // crystal walls rise between the leading eggs and their nearest way down
      const spots = [];
      for (const e of T.slice(0, B.phase >= 1 ? 2 : 1)) { const w = wallSpot(sim, e); if (w && !spots.some((s) => s.ri === w.ri && Math.abs(wrap(s.la - w.la)) * sim.rings[w.ri].r < 0.8)) spots.push(w); }
      return { spots };
    }
    case 'punch': {
      const e = T[0];
      if (!e) return null;
      let ring = floorOf(e);
      if (!ring.grabbable || ring.gear || ringLocked(sim, ring)) ring = sim.rings.find((r) => r.grabbable && !r.gear && !ringLocked(sim, r) && r.i > 0);
      if (!ring) return null;
      const dir = ring.oneway || (sim.rand() < 0.5 ? 1 : -1);
      return { ring: ring.i, dir };
    }
    case 'rock': case 'rock2': {
      const spots = [];
      for (const e of T.slice(0, name === 'rock2' ? 2 : 1)) {
        const ring = floorOf(e), p = e.body.getPosition();
        spots.push({ ri: ring.i, la: Math.atan2(p.y, p.x) - ring.body.getAngle() });
      }
      if (!spots.length) return null;
      return { spots, aim: T[0].body.getPosition().x };
    }
    case 'throw': case 'throw2': {
      const spots = [], two = name === 'throw2';
      const throws = F.throws || ['thorn', 'foxcurse'];
      for (const e of T.slice(0, two ? 2 : 1)) { const p = e.body.getPosition(); spots.push({ x: p.x, y: p.y, ch: sim.channelOf(e), type: throws[B.tk++ % throws.length] }); }
      if (two && spots.length === 1) {
        // one egg left: the second throw lands ahead of it, on its way to the nearest gap
        const e = T[0], p = e.body.getPosition(), ring = floorOf(e), ch = sim.channelOf(e), rad = Math.hypot(p.x, p.y);
        const ga = nearestGap(sim, ring, e), a = Math.atan2(p.y, p.x) + (ga ? Math.sign(ga) : 1) * Math.min(0.9 / rad, Math.abs(ga || 1) * 0.6);
        spots.push({ x: rad * Math.cos(a), y: rad * Math.sin(a), ch, type: throws[B.tk++ % throws.length] });
      }
      if (!spots.length) return null;
      return { spots, aim: spots[0].x };
    }
    case 'fog': {
      const e = T[0];
      if (!e) return null;
      return { ring: floorOf(e).i };
    }
    case 'bolt': case 'bolt2': {
      // the section of ring right under the leading egg(s) crackles, then lightning strikes it
      const spots = [];
      for (const e of T.slice(0, name === 'bolt2' ? 2 : 1)) {
        const ring = floorOf(e), p = e.body.getPosition(), la = ((Math.atan2(p.y, p.x) - ring.body.getAngle()) % TAU + TAU) % TAU;
        let si = -1, bd = 1e9;
        ring.segs.forEach((g, k) => { if (!g.alive) return; const d = Math.abs(wrap((g.a0 + g.a1) / 2 - la)); if (d < bd) { bd = d; si = k; } });
        if (si >= 0 && !spots.some((q) => q.ri === ring.i && q.si === si)) spots.push({ ri: ring.i, si });
      }
      return spots.length ? { spots, aim: T[0].body.getPosition().x } : null;
    }
  }
  return null;
}

// signed world-angle from egg e to the nearest open gap of ring (radians), or 0
function nearestGap(sim, ring, e) {
  const p = e.body.getPosition(), la = Math.atan2(p.y, p.x) - ring.body.getAngle();
  let best = 0, bd = 1e9;
  for (const g of ring.gaps) {
    if (!sim.gapOpenFor(g, e)) continue;
    const d = wrap(g.a - la);
    if (Math.abs(d) < bd) { bd = Math.abs(d); best = d; }
  }
  return best;
}
// a crystal wall spot on egg e's floor, between it and its nearest gap, clear of every egg
function wallSpot(sim, e) {
  const n = sim.rings.length, c = sim.channelOf(e);
  if (c >= n) return null;
  const ring = sim.rings[c], p = e.body.getPosition(), la = Math.atan2(p.y, p.x) - ring.body.getAngle();
  const ga = nearestGap(sim, ring, e), r = ring.r - RING_TH / 2;
  if (!ga) return null;
  const g = ring.gaps.reduce((b, q) => (Math.abs(wrap(q.a - la - ga)) < Math.abs(wrap(b.a - la - ga)) ? q : b), ring.gaps[0]);
  const room = Math.abs(ga) * r - g.len / 2 - 0.12;
  if (room < 0.42) return null;
  const at = la + Math.sign(ga) * Math.min(room, Math.max(0.45, room * 0.5)) / r;
  const q = ringPoint(sim, c, at, r - 0.2);
  if (!sim.solidAt(ring, q.x * 1.05, q.y * 1.05)) return null;
  for (const o of sim.aliveEggs()) { const op = o.body.getPosition(); if (Math.hypot(op.x - q.x, op.y - q.y) < 0.42) return null; }
  return { ri: c, la: at };
}

function actAttack(sim, B, A, M) {
  switch (A.name) {
    case 'freeze': {
      const R = sim.bx.rl[A.ring];
      R.frost = Math.max(R.frost, FREEZE_T * M.hold);
      const q = sim.rings[A.ring];
      sim.emit('freeze', { ring: A.ring, why: 'breath', x: 0, y: q.r });
      break;
    }
    case 'icicles':
      break; // the icicles drop on their own timers
    case 'stomp': {
      B.quake = 0.8;
      B.qk = 0;
      sim.emit('bossStomp', { x: B.x, y: sim.outerR });
      animalsHit(sim, 'quake', { power: M.power });
      // glass under the eggs cracks a little more with every stomp
      for (const ring of sim.rings) {
        if (!ring.M.hp) continue;
        for (const sg of ring.segs) {
          if (!sg.alive || sg.dying) continue;
          const q = ringPoint(sim, ring.i, (sg.a0 + sg.a1) / 2, ring.r);
          if (!sim.aliveEggs().some((e) => { const p = e.body.getPosition(); return Math.hypot(p.x - q.x, p.y - q.y) < 1.1; })) continue;
          sg.hp -= 1;
          if (sg.hp <= 0) { sg.dying = true; sim.defer(() => sim.breakSeg(sg, 'shatter')); } else sim.emit('glassCrack', { seg: sg });
        }
      }
      for (const s of A.spots) {
        const q = ringPoint(sim, s.ri, s.la, sim.rings[s.ri].r - RING_TH / 2 - 0.25);
        if (sim.aliveEggs().some((e) => { const p = e.body.getPosition(); return Math.hypot(p.x - q.x, p.y - q.y) < 0.36; })) continue;
        addWall(sim, 'crystal', s.ri, s.la, WALL_T);
      }
      break;
    }
    case 'punch': {
      const R = sim.bx.rl[A.ring];
      R.spin = Math.PI / 2;
      R.dir = A.dir;
      sim.emit('bossPunch', { ring: A.ring, dir: A.dir, x: B.x, y: B.y });
      break;
    }
    case 'rock': case 'rock2':
      for (const s of A.spots) {
        const k = { ri: s.ri, la: s.la, ph: 'fly', t: 0, x0: B.x, y0: B.y, x: B.x, y: B.y };
        sim.lavaRocks.push(k);
        const q = sim.rockAt(k);
        sim.emit('lavaWarn', { x: q.x, y: q.y, ring: s.ri });
      }
      break;
    case 'throw': case 'throw2':
      for (const s of A.spots) B.throws.push({ ...s, x0: B.x, y0: B.y, t: 0 });
      break;
    case 'bolt': case 'bolt2':
      for (const q of A.spots) { const keep = sim.wx.bolt; sim.strike(q); sim.wx.bolt = keep; }
      break;
    case 'fog':
      B.fog = { ri: A.ring, t: FOG_T * M.hold, dur: FOG_T * M.hold };
      sim.emit('bossFog', { ring: A.ring });
      break;
  }
}

// the gale: a strong sideways shove on everything loose; stone is too heavy for it, a chick or bubble flies
function galeForce(sim, A, M, dt) {
  const el = A.dur - A.t;
  const ramp = clamp(Math.min(el / 0.3, A.t / 0.4), 0, 1);
  const acc = (A.gale ?? sim.level.bossFight.gale ?? 5) * M.power * ramp * A.dir;
  if (!acc) return;
  for (const e of sim.aliveEggs()) {
    if (e.honey > 0) continue;
    const k = e.stone > 0 ? 0.3 : e.chick ? 1.3 : e.bubbleFix ? 1.6 : 1;
    e.body.applyForceToCenter(Vec2(acc * k * e.body.getMass(), 0), true);
  }
  for (const r of sim.rocks) if (r.alive) r.body.applyForceToCenter(Vec2(acc * 0.5 * r.body.getMass(), 0), true);
  void dt;
}
// level gusts: streaks first (the telegraph), then a shove along the channels; snakes are blown too
function gustStep(sim, G, dt) {
  const L = sim.level.gusts, M = M_(sim);
  if ((G.t -= dt) > 0) {
    if (G.ph === 'blow') galeForce(sim, { dir: G.dir, dur: G.dur, t: G.t, gale: (L.strength ?? 4) }, M, dt);
    return;
  }
  if (G.ph === 'wait') {
    G.ph = 'warn'; G.dir = sim.rand() < 0.5 ? -1 : 1; G.t = G.dur = WARN.gust * M.warn;
    sim.emit('gustWarn', { dir: G.dir });
  } else if (G.ph === 'warn') {
    G.ph = 'blow'; G.t = G.dur = L.dur ?? 2.2;
    sim.emit('gust', { dir: G.dir });
    animalsHit(sim, 'gust', { dir: G.dir, power: (L.strength ?? 4) * M.power / 5, dur: G.dur });
  } else { G.ph = 'wait'; G.t = (L.every || 8) * M.every; }
}

export function galeNow(sim) {
  const G = sim.bx && sim.bx.gust;
  if (G && G.ph !== 'wait') return G.ph === 'warn' ? 0.25 * G.dir * clamp(1 - G.t / G.dur, 0, 1) : G.dir * clamp(Math.min((G.dur - G.t) / 0.3, G.t / 0.4), 0, 1);
  const B = sim.bx && sim.bx.boss, A = B && B.atk;
  if (!A || A.name !== 'gale') return 0;
  if (A.ph === 'warn') return 0.25 * A.dir * clamp(1 - A.t / A.dur, 0, 1);
  return A.dir * clamp(Math.min((A.dur - A.t) / 0.3, A.t / 0.4), 0, 1);
}

// thrown orbs fly from the fox to their marked spot, then float there as orbs
function thrownStep(sim, B, dt) {
  for (let i = B.throws.length - 1; i >= 0; i--) {
    const T = B.throws[i];
    if ((T.t += dt) < THROW_FLY) continue;
    B.throws.splice(i, 1);
    const mine = sim.orbs.filter((o) => o.alive && o.src === 'fox');
    if (mine.length >= 4) { mine[0].alive = false; sim.kill.push(mine[0].body); }
    const o = sim.addOrb(T.type, Math.min(T.ch, sim.rings.length - 1), Math.atan2(T.y, T.x), 'fox', Math.hypot(T.x, T.y));
    sim.emit('foxThrow', { power: o.type, x: T.x0, y: T.y0, x2: o.x, y2: o.y });
  }
}

// rising heat: an egg that waits in one channel too long cracks (water resets it)
function heatStep(sim, B, dt, M) {
  const lim = HEAT_T * M.heat, n = sim.rings.length;
  for (const e of sim.aliveEggs()) {
    const c = sim.channelOf(e);
    let H = B.heat[e.id];
    if (!H || H.ch !== c || c >= n || e.water > 0) { B.heat[e.id] = { ch: c, t: 0 }; continue; }
    const was = H.t;
    H.t += dt;
    const p = e.body.getPosition();
    if (was < lim - 1.2 && H.t >= lim - 1.2) sim.emit('heatWarn', { egg: e, x: p.x, y: p.y });
    if (H.t >= lim) { H.t = lim - 4.5; sim.emit('heatCrack', { egg: e, x: p.x, y: p.y }); sim.crack(e, 0, 'heat'); }
  }
}
export function heatOf(sim, egg) {
  const B = sim.bx && sim.bx.boss;
  if (!B || !(bossPhases(sim)[B.phase] || {}).heat) return 0;
  const H = B.heat[egg.id];
  return H ? clamp(H.t / (HEAT_T * M_(sim).heat), 0, 1) : 0;
}

// ---------- state (planner / rewind)
export function v31State(sim) {
  const X = sim.bx;
  if (!X) return null;
  const B = X.boss;
  return {
    gust: X.gust ? { ...X.gust } : null, ice: X.ice.map((I) => ({ ...I })), walls: X.walls.filter((W) => W.alive).map(({ fix, ...W }) => ({ ...W })), wallId: X.wallId,
    rl: X.rl.map((R) => ({ ...R })), iceT: X.iceT, iceK: X.iceK,
    segIce: sim.rings.map((r) => r.segs.map((g) => g.ice || 0)),
    boss: B ? { ...B, atk: B.atk ? JSON.parse(JSON.stringify(B.atk)) : null, throws: B.throws.map((T) => ({ ...T })), fog: B.fog ? { ...B.fog } : null, heat: JSON.parse(JSON.stringify(B.heat)) } : null,
  };
}
export function v31Load(sim, S) {
  if (!S || !sim.bx) return;
  const X = sim.bx;
  X.ice = S.ice.map((I) => ({ ...I }));
  X.gust = S.gust ? { ...S.gust } : null;
  X.wallId = S.wallId;
  X.rl = S.rl.map((R) => ({ ...R }));
  X.iceT = S.iceT;
  X.iceK = S.iceK;
  X.walls = S.walls.map((W) => { const w = { ...W, fix: null }; wallFix(sim, w); return w; });
  (S.segIce || []).forEach((a, i) => a.forEach((v, k) => { if (sim.rings[i].segs[k]) sim.rings[i].segs[k].ice = v; }));
  sim.rings.forEach((ring, i) => { const R = X.rl[i]; ring.lock = R && (R.frost > 0 || R.spin > 0) ? 1 : 0; });
  if (S.boss) {
    const B = S.boss;
    X.boss = { ...B, atk: B.atk ? JSON.parse(JSON.stringify(B.atk)) : null, throws: B.throws.map((T) => ({ ...T })), fog: B.fog ? { ...B.fog } : null, heat: JSON.parse(JSON.stringify(B.heat)) };
  }
}
