// The thorn creeper (0.8.18): a small living bramble head with a short trailing vine that crawls back and forth along a
// marked stretch of a ring's rim. Mixed into Sim (sim.js: Object.assign(Sim.prototype, creepMethods)), so `this` is the
// Sim. No imports from sim.js. Every field is plain data in this.creeps (creepState / creepLoad), so rewind and the planner
// stay exact. No randomness.
//
// level.rings[i].creep = { a0, a1, side, v, rest, delay }: the stretch from a0 to a1 (deg, ring-local, a0 < a1), on the
// ring's inner face (side 'in', the floor eggs ride on) or its outer face ('out', the ceiling of the channel outside it);
// v = its mean crawl speed (m/s, Medium), rest = the coil at each end (s, Medium), delay = s before its first crawl.
// It rides with its ring: turning the ring carries the whole stretch round.
//
//   CRAWL  from one end of the stretch to the other, slow off the mark, fastest in the middle, slowing into the end (its
//          thorns bristle with its speed). Its head breaks an egg it runs into, like a thorn (Easy: one crack and a shove).
//   COIL   at each end it curls up for `rest` s: curled, it is harmless, and an egg can roll right over it. This is the
//          safe window (at least 0.8 s on Medium). The last CREEP.wind s of it are the wind-up (it rears and bristles).
//   BITE   after it breaks an egg it chews for a beat, then crawls on.
//   BURN   fire (a flaming egg that touches it, the glow chick's flash, the laser, a salamander's breath) burns it back to a
//          stump; a stone, comet or golden egg snaps it off. The stump regrows after CREEP.regrow s, sprouts and coils.
//   GONE   the Thorn Snips booster snips it for good.
// Events: creepGo (it sets off), creepCoil (it curls up at an end), creepHit, creepBite, creepBurn, creepSnap, creepSnip,
// creepGrow (the stump sprouts), creeperNear (an egg sits on its stretch with the head coming: the teaching system's hook;
// one per approach, never a text toast from here).
import { RING_TH, clamp, wrap } from './geom.js';

const m3 = (easy, medium, hard) => ({ easy, medium, hard });
export const CREEP = {
  headR: 0.15, // m: the bramble head's radius
  lift: 0.13, // m: its centre over the rim face
  reach: 0.2, // m: added to headR for an egg's half width (a touch)
  vK: m3(0.72, 1, 1.15), // crawl speed x
  restK: m3(1.45, 1, 0.85), // coil x (Medium: the level's own rest, never under minRest)
  minRest: 0.8, // s: the safe window on Medium
  wind: 0.32, // s: the wind-up at the end of a coil
  bite: 0.55, // s
  burn: 0.75, // s: the char and crumble
  regrow: m3(9, 7, 5.5), // s as a stump
  grow: 1.0, // s: the sprout unfurls
  nearT: 2.2, // s: creeperNear fires when the head will reach an egg within this
};
const sstep = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
const HARM = new Set(['crawl']);

