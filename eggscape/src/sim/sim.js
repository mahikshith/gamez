// Eggscape simulation: planck.js (Box2D) world, rules, events. No DOM here so it runs in node for tests.
import { World, Vec2, Polygon, Circle, Box, RopeJoint } from 'planck';
import { EGG_H, EGG_W, RING_TH, TAU, eggHull, solidArcs, wrap, clamp, rng } from './geom.js';

export const DT = 1 / 120;

// Impact thresholds: approach speed along the contact normal (m/s).
export const CRACK_V = 5.6; // ~1.6 m of free fall: a one-ring drop is safe, a bigger fall onto bare ring cracks
export const MULT_CAP = 30;
export const SHATTER_V = 8.5;
const EGG_EGG = 2.0; // egg vs egg: use closing speed (reduced mass = m/2)
const NEST_SOFT = 2.3; // nest multiplies thresholds
const PAD_SOFT = 0.5; // sponge pads halve the impact
const CRACK_COOLDOWN = 0.3;

export const MATERIALS = {
  wood: { fr: 0.75, re: 0.08, burn: true },
  stone: { fr: 0.85, re: 0.04, slow: 0.7 },
  ice: { fr: 0.0, re: 0.05 },
  mushroom: { fr: 0.6, re: 0.8 },
  glass: { fr: 0.45, re: 0.12, hp: 3 },
  metal: { fr: 0.55, re: 0.12 },
  coral: { fr: 0.9, re: 0.08 },
  vine: { fr: 1.8, re: 0.0, sticky: true, burn: true },
  cloud: { fr: 0.6, re: 0.4 },
  obsidian: { fr: 0.65, re: 0.06 },
  bone: { fr: 0.6, re: 0.1 },
  gold: { fr: 0.6, re: 0.1 },
};

const CAT = { RING: 1, EGG: 2, DEBRIS: 4, NEST: 8, GROUND: 16, ITEM: 32, BOMB: 64, ROCK: 128 };
const MASK = {
  RING: CAT.EGG | CAT.DEBRIS | CAT.BOMB | CAT.ROCK,
  EGG: CAT.RING | CAT.EGG | CAT.NEST | CAT.GROUND | CAT.ITEM | CAT.BOMB | CAT.ROCK,
  DEBRIS: CAT.RING | CAT.GROUND | CAT.NEST,
  NEST: CAT.EGG | CAT.DEBRIS | CAT.BOMB | CAT.ROCK,
  GROUND: CAT.EGG | CAT.DEBRIS | CAT.BOMB | CAT.ROCK,
  ITEM: CAT.EGG,
  BOMB: CAT.RING | CAT.EGG | CAT.NEST | CAT.GROUND | CAT.ROCK | CAT.BOMB,
  ROCK: CAT.RING | CAT.EGG | CAT.NEST | CAT.GROUND | CAT.BOMB | CAT.ROCK,
};
const filt = (k) => ({ filterCategoryBits: CAT[k], filterMaskBits: MASK[k] });

export const POWER = {
  fire: { time: 6 },
  steel: { time: 8, mass: 4 },
  bubble: { time: 7 },
  magnet: { time: 8, len: 0.8 },
};

const deg = (d) => (d * Math.PI) / 180;

