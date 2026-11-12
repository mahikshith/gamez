// The KING CRAB (world 8 boss, L40). Mixed into Sim like sim/reef.js (which calls kcInit / kcStep / kcState / kcLoad).
// All state is plain data in this.kc (and egg.hc: 2 = in a claw, 3 = in its pile), so rewind and the planner stay exact.
//
// level.bossFight = { kind: 'kingcrab', delay, hp?, phases: [{ at, attacks: ['snap' | 'snap2' | 'silt'], every, summon }] }
//   boss.js runs the phases and the attack rhythm; this file runs the crab and its two claws.
// The crab sits on top of the vault, its two great claws on long arms that reach round the outside.
//   snap  : a claw rises outside the vault over a gap that lines up with an egg near it (the telegraph: claw raised and
//           open, a target mark on the ring) and thrusts in through that gap. It snaps the egg and drags it out to its
//           pile. If the gap has turned away when it thrusts, it bonks the solid ring and reels.
//   snap2 : both claws at once, and they reach two rings deep where the gaps of both rings line up (Easy: one ring).
//   silt  : it stamps and a silt cloud hides part of the vault for a few seconds (a jellyfish's glow lights it up).
// HOW TO BEAT IT: while a claw is in the vault, turn the ring it came through: the gap closes on it and the claw is STUCK
//   (it drops the egg). A stuck claw is the hit window: drop or roll an egg onto it, or zap it (thunder egg, the live ring,
//   lightning), or a glow flash. A hit costs it one shell (hp), sends the claw back hurt, and it coughs up one egg from its
//   pile. The WARP GATE sends a thrusting claw away (also a hit). FROST NOVA freezes the claws: a frozen claw in the
//   vault shatters loose (a hit) when an egg knocks it. No shells left: it scuttles off and gives back every egg.
// Upside: a claw that grabs and gets stuck lets go right where it is, often next to a gap; its bonk wastes its attack.
// Downside: an egg it drags out is lost until you hit it.
import { RING_TH, TAU, wrap, clamp } from './geom.js';

const m3 = (easy, medium, hard) => ({ easy, medium, hard });
export const KC = {
  hp: m3(2, 3, 3),
  reach: m3(3.2, 4, 4.6), pull: m3(0.85, 1.25, 1.6), // m/s in, m/s out (x0.75 with an egg)
  stuck: m3(6.5, 5, 4), away: m3(6, 4.5, 3.5), warpAway: 10, bonk: m3(2, 1.5, 1.2), snapT: 0.22, hurt: 0.6, // s
  track: 2.6, // rad/s a claw swings round the outside
  snapR: m3(0.5, 0.6, 0.66), near: m3(1.4, 3.2, 3.8), // m: the claw takes an egg this close to its tip; it goes for eggs this close (along the channel) to a gap it can reach through, sweeping the channel once inside
  depth: m3(1, 2, 3), depth1: m3(1, 2, 2), // rings deep that snap2 / snap reach (the outer channels)
  clawW: 0.14, pinch: 0.04, // m: half-width it needs to thrust through a gap; the gap edge pinches it inside len/2 - pinch
  out: 0.5, // m: where a claw waits outside the outer ring
  silt: 3.5, siltR: 1.45,
  hitV: 1.2, hitVW: 0.45, // m/s an egg must hit a stuck claw with (underwater, where eggs only drift: a gentle bump)
  bodyD: 1.3, // m: its body's centre below (on top: above) the outer ring
};
const IN = new Set(['reach', 'sweep', 'snap', 'pull', 'stuck']); // phases with the claw in the vault

