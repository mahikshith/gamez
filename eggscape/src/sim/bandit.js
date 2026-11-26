// BANDIT THE RACCOON (0.8.17, world 1 boss, L6 "Midnight Raid"). Mixed into Sim (sim.js: Object.assign(Sim.prototype,
// banditMethods)), so `this` is the Sim. All state is plain data in this.band (and egg.hc: 2 = in his paw, 3 = in his sack,
// the same marks the King Crab uses), copied by bandState() / restored by bandLoad(), so rewind, the planner and the hint
// stay exact. No randomness at all.
//
// level.raccoon = { delay, zone: [lo, hi] (deg, world: the arc of the outer ring he reaches through), hp (pinches, 3) }
// level.bossFight = { kind: 'raccoon', phases: [{ attacks: [] }] } gives him the boss bar, the rooster's stun and the
// Chick Strike target (sim/boss.js B: B.dizzy, B.stk, B.flinch are read here; bandBossPose puts B on him).
//
// He lives OUTSIDE the vault, on the farmyard under its lower-left side (the hen and her basket are on the right), so only
// his arm ever enters the vault and his body never crowds a channel.
//   SNEAK and REACH: when a gap of the outer ring is in his arc (zone) and an egg rests in the outer channel near it, he
//     tiptoes under that gap, stops and licks his lips (PEEK, the telegraph), then shoots his arm up through the gap and
//     gropes along the channel floor to the egg (GROPE), grabs it (hc 2), yanks it out (YANK) and stuffs it in his sack
//     (hc 3). Turning the gap away while he peeks makes him lose it ("huh?").
//   PINCH (the counter): turn the outer ring while his arm is through the gap and its edge pinches his paw: he yelps,
//     drops what he holds right there in the channel (unharmed) and hops about shaking a red paw. A hard knock on his paw
//     inside the vault (a fast egg, a burning egg, a chick, the glow flash, lightning) hurts him the same way.
//     Three hurts (hp): he goes dizzy, tumbles head first into his own sack and the sack spills every egg back into the
//     outer channel (DEFEATED, for the rest of the level).
//   WHISTLE: once, after the second hurt, two fingers in his mouth: the level's waiting weasel (level.weasel with a long
//     delay) comes out for a short hunt (BAND.hunt s), then is sent home to its den for good.
//   CATCH: an egg that falls out of the vault on his side (it would break on the yard) he scurries under and catches in
//     his sack instead: lost to the player until he is beaten, but never broken.
//   Never unwinnable: with eggs in his sack and nothing to steal he still goes fishing through a gap every BAND.tease s,
//     so there is always a paw to pinch. The target saved and only sack eggs left: the level ends as a win (sim.finish).
// Gentle (L6 is the sixth level of a casual game): a long telegraph, a wide pinch window (any turn of a few degrees),
// a slow grope, and a stone egg is too heavy for him.
import { RING_TH, wrap, clamp } from './geom.js';

