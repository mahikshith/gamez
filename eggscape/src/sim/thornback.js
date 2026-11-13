// The thorn-back lizards of level 20 (species 'thornback': the same crawler as the salamander and the frost gecko,
// sim/salamander.js). Mixed into salMethods, so `this` is the Sim. Every field is plain data on the crawler (copied by
// salState / salLoad) and the spikes are boss walls (sim.bx.walls, copied by v31State), so rewind and the planner stay exact.
//
// level.bossFight.thorn {delay, dir}: Duke Quartz, the crystal thorn-back, the golem fight's body (role 'duke'). The four
//   golem attacks (sim/boss.js stomp punch, sim/bossmoves.js cage shards) come from him; a due attack waits while he can't act.
// level.bossFight.spike {delay, dir}: Spike, his sandy cousin (role 'spike'): 85% size, no boss attacks; on Easy he waits
//   for the boss's phase 2 as well.
// Both: crawl in through a gap of the outer ring, hunt the leading egg, never eat or break one.
//   Drop: every THORN.every s, when free, he hunches and flicks a spike off his back onto the floor just behind him: a
//     crystal (Duke) or a thorn (Spike) that stands THORN life s (boss.js SPIKE: the thorn rule; a stone egg or a fast turn
//     of either channel wall breaks it). At most THORN.max[role] stand at once. A standing spike also blocks the lizards.
//   Hip-check: an egg at his snout is shoved ~1 m along the channel away from him (never into a spike or a thorn: then the
//     shove is blocked), then he loses interest for THORN.bored s.
//   Stone: a stone egg rolling into him flips him on his back for THORN.flip s (the Duke: his next attack is cancelled).
//   Duel: the two meet in one channel -> square-up, three beats (thorn, crystal, tail swipes), the loser is thrown ~1 m
//     onto his back for THORN.lost s, the winner gloats and walks on. The loser: whoever was stunned, frozen, flipped or
//     struck in the last THORN.weak s (the more recent), else the Duke wins the first and they alternate.
import { RING_TH, wrap, clamp } from './geom.js';
import { Vec2 } from 'planck';
import { addSpike, removeWall } from './boss.js';

export const THORN = {
  svl: 1.5, spikeK: 0.85, speed: 0.375, // m snout to hips (Duke); Spike's size factor; m/s (75% of the salamander's walk)
  every: 7, dropT: 0.9, dropAt: 0.55, max: { duke: 3, spike: 2 },
  reach: 0.55, hipT: 0.7, hipAt: 0.32, shoveV: 1.7, clear: 1.3, bored: 4,
  flip: 4, flipV: 0.5, flipR: 0.55,
  duelR: 0.62, duelCD: 12, square: 0.5, beats: [0.5, 1.25, 2.0], beatHit: 0.32, duelT: 2.7, throwT: 0.4, throwD: 1.0, lost: 5, gloat: 0.8, weak: 10,
};
const BUSY = ['in', 'daze', 'flip', 'duel', 'thrown', 'hip', 'drop', 'retreat', 'gloat'];
const mod = (a, b) => ((a % b) + b) % b;

