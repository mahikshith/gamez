// Chick kinds (v3.2 K5/K6). Mixed into Sim (sim.js: Object.assign(Sim.prototype, chickMethods)), so `this` is
// the Sim. No imports from sim.js (it imports this file); everything here is plain data on eggs, rings and
// predators, saved through EGG_KEYS (CHICK_KEYS) and chickState(), so rewind and the planner stay exact.
//
// How an egg becomes a chick kind: a hatch orb (hatch_glow, hatch_dash, ...) tints the egg; it hatches
// HATCH_DELAY later. A level can pre-tint eggs (level.chickEggs: ['dash', null, ...]); those hatch on any
// hatch orb or the gold flame. The gold flame alone still hatches the classic pecker chick at once.
//
// One tap = one power (sim.tapChick(id)). Every chick still never cracks, counts as a saved egg and is bait.
//   glow  : FLASH (GLOW_R): burns thorns in range, stuns snakes and the salamander, dazes the eagle. Blows nearby eggs outward.
//   dash  : shoots along its channel the way it faces for DASH_T: knocks snakes (and the salamander) dizzy, takes orbs it passes,
//           pecks grey spikes away. It can shoot right over a gap.
//   swoop : flies up through the ring above (clearing a thorn curtain and thorns it passes), then glides
//           and plucks the thorns on the ring it lands on. Going up costs progress.
//   bulk  : puffs up for BULK_T: heavy, too long to fit a gap, snakes bounce off it (it plugs the channel),
//           it smashes thorns and cracked glass it touches.
//   pick  : drills the ring under (or beside) it: hard ice shatters into a hole for ICE_GAP_T; on a normal
//           ring it only chips thorns.
import { Vec2, Polygon, Circle } from 'planck';
import { RING_TH, TAU, wrap, clamp } from './geom.js';

export const CHICK_KINDS = ['glow', 'dash', 'swoop', 'bulk', 'pick'];
const TAP = new Set(CHICK_KINDS); // the classic 'peck' chick has no tap power
// egg fields: tint (kind before hatching), hatchT (hatch countdown), chickKind, powU (1 = power used / none),
// powK (active phase, 0 = none), powT (phase time left), powA (ring index / dash direction), face (-1 | 1),
// bulk (puffed time left), powX/powY (where the power went off, for the art)
export const CHICK_KEYS = ['tint', 'hatchT', 'chickKind', 'powU', 'powK', 'powT', 'powA', 'face', 'bulk', 'powX', 'powY'];

export const HATCH_DELAY = 0.6;
export const GLOW_R = 1.6;
export const DASH_T = 1.2, DASH_V = 6.5;
const SWOOP_V = 4.5, SWOOP_RISE_MAX = 1.1, SWOOP_GLIDE = 1.6, PLUCK_LEN = 0.9;
export const BULK_T = 5, BULK_LEN = 0.62; // half length of the puffed body along the channel (2.2x the chick)
export const PICK_T = 0.55, ICE_LEN = 0.8, ICE_GAP_T = 6;
const STUN_T = 3, DAZE_EAGLE = 2.2, EAGLE_UP = 1.2;
const CHICK_R = 0.3;

const P = (rad, ang) => Vec2(rad * Math.cos(ang), rad * Math.sin(ang));

