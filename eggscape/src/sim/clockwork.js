// The clockwork cast of world 10, the Shape Lab (v4): the CLOCKWORK SPIDER, the WIND-UP BEETLE and the SPRING JACK.
// Mixed into Sim (sim.js: Object.assign(Sim.prototype, cwMethods)), so `this` is the Sim. No imports from sim.js. Every field
// is plain data in this.cw, copied by cwState() / restored by cwLoad(), so rewind and the planner stay exact. No randomness.
// Bodies and fixtures are derived (built in cwInit, placed again in cwLoad). Everything is shape-aware (sim/shapes.js).
//
// level.spider = { ring, delay, every, a } (or an array): it lives ON ring `ring` (default 1), on its outer face, and only webs
//   the gaps of that ring (it never changes rings). It never jumps: it CRAWLS along the ring (it rides the ring, so the gaps
//   keep still under it) at SPIDER.crawl rad/s of ring, the short way round, to the open gap nearest an egg on that floor.
//   Telegraph: it walks there with hot eyes, then spins the web strand by strand for SPIDER.spin s; the gap stays open for
//   the first SPIDER.open s of that. If its target closes (a curtain, another web) it picks again from where it stands.
//   It waits by its web until the web is gone, rests SPIDER.rest s, then picks the next gap.
//   Upside: a web is a soft net. It catches an egg and holds it (no crack, whatever the fall), and the ring carries it round.
//   Downside: a webbed gap is shut until the web is torn or gives way (WEB.life s). A flaming egg, an iron egg or a Laser
//   Beak shot tears it at once. Spin Storm flings the spider off its ring; frost and thunder stop it where it stands.
// level.beetle = { ch, a } (or an array): a wind-up tin beetle on the floor of channel ch (the inner face of ring ch),
//   a = start angle (deg, ring-local). It rides its ring. It starts UNWOUND (asleep: a wall). Turning ITS ring winds it:
//   every 30 degrees of turn adds BEETLE.per s of run (up to BEETLE.max s). It marches the way the ring was last turned
//   (turned the other way by BEETLE.flip rad, it turns round), pushes eggs ahead of it and crushes floor thorns in its way.
//   It never falls through: at a gap edge it treads on the spot until it runs down. Asleep again, it is a wall.
//   Upside: it clears thorns, and a pushed egg drops through a gap. Downside: aimed badly it shoves an egg off a gap edge or
//   into the next hazard, and asleep it blocks the floor. Spin Storm tips it on its back (unwound); frost and thunder stop it.
// level.jack = [{ ch, a }]: a jack-in-the-box set into the floor of channel ch at ring-local angle a (deg). It rides its ring.
//   An egg rolling over the lid makes it pop: the egg is bounced back up off the floor (toward the vault centre) and along
//   the way it was rolling. Then it winds itself back (JACK.reload s).
//   Upside: timed right (turn the ring so the jack is just short of a gap) it launches an egg across the gap or up through
//   the ring above. Downside: it bounces eggs back the way they came. A heavy egg (iron, stone, ostrich) jams it shut for
//   JACK.jam s: then it is just floor.
import { Vec2, Polygon } from 'planck';
import { RING_TH, wrap, clamp } from './geom.js';
import { ringPt, ringSpd, ringNormal, segQuad, rockAt } from './shapes.js';

