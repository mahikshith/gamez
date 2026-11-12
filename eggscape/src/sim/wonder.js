// Wonder Vaults (bonus world): five levels, each on one new mechanic. No DOM here: runs in node (tools/wonder-check.mjs).
//
//   planet : gravity is radial, toward a straw planet at the centre where the hen sits. Eggs stand on the OUTER faces
//            of the rings (nothing sticks in space: they do not ride a turning ring) and are let down inward, gap by gap.
//   plan   : time is frozen. Every ring is set by hand with no pressure, then HATCH locks the rings and runs the physics.
//            A failed run rewinds for free and the rings keep their setup; the score is the number of attempts.
//   mama   : the rings never turn. The hen runs round a rail outside the vault and gravity points at her; the nest
//            travels with her.
//   twin   : two vaults, one hand: ring i of one vault and ring i of the other are linked and turn opposite ways.
//   hatch  : a warm lamp hatches any egg that rests under it into a chick that WALKS along its ring by itself, turns
//            back at thorns and steep slopes, and drops through any gap it walks over.
//
// WonderSim extends Sim and only adds: its own gravity (the world's is switched off and a force is applied per body,
// with the magnitude READ FROM the sim: this.g), moved nests, walkers. The egg rules (cracks, thorns, sponge, the
// crack ladder, the nest) are the core sim's, so a retune of sim.js carries over.
import { Vec2, Circle } from 'planck';
import { Sim, DT, wonderFilt as filt } from './sim.js';
import { RING_TH, EGG_H, TAU, wrap, clamp } from './geom.js';

const deg = (d) => (d * Math.PI) / 180;
export const PLANET_R = 0.78; // the straw planet
export const WALK = { v: 1.05, slope: deg(66), warm: 0.55, lampR: 0.52, stuck: 0.45 };
export const MAMA = { speed: 1.25, acc: 5, drop: 0.95, pull: 1.3, fric: 0.12 }; // rad/s, rad/s^2, nest below the outer ring (m), the pull point beyond the nest (m)

export class WonderSim extends Sim {
  build() {
    super.build();
    const W = this.level.wonder || {};
    this.wk = W.kind;
    this.wsaved = []; // where each saved egg came home (planet: its angle)
    if (this.wk === 'planet') this.buildPlanet(W);
    else if (this.wk === 'mama') this.buildMama(W);
    else if (this.wk === 'hatch') this.buildHatch(W);
    else if (this.wk === 'plan') this.buildPlan(W);
    for (const ring of this.rings) if (ring.spec.fixed) ring.grabbable = false;
  }
  maxOmega(ring) { return super.maxOmega(ring) * (this.wk === 'planet' ? 0.6 : 1); } // planet: an egg must have time to sink into a gap passing under it
  snapshot() { return { t: this.t }; } // no rewind buffer here (plan mode rebuilds the vault instead)

  park() { // no ground in space: the core sim's ground (and its "fell out of the world" line) go far away
    this.ground.setTransform(Vec2(0, -900), 0);
    this.groundY = -1e5;
    this.world.setGravity(Vec2(0, 0));
  }
  placeEgg(egg, rad, a, up) {
    egg.body.setTransform(Vec2(rad * Math.cos(a), rad * Math.sin(a)), up);
    egg.body.setLinearVelocity(Vec2(0, 0));
    egg.body.setAngularVelocity(0);
    egg.ch = this.channelOf(egg);
    egg.freefall = egg.drop = 0;
  }

