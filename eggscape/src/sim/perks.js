// Egg skin powers (0.8.10, mykee: "rather than having a cosmetic effect, we should give some powers to these eggs ... each of
// them should have a definite own power up"). Mixed into Sim like strike.js, so `this` is the Sim. opts.perk = the skin worn
// in play (main.js startLevel); without it (the planner, the tests, dev demos) nothing here runs and the sim is unchanged.
// Each power is small: once per level, or a modest passive. Every one fires 'perk' { id, x, y, ... } when it acts, which
// main.js turns into its beat. All state is plain data in this.pk (perkState / perkLoad): a rewind keeps what is used up.
//   speckled  Lucky Freckles  the first crack of the level is shrugged off                       (crack)
//   striped   Bouncy          crack threshold x1.25                                               (constructor: crackV)
//   dino      Thick Shell     the first thorn that would pop an egg only cracks it                  (preSolve thorn)
//   bauble    Shiny           +10% coins on a win                                                 (economy.js perkCoins)
//   candy     Sweet Seconds   +5 s on the clock                                                   (constructor: timeLimit)
//   frosty    Frost Touch     the first villain to touch an egg is frozen 3 s                      (perkStep)
//   galaxy    Star Pull       orbs are taken from 40% farther                                     (perkStep)
//   lava      Hot Shell       the first thorn an egg touches burns away                            (preSolve thorn)
//   thunder   Zap             the first villain to touch an egg is stunned 2.5 s                   (perkStep)
//   treasure  Treasure Sense  +3 coins per egg saved, on a win                                     (economy.js perkCoins)
//   pearl     Pearl Shine     the first break from a hard landing or a fall is only a crack         (breakEgg)
//   gator     Snap Back       the first villain carrying an egg 1.5 s lets it go                   (perkStep)
//   robot     Grip            35% less slide on ice, 35% less push from currents                  (preSolve seg, gripK)
//   golden    Midas           +15% coins on a win                                                 (economy.js perkCoins)
// A start booster always acts first (stone, the golden shell, fire, a bubble ...): a power is only used up when it is
// what saves the egg.
export const PERK = {
  bouncy: 1.25, sweet: 5, frost: 3, zap: 2.5, pull: 1.4, snap: 1.5, grip: 0.35,
  touch: { eagle: 0.75, thief: 0.35, frog: 0.4, octo: 0.5, fish: 0.45, hermit: 0.35, puff: 0.4, jelly: 0.35, spider: 0.3, beetle: 0.35, jack: 0.3, turtle: 0.45, mosq: 0.35, gator: 0.45, snake: 0.3, sal: 0.35, bx: 0.9, kc: 0.9 },
};
export const PERK_IDS = ['speckled', 'striped', 'dino', 'bauble', 'candy', 'frosty', 'galaxy', 'lava', 'thunder', 'treasure', 'pearl', 'gator', 'robot', 'golden'];
const EGG_R = 0.25; // m: an egg's middle to its shell, about
const ORB_REACH = 0.2 + EGG_R; // ORB_R + the egg: where a plain egg's shell meets an orb

