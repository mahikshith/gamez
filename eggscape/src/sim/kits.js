// MAMA RACCOON AND HER KITS (0.8.18, a second way the raccoon plays; level.kits = { delay, n, costume }). Mixed into Sim
// (sim.js: Object.assign(Sim.prototype, kitMethods)), so `this` is the Sim. All state is plain data in this.kit (and the
// eggs' hc marks: 2 = carried by the kits, 3 = in mama's sack, as Bandit's), copied by kitState() / restored by kitLoad(),
// so rewind, the planner and the hint stay exact. No randomness at all.
//
// The owner (0.8.18): "the raccoon would open its bag and baby raccoons would come out, and the baby raccoons would follow
// the bird or the eggs, and 2 or 3 baby raccoons would fetch the egg and slowly move it towards the mama raccoon ... users
// will have to do something about that and get away from those baby raccoons. And mama raccoon will give a different kind
// of expression."
//   MAMA (K.ph): she walks in on the yard from the left (walk), sits by her sack at the yard's far end and unties it with a
//     flourish (untie): the kits tumble out. While they work she watches (watch); an egg home: smug (smug); the kits back
//     from a failed fetch: she comforts the crying one (comfort, after a tumble or a dive) or scolds the clumsy one (scold,
//     after a dangle). Then a rest and she sends them again. KITS.fails failed fetches (Easy fewer) and she gives up
//     (sulk): she scoops them into the sack, the eggs in it pop out and roll back into the vault, and she trudges off
//     (leave, gone).
//   THE KITS (one crew, K.g; the art spreads 2 or 3 of them along the floor, each with its own timing): out of the sack
//     (pop), across the yard (run), a little kit tower over the outer ring's rim at mama's side (climbIn), then along the
//     channel floors toward the outermost loose egg (go): up through a gap of the ring above them (up), across a hole in
//     their floor (hop), down through a gap of their own floor (down). At the egg they gather and heave (lift), then
//     carry it together, slowly, back the same way (carry, down) to the outer floor at mama's side, over the rim (out) and
//     across the yard (yard) into her sack. Caught there, never broken.
//   THE PLAYER (wordless; the lesson 'kits' in engine/teach.js): turn the ring they walk on briskly (KITS.shake deg
//     within about KITS.shakeTau s, either way) or tip them too far up its side and they TUMBLE: the egg drops back on the
//     floor, they sit dizzy, then run home crying. A gap turned under them: they DANGLE by their tails from its edge and the
//     egg drops on through it (onto the floor below; out of the vault only over the basket or mama's sack, else they
//     fumble it onto the floor beside the gap), then they scramble home. Papa Rooster's crow, a glow flash or a bolt by
//     them: they DIVE back into the sack. Each is a failed fetch.
//   Mama on the yard also holds her sack out for an egg falling out of the vault her side (caught, not broken).
//   Never unwinnable: the eggs in her sack pop back out when she gives up, and she gives up early at a fair moment (the
//     eggs left outside her sack could no longer make the target); the target saved and only sack eggs left ends the
//     level as a win (sim.finish).
import { RING_TH, EGG_W, wrap, clamp } from './geom.js';
import { dynOf, tellS } from '../data/dynamism.js';

const m3 = (easy, medium, hard) => ({ easy, medium, hard });
const D2R = Math.PI / 180;
const ss = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
const DOWN = -Math.PI / 2;
export const KITS = {
  n: m3(2, 3, 3), // kits in the sack
  fails: m3(2, 3, 3), // failed fetches before mama gives up
  delay: 6, // s into the level she walks in (level.kits.delay)
  stroll: 1.4, // m/s mama walking in / off (0.8.19 feel: she bustles in, the kits are out sooner)
  untie: 2.2, untie2: 1.3, // s the flourish (first time / later), the kits tumble out at UNTIE_POP of it
  pop: 1.5, // s tumbling out, shaking themselves, sniffing
  run: 1.1, // m/s across the yard
  climbIn: 1.4, // s the kit tower over the rim
  walk: m3(0.5, 0.62, 0.72), // m/s along a floor, empty-handed (0.8.19 feel: they scamper straight for an egg)
  carry: m3(0.28, 0.32, 0.4), // m/s with an egg (0.8.19 feel: a hurried heave, about 6 s on Medium; faster and a gap turned under them gently could never catch them)
  up: 0.75, down: 0.9, hop: 0.6, // s a crossing up through a gap / down through one / a hop over a hole
  lift: 1.25, // s gathering round the egg and heaving (the telegraph; 0.8.19: x DYN.kits tell, see kitTell)
  out: 1.8, // s over the rim with the egg and down to the yard
  smug: 2.0, comfort: 2.6, scold: 2.0, // s (comfort: a held hug the player can see)
  rest: 3.2, // s mama waits before she sends them again (0.8.19: x DYN.kits rest / the menace heat)
  tumble: 2.0, dangle: 1.6, dive: 0.8, flee: 1.3, // s (tumble: a roll, a held dizzy sit, up again)
  wail: 0.55, // s a crying kit stands and wails before he runs home (after a tumble or a dangle)
  shake: m3(0.4, 0.55, 0.65), // their ring turned either way (a leaky sum) past this share of what a full-speed turn of it
  // adds up to: at full speed about 0.5 / 0.8 / 1.05 s of turning tumbles them; a slow turn never does
  shakeTau: 1.0,
  arc: 64, // deg either side of the bottom they walk on a floor
  lean: 0.5, // m from an egg they heave it
  sulk: 2.4, // s scooping the kits into the sack (the eggs pop out at its middle)
  spillT: 0.75, // s an egg flies from the sack back into the vault
  catchR: 0.85, catchH: 1.2, // m: an egg falling out of the vault this close to her sack (this low) is caught
  ride: 0.08, // m the carried egg's centre over its floor-lying spot
};
export const UNTIE_POP = 0.45;
export const SCAMP = [0.62, 0.7, 1.3, 0.33];
const EXIT = -122 * D2R; // the spot on the outer floor at mama's side (over the rim from her yard)
const MAMA_PH = new Set(['watch', 'smug', 'comfort', 'scold', 'rest', 'untie']); // she is at her spot with the sack
const FLOOR = new Set(['go', 'lift', 'carry', 'tumble', 'dangle']);
const WORK = new Set(['go', 'lift', 'carry']);
const KSKIP = 1.0; // s 0.8.19: they shun the egg they wanted after the player turned their floor under them

