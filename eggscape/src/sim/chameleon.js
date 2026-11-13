// Level 26: Sly the chameleon, an orb thief (species 'chameleon': the same crawler as the salamander, the frost gecko and
// the thorn-backs, sim/salamander.js). Mixed into salMethods, so `this` is the Sim. Every field is plain data on the
// crawler and is only ever REPLACED, never mutated in place (salState / salLoad copy the crawler shallowly), so rewind and
// the planner stay exact. Not a boss: no boss bar, no phases.
//
// level.chameleon {delay, dir}: he crawls in through a gap of the outer ring (nearest the top) and hunts ORBS, never eggs.
//   Target: the nearest uncollected orb (a good one within CHAM.prefer m wins over a nearer harmful one). He climbs
//   through gaps toward its channel like the other crawlers. Within CHAM.reach m, in front of him and with a clear line
//   (along the channel or through a gap), he stops: 'lock' (eyes converge, throat bulges), 'shoot' (the tongue flies),
//   'reel' (the orb rides the tongue back), gulp: the orb is gone. Then 'digest' (he sits; the art fades him into camo).
//   An egg that takes the orb first: 'miss' (the tongue snaps on nothing, he blinks, annoyed).
//   A harmful orb (fire_black, curse, thorn): sick for CHAM.sick s (staggering, no tongue, no camo), and he coughs back
//   the LAST good orb he ate: it arcs out (C.cough) and lands in his channel as a normal orb.
//   No orbs left: 'nap' where he is.
// Counters: everything hitSalamander / strikes / powers do to a crawler (daze, freeze, flee, spin, out). A Stone egg
// rolling into him bumps him CHAM.bumpD m along the channel and he staggers CHAM.bump s.
// Eggs: he never grabs, shoves or harms one (like the other crawlers he has no physics body).
import { RING_TH, wrap, clamp } from './geom.js';

export const CHAM = {
  svl: 1.4, speed: 0.55, // m snout to hips; m/s (70% of the salamander's 0.5 walk)
  reach: 2.0, prefer: 3, lock: 0.6, shoot: 0.25, reel: 0.35, digest: 5, miss: 1, // s
  sick: 6, retch: 0.8, fly: 0.5, sickV: 0.5, // sick: s; the cough (s into the sickness); the orb's arc (s); walk speed x
  bumpD: 0.5, bump: 1, bumpV: 0.5, bumpR: 0.5, bumpCD: 2,
};
export const BAD_ORBS = new Set(['fire_black', 'curse', 'thorn']);
const TRAIL = 0.05;

