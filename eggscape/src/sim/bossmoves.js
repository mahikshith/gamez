// Boss variety moves (the owner's rule: a boss never leans on one attack). boss.js runs the phases and the WARN
// telegraph; this file picks targets (mvStart), fires the move (mvAct) and runs what it leaves behind (mvStep).
// All state is plain data in sim.bx.boss.mv (deep-copied by v31State / v31Load), so rewind and the planner stay exact.
// Every move: a telegraph of at least 1.2 s on Hard that shows WHERE it lands, a counter made of ring turns alone.
//
// Crystal Golem (L20)
//   cage   : crystals sprout on both sides of the egg nearest the nest and grow across its channel, sealing it for
//            CAGE_T s. Turning either ring of that channel about 60 deg shears them off (they shatter); a stone egg
//            smashes through; an egg that rolls out of the marked spots before they grow is never caged.
//   shards : a wedge of the vault is marked (dashed outline, falling glints), then crystal shards rain through it for
//            RAIN_T s. An egg in the wedge with no ring wall directly above it cracks once. Counter: turn a solid
//            wall over the egg, or roll it out of the wedge.
// Lava Salamander (L25)
//   magma  : one ring glows (pulsing), then is red-hot for MAGMA_T s by the salamander's own red-hot rule (an egg
//            touching it cracks once, water steams it); its thorns burn away. Counter: get eggs off that ring's inner
//            face in time (it only picks a ring whose eggs can reach a gap in the telegraph, else a ring with no egg).
//   whip   : he coils his tail (an arrow on the ring shows which way), then whips one ring a quarter turn. Counter:
//            hold or drag that ring as the whip lands: it only gives WHIP_HELD.
// Storm Eagle (L30)
//   dive   : its shadow circles, then locks on the egg furthest from the nest in the outer two channels and shrinks
//            onto it. The eagle dives and carries the egg back up one ring (never out, never broken). Counter: a solid
//            ring wall directly over the egg when it lands: it bonks and is dizzy for DIVE_DIZZY s. Measured: a ring is solid over an
//            egg ~88% of the time, so a wall that was already there blocked ~85% of dives and almost none landed. Now only a wall the
//            player brings over the egg blocks it (A.open): the egg was seen exposed, or a ring was turned ~17 degrees during the warning; an egg left sitting under a ring is snatched.
//   wgust  : streaks show the way, then three wing beats over WGUST_T s push every free egg along its channel.
//            Counter: a wall end or a gap edge in the way, or ride it to a gap.
// Weasel (L5, gentle: its one new move)
//   pop    : dirt puffs mark a spot in a channel (ahead of the leading egg, toward its gap), then the weasel pops up out of
//            a tunnel there and stands in the channel as a solid body for POP_T s (it rides the floor ring). An egg that
//            rolls into it bonks it: it is stunned and loses an hp (a hit), and the egg bounces off unharmed. Counter:
//            turn the floor ring so the egg rolls into it, or wait it out; it never lands on an egg.
import { Vec2, Circle } from 'planck';
import { RING_TH, TAU, wrap, clamp } from './geom.js';
import { BOSS_MODE, WARN, addWall, removeWall, bossTargets, galeForce, animalsHit } from './boss.js';

// (their telegraph times and names live in boss.js WARN / ATTACK_NAME, so no module reads this one at load time)
export const MV = {
  cageT: 5, cageOff: 0.62, shear: (55 * Math.PI) / 180, // s sealed, m from the egg to each crystal, ring turn that shears them
  rainT: 2, rainW: 0.62, rainHit: 0.18, // s of shards, m half-width of the wedge at the egg, s of exposure that cracks
  magmaT: 4, magmaBurn: 0.8, // s red-hot, s until its thorns burn off
  diveDizzy: 2, carryT: 0.75, // s dizzy after a bonk, s it carries an egg up
  wgustT: 3, wgust: 4.5, // s of wing beats, peak push (the boss gale's units)
  popT: 3, popR: 0.3, popAhead: 0.9, // s it stands there, m body radius, m ahead of the egg
  whip: Math.PI / 2, whipHeld: (20 * Math.PI) / 180, // rad a whip turns a ring (free / held)
};
// is the player holding or turning this ring now? (the planner turns a ring by moving its target)
export const ringHeld = (ring) => !!ring.held || Math.abs(ring.target - ring.body.getAngle()) > 0.03;
const M_ = (sim) => BOSS_MODE[sim.mode] || BOSS_MODE.medium;

