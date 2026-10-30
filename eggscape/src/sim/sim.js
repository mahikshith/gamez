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
  vine: { fr: 0.95, re: 0.0, burn: true }, // v2: no 'carry up' stickiness (F23)
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

// Orb powers (F5/F13/F18/F19/F24/F25). Orbs float in the channels; an egg takes one by touching it.
export const POWER = {
  fire_red: { time: 6 }, // burns thorns only
  fire_black: { time: 3.5 }, // burns through the ring floor under the egg (and thorns)
  stone: { time: 8, mass: 4 }, // no cracks, snaps thorns, heavy
  bubble: { time: 7 },
  water: { time: 8 }, // landing impacts count half
  magnet: { time: 8, len: 0.8 },
};
export const ORB_TYPES = ['fire_red', 'fire_black', 'fire_green', 'fire_gold', 'stone', 'bubble', 'water', 'thunder', 'thorn', 'magnet', 'twin'];
export const LEGACY_ORB = { fire: 'fire_red', steel: 'stone' }; // v1 item ids (levels and saves)
const ORB_R = 0.2;

// Difficulty is the player's choice (F32). Same levels, tuned per mode.
export const MODES = {
  easy: { fuse: 1.6, nest: 0.6, nestW: 0.5, crack: 1, meteor: false, softThorns: true },
  medium: { fuse: 1, nest: 1, nestW: 0, crack: 1, meteor: true, softThorns: false },
  hard: { fuse: 0.8, nest: 1.3, nestW: 0, crack: 0.85, meteor: true, softThorns: false },
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
    this.mode = MODES[opts.mode] ? opts.mode : 'medium';
    this.MD = MODES[this.mode];
    this.crackV = CRACK_V * this.MD.crack;
    this.golden = opts.golden || false;
    // start boosters (store): opts.stone, opts.time (+15 s), opts.sponge (pad under the first drop)
    this.timeLimit = level.time ? Math.round(level.time * this.MD.fuse) + (opts.time ? 15 : 0) : 0;
    this.orbs = [];
    this.embers = [];
    this.snake = null;
    this.turns = 0; // player ring turns (bonus objective C3)
    this.orbsTaken = 0;
    this.weather = level.weather || null;
    this.wx = { next: 4 + (level.seed || 7) % 3, bolt: null, quake: 0, qk: 0, ember: 1.5 };
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
    for (const ring of this.rings) if (ring.spec.gear != null && this.rings[ring.spec.gear]) { ring.gear = this.rings[ring.spec.gear]; ring.gear.gear = ring; }

    // nest + ground
    const n = L.nest || {};
    this.nestW = (n.w || 1.9) + this.MD.nestW;
    this.nestPattern = n.pattern || 'sine';
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
    for (let i = 0; i < n0; i++) {
      const egg = this.addEgg(spots[i][0] * (this.rings[0].r / 1.05), spots[i][1] * (this.rings[0].r / 1.05), 0, i === 0 && this.golden ? { golden: 1 } : {});
      if (i === n0 - 1 && L.bonus && L.bonus.kind === 'prize') egg.prize = 1;
      if (i === 0 && this.opts.stone) this.setStone(egg, true);
    }

    // portals sit on channel floors; with `emit` they spit out an orb every `every` seconds
    for (const p of L.portals || []) {
      this.portals.push({ ax: p.a[0], ay: p.a[1], bx: p.b[0], by: p.b[1], r: 0.3, emit: p.emit || null, every: p.every || 8, timer: (p.every || 8) * 0.4, k: 0 });
    }
    // floating orbs: level orbs, plus v1 ring items (they used to be pinned to the ring)
    for (const o of L.orbs || []) this.addOrb(o.type, o.ch, deg(o.a ?? 90), 'start');
    for (const ring of this.rings) for (const it of ring.spec.items || []) this.addOrb(it.type, ring.i, deg(it.a) + ring.body.getAngle(), 'start');
    this.orbsStart = this.orbs.length;
    if (L.snake) {
      const S = L.snake;
      this.snake = { rad: this.outerR + 1.0, a: Math.PI / 2 + deg(S.a || 0), speed: S.speed || 0.55, wait: S.delay ?? 3, len: S.len || 1.7, pts: [], mouthOpen: 0, eaten: 0, inside: false };
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
      gaps: (spec.gaps || []).map((g) => ({ a: deg(g.a), len: g.len || 0.78, x: g.x || 1, shut: g.shut || null, o: 1 })),
      segs: [], thorns: [],
      honey: (spec.honey || []).map((h) => ({ a: deg(h.a), len: h.len, dry: 0 })),
      retract: spec.retract || null,
      held: false, omega: 0, stun: 0, gear: null,
    };
    const fr = this.level.weather === 'rain' ? 0.55 : 1; // rain: slippery rings
    const ri = r - RING_TH / 2, ro = r + RING_TH / 2;
    for (const [a0, a1] of solidArcs(r, ring.gaps)) {
      const n = Math.max(1, Math.ceil(((a1 - a0) * r) / 0.2));
      for (let k = 0; k < n; k++) {
        const b0 = a0 + ((a1 - a0) * k) / n, b1 = a0 + ((a1 - a0) * (k + 1)) / n;
        const seg = { a0: b0, a1: b1, alive: true, hp: M.hp || 0, burn: 0, hitCD: 0, ring, pad: false, press: 0, hitT: -9, hitV: 0 };
        const mid = (b0 + b1) / 2;
        const pads = this.opts.sponge && i === Math.min(1, this.level.rings.length - 1) ? [...(spec.pads || []), { a: -90 - (spec.angle || 0), len: 1.3 }] : spec.pads || [];
        for (const pd of pads) if (Math.abs(wrap(mid - deg(pd.a))) < pd.len / (2 * r)) seg.pad = true;
        for (const h of ring.honey) if (Math.abs(wrap(mid - h.a)) < h.len / (2 * r)) { seg.honey = h; seg.pad = false; }
        const soft = seg.pad || seg.honey;
        seg.fix = body.createFixture({
          shape: new Polygon([Vec2(ri * Math.cos(b0), ri * Math.sin(b0)), Vec2(ro * Math.cos(b0), ro * Math.sin(b0)), Vec2(ro * Math.cos(b1), ro * Math.sin(b1)), Vec2(ri * Math.cos(b1), ri * Math.sin(b1))]),
          friction: soft ? 0.95 : M.fr * fr, restitution: soft ? 0.02 : M.re, ...filt('RING'), userData: { kind: 'seg', seg },
        });
        ring.segs.push(seg);
      }
    }
    // gap shutters (F15c): sliding doors that close the gap on a timer; contacts with them are
    // switched off in preSolve while the door is open
    for (const g of ring.gaps) {
      if (!g.shut) continue;
      const half = g.len / (2 * r), n = Math.max(2, Math.ceil(g.len / 0.2));
      for (let k = 0; k < n; k++) {
        const b0 = g.a - half + (2 * half * k) / n, b1 = g.a - half + (2 * half * (k + 1)) / n;
        body.createFixture({
          shape: new Polygon([Vec2(ri * Math.cos(b0), ri * Math.sin(b0)), Vec2(ro * Math.cos(b0), ro * Math.sin(b0)), Vec2(ro * Math.cos(b1), ro * Math.sin(b1)), Vec2(ri * Math.cos(b1), ri * Math.sin(b1))]),
          friction: M.fr, restitution: M.re, ...filt('RING'), userData: { kind: 'shut', gap: g },
        });
      }
    }
    for (const th of spec.thorns || []) {
      const count = th.n || 1;
      for (let k = 0; k < count; k++) {
        const a = deg(th.a + (k - (count - 1) / 2) * (th.spread || 11));
        this.addThorn(ring, a, th.side || 'in', th.h || 0.24, th.kind);
      }
    }
    return ring;
  }

  // kind: 'hook' (sharp red, breaks the egg) or 'blunt' (grey spike, cracks only) (F22)
  addThorn(ring, a, side, h, kind = 'hook') {
    const r = ring.r, half = 0.13 / r;
    const base = side === 'in' ? r - RING_TH / 2 + 0.03 : r + RING_TH / 2 - 0.03;
    const tip = side === 'in' ? base - h : base + h;
    const p = (rad, ang) => Vec2(rad * Math.cos(ang), rad * Math.sin(ang));
    const thorn = { a, side, h, base, tip, alive: true, ring, ext: 1, kind, key: ring.i * 1000 + ring.thorns.length };
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
      fire: 0, fireKind: null, stone: 0, bubble: 0, bubbleFix: null, magnet: 0, joint: null, golden: extra.golden || 0,
      water: 0, zap: 0, glow: 0, chick: 0, meteor: 0, honey: 0, hold: null, honeyCD: 0, prize: 0, spk: new Set(), // spk: blunt spikes touching now
      crackCD: 0, nestT: 0, inNest: 0, safeT: this.t < 0.5 ? 1.5 : 0, portalCD: 0, born: this.t,
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

  // A floating orb in channel ch at angle a: it sways through the low part of the channel (where
  // eggs roll) and sinks there from wherever it starts, so falling or resting eggs can always reach it.
  addOrb(type, ch, a, src = 'start', rad = null) {
    const n = this.rings.length;
    ch = clamp(ch, 0, n - 1);
    const body = this.world.createBody({ type: 'kinematic', position: Vec2(0, 0) });
    const orb = { type: LEGACY_ORB[type] || type, ch, a, rad: rad ?? this.orbFloor(ch) - 0.25, ph: this.rand() * TAU, sway: 0.7 + 0.6 * this.rand(), src, alive: true, body, x: 0, y: 0 };
    body.createFixture({ shape: new Circle(ORB_R), isSensor: true, ...filt('ITEM'), userData: { kind: 'orb', orb } });
    this.moveOrb(orb, 0);
    this.orbs.push(orb);
    return orb;
  }
  orbFloor(ch) {
    return this.rings[ch].r - RING_TH / 2 - 0.3;
  }
  moveOrb(orb, dt) {
    const floor = this.orbFloor(orb.ch);
    const lo = orb.ch ? this.rings[orb.ch - 1].r + RING_TH / 2 + 0.22 : 0;
    const A = Math.min(1.0, 1.5 / Math.max(floor, 0.6)); // sway of about 1.5 m of arc
    const want = -Math.PI / 2 + A * Math.sin(this.t * 0.3 * orb.sway + orb.ph);
    // far from the low band (spawned high up) it sinks quickly; inside it, it sways slowly
    const sp = (Math.abs(wrap(want - orb.a)) > A + 0.25 ? 1.1 : 0.4) * dt / Math.max(orb.rad, 0.3);
    orb.a += clamp(wrap(want - orb.a), -sp, sp);
    orb.rad += clamp(Math.max(lo, floor - 0.04 + 0.05 * Math.sin(this.t * 2.1 + orb.ph)) - orb.rad, -0.3 * dt, 0.3 * dt);
    orb.x = orb.rad * Math.cos(orb.a);
    orb.y = orb.rad * Math.sin(orb.a);
    orb.body.setTransform(Vec2(orb.x, orb.y), 0);
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
      if (ring.stun > 0) {
        // a zapped ring locks up
        ring.stun -= dt;
        w = 0;
        ring.target = a;
      } else if (ring.motor) {
        w = ring.motor;
        if (ring.motorFlip) w *= Math.floor(this.t / ring.motorFlip) % 2 ? -1 : 1;
      } else {
        const lim = this.maxOmega(ring);
        // keep the target from running away from the ring
        ring.target = a + clamp(ring.target - a, -0.7, 0.7);
        w = clamp((ring.target - a) * 14, -lim, lim);
      }
      ring.omega = w;
      ring.follower = false;
    }
    // geared pairs (F15d): the ring being driven turns its partner the other way, at the slower
    // ring's speed; a locked ring locks its partner
    for (const ring of this.rings) {
      const o = ring.gear;
      if (!o || o.i < ring.i) continue;
      const drive = Math.abs(ring.target - ring.body.getAngle()) >= Math.abs(o.target - o.body.getAngle()) ? ring : o;
      const other = drive === ring ? o : ring;
      const lim = ring.stun > 0 || o.stun > 0 ? 0 : Math.min(this.maxOmega(ring), this.maxOmega(o));
      drive.omega = clamp(drive.omega, -lim, lim);
      other.omega = -drive.omega;
      other.target = other.body.getAngle() + other.omega * dt;
      other.follower = true;
    }
    for (const ring of this.rings) {
      ring.body.setAngularVelocity(ring.omega);
      const moving = !ring.motor && !ring.follower && Math.abs(ring.omega) > 0.25;
      if (moving && !ring.moving) this.turns++;
      ring.moving = moving;
      if (ring.retract) {
        const { period, on, phase = 0 } = ring.retract;
        const ph = (((this.t + phase) % period) + period) % period / period;
        const want = ph < on ? 1 : 0;
        for (const th of ring.thorns) th.ext += clamp(want - th.ext, -dt * 5, dt * 5);
      }
      for (const g of ring.gaps) {
        if (!g.shut) continue;
        const { period, open, phase = 0 } = g.shut;
        const want = ((((this.t + phase) % period) + period) % period) / period < open ? 1 : 0;
        g.o += clamp(want - g.o, -dt * 2.5, dt * 2.5);
      }
      for (const h of ring.honey) if (h.dry > 0) h.dry -= dt;
      for (const s of ring.segs) if (s.hitCD > 0) s.hitCD -= dt;
    }

    // nest motion
    if (this.nestAmp) {
      const cur = this.nest.getPosition().x;
      this.nest.setLinearVelocity(Vec2((this.nestXAt(this.t) - cur) / dt, 0));
    }

    // wind gusts, or a steady underwater current
    if (L.wind) {
      const { strength, period = 5 } = L.wind;
      const s = Math.sin((this.t * TAU) / period);
      this.wind = strength * Math.sign(s) * Math.min(1, Math.abs(s) * 2.2);
    } else if (this.weather === 'current') this.wind = L.weatherOpts?.strength ?? 1.4;

    for (const egg of this.eggs) {
      if (!egg.alive || egg.saved) continue;
      const b = egg.body;
      egg.impact = 0;
      if (egg.crackCD > 0) egg.crackCD -= dt;
      if (egg.safeT > 0) egg.safeT -= dt;
      if (egg.portalCD > 0) egg.portalCD -= dt;
      if (egg.water > 0) egg.water -= dt;
      if (egg.glow > 0) egg.glow -= dt;
      if (egg.honeyCD > 0) egg.honeyCD -= dt;
      if (egg.fire > 0 && (egg.fire -= dt) <= 0) { egg.fire = 0; egg.fireKind = null; this.emit('fireOut', { egg }); }
      if (egg.stone > 0 && (egg.stone -= dt) <= 0) this.setStone(egg, false);
      if (egg.bubble > 0) {
        b.applyForceToCenter(Vec2(0, b.getMass() * this.g * 1.1), true);
        if ((egg.bubble -= dt) <= 0) this.popBubble(egg);
      }
      // a chick flutters: most of its weight is carried by its wings
      if (egg.chick) b.applyForceToCenter(Vec2(0, b.getMass() * this.g * 0.6), true);
      if (egg.magnet > 0 && (egg.magnet -= dt) <= 0) this.unMagnet(egg);
      if (this.wind) b.applyForceToCenter(Vec2(this.wind * b.getMass() * (egg.bubble > 0 ? 2.2 : 1), 0), true);
      // honey pad (F24): the egg rides with the pad until the honey lets go
      if (egg.honey > 0 && egg.hold) {
        const H = egg.hold, rb = this.rings[H.ri].body;
        const wp = rb.getWorldPoint(Vec2(H.x, H.y));
        b.setTransform(wp, rb.getAngle() + H.a);
        b.setLinearVelocity(rb.getLinearVelocityFromWorldPoint(wp));
        b.setAngularVelocity(rb.getAngularVelocity());
        if ((egg.honey -= dt) <= 0) {
          egg.honey = 0;
          egg.hold = null;
          egg.honeyCD = 1.2;
          this.emit('honeyOff', { egg, x: wp.x, y: wp.y });
        }
      }
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

    for (const o of this.orbs) if (o.alive) this.moveOrb(o, dt);
    this.portals.forEach((pt, i) => {
      if (!pt.emit || !pt.emit.length || (pt.timer -= dt) > 0) return;
      pt.timer = pt.every;
      const src = 'p' + i;
      if (this.orbs.filter((o) => o.alive && o.src === src).length >= 2) return;
      const ch = this.chAt(Math.hypot(pt.bx, pt.by));
      if (ch >= this.rings.length) return;
      const type = pt.emit[pt.k++ % pt.emit.length];
      const o = this.addOrb(type, ch, Math.atan2(pt.by, pt.bx), src, Math.hypot(pt.bx, pt.by));
      this.emit('orbSpawn', { power: type, x: o.x, y: o.y });
    });
    if (this.snake) this.snakeStep(dt);
    if (this.weather && this.state === 'play') this.weatherStep(dt);

    this.world.step(dt, 8, 3);
    this.afterStep(dt);
  }

  nestXAt(t) {
    const ph = (t * this.MD.nest) / this.nestPeriod; // cycles
    const A = this.nestAmp, x0 = this.nestX0;
    const s = (u) => u * u * (3 - 2 * u);
    switch (this.nestPattern) {
      case 'slide': { // constant speed, end to end
        const f = (ph + 0.25) % 1;
        return x0 + A * (f < 0.5 ? 4 * f - 1 : 3 - 4 * f);
      }
      case 'stopgo': { // glide to an end, wait there, glide back
        const f = (ph + 0.15) % 1;
        return x0 + A * (f < 0.3 ? -1 + 2 * s(f / 0.3) : f < 0.5 ? 1 : f < 0.8 ? 1 - 2 * s((f - 0.5) / 0.3) : -1);
      }
      case 'speedup': // faster as the fuse burns down
        return x0 + A * Math.sin(TAU * ph * (1 + t / 90));
      default:
        return x0 + A * Math.sin(TAU * ph);
    }
  }

  afterStep(dt) {
    for (let i = 0; i < this.later.length; i++) this.later[i]();
    this.later.length = 0;
    // impacts collected in post-solve
    for (const egg of this.eggs) {
      if (!egg.alive || egg.saved) continue;
      const v = egg.impact * (egg.water > 0 ? 0.5 : 1); // water shell: landings count half
      if (v > 0.6) this.emit('bump', { egg, v });
      const soft = egg.inNest > 0 ? NEST_SOFT : 1;
      if (egg.meteor && v > 1.2) {
        // meteor rule (F15a): a fall through 3+ rings cracks on landing, even in the nest
        egg.meteor = 0;
        egg.comet = 0;
        const p = egg.body.getPosition();
        this.emit('meteorLand', { egg, x: p.x, y: p.y });
        if (v >= SHATTER_V * soft && egg.stone <= 0) this.breakEgg(egg, 'impact');
        else this.crack(egg, v, 'meteor');
      } else if (egg.stone > 0 || egg.safeT > 0 || egg.chick || egg.honey > 0) { /* immune */ }
      else if (egg.comet && v >= this.crackV * soft) { egg.comet = 0; egg.safeT = 0.15; this.emit('cometLand', { egg, x: egg.body.getPosition().x, y: egg.body.getPosition().y }); }
      else if (v >= SHATTER_V * soft) this.breakEgg(egg, 'impact');
      else if (v >= this.crackV * soft && egg.crackCD <= 0) this.crack(egg, v);
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
    if (ua.kind === 'shut' || ub.kind === 'shut') {
      if ((ua.kind === 'shut' ? ua : ub).gap.o > 0.5) { c.setEnabled(false); return; }
    }
    if (other && other.kind === 'thorn' && other.thorn.ext < 0.5) { c.setEnabled(false); return; }
    if (!egg || !egg.alive || egg.saved) return;
    if (other.kind === 'thorn') {
      const th = other.thorn;
      if (!th.alive) { c.setEnabled(false); return; }
      if (egg.fire > 0) { this.defer(() => this.removeThorn(th, 'burn')); c.setEnabled(false); return; }
      if (egg.comet) { egg.comet = 0; this.defer(() => this.removeThorn(th, 'snap')); egg.safeT = 0.2; c.setEnabled(false); return; }
      if (egg.stone > 0) { this.emit('stoneHit', { egg }); this.defer(() => this.removeThorn(th, 'snap')); c.setEnabled(false); return; }
      if (egg.bubbleFix) { if (!egg.popping) { egg.popping = true; egg.safeT = 0.4; this.defer(() => { egg.popping = false; this.popBubble(egg, true); }); } c.setEnabled(false); return; }
      if (egg.golden) { egg.golden = 0; egg.safeT = 0.6; this.defer(() => this.removeThorn(th, 'snap')); this.emit('goldenSave', { egg }); c.setEnabled(false); return; }
      if (egg.safeT > 0) return;
      // blunt spikes (and every thorn on Easy) only crack, and stay solid; a chick has no shell
      if ((th.kind === 'blunt' || this.MD.softThorns) && !egg.chick) {
        // one crack per touch (never the breaking one), and the spike shoves the egg off
        if (!egg.spk.has(th.key)) {
          egg.spk.add(th.key);
          this.defer(() => {
            if (!egg.alive || egg.saved) return;
            if (egg.cracks < 2) this.crack(egg, 0, 'spike'); // blunt: cracks, never breaks
            const b = egg.body, p = b.getPosition(), t = th.ring.body.getWorldPoint(Vec2(th.tip * Math.cos(th.a), th.tip * Math.sin(th.a)));
            const dx = p.x - t.x, dy = p.y - t.y, d = Math.hypot(dx, dy) || 1, m = b.getMass() * 1.6;
            b.applyLinearImpulse(Vec2((dx / d) * m, (dy / d) * m), p, true);
          });
        }
        return;
      }
      egg.safeT = 1; // one break only
      this.defer(() => { egg.safeT = 0; this.breakEgg(egg, 'thorn'); });
      c.setEnabled(false);
    } else if (other.kind === 'seg') {
      const seg = other.seg;
      egg.freefall = 0;
      // black fire burns through whatever ring floor the egg rests on; red fire never burns rings
      if (egg.fireKind === 'fire_black' && egg.fire > 0 && seg.alive) {
        seg.burn += DT;
        if (seg.burn > 0.45 && !seg.dying) { seg.dying = true; this.defer(() => this.breakSeg(seg, 'burn')); }
      }
      if (egg.zap) {
        // thunder ball: the first ring the egg touches is stunned
        egg.zap = 0;
        seg.ring.stun = 2;
        const p = egg.body.getPosition();
        this.emit('zap', { egg, ring: seg.ring.i, x: p.x, y: p.y });
      }
      const h = seg.honey;
      if (h && seg.alive && egg.honey <= 0 && egg.honeyCD <= 0 && h.dry <= 0) {
        h.dry = 3.5; // the pad holds one egg, then needs a moment
        egg.honey = 2;
        this.defer(() => {
          if (!egg.alive || egg.saved) { egg.honey = 0; return; }
          const rb = seg.ring.body, lp = rb.getLocalPoint(egg.body.getPosition());
          egg.hold = { ri: seg.ring.i, x: lp.x, y: lp.y, a: egg.body.getAngle() - rb.getAngle(), pad: seg.ring.honey.indexOf(h) };
          this.emit('honey', { egg, x: egg.body.getPosition().x, y: egg.body.getPosition().y });
        });
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
    if ((p = pair('egg', 'orb'))) {
      const orb = p[1].orb, egg = p[0].egg;
      if (orb.alive && egg.alive && !orb.taken) { orb.taken = true; this.defer(() => this.takeOrb(egg, orb)); }
    } else if ((p = pair('egg', 'ground'))) {
      const egg = p[0].egg;
      if (egg.alive && !egg.saved) this.defer(() => this.breakEgg(egg, this.level.lava ? 'lava' : 'ground'));
    } else if ((p = pair('egg', 'nestIn'))) {
      p[0].egg.inNest++;
    } else if ((p = pair('egg', 'egg'))) {
      const a = p[0].egg, b = p[1].egg;
      if (a.fire > 0 && b.fire <= 0 && b.stone <= 0) this.emit('scorch', { egg: b });
    } else if ((p = pair('bomb', 'ground'))) {
      /* fine */
    }
  }

  endContact(c) {
    const [, , ua, ub] = this.parts(c);
    if (ua.kind === 'egg' && ub.kind === 'thorn') ua.egg.spk.delete(ub.thorn.key);
    if (ub.kind === 'egg' && ua.kind === 'thorn') ub.egg.spk.delete(ua.thorn.key);
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
    if (egg.freefall >= 3 && this.MD.meteor && !egg.meteor && !egg.chick) {
      egg.meteor = 1;
      egg.comet = 0;
      egg.cometUsed = 'meteor'; // no Comet double score either
      this.emit('meteor', { egg, x: p.x, y: p.y });
    }
  }

  crack(egg, v, why = 'impact') {
    if (!egg.alive || egg.saved || egg.chick || egg.stone > 0) return; // a chick never cracks; stone takes it
    egg.cracks++;
    egg.crackCD = CRACK_COOLDOWN;
    const p = egg.body.getPosition();
    if (egg.cracks >= 3) this.breakEgg(egg, why === 'impact' || why === 'meteor' ? 'impact' : why);
    else this.emit('crack', { egg, v, why, x: p.x, y: p.y });
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
    const pts = 100 * egg.mult * (perfect ? 2 : 1) * (egg.cometUsed === true ? 2 : 1) * this.combo;
    this.savedLog.push({ id: egg.id, t: this.t, cracks: egg.cracks, pts, mult: egg.mult, combo: this.combo, prize: egg.prize, chick: egg.chick });
    this.emit('save', { egg, x: p.x, y: p.y, n: this.savedLog.length, pts, perfect, combo: this.combo, mult: egg.mult });
    if (egg.joint) this.unMagnet(egg);
    this.kill.push(egg.body);
  }

  takeOrb(egg, orb) {
    if (!orb.alive) return;
    orb.alive = false;
    this.kill.push(orb.body);
    if (!egg.alive || egg.saved) return;
    if (orb.src === 'start') this.orbsTaken++;
    const p = egg.body.getPosition();
    const t = orb.type;
    this.emit('pickup', { egg, power: t, x: p.x, y: p.y });
    if (t === 'fire_red' || t === 'fire_black') { egg.fire = POWER[t].time; egg.fireKind = t; if (egg.bubbleFix) this.popBubble(egg); }
    else if (t === 'fire_green') { egg.glow = 1.5; if (egg.cracks > 0) { egg.cracks--; this.emit('mend', { egg, x: p.x, y: p.y }); } }
    else if (t === 'fire_gold') this.hatch(egg);
    else if (t === 'stone') this.setStone(egg, true);
    else if (t === 'bubble') this.setBubble(egg);
    else if (t === 'water') egg.water = POWER.water.time;
    else if (t === 'thunder') { egg.zap = 1; this.crack(egg, 0, 'zap'); }
    else if (t === 'thorn') this.crack(egg, 0, 'thornball');
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

  setStone(egg, on) {
    egg.stone = on ? POWER.stone.time : 0;
    egg.fix.setDensity(on ? POWER.stone.mass : 1);
    egg.body.resetMassData();
    this.emit(on ? 'stoneOn' : 'stoneOff', { egg });
  }

  // gold flame (F25): the egg hatches into a chick. It flutters (slow fall, strong drag), never
  // cracks, still dies on thorns, and counts as saved in the nest.
  hatch(egg, quiet = false) {
    egg.chick = 1;
    egg.fire = 0;
    egg.fireKind = null;
    egg.comet = egg.meteor = 0;
    egg.body.setLinearDamping(this.damping(egg));
    egg.body.setFixedRotation(true);
    egg.body.setTransform(egg.body.getPosition(), 0);
    if (!quiet) { const p = egg.body.getPosition(); this.emit('hatch', { egg, x: p.x, y: p.y }); }
  }

  damping(egg) {
    return egg.chick ? 2.2 : this.level.water ? 1.1 : 0.02;
  }

  setBubble(egg) {
    if (egg.bubbleFix) { egg.bubble = POWER.bubble.time; return; }
    egg.fire = 0;
    egg.fireKind = null;
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
    egg.body.setLinearDamping(this.damping(egg));
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
    }
    for (const o of this.orbs) if (o.alive) { o.alive = false; this.kill.push(o.body); }
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
      if (egg.honey > 0) { egg.honey = 0; egg.hold = null; egg.honeyCD = 1; } // the blast tears it off the pad
      const d = push(egg.body, 9);
      if (d < 1.0) this.crack(egg, 5, 'blast');
    }
    for (const r of this.rocks) if (r.alive) push(r.body, 6);
    for (const b of this.bombs) if (b.alive && !b.lit && Math.hypot(b.body.getPosition().x - p.x, b.body.getPosition().y - p.y) < R) { b.lit = true; b.fuse = 0.25; const q = b.body.getPosition(); this.emit('bombLit', { x: q.x, y: q.y, chain: true }); }
  }

  // ---------- snake (F26) ----------
  // Enters from above the vault and heads for the nearest egg inside it at a steady speed. It moves
  // along channels and can cross a ring only through an open gap lined up with its head, so turning
  // rings holds it back. Its body is the trail of its head (world points, head first).
  snakeStep(dt) {
    const S = this.snake, n = this.rings.length;
    S.mouthOpen = Math.max(0, S.mouthOpen - dt * 1.5);
    if (S.wait > 0) { S.wait -= dt; return; }
    if (!S.inside) { S.inside = true; this.emit('snakeIn', {}); }
    const hc = this.chAt(S.rad);
    const hx = S.rad * Math.cos(S.a), hy = S.rad * Math.sin(S.a);
    let egg = null, best = 1e9;
    for (const e of this.aliveEggs()) {
      const c = this.channelOf(e);
      if (c >= n) continue; // falling to the nest: out of reach
      const p = e.body.getPosition();
      const d = Math.abs(c - hc) * 10 + Math.abs(wrap(Math.atan2(p.y, p.x) - S.a));
      if (d < best) { best = d; egg = e; }
    }
    const mid = (c) => (c >= n ? this.outerR + 0.35 : c === 0 ? this.rings[0].r * 0.45 : (this.rings[c - 1].r + this.rings[c].r) / 2);
    const lo = hc > 0 ? this.rings[hc - 1].r + 0.2 : 0, hi = hc < n ? this.rings[hc].r - 0.2 : 1e9;
    let ga = S.a + 0.6, gr = mid(hc); // nothing to hunt: slither along the channel
    if (egg) {
      const p = egg.body.getPosition(), ec = this.channelOf(egg);
      if (ec === hc) {
        ga = Math.atan2(p.y, p.x);
        gr = clamp(Math.hypot(p.x, p.y), lo, hi);
        const d = Math.hypot(p.x - hx, p.y - hy);
        S.mouthOpen = Math.max(S.mouthOpen, clamp(1.4 - d, 0, 1));
        if (d < 0.42) {
          if (egg.stone > 0) { S.wait = 1; this.emit('snakeRecoil', { x: p.x, y: p.y }); }
          else { this.breakEgg(egg, 'snake'); S.eaten++; S.mouthOpen = 1; S.wait = 1.4; this.emit('snakeEat', { x: p.x, y: p.y }); }
          return;
        }
      } else {
        const ring = this.rings[ec < hc ? hc - 1 : hc], ra = ring.body.getAngle();
        let gap = null, gd = 1e9;
        for (const g of ring.gaps) {
          if (g.shut && g.o < 0.5) continue;
          const d = Math.abs(wrap(ra + g.a - S.a));
          if (d < gd) { gd = d; gap = g; }
        }
        gr = clamp(mid(hc), lo, hi);
        if (gap) {
          ga = ra + gap.a;
          // through only while the gap lines up with the head; otherwise back into the channel
          if (gd < (gap.len - 0.22) / (2 * ring.r)) gr = ec < hc ? ring.r - 0.3 : ring.r + 0.3;
        } else ga = S.a; // no way through: wait
      }
    }
    const sp = S.speed * dt;
    S.rad += clamp(gr - S.rad, -sp, sp);
    S.a += clamp(wrap(ga - S.a), -sp / Math.max(S.rad, 0.3), sp / Math.max(S.rad, 0.3));
    const x = S.rad * Math.cos(S.a), y = S.rad * Math.sin(S.a);
    const T = S.pts;
    if (T.length < 2 || Math.hypot(T[1].x - x, T[1].y - y) > 0.05) T.unshift({ x, y });
    else { T[0].x = x; T[0].y = y; }
    if (T.length > Math.ceil(S.len / 0.05) + 1) T.length = Math.ceil(S.len / 0.05) + 1;
  }

  // ---------- weather (F6) ----------
  weatherStep(dt) {
    const X = this.wx, W = this.weather;
    if (W === 'thunder') {
      // a bolt picks a ring segment, flickers there for a second (fair warning), then strikes
      if (X.bolt) {
        if ((X.bolt.t -= dt) <= 0) this.strike(X.bolt);
      } else if ((X.next -= dt) <= 0) {
        X.next = 6 + this.rand() * 5;
        const ri = Math.floor(this.rand() * this.rings.length), ring = this.rings[ri];
        const alive = ring.segs.filter((g) => g.alive);
        if (alive.length) {
          X.bolt = { ri, si: ring.segs.indexOf(alive[Math.floor(this.rand() * alive.length)]), t: 1.1 };
          const p = this.boltPoint(X.bolt);
          this.emit('lightningWarn', { x: p.x, y: p.y, ring: ri });
        }
      }
    } else if (W === 'quake') {
      if (X.quake > 0) {
        X.quake -= dt;
        if ((X.qk -= dt) <= 0) {
          X.qk = 0.12;
          for (const e of this.aliveEggs()) if (e.honey <= 0) { const m = e.body.getMass(); e.body.applyLinearImpulse(Vec2((this.rand() - 0.5) * 1.2 * m, this.rand() * 0.6 * m), e.body.getPosition(), true); }
          for (const r of this.rocks) if (r.alive) { const m = r.body.getMass(); r.body.applyLinearImpulse(Vec2((this.rand() - 0.5) * 1.2 * m, this.rand() * 0.6 * m), r.body.getPosition(), true); }
        }
      } else if ((X.next -= dt) <= 0) {
        X.next = 7 + this.rand() * 2;
        X.quake = 1;
        X.qk = 0;
        this.emit('quake', { dur: 1 });
      }
    } else if (W === 'embers') {
      // embers drift down from above; rings shield the eggs, gaps let embers through
      if ((X.ember -= dt) <= 0) {
        X.ember = 1.1 + this.rand() * 1.2;
        this.embers.push({ x: (this.rand() * 2 - 1) * this.outerR * 0.9, y: this.outerR + 0.8, vx: (this.rand() - 0.5) * 0.4, vy: -1.1 });
      }
      for (let i = this.embers.length - 1; i >= 0; i--) {
        const m = this.embers[i];
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        let gone = m.y < this.groundY;
        const d = Math.hypot(m.x, m.y);
        for (const ring of this.rings) if (!gone && Math.abs(d - ring.r) < RING_TH / 2 + 0.04 && this.solidAt(ring, m.x, m.y)) { gone = true; this.emit('emberFizz', { x: m.x, y: m.y }); }
        for (const e of this.aliveEggs()) {
          if (gone) break;
          const p = e.body.getPosition();
          if (Math.hypot(p.x - m.x, p.y - m.y) < 0.32) { gone = true; this.emit('emberHit', { x: m.x, y: m.y, egg: e }); this.crack(e, 0, 'ember'); }
        }
        if (gone) this.embers.splice(i, 1);
      }
    }
  }

  boltPoint(B) {
    const ring = this.rings[B.ri], g = ring.segs[B.si];
    const a = ring.body.getAngle() + (g.a0 + g.a1) / 2;
    return { x: ring.r * Math.cos(a), y: ring.r * Math.sin(a) };
  }

  strike(B) {
    this.wx.bolt = null;
    const ring = this.rings[B.ri], p = this.boltPoint(B);
    ring.stun = Math.max(ring.stun, 1.5);
    this.emit('lightning', { x: p.x, y: p.y, ring: B.ri });
    for (const e of this.aliveEggs()) {
      const q = e.body.getPosition();
      if (Math.hypot(q.x - p.x, q.y - p.y) < 0.6) this.crack(e, 0, 'lightning');
    }
  }

  // Is there solid ring (a live segment or a closed shutter) at this world point's angle?
  solidAt(ring, x, y) {
    let la = Math.atan2(y, x) - ring.body.getAngle();
    la = ((la % TAU) + TAU) % TAU;
    for (const g of ring.segs) if (g.alive && ((la >= g.a0 && la < g.a1) || (la + TAU >= g.a0 && la + TAU < g.a1))) return true;
    for (const g of ring.gaps) if (g.shut && g.o < 0.5 && Math.abs(wrap(la - g.a)) < g.len / (2 * ring.r)) return true;
    return false;
  }

  // bonus objective (C3): level.bonus {kind:'turns', n} | {kind:'prize'} | {kind:'orbs'} | {kind:'time', s}
  bonusMet() {
    const B = this.level.bonus;
    if (!B || this.state !== 'won') return false;
    if (B.kind === 'turns') return this.turns <= B.n;
    if (B.kind === 'prize') return this.savedLog.some((s) => s.prize);
    if (B.kind === 'orbs') return this.orbsTaken >= this.orbsStart;
    if (B.kind === 'time') return this.timeLimit - this.timeLeft <= B.s * this.MD.fuse;
    return false;
  }

  // ---------- rewind ----------
  // Snapshots are full world states (rings, burnt/broken segments, thorns, shutters, honey, eggs with
  // their powers and magnet ropes, orbs, bombs, rocks, snake, weather, nest), so a rewind is exact.
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

  // ---------- full state (planner / QA / rewind) ----------
  fullState() {
    const bodyS = (b) => { const p = b.getPosition(), v = b.getLinearVelocity(); return [p.x, p.y, b.getAngle(), v.x, v.y, b.getAngularVelocity()]; };
    const EGG_KEYS = ['id', 'alive', 'saved', 'cracks', 'fire', 'fireKind', 'stone', 'bubble', 'golden', 'crackCD', 'safeT', 'portalCD', 'ch', 'mult', 'freefall', 'comet', 'cometUsed', 'seed', 'magnet', 'water', 'zap', 'glow', 'chick', 'meteor', 'honey', 'honeyCD', 'prize'];
    return {
      t: this.t, timeLeft: this.timeLeft, state: this.state, endTimer: this.endTimer, rs: this.rs, mode: this.mode,
      savedLog: this.savedLog.map((x) => ({ ...x })), combo: this.combo, lastSaveT: this.lastSaveT, nextEggId: this.nextEggId,
      turns: this.turns, orbsTaken: this.orbsTaken, orbsStart: this.orbsStart,
      rings: this.rings.map((r) => ({ a: r.body.getAngle(), target: r.target, stun: r.stun, moving: r.moving, segs: r.segs.map((g) => [g.alive, g.hp, g.burn]), thorns: r.thorns.map((h) => [h.alive, h.ext]), gaps: r.gaps.map((g) => g.o), honey: r.honey.map((h) => h.dry) })),
      eggs: this.eggs.map((e) => {
        const o = {};
        for (const k of EGG_KEYS) o[k] = e[k];
        o.gates = [...(e.gates || [])];
        o.spk = [...(e.spk || [])];
        o.hold = e.hold ? { ...e.hold } : null;
        o.b = e.alive && !e.saved ? bodyS(e.body) : null;
        return o;
      }),
      ropes: this.eggs.filter((e) => e.joint && e.joint.a === e && e.alive && !e.saved).map((e) => ({ a: e.id, b: e.joint.b.id, len: e.joint.len })),
      bombs: this.bombs.map((b) => ({ alive: b.alive, lit: b.lit, fuse: b.fuse, b: b.alive ? bodyS(b.body) : null })),
      rocks: this.rocks.map((r) => ({ alive: r.alive, b: bodyS(r.body) })),
      orbs: this.orbs.filter((o) => o.alive).map(({ type, ch, a, rad, ph, sway, src }) => ({ type, ch, a, rad, ph, sway, src })),
      portals: this.portals.map((p) => [p.timer, p.k]),
      snake: this.snake ? { ...this.snake, pts: this.snake.pts.map((q) => ({ ...q })) } : null,
      wx: { ...this.wx, bolt: this.wx.bolt ? { ...this.wx.bolt } : null },
      embers: this.embers.map((m) => ({ ...m })),
      nest: bodyS(this.nest),
    };
  }

  static fromState(level, S, opts = {}) {
    const sim = new Sim(level, { ...opts, mode: opts.mode || S.mode });
    const setB = (b, a) => { b.setTransform(Vec2(a[0], a[1]), a[2]); b.setLinearVelocity(Vec2(a[3], a[4])); b.setAngularVelocity(a[5]); };
    Object.assign(sim, { t: S.t, timeLeft: S.timeLeft, state: S.state, endTimer: S.endTimer, rs: S.rs, combo: S.combo, lastSaveT: S.lastSaveT, nextEggId: S.nextEggId, turns: S.turns || 0, orbsTaken: S.orbsTaken || 0, orbsStart: S.orbsStart ?? sim.orbsStart });
    sim.savedLog = S.savedLog.map((x) => ({ ...x }));
    S.rings.forEach((rs, i) => {
      const r = sim.rings[i];
      r.body.setTransform(Vec2(0, 0), rs.a);
      r.target = rs.target;
      r.stun = rs.stun || 0;
      r.moving = rs.moving;
      rs.segs.forEach(([alive, hp, burn], k) => { const g = r.segs[k]; g.hp = hp; g.burn = burn; if (!alive && g.alive) { g.alive = false; r.body.destroyFixture(g.fix); } });
      rs.thorns.forEach(([alive, ext], k) => { const h = r.thorns[k]; h.ext = ext; if (!alive && h.alive) { h.alive = false; r.body.destroyFixture(h.fix); } });
      (rs.gaps || []).forEach((o, k) => { r.gaps[k].o = o; });
      (rs.honey || []).forEach((d, k) => { r.honey[k].dry = d; });
    });
    for (const e of sim.eggs) sim.world.destroyBody(e.body);
    sim.eggs = [];
    for (const es of S.eggs) {
      if (es.b) {
        const egg = sim.addEgg(es.b[0], es.b[1], es.cracks, { golden: es.golden });
        setB(egg.body, es.b);
        const { b, gates, spk, stone, bubble, magnet, chick, hold, alive, saved, ...rest } = es;
        Object.assign(egg, rest, { gates: new Set(gates || []), spk: new Set(spk || []), hold: hold ? { ...hold } : null });
        if (stone > 0) { sim.setStone(egg, true); egg.stone = stone; }
        if (bubble > 0) { sim.setBubble(egg); egg.bubble = bubble; }
        if (chick) sim.hatch(egg, true);
      } else {
        sim.eggs.push({ id: es.id, alive: es.alive, saved: es.saved, cracks: es.cracks, body: null, mult: es.mult, prize: es.prize, chick: es.chick });
      }
    }
    for (const r of S.ropes || []) {
      const a = sim.eggs.find((e) => e.id === r.a && e.body), b = sim.eggs.find((e) => e.id === r.b && e.body);
      if (!a || !b) continue;
      const j = sim.world.createJoint(new RopeJoint({ maxLength: r.len, collideConnected: true }, a.body, b.body, a.body.getPosition()));
      a.joint = b.joint = { j, a, b, len: r.len };
      a.magnet = b.magnet = S.eggs.find((e) => e.id === r.a).magnet;
    }
    for (const o of sim.orbs) sim.world.destroyBody(o.body);
    sim.orbs = [];
    for (const o of S.orbs || []) Object.assign(sim.addOrb(o.type, o.ch, o.a, o.src, o.rad), { ph: o.ph, sway: o.sway });
    (S.portals || []).forEach(([timer, k], i) => Object.assign(sim.portals[i], { timer, k }));
    if (S.snake) sim.snake = { ...S.snake, pts: S.snake.pts.map((q) => ({ ...q })) };
    if (S.wx) sim.wx = { ...S.wx, bolt: S.wx.bolt ? { ...S.wx.bolt } : null };
    sim.embers = (S.embers || []).map((m) => ({ ...m }));
    sim.events.length = 0;
    S.bombs.forEach((bs, i) => { const b = sim.bombs[i]; Object.assign(b, { lit: bs.lit, fuse: bs.fuse }); if (!bs.alive) { b.alive = false; sim.world.destroyBody(b.body); } else setB(b.body, bs.b); });
    S.rocks.forEach((rs, i) => setB(sim.rocks[i].body, rs.b));
    setB(sim.nest, S.nest);
    sim.rs = S.rs; // re-creating eggs and orbs above drew from the rng
    sim.snaps = [];
    return sim;
  }

  // ---------- queries ----------
  aliveEggs() {
    return this.eggs.filter((e) => e.alive && !e.saved);
  }
  channelOf(egg) {
    const p = egg.body.getPosition();
    return this.chAt(Math.hypot(p.x, p.y));
  }
  chAt(d) {
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