  // ---------- planet
  buildPlanet(W) {
    this.park();
    this.nest.setTransform(Vec2(0, -900), 0);
    this.planet = this.world.createBody({ type: 'static', position: Vec2(0, 0) });
    this.planetR = W.planetR || PLANET_R;
    this.planet.createFixture({ shape: new Circle(this.planetR), friction: 0.9, restitution: 0, ...filt('NEST'), userData: { kind: 'nest' } });
    this.planet.createFixture({ shape: new Circle(this.planetR + 0.34), isSensor: true, ...filt('NEST'), userData: { kind: 'nestIn' } });
    const out = this.rings[this.rings.length - 1];
    (W.eggs || []).forEach((a, i) => {
      const egg = this.eggs[i];
      if (!egg) return;
      const ring = this.rings[W.on ? W.on[i] ?? this.rings.length - 1 : this.rings.length - 1] || out;
      this.placeEgg(egg, ring.r + RING_TH / 2 + EGG_H / 2 + 0.01, deg(a), deg(a) - Math.PI / 2);
      egg.fix.setFriction(0); // nothing sticks in space: a turning ring slides under the egg
    });
  }
  // ---------- mama
  buildMama(W) {
    this.park();
    for (const ring of this.rings) ring.grabbable = false;
    for (const egg of this.eggs) egg.fix.setFriction(MAMA.fric); // slick shells: two eggs cannot jam across a channel when she calls sideways
    const a0 = deg(W.start ?? -90);
    this.hen = { a: a0, target: a0, w: 0, run: 0, speed: W.speed || MAMA.speed };
    this.nestR = this.outerR + MAMA.drop;
    this.moveNest(0);
  }
  moveNest(dt) {
    const H = this.hen, R = this.nestR;
    if (dt) {
      const want = clamp(wrap(H.target - H.a) * 7, -H.speed, H.speed);
      H.w += clamp(want - H.w, -MAMA.acc * dt, MAMA.acc * dt);
      H.a = wrap(H.a + H.w * dt);
      H.run = Math.abs(H.w) / H.speed;
    }
    this.nest.setTransform(Vec2(R * Math.cos(H.a), R * Math.sin(H.a)), H.a + Math.PI / 2);
    this.nest.setLinearVelocity(Vec2(-Math.sin(H.a) * R * H.w, Math.cos(H.a) * R * H.w));
    this.nest.setAngularVelocity(H.w);
  }
  // ---------- hatch
  buildHatch(W) {
    const L = W.lamp, ring = this.rings[L.ch], rad = ring.r - RING_TH / 2 - 0.34;
    this.lamp = { x: rad * Math.cos(deg(L.a)), y: rad * Math.sin(deg(L.a)), r: WALK.lampR, ch: L.ch, a: deg(L.a), glow: 0 };
    (W.eggs || []).forEach((s, i) => { // eggs that start further out (below the lamp): they stay eggs
      const egg = this.eggs[i], ring = s && this.rings[s.ch];
      if (egg && ring) this.placeEgg(egg, ring.r - RING_TH / 2 - 0.24, deg(s.a), deg(s.a) + Math.PI / 2);
    });
  }
  // ---------- plan
  buildPlan(W) {
    (W.eggs || []).forEach((s, i) => { // frozen on the slope of their ring: they roll the moment time starts
      const egg = this.eggs[i], ring = this.rings[s.ch || 0];
      if (egg && ring) this.placeEgg(egg, ring.r - RING_TH / 2 - 0.235, deg(s.a), deg(s.a) + Math.PI / 2);
    });
  }

  // the pull on a body at p: unit vector (planet: to the centre; mama: to a point just beyond her nest)
  pullDir(p) {
    if (this.wk === 'planet') { const d = Math.hypot(p.x, p.y) || 1; return [-p.x / d, -p.y / d]; }
    const H = this.hen, R = this.nestR + MAMA.pull, dx = R * Math.cos(H.a) - p.x, dy = R * Math.sin(H.a) - p.y, d = Math.hypot(dx, dy) || 1;
    return [dx / d, dy / d];
  }

  step() {
    const k = this.wk, dt = DT;
    if (k === 'mama') this.moveNest(dt);
    if (k === 'planet' || k === 'mama') {
      const g = this.g; // read from the core sim, never assumed
      for (const egg of this.eggs) {
        if (!egg.alive || egg.saved) continue;
        const b = egg.body, p = b.getPosition(), m = b.getMass(), [ux, uy] = this.pullDir(p);
        b.applyForceToCenter(Vec2(ux * m * g, uy * m * g), true);
        if (k === 'planet') {
          // an egg stands on its ring, feet to the planet; a little drag along the ring so it settles where it is
          const v = b.getLinearVelocity(), tx = -uy, ty = ux, vt = v.x * tx + v.y * ty;
          b.applyForceToCenter(Vec2(-tx * vt * m * 5, -ty * vt * m * 5), true);
          b.setAngularVelocity(clamp(wrap(Math.atan2(-uy, -ux) - Math.PI / 2 - b.getAngle()) * 9, -7, 7));
        }
      }
      for (const d of this.debris) { const b = d.body, [ux, uy] = this.pullDir(b.getPosition()), m = b.getMass(); b.applyForceToCenter(Vec2(ux * m * g, uy * m * g), true); }
      for (const d of this.bombs) if (d.alive) { const b = d.body, [ux, uy] = this.pullDir(b.getPosition()), m = b.getMass(); b.applyForceToCenter(Vec2(ux * m * g, uy * m * g), true); }
    }
    if (k === 'hatch') this.walkStep(dt);
    super.step();
  }

