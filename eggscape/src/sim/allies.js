// Farm allies (v3.4): the mama hen's friends. Mixed into Sim (sim.js: Object.assign(Sim.prototype, allyMethods)), so `this`
// is the Sim. Each ally can be called once per level with sim.callAlly(kind, opts) (no UI yet: a dev hook is enough).
// All state is plain numbers/strings in this.ally, copied by allyState() / restored by allyLoad(), so rewind and the
// planner stay exact; nothing here uses Math.random. The renderer (render/allies.js) draws only from this state and from
// allyPlace(), which is a pure function of it.
//
// level.allies = ['rooster', 'goose'] limits which allies the level offers (default: both).
//
// Rooster (upside / downside): flies in, lands on the vault, puffs up and crows. Every creature is stunned 3 s and the
// boss 2 s (Medium; Easy lasts longer, Hard shorter), and the boss skips its next attack. The shockwave also nudges every
// egg a little along its channel, away from where it stands.
// Goose: waddles in on the ground, hisses, then charges once round the outer rim of the vault honking. It knocks ONE of
// the eagle or a snake out of the vault, or honks a thief in the outermost channel into dropping its egg and running home
// (auto-picked, the most dangerous; opts.target = 'snake'|'eagle'|'thief', opts.id = a snake or thief id). The snake and
// the eagle come back later; the thief comes out of its den again. Its charge also bumps every egg sitting in the
// outermost channel (the one it runs past; an egg resting where it does not run feels the thump as it hops on or off):
// forward along the channel, and up off the floor.
import { Vec2 } from 'planck';
import { TAU, wrap, clamp } from './geom.js';
import { bossStun } from './boss.js';

const deg = (d) => (d * Math.PI) / 180;
const sstep = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };

export const ALLY = {
  kinds: ['rooster', 'goose'],
  // [phase, seconds]: the animation timeline (the sim effect happens inside it, see `blast` and the goose hit)
  rooster: { size: 1.15, seq: [['in', 1.5], ['land', 0.4], ['puff', 0.55], ['crow', 1.1], ['strut', 1.2], ['out', 1.4]], blast: 0.22, strut: 0.9, stun: 3, boss: 2, nudge: 1.7 },
  goose: { size: 1.1, seq: [['in', 1.9], ['hiss', 0.8], ['charge', 2.5], ['off', 1.8]], arc: 220, lift: -0.22, hitStop: 0.5, fling: 1.0, away: { snake: 12, eagle: 10, thief: 9 }, bump: 0.9, pop: 0.5 },
  edge: 3.05, // m from the middle where the goose waits on the ground and lands
};
// Easy: stuns last longer and the downside is lighter; Hard the other way round (Medium is the numbers above)
export const ALLY_MODE = { easy: { stun: 1.25, down: 0.6, away: 1.2 }, medium: { stun: 1, down: 1, away: 1 }, hard: { stun: 0.85, down: 1.2, away: 0.85 } };

const dur = (kind, ph) => ALLY[kind].seq.find((p) => p[0] === ph)[1];
const total = (kind) => ALLY[kind].seq.reduce((s, p) => s + p[1], 0);
const rimY = (R, x) => Math.sqrt(Math.max(0, R * R - x * x));

// seconds since the ally was called (animation clock for flapping, steps, the sound ring)
export function allyElapsed(act) {
  let s = 0;
  for (const [ph, d] of ALLY[act.kind].seq) { if (ph === act.ph) return s + act.t; s += d; }
  return s;
}