const m3 = (easy, medium, hard) => ({ easy, medium, hard });
const D2R = Math.PI / 180;
export const BAND = {
  hp: 3,
  sneak: m3(0.45, 0.55, 0.65), // m/s tiptoeing along the yard
  peek: m3(1.6, 1.15, 0.95), // s the telegraph (eyes lock, the lip lick)
  shoot: 0.32, // s the arm shoots from his shoulder through the gap
  grope: m3(1.1, 1.5, 1.85), // m/s his paw along the channel floor
  near: m3(1.9, 2.3, 2.6), // m along the channel from the gap he gropes at most (a gap up to ~35 deg from the bottom reaches an egg resting there)
  yank: m3(1.5, 1.9, 2.3), // m/s back out with an egg
  back: 3.2, // m/s back out empty
  grip: 0.34, // m: the paw takes an egg this close
  strain: 1.1, // s tugging at a stone egg before he gives up
  stuff: 0.65, laugh: 1.0, miss: 0.5, huh: 0.8, // s
  hold: 0.38, // s the paw stays caught in the pinch
  hop: m3(2.4, 2.0, 1.6), // s hopping about with a red paw
  rest: m3(3.6, 2.6, 2.0), // s before he tries again
  dizzy: 1.3, whistle: 1.7, call: 0.55, // s; the weasel is called this far into the whistle
  hunt: m3(8, 10, 12), // s the weasel he whistles up hunts before it is sent home
  tease: m3(2, 2.5, 3), // s with eggs in his sack and nothing to steal before he goes fishing
  dash: m3(2.4, 2.8, 3.1), // m/s he scurries to catch an egg falling into his yard
  catchR: 0.55, catchH: 0.8, // m: he catches an egg this close to his sack's mouth (this high over the yard)
  spillT: 0.75, // s an egg flies from the burst sack back into the vault
  pinchW: 0.06, // m: the arm's half width (the gap edge pinches it inside len/2 - pinchW)
  knockV: 1.2, // m/s an egg must hit his paw with to hurt it
  hitCD: 0.8,
  zone: [-165, -97], // deg (world): gaps on this arc of the outer ring are within his reach
  tall: 1.22, // m (render/raccoon.js: 116 rig units at RACCOON_M 1.05)
  sh: [0.1, 0.55], // m: his shoulder from the point between his feet (forward, up)
  room: 0.55, // m he keeps from the basket's left rim
};
const IN = new Set(['reach', 'grope', 'strain', 'yank', 'tease', 'retract']); // the arm may be through the gap
const CATCH = new Set(['idle', 'sneak', 'peek', 'huh', 'miss', 'laugh', 'dash']); // he can run to catch a falling egg
const BUSY = new Set(['reach', 'grope', 'strain', 'yank', 'retract', 'stuff', 'pinch', 'yelp', 'dizzy', 'whistle', 'defeated', 'laugh', 'huh']);

