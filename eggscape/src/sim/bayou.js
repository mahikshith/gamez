// Gator Bayou creatures (v3.7): the ALLIGATOR, the MOSQUITO SWARM, the SNAPPING TURTLE and the boss GRANDPA GATOR.
// Mixed into Sim (sim.js: Object.assign(Sim.prototype, bayouMethods)), so `this` is the Sim. No imports from sim.js. All state
// is plain data in this.gators / this.turtles / this.mosqs (and egg.clamp), copied by bayouState() / restored by bayouLoad(),
// so rewind and the planner stay exact. No randomness. Physics bodies are derived, never stored.
//
// level.gator    = { ch, a, delay, face, size, call } or an array. It lies on the floor of channel ch (default the outermost)
//                  at world angle a (deg, -90 = bottom) and keeps to the lower part of the vault; the floor ring slides under
//                  it. call: hidden until a boss phase with `summon` calls it in (Grandpa Gator's babies).
//   Asleep it is a log: a solid back that eggs roll over, so it bridges a floor gap (UPSIDE). Awake it creeps along the
//   floor under the leading egg. When an egg comes over a gap of the ring above its head (or along its own channel to its
//   snout) it opens its jaws at that gap (the telegraph), then snaps: an egg in its jaws gets cracked and spat back
//   (DOWNSIDE). Turn the gap away and it snaps on nothing. Pepper Puff makes it sneeze and flee; the laser scares it; a
//   stone egg in its jaws hurts its teeth; it snaps a decoy (wood!) and reels.
// level.turtle   = { ch, a, delay, face } or an array. A snapping turtle crawls the floor of channel ch toward the nearest
//                  egg, pulls its head back (telegraph) and clamps the egg in its beak. A clamped egg is SAFE from
//                  everything (no crack, no thief, no thorn) but stuck (DOWNSIDE), and its shell blocks the gap it sits on.
//                  An egg dropped onto its shell, a stone or iron egg, a quake or a spin flips it onto its back and frees
//                  the egg. Pepper only makes it pull into its shell. Easy: it lets go sooner.
// level.mosquito = { ch, a, delay } or an array. A swarm hovers round its home in channel ch at angle a, then flies at the
//                  nearest egg, latches on (telegraph) and slowly lifts it up against gravity for a few seconds (DOWNSIDE:
//                  eggs float back the way they came; UPSIDE: it lifts an egg off a floor of thorns or up to a high orb).
//                  A burning egg, the pepper smoke, Pepper Puff, the laser or a thunderclap scatter it. Stone eggs are too
//                  heavy. A decoy is lifted first.
// level.bossFight = { kind: 'gator', hp, a, delay, phases: [{ attacks: ['sweep' | 'roll'], every, summon }] }: GRANDPA GATOR
//   is a huge gator in the outermost channel (snaps like the others). Tail sweep: every ring jolts and eggs bounce. Death
//   roll: he bites in and spins the ring under your leading egg. After each attack he lies DIZZY (the hit window): drop an
//   egg on him, or hit him with pepper or the laser beak, and he loses a tooth (hp). With no teeth left he swims off.
import { Vec2, Polygon } from 'planck';
import { RING_TH, wrap, clamp } from './geom.js';
import { ringLocked } from './boss.js';

const m3 = (easy, medium, hard) => ({ easy, medium, hard });
const deg = (d) => (d * Math.PI) / 180;
export const GATOR = {
  L: 1.7, h: 0.36, // m long, back height (size 1)
  speed: m3(0.13, 0.2, 0.26), flee: 0.9, // m/s creeping / sneezing away
  wake: 3.4, // m of arc: it stalks eggs this close
  jawR: 0.95, snapR: 0.64, // m from the jaw point: the telegraph starts / the snap catches
  warn: m3(1.3, 0.9, 0.72), snap: 0.28, after: 1.0, next: m3(3.2, 2.2, 1.7),
  crack: m3(1, 2, 2), fling: 3.0,
  span: 1.05, // rad either side of the bottom it keeps to
};
export const BOSSG = { s: 1.95, hp: 3, dizzy: m3(4.5, 3.2, 2.6), dizzySweep: m3(3.2, 2.3, 1.9), roll: m3(Math.PI / 3, Math.PI / 2, 1.9), sweep: m3(0.04, 0.07, 0.09), hitV: 0.8 };
export const TURTLE = {
  L: 1.35, h: 0.38, speed: m3(0.1, 0.14, 0.18), wake: 4, reach: 0.6, grab: 0.58,
  warn: m3(0.95, 0.6, 0.5), hold: m3(5, 7, 9), flip: m3(8, 6, 5), right: 0.7, next: m3(4, 3, 2.5), drop: 1.5, shell: 2.5,
};
export const MOSQ = {
  hunt: 3.2, speed: m3(0.65, 0.95, 1.15), latch: m3(1.0, 0.7, 0.55), lift: m3(2.2, 3, 3.4), rest: m3(8, 6, 5),
  up: 1.32, hover: 0.72, settle: 0.7, scatter: 4, back: 0.6, first: 2, rise: 1.0, // rise: the most it lifts an egg (m)
};
const CAT_BY = 512, MASK_BY = 2 | 64; // eggs and the decoy only (sim.js adds this category to the egg mask)

