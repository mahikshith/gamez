// v3.4 powers and combos (V3-PLAN "v3.4 powers and rivalries"). Mixed into Sim (sim.js: Object.assign(Sim.prototype,
// p2Methods)), so `this` is the Sim. No imports from sim.js (it imports this file). All state is plain data in this.p2
// (p2State / p2Load) and on eggs (P2_KEYS, in EGG_KEYS), so rewind and the planner stay exact.
//
// Every power has an upside and a downside (Easy: gentler downsides, longer creature stuns; Hard the other way):
//   frostnova   : every creature frozen FROST.t s, thorns and thorn curtains brittle (a touch shatters them) |
//                 every ring frozen solid for FROST.lock s, then icy (frictionless) until the end
//   shock       : the ring under the egg is live for SHOCK.t s: a creature touching it is zapped and runs off for
//                 SHOCK.flee s | an egg touching it is bounced away (no crack)
//   thunderclap : every creature stunned CLAP.stun s (the big ones CLAP.big s) | gate doors and portals black out:
//                 doors stay as they are, portals neither pull nor send, multiplier gates pay nothing
//   laser       : LASER.shots taps within LASER.t s: a beam from the centre cuts thorns, barriers, thorn curtains and
//                 walls on its line and scares creatures off it | it also burns every sponge pad it crosses
//   spin        : the whole rig spins as one for SPIN.t s and flings creatures out to the rim | eggs tumble too
//   pepper      : creatures sneeze and flee for PEPPER.flee s | a smoke cloud hides part of the board PEPPER.cloud s
//   shrink      : eggs shrink to quail size SHRINK.t s: through grates, creatures lose track | they crack easier
//   iron        : eggs turn steel IRON.t s: can't crack or be eaten, smash thorns | heavy: narrow gaps bar them,
//                 they sink through sponge pads and fall fast
//   decoy       : a fake egg every creature chases for DECOY.t s | it is big: it can plug a gap
//   warp        : the next creature strike is swallowed by a portal and the creature spat out far away (sim/warp.js) |
//                 the gate pulls in eggs rolling into it; it fires on the first strike
// Creatures: snakes, the salamander, the eagle, the fox thrower and the bosses. Bosses resist (BOSS_RESIST of the
// time); the salamander is a fire creature (frost holds it half as long); a snake boss resists like a boss.
//
// Combos (COMBOS): when a power starts while its partner is active, the combo fires (event 'p2Combo').
import { Vec2, Polygon } from 'planck';
import { RING_TH, TAU, eggHull, wrap, clamp } from './geom.js';
import { removeWall, ringPoint } from './boss.js';

const DT = 1 / 120; // sim.js DT: power timers run in real time, also under the hourglass
const TRAIL = 0.05; // sim.js snake trail spacing
export const P2_TYPES = ['frostnova', 'shock', 'thunderclap', 'laser', 'spin', 'pepper', 'shrink', 'iron', 'decoy', 'warp'];
export const P2_KEYS = ['shrink', 'iron', 'zapCD']; // egg fields (seconds left; iron is a flag that lives as long as the stone shell)

export const P2 = {
  frostnova: { t: 6, lock: 2 },
  shock: { t: 6, flee: 8, bounce: 2.4, cd: 0.6, touch: 0.42 },
  thunderclap: { stun: 5, big: 3, dark: 5 },
  laser: { t: 10, shots: 3, w: 0.16, sweep: 1.3 },
  spin: { t: 3, w: 1.6 },
  pepper: { flee: 8, cloud: 3, r: 1.7, stink: 12, stinkR: 2.6 },
  shrink: { t: 8, s: 0.75, crack: 1.25 },
  iron: { t: 7, gap: 0.76, sink: 0.45 },
  decoy: { t: 8, s: 1.5 },
  warp: { t: 12 }, // sim/warp.js has the rest
};
// up: creature stun / flee time x; down: downside strength x (bounce, ring lock, cloud size and time, ...)
const P2_MODE = { easy: { up: 1.15, down: 0.7 }, medium: { up: 1, down: 1 }, hard: { up: 0.9, down: 1.15 } };
const BOSS_RESIST = 0.4;
const FIRE_RESIST = 0.5; // frost on the lava salamander
const BIG = 0.6; // the eagle (a big one): stun share

// The combo album (future page): pairs, names and one line each, in discovery order.
export const COMBOS = [
  { id: 'shatter', a: 'frostnova', b: 'shock', name: 'Shatter', line: 'Frozen creatures are knocked clean out of the vault.' },
  { id: 'sweep', a: 'laser', b: 'spin', name: 'Sweep beam', line: 'The laser sweeps a full circle: every thorn in the vault is cut.' },
  { id: 'cannon', a: 'shrink', b: 'iron', name: 'Cannonballs', line: 'Tiny iron eggs smash thorns, barriers, walls and glass, and slip through grates.' },
  { id: 'twister', a: 'pepper', b: 'spin', name: 'Pepper twister', line: 'The spin blows the smoke away and sneezes every creature out to the rim.' },
  { id: 'magnet', a: 'shock', b: 'iron', name: 'Electromagnet', line: 'Iron eggs stick to the live ring instead of bouncing, even upside down.' },
  { id: 'bait', a: 'decoy', b: 'warp', name: 'Bait and switch', line: 'The warp gate sends the decoy through too: every creature chases it to the far side.' },
  { id: 'stink', a: 'decoy', b: 'pepper', name: 'Pepper decoy', line: 'The decoy is stuffed with pepper: whatever bites it, and all around it, flee far longer.' },
];

const CAT_DECOY = { filterCategoryBits: 64, filterMaskBits: 1 | 2 | 8 | 16 | 64 | 128 }; // sim.js CAT.BOMB / MASK.BOMB
const RING_FILT = { filterCategoryBits: 1, filterMaskBits: 2 | 4 | 64 | 128 }; // sim.js CAT.RING / MASK.RING
const bodyS = (b) => { const p = b.getPosition(), v = b.getLinearVelocity(); return [p.x, p.y, b.getAngle(), v.x, v.y, b.getAngularVelocity()]; };

