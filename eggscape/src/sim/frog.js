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
import { Vec2, Polygon } from 'planck';
import { RING_TH, wrap, clamp } from './geom.js';

export const FROG = {
  w: 0.84, // m, body width (a gap is 0.78 wide: a frog in it fills it)
  every: 6, hopWarn: 0.7, land: 0.3, // s between hops (Medium), crouch + puff telegraph, landing squash
  reach: 2.4, scareReach: 3.6, // m of arc to the gap it hops through
  tongue: 1.5, lickWarn: 0.5, tongueT: 0.4, gulpT: 0.65, lickCD: 4, // m, s
  scareR: 1.7, scareCD: 4, scareHop: 1.5, // m, s, height factor of the escape hop
  grab: 0.35, // fraction of the tongue phase at which it reaches its prey
  low: -0.3, // a gap must sit below this sin(angle) (the lower part of the vault) to be hopped through
};
// per mode: every = hop gap x, lick = lick gap x, tongue = tongue length (m), warn = telegraph x
export const FROG_MODE = {
  easy: { every: 1.4, lick: 1.6, tongue: 1.1, warn: 1.3 },
  medium: { every: 1, lick: 1, tongue: 1.5, warn: 1 },
  hard: { every: 0.8, lick: 0.8, tongue: 1.6, warn: 0.85 },
};
const CAT_FROG = 256, MASK_FROG = 2; // collides with eggs only (CAT.EGG = 2, and sim.js adds this category to the egg mask)
// polygons in the frog's frame (x along the surface, y out of it, feet at y = 0): a dome when sitting on a floor,
// a flat table across the opening when sitting in a gap (its top is 0.03 m above the ring's inner face)
const SHAPE = {
  dome: [[-0.42, 0], [-0.43, 0.08], [-0.33, 0.24], [-0.12, 0.33], [0.12, 0.33], [0.33, 0.24], [0.43, 0.08], [0.42, 0]],
  table: [[-0.42, 0], [-0.42, 0.12], [-0.37, 0.19], [0.37, 0.19], [0.42, 0.12], [0.42, 0]],
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
        x: 0, y: 0, nx: 0, ny: 1, vx: 0, vy: 0, air: 0, u: 0, bump: 0, bumpCD: 0,
        hk: '', hr: 0, hg: 0, sri: 0, sla: 0, sr: 0, ti: 0, tla: 0, tr: 0, tpl: -1, hd: 0.6, hh: 1,
        lk: '', lx: 0, ly: 0, lid: 0, lty: '', hit: 0, got: 0, pk: '', pty: '', px: 0, py: 0,
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
    F.rf = ring.r - RING_TH / 2;
    ring.gaps.forEach((g, k) => {
      if (F.gi < 0 && this.frogGapOk(g) && Math.abs(wrap(F.la - g.a)) * ring.r < g.len / 2 + 0.1) { F.gi = k; F.la = g.a; F.rf = ring.r + RING_TH / 2; }
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
    F.nx = -Math.cos(a); F.ny = -Math.sin(a);
  },
  frogMouth(F) { // in front of the head, 0.22 m up the normal
    const tx = F.ny * F.face, ty = -F.nx * F.face;
    return { x: F.x + F.nx * 0.22 + tx * 0.36, y: F.y + F.ny * 0.22 + ty * 0.36 };
  },
  frogChs(F) { return F.gi >= 0 ? [F.fi, F.fi + 1] : [F.fi]; },

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
  },

  // ---------- every step
  frogStep(dt) {
    if (!this.frogs || !this.frogs.length) return;
    const play = this.state === 'play';
    this.frogs.forEach((F, i) => {
      for (const k of ['lickCD', 'scareCD', 'bumpCD']) if (F[k] > 0) F[k] = Math.max(0, F[k] - dt);
      F.bump = Math.max(0, F.bump - dt * 3);
      const x0 = F.x, y0 = F.y;
      F.t += dt;
      this.frogOne(F, dt, play);
      F.vx = (F.x - x0) / dt; F.vy = (F.y - y0) / dt;
      if (!F.solid && F.ph !== 'hop' && !this.frogEggNear(F)) F.solid = 1; // it landed on an egg: solid once the egg moves
      this.frogShape(i);
      this.frogDrive(i, dt);
    });
  },
  frogSet(F, ph, dur = 0) { F.ph = ph; F.t = 0; F.dur = dur; },
  frogEggNear(F) {
    const cx = F.x + F.nx * 0.2, cy = F.y + F.ny * 0.2;
    for (const e of this.aliveEggs()) { const p = e.body.getPosition(); if (Math.hypot(p.x - cx, p.y - cy) < 0.55) return true; }
    return false;
  },

  frogOne(F, dt, play) {
    const M = FROG_MODE[this.mode] || FROG_MODE.medium;
    if (F.ph === 'hop') { this.frogFly(F); return; }
    this.frogPlace(F);
    if (!play) return;
    const idle = F.ph === 'sit' || F.ph === 'land' || F.ph === 'crouch' || F.ph === 'lick';
    if (idle && F.scareCD <= 0) {
      const th = this.frogThreat(F);
      if (th) { this.frogScare(F, th); return; }
    }
    switch (F.ph) {
      case 'sit': {
        if (F.lickCD <= 0) { const pr = this.frogPrey(F, M); if (pr) { this.frogLick(F, pr, M); return; } }
        if ((F.next -= dt) > 0) return;
        const plan = this.frogPick(F, false, null);
        if (plan) { this.frogPlan(F, plan, false); this.frogSet(F, 'crouch', FROG.hopWarn * M.warn); this.emit('frogCrouch', { x: F.x, y: F.y, id: F.id }); } else F.next = 1.5;
        break;
      }
      case 'crouch': if (F.t >= F.dur) this.frogLaunch(F); break;
      case 'land': if (F.t >= FROG.land) { F.sc = 0; this.frogSet(F, 'sit'); } break;
      case 'lick': {
        if (F.t < F.dur) { const pr = this.frogFind(F, M); if (!pr) { this.emit('frogMiss', { x: F.lx, y: F.ly, id: F.id, early: 1 }); this.frogSet(F, 'sit'); } break; }
        const pr = this.frogFind(F, M);
        F.hit = pr ? 1 : 0; F.got = 0;
        if (pr) { F.lx = pr.x; F.ly = pr.y; }
        this.frogSet(F, 'tongue', FROG.tongueT);
        this.emit('frogTongue', { x: F.x, y: F.y, tx: F.lx, ty: F.ly, id: F.id, hit: F.hit });
        break;
      }
      case 'tongue': {
        if (F.hit && !F.got && F.t >= FROG.tongueT * FROG.grab) this.frogGrab(F, M);
        if (F.t >= FROG.tongueT) {
          if (F.got) { this.frogSet(F, 'gulp', FROG.gulpT); this.emit('frogGulp', { x: F.x, y: F.y, id: F.id }); } else { this.emit('frogMiss', { x: F.lx, y: F.ly, id: F.id }); this.frogSet(F, 'sit'); }
        }
        break;
      }
      case 'gulp': if (F.t >= F.dur) this.frogSet(F, 'sit'); break;
    }
  },

  // ---------- licking
  // the nearest orb or hatched chick in reach (same channel(s), within the tongue's length of the mouth)
  frogPrey(F, M) {
    const m = this.frogMouth(F), chs = this.frogChs(F), R = M.tongue;
    let best = null, bd = R;
    for (const o of this.orbs) {
      if (!o.alive || !chs.includes(o.ch)) continue;
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
    this.frogSet(F, 'lick', FROG.lickWarn * M.warn);
    this.emit('frogLick', { x: F.x, y: F.y, tx: pr.x, ty: pr.y, id: F.id, kind: pr.k });
  },
  frogGrab(F, M) {
    const pr = this.frogFind(F, M);
    F.got = 1;
    if (!pr) { F.hit = 0; F.got = 0; return; }
    F.pk = pr.k; F.px = pr.x; F.py = pr.y;
    if (pr.k === 'orb') {
      F.pty = pr.o.type;
      pr.o.alive = false;
      this.kill.push(pr.o.body);
    } else {
      const e = pr.e;
      F.pty = e.chickKind || 'peck';
      if (e.joint) this.unMagnet(e);
      e.alive = false; e.fled = 1; // out of play like a caught chick, never a broken egg
      this.kill.push(e.body);
    }
    this.emit('frogEat', { x: pr.x, y: pr.y, id: F.id, kind: pr.k, type: F.pty });
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
  frogPick(F, scared, th) {
    const n = this.rings.length, wf = F.wa, reach = scared ? FROG.scareReach : FROG.reach;
    const away = (w) => (th ? Math.abs(wrap(w - Math.atan2(th.y, th.x))) : 0);
    const C = [];
    for (const hk of ['down', 'up']) {
      const ri = hk === 'down' ? F.fi : F.fi - 1, ti = hk === 'down' ? F.fi + 1 : F.fi - 1;
      if (ri < 0 || ti < 0 || ti > n - 1) continue;
      const ring = this.rings[ri];
      ring.gaps.forEach((g, k) => {
        if (!this.frogGapOk(g)) return;
        const wg = ring.body.getAngle() + g.a;
        if (Math.sin(wg) > FROG.low || Math.abs(wrap(wg - wf)) * ring.r > reach) return;
        for (const side of [1, -1]) {
          const land = this.frogLandAt(F, hk, ri, ti, g, wg, side);
          if (land) C.push({ hk, hr: ri, hg: k, ti, ...land, w: scared ? 0.2 + away(wg + side * 0.1) : 1 });
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
    return this.frogStepPlan(F, scared, th);
  },
  // where it lands for a hop through gap g (world angle wg), on `side`; null when that spot is bad
  frogLandAt(F, hk, ri, ti, g, wg, side) {
    const T = this.rings[ti], off = hk === 'up' ? g.len / 2 + 0.38 + 0.5 * this.rand() : 0.35 + 0.8 * this.rand();
    const wl = wg + (side * off) / T.r;
    return this.frogLandSpot(F, T, ti, wl);
  },
  frogLandSpot(F, T, ti, wl) {
    if (Math.sin(wl) > -0.1) return null;
    let la = wrap(wl - T.body.getAngle()), tpl = -1, tr = T.r - RING_TH / 2;
    T.gaps.forEach((g, k) => { if (tpl < 0 && Math.abs(wrap(la - g.a)) * T.r < g.len / 2 + 0.1) tpl = k; });
    if (tpl >= 0) { if (!this.frogGapOk(T.gaps[tpl])) return null; la = T.gaps[tpl].a; tr = T.r + RING_TH / 2; }
    for (const th of T.thorns) if (th.alive && th.side === 'in' && Math.abs(wrap(la - th.a)) * T.r < 0.35) return null;
    for (const O of this.frogs) {
      if (O === F) continue;
      const wo = this.rings[O.ph === 'hop' ? O.ti : O.fi].body.getAngle() + (O.ph === 'hop' ? O.tla : O.la), oi = O.ph === 'hop' ? O.ti : O.fi;
      if (oi === ti && Math.abs(wrap(wo - wl)) * T.r < 0.95) return null;
    }
    return { tla: la, tr, tpl };
  },
  // no gap in reach: a hop along the floor toward the nearest usable gap (or away from the threat)
  frogStepPlan(F, scared, th) {
    const n = this.rings.length, wf = F.wa;
    let tw = null;
    if (scared && th) tw = wf + (wrap(wf - Math.atan2(th.y, th.x)) >= 0 ? 1 : -1) * (2.0 / this.rings[F.fi].r);
    else {
      let bd = 1e9;
      for (const ri of [F.fi, F.fi - 1]) {
        if (ri < 0 || (ri === F.fi && F.fi > n - 2)) continue; // ring F.fi leads down only if there is a channel below it
        const ring = this.rings[ri];
        for (const g of ring.gaps) {
          const wg = ring.body.getAngle() + g.a, d = wrap(wg - wf);
          if (this.frogGapOk(g) && Math.sin(wg) <= FROG.low && Math.abs(d) * ring.r < bd) { bd = Math.abs(d) * ring.r; tw = wf + clamp(d, -1.4 / ring.r, 1.4 / ring.r); }
        }
      }
    }
    if (tw === null || Math.abs(wrap(tw - wf)) * this.rings[F.fi].r < 0.3) return null;
    const T = this.rings[F.fi], land = this.frogLandSpot(F, T, F.fi, tw);
    return land ? { hk: 'step', hr: F.fi, hg: 0, ti: F.fi, ...land } : null;
  },
  frogPlan(F, p, scared) {
    Object.assign(F, { hk: p.hk, hr: p.hr, hg: p.hg, ti: p.ti, tla: p.tla, tr: p.tr, tpl: p.tpl, hh: scared ? FROG.scareHop : 1 });
    F.sri = F.fi; F.sla = F.la; F.sr = F.rf;
    const w0 = F.wa, w1 = this.rings[p.ti].body.getAngle() + p.tla;
    const arc = Math.abs(wrap(w1 - w0)) * this.rings[p.ti].r + (p.hk === 'step' ? 0 : 1.0);
    F.hd = clamp(0.46 + 0.1 * arc, 0.5, 0.9) * (scared ? 0.9 : 1);
    const dir = wrap(w1 - w0); // the way round: + is counter-clockwise, the frog's "forward" (face)
    if (Math.abs(dir) > 0.02) F.face = dir > 0 ? 1 : -1;
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
    F.solid = 0; F.air = 1; F.u = 0; F.gi = -1;
    const w1 = this.rings[F.ti].body.getAngle() + F.tla;
    this.emit('frogHop', { x: F.x, y: F.y, x2: this.rings[F.ti].r * Math.cos(w1), y2: this.rings[F.ti].r * Math.sin(w1), id: F.id, scared: F.hh > 1 ? 1 : 0 });
  },
  // the arc: a Hermite curve through knots in (angle, radius) about the vault's centre, so the frog threads the
  // gap's middle and the lift and the drop follow the rings round
  frogCurve(F, u) {
    const R = this.rings, S = R[F.sri], T = R[F.ti];
    const wS = S.body.getAngle() + F.sla, rS = F.sr, rT = F.tr;
    const H = 0.5 * F.hh, K = [{ t: 0, w: wS, r: rS }];
    if (F.hk === 'step') {
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
    F.nx = -Math.cos(c.w); F.ny = -Math.sin(c.w);
    if (F.t >= F.hd) this.frogLand(F);
  },
  frogLand(F) {
    F.fi = F.ti; F.la = F.tla; F.rf = F.tr; F.gi = F.tpl; F.shp = F.gi >= 0 ? 'table' : 'dome';
    F.air = 0; F.u = 0; F.hk = '';
    this.frogPlace(F);
    F.solid = this.frogEggNear(F) ? 0 : 1;
    F.next = F.every * (0.85 + 0.3 * this.rand()) * (FROG_MODE[this.mode] || FROG_MODE.medium).every;
    this.frogSet(F, 'land', FROG.land);
    this.emit('frogLand', { x: F.x, y: F.y, id: F.id, plug: F.gi >= 0 ? 1 : 0, scared: F.sc });
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
    });
  },
};