export const bayouMethods = {
  // ---------- build
  bayouInit(L) {
    const list = (x) => (!x ? [] : Array.isArray(x) ? x : [x]);
    const n = this.rings.length, F = L.bossFight, M = this.mode;
    this.gators = []; this.turtles = []; this.mosqs = []; this.gBody = []; this.tBody = [];
    const gl = list(L.gator).map((P) => ({ ...P }));
    if (F && F.kind === 'gator') gl.unshift({ ch: n - 1, a: F.a ?? -70, boss: 1, delay: F.delay ?? 3 });
    gl.forEach((P, i) => {
      const s = P.boss ? BOSSG.s : P.size || (P.call ? 0.72 : 1), ch = clamp(P.ch ?? n - 1, 1, n - 1);
      const G = {
        id: i, boss: P.boss ? 1 : 0, s, ch, a: 0, face: P.face === -1 ? -1 : 1, ph: P.call ? 'hid' : 'log', t: 0, dur: 0,
        next: P.delay ?? 2, eid: 0, frz: 0, frzMax: 0, stn: 0, stnMax: 0, zap: 0, dz: 0, dzMax: 0, hp: P.boss ? F.hp || BOSSG.hp : 0, hpMax: P.boss ? F.hp || BOSSG.hp : 0,
        hitCD: 0, roll: 0, flinch: 0, bump: 0, call: P.call ? 1 : 0, sneeze: 0, x: 0, y: 0,
      };
      G.a = this.byKeep(deg(P.a ?? -90), ch, this.gLen(G));
      this.gators.push(G);
      const b = this.world.createBody({ type: 'kinematic', position: Vec2(0, -60) });
      b.createFixture({ shape: new Polygon(this.byPoly(G.ch, this.gLen(G), Math.min(G.boss ? 0.55 : 0.42, GATOR.h * Math.sqrt(G.s) * (G.boss ? 1.1 : 1)), 0.55).map((p) => Vec2(p[0], p[1]))), friction: 0.6, restitution: 0.05, filterCategoryBits: CAT_BY, filterMaskBits: MASK_BY, userData: { kind: 'bayou', w: 'g', idx: i } });
      this.gBody.push(b);
      this.byTeleport(b, G);
    });
    list(L.turtle).forEach((P, i) => {
      const ch = clamp(P.ch ?? n - 1, 0, n - 1);
      const T = { id: i, ch, a: this.byKeep(deg(P.a ?? -90), ch, TURTLE.L), face: P.face === -1 ? -1 : 1, ph: 'crawl', t: 0, dur: 0, next: P.delay ?? 2, eid: 0, hold: 0, frz: 0, frzMax: 0, stn: 0, stnMax: 0, zap: 0, x: 0, y: 0 };
      this.turtles.push(T);
      const b = this.world.createBody({ type: 'kinematic', position: Vec2(0, -60) });
      b.createFixture({ shape: new Polygon(this.byPoly(ch, TURTLE.L, TURTLE.h, 0.8).map((p) => Vec2(p[0], p[1]))), friction: 0.7, restitution: 0.1, filterCategoryBits: CAT_BY, filterMaskBits: MASK_BY, userData: { kind: 'bayou', w: 't', idx: i } });
      this.tBody.push(b);
      this.byTeleport(b, T);
    });
    list(L.mosquito).forEach((P, i) => {
      const ch = clamp(P.ch ?? 1, 0, n - 1), a = deg(P.a ?? -60), r = this.byMid(ch);
      const hx = r * Math.cos(a), hy = r * Math.sin(a);
      this.mosqs.push({ id: i, ch, ly: 0, x: hx, y: hy, hx, hy, ph: 'roam', t: 0, dur: 0, next: P.delay ?? MOSQ.first, eid: 0, frz: 0, frzMax: 0, stn: 0, stnMax: 0, zap: 0, vx: 0, vy: 0 });
    });
    this.byM = M;
  },

  // ---------- geometry
  gLen(G) { return GATOR.L * G.s; },
  byFloor(ch) { return this.rings[ch].r - RING_TH / 2; },
  byMid(ch) { return ch <= 0 ? Math.min(0.5, this.rings[0].r * 0.5) : (this.rings[ch - 1].r + this.rings[ch].r) / 2; },
  // keep a body of length len (m) centred at angle a inside the lower part of channel ch
  byKeep(a, ch, len) {
    const rf = this.byFloor(ch), half = len / 2 / rf, span = Math.max(0.05, GATOR.span - half);
    let off = clamp(wrap(a + Math.PI / 2), -span, span);
    // the outer channel: a body stays clear of the nest's drop window (it lurks to one side, it never sits on the way in)
    if (ch === this.rings.length - 1) { const lo = Math.min(span, half + ((this.nestW || 2.6) / 2 + 0.25) / rf); if (Math.abs(off) < lo) off = (off < 0 ? -1 : 1) * lo; }
    return -Math.PI / 2 + off;
  },
  // the collider in the creature's frame (x along the floor, y up into the channel): the bottom follows the floor's curve
  byPoly(ch, len, h, nose) {
    const rf = this.byFloor(ch), sag = (d) => (d * d) / (2 * rf), H = len / 2;
    return [[-H, sag(H) + 0.015], [-H * 0.4, sag(H * 0.4)], [H * 0.4, sag(H * 0.4)], [H, sag(H) + 0.015], [H, sag(H) + h * nose], [H * 0.45, sag(H * 0.45) + h], [-H * 0.45, sag(H * 0.45) + h], [-H, sag(H) + h * 0.45]];
  },
  // feet point (floor, middle of the body) and the frame: n = up into the channel, tx = along the floor (counter-clockwise)
  byFrame(C, rad) {
    const rf = rad ?? this.byFloor(C.ch), c = Math.cos(C.a), s = Math.sin(C.a);
    return { x: rf * c, y: rf * s, nx: -c, ny: -s, tx: -s, ty: c, rf };
  },
  byPose(C) { const F = this.byFrame(C); return { x: F.x, y: F.y, ang: C.a + Math.PI / 2 }; },
  byTeleport(b, C) {
    if (C.ph === 'hid' || C.ph === 'gone') { b.setTransform(Vec2(0, -60 - C.id * 3), 0); b.setLinearVelocity(Vec2(0, 0)); b.setAngularVelocity(0); return; }
    const P = this.byPose(C);
    b.setTransform(Vec2(P.x, P.y), P.ang);
    b.setLinearVelocity(Vec2(0, 0)); b.setAngularVelocity(0);
  },
  byDrive(b, C, dt) {
    if (C.ph === 'hid' || C.ph === 'gone') { this.byTeleport(b, C); return; }
    const P = this.byPose(C), p = b.getPosition();
    if (Math.hypot(P.x - p.x, P.y - p.y) > 1) { this.byTeleport(b, C); return; }
    b.setLinearVelocity(Vec2((P.x - p.x) / dt, (P.y - p.y) / dt));
    b.setAngularVelocity(wrap(P.ang - b.getAngle()) / dt);
  },
  // the gator's jaw point: over its snout, up in the channel (where it snaps)
  gJaw(G) {
    const F = this.byFrame(G), f = G.face * this.gLen(G) * 0.45, up = 0.36 * Math.min(1.3, Math.sqrt(G.s));
    return { x: F.x + F.tx * f + F.nx * up, y: F.y + F.ty * f + F.ny * up };
  },
  tMouth(T) {
    const F = this.byFrame(T), f = T.face * TURTLE.L * 0.62;
    return { x: F.x + F.tx * f + F.nx * 0.22, y: F.y + F.ty * f + F.ny * 0.22 };
  },
  byFree(e) { return e && e.alive && !e.saved && e.body && !e.chick && !(e.clamp > 0) && !e.thf && !e.octo; },
  byAng(p) { return Math.atan2(p.y, p.x); },
  // can the gator's jaws reach this egg? In its own channel, or one channel in, right over an open gap of the ring between
  gReach(G, e) {
    const c = this.channelOf(e);
    if (c === G.ch) return true;
    if (c !== G.ch - 1) return false;
    const ring = this.rings[G.ch - 1], p = e.body.getPosition(), la = Math.atan2(p.y, p.x) - ring.body.getAngle();
    return ring.gaps.some((g) => this.gapOpenFor(g, e) && (g.o ?? 1) > 0.5 && Math.abs(wrap(la - g.a)) * ring.r < g.len / 2 + 0.14);
  },

  // ---------- every step (before the world steps)
  bayouStep(dt) {
    if (!this.gators) return;
    const play = this.state === 'play';
    this.gators.forEach((G, i) => { this.gOne(G, dt, play); this.byDrive(this.gBody[i], G, dt); const F = this.byFrame(G); G.x = F.x; G.y = F.y; });
    this.turtles.forEach((T, i) => { this.tOne(T, dt, play); this.byDrive(this.tBody[i], T, dt); const F = this.byFrame(T); T.x = F.x; T.y = F.y; });
    for (const Q of this.mosqs) this.qOne(Q, dt, play);
  },
  byTimers(C, dt) {
    if (C.zap > 0) C.zap = Math.max(0, C.zap - dt); else if (C.stn > 0) C.stn = Math.max(0, C.stn - dt);
    if (C.frz > 0) C.frz = Math.max(0, C.frz - dt);
    if (C.next > 0) C.next -= dt;
    C.t += dt;
    return C.frz > 0 || C.stn > 0 || C.zap > 0;
  },
  bySet(C, ph, dur = 0) { C.ph = ph; C.t = 0; C.dur = dur; },
  byMv(C, dir, v, dt, len) { C.a = this.byKeep(C.a + (dir * v * dt) / this.byFloor(C.ch), C.ch, len); },
  // the egg nearest along the floor (arc m) in the given channels, in the lower part of the vault
  byNear(C, chs, far) {
    let best = null, bd = far;
    const rf = this.byFloor(C.ch);
    for (const e of this.aliveEggs()) {
      if (!this.byFree(e) || !chs.includes(this.channelOf(e))) continue;
      const p = e.body.getPosition(), a = Math.atan2(p.y, p.x);
      if (Math.sin(a) > -0.2) continue;
      const d = Math.abs(wrap(a - C.a)) * rf;
      if (d < bd) { bd = d; best = { e, a, d }; }
    }
    return best;
  },

  // ---------- the gator
  gOne(G, dt, play) {
    const M = this.byM;
    if (G.hitCD > 0) G.hitCD -= dt;
    if (G.flinch > 0) G.flinch -= dt;
    if (G.roll > 0) G.roll -= dt;
    if (G.sneeze > 0) G.sneeze -= dt;
    G.bump = Math.max(0, G.bump - dt * 3);
    const held = this.byTimers(G, dt);
    if (G.ph === 'hid' || G.ph === 'gone') return;
    if (G.ph === 'in') { if (G.t >= G.dur) this.bySet(G, 'log'); return; }
    if (G.ph === 'beaten') { if (G.t >= G.dur) { this.bySet(G, 'gone'); this.emit('gatorGone', { x: G.x, y: G.y, id: G.id }); } return; }
    if (!play) { if (G.boss && this.state === 'won') this.bySet(G, 'beaten', 1.8); else if (G.ph !== 'log') this.bySet(G, 'log'); return; }
    if (held) { if (G.ph === 'warn' || G.ph === 'snap') this.bySet(G, 'log'); return; }
    const len = this.gLen(G);
    switch (G.ph) {
      case 'log': case 'stalk': {
        const tg = this.byNear(G, [G.ch - 1, G.ch], GATOR.wake * Math.sqrt(G.s));
        if (!tg) { if (G.ph !== 'log') this.bySet(G, 'log'); break; }
        if (G.ph === 'log' && G.next > 0.6) break; // still dozing
        if (G.ph !== 'stalk') this.bySet(G, 'stalk');
        const side = Math.sign(wrap(tg.a - G.a)) || G.face;
        if (side !== G.face && tg.d > len * 0.3) { G.face = side; G.turn = 0.4; }
        const want = this.byKeep(tg.a - (G.face * len * 0.42) / this.byFloor(G.ch), G.ch, len), da = wrap(want - G.a) * this.byFloor(G.ch);
        if (Math.abs(da) > 0.03) this.byMv(G, Math.sign(da), Math.min(GATOR.speed[M] * (G.boss ? 0.8 : 1), Math.abs(da) / dt), dt, len);
        if (G.next <= 0 && this.gPrey(G, GATOR.jawR * Math.sqrt(G.s))) { this.bySet(G, 'warn', GATOR.warn[M] * (G.boss ? 1.1 : 1)); this.emit('gatorWarn', { x: G.x, y: G.y, id: G.id, boss: G.boss, ...this.gJaw(G) }); }
        break;
      }
      case 'warn': if (G.t >= G.dur) this.gSnap(G); break;
      case 'after': if (G.t >= G.dur) { this.bySet(G, 'log'); G.next = GATOR.next[M]; } break;
      case 'flee': {
        this.byMv(G, G.fd || -G.face, GATOR.flee, dt, len);
        if (G.t >= G.dur) { this.bySet(G, 'log'); G.next = Math.max(G.next, 0.5); }
        break;
      }
      case 'atk': if (!(this.bx && this.bx.boss && this.bx.boss.atk)) this.bySet(G, 'log'); break; // Grandpa winding up an attack (boss.js drives it; a save can cancel it)
      case 'dizzy': if ((G.dz -= dt) <= 0) { this.bySet(G, 'log'); G.next = Math.max(G.next, 1); } break;
      case 'hurt': if (G.t >= G.dur) { if (G.hp <= 0) { this.bySet(G, 'beaten', 1.8); this.emit('gatorBeaten', { x: G.x, y: G.y }); } else { this.bySet(G, 'log'); G.next = 2; } } break;
    }
  },
  // the first egg (or the decoy) in its jaws, within r
  gPrey(G, r) {
    const J = this.gJaw(G), D = this.p2Lure && this.p2Lure();
    if (D) { const p = D.body.getPosition(); if (Math.hypot(p.x - J.x, p.y - J.y) < r) return { decoy: D }; }
    let best = null, bd = r;
    for (const e of this.aliveEggs()) {
      if (!this.byFree(e)) continue;
      const p = e.body.getPosition(), d = Math.hypot(p.x - J.x, p.y - J.y);
      if (d < bd && this.gReach(G, e)) { bd = d; best = { e }; }
    }
    return best;
  },
  gSnap(G) {
    const M = this.byM, J = this.gJaw(G), pr = this.gPrey(G, GATOR.snapR * Math.sqrt(G.s));
    this.bySet(G, 'after', GATOR.after);
    if (!pr) { this.emit('gatorSnap', { ...J, id: G.id, hit: 0, boss: G.boss }); return; }
    if (pr.decoy) { this.p2Pop('gator'); G.stn = G.stnMax = 2; this.emit('gatorSnap', { ...J, id: G.id, hit: 0, decoy: 1, boss: G.boss }); return; }
    const e = pr.e, b = e.body, m = b.getMass(), F = this.byFrame(G), p = b.getPosition();
    G.eid = e.id;
    const k = e.stone > 0 ? 0.5 : 1;
    b.applyLinearImpulse(Vec2((F.nx * 0.9 - F.tx * G.face * 0.45) * m * GATOR.fling * k, (F.ny * 0.9 - F.ty * G.face * 0.45) * m * GATOR.fling * k), p, true);
    if (e.stone > 0) { G.stn = G.stnMax = 1.6; this.emit('gatorSnap', { ...J, id: G.id, hit: 0, stone: 1, boss: G.boss }); return; }
    this.emit('gatorSnap', { ...J, id: G.id, hit: 1, boss: G.boss, egg: e });
    this.crack(e, 0, 'gator', GATOR.crack[M]);
  },
  gFlee(G, T, why) {
    if (G.ph === 'hid' || G.ph === 'gone' || G.ph === 'beaten') return;
    const tg = this.byNear(G, [G.ch - 1, G.ch], 9);
    G.fd = tg ? -(Math.sign(wrap(tg.a - G.a)) || G.face) : -G.face;
    this.bySet(G, 'flee', Math.min(2.5, T * 0.3));
    G.next = Math.max(G.next, T);
    G.sneeze = why === 'pepper' ? 0.8 : 0;
    this.emit('gatorFlee', { x: G.x, y: G.y, id: G.id, why });
  },
  // ---------- Grandpa Gator
  gatorBoss() { return (this.gators || []).find((G) => G.boss) || null; },
  gatorBossPose(B) {
    const G = this.gatorBoss();
    if (!G || G.ph === 'gone') return;
    const J = this.gJaw(G);
    B.x = J.x; B.y = J.y; B.face = G.face;
  },
  gatorCanAttack() {
    const G = this.gatorBoss();
    return !!G && G.hp > 0 && !(G.frz > 0 || G.stn > 0) && (G.ph === 'log' || G.ph === 'stalk' || G.ph === 'after');
  },
  gatorAttack(B, name, M) {
    const G = this.gatorBoss();
    if (!G || !this.gatorCanAttack()) return null;
    if (name === 'sweep') { this.bySet(G, 'atk'); return { aim: G.x }; }
    if (name === 'roll') {
      const n = this.rings.length, T = this.aliveEggs().filter((e) => this.byFree(e) && this.channelOf(e) < n).sort((a, b) => this.channelOf(b) - this.channelOf(a) || a.id - b.id);
      const ok = (r) => r && r.grabbable && !r.gear && !ringLocked(this, r);
      let ring = T[0] && this.rings[Math.min(n - 1, this.channelOf(T[0]))];
      if (!ok(ring)) ring = this.rings.find((r) => r.i > 0 && ok(r));
      if (!ring) return null;
      this.bySet(G, 'atk');
      return { ring: ring.i, dir: ring.oneway || (B.k % 2 ? 1 : -1) };
    }
    return null;
  },
  gatorAct(B, A, M) {
    const G = this.gatorBoss(), mode = this.mode in BOSSG.dizzy ? this.mode : 'medium';
    if (!G) return;
    if (A.name === 'sweep') {
      B.quake = 0.6; B.qk = 0;
      this.rings.forEach((ring, i) => { if (ring.grabbable && !ringLocked(this, ring) && !ring.oneway) { const R = this.bx.rl[i]; R.spin = BOSSG.sweep[mode]; R.dir = i % 2 ? 1 : -1; } });
      this.emit('bossStomp', { x: G.x, y: G.y, who: 'gator' });
      this.bayouHit('quake', {});
      G.dz = G.dzMax = BOSSG.dizzySweep[mode];
    } else if (A.name === 'roll') {
      const R = this.bx.rl[A.ring];
      R.spin = BOSSG.roll[mode]; R.dir = A.dir;
      G.roll = 0.9;
      this.emit('bossPunch', { ring: A.ring, dir: A.dir, x: G.x, y: G.y, who: 'gator' });
      G.dz = G.dzMax = BOSSG.dizzy[mode];
    }
    this.bySet(G, 'dizzy');
    this.emit('gatorDizzy', { x: G.x, y: G.y, t: G.dz });
  },
  // a hit in the dizzy window costs him a tooth; at no teeth he swims off
  gatorHurt(G, why) {
    if (!G.boss || G.ph !== 'dizzy' || G.hitCD > 0 || G.hp <= 0) return false;
    G.hp--; G.hitCD = 1; G.dz = 0; G.flinch = 0.9;
    this.bySet(G, 'hurt', 0.9);
    const B = this.bx && this.bx.boss;
    if (B) { B.atk = null; B.t = Math.max(B.t, 2.5); B.flinch = 0.9; }
    this.emit('gatorHit', { x: G.x, y: G.y, hp: G.hp, max: G.hpMax, why });
    return true;
  },
  gatorBossBar() {
    const G = this.gatorBoss(), B = this.bx && this.bx.boss;
    if (!G) return null;
    const ph = G.ph, A = B && B.atk;
    const label = G.hp <= 0 || ph === 'beaten' || ph === 'gone' ? 'DEFEATED!' : ph === 'dizzy' ? 'DIZZY! HIT HIM' : ph === 'hurt' ? 'OUCH!' : A && A.ph === 'warn' ? (A.name === 'roll' ? 'DEATH ROLL!' : 'TAIL SWEEP!') : ph === 'warn' ? 'SNAP!' : 'WAIT FOR IT';
    return { hp: G.hp, hpMax: G.hpMax, ph: ph === 'dizzy' ? 'trapped' : ph === 'warn' ? 'crouch' : ph, label };
  },

  // ---------- the snapping turtle
  tOne(T, dt, play) {
    const M = this.byM;
    const held = this.byTimers(T, dt);
    if (T.eid) this.tPin(T, dt);
    if (!play) { if (T.eid) this.tLet(T, 'end'); return; }
    if (held) return;
    switch (T.ph) {
      case 'crawl': {
        const tg = this.byNear(T, [T.ch], TURTLE.wake);
        if (!tg || T.next > 0) break;
        const side = Math.sign(wrap(tg.a - T.a)) || T.face;
        if (side !== T.face && tg.d > 0.3) T.face = side;
        const m = this.tMouth(T), p = tg.e.body.getPosition();
        if (Math.hypot(p.x - m.x, p.y - m.y) < TURTLE.reach) { this.bySet(T, 'warn', TURTLE.warn[M]); this.emit('turtleWarn', { x: T.x, y: T.y, id: T.id }); break; }
        this.byMv(T, T.face, TURTLE.speed[M], dt, TURTLE.L);
        break;
      }
      case 'warn': {
        if (T.t < T.dur) break;
        const m = this.tMouth(T);
        let best = null, bd = TURTLE.grab;
        for (const e of this.aliveEggs()) { if (!this.byFree(e)) continue; const p = e.body.getPosition(), d = Math.hypot(p.x - m.x, p.y - m.y); if (d < bd) { bd = d; best = e; } }
        if (!best) { this.bySet(T, 'crawl'); T.next = 1; this.emit('turtleMiss', { ...m, id: T.id }); break; }
        T.eid = best.id; best.clamp = T.id + 1; T.hold = TURTLE.hold[M];
        this.bySet(T, 'clamp');
        this.emit('turtleClamp', { ...m, id: T.id, egg: best });
        break;
      }
      case 'clamp': if ((T.hold -= dt) <= 0) this.tLet(T, 'time'); break;
      case 'flip': if (T.t >= T.dur) { this.bySet(T, 'right', TURTLE.right); this.emit('turtleRight', { x: T.x, y: T.y, id: T.id }); } break;
      case 'right': if (T.t >= T.dur) { this.bySet(T, 'crawl'); T.next = TURTLE.next[M]; } break;
      case 'shell': if (T.t >= T.dur) this.bySet(T, T.eid ? 'clamp' : 'crawl'); break;
    }
  },
  tPin(T, dt) {
    const e = this.eggs.find((q) => q.id === T.eid);
    if (!e || !e.alive || e.saved || !e.body) { T.eid = 0; if (T.ph === 'clamp') this.bySet(T, 'crawl'); return; }
    const m = this.tMouth(T), b = e.body, p = b.getPosition();
    // a soft pull onto the beak (a hard velocity snap would slam it into the shell and puff dust)
    const d = Math.hypot(m.x - p.x, m.y - p.y), K = Math.min(12, 0.5 / dt);
    if (d > 0.12) b.setTransform(Vec2(m.x, m.y), b.getAngle());
    b.setLinearVelocity(d > 0.12 ? Vec2(0, 0) : Vec2((m.x - p.x) * K, (m.y - p.y) * K));
    b.setAngularVelocity(0);
  },
  tLet(T, why) {
    const e = this.eggs.find((q) => q.id === T.eid);
    T.eid = 0;
    if (e) {
      e.clamp = 0;
      if (e.alive && !e.saved && e.body) { const F = this.byFrame(T), m = e.body.getMass(); e.body.applyLinearImpulse(Vec2((F.nx * 1.4 + F.tx * T.face * 0.6) * m, (F.ny * 1.4 + F.ty * T.face * 0.6) * m), e.body.getPosition(), true); }
    }
    if (T.ph === 'clamp' || T.ph === 'shell') { this.bySet(T, 'crawl'); T.next = TURTLE.next[this.byM] * (why === 'time' ? 2.5 : 1); } // after a full hold it naps: the egg gets away
    this.emit('turtleLet', { x: T.x, y: T.y, id: T.id, why });
  },
  tFlip(T, why) {
    if (T.ph === 'flip' || T.ph === 'right') return false;
    if (T.eid) this.tLet(T, why);
    T.frz = 0; T.stn = 0;
    this.bySet(T, 'flip', TURTLE.flip[this.byM]);
    this.emit('turtleFlip', { x: T.x, y: T.y, id: T.id, why });
    return true;
  },

  // ---------- the mosquito swarm
  qOne(Q, dt, play) {
    const M = this.byM, held = this.byTimers(Q, dt);
    const e = Q.eid ? (Q.eid < 0 ? this.p2Lure && this.p2Lure() : this.eggs.find((q) => q.id === Q.eid)) : null;
    const lost = Q.eid && (!e || !(e.decoy || this.byFree(e)) || !e.body);
    const go = (x, y, v) => { const dx = x - Q.x, dy = y - Q.y, d = Math.hypot(dx, dy), s = Math.min(d, v * dt); if (d > 1e-4) { Q.x += (dx / d) * s; Q.y += (dy / d) * s; } };
    if (!play) { if (Q.ph !== 'roam' && Q.ph !== 'scatter') { Q.eid = 0; this.bySet(Q, 'rest'); } go(Q.hx, Q.hy, MOSQ.back); return; }
    if (held) { if (Q.eid) this.qDrop(Q, 'ice'); Q.y -= dt * (Q.frz > 0 ? 0.6 : 0.15); return; }
    if (lost && Q.ph !== 'scatter') { Q.eid = 0; this.bySet(Q, 'rest'); Q.next = MOSQ.rest[M] * 0.5; }
    // smoke and flame scatter it
    const P = this.p2 && this.p2.cloud;
    if (Q.ph !== 'scatter' && P && Math.hypot(P.x - Q.x, P.y - Q.y) < P.r) { this.qScatter(Q, MOSQ.scatter, 'smoke'); return; }
    if (Q.ph !== 'scatter') for (const f of this.aliveEggs()) { if (!(f.fire > 0)) continue; const p = f.body.getPosition(); if (Math.hypot(p.x - Q.x, p.y - Q.y) < 0.65) { this.qScatter(Q, MOSQ.scatter, 'fire'); return; } }
    const pe = e && e.body && e.body.getPosition();
    switch (Q.ph) {
      case 'roam': {
        go(Q.hx + 0.34 * Math.cos(Q.t * 1.3), Q.hy + 0.22 * Math.sin(Q.t * 2.1), 0.8);
        if (Q.next > 0) break;
        const D = this.p2Lure && this.p2Lure();
        if (D) { const p = D.body.getPosition(); if (Math.hypot(p.x - Q.x, p.y - Q.y) < MOSQ.hunt) { Q.eid = -1; this.bySet(Q, 'hunt'); break; } }
        let best = null, bd = MOSQ.hunt;
        for (const f of this.aliveEggs()) {
          if (!this.byFree(f) || f.stone > 0 || f.honey > 0 || f.fire > 0) continue;
          // it hunts its own channel and the ones next to it, never the starting pocket (ch 0): a lifted egg there would hit the ring's top
          const fc = this.channelOf(f);
          if (fc < 1 || Math.abs(fc - (Q.ch ?? fc)) > 1) continue;
          const p = f.body.getPosition(), d = Math.hypot(p.x - Q.x, p.y - Q.y);
          if (d < bd) { bd = d; best = f; }
        }
        if (best) { Q.eid = best.id; this.bySet(Q, 'hunt'); this.emit('mosqHunt', { x: Q.x, y: Q.y, id: Q.id }); }
        break;
      }
      case 'hunt': {
        if (!pe) break;
        go(pe.x, pe.y + 0.28, MOSQ.speed[M]);
        if (Math.hypot(pe.x - Q.x, pe.y + 0.28 - Q.y) < 0.3) { this.bySet(Q, 'latch', MOSQ.latch[M]); this.emit('mosqLatch', { x: Q.x, y: Q.y, id: Q.id }); }
        else if (Q.t > 8) { Q.eid = 0; this.bySet(Q, 'rest'); }
        break;
      }
      case 'latch': case 'lift': {
        if (!pe) break;
        Q.x = pe.x; Q.y = pe.y + 0.28;
        if (e.stone > 0) { this.qScatter(Q, 2, 'stone'); break; }
        if (Q.ph === 'latch') { if (Q.t >= Q.dur) { Q.ly = pe.y; this.bySet(Q, 'lift', MOSQ.lift[M]); this.emit('mosqLift', { x: Q.x, y: Q.y, id: Q.id }); } break; }
        const b = e.body, m = b.getMass(), v = b.getLinearVelocity(), end = Q.t > Q.dur - MOSQ.settle;
        const top = pe.y > Q.ly + MOSQ.rise, K = end ? 0.86 : top ? 1 : v.y < MOSQ.hover ? MOSQ.up : 1;
        b.applyForceToCenter(Vec2(-v.x * m * 0.6, m * this.g * K - (top ? v.y * m * 2 : 0)), true);
        if (Q.t >= Q.dur) { Q.eid = 0; this.bySet(Q, 'rest'); Q.next = MOSQ.rest[M]; this.emit('mosqDrop', { x: Q.x, y: Q.y, id: Q.id }); }
        break;
      }
      case 'rest': go(Q.hx, Q.hy, MOSQ.back); if (Math.hypot(Q.hx - Q.x, Q.hy - Q.y) < 0.05) this.bySet(Q, 'roam'); break;
      case 'scatter': if (Q.t >= Q.dur) { Q.x = Q.hx; Q.y = Q.hy; this.bySet(Q, 'roam'); Q.next = Math.max(Q.next, 1.5); this.emit('mosqBack', { x: Q.x, y: Q.y, id: Q.id }); } break;
    }
  },
  qDrop(Q, why) { Q.eid = 0; if (Q.ph === 'latch' || Q.ph === 'lift' || Q.ph === 'hunt') this.bySet(Q, 'rest'); this.emit('mosqDrop', { x: Q.x, y: Q.y, id: Q.id, why }); },
  qScatter(Q, T, why) {
    if (Q.ph === 'scatter') { Q.dur = Math.max(Q.dur, Q.t + T); return; }
    Q.eid = 0; Q.frz = 0; Q.stn = 0;
    this.bySet(Q, 'scatter', T);
    Q.next = Math.max(Q.next, T + 1.5);
    this.emit('mosqScatter', { x: Q.x, y: Q.y, id: Q.id, why });
  },

  // ---------- contacts (sim.js preSolve / impactCheck)
  bayouPass(ua, ub) {
    const c = ua.kind === 'bayou' ? ua : ub.kind === 'bayou' ? ub : null;
    if (!c) return false;
    const C = c.w === 'g' ? this.gators[c.idx] : this.turtles[c.idx];
    if (!C || C.ph === 'hid' || C.ph === 'gone' || C.ph === 'beaten' || C.ph === 'in') return true;
    const eg = ua.kind === 'egg' ? ua.egg : ub.kind === 'egg' ? ub.egg : null;
    if (eg && c.w === 't' && eg.clamp === C.id + 1) return true; // the egg in its beak
    if (eg) eg.freefall = 0;
    return false;
  },
  // an egg lands on a back or a shell: never a crack (the caller drops the impact). A hard drop flips a turtle; on a dizzy
  // Grandpa it is a hit
  bayouBump(egg, v, u, pt) {
    egg.freefall = 0; egg.drop = 0;
    if (u.w === 't') {
      const T = this.turtles[u.idx];
      // a drop onto the shell flips it: only the egg's outward (downward, into the floor) speed counts, so a rolling egg just bumps it
      const ep = egg.body.getPosition(), ev = egg.body.getLinearVelocity(), vr = (ev.x * ep.x + ev.y * ep.y) / Math.max(1e-6, Math.hypot(ep.x, ep.y));
      if (T && ((v > TURTLE.drop && vr > TURTLE.drop * 0.8) || (egg.stone > 0 && v > 0.4))) this.tFlip(T, egg.stone > 0 ? 'stone' : 'drop');
      return;
    }
    const G = this.gators[u.idx];
    if (!G) return;
    if (v > 0.6) { G.bump = Math.max(G.bump, clamp(v / 5, 0.2, 1)); }
    if (G.boss && v > BOSSG.hitV && G.ph === 'dizzy') this.gatorHurt(G, 'egg');
  },

  // ---------- powers (sim/powers2.js p2All) and the weather/bosses (boss.js animalsHit)
  bayouP2(kind, T) {
    if (!this.gators) return;
    const mode = this.mode in GATOR.crack ? this.mode : 'medium';
    for (const G of this.gators) {
      if (G.ph === 'hid' || G.ph === 'gone' || G.ph === 'beaten') continue;
      const f = G.boss ? 0.4 : 1;
      if (kind === 'ice' || kind === 'out') { G.frz = G.frzMax = Math.max(G.frz, T * f); G.stn = 0; }
      else if (kind === 'bolt' || kind === 'zap') { if (!(G.frz > 0)) { G.stn = G.stnMax = Math.max(G.stn, Math.min(T, 5) * f); if (kind === 'zap') G.zap = 0.3; } }
      else if (kind === 'pepper') { if (!this.gatorHurt(G, 'pepper')) { this.gFlee(G, T * f, 'pepper'); if (G.boss && this.bx.boss && this.bx.boss.atk && this.bx.boss.atk.ph === 'warn') { this.bx.boss.atk = null; this.bx.boss.t = 2; } } }
      else if (kind === 'spin') { G.stn = G.stnMax = Math.max(G.stn, 1.5 * f); }
      if (G.ph === 'warn' && (G.frz > 0 || G.stn > 0)) this.bySet(G, 'log');
    }
    for (const Tt of this.turtles) {
      if (kind === 'ice' || kind === 'out') { Tt.frz = Tt.frzMax = Math.max(Tt.frz, T); Tt.stn = 0; }
      else if (kind === 'bolt' || kind === 'zap') { if (!(Tt.frz > 0)) { Tt.stn = Tt.stnMax = Math.max(Tt.stn, Math.min(T, 5)); if (kind === 'zap') Tt.zap = 0.3; } }
      else if (kind === 'pepper') { if (Tt.ph === 'crawl' || Tt.ph === 'warn' || Tt.ph === 'clamp') this.bySet(Tt, 'shell', TURTLE.shell); }
      else if (kind === 'spin') this.tFlip(Tt, 'spin');
    }
    for (const Q of this.mosqs) {
      if (Q.ph === 'scatter') continue;
      if (kind === 'ice' || kind === 'out') { Q.frz = Q.frzMax = Math.max(Q.frz, T); if (Q.eid) this.qDrop(Q, 'ice'); }
      else if (kind === 'bolt' || kind === 'zap') { Q.stn = Q.stnMax = Math.max(Q.stn, Math.min(T, 4)); if (Q.eid) this.qDrop(Q, 'bolt'); }
      else this.qScatter(Q, kind === 'pepper' ? T : 3, kind);
    }
    void mode;
  },
  // the laser beak's line (sim/powers2.js p2Cut): gators on it back off (a dizzy Grandpa takes a hit), swarms scatter
  bayouLaser(test, T) {
    if (!this.gators) return;
    for (const G of this.gators) {
      if (G.ph === 'hid' || G.ph === 'gone' || G.ph === 'beaten') continue;
      const F = this.byFrame(G), len = this.gLen(G);
      let on = false;
      for (let k = -2; k <= 2 && !on; k++) { const d = (k / 2) * len * 0.45; on = test(F.x + F.tx * d + F.nx * 0.15, F.y + F.ty * d + F.ny * 0.15, 0.2 * G.s); }
      if (on && !this.gatorHurt(G, 'laser')) this.gFlee(G, T * (G.boss ? 0.4 : 1), 'laser');
    }
    for (const Q of this.mosqs) if (Q.ph !== 'scatter' && test(Q.x, Q.y, 0.35)) this.qScatter(Q, MOSQ.scatter, 'laser');
  },
  bayouHit(kind, o) {
    if (!this.turtles) return 0;
    let n = 0;
    if (kind === 'quake') for (const T of this.turtles) if (this.tFlip(T, 'quake')) n++;
    if (kind === 'bolt') for (const Q of this.mosqs) if (Q.ph !== 'scatter' && (o.r === Infinity || o.r == null || Math.hypot(Q.x - (o.x ?? 0), Q.y - (o.y ?? 0)) < (o.r || 0) + 1)) { this.qScatter(Q, 3, 'bolt'); n++; }
    return n;
  },
  // a boss phase with summon: the hidden babies come in
  bayouSummon() {
    let n = 0;
    for (const G of this.gators || []) if (G.ph === 'hid' && G.call) { this.bySet(G, 'in', 0.9); G.next = 2; n++; const F = this.byFrame(G); this.emit('gatorIn', { x: F.x, y: F.y, id: G.id }); }
    if (n) this.emit('bossSummon', { x: 0, y: this.outerR, who: 'gators' });
    return n;
  },
  // danger cue: a gator opening its jaws at an egg, a swarm lifting one
  bayouThreat(e) {
    let lv = 0;
    for (const G of this.gators || []) {
      if (G.ph !== 'warn') continue;
      const J = this.gJaw(G), p = e.body.getPosition();
      if (Math.hypot(p.x - J.x, p.y - J.y) < GATOR.jawR * 1.2 * Math.sqrt(G.s) && this.gReach(G, e)) lv = 1;
    }
    for (const Q of this.mosqs || []) if (Q.eid === e.id && (Q.ph === 'latch' || Q.ph === 'lift')) lv = Math.max(lv, 0.6);
    return lv;
  },

  // the planner's (and the hint's) worry for an egg, 0..1: near awake jaws it can reach, held by a turtle (safe but stuck), lifted by a swarm
  bayouPlan(e) {
    if (!this.gators) return 0;
    let lv = 0;
    const p = e.body.getPosition();
    for (const G of this.gators) {
      if (G.ph !== 'warn' && G.ph !== 'stalk') continue;
      const J = this.gJaw(G);
      if (Math.hypot(p.x - J.x, p.y - J.y) < GATOR.jawR * 1.5 * Math.sqrt(G.s) && this.gReach(G, e)) lv = Math.max(lv, G.ph === 'warn' ? 1 : 0.5);
    }
    if (e.clamp > 0) lv = Math.max(lv, 0.4);
    for (const Q of this.mosqs) if (Q.eid === e.id && (Q.ph === 'latch' || Q.ph === 'lift')) lv = Math.max(lv, 0.6);
    return lv;
  },

  // ---------- state
  bayouState() {
    if (!this.gators) return null;
    return { g: this.gators.map((G) => ({ ...G })), t: this.turtles.map((T) => ({ ...T })), q: this.mosqs.map((Q) => ({ ...Q })) };
  },
  bayouLoad(S) {
    if (!S || !this.gators) return;
    this.gators = S.g.map((G) => ({ ...G }));
    this.turtles = S.t.map((T) => ({ ...T }));
    this.mosqs = S.q.map((Q) => ({ ...Q }));
    this.gators.forEach((G, i) => this.byTeleport(this.gBody[i], G));
    this.turtles.forEach((T, i) => this.byTeleport(this.tBody[i], T));
  },
};