export const p2Methods = {
  // ---------- build (end of Sim.build)
  p2Init() {
    this.p2M = P2_MODE[this.mode] || P2_MODE.medium;
    this.p2 = {
      nova: 0, shock: 0, shockR: -1, dark: 0, clap: 0, laser: 0, shots: 0, aim: -Math.PI / 2, sweep: -1, sweepA: 0, sweepDir: 1,
      spin: 0, spinMax: 0, spinDir: 1, pep: 0, cloud: null, shrink: 0, iron: 0, decoy: null, foxOut: 0,
      beams: [], fx: {}, pads: [], n: 0, warp: null,
    };
    this.p2d = null; // the decoy's body ({decoy, id, alive, chick, body}); its plain state is p2.decoy
    // narrow gaps get a bar only an iron egg feels (switched in p2Pass); drawn while iron is on.
    // Only in levels that can hand out Iron Shell: extra ring fixtures change the physics of every other level.
    if (!JSON.stringify(this.level || {}).includes('"iron"')) return;
    for (const ring of this.rings) {
      const r = ring.r, ri = r - RING_TH / 2, ro = r + RING_TH / 2;
      for (const g of ring.gaps) {
        if (g.grate || g.curtain || g.narrow || g.len >= P2.iron.gap) continue;
        g.ironBar = true;
        const half = g.len / (2 * r), n = Math.max(2, Math.ceil(g.len / 0.2));
        for (let k = 0; k < n; k++) {
          const b0 = g.a - half + (2 * half * k) / n, b1 = g.a - half + (2 * half * (k + 1)) / n;
          ring.body.createFixture({
            shape: new Polygon([Vec2(ri * Math.cos(b0), ri * Math.sin(b0)), Vec2(ro * Math.cos(b0), ro * Math.sin(b0)), Vec2(ro * Math.cos(b1), ro * Math.sin(b1)), Vec2(ri * Math.cos(b1), ri * Math.sin(b1))]),
            friction: 0.4, restitution: 0.1, ...RING_FILT, userData: { kind: 'ironbar', gap: g, ring },
          });
        }
      }
    }
  },

  // ---------- queries
  p2On(id) {
    const P = this.p2;
    switch (id) {
      case 'frostnova': return P.nova > 0;
      case 'shock': return P.shock > 0;
      case 'thunderclap': return P.dark > 0;
      case 'laser': return P.laser > 0 && P.shots > 0;
      case 'spin': return P.spin > 0;
      case 'pepper': return P.pep > 0;
      case 'shrink': return P.shrink > 0;
      case 'iron': return P.iron > 0;
      case 'decoy': return !!P.decoy;
      case 'warp': return this.warpOn();
    }
    return false;
  },
  p2Cannon() { return this.p2.shrink > 0 && this.p2.iron > 0; },
  p2Magnet() { return this.p2.shock > 0 && this.p2.iron > 0; },
  laserReady() { const P = this.p2; return !!P && this.state === 'play' && P.laser > 0 && P.shots > 0 && P.sweep < 0; },
  p2Small(egg) { return egg.shrink > 0 || egg.kind === 'quail'; },

  // ---------- takeOrb: true if t is one of these powers
  p2Take(egg, t) {
    if (!P2[t]) return false;
    const P = this.p2, M = this.p2M, p = egg.body.getPosition(), n = this.rings.length;
    let dur = 0;
    if (t === 'frostnova') {
      const T = P2.frostnova.t, lock = P2.frostnova.lock * M.down;
      P.nova = dur = T;
      this.rings.forEach((ring, i) => {
        if (ring.grabbable && this.bx) this.bx.rl[i].frost = Math.max(this.bx.rl[i].frost, lock);
        for (const sg of ring.segs) if (sg.alive) sg.ice = Math.max(sg.ice || 0, T);
      });
      this.p2All('ice', T * M.up);
    } else if (t === 'shock') {
      P.shock = dur = P2.shock.t;
      P.shockR = Math.min(this.channelOf(egg), n - 1);
      for (const k in P.fx) if (P.fx[k].k === 'zap') delete P.fx[k]; // a new live ring zaps everyone again
    } else if (t === 'thunderclap') {
      P.dark = dur = P2.thunderclap.dark * M.down;
      P.clap = 0.7;
      this.p2All('bolt', P2.thunderclap.stun * M.up);
    } else if (t === 'laser') {
      P.laser = dur = P2.laser.t;
      P.shots = P2.laser.shots + (this.mode === 'easy' ? 1 : 0);
      P.aim = Math.atan2(p.y, p.x);
    } else if (t === 'spin') {
      P.spin = P.spinMax = dur = P2.spin.t;
      P.spinDir = p.x > 0.05 ? -1 : 1; // the bottom of the vault swings the egg toward the middle first
      for (const e of this.aliveEggs()) {
        if (e.honey > 0) continue;
        const q = e.body.getPosition(), d = Math.hypot(q.x, q.y) || 1, m = e.body.getMass() * 1.2;
        e.body.applyLinearImpulse(Vec2((-q.y / d) * m * P.spinDir, (q.x / d) * m * P.spinDir), q, true);
        e.body.setAngularVelocity(e.body.getAngularVelocity() + 9 * P.spinDir);
      }
      this.p2All('spin', 1.5);
    } else if (t === 'pepper') {
      P.pep = dur = P2.pepper.flee * M.up;
      P.cloud = { x: p.x, y: p.y, t: P2.pepper.cloud * M.down, max: P2.pepper.cloud * M.down, r: P2.pepper.r * Math.sqrt(M.down) };
      this.p2All('pepper', P.pep);
    } else if (t === 'shrink') {
      P.shrink = dur = P2.shrink.t;
      for (const e of this.aliveEggs()) if (!e.chick) { if (!(e.shrink > 0)) this.p2Shrink(e, true); e.shrink = P2.shrink.t; }
    } else if (t === 'iron') {
      P.iron = dur = P2.iron.t;
      for (const e of this.aliveEggs()) {
        if (e.chick) continue;
        if (e.stone > 0) e.stone = Math.max(e.stone, dur); else { this.setStone(e, true); e.stone = dur; }
        e.iron = 1;
      }
    } else if (t === 'decoy') {
      dur = P2.decoy.t;
      this.p2Decoy(egg);
    } else if (t === 'warp') dur = this.warpArm(egg);
    this.emit('powerOn', { power: t, dur, egg, ring: P.shockR });
    this.p2Combo(t, p);
    return true;
  },

  // a power just started: a combo with any partner still active
  p2Combo(t, p) {
    const P = this.p2;
    for (const C of COMBOS) {
      if (C.a !== t && C.b !== t) continue;
      if (!this.p2On(C.a === t ? C.b : C.a)) continue;
      P.n++;
      this.emit('p2Combo', { id: C.id, name: C.name, x: p.x, y: p.y });
      if (C.id === 'shatter') this.p2All('out', 8 * this.p2M.up);
      else if (C.id === 'sweep') { P.sweep = 0; P.sweepA = P.aim; P.sweepDir = -P.spinDir; P.shots = 0; } // against the spin: the beam meets every thorn
      else if (C.id === 'twister') { P.cloud = null; this.p2All('spin', 1.5); this.p2All('pepper', 10 * this.p2M.up); }
      else if (C.id === 'stink' && P.decoy) P.decoy.pepper = 1;
    }
  },

  // ---------- the creatures. kind: ice (frozen T), bolt (stunned T, the big ones less), pepper (sneeze, flee T),
  // spin (flung out to the rim), out (knocked out of the vault for T), zap (shock: jolt, then flee T),
  // scare (laser: back off T). Bosses resist.
  p2All(kind, T) {
    for (const S of this.p2Snakes()) this.p2Snake(S, kind, T);
    for (const C of this.p2Sals()) this.p2Sal(C, kind, T);
    if (this.p2Eagle()) this.p2EagleHit(kind, T);
    if (this.fox) this.p2Fox(kind, T);
    this.p2Boss(kind, T);
    this.frogHit(kind, kind === 'bolt' ? P2.thunderclap.stun * this.p2M.up : T); // v3.5: the frog is a creature too (frozen / stunned)
    this.seaP2?.(kind, T); // v3.5: the octopus (sim/sea.js): frozen, or stunned
    for (const S of this.schools || []) this.p2Fish(S, kind, T);
  },
  // fish schools: frozen by ice, stunned by lightning; they just carry on for the rest
  p2Fish(S, kind, T) {
    const at = this.fishXY(S);
    if (kind === 'ice' ? this.fishFreeze(S, T) : kind === 'bolt' ? this.fishStun(S, Math.min(T, P2.thunderclap.stun), true) : false) this.emit('p2Hit', { kind: kind === 'ice' ? 'ice' : 'zap', x: at.x, y: at.y });
  },
  p2Snakes() { return this.snakes.filter((S) => !S.gone && S.inside && S.pts.length > 1 && !S.carried && !S.warp && !(S.flee >= 0)); },
  p2Sals() { return (this.sals || []).filter((C) => this.salLive(C) && C.ph !== 'in' && C.ph !== 'dive' && C.ph !== 'grin' && C.ph !== 'warp'); },
  p2Eagle() { const E = this.eagle; return E && !E.end && !E.warp && E.phase !== 'away' && E.phase !== 'enter' ? E : null; },
  p2Mark(key, k, t, x, y) { this.p2.fx[key] = { k, t, max: t }; if (x != null) this.emit('p2Hit', { kind: k, x, y }); },

  p2Snake(S, kind, T) {
    const f = this.level.bossFight && this.level.bossFight.kind === 'snake' ? BOSS_RESIST * 1.5 : 1, h = S.pts[0];
    if (S.spit) { const b = this.barriers[S.spit.b]; if (b) b.venom = 0; S.spit = null; }
    if (S.rival > 0) { S.rival = 0; S.back = 0; }
    S.strike = 0; S.vsK = -1; S.vsT = Math.max(S.vsT, 2);
    const key = 's' + S.id;
    if (kind === 'ice') { S.stun = Math.max(S.stun, T * f); S.hurt = 'ice'; S.back = 0; S.mood = 'shock'; S.moodT = 0.4; this.p2Mark(key, 'ice', T * f, h.x, h.y); }
    else if (kind === 'bolt') { S.stun = Math.max(S.stun, T * f); S.hurt = 'bolt'; S.mood = 'shock'; S.moodT = 0.4; this.p2Mark(key, 'zap', Math.min(1.2, T * f), h.x, h.y); }
    else if (kind === 'pepper' || kind === 'scare' || kind === 'zap') {
      S.stun = Math.max(S.stun, kind === 'zap' ? 0.8 : 0.5); S.hurt = kind === 'zap' ? 'bolt' : 'drop';
      S.back = Math.max(S.back, T * f); S.mood = 'shock'; S.moodT = 0.8;
      this.p2Mark(key, kind === 'scare' ? 'scare' : kind === 'zap' ? 'zap' : 'pep', kind === 'zap' ? 1.2 : Math.min(T * f, 3), h.x, h.y);
    } else if (kind === 'spin' || kind === 'out') {
      this.p2Fling(S, kind === 'out' ? this.outerR + 0.9 : this.outerR + 0.35);
      S.stun = Math.max(S.stun, kind === 'out' ? 1.5 : T * f); S.hurt = kind === 'out' ? 'ice' : 'drop';
      if (kind === 'out') S.wait = Math.max(S.wait, T * f);
      this.p2Mark(key, kind === 'out' ? 'ice' : 'spin', kind === 'out' ? 1.5 : 1, S.pts[0].x, S.pts[0].y);
    }
  },
  // lay the snake down whole in the channel at radius rad (outside the vault when rad > outerR), head where it was
  p2Fling(S, rad) {
    const from = S.pts[0];
    const m = Math.ceil(S.len / TRAIL) + 1;
    S.rad = rad; S.pts = [];
    for (let i = 0; i < m; i++) S.pts.push(this.trailPt(S, {}, S.a - (i * TRAIL) / Math.max(rad, 0.3), rad));
    S.back = 0; S.knock = 0; S.shove = 0; S.blocked = 0;
    this.emit('p2Fling', { who: 'snake', x: from.x, y: from.y, x2: S.pts[0].x, y2: S.pts[0].y });
  },

  p2Sal(C, kind, T) {
    const f = C.boss ? BOSS_RESIST : 1, h = C.pts[0], key = 'c' + C.id;
    if (kind === 'ice') { this.salDaze(C, T * f * FIRE_RESIST, 'frost'); this.p2Mark(key, 'ice', T * f * FIRE_RESIST, h.x, h.y); }
    else if (kind === 'bolt') { this.salDaze(C, P2.thunderclap.big * f, 'bolt'); this.p2Mark(key, 'zap', 1.2, h.x, h.y); }
    else if (kind === 'pepper' || kind === 'scare' || kind === 'zap') { this.p2SalFlee(C, T * f); this.p2Mark(key, kind === 'scare' ? 'scare' : kind === 'zap' ? 'zap' : 'pep', Math.min(T * f, 3), h.x, h.y); }
    else if (kind === 'spin') {
      // it grips both walls: flung to the outermost channel, dizzy
      const n = this.rings.length, r = this.salMid(n - 1);
      if (!C.boss && Math.abs(C.rad - r) > 0.2) { for (const q of C.pts) this.salPt(q, q.a, r); C.rad = r; C.climb = null; C.car = -1; this.salCarry(C); }
      this.salDaze(C, 1.5 * (C.boss ? 0.6 : 1));
      this.p2Mark(key, 'spin', 1, h.x, h.y);
    } else if (kind === 'out') {
      if (C.boss) { this.salDaze(C, 2.5, 'frost'); this.p2Mark(key, 'ice', 2.5, h.x, h.y); return; }
      this.salRelease(C);
      this.emit('p2Fling', { who: 'sal', x: h.x, y: h.y, x2: h.x * 1.6, y2: h.y * 1.6 + 1 });
      C.ph = 'wait'; C.t = T; C.climb = null; // it walks back in where it first came in
    }
  },
  p2SalFlee(C, T) {
    this.salRelease(C);
    C.climb = null;
    C.next = Math.max(C.next, T);
    C.back = Math.max(C.back || 0, 2.2 * C.size);
    this.salSet(C, 'retreat');
  },

  p2EagleHit(kind, T) {
    const E = this.eagle, f = BIG;
    if (kind === 'ice' || kind === 'bolt' || kind === 'out') {
      const t = kind === 'out' ? T : kind === 'bolt' ? P2.thunderclap.big : T * f;
      if (E.phase === 'dazed') { E.t = Math.max(E.t, t); if (kind === 'ice') E.dk = 'frost'; } else { this.eagleDaze(kind === 'bolt' ? 'bolt' : 'frost'); E.t = t; }
      this.p2Mark('e', kind === 'bolt' ? 'zap' : 'ice', t, E.x, E.y);
    } else if (kind === 'pepper' || kind === 'scare' || kind === 'zap' || kind === 'spin') {
      if (E.carry || E.phase === 'carry') { this.eagleDaze('pepper'); E.t = 1.2; }
      else if (E.phase !== 'dazed') {
        if (E.phase === 'warn' || E.phase === 'dive' || E.phase === 'strike') this.emit('eagleMiss', { x: E.x, y: E.y, why: kind });
        E.phase = 'up'; E.t = 1.5;
      }
      if (kind === 'spin') { const d = Math.hypot(E.x, E.y) || 1; E.vx += (E.x / d) * 7; E.vy += (E.y / d) * 7 + 2; }
      E.next = Math.max(E.next, kind === 'spin' ? 3 : T * f);
      this.p2Mark('e', kind === 'pepper' ? 'pep' : kind === 'zap' ? 'zap' : 'scare', Math.min(T, 3), E.x, E.y);
    }
  },

  p2Fox(kind, T) {
    const F = this.fox, y = this.outerR + 0.45, t = kind === 'spin' ? 3 : kind === 'scare' ? 4 : kind === 'bolt' ? P2.thunderclap.stun : T;
    F.t = Math.max(F.t, 0) + t; // his next throw waits
    F.mood = 'shocked'; F.moodT = Math.min(t, 2.5);
    if (kind === 'out') this.p2.foxOut = T;
    this.p2Mark('f', kind === 'out' ? 'ice' : kind === 'bolt' || kind === 'zap' ? 'zap' : kind === 'pepper' ? 'pep' : kind, Math.min(t, kind === 'ice' ? t : 3), F.x, y);
  },

  // the bosses over the vault (the snake and salamander bosses are the creatures above): a short stun, the attack it
  // was winding up is lost, the next one waits
  p2Boss(kind, T) {
    const B = this.bx && this.bx.boss;
    if (!B || B.kind === 'snake' || B.kind === 'salamander') return;
    const t = (kind === 'bolt' ? P2.thunderclap.big : T) * BOSS_RESIST;
    if (B.atk && B.atk.ph === 'warn') B.atk = null;
    if (!B.atk) B.t = Math.max(B.t, t + 0.8);
    B.flinch = Math.max(B.flinch, 0.9);
    if (kind === 'ice' || kind === 'bolt' || kind === 'out' || kind === 'zap') B.dizzy = Math.max(B.dizzy, t);
    this.p2Mark('b', kind === 'out' ? 'ice' : kind === 'bolt' ? 'zap' : kind === 'pepper' ? 'pep' : kind, Math.max(1, t), B.x, B.y);
  },

  // ---------- the decoy
  p2Decoy(egg) {
    const P = this.p2, p = egg.body.getPosition(), r = Math.hypot(p.x, p.y) || 1;
    this.p2Pop('new');
    const x = p.x - (p.x / r) * 0.5, y = p.y - (p.y / r) * 0.5 + 0.2;
    P.decoy = { t: P2.decoy.t, max: P2.decoy.t, pepper: 0 };
    this.p2DecoyBody([x, y, 0, egg.body.getLinearVelocity().x, 1.5, 0]);
    this.emit('decoyOn', { x, y });
  },
  p2DecoyBody(b) {
    const s = this.mode === 'easy' ? P2.decoy.s * 0.9 : P2.decoy.s;
    const body = this.world.createDynamicBody({ position: Vec2(b[0], b[1]), angle: b[2], angularDamping: 0.6, linearDamping: 0.05 });
    body.createFixture({ shape: new Polygon(eggHull(12, s).map((q) => Vec2(q.x, q.y))), density: 0.55, friction: 0.95, restitution: 0.08, ...CAT_DECOY, userData: { kind: 'decoy' } });
    body.setLinearVelocity(Vec2(b[3], b[4]));
    body.setAngularVelocity(b[5]);
    this.p2d = { decoy: 1, id: -1, alive: true, chick: 0, body, s };
  },
  p2Lure() { const D = this.p2d; return D && D.alive && this.p2.decoy ? D : null; },
  // what snakes hunt: the decoy first; shrunk eggs are too small to track
  p2Prey() {
    const L = this.aliveEggs().filter((e) => !(e.shrink > 0)), D = this.p2Lure();
    if (D) L.push(D);
    return L;
  },
  // a snake bites the decoy: wood! It reels; a pepper decoy goes off
  decoyBite(S) {
    const D = this.p2Lure();
    if (!D) return;
    S.stun = Math.max(S.stun, 1.6); S.hurt = 'clash'; S.mood = 'ouch'; S.moodT = 0.8; S.mouthOpen = 1;
    this.p2Mark('s' + S.id, 'scare', 1.6);
    this.p2Pop('snake', S);
  },
  // the eagle (talons) or a boss attack hits it
  decoyHit(by) { if (this.p2Lure()) this.p2Pop(by); },
  p2Pop(why, S) {
    const P = this.p2, D = this.p2d;
    if (!D || !P.decoy) { this.p2d = null; P.decoy = null; return; }
    const p = D.body.getPosition(), pep = P.decoy.pepper;
    D.alive = false;
    this.kill.push(D.body);
    this.p2d = null; P.decoy = null;
    this.emit('decoyPop', { x: p.x, y: p.y, why, pepper: pep });
    if (pep && why !== 'time' && why !== 'new' && why !== 'ground') {
      // pepper decoy: the biter and everything near it flee far longer
      const T = P2.pepper.stink * this.p2M.up, R = P2.pepper.stinkR;
      if (S) this.p2Snake(S, 'pepper', T);
      for (const X of this.p2Snakes()) if (X !== S && X.pts.some((q, i) => i % 4 === 0 && Math.hypot(q.x - p.x, q.y - p.y) < R)) this.p2Snake(X, 'pepper', T);
      for (const C of this.p2Sals()) if (C.pts.some((q, i) => i % 4 === 0 && Math.hypot(q.x - p.x, q.y - p.y) < R)) this.p2Sal(C, 'pepper', T);
      const E = this.p2Eagle();
      if (E && Math.hypot(E.x - p.x, E.y - p.y) < R + 1.5) this.p2EagleHit('pepper', T);
      P.cloud = { x: p.x, y: p.y, t: 1.2, max: 1.2, r: 1.0 };
    }
  },
  // eagleTarget(): while a decoy is out it is all the eagle sees (E: its locked target)
  p2EagleLure(E) {
    const D = this.p2Lure();
    if (!D || (E && E.tk !== 'decoy')) return null;
    const n = this.rings.length, p = D.body.getPosition();
    return { kind: 'decoy', id: -1, x: p.x, y: p.y, decoy: D, exposed: this.chAt(Math.hypot(p.x, p.y)) >= n - 1 && this.eagleReach(p.x, p.y) };
  },

  // ---------- the laser beak
  fireLaser(a) {
    if (!this.laserReady()) return false;
    const P = this.p2;
    P.shots--;
    P.aim = a;
    P.beams.push({ a, t: 0 });
    if (P.beams.length > 4) P.beams.shift();
    const c = Math.cos(a), s = Math.sin(a), w = P2.laser.w;
    const n = this.p2Cut((x, y, r) => x * c + y * s > -r && Math.abs(x * s - y * c) < w + r, 'laser');
    this.emit('laser', { a, n, shots: P.shots, x: (this.outerR + 0.4) * c, y: (this.outerR + 0.4) * s });
    return true;
  },
  // cut everything the test hits (test(x, y, reach): is anything within reach of (x, y) on the beam?)
  p2Cut(test, why) {
    let n = 0;
    for (const ring of this.rings) {
      for (const th of ring.thorns) {
        if (!th.alive) continue;
        const m = (th.base + th.tip) / 2, q = ring.body.getWorldPoint(Vec2(m * Math.cos(th.a), m * Math.sin(th.a)));
        if (test(q.x, q.y, 0.08)) { this.removeThorn(th, 'burn'); n++; }
      }
      for (const g of ring.gaps) {
        if (!g.curtain || !g.curtain.alive) continue;
        const q = ring.body.getWorldPoint(Vec2(ring.r * Math.cos(g.a), ring.r * Math.sin(g.a)));
        if (test(q.x, q.y, g.len / 2)) { this.p2Curtain(ring, g, why); n++; }
      }
      ring.segs.forEach((sg, si) => {
        if (!sg.alive || !sg.pad) return;
        const am = (sg.a0 + sg.a1) / 2, q = ring.body.getWorldPoint(Vec2(ring.r * Math.cos(am), ring.r * Math.sin(am)));
        if (test(q.x, q.y, ((sg.a1 - sg.a0) * ring.r) / 2)) this.p2BurnPad(ring.i, si);
      });
    }
    for (const b of this.barriers) {
      if (!b.alive) continue;
      const q = this.barrierPoint(b, 0.5);
      if (test(q.x, q.y, b.w / 2 + 0.05)) { this.removeBarrier(b, 'burn'); n++; }
    }
    if (this.bx) for (const W of this.bx.walls) {
      if (!W.alive) continue;
      const q = ringPoint(this, W.ri, W.la, this.rings[W.ri].r - RING_TH / 2 - 0.25);
      if (test(q.x, q.y, W.w / 2 + 0.05)) { removeWall(this, W, 'laser'); n++; }
    }
    // creatures on the line back off
    const T = 3 * this.p2M.up;
    for (const S of this.p2Snakes()) if (S.pts.some((q, i) => i % 3 === 0 && test(q.x, q.y, 0.25)) && !(this.p2.fx['s' + S.id]?.k === 'scare')) this.p2Snake(S, 'scare', T);
    for (const C of this.p2Sals()) if (C.pts.some((q, i) => i % 3 === 0 && test(q.x, q.y, 0.3)) && C.ph !== 'retreat') this.p2Sal(C, 'scare', T);
    const E = this.p2Eagle();
    if (E && test(E.x, E.y, 0.9) && E.phase !== 'dazed' && E.phase !== 'up') this.p2EagleHit('scare', T);
    if (this.fox && test(this.fox.x, this.outerR + 0.45, 0.5) && this.p2.fx.f?.k !== 'scare') this.p2Fox('scare', T);
    const B = this.bx && this.bx.boss;
    if (B && test(B.x, B.y, 0.9) && this.p2.fx.b?.k !== 'scare') this.p2Boss('scare', T);
    return n;
  },
  p2Curtain(ring, g, why) {
    const C = g.curtain;
    if (!C || !C.alive) return;
    C.alive = false; C.burning = false; C.burn = 1;
    if (C.vine) { C.u = 0; C.w = C.vine.wait; C.burn = 0; } // a vine regrows from its root
    else for (const f of C.fixes) this.killFix.push([ring.body, f]);
    const q = ring.body.getWorldPoint(Vec2(ring.r * Math.cos(g.a), ring.r * Math.sin(g.a)));
    this.emit('p2Curtain', { x: q.x, y: q.y, ring: ring.i, why, vine: !!C.vine });
  },
  p2BurnPad(ri, si) {
    const ring = this.rings[ri], sg = ring.segs[si];
    if (!sg || !sg.pad) return;
    sg.pad = false; sg.padBurnt = 1;
    sg.fix.setFriction(ring.M.fr * (this.level.weather === 'rain' ? 0.55 : 1));
    sg.fix.setRestitution(ring.M.re);
    this.p2.pads.push(ri * 1000 + si);
    const am = ring.body.getAngle() + (sg.a0 + sg.a1) / 2;
    this.emit('padBurn', { x: (ring.r - RING_TH / 2) * Math.cos(am), y: (ring.r - RING_TH / 2) * Math.sin(am) });
  },

  // ---------- shrink: a quail-size hull (same density: a quarter of the weight gone), back when the time is up
  p2Shrink(egg, on) {
    if (!egg.body || egg.chick) return;
    const base = { ostrich: 1.3, quail: 0.75 }[egg.kind] || 1, s = on ? P2.shrink.s : base;
    const old = egg.fix, d = old.getDensity(), b = egg.body, v = b.getLinearVelocity(), vx = v.x, vy = v.y, w = b.getAngularVelocity();
    b.destroyFixture(old);
    egg.fix = b.createFixture({ shape: new Polygon(eggHull(12, s).map((q) => Vec2(q.x, q.y))), density: d, friction: 0.5, restitution: 0.12, filterCategoryBits: old.getFilterCategoryBits(), filterMaskBits: old.getFilterMaskBits(), userData: { kind: 'egg', egg } });
    b.setLinearVelocity(Vec2(vx, vy)); // the new mass centre must not change how it moves
    b.setAngularVelocity(w);
    const p = b.getPosition();
    this.emit(on ? 'shrinkOn' : 'shrinkOff', { egg, x: p.x, y: p.y });
  },
  // is the egg in a gap only a small egg fits (a grate, an ostrich bar, an iron bar)? It waits to grow back
  p2Tight(egg) {
    const p = egg.body.getPosition(), d = Math.hypot(p.x, p.y);
    for (const ring of this.rings) {
      if (Math.abs(d - ring.r) > RING_TH / 2 + 0.34) continue;
      const la = Math.atan2(p.y, p.x) - ring.body.getAngle();
      for (const g of ring.gaps) if ((g.grate || g.narrow) && Math.abs(wrap(la - g.a)) * ring.r < g.len / 2 + 0.3) return true;
    }
    return false;
  },

  // ---------- contacts (Sim.v3Pass / Sim.v3Contact)
  p2Pass(ua, ub) {
    for (const [u, o] of [[ua, ub], [ub, ua]]) {
      const egg = o.kind === 'egg' ? o.egg : null;
      if (u.kind === 'ironbar') return !(egg && egg.iron && !(egg.shrink > 0));
      if (!egg) continue;
      if (u.kind === 'grate' && egg.shrink > 0) return true;
      if (u.kind === 'narrow' && egg.shrink > 0) return true;
      if (u.kind === 'seg' && u.seg.pad && egg.iron && !(egg.shrink > 0)) return true; // iron sinks through sponge
    }
    return false;
  },
  p2Contact(c, egg, other) {
    const P = this.p2;
    if (!P) return false;
    if (P.nova > 0 && other.kind === 'thorn' && other.thorn.alive) {
      const th = other.thorn;
      c.setEnabled(false);
      if (!th.brit) { th.brit = 1; this.defer(() => { const q = this.thornAt(th); this.removeThorn(th, 'snap'); this.emit('thornShatter', { x: q.x, y: q.y }); }); }
      return true;
    }
    if (P.nova > 0 && other.kind === 'curtain' && other.gap.curtain.alive) {
      c.setEnabled(false);
      this.defer(() => this.p2Curtain(other.ring, other.gap, 'ice'));
      return true;
    }
    if (egg.iron && egg.shrink > 0) { // cannonballs
      if (other.kind === 'barrier' && other.barrier.alive) { c.setEnabled(false); const b = other.barrier; this.defer(() => { const q = this.barrierPoint(b, 0.5); this.removeBarrier(b, 'burn'); this.emit('cannonSmash', { x: q.x, y: q.y }); }); return true; }
      if (other.kind === 'wall' && other.wall.alive) { c.setEnabled(false); const W = other.wall; this.defer(() => removeWall(this, W, 'smash')); return true; }
      if (other.kind === 'seg' && other.seg.alive && other.seg.ring.M.hp && !other.seg.dying && !other.seg.hardIce) { const sg = other.seg; sg.dying = true; c.setEnabled(false); this.defer(() => this.breakSeg(sg, 'shatter')); return true; }
    }
    if (P.shock > 0 && other.kind === 'seg' && other.seg.ring.i === P.shockR) {
      if (egg.iron) { c.setFriction(4); return false; } // electromagnet (combo): it clings instead
      if (!(egg.zapCD > 0) && !egg.chick && egg.honey <= 0) {
        egg.zapCD = P2.shock.cd;
        egg.safeT = Math.max(egg.safeT, 0.3);
        const ring = other.seg.ring;
        this.defer(() => {
          if (!egg.alive || egg.saved) return;
          const b = egg.body, p = b.getPosition(), d = Math.hypot(p.x, p.y) || 1, s = d < ring.r ? -1 : 1, m = b.getMass() * P2.shock.bounce * this.p2M.down;
          const tx = -p.y / d, ty = p.x / d, side = (egg.seed & 1 ? 1 : -1) * 0.45;
          b.applyLinearImpulse(Vec2(((p.x / d) * s + tx * side) * m, ((p.y / d) * s + ty * side) * m + m * 0.35), p, true);
          this.emit('shockBounce', { egg, x: p.x, y: p.y, ring: ring.i });
        });
      }
    }
    return false;
  },
  thornAt(th) {
    const m = (th.base + th.tip) / 2;
    return th.ring.body.getWorldPoint(Vec2(m * Math.cos(th.a), m * Math.sin(th.a)));
  },

  // ---------- the spin storm turns every ring as one (after Sim.v3Rings, before the rings get their speed)
  p2Rings() {
    const P = this.p2;
    if (!P || !(P.spin > 0)) return;
    const el = P.spinMax - P.spin, w = P.spinDir * P2.spin.w * clamp(Math.min(el / 0.35, P.spin / 0.35), 0, 1);
    for (const ring of this.rings) { ring.omega = w; ring.target = ring.body.getAngle() + w * DT; ring.follower = true; }
  },

  // ---------- every step (before the world steps)
  p2Step(dt) {
    const P = this.p2;
    if (!P) return;
    const play = this.state === 'play', off = (k, power) => { if (P[k] > 0 && (P[k] -= DT) <= 0) { P[k] = 0; this.emit('powerOff', { power }); } };
    off('nova', 'frostnova');
    if (P.shock > 0 && (P.shock -= DT) <= 0) { P.shock = 0; this.emit('powerOff', { power: 'shock', ring: P.shockR }); P.shockR = -1; }
    off('dark', 'thunderclap');
    off('spin', 'spin');
    off('pep', 'pepper');
    off('shrink', 'shrink');
    off('iron', 'iron');
    if (P.laser > 0 && ((P.laser -= DT) <= 0 || (P.shots <= 0 && P.sweep < 0 && !P.beams.length))) { P.laser = 0; P.shots = 0; this.emit('powerOff', { power: 'laser' }); }
    if (P.clap > 0) P.clap = Math.max(0, P.clap - DT);
    if (P.cloud && (P.cloud.t -= DT) <= 0) P.cloud = null;
    for (const B of P.beams) B.t += DT;
    while (P.beams.length && P.beams[0].t > 0.5) P.beams.shift();
    for (const k in P.fx) if ((P.fx[k].t -= DT) <= 0) delete P.fx[k];
    if (P.warp) this.warpStep(dt); // sim/warp.js: the gate, the swallowed creature, the pulled eggs
    // the sweep beam (laser + spin): a full circle in P2.laser.sweep s
    if (P.sweep >= 0) {
      const u0 = P.sweep / P2.laser.sweep;
      P.sweep += DT;
      const u1 = Math.min(1, P.sweep / P2.laser.sweep), a0 = P.sweepA + P.sweepDir * TAU * u0, span = P.sweepDir * TAU * (u1 - u0);
      this.p2Cut((x, y, r) => {
        const d = Math.hypot(x, y);
        if (d < 0.2) return false;
        const pad = r / d, rel = wrap(Math.atan2(y, x) - a0) * Math.sign(span || 1);
        return rel > -pad && rel < Math.abs(span) + pad;
      }, 'sweep');
      P.aim = a0 + span;
      if (u1 >= 1) P.sweep = -1;
    }
    // blackout: portals neither pull nor send and stop spitting orbs (doors and gates: sim.js)
    if (P.dark > 0) {
      for (const e of this.aliveEggs()) e.portalCD = Math.max(e.portalCD, 0.05);
      for (const pt of this.portals) pt.timer += dt;
    }
    for (const e of this.aliveEggs()) {
      if (e.zapCD > 0) e.zapCD -= DT;
      if (e.shrink > 0 && (e.shrink -= DT) <= 0) {
        if (this.p2Tight(e)) e.shrink = 0.05;
        else { e.shrink = 0; this.p2Shrink(e, false); }
      }
      if (e.iron) {
        if (!(e.stone > 0)) { e.iron = 0; const p = e.body.getPosition(); this.emit('ironOff', { egg: e, x: p.x, y: p.y }); continue; }
        const b = e.body, m = b.getMass();
        if (e.honey <= 0) b.applyForceToCenter(Vec2(0, -m * this.g * P2.iron.sink), true); // heavy: it falls fast
        // electromagnet (combo): an iron egg near the live ring is pulled onto it
        if (P.shock > 0 && P.shockR >= 0 && P.iron > 0) {
          const ring = this.rings[P.shockR], p = b.getPosition(), d = Math.hypot(p.x, p.y) || 1, gap = d - ring.r;
          if (Math.abs(gap) < RING_TH / 2 + 0.55) { const s = gap > 0 ? -1 : 1; b.applyForceToCenter(Vec2((p.x / d) * s * m * this.g * 1.8, (p.y / d) * s * m * this.g * 1.8 + m * this.g * 0.9), true); }
        }
      }
    }
    // cannonballs (combo): an iron mini egg rolling into a creature bonks it
    if (this.p2Cannon()) {
      for (const e of this.aliveEggs()) {
        if (!(e.shrink > 0 && e.iron)) continue;
        const p = e.body.getPosition();
        for (const S of this.p2Snakes()) if (!(S.stun > 0) && Math.hypot(S.pts[0].x - p.x, S.pts[0].y - p.y) < 0.45) { this.p2Snake(S, 'scare', 4); S.stun = Math.max(S.stun, 2); this.emit('cannonBonk', { x: p.x, y: p.y }); }
        for (const C of this.p2Sals()) if (C.ph !== 'daze' && C.pts.some((q, i) => i % 4 === 0 && Math.hypot(q.x - p.x, q.y - p.y) < 0.45)) { this.salDaze(C, C.boss ? 1 : 2); this.emit('cannonBonk', { x: p.x, y: p.y }); }
      }
    }
    // the live ring zaps creatures touching it
    if (P.shock > 0 && play && P.shockR >= 0) this.p2ShockCreatures();
    if (P.foxOut > 0 && this.fox) { P.foxOut = Math.max(0, P.foxOut - DT); this.fox.duck = P.foxOut > 0.6 ? Math.min(1, (this.fox.duck || 0) + DT * 4) : Math.max(0, (this.fox.duck || 0) - DT * 2); }
    // the decoy: time, the ground, the nest
    if (P.decoy) {
      const D = this.p2d;
      if (!D) P.decoy = null;
      else {
        const p = D.body.getPosition();
        if ((P.decoy.t -= DT) <= 0) this.p2Pop('time');
        else if (p.y < this.groundY + 0.5 || Math.abs(p.x) > 30) this.p2Pop('ground');
      }
    }
  },
  p2ShockCreatures() {
    const P = this.p2, ring = this.rings[P.shockR], R = ring.r, touch = P2.shock.touch, T = P2.shock.flee * this.p2M.up;
    const near = (q) => Math.abs(Math.hypot(q.x, q.y) - R) < touch;
    for (const S of this.p2Snakes()) if (!P.fx['s' + S.id] && S.pts.some((q, i) => i % 3 === 0 && near(q))) this.p2Snake(S, 'zap', T);
    // the salamander walks mid-channel gripping both walls, so it touches a ring from a little further out
    const nearSal = (q) => Math.abs(Math.hypot(q.x, q.y) - R) < touch + 0.2;
    for (const C of this.p2Sals()) if (!P.fx['c' + C.id] && C.pts.some((q, i) => i % 3 === 0 && nearSal(q))) this.p2Sal(C, 'zap', T);
    for (const F of this.frogs || []) { // the frog stands on a ring (or sits in its gap): a live ring zaps it once, then it gets a breather
      if (F.fi !== P.shockR || F.ph === 'hop' || P.fx['g' + F.id] || F.frz > 0) continue;
      this.frogHit('zap', Math.min(2.5, T), F);
      this.p2Mark('g' + F.id, 'zap', Math.min(2.5, T) + 1.8);
    }
    for (const S of this.schools || []) if (!(S.sn > 0 || S.fz > 0) && S.f.some((f) => Math.abs(f.r - R) < touch + 0.25)) this.p2Fish(S, 'bolt', 2.5);
    if (P.shockR !== this.rings.length - 1) return; // the eagle, the fox and the bosses only meet the outer ring
    const E = this.p2Eagle();
    if (E && !P.fx.e && Math.abs(Math.hypot(E.x, E.y) - R) < 0.9) { this.eagleDaze('shock'); E.t = 2.5; this.p2Mark('e', 'zap', 1.5, E.x, E.y); }
    if (this.fox && !P.fx.f) this.p2Fox('zap', T);
    const B = this.bx && this.bx.boss;
    if (B && !P.fx.b && Math.hypot(B.x, B.y) < R + 1.3) this.p2Boss('zap', 3);
  },

  // ---------- state
  p2State() {
    const P = this.p2;
    if (!P) return null;
    const S = JSON.parse(JSON.stringify(P));
    if (S.decoy && this.p2d) S.decoy.b = bodyS(this.p2d.body);
    return S;
  },
  p2Load(S) {
    if (!S) return;
    const keep = this.p2;
    this.p2 = JSON.parse(JSON.stringify(S));
    for (const k of Object.keys(keep)) if (!(k in this.p2)) this.p2[k] = keep[k];
    for (const key of this.p2.pads) {
      const ring = this.rings[Math.floor(key / 1000)], sg = ring && ring.segs[key % 1000];
      if (sg && sg.pad) { sg.pad = false; sg.padBurnt = 1; sg.fix.setFriction(ring.M.fr * (this.level.weather === 'rain' ? 0.55 : 1)); sg.fix.setRestitution(ring.M.re); }
    }
    if (this.p2.decoy && this.p2.decoy.b) { this.p2DecoyBody(this.p2.decoy.b); delete this.p2.decoy.b; }
    for (const e of this.eggs) if (e.alive && !e.saved && e.body && e.shrink > 0) this.p2Shrink(e, true);
  },
};