// The first ring the straight-up line from p crosses: is it solid there? (a roof over the egg)
export function roofed(sim, p) {
  for (let h = 0.22; h < 4.2; h += 0.04) {
    const y = p.y + h, d = Math.hypot(p.x, y);
    for (const ring of sim.rings) if (Math.abs(d - ring.r) < RING_TH / 2) return sim.solidAt(ring, p.x, y);
  }
  return false;
}
// the whole egg under a roof (the eagle's talons slip past the end of a wall)
export const roofedWide = (sim, p) => [-0.22, 0, 0.22].every((dx) => roofed(sim, { x: p.x + dx, y: p.y }));
const mvOf = (B) => B.mv || (B.mv = { cage: null, rain: null, magma: null, carry: null, wgust: null, pop: null });
const POPFIX = new WeakMap(); // sim -> the popped weasel's fixture (rebuilt from mv.pop after a load)
export const wgustBeat = (G) => { const el = G.dur - G.t; return Math.pow(Math.max(0, Math.sin(Math.PI * el * 3 / G.dur)), 2); };
const locked = (sim, ring) => { const R = sim.bx.rl[ring.i]; return R.frost > 0 || R.spin > 0; };

// ---------- telegraph data (null = nothing worth it now)
export function mvStart(sim, B, name, M) {
  const T = bossTargets(sim), n = sim.rings.length, mv = mvOf(B);
  switch (name) {
    case 'cage': {
      if (mv.cage) return null;
      const e = T.find((q) => { const c = sim.channelOf(q); return c >= 1 && c < n; });
      if (!e) return null;
      const c = sim.channelOf(e), ring = sim.rings[c], p = e.body.getPosition(), rb = ring.r - RING_TH / 2;
      const la = Math.atan2(p.y, p.x) - ring.body.getAngle(), d = MV.cageOff / rb;
      return { ri: c, spots: [la - d, la + d], eid: e.id, aim: p.x };
    }
    case 'shards': {
      if (mv.rain) return null;
      const C = T.filter((q) => sim.channelOf(q) >= 1), e = C[C.length > 1 && sim.rand() < 0.3 ? 1 : 0]; // eggs in the core are under every ring
      if (!e) return null;
      const p = e.body.getPosition(), rad = Math.max(0.6, Math.hypot(p.x, p.y));
      return { aw: Math.atan2(p.y, p.x), hw: clamp(MV.rainW / rad, 0.12, 0.32), aim: p.x };
    }
    case 'magma': {
      if (mv.magma || !sim.salHot) return null;
      const warn = WARN.magma * M.warn;
      // fair: every egg resting on the ring can have a gap of it brought under it before it heats
      const fair = (ring) => sim.aliveEggs().every((e) => {
        if (sim.channelOf(e) !== ring.i) return true;
        const p = e.body.getPosition(), la = Math.atan2(p.y, p.x) - ring.body.getAngle();
        return ring.gaps.some((g) => sim.gapOpenFor(g, e) && Math.abs(wrap(g.a - la)) - g.len / (2 * ring.r) <= sim.maxOmega(ring) * warn * 0.45); // the egg rolls along with its ring: it gains on it at about half speed
      });
      for (const e of T) {
        const c = sim.channelOf(e), ring = sim.rings[c];
        if (c < n && ring.grabbable && !locked(sim, ring) && fair(ring)) return { ri: c, aim: e.body.getPosition().x };
      }
      const busy = new Set(sim.aliveEggs().map((e) => sim.channelOf(e)));
      const R = sim.rings.filter((r) => !busy.has(r.i) && r.thorns.some((th) => th.alive)).sort((a, b) => b.thorns.filter((th) => th.alive).length - a.thorns.filter((th) => th.alive).length)[0];
      return R ? { ri: R.i } : null;
    }
    case 'dive': {
      if (mv.carry) return null;
      const N = sim.nest.getPosition(), C = T.filter((q) => { const c = sim.channelOf(q); return c >= Math.max(1, n - 2) && c < n; });
      if (!C.length) return null;
      const d = (q) => { const p = q.body.getPosition(); return Math.hypot(p.x - N.x, p.y - N.y); };
      const e = C.sort((a, b) => d(b) - d(a) || a.id - b.id)[0], p = e.body.getPosition();
      return { eid: e.id, x: p.x, y: p.y, aim: p.x, open: !roofedWide(sim, p), ra: sim.rings.map((r) => r.body.getAngle()) };
    }
    case 'pop': {
      if (mv.pop) return null;
      const e = T.find((q) => { const c = sim.channelOf(q); return c >= 1 && c < n; });
      if (!e) return null;
      const c = sim.channelOf(e), ring = sim.rings[c], p = e.body.getPosition(), rb = ring.r - RING_TH / 2;
      const la = Math.atan2(p.y, p.x) - ring.body.getAngle();
      let best = 0, bd = 1e9;
      for (const g of ring.gaps) { const d = wrap(g.a - la); if (Math.abs(d) < bd) { bd = Math.abs(d); best = d; } }
      const side = best ? Math.sign(best) : (sim.rand() < 0.5 ? -1 : 1);
      const ahead = Math.min(MV.popAhead, Math.max(0.6, Math.abs(best) * rb - 0.5));
      const at = la + side * ahead / rb, q = ringPoint(sim, c, at, rb - MV.popR);
      if (sim.aliveEggs().some((o) => { const op = o.body.getPosition(); return Math.hypot(op.x - q.x, op.y - q.y) < 0.6; })) return null;
      return { ri: c, la: at, aim: q.x };
    }
    case 'wgust': {
      if (mv.wgust) return null;
      const dir = sim.rand() < 0.5 ? -1 : 1;
      return { dir };
    }
    case 'whip': {
      const e = T[0];
      if (!e) return null;
      let ring = sim.rings[Math.min(n - 1, sim.channelOf(e))];
      if (!ring.grabbable || ring.gear || locked(sim, ring)) ring = sim.rings.find((r) => r.grabbable && !r.gear && !locked(sim, r) && r.i > 0);
      if (!ring) return null;
      return { ring: ring.i, dir: ring.oneway || (sim.rand() < 0.5 ? 1 : -1), aim: e.body.getPosition().x };
    }
  }
  return null;
}

