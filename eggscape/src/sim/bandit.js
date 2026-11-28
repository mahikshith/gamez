// BANDIT THE RACCOON (0.8.17, world 1 boss, L6 "Midnight Raid"; 0.8.18: he gets ON the rings). Mixed into Sim (sim.js:
// Object.assign(Sim.prototype, banditMethods)), so `this` is the Sim. All state is plain data in this.band (and egg.hc:
// 2 = in his paw, 3 = in his sack, the same marks the King Crab uses), copied by bandState() / restored by bandLoad(), so
// rewind, the planner and the hint stay exact. No randomness at all.
//
// level.raccoon = { delay, hp (hurts, 3) }
// level.bossFight = { kind: 'raccoon', phases: [{ attacks: [] }] } gives him the boss bar, the rooster's stun and the
// Chick Strike target (sim/boss.js B: B.dizzy, B.stk, B.flinch are read here; bandBossPose puts B on him).
//
// The owner (0.8.18): "the raccoon enters from the side ... uses its hands to get on top of a ring, or sits at a certain
// portion of a ring by jumping, and slowly turns the rings with its hands or with its body, and at the same time tries to
// steal the eggs". Eggs lie at the bottom of their channel, so he sits where they are: ON a ring's floor (its inner face)
// low on his side of the vault, about BAND.perchA from the bottom, facing down the slope.
//   ENTER: he tiptoes in on the yard from the left, looks up and crouches (CROUCH, the telegraph), leaps and hauls himself
//     over the outer ring's rim onto its floor (CLIMB) and SITS there.
//   CRANK: after a sit he spits in his paws (SPIT, the telegraph: the ring shimmers with an arrow his way) and walks the
//     floor hand over hand: that TURNS HIS RING slowly (BAND.crank deg/s) so its floor drags the eggs on it up the slope
//     toward him (a slowly turning floor carries an egg some 20 deg up its side). He keeps his spot; the player's own
//     turning of that ring still works and adds to his. His turn goes through ring.omega / ring.target (bandRings, called
//     from sim.step like cocoRings), so collisions and the planner see a ring like any other.
//   REACH and GRAB: an egg on his floor within BAND.reachR: he winds up and stretches for it (REACH, the telegraph), grabs it
//     (hc 2), hugs it and stuffs it in his sack (hc 3). A stone egg is too heavy (STRAIN). A burning egg burns his paw.
//   THE COUNTER (one gesture): turn HIS ring briskly AGAINST his crank (BAND.shake deg within about BAND.shakeTau s) and he
//     is SHAKEN: he wobbles and drops what he holds back on the floor, unharmed. Done while he spits, cranks, reaches,
//     grabs, strains, reels or is frozen it is a real HURT. Three hurts (hp): he loses his grip, FALLS off onto the yard into
//     his own sack and the sack spills every egg back into the outer channel (DEFEATED, for the rest of the level). The
//     glow flash or lightning on him, a burning egg or a pecking chick by him hurt him too; the rooster, a quake, a rock or
//     a Chick Strike make him reel (STUN), the frost freezes him.
//   HOP: after each hurt he hops to a new perch: the floor of the next ring inward (r >= BAND.minR, never the nest ring)
//     on the OTHER side of the bottom, so the fight moves into the vault and he cranks the other way.
//   WHISTLE: once, after the second hurt, two fingers in his mouth: the level's waiting weasel (level.weasel with a long
//     delay) comes out for a short hunt (BAND.hunt s), then is sent home to its den for good.
//   THE STAND-OFF (0.8.18, the owner: "a real little scene, not a swap"): when the whistled weasel's hunt is over it does
//     not slink home at once: it comes along its run to below his perch for its share (COME), they FREEZE and look at
//     each other, a beat, eyes narrow (STARE, a leaf drifts between them), they CIRCLE, then a comic dust-cloud SCUFFLE
//     (DUEL.fight s) in which neither bothers an egg. The OUTCOME is the state, not a dice roll: his sack empty, he wins:
//     a bonk with his sack, the weasel slinks home dizzy with a flat ear for good, he dusts his paws (DUST). An egg in his
//     sack: the weasel grabs the sack, it RIPS, every egg in it rolls free back into the vault, the weasel bolts home and
//     he stares at the rip (HUH). Times in DUEL (like RIVAL_T, sim/salamander.js); events bandDuel { ph }, bandDuelWin,
//     bandDuelRip { n }. A shake, a stun or the Scarecrow do not break into it; a weasel knocked out of it ends it.
//   CATCH: while he is still on the yard, an egg falling out of the vault on his side he scurries under and catches in his
//     sack: lost to the player until he is beaten, but never broken.
//   Never unwinnable: he cranks every cycle (BAND.tease s of sitting when there is nothing to take), so there is always a
//     ring to shake; every bagged egg comes back when he falls; the target saved and only sack eggs left ends the level
//     as a win (sim.finish). Gentle (L6 is the sixth level of a casual game): long telegraphs, a slow crank, a wide counter.
// Teaching (a later slow-motion lesson): events bandSpit / bandCrank { ring, dir } (dir: +1 counter-clockwise, -1
// clockwise, world), bandShake { ring, dir, hurt } (the counter was done), bandHurt; and bandLesson() for the live state.
import { RING_TH, wrap, clamp } from './geom.js';
import { dynOf, tellS } from '../data/dynamism.js';
const HUNT_SPEED = 2.0; // m/s the weasel scurrying for its share (sim/thieves.js HUNT.speed is its prowl)