export const kcMethods = {
  kcInit(L) {
    const F = L.bossFight, hp = F.hp ?? KC.hp[this.mode] ?? 3, R = this.outerR;
    const up = this.gy || 1; // the crab sits on the side away from "down": on top, or underwater on the sea floor below
    const claw = (id) => ({ id, ph: 'idle', th: (up * Math.PI) / 2 + (id ? -0.8 : 0.8) * up, d: R + KC.out, eid: 0, tgt: 0, t: 0, dur: 1, gr: -1, gi: -1, nx: -1, lim: 0, ri: -1, pin: 0, free: 0, sw: 0, fz: 0, zp: 0, hitCD: 0, cd: 0, warn: 0 });
    this.kc = { hp, hpMax: hp, done: 0, claws: [claw(0), claw(1)], pile: [], silt: null, bx: 0, by: up * (R + KC.bodyD), fz: 0, end: '', sink: 0 };
  },
  kcM(o) { return o[this.mode] ?? o.medium; },
  kcTip(C) { const a = C.th + (C.sw || 0); return { x: C.d * Math.cos(a), y: C.d * Math.sin(a) }; },
  kcHome(C) { const up = this.gy || 1; return (up * Math.PI) / 2 + (C.id ? -0.8 : 0.8) * up; },
  kcIn(C) { return IN.has(C.ph) && C.d < this.outerR + 0.05; },
  // a gap of ring that the claw at world angle th fits through (w = half-width it needs; negative = any overlap)
  kcGapAt(ring, th, w) {
    const ra = ring.body.getAngle();
    for (const g of ring.gaps) {
      if (g.o < 0.5 || g.grate || (g.curtain && g.curtain.alive)) continue;
      if (Math.abs(wrap(ra + g.a - th)) * ring.r < g.len / 2 - w) return g;
    }
    return null;
  },
  // eggs it can go for: free eggs in the outer `depth` channels, close to a floor gap that lines up out to the rim
  kcTargets(depth) {
    const n = this.rings.length, out = [];
    for (const e of this.aliveEggs()) {
      if (!this.reefFit(e) || e.fire > 0) continue;
      const c = this.channelOf(e);
      if (c < n - depth || c >= n) continue;
      const p = e.body.getPosition(), ea = Math.atan2(p.y, p.x), ring = this.rings[c], ra = ring.body.getAngle();
      ring.gaps.forEach((g, gi) => {
        if (g.o < 0.5 || g.grate || (g.curtain && g.curtain.alive)) return;
        const ga = ra + g.a, de = Math.abs(wrap(ea - ga)) * ring.r;
        if (de > this.kcM(KC.near)) return;
        for (let j = c + 1; j < n; j++) if (!this.kcGapAt(this.rings[j], ga, KC.clawW)) return; // lined up out to the rim
        out.push({ e, c, gi, th: ga, de });
      });
    }
    return out.sort((a, b) => b.c - a.c || a.de - b.de);
  },

  // ---------- boss.js: attacks
  kcStart(B, name) {
    const K = this.kc;
    if (!K || K.done || K.fz > 0) return null;
    if (name === 'silt') {
      if (K.siltCd > 0) return null; // owner: silt came far too often; at most one cloud every 24 s, the claws are the fight
      const e = this.aliveEggs().filter((q) => this.reefFit(q)).sort((a, b) => this.channelOf(b) - this.channelOf(a))[0];
      if (!e) return null;
      const p = e.body.getPosition();
      return { x: p.x, y: p.y, aim: p.x };
    }
    const two = name === 'snap2', depth = this.kcM(two ? KC.depth : KC.depth1), used = new Set(), ids = [];
    for (const T of this.kcTargets(depth)) {
      if (ids.length >= (two ? 2 : 1) || used.has(T.e.id)) continue;
      const side = Math.cos(T.th) < 0 ? 0 : 1;
      const C = [K.claws[side], K.claws[1 - side]].find((q) => q.ph === 'idle' && q.cd <= 0 && !ids.includes(q.id));
      if (!C || (C.id !== side && !two)) continue;
      used.add(T.e.id); ids.push(C.id);
      Object.assign(C, { ph: 'aim', tgt: T.e.id, gr: T.c, gi: T.gi, lim: T.c, nx: this.rings.length - 1, warn: 0, sw: 0 });
    }
    if (!ids.length) return null;
    const C0 = K.claws[ids[0]];
    return { claws: ids, aim: C0.d * Math.cos(C0.th) };
  },
  kcAct(B, A) {
    const K = this.kc;
    if (A.name === 'silt') {
      const M = 1;
      K.silt = { x: A.x, y: A.y, r: KC.siltR, t: KC.silt * M, dur: KC.silt * M };
      this.emit('kcSilt', { x: A.x, y: A.y });
      K.siltCd = 24;
      return;
    }
    for (const id of A.claws || []) {
      const C = K.claws[id];
      if (C.ph !== 'aim') continue;
      if (this.warpStrike && this.warpStrike('kclaw', C)) continue; // v3.4: the warp gate sends the claw away
      C.ph = 'reach'; C.t = 0; C.free = 0;
      this.emit('kcReach', { ...this.kcTip(C), id });
    }
  },

  // ---------- every step (reef.js reefStep)
  kcStep(dt, end) {
    const K = this.kc, B = this.bx && this.bx.boss, R = this.outerR, n = this.rings.length;
    const up = this.gy || 1;
    K.bx = Math.sin(this.t * 0.35) * 0.35; K.by = up * (R + KC.bodyD + (K.done ? Math.min(2.5, (K.sink += dt) * 1.2) : 0));
    if (B) { B.x = K.bx; B.y = K.by; }
    if (K.silt && (K.silt.t -= dt) <= 0) K.silt = null;
    if (K.siltCd > 0) K.siltCd -= dt;
    if (K.fz > 0) K.fz = Math.max(0, K.fz - dt);
    // the target is saved and only eggs in its pile are left: it keeps them and the level ends
    if (!end && this.state === 'play' && this.savedLog.length >= (this.level.target || 1) && this.aliveEggs().length && this.aliveEggs().every((e) => e.hc === 3)) {
      for (const id of K.pile.splice(0)) { const e = this.eggs.find((q) => q.id === id); if (e && e.alive) this.breakEgg(e, 'crab'); }
    }
    for (const C of K.claws) this.kcClaw(C, dt, end, R, n);
    K.pile.forEach((id, i) => { // its pile of stolen eggs, beside its shell
      const e = this.eggs.find((q) => q.id === id && q.alive);
      if (!e) return;
      e.body.setTransform({ x: K.bx + (i % 2 ? 1 : -1) * (2.2 + 0.42 * Math.floor(i / 2)), y: K.by - 0.18 * up }, 0.2 * (i % 2 ? 1 : -1));
      e.ch = n;
    });
    if (end) K.end = this.state === 'winning' || this.state === 'won' ? 'win' : 'lose';
  },
  kcSet(C, ph, t = 0) { C.ph = ph; C.t = C.dur = t; },
  kcSwing(C, goal, dOut, dt) {
    if (C.sw) C.sw = Math.abs(C.sw) < 4 * dt ? 0 : C.sw - Math.sign(C.sw) * 4 * dt;
    C.th = wrap(C.th + clamp(wrap(goal - C.th), -KC.track * dt, KC.track * dt));
    C.d += clamp(dOut - C.d, -2 * dt, 2 * dt);
  },
  kcClaw(C, dt, end, R, n) {
    if (C.cd > 0) C.cd -= dt;
    if (C.hitCD > 0) C.hitCD -= dt;
    if (C.zp > 0) C.zp -= dt;
    const egg = C.eid ? this.eggs.find((q) => q.id === C.eid && q.alive) : null;
    if (C.eid && !egg) C.eid = 0;
    if (end && C.ph !== 'away') { this.kcDrop(C); C.ri = -1; this.kcSet(C, 'away', 99); }
    if (C.fz > 0) { // frozen: held still; a frozen claw in the vault shatters loose when an egg knocks it
      C.fz -= dt;
      if (this.kcIn(C) && this.kcKnocked(C, 0.4)) this.kcHitClaw(C, 'shatter');
      else if (C.fz <= 0) { C.fz = 0; this.emit('reefThaw', this.kcTip(C)); }
      if (egg && C.eid) this.kcHoldEgg(C, egg, 1);
      return;
    }
    switch (C.ph) {
      case 'idle': this.kcSwing(C, this.kcHome(C), R + KC.out + 0.1, dt); break;
      case 'away': this.kcSwing(C, this.kcHome(C), R + KC.out + 0.35, dt); if (!this.kc.done && (C.t -= dt) <= 0) { this.kcSet(C, 'idle'); C.cd = 0.8; } break;
      case 'aim': {
        const B = this.bx && this.bx.boss, A = B && B.atk;
        if (!A || A.ph !== 'warn' || !(A.claws || []).includes(C.id)) { this.kcSet(C, 'idle'); C.cd = 1; C.tgt = 0; break; }
        C.warn = clamp(1 - A.t / A.dur, 0, 1);
        const ring = this.rings[C.gr], g = ring && ring.gaps[C.gi];
        if (g && C.warn < 0.7) C.goal = ring.body.getAngle() + g.a; // it tracks the gap, then locks on
        this.kcSwing(C, C.goal ?? C.th, R + KC.out, dt * 1.4);
        break;
      }
      case 'reach': {
        C.d -= this.kcM(KC.reach) * dt;
        if (this.kcPinch(C)) break;
        // crossing the next ring wall: through a gap, or a bonk on the outer ring (deeper walls just stop it)
        const ring = this.rings[C.nx];
        if (C.nx >= C.lim && ring && C.d <= ring.r + RING_TH / 2 + 0.03) {
          if (this.kcGapAt(ring, C.th, KC.clawW * 0.6)) C.nx--;
          else if (C.nx === n - 1) { C.d = ring.r + RING_TH / 2 + 0.06; this.kcSet(C, 'bonk', this.kcM(KC.bonk)); this.emit('kcBonk', { ...this.kcTip(C), id: C.id }); break; }
          else { C.d = ring.r + RING_TH / 2 + 0.03; this.kcSnap(C, null); break; }
        }
        const tip = this.kcTip(C);
        const e = this.aliveEggs().find((q) => this.reefFit(q) && q.fire <= 0 && Math.hypot(q.body.getPosition().x - tip.x, q.body.getPosition().y - tip.y) < this.kcM(KC.snapR));
        if (e) { this.kcSnap(C, e); break; }
        if (C.nx < C.lim && C.d <= this.reefMid(C.lim)) { C.d = this.reefMid(C.lim); C.ph = 'sweep'; } // as deep as it may go: now along the channel
        break;
      }
      case 'sweep': { // inside the channel: the claw sweeps along it toward its egg
        if (this.kcPinch(C)) break;
        const q = this.eggs.find((x) => x.id === C.tgt), max = this.kcM(KC.near) / C.d + 0.15;
        let goal = C.sw;
        if (q && this.reefFit(q) && this.channelOf(q) === C.lim) { const p = q.body.getPosition(); goal = clamp(wrap(Math.atan2(p.y, p.x) - C.th), -max, max); }
        const st = (this.kcM(KC.reach) * 0.55 * dt) / C.d;
        C.sw += clamp(goal - C.sw, -st, st);
        const tip = this.kcTip(C);
        const e = this.aliveEggs().find((x) => this.reefFit(x) && x.fire <= 0 && Math.hypot(x.body.getPosition().x - tip.x, x.body.getPosition().y - tip.y) < this.kcM(KC.snapR));
        if (e) { this.kcSnap(C, e); break; }
        if (Math.abs(goal - C.sw) < 1e-3 || Math.abs(C.sw) >= max - 1e-3) this.kcSnap(C, null);
        break;
      }
      case 'snap': if (this.kcPinch(C)) break; if (egg) this.kcHoldEgg(C, egg, 1 - C.t / C.dur); if ((C.t -= dt) <= 0) this.kcSet(C, 'pull'); break;
      case 'pull': {
        const v = this.kcM(KC.pull) * (egg ? 0.75 : 1) * (C.free ? 2 : 1);
        if (C.sw) { const st = (v * 1.5 * dt) / C.d; C.sw = Math.abs(C.sw) <= st ? 0 : C.sw - Math.sign(C.sw) * st; } // back along the channel to the gap first
        else C.d += v * dt;
        if (!C.free && this.kcPinch(C)) break;
        if (C.d >= R + KC.out) {
          if (egg) { C.eid = 0; egg.hc = 3; this.kc.pile.push(egg.id); this.emit('kcPile', { x: egg.body.getPosition().x, y: egg.body.getPosition().y, egg, id: C.id }); }
          this.kcSet(C, 'idle'); C.cd = 1.2; C.free = 0; C.tgt = 0;
        }
        break;
      }
      case 'stuck': {
        const ring = this.rings[C.ri];
        C.th = wrap(ring.body.getAngle() + C.pin); // pinched in the ring wall: it rides that ring
        if (this.kcKnocked(C, this.water ? KC.hitVW : KC.hitV)) { this.kcHitClaw(C, 'egg'); break; }
        if (this.kcZapped(C)) { this.kcHitClaw(C, 'zap'); break; }
        if ((C.t -= dt) <= 0) { C.ri = -1; C.free = 1; this.kcSet(C, 'pull'); this.emit('kcFree', { ...this.kcTip(C), id: C.id }); }
        break;
      }
      case 'bonk': if ((C.t -= dt) <= 0) { this.kcSet(C, 'idle'); C.cd = 1; C.tgt = 0; } break;
      case 'hurt': C.d += 2.4 * dt; if ((C.t -= dt) <= 0) this.kcSet(C, 'away', this.kcM(KC.away)); break;
      case 'warp': if ((C.t -= dt) <= 0) this.kcSet(C, 'away', KC.warpAway); break;
    }
    if (C.ph !== 'stuck' && C.ph !== 'snap' && C.ph !== 'warp' && IN.has(C.ph) && this.kcIn(C) && this.kcZapped(C)) this.kcRecoil(C, 'zap');
    const h = C.eid ? this.eggs.find((q) => q.id === C.eid) : null;
    if (h && C.ph !== 'snap') this.kcHoldEgg(C, h, 1);
  },
  kcSnap(C, e) {
    this.kcSet(C, 'snap', KC.snapT);
    if (e) { this.reefTake(e, 2); C.eid = e.id; const p = e.body.getPosition(); C.sx = p.x; C.sy = p.y; this.emit('kcSnap', { x: p.x, y: p.y, egg: e, id: C.id }); }
    else this.emit('kcSnap', { ...this.kcTip(C), id: C.id, miss: 1 });
  },
  kcHoldEgg(C, e, u) {
    const a = C.th + (C.sw || 0), d = Math.max(0.5, C.d - 0.12), x = d * Math.cos(a), y = d * Math.sin(a);
    const k = clamp(u, 0, 1), px = C.sx ?? x, py = C.sy ?? y;
    e.body.setTransform({ x: px + (x - px) * k, y: py + (y - py) * k }, C.th + Math.PI / 2);
    e.body.setLinearVelocity({ x: 0, y: 0 });
    if (k >= 1) { C.sx = null; C.sy = null; }
  },
  // the claw is through a ring whose gap has turned away: stuck there
  kcPinch(C) {
    for (let i = 0; i < this.rings.length; i++) {
      const ring = this.rings[i];
      if (ring.r - RING_TH / 2 > C.d + 0.02 && ring.r < this.outerR + 0.01 && !this.kcGapAt(ring, C.th, KC.pinch)) {
        if (C.ph === 'reach' && ring.r - RING_TH / 2 < C.d + 0.12) continue; // just entering this wall
        this.kcDrop(C);
        C.ri = i; C.pin = wrap(C.th - ring.body.getAngle()); C.free = 0;
        this.kcSet(C, 'stuck', this.kcM(KC.stuck));
        this.emit('kcStuck', { ...this.kcTip(C), id: C.id, ring: i });
        return true;
      }
    }
    return false;
  },
  kcDrop(C) {
    const e = C.eid ? this.eggs.find((q) => q.id === C.eid) : null;
    C.eid = 0; C.sx = null; C.sy = null;
    if (!e || !e.alive) return null;
    const n = this.rings.length, p = e.body.getPosition(), d = Math.hypot(p.x, p.y) || 1, c = this.chAt(d);
    if (c >= 1 && c < n) { const R = this.reefFloor(c) - 0.3; if (d > R) e.body.setTransform({ x: (p.x / d) * R, y: (p.y / d) * R }, e.body.getAngle()); }
    this.reefFree(e, 0, 0, 0.8);
    this.emit('kcDrop', { x: p.x, y: p.y, egg: e, id: C.id });
    return e;
  },
  // arm points inside the vault (tip outward)
  kcArmPts(C) {
    const out = [], R = this.outerR;
    for (let d = C.d; d < R + 0.1; d += 0.28) out.push({ x: d * Math.cos(C.th), y: d * Math.sin(C.th) });
    const sw = C.sw || 0, m = Math.ceil((Math.abs(sw) * C.d) / 0.28);
    for (let i = 1; i <= m; i++) { const a = C.th + (sw * i) / m; out.push({ x: C.d * Math.cos(a), y: C.d * Math.sin(a) }); }
    return out;
  },
  kcKnocked(C, vmin) {
    const pts = this.kcArmPts(C);
    for (const e of this.aliveEggs()) {
      if (!e.body.isActive()) continue;
      const p = e.body.getPosition(), v = e.body.getLinearVelocity(), sp = Math.hypot(v.x, v.y);
      if (pts.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 0.36) && (sp > vmin || e.fire > 0)) return true;
    }
    for (const r of this.rocks || []) {
      if (!r.alive) continue;
      const p = r.body.getPosition(), v = r.body.getLinearVelocity();
      if (Math.hypot(v.x, v.y) > vmin && pts.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 0.32)) return true;
    }
    return false;
  },
  kcZapped(C) {
    const pts = this.kcArmPts(C);
    for (const e of this.aliveEggs()) {
      if (!e.zap || !e.body.isActive()) continue;
      const p = e.body.getPosition();
      if (pts.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 0.45)) { e.zap = 0; return true; }
    }
    return this.rings.some((r) => r.stun > 0 && r.r > C.d - 0.1 && r.r < this.outerR + 0.01);
  },
  // not stuck: a zap or a flash just makes it let go and pull back
  kcRecoil(C, why) {
    if (C.hitCD > 0) return false;
    this.kcDrop(C);
    C.hitCD = 1; C.free = 1; C.zp = why === 'zap' ? 0.3 : 0;
    this.kcSet(C, 'pull');
    this.emit('kcRecoil', { ...this.kcTip(C), id: C.id, why });
    return true;
  },
  // a hit on a stuck (or frozen) claw: one shell gone, one egg back from the pile
  kcHitClaw(C, why) {
    const K = this.kc;
    if (C.hitCD > 0 || K.done) return false;
    K.hp--; C.hitCD = 1.2; C.fz = 0; C.ri = -1;
    this.kcDrop(C);
    const tip = this.kcTip(C);
    this.kcGive(K.pile.shift(), tip, C);
    this.kcSet(C, why === 'warp' ? 'warp' : 'hurt', why === 'warp' ? 1.1 : KC.hurt);
    const B = this.bx && this.bx.boss;
    if (B) { B.flinch = 0.9; if (B.atk && B.atk.ph === 'warn') { B.atk = null; B.t = 2; } }
    this.emit('kcHit', { why, hp: K.hp, max: K.hpMax, ...tip, id: C.id, bx: K.bx, by: K.by });
    if (K.hp <= 0) {
      K.done = 1;
      K.pile.splice(0).forEach((id, i) => this.kcGive(id, null, null, i));
      for (const o of K.claws) if (o !== C) { this.kcDrop(o); o.ri = -1; this.kcSet(o, 'away', 99); }
      this.kcSet(C, 'away', 99);
      if (B) { B.atk = null; B.t = 1e9; }
      this.emit('kcDefeat', { x: K.bx, y: K.by });
    }
    return true;
  },
  // an egg back from the pile: at the claw's tip in the vault, or (defeated) into the outer channel at the top
  kcGive(id, tip, C, i = 0) {
    const e = id ? this.eggs.find((q) => q.id === id && q.alive) : null;
    if (!e) return;
    const n = this.rings.length;
    let x, y;
    if (tip && C && C.d < this.outerR) { const d = Math.max(this.rings[0].r + 0.4, C.d); x = d * Math.cos(C.th); y = d * Math.sin(C.th); }
    else { const r = this.reefFloor(n - 1) - 0.45, a = ((this.gy || 1) * Math.PI) / 2 + (i - 0.5) * 0.35; x = r * Math.cos(a); y = r * Math.sin(a); }
    e.body.setTransform({ x, y }, 0);
    this.reefFree(e, 0, 0, 1.2);
    this.emit('kcGive', { x, y, egg: e });
  },

  // ---------- powers and hazards
  kcWarp(W, C) {
    const tip = this.kcTip(C);
    this.warpGate('in', tip.x, tip.y, 0.6, 0, 1.4, { pull: 0 });
    this.emit('warpOpen', { ...tip, r: 0.6, kind: 'kclaw' });
    this.kcHitClaw(C, 'warp');
    return true;
  },
  kcP2(kind, T) {
    const K = this.kc;
    if (!K || K.done) return;
    const B = this.bx && this.bx.boss, f = 0.6; // a boss resists
    if (kind === 'ice') {
      K.fz = T * f;
      for (const C of K.claws) { C.fz = T * f; if (C.ph === 'aim') { this.kcSet(C, 'idle'); C.tgt = 0; } }
      if (B) { if (B.atk && B.atk.ph === 'warn') B.atk = null; B.t = Math.max(B.t, T * f + 0.8); }
      this.emit('p2Hit', { kind: 'ice', x: K.bx, y: K.by });
      return;
    }
    for (const C of K.claws) {
      if (C.ph === 'stuck' && (kind === 'bolt' || kind === 'zap')) this.kcHitClaw(C, 'zap');
      else if (this.kcIn(C)) this.kcRecoil(C, kind === 'bolt' ? 'zap' : kind);
      else if (C.ph === 'aim') { this.kcSet(C, 'idle'); C.cd = 2; C.tgt = 0; }
    }
    if (B && (kind === 'bolt' || kind === 'pepper' || kind === 'scare')) { if (B.atk && B.atk.ph === 'warn') B.atk = null; B.t = Math.max(B.t, 2); B.dizzy = Math.max(B.dizzy, kind === 'bolt' ? 2 : 0); }
  },
  kcShock(ri) {
    const K = this.kc, ring = this.rings[ri];
    if (!K || K.done) return;
    for (const C of K.claws) {
      if (C.hitCD > 0) continue;
      const through = ring.r > C.d - 0.1 && C.d < this.outerR + 0.05;
      if (C.ph === 'stuck' && through) this.kcHitClaw(C, 'zap');
      else if (IN.has(C.ph) && through) this.kcRecoil(C, 'zap');
      else if (ri === this.rings.length - 1 && C.ph === 'aim') { C.zp = 0.3; C.hitCD = 1; this.kcSet(C, 'bonk', 2); this.emit('kcRecoil', { ...this.kcTip(C), id: C.id, why: 'zap' }); }
    }
  },
  kcHit(kind, o = {}) {
    const K = this.kc;
    if (!K || K.done) return 0;
    const x = o.x ?? 0, y = o.y ?? 0, r = o.r ?? Infinity;
    let n = 0;
    for (const C of K.claws) {
      if (!this.kcIn(C)) continue;
      if (r < Infinity && !this.kcArmPts(C).some((q) => Math.hypot(q.x - x, q.y - y) < r + 0.3)) continue;
      if (!['bolt', 'flash', 'dash', 'rock', 'ice', 'lava'].includes(kind)) continue;
      if (C.ph === 'stuck' ? this.kcHitClaw(C, kind) : this.kcRecoil(C, kind)) n++;
    }
    return n;
  },

  // ---------- planner / danger
  kcThreat(e) {
    if (!this.kc) return 0;
    if (e.hc === 2 || e.hc === 3) return 1;
    let v = 0;
    for (const C of this.kc.claws) if (C.tgt === e.id) v = Math.max(v, C.ph === 'aim' ? 0.5 : C.ph === 'reach' ? 0.8 : 0);
    return v;
  },
  kcScore() { const K = this.kc; return K ? 600 * (K.hpMax - K.hp) + 200 * K.claws.filter((C) => C.ph === 'stuck').length : 0; },
  kcState() { const K = this.kc; return K ? { ...K, claws: K.claws.map((C) => ({ ...C })), pile: [...K.pile], silt: K.silt ? { ...K.silt } : null } : null; },
  kcLoad(S) { this.kc = { ...S, claws: S.claws.map((C) => ({ ...C })), pile: [...S.pile], silt: S.silt ? { ...S.silt } : null }; },
};
void TAU;