  afterStep(dt) {
    super.afterStep(dt);
    const k = this.wk;
    if (k === 'planet') {
      const far = this.outerR + 4;
      for (const egg of this.eggs) if (egg.alive && !egg.saved) { const p = egg.body.getPosition(); if (Math.hypot(p.x, p.y) > far) this.breakEgg(egg, 'lost'); }
    } else if (k === 'mama') {
      const far = this.nestR + 0.75, nv = this.nest.getLinearVelocity();
      for (const egg of this.eggs) {
        if (!egg.alive || egg.saved) continue;
        const p = egg.body.getPosition(), v = egg.body.getLinearVelocity();
        // in her nest and still against it (she may be walking): home
        if (egg.inNest > 0 && Math.hypot(v.x - nv.x, v.y - nv.y) < 1.2) { if ((egg.wNestT = (egg.wNestT || 0) + dt) > 0.3) this.saveEgg(egg); }
        else egg.wNestT = 0;
        if (!egg.saved && Math.hypot(p.x, p.y) > far && !(egg.inNest > 0)) this.breakEgg(egg, 'ground'); // flew past her
      }
    }
  }

  saveEgg(egg) {
    const p = egg.body.getPosition();
    this.wsaved.push({ a: Math.atan2(p.y, p.x), chick: egg.chick, cracks: egg.cracks });
    super.saveEgg(egg);
  }

  // ---------- walkers (hatch)
  walkStep(dt) {
    const L = this.lamp;
    L.glow = Math.max(0, L.glow - dt);
    for (const egg of this.eggs) {
      if (!egg.alive || egg.saved) continue;
      const b = egg.body, p = b.getPosition();
      if (!egg.chick) {
        if (Math.hypot(p.x - L.x, p.y - L.y) < L.r + 0.12) {
          egg.warm = (egg.warm || 0) + dt;
          L.glow = 0.3;
          if (egg.warm >= WALK.warm) {
            this.hatch(egg, true);
            egg.walk = egg.id % 2 ? 1 : -1; // the first one sets off to the right, the next to the left
            egg.wSegT = -9; egg.wTurnT = this.t; egg.wRefT = null;
            egg.fix.setFriction(0); // it walks, it is not carried or dragged by the ring
            this.emit('wHatch', { egg, x: p.x, y: p.y });
          }
        } else if (egg.warm > 0) egg.warm = Math.max(0, egg.warm - dt * 0.5);
        continue;
      }
      if (!egg.walk) continue;
      if (this.t - egg.wSegT > 0.08) { egg.wRefT = null; egg.wAir = 1; continue; } // in the air: it flutters down by itself
      egg.wAir = 0;
      const phi = Math.atan2(p.y, p.x), sl = wrap(phi + Math.PI / 2), tx = -Math.sin(phi) * egg.walk, ty = Math.cos(phi) * egg.walk;
      // too steep ahead: turn round
      if (Math.abs(sl) > WALK.slope && Math.sign(sl) === egg.walk && this.t - egg.wTurnT > 0.3) { egg.walk = -egg.walk; egg.wTurnT = this.t; this.emit('wTurn', { egg, x: p.x, y: p.y, why: 'slope' }); continue; }
      // blocked (another chick, an egg): no ground gained for a moment, so it turns round
      if (egg.wRefT == null || egg.wRefW !== egg.walk) { egg.wRefT = this.t; egg.wRefA = phi; egg.wRefW = egg.walk; }
      else if (this.t - egg.wRefT > WALK.stuck) {
        const gained = wrap(phi - egg.wRefA) * egg.walk * Math.hypot(p.x, p.y);
        egg.wRefT = this.t; egg.wRefA = phi;
        if (gained < 0.12) { egg.walk = -egg.walk; egg.wTurnT = this.t; this.emit('wTurn', { egg, x: p.x, y: p.y, why: 'bump' }); continue; }
      }
      const d = Math.hypot(p.x, p.y) || 1;
      b.setLinearVelocity(Vec2(tx * WALK.v + (p.x / d) * 0.7, ty * WALK.v + (p.y / d) * 0.7)); // steps along the ring, feet pressed to it
      egg.face = tx >= 0 ? 1 : -1;
    }
  }

