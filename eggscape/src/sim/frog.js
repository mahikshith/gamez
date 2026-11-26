// The frog (v3.3 M8 creature). Mixed into Sim (sim.js: Object.assign(Sim.prototype, frogMethods)), so `this` is the
// Sim. No imports from sim.js (it imports this file). Every field is plain data in this.frogs, copied by frogState() /
// restored by frogLoad(), so rewind and the planner stay exact. The physics bodies are derived, never stored.
//
// level.frog {ch, a, delay, every, face} or an array of them. ch = the channel it sits in (0 .. rings-1: it stands on
// the floor of that channel, the inner face of ring ch), a = start angle (deg, -90 = bottom), delay = s to its first
// hop, every = s between hops (Medium), face = +1 | -1.
//
// The only creature that crosses rings. It rides the ring it stands on (turn the ring and it goes round). Every
// `every` s it crouches and puffs its throat (HOP_WARN, the telegraph), then hops in an arc through a gap of the ring
// above or below it, into the neighbouring channel, and lands on that channel's floor (or in a gap there). Its tongue
// (FROG.tongue m, after a lick of the lips, LICK_WARN) snatches a power orb or a hatched chick in its channel and
// swallows it; it never eats eggs.
// Plus: a frog sitting in a gap plugs it. It is a solid body that eggs bounce off softly (no crack, the fall counts as
// landed), so it works as a temporary floor until it hops away. A red/black flame on an egg, or a dash chick, within
// SCARE_R scares it into one big escape hop away from the threat. Easy: hops and licks less often, shorter tongue.
// It always stands upright against gravity: side -1 = on the inner face of its ring (a floor in the lower half), +1 = on the
// outer face (a floor in the upper half). When a turning ring carries it past the horizon so its surface becomes a ceiling,
// it lets go and drops (a somersault) to the opposite wall of the channel instead of hanging.
//
// 0.8.18 (the owner: "the frog should have its own set of things ... it will probably steal the egg with the tongue"):
//   THE SNATCH. An egg within FROG_MODE.snReach of its mouth, in its channel or the one next to it, with a clear line (no
//     ring wall, thorn or barrier between: a ray against the rings' fixtures) catches its eye: it locks on (the 'lick'
//     phase with lk 'egg': eyes bulge, it licks its lips, the throat swells; snWarn s, longer on Easy), then the tongue
//     shoots. Clear line: it sticks and reels the egg into its cheeks (egg.hc = 4: the body is switched off, so nothing
//     can crack it in there; frogCarry keeps it at the cheek). It hops one ring INWARD with it (a setback, never a loss)
//     and spits it out ("ptoo", frogRelease) FROG.hold s after the grab, or at once when it is scared, bopped, hit by a
//     power, or its ring is turned briskly (F.spin, a leaky sum of degrees: it gets dizzy). It never eats an egg.
//     Fair: at most one egg in the mouth, snCD s between snatches, snMax a level (Easy: one; a level's frog.sn caps it
//     lower: its first level teaches it with one), none in the last snTail s.
//   THE BONK (the counter). A wall turned between frog and egg when the tongue shoots: it slaps the wall and snaps back
//     into its face; it sits dizzy for bonkStun s (the stun state: it hops and licks nothing, plugs what it plugged).
//   THE BELLY BOP. An egg landing hard on it (bopV) makes it cough up what it holds: the held egg is spat out, a
//     swallowed orb (F.belly: it licks no other orb while it has one) pops back out as a normal orb. It looks offended.
//   THE DECOY. A decoy (the power) or a hatched chick near it is what it hunts for a while instead of the eggs (frogAim).
// Events for the art and the lessons: frogLick {kind: 'egg', ring: the ring that answers it}, frogSnatch, frogBonk,
// frogSpit {why}, frogBop, frogCough {orb}, frogBurp {orb}.
import { Vec2, Polygon } from 'planck';
import { RING_TH, wrap, clamp } from './geom.js';

export const FROG = {
  w: 1.13, // m, body width (a gap is 0.78 wide: a frog in it covers it with room to spare). v3.5: art is 1.09 m per 100 units
  every: 6, hopWarn: 0.7, land: 0.3, // s between hops (Medium), crouch + puff telegraph, landing squash
  reach: 2.4, scareReach: 3.6, // m of arc to the gap it hops through
  tongue: 1.5, lickWarn: 0.5, tongueT: 0.4, gulpT: 0.65, lickCD: 4, // m, s
  scareR: 1.7, scareCD: 4, scareHop: 1.5, // m, s, height factor of the escape hop
  hunt: 2.5, // s: an egg in another channel brings the next hop forward to this gap since the last one (0.8.10: the frog hunts)
  grab: 0.35, // fraction of the tongue phase at which it reaches its prey
  hang: 0.12, // sin(angle) past which a frog's surface is a ceiling and it drops
  low: -0.3, // a gap must sit below this sin(angle) (the lower part of the vault) to be hopped through
  // 0.8.18 the snatch (see the header)
  snTongue: 0.55, stuffT: 0.5, hold: 3, spitT: 0.5, spitAt: 0.4, // s: the egg tongue (slower than the orb lick), cheeks filling, held in the cheeks, the spit (it lets go at spitAt of it)
  snTail: 6, // s of fuse left under which it never locks on an egg
  bonkStun: 3, spinStun: 1.6, spinTau: 0.45, // s dizzy after a bonk / a brisk turn of its ring; the leak of the turn sum
  bopV: 1.3, bopCD: 0.8, offT: 1.4, // m/s an egg landing on it that counts as a bop; s between bops; s it looks offended
  bellyT: 3, // s its belly glows the colour of a swallowed orb (then a soft glow while it still holds it)
  decoyR: 4, // m: a hatched chick this close is what it hunts instead of the eggs
};
// where the egg sits in its cheeks, from the feet: along the surface (forward) and up the normal, m (render/frog.js draws it there)
export const FROG_CHEEK = { f: 0.3, u: 0.3 };
// per mode: every = hop gap x, lick = lick gap x, tongue = tongue length (m), warn = telegraph x
// 0.8.18 snatch: snReach (m, mouth to the egg's middle), snWarn (s the lock-on lasts), snCD (s between snatches), snMax (a
// level), dizzy (deg of its ring turned within about spinTau s that makes it spit)
export const FROG_MODE = {
  easy: { every: 1.4, lick: 1.6, tongue: 1.1, warn: 1.3, snReach: 1.2, snWarn: 1.4, snCD: 99, snMax: 1, dizzy: 10 },
  medium: { every: 1, lick: 1, tongue: 1.5, warn: 1, snReach: 1.45, snWarn: 0.95, snCD: 8, snMax: 3, dizzy: 14 },
  hard: { every: 0.8, lick: 0.8, tongue: 1.6, warn: 0.85, snReach: 1.55, snWarn: 0.8, snCD: 6, snMax: 4, dizzy: 18 },
};
const CAT_FROG = 256, MASK_FROG = 2; // collides with eggs only (CAT.EGG = 2, and sim.js adds this category to the egg mask)
// polygons in the frog's frame (x along the surface, y out of it, feet at y = 0): a dome when sitting on a floor,
// a flat table across the opening when sitting in a gap (its top is 0.03 m above the ring's inner face)
// v3.5: a taller sitting frog (0.4 m collider, art about 0.7 m with the eyes): the channel is 0.84 m clear, an egg needs 0.42 to roll past on top
const SHAPE = {
  dome: [[-0.5, 0], [-0.51, 0.1], [-0.4, 0.3], [-0.14, 0.4], [0.14, 0.4], [0.4, 0.3], [0.51, 0.1], [0.5, 0]],
  table: [[-0.5, 0], [-0.5, 0.13], [-0.44, 0.2], [0.44, 0.2], [0.5, 0.13], [0.5, 0]],
};
const sstep = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };

