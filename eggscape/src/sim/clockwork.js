// The clockwork cast of world 10, the Shape Lab (v4): the CLOCKWORK SPIDER, the WIND-UP BEETLE and the SPRING JACK.
// Mixed into Sim (sim.js: Object.assign(Sim.prototype, cwMethods)), so `this` is the Sim. No imports from sim.js. Every field
// is plain data in this.cw, copied by cwState() / restored by cwLoad(), so rewind and the planner stay exact. No randomness.
// Bodies and fixtures are derived (built in cwInit, placed again in cwLoad). Everything is shape-aware (sim/shapes.js).
//
// level.spider = { ring, delay, every } (or an array): it webs the gaps of ring `ring` (default 1), hanging in the channel
//   inside that ring on a thread from the ring below it (the hub for ring 0). Every `every` s (Medium) it picks the open gap
//   nearest an egg on that floor, winds down to it on its thread (the telegraph) and spins a web across it.
//   Upside: a web is a soft net. It catches an egg and holds it (no crack, whatever the fall), and the ring carries it round.
//   Downside: a webbed gap is shut until the web is torn or gives way (WEB.life s). A flaming egg, an iron egg or a Laser
//   Beak shot tears it at once. Spin Storm flings the spider off its thread; frost and thunder stop it.
// level.beetle = { ch, a, delay, dir } (or an array): a tin beetle on the floor of channel ch (the inner face of ring ch),
//   a = start angle (deg, ring-local). Wound up, it bulldozes along the floor (it rides the ring) and pushes eggs ahead of
//   it; it turns round at a gap edge or a thorn cluster. When its key runs down it stops: turning its ring about
//   BEETLE.rewind rad winds it up again (a click, then it sets off).
//   Upside: a stopped beetle is a wall that keeps eggs from rolling into thorns, and a pushed egg drops through a gap.
//   Downside: walking, it shoves eggs where you did not want them (into thorns, away from a gap). Spin Storm tips it on its
//   back; frost and thunder stop it.
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
  every: m3(10, 7, 6), // s between webs
  down: m3(2.2, 1.6, 1.25), // s winding down (the telegraph)
  spin: 0.9, up: 1.2, // s spinning the web, s climbing back
  flung: 6, // s away after a spin storm
};
export const WEB = { life: m3(6, 9, 11), sag: 0.6 }; // s a web holds; s its last sag (it droops and lets go)
export const BEETLE = {
  len: 1.25, h: 0.58, // m, body (render/clockwork.js draws it to this): about two eggs long, too tall to roll over
  speed: m3(0.38, 0.55, 0.66), // m/s along the floor
  wind: m3(4.5, 6, 6.5), // s of walking on a full wind
  rewind: m3(1.0, 1.2, 1.3), // rad of ring turning that winds it again
  click: 0.7, tip: 3.5, // s of key whirr before it sets off, s on its back after a spin storm
};
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
      this.cw.sp.push({ id: i, ri, ph: 'wait', t: o.delay ?? 4, dur: 1, gi: -1, k: 0, stun: 0, ice: 0, every: o.every || 0 });
    });
    // a web can form on any plain gap of a spider's ring: its fixtures are built now and switched by cwPass
    const rings = new Set(this.cw.sp.map((S) => S.ri));
    for (const ri of rings) {
      const ring = this.rings[ri];
      ring.gaps.forEach((g, gi) => {
        if (g.grate) return;
        this.cw.webs.push({ ri, gi, k: 0, life: 0, max: 0, sp: -1 });
        const wi = this.cw.webs.length - 1, half = g.len / (2 * ringSpd(ring, g.a)), m = Math.max(2, Math.ceil(g.len / 0.2));
        for (let q = 0; q < m; q++) {
          const b0 = g.a - half + (2 * half * q) / m, b1 = g.a - half + (2 * half * (q + 1)) / m;
          ring.body.createFixture({ shape: new Polygon(segQuad(ring, b0, b1).map(([x, y]) => Vec2(x, y))), friction: 1, restitution: 0, ...WEB_FILT, userData: { kind: 'web', wi } });
        }
      });
    }
    listOf(L.beetle).forEach((o, i) => {
      const fi = clamp(o.ch ?? 1, 0, n - 1), ring = this.rings[fi];
      const B = { id: i, fi, la: wrap(((o.a ?? -60) * Math.PI) / 180), dir: o.dir === -1 ? -1 : 1, ph: 'wait', t: o.delay ?? 3, wind: 0, acc: 0, stun: 0, ice: 0, la0: ring.body.getAngle() };
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
  // where a spider is: its thread's anchor (on the ring below, or the hub) and its body (u: 0 up at the anchor .. 1 at the gap)
  cwSpider(S) {
    const ring = this.rings[S.ri], g = ring.gaps[S.gi] || ring.gaps[0];
    if (!g) return null;
    const A = ring.body.getAngle(), wa = A + g.a, end = this.cwFloor(S.ri, g.a, -0.0);
    let ax = 0.18 * Math.cos(wa), ay = 0.18 * Math.sin(wa);
    if (S.ri > 0) { const ib = this.rings[S.ri - 1], la = wa - ib.body.getAngle(), [lx, ly] = ringPt(ib, la, ib.r + RING_TH / 2), B = ib.body.getAngle(); ax = lx * Math.cos(B) - ly * Math.sin(B); ay = lx * Math.sin(B) + ly * Math.cos(B); }
    const u = S.ph === 'down' ? clamp(1 - S.t / S.dur, 0, 1) : S.ph === 'spin' ? 1 : S.ph === 'up' ? clamp(S.t / S.dur, 0, 1) : 0;
    const stop = 0.6; // the body hangs this far short of the gap
    const ex = end.x + end.ux * stop, ey = end.y + end.uy * stop, e2 = u * u * (3 - 2 * u);
    return { ax, ay, x: ax + (ex - ax) * e2, y: ay + (ey - ay) * e2, u, wa, gx: end.x, gy: end.y, gu: end.up };
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
      case 'wait': case 'flung':
        if (S.t > 0) return;
        if (!live) return;
        S.gi = this.cwPickGap(S);
        if (S.gi < 0) { S.t = 1; S.ph = 'wait'; return; }
        S.ph = 'down'; S.t = S.dur = SPIDER.down[M];
        { const q = this.cwSpider(S); this.emit('spiderDown', { x: q.gx, y: q.gy, ring: S.ri }); }
        return;
      case 'down': {
        const W = this.cwWeb(S.ri, S.gi), g = ring.gaps[S.gi];
        if (!W || (g.curtain && g.curtain.alive)) { S.ph = 'up'; S.t = S.dur = SPIDER.up; return; }
        if (S.t > 0) return;
        S.ph = 'spin'; S.t = S.dur = SPIDER.spin; W.sp = S.id;
        return;
      }
      case 'spin': {
        const W = this.cwWeb(S.ri, S.gi);
        if (W) W.k = Math.max(W.k, clamp(1 - S.t / S.dur, 0, 0.999));
        if (S.t > 0) return;
        if (W) { W.k = 1; W.life = W.max = WEB.life[M]; W.held = 0; const q = this.cwSpider(S); this.emit('webUp', { x: q.gx, y: q.gy, ring: S.ri }); }
        S.ph = 'up'; S.t = S.dur = SPIDER.up;
        return;
      }
      case 'up':
        if (S.t > 0) return;
        S.ph = 'wait'; S.t = S.every || SPIDER.every[M];
        return;
    }
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
    // the ring turned under it (the rocking vault's lean is not a turn): a stopped beetle winds up again
    let d = wrap(A - B.la0);
    B.la0 = A;
    if (this.rock) { const r1 = rockAt(this.rock, this.t), r0 = rockAt(this.rock, this.t - dt); d -= r1.a - r0.a; }
    if (B.ice > 0) B.ice -= dt;
    else if (B.stun > 0) B.stun -= dt;
    else if (live) {
      B.t -= dt;
      switch (B.ph) {
        case 'wait': if (B.t <= 0) { B.ph = 'click'; B.t = BEETLE.click; this.emit('beetleWind', { ...this.cwXY(B) }); } break;
        case 'click': if (B.t <= 0) { B.ph = 'walk'; B.wind = BEETLE.wind[M]; } break;
        case 'tip': if (B.t <= 0) { B.ph = 'stop'; B.acc = 0; } break;
        case 'stop':
          B.acc += Math.abs(d);
          if (B.acc >= BEETLE.rewind[M]) { B.ph = 'click'; B.t = BEETLE.click; B.acc = 0; B.dir = d > 0 ? -1 : 1; this.emit('beetleWind', { ...this.cwXY(B) }); }
          break;
        case 'walk': {
          if ((B.wind -= dt) <= 0) { B.ph = 'stop'; B.acc = 0; this.emit('beetleStop', { ...this.cwXY(B) }); break; }
          const sp = ringSpd(ring, B.la), step = (BEETLE.speed[M] * dt) / sp;
          if (this.cwBlocked(B, ring, B.la + B.dir * step)) { B.dir = -B.dir; this.emit('beetleTurn', { ...this.cwXY(B) }); break; }
          B.la = wrap(B.la + B.dir * step);
          break;
        }
      }
    }
    // the body follows its pose by velocity, so eggs get a proper shove
    const b = this.cwBody[i], q = this.cwBeetlePose(B), p = b.getPosition();
    b.setLinearVelocity(Vec2((q.x - p.x) / dt, (q.y - p.y) / dt));
    b.setAngularVelocity(wrap(q.a - b.getAngle()) / dt);
  },
  // the nose would reach a gap edge or a floor thorn cluster (an egg needs room ahead of it: half an egg + a bit)
  cwBlocked(B, ring, la) {
    const sp = ringSpd(ring, la), nose = la + (B.dir * (BEETLE.len / 2 + 0.06)) / sp;
    for (const g of ring.gaps) { const half = g.len / (2 * ringSpd(ring, g.a)); if (Math.abs(wrap(nose - g.a)) < half + 0.02) return true; }
    for (const th of ring.thorns) if (th.alive && th.side !== 'out' && Math.abs(wrap(nose - th.a)) * sp < 0.12) return true;
    return false;
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
        if (W && W.k < 1) W.k = 0;
        S.ph = 'flung'; S.t = SPIDER.flung; S.stun = 0;
        this.emit('spiderFlung', { x: q.x, y: q.y });
      }
    }
    for (const B of this.cw.bt) {
      const q = this.cwXY(B);
      n++;
      if (kind === 'ice') { B.ice = Math.max(B.ice, T); mark('cb' + B.id, 'ice', q.x, q.y, T); }
      else if (kind === 'bolt' || kind === 'zap') { B.stun = Math.max(B.stun, T); mark('cb' + B.id, 'zap', q.x, q.y, Math.min(1.2, T)); }
      else if (kind === 'spin' || kind === 'out') { B.ph = 'tip'; B.t = BEETLE.tip; B.wind = 0; this.emit('beetleTip', q); }
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
    for (const B of this.cw.bt) if (B.ph === 'wait' && B.t > 1.5) B.t = 1.5;
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
