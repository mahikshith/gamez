// The hen holds the basket (Farm levels, level.nest.reach > 0): when an egg drops out of the vault a little beside the
// basket she runs it under the egg. Mixed into Sim (sim.js: Object.assign(Sim.prototype, reachMethods)), so `this` is
// the Sim. No randomness, plain state in this.hr (copied by reachState / reachLoad), so the planner, the hint search
// and rewind see the same run.
//
// nest.reach (m): how far past the home basket's rim an egg may land and still be caught; the basket itself travels up to
// reachMax = reach + ~0.4 m either way from home (nestX0), so such an egg drops well inside it. 0 / unset = the old fixed
// basket, and none of this code touches the nest. Off on a sliding basket (nest.amp), underwater (sim.water) and the Wonder vaults.
//
// Each step: every alive egg that has left the vault and is falling toward the ground gets a predicted landing x (its
// position and velocity under gravity, plus the wind, down to the basket's catch height). An egg that would miss the
// basket where it stands but lands within `reach` of the home basket's rim is a target; with two, the one that lands
// first if she can get there in time, else the other. She runs at RUN.acc up to RUN.vmax and brakes to stop under it,
// clamped to home +- reachMax, so the reach and the fall time both decide: a near drop is caught, a far one is honestly
// missed. After a catch or a miss she holds still for RUN.hold s, then walks home at RUN.walk (unless another egg comes).
// Events: lunge {x, dir} as she sets off, catch {x, y, egg, far, off} on a save during a run or within RUN.after s of
// one (beside the normal 'save'), catchMiss {x, egg} when the egg she ran for hits the ground.
import { Vec2 } from 'planck';

export const RUN = { acc: 22, brake: 30, vmax: 6, walk: 1.5, walkAcc: 4, hold: 0.4, after: 0.3, catchY: 0.7, safe: 0.32 };
const EGG_OUT = (e) => !e.alive || e.saved || !e.body || !e.body.isActive() || e.phx || e.thf || e.octo || e.hc || e.clamp || e.honey > 0 || e.icy > 0 || e.bubble > 0;