// ---------- goose geometry: a line up from the ground, 220 deg round the rim (a0 -> a0 + sd * arc), a line down to the ground
export function goosePath(R, groundY, sd) {
  const G = ALLY.goose, rc = R + G.lift, a0 = sd < 0 ? deg(200) : deg(-20), arc = deg(G.arc);
  const tan = (a) => ({ x: -sd * Math.sin(a), y: sd * Math.cos(a) }); // heading round the rim (sd -1: clockwise)
  const pt = (a) => ({ x: rc * Math.cos(a), y: rc * Math.sin(a) });
  const p0 = pt(a0), a1 = a0 + sd * arc, p1 = pt(a1), t0 = tan(a0), t1 = tan(a1);
  const l0 = Math.abs((p0.y - groundY) / t0.y), l1 = Math.abs((p1.y - groundY) / t1.y);
  return { rc, a0, a1, sd, arc, p0, p1, t0, t1, l0, l1, la: arc * rc, D: l0 + arc * rc + l1, R, groundY };
}
// where the goose is after d metres of the charge: feet point (x, y), the surface normal angle `tilt` (0 upright), heading
export function goosePoint(P, d) {
  d = clamp(d, 0, P.D);
  let x, y, ta, upA = P.a0; // ta: heading angle; upA: angle of the outward normal
  if (d < P.l0) { x = P.p0.x - P.t0.x * (P.l0 - d); y = P.p0.y - P.t0.y * (P.l0 - d); ta = Math.atan2(P.t0.y, P.t0.x); upA = P.a0; }
  else if (d < P.l0 + P.la) { const a = P.a0 + P.sd * (d - P.l0) / P.rc; x = P.rc * Math.cos(a); y = P.rc * Math.sin(a); upA = a; ta = Math.atan2(P.sd * Math.cos(a), -P.sd * Math.sin(a)); }
  else { const e = d - P.l0 - P.la; x = P.p1.x + P.t1.x * e; y = P.p1.y + P.t1.y * e; ta = Math.atan2(P.t1.y, P.t1.x); upA = P.a1; }
  let tilt = upA - Math.PI / 2;
  // upright on the ground: ease the tilt in over the first and last stretch of the two straight runs
  const lift = Math.min(1, d / (P.l0 * 0.6), (P.D - d) / (P.l1 * 0.6));
  tilt *= sstep(lift);
  return { x, y, tilt, ta };
}

// ---------- the pose of an ally at its current moment: {x, y} = where its feet touch, tilt = local up (rad, ccw),
// face = +1/-1, anim, k = 0..1 through the animation, fly = airborne. Pure: used by the renderer and the strips.
export function allyPlace(act, R, groundY) {
  const { kind, ph, t } = act, u = clamp(t / dur(kind, ph), 0, 1), tt = allyElapsed(act);
  if (kind === 'rooster') {
    const sd = act.sd, lx = act.lx, face = -sd, ry = rimY(R, lx), rt = -Math.asin(clamp(lx / R, -1, 1)) * 0.8;
    const Q = (a, c, b, s) => ({ x: (1 - s) * (1 - s) * a.x + 2 * (1 - s) * s * c.x + s * s * b.x, y: (1 - s) * (1 - s) * a.y + 2 * (1 - s) * s * c.y + s * s * b.y });
    const flight = (a, c, b, s, anim, fc = face) => { // quadratic arc with a pitch that follows the climb or dive
      const p = Q(a, c, b, s), q = Q(a, c, b, Math.min(1, s + 0.02)), dx = q.x - p.x, dy = q.y - p.y;
      return { x: p.x, y: p.y + 0.06 * Math.sin(tt * 16), tilt: fc * clamp(Math.atan2(dy, Math.abs(dx) + 1e-6) * 0.6, -0.7, 0.7), face: fc, anim, k: u, fly: 1, tt };
    };
    if (ph === 'in') {
      const a = { x: sd * (R + 3.2), y: R + 3.6 }, b = { x: lx, y: ry + 0.32 }, c = { x: lx + sd * 3.2, y: b.y + 1.5 };
      const s = sstep(u * 0.35 + u * 0.65 * u);
      return flight(a, c, b, s, 'fly');
    }
    if (ph === 'land') { const e = 1 - (1 - u) * (1 - u); return { x: lx, y: ry + 0.32 * (1 - e), tilt: rt + face * 0.35 * (1 - e), face, anim: 'land', k: u, fly: u < 0.7 ? 1 : 0, tt }; }
    if (ph === 'puff' || ph === 'crow') return { x: lx, y: ry, tilt: rt, face, anim: ph, k: u, fly: 0, tt };
    const sx = lx + sd * ALLY.rooster.strut, sy = rimY(R, sx), st = -Math.asin(clamp(sx / R, -1, 1)) * 0.8;
    if (ph === 'strut') {
      const x = lx + sd * ALLY.rooster.strut * sstep(u), ph2 = u * 4 * Math.PI;
      return { x, y: rimY(R, x) + Math.max(0, Math.sin(ph2)) * 0.03, tilt: -Math.asin(clamp(x / R, -1, 1)) * 0.8, face: sd, anim: 'strut', k: u, fly: 0, tt };
    }
    // 'out': a crouch and hop, then up and away to the side it was walking toward
    const a = { x: sx, y: sy }, b = { x: sd * (R + 7), y: R + 7 }, c = { x: sx + sd * 1.6, y: sy + 2.6 };
    if (u < 0.14) return { x: sx, y: sy, tilt: st, face: sd, anim: 'crouch', k: u / 0.14, fly: 0, tt };
    const f = flight(a, c, b, sstep((u - 0.14) / 0.86) * 0.7 + 0.3 * Math.pow((u - 0.14) / 0.86, 2), 'fly', sd);
    f.k = u; return f;
  }
  // goose
  const sd = act.sd, face = -sd, P = goosePath(R, groundY, sd), E = ALLY.edge;
  if (ph === 'in') { const x = sd * (E + 4.6 * (1 - sstep(u * 1.04))); return { x, y: groundY, tilt: 0, face, anim: 'waddle', k: u, fly: 0, tt, walk: (1 - u) * 7.5 }; }
  if (ph === 'hiss') return { x: sd * E, y: groundY, tilt: 0, face, anim: 'hiss', k: u, fly: 0, tt };
  if (ph === 'charge') {
    const p = goosePoint(P, act.d);
    return { x: p.x, y: p.y, tilt: p.tilt, face, anim: act.hs > 0 ? 'hit' : 'charge', k: act.hs > 0 ? 1 - act.hs / ALLY.goose.hitStop : act.u, fly: 1, tt, ta: p.ta };
  }
  const x = -sd * (E + 4.6 * sstep(u)); // off: waddles away on the far side
  return { x, y: groundY, tilt: 0, face: -sd, anim: 'waddle', k: u, fly: 0, tt, walk: u * 7.5 };
}

