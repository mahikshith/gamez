// Sea creatures (v3.3 M8, Coral Reef): the octopus and fish schools. Mixed into Sim (sim.js: Object.assign(Sim.prototype,
// seaMethods)), so `this` is the Sim. No imports from sim.js (it imports this file). Every field is plain data in
// this.octos and this.schools (and egg.octo, in EGG_KEYS), copied by seaState() / restored by seaLoad(), so rewind
// and the planner stay exact. Randomness comes from the sim's own rng.
//
// level.octopus {ch, a, delay} (or an array): ch = the channel it lives in (1 .. rings-1), a = start angle (deg, 90 = top).
//   It floats in the middle of its channel, suckers on the wall under it: turning that ring carries it round.
//   It drifts toward the nearest egg in its channel, flushes a warning colour (WARN x the mode's PRED.warn), wraps the
//   egg in three arms and HOLDS it: a held egg is out of the physics world (no thorn, snake bite, eagle or fall can
//   touch it). Holding, it creeps toward the inner rings through any gap that lines up with it (the egg goes with it
//   while the fuse runs). Water (a water orb or a water egg), a zap (a thunder egg, a zapped wall, lightning) or a
//   glow chick flash (dash chick, rocks, ice too) makes it let go: it flinches, jets off in an ink cloud, rests, and
//   swims back to its home channel before it hunts again. Easy: it lets go by itself after 6 s, Medium 10 s,
//   Hard 14 s. It never takes a chick, a burning egg or a stone egg.
// Villain (v3.5): it HUNTS. Awake, it chases an egg in any channel within OCT.mode.range (Hard: the whole vault),
//   climbing through gaps. A red flush and arms rising (warn) telegraph the grab; from 1.1-3.2 m away it may instead
//   SQUIRT INK (telegraph 'squirt', then a cloud blacks out the ring sector round the egg for mode.ink s, and it
//   swims 1.4x faster inside it). After letting an egg go it will not take THAT egg again for mode.cd s (C.ban).
//   Easy: shorter, smaller ink and a longer cooldown, slower swimming, hunts the next channel only.
//   level.octopus {den: true}: it lives in a den (a puddle on the floor of channel `ch`, drawn on that ring and carried by
//   it). Idle it lurks sunk in the den (phase 'lurk'), wakes when an egg comes within mode.wake, hunts, and goes
//   back to the den to rest. Without a den it just floats in the channel (the reef).
//   FROZEN (C.fz s) and STUNNED (C.stn s, C.zp = the 0.3 s zap flash before it): seaFreeze / seaStun, called by
//   p2All (frost nova, thunderclap, shock) and by allies. A zap or glow flash (octHit) now ends in a stun, not a jet.
// level.fish {ch, n, speed, a, dir, turn} (or an array): n fish (6-10) swim round channel ch in a loose school at
//   speed m/s (dir +1 = counter-clockwise), turning round every `turn` s (0 = never). Eggs they swim through are
//   pushed along like a current. An egg dropping onto them, or a creature lunging near them, scatters them: no
//   push for SCATTER_T, then they regroup.
import { RING_TH, TAU, wrap, clamp } from './geom.js';

export const OCT = {
  reach: 0.75, grab: 1.0, // m (egg centre to the octopus): starts its grab / still gets the egg
  seek: 0.55, drift: 0.16, carry: 0.3, home: 0.5, // m/s
  hunt: 0.8, squirt: 0.8, rise: 0.6, // m/s toward prey in another channel; s: ink telegraph, rising from the den
  warn: 1.0, grab_t: 0.4, let: 0.5, jet: 0.9, jetV: 3.2, rest: 3.5, in: 0.7, // s (jetV m/s)
  // per difficulty: range = channels away it hunts, speed x, ink = cloud s (inkR m radius, inkCd s between squirts),
  // cd = s it will not retake the egg it let go, wake = [channels, m] a lurking one wakes within, stun = s dazed after a zap
  mode: {
    easy: { range: 1, speed: 0.8, ink: 1.2, inkR: 0.75, inkCd: 12, cd: 14, wake: [0, 2.2], stun: 2.8 },
    medium: { range: 2, speed: 1, ink: 2, inkR: 0.95, inkCd: 9, cd: 9, wake: [1, 3.4], stun: 2.2 },
    hard: { range: 9, speed: 1.2, ink: 2.6, inkR: 1.1, inkCd: 7, cd: 6, wake: [2, 5], stun: 1.6 },
  },
  hold: { easy: 6, medium: 10, hard: 14 }, // s it holds an egg before letting go by itself (0 = until freed; Hard used to never, and the planner could not win)
  wet: 0.8, // m: a water orb or water egg this close frees it
  lift: 0.62, eggOff: 0.3, // m: its centre above the wall it grips; the held egg sits this far below its centre (clutched at its chest)
};
export const FISH = {
  len: 0.34, r: 0.44, // m: fish length, push reach around a fish
  speed: 1.1, turn: 12, scatter: 3, regroup: 1.2, flee: 2.4, // m/s, s
  push: 10, maxA: 16, lift: 0.3, // current: 1/s toward the fishes' speed, capped at maxA m/s^2; lift x of it off the floor
  drop: 2.4, // an egg this fast landing among them scatters them
  mode: { easy: { push: 0.8, scatter: 1.2 }, medium: { push: 1, scatter: 1 }, hard: { push: 1.1, scatter: 0.85 } },
};
const deg = (d) => (d * Math.PI) / 180;
const LIVE = new Set(['drift', 'seek', 'warn', 'grab', 'squirt', 'carry', 'home', 'lurk', 'rise']); // phases that react to hits