export const perkMethods = {
  perkInit() {
    const id = PERK_IDS.includes(this.opts.perk) ? this.opts.perk : null;
    this.pk = id ? { id, used: 0, hold: {}, gripT: 0 } : null;
  },
  perkIs(id) { return !!(this.pk && this.pk.id === id); },
  // a once-a-level power: true (and the beat) the first time only
  perkTake(id, egg, o = {}) {
    const K = this.pk;
    if (!K || K.id !== id || K.used) return false;
    K.used = 1;
    const p = egg && egg.body ? egg.body.getPosition() : { x: o.x || 0, y: o.y || 0 };
    this.emit('perk', { id, egg, x: p.x, y: p.y, ...o });
    return true;
  },
  // robot: currents push 35% less
  gripK() { return this.pk && this.pk.id === 'robot' ? 1 - PERK.grip : 1; },
  // robot: an egg on ice (contact friction ~0) gets a little grip; a servo sparkle now and then while it brakes
  perkSeg(c, egg) {
    if (!this.pk || this.pk.id !== 'robot' || c.getFriction() > 0.15) return;
    c.setFriction(GRIP_FR);
    const v = egg.body.getLinearVelocity();
    if (this.pk.gripT <= 0 && v.x * v.x + v.y * v.y > 0.8) { this.pk.gripT = 1.4; const p = egg.body.getPosition(); this.emit('perk', { id: 'robot', egg, x: p.x, y: p.y, grip: 1 }); }
  },

  perkStep(dt) {
    const K = this.pk;
    if (!K || this.state !== 'play') return;
    if (K.gripT > 0) K.gripT -= dt;
    if (K.id === 'galaxy') this.perkPull();
    else if (!K.used && (K.id === 'frosty' || K.id === 'thunder')) this.perkTouch();
    else if (!K.used && K.id === 'gator') this.perkSnap(dt);
  },
  // galaxy: an orb within 40% more than touching distance flies to the egg
  perkPull() {
    const R = ORB_REACH * PERK.pull;
    for (const e of this.aliveEggs()) {
      if (!e.body || !e.body.isActive()) continue;
      const p = e.body.getPosition();
      for (const o of this.orbs) {
        if (!o.alive || o.taken) continue;
        const q = o.body.getPosition(), d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d >= R || d < ORB_REACH * 0.92) continue; // (a touch is the plain pickup's, through the contact)
        o.taken = true;
        this.emit('perk', { id: 'galaxy', egg: e, x: p.x, y: p.y, ox: q.x, oy: q.y });
        this.takeOrb(e, o);
      }
    }
  },
  // every live villain (sim/strike.js stkTargets), bosses included: stkApply gives them their own resistance, so a
  // boss shrugs most of the freeze or the stun off instead of being left out of the power altogether
  perkFoes() { return this.stkTargets(); },
  // frosty, thunder: the first villain whose body reaches an egg (or holds one) is frozen or stunned in its own look
  perkTouch() {
    const eggs = this.aliveEggs().filter((e) => e.body);
    if (!eggs.length) return;
    for (const V of this.perkFoes()) {
      const r = (PERK.touch[V.type] ?? 0.4) + EGG_R;
      let hit = null;
      if (V.type === 'snake') { for (const e of eggs) { const p = e.body.getPosition(); if (V.ref.pts.some((q, i) => i % 2 === 0 && Math.hypot(q.x - p.x, q.y - p.y) < r)) { hit = e; break; } } }
      else for (const e of eggs) { const p = e.body.getPosition(); if (Math.hypot(V.x - p.x, V.y - p.y) < r) { hit = e; break; } }
      if (!hit) continue;
      const frost = this.pk.id === 'frosty';
      this.stkApply(V, frost ? 'ice' : 'bolt', frost ? PERK.frost : PERK.zap, 'perk');
      this.perkTake(this.pk.id, hit, { vx: V.x, vy: V.y, foe: V.type });
      return;
    }
  },
  // gator: an egg out of the world (in talons, paws, a shell, an arm) or in a beak, for 1.5 s in a row: the nearest
  // villain drops it (its own let-go: a scare)
  perkSnap(dt) {
    const K = this.pk, now = {};
    for (const e of this.aliveEggs()) {
      if (!e.body || e.thf === 2 || e.hc === 3) continue; // stashed in a den or on a pile is not carried
      if (e.body.isActive() && !(e.clamp > 0)) continue;
      const t = (now[e.id] = (K.hold[e.id] || 0) + dt);
      if (t < PERK.snap) continue;
      const p = e.body.getPosition();
      let best = null, bd = 1.2;
      for (const V of this.perkFoes()) { const d = Math.hypot(V.x - p.x, V.y - p.y); if (d < bd) { bd = d; best = V; } }
      if (!best) continue;
      if (best.type === 'turtle' && best.ref.eid) this.tLet(best.ref, 'perk');
      this.stkApply(best, 'scare', 3, 'perk');
      this.perkTake('gator', e, { vx: best.x, vy: best.y, foe: best.type });
      K.hold = {};
      return;
    }
    K.hold = now;
  },

  perkState() { return this.pk ? JSON.parse(JSON.stringify(this.pk)) : null; },
  perkLoad(S) { if (S && this.pk) this.pk = JSON.parse(JSON.stringify(S)); },
};
const GRIP_FR = 0.07; // ice friction for a Robo Egg: about 35% less slide (tools/test-perks.mjs)