export const chamMethods = {
  chamOf() { return (this.sals || []).find((C) => C.sp === 'chameleon') || null; },
  // the mouth: a little ahead of the head point, along the heading
  chamMouth(C) {
    const h = C.pts[0], q = C.pts[Math.min(C.pts.length - 1, 4)], dx = h.x - q.x, dy = h.y - q.y, l = Math.hypot(dx, dy) || 1;
    return { x: h.x + (dx / l) * 0.12, y: h.y + (dy / l) * 0.12, hx: dx / l, hy: dy / l };
  },

  chamEnter(C) {
    const n = this.rings.length, ring = this.rings[n - 1], ra = ring.body.getAngle();
    let gi = -1, bd = 1e9;
    ring.gaps.forEach((g, i) => { const d = Math.abs(wrap(ra + g.a - Math.PI / 2)); if (this.snakeGap(g) && g.len >= 0.6 && d < bd) { bd = d; gi = i; } });
    if (gi < 0) { C.t = 0.5; return; } // every way in is shut: he waits outside
    const a = ra + ring.gaps[gi].a, r0 = ring.r + RING_TH / 2 + 0.2, m = Math.ceil(this.salBodyLen(C) / TRAIL) + 2;
    C.ent = { gi, la: ring.gaps[gi].a };
    C.rad = r0; C.a = a; C.pts = [];
    for (let i = 0; i < m; i++) C.pts.push(this.salPt({}, a, r0 + i * TRAIL));
    C.ph = 'in'; C.t = C.dur = 0; C.car = -1;
    this.salCarry(C);
    this.emit('chamIn', { x: C.pts[0].x, y: C.pts[0].y, id: C.id });
  },

  chamOne(C, dt, play) {
    for (const k of ['sickT', 'bumpCD']) if (C[k] > 0) C[k] = Math.max(0, C[k] - dt);
    if (C.cough) this.chamCoughStep(C, dt, play);
    if (C.held && C.ph !== 'reel') this.chamDrop(C); // knocked out of a reel: the orb falls free
    if (C.shove) this.salShove(C, dt);
    if (play && C.ph !== 'in' && C.ph !== 'grin' && C.ph !== 'beat' && !(C.bumpCD > 0)) this.chamStone(C);
    switch (C.ph) {
      case 'in': { // down through the gap on its centre line (the ring carries him; a shut gap stops him)
        const n = this.rings.length, ring = this.rings[n - 1], g = ring.gaps[C.ent.gi], goal = this.salMid(n - 1);
        if (!play || (g && !this.snakeGap(g))) break;
        const d = Math.min(CHAM.speed * dt, C.rad - goal);
        C.a = wrap(ring.body.getAngle() + C.ent.la); C.rad -= d; C.odo += d; C.dur += dt;
        this.geckoTrail(C);
        if (C.rad - goal <= 1e-6) {
          this.chamPick(C); C.dir = this.chamDir(C); C.climbCD = 0.5; this.salSet(C, 'walk');
          this.emit('chamInside', { x: C.pts[0].x, y: C.pts[0].y, id: C.id });
        }
        break;
      }
      case 'walk': case 'nap': {
        if (!play) break;
        if (C.sickT > 0) { this.salSet(C, 'sick'); break; }
        const o = this.chamPick(C);
        if (!o) { if (C.ph !== 'nap') this.salHalt(C, 'nap', 0); break; }
        if (C.ph === 'nap') { C.dir = this.chamDir(C); this.salSet(C, 'walk'); }
        if (!C.climb && this.chamSight(C, o)) { C.tg = { type: o.type, x: o.x, y: o.y }; this.salHalt(C, 'lock', CHAM.lock); break; }
        this.salMove(C, CHAM.speed * dt);
        break;
      }
      case 'brake': {
        const r = (C.stopAt - C.odo) * C.mv, d = Math.min(Math.max(0, r), 1.1 * dt);
        if (C.mv > 0) this.salMove(C, d, true); else this.salBackWalk(C, d);
        if (r - d <= 1e-6) { C.odo = C.stopAt; this.salSet(C, C.pend, C.pendT); }
        break;
      }
      case 'lock': { // eyes converge, throat bulges: the telegraph
        const o = this.chamTrack(C);
        if (!o) { this.chamMiss(C); break; }
        if ((C.t -= dt) <= 0) this.salSet(C, 'shoot', CHAM.shoot);
        break;
      }
      case 'shoot': { // the tongue is on its way
        const o = this.chamTrack(C);
        if (!o) { this.chamMiss(C); break; }
        if ((C.t -= dt) <= 0) {
          const M = this.chamMouth(C);
          if (Math.hypot(o.x - M.x, o.y - M.y) > CHAM.reach + 0.6) { this.chamMiss(C); break; }
          o.alive = false; o.taken = true; this.kill.push(o.body);
          C.held = { type: o.type, src: o.src };
          C.tg = { type: o.type, x: o.x, y: o.y };
          this.salSet(C, 'reel', CHAM.reel);
          this.emit('chamSnatch', { x: o.x, y: o.y, power: o.type, id: C.id, hx: M.x, hy: M.y });
        }
        break;
      }
      case 'reel': if ((C.t -= dt) <= 0) this.chamGulp(C); break;
      case 'digest': case 'miss': case 'stagger': case 'daze':
        if ((C.t -= dt) <= 0) this.salSet(C, 'walk');
        break;
      case 'sick': { // staggering about, harmless; he stands still while he retches
        if (!play) break;
        if (C.sickT <= 0) { this.salSet(C, 'walk'); this.emit('chamWell', { x: C.pts[0].x, y: C.pts[0].y, id: C.id }); break; }
        if (!(C.cough && C.cough.t > CHAM.fly)) this.salMove(C, CHAM.speed * CHAM.sickV * dt, true);
        break;
      }
      case 'retreat': { // scared off (pepper, a shock): he backs away along his own trail
        const d = Math.min(C.back, 0.6 * dt);
        this.salBackWalk(C, d);
        if ((C.back -= d) <= 1e-6) { C.back = 0; this.salSet(C, 'walk'); }
        break;
      }
      case 'grin': case 'beat': break;
      default: this.salSet(C, 'walk');
    }
  },

  // ---------- targets
  // what he goes for: a good orb within CHAM.prefer m, else the nearest orb (sets C.goal, the channel to climb to)
  chamPick(C) {
    const h = C.pts[0], n = this.rings.length;
    let good = null, gd = CHAM.prefer, any = null, ad = 1e9;
    for (const o of this.orbs) {
      if (!o.alive || o.taken) continue;
      const d = Math.hypot(o.x - h.x, o.y - h.y);
      if (!BAD_ORBS.has(o.type) && d < gd) { gd = d; good = o; }
      if (d < ad) { ad = d; any = o; }
    }
    const o = good || any;
    C.goal = o ? clamp(o.ch, 1, n - 1) : -1;
    C.ga = o ? Math.atan2(o.y, o.x) : 0;
    return o;
  },
  // the orb he locked on to, followed as it sways (orbs are re-created on a rewind: matched by type and place)
  chamTrack(C) {
    const T = C.tg;
    if (!T) return null;
    let best = null, bd = 0.5;
    for (const o of this.orbs) {
      if (!o.alive || o.taken || o.type !== T.type) continue;
      const d = Math.hypot(o.x - T.x, o.y - T.y);
      if (d < bd) { bd = d; best = o; }
    }
    if (best) C.tg = { type: best.type, x: best.x, y: best.y };
    return best;
  },
  // in reach, in front of him, and no solid ring between his mouth and the orb
  chamSight(C, o) {
    if (this.salCrossing(C)) return false;
    const M = this.chamMouth(C), dx = o.x - M.x, dy = o.y - M.y, d = Math.hypot(dx, dy);
    if (d > CHAM.reach || (dx * M.hx + dy * M.hy) / (d || 1) < 0.2) return false;
    for (const ring of this.rings) {
      // segment M + s (dx, dy), s in [0, 1], against the circle of radius ring.r
      const A = dx * dx + dy * dy, B = 2 * (M.x * dx + M.y * dy), Cc = M.x * M.x + M.y * M.y - ring.r * ring.r, D = B * B - 4 * A * Cc;
      if (D < 0 || A < 1e-9) continue;
      for (const sg of [-1, 1]) {
        const s = (-B + sg * Math.sqrt(D)) / (2 * A);
        if (s < 0 || s > 1) continue;
        if (this.solidAt(ring, M.x + dx * s, M.y + dy * s)) return false;
      }
    }
    return true;
  },
  // which way round his channel: toward the orb he wants
  chamDir(C) {
    if (C.goal < 0) return C.dir;
    const h = C.pts[0], d = wrap(C.ga - Math.atan2(h.y, h.x));
    return Math.abs(d) < 1e-3 ? C.dir : d > 0 ? 1 : -1;
  },

  // ---------- the snatch
  chamMiss(C) {
    C.held = null;
    this.salSet(C, 'miss', CHAM.miss);
    const h = C.pts[0];
    this.emit('chamMiss', { x: C.tg ? C.tg.x : h.x, y: C.tg ? C.tg.y : h.y, id: C.id });
  },
  chamGulp(C) {
    const H = C.held, h = C.pts[0];
    C.held = null;
    if (!H) { this.salSet(C, 'walk'); return; }
    C.ate = [...(C.ate || []), H.type];
    const bad = BAD_ORBS.has(H.type);
    this.emit('chamGulp', { x: h.x, y: h.y, power: H.type, bad: bad ? 1 : 0, id: C.id });
    if (!bad) { C.goods = [...(C.goods || []), H]; this.salSet(C, 'digest', CHAM.digest); return; }
    // the bait: sick, and the last good orb comes back up
    C.sickT = CHAM.sick;
    const G = C.goods || [];
    if (G.length) { C.cough = { type: G[G.length - 1].type, src: G[G.length - 1].src, t: CHAM.retch + CHAM.fly }; C.goods = G.slice(0, -1); }
    this.salSet(C, 'sick');
    this.emit('chamSick', { x: h.x, y: h.y, id: C.id, cough: C.cough ? C.cough.type : null });
  },
  // the coughed orb: retch, then it arcs out of his mouth and lands CHAM ~0.9 m ahead in his channel
  chamCoughStep(C, dt, play) {
    const K = C.cough, t = K.t - dt;
    if (K.t > CHAM.fly && t <= CHAM.fly) { // it leaves his mouth: where it will land is fixed now
      const M = this.chamMouth(C), n = this.rings.length, c = this.salCh(C), r = this.salMid(c), ma = Math.atan2(M.y, M.x), la = ma + C.dir * 0.9 / Math.max(r, 0.5);
      C.cough = { ...K, t, x0: M.x, y0: M.y, ch: clamp(c, 1, n - 1), la, r };
      this.emit('chamCough', { x: M.x, y: M.y, x2: r * Math.cos(la), y2: r * Math.sin(la), power: K.type, id: C.id });
      return;
    }
    if (t > 0) { C.cough = { ...K, t }; return; }
    C.cough = null;
    if (!play) return;
    const o = this.addOrb(K.type, K.ch, K.la, K.src || 'start', K.r);
    this.emit('chamCoughed', { x: o.x, y: o.y, power: K.type, id: C.id });
  },
  // knocked out of a reel: the orb drops free where the tongue let go
  chamDrop(C) {
    const H = C.held, T = C.tg;
    C.held = null;
    if (!H || !T || this.state !== 'play') return;
    const n = this.rings.length, r = Math.hypot(T.x, T.y), ch = clamp(this.chAt(r), 0, n - 1);
    this.addOrb(H.type, ch, Math.atan2(T.y, T.x), H.src || 'start', Math.min(r, this.orbFloor(ch)));
    this.emit('chamDrop', { x: T.x, y: T.y, power: H.type, id: C.id });
  },

  // ---------- a Stone egg rolling into him: bumped along the channel, staggering
  chamStone(C) {
    if (!this.salLive(C)) return;
    const m = Math.min(C.pts.length, Math.ceil((1.5 * CHAM.svl) / TRAIL));
    for (const e of this.aliveEggs()) {
      if (!(e.stone > 0)) continue;
      const v = e.body.getLinearVelocity();
      if (Math.hypot(v.x, v.y) < CHAM.bumpV) continue;
      const p = e.body.getPosition();
      let q = null;
      for (let i = 0; i < m && !q; i += 3) if (Math.hypot(C.pts[i].x - p.x, C.pts[i].y - p.y) < CHAM.bumpR) q = C.pts[i];
      if (!q) continue;
      const s = Math.sign(wrap(Math.atan2(q.y, q.x) - Math.atan2(p.y, p.x))) || C.dir;
      C.shove = s * CHAM.bumpD; C.bumpCD = CHAM.bumpCD; C.climb = null;
      if (C.ph !== 'daze' && C.ph !== 'sick') this.salSet(C, 'stagger', CHAM.bump);
      this.emit('chamBump', { x: p.x, y: p.y, id: C.id, dir: s });
      return;
    }
  },
};