export const banditMethods = {
  bandInit(L) {
    this.band = null;
    const R = L.raccoon;
    if (!R || this.rings.length < 2 || (this.gy || 1) < 0) return;
    const z = R.zone || BAND.zone, g = this.bandGeo(), hp = R.hp || BAND.hp;
    this.band = {
      ph: 'idle', t: R.delay ?? 3, dur: 1, x: g.home, face: 1, goal: g.home, gi: -1, ga: 0, ext: 0, arc: 0, tgt: 0, eid: 0, sack: [],
      hits: 0, hp, whistled: 0, wz: 0, wid: -1, cd: R.delay ?? 3, tease: 0, fz: 0, hitCD: 0, why: '', za: z[0] * D2R, zb: z[1] * D2R,
      pa: 0, p0: 0, spill: [], done: 0, end: '', odo: 0, sx: 0, sy: 0, held: 0,
    };
  },
  bandM(o) { return o[this.mode] ?? o.medium; },
  // the yard he walks: from under the vault's left side to the basket's left rim (minus his reach room)
  bandGeo() {
    const R = this.outerR, nl = this.nestX0 - (this.nestAmp || 0) - this.nestW / 2;
    const x1 = Math.min(nl - BAND.room, -R * 0.5), x0 = Math.min(x1 - 0.4, -R * 0.88);
    return { x0, x1, home: (x0 + x1) / 2, gy: this.groundY };
  },
  bandOuter() { return this.rings[this.rings.length - 1]; },
  bandRin() { const r = this.bandOuter(); return r.r - RING_TH / 2 - 0.24; }, // the paw's radius on the outer channel floor
  bandEggR() { const r = this.bandOuter(); return r.r - RING_TH / 2 - 0.3; },
  bandOk(g) { return g && g.o >= 0.5 && !g.grate && !(g.curtain && g.curtain.alive); },
  // the gap of the outer ring that the arm at world angle a still fits through (w: its half width)
  bandGapAt(a, w) {
    const ring = this.bandOuter(), ra = ring.body.getAngle();
    for (const g of ring.gaps) if (this.bandOk(g) && Math.abs(wrap(ra + g.a - a)) * ring.r < g.len / 2 - w) return g;
    return null;
  },
  bandShoulder(B) { return { x: B.x + BAND.sh[0] * B.face, y: this.groundY + BAND.sh[1] }; },
  // the arm's path: shoulder -> just outside the gap (G0) -> onto the channel floor (G1) -> along the floor (arc)
  bandPath(B) {
    const S = this.bandShoulder(B), ring = this.bandOuter(), ro = ring.r + RING_TH / 2 + 0.1, ri = this.bandRin(), c = Math.cos(B.ga), s = Math.sin(B.ga);
    const G0 = { x: ro * c, y: ro * s }, G1 = { x: ri * c, y: ri * s };
    const L1 = Math.hypot(G0.x - S.x, G0.y - S.y), L2 = ro - ri;
    return { S, G0, G1, L1, L2, ri };
  },
  bandPaw(B) {
    const P = this.bandPath(B);
    if (B.arc) return { x: P.ri * Math.cos(B.ga + B.arc), y: P.ri * Math.sin(B.ga + B.arc) };
    if (B.ext <= P.L1) { const k = clamp(B.ext / Math.max(1e-3, P.L1), 0, 1); return { x: P.S.x + (P.G0.x - P.S.x) * k, y: P.S.y + (P.G0.y - P.S.y) * k }; }
    const k = clamp((B.ext - P.L1) / P.L2, 0, 1);
    return { x: P.G0.x + (P.G1.x - P.G0.x) * k, y: P.G0.y + (P.G1.y - P.G0.y) * k };
  },
  bandIn(B) { const P = this.bandPath(B); return IN.has(B.ph) && B.ext > P.L1 + 0.08; }, // the paw is past the ring's outer face
  // his stance for a gap at world angle a: about 0.85 m left of (and below) the gap's mouth, inside the yard
  bandStance(a) { const g = this.bandGeo(), ro = this.bandOuter().r + RING_TH / 2 + 0.1; return clamp(ro * Math.cos(a) - 0.85, g.x0, g.x1); },
  bandInZone(a, B) { const w = wrap(a); return w >= B.za && w <= B.zb; },
  bandFit(e) { return this.reefFit(e) && !(e.fire > 0) && this.channelOf(e) === this.rings.length - 1; },
  // what to go for: a gap in his arc with an egg on the floor near it (nearest first); tease = with no egg (fishing)
  bandPlan(B, tease) {
    const ring = this.bandOuter(), ra = ring.body.getAngle(), ri = this.bandRin(), near = this.bandM(BAND.near);
    let best = null, fish = null;
    ring.gaps.forEach((g, gi) => {
      if (!this.bandOk(g) || g.len / 2 - BAND.pinchW < 0.12) return;
      const ga = wrap(ra + g.a);
      if (!this.bandInZone(ga, B)) return;
      const walk = Math.abs(this.bandStance(ga) - B.x);
      if (!fish || walk < fish.sc - 1e-9) fish = { gi, ga, e: 0, sc: walk };
      for (const e of this.aliveEggs()) {
        if (!this.bandFit(e)) continue;
        const p = e.body.getPosition(), d = Math.abs(wrap(Math.atan2(p.y, p.x) - ga)) * ri;
        if (d > near) continue;
        const sc = d + walk * 0.5;
        if (!best || sc < best.sc - 1e-9) best = { gi, ga, e: e.id, sc };
      }
    });
    return best || (tease ? fish : null); // fishing: the gap in his arc nearest him
  },
  bandSet(B, ph, t = 0) { B.ph = ph; B.t = B.dur = t; },
  bandGapA(B) { const ring = this.bandOuter(), g = ring.gaps[B.gi]; return g ? wrap(ring.body.getAngle() + g.a) : B.ga; },

  // ---------- every step (sim.js predStep)
  bandStep(dt) {
    const B = this.band;
    if (!B) return;
    const end = this.state !== 'play', X = this.bx && this.bx.boss;
    if (B.hitCD > 0) B.hitCD -= dt;
    this.bandSpillStep(B, dt);
    this.bandHolds(B);
    this.bandWeasel(B, dt);
    if (end) {
      if (!B.end) { this.bandLetGo(B, 'end'); B.end = this.state === 'winning' || this.state === 'won' ? 'win' : 'lose'; if (B.ph !== 'defeated') this.bandSet(B, B.end === 'win' ? 'huh' : 'laugh', 99); B.ext = 0; B.arc = 0; }
      return;
    }
    // the target is saved and only eggs in his sack (or the weasel's den) are left: the level ends as a win
    if (B.sack.length && this.savedLog.length >= (this.level.target || 1) && this.aliveEggs().every((e) => e.hc === 3 || e.thf === 2)) { this.finish(); return; }
    if (B.ph === 'defeated') return;
    // the frost: frozen solid where he stands (an arm in the vault too); a pinch still hurts him and thaws him
    const ice = X && X.stk > 0;
    if (ice || B.fz > 0) {
      if (!B.held) { B.held = 1; this.bandLetGo(B, 'cold'); this.emit('bandFreeze', this.bandHead(B)); }
      if (B.fz > 0) B.fz -= dt;
      if (this.bandIn(B) && !this.bandGapAt(B.ga, BAND.pinchW)) { B.fz = 0; if (X) X.stk = 0; this.bandOuch(B, 'pinch'); }
      return;
    }
    if (B.held) { B.held = 0; this.emit('bandThaw', this.bandHead(B)); if (IN.has(B.ph) || B.ph === 'reach') this.bandSet(B, 'retract'); }
    // dizzy (the rooster's crow, a strike, a power): he lets go and reels
    if (X && X.dizzy > 0 && !BUSY.has(B.ph) && B.ph !== 'stun') { this.bandLetGo(B, 'daze'); this.bandSet(B, 'stun', X.dizzy); this.emit('bandStun', this.bandHead(B)); }
    else if (X && X.dizzy > 0 && IN.has(B.ph)) { this.bandLetGo(B, 'daze'); this.bandSet(B, 'retract'); B.after = 'stun'; this.emit('bandStun', this.bandHead(B)); }
    // the Scarecrow: he keeps well away while it stands
    if (this.scareT > 0 && !BUSY.has(B.ph) && B.ph !== 'scared' && B.ph !== 'stun') { this.bandSet(B, 'scared'); B.tgt = 0; this.emit('bandScared', this.bandHead(B)); }
    else if (this.scareT > 0 && IN.has(B.ph)) { this.bandLetGo(B, 'scare'); this.bandSet(B, 'retract'); }
    // an egg saved startles him out of his telegraph
    if (X && X.flinch > 0.85 && B.ph === 'peek') { this.bandSet(B, 'huh', BAND.huh); B.cd = 1; this.emit('bandHuh', this.bandHead(B)); }
    if (B.cd > 0) B.cd -= dt;
    if (CATCH.has(B.ph) && B.ph !== 'dash') this.bandSpot(B);
    switch (B.ph) {
      case 'idle': case 'sneak': this.bandProwl(B, dt); break;
      case 'dash': this.bandDash(B, dt); break;
      case 'scared': { const g = this.bandGeo(); this.bandWalk(B, g.x0, dt, 1.4); if (!(this.scareT > 0)) { this.bandSet(B, 'idle'); B.cd = 0.8; } break; }
      case 'stun': if ((B.t -= dt) <= 0 && !(X && X.dizzy > 0)) { this.bandSet(B, 'idle'); B.cd = 1.2; } break;
      case 'peek': this.bandPeek(B, dt); break;
      case 'reach': {
        const P = this.bandPath(B);
        B.ext = Math.min(P.L1 + P.L2, B.ext + ((P.L1 + P.L2) / BAND.shoot) * dt);
        if (this.bandPinch(B)) break;
        if (B.ext >= P.L1 + P.L2 - 1e-6) this.bandSet(B, B.tgt ? 'grope' : 'tease', B.tgt ? 0 : 1.1);
        break;
      }
      case 'grope': case 'tease': this.bandGrope(B, dt); break;
      case 'strain': if (this.bandPinch(B) || this.bandKnock(B)) break; if ((B.t -= dt) <= 0) { this.emit('bandHeavy', this.bandPaw(B)); this.bandSet(B, 'retract'); B.cd = BAND.rest.medium; } break;
      case 'yank': case 'retract': this.bandYank(B, dt); break;
      case 'stuff':
        if ((B.t -= dt) <= 0) {
          const e = B.eid ? this.eggs.find((q) => q.id === B.eid && q.alive) : null;
          B.eid = 0;
          if (e) { e.hc = 3; B.sack.push(e.id); this.emit('bandStuff', { ...this.bandHead(B), egg: e, n: B.sack.length }); }
          this.bandSet(B, 'laugh', BAND.laugh);
        }
        break;
      case 'laugh': case 'huh': case 'miss': if ((B.t -= dt) <= 0) { const huh = B.ph === 'huh'; this.bandSet(B, 'idle'); B.cd = Math.max(B.cd, huh ? 1 : this.bandM(BAND.rest)); } break;
      case 'pinch': if ((B.t -= dt) <= 0) { this.bandSet(B, 'yelp', this.bandM(BAND.hop)); } break;
      case 'yelp':
        B.ext = Math.max(0, B.ext - 6 * dt); B.arc = 0;
        if ((B.t -= dt) <= 0) {
          if (B.hits >= B.hp) { this.bandSet(B, 'dizzy', BAND.dizzy); this.emit('bandDizzy', this.bandHead(B)); }
          else if (B.hits >= 2 && !B.whistled && this.bandWeaselT()) { this.bandSet(B, 'whistle', BAND.whistle); B.whistled = 1; }
          else { this.bandSet(B, 'idle'); B.cd = this.bandM(BAND.rest); }
        }
        break;
      case 'whistle':
        if (B.wz === 0 && B.dur - B.t >= BAND.call) this.bandCall(B);
        if ((B.t -= dt) <= 0) { if (!B.wz) this.bandCall(B); this.bandSet(B, 'idle'); B.cd = this.bandM(BAND.rest); }
        break;
      case 'dizzy': if ((B.t -= dt) <= 0) this.bandDefeat(B); break;
    }
    if (B.ph !== 'grope' && B.ph !== 'tease' && B.ph !== 'reach' && B.ph !== 'strain' && B.ph !== 'yank' && B.ph !== 'pinch' && B.ph !== 'yelp' && B.ph !== 'retract') { B.ext = 0; B.arc = 0; }
  },
  bandHead(B) { return { x: B.x, y: this.groundY + BAND.tall * 0.8 }; },
  bandWalk(B, gx, dt, k = 1) {
    const d = gx - B.x;
    if (Math.abs(d) < 0.02) { B.x = gx; return 0; }
    const v = this.bandM(BAND.sneak) * k * dt;
    B.face = d > 0 ? 1 : -1;
    B.x += clamp(d, -v, v); B.odo += Math.min(Math.abs(d), v);
    return Math.abs(gx - B.x);
  },
  bandProwl(B, dt) {
    if (B.cd > 0) { B.ph = 'idle'; B.face = 1; return; } // catching his breath
    let P = this.bandPlan(B, false);
    if (!P && B.sack.length) { B.tease += dt; if (B.tease >= this.bandM(BAND.tease)) P = this.bandPlan(B, true); } else B.tease = 0;
    if (!P) { const g = this.bandGeo(); if (this.bandWalk(B, g.home, dt, 0.6) < 0.02) { B.ph = 'idle'; B.face = 1; } else B.ph = 'sneak'; B.tgt = 0; return; }
    B.gi = P.gi; B.tgt = P.e; B.ga = P.ga;
    const left = this.bandWalk(B, this.bandStance(P.ga), dt);
    B.ph = left > 0.02 ? 'sneak' : 'idle';
    if (left <= 0.02) { B.face = 1; B.p0 = P.ga; this.bandSet(B, 'peek', this.bandM(BAND.peek)); this.emit('bandPeek', { ...this.bandHead(B), ga: P.ga }); }
  },
  bandPeek(B, dt) {
    const ring = this.bandOuter(), g = ring.gaps[B.gi], ga = this.bandGapA(B);
    // the gap turned away while he licked his lips: he lost it
    if (!this.bandOk(g) || Math.abs(wrap(ga - B.p0)) * ring.r > 0.35 || !this.bandInZone(ga, B)) { this.bandSet(B, 'huh', BAND.huh); B.cd = 0.6; this.emit('bandHuh', this.bandHead(B)); return; }
    B.ga = ga;
    if (B.tgt) { const e = this.eggs.find((q) => q.id === B.tgt); if (!e || !this.bandFit(e)) { const P = this.bandPlan(B, !!B.sack.length); B.tgt = P && P.gi === B.gi ? P.e : 0; if (!B.tgt && !B.sack.length) { this.bandSet(B, 'idle'); B.cd = 0.5; return; } } }
    if ((B.t -= dt) <= 0) { B.ga = ga; B.ext = 0; B.arc = 0; B.tease = 0; this.bandSet(B, 'reach'); this.emit('bandReach', { ...this.bandPaw(B), gx: Math.cos(ga) * ring.r, gy: Math.sin(ga) * ring.r }); }
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
        this.reefTake(e, 2); B.eid = e.id; B.sx = p.x; B.sy = p.y; B.face = 1;
        this.bandSet(B, 'stuff', BAND.stuff);
        this.emit('bandCatch', { x: p.x, y: p.y, egg: e });
        return;
      }
    }
    if (!e || !e.body.isActive() || e.hc || e.body.getPosition().y < this.groundY + 0.2) { this.bandSet(B, 'idle'); B.cd = 0.4; B.tgt = 0; return; }
    const d = B.goal - B.x, v = this.bandM(BAND.dash) * dt;
    if (Math.abs(d) > 0.01) { B.face = d > 0 ? 1 : -1; B.x += clamp(d, -v, v); B.odo += Math.min(Math.abs(d), v); }
  },
  bandGrope(B, dt) {
    if (this.bandPinch(B) || this.bandKnock(B)) return;
    const ri = this.bandRin(), max = this.bandM(BAND.near) / ri;
    let goal = B.arc;
    const q = B.tgt ? this.eggs.find((x) => x.id === B.tgt) : null;
    if (q && this.bandFit(q)) { const p = q.body.getPosition(); goal = clamp(wrap(Math.atan2(p.y, p.x) - B.ga), -max, max); }
    else if (B.ph === 'tease') goal = Math.sin((1.1 - B.t) * 5) * 0.25 / ri * 2;
    const st = (this.bandM(BAND.grope) * dt) / ri;
    B.arc += clamp(goal - B.arc, -st, st);
    const paw = this.bandPaw(B);
    const e = this.aliveEggs().find((x) => this.bandFit(x) && Math.hypot(x.body.getPosition().x - paw.x, x.body.getPosition().y - paw.y) < BAND.grip);
    if (e) {
      if (e.stone > 0) { this.bandSet(B, 'strain', BAND.strain); B.tgt = e.id; this.emit('bandStrain', { ...paw, egg: e }); return; } // too heavy: he tugs and gives up
      this.reefTake(e, 2); B.eid = e.id; const p = e.body.getPosition(); B.sx = p.x; B.sy = p.y;
      this.bandSet(B, 'yank'); this.emit('bandGrab', { ...paw, egg: e, golden: e.golden ? 1 : 0 });
      return;
    }
    if (B.ph === 'tease') { if ((B.t -= dt) <= 0) { this.bandSet(B, 'retract'); B.after = 'miss'; } return; }
    if (!q || !this.bandFit(q) || Math.abs(goal - B.arc) < 1e-3 || Math.abs(B.arc) >= max - 1e-3) { this.bandSet(B, 'retract'); B.after = 'miss'; this.emit('bandMiss', paw); }
  },
  bandYank(B, dt) {
    const P = this.bandPath(B), v = B.ph === 'yank' ? this.bandM(BAND.yank) : BAND.back;
    if (B.arc) { const st = (v * dt) / P.ri; B.arc = Math.abs(B.arc) <= st ? 0 : B.arc - Math.sign(B.arc) * st; }
    else B.ext = Math.max(0, B.ext - v * 1.4 * dt);
    if (this.bandPinch(B)) return; // empty or not, an arm through the gap is pinched
    if (B.ph === 'yank' && this.bandKnock(B)) return;
    if (B.ext <= 0 && !B.arc) {
      if (B.ph === 'yank' && B.eid) { this.bandSet(B, 'stuff', BAND.stuff); return; }
      const a = B.after; B.after = '';
      if (a === 'stun') { const X = this.bx && this.bx.boss; this.bandSet(B, 'stun', Math.max(0.5, X ? X.dizzy : 1)); }
      else if (a === 'miss') { this.bandSet(B, 'miss', BAND.miss); B.cd = this.bandM(BAND.rest) * 0.6; }
      else { this.bandSet(B, 'idle'); B.cd = Math.max(B.cd, 0.8); }
    }
  },
  // the egg in his paw rides it; the eggs in his sack ride the sack (outside the vault, out of the world)
  bandHolds(B) {
    if (B.eid) {
      const e = this.eggs.find((q) => q.id === B.eid);
      if (!e || !e.alive || e.saved) B.eid = 0;
      else {
        const p = B.ph === 'stuff' ? this.bandSackPt(B, 0) : this.bandPaw(B), k = B.sx != null ? 0.35 : 1;
        const x = B.sx != null ? B.sx + (p.x - B.sx) * k : p.x, y = B.sy != null ? B.sy + (p.y - B.sy) * k : p.y;
        B.sx = null; B.sy = null;
        this.bandPin(e, x, y);
      }
    }
    B.sack = B.sack.filter((id) => this.eggs.some((q) => q.id === id && q.alive && !q.saved));
    B.sack.forEach((id, i) => { const e = this.eggs.find((q) => q.id === id), p = this.bandSackPt(B, i + 1); this.bandPin(e, p.x, p.y); });
  },
  bandSackPt(B, i) { return { x: B.x - 0.3 * B.face + (i % 2 ? 0.08 : -0.08), y: this.groundY + 0.42 + 0.04 * i }; },
  bandPin(e, x, y) {
    const b = e.body;
    b.setTransform({ x, y }, 0.3);
    b.setLinearVelocity({ x: 0, y: 0 }); b.setAngularVelocity(0);
    e.ch = this.channelOf(e); e.freefall = 0; e.drop = 0;
  },
  // drop what he holds where his paw is: inside the vault on the outer channel floor (never outside)
  bandLetGo(B, why) {
    const e = B.eid ? this.eggs.find((q) => q.id === B.eid) : null;
    B.eid = 0; B.sx = null; B.sy = null;
    if (!e || !e.alive) return null;
    const ri = this.bandEggR(), a = B.ga + B.arc, x = ri * Math.cos(a), y = ri * Math.sin(a);
    e.body.setTransform({ x, y }, e.body.getAngle());
    this.reefFree(e, 0, 0, 0.9);
    this.emit('bandDrop', { x, y, egg: e, why });
    return e;
  },
  // the gap edge closes on his arm: the gap he reached through no longer covers the arm's crossing
  bandPinch(B) {
    if (!this.bandIn(B) || this.bandGapAt(B.ga, BAND.pinchW)) return false;
    this.bandOuch(B, 'pinch');
    return true;
  },
  // a fast egg, a burning egg or a busy chick knocks his paw (or the arm on the floor) inside the vault
  bandKnock(B) {
    if (B.hitCD > 0 || !this.bandIn(B)) return false;
    const pts = this.bandArmIn(B);
    for (const e of this.aliveEggs()) {
      if (!e.body.isActive() || e.hc) continue;
      const p = e.body.getPosition(), v = e.body.getLinearVelocity(), sp = Math.hypot(v.x, v.y);
      if (!pts.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 0.34)) continue;
      if (e.fire > 0) { this.bandOuch(B, 'hot'); return true; }
      if (sp > BAND.knockV || (e.chick && sp > 0.6)) { this.bandOuch(B, e.chick ? 'peck' : 'bump'); return true; }
    }
    return false;
  },
  bandArmIn(B) {
    const P = this.bandPath(B), out = [];
    const k = clamp((B.ext - P.L1) / P.L2, 0, 1);
    if (k > 0) out.push({ x: P.G0.x + (P.G1.x - P.G0.x) * k, y: P.G0.y + (P.G1.y - P.G0.y) * k });
    const m = Math.ceil((Math.abs(B.arc) * P.ri) / 0.25);
    for (let i = 0; i <= m; i++) { const a = B.ga + (B.arc * i) / Math.max(1, m); out.push({ x: P.ri * Math.cos(a), y: P.ri * Math.sin(a) }); }
    return out;
  },
  // one hurt: a pinch, a knock, a zap, a flash. He yelps and drops what he holds; three and he is beaten.
  bandOuch(B, why) {
    if (B.hitCD > 0 || B.done) return false;
    const paw = this.bandPaw(B);
    this.bandLetGo(B, why);
    B.hits++; B.hitCD = BAND.hitCD; B.why = why; B.tgt = 0; B.tease = 0;
    const X = this.bx && this.bx.boss;
    if (X) X.flinch = 0.9;
    this.bandSet(B, 'pinch', why === 'pinch' ? BAND.hold : 0.2);
    this.emit('bandPinch', { ...paw, why, hits: B.hits, hp: B.hp, left: Math.max(0, B.hp - B.hits), hx: B.x, hy: this.groundY + BAND.tall * 0.8 });
    return true;
  },
  bandDefeat(B) {
    B.done = 1; B.t0 = this.t; this.bandSet(B, 'defeated', 1e9); B.ext = 0; B.arc = 0;
    const X = this.bx && this.bx.boss;
    if (X) { X.atk = null; X.t = 1e9; }
    // the sack bursts: every egg flies back into the outer channel, onto floor clear of a gap (nearest the bottom first)
    const ring = this.bandOuter(), ra = ring.body.getAngle(), ri = this.bandEggR(), used = [];
    const free = (a) => !ring.gaps.some((g) => Math.abs(wrap(ra + g.a - a)) * ring.r < g.len / 2 + 0.42) && !used.some((u) => Math.abs(wrap(u - a)) * ri < 0.62);
    const S = this.bandSackPt(B, 0);
    B.sack.splice(0).forEach((id) => {
      let a = -Math.PI / 2;
      for (let k = 0; k < 40; k++) { const c = -Math.PI / 2 + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 6 * D2R; if (free(c)) { a = c; break; } }
      used.push(a);
      B.spill.push({ id, t: 0, x0: S.x, y0: S.y, x1: ri * Math.cos(a), y1: ri * Math.sin(a) });
    });
    this.emit('bandDefeat', { ...this.bandHead(B), n: B.spill.length });
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
    if (['prowl', 'stalk', 'idle', 'in', 'laugh'].includes(T.ph) && !T.eid && this.state === 'play') this.thGoHome(T);
  },

  // ---------- hooks: boss.js (pose, bar), animalsHit, the glow flash
  bandBossPose(X) { const B = this.band; if (!B) return; X.x = B.x; X.y = this.groundY + BAND.tall * 0.55; X.face = B.face; },
  bandBossBar() {
    const B = this.band;
    if (!B) return null;
    const left = Math.max(0, B.hp - B.hits), ph = B.ph;
    const label = B.done ? 'BAGGED!' : ph === 'peek' ? 'HE’S LOOKING!' : IN.has(ph) && this.bandIn(B) ? 'TURN THAT RING!' : ph === 'pinch' || ph === 'yelp' ? 'PINCHED!'
      : ph === 'whistle' ? 'WHISTLE!' : B.eid ? 'GOT ONE!' : B.sack.length ? `${B.sack.length} IN HIS SACK` : 'PINCH HIS PAW';
    return { hp: left, hpMax: B.hp, ph: ph === 'pinch' || ph === 'yelp' ? 'trapped' : ph === 'peek' ? 'crouch' : B.done ? 'defeated' : ph, label, eid: B.eid };
  },
  // weather, bosses and powers: kind 'flash' 'bolt' 'quake' 'gust' 'rock' 'lava' 'ice'; o {x, y, r}
  bandHit(kind, o = {}) {
    const B = this.band;
    if (!B || B.done || this.state !== 'play') return 0;
    const r = o.r ?? Infinity, paw = this.bandPaw(B), h = this.bandHead(B), X = this.bx && this.bx.boss;
    const nearPaw = r === Infinity || Math.hypot(paw.x - (o.x ?? 0), paw.y - (o.y ?? 0)) < r + 0.3;
    const nearBody = r === Infinity || Math.hypot(h.x - (o.x ?? 0), h.y - (o.y ?? 0)) < r + 0.6;
    if ((kind === 'flash' || kind === 'bolt') && this.bandIn(B) && nearPaw) { this.bandOuch(B, kind === 'bolt' ? 'zap' : 'flash'); return 1; }
    if (kind === 'gust' || !nearBody) return 0;
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
    if (B.tgt === e.id && (B.ph === 'peek' || B.ph === 'reach' || B.ph === 'grope')) return 0.55;
    return 0;
  },
  bandScore() { const B = this.band; return B ? 450 * B.hits + (B.done ? 300 : 0) + (B.ph === 'pinch' || B.ph === 'yelp' ? 100 : 0) : 0; },

  // ---------- state
  bandState() { return this.band ? JSON.parse(JSON.stringify(this.band)) : null; },
  bandLoad(S) {
    this.band = S ? JSON.parse(JSON.stringify(S)) : this.band;
    if (this.band) for (const e of this.eggs) if (e.hc && e.body) e.body.setActive(false);
  },
};