export function mvAct(sim, B, A) {
  const M = M_(sim), mv = mvOf(B);
  switch (A.name) {
    case 'cage': {
      const ring = sim.rings[A.ri], walls = [];
      for (const la of A.spots) {
        const q = ringPoint(sim, A.ri, la, ring.r - RING_TH / 2 - 0.3);
        if (sim.aliveEggs().some((e) => { const p = e.body.getPosition(); return Math.hypot(p.x - q.x, p.y - q.y) < 0.34; })) continue;
        const W = addWall(sim, 'cage', A.ri, la, MV.cageT);
        W.a0 = ring.body.getAngle(); W.b0 = sim.rings[A.ri - 1].body.getAngle();
        walls.push(W.id);
      }
      if (walls.length) mv.cage = { ri: A.ri, walls };
      sim.emit('mvCage', { ri: A.ri, n: walls.length, x: B.x, y: B.y });
      break;
    }
    case 'shards':
      mv.rain = { aw: A.aw, hw: A.hw, t: MV.rainT, dur: MV.rainT, hit: {} };
      sim.emit('mvShards', { aw: A.aw });
      break;
    case 'magma': {
      const ring = sim.rings[A.ri], k = ++sim.salBurnN, T = MV.magmaT * M.hold;
      ring.segs.forEach((sg, si) => { if (!sg.alive) return; if (!(sg.hot > 0)) sim.salHot.push({ ri: ring.i, si }); sg.hot = T; sg.hotK = k; });
      mv.magma = { ri: A.ri, t: T, dur: T, burn: MV.magmaBurn };
      sim.emit('mvMagma', { ring: A.ri, x: 0, y: -ring.r });
      break;
    }
    case 'dive': {
      const e = sim.aliveEggs().find((q) => q.id === A.eid);
      if (!e) break;
      const p = e.body.getPosition(), c = sim.channelOf(e);
      if (A.open && roofedWide(sim, p)) { B.dizzy = Math.max(B.dizzy, MV.diveDizzy); mv.bonk = { x: p.x, y: p.y + 0.5, t: sim.t }; sim.emit('mvDiveBonk', { x: p.x, y: p.y + 0.5 }); break; }
      if (c < 1 || c >= n0(sim)) break;
      const rad = c >= 2 ? (sim.rings[c - 2].r + sim.rings[c - 1].r) / 2 : sim.rings[0].r * 0.45, a = Math.atan2(p.y, p.x);
      mv.carry = { eid: e.id, x0: p.x, y0: p.y, x1: rad * Math.cos(a), y1: rad * Math.sin(a), t: 0, dur: MV.carryT };
      sim.emit('mvDiveGrab', { x: p.x, y: p.y, egg: e });
      break;
    }
    case 'pop': {
      const ring = sim.rings[A.ri], rb = ring.r - RING_TH / 2, q = ringPoint(sim, A.ri, A.la, rb - MV.popR);
      if (sim.aliveEggs().some((o) => { const op = o.body.getPosition(); return Math.hypot(op.x - q.x, op.y - q.y) < 0.55; })) { sim.emit('mvPopMiss', { x: q.x, y: q.y }); break; } // never on an egg
      const T = M.hold * MV.popT;
      mv.pop = { ri: A.ri, la: A.la, t: T, dur: T, hit: 0 };
      popFix(sim, mv.pop);
      sim.emit('mvPop', { x: q.x, y: q.y });
      break;
    }
    case 'wgust':
      mv.wgust = { dir: A.dir, t: MV.wgustT, dur: MV.wgustT };
      animalsHit(sim, 'gust', { dir: A.dir, power: MV.wgust * M.power / 5, dur: MV.wgustT });
      sim.emit('mvGust', { dir: A.dir });
      break;
    case 'whip': {
      const ring = sim.rings[A.ring], R = sim.bx.rl[A.ring], held = ringHeld(ring);
      R.spin = held ? MV.whipHeld : MV.whip;
      R.dir = A.dir;
      sim.emit('mvWhip', { ring: A.ring, dir: A.dir, held: held ? 1 : 0, x: B.x, y: B.y });
      break;
    }
  }
  void M;
}

