// The den fox (v3.5): the fox boss lives INSIDE the vault. Mixed into Sim (sim.js: Object.assign(Sim.prototype,
// denMethods)), so `this` is the Sim. No imports from sim.js. All state is plain numbers in this.den (and egg.foxd),
// copied by denState() / restored by denLoad(), so rewind and the planner stay exact. Randomness: none needed.
//
// level.bossFight = { kind: 'fox' | 'foxking', den: { a, hp }, ... }: den.a = where its den is (deg, ring-local on the
// outer ring), hp = hits to drive it off (default 3). Boss levels with a den give the two outer channels more room
// (ring spec gapTo, wider gaps on the den run's inner ring) so the fox fits.
//
// It prowls the outermost channel (the den run) on the floor (the outer ring's inner face), riding that ring when it
// turns and walking back toward the eggs. Eggs in the den run it stalks and snaps up. An egg in the next channel in
// it hunts through a gap: it stands under a gap of the ring between them, crouches and wiggles (the telegraph: eyes
// lock, a paw mark where it will land; WARN x mode), then pounces up through the gap, grabs the egg and drops back
// out through the gap. If the gap has turned away when it springs, it bonks the ring and falls back dazed.
// Inside the inner channel it does not ride the ring (it scrabbles against it): if the player turns its way out more
// than TRAP_R away (or shuts the gaps on both sides), it is TRAPPED for TRAP_T: it drops the egg, cannot throw, and
// takes a hit from an egg saved meanwhile, an egg, rock or bomb falling on it, a burning egg touching it, lightning, a
// quake, ice or a power. Hits knock it out of the trap (hurt, then stunned) and break one stashed egg free of the den.
// With an egg in its jaws it trots to its den (on the outer ring) and stashes it there (out of play until a hit).
// Easy lets go of a carried egg after HOLD.easy s. At 0 hp it is defeated and runs off; the level plays on.
// It never touches a burning egg or a chick. In later phases the boss's throw attacks come from its mouth (boss.js).
import { RING_TH, wrap, clamp } from './geom.js';

export const DEN = {
  torso: 0.72, mouthX: 0.62, mouthY: 0.36, reach: 0.5, // m: the rig's size (render/foxden.js FOXRIG), mouth offset, grab reach
  speed: 0.9, stalk: 0.6, carry: 1.0, flee: 2.2, // m/s
  warn: { easy: 1.7, medium: 1.05, hard: 0.85 }, // crouch telegraph (s)
  grab: { easy: 0.6, medium: 0.42, hard: 0.3 }, // s it bites down on the egg before turning back (the trap window opens)
  sneak: { easy: 0.6, medium: 0.8, hard: 1.0 }, // m/s back to the gap, egg in its jaws
  leap: { easy: 0.8, medium: 0.6, hard: 0.5 }, // flight through a gap (s)
  lunge: 0.32, hop: 0.45, bonk: 1.0, hurt: 0.5, stunned: 2.2, stash: 0.6, laugh: 0.9, in: 0.8, drop: 0.35,
  trap: { easy: 5.5, medium: 4.2, hard: 3.4 }, // s trapped
  hold: { easy: 2.6, medium: 0, hard: 0 }, // s it carries an egg before letting go by itself (0 = to the den)
  next: { easy: 4, medium: 2.4, hard: 1.8 }, // s between hunts
  trapR: 1.8, // m: an exit gap further than this along the floor = no way out
  sneakMax: 2.5, // s sneaking toward a gap that keeps turning away before it is trapped again
  gapMin: 0.62, // m: gaps narrower than this are too small for it
  far: 1.7, near: 0.2, // m: an egg this far along the inner floor from a gap can be pounced on
};
const ACTIVE = new Set(['prowl', 'stalk', 'idle']);