// where the knocked-out creature flies: a throw from (x0, y0) outward and up, an arc, tau seconds after the hit
export function flingAt(act, tau) {
  return { x: act.ox + act.vx * tau, y: act.oy + act.vy * tau - 4.5 * tau * tau };
}

export const allyMethods = {
  allyInit(L) {
    const list = Array.isArray(L.allies) ? L.allies.filter((k) => ALLY[k] && ALLY.kinds.includes(k)) : [...ALLY.kinds];
    this.ally = { avail: list, used: { rooster: 0, goose: 0 }, act: null };
    this.AM = ALLY_MODE[this.mode] || ALLY_MODE.medium;
  },
  allyAvailable(kind) {
    const A = this.ally;
    return !!(A && A.avail.includes(kind) && !A.used[kind]);
  },

  // Call an ally. Returns false (and nothing is used up) when it cannot help right now: already used, another ally is
  // busy, the level is over, or there is nothing on the board for it to act on.
  callAlly(kind, o = {}) {
    const A = this.ally;
    if (!A || !this.allyAvailable(kind) || A.act || this.state !== 'play') return false;
    const act = kind === 'rooster' ? this.roosterPlan() : kind === 'goose' ? this.goosePlan(o) : null;
    if (!act) return false;
    A.used[kind] = 1;
    A.act = act;
    this.emit('allyCall', { kind });
    return true;
  },

  // ---------- who is on the board
  allyBoss() { return this.bx && this.bx.boss; },
  allySnakes() { return this.snakes.filter((S) => !S.gone && S.inside && S.flee < 0 && S.pts.length > 1); },
  allyEagle() { const E = this.eagle; return E && !E.end && E.phase !== 'away' && E.phase !== 'enter' ? E : null; },
  allyThieves() { return this.state === 'play' ? (this.thieves || []).filter((T) => this.thLive(T)) : []; },
  allyHasTarget() {
    return !!(this.allyBoss() || this.allySnakes().length || (this.sals || []).some((C) => this.salLive(C)) || this.allyEagle() || this.allyThieves().length);
  },

  // can this ally act on something right now (pure: builds the plan and drops it)
  allyCan(kind) {
    return this.allyAvailable(kind) && this.state === 'play' && !!(kind === 'rooster' ? this.roosterPlan() : kind === 'goose' ? this.goosePick({}) : null);
  },

  roosterPlan() {
    if (!this.allyHasTarget()) return null;
    const B = this.allyBoss();
    // lands on the side of the vault the boss is not standing on
    const bx = B ? B.x : 0, lx = Math.abs(1.8 - bx) >= Math.abs(-1.8 - bx) ? 1.8 : -1.8;
    return { kind: 'rooster', ph: 'in', t: 0, sd: lx > 0 ? 1 : -1, lx, fx: 0 };
  },

  // the most dangerous thing the goose can reach: [score, kind, thing]
  goosePick(o) {
    const out = [];
    const want = (k) => !o.target || o.target === k;
    if (want('snake')) for (const S of this.allySnakes()) {
      if (o.id != null && S.id !== o.id) continue;
      const hc = this.chAt(S.rad), hunting = this.aliveEggs().some((e) => this.channelOf(e) === hc);
      out.push([2 + (hunting ? 2 : 0) + (S.stun > 0 ? -1 : 0), 'snake', S]);
    }
    const E = this.allyEagle();
    if (E && want('eagle') && E.phase !== 'dazed') out.push([E.phase === 'warn' || E.phase === 'dive' || E.phase === 'strike' || E.phase === 'carry' ? 3.5 : 1.5, 'eagle', E]);
    if (want('thief')) for (const T of this.allyThieves()) { // only the outermost channel is in its reach
      if (T.ch !== this.rings.length - 1 || (o.id != null && o.target === 'thief' && T.id !== o.id)) continue;
      out.push([(T.eid ? 3 : T.ph === 'crouch' || T.ph === 'brace' ? 2.5 : 1.2) + (T.boss ? 0.5 : 0), 'thief', T]);
    }
    out.sort((a, b) => b[0] - a[0]);
    return out[0] || null;
  },
  goosePlan(o) {
    const pick = this.goosePick(o);
    if (!pick) return null;
    const [, vk, V] = pick, R = this.outerR, p = this.allyVictimPos(vk, V);
    return {
      kind: 'goose', ph: 'in', t: 0, sd: p.x > 0 ? -1 : 1, u: 0, d: 0, hs: 0, hit: 0, hitD: 0,
      vk, vid: vk === 'snake' || vk === 'thief' ? V.id : 0, sa: Math.atan2(p.y, p.x), ox: 0, oy: 0, vx: 0, vy: 0, tau: -1,
    };
  },
  allyVictimPos(vk, V) {
    if (vk === 'snake') { const h = V.pts[0] || { x: V.rad * Math.cos(V.a), y: V.rad * Math.sin(V.a) }; return { x: h.x, y: h.y }; }
    if (vk === 'eagle') return { x: V.x, y: V.y };
    return this.thBody(V);
  },
  allyVictim(act) {
    if (act.vk === 'snake') return this.snakes.find((S) => S.id === act.vid) || null;
    if (act.vk === 'thief') return (this.thieves || []).find((T) => T.id === act.vid) || null;
    return act.vk === 'eagle' ? this.eagle : null;
  },

  // ---------- every step (sim.js step(), after predStep)
  allyStep(dt) {
    const A = this.ally;
    if (!A) return;
    const act = A.act;
    if (!act) return;
    act.t += dt;
    const seq = ALLY[act.kind].seq, i = seq.findIndex((p) => p[0] === act.ph);
    if (act.kind === 'rooster') this.roosterStep(act, dt); else this.gooseStep(act, dt);
    if (A.act && act.ph !== 'charge' && act.t >= seq[i][1]) {
      if (i + 1 < seq.length) { act.ph = seq[i + 1][0]; act.t = 0; } else { A.act = null; this.emit('allyGone', { kind: act.kind }); }
    }
  },

  // ---------- Rooster
  roosterStep(act) {
    if (act.fx || act.ph !== 'crow' || act.t < ALLY.rooster.blast) return;
    act.fx = 1;
    if (this.state !== 'play') return;
    const pl = allyPlace(act, this.outerR, this.groundY), n = this.roosterCrow(pl);
    this.emit('allyCrow', { x: pl.x, y: pl.y + 0.9, n });
  },
  // the crow: stun everything, the boss skips its next attack, eggs get nudged along their channels
  roosterCrow(at) {
    const R = ALLY.rooster, M = this.AM, T = R.stun * M.stun, TB = R.boss * M.stun, B = this.allyBoss(), bk = B ? B.kind : '';
    let n = 0;
    for (const S of this.allySnakes()) {
      const T2 = bk === 'snake' ? TB : T; // in the snake boss fight the snakes are the boss
      if (S.spit) { const b = this.barriers[S.spit.b]; if (b) b.venom = 0; S.spit = null; }
      S.stun = Math.max(S.stun, T2); S.hurt = 'crow'; S.strike = 0; S.vsK = -1; S.vsT = Math.max(S.vsT, 2); S.mood = 'shock'; S.moodT = 0.5;
      n++;
    }
    for (const C of this.sals || []) if (this.salLive(C) && C.ph !== 'dive' && C.ph !== 'grin') { this.salDaze(C, C.boss ? TB : T); n++; }
    for (const S of this.schools || []) if (this.fishStun(S, T, false)) n++;
    const E = this.allyEagle();
    if (E) { this.hitEagle('crow', {}); if (E.phase === 'dazed') E.t = bk === 'eagle' ? TB : T; n++; }
    for (const V of this.allyThieves()) { this.thDaze(V, V.boss ? TB : T, 'crow'); n++; } // v3.6: the weasel and the rats
    n += this.frogHit('crow', T); // v3.5: the frog is stunned too
    if (B) { bossStun(this, TB); n++; }
    // the downside: the shockwave nudges every egg along its channel, away from where it stands
    const nr = this.rings.length, v = R.nudge * M.down;
    for (const e of this.aliveEggs()) {
      if (this.channelOf(e) >= nr || e.honey > 0) continue;
      const p = e.body.getPosition(), a = Math.atan2(p.y, p.x), tx = -Math.sin(a), ty = Math.cos(a), m = e.body.getMass() * v;
      const s = tx * (p.x - at.x) + ty * (p.y - at.y) >= 0 ? 1 : -1; // along the channel, away from where the rooster stands
      e.body.applyLinearImpulse(Vec2(tx * s * m, ty * s * m), p, true);
    }
    return n;
  },

  // ---------- Goose
  gooseStep(act, dt) {
    const G = ALLY.goose, R = this.outerR, P = goosePath(R, this.groundY, act.sd), M = this.AM;
    if (act.ph === 'hiss' && !act.hitD) { // lock the victim's angle in when it starts charging; the goose reaches it on the way round
      const V = this.allyVictim(act), p = V ? this.allyVictimPos(act.vk, V) : { x: 0, y: R };
      const s = (act.sd * wrap(Math.atan2(p.y, p.x) - P.a0) + TAU) % TAU; // arc angle from the start of the rim run (0..2pi)
      act.hitD = P.l0 + (s <= P.arc ? s : s - P.arc < TAU - s ? P.arc : 0) * P.rc;
    }
    if (act.ph === 'charge') {
      if (act.hs > 0) act.hs -= dt; // hit stop: the goose stays put a beat while the victim flies
      else {
        const prev = act.d;
        act.u = Math.min(1, act.u + dt / dur('goose', 'charge'));
        act.d = P.D * act.u * act.u * (3 - 2 * act.u); // a slow start off the ground, a fast run along the rim, a soft landing
        this.gooseBump(act, P, prev, act.d, M.down);
        if (!act.hit && act.d >= act.hitD) { act.hit = 1; act.hs = G.hitStop; this.gooseKnock(act, goosePoint(P, act.hitD)); }
      }
      if (act.u >= 1 && act.hs <= 0) { act.ph = 'off'; act.t = 0; }
    }
    if (act.tau >= 0) this.gooseFling(act, dt, M);
  },
  // eggs sitting in the outermost channel get a bump as the goose passes over them
  gooseBump(act, P, d0, d1, k) {
    const G = ALLY.goose, nr = this.rings.length, sd = act.sd;
    for (const e of this.aliveEggs()) {
      if (this.channelOf(e) !== nr - 1 || e.honey > 0) continue;
      const p = e.body.getPosition(), a = Math.atan2(p.y, p.x);
      let s = (sd * wrap(a - P.a0) + TAU) % TAU;
      if (s > P.arc) s = s - P.arc < TAU - s ? P.arc : 0; // under the vault where it does not run: felt as it hops on or off
      const d = P.l0 + s * P.rc;
      if (d <= d0 || d > d1) continue;
      const r = Math.hypot(p.x, p.y) || 1, m = e.body.getMass(), f = G.bump * k, q = G.pop * k;
      // forward along the channel (the way the goose runs), and up off the floor (toward the middle)
      e.body.applyLinearImpulse(Vec2((-sd * Math.sin(a) * f - (p.x / r) * q) * m, (sd * Math.cos(a) * f - (p.y / r) * q) * m), p, true);
      this.emit('allyBump', { x: p.x, y: p.y, egg: e.id });
    }
  },
  // the collision: the victim is thrown out of the vault
  gooseKnock(act, at) {
    const G = ALLY.goose, V = this.allyVictim(act);
    if (!V || this.state !== 'play') { act.tau = -1; return; }
    const p = this.allyVictimPos(act.vk, V), l = Math.hypot(p.x, p.y) || 1;
    act.ox = p.x; act.oy = p.y; act.tau = 0;
    act.vx = (p.x / l) * 7 + (Math.abs(p.x / l) < 0.2 ? -act.sd * 2.5 : 0); act.vy = (p.y / l) * 7 + 4;
    if (act.vk === 'snake') { V.carried = true; V.held = 1; V.carryX = p.x; V.carryY = p.y; V.stun = 0; }
    else if (act.vk === 'eagle') { this.eagleDaze('goose'); }
    else { this.thiefKnock(V); act.tau = -1; } // a thief inside the vault is not thrown: it lets go and bolts for its den
    this.emit('allyKnock', { x: at.x, y: at.y, kind: act.vk });
  },
  // fling the victim along its arc; when it is far enough it leaves and comes back after the away time
  gooseFling(act, dt, M) {
    const G = ALLY.goose, V = this.allyVictim(act);
    act.tau += dt;
    if (!V) { act.tau = -1; return; }
    const pos = flingAt(act, act.tau), done = act.tau >= G.fling, away = G.away[act.vk] * M.away, R = this.outerR;
    if (act.vk === 'snake') {
      V.carryX = pos.x; V.carryY = pos.y;
      if (done) { // out of sight: it waits outside and slithers back in later
        V.carried = false; V.held = 0; V.inside = false; V.pts = []; V.stun = 0; V.back = 0; V.knock = 0; V.strike = 0; V.mood = null; V.moodT = 0; V.hurt = '';
        V.rad = R + 1.0; V.a = act.sa; V.wait = away; V.odo = 0;
      }
    } else if (act.vk === 'eagle') {
      const E = V;
      E.phase = 'dazed'; E.x = pos.x; E.y = pos.y; E.vx = act.vx; E.vy = act.vy - 9 * act.tau; E.face = act.vx >= 0 ? 1 : -1;
      if (done) { const sd = act.vx >= 0 ? 1 : -1; E.phase = 'away'; E.t = away; E.x = sd * (R + 9); E.y = R + 4; E.vx = -sd * 6; E.vy = -1; E.face = -sd; }
    }
    if (done) act.tau = -1;
  },

  // ---------- state (planner / rewind)
  allyState() {
    const A = this.ally;
    return A ? { avail: [...A.avail], used: { ...A.used }, act: A.act ? { ...A.act } : null } : null;
  },
  allyLoad(S) {
    if (!S || !this.ally) return;
    this.ally = { avail: [...S.avail], used: { ...S.used }, act: S.act ? { ...S.act } : null };
  },
};