const m3 = (easy, medium, hard) => ({ easy, medium, hard });
const D2R = Math.PI / 180;
const ss = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
export const BAND = {
  hp: 3,
  // 0.8.19: every wait, warning and speed below that is his TEMPER is a Medium number scaled by data/dynamism.js (DYN.raccoon
  // x DYN_MODE: bandRest / bandTell / bandFast / bandQuick); the m3 tables left are his body and the player's counter
  sneak: 0.95, // m/s along the yard (x tempo; 0.8.19 feel: he trots straight for the vault, seen heading for the eggs at once)
  crouch: 1.2, // s he looks up and crouches before the leap (the telegraph; x tell)
  climb: 1.7, // s the leap and the haul over the rim (/ tempo)
  perchA: 32, // deg from the bottom of a ring's floor he sits at (his side)
  lowA: 13, // deg 0.8.19: his POUNCE perch, low by the eggs at the bottom (his second way to an egg: see bandChase)
  minR: 2.5, // m: he perches only on rings this big (never the nest ring)
  // 0.8.19 feel (the owner: "the raccoon takes far too long to snatch an egg"): THE PRY. Every egg lies inside rings he
  // may not sit on (an idle player's eggs in the hub): he hops in to the floor just outside them (a ring of at least
  // pryR m) and cranks the ring that HOLDS them with both paws (pry deg/s x tempo, the short way to bring its nearest gap
  // to the bottom) so they drop out onto his floor. The counter is the same gesture: turn that ring against him.
  pryR: 1.9, pry: m3(36, 44, 50), pryT: 12,
  pryDry: 1.6, // s a crank bout for nothing is this short when every egg is out of his reach (the pry is next)
  pryCalm: 3, // s after a pry the eggs he tipped out tumble by him (no bump)
  pryAfter: m3(15, 12, 9), // s after he bags an egg before he pries again (pacing: an idle player is not stripped bare at once)
  sit: 2.1, // s sitting after a grab or a shake before the next crank (x rest)
  tease: 1.9, // s sitting with nothing to take before he cranks again (there is always a ring to shake; x rest)
  spit: 1.3, // s spitting in his paws (the telegraph; x tell)
  brace: 0.35, // 0.8.19: his ring turned against him this share of a shake: he notes it and changes plan (B.push)
  notice: 0.6, // s an egg must lie in his reach while he sits or spits before he goes for it (x snatch)
  eye: 1.1, // s 0.8.19 the pursuit's telegraph: he rises, leans and locks eyes on the ring he is going to (x tell)
  crank: m3(4, 5, 6), // deg/s he turns his ring (x tempo)
  crankT: m3(6, 7, 8), // s a crank bout lasts at most
  crankIn: 0.5, // s his crank eases in
  dryT: 2.6, // s 0.8.19: a crank bout on a floor with no egg on it ends this soon (then he may go after the eggs)
  reachR: m3(1.15, 1.25, 1.35), // m: an egg's centre this close to his reach point (above his feet) is his to take
  reach: 1.3, // s the wind-up and the stretch (the telegraph) before his fingers close (x tell)
  grab: 1.3, // s the yank home and the hug, then into the sack
  strain: 1.1, // s tugging at a stone egg before he gives up
  shake: m3(4, 5, 6), // deg of his ring turned against him (leaky sum) that shakes him
  shakeTau: 0.45, // s the leak of that sum (a slow turn never adds up)
  wobble: 0.9, // s shaken, no harm
  shaken: 1.25, // s shaken by a hurt (then he hops or falls)
  hop: 1.25, // s the hop to the next perch (/ tempo)
  fall: 1.5, // s the fall to the yard
  dizzy: 1.3, whistle: 1.7, call: 0.55, // s; the weasel is called this far into the whistle
  hunt: m3(8, 10, 12), // s the weasel he whistles up hunts before it is sent home
  dash: m3(2.4, 2.8, 3.1), // m/s he scurries on the yard to catch an egg falling his side
  catchR: 0.55, catchH: 0.8, // m: he catches an egg this close to his sack's mouth (this high over the yard)
  stuff: 0.65, laugh: 1.0, // s (on the yard)
  spillT: 0.75, // s an egg flies from the burst sack back into the vault
  knockV: 1.2, // m/s an egg must hit him with to hurt
  hitCD: 0.8,
  sitH: 1.25, // m: his head over his perch, sitting (render/raccoon.js at banditplay BANDIT_SCALE)
  tall: 1.22, // m on the yard
  room: 0.55, // m he keeps from the basket's left rim
};
const PERCH = new Set(['sit', 'spit', 'eye', 'crank', 'reach', 'grab', 'strain', 'shaken', 'whistle', 'perchStun', 'cower', 'duel', 'dust', 'huh']);
// the stand-off's clock (s): COME (at most; the weasel runs along its run to below his perch), FREEZE, STARE, CIRCLE,
// SCUFFLE (the dust cloud), then his DUST (he won) or HUH (the sack ripped)
// 0.8.19 (the owner: "the face-off ... is happening at two different levels [rings]"): the scene itself (FREEZE on) only
// ever plays on ONE ring with the two of them close (meet m apart along it). Rings apart, the weasel runs along its ring
// toward him while he hops ring by ring to the weasel's (bandMeet); a meeting that cannot happen in `meetT` s is off.
export const DUEL = { meet: 2.2, meetT: 9.0, come: 7.0, near: 0.1, gap: 1.6, sidle: 0.22, freeze: 0.6, stare: 1.3, circle: 1.1, fight: 4.0, dust: 1.6, huh: 1.8, wait: 4.0 };
const DUEL_PH = ['freeze', 'stare', 'circle', 'fight'];
const HURTABLE = new Set(['spit', 'crank', 'reach', 'grab', 'strain', 'perchStun']); // a shake now is a real hurt
const CATCH = new Set(['idle', 'sneak', 'crouch']); // on the yard he can run to catch a falling egg

