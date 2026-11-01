// Eggscape simulation: planck.js (Box2D) world, rules, events. No DOM here so it runs in node for tests.
import { World, Vec2, Polygon, Circle, Box, RopeJoint } from 'planck';
import { EGG_H, EGG_W, RING_TH, TAU, eggHull, solidArcs, wrap, clamp, rng } from './geom.js';
import { v31Init, v31Step, v31State, v31Load, v31Contact, frostOrb, animalsHit } from './boss.js'; // bosses (v3.1)
import { chickMethods, CHICK_KEYS } from './chicks.js'; // v3.2 chick kinds

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
export const ORB_TYPES = ['fire_red', 'fire_black', 'fire_green', 'fire_gold', 'stone', 'bubble', 'water', 'thunder', 'thorn', 'magnet', 'twin',
  'hourglass', 'feather', 'rockskin', 'foxcurse', 'frost'];
export const LEGACY_ORB = { fire: 'fire_red', steel: 'stone' }; // v1 item ids (levels and saves)
const ORB_R = 0.2;

// ---------- v3 physics: constants
// Global powers (G29, G30, G39, G40): the egg that takes the orb sets it off for every egg.
export const V3_POWER = { hourglass: 6, feather: 6, rockskin: 6, foxcurse: 6 };
// Special eggs (I3): hull scale, mass factor. Ostrich can't pass gaps shorter than OSTRICH_GAP (m).
export const EGG_KIND = { ostrich: { s: 1.3, m: 2 }, quail: { s: 0.75, m: 0.45 }, duck: { s: 1, m: 1 } };
export const OSTRICH_GAP = 0.9; // a 0.78 m gap jams a 1.3x egg about one drop in four: below this it is barred outright
const PULL_R = 1.2; // portal suction radius (G18)
const HOLE_LEN = 0.95, HOLE_T = 5, ROCK_FLY = 1.1, ROCK_SIT = 1.2; // lava rocks (G31)
const CURTAIN_BURN = 1; // s for fire to clear a thorn curtain
const GUARD_PASS = new Set(['fox', 'ground', 'lost', 'lava']); // what still ends a guarded egg

// Difficulty is the player's choice (F32). Same levels, tuned per mode.
export const MODES = {
  easy: { fuse: 1.6, nest: 0.6, nestW: 0.5, crack: 1, meteor: false, softThorns: true },
  medium: { fuse: 1, nest: 1, nestW: 0, crack: 1, meteor: true, softThorns: false },
  hard: { fuse: 0.8, nest: 1.3, nestW: 0, crack: 0.85, meteor: true, softThorns: false },
};