const n0 = (sim) => sim.rings.length;
const ringPoint = (sim, ri, la, rad) => { const a = sim.rings[ri].body.getAngle() + la; return { x: rad * Math.cos(a), y: rad * Math.sin(a) }; };
export const inWedge = (p, aw, hw) => Math.abs(wrap(Math.atan2(p.y, p.x) - aw)) < hw;

export function mvStep(sim, B, dt) {
  const mv = B.mv;
  if (!mv) return;
  // the cage: either ring of the channel turned far enough shears the crystals off
  if (mv.cage) {
    const C = mv.cage, ws = sim.bx.walls.filter((W) => W.alive && C.walls.includes(W.id));
    for (const W of ws) {
      const da = Math.abs(sim.rings[W.ri].body.getAngle() - W.a0), db = Math.abs(sim.rings[W.ri - 1].body.getAngle() - W.b0);
      if (da > MV.shear || db > MV.shear) removeWall(sim, W, 'shear');
    }
    if (!sim.bx.walls.some((W) => W.alive && C.walls.includes(W.id))) mv.cage = null;
  }
  // the dive's lock-on follows its egg through the telegraph
  const A = B.atk;
  if (A && A.name === 'dive' && A.ph === 'warn') { const e = sim.aliveEggs().find((q) => q.id === A.eid); if (e) { const p = e.body.getPosition(); A.x = p.x; A.y = p.y; if (!roofedWide(sim, p) || (A.ra && sim.rings.some((r, i) => Math.abs(r.body.getAngle() - A.ra[i]) > 0.3))) A.open = true; } } // a ring turned during the warning also counts: an egg that sat under a wall all along is never an unavoidable snatch
  // carried up: the egg rides the talons along an arc to the channel inside (its velocity is held at zero)
  if (mv.carry) {
    const K = mv.carry, e = sim.aliveEggs().find((q) => q.id === K.eid);
    K.t += dt;
    const f = clamp(K.t / K.dur, 0, 1), s2 = f * f * (3 - 2 * f);
    if (e) {
      e.body.setTransform(Vec2(K.x0 + (K.x1 - K.x0) * s2, K.y0 + (K.y1 - K.y0) * s2 + Math.sin(Math.PI * f) * 0.5), e.body.getAngle());
      e.body.setLinearVelocity(Vec2(0, 0));
      e.body.setAngularVelocity(0);
    }
    if (!e || f >= 1) { mv.carry = null; if (e) sim.emit('mvDiveDrop', { x: K.x1, y: K.y1 }); }
  }
  // the popped weasel: it stands its time, then ducks back down its tunnel
  if (mv.pop) {
    const W = mv.pop;
    if (!POPFIX.get(sim)) popFix(sim, W);
    if ((W.t -= dt) <= 0) popEnd(sim, mv, 'down');
  }
  // wing gust: three beats
  if (mv.wgust) {
    const G = mv.wgust, b = wgustBeat(G);
    if (b > 0.01) galeForce(sim, { dir: G.dir, dur: 10, t: 5, gale: MV.wgust * b }, M_(sim), dt);
    if ((G.t -= dt) <= 0) mv.wgust = null;
  }
  // the magma ring: its thorns burn off once it is properly hot
  if (mv.magma) {
    const G = mv.magma, ring = sim.rings[G.ri];
    if (G.burn > 0 && (G.burn -= dt) <= 0) {
      let n = 0;
      for (const th of ring.thorns) if (th.alive) { sim.removeThorn(th, 'burn'); n++; }
      if (n) sim.emit('mvMagmaBurn', { ring: G.ri, n });
    }
    if ((G.t -= dt) <= 0) mv.magma = null;
  }
  // the shard rain
  if (mv.rain) {
    const R = mv.rain;
    for (const e of sim.aliveEggs()) {
      const p = e.body.getPosition();
      if (sim.channelOf(e) >= sim.rings.length || !inWedge(p, R.aw, R.hw) || roofed(sim, p)) continue;
      const h = (R.hit[e.id] = (R.hit[e.id] || 0) + dt);
      if (h >= MV.rainHit && h - dt < MV.rainHit) {
        if (sim.MD.softThorns && e.cracks >= 2) { sim.emit('mvShardShrug', { x: p.x, y: p.y }); continue; } // Easy: never the breaking crack
        sim.emit('mvShardHit', { x: p.x, y: p.y, egg: e });
        sim.crack(e, 0, 'shard');
      }
    }
    if ((R.t -= dt) <= 0) mv.rain = null;
  }
}

