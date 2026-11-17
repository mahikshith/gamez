// Coral Reef cast (world 8): the HERMIT CRAB, the PUFFERFISH and the JELLYFISH. Mixed into Sim (sim.js:
// Object.assign(Sim.prototype, reefMethods)), so `this` is the Sim. No imports from sim.js. Every creature is a plain
// object in this.hermits / this.puffs / this.jellies (and egg.hc), copied by reefState() / restored by reefLoad(), so
// rewind and the planner stay exact. No randomness. The King Crab boss lives in sim/kingcrab.js.
//
// level.hermit {ch, a, delay} (or an array): a hermit crab on the floor of channel ch (its outer wall's inner face; default
//   the outermost), starting at world angle a (deg). The floor ring slides under it (it walks, it does not ride).
//   It scuttles toward the nearest egg in its channel, raises its claws (the telegraph) and tucks the egg into its shell,
//   then carries it away from the nearest gap. Upside: a tucked egg is safe from thorns, snakes and stings, and if you
//   turn a gap under the crab the egg slips out and drops through: the crab did your work. Downside: it walks your egg
//   the wrong way and the fuse runs. Beat it: drop an egg or a rock on it (it flips on its back and lets go), a zap, a
//   glow flash, a jellyfish sting, the live ring. Easy: it sets the egg down sooner.
// level.puffer {ch, a, delay} (or an array): a pufferfish drifting in channel ch. When an egg comes near a gap in that
//   channel's floor (ring ch) it darts over the gap and swells into a spiky ball that fills the channel and plugs the gap
//   (a fixture on ring ch: it rides that ring). It deflates after a few seconds. Upside: the swollen puffer is a bouncy
//   floor: a soft landing for an egg dropping onto it. Downside: it blocks the route, and an egg hitting it hard is
//   cracked by its spines. A thorn (turn the ring above so a thorn pointing out pokes it) or a zap pops it early.
// level.jelly {ch, a, delay, dir} (or an array): a jellyfish floating slowly round the vault, through the ring walls,
//   between channel ch and the next one out. Its sting cracks an egg it touches (once per egg every few seconds) and
//   makes a hermit crab let go. Upside: it glows: it lights up the King Crab's silt cloud, and it stings crabs.
//   Water (a water orb or water egg near it) flushes it out of the vault for a while; the live ring and zaps stun it.
// Frozen (frost nova) and stunned states: fz / stn s (zp = the 0.3 s zap arcs first), drawn with render/status.js.
import { Vec2, Circle } from 'planck';
import { RING_TH, wrap, clamp } from './geom.js';

const m3 = (easy, medium, hard) => ({ easy, medium, hard });
export const HERMIT = {
  shell: 0.42, bodyH: 0.3, eggH: 0.3, // m: shell radius (the art is drawn 1.55x: render/reef.js HERMIT_ART), body centre above the floor, held egg centre above the floor
  walk: m3(0.28, 0.4, 0.48), stalk: m3(0.45, 0.62, 0.75), carry: m3(0.24, 0.32, 0.38), // m/s
  warn: m3(1.25, 0.85, 0.65), reach: 0.62, see: 2.4, // s telegraph, m grab reach, m it notices an egg
  hold: m3(3.5, 6, 8), flip: m3(4, 3, 2.4), rest: 2, ban: 6, in: 0.7, // s
  hit: 1.6, // m/s: an egg or rock this fast hitting it flips it
};
export const PUFF = {
  r: 0.4, // m: the swollen ball's radius (it fills a 1 m channel)
  drift: 0.22, dart: m3(1.0, 1.5, 1.8), // m/s
  watch: 1.6, from: 3.2, // m: an egg this close to a floor gap, the puffer this close to that gap
  swell: m3(0.8, 0.5, 0.4), big: m3(3, 4.5, 5.5), shrink: 0.45, rest: m3(5, 3.5, 2.5), pop: 0.6, stun: 2, // s
  spine: m3(4.4, 3.4, 3.0), // m/s: a harder hit than this cracks the egg on its spines; softer is a bouncy landing
  spineW: m3(2.0, 1.5, 1.3), // the same underwater, where eggs only drift (a fast-rising egg is pricked)
  bounce: 0.75,
};
export const JELLY = {
  r: 0.38, // m: the bell (its sting reaches a little below it; the art is drawn 1.3x of 0.32)
  w: m3(0.055, 0.085, 0.1), u: m3(0.26, 0.34, 0.42), // rad/s round the vault, rad/s of its in-out bob
  cd: m3(4, 2.5, 2), again: 3, // s between stings, s before it stings the same egg again
  flush: 8, stun: m3(5, 4, 3.2), wet: 0.85, light: 1.5, in: 1.2, // s, s, m water reach, m glow radius
};
const deg = (d) => (d * Math.PI) / 180;
const list = (v) => (!v ? [] : Array.isArray(v) ? v : [v]);
const PUFF_FILT = { filterCategoryBits: 1, filterMaskBits: 2 | 4 | 64 | 128 }; // sim.js CAT.RING / MASK.RING

