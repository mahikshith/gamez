// The egg thieves (v3.6): the WEASEL and the RATS, plus the two thief bosses (the weasel of L5 and the Rat King of
// L35). Mixed into Sim (sim.js: Object.assign(Sim.prototype, thiefMethods)), so `this` is the Sim. No imports from
// sim.js. Every thief is a plain object in this.thieves (and egg.thf), copied by thiefState() / restored by
// thiefLoad(), so rewind and the planner stay exact. No randomness.
//
// They live on the floor of a channel (its outer wall's inner face) at NORMAL ring spacing: a thief stands about as
// tall as an egg (render/thieves.js draws them to RIG).
//
// level.weasel = { a, delay, ch }        a = its den (deg, ring-local on the run's floor ring), ch = the run channel
//                                         (default the outermost). Easy/Hard scale the timings (HUNT).
// level.rats   = { a, n, delay, ch }     n rats (default 2) share one hole at a (deg, ring-local).
// level.bossFight = { kind: 'weasel' | 'ratking', den: { a, hp }, ... }: the boss is a hunter in the outermost channel;
//                                         a bossFight with rats sends them to the boss's den (eggs there can be won back).
//
// WEASEL (hunter): fast. It prowls its run riding that ring. An egg in the run it stalks and snaps up; an egg one channel
//   in it hunts through a gap: it lines up under a gap, crouches and wiggles (the telegraph), then pounces up through the
//   gap, grabs the egg and comes back out. If the gap turned away meanwhile it bonks the ring and falls back dazed.
//   Inside the inner channel the ring does not carry it: turn its way out away (or shut the gaps) and it is TRAPPED:
//   it drops the egg and can be hit (an egg falling on it, a burning egg, lightning, a quake, a power). A hit frees one
//   stashed egg from its den; the boss loses one hp, a level weasel runs home and hides for a while.
//   Upside: a pounce telegraphs where it lands, and a trapped weasel blocks nothing (the gap it came through is free).
//   Downside: an egg in its jaws goes to its den. Easy: it lets go of a carried egg after a while.
// RAT (roller): comes as a pair, smaller and slower. A rat gets behind an egg in its channel, braces (the telegraph)
//   and rolls it along the floor with its nose and front paws toward its hole. The floor ring slides under it (rats do
//   not ride the ring): turn a gap under the rolling egg and it drops through: the rat did your work. An egg rolled into
//   the hole is lost (in a boss fight: in the Rat King's den, won back by hitting him). Light (the glow chick's flash)
//   and water (a water egg or water orb near it) scare it home for a while; it never touches a wet egg.
//   Upside: a rolling egg can be steered into a gap. Downside: an egg it reaches the hole with is gone.
//   Easy: slower, and it gives up a push after a while.
import { RING_TH, EGG_W, wrap, clamp } from './geom.js';

// sizes in metres (render/thieves.js draws the rigs to these): s = rig length unit (100 units); mouthX/Y = where a held
// egg's centre sits, from the point between its feet (x forward, y up): a hunter carries it crosswise in its jaws, just
// ahead of the snout (measured on the drawn carry pose); for the rat mouthX is its nose tip, the egg rolls just ahead
// of it. bodyX/Y = the torso centre; reach = grab reach
export const RIG = {
  weasel: { s: 0.9, mouthX: 0.82, mouthY: 0.31, bodyX: 0.0, bodyY: 0.22, reach: 0.42, gapMin: 0.58 },
  rat: { s: 0.74, mouthX: 0.64, mouthY: 0.07, bodyX: -0.045, bodyY: 0.16, reach: 0.3, gapMin: 0.5 },
  ratking: { s: 1.35, mouthX: 1.157, mouthY: 0.411, bodyX: -0.064, bodyY: 0.283, reach: 0.6, gapMin: 0.64 }, // 1.3x the first cut: mykee found him too small on a phone
};
const m3 = (easy, medium, hard) => ({ easy, medium, hard });
export const HUNT = {
  speed: 1.0, stalk: 0.65, carry: 1.05, flee: 2.4, // m/s
  warn: m3(1.7, 1.05, 0.85), // crouch telegraph (s)
  grab: m3(0.6, 0.42, 0.3), // s it bites down before turning back (the trap window opens)
  sneak: m3(0.6, 0.8, 1.0), // m/s back to the gap with the egg
  leap: m3(0.8, 0.6, 0.5), // flight through a gap (s)
  lunge: 0.32, hop: 0.45, bonk: 1.0, hurt: 0.5, stunned: 2.2, stash: 0.6, laugh: 0.9, in: 0.8, drop: 0.35,
  trap: m3(5.5, 4.2, 3.4), // s trapped
  hold: m3(2.6, 0, 0), // s it carries an egg before letting go by itself (0 = all the way to the den)
  next: m3(4, 2.4, 1.8), // s between hunts
  away: m3(14, 10, 8), // s a hit level weasel hides in its den
  trapR: 1.8, sneakMax: 2.5, far: 1.7, near: 0.2,
};
export const ROLL = {
  speed: 0.75, flee: 1.8, // m/s
  push: m3(0.22, 0.3, 0.36), // m/s rolling an egg
  brace: m3(1.4, 0.9, 0.7), // s the telegraph behind the egg
  hold: m3(4.5, 0, 0), // Easy: gives up a push after this long
  next: m3(5, 3, 2.4), // s between pushes
  scare: m3(9, 6, 5), // s hiding after light or water
  stunned: 2.2, hurt: 0.4, cross: 0.9, stash: 0.7, in: 0.7,
  far: 3.2, // m: eggs further than this along the floor it ignores
  wet: 0.75, // m: a water egg or water orb this close scares it
};
const HUNT_ON = new Set(['prowl', 'stalk', 'idle']);
const ROLL_ON = new Set(['prowl', 'idle']);
const AWAY = new Set(['wait', 'gone', 'hide']);