export const kitMethods = {
  kitInit(L) {
    this.kit = null;
    const S = L.kits;
    if (!S || this.rings.length < 2 || (this.gy || 1) < 0 || L.shape) return;
    const g = this.kitGeo(), n = S.n || this.kitM(KITS.n);
    this.kit = {
      ph: 'wait', t: S.delay ?? KITS.delay, dur: 1, x: g.x0 - 2.6, face: 1, n, fails: 0, max: S.fails || this.kitM(KITS.fails), trips: 0, home: 0,
      sack: [], spill: [], done: 0, end: '', why: '', t0: 0, costume: S.costume || '',
      g: { ph: 'sack', t: 0, dur: 1, c: -1, a: 0, x: g.sack, y: this.groundY, ra: 0, fl: 0, dir: -1, eid: 0, tgt: 0, wait: 0, odo: 0, from: null, gi: -1, gr: -1, why: '', p: null },
    };
  },
  kitM(o) { return o[this.mode] ?? o.medium; },
  // the yard: mama sits at its far (left) end with her sack to her right, toward the vault
  kitGeo() {
    const R = this.outerR, nl = this.nestX0 - (this.nestAmp || 0) - this.nestW / 2;
    // her sack sits just under the way in (EXIT, on the lower left of the vault), clear of the basket; she sits at its
    // left, inside a phone's portrait frame (2026-11-26: at -0.88 R she was cut by the screen's edge)
    const sack = Math.min(nl - 0.8, -R * 0.5), x0 = sack - 0.72, x1 = sack + 0.4;
    return { x0, x1, mama: x0 + 0.1, sack, gy: this.groundY };
  },
  kitSet(o, ph, t = 0) { o.ph = ph; o.t = o.dur = t; },
  kitU(o) { return clamp(1 - o.t / Math.max(1e-3, o.dur), 0, 1); },
  // ---------- the floors: ring c's inner face; the kits walk its lower part only
  kitFloor(c) { return this.rings[c].r - RING_TH / 2; },
  kitPt(c, a, h = 0) { const r = this.kitFloor(c) - h; return { x: r * Math.cos(a), y: r * Math.sin(a) }; },
  kitArcOk(a, extra = 0) { return Math.abs(wrap(a - DOWN)) <= (KITS.arc + extra) * D2R; },
  kitClampArc(a) { const d = clamp(wrap(a - DOWN), -KITS.arc * D2R, KITS.arc * D2R); return DOWN + d; },
  kitSolid(c, a, m = 0) { // is ring c's floor solid at angle a (and m metres either side)?
    const ring = this.rings[c], r = this.kitFloor(c), da = m / r;
    for (const k of m ? [-1, 0, 1] : [0]) { const q = a + k * da; if (!this.solidAt(ring, r * Math.cos(q), r * Math.sin(q))) return false; }
    return true;
  },
  kitHole(c, a) { const ring = this.rings[c], r = this.kitFloor(c); return !this.solidAt(ring, r * Math.cos(a), r * Math.sin(a)); },
  // the open gaps of ring i: world angle and half its angular width
  kitGaps(i) {
    const ring = this.rings[i], ra = ring.body.getAngle();
    return ring.gaps.map((g, gi) => ({ gi, a: wrap(ra + g.a), half: g.len / (2 * ring.r), ok: this.snakeGap(g) })).filter((g) => g.ok);
  },
  kitGapA(i, gi) { const ring = this.rings[i], g = ring.gaps[gi]; return g ? wrap(ring.body.getAngle() + g.a) : 0; },
  // the nearest solid floor of ring c to angle a (within about 50 deg), else a
  kitNearSolid(c, a, m = 0.18) {
    if (this.kitSolid(c, a, m)) return a;
    const r = this.kitFloor(c);
    for (let k = 1; k < 60; k++) for (const s of [1, -1]) { const q = a + s * k * (0.05 / r); if (this.kitSolid(c, q, m)) return q; }
    return a;
  },
  // ---------- where the crew is (world): its floor point, or its own x / y off the floors
  kitBody(G = this.kit && this.kit.g, h = 0.2) {
    if (!G) return { x: 0, y: 0 };
    if (FLOOR.has(G.ph) || (G.ph === 'up' || G.ph === 'down' || G.ph === 'hop')) { if (G.p) return { x: G.p.x, y: G.p.y }; return this.kitPt(G.c, G.a, h); }
    return { x: G.x, y: G.y + h };
  },
  kitOut(G) { return G.ph !== 'sack' && G.ph !== 'pop'; },
  // the egg they fetch: the outermost loose egg in the vault (they come in from outside), then the nearest along the floor
  kitFit(e) { return this.reefFit(e) && !(e.fire > 0) && !(e.stone > 0) && this.channelOf(e) < this.rings.length; },
  // 0.8.19 their temper (data/dynamism.js) and the menace engine (sim/menace.js)
  kitD() { return dynOf(this, 'kits'); },
  kitRest(v) { return (v * this.kitD().rest) / this.menaceHeat(); },
  kitTell(v) { return tellS(v, this.kitD().tell) * this.menaceTell(); },
  kitQuick(v) { return v / (this.kitD().tempo * this.menaceHeat()); },
  // scampers, not a glide: a dart (SCAMP[1] of every SCAMP[0] s at SCAMP[2]x), then a check (SCAMP[3]x); the mean about 1x.
  // From the clock only (deterministic); the carry staggers on the same beat
  kitScamp() { const u = (this.t / SCAMP[0]) % 1; return u < SCAMP[1] ? SCAMP[2] : SCAMP[3]; },
  kitPick(G) {
    let best = null, bc = -1, bd = 1e9;
    for (const e of this.aliveEggs()) {
      if (!this.kitFit(e)) continue;
      const c = this.channelOf(e), p = e.body.getPosition(), d = Math.abs(wrap(Math.atan2(p.y, p.x) - G.a));
      if (G.skipT > 0 && e.id === G.skip && best) continue; // (shunned while another will do)
      if (c > bc || (c === bc && d < bd - 1e-9) || (best && G.skipT > 0 && best.id === G.skip)) { best = e; bc = c; bd = d; }
    }
    return best;
  },
  kitLoose() { return this.aliveEggs().filter((e) => this.kitFit(e)).length; },

  // ---------- every step (sim.js predStep)
  kitStep(dt) {
    const K = this.kit;
    if (!K) return;
    this.kitSpillStep(K, dt);
    this.kitHolds(K);
    const G = K.g;
    if (this.state !== 'play') {
      if (!K.end) {
        K.end = this.state === 'winning' || this.state === 'won' ? 'win' : 'lose';
        this.kitLetGo(G, 'end');
        if (this.kitOut(G) && G.ph !== 'flee') this.kitFlee(G, 'end');
      }
      if (G.ph === 'flee') this.kitFleeStep(K, G, dt, true);
      return;
    }
    // the target is saved and only eggs in her sack are left: the level ends as a win
    if (K.sack.length && this.savedLog.length >= (this.level.target || 1) && this.aliveEggs().every((e) => e.hc === 3 || e.thf === 2)) { this.finish(); return; }
    if (G.skipT > 0) G.skipT -= dt;
    if (G.pace > 0) G.pace -= dt;
    // 0.8.19 the player's last move: their floor ring turned while they go for an egg: they switch egg (KSKIP s)
    // (only when that pays: another egg on their floor now lies nearer than the one they wanted)
    if (G.ph === 'go' && G.tgt && !(G.skipT > 0) && this.menaceTurned(G.c, 0.25)) {
      const cur = this.eggs.find((q) => q.id === G.tgt), dc = cur && this.channelOf(cur) === G.c ? this.kitDist(G, cur) : 1e9;
      const alt = this.aliveEggs().find((e) => e.id !== G.tgt && this.kitFit(e) && this.channelOf(e) === G.c && this.kitDist(G, e) < dc - 0.3);
      if (alt) { G.skip = G.tgt; G.skipT = KSKIP; G.tgt = 0; this.emit('kitSwitch', this.kitBody(G)); }
    }
    this.kitMama(K, dt);
    this.kitCrew(K, G, dt);
    if (!(G.ph === 'lift' || G.eid) && this.menaceHolds('kits')) this.menaceDone('kits', 'fetch', 0); // the fetch is over
    if (MAMA_PH.has(K.ph)) this.kitCatch(K);
  },
  // ---------- mama
  kitMama(K, dt) {
    const g = this.kitGeo();
    switch (K.ph) {
      case 'wait': if ((K.t -= dt) <= 0) { this.kitSet(K, 'walk'); this.emit('kitWalk', { x: K.x, y: this.groundY + 1 }); } break;
      case 'walk': {
        const d = g.mama - K.x, v = KITS.stroll * dt;
        K.face = 1; K.x += clamp(d, -v, v);
        if (Math.abs(g.mama - K.x) < 1e-3) { K.x = g.mama; this.kitSet(K, 'untie', KITS.untie); this.emit('kitUntie', this.kitHead()); }
        break;
      }
      case 'untie':
        if (K.g.ph === 'sack' && this.kitU(K) >= UNTIE_POP) this.kitPop(K);
        if ((K.t -= dt) <= 0) this.kitSet(K, 'watch', 1e9);
        break;
      case 'smug': case 'comfort': case 'scold':
        if ((K.t -= dt) <= 0) this.kitNext(K);
        break;
      case 'rest':
        if (this.scareT > 0) break; // the Scarecrow: she keeps them in the sack while it stands
        if ((K.t -= dt) <= 0) this.kitNext(K, true);
        break;
      case 'sulk':
        if (!K.spilled && this.kitU(K) >= 0.5) { K.spilled = 1; this.kitSpillAll(K); }
        if ((K.t -= dt) <= 0) { this.kitSet(K, 'leave'); this.emit('kitLeave', this.kitHead()); }
        break;
      case 'leave': K.face = -1; K.x -= KITS.stroll * 0.75 * dt; if (K.x < g.x0 - 3) { this.kitSet(K, 'gone'); K.done = 1; } break;
    }
  },
  // after a reaction or a rest: give up, or send them again
  kitNext(K, go = false) {
    const saved = this.savedLog.length, loose = this.kitLoose(), tg = this.level.target || 1;
    const fair = K.sack.length && saved + loose < tg; // the eggs outside her sack can no longer make the target
    if (K.fails >= K.max || fair || (!loose && K.sack.length)) { this.kitSulk(K, fair ? 'fair' : K.fails >= K.max ? 'fails' : 'empty'); return; }
    if (!go) { this.kitSet(K, 'rest', this.kitRest(KITS.rest)); return; }
    if (!loose) { K.t = 1.0; return; } // nothing to fetch: she waits
    this.kitSet(K, 'untie', this.kitRest(KITS.untie2)); this.emit('kitUntie', this.kitHead());
  },
  kitSulk(K, why) { K.why = why; K.spilled = 0; this.kitSet(K, 'sulk', KITS.sulk); this.emit('kitSulk', { ...this.kitHead(), why, n: K.sack.length }); },
  kitHead() { const K = this.kit; return { x: K.x, y: this.groundY + 1.7 }; },
  kitSackPt(K, i = 0) { const g = this.kitGeo(); return { x: g.sack + (i % 2 ? 0.08 : -0.08), y: this.groundY + 0.42 + 0.04 * i }; },
  kitPop(K) {
    const G = K.g, g = this.kitGeo();
    G.x = g.sack; G.y = this.groundY; G.c = -1; G.eid = 0; G.tgt = 0; G.why = ''; G.p = null; K.trips++;
    this.kitSet(G, 'pop', this.kitRest(KITS.pop));
    this.emit('kitPop', { x: g.sack, y: this.groundY + 0.4, n: K.n });
  },
  // ---------- the crew
  kitCrew(K, G, dt) {
    if (G.ph === 'sack') return;
    if (G.ph === 'flee') { this.kitFleeStep(K, G, dt); return; }
    // the Scarecrow: they bolt for the sack (not a failed fetch)
    if (this.scareT > 0 && G.ph !== 'pop') { this.kitDive(G, 'scare'); return; }
    if (FLOOR.has(G.ph)) { if (this.kitRide(G, dt)) return; }
    const g = this.kitGeo(), n = this.rings.length;
    switch (G.ph) {
      case 'pop': if ((G.t -= dt) <= 0) { this.kitSet(G, 'run'); this.emit('kitRun', { x: G.x, y: G.y }); } break;
      case 'run': {
        const P = this.kitPt(n - 1, EXIT), gx = clamp(P.x - 0.15, g.x0, g.x1 + 0.4), d = gx - G.x, v = KITS.run * this.kitD().tempo * this.menaceHeat() * dt;
        G.x += clamp(d, -v, v); G.odo += Math.min(Math.abs(d), v); G.y = this.groundY; G.dir = d >= 0 ? 1 : -1;
        if (Math.abs(gx - G.x) < 1e-3) { G.from = { x: G.x, y: G.y }; this.kitSet(G, 'climbIn', this.kitQuick(KITS.climbIn)); this.emit('kitClimb', { ...P, ring: n - 1 }); }
        break;
      }
      case 'climbIn': {
        const u = this.kitU(G), P = this.kitPt(n - 1, EXIT, 0.2), F = G.from, k = ss(0, 1, u);
        G.x = F.x + (P.x - F.x) * k; G.y = F.y + (P.y - F.y) * k + 0.6 * Math.sin(u * Math.PI);
        if ((G.t -= dt) <= 0) { G.c = n - 1; G.a = this.kitNearSolid(n - 1, EXIT); G.ra = this.rings[n - 1].body.getAngle(); G.fl = 0; this.kitSet(G, 'go'); this.emit('kitIn', { ...this.kitBody(G), ring: G.c }); }
        break;
      }
      case 'go': this.kitGo(K, G, dt); break;
      case 'carry': this.kitCarry(K, G, dt); break;
      case 'lift': {
        const e = this.eggs.find((q) => q.id === G.tgt);
        // (0.8.19 a near miss on the edge of a run: as they heave, the reach closes to menaceNear of itself)
        if (!e || !this.kitFit(e) || this.channelOf(e) !== G.c || this.kitDist(G, e) > (G.t <= dt ? 0.9 * this.menaceNear() : 0.9)) { G.tgt = 0; this.kitSet(G, 'go'); this.emit('kitMiss', this.kitBody(G)); break; }
        if ((G.t -= dt) <= 0) {
          const p = e.body.getPosition();
          this.reefTake(e, 2); G.eid = e.id; G.tgt = 0; G.sx = p.x; G.sy = p.y;
          this.kitSet(G, 'carry'); this.emit('kitCarry', { ...this.kitBody(G), egg: e, ring: G.c, golden: e.golden ? 1 : 0 });
        }
        break;
      }
      case 'up': case 'down': case 'hop': this.kitCross(K, G, dt); break;
      case 'out': {
        const u = this.kitU(G), F = G.from, R1 = this.rings[n - 1].r + RING_TH / 2 + 0.3, oa = G.oa ?? EXIT, P1 = { x: R1 * Math.cos(oa), y: R1 * Math.sin(oa) }, P2 = { x: P1.x - 0.3, y: this.groundY };
        if (u < 0.45) { const k = ss(0, 0.45, u); G.x = F.x + (P1.x - F.x) * k; G.y = F.y + (P1.y - F.y) * k + 0.35 * Math.sin(k * Math.PI); }
        else { const k = ss(0.45, 1, u); G.x = P1.x + (P2.x - P1.x) * k; G.y = P1.y + (P2.y - P1.y) * k * k; }
        if ((G.t -= dt) <= 0) { G.x = P2.x; G.y = this.groundY; this.kitSet(G, 'yard'); this.emit('kitDown', { x: G.x, y: G.y + 0.3 }); }
        break;
      }
      case 'yard': {
        const gx = g.sack + 0.35, d = gx - G.x, v = this.kitM(KITS.carry) * 1.4 * dt;
        G.x += clamp(d, -v, v); G.odo += Math.min(Math.abs(d), v); G.y = this.groundY; G.dir = d >= 0 ? 1 : -1;
        if (Math.abs(gx - G.x) < 1e-3) this.kitHome(K, G);
        break;
      }
      case 'tumble': case 'dangle':
        if ((G.t -= dt) <= 0) this.kitFlee(G, G.ph);
        break;
    }
  },
  kitDist(G, e) { const p = e.body.getPosition(), r = this.kitFloor(G.c); return Math.abs(wrap(Math.atan2(p.y, p.x) - G.a)) * r; },
  // the floor they stand on turns under them: they scramble to keep their spot (like a treadmill: the floor slides under
  // their feet, as eggs slide back down a turning floor), so a gap turned under them leaves them DANGLING by their tails,
  // and a brisk turn (a leaky sum of it past KITS.shake of a full-speed turn) trips them up: they TUMBLE. Returns true
  // when that ended their step.
  kitRide(G, dt) {
    const ring = this.rings[G.c], ra = ring.body.getAngle(), da = wrap(ra - G.ra);
    G.ra = ra;
    if (G.ph === 'tumble' || G.ph === 'dangle') return false;
    G.fl = G.fl * Math.exp(-dt / KITS.shakeTau) + Math.abs(da);
    const r = this.kitFloor(G.c);
    if (this.kitHole(G.c, G.a) && this.kitHole(G.c, G.a + 0.07 / r) && this.kitHole(G.c, G.a - 0.07 / r)) { this.kitDangle(G); return true; }
    if (G.fl > this.kitM(KITS.shake) * this.maxOmega(ring) * KITS.shakeTau) { this.kitTumble(G, 'spin'); return true; }
    return false;
  },
  // walk along the floor toward angle goal; stops at a hole (returns 'hole') or at the goal ('there')
  kitWalk(G, goal, v, dt) {
    const r = this.kitFloor(G.c), d = wrap(goal - G.a);
    if (Math.abs(d) * r < 0.01) { G.a = goal; return 'there'; }
    const step = Math.min(Math.abs(d), (v * dt) / r), s = Math.sign(d), q = G.a + s * step;
    G.dir = s;
    if (this.kitHole(G.c, q + s * (0.12 / r))) return 'hole';
    G.a = wrap(q); G.odo += step * r;
    return Math.abs(wrap(goal - G.a)) * r < 0.01 ? 'there' : 'walk';
  },
  // a hole ahead in their floor: hop over it if it is short and solid floor lies beyond (toward goal)
  kitHopOver(G, goal) {
    const r = this.kitFloor(G.c), s = Math.sign(wrap(goal - G.a)) || 1;
    for (let k = 3; k <= 30; k++) {
      const q = G.a + s * (k * 0.05) / r;
      if (this.kitSolid(G.c, q, 0.1)) {
        if (!this.kitArcOk(q) || Math.abs(wrap(goal - G.a)) < Math.abs(wrap(q - G.a))) return false;
        G.from = { c: G.c, a: G.a }; G.to = q; this.kitSet(G, 'hop', this.kitQuick(KITS.hop)); this.emit('kitHop', { ...this.kitBody(G), ring: G.c }); return true;
      }
    }
    return false;
  },
  kitGo(K, G, dt) {
    const e = this.kitPick(G), v = this.kitM(KITS.walk) * this.kitD().tempo * this.menaceHeat() * this.kitScamp();
    G.wait = 0;
    if (!e) { this.kitFlee(G, 'none'); return; } // nothing left to fetch: home (not a failed fetch)
    G.tgt = e.id;
    const ce = this.channelOf(e);
    if (ce === G.c) {
      const p = e.body.getPosition(), ae = Math.atan2(p.y, p.x), sp = Math.hypot(e.body.getLinearVelocity().x, e.body.getLinearVelocity().y);
      if (this.kitDist(G, e) <= KITS.lean && sp < 0.8 && (this.menaceMay('kits', 'lift') || ((G.pace = 0.9), false))) { this.kitSet(G, 'lift', this.kitTell(KITS.lift)); this.emit('kitLift', { x: p.x, y: p.y, egg: e, ring: G.c }); return; }
      // (refused a token: they pace about the egg, a step back and forth, eyes on it)
      const goal = this.kitClampArc(ae + (G.pace > 0 ? (0.5 * Math.sin(this.t * 2.6)) / Math.max(0.5, this.rings[G.c].r) : 0)), w = this.kitWalk(G, goal, v, dt);
      if (w === 'hole' && !this.kitHopOver(G, goal)) G.wait = 1;
      else if (w === 'there') G.wait = 1;
      return;
    }
    this.kitRoute(G, ce < G.c ? -1 : 1, v, dt);
  },
  kitCarry(K, G, dt) {
    const n = this.rings.length, v = this.kitM(KITS.carry) * (0.55 + 0.45 * this.kitScamp()); // heave, stagger, heave
    G.wait = 0;
    if (G.c === n - 1) {
      const w = this.kitWalk(G, EXIT, v, dt);
      // at her spot, or at a hole in the floor near it (they climb out through the gap instead of over the rim)
      if (w === 'there' || (w === 'hole' && Math.abs(wrap(G.a - EXIT)) < 32 * D2R)) { G.from = { ...this.kitPt(G.c, G.a, EGG_W / 2 + KITS.ride) }; G.oa = G.a; this.kitSet(G, 'out', KITS.out); this.emit('kitOut', { ...this.kitBody(G), ring: G.c }); }
      else if (w === 'hole' && !this.kitHopOver(G, EXIT)) G.wait = 1;
      return;
    }
    this.kitRoute(G, 1, v, dt);
  },
  // toward the next channel: way -1 up through a gap of the ring above (c - 1), +1 down through a gap of their floor
  kitRoute(G, way, v, dt) {
    const ri = way < 0 ? G.c - 1 : G.c;
    if (ri < 0) { G.wait = 1; return; }
    const r = this.kitFloor(G.c);
    let best = null, bd = 1e9;
    for (const q of this.kitGaps(ri)) {
      if (!this.kitArcOk(q.a)) continue;
      const d = Math.abs(wrap(q.a - G.a));
      if (d < bd - 1e-9) { bd = d; best = q; }
    }
    if (!best) { // none low enough: wait at the end of the walk nearest the nearest gap
      let nb = null, nd = 1e9;
      for (const q of this.kitGaps(ri)) { const d = Math.abs(wrap(q.a - G.a)); if (d < nd) { nd = d; nb = q; } }
      const goal = nb ? this.kitClampArc(nb.a) : G.a;
      const w = this.kitWalk(G, goal, v, dt);
      if (w === 'hole') this.kitHopOver(G, goal);
      G.wait = 1;
      return;
    }
    let goal;
    if (way < 0) goal = best.a; // under the gap above
    else { const s = Math.sign(wrap(G.a - best.a)) || 1; goal = wrap(best.a + s * (best.half + 0.16 / r)); } // at the edge of the hole in the floor
    const w = this.kitWalk(G, goal, v, dt);
    if (w === 'there') {
      G.from = { c: G.c, a: G.a }; G.gi = best.gi; G.gr = ri;
      this.kitSet(G, way < 0 ? 'up' : 'down', this.kitQuick(way < 0 ? KITS.up : KITS.down));
      this.emit(way < 0 ? 'kitUp' : 'kitDrop', { ...this.kitBody(G), ring: ri, egg: G.eid ? 1 : 0 });
    } else if (w === 'hole') this.kitHopOver(G, goal);
  },
  // a crossing in progress (up, down, hop): its path for the art and the carried egg (G.p, world)
  kitCross(K, G, dt) {
    const u = this.kitU(G), F = G.from;
    if (G.ph === 'hop') {
      const a = F.a + wrap(G.to - F.a) * ss(0, 1, u), P = this.kitPt(G.c, a, 0.2 + 0.35 * Math.sin(u * Math.PI));
      G.p = P; G.a = a;
      if ((G.t -= dt) <= 0) { G.a = G.to; G.p = null; G.ra = this.rings[G.c].body.getAngle(); this.kitSet(G, G.eid ? 'carry' : 'go'); }
      return;
    }
    const gA = this.kitGapA(G.gr, G.gi);
    if (G.ph === 'up') { // a jump up through the gap above, landing beside it on that ring's floor (toward the bottom)
      const c1 = G.c - 1, half = this.rings[c1].gaps[G.gi] ? this.rings[c1].gaps[G.gi].len / (2 * this.rings[c1].r) : 0.1, s = Math.sign(wrap(DOWN - gA)) || 1;
      const land = wrap(gA + s * (half + 0.3 / this.kitFloor(c1))), A = this.kitPt(G.c, F.a, 0.2), B = this.kitPt(c1, land, 0.2), k = ss(0, 1, u);
      G.p = { x: A.x + (B.x - A.x) * k, y: A.y + (B.y - A.y) * k + 0.3 * Math.sin(u * Math.PI) };
      if ((G.t -= dt) <= 0) { G.c = c1; G.a = this.kitNearSolid(c1, land); this.kitLanded(G); }
      return;
    }
    // down through a gap of their floor (with the egg), onto the floor below at the gap's angle
    const c1 = G.c + 1, A = this.kitPt(G.c, F.a, 0.2), M = this.kitPt(G.c, gA, 0.05), B = this.kitPt(c1, gA, 0.2);
    if (u < 0.4) { const k = ss(0, 0.4, u); G.p = { x: A.x + (M.x - A.x) * k, y: A.y + (M.y - A.y) * k }; }
    else { const k = ss(0.4, 1, u); G.p = { x: M.x + (B.x - M.x) * k, y: M.y + (B.y - M.y) * k }; }
    if ((G.t -= dt) <= 0) { G.c = c1; G.a = this.kitNearSolid(c1, gA); this.kitLanded(G); }
  },
  kitLanded(G) {
    G.p = null; G.ra = this.rings[G.c].body.getAngle(); G.fl = 0;
    if (!this.kitArcOk(G.a)) G.a = this.kitClampArc(G.a);
    this.kitSet(G, G.eid ? 'carry' : 'go');
    this.emit('kitLand', { ...this.kitBody(G), ring: G.c });
  },
  kitHome(K, G) {
    const e = G.eid ? this.eggs.find((q) => q.id === G.eid && q.alive) : null;
    G.eid = 0; G.ph = 'sack'; G.c = -1; G.p = null;
    if (e) { e.hc = 3; K.sack.push(e.id); K.home++; this.emit('kitHome', { ...this.kitSackPt(K), egg: e, n: K.sack.length }); }
    this.kitSet(K, 'smug', this.kitRest(KITS.smug));
  },
  // ---------- the counters
  kitTumble(G, why) { G.why = why; this.kitLetGo(G, 'tumble'); this.kitSet(G, 'tumble', KITS.tumble); this.emit('kitTumble', { ...this.kitBody(G), ring: G.c, why }); },
  kitDangle(G) {
    const e = G.eid ? this.eggs.find((q) => q.id === G.eid && q.alive) : null;
    G.eid = 0; G.tgt = 0; G.why = 'gap';
    this.kitSet(G, 'dangle', KITS.dangle);
    if (e) this.kitDropThrough(G, e);
    this.emit('kitDangle', { ...this.kitBody(G), ring: G.c, egg: e ? 1 : 0 });
  },
  // the egg in their paws drops on through the gap under them: onto solid floor below, or out of the vault only over the
  // basket or mama's sack; anywhere else they fumble it onto the floor beside the gap (never a fall to break it)
  kitDropThrough(G, e) {
    const n = this.rings.length, r = this.kitFloor(G.c) - EGG_W / 2 - 0.05, P = { x: r * Math.cos(G.a), y: r * Math.sin(G.a) };
    let through = false;
    if (G.c < n - 1) through = this.kitSolid(G.c + 1, G.a, EGG_W / 2);
    else { const g = this.kitGeo(), nx = this.nest.getPosition().x; through = Math.abs(P.x - nx) < this.nestW / 2 - 0.25 || (P.x < g.sack + KITS.catchR * 0.7 && P.x > g.x0 - 0.5 && MAMA_PH.has(this.kit.ph)); }
    if (through) { e.body.setTransform(P, e.body.getAngle()); this.reefFree(e, 0, -0.4, 1.2); this.emit('kitFumble', { ...P, egg: e, through: 1 }); return; }
    this.kitPutDown(G, e);
  },
  // put the egg down on solid floor of their ring just beside them (down the slope), unharmed
  kitPutDown(G, e) {
    const c = G.c >= 0 ? G.c : this.rings.length - 1, a0 = G.c >= 0 ? G.a : EXIT, r = this.kitFloor(c) - EGG_W / 2 - 0.04, s = Math.sign(wrap(DOWN - a0)) || 1;
    let a = a0;
    for (let k = 0; k < 40; k++) { const q = a0 + (k % 2 ? -1 : 1) * s * Math.ceil(k / 2) * (0.06 / r); if (this.kitSolid(c, q, EGG_W / 2)) { a = q; break; } }
    const P = { x: r * Math.cos(a), y: r * Math.sin(a) };
    e.body.setTransform(P, e.body.getAngle());
    this.reefFree(e, 0, 0, 0.9);
    this.emit('kitFumble', { ...P, egg: e, through: 0 });
  },
  kitLetGo(G, why) {
    const e = G.eid ? this.eggs.find((q) => q.id === G.eid && q.alive) : null;
    G.eid = 0; G.tgt = 0; G.sx = null; G.sy = null;
    if (!e || e.hc !== 2) return null;
    if (G.ph === 'yard' || G.ph === 'out') { // off the floors: back onto the outer floor at mama's side
      const n = this.rings.length, saveC = G.c, saveA = G.a; G.c = n - 1; G.a = EXIT; this.kitPutDown(G, e); G.c = saveC; G.a = saveA;
    } else if (G.ph === 'down' && G.from) { const saveA = G.a; G.a = G.from.a; this.kitPutDown(G, e); G.a = saveA; }
    else this.kitPutDown(G, e);
    this.emit('kitDrop', { ...e.body.getPosition(), egg: e, why });
    return e;
  },
  kitDive(G, why) {
    if (G.ph === 'sack' || G.ph === 'flee') return false;
    this.kitLetGo(G, why);
    this.kitFlee(G, why === 'scare' ? 'scare' : 'dive');
    this.emit('kitDive', { ...this.kitBody(G), why });
    return true;
  },
  // home to the sack (a leap of a run, a straight arc in the world); why: 'tumble' 'dangle' 'dive' 'scare' 'none' 'end'
  kitFlee(G, why) {
    const P = this.kitBody(G, 0.1);
    this.kitLetGo(G, why);
    G.from = { x: P.x, y: P.y }; G.why = why; G.p = null;
    const d = Math.hypot(P.x - this.kitSackPt(this.kit).x, P.y - this.groundY);
    this.kitSet(G, 'flee', (why === 'dive' || why === 'scare' ? KITS.dive : KITS.flee) * clamp(0.6 + d / 8, 0.7, 1.4) + (why === 'tumble' || why === 'dangle' ? KITS.wail : 0));
    this.emit('kitFlee', { ...P, why });
  },
  kitFleeStep(K, G, dt, end = false) {
    const u = this.kitU(G), F = G.from, S = this.kitSackPt(K), k = ss(0, 1, u), h = Math.max(0.8, (F.y - S.y) * 0.3 + 0.8);
    G.x = F.x + (S.x - F.x) * k; G.y = F.y + (S.y - F.y) * k + h * Math.sin(u * Math.PI); G.dir = S.x >= F.x ? 1 : -1;
    if ((G.t -= dt) > 0) return;
    const why = G.why;
    G.ph = 'sack'; G.c = -1; G.x = S.x; G.y = this.groundY;
    if (end) return;
    const failed = why === 'tumble' || why === 'dangle' || why === 'dive';
    if (failed) K.fails++;
    this.emit('kitBack', { ...this.kitHead(), why, fails: K.fails, max: K.max });
    if (K.ph === 'sulk' || K.ph === 'leave' || K.ph === 'gone') return;
    if (why === 'dangle') this.kitSet(K, 'scold', this.kitRest(KITS.scold));
    else if (failed) this.kitSet(K, 'comfort', this.kitRest(KITS.comfort));
    else this.kitNext(K);
  },
  // an egg falling out of the vault by her sack: caught in it, not broken
  kitCatch(K) {
    const S = this.kitSackPt(K), n = this.rings.length;
    for (const e of this.aliveEggs()) {
      if (!e.body.isActive() || e.hc || e.thf || e.chick || this.channelOf(e) < n) continue;
      const p = e.body.getPosition(), v = e.body.getLinearVelocity();
      if (v.y > 0.3 || p.y > this.groundY + KITS.catchH || Math.abs(p.x - S.x) > KITS.catchR) continue;
      this.reefTake(e, 3); K.sack.push(e.id); this.kitHolds(K);
      this.emit('kitCatch', { x: p.x, y: p.y, egg: e, n: K.sack.length });
    }
  },
  // the egg the kits carry rides them; the eggs in the sack ride the sack (out of the world: their bodies are off)
  kitHolds(K) {
    const G = K.g;
    if (G.eid) {
      const e = this.eggs.find((q) => q.id === G.eid);
      if (!e || !e.alive || e.saved) G.eid = 0;
      else {
        const p = this.kitEggPt(G), k = G.sx != null ? 0.35 : 1, x = G.sx != null ? G.sx + (p.x - G.sx) * k : p.x, y = G.sy != null ? G.sy + (p.y - G.sy) * k : p.y;
        G.sx = null; G.sy = null;
        this.kitPin(e, x, y, p.r);
      }
    }
    K.sack = K.sack.filter((id) => this.eggs.some((q) => q.id === id && q.alive && !q.saved));
    K.sack.forEach((id, i) => { const e = this.eggs.find((q) => q.id === id), p = this.kitSackPt(K, i + 1); this.kitPin(e, p.x, p.y, 0.3); });
  },
  // where the carried egg is (world) and its turn: lying along their floor just over it, on their backs
  kitEggPt(G) {
    const up = EGG_W / 2 + KITS.ride, wob = 0.015 * Math.sin(G.odo * 18);
    if (G.p && (G.ph === 'down' || G.ph === 'hop')) { const a = Math.atan2(G.p.y, G.p.x); return { x: G.p.x - Math.cos(a) * (up - 0.2), y: G.p.y - Math.sin(a) * (up - 0.2), r: a }; }
    if (G.ph === 'out' || G.ph === 'yard') return { x: G.x, y: G.y + (G.ph === 'yard' ? up + 0.04 : 0), r: G.ph === 'yard' ? 0 : EXIT };
    const P = this.kitPt(G.c, G.a, up + wob);
    return { x: P.x, y: P.y, r: G.a };
  },
  kitPin(e, x, y, a) {
    const b = e.body;
    b.setTransform({ x, y }, a);
    b.setLinearVelocity({ x: 0, y: 0 }); b.setAngularVelocity(0);
    e.ch = this.channelOf(e); e.freefall = 0; e.drop = 0;
  },
  // she gives up: every egg in her sack pops out and flies back into the outer channel (nearest the bottom first, onto
  // floor clear of a gap)
  kitSpillAll(K) {
    const n = this.rings.length, ring = this.rings[n - 1], ra = ring.body.getAngle(), ri = this.kitFloor(n - 1) - 0.3, used = [];
    const free = (a) => !ring.gaps.some((g) => Math.abs(wrap(ra + g.a - a)) * ring.r < g.len / 2 + 0.42) && !used.some((u) => Math.abs(wrap(u - a)) * ri < 0.62);
    const S = this.kitSackPt(K);
    K.sack.splice(0).forEach((id) => {
      let a = DOWN;
      for (let k = 0; k < 40; k++) { const c = DOWN + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 6 * D2R; if (free(c)) { a = c; break; } }
      used.push(a);
      K.spill.push({ id, t: 0, x0: S.x, y0: S.y, x1: ri * Math.cos(a), y1: ri * Math.sin(a) });
    });
    this.emit('kitSpillAll', { ...S, n: K.spill.length });
  },
  kitSpillStep(K, dt) {
    if (!K.spill.length) return;
    K.spill = K.spill.filter((F) => {
      const e = this.eggs.find((q) => q.id === F.id && q.alive);
      if (!e) return false;
      F.t += dt;
      const u = clamp(F.t / KITS.spillT, 0, 1), h = 1.6 * Math.sin(u * Math.PI);
      this.kitPin(e, F.x0 + (F.x1 - F.x0) * u, F.y0 + (F.y1 - F.y0) * u + h, 0.3);
      if (u < 1) return true;
      this.reefFree(e, 0, 0, 1.2);
      this.emit('kitSpill', { x: F.x1, y: F.y1, egg: e });
      return false;
    });
  },

  // ---------- hooks: the rooster's crow, the glow flash, weather and powers (boss.js animalsHit)
  kitHit(kind, o = {}) {
    const K = this.kit;
    if (!K || this.state !== 'play' || K.done) return 0;
    const G = K.g;
    if (G.ph === 'sack' || G.ph === 'flee' || G.ph === 'pop') return 0;
    const P = this.kitBody(G), r = o.r ?? Infinity;
    const near = kind === 'crow' || r === Infinity || Math.hypot(P.x - (o.x ?? 0), P.y - (o.y ?? 0)) < r + 0.5;
    if (!near || kind === 'gust' || kind === 'lava') return 0;
    return this.kitDive(G, kind) ? 1 : 0;
  },
  // the live state a lesson (or a test) reads: the ring they walk on, and whether they carry an egg
  kitLesson() {
    const K = this.kit;
    if (!K || K.done) return null;
    const G = K.g;
    if (!WORK.has(G.ph) || G.c < 0) return null;
    return { ring: G.c, ph: G.ph, carrying: G.eid ? 1 : 0, at: this.kitBody(G), egg: G.eid || G.tgt || 0 };
  },
  // ---------- the planner (search.js value) and the danger meter
  kitThreat(e) {
    const K = this.kit;
    if (!K) return 0;
    if (K.sack.includes(e.id)) return 1;
    const G = K.g;
    if (G.eid === e.id) return G.ph === 'yard' || G.ph === 'out' ? 0.95 : 0.85;
    if (G.tgt === e.id && G.ph === 'lift') return 0.6;
    if (G.tgt === e.id && G.ph === 'go' && G.c === this.channelOf(e)) return 0.3;
    return 0;
  },
  kitScore() { const K = this.kit; return K ? 350 * K.fails + (K.done || K.ph === 'sulk' || K.ph === 'leave' ? 400 : 0) + (K.g.ph === 'tumble' || K.g.ph === 'dangle' || K.g.ph === 'flee' ? 120 : 0) : 0; },
  // ---------- state
  kitState() { return this.kit ? JSON.parse(JSON.stringify(this.kit)) : null; },
  kitLoad(S) {
    this.kit = S ? JSON.parse(JSON.stringify(S)) : this.kit;
    if (this.kit) for (const e of this.eggs) if (e.hc && e.body) e.body.setActive(false);
  },
};