const m3 = (easy, medium, hard) => ({ easy, medium, hard });
export const SPIDER = {
  every: m3(10, 7, 6), // (old cadence, kept for the level field) s
  crawl: Math.PI / 3, // rad of ring per s: half a ring in about 3 s
  spin: 1.0, open: 0.6, // s spinning the web; s of that the gap is still open
  rest: m3(3, 1.2, 0.8), // s it rests after its web is gone, before it picks the next gap
  stand: 0.3, // m from the gap edge to its body while it spins
  flung: 6, // s away after a spin storm
};
export const WEB = { life: m3(6, 9, 11), sag: 0.6 }; // s a web holds; s its last sag (it droops and lets go)
export const BEETLE = {
  len: 1.25, h: 0.58, // m, body (render/clockwork.js draws it to this): about two eggs long, too tall to roll over
  speed: m3(0.38, 0.55, 0.66), // m/s along the floor
  per: 1.5, max: 6, // s of run per 30 degrees of ring turn, s at most
  go: 0.6, // s of wind before a sleeping beetle sets off
  flip: 0.14, // rad of turning the other way that turns it round
  tip: 3.5, // s on its back after a spin storm
};
const WIND_RATE = BEETLE.per / (Math.PI / 6); // s of run per rad of ring turn
export const JACK = {
  w: 0.86, // m, lid (render/clockwork.js draws it to this)
  reach: 0.5, // m from the lid an egg sets it off
  pop: m3(3.6, 4.6, 5.0), // m/s up off the floor
  push: m3(1.2, 1.6, 1.8), // m/s along the way the egg was rolling
  reload: m3(2.4, 2.0, 1.8), // s
  jam: m3(16, 12, 10), // s a heavy egg keeps it shut
  out: 0.45, // s the jack stays out after a pop
};
const CAT_CW = 256, MASK_CW = 2; // bodies that touch eggs only (sim.js CAT.FROG: the egg mask has it)
const WEB_FILT = { filterCategoryBits: 1, filterMaskBits: 2 }; // the web catches eggs only
const STOPPED = new Set(['stop', 'tip']);
const listOf = (v) => (!v ? [] : Array.isArray(v) ? v : [v]);
const DT = 1 / 120;