export const creepMethods = {
  creepInit(L) {
    this.creeps = [];
    (L.rings || []).forEach((rs, ri) => {
      const o = rs.creep;
      if (!o || !this.rings[ri]) return;
      const ring = this.rings[ri], side = o.side === 'out' ? 'out' : 'in';
      const rh = side === 'in' ? ring.r - RING_TH / 2 - CREEP.lift : ring.r + RING_TH / 2 + CREEP.lift;
      const a0 = (Math.min(o.a0, o.a1) * Math.PI) / 180, a1 = (Math.max(o.a0, o.a1) * Math.PI) / 180;
      this.creeps.push({
        id: this.creeps.length, ri, side, rh, a0, a1, v: o.v || 0.5, rest: o.rest || 1,
        u: a0, dir: 1, ph: 'coil', t: o.delay ?? 2.5, dur: o.delay ?? 2.5, s: 0, spd: 0, // u: the head's ring-local angle; s: 0..1 along this crawl
        hits: 0, near: 0, bit: 0, snipped: 0, why: '',
      });
    });
  },
  creepM(o) { return o[this.mode] ?? o.medium; },
  creepRest(C) { return Math.max(CREEP.minRest * (this.mode === 'medium' ? 1 : 0), C.rest * this.creepM(CREEP.restK)); },
  creepCrawlT(C) { return Math.max(0.6, ((C.a1 - C.a0) * C.rh) / (C.v * this.creepM(CREEP.vK))); },
  creepSet(C, ph, t) { C.ph = ph; C.t = C.dur = t; },
  // the head in world space (and its heading: +1 = toward a1, counter-clockwise in ring space)
  creepHead(C) {
    const ring = this.rings[C.ri], A = ring.body.getAngle() + C.u;
    return { x: C.rh * Math.cos(A), y: C.rh * Math.sin(A), a: A };
  },
  creepLive(C) { return C.ph !== 'gone' && C.ph !== 'stump' && C.ph !== 'burn'; },

  creepStep(dt) {
    if (!this.creeps || !this.creeps.length) return;
    for (const C of this.creeps) {
      if (this.opts.snips && !C.snipped && this.t > 0.9 + 0.25 * C.id && C.ph !== 'gone') { this.creepSnipOff(C); continue; } // Thorn Snips: snipped at the start
      if (this.state !== 'play' || (this.stkFrozen && this.stkFrozen())) continue; // (Tick-Tock's stopped time holds it where it is)
      this.creepOne(C, dt);
      if (this.creepLive(C)) this.creepTouch(C);
      if (HARM.has(C.ph)) this.creepNear(C);
    }
  },
  creepOne(C, dt) {
    switch (C.ph) {
      case 'gone': return;
      case 'coil':
        C.spd = 0;
        if ((C.t -= dt) <= 0) { this.creepSet(C, 'crawl', this.creepCrawlT(C)); C.s = 0; this.emit('creepGo', { id: C.id, ...this.creepHead(C), dir: C.dir }); }
        return;
      case 'crawl': {
        const D = C.dur;
        C.s = Math.min(1, C.s + dt / D);
        const f = C.dir > 0 ? sstep(C.s) : 1 - sstep(C.s);
        const u0 = C.u;
        C.u = C.a0 + (C.a1 - C.a0) * f;
        C.spd = Math.abs(C.u - u0) * C.rh / Math.max(1e-6, dt);
        if (C.s >= 1) { C.dir = -C.dir; C.spd = 0; C.near = 0; this.creepSet(C, 'coil', this.creepRest(C)); this.emit('creepCoil', { id: C.id, ...this.creepHead(C) }); }
        return;
      }
      case 'bite': C.spd = 0; if ((C.t -= dt) <= 0) { C.ph = 'crawl'; C.t = C.dur = C.bitDur || this.creepCrawlT(C); } return;
      case 'burn': if ((C.t -= dt) <= 0) this.creepSet(C, 'stump', this.creepM(CREEP.regrow)); return;
      case 'stump': if ((C.t -= dt) <= 0) { this.creepSet(C, 'grow', CREEP.grow); this.emit('creepGrow', { id: C.id, ...this.creepHead(C) }); } return;
      case 'grow': if ((C.t -= dt) <= 0) this.creepSet(C, 'coil', this.creepRest(C)); return;
    }
  },
  // eggs against the head: a crawling head breaks them (like a thorn); fire burns it, stone snaps it, any phase it has a head
  creepTouch(C) {
    const H = this.creepHead(C), R = CREEP.headR + CREEP.reach;
    for (const e of this.eggs) {
      if (!e.alive || e.saved || e.phx || !e.body) continue;
      const p = e.body.getPosition(), dx = p.x - H.x, dy = p.y - H.y, d = Math.hypot(dx, dy);
      if (d > R) continue;
      if (e.fire > 0) { this.creepCut(C, 'burn', e); return; }
      if (e.comet) { e.comet = 0; e.safeT = Math.max(e.safeT || 0, 0.3); this.creepCut(C, 'snap', e); return; }
      if (e.stone > 0) { this.emit('stoneHit', { egg: e }); this.creepCut(C, 'snap', e); return; }
      if (C.ph !== 'crawl') continue; // curled up: harmless (the safe window)
      // only the front of the head bites (an egg the head has just passed is behind it)
      const tx = -Math.sin(H.a) * C.dir, ty = Math.cos(H.a) * C.dir;
      if ((dx * tx + dy * ty) < -0.06 && d > CREEP.headR + 0.08) continue;
      if (e.safeT > 0 || e.icy > 0) continue;
      if (e.golden) { e.golden = 0; e.safeT = 0.6; this.emit('goldenSave', { egg: e }); this.creepCut(C, 'snap', e); return; }
      if (e.bubbleFix) { if (!e.popping) { e.popping = true; e.safeT = 0.4; this.defer(() => { e.popping = false; this.popBubble(e, true); }); } continue; }
      this.creepBite(C, e, H, dx / (d || 1), dy / (d || 1));
      return;
    }
  },
  creepBite(C, e, H, nx, ny) {
    C.hits++;
    C.bitDur = C.dur; this.creepSet(C, 'bite', CREEP.bite); C.spd = 0;
    this.emit('creepHit', { id: C.id, egg: e, x: H.x, y: H.y });
    if (this.MD.softThorns && !e.chick) { // Easy: one crack (never the breaking one) and a shove off
      e.safeT = Math.max(e.safeT || 0, 0.8);
      this.defer(() => {
        if (!e.alive || e.saved) return;
        if (e.cracks < 2) this.crack(e, 0, 'spike');
        const b = e.body, m = b.getMass() * 1.8 * this.vs;
        b.applyLinearImpulse({ x: nx * m, y: ny * m }, b.getPosition(), true);
      });
      return;
    }
    e.safeT = 1;
    this.defer(() => { e.safeT = 0; this.breakEgg(e, 'thorn'); });
  },
  // burnt back (or snapped off) to a stump where it is
  creepCut(C, how, egg = null) {
    if (!this.creepLive(C)) return false;
    const H = this.creepHead(C);
    this.creepSet(C, 'burn', CREEP.burn); C.spd = 0; C.why = how;
    this.emit(how === 'burn' ? 'creepBurn' : 'creepSnap', { id: C.id, x: H.x, y: H.y, egg });
    this.chickGain = (this.chickGain || 0) + 2; // the planner counts it like cleared thorns
    return true;
  },
  creepSnipOff(C) {
    C.snipped = 1;
    const H = this.creepHead(C);
    C.ph = 'gone'; C.spd = 0;
    this.emit('stkSnip', { x: H.x, y: H.y, n: 1 });
    this.emit('creepSnip', { id: C.id, x: H.x, y: H.y });
  },
  // fire from elsewhere: everything within r of (x, y) burns (the glow chick's flash, the laser's beam test, a breath)
  creepBurnAt(x, y, r, how = 'burn') {
    let n = 0;
    for (const C of this.creeps || []) {
      if (!this.creepLive(C)) continue;
      const H = this.creepHead(C);
      if (Math.hypot(H.x - x, H.y - y) < r + CREEP.headR && this.creepCut(C, how)) n++;
    }
    return n;
  },
  creepBurnTest(test) { // test(x, y, reach): the laser's beam
    let n = 0;
    for (const C of this.creeps || []) { if (!this.creepLive(C)) continue; const H = this.creepHead(C); if (test(H.x, H.y, CREEP.headR) && this.creepCut(C, 'burn')) n++; }
    return n;
  },
  creepBurnArc(ring, la, half) { // a salamander's breath on a ring section (ring-local angle la, half width rad)
    let n = 0;
    for (const C of this.creeps || []) if (C.ri === ring.i && this.creepLive(C) && Math.abs(wrap(C.u - la)) < half + 0.1 / ring.r && this.creepCut(C, 'burn')) n++;
    return n;
  },
  // ring-local angle of an egg on this creeper's face (null when it is not on that face's side of the rim)
  creepEggU(C, e) {
    const ring = this.rings[C.ri], p = e.body.getPosition(), d = Math.hypot(p.x, p.y);
    if (Math.abs(d - C.rh) > 0.48) return null;
    return Math.atan2(p.y, p.x) - ring.body.getAngle();
  },
  // seconds until the head reaches ring-local angle u (Infinity when it will not, this crawl or the next)
  creepEta(C, u) {
    const T = this.creepCrawlT(C), m = (CREEP.headR + CREEP.reach) / C.rh;
    const lo = C.a0 - m, hi = C.a1 + m;
    let w = wrap(u - (C.a0 + C.a1) / 2) + (C.a0 + C.a1) / 2;
    if (w < lo || w > hi) return Infinity;
    w = clamp(w, C.a0, C.a1);
    const at = (f) => { // the crawl time at which f (0..1 along a0 -> a1) is reached, heading dir
      let lo2 = 0, hi2 = 1; for (let i = 0; i < 18; i++) { const mid = (lo2 + hi2) / 2; if (sstep(mid) < f) lo2 = mid; else hi2 = mid; } return ((lo2 + hi2) / 2) * T;
    };
    const f = (w - C.a0) / Math.max(1e-6, C.a1 - C.a0);
    if (C.ph === 'crawl' || C.ph === 'bite') {
      const fNow = (C.u - C.a0) / Math.max(1e-6, C.a1 - C.a0);
      if ((C.dir > 0 && f >= fNow - 0.02) || (C.dir < 0 && f <= fNow + 0.02)) return Math.max(0, (C.dir > 0 ? at(f) - at(fNow) : at(1 - f) - at(1 - fNow))) + (C.ph === 'bite' ? C.t : 0);
      return (C.dir > 0 ? T - at(fNow) : T - at(1 - fNow)) + this.creepRest(C) + (C.dir > 0 ? at(1 - f) : at(f));
    }
    if (C.ph === 'coil') return C.t + (C.dir > 0 ? at(f) : at(1 - f));
    if (C.ph === 'grow') return C.t + this.creepRest(C) + (C.dir > 0 ? at(f) : at(1 - f));
    return Infinity;
  },
  // 0..1: how soon this egg will meet a crawling head (the planner's caution, the danger level)
  creepThreat(e) {
    if (!this.creeps || !e.body) return 0;
    let th = 0;
    for (const C of this.creeps) {
      if (C.ph === 'gone' || C.ph === 'stump' || C.ph === 'burn') continue;
      const u = this.creepEggU(C, e);
      if (u == null) continue;
      const eta = this.creepEta(C, u);
      if (eta === Infinity) continue;
      th = Math.max(th, clamp(1.15 - eta / 3.5, 0.25, 1));
    }
    return th;
  },
  // the teaching hook: an egg sits on the stretch and the crawling head will reach it soon
  creepNear(C) {
    if (C.near) return;
    for (const e of this.aliveEggs()) {
      if (!e.body) continue;
      const u = this.creepEggU(C, e);
      if (u == null) continue;
      const eta = this.creepEta(C, u);
      if (eta < CREEP.nearT) { C.near = 1; const H = this.creepHead(C); this.emit('creeperNear', { id: C.id, egg: e, eta, x: H.x, y: H.y }); return; }
    }
  },

  creepState() { return (this.creeps || []).map((C) => ({ ...C })); },
  creepLoad(S) { if (S && this.creeps) S.forEach((c, i) => { if (this.creeps[i]) Object.assign(this.creeps[i], c); }); },
};