export const thiefMethods = {
  thiefInit(L) {
    this.thieves = [];
    const F = L.bossFight, n = this.rings.length;
    if (n < 2) return;
    const add = (o) => {
      const T = {
        id: this.thieves.length, kind: o.kind, ai: o.kind === 'rat' ? 'roll' : 'hunt', boss: o.boss ? 1 : 0,
        run: clamp(o.ch ?? n - 1, o.kind === 'rat' ? 0 : 1, n - 1), ph: 'wait', t: o.delay ?? 3, dur: 1, a: 0, r: 0, face: 1, odo: 0, carA: 0,
        denA: ((o.a ?? 90) * Math.PI) / 180, home: -1, eat: o.kind === 'rat' ? 1 : 0, hp: o.hp || 0, hpMax: o.hp || 0,
        eid: 0, tgt: 0, gi: -1, k: '', hold: 0, next: 2, sneakT: 0, ch: 0,
        a0: 0, r0: 0, a1: 0, r1: 0, ap: 0, lu: 0, ldur: 1, lg: -1, blocked: 0, roll: 0,
        frozen: 0, zap: 0, hitCD: 0, saved: 0, stash: [], esc: 0, alpha: 1, slot: o.slot || 0, warp: 0, wx: 0, wy: 0,
      };
      this.thieves.push(T);
      T.ch = T.run; T.r = this.thFloor(T.run);
      const d = this.thDenPt(T); T.a = d.a;
      return T;
    };
    let boss = null;
    if (F && F.den && (F.kind === 'weasel' || F.kind === 'ratking')) boss = add({ kind: F.kind, boss: 1, hp: F.den.hp || 3, a: F.den.a, delay: F.delay ?? 3 });
    if (L.weasel) add({ kind: 'weasel', ...L.weasel });
    if (L.rats) {
      const R = L.rats, cnt = R.n || 2, hole = boss && !R.hole ? boss : null;
      for (let i = 0; i < cnt; i++) {
        const T = add({ kind: 'rat', a: R.a, ch: hole ? hole.run : R.ch, delay: (R.delay ?? 5) + i * (R.gap ?? 2.5), slot: i });
        if (hole) { T.home = hole.id; T.eat = 0; T.denA = hole.denA; }
      }
    }
  },
  thiefBoss() { return (this.thieves || []).find((T) => T.boss) || null; },

  // ---------- geometry
  thFloor(ch) { return this.rings[ch].r - RING_TH / 2; }, // feet radius in channel ch (its outer wall's inner face)
  thOwner(T) { return T.home >= 0 ? this.thieves[T.home] : T; },
  thDenPt(T) {
    const O = this.thOwner(T), ring = this.rings[O.run], rr = ring.r - RING_TH / 2 - 0.3, a = ring.body.getAngle() + O.denA;
    return { a, x: rr * Math.cos(a), y: rr * Math.sin(a) };
  },
  // world point f metres forward (its facing), h up (toward the centre), from its feet
  thPt(T, f, h) { const r = T.r - h, a = T.a + (T.face * f) / Math.max(0.5, r); return { x: r * Math.cos(a), y: r * Math.sin(a) }; },
  thMouth(T) { // in a leap the body pitches along the flight path (render/thieves.js draws it the same way)
    const G = RIG[T.kind], p = this.thPitch(T);
    if (!p) return this.thPt(T, G.mouthX, G.mouthY);
    const dh = G.mouthY - G.bodyY, c = Math.cos(p), sn = Math.sin(p);
    return this.thPt(T, G.mouthX * c - dh * sn, G.bodyY + G.mouthX * sn + dh * c);
  },
  thPitch(T) { // nose-up pitch (rad) of a leaping thief: the slope of its flight path
    if (T.ph !== 'leap') return 0;
    const q0 = this.thFlyAt(T, Math.max(0, T.lu - 0.02)), q1 = this.thFlyAt(T, Math.min(1, T.lu + 0.02)), fw = wrap(q1.a - q0.a) * T.r * T.face, up = q0.r - q1.r;
    return clamp(Math.atan2(up, Math.abs(fw) + 1e-4), -1.15, 1.15) * (fw < 0 ? -1 : 1) * 0.85;
  },
  thBody(T) { const G = RIG[T.kind]; return this.thPt(T, G.bodyX, G.bodyY); },
  thLive(T) { return !AWAY.has(T.ph) && T.ph !== 'flee' && T.ph !== 'defeated' && T.ph !== 'warp'; },
  thM(o) { return o[this.mode] ?? o.medium; },
  thSet(T, ph, t = 0) { T.ph = ph; T.t = T.dur = t; },
  thSpeed(T, v) { return T.kind === 'ratking' ? v * 0.82 : v; },

  // ---------- every step (sim.js predStep)
  thiefStep(dt) {
    const L = this.thieves;
    if (!L || !L.length) return;
    if (this.state !== 'play') { for (const T of L) this.thEnd(T, dt); return; }
    // the target is saved and only stashed eggs are left: the thieves keep them and the level ends (no waiting out the clock)
    if (this.savedLog.length >= (this.level.target || 1) && this.aliveEggs().length && this.aliveEggs().every((e) => e.thf === 2)) {
      for (const T of L) for (const id of T.stash.splice(0)) { const e = this.eggs.find((q) => q.id === id); if (e && e.alive) this.breakEgg(e, 'thief'); }
      return;
    }
    for (const T of L) {
      if (T.hitCD > 0) T.hitCD -= dt;
      if (T.zap > 0) T.zap = Math.max(0, T.zap - dt);
      if (T.ai === 'hunt') this.huntCarry(T);
      this.thHolds(T);
      if (T.ph === 'warp') { this.thWarpStep(T, dt); continue; }
      if (T.ph === 'wait') { if ((T.t -= dt) <= 0) { this.thSet(T, 'in', T.ai === 'hunt' ? HUNT.in : ROLL.in); this.thAtDen(T); this.emit('thiefIn', { kind: T.kind, id: T.id, ...this.thBody(T) }); } continue; }
      if (T.ph === 'gone') continue;
      if (T.ph === 'hide') { this.thAtDen(T); if ((T.t -= dt) <= 0) { this.thSet(T, 'in', 0.7); this.emit('thiefBack', { kind: T.kind, ...this.thBody(T) }); } continue; }
      // an egg saved: a trapped hunter takes the hit (a save staggers it); a crouching one flinches
      const saved = this.savedLog.length;
      if (saved > T.saved) {
        T.saved = saved;
        if (T.ai === 'hunt') { if (T.ph === 'trapped') this.thHurt(T, 'save'); else if (T.ph === 'crouch') { T.next = 1.4; this.thSet(T, 'prowl'); this.emit('thiefFlinch', { kind: T.kind, ...this.thBody(T) }); } }
      }
      if (T.frozen > 0) { // frozen solid: nothing moves (a trapped hunter stays trapped and can still be hit)
        if ((T.frozen -= dt) <= 0) { T.frozen = 0; this.emit('thiefThaw', { kind: T.kind, ...this.thBody(T) }); }
        if (T.ph === 'trapped') this.huntTrapHits(T);
        continue;
      }
      if (T.next > 0) T.next -= dt;
      if (T.ai === 'hunt') this.huntStep(T, dt); else this.rollStep(T, dt);
    }
    const B = this.bx && this.bx.boss, K = this.thiefBoss();
    if (B && K && K.ph !== 'gone') this.thiefBossPose(B);
  },
  thAtDen(T) { const d = this.thDenPt(T); T.a = d.a; T.r = this.thFloor(this.thOwner(T).run); T.ch = this.thOwner(T).run; T.carA = this.rings[T.ch].body.getAngle(); },

  // what it holds rides in its jaws (or in front of its nose); what is stashed rides in the den
  thHolds(T) {
    const e = T.eid ? this.eggs.find((q) => q.id === T.eid) : null;
    if (T.eid && (!e || !e.alive || e.saved)) T.eid = 0;
    if (e && e.alive) {
      if (T.ai === 'roll') { const p = this.rollEggPt(T); this.thPin(e, p.x, p.y, p.ang); }
      else { const m = this.thMouth(T); this.thPin(e, m.x, m.y, T.a + (T.face > 0 ? 0 : Math.PI)); } // crosswise in its jaws
    }
    if (!T.stash.length) return;
    const d = this.thDenPt(T), ring = this.rings[T.run], rr = ring.r - RING_TH / 2 - 0.3;
    T.stash = T.stash.filter((id) => this.eggs.some((q) => q.id === id && q.alive && !q.saved));
    T.stash.forEach((id, i) => {
      const q = this.eggs.find((x) => x.id === id), a = d.a + ((i - (T.stash.length - 1) / 2) * 0.36) / rr;
      this.thPin(q, rr * Math.cos(a), rr * Math.sin(a), a + Math.PI / 2);
    });
  },
  thPin(e, x, y, ang) {
    const b = e.body;
    b.setTransform({ x, y }, ang);
    b.setLinearVelocity({ x: 0, y: 0 }); b.setAngularVelocity(0);
    e.ch = this.channelOf(e); e.freefall = 0; e.drop = 0;
  },
  thWalk(T, d) { T.a = wrap(T.a + (T.face * d) / Math.max(0.5, T.r)); T.odo += Math.abs(d); },
  // walk toward world angle ga at speed v; returns the arc distance left (m)
  thToward(T, ga, v, dt) {
    const da = wrap(ga - T.a), dist = Math.abs(da) * T.r;
    if (dist < 0.02) return 0;
    const want = da > 0 ? 1 : -1;
    if (want !== T.face) { T.face = want; return dist; } // turns on the spot
    this.thWalk(T, Math.min(dist, v * dt));
    return Math.max(0, dist - v * dt);
  },
  // eggs it may take: none in another thief's hold, no burning egg, no chick, none the octopus holds; rats skip wet eggs
  thCan(T, e) {
    if (!e.alive || e.saved || e.thf || !e.body || !e.body.isActive() || e.chick || e.fire > 0 || e.octo) return false;
    if (T.ai === 'roll' && e.water > 0) return false;
    return !this.thieves.some((o) => o !== T && (o.tgt === e.id || o.eid === e.id));
  },
  thEggsAt(T, ch) { return this.aliveEggs().filter((e) => this.thCan(T, e) && this.channelOf(e) === ch); },
  thGaps(ri, min) {
    const ring = this.rings[ri], ra = ring.body.getAngle();
    return ring.gaps.map((g, gi) => ({ a: wrap(ra + g.a), len: g.len, gi, ok: this.snakeGap(g) && g.len >= min })).filter((g) => g.ok);
  },

  // ================================================================== the hunter (weasel, Rat King)
  huntCarry(T) { // its run ring carries it round while it stands in the run; in the inner channel it does not (it scrabbles)
    const ring = this.rings[T.run], ra = ring.body.getAngle();
    if (T.ph !== 'leap' && T.ch === T.run && T.ph !== 'flee' && !AWAY.has(T.ph)) T.a = wrap(T.a + wrap(ra - T.carA));
    T.carA = ra;
  },
  huntStep(T, dt) {
    switch (T.ph) {
      case 'in': if ((T.t -= dt) <= 0) this.thSet(T, 'prowl'); break;
      case 'prowl': case 'stalk': case 'idle': this.huntProwl(T, dt); break;
      case 'toss': if ((T.t -= dt) <= 0) this.thSet(T, 'prowl'); break;
      case 'crouch': this.huntCrouch(T, dt); break;
      case 'leap': this.huntLeap(T, dt); break;
      case 'grab': if ((T.t -= dt) <= 0) { T.sneakT = 0; this.thSet(T, T.ch < T.run ? 'inner' : 'carry'); } break;
      case 'carry': this.huntCarryEgg(T, dt); break;
      case 'inner': this.huntInner(T, dt); break;
      case 'trapped':
        this.huntTrapHits(T);
        if (T.ph === 'trapped' && (T.t -= dt) <= 0) { T.sneakT = 0; T.esc = 1; this.thSet(T, 'inner'); } // time up: it squeezes along to a gap
        break;
      case 'hurt': if ((T.t -= dt) <= 0) { if (T.boss && T.hp <= 0) this.thSet(T, 'defeated', 1.6); else this.thSet(T, 'stunned', HUNT.stunned); } break;
      case 'stunned': case 'bonk':
        if ((T.t -= dt) <= 0) {
          T.next = Math.max(T.next, 1.2); T.sneakT = 0; T.esc = 1;
          if (!T.boss && T.k === 'hit') { T.k = ''; this.thGoHome(T); } else this.thSet(T, T.ch < T.run ? 'inner' : 'prowl');
        }
        break;
      case 'home': this.thHomeStep(T, dt); break;
      case 'stash': if ((T.t -= dt) <= 0) { this.thStash(T); this.thSet(T, 'laugh', HUNT.laugh); } break;
      case 'laugh': case 'drop': if ((T.t -= dt) <= 0) { T.next = Math.max(T.next, this.thM(HUNT.next)); this.thSet(T, 'prowl'); } break;
      case 'defeated': if ((T.t -= dt) <= 0) { this.thSet(T, 'flee', 1.2); this.emit('thiefFlee', { kind: T.kind, ...this.thBody(T) }); } break;
      case 'flee': this.thWalk(T, HUNT.flee * dt); T.alpha = clamp(T.t / 0.6, 0, 1); if ((T.t -= dt) <= 0) { T.ph = 'gone'; T.alpha = 0; } break;
    }
  },
  // prowling: hunt the run's eggs, else line up under a gap below an egg one channel in
  huntProwl(T, dt) {
    const G = RIG[T.kind], R = this.thFloor(T.run), rIn = this.thFloor(T.run - 1);
    T.r = R; T.ch = T.run;
    let plan = null;
    if (T.next <= 0) {
      for (const e of this.thEggsAt(T, T.run)) {
        const p = e.body.getPosition(), ea = Math.atan2(p.y, p.x), d = Math.abs(wrap(ea - T.a)) * R;
        if (!plan || d < plan.d) plan = { kind: 'snap', e, d, ea };
      }
      if (!plan) for (const e of this.thEggsAt(T, T.run - 1)) {
        const p = e.body.getPosition(), ea = Math.atan2(p.y, p.x);
        for (const g of this.thGaps(T.run - 1, G.gapMin)) {
          const along = Math.abs(wrap(ea - g.a)) * rIn;
          if (along < HUNT.near || along > HUNT.far) continue;
          const d = Math.abs(wrap(g.a - T.a)) * R;
          if (!plan || d < plan.d) plan = { kind: 'pounce', e, d, ea, g };
        }
      }
    }
    if (!plan) { // nothing to hunt: patrol the bottom of the run, sniffing
      T.tgt = 0;
      const home = -Math.PI / 2 + 0.7 * Math.sin(this.t * 0.17 + T.id * 2.1);
      const left = this.thToward(T, home, this.thSpeed(T, HUNT.speed) * 0.6, dt);
      T.ph = left < 0.05 ? 'idle' : 'prowl';
      return;
    }
    T.tgt = plan.e.id;
    if (plan.kind === 'snap') { // stand so its mouth is over the egg, facing it
      const face = wrap(plan.ea - T.a) >= 0 ? 1 : -1, stand = plan.ea - (face * G.mouthX) / R;
      const left = Math.abs(wrap(stand - T.a)) * R;
      T.ph = left < 1.5 ? 'stalk' : 'prowl';
      if (left < 0.1) { T.face = face; this.huntCrouchStart(T, 'snap', -1, 0.75); return; }
      this.thToward(T, stand, this.thSpeed(T, T.ph === 'stalk' ? HUNT.stalk : HUNT.speed), dt);
      return;
    }
    const g = plan.g, face = wrap(plan.ea - g.a) >= 0 ? 1 : -1, left = Math.abs(wrap(g.a - T.a)) * R;
    T.ph = left < 1.5 ? 'stalk' : 'prowl';
    if (left < 0.1) { T.face = face; this.huntCrouchStart(T, 'pounce', g.gi, 1); return; }
    this.thToward(T, g.a, this.thSpeed(T, T.ph === 'stalk' ? HUNT.stalk : HUNT.speed), dt);
  },
  huntCrouchStart(T, k, gi, f) {
    T.k = k; T.gi = gi;
    this.thSet(T, 'crouch', this.thM(HUNT.warn) * f * (T.kind === 'ratking' ? 1.1 : 1));
    const L = this.huntLanding(T);
    this.emit('thiefWarn', { kind: T.kind, k, x: L.x, y: L.y, ...this.thBody(T) });
  },
  // where it will land: the target egg's side (pounce: on the inner floor; snap: a lunge along the run)
  huntLanding(T) {
    const G = RIG[T.kind], e = this.eggs.find((q) => q.id === T.tgt), inner = T.k === 'pounce', r = this.thFloor(inner ? T.run - 1 : T.run);
    let a = T.a + (T.face * 0.3) / r;
    if (e && e.body) { const p = e.body.getPosition(); a = Math.atan2(p.y, p.x) - (T.face * G.mouthX * 0.85) / r; }
    return { a, r, x: r * Math.cos(a), y: r * Math.sin(a) };
  },
  // is gap gi of ring ri lined up with world angle a (room for its body)?
  thAligned(ri, gi, a) {
    const ring = this.rings[ri], g = ring.gaps[gi];
    if (!g || !this.snakeGap(g)) return false;
    return Math.abs(wrap(ring.body.getAngle() + g.a - a)) * ring.r < g.len / 2 - 0.06;
  },
  huntCrouch(T, dt) {
    const e = this.eggs.find((q) => q.id === T.tgt), want = T.k === 'pounce' ? T.run - 1 : T.run;
    if (!e || !this.thCan(T, e) || this.channelOf(e) !== want) { T.next = 0.8; this.thSet(T, 'prowl'); T.tgt = 0; this.emit('thiefMiss', { kind: T.kind, why: 'gone', ...this.thBody(T) }); return; }
    if ((T.t -= dt) > 0) return;
    if (this.warpStrike?.('thief', T)) return; // v3.4: a warp gate swallows it as it springs
    const L = this.huntLanding(T);
    if (T.k === 'pounce') this.huntFly(T, L.a, L.r, Math.min(this.thFloor(T.run), L.r) - 0.36, this.thM(HUNT.leap), T.run - 1);
    else this.huntFly(T, L.a, L.r, L.r - 0.1, HUNT.lunge, -1);
    this.emit('thiefPounce', { kind: T.kind, k: T.k, ...this.thBody(T) });
  },
  huntFly(T, a1, r1, ap, dur, lg) {
    Object.assign(T, { a0: T.a, r0: T.r, a1: T.a + wrap(a1 - T.a), r1, ap, lu: 0, ldur: dur, lg, blocked: 0 });
    this.thSet(T, 'leap', dur);
  },
  // the flight path: a pounce rises straight through the gap first, then crosses to the landing spot
  thFlyAt(T, u) {
    const s = (x) => x * x * (3 - 2 * x);
    if (T.lg >= 0) {
      if (u < 0.5) { const v = u / 0.5; return { a: T.a0, r: T.r0 + (T.ap - T.r0) * (1 - (1 - v) * (1 - v)) }; }
      const v = (u - 0.5) / 0.5;
      return { a: T.a0 + (T.a1 - T.a0) * s(v), r: T.ap + (T.r1 - T.ap) * v * v };
    }
    const k = T.blocked ? clamp((u - 0.22) / 0.78, 0, 1) : u;
    const a = T.a0 + (T.a1 - T.a0) * s(k), up = Math.sin(Math.PI * u), r = (T.r0 + (T.r1 - T.r0) * u) - (Math.min(T.r0, T.r1) - T.ap) * up;
    return { a, r };
  },
  huntLeap(T, dt) {
    T.lu = Math.min(1, T.lu + dt / T.ldur);
    const q = this.thFlyAt(T, T.lu);
    // crossing the ring between the channels: the gap must still be lined up, or it bonks and falls back
    if (T.lg >= 0 && !T.blocked && T.lu <= 0.5) {
      const ring = this.rings[T.run - 1];
      if (q.r < ring.r + RING_TH / 2 + 0.18 && q.r > ring.r - RING_TH / 2 - 0.24 && !this.thAligned(T.run - 1, T.gi, q.a)) {
        T.blocked = 1;
        Object.assign(T, { a0: T.a, r0: T.r, a1: T.a, r1: this.thFloor(T.run), ap: T.r, lu: 0, ldur: 0.32, lg: -1 });
        this.emit('thiefBonk', { kind: T.kind, x: T.r * Math.cos(T.a), y: T.r * Math.sin(T.a) });
        return;
      }
    }
    T.a = wrap(q.a); T.r = q.r;
    if (T.lu < 1) return;
    T.a = wrap(T.a1); T.r = T.r1;
    T.ch = clamp(this.chAt(T.r + 0.05), 1, T.run);
    if (T.blocked) { T.ch = T.run; T.next = this.thM(HUNT.next); this.thSet(T, 'bonk', HUNT.bonk); return; }
    if (T.k === 'hop') { T.ch = T.run; this.thSet(T, T.eid ? 'carry' : 'prowl'); return; }
    const G = RIG[T.kind], e = this.eggs.find((x) => x.id === T.tgt), m = this.thPt(T, G.mouthX, G.mouthY); // the bite lands level (not along the flight's pitch)
    if (e && this.thCan(T, e)) { const p = e.body.getPosition(); if (Math.hypot(p.x - m.x, p.y - m.y) < G.reach + 0.2) { this.thTake(T, e); return; } }
    this.emit('thiefMiss', { kind: T.kind, why: 'dodged', ...this.thBody(T) });
    T.next = this.thM(HUNT.next) * 0.6; T.tgt = 0;
    if (T.ch < T.run) { T.sneakT = 0; this.thSet(T, 'inner'); } else this.thSet(T, 'prowl');
  },
  thTake(T, e) {
    if (e.joint) this.unMagnet(e);
    if (e.bubbleFix) this.popBubble(e);
    e.hold = null; e.honey = 0; e.thf = 1;
    e.body.setActive(false);
    T.eid = e.id; T.hold = 0; T.tgt = 0;
    if (T.ai === 'hunt') this.thSet(T, 'grab', this.thM(HUNT.grab));
    const p = e.body.getPosition();
    this.emit('thiefGrab', { kind: T.kind, x: p.x, y: p.y, egg: e });
  },
  // inside the inner channel: back to the nearest gap out (or trapped when there is none in reach)
  huntInner(T, dt) {
    const ri = T.run - 1, G = RIG[T.kind];
    T.r = this.thFloor(ri); T.ch = ri;
    let best = null;
    for (const g of this.thGaps(ri, G.gapMin)) { const d = Math.abs(wrap(g.a - T.a)) * T.r; if (!best || d < best.d) best = { ...g, d }; }
    // once a trap is over it escapes: it walks to the nearest gap however far, so one trap never holds it for good
    if (!best || (!T.esc && (best.d > HUNT.trapR + 0.4 || (T.sneakT += dt) > HUNT.sneakMax))) { this.huntTrap(T); return; }
    if (best.d < best.len / 2 - 0.1) { // over the gap: drop out into the run
      T.esc = 0; T.gi = best.gi;
      this.huntFly(T, best.a, this.thFloor(T.run), T.r - 0.12, HUNT.hop, -1);
      T.k = 'hop';
      return;
    }
    this.thToward(T, best.a, this.thSpeed(T, this.thM(HUNT.sneak)) * (T.esc ? 1.3 : 1), dt);
  },
  huntTrap(T) {
    const e = this.thLetGo(T, 'trap');
    T.esc = 0;
    this.thSet(T, 'trapped', this.thM(HUNT.trap));
    this.emit('thiefTrapped', { kind: T.kind, ...this.thBody(T), egg: e ? e.id : 0 });
  },
  // hits on a trapped hunter from things in the vault: an egg, rock or bomb falling on it, a burning egg touching it
  huntTrapHits(T) {
    if (T.hitCD > 0) return;
    const c = this.thBody(T), R = RIG[T.kind].s * 0.75;
    for (const e of this.aliveEggs()) {
      if (!e.body.isActive()) continue;
      const p = e.body.getPosition(), v = e.body.getLinearVelocity(), d = Math.hypot(p.x - c.x, p.y - c.y);
      if (e.fire > 0 && d < R + 0.15) { this.thHurt(T, 'fire', p); return; }
      if (d < R && -((v.x * (c.x - p.x) + v.y * (c.y - p.y)) / (d || 1)) < -1.6) { this.thHurt(T, 'drop', p); return; }
    }
    for (const r of this.rocks || []) {
      if (!r.alive) continue;
      const p = r.body.getPosition(), v = r.body.getLinearVelocity();
      if (Math.hypot(p.x - c.x, p.y - c.y) < R && Math.hypot(v.x, v.y) > 1.6) { this.thHurt(T, 'drop', p); return; }
    }
  },
  // a hit: the boss loses an hp; a level weasel lets go, frees one stashed egg and runs home to hide
  thHurt(T, why, p) {
    if (T.hitCD > 0 || (T.boss && T.hp <= 0)) return false;
    if (T.boss) T.hp--;
    T.hitCD = 1.2; T.frozen = 0;
    this.thLetGo(T, 'hit');
    const id = T.stash.shift(); // a stashed egg breaks free of the den: it rolls back into the run
    if (id) this.thFree(this.eggs.find((q) => q.id === id), 'den');
    this.thSet(T, 'hurt', T.ai === 'hunt' ? HUNT.hurt : ROLL.hurt);
    T.k = 'hit';
    const b = this.thBody(T);
    this.emit('thiefHit', { kind: T.kind, boss: T.boss, why, hp: T.hp, max: T.hpMax, x: b.x, y: b.y, px: p ? p.x : b.x, py: p ? p.y : b.y, freed: id || 0 });
    const B = this.bx && this.bx.boss;
    if (B && T.boss) { B.flinch = 0.9; if (B.atk && B.atk.ph === 'warn') { B.atk = null; B.t = 2; } }
    if (T.boss && T.hp <= 0) {
      for (const sid of T.stash.splice(0)) this.thFree(this.eggs.find((q) => q.id === sid), 'den');
      for (const o of this.thieves) if (o !== T && o.home === T.id && this.thLive(o)) { this.thLetGo(o, 'end'); this.thSet(o, 'flee', 1.4); } // his rats run
      this.emit('thiefDefeat', { kind: T.kind, ...b });
    }
    return true;
  },
  // let go of the egg it holds, where it is (a short safe moment so the release never cracks it)
  thLetGo(T, why) {
    if (!T.eid) return null;
    const e = this.eggs.find((q) => q.id === T.eid);
    T.eid = 0;
    if (!e || !e.alive) return null;
    this.thFree(e, why);
    return e;
  },
  thFree(e, why, vOut = 0) {
    if (!e || !e.alive) return;
    e.thf = 0;
    const b = e.body, p = b.getPosition(), d = Math.hypot(p.x, p.y) || 1, c = this.chAt(d);
    if (!vOut && c >= 1 && c < this.rings.length) { const R = this.rings[c].r - RING_TH / 2 - 0.3; if (d > R) b.setTransform({ x: (p.x / d) * R, y: (p.y / d) * R }, b.getAngle()); }
    b.setActive(true);
    b.setLinearVelocity({ x: (p.x / d) * vOut, y: (p.y / d) * vOut });
    e.safeT = Math.max(e.safeT || 0, 0.8);
    e.ch = this.channelOf(e); e.freefall = 0; e.drop = 0;
    this.emit('thiefDrop', { why, x: p.x, y: p.y, egg: e });
  },
  // with an egg: trot to the den and stash it; Easy lets go after a while
  huntCarryEgg(T, dt) {
    const G = RIG[T.kind];
    T.r = this.thFloor(T.run); T.ch = T.run;
    if (!T.eid) { this.thSet(T, 'prowl'); return; }
    T.hold += dt;
    const lim = this.thM(HUNT.hold);
    if (lim && T.hold >= lim && this.thSafeDrop(T)) { this.thLetGo(T, 'tired'); this.thSet(T, 'drop', HUNT.drop); return; }
    const d = this.thDenPt(T), stand = d.a - (T.face * G.mouthX) / T.r, da = wrap(d.a - T.a);
    if (Math.abs(da) * T.r < G.mouthX + 0.05 && Math.sign(da) === T.face) { this.thSet(T, 'stash', HUNT.stash); return; }
    this.thToward(T, Math.abs(da) * T.r < 1 ? stand : d.a, this.thSpeed(T, HUNT.carry) * (this.mode === 'hard' ? 1.12 : 1), dt);
  },
  // a let-go spot that is not right on a thorn of the floor (where it rolls from there is the player's job)
  thSafeDrop(T) {
    const ring = this.rings[T.ch], m = T.ai === 'roll' ? this.rollEggPt(T) : this.thMouth(T), a = Math.atan2(m.y, m.x);
    for (const th of ring.thorns) {
      if (!th.alive || th.side === 'out') continue;
      if (Math.abs(wrap(ring.body.getAngle() + th.a - a)) * T.r < 0.8) return false;
    }
    return true;
  },
  thStash(T) {
    const e = T.eid ? this.eggs.find((q) => q.id === T.eid) : null, O = this.thOwner(T);
    T.eid = 0;
    if (!e || !e.alive) return;
    const d = this.thDenPt(T);
    if (O.eat) { // a rat hole: the egg is gone
      e.thf = 0;
      this.breakEgg(e, 'thief');
      this.emit('thiefStash', { kind: T.kind, x: d.x, y: d.y, egg: e, lost: 1, n: 0 });
      return;
    }
    e.thf = 2;
    O.stash.push(e.id);
    this.emit('thiefStash', { kind: T.kind, x: d.x, y: d.y, egg: e, lost: 0, n: O.stash.length });
  },
  // a level thief runs to its den and hides for a while
  thGoHome(T) { T.tgt = 0; this.thSet(T, 'home', 6); T.r = this.thFloor(T.ch); },
  thHomeStep(T, dt) {
    if (T.ch !== this.thOwner(T).run) { // a hunter in the inner channel hops out first
      this.huntInner(T, dt); if (T.ph === 'trapped') { T.t = 0.6; T.esc = 1; } if (T.ph !== 'home' && T.ph !== 'leap') this.thSet(T, 'home', 6); return;
    }
    const d = this.thDenPt(T);
    T.r = this.thFloor(T.ch);
    const left = this.thToward(T, d.a, T.ai === 'hunt' ? HUNT.speed * 1.4 : ROLL.flee, dt);
    if (left < 0.05 || (T.t -= dt) <= 0) {
      this.thSet(T, 'hide', T.ai === 'hunt' ? this.thM(HUNT.away) : (T.k === 'scare' ? this.thM(ROLL.scare) : this.thM(ROLL.next) + 2));
      T.k = '';
      this.emit('thiefHide', { kind: T.kind, x: d.x, y: d.y });
    }
  },

  // ================================================================== the roller (rat)
  // where the egg sits while it rolls it: on the floor, just ahead of its nose; it turns as it rolls
  rollEggPt(T) {
    const G = RIG.rat, r = T.r - EGG_W / 2 - 0.01, a = T.a + (T.face * (G.mouthX + EGG_W / 2 - 0.02)) / Math.max(0.5, r);
    return { x: r * Math.cos(a), y: r * Math.sin(a), a, ang: -T.face * T.roll / (EGG_W / 2) + a };
  },
  rollStep(T, dt) {
    T.r = this.thFloor(T.run); T.ch = T.run;
    switch (T.ph) {
      case 'in': if ((T.t -= dt) <= 0) this.thSet(T, 'prowl'); break;
      case 'prowl': case 'idle': this.rollProwl(T, dt); break;
      case 'brace': this.rollBrace(T, dt); break;
      case 'push': this.rollPush(T, dt); break;
      case 'stash': if ((T.t -= dt) <= 0) { this.thStash(T); this.thSet(T, 'laugh', 0.8); } break;
      case 'cross': case 'laugh': case 'drop': if ((T.t -= dt) <= 0) { T.next = Math.max(T.next, this.thM(ROLL.next)); this.thSet(T, 'prowl'); } break;
      case 'hurt': if ((T.t -= dt) <= 0) this.thSet(T, 'stunned', ROLL.stunned); break;
      case 'stunned': if ((T.t -= dt) <= 0) { T.next = Math.max(T.next, 1.5); this.thSet(T, 'prowl'); } break;
      case 'home': this.thHomeStep(T, dt); break;
      case 'flee': this.thWalk(T, ROLL.flee * dt); T.alpha = clamp(T.t / 0.6, 0, 1); if ((T.t -= dt) <= 0) { T.ph = 'gone'; T.alpha = 0; } break;
    }
    if (ROLL_ON.has(T.ph) || T.ph === 'brace' || T.ph === 'push') this.rollScare(T);
  },
  // light and water: a water orb or a water egg near it sends it home
  rollScare(T) {
    const c = this.thBody(T);
    for (const o of this.orbs) if (o.alive && o.type === 'water' && Math.hypot(o.x - c.x, o.y - c.y) < ROLL.wet) { this.rollFright(T, 'water'); return; }
    for (const e of this.aliveEggs()) {
      if (!(e.water > 0) || !e.body.isActive()) continue;
      const p = e.body.getPosition();
      if (Math.hypot(p.x - c.x, p.y - c.y) < ROLL.wet) { this.rollFright(T, 'water'); return; }
    }
  },
  rollFright(T, why) {
    if (!this.thLive(T) || T.ph === 'home') return;
    this.thLetGo(T, 'scare');
    T.k = 'scare'; T.tgt = 0;
    this.thSet(T, 'home', 6);
    this.emit('thiefScared', { kind: T.kind, why, ...this.thBody(T) });
  },
  rollProwl(T, dt) {
    const R = T.r, d0 = this.thDenPt(T);
    let plan = null;
    if (T.next <= 0) for (const e of this.thEggsAt(T, T.run)) {
      const p = e.body.getPosition(), ea = Math.atan2(p.y, p.x), d = Math.abs(wrap(ea - T.a)) * R;
      if (d > ROLL.far || Math.hypot(p.x, p.y) < R - 0.6) continue; // only eggs resting on its floor
      const toDen = wrap(d0.a - ea);
      if (Math.abs(toDen) * R < 0.35) continue; // already at the hole: it would just drop in
      if (!plan || d < plan.d) plan = { e, d, ea, dir: toDen > 0 ? 1 : -1 };
    }
    if (!plan) { // nothing to roll: sniff about near the bottom, out of step with its partner
      T.tgt = 0;
      const home = -Math.PI / 2 + (T.slot % 2 ? 0.45 : -0.45) + 0.5 * Math.sin(this.t * 0.23 + T.slot * 2.3);
      const left = this.thToward(T, home, ROLL.speed * 0.5, dt);
      T.ph = left < 0.05 ? 'idle' : 'prowl';
      return;
    }
    T.tgt = plan.e.id;
    // stand behind the egg (the side away from the hole), nose to the shell, facing the hole
    const G = RIG.rat, stand = plan.ea - (plan.dir * (G.mouthX + EGG_W / 2)) / R, left = Math.abs(wrap(stand - T.a)) * R;
    if (left < 0.06) { T.face = plan.dir; this.thSet(T, 'brace', this.thM(ROLL.brace)); this.emit('thiefWarn', { kind: T.kind, k: 'roll', ...this.thBody(T) }); return; }
    // walk round to that side: a rat on the wrong side walks past the egg (over it, nimbly)
    this.thToward(T, stand, ROLL.speed, dt);
    T.ph = 'prowl';
  },
  rollBrace(T, dt) {
    const e = this.eggs.find((q) => q.id === T.tgt), d0 = this.thDenPt(T);
    if (!e || !this.thCan(T, e) || this.channelOf(e) !== T.run) { T.next = 0.6; T.tgt = 0; this.thSet(T, 'prowl'); return; }
    if (Math.sign(wrap(d0.a - T.a)) !== T.face) { T.next = 0.3; this.thSet(T, 'prowl'); return; } // the hole turned behind it
    if ((T.t -= dt) > 0) return;
    if (this.warpStrike?.('thief', T)) return; // v3.4: a warp gate swallows it as it starts to roll
    const p = e.body.getPosition(), ea = Math.atan2(p.y, p.x);
    if (Math.abs(wrap(ea - (T.a + (T.face * (RIG.rat.mouthX + EGG_W / 2)) / T.r))) * T.r > 0.3) { T.next = 0.2; this.thSet(T, 'prowl'); return; } // it rolled away
    this.thTake(T, e);
    T.roll = 0;
    this.thSet(T, 'push', 0);
    this.emit('thiefRoll', { kind: T.kind, x: p.x, y: p.y });
  },
  rollPush(T, dt) {
    const e = T.eid && this.eggs.find((q) => q.id === T.eid);
    if (!e || !e.alive) { T.eid = 0; this.thSet(T, 'prowl'); return; }
    T.hold += dt;
    const d0 = this.thDenPt(T), da = wrap(d0.a - T.a), q = this.rollEggPt(T);
    // the floor ring slid a gap under the egg: it drops through (the rat did the player's work)
    const ring = this.rings[T.run], ra = ring.body.getAngle();
    for (const g of ring.gaps) {
      if ((g.shut && g.o < 0.5) || !this.gapOpenFor(g, e)) continue;
      if (Math.abs(wrap(ra + g.a - q.a)) * ring.r < g.len / 2 - EGG_W * 0.3) {
        T.eid = 0;
        e.body.setTransform({ x: q.x, y: q.y }, q.ang);
        this.thFree(e, 'gap', 1.2);
        this.thSet(T, 'cross', ROLL.cross);
        this.emit('thiefGap', { kind: T.kind, x: q.x, y: q.y, egg: e });
        return;
      }
    }
    if (Math.sign(da) !== T.face) { this.thLetGo(T, 'turned'); this.thSet(T, 'drop', 0.5); return; } // the hole slid behind it
    const lim = this.thM(ROLL.hold);
    if (lim && T.hold >= lim && this.thSafeDrop(T)) { this.thLetGo(T, 'tired'); this.thSet(T, 'drop', 0.6); return; }
    // a floor thorn ahead: it will not roll the egg onto it
    for (const th of ring.thorns) {
      if (!th.alive || th.side === 'out') continue;
      const ta = wrap(ra + th.a - q.a) * T.face;
      if (ta > 0 && ta * T.r < 0.3) { this.thLetGo(T, 'thorn'); this.thSet(T, 'drop', 0.6); return; }
    }
    if (Math.abs(da) * T.r < RIG.rat.mouthX + EGG_W / 2 + 0.05) { this.thSet(T, 'stash', ROLL.stash); return; }
    const v = this.thM(ROLL.push) * dt;
    this.thWalk(T, v); T.roll += v;
  },

  // ---------- the boss's throws come from its mouth; it only throws while it is free to
  thiefCanThrow() { const T = this.thiefBoss(); return !!T && HUNT_ON.has(T.ph) && !(T.frozen > 0) && !T.eid; },
  thiefToss(dur) { const T = this.thiefBoss(); if (T) this.thSet(T, 'toss', dur); },
  thiefBossPose(B) { const T = this.thiefBoss(), m = this.thMouth(T); B.x = m.x; B.y = m.y; B.face = T.face; },

  // ---------- hazards (boss.js animalsHit), the glow flash, powers (powers2.js p2All)
  // kind: gust rock lava ice bolt quake flash; trapped = a hit; otherwise a daze. Returns how many it reached.
  thiefHit(kind, o = {}) {
    let n = 0;
    for (const T of this.thieves || []) {
      if (!this.thLive(T) || T.ph === 'in') continue;
      const b = this.thBody(T), r = o.r ?? Infinity;
      if (r < Infinity && Math.hypot(b.x - (o.x ?? 0), b.y - (o.y ?? 0)) > r + 0.4) continue;
      n++;
      if (kind === 'gust') continue;
      if (T.ph === 'trapped') { this.thHurt(T, kind, o); continue; }
      if (kind === 'flash' && T.ai === 'roll') { this.rollFright(T, 'light'); continue; }
      if (kind === 'water' && T.ai === 'roll') { this.rollFright(T, 'water'); continue; }
      if (kind === 'bolt') T.zap = 0.3;
      this.thDaze(T, kind === 'bolt' ? 2 : kind === 'quake' ? 1 : 1.2, kind);
    }
    return n;
  },
  thDaze(T, dur, why) {
    if (['leap', 'hurt', 'warp', 'home', 'hide', 'wait', 'gone', 'defeated', 'flee'].includes(T.ph)) return;
    this.thLetGo(T, 'daze');
    if (T.ph === 'trapped') return;
    if (T.ai === 'hunt') T.ch = T.r < this.thFloor(T.run) - 0.3 ? T.run - 1 : T.run;
    this.thSet(T, 'stunned', dur);
    this.emit('thiefDaze', { kind: T.kind, why, ...this.thBody(T) });
  },
  thiefP2(kind, Tm) { for (const T of this.thieves || []) if (this.thLive(T)) this.thiefP2Only(T, kind, Tm); },
  thiefP2Only(T, kind, Tm) {
    const b = this.thBody(T);
    if (T.ph === 'trapped' && kind !== 'pepper' && kind !== 'scare') { this.thHurt(T, kind, b); if (kind === 'ice') T.frozen = Math.min(Tm, 3); return; }
    if (kind === 'ice') { this.thLetGo(T, 'daze'); T.frozen = Tm; if (T.ph === 'crouch' || T.ph === 'toss' || T.ph === 'brace') this.thSet(T, 'prowl'); this.emit('thiefFreeze', { kind: T.kind, ...b, t: Tm }); return; }
    if (kind === 'bolt' || kind === 'zap') { T.zap = 0.3; this.thDaze(T, Math.min(Tm, 3), kind); return; }
    if ((kind === 'pepper' || kind === 'scare' || kind === 'out') && !T.boss) { this.thLetGo(T, 'daze'); T.k = 'scare'; T.tgt = 0; this.thSet(T, 'home', 6); return; }
    this.thDaze(T, kind === 'spin' || kind === 'out' ? 1.5 : 1.2, kind);
    T.next = Math.max(T.next, kind === 'pepper' || kind === 'scare' ? Tm : 2);
  },
  // the live ring (shock power) zaps a thief standing on it
  thiefShock(ri, Tm) { for (const T of this.thieves || []) if (this.thLive(T) && T.ch === ri && T.ph !== 'leap' && T.ph !== 'stunned' && T.ph !== 'home' && !(T.hitCD > 0)) { T.hitCD = 1; T.zap = 0.3; this.thDaze(T, Math.min(Tm, 2.5), 'zap'); } },
  // an ally knocks a thief out of the way: it lets go and runs home
  thiefKnock(T) { if (!this.thLive(T)) return; this.thLetGo(T, 'daze'); T.k = 'scare'; if (T.boss) this.thSet(T, 'stunned', 2.5); else this.thSet(T, 'home', 6); },

  // ---------- the warp gate (sim/warp.js): it is swallowed as it springs and spat out on the far side of its run
  warpThief(W, T) {
    const b = this.thBody(T), far = wrap(T.a + Math.PI * 0.8 * (T.a > -Math.PI / 2 ? -1 : 1));
    if (T.boss) { // a boss resists: the pounce is cancelled and it reels
      T.next = Math.max(T.next, 3); this.thSet(T, 'stunned', 1.2);
      this.warpGate('in', b.x, b.y, 0.6, 0, 1.0, { pull: 0 });
      this.emit('warpOpen', { x: b.x, y: b.y, r: 0.6, kind: 'boss' }); this.emit('warpResist', { x: b.x, y: b.y });
      return true;
    }
    this.thLetGo(T, 'daze');
    T.wx = wrap(far - this.rings[T.run].body.getAngle()); T.warp = 0; T.tgt = 0;
    this.thSet(T, 'warp', 0);
    const r = this.thFloor(T.run) - 0.2;
    this.warpGate('in', b.x, b.y, 0.55, 0, WARP_T + 1.2, { pull: 1 });
    this.warpGate('out', r * Math.cos(far), r * Math.sin(far), 0.45, WARP_T * 0.5, WARP_T, {});
    this.emit('warpOpen', { x: b.x, y: b.y, r: 0.55, kind: 't' });
    return true;
  },
  thWarpStep(T, dt) {
    T.warp += dt;
    if (T.warp >= WARP_T * 0.5 && !T.wy) { // spat out on the far side, dazed
      T.wy = 1; T.ch = T.run; T.r = this.thFloor(T.run);
      T.a = wrap(this.rings[T.run].body.getAngle() + T.wx); T.carA = this.rings[T.run].body.getAngle();
      this.emit('warpOut', { x: T.r * Math.cos(T.a), y: T.r * Math.sin(T.a), kind: 't' });
    }
    if (T.warp >= WARP_T) { T.wy = 0; T.warp = 0; T.next = Math.max(T.next, 3 * (this.p2M?.up || 1)); this.thSet(T, 'stunned', 2.5); }
  },

  // ---------- the level is decided: they run off on a win, laugh on a loss
  thEnd(T, dt) {
    if (T.ph === 'gone' || T.ph === 'hide') return;
    const win = this.state === 'winning' || this.state === 'won';
    if (T.ph === 'wait') { T.ph = win ? 'gone' : 'hide'; return; } // never came out: it stays in its den (a boss is not 'defeated')
    if (win && T.ph !== 'defeated' && T.ph !== 'flee') { this.thLetGo(T, 'end'); this.thSet(T, T.boss ? 'defeated' : 'flee', T.boss ? 1.2 : 1.4); }
    else if (!win && T.ph !== 'laugh') { this.thLetGo(T, 'end'); this.thSet(T, 'laugh', 99); }
    if (T.ph === 'defeated' && (T.t -= dt) <= 0) this.thSet(T, 'flee', 1.2);
    else if (T.ph === 'flee') { this.thWalk(T, (T.ai === 'hunt' ? HUNT.flee : ROLL.flee) * dt); T.alpha = clamp(T.t / 0.6, 0, 1); if ((T.t -= dt) <= 0) { T.ph = 'gone'; T.alpha = 0; } }
  },

  // ---------- planner / danger: 1 = held or stashed, 0.8 = about to be taken, less = near one
  thiefScore() {
    let v = 0;
    for (const T of this.thieves || []) if (T.boss) v += 500 * (T.hpMax - T.hp) + (T.ph === 'trapped' ? 250 : 0);
    return v;
  },
  thiefThreat(e) {
    let v = 0;
    for (const T of this.thieves || []) v = Math.max(v, this.thThreat1(T, e));
    return v;
  },
  thThreat1(T, e) {
    if (e.thf) return T.eid === e.id || T.stash.includes(e.id) ? (T.ai === 'roll' ? 0.85 : 1) : 0;
    if (!this.thLive(T)) return 0;
    if (T.tgt === e.id && (T.ph === 'crouch' || T.ph === 'leap' || T.ph === 'brace')) return T.ai === 'roll' ? 0.5 : 0.8;
    if (!(T.ai === 'hunt' ? HUNT_ON : ROLL_ON).has(T.ph) || T.frozen > 0) return 0;
    const c = this.channelOf(e);
    if (c !== T.run && !(T.ai === 'hunt' && c === T.run - 1)) return 0;
    const p = e.body.getPosition(), d = Math.abs(wrap(Math.atan2(p.y, p.x) - T.a)) * T.r;
    return d < 2 ? (c === T.run ? (T.ai === 'roll' ? 0.3 : 0.5) : 0.25) * (1 - d / 2) : 0;
  },

  // ---------- state
  thiefState() { return (this.thieves || []).map((T) => ({ ...T, stash: [...T.stash] })); },
  thiefLoad(S) {
    if (!S) return;
    this.thieves = S.map((T) => ({ ...T, stash: [...T.stash] }));
    for (const e of this.eggs) if (e.thf && e.body) e.body.setActive(false); // held or stashed: out of the physics world
  },
};
const WARP_T = 1.1; // s: swallowed, then spat out