export const denMethods = {
  denInit(L) {
    this.den = null;
    const F = L.bossFight;
    if (!F || !F.den || this.rings.length < 3) return;
    const n = this.rings.length, D = F.den, hp = D.hp || 3;
    this.den = {
      ph: 'wait', t: F.delay ?? 3, dur: 1, ch: n - 1, a: 0, r: 0, face: 1, odo: 0, carA: 0,
      denA: ((D.a ?? 90) * Math.PI) / 180, hp, hpMax: hp, eid: 0, tgt: 0, gi: -1, kind: '', hold: 0, next: 2, sneakT: 0,
      // a leap / hop / fall: from (a0, r0) to (a1, r1), apex radius ap, u 0..1 over dur
      a0: 0, r0: 0, a1: 0, r1: 0, ap: 0, lu: 0, ldur: 1, lg: -1, blocked: 0,
      frozen: 0, zap: 0, hitCD: 0, saved: 0, stash: [], trapN: 0, esc: 0, alpha: 1, tossT: 0, tossD: 1,
    };
    const R = this.denFloor(n - 1), q = this.denDenPt();
    this.den.a = q.a; this.den.r = R;
  },

  // ---------- geometry
  denFloor(ch) { return this.rings[ch].r - RING_TH / 2; }, // feet radius in channel ch (the outer wall's inner face)
  denDenPt() { const ring = this.rings[this.rings.length - 1], a = ring.body.getAngle() + this.den.denA; return { a, x: (ring.r - RING_TH / 2 - 0.32) * Math.cos(a), y: (ring.r - RING_TH / 2 - 0.32) * Math.sin(a) }; },
  // world point of a spot in the fox's frame: f metres forward (its facing), h up (toward the centre), from its feet
  denPt(f, h) {
    const F = this.den, r = F.r - h, a = F.a + (F.face * f) / Math.max(0.5, F.r - h);
    return { x: r * Math.cos(a), y: r * Math.sin(a) };
  },
  denMouth() { return this.denPt(DEN.mouthX, DEN.mouthY); },
  denBody() { return this.denPt(0.05, 0.32); },
  denLive() { const F = this.den; return !!F && F.ph !== 'wait' && F.ph !== 'gone'; },
  denM(o) { return o[this.mode] ?? o.medium; },

  // ---------- every step (boss.js v31Step)
  denStep(dt) {
    const F = this.den;
    if (!F) return;
    const n = this.rings.length, B = this.bx && this.bx.boss;
    if (this.state !== 'play') { this.denEnd(dt); return; }
    if (F.ph === 'wait') { if ((F.t -= dt) <= 0) { this.denSet('in', DEN.in); this.emit('denIn', { ...this.denBody() }); } this.denCarry(); return; }
    if (F.ph === 'gone') return;
    // the target is saved and only stashed eggs are left: the fox keeps them and the level ends (no waiting out the clock)
    if (F.stash.length && this.savedLog.length >= (this.level.target || 1) && this.aliveEggs().every((e) => e.foxd === 2)) {
      for (const id of F.stash.splice(0)) { const e = this.eggs.find((q) => q.id === id); if (e && e.alive) this.breakEgg(e, 'fox'); }
      return;
    }
    if (F.hitCD > 0) F.hitCD -= dt;
    if (F.zap > 0) F.zap = Math.max(0, F.zap - dt);
    this.denCarry();
    this.denHolds(dt);
    // an egg saved: a trapped fox takes the hit (the boss rule: a save staggers the boss); a crouching one flinches
    const saved = this.savedLog.length;
    if (saved > F.saved) { F.saved = saved; if (F.ph === 'trapped') this.denHurt('save'); else if (F.ph === 'crouch') { F.next = 1.4; this.denSet('prowl'); this.emit('denFlinch', { ...this.denBody() }); } }
    if (F.frozen > 0) { // frozen solid: nothing moves (a trapped fox stays trapped and can still be hit)
      if ((F.frozen -= dt) <= 0) { F.frozen = 0; this.emit('denThaw', { ...this.denBody() }); }
      if (F.ph === 'trapped') this.denTrapHits();
      return;
    }
    if (F.next > 0) F.next -= dt;
    switch (F.ph) {
      case 'in': if ((F.t -= dt) <= 0) this.denSet('prowl'); break;
      case 'prowl': case 'stalk': case 'idle': this.denProwl(dt); break;
      case 'toss': if ((F.t -= dt) <= 0) this.denSet('prowl'); break;
      case 'crouch': this.denCrouch(dt); break;
      case 'leap': this.denLeap(dt); break;
      case 'grab': if ((F.t -= dt) <= 0) this.denAfterGrab(); break;
      case 'carry': this.denCarryEgg(dt); break;
      case 'inner': this.denInner(dt); break;
      case 'trapped':
        this.denTrapHits();
        if (F.ph === 'trapped' && (F.t -= dt) <= 0) { F.sneakT = 0; F.esc = 1; this.denSet('inner'); } // time up: it squeezes along to a gap
        break;
      case 'hurt': if ((F.t -= dt) <= 0) this.denSet(F.hp <= 0 ? 'defeated' : 'stunned', F.hp <= 0 ? 1.6 : DEN.stunned); break;
      case 'stunned': case 'bonk': if ((F.t -= dt) <= 0) { F.next = Math.max(F.next, 1.2); this.denSet(F.ch < n - 1 ? 'inner' : 'prowl'); F.sneakT = 0; F.esc = 1; } break;
      case 'stash': if ((F.t -= dt) <= 0) { this.denStash(); this.denSet('laugh', DEN.laugh); } break;
      case 'laugh': case 'drop': if ((F.t -= dt) <= 0) { F.next = Math.max(F.next, this.denM(DEN.next)); this.denSet('prowl'); } break;
      case 'defeated': if ((F.t -= dt) <= 0) { this.denSet('flee', 1.2); this.emit('denFlee', { ...this.denBody() }); } break;
      case 'flee': this.denWalk(DEN.flee * dt); F.alpha = clamp(F.t / 0.6, 0, 1); if ((F.t -= dt) <= 0) { F.ph = 'gone'; F.alpha = 0; } break;
    }
    if (B && F.ph !== 'gone') this.denBossPose(B);
  },
  denSet(ph, t = 0) { const F = this.den; F.ph = ph; F.t = F.dur = t; },

  // the outer ring carries it round while it stands in the den run; in the inner channel it does not (it scrabbles)
  denCarry() {
    const F = this.den, n = this.rings.length, ring = this.rings[n - 1], ra = ring.body.getAngle();
    const air = F.ph === 'leap';
    if (!air && F.ch === n - 1 && F.ph !== 'flee') F.a = wrap(F.a + wrap(ra - F.carA));
    F.carA = ra;
  },
  // what it holds rides in its jaws; what it stashed rides in the den
  denHolds() {
    const F = this.den;
    const e = F.eid ? this.eggs.find((q) => q.id === F.eid) : null;
    if (F.eid && (!e || !e.alive || e.saved)) F.eid = 0;
    if (e && e.alive) { const m = this.denMouth(); this.denPin(e, m.x, m.y, F.a + (F.face > 0 ? Math.PI / 2 : -Math.PI / 2)); }
    const d = this.denDenPt();
    F.stash = F.stash.filter((id) => this.eggs.some((q) => q.id === id && q.alive && !q.saved));
    F.stash.forEach((id, i) => {
      const q = this.eggs.find((x) => x.id === id), ring = this.rings[this.rings.length - 1], rr = ring.r - RING_TH / 2 - 0.3, a = d.a + ((i - (F.stash.length - 1) / 2) * 0.36) / rr;
      this.denPin(q, rr * Math.cos(a), rr * Math.sin(a), a + Math.PI / 2);
    });
  },
  denPin(e, x, y, ang) {
    const b = e.body;
    b.setTransform({ x, y }, ang);
    b.setLinearVelocity({ x: 0, y: 0 }); b.setAngularVelocity(0);
    e.ch = this.channelOf(e); e.freefall = 0; e.drop = 0;
  },

  // walk d metres along the floor (+ forward)
  denWalk(d) {
    const F = this.den;
    F.a = wrap(F.a + (F.face * d) / Math.max(0.5, F.r));
    F.odo += Math.abs(d);
  },
  // walk toward world angle ga at speed v; returns the arc distance left (m)
  denToward(ga, v, dt) {
    const F = this.den, da = wrap(ga - F.a), dist = Math.abs(da) * F.r;
    if (dist < 0.02) return 0;
    const want = da > 0 ? 1 : -1;
    if (want !== F.face) { F.face = want; return dist; } // turns on the spot
    this.denWalk(Math.min(dist, v * dt));
    return Math.max(0, dist - v * dt);
  },

  // ---------- eggs it may take
  denCan(e) { return e.alive && !e.saved && !e.foxd && e.body && e.body.isActive() && !e.chick && !(e.fire > 0) && !e.octo; },
  denEggAt(ch) { return this.aliveEggs().filter((e) => this.denCan(e) && this.channelOf(e) === ch); },
  // a gap of ring ri it fits through: [{a (world), len, gi}]
  denGaps(ri) {
    const ring = this.rings[ri], ra = ring.body.getAngle();
    return ring.gaps.map((g, gi) => ({ a: wrap(ra + g.a), len: g.len, gi, ok: this.snakeGap(g) && g.len >= DEN.gapMin })).filter((g) => g.ok);
  },

  // ---------- prowling: hunt the den run's eggs, else line up under a gap below an egg one channel in
  denProwl(dt) {
    const F = this.den, n = this.rings.length, R = this.denFloor(n - 1), rIn = this.denFloor(n - 2);
    F.r = R; F.ch = n - 1;
    let plan = null;
    if (F.next <= 0) {
      for (const e of this.denEggAt(n - 1)) {
        const p = e.body.getPosition(), ea = Math.atan2(p.y, p.x), d = Math.abs(wrap(ea - F.a)) * R;
        if (!plan || d < plan.d) plan = { kind: 'snap', e, d, ea };
      }
      if (!plan) for (const e of this.denEggAt(n - 2)) {
        const p = e.body.getPosition(), ea = Math.atan2(p.y, p.x);
        for (const g of this.denGaps(n - 2)) {
          const along = Math.abs(wrap(ea - g.a)) * rIn;
          if (along < DEN.near || along > DEN.far) continue;
          const d = Math.abs(wrap(g.a - F.a)) * R;
          if (!plan || d < plan.d) plan = { kind: 'pounce', e, d, ea, g };
        }
      }
    }
    if (!plan) { // nothing to hunt: patrol the bottom of the run, sniffing
      const home = -Math.PI / 2 + 0.7 * Math.sin(this.t * 0.17);
      const left = this.denToward(home, DEN.speed * 0.6, dt);
      F.ph = left < 0.05 ? 'idle' : 'prowl';
      return;
    }
    F.tgt = plan.e.id;
    if (plan.kind === 'snap') {
      // stand so its mouth is over the egg, facing it
      const face = wrap(plan.ea - F.a) >= 0 ? 1 : -1, stand = plan.ea - (face * DEN.mouthX) / R;
      const left = Math.abs(wrap(stand - F.a)) * R;
      F.ph = left < 1.5 ? 'stalk' : 'prowl';
      if (left < 0.1) { F.face = face; this.denStartCrouch('snap', -1, 0.75); return; }
      this.denToward(stand, F.ph === 'stalk' ? DEN.stalk : DEN.speed, dt);
      return;
    }
    // pounce: stand right under the gap, facing the egg
    const g = plan.g, face = wrap(plan.ea - g.a) >= 0 ? 1 : -1;
    const left = Math.abs(wrap(g.a - F.a)) * R;
    F.ph = left < 1.5 ? 'stalk' : 'prowl';
    if (left < 0.1) { F.face = face; this.denStartCrouch('pounce', g.gi, 1); return; }
    this.denToward(g.a, F.ph === 'stalk' ? DEN.stalk : DEN.speed, dt);
  },
  denStartCrouch(kind, gi, k) {
    const F = this.den;
    F.kind = kind; F.gi = gi;
    this.denSet('crouch', this.denM(DEN.warn) * k);
    const T = this.denLanding();
    this.emit('denWarn', { kind, x: T.x, y: T.y, ...this.denBody() });
  },
  // where it will land: the target egg's side (pounce: on the inner floor; snap: a lunge along the run)
  denLanding() {
    const F = this.den, n = this.rings.length, e = this.eggs.find((q) => q.id === F.tgt);
    const inner = F.kind === 'pounce', r = inner ? this.denFloor(n - 2) : this.denFloor(n - 1);
    let a = F.a + (F.face * 0.3) / r;
    if (e && e.body) { const p = e.body.getPosition(); a = Math.atan2(p.y, p.x) - (F.face * DEN.mouthX * 0.85) / r; }
    return { a, r, x: r * Math.cos(a), y: r * Math.sin(a) };
  },
  // is gap gi of ring ri lined up with world angle a (room for the fox's body)?
  denAligned(ri, gi, a) {
    const ring = this.rings[ri], g = ring.gaps[gi];
    if (!g || !this.snakeGap(g)) return false;
    return Math.abs(wrap(ring.body.getAngle() + g.a - a)) * ring.r < g.len / 2 - 0.08;
  },

  denCrouch(dt) {
    const F = this.den, n = this.rings.length, e = this.eggs.find((q) => q.id === F.tgt);
    const want = F.kind === 'pounce' ? n - 2 : n - 1;
    if (!e || !this.denCan(e) || this.channelOf(e) !== want) { F.next = 0.8; this.denSet('prowl'); this.emit('denMiss', { why: 'gone', ...this.denBody() }); return; }
    if ((F.t -= dt) > 0) return;
    const T = this.denLanding();
    if (F.kind === 'pounce') {
      const R = this.denFloor(n - 1);
      this.denFly(T.a, T.r, Math.min(R, T.r) - 0.42, this.denM(DEN.leap), n - 2);
    } else this.denFly(T.a, T.r, T.r - 0.12, DEN.lunge, -1);
    this.emit('denPounce', { kind: F.kind, ...this.denBody() });
  },
  // a flight from where it is to (a1, r1) over apex radius ap; lg = the channel it means to reach (-1: same channel)
  denFly(a1, r1, ap, dur, lg) {
    const F = this.den;
    Object.assign(F, { a0: F.a, r0: F.r, a1: F.a + wrap(a1 - F.a), r1, ap, lu: 0, ldur: dur, lg, blocked: 0 });
    this.denSet('leap', dur);
  },
  // the flight path: it rises straight through the gap first, then crosses to the landing spot
  denFlyAt(u) {
    const F = this.den, s = (x) => x * x * (3 - 2 * x);
    if (F.lg >= 0) { // a pounce: straight up through the gap to above the next floor, then across and down onto it
      if (u < 0.5) { const v = u / 0.5; return { a: F.a0, r: F.r0 + (F.ap - F.r0) * (1 - (1 - v) * (1 - v)) }; }
      const v = (u - 0.5) / 0.5;
      return { a: F.a0 + (F.a1 - F.a0) * s(v), r: F.ap + (F.r1 - F.ap) * v * v };
    }
    const k = F.blocked ? clamp((u - 0.22) / 0.78, 0, 1) : u;
    const a = F.a0 + (F.a1 - F.a0) * s(k);
    const up = Math.sin(Math.PI * u), r = (F.r0 + (F.r1 - F.r0) * u) - (Math.min(F.r0, F.r1) - F.ap) * up;
    return { a, r };
  },
  denLeap(dt) {
    const F = this.den, n = this.rings.length;
    F.lu = Math.min(1, F.lu + dt / F.ldur);
    const q = this.denFlyAt(F.lu);
    // crossing the ring between the channels: the gap must still be lined up, or it bonks and falls back
    if (F.lg >= 0 && !F.blocked && F.lu <= 0.5) { // the rise: it crosses the ring at the gap's spot
      const ring = this.rings[n - 2];
      if (q.r < ring.r + RING_TH / 2 + 0.22 && q.r > ring.r - RING_TH / 2 - 0.3 && !this.denAligned(n - 2, F.gi, q.a)) {
        F.blocked = 1;
        Object.assign(F, { a0: F.a, r0: F.r, a1: F.a, r1: this.denFloor(n - 1), ap: F.r, lu: 0, ldur: 0.32, lg: -1 });
        this.emit('denBonk', { x: F.r * Math.cos(F.a), y: F.r * Math.sin(F.a) });
        return;
      }
    }
    F.a = wrap(q.a); F.r = q.r;
    F.odo += 0;
    if (F.lu < 1) return;
    F.a = wrap(F.a1); F.r = F.r1;
    F.ch = clamp(this.chAt(F.r + 0.05), 1, n - 1);
    if (F.blocked) { F.ch = n - 1; F.next = this.denM(DEN.next); this.denSet('bonk', DEN.bonk); return; }
    if (F.kind === 'hop') { this.denSet(F.eid ? 'carry' : 'prowl'); F.ch = n - 1; return; }
    // landed: the egg in reach?
    const e = this.eggs.find((x) => x.id === F.tgt), m = this.denMouth();
    if (e && this.denCan(e)) { const p = e.body.getPosition(); if (Math.hypot(p.x - m.x, p.y - m.y) < DEN.reach + 0.2) { this.denTake(e); return; } }
    this.emit('denMiss', { why: 'dodged', ...this.denBody() });
    F.next = this.denM(DEN.next) * 0.6;
    if (F.ch < n - 1) { F.sneakT = 0; this.denSet('inner'); } else this.denSet('prowl');
  },
  denTake(e) {
    const F = this.den;
    if (e.joint) this.unMagnet(e);
    if (e.bubbleFix) this.popBubble(e);
    e.hold = null; e.honey = 0;
    e.foxd = 1;
    e.body.setActive(false);
    F.eid = e.id; F.hold = 0; F.tgt = 0;
    this.denSet('grab', this.denM(DEN.grab));
    const p = e.body.getPosition();
    this.emit('denGrab', { x: p.x, y: p.y, egg: e });
  },
  denAfterGrab() {
    const F = this.den, n = this.rings.length;
    if (F.ch < n - 1) { F.sneakT = 0; this.denSet('inner'); } else this.denSet('carry');
  },

  // inside the inner channel: back to the nearest gap out (or trapped when there is none in reach)
  denInner(dt) {
    const F = this.den, n = this.rings.length, ri = n - 2;
    F.r = this.denFloor(ri); F.ch = ri;
    let best = null;
    for (const g of this.denGaps(ri)) { const d = Math.abs(wrap(g.a - F.a)) * F.r; if (!best || d < best.d) best = { ...g, d }; }
    // trapped: no gap in reach (or one that keeps turning away). Once a trap is over it escapes: it walks to the nearest
    // gap however far (the channel stays blocked meanwhile), so one trap never holds it for good
    if (!best || (!F.esc && (best.d > DEN.trapR + 0.4 || (F.sneakT += dt) > DEN.sneakMax))) { this.denTrap(); return; }
    if (best.d < best.len / 2 - 0.12) { // over the gap: drop out into the den run
      F.kind = 'hop'; F.gi = best.gi; F.esc = 0;
      this.denFly(best.a, this.denFloor(n - 1), F.r - 0.15, DEN.hop, -1);
      F.kind = 'hop';
      return;
    }
    this.denToward(best.a, this.denM(DEN.sneak) * (F.esc ? 1.3 : 1), dt);
  },
  denTrap() {
    const F = this.den;
    const e = this.denLetGo('trap');
    F.trapN++; F.esc = 0;
    this.denSet('trapped', this.denM(DEN.trap));
    const b = this.denBody();
    this.emit('denTrapped', { ...b, egg: e ? e.id : 0 });
  },
  // hits on a trapped fox from things in the vault: an egg, rock or bomb falling on it, a burning egg touching it
  denTrapHits() {
    const F = this.den;
    if (F.hitCD > 0) return;
    const c = this.denBody();
    for (const e of this.aliveEggs()) {
      if (!e.body.isActive()) continue;
      const p = e.body.getPosition(), v = e.body.getLinearVelocity(), d = Math.hypot(p.x - c.x, p.y - c.y);
      if (e.fire > 0 && d < 0.6) { this.denHurt('fire', p); return; }
      // falling onto it: moving toward its body, fast
      if (d < 0.58 && -((v.x * (c.x - p.x) + v.y * (c.y - p.y)) / (d || 1)) < -1.8) { this.denHurt('drop', p); return; }
    }
    for (const r of this.rocks || []) {
      if (!r.alive) continue;
      const p = r.body.getPosition(), v = r.body.getLinearVelocity();
      if (Math.hypot(p.x - c.x, p.y - c.y) < 0.55 && Math.hypot(v.x, v.y) > 1.6) { this.denHurt('drop', p); return; }
    }
  },
  // a hit: only a trapped (or frozen-in-the-trap) fox takes damage; otherwise hazards just make it flinch
  denHurt(why, p) {
    const F = this.den;
    if (F.hitCD > 0 || F.hp <= 0) return false;
    F.hp--; F.hitCD = 1.2; F.frozen = 0;
    this.denLetGo('hit');
    // a stashed egg breaks free of the den: it rolls back into the den run
    const id = F.stash.shift();
    if (id) this.denFree(this.eggs.find((q) => q.id === id), 'den');
    this.denSet('hurt', DEN.hurt);
    const b = this.denBody();
    this.emit('denHit', { why, hp: F.hp, max: F.hpMax, x: b.x, y: b.y, px: p ? p.x : b.x, py: p ? p.y : b.y, freed: id || 0 });
    const B = this.bx && this.bx.boss;
    if (B) { B.flinch = 0.9; if (B.atk && B.atk.ph === 'warn') { B.atk = null; B.t = 2; } }
    if (F.hp <= 0) {
      for (const sid of F.stash.splice(0)) this.denFree(this.eggs.find((q) => q.id === sid), 'den');
      this.emit('denDefeat', { ...b });
    }
    return true;
  },
  // let go of the egg in its jaws, where it is (a short safe moment so the release never cracks it)
  denLetGo(why) {
    const F = this.den;
    if (!F.eid) return null;
    const e = this.eggs.find((q) => q.id === F.eid);
    F.eid = 0;
    if (!e || !e.alive) return null;
    this.denFree(e, why);
    return e;
  },
  denFree(e, why) {
    if (!e || !e.alive) return;
    e.foxd = 0;
    const b = e.body, p = b.getPosition(), d = Math.hypot(p.x, p.y) || 1, c = this.chAt(d);
    if (c >= 1 && c < this.rings.length) { const R = this.rings[c].r - RING_TH / 2 - 0.3; if (d > R) b.setTransform({ x: (p.x / d) * R, y: (p.y / d) * R }, b.getAngle()); }
    b.setActive(true);
    b.setLinearVelocity({ x: 0, y: 0 });
    e.safeT = Math.max(e.safeT || 0, 0.8);
    e.ch = this.channelOf(e); e.freefall = 0; e.drop = 0;
    this.emit('denDrop', { why, x: p.x, y: p.y, egg: e });
  },

  // with an egg: trot to the den (on the outer ring) and stash it; Easy lets go after a while
  denCarryEgg(dt) {
    const F = this.den, n = this.rings.length;
    F.r = this.denFloor(n - 1); F.ch = n - 1;
    if (!F.eid) { this.denSet('prowl'); return; }
    F.hold += dt;
    const lim = this.denM(DEN.hold);
    if (lim && F.hold >= lim && this.denSafeDrop()) { this.denLetGo('tired'); this.denSet('drop', DEN.drop); return; } // Easy: lets go (never onto thorns)
    const d = this.denDenPt(), stand = d.a - (F.face * DEN.mouthX) / F.r;
    const da = wrap(d.a - F.a);
    if (Math.abs(da) * F.r < DEN.mouthX + 0.05 && Math.sign(da) === F.face) { this.denSet('stash', DEN.stash); return; }
    this.denToward(Math.abs(da) * F.r < 1 ? stand : d.a, DEN.carry * (this.mode === 'hard' ? 1.12 : 1), dt);
  },
  // a let-go spot that is not right on a thorn of the den run (where it rolls from there is the player's job)
  denSafeDrop() {
    const F = this.den, ring = this.rings[this.rings.length - 1], m = this.denMouth(), a = Math.atan2(m.y, m.x), R = F.r;
    for (const th of ring.thorns) {
      if (!th.alive || th.side === 'out') continue;
      const d = wrap(ring.body.getAngle() + th.a - a);
      if (Math.abs(d) * R < 0.8) return false;
    }
    return true;
  },
  denStash() {
    const F = this.den, e = F.eid ? this.eggs.find((q) => q.id === F.eid) : null;
    F.eid = 0;
    if (!e || !e.alive) return;
    e.foxd = 2;
    F.stash.push(e.id);
    const d = this.denDenPt();
    this.emit('denStash', { x: d.x, y: d.y, egg: e, n: F.stash.length });
  },

  // ---------- the boss's throws come from its mouth; it only throws while it is free to
  denCanThrow() { const F = this.den; return !!F && ACTIVE.has(F.ph) && !(F.frozen > 0) && !F.eid; },
  denToss(dur) { const F = this.den; if (!F) return; this.denSet('toss', dur); },
  denBossPose(B) {
    const m = this.denMouth();
    B.x = m.x; B.y = m.y; B.face = this.den.face;
  },

  // ---------- hazards (boss.js animalsHit) and powers (powers2.js p2All)
  // kind: gust rock lava ice bolt quake; trapped = a hit; otherwise a flinch (lightning, ice, a rock: a short daze)
  denHazard(kind, o = {}) {
    const F = this.den;
    if (!this.denLive() || F.ph === 'defeated' || F.ph === 'flee' || F.ph === 'in') return 0;
    const b = this.denBody(), r = o.r ?? Infinity;
    if (r < Infinity && Math.hypot(b.x - (o.x ?? 0), b.y - (o.y ?? 0)) > r + 0.5) return 0;
    if (kind === 'gust') return 1;
    if (F.ph === 'trapped') { this.denHurt(kind, o); return 1; }
    if (kind === 'bolt') F.zap = 0.3;
    this.denDaze(kind === 'bolt' ? 2 : kind === 'quake' ? 1 : 1.2, kind);
    return 1;
  },
  denDaze(T, why) {
    const F = this.den, n = this.rings.length;
    if (F.ph === 'leap' || F.ph === 'hurt' || F.ph === 'defeated' || F.ph === 'flee' || F.ph === 'gone' || F.ph === 'wait') return;
    this.denLetGo('daze');
    if (F.ph === 'trapped') return;
    F.ch = F.r < this.denFloor(n - 1) - 0.3 ? n - 2 : n - 1;
    this.denSet('stunned', T);
    this.emit('denDaze', { why, ...this.denBody() });
  },
  denP2(kind, T) {
    const F = this.den;
    if (!this.denLive() || F.ph === 'defeated' || F.ph === 'flee') return;
    const b = this.denBody();
    if (F.ph === 'trapped' && kind !== 'pepper' && kind !== 'scare') { this.denHurt(kind, b); if (kind === 'ice') F.frozen = Math.min(T, 3); return; }
    if (kind === 'ice') { this.denLetGo('daze'); F.frozen = T; if (F.ph === 'crouch' || F.ph === 'toss') this.denSet('prowl'); this.emit('denFreeze', { ...b, t: T }); return; }
    if (kind === 'bolt' || kind === 'zap') { F.zap = 0.3; this.denDaze(Math.min(T, 3), kind); return; }
    this.denDaze(kind === 'spin' || kind === 'out' ? 1.5 : 1.2, kind);
    F.next = Math.max(F.next, kind === 'pepper' || kind === 'scare' ? T : 2);
  },

  // ---------- the level is decided: it runs off crying on a win, laughs on a loss
  denEnd(dt) {
    const F = this.den;
    if (!F || F.ph === 'gone' || F.ph === 'wait') { if (F && F.ph === 'wait') F.ph = 'gone'; return; }
    const win = this.state === 'winning' || this.state === 'won';
    if (win && F.ph !== 'defeated' && F.ph !== 'flee') { this.denLetGo('end'); this.denSet('defeated', 1.2); }
    else if (!win && F.ph !== 'laugh') { this.denLetGo('end'); this.denSet('laugh', 99); }
    if (F.ph === 'defeated' && (F.t -= dt) <= 0) this.denSet('flee', 1.2);
    else if (F.ph === 'flee') { this.denWalk(DEN.flee * dt); F.alpha = clamp(F.t / 0.6, 0, 1); if ((F.t -= dt) <= 0) { F.ph = 'gone'; F.alpha = 0; } }
  },

  // ---------- planner / danger: 1 = in its jaws or den, 0.8 = it is about to pounce on this egg, less = near it
  denScore() { const F = this.den; return F ? 500 * (F.hpMax - F.hp) + (F.ph === 'trapped' ? 250 : 0) : 0; },
  denThreat(e) {
    const F = this.den;
    if (!F || !this.denLive() || F.ph === 'defeated' || F.ph === 'flee') return 0;
    if (e.foxd) return 1;
    if ((F.ph === 'crouch' || F.ph === 'leap') && F.tgt === e.id) return 0.8;
    if (!ACTIVE.has(F.ph) || F.frozen > 0) return 0;
    const n = this.rings.length, c = this.channelOf(e);
    if (c !== n - 1 && c !== n - 2) return 0;
    const p = e.body.getPosition(), d = Math.abs(wrap(Math.atan2(p.y, p.x) - F.a)) * F.r;
    return d < 2 ? (c === n - 1 ? 0.5 : 0.25) * (1 - d / 2) : 0;
  },

  // ---------- state
  denState() { return this.den ? { ...this.den, stash: [...this.den.stash] } : null; },
  denLoad(S) {
    if (!S || !this.den) return;
    this.den = { ...S, stash: [...S.stash] };
    for (const e of this.eggs) if (e.foxd && e.body) e.body.setActive(false); // in its jaws or den: out of the physics world
  },
};