export const seaMethods = {
  // ---------- build
  seaInit(L) {
    this.octos = [];
    this.schools = [];
    const n = this.rings.length;
    if (n < 2) return;
    const list = (v) => (!v ? [] : Array.isArray(v) ? v : [v]);
    list(L.octopus).forEach((P, i) => {
      const ch = clamp(P.ch ?? 1, 1, n - 1);
      this.octos.push({
        id: i, home: ch, ch, a: deg(P.a ?? -90), rad: this.octR(ch), ph: 'wait', t: P.delay ?? 2, dur: 1,
        car: ch, carA: this.rings[ch].body.getAngle(), eid: 0, tgt: 0, hold: 0, hit: '', jd: 1, vx: 0, vy: 0,
        cross: -1, inkX: 0, inkY: 0, inkT: 9, rest: 0,
        den: P.den ? 1 : 0, dnA: wrap(deg(P.a ?? -90) - this.rings[ch].body.getAngle()), // ring-local angle of its den on ring `ch`
        ban: 0, banT: 0, inkCd: 3, sqT: 9, sqX: 0, sqY: 0, sqR: 0, sqD: 0, // retake cooldown, the squirt's ink cloud (age, centre, radius, length)
        fz: 0, fzMax: 0, stn: 0, stnMax: 0, zp: 0,
      });
    });
    list(L.fish).forEach((P, i) => {
      const ch = clamp(P.ch ?? 1, 1, n - 1), m = clamp(P.n ?? 8, 3, 12), a = deg(P.a ?? 90), mid = this.seaMid(ch);
      const S = { id: i, ch, speed: P.speed || FISH.speed, dir: P.dir === -1 ? -1 : 1, a, ph: 'swim', t: 0, seen: 0, every: P.turn ?? FISH.turn, turnT: 0, push: 1, sx: 0, sy: 0, fz: 0, sn: 0, zp: 0, f: [] };
      S.turnT = S.every ? S.every * (0.6 + 0.4 * this.rand()) : 0;
      const half = Math.min(0.32, (this.rings[ch].r - this.rings[ch - 1].r - RING_TH) / 2 - 0.1);
      for (let j = 0; j < m; j++) {
        const ox = (this.rand() - 0.5) * 0.9 + (j - (m - 1) / 2) * 0.05, or = (this.rand() * 2 - 1) * half * 0.8;
        S.f.push({ ox, or, a: a + ox / mid, r: mid + or, va: S.dir * S.speed, vr: 0, d: S.dir, w: this.rand() * TAU, lag: (j / m) * 0.45 });
      }
      this.schools.push(S);
    });
  },

  // ---------- geometry
  seaMid(c) { return (this.rings[c - 1].r + this.rings[c].r) / 2; },
  octR(c) { return Math.max(this.rings[c - 1].r + RING_TH / 2 + 0.34, this.rings[c].r - RING_TH / 2 - OCT.lift); },
  octXY(C) { return { x: C.rad * Math.cos(C.a), y: C.rad * Math.sin(C.a) }; },
  octEgg(C) { return C.eid ? this.eggs.find((e) => e.id === C.eid && e.alive && !e.saved && e.body) || null : null; },

  // ---------- every step (predStep). end: the level is decided
  seaStep(dt, end) {
    if (this.octos.length) for (const C of this.octos) this.octOne(C, dt, end);
    if (this.schools.length) for (const S of this.schools) this.fishOne(S, dt, end);
  },

  // ======================================================================== octopus
  octM() { return OCT.mode[this.mode] || OCT.mode.medium; },
  // swim speed factor: the mode's, and 1.4x inside its own ink cloud
  octSpd(C) { const M = this.octM(); return M.speed * (C.sqT < M.ink ? 1.4 : 1); },

  octOne(C, dt, end) {
    const M = this.octM();
    if (C.inkT < 9) C.inkT += dt;
    if (C.sqT < 9) C.sqT += dt;
    if (C.banT > 0 && (C.banT -= dt) <= 0) C.ban = 0;
    if (C.inkCd > 0) C.inkCd -= dt;
    if (C.ph === 'wait') { if (!end && (C.t -= dt) <= 0) { C.ph = 'in'; C.t = C.dur = OCT.in; this.emit('octIn', { ...this.octXY(C), id: C.id, den: C.den }); } return; }
    const x0 = C.rad * Math.cos(C.a), y0 = C.rad * Math.sin(C.a);
    this.octCarry(C);
    const egg = this.octEgg(C);
    if (C.eid && !egg) { C.eid = 0; if (C.ph === 'carry') this.octSet(C, 'rest', OCT.rest); } // the egg it held is gone (the fuse)
    if (end && C.eid) this.octLetGo(C, 'end');
    // frozen: nothing moves but the ring under it; stunned: slack, then it comes to
    const frozen = C.fz > 0, dazed = !frozen && (C.stn > 0 || C.zp > 0);
    if (frozen) { C.fz -= dt; if (C.fz <= 0) { C.fz = 0; this.emit('octThaw', { ...this.octXY(C), id: C.id }); } }
    else if (C.zp > 0) C.zp -= dt;
    else if (C.stn > 0 && (C.stn -= dt) <= 0) { C.stn = 0; this.octSet(C, 'rest', OCT.rest * 0.5); }
    if (!frozen && !dazed) {
      if (!end && LIVE.has(C.ph)) this.octFreed(C);
      this.octPhase(C, dt, end, M);
    }
    C.ch = clamp(this.chAt(C.rad), 1, this.rings.length - 1);
    if (dt > 0) { const x1 = C.rad * Math.cos(C.a), y1 = C.rad * Math.sin(C.a); C.vx = (x1 - x0) / dt; C.vy = (y1 - y0) / dt; }
    const h = this.octEgg(C);
    if (h) this.octHoldEgg(C, h, dt);
  },

  octPhase(C, dt, end, M) {
    switch (C.ph) {
      case 'in': if ((C.t -= dt) <= 0) this.octSet(C, C.den ? 'lurk' : 'drift'); break;
      case 'lurk': { // sunk in its den: only the eyes show. It wakes when an egg comes near
        C.a = wrap(C.a);
        const e = end ? null : this.octPrey(C, M.wake[0], M.wake[1]);
        if (e) { C.tgt = e.id; this.octSet(C, 'rise', OCT.rise); C.tgt = e.id; this.emit('octRise', { ...this.octXY(C), id: C.id, egg: e.id }); }
        break;
      }
      case 'rise': if ((C.t -= dt) <= 0) this.octSet(C, 'seek'); break;
      case 'drift': case 'seek': {
        if (C.cross >= 0) { this.octClimb(C, C.ch, OCT.hunt * this.octSpd(C), dt); break; } // finish the gap it is in
        const e = end ? null : this.octPrey(C, M.range);
        C.tgt = e ? e.id : 0;
        if (C.ph === 'drift' && e) C.ph = 'seek';
        if (C.ph === 'seek' && !e) C.ph = 'drift';
        if (e) {
          const p = e.body.getPosition(), ec = this.channelOf(e), c = this.chAt(C.rad), v = this.octSpd(C);
          if (ec !== c) { this.octClimb(C, ec, OCT.hunt * v, dt); break; } // across channels, through the gaps
          this.octSwim(C, Math.atan2(p.y, p.x), OCT.seek * v, dt);
          const d = Math.hypot(p.x - C.rad * Math.cos(C.a), p.y - C.rad * Math.sin(C.a));
          if (d < OCT.reach) { this.octSet(C, 'warn', OCT.warn * this.PM.warn); this.emit('octWarn', { ...this.octXY(C), id: C.id, egg: e.id }); }
          else if (M.ink && C.inkCd <= 0 && C.sqT >= M.ink && d > 1.1 && d < 3.2) { this.octSet(C, 'squirt', OCT.squirt * this.PM.warn); C.tgt = e.id; this.emit('octSquirt', { ...this.octXY(C), id: C.id, egg: e.id }); }
        } else if (C.den) this.octSet(C, 'home');
        else this.octSwim(C, C.a + 0.8 * Math.sin(this.t * 0.23 + C.id * 2.1), OCT.drift, dt); // idle: a slow wander
        break;
      }
      case 'squirt': { // eyes locked, arms up, mantle swelling: then the cloud
        const e = this.eggs.find((q) => q.id === C.tgt);
        if (!(e && this.octFit(e, C) && this.channelOf(e) === this.chAt(C.rad))) { this.octSet(C, 'seek'); break; }
        const p = e.body.getPosition();
        C.sqX = p.x; C.sqY = p.y;
        this.octSwim(C, Math.atan2(p.y, p.x), 0.2, dt);
        if ((C.t -= dt) > 0) break;
        C.sqT = 0; C.sqR = M.inkR; C.sqD = M.ink; C.inkCd = M.inkCd;
        this.emit('octInk', { x: C.sqX, y: C.sqY, id: C.id, r: C.sqR, from: this.octXY(C) });
        this.octSet(C, 'seek', 0);
        break;
      }
      case 'warn': case 'grab': {
        const e = this.eggs.find((q) => q.id === C.tgt);
        const ok = e && this.octCan(e, C), p = ok && e.body.getPosition(), d = ok ? Math.hypot(p.x - C.rad * Math.cos(C.a), p.y - C.rad * Math.sin(C.a)) : 9;
        if (!ok || d > OCT.grab + 0.25) { this.octSet(C, 'seek'); break; }
        this.octSwim(C, Math.atan2(p.y, p.x), 0.25, dt);
        if ((C.t -= dt) > 0) break;
        if (C.ph === 'warn') { if (this.warpStrike('oct', C)) break; this.octSet(C, 'grab', OCT.grab_t); break; } // v3.4: a warp gate takes the grab
        if (d < OCT.grab) this.octTake(C, e); else this.octSet(C, 'seek');
        break;
      }
      case 'carry': {
        C.hold += dt;
        const lim = OCT.hold[this.mode] || 0;
        if (lim && C.hold >= lim && !this.octOverThorns(C)) { this.octLetGo(C, 'tired'); break; } // never drops it onto thorns by itself
        this.octClimb(C, Math.max(1, this.chAt(C.rad) - 1), OCT.carry, dt); // inward, a channel at a time
        break;
      }
      case 'let':
        if ((C.t -= dt) <= 0) {
          if (C.hit === 'zap' || C.hit === 'flash') { this.octStun(C, M.stun, 0); break; } // dazed in place, not a getaway
          this.octSet(C, 'jet', OCT.jet); C.inkX = C.rad * Math.cos(C.a); C.inkY = C.rad * Math.sin(C.a); C.inkT = 0; this.emit('octJet', { x: C.inkX, y: C.inkY, id: C.id, kind: C.hit });
        }
        break;
      case 'jet': {
        const k = clamp(C.t / C.dur, 0, 1), v = OCT.jetV * k * k;
        this.octSwim(C, C.a + C.jd * 2, v, dt, true);
        if ((C.t -= dt) <= 0) this.octSet(C, 'rest', OCT.rest);
        break;
      }
      case 'rest':
        this.octSwim(C, C.a + 0.6 * Math.sin(this.t * 0.31 + C.id), OCT.drift * 0.6, dt);
        if (!end && (C.t -= dt) <= 0) this.octSet(C, !C.den && this.chAt(C.rad) === C.home && C.cross < 0 ? 'drift' : 'home');
        break;
      case 'home': {
        const e = end ? null : this.octPrey(C, M.range); // a new egg turns it round (never the one it just let go)
        if (e) { C.tgt = e.id; C.ph = 'seek'; break; }
        if (C.cross < 0 && this.chAt(C.rad) === C.home) {
          if (!C.den) { this.octSet(C, 'drift'); break; }
          const goal = this.rings[C.home].body.getAngle() + C.dnA; // back to the den, then sink into it
          this.octSwim(C, goal, OCT.home * M.speed, dt);
          if (Math.abs(wrap(goal - C.a)) * C.rad < 0.1) this.octSet(C, 'lurk');
          break;
        }
        this.octClimb(C, C.home, OCT.home * M.speed, dt);
        break;
      }
    }
  },

  octSet(C, ph, t = 0) { C.ph = ph; C.t = C.dur = t; if (ph !== 'warn' && ph !== 'grab') C.tgt = ph === 'seek' ? C.tgt : 0; },

  // an egg it may take: in the vault, free (not a chick, burning, stone, or held by anything), not the one it just let go
  octFit(e, C) {
    if (!e.alive || e.saved || !e.body || !e.body.isActive() || e.octo || e.chick || e.fire > 0 || e.stone > 0 || (C.ban === e.id && C.banT > 0)) return false;
    const c = this.channelOf(e);
    return c >= 1 && c < this.rings.length;
  },
  octCan(e, C) { return this.octFit(e, C) && this.channelOf(e) === this.chAt(C.rad); }, // ...and in its own channel: it can grab it
  // the egg it hunts: the nearest in its channel, else in a channel up to `range` away (m: farther along the ring than this is out of sight)
  octPrey(C, range = 1, far = 1e9) {
    if (C.cross >= 0 && C.ph !== 'lurk') return null;
    const c = this.chAt(C.rad);
    let best = null, bd = 1e9;
    for (const e of this.aliveEggs()) {
      if (!this.octFit(e, C) || this.octos.some((o) => o !== C && o.tgt === e.id)) continue;
      const ec = this.channelOf(e), dc = Math.abs(ec - c);
      if (dc > range) continue;
      const p = e.body.getPosition(), da = Math.abs(wrap(Math.atan2(p.y, p.x) - C.a));
      if (da * C.rad > far) continue;
      const d = dc * 3 + da;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  },

  // the ring under it carries it round: the wall it grips, or the ring whose gap it is squeezing through
  octCarry(C) {
    if (C.car >= 0) {
      const d = wrap(this.rings[C.car].body.getAngle() - C.carA);
      if (Math.abs(d) > 1e-9 && C.ph !== 'jet') C.a = wrap(C.a + d);
    }
    let car = -1;
    for (const ring of this.rings) if (Math.abs(C.rad - ring.r) < RING_TH / 2 + 0.25) { car = ring.i; break; }
    if (car < 0) car = clamp(this.chAt(C.rad), 0, this.rings.length - 1);
    C.car = car; C.carA = this.rings[car].body.getAngle();
  },

  // swim along its channel toward angle ga at speed v (m/s); free: no slow-down near the goal (the jet)
  octSwim(C, ga, v, dt, free = false) {
    const c = clamp(this.chAt(C.rad), 1, this.rings.length - 1), ar = Math.max(C.rad, 0.5);
    const da = wrap(ga - C.a), step = (v * dt) / ar, s = free ? step * Math.sign(da) : clamp(da, -step, step);
    let a = C.a + s;
    // never through a barrier wall in the channel (predators v3)
    if (this.octBlocked(c, C.a, a)) a = C.a;
    C.a = wrap(a);
    const r = this.octR(c);
    C.rad += clamp(r - C.rad, -0.6 * dt, 0.6 * dt);
  },
  octBlocked(c, a0, a1) {
    for (const b of this.barriers || []) {
      if (!b.alive || b.ring !== c) continue;
      const ba = this.rings[b.ring].body.getAngle() + b.a, d0 = wrap(a0 - ba), d1 = wrap(a1 - ba);
      if (Math.sign(d0) !== Math.sign(d1) && Math.abs(d0) < 0.5) return true;
    }
    return false;
  },

  // toward channel tc through gaps: along its channel to the nearest open gap in the wall on that side, then
  // through it while it lines up (the ring it squeezes through carries it, so the gap stays lined up)
  octClimb(C, tc, v, dt) {
    const n = this.rings.length, ar = Math.max(C.rad, 0.5);
    if (C.cross >= 0) { // in a gap: on through to the next channel
      const to = C.cross, r = this.octR(to);
      C.rad += clamp(r - C.rad, -v * dt, v * dt);
      if (Math.abs(C.rad - r) < 1e-3) C.cross = -1;
      return;
    }
    const c = clamp(this.chAt(C.rad), 1, n - 1);
    if (tc === c) { this.octSwim(C, C.a + 0.7 * Math.sin(this.t * 0.27 + C.id), OCT.drift, dt); return; }
    const ri = tc < c ? c - 1 : c, ring = this.rings[ri];
    if (!ring) return;
    const ra = ring.body.getAngle();
    let gap = null, gd = 1e9;
    for (const g of ring.gaps) {
      if (!this.snakeGap(g) || g.len < 0.6) continue;
      const d = Math.abs(wrap(ra + g.a - C.a));
      if (d < gd) { gd = d; gap = g; }
    }
    if (!gap) { this.octSwim(C, C.a + 0.7 * Math.sin(this.t * 0.27 + C.id), OCT.drift, dt); return; }
    const ga = ra + gap.a;
    if (Math.abs(wrap(ga - C.a)) * ar < gap.len / 2 - 0.15) { C.cross = tc < c ? c - 1 : c + 1; C.a = wrap(C.a + clamp(wrap(ga - C.a), -0.3 * dt, 0.3 * dt)); return; }
    this.octSwim(C, ga, v, dt);
  },

  octTake(C, e) {
    if (e.joint) this.unMagnet(e);
    if (e.bubbleFix) this.popBubble(e);
    e.hold = null; e.honey = 0;
    e.octo = C.id + 1;
    e.body.setActive(false);
    C.eid = e.id; C.hold = 0; C.tgt = 0;
    this.octSet(C, 'carry');
    const p = e.body.getPosition();
    this.emit('octGrab', { x: p.x, y: p.y, id: C.id, egg: e });
  },
  // the held egg rides tucked under it, lying along the channel
  octHoldEgg(C, e, dt) {
    const b = e.body, u = Math.cos(C.a), w = Math.sin(C.a), r = C.rad + OCT.eggOff;
    const x = r * u, y = r * w, a0 = b.getAngle(), want = C.a + Math.round((a0 - C.a) / Math.PI) * Math.PI;
    b.setTransform({ x, y }, a0 + clamp(want - a0, -4 * dt, 4 * dt));
    b.setLinearVelocity({ x: C.vx, y: C.vy });
    b.setAngularVelocity(0);
    e.ch = this.channelOf(e); e.freefall = 0; e.drop = 0;
  },
  // let the egg go where it is (a short safe moment so the release itself never cracks it)
  octRelease(C) {
    const e = this.octEgg(C);
    C.eid = 0;
    if (!e) return null;
    e.octo = 0;
    const b = e.body, p = b.getPosition(), c = this.chAt(Math.hypot(p.x, p.y));
    if (c >= 1 && c < this.rings.length && C.cross < 0) { // just clear of the wall it grips
      const R = this.rings[c].r - RING_TH / 2 - 0.3, d = Math.hypot(p.x, p.y);
      if (d > R) b.setTransform({ x: (p.x / d) * R, y: (p.y / d) * R }, b.getAngle());
    }
    b.setActive(true);
    b.setLinearVelocity({ x: C.vx * 0.5, y: C.vy * 0.5 });
    e.safeT = Math.max(e.safeT, 0.5);
    e.ch = this.channelOf(e); e.freefall = 0; e.drop = 0;
    return e;
  },
  // kind: water | zap | flash | dash | rock | ice | tired | end
  octLetGo(C, kind) {
    const e = this.octRelease(C), h = this.octXY(C);
    C.hit = kind; C.tgt = 0;
    if (e && kind !== 'end') { C.ban = e.id; C.banT = this.octM().cd; } // it will not come straight back for this egg
    // jet off along the channel, away from the egg (or from what hit it)
    const q = e ? e.body.getPosition() : null;
    C.jd = q ? (wrap(C.a - Math.atan2(q.y, q.x)) >= 0 ? 1 : -1) : this.rand() < 0.5 ? -1 : 1;
    C.cross = -1; // half through a gap: it eases back into whichever channel it is in
    this.octSet(C, 'let', kind === 'end' ? 0.2 : OCT.let);
    this.emit('octLetGo', { ...h, id: C.id, kind, egg: e ? e.id : 0 });
  },

  // thorns on the walls of its channel within reach of the egg under it
  octOverThorns(C) {
    if (C.cross >= 0) return false;
    const c = this.chAt(C.rad);
    for (const ring of [this.rings[c - 1], this.rings[c]]) {
      if (!ring) continue;
      const ra = ring.body.getAngle();
      for (const th of ring.thorns) if (th.alive && th.ext > 0.3 && Math.abs(wrap(ra + th.a - C.a)) * ring.r < 0.8) return true;
    }
    return false;
  },
  // what frees it: water (orb or egg), a zap (thunder egg nearby, or a zapped wall under it)
  octFreed(C) {
    const h = this.octXY(C), c = this.chAt(C.rad);
    for (const o of this.orbs) if (o.alive && o.type === 'water' && Math.hypot(o.x - h.x, o.y - h.y) < OCT.wet) return this.octHit(C, 'water');
    for (const e of this.aliveEggs()) {
      if (e.octo || !e.body || !e.body.isActive()) continue;
      const p = e.body.getPosition(), d = Math.hypot(p.x - h.x, p.y - h.y);
      if (d > OCT.wet + 0.1) continue;
      if (e.water > 0) return this.octHit(C, 'water');
      if (e.zap) { e.zap = 0; return this.octHit(C, 'zap'); }
    }
    const walls = [this.rings[c - 1], this.rings[c], C.cross >= 0 ? this.rings[C.car] : null];
    if (walls.some((r) => r && r.stun > 0)) return this.octHit(C, 'zap');
  },
  octHit(C, kind) {
    if (!LIVE.has(C.ph) || C.fz > 0 || C.stn > 0 || C.zp > 0) return false; // ice shields it; a dazed one is already out
    if (C.eid) this.octLetGo(C, kind);
    else { // not holding: it still flinches and jets off
      if (C.tgt) { C.ban = C.tgt; C.banT = this.octM().cd * 0.5; }
      C.hit = kind; C.tgt = 0; C.jd = this.rand() < 0.5 ? -1 : 1;
      C.cross = -1;
      this.octSet(C, 'let', OCT.let);
      this.emit('octLetGo', { ...this.octXY(C), id: C.id, kind, egg: 0 });
    }
    return true;
  },

  // ---------- frozen and stunned (powers2.js p2All: frost nova, thunderclap, shock; allies: crow, clash). T seconds.
  // Frozen: nothing moves (a held egg stays held, safe); stunned: it lets go of the egg and hangs slack. arcs: the 0.3 s zap flash first.
  octFreeze(C, T) {
    if (C.ph === 'wait' || C.ph === 'in') return;
    C.fz = C.fzMax = Math.max(C.fz, T);
    C.stn = C.zp = 0;
    if (C.ph === 'warn' || C.ph === 'grab' || C.ph === 'squirt') this.octSet(C, 'seek');
  },
  octStun(C, T, arcs = 0.3) {
    if (C.ph === 'wait' || C.ph === 'in' || C.fz > 0) return;
    const held = !!C.eid, e = this.octRelease(C);
    if (e) { C.ban = e.id; C.banT = this.octM().cd; }
    C.cross = -1; C.tgt = 0;
    C.stn = C.stnMax = Math.max(C.stn, T); C.zp = arcs;
    this.octSet(C, 'rest', OCT.rest * 0.5);
    if (held) this.emit('octLetGo', { ...this.octXY(C), id: C.id, kind: 'zap', egg: e ? e.id : 0 });
  },
  seaFreeze(T) { for (const C of this.octos || []) this.octFreeze(C, T); },
  seaStun(T, arcs = 0.3) { for (const C of this.octos || []) this.octStun(C, T, arcs); },
  seaP2(kind, T) { // p2All's creature kinds
    if (kind === 'ice') this.seaFreeze(T);
    else if (kind === 'bolt') this.seaStun(Math.max(T * 0.6, 2));
    else if (kind === 'zap') this.seaStun(this.octM().stun);
  },

  // ---------- hazards from elsewhere: animalsHit (boss.js: gust rock lava ice bolt quake) and the chick powers
  // (flash, dash). o: {x, y, r}. Returns how many sea creatures it reached.
  seaHit(kind, o = {}) {
    const x = o.x ?? 0, y = o.y ?? 0, r = o.r ?? Infinity;
    let n = 0;
    const K = { bolt: 'zap', flash: 'flash', dash: 'dash', rock: 'rock', lava: 'rock', ice: 'ice' }[kind];
    for (const C of this.octos || []) {
      if (!LIVE.has(C.ph)) continue;
      const h = this.octXY(C);
      if (r < Infinity && Math.hypot(h.x - x, h.y - y) > r + 0.3) continue;
      if (K && this.octHit(C, K)) n++;
    }
    if (kind !== 'gust') for (const S of this.schools || []) if (S.f.some((f) => r === Infinity || Math.hypot(f.r * Math.cos(f.a) - x, f.r * Math.sin(f.a) - y) < r + 0.3)) { if (kind === 'bolt' ? this.fishStun(S, 2.5, true) : this.fishScatter(S, x, y)) n++; }
    if (this.reefHit) n += this.reefHit(kind, o); // world 8: hermit crabs, puffers, jellyfish, King Crab claws
    return n;
  },

  // ======================================================================== fish school
  fishOne(S, dt, end) {
    const n = this.rings.length, c = S.ch, mid = this.seaMid(c), M = FISH.mode[this.mode] || FISH.mode.medium;
    const lo = this.rings[c - 1].r + RING_TH / 2 + 0.1, hi = this.rings[c].r - RING_TH / 2 - 0.1;
    S.t += dt;
    // frozen (fz s left): stopped mid-swim; stunned (sn s left): adrift, belly up. Either way no current for the eggs.
    if (S.fz > 0 || S.sn > 0) {
      if (S.fz > 0) S.fz = Math.max(0, S.fz - dt); else S.sn = Math.max(0, S.sn - dt);
      S.push = 0;
      for (const f of S.f) {
        if (S.fz > 0) { f.va = 0; f.vr = 0; continue; }
        const k = Math.exp(-dt * 2.5);
        f.va *= k; f.vr = f.vr * k + Math.sin(this.t * 1.7 + f.w) * 0.05 * dt;
        f.a = wrap(f.a + (f.va * dt) / Math.max(f.r, 0.5)); f.r = clamp(f.r + f.vr * dt, lo, hi);
      }
      return;
    }
    if (!S.seen && !end) { S.seen = 1; this.emit('fishIn', { id: S.id, ...this.fishXY(S) }); }
    if (S.ph === 'swim' && S.every && (S.turnT -= dt) <= 0) {
      S.dir = -S.dir; S.ph = 'turn'; S.t = 0; S.turnT = S.every * (0.75 + 0.5 * this.rand());
      this.emit('fishTurn', { id: S.id, ...this.fishXY(S) });
    }
    if (S.ph === 'turn' && S.t > 0.9) { S.ph = 'swim'; S.t = 0; }
    if (S.ph === 'scatter' && S.t > FISH.scatter * M.scatter) { // regroup round where they ended up
      let sx = 0, sy = 0;
      for (const f of S.f) { sx += Math.cos(f.a); sy += Math.sin(f.a); }
      S.a = Math.atan2(sy, sx); S.ph = 'regroup'; S.t = 0;
      this.emit('fishRegroup', { id: S.id, ...this.fishXY(S) });
    }
    if (S.ph === 'regroup' && S.t > FISH.regroup) { S.ph = 'swim'; S.t = 0; }
    const sc = S.ph === 'scatter', sp = sc ? 0 : S.ph === 'regroup' ? S.speed * 0.6 : S.speed;
    S.a = wrap(S.a + (S.dir * sp * dt) / mid);
    S.push = clamp(S.push + dt * (sc ? -6 : S.ph === 'regroup' ? 0.8 : 3), 0, 1);
    const kp = S.ph === 'regroup' ? 3.2 : 2;
    S.f.forEach((f, j) => {
      if (S.ph === 'turn' && S.t >= f.lag) f.d = S.dir;
      else if (S.ph !== 'turn') f.d = S.dir;
      if (sc) { // dart off, then mill about
        const k = Math.exp(-dt * 1.6);
        f.va *= k; f.vr *= k;
        f.va += Math.sin(this.t * 2.3 + f.w) * 0.6 * dt; f.vr += Math.cos(this.t * 1.9 + f.w * 1.3) * 0.5 * dt;
      } else {
        const wob = Math.sin(this.t * 1.3 + f.w) * 0.06;
        const ga = S.a + (f.ox * S.dir) / mid, gr = clamp(mid + f.or + wob, lo, hi);
        const ea = wrap(ga - f.a) * mid, er = gr - f.r;
        const want = f.d * sp + clamp(ea * kp, -1.2, 1.2);
        f.va += clamp(want - f.va, -4 * dt, 4 * dt) * (S.ph === 'turn' ? 2.2 : 1);
        f.vr += clamp(er * kp * 1.5 - f.vr, -3 * dt, 3 * dt);
      }
      f.a = wrap(f.a + (f.va * dt) / Math.max(f.r, 0.5));
      f.r += f.vr * dt;
      if (f.r < lo) { f.r = lo; f.vr = Math.abs(f.vr) * 0.5; }
      if (f.r > hi) { f.r = hi; f.vr = -Math.abs(f.vr) * 0.5; }
      if (j === 0 && !Number.isFinite(f.a)) f.a = S.a; // never NaN
    });
    if (end) return;
    // what scatters them: an egg dropping in fast, a creature lunging close
    if (S.ph === 'swim' || S.ph === 'turn' || (S.ph === 'regroup' && S.t > 0.5)) {
      for (const e of this.aliveEggs()) {
        if (!e.body || !e.body.isActive()) continue;
        const v = e.body.getLinearVelocity(), sp2 = Math.hypot(v.x, v.y);
        if (sp2 < FISH.drop) continue;
        const p = e.body.getPosition();
        if (this.fishNear(S, p.x, p.y, 0.4)) { this.fishScatter(S, p.x, p.y, 'egg'); break; }
      }
      if (S.ph !== 'scatter') this.fishLunges(S);
    }
    // the current: eggs among the fish are carried toward the fishes' own speed
    if (S.push > 0.02) for (const e of this.aliveEggs()) {
      if (!e.body || !e.body.isActive() || e.chick && e.powK) continue;
      const b = e.body, p = b.getPosition(), d = Math.hypot(p.x, p.y) || 1;
      if (this.chAt(d) !== c) continue;
      let k = 0, va = 0;
      for (const f of S.f) { const q = Math.hypot(f.r * Math.cos(f.a) - p.x, f.r * Math.sin(f.a) - p.y); if (q < FISH.r) { const w = 1 - q / FISH.r; k += w; va += f.va * w; } }
      if (k < 0.05) continue;
      va /= k;
      const tx = -p.y / d, ty = p.x / d, v = b.getLinearVelocity(), vt = v.x * tx + v.y * ty;
      const m = b.getMass(), acc = clamp((va - vt) * FISH.push, -FISH.maxA, FISH.maxA) * Math.min(1, k / 1.2) * S.push * M.push, up = Math.abs(acc) * FISH.lift;
      b.applyForceToCenter({ x: (tx * acc - (p.x / d) * up) * m, y: (ty * acc - (p.y / d) * up) * m }, true); // along, and a little off the floor
    }
  },
  // power hits (sim/powers2.js, the rooster, lightning): a school frozen for T s, or stunned (zap: lightning first)
  fishFreeze(S, T) { if (S.fz >= T) return false; S.fz = T; S.sn = 0; S.zp = 0; return true; },
  fishStun(S, T, zap) { if (S.fz > 0 || S.sn >= T) return false; S.sn = T; S.zp = zap ? 1 : 0; return true; },
  fishXY(S) { const r = this.seaMid(S.ch); return { x: r * Math.cos(S.a), y: r * Math.sin(S.a) }; },
  fishNear(S, x, y, r) { return S.f.some((f) => Math.hypot(f.r * Math.cos(f.a) - x, f.r * Math.sin(f.a) - y) < r); },
  fishLunges(S) {
    for (const N of this.snakes || []) {
      if (N.gone || !N.inside || !N.pts.length || !(N.lunge > 0.3 || N.strike > 0.12)) continue;
      const h = N.pts[0];
      if (this.fishNear(S, h.x, h.y, 0.9)) return this.fishScatter(S, h.x, h.y, 'snake');
    }
    for (const C of this.octos || []) {
      if (C.ph !== 'grab' && C.ph !== 'jet' && C.ph !== 'let') continue;
      const h = this.octXY(C);
      if (this.fishNear(S, h.x, h.y, 0.9)) return this.fishScatter(S, h.x, h.y, 'octopus');
    }
    const E = this.eagle;
    if (E && (E.phase === 'strike' || E.phase === 'dive') && this.fishNear(S, E.mx, E.my, 1.0)) return this.fishScatter(S, E.mx, E.my, 'eagle');
    for (const C of this.sals || []) if (C.ph === 'fire' && C.pts.length && this.fishNear(S, C.pts[0].x, C.pts[0].y, 1.2)) return this.fishScatter(S, C.pts[0].x, C.pts[0].y, 'salamander');
    return false;
  },
  fishScatter(S, x, y, why = 'hit') {
    if (S.ph === 'scatter') return false;
    S.ph = 'scatter'; S.t = 0; S.sx = x; S.sy = y;
    for (const f of S.f) {
      const fx = f.r * Math.cos(f.a), fy = f.r * Math.sin(f.a), dx = fx - x, dy = fy - y, d = Math.hypot(dx, dy) || 0.01;
      const u = Math.cos(f.a), w = Math.sin(f.a), ta = (-dx * w + dy * u) / d, tr = (dx * u + dy * w) / d; // away, in channel terms
      const j = (this.rand() - 0.5) * 1.2, v = FISH.flee * (0.75 + 0.5 * this.rand());
      f.va = (ta + j) * v; f.vr = (tr - j * 0.5) * v * 0.6;
    }
    this.emit('fishScatter', { id: S.id, x, y, why });
    return true;
  },

  // ---------- state
  seaState() {
    return {
      octos: (this.octos || []).map((C) => ({ ...C })),
      schools: (this.schools || []).map((S) => ({ ...S, f: S.f.map((f) => ({ ...f })) })),
    };
  },
  seaLoad(S) {
    if (!S) return;
    this.octos = (S.octos || []).map((C) => ({ ...C }));
    this.schools = (S.schools || []).map((Q) => ({ ...Q, f: Q.f.map((f) => ({ ...f })) }));
    for (const C of this.octos) { const e = this.octEgg(C); if (e) e.body.setActive(false); } // a held egg is out of the physics world
  },
};