export const frogMethods = {
  // ---------- build
  frogInit(L) {
    this.frogs = [];
    this.frogBody = [];
    const list = !L.frog ? [] : Array.isArray(L.frog) ? L.frog : [L.frog];
    const n = this.rings.length;
    list.forEach((P, i) => {
      const fi = clamp(P.ch ?? 1, 0, n - 1), ring = this.rings[fi];
      const F = {
        id: i, ph: 'sit', t: 0, dur: 0, fi, la: wrap(((P.a ?? -90) * Math.PI) / 180 - ring.body.getAngle()), rf: ring.r - RING_TH / 2, gi: -1, shp: 'dome',
        face: P.face === -1 ? -1 : 1, next: P.delay ?? 3, every: P.every || FROG.every, lickCD: 1.5, scareCD: 0, sc: 0, solid: 1,
        side: -1, ts: -1, ss: -1, x: 0, y: 0, nx: 0, ny: 1, vx: 0, vy: 0, air: 0, u: 0, bump: 0, bumpCD: 0,
        hk: '', hr: 0, hg: 0, sri: 0, sla: 0, sr: 0, ti: 0, tla: 0, tr: 0, tpl: -1, hd: 0.6, hh: 1,
        lk: '', lx: 0, ly: 0, lid: 0, lty: '', hit: 0, got: 0, pk: '', pty: '', px: 0, py: 0,
        frz: 0, frzMax: 0, stn: 0, stnMax: 0, zapT: 0, // frozen / stunned / zap flash: seconds left (frog: powers, rooster)
        // 0.8.18: the egg in its cheeks (id, -1 none), s since the grab, hopped inward with it, where the tongue caught it;
        // snatch cooldown and count; the bonk (1 shot at a wall, 2 slapped); its ring's leaky turn sum (deg); a bop to
        // handle, its cooldown, s offended; the swallowed orb's type and s since; s the spit lasted (render)
        eg: -1, egT: 0, egHop: 0, gx: 0, gy: 0, snCD: P.delay ?? 3, snN: 0, snMx: P.sn ?? 99, bkN: 0, bonk: 0, spin: 0, bopReq: 0, bopCD: 0, off: 0, belly: '', bsrc: '', bellyT: 0, spWhy: '',
      };
      this.frogs.push(F);
      this.frogSeat(F);
      this.frogPlace(F);
      this.frogBody.push(this.world.createBody({ type: 'kinematic', position: Vec2(F.x, F.y) }));
      this.frogShape(i);
      this.frogTeleport(i);
    });
  },

  // sit on the floor at F.la, or in the gap that la falls in (la snaps to the gap's middle)
  frogSeat(F) {
    const ring = this.rings[F.fi];
    F.gi = -1;
    F.rf = ring.r + F.side * RING_TH / 2;
    ring.gaps.forEach((g, k) => {
      if (F.gi < 0 && this.frogGapOk(g) && Math.abs(wrap(F.la - g.a)) * ring.r < g.len / 2 + 0.1) { F.gi = k; F.la = g.a; F.rf = ring.r - F.side * RING_TH / 2; }
    });
    F.shp = F.gi >= 0 ? 'table' : 'dome';
  },
  frogGapOk(g) {
    return !g.grate && (g.o ?? 1) > 0.5 && !(g.curtain && (g.curtain.alive || g.curtain.u > 0.6));
  },

  // ---------- geometry: the frog's feet point, outward normal (into the channel) and speed
  frogPlace(F) {
    const a = this.rings[F.fi].body.getAngle() + F.la;
    F.wa = a;
    F.x = F.rf * Math.cos(a); F.y = F.rf * Math.sin(a);
    F.nx = F.side * Math.cos(a); F.ny = F.side * Math.sin(a);
  },
  frogMouth(F) { // in front of the head, 0.22 m up the normal
    const tx = F.ny * F.face, ty = -F.nx * F.face;
    return { x: F.x + F.nx * 0.5 + tx * 0.4, y: F.y + F.ny * 0.5 + ty * 0.4 };
  },
  frogChs(F) { return F.gi >= 0 ? [F.fi, F.fi + 1] : [F.side < 0 ? F.fi : F.fi + 1]; }, // a ring's inner face is channel fi, its outer face channel fi+1
  // 0.8.18: the mouth when it turns to face (x, y)
  frogMouthTo(F, x, y) {
    const f = (x - F.x) * F.ny - (y - F.y) * F.nx >= 0 ? 1 : -1, tx = F.ny * f, ty = -F.nx * f;
    return { x: F.x + F.nx * 0.5 + tx * 0.4, y: F.y + F.ny * 0.5 + ty * 0.4, face: f };
  },
  // the first ring wall, thorn or barrier on the straight line a -> b (null = a clear line). Only the rings' own fixtures
  // block: eggs, creatures and sensors do not, nor an open shutter or a retracted thorn.
  frogLine(ax, ay, bx, by) {
    if (Math.hypot(bx - ax, by - ay) < 1e-3) return null;
    if (!this.frogRB || this.frogRB.n !== this.rings.length) { this.frogRB = new Set(this.rings.map((r) => r.body)); this.frogRB.n = this.rings.length; }
    let hit = null;
    this.world.rayCast(Vec2(ax, ay), Vec2(bx, by), (fx, p, n, fr) => {
      if (fx.isSensor() || !this.frogRB.has(fx.getBody())) return -1;
      const u = fx.getUserData() || {};
      if (u.kind === 'shut' && u.gap && u.gap.o > 0.5) return -1;
      if (u.kind === 'thorn' && u.thorn && u.thorn.ext < 0.5) return -1;
      hit = { x: p.x, y: p.y };
      return fr;
    });
    return hit;
  },
  // where the held egg sits: in front of the head, low (FROG_CHEEK)
  frogCheekPt(F) {
    const tx = F.ny * F.face, ty = -F.nx * F.face;
    return { x: F.x + F.nx * FROG_CHEEK.u + tx * FROG_CHEEK.f, y: F.y + F.ny * FROG_CHEEK.u + ty * FROG_CHEEK.f };
  },

  // the body follows the planned pose by velocity (so eggs get a proper push); a shape swap rebuilds the fixture
  frogShape(i) {
    const F = this.frogs[i], b = this.frogBody[i];
    if (b.shp === F.shp) return;
    for (let f = b.getFixtureList(); f; f = b.getFixtureList()) b.destroyFixture(f);
    b.createFixture({ shape: new Polygon(SHAPE[F.shp].map((p) => Vec2(p[0], p[1]))), friction: 0.7, restitution: 0.3, filterCategoryBits: CAT_FROG, filterMaskBits: MASK_FROG, userData: { kind: 'frog', idx: i } });
    b.shp = F.shp;
  },
  frogTeleport(i) {
    const F = this.frogs[i], b = this.frogBody[i];
    b.setTransform(Vec2(F.x, F.y), Math.atan2(-F.nx, F.ny));
    b.setLinearVelocity(Vec2(0, 0));
    b.setAngularVelocity(0);
  },
  frogDrive(i, dt) {
    const F = this.frogs[i], b = this.frogBody[i], p = b.getPosition();
    b.setLinearVelocity(Vec2((F.x - p.x) / dt, (F.y - p.y) / dt));
    b.setAngularVelocity(wrap(Math.atan2(-F.nx, F.ny) - b.getAngle()) / dt);
  },

  // ---------- contacts (called from sim.js preSolve / impactCheck)
  // a frog in the air, or one that landed on an egg, is a ghost; an egg on a solid frog has landed
  frogPass(ua, ub) {
    const fa = ua.kind === 'frog' ? ua : ub.kind === 'frog' ? ub : null;
    if (!fa) return false;
    const F = this.frogs[fa.idx];
    if (!F || !F.solid) return true;
    const eg = ua.kind === 'egg' ? ua.egg : ub.kind === 'egg' ? ub.egg : null;
    if (eg) eg.freefall = 0; // it landed on something: the fall is over
    return false;
  },
  // an egg landing on a frog: a soft bounce, never a crack (the caller drops the impact), the frog squashes
  frogBump(egg, v, idx, pt) {
    const F = this.frogs[idx];
    egg.freefall = 0; egg.drop = 0;
    if (!F || v < 0.8) return;
    F.bump = Math.max(F.bump, clamp(v / 6, 0.15, 1));
    if (F.bumpCD <= 0) { F.bumpCD = 0.35; this.emit('frogBounce', { x: pt.x, y: pt.y, v, id: F.id }); }
    // 0.8.18 the belly bop: a hard landing on its back (from above, not a roll into its side). Handled in frogStep (no
    // bodies change inside a contact).
    if (v >= FROG.bopV && F.bopCD <= 0 && F.ph !== 'hop' && egg.body) {
      const p = egg.body.getPosition();
      if ((p.x - F.x) * F.nx + (p.y - F.y) * F.ny > 0.3) { F.bopReq = 1; F.bopCD = FROG.bopCD; }
    }
  },

  // ---------- every step
  frogStep(dt) {
    if (!this.frogs || !this.frogs.length) return;
    const play = this.state === 'play';
    this.frogs.forEach((F, i) => {
      for (const k of ['lickCD', 'scareCD', 'bumpCD', 'snCD', 'bopCD', 'off']) if (F[k] > 0) F[k] = Math.max(0, F[k] - dt);
      if (F.belly) { const b0 = F.bellyT; F.bellyT += dt; if (b0 < 0.95 && F.bellyT >= 0.95) this.emit('frogBurp', { x: F.x, y: F.y, id: F.id, orb: F.belly }); }
      if (F.eg >= 0) F.egT += dt;
      F.bump = Math.max(0, F.bump - dt * 3);
      if (F.zapT > 0) F.zapT = Math.max(0, F.zapT - dt); else if (F.stn > 0) F.stn = Math.max(0, F.stn - dt); // a zap's flash first, then the dizzy
      if (F.frz > 0) F.frz = Math.max(0, F.frz - dt);
      const x0 = F.x, y0 = F.y;
      F.t += dt;
      this.frogOne(F, dt, play);
      if (F.eg >= 0) this.frogCarry(F);
      F.vx = (F.x - x0) / dt; F.vy = (F.y - y0) / dt;
      if (!F.solid && F.ph !== 'hop' && !this.frogEggNear(F)) F.solid = 1; // it landed on an egg: solid once the egg moves
      this.frogShape(i);
      this.frogDrive(i, dt);
    });
  },
  frogSet(F, ph, dur = 0) { F.ph = ph; F.t = 0; F.dur = dur; },
  frogEggNear(F) {
    const cx = F.x + F.nx * 0.2, cy = F.y + F.ny * 0.2;
    for (const e of this.aliveEggs()) { const p = e.body.getPosition(); if (Math.hypot(p.x - cx, p.y - cy) < 0.7) return true; }
    return false;
  },

  frogOne(F, dt, play) {
    const M = FROG_MODE[this.mode] || FROG_MODE.medium;
    if (F.ph === 'hop') { this.frogFly(F); return; }
    this.frogPlace(F);
    if (!play) { if (F.eg >= 0) this.frogRelease(F, 'end'); F.bopReq = 0; return; }
    // 0.8.18: its ring turned briskly (a leaky sum of the degrees it is carried) makes it dizzy: out comes the egg
    F.spin = F.spin * Math.exp(-dt / FROG.spinTau) + Math.abs(this.rings[F.fi].omega || 0) * dt * (180 / Math.PI);
    if (F.eg >= 0 && F.spin > M.dizzy && !(F.frz > 0)) { this.frogRelease(F, 'dizzy'); F.stn = F.stnMax = Math.max(F.stn, FROG.spinStun); F.spin = 0; }
    // the belly bop (frogBump): it coughs up what it holds and looks offended
    if (F.bopReq) {
      F.bopReq = 0; F.off = FROG.offT;
      const had = F.eg >= 0 ? 'egg' : F.belly ? 'orb' : '';
      if (F.eg >= 0) this.frogRelease(F, 'bop'); else if (F.belly) this.frogCough(F);
      this.emit('frogBop', { x: F.x, y: F.y, id: F.id, had });
    }
    if (F.side < 0 ? Math.sin(F.wa) > FROG.hang : Math.sin(F.wa) < -FROG.hang) { this.frogDrop(F); return; } // its wall turned into a ceiling
    if (F.frz > 0 || F.stn > 0) { // frozen or stunned: it does nothing (still a solid body, still a floor in a gap)
      if (F.eg >= 0) this.frogRelease(F, 'hit'); // a power or the rooster: the egg pops out
      if (F.ph === 'spit' ? F.t >= F.dur : F.ph !== 'sit' && F.ph !== 'land') { F.sc = 0; F.hk = ''; F.bonk = 0; this.frogSet(F, 'sit'); }
      F.lickCD = Math.max(F.lickCD, 0.8); F.scareCD = Math.max(F.scareCD, 0.5);
      return;
    }
    const idle = F.ph === 'sit' || F.ph === 'land' || F.ph === 'crouch' || F.ph === 'lick';
    if (idle && F.scareCD <= 0) {
      const th = this.frogThreat(F);
      if (th) { if (F.eg >= 0) this.frogRelease(F, 'scare'); this.frogScare(F, th); return; }
    }
    switch (F.ph) {
      case 'sit': {
        if (F.eg >= 0) { // 0.8.18: an egg in its cheeks: one hop inward with it, then it spits it out
          if (F.egT >= FROG.hold) { this.frogSet(F, 'spit', FROG.spitT); F.spWhy = 'ptoo'; return; }
          if (!F.egHop) {
            F.egHop = 1;
            const plan = this.frogPick(F, false, null, 'up');
            if (plan) { this.frogPlan(F, plan, false); this.frogSet(F, 'crouch', 0.3); this.emit('frogCrouch', { x: F.x, y: F.y, id: F.id, egg: 1 }); }
          }
          return;
        }
        if (F.snCD <= 0 && F.snN < Math.min(M.snMax, F.snMx ?? 99)) { const pr = this.frogEggPrey(F, M); if (pr) { this.frogLick(F, pr, M); return; } }
        if (F.lickCD <= 0) { const pr = this.frogPrey(F, M); if (pr) { this.frogLick(F, pr, M); return; } }
        // 0.8.10: an egg in another channel brings the hop forward (never closer together than FROG.hunt), so the frog
        // goes after the eggs instead of sitting out its timer
        if ((F.next -= dt) > 0) {
          const full = F.every * M.every, aim = this.frogAim(F);
          if (!(aim && !aim.idle && aim.ch !== F.fi && full - F.next >= FROG.hunt * M.every)) return;
        }
        const plan = this.frogPick(F, false, null);
        if (plan) { this.frogPlan(F, plan, false); this.frogSet(F, 'crouch', FROG.hopWarn * M.warn); this.emit('frogCrouch', { x: F.x, y: F.y, id: F.id }); } else F.next = 1.5;
        break;
      }
      case 'crouch': if (F.t >= F.dur) this.frogLaunch(F); break;
      case 'land': if (F.t >= FROG.land) { F.sc = 0; this.frogSet(F, 'sit'); } break;
      case 'lick': {
        const egg = F.lk === 'egg';
        if (F.t < F.dur) {
          const pr = this.frogFind(F, M);
          if (!pr) { if (egg) F.snCD = Math.max(F.snCD, 2); this.emit('frogMiss', { x: F.lx, y: F.ly, id: F.id, early: 1 }); this.frogSet(F, 'sit'); }
          else if (egg) { F.lx = pr.x; F.ly = pr.y; F.face = this.frogMouthTo(F, pr.x, pr.y).face; } // the eyes stay locked on it
          break;
        }
        const pr = this.frogFind(F, M);
        if (pr && this.warpStrike('frog', F)) break; // v3.4: a warp gate swallows the frog as the tongue shoots
        F.hit = pr ? 1 : 0; F.got = 0; F.bonk = 0;
        if (pr) { F.lx = pr.x; F.ly = pr.y; }
        if (pr && egg) { // 0.8.18: a wall turned between them: the tongue slaps it
          const m = this.frogMouth(F), w = this.frogLine(m.x, m.y, pr.x, pr.y);
          if (w) { F.hit = 0; F.bonk = 1; F.lx = w.x; F.ly = w.y; }
        }
        this.frogSet(F, 'tongue', egg ? FROG.snTongue : FROG.tongueT);
        this.emit('frogTongue', { x: F.x, y: F.y, tx: F.lx, ty: F.ly, id: F.id, hit: F.hit, kind: F.lk, bonk: F.bonk });
        break;
      }
      case 'tongue': {
        const T = F.dur || FROG.tongueT;
        if (F.hit && !F.got && F.t >= T * FROG.grab) this.frogGrab(F, M);
        if (F.bonk === 1 && F.t >= T * FROG.grab) { F.bonk = 2; F.bkN++; this.emit('frogBonk', { x: F.lx, y: F.ly, id: F.id }); }
        if (F.t >= T) {
          if (F.bonk) { // it snaps back into its face: dizzy, a free window
            F.bonk = 0; F.snCD = Math.max(F.snCD, FROG.bonkStun + 2); F.next = Math.max(F.next, 1.5);
            F.stn = F.stnMax = Math.max(F.stn, FROG.bonkStun);
            this.frogSet(F, 'sit');
          } else if (F.got && F.pk === 'egg') this.frogSet(F, 'stuff', FROG.stuffT);
          else if (F.got) { this.frogSet(F, 'gulp', FROG.gulpT); this.emit('frogGulp', { x: F.x, y: F.y, id: F.id }); }
          else { if (F.lk === 'egg') F.snCD = Math.max(F.snCD, 2.5); this.emit('frogMiss', { x: F.lx, y: F.ly, id: F.id }); this.frogSet(F, 'sit'); }
        }
        break;
      }
      case 'gulp': if (F.t >= F.dur) this.frogSet(F, 'sit'); break;
      case 'stuff': if (F.t >= F.dur) this.frogSet(F, 'sit'); break;
      case 'spit': {
        if (F.eg >= 0 && F.t >= F.dur * FROG.spitAt) this.frogRelease(F, F.spWhy || 'ptoo', true);
        if (F.t >= F.dur) this.frogSet(F, 'sit');
        break;
      }
    }
  },

  // ---------- 0.8.18 the snatch
  // an egg it can take: loose, in play, a plain shell (a stone, burning, frozen, bubbled, held or tied egg is not)
  frogEggOk(e) {
    return e.alive && !e.saved && !!e.body && e.body.isActive() && !e.chick && !e.phx && !e.hc && !e.thf && !e.octo && !e.clamp && !e.hold && !e.joint && !e.sbub && !e.bubbleFix
      && !(e.stone > 0) && !(e.fire > 0) && !(e.honey > 0) && !(e.icy > 0) && !(e.bubble > 0);
  },
  // the nearest such egg within reach of its mouth, in its channel or the one next to it, with a clear line
  frogEggPrey(F, M) {
    if (this.p2Lure && this.p2Lure()) return null; // a decoy is out: it has eyes for nothing else
    if (this.timeLimit && this.timeLeft < FROG.snTail + M.snWarn) return null; // never in the last seconds
    if (this.frogs.some((O) => O !== F && O.eg >= 0)) return null; // one egg in a mouth at a time, in the whole vault
    const chs = this.frogChs(F), lo = Math.min(...chs) - 1, hi = Math.max(...chs) + 1, n = this.rings.length;
    let best = null, bd = M.snReach;
    for (const e of this.aliveEggs()) {
      if (!this.frogEggOk(e)) continue;
      const c = this.channelOf(e);
      if (c < lo || c > hi || c >= n) continue;
      const p = e.body.getPosition(), m = this.frogMouthTo(F, p.x, p.y), d = Math.hypot(p.x - m.x, p.y - m.y);
      if (d >= bd || this.frogLine(m.x, m.y, p.x, p.y)) continue;
      bd = d; best = { k: 'egg', x: p.x, y: p.y, id: e.id, ty: e.kind || '' };
    }
    return best;
  },
  // the held egg rides in its cheeks (reeled in along the tongue first)
  frogCarry(F) {
    const e = this.eggs.find((q) => q.id === F.eg);
    if (!e || !e.alive || !e.body) { F.eg = -1; return; }
    const c = this.frogCheekPt(F);
    let x = c.x, y = c.y;
    if (F.ph === 'tongue') { const T = F.dur || FROG.snTongue, u = sstep((F.t - T * FROG.grab) / (T * (1 - FROG.grab))); x = F.gx + (c.x - F.gx) * u; y = F.gy + (c.y - F.gy) * u; }
    e.body.setTransform(Vec2(x, y), e.body.getAngle());
  },
  // "ptoo": the egg comes out in front of it (behind, if a wall is right there), unhurt, rolling gently away
  frogSpitSpot(F) {
    const ring = this.rings[F.fi], rb = ring.r + F.side * RING_TH / 2, h = 0.34, m = this.frogMouth(F);
    let out = null;
    for (const f of [F.face, -F.face]) {
      const a = F.wa - F.side * f * (0.72 / rb), r = rb + F.side * h, x = r * Math.cos(a), y = r * Math.sin(a);
      const nx = F.side * Math.cos(a), ny = F.side * Math.sin(a), tx = ny * f, ty = -nx * f;
      out = { x, y, vx: tx * 1.4 + nx * 0.5, vy: ty * 1.4 + ny * 0.5 };
      if (!this.frogLine(m.x, m.y, x, y)) break;
    }
    return out;
  },
  frogRelease(F, why, inPhase = false) {
    const M = FROG_MODE[this.mode] || FROG_MODE.medium, e = this.eggs.find((q) => q.id === F.eg);
    F.eg = -1; F.egT = 0; F.egHop = 0; F.spWhy = why;
    F.snCD = Math.max(F.snCD, M.snCD); F.lickCD = Math.max(F.lickCD, 1.5);
    let at = null;
    if (e && e.alive && e.body) {
      at = this.frogSpitSpot(F);
      e.body.setTransform(Vec2(at.x, at.y), e.body.getAngle());
      e.hc = 0;
      e.body.setActive(true);
      e.body.setLinearVelocity(Vec2(at.vx, at.vy));
      e.body.setAngularVelocity(0);
      e.body.setAwake(true);
      e.safeT = Math.max(e.safeT || 0, 0.8); e.freefall = 0; e.drop = 0; e.ch = this.channelOf(e);
    }
    if (!inPhase && this.state === 'play') { this.frogSet(F, 'spit', FROG.spitT); F.t = FROG.spitT * FROG.spitAt; }
    this.emit('frogSpit', { x: at ? at.x : F.x, y: at ? at.y : F.y, id: F.id, why, egg: e ? e.id : 0 });
  },
  // a bop: the swallowed orb pops back out of its mouth as a normal orb
  frogCough(F) {
    const type = F.belly, m = this.frogMouth(F), d = Math.hypot(m.x, m.y), n = this.rings.length;
    F.belly = ''; F.bellyT = 0; F.lickCD = Math.max(F.lickCD, 5);
    this.addOrb(type, clamp(this.chAt(d), 0, n - 1), Math.atan2(m.y, m.x), F.bsrc || 'frog', d); // a level's own orb comes back as one (it still counts for "collect every orb")
    this.emit('frogCough', { x: m.x, y: m.y, id: F.id, orb: type });
  },
  // the planner's measure (src/sim/search.js value): 1 = in its cheeks, 0.6 = locked on with a clear line
  frogThreatOf(e) {
    if (e.hc === 4) return 1;
    for (const F of this.frogs || []) if (F.ph === 'lick' && F.lk === 'egg' && F.lid === e.id) return 0.6;
    return 0;
  },

  // ---------- licking
  // the nearest orb or hatched chick in reach (same channel(s), within the tongue's length of the mouth)
  frogPrey(F, M) {
    const m = this.frogMouth(F), chs = this.frogChs(F), R = M.tongue;
    let best = null, bd = R;
    for (const o of this.orbs) {
      if (F.belly || !o.alive || !chs.includes(o.ch)) continue; // 0.8.18: one orb in its belly at a time (a bop gives it back)
      const d = Math.hypot(o.x - m.x, o.y - m.y);
      if (d < bd) { bd = d; best = { k: 'orb', x: o.x, y: o.y, id: 0, ty: o.type }; }
    }
    for (const e of this.aliveEggs()) {
      if (!e.chick || e.chickKind === 'dash' || !chs.includes(this.channelOf(e))) continue; // a dash chick scares it instead
      const p = e.body.getPosition(), d = Math.hypot(p.x - m.x, p.y - m.y);
      if (d < bd) { bd = d; best = { k: 'chick', x: p.x, y: p.y, id: e.id, ty: e.chickKind || 'peck' }; }
    }
    return best;
  },
  // the same prey again when the tongue shoots (a bit more slack than the lick: it can still run)
  frogFind(F, M) {
    const m = this.frogMouth(F), chs = this.frogChs(F), R = M.tongue * 1.15;
    if (F.lk === 'orb') {
      for (const o of this.orbs) if (o.alive && o.type === F.lty && chs.includes(o.ch) && Math.hypot(o.x - F.lx, o.y - F.ly) < 0.5 && Math.hypot(o.x - m.x, o.y - m.y) < R) return { k: 'orb', x: o.x, y: o.y, o };
    } else if (F.lk === 'egg') { // 0.8.18: the egg it locked on, still in reach (the line is judged when the tongue shoots)
      const e = this.eggs.find((q) => q.id === F.lid);
      if (e && this.frogEggOk(e)) { const p = e.body.getPosition(), q = this.frogMouthTo(F, p.x, p.y); if (Math.hypot(p.x - q.x, p.y - q.y) < M.snReach * 1.15) return { k: 'egg', x: p.x, y: p.y, e }; }
    } else {
      const e = this.eggs.find((q) => q.id === F.lid);
      if (e && e.alive && !e.saved && e.chick && e.body) { const p = e.body.getPosition(); if (chs.includes(this.channelOf(e)) && Math.hypot(p.x - m.x, p.y - m.y) < R) return { k: 'chick', x: p.x, y: p.y, e }; }
    }
    return null;
  },
  frogLick(F, pr, M) {
    F.lk = pr.k; F.lx = pr.x; F.ly = pr.y; F.lid = pr.id; F.lty = pr.ty;
    const tx = F.ny, ty = -F.nx;
    F.face = (pr.x - F.x) * tx + (pr.y - F.y) * ty >= 0 ? 1 : -1;
    F.lickCD = FROG.lickCD * M.lick;
    if (pr.k === 'egg') { // 0.8.18: the lock-on. ring = the ring a turn of which answers it: the wall between them, or its own floor
      const n = this.rings.length, e = this.eggs.find((q) => q.id === pr.id), ec = e ? this.channelOf(e) : F.fi, mo = this.frogMouth(F);
      const fc = clamp(this.chAt(Math.hypot(mo.x, mo.y)), 0, n - 1), ring = clamp(ec < fc ? ec : ec > fc ? fc : F.fi, 0, n - 1);
      this.frogSet(F, 'lick', M.snWarn);
      this.emit('frogLick', { x: (mo.x + pr.x) / 2, y: (mo.y + pr.y) / 2, fx: F.x, fy: F.y, tx: pr.x, ty: pr.y, id: F.id, kind: 'egg', egg: pr.id, ring }); // x, y: the middle of the tongue's line (the lesson's spot)
      return;
    }
    this.frogSet(F, 'lick', FROG.lickWarn * M.warn);
    this.emit('frogLick', { x: F.x, y: F.y, tx: pr.x, ty: pr.y, id: F.id, kind: pr.k });
  },
  frogGrab(F, M) {
    const pr = this.frogFind(F, M);
    F.got = 1;
    if (!pr) { F.hit = 0; F.got = 0; return; }
    if (pr.k === 'egg') { // 0.8.18: a wall turned in since the shot: it slaps that instead
      const m = this.frogMouth(F), w = this.frogLine(m.x, m.y, pr.x, pr.y);
      if (w) { F.hit = 0; F.got = 0; F.bonk = 2; F.bkN++; F.lx = w.x; F.ly = w.y; this.emit('frogBonk', { x: w.x, y: w.y, id: F.id }); return; }
    }
    F.pk = pr.k; F.px = pr.x; F.py = pr.y;
    if (pr.k === 'egg') { // into its cheeks: switched off (nothing can crack it there), carried by frogCarry, never eaten
      const e = pr.e;
      e.hold = null; e.honey = 0; e.hc = 4;
      e.body.setLinearVelocity(Vec2(0, 0)); e.body.setAngularVelocity(0);
      e.body.setActive(false);
      F.eg = e.id; F.egT = 0; F.egHop = 0; F.gx = pr.x; F.gy = pr.y; F.snN++; F.pty = e.kind || 'egg';
      F.snCD = Math.max(F.snCD, M.snCD);
      this.emit('frogSnatch', { x: pr.x, y: pr.y, id: F.id, egg: e.id });
      return;
    }
    if (pr.k === 'orb') {
      F.pty = pr.o.type;
      F.belly = pr.o.type; F.bsrc = pr.o.src || ''; F.bellyT = 0; // 0.8.18: it glows in its belly, and a bop brings it back
      pr.o.alive = false;
      this.kill.push(pr.o.body);
    } else {
      const e = pr.e;
      F.pty = e.chickKind || 'peck';
      if (e.joint) this.unMagnet(e);
      e.alive = false; e.fled = 1; // out of play like a caught chick, never a broken egg
      this.kill.push(e.body);
    }
    this.emit('frogEat', { x: pr.x, y: pr.y, id: F.id, kind: pr.k, prey: F.pty }); // (0.8.18: was 'type', which overwrote the event's own type: the gulp never showed)
  },

  // ---------- fright: a flame on an egg, or a dash chick, close by
  frogThreat(F) {
    const chs = this.frogChs(F), cx = F.x + F.nx * 0.2, cy = F.y + F.ny * 0.2;
    for (const e of this.aliveEggs()) {
      const fire = e.fire > 0 && (e.fireKind === 'fire_red' || e.fireKind === 'fire_black'), dash = e.chick && e.chickKind === 'dash';
      if (!fire && !dash) continue;
      const p = e.body.getPosition();
      if (Math.hypot(p.x - cx, p.y - cy) < FROG.scareR && chs.includes(this.channelOf(e))) return { x: p.x, y: p.y, by: dash ? 'dash' : 'fire' };
    }
    return null;
  },
  frogScare(F, th) {
    F.scareCD = FROG.scareCD; F.sc = 1;
    F.lickCD = Math.max(F.lickCD, 2.5);
    const tx = F.ny, ty = -F.nx;
    F.face = (th.x - F.x) * tx + (th.y - F.y) * ty >= 0 ? -1 : 1; // facing away from it
    F.next = F.every * 0.8;
    this.emit('frogScare', { x: F.x, y: F.y, id: F.id, by: th.by });
    const plan = this.frogPick(F, true, th);
    if (!plan) { this.frogSet(F, 'crouch', 0.5); F.hk = ''; return; } // nowhere to go: it cowers
    this.frogPlan(F, plan, true);
    this.frogSet(F, 'crouch', 0.16); // no telegraph: it just goes
  },

  // ---------- hopping
  // candidate hops: through a gap of the floor ring (down, into the next channel out) or of the ring above (up);
  // `step` hops along the floor toward a gap when none is in reach. scared: away from the threat, and further.
  // 0.8.10 (mykee: "the frog tends to move upward only, it doesn't have a brain of its own"): where the frog wants to
  // be. The eggs run from the middle outward to the basket, so the frog goes for the egg that is closest to getting
  // home: its channel, and its angle. Returns null when no egg is loose (then it hops as it likes, as before).
  // 0.8.18 the decoy: a decoy (the power) anywhere in the vault, or a hatched chick near it, is what it hunts instead
  frogAim(F) {
    const D = this.p2Lure && this.p2Lure();
    if (D && D.body) { const p = D.body.getPosition(); return { x: p.x, y: p.y, ch: this.chAt(Math.hypot(p.x, p.y)), w: Math.atan2(p.y, p.x), lure: 1 }; }
    if (F) {
      let bd = FROG.decoyR, c = null;
      for (const e of this.aliveEggs()) {
        if (!e.chick || e.chickKind === 'dash' || !e.body) continue;
        const p = e.body.getPosition(), d = Math.hypot(p.x - F.x, p.y - F.y);
        if (d < bd) { bd = d; c = p; }
      }
      if (c) return { x: c.x, y: c.y, ch: this.chAt(Math.hypot(c.x, c.y)), w: Math.atan2(c.y, c.x), lure: 1 };
    }
    let best = null, bs = -1e9;
    for (const e of this.aliveEggs()) {
      const p = e.body.getPosition(), ch = this.channelOf(e);
      const sc = ch * 10 - Math.abs(wrap(Math.atan2(p.y, p.x) + Math.PI / 2)) ; // further out, and nearer the bottom, matters more
      if (sc > bs) { bs = sc; best = { x: p.x, y: p.y, ch, w: Math.atan2(p.y, p.x) }; }
    }
    // no egg loose (they are all home or gone): it waits where the eggs will come through, the lower outer channels,
    // instead of drifting into the middle of the vault
    if (!best) { const ch = Math.max(0, this.rings.length - 2); best = { x: 0, y: -1, ch, w: -Math.PI / 2, idle: 1 }; }
    return best;
  },
  frogPick(F, scared, th, only = '') { // only: 'up' = inward hops alone (0.8.18: off with an egg in its cheeks)
    if (F.side > 0) return null; // hops start from a floor in the lower half
    const n = this.rings.length, wf = F.wa, reach = scared ? FROG.scareReach : FROG.reach;
    const away = (w) => (th ? Math.abs(wrap(w - Math.atan2(th.y, th.x))) : 0);
    const aim = scared || only ? null : this.frogAim(F);
    const C = [];
    for (const hk of only ? [only] : ['down', 'up']) {
      const ri = hk === 'down' ? F.fi : F.fi - 1, ti = hk === 'down' ? F.fi + 1 : F.fi - 1;
      if (ri < 0 || ti < 0 || ti > n - 1) continue;
      const ring = this.rings[ri];
      ring.gaps.forEach((g, k) => {
        if (!this.frogGapOk(g)) return;
        const wg = ring.body.getAngle() + g.a;
        if (Math.sin(wg) > FROG.low || Math.abs(wrap(wg - wf)) * ring.r > reach) return;
        for (const side of [1, -1]) {
          const land = this.frogLandAt(F, hk, ri, ti, g, wg, side);
          if (!land) continue;
          let w = 1;
          if (aim) {
            // the channel it would land in, against the egg's: on it is best, one step toward it is good, away is poor
            const d0 = Math.abs(F.fi + (F.fi >= aim.ch ? 0 : 1) - aim.ch), d1 = Math.abs(ti - aim.ch);
            w = d1 === 0 ? 6 : d1 < d0 ? 3 : d1 === d0 ? 1 : 0.25;
            // and how near the egg it lands, going round (a frog beside the egg can plug the gap under it)
            const wl = this.rings[land.tpl >= 0 ? ti : ti].body.getAngle() + land.tla;
            w *= 1 + 2.2 * Math.max(0, 1 - Math.abs(wrap(wl - aim.w)) / 1.2);
            if (land.tpl >= 0 && d1 === 0) w *= 1.8; // landing IN a gap of the egg's channel: its signature move
          }
          C.push({ hk, hr: ri, hg: k, ti, ...land, w: scared ? 0.2 + away(wg + side * 0.1) : w });
        }
      });
    }
    if (C.length) {
      let tot = 0;
      for (const c of C) tot += c.w;
      let r = this.rand() * tot;
      for (const c of C) if ((r -= c.w) <= 0) return c;
      return C[C.length - 1];
    }
    return only ? null : this.frogStepPlan(F, scared, th);
  },
  // where it lands for a hop through gap g (world angle wg), on `side`; null when that spot is bad
  frogLandAt(F, hk, ri, ti, g, wg, side) {
    const T = this.rings[ti], off = hk === 'up' ? g.len / 2 + 0.5 + 0.5 * this.rand() : 0.4 + 0.8 * this.rand();
    const wl = wg + (side * off) / T.r;
    return this.frogLandSpot(F, T, ti, wl);
  },
  frogLandSpot(F, T, ti, wl, ts = -1) {
    if (ts < 0 ? Math.sin(wl) > -0.1 : Math.sin(wl) < 0.05) return null;
    let la = wrap(wl - T.body.getAngle()), tpl = -1, tr = T.r + ts * RING_TH / 2;
    T.gaps.forEach((g, k) => { if (tpl < 0 && Math.abs(wrap(la - g.a)) * T.r < g.len / 2 + 0.1) tpl = k; });
    if (tpl >= 0) { if (!this.frogGapOk(T.gaps[tpl])) return null; la = T.gaps[tpl].a; tr = T.r - ts * RING_TH / 2; }
    for (const th of T.thorns) if (th.alive && th.side === (ts < 0 ? 'in' : 'out') && Math.abs(wrap(la - th.a)) * T.r < 0.5) return null;
    for (const O of this.frogs) {
      if (O === F) continue;
      const wo = this.rings[O.ph === 'hop' ? O.ti : O.fi].body.getAngle() + (O.ph === 'hop' ? O.tla : O.la), oi = O.ph === 'hop' ? O.ti : O.fi;
      if (oi === ti && Math.abs(wrap(wo - wl)) * T.r < 1.25) return null;
    }
    return { tla: la, tr, tpl };
  },
  // no gap in reach: a hop along the floor toward the nearest usable gap (or away from the threat)
  frogStepPlan(F, scared, th) {
    const n = this.rings.length, wf = F.wa;
    let tw = null;
    if (scared && th) tw = wf + (wrap(wf - Math.atan2(th.y, th.x)) >= 0 ? 1 : -1) * (2.0 / this.rings[F.fi].r);
    else {
      // 0.8.10: toward the gap that leads to the egg it is after; without a loose egg, the nearest usable gap, as before
      const aim = this.frogAim(F);
      let bd = 1e9;
      for (const ri of [F.fi, F.fi - 1]) {
        if (ri < 0 || (ri === F.fi && F.fi > n - 2)) continue; // ring F.fi leads down only if there is a channel below it
        const ti = ri === F.fi ? F.fi + 1 : F.fi - 1;
        const ring = this.rings[ri];
        for (const g of ring.gaps) {
          const wg = ring.body.getAngle() + g.a, d = wrap(wg - wf);
          if (!this.frogGapOk(g) || Math.sin(wg) > FROG.low) continue;
          // the cost: how far round the gap is, plus a penalty for a gap that leads away from the egg
          const cost = Math.abs(d) * ring.r + (aim ? 3 * Math.max(0, Math.abs(ti - aim.ch) - Math.abs(F.fi - aim.ch)) : 0);
          if (cost < bd) { bd = cost; tw = wf + clamp(d, -1.4 / ring.r, 1.4 / ring.r); }
        }
      }
      // no gap at all to walk to: shuffle round toward the egg anyway, so it never looks stuck
      if (tw === null && aim) { const d = wrap(aim.w - wf); if (Math.abs(d) * this.rings[F.fi].r > 0.6) tw = wf + clamp(d, -1.4 / this.rings[F.fi].r, 1.4 / this.rings[F.fi].r); }
    }
    if (tw === null || Math.abs(wrap(tw - wf)) * this.rings[F.fi].r < 0.3) return null;
    const T = this.rings[F.fi], land = this.frogLandSpot(F, T, F.fi, tw);
    return land ? { hk: 'step', hr: F.fi, hg: 0, ti: F.fi, ...land } : null;
  },
  frogPlan(F, p, scared) {
    Object.assign(F, { hk: p.hk, hr: p.hr, hg: p.hg, ti: p.ti, tla: p.tla, tr: p.tr, tpl: p.tpl, ts: p.ts ?? -1, hh: scared ? FROG.scareHop : 1 });
    F.sri = F.fi; F.sla = F.la; F.sr = F.rf;
    const w0 = F.wa, w1 = this.rings[p.ti].body.getAngle() + p.tla;
    const arc = Math.abs(wrap(w1 - w0)) * this.rings[p.ti].r + (p.hk === 'step' ? 0 : 1.0);
    F.hd = clamp(0.46 + 0.1 * arc, 0.5, 0.9) * (scared ? 0.9 : 1);
    const dir = wrap(w1 - w0); // the way round: + is counter-clockwise, the frog's "forward" (face)
    if (Math.abs(dir) > 0.02) F.face = (dir > 0 ? 1 : -1) * -F.side; // forward along the surface: the tangent runs counter-clockwise on an inner face
  },
  frogLaunch(F) {
    // the gap may have turned away during the crouch: then it only wobbles and stays
    if (F.hk === '') { F.sc = 0; this.frogSet(F, 'sit'); return; } // it only cowered
    let ok = true;
    if (ok && F.hk !== 'step') {
      const ring = this.rings[F.hr], g = ring.gaps[F.hg], wg = ring.body.getAngle() + g.a;
      ok = this.frogGapOk(g) && Math.abs(wrap(wg - F.wa)) * ring.r < (F.hh > 1 ? FROG.scareReach : FROG.reach) + 0.6 && Math.sin(wg) < 0.1;
    }
    if (!ok) { F.sc = 0; F.next = 1.5; this.frogSet(F, 'sit'); this.emit('frogMiss', { x: F.x, y: F.y, id: F.id, early: 1, hop: 1 }); return; }
    this.frogPlan(F, { hk: F.hk, hr: F.hr, hg: F.hg, ti: F.ti, tla: F.tla, tr: F.tr, tpl: F.tpl }, F.hh > 1); // re-time: rings turned during the crouch
    this.frogSet(F, 'hop', F.hd);
    F.solid = 0; F.air = 1; F.u = 0; F.gi = -1; F.ss = F.side;
    const w1 = this.rings[F.ti].body.getAngle() + F.tla;
    this.emit('frogHop', { x: F.x, y: F.y, x2: this.rings[F.ti].r * Math.cos(w1), y2: this.rings[F.ti].r * Math.sin(w1), id: F.id, scared: F.hh > 1 ? 1 : 0 });
  },
  // its wall is a ceiling: let go and fall (somersaulting) to the other wall of the channel, same angle
  frogDrop(F) {
    const n = this.rings.length, inner = F.side < 0;
    let ti, ts, wl = F.wa;
    if (inner) { if (F.fi >= 1) { ti = F.fi - 1; ts = 1; } else { ti = 0; ts = -1; wl = -F.wa; } } else { ti = F.fi + 1; ts = -1; if (ti > n - 1) return; }
    const T = this.rings[ti];
    let land = null;
    for (const d of [0, 0.35, -0.35, 0.7, -0.7]) { land = this.frogLandSpot(F, T, ti, wl + d / T.r, ts); if (land) break; }
    if (!land) land = { tla: wrap(wl - T.body.getAngle()), tr: T.r + ts * RING_TH / 2, tpl: -1 };
    Object.assign(F, { hk: 'drop', hr: ti, hg: 0, ti, ts, tla: land.tla, tr: land.tr, tpl: land.tpl, hh: 1, hd: 0.55, sri: F.fi, sla: F.la, sr: F.rf, sc: 0 });
    F.ss = F.side;
    this.frogSet(F, 'hop', F.hd);
    F.solid = 0; F.air = 1; F.u = 0; F.gi = -1;
    this.emit('frogHop', { x: F.x, y: F.y, x2: land.tr * Math.cos(wl), y2: land.tr * Math.sin(wl), id: F.id, scared: 0, drop: 1 });
  },
  // the arc: a Hermite curve through knots in (angle, radius) about the vault's centre, so the frog threads the
  // gap's middle and the lift and the drop follow the rings round
  frogCurve(F, u) {
    const R = this.rings, S = R[F.sri], T = R[F.ti];
    const wS = S.body.getAngle() + F.sla, rS = F.sr, rT = F.tr;
    const H = 0.5 * F.hh, K = [{ t: 0, w: wS, r: rS }];
    if (F.hk === 'drop') {
      const wT = wS + wrap(T.body.getAngle() + F.tla - wS);
      K.push({ t: 0.55, w: wS + (wT - wS) * 0.45, r: rS + (rT - rS) * 0.22 }, { t: 1, w: wT, r: rT }); // gravity: slow, then faster
    } else if (F.hk === 'step') {
      const wT = wS + wrap(T.body.getAngle() + F.tla - wS);
      K.push({ t: 0.5, w: (wS + wT) / 2, r: Math.min(rS, rT) - H }, { t: 1, w: wT, r: rT });
    } else {
      const G = R[F.hr], wG = wS + wrap(G.body.getAngle() + G.gaps[F.hg].a - wS), rG = G.r;
      const wT = wG + wrap(T.body.getAngle() + F.tla - wG);
      if (F.hk === 'down') K.push({ t: 0.22, w: (wS + wG) / 2, r: Math.min(rS, rG) - H }, { t: 0.46, w: wG, r: rG }, { t: 1, w: wT, r: rT });
      else K.push({ t: 0.4, w: wG, r: rG }, { t: 0.72, w: (wG + wT) / 2, r: rT - 0.6 * H }, { t: 1, w: wT, r: rT });
    }
    u = clamp(u, 0, 1);
    const n = K.length;
    const m = (i, c) => { const a = K[Math.max(0, i - 1)], b = K[Math.min(n - 1, i + 1)]; return (b[c] - a[c]) / (b.t - a.t); };
    let i = 0;
    while (i < n - 2 && u > K[i + 1].t) i++;
    const A = K[i], B = K[i + 1], h = B.t - A.t, s = (u - A.t) / h, s2 = s * s, s3 = s2 * s;
    const herm = (c) => (2 * s3 - 3 * s2 + 1) * A[c] + (s3 - 2 * s2 + s) * h * m(i, c) + (-2 * s3 + 3 * s2) * B[c] + (s3 - s2) * h * m(i + 1, c);
    return { w: herm('w'), r: herm('r') };
  },
  frogFly(F) {
    const u = clamp(F.t / F.hd, 0, 1), c = this.frogCurve(F, u);
    F.u = u;
    F.wa = c.w;
    F.x = c.r * Math.cos(c.w); F.y = c.r * Math.sin(c.w);
    // the body points along its flight: the normal is "up" for the art, tilted toward the velocity by the renderer
    // upright: the normal is the start wall's, then (a drop) turns over by the end wall's: a somersault
    const a1 = F.ts * 1 > 0 ? c.w : c.w + Math.PI, a0 = F.ss > 0 ? c.w : c.w + Math.PI;
    let na = a0;
    if (F.hk === 'drop') { let d = wrap(a1 - a0); if (Math.abs(d) > 3) d = (F.face > 0 ? -1 : 1) * Math.PI * (F.ss > 0 ? -1 : 1); na = a0 + d * sstep((u - 0.1) / 0.8); }
    F.nx = Math.cos(na); F.ny = Math.sin(na);
    if (F.t >= F.hd) this.frogLand(F);
  },
  frogLand(F) {
    if (F.ts !== F.side) F.face = -F.face; // the tangent flips with the surface: keep it looking the same way on screen
    F.fi = F.ti; F.la = F.tla; F.rf = F.tr; F.gi = F.tpl; F.side = F.ts; F.shp = F.gi >= 0 ? 'table' : 'dome';
    F.air = 0; F.u = 0; F.hk = '';
    this.frogPlace(F);
    F.solid = this.frogEggNear(F) ? 0 : 1;
    F.next = F.every * (0.85 + 0.3 * this.rand()) * (FROG_MODE[this.mode] || FROG_MODE.medium).every;
    this.frogSet(F, 'land', FROG.land);
    this.emit('frogLand', { x: F.x, y: F.y, id: F.id, plug: F.gi >= 0 ? 1 : 0, scared: F.sc });
  },

  // ---------- creature states from the powers and the rooster. kind: ice (frozen T s), out (as ice), bolt (stunned T s),
  // crow (stunned T s), zap (0.3 s of arcs, then stunned T s). Others (pepper, scare, spin) do not touch a frog.
  // It never undoes what it is doing mid-air: the hop finishes, then it holds (the timers run meanwhile).
  frogHit(kind, T, one) {
    const ice = kind === 'ice' || kind === 'out', stun = kind === 'bolt' || kind === 'crow' || kind === 'zap';
    if (!ice && !stun) return 0;
    for (const F of one ? [one] : this.frogs || []) {
      if (ice) { F.frz = F.frzMax = Math.max(F.frz, T); F.stn = 0; F.zapT = 0; } // ice beats a dizzy
      else if (!(F.frz > 0)) { F.stn = F.stnMax = Math.max(F.stn, T); if (kind === 'zap') F.zapT = 0.3; }
      F.next = Math.max(F.next, 1); F.sc = 0;
      this.emit('frogState', { x: F.x, y: F.y, id: F.id, kind: ice ? 'ice' : 'stun' });
    }
    return one ? 1 : (this.frogs || []).length;
  },

  // ---------- state
  frogState() { return (this.frogs || []).map((F) => ({ ...F })); },
  frogLoad(S) {
    if (!S) return;
    this.frogs = S.map((F) => ({ ...F }));
    this.frogs.forEach((F, i) => {
      if (!this.frogBody[i]) return;
      if (F.ph === 'hop') this.frogFly(F); else this.frogPlace(F);
      this.frogShape(i);
      this.frogTeleport(i);
      const e = F.eg >= 0 ? this.eggs.find((q) => q.id === F.eg) : null; // 0.8.18: the egg in its cheeks stays switched off
      if (e && e.body) e.body.setActive(false);
    });
  },
};