export class Sim {
  constructor(level, opts = {}) {
    this.level = level;
    this.t = 0;
    this.events = [];
    this.rs = (level.seed || 7) >>> 0;
    this.rand = () => {
      let t = (this.rs = (this.rs + 0x6d2b79f5) | 0);
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    this.g = level.gravity ?? 10;
    this.world = new World({ gravity: Vec2(0, -this.g) });
    this.rings = [];
    this.eggs = [];
    this.debris = [];
    this.bombs = [];
    this.rocks = [];
    this.portals = [];
    this.savedLog = [];
    this.snaps = [];
    this.kill = []; // bodies to destroy after step
    this.killFix = [];
    this.later = []; // world is locked inside contact callbacks: defer mutations
    this.nextEggId = 1;
    this.state = 'play'; // play | won | failed
    this.endTimer = 0;
    this.wind = 0;
    this.maxEggs = 4;
    this.opts = opts;
    this.golden = opts.golden || false;
    this.timeLimit = level.time || 0;
    this.timeLeft = this.timeLimit;
    this.combo = 0;
    this.lastSaveT = -9;
    this.build();
    this.world.on('pre-solve', (c, old) => this.preSolve(c, old));
    this.world.on('post-solve', (c, imp) => this.postSolve(c, imp));
    this.world.on('begin-contact', (c) => this.beginContact(c));
    this.world.on('end-contact', (c) => this.endContact(c));
  }

  emit(type, data = {}) {
    this.events.push({ type, t: this.t, ...data });
  }

  // ---------- build ----------
  build() {
    const L = this.level;
    const mat0 = L.material || 'wood';
    let r = L.r0 || 1.05;
    L.rings.forEach((spec, i) => {
      if (i > 0) r += spec.gapTo ?? L.spacing ?? 1.0;
      this.rings.push(this.makeRing(i, r, spec, spec.mat || mat0));
    });
    this.outerR = r + RING_TH / 2;

    // nest + ground
    const n = L.nest || {};
    this.nestW = n.w || 1.9;
    this.groundY = -(this.outerR + (n.drop ?? 0.6) + 0.35);
    this.nestY = this.groundY + 0.02;
    this.nestAmp = n.amp || 0;
    this.nestPeriod = n.period || 6;
    this.nestX0 = n.x || 0;
    this.nest = this.world.createBody({ type: 'kinematic', position: Vec2(this.nestX0, this.nestY) });
    const w = this.nestW / 2;
    const nestFix = { friction: 0.9, restitution: 0.0, ...filt('NEST'), userData: { kind: 'nest' } };
    this.nest.createFixture({ shape: new Polygon([Vec2(-w, 0.12), Vec2(-w + 0.18, 0), Vec2(w - 0.18, 0), Vec2(w, 0.12), Vec2(w - 0.2, 0.16), Vec2(-w + 0.2, 0.16)]), ...nestFix });
    this.nest.createFixture({ shape: new Polygon([Vec2(-w - 0.08, 0.5), Vec2(-w, 0.08), Vec2(-w + 0.14, 0.12), Vec2(-w + 0.04, 0.5)]), ...nestFix });
    this.nest.createFixture({ shape: new Polygon([Vec2(w + 0.08, 0.5), Vec2(w - 0.04, 0.5), Vec2(w - 0.14, 0.12), Vec2(w, 0.08)]), ...nestFix });
    this.nest.createFixture({ shape: new Box(w - 0.12, 0.25, Vec2(0, 0.38), 0), isSensor: true, ...filt('NEST'), userData: { kind: 'nestIn' } });
    this.ground = this.world.createBody({ type: 'static', position: Vec2(0, this.groundY - 0.5) });
    this.ground.createFixture({ shape: new Box(60, 0.5), friction: 0.8, ...filt('GROUND'), userData: { kind: 'ground' } });

    // eggs in the center chamber
    const n0 = L.eggs || 1;
    const spots = [[-0.24, -0.62], [0.24, -0.62], [0, -0.1], [-0.3, 0.3], [0.3, 0.3]];
    for (let i = 0; i < n0; i++) this.addEgg(spots[i][0] * (this.rings[0].r / 1.05), spots[i][1] * (this.rings[0].r / 1.05), 0, i === 0 && this.golden ? { golden: 1 } : {});

    for (const p of L.portals || []) {
      this.portals.push({ ax: p.a[0], ay: p.a[1], bx: p.b[0], by: p.b[1], r: 0.3 });
    }
    for (const b of L.bombs || []) this.addBomb(b.x, b.y);
    for (const k of L.rocks || []) this.addRock(k.x, k.y, k.s || 0.18);
  }

  makeRing(i, r, spec, mat) {
    const M = MATERIALS[mat] || MATERIALS.wood;
    const body = this.world.createBody({ type: 'kinematic', position: Vec2(0, 0), angle: deg(spec.angle || 0) });
    const ring = {
      i, r, mat, M, body, spec,
      target: body.getAngle(),
      motor: spec.motor ? deg(spec.motor) : 0,
      motorFlip: spec.motorFlip || 0,
      grabbable: !spec.motor,
      gaps: (spec.gaps || []).map((g) => ({ a: deg(g.a), len: g.len || 0.78, x: g.x || 1 })),
      segs: [], thorns: [], items: [],
      retract: spec.retract || null,
      held: false, omega: 0,
    };
    const ri = r - RING_TH / 2, ro = r + RING_TH / 2;
    for (const [a0, a1] of solidArcs(r, ring.gaps)) {
      const n = Math.max(1, Math.ceil(((a1 - a0) * r) / 0.2));
      for (let k = 0; k < n; k++) {
        const b0 = a0 + ((a1 - a0) * k) / n, b1 = a0 + ((a1 - a0) * (k + 1)) / n;
        const seg = { a0: b0, a1: b1, alive: true, hp: M.hp || 0, burn: 0, hitCD: 0, ring, pad: false, press: 0, hitT: -9, hitV: 0 };
        const mid = (b0 + b1) / 2;
        for (const pd of spec.pads || []) if (Math.abs(wrap(mid - deg(pd.a))) < pd.len / (2 * r)) seg.pad = true;
        seg.fix = body.createFixture({
          shape: new Polygon([Vec2(ri * Math.cos(b0), ri * Math.sin(b0)), Vec2(ro * Math.cos(b0), ro * Math.sin(b0)), Vec2(ro * Math.cos(b1), ro * Math.sin(b1)), Vec2(ri * Math.cos(b1), ri * Math.sin(b1))]),
          friction: seg.pad ? 0.95 : M.fr, restitution: seg.pad ? 0.02 : M.re, ...filt('RING'), userData: { kind: 'seg', seg },
        });
        ring.segs.push(seg);
      }
    }
    for (const th of spec.thorns || []) {
      const count = th.n || 1;
      for (let k = 0; k < count; k++) {
        const a = deg(th.a + (k - (count - 1) / 2) * (th.spread || 11));
        this.addThorn(ring, a, th.side || 'in', th.h || 0.24);
      }
    }
    for (const it of spec.items || []) {
      const a = deg(it.a);
      const rr = ri - 0.2;
      const fix = body.createFixture({ shape: new Circle(Vec2(rr * Math.cos(a), rr * Math.sin(a)), 0.2), isSensor: true, ...filt('ITEM'), userData: { kind: 'item' } });
      const item = { type: it.type, a, rr, fix, alive: true, ring };
      fix.getUserData().item = item;
      ring.items.push(item);
    }
    return ring;
  }

  addThorn(ring, a, side, h) {
    const r = ring.r, half = 0.13 / r;
    const base = side === 'in' ? r - RING_TH / 2 + 0.03 : r + RING_TH / 2 - 0.03;
    const tip = side === 'in' ? base - h : base + h;
    const p = (rad, ang) => Vec2(rad * Math.cos(ang), rad * Math.sin(ang));
    const thorn = { a, side, h, base, tip, alive: true, ring, ext: 1 };
    const verts = side === 'in' ? [p(base, a - half), p(base, a + half), p(tip, a)] : [p(base, a + half), p(base, a - half), p(tip, a)];
    thorn.fix = ring.body.createFixture({ shape: new Polygon(verts), friction: 0.3, ...filt('RING'), userData: { kind: 'thorn', thorn } });
    ring.thorns.push(thorn);
  }

  addEgg(x, y, cracks = 0, extra = {}) {
    const body = this.world.createDynamicBody({ position: Vec2(x, y), bullet: true, angularDamping: 0.35, linearDamping: this.level.water ? 1.1 : 0.02 });
    const hull = eggHull(12).map((p) => Vec2(p.x, p.y));
    const fix = body.createFixture({ shape: new Polygon(hull), density: 1, friction: 0.5, restitution: 0.12, ...filt('EGG'), userData: { kind: 'egg' } });
    const egg = {
      id: this.nextEggId++, body, fix, cracks, alive: true, saved: false,
      fire: 0, steel: 0, bubble: 0, bubbleFix: null, magnet: 0, joint: null, golden: extra.golden || 0,
      crackCD: 0, nestT: 0, inNest: 0, sticky: 0, safeT: this.t < 0.5 ? 1.5 : 0, portalCD: 0, born: this.t,
      seed: (this.rand() * 1e9) | 0, impact: 0, lastV: 0, fear: 0,
      ch: 0, mult: 1, freefall: 0, comet: 0, cometUsed: false,
    };
    fix.getUserData().egg = egg;
    body.setUserData(egg);
    this.eggs.push(egg);
    return egg;
  }

  addBomb(x, y) {
    const body = this.world.createDynamicBody({ position: Vec2(x, y), angularDamping: 0.5 });
    const bomb = { body, lit: false, fuse: 2.5, alive: true };
    body.createFixture({ shape: new Circle(0.2), density: 1.5, friction: 0.6, restitution: 0.1, ...filt('BOMB'), userData: { kind: 'bomb', bomb } });
    this.bombs.push(bomb);
    return bomb;
  }

  addRock(x, y, s) {
    const body = this.world.createDynamicBody({ position: Vec2(x, y), angularDamping: 0.2 });
    const pts = [];
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, rr = s * (0.8 + 0.4 * this.rand());
      pts.push(Vec2(rr * Math.cos(a), rr * Math.sin(a)));
    }
    const rock = { body, s, alive: true, pts: pts.map((p) => ({ x: p.x, y: p.y })) };
    body.createFixture({ shape: new Polygon(pts), density: 2.6, friction: 0.7, restitution: 0.05, ...filt('ROCK'), userData: { kind: 'rock', rock } });
    this.rocks.push(rock);
    return rock;
  }

