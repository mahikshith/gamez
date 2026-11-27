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
// leading egg. Since 0.8.14 it bites: an egg at its snout is eaten (BITE below). It grips both walls: the ring under it (the channel's floor ring, or the ring whose
// gap it is crossing) carries it round, so turning that ring steers it.
// Every `every` s it stops (always with all four feet down), telegraphs (coil, pitch up, frill, inhale: WARN x the
// mode's PRED.warn), then breathes a jet at one wall just ahead of it. That section turns red-hot for HOT_T: an egg
// touching it gets one crack (water eggs, stone, rock skin and the feather are immune; Easy never breaks one), and
// thorns (and a thorn curtain) on it burn away. Water (an egg with the water shell, or a water orb) near it makes it
// hiss and cool to grey for COOL_T (harmless), backing off. hitSalamander() takes the hazards: a gust shoves it along
// the channel, lava and quakes don't hurt it (lava recharges its breath), lightning, a glow flash or a dash bonk daze it.
// A snake meeting it in its channel starts a face-off (RIVAL_T): neither bothers the eggs, then both back off.
// On a win it dives into a lava pit; on a loss it stops and grins.
//
// The brain (BRAIN, shared by the salamander, the frost gecko and the thorn-backs; the chameleon hunts orbs instead):
//   Notice: an egg within BRAIN.see m of the head, or ahead in its channel within BRAIN.sight m, becomes its target (C.ht).
//     The first one after BRAIN.quiet s without a target emits salAlert: the art snaps the head round, flares, pops a "!".
//   Chase: a target in its channel is gone after the shorter way; one behind it means a U-turn ('turn': all four feet down,
//     then BRAIN.turn s, the head swinging round in a tight loop). A target in another channel: it heads for the gap toward
//     it and climbs with a BRAIN.hunt s cooldown. While hunting it walks PRED.chase x faster (Easy 1x).
//   Strike (the salamander, not the boss): an egg by either wall of its channel up to BRAIN.reach m ahead, and PRED.salGap s
//     since the last breath: it stops and breathes at that wall, with the same telegraph. No egg near: the old `every` rhythm.
//   Eggs still in the centre chamber are not hunted (they are where every level starts). The boss notices and turns round,
//   but keeps its own pace, climbs and breath rhythm (salBossSync). The thorn-backs turn round but get no chase speed-up.
// Size: the salamander is drawn and hit-tested at SAL.small x (its body sits inside its channel); the boss is 1.3x that.
//   salRank(C) (1, or the boss's 1.3) keeps its walk speed and the idle breath's reach as they were.
import { Vec2 } from 'planck';
import { RING_TH, TAU, wrap, clamp } from './geom.js';
import { BOSS_MODE, bossPhases } from './boss.js';
import { thornMethods, THORN } from './thornback.js'; // L20: Duke Quartz and Spike, the thorn-back lizards
import { chamMethods, CHAM } from './chameleon.js'; // L26: Sly the chameleon, the orb thief
import { dyn } from '../data/dynamism.js'; // 0.8.19: every villain's temper

export const SAL = {
  svl: 1.8, len: 1.96, // snout to hips (m) and snout to tail tip (units of svl): the art's sizes
  speed: 0.5, brakeV: 1.1, backV: 0.6, diveV: 3.4, // m/s
  trail: 0.05, ahead: 0.85, hotLen: 1.0, // m between trail points, jet spot ahead of the snout, hot section length
  every: 6, warn: 0.7, fire: 0.55, lit: 0.12, settle: 0.4, hotT: 4, // s
  cool: 5, hiss: 0.6, wetCD: 2.5, coolBack: 1.0, // water
  rival: 3, rivalR: 1.0, rivalGap: 1.3, rivalCD: 9, rivalBack: 1.2, // snake face-off
  climbCD: 4, boss: 1.3, small: 0.76,
};
export const BRAIN = {
  see: 2.6, sight: 5, lose: 4, lost: 6.5, quiet: 6, alert: 0.9, // m notice / ahead in its channel / keep / keep in its channel; s re-alert, art
  turn: 0.6, turnCD: 2.5, behind: 0.45, loopR: 0.3, loopW: 0.3, // s U-turn, s between U-turns, m behind that turns it, the loop (m ahead, m across)
  reach: 1.3, chin: 0.2, wall: 0.5, hunt: 1.5, sated: 3, // m breath range ahead (from chin m), m from a wall's centre line, s climb cooldown while hunting,
  // s it walks on after an aimed breath
};
// The bite (0.8.14: "salamanders are never ever attacking the eggs"). An egg within BITE.reach m of the snout (and not behind
// the head): it stops, coils (BITE.coil s x the mode's PRED.warn: head back, jaws wide, eyes on the egg), then snaps.
//   The egg rolled out of BITE.reach + BITE.keep in time: the jaws clack on air ('miss', BITE.miss s) and it walks on.
//   Fire salamander: it EATS the egg (break 'sal'), chews BITE.chew s, then is full for BITE.full s.
//   Frost salamander (kind 'frost'): frost bite, one crack and the egg freezes onto its wall for FROST.freeze s (break 'frostbite').
//   A stone / rock-skin / feather egg, or a decoy: it bites on rock and reels (daze BITE.ouch s x PRED.back).
//   A water egg douses the fire one, a flaming egg melts the frost one (salQuell: hiss, out of action SAL.cool s). A chick flaps free.
// The frost salamander (level.salamander {kind: 'frost'}): the same crawler in blue. Its breath does not heat the wall, it
//   ices it (sg.ice, the gecko's frictionless floor) for FROST.ice s; fire is to it what water is to the fire one.
// Face-off (FACE): a fire and a frost salamander meeting head to head in one channel stop, breathe at each other, and the
//   steam knocks both out: the fire one cools (SAL.cool s), the frost one is dazed FACE.daze s. Neither bites meanwhile.
export const BITE = { reach: 0.62, keep: 0.22, back: 0.12, coil: 0.85, snap: 0.16, chew: 1.3, miss: 0.55, ouch: 1.8, full: 3.5, cd: 1.2 };
export const FROST = { ice: 6, freeze: 3.5 };
export const FACE = { r: 1.25, t: 3.0, jet: 0.9, burst: 2.3, daze: 3.5, cd: 12, back: 0.9 };
// 0.8.18 (the owner: "it does not have good attacks ... it should also have special kinds of powers"). Two powers, each
// switched on per level (level.salamander {spit: 1, fireup: 1}; the boss: its phase's {spit, fire} flags).
// EMBER SPIT: an egg in a NEIGHBOUR channel, SPIT.minD .. SPIT.range m from the head, in front of it (SPIT.cone), with a straight
//   line from the head to it that only crosses rings inside their open gaps (or melted holes), SPIT.clear m from the edges:
//   he stops, rears, the cheeks puff and glow and a spark fuse runs down his back ('spitWarn', SPIT.warn x SPIT_M.warn; he keeps
//   his eye on the egg), then lobs a glowing ember at where the egg is ('spit'). It flies SPIT.fly s on that straight line
//   (the art lifts it in a lob). Each ring it crosses must still be open there at the moment it crosses: a ring turned so its
//   wall is in the way takes it (a splat on the wall: he is surprised, then miffed for SPIT.miff s). It lands on the floor of
//   the egg's channel (the wall the egg rests on) as an ember pool SPIT.len m long that rides that ring: SPIT.pool s
//   burning, then SPIT.crust s a cooling crust that crumbles. An egg touching a burning pool: one crack (once per pool);
//   Easy never cracks, the egg hops off with a yelp. A water egg (or a water orb where it lands) douses it; stone, rock
//   skin, the feather and chicks shrug it off. Upside: thorns where it lands or splats burn away.
// FIRE-UP: a red flame orb in his own channel (FIRE.see m along it) makes him greedy: he goes for it, and one at his snout
//   (FIRE.orbR m) he gulps ('gulp', FIRE.gulp s). A lava rock or a melted lava hole under him does the same at once. He goes
//   WHITE-HOT for FIRE.t x FIRE_M s: FIRE.speed x faster, his next breath heats FIRE.dbl x the section, and thorns by his feet
//   burn away. Water (an orb, a water egg) knocks him straight back to grey (the cool) and he sulks. FIRE.cd s before the next.
// Everything is plain data (C fields, this.salEmbers, this.salPools) in salState / salLoad, so rewind and the planner are exact.
export const SPIT = { warn: 1.0, fly: 0.75, after: 0.6, range: 3.6, minD: 0.7, cone: 1.35, clear: 0.05, cd: 7, first: 3, gapAfterBreath: 1.5, pool: 5, crust: 1.1, len: 0.62, miff: 1.5, hop: 2.4 };
export const SPIT_M = { easy: { warn: 1.45, cd: 1.35 }, medium: { warn: 1, cd: 1 }, hard: { warn: 0.85, cd: 0.85 } };
export const FIRE = { t: 6, speed: 1.3, dbl: 2, orbR: 0.62, see: 4.5, gulp: 0.65, cd: 5, sulk: 2.6, burnR: 0.42 };
export const FIRE_M = { easy: 0.7, medium: 1, hard: 1.15 };
// 0.8.19 (the owner: "not chasing the eggs ... throwing lava orbs at the eggs is not good enough"). Ember Spit is retired:
// the fire salamander's own way of taking eggs is its tongue, and it travels between rings through lava.
// Temper (speed while hunting, rests, tells, the player's window) comes from src/data/dynamism.js (salDyn: the mode, the
// level's own `dyn`, and the menace director's heat when it is there). Every move that can cost an egg asks the director
// first (salMay: menaceMay) and reports when it ends (salSet -> menaceDone); refused, it stalks ('stalk') instead.
// TONGUE LASH: an egg LASH.min .. LASH.reach m from the mouth, in front (LASH.cone), on a straight line that crosses rings only
//   inside open gaps: 'lash' (the tell, dyn tell s: crouch, throat glow, eyes locked), 'fling' (the tongue flies, LASH.fly s)
//   and sticks, 'reel' (the egg is pulled toward the mouth at LASH.reelV x the mode's window); at the mouth = the bite (salSnap).
//   Out of line or reach during the tell or the fling: a clean miss (he blinks, annoyed). While it reels: a ring wall coming
//   between snaps it; the TUG OF WAR: stretched past LASH.reach + LASH.slack m (turn his ring or the egg's away) it snaps, he
//   tumbles back and is dazed LASH.tumble s. Stone, rock skin, the feather, a decoy: he strains LASH.strain s, it snaps back,
//   dazed LASH.ouch s. A burning egg burns the tongue (dazed LASH.burn s). Water douses him. A chick flaps free.
// LAVA DIVE: a target DIVE.chans or more channels away, or one channel away with the way through more than DIVE.walk m of
//   walking: 'sink' (a pool glows under him DIVE.glow s, then he slides in), 'under' (DIVE.under s, unseen), 'bubble' (the exit
//   pool, DIVE.off m from the egg in its channel and riding that ring, bubbles for the whole tell), 'rise'. Then he hunts.
export const LASH = { min: 0.75, reach: 2.2, cone: 1.25, clear: 0.04, fly: 0.2, reelV: 1.5, acc: 7, slack: 0.5, cd: 2.5, miss: 0.5, strain: 0.5, ouch: 1.2, burn: 1.5, tumble: 1.5, maxReel: 3.2, arrive: 0.5, past: 0.3, jam: 0.25, steady: 6 };
export const DIVE = { chans: 2, walk: 2.5, sink: 0.55, glow: 0.3, under: 0.4, bubble: 1.7, rise: 0.45, off: 1.6, cd: 8, poolR: 0.45 };
// THE VOLCANO (sim.js lavaStep, boss.js rock/rock2/rock3): level.lava rocks are the backdrop volcano's bombs. The same seeded
// targets, VOLC.every x sparser; 'rumble' (VOLC.rumble s: the mountain rumbles and puffs, the target section is marked) then a
// high arc (VOLC.fly s) onto the marked section, which turns red-hot by the salamander's hot rule (VOLC.len m), then melts
// through as before. The salamander boss calls the volleys (he rears and roars at the mountain through the boss's warn).
export const VOLC = { every: 1.5, rumble: 0.6, fly: 1.2, len: 1.0, x: 0.55, y: 4 };
export const STALK = { t: 0.5, v: 0.12 }; // refused by the director: it creeps closer, eyes on the egg, and asks again
export const SHAKE = { deg: 10 }; // a frozen egg: two swings of its ring (the second the other way) crack the ice, then burst it
// the phases that belong to a costly move (the director's token is held through them)
const HOLD = new Set(['brake', 'lash', 'fling', 'reel', 'strain', 'coil', 'warn', 'fire', 'settle', 'nipWarn', 'curl', 'roll', 'hip']);
// phases in which a crawler looks about for eggs
const SENSE = new Set(['walk', 'brake', 'turn', 'warn', 'fire', 'settle', 'rest', 'block', 'lick', 'hip', 'drop', 'gloat', 'spitWarn', 'spit', 'gulp', 'stalk', 'rise', 'nipWait']);
// The frost gecko (species 'gecko': Baron von Brr, the level-15 boss; level.bossFight.gecko {delay, dir}). The same crawler,
// a little slower, with no fire: he crawls in through a gap of the outer ring, hunts the leading egg, and the
// level's blizzard attacks (sim/boss.js gale, freeze, icicles) come from him. Icy feet: the floor he walked on stays icy
// (sg.ice, frictionless) for GECKO.icy s. Lick: an egg he reaches freezes onto its ring for GECKO.freeze s (egg.icy: gravity
// can't move it, thorns and icicles can't crack it), then he loses interest for GECKO.bored s. He never breaks an egg.
// svl 1.9 m (was 1.3): drawn at the salamander's on-screen size so his face and crystals read; the trail, hit tests and
// icy footprints all follow it, so the art and what the powers can hit agree.
export const GECKO = { svl: 1.9, speed: SAL.speed * 0.85, lick: 0.75, lickAt: 0.4, reach: 0.5, freeze: 3.5, bored: 4, icy: 5 };
const deg = (d) => (d * Math.PI) / 180;
const mod = (a, b) => ((a % b) + b) % b;