function popFix(sim, W) {
  const ring = sim.rings[W.ri], rad = ring.r - RING_TH / 2 - MV.popR;
  const fix = ring.body.createFixture({ shape: new Circle(Vec2(rad * Math.cos(W.la), rad * Math.sin(W.la)), MV.popR), friction: 0.4, restitution: 0.3, filterCategoryBits: 1, filterMaskBits: 2 | 4 | 64 | 128, userData: { kind: 'wall', wall: { kind: 'pop', alive: true } } });
  POPFIX.set(sim, fix);
}
function popEnd(sim, mv, why) {
  const W = mv.pop, fix = POPFIX.get(sim);
  if (fix) { sim.killFix.push([sim.rings[W.ri].body, fix]); POPFIX.delete(sim); }
  const q = ringPoint(sim, W.ri, W.la, sim.rings[W.ri].r - RING_TH / 2 - MV.popR);
  mv.pop = null;
  sim.emit('mvPopEnd', { why, x: q.x, y: q.y });
}
// an egg rolls into the popped weasel: the egg bounces back unharmed (the contact is ours), the weasel is bonked
export function popContact(sim, c, egg) {
  c.setEnabled(false);
  const B = sim.bx && sim.bx.boss, mv = B && B.mv;
  if (!mv || !mv.pop || mv.pop.hit) return;
  mv.pop.hit = 1;
  sim.defer(() => {
    if (!mv.pop) return;
    const W = mv.pop, q = ringPoint(sim, W.ri, W.la, sim.rings[W.ri].r - RING_TH / 2 - MV.popR), p = egg.body.getPosition(), v = egg.body.getLinearVelocity();
    let nx = p.x - q.x, ny = p.y - q.y; const d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d;
    const vn = v.x * nx + v.y * ny, back = Math.max(1.2, -vn * 0.6);
    egg.body.setLinearVelocity(Vec2(v.x - vn * nx + nx * back, v.y - vn * ny + ny * back));
    egg.crackCD = Math.max(egg.crackCD || 0, 0.4);
    const T = sim.thiefBoss && sim.thiefBoss();
    if (T && sim.thHurt) { T.hitCD = 0; sim.thHurt(T, 'pop', { x: q.x, y: q.y }); }
    else { B.dizzy = Math.max(B.dizzy, 2); }
    sim.emit('mvPopBonk', { x: q.x, y: q.y });
    popEnd(sim, mv, 'bonk');
  });
}
// the weasel goes down its tunnel for the telegraph and the pop (the den shows it gone)
export function popHide(sim, dur) { const T = sim.thiefBoss && sim.thiefBoss(); if (T && sim.thSet) sim.thSet(T, 'hide', dur); }

void TAU;