  addDebris(kind, verts, x, y, a, vx, vy, w, life, extra = {}) {
    if (this.debris.length > 90) {
      const old = this.debris.shift();
      this.world.destroyBody(old.body);
    }
    const body = this.world.createDynamicBody({ position: Vec2(x, y), angle: a, angularDamping: 0.1 });
    body.createFixture({ shape: new Polygon(verts.map((p) => Vec2(p.x, p.y))), density: 0.6, friction: 0.5, restitution: 0.25, ...filt('DEBRIS') });
    body.setLinearVelocity(Vec2(vx, vy));
    body.setAngularVelocity(w);
    const d = { kind, body, verts, life, max: life, ...extra };
    this.debris.push(d);
    return d;
  }

  // ---------- control ----------
  ringAt(radius) {
    // Touching a channel controls the ring that is its floor (the ring just outside it).
    for (const ring of this.rings) if (radius <= ring.r + RING_TH) return ring;
    return this.rings[this.rings.length - 1];
  }
  maxOmega(ring) {
    return Math.min(2.2, 2.7 / ring.r) * (ring.M.slow || 1);
  }

  // ---------- step ----------
  step() {
    const dt = DT;
    this.t += dt;
    const L = this.level;

    for (const ring of this.rings) {
      const a = ring.body.getAngle();
      let w;
      if (ring.motor) {
        w = ring.motor;
        if (ring.motorFlip) w *= Math.floor(this.t / ring.motorFlip) % 2 ? -1 : 1;
      } else {
        const lim = this.maxOmega(ring);
        // keep the target from running away from the ring
        ring.target = a + clamp(ring.target - a, -0.7, 0.7);
        w = clamp((ring.target - a) * 14, -lim, lim);
      }
      ring.omega = w;
      ring.body.setAngularVelocity(w);
      if (ring.retract) {
        const { period, on, phase = 0 } = ring.retract;
        const ph = (((this.t + phase) % period) + period) % period / period;
        const want = ph < on ? 1 : 0;
        for (const th of ring.thorns) th.ext += clamp(want - th.ext, -dt * 5, dt * 5);
      }
      for (const s of ring.segs) if (s.hitCD > 0) s.hitCD -= dt;
    }

    // nest motion
    if (this.nestAmp) {
      const k = TAU / this.nestPeriod;
      const x = this.nestX0 + this.nestAmp * Math.sin(this.t * k);
      const cur = this.nest.getPosition().x;
      this.nest.setLinearVelocity(Vec2((x - cur) / dt * 0.5 + this.nestAmp * k * Math.cos(this.t * k) * 0.5, 0));
    }

    // wind
    if (L.wind) {
      const { strength, period = 5 } = L.wind;
      const s = Math.sin((this.t * TAU) / period);
      this.wind = strength * Math.sign(s) * Math.min(1, Math.abs(s) * 2.2);
    }

    for (const egg of this.eggs) {
      if (!egg.alive || egg.saved) continue;
      const b = egg.body;
      egg.impact = 0;
      if (egg.crackCD > 0) egg.crackCD -= dt;
      if (egg.safeT > 0) egg.safeT -= dt;
      if (egg.portalCD > 0) egg.portalCD -= dt;
      if (egg.fire > 0 && (egg.fire -= dt) <= 0) { egg.fire = 0; this.emit('fireOut', { egg }); }
      if (egg.steel > 0 && (egg.steel -= dt) <= 0) this.setSteel(egg, false);
      if (egg.bubble > 0) {
        b.applyForceToCenter(Vec2(0, b.getMass() * this.g * 1.1), true);
        if ((egg.bubble -= dt) <= 0) this.popBubble(egg);
      }
      if (egg.magnet > 0 && (egg.magnet -= dt) <= 0) this.unMagnet(egg);
      if (this.wind) b.applyForceToCenter(Vec2(this.wind * b.getMass() * (egg.bubble > 0 ? 2.2 : 1), 0), true);
      b.setAngularDamping(egg.sticky > 0 ? 12 : 0.35);
      // portals
      if (egg.portalCD <= 0) {
        const p = b.getPosition();
        for (const pt of this.portals) {
          if (Math.hypot(p.x - pt.ax, p.y - pt.ay) < pt.r) {
            b.setTransform(Vec2(pt.bx, pt.by), b.getAngle());
            egg.portalCD = 0.9;
            this.emit('portal', { egg, x: pt.ax, y: pt.ay, x2: pt.bx, y2: pt.by });
            break;
          }
        }
      }
    }
    for (const r of this.rocks) if (r.alive && this.wind) r.body.applyForceToCenter(Vec2(this.wind * r.body.getMass() * 0.5, 0), true);

    this.world.step(dt, 8, 3);
    this.afterStep(dt);
  }

