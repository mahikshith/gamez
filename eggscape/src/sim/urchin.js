// Spike the sea urchin (0.8.17, Coral Reef, level 46): a living thorn that moves. Mixed into Sim (sim.js:
// Object.assign(Sim.prototype, urchinMethods)), so `this` is the Sim. No imports from sim.js. Every urchin is a plain
// object in this.urchins, copied by urState() / restored by urLoad() (called from reef.js reefState / reefLoad), so rewind
// and the planner stay exact. No randomness: only the sim's clock and positions.
//
// level.urchin {ch, a, delay} (or an array): he lives in channel ch (default the middle one), from world angle a (deg),
//   on its floor: the outer face of the ring inside it (ring ch - 1). Underwater the eggs float up against the ring
//   outside; he is heavy and sits on the lower wall, upright at the top of the vault where the eggs go by. His floor ring
//   carries him (turn it and he rides). The gaps of his floor are where eggs come up into his channel.
//   NAP   spines folded, eyes half shut, a bubble: harmless. Eggs float over him, bumping softly (the window to pass).
//   PUFF  the telegraph (URCHIN.puff s, about a second): the bubble pops, he glares, the spines slide out ring by ring
//         and shove aside (never crack) an egg resting against him.
//   ROLL  spines out, he rolls slowly along his floor (URCHIN.roll m/s) and fills the channel: a touch cracks an egg once
//         (then that egg is safe from him for URCHIN.ban s) and shoves it on; he bounces back off it. He turns round at
//         thorns and at the edges of his floor's gaps. Away from home he drops back home through a floor gap.
//   DASH  rolling, he spots an egg that got past him (in the channel outside his, through an open gap of the ring between
//         them) or one in his own channel, within URCHIN.see m: he stops and puffs at it (the telegraph, an aim line),
//         then dashes at it in a straight line (URCHIN.dashV m/s). An egg he hits is cracked once and knocked back toward
//         the middle (one ring back, through a gap that lines up); he rebounds home the way he came and snickers.
//   COUNTERS a wall in his way: turn the ring so the gap he aims through closes (before he goes, or behind him on his
//         way back), or let him miss into the far wall: SPLAT, he drops on his back, feet waving, helpless for
//         URCHIN.flip s (Easy 5, Medium 4, Hard 3.2). A chick that touches him, a stone egg in his dash, a burning or
//         zapped egg flip him too. The Stone Shell takes his hit with no crack (sim.js crack ignores stone eggs).
//   Powers: frost = frozen (he rides his ring), lightning / shock / zap / glow flash / dash chick / rock = flipped,
//         pepper / laser / Scarecrow = scared (spines flat, harmless), spin = flipped, Shatter / Boom Chick = knocked out
//         of the vault for a while, warp gate = swallowed as he dashes and spat out across his channel, decoy = he
//         dashes at the decoy first and pops it.
import { RING_TH, wrap, clamp } from './geom.js';

const m3 = (easy, medium, hard) => ({ easy, medium, hard });
export const URCHIN = {
  // body (m), matched to render/urchin.js drawn at URCHIN.art of its own scale (URCHIN_M, 0.8 m per 100 rig units):
  // spines out he stands 0.8 m tall in a 0.89 m channel (he all but fills it, and never pokes through the far wall);
  // napping he is an egg-sized lump at the floor
  art: 0.86, h: 0.40, hNap: 0.22, hFlip: 0.28, reach: 0.41, body: 0.18, egg: 0.24, fall: 3, // m; m/s he drops to his floor after a splat
  roll: m3(0.28, 0.36, 0.42), rollT: m3(4, 5, 6), nap: m3(5, 4, 3), // m/s along his floor; s rolling; s napping
  puff: m3(1.3, 1.0, 0.85), // s: the telegraph before a roll or a dash
  see: m3(2.2, 2.6, 3.0), dashV: m3(3.0, 3.8, 4.4), back: 2.0, over: 0.35, // m he spots an egg from; m/s; m/s home; m past the aim point
  dashCd: m3(6, 4, 3), // s after a dash before the next
  knock: m3(2.0, 2.6, 3.0), shove: 1.1, soft: 0.7, // m/s: a dash hit, a roll touch, a bump into a napping (or flipped) urchin
  flip: m3(5, 4, 3.2), splat: 0.45, dizzy: 0.7, bump: 0.55, laugh: 1.1, ban: 3, spread: 1.2, // s (spread: an egg his spines shove aside as they come out is safe from them that long)
  cross: 1.4, in: 0.8, // m/s through a gap toward home; s the entrance
  scare: 6, out: 6, // s caps: scared, knocked out of the vault
};
const ARMED = new Set(['roll', 'bump', 'dash', 'back', 'laugh']);
const list = (v) => (!v ? [] : Array.isArray(v) ? v : [v]);
const deg = (d) => (d * Math.PI) / 180;

