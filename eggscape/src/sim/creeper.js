// The moving thorn (0.8.18, redone): one of the ring's own thorns that slides along a groove in the rim between two end
// stops. Mixed into Sim (sim.js: Object.assign(Sim.prototype, creepMethods)), so `this` is the Sim. Every field is plain
// data in this.creeps (creepState / creepLoad), so rewind and the planner stay exact. No randomness.
//
// It IS a thorn: creepInit adds a real entry to ring.thorns (sim.js addThorn: the same triangle, the same size) and only
// its angle `a` changes. So there is ONE RULE, the standing thorn's own (sim.js thornTouch): it breaks an egg (Easy: a
// crack and a shove; a slow brush on its flank is a graze), a flaming egg burns it, a stone, comet or golden egg snaps
// it, every chick, boss and power that reads ring.thorns sees it, and Thorn Snips take it with the rest. The picture is
// drawn by the same code from the same entry (render/world.js drawThorns), and creepTouch tests eggs against that very
// triangle, so the hit shape is the drawn thorn. (It carries no physics fixture: see creepTouch.)
// What a moving thorn adds to a standing one:
//   REST   at each end of its groove it stands for `rest` s (still a thorn: it hurts). The last CREEP.wind s are the
//          wind-up (the render's shiver and hot tip).
//   SLIDE  to the other end: slow off the mark, fastest past the middle, a firm stop against the end of the groove.
//   BITE   after it harms an egg it holds where it is for a beat, then goes on.
//   STUB   burnt, snapped or pecked, it is cut back to the retracted stub (ext 0: harmless, as a retracting thorn's) for
//          CREEP.regrow s, then springs back out (it waits while an egg sits right on it) and rests before it moves on.
//   GONE   Thorn Snips (removeThorn 'snip'), or the floor under it is gone: off for the level.
//   baby   (spec `baby: 1`, the first meeting only): a short young thorn that only shoves, on every mode.
//
// level.rings[i].creep = { a0, a1, side, v, rest, delay, baby }: the groove from a0 to a1 (deg, ring-local, a0 < a1), on
// the ring's inner face (side 'in', the floor eggs ride on) or its outer face ('out'); v = its mean speed (m/s, Medium),
// rest = the pause at each end (s, Medium), delay = s before it first moves. It rides with its ring.
// Events: creepGo (sets off), creepStop (reaches an end), creepGrow (springs back out), creeperNear (an egg sits on its
// groove with it coming: the teaching hook, main.js lessonAsk('creep_thorn'); one per approach). Burnt / snapped / a hit
// are the thorn's own events (thornBurn, thornSnap, break with why 'thorn', graze).
import { Vec2, testOverlap } from 'planck';
import { RING_TH, clamp, wrap } from './geom.js';
import { ringPt, ringSpd } from './shapes.js';

const m3 = (easy, medium, hard) => ({ easy, medium, hard });
export const CREEP = {
  h: 0.24, // m: a standing thorn's own height (sim.js addThorn's default)
  babyH: 0.17, // m: the young thorn of the first meeting
  half: 0.13, // m: half a thorn's base (sim.js addThorn)
  reach: 0.2, // m: an egg's half width (the planner's margin either side of the thorn)
  vK: m3(0.72, 1, 1.15), // slide speed x
  restK: m3(1.45, 1, 0.85), // rest x (Medium: the level's own rest, never under minRest)
  minRest: 0.8, // s: the shortest rest on Medium
  wind: 0.45, // s: the wind-up at the end of a rest
  bite: 0.55, // s it holds after a hit
  regrow: m3(9, 7, 5.5), // s as a stub
  warn: 0.5, // s: the stub shivers before it springs out (the retracting thorn's warning)
  grow: 0.2, // s to spring back out (a retracting thorn's rate: 5 /s)
  nearT: 2.2, // s: creeperNear fires when the thorn will reach an egg within this
};
const sstep = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
// where it is along one slide (0..1) at s (0..1 of the slide's time): slow off the mark, fastest past the middle, a firm stop
// (the last stretch is not eased out to nothing: it runs into its end stop at about 40% of its top speed and stops dead)
const E_CUT = 0.88, E_N = sstep(E_CUT);
export const creepEase = (s) => sstep(E_CUT * Math.pow(clamp(s, 0, 1), 1.3)) / E_N;

