// v3.4 Warp Gate (the owner's idea): a power orb arms a gate for WARP.arm s (Easy 14 s). The next creature that starts a
// strike opens a portal in its path at that moment, is swallowed (a snake or salamander slithers in, the eagle, frog
// and octopus spiral in) and is spat out of an exit portal on the far side of its channel (the eagle: the far side of
// the sky), dazed; the strike is cancelled. Charges: 1 (Easy 2). Bosses (the boss fights and the boss snake/salamander)
// resist: the attack is cancelled and the boss is pushed back, but it stays where it is.
// Upside: the creature is gone from the egg for a good while and the strike never lands.
// Downside: the entry gate stays open WARP.open s after it swallowed (Easy shorter, Hard longer) and pulls in any egg
// that rolls into it; the egg pops out of a small exit gate on the creature's side of the vault, one channel further in
// (a set-back) except on Easy; and it fires on the very first strike, so it can't be saved for a scarier one.
// Combo "Bait and switch" (decoy + warp): the decoy is moved to the exit portal, so every creature goes after it there.
//
// Mixed into Sim like powers2.js. All state is plain data in this.p2.warp (p2State / p2Load copy it), plus a few flat
// fields on the swallowed creature (snake.warp, eagle.warp, phase 'warp' for the salamander, frog and octopus), so
// rewind and the planner stay exact. Hooks: warpStrike() at each creature's strike start (sim.js, salamander.js,
// frog.js, sea.js, boss.js, thieves.js); warpStep() from p2Step.
import { RING_TH, wrap, clamp } from './geom.js';
import { chAtPt } from './shapes.js';

export const WARP = {
  arm: 12, charges: 1, // armed time (s) and strikes it swallows
  swallow: 0.55, emerge: 0.55, // s: sucked in, spat out
  daze: 3, // s the creature is dazed after the spit
  open: 1.5, pull: 0.42, suck: 0.95, // s the entry gate stays open after the swallow, egg grab radius, the weak pull radius (m)
  trail: 0.05, // m between the body points of a snake or salamander
  boss: { back: 1.1, stun: 1.2, wait: 3 }, // the boss is pushed back (m), reels (s), waits (s)
};
const MODE = { easy: { arm: 14, ch: 2 }, medium: { arm: 12, ch: 1 }, hard: { arm: 12, ch: 1 } };
const ease = (u) => u * u * (3 - 2 * u);
const ramp = (u) => Math.pow(clamp(u, 0, 1), 1.6); // sucked in: starts slow, gathers speed

// ---------- polylines (flat [x0, y0, x1, y1, ...])
function lens(c) { const L = [0]; for (let i = 2; i < c.length; i += 2) L.push(L[L.length - 1] + Math.hypot(c[i] - c[i - 2], c[i + 1] - c[i - 1])); return L; }
function along(c, L, s) {
  let i = 1;
  while (i < L.length - 1 && L[i] < s) i++;
  const l = L[i] - L[i - 1] || 1, u = clamp((s - L[i - 1]) / l, 0, 1);
  return [c[2 * i - 2] + (c[2 * i] - c[2 * i - 2]) * u, c[2 * i - 1] + (c[2 * i + 1] - c[2 * i - 1]) * u];
}
const pt = (x, y) => ({ x, y, a: Math.atan2(y, x), r: Math.hypot(x, y), g: 0 });