// ---------- predators (v3): mode scaling (G10). snake = speed x, venom/warn = telegraph time x, fox = throw gap x
export const PRED = {
  easy: { snake: 1.4, venom: 1.3, warn: 1.35, fox: 1.3 },
  medium: { snake: 2, venom: 1, warn: 1, fox: 1 },
  hard: { snake: 2.6, venom: 0.8, warn: 0.8, fox: 0.85 },
};
// stun = clash daze x, back = back-off time x (a bite on a protected egg)
Object.assign(PRED.easy, { stun: 1.4, back: 1.3 }); Object.assign(PRED.medium, { stun: 1, back: 1 }); Object.assign(PRED.hard, { stun: 0.75, back: 0.8 });
// Snake kinds: only a level spec's `kind` turns a trait on; otherwise every snake is classic and the skin is cosmetic.
export const SNAKE_KIND = {
  classic: { skin: 'violet' },
  fast: { skin: 'emerald', speed: 1.3, len: 0.8 },
  constrictor: { skin: 'amber', speed: 0.8, back: 0.5 }, // armoured: half the back-off from a protected egg
  spitter: { skin: 'crimson', venom: 0.5, speed: 0.6 }, // venom melts a barrier in half the time; slow, spits holes in walls
};
const SPIT = { every: 5, rear: 0.5, fly: 0.5 }; // spitter: s between spits, rear-up (anticipation), glob flight
export const SNAKE_SKINS = ['violet', 'emerald', 'amber', 'crimson'];
const CLASH = { r: 0.45, stun: 2.2, cd: 6, knock: 1.1, pts: 250, orbs: ['fire_red', 'rockskin', 'feather'] };
const BACK_T = 5, TRAIL = 0.05, STRIKE_T = 0.3, STRIKE_R = 0.35; // s a snake backs off a protected egg; m between trail points
const VENOM_T = 2.5; // s from the hiss to a melted barrier (Medium)
const BURN_T = 1; // s for a flame egg to burn a barrier down
const PECK_T = 0.6; // s a chick rests on a blunt cluster before it pecks it away
// eagle (G48): lock = shadow lock-on (x PRED.warn), dive = longest swoop, daze after a slam, carry = longest
// wait for a high opening, perch = idle time before it lands on the vault. Per mode: daze x, drop = crack-ladder
// rings a dropped catch counts as (1 crack every mode), dive speed x
const EAGLE_T = { lap: 3.2, lock: 1.6, dive: 1.4, strike: 0.28, daze: 3, carry: 3.5, perch: 5 };
const EAGLE_MODE = { easy: { daze: 1.25, drop: 3, speed: 0.85 }, medium: { daze: 1, drop: 2, speed: 1 }, hard: { daze: 0.8, drop: 2, speed: 1.12 } };
const EAGLE_REACH = 0.7; // m: talons reach an egg this far (centre) from an opening in the outer ring
export const EAGLE_LEN = 3.0; // m, beak to tail: the art's size, and so where its talons are (EL below)
const EL = { foot: 0.34 * EAGLE_LEN, hover: 0.47 * EAGLE_LEN, perch: 0.33 * EAGLE_LEN, high: 0.55 * EAGLE_LEN, half: 0.5 * EAGLE_LEN };
const CHICK_R = 0.3; // chick collision radius (~1.5x an egg, G33)

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
    this.snakes = []; // predators (v3): see buildPredators
    this.turns = 0; // player ring turns (bonus objective C3)
    this.orbsTaken = 0;
    this.weather = level.weather || null;
    this.wx = { next: 4 + (level.seed || 7) % 3, bolt: null, quake: 0, qk: 0, ember: 1.5 };
    this.timeLeft = this.timeLimit;
    this.combo = 0;
    this.lastSaveT = -9;
    // v3 physics: global power timers, lava rocks, icicles
    this.slowT = 0; this.curseT = 0; this.jitT = 0; this.guardT = 0; this.skinT = 0;
    this.lavaRocks = []; this.icicles = [];
    const LV = typeof level.lava === 'object' && level.lava, IC = level.icicles;
    this.v3T = { lava: LV ? LV.delay ?? 5 : -1, ice: IC ? IC.delay ?? 4 : -1 };
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
      const egg = this.addEgg(spots[i][0] * (this.rings[0].r / 1.05), spots[i][1] * (this.rings[0].r / 1.05), 0, { ...(i === 0 && this.golden ? { golden: 1 } : {}), kind: (L.eggKinds || [])[i] });
      if (i === n0 - 1 && L.bonus && L.bonus.kind === 'prize') egg.prize = 1;
      if (i === 0 && this.opts.stone) this.setStone(egg, true);
    }

    // portals sit on channel floors; with `emit` they spit out an orb every `every` seconds
    for (const p of L.portals || []) {
      // v3: pull = suction radius (G18); later portals emit out of step with the first
      this.portals.push({ ax: p.a[0], ay: p.a[1], bx: p.b[0], by: p.b[1], r: 0.3, emit: p.emit || null, every: p.every || 8, timer: (p.every || 8) * (0.4 + 0.3 * this.portals.length), k: 0, pull: p.pull ?? PULL_R });
    }
    // floating orbs: level orbs, plus v1 ring items (they used to be pinned to the ring)
    for (const o of L.orbs || []) this.addOrb(o.type, o.ch, deg(o.a ?? 90), 'start');
    for (const ring of this.rings) for (const it of ring.spec.items || []) this.addOrb(it.type, ring.i, deg(it.a) + ring.body.getAngle(), 'start');
    this.orbsStart = this.orbs.length;
    this.buildPredators(L);
    v31Init(this); // bosses (v3.1): boss fight, falling ice, temporary walls and ring locks
    for (const b of L.bombs || []) this.addBomb(b.x, b.y);
    for (const k of L.rocks || []) this.addRock(k.x, k.y, k.s || 0.18);
    this.chickSetup(L); // v3.2: pre-tinted eggs, hard-ice rings
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
      gaps: this.v3Gaps(spec, r),
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
    this.v3Ring(ring);
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
    const K = EGG_KIND[extra.kind]; // v3 special eggs: size and weight
    const hull = eggHull(12, K ? K.s : 1).map((p) => Vec2(p.x, p.y));
    const fix = body.createFixture({ shape: new Polygon(hull), density: K ? K.m / (K.s * K.s) : 1, friction: 0.5, restitution: 0.12, ...filt('EGG'), userData: { kind: 'egg' } });
    const egg = {
      id: this.nextEggId++, body, fix, cracks, alive: true, saved: false,
      fire: 0, fireKind: null, stone: 0, bubble: 0, bubbleFix: null, magnet: 0, joint: null, golden: extra.golden || 0,
      water: 0, zap: 0, glow: 0, chick: 0, meteor: 0, honey: 0, hold: null, honeyCD: 0, prize: 0, spk: new Set(), // spk: blunt spikes touching now
      crackCD: 0, nestT: 0, inNest: 0, safeT: this.t < 0.5 ? 1.5 : 0, portalCD: 0, born: this.t,
      seed: (this.rand() * 1e9) | 0, impact: 0, lastV: 0, fear: 0,
      ch: 0, mult: 1, freefall: 0, comet: 0, cometUsed: false,
      kind: K ? extra.kind : null, guard: 0, rockskin: 0, curse: 0, drop: 0, soft: false, lavaCD: 0, // v3
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
    const dt = this.slowT > 0 ? DT / 2 : DT; // v3 hourglass: the world runs at half speed
    this.t += dt;
    const L = this.level;

    for (const ring of this.rings) {
      const a = ring.body.getAngle();
      let w;
      if (ring.stun > 0 || ring.lock > 0) {
        // a zapped ring locks up (bosses v3.1: so does a frozen or punched one)
        if (ring.stun > 0) ring.stun -= dt;
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
      const lim = ring.stun > 0 || o.stun > 0 || ring.lock > 0 || o.lock > 0 ? 0 : Math.min(this.maxOmega(ring), this.maxOmega(o));
      drive.omega = clamp(drive.omega, -lim, lim);
      other.omega = -drive.omega;
      other.target = other.body.getAngle() + other.omega * dt;
      other.follower = true;
    }
    this.v3Rings();
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
      const w0 = this.wind;
      this.wind = strength * Math.sign(s) * Math.min(1, Math.abs(s) * 2.2);
      if (Math.abs(this.wind) >= strength * 0.95 && Math.abs(w0) < strength * 0.95) for (const S of this.snakes) this.hitSnake(S, 'gust', { dir: Math.sign(this.wind), power: Math.abs(this.wind) }); // a gust peaks
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
      this.v3Egg(egg, dt);
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
    this.predStep(dt);
    this.chickStep(dt); // v3.2 chick kinds
    if (this.weather && this.state === 'play') this.weatherStep(dt);
    if (this.state === 'play') this.v3Step(dt);

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
      // v3 crack ladder (G34) replaces the meteor/comet rule: a fall through 2+ rings is judged on
      // landing by the number of rings, and that landing never also counts as a hard hit
      if (egg.drop >= 2 && egg.impact > 1.2) this.landFall(egg);
      else if (egg.stone > 0 || egg.safeT > 0 || egg.chick || egg.honey > 0 || egg.guard > 0) { /* immune */ }
      else if (v >= SHATTER_V * soft) this.breakEgg(egg, 'impact');
      else if (v >= this.crackV * soft && egg.crackCD <= 0) this.crack(egg, v);
      if (egg.freefall === 0) egg.drop = 0; // touched a ring floor: the fall is over
      egg.soft = false;
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
      this.timeLeft -= dt * this.fuseRate();
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
      if (uo.kind === 'seg' && (uo.seg.pad || uo.seg.honey)) egg.soft = true; // v3: sponge landings are always safe
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
    if (this.v3Pass(ua, ub) || this.chickPass(ua, ub)) { c.setEnabled(false); return; } // v3: melted ring, grate, narrow gap
    if (!fa.isSensor() && !fb.isSensor()) this.impactCheck(c, old, ua, ub);
    let egg = null, other = null, ofix = null;
    if (ua.kind === 'egg') { egg = ua.egg; other = ub; ofix = fb; }
    else if (ub.kind === 'egg') { egg = ub.egg; other = ua; ofix = fa; }
    if (ua.kind === 'shut' || ub.kind === 'shut') {
      if ((ua.kind === 'shut' ? ua : ub).gap.o > 0.5) { c.setEnabled(false); return; }
    }
    if (other && other.kind === 'thorn' && other.thorn.ext < 0.5) { c.setEnabled(false); return; }
    if (this.v3Contact(c, egg, other) || this.chickContact(c, egg, other)) return;
    if (!egg || !egg.alive || egg.saved) return;
    if (other.kind === 'barrier') { this.barrierTouch(c, egg, other.barrier); return; } // predators (v3)
    if (other.kind === 'thorn') {
      const th = other.thorn;
      if (!th.alive) { c.setEnabled(false); return; }
      if (egg.fire > 0) { this.defer(() => this.removeThorn(th, 'burn')); c.setEnabled(false); return; }
      if (egg.comet) { egg.comet = 0; this.defer(() => this.removeThorn(th, 'snap')); egg.safeT = 0.2; c.setEnabled(false); return; }
      if (egg.stone > 0) { this.emit('stoneHit', { egg }); this.defer(() => this.removeThorn(th, 'snap')); c.setEnabled(false); return; }
      if (egg.bubbleFix) { if (!egg.popping) { egg.popping = true; egg.safeT = 0.4; this.defer(() => { egg.popping = false; this.popBubble(egg, true); }); } c.setEnabled(false); return; }
      if (egg.golden) { egg.golden = 0; egg.safeT = 0.6; this.defer(() => this.removeThorn(th, 'snap')); this.emit('goldenSave', { egg }); c.setEnabled(false); return; }
      if (egg.safeT > 0) return;
      if (egg.chick && (th.kind === 'blunt' || this.MD.softThorns)) { egg.peckHit = th.key + 1; return; } // predators (v3): chick pecks
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
      if (egg.fireKind === 'fire_black' && egg.fire > 0 && seg.alive && !seg.hardIce) {
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
    this.v3EndContact(ua, ub);
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
    egg.drop = egg.freefall; // v3 crack ladder: rings passed in this fall
    if (this.fallDamage(egg, egg.drop) > 0 && this.fallDamage(egg, egg.drop - 1) === 0 && !this.landSafe(egg)) this.emit('fallWarn', { egg, x: p.x, y: p.y, rings: egg.drop });
  }

  // n = cracks to add (the crack ladder can add two at once). 3 cracks = broken.
  crack(egg, v, why = 'impact', n = 1) {
    if (!egg.alive || egg.saved || egg.chick || egg.stone > 0 || egg.guard > 0) return; // a chick never cracks; stone and the feather take it
    egg.cracks += n;
    egg.crackCD = CRACK_COOLDOWN;
    const p = egg.body.getPosition();
    if (egg.cracks >= 3) this.breakEgg(egg, why === 'impact' || why === 'meteor' ? 'impact' : why);
    else this.emit('crack', { egg, v, why, x: p.x, y: p.y, n: egg.cracks, add: n });
  }

  breakEgg(egg, why) {
    if (!egg.alive || egg.saved) return;
    if (egg.guard > 0 && !GUARD_PASS.has(why)) return; // v3 guardian feather
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
    else if (t === 'fire_green') { egg.glow = 1.5; if (egg.cracks > 0) { const n = egg.cracks; egg.cracks = 0; this.emit('mend', { egg, x: p.x, y: p.y, n }); } } // v3: heals every crack
    else if (t === 'fire_gold' || t.startsWith('hatch_')) this.hatchOrb(egg, t); // v3.2: hatch orbs tint the egg
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
    else if (V3_POWER[t]) this.v3Power(t, egg);
    else if (t === 'frost') frostOrb(this, egg); // v3.1: the ring under the egg freezes
  }

  setStone(egg, on) {
    egg.stone = on ? POWER.stone.time : 0;
    const K = EGG_KIND[egg.kind];
    egg.fix.setDensity((on ? POWER.stone.mass : 1) * (K ? K.m / (K.s * K.s) : 1));
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
    this.chickBody(egg); // predators (v3): bigger chick
    this.chickHatched(egg, quiet); // v3.2: its kind
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
        if (!s.alive || s.hardIce) continue; // v3.2: only the pick chick breaks hard ice
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

  // ---------- predators (v3): snakes, barriers, eagle, fox thrower, chick pecks, danger cue ----------
  // level.snake {delay, speed, a, len, size, kind, skin} or an array of them (SNAKE_KIND); level.barriers [{ring, a}]; level.eagle
  // {delay, every}; level.fox {every, throws:[orb types], delay}. All state lives in plain objects that
  // predState() copies, so rewind and the planner stay exact.
  get snake() { return this.snakes.find((s) => !s.gone) || null; } // v2 callers: the first live snake

  buildPredators(L) {
    const P = (this.PM = PRED[this.mode]);
    this.snakes = [];
    this.barriers = [];
    this.eagle = null;
    this.fox = null;
    this.danger = 0;
    const list = !L.snake ? [] : Array.isArray(L.snake) ? L.snake : [L.snake];
    // skins: the spec's, the kind's, else by index (offset by level) so two snakes never share one
    const used = new Set(list.map((S) => S.skin || (SNAKE_KIND[S.kind] || {}).skin).filter(Boolean));
    let si = ((L.id || 6) - 6 + 400) % 4;
    list.forEach((S, i) => {
      const size = S.size || 1, K = SNAKE_KIND[S.kind] || {};
      let skin = S.skin || K.skin;
      if (!skin) { for (let j = 0; j < 4 && used.has(SNAKE_SKINS[si % 4]); j++) si++; skin = SNAKE_SKINS[si++ % 4]; used.add(skin); }
      this.snakes.push({
        id: i, size, rad: this.outerR + 1.0, a: Math.PI / 2 + deg(S.a ?? [0, 125, -125][i % 3]), speed: (S.speed || 0.55) * P.snake * (K.speed || 1),
        wait: S.delay ?? 3 + i * 5, len: (S.len || 1.7) * 3.4 * size * (K.len || 1), pts: [], mouthOpen: 0, eaten: 0, inside: false,
        gone: 0, tgt: 0, mood: null, moodT: 0, blocked: 0, spit: null,
        kind: SNAKE_KIND[S.kind] ? S.kind : 'classic', skin, venomK: K.venom || 1, backK: K.back || 1,
        stun: 0, back: 0, knock: 0, flee: -1, strike: 0, lunge: 0, odo: 0, shove: 0, hurt: '',
        carried: false, carryX: 0, carryY: 0, held: 0, // the eagle's talons (carryStep)
        vsT: SPIT.every, vsK: -1, vsR: 0, vsA: 0, // spitter: next spit, phase time (-1 idle), target ring and its local angle // clash daze (s), backing off (s), knock-back left (m), fleeing a won level (s)
      });
    });
    this.clashCD = 0; this.clashN = 0; this.predPts = 0;
    // a wooden wall on the floor of the channel just inside `ring`, turning with it (G14)
    for (const B of L.barriers || []) {
      const ring = this.rings[B.ring];
      if (!ring) continue;
      const base = ring.r - RING_TH / 2 + 0.01, inner = B.ring ? this.rings[B.ring - 1].r + RING_TH / 2 + 0.08 : 0;
      const h = Math.min(0.75, base - inner), w = 0.16, a = deg(B.a || 0), top = base - h;
      const p = (rad, ang) => Vec2(rad * Math.cos(ang), rad * Math.sin(ang));
      const bar = { ring: B.ring, a, h, w, base, alive: true, melt: 0, burn: 0, fire: 0, venom: 0, fix: null };
      bar.fix = ring.body.createFixture({
        shape: new Polygon([p(base, a - w / 2 / base), p(base, a + w / 2 / base), p(top, a + w / 2 / top), p(top, a - w / 2 / top)]),
        friction: 0.7, restitution: 0.05, ...filt('RING'), userData: { kind: 'barrier', barrier: bar },
      });
      this.barriers.push(bar);
    }
    this.EM = EAGLE_MODE[this.mode];
    if (L.eagle) {
      const R = this.outerR, sd = (L.seed || 7) % 2 ? 1 : -1; // it sweeps in from off screen, high on one side
      this.eagle = {
        every: L.eagle.every ?? 10, phase: 'away', t: L.eagle.delay ?? 6, next: 0, x: sd * (R + 9), y: R + 4, vx: -sd * 6, vy: -1, face: -sd, bank: 0,
        tk: null, tid: 0, tph: 0, tx: 0, ty: 0, dtx: 0, dty: 0, mx: 0, my: 0, cx: 0, cy: 0, side: 1, lk: 0, dur: 1, reach: 0, exp: 0, res: null,
        carry: null, cid: 0, ctype: null, ct: 0, ox: 0, oy: 0, yx: 0, yy: 0, dzx: 0, dzy: 0, dropId: 0, dropT: 0, dropArm: 0, idle: 0, n: 0, end: null, scr: 0, last: null, sx: 0, sy: 0,
      };
    }
    if (L.fox) this.fox = { every: (L.fox.every || 8) * P.fox, throws: [...(L.fox.throws || ['thorn'])], t: L.fox.delay ?? 3, k: 0, x: 0, mood: 'smug', moodT: 0 };
  }

  predStep(dt) {
    const end = this.state !== 'play';
    if (this.state === 'winning' || this.state === 'won') this.eagleFlee?.(); // the eagle's own code flies it off
    for (const S of this.snakes) {
      if (S.gone) continue;
      if (S.carried) { this.carryStep(S); continue; } // in the eagle's talons
      if (S.held) this.snakeDrop(S);
      this.trailPin(S);
      if (end) this.snakeEnd(S, dt); else this.snakeStep(S, dt);
    }
    if (!end) this.clashStep(dt);
    for (const b of this.barriers) if (b.alive && b.fire && (b.burn += dt / BURN_T) >= 1) this.removeBarrier(b, 'burn');
    if (this.eagle) this.eagleStep(dt); // after the level ends it flees (win) or gloats (loss)
    if (this.fox && this.state === 'play') this.foxStep(dt);
    else if (this.fox) this.foxEnd(dt);
    this.peckStep(dt);
    this.dangerStep();
  }

  // stone, rock skin and the guardian feather: snakes recoil, the eagle bounces off
  armored(egg) {
    return egg.stone > 0 || egg.rockskin > 0 || egg.guard > 0 || egg.bulk > 0; // v3.2: a puffed bulk chick too
  }
  snakeProof(egg) { return this.armored(egg) || egg.fire > 0; } // a flaming egg is no snack either

  // Snake (F26, G10-G13): enters from above the vault and hunts (chicks first, armoured eggs last). It
  // moves along channels and crosses a ring only through an open gap lined up with its head, so turning
  // rings holds it back. A barrier in its way stops it until venom melts it. Body = trail of its head (trailPt).
  // In range of its prey it coils (STRIKE_T), then bites; a protected egg (armour or fire) sends it backing off.
  snakeStep(S, dt) {
    const n = this.rings.length, br = 0.2 * S.size; // body radius (drawn thick x2)
    S.mouthOpen = Math.max(0, S.mouthOpen - dt * 1.5);
    S.lunge = Math.max(0, S.lunge - dt * 2.5);
    if (S.moodT > 0 && (S.moodT -= dt) <= 0) {
      if (S.mood === 'chew') { S.mood = 'grin'; S.moodT = 1.2; }
      else S.mood = null;
    }
    if (S.knock > 0) { const d = Math.min(S.knock, 3 * dt); S.knock -= d; this.snakeBack(S, d); } // clash: shoved back fast
    if (S.shove) this.shoveStep(S, dt);
    if (S.stun > 0) { S.stun -= dt; return; } // dazed
    if (S.back > 0) { S.back -= dt; this.snakeBack(S, 0.5 * S.speed * dt); S.blocked = 0; return; } // backing off, head still forward
    if (S.spit) { this.spitStep(S, dt, br); return; }
    if (S.wait > 0) { S.wait -= dt; return; }
    if (!S.inside) { S.inside = true; this.emit('snakeIn', { id: S.id }); }
    const hc = this.chAt(S.rad);
    const hx = S.rad * Math.cos(S.a), hy = S.rad * Math.sin(S.a);
    let egg = null, best = 1e9;
    for (const e of this.aliveEggs()) {
      const c = this.channelOf(e);
      if (c >= n) continue; // falling to the nest: out of reach
      const p = e.body.getPosition();
      let d = Math.abs(c - hc) * 10 + Math.abs(wrap(Math.atan2(p.y, p.x) - S.a));
      if (e.chick) d -= 100; // bait (I2)
      else if (this.snakeProof(e)) d += 40;
      if (this.snakes.some((o) => o !== S && !o.gone && o.tgt === e.id)) d += 15; // spread out
      if (d < best) { best = d; egg = e; }
    }
    S.tgt = egg ? egg.id : 0;
    if (!egg || this.channelOf(egg) !== hc) S.strike = 0;
    if (S.kind === 'spitter' && this.venomStep(S, dt, hc, egg)) return;
    const mid = (c) => (c >= n ? this.outerR + 0.35 : c === 0 ? this.rings[0].r * 0.45 : (this.rings[c - 1].r + this.rings[c].r) / 2);
    const edge = RING_TH / 2 + br * 0.7;
    const lo = hc > 0 ? this.rings[hc - 1].r + edge : 0, hi = hc < n ? this.rings[hc].r - edge : 1e9;
    let ga = S.a + 0.6, gr = mid(hc); // nothing to hunt: slither along the channel
    if (egg) {
      const p = egg.body.getPosition(), ec = this.channelOf(egg);
      if (ec === hc) {
        ga = Math.atan2(p.y, p.x);
        gr = clamp(Math.hypot(p.x, p.y), lo, hi);
        const d = Math.hypot(p.x - hx, p.y - hy), reach = 0.28 + br + (egg.chick ? CHICK_R - 0.24 : 0);
        S.mouthOpen = Math.max(S.mouthOpen, clamp(1.6 - d, 0, 1));
        // strike: in range it holds still and coils (STRIKE_T), then lunges; an egg that rolls away is spared
        if (S.strike > 0 || d < reach + STRIKE_R) {
          if (d > reach + STRIKE_R + 0.15) S.strike = 0;
          else if ((S.strike += dt) < STRIKE_T) return;
        }
        if (S.strike >= STRIKE_T) {
          S.strike = 0;
          if (this.snakeProof(egg)) {
            // too hard to bite: a clear hit, then it backs off along its own body for a while, still facing the egg
            S.back = BACK_T * this.PM.back * S.backK; S.mood = 'ouch'; S.moodT = 0.7; S.mouthOpen = 0;
            this.snakeBack(S, 0.12);
            this.emit('snakeRecoil', { x: (p.x + hx) / 2, y: (p.y + hy) / 2, id: S.id });
          } else {
            if (egg.chick) this.chickFlee(egg, 'snake'); // the bait flaps free: it costs an egg, never a star
            else this.breakEgg(egg, 'snake');
            S.eaten++; S.mouthOpen = 1; S.wait = 1.4; S.mood = 'chew'; S.moodT = 0.8;
            this.emit('snakeEat', { x: p.x, y: p.y, id: S.id, chick: !!egg.chick });
          }
          S.lunge = 1; // presentation: the head darts forward and settles
          return;
        }
      } else {
        const ring = this.rings[ec < hc ? hc - 1 : hc], ra = ring.body.getAngle();
        let gap = null, gd = 1e9;
        for (const g of [...ring.gaps.filter((x) => this.snakeGap(x)), ...this.venomHoles(ring)]) {
          const d = Math.abs(wrap(ra + g.a - S.a));
          if (d < gd) { gd = d; gap = g; }
        }
        gr = clamp(mid(hc), lo, hi);
        if (gap) {
          ga = ra + gap.a;
          // through only while the gap lines up with the head; otherwise back into the channel
          if (gd < (gap.len - br * 1.2) / (2 * ring.r)) gr = ec < hc ? ring.r - 0.3 : ring.r + 0.3;
        } else ga = S.a; // no way through: wait
      }
    }
    const sp = S.speed * dt, ar = Math.max(S.rad, 0.3);
    let da = clamp(wrap(ga - S.a), -sp / ar, sp / ar);
    const bar = this.barrierAt(S, hc, da, br);
    if (bar) { da = 0; if (!bar.venom) this.startSpit(S, bar); }
    const r0 = S.rad, a0 = S.a;
    S.rad += clamp(gr - S.rad, -sp, sp);
    S.a += da;
    S.odo += Math.hypot(S.rad - r0, wrap(S.a - a0) * S.rad); // distance crawled: the body wave is pinned to it
    S.blocked = Math.abs(S.rad - r0) + Math.abs(da) * ar < sp * 0.2 ? 1 : 0;
    const x = S.rad * Math.cos(S.a), y = S.rad * Math.sin(S.a);
    const T = S.pts;
    if (T.length < 2 || Math.hypot(T[1].x - x, T[1].y - y) > TRAIL) T.unshift(this.trailPt(S, {}, S.a, S.rad));
    else this.trailPt(S, T[0], S.a, S.rad);
    if (T.length > Math.ceil(S.len / TRAIL) + 1) T.length = Math.ceil(S.len / TRAIL) + 1;
  }

  // Trail in channel space: {a, r} (+x, y). A point recorded inside a ring's wall band (a gap it slid through)
  // is pinned to that ring (g = ring + 1, la = angle on the ring), so a turning ring drags it along in its gap.
  trailPt(S, q, a, r) {
    q.a = a; q.r = r; q.x = r * Math.cos(a); q.y = r * Math.sin(a); q.g = 0;
    const th = RING_TH / 2 + 0.12 * S.size;
    for (const ring of this.rings) if (Math.abs(r - ring.r) < th) { q.g = ring.i + 1; q.la = wrap(a - ring.body.getAngle()); }
    return q;
  }
  trailPin(S) {
    for (const q of S.pts) {
      if (!q.g) continue;
      q.a = wrap(this.rings[q.g - 1].body.getAngle() + q.la);
      q.x = q.r * Math.cos(q.a); q.y = q.r * Math.sin(q.a);
    }
  }
  // Slide the head back along its own trail by d (m); the tail grows on along its channel, so the body keeps
  // its length and the head keeps facing forward.
  snakeBack(S, d) {
    const T = S.pts;
    while (d > 1e-6 && T.length > 3) {
      const h = T[0], q = T[1], l = Math.hypot(q.x - h.x, q.y - h.y), s = Math.min(d, l);
      d -= s; S.odo -= s;
      if (l - s > 1e-4) { const f = s / l; this.trailPt(S, h, h.a + wrap(q.a - h.a) * f, h.r + (q.r - h.r) * f); continue; }
      T.shift(); // a whole point backed over: the tail grows one on, along its channel (easing to its centre line)
      const z = T[T.length - 1], y = T[T.length - 2], da = wrap(z.a - y.a), n = this.rings.length, c = this.chAt(z.r + (z.r - y.r) * 4);
      const mid = c >= n ? this.outerR + 0.35 : c === 0 ? this.rings[0].r * 0.45 : (this.rings[c - 1].r + this.rings[c].r) / 2;
      const dr = clamp(mid - z.r, -TRAIL * 0.7, TRAIL * 0.7), r = z.r + dr;
      T.push(this.trailPt(S, {}, z.a + Math.sign(da || 1) * Math.sqrt(TRAIL * TRAIL - dr * dr) / Math.max(r, 0.3), r));
    }
    S.rad = T[0].r; S.a = T[0].a;
  }

  // Clash (Breaker's rivals): heads meeting face to face in a channel, or one head running into the other's
  // body, starts a fight. Both are shoved back along their trails, dazed, and it sheds a helpful orb.
  clashStep(dt) {
    if (this.clashCD > 0) { this.clashCD -= dt; return; }
    const L = this.snakes.filter((S) => !S.gone && S.inside && S.pts.length > 5 && !(S.stun > 0) && !(S.knock > 0));
    const dir = (S) => { const h = S.pts[0], q = S.pts[3], l = Math.hypot(h.x - q.x, h.y - q.y) || 1; return [(h.x - q.x) / l, (h.y - q.y) / l]; };
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const A = L[i], B = L[j], ha = A.pts[0], hb = B.pts[0], c = this.chAt(A.rad);
      let hit = null;
      if (c === this.chAt(B.rad) && Math.hypot(ha.x - hb.x, ha.y - hb.y) < CLASH.r * (A.size + B.size) / 2) {
        const [ax, ay] = dir(A), [bx, by] = dir(B);
        if (ax * bx + ay * by < -0.3) hit = { x: (ha.x + hb.x) / 2, y: (ha.y + hb.y) / 2 };
      }
      for (const [P, Q] of [[A, B], [B, A]]) {
        if (hit) break;
        const h = P.pts[0], w = 0.13 * (P.size + Q.size);
        for (let k = 4; k < Q.pts.length; k += 2) {
          const q = Q.pts[k];
          if (Math.abs(q.x - h.x) < w && Math.abs(q.y - h.y) < w && Math.hypot(q.x - h.x, q.y - h.y) < w) { hit = { x: (h.x + q.x) / 2, y: (h.y + q.y) / 2 }; break; }
        }
      }
      if (!hit) continue;
      for (const S of [A, B]) {
        if (S.spit) { const b = this.barriers[S.spit.b]; if (b) b.venom = 0; S.spit = null; }
        S.knock = CLASH.knock * S.size; S.stun = CLASH.stun * this.PM.stun; S.back = 0; S.hurt = 'clash'; S.strike = 0; S.vsK = -1;
        S.mood = 'ouch'; S.moodT = 0.5; S.mouthOpen = 1;
      }
      const n = this.rings.length, r = Math.hypot(hit.x, hit.y), ch = clamp(this.chAt(r), 0, n - 1), type = CLASH.orbs[this.clashN++ % CLASH.orbs.length];
      this.addOrb(type, ch, Math.atan2(hit.y, hit.x), 'clash', Math.min(r, this.orbFloor(ch)));
      this.predPts += CLASH.pts;
      this.clashCD = CLASH.cd;
      this.emit('snakeClash', { x: hit.x, y: hit.y, power: type, pts: CLASH.pts, a: A.id, b: B.id });
      return;
    }
  }

  // The level is decided: on a win each snake starts (0.35 s), then flees back out along its trail and has faded
  // before the vault bursts (0.9 s, 'won'); on a fail it stops where it is and grins.
  snakeEnd(S, dt) {
    S.mouthOpen = Math.max(0, S.mouthOpen - dt * 1.5);
    if (this.state === 'failing' || this.state === 'failed') { S.mood = 'grin'; S.moodT = 9; return; }
    if (!S.inside) { S.gone = 1; return; }
    if (S.flee < 0) { S.flee = 0; S.mood = 'shock'; S.moodT = 0.35; S.spit = null; S.stun = 0; }
    S.flee += dt;
    if (S.moodT > 0) S.moodT -= dt;
    if (S.flee > 0.35) this.snakeBack(S, 8 * dt);
    if (S.flee >= 0.9 || this.state === 'won') S.gone = 1;
  }

  // Spitter (kind 'spitter'): every SPIT.every s, when its prey is behind a wall, it stops, rears up (SPIT.rear) and
  // spits a glob in an arc at that wall just ahead of it (SPIT.fly); the glob burns a molten hole (HOLE_T) that
  // snakes and eggs can pass. True while it is busy spitting.
  venomStep(S, dt, hc, egg) {
    const n = this.rings.length;
    if (S.vsK < 0) {
      if ((S.vsT -= dt) > 0 || !egg || S.pts.length < 4) return false;
      const ec = this.channelOf(egg), ri = ec < hc ? hc - 1 : hc;
      if (ec === hc || ri >= n || ri < 0) { S.vsT = 1; return false; }
      const ring = this.rings[ri], p = egg.body.getPosition(), a = S.a + Math.sign(wrap(Math.atan2(p.y, p.x) - S.a) || 1) * 0.45 / ring.r;
      if (!this.solidAt(ring, ring.r * Math.cos(a), ring.r * Math.sin(a))) { S.vsT = 1; return false; } // already open there
      S.vsK = 0; S.vsR = ri; S.vsA = wrap(a - ring.body.getAngle()); S.mood = null;
      this.emit('snakeRear', { id: S.id });
    }
    const k0 = S.vsK, q = this.venomPt(S), h = S.pts[0];
    S.vsK += dt;
    if (k0 < SPIT.rear && S.vsK >= SPIT.rear) { S.mouthOpen = 1; this.emit('venomSpit', { x: h.x, y: h.y, tx: q.x, ty: q.y, id: S.id }); }
    if (S.vsK >= SPIT.rear + SPIT.fly) {
      const ring = this.rings[S.vsR], half = HOLE_LEN / (2 * ring.r);
      for (const sg of ring.segs) if (sg.alive && Math.abs(wrap((sg.a0 + sg.a1) / 2 - S.vsA)) < half) { sg.melt = HOLE_T; sg.vh = 1; }
      this.emit('venomHole', { x: q.x, y: q.y, ring: S.vsR, id: S.id });
      S.vsK = -1; S.vsT = SPIT.every; S.mood = 'grin'; S.moodT = 0.6;
    }
    return true;
  }
  venomPt(S) { const ring = this.rings[S.vsR], a = ring.body.getAngle() + S.vsA; return { x: ring.r * Math.cos(a), y: ring.r * Math.sin(a) }; }
  spitPhase(S) { return S.vsK < 0 ? null : { rear: Math.min(1, S.vsK / SPIT.rear), fly: S.vsK < SPIT.rear ? -1 : (S.vsK - SPIT.rear) / SPIT.fly }; }
  // holes a spitter's venom burnt in a ring: gaps for snakes as well as eggs ({a, len} in ring space, like gaps)
  venomHoles(ring) {
    const out = [];
    let run = null;
    for (const sg of ring.segs) {
      if (sg.melt > 0 && sg.vh) { if (run && Math.abs(run.a1 - sg.a0) < 1e-4) run.a1 = sg.a1; else out.push((run = { a0: sg.a0, a1: sg.a1 })); } else run = null;
    }
    return out.map((h) => ({ a: (h.a0 + h.a1) / 2, len: (h.a1 - h.a0) * ring.r }));
  }

  // Hazards hit snakes too. kind: 'gust' (shoved along its channel; a strong one costs it ~1 s), 'rock' | 'lava'
  // (burnt: ouch, stunned 1.5 s, then it backs off), 'ice' (stunned 1 s), 'bolt' (dizzy 2 s), 'quake' (loses its
  // grip ~0.5 s). o: {x, y, dir ({x, y} or a sign along x), power}.
  hitSnake(S, kind, o = {}) {
    if (!S || S.gone || !S.inside || S.flee >= 0 || this.state !== 'play') return;
    const p = o.power ?? 1, h = S.pts[0] || { x: S.rad * Math.cos(S.a), y: S.rad * Math.sin(S.a) };
    if (S.spit && kind !== 'gust') { const b = this.barriers[S.spit.b]; if (b) b.venom = 0; S.spit = null; }
    if (kind !== 'gust') { S.strike = 0; S.vsK = -1; S.vsT = Math.max(S.vsT, 2); }
    if (kind === 'gust') {
      const dx = typeof o.dir === 'number' ? o.dir : (o.dir && o.dir.x) || 0, dy = (o.dir && o.dir.y) || 0;
      S.shove += clamp(-Math.sin(S.a) * dx + Math.cos(S.a) * dy, -1, 1) * 0.35 * p; // m along the channel (ccw +)
      if (p > 1.2) { S.wait = Math.max(S.wait, 1); S.mood = 'shock'; S.moodT = 0.6; }
    } else if (kind === 'rock' || kind === 'lava') {
      S.stun = Math.max(S.stun, 1.5); S.back = Math.max(S.back, 2.5 * this.PM.back); S.hurt = 'burn'; S.mood = 'ouch'; S.moodT = 0.6;
    } else if (kind === 'ice') { S.stun = Math.max(S.stun, 1); S.hurt = 'ice'; }
    else if (kind === 'bolt') { S.stun = Math.max(S.stun, 2); S.hurt = 'bolt'; S.mood = 'shock'; S.moodT = 0.3; }
    else if (kind === 'quake') { S.wait = Math.max(S.wait, 0.5); S.mood = 'shock'; S.moodT = 0.5; }
    this.emit('snakeHit', { kind, x: o.x ?? h.x, y: o.y ?? h.y, id: S.id });
  }
  // a gust's shove: forward slides the head on along the channel, backward slides it back along its own body
  shoveStep(S, dt) {
    const d = clamp(S.shove, -1.5 * dt, 1.5 * dt), T = S.pts;
    S.shove = Math.abs(S.shove - d) < 1e-4 ? 0 : S.shove - d;
    const fwd = T.length > 3 ? Math.sign(wrap(T[0].a - T[3].a)) || 1 : 1;
    if (Math.sign(d) !== fwd) { this.snakeBack(S, Math.abs(d)); return; }
    S.a += d / Math.max(S.rad, 0.3); S.odo += Math.abs(d);
    if (T.length) this.trailPt(S, T[0], S.a, S.rad);
  }
  // Carried (for the eagle): while S.carried, the eagle sets S.carryX / S.carryY each step and the snake dangles from
  // there, head up; when it lets go the snake lands in the channel under that point, dazed, body laid along it.
  carryStep(S) {
    S.held = 1; S.strike = 0; S.spit = null; S.vsK = -1; S.mood = 'shock'; S.moodT = 0.2; S.inside = true;
    const x = S.carryX ?? S.pts[0]?.x ?? 0, y = S.carryY ?? S.pts[0]?.y ?? 0, n = Math.ceil(S.len / TRAIL) + 1;
    S.pts.length = Math.min(S.pts.length, n);
    while (S.pts.length < n) S.pts.push({});
    S.pts.forEach((q, i) => { const sw = Math.sin(this.t * 3 - i * 0.12) * Math.min(1, i / 20) * 0.25; this.trailPt(S, q, Math.atan2(y - i * TRAIL, x + sw), Math.hypot(x + sw, y - i * TRAIL)); q.g = 0; });
    S.rad = S.pts[0].r; S.a = S.pts[0].a;
  }
  snakeDrop(S) {
    S.held = 0;
    const n = this.rings.length, c = this.chAt(S.rad);
    S.rad = c >= n ? this.outerR + 0.35 : c === 0 ? this.rings[0].r * 0.45 : (this.rings[c - 1].r + this.rings[c].r) / 2;
    const m = Math.ceil(S.len / TRAIL) + 1;
    S.pts = [];
    for (let i = 0; i < m; i++) S.pts.push(this.trailPt(S, {}, S.a - (i * TRAIL) / Math.max(S.rad, 0.3), S.rad));
    S.stun = Math.max(S.stun, 1.5); S.hurt = 'drop'; S.mood = 'ouch'; S.moodT = 0.4;
    this.emit('snakeDrop', { x: S.pts[0].x, y: S.pts[0].y, id: S.id });
  }
  snakesNear(x, y, R) { return this.snakes.filter((S) => !S.gone && S.inside && S.pts.length && Math.hypot(S.pts[0].x - x, S.pts[0].y - y) < R); }

  // a gap the snake can slither through: not a shut door, a live thorn curtain or a grate
  snakeGap(g) {
    return !(g.shut && g.o < 0.5) && !(g.curtain && g.curtain.alive) && !g.grate;
  }

  // A live barrier in the snake's channel that its head would run into (moving by da). A barrier that
  // turns into the head shoves it along.
  barrierAt(S, hc, da, br) {
    for (const b of this.barriers) {
      if (!b.alive || b.ring !== hc) continue;
      const wa = this.rings[b.ring].body.getAngle() + b.a, d = wrap(wa - S.a), arc = Math.abs(d) * S.rad, touch = br + b.w / 2;
      if (arc < touch) S.a = wa - Math.sign(d || 1) * (touch / Math.max(S.rad, 0.3));
      if (arc < touch + 0.1 && (Math.sign(d) === Math.sign(da) || arc < touch)) return b;
    }
    return null;
  }

  barrierPoint(b, f = 0.5) {
    const ring = this.rings[b.ring], a = ring.body.getAngle() + b.a, r = b.base - b.h * f;
    return { x: r * Math.cos(a), y: r * Math.sin(a), a };
  }

  // venom (G14): hiss (telegraph), spit, then the barrier melts; VENOM_T in all on Medium
  startSpit(S, b) {
    b.venom = 1;
    S.spit = { b: this.barriers.indexOf(b), t: 0 };
    S.mood = null;
    const h = S.pts[0] || { x: S.rad * Math.cos(S.a), y: S.rad * Math.sin(S.a) };
    this.emit('snakeHiss', { x: h.x, y: h.y, id: S.id });
  }

  spitK(S) { return S.spit ? S.spit.t / (VENOM_T * this.PM.venom * (S.venomK || 1)) : 0; } // 0..1 through hiss, spit, melt

  spitStep(S, dt, br) {
    const b = this.barriers[S.spit.b], dur = VENOM_T * this.PM.venom * (S.venomK || 1);
    if (!b || !b.alive) { S.spit = null; return; }
    const k0 = S.spit.t / dur;
    S.spit.t += dt;
    const k = S.spit.t / dur, q = this.barrierPoint(b, 0.4), h = S.pts[0];
    if (k < 0.25 && h && Math.hypot(q.x - h.x, q.y - h.y) > br + b.w / 2 + 0.6) { S.spit = null; b.venom = 0; return; } // turned away before the spit
    if (k0 < 0.25 && k >= 0.25) { S.mouthOpen = 1; this.emit('venomSpit', { x: h ? h.x : q.x, y: h ? h.y : q.y, tx: q.x, ty: q.y, id: S.id }); }
    if (k >= 0.35) b.melt = clamp((k - 0.35) / 0.65, 0, 1);
    if (k >= 1) { this.removeBarrier(b, 'melt'); S.spit = null; S.mood = 'grin'; S.moodT = 0.6; }
  }

  // contact with a barrier (pre-solve): it is solid; a flame egg sets it alight
  barrierTouch(c, egg, b) {
    if (!b.alive) { c.setEnabled(false); return; }
    if (egg.fire > 0 && !b.fire) {
      b.fire = 1;
      const q = this.barrierPoint(b, 0.3);
      this.emit('barrierIgnite', { x: q.x, y: q.y });
    }
  }

  removeBarrier(b, how) {
    if (!b.alive) return;
    b.alive = false;
    const ring = this.rings[b.ring];
    this.killFix.push([ring.body, b.fix]);
    const q = this.barrierPoint(b, 0.5);
    if (how === 'burn') {
      const hw = b.w / 2, hh = b.h / 2;
      this.addDebris('char', [{ x: -hh, y: -hw }, { x: hh, y: -hw }, { x: hh, y: hw }, { x: -hh, y: hw }], q.x, q.y, q.a, (this.rand() - 0.5) * 1.5, 1.2, (this.rand() - 0.5) * 6, 1.4);
    }
    for (const S of this.snakes) if (S.spit && this.barriers[S.spit.b] === b) { S.spit = null; S.mood = null; }
    this.emit(how === 'melt' ? 'barrierMelt' : 'barrierBurn', { x: q.x, y: q.y });
  }

  // A chick a predator catches escapes in a flurry (I2: bait): it is out of play, but not a broken egg.
  chickFlee(egg, by) {
    egg.alive = false;
    egg.fled = 1;
    if (egg.joint) this.unMagnet(egg);
    this.kill.push(egg.body);
    const p = egg.body.getPosition();
    this.emit('chickFlee', { egg, by, x: p.x, y: p.y });
  }

  // chick (G33): resting on a blunt spike cluster for PECK_T pecks the whole cluster away. Rule: pecking
  // wins only against blunt grey spikes (every spike on Easy, where all spikes are blunt); a sharp red
  // hook still gets the chick, as before.
  chickBody(egg) {
    if (egg.chickFix) return;
    egg.body.destroyFixture(egg.fix);
    egg.fix = egg.chickFix = egg.body.createFixture({ shape: new Circle(CHICK_R), density: 0.65, friction: 0.5, restitution: 0.12, ...filt('EGG'), userData: { kind: 'egg', egg } });
  }

  peckStep(dt) {
    for (const e of this.eggs) {
      if (!e.chick || !e.alive || e.saved) continue;
      if (!e.peckHit) { e.peckK = e.peckT = 0; continue; }
      if (e.peckK === e.peckHit) e.peckT += dt;
      else { e.peckK = e.peckHit; e.peckT = 0; }
      e.peckHit = 0;
      if (e.peckT < PECK_T) continue;
      const k = e.peckK - 1, ring = this.rings[Math.floor(k / 1000)], th = ring && ring.thorns[k % 1000];
      e.peckK = e.peckT = 0;
      if (!th || !th.alive) continue;
      const cl = this.thornCluster(th), p = e.body.getPosition();
      for (const x of cl) this.removeThorn(x, 'peck');
      this.emit('chickPeck', { egg: e, x: p.x, y: p.y, n: cl.length });
    }
  }

  // the cluster a thorn belongs to: neighbours on the same ring side and kind, a few degrees apart
  thornCluster(th) {
    const R = th.ring.thorns, i = R.indexOf(th), out = [th], gap = deg(16);
    const same = (x) => x.alive && x.side === th.side && x.kind === th.kind;
    for (let j = i - 1; j >= 0 && same(R[j]) && Math.abs(wrap(R[j + 1].a - R[j].a)) < gap; j--) out.push(R[j]);
    for (let j = i + 1; j < R.length && same(R[j]) && Math.abs(wrap(R[j].a - R[j - 1].a)) < gap; j++) out.push(R[j]);
    return out;
  }

  // Eagle (G48), the sky predator. It never enters the vault: it hunts what the outer ring leaves exposed.
  // Rhythm: arrives, circles once, then every `every` s it locks on (its shadow sweeps over the rings and
  // settles on the target while it screeches), then dives. Talons reach only through an opening in the
  // outer ring (eagleReach). A catch is carried up and dropped back into the vault through a high opening
  // (the crack ladder judges the fall: progress and a crack, not instant death). A dive that finds solid
  // ring slams into it: the eagle is dazed and, if the player dodged an exposed target, drops a feather orb.
  // It also snatches snakes (an ally: carried off and dropped outside the far side) and exposed orbs.
  // Nothing to hunt: it perches on top of the vault and watches. hitEagle() lets hazards knock it about.
  // All state is flat numbers/strings in this.eagle, so predState()/fullState() keep rewind and the planner exact.
  eagleStep(dt) {
    const E = this.eagle, R = this.outerR;
    if (this.state !== 'play') { this.eagleEnd(dt); return; }
    E.t -= dt;
    if (E.next > 0) E.next -= dt;
    this.eagleDropTrack(dt);
    const orbit = (h = EL.high) => [Math.sin(this.t * 0.42) * R * 0.72, R + h + 0.3 * Math.sin(this.t * 0.84)];
    switch (E.phase) {
      case 'away':
        if (E.t > 0) return;
        E.phase = 'enter';
        E.t = 4;
        this.emit('eagleIn', { x: E.x, y: E.y });
        return;
      case 'enter': {
        const [ox, oy] = orbit();
        if (this.eagleFly(ox, oy, 9, 12, dt) < 1.2 || E.t <= 0) { E.phase = 'circle'; E.next = Math.max(E.next, EAGLE_T.lap); E.idle = 0; }
        return;
      }
      case 'circle':
      case 'perch': {
        if (E.phase === 'circle') { const [ox, oy] = orbit(); this.eagleFly(ox, oy, 4.5, 6, dt); }
        else this.eagleFly(0, R + EL.perch, 4, 7, dt, 3);
        if (E.next > 0) return;
        const tg = this.eagleTarget(null);
        // nothing new to choose: after a snake it lets the next one be for a beat (it is not a snake catcher)
        if (tg && tg.kind === 'snake' && E.last === 'snake') { E.last = null; E.next = E.every * 0.5; return; }
        if (tg) { this.eagleLock(tg); return; }
        if (E.phase === 'circle' && (E.idle += dt) > EAGLE_T.perch) E.phase = 'perch';
        return;
      }
      case 'warn': {
        const tg = this.eagleTarget(E);
        if (!tg) { E.phase = 'up'; E.t = 1.2; this.emit('eagleMiss', { x: E.x, y: E.y, why: 'lost' }); return; }
        E.tx = tg.x; E.ty = tg.y;
        E.reach = tg.exposed ? 1 : 0;
        if (E.reach && tg.kind !== 'snake') E.exp = 1;
        E.lk = clamp(1 - E.t / E.dur, 0, 1);
        // hover off to one side of the target, high enough to dive round the vault at it
        const th = Math.atan2(tg.y, tg.x) + E.side * 0.65, hr = R + EL.hover;
        const hx = hr * Math.cos(th), hy = Math.max(hr * Math.sin(th), this.groundY + 0.75 * EAGLE_LEN);
        this.eagleFly(hx, hy, 8, 16, dt, 2.2);
        if (Math.abs(tg.x - E.x) > 0.3) E.face = tg.x > E.x ? 1 : -1;
        if (E.t > 0) return;
        this.eaglePose(tg.x, tg.y);
        E.phase = 'dive';
        E.t = E.dur = EAGLE_T.dive / this.EM.speed;
        E.sx = E.x; E.sy = E.y;
        E.last = tg.kind;
        this.emit('eagleDive', { x: E.x, y: E.y, tx: E.mx, ty: E.my });
        return;
      }
      case 'dive': {
        const tg = this.eagleTarget(E);
        E.reach = tg && tg.exposed ? 1 : 0;
        if (tg && tg.kind === 'snake') this.eaglePose(tg.x, tg.y); // a snake is followed down; an egg is dived at where it was
        // the stoop: a scripted curve (out and over, never through the vault) on an ease-in, so it gathers
        // itself, folds and drops faster and faster onto the strike point
        const u = clamp(1 - E.t / E.dur, 0, 1), s = u * u * (1.6 - 0.6 * u), b = 1 - s;
        const a0 = Math.atan2(E.sy, E.sx), a2 = Math.atan2(E.cy, E.cx), am = a0 + wrap(a2 - a0) / 2;
        const rm = Math.max(Math.hypot(E.sx, E.sy), Math.hypot(E.cx, E.cy), R) + 1.2, px = rm * Math.cos(am), py = rm * Math.sin(am);
        const x = b * b * E.sx + 2 * b * s * px + s * s * E.cx, y = b * b * E.sy + 2 * b * s * py + s * s * E.cy;
        E.vx = (x - E.x) / dt; E.vy = (y - E.y) / dt;
        E.x = x; E.y = y;
        if (u > 0.5 && Math.abs(E.mx - E.x) > 0.15) E.face = E.mx > E.x ? 1 : -1; // squares up to the catch
        else if (Math.abs(E.vx) > 0.7) E.face = E.vx > 0 ? 1 : -1;
        if (E.t <= 0) this.eagleStrike(tg);
        return;
      }
      case 'strike': {
        // a beat at the ring: the talons close on the catch (it is pulled out through the opening) or it bounces off
        E.vx *= 0.8; E.vy *= 0.8;
        const u = clamp(1 - E.t / EAGLE_T.strike, 0, 1);
        if (E.res === 'grab' && E.carry === 'egg') {
          const egg = this.eagleEgg();
          if (egg) this.eagleHold(egg, E.yx + (E.mx - E.yx) * Math.min(1, u * 2.5), E.yy + (E.my - E.yy) * Math.min(1, u * 2.5), 0, 0);
        }
        if (E.res === 'grab' && E.carry === 'snake') this.eagleCarrySnake(E.mx, E.my);
        if (E.t > 0) return;
        if (E.res === 'grab') { E.phase = 'carry'; E.ct = 0; E.ox = E.mx - E.x; E.oy = E.my - E.y; }
        else if (E.res === 'slam' || E.res === 'bounce') this.eagleDaze(null);
        else { E.phase = 'up'; E.t = 1.4; }
        return;
      }
      case 'carry': return this.eagleCarry(dt);
      case 'dazed': {
        // knocked out of the sky for a moment: drifts away from the vault, wobbling
        const n = Math.hypot(E.dzx, E.dzy) || 1;
        this.eagleFly(E.dzx + (E.dzx / n) * 0.2 * Math.sin(this.t * 3), E.dzy + 0.25 * Math.sin(this.t * 4.2), 3.5, 7, dt, 1.5);
        if (E.t <= 0) { E.phase = 'up'; E.t = 1.6; this.emit('eagleWake', { x: E.x, y: E.y }); }
        return;
      }
      case 'up': {
        const [ox, oy] = orbit();
        this.eagleFly(ox, oy, 6.5, 9, dt);
        if (E.t <= 0) { E.phase = 'circle'; E.idle = 0; }
        return;
      }
    }
  }

  // Steer toward (gx, gy) with limited acceleration (smooth arcs for the art). It may cut across the rim of
  // the vault (it flies in front of it) but a line through the middle is replaced by a swing round it on the
  // goal's side, so it never hides the inner rings. Returns the distance left.
  eagleFly(gx, gy, sp, acc, dt, arrive = 2.5, free = false) {
    const E = this.eagle, Rv = this.outerR - 1.0;
    if (!free && E.phase !== 'flee' && E.phase !== 'enter') gx = clamp(gx, -this.outerR + 0.45 * EAGLE_LEN, this.outerR - 0.45 * EAGLE_LEN); // on screen, wings and all
    const dx = gx - E.x, dy = gy - E.y, d = Math.hypot(dx, dy), pr = Math.hypot(E.x, E.y);
    let ux = d > 1e-6 ? dx / d : 0, uy = d > 1e-6 ? dy / d : 0;
    if (d > 0.7 && pr > 1) {
      const s = clamp(-(E.x * dx + E.y * dy) / (d * d), 0, 1), qx = E.x + dx * s, qy = E.y + dy * s;
      if (s < 0.9 && Math.hypot(qx, qy) < Rv + 0.35) {
        const w = Math.sign(E.x * gy - E.y * gx) || E.face, push = clamp((Rv + 0.7 - pr) / 0.7, 0, 1);
        ux = (-E.y / pr) * w + (E.x / pr) * push;
        uy = (E.x / pr) * w + (E.y / pr) * push;
        const l = Math.hypot(ux, uy) || 1;
        ux /= l; uy /= l;
      }
    }
    const v = Math.min(sp, d * arrive), h0 = Math.atan2(E.vy, E.vx), s0 = Math.hypot(E.vx, E.vy);
    let ax = ux * v - E.vx, ay = uy * v - E.vy;
    const a = Math.hypot(ax, ay), m = acc * dt;
    if (a > m) { ax *= m / a; ay *= m / a; }
    E.vx += ax; E.vy += ay;
    E.x += E.vx * dt; E.y += E.vy * dt;
    const r = Math.hypot(E.x, E.y), rmin = this.outerR - 1.2;
    if (r < rmin && r > 1e-6) { E.x *= rmin / r; E.y *= rmin / r; }
    const xm = this.outerR - 0.45 * EAGLE_LEN; // keep the whole bird on screen once it is in
    if (!free && E.phase !== 'flee' && E.phase !== 'enter' && Math.abs(E.x) > xm) {
      const sd = Math.sign(E.x);
      E.x = sd * Math.max(xm, Math.abs(E.x) - 4 * dt);
      if (E.vx * sd > 0) E.vx = 0;
    }
    // the art banks into turns and faces where it flies
    if (E.phase !== 'warn' && Math.abs(E.vx) > 0.7) E.face = E.vx > 0 ? 1 : -1;
    const turn = s0 > 0.5 ? wrap(Math.atan2(E.vy, E.vx) - h0) / dt : 0;
    E.bank += (clamp(turn * 0.3, -1, 1) - E.bank) * Math.min(1, dt * 5);
    return d;
  }

  // lock on (warn): the shadow sweeps onto the target, the screech, then the dive
  eagleLock(tg) {
    const E = this.eagle;
    E.phase = 'warn';
    E.t = E.dur = EAGLE_T.lock * this.PM.warn;
    E.next = E.every;
    E.tk = tg.kind;
    E.tid = tg.kind === 'orb' ? 0 : tg.id;
    E.tph = tg.kind === 'orb' ? tg.orb.ph : 0;
    E.tx = tg.x; E.ty = tg.y;
    E.exp = 0; E.lk = 0; E.idle = 0; E.res = null;
    E.side = Math.sign(E.x * tg.y - E.y * tg.x) < 0 ? 1 : -1; // hover on the side it comes from
    E.n++;
    this.emit('eagleWarn', { x: tg.x, y: tg.y, kind: tg.kind });
  }

  // strike pose: talons at the outer ring's surface (or at the target itself outside the vault), body just outside
  eaglePose(tx, ty) {
    const E = this.eagle, R = this.outerR, d = Math.hypot(tx, ty) || 1, nx = tx / d, ny = ty / d;
    const out = d > R + 0.1;
    E.mx = out ? tx : R * nx;
    E.my = out ? ty : R * ny;
    E.cx = E.mx + nx * EL.foot;
    E.cy = E.my + ny * EL.foot;
    // low on the vault the body would sit on the nest: it strikes from beside, talons reaching across
    const low = -R + 0.25 * EAGLE_LEN;
    if (E.cy < low) {
      const sd = Math.abs(E.mx) > 0.3 ? Math.sign(E.mx) : E.x >= 0 ? 1 : -1, dy = Math.min(low - E.my, EL.foot);
      E.cx = E.mx + sd * Math.sqrt(Math.max(0, EL.foot * EL.foot - dy * dy)); E.cy = E.my + dy;
    }
    E.dtx = tx; E.dty = ty;
  }

  eagleEgg() {
    const E = this.eagle;
    return this.eggs.find((e) => e.id === E.cid && e.alive && !e.saved) || null;
  }

  // a carried egg rides in the talons, out of the physics world
  eagleHold(egg, x, y, vx, vy) {
    const b = egg.body;
    if (b.isActive()) b.setActive(false);
    b.setTransform(Vec2(x, y), b.getAngle() * 0.9);
    b.setLinearVelocity(Vec2(vx, vy));
    b.setAngularVelocity(0);
    egg.ch = this.channelOf(egg);
    egg.freefall = 0;
    egg.drop = 0;
  }

  eagleCarrySnake(x, y) {
    const E = this.eagle, S = this.snakes.find((s) => s.id === E.cid - 1);
    if (!S) return;
    S.carried = true; S.carryX = x; S.carryY = y;
    S.wait = 99; S.spit = null; S.mood = 'ouch'; S.moodT = 1;
    // gripped a third of the way down: both ends hang from the talons and swing; the head dangles out in
    // front and wriggles, curling up now and then to snap at the bird; the tail hangs and twitches
    const n = Math.ceil(S.len / 0.05) + 1, g = Math.round(n * 0.3), f = E.face, sw = Math.sin(this.t * 3.1) * 0.3 - clamp(E.vx * 0.05, -0.5, 0.5);
    const lift = Math.max(0, Math.sin(this.t * 1.7)) ** 2;
    S.pts.length = n;
    S.pts[g] = { x, y: y - 0.03 };
    for (let j = 1; j <= g; j++) {
      const q = S.pts[g - j + 1], w = Math.min(1, j / g), end = clamp((j - g + 6) / 6, 0, 1);
      const a = -Math.PI / 2 + sw + f * (0.5 + 0.9 * Math.exp(-j / 5) + Math.sin(this.t * 6.5 - j * 0.45) * 0.5 * w + 2.2 * lift * end * end);
      S.pts[g - j] = { x: q.x + 0.05 * Math.cos(a), y: q.y + 0.05 * Math.sin(a) };
    }
    for (let j = 1; g + j < n; j++) {
      const q = S.pts[g + j - 1], a = -Math.PI / 2 + sw - f * (0.4 + 0.9 * Math.exp(-j / 5) - Math.sin(this.t * 5 - j * 0.3) * 0.22 * Math.min(1, j / 12));
      S.pts[g + j] = { x: q.x + 0.05 * Math.cos(a), y: q.y + 0.05 * Math.sin(a) };
    }
    S.rad = Math.hypot(x, y); S.a = Math.atan2(y, x);
  }

  eagleStrike(tg) {
    const E = this.eagle, n = this.rings.length;
    E.phase = 'strike';
    E.t = EAGLE_T.strike;
    E.res = 'slam';
    const near = (x, y, r) => Math.hypot(x - E.dtx, y - E.dty) < r;
    if (tg && tg.egg) {
      const egg = tg.egg, p = egg.body.getPosition();
      if (tg.exposed && near(p.x, p.y, 0.8) && this.channelOf(egg) >= n - 1) {
        if (this.armored(egg)) { E.res = 'bounce'; this.emit('eagleBounce', { egg, x: E.mx, y: E.my }); return; }
        if (egg.chick) { E.res = 'chick'; this.chickFlee(egg, 'eagle'); this.emit('eagleGrab', { kind: 'chick', x: p.x, y: p.y }); return; }
        E.res = 'grab'; E.carry = 'egg'; E.cid = egg.id; E.yx = p.x; E.yy = p.y;
        if (egg.joint) this.unMagnet(egg);
        if (egg.bubbleFix) this.popBubble(egg);
        egg.hold = null; egg.honey = 0;
        this.eagleHold(egg, p.x, p.y, 0, 0);
        this.emit('eagleGrab', { kind: 'egg', egg, x: p.x, y: p.y });
        return;
      }
    } else if (tg && tg.snake) {
      if (tg.exposed && near(tg.x, tg.y, 1.1)) {
        E.res = 'grab'; E.carry = 'snake'; E.cid = tg.snake.id + 1;
        this.eagleCarrySnake(E.mx, E.my);
        this.emit('eagleGrab', { kind: 'snake', x: tg.x, y: tg.y });
        return;
      }
    } else if (tg && tg.orb) {
      if (tg.exposed) {
        const o = tg.orb;
        o.alive = false;
        this.kill.push(o.body);
        E.res = 'grab'; E.carry = 'orb'; E.ctype = o.type;
        this.emit('eagleSteal', { power: o.type, x: o.x, y: o.y });
        return;
      }
    }
    if (Math.hypot(E.dtx, E.dty) > this.outerR + 0.1) { E.res = 'miss'; this.emit('eagleMiss', { x: E.x, y: E.y, why: 'dodged' }); return; }
    // solid ring under the talons: it slams into the vault
    this.emit('eagleSlam', { x: E.mx, y: E.my, exposed: E.exp });
    if (E.exp && !this.orbs.some((o) => o.alive && o.src === 'eagle')) {
      const o = this.addOrb('feather', n - 1, Math.atan2(E.my, E.mx), 'eagle');
      this.emit('eagleFeather', { x: E.mx, y: E.my, x2: o.x, y2: o.y });
    }
  }

  // carrying: an egg goes up and back in through the highest opening of the outer ring (from height when
  // that opening is near the top, else the talons put it in through the side); a snake is dropped outside
  // the top of the vault, far from the eggs; an orb is swallowed
  eagleCarry(dt) {
    const E = this.eagle, R = this.outerR, ring = this.rings[this.rings.length - 1];
    E.ct += dt;
    const k = clamp(E.ct / 0.35, 0, 1), sk = k * k * (3 - 2 * k);
    const hang = -EL.foot - (E.carry === 'egg' ? 0.22 : 0), hx = E.ox + (E.face * 0.04 * EAGLE_LEN - E.ox) * sk, hy = E.oy + (hang - E.oy) * sk; // talons swing under the body
    const out = () => { // away from the vault first: sideways and up from under it
      const d = Math.hypot(E.x, E.y) || 1, sd = E.x >= 0 ? 1 : -1, low = E.y < -R * 0.5;
      return [E.x + (E.x / d) * 1.4 + (low ? sd * 1.6 : 0), Math.max(E.y + (E.y / d) * 1.4 + 0.8, this.groundY + 1.6)];
    };
    if (E.carry === 'orb') {
      const [gx, gy] = out();
      this.eagleFly(gx, gy, 5, 9, dt);
      if (E.ct > 1.1) { this.emit('eagleEat', { power: E.ctype, x: E.x, y: E.y }); E.carry = null; E.phase = 'up'; E.t = 1.4; }
      return;
    }
    if (E.carry === 'snake') {
      const gx = clamp(E.x, -1.2, 1.2), gy = R + EL.foot + 0.6;
      const d = this.eagleFly(E.ct < 0.5 ? out()[0] : gx, E.ct < 0.5 ? out()[1] : gy, 5.5, 9, dt);
      this.eagleCarrySnake(E.x + hx, E.y + hy);
      if (E.ct > 0.8 && d < 0.4) { this.eagleRelease(); E.phase = 'up'; E.t = 1.4; }
      return;
    }
    const egg = this.eagleEgg();
    if (!egg) { E.carry = null; E.phase = 'up'; E.t = 1.4; return; }
    let best = null, bs = -2, sc = -9;
    const late = E.ct > EAGLE_T.carry, ea = Math.atan2(E.y, E.x);
    for (const g of ring.gaps) {
      if (!this.snakeGap(g) || g.len < 0.6) continue;
      const a = ring.body.getAngle() + g.a, s = Math.sin(a), v = s - (late ? 0.4 * Math.abs(wrap(a - ea)) : 0); // late: the nearest high one, not chasing round
      if (v > sc) { sc = v; bs = s; best = a; }
    }
    let d = 9, mode = 0;
    if (E.ct < 0.6) { const [gx, gy] = out(); this.eagleFly(gx, gy, 5, 10, dt); }
    else if (best != null && bs > 0.62) {
      // from height, straight down through the opening
      mode = 1;
      d = this.eagleFly(R * Math.cos(best) - hx, R * Math.sin(best) + 1.3 - hy, 5.5, 9, dt, 3);
    } else if (best != null && E.ct > EAGLE_T.carry) {
      // the player keeps the openings low: the talons put it in through the highest one
      mode = 2;
      this.eaglePose(R * Math.cos(best), R * Math.sin(best));
      d = this.eagleFly(E.cx, E.cy, 5, 10, dt, 4, true); // the camera follows it out to a side opening
    } else {
      const ox = Math.sin(this.t * 0.6) * 1.6;
      this.eagleFly(ox, R + 1.3 + EL.foot, 4.5, 7, dt);
    }
    const still = Math.abs(ring.omega || 0) < 0.3 || E.ct > EAGLE_T.carry + 4; // never let go over an opening that is swinging away (unless it never stops)
    if (mode === 2 && d < 1) {
      // the talons reach in through the opening and set it down inside
      const r = ring.r - RING_TH / 2 - 0.32, u = clamp((1 - d) / 0.75, 0, 1);
      const ix = r * Math.cos(best), iy = r * Math.sin(best);
      this.eagleHold(egg, E.x + hx + (ix - E.x - hx) * u, E.y + hy + (iy - E.y - hy) * u, 0, 0);
      if (u >= 1 && still) this.eagleRelease();
    } else {
      this.eagleHold(egg, E.x + hx, E.y + hy, E.vx, E.vy);
      if (mode === 1 && d < 0.3 && still) this.eagleRelease();
    }
  }

  // let go of whatever it holds where it is (a drop, a daze, the end of the level)
  eagleRelease() {
    const E = this.eagle;
    if (E.carry === 'egg') {
      const egg = this.eagleEgg();
      if (egg) {
        const b = egg.body;
        b.setActive(true);
        b.setLinearVelocity(Vec2(E.vx * 0.4, Math.min(0, E.vy * 0.4) - 0.4));
        b.setAwake(true);
        egg.ch = this.channelOf(egg);
        E.dropId = egg.id; E.dropT = 0; E.dropArm = 0;
        egg.eagleDropped = 1; // display only (the crack popup says why)
        const p = b.getPosition();
        this.emit('eagleDrop', { egg, x: p.x, y: p.y });
      }
    } else if (E.carry === 'snake') {
      const S = this.snakes.find((s) => s.id === E.cid - 1);
      if (S) {
        // back outside the vault, curled up on the top: it has to find its way in again
        const R = this.outerR + 1.0, a0 = clamp(Math.atan2(E.y, E.x), 0.35, Math.PI - 0.35), dir = E.face;
        S.carried = false; S.carryX = S.carryY = undefined;
        S.rad = R; S.a = a0; S.wait = 2; S.mood = 'ouch'; S.moodT = 1.5;
        const n = Math.ceil(S.len / 0.05) + 1;
        S.pts.length = 0;
        for (let i = 0; i < n; i++) { const a = a0 - dir * (i * 0.05) / R; S.pts.push({ x: R * Math.cos(a), y: R * Math.sin(a) }); }
        this.emit('eagleDropSnake', { x: S.pts[0].x, y: S.pts[0].y, id: S.id });
      }
    }
    E.carry = null; E.cid = 0;
  }

  // a dropped egg: the crack ladder judges its landing (EAGLE_MODE.drop rings' worth of fall), once
  eagleDropTrack(dt) {
    const E = this.eagle;
    if (!E.dropId) return;
    const egg = this.eggs.find((e) => e.id === E.dropId);
    if (!egg || !egg.alive || egg.saved || (E.dropT += dt) > 5) { E.dropId = 0; return; }
    if (E.dropArm && egg.drop < 2) { E.dropId = 0; egg.safeT = Math.max(egg.safeT, 0.8); return; } // judged once: the tumble after is free
    egg.drop = this.EM.drop;
    egg.freefall = Math.max(egg.freefall, 1);
    E.dropArm = 1;
  }

  eagleDaze(by) {
    const E = this.eagle, R = this.outerR;
    if (E.carry) this.eagleRelease();
    E.phase = 'dazed';
    E.t = EAGLE_T.daze * this.EM.daze;
    // it reels away from the vault (out to the side when it hit the underside) and hangs there wobbling
    // it reels away and flops about in the open: beside the nest when it hit the underside, else outward
    const a = Math.atan2(E.y, E.x), sd = E.x >= 0 ? 1 : -1;
    if (Math.sin(a) < -0.45) { E.dzx = sd * Math.min(R * 0.7, 4.8); E.dzy = this.groundY + 0.8 * EAGLE_LEN; }
    else { E.dzx = clamp((R + 1.0) * Math.cos(a), -R + 0.45 * EAGLE_LEN, R - 0.45 * EAGLE_LEN); E.dzy = (R + 1.0) * Math.sin(a) + 0.5; }
    const dx = E.dzx - E.x, dy = E.dzy - E.y, l = Math.hypot(dx, dy) || 1;
    E.vx = (dx / l) * 4.5; E.vy = (dy / l) * 4.5 + 1.2;
    this.emit('eagleDazed', { x: E.x, y: E.y, by: by || E.res });
  }

  // Hazards that touch the sky call this (kind: 'gust' | 'bolt' | 'lavarock' | 'icicle' | ...). o = {x, y, dir, power, r}:
  // a gust (dir +1/-1, or {x, y}) shoves it and spoils a lock-on or dive; anything solid within o.r of it (or
  // with no position) dazes it and it lets go of what it carries. Returns true if the eagle was affected.
  hitEagle(kind, o = {}) {
    const E = this.eagle;
    if (!E || E.end || E.phase === 'away' || E.phase === 'enter') return false;
    const ox = o.x, oy = o.y;
    if (kind === 'gust') {
      const p = o.power ?? 1, dx = typeof o.dir === 'object' && o.dir ? o.dir.x : (o.dir ?? (this.wind >= 0 ? 1 : -1)), dy = typeof o.dir === 'object' && o.dir ? o.dir.y : 0.25;
      E.vx += dx * p * 3.5; E.vy += dy * p * 3.5;
      if (E.phase === 'warn' || E.phase === 'dive') { E.phase = 'up'; E.t = 1.5; this.emit('eagleMiss', { x: E.x, y: E.y, why: 'gust' }); }
      return true;
    }
    if (ox != null && oy != null && Math.hypot(ox - E.x, oy - E.y) > (o.r ?? 1.4)) return false;
    if (E.phase === 'dazed') { E.t = Math.max(E.t, 1); return true; }
    this.eagleDaze(kind);
    return true;
  }

  // the level is over: on a win it flies off; on a loss it perches on top of the vault and screeches
  eagleFlee(won) {
    const E = this.eagle;
    if (!E || E.end) return;
    if (E.carry) this.eagleRelease();
    E.end = won ? 'win' : 'lose';
    E.phase = won ? 'flee' : 'gloat';
    E.t = 0;
    this.emit('eagleFlee', { won: !!won, x: E.x, y: E.y });
  }

  eagleEnd(dt) {
    const E = this.eagle, R = this.outerR;
    if (!E.end) {
      if (E.phase === 'away') return;
      this.eagleFlee(this.state === 'winning' || this.state === 'won');
    }
    E.t += dt;
    if (E.phase === 'flee') this.eagleFly(E.face * (R + 14), R + 10, 11, 14, dt);
    else if (this.eagleFly(0, R + EL.perch, 6, 10, dt, 3) < 0.25 && !E.scr) { E.scr = 1; this.emit('eagleScreech', { x: E.x, y: E.y }); }
  }

  // Targets, best first: an exposed snake, chick, egg or orb in the outer channel; else an egg in the outer
  // channels it can still dive at (the ring shields it: a slam). A snake or orb right after the same kind of
  // catch scores lower, so it switches between them. With E, the locked target's current state.
  eagleTarget(E) {
    const n = this.rings.length, R = this.outerR;
    let best = null, bs = -1e9;
    const take = (s, o) => { if (s > bs) { bs = s; best = o; } };
    const again = (k) => (!E && this.eagle.last === k ? 200 : 0); // it took one of those last time: an egg looks better now
    for (const e of this.aliveEggs()) {
      if (E && (E.tk === 'snake' || E.tk === 'orb' || E.tid !== e.id)) continue;
      if (e.id === this.eagle.cid || !e.body.isActive()) continue;
      const c = this.channelOf(e), p = e.body.getPosition(), ex = c >= n - 1 && this.eagleReach(p.x, p.y);
      if (!E && (c >= n || c < n - 3 || (e.chick && c < n - 1))) continue;
      const s = (e.chick ? 320 : c === n - 1 ? 200 : 80 + c) + (ex ? 100 : 0) - (this.armored(e) ? 150 : 0);
      take(s, { kind: e.chick ? 'chick' : 'egg', id: e.id, x: p.x, y: p.y, egg: e, exposed: ex });
    }
    for (const S of this.snakes) {
      if (E && (E.tk !== 'snake' || E.tid !== S.id + 1)) continue;
      if (S.gone || S.carried || !S.inside || S.pts.length < 2) continue;
      const h = S.pts[0], d = Math.hypot(h.x, h.y), ex = d > R || (this.chAt(d) === n - 1 && this.eagleReach(h.x, h.y));
      if (!E && !ex) continue;
      take(380 - again('snake'), { kind: 'snake', id: S.id + 1, x: h.x, y: h.y, snake: S, exposed: ex });
    }
    for (const o of this.orbs) {
      if (E && (E.tk !== 'orb' || o.ph !== E.tph)) continue;
      if (!o.alive || o.src === 'eagle' || o.ch !== n - 1) continue;
      const ex = this.eagleReach(o.x, o.y);
      if (!E && !ex) continue;
      take(260 - again('orb'), { kind: 'orb', id: 0, x: o.x, y: o.y, orb: o, exposed: ex });
    }
    return best;
  }

  // Can the talons reach this point? Outside the vault always; inside, only near an opening in the outer ring.
  eagleReach(x, y) {
    const ring = this.rings[this.rings.length - 1], d = Math.hypot(x, y);
    if (d > ring.r + RING_TH / 2) return true;
    const a = Math.atan2(y, x), step = EAGLE_REACH / 6 / ring.r;
    for (let j = -6; j <= 6; j++) {
      const b = a + j * step;
      if (!this.solidAt(ring, ring.r * Math.cos(b), ring.r * Math.sin(b))) return true;
    }
    return false;
  }

  // The level is decided: the fox ducks out of sight on a win, laughs on a fail
  foxEnd(dt) {
    const F = this.fox, won = this.state === 'winning' || this.state === 'won';
    F.duck = Math.min(1, (F.duck || 0) + (won ? dt * 2 : 0));
    F.mood = won ? 'shocked' : 'laugh'; F.moodT = 9; F.t = 9;
  }

  // Fox thrower (G36): strolls along the top of the vault and drops an orb into the outer channel.
  foxStep(dt) {
    const F = this.fox, n = this.rings.length;
    F.x = Math.sin(this.t * 0.35) * this.outerR * 0.45;
    if (F.moodT > 0 && (F.moodT -= dt) <= 0) F.mood = 'smug';
    if ((F.t -= dt) > 0) return;
    F.t = F.every;
    if (this.orbs.filter((o) => o.alive && o.src === 'fox').length >= 3) return;
    const type = F.throws[F.k++ % F.throws.length];
    const fy = this.outerR + 0.35, o = this.addOrb(type, n - 1, Math.atan2(fy, F.x), 'fox');
    F.mood = 'laugh';
    F.moodT = 1.4;
    this.emit('foxThrow', { power: o.type, x: F.x, y: fy, x2: o.x, y2: o.y });
  }

  // danger cue (I8): 0..1 while a snake head is within one ring of an egg (or the eagle eyes one)
  dangerStep() {
    const n = this.rings.length;
    let lv = 0;
    for (const S of this.snakes) {
      if (S.gone || !S.inside || !S.pts.length) continue;
      const hc = this.chAt(S.rad), h = S.pts[0];
      for (const e of this.aliveEggs()) {
        const c = this.channelOf(e);
        if (c >= n || Math.abs(c - hc) > 1) continue;
        const p = e.body.getPosition();
        lv = Math.max(lv, clamp(1.25 - Math.hypot(p.x - h.x, p.y - h.y) / 3, 0.3, 1));
      }
    }
    const E = this.eagle;
    if (E && (E.phase === 'warn' || E.phase === 'dive') && E.tk !== 'snake' && E.tk !== 'orb') lv = Math.max(lv, E.reach ? 0.9 : 0.5);
    lv = Math.round(lv * 10) / 10;
    if (lv !== this.danger) { this.danger = lv; this.emit('danger', { level: lv }); }
  }

  predState() {
    return {
      snakes: this.snakes.map((S) => ({ ...S, pts: S.pts.map((q) => ({ ...q })), spit: S.spit ? { ...S.spit } : null })),
      barriers: this.barriers.map((b) => [b.alive, b.melt, b.burn, b.fire, b.venom]),
      eagle: this.eagle ? { ...this.eagle } : null,
      fox: this.fox ? { ...this.fox, throws: [...this.fox.throws] } : null,
      danger: this.danger,
      clash: [this.clashCD, this.clashN, this.predPts],
      vh: this.rings.map((r) => r.segs.map((g) => (g.vh ? 1 : 0))),
    };
  }

  predLoad(P) {
    if (!P) return;
    this.snakes = P.snakes.map((S) => ({ ...S, pts: S.pts.map((q) => ({ ...q })), spit: S.spit ? { ...S.spit } : null }));
    P.barriers.forEach(([alive, melt, burn, fire, venom], i) => {
      const b = this.barriers[i];
      Object.assign(b, { melt, burn, fire, venom });
      if (!alive && b.alive) { b.alive = false; this.rings[b.ring].body.destroyFixture(b.fix); }
    });
    if (P.eagle) {
      this.eagle = { ...P.eagle };
      const e = this.eagle.carry === 'egg' && this.eagleEgg();
      if (e) e.body.setActive(false); // a catch in the talons is out of the physics world
    }
    if (P.fox) this.fox = { ...P.fox, throws: [...P.fox.throws] };
    this.danger = P.danger || 0;
    [this.clashCD, this.clashN, this.predPts] = P.clash || [0, 0, 0];
    (P.vh || []).forEach((r, i) => r.forEach((v, k) => { this.rings[i].segs[k].vh = v; }));
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
        animalsHit(this, 'quake', {}); // v3.1
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
          if (Math.hypot(p.x - m.x, p.y - m.y) < 0.32) { gone = true; if (e.water > 0) this.emit('emberFizz', { x: m.x, y: m.y }); else { this.emit('emberHit', { x: m.x, y: m.y, egg: e }); this.crack(e, 0, 'ember'); } }
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
    animalsHit(this, 'bolt', { x: p.x, y: p.y, r: 0.8 }); // v3.1: snakes, the eagle and the fox react
    for (const e of this.aliveEggs()) {
      const q = e.body.getPosition();
      if (Math.hypot(q.x - p.x, q.y - p.y) < 0.6) this.crack(e, 0, 'lightning');
    }
  }

  // Is there solid ring (a live segment or a closed shutter) at this world point's angle?
  solidAt(ring, x, y) {
    let la = Math.atan2(y, x) - ring.body.getAngle();
    la = ((la % TAU) + TAU) % TAU;
    for (const g of ring.segs) if (g.alive && !(g.melt > 0) && ((la >= g.a0 && la < g.a1) || (la + TAU >= g.a0 && la + TAU < g.a1))) return true;
    for (const g of ring.gaps) if (!this.snakeGap(g) && Math.abs(wrap(la - g.a)) < g.len / (2 * ring.r)) return true; // doors, curtains, grates
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
    EGG_KEYS.push('peckK', 'peckT', 'peckHit'); // predators (v3)
    EGG_KEYS.push('kind', 'guard', 'rockskin', 'curse', 'drop', 'lavaCD', 'fled'); // v3
    EGG_KEYS.push(...CHICK_KEYS); // v3.2 chick kinds
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
      pred: this.predState(), // predators (v3)
      wx: { ...this.wx, bolt: this.wx.bolt ? { ...this.wx.bolt } : null },
      embers: this.embers.map((m) => ({ ...m })),
      nest: bodyS(this.nest),
      v3: this.v3State(),
      v31: v31State(this), // bosses (v3.1)
      chick: this.chickState(), // v3.2
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
        const egg = sim.addEgg(es.b[0], es.b[1], es.cracks, { golden: es.golden, kind: es.kind });
        setB(egg.body, es.b);
        const { b, gates, spk, stone, bubble, magnet, chick, hold, alive, saved, ...rest } = es;
        Object.assign(egg, rest, { gates: new Set(gates || []), spk: new Set(spk || []), hold: hold ? { ...hold } : null });
        if (stone > 0) { sim.setStone(egg, true); egg.stone = stone; }
        if (bubble > 0) { sim.setBubble(egg); egg.bubble = bubble; }
        if (chick) sim.hatch(egg, true);
      } else {
        sim.eggs.push({ id: es.id, alive: es.alive, saved: es.saved, cracks: es.cracks, body: null, mult: es.mult, prize: es.prize, chick: es.chick, kind: es.kind, fled: es.fled });
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
    sim.predLoad(S.pred); // predators (v3)
    if (S.wx) sim.wx = { ...S.wx, bolt: S.wx.bolt ? { ...S.wx.bolt } : null };
    sim.embers = (S.embers || []).map((m) => ({ ...m }));
    sim.v3Restore(S.v3);
    v31Load(sim, S.v31); // bosses (v3.1)
    sim.chickRestore(S.chick); // v3.2
    sim.events.length = 0;
    S.bombs.forEach((bs, i) => { const b = sim.bombs[i]; Object.assign(b, { lit: bs.lit, fuse: bs.fuse }); if (!bs.alive) { b.alive = false; sim.world.destroyBody(b.body); } else setB(b.body, bs.b); });
    S.rocks.forEach((rs, i) => setB(sim.rocks[i].body, rs.b));
    setB(sim.nest, S.nest);
    sim.rs = S.rs; // re-creating eggs and orbs above drew from the rng
    sim.snaps = [];
    return sim;
  }

  // ---------- v3 physics ----------
  // Gaps of a ring: level gaps (flags curtain, grate) plus the spec shorthands: curtain: n (the first n
  // open gaps get a thorn curtain), grate: n (n grated openings in the middle of the widest solid arcs).
  v3Gaps(spec, r) {
    const cur = () => ({ alive: true, burn: 0, burning: false, fixes: [] });
    const gaps = (spec.gaps || []).map((g) => ({ a: deg(g.a), len: g.len || (g.grate ? 0.7 : 0.78), x: g.x || 1, shut: g.shut || null, o: 1, curtain: g.curtain ? cur() : null, grate: !!g.grate }));
    for (let k = 0, n = spec.curtain || 0; k < gaps.length && n > 0; k++) if (!gaps[k].grate && !gaps[k].curtain) { gaps[k].curtain = cur(); n--; }
    for (let k = 0; k < (spec.grate || 0); k++) {
      let best = null;
      for (const arc of solidArcs(r, gaps)) if (!best || arc[1] - arc[0] > best[1] - best[0]) best = arc;
      if (!best || (best[1] - best[0]) * r < 1.6) break;
      gaps.push({ a: wrap((best[0] + best[1]) / 2), len: 0.7, x: 1, shut: null, o: 1, curtain: null, grate: true });
    }
    return gaps;
  }

  // One-way rings (G22), and fixtures across special gaps: thorn curtains (G20/I7), grates (I4), and
  // bars across gaps too narrow for an ostrich egg (only made when the level has one).
  v3Ring(ring) {
    ring.oneway = Math.sign(ring.spec.oneway || 0);
    const r = ring.r, ri = r - RING_TH / 2, ro = r + RING_TH / 2, big = (this.level.eggKinds || []).includes('ostrich');
    const across = (g, kind) => {
      const half = g.len / (2 * r), n = Math.max(2, Math.ceil(g.len / 0.2)), out = [];
      for (let k = 0; k < n; k++) {
        const b0 = g.a - half + (2 * half * k) / n, b1 = g.a - half + (2 * half * (k + 1)) / n;
        out.push(ring.body.createFixture({
          shape: new Polygon([Vec2(ri * Math.cos(b0), ri * Math.sin(b0)), Vec2(ro * Math.cos(b0), ro * Math.sin(b0)), Vec2(ro * Math.cos(b1), ro * Math.sin(b1)), Vec2(ri * Math.cos(b1), ri * Math.sin(b1))]),
          friction: 0.4, restitution: 0.1, ...filt('RING'), userData: { kind, gap: g, ring },
        }));
      }
      return out;
    };
    for (const g of ring.gaps) {
      if (g.curtain) g.curtain.fixes = across(g, 'curtain');
      else if (g.grate) across(g, 'grate');
      else if (big && g.len < OSTRICH_GAP) { g.narrow = true; across(g, 'narrow'); } // drawn as a bar (only the ostrich is held)
    }
  }

  // Contacts switched off before any impact is measured: melted ring, grate (quail and debris pass),
  // narrow-gap bar (only an ostrich is held), a burnt curtain or debris through a curtain.
  v3Pass(ua, ub) {
    for (const [u, o] of [[ua, ub], [ub, ua]]) {
      if (u.kind === 'seg' && u.seg.melt > 0) return true;
      if (u.kind === 'grate') return !o.kind || (o.kind === 'egg' && o.egg.kind === 'quail');
      if (u.kind === 'narrow') return !(o.kind === 'egg' && o.egg.kind === 'ostrich');
      if (u.kind === 'curtain') return !u.gap.curtain.alive || !o.kind;
    }
    return false;
  }

  // Egg contacts with v3 rules. Returns true when it has dealt with the contact.
  v3Contact(c, egg, other) {
    if (!egg || !egg.alive || egg.saved || !other) return false;
    if (v31Contact(this, c, egg, other)) return true; // bosses (v3.1): ice patches, temporary walls
    if (other.kind === 'curtain') { this.curtainTouch(c, egg, other); return true; }
    const heavy = egg.stone > 0 || (egg.kind === 'ostrich' && egg.drop >= 2);
    if (other.kind === 'thorn' && other.thorn.alive && egg.fire <= 0) {
      // stone, and an ostrich falling 2+ rings, flatten the whole cluster (G16, I3)
      if (heavy) { c.setEnabled(false); const th = other.thorn; this.defer(() => this.smashCluster(th, egg)); return true; }
      if (egg.guard > 0) return true; // guardian feather: thorns can't hurt, the egg bumps off
    }
    if (other.kind === 'seg' && heavy) {
      const sg = other.seg;
      if (sg.alive && sg.ring.M.hp && sg.hp < sg.ring.M.hp && !sg.dying) { sg.dying = true; this.defer(() => this.breakSeg(sg, 'shatter')); }
    }
    return false;
  }

  smashCluster(th, egg) {
    const ring = th.ring;
    let n = 0;
    for (const o of ring.thorns) if (o.alive && o.side === th.side && Math.abs(wrap(o.a - th.a)) * ring.r < 0.45) { this.removeThorn(o, 'snap'); n++; }
    if (n) { const p = egg.body.getPosition(); this.emit('smash', { egg, n, x: p.x, y: p.y }); }
  }

  // Thorn curtain: only fire (red or black flame) burns it away; it hurts everything else like a thorn.
  curtainTouch(c, egg, u) {
    const g = u.gap, C = g.curtain, ring = u.ring;
    if (!C.alive) { c.setEnabled(false); return; }
    const at = () => ring.body.getWorldPoint(Vec2(ring.r * Math.cos(g.a), ring.r * Math.sin(g.a)));
    if (egg.fire > 0 && (egg.fireKind === 'fire_red' || egg.fireKind === 'fire_black')) {
      if (!C.burning) { C.burning = true; this.defer(() => { const p = at(); this.emit('curtainBurn', { x: p.x, y: p.y, ring: ring.i }); }); }
      return; // the egg sits on it while it burns
    }
    if (C.burning || egg.stone > 0 || egg.guard > 0) return; // stone and the feather just bump off
    if (egg.bubbleFix) { if (!egg.popping) { egg.popping = true; egg.safeT = 0.4; this.defer(() => { egg.popping = false; this.popBubble(egg, true); }); } return; }
    if (egg.golden) { egg.golden = 0; egg.safeT = 0.6; this.emit('goldenSave', { egg }); return; }
    if (egg.safeT > 0) return;
    const key = 'c' + ring.i + ':' + ring.gaps.indexOf(g);
    if (this.MD.softThorns && !egg.chick) {
      // Easy: a crack (never the breaking one) and a shove off, once per touch
      if (!egg.spk.has(key)) {
        egg.spk.add(key);
        this.defer(() => {
          if (!egg.alive || egg.saved) return;
          if (egg.cracks < 2) this.crack(egg, 0, 'curtain');
          const b = egg.body, p = b.getPosition(), q = at(), dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy) || 1, m = b.getMass() * 1.6;
          b.applyLinearImpulse(Vec2((dx / d) * m, (dy / d) * m), p, true);
        });
      }
      return;
    }
    egg.safeT = 1;
    c.setEnabled(false);
    this.defer(() => { egg.safeT = 0; this.breakEgg(egg, 'curtain'); });
  }

  v3EndContact(ua, ub) {
    for (const [u, o] of [[ua, ub], [ub, ua]]) if (u.kind === 'egg' && o.kind === 'curtain') u.egg.spk.delete('c' + o.ring.i + ':' + o.ring.gaps.indexOf(o.gap));
  }

  // Can ring turn by delta? One-way rings (and a gear partner's one-way) say which way.
  canTurn(ring, delta) {
    if (ring.lock > 0) return false; // bosses (v3.1): frozen or punched
    if (ring.oneway && Math.sign(delta) !== ring.oneway) return false;
    if (ring.gear && ring.gear.oneway && -Math.sign(delta) !== ring.gear.oneway) return false;
    return true;
  }
  // Is gap g a way down for this egg?
  gapOpenFor(g, egg) {
    if (g.curtain && g.curtain.alive) return false;
    if (g.grate) return !!egg && egg.kind === 'quail';
    if (egg && egg.kind === 'ostrich' && g.len < OSTRICH_GAP) return false;
    return true;
  }

  // after the gear pass: a one-way ring (and its gear partner) never turns the wrong way; under the
  // hourglass the player's rings keep their real-time speed while the world runs at half speed
  v3Rings() {
    for (const ring of this.rings) {
      if (!ring.oneway || ring.motor || ring.omega * ring.oneway >= 0) continue;
      for (const r of ring.gear ? [ring, ring.gear] : [ring]) { r.omega = 0; r.target = r.body.getAngle(); }
    }
    if (this.slowT > 0) for (const ring of this.rings) if (!ring.motor) ring.omega *= 2;
  }

  fuseRate() {
    return this.slowT > 0 ? 0 : this.curseT > 0 ? 2 : 1; // hourglass stops the fuse, the fox curse doubles it
  }

  // crack ladder (G34): cracks for a fall through n rings at once. 1 ring is always safe; 2 = 1 crack,
  // 3 = 2, 4+ = broken. Easy is one ring gentler, a quail one ring harsher, water halves it.
  fallDamage(egg, n) {
    if (n < 2) return 0;
    let d = n - 1 - (this.mode === 'easy' ? 1 : 0) + (egg.kind === 'quail' ? 1 : 0);
    if (egg.water > 0) d = Math.floor(d / 2);
    return Math.max(0, d);
  }
  landSafe(egg) {
    return egg.soft ? 'sponge' : egg.chick ? 'chick' : egg.bubbleFix ? 'bubble' : egg.stone > 0 ? 'stone' : egg.guard > 0 ? 'feather' : egg.honey > 0 ? 'honey' : null;
  }
  landFall(egg) {
    const n = egg.drop, p = egg.body.getPosition();
    egg.drop = 0;
    const why = this.landSafe(egg), d = why ? 0 : this.fallDamage(egg, n);
    if (!d) { this.emit('softLand', { egg, rings: n, why: why || (egg.water > 0 ? 'water' : 'ok'), x: p.x, y: p.y }); return; }
    this.emit('fallLand', { egg, rings: n, dmg: d, x: p.x, y: p.y });
    if (egg.cracks + d >= 3) { egg.cracks = 3; this.breakEgg(egg, 'fall'); } else this.crack(egg, 0, 'fall', d);
  }

  // Global powers (G29 hourglass, G39 feather, G40 rock skin, G30 fox curse).
  v3Power(t, egg) {
    const T = V3_POWER[t], eggs = this.aliveEggs();
    if (t === 'hourglass') this.slowT = T;
    else if (t === 'foxcurse') { this.curseT = T; for (const e of eggs) e.curse = T; }
    else if (t === 'feather') { this.guardT = T; for (const e of eggs) e.guard = T; }
    else if (t === 'rockskin') {
      this.skinT = T;
      for (const e of eggs) if (!e.chick) { e.rockskin = T; if (e.stone > 0) e.stone = Math.max(e.stone, T); else { this.setStone(e, true); e.stone = T; } }
    }
    this.emit('powerOn', { power: t, dur: T, egg });
  }

  // per egg, every step (inside the egg loop)
  v3Egg(egg, dt) {
    const b = egg.body;
    if (egg.guard > 0) egg.guard -= DT; // power timers run in real time, also under the hourglass
    if (egg.curse > 0) egg.curse -= DT;
    if (egg.rockskin > 0) egg.rockskin -= DT;
    if (egg.lavaCD > 0) egg.lavaCD -= DT;
    // portal suction (G18): a pull toward the mouth from every side, growing near the centre
    const p = b.getPosition(), m = b.getMass();
    for (const pt of this.portals) {
      if (!pt.pull || egg.portalCD > 0 || egg.honey > 0) continue;
      const dx = pt.ax - p.x, dy = pt.ay - p.y, d = Math.hypot(dx, dy);
      if (d > pt.pull || d < 1e-3 || this.chAt(Math.hypot(p.x, p.y)) !== this.chAt(Math.hypot(pt.ax, pt.ay))) continue;
      const k = 1 - d / pt.pull, f = m * (3 + 16 * k * k);
      b.applyForceToCenter(Vec2(((dx + dy * 0.25) / d) * f, ((dy - dx * 0.25) / d) * f), true);
    }
    // duck egg: floats and rides a water current
    if (egg.kind === 'duck' && this.weather === 'current') b.applyForceToCenter(Vec2(this.wind * m * 0.8, m * this.g * 0.8), true);
  }

  // world things, every step in play
  v3Step(dt) {
    const off = (k, power) => { if (this[k] > 0 && (this[k] -= DT) <= 0) { this[k] = 0; this.emit('powerOff', { power }); } };
    off('slowT', 'hourglass');
    off('guardT', 'feather');
    off('skinT', 'rockskin');
    off('curseT', 'foxcurse');
    if (this.curseT > 0 && (this.jitT -= DT) <= 0) {
      this.jitT = 0.18; // cursed eggs twitch
      for (const e of this.aliveEggs()) if (e.curse > 0 && e.honey <= 0) { const m = e.body.getMass(); e.body.applyLinearImpulse(Vec2((this.rand() - 0.5) * 0.8 * m, this.rand() * 0.4 * m), e.body.getPosition(), true); }
    }
    for (const ring of this.rings) {
      for (const sg of ring.segs) {
        if (!(sg.melt > 0)) continue;
        // a melted hole re-forms after HOLE_T, but never into an egg
        if ((sg.melt -= dt) <= 0) { sg.melt = this.eggOnSeg(ring, sg) ? 0.05 : 0; if (!sg.melt) { sg.vh = 0; this.emit('meltHeal', { ring: ring.i }); } }
      }
      for (const g of ring.gaps) {
        const C = g.curtain;
        if (!C || !C.alive || !C.burning || (C.burn += DT / CURTAIN_BURN) < 1) continue;
        C.alive = false;
        for (const f of C.fixes) this.killFix.push([ring.body, f]);
        const q = ring.body.getWorldPoint(Vec2(ring.r * Math.cos(g.a), ring.r * Math.sin(g.a)));
        this.emit('curtainGone', { x: q.x, y: q.y, ring: ring.i });
      }
    }
    this.lavaStep(dt);
    v31Step(this, dt); // bosses (v3.1): boss attacks, falling ice (replaces the old top-down icicles), walls, ring locks
  }

  eggOnSeg(ring, sg) {
    for (const e of this.aliveEggs()) {
      const p = e.body.getPosition(), d = Math.hypot(p.x, p.y);
      if (Math.abs(d - ring.r) > RING_TH / 2 + 0.3) continue;
      const la = ((Math.atan2(p.y, p.x) - ring.body.getAngle()) % TAU + TAU) % TAU, pad = 0.3 / ring.r;
      for (const x of [la, la + TAU, la - TAU]) if (x > sg.a0 - pad && x < sg.a1 + pad) return true;
    }
    return false;
  }

  // Lava rocks (G31): telegraphed, they arc in from the backdrop onto a ring (ROCK_FLY), sit there
  // glowing (ROCK_SIT: touching one blasts the egg away and cracks it), then melt a hole through the
  // ring that stays open for HOLE_T. A water egg cools a rock away.
  rockAt(k) {
    const ring = this.rings[k.ri];
    return ring.body.getWorldPoint(Vec2(ring.r * Math.cos(k.la), ring.r * Math.sin(k.la)));
  }
  lavaStep(dt) {
    const LV = this.level.lava;
    if (LV && typeof LV === 'object' && (this.v3T.lava -= dt) <= 0) {
      this.v3T.lava = LV.every || 7;
      const ri = Math.floor(this.rand() * this.rings.length), ring = this.rings[ri];
      const wa = -Math.PI / 2 + (this.rand() - 0.5) * Math.PI * 1.3;
      const k = { ri, la: wa - ring.body.getAngle(), ph: 'fly', t: 0, x0: (this.rand() - 0.5) * this.outerR, y0: this.outerR + 3, x: 0, y: 0 };
      const q = this.rockAt(k);
      k.x = k.x0; k.y = k.y0;
      this.lavaRocks.push(k);
      this.emit('lavaWarn', { x: q.x, y: q.y, ring: ri });
    }
    for (let i = this.lavaRocks.length - 1; i >= 0; i--) {
      const k = this.lavaRocks[i], q = this.rockAt(k);
      k.t += dt;
      if (k.ph === 'fly') {
        const f = Math.min(1, k.t / ROCK_FLY);
        k.x = k.x0 + (q.x - k.x0) * f;
        k.y = k.y0 + (q.y - k.y0) * f + 1.6 * Math.sin(Math.PI * f);
        if (f >= 1) {
          k.ph = 'sit'; k.t = 0;
          this.emit('lavaLand', { x: q.x, y: q.y, ring: k.ri });
          animalsHit(this, 'rock', { x: q.x, y: q.y, r: 0.75 }); // v3.1: animals feel it too
          if (this.rockHits(k, q, 0.75)) { this.lavaRocks.splice(i, 1); continue; }
        }
        continue;
      }
      k.x = q.x; k.y = q.y;
      for (const S of this.snakesNear(q.x, q.y, 0.5)) if (!(S.stun > 0)) this.hitSnake(S, 'lava', { x: q.x, y: q.y });
      if (this.rockHits(k, q, 0.4)) { this.lavaRocks.splice(i, 1); continue; }
      if (k.t >= ROCK_SIT) {
        const ring = this.rings[k.ri], half = HOLE_LEN / (2 * ring.r);
        for (const sg of ring.segs) if (sg.alive && Math.abs(wrap((sg.a0 + sg.a1) / 2 - k.la)) < half) { sg.melt = HOLE_T; sg.vh = 0; }
        this.emit('lavaMelt', { x: q.x, y: q.y, ring: k.ri });
        this.lavaRocks.splice(i, 1);
      }
    }
  }
  // eggs within R of a landed rock: a water egg cools it (returns true: rock gone), others are blasted
  rockHits(k, q, R) {
    for (const e of this.aliveEggs()) {
      const p = e.body.getPosition(), dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy);
      if (d > R) continue;
      if (e.water > 0) { this.emit('lavaCool', { egg: e, x: q.x, y: q.y }); return true; }
      if (e.lavaCD > 0) continue;
      e.lavaCD = 0.8;
      if (e.honey > 0) { e.honey = 0; e.hold = null; e.honeyCD = 1; }
      const m = e.body.getMass() * 4.5, u = d || 1;
      e.body.applyLinearImpulse(Vec2((dx / u) * m, (dy / u) * m + m * 0.3), p, true);
      this.emit('lavaBlast', { egg: e, x: p.x, y: p.y });
      this.crack(e, 0, 'lavarock');
    }
    return false;
  }

  v3State() {
    return {
      slowT: this.slowT, curseT: this.curseT, jitT: this.jitT, guardT: this.guardT || 0, skinT: this.skinT || 0, v3T: { ...this.v3T },
      lavaRocks: this.lavaRocks.map((k) => ({ ...k })), icicles: this.icicles.map((c) => ({ ...c })),
      rings: this.rings.map((r) => ({ melt: r.segs.map((g) => g.melt || 0), cur: r.gaps.map((g) => (g.curtain ? [g.curtain.alive, g.curtain.burn, g.curtain.burning] : null)) })),
    };
  }
  v3Restore(V) {
    if (!V) return;
    Object.assign(this, { slowT: V.slowT, curseT: V.curseT, jitT: V.jitT, guardT: V.guardT, skinT: V.skinT, v3T: { ...V.v3T } });
    this.lavaRocks = V.lavaRocks.map((k) => ({ ...k }));
    this.icicles = V.icicles.map((c) => ({ ...c }));
    V.rings.forEach((rs, i) => {
      const ring = this.rings[i];
      rs.melt.forEach((m, k) => { ring.segs[k].melt = m; });
      rs.cur.forEach((cs, k) => {
        const C = ring.gaps[k].curtain;
        if (!C || !cs) return;
        C.burn = cs[1]; C.burning = cs[2];
        if (!cs[0] && C.alive) { C.alive = false; for (const f of C.fixes) ring.body.destroyFixture(f); }
      });
    });
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
    const broken = this.eggs.filter((e) => !e.alive && !e.saved && !e.fled).length;
    const score = this.savedLog.reduce((a, s) => a + s.pts, 0) + (this.predPts || 0); // + snake clashes
    return { saved, broken, alive: this.aliveEggs().length, target: this.level.target || 1, total: this.eggs.length, score, perfect: this.savedLog.every((s) => s.cracks === 0) && broken === 0 };
  }
}

Object.assign(Sim.prototype, chickMethods); // v3.2 chick kinds (sim/chicks.js)

export { EGG_H, EGG_W, RING_TH };
