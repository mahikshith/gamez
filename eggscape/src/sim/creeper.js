// The creeper family (0.8.18): one core, a form per world. Something that travels a marked stretch of a ring's rim and
// pauses at each end (the readable safe window). Mixed into Sim (sim.js: Object.assign(Sim.prototype, creepMethods)), so
// `this` is the Sim. No imports from sim.js. Every field is plain data in this.creeps (creepState / creepLoad), so rewind
// and the planner stay exact. No randomness.
//
// level.rings[i].creep = { a0, a1, side, v, rest, delay, form }: the stretch from a0 to a1 (deg, ring-local, a0 < a1), on
// the ring's inner face (side 'in', the floor eggs ride on) or its outer face ('out', the ceiling of the channel outside
// it); v = its mean speed (m/s, Medium), rest = the pause at each end (s, Medium), delay = s before it first moves.
// It rides with its ring: turning the ring carries the whole stretch round.
//
// THE CORE (every form)
//   CRAWL  from one end of the stretch to the other, slow off the mark, fastest in the middle, slowing into the end.
//   COIL   at each end it pauses for `rest` s, harmless: the safe window (at least 0.8 s on Medium). The last CREEP.wind s
//          are the wind-up (anticipation before it sets off).
//   BITE   after it harms an egg it holds for a beat, then goes on.
//   BURN   knocked back where it is (burnt, snapped, melted, cooled), then STUMP (harmless) for CREEP.regrow s, GROW, COIL.
//   GONE   the Thorn Snips booster takes it off for the level.
// THE FORMS (FORMS below; at most one small rule of their own)
//   thorn   farm, woods, mushroom: a bramble head; its head breaks an egg (Easy: a crack and a shove). Fire burns it to a
//           stump that regrows; a stone, comet or golden egg snaps it; Snips snip it off.
//   vine    the bayou's swamp vine: the thorn's rule in a mossy skin.
//   frost   frozen lake, blizzard: a crawling cluster of ice spikes. Own rule: a hit CRACKS once and shoves (never breaks
//           outright; three cracks still break). Fire melts it to a puddle that refreezes; Snips knock the spikes off.
//   lava    volcano: a slow glowing flow of floor (wide, no head). Own rule: rolling across is safe; an egg that RESTS on it
//           heats (heatT s) and cracks, again and again. A water egg cools it to dark crust for a while (then it melts
//           again); fire does nothing (a flaming egg does not heat); Snips crust it over for good.
//   anemone sea, reef: a stinging anemone that sways open as it drifts and closes at each end. Own rule: open, its
//           tentacles reach further (CREEP.reach + 0.12 m). Fire, a stone or a comet make it flinch shut (FLINCH s, then
//           it opens and drifts on); Snips trim it off.
//   spark   storm: a spark along the rim (fast, short, long rests: level data). saw (clockwork), shard (crystal cave): the
//           same rule in their skins. Fire does nothing to them; a stone, comet or golden egg snaps them; Snips take them.
// Events: creepGo, creepCoil, creepHit, creepBurn, creepSnap, creepShut (flinch), creepCrust (lava cooled), creepSnip,
// creepGrow, lavaHeat (an egg starts to heat), creeperNear (an egg sits on its stretch with it coming: the teaching hook,
// main.js lessonAsk('creep_' + form); one per approach, never a text toast from here). Every event carries form.
import { RING_TH, clamp, wrap } from './geom.js';