export const reachMethods = {
  reachInit(L) {
    const n = L.nest || {};
    this.reach = n.reach > 0 && !this.nestAmp && !this.water && !L.wonder ? n.reach : 0;
    this.reachMax = this.reach ? this.reach + RUN.safe + 0.08 : 0; // the basket's own travel: an egg landing `reach` past the home rim lands well inside it
    // mode: idle (home, still) | run (going for egg eid) | hold (stopped after a catch / miss) | home (walking back)
    this.hr = { x: 0, v: 0, mode: 'idle', eid: 0, cid: 0, went: 0, tx: 0, holdT: 0, runEnd: -9, dir: 0 };
  },

  // where egg e would cross the basket's catch height: { x, tf } (null if it is not falling out of the vault toward it).
  // She sees it coming: an egg already dropping through an open gap of the outer ring counts, not only one outside.
  reachLand(e, loose = false) {
    if (EGG_OUT(e)) return null;
    const n = this.rings.length, ch = this.channelOf(e);
    if (ch < n - 1) return null;
    const p = e.body.getPosition(), u = e.body.getLinearVelocity(), yc = this.nestY + RUN.catchY;
    if (ch === n - 1 && !loose && !this.reachInGap(e, p, u)) return null;
    const h = p.y - yc;
    if (h <= 0 || p.y > 0 || u.y > 1.5) return null; // below the rim already, above the vault's middle, or flying up
    const g = e.chick ? 0.4 * this.g0 : this.g;
    const tf = (u.y + Math.sqrt(u.y * u.y + 2 * g * h)) / g;
    const ax = this.wind ? this.wind * this.pushK(e) : 0;
    return { x: p.x + u.x * tf + 0.5 * ax * tf * tf, tf };
  },
  // in the outermost channel, low on the ring, over an open gap and moving out through it
  reachInGap(e, p, u) {
    const ring = this.rings[this.rings.length - 1];
    if (ring.prof) return false; // shaped rings: only once it is out
    const d = Math.hypot(p.x, p.y);
    if (d < ring.r - 0.2 || p.y > -0.3 * d || u.x * p.x + u.y * p.y < 0.8 * d) return false; // (0.8 m/s outward at least)
    const la = Math.atan2(p.y, p.x) - ring.body.getAngle();
    for (const g of ring.gaps) {
      if (g.o <= 0.5 || !this.gapOpenFor(g, e)) continue;
      const da = Math.atan2(Math.sin(la - g.a), Math.cos(la - g.a));
      if (Math.abs(da) * ring.r < g.len / 2 - 0.12) return true;
    }
    return false;
  },

  // can the basket, from where it is now, get its centre within RUN.safe of x (clamped to its reach) in time tf?
  reachFeasible(lx, tf) {
    const H = this.hr, C = this.reachMax, want = Math.max(-C, Math.min(C, lx - this.nestX0));
    if (Math.abs(lx - this.nestX0 - want) > this.nestW / 2 - RUN.safe) return false; // past the reach: no way
    const d = Math.max(0, Math.abs(want - H.x) - RUN.safe * 0.5);
    if (d <= 0) return true;
    const s = Math.sign(want - H.x), v0 = Math.max(0, H.v * s), A = RUN.acc, V = RUN.vmax;
    // time to cover d starting at speed v0 (accelerate to V, no braking: she is still moving as it lands, that is fine)
    const dAcc = (V * V - v0 * v0) / (2 * A);
    const t = d <= dAcc ? (-v0 + Math.sqrt(v0 * v0 + 2 * A * d)) / A : (V - v0) / A + (d - dAcc) / V;
    return t <= tf;
  },

  // would the hen go for this landing x? (a miss where the basket stands, within reach of the home rim)
  reachWants(lx) {
    const nx = this.nest.getPosition().x, off = Math.abs(lx - this.nestX0);
    if (this.hr.mode !== 'run' && Math.abs(lx - nx) < this.nestW / 2 - RUN.safe + 0.12) return false; // it lands in the basket as it is
    return off - this.nestW / 2 <= this.reach;
  },

  // the hint search / planner: an egg falling out of the vault that she will catch
  reachCatchable(e) {
    if (!this.reach) return false;
    const L = this.reachLand(e);
    return !!L && this.reachWants(L.x) && this.reachFeasible(L.x, L.tf);
  },

  reachStep(dt) {
    if (!this.reach) return;
    const H = this.hr, X0 = this.nestX0, C = this.reachMax;
    // pick the target: of the eggs she would go for, the one landing first that she can reach in time, else the first
    let best = null, bestT = 1e9, any = null, anyT = 1e9, cur = null;
    for (const e of this.eggs) {
      const mine = e.id === H.eid && H.mode === 'run', L = this.reachLand(e, mine);
      if (!L) continue;
      if (mine) cur = { e, L }; // once she runs for it she keeps going, reach or not
      if (!this.reachWants(L.x)) continue;
      if (L.tf < anyT) { anyT = L.tf; any = { e, L }; }
      if (L.tf < bestT && this.reachFeasible(L.x, L.tf)) { bestT = L.tf; best = { e, L }; }
    }
    let T = best || any;
    if (cur && H.mode === 'run' && (!best || best === cur || this.reachFeasible(cur.L.x, cur.L.tf))) T = cur; // stick with it
    if (T) {
      if (H.mode !== 'run') H.went = 0;
      H.mode = 'run'; H.eid = T.e.id;
      H.tx = Math.max(-C, Math.min(C, T.L.x - X0));
    } else if (H.mode === 'run') {
      // past the catch height she keeps going to the spot until the egg is in the basket, down by its floor, or gone
      const e = this.eggs.find((q) => q.id === H.eid);
      if (!e || EGG_OUT(e) || e.inNest > 0 || (e.body.getPosition().y - this.nestY) * this.gy < 0.2) { H.mode = 'hold'; H.holdT = RUN.hold; H.runEnd = this.t; H.cid = e && e.alive && !e.saved ? e.id : 0; }
    }
    // move: run (fast, brake into the spot), hold (brake to a stop, wait), home (an unhurried walk back)
    let vWant = 0, up = RUN.acc, down = RUN.brake;
    if (H.mode === 'run' || H.mode === 'home') {
      const goal = H.mode === 'run' ? H.tx : 0, d = goal - H.x, walk = H.mode === 'home';
      if (walk) up = down = RUN.walkAcc;
      vWant = Math.sign(d) * Math.min(walk ? RUN.walk : RUN.vmax, Math.sqrt(2 * down * Math.abs(d)));
    } else if (H.mode === 'hold' && Math.abs(H.v) < 0.05) {
      // she stands still while the egg she caught settles (it is saved once it lies still), then RUN.hold more
      const c = H.cid && this.t - H.runEnd < 2 ? this.eggs.find((q) => q.id === H.cid) : null;
      if (!(c && c.alive && !c.saved) && (H.holdT -= dt) <= 0) H.mode = Math.abs(H.x) > 1e-3 ? 'home' : 'idle';
    }
    const a = H.v !== 0 && Math.sign(vWant - H.v) !== Math.sign(H.v) ? down : up; // slowing down or speeding up
    H.v += Math.max(-a * dt, Math.min(a * dt, vWant - H.v));
    // 'lunge' once she is really off (a prediction that changes its mind in the first few cm stays a twitch)
    if (H.mode === 'run' && Math.abs(H.v) > 1.2 && Math.sign(H.v) !== H.dir) { H.dir = Math.sign(H.v); H.went = H.eid; this.emit('lunge', { x: X0 + H.x, dir: H.dir, egg: this.eggs.find((q) => q.id === H.eid) }); }
    if (H.mode !== 'run' && H.mode !== 'hold') H.dir = 0;
    let nx = H.x + H.v * dt;
    if (nx > C) { nx = C; H.v = 0; } else if (nx < -C) { nx = -C; H.v = 0; }
    if (H.mode === 'home' && Math.abs(nx) < 2e-3 && Math.abs(H.v) < 0.2) { nx = 0; H.v = 0; H.mode = 'idle'; }
    const p = this.nest.getPosition();
    H.x = nx;
    this.nest.setLinearVelocity(Vec2((X0 + nx - p.x) / dt, 0));
  },

  // sim.saveEgg / breakEgg call these
  reachSaved(egg, p) {
    if (!this.reach) return;
    const H = this.hr;
    if (H.went && (H.mode === 'run' || this.t - H.runEnd <= RUN.after || (egg.id === H.cid && this.t - H.runEnd < 1.5))) {
      egg.caught = 1; // (the game sings the save a little higher)
      this.emit('catch', { x: p.x, y: p.y, egg, far: Math.abs(H.x) > this.reachMax * 0.6, off: H.x });
      if (H.eid === egg.id && H.mode === 'run') { H.mode = 'hold'; H.holdT = RUN.hold; H.runEnd = this.t; }
    }
  },
  reachBroken(egg, why, p) {
    if (!this.reach) return;
    const H = this.hr;
    if (egg.id !== H.eid && egg.id !== H.cid) return;
    if (H.mode !== 'run' && this.t - H.runEnd > 1.5) return;
    if (why === 'ground' && H.went === egg.id) this.emit('catchMiss', { x: p.x, egg });
    H.eid = H.cid = 0;
    if (H.mode === 'run') { H.mode = 'hold'; H.holdT = RUN.hold; H.runEnd = this.t; }
  },
  // relative speed of an egg resting in the basket (the save waits for it to settle)
  reachRelV(egg) {
    const v = egg.body.getLinearVelocity(), nv = this.nest.getLinearVelocity();
    return Math.hypot(v.x - nv.x, v.y - nv.y);
  },

  reachState() { return { ...this.hr }; },
  reachLoad(S) { if (S) this.hr = { ...S }; },
};