export const urchinMethods = {
  // ---------- build (reef.js reefInit)
  urInit(L) {
    this.urchins = [];
    const n = this.rings.length;
    if (n < 2) return;
    list(L.urchin).forEach((P, i) => {
      const ch = clamp(P.ch ?? Math.max(1, Math.floor(n / 2)), 1, n - 1);
      const U = { id: i, home: ch, ch, on: ch, la: 0, x: 0, y: 0, dx: 0, dy: 0, sx: 0, sy: 0, ux: 0, uy: 1, face: P.dir === -1 ? -1 : 1,
        ph: 'wait', t: P.delay ?? 2, dur: 1, odo: 0, roll: 0, cd: 2, tgt: 0, aim: 0, dl: 0, hit: 0, ban: {}, fz: 0, stn: 0, zp: 0, k: '', wa: 0, a0: deg(P.a ?? 90), n: 0 };
      this.urLand(U, ch, deg(P.a ?? 90));
      this.urchins.push(U);
    });
  },
  urM(o) { return o[this.mode] ?? o.medium; },
  urFloor(c) { return this.rings[c - 1].r + RING_TH / 2; }, // channel c's floor: the outer face of ring c - 1
  urArmed(U) { return ARMED.has(U.ph) || (U.ph === 'puff' && U.t < U.dur * 0.55); },
  urLive(U) { return U.ph !== 'wait' && U.ph !== 'out' && U.ph !== 'warp'; },
  urSet(U, ph, t = 0) { U.ph = ph; U.t = U.dur = t; },
  // stand on the floor of channel c at world angle a (never over a gap: he is put down on the nearer edge)
  urLand(U, c, a) {
    const ring = this.rings[c - 1], ra = ring.body.getAngle(), rf = this.urFloor(c);
    let la = wrap(a - ra);
    for (const g of ring.gaps) {
      const half = g.len / (2 * ring.r) + 0.3 / rf, d = wrap(la - g.a);
      if (Math.abs(d) < half) la = wrap(g.a + (d >= 0 ? half : -half));
    }
    U.on = c; U.ch = c; U.la = la;
    this.urPos(U);
  },
  urPos(U) {
    if (U.on < 0) return;
    const a = this.rings[U.on - 1].body.getAngle() + U.la, r = this.urFloor(U.on) + (U.ph === 'flip' ? URCHIN.hFlip : this.urArmed(U) || U.ph === 'puff' ? URCHIN.h : URCHIN.hNap);
    U.x = r * Math.cos(a); U.y = r * Math.sin(a); U.ux = Math.cos(a); U.uy = Math.sin(a);
  },
  urAng(U) { return Math.atan2(U.y, U.x); },
  urRad(U) { return Math.hypot(U.x, U.y); },
  urEggR(e) { return e.kind === 'ostrich' ? 0.31 : e.kind === 'quail' ? 0.18 : URCHIN.egg; },
  urFit(e) { return e.alive && !e.saved && e.body && e.body.isActive() && !e.hc && !e.thf && !e.octo && !e.phx; },
  // a world point on ring j at angle a: solid wall there (segments, shut doors, curtains)?
  urSolid(j, a) { const r = this.rings[j].r; return this.solidAt(this.rings[j], r * Math.cos(a), r * Math.sin(a)); },
  // a straight run from (x0, y0) to (x1, y1): the first ring wall it meets (index, distance along) or null
  urWall(x0, y0, x1, y1, pad = 0.14) {
    const L = Math.hypot(x1 - x0, y1 - y0);
    if (L < 1e-6) return null;
    const n = Math.ceil(L / 0.05);
    for (let i = 1; i <= n; i++) {
      const u = i / n, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u, rad = Math.hypot(x, y), a = Math.atan2(y, x);
      for (let j = 0; j < this.rings.length; j++) {
        if (Math.abs(rad - this.rings[j].r) > RING_TH / 2 + 0.16) continue;
        const da = pad / this.rings[j].r;
        if (this.urSolid(j, a) || this.urSolid(j, a + da) || this.urSolid(j, a - da)) return { j, d: L * u };
      }
    }
    return null;
  },

  // ---------- every step (reef.js reefStep)
  urStep(dt, end) { for (const U of this.urchins || []) this.urOne(U, dt, end); },
  urOne(U, dt, end) {
    for (const k in U.ban) if ((U.ban[k] -= dt) <= 0) delete U.ban[k];
    if (U.ph === 'wait') {
      if (end) return;
      if ((U.t -= dt) <= 0) { this.urLand(U, U.home, U.a0); this.urSet(U, 'in', URCHIN.in); this.emit('urIn', { x: U.x, y: U.y, id: U.id }); }
      return;
    }
    if (U.on >= 0) this.urPos(U); // his floor ring carries him
    if (U.ph === 'out') { if (!end && (U.t -= dt) <= 0) { this.urLand(U, U.home, U.a0); this.urSet(U, 'in', URCHIN.in); this.emit('urIn', { x: U.x, y: U.y, id: U.id, back: 1 }); } return; }
    if (end) { if (U.ph !== 'end') { if (U.on < 0) this.urLand(U, this.urChOf(U), this.urAng(U)); this.urSet(U, 'end', 99); } return; }
    if (U.fz > 0) { if ((U.fz -= dt) <= 0) { U.fz = 0; this.emit('reefThaw', { x: U.x, y: U.y }); } return; } // frozen: a still lump on his ring
    if (U.zp > 0) { U.zp -= dt; return; }
    if (U.cd > 0) U.cd -= dt;
    if (U.ph !== 'flip' && U.ph !== 'splat' && U.ph !== 'warp' && U.ph !== 'in' && this.urTouched(U)) return;
    switch (U.ph) {
      case 'in': if ((U.t -= dt) <= 0) this.urSet(U, 'nap', this.urM(URCHIN.nap) * 0.6); break;
      case 'nap': case 'scare':
        this.urSoft(U);
        if ((U.t -= dt) <= 0) this.urPuff(U);
        break;
      case 'puff': {
        if (U.aim) { // a dash puff: he glares at his egg; it may get away (or a wall may come between) before he goes
          const q = this.urTarget(U, U.aim);
          if (!q) { U.aim = 0; U.tgt = 0; }
          else { const ga = Math.atan2(q.y, q.x); U.face = wrap(ga - this.urAng(U)) >= 0 ? 1 : -1; }
        }
        { const th = U.dur * 0.55; if (U.t < th && U.t + dt >= th) this.urSpread(U); } // the spines come out: they shove aside an egg resting on him (no crack)
        this.urTouch(U);
        if ((U.t -= dt) > 0) break;
        if (U.aim && this.urGo(U)) break;
        U.aim = 0; U.tgt = 0;
        U.roll = this.urM(URCHIN.rollT); this.urSet(U, 'roll');
        break;
      }
      case 'roll': this.urRoll(U, dt); break;
      case 'bump': this.urTouch(U); if ((U.t -= dt) <= 0) this.urSet(U, 'roll'); break;
      case 'laugh': this.urTouch(U); if ((U.t -= dt) <= 0) { U.roll = Math.max(U.roll, 1.5); this.urSet(U, 'roll'); } break;
      case 'dash': case 'back': this.urDash(U, dt); break;
      case 'splat': if ((U.t -= dt) <= 0) this.urSet(U, 'flip', this.urM(URCHIN.flip)); break;
      case 'flip': { // on his back: off a wall he first drops to his floor, then lies there (his ring carries him)
        if (U.on < 0) {
          const c = this.urChOf(U), a = this.urAng(U), goal = this.urFloor(c) + URCHIN.hFlip, r = this.urRad(U), nr = r + clamp(goal - r, -URCHIN.fall * dt, URCHIN.fall * dt);
          U.x = nr * Math.cos(a); U.y = nr * Math.sin(a);
          if (Math.abs(goal - nr) < 1e-3) { this.urLand(U, c, a); this.emit('urLand', { x: U.x, y: U.y, id: U.id }); }
        }
        this.urSoft(U);
        if ((U.t -= dt) <= 0) { if (U.on < 0) this.urLand(U, this.urChOf(U), this.urAng(U)); this.urSet(U, 'dizzy', URCHIN.dizzy); this.urPos(U); this.emit('urUp', { x: U.x, y: U.y, id: U.id }); }
        break;
      }
      case 'dizzy': if ((U.t -= dt) <= 0) this.urSet(U, 'nap', 1.6); break; // back on his feet, swaying
      case 'cross': this.urCross(U, dt); break;
      case 'warp':
        if (U.t > U.dur / 2 && U.t - dt <= U.dur / 2) { this.urLand(U, U.ch, U.wa); this.emit('warpOut', { x: U.x, y: U.y, kind: 'u' }); }
        if ((U.t -= dt) <= 0) { this.urSet(U, 'nap', 2.5 * (this.p2M?.up || 1)); }
        break;
    }
  },
  urChOf(U) { return clamp(this.chAt(this.urRad(U)), 1, this.rings.length - 1); },
  urPuff(U) {
    U.aim = 0; U.tgt = 0;
    this.urSet(U, 'puff', this.urM(URCHIN.puff)); this.urPos(U); // he spots from where he will dash from: spines out
    const q = U.cd <= 0 ? this.urSpot(U) : null;
    if (q) { U.aim = q.key; U.tgt = q.key; }
    this.emit('urPuff', { x: U.x, y: U.y, id: U.id, aim: U.aim ? 1 : 0 });
  },

  // ---------- what he dashes at: key = egg id, or -1 for the decoy, in his channel or the one outside it. see: only when
  // the straight run to it is clear of walls (spotting it); once he has puffed at it he goes, wall or no wall
  urTarget(U, key, see = false) {
    const n = this.rings.length;
    let p = null;
    if (key === -1) { const D = this.p2Lure?.(); if (D) p = D.body.getPosition(); }
    else { const e = this.eggs.find((q) => q.id === key); if (e && this.urFit(e)) p = e.body.getPosition(); }
    if (!p) return null;
    const c = clamp(this.chAt(Math.hypot(p.x, p.y)), 0, n), d = Math.hypot(p.x - U.x, p.y - U.y);
    if ((c !== U.ch && c !== U.ch + 1) || c >= n || d > this.urM(URCHIN.see) + (see ? 0 : 0.6)) return null;
    if (see && this.urWall(U.x, U.y, p.x, p.y)) return null;
    return { x: p.x, y: p.y, d };
  },
  urSpot(U) {
    if (!(U.on >= 0)) return null;
    let best = null, bd = this.urM(URCHIN.see);
    const D = this.p2Lure?.();
    if (D) { const q = this.urTarget(U, -1, true); if (q) return { key: -1, ...q }; }
    for (const e of this.aliveEggs()) {
      if (!this.urFit(e) || e.chick || U.ban[e.id] > 0) continue;
      const q = this.urTarget(U, e.id, true);
      if (q && q.d < bd && q.d > 0.5) { bd = q.d; best = { key: e.id, ...q }; }
    }
    return best;
  },
  // the dash starts: a warp gate may take him; else he goes for the point the egg is at now
  urGo(U) {
    const q = this.urTarget(U, U.aim);
    if (!q) return false;
    if (this.warpStrike?.('urchin', U)) return true;
    const d = Math.hypot(q.x - U.x, q.y - U.y) || 1;
    U.dx = (q.x - U.x) / d; U.dy = (q.y - U.y) / d; U.dl = d + URCHIN.over; U.sx = U.x; U.sy = U.y; U.hit = 0;
    U.on = -1; U.cd = this.urM(URCHIN.dashCd); U.n++;
    this.urSet(U, 'dash', 9);
    this.emit('urDash', { x: U.x, y: U.y, dx: U.dx, dy: U.dy, id: U.id, egg: U.aim });
    return true;
  },
  urDash(U, dt) {
    const back = U.ph === 'back', v = back ? URCHIN.back : this.urM(URCHIN.dashV);
    let s = v * dt;
    if (back) { const rem = Math.hypot(U.sx - U.x, U.sy - U.y); if (rem <= s) s = rem; }
    else s = Math.min(s, U.dl);
    const nx = U.x + U.dx * s, ny = U.y + U.dy * s, W = this.urWall(U.x, U.y, nx, ny, back ? 0.06 : 0.1); // (narrower than he aims with: a gap he got through lets him back)
    if (W) return this.urSplat(U, W.j);
    U.x = nx; U.y = ny; U.odo += s;
    if (!back) {
      U.dl -= s;
      if (this.urDashHit(U)) return;
      if (U.dl <= 1e-4) { U.dx = -U.dx; U.dy = -U.dy; this.urSet(U, 'back', 9); } // missed: he brakes and rolls back
      return;
    }
    this.urTouch(U);
    if (Math.hypot(U.sx - U.x, U.sy - U.y) < 1e-3) {
      this.urLand(U, this.urChOf(U), this.urAng(U));
      if (U.hit) { this.urSet(U, 'laugh', URCHIN.laugh); this.emit('urLaugh', { x: U.x, y: U.y, id: U.id }); }
      else this.urSet(U, 'nap', this.urM(URCHIN.nap) * 0.5);
      U.hit = 0;
    }
  },
  // a dash meets an egg, a chick, a stone egg or the decoy
  urDashHit(U) {
    const D = this.p2Lure?.();
    if (D) { const p = D.body.getPosition(); if (Math.hypot(p.x - U.x, p.y - U.y) < URCHIN.reach + 0.3) { this.decoyHit?.('urchin'); this.emit('urDecoy', { x: p.x, y: p.y, id: U.id }); U.dx = -U.dx; U.dy = -U.dy; this.urSet(U, 'back', 9); return true; } }
    for (const e of this.aliveEggs()) {
      if (!this.urFit(e)) continue;
      const p = e.body.getPosition(), d = Math.hypot(p.x - U.x, p.y - U.y);
      if (d > URCHIN.reach + this.urEggR(e)) continue;
      if (e.chick || e.stone > 0) { // a chick bonks him; a stone egg is a wall
        e.body.setLinearVelocity({ x: U.dx * 1.2, y: U.dy * 1.2 });
        this.emit('urBonk', { x: (p.x + U.x) / 2, y: (p.y + U.y) / 2, id: U.id, by: e.chick ? 'chick' : 'stone' });
        return this.urFlip(U, e.chick ? 'chick' : 'stone'), true;
      }
      if (U.ban[e.id] > 0) continue;
      // knocked back toward the middle (one ring back through a gap that lines up): along the dash, tipped inward
      const k = this.urM(URCHIN.knock), rr = Math.hypot(p.x, p.y) || 1, ox = p.x / rr, oy = p.y / rr, al = U.dx * ox + U.dy * oy;
      const kx = U.dx - al * ox - ox, ky = U.dy - al * oy - oy, kl = Math.hypot(kx, ky) || 1;
      U.ban[e.id] = URCHIN.ban;
      e.body.setLinearVelocity({ x: (kx / kl) * k, y: (ky / kl) * k });
      e.safeT = Math.max(e.safeT || 0, 0.3);
      this.emit('urHit', { x: p.x, y: p.y, id: U.id, egg: e, dash: 1 });
      this.urCrack(e);
      U.hit = e.id; U.dx = -U.dx; U.dy = -U.dy;
      this.urSet(U, 'back', 9);
      return true;
    }
    return false;
  },
  // SPLAT: a ring wall in his way. He squashes on it, bounces a hair back and flips
  urSplat(U, j) {
    const bx = U.x - U.dx * 0.06, by = U.y - U.dy * 0.06;
    U.x = bx; U.y = by; U.on = -1;
    this.urSet(U, 'splat', URCHIN.splat);
    U.k = 'wall';
    this.emit('urSplat', { x: U.x + U.dx * URCHIN.reach, y: U.y + U.dy * URCHIN.reach, id: U.id, ring: j });
  },
  urFlip(U, why, T) {
    if (!this.urLive(U) || U.ph === 'flip' || U.ph === 'splat') return false;
    U.k = why; U.aim = 0; U.tgt = 0;
    this.urSet(U, 'flip', T ?? this.urM(URCHIN.flip)); // on his floor he flips where he is; in mid-dash he drops to it first
    this.emit('urFlip', { x: U.x, y: U.y, id: U.id, why });
    return true;
  },

  // ---------- rolling along his floor
  urRoll(U, dt) {
    const c = U.on, f = c - 1, ring = this.rings[f], rf = this.urFloor(c), v = this.urM(URCHIN.roll), s = v * dt;
    if (U.cd <= 0 && this.urTouchless(U)) { const q = this.urSpot(U); if (q) { U.aim = q.key; U.tgt = q.key; this.urSet(U, 'puff', this.urM(URCHIN.puff)); this.emit('urPuff', { x: U.x, y: U.y, id: U.id, aim: 1 }); return; } }
    const a = this.urAng(U), ahead = a + U.face * (0.3 / ring.r);
    // a floor gap ahead: home is through it (away from home), else it is an edge to turn round at
    if (!this.urSolid(f, ahead)) {
      const g = c > U.home && this.urGapWide(f, ahead) ? this.urGapAt(f, ahead) : null;
      if (g) { U.wa = g.a; this.urSet(U, 'cross', 9); this.emit('urCross', { x: U.x, y: U.y, id: U.id }); return; }
      U.face = -U.face;
      return;
    }
    // a thorn on his floor or one hanging from the ring above: a wall, he bounces off it
    for (const [j, side] of [[f, 'out'], [c, 'in']]) {
      const R = this.rings[j];
      if (!R) continue;
      const ra = R.body.getAngle();
      for (const th of R.thorns) {
        if (!th.alive || th.ext < 0.3 || th.side !== side) continue;
        const da = wrap(ra + th.a - a) * rf;
        if (da * U.face > 0 && Math.abs(da) < URCHIN.reach + 0.12) { U.face = -U.face; this.urSet(U, 'bump', URCHIN.bump); this.emit('urBump', { x: U.x, y: U.y, id: U.id, by: 'thorn' }); return; }
      }
    }
    U.la = wrap(U.la + (U.face * s) / rf); U.odo += s;
    this.urPos(U);
    this.urTouch(U);
    if (U.ph === 'roll' && (U.roll -= dt) <= 0) { this.urSet(U, 'nap', this.urM(URCHIN.nap)); this.emit('urNap', { x: U.x, y: U.y, id: U.id }); }
  },
  urGapAt(c, a) { const ring = this.rings[c], la = wrap(a - ring.body.getAngle()); return ring.gaps.find((g) => Math.abs(wrap(la - g.a)) < g.len / (2 * ring.r)) || null; },
  urGapWide(c, a) { const ring = this.rings[c]; return [-0.2, 0, 0.2].every((o) => !this.urSolid(c, a + o / ring.r)); },
  urTouchless(U) { // no egg already against him (the touch handles those)
    for (const e of this.aliveEggs()) if (this.urFit(e)) { const p = e.body.getPosition(); if (Math.hypot(p.x - U.x, p.y - U.y) < URCHIN.reach + this.urEggR(e) + 0.05) return false; }
    return true;
  },
  // through a gap in his floor toward home: along the floor to the middle of the gap (riding its ring), then down through
  // it onto the floor inside. U.wa = the gap's ring-local angle. A door or curtain that shuts on him sends him back up
  urCross(U, dt) {
    const c = U.ch, f = c - 1, ring = this.rings[f], rf = this.urFloor(c);
    if (U.on === c) {
      const d = wrap(U.wa - U.la), s = (this.urM(URCHIN.roll) * 1.6 * dt) / rf;
      U.la = Math.abs(d) <= s ? U.wa : wrap(U.la + Math.sign(d) * s); U.odo += Math.min(Math.abs(d), s) * rf;
      this.urPos(U);
      if (U.la === U.wa) U.on = -1;
      return;
    }
    const a = ring.body.getAngle() + U.wa, r = this.urRad(U), goal = this.urFloor(c - 1) + URCHIN.h;
    if (!this.urGapWide(f, a)) { this.urLand(U, c, a); this.urSet(U, 'bump', URCHIN.bump); this.emit('urBump', { x: U.x, y: U.y, id: U.id, by: 'wall' }); return; }
    const nr = Math.max(goal, r - URCHIN.cross * dt);
    U.x = nr * Math.cos(a); U.y = nr * Math.sin(a); U.ux = Math.cos(a); U.uy = Math.sin(a); U.odo += r - nr;
    if (nr <= goal + 1e-4) { this.urLand(U, c - 1, a); U.roll = Math.max(U.roll, 2); this.urSet(U, 'roll'); }
  },

  // ---------- touching eggs. Armed: a crack (once per egg per URCHIN.ban s) and a shove, and he bounces off the egg.
  // Napping or flipped: a soft bump. A chick, a burning or a zapped egg flips him; a stone egg is a wall (he bounces)
  urTouched(U) {
    for (const e of this.aliveEggs()) {
      if (!this.urFit(e)) continue;
      const p = e.body.getPosition(), d = Math.hypot(p.x - U.x, p.y - U.y);
      if (d > (this.urArmed(U) ? URCHIN.reach : URCHIN.body) + this.urEggR(e) - 0.02) continue;
      if (e.chick) { this.urPush(U, e, URCHIN.soft); this.emit('urBonk', { x: (p.x + U.x) / 2, y: (p.y + U.y) / 2, id: U.id, by: 'chick' }); return this.urFlip(U, 'chick'); }
      if (e.zap) { e.zap = 0; if (this.urFlip(U, 'zap')) { U.zp = 0.3; return true; } }
      if (e.fire > 0) { this.urPush(U, e, URCHIN.soft); return this.urFlip(U, 'fire'); }
    }
    const c = U.on >= 0 ? U.on : this.urChOf(U);
    if (this.rings[c - 1].stun > 0 || (this.urArmed(U) && this.rings[c].stun > 0)) { if (this.urFlip(U, 'zap', 3)) { U.zp = 0.3; return true; } }
    return false;
  },
  urTouch(U) {
    if (!this.urArmed(U)) return this.urSoft(U);
    for (const e of this.aliveEggs()) {
      if (!this.urFit(e)) continue;
      const p = e.body.getPosition(), d = Math.hypot(p.x - U.x, p.y - U.y);
      if (d > URCHIN.reach + this.urEggR(e)) continue;
      if (e.stone > 0 || U.ban[e.id] > 0) { this.urPush(U, e, URCHIN.shove); if (e.stone > 0 && U.ph === 'roll') this.urTurnFrom(U, p, 'stone'); continue; }
      U.ban[e.id] = URCHIN.ban;
      this.urPush(U, e, URCHIN.shove);
      this.emit('urHit', { x: p.x, y: p.y, id: U.id, egg: e });
      this.urCrack(e);
      if (U.ph === 'roll') this.urTurnFrom(U, p, 'egg');
    }
  },
  urCrack(e) { // his spines are a thorn: the golden shell takes one hit for the egg, as it does a thorn's
    if (e.golden) { e.golden = 0; e.safeT = Math.max(e.safeT || 0, 0.6); this.emit('goldenSave', { egg: e }); return; }
    this.crack(e, 0, 'urchin');
  },
  urSpread(U) {
    for (const e of this.aliveEggs()) {
      if (!this.urFit(e)) continue;
      const p = e.body.getPosition();
      if (Math.hypot(p.x - U.x, p.y - U.y) > URCHIN.reach + this.urEggR(e)) continue;
      U.ban[e.id] = Math.max(U.ban[e.id] || 0, URCHIN.spread);
      this.urPush(U, e, URCHIN.shove);
      this.emit('urBump', { x: p.x, y: p.y, id: U.id, by: 'spread' });
    }
  },
  urTurnFrom(U, p, by) {
    const da = wrap(Math.atan2(p.y, p.x) - this.urAng(U));
    if (da * U.face >= 0) { U.face = -U.face; this.urSet(U, 'bump', URCHIN.bump); this.emit('urBump', { x: U.x, y: U.y, id: U.id, by }); }
  },
  urSoft(U) {
    for (const e of this.aliveEggs()) {
      if (!this.urFit(e)) continue;
      const p = e.body.getPosition(), d = Math.hypot(p.x - U.x, p.y - U.y);
      if (d < URCHIN.body + this.urEggR(e) - 0.02) this.urPush(U, e, URCHIN.soft, true);
    }
  },
  // an egg pushed straight away from his middle, at least v m/s (along: along his floor only, to the side the egg is on,
  // so it slides on past a soft lump and is never pressed into the wall above him and held there)
  urPush(U, e, v, along = false) {
    const p = e.body.getPosition(), q = e.body.getLinearVelocity(), d = Math.hypot(p.x - U.x, p.y - U.y) || 1;
    let nx = (p.x - U.x) / d, ny = (p.y - U.y) / d;
    if (along) { const sd = (p.x - U.x) * -U.uy + (p.y - U.y) * U.ux >= 0 ? 1 : -1; nx = -U.uy * sd; ny = U.ux * sd; }
    const now = q.x * nx + q.y * ny;
    if (now < v) e.body.setLinearVelocity({ x: q.x + nx * (v - now), y: q.y + ny * (v - now) });
  },

  // ---------- powers (powers2.js p2All, via urP2), Chick Strike (strike.js stkApply 'urchin'), hazards and chick powers
  // (reef.js reefHit), the live ring (reef.js reefShock), the warp gate (reef.js reefWarp)
  urP2(kind, T) { for (const U of this.urchins || []) this.urP2One(U, kind, T); },
  urP2One(U, kind, T, why) {
    if (!this.urLive(U) || U.ph === 'in') return;
    if (kind === 'ice' || why === 'tock') { // frozen where he is (Tick-Tock: stopped in time)
      if (U.ph === 'dash' || U.ph === 'back' || U.ph === 'cross') { this.urLand(U, this.urChOf(U), this.urAng(U)); this.urSet(U, 'nap', 1); }
      if (U.ph === 'puff') { U.aim = 0; U.tgt = 0; }
      U.fz = Math.max(U.fz, T); this.emit('p2Hit', { kind: 'ice', x: U.x, y: U.y }); return;
    }
    if (kind === 'pepper' || kind === 'scare') { // spines flat, harmless, for a while
      if (U.ph === 'flip' || U.ph === 'splat') return;
      if (U.on < 0) this.urLand(U, this.urChOf(U), this.urAng(U));
      U.aim = 0; U.tgt = 0; this.urSet(U, 'scare', Math.min(T, URCHIN.scare));
      if (!this.scareQuiet) this.emit('urScare', { x: U.x, y: U.y, id: U.id, kind });
      return;
    }
    if (kind === 'out') { U.on = -1; this.urSet(U, 'out', Math.min(T, URCHIN.out)); this.emit('urOut', { x: U.x, y: U.y, id: U.id }); return; }
    if (this.urFlip(U, kind === 'bolt' || kind === 'zap' ? 'zap' : kind, kind === 'bolt' ? Math.min(T, 5) : undefined) && (kind === 'bolt' || kind === 'zap')) U.zp = 0.3;
  },
  urShock(ri, T) {
    for (const U of this.urchins || []) {
      if (!this.urLive(U) || U.ph === 'flip' || U.ph === 'splat') continue;
      const R = this.rings[ri].r, d = Math.abs(this.urRad(U) - R);
      if (d < (this.urArmed(U) ? URCHIN.reach : URCHIN.body) + RING_TH / 2 + 0.05 && this.urFlip(U, 'zap', Math.min(T, 3))) { U.zp = 0.3; this.emit('p2Hit', { kind: 'zap', x: U.x, y: U.y }); }
    }
  },
  urHit(kind, o = {}) {
    const x = o.x ?? 0, y = o.y ?? 0, r = o.r ?? Infinity;
    if (kind === 'gust') return 0;
    let n = 0;
    for (const U of this.urchins || []) {
      if (!this.urLive(U) || U.ph === 'in' || (r < Infinity && Math.hypot(U.x - x, U.y - y) > r + 0.4)) continue;
      if (kind === 'ice') { U.fz = Math.max(U.fz, 3); n++; continue; }
      if (this.urFlip(U, kind === 'bolt' ? 'zap' : kind)) { n++; if (kind === 'bolt') U.zp = 0.3; }
    }
    return n;
  },
  urWarp(W, X) {
    const a = this.urAng(X), far = wrap(a + Math.PI * 0.8 * (a > -Math.PI / 2 ? -1 : 1)), rf = this.urFloor(X.ch) + URCHIN.hNap;
    X.wa = far; X.aim = 0; X.tgt = 0;
    this.urSet(X, 'warp', 1.1);
    this.warpGate('in', X.x, X.y, 0.55, 0, 2.3, { pull: 1 });
    this.warpGate('out', rf * Math.cos(far), rf * Math.sin(far), 0.45, 0.55, 1.1, {});
    this.emit('warpOpen', { x: X.x, y: X.y, r: 0.55, kind: 'u' });
    return true;
  },
  // Chick Strike targets (strike.js stkTargets)
  urTargets(add) { (this.urchins || []).forEach((U, i) => { if (this.urLive(U) && U.ph !== 'in') add('ur' + i, 'urchin', U, { x: U.x, y: U.y }); }); },

  // ---------- the planner: an egg he is about to dash at, or one in his rolling path
  urThreat(e) {
    let v = 0;
    if (!e.body) return 0;
    const p = e.body.getPosition();
    for (const U of this.urchins || []) {
      if (!this.urLive(U) || U.fz > 0) continue;
      if (U.ph === 'puff' && U.aim === e.id) v = Math.max(v, 0.35);
      else if (this.urArmed(U) && Math.hypot(p.x - U.x, p.y - U.y) < 1.0) v = Math.max(v, 0.2);
    }
    return v;
  },

  // ---------- state
  urState() { return (this.urchins || []).map((U) => ({ ...U, ban: { ...U.ban } })); },
  urLoad(S) { if (S) this.urchins = S.map((U) => ({ ...U, ban: { ...U.ban } })); },
};
