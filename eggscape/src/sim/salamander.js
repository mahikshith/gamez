// The lava salamander (v3.2 creature). Mixed into Sim (sim.js: Object.assign(Sim.prototype, salMethods)), so `this` is
// the Sim. No imports from sim.js (it imports this file). Every field is plain data in this.sals, this.salHot and on
// eggs (hotK, in EGG_KEYS), copied by salState() / restored by salLoad(), so rewind and the planner stay exact.
//
// level.salamander {delay, every, a, ch, dir, size} or an array of them. ch = the channel it walks (1 .. rings-1),
// a = start angle (deg, 90 = top), dir = +1 counter-clockwise, every = s between breaths (Medium).
// level.bossFight.kind 'salamander' makes the first one the boss: 1.3x, breathing on the boss's phase rhythm, and the
// boss's lava rocks fly from its mouth (boss.js reads salBossPose).
//
// It walks a channel (follow-the-leader trail, like the snakes) and climbs through gaps toward the channel of the
// leading egg. It never eats eggs. It grips both walls: the ring under it (the channel's floor ring, or the ring whose
// gap it is crossing) carries it round, so turning that ring steers it.
// Every `every` s it stops (always with all four feet down), telegraphs (coil, pitch up, frill, inhale: WARN x the
// mode's PRED.warn), then breathes a jet at one wall just ahead of it. That section turns red-hot for HOT_T: an egg
// touching it gets one crack (water eggs, stone, rock skin and the feather are immune; Easy never breaks one), and
// thorns (and a thorn curtain) on it burn away. Water (an egg with the water shell, or a water orb) near it makes it
// hiss and cool to grey for COOL_T (harmless), backing off. hitSalamander() takes the hazards: a gust shoves it along
// the channel, lava and quakes don't hurt it (lava recharges its breath), lightning, a glow flash or a dash bonk daze it.
// A snake meeting it in its channel starts a face-off (RIVAL_T): neither bothers the eggs, then both back off.
// On a win it dives into a lava pit; on a loss it stops and grins.
import { RING_TH, TAU, wrap, clamp } from './geom.js';
import { BOSS_MODE, bossPhases } from './boss.js';

export const SAL = {
  svl: 1.8, len: 1.96, // snout to hips (m) and snout to tail tip (units of svl): the art's sizes
  speed: 0.5, brakeV: 1.1, backV: 0.6, diveV: 3.4, // m/s
  trail: 0.05, ahead: 0.85, hotLen: 1.0, // m between trail points, jet spot ahead of the snout, hot section length
  every: 6, warn: 0.7, fire: 0.55, lit: 0.12, settle: 0.4, hotT: 4, // s
  cool: 5, hiss: 0.6, wetCD: 2.5, coolBack: 1.0, // water
  rival: 3, rivalR: 1.0, rivalGap: 1.3, rivalCD: 9, rivalBack: 1.2, // snake face-off
  climbCD: 4, boss: 1.3,
};
const deg = (d) => (d * Math.PI) / 180;
const mod = (a, b) => ((a % b) + b) % b;