export const thornMethods = {
  thornOf(role) { return (this.sals || []).find((C) => C.sp === 'thornback' && C.role === role) || null; },
  duke() { return this.thornOf('duke'); },
  thornSvl(C) { return C.size * 1.8; },

  thornEnter(C) {
    const B = this.bx && this.bx.boss;
    if (C.role === 'spike' && this.mode === 'easy' && B && B.phase < 1) { C.t = 0.5; return; } // Easy: not before phase 2
    const n = this.rings.length, ring = this.rings[n - 1], ra = ring.body.getAngle(), O = this.thornOf(C.role === 'spike' ? 'duke' : 'spike');
    const used = O && O.ent && O.ph !== 'wait' ? O.ent.gi : -1; // the cousins come in through different gaps
    let gi = -1, bd = 1e9;
    ring.gaps.forEach((g, i) => { const d = Math.abs(wrap(ra + g.a - Math.PI / 2)) + (i === used ? 10 : 0); if (this.snakeGap(g) && g.len >= 0.6 && d < bd) { bd = d; gi = i; } });
    if (gi < 0) { C.t = 0.5; return; }
    const a = ra + ring.gaps[gi].a, r0 = ring.r + RING_TH / 2 + 0.2, m = Math.ceil(this.salBodyLen(C) / 0.05) + 2;
    C.ent = { gi, la: ring.gaps[gi].a };
    C.rad = r0; C.a = a; C.pts = [];
    for (let i = 0; i < m; i++) C.pts.push(this.salPt({}, a, r0 + i * 0.05));
    C.ph = 'in'; C.t = C.dur = 0; C.car = -1;
    this.salCarry(C);
    this.emit('thornIn', { x: C.pts[0].x, y: C.pts[0].y, id: C.id, role: C.role });
  },

  thornOne(C, dt, play) {
    const B = this.bx && this.bx.boss, duke = C.role === 'duke';
    for (const k of ['dropT', 'fcd', 'flipCD']) if (C[k] > 0) C[k] = Math.max(0, C[k] - dt);
    if (['daze', 'flip', 'retreat', 'thrown'].includes(C.ph)) C.weakT = this.t; // stunned, frozen, flipped, struck: weak in a duel
    if (play && C.ph !== 'in' && C.ph !== 'flip' && C.ph !== 'thrown' && !(C.flipCD > 0)) this.thornStone(C);
    if (play && duke && C.ph !== 'duel') this.thornDuelCheck(C);
    const spd = THORN.speed;
    switch (C.ph) {
      case 'in': {
        const n = this.rings.length, ring = this.rings[n - 1], g = ring.gaps[C.ent.gi], goal = this.salMid(n - 1);
        if (!play || (g && !this.snakeGap(g))) break;
        const d = Math.min(spd * dt, C.rad - goal);
        C.a = wrap(ring.body.getAngle() + C.ent.la); C.rad -= d; C.odo += d; C.dur += dt;
        this.geckoTrail(C);
        if (C.rad - goal <= 1e-6) { C.dir = this.geckoDir(C); C.climbCD = 0.5; C.dropT = THORN.every * 0.6; this.salSet(C, 'walk'); this.emit('thornInside', { x: C.pts[0].x, y: C.pts[0].y, id: C.id, role: C.role }); }
        break;
      }
      case 'walk': case 'block': {
        if (play && duke && B && B.atk) { this.salHalt(C, 'atk', 0); break; }
        if (play && C.bored <= 0 && !C.climb) {
          const e = this.thornPrey(C);
          if (e) { C.lk = e.id; C.lkd = 0; this.salHalt(C, 'hip', THORN.hipT); break; }
        }
        if (play && C.dropT <= 0 && !C.climb && !this.salCrossing(C) && C.ph === 'walk') { C.lkd = 0; this.salHalt(C, 'drop', THORN.dropT); break; }
        if (this.thornBlocked(C)) { if (C.ph !== 'block') { this.salSet(C, 'block'); this.emit('thornBlocked', { x: C.pts[0].x, y: C.pts[0].y, id: C.id }); } break; }
        if (C.ph === 'block') this.salSet(C, 'walk');
        this.salMove(C, spd * dt);
        break;
      }
      case 'brake': {
        const r = (C.stopAt - C.odo) * C.mv, d = Math.min(Math.max(0, r), 1.1 * dt);
        if (C.mv > 0) this.salMove(C, d, true); else this.salBackWalk(C, d);
        if (r - d <= 1e-6) { C.odo = C.stopAt; this.salSet(C, C.pend, C.pendT); }
        break;
      }
      case 'atk': if (!play || !B || !B.atk) this.salSet(C, 'walk'); break;
      case 'hip':
        if (!C.lkd && C.dur - C.t >= THORN.hipAt) { C.lkd = 1; this.thornShove(C); }
        if ((C.t -= dt) <= 0) { C.bored = THORN.bored; C.climbCD = Math.max(C.climbCD, 1.5); this.salSet(C, 'walk'); }
        break;
      case 'drop':
        if (!C.lkd && C.dur - C.t >= THORN.dropAt) { C.lkd = 1; this.thornDrop(C, this.thornBehind(C)); }
        if ((C.t -= dt) <= 0) { C.dropT = THORN.every; this.salSet(C, 'walk'); }
        break;
      case 'duel': { // the Duke runs the duel for both
        if (duke) { this.thornDuelStep(C, dt); break; }
        const D = this.duke();
        if (!D || D.ph !== 'duel' || !D.duel) this.salSet(C, 'walk');
        break;
      }
      case 'thrown': {
        const d = Math.min(C.back, (THORN.throwD / THORN.throwT) * dt);
        this.thornPushEggs(C);
        this.salBackWalk(C, d);
        if ((C.back -= d) <= 1e-6) { C.back = 0; this.salSet(C, 'flip', THORN.lost); }
        break;
      }
      case 'flip': if ((C.t -= dt) <= 0) { C.flipCD = 1.5; this.salSet(C, 'walk'); } break;
      case 'gloat': if ((C.t -= dt) <= 0) this.salSet(C, 'walk'); break;
      case 'daze': if ((C.t -= dt) <= 0) this.salSet(C, 'walk'); break;
      case 'retreat': {
        const d = Math.min(C.back, 0.6 * dt);
        this.salBackWalk(C, d);
        if ((C.back -= d) <= 1e-6) { C.back = 0; this.salSet(C, 'walk'); }
        break;
      }
      case 'grin': case 'beat': break;
      default: this.salSet(C, 'walk');
    }
  },

  // a point d m behind the snout along his trail
  thornTrail(C, d) {
    const T = C.pts;
    let left = d;
    for (let i = 1; i < T.length; i++) { const p = T[i - 1], q = T[i], l = Math.hypot(q.x - p.x, q.y - p.y); if (l >= left && l > 1e-6) { const f = left / l; return { x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f }; } left -= l; }
    return { x: T[T.length - 1].x, y: T[T.length - 1].y };
  },
  thornBehind(C) { return this.thornTrail(C, 1.5 * this.thornSvl(C) + 0.1); }, // just past the tail tip (the art is 1.5 svl long)
  // shed one spike at world point q onto the floor of its channel (crystal: the Duke, thorn: Spike). force: past the cap (the oldest goes)
  thornDrop(C, q, force) {
    const n = this.rings.length, r = Math.hypot(q.x, q.y), c = clamp(this.chAt(r), 1, n - 1), a = Math.atan2(q.y, q.x);
    const up = Math.sin(a) > 0, ri = up ? c - 1 : c, ring = this.rings[ri], sk = C.role === 'duke' ? 'crystal' : 'thorn';
    const fr = up ? ring.r + RING_TH / 2 + 0.15 : ring.r - RING_TH / 2 - 0.15, fx = fr * Math.cos(a), fy = fr * Math.sin(a);
    const fail = (why) => { this.emit('thornMiss', { x: fx, y: fy, id: C.id, sk, why }); return null; };
    if (!this.solidAt(ring, ring.r * Math.cos(a), ring.r * Math.sin(a))) return fail('gap');
    if (this.aliveEggs().some((e) => { const p = e.body.getPosition(); return Math.hypot(p.x - fx, p.y - fy) < 0.38; })) return fail('egg');
    const mine = this.bx.walls.filter((W) => W.alive && W.kind === 'spike' && W.own === C.id);
    if (mine.length >= THORN.max[C.role]) { if (!force || !mine.length) return fail('max'); removeWall(this, mine[0], 'melt'); }
    return addSpike(this, sk, C.id, ri, a - ring.body.getAngle(), up);
  },
  // walls standing in his channel just ahead of his snout (spikes, golem crystals, cage crystals), or his cousin's body
  // (between duels they stand nose to nose; one on his back is stepped over)
  thornBlocked(C) {
    const h = C.pts[0], hc = this.salCh(C), ar = Math.max(0.5, Math.hypot(h.x, h.y));
    const O = this.thornOf(C.role === 'duke' ? 'spike' : 'duke');
    if (O && this.salLive(O) && O.ph !== 'flip' && O.ph !== 'thrown' && this.salCh(O) === hc) {
      const m = Math.min(O.pts.length, Math.ceil((1.5 * this.thornSvl(O)) / 0.05)), ha = Math.atan2(h.y, h.x);
      for (let i = 0; i < m; i += 3) { const q = O.pts[i], ahead = wrap(Math.atan2(q.y, q.x) - ha) * C.dir * ar; if (ahead > 0 && ahead < THORN.duelR && Math.hypot(q.x - h.x, q.y - h.y) < THORN.duelR + 0.1) return true; }
    }
    for (const W of this.bx.walls) {
      if (!W.alive || (W.ri !== hc && W.ri !== hc - 1)) continue;
      if (W.kind === 'spike' ? (W.out ? W.ri !== hc - 1 : W.ri !== hc) : W.ri !== hc) continue;
      const a = this.rings[W.ri].body.getAngle() + W.la, ahead = wrap(a - Math.atan2(h.y, h.x)) * C.dir * ar;
      if (ahead > -0.05 && ahead < 0.38) return true;
    }
    return false;
  },
  thornPrey(C) {
    const h = C.pts[0], hc = this.salCh(C);
    for (const e of this.aliveEggs()) {
      if (e.icy > 0 || e.hold || e.honey > 0 || e.thf || e.hc || e.octo || e.stone > 0 || this.channelOf(e) !== hc) continue;
      const p = e.body.getPosition();
      if (Math.hypot(p.x - h.x, p.y - h.y) < THORN.reach) return e;
    }
    return null;
  },
  // the hip-check: the egg gets ~1 m of roll along the channel, away from him, unless a spike or thorn waits that way
  thornShove(C) {
    const e = this.eggs.find((x) => x.id === C.lk && x.alive && !x.saved), h = C.pts[0];
    if (!e) return;
    const p = e.body.getPosition(), r = Math.hypot(p.x, p.y) || 1, ea = Math.atan2(p.y, p.x);
    if (Math.hypot(p.x - h.x, p.y - h.y) > THORN.reach + 0.35) { this.emit('thornMissHip', { x: h.x, y: h.y, id: C.id }); return; }
    const s = Math.sign(wrap(ea - Math.atan2(h.y, h.x))) || C.dir;
    if (this.thornSharpAhead(this.channelOf(e), ea, s, THORN.clear / r)) { this.emit('thornHip', { x: p.x, y: p.y, egg: e, id: C.id, blocked: 1 }); return; }
    const tx = -Math.sin(ea) * s, ty = Math.cos(ea) * s, v = e.body.getLinearVelocity(), vt = v.x * tx + v.y * ty, want = THORN.shoveV * this.vs;
    if (vt < want) e.body.setLinearVelocity(Vec2(v.x + tx * (want - vt), v.y + ty * (want - vt)));
    e.body.setAwake(true);
    this.emit('thornHip', { x: p.x, y: p.y, egg: e, id: C.id, dir: s, hx: h.x, hy: h.y });
  },
  // a spike, a wall or a ring thorn on either wall of channel c within da (rad) of world angle a, the way s
  thornSharpAhead(c, a, s, da) {
    const n = this.rings.length, rs = [c - 1, c].filter((i) => i >= 0 && i < n);
    for (const ri of rs) {
      const ring = this.rings[ri], ra = ring.body.getAngle();
      for (const th of ring.thorns) if (th.alive) { const d = wrap(ra + th.a - a) * s; if (d > -0.02 && d < da) return true; }
    }
    for (const W of this.bx.walls) {
      if (!W.alive || !rs.includes(W.ri)) continue;
      const d = wrap(this.rings[W.ri].body.getAngle() + W.la - a) * s;
      if (d > -0.02 && d < da) return true;
    }
    return false;
  },
  // a stone egg rolling into him flips him on his back
  thornStone(C) {
    if (C.ph === 'wait' || C.ph === 'gone' || C.ph === 'grin' || C.ph === 'beat' || C.ph === 'duel') return;
    const m = Math.min(C.pts.length, Math.ceil((1.5 * this.thornSvl(C)) / 0.05));
    for (const e of this.aliveEggs()) {
      if (!(e.stone > 0)) continue;
      const v = e.body.getLinearVelocity();
      if (Math.hypot(v.x, v.y) < THORN.flipV) continue;
      const p = e.body.getPosition();
      let hit = false;
      for (let i = 0; i < m && !hit; i += 3) hit = Math.hypot(C.pts[i].x - p.x, C.pts[i].y - p.y) < THORN.flipR * Math.sqrt(C.size / 0.83);
      if (!hit) continue;
      this.thornFlip(C, THORN.flip, 'stone', p);
      return;
    }
  },
  thornFlip(C, T, why, p) {
    this.salRelease(C); C.climb = null; C.lk = -1;
    this.salSet(C, 'flip', T); C.weakT = this.t; C.fk = why;
    if (C.role === 'duke') this.thornBossHit();
    this.emit('thornFlip', { x: (p || C.pts[0]).x, y: (p || C.pts[0]).y, id: C.id, role: C.role, why });
  },
  // the Duke is knocked down: the attack he is winding up is cancelled, else his next one is skipped
  thornBossHit() {
    const B = this.bx && this.bx.boss;
    if (!B) return;
    if (B.atk && B.atk.ph === 'warn') { B.atk = null; B.t = Math.max(B.t, 1.2); } else if (!B.atk) B.k++;
    B.flinch = 0.9;
  },
  // while he is thrown (and while the two duel) eggs that touch the body are bumped away gently (never hard enough to crack)
  thornPushEggs(C) {
    const m = C.pts.length;
    for (const e of this.aliveEggs()) {
      if (e.hold || e.honey > 0) continue;
      const p = e.body.getPosition();
      let bq = null, bd = 0.45;
      for (let i = 0; i < m; i += 3) { const d = Math.hypot(C.pts[i].x - p.x, C.pts[i].y - p.y); if (d < bd) { bd = d; bq = C.pts[i]; } }
      if (!bq) continue;
      const nx = (p.x - bq.x) / (bd || 1), ny = (p.y - bq.y) / (bd || 1), v = e.body.getLinearVelocity(), vn = v.x * nx + v.y * ny, want = 0.45 * this.vs;
      if (vn < want) { e.body.setLinearVelocity(Vec2(v.x + nx * (want - vn), v.y + ny * (want - vn))); e.body.setAwake(true); }
    }
  },

  // ---------- the duel (the Duke runs it; Spike's own step leaves him be)
  thornFree(C) { return this.salLive(C) && (C.ph === 'walk' || C.ph === 'block') && !C.climb; },
  thornDuelCheck(D) {
    const S = this.thornOf('spike'), B = this.bx && this.bx.boss;
    if (!S || D.fcd > 0 || !this.thornFree(D) || !this.thornFree(S) || (B && B.atk) || this.salCh(D) !== this.salCh(S)) return;
    const near = (P, Q) => { const h = P.pts[0], m = Math.min(Q.pts.length, Math.ceil((1.5 * this.thornSvl(Q)) / 0.05)); for (let i = 0; i < m; i += 2) if (Math.hypot(Q.pts[i].x - h.x, Q.pts[i].y - h.y) < THORN.duelR) return true; return false; };
    if (!near(D, S) && !near(S, D)) return;
    const recent = (C) => (C.weakT != null && this.t - C.weakT < THORN.weak ? C.weakT : -1e9);
    const wd = recent(D), ws = recent(S);
    const lose = wd > ws ? D : ws > wd ? S : (D.duels || 0) % 2 === 0 ? S : D;
    D.duels = (D.duels || 0) + 1;
    const hx = (D.pts[0].x + S.pts[0].x) / 2, hy = (D.pts[0].y + S.pts[0].y) / 2;
    D.duel = { t: 0, lose: lose.id, sid: S.id, hx, hy, k: 0 };
    for (const C of [D, S]) { this.salRelease(C); C.climb = null; this.salSet(C, 'duel', THORN.duelT); C.fcd = THORN.duelCD; }
    this.emit('thornDuel', { x: hx, y: hy, lose: lose.role });
  },
  thornDuelStep(D, dt) {
    const S = (this.sals || []).find((c) => c.id === (D.duel && D.duel.sid));
    const Q = D.duel;
    if (!Q || !S || S.ph !== 'duel') { D.duel = null; this.salSet(D, 'walk'); if (S && S.ph === 'duel') this.salSet(S, 'walk'); return; }
    const t0 = Q.t;
    Q.t += dt;
    S.t = D.t = THORN.duelT - Q.t;
    this.thornPushEggs(D); this.thornPushEggs(S);
    const at = (x) => t0 < x && Q.t >= x;
    const [b1, b2, b3] = THORN.beats, hit = THORN.beatHit;
    const mid = (f) => { const a = Math.atan2(Q.hy, Q.hx), r = Math.hypot(Q.hx, Q.hy); return { x: r * Math.cos(a + f / r), y: r * Math.sin(a + f / r) }; };
    if (at(b1)) this.emit('thornBeat', { k: 1, x: S.pts[0].x, y: S.pts[0].y, by: 'spike' });
    if (at(b1 + hit)) { const side = Math.sign(wrap(Math.atan2(D.pts[0].y, D.pts[0].x) - Math.atan2(S.pts[0].y, S.pts[0].x))) || 1; this.thornDrop(S, mid(side * 2.7), true); } // the Duke bats Spike's thorn away past himself
    if (at(b2)) this.emit('thornBeat', { k: 2, x: D.pts[0].x, y: D.pts[0].y, by: 'duke' });
    if (at(b2 + hit)) { const side = Math.sign(wrap(Math.atan2(S.pts[0].y, S.pts[0].x) - Math.atan2(D.pts[0].y, D.pts[0].x))) || 1; this.thornDrop(D, mid(side * 2.7), true); } // Spike ducks: the crystal lands past him
    if (at(b3)) this.emit('thornBeat', { k: 3, x: Q.hx, y: Q.hy, by: 'both' });
    if (at(b3 + hit)) this.emit('thornSwipe', { x: Q.hx, y: Q.hy, lose: Q.lose === D.id ? 'duke' : 'spike' });
    if (Q.t >= THORN.duelT) {
      const L = Q.lose === D.id ? D : S, W = L === D ? S : D;
      D.duel = null;
      L.back = THORN.throwD; L.weakT = this.t; L.fk = 'duel';
      this.salSet(L, 'thrown', THORN.throwT);
      if (L === D) this.thornBossHit();
      this.salSet(W, 'gloat', THORN.gloat);
      W.bored = Math.min(W.bored, 0.5);
      this.emit('thornThrown', { x: L.pts[0].x, y: L.pts[0].y, lose: L.role, win: W.role });
    }
  },

  // the boss clock waits while the Duke can't act: not in yet, dazed, frozen, flipped, duelling, busy (sim/boss.js)
  thornHold() {
    const C = this.duke();
    if (!C) return false;
    if (!this.salLive(C)) return true;
    return BUSY.includes(C.ph) || (C.ph === 'brake' && C.pend !== 'atk');
  },
  // the boss's point (popups, the stomp's shock) is his shoulders
  thornBossPose(B) {
    const C = this.duke();
    if (!C || !this.salLive(C)) return;
    const q = this.thornTrail(C, 0.35 * this.thornSvl(C));
    B.x = q.x; B.y = q.y; B.face = C.dir;
  },
};
void mod;
