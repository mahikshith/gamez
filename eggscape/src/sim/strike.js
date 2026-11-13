// Chick Strike powers (data: data/strikes.js, art: render/strike.js). Mixed into Sim like powers2.js, so `this` is the Sim.
// All state is plain data in this.stk (stkState / stkLoad), so rewind keeps the meter, a chick in flight and every effect.
//
// The meter fills while the level plays (CHARGE.base s, longer after each use, + per egg saved and orb taken). A full
// meter lets the player fire (stkFire): the chick hops off the hen's back (FLIGHT.hop), arcs to its target (FLIGHT.fly)
// and hits (stkHit). Target: what the player tapped in the last 1.5 s, else the boss, else the creature nearest an egg.
// A boss struck during its telegraph loses that attack (and an hp if it has them); a bomb always interrupts it.
//
// Nothing here runs unless a strike is fired: the meter is data only, and stkDt() returns dt unchanged without a rage,
// so a level played without the button simulates exactly as before (the planner never strikes).
import { Vec2 } from 'planck';
import { STRIKE, CHARGE, FLIGHT } from '../data/strikes.js';

const DT = 1 / 120;
const PICK_R = 0.9; // m: a tap this close to a creature picks it

export const stkMethods = {
  // ---------- build (end of Sim.build): id = the equipped chick (opts.strike), or none
  stkInit() {
    const id = STRIKE[this.opts.strike] ? this.opts.strike : null, L = this.level;
    const any = !!(L.bossFight || this.snakes.length || (this.sals || []).length || this.eagle || (this.thieves || []).length || (this.frogs || []).length
      || (this.octos || []).length || (this.schools || []).length || (this.hermits || []).length || (this.puffs || []).length || (this.jellies || []).length
      || this.kc || (this.cw && this.cwAny()) || (this.gators || []).length || (this.turtles || []).length || (this.mosqs || []).length);
    this.stk = {
      id, any, on: !!(id && any), m: id && this.mode === 'easy' ? CHARGE.easy : 0, base: CHARGE.base, uses: 0, full: 0, saved: 0,
      fly: null, fx: [], glue: [], held: {}, gl: [], rage: 0, dcy: 0, n: 0,
    };
    this.stkEv = 0;
  },
  stkEquip(id) { const K = this.stk; if (!K) return; K.id = STRIKE[id] ? id : null; K.on = !!(K.id && K.any); },
  stkOn() { return !!(this.stk && this.stk.on); },
  stkReady() { const K = this.stk; return !!K && K.on && K.m >= 1 && !K.fly && this.state === 'play'; },
  // creature time while the decoy's victims rage
  stkDt(dt) { const K = this.stk; return K && K.rage > 0 ? dt * STRIKE.decoy.fast : dt; },

  // ---------- every live villain: { key, type, ref, x, y, boss }
  stkTargets() {
    const out = [], F = this.level.bossFight, bk = F && F.kind;
    const add = (key, type, ref, p, boss = false) => { if (p && isFinite(p.x) && isFinite(p.y)) out.push({ key, type, ref, x: p.x, y: p.y, boss }); };
    const snakes = this.p2Snakes();
    const big = bk === 'snake' && snakes.length ? snakes.reduce((a, b) => (b.size > a.size ? b : a)) : null;
    for (const S of snakes) add('sn' + S.id, 'snake', S, S.pts[0], S === big);
    for (const C of this.p2Sals()) add('sa' + C.id, 'sal', C, C.pts[0], !!C.boss);
    const E = this.p2Eagle();
    if (E) add('eg', 'eagle', E, E);
    (this.thieves || []).forEach((T, i) => { if (this.thLive(T)) add('th' + i, 'thief', T, this.thBody(T), !!T.boss); });
    (this.frogs || []).forEach((Fr, i) => add('fr' + i, 'frog', Fr, Fr));
    (this.octos || []).forEach((C, i) => { if (!['wait', 'gone', 'away', 'warp'].includes(C.ph)) add('oc' + i, 'octo', C, this.octXY(C)); });
    (this.schools || []).forEach((S, i) => { if (S.f && S.f.length) add('fi' + i, 'fish', S, this.fishXY(S)); });
    (this.hermits || []).forEach((H, i) => { if (this.hermitLive(H)) add('he' + i, 'hermit', H, this.hermitBody(H)); });
    (this.puffs || []).forEach((P, i) => { if (P.ph !== 'wait' && P.ph !== 'gone') add('pu' + i, 'puff', P, this.puffXY(P)); });
    (this.jellies || []).forEach((J, i) => { if (J.ph === 'float' || J.ph === 'in') add('je' + i, 'jelly', J, J); });
    if (this.kc && !this.kc.done) add('kc', 'kc', this.kc, { x: this.kc.bx, y: this.kc.by }, true);
    if (this.cw) {
      this.cw.sp.forEach((S, i) => { if (S.ph !== 'flung' && S.ph !== 'wait') add('sp' + i, 'spider', S, this.cwSpider(S)); });
      this.cw.bt.forEach((B, i) => { if (B.ph !== 'wait') add('bt' + i, 'beetle', B, this.cwXY(B)); });
      this.cw.jk.forEach((J, i) => add('jk' + i, 'jack', J, this.cwFloor(J.fi, J.la, 0)));
    }
    (this.gators || []).forEach((G, i) => { if (!['hid', 'gone', 'beaten'].includes(G.ph)) add('ga' + i, 'gator', G, G, !!G.boss); });
    (this.turtles || []).forEach((T, i) => { if (T.ph !== 'gone') add('tu' + i, 'turtle', T, T); });
    (this.mosqs || []).forEach((Q, i) => { if (Q.ph !== 'scatter') add('mq' + i, 'mosq', Q, Q); });
    const B = this.bx && this.bx.boss;
    if (B && !['snake', 'salamander', 'kingcrab', 'gator'].includes(B.kind) && !(B.kind === 'blizzard' && this.geckoOf && this.geckoOf()) && !(B.kind === 'golem' && this.duke && this.duke()) && !B.den && !(B.kind === 'owl' && this.owl && this.owl.down)) add('bx', 'bx', B, B, true);
    return out;
  },
  // what the strike goes for: a recent tap (pick), else the boss, else the creature nearest an egg
  stkChoose(pick) {
    const L = this.stkTargets();
    if (!L.length) return null;
    if (pick) { const P = L.find((e) => e.key === pick); if (P) return P; }
    const boss = L.find((e) => e.boss);
    if (boss) return boss;
    const eggs = this.aliveEggs().map((e) => e.body.getPosition());
    if (!eggs.length) return L[0];
    let best = L[0], bd = Infinity;
    for (const e of L) for (const p of eggs) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = e; } }
    return best;
  },
  // a tap in the world: the creature under it, if any (main.js remembers it for 1.5 s)
  stkPickAt(x, y) {
    let best = null, bd = PICK_R;
    for (const e of this.stkTargets()) { const d = Math.hypot(e.x - x, e.y - y) - (e.type === 'bx' || e.type === 'kc' || e.type === 'eagle' ? 0.6 : 0); if (d < bd) { bd = d; best = e; } }
    return best ? best.key : null;
  },

  // ---------- fire: o = { x, y } the launch point (the hen's back), pick (a creature key), force (dev: fill first)
  stkFire(o = {}) {
    const K = this.stk;
    if (!K || !K.on || this.state !== 'play' || K.fly) return { ok: false, why: 'busy' };
    if (o.force) K.m = 1;
    if (K.m < 1) return { ok: false, why: 'charge' };
    const T = this.stkChoose(o.pick);
    if (!T) return { ok: false, why: 'none' };
    K.m = 0; K.full = 0; K.uses++; K.n++;
    K.base = CHARGE.base * Math.pow(CHARGE.grow, K.uses);
    const x0 = o.x ?? this.nest.getPosition().x + this.nestW / 2 + 0.9, y0 = o.y ?? this.groundY + 0.9 * this.gy;
    K.fly = { id: K.id, ph: 'hop', t: 0, key: T.key, boss: T.boss ? 1 : 0, x0, y0, tx: T.x, ty: T.y };
    this.emit('stkFire', { id: K.id, x: x0, y: y0, tx: T.x, ty: T.y, boss: T.boss });
    return { ok: true, key: T.key };
  },

  // ---------- every step (sim.js, after the powers)
  stkStep(dt) {
    const K = this.stk;
    if (!K || !K.on) return;
    const play = this.state === 'play';
    // charge: time, eggs saved, orbs taken (pickups since the last step)
    if (this.events.length < this.stkEv) this.stkEv = 0;
    let orbs = 0;
    for (let i = this.stkEv; i < this.events.length; i++) if (this.events[i].type === 'pickup') orbs++;
    this.stkEv = this.events.length;
    const saved = this.savedLog.length;
    if (play && !K.fly) {
      K.m = Math.min(1, K.m + dt / K.base + CHARGE.egg * Math.max(0, saved - K.saved) + CHARGE.orb * orbs);
      if (K.m >= 1 && !K.full) { K.full = 1; this.emit('stkReady', { id: K.id }); }
    }
    K.saved = saved;
    // the flight
    const F = K.fly;
    if (F) {
      F.t += DT;
      const T = this.stkTargets().find((e) => e.key === F.key);
      if (T) { F.tx = T.x; F.ty = T.y; }
      if (F.ph === 'hop' && F.t >= FLIGHT.hop) { F.ph = 'fly'; F.t = 0; this.emit('stkLaunch', { id: F.id, x: F.x0, y: F.y0, tx: F.tx, ty: F.ty }); }
      else if (F.ph === 'fly' && F.t >= FLIGHT.fly) { K.fly = null; this.stkHit(F, T); }
    }
    // effects and their timers
    for (const E of K.fx) E.t -= DT;
    K.fx = K.fx.filter((E) => E.t > 0);
    if (K.rage > 0 && (K.rage -= DT) <= 0) { K.rage = 0; this.emit('stkCalm', {}); }
    // glued creatures: the stun is topped up quietly until the glue lets go
    for (const G of K.gl) {
      G.t -= DT;
      if ((G.re -= DT) > 0 || G.t <= 0) continue;
      G.re = 2;
      const T = this.stkTargets().find((e) => e.key === G.key);
      if (T) { const n = this.events.length; this.stkApply(T, 'bolt', Math.min(2.6, G.t + 0.1), 'glue'); this.events.length = n; }
    }
    K.gl = K.gl.filter((G) => G.t > 0);
    // glue patches hold an egg that touches them
    for (const P of K.glue) P.t -= DT;
    K.glue = K.glue.filter((P) => P.t > 0);
    for (const e of this.aliveEggs()) {
      const H = K.held[e.id];
      if (H) {
        if (H.cd > 0) { if ((H.cd -= DT) <= 0) delete K.held[e.id]; continue; }
        e.body.setTransform(Vec2(H.x, H.y), H.a);
        e.body.setLinearVelocity(Vec2(0, 0)); e.body.setAngularVelocity(0);
        e.safeT = Math.max(e.safeT || 0, 0.05);
        if ((H.t -= DT) <= 0) { H.cd = 1.5; this.emit('stkUnstick', { egg: e, x: H.x, y: H.y }); }
        continue;
      }
      if (!K.glue.length || e.honey > 0) continue;
      const p = e.body.getPosition();
      for (const P of K.glue) if (Math.hypot(p.x - P.x, p.y - P.y) < P.r + 0.14) { K.held[e.id] = { x: p.x, y: p.y, a: e.body.getAngle(), t: STRIKE.glue.hold, cd: 0 }; this.emit('stkStick', { egg: e, x: p.x, y: p.y }); break; }
    }
    // the decoy chick: when it is gone, its hunters know they were fooled
    if (K.dcy && !(this.p2.decoy && this.p2.decoy.stk)) {
      K.dcy = 0;
      K.rage = STRIKE.decoy.rage;
      const D = K.dcyAt || { x: 0, y: 0 };
      this.emit('stkRage', { x: D.x, y: D.y, t: K.rage });
    }
    if (K.dcy && this.p2d) { const p = this.p2d.body.getPosition(); K.dcyAt = { x: p.x, y: p.y }; }
  },

  // ---------- the hit
  stkHit(F, T) {
    const K = this.stk, S = STRIKE[F.id], id = F.id;
    if (!T) { // its target got away (or left the vault): the chick lands on the nearest other one, or misses
      const L = this.stkTargets();
      let bd = 1.5;
      for (const e of L) { const d = Math.hypot(e.x - F.tx, e.y - F.ty); if (d < bd) { bd = d; T = e; } }
    }
    const x = T ? T.x : F.tx, y = T ? T.y : F.ty;
    if (!T && id !== 'decoy') { this.emit('stkHit', { id, x, y, miss: 1 }); return; }
    const boss = !!(T && T.boss), B = this.bx && this.bx.boss;
    // a boss struck in its telegraph loses that attack (a bomb interrupts any attack) and, with hp, takes a hit
    let cancel = false, hurt = false;
    if (boss && B && B.atk && (B.atk.ph === 'warn' || id === 'bomb')) {
      cancel = true;
      B.atk = null; B.t = Math.max(B.t, 2); B.flinch = 0.9;
      hurt = this.stkHurt(T);
    }
    this.emit('stkHit', { id, x, y, boss, cancel, hurt, key: T ? T.key : '' });
    const fx = (k, t, o = {}) => K.fx.push({ k, t, max: t, x, y, key: T ? T.key : '', ...o });
    if (id === 'freeze') {
      const t = boss ? S.boss : S.t;
      this.stkApply(T, 'ice', t, id);
      fx('freeze', t);
      // downside: the two rings nearest the target ice over
      const d = Math.hypot(x, y), near = [...this.rings].sort((a, b) => Math.abs(a.r - d) - Math.abs(b.r - d)).slice(0, 2);
      for (const ring of near) { for (const sg of ring.segs) if (sg.alive) sg.ice = Math.max(sg.ice || 0, S.t); }
      this.emit('stkIcy', { rings: near.map((r) => r.i), t: S.t });
    } else if (id === 'thunder') {
      this.stkApply(T, 'bolt', S.t, id);
      // it arcs to up to two more within two channels
      const c0 = this.chAt(Math.hypot(x, y)), pts = [{ x, y }];
      const more = this.stkTargets().filter((e) => e.key !== T.key && Math.abs(this.chAt(Math.hypot(e.x, e.y)) - c0) <= S.chainCh)
        .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y)).slice(0, S.chain);
      for (const e of more) { this.stkApply(e, 'bolt', S.t, id); pts.push({ x: e.x, y: e.y }); }
      fx('thunder', 0.7, { pts });
      // downside: every egg within a channel of the bolt jumps (never enough to crack by itself)
      for (const e of this.aliveEggs()) {
        if (Math.abs(this.channelOf(e) - Math.min(c0, this.rings.length)) > 1) continue;
        const p = e.body.getPosition(), m = e.body.getMass(), r = this.stkRand(), a = r * Math.PI * 2;
        e.body.applyLinearImpulse(Vec2(Math.cos(a) * m * 1.5, (Math.abs(Math.sin(a)) * 1.2 + 0.6) * m * this.gy), p, true);
        e.safeT = Math.max(e.safeT || 0, 0.45);
        this.emit('stkJolt', { egg: e, x: p.x, y: p.y });
      }
    } else if (id === 'bomb') {
      this.stkApply(T, boss ? 'bolt' : 'out', boss ? S.boss : S.t, id);
      fx('bomb', 0.8);
      // thorns within reach are blown off
      let n = 0;
      for (const ring of this.rings) for (const th of ring.thorns) {
        if (!th.alive) continue;
        const q = this.thornAt(th);
        if (Math.hypot(q.x - x, q.y - y) < S.thornR) { this.removeThorn(th, 'snap'); n++; }
      }
      // downside: the shockwave shoves eggs away
      for (const e of this.aliveEggs()) {
        const p = e.body.getPosition(), dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy) || 0.01;
        if (d > S.shoveR || e.honey > 0) continue;
        const m = e.body.getMass() * 3.4 * (1 - d / S.shoveR);
        e.body.applyLinearImpulse(Vec2((dx / d) * m, (dy / d) * m + 0.4 * m * this.gy), p, true);
        this.emit('stkShove', { egg: e, x: p.x, y: p.y });
      }
      this.emit('stkBlast', { x, y, thorns: n });
    } else if (id === 'decoy') {
      // it lands in the vault by the target and poses as an egg
      const n = this.rings.length, d = Math.hypot(x, y) || 1, outer = (this.rings[n - 2] ? (this.rings[n - 2].r + this.rings[n - 1].r) / 2 : this.rings[0].r * 0.5);
      const r = d > outer ? outer : d, lx = (x / d) * r, ly = (y / d) * r;
      this.p2Pop('new');
      this.p2.decoy = { t: S.t, max: S.t, pepper: 0, stk: 1 };
      this.p2DecoyBody([lx, ly, 0, 0, 0.5, 0]);
      K.dcy = 1; K.dcyAt = { x: lx, y: ly };
      if (boss && T) { B.flinch = 0.9; }
      fx('decoy', S.t, { x: lx, y: ly });
      this.emit('decoyOn', { x: lx, y: ly, stk: 1 });
    } else if (id === 'tornado') {
      if (boss) this.stkApply(T, 'bolt', S.boss, id);
      else this.stkTwist(T);
      fx('tornado', 1.4);
      // downside: the nearest ring turns an eighth of a turn by itself
      const d = Math.hypot(x, y);
      let best = null;
      for (const ring of this.rings) if (ring.grabbable && (!best || Math.abs(ring.r - d) < Math.abs(best.r - d))) best = ring;
      if (best && this.bx) { const R = this.bx.rl[best.i]; if (!(R.frost > 0)) { R.spin = Math.max(R.spin, S.spin); R.dir = Math.atan2(y, x) > -Math.PI / 2 ? 1 : -1; this.emit('stkSpin', { ring: best.i, dir: R.dir }); } }
    } else if (id === 'glue') {
      const t = boss ? S.boss : S.t;
      this.stkApply(T, boss ? 'ice' : 'bolt', boss ? t : Math.min(2.6, t), id, true);
      if (!boss) K.gl.push({ key: T.key, t, re: 2.5 });
      // the glue patch stays where the creature was (inside the vault)
      const d = Math.hypot(x, y) || 1, R = Math.min(d, this.outerR - 0.25);
      K.glue.push({ x: (x / d) * R, y: (y / d) * R, r: S.r, t, max: t });
      fx('glue', t);
    }
  },
  // a boss with hp takes one (a strike in its telegraph): the owl jams a gear, a thief boss is hurt, the King Crab loses a
  // shell, Grandpa Gator a tooth. Returns true when it counted.
  stkHurt(T) {
    const B = this.bx && this.bx.boss;
    if (T.type === 'bx' && B && B.kind === 'owl' && this.owl && this.owl.hp > 0) { this.owlJam(B, B.x, B.y, 'strike'); return true; }
    if (T.type === 'thief' && T.ref.boss) return !!this.thHurt(T.ref, 'drop', this.thBody(T.ref));
    if (T.type === 'kc') { const C = this.kc.claws.find((c) => !(c.hitCD > 0) && c.ph !== 'away'); return C ? !!this.kcHitClaw(C, 'zap') : false; }
    if (T.type === 'gator' && T.ref.boss && T.ref.hp > 0 && !(T.ref.hitCD > 0)) { this.bySet(T.ref, 'dizzy'); return !!this.gatorHurt(T.ref, 'strike'); }
    return false;
  },
  // tornado: lifted and dropped in the outermost channel (the creatures that cannot be moved get their own spin, or a stun)
  stkTwist(T) {
    const n = this.rings.length, mid = n > 1 ? (this.rings[n - 2].r + this.rings[n - 1].r) / 2 : this.outerR;
    if (T.type === 'snake') { const S = T.ref; this.p2Fling(S, mid); S.stun = Math.max(S.stun, STRIKE.tornado.t); S.hurt = 'drop'; this.p2Mark('s' + S.id, 'spin', 1.2, S.pts[0].x, S.pts[0].y); return; }
    this.stkApply(T, 'spin', STRIKE.tornado.t, 'tornado');
  },
  // stkRand: the strike's own dice (the sim's rng stays untouched)
  stkRand() { const K = this.stk; K.r = ((K.r || 0x9e3779b9) * 1664525 + 1013904223) >>> 0; return K.r / 4294967296; },

  // ---------- one creature, one status. kind: ice (frozen T), bolt (stunned T), out (knocked out of the vault T), spin.
  // Where a kind makes no sense for a creature it gets a 3 s stun instead. A boss's resistance is made up for, so a boss
  // holds the strike's boss time.
  stkApply(T, kind, Tm, why, quiet) {
    if (!T) return;
    const R = T.ref;
    const stun3 = () => this.stkApply(T, 'bolt', 3, why);
    switch (T.type) {
      case 'snake': {
        const f = this.level.bossFight && this.level.bossFight.kind === 'snake' ? 0.6 : 1;
        if (kind === 'spin') { this.p2Snake(R, kind, Tm); break; }
        this.p2Snake(R, kind, kind === 'out' ? Tm : Tm / f);
        if (kind === 'out') R.hurt = 'drop'; // a blast is not ice: no frozen look, no "Frozen!"
        break;
      }
      case 'sal': {
        if (kind === 'ice') this.p2Sal(R, 'ice', R.boss ? Tm / 0.2 : Tm); // a boss is made up for; a plain one keeps its fire resistance
        else if (kind === 'out' && R.boss) stun3();
        else if (kind === 'bolt') { this.salDaze(R, Tm, 'bolt'); this.p2Mark('c' + R.id, 'zap', 1.2, R.pts[0].x, R.pts[0].y); }
        else this.p2Sal(R, kind, Tm);
        break;
      }
      case 'eagle': if (kind === 'spin') this.p2EagleHit('spin', Tm); else this.p2EagleHit(kind === 'out' ? 'out' : kind, Tm); break;
      case 'thief': this.thiefP2Only(R, kind, Tm); break;
      case 'frog': if (kind === 'ice' || kind === 'bolt') this.frogHit(kind, Tm, R); else stun3(); break;
      case 'octo': if (kind === 'ice') this.octFreeze(R, Tm); else if (kind === 'bolt') this.octStun(R, Tm, 0.3); else stun3(); break;
      case 'fish': {
        const at = this.fishXY(R);
        if (kind === 'ice') this.fishFreeze(R, Tm); else if (kind === 'bolt') this.fishStun(R, Tm, true); else { stun3(); break; }
        this.emit('p2Hit', { kind: kind === 'ice' ? 'ice' : 'zap', x: at.x, y: at.y });
        break;
      }
      case 'hermit': case 'puff': case 'jelly': case 'kc': {
        const keep = [this.hermits, this.puffs, this.jellies, this.kc];
        this.hermits = T.type === 'hermit' ? [R] : []; this.puffs = T.type === 'puff' ? [R] : []; this.jellies = T.type === 'jelly' ? [R] : []; this.kc = T.type === 'kc' ? keep[3] : null;
        try { this.reefP2(kind, T.type === 'kc' && kind === 'ice' ? Tm / 0.6 : Tm); } finally { [this.hermits, this.puffs, this.jellies, this.kc] = keep; }
        break;
      }
      case 'spider': case 'beetle': case 'jack': {
        if (T.type === 'jack' && kind !== 'ice' && kind !== 'bolt') { stun3(); break; }
        const C = this.cw, keep = [C.sp, C.bt, C.jk];
        C.sp = T.type === 'spider' ? [R] : []; C.bt = T.type === 'beetle' ? [R] : []; C.jk = T.type === 'jack' ? [R] : [];
        try { this.cwP2(kind, Tm); } finally { [C.sp, C.bt, C.jk] = keep; }
        break;
      }
      case 'gator': case 'turtle': case 'mosq': {
        const keep = [this.gators, this.turtles, this.mosqs];
        this.gators = T.type === 'gator' ? [R] : []; this.turtles = T.type === 'turtle' ? [R] : []; this.mosqs = T.type === 'mosq' ? [R] : [];
        try { this.bayouP2(kind, T.type === 'gator' && R.boss ? Tm / 0.4 : Tm); } finally { [this.gators, this.turtles, this.mosqs] = keep; }
        break;
      }
      case 'bx': {
        const B = R;
        B.flinch = Math.max(B.flinch, 0.9);
        if (kind === 'ice') { B.stk = Math.max(B.stk || 0, Tm); if (why === 'glue') B.dizzy = Math.max(B.dizzy, Tm); else this.p2Mark('b', 'ice', Tm, B.x, B.y); } // frozen (or glued) where it hovers, its attack clock stopped (boss.js)
        else { B.dizzy = Math.max(B.dizzy, Tm); if (!B.atk) B.t = Math.max(B.t, Tm + 0.8); this.p2Mark('b', 'zap', Math.min(1.2, Tm), B.x, B.y); }
        break;
      }
    }
    void quiet;
  },

  // ---------- state
  stkState() { return this.stk ? JSON.parse(JSON.stringify(this.stk)) : null; },
  stkLoad(S) { if (S) this.stk = JSON.parse(JSON.stringify(S)); },
};