export const reefMethods = {
  // ---------- build
  reefInit(L) {
    this.hermits = []; this.puffs = []; this.jellies = []; this.pfFix = [];
    const n = this.rings.length;
    if (n < 2) return;
    list(L.hermit).forEach((P, i) => this.hermits.push({
      id: i, ch: clamp(P.ch ?? n - 1, 1, n - 1), a: deg(P.a ?? -60), face: 1, ph: 'wait', t: P.delay ?? 2, dur: 1,
      tgt: 0, eid: 0, hold: 0, ban: 0, banT: 0, fz: 0, stn: 0, zp: 0, odo: 0, hitCD: 0, k: '', wa: 0,
    }));
    list(L.puffer).forEach((P, i) => {
      const ch = clamp(P.ch ?? n - 1, 1, n - 1);
      this.puffs.push({ id: i, ch, a: deg(P.a ?? 120), rr: this.reefMid(ch), face: 1, ph: 'wait', t: P.delay ?? 1.5, dur: 1, la: 0, cd: 0, fz: 0, stn: 0, zp: 0, sw: 0 });
    });
    list(L.jelly).forEach((P, i) => {
      const ch = clamp(P.ch ?? 1, 1, n - 1);
      const J = { id: i, ch, a0: deg(P.a ?? 30), a: deg(P.a ?? 30), u: 0, dir: P.dir === -1 ? -1 : 1, ph: 'wait', t: P.delay ?? 1, dur: 1, fz: 0, stn: 0, zp: 0, cd: 1.5, last: 0, lastT: -9, x: 0, y: 0, al: 0 };
      this.jellyPos(J);
      this.jellies.push(J);
    });
  },
  reefMid(c) { return (this.rings[c - 1].r + this.rings[c].r) / 2; },
  reefM(o) { return o[this.mode] ?? o.medium; },
  reefFloor(c) { return this.rings[c].r - RING_TH / 2; },

  // ---------- every step (sim.js predStep)
  reefStep(dt, end) {
    for (const H of this.hermits) this.hermitOne(H, dt, end);
    for (const P of this.puffs) this.puffOne(P, dt, end);
    for (const J of this.jellies) this.jellyOne(J, dt, end);
    if (this.kc) this.kcStep(dt, end); // the King Crab (sim/kingcrab.js)
  },

  // ---------- held eggs (egg.hc: 1 in a hermit's shell, 2 in a King Crab claw, 3 in the King Crab's pile)
  reefTake(e, how) {
    if (e.joint) this.unMagnet(e);
    if (e.bubbleFix) this.popBubble(e);
    e.hold = null; e.honey = 0; e.hc = how;
    e.body.setActive(false);
  },
  reefFree(e, vx = 0, vy = 0, safe = 0.8) {
    if (!e || !e.alive) return;
    e.hc = 0;
    const b = e.body;
    b.setActive(true);
    b.setLinearVelocity({ x: vx, y: vy });
    b.setAngularVelocity(0);
    e.safeT = Math.max(e.safeT || 0, safe);
    e.ch = this.channelOf(e); e.freefall = 0; e.drop = 0;
  },
  reefFit(e) { return e.alive && !e.saved && e.body && e.body.isActive() && !e.hc && !e.thf && !e.octo && !e.chick; },

  // ======================================================================== hermit crab
  hermitPt(H, h) { const r = this.reefFloor(H.ch) - h; return { x: r * Math.cos(H.a), y: r * Math.sin(H.a) }; },
  hermitBody(H) { return this.hermitPt(H, HERMIT.bodyH); },
  hermitLive(H) { return H.ph !== 'wait' && H.ph !== 'in' && H.ph !== 'warp'; },
  hermitSet(H, ph, t = 0) { H.ph = ph; H.t = H.dur = t; },
  hermitFit(H, e) { return this.reefFit(e) && e.fire <= 0 && !(e.stone > 0) && !(H.ban === e.id && H.banT > 0) && this.channelOf(e) === H.ch && !this.hermits.some((o) => o !== H && (o.tgt === e.id || o.eid === e.id)); },
  // walk along the floor toward world angle ga (or just on, when ga is null); returns the arc left (m)
  hermitWalk(H, ga, v, dt) {
    const r = this.reefFloor(H.ch);
    if (ga == null) { H.a = wrap(H.a + (H.face * v * dt) / r); H.odo += v * dt; return 9; }
    const da = wrap(ga - H.a), d = Math.abs(da) * r;
    if (d < 0.02) return 0;
    H.face = da > 0 ? 1 : -1;
    const s = Math.min(d, v * dt);
    H.a = wrap(H.a + (H.face * s) / r); H.odo += s;
    return d - s;
  },
  hermitPrey(H) {
    const r = this.reefFloor(H.ch);
    let best = null, bd = HERMIT.see;
    for (const e of this.aliveEggs()) {
      if (!this.hermitFit(H, e)) continue;
      const p = e.body.getPosition(), d = Math.abs(wrap(Math.atan2(p.y, p.x) - H.a)) * r;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  },
  // the open floor gap under it (for the held egg), or null
  hermitGapUnder(H, e) {
    const ring = this.rings[H.ch], ra = ring.body.getAngle(), r = ring.r;
    for (const g of ring.gaps) {
      if (g.o < 0.5 || !this.gapOpenFor(g, e)) continue;
      if (Math.abs(wrap(ra + g.a - H.a)) * r < g.len / 2 - 0.08) return g;
    }
    return null;
  },
  // signed direction (+1 = counter-clockwise) toward the nearest open floor gap
  hermitGapDir(H) {
    const ring = this.rings[H.ch], ra = ring.body.getAngle();
    let best = 0, bd = 1e9;
    for (const g of ring.gaps) { if (g.grate || (g.curtain && g.curtain.alive)) continue; const d = wrap(ra + g.a - H.a); if (Math.abs(d) < bd) { bd = Math.abs(d); best = d; } }
    return best >= 0 ? 1 : -1;
  },
  hermitHoldEgg(H, e) {
    const r = this.reefFloor(H.ch) - HERMIT.eggH, a = H.a - (H.face * 0.1) / r;
    e.body.setTransform({ x: r * Math.cos(a), y: r * Math.sin(a) }, a + (H.face > 0 ? 0.35 : -0.35));
    e.body.setLinearVelocity({ x: 0, y: 0 });
    e.ch = H.ch; e.freefall = 0; e.drop = 0;
  },
  hermitLetGo(H, why, drop = false) {
    const e = H.eid ? this.eggs.find((q) => q.id === H.eid) : null;
    H.eid = 0; H.tgt = 0;
    if (!e || !e.alive) return null;
    const p = e.body.getPosition(), d = Math.hypot(p.x, p.y) || 1, v = drop ? 1.2 : 0.3;
    this.reefFree(e, (p.x / d) * v, (p.y / d) * v, drop ? 0.4 : 0.8);
    H.ban = e.id; H.banT = HERMIT.ban;
    this.emit('hermitDrop', { why, x: p.x, y: p.y, egg: e, id: H.id });
    return e;
  },
  hermitFlip(H, why, T) {
    if (!this.hermitLive(H) || H.ph === 'flip' || H.hitCD > 0) return false;
    this.hermitLetGo(H, why);
    H.hitCD = 1;
    this.hermitSet(H, 'flip', T ?? this.reefM(HERMIT.flip));
    H.k = why;
    this.emit('hermitFlip', { why, ...this.hermitBody(H), id: H.id });
    return true;
  },
  hermitOne(H, dt, end) {
    if (H.banT > 0 && (H.banT -= dt) <= 0) H.ban = 0;
    if (H.hitCD > 0) H.hitCD -= dt;
    if (H.ph === 'wait') { if (!end && (H.t -= dt) <= 0) { this.hermitSet(H, 'in', HERMIT.in); this.emit('hermitIn', { ...this.hermitBody(H), id: H.id }); } return; }
    const e = H.eid ? this.eggs.find((q) => q.id === H.eid && q.alive) : null;
    if (H.eid && !e) H.eid = 0;
    if (end) { if (H.eid) this.hermitLetGo(H, 'end'); if (H.ph !== 'flip') this.hermitSet(H, 'rest', 9); return; }
    if (H.fz > 0) { H.fz -= dt; if (e) this.hermitHoldEgg(H, e); if (H.fz <= 0) { H.fz = 0; this.emit('reefThaw', { ...this.hermitBody(H) }); } return; } // frozen: a held egg stays held, safe
    if (H.zp > 0) { H.zp -= dt; return; }
    if (H.ph !== 'flip' && H.ph !== 'in') this.hermitHits(H);
    if (H.ph === 'flip') { if ((H.t -= dt) <= 0) this.hermitSet(H, 'rest', 1); return; }
    if (H.ph === 'warp') { // swallowed by a warp gate, spat out on the far side of its channel, dazed
      if (H.t > H.dur / 2 && H.t - dt <= H.dur / 2) { H.a = H.wa; this.emit('warpOut', { ...this.hermitBody(H), kind: 'h' }); }
      if ((H.t -= dt) <= 0) this.hermitSet(H, 'rest', 3 * (this.p2M?.up || 1));
      return;
    }
    switch (H.ph) {
      case 'in': if ((H.t -= dt) <= 0) this.hermitSet(H, 'walk'); break;
      case 'walk': case 'rest': {
        if (H.ph === 'rest' && (H.t -= dt) > 0) { this.hermitWalk(H, null, this.reefM(HERMIT.walk) * 0.3, dt); break; }
        H.ph = 'walk';
        const q = this.hermitPrey(H);
        if (q) { H.tgt = q.id; this.hermitSet(H, 'stalk'); H.tgt = q.id; break; }
        H.face = Math.sin(this.t * 0.21 + H.id * 2.3) > 0 ? 1 : -1; // a slow wander back and forth
        this.hermitWalk(H, null, this.reefM(HERMIT.walk) * 0.6, dt);
        break;
      }
      case 'stalk': case 'pinch': {
        const q = this.eggs.find((x) => x.id === H.tgt);
        if (!q || !this.hermitFit(H, q)) { this.hermitSet(H, 'walk'); H.tgt = 0; break; }
        const p = q.body.getPosition(), ga = Math.atan2(p.y, p.x), d = Math.abs(wrap(ga - H.a)) * this.reefFloor(H.ch);
        if (H.ph === 'stalk') {
          if (d > HERMIT.see + 0.6) { this.hermitSet(H, 'walk'); H.tgt = 0; break; }
          if (d < HERMIT.reach - 0.12) { this.hermitSet(H, 'pinch', this.reefM(HERMIT.warn) * (this.PM?.warn || 1)); H.tgt = q.id; this.emit('hermitWarn', { ...this.hermitBody(H), id: H.id, egg: q.id }); break; }
          this.hermitWalk(H, ga, this.reefM(HERMIT.stalk), dt);
          break;
        }
        H.face = wrap(ga - H.a) >= 0 ? 1 : -1;
        if ((H.t -= dt) > 0) break;
        if (d < HERMIT.reach + 0.15 && this.warpStrike?.('hermit', H)) break; // v3.4: a warp gate takes the grab
        if (d < HERMIT.reach + 0.15) {
          this.reefTake(q, 1);
          H.eid = q.id; H.tgt = 0; H.hold = 0;
          H.face = -this.hermitGapDir(H); // away from the nearest way down
          this.hermitSet(H, 'carry');
          this.emit('hermitGrab', { x: p.x, y: p.y, egg: q, id: H.id });
        } else { this.hermitSet(H, 'walk'); H.tgt = 0; }
        break;
      }
      case 'carry': {
        if (!e) { this.hermitSet(H, 'rest', HERMIT.rest); break; }
        H.hold += dt;
        if (this.hermitGapUnder(H, e)) { this.hermitLetGo(H, 'gap', true); this.hermitSet(H, 'rest', HERMIT.rest); break; } // it slips out and drops through
        if (H.hold >= this.reefM(HERMIT.hold)) { this.hermitLetGo(H, 'tired'); this.hermitSet(H, 'rest', HERMIT.rest); break; }
        this.hermitWalk(H, null, this.reefM(HERMIT.carry), dt);
        break;
      }
    }
    const h = H.eid ? this.eggs.find((q) => q.id === H.eid) : null;
    if (h) this.hermitHoldEgg(H, h);
  },
  // an egg or rock falling on it, a burning egg, a zapped egg or ring
  hermitHits(H) {
    if (H.hitCD > 0) return;
    const c = this.hermitBody(H), R = HERMIT.shell + 0.24;
    for (const e of this.aliveEggs()) {
      if (!e.body.isActive() || e.id === H.eid) continue;
      const p = e.body.getPosition(), v = e.body.getLinearVelocity(), d = Math.hypot(p.x - c.x, p.y - c.y);
      if (d > R) continue;
      if (e.zap) { e.zap = 0; this.hermitFlip(H, 'zap'); H.zp = 0.3; return; }
      if (e.fire > 0 || -((v.x * (c.x - p.x) + v.y * (c.y - p.y)) / (d || 1)) < -HERMIT.hit) { this.hermitFlip(H, 'drop'); return; }
    }
    for (const r of this.rocks || []) {
      if (!r.alive) continue;
      const p = r.body.getPosition(), v = r.body.getLinearVelocity();
      if (Math.hypot(p.x - c.x, p.y - c.y) < R && Math.hypot(v.x, v.y) > HERMIT.hit) { this.hermitFlip(H, 'drop'); return; }
    }
    if (this.rings[H.ch].stun > 0) { this.hermitFlip(H, 'zap'); H.zp = 0.3; }
  },

  // ======================================================================== pufferfish
  puffXY(P) { return { x: P.rr * Math.cos(P.a), y: P.rr * Math.sin(P.a) }; },
  puffSet(P, ph, t = 0) { P.ph = ph; P.t = P.dur = t; },
  puffPlugR(P) { return this.reefFloor(P.ch) - PUFF.r - 0.01; }, // its centre when it plugs a floor gap
  puffFixOn(P) {
    if (this.pfFix[P.id]) return;
    const ring = this.rings[P.ch], r = this.puffPlugR(P);
    this.pfFix[P.id] = ring.body.createFixture({ shape: new Circle(Vec2(r * Math.cos(P.la), r * Math.sin(P.la)), PUFF.r), friction: 0.4, restitution: PUFF.bounce, ...PUFF_FILT, userData: { kind: 'puffer', pf: P.id } });
  },
  puffFixOff(P) {
    const f = this.pfFix[P.id];
    if (!f) return;
    this.pfFix[P.id] = null;
    this.killFix.push([this.rings[P.ch].body, f]);
  },
  // the floor gap it goes for: an egg in its channel near it, the puffer within reach of it
  puffTarget(P) {
    const ring = this.rings[P.ch], ra = ring.body.getAngle(), r = ring.r;
    let best = null, bd = 1e9;
    for (const g of ring.gaps) {
      if (g.grate || (g.curtain && g.curtain.alive) || this.puffs.some((o) => o !== P && o.ph !== 'drift' && o.ph !== 'wait' && Math.abs(wrap(o.la - g.a)) < 0.05)) continue;
      const ga = ra + g.a, dp = Math.abs(wrap(ga - P.a)) * r;
      if (dp > PUFF.from) continue;
      for (const e of this.aliveEggs()) {
        if (!this.reefFit(e) || this.channelOf(e) !== P.ch) continue;
        const q = e.body.getPosition(), de = Math.abs(wrap(Math.atan2(q.y, q.x) - ga)) * r;
        if (de < PUFF.watch && de + dp * 0.3 < bd) { bd = de + dp * 0.3; best = g; }
      }
    }
    return best;
  },
  puffPop(P, why) {
    if (P.ph !== 'big' && P.ph !== 'swell') return false;
    this.puffFixOff(P);
    this.puffSet(P, 'pop', PUFF.pop);
    P.cd = this.reefM(PUFF.rest);
    this.emit('puffPop', { why, ...this.puffXY(P), id: P.id });
    return true;
  },
  puffOne(P, dt, end) {
    if (P.ph === 'wait') { if (!end && (P.t -= dt) <= 0) { this.puffSet(P, 'in', 0.6); this.emit('puffIn', { ...this.puffXY(P), id: P.id }); } return; }
    const ring = this.rings[P.ch];
    const ride = P.ph === 'swell' || P.ph === 'big' || P.ph === 'shrink';
    if (ride) P.a = wrap(ring.body.getAngle() + P.la);
    P.sw = P.ph === 'swell' ? 1 - P.t / P.dur : P.ph === 'big' ? 1 : P.ph === 'shrink' ? P.t / P.dur : 0;
    if (P.fz > 0) { P.fz -= dt; if (P.fz <= 0) { P.fz = 0; this.emit('reefThaw', this.puffXY(P)); } return; } // frozen: a swollen one stays a wall
    if (P.zp > 0) { P.zp -= dt; return; }
    if (P.stn > 0) { P.stn -= dt; P.rr += clamp(this.reefMid(P.ch) - P.rr, -0.3 * dt, 0.3 * dt); return; }
    if (end && ride && P.ph !== 'shrink') { this.puffFixOff(P); this.puffSet(P, 'shrink', PUFF.shrink); }
    if (P.cd > 0) P.cd -= dt;
    switch (P.ph) {
      case 'in': if ((P.t -= dt) <= 0) this.puffSet(P, 'drift'); break;
      case 'drift': {
        const g = !end && P.cd <= 0 ? this.puffTarget(P) : null;
        if (g) { P.la = g.a; this.puffSet(P, 'dart'); this.emit('puffDart', { ...this.puffXY(P), id: P.id }); break; }
        P.face = Math.sin(this.t * 0.17 + P.id * 1.9) > 0 ? 1 : -1;
        P.a = wrap(P.a + (P.face * PUFF.drift * dt) / Math.max(0.5, P.rr));
        P.rr += clamp(this.reefMid(P.ch) + 0.12 * Math.sin(this.t * 0.9 + P.id) - P.rr, -0.3 * dt, 0.3 * dt);
        break;
      }
      case 'dart': {
        const ga = ring.body.getAngle() + P.la, da = wrap(ga - P.a), want = this.puffPlugR(P);
        P.face = da >= 0 ? 1 : -1;
        const step = (this.reefM(PUFF.dart) * dt) / Math.max(0.5, P.rr);
        P.a = wrap(P.a + clamp(da, -step, step));
        P.rr += clamp(want - P.rr, -1.2 * dt, 1.2 * dt);
        if (Math.abs(wrap(ga - P.a)) * P.rr < 0.05 && Math.abs(want - P.rr) < 0.04) {
          this.puffSet(P, 'swell', this.reefM(PUFF.swell) * (this.PM?.warn || 1));
          this.emit('puffSwell', { ...this.puffXY(P), id: P.id });
        }
        break;
      }
      case 'swell': if ((P.t -= dt) <= 0) { this.puffSet(P, 'big', this.reefM(PUFF.big)); this.puffFixOn(P); this.emit('puffBig', { ...this.puffXY(P), id: P.id }); } break;
      case 'big': {
        if (this.puffPoked(P)) break;
        if ((P.t -= dt) <= 0) { this.puffFixOff(P); this.puffSet(P, 'shrink', PUFF.shrink); this.emit('puffShrink', { ...this.puffXY(P), id: P.id }); }
        break;
      }
      case 'shrink': if ((P.t -= dt) <= 0) { P.cd = this.reefM(PUFF.rest); this.puffSet(P, 'drift'); } break;
      case 'pop': // a jet of air sends it tumbling back to the middle of its channel, then it is dazed
        P.a = wrap(P.a + (P.face * 1.6 * dt) / Math.max(0.5, P.rr));
        P.rr += clamp(this.reefMid(P.ch) - P.rr, -1.2 * dt, 1.2 * dt);
        if ((P.t -= dt) <= 0) { this.puffSet(P, 'drift'); P.stn = PUFF.stun; }
        break;
    }
  },
  // a swollen puffer pops on a thorn of the ring above it (thorns pointing out into its channel), a zapped egg or ring
  puffPoked(P) {
    const c = this.puffXY(P), above = this.rings[P.ch - 1];
    if (above) {
      const ra = above.body.getAngle();
      for (const th of above.thorns) {
        if (!th.alive || th.ext < 0.3 || th.side !== 'out') continue;
        const ta = ra + th.a, tr = above.r + RING_TH / 2 + (th.h || 0.26) * 0.85, x = tr * Math.cos(ta), y = tr * Math.sin(ta);
        if (Math.hypot(x - c.x, y - c.y) < PUFF.r + 0.06) return this.puffPop(P, 'thorn');
      }
    }
    if (this.rings[P.ch].stun > 0 || (above && above.stun > 0)) return this.puffPop(P, 'zap');
    for (const e of this.aliveEggs()) if (e.zap && e.body.isActive()) { const p = e.body.getPosition(); if (Math.hypot(p.x - c.x, p.y - c.y) < PUFF.r + 0.32) { e.zap = 0; return this.puffPop(P, 'zap'); } }
    return false;
  },
  // impactCheck (sim.js): an egg hit the swollen puffer. Hard: its spines crack it. Soft: a bouncy, safe landing.
  pufferBump(egg, v, id, pt) {
    const P = this.puffs[id];
    egg.freefall = 0; egg.drop = 0;
    if (!P) return;
    if (v > this.reefM(this.water ? PUFF.spineW : PUFF.spine) && egg.crackCD <= 0) { const x = pt.x, y = pt.y; this.defer(() => { if (egg.alive) this.crack(egg, v, 'spine'); }); this.emit('puffSpine', { x, y, id }); return; } // after the step: a break adds bodies
    egg.soft = true;
    if (v > 1) this.emit('puffBounce', { x: pt.x, y: pt.y, v, id });
  },

  // ======================================================================== jellyfish
  jellyPos(J) {
    const n = this.rings.length, c2 = Math.min(n - 1, J.ch + 1), m1 = this.reefMid(J.ch), m2 = c2 > J.ch ? this.reefMid(c2) : m1;
    const r = m1 + (m2 - m1) * (0.5 - 0.5 * Math.cos(J.u));
    J.x = r * Math.cos(J.a); J.y = r * Math.sin(J.a);
  },
  jellyOne(J, dt, end) {
    if (J.ph === 'wait') { if (!end && (J.t -= dt) <= 0) { J.ph = 'in'; J.t = J.dur = JELLY.in; this.emit('jellyIn', { x: J.x, y: J.y, id: J.id }); } return; }
    J.al = J.ph === 'in' ? 1 - J.t / J.dur : J.ph === 'flush' ? clamp(J.t / 1.2, 0, 1) * 0.9 : 1;
    if (J.fz > 0) { J.fz -= dt; if (J.fz <= 0) { J.fz = 0; this.emit('reefThaw', { x: J.x, y: J.y }); } return; }
    if (J.zp > 0) { J.zp -= dt; return; }
    if (J.cd > 0) J.cd -= dt;
    if (J.ph === 'in') { if ((J.t -= dt) <= 0) J.ph = 'float'; }
    if (J.ph === 'flush') { // swept out past the rim, then it drifts back in where it started
      const r = Math.hypot(J.x, J.y) + 1.6 * dt;
      J.x = r * Math.cos(J.a); J.y = r * Math.sin(J.a);
      if ((J.t -= dt) <= 0) { J.ph = 'in'; J.t = J.dur = JELLY.in; J.a = J.a0; J.u = 0; this.jellyPos(J); this.emit('jellyIn', { x: J.x, y: J.y, id: J.id }); }
      return;
    }
    const slow = J.stn > 0 ? 0.25 : 1;
    if (J.stn > 0) J.stn -= dt;
    J.a = wrap(J.a + J.dir * this.reefM(JELLY.w) * dt * slow);
    J.u += this.reefM(JELLY.u) * dt * slow;
    if (J.u > 1e4) J.u -= 2 * Math.PI * 1000;
    this.jellyPos(J);
    if (end || J.ph !== 'float') return;
    // water flushes it out
    for (const o of this.orbs) if (o.alive && o.type === 'water' && Math.hypot(o.x - J.x, o.y - J.y) < JELLY.wet) return this.jellyFlush(J);
    for (const e of this.aliveEggs()) if (e.water > 0 && e.body.isActive()) { const p = e.body.getPosition(); if (Math.hypot(p.x - J.x, p.y - J.y) < JELLY.wet * 0.75) return this.jellyFlush(J); }
    if (J.stn > 0) return;
    // the sting: eggs (once per egg every few seconds) and hermit crabs
    const sx = J.x, sy = J.y - 0.1, R = JELLY.r + 0.2;
    if (J.cd <= 0) for (const e of this.aliveEggs()) {
      if (!e.body.isActive() || e.chick || e.hc || (J.last === e.id && this.t - J.lastT < JELLY.again)) continue;
      const p = e.body.getPosition();
      if (Math.hypot(p.x - sx, p.y - sy) > R) continue;
      if (e.zap) { e.zap = 0; this.jellyStun(J, this.reefM(JELLY.stun), true); return; }
      J.last = e.id; J.lastT = this.t; J.cd = this.reefM(JELLY.cd);
      this.emit('jellySting', { x: p.x, y: p.y, id: J.id, egg: e });
      this.crack(e, 0, 'sting');
      break;
    }
    for (const H of this.hermits) if (this.hermitLive(H) && H.ph !== 'flip') { const b = this.hermitBody(H); if (Math.hypot(b.x - sx, b.y - sy) < R + 0.15) { this.hermitFlip(H, 'sting'); this.emit('jellySting', { x: b.x, y: b.y, id: J.id, crab: H.id }); } }
    for (const r of this.rings) if (r.stun > 0 && Math.abs(Math.hypot(J.x, J.y) - r.r) < JELLY.r + 0.1) { this.jellyStun(J, this.reefM(JELLY.stun), true); break; }
  },
  jellyFlush(J) { J.ph = 'flush'; J.t = J.dur = JELLY.flush; J.stn = 0; this.emit('jellyFlush', { x: J.x, y: J.y, id: J.id }); return true; },
  jellyStun(J, T, zap) { if (J.ph !== 'float' && J.ph !== 'in') return false; J.stn = Math.max(J.stn, T); J.zp = zap ? 0.3 : 0; this.emit('jellyStun', { x: J.x, y: J.y, id: J.id }); return true; },
  // the jellyfish's glow (render, and the silt cloud): is (x, y) lit by one?
  jellyLit(x, y) { return this.jellies.some((J) => (J.ph === 'float' || J.ph === 'in') && !(J.stn > 0) && Math.hypot(J.x - x, J.y - y) < JELLY.light); },

  // the warp gate (sim/warp.js) takes the hermit crab as it grabs; kingcrab.js handles a claw
  reefWarp(W, kind, X) {
    if (kind === 'kclaw') return this.kcWarp ? this.kcWarp(W, X) : false;
    if (kind !== 'hermit') return false;
    const b = this.hermitBody(X), r = this.reefFloor(X.ch) - HERMIT.bodyH, far = wrap(X.a + Math.PI * 0.8 * (X.a > -Math.PI / 2 ? -1 : 1));
    X.wa = far; X.tgt = 0;
    this.hermitSet(X, 'warp', 1.1);
    this.warpGate('in', b.x, b.y, 0.55, 0, 2.3, { pull: 1 });
    this.warpGate('out', r * Math.cos(far), r * Math.sin(far), 0.45, 0.55, 1.1, {});
    this.emit('warpOpen', { x: b.x, y: b.y, r: 0.55, kind: 'h' });
    return true;
  },

  // ======================================================================== powers, hazards, the live ring
  // p2All kinds (powers2.js): ice (frozen T), bolt (stunned T), pepper / scare (back off), spin / out (flung), zap
  reefP2(kind, T) {
    for (const H of this.hermits) {
      if (!this.hermitLive(H)) continue;
      if (kind === 'ice') { H.fz = Math.max(H.fz, T); if (H.ph === 'pinch' || H.ph === 'stalk') this.hermitSet(H, 'walk'); this.emit('p2Hit', { kind: 'ice', ...this.hermitBody(H) }); }
      else if (kind === 'bolt') { if (this.hermitFlip(H, 'zap', Math.min(T, 4))) H.zp = 0.3; }
      else if (kind === 'pepper' || kind === 'scare') { this.hermitLetGo(H, 'scare'); this.hermitSet(H, 'rest', Math.min(T, 6)); }
      else this.hermitFlip(H, kind);
    }
    for (const P of this.puffs) {
      if (P.ph === 'wait') continue;
      if (kind === 'ice') { P.fz = Math.max(P.fz, T); this.emit('p2Hit', { kind: 'ice', ...this.puffXY(P) }); }
      else if (kind === 'bolt' || kind === 'zap') { if (!this.puffPop(P, 'zap')) { P.stn = Math.min(T, 4); P.zp = 0.3; } }
      else if (!this.puffPop(P, kind)) P.cd = Math.max(P.cd, 3);
    }
    for (const J of this.jellies) {
      if (J.ph !== 'float' && J.ph !== 'in') continue;
      if (kind === 'ice') { J.fz = Math.max(J.fz, T); this.emit('p2Hit', { kind: 'ice', x: J.x, y: J.y }); }
      else if (kind === 'bolt' || kind === 'zap') this.jellyStun(J, Math.min(T, 5), true);
      else if (kind === 'spin' || kind === 'out') this.jellyFlush(J);
    }
    this.kcP2?.(kind, T);
  },
  // the live ring (shock power) zaps what touches ring ri
  reefShock(ri, T) {
    for (const H of this.hermits) if (H.ch === ri && this.hermitLive(H) && H.ph !== 'flip' && !(H.hitCD > 0)) { if (this.hermitFlip(H, 'zap', Math.min(T, 3))) { H.zp = 0.3; this.emit('p2Hit', { kind: 'zap', ...this.hermitBody(H) }); } }
    for (const P of this.puffs) if ((P.ph === 'big' || P.ph === 'swell') && (P.ch === ri || P.ch - 1 === ri)) this.puffPop(P, 'zap');
    const R = this.rings[ri].r;
    for (const J of this.jellies) if (!(J.stn > 0) && Math.abs(Math.hypot(J.x, J.y) - R) < JELLY.r + 0.15 && this.jellyStun(J, this.reefM(JELLY.stun), true)) this.emit('p2Hit', { kind: 'zap', x: J.x, y: J.y });
    this.kcShock?.(ri, T);
  },
  // hazards (boss.js animalsHit via sea.js seaHit) and the chick powers: gust rock lava ice bolt quake flash dash
  reefHit(kind, o = {}) {
    const x = o.x ?? 0, y = o.y ?? 0, r = o.r ?? Infinity, near = (q, pad) => r === Infinity || Math.hypot(q.x - x, q.y - y) < r + pad;
    let n = 0;
    if (kind === 'gust') return 0;
    for (const H of this.hermits) if (this.hermitLive(H) && near(this.hermitBody(H), 0.35)) { if (this.hermitFlip(H, kind)) { n++; if (kind === 'bolt') H.zp = 0.3; } }
    for (const P of this.puffs) if (P.ph !== 'wait' && near(this.puffXY(P), 0.4)) { if (kind === 'quake') continue; if (this.puffPop(P, kind)) n++; else if (kind === 'bolt' || kind === 'flash') { P.stn = 2; n++; } }
    for (const J of this.jellies) if (near(J, 0.35) && (kind === 'bolt' || kind === 'flash') && this.jellyStun(J, kind === 'bolt' ? 3 : 2, kind === 'bolt')) n++;
    if (this.kcHit) n += this.kcHit(kind, o);
    return n;
  },

  // ---------- planner / danger: 1 = taken (claw or pile), less = about to be
  reefThreat(e) {
    if (e.hc === 1) return 0.35; // safe from thorns, but it walks the wrong way
    let v = 0;
    for (const H of this.hermits) if (H.tgt === e.id && H.ph === 'pinch') v = Math.max(v, 0.3);
    for (const J of this.jellies) {
      if (J.ph !== 'float' || J.stn > 0 || J.fz > 0 || !e.body) continue;
      const p = e.body.getPosition(), d = Math.hypot(p.x - J.x, p.y - J.y + 0.1);
      if (d < 1.1) v = Math.max(v, 0.25 * (1 - d / 1.1));
    }
    return Math.max(v, this.kcThreat ? this.kcThreat(e) : 0);
  },
  reefScore() { return this.kcScore ? this.kcScore() : 0; },

  // ---------- state
  reefState() {
    return { hermits: this.hermits.map((H) => ({ ...H })), puffs: this.puffs.map((P) => ({ ...P })), jellies: this.jellies.map((J) => ({ ...J })), kc: this.kcState ? this.kcState() : null };
  },
  reefLoad(S) {
    if (!S) return;
    this.hermits = S.hermits.map((H) => ({ ...H }));
    this.puffs = S.puffs.map((P) => ({ ...P }));
    this.jellies = S.jellies.map((J) => ({ ...J }));
    this.pfFix = [];
    for (const P of this.puffs) if (P.ph === 'big') this.puffFixOn(P);
    if (S.kc && this.kcLoad) this.kcLoad(S.kc);
    for (const e of this.eggs) if (e.hc && e.body) e.body.setActive(false);
  },
};
