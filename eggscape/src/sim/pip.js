// Pip the penguin (0.8.17, level 16: the Frozen Lake's curler). Mixed into Sim (sim.js: Object.assign(Sim.prototype,
// pipMethods)), so `this` is the Sim. No imports from sim.js (it imports this file). Every field is plain data in this.pips
// (pipState / pipLoad), so rewind and the planner stay exact. No randomness at all.
//
// level.penguin = { ch, a, delay } (or an array): ch = his home channel (1 .. rings-1), a = where he pops in (deg, world,
// -90 = straight down), delay = s before he comes in. Art: render/penguin.js (drawn by render/pip.js).
//
// He lives on the floor of a channel (the inner face of ring ch, like the rats) and is never carried by it: the floor is
// ice, the ring slides under him. That is the whole counter kit: turn his floor ring and you move gaps, walls and sponge
// pads under him.
//   ROAM   he winds up (crouch, backs up, rump wiggle: WARN s, the telegraph), then belly-slides. On ice he never stops by
//          himself: the channel is a bowl, he swings through it like a pendulum (pull GI along the floor), back and forth.
//          A gap under him: he teeters and drops through with a happy "wheee" (PIP.fall s) into the next channel out; from the
//          outermost channel he drops out of the vault, is gone PIP.away s, then pops back in at his home channel.
//   SHOVE  an egg he meets while sliding is pushed ahead of him like a curling stone (up to PIP.train eggs in a row). An egg
//          pushed over a gap drops through it (a skilled player lines one up: Pip does the work); pushed into a floor thorn it
//          meets the thorn (the thorn breaks it, as it would any egg). He keeps a pushed egg at his beak both ways of the swing.
//   CARRY  an egg resting next to him while he stands is tucked under a flipper (PIP.tuck s) and carried off on the slide.
//          He lets go of it when he drops through a gap (it falls through first; from the outermost channel it is set down
//          beside the gap instead) and when he bumps a wall (put down, unharmed). He never leaves the vault with an egg and
//          never cracks one himself.
//   COUNTERS a wall in his way (a floor thorn cluster or a wooden barrier; turn one into his path) and he bumps: flattened,
//          stars, then dizzy PIP.dizzy s, and lets go of everything. A sponge pad under his slide stops him with a boing. Frost
//          (the frost orb's frozen ring, the freeze powers) he loves: he stops to wave, nothing more. A stone (or iron) egg is
//          too heavy to carry: he can only shove it, and a stone egg rolling into him knocks him over.
// Powers and hazards (pipHit, from boss.js animalsHit, powers2.js p2All, strike.js stkApply, chicks.js flash and dash):
//   ice: a wave | bolt, zap, flash, dash, rock, lava, glue, tock: dizzy | out (a blast): out of the vault for a while | spin:
//   thrown to the outermost channel, dizzy | pepper: ah-CHOO, the sneeze shoots him off on his belly the other way, and he
//   leaves eggs alone for a while | scare (the Scarecrow, the laser): he stays out of the vault | quake: knocked onto his
//   belly into a slide | gust: a shove along his channel.
import { RING_TH, EGG_W, EGG_H, wrap, clamp } from './geom.js';
import { dynOf, tellS } from '../data/dynamism.js'; // 0.8.19 its temper (the dynamism table)

const m3 = (easy, medium, hard) => ({ easy, medium, hard });
export const PIP = {
  m: 0.68, // metres per 100 rig units (render/penguin.js PENGUIN_M is the artist's 0.85): standing about 0.8 m (a channel is 0.84 high), an egg 0.56
  gi: 2.2, // m/s^2: the ice's pull along the floor toward the bottom of the channel (the bowl he swings in)
  v0: m3(1.3, 1.55, 1.75), // m/s: the push off at the end of the wind-up
  vmax: 2.6, // m/s
  warn: m3(1.35, 1.0, 0.8), // s: the wind-up (the telegraph)
  front: 0.42, // m: from the point between his feet to his beak when he lies flat (what bumps a wall, where a shoved egg sits)
  back: 0.3, // m: behind that point, flat
  stand: 0.22, // m: half his footprint standing (a wall turned into him, an egg he bumps into)
  gapIn: 0.1, // m: how far inside a gap's edge his feet must be before he drops
  pick: 0.95, // m: an egg resting this close (along the floor) when he stands is his to tuck
  waddle: 0.55, // m/s
  tuck: 0.45, look: 0.4, dive: 0.4, // s
  fall: 0.95, teeter: 0.3, // s: the whole fall, the teeter on the lip first
  bump: 0.85, dizzy: m3(3.6, 3, 2.4), shake: 0.9, boing: 0.5, wave: 1.6, sneeze: 1.25, // s
  sulk: 2.2, // s after a bump or a boing before he picks up eggs again
  away: m3(10, 8, 7), in: 0.8, // s out of the vault after he dropped out of it, the pop back in
  train: 3, // eggs he can shove in a row
  thMax: 1.25, // rad from the bottom: the steepest he slides up the bowl
  stoneKnock: 0.9, // m/s: a stone egg rolling into him this fast knocks him over
  flee: 6, // s he leaves eggs alone after a pepper sneeze
};
// phases in which he stands on his feet (a gap under him, or a wall turned into him, still counts)
const STAND = new Set(['look', 'waddle', 'tuck', 'windup', 'dizzy', 'shake', 'wave', 'sneeze', 'land']);
const GONE = new Set(['wait', 'away', 'out', 'gone']);
const sstep = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };

export const pipMethods = {
  pipInit(L) {
    this.pips = [];
    const list = !L.penguin ? [] : Array.isArray(L.penguin) ? L.penguin : [L.penguin];
    const n = this.rings.length;
    if (n < 2) return;
    list.forEach((o, i) => {
      const ch = clamp(o.ch ?? 1, 1, n - 1), a0 = (((o.a ?? -120) * Math.PI) / 180);
      this.pips.push({
        id: i, home: ch, a0, ch, a: a0, r: this.pipFloor(ch), v: 0, face: o.face || 1, ph: 'wait', t: o.delay ?? 3, dur: o.delay ?? 3,
        st: 0, // s in the current slide (the dive), or the fall
        eid: 0, train: [], // the egg under his flipper; the eggs he shoves (ids, nearest first)
        r0: 0, r1: 0, ch1: 0, // a fall: from radius, to radius, into channel
        sulk: 0, flee: 0, padSkip: 0, hitCD: 0, frostSeen: 0, n: 0, why: '', alpha: 1, tgt: 0, dizT: 0,
        skip: {}, // egg id -> s: an egg he just let go of is left alone a moment (so one he shoved over a gap can fall)
      });
    });
  },
  pipFloor(ch) { return this.rings[ch].r - RING_TH / 2; },
  pipM(o) { return o[this.mode] ?? o.medium; },
  pipSet(P, ph, t = 0) { P.ph = ph; P.t = P.dur = t; },
  pipLive(P) { return !GONE.has(P.ph) && P.ph !== 'in'; },
  pipTheta(P) { return wrap(P.a + Math.PI / 2 * (this.gy || 1)); }, // angle from the bottom of the channel (+ = counter-clockwise)
  // a world point f m along the floor from his feet (along +a), h m up off the floor
  pipPt(P, f, h) { const r = P.r - h, a = P.a + f / Math.max(0.5, r); return { x: r * Math.cos(a), y: r * Math.sin(a), a }; },
  pipBody(P) { return this.pipPt(P, P.ph === 'slide' || P.ph === 'boing' ? P.face * 0.12 : 0, P.ph === 'slide' ? 0.18 : 0.32); },
  pipArc(P, wa) { return wrap(wa - P.a) * P.r; }, // m along the floor from him to world angle wa (+ = counter-clockwise)
  pipEgg(id) { return id ? this.eggs.find((e) => e.id === id && e.alive && !e.saved) || null : null; },

  // ---------- every step (sim.js), with the creatures' dt
  pipStep(dt) {
    if (!this.pips || !this.pips.length) return;
    for (const P of this.pips) {
      if (P.hitCD > 0) P.hitCD -= dt;
      if (P.sulk > 0) P.sulk -= dt;
      if (P.flee > 0) P.flee -= dt;
      for (const id in P.skip) if ((P.skip[id] -= dt) <= 0) delete P.skip[id];
      if (this.state !== 'play') { this.pipEnd(P, dt); continue; }
      this.pipFrost(P);
      this.pipOne(P, dt);
      this.pipHold(P);
    }
  },
  pipOne(P, dt) {
    switch (P.ph) {
      case 'wait': if ((P.t -= dt) <= 0) this.pipEnter(P); return;
      case 'away': if ((P.t -= dt) <= 0) this.pipEnter(P); return;
      case 'gone': return;
      case 'in': if ((P.t -= dt) <= 0) this.pipSet(P, 'look', PIP.look); return;
      case 'out': { // dropping out of the bottom of the vault, flippers up
        P.st += dt; const u = clamp(P.st / 1.1, 0, 1);
        P.r = P.r0 + (P.r1 - P.r0) * u * u; P.alpha = 1 - sstep((u - 0.55) / 0.45);
        if (u >= 1) { P.alpha = 0; this.pipSet(P, 'away', P.why === 'gap' || !(P.t > 0) ? this.pipM(PIP.away) : P.t); }
        return;
      }
      case 'fall': this.pipFall(P, dt); return;
      case 'slide': this.pipSlide(P, dt); return;
      case 'bump': if ((P.t -= dt) <= 0) this.pipSet(P, 'dizzy', P.why === 'hit' ? P.dizT : this.pipM(PIP.dizzy)); break;
      case 'boing': if ((P.t -= dt) <= 0) this.pipSet(P, 'shake', PIP.shake); break;
      case 'dizzy': case 'shake': case 'land': case 'wave': case 'tuck':
        if ((P.t -= dt) <= 0) { if (P.ph === 'tuck') this.pipTake(P); this.pipSet(P, 'look', P.ph === 'tuck' ? 0.15 : PIP.look); }
        break;
      case 'sneeze':
        if ((P.t -= dt) <= 0) { P.face = -P.face; this.pipLaunch(P, 2.2, 'sneeze'); return; }
        break;
      case 'look': if ((P.t -= dt) <= 0) this.pipThink(P); break;
      case 'waddle': this.pipWaddle(P, dt); break;
      case 'windup':
        if ((P.t -= dt) <= 0) { this.pipLaunch(P, this.pipM(PIP.v0), 'go'); return; }
        break;
    }
    if (STAND.has(P.ph)) this.pipStanding(P);
  },
  pipEnter(P) {
    P.ch = P.home; P.r = this.pipFloor(P.ch); P.a = P.a0; P.v = 0; P.alpha = 1; P.st = 0; P.train = []; P.eid = 0;
    this.pipSet(P, 'in', PIP.in);
    const b = this.pipBody(P);
    this.emit('pipIn', { id: P.id, x: b.x, y: b.y });
  },

  // ---------- standing: a gap slid under him drops him; a wall turned into him knocks him over; an egg that rolls into him
  pipStanding(P) {
    const g = this.pipGapAt(P.ch, P.a, PIP.gapIn);
    if (g) { this.pipDrop(P, 'gap'); return; }
    if (P.ph !== 'dizzy' && P.ph !== 'bump') {
      const w = this.pipWallNear(P, -PIP.stand, PIP.stand);
      if (w) { P.face = w.d > 0 ? 1 : -1; this.pipBump(P, w.k); return; }
    }
    for (const e of this.aliveEggs()) {
      if (!this.pipFree(e) || this.pipHas(P, e) || P.skip[e.id]) continue;
      const q = this.pipRel(P, e);
      if (!q.on || Math.abs(q.f) > PIP.stand + EGG_H / 2 - 0.08) continue;
      const v = e.body.getLinearVelocity(), sp = Math.hypot(v.x, v.y);
      if (this.pipHeavy(e)) { if (sp > PIP.stoneKnock && P.ph !== 'dizzy' && P.ph !== 'bump') { P.face = q.f > 0 ? 1 : -1; this.pipBump(P, 'stone'); return; } continue; }
      if (P.eid || P.sulk > 0 || P.flee > 0 || P.ph === 'dizzy' || P.ph === 'bump' || P.ph === 'tuck' || this.pipDecoy()) continue;
      if (sp > 2.5) continue; // too fast to catch
      P.face = q.f >= 0 ? 1 : -1; P.tgt = e.id; this.pipSet(P, 'tuck', PIP.tuck);
      this.emit('pipTuck', { id: P.id, egg: e, ...this.pipBody(P) });
      return;
    }
  },
  // where egg e sits from him: f = m along the floor (+ = his +a side), h = m off the floor; on = in his channel near the floor
  pipRel(P, e) {
    const p = e.body.getPosition(), d = Math.hypot(p.x, p.y), wa = Math.atan2(p.y, p.x);
    const h = P.r - d, f = this.pipArc(P, wa);
    return { f, h, on: this.channelOf(e) === P.ch && h > -0.05 && h < 0.62, wa };
  },
  pipHas(P, e) { return P.eid === e.id || P.train.includes(e.id); },
  pipHeavy(e) { return e.stone > 0 || !!e.iron; },
  // an egg he may touch: loose in the vault (no other creature, power or chick has it)
  pipFree(e) {
    if (!e.alive || e.saved || !e.body || !e.body.isActive() || e.chick || e.phx || e.thf || e.octo || e.hc || e.clamp || e.honey > 0 || e.icy > 0 || e.bubble > 0 || e.sbub) return false;
    if (this.stk && this.stk.held && this.stk.held[e.id]) return false; // glued
    return !this.pips.some((Q) => Q.eid === e.id || Q.train.includes(e.id));
  },
  pipDecoy() { return !!(this.p2 && this.p2.decoy); }, // a decoy in the vault: he has eyes only for that big shiny egg

  // ---------- deciding what to do next (standing, after a beat)
  pipThink(P) {
    P.n++;
    const th = this.pipTheta(P), down = th > 0.25 ? -1 : th < -0.25 ? 1 : 0;
    const away = (f) => { const w = this.pipWallNear(P, f > 0 ? 0 : -0.9, f > 0 ? 0.9 : 0); return w ? -f : f; }; // never wind up into a wall right in front of him
    if (P.eid) { P.face = away(down || (P.n % 2 ? 1 : -1)); this.pipWind(P); return; }
    let best = null;
    if (!(P.flee > 0) && !(P.sulk > 0) && !this.pipDecoy()) for (const e of this.aliveEggs()) {
      if (!this.pipFree(e) || P.skip[e.id]) continue;
      const q = this.pipRel(P, e);
      if (!q.on) continue;
      const v = e.body.getLinearVelocity();
      if (Math.hypot(v.x, v.y) > 1.0) continue; // a rolling egg: wait until it settles (on ice an egg rocks to and fro in the bowl: that counts as still)
      if (!best || Math.abs(q.f) < Math.abs(best.q.f)) best = { e, q };
    }
    if (best) {
      P.face = best.q.f >= 0 ? 1 : -1;
      if (Math.abs(best.q.f) <= PIP.pick && !this.pipHeavy(best.e)) { P.tgt = best.e.id; this.pipSet(P, 'waddle', 4); return; }
      this.pipWind(P); // curling: he aims at it
      return;
    }
    P.face = away(down || (P.n % 2 ? 1 : -1));
    this.pipWind(P);
  },
  pipWind(P) {
    this.pipSet(P, 'windup', tellS(this.pipM(PIP.warn), dynOf(this, 'penguin').tell) * this.menaceTell()); // 0.8.19 the table's tell
    const b = this.pipBody(P);
    this.emit('pipWarn', { id: P.id, x: b.x, y: b.y, face: P.face, a: P.a, r: P.r });
  },
  pipWaddle(P, dt) {
    const e = this.pipEgg(P.tgt);
    if ((P.t -= dt) <= 0 || !e || !this.pipFree(e)) { this.pipSet(P, 'look', PIP.look); return; }
    const q = this.pipRel(P, e);
    if (!q.on) { this.pipSet(P, 'look', PIP.look); return; }
    P.face = q.f >= 0 ? 1 : -1;
    const left = Math.abs(q.f) - (PIP.stand + EGG_H / 2 - 0.1);
    if (left <= 0) { this.pipSet(P, 'tuck', PIP.tuck); this.emit('pipTuck', { id: P.id, egg: e, ...this.pipBody(P) }); return; }
    const d = Math.min(left, PIP.waddle * dt);
    P.a = wrap(P.a + (P.face * d) / P.r); P.st += d; // st: the waddle's odometer (the gait)
  },
  pipTake(P) {
    const e = this.pipEgg(P.tgt);
    P.tgt = 0;
    if (!e || !this.pipFree(e) || this.pipHeavy(e)) return;
    const q = this.pipRel(P, e);
    if (!q.on || Math.abs(q.f) > PIP.pick + 0.2) return;
    P.eid = e.id;
    this.emit('pipGrab', { id: P.id, egg: e, ...this.pipBody(P) });
  },

  // ---------- the slide
  pipLaunch(P, v, why) {
    P.v = P.face * v; P.st = 0;
    P.padSkip = this.pipPadAt(P.ch, P.a) || this.pipPadAt(P.ch, this.pipPt(P, P.face * PIP.front, 0).a) ? 1 : 0; // he may push off from a pad (or right beside one); the next pad stops him
    this.pipSet(P, 'slide', 0);
    const b = this.pipBody(P);
    this.emit('pipSlide', { id: P.id, x: b.x, y: b.y, face: P.face, why });
  },
  pipSlide(P, dt) {
    P.st += dt;
    const th = this.pipTheta(P);
    P.v = clamp(P.v - PIP.gi * Math.sin(th) * dt, -PIP.vmax, PIP.vmax);
    P.a = wrap(P.a + (P.v * dt) / P.r);
    const th2 = this.pipTheta(P);
    if (Math.abs(th2) > PIP.thMax) { P.a = wrap(P.a - Math.sign(th2) * (Math.abs(th2) - PIP.thMax)); if (Math.sign(P.v) === Math.sign(th2)) P.v = 0; }
    if (!P.train.length && Math.abs(P.v) > 0.02) P.face = P.v > 0 ? 1 : -1; // with eggs at his beak he keeps facing them (slides back feet first)
    if (P.padSkip && !this.pipPadAt(P.ch, P.a) && !this.pipPadAt(P.ch, this.pipPt(P, P.face * PIP.front, 0).a)) P.padSkip = 0;
    const dir = P.v >= 0 ? 1 : -1;
    // the eggs he shoves: one over a gap drops through it
    for (let i = 0; i < P.train.length; i++) {
      const e = this.pipEgg(P.train[i]);
      if (!e) continue;
      const q = this.pipTrainPt(P, i);
      if (this.pipGapAt(P.ch, q.a, EGG_W * 0.3, e)) { P.train.splice(i, 1); i--; this.pipLetGo(e, 'gap', q, 1.1, 0, P); this.emit('pipShoveIn', { id: P.id, egg: e, x: q.x, y: q.y }); }
    }
    P.train = P.train.filter((id) => this.pipEgg(id)); // (a thorn broke one)
    // a gap under him: wheee
    if (this.pipGapAt(P.ch, P.a, PIP.gapIn)) { this.pipDrop(P, 'gap'); return; }
    // a wall in the way: the eggs he shoves hit it first (a thorn breaks an egg that is pushed into it: let the contact do it)
    const lead = P.face === dir ? PIP.front + P.train.length * (EGG_H + 0.03) : PIP.back + (P.eid ? EGG_H - 0.1 : 0); // the egg under his flipper trails behind him
    const w = this.pipWallNear(P, dir > 0 ? 0 : -lead, dir > 0 ? lead : 0, true);
    if (w) {
      const dd = Math.abs(w.d);
      if (w.k === 'thorn' && P.face === dir && P.train.length && dd > PIP.front + 0.13) { /* the front egg meets the thorn on its own */ }
      else if (Math.abs(P.v) > 0.05 || w.k === 'barrier') { this.pipBump(P, w.k); return; }
    }
    // a sponge pad under his front (or under the egg he shoves): boing
    if (!P.padSkip && Math.abs(P.v) > 0.3) {
      const f = this.pipPt(P, dir * (P.face === dir ? PIP.front + P.train.length * (EGG_H + 0.03) : PIP.back) * 0.8, 0);
      if (this.pipPadAt(P.ch, f.a) || (P.train.length && this.pipPadAt(P.ch, this.pipTrainPt(P, 0).a))) { this.pipBoing(P); return; }
    }
    // eggs he meets: shoved ahead (or caught if they roll into him from behind)
    if (P.train.length < PIP.train && !(P.flee > 0) && !this.pipDecoy()) {
      for (const e of this.aliveEggs()) {
        if (!this.pipFree(e) || this.pipHas(P, e) || P.skip[e.id]) continue;
        const q = this.pipRel(P, e);
        if (!q.on || q.h > 0.5) continue;
        const ahead = q.f * P.face, reach = PIP.front + P.train.length * (EGG_H + 0.03) + EGG_H / 2;
        if (P.face !== dir && !P.eid && !this.pipHeavy(e) && -ahead > -0.05 && -ahead < PIP.back + EGG_H / 2) { P.eid = e.id; this.emit('pipGrab', { id: P.id, egg: e, ...this.pipBody(P) }); continue; } // sliding back feet first into it: tucked
        if (ahead > -0.05 && ahead < reach) {
          P.train.push(e.id);
          const p = e.body.getPosition(); this.emit('pipShove', { id: P.id, egg: e, x: p.x, y: p.y, v: Math.abs(P.v), n: P.train.length });
          if (P.train.length >= PIP.train) break;
        }
      }
    }
  },
  // where the i-th egg he shoves sits: lying on the floor at his beak, end to end
  pipTrainPt(P, i) {
    const f = P.face * (PIP.front + EGG_H / 2 - 0.02 + i * (EGG_H + 0.03)), q = this.pipPt(P, f, EGG_W / 2 + 0.005);
    return { ...q, ang: q.a + Math.sin(P.st * 3 + i) * 0.04 };
  },
  // where the egg under his flipper rides: upright against his side when he stands, lying at his heels when he slides
  pipCarryPt(P) {
    if (P.ph === 'slide' || P.ph === 'boing') { const q = this.pipPt(P, -P.face * (PIP.back + EGG_H / 2 - 0.14), EGG_W / 2 + 0.01); return { ...q, ang: q.a }; } // trailing at his heels (so both read)
    const q = this.pipPt(P, P.face * 0.2, EGG_H / 2 + 0.02); return { ...q, ang: q.a + Math.PI / 2 };
  },
  // pin what he holds (sim.js steps the world after this, like the thieves)
  pipHold(P) {
    const e = this.pipEgg(P.eid);
    if (P.eid && !e) P.eid = 0;
    if (e && (P.ph === 'fall' || P.ph === 'out')) { P.eid = 0; } // let go as he drops (pipDrop put it over the gap)
    else if (e) { const q = this.pipCarryPt(P); this.pipPin(e, q.x, q.y, q.ang); }
    P.train = P.train.filter((id) => this.pipEgg(id));
    if (P.ph !== 'slide') { for (const id of P.train) this.pipLetGo(this.pipEgg(id), 'stop', null, 0, 0, P); P.train = []; return; }
    P.train.forEach((id, i) => { const q = this.pipTrainPt(P, i); this.pipPin(this.pipEgg(id), q.x, q.y, q.ang); });
  },
  pipPin(e, x, y, ang) {
    const b = e.body;
    b.setTransform({ x, y }, ang);
    b.setLinearVelocity({ x: 0, y: 0 }); b.setAngularVelocity(0);
    e.ch = this.channelOf(e); e.freefall = 0; e.drop = 0;
  },
  // put an egg down (at q if given) with vOut m/s outward (through a gap) and the slide's speed along the floor
  pipLetGo(e, why, q, vOut, vAlong = 0, P = null) {
    if (!e || !e.alive) return;
    if (P) P.skip[e.id] = why === 'gap' || why === 'fall' ? 1.2 : 0.8;
    const b = e.body;
    if (q) b.setTransform({ x: q.x, y: q.y }, b.getAngle());
    const p = b.getPosition(), d = Math.hypot(p.x, p.y) || 1, ux = p.x / d, uy = p.y / d;
    b.setLinearVelocity({ x: ux * vOut - uy * vAlong, y: uy * vOut + ux * vAlong }); b.setAngularVelocity(0);
    e.safeT = Math.max(e.safeT || 0, 0.6);
    e.ch = this.channelOf(e); e.freefall = 0; e.drop = 0;
    this.emit('pipDrop', { why, egg: e, x: p.x, y: p.y });
  },
  pipLetAll(P, why, vAlong = 0) {
    const c = this.pipEgg(P.eid);
    if (c) { const q = this.pipPt(P, -P.face * 0.05, EGG_W / 2 + 0.02); this.pipLetGo(c, why, { x: q.x, y: q.y }, 0, 0, P); }
    P.eid = 0;
    for (const id of P.train) this.pipLetGo(this.pipEgg(id), why, null, 0, vAlong, P);
    P.train = [];
  },

  // ---------- the ring under him: gaps, pads, walls
  // an open gap of floor ring ch whose opening covers world angle wa with `inside` m to spare (e: the egg that would use it)
  pipGapAt(ch, wa, inside, e = null) {
    const ring = this.rings[ch];
    if (!ring) return null;
    const ra = ring.body.getAngle();
    for (const g of ring.gaps) {
      if (!this.snakeGap(g) || g.len < 0.55 || (g.o != null && g.o < 0.5) || (e && !this.gapOpenFor(g, e))) continue;
      if (Math.abs(wrap(ra + g.a - wa)) * ring.r < g.len / 2 - inside) return g;
    }
    return null;
  },
  pipPadAt(ch, wa) {
    const ring = this.rings[ch];
    if (!ring) return false;
    let la = wrap(wa - ring.body.getAngle());
    if (la < 0) la += Math.PI * 2;
    for (const s of ring.segs) if (s.alive && s.pad && ((la >= s.a0 && la < s.a1) || (la + Math.PI * 2 >= s.a0 && la + Math.PI * 2 < s.a1))) return true;
    return false;
  },
  // the nearest wall between f0 and f1 m along the floor from him: {k: 'thorn' | 'barrier', d: m}. Floor thorns and wooden barriers.
  pipWallNear(P, f0, f1) {
    const ring = this.rings[P.ch], ra = ring.body.getAngle();
    let best = null;
    const see = (k, wa, half) => { const d = this.pipArc(P, wa); if (d + half >= f0 && d - half <= f1 && (!best || Math.abs(d) < Math.abs(best.d))) best = { k, d }; };
    for (const th of ring.thorns) if (th.alive && th.side !== 'out' && (th.ext ?? 1) > 0.5) see('thorn', ra + th.a, 0.13); // a thorn's base is 0.26 m wide (sim.js addThorn)
    for (const b of this.barriers || []) if (b.alive && b.ring === P.ch) see('barrier', ra + b.a, b.w / 2);
    return best;
  },

  // ---------- what stops him
  pipBump(P, why) {
    this.pipLetAll(P, 'bump');
    P.v = 0; P.why = why === 'hit' ? 'hit' : ''; P.sulk = (PIP.sulk * dynOf(this, 'penguin').rest) / this.menaceHeat() + this.pipM(PIP.dizzy);
    this.pipSet(P, 'bump', PIP.bump);
    const b = this.pipBody(P);
    this.emit('pipBump', { id: P.id, x: b.x, y: b.y, why, face: P.face });
  },
  pipBoing(P) {
    this.pipLetAll(P, 'pad', P.v * 0.6); // the eggs he shoved slide on, like curling stones let go
    P.v = 0; P.sulk = (PIP.sulk * dynOf(this, 'penguin').rest) / this.menaceHeat(); // 0.8.19 its rest x the table / the heat
    this.pipSet(P, 'boing', PIP.boing);
    const b = this.pipBody(P);
    this.emit('pipBoing', { id: P.id, x: b.x, y: b.y });
  },
  // through a gap of his floor ring: the egg under his flipper falls through just ahead of him, the shoved ones stay
  pipDrop(P, why) {
    const c = this.pipEgg(P.eid), last = P.ch >= this.rings.length - 1;
    if (c && !last) { const q = this.pipPt(P, 0, EGG_W / 2 + 0.02); this.pipLetGo(c, 'fall', { x: q.x, y: q.y }, 1.0, 0, P); }
    else if (c) { // the way out of the vault: he never takes an egg with him; it is set down on the floor beside the gap
      let f = -P.face * 0.5;
      for (const d of [-P.face * 0.5, P.face * 0.5, -P.face * 0.8, P.face * 0.8]) if (!this.pipGapAt(P.ch, this.pipPt(P, d, 0).a, -EGG_W * 0.6)) { f = d; break; }
      const q = this.pipPt(P, f, EGG_W / 2 + 0.02); this.pipLetGo(c, 'stop', { x: q.x, y: q.y }, 0, 0, P);
    }
    P.eid = 0;
    for (const id of P.train) this.pipLetGo(this.pipEgg(id), 'fall', null, 0, 0, P);
    P.train = [];
    const n = this.rings.length;
    P.v = 0; P.st = 0; P.r0 = P.r; P.ch1 = last ? n : P.ch + 1; P.r1 = last ? this.outerR + 1.8 : this.pipFloor(P.ch + 1);
    P.why = why;
    this.pipSet(P, 'fall', PIP.fall);
    const b = this.pipBody(P);
    this.emit('pipFall', { id: P.id, x: b.x, y: b.y, out: last ? 1 : 0, why });
  },
  pipFall(P, dt) {
    P.st += dt;
    const u = clamp((P.st - PIP.teeter) / (PIP.fall - PIP.teeter), 0, 1);
    if (P.ch1 >= this.rings.length) { // out of the vault: the drop goes on below the rings
      if (u > 0) { P.r0 = P.r; P.st = 0; this.pipSet(P, 'out', 0); }
      return;
    }
    P.r = P.r0 + (P.r1 - P.r0) * u * u;
    if (u >= 1) {
      P.ch = P.ch1; P.r = P.r1;
      this.pipSet(P, 'land', 0.35);
      const b = this.pipBody(P);
      this.emit('pipLand', { id: P.id, x: b.x, y: b.y, ch: P.ch });
    }
  },
  // the level is decided: a win and he sits down to sulk with a fish; a loss and he waves
  pipEnd(P, dt) {
    if (P.eid || P.train.length) this.pipLetAll(P, 'end');
    if (GONE.has(P.ph) || P.ph === 'fall') { if (P.ph === 'fall') { P.ph = 'away'; P.alpha = 0; } return; }
    const win = this.state === 'winning' || this.state === 'won';
    if (P.ph !== 'sulk' && P.ph !== 'cheer') { P.v = 0; this.pipSet(P, win ? 'sulk' : 'cheer', 99); }
    P.t -= dt;
  },

  // ---------- powers and hazards. kind: ice | bolt | zap | flash | dash | rock | lava | glue | tock | out | spin | pepper |
  // scare | quake | gust. o.r / o.x / o.y: only a penguin that close; o.p: the penguin itself. T: the power's time.
  pipHit(kind, o = {}, T = 0) {
    let n = 0;
    for (const P of this.pips || []) {
      if (o.p && o.p !== P) continue;
      if (!this.pipLive(P) && !(kind === 'scare' && P.ph === 'away')) continue;
      const b = this.pipBody(P);
      if (o.r != null && Math.hypot(b.x - (o.x ?? 0), b.y - (o.y ?? 0)) > o.r + 0.35) continue;
      if (this.pipHitOne(P, kind, kind === 'gust' ? o.dir || 1 : T, b) !== false) n++;
    }
    return n;
  },
  pipHitOne(P, kind, T, b) {
    const emit = (k) => this.emit('pipHit', { id: P.id, kind: k, x: b.x, y: b.y });
    switch (kind) {
      case 'ice': // he loves the cold: a wave
        if (P.ph === 'fall' || P.ph === 'wave') return false;
        this.pipLetAll(P, 'wave'); P.v = 0; this.pipSet(P, 'wave', PIP.wave); emit('ice'); return;
      case 'gust': if (P.ph === 'slide') P.v = clamp(P.v + (Math.sign(T || 1) * 0.8), -PIP.vmax, PIP.vmax); return;
      case 'quake': if (STAND.has(P.ph) && P.ph !== 'dizzy') { P.face = P.n % 2 ? 1 : -1; this.pipLaunch(P, 1.0, 'quake'); } return;
      case 'pepper':
        if (P.ph === 'fall' || P.ph === 'sneeze') return false;
        this.pipLetAll(P, 'pepper'); P.v = 0; P.flee = Math.max(P.flee, T || PIP.flee); this.pipSet(P, 'sneeze', PIP.sneeze); emit('pepper'); return;
      case 'scare': // the Scarecrow or the laser: he hops out of the vault and keeps away while it lasts
        if (P.ph === 'away') { P.t = Math.max(P.t, T || 2.5); return; }
        if (P.ph === 'fall') return;
        this.pipLetAll(P, 'scare'); this.pipOut(P, 'scare', T || 2.5); emit('scare'); return;
      case 'out': // a blast: out of the vault for a while
        if (P.hitCD > 0) return false;
        P.hitCD = 1; this.pipLetAll(P, 'out'); this.pipOut(P, 'out', Math.max(T, 4)); emit('out'); return;
      case 'spin': { // thrown to the outermost channel, dizzy
        if (P.hitCD > 0) return false;
        P.hitCD = 1; this.pipLetAll(P, 'spin');
        const n = this.rings.length; P.ch = n - 1; P.r = this.pipFloor(P.ch); P.v = 0; P.why = 'hit'; P.dizT = Math.max(2, Math.min(T || 3, 5));
        this.pipSet(P, 'bump', PIP.bump * 0.6); emit('spin'); return;
      }
      default: { // bolt zap flash dash rock lava glue tock: dazed
        if (P.ph === 'fall' || (P.ph === 'bump' && P.why === 'hit')) return false;
        const t = kind === 'flash' ? 2.2 : kind === 'dash' ? this.pipM(PIP.dizzy) : Math.max(1.5, T || 2.5);
        if (P.ph === 'dizzy') { const was = P.t; P.t = Math.max(P.t, t); return P.t > was + 0.5 ? true : false; }
        this.pipLetAll(P, kind); P.v = 0; P.why = 'hit'; P.dizT = t;
        this.pipSet(P, 'bump', PIP.bump * 0.6);
        emit(kind);
      }
    }
  },
  pipOut(P, why, T) { P.v = 0; P.st = 0; P.r0 = P.r; P.r1 = this.outerR + 1.8; P.why = why; this.pipSet(P, 'out', T); },
  // powers2.js p2All: every creature at once
  pipP2(kind, T) { if (this.pips && this.pips.length) this.pipHit(kind === 'zap' ? 'bolt' : kind, {}, T); },
  // powers2.js: the live ring (shock) zaps him once while he stands or slides on it, then he gets a breather
  pipShock(ri, T) {
    for (const P of this.pips || []) {
      if (P.ch !== ri || !this.pipLive(P) || P.ph === 'fall' || this.p2.fx['pp' + P.id]) continue;
      this.pipHit('zap', { p: P }, Math.min(2.5, T));
      this.p2Mark('pp' + P.id, 'zap', Math.min(2.5, T) + 1.8);
    }
  },
  // the frost orb froze his floor ring (boss.js rl[].frost): he loves it
  pipFrost(P) {
    if (!this.bx || !this.bx.rl) return;
    const fr = (this.bx.rl[P.ch] && this.bx.rl[P.ch].frost) || 0;
    if (fr > 0 && !P.frostSeen && STAND.has(P.ph) && P.ph !== 'dizzy') this.pipHit('ice', { p: P });
    P.frostSeen = fr > 0 ? 1 : 0;
  },

  // ---------- planner and the danger cue: 1 = he holds or shoves it, 0.35 = he is winding up at it
  pipThreat(e) {
    let v = 0;
    for (const P of this.pips || []) {
      if (this.pipHas(P, e)) return 1;
      if (P.ph === 'windup' || P.ph === 'waddle' || P.ph === 'tuck') { const q = this.pipRel(P, e); if (q.on && q.f * P.face > 0 && Math.abs(q.f) < 3) v = Math.max(v, 0.35); }
    }
    return v;
  },
  pipState() { return (this.pips || []).map((P) => ({ ...P, train: [...P.train], skip: { ...P.skip } })); },
  pipLoad(S) { if (S) this.pips = S.map((P) => ({ ...P, train: [...P.train], skip: { ...P.skip } })); },
};
