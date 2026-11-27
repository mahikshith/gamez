// Coco the monkey (0.8.17, level 10: the Wild Woods' cheeky ring rider). Mixed into Sim (sim.js: Object.assign(Sim.prototype,
// cocoMethods)), so `this` is the Sim. No imports from sim.js (it imports this file). Every field is plain data in this.cocos
// and this.peels (cocoState / cocoLoad), so rewind and the planner stay exact. No randomness at all.
//
// level.monkey = { ch, a, delay } (or an array): ch = his channel (1 .. rings-1), a = where he swings in (deg, world, -90 =
// straight down), delay = s before he comes in. Art: render/monkey.js (drawn by render/coco.js).
//
// He lives in one channel: he HANGS from its ceiling (the outer face of ring ch-1: he grips that ring, so it carries him
// round) or SITS on its floor (the inner face of ring ch: that ring slides under him). He is never in an egg's way (eggs
// roll past him) and never cracks one himself.
//   RIDE    both hands on his ring, he pumps it to and fro by himself (COCO.rockA m of rim each way, a COCO.rockP s swing).
//   CROSS   hand over hand from the ceiling ring to the floor ring (and back), one hand on each ring half way (COCO.cross s).
//   SNATCH  an egg resting on the floor within COCO.reach of him: his eyes lock on and the tail wiggles (COCO.warn s, the
//           telegraph), the tail curls down and lifts it (COCO.snatch s); he holds it dangling COCO.hold s, then gets bored
//           and sets it down where he took it.
//   PEEL    he climbs down, eats a banana (COCO.eat s: the telegraph, ending in a sly look at the peel) and tosses the peel
//           COCO.peelD m along the floor. The peel lies on the floor ring and turns with it. An egg that touches it slips and
//           shoots along the channel (COCO.slipV m/s) until something stops it. One slip uses the peel up; a flaming egg burns
//           it; a stone or iron egg does not slip; turned up past the side of the vault (COCO.peelTh) it slides off, as it does
//           when a shutter opens under it; it shrivels after COCO.peelLife s.
//   COUNTERS a hard flick of the ring he holds (the ring's own travel at its rim, beyond COCO.flick of its full speed over
//           ~COCO.flickTau s) throws him off: he flails off, lands dizzy (COCO.dizzy s), then sulks (COCO.sulk s) and climbs
//           back up. Turning EITHER ring while he crosses (COCO.crossShake m) shakes him off the same way. An egg he holds
//           drops unharmed where he was. Carried more than COCO.thMax up the side of the vault he loses his grip too. A
//           flaming egg is too hot to grab, a stone (or iron) egg too heavy.
// Powers and hazards (cocoHit, from boss.js animalsHit, powers2.js p2All, strike.js stkApply, chicks.js flash and dash):
//   ice: frozen stiff where he is | bolt, zap, flash, dash, rock, lava, glue, tock, spin, quake: knocked off, dizzy |
//   pepper: ah-CHOO, knocked off, and he leaves eggs alone while it lasts | out (a blast) and scare (the Scarecrow, the
//   laser): out of the vault for a while | gust: nothing (he holds on). He always lets go of an egg first.
import { RING_TH, EGG_W, EGG_H, wrap, clamp } from './geom.js';
import { dynOf, tellS } from '../data/dynamism.js'; // 0.8.19 its temper (the dynamism table)

const m3 = (easy, medium, hard) => ({ easy, medium, hard });
export const COCO = {
  m: 0.98, // metres per 100 rig units (render/monkey.js MONKEY_M): about 0.9 m tall, the height of a channel (an egg is 0.56)
  rig: 86, // rig units from the ring he grips down to the floor he sits on, at m (the ride's torso and the sit's torso meet)
  reach: 0.85, // m along the floor: an egg resting this close to the point under his grip is in reach of his tail
  warn: m3(1.3, 1.05, 0.85), // s: eyes lock on, the tail wiggles toward the egg (the telegraph)
  snatch: 0.55, // s: the tail curls down and lifts it
  hold: m3(6, 7.5, 9), // s he dangles it before he gets bored and sets it down again
  bored: 0.5, // s: setting it down
  hang: 1.1, // s by the tail between tricks (the ride's telegraph: a cheeky grin, then he flips up)
  ride: m3(5, 6, 6.5), // s he rides his ring
  rockA: m3(0.22, 0.3, 0.36), // m of rim each way
  rockP: 2.4, // s: one swing to and fro
  rockIn: 0.8, // s: the swing builds up (and dies away at the end)
  cross: m3(1.6, 1.4, 1.25), // s hand over hand between the ceiling ring and the floor ring
  crossShake: m3(0.1, 0.13, 0.16), // m: either ring turned this far while he crosses shakes him off
  flick: m3(0.36, 0.42, 0.5), // a flick: the ring's own travel over ~flickTau s beyond this share of its full speed
  flickTau: 0.3, // s
  slip: 1.1, // s: the grip goes, he flails off and lands
  slipDx: 0.6, // m along the floor he lands from where he held on
  dizzy: m3(3.5, 3, 2.5), sulk: m3(4, 3, 2.5), // s
  eat: 2.4, toss: 1.0, laugh: 1.2, fly: 0.55, // s; TOSS_RELEASE (render/monkey.js 0.42) of the toss: the peel leaves his hand
  release: 0.42,
  peelD: 1.1, // m along the floor the peel lands
  peelR: 0.3, // m: an egg this close to the peel (along the floor) steps on it
  peelTh: 1.45, // rad from the bottom of the vault: carried up past this by its ring, the peel slides off
  peelLife: m3(20, 28, 36), // s
  slipV: m3(2.4, 2.9, 3.3), // m/s: an egg that steps on the peel shoots off this fast along the channel
  leap: 0.5, // s: a gap under him on the floor: up he jumps to the ceiling
  thMax: 1.2, // rad from the bottom: carried further up the side he cannot hold on
  away: m3(9, 7, 6), in: 0.9, // s out of the vault after a blast, the swing back in
  skipEgg: 5, // s he leaves an egg alone after he set it down (or dropped it)
};
const CEIL = new Set(['in', 'hang', 'ride', 'aim', 'snatch', 'hold', 'bored']);
const FLOOR = new Set(['eat', 'toss', 'laugh', 'dizzy', 'sulk', 'land']);
const GONE = new Set(['wait', 'away', 'gone']);
const sstep = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };

export const cocoMethods = {
  cocoInit(L) {
    this.cocos = []; this.peels = [];
    const list = !L.monkey ? [] : Array.isArray(L.monkey) ? L.monkey : [L.monkey];
    const n = this.rings.length;
    if (n < 2) return;
    list.forEach((o, i) => {
      const ch = clamp(o.ch ?? 1, 1, n - 1), a0 = ((o.a ?? -100) * Math.PI) / 180;
      this.cocos.push({
        id: i, home: ch, a0, ch, la: 0, wa: a0, face: o.face || 1, ph: 'wait', t: o.delay ?? 3, dur: o.delay ?? 3,
        at: 'ceil', // where he is: 'ceil' (gripping ring ch-1) | 'floor' (sitting on ring ch)
        eid: 0, tgt: 0, e0: null, // the egg in his tail; the egg he goes for; where the snatched egg started {x, y}
        lf: 0, cs: 0, // crossing: the floor ring's local angle under his far hand, the turning he has felt so far (m)
        sa: 0, sd: 0, sv: 0, // a slip: the world angle he let go at, the one he lands at, the drop (0..1 of the channel left)
        fl: 0, rock: 0, rp: 0, // the flick meter (m), how far he has rocked his ring (m of rim), the swing's phase (rad)
        n: 0, sulk: 0, flee: 0, ice: 0, hitCD: 0, why: '', dizT: 0, alpha: 1, peel: -1,
        skip: {}, // egg id -> s he leaves it alone
      });
    });
  },
  cocoM(o) { return o[this.mode] ?? o.medium; },
  // 0.8.19 his temper (data/dynamism.js DYN.monkey) and the menace engine (sim/menace.js): the beat between tricks / heat,
  // the aim (never under TELL_MIN, longer on the edge of a run); a snatch needs an attack token (refused, he rides instead)
  cocoHang() { return (COCO.hang * dynOf(this, 'monkey').rest) / this.menaceHeat(); },
  cocoWarn() { return tellS(this.cocoM(COCO.warn), dynOf(this, 'monkey').tell) * this.menaceTell(); },
  cocoSet(C, ph, t = 0) { C.ph = ph; C.t = C.dur = t; },
  cocoLive(C) { return !GONE.has(C.ph) && C.ph !== 'out'; },
  cocoCeil(C) { return this.rings[C.ch - 1]; },
  cocoFloorRing(C) { return this.rings[C.ch]; },
  cocoGripR(C) { return this.cocoCeil(C).r + RING_TH / 2; },
  cocoFloorR(C) { return this.cocoFloorRing(C).r - RING_TH / 2; },
  cocoGripA(C) { return wrap(this.cocoCeil(C).body.getAngle() + C.la); },
  // his world angle now (the grip while he hangs or crosses, his seat on the floor)
  cocoA(C) {
    if (C.ph === 'slip') return wrap(C.sa + wrap(C.sd - C.sa) * sstep(C.dur > 0 ? 1 - C.t / C.dur : 1)); // in the air: let go of the ring
    if (C.ph === 'out') return C.sa;
    return C.at === 'ceil' ? this.cocoGripA(C) : C.wa;
  },
  cocoTheta(a) { return wrap(a + (Math.PI / 2) * (this.gy || 1)); },
  // a point in his channel: f m along (+ = counter-clockwise) from angle a, at radius r
  cocoPt(a, r, f = 0) { const b = a + f / Math.max(0.5, r); return { x: r * Math.cos(b), y: r * Math.sin(b), a: b }; },
  // the middle of him (what a power or a chick touches, the strike's aim)
  cocoBody(C) { return this.cocoPt(this.cocoA(C), (this.cocoGripR(C) + this.cocoFloorR(C)) / 2 + (C.at === 'ceil' ? -0.05 : 0.08)); },
  cocoEgg(id) { return id ? this.eggs.find((e) => e.id === id && e.alive && !e.saved) || null : null; },
  cocoFree(e) {
    if (!e.alive || e.saved || !e.body || !e.body.isActive() || e.chick || e.phx || e.thf || e.octo || e.hc || e.clamp || e.honey > 0 || e.icy > 0 || e.bubble > 0 || e.sbub) return false;
    if (this.stk && this.stk.held && this.stk.held[e.id]) return false; // glued
    if ((this.pips || []).some((P) => P.eid === e.id || P.train.includes(e.id))) return false;
    return !this.cocos.some((Q) => Q.eid === e.id);
  },
  cocoHeavy(e) { return e.stone > 0 || !!e.iron; },
  cocoHot(e) { return e.fire > 0; },
  cocoDecoy() { return !!(this.p2 && this.p2.decoy); },
  // an open gap of ring ri over world angle wa with `inside` m to spare
  cocoGapAt(ri, wa, inside = 0) {
    const ring = this.rings[ri];
    if (!ring) return null;
    const ra = ring.body.getAngle();
    for (const g of ring.gaps) {
      if (!this.snakeGap(g) || (g.o != null && g.o < 0.5)) continue;
      if (Math.abs(wrap(ra + g.a - wa)) * ring.r < g.len / 2 - inside) return g;
    }
    return null;
  },
  // the nearest world angle to wa where his hands find solid ring ri (a gap there: he reaches past its edge)
  cocoSolid(ri, wa) {
    const ring = this.rings[ri];
    for (let k = 0; k < 24; k++) for (const s of [1, -1]) { const b = wa + (s * k * 0.07) / ring.r; if (!this.cocoGapAt(ri, b, -0.12)) return b; }
    return wa;
  },

  // ---------- the ring he holds: his own swing, and the player's flick (sim.js step, after the rings are driven)
  cocoRings(dt) {
    if (!this.cocos || !this.cocos.length || this.state !== 'play') return;
    for (const C of this.cocos) {
      if (!this.cocoLive(C) || C.ice > 0) continue;
      const R = this.cocoCeil(C), F = this.cocoFloorRing(C);
      const own = (ring) => (ring.omega || 0) * dt * ring.r; // the player's (or a power's) turning this step, m of rim
      const free = (ring) => !(ring.held || ring.keyHeld || ring.motor || ring.gear || ring.stun > 0 || ring.lock > 0);
      if (C.ph === 'down' || C.ph === 'up') { // a hand on each ring: any turning pulls him apart
        C.cs += Math.abs(own(R)) + Math.abs(own(F));
        if (C.cs > this.cocoM(COCO.crossShake)) { this.cocoSlip(C, 'cross'); continue; }
      }
      if (C.at === 'ceil' && CEIL.has(C.ph)) {
        const lim = this.maxOmega(R) * R.r, k = Math.exp(-dt / COCO.flickTau);
        C.fl = C.fl * k + own(R);
        if (Math.abs(C.fl) > this.cocoM(COCO.flick) * lim * COCO.flickTau && C.ph !== 'in') { this.cocoSlip(C, 'flick'); continue; }
      } else C.fl = 0;
      // his swing: the ring rocks C.rock m of rim off where it was; on its own it comes back to the start
      let want = 0;
      if (C.ph === 'ride' || C.ph === 'hold') {
        const el = C.dur - C.t, env = sstep(el / COCO.rockIn) * sstep(C.t / COCO.rockIn) * (C.ph === 'hold' ? 0.6 : 1);
        want = this.cocoM(COCO.rockA) * env * Math.sin(C.rp);
      }
      if (want !== C.rock && free(R)) {
        const d = clamp(want - C.rock, -1.2 * dt, 1.2 * dt);
        C.rock += d;
        R.omega += d / dt / R.r; R.target += d / R.r; // a step of his own: the ring's target goes with it (no tug of war)
      }
    }
  },

  // ---------- every step (sim.js), with the creatures' dt
  cocoStep(dt) {
    if (!this.cocos || !this.cocos.length) return;
    for (const C of this.cocos) {
      if (C.hitCD > 0) C.hitCD -= dt;
      if (C.sulk > 0) C.sulk -= dt;
      if (C.flee > 0) C.flee -= dt;
      for (const id in C.skip) if ((C.skip[id] -= dt) <= 0) delete C.skip[id];
      if (this.state !== 'play') { this.cocoEnd(C, dt); continue; }
      if (C.ice > 0) { if ((C.ice -= dt) <= 0) { C.ice = 0; if (C.at === 'ceil') this.cocoSet(C, 'hang', this.cocoHang()); else this.cocoUp(C); this.emit('cocoThaw', { id: C.id, ...this.cocoBody(C) }); } this.cocoHold(C); continue; }
      this.cocoOne(C, dt);
      if (this.cocoLive(C)) this.cocoWatch(C);
      this.cocoHold(C);
    }
    this.cocoPeels(dt);
  },
  cocoOne(C, dt) {
    if (C.ph === 'ride' || C.ph === 'hold') C.rp += (dt * 2 * Math.PI) / COCO.rockP;
    switch (C.ph) {
      case 'wait': case 'away': if ((C.t -= dt) <= 0) this.cocoEnter(C); return;
      case 'gone': return;
      case 'out': { C.t -= dt; const u = clamp(1 - C.t / C.dur, 0, 1); C.alpha = 1 - sstep((u - 0.5) / 0.5); if (C.t <= 0) { C.alpha = 0; this.cocoSet(C, 'away', C.why === 'out' || C.why === 'scare' ? Math.max(C.dizT, 2) : this.cocoM(COCO.away)); } return; }
      case 'in': if ((C.t -= dt) <= 0) this.cocoSet(C, 'hang', this.cocoHang()); return;
      case 'hang': if (this.menaceHolds('coco' + C.id)) this.menaceDone('coco' + C.id, 'snatch', 0); if ((C.t -= dt) <= 0) this.cocoThink(C); return; // (0.8.19 back on the ceiling: his token goes back)
      case 'ride': if ((C.t -= dt) <= 0) { C.n++; this.cocoSet(C, 'hang', this.cocoHang()); } return;
      case 'aim': {
        const e = this.cocoEgg(C.tgt);
        if (!e || !this.cocoReach(C, e)) { C.tgt = 0; this.cocoSet(C, 'hang', 0.6); return; } // it rolled off: never mind
        if ((C.t -= dt) <= 0) { const p = e.body.getPosition(); C.e0 = { x: p.x, y: p.y }; C.eid = e.id; C.tgt = 0; this.cocoSet(C, 'snatch', COCO.snatch); this.emit('cocoSnatch', { id: C.id, egg: e, x: p.x, y: p.y }); }
        return;
      }
      case 'snatch': if ((C.t -= dt) <= 0) { this.cocoSet(C, 'hold', this.cocoM(COCO.hold)); C.rp = 0; const e = this.cocoEgg(C.eid); if (e) this.emit('cocoGrab', { id: C.id, egg: e, ...this.cocoBody(C) }); } return;
      case 'hold': if ((C.t -= dt) <= 0) this.cocoSet(C, 'bored', COCO.bored); return;
      case 'bored': if ((C.t -= dt) <= 0) { this.cocoLetGo(C, 'bored'); C.n++; this.cocoSet(C, 'hang', this.cocoHang()); } return;
      case 'down': if ((C.t -= dt) <= 0) { C.wa = this.cocoFloorRing(C).body.getAngle() + C.lf; C.at = 'floor'; this.cocoSet(C, C.why === 'eat' ? 'eat' : 'land', C.why === 'eat' ? COCO.eat : 0.3); if (C.why === 'eat') this.emit('cocoEat', { id: C.id, ...this.cocoBody(C) }); } return;
      case 'up': if ((C.t -= dt) <= 0) { C.at = 'ceil'; this.cocoSet(C, 'hang', this.cocoHang()); } return;
      case 'leap': if ((C.t -= dt) <= 0) { C.at = 'ceil'; this.cocoSet(C, 'hang', this.cocoHang()); } return;
      case 'slip': if ((C.t -= dt) <= 0) { C.at = 'floor'; C.wa = C.sd; this.cocoSet(C, 'dizzy', C.why === 'hit' ? C.dizT : this.cocoM(COCO.dizzy)); this.emit('cocoLand', { id: C.id, ...this.cocoBody(C) }); } return;
      case 'land': if ((C.t -= dt) <= 0) this.cocoUp(C); return;
      case 'eat': if ((C.t -= dt) <= 0) this.cocoTossStart(C); return;
      case 'toss': {
        const u0 = 1 - C.t / C.dur;
        C.t -= dt;
        const u1 = 1 - C.t / C.dur;
        if (u0 < COCO.release && u1 >= COCO.release) this.cocoThrow(C);
        if (C.t <= 0) { this.cocoSet(C, 'laugh', COCO.laugh); this.emit('cocoLaugh', { id: C.id, ...this.cocoBody(C) }); }
        return;
      }
      case 'laugh': if ((C.t -= dt) <= 0) { C.n++; this.cocoUp(C); } return;
      case 'dizzy': if ((C.t -= dt) <= 0) { this.cocoSet(C, 'sulk', this.cocoM(COCO.sulk)); this.emit('cocoSulk', { id: C.id, ...this.cocoBody(C) }); } return;
      case 'sulk': if ((C.t -= dt) <= 0) this.cocoUp(C); return;
    }
  },
  cocoEnter(C) {
    C.ch = C.home; C.at = 'ceil'; C.alpha = 1; C.fl = 0; C.rock = 0; C.eid = 0; C.tgt = 0;
    C.la = wrap(this.cocoSolid(C.ch - 1, C.a0) - this.cocoCeil(C).body.getAngle());
    this.cocoSet(C, 'in', COCO.in);
    this.emit('cocoIn', { id: C.id, ...this.cocoBody(C) });
  },
  // what he watches for every step: carried too far up the side, a gap under him on the floor
  cocoWatch(C) {
    if (C.at === 'ceil' && (CEIL.has(C.ph) || C.ph === 'down') && Math.abs(this.cocoTheta(this.cocoGripA(C))) > COCO.thMax) { this.cocoSlip(C, 'high'); return; }
    if (C.at === 'floor' && FLOOR.has(C.ph) && this.cocoGapAt(C.ch, C.wa, 0.12)) { // the floor opens under him: up he jumps
      this.cocoLetGo(C, 'leap');
      C.la = wrap(this.cocoSolid(C.ch - 1, C.wa) - this.cocoCeil(C).body.getAngle());
      this.cocoSet(C, 'leap', COCO.leap);
      this.emit('cocoLeap', { id: C.id, ...this.cocoBody(C) });
    }
  },

  // ---------- choosing a trick (hanging, after a beat)
  cocoThink(C) {
    const e0 = !(C.sulk > 0) && !(C.flee > 0) && !this.cocoDecoy() ? this.cocoPrey(C) : null;
    const e = e0 && this.menaceMay('coco' + C.id, 'snatch') ? e0 : null;
    if (e) {
      const q = this.cocoRel(C, e);
      C.face = q.f >= 0 ? 1 : -1; C.tgt = e.id;
      this.cocoSet(C, 'aim', this.cocoWarn());
      const p = e.body.getPosition();
      this.emit('cocoAim', { id: C.id, egg: e, x: p.x, y: p.y, ...{ bx: this.cocoBody(C).x, by: this.cocoBody(C).y } });
      return;
    }
    const peelOut = this.peels.some((p) => p.by === C.id);
    if (C.n % 2 === 1 && !peelOut && !(C.flee > 0)) { this.cocoDown(C, 'eat'); return; }
    C.rp = 0; C.rock = 0;
    this.cocoSet(C, 'ride', this.cocoM(COCO.ride));
    this.emit('cocoRide', { id: C.id, ...this.cocoBody(C) });
  },
  // where egg e is from him: f = m along the floor from the point under his grip (+ = counter-clockwise), h = m off the floor
  cocoRel(C, e) {
    const p = e.body.getPosition(), d = Math.hypot(p.x, p.y), rF = this.cocoFloorR(C);
    return { f: wrap(Math.atan2(p.y, p.x) - this.cocoA(C)) * rF, h: rF - d, ch: this.channelOf(e) };
  },
  cocoReach(C, e) {
    if (!this.cocoFree(e) || this.cocoHeavy(e) || this.cocoHot(e) || C.skip[e.id]) return false;
    const q = this.cocoRel(C, e);
    return q.ch === C.ch && q.h < 0.55 && Math.abs(q.f) <= COCO.reach;
  },
  cocoPrey(C) {
    let best = null;
    for (const e of this.aliveEggs()) {
      if (!this.cocoReach(C, e)) continue;
      const v = e.body.getLinearVelocity();
      if (Math.hypot(v.x, v.y) > 0.6) continue; // a rolling egg: not yet
      const f = Math.abs(this.cocoRel(C, e).f);
      if (!best || f < best.f) best = { e, f };
    }
    return best ? best.e : null;
  },
  // where the egg in his tail dangles: beside him, its foot just off the floor, upright
  cocoTailPt(C) {
    const a = this.cocoA(C), r = this.cocoGripR(C) + 0.37;
    const q = this.cocoPt(a, r, C.face * 0.5);
    return { x: q.x, y: q.y, ang: q.a + Math.PI / 2 };
  },
  cocoHold(C) {
    const e = this.cocoEgg(C.eid);
    if (C.eid && !e) { C.eid = 0; return; }
    if (!e) return;
    if (!(C.ph === 'snatch' || C.ph === 'hold' || C.ph === 'bored' || (C.ph === 'frozen'))) { this.cocoLetGo(C, 'drop'); return; }
    const q = this.cocoTailPt(C);
    if (C.ph === 'snatch' && C.e0) { // lifted from where it lay
      const u = sstep(1 - C.t / C.dur), p0 = C.e0;
      this.cocoPin(e, p0.x + (q.x - p0.x) * u, p0.y + (q.y - p0.y) * u, e.body.getAngle() + wrap(q.ang - e.body.getAngle()) * u);
    } else this.cocoPin(e, q.x, q.y, q.ang);
  },
  cocoPin(e, x, y, ang) {
    const b = e.body;
    b.setTransform({ x, y }, ang);
    b.setLinearVelocity({ x: 0, y: 0 }); b.setAngularVelocity(0);
    e.ch = this.channelOf(e); e.freefall = 0; e.drop = 0;
  },
  // let go of the egg in his tail, where it is (unharmed: it is only a hand's breadth off the floor)
  cocoLetGo(C, why) {
    const e = this.cocoEgg(C.eid);
    C.eid = 0; C.e0 = null;
    if (!e) return;
    const b = e.body;
    b.setLinearVelocity({ x: 0, y: 0 }); b.setAngularVelocity(0);
    e.safeT = Math.max(e.safeT || 0, 0.8);
    e.ch = this.channelOf(e); e.freefall = 0; e.drop = 0;
    C.skip[e.id] = COCO.skipEgg;
    const p = b.getPosition();
    this.emit('cocoDrop', { id: C.id, why, egg: e, x: p.x, y: p.y });
  },

  // ---------- crossing: hand over hand between the ceiling ring and the floor ring
  cocoDown(C, why) {
    const F = this.cocoFloorRing(C), wa = this.cocoSolid(C.ch, this.cocoGripA(C) + (C.face * 0.2) / this.cocoFloorR(C));
    C.lf = wrap(wa - F.body.getAngle()); C.cs = 0; C.why = why;
    this.cocoSet(C, 'down', this.cocoM(COCO.cross));
    this.emit('cocoCross', { id: C.id, dir: 1, ...this.cocoBody(C) });
  },
  cocoUp(C) {
    const F = this.cocoFloorRing(C);
    C.lf = wrap(C.wa - F.body.getAngle());
    C.la = wrap(this.cocoSolid(C.ch - 1, C.wa - (C.face * 0.2) / this.cocoGripR(C)) - this.cocoCeil(C).body.getAngle());
    C.at = 'ceil'; C.cs = 0;
    this.cocoSet(C, 'up', this.cocoM(COCO.cross));
    this.emit('cocoCross', { id: C.id, dir: -1, ...this.cocoBody(C) });
  },
  // how far he is from the ceiling (0) to the floor (1) right now (crossings, the slip)
  cocoDepth(C) {
    const u = C.dur > 0 ? clamp(1 - C.t / C.dur, 0, 1) : 1;
    if (C.ph === 'down') return sstep(u);
    if (C.ph === 'up') return 1 - sstep(u);
    if (C.ph === 'leap') return 1 - sstep(u);
    return C.at === 'ceil' ? 0 : 1;
  },

  // ---------- thrown off: the grip goes, he flails, lands sitting on the floor, dizzy
  cocoSlip(C, why, dizT = 0) {
    const crossing = C.ph === 'down' || C.ph === 'up';
    const a = crossing ? wrap(this.cocoGripA(C) + this.cocoDepth(C) * wrap(this.cocoFloorRing(C).body.getAngle() + C.lf - this.cocoGripA(C))) : this.cocoA(C);
    this.cocoLetGo(C, 'slip');
    C.fl = 0; C.cs = 0; C.rock = 0;
    const rF = this.cocoFloorR(C);
    let sd = a - (C.face * COCO.slipDx) / rF; // thrown back, away from what he reached for (an egg he held drops on his face side)
    if (Math.abs(this.cocoTheta(sd)) > 0.9 && Math.abs(this.cocoTheta(sd)) > Math.abs(this.cocoTheta(a))) sd = a + (C.face * COCO.slipDx) / rF; // not up a steep side
    if (this.cocoGapAt(C.ch, sd, -0.1)) sd = this.cocoSolid(C.ch, sd);
    C.sa = a; C.sd = sd; C.sv = 1 - (crossing ? this.cocoDepth(C) : 0);
    C.face = wrap(sd - a) >= 0 ? 1 : -1;
    C.at = 'ceil'; // (in the air: drawn from where he let go)
    C.why = why === 'flick' || why === 'cross' || why === 'high' ? why : 'hit'; C.dizT = dizT;
    C.sulk = Math.max(C.sulk, COCO.slip + this.cocoM(COCO.dizzy) + this.cocoM(COCO.sulk) + 2);
    this.cocoSet(C, 'slip', COCO.slip);
    const b = this.cocoBody(C);
    this.emit('cocoSlip', { id: C.id, x: b.x, y: b.y, why });
  },

  // ---------- the banana peel
  cocoTossStart(C) {
    // the way he throws: toward the nearest egg in the channel, else down toward the bottom
    let dir = this.cocoTheta(C.wa) > 0 ? -1 : 1, best = 99;
    for (const e of this.aliveEggs()) {
      if (this.channelOf(e) !== C.ch || !this.cocoFree(e)) continue;
      const f = wrap(Math.atan2(e.body.getPosition().y, e.body.getPosition().x) - C.wa) * this.cocoFloorR(C);
      if (Math.abs(f) < best && Math.abs(f) > 0.3) { best = Math.abs(f); dir = f > 0 ? 1 : -1; }
    }
    C.face = dir;
    this.cocoSet(C, 'toss', COCO.toss);
    this.emit('cocoToss', { id: C.id, ...this.cocoBody(C) });
  },
  cocoThrow(C) {
    const rF = this.cocoFloorR(C), F = this.cocoFloorRing(C);
    let land = null;
    for (const [s, d] of [[1, COCO.peelD], [1, COCO.peelD * 0.7], [1, COCO.peelD * 1.35], [-1, COCO.peelD], [-1, COCO.peelD * 0.7]]) {
      const wa = C.wa + (s * C.face * d) / rF;
      if (!this.cocoGapAt(C.ch, wa, -0.25) && Math.abs(this.cocoTheta(wa)) < COCO.thMax) { land = wa; if (s < 0) C.face = -C.face; break; }
    }
    if (land == null) return;
    for (const p of this.peels) if (p.by === C.id) p.life = Math.min(p.life, 0.4); // one peel each
    const h = this.cocoPt(C.wa, rF - 0.55, C.face * 0.25);
    this.peels.push({ by: C.id, ch: C.ch, la: wrap(land - F.body.getAngle()), ph: 'fly', t: 0, life: this.cocoM(COCO.peelLife), x0: h.x, y0: h.y, wa0: C.wa, face: C.face, egg: 0 });
    this.emit('cocoThrow', { id: C.id, x: h.x, y: h.y });
  },
  cocoPeelA(p) { return wrap(this.rings[p.ch].body.getAngle() + p.la); },
  cocoPeels(dt) {
    if (!this.peels.length) return;
    for (const p of this.peels) {
      p.t += dt;
      const rF = this.rings[p.ch].r - RING_TH / 2, a = this.cocoPeelA(p), at = this.cocoPt(a, rF);
      if (p.ph === 'fly') { if (p.t >= COCO.fly) { p.ph = 'lie'; p.t = 0; this.emit('cocoPeel', { x: at.x, y: at.y }); } continue; }
      if (p.ph === 'slip' || p.ph === 'burn' || p.ph === 'drop' || p.ph === 'old') { if (p.t > 0.7) p.ph = 'gone'; continue; }
      if (p.ph !== 'lie' || this.state !== 'play') continue;
      if ((p.life -= dt) <= 0) { p.ph = 'old'; p.t = 0; this.emit('cocoPeelGone', { x: at.x, y: at.y }); continue; }
      if (this.cocoGapAt(p.ch, a, 0.05) || Math.abs(this.cocoTheta(a)) > COCO.peelTh) { p.ph = 'drop'; p.t = 0; this.emit('cocoPeelGone', { x: at.x, y: at.y, drop: 1 }); continue; } // a shutter opened under it, or turned up the side: it slides off
      for (const e of this.aliveEggs()) {
        if (!e.body.isActive() || e.chick || e.phx || this.channelOf(e) !== p.ch || this.cocos.some((C) => C.eid === e.id)) continue;
        const q = e.body.getPosition(), d = Math.hypot(q.x, q.y), f = wrap(Math.atan2(q.y, q.x) - a) * rF;
        if (rF - d > 0.5 || Math.abs(f) > COCO.peelR) continue;
        if (this.cocoHot(e)) { p.ph = 'burn'; p.t = 0; this.emit('cocoPeelBurn', { egg: e, x: at.x, y: at.y }); break; }
        if (this.cocoHeavy(e)) continue; // too heavy to slip: it rolls over it
        // slip: along the floor, the way it was going (else away from the peel), COCO.slipV m/s
        const v = e.body.getLinearVelocity(), tx = -Math.sin(Math.atan2(q.y, q.x)), ty = Math.cos(Math.atan2(q.y, q.x)), vt = v.x * tx + v.y * ty;
        const dir = Math.abs(vt) > 0.15 ? Math.sign(vt) : f !== 0 ? Math.sign(f) : (this.cocoTheta(a) > 0 ? -1 : 1), sp = this.cocoM(COCO.slipV), vr = (v.x * q.x + v.y * q.y) / (d || 1);
        e.body.setLinearVelocity({ x: tx * dir * sp + (q.x / (d || 1)) * Math.min(0, vr), y: ty * dir * sp + (q.y / (d || 1)) * Math.min(0, vr) });
        e.body.setAngularVelocity(-dir * 6);
        e.safeT = Math.max(e.safeT || 0, 0.3);
        p.ph = 'slip'; p.t = 0; p.egg = e.id; p.face = dir;
        this.emit('cocoPeelSlip', { egg: e, x: q.x, y: q.y, dir });
        break;
      }
    }
    if (this.peels.some((p) => p.ph === 'gone')) this.peels = this.peels.filter((p) => p.ph !== 'gone');
  },

  // the level is decided: a win and he falls asleep hugging a banana; a loss and he laughs
  cocoEnd(C, dt) {
    if (C.eid) this.cocoLetGo(C, 'end');
    if (GONE.has(C.ph) || C.ph === 'out') return;
    const win = this.state === 'winning' || this.state === 'won';
    if (C.ph === 'slip') { if ((C.t -= dt) > 0) return; C.at = 'floor'; C.wa = C.sd; }
    if (C.ph !== 'asleep' && C.ph !== 'cheer') {
      if (win && C.at === 'ceil') { this.cocoSlip(C, 'end'); C.ph = 'slip'; return; } // he lets go, sits down and nods off
      this.cocoSet(C, win ? 'asleep' : 'cheer', 99);
    }
    C.t -= dt;
  },

  // ---------- powers and hazards. kind: ice | bolt | zap | flash | dash | rock | lava | glue | tock | spin | quake | pepper |
  // out | scare | gust. o.r / o.x / o.y: only a monkey that close; o.p: the monkey itself. T: the power's time.
  cocoHit(kind, o = {}, T = 0) {
    let n = 0;
    for (const C of this.cocos || []) {
      if (o.p && o.p !== C) continue;
      if (!this.cocoLive(C) && !(kind === 'scare' && C.ph === 'away')) continue;
      const b = this.cocoBody(C);
      if (o.r != null && Math.hypot(b.x - (o.x ?? 0), b.y - (o.y ?? 0)) > o.r + 0.4) continue;
      if (this.cocoHitOne(C, kind, T, b) !== false) n++;
    }
    return n;
  },
  cocoHitOne(C, kind, T, b) {
    const emit = (k) => this.emit('cocoHit', { id: C.id, kind: k, x: b.x, y: b.y });
    if (C.ph === 'in') return false;
    switch (kind) {
      case 'gust': return false; // he holds on
      case 'ice': { // frozen stiff where he is (the egg in his tail drops)
        this.cocoLetGo(C, 'ice');
        if (C.ph === 'slip' || C.ph === 'down' || C.ph === 'up' || C.ph === 'leap') { C.at = C.ph === 'slip' ? 'floor' : this.cocoDepth(C) > 0.5 ? 'floor' : 'ceil'; if (C.at === 'floor') C.wa = C.ph === 'slip' ? C.sd : this.cocoA(C); }
        C.ice = Math.max(C.ice, T || 3); C.rock = 0; this.cocoSet(C, 'frozen', 0); emit('ice'); return;
      }
      case 'scare': // the Scarecrow or the laser: off he goes, out of the vault while it lasts
        if (C.ph === 'away') { C.t = Math.max(C.t, T || 2.5); return; }
        this.cocoOut(C, 'scare', T || 2.5); emit('scare'); return;
      case 'out': // a blast
        if (C.hitCD > 0) return false;
        C.hitCD = 1; this.cocoOut(C, 'out', Math.max(T, 4)); emit('out'); return;
      case 'pepper':
        C.flee = Math.max(C.flee, T || 6);
        if (C.ph === 'slip') return false;
        this.cocoKnock(C, 'pepper', 2); emit('pepper'); return;
      default: { // bolt zap flash dash rock lava glue tock spin quake: knocked off, dizzy
        if (C.hitCD > 0 && kind !== 'flash' && kind !== 'dash') return false;
        const t = kind === 'flash' ? 2.2 : kind === 'dash' ? this.cocoM(COCO.dizzy) : kind === 'quake' ? 2 : Math.max(1.5, T || 2.5);
        if (C.ph === 'dizzy') { const was = C.t; C.t = Math.max(C.t, t); return C.t > was + 0.5; }
        if (C.ph === 'slip') { C.dizT = Math.max(C.dizT, t); return false; }
        C.hitCD = 0.8; this.cocoKnock(C, kind, t); emit(kind);
      }
    }
  },
  // knocked off whatever he holds (or knocked down where he sits)
  cocoKnock(C, why, t) {
    if (C.ph === 'frozen') { C.ice = 0; C.at = C.at || 'ceil'; }
    if (C.at === 'floor' && !(C.ph === 'down' || C.ph === 'up')) { this.cocoLetGo(C, why); this.cocoSet(C, 'dizzy', t); C.sulk = Math.max(C.sulk, t + this.cocoM(COCO.sulk) + 2); return; }
    this.cocoSlip(C, why, t);
  },
  cocoOut(C, why, T) {
    this.cocoLetGo(C, why);
    C.rock = 0; C.fl = 0; C.why = why; C.dizT = T; C.sa = this.cocoA(C);
    this.cocoSet(C, 'out', 1.0);
  },
  // powers2.js p2All: every creature at once
  cocoP2(kind, T) { if (this.cocos && this.cocos.length) this.cocoHit(kind === 'zap' ? 'bolt' : kind, {}, T); },
  // powers2.js: the live ring (shock) zaps him once if he holds it or sits on it, then he gets a breather
  cocoShock(ri, T) {
    for (const C of this.cocos || []) {
      if (!this.cocoLive(C) || this.p2.fx['cc' + C.id]) continue;
      const on = C.at === 'ceil' ? ri === C.ch - 1 : ri === C.ch;
      if (!on) continue;
      this.cocoHit('zap', { p: C }, Math.min(2.5, T));
      this.p2Mark('cc' + C.id, 'zap', Math.min(2.5, T) + 1.8);
    }
  },
  // the rings he holds right now (the planner's moves: a held egg must be answerable by turning them)
  cocoRingsHeld() {
    const out = [];
    for (const C of this.cocos || []) {
      if (!this.cocoLive(C)) continue;
      if (C.at === 'ceil' && C.ph !== 'slip') out.push(C.ch - 1);
      if (C.ph === 'down' || C.ph === 'up') out.push(C.ch);
    }
    return out;
  },

  // ---------- planner and the danger cue: 1 = in his tail, 0.5 = his eyes are on it, 0.15 = a peel lies in its way
  cocoThreat(e) {
    let v = 0;
    for (const C of this.cocos || []) {
      if (C.eid === e.id) return 1;
      if (C.tgt === e.id && C.ph === 'aim') v = Math.max(v, 0.5);
    }
    for (const p of this.peels || []) {
      if (p.ph !== 'lie' || this.channelOf(e) !== p.ch || this.cocoHeavy(e)) continue;
      const q = e.body.getPosition(), rF = this.rings[p.ch].r - RING_TH / 2;
      if (Math.abs(wrap(Math.atan2(q.y, q.x) - this.cocoPeelA(p)) * rF) < 0.8) v = Math.max(v, 0.15);
    }
    return v;
  },
  cocoState() { return { c: (this.cocos || []).map((C) => ({ ...C, skip: { ...C.skip }, e0: C.e0 ? { ...C.e0 } : null })), p: (this.peels || []).map((p) => ({ ...p })) }; },
  cocoLoad(S) { if (S) { this.cocos = S.c.map((C) => ({ ...C, skip: { ...C.skip }, e0: C.e0 ? { ...C.e0 } : null })); this.peels = S.p.map((p) => ({ ...p })); } },
};
// the 'frozen' phase (ice) keeps where he was: 'ceil' or 'floor'
export const COCO_SETS = { CEIL, FLOOR, GONE };
void EGG_W; void EGG_H;