  afterStep(dt) {
    for (let i = 0; i < this.later.length; i++) this.later[i]();
    this.later.length = 0;
    // impacts collected in post-solve
    for (const egg of this.eggs) {
      if (!egg.alive || egg.saved) continue;
      const v = egg.impact;
      if (v > 0.6) this.emit('bump', { egg, v });
      const soft = egg.inNest > 0 ? NEST_SOFT : 1;
      if (egg.steel > 0 || egg.safeT > 0) { /* immune */ }
      else if (egg.comet && v >= CRACK_V * soft) { egg.comet = 0; egg.safeT = 0.15; this.emit('cometLand', { egg, x: egg.body.getPosition().x, y: egg.body.getPosition().y }); }
      else if (v >= SHATTER_V * soft) this.breakEgg(egg, 'impact');
      else if (v >= CRACK_V * soft && egg.crackCD <= 0) this.crack(egg, v);
      if (!egg.alive) continue;
      const p = egg.body.getPosition();
      const ch = this.channelOf(egg);
      if (ch > egg.ch) this.passRing(egg, this.rings[ch - 1], p);
      else if (ch < egg.ch) egg.freefall = 0;
      egg.ch = ch;
      const vel = egg.body.getLinearVelocity();
      egg.lastV = Math.hypot(vel.x, vel.y);
      if (egg.inNest > 0 && egg.lastV < 1.2) {
        egg.nestT += dt;
        if (egg.nestT > 0.3) this.saveEgg(egg);
      } else egg.nestT = 0;
      if (p.y < this.groundY - 3 || Math.abs(p.x) > 40) this.breakEgg(egg, 'lost');
    }

    // bombs
    for (const bomb of this.bombs) {
      if (!bomb.alive || !bomb.lit) continue;
      bomb.fuse -= dt;
      if (bomb.fuse <= 0) this.explode(bomb);
    }

    // debris aging
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.life -= dt;
      if (d.life <= 0) { this.world.destroyBody(d.body); this.debris.splice(i, 1); }
    }

    for (const [body, fix] of this.killFix) body.destroyFixture(fix);
    this.killFix.length = 0;
    for (const body of this.kill) this.world.destroyBody(body);
    this.kill.length = 0;

    // snapshots for rewind (every 0.25 s, keep ~6 s)
    if (this.state === 'play' && Math.floor(this.t * 4) !== Math.floor((this.t - DT) * 4)) {
      this.snaps.push(this.snapshot());
      if (this.snaps.length > 26) this.snaps.shift();
    }