export const salMethods = {
  // ---------- build
  salInit(L) {
    this.sals = [];
    this.salHot = []; // hot ring segments: [{ri, si}] (the heat itself is sg.hot / sg.hotK)
    this.salBurnN = 0;
    this.salEmbers = []; this.salPools = []; this.salEmN = 0; // 0.8.18 ember spit: in flight, on the floor (SPIT)
    const boss = !!(L.bossFight && L.bossFight.kind === 'salamander');
    let list = !L.salamander ? [] : Array.isArray(L.salamander) ? L.salamander : [L.salamander];
    if (boss && !list.length) list = [{ delay: L.bossFight.delay ?? 3, ch: 2, a: 90 }];
    const GK = L.bossFight && L.bossFight.kind === 'blizzard' && L.bossFight.gecko; // the frost gecko: the blizzard boss's body
    if (GK) list = [...list, { ...GK, ch: 99, gecko: 1 }];
    const TK = L.bossFight && L.bossFight.kind === 'golem' && L.bossFight.thorn; // L20: Duke Quartz, the golem fight's body, and his cousin Spike
    if (TK) list = [...list, { ...TK, ch: 99, thorn: 'duke' }];
    if (TK && L.bossFight.spike) list = [...list, { ...L.bossFight.spike, ch: 99, thorn: 'spike' }];
    if (L.chameleon) list = [...list, { ...L.chameleon, ch: 99, cham: 1 }]; // L26: Sly (sim/chameleon.js)
    const n = this.rings.length;
    if (n < 2) return;
    list.forEach((P, i) => {
      const isBoss = (boss && i === 0) || !!P.gecko || P.thorn === 'duke', size = P.gecko ? GECKO.svl / SAL.svl : P.cham ? CHAM.svl / SAL.svl : P.thorn ? (THORN.svl / SAL.svl) * (P.thorn === 'spike' ? THORN.spikeK : 1) : (P.size || (isBoss ? SAL.boss : 1)) * SAL.small;
      this.sals.push({ sp: P.gecko ? 'gecko' : P.cham ? 'chameleon' : P.thorn ? 'thornback' : 'sal', bored: 0, lk: -1, ent: null, ik: 0, ...(P.thorn ? { role: P.thorn, dropT: 0, fcd: 0, flipCD: 0, weakT: null, duel: null, duels: 0, fk: '' } : {}),
        ...(P.cham ? { tg: null, held: null, cough: null, ate: [], goods: [], sickT: 0, bumpCD: 0, goal: -1, ga: 0 } : {}),
        id: i, size, boss: isBoss ? 1 : 0, ch: clamp(P.ch ?? 2, 1, n - 1), dir: P.dir === -1 ? -1 : 1, a0: deg(P.a ?? 90),
        every: P.every || SAL.every, ph: 'wait', t: P.delay ?? 3, dur: 1, pend: null, pendT: 0, mv: 1, stopAt: 0,
        a: 0, rad: 0, pts: [], odo: 0, car: -1, carA: 0, next: 0, tw: 1, cool: 0, wetCD: 0, back: 0, shove: 0,
        rivalCD: 0, rid: -1, rv: 0, climbCD: 0, climb: null, charge: 0, lavaCD: 0, hold: 0, bph: 0, bk: -1, bsaved: 0, hole: 0,
        ht: -1, htT: BRAIN.quiet, alT: 0, brT: 9, tcd: 0, jet: 0, jk: -1, ut: 0, uA: 0, uR: 0, uD: 1, // the brain (BRAIN)
        kind: P.kind === 'frost' && !P.gecko && !P.cham && !P.thorn ? 'frost' : '', bj: -1, bcd: 0, ate: 0, fid: -1, fcd: 0, fv: 0, // the bite (BITE), the face-off (FACE)
        spit: P.spit ? (P.spit > 0 ? +P.spit : 1) : 0, scd: SPIT.first * (P.spit > 1 ? P.spit : 1), sj: -1, sx: 0, sy: 0, miff: 0, // 0.8.18 ember spit (SPIT): on, cooldown, target egg, aim point, s miffed
        fu: P.fireup ? 1 : 0, wh: 0, whD: 1, fuCD: 0, dbl: 0, sulk: 0, og: 0, gk: 0, // fire-up (FIRE): on, s white-hot (of whD), cooldown, double breath, s sulking, wants an orb
        // 0.8.19: the tongue (LASH: target egg, s cooldown, 0..1 out, 0..1 tension, m at the stick), the dive (DIVE: s cooldown, exit
        // channel, ring, ring-local angle), the director's token (move name, an egg taken), the chameleon's vanish, the thorn-back's roll
        lj: -1, lcd: 1.5, lk: 0, ls: 0, lgR: -1, lgA: 0, lgS: 0, lw: 0, dcd: 3, dvC: 0, dvR: 0, dvL: 0, tok: '', tokT: 0, gh: 0, rcd: 2, rl: 0, rv2: 0,
      });
    });
  },

  // ---------- geometry helpers
  salMid(c) { return (this.rings[c - 1].r + this.rings[c].r) / 2; },
  salStride(C) { return 0.4 * SAL.svl * C.size; },
  salRank(C) { return C.sp === 'sal' ? C.size / SAL.small : C.size; }, // 1, or the boss's 1.3 (the drawn size is SAL.small x that)
  salBodyLen(C) { return SAL.len * SAL.svl * C.size; },
  salHead(C) { return C.pts[0] || { x: C.rad * Math.cos(C.a), y: C.rad * Math.sin(C.a) }; },
  salLive(C) { return C.ph !== 'wait' && C.ph !== 'gone' && C.pts.length > 1; },
  salHidden(C) { return C.ph === 'under' || C.ph === 'bubble'; }, // 0.8.19 lava dive: in the lava, nothing reaches it
  // ---------- 0.8.19 temper (src/data/dynamism.js) and the menace director (sim/menace.js, when it is there)
  salDynKind(C) { return C.sp === 'sal' ? (C.kind === 'frost' ? 'salFrost' : 'salamander') : C.sp; },
  salDyn(C) {
    const k = this.salDynKind(C), key = '_dyn_' + k;
    const base = this[key] || (this[key] = dyn(k, this.mode, this.level.dyn && this.level.dyn[k]));
    const h = this.menaceHeat ? this.menaceHeat() : 1;
    return h === 1 ? base : { ...base, tempo: base.tempo * h, rest: base.rest / h };
  },
  salMay(C, move) {
    if (!(this.menaceMay ? this.menaceMay('c' + C.id, move) : true)) return false;
    C.tok = move; C.tokT = 0;
    return true;
  },
  // the ring the player is turning under it (the director's record when it is there, else the ring's own spin): -1, 0, +1
  salTurned(ri) {
    if (ri < 0 || !this.rings[ri]) return 0;
    if (this.menaceTurned) { const r = this.menaceTurned(ri); return typeof r === 'number' ? Math.sign(r) : r ? 1 : 0; }
    const w = this.rings[ri].body.getAngularVelocity();
    return Math.abs(w) > 0.6 ? Math.sign(w) : 0;
  },
  salMouth(C) {
    const h = C.pts[0], q = C.pts[Math.min(C.pts.length - 1, 6)], dx = h.x - q.x, dy = h.y - q.y, l = Math.hypot(dx, dy) || 1, f = 0.16 * C.size;
    return { x: h.x + (dx / l) * f, y: h.y + (dy / l) * f, hx: dx / l, hy: dy / l };
  },
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
    const a = Math.atan2(h.y, h.x) + C.dir * this.salAhead(C) / Math.max(0.5, Math.hypot(h.x, h.y));
    return { ri, a, x: ring.r * Math.cos(a), y: ring.r * Math.sin(a) };
  },
  // pick the wall: the one nearer an egg (within 1.6 m), else the lower one (the side eggs rest on)
  salAhead(C) { return C.jet > 0 ? C.jet : SAL.ahead * this.salRank(C); }, // m ahead of the snout: an aimed breath's, else the idle one's
  salPickWall(C) {
    const c = this.salCh(C), h = this.salHead(C), a = Math.atan2(h.y, h.x) + C.dir * this.salAhead(C) / Math.max(0.5, C.rad);
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
    this.salIceStep(dt); // 0.8.19 shaken free, thawed by fire
    this.salHeat();
    this.salEmberStep(dt, true); this.salPoolStep(dt, true);
  },
  // after the level is decided (predStep): dive on a win, grin on a loss
  salEndStep(dt) {
    if (!this.sals || !this.sals.length) return;
    this.salHotStep(dt);
    this.salEmberStep(dt, false); this.salPoolStep(dt, false);
    const win = this.state === 'winning' || this.state === 'won';
    for (const C of this.sals) {
      if (C.ph === 'wait' || C.ph === 'gone') { C.ph = 'gone'; continue; }
      if (C.sp === 'gecko' || C.sp === 'thornback' || C.sp === 'chameleon') { // beaten: he lets go where he is (the art slides him off); a loss: he stops and grins
        if (win) { if (C.ph !== 'beat') { this.salRelease(C); C.ph = 'beat'; C.pend = null; C.climb = null; } }
        else if (C.ph !== 'grin' && C.pend !== 'grin') { this.salRelease(C); this.salHalt(C, 'grin', 9); }
        this.salOne(C, dt, false);
        continue;
      }
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
    if (C.ph === 'gone' || C.ph === 'warp') return; // v3.4: 'warp' = inside a warp gate (sim/warp.js moves it)
    if (C.tok) this.salTokBack(C); // (a phase set directly: sneezed out, the level over)
    if (C.ph === 'wait') { if (play && (C.t -= dt) <= 0) this.salEnter(C); return; }
    this.salCarry(C);
    for (const k of ['wetCD', 'rivalCD', 'climbCD', 'charge', 'lavaCD', 'bored', 'tcd', 'alT', 'bcd', 'fcd', 'scd', 'fuCD', 'miff', 'sulk', 'lcd', 'dcd', 'rcd']) if (C[k] > 0) C[k] = Math.max(0, C[k] - dt);
    C.brT = Math.min(99, C.brT + dt);
    if (play && C.sp !== 'chameleon') { if (SENSE.has(C.ph)) this.salSense(C, dt); else if (C.ht < 0) C.htT = Math.min(99, C.htT + dt); }
    if (C.sp === 'gecko') { this.geckoOne(C, dt, play); return; }
    if (C.sp === 'thornback') { this.thornOne(C, dt, play); return; }
    if (C.sp === 'chameleon') { this.chamOne(C, dt, play); return; }
    if (C.cool > 0) C.cool = Math.max(0, C.cool - dt);
    if (C.wh > 0) this.salWhiteStep(C, dt, play); // FIRE: white-hot
    if (C.shove) this.salShove(C, dt);
    if (play) {
      if (C.boss) this.salBossSync(C);
      if (C.cool <= 0 && C.wetCD <= 0 && C.ph !== 'in' && C.ph !== 'sink' && !this.salHidden(C)) this.salWater(C);
      if ((C.ph === 'walk' || C.ph === 'brake' && C.pend === 'warn') && C.rivalCD <= 0) this.salRivalCheck(C);
      if ((C.ph === 'walk' || C.ph === 'brake' && (C.pend === 'warn' || C.pend === 'coil')) && C.fcd <= 0 && C.cool <= 0) this.salFaceCheck(C);
    }
    switch (C.ph) {
      case 'in': if ((C.t -= dt) <= 0) this.salSet(C, 'walk'); break;
      case 'walk': {
        if (play && C.cool <= 0 && C.bcd <= 0 && !C.climb) { // an egg at its snout: coil, then snap (BITE)
          const e = this.salBiteAt(C);
          if (e) { if (this.salMay(C, 'bite')) { C.bj = e.id; this.salHalt(C, 'coil', BITE.coil * this.PM.warn); } else this.salStalk(C); break; }
        }
        C.og = 0;
        if (play && this.salFuOK(C)) { // FIRE: greedy for a flame orb in its channel; one at the snout is gulped; lava under it fires it up at once
          if (this.salLavaUnder(C)) { this.salFireUp(C, 'lava'); }
          else {
            const O = this.salOrbWant(C);
            if (O) {
              C.og = 1;
              if (O.d < FIRE.orbR * Math.max(1, this.salRank(C)) && !C.climb) { this.salGulpStart(C, O.o); break; }
            }
          }
        }
        // 0.8.19 the player turned the ring it rides while it hunts: it re-plans at once (a U-turn, a climb, a dive)
        if (play && C.ht >= 0 && !C.og && this.salTurned(C.car)) { C.tcd = Math.min(C.tcd, 0.2); C.climbCD = Math.min(C.climbCD, 0.3); }
        if (play && C.cool <= 0 && !C.og && !C.climb && this.salDiveReady(C)) { // DIVE: the egg is far: through the lava
          const X = this.salDiveAt(C);
          if (X) { C.dvC = X.ce; C.dvR = X.ri; C.dvL = X.la; this.salHalt(C, 'sink', DIVE.sink); break; }
        }
        if (play && C.cool <= 0 && !C.og && !C.climb && this.salLashReady(C) && !this.salCrossing(C)) { // LASH: an egg in line and in reach
          const e = this.salLashAt(C);
          if (e) { if (this.salMay(C, 'lash')) { C.lj = e.id; C.lk = 0; C.ls = 0; this.salHalt(C, 'lash', this.salDyn(C).tell); } else this.salStalk(C); break; }
        }
        if (play && C.cool <= 0 && !C.boss && C.bored <= 0 && C.brT >= this.PM.salGap && !C.climb && !this.salCrossing(C)) { // an egg by a wall just ahead: breathe at it
          const S = this.salStrikeAt(C);
          if (S && this.salMay(C, 'breath')) { C.tw = S.w; C.jet = S.jet; C.jk = S.id; this.salHalt(C, 'warn', SAL.warn * this.PM.warn); break; }
        }
        if (play && C.cool <= 0 && (C.next -= dt) <= 0 && !C.climb && !this.salCrossing(C)) {
          C.jet = 0; C.jk = -1;
          C.tw = this.salPickWall(C);
          if (!this.salBreathNear(C) || this.salMay(C, 'breath')) { this.salHalt(C, 'warn', SAL.warn * this.PM.warn); break; }
          C.next = 1; // an egg by that wall and the director says not now: it walks on and breathes later
        }
        if (play && C.cool <= 0 && (C.bored <= 0 || C.og) && this.salChase(C)) break;
        this.salMove(C, SAL.speed * Math.sqrt(this.salRank(C)) * this.salPace(C) * (C.wh > 0 ? FIRE.speed : 1) * dt);
        break;
      }
      // ---- 0.8.19 refused by the director: it creeps closer, eyes on its egg, then asks again
      case 'stalk':
        if (play && !this.salBiteAt(C)) this.salMove(C, STALK.v * C.size * dt, true);
        if ((C.t -= dt) <= 0) this.salSet(C, 'walk');
        break;
      // ---- 0.8.19 TONGUE LASH (LASH)
      case 'lash': { // the tell: crouched, throat aglow, eyes locked on the egg
        const e = this.salLashEgg(C);
        if (!e || !this.salLashLine(C, e, LASH.reach + 0.25)) { this.salLashMiss(C, 'tell'); break; }
        if ((C.t -= dt) <= 0) { C.lk = 0; this.salSet(C, 'fling', LASH.fly); }
        break;
      }
      case 'fling': { // the tongue flies
        const e = this.salLashEgg(C);
        C.lk = clamp(1 - C.t / C.dur, 0, 1);
        if (!e || !this.salLashLine(C, e, LASH.reach + 0.35)) { this.salLashMiss(C, 'fly'); break; }
        if ((C.t -= dt) <= 0) this.salLashStick(C, e);
        break;
      }
      case 'reel': if (play) this.salReelStep(C, dt); break;
      case 'strain': if ((C.t -= dt) <= 0) this.salLashSnap(C, 'stone'); break; // a stone egg: it pulls and pulls, then the tongue snaps back
      // ---- 0.8.19 LAVA DIVE (DIVE)
      case 'sink': if ((C.t -= dt) <= 0) this.salSet(C, 'under', DIVE.under); break;
      case 'under': if ((C.t -= dt) <= 0) this.salSet(C, 'bubble', this.salDyn(C).tell * DIVE.bubble); break;
      case 'bubble': if ((C.t -= dt) <= 0) this.salDiveRise(C); break;
      case 'rise': if ((C.t -= dt) <= 0) { C.dcd = DIVE.cd / (this.menaceHeat ? this.menaceHeat() : 1); C.lcd = Math.min(C.lcd, 0.3); C.tcd = 0; this.salSet(C, 'walk'); } break;
      case 'spitWarn': // SPIT: rear, cheeks puff, the fuse runs down his back; his eye stays on the egg
        if (play) this.salSpitAim(C);
        if ((C.t -= dt) <= 0) { if (play) this.salSpitLaunch(C); this.salSet(C, 'spit', SPIT.after); }
        break;
      case 'spit': if ((C.t -= dt) <= 0) { C.sj = -1; C.next = Math.max(C.next, 1.5); this.salSet(C, 'walk'); } break;
      case 'gulp': if ((C.t -= dt) <= 0) { if (play) this.salFireUp(C, 'orb'); this.salSet(C, 'walk'); } break;
      case 'turn': this.salTurnStep(C, dt); break;
      case 'brake': {
        const r = (C.stopAt - C.odo) * C.mv, d = Math.min(Math.max(0, r), SAL.brakeV * dt);
        if (C.mv > 0) this.salMove(C, d, true); else this.salBackWalk(C, d);
        if (r - d <= 1e-6) { C.odo = C.stopAt; this.salSet(C, C.pend, C.pendT); }
        break;
      }
      case 'warn':
        if ((C.t -= dt) <= 0) { if (this.warpStrike('sal', C)) break; this.salSet(C, 'fire', SAL.fire); C.lit = 0; } // v3.4: a warp gate takes the breath
        break;
      case 'fire': // the wall heats when the jet reaches it, a beat after the mouth opens
        if (!C.lit && C.dur - C.t >= SAL.lit) { C.lit = 1; this.salFire(C); }
        if ((C.t -= dt) <= 0) this.salSet(C, 'settle', SAL.settle);
        break;
      case 'settle':
        if ((C.t -= dt) <= 0) { if (C.jet > 0) C.bored = this.salDyn(C).rest; // an aimed breath: it walks on a moment (0.8.19: the dyn rest, was 3 s)
          C.next = C.jet > 0 ? Math.max(C.next, this.salEvery(C) * 0.5) : this.salEvery(C); C.jet = 0; C.jk = -1; this.salSet(C, 'walk'); }
        break;
      case 'coil': if ((C.t -= dt) <= 0) this.salSnap(C); break;
      case 'chew': if ((C.t -= dt) <= 0) { C.bored = C.bcd = Math.max(1.2, 2 * this.salDyn(C).rest); /* 0.8.19: was BITE.full */ C.next = Math.max(C.next, 2); this.salSet(C, 'walk'); } break;
      case 'miss': if ((C.t -= dt) <= 0) { C.bcd = BITE.cd; this.salSet(C, 'walk'); } break;
      case 'face': this.salFaceStep(C, dt, play); break;
      case 'hiss': if ((C.t -= dt) <= 0) { C.back = SAL.coolBack * C.size; this.salSet(C, 'retreat'); } break;
      case 'retreat': {
        const d = Math.min(C.back, SAL.backV * dt);
        this.salBackWalk(C, d);
        if ((C.back -= d) <= 1e-6) { C.back = 0; if (C.cool > 0) this.salHalt(C, 'rest', 0); else this.salSet(C, 'walk'); }
        break;
      }
      case 'roar': if ((C.t -= dt) <= 0) this.salSet(C, 'walk'); break; // 0.8.19 the boss calls the volcano's volley
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

  // the director's token goes back when its move is over (any phase that is not part of a costly move), with "an egg taken"
  salTokBack(C) {
    if (!C.tok || HOLD.has(C.ph)) return;
    const m = C.tok, took = C.tokT;
    C.tok = ''; C.tokT = 0;
    if (this.menaceDone) this.menaceDone('c' + C.id, m, !!took);
  },
  salSet(C, ph, t = 0) {
    C.ph = ph; C.t = C.dur = t; C.pend = null;
    this.salTokBack(C);
    C.mv = ph === 'retreat' ? -1 : 1;
    if (ph === 'turn') { C.ut = C.rad <= this.salMid(this.salCh(C)) ? 1 : -1; C.uA = C.a; C.uR = C.rad; C.uD = C.dir; C.climb = null; }
    if (ph === 'warn' && C.jet > 0) this.salAim(C);
    if (ph === 'coil') { const e = this.salBiteEgg(C), h = C.pts[0], p = e ? e.body.getPosition() : h; this.emit('salCoil', { x: h.x, y: h.y, ex: p.x, ey: p.y, id: C.id, egg: e, frost: C.kind === 'frost' }); }
    if (ph === 'warn') { const T = this.salTarget(C), h = C.pts[0]; this.emit('salWarn', { x: T.x, y: T.y, hx: h.x, hy: h.y, ring: T.ri, id: C.id }); }
    if (ph === 'lash' || ph === 'fling') { // 0.8.19 LASH: the tell (lash) and the tongue's flight (fling): mouth, the egg
      const e = this.salLashEgg(C), M = this.salMouth(C), p = e ? e.body.getPosition() : M;
      this.emit(ph === 'lash' ? 'salLashWarn' : 'salLashFling', { x: p.x, y: p.y, hx: M.x, hy: M.y, id: C.id, egg: e, t });
    }
    if (ph === 'fade' || ph === 'pop') { const h = C.pts[0], o = C.tg; this.emit(ph === 'fade' ? 'chamFade' : 'chamPop', { x: h.x, y: h.y, id: C.id, ox: o ? o.x : h.x, oy: o ? o.y : h.y }); } // 0.8.19 VANISH
    if (ph === 'sink' || ph === 'bubble') { // 0.8.19 DIVE: where it goes down (x, y) and the exit pool (ex, ey)
      const h = C.pts[0], P = this.salDivePt(C);
      this.emit(ph === 'sink' ? 'salDiveWarn' : 'salDiveBubble', { x: h.x, y: h.y, ex: P.x, ey: P.y, id: C.id, t, egg: this.salTargetEgg(C) });
    }
    if (ph === 'spitWarn') { // SPIT: x, y = where its line crosses the ring between (the gap a turn of that ring takes away)
      const h = C.pts[0], q = this.salCross(h.x, h.y, C.sx, C.sy)[0] || { x: (h.x + C.sx) / 2, y: (h.y + C.sy) / 2, ri: -1 };
      this.emit('salSpitWarn', { x: q.x, y: q.y, ring: q.ri, hx: h.x, hy: h.y, tx: C.sx, ty: C.sy, id: C.id });
    }
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
    if (C.sp === 'gecko') { this.geckoEnter(C); return; }
    if (C.sp === 'thornback') { this.thornEnter(C); return; }
    if (C.sp === 'chameleon') { this.chamEnter(C); return; }
    const n = this.rings.length, ch = clamp(C.ch, 1, n - 1), r = this.salMid(ch), m = Math.ceil(this.salBodyLen(C) / SAL.trail) + 2;
    C.rad = r; C.a = C.a0; C.pts = [];
    for (let i = 0; i < m; i++) C.pts.push(this.salPt({}, C.a - C.dir * (i * SAL.trail) / r, r));
    C.ph = 'in'; C.t = C.dur = 0.6; C.next = C.boss ? this.salEvery(C) * 0.6 : C.every * (this.PM.sal || 1) * 0.6; C.brT = 0;
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
        C.a += d; C.uA += d; // (uA: where a U-turn started rides along too)
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
        if (this.chAt(C.rad) === K.to && Math.abs(C.rad - this.salMid(K.to)) < 0.12) { C.climb = null; C.climbCD = C.ht >= 0 && !C.boss ? BRAIN.hunt : SAL.climbCD; if (C.sp !== 'sal') C.dir = C.sp === 'chameleon' ? this.chamDir(C) : this.geckoDir(C); }
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
    if (C.og) return; // FIRE: it stays in its channel while it goes for a flame orb there
    if (C.sp === 'chameleon') top = C.goal; // L26: toward the orb he wants, not the eggs
    else {
      const T = C.boss ? null : this.salTargetEgg(C); // hunting (the brain): toward its target's channel
      if (T) top = this.channelOf(T);
      else for (const e of this.aliveEggs()) { const c = this.channelOf(e); if (c < n) top = Math.max(top, c); }
    }
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
      const z = T[T.length - 1], y = T[T.length - 2], n = this.rings.length, c = clamp(this.chAt(z.r), 1, n - 1);
      const dr = clamp(this.salMid(c) - z.r, -SAL.trail * 0.7, SAL.trail * 0.7), r = z.r + dr;
      // 0.8.19 (the Twister bug: "half of the body stayed, the other half went for a spin"): the tail grows on round the
      // channel the way the body already runs from head to tail. It used to follow only the last step, and a tail that
      // came in radially through a gap (no way round at all) grew back toward the head: the body folded in half.
      let da = wrap(z.a - y.a);
      if (Math.abs(da) * Math.max(z.r, 0.3) < SAL.trail * 0.4) da = wrap(z.a - T[0].a) || -C.dir;
      T.push(this.salPt({}, z.a + Math.sign(da) * Math.sqrt(SAL.trail * SAL.trail - dr * dr) / Math.max(r, 0.3), r));
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

  // ---------- the brain (BRAIN): notice, chase, strike
  // an egg it can go for: one out in the channels (not still in the centre chamber, not on its way out of the vault), and not
  // one a thief, a crab, an octopus or a lick holds (the gecko leaves a frozen one be)
  salPreyOK(C, e) { const c = this.channelOf(e); return c >= 1 && c < this.rings.length && !(e.thf || e.hc || e.octo || e.hold || (C.sp === 'gecko' && e.icy > 0)); },
  // where an egg is from its head: distance, its channel, and m along its channel (ccw +)
  salRel(C, e) {
    const h = C.pts[0], p = e.body.getPosition(), n = this.rings.length, hc = this.salCh(C), ce = clamp(this.channelOf(e), 1, n - 1);
    const hr = Math.max(0.5, Math.hypot(h.x, h.y)), along = wrap(Math.atan2(p.y, p.x) - Math.atan2(h.y, h.x)) * hr;
    return { p, d: Math.hypot(p.x - h.x, p.y - h.y), ce, same: ce === hc, along };
  },
  // look about: keep the target while it stays near, else take the nearest egg it notices. The first one after a quiet spell alerts it.
  salSense(C, dt) {
    let best = null, bs = 1e9;
    for (const e of this.aliveEggs()) {
      if (!this.salPreyOK(C, e)) continue;
      const R = this.salRel(C, e), keep = e.id === C.ht, ahead = R.along * C.dir;
      const seen = keep ? R.d < BRAIN.lose || (R.same && Math.abs(R.along) < BRAIN.lost) : R.d < BRAIN.see || (R.same && ahead > 0 && ahead < BRAIN.sight);
      if (!seen) continue;
      const sc = (R.same ? Math.abs(R.along) : R.d + 1) - (keep ? 0.5 : 0);
      if (sc < bs) { bs = sc; best = e; }
    }
    if (!best) { C.ht = -1; C.htT = Math.min(99, C.htT + dt); return null; }
    if (best.id !== C.ht && C.htT >= BRAIN.quiet) {
      const h = C.pts[0], p = best.body.getPosition();
      C.alT = BRAIN.alert;
      this.emit('salAlert', { id: C.id, sp: C.sp, x: h.x, y: h.y, ex: p.x, ey: p.y, egg: best });
    }
    C.ht = best.id; C.htT = 0;
    return best;
  },
  salTargetEgg(C) { return C.ht >= 0 ? this.eggs.find((x) => x.id === C.ht && x.alive && !x.saved) || null : null; },
  // walk speed factor: PRED.chase while it has a target (not the boss: its pace stays with the fight's rhythm)
  // 0.8.19: today's Medium hunting pace (1.35) x the dyn tempo (mode, level, the director's heat)
  salPace(C) { return C.ht >= 0 && !C.boss && !(C.bored > 0) ? 1.35 * this.salDyn(C).tempo : 1; },
  // which way to go for its target: the shorter way round in its channel, or toward the gap that leads to the target's
  // channel. A target behind it: halt (all four feet down) and U-turn. true = it changed phase.
  salChase(C) {
    const O = C.og ? this.salOrbWant(C) : null, e = O ? null : this.salTargetEgg(C); // FIRE: a flame orb it wants comes first
    if ((!e && !O) || C.climb || C.tcd > 0 || this.salCrossing(C)) return false;
    let want = 0;
    if (O) {
      if (Math.abs(O.along) > BRAIN.behind) want = Math.sign(O.along);
      if (!want || want === C.dir) return false;
      this.salHalt(C, 'turn', BRAIN.turn);
      return true;
    }
    const R = this.salRel(C, e), hc = this.salCh(C), h = C.pts[0], ha = Math.atan2(h.y, h.x), hr = Math.max(0.5, Math.hypot(h.x, h.y));
    if (R.same) { if (Math.abs(R.along) > BRAIN.behind) want = Math.sign(R.along); }
    else {
      const ring = this.rings[R.ce > hc ? hc : hc - 1], ra = ring.body.getAngle(), ea = Math.atan2(R.p.y, R.p.x);
      const ways = ring.gaps.filter((g) => this.snakeGap(g) && g.len >= 0.6).map((g) => g.a).concat(this.salHoles(ring).filter((q) => q.len >= 0.6).map((q) => q.a));
      let bs = 1e9;
      for (const la of ways) {
        const dh = wrap(ra + la - ha) * hr, sc = Math.abs(dh) + 0.5 * Math.abs(wrap(ra + la - ea)) * hr;
        if (sc < bs) { bs = sc; want = Math.abs(dh) > BRAIN.behind ? Math.sign(dh) : 0; }
      }
    }
    if (!want || want === C.dir) return false;
    this.salHalt(C, 'turn', BRAIN.turn);
    return true;
  },
  // the U-turn: the head swings round in a tight loop (BRAIN.loopR ahead, BRAIN.loopW across) and the body follows its trail
  salTurnStep(C, dt) {
    C.t -= dt;
    const u = clamp(1 - C.t / C.dur, 0, 1), th = Math.PI * u * u * (3 - 2 * u);
    const along = BRAIN.loopR * Math.sin(th), across = C.ut * BRAIN.loopW * 0.5 * (1 - Math.cos(th));
    const r0 = C.rad, a0 = C.a, hc = this.salCh(C);
    C.rad = clamp(C.uR + across, this.rings[hc - 1].r + RING_TH / 2 + 0.12, this.rings[hc].r - RING_TH / 2 - 0.12);
    C.a = wrap(C.uA + (C.uD * along) / Math.max(0.5, C.uR));
    C.odo += Math.hypot(C.rad - r0, wrap(C.a - a0) * Math.max(0.5, C.rad));
    this.geckoTrail(C);
    if (C.t <= 0) { C.dir = -C.uD; C.tcd = BRAIN.turnCD * (C.sp === 'thornback' ? 1 : 1.5 - this.salDyn(C).chase); this.salSet(C, 'walk'); } // 0.8.19: a keen chaser turns again sooner
  },
  // an egg by either wall of its channel, ahead of the snout within breath range: {w: the wall (0 inner, 1 outer), jet: m ahead, id}
  salStrikeAt(C) {
    const h = C.pts[0], hc = this.salCh(C), hr = Math.max(0.5, Math.hypot(h.x, h.y)), ha = Math.atan2(h.y, h.x);
    let best = null;
    for (const e of this.aliveEggs()) {
      if (!this.salPreyOK(C, e)) continue;
      const p = e.body.getPosition(), d = Math.hypot(p.x, p.y), ahead = wrap(Math.atan2(p.y, p.x) - ha) * hr * C.dir;
      if (ahead < BRAIN.chin || ahead > BRAIN.reach) continue; // under its chin or behind: it walks on (and turns round after)
      const o0 = Math.abs(d - this.rings[hc - 1].r), o1 = Math.abs(d - this.rings[hc].r), w = o0 < o1 ? 0 : 1;
      if (Math.min(o0, o1) < BRAIN.wall && (!best || ahead < best.ahead)) best = { w, ahead, jet: clamp(ahead, 0.35, BRAIN.reach), id: e.id };
    }
    return best;
  },
  // on the telegraph's first beat: aim the breath where the egg it chose is now (it may have moved on while it braked)
  salAim(C) {
    const e = this.eggs.find((x) => x.id === C.jk && x.alive && !x.saved);
    if (!e) return;
    const h = C.pts[0], p = e.body.getPosition(), hr = Math.max(0.5, Math.hypot(h.x, h.y)), ahead = wrap(Math.atan2(p.y, p.x) - Math.atan2(h.y, h.x)) * hr * C.dir;
    C.jet = clamp(ahead, 0.35, BRAIN.reach);
  },

  // ---------- 0.8.19 refused by the director: stalk a moment (creeping closer, eyes on the egg), then ask again
  salStalk(C) { this.salHalt(C, 'stalk', STALK.t); },
  // an egg by the wall its idle breath is about to heat (then the breath is a costly move)
  salBreathNear(C) {
    const T = this.salTarget(C);
    return this.aliveEggs().some((e) => { const p = e.body.getPosition(); return Math.hypot(p.x - T.x, p.y - T.y) < this.salHotLen(C) / 2 + 0.6; });
  },

  // ---------- 0.8.19 TONGUE LASH (LASH)
  salLashReady(C) {
    if (C.lcd > 0 || C.sp !== 'sal' || C.kind === 'frost') return false;
    if (!C.boss) return true;
    const B = this.bx && this.bx.boss;
    return this.salPw(C, 'spit') && !(B && B.atk); // the boss: in the phases that had the spit, never over one of its own attacks
  },
  salLashEgg(C) { return C.lj >= 0 ? this.eggs.find((x) => x.id === C.lj && x.alive && !x.saved) || null : null; },
  // every ring between the mouth and the egg is open where the line crosses it
  salLashOpen(M, p) {
    return this.salCross(M.x, M.y, p.x, p.y).every((q) => { const ring = this.rings[q.ri]; return this.salOpenAt(ring, mod(Math.atan2(q.y, q.x) - ring.body.getAngle(), TAU), LASH.clear); });
  },
  salLashLine(C, e, maxD) {
    const M = this.salMouth(C), p = e.body.getPosition();
    return Math.hypot(p.x - M.x, p.y - M.y) <= maxD && this.salLashOpen(M, p);
  },
  // the nearest egg in front of the mouth, LASH.min .. LASH.reach m, with a clear line
  salLashAt(C) {
    const M = this.salMouth(C), hd = Math.atan2(M.hy, M.hx);
    let best = null, bd = 1e9;
    for (const e of this.aliveEggs()) {
      if (!this.salPreyOK(C, e) || e.icy > 0 || e.honey > 0) continue;
      const p = e.body.getPosition(), d = Math.hypot(p.x - M.x, p.y - M.y);
      if (d < LASH.min || d > LASH.reach || Math.abs(wrap(Math.atan2(p.y - M.y, p.x - M.x) - hd)) > LASH.cone) continue;
      if (!this.salLashOpen(M, p)) continue;
      const sc = d + (e.water > 0 ? 1.5 : 0); // it would rather not lick a water egg (it still will, and pays for it)
      if (sc >= bd) continue;
      bd = sc; best = e;
    }
    return best;
  },
  // the tongue arrives: it sticks (and reels), or the egg is something it cannot take
  salLashStick(C, e) {
    const p = e.body.getPosition(), M = this.salMouth(C);
    C.lk = 1;
    if (e.water > 0) { this.salQuell(C, p.x, p.y); return; } // a mouthful of water
    if (e.fire > 0) { this.salDaze(C, LASH.burn, 'burn'); C.lj = -1; C.lcd = LASH.cd; this.emit('salLashBurn', { x: p.x, y: p.y, hx: M.x, hy: M.y, id: C.id, egg: e }); return; }
    if (e.chick) { this.chickFlee(e, 'snake'); this.salLashMiss(C, 'chick'); return; }
    if (this.armored(e)) { this.salSet(C, 'strain', LASH.strain); this.emit('salLashStrain', { x: p.x, y: p.y, hx: M.x, hy: M.y, id: C.id, egg: e }); return; }
    C.ls = 0;
    C.lgR = -1; C.lw = 0;
    this.salSet(C, 'reel', LASH.maxReel);
    this.emit('salLashStick', { x: p.x, y: p.y, hx: M.x, hy: M.y, id: C.id, egg: e });
  },
  salReelK(C) { return dyn('salamander', 'medium').snatch / this.salDyn(C).snatch; }, // the mode's window: a slower reel on Easy
  // reeling: the egg is pulled toward the mouth; a wall between, or the tongue stretched too far (the tug of war), snaps it
  salReelStep(C, dt) {
    const e = this.salLashEgg(C);
    if (!e || e.icy > 0 || e.hold) { this.salLashSnap(C, 'lost'); return; }
    const M = this.salMouth(C), p = e.body.getPosition(), dx = M.x - p.x, dy = M.y - p.y, d = Math.hypot(dx, dy) || 1e-6, top = LASH.reach + LASH.slack;
    C.ls = clamp((d - LASH.reach * 0.55) / (top - LASH.reach * 0.55), 0, 1);
    if (d > top) { this.salLashTug(C, p); return; }
    // through a gap: the tongue drags the egg to the gap it went through (fixed where it was when it stuck) and on through,
    // then on to the mouth. The gap turned away (or a wall in the straight line) for LASH.jam s: it lets go
    const pr = Math.hypot(p.x, p.y);
    if (C.lgR >= 0 && (Math.sign(pr - this.rings[C.lgR].r) !== C.lgS && Math.abs(pr - this.rings[C.lgR].r) > LASH.past)) C.lgR = -1;
    if (C.lgR < 0) { const X = this.salCross(M.x, M.y, p.x, p.y), q = X[X.length - 1]; if (q) { C.lgR = q.ri; C.lgA = Math.atan2(q.y, q.x); C.lgS = Math.sign(pr - this.rings[q.ri].r) || 1; } }
    let tx = M.x, ty = M.y, open;
    if (C.lgR >= 0) {
      const ring = this.rings[C.lgR], r = ring.r - C.lgS * (LASH.past + 0.1);
      open = this.salOpenAt(ring, mod(C.lgA - ring.body.getAngle(), TAU), LASH.clear);
      tx = r * Math.cos(C.lgA); ty = r * Math.sin(C.lgA);
    } else open = this.salLashOpen(M, p);
    C.lw = open ? 0 : C.lw + dt;
    if (C.lw > LASH.jam) { this.salLashSnap(C, 'wall'); return; }
    const bd = this.salBiteDist(C, e);
    if (bd >= 0 && bd < BITE.reach * Math.max(0.9, this.salRank(C))) { C.bj = e.id; C.lj = -1; C.lk = 0; this.salSnap(C); return; } // at the mouth: the bite
    const gx = tx - p.x, gy = ty - p.y, gd = Math.hypot(gx, gy) || 1e-6, ux = gx / gd, uy = gy / gd, v = e.body.getLinearVelocity(), va = v.x * ux + v.y * uy, want = LASH.reelV * this.salReelK(C) * this.vs;
    // the tongue holds the egg up (gravity cancelled), steadies it on the line (sideways speed damped) and pulls it along
    const dv = va < want ? Math.min(want - va, LASH.acc * dt) : 0, vy = v.y + this.g * dt, vp = 1 - Math.min(1, LASH.steady * dt);
    const pa = v.x * ux + vy * uy, px = v.x - ux * pa, py = vy - uy * pa;
    e.body.setLinearVelocity(Vec2(ux * (pa + dv) + px * vp, uy * (pa + dv) + py * vp)); e.body.setAwake(true);
    if ((C.t -= dt) <= 0) this.salLashSnap(C, 'slip');
  },
  // a clean miss (out of line or reach before it stuck): he blinks, annoyed
  salLashMiss(C, why) {
    const M = this.salMouth(C);
    C.lj = -1; C.lk = 0; C.ls = 0; C.lcd = LASH.cd * 0.6;
    this.salSet(C, 'miss', LASH.miss);
    this.emit('salLashMiss', { x: M.x, y: M.y, id: C.id, why });
  },
  // the tongue lets go mid-reel: a wall came between, the egg was lost, or (stone) it could not budge it
  salLashSnap(C, why) {
    const M = this.salMouth(C), e = this.salLashEgg(C), p = e ? e.body.getPosition() : M;
    C.lj = -1; C.lk = 0; C.ls = 0; C.lcd = LASH.cd;
    if (why === 'stone') { this.salDaze(C, LASH.ouch * this.PM.back, 'ouch'); C.dk = 'ouch'; }
    else this.salSet(C, 'miss', LASH.miss);
    this.emit('salLashSnap', { x: p.x, y: p.y, hx: M.x, hy: M.y, id: C.id, why });
  },
  // the tug of war won by the player: stretched past its length, it snaps and he tumbles back, dazed
  salLashTug(C, p) {
    const M = this.salMouth(C);
    C.lj = -1; C.lk = 0; C.ls = 0; C.lcd = LASH.cd;
    C.shove -= C.dir * 0.4;
    this.salDaze(C, LASH.tumble, 'tug');
    this.emit('salLashSnap', { x: p.x, y: p.y, hx: M.x, hy: M.y, id: C.id, why: 'tug' });
  },

  // ---------- 0.8.19 LAVA DIVE (DIVE)
  salDiveReady(C) {
    if (C.dcd > 0 || C.sp !== 'sal' || C.kind === 'frost' || C.ht < 0 || this.salCrossing(C)) return false;
    const B = C.boss && this.bx && this.bx.boss;
    return !(B && B.atk);
  },
  // m of walking from the head to the nearest way through the ring toward channel ce
  salWayLen(C, ce) {
    const hc = this.salCh(C), ring = this.rings[ce > hc ? hc : hc - 1], ra = ring.body.getAngle(), h = C.pts[0], ha = Math.atan2(h.y, h.x), hr = Math.max(0.5, Math.hypot(h.x, h.y));
    let best = Infinity;
    for (const g of ring.gaps) if (this.snakeGap(g) && g.len >= 0.6) best = Math.min(best, Math.abs(wrap(ra + g.a - ha)) * hr);
    for (const q of this.salHoles(ring)) if (q.len >= 0.6) best = Math.min(best, Math.abs(wrap(ra + q.a - ha)) * hr);
    return best;
  },
  salDiveAt(C) {
    const e = this.salTargetEgg(C), n = this.rings.length;
    if (!e) return null;
    const hc = this.salCh(C), ce = this.channelOf(e);
    if (ce < 1 || ce >= n || ce === hc) return null;
    if (Math.abs(ce - hc) < DIVE.chans && this.salWayLen(C, ce) <= DIVE.walk) return null; // a gap close by: it climbs
    return this.salDiveSpot(e, ce);
  },
  // the exit pool: DIVE.off m from the egg along its channel, on solid floor, on the side farther from that floor's gaps
  salDiveSpot(e, ce) {
    const p = e.body.getPosition(), r = this.salMid(ce), ea = Math.atan2(p.y, p.x);
    let best = null;
    for (const s of [1, -1]) {
      const a = ea + (s * DIVE.off) / r, ri = Math.sin(a) < 0 ? ce : ce - 1, ring = this.rings[ri];
      if (!this.solidAt(ring, ring.r * Math.cos(a), ring.r * Math.sin(a))) continue;
      const la = mod(a - ring.body.getAngle(), TAU);
      let gd = 9;
      for (const g of ring.gaps) gd = Math.min(gd, Math.abs(wrap(la - g.a)) * ring.r - g.len / 2);
      if (!best || gd > best.gd + 1e-9) best = { ri, la, ce, gd };
    }
    return best;
  },
  // where the exit pool is now (it rides its ring): on the floor of the channel
  salDivePt(C) {
    const ring = this.rings[C.dvR], a = ring.body.getAngle() + C.dvL, r = ring.r + (C.dvR === C.dvC ? -1 : 1) * (RING_TH / 2 + 0.16);
    return { x: r * Math.cos(a), y: r * Math.sin(a), a };
  },
  salDiveRise(C) {
    const P = this.salDivePt(C), r = this.salMid(C.dvC), a = P.a, e = this.salTargetEgg(C), m = Math.ceil(this.salBodyLen(C) / SAL.trail) + 2;
    let dir = C.dir;
    if (e) { const p = e.body.getPosition(); dir = wrap(Math.atan2(p.y, p.x) - a) >= 0 ? 1 : -1; }
    C.pts = [];
    for (let i = 0; i < m; i++) C.pts.push(this.salPt({}, a - (dir * i * SAL.trail) / r, r));
    C.rad = r; C.a = a; C.dir = dir; C.car = -1; C.climb = null; C.shove = 0;
    this.salCarry(C);
    this.salSet(C, 'rise', DIVE.rise);
    this.emit('salDiveUp', { x: P.x, y: P.y, id: C.id });
    for (const q of this.aliveEggs()) { const w = q.body.getPosition(); if (q.water > 0 && Math.hypot(w.x - P.x, w.y - P.y) < DIVE.poolR + 0.4) { this.salWet(C, w.x, w.y); break; } } // a water egg on the pool
  },

  // ---------- the bite (BITE)
  salBiteEgg(C) { return C.bj >= 0 ? this.eggs.find((x) => x.id === C.bj && x.alive && !x.saved) || null : null; },
  // m from the snout to an egg, or -1 when it is behind the head
  salBiteDist(C, e) {
    const h = C.pts[0], p = e.body.getPosition(), hr = Math.max(0.5, Math.hypot(h.x, h.y));
    const ahead = wrap(Math.atan2(p.y, p.x) - Math.atan2(h.y, h.x)) * hr * C.dir;
    return ahead < -BITE.back ? -1 : Math.hypot(p.x - h.x, p.y - h.y);
  },
  // an egg it could bite now: the nearest one in reach of the snout (the same eggs the brain hunts; a frozen one is left be)
  salBiteAt(C) {
    let best = null, bd = BITE.reach * Math.max(0.9, this.salRank(C));
    for (const e of this.aliveEggs()) {
      if (!this.salPreyOK(C, e) || e.icy > 0) continue;
      const d = this.salBiteDist(C, e);
      if (d >= 0 && d < bd) { bd = d; best = e; }
    }
    return best;
  },
  salSnap(C) {
    const e = this.salBiteEgg(C), h = C.pts[0];
    const d = e ? this.salBiteDist(C, e) : -1;
    C.bj = -1;
    if (!e || d < 0 || d > (BITE.reach + BITE.keep) * Math.max(0.9, this.salRank(C)) || !this.salPreyOK(C, e)) { // it rolled away in time: the jaws clack on air
      this.salSet(C, 'miss', BITE.miss);
      this.emit('salSnapMiss', { x: h.x, y: h.y, id: C.id });
      return;
    }
    const p = e.body.getPosition(), frost = C.kind === 'frost';
    if (frost ? e.fire > 0 : e.water > 0) { this.salQuell(C, p.x, p.y); return; } // a mouthful of water (of fire)
    if (this.armored(e)) { // rock skin, stone, the feather: it bites on something hard and reels
      C.bcd = BITE.full; C.next = Math.max(C.next, 2.5);
      this.salSet(C, 'daze', BITE.ouch * this.PM.back); C.dk = 'ouch';
      this.emit('salOuch', { x: (p.x + h.x) / 2, y: (p.y + h.y) / 2, id: C.id, egg: e });
      return;
    }
    if (e.chick) { this.chickFlee(e, 'snake'); C.ate++; this.salSet(C, 'chew', BITE.chew * 0.6); this.emit('salEat', { x: p.x, y: p.y, id: C.id, chick: true, frost }); return; }
    if (frost) { // frost bite: a crack, and the egg freezes onto its wall (Easy: never the breaking crack)
      const last = this.MD.softThorns && e.cracks >= 2;
      if (!last) { this.crack(e, 0, 'frostbite'); C.tokT = 1; }
      if (e.alive) this.iceEgg(e, FROST.freeze);
      this.salSet(C, 'chew', BITE.chew * 0.6);
      this.emit('salFrostBite', { x: p.x, y: p.y, hx: h.x, hy: h.y, id: C.id, egg: e, soft: last ? 1 : 0 });
      return;
    }
    C.tokT = 1; // (the director hears an egg was taken)
    this.breakEgg(e, 'sal');
    if (e.alive) { this.salSet(C, 'miss', BITE.miss); this.emit('salSnapMiss', { x: h.x, y: h.y, id: C.id, guard: 1 }); return; } // the guardian feather held
    C.ate++;
    this.salSet(C, 'chew', BITE.chew);
    this.emit('salEat', { x: p.x, y: p.y, hx: h.x, hy: h.y, id: C.id });
  },
  // freeze an egg onto the nearer wall of its channel for T s: it rides that ring, nothing else moves it (the gecko's lick, the frost bite)
  iceEgg(e, T) {
    const p = e.body.getPosition(), n = this.rings.length, c = this.channelOf(e), d = Math.hypot(p.x, p.y);
    let ring = null;
    for (const ri of [c - 1, c]) if (ri >= 0 && ri < n && (!ring || Math.abs(this.rings[ri].r - d) < Math.abs(ring.r - d))) ring = this.rings[ri];
    if (!ring) return false;
    const rb = ring.body, lp = rb.getLocalPoint(p);
    e.hold = { ri: ring.i, x: lp.x, y: lp.y, a: e.body.getAngle() - rb.getAngle() };
    e.icy = T; e.iceN = 0; e.iceA = 0; e.iceD = 0; e.iceBy = -1;
    e.body.setLinearVelocity(rb.getLinearVelocityFromWorldPoint(p)); e.body.setAngularVelocity(rb.getAngularVelocity());
    return true;
  },

  // ---------- the face-off: fire against frost (FACE)
  salFaceCheck(C) {
    if (C.boss || C.sp !== 'sal') return;
    const hc = this.salCh(C), h = C.pts[0];
    for (const O of this.sals) {
      if (O === C || O.sp !== 'sal' || O.boss || (O.kind === 'frost') === (C.kind === 'frost') || !this.salLive(O) || O.fcd > 0 || O.cool > 0) continue;
      if (!(O.ph === 'walk' || O.ph === 'brake' || O.ph === 'warn' || O.ph === 'coil' || O.ph === 'settle' || O.ph === 'miss')) continue;
      if (this.salCh(O) !== hc || this.salCrossing(O) || this.salCrossing(C)) continue;
      const oh = O.pts[0];
      if (Math.hypot(oh.x - h.x, oh.y - h.y) > FACE.r) continue;
      for (const X of [C, O]) { this.salRelease(X); X.climb = null; X.bj = -1; X.jet = 0; X.fid = X === C ? O.id : C.id; X.fv = 0; X.next = Math.max(X.next, FACE.t + 1.5); this.salSet(X, 'face', FACE.t); }
      this.emit('salFace', { x: (h.x + oh.x) / 2, y: (h.y + oh.y) / 2, a: C.id, b: O.id });
      return;
    }
  },
  salFaceStep(C, dt, play) {
    const O = this.sals.find((x) => x.id === C.fid), el = C.dur - C.t;
    if (!play || !O || (O.ph !== 'face' && el < FACE.burst)) { C.fid = -1; C.fcd = FACE.cd * 0.5; this.salSet(C, 'walk'); return; } // the other one was knocked out of it
    const h = C.pts[0], oh = O.pts[0], mx = (h.x + oh.x) / 2, my = (h.y + oh.y) / 2;
    if (el < FACE.jet && Math.hypot(oh.x - h.x, oh.y - h.y) < 0.95) this.salBackWalk(C, SAL.backV * 0.5 * dt); // nose to nose, never touching
    if (el >= FACE.jet && !(C.fv & 1)) { C.fv |= 1; this.emit('salFaceJet', { x: h.x, y: h.y, tx: mx, ty: my, id: C.id, frost: C.kind === 'frost' }); }
    if (el >= FACE.burst && !(C.fv & 2)) { C.fv |= 2; if (C.kind !== 'frost') this.emit('salFaceBurst', { x: mx, y: my, a: C.id, b: O.id }); }
    if ((C.t -= dt) > 0) return;
    C.fid = -1; C.fcd = FACE.cd; C.bcd = Math.max(C.bcd, 2); C.bored = Math.max(C.bored, 2);
    if (C.kind === 'frost') { this.salSet(C, 'daze', FACE.daze); C.dk = 'melt'; }
    else { C.cool = SAL.cool; C.wetCD = SAL.cool + SAL.wetCD; C.back = FACE.back * C.size; this.salSet(C, 'retreat'); }
  },

  // ---------- the breath
  salFire(C) {
    const T = this.salTarget(C), ring = this.rings[T.ri], la = T.a - ring.body.getAngle(), half = this.salHotLen(C) / (2 * ring.r);
    const k = ++this.salBurnN, dbl = C.dbl ? 1 : 0;
    C.brT = 0; C.dbl = 0; // FIRE: the white-hot double breath is spent
    let n = 0;
    if (C.kind === 'frost') { // the frost salamander: the section ices over (frictionless), nothing burns
      ring.segs.forEach((sg) => { if (sg.alive && Math.abs(wrap((sg.a0 + sg.a1) / 2 - la)) <= half) { sg.ice = Math.max(sg.ice || 0, FROST.ice); n++; } });
      this.emit('salFrost', { x: T.x, y: T.y, ring: ring.i, id: C.id, n });
      return;
    }
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
    this.emit('salFire', { x: T.x, y: T.y, ring: ring.i, id: C.id, n, burnt, dbl });
  },
  volcOrigin() { return { x: VOLC.x * this.outerR, y: this.outerR + VOLC.y }; }, // where the bombs come from (the art draws them from the backdrop's crater)
  // 0.8.19 a ring section turned red-hot from outside (a volcano bomb): the same rule as a breath
  salHeatArc(ri, la, len) {
    const ring = this.rings[ri], half = len / (2 * ring.r), k = ++this.salBurnN;
    let n = 0, burnt = 0;
    ring.segs.forEach((sg, si) => {
      if (!sg.alive || Math.abs(wrap((sg.a0 + sg.a1) / 2 - la)) > half) return;
      if (!(sg.hot > 0)) this.salHot.push({ ri: ring.i, si });
      sg.hot = SAL.hotT; sg.hotK = k; n++;
    });
    for (const th of ring.thorns) if (th.alive && Math.abs(wrap(th.a - la)) < half + 0.1 / ring.r) { this.removeThorn(th, 'burn'); burnt++; }
    this.chickGain = (this.chickGain || 0) + burnt;
    return n;
  },
  salHotLen(C) { return SAL.hotLen * C.size * (C.dbl ? FIRE.dbl : 1); }, // m of wall a breath heats (FIRE: double while white-hot)

  // ---------- 0.8.18 powers: the ember spit (SPIT) and the fire-up (FIRE)
  // is a power on: the level's salamander spec, or (the boss) its current phase's flag {spit, fire}
  salPw(C, k) {
    if (C.sp !== 'sal' || C.kind === 'frost') return false;
    if (!C.boss) return !!C[k];
    const B = this.bx && this.bx.boss, ph = B ? bossPhases(this)[B.phase] || {} : {};
    return !!ph[k === 'fu' ? 'fire' : 'spit'];
  },
  salSpitM() { return SPIT_M[this.mode] || SPIT_M.medium; },
  salFuOK(C) { return C.cool <= 0 && C.wh <= 0 && C.fuCD <= 0 && this.salLive(C) && this.salPw(C, 'fu'); },
  salSpitReady(C) {
    if (C.scd > 0 || C.brT < SPIT.gapAfterBreath || !this.salPw(C, 'spit')) return false;
    const B = C.boss && this.bx && this.bx.boss;
    return !(B && B.atk); // the boss never spits over one of its own attacks
  },
  salHeading(C) { const h = C.pts[0], q = C.pts[Math.min(C.pts.length - 1, 6)]; return Math.atan2(h.y - q.y, h.x - q.x); },
  // the nearest red flame orb in its own channel, FIRE.see m along it: {o, along (m, ccw +), d (m from the head)}
  salOrbWant(C) {
    const h = C.pts[0], hc = this.salCh(C), hr = Math.max(0.5, Math.hypot(h.x, h.y)), ha = Math.atan2(h.y, h.x);
    let best = null;
    for (const o of this.orbs) {
      if (!o.alive || o.taken || o.type !== 'fire_red' || this.chAt(Math.hypot(o.x, o.y)) !== hc) continue;
      const along = wrap(Math.atan2(o.y, o.x) - ha) * hr;
      if (Math.abs(along) < FIRE.see && (!best || Math.abs(along) < Math.abs(best.along))) best = { o, along, d: Math.hypot(o.x - h.x, o.y - h.y) };
    }
    return best;
  },
  // a melted lava hole under its front half (it is crossing a ring there)
  salLavaUnder(C) {
    for (let i = 0; i < Math.min(C.pts.length, 12); i += 3) {
      const q = C.pts[i];
      for (const ring of this.rings) {
        if (Math.abs(q.r - ring.r) > RING_TH / 2 + 0.1) continue;
        const la = mod(q.a - ring.body.getAngle(), TAU);
        for (const sg of ring.segs) if (sg.melt > 0 && ((la >= sg.a0 && la < sg.a1) || (la + TAU >= sg.a0 && la + TAU < sg.a1))) return true;
      }
    }
    return false;
  },
  salGulpStart(C, o) {
    o.alive = false; o.taken = true; this.kill.push(o.body);
    C.og = 0;
    this.salHalt(C, 'gulp', FIRE.gulp);
    this.emit('salGulp', { x: o.x, y: o.y, id: C.id, hx: C.pts[0].x, hy: C.pts[0].y });
  },
  salFireUp(C, why) {
    C.wh = C.whD = FIRE.t * (FIRE_M[this.mode] || 1);
    C.dbl = 1; C.charge = 1; C.og = 0; C.sulk = 0;
    C.next = Math.min(C.next, 2.5);
    const h = C.pts[0];
    this.emit('salFireUp', { x: h.x, y: h.y, id: C.id, why, boss: C.boss });
  },
  // white-hot: it burns down; thorns by its feet burn away
  salWhiteStep(C, dt, play) {
    if ((C.wh -= dt) <= 0) {
      C.wh = 0; C.dbl = 0; C.fuCD = Math.max(C.fuCD, FIRE.cd);
      const h = C.pts[0];
      this.emit('salFireOut', { x: h.x, y: h.y, id: C.id });
      return;
    }
    if (!play || (C.gk = (C.gk + 1) % 3) || !this.salLive(C)) return;
    const m = Math.min(C.pts.length, Math.ceil((SAL.svl * C.size) / SAL.trail) + 1);
    let n = 0;
    for (const ring of this.rings) {
      const ra = ring.body.getAngle();
      for (const th of ring.thorns) {
        if (!th.alive) continue;
        const a = ra + th.a, tx = th.tip * Math.cos(a), ty = th.tip * Math.sin(a);
        for (let i = 0; i < m; i += 4) { const q = C.pts[i]; if (Math.abs(q.x - tx) < FIRE.burnR && Math.abs(q.y - ty) < FIRE.burnR && Math.hypot(q.x - tx, q.y - ty) < FIRE.burnR) { this.removeThorn(th, 'burn'); n++; break; } }
      }
    }
    if (n) { this.chickGain = (this.chickGain || 0) + n; this.emit('salFootBurn', { x: C.pts[0].x, y: C.pts[0].y, id: C.id, n }); }
  },
  // an open way through `ring` at ring-local angle la: an open gap or a melted hole, `clear` m inside its edges
  salOpenAt(ring, la, clear) {
    for (const g of ring.gaps) if (this.snakeGap(g) && Math.abs(wrap(la - g.a)) * ring.r < g.len / 2 - clear) return true;
    for (const h of this.salHoles(ring)) if (Math.abs(wrap(la - h.a)) * ring.r < h.len / 2 - clear) return true;
    return false;
  },
  // where the straight line a -> b crosses ring circles: [{ri, u (0..1 along it), x, y}]
  salCross(ax, ay, bx, by, u0 = 0, u1 = 1) {
    const dx = bx - ax, dy = by - ay, A = dx * dx + dy * dy, Bq = 2 * (ax * dx + ay * dy), out = [];
    if (A < 1e-9) return out;
    for (const ring of this.rings) {
      const Cq = ax * ax + ay * ay - ring.r * ring.r, D = Bq * Bq - 4 * A * Cq;
      if (D < 0) continue;
      const s = Math.sqrt(D);
      for (const u of [(-Bq - s) / (2 * A), (-Bq + s) / (2 * A)]) if (u > u0 && u <= u1) out.push({ ri: ring.i, u, x: ax + dx * u, y: ay + dy * u });
    }
    return out.sort((p, q) => p.u - q.u);
  },
  // the ember's landing spot for an egg: on the floor of the egg's channel (the wall it rests nearer), at the egg's angle
  salSpitSpot(e) {
    const p = e.body.getPosition(), d = Math.hypot(p.x, p.y), n = this.rings.length, ch = clamp(this.channelOf(e), 1, n - 1);
    const fr = Math.abs(d - this.rings[ch - 1].r) < Math.abs(d - this.rings[ch].r) ? ch - 1 : ch, side = fr === ch - 1 ? 1 : -1;
    const r = this.rings[fr].r + side * (RING_TH / 2 + 0.14), a = Math.atan2(p.y, p.x);
    return { x: r * Math.cos(a), y: r * Math.sin(a), ch, fr };
  },
  // an egg to spit at: a neighbour channel, in range and in front, every ring on the way open where the line crosses it
  salSpitAt(C) {
    const h = C.pts[0], hc = this.salCh(C), hd = this.salHeading(C);
    let best = null, bd = 1e9;
    for (const e of this.aliveEggs()) {
      if (!this.salPreyOK(C, e) || e.icy > 0 || Math.abs(this.channelOf(e) - hc) !== 1) continue;
      const S = this.salSpitSpot(e), d = Math.hypot(S.x - h.x, S.y - h.y);
      if (d < SPIT.minD || d > SPIT.range || d >= bd || Math.abs(wrap(Math.atan2(S.y - h.y, S.x - h.x) - hd)) > SPIT.cone) continue;
      const X = this.salCross(h.x, h.y, S.x, S.y);
      if (!X.length || !X.every((q) => { const ring = this.rings[q.ri]; return this.salOpenAt(ring, mod(Math.atan2(q.y, q.x) - ring.body.getAngle(), TAU), SPIT.clear); })) continue;
      bd = d; best = { e, x: S.x, y: S.y };
    }
    return best;
  },
  // through the telegraph its eye stays on the egg (while that egg is still in a neighbour channel)
  salSpitAim(C) {
    const e = this.eggs.find((x) => x.id === C.sj && x.alive && !x.saved);
    if (!e || Math.abs(this.channelOf(e) - this.salCh(C)) !== 1) return;
    const S = this.salSpitSpot(e);
    C.sx = S.x; C.sy = S.y;
  },
  salSpitLaunch(C) {
    const h = C.pts[0], hd = this.salHeading(C), x0 = h.x + Math.cos(hd) * 0.18 * C.size, y0 = h.y + Math.sin(hd) * 0.18 * C.size;
    const d = Math.hypot(C.sx, C.sy), n = this.rings.length, ch = clamp(this.chAt(d), 1, n - 1);
    const fr = Math.abs(d - this.rings[ch - 1].r) < Math.abs(d - this.rings[ch].r) ? ch - 1 : ch;
    C.scd = SPIT.cd * this.salSpitM().cd * (C.boss ? (BOSS_MODE[this.mode] || BOSS_MODE.medium).every : C.spit || 1); // a level's spit: N (N > 1: a gentler level, N x the wait)
    C.next = Math.max(C.next, 2);
    this.salEmbers.push({ k: ++this.salEmN, x0, y0, x1: C.sx, y1: C.sy, u: 0, T: SPIT.fly, ch, fr, own: C.id });
    this.emit('salSpit', { x: x0, y: y0, tx: C.sx, ty: C.sy, id: C.id });
  },
  // the embers in flight: each ring they cross must be open there right then, or they splat on its wall
  salEmberStep(dt, play) {
    for (let i = this.salEmbers.length - 1; i >= 0; i--) {
      const E = this.salEmbers[i], u0 = E.u, u1 = Math.min(1, u0 + dt / E.T);
      E.u = u1;
      let hit = null;
      for (const q of this.salCross(E.x0, E.y0, E.x1, E.y1, u0, u1)) {
        const ring = this.rings[q.ri];
        if (!this.salOpenAt(ring, mod(Math.atan2(q.y, q.x) - ring.body.getAngle(), TAU), 0)) { hit = q; break; }
      }
      if (hit) { this.salEmbers.splice(i, 1); this.salSplat(E, hit, play); continue; }
      if (u1 >= 1) { this.salEmbers.splice(i, 1); this.salLand(E, play); }
    }
  },
  // burn the thorns of `ring` within `len` m of world angle a that stick out on `side` (+1 outward, -1 inward, 0 both)
  salBurnArc(ring, a, len, side) {
    const la = a - ring.body.getAngle();
    let n = 0;
    for (const th of ring.thorns) if (th.alive && Math.abs(wrap(th.a - la)) * ring.r < len && (!side || Math.sign(th.tip - th.base) === side)) { this.removeThorn(th, 'burn'); n++; }
    if (n) this.chickGain = (this.chickGain || 0) + n;
    return n;
  },
  salSplat(E, q, play) {
    const ring = this.rings[q.ri], from = Math.hypot(E.x0, E.y0) < ring.r ? -1 : 1; // the side it came from
    const burnt = play ? this.salBurnArc(ring, Math.atan2(q.y, q.x), 0.32, from) : 0;
    const C = this.sals.find((c) => c.id === E.own);
    if (C) C.miff = SPIT.miff;
    this.emit('salSpitSplat', { x: q.x, y: q.y, ring: ring.i, id: E.own, burnt });
  },
  salLand(E, play) {
    const ring = this.rings[E.fr], a = Math.atan2(E.y1, E.x1), side = E.fr === E.ch - 1 ? 1 : -1;
    const P = { k: E.k, ri: E.fr, ch: E.ch, la: mod(a - ring.body.getAngle(), TAU), half: SPIT.len / (2 * ring.r), t: SPIT.pool + SPIT.crust, hit: [], own: E.own };
    const burnt = play ? this.salBurnArc(ring, a, SPIT.len / 2 + 0.12, side) : 0;
    this.salPools.push(P);
    this.emit('salPool', { x: E.x1, y: E.y1, ring: ring.i, id: E.own, burnt });
  },
  salPoolPt(P) {
    const ring = this.rings[P.ri], a = ring.body.getAngle() + P.la, r = ring.r + (P.ri === P.ch - 1 ? 1 : -1) * (RING_TH / 2 + 0.12);
    return { x: r * Math.cos(a), y: r * Math.sin(a), a };
  },
  salPoolStep(dt, play) {
    for (let i = this.salPools.length - 1; i >= 0; i--) {
      const P = this.salPools[i];
      if ((P.t -= dt) <= 0 || !this.rings[P.ri]) { this.salPools.splice(i, 1); continue; }
      if (!play || P.t <= SPIT.crust) continue;
      const ring = this.rings[P.ri], ra = ring.body.getAngle(), c = this.salPoolPt(P);
      for (const o of this.orbs) if (o.alive && o.type === 'water' && Math.hypot(o.x - c.x, o.y - c.y) < 0.5) { P.t = SPIT.crust; this.emit('salPoolDouse', { x: c.x, y: c.y }); break; } // a water orb there puts it out
      if (P.t <= SPIT.crust) continue;
      for (const e of this.aliveEggs()) {
        if (P.hit.includes(e.id) || this.channelOf(e) !== P.ch) continue;
        const p = e.body.getPosition(), d = Math.hypot(p.x, p.y);
        if (Math.abs(d - ring.r) > RING_TH / 2 + 0.34 || Math.abs(wrap(Math.atan2(p.y, p.x) - ra - P.la)) * ring.r > P.half * ring.r + 0.12) continue;
        P.hit.push(e.id);
        if (e.water > 0) { P.t = SPIT.crust; this.emit('salPoolDouse', { x: p.x, y: p.y, egg: e }); break; }
        if (this.armored(e) || e.chick) { this.emit('salShrug', { x: p.x, y: p.y, egg: e }); continue; }
        if (this.MD.softThorns) { // Easy: never a crack: it hops off with a yelp
          const m = e.body.getMass() * SPIT.hop, nx = p.x / (d || 1), ny = p.y / (d || 1), inw = P.ri === P.ch - 1 ? 1 : -1, tg = Math.sign(wrap(Math.atan2(p.y, p.x) - ra - P.la)) || 1;
          e.body.applyLinearImpulse(Vec2(m * (nx * inw * 0.8 - ny * tg * 0.6), m * (ny * inw * 0.8 + nx * tg * 0.6)), p, true);
          this.emit('salPoolHop', { x: p.x, y: p.y, egg: e });
          continue;
        }
        this.emit('salPoolBurn', { x: p.x, y: p.y, egg: e });
        this.crack(e, 0, 'ember');
      }
    }
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
    const h = this.salHead(C), frost = C.kind === 'frost'; // water douses the fire one; fire (a flaming egg, a flame orb) melts the frost one
    let wet = null;
    for (const o of this.orbs) if (o.alive && (frost ? String(o.type).startsWith('fire') : o.type === 'water') && Math.hypot(o.x - h.x, o.y - h.y) < 0.55 * C.size) { wet = o; break; }
    if (!wet) for (const e of this.aliveEggs()) {
      if (!(frost ? e.fire > 0 : e.water > 0)) continue;
      const p = e.body.getPosition();
      if (Math.hypot(p.x - h.x, p.y - h.y) < 0.8 * C.size || C.pts.some((q, i) => i % 4 === 0 && Math.hypot(p.x - q.x, p.y - q.y) < 0.5 * C.size)) { wet = { x: p.x, y: p.y }; break; }
    }
    if (wet) this.salWet(C, wet.x, wet.y);
  },
  salQuell(C, x, y) { this.salWet(C, x, y); },
  salWet(C, x, y) {
    this.salRelease(C); C.bj = -1; C.fid = -1; C.sj = -1; C.og = 0; C.lj = -1; C.lk = 0;
    C.cool = SAL.cool; C.wetCD = SAL.cool + SAL.wetCD; C.climb = null;
    C.next = Math.max(C.next, 2);
    const doused = C.wh > 0; // FIRE: water knocks a white-hot one straight back to grey, and it sulks
    if (doused) { C.wh = 0; C.dbl = 0; C.sulk = FIRE.sulk; C.fuCD = Math.max(C.fuCD, FIRE.cd); }
    this.salHalt(C, 'hiss', SAL.hiss);
    this.emit('salCool', { x, y, hx: C.pts[0].x, hy: C.pts[0].y, id: C.id, frost: C.kind === 'frost', doused: doused ? 1 : 0 });
  },

  // ---------- hazards: gust | rock | lava | quake | bolt | ice | flash (glow chick) | dash (dash chick) | water
  // o: {x, y, dir ({x, y} or a sign along x), power}. Called from animalsHit (boss.js) and the chick powers.
  hitSalamander(C, kind, o = {}) {
    if (!C || !this.salLive(C) || C.ph === 'dive' || C.ph === 'grin' || C.ph === 'in' || this.salHidden(C) || this.state !== 'play') return;
    const p = o.power ?? 1, h = C.pts[0];
    if (C.sp === 'thornback' && (kind === 'gust' || kind === 'quake' || kind === 'water' || kind === 'rock' || kind === 'lava')) return; // L20: they grip the walls; no fire to cool
    if (C.sp === 'chameleon' && (kind === 'quake' || kind === 'water' || kind === 'rock' || kind === 'lava')) return; // L26: he grips the walls; no fire to cool or feed
    if (C.sp === 'gecko' && (kind === 'gust' || kind === 'ice' || kind === 'water' || kind === 'rock' || kind === 'lava')) return; // his own gale and icicles; no fire to cool or feed
    if (kind === 'gust') {
      const dx = typeof o.dir === 'number' ? o.dir : (o.dir && o.dir.x) || 0, dy = (o.dir && o.dir.y) || 0;
      C.shove += clamp(-Math.sin(C.a) * dx + Math.cos(C.a) * dy, -1, 1) * 0.35 * p;
      this.emit('salHit', { kind, x: h.x, y: h.y, id: C.id });
      return;
    }
    if (C.kind === 'frost' && kind === 'water') return; // water is nothing to the frost one; lava melts it
    if (C.kind === 'frost' && (kind === 'rock' || kind === 'lava')) { if (C.cool <= 0 && C.wetCD <= 0) this.salWet(C, o.x ?? h.x, o.y ?? h.y); return; }
    if (kind === 'rock' || kind === 'lava') { // immune: the lava recharges it, so its next breath comes sooner
      if (C.lavaCD > 0) return;
      C.lavaCD = 1.5; C.charge = 1;
      if (C.cool > 0) { C.cool = Math.min(C.cool, 0.5); }
      else C.next = Math.max(0.6, Math.min(C.next, C.next - 2.5));
      this.emit('salHit', { kind: 'lava', x: h.x, y: h.y, id: C.id });
      if (this.salFuOK(C, true)) this.salFireUp(C, 'lava'); // FIRE: lava fires it up
      return;
    }
    if (kind === 'quake') { this.emit('salHit', { kind, x: h.x, y: h.y, id: C.id }); return; } // it grips the walls
    if (kind === 'water') { this.salWet(C, o.x ?? h.x, o.y ?? h.y); return; }
    const T = { bolt: 2, flash: 3, dash: 2, ice: 1 }[kind];
    if (!T) return;
    if (C.ph === 'daze' && C.t > T * 0.5) return;
    this.salRelease(C);
    C.climb = null; C.bj = -1; C.fid = -1; C.lj = -1; C.lk = 0;
    C.next = Math.max(C.next, T + 1);
    if (kind === 'dash') C.shove -= C.dir * 0.35; // bonked back along the channel
    this.salHalt(C, 'daze', T);
    C.dk = kind; // why it is dazed (bolt, flash, dash, ice ...): the art zaps for a bolt
    this.emit('salHit', { kind, x: o.x ?? h.x, y: o.y ?? h.y, id: C.id });
  },
  // which salamanders a hazard reaches (any part of the body within r of x, y)
  salsNear(x, y, r) {
    return (this.sals || []).filter((C) => this.salLive(C) && !this.salHidden(C) && C.pts.some((q, i) => i % 3 === 0 && Math.hypot(q.x - x, q.y - y) < r));
  },

  // ---------- the boss: phase rhythm, staggers
  salBossSync(C) {
    const B = this.bx && this.bx.boss;
    if (!B) return;
    // a breath half a beat after each lava attack: rock, fire, rock, fire
    if (B.atk && B.atk.ph === 'act' && C.bk !== B.k) {
      C.bk = B.k; if (C.ph === 'walk') C.next = Math.min(Math.max(C.next, 0.8), this.salEvery(C) * 0.5);
      if (B.atk.name === 'magma' && this.salFuOK(C, true)) this.salFireUp(C, 'magma'); // FIRE (a fire phase): it drinks its own magma ring and goes white-hot
    }
    if (B.atk && C.ph === 'walk' && C.next < 0.8) C.next = 0.8; // never on top of a lava throw
    if (B.atk && B.atk.ph === 'warn' && /^rock/.test(B.atk.name) && C.ph === 'walk') { this.salHalt(C, 'roar', B.atk.t); this.emit('salRoar', { x: C.pts[0].x, y: C.pts[0].y, id: C.id, n: (B.atk.spots || []).length }); } // 0.8.19: he rears and roars at the volcano
    if (B.phase !== C.bph) { C.bph = B.phase; this.salDaze(C, 1.6); } // a new phase: it reels with the boss
    if (B.saved !== C.bsaved) { C.bsaved = B.saved; if (C.ph === 'warn') { C.next = 1.6; this.salSet(C, 'walk'); this.emit('salFlinch', { x: C.pts[0].x, y: C.pts[0].y }); } }
  },
  // why: 'frost' (frozen), 'bolt' (zapped), '' (a plain stun: the rooster, a phase change, a spin) - only the art cares
  salDaze(C, T, why = '') {
    if (!this.salLive(C) || C.ph === 'in') return;
    this.salRelease(C); C.climb = null; C.bj = -1; C.fid = -1; C.lj = -1; C.lk = 0; C.next = Math.max(C.next, T + 1);
    this.salHalt(C, 'daze', T);
    C.dk = why;
  },

  // ---------- snake face-off
  salRivalCheck(C) {
    const hc = this.salCh(C), h = C.pts[0];
    for (const S of this.snakes || []) {
      if (S.gone || !S.inside || S.carried || S.stun > 0 || S.back > 0 || S.knock > 0 || S.rival > 0 || S.flee >= 0 || !S.pts.length) continue;
      if (this.chAt(S.rad) !== this.chAt(C.rad) || hc !== this.chAt(S.rad)) continue;
      const sh = S.pts[0];
      const k = this.salRank(C), near = Math.hypot(sh.x - h.x, sh.y - h.y) < SAL.rivalR * k || // (the meeting range keeps its old size)
        C.pts.some((q, i) => i % 4 === 0 && Math.hypot(q.x - sh.x, q.y - sh.y) < 0.7 * k) ||
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
    if ((el < 1.0 && Math.hypot(sh.x - h.x, sh.y - h.y) < SAL.rivalGap * this.salRank(C)) || ((C.rv & 4) && !planted)) { C.rv |= 4; this.salBackWalk(C, SAL.backV * C.size * dt); }
    else C.rv &= ~4;
    if (el >= 1.0 && !(C.rv & 1)) { C.rv |= 1; S.mouthOpen = 1; this.emit('venomSpit', { x: sh.x, y: sh.y, tx: h.x, ty: h.y, id: S.id, rival: 1 }); }
    if (el >= 1.5 && !(C.rv & 2)) { C.rv |= 2; this.emit('salPuff', { x: h.x, y: h.y, tx: sh.x, ty: sh.y, id: C.id }); }
    if ((C.t -= dt) <= 0) {
      this.salRelease(C);
      C.rivalCD = SAL.rivalCD; C.back = SAL.rivalBack * this.salRank(C);
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

  // ---------- the frost gecko (C.sp === 'gecko')
  geckoOf() { return (this.sals || []).find((C) => C.sp === 'gecko') || null; },
  // he lays out outside the outer ring, head at the gap nearest the top, and crawls in through it
  geckoEnter(C) {
    const n = this.rings.length, ring = this.rings[n - 1], ra = ring.body.getAngle();
    let gi = -1, bd = 1e9;
    ring.gaps.forEach((g, i) => { const d = Math.abs(wrap(ra + g.a - Math.PI / 2)); if (this.snakeGap(g) && g.len >= 0.6 && d < bd) { bd = d; gi = i; } });
    if (gi < 0) { C.t = 0.5; return; } // every way in is shut: he waits outside
    const a = ra + ring.gaps[gi].a, r0 = ring.r + RING_TH / 2 + 0.2, m = Math.ceil(this.salBodyLen(C) / SAL.trail) + 2;
    C.ent = { gi, la: ring.gaps[gi].a };
    C.rad = r0; C.a = a; C.pts = [];
    for (let i = 0; i < m; i++) C.pts.push(this.salPt({}, a, r0 + i * SAL.trail));
    C.ph = 'in'; C.t = C.dur = 0; C.car = -1;
    this.salCarry(C);
    this.emit('geckoIn', { x: C.pts[0].x, y: C.pts[0].y, id: C.id });
  },
  geckoOne(C, dt, play) {
    const B = this.bx && this.bx.boss;
    if (play && C.ph !== 'in') this.geckoIce(C);
    switch (C.ph) {
      case 'in': { // down through the gap on its centre line (the ring carries him; a shut gap stops him)
        const n = this.rings.length, ring = this.rings[n - 1], g = ring.gaps[C.ent.gi], goal = this.salMid(n - 1);
        if (!play || (g && !this.snakeGap(g))) break;
        const d = Math.min(GECKO.speed * dt, C.rad - goal);
        C.a = wrap(ring.body.getAngle() + C.ent.la); C.rad -= d; C.odo += d; C.dur += dt;
        this.geckoTrail(C);
        if (C.rad - goal <= 1e-6) { C.dir = this.geckoDir(C); C.climbCD = 0.5; this.salSet(C, 'walk'); this.emit('geckoInside', { x: C.pts[0].x, y: C.pts[0].y, id: C.id }); }
        break;
      }
      case 'walk': {
        if (play && B && B.atk) { this.salHalt(C, 'atk', 0); break; } // an attack: he stops, all four feet down, and does it
        if (play && C.bored <= 0 && !C.climb) {
          const e = this.geckoPrey(C);
          if (e) { C.lk = e.id; C.lkd = 0; this.salHalt(C, 'lick', GECKO.lick); break; }
          if (this.salChase(C)) break; // the brain: a target behind him turns him round
        }
        this.salMove(C, GECKO.speed * (C.bored > 0 ? 1 : this.salPace(C)) * dt);
        break;
      }
      case 'brake': {
        const r = (C.stopAt - C.odo) * C.mv, d = Math.min(Math.max(0, r), SAL.brakeV * dt);
        if (C.mv > 0) this.salMove(C, d, true); else this.salBackWalk(C, d);
        if (r - d <= 1e-6) { C.odo = C.stopAt; this.salSet(C, C.pend, C.pendT); }
        break;
      }
      case 'atk': if (!play || !B || !B.atk) this.salSet(C, 'walk'); break;
      case 'turn': this.salTurnStep(C, dt); break;
      case 'lick':
        if (!C.lkd && C.dur - C.t >= GECKO.lickAt) { C.lkd = 1; this.geckoLick(C); }
        if ((C.t -= dt) <= 0) this.geckoAfterLick(C);
        break;
      // 0.8.19 freeze and nip: the egg he froze, then (the director allowing) a rear-up and a nip that cracks it
      case 'nipWait': // waiting his turn by the frozen egg: sniffing, pacing on the spot
        if ((C.t -= dt) <= 0) this.geckoAfterLick(C);
        break;
      case 'nipWarn': {
        const e = this.eggs.find((x) => x.id === C.lk && x.alive && !x.saved);
        if (!e || !(e.icy > 0)) { this.emit('geckoNipMiss', { x: C.pts[0].x, y: C.pts[0].y, id: C.id, why: 'free' }); C.bored = 0; C.tcd = 0; this.salSet(C, 'walk'); break; } // shaken free: after it at once
        if ((C.t -= dt) <= 0) this.geckoNip(C, e);
        break;
      }
      case 'nip': if ((C.t -= dt) <= 0) { C.bored = this.salDyn(C).rest; this.salSet(C, 'walk'); } break;
      case 'daze': if ((C.t -= dt) <= 0) this.salSet(C, 'walk'); break;
      case 'retreat': { // scared off (pepper, a shock): he backs away along his own trail
        const d = Math.min(C.back, SAL.backV * dt);
        this.salBackWalk(C, d);
        if ((C.back -= d) <= 1e-6) { C.back = 0; this.salSet(C, 'walk'); }
        break;
      }
      case 'grin': case 'beat': break;
      default: this.salSet(C, 'walk');
    }
  },
  geckoTrail(C) {
    const T = C.pts, x = C.rad * Math.cos(C.a), y = C.rad * Math.sin(C.a);
    if (T.length < 2 || Math.hypot(T[1].x - x, T[1].y - y) > SAL.trail) T.unshift(this.salPt({}, C.a, C.rad));
    else this.salPt(T[0], C.a, C.rad);
    const m = Math.ceil(this.salBodyLen(C) / SAL.trail) + 2;
    if (T.length > m) T.length = m;
  },
  // which way round his channel: toward the nearest egg in it, else toward the leading egg
  geckoDir(C) {
    const hc = this.salCh(C), n = this.rings.length;
    let best = null, bd = 1e9;
    for (const e of this.aliveEggs()) {
      const c = this.channelOf(e);
      if (c >= n || e.icy > 0) continue;
      const p = e.body.getPosition(), da = wrap(Math.atan2(p.y, p.x) - C.a), s = (c === hc ? 0 : 100) - c + Math.abs(da);
      if (s < bd) { bd = s; best = da; }
    }
    return best == null ? C.dir : best >= 0 ? 1 : -1;
  },
  // an egg at his snout he can lick
  geckoPrey(C) {
    const h = C.pts[0];
    for (const e of this.aliveEggs()) {
      if (e.icy > 0 || e.hold || e.honey > 0 || e.thf || e.hc || e.octo) continue;
      const p = e.body.getPosition();
      if (Math.hypot(p.x - h.x, p.y - h.y) < GECKO.reach) return e;
    }
    return null;
  },
  geckoLick(C) {
    const e = this.eggs.find((x) => x.id === C.lk && x.alive && !x.saved);
    const h = C.pts[0];
    if (!e) return;
    const p = e.body.getPosition();
    if (Math.hypot(p.x - h.x, p.y - h.y) > GECKO.reach + 0.4) { this.emit('geckoMiss', { x: h.x, y: h.y, id: C.id }); return; }
    if (this.armored(e) || e.chick || e.fire > 0) { this.emit('geckoShrug', { x: p.x, y: p.y, egg: e, id: C.id }); return; } // stone, rock skin, the feather; a flaming egg
    // 0.8.19: the lick only freezes the egg onto the nearer wall of its channel (it rides that ring, nothing else moves it);
    // the crack comes from the nip that follows, and the player can shake the egg free first (salIceStep)
    if (!this.iceEgg(e, this.salDyn(C).tell + 2)) return;
    e.iceBy = C.id;
    this.emit('geckoLick', { x: p.x, y: p.y, egg: e, id: C.id, hx: h.x, hy: h.y, bite: 0 });
  },
  geckoAfterLick(C) {
    const e = this.eggs.find((x) => x.id === C.lk && x.alive && !x.saved);
    if (e && e.icy > 0 && e.iceBy === C.id) {
      if (this.salMay(C, 'nip')) { this.salSet(C, 'nipWarn', this.salDyn(C).tell); this.emit('geckoNipWarn', { x: e.body.getPosition().x, y: e.body.getPosition().y, hx: C.pts[0].x, hy: C.pts[0].y, id: C.id, egg: e, t: C.dur }); }
      else this.salSet(C, 'nipWait', STALK.t);
      return;
    }
    C.bored = this.salDyn(C).rest; C.climbCD = Math.max(C.climbCD, 1); this.salSet(C, 'walk');
  },
  geckoNip(C, e) {
    const p = e.body.getPosition(), h = C.pts[0];
    if (Math.hypot(p.x - h.x, p.y - h.y) > GECKO.reach + 0.55) { this.emit('geckoNipMiss', { x: h.x, y: h.y, id: C.id, why: 'far' }); this.salSet(C, 'nip', 0.4); return; }
    e.icy = 0; e.hold = null; e.iceN = 0; e.iceA = 0; e.iceD = 0; // the ice shatters with the nip
    const last = this.MD.softThorns && e.cracks >= 2; // Easy: never the breaking crack
    if (!last) { C.tokT = 1; this.crack(e, 0, 'frostbite'); }
    this.salSet(C, 'nip', 0.4);
    this.emit('geckoNip', { x: p.x, y: p.y, hx: h.x, hy: h.y, egg: e, id: C.id, bite: last ? 0 : 1 });
  },
  // 0.8.19 a frozen egg (the gecko's lick, the frost bite): two swings of its ring, the second the other way, crack the ice
  // and then burst it (SHAKE); fire (a flaming egg, a red-hot section under it) thaws it at once
  salIceStep(dt) {
    for (const e of this.eggs) {
      if (!e.alive || e.saved || !(e.icy > 0) || !e.hold) continue;
      const ring = this.rings[e.hold.ri], da = ring.body.getAngularVelocity() * dt, p = e.body.getPosition();
      let hot = e.fire > 0;
      if (!hot) for (const H of this.salHot) { const R = this.rings[H.ri], sg = R.segs[H.si]; if (sg.hot > 0 && Math.abs(Math.hypot(p.x, p.y) - R.r) < RING_TH / 2 + 0.45) { const la = mod(Math.atan2(p.y, p.x) - R.body.getAngle(), TAU); if (la > sg.a0 - 0.1 && la < sg.a1 + 0.1) { hot = true; break; } } }
      if (hot) { e.icy = 0; e.hold = null; e.iceN = 0; e.iceA = 0; e.iceD = 0; this.emit('eggIceBurst', { egg: e, x: p.x, y: p.y, why: 'fire' }); continue; }
      if (Math.abs(da) < 1e-9) continue;
      if (Math.sign(da) !== Math.sign(e.iceA)) e.iceA = 0; // a new swing
      e.iceA += da;
      if (Math.abs(e.iceA) >= deg(SHAKE.deg) && Math.sign(e.iceA) !== e.iceD) {
        e.iceD = Math.sign(e.iceA); e.iceN = (e.iceN || 0) + 1;
        if (e.iceN >= 2) { e.icy = 0; e.hold = null; e.iceN = 0; e.iceA = 0; e.iceD = 0; this.emit('eggIceBurst', { egg: e, x: p.x, y: p.y, why: 'shake' }); }
        else this.emit('eggIceCrack', { egg: e, x: p.x, y: p.y, n: e.iceN });
      }
    }
  },
  // icy feet: the floor under him (the wall eggs rest on: the inner one on the upper arc, the outer one below) ices over
  geckoIce(C) {
    if ((C.ik = (C.ik || 0) + 1) % 4) return;
    const n = this.rings.length, m = Math.min(C.pts.length, Math.ceil((SAL.svl * C.size) / SAL.trail));
    for (let i = 0; i < m; i += 4) {
      const q = C.pts[i], c = this.chAt(q.r);
      if (c < 1 || c > n - 1) continue;
      const ring = this.rings[Math.sin(q.a) > 0 ? c - 1 : c], la = mod(q.a - ring.body.getAngle(), TAU);
      for (const sg of ring.segs) if (sg.alive && ((la >= sg.a0 && la < sg.a1) || (la + TAU >= sg.a0 && la + TAU < sg.a1))) { sg.ice = Math.max(sg.ice || 0, GECKO.icy); break; }
    }
  },
  // the boss clock waits while he can't act: not in yet, dazed, frozen, stunned, licking (sim/boss.js)
  geckoHold() {
    const C = this.geckoOf();
    if (!C) return false;
    if (!this.salLive(C)) return true;
    return C.ph === 'in' || C.ph === 'daze' || C.ph === 'lick' || C.ph === 'nipWarn' || C.ph === 'nip' || C.ph === 'retreat' || (C.ph === 'brake' && C.pend !== 'atk');
  },
  // the boss's point (popups, hits) is his head
  geckoBossPose(B) {
    const C = this.geckoOf();
    if (!C || !this.salLive(C)) return;
    const h = C.pts[0];
    B.x = h.x; B.y = h.y; B.face = C.dir;
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
    for (const C of this.sals) { // the bite: coiling at this egg, or its snout close by
      if (C.sp !== 'sal' || !this.salLive(C) || C.cool > 0 || C.ph === 'daze' || C.ph === 'chew' || C.ph === 'face') continue;
      if ((C.ph === 'coil' || (C.ph === 'brake' && C.pend === 'coil')) && C.bj === e.id) { v = 1; break; }
      const h = C.pts[0], d = Math.hypot(p.x - h.x, p.y - h.y);
      if (C.bcd <= 0 && d < 1.5) v = Math.max(v, d < 0.9 ? 0.9 : 0.6);
    }
    for (const C of this.sals) {
      if (C.ph !== 'warn' && !(C.ph === 'brake' && C.pend === 'warn')) continue;
      const T = this.salTarget(C);
      if (Math.hypot(p.x - T.x, p.y - T.y) < this.salHotLen(C) / 2 + 0.45) v = Math.max(v, 0.8);
    }
    // 0.8.19: the tongue locked on or reeling this egg; an exit pool bubbling by it; a thorn-back curling or rolling at it
    for (const C of this.sals) {
      const ph = C.ph === 'brake' ? C.pend : C.ph;
      if ((ph === 'lash' || ph === 'fling' || ph === 'reel') && C.lj === e.id) v = Math.max(v, ph === 'reel' ? 1 : 0.8);
      if ((ph === 'bubble' || ph === 'under' || ph === 'rise') && C.dvC === this.channelOf(e)) { const P = this.salDivePt(C); if (Math.hypot(p.x - P.x, p.y - P.y) < DIVE.off + 0.6) v = Math.max(v, 0.6); }
      if ((ph === 'curl' || ph === 'roll') && C.lk === e.id) v = Math.max(v, 0.8);
      if (ph === 'nipWarn' && C.lk === e.id) v = Math.max(v, 0.9);
    }
    // SPIT: a spit wound up at this egg, an ember coming down by it, a burning pool it is on or rolling into
    for (const C of this.sals) if ((C.ph === 'spitWarn' || (C.ph === 'brake' && C.pend === 'spitWarn')) && C.sj === e.id) v = Math.max(v, 0.7);
    for (const E of this.salEmbers) if (Math.hypot(p.x - E.x1, p.y - E.y1) < SPIT.len / 2 + 0.5) v = Math.max(v, 0.85);
    for (const P of this.salPools) {
      if (P.t <= SPIT.crust + 0.2 || P.hit.includes(e.id) || this.channelOf(e) !== P.ch) continue;
      const c = this.salPoolPt(P);
      if (Math.hypot(p.x - c.x, p.y - c.y) < SPIT.len / 2 + 0.45) { v = 1; break; }
    }
    return v;
  },

  // ---------- state
  salState() {
    return {
      n: this.salBurnN,
      sals: (this.sals || []).map((C) => ({ ...C, pts: C.pts.map((q) => ({ ...q })), climb: C.climb ? { ...C.climb } : null })),
      hot: this.salHot.map((H) => { const sg = this.rings[H.ri].segs[H.si]; return [H.ri, H.si, sg.hot, sg.hotK]; }),
      em: (this.salEmbers || []).map((E) => ({ ...E })), pools: (this.salPools || []).map((P) => ({ ...P, hit: P.hit.slice() })), emN: this.salEmN || 0, // 0.8.18 SPIT
    };
  },
  salLoad(S) {
    if (!S) return;
    this.salBurnN = S.n || 0;
    this.sals = S.sals.map((C) => ({ ...C, pts: C.pts.map((q) => ({ ...q })), climb: C.climb ? { ...C.climb } : null }));
    this.salHot = [];
    this.salEmbers = (S.em || []).map((E) => ({ ...E })); this.salPools = (S.pools || []).map((P) => ({ ...P, hit: P.hit.slice() })); this.salEmN = S.emN || 0;
    for (const [ri, si, hot, hotK] of S.hot || []) { const sg = this.rings[ri].segs[si]; sg.hot = hot; sg.hotK = hotK; this.salHot.push({ ri, si }); }
  },
};
Object.assign(salMethods, thornMethods, chamMethods);
