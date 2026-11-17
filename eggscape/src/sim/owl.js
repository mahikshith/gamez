// The Clockwork Owl (v4, the L50 boss). It runs on the boss framework of sim/boss.js (level.bossFight.kind = 'owl':
// phases, telegraphs, saved eggs stagger it); this file adds its own attacks and its gears. Mixed into Sim (sim.js), so
// `this` is the Sim. All state is plain data in this.owl (owlState / owlLoad), so rewind and the planner stay exact.
//
// Attacks (each telegraphed by boss.js: WARN s, then it acts):
//   swoop  : it marks the leading egg in the outer channel and dives at it. Its talons reach in only where the outer ring is
//            open over that egg: turn the gap away and it slams into the brass and reels (OWL.slam s, a free window). Caught,
//            the egg is flung back toward the vault centre (a crack, not on Easy). An IRON egg in its talons JAMS its gears:
//            it loses a gear (OWL.hp) and seizes up for OWL.jam s. Out of gears, it breaks down and attacks no more.
//   wind   : it winds the vault's spring: the ring under the leading egg and the next one out spin a quarter turn each,
//            opposite ways (the rings shown with arrows during the telegraph).
//   gears / gears2 : it drops one (two) gear bombs onto the floor where the leading egg(s) sit. A bomb rides its ring and
//            ticks (OWL.tick s), then bursts: eggs near it are blown away (a crack, not on Easy; iron and stone are safe),
//            thorns near it snap off and the floor under it is blown open for a few seconds (never the outermost ring). Turn the ring to carry a bomb
//            away from your eggs, or under thorns you want gone. An iron egg touching a ticking bomb jams it (a dud).
// Thunderclap stalls it for the full stun (sim/powers2.js p2Boss: a machine has no resistance to lightning).
// Phase flag summon: the clockwork cast (sim/clockwork.js) comes in.
import { Vec2 } from 'planck';
import { RING_TH, wrap, clamp } from './geom.js';
import { ringPt, ringSpd } from './shapes.js';

const m3 = (easy, medium, hard) => ({ easy, medium, hard });
export const OWL = {
  hp: m3(2, 3, 3), // gears it can lose
  jam: m3(5, 4, 3.5), // s seized up after an iron egg
  slam: m3(2.6, 2, 1.7), // s reeling after hitting the brass
  fling: 3.4, // m/s an egg it catches is flung inward
  wind: Math.PI / 2, // rad per wound ring
  fly: 0.6, tick: m3(2.6, 1.9, 1.6), blast: 0.85, thorn: 0.8, hole: 0.5, holeT: 4, // gear bombs
  h: 1.9, // m tall (render/owl.js draws to this)
};