  preSolve(c, old) {
    if (this.wk === 'hatch') {
      const [, , ua, ub] = this.parts(c);
      const egg = ua.kind === 'egg' ? ua.egg : ub.kind === 'egg' ? ub.egg : null, other = ua.kind === 'egg' ? ub : ua;
      if (egg && egg.walk && egg.alive && !egg.saved) {
        if (other.kind === 'seg' && other.seg.alive) egg.wSegT = this.t;
        if (other.kind === 'thorn' && other.thorn.alive && other.thorn.ext >= 0.5) {
          // a chick is not hurt by a thorn: it turns back (the thorn is a wall to it)
          const th = other.thorn, ring = th.ring, tp = ring.body.getWorldPoint(Vec2(th.base * Math.cos(th.a), th.base * Math.sin(th.a))), p = egg.body.getPosition();
          const side = Math.sign(wrap(Math.atan2(tp.y, tp.x) - Math.atan2(p.y, p.x))) || 1; // the thorn is on this side of it
          if (side === egg.walk && this.t - egg.wTurnT > 0.3) { egg.walk = -egg.walk; egg.wTurnT = this.t; this.defer(() => this.emit('wTurn', { egg, x: p.x, y: p.y, why: 'thorn' })); }
          return;
        }
      }
    }
    super.preSolve(c, old);
  }
}

// ---------------------------------------------------------------- the game model: one or two vaults plus the mode's rules
export class WonderGame {
  constructor(level, opts = {}) {
    this.level = level;
    this.kind = level.wonder.kind;
    this.opts = opts;
    this.attempts = 1;
    this.t = 0;
    this.events = [];
    this.setup = null; // plan: ring angles kept across attempts
    this.build();
  }
  build() {
    const Ls = this.kind === 'twin' ? this.level.wonder.vaults.map((v) => ({ ...v, wonder: { kind: 'twin' }, time: this.level.time, theme: this.level.theme, id: this.level.id })) : [this.level];
    this.sims = Ls.map((L) => new WonderSim(L, { mode: 'medium' }));
    this.state = 'play';
    this.phase = this.kind === 'plan' ? 'plan' : 'run';
    this.runT = 0; this.stall = 0; this.over = null;
    if (this.kind === 'twin') {
      const n = Math.min(...this.sims.map((s) => s.rings.length));
      this.link = Array.from({ length: n }, (_, i) => ({ phi: 0, base: this.sims.map((s) => s.rings[i].body.getAngle()) }));
    }
    if (this.setup) this.sims[0].rings.forEach((r, i) => this.setAngle(r, this.setup[i]));
  }
  get sim() { return this.sims[0]; }
  setAngle(ring, a) { ring.body.setTransform(Vec2(0, 0), a); ring.target = a; }

  // which ring a touch at world (x, y) of vault si takes
  ringAt(si, x, y) {
    const sim = this.sims[si], d = Math.hypot(x, y);
    if (this.kind === 'mama') return null;
    if (this.kind === 'planet') { // a ring and the band outside it (where its eggs stand)
      let pick = sim.rings[0];
      for (const r of sim.rings) if (d >= r.r - 0.3) pick = r;
      return pick;
    }
    return sim.ringAt(d, Math.atan2(y, x));
  }
  canGrab(ring) { return !!ring && ring.grabbable && !(ring.lock > 0) && (this.kind !== 'plan' || this.phase === 'plan') && this.state === 'play'; }