export const banditMethods = {
  bandInit(L) {
    this.band = null;
    const R = L.raccoon;
    if (!R || this.rings.length < 2 || (this.gy || 1) < 0) return;
    const g = this.bandGeo(), hp = R.hp || BAND.hp;
    this.band = {
      ph: 'idle', t: R.delay ?? 3, dur: 1, x: g.x0 - 0.7, face: 1, goal: g.x0, odo: 0, ri: -1, pa: 0, side: -1, dir: -1, n: 0, from: null,
      fl: 0, cr: 0, ct: 0, tgt: 0, eid: 0, px: 0, py: 0, sack: [], hits: 0, hp, hurt: 0, whistled: 0, wz: 0, wid: -1,
      fz: 0, hitCD: 0, why: '', spill: [], done: 0, end: '', held: 0, t0: 0, sx: null, sy: null, duel: null, dueled: 0, dw: 0, rip: 0,
      see: 0, go: null, dry: 0, miss: 0, push: 0, low: 0, pry: 0, // 0.8.19: the notice clock, the pursuit's goal { ri, side, low }, crank
      // bouts with no egg on his floor (dry) / with eggs that never came (miss), the player fought his ring (push), the pounce perch
    };
  },
  bandM(o) { return o[this.mode] ?? o.medium; },
  // 0.8.19 his temper (data/dynamism.js): rests, telegraphs (never under TELL_MIN), speeds, move times, the snatch
  bandD() { return dynOf(this, 'raccoon'); },
  // (and the menace engine's heat, sim/menace.js: slower in the opening, keener in the finale; never the telegraphs)
  bandRest(v) { return (v * this.bandD().rest) / this.menaceHeat(); },
  bandTell(v) { return tellS(v, this.bandD().tell) * this.menaceTell(); },
  bandFast(v) { return v * this.bandD().tempo * this.menaceHeat(); },
  bandQuick(v) { return v / (this.bandD().tempo * this.menaceHeat()); },
  bandBoss() { return !!(this.level.bossFight && this.level.bossFight.kind === 'raccoon'); },
  // deg/s he turns his ring: half the tempo's way (a floor turned much faster would carry the eggs up past him)
  bandCrankW() { return this.bandM(BAND.crank) * (1 + (this.bandD().tempo - 1) / 2); },
  // the yard he walks: from out at the left to the basket's left rim (minus his room)
  bandGeo() {
    const R = this.outerR, nl = this.nestX0 - (this.nestAmp || 0) - this.nestW / 2;
    const x1 = Math.min(nl - BAND.room, -R * 0.5), x0 = Math.min(x1 - 0.4, -R * 0.88);
    return { x0, x1, home: (x0 + x1) / 2, gy: this.groundY };
  },
  bandOuter() { return this.rings[this.rings.length - 1]; },
  bandEggR() { const r = this.bandOuter(); return r.r - RING_TH / 2 - 0.3; },
  bandSet(B, ph, t = 0) { B.ph = ph; B.t = B.dur = t; },
  bandPerched(B) { return PERCH.has(B.ph); },
  // ---------- the perch: on ring ri's floor (inner face) at world angle pa, his side -1 (left) / +1 (right)
  bandFloor(ri) { return this.rings[ri].r - RING_TH / 2; },
  bandPt(ri, pa, h = 0) { const r = this.bandFloor(ri) - h; return { x: r * Math.cos(pa), y: r * Math.sin(pa) }; },
  bandPerchPt(B) { return this.bandPt(B.ri, B.pa); },
  bandFwd(B) { return { x: B.side * Math.sin(B.pa), y: -B.side * Math.cos(B.pa) }; }, // along his floor, down toward the bottom
  bandBody(B, up, fw = 0) { const P = this.bandPt(B.ri, B.pa, up), F = this.bandFwd(B); return { x: P.x + F.x * fw, y: P.y + F.y * fw }; },
  bandReachPt(B) { return this.bandBody(B, 0.3, 0.2); },
  bandHead(B) {
    if (this.bandPerched(B)) return this.bandBody(B, BAND.sitH, 0.1);
    if (B.ph === 'climb' || B.ph === 'fall') { const P = B.ph === 'climb' ? this.bandBody(B, BAND.sitH, 0.1) : { x: B.x, y: this.groundY + BAND.tall * 0.8 }; return P; }
    return { x: B.x, y: this.groundY + BAND.tall * 0.8 };
  },
  // the rings he may sit on: inner face, not the nest ring, big enough for him; the first is the outer ring
  bandRingsOk() { const out = []; for (let i = this.rings.length - 1; i >= 1; i--) if (this.rings[i].r >= BAND.minR && !this.rings[i].motor && !this.rings[i].gear) out.push(i); return out.length ? out : [this.rings.length - 1]; },
  // his perch on ring ri on side s: BAND.perchA up from the bottom, nudged onto solid floor if a gap is there now
  bandPerchA(ri, s, A = BAND.perchA) {
    const ring = this.rings[ri], ra = ring.body.getAngle(), r = ring.r;
    const solid = (a) => !ring.gaps.some((g) => g.o >= 0.5 && Math.abs(wrap(ra + g.a - a)) * r < g.len / 2 + 0.35);
    for (let k = 0; k <= 8; k++) for (const sg of k ? [1, -1] : [1]) { const a = (-90 + s * (A + sg * k * 3)) * D2R; if (solid(a)) return a; }
    return (-90 + s * A) * D2R;
  },
  // (0.8.19 low: his pounce perch, BAND.lowA from the bottom, right by the eggs resting there)
  bandSit(B, ri, s, low = 0, pry = 0) { B.ri = ri; B.side = s; B.dir = s; B.low = low ? 1 : 0; B.pry = pry ? 1 : 0; B.pa = this.bandPerchA(ri, s, low ? BAND.lowA : BAND.perchA); B.face = -s; B.fl = 0; B.n++; B.push = 0; },
  // ---------- the eggs he can take: on his floor, in reach, not burning (a burning one hurts him), not a chick
  bandFit(e) { return this.reefFit(e) && !(e.fire > 0) && this.channelOf(e) === this.band.ri; },
  bandInReach(B, e, k = 1) { const P = this.bandReachPt(B), p = e.body.getPosition(); return Math.hypot(p.x - P.x, p.y - P.y) <= this.bandM(BAND.reachR) * k; },
  bandPick(B) {
    let best = null, bd = 1e9;
    const P = this.bandReachPt(B);
    for (const e of this.aliveEggs()) {
      if (!this.bandFit(e) || !this.bandInReach(B, e)) continue;
      const p = e.body.getPosition(), d = Math.hypot(p.x - P.x, p.y - P.y);
      if (d < bd - 1e-9) { bd = d; best = e; }
    }
    return best;
  },
  bandHasEggs(B) { return this.aliveEggs().some((e) => this.reefFit(e) && this.channelOf(e) === B.ri); },
  // 0.8.19 the ring he turns: his own floor, or (the pry) the ring just inside it that holds the eggs
  bandCri(B) { return B.pry ? B.ri - 1 : B.ri; },
  bandPryEggs(B) { return this.aliveEggs().some((e) => this.reefFit(e) && !e.hc && this.channelOf(e) === B.ri - 1); },
  // the way to turn the pried ring so its nearest open gap comes to the bottom (+1 counter-clockwise)
  bandPryDir(B) {
    const ring = this.rings[B.ri - 1], ra = ring.body.getAngle();
    let best = null;
    for (const g of ring.gaps) { if (!(g.o >= 0.5)) continue; const d = wrap(-Math.PI / 2 - (ra + g.a)); if (!best || Math.abs(d) < Math.abs(best)) best = d; }
    return best == null || Math.abs(best) < 1e-6 ? B.side : best > 0 ? 1 : -1;
  },

  // ---------- every sim step, before the world steps (sim.js step): his crank and the counter
  bandRings(dt) {
    const B = this.band;
    if (!B || this.state !== 'play' || !this.bandPerched(B) || B.done) return;
    const ring = this.rings[this.bandCri(B)];
    if (!ring) return;
    const free = !(ring.motor || ring.gear || ring.stun > 0 || ring.lock > 0);
    // the counter: how far the ring has been turned against his crank lately (the player, a power: anything but him)
    const own = (ring.omega || 0) * dt, k = Math.exp(-dt / BAND.shakeTau);
    B.fl = Math.max(0, B.fl * k - B.dir * own);
    // 0.8.19 the player's last move: his ring turned against him (not yet a shake): he takes note and changes plan at his
    // next sit (bandChase: the pounce, or another ring)
    const tr = this.menaceTurned(this.bandCri(B), 0.25); // the menace engine saw the player turn his ring his way-against
    if (!B.push && tr && tr.dir === -B.dir && (B.ph === 'sit' || B.ph === 'spit' || B.ph === 'crank')) { B.push = 1; this.emit('bandBrace', { ...this.bandHead(B), ring: B.ri }); }
    if (!B.push && B.fl > BAND.brace * this.bandM(BAND.shake) * D2R && (B.ph === 'sit' || B.ph === 'spit' || B.ph === 'crank')) { B.push = 1; this.emit('bandBrace', { ...this.bandHead(B), ring: B.ri }); }
    if (B.fl > this.bandM(BAND.shake) * D2R && B.ph !== 'shaken' && B.ph !== 'duel' && B.hitCD <= 0) { B.fl = 0; this.bandShake(B); return; }
    if (B.ph !== 'crank' || !free || B.held || B.fz > 0) return;
    const w = B.dir * (B.pry ? this.bandFast(this.bandM(BAND.pry)) : this.bandCrankW()) * D2R * ss(0, BAND.crankIn, B.dur - B.t);
    ring.omega += w; ring.target += w * dt; // a turn of his own: the target goes with it (no tug of war with a held ring)
    B.cr += Math.abs(w) * dt * this.bandFloor(B.ri); // m of floor cranked (the art's hand-over-hand is tied to it)
  },

  // ---------- every step (sim.js predStep)
  bandStep(dt) {
    const B = this.band;
    if (!B) return;
    const end = this.state !== 'play', X = this.bx && this.bx.boss;
    if (B.hitCD > 0) B.hitCD -= dt;
    if (B.pk > 0) B.pk -= dt;
    if (this.menaceHolds('band') && B.ph !== 'reach' && B.ph !== 'grab' && B.ph !== 'strain') this.menaceDone('band', 'reach', B.sack.length > (B.sk0 || 0)); // the move is over
    if (B.ph !== 'grab') B.sk0 = B.sack.length;
    this.bandSpillStep(B, dt);
    this.bandHolds(B);
    this.bandWeasel(B, dt);
    if (end) {
      if (!B.end) {
        this.bandLetGo(B, 'end'); B.end = this.state === 'winning' || this.state === 'won' ? 'win' : 'lose';
        if (B.ph === 'climb') this.bandSit(B, B.ri, B.side, B.low);
        if (!B.done && !this.bandPerched(B) && B.ph !== 'fall') this.bandSet(B, B.end === 'win' ? 'idle' : 'laugh', 99);
        else if (this.bandPerched(B)) this.bandSet(B, 'sit', 99);
      }
      if (B.ph === 'fall' && (B.t -= dt) <= 0) this.bandDefeat(B);
      return;
    }
    // the target is saved and only eggs in his sack (or the weasel's den) are left: the level ends as a win
    if (B.sack.length && this.savedLog.length >= (this.level.target || 1) && this.aliveEggs().every((e) => e.hc === 3 || e.thf === 2)) { this.finish(); return; }
    if (B.ph === 'defeated') return;
    if (B.ph === 'fall') { if ((B.t -= dt) <= 0) this.bandDefeat(B); return; }
    const perched = this.bandPerched(B);
    // the frost: frozen solid where he is (a shake still hurts him and thaws him: bandRings)
    if ((X && X.stk > 0) || B.fz > 0) {
      if (!B.held) { B.held = 1; this.bandLetGo(B, 'cold'); this.emit('bandFreeze', this.bandHead(B)); }
      if (B.fz > 0) B.fz -= dt;
      return;
    }
    if (B.held) { B.held = 0; this.emit('bandThaw', this.bandHead(B)); if (perched && B.ph !== 'shaken') this.bandSet(B, 'sit', 0.6); }
    // dizzy (the rooster's crow, a strike, a quake, a rock): he lets go and reels
    if (X && X.dizzy > 0 && B.ph !== 'stun' && B.ph !== 'perchStun' && B.ph !== 'shaken' && B.ph !== 'hop' && B.ph !== 'climb' && B.ph !== 'whistle' && B.ph !== 'duel') {
      this.bandLetGo(B, 'daze'); this.bandSet(B, perched ? 'perchStun' : 'stun', X.dizzy); this.emit('bandStun', this.bandHead(B));
    }
    // the Scarecrow: on the yard he keeps well away; on a ring he cowers and leaves the ring and the eggs alone
    if (this.scareT > 0 && B.ph !== 'scared' && B.ph !== 'cower' && B.ph !== 'shaken' && B.ph !== 'hop' && B.ph !== 'climb' && B.ph !== 'duel') {
      if (perched) { this.bandLetGo(B, 'scare'); this.bandSet(B, 'cower'); } else { this.bandSet(B, 'scared'); B.tgt = 0; }
      this.emit('bandScared', this.bandHead(B));
    }
    if (CATCH.has(B.ph)) this.bandSpot(B);
    if (perched && B.ph !== 'shaken') this.bandKnock(B);
    switch (B.ph) {
      // ----- the yard
      case 'idle': if ((B.t -= dt) <= 0) this.bandSet(B, 'sneak'); B.face = 1; break;
      case 'sneak': {
        const ri = this.bandRingsOk()[0], P = this.bandPt(ri, (-90 - BAND.perchA) * D2R), g = this.bandGeo(), gx = clamp(P.x - 0.35, g.x0, g.x1);
        if (this.bandWalk(B, gx, dt) < 0.02) { B.face = 1; this.bandSet(B, 'crouch', this.bandTell(BAND.crouch)); this.emit('bandCrouch', this.bandHead(B)); }
        break;
      }
      case 'crouch':
        if ((B.t -= dt) <= 0) {
          B.from = { x: B.x, y: this.groundY }; this.bandSit(B, this.bandRingsOk()[0], -1);
          this.bandSet(B, 'climb', this.bandQuick(BAND.climb)); this.emit('bandClimb', { ...this.bandPerchPt(B), ring: B.ri });
        }
        break;
      case 'climb': if ((B.t -= dt) <= 0) { this.bandSet(B, 'sit', this.bandRest(BAND.tease)); this.emit('bandPerch', { ...this.bandHead(B), ring: B.ri }); } break;
      case 'dash': this.bandDash(B, dt); break;
      case 'stuff':
        if ((B.t -= dt) <= 0) {
          const e = B.eid ? this.eggs.find((q) => q.id === B.eid && q.alive) : null;
          B.eid = 0;
          if (e) { e.hc = 3; B.sack.push(e.id); this.emit('bandStuff', { ...this.bandHead(B), egg: e, n: B.sack.length }); }
          this.bandSet(B, 'laugh', BAND.laugh);
        }
        break;
      case 'laugh': if ((B.t -= dt) <= 0) this.bandSet(B, 'sneak'); break;
      case 'scared': { const g = this.bandGeo(); this.bandWalk(B, g.x0, dt, 1.4); if (!(this.scareT > 0)) this.bandSet(B, 'sneak'); break; }
      case 'stun': if ((B.t -= dt) <= 0 && !(X && X.dizzy > 0)) this.bandSet(B, 'sneak'); break;
      // ----- on a ring
      case 'sit': {
        // 0.8.19 hungry: an egg in his reach he goes for after a short notice, not when his sit is over
        const seen = this.bandNotice(B, dt);
        if (seen && this.bandReach(B)) break; // (no attack token, or the breather: he sits on it, eyes on the egg)
        if ((B.t -= dt) > 0) break;
        if (B.duel) break; // the weasel is coming for its share (bandMeet moves him)
        const go = this.bandChase(B); // the eggs are kept from him: he goes after them (a telegraph, then a hop)
        if (go) { this.bandEye(B, go); break; }
        if (B.pry) { if (!this.bandPryEggs(B)) { B.pry = 0; B.push = 1; } else B.dir = this.bandPryDir(B); } // the pry: the short way round
        this.bandSet(B, 'spit', this.bandTell(BAND.spit)); this.emit('bandSpit', { ...this.bandHead(B), ring: this.bandCri(B), dir: B.dir });
        break;
      }
      case 'spit':
        if (this.bandNotice(B, dt) && this.bandReach(B)) break;
        if ((B.t -= dt) <= 0) { this.bandSet(B, 'crank', B.pry ? BAND.pryT : this.bandM(BAND.crankT)); this.emit('bandCrank', { ...this.bandHead(B), ring: this.bandCri(B), dir: B.dir }); }
        break;
      case 'eye': // 0.8.19 the pursuit's telegraph: up on his toes, leaning, eyes locked on where he is going; then the hop
        if ((B.t -= dt) <= 0) {
          const G = B.go; B.go = null;
          if (!G) { this.bandSet(B, 'sit', this.bandRest(BAND.tease)); break; }
          B.from = { ri: B.ri, pa: B.pa, face: B.face }; this.bandSit(B, G.ri, G.side, G.low, G.pry);
          this.bandSet(B, 'hop', this.bandQuick(BAND.hop)); this.emit('bandHop', { ...this.bandPerchPt(B), ring: B.ri, chase: 1 });
        }
        break;
      case 'crank':
        if (this.bandPick(B) && this.bandReach(B)) break; // cranking he is already reaching out: no notice
        // 0.8.19 a bout on a floor with no egg on it is cut short (BAND.dryT): he has cranked, there was a ring to shake,
        // and now he may go after the eggs (bandChase)
        if (B.pry) { // the pry: until the eggs are out of the ring he turns (or the bout is over)
          if ((B.t -= dt) <= 0 || !this.bandPryEggs(B)) { if (!this.bandPryEggs(B)) B.pry = 0; B.dry = 0; B.pk = BAND.pryCalm; this.bandSet(B, 'sit', this.bandRest(0.5)); }
          break;
        }
        const out = !this.bandRingsOk().some((ri) => this.aliveEggs().some((e) => this.reefFit(e) && this.channelOf(e) === ri)); // every egg inside: the pry is next
        if ((B.t -= dt) <= 0 || (!this.bandHasEggs(B) && B.dur - B.t >= (out ? BAND.pryDry : BAND.dryT))) {
          B.dry = this.bandHasEggs(B) ? 0 : (B.dry || 0) + 1;
          B.miss = this.bandHasEggs(B) ? (B.miss || 0) + 1 : 0; // eggs on his floor and none came to him
          this.bandSet(B, 'sit', this.bandRest(this.bandHasEggs(B) ? BAND.sit : out ? 0.8 : BAND.tease));
        }
        break;
      case 'reach': {
        const e = this.eggs.find((q) => q.id === B.tgt);
        // (0.8.19 a near miss on the edge of a run: as his fingers close the reach shrinks to menaceNear of itself)
        if (!e || !this.bandFit(e) || !this.bandInReach(B, e, B.t <= dt ? 1.3 * this.menaceNear() : 1.3)) { this.bandSet(B, 'sit', this.bandRest(0.8)); B.tgt = 0; B.push = 1; this.emit('bandMiss', this.bandHead(B)); break; } // 0.8.19 snatched away: he re-plans at once (bandChase)
        const p = e.body.getPosition(); B.px = p.x; B.py = p.y;
        if ((B.t -= dt) <= 0) {
          if (e.stone > 0) { this.bandSet(B, 'strain', BAND.strain); this.emit('bandStrain', { x: p.x, y: p.y, egg: e }); break; } // too heavy: he tugs and gives up
          this.reefTake(e, 2); B.eid = e.id; B.tgt = 0; B.sx = p.x; B.sy = p.y; B.miss = 0; B.push = 0;
          this.bandSet(B, 'grab', BAND.grab); this.emit('bandGrab', { x: p.x, y: p.y, egg: e, golden: e.golden ? 1 : 0 });
        }
        break;
      }
      case 'strain': if ((B.t -= dt) <= 0) { const e = this.eggs.find((q) => q.id === B.tgt); this.emit('bandHeavy', e ? { ...e.body.getPosition() } : this.bandHead(B)); B.tgt = 0; this.bandSet(B, 'sit', this.bandRest(BAND.sit)); } break;
      case 'grab':
        if ((B.t -= dt) <= 0) {
          const e = B.eid ? this.eggs.find((q) => q.id === B.eid && q.alive) : null;
          B.eid = 0;
          if (e) { e.hc = 3; B.sack.push(e.id); B.tk = this.t; this.emit('bandStuff', { ...this.bandHead(B), egg: e, n: B.sack.length }); }
          this.bandSet(B, 'sit', this.bandRest(BAND.sit));
        }
        break;
      case 'shaken':
        if ((B.t -= dt) <= 0) {
          if (!B.hurt) { this.bandSet(B, 'sit', this.bandRest(BAND.sit)); break; }
          B.hurt = 0;
          if (B.hits >= B.hp) { B.lx = clamp(this.bandPerchPt(B).x, this.bandGeo().x0, this.bandGeo().x1); B.from = { ...this.bandPerchPt(B) }; this.bandSet(B, 'fall', BAND.fall); this.emit('bandFall', this.bandHead(B)); break; }
          const ok = this.bandRingsOk(), nx = ok[Math.min(ok.length - 1, ok.indexOf(B.ri) + 1)] ?? B.ri;
          B.from = { ri: B.ri, pa: B.pa }; this.bandSit(B, nx, -B.side);
          this.bandSet(B, 'hop', this.bandQuick(BAND.hop)); this.emit('bandHop', { ...this.bandPerchPt(B), ring: B.ri });
        }
        break;
      case 'hop':
        if ((B.t -= dt) <= 0) {
          this.emit('bandPerch', { ...this.bandHead(B), ring: B.ri });
          if (B.hits >= 2 && !B.whistled && this.bandWeaselT()) { this.bandSet(B, 'whistle', BAND.whistle); B.whistled = 1; }
          else this.bandSet(B, 'sit', this.bandRest(B.pry ? 0.4 : BAND.tease)); // (the pry: straight to work)
        }
        break;
      case 'whistle':
        if (B.wz === 0 && B.dur - B.t >= BAND.call) this.bandCall(B);
        if ((B.t -= dt) <= 0) { if (!B.wz) this.bandCall(B); this.bandSet(B, 'sit', this.bandRest(BAND.tease)); }
        break;
      case 'perchStun': if ((B.t -= dt) <= 0 && !(X && X.dizzy > 0)) this.bandSet(B, 'sit', 0.8); break;
      case 'duel': this.bandDuelStep(B, dt); break; // 0.8.18 the stand-off
      case 'dust': case 'huh': if ((B.t -= dt) <= 0) { B.duel = null; this.bandSet(B, 'sit', this.bandRest(BAND.tease)); } break;
      case 'cower': if (!(this.scareT > 0)) this.bandSet(B, 'sit', 0.8); break;
    }
  },
  bandReach(B) {
    const e = this.bandPick(B);
    if (!e || !this.menaceMay('band', 'reach', this.bandBoss())) return false; // 0.8.19 the menace engine's say
    const p = e.body.getPosition();
    if (B.pry) { B.pry = 0; B.pk = BAND.pryCalm; } // the pry worked: an egg is out by him
    B.tgt = e.id; B.px = p.x; B.py = p.y;
    this.bandSet(B, 'reach', this.bandTell(BAND.reach));
    this.emit('bandReach', { x: p.x, y: p.y, egg: e, ring: B.ri });
    return true;
  },
  // an egg in his reach for BAND.notice (x snatch) s while he sits or spits: true when he goes for it (B.see: the clock)
  bandNotice(B, dt) {
    if (!this.bandPick(B)) { B.see = 0; return false; }
    B.see = (B.see || 0) + dt;
    return B.see >= BAND.notice * this.bandD().snatch;
  },
  // 0.8.19 the pursuit (DYN.raccoon.chase): after a sit with no egg on his floor he goes after them: to the nearest ring he
  // may sit on that has eggs on its floor (the side most of them lie), or across the bottom of his own ring when every egg
  // on it lies on the far side. Never on a ring he may not sit on (the nest ring, a motor or gear ring, a small ring).
  bandChase(B) {
    const D = this.bandD();
    if (!(D.chase > 0) || B.done || B.held) return null;
    const eggs = this.aliveEggs().filter((e) => this.reefFit(e) && !(e.fire > 0) && !e.hc && !e.thf && e.body.isActive());
    const off = (e) => { const p = e.body.getPosition(); return wrap(Math.atan2(p.y, p.x) + Math.PI / 2); }; // + right of the bottom
    const on = (ri) => eggs.filter((e) => this.channelOf(e) === ri);
    const mine = on(B.ri);
    if (mine.length) {
      if (mine.every((e) => off(e) * B.side < -12 * D2R)) return { ri: B.ri, side: -B.side };
      // his SECOND WAY: a crank bout brought nothing to him, or the player fights his ring: he pounces down the slope
      // to sit right by the eggs at the bottom (then reaches, or cranks from there). The first try on a perch is always
      // the crank (the lesson); the pounce comes from what the player did, so two tries do not play the same
      if (!B.low && ((B.miss || 0) >= 2 - D.chase || B.push)) {
        const m = mine.reduce((a, e) => a + off(e), 0) / mine.length;
        return { ri: B.ri, side: Math.abs(m) < 4 * D2R ? B.side : m > 0 ? 1 : -1, low: 1 };
      }
      return null;
    }
    // 0.8.19 no egg on any ring he may sit on (they are all inside): after the first crank bout for nothing (the lesson,
    // every mode) he goes for the pry (Easy too: the pried ring is a ring to shake as well)
    if ((B.dry || 0) < 2 - D.chase && !B.push) return (B.dry || 0) >= 1 && !this.bandRingsOk().some((ri) => on(ri).length) ? this.bandPryGo(B, eggs, off) : null; // first a crank bout there for nothing (Easy: two); there is always a ring to shake
    let best = null;
    for (const ri of this.bandRingsOk()) {
      const L = on(ri);
      if (!L.length) continue;
      const d = Math.abs(ri - B.ri);
      if (!best || d < best.d || (d === best.d && L.length > best.L.length)) best = { ri, d, L };
    }
    if (!best) return this.bandPryGo(B, eggs, off);
    B.dry = 0;
    const m = best.L.reduce((a, e) => a + off(e), 0) / best.L.length;
    return { ri: best.ri, side: Math.abs(m) < 6 * D2R ? B.side : m > 0 ? 1 : -1 };
  },
  // 0.8.19 the pry (BAND.pryR): no egg on a ring he may sit on: in to the floor just outside the outermost eggs
  bandPryGo(B, eggs, off) {
    let c = -1;
    for (const e of eggs) c = Math.max(c, this.channelOf(e));
    const k = c + 1, ring = this.rings[k];
    if (B.tk != null && this.t - B.tk < this.bandM(BAND.pryAfter)) return null; // he enjoys his catch a while
    if (c < 0 || !ring || ring.r < BAND.pryR || ring.motor || ring.gear || this.rings[c].motor || this.rings[c].gear || (k === B.ri && B.pry)) return null;
    B.dry = 0;
    const L = eggs.filter((e) => this.channelOf(e) === c), m = L.reduce((a, e) => a + off(e), 0) / L.length;
    return { ri: k, side: Math.abs(m) < 6 * D2R ? B.side : m > 0 ? 1 : -1, pry: 1 };
  },
  bandEye(B, go) {
    B.go = go; B.see = 0;
    this.bandSet(B, 'eye', this.bandTell(BAND.eye));
    const P = this.bandPt(go.ri, (-90 + go.side * BAND.perchA) * D2R);
    this.emit('bandEye', { ...this.bandHead(B), ring: go.ri, x1: P.x, y1: P.y });
  },
  bandWalk(B, gx, dt, k = 1) {
    const d = gx - B.x;
    if (Math.abs(d) < 0.02) { B.x = gx; return 0; }
    const v = this.bandFast(BAND.sneak) * k * dt;
    B.face = d > 0 ? 1 : -1;
    B.x += clamp(d, -v, v); B.odo += Math.min(Math.abs(d), v);
    return Math.abs(gx - B.x);
  },
  // an egg falling out of the vault over his yard: where it will be at catch height, and can he get there
  bandFalling(B) {
    const g = this.bandGeo(), n = this.rings.length, yc = this.groundY + BAND.catchH, nx = this.nest.getPosition().x;
    let best = null;
    for (const e of this.aliveEggs()) {
      if (!e.body.isActive() || e.hc || e.thf || e.chick || this.channelOf(e) < n) continue;
      const p = e.body.getPosition(), v = e.body.getLinearVelocity();
      if (p.y < yc - 0.25 || v.y > 0.5) continue;
      const h = Math.max(0, p.y - yc), tc = (v.y + Math.sqrt(v.y * v.y + 2 * this.g * h)) / this.g, xc = p.x + v.x * tc;
      if (xc < g.x0 - 0.6 || xc > g.x1 + 0.45 || Math.abs(xc - nx) < this.nestW / 2 + 0.1) continue;
      if (Math.abs(clamp(xc, g.x0, g.x1) - B.x) > this.bandM(BAND.dash) * tc + BAND.catchR) continue;
      if (!best || tc < best.tc) best = { e: e.id, xc: clamp(xc, g.x0, g.x1), tc };
    }
    return best;
  },
  bandSpot(B) {
    const F = this.bandFalling(B);
    if (!F) return;
    B.tgt = F.e; B.goal = F.xc;
    this.bandSet(B, 'dash');
    this.emit('bandDash', { ...this.bandHead(B), x1: F.xc });
  },
  bandMouth(B) { return { x: B.x - 0.05 * B.face, y: this.groundY + BAND.catchH }; },
  bandDash(B, dt) {
    const e = this.eggs.find((q) => q.id === B.tgt && q.alive && !q.saved);
    const F = this.bandFalling(B);
    if (F && F.e === B.tgt) B.goal = F.xc;
    if (e && e.body.isActive() && !e.hc) {
      const m = this.bandMouth(B), p = e.body.getPosition();
      if (Math.hypot(p.x - m.x, p.y - m.y) < BAND.catchR) { // caught: into the sack
        this.reefTake(e, 2); B.eid = e.id; B.sx = p.x; B.sy = p.y; B.px = p.x; B.py = p.y; B.face = 1; B.tgt = 0; // (px, py: where it was caught)
        this.bandSet(B, 'stuff', BAND.stuff);
        this.emit('bandCatch', { x: p.x, y: p.y, egg: e });
        return;
      }
    }
    if (!e || !e.body.isActive() || e.hc || e.body.getPosition().y < this.groundY + 0.2) { this.bandSet(B, 'sneak'); B.tgt = 0; return; }
    const d = B.goal - B.x, v = this.bandM(BAND.dash) * dt;
    if (Math.abs(d) > 0.01) { B.face = d > 0 ? 1 : -1; B.x += clamp(d, -v, v); B.odo += Math.min(Math.abs(d), v); }
  },
  // the egg in his paw rides it; the eggs in his sack ride the sack (out of the world: their bodies are off)
  bandHolds(B) {
    if (B.eid) {
      const e = this.eggs.find((q) => q.id === B.eid);
      if (!e || !e.alive || e.saved) B.eid = 0;
      else {
        const p = this.bandHoldPt(B), k = B.sx != null ? 0.35 : 1;
        const x = B.sx != null ? B.sx + (p.x - B.sx) * k : p.x, y = B.sy != null ? B.sy + (p.y - B.sy) * k : p.y;
        B.sx = null; B.sy = null;
        this.bandPin(e, x, y);
      }
    }
    B.sack = B.sack.filter((id) => this.eggs.some((q) => q.id === id && q.alive && !q.saved));
    B.sack.forEach((id, i) => { const e = this.eggs.find((q) => q.id === id), p = this.bandSackPt(B, i + 1); this.bandPin(e, p.x, p.y); });
  },
  // where the egg in his paw is: at the grab point, then hugged to his chest, then (0.8.18) down into his sack at his hip;
  // on the yard from his arms (where he caught it) into his sack. render/banditplay.js draws it exactly here, his paws on
  // it. stuff = 0: without the trip to the sack (his reaching paw for bandKnock / bandHit, as before)
  bandHoldPt(B, stuff = 1) {
    const u = 1 - B.t / Math.max(1e-3, B.dur);
    if (B.ph === 'grab') {
      const s = stuff ? ss(0.74, 0.9, u) : 0;
      if (s > 0) return this.bandBody(B, 0.65 - 0.33 * s + 0.12 * Math.sin(s * Math.PI), 0.25 - 0.6 * s);
      const C = this.bandBody(B, 0.65, 0.25), k = ss(0, 0.35, u); return { x: B.px + (C.x - B.px) * k, y: B.py + (C.y - B.py) * k };
    }
    if (this.bandPerched(B)) return this.bandBody(B, 0.65, 0.25);
    if (B.ph === 'stuff' && stuff) { const M = { x: B.px, y: B.py }, s = ss(0, 0.76, u), x1 = B.x - 0.23 * B.face, y1 = this.groundY + 0.5; return { x: M.x + (x1 - M.x) * s, y: M.y + (y1 - M.y) * s + 0.15 * Math.sin(s * Math.PI) }; } // into his sack, swung round in front of his hip
    return this.bandSackPt(B, 0);
  },
  bandSackPt(B, i) {
    if (this.bandPerched(B) || B.ph === 'hop' || B.ph === 'climb') { const P = this.bandPerched(B) ? this.bandBody(B, 0.6, -0.45) : this.bandHead(B); return { x: P.x + (i % 2 ? 0.08 : -0.08), y: P.y + 0.04 * i }; }
    return { x: B.x - 0.44 * B.face + (i % 2 ? 0.08 : -0.08), y: this.groundY + 0.8 + 0.04 * i }; // 0.8.18: his sack as drawn (banditplay BANDIT_SCALE)
  },
  bandPin(e, x, y) {
    const b = e.body;
    b.setTransform({ x, y }, 0.3);
    b.setLinearVelocity({ x: 0, y: 0 }); b.setAngularVelocity(0);
    e.ch = this.channelOf(e); e.freefall = 0; e.drop = 0;
  },
  // drop what he holds back on his floor just down the slope from him (on the yard: where his sack is), unharmed
  bandLetGo(B, why) {
    const e = B.eid ? this.eggs.find((q) => q.id === B.eid) : null;
    B.eid = 0; B.sx = null; B.sy = null; B.tgt = 0;
    if (!e || !e.alive) return null;
    let x, y;
    if (B.ri >= 0 && (this.bandPerched(B) || B.ph === 'fall' || B.ph === 'hop')) { // on solid floor just down the slope from him (never into a gap)
      const ring = this.rings[B.ri], ra = ring.body.getAngle(), r = this.bandFloor(B.ri) - 0.3, solid = (a) => !ring.gaps.some((g) => g.o >= 0.5 && Math.abs(wrap(ra + g.a - a)) * ring.r < g.len / 2 + 0.3);
      let a = B.pa - B.side * (0.55 / r);
      for (let k = 0; k < 24; k++) { const c = B.pa - B.side * ((0.55 + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 0.12) / r); if (solid(c)) { a = c; break; } }
      x = r * Math.cos(a); y = r * Math.sin(a);
    }
    else { const ri = this.rings.length - 1, r = this.bandFloor(ri) - 0.3, a = -Math.PI / 2 - 0.25; x = r * Math.cos(a); y = r * Math.sin(a); }
    e.body.setTransform({ x, y }, e.body.getAngle());
    this.reefFree(e, 0, 0, 0.9);
    this.emit('bandDrop', { x, y, egg: e, why });
    return e;
  },
  // the counter: his ring turned against him
  bandShake(B) {
    const hurt = HURTABLE.has(B.ph) || B.held || B.fz > 0;
    const X = this.bx && this.bx.boss;
    if (B.held || B.fz > 0) { B.held = 0; B.fz = 0; if (X) X.stk = 0; }
    this.emit('bandShake', { ...this.bandHead(B), ring: B.ri, dir: B.dir, hurt: hurt ? 1 : 0 });
    if (hurt && this.bandOuch(B, 'shake')) return;
    this.bandLetGo(B, 'shake');
    this.bandSet(B, 'shaken', BAND.wobble); B.hurt = 0;
  },
  // a burning egg or a busy chick by him, or an egg slamming into him, on his ring
  bandKnock(B) {
    if (B.hitCD > 0) return false;
    const body = this.bandBody(B, 0.6, 0.15), paw = this.bandPaw(B);
    for (const e of this.aliveEggs()) {
      if (!e.body.isActive() || e.hc) continue;
      const p = e.body.getPosition(), v = e.body.getLinearVelocity(), sp = Math.hypot(v.x, v.y);
      const near = Math.hypot(p.x - body.x, p.y - body.y) < 0.55 || Math.hypot(p.x - paw.x, p.y - paw.y) < 0.4;
      if (!near) continue;
      if (e.fire > 0) { this.bandOuch(B, 'hot'); return true; }
      if ((B.pry || B.pk > 0) && !(e.fire > 0)) continue; // 0.8.19 the eggs (and a chick) he tips out of the pried ring tumble by him
      if (sp > BAND.knockV || (e.chick && sp > 0.6)) { this.bandOuch(B, e.chick ? 'peck' : 'bump'); return true; }
    }
    return false;
  },
  // his reaching paw (world): from his shoulder out to the egg as the reach plays; else at his shoulder
  bandPaw(B) {
    if (!this.bandPerched(B)) return this.bandHead(B);
    const S = this.bandBody(B, 0.75, 0.2);
    if (B.ph === 'reach' || B.ph === 'strain') { const k = B.ph === 'strain' ? 1 : ss(0.15, 0.6, 1 - B.t / Math.max(1e-3, B.dur)); return { x: S.x + (B.px - S.x) * k, y: S.y + (B.py - S.y) * k }; }
    if (B.ph === 'grab') return this.bandHoldPt(B, 0);
    return S;
  },
  // one hurt (a shake mid-work, a zap, a flash, a burn, a peck): he wobbles and drops what he holds; three and he falls
  bandOuch(B, why) {
    if (B.hitCD > 0 || B.done || !this.bandPerched(B)) return false;
    this.bandLetGo(B, why);
    B.hits++; B.hitCD = BAND.hitCD; B.why = why; B.tgt = 0; B.fl = 0;
    const X = this.bx && this.bx.boss;
    if (X) X.flinch = 0.9;
    this.bandSet(B, 'shaken', BAND.shaken); B.hurt = 1;
    const h = this.bandHead(B);
    this.emit('bandHurt', { ...h, why, hits: B.hits, hp: B.hp, left: Math.max(0, B.hp - B.hits), ring: B.ri });
    return true;
  },
  // he lands in his own sack on the yard: it bursts and every egg flies back into the outer channel (nearest the bottom
  // first, onto floor clear of a gap)
  bandDefeat(B) {
    B.done = 1; B.t0 = this.t; B.x = B.lx ?? this.bandGeo().home; B.face = 1; this.bandSet(B, 'defeated', 1e9); B.ri = -1;
    const X = this.bx && this.bx.boss;
    if (X) { X.atk = null; X.t = 1e9; }
    this.bandSpillSack(B, this.bandSackPt(B, 0));
    this.emit('bandDefeat', { ...this.bandHead(B), n: B.spill.length });
  },
  // every egg in his sack flies back into the outer channel from S (nearest the bottom first, onto floor clear of a gap)
  bandSpillSack(B, S) {
    const ring = this.bandOuter(), ra = ring.body.getAngle(), ri = this.bandEggR(), used = [];
    const free = (a) => !ring.gaps.some((g) => Math.abs(wrap(ra + g.a - a)) * ring.r < g.len / 2 + 0.42) && !used.some((u) => Math.abs(wrap(u - a)) * ri < 0.62);
    B.sack.splice(0).forEach((id) => {
      let a = -Math.PI / 2;
      for (let k = 0; k < 40; k++) { const c = -Math.PI / 2 + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 6 * D2R; if (free(c)) { a = c; break; } }
      used.push(a);
      B.spill.push({ id, t: 0, x0: S.x, y0: S.y, x1: ri * Math.cos(a), y1: ri * Math.sin(a) });
    });
  },
  bandSpillStep(B, dt) {
    if (!B.spill.length) return;
    B.spill = B.spill.filter((F) => {
      const e = this.eggs.find((q) => q.id === F.id && q.alive);
      if (!e) return false;
      F.t += dt;
      const u = clamp(F.t / BAND.spillT, 0, 1), h = 1.6 * Math.sin(u * Math.PI);
      this.bandPin(e, F.x0 + (F.x1 - F.x0) * u, F.y0 + (F.y1 - F.y0) * u + h);
      if (u < 1) return true;
      this.reefFree(e, 0, 0, 1.2);
      this.emit('bandSpill', { x: F.x1, y: F.y1, egg: e });
      return false;
    });
  },
  // the whistle: the level's waiting weasel comes out for a short hunt, then goes home for good
  bandWeaselT() { return (this.thieves || []).find((T) => T.kind === 'weasel' && !T.boss) || null; },
  bandCall(B) {
    const T = this.bandWeaselT();
    B.wz = this.bandM(BAND.hunt);
    this.emit('bandWhistle', { ...this.bandHead(B), weasel: T ? 1 : 0 });
    if (T && (T.ph === 'wait' || T.ph === 'hide')) { T.t = Math.min(T.t, 0.35); B.wid = T.id; }
  },
  bandWeasel(B, dt) {
    if (!(B.wz > 0) && B.wz !== -1) return;
    const T = this.bandWeaselT();
    if (!T) return;
    if (B.wz > 0) { if (T.ph !== 'wait') B.wz -= dt; if (B.wz <= 0) B.wz = -1; return; }
    // its hunt is over: sent home (once it has nothing in its jaws), and it stays there
    if (T.ph === 'hide' || T.ph === 'wait') { T.t = Math.max(T.t, 1e9); return; }
    if (B.duel && B.duel.ph === 'come' && B.ph !== 'duel') { this.bandMeet(B, T, dt); return; } // 0.8.19 rings apart: they close in
    if (T.ph === 'duel' || B.ph === 'duel') return;
    if (['prowl', 'stalk', 'idle', 'in', 'laugh'].includes(T.ph) && !T.eid && this.state === 'play') {
      // 0.8.18 the stand-off: first it comes for its share (once; he waits for it a little while he is busy on his perch)
      if (!B.dueled && !B.done && T.ch === T.run && this.bandPerched(B) && !B.held && !(B.fz > 0)) {
        if (B.ph === 'sit' || B.ph === 'spit' || B.ph === 'crank') { this.bandDuel(B, T); return; }
        if ((B.dw += dt) < DUEL.wait) return;
      }
      this.thGoHome(T);
    }
  },
  // ---------- 0.8.18 the stand-off (see the top): B.duel = { ph, t, wid, a (where the weasel stops on its run, world) }
  // where the weasel stops on its run: on his own floor a step short of him on its side, else straight below his perch
  bandDuelA(B, T) { if (T.run !== B.ri) return wrap(B.pa); const s = wrap(T.a - B.pa) >= 0 ? 1 : -1; return wrap(B.pa + (s * DUEL.gap) / Math.max(0.5, T.r)); },
  bandDuel(B, T) {
    B.dueled = 1; this.bandLetGo(B, 'duel');
    B.duel = { ph: 'come', t: 0, wid: T.id, a: this.bandDuelA(B, T), win: '' };
    if (T.run === B.ri) this.bandSet(B, 'duel', 1e9); else B.go = null; // 0.8.19 rings apart: he goes to it first (bandMeet)
    T.tgt = 0; T.k = 'come'; this.thSet(T, 'duel', 1e9);
    this.emit('bandDuel', { ph: 'come', ...this.bandHead(B) });
  },
  bandDuelStep(B, dt) {
    const D = B.duel, T = D && (this.thieves || []).find((q) => q.id === D.wid);
    if (!D || !T || T.ph !== 'duel') { B.duel = null; this.bandSet(B, 'sit', 0.8); return; } // knocked out of it: it is over
    D.t += dt;
    if (D.ph === 'come') { // along its run (his ring: bandMeet saw to that) to a step short of him, then it stops dead: FREEZE
      const left = this.thToward(T, D.a, HUNT_SPEED, dt);
      if (left > DUEL.near && D.t < DUEL.come) return;
      if (T.run !== B.ri || left > DUEL.meet) { this.bandMeetOff(B, T); return; } // never a stand-off across rings or from afar
      D.t = 0; D.ph = 'freeze'; T.k = 'freeze';
      T.face = wrap(B.pa - T.a) >= 0 ? 1 : -1; // facing him
      this.emit('bandDuel', { ph: 'freeze', ...this.bandDuelPt(B) });
      return;
    }
    let el = D.t, i = 0;
    for (; i < DUEL_PH.length; i++) { const d = DUEL[DUEL_PH[i]]; if (el < d) break; el -= d; }
    if (i < DUEL_PH.length) {
      if (DUEL_PH[i] !== D.ph) { D.ph = DUEL_PH[i]; T.k = D.ph; this.emit('bandDuel', { ph: D.ph, ...this.bandDuelPt(B) }); }
      if (D.ph === 'circle') { // it sidles: a step back and forth, never taking its eyes off him
        const a = wrap(D.a + (DUEL.sidle * Math.sin((el / DUEL.circle) * Math.PI * 2)) / Math.max(0.5, T.r));
        T.odo += Math.abs(wrap(a - T.a)) * T.r; T.a = a; T.face = wrap(B.pa - T.a) >= 0 ? 1 : -1;
      }
      return;
    }
    // the dust settles: the outcome is the state of his sack
    const P = this.bandDuelPt(B);
    if (B.sack.length) {
      D.win = 'weasel'; D.ph = 'rip'; B.rip = 1; // (his sack stays torn: render/raccoon.js draws the hole)
      this.bandSpillSack(B, this.bandSackPt(B, 0));
      this.emit('bandDuelRip', { ...P, n: B.spill.length });
      T.k = 'scare'; this.thGoHome(T);
      this.bandSet(B, 'huh', DUEL.huh);
    } else {
      D.win = 'band'; D.ph = 'won';
      this.emit('bandDuelWin', P);
      T.k = 'slink'; this.thGoHome(T);
      this.bandSet(B, 'dust', DUEL.dust);
    }
    B.wz = -1; // its hunt is over for good: home it goes and there it stays (bandWeasel)
  },
  // 0.8.19 the two on different rings: the weasel runs along its ring to below his perch, he (when he is free: sitting,
  // spitting or cranking) rises, locks eyes on it (EYE) and hops one ring toward its ring, again until he is on it; then
  // the stand-off proper begins on that one ring (bandDuelStep's COME: it closes the last steps, FREEZE, ...)
  bandMeet(B, T, dt) {
    const D = B.duel;
    if (T.ph !== 'duel' || B.done) { B.duel = null; if (T.ph === 'duel') this.thGoHome(T); return; }
    D.t += dt;
    this.thToward(T, wrap(B.pa), HUNT_SPEED, dt);
    T.face = wrap(B.pa - T.a) >= 0 ? 1 : -1;
    const free = B.ph === 'sit' || B.ph === 'spit' || B.ph === 'crank';
    if (free && B.ri === T.run) { D.t = 0; D.a = this.bandDuelA(B, T); this.bandLetGo(B, 'duel'); this.bandSet(B, 'duel', 1e9); return; }
    const ok = this.bandRingsOk();
    if (D.t > DUEL.meetT || !ok.includes(T.run)) { this.bandMeetOff(B, T); return; }
    if (!free) return;
    const step = T.run > B.ri ? 1 : -1, next = ok.filter((ri) => (ri - B.ri) * step > 0 && (T.run - ri) * step >= 0).sort((a, b) => (a - b) * step)[0];
    if (next == null) { this.bandMeetOff(B, T); return; }
    this.bandLetGo(B, 'duel');
    this.bandEye(B, { ri: next, side: wrap(T.a + Math.PI / 2) >= 0 ? 1 : -1 });
  },
  // no meeting: the weasel goes home for good, he gets back to work
  bandMeetOff(B, T) {
    B.duel = null; B.wz = -1; T.k = ''; this.thGoHome(T);
    if (B.ph === 'duel') this.bandSet(B, 'sit', 0.8);
  },
  bandDuelPt(B) { // the middle of the scuffle: between his perch and the weasel below it
    const D = B.duel, T = D && (this.thieves || []).find((q) => q.id === D.wid), h = this.bandHead(B);
    if (!T) return { x: h.x, y: h.y };
    const w = this.thBody(T);
    return { x: (h.x + w.x) / 2, y: (h.y + w.y) / 2 };
  },

  // ---------- hooks: boss.js (pose, bar), animalsHit, the glow flash
  bandBossPose(X) { const B = this.band; if (!B) return; const h = this.bandHead(B); X.x = h.x; X.y = h.y - 0.3; X.face = B.face; },
  bandBossBar() {
    const B = this.band;
    if (!B) return null;
    const left = Math.max(0, B.hp - B.hits), ph = B.ph, work = ph === 'spit' || ph === 'crank' || ph === 'reach' || ph === 'grab' || ph === 'strain';
    // no words: a ring with an arrow the way to turn it against him (lit while he is at it); his sack once he is beaten
    return { hp: left, hpMax: B.hp, ph: ph === 'shaken' ? 'trapped' : ph === 'spit' || ph === 'reach' ? 'crouch' : B.done ? 'defeated' : ph, label: ' ', eid: B.eid,
      icon: B.done ? { kind: 'sack' } : { kind: 'ringArrow', dir: B.ri >= 0 ? -B.dir : 1, hot: work ? 1 : 0, off: B.ri < 0 || !this.bandPerched(B) ? 1 : 0 } };
  },
  // the live state a lesson (or a test) reads: which ring he turns which way, and which way beats him
  bandLesson() {
    const B = this.band;
    if (!B || B.done || !this.bandPerched(B)) return null;
    return { ring: B.ri, dir: B.dir, counter: -B.dir, ph: B.ph, cranking: B.ph === 'crank' ? 1 : 0, hurtable: HURTABLE.has(B.ph) ? 1 : 0, perch: this.bandPerchPt(B), head: this.bandHead(B), shake: B.fl / (this.bandM(BAND.shake) * D2R) };
  },
  // weather, bosses and powers: kind 'flash' 'bolt' 'quake' 'gust' 'rock' 'lava' 'ice'; o {x, y, r}
  bandHit(kind, o = {}) {
    const B = this.band;
    if (!B || B.done || this.state !== 'play') return 0;
    const r = o.r ?? Infinity, paw = this.bandPaw(B), h = this.bandHead(B), X = this.bx && this.bx.boss;
    const near = r === Infinity || Math.hypot(paw.x - (o.x ?? 0), paw.y - (o.y ?? 0)) < r + 0.3 || Math.hypot(h.x - (o.x ?? 0), h.y - (o.y ?? 0)) < r + 0.6;
    if (!near || kind === 'gust') return 0;
    if ((kind === 'flash' || kind === 'bolt') && this.bandPerched(B)) { this.bandOuch(B, kind === 'bolt' ? 'zap' : 'flash'); return 1; }
    if (kind === 'ice') { B.fz = Math.max(B.fz, 2); return 1; }
    if (X) X.dizzy = Math.max(X.dizzy, kind === 'bolt' ? 2 : kind === 'quake' ? 1 : 1.5);
    return 1;
  },

  // ---------- the planner (search.js value) and the danger meter
  bandThreat(e) {
    const B = this.band;
    if (!B) return 0;
    if (B.sack.includes(e.id)) return 1;
    if (B.eid === e.id) return 0.9;
    if (B.tgt === e.id && (B.ph === 'reach' || B.ph === 'strain')) return 0.6;
    if (!B.done && this.bandPerched(B) && e.alive && !e.hc && this.channelOf(e) === B.ri && this.bandInReach(B, e, 1.6)) return 0.25;
    return 0;
  },
  bandScore() { const B = this.band; return B ? 450 * B.hits + (B.done ? 300 : 0) + (B.ph === 'shaken' ? 100 : 0) : 0; },

  // ---------- state
  bandState() { return this.band ? JSON.parse(JSON.stringify(this.band)) : null; },
  bandLoad(S) {
    this.band = S ? JSON.parse(JSON.stringify(S)) : this.band;
    if (this.band) for (const e of this.eggs) if (e.hc && e.body) e.body.setActive(false);
  },
};