export const owlMethods = {
  owlInit(L) {
    const F = L.bossFight;
    this.owl = null;
    if (!F || F.kind !== 'owl') return;
    const M = this.mode in OWL.hp ? this.mode : 'medium';
    this.owlM = M;
    this.owl = { hp: F.hp ?? OWL.hp[M], max: F.hp ?? OWL.hp[M], jam: 0, down: 0, gb: [], gbId: 0, sw: null, woke: 0, eid: 0, hits: 0 };
  },
  owlLive() { const O = this.owl; return !!O && !O.down; },

  // ---------- boss.js startAttack for the owl's attacks: the telegraph's targets, or null (nothing to do now)
  owlStart(B, name) {
    const O = this.owl;
    if (!O || O.down) return null;
    const n = this.rings.length, eggs = this.owlTargets();
    if (name === 'swoop') {
      const out = eggs.filter((e) => this.channelOf(e) === n - 1);
      if (!out.length) return null;
      const e = out.find((q) => this.owlExposed(q)) || out[0], p = e.body.getPosition();
      return { eid: e.id, aim: p.x, tx: p.x, ty: p.y };
    }
    if (name === 'wind') {
      const e = eggs[0];
      if (!e) return null;
      const c = Math.min(n - 1, this.channelOf(e)), list = [], dirs = [];
      for (const ri of [c, c + 1, c - 1]) {
        const ring = this.rings[ri];
        if (!ring || !ring.grabbable || ring.gear || (this.bx.rl[ri].frost > 0) || list.length >= 2) continue;
        list.push(ri); dirs.push(ring.oneway || (list.length % 2 ? 1 : -1));
      }
      return list.length ? { rings: list, dirs } : null;
    }
    if (name === 'gears' || name === 'gears2') {
      const spots = [];
      for (const e of eggs.slice(0, name === 'gears2' ? 2 : 1)) {
        const ri = Math.min(n - 1, this.channelOf(e)), ring = this.rings[ri], p = e.body.getPosition();
        const la = Math.atan2(p.y, p.x) - ring.body.getAngle();
        if (!spots.some((s) => s.ri === ri && Math.abs(wrap(s.la - la)) * ring.r < 0.9)) spots.push({ ri, la });
      }
      return spots.length ? { spots, aim: eggs[0].body.getPosition().x } : null;
    }
    return null;
  },
  // eggs it goes for: inside the vault, the most advanced first (a decoy first, a shrunk egg last)
  owlTargets() {
    const n = this.rings.length;
    const T = this.aliveEggs().filter((e) => this.channelOf(e) < n && !e.thf).sort((a, b) => (a.shrink > 0) - (b.shrink > 0) || this.channelOf(b) - this.channelOf(a) || a.id - b.id);
    const D = this.p2Lure && this.p2Lure();
    return D && this.channelOf(D) < n ? [D, ...T] : T;
  },
  // is the outer ring open over this egg (a gap, a hole, a broken piece) within a hand's breadth?
  owlExposed(e) {
    const outer = this.rings[this.rings.length - 1], p = e.body.getPosition(), wa = Math.atan2(p.y, p.x);
    return [-0.1, 0, 0.1].some((d) => !this.solidAt(outer, Math.cos(wa + d), Math.sin(wa + d)));
  },

  // ---------- boss.js actAttack
  owlAct(B, A) {
    const O = this.owl, M = this.owlM;
    if (!O || O.down) return;
    if (A.name === 'swoop') {
      const e = this.eggs.find((q) => q.id === A.eid && q.alive && !q.saved && q.body);
      const n = this.rings.length;
      let res = 'miss', x = A.tx, y = A.ty;
      if (e && this.channelOf(e) === n - 1) {
        const p = e.body.getPosition();
        x = p.x; y = p.y;
        if (!this.owlExposed(e)) res = 'slam';
        else if (e.iron) res = 'jam';
        else res = 'grab';
      }
      const R = this.outerR, d = Math.hypot(x, y) || 1;
      O.sw = { x: res === 'slam' || res === 'miss' ? (x / d) * R : x, y: res === 'slam' || res === 'miss' ? (y / d) * R : y, t: 0.75, res };
      if (res === 'grab') {
        const p = e.body.getPosition(), r = Math.hypot(p.x, p.y) || 1;
        e.body.setLinearVelocity(Vec2((-p.x / r) * OWL.fling, (-p.y / r) * OWL.fling + 1));
        e.freefall = 0;
        if (M !== 'easy') this.crack(e, 0, 'owl');
        else e.safeT = Math.max(e.safeT || 0, 1.4); // Easy: a fling never cracks or shatters on landing
        this.emit('owlGrab', { x: p.x, y: p.y, egg: e });
      } else if (res === 'jam') this.owlJam(B, x, y, 'iron');
      else if (res === 'slam') { B.dizzy = Math.max(B.dizzy, OWL.slam[M]); B.t = Math.max(B.t, OWL.slam[M] + 0.6); this.emit('owlSlam', { x: O.sw.x, y: O.sw.y }); }
      else this.emit('owlMiss', { x, y });
      return;
    }
    if (A.name === 'wind') {
      // Easy: an eighth of a turn, and the eggs ride it out without a break
      const easy = (this.mode || 'medium') === 'easy';
      A.rings.forEach((ri, k) => { const R = this.bx.rl[ri]; if (this.rings[ri].grabbable && !(R.frost > 0)) { R.spin = OWL.wind * (easy ? 0.5 : 1); R.dir = A.dirs[k]; } });
      if (easy) for (const e of this.aliveEggs()) e.safeT = Math.max(e.safeT || 0, 1.6);
      this.emit('owlWind', { rings: A.rings, x: B.x, y: B.y });
      return;
    }
    if (A.name === 'gears' || A.name === 'gears2') {
      for (const s of A.spots) O.gb.push({ id: ++O.gbId, ri: s.ri, la: s.la, ph: 'fly', t: 0, x0: B.x, y0: B.y - OWL.h * 0.35, dud: 0 });
      this.emit('owlDrop', { x: B.x, y: B.y, n: A.spots.length });
    }
  },
  owlJam(B, x, y, why) {
    const O = this.owl, M = this.owlM;
    O.hp = Math.max(0, O.hp - 1);
    O.hits++;
    O.jam = OWL.jam[M];
    B.atk = null;
    B.t = Math.max(B.t, O.jam + 1);
    B.dizzy = Math.max(B.dizzy, O.jam);
    B.flinch = 0.9;
    if (O.hp <= 0) { O.down = 1; for (const G of O.gb) G.dud = 1; }
    this.emit('owlJam', { x, y, bx: B.x, by: B.y, hp: O.hp, max: O.max, why, down: O.down });
  },

  // point on ring ri's floor (inner face) at ring-local la, h m up off it
  owlFloor(ri, la, h = 0) {
    const ring = this.rings[ri], A = ring.body.getAngle(), [lx, ly] = ringPt(ring, la, ring.r - RING_TH / 2 - h);
    return { x: lx * Math.cos(A) - ly * Math.sin(A), y: lx * Math.sin(A) + ly * Math.cos(A) };
  },
  gearAt(G) {
    const q = this.owlFloor(G.ri, G.la, 0.16);
    if (G.ph !== 'fly') return q;
    const f = clamp(G.t / OWL.fly, 0, 1);
    return { x: G.x0 + (q.x - G.x0) * f, y: G.y0 + (q.y - G.y0) * f + 1.2 * Math.sin(Math.PI * f) };
  },

  // ---------- every step (from boss.js bossStep, the owl only)
  owlStep(B, dt) {
    const O = this.owl, M = this.owlM;
    if (!O) return;
    if (O.sw && (O.sw.t -= dt) <= 0) O.sw = null;
    if (O.jam > 0) O.jam -= dt;
    if (O.down) { B.atk = null; B.t = 99; }
    const ph = (this.level.bossFight.phases || [])[B.phase] || {};
    if (ph.summon && !O.woke && this.cwWake) { O.woke = 1; this.cwWake(); this.emit('bossSummon', { x: B.x, y: B.y, who: 'clockwork' }); }
    for (let i = O.gb.length - 1; i >= 0; i--) {
      const G = O.gb[i];
      G.t += dt;
      if (G.ph === 'fly') { if (G.t >= OWL.fly) { G.ph = 'tick'; G.t = 0; const q = this.gearAt(G); this.emit('gearLand', { x: q.x, y: q.y }); } continue; }
      const q = this.gearAt(G);
      if (!G.dud) for (const e of this.aliveEggs()) {
        if (!e.iron) continue;
        const p = e.body.getPosition();
        if (Math.hypot(p.x - q.x, p.y - q.y) < 0.42) { G.dud = 1; G.t = Math.max(G.t, OWL.tick[M] - 0.6); this.emit('gearDud', { x: q.x, y: q.y }); break; }
      }
      if (G.t < OWL.tick[M]) continue;
      O.gb.splice(i, 1);
      if (G.dud) { this.emit('gearFizz', { x: q.x, y: q.y }); continue; }
      this.gearBurst(G, q, M);
    }
  },
  gearBurst(G, q, M) {
    this.emit('gearBurst', { x: q.x, y: q.y, R: OWL.blast });
    for (const e of this.aliveEggs()) {
      const p = e.body.getPosition(), dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy);
      if (d > OWL.blast) continue;
      if (e.honey > 0) { e.honey = 0; e.hold = null; e.honeyCD = 1; }
      const m = e.body.getMass() * (e.iron ? 1.5 : 4), u = d || 1;
      e.body.applyLinearImpulse(Vec2((dx / u) * m, (dy / u) * m + m * 0.3), p, true);
      if (M !== 'easy' && !e.iron) this.crack(e, 0, 'gear');
      else if (M === 'easy') e.safeT = Math.max(e.safeT || 0, 1.2); // Easy: a blast never breaks an egg on landing
    }
    for (const ring of this.rings) for (const th of ring.thorns) {
      if (!th.alive) continue;
      const A = ring.body.getAngle(), [lx, ly] = ringPt(ring, th.a, (th.base + th.tip) / 2);
      if (Math.hypot(lx * Math.cos(A) - ly * Math.sin(A) - q.x, lx * Math.sin(A) + ly * Math.cos(A) - q.y) < OWL.thorn) this.removeThorn(th, 'snap');
    }
    if (G.ri >= this.rings.length - 1) return; // never the outermost ring: a hole there drops eggs to the ground, wide of the nest
    const ring = this.rings[G.ri], half = OWL.hole / ringSpd(ring, G.la);
    for (const sg of ring.segs) if (sg.alive && !sg.hardIce && Math.abs(wrap((sg.a0 + sg.a1) / 2 - G.la)) < half) { sg.melt = OWL.holeT; sg.vh = 0; }
  },

  // ---------- state (planner / rewind)
  owlState() { const O = this.owl; return O ? { ...O, gb: O.gb.map((G) => ({ ...G })), sw: O.sw ? { ...O.sw } : null } : null; },
  owlLoad(S) { if (S && this.owl) this.owl = { ...S, gb: S.gb.map((G) => ({ ...G })), sw: S.sw ? { ...S.sw } : null }; },
};