export const creepMethods = {
  creepInit(L) {
    this.creeps = [];
    (L.rings || []).forEach((rs, ri) => {
      const o = rs.creep, ring = this.rings[ri];
      if (!o || !ring) return;
      const side = o.side === 'out' ? 'out' : 'in', baby = o.baby ? 1 : 0;
      const a0 = (Math.min(o.a0, o.a1) * Math.PI) / 180, a1 = (Math.max(o.a0, o.a1) * Math.PI) / 180;
      this.addThorn(ring, a0, side, baby ? CREEP.babyH : CREEP.h, 'hook', false);
      const th = ring.thorns[ring.thorns.length - 1];
      const C = {
        id: this.creeps.length, ri, ti: ring.thorns.length - 1, side, a0, a1, v: o.v || 0.5, rest: o.rest || 1, baby,
        u: a0, dir: 1, ph: 'rest', t: o.delay ?? 2.5, dur: o.delay ?? 2.5, s: 0, from: a0, to: a1, spd: 0, back: 'rest', // u: its ring-local angle; s: 0..1 of this slide's time
        hits: 0, near: 0,
      };
      th.mv = C; if (baby) th.baby = 1;
      this.creeps.push(C);
    });
  },
  creepM(o) { return o[this.mode] ?? o.medium; },
  creepThorn(C) { return this.rings[C.ri].thorns[C.ti]; },
  creepRest(C) { return Math.max(CREEP.minRest * (this.mode === 'medium' ? 1 : 0), C.rest * this.creepM(CREEP.restK)); },
  creepRh(C) { const th = this.creepThorn(C); return (th.base + th.tip) / 2; }, // the radius of its middle
  creepSlideT(C, span = C.a1 - C.a0) { return Math.max(0.6, (Math.abs(span) * this.rings[C.ri].r) / (C.v * this.creepM(CREEP.vK))); },
  creepSet(C, ph, t) { C.ph = ph; C.t = C.dur = t; },
  // its middle in world space (a: the world angle it stands at)
  creepHead(C) {
    const ring = this.rings[C.ri], th = this.creepThorn(C), A = ring.body.getAngle();
    const [lx, ly] = ringPt(ring, C.u, (th.base + th.tip) / 2), c = Math.cos(A), s = Math.sin(A);
    return { x: lx * c - ly * s, y: lx * s + ly * c, a: A + C.u };
  },
  creepLive(C) { return C.ph !== 'gone' && C.ph !== 'stub' && C.ph !== 'grow'; }, // out and sharp
  creepReach() { return CREEP.half + CREEP.reach; },
  // move the thorn (and its hit shape: the standing thorn's own triangle, sim.js addThorn) to ring-local angle u
  creepPlace(C, u) {
    C.u = u;
    const th = this.creepThorn(C), ring = th.ring;
    if (th.a === u) return;
    th.a = u;
    const half = CREEP.half / ringSpd(ring, u), p = (rad, ang) => Vec2(...ringPt(ring, ang, rad));
    th.shape._set(th.side === 'in' ? [p(th.base, u - half), p(th.base, u + half), p(th.tip, u)] : [p(th.base, u + half), p(th.base, u - half), p(th.tip, u)]);
  },
  // Eggs against the thorn. It has no fixture (a fixture that moves on a ring would stir the physics of the whole vault:
  // a level with a moving thorn nobody touches plays exactly as it does without one), so the touch is tested here, egg
  // hull against the thorn's triangle, and handed to the one rule of every thorn (sim.js thornTouch, with the same
  // checks before it as preSolve) through a stand-in contact. Where the rule leaves a standing thorn solid (Easy's
  // crack and shove, the baby, a graze) the egg is pushed off the triangle instead of resting inside it.
  creepTouch(C, th) {
    const rb = th.ring.body, xr = rb.getTransform(), other = { kind: 'thorn', thorn: th };
    for (const e of this.eggs) {
      if (!e.body || !e.fix) continue;
      const on = e.alive && !e.saved && !e.phx && testOverlap(e.bubbleFix ? e.bubbleFix.getShape() : e.fix.getShape(), 0, th.shape, 0, e.body.getTransform(), xr);
      if (!on) { if (e.spk && e.spk.has(th.key)) e.spk.delete(th.key); continue; } // (sim.js endContact)
      if (th.ext < 0.5) continue;
      // the stand-in contact: its one point is the triangle's nearest point to the egg's centre
      const pe = e.body.getPosition(), lp = rb.getLocalPoint(pe), V = th.shape.m_vertices;
      let bx = 0, by = 0, bd = 1e9;
      for (let i = 0; i < 3; i++) { const a = V[i], b = V[(i + 1) % 3], ex = b.x - a.x, ey = b.y - a.y, t = clamp(((lp.x - a.x) * ex + (lp.y - a.y) * ey) / (ex * ex + ey * ey || 1), 0, 1), qx = a.x + ex * t, qy = a.y + ey * t, d = Math.hypot(lp.x - qx, lp.y - qy); if (d < bd) { bd = d; bx = qx; by = qy; } }
      const pt = rb.getWorldPoint(Vec2(bx, by));
      const fc = { off: false, setEnabled(v) { if (!v) this.off = true; }, getWorldManifold: () => ({ points: [pt] }) };
      if (this.v3Contact(fc, e, other) || this.chickContact(fc, e, other)) continue;
      if (!e.alive || e.saved) continue;
      this.thornTouch(fc, e, th);
      if (fc.off || !e.alive || !e.body || e.safeT >= 1) continue;
      // still solid to this egg: push it off
      let nx = pe.x - pt.x, ny = pe.y - pt.y; const d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d;
      const ve = e.body.getLinearVelocity(), vt = rb.getLinearVelocityFromWorldPoint(pt), A = rb.getAngle() + th.a, sv = C.spd * Math.sign(C.to - C.from);
      const rel = (ve.x - (vt.x - Math.sin(A) * sv)) * nx + (ve.y - (vt.y + Math.cos(A) * sv)) * ny;
      if (rel < 0.5) { const m = e.body.getMass() * (0.5 - rel); e.body.applyLinearImpulse(Vec2(nx * m, ny * m), pe, true); }
    }
  },
  // is there still ring under it?
  creepFloor(C) {
    for (const sg of this.rings[C.ri].segs) { const am = (sg.a0 + sg.a1) / 2; if (Math.abs(wrap(C.u - am)) <= (sg.a1 - sg.a0) / 2 + 1e-6) return sg.alive; }
    return false;
  },

  creepStep(dt) {
    if (!this.creeps || !this.creeps.length) return;
    for (const C of this.creeps) {
      if (C.ph === 'gone') continue;
      const th = this.creepThorn(C);
      if (!th.alive) { C.ph = 'gone'; C.spd = 0; continue; } // snipped (or the vault burst)
      if (this.state !== 'play' || (this.stkFrozen && this.stkFrozen())) continue; // (Tick-Tock's stopped time holds it where it is)
      if (!this.creepFloor(C)) { th.alive = false; C.ph = 'gone'; C.spd = 0; this.emit('thornSnap', { ...this.creepHead(C), thorn: th }); continue; }
      this.creepOne(C, th, dt);
      if (th.alive) this.creepTouch(C, th);
      if (C.ph === 'slide' || C.ph === 'rest') this.creepNear(C);
    }
  },
  creepGo(C) {
    C.from = C.u; C.to = C.dir > 0 ? C.a1 : C.a0; C.s = 0;
    if (Math.abs(C.to - C.from) < 1e-4) { C.dir = -C.dir; C.to = C.dir > 0 ? C.a1 : C.a0; }
    this.creepSet(C, 'slide', this.creepSlideT(C, C.to - C.from));
    this.emit('creepGo', { id: C.id, ...this.creepHead(C), dir: C.dir });
  },
  creepOne(C, th, dt) {
    // (a retracting ring pulls every thorn of its ring in and out, this one too: sim.js; cut back, it stays in)
    if (C.ph === 'stub') th.ext = 0;
    switch (C.ph) {
      case 'rest':
        C.spd = 0;
        if ((C.t -= dt) <= 0) this.creepGo(C);
        return;
      case 'slide': {
        C.s = Math.min(1, C.s + dt / C.dur);
        const u = C.from + (C.to - C.from) * creepEase(C.s);
        C.spd = (Math.abs(u - C.u) * th.ring.r) / Math.max(1e-6, dt);
        this.creepPlace(C, u);
        if (C.s >= 1) { C.dir = -C.dir; C.spd = 0; C.near = 0; this.creepSet(C, 'rest', this.creepRest(C)); this.emit('creepStop', { id: C.id, ...this.creepHead(C) }); }
        return;
      }
      case 'bite': C.spd = 0; if ((C.t -= dt) <= 0) { C.ph = C.back; C.t = C.backT; C.dur = C.backDur; } return;
      case 'stub':
        C.spd = 0;
        if (C.t > 0.1 || !this.creepEggOn(C)) C.t -= dt; // (it will not spring out under an egg that sits right on it)
        if (C.t <= 0) { this.creepSet(C, 'grow', CREEP.grow); this.emit('creepGrow', { id: C.id, ...this.creepHead(C) }); }
        return;
      case 'grow':
        th.ext = Math.min(1, th.ext + dt / CREEP.grow);
        if ((C.t -= dt) <= 0) { th.ext = 1; this.creepSet(C, 'rest', this.creepRest(C)); }
        return;
    }
  },
  creepEggOn(C) {
    const H = this.creepHead(C);
    for (const e of this.eggs) { if (!e.alive || e.saved || !e.body) continue; const p = e.body.getPosition(); if (Math.hypot(p.x - H.x, p.y - H.y) < 0.42) return true; }
    return false;
  },
  // sim.js preSolve: this moving thorn has just harmed an egg (a break, or Easy's crack and shove): it holds for a beat
  creepBit(th) {
    const C = th.mv;
    if (!C || C.ph === 'bite' || !this.creepLive(C)) return;
    C.hits++;
    if (this.t - (C.bitT ?? -9) < 1.5) return; // (an egg it is shoving along: one beat, not a stutter)
    C.bitT = this.t; C.back = C.ph; C.backT = C.t; C.backDur = C.dur;
    C.ph = 'bite'; C.t = CREEP.bite; C.spd = 0;
  },
  // sim.js removeThorn: burnt, snapped or pecked, a moving thorn is cut back to its stub where it is, and grows back.
  // True = it was (or already is) cut, and stays a thorn; false = it is not a live moving thorn.
  creepCut(th) {
    const C = th.mv;
    if (!C || C.ph === 'gone') return false;
    if (!this.creepLive(C)) return true;
    this.creepSet(C, 'stub', this.creepM(CREEP.regrow)); C.spd = 0; C.near = 0;
    th.ext = 0;
    this.chickGain = (this.chickGain || 0) + 2; // the planner counts it like cleared thorns
    return true;
  },
  // ring-local angle of an egg on this thorn's face (null when it is not on that face's side of the rim)
  creepEggU(C, e) {
    const ring = this.rings[C.ri], p = e.body.getPosition(), d = Math.hypot(p.x, p.y);
    if (Math.abs(d - this.creepRh(C)) > 0.48) return null;
    return Math.atan2(p.y, p.x) - ring.body.getAngle();
  },
  // seconds until the thorn reaches ring-local angle u (Infinity when it will not, this slide or the next)
  creepEta(C, u) {
    if (!this.creepLive(C)) return Infinity;
    const rh = Math.max(0.3, this.creepRh(C)), m = this.creepReach(C) / rh;
    const mid = (C.a0 + C.a1) / 2;
    let w = wrap(u - mid) + mid;
    if (w < C.a0 - m || w > C.a1 + m) return Infinity;
    if (Math.abs(w - C.u) < m) return 0; // it is there now
    w = clamp(w, C.a0, C.a1);
    const inv = (f) => { let lo = 0, hi = 1; for (let i = 0; i < 18; i++) { const md = (lo + hi) / 2; if (creepEase(md) < f) lo = md; else hi = md; } return (lo + hi) / 2; };
    // a slide from `from` to `to` that is at time-share s0 now: s until it is at w (Infinity: w is behind it)
    const along = (from, to, s0, T) => { const f = (w - from) / (to - from); return f < creepEase(s0) - 0.02 || f > 1.02 ? Infinity : Math.max(0, (inv(clamp(f, 0, 1)) - s0) * T); };
    const next = (dir) => along(dir > 0 ? C.a0 : C.a1, dir > 0 ? C.a1 : C.a0, 0, this.creepSlideT(C)); // a whole slide in direction dir
    let ph = C.ph, t = C.t, pre = 0;
    if (ph === 'bite') { pre = C.t; ph = C.back; t = C.backT; }
    if (ph === 'slide') {
      const T = C.dur, here = Math.abs(C.to - C.from) > 1e-6 ? along(C.from, C.to, C.s, T) : Infinity;
      return pre + (here !== Infinity ? here : (1 - C.s) * T + this.creepRest(C) + next(-C.dir));
    }
    // resting: its next slide starts where it stands (an end, or where it grew back)
    const to = C.dir > 0 ? C.a1 : C.a0, span = to - C.u;
    if (Math.abs(span) < 1e-4) return pre + t + next(-C.dir);
    const T = this.creepSlideT(C, span), here = along(C.u, to, 0, T);
    return pre + t + (here !== Infinity ? here : T + this.creepRest(C) + next(-C.dir));
  },
  // 0..1: how soon this egg will meet the thorn (the planner's caution, the danger level)
  creepThreat(e) {
    if (!this.creeps || !e.body) return 0;
    let th = 0;
    for (const C of this.creeps) {
      if (!this.creepLive(C)) continue;
      const u = this.creepEggU(C, e);
      if (u == null) continue;
      const eta = this.creepEta(C, u);
      if (eta === Infinity) continue;
      th = Math.max(th, clamp(1.15 - eta / 3.5, 0.25, 1));
    }
    return th;
  },
  // the teaching hook: an egg sits on the groove and the thorn will reach it soon
  creepNear(C) {
    if (C.near) return;
    for (const e of this.aliveEggs()) {
      if (!e.body) continue;
      const u = this.creepEggU(C, e);
      if (u == null) continue;
      const eta = this.creepEta(C, u);
      if (eta < CREEP.nearT) { // away: the way to turn its ring that carries it off the egg (+1 = counter-clockwise)
        C.near = 1; const H = this.creepHead(C), p = e.body.getPosition(), away = Math.sign(wrap(H.a - Math.atan2(p.y, p.x))) || 1;
        this.emit('creeperNear', { id: C.id, ring: C.ri, egg: e, eta, x: H.x, y: H.y, away }); return;
      }
    }
  },

  creepState() { return (this.creeps || []).map((C) => ({ ...C })); },
  creepLoad(S) { if (S && this.creeps) S.forEach((c, i) => { const C = this.creeps[i]; if (C) { Object.assign(C, c); this.creepPlace(C, C.u); } }); },
};
export const RING_FACE = (ring, side) => (side === 'in' ? ring.r - RING_TH / 2 : ring.r + RING_TH / 2); // the rim face a groove is cut in