const m3 = (easy, medium, hard) => ({ easy, medium, hard });
export const CREEP = {
  headR: 0.15, // m: the bramble head's radius (the thorn form; each form's own is FORMS[form].hr)
  lift: 0.13, // m: its centre over the rim face
  reach: 0.2, // m: added to headR for an egg's half width (a touch)
  vK: m3(0.72, 1, 1.15), // crawl speed x
  restK: m3(1.45, 1, 0.85), // coil x (Medium: the level's own rest, never under minRest)
  minRest: 0.8, // s: the safe window on Medium
  wind: 0.32, // s: the wind-up at the end of a coil
  bite: 0.55, // s
  burn: 0.75, // s: the char and crumble
  regrow: m3(9, 7, 5.5), // s as a stump
  grow: 1.0, // s: the sprout unfurls
  nearT: 2.2, // s: creeperNear fires when the head will reach an egg within this
  heatT: m3(2.4, 1.5, 1.2), // s an egg rests on the lava flow before it cracks
  flinch: m3(3.2, 2.5, 2), // s an anemone stays shut after fire or a stone
};
// per form: head radius, lift over the rim face, reach (added to headR for an egg's half width), and what fire, a stone
// (or comet) and water do: 'burn' / 'snap' (cut to a stump), 'flinch' (shut a moment), 'crust' (lava cooled), null (nothing)
export const FORMS = {
  thorn: { hr: 0.15, lift: 0.13, reach: 0.2, fire: 'burn', stone: 'snap', water: null, hit: 'break' },
  vine: { hr: 0.15, lift: 0.13, reach: 0.2, fire: 'burn', stone: 'snap', water: null, hit: 'break' },
  frost: { hr: 0.15, lift: 0.12, reach: 0.2, fire: 'burn', stone: 'snap', water: null, hit: 'crack' },
  anemone: { hr: 0.15, lift: 0.12, reach: 0.2, open: 0.12, fire: 'flinch', stone: 'flinch', water: null, hit: 'break' },
  spark: { hr: 0.1, lift: 0.09, reach: 0.2, fire: null, stone: 'snap', water: null, hit: 'break' },
  saw: { hr: 0.13, lift: 0.1, reach: 0.2, fire: null, stone: 'snap', water: null, hit: 'break' },
  shard: { hr: 0.13, lift: 0.12, reach: 0.2, fire: null, stone: 'snap', water: null, hit: 'break' },
  lava: { hr: 0.32, lift: 0, reach: 0.12, pool: 1, fire: null, stone: null, water: 'crust', hit: 'heat' }, // hr: half the flow's length (m)
};
export const formOf = (C) => FORMS[C.form] || FORMS.thorn;
// each form's villain kind (the "i" panel, the level card's faces, info-check): the thorn keeps its first name
export const CREEP_KIND = { thorn: 'creeper', vine: 'swampvine', frost: 'frostcrawler', lava: 'lavaflow', anemone: 'anemone', spark: 'spark', saw: 'sawtooth', shard: 'shard' };
const sstep = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
const HARM = new Set(['crawl']);