export const chickMethods = {
  // build(): pre-tinted eggs and hard-ice rings (spec.ice: true, or sections [{a, len}])
  chickSetup(L) {
    this.chickGain = 0; // obstacles the powers cleared (planner shaping)
    (L.chickEggs || []).forEach((k, i) => {
      const kind = k && (k.kind || k), e = this.eggs[i];
      if (!e || !TAP.has(kind)) return;
      e.tint = kind;
      if (k.hatched) this.hatch(e, false); // {kind, hatched: true}: a chick already in the vault
    });
    for (const ring of this.rings) {
      const ice = ring.spec.ice;
      if (!ice) continue;
      const secs = ice === true ? null : (Array.isArray(ice) ? ice : [ice]).map((s) => ({ a: (s.a * Math.PI) / 180, half: (s.len || 1.2) / (2 * ring.r) }));
      for (const sg of ring.segs) {
        const mid = (sg.a0 + sg.a1) / 2;
        if (!secs || secs.some((s) => Math.abs(wrap(mid - s.a)) < s.half)) { sg.hardIce = true; sg.iceT = 0; ring.hardIce = true; }
      }
    }
  },

  // takeOrb(): the gold flame or a hatch orb
  hatchOrb(egg, t) {
    if (egg.chick || egg.hatchT > 0) return;
    if (t === 'fire_gold' && !egg.tint) { this.hatch(egg); return; } // classic pecker, at once (as before)
    if (!egg.tint) egg.tint = TAP.has(t.slice(6)) ? t.slice(6) : 'glow';
    egg.hatchT = HATCH_DELAY;
    const p = egg.body.getPosition();
    this.emit('chickTint', { egg, kind: egg.tint, x: p.x, y: p.y });
  },

  // hatch(): set the kind; on a restore (quiet) rebuild a puffed body
  chickHatched(egg, quiet) {
    egg.hatchT = 0;
    if (!egg.chickKind) egg.chickKind = egg.tint || 'peck';
    if (!quiet) {
      egg.powU = TAP.has(egg.chickKind) ? 0 : 1;
      egg.powK = egg.powT = egg.bulk = 0;
      egg.face = egg.body.getLinearVelocity().x < -0.2 ? -1 : 1;
      const p = egg.body.getPosition();
      this.emit('chickHatch', { egg, kind: egg.chickKind, x: p.x, y: p.y });
    } else if (egg.bulk > 0) this.bulkBody(egg, true);
  },

  canTap(egg) {
    return !!egg && egg.alive && !egg.saved && !!egg.chick && TAP.has(egg.chickKind) && !egg.powU && this.state === 'play';
  },
  // the ready chick nearest (x, y) within r (input: a generous screen radius turned into meters)
  chickAt(x, y, r) {
    let best = null, bd = r;
    for (const e of this.aliveEggs()) {
      if (!this.canTap(e)) continue;
      const p = e.body.getPosition(), d = Math.hypot(p.x - x, p.y - y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  },

  // One tap = one power. Returns true if it went off.
  tapChick(id) {
    const egg = this.eggs.find((e) => e.id === id);
    if (!this.canTap(egg)) return false;
    egg.powU = 1;
    const b = egg.body, p = b.getPosition(), k = egg.chickKind;
    egg.powX = p.x; egg.powY = p.y;
    this.emit('chickPower', { egg, kind: k, x: p.x, y: p.y });
    if (k === 'glow') this.glowFlash(egg);
    else if (k === 'dash') {
      const th = Math.atan2(p.y, p.x);
      egg.powA = Math.sign(-Math.sin(th) * (egg.face || 1)) || (egg.face || 1); // the way it faces, along the channel
      egg.powK = 1; egg.powT = DASH_T;
    } else if (k === 'swoop') {
      const c = this.channelOf(egg);
      egg.powA = c >= 1 ? c - 1 : -1; // the ring it flies up through
      egg.powK = 1; egg.powT = SWOOP_RISE_MAX;
    } else if (k === 'bulk') {
      egg.powK = 1; egg.bulk = egg.powT = BULK_T;
      this.bulkBody(egg, true);
    } else if (k === 'pick') {
      egg.powA = this.pickRing(egg);
      egg.powK = 1; egg.powT = PICK_T;
    }
    return true;
  },

  // ---------- every step (before the world step)
  chickStep(dt) {
    for (const S of this.snakes) if (S.daze > 0) S.daze = Math.max(0, S.daze - dt);
    if (this.eagle && this.eagle.daze > 0) this.eagle.daze = Math.max(0, this.eagle.daze - dt);
    for (const egg of this.eggs) {
      if (!egg.alive || egg.saved || !egg.body) continue;
      if (!egg.chick) {
        if (egg.hatchT > 0 && (egg.hatchT -= dt) <= 0) this.hatch(egg);
        continue;
      }
      const b = egg.body, v = b.getLinearVelocity();
      if (Math.abs(v.x) > 0.35 && !(egg.powK && egg.chickKind === 'dash')) egg.face = v.x > 0 ? 1 : -1;
      if (!egg.powK) continue;
      egg.powT -= dt;
      const k = egg.chickKind;
      if (k === 'glow') { if (egg.powT <= 0) egg.powK = 0; }
      else if (k === 'dash') this.dashStep(egg);
      else if (k === 'swoop') this.swoopStep(egg);
      else if (k === 'bulk') this.bulkStep(egg);
      else if (k === 'pick') this.pickStep(egg);
    }
    this.iceStep2(dt);
  },

  // ---------- glow
  glowFlash(egg) {
    const p = egg.body.getPosition(), R = GLOW_R;
    egg.powK = 1; egg.powT = 0.7; // the flash plays out (art)
    let n = 0;
    for (const ring of this.rings) {
      for (const th of ring.thorns) {
        if (!th.alive) continue;
        const q = ring.body.getWorldPoint(P((th.base + th.tip) / 2, th.a));
        if (Math.hypot(q.x - p.x, q.y - p.y) < R) { this.removeThorn(th, 'burn'); n++; }
      }
    }
    for (const ring of this.rings) for (const g of ring.gaps) { // a thorn curtain in range catches fire
      const C = g.curtain;
      if (!C || !C.alive || C.burning) continue;
      const q = ring.body.getWorldPoint(P(ring.r, g.a));
      if (Math.hypot(q.x - p.x, q.y - p.y) < R) { C.burning = true; n += 4; this.emit('curtainBurn', { x: q.x, y: q.y, ring: ring.i }); }
    }
    for (const S of this.snakes) {
      if (S.gone || !S.inside || !S.pts.length) continue;
      if (S.pts.some((q, i) => i % 3 === 0 && Math.hypot(q.x - p.x, q.y - p.y) < R + 0.2)) this.stunSnake(S, 'flash', p);
    }
    for (const C of this.salsNear?.(p.x, p.y, R + 0.2) || []) { this.hitSalamander?.(C, 'flash', { x: p.x, y: p.y }); this.chickGain += 2; } // v3.2: stuns the salamander
    const E = this.eagle;
    if (E && E.phase !== 'away' && E.phase !== 'up' && (Math.hypot(E.x - p.x, E.y - p.y) < R + 1.6 || E.tid === egg.id)) {
      if (this.hitEagle) this.hitEagle('flash', { x: p.x, y: p.y });
      else { E.phase = 'up'; E.t = EAGLE_UP + 1.5; E.carry = null; E.reach = 0; }
      E.daze = DAZE_EAGLE;
      this.emit('eagleDaze', { x: E.x, y: E.y });
    }
    // the downside: the blast blows nearby eggs outward a little
    for (const e of this.aliveEggs()) {
      if (e === egg || e.chick || e.honey > 0) continue;
      const q = e.body.getPosition(), dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 0.01;
      if (d > R) continue;
      const f = e.body.getMass() * 2.4 * (1 - d / R);
      e.body.applyLinearImpulse(Vec2((dx / d) * f, (dy / d) * f + f * 0.25), q, true);
    }
    this.chickGain += n;
    this.emit('chickFlash', { egg, x: p.x, y: p.y, R, n });
  },

  // a stunned snake: it stops (and loses a spit) for STUN_T, with stars round its head
  stunSnake(S, why, p) {
    if (this.hitSnake) this.hitSnake(S, why, { x: p.x, y: p.y, power: 1 });
    if (S.spit) { const bar = this.barriers[S.spit.b]; if (bar) bar.venom = 0; S.spit = null; }
    S.wait = Math.max(S.wait, STUN_T);
    S.mood = 'ouch'; S.moodT = 0.7;
    S.daze = STUN_T;
    this.chickGain += 2;
    const h = S.pts[0] || p;
    this.emit('snakeDaze', { x: h.x, y: h.y, id: S.id, why });
  },

  // ---------- dash: along the channel at DASH_V, keeping the radial part of the motion (so it can overshoot)
  dashStep(egg) {
    const b = egg.body, p = b.getPosition(), v = b.getLinearVelocity(), r = Math.hypot(p.x, p.y) || 1;
    const ux = p.x / r, uy = p.y / r, tx = -uy * egg.powA, ty = ux * egg.powA, vr = v.x * ux + v.y * uy;
    b.setLinearVelocity(Vec2(tx * DASH_V + ux * vr, ty * DASH_V + uy * vr));
    b.applyForceToCenter(Vec2(0, -b.getMass() * this.g * 0.6), true); // no flutter while it shoots
    for (const S of this.snakes) {
      if (S.gone || !S.inside || S.daze > 0 || !S.pts.length) continue;
      if (S.pts.some((q, i) => i % 2 === 0 && Math.hypot(q.x - p.x, q.y - p.y) < CHICK_R + 0.28)) {
        this.stunSnake(S, 'dash', p);
        const T = S.pts; // knocked back along its own body
        if (T.length > 8) { const q = T[6]; S.rad = Math.hypot(q.x, q.y); S.a = Math.atan2(q.y, q.x); T.splice(0, 6); }
      }
    }
    for (const C of this.salsNear?.(p.x, p.y, CHICK_R + 0.3) || []) { // v3.2: bonks the salamander
      if (C.ph === 'daze') continue;
      this.hitSalamander?.(C, 'dash', { x: p.x, y: p.y });
      this.chickGain += 2;
    }
    for (const o of this.orbs) {
      if (!o.alive || o.taken || Math.hypot(o.x - p.x, o.y - p.y) > CHICK_R + 0.3) continue;
      o.taken = true;
      this.takeOrb(egg, o);
      this.chickGain += 3;
    }
    if (egg.powT <= 0) { egg.powK = 0; this.emit('chickDashEnd', { egg, x: p.x, y: p.y }); }
  },

  // ---------- swoop: phase 1 rises through ring powA, phase 2 glides down, landing plucks thorns
  swoopStep(egg) {
    const b = egg.body, p = b.getPosition(), r = Math.hypot(p.x, p.y) || 1, m = b.getMass();
    const ux = p.x / r, uy = p.y / r;
    if (egg.powK === 1) {
      const ring = this.rings[egg.powA];
      const goal = ring ? ring.r - RING_TH / 2 - 0.42 : r - 0.6;
      b.setLinearVelocity(Vec2(-ux * SWOOP_V, -uy * SWOOP_V));
      b.applyForceToCenter(Vec2(0, m * this.g * 0.4), true);
      if (r <= Math.max(goal, 0.15) || egg.powT <= 0) {
        egg.powK = 2; egg.powT = SWOOP_GLIDE;
        b.setLinearVelocity(Vec2(-ux * 1.2, -uy * 1.2));
        this.emit('chickGlide', { egg, x: p.x, y: p.y });
      }
    } else if (egg.powK === 2) {
      b.applyForceToCenter(Vec2(0, m * this.g * 0.25), true); // wings out: a slow glide
      const v = b.getLinearVelocity(), tx = -uy, ty = ux, want = 0.7 * (egg.face || 1) * (Math.sign(-uy) || 1); // drifts the way it faces
      const vt = v.x * tx + v.y * ty;
      b.setLinearVelocity(Vec2(v.x + tx * (want - vt) * 0.06, v.y + ty * (want - vt) * 0.06));
      if (egg.powT <= 0) this.swoopLand(egg, null);
    }
  },
  swoopLand(egg, ring) {
    if (egg.powK !== 2) return;
    egg.powK = 0; egg.powT = 0;
    const p = egg.body.getPosition(), d = Math.hypot(p.x, p.y);
    if (!ring) { let bd = 0.7; for (const R of this.rings) if (Math.abs(d - R.r) < bd) { bd = Math.abs(d - R.r); ring = R; } }
    let n = 0;
    if (ring) {
      const a = Math.atan2(p.y, p.x) - ring.body.getAngle();
      for (const th of ring.thorns) if (th.alive && Math.abs(wrap(th.a - a)) * ring.r < PLUCK_LEN) { this.removeThorn(th, 'peck'); n++; }
    }
    this.chickGain += n;
    this.emit('chickPluck', { egg, x: p.x, y: p.y, n });
  },

  // ---------- bulk: a long puffed body that lies along the channel
  bulkBody(egg, on) {
    const b = egg.body, mask = egg.fix.getFilterMaskBits();
    b.destroyFixture(egg.fix);
    let shape, density;
    if (on) {
      const c = this.channelOf(egg), n = this.rings.length;
      const lo = c > 0 ? this.rings[c - 1].r + RING_TH / 2 : 0, hi = c < n ? this.rings[c].r - RING_TH / 2 : lo + 2;
      const sag = (BULK_LEN * BULK_LEN) / (2 * (lo + hi)); // a straight body in a curved channel: leave room for the bow
      const hb = clamp((hi - lo) / 2 - 0.1 - sag, 0.22, 0.36), pts = [];
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; pts.push(Vec2(BULK_LEN * Math.cos(a), hb * Math.sin(a))); }
      shape = new Polygon(pts); density = 1.1;
      b.setLinearDamping(0.4);
    } else { shape = new Circle(CHICK_R); density = 0.65; b.setLinearDamping(this.damping(egg)); }
    egg.fix = egg.chickFix = b.createFixture({ shape, density, friction: on ? 0.15 : 0.5, restitution: 0.05, filterCategoryBits: 2, filterMaskBits: mask, userData: { kind: 'egg', egg } });
    const p = b.getPosition();
    b.setTransform(p, on ? Math.atan2(p.y, p.x) + Math.PI / 2 : 0);
  },
  bulkStep(egg) {
    const b = egg.body, p = b.getPosition();
    egg.bulk = Math.max(0, egg.powT);
    b.setTransform(p, Math.atan2(p.y, p.x) + Math.PI / 2); // lies along the channel
    b.applyForceToCenter(Vec2(0, -b.getMass() * this.g * 0.6), true); // too heavy to flutter
    if (egg.powT <= 0) {
      egg.powK = 0; egg.bulk = 0;
      this.bulkBody(egg, false);
      this.emit('chickDeflate', { egg, x: p.x, y: p.y });
    }
  },

  // ---------- pick: drill the nearest ring (floor first); hard ice opens, other rings lose their thorns
  pickRing(egg) {
    const p = egg.body.getPosition(), d = Math.hypot(p.x, p.y), c = this.channelOf(egg);
    let best = -1, bd = RING_TH / 2 + CHICK_R + 0.35;
    for (const i of [c, c - 1]) {
      const ring = this.rings[i];
      if (!ring) continue;
      const g = Math.abs(d - ring.r) - (i === c ? 0.05 : 0); // a tie goes to the floor
      if (g < bd) { bd = g; best = i; }
    }
    return best;
  },
  pickStep(egg) {
    const b = egg.body, m = b.getMass();
    if (egg.powK === 1) {
      b.setLinearVelocity(Vec2(0, 0)); // planted while it drills
      b.applyForceToCenter(Vec2(0, m * this.g * 0.4), true);
      if (egg.powT <= 0) { this.pickHit(egg); egg.powK = 2; egg.powT = 0.35; }
    } else if (egg.powT <= 0) egg.powK = 0;
  },
  pickHit(egg) {
    const p = egg.body.getPosition(), ring = this.rings[egg.powA];
    if (!ring) { this.emit('chickDrill', { egg, x: p.x, y: p.y, n: 0, ice: 0 }); return; }
    const la = Math.atan2(p.y, p.x) - ring.body.getAngle(), half = ICE_LEN / (2 * ring.r);
    let ice = 0, n = 0;
    for (const sg of ring.segs) {
      if (!sg.alive || !sg.hardIce || Math.abs(wrap((sg.a0 + sg.a1) / 2 - la)) > half) continue;
      this.iceBreak(ring, sg);
      ice++;
    }
    // boss ice blocks (v3.1, when present): the drill cracks them too
    for (const W of (this.bx && this.bx.walls) || []) {
      if (!W.alive || W.kind !== 'ice' || Math.abs(W.ri - ring.i) > 1) continue;
      const q = this.rings[W.ri].body.getWorldPoint(P(this.rings[W.ri].r - 0.3, W.la));
      if (Math.hypot(q.x - p.x, q.y - p.y) < 0.9) { W.life = 1e-3; ice++; }
    }
    if (!ice) for (const th of ring.thorns) if (th.alive && Math.abs(wrap(th.a - la)) * ring.r < 0.5) { this.removeThorn(th, 'snap'); n++; }
    const q = ring.body.getWorldPoint(P(ring.r, la));
    this.chickGain += n + ice * 2;
    this.emit(ice ? 'iceShatter' : 'chickDrill', { egg, x: q.x, y: q.y, n, ice, ring: ring.i });
  },
  // a hard-ice segment shatters into a hole that freezes over again after ICE_GAP_T
  iceBreak(ring, sg) {
    sg.alive = false;
    sg.iceT = ICE_GAP_T;
    this.killFix.push([ring.body, sg.fix]);
    for (const th of ring.thorns) if (th.alive && wrap(th.a - sg.a0) > -0.02 && wrap(th.a - sg.a1) < 0.02) this.removeThorn(th, 'snap');
    const am = (sg.a0 + sg.a1) / 2, wa = ring.body.getAngle() + am, x = ring.r * Math.cos(wa), y = ring.r * Math.sin(wa);
    for (let i = 0; i < 2; i++) {
      const s = 0.07 + 0.04 * this.rand(), a0 = this.rand() * TAU;
      const verts = [0, 1, 2].map((j) => ({ x: s * Math.cos(a0 + j * 2.1), y: s * Math.sin(a0 + j * 2.1) }));
      this.addDebris('ice', verts, x, y, wa, Math.cos(wa) * 1.2 + (this.rand() - 0.5) * 2, Math.sin(wa) * 1.2 + 1.5, (this.rand() - 0.5) * 12, 1.2, { mat: 'ice' });
    }
  },
  iceStep2(dt) {
    const fr = this.level.weather === 'rain' ? 0.55 : 1;
    for (const ring of this.rings) {
      if (!ring.hardIce) continue;
      for (const sg of ring.segs) {
        if (!(sg.iceT > 0) || (sg.iceT -= dt) > 0) continue;
        if (this.eggOnSeg(ring, sg)) { sg.iceT = 0.05; continue; } // never freezes into an egg
        sg.iceT = 0;
        sg.alive = true;
        const ri = ring.r - RING_TH / 2, ro = ring.r + RING_TH / 2, b0 = sg.a0, b1 = sg.a1;
        sg.fix = ring.body.createFixture({
          shape: new Polygon([P(ri, b0), P(ro, b0), P(ro, b1), P(ri, b1)]),
          friction: ring.M.fr * fr, restitution: ring.M.re, filterCategoryBits: 1, filterMaskBits: 2 | 4 | 64 | 128, userData: { kind: 'seg', seg: sg },
        });
        const wa = ring.body.getAngle() + (sg.a0 + sg.a1) / 2;
        this.emit('iceHeal', { ring: ring.i, x: ring.r * Math.cos(wa), y: ring.r * Math.sin(wa) });
      }
    }
  },

  // ---------- contacts (pre-solve)
  // Contacts switched off: a rising swoop passes through the ring it flies up through, clearing it as it goes.
  chickPass(ua, ub) {
    const [u, o] = ua.kind === 'egg' ? [ua, ub] : ub.kind === 'egg' ? [ub, ua] : [null, null];
    if (!u) return false;
    const egg = u.egg;
    if (!(egg.powK === 1 && egg.chickKind === 'swoop')) return false;
    const ri = o.kind === 'seg' ? o.seg.ring.i : o.kind === 'thorn' ? o.thorn.ring.i : o.kind === 'barrier' ? o.barrier.ring : o.ring ? o.ring.i : o.kind === 'shut' ? egg.powA : -2;
    if (ri !== egg.powA) return false;
    if (o.kind === 'thorn' && o.thorn.alive) { const th = o.thorn; this.defer(() => this.removeThorn(th, 'snap')); }
    if (o.kind === 'curtain' && o.gap.curtain.alive) {
      const C = o.gap.curtain, ring = o.ring, g = o.gap;
      C.alive = false;
      C.burn = 1; // torn down, nothing left to draw
      this.defer(() => {
        for (const f of C.fixes) this.killFix.push([ring.body, f]);
        const q = ring.body.getWorldPoint(P(ring.r, g.a));
        this.emit('swoopClear', { egg, x: q.x, y: q.y });
        this.chickGain += 4;
      });
    }
    return true;
  },
  // Egg contacts with powers on. Returns true when it has dealt with the contact.
  chickContact(c, egg, other) {
    if (!egg || !egg.chick || !egg.powK || !other) return false;
    const k = egg.chickKind;
    if (other.kind === 'thorn' && other.thorn.alive && other.thorn.ext >= 0.5) {
      const th = other.thorn;
      if (k === 'dash' && th.kind === 'blunt') {
        c.setEnabled(false);
        this.defer(() => { if (!th.alive) return; const cl = this.thornCluster(th), p = egg.body.getPosition(); for (const x of cl) this.removeThorn(x, 'peck'); this.chickGain += cl.length; this.emit('chickPeck', { egg, x: p.x, y: p.y, n: cl.length }); });
        return true;
      }
      if (k === 'bulk') { c.setEnabled(false); this.defer(() => { const n0 = th.ring.thorns.filter((x) => x.alive).length; this.smashCluster(th, egg); this.chickGain += n0 - th.ring.thorns.filter((x) => x.alive).length; }); return true; }
    }
    if (other.kind === 'seg') {
      const sg = other.seg;
      if (k === 'bulk' && sg.alive && sg.ring.M.hp && sg.hp < sg.ring.M.hp && !sg.dying) { sg.dying = true; this.defer(() => this.breakSeg(sg, 'shatter')); }
      if (k === 'swoop' && egg.powK === 2) this.defer(() => this.swoopLand(egg, sg.ring));
    }
    return false;
  },

  // ---------- state (rewind / planner)
  chickState() {
    return { gain: this.chickGain, ice: this.rings.map((r) => (r.hardIce ? r.segs.map((g) => g.iceT || 0) : null)) };
  },
  chickRestore(C) {
    if (!C) return;
    this.chickGain = C.gain || 0;
    C.ice.forEach((ts, i) => { if (ts) ts.forEach((t, k) => { this.rings[i].segs[k].iceT = t; }); });
  },
};