    // the fox's fuse
    if (this.state === 'play' && this.timeLimit) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.emit('timeout', { won: this.savedLog.length >= (this.level.target || 1) });
        for (const e of this.aliveEggs()) this.breakEgg(e, 'fox');
      }
    }
    // win / fail
    if (this.state === 'play') {
      const alive = this.eggs.filter((e) => e.alive && !e.saved).length;
      const saved = this.savedLog.length;
      const target = this.level.target || 1;
      if (saved + alive < target) { this.state = 'failing'; this.endTimer = 1.1; }
      else if (alive === 0) { this.state = 'winning'; this.endTimer = 0.9; }
    } else if (this.state === 'failing' || this.state === 'winning') {
      this.endTimer -= dt;
      if (this.endTimer <= 0) {
        this.state = this.state === 'failing' ? 'failed' : 'won';
        this.emit(this.state);
      }
    }
  }

  // ---------- contacts ----------
  parts(c) {
    const fa = c.getFixtureA(), fb = c.getFixtureB();
    return [fa, fb, fa.getUserData() || {}, fb.getUserData() || {}];
  }

  defer(fn) {
    this.later.push(fn);
  }

  // Impact speed measured when a contact first touches: closing speed along the normal.
  impactCheck(c, old, ua, ub) {
    if (old && old.pointCount > 0) return;
    if (ua.kind !== 'egg' && ub.kind !== 'egg') return;
    const wm = c.getWorldManifold(null);
    if (!wm || !wm.points || !wm.points.length) return;
    const n = wm.normal, pt = wm.points[0];
    const A = c.getFixtureA().getBody(), B = c.getFixtureB().getBody();
    const va = A.getLinearVelocityFromWorldPoint(pt), vb = B.getLinearVelocityFromWorldPoint(pt);
    const closing = -((vb.x - va.x) * n.x + (vb.y - va.y) * n.y);
    if (closing <= 0.3) return;
    const hit = (u, uo, body, other) => {
      if (u.kind !== 'egg') return;
      const egg = u.egg;
      let v = closing;
      if (uo.kind === 'egg') {
        // momentum share: lighter egg takes more of the hit
        const mo = other.getMass(), me = body.getMass();
        v = closing * (2 * mo / (mo + me)) * 0.85;
      }
      if (uo.kind === 'seg' && uo.seg.pad) {
        const sg = uo.seg;
        sg.hitT = this.t;
        sg.hitV = Math.max(v, sg.hitV * 0.5);
        if (v > 1.4) this.emit('squish', { v, x: pt.x, y: pt.y });
        v *= PAD_SOFT;
      }
      if (v > egg.impact) egg.impact = v;
      if (uo.kind === 'seg' && uo.seg.ring.M.hp && v > 1.7 && uo.seg.hitCD <= 0) {
        const sg = uo.seg;
        sg.hitCD = 0.25;
        sg.hp -= v > 4 ? 2 : 1;
        if (sg.hp <= 0 && !sg.dying) { sg.dying = true; this.defer(() => this.breakSeg(sg, 'shatter')); }
        else if (sg.hp > 0) this.emit('glassCrack', { seg: sg });
      }
    };
    hit(ua, ub, A, B);
    hit(ub, ua, B, A);
  }

  preSolve(c, old) {
    const [fa, fb, ua, ub] = this.parts(c);
    if (!fa.isSensor() && !fb.isSensor()) this.impactCheck(c, old, ua, ub);
    let egg = null, other = null, ofix = null;
    if (ua.kind === 'egg') { egg = ua.egg; other = ub; ofix = fb; }
    else if (ub.kind === 'egg') { egg = ub.egg; other = ua; ofix = fa; }
    if (other && other.kind === 'thorn' && other.thorn.ext < 0.5) { c.setEnabled(false); return; }
    if (!egg || !egg.alive || egg.saved) return;
    if (other.kind === 'thorn') {
      const th = other.thorn;
      if (!th.alive) { c.setEnabled(false); return; }
      if (egg.fire > 0) { this.defer(() => this.removeThorn(th, 'burn')); c.setEnabled(false); return; }
      if (egg.comet) { egg.comet = 0; this.defer(() => this.removeThorn(th, 'snap')); egg.safeT = 0.2; c.setEnabled(false); return; }
      if (egg.steel > 0) { this.defer(() => this.removeThorn(th, 'snap')); c.setEnabled(false); return; }
      if (egg.bubbleFix) { if (!egg.popping) { egg.popping = true; egg.safeT = 0.4; this.defer(() => { egg.popping = false; this.popBubble(egg, true); }); } c.setEnabled(false); return; }
      if (egg.golden) { egg.golden = 0; egg.safeT = 0.6; this.defer(() => this.removeThorn(th, 'snap')); this.emit('goldenSave', { egg }); c.setEnabled(false); return; }
      if (egg.safeT > 0) return;
      egg.safeT = 1; // one break only
      this.defer(() => { egg.safeT = 0; this.breakEgg(egg, 'thorn'); });
      c.setEnabled(false);
    } else if (other.kind === 'seg') {
      const seg = other.seg;
      egg.freefall = 0;
      if (seg.ring.M.sticky) egg.sticky = 0.15;
      if (egg.fire > 0 && seg.ring.M.burn && seg.alive) {
        seg.burn += DT;
        if (seg.burn > 0.45 && !seg.dying) { seg.dying = true; this.defer(() => this.breakSeg(seg, 'burn')); }
      }
    } else if (other.kind === 'bomb') {
      const bomb = other.bomb;
      if (!bomb.lit) { bomb.lit = true; this.emit('bombLit', { bomb }); }
    }
  }

  postSolve() {}

  beginContact(c) {
    const [fa, fb, ua, ub] = this.parts(c);
    const pair = (k1, k2) => (ua.kind === k1 && ub.kind === k2 ? [ua, ub] : ub.kind === k1 && ua.kind === k2 ? [ub, ua] : null);
    let p;
    if ((p = pair('egg', 'item'))) {
      const item = p[1].item;
      if (item.alive && p[0].egg.alive) { item.alive = false; const egg = p[0].egg; this.defer(() => this.takeItem(egg, item)); }
    } else if ((p = pair('egg', 'ground'))) {
      const egg = p[0].egg;
      if (egg.alive && !egg.saved) this.defer(() => this.breakEgg(egg, this.level.lava ? 'lava' : 'ground'));
    } else if ((p = pair('egg', 'nestIn'))) {
      p[0].egg.inNest++;
    } else if ((p = pair('egg', 'egg'))) {
      const a = p[0].egg, b = p[1].egg;
      if (a.fire > 0 && b.fire <= 0 && b.steel <= 0) this.emit('scorch', { egg: b });
    } else if ((p = pair('bomb', 'ground'))) {
      /* fine */
    }
  }

  endContact(c) {
    const [, , ua, ub] = this.parts(c);
    if (ua.kind === 'egg' && ub.kind === 'nestIn') ua.egg.inNest = Math.max(0, ua.egg.inNest - 1);
    if (ub.kind === 'egg' && ua.kind === 'nestIn') ub.egg.inNest = Math.max(0, ub.egg.inNest - 1);
  }

  // ---------- rules ----------
  passRing(egg, ring, p) {
    const local = wrap(Math.atan2(p.y, p.x) - ring.body.getAngle());
    let gate = null, best = 1e9;
    for (const g of ring.gaps) {
      const d = Math.abs(wrap(local - g.a));
      if (d < best) { best = d; gate = g; }
    }
    const half = gate ? gate.len / (2 * ring.r) + 0.25 : 0;
    const key = ring.i * 8 + ring.gaps.indexOf(gate);
    if (!egg.gates) egg.gates = new Set();
    if (gate && best < half && gate.x > 1 && !egg.gates.has(key)) {
      egg.gates.add(key); // a gate pays once per egg, however often it bobs back through
      egg.mult = Math.min(MULT_CAP, egg.mult * gate.x);
      this.emit('gate', { egg, x: p.x, y: p.y, gx: gate.x, mult: egg.mult });
    }
    egg.freefall++;
    if (egg.freefall >= 2 && !egg.comet && !egg.cometUsed) {
      egg.comet = 1;
      egg.cometUsed = true;
      this.emit('comet', { egg, x: p.x, y: p.y });
    }
  }

  crack(egg, v) {
    egg.cracks++;
    egg.crackCD = CRACK_COOLDOWN;
    const p = egg.body.getPosition();
    if (egg.cracks >= 3) this.breakEgg(egg, 'impact');
    else this.emit('crack', { egg, v, x: p.x, y: p.y });
  }

  breakEgg(egg, why) {
    if (!egg.alive || egg.saved) return;
    egg.alive = false;
    const b = egg.body;
    const p = b.getPosition(), vel = b.getLinearVelocity(), a = b.getAngle();
    this.emit('break', { egg, why, x: p.x, y: p.y, vx: vel.x, vy: vel.y });
    if (egg.joint) this.unMagnet(egg);
    // shell shards as physics debris
    const n = 7;
    for (let i = 0; i < n; i++) {
      const t0 = (i / n) * TAU, t1 = ((i + 1) / n) * TAU;
      const r = 0.2;
      const verts = [{ x: 0, y: 0 }, { x: r * Math.cos(t0), y: r * Math.sin(t0) }, { x: r * Math.cos(t1), y: r * Math.sin(t1) }];
      const tm = (t0 + t1) / 2;
      const sp = 1.5 + this.rand() * 2.5;
      this.addDebris('shell', verts, p.x + Math.cos(tm + a) * 0.08, p.y + Math.sin(tm + a) * 0.08, a, vel.x * 0.3 + Math.cos(tm + a) * sp, vel.y * 0.3 + Math.sin(tm + a) * sp + 1.5, (this.rand() - 0.5) * 14, 2.6, { golden: egg.golden });
    }
    this.kill.push(b);
  }

  saveEgg(egg) {
    egg.saved = true;
    const p = egg.body.getPosition();
    this.combo = this.t - this.lastSaveT < 3 ? Math.min(4, this.combo + 1) : 1;
    this.lastSaveT = this.t;
    const perfect = egg.cracks === 0;
    const pts = 100 * egg.mult * (perfect ? 2 : 1) * (egg.cometUsed ? 2 : 1) * this.combo;
    this.savedLog.push({ id: egg.id, t: this.t, cracks: egg.cracks, pts, mult: egg.mult, combo: this.combo });
    this.emit('save', { egg, x: p.x, y: p.y, n: this.savedLog.length, pts, perfect, combo: this.combo, mult: egg.mult });
    if (egg.joint) this.unMagnet(egg);
    this.kill.push(egg.body);
  }

  takeItem(egg, item) {
    if (!egg.alive || egg.saved) return;
    item.alive = false;
    this.killFix.push([item.ring.body, item.fix]);
    const p = egg.body.getPosition();
    const t = item.type;
    this.emit('pickup', { egg, type: t, x: p.x, y: p.y });
    if (t === 'fire') { egg.fire = POWER.fire.time; if (egg.bubbleFix) this.popBubble(egg); }
    else if (t === 'steel') this.setSteel(egg, true);
    else if (t === 'bubble') this.setBubble(egg);
    else if (t === 'twin') {
      const alive = this.eggs.filter((e) => e.alive && !e.saved).length;
      if (alive < this.maxEggs) {
        const r = Math.hypot(p.x, p.y) || 1;
        const nx = p.x - (p.x / r) * 0.32, ny = p.y - (p.y / r) * 0.32 + 0.1;
        const twin = this.addEgg(nx, ny, 1);
        twin.body.setLinearVelocity(egg.body.getLinearVelocity());
        this.emit('twin', { egg: twin, x: nx, y: ny });
      } else this.emit('twinFull', { egg });
    } else if (t === 'magnet') this.setMagnet(egg);
  }

  setSteel(egg, on) {
    egg.steel = on ? POWER.steel.time : 0;
    egg.fix.setDensity(on ? POWER.steel.mass : 1);
    egg.body.resetMassData();
    this.emit(on ? 'steelOn' : 'steelOff', { egg });
  }

  setBubble(egg) {
    if (egg.bubbleFix) { egg.bubble = POWER.bubble.time; return; }
    egg.fire = 0;
    egg.bubble = POWER.bubble.time;
    egg.bubbleFix = egg.body.createFixture({ shape: new Circle(0.38), density: 0.05, friction: 0.2, restitution: 0.5, ...filt('EGG'), userData: { kind: 'egg', egg } });
    egg.body.setLinearDamping(1.6);
    this.emit('bubbleOn', { egg });
  }

  popBubble(egg, byThorn = false) {
    if (!egg.bubbleFix) return;
    this.killFix.push([egg.body, egg.bubbleFix]);
    egg.bubbleFix = null;
    egg.bubble = 0;
    egg.safeT = 0.35;
    egg.body.setLinearDamping(this.level.water ? 1.1 : 0.02);
    const p = egg.body.getPosition();
    this.emit('bubblePop', { egg, x: p.x, y: p.y, byThorn });
  }

  setMagnet(egg) {
    if (egg.joint) { egg.joint.a.magnet = egg.joint.b.magnet = POWER.magnet.time; this.emit('magnetOn', { egg, other: egg.joint.a === egg ? egg.joint.b : egg.joint.a }); return; }
    const p = egg.body.getPosition();
    let best = null, bd = 2.6;
    for (const o of this.eggs) {
      if (o === egg || !o.alive || o.saved || o.joint) continue;
      const q = o.body.getPosition();
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < bd) { bd = d; best = o; }
    }
    if (!best) { this.emit('magnetMiss', { egg }); return; }
    const j = this.world.createJoint(new RopeJoint({ maxLength: Math.max(POWER.magnet.len, bd), collideConnected: true }, egg.body, best.body, egg.body.getPosition()));
    egg.joint = best.joint = { j, a: egg, b: best, len: POWER.magnet.len };
    egg.magnet = best.magnet = POWER.magnet.time;
    this.emit('magnetOn', { egg, other: best });
  }

  unMagnet(egg) {
    const J = egg.joint;
    if (!J) return;
    // a joint dies with either body; destroy it only while both ends still exist
    if (J.a.body && J.b.body && J.a.alive && J.b.alive && !J.dead) this.world.destroyJoint(J.j);
    J.dead = true;
    for (const e of [J.a, J.b]) if (e.joint === J) { e.joint = null; e.magnet = 0; }
    this.emit('magnetOff', { egg });
  }

  removeThorn(th, how) {
    if (!th.alive) return;
    th.alive = false;
    this.killFix.push([th.ring.body, th.fix]);
    const b = th.ring.body;
    const wp = b.getWorldPoint(Vec2(((th.base + th.tip) / 2) * Math.cos(th.a), ((th.base + th.tip) / 2) * Math.sin(th.a)));
    this.emit(how === 'burn' ? 'thornBurn' : 'thornSnap', { x: wp.x, y: wp.y, thorn: th });
    if (how === 'snap') {
      const hw = 0.11;
      this.addDebris('thorn', [{ x: -hw, y: 0 }, { x: hw, y: 0 }, { x: 0, y: th.h }], wp.x, wp.y, b.getAngle() + th.a - Math.PI / 2, (this.rand() - 0.5) * 3, 2.5, (this.rand() - 0.5) * 10, 2.2, { mat: th.ring.mat });
    }
  }

  burstVault() {
    // level-clear finale: the vault blows apart
    for (const ring of this.rings) {
      for (const s of ring.segs) {
        if (!s.alive) continue;
        if (this.rand() < 0.5) this.breakSeg(s, 'blast', true);
        else { s.alive = false; this.killFix.push([ring.body, s.fix]); }
      }
      for (const th of ring.thorns) if (th.alive) { th.alive = false; this.killFix.push([ring.body, th.fix]); }
      for (const it of ring.items) if (it.alive) { it.alive = false; this.killFix.push([ring.body, it.fix]); }
    }
    this.emit('vaultBurst', {});
  }

  breakSeg(seg, how, quiet = false) {
    if (!seg.alive) return;
    seg.alive = false;
    const ring = seg.ring, b = ring.body;
    this.killFix.push([b, seg.fix]);
    const am = (seg.a0 + seg.a1) / 2;
    const wa = b.getAngle() + am;
    const r = ring.r;
    const x = r * Math.cos(wa), y = r * Math.sin(wa);
    // thorns sitting on this segment go with it
    for (const th of ring.thorns) {
      if (th.alive && wrap(th.a - am) > seg.a0 - am - 0.02 && wrap(th.a - am) < seg.a1 - am + 0.02) this.removeThorn(th, 'snap');
    }
    const half = (seg.a1 - seg.a0) / 2;
    const ri = r - RING_TH / 2, ro = r + RING_TH / 2;
    const loc = (rad, ang) => ({ x: rad * Math.cos(ang) - r, y: rad * Math.sin(ang) });
    const verts = [loc(ri, -half), loc(ro, -half), loc(ro, half), loc(ri, half)];
    const out = how === 'blast' ? 3.5 : 0.6;
    this.addDebris(how === 'burn' ? 'char' : ring.mat, verts, x, y, wa, Math.cos(wa) * out + (this.rand() - 0.5), Math.sin(wa) * out + 1, (this.rand() - 0.5) * 6, how === 'burn' ? 1.6 : 2.8, { mat: ring.mat });
    if (!quiet) this.emit(how === 'burn' ? 'segBurn' : how === 'blast' ? 'segBlast' : 'segBreak', { x, y, mat: ring.mat });
  }

  explode(bomb) {
    bomb.alive = false;
    const p = bomb.body.getPosition();
    const R = 1.35;
    this.kill.push(bomb.body);
    this.emit('explode', { x: p.x, y: p.y, R });
    for (const ring of this.rings) {
      const a = ring.body.getAngle();
      for (const s of ring.segs) {
        if (!s.alive) continue;
        const am = a + (s.a0 + s.a1) / 2;
        if (Math.hypot(ring.r * Math.cos(am) - p.x, ring.r * Math.sin(am) - p.y) < R) this.breakSeg(s, 'blast');
      }
    }
    const push = (body, k) => {
      const q = body.getPosition();
      const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 0.01;
      if (d > R * 1.6) return d;
      const f = (1 - d / (R * 1.6)) * k * body.getMass();
      body.applyLinearImpulse(Vec2((dx / d) * f, (dy / d) * f + f * 0.3), q, true);
      return d;
    };
    for (const egg of this.eggs) {
      if (!egg.alive || egg.saved) continue;
      const d = push(egg.body, 6);
      if (d < 0.95 && egg.steel <= 0) this.crack(egg, 5);
    }
    for (const r of this.rocks) if (r.alive) push(r.body, 6);
    for (const b of this.bombs) if (b.alive && !b.lit && Math.hypot(b.body.getPosition().x - p.x, b.body.getPosition().y - p.y) < R) { b.lit = true; b.fuse = 0.25; const q = b.body.getPosition(); this.emit('bombLit', { x: q.x, y: q.y, chain: true }); }
  }

  // ---------- rewind ----------
  // Snapshots are full world states (rings, burnt/broken segments, thorns, items, eggs with their
  // power-ups and magnet ropes, bombs, rocks, nest), so a rewind is exact.
  snapshot() {
    return this.fullState();
  }

  canRewind() {
    return this.snaps.length > 0;
  }

  // Returns a new Sim holding the world as it was about `seconds` ago; the caller swaps it in.
  rewind(seconds = 5) {
    const want = this.t - seconds;
    let snap = this.snaps[0];
    for (const s of this.snaps) if (s.t <= want) snap = s;
    if (!snap) return null;
    const sim = Sim.fromState(this.level, { ...snap, state: 'play', endTimer: 0 }, this.opts);
    sim.snaps = this.snaps.filter((x) => x.t <= snap.t);
    sim.timeLeft = Math.max(this.timeLeft, snap.timeLeft);
    for (const e of sim.aliveEggs()) e.safeT = Math.max(e.safeT || 0, 0.8);
    sim.rewound = true;
    sim.emit('rewound', {});
    return sim;
  }

  // ---------- full state (planner / QA) ----------
  fullState() {
    const bodyS = (b) => { const p = b.getPosition(), v = b.getLinearVelocity(); return [p.x, p.y, b.getAngle(), v.x, v.y, b.getAngularVelocity()]; };
    return {
      t: this.t, timeLeft: this.timeLeft, state: this.state, endTimer: this.endTimer, rs: this.rs,
      savedLog: this.savedLog.map((x) => ({ ...x })), combo: this.combo, lastSaveT: this.lastSaveT, nextEggId: this.nextEggId,
      rings: this.rings.map((r) => ({ a: r.body.getAngle(), target: r.target, segs: r.segs.map((g) => [g.alive, g.hp, g.burn]), thorns: r.thorns.map((h) => [h.alive, h.ext]), items: r.items.map((i) => i.alive) })),
      eggs: this.eggs.map((e) => ({ id: e.id, alive: e.alive, saved: e.saved, cracks: e.cracks, fire: e.fire, steel: e.steel, bubble: e.bubble, golden: e.golden, crackCD: e.crackCD, safeT: e.safeT, portalCD: e.portalCD, ch: e.ch, mult: e.mult, freefall: e.freefall, comet: e.comet, cometUsed: e.cometUsed, seed: e.seed, gates: [...(e.gates || [])], magnet: e.magnet, b: e.alive && !e.saved ? bodyS(e.body) : null })),
      ropes: this.eggs.filter((e) => e.joint && e.joint.a === e && e.alive && !e.saved).map((e) => ({ a: e.id, b: e.joint.b.id, len: e.joint.len })),
      bombs: this.bombs.map((b) => ({ alive: b.alive, lit: b.lit, fuse: b.fuse, b: b.alive ? bodyS(b.body) : null })),
      rocks: this.rocks.map((r) => ({ alive: r.alive, b: bodyS(r.body) })),
      nest: bodyS(this.nest),
    };
  }

  static fromState(level, S, opts = {}) {
    const sim = new Sim(level, opts);
    const setB = (b, a) => { b.setTransform(Vec2(a[0], a[1]), a[2]); b.setLinearVelocity(Vec2(a[3], a[4])); b.setAngularVelocity(a[5]); };
    Object.assign(sim, { t: S.t, timeLeft: S.timeLeft, state: S.state, endTimer: S.endTimer, rs: S.rs, combo: S.combo, lastSaveT: S.lastSaveT, nextEggId: S.nextEggId });
    sim.savedLog = S.savedLog.map((x) => ({ ...x }));
    S.rings.forEach((rs, i) => {
      const r = sim.rings[i];
      r.body.setTransform(Vec2(0, 0), rs.a);
      r.target = rs.target;
      rs.segs.forEach(([alive, hp, burn], k) => { const g = r.segs[k]; g.hp = hp; g.burn = burn; if (!alive && g.alive) { g.alive = false; r.body.destroyFixture(g.fix); } });
      rs.thorns.forEach(([alive, ext], k) => { const h = r.thorns[k]; h.ext = ext; if (!alive && h.alive) { h.alive = false; r.body.destroyFixture(h.fix); } });
      rs.items.forEach((alive, k) => { const it = r.items[k]; if (!alive && it.alive) { it.alive = false; r.body.destroyFixture(it.fix); } });
    });
    for (const e of sim.eggs) sim.world.destroyBody(e.body);
    sim.eggs = [];
    for (const es of S.eggs) {
      if (es.b) {
        const egg = sim.addEgg(es.b[0], es.b[1], es.cracks, { golden: es.golden });
        setB(egg.body, es.b);
        Object.assign(egg, { id: es.id, fire: es.fire, crackCD: es.crackCD, safeT: es.safeT, portalCD: es.portalCD, ch: es.ch, mult: es.mult, freefall: es.freefall, comet: es.comet, cometUsed: es.cometUsed, seed: es.seed, gates: new Set(es.gates || []) });
        if (es.steel > 0) { sim.setSteel(egg, true); egg.steel = es.steel; }
        if (es.bubble > 0) { sim.setBubble(egg); egg.bubble = es.bubble; }
      } else {
        sim.eggs.push({ id: es.id, alive: es.alive, saved: es.saved, cracks: es.cracks, body: null, mult: es.mult });
      }
    }
    for (const r of S.ropes || []) {
      const a = sim.eggs.find((e) => e.id === r.a && e.body), b = sim.eggs.find((e) => e.id === r.b && e.body);
      if (!a || !b) continue;
      const j = sim.world.createJoint(new RopeJoint({ maxLength: r.len, collideConnected: true }, a.body, b.body, a.body.getPosition()));
      a.joint = b.joint = { j, a, b, len: r.len };
      a.magnet = b.magnet = S.eggs.find((e) => e.id === r.a).magnet;
    }
    sim.events.length = 0;
    S.bombs.forEach((bs, i) => { const b = sim.bombs[i]; Object.assign(b, { lit: bs.lit, fuse: bs.fuse }); if (!bs.alive) { b.alive = false; sim.world.destroyBody(b.body); } else setB(b.body, bs.b); });
    S.rocks.forEach((rs, i) => setB(sim.rocks[i].body, rs.b));
    setB(sim.nest, S.nest);
    sim.snaps = [];
    return sim;
  }

  // ---------- queries ----------
  aliveEggs() {
    return this.eggs.filter((e) => e.alive && !e.saved);
  }
  channelOf(egg) {
    const p = egg.body.getPosition();
    const d = Math.hypot(p.x, p.y);
    let c = 0;
    for (const r of this.rings) if (d > r.r) c++;
    return c; // 0 = center chamber, rings.length = outside the vault
  }
  stats() {
    const saved = this.savedLog.length;
    const broken = this.eggs.filter((e) => !e.alive && !e.saved).length;
    const score = this.savedLog.reduce((a, s) => a + s.pts, 0);
    return { saved, broken, alive: this.aliveEggs().length, target: this.level.target || 1, total: this.eggs.length, score, perfect: this.savedLog.every((s) => s.cracks === 0) && broken === 0 };
  }
}

export { EGG_H, EGG_W, RING_TH };