  // turn ring ri of vault si by d radians (the player's drag)
  turn(si, ri, d) {
    const sim = this.sims[si], ring = sim.rings[ri];
    if (!this.canGrab(ring)) return;
    if (this.kind === 'plan') { // frozen time: the ring simply goes where it is put; geared rings go with it
      const T = ring.gear || [ring];
      for (const r of T) this.setAngle(r, r.body.getAngle() + (Math.abs(r.i - ring.i) % 2 ? -d : d));
      this.touched = true;
    } else if (this.kind === 'twin' && this.link[ri]) this.link[ri].phi += si === 0 ? d : -d;
    else ring.target += d;
  }
  setHen(a) { if (this.sim.hen) this.sim.hen.target = a; }

  hatch() {
    if (this.kind !== 'plan' || this.phase !== 'plan') return false;
    this.setup = this.sim.rings.map((r) => r.body.getAngle());
    for (const r of this.sim.rings) { r.grabbable = false; r.held = false; r.target = r.body.getAngle(); }
    this.phase = 'run'; this.runT = 0; this.stall = 0;
    this.events.push({ type: 'hatchGo', si: 0 });
    return true;
  }
  // back to frozen time, rings as they were set; costs one attempt
  rewind() {
    if (this.kind !== 'plan' || this.phase === 'plan' || this.state === 'won') return false;
    this.attempts++;
    this.build();
    this.events.push({ type: 'rewound', si: 0 });
    return true;
  }

  step() {
    if (this.phase === 'plan' || this.state !== 'play' && this.endT > 4) return;
    this.t += DT;
    if (this.state !== 'play') this.endT = (this.endT || 0) + DT;
    if (this.kind === 'twin') for (let i = 0; i < this.link.length; i++) { const K = this.link[i]; this.sims.forEach((s, j) => { if (s.rings[i].grabbable && !(s.rings[i].lock > 0)) s.rings[i].target = K.base[j] + (j ? -K.phi : K.phi); }); }
    this.sims.forEach((s, si) => {
      s.step();
      for (const ev of s.events) this.events.push({ ...ev, si });
      s.events.length = 0;
    });
    if (this.kind === 'twin') for (let i = 0; i < this.link.length; i++) { const K = this.link[i], r = this.sims[0].rings[i]; K.phi = r.target - K.base[0]; } // the core sim keeps a target near its ring
    if (this.state !== 'play') return;
    const st = this.sims.map((s) => s.state);
    if (this.kind === 'plan') {
      if (this.phase === 'over') return;
      this.runT += DT;
      const sim = this.sim, eggs = sim.aliveEggs();
      const moving = eggs.some((e) => { const v = e.body.getLinearVelocity(); return Math.hypot(v.x, v.y) > 0.12; }) || sim.bombs.some((b) => b.alive && b.lit);
      this.stall = moving ? 0 : this.stall + DT;
      if (st[0] === 'won' || (this.stall > 2.2 && sim.savedLog.length >= (this.level.target || 1))) this.end('won'); // enough are home and nothing moves any more
      else if (st[0] === 'failed' || (this.stall > 2.2 && sim.state === 'play') || this.runT > 40) { this.phase = 'over'; this.over = st[0] === 'failed' ? 'broke' : 'stuck'; this.events.push({ type: 'runOver', why: this.over, si: 0 }); }
    } else if (st.some((x) => x === 'failed')) this.end('failed');
    else if (st.every((x) => x === 'won')) this.end('won');
  }
  end(state) { this.state = state; this.endT = 0; this.events.push({ type: state === 'won' ? 'wWon' : 'wFailed', si: 0 }); }

  get timeLimit() { return this.sims[0].timeLimit; }
  get timeLeft() { return Math.min(...this.sims.map((s) => s.timeLeft)); }
  stats() {
    const S = this.sims.map((s) => s.stats());
    return { saved: S.reduce((a, s) => a + s.saved, 0), total: S.reduce((a, s) => a + s.total, 0), broken: S.reduce((a, s) => a + s.broken, 0), target: S.reduce((a, s) => a + s.target, 0), perfect: S.every((s) => s.perfect), per: S, attempts: this.attempts, score: S.reduce((a, s) => a + s.score, 0) };
  }
  stars() {
    if (this.state !== 'won') return 0;
    const s = this.stats();
    if (this.kind === 'plan') { const par = this.level.wonder.par || [2, 5]; return s.attempts <= par[0] ? 3 : s.attempts <= par[1] ? 2 : 1; }
    return s.broken === 0 ? (s.perfect ? 3 : 2) : 1;
  }
}