export const cwMethods = {
  // ---------- build (end of Sim.build)
  cwInit(L) {
    const M = this.mode in SPIDER.every ? this.mode : 'medium', n = this.rings.length;
    this.cwMode = M;
    this.cw = { sp: [], webs: [], bt: [], jk: [], wake: 0 };
    this.cwBody = [];
    if (n < 1) return;
    listOf(L.spider).forEach((o, i) => {
      const ri = clamp(o.ring ?? 1, 0, n - 1);
      // it starts on top of its ring (or at a, deg ring-local), facing the way round it will most likely go
      const la = o.a != null ? wrap((o.a * Math.PI) / 180) : wrap(Math.PI / 2 - this.rings[ri].body.getAngle());
      this.cw.sp.push({ id: i, ri, la, tla: la, dir: 1, ph: 'wait', t: o.delay ?? 4, dur: 1, gi: -1, k: 0, stun: 0, ice: 0, every: o.every || 0, done: 0 });
    });
    // a web can form on any plain gap of a spider's ring: its fixtures are built now and switched by cwPass
    const rings = new Set(this.cw.sp.map((S) => S.ri));
    for (const ri of rings) {
      const ring = this.rings[ri];
      ring.gaps.forEach((g, gi) => {
        if (g.grate) return;
        this.cw.webs.push({ ri, gi, k: 0, life: 0, max: 0, sp: -1, sv: 1 });
        const wi = this.cw.webs.length - 1, half = g.len / (2 * ringSpd(ring, g.a)), m = Math.max(2, Math.ceil(g.len / 0.2));
        for (let q = 0; q < m; q++) {
          const b0 = g.a - half + (2 * half * q) / m, b1 = g.a - half + (2 * half * (q + 1)) / m;
          ring.body.createFixture({ shape: new Polygon(segQuad(ring, b0, b1).map(([x, y]) => Vec2(x, y))), friction: 1, restitution: 0, ...WEB_FILT, userData: { kind: 'web', wi } });
        }
      });
    }
    listOf(L.beetle).forEach((o, i) => {
      const fi = clamp(o.ch ?? 1, 0, n - 1), ring = this.rings[fi];
      // it starts unwound (asleep): turning its ring winds it (ka: its key's turn, for the art; st: s in this phase)
      const B = { id: i, fi, la: wrap(((o.a ?? -60) * Math.PI) / 180), dir: o.dir === -1 ? -1 : 1, ph: 'sleep', t: 0, wind: 0, acc: 0, stun: 0, ice: 0, la0: ring.body.getAngle(), ka: 0, tk: 0, st: 9, stall: 0 };
      this.cw.bt.push(B);
      const body = this.world.createBody({ type: 'kinematic', position: Vec2(0, 0) });
      const hl = BEETLE.len / 2, h = BEETLE.h;
      body.createFixture({ shape: new Polygon([Vec2(-hl * 0.8, 0), Vec2(hl * 0.8, 0), Vec2(hl, h * 0.3), Vec2(hl, h * 0.55), Vec2(hl * 0.6, h), Vec2(-hl * 0.7, h), Vec2(-hl, h * 0.5), Vec2(-hl, h * 0.3)]), friction: 0.6, restitution: 0.05, filterCategoryBits: CAT_CW, filterMaskBits: MASK_CW, userData: { kind: 'beetle', idx: i } });
      this.cwBody.push(body);
      this.cwTeleport(i);
    });
    for (const o of listOf(L.jack)) {
      const fi = clamp(o.ch ?? 1, 0, n - 1);
      this.cw.jk.push({ id: this.cw.jk.length, fi, la: wrap(((o.a ?? -90) * Math.PI) / 180), ph: 'ready', t: 0, ice: 0, stun: 0 });
    }
  },
  cwAny() { const C = this.cw; return !!C && (C.sp.length || C.bt.length || C.jk.length); },

  // ---------- geometry (world space)
  // point on the floor of ring fi (its inner face) at ring-local angle la, h m up off it; up = the floor's inward normal
  cwFloor(fi, la, h = 0) {
    const ring = this.rings[fi], A = ring.body.getAngle(), [lx, ly] = ringPt(ring, la, ring.r - RING_TH / 2 - h), c = Math.cos(A), s = Math.sin(A);
    const up = ringNormal(ring, la) + A + Math.PI;
    return { x: lx * c - ly * s, y: lx * s + ly * c, up, ux: Math.cos(up), uy: Math.sin(up) };
  },
  // a point on the OUTER face of ring ri at ring-local angle la, h m out from it; up = the face's outward normal
  cwOut(ri, la, h = 0) {
    const ring = this.rings[ri], A = ring.body.getAngle(), [lx, ly] = ringPt(ring, la, ring.r + RING_TH / 2 + h), c = Math.cos(A), s = Math.sin(A);
    const up = ringNormal(ring, la) + A;
    return { x: lx * c - ly * s, y: lx * s + ly * c, up, ux: Math.cos(up), uy: Math.sin(up) };
  },
  // where a spider is: on the outer face of its ring at S.la (fx, fy: its feet; x, y: its body), and its target gap (gx, gy)
  cwSpider(S) {
    const ring = this.rings[S.ri], g = ring.gaps[S.gi], f = this.cwOut(S.ri, S.la, 0), b = this.cwOut(S.ri, S.la, 0.2);
    const end = g ? this.cwFloor(S.ri, g.a, 0) : f;
    return { x: b.x, y: b.y, fx: f.x, fy: f.y, up: f.up, ax: f.x, ay: f.y, wa: ring.body.getAngle() + (g ? g.a : S.la), gx: end.x, gy: end.y, gu: end.up };
  },
  cwBeetlePose(B) {
    const q = this.cwFloor(B.fi, B.la, 0);
    return { x: q.x, y: q.y, a: q.up - Math.PI / 2, ux: q.ux, uy: q.uy };
  },
  cwTeleport(i) {
    const B = this.cw.bt[i], b = this.cwBody[i], q = this.cwBeetlePose(B);
    b.setTransform(Vec2(q.x, q.y), q.a);
    b.setLinearVelocity(Vec2(0, 0));
    b.setAngularVelocity(0);
  },

  // ---------- contacts (sim.js preSolve): true = no contact
  cwPass(ua, ub) {
    const w = ua.kind === 'web' ? ua : ub.kind === 'web' ? ub : null;
    if (!w) return false;
    const W = this.cw.webs[w.wi], eu = ua.kind === 'egg' ? ua : ub.kind === 'egg' ? ub : null;
    if (!W || W.k < 1 || !eu) return true;
    const egg = eu.egg;
    if (!egg || !egg.alive || egg.saved) return true;
    if (egg.fire > 0 || egg.iron) { const why = egg.fire > 0 ? 'fire' : 'iron'; this.defer(() => this.cwTear(W, why)); return true; }
    // a net: the landing never cracks, and the fall is over
    egg.soft = true; egg.freefall = 0; egg.safeT = Math.max(egg.safeT || 0, 0.12);
    if (!W.held) { W.held = 1; const p = egg.body.getPosition(); this.emit('webCatch', { x: p.x, y: p.y }); }
    return false;
  },
  cwTear(W, why) {
    if (!(W.k > 0)) return;
    W.k = 0; W.life = 0; W.held = 0;
    const ring = this.rings[W.ri], g = ring.gaps[W.gi], q = this.cwFloor(W.ri, g.a, 0);
    this.emit('webTear', { x: q.x, y: q.y, why });
  },

  // ---------- every step (sim.js step, after the frog)
  cwStep(dt) {
    if (!this.cwAny()) return;
    const C = this.cw, M = this.cwMode, live = this.state === 'play';
    // webs: torn by the laser, sag and let go when their time is up
    const beams = this.p2 ? this.p2.beams.filter((B) => B.t <= DT * 1.5) : [];
    for (const W of C.webs) {
      if (!(W.k > 0)) continue;
      const ring = this.rings[W.ri], g = ring.gaps[W.gi], wa = ring.body.getAngle() + g.a, half = g.len / (2 * ringSpd(ring, g.a));
      if (beams.some((B) => Math.abs(wrap(B.a - wa)) < half + 0.06)) { this.cwTear(W, 'laser'); continue; }
      if (W.k >= 1 && (W.life -= dt) <= 0) { W.k = 0; W.held = 0; const q = this.cwFloor(W.ri, g.a, 0); this.emit('webGone', { x: q.x, y: q.y }); }
    }
    for (const S of C.sp) this.cwSpiderStep(S, dt, M, live);
    C.bt.forEach((B, i) => this.cwBeetleStep(B, i, dt, M, live));
    for (const J of C.jk) this.cwJackStep(J, dt, M, live);
  },

  cwSpiderStep(S, dt, M, live) {
    if (S.ice > 0) { S.ice -= dt; return; }
    if (S.stun > 0) { S.stun -= dt; return; }
    if (!live && S.ph !== 'spin') return;
    S.t -= dt;
    const ring = this.rings[S.ri];
    switch (S.ph) {
      case 'wait': case 'rest': case 'flung':
        if (S.t > 0 || !live) return;
        if (this.cwSpiderGo(S)) { const q = this.cwSpider(S); this.emit('spiderWalk', { x: q.gx, y: q.gy, ring: S.ri }); }
        return;
      case 'walk': {
        // its gap closed or got webbed: pick again from where it stands (no jump)
        let W = this.cwWeb(S.ri, S.gi), g = ring.gaps[S.gi];
        if (!W || W.k > 0 || !g || (g.curtain && g.curtain.alive)) {
          if (!this.cwSpiderGo(S)) return;
          W = this.cwWeb(S.ri, S.gi); g = ring.gaps[S.gi];
        }
        const rem = wrap(S.tla - S.la), step = (SPIDER.crawl * ring.r * dt) / ringSpd(ring, S.la);
        if (Math.abs(rem) > step) { S.dir = rem > 0 ? 1 : -1; S.la = wrap(S.la + S.dir * step); return; }
        S.la = S.tla; S.dir = wrap(g.a - S.la) > 0 ? 1 : -1; // it faces the gap
        S.ph = 'spin'; S.t = S.dur = SPIDER.spin; S.done = 0; W.sp = S.id; W.sv = 0; W.k = 0.01; // (a tear sets k back to 0)
        { const q = this.cwSpider(S); this.emit('spiderSpin', { x: q.gx, y: q.gy, ring: S.ri }); }
        return;
      }
      case 'spin': {
        const W = this.cwWeb(S.ri, S.gi), g = ring.gaps[S.gi], u = clamp(1 - S.t / S.dur, 0, 1);
        // torn while it works, or a curtain shut the gap: it gives up and rests
        if (!W || !g || (g.curtain && g.curtain.alive) || !(W.k > 0)) { if (W && W.k < 1) W.k = 0; if (W) W.sv = 1; S.ph = 'rest'; S.t = SPIDER.rest[M]; return; }
        W.sv = u;
        if (!S.done) {
          // the gap stays open for the first SPIDER.open s of the spin, then the web holds
          if (u * S.dur >= SPIDER.open) { S.done = 1; W.k = 1; W.life = W.max = WEB.life[M]; W.held = 0; const q = this.cwSpider(S); this.emit('webUp', { x: q.gx, y: q.gy, ring: S.ri }); }
          else W.k = clamp((u * S.dur) / SPIDER.open, 0.01, 0.999);
        }
        if (S.t > 0) return;
        W.sv = 1; S.ph = 'guard';
        return;
      }
      case 'guard': {
        // it waits by its web; when the web is gone it rests, then picks the next gap
        const W = this.cwWeb(S.ri, S.gi);
        if (!W || !(W.k > 0)) { S.ph = 'rest'; S.t = SPIDER.rest[M]; }
        return;
      }
    }
  },
  // pick a gap and set off for its near edge, the short way round; false (and a short wait) when there is none
  cwSpiderGo(S) {
    const gi = this.cwPickGap(S);
    if (gi < 0) { S.ph = 'wait'; S.t = 1; return false; }
    const ring = this.rings[S.ri], g = ring.gaps[gi], sp = ringSpd(ring, g.a), off = g.len / (2 * sp) + SPIDER.stand / sp;
    const d = wrap(g.a - S.la);
    S.gi = gi; S.tla = wrap(g.a + (d >= 0 ? -off : off)); S.ph = 'walk'; S.done = 0;
    S.dir = wrap(S.tla - S.la) >= 0 ? 1 : -1;
    return true;
  },
  cwWeb(ri, gi) { return this.cw.webs.find((W) => W.ri === ri && W.gi === gi) || null; },
  // the open gap of its ring nearest an egg on that floor (ahead of the egg's way down), else the lowest one
  cwPickGap(S) {
    const ring = this.rings[S.ri], A = ring.body.getAngle(), eggs = this.aliveEggs().filter((e) => this.channelOf(e) === S.ri && !e.thf);
    let best = -1, bd = 1e9;
    ring.gaps.forEach((g, gi) => {
      const W = this.cwWeb(S.ri, gi);
      if (!W || W.k > 0 || (g.curtain && g.curtain.alive) || g.grate) return;
      const wa = A + g.a;
      let d = eggs.length ? Math.min(...eggs.map((e) => { const p = e.body.getPosition(); return Math.abs(wrap(Math.atan2(p.y, p.x) - wa)); })) : Math.abs(wrap(wa + Math.PI / 2)) + 3;
      d += gi * 1e-3;
      if (d < bd) { bd = d; best = gi; }
    });
    return best;
  },

  cwBeetleStep(B, i, dt, M, live) {
    const ring = this.rings[B.fi], A = ring.body.getAngle();
    // the ring turned under it (the rocking vault's lean is not a turn): that winds its key
    let d = wrap(A - B.la0);
    B.la0 = A;
    if (this.rock) { const r1 = rockAt(this.rock, this.t), r0 = rockAt(this.rock, this.t - dt); d -= r1.a - r0.a; }
    B.st += dt;
    if (B.ice > 0) B.ice -= dt;
    else if (B.stun > 0) B.stun -= dt;
    else if (live && B.ph === 'tip') { if ((B.t -= dt) <= 0) { B.ph = 'sleep'; B.st = 0; B.acc = 0; B.wind = 0; } }
    else if (live) {
      const ad = Math.abs(d);
      if (ad > 1e-7) {
        const s = d > 0 ? 1 : -1;
        if (s === B.dir || B.wind <= 0) { B.dir = s; B.acc = 0; B.wind = Math.min(BEETLE.max, B.wind + ad * WIND_RATE); B.ka += ad * 3; }
        else if ((B.acc += ad) >= BEETLE.flip) { B.dir = s; B.wind = Math.min(BEETLE.max, B.wind + B.acc * WIND_RATE); B.ka += B.acc * 3; B.acc = 0; B.stall = 0; if (B.ph === 'walk') this.emit('beetleTurn', { ...this.cwXY(B) }); }
      }
      if (B.ph === 'sleep' && B.wind >= BEETLE.go) { B.ph = 'walk'; B.st = 0; B.tk = 0; B.stall = 0; this.emit('beetleWind', { ...this.cwXY(B) }); }
      if (B.ph === 'walk') {
        B.wind -= dt; B.ka -= dt * (1.2 + (3 * B.wind) / BEETLE.max);
        if (B.wind <= 0) { B.wind = 0; B.ph = 'sleep'; B.st = 0; B.stall = 0; B.acc = 0; this.emit('beetleStop', { ...this.cwXY(B) }); }
        else {
          // the key ticks: quick on a full spring, slower as it runs down
          if ((B.tk -= dt) <= 0) { B.tk = 0.14 + 0.34 * (1 - B.wind / BEETLE.max); this.emit('beetleTick', { ...this.cwXY(B), f: B.wind / BEETLE.max }); }
          const sp = ringSpd(ring, B.la), na = wrap(B.la + (B.dir * BEETLE.speed[M] * dt) / sp);
          this.cwCrush(B, ring, na);
          if (this.cwBlocked(B, ring, na)) { if (!B.stall) { B.stall = 1; this.emit('beetleBump', { ...this.cwXY(B) }); } }
          else { B.stall = 0; B.la = na; }
        }
      }
    }
    // the body follows its pose by velocity, so eggs get a proper shove
    const b = this.cwBody[i], q = this.cwBeetlePose(B), p = b.getPosition();
    b.setLinearVelocity(Vec2((q.x - p.x) / dt, (q.y - p.y) / dt));
    b.setAngularVelocity(wrap(q.a - b.getAngle()) / dt);
  },
  // the nose would reach a gap edge (an egg needs room ahead of it: half an egg + a bit): it never walks off
  cwBlocked(B, ring, la) {
    const sp = ringSpd(ring, la), nose = la + (B.dir * (BEETLE.len / 2 + 0.06)) / sp;
    for (const g of ring.gaps) { const half = g.len / (2 * ringSpd(ring, g.a)); if (Math.abs(wrap(nose - g.a)) < half + 0.02) return true; }
    return false;
  },
  // its plough crushes the floor thorns in its way
  cwCrush(B, ring, la) {
    const sp = ringSpd(ring, la), nose = la + (B.dir * (BEETLE.len / 2 + 0.06)) / sp;
    for (const th of ring.thorns) {
      if (!th.alive || th.side === 'out' || Math.abs(wrap(nose - th.a)) * sp > 0.15) continue;
      this.removeThorn(th, 'snap');
      const q = this.cwXY(B); this.emit('beetleCrush', { x: q.x, y: q.y });
    }
  },
  cwXY(B) { const q = this.cwBeetlePose(B); return { x: q.x, y: q.y }; },

  cwJackStep(J, dt, M, live) {
    if (J.ice > 0) { J.ice -= dt; return; }
    if (J.stun > 0) { J.stun -= dt; return; }
    J.t -= dt;
    if (J.ph === 'out' && J.t <= 0) { J.ph = 'reload'; J.t = JACK.reload[M] - JACK.out; return; }
    if ((J.ph === 'reload' || J.ph === 'jam') && J.t <= 0) { if (J.ph === 'jam') this.emit('jackFree', { ...this.cwFloor(J.fi, J.la, 0) }); J.ph = 'ready'; return; }
    if (J.ph !== 'ready' || !live) return;
    const q = this.cwFloor(J.fi, J.la, 0.1);
    for (const e of this.aliveEggs()) {
      if (e.thf || this.channelOf(e) !== J.fi) continue;
      const p = e.body.getPosition();
      if (Math.hypot(p.x - q.x, p.y - q.y) > JACK.reach + 0.2) continue;
      if (e.iron || e.stone > 0 || e.kind === 'ostrich') { J.ph = 'jam'; J.t = JACK.jam[M]; this.emit('jackJam', { x: q.x, y: q.y }); return; }
      // pop: up off the floor and on the way it was rolling (away from the lid when it sat still)
      const v = e.body.getLinearVelocity(), tx = -q.uy, ty = q.ux, along = v.x * tx + v.y * ty;
      const s = Math.abs(along) > 0.15 ? Math.sign(along) : Math.sign((p.x - q.x) * tx + (p.y - q.y) * ty) || 1;
      const up = JACK.pop[M], pu = JACK.push[M] * s;
      e.body.setLinearVelocity(Vec2(q.ux * up + tx * pu, q.uy * up + ty * pu));
      e.freefall = 0;
      J.ph = 'out'; J.t = JACK.out;
      this.emit('jackPop', { x: q.x, y: q.y, egg: e });
      return;
    }
  },

  // ---------- powers (sim/powers2.js p2All): ice = frozen T s, bolt = stunned T s, spin = flung (spider) / tipped (beetle)
  cwP2(kind, T) {
    if (!this.cwAny()) return 0;
    let n = 0;
    const mark = (key, k, x, y, t) => { if (this.p2Mark) this.p2Mark(key, k, t, x, y); };
    for (const S of this.cw.sp) {
      if (S.ph === 'flung') continue;
      const q = this.cwSpider(S);
      if (!q) continue;
      n++;
      if (kind === 'ice') { S.ice = Math.max(S.ice, T); mark('cs' + S.id, 'ice', q.x, q.y, T); }
      else if (kind === 'bolt' || kind === 'zap') { S.stun = Math.max(S.stun, T); mark('cs' + S.id, 'zap', q.x, q.y, Math.min(1.2, T)); }
      else if ((kind === 'spin' || kind === 'out') && S.ph !== 'wait') {
        const W = this.cwWeb(S.ri, S.gi);
        if (W && W.k < 1 && S.ph === 'spin') { W.k = 0; W.sv = 1; }
        S.ph = 'flung'; S.t = SPIDER.flung; S.stun = 0;
        this.emit('spiderFlung', { x: q.x, y: q.y });
      }
    }
    for (const B of this.cw.bt) {
      const q = this.cwXY(B);
      n++;
      if (kind === 'ice') { B.ice = Math.max(B.ice, T); mark('cb' + B.id, 'ice', q.x, q.y, T); }
      else if (kind === 'bolt' || kind === 'zap') { B.stun = Math.max(B.stun, T); mark('cb' + B.id, 'zap', q.x, q.y, Math.min(1.2, T)); }
      else if (kind === 'spin' || kind === 'out') { B.ph = 'tip'; B.t = BEETLE.tip; B.wind = 0; B.stall = 0; B.st = 0; this.emit('beetleTip', q); }
    }
    for (const J of this.cw.jk) {
      const q = this.cwFloor(J.fi, J.la, 0);
      if (kind === 'ice') { J.ice = Math.max(J.ice, T); mark('cj' + J.id, 'ice', q.x, q.y, T); n++; }
      else if (kind === 'bolt') { J.stun = Math.max(J.stun, T); n++; }
    }
    return n;
  },
  // the Clockwork Owl's last phase brings the cast in
  cwWake() {
    for (const S of this.cw.sp) if (S.ph === 'wait' && S.t > 1.5) S.t = 1.5;
  },

  // ---------- state (planner / rewind)
  cwState() {
    const C = this.cw;
    if (!C) return null;
    return { sp: C.sp.map((S) => ({ ...S })), webs: C.webs.map((W) => ({ ...W })), bt: C.bt.map((B) => ({ ...B })), jk: C.jk.map((J) => ({ ...J })), wake: C.wake };
  },
  cwLoad(S) {
    if (!S || !this.cw) return;
    this.cw = { sp: S.sp.map((x) => ({ ...x })), webs: S.webs.map((x) => ({ ...x })), bt: S.bt.map((x) => ({ ...x })), jk: S.jk.map((x) => ({ ...x })), wake: S.wake };
    this.cw.bt.forEach((_, i) => this.cwBody[i] && this.cwTeleport(i));
  },
};