export const warpMethods = {
  // ---------- the pickup
  warpArm() {
    const P = this.p2, M = MODE[this.mode] || MODE.medium;
    const W = P.warp || (P.warp = { arm: 0, max: 0, ch: 0, gates: [], holds: [], n: 0, id: 0 });
    W.arm = W.max = M.arm;
    W.ch = M.ch; W.maxCh = M.ch;
    return W.arm;
  },
  warpOn() { const W = this.p2.warp; return !!W && W.arm > 0 && W.ch > 0; },
  warpHeld(kind, id) { const W = this.p2.warp; return !!W && W.holds.some((h) => h.k === kind && h.id === id); },

  chMid(c) {
    const n = this.rings.length;
    return c >= n ? this.outerR + 0.35 : c <= 0 ? this.rings[0].r * 0.45 : (this.rings[c - 1].r + this.rings[c].r) / 2;
  },
  // a gate: k 'in' | 'out', r = its radius (m), delay s before it opens, life s open
  warpGate(k, x, y, r, delay, life, extra) {
    const W = this.p2.warp, n = this.rings.length;
    const g = { id: ++W.id, k, x, y, r, t: -delay, life, ch: chAtPt(this.rings, x, y), ...extra };
    if (g.ch >= n) g.ch = n; // outside the vault: nothing to pull
    W.gates.push(g);
    return g;
  },

  // ---------- a creature starts a strike. true: the Warp Gate took it (the caller cancels the strike)
  warpStrike(kind, X, info) {
    const P = this.p2, W = P && P.warp;
    if (!W || !(W.arm > 0) || W.ch <= 0 || this.state !== 'play') return false;
    let ok = false;
    if (kind === 'snake') ok = this.warpCrawler(W, X, 's', this.level.bossFight?.kind === 'snake');
    else if (kind === 'sal') ok = this.warpCrawler(W, X, 'c', !!X.boss);
    else if (kind === 'eagle') ok = this.warpEagle(W, X, info);
    else if (kind === 'frog') ok = this.warpFrog(W, X, info);
    else if (kind === 'oct') ok = this.warpOcto(W, X, info);
    else if (kind === 'boss') ok = this.warpBoss(W, X);
    else if (kind === 'thief') ok = this.warpThief(W, X); // v3.6 (sim/thieves.js): swallowed as it springs, spat out across its run
    else if (this.reefWarp) ok = this.reefWarp(W, kind, X); // world 8 (sim/reef.js, sim/kingcrab.js): the hermit crab, a King Crab claw
    if (!ok) return false;
    W.n++;
    if (--W.ch <= 0) { W.arm = 0; this.emit('powerOff', { power: 'warp' }); }
    return true;
  },

  // common: the entry gate (opens now, stays open past the swallow), the exit gate (opens when the swallow ends)
  warpOpen(W, h, gx, gy, ex, ey, r) {
    const M = this.p2M, SW = WARP.swallow, EM = WARP.emerge, open = WARP.open * M.down;
    h.t = 0; h.g = [gx, gy]; h.x = [ex, ey];
    const gin = this.warpGate('in', gx, gy, r, 0, SW + open, { pull: 1 });
    this.warpGate('out', ex, ey, r, SW, EM + open + 0.15, { pull: 0 });
    gin.ex = ex; gin.ey = ey;
    W.holds.push(h);
    this.emit('warpOpen', { x: gx, y: gy, r, kind: h.k });
    this.warpBait(ex, ey);
  },
  // Bait and switch (decoy + warp): the decoy goes through to the exit
  warpBait(ex, ey) {
    const P = this.p2, D = this.p2d;
    if (!P.decoy || !D || !D.alive) return;
    const p = D.body.getPosition();
    // an exit up in the sky (the eagle) is no place for it: the far side of the vault at the decoy's own height
    let x = ex, y = ey;
    if (Math.hypot(ex, ey) > this.outerR - 0.3) { const a = Math.atan2(p.y, p.x) + Math.PI, r = Math.min(Math.hypot(p.x, p.y), this.outerR - 0.5); x = r * Math.cos(a); y = r * Math.sin(a); }
    D.body.setTransform({ x, y: y + 0.15 }, 0);
    D.body.setLinearVelocity({ x: 0, y: 0 });
    D.body.setAngularVelocity(0);
    P.decoy.t = Math.max(P.decoy.t, 4);
    this.warpGate('out', x, y, 0.4, WARP.swallow, 1.2, { pull: 0 });
    this.emit('warpBait', { x: p.x, y: p.y, x2: x, y2: y });
  },
  // the far side of a channel: angle and radius of the exit
  warpFar(a, r) {
    const ea = a + Math.PI + (this.rand() - 0.5) * 0.9;
    return { a: ea, r, x: r * Math.cos(ea), y: r * Math.sin(ea) };
  },

  // ---------- snakes and salamanders: a body of points that slides into the gate and out of the exit
  warpCrawler(W, X, tag, boss) {
    const sal = tag === 'c', T = X.pts;
    const hd = T[0], q = T[Math.min(T.length - 1, 4)], dl = Math.hypot(hd.x - q.x, hd.y - q.y) || 1;
    const ux = (hd.x - q.x) / dl, uy = (hd.y - q.y) / dl;
    const reach = sal ? 0.5 * X.size : 0.42 * X.size, gx = hd.x + ux * reach, gy = hd.y + uy * reach;
    if (boss) { // resists: the strike is lost and it is shoved back, no teleport
      this.warpGate('in', gx, gy, 0.5, 0, 1.1, { pull: 0 });
      this.emit('warpOpen', { x: gx, y: gy, r: 0.5, kind: 'boss' });
      this.emit('warpResist', { x: gx, y: gy });
      if (sal) { this.salRelease(X); X.back = 1.1 * X.size; X.next = Math.max(X.next, 3); this.salSet(X, 'retreat'); }
      else { X.strike = 0; X.back = Math.max(X.back, 2.2 * this.PM.back); X.stun = Math.max(X.stun, 0.6); X.hurt = 'drop'; X.mood = 'shock'; X.moodT = 0.7; }
      return true;
    }
    const rad = this.chMid(this.chAt(X.rad)), far = this.warpFar(X.a, rad), dir = sal ? X.dir : 1;
    const m = T.length, step = WARP.trail, len = (m - 1) * step;
    const h = { k: tag, id: X.id, t: 0, c: [gx, gy], ea: far.a, er: rad, dir, m, len, out: 0 };
    for (const p of T) h.c.push(p.x, p.y);
    if (sal) { this.salRelease(X); X.ph = 'warp'; X.climb = null; X.pend = null; X.t = 0; }
    else {
      X.warp = 1; X.strike = 0; X.stun = 99; X.back = 0; X.knock = 0; X.shove = 0; X.spit = null; X.mood = 'shock'; X.moodT = 0.3; X.hurt = '';
    }
    this.warpOpen(W, h, gx, gy, far.x, far.y, sal ? 0.6 : 0.5);
    return true;
  },
  warpCrawlStep(h) {
    const sal = h.k === 'c', X = sal ? (this.sals || []).find((c) => c.id === h.id) : this.snakes.find((s) => s.id === h.id);
    if (!X) return true;
    const SW = WARP.swallow, EM = WARP.emerge, step = WARP.trail, T = X.pts;
    h.t += 1 / 120;
    if (h.t < SW) { // slither in head first: each point moves on along the path (gate, head, body)
      const L = lens(h.c), f = ramp(h.t / SW) * (L[L.length - 1] + 0.1), gx = h.c[0], gy = h.c[1];
      T.length = h.m;
      for (let j = 0; j < h.m; j++) {
        const s = L[j + 1] - f, [x, y] = s <= 0 ? [gx + (j + 1) * 1e-4, gy] : along(h.c, L, s);
        T[j] = pt(x, y);
      }
      return false;
    }
    if (!h.out) { h.out = 1; this.emit('warpIn', { x: h.g[0], y: h.g[1], kind: h.k }); this.emit('warpOut', { x: h.x[0], y: h.x[1], kind: h.k }); }
    const u = clamp((h.t - SW) / EM, 0, 1), f = ease(u) * h.len, er = h.er;
    const at = (s) => { const a = h.ea + (h.dir * s) / er; return [er * Math.cos(a), er * Math.sin(a)]; };
    T.length = h.m;
    for (let j = 0; j < h.m; j++) { const [x, y] = at(clamp(f - j * step, 0, h.len - j * step)); T[j] = pt(x, y); }
    if (u < 1) return false;
    // done: laid down whole in the channel, head leading, dazed
    const a1 = h.ea + (h.dir * h.len) / er, daze = WARP.daze * this.p2M.up;
    if (sal) {
      for (let j = 0; j < h.m; j++) this.salPt(T[j], a1 - (h.dir * j * step) / er, er);
      X.rad = er; X.a = a1; X.car = -1;
      this.salSet(X, 'daze', daze);
      X.next = Math.max(X.next, daze + 1.5);
    } else {
      for (let j = 0; j < h.m; j++) this.trailPt(X, T[j], a1 - (j * step) / er, er);
      X.rad = er; X.a = a1; X.warp = 0;
      X.stun = daze; X.hurt = 'drop'; X.mood = 'ouch'; X.moodT = 0.5; X.wait = 0; X.blocked = 0; X.tgt = 0;
    }
    return true;
  },

  // ---------- the eagle: spirals into the gate in front of it, comes out on the other side of the sky
  warpEagle(W, E, tg) {
    if (!tg || !(tg.kind === 'egg' || tg.kind === 'chick' || tg.kind === 'decoy')) return false;
    const R = this.outerR;
    const dx = tg.x - E.x, dy = tg.y - E.y, d = Math.hypot(dx, dy) || 1, reach = 1.5;
    const gx = E.x + (dx / d) * reach, gy = E.y + (dy / d) * reach;
    const sd = E.x >= 0 ? -1 : 1, ex = sd * clamp(Math.abs(E.x) + 2.5, 3, Math.max(3.2, R * 0.85)), ey = Math.max(E.y, R + 1.4);
    E.warp = 1; E.vx = 0; E.vy = 0; E.lk = 0; E.phase = 'up'; E.t = 99; E.res = null;
    this.warpOpen(W, { k: 'e', id: 0, s: [E.x, E.y] }, gx, gy, ex, ey, 0.85);
    return true;
  },
  warpEagleStep(h) {
    const E = this.eagle;
    if (!E) return true;
    const SW = WARP.swallow, EM = WARP.emerge;
    h.t += 1 / 120;
    E.vx = 0; E.vy = 0;
    if (h.t < SW) {
      const u = ease(h.t / SW), sp = u * 5;
      E.x = h.s[0] + (h.g[0] - h.s[0]) * u + Math.sin(sp) * 0.25 * (1 - u);
      E.y = h.s[1] + (h.g[1] - h.s[1]) * u + Math.cos(sp) * 0.2 * (1 - u);
      return false;
    }
    if (!h.out) { h.out = 1; this.emit('warpIn', { x: h.g[0], y: h.g[1], kind: 'e' }); this.emit('warpOut', { x: h.x[0], y: h.x[1], kind: 'e' }); }
    const u = clamp((h.t - SW) / EM, 0, 1);
    E.x = h.x[0]; E.y = h.x[1] + 0.35 * u;
    E.face = E.x > 0 ? -1 : 1; // it comes out facing the vault
    if (u < 1) return false;
    E.warp = 0;
    if (!E.end) { this.eagleDaze('warp'); E.next = Math.max(E.next, E.every * 0.6); }
    return true;
  },

  // ---------- the frog: its tongue was about to shoot
  warpFrog(W, F) {
    if (!this.frogBody || this.frogBody.length === 0) return false;
    const m = this.frogMouth(F), nx = F.nx, ny = F.ny, gx = m.x + nx * 0.2, gy = m.y + ny * 0.2;
    let wa = Math.PI - F.wa; // the mirror image across the vertical axis
    if (Math.abs(wrap(wa - F.wa)) < 1.0) wa = F.wa + (F.face >= 0 ? 1 : -1) * 1.1;
    wa = -Math.PI / 2 + clamp(wrap(wa + Math.PI / 2), -1.0, 1.0);
    const ring = this.rings[F.fi], rf = ring.r - RING_TH / 2;
    F.ph = 'warp'; F.t = 0; F.hit = 0; F.got = 0;
    this.warpOpen(W, { k: 'f', id: F.id, la: wrap(wa - ring.body.getAngle()) }, gx, gy, rf * Math.cos(wa), rf * Math.sin(wa) + 0.38, 0.5);
    return true;
  },
  warpFrogStep(h) {
    const F = (this.frogs || []).find((f) => f.id === h.id);
    if (!F) return true;
    const SW = WARP.swallow, EM = WARP.emerge;
    h.t += 1 / 120;
    if (h.t < SW) return false;
    if (!h.out) {
      h.out = 1;
      this.emit('warpIn', { x: h.g[0], y: h.g[1], kind: 'f' });
      F.la = h.la; F.side = -1;
      this.frogSeat(F); this.frogPlace(F);
      const i = this.frogs.indexOf(F);
      this.frogShape(i); this.frogTeleport(i);
      this.emit('warpOut', { x: F.x, y: F.y, kind: 'f' });
    }
    if (h.t < SW + EM) return false;
    F.ph = 'sit'; F.t = 0; F.sc = 0;
    const daze = WARP.daze * this.p2M.up;
    F.next = Math.max(F.next, daze); F.lickCD = Math.max(F.lickCD, daze + 1.5);
    return true;
  },

  // ---------- the octopus: its grab was about to begin
  warpOcto(W, C) {
    const e = this.eggs.find((q) => q.id === C.tgt), p = e && e.body ? e.body.getPosition() : null;
    const cx = C.rad * Math.cos(C.a), cy = C.rad * Math.sin(C.a);
    const dx = p ? p.x - cx : Math.cos(C.a), dy = p ? p.y - cy : Math.sin(C.a), d = Math.hypot(dx, dy) || 1;
    const gx = cx + (dx / d) * 0.5, gy = cy + (dy / d) * 0.5, far = this.warpFar(C.a, C.rad);
    C.ph = 'warp'; C.t = 0; C.tgt = 0;
    this.warpOpen(W, { k: 'o', id: C.id, s: [cx, cy], ea: far.a }, gx, gy, far.x, far.y, 0.6);
    return true;
  },
  warpOctoStep(h) {
    const C = (this.octos || []).find((o) => o.id === h.id);
    if (!C) return true;
    const SW = WARP.swallow, EM = WARP.emerge;
    h.t += 1 / 120;
    const set = (x, y) => { C.rad = Math.hypot(x, y); C.a = Math.atan2(y, x); };
    C.vx = 0; C.vy = 0;
    if (h.t < SW) { const u = ease(h.t / SW); set(h.s[0] + (h.g[0] - h.s[0]) * u, h.s[1] + (h.g[1] - h.s[1]) * u); return false; }
    if (!h.out) { h.out = 1; this.emit('warpIn', { x: h.g[0], y: h.g[1], kind: 'o' }); this.emit('warpOut', { x: h.x[0], y: h.x[1], kind: 'o' }); }
    set(h.x[0], h.x[1]);
    if (h.t < SW + EM) return false;
    this.octSet(C, 'rest', WARP.daze * this.p2M.up);
    return true;
  },

  // ---------- a boss attack (the ones over the vault): cancelled, the boss is pushed back, nothing swallowed
  warpBoss(W, B) {
    const gx = B.x, gy = B.y - 0.95;
    B.atk = null;
    B.t = Math.max(B.t, WARP.boss.wait * (this.mode === 'easy' ? 1.2 : 1));
    B.flinch = Math.max(B.flinch, 0.9);
    B.dizzy = Math.max(B.dizzy, WARP.boss.stun * this.p2M.up);
    B.y += WARP.boss.back; // it hovers back down to its post
    this.warpGate('in', gx, gy, 0.8, 0, 1.2, { pull: 0 });
    this.emit('warpOpen', { x: gx, y: gy, r: 0.8, kind: 'boss' });
    this.emit('warpResist', { x: gx, y: gy });
    return true;
  },

  // ---------- every step (p2Step)
  warpStep(dt) {
    const W = this.p2.warp;
    if (!W) return;
    const DT = 1 / 120;
    if (W.arm > 0 && (W.arm -= DT) <= 0) { W.arm = 0; W.ch = 0; this.emit('powerOff', { power: 'warp' }); }
    for (let i = W.gates.length - 1; i >= 0; i--) { const g = W.gates[i]; if ((g.t += DT) >= g.life) W.gates.splice(i, 1); }
    for (let i = W.holds.length - 1; i >= 0; i--) {
      const h = W.holds[i];
      const done = h.k === 's' || h.k === 'c' ? this.warpCrawlStep(h) : h.k === 'e' ? this.warpEagleStep(h) : h.k === 'f' ? this.warpFrogStep(h) : this.warpOctoStep(h);
      if (done) W.holds.splice(i, 1);
    }
    if (W.gates.length) this.warpPull(W);
  },

  // ---------- the downside: an open entry gate takes any egg rolling into it
  warpPull(W) {
    const n = this.rings.length, M = this.p2M, R = WARP.pull * Math.sqrt(M.down);
    for (const g of W.gates) {
      if (g.k !== 'in' || !g.pull || g.t < 0.08 || g.life - g.t < 0.3 || g.ch >= n) continue;
      for (const e of this.aliveEggs()) {
        if (!e.body.isActive() || e.octo > 0) continue;
        const p = e.body.getPosition(), d = Math.hypot(p.x - g.x, p.y - g.y);
        if (d > WARP.suck || chAtPt(this.rings, p.x, p.y) !== g.ch) continue;
        if (d < R) { this.warpEggThrough(W, g, e); continue; }
        const m = e.body.getMass(), k = (1 - d / WARP.suck) * m * this.g * 1.15;
        e.body.applyForceToCenter({ x: ((g.x - p.x) / d) * k, y: ((g.y - p.y) / d) * k + m * this.g * 0.5 * (1 - d / WARP.suck) }, true);
      }
    }
  },
  warpEggThrough(W, g, e) {
    const n = this.rings.length, p = e.body.getPosition();
    // the egg comes out on the creature's side, one channel further in (a set-back) except on Easy
    const c = clamp(g.ch - (this.mode === 'easy' ? 0 : 1), 0, n - 1);
    const a = Math.atan2(g.ey, g.ex) + (this.rand() - 0.5) * 1.1, r = this.chMid(c);
    const x = r * Math.cos(a), y = r * Math.sin(a) + 0.1;
    if (e.joint) this.unMagnet(e);
    e.body.setTransform({ x, y }, e.body.getAngle());
    e.body.setLinearVelocity({ x: (this.rand() - 0.5) * 1.2, y: 0.4 });
    e.body.setAngularVelocity(0);
    e.safeT = Math.max(e.safeT || 0, 0.9); e.portalCD = Math.max(e.portalCD || 0, 0.7);
    e.freefall = 0; e.drop = 0; e.ch = c; e.crackCD = Math.max(e.crackCD || 0, 0.4);
    this.warpGate('out', x, y, 0.36, 0, 0.9, { pull: 0, egg: 1 });
    this.emit('warpEgg', { x: p.x, y: p.y, x2: x, y2: y, egg: e });
  },
};