export const creepMethods = {
  creepInit(L) {
    this.creeps = [];
    (L.rings || []).forEach((rs, ri) => {
      const o = rs.creep;
      if (!o || !this.rings[ri]) return;
      const ring = this.rings[ri], side = o.side === 'out' ? 'out' : 'in', form = FORMS[o.form] ? o.form : 'thorn', F = FORMS[form];
      const hr = o.w ? o.w / 2 : F.hr, rh = side === 'in' ? ring.r - RING_TH / 2 - F.lift : ring.r + RING_TH / 2 + F.lift;
      const a0 = (Math.min(o.a0, o.a1) * Math.PI) / 180, a1 = (Math.max(o.a0, o.a1) * Math.PI) / 180;
      this.creeps.push({
        id: this.creeps.length, ri, side, rh, a0, a1, form, hr, heat: {}, v: o.v || 0.5, rest: o.rest || 1,
        u: a0, dir: 1, ph: 'coil', t: o.delay ?? 2.5, dur: o.delay ?? 2.5, s: 0, spd: 0, // u: the head's ring-local angle; s: 0..1 along this crawl
        hits: 0, near: 0, bit: 0, snipped: 0, why: '',
      });
    });
  },
  creepM(o) { return o[this.mode] ?? o.medium; },
  creepRest(C) { return Math.max(CREEP.minRest * (this.mode === 'medium' ? 1 : 0), C.rest * this.creepM(CREEP.restK)); },
  creepCrawlT(C) { return Math.max(0.6, ((C.a1 - C.a0) * C.rh) / (C.v * this.creepM(CREEP.vK))); },
  creepSet(C, ph, t) { C.ph = ph; C.t = C.dur = t; },
  // the head in world space (and its heading: +1 = toward a1, counter-clockwise in ring space)
  creepHead(C) {
    const ring = this.rings[C.ri], A = ring.body.getAngle() + C.u;
    return { x: C.rh * Math.cos(A), y: C.rh * Math.sin(A), a: A };
  },
  creepLive(C) { return C.ph !== 'gone' && C.ph !== 'stump' && C.ph !== 'burn'; },
  creepReach(C) { const F = formOf(C); return C.hr + F.reach + (F.open && C.ph === 'crawl' ? F.open : 0); }, // (the reach covers the egg's half width)

  creepStep(dt) {
    if (!this.creeps || !this.creeps.length) return;
    for (const C of this.creeps) {
      if (this.opts.snips && !C.snipped && this.t > 0.9 + 0.25 * C.id && C.ph !== 'gone') { this.creepSnipOff(C); continue; } // Thorn Snips: snipped at the start
      if (this.state !== 'play' || (this.stkFrozen && this.stkFrozen())) continue; // (Tick-Tock's stopped time holds it where it is)
      this.creepOne(C, dt);
      if (formOf(C).pool) this.creepLava(C, dt);
      else if (this.creepLive(C)) this.creepTouch(C);
      if (HARM.has(C.ph) || formOf(C).pool) this.creepNear(C);
    }
  },
  creepOne(C, dt) {
    switch (C.ph) {
      case 'gone': return;
      case 'coil':
        C.spd = 0;
        if ((C.t -= dt) <= 0) { this.creepSet(C, 'crawl', this.creepCrawlT(C)); C.s = 0; this.emit('creepGo', { id: C.id, form: C.form, ...this.creepHead(C), dir: C.dir }); }
        return;
      case 'crawl': {
        const D = C.dur;
        C.s = Math.min(1, C.s + dt / D);
        const f = C.dir > 0 ? sstep(C.s) : 1 - sstep(C.s);
        const u0 = C.u;
        C.u = C.a0 + (C.a1 - C.a0) * f;
        C.spd = Math.abs(C.u - u0) * C.rh / Math.max(1e-6, dt);
        if (C.s >= 1) { C.dir = -C.dir; C.spd = 0; C.near = 0; this.creepSet(C, 'coil', this.creepRest(C)); this.emit('creepCoil', { id: C.id, form: C.form, ...this.creepHead(C) }); }
        return;
      }
      case 'bite': case 'shut': C.spd = 0; if ((C.t -= dt) <= 0) { C.ph = 'crawl'; C.t = C.dur = C.bitDur || this.creepCrawlT(C); } return; // (shut: the anemone's flinch)
      case 'burn': if ((C.t -= dt) <= 0) this.creepSet(C, 'stump', this.creepM(CREEP.regrow)); return;
      case 'stump': if ((C.t -= dt) <= 0) { this.creepSet(C, 'grow', CREEP.grow); this.emit('creepGrow', { id: C.id, form: C.form, ...this.creepHead(C) }); } return;
      case 'grow': if ((C.t -= dt) <= 0) this.creepSet(C, 'coil', this.creepRest(C)); return;
    }
  },
  // eggs against the head: a crawling head breaks them (like a thorn); fire burns it, stone snaps it, any phase it has a head
  creepTouch(C) {
    const H = this.creepHead(C), R = this.creepReach(C), F = formOf(C);
    for (const e of this.eggs) {
      if (!e.alive || e.saved || e.phx || !e.body) continue;
      const p = e.body.getPosition(), dx = p.x - H.x, dy = p.y - H.y, d = Math.hypot(dx, dy);
      if (d > R) continue;
      if (e.fire > 0 && F.fire) { this.creepCut(C, F.fire, e); return; }
      if (e.comet && F.stone) { e.comet = 0; e.safeT = Math.max(e.safeT || 0, 0.3); this.creepCut(C, F.stone, e); return; }
      if (e.stone > 0) { if (F.stone && C.ph !== 'shut') { this.emit('stoneHit', { egg: e }); this.creepCut(C, F.stone, e); return; } continue; }
      if (C.ph !== 'crawl') continue; // curled up (shut, resting): harmless (the safe window)
      // only the front of the head bites (an egg the head has just passed is behind it)
      const tx = -Math.sin(H.a) * C.dir, ty = Math.cos(H.a) * C.dir;
      if ((dx * tx + dy * ty) < -0.06 && d > C.hr + 0.08) continue;
      if (e.safeT > 0 || e.icy > 0) continue;
      if (e.golden) { e.golden = 0; e.safeT = 0.6; this.emit('goldenSave', { egg: e }); this.creepCut(C, F.stone || 'snap', e); return; }
      if (e.bubbleFix) { if (!e.popping) { e.popping = true; e.safeT = 0.4; this.defer(() => { e.popping = false; this.popBubble(e, true); }); } continue; }
      this.creepBite(C, e, H, dx / (d || 1), dy / (d || 1));
      return;
    }
  },
  creepBite(C, e, H, nx, ny) {
    C.hits++;
    C.bitDur = C.dur; this.creepSet(C, 'bite', CREEP.bite); C.spd = 0;
    this.emit('creepHit', { id: C.id, form: C.form, egg: e, x: H.x, y: H.y });
    if ((this.MD.softThorns || formOf(C).hit === 'crack') && !e.chick) { // Easy (and frost on every mode): one crack and a shove off
      const frost = formOf(C).hit === 'crack';
      e.safeT = Math.max(e.safeT || 0, frost ? 1.6 : 0.8); // (frost: time to get clear before the next spike)
      this.defer(() => {
        if (!e.alive || e.saved) return;
        if (this.MD.softThorns ? !frost && e.cracks < 2 : true) this.crack(e, 0, 'spike'); // (Easy: never the breaking one; frost on Easy only shoves)
        const b = e.body, m = b.getMass() * 1.8 * this.vs;
        b.applyLinearImpulse({ x: nx * m, y: ny * m }, b.getPosition(), true);
      });
      return;
    }
    e.safeT = 1;
    this.defer(() => { e.safeT = 0; this.breakEgg(e, 'thorn'); });
  },
  // burnt back (or snapped off) to a stump where it is
  creepCut(C, how, egg = null) {
    if (!how || !this.creepLive(C)) return false;
    const H = this.creepHead(C);
    if (how === 'flinch') { // the anemone shuts where it is, then opens and drifts on
      if (C.ph === 'shut') return false;
      if (C.ph === 'crawl' || C.ph === 'bite') C.bitDur = C.dur;
      if (C.ph === 'coil') { C.t = Math.max(C.t, this.creepM(CREEP.flinch)); C.dur = Math.max(C.dur, C.t); } else this.creepSet(C, 'shut', this.creepM(CREEP.flinch));
      C.spd = 0; C.why = 'flinch';
      this.emit('creepShut', { id: C.id, form: C.form, x: H.x, y: H.y, egg });
      return true;
    }
    this.creepSet(C, 'burn', CREEP.burn); C.spd = 0; C.why = how; C.heat = {};
    this.emit(how === 'burn' ? 'creepBurn' : how === 'crust' ? 'creepCrust' : 'creepSnap', { id: C.id, form: C.form, x: H.x, y: H.y, egg });
    this.chickGain = (this.chickGain || 0) + 2; // the planner counts it like cleared thorns
    return true;
  },
  creepSnipOff(C) {
    C.snipped = 1;
    const H = this.creepHead(C);
    C.ph = 'gone'; C.spd = 0;
    this.emit('stkSnip', { x: H.x, y: H.y, n: 1 });
    this.emit('creepSnip', { id: C.id, form: C.form, x: H.x, y: H.y });
  },
  // fire from elsewhere: everything within r of (x, y) burns (the glow chick's flash, the laser's beam test, a breath)
  creepBurnAt(x, y, r, how = 'burn') {
    let n = 0;
    for (const C of this.creeps || []) {
      if (!this.creepLive(C) || !formOf(C).fire) continue;
      const H = this.creepHead(C);
      if (Math.hypot(H.x - x, H.y - y) < r + C.hr && this.creepCut(C, how === 'burn' ? formOf(C).fire : how)) n++;
    }
    return n;
  },
  creepBurnTest(test) { // test(x, y, reach): the laser's beam
    let n = 0;
    for (const C of this.creeps || []) { if (!this.creepLive(C) || !formOf(C).fire) continue; const H = this.creepHead(C); if (test(H.x, H.y, C.hr) && this.creepCut(C, formOf(C).fire)) n++; }
    return n;
  },
  creepBurnArc(ring, la, half) { // a salamander's breath on a ring section (ring-local angle la, half width rad)
    let n = 0;
    for (const C of this.creeps || []) if (C.ri === ring.i && this.creepLive(C) && formOf(C).fire && Math.abs(wrap(C.u - la)) < half + 0.1 / ring.r && this.creepCut(C, formOf(C).fire)) n++;
    return n;
  },
  // ring-local angle of an egg on this creeper's face (null when it is not on that face's side of the rim)
  creepEggU(C, e) {
    const ring = this.rings[C.ri], p = e.body.getPosition(), d = Math.hypot(p.x, p.y);
    if (Math.abs(d - C.rh) > 0.48) return null;
    return Math.atan2(p.y, p.x) - ring.body.getAngle();
  },
  // seconds until the head reaches ring-local angle u (Infinity when it will not, this crawl or the next)
  creepEta(C, u) {
    const T = this.creepCrawlT(C), m = this.creepReach(C) / Math.max(0.3, C.rh);
    const lo = C.a0 - m, hi = C.a1 + m;
    let w = wrap(u - (C.a0 + C.a1) / 2) + (C.a0 + C.a1) / 2;
    if (w < lo || w > hi) return Infinity;
    w = clamp(w, C.a0, C.a1);
    const at = (f) => { // the crawl time at which f (0..1 along a0 -> a1) is reached, heading dir
      let lo2 = 0, hi2 = 1; for (let i = 0; i < 18; i++) { const mid = (lo2 + hi2) / 2; if (sstep(mid) < f) lo2 = mid; else hi2 = mid; } return ((lo2 + hi2) / 2) * T;
    };
    const f = (w - C.a0) / Math.max(1e-6, C.a1 - C.a0);
    if (C.ph === 'crawl' || C.ph === 'bite') {
      const fNow = (C.u - C.a0) / Math.max(1e-6, C.a1 - C.a0);
      if ((C.dir > 0 && f >= fNow - 0.02) || (C.dir < 0 && f <= fNow + 0.02)) return Math.max(0, (C.dir > 0 ? at(f) - at(fNow) : at(1 - f) - at(1 - fNow))) + (C.ph === 'bite' ? C.t : 0);
      return (C.dir > 0 ? T - at(fNow) : T - at(1 - fNow)) + this.creepRest(C) + (C.dir > 0 ? at(1 - f) : at(f));
    }
    if (C.ph === 'coil') return C.t + (C.dir > 0 ? at(f) : at(1 - f));
    if (C.ph === 'grow') return C.t + this.creepRest(C) + (C.dir > 0 ? at(f) : at(1 - f));
    return Infinity;
  },
  // 0..1: how soon this egg will meet a crawling head (the planner's caution, the danger level)
  creepThreat(e) {
    if (!this.creeps || !e.body) return 0;
    let th = 0;
    for (const C of this.creeps) {
      if (C.ph === 'gone' || C.ph === 'stump' || C.ph === 'burn') continue;
      const u = this.creepEggU(C, e);
      if (u == null) continue;
      if (formOf(C).pool) { // the lava: an egg on it is in danger by how hot it is; one it is coming to, a little
        if (!this.creepLive(C)) continue;
        const h = (C.heat[e.id] || 0) / this.creepM(CREEP.heatT);
        if (this.creepOnPool(C, e)) th = Math.max(th, 0.45 + 0.55 * h);
        else { const eta = this.creepEta(C, u); if (eta !== Infinity) th = Math.max(th, clamp(0.6 - eta / 6, 0, 0.5)); }
        continue;
      }
      const eta = this.creepEta(C, u);
      if (eta === Infinity) continue;
      th = Math.max(th, clamp(1.2 - eta / 3, 0, 1)); // (no threat while it is still far off: the planner may use the stretch)
    }
    return th;
  },
  // the teaching hook: an egg sits on the stretch and the crawling head will reach it soon
  creepNear(C) {
    if (C.near) return;
    for (const e of this.aliveEggs()) {
      if (!e.body) continue;
      const u = this.creepEggU(C, e);
      if (u == null) continue;
      const eta = formOf(C).pool ? ((C.heat[e.id] || 0) > 0.35 ? 0 : Infinity) : this.creepEta(C, u); // the lava: an egg that has started to heat
      if (eta < CREEP.nearT) { // away: the way to turn its ring that carries it off the egg (+1 = counter-clockwise)
        C.near = 1; const H = this.creepHead(C), p = e.body.getPosition(), away = Math.sign(wrap(H.a - Math.atan2(p.y, p.x))) || 1;
        this.emit('creeperNear', { id: C.id, form: C.form, ring: C.ri, egg: e, eta, x: H.x, y: H.y, away }); return;
      }
    }
  },
  // the lava flow: is this egg resting on it (on its face, within its length)?
  creepOnPool(C, e) {
    const ring = this.rings[C.ri], p = e.body.getPosition(), d = Math.hypot(p.x, p.y), rf = C.rh;
    if (C.side === 'in' ? d > rf - 0.04 || d < rf - 0.46 : d < rf + 0.04 || d > rf + 0.46) return false;
    return Math.abs(wrap(Math.atan2(p.y, p.x) - ring.body.getAngle() - C.u)) * rf < C.hr + formOf(C).reach;
  },
  // eggs on the lava: a slow (resting) egg heats, one rolling across hardly does; at heatT it cracks and the heat starts
  // again (Easy: never the breaking crack). A water egg cools the flow to crust. Fire and stone eggs do not heat.
  creepLava(C, dt) {
    const live = this.creepLive(C), T = this.creepM(CREEP.heatT);
    for (const e of this.eggs) {
      if (!e.alive || e.saved || !e.body) { delete C.heat[e.id]; continue; }
      const on = live && !e.phx && this.creepOnPool(C, e);
      let h = C.heat[e.id] || 0;
      if (on && e.water > 0) { delete C.heat[e.id]; this.creepCut(C, 'crust', e); return; }
      if (on && !(e.fire > 0 || e.stone > 0 || e.chick || e.safeT > 0 || e.icy > 0)) {
        const v = e.body.getLinearVelocity(), sp = Math.hypot(v.x, v.y);
        const h0 = h; h += dt * (sp < 0.7 ? 1 : 0.12);
        if (h0 <= 0.3 && h > 0.3) { const p = e.body.getPosition(); this.emit('lavaHeat', { id: C.id, form: C.form, egg: e, x: p.x, y: p.y }); }
        if (h >= T) {
          h = 0; C.hits++;
          const p = e.body.getPosition();
          this.emit('creepHit', { id: C.id, form: C.form, egg: e, x: p.x, y: p.y });
          if (e.golden) { e.golden = 0; e.safeT = 0.6; this.emit('goldenSave', { egg: e }); }
          else if (!this.MD.softThorns || e.cracks < 2) this.crack(e, 0, 'heat');
        }
      } else h = Math.max(0, h - dt * 1.5);
      if (h > 0) C.heat[e.id] = h; else delete C.heat[e.id];
    }
  },

  creepState() { return (this.creeps || []).map((C) => ({ ...C, heat: { ...C.heat } })); },
  creepLoad(S) { if (S && this.creeps) S.forEach((c, i) => { if (this.creeps[i]) Object.assign(this.creeps[i], c, { heat: { ...(c.heat || {}) } }); }); },
};