export const salMethods = {
  // ---------- build
  salInit(L) {
    this.sals = [];
    this.salHot = []; // hot ring segments: [{ri, si}] (the heat itself is sg.hot / sg.hotK)
    this.salBurnN = 0;
    const boss = !!(L.bossFight && L.bossFight.kind === 'salamander');
    let list = !L.salamander ? [] : Array.isArray(L.salamander) ? L.salamander : [L.salamander];
    if (boss && !list.length) list = [{ delay: L.bossFight.delay ?? 3, ch: 2, a: 90 }];
    const n = this.rings.length;
    if (n < 2) return;
    list.forEach((P, i) => {
      const isBoss = boss && i === 0, size = P.size || (isBoss ? SAL.boss : 1);
      this.sals.push({
        id: i, size, boss: isBoss ? 1 : 0, ch: clamp(P.ch ?? 2, 1, n - 1), dir: P.dir === -1 ? -1 : 1, a0: deg(P.a ?? 90),
        every: P.every || SAL.every, ph: 'wait', t: P.delay ?? 3, dur: 1, pend: null, pendT: 0, mv: 1, stopAt: 0,
        a: 0, rad: 0, pts: [], odo: 0, car: -1, carA: 0, next: 0, tw: 1, cool: 0, wetCD: 0, back: 0, shove: 0,
        rivalCD: 0, rid: -1, rv: 0, climbCD: 0, climb: null, charge: 0, lavaCD: 0, hold: 0, bph: 0, bk: -1, bsaved: 0, hole: 0,
      });
    });
  },

  // ---------- geometry helpers
  salMid(c) { return (this.rings[c - 1].r + this.rings[c].r) / 2; },
  salStride(C) { return 0.4 * SAL.svl * C.size; },
  salBodyLen(C) { return SAL.len * SAL.svl * C.size; },
  salHead(C) { return C.pts[0] || { x: C.rad * Math.cos(C.a), y: C.rad * Math.sin(C.a) }; },
  salLive(C) { return C.ph !== 'wait' && C.ph !== 'gone' && C.pts.length > 1; },
  salPt(q, a, r) { q.a = a; q.r = r; q.x = r * Math.cos(a); q.y = r * Math.sin(a); return q; },
  salCh(C) { return clamp(this.chAt(C.rad), 1, this.rings.length - 1); },

  // in the boss fight: breath timing and the mouth the lava rocks come from
  salBossPose(B) {
    const C = this.sals && this.sals.find((c) => c.boss && this.salLive(c));
    if (!C) return;
    const h = C.pts[0], q = C.pts[Math.min(C.pts.length - 1, 6)], dx = h.x - q.x, dy = h.y - q.y, l = Math.hypot(dx, dy) || 1;
    B.x = h.x + (dx / l) * 0.25; B.y = h.y + (dy / l) * 0.25;
    B.face = dx >= 0 ? 1 : -1;
  },

  // where the jet lands: the wall (C.tw: 0 inner, 1 outer) of its channel, SAL.ahead in front of the snout
  salTarget(C) {
    const c = this.salCh(C), ri = c - 1 + C.tw, ring = this.rings[ri], h = this.salHead(C);
    const a = Math.atan2(h.y, h.x) + C.dir * (SAL.ahead * C.size) / Math.max(0.5, Math.hypot(h.x, h.y));
    return { ri, a, x: ring.r * Math.cos(a), y: ring.r * Math.sin(a) };
  },
  // pick the wall: the one nearer an egg (within 1.6 m), else the lower one (the side eggs rest on)
  salPickWall(C) {
    const c = this.salCh(C), h = this.salHead(C), a = Math.atan2(h.y, h.x) + C.dir * (SAL.ahead * C.size) / Math.max(0.5, C.rad);
    const spot = (ri) => ({ x: this.rings[ri].r * Math.cos(a), y: this.rings[ri].r * Math.sin(a) });
    const A = spot(c - 1), B = spot(c);
    let best = 1.6, w = Math.sin(a) > 0 ? 0 : 1;
    for (const e of this.aliveEggs()) {
      const p = e.body.getPosition();
      const da = Math.hypot(p.x - A.x, p.y - A.y), db = Math.hypot(p.x - B.x, p.y - B.y);
      if (Math.min(da, db) < best) { best = Math.min(da, db); w = da < db ? 0 : 1; }
    }
    return w;
  },

  // ---------- every step in play (boss.js v31Step calls it)
  salamanderStep(dt) {
    if (!this.sals || !this.sals.length) return;
    this.salHotStep(dt);
    for (const C of this.sals) this.salOne(C, dt, true);
    this.salHeat();
  },
  // after the level is decided (predStep): dive on a win, grin on a loss
  salEndStep(dt) {
    if (!this.sals || !this.sals.length) return;
    this.salHotStep(dt);
    const win = this.state === 'winning' || this.state === 'won';
    for (const C of this.sals) {
      if (C.ph === 'wait' || C.ph === 'gone') { C.ph = 'gone'; continue; }
      if (win && C.ph !== 'dive') { C.ph = 'dive'; C.t = 0; C.pend = null; C.hole = C.odo + 0.55 * C.size; C.climb = null; C.cool = 0; this.salRelease(C); const h = C.pts[0]; this.emit('salDive', { x: h.x, y: h.y, id: C.id }); }
      else if (!win && C.ph !== 'grin' && C.pend !== 'grin') { this.salRelease(C); C.cool = 0; this.salHalt(C, 'grin', 9); }
      this.salOne(C, dt, false);
    }
  },

  salHotStep(dt) {
    for (let i = this.salHot.length - 1; i >= 0; i--) {
      const H = this.salHot[i], sg = this.rings[H.ri].segs[H.si];
      if ((sg.hot -= dt) <= 0 || !sg.alive) { sg.hot = 0; this.salHot.splice(i, 1); }
    }
  },

  salOne(C, dt, play) {
    if (C.ph === 'gone') return;
    if (C.ph === 'wait') { if (play && (C.t -= dt) <= 0) this.salEnter(C); return; }
    this.salCarry(C);
    for (const k of ['wetCD', 'rivalCD', 'climbCD', 'charge', 'lavaCD']) if (C[k] > 0) C[k] = Math.max(0, C[k] - dt);
    if (C.cool > 0) C.cool = Math.max(0, C.cool - dt);
    if (C.shove) this.salShove(C, dt);
    if (play) {
      if (C.boss) this.salBossSync(C);
      if (C.cool <= 0 && C.wetCD <= 0 && C.ph !== 'in') this.salWater(C);
      if ((C.ph === 'walk' || C.ph === 'brake' && C.pend === 'warn') && C.rivalCD <= 0) this.salRivalCheck(C);
    }
    switch (C.ph) {
      case 'in': if ((C.t -= dt) <= 0) this.salSet(C, 'walk'); break;
      case 'walk': {
        if (play && C.cool <= 0 && (C.next -= dt) <= 0 && !C.climb && !this.salCrossing(C)) {
          C.tw = this.salPickWall(C);
          this.salHalt(C, 'warn', SAL.warn * this.PM.warn);
          break;
        }
        this.salMove(C, SAL.speed * Math.sqrt(C.size) * dt);
        break;
      }
      case 'brake': {
        const r = (C.stopAt - C.odo) * C.mv, d = Math.min(Math.max(0, r), SAL.brakeV * dt);
        if (C.mv > 0) this.salMove(C, d, true); else this.salBackWalk(C, d);
        if (r - d <= 1e-6) { C.odo = C.stopAt; this.salSet(C, C.pend, C.pendT); }
        break;
      }
      case 'warn':
        if ((C.t -= dt) <= 0) { this.salSet(C, 'fire', SAL.fire); C.lit = 0; }
        break;
      case 'fire': // the wall heats when the jet reaches it, a beat after the mouth opens
        if (!C.lit && C.dur - C.t >= SAL.lit) { C.lit = 1; this.salFire(C); }
        if ((C.t -= dt) <= 0) this.salSet(C, 'settle', SAL.settle);
        break;
      case 'settle':
        if ((C.t -= dt) <= 0) { C.next = this.salEvery(C); this.salSet(C, 'walk'); }
        break;
      case 'hiss': if ((C.t -= dt) <= 0) { C.back = SAL.coolBack * C.size; this.salSet(C, 'retreat'); } break;
      case 'retreat': {
        const d = Math.min(C.back, SAL.backV * dt);
        this.salBackWalk(C, d);
        if ((C.back -= d) <= 1e-6) { C.back = 0; if (C.cool > 0) this.salHalt(C, 'rest', 0); else this.salSet(C, 'walk'); }
        break;
      }
      case 'rest': if ((C.t -= dt) <= 0 && C.cool <= 0) { C.next = Math.max(C.next, 1.5); this.salSet(C, 'walk'); } break;
      case 'rival': this.salRivalStep(C, dt); break;
      case 'daze': if ((C.t -= dt) <= 0) { C.next = Math.max(C.next, 1.5); this.salSet(C, 'walk'); } break;
      case 'dive': {
        C.t += dt;
        if (C.t > 0.2) this.salMove(C, SAL.diveV * C.size * dt, true);
        if (C.odo - C.hole > this.salBodyLen(C) + 0.3) C.ph = 'gone';
        break;
      }
      case 'grin': break;
    }
  },

  salSet(C, ph, t = 0) {
    C.ph = ph; C.t = C.dur = t; C.pend = null;
    C.mv = ph === 'retreat' ? -1 : 1;
    if (ph === 'warn') { const T = this.salTarget(C), h = C.pts[0]; this.emit('salWarn', { x: T.x, y: T.y, hx: h.x, hy: h.y, ring: T.ri, id: C.id }); }
  },
  // Stop with all four feet down: a walk runs on (fast) to the next phase of the stride where every foot is planted
  // (the art's leg cycle is pinned to odo: frac(odo / stride) in [0, 0.1) or [0.5, 0.6)), then enters `ph`.
  salHalt(C, ph, t) {
    const moving = C.ph === 'walk' || C.ph === 'dive' ? 1 : C.ph === 'retreat' ? -1 : C.ph === 'brake' ? C.mv : 0;
    const q = C.odo / this.salStride(C), f = q - Math.floor(q);
    if (!moving || f < 0.1 || (f >= 0.5 && f < 0.6)) { this.salSet(C, ph, t); return; }
    const b = Math.floor(q), L = this.salStride(C);
    C.stopAt = (moving > 0 ? [b + 0.05, b + 0.55, b + 1.05].find((x) => x > q) : [b + 0.55, b + 0.05, b - 0.45].find((x) => x < q)) * L;
    C.mv = moving; C.ph = 'brake'; C.pend = ph; C.pendT = t;
  },
  salEvery(C) {
    if (C.boss) {
      const B = this.bx && this.bx.boss, ph = B ? bossPhases(this)[B.phase] || {} : {};
      return (ph.every || 4.5) * (BOSS_MODE[this.mode] || BOSS_MODE.medium).every;
    }
    return C.every * (this.PM.sal || 1);
  },
  // is the front half of the body in a ring's gap? (it never stops to breathe there)
  salCrossing(C) {
    const m = Math.min(C.pts.length, Math.ceil((SAL.svl * C.size) / SAL.trail)); // head to hips (the tail may trail in a gap)
    for (let i = 0; i < m; i += 3) for (const ring of this.rings) if (Math.abs(C.pts[i].r - ring.r) < RING_TH / 2 + 0.12) return true;
    return false;
  },

  salEnter(C) {
    const n = this.rings.length, ch = clamp(C.ch, 1, n - 1), r = this.salMid(ch), m = Math.ceil(this.salBodyLen(C) / SAL.trail) + 2;
    C.rad = r; C.a = C.a0; C.pts = [];
    for (let i = 0; i < m; i++) C.pts.push(this.salPt({}, C.a - C.dir * (i * SAL.trail) / r, r));
    C.ph = 'in'; C.t = C.dur = 0.6; C.next = C.boss ? this.salEvery(C) * 0.6 : C.every * (this.PM.sal || 1) * 0.6;
    C.car = -1;
    this.salCarry(C);
    this.emit('salIn', { x: C.pts[0].x, y: C.pts[0].y, id: C.id, boss: C.boss });
  },

  // ---------- the ring under it carries it round (the whole body rides one ring: no tearing at a gap)
  salCarry(C) {
    if (C.car >= 0) {
      const d = wrap(this.rings[C.car].body.getAngle() - C.carA);
      if (Math.abs(d) > 1e-9) {
        for (const q of C.pts) this.salPt(q, q.a + d, q.r);
        C.a += d;
      }
    }
    let car = -1;
    for (let i = 0; i < C.pts.length && car < 0; i += 2) for (const ring of this.rings) if (Math.abs(C.pts[i].r - ring.r) < RING_TH / 2 + 0.1) { car = ring.i; break; }
    if (car < 0) car = clamp(this.chAt(C.rad), 0, this.rings.length - 1);
    C.car = car; C.carA = this.rings[car].body.getAngle();
  },

  // ---------- walking. gait = true (default) counts toward odo (the art's leg cycle); a skid (gust) does not
  salMove(C, d, plain = false, gait = true) {
    if (d <= 0) return;
    const hc = this.salCh(C), ar = Math.max(C.rad, 0.5), edge = RING_TH / 2 + 0.3 * C.size;
    let lo = this.rings[hc - 1].r + edge, hi = this.rings[hc].r - edge;
    let gt = C.dir, gr = this.salMid(hc); // goal: tangential (m, ccw +) and radius
    if (!plain && !C.climb && C.climbCD <= 0 && !this.salCrossing(C)) this.salClimbPick(C, hc, ar);
    if (!plain && C.climb) {
      // through a gap: steer to its middle, and into the ring only while it lines up (or once the head is in it)
      const K = C.climb, ring = this.rings[K.ri], tang = wrap(ring.body.getAngle() + K.la - C.a) * ar, out = K.to === K.ri + 1;
      const from = out ? K.ri : K.ri + 1, lim = out ? ring.r - edge + 0.02 : ring.r + edge - 0.02;
      const committed = out ? C.rad > lim : C.rad < lim, aligned = Math.abs(tang) < K.len / 2 - 0.12;
      const g = K.gi >= 0 ? ring.gaps[K.gi] : null, open = !g || this.snakeGap(g);
      if (!committed && (!open || tang * C.dir < -0.35 || Math.abs(tang) > 1.2)) C.climb = null; // the gap turned away or shut
      else {
        gt = tang; gr = aligned || committed || Math.abs(tang) < K.len / 2 + 0.2 ? this.salMid(K.to) : this.salMid(from);
        if (aligned || committed) { const m0 = this.salMid(from), m1 = this.salMid(K.to); lo = Math.min(m0, m1) - 0.05; hi = Math.max(m0, m1) + 0.05; }
        if (this.chAt(C.rad) === K.to && Math.abs(C.rad - this.salMid(K.to)) < 0.12) { C.climb = null; C.climbCD = SAL.climbCD; }
      }
    }
    const dr = gr - C.rad, L = Math.hypot(gt, dr) || 1, s = Math.min(d, L);
    const r0 = C.rad, a0 = C.a;
    C.rad = clamp(C.rad + (dr / L) * s, Math.min(lo, r0), Math.max(hi, r0));
    C.a = wrap(C.a + ((gt / L) * s) / ar);
    const moved = Math.hypot(C.rad - r0, wrap(C.a - a0) * ar);
    if (gait) C.odo += moved;
    const T = C.pts, x = C.rad * Math.cos(C.a), y = C.rad * Math.sin(C.a);
    if (T.length < 2 || Math.hypot(T[1].x - x, T[1].y - y) > SAL.trail) T.unshift(this.salPt({}, C.a, C.rad));
    else this.salPt(T[0], C.a, C.rad);
    const m = Math.ceil(this.salBodyLen(C) / SAL.trail) + 2;
    if (T.length > m) T.length = m;
  },
  // climb toward the channel of the leading egg: commit to a gap just ahead in the wall on that side
  salClimbPick(C, hc, ar) {
    const n = this.rings.length;
    let top = -1;
    for (const e of this.aliveEggs()) { const c = this.channelOf(e); if (c < n) top = Math.max(top, c); }
    if (top < 0) return;
    const tc = clamp(top, 1, n - 1);
    if (tc === hc) return;
    const ri = tc > hc ? hc : hc - 1, ring = this.rings[ri], ra = ring.body.getAngle();
    const cand = ring.gaps.map((g, gi) => ({ a: g.a, len: g.len, gi, ok: this.snakeGap(g) && g.len >= 0.6 })).filter((g) => g.ok);
    for (const h of this.salHoles(ring)) if (h.len >= 0.6) cand.push({ a: h.a, len: h.len, gi: -1, ok: true });
    for (const g of cand) {
      const tang = wrap(ra + g.a - C.a) * ar * C.dir;
      if (tang > -0.05 && tang < 0.7) { C.climb = { ri, la: g.a, len: g.len, gi: g.gi, to: tc > hc ? hc + 1 : hc - 1 }; return; }
    }
  },
  // melted holes (lava rocks, venom) in a ring: ways through like gaps ({a, len} in ring space)
  salHoles(ring) {
    const out = [];
    let run = null;
    for (const sg of ring.segs) {
      if (sg.melt > 0) { if (run && Math.abs(run.a1 - sg.a0) < 1e-4) run.a1 = sg.a1; else out.push((run = { a0: sg.a0, a1: sg.a1 })); } else run = null;
    }
    return out.map((h) => ({ a: (h.a0 + h.a1) / 2, len: (h.a1 - h.a0) * ring.r }));
  },
  // slide the head back along its own trail (the tail grows on along the channel), like snakeBack
  salTrailBack(C, d) {
    const T = C.pts;
    while (d > 1e-6 && T.length > 3) {
      const h = T[0], q = T[1], l = Math.hypot(q.x - h.x, q.y - h.y), s = Math.min(d, l);
      d -= s;
      if (l - s > 1e-4) { const f = s / l; this.salPt(h, h.a + wrap(q.a - h.a) * f, h.r + (q.r - h.r) * f); continue; }
      T.shift();
      const z = T[T.length - 1], y = T[T.length - 2], da = wrap(z.a - y.a), n = this.rings.length, c = clamp(this.chAt(z.r), 1, n - 1);
      const dr = clamp(this.salMid(c) - z.r, -SAL.trail * 0.7, SAL.trail * 0.7), r = z.r + dr;
      T.push(this.salPt({}, z.a + Math.sign(da || -C.dir) * Math.sqrt(SAL.trail * SAL.trail - dr * dr) / Math.max(r, 0.3), r));
    }
    C.rad = T[0].r; C.a = T[0].a;
  },
  salBackWalk(C, d) { this.salTrailBack(C, d); C.odo -= d; },
  // a gust's shove (m along the channel, ccw +): a skid, so the feet slide with the body
  salShove(C, dt) {
    const d = clamp(C.shove, -1.5 * dt, 1.5 * dt);
    C.shove = Math.abs(C.shove - d) < 1e-4 ? 0 : C.shove - d;
    if (C.ph === 'dive' || C.ph === 'in') return;
    if (Math.sign(d) === C.dir) this.salMove(C, Math.abs(d), true, false);
    else this.salTrailBack(C, Math.abs(d));
  },

  // ---------- the breath
  salFire(C) {
    const T = this.salTarget(C), ring = this.rings[T.ri], la = T.a - ring.body.getAngle(), half = (SAL.hotLen * C.size) / (2 * ring.r);
    const k = ++this.salBurnN;
    let n = 0;
    ring.segs.forEach((sg, si) => {
      if (!sg.alive || Math.abs(wrap((sg.a0 + sg.a1) / 2 - la)) > half) return;
      if (!(sg.hot > 0)) this.salHot.push({ ri: ring.i, si });
      sg.hot = SAL.hotT; sg.hotK = k; n++;
    });
    let burnt = 0;
    for (const th of ring.thorns) if (th.alive && Math.abs(wrap(th.a - la)) < half + 0.1 / ring.r) { this.removeThorn(th, 'burn'); burnt++; }
    for (const g of ring.gaps) {
      const Cu = g.curtain;
      if (Cu && Cu.alive && !Cu.burning && Math.abs(wrap(g.a - la)) < half + g.len / (2 * ring.r)) { Cu.burning = true; burnt += 4; const q = ring.body.getWorldPoint({ x: ring.r * Math.cos(g.a), y: ring.r * Math.sin(g.a) }); this.emit('curtainBurn', { x: q.x, y: q.y, ring: ring.i }); }
    }
    this.chickGain = (this.chickGain || 0) + burnt; // the planner counts cleared thorns
    this.emit('salFire', { x: T.x, y: T.y, ring: ring.i, id: C.id, n, burnt });
  },
  // eggs on a hot section: one crack per breath (the breath's hotK); water steams it, armour shrugs it off
  salHeat() {
    if (!this.salHot.length) return;
    for (const e of this.aliveEggs()) {
      const p = e.body.getPosition(), d = Math.hypot(p.x, p.y), ang = Math.atan2(p.y, p.x);
      for (const H of this.salHot) {
        const ring = this.rings[H.ri], sg = ring.segs[H.si];
        if (!(sg.hot > 0) || e.hotK === sg.hotK || Math.abs(d - ring.r) > RING_TH / 2 + 0.3) continue;
        const la = mod(ang - ring.body.getAngle(), TAU), pad = 0.12 / ring.r;
        if (!((la > sg.a0 - pad && la < sg.a1 + pad) || (la + TAU > sg.a0 - pad && la + TAU < sg.a1 + pad))) continue;
        e.hotK = sg.hotK;
        if (e.water > 0) { this.salQuench(ring, sg.hotK); this.emit('salSteam', { x: p.x, y: p.y, egg: e }); break; }
        if (this.armored(e) || e.chick) { this.emit('salShrug', { x: p.x, y: p.y, egg: e }); break; }
        if (this.MD.softThorns && e.cracks >= 2) { this.emit('salShrug', { x: p.x, y: p.y, egg: e, easy: 1 }); break; } // Easy: never the breaking crack
        this.emit('salScorch', { x: p.x, y: p.y, egg: e });
        this.crack(e, 0, 'scorch');
        break;
      }
    }
  },
  // a water egg cools the whole section it touched
  salQuench(ring, k) {
    for (const H of this.salHot) { const sg = this.rings[H.ri].segs[H.si]; if (H.ri === ring.i && sg.hotK === k) sg.hot = Math.min(sg.hot, 0.25); }
  },

  // ---------- water
  salWater(C) {
    const h = this.salHead(C);
    let wet = null;
    for (const o of this.orbs) if (o.alive && o.type === 'water' && Math.hypot(o.x - h.x, o.y - h.y) < 0.55 * C.size) { wet = o; break; }
    if (!wet) for (const e of this.aliveEggs()) {
      if (!(e.water > 0)) continue;
      const p = e.body.getPosition();
      if (Math.hypot(p.x - h.x, p.y - h.y) < 0.8 * C.size || C.pts.some((q, i) => i % 4 === 0 && Math.hypot(p.x - q.x, p.y - q.y) < 0.5 * C.size)) { wet = { x: p.x, y: p.y }; break; }
    }
    if (wet) this.salWet(C, wet.x, wet.y);
  },
  salWet(C, x, y) {
    this.salRelease(C);
    C.cool = SAL.cool; C.wetCD = SAL.cool + SAL.wetCD; C.climb = null;
    C.next = Math.max(C.next, 2);
    this.salHalt(C, 'hiss', SAL.hiss);
    this.emit('salCool', { x, y, hx: C.pts[0].x, hy: C.pts[0].y, id: C.id });
  },

  // ---------- hazards: gust | rock | lava | quake | bolt | ice | flash (glow chick) | dash (dash chick) | water
  // o: {x, y, dir ({x, y} or a sign along x), power}. Called from animalsHit (boss.js) and the chick powers.
  hitSalamander(C, kind, o = {}) {
    if (!C || !this.salLive(C) || C.ph === 'dive' || C.ph === 'grin' || C.ph === 'in' || this.state !== 'play') return;
    const p = o.power ?? 1, h = C.pts[0];
    if (kind === 'gust') {
      const dx = typeof o.dir === 'number' ? o.dir : (o.dir && o.dir.x) || 0, dy = (o.dir && o.dir.y) || 0;
      C.shove += clamp(-Math.sin(C.a) * dx + Math.cos(C.a) * dy, -1, 1) * 0.35 * p;
      this.emit('salHit', { kind, x: h.x, y: h.y, id: C.id });
      return;
    }
    if (kind === 'rock' || kind === 'lava') { // immune: the lava recharges it, so its next breath comes sooner
      if (C.lavaCD > 0) return;
      C.lavaCD = 1.5; C.charge = 1;
      if (C.cool > 0) { C.cool = Math.min(C.cool, 0.5); }
      else C.next = Math.max(0.6, Math.min(C.next, C.next - 2.5));
      this.emit('salHit', { kind: 'lava', x: h.x, y: h.y, id: C.id });
      return;
    }
    if (kind === 'quake') { this.emit('salHit', { kind, x: h.x, y: h.y, id: C.id }); return; } // it grips the walls
    if (kind === 'water') { this.salWet(C, o.x ?? h.x, o.y ?? h.y); return; }
    const T = { bolt: 2, flash: 3, dash: 2, ice: 1 }[kind];
    if (!T) return;
    if (C.ph === 'daze' && C.t > T * 0.5) return;
    this.salRelease(C);
    C.climb = null;
    C.next = Math.max(C.next, T + 1);
    if (kind === 'dash') C.shove -= C.dir * 0.35; // bonked back along the channel
    this.salHalt(C, 'daze', T);
    this.emit('salHit', { kind, x: o.x ?? h.x, y: o.y ?? h.y, id: C.id });
  },
  // which salamanders a hazard reaches (any part of the body within r of x, y)
  salsNear(x, y, r) {
    return (this.sals || []).filter((C) => this.salLive(C) && C.pts.some((q, i) => i % 3 === 0 && Math.hypot(q.x - x, q.y - y) < r));
  },

  // ---------- the boss: phase rhythm, staggers
  salBossSync(C) {
    const B = this.bx && this.bx.boss;
    if (!B) return;
    // a breath half a beat after each lava attack: rock, fire, rock, fire
    if (B.atk && B.atk.ph === 'act' && C.bk !== B.k) { C.bk = B.k; if (C.ph === 'walk') C.next = Math.min(Math.max(C.next, 0.8), this.salEvery(C) * 0.5); }
    if (B.atk && C.ph === 'walk' && C.next < 0.8) C.next = 0.8; // never on top of a lava throw
    if (B.phase !== C.bph) { C.bph = B.phase; this.salDaze(C, 1.6); } // a new phase: it reels with the boss
    if (B.saved !== C.bsaved) { C.bsaved = B.saved; if (C.ph === 'warn') { C.next = 1.6; this.salSet(C, 'walk'); this.emit('salFlinch', { x: C.pts[0].x, y: C.pts[0].y }); } }
  },
  salDaze(C, T) {
    if (!this.salLive(C) || C.ph === 'in') return;
    this.salRelease(C); C.climb = null; C.next = Math.max(C.next, T + 1);
    this.salHalt(C, 'daze', T);
  },

  // ---------- snake face-off
  salRivalCheck(C) {
    const hc = this.salCh(C), h = C.pts[0];
    for (const S of this.snakes || []) {
      if (S.gone || !S.inside || S.carried || S.stun > 0 || S.back > 0 || S.knock > 0 || S.rival > 0 || S.flee >= 0 || !S.pts.length) continue;
      if (this.chAt(S.rad) !== this.chAt(C.rad) || hc !== this.chAt(S.rad)) continue;
      const sh = S.pts[0];
      const near = Math.hypot(sh.x - h.x, sh.y - h.y) < SAL.rivalR * C.size ||
        C.pts.some((q, i) => i % 4 === 0 && Math.hypot(q.x - sh.x, q.y - sh.y) < 0.7 * C.size) ||
        S.pts.some((q, i) => i % 4 === 0 && Math.hypot(q.x - h.x, q.y - h.y) < 0.7);
      if (!near) continue;
      if (S.spit) { const b = this.barriers[S.spit.b]; if (b) b.venom = 0; S.spit = null; }
      S.rival = SAL.rival + 0.3; S.rivalD = S.rival; S.rivalId = C.id; S.strike = 0; S.vsK = -1; S.mood = null; S.mouthOpen = 1;
      C.rid = S.id; C.rv = 0; C.climb = null;
      C.next = Math.max(C.next, 2);
      this.salHalt(C, 'rival', SAL.rival);
      this.emit('salRival', { x: (h.x + sh.x) / 2, y: (h.y + sh.y) / 2, id: C.id, snake: S.id });
      return;
    }
  },
  salRivalStep(C, dt) {
    const S = this.snakes.find((s) => s.id === C.rid), el = C.dur - C.t;
    if (!S || S.gone || !(S.rival > 0)) { this.salSet(C, 'walk'); C.rivalCD = SAL.rivalCD * 0.5; return; }
    S.rival = Math.max(S.rival, 0.05);
    const h = C.pts[0], sh = S.pts[0];
    // nose to nose but never touching: back up to a head gap, and only stop with all four feet down
    const q = C.odo / this.salStride(C), f = q - Math.floor(q), planted = f < 0.1 || (f >= 0.5 && f < 0.6);
    if ((el < 1.0 && Math.hypot(sh.x - h.x, sh.y - h.y) < SAL.rivalGap * C.size) || ((C.rv & 4) && !planted)) { C.rv |= 4; this.salBackWalk(C, SAL.backV * C.size * dt); }
    else C.rv &= ~4;
    if (el >= 1.0 && !(C.rv & 1)) { C.rv |= 1; S.mouthOpen = 1; this.emit('venomSpit', { x: sh.x, y: sh.y, tx: h.x, ty: h.y, id: S.id, rival: 1 }); }
    if (el >= 1.5 && !(C.rv & 2)) { C.rv |= 2; this.emit('salPuff', { x: h.x, y: h.y, tx: sh.x, ty: sh.y, id: C.id }); }
    if ((C.t -= dt) <= 0) {
      this.salRelease(C);
      C.rivalCD = SAL.rivalCD; C.back = SAL.rivalBack * C.size;
      this.salSet(C, 'retreat');
      this.emit('salRivalEnd', { x: (h.x + sh.x) / 2, y: (h.y + sh.y) / 2 });
    }
  },
  // let go of a face-off snake: it backs off along its body
  salRelease(C) {
    if (C.rid < 0) return;
    const S = (this.snakes || []).find((s) => s.id === C.rid);
    C.rid = -1;
    if (!S || !(S.rival > 0)) return;
    S.rival = 0; S.back = Math.max(S.back, 3 * this.PM.back); S.mood = null;
  },

  // ---------- planner / danger: how threatening the heat is for this egg (0..1)
  salThreat(e) {
    if (!this.sals || !this.sals.length || e.water > 0 || this.armored(e) || e.chick) return 0;
    const p = e.body.getPosition(), d = Math.hypot(p.x, p.y), ang = Math.atan2(p.y, p.x);
    let v = 0;
    for (const H of this.salHot) {
      const ring = this.rings[H.ri], sg = ring.segs[H.si];
      if (!(sg.hot > 0.3) || e.hotK === sg.hotK || Math.abs(d - ring.r) > RING_TH / 2 + 0.45) continue;
      const la = mod(ang - ring.body.getAngle(), TAU), pad = 0.35 / ring.r;
      if ((la > sg.a0 - pad && la < sg.a1 + pad) || (la + TAU > sg.a0 - pad && la + TAU < sg.a1 + pad)) { v = 1; break; }
    }
    for (const C of this.sals) {
      if (C.ph !== 'warn' && !(C.ph === 'brake' && C.pend === 'warn')) continue;
      const T = this.salTarget(C);
      if (Math.hypot(p.x - T.x, p.y - T.y) < (SAL.hotLen * C.size) / 2 + 0.45) v = Math.max(v, 0.8);
    }
    return v;
  },

  // ---------- state
  salState() {
    return {
      n: this.salBurnN,
      sals: (this.sals || []).map((C) => ({ ...C, pts: C.pts.map((q) => ({ ...q })), climb: C.climb ? { ...C.climb } : null })),
      hot: this.salHot.map((H) => { const sg = this.rings[H.ri].segs[H.si]; return [H.ri, H.si, sg.hot, sg.hotK]; }),
    };
  },
  salLoad(S) {
    if (!S) return;
    this.salBurnN = S.n || 0;
    this.sals = S.sals.map((C) => ({ ...C, pts: C.pts.map((q) => ({ ...q })), climb: C.climb ? { ...C.climb } : null }));
    this.salHot = [];
    for (const [ri, si, hot, hotK] of S.hot || []) { const sg = this.rings[ri].segs[si]; sg.hot = hot; sg.hotK = hotK; this.salHot.push({ ri, si }); }
  },
};
