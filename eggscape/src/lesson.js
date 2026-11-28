// Teaching moments in play (0.8.18): the rules and the table of lessons are src/engine/teach.js (pure, tested by
// tools/test-teach.mjs), the guidelines docs/teaching.md. This file plays a moment over the live vault: it finds where the
// subject is and which ring the lesson is on, slows the world (main.js update reads lessonScale), holds the level clock
// (main.js sets sim.clockHold from lessonHoldsClock before each sim step and reports each held step), dims the scene round
// a soft spotlight, and a ghost finger (the coach's hand) does the answer on the real ring. Input stays live: the player
// doing it himself ends the moment with a sparkle.
//
// main.js wires it with lessonKit({...}) once; every call is a no-op outside play.
import * as T from './engine/teach.js';
import { DT } from './sim/sim.js';
import { RING_TH } from './sim/geom.js';

let K = null; // the kit main.js hands in (G, save, toScreen, ...)
export function lessonKit(kit) { K = kit; }

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const ss = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const backOut = (x) => { x = Math.max(0, Math.min(1, x)); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }; // overshoot, settle

// ---- state per level try
export function lessonReset() { const G = K.G; G.lrun = T.newRun(); G.lessonQ = []; G.lesson = null; G.pwPops = []; }
export function lessonOn() { const G = K.G; return !!(G.lesson && !G.lesson.done); }

// A tip key from an event (old once(key, text) sites): a lesson when the table has one, the old tip otherwise.
export function lessonAsk(key, text, ev) {
  const G = K.G;
  if (!G.lrun) lessonReset();
  const spec = T.lessonOf(key);
  if (!spec) { if (text) K.tipToast(text); return; } // not teachable by gesture (yet): the tip as before
  if (G.lrun.n[key]) return; // met already in this try (and queued or taught then)
  T.meet(K.save, G.lrun, key);
  K.persist();
  if (spec.g === 'none') return;
  G.lessonQ.push({ key, ev: ev || {}, until: G.t + T.TEACH.wait });
}
// the level's opening caption: a ghost-finger demo on the real rings, first two visits only (never under level 1's coach)
export function lessonLevel() {
  const G = K.G;
  if (!G.level || G.teach || !G.level.tip) return;
  lessonAsk('lv:' + G.level.id, null, { lv: 1 });
}

// ---- where the subject is, and the ring of the lesson
function find(arr, id) { return (arr || []).find((q) => q.id === id) || null; }
// 0.8.18 Bandit adapter. Today (0.8.17 sim/bandit.js) he reaches up through a gap of the outer ring and the counter is
// turning that ring (any way: the pinch). The perch rewrite has him sit on a ring and crank it; the counter is turning
// that ring against him. Read whichever the sim exposes: B.ring / B.perch.ring (index) and B.crank / B.perch.dir (the way he
// turns it, + = counter-clockwise). Rewire here once the rewrite has merged (names below are guesses).
export function banditLesson(sim) {
  const L = sim && typeof sim.bandLesson === 'function' ? sim.bandLesson() : null; // null until he sits on a ring
  if (!L || !Number.isInteger(L.ring) || L.ring < 0 || L.ring >= sim.rings.length) return null;
  const pt = L.perch && Number.isFinite(L.perch.x) ? L.perch : L.head;
  if (!pt || !Number.isFinite(pt.x)) return null;
  return { x: pt.x, y: pt.y, ring: L.ring, dir: L.counter }; // the answer: turn his ring against his crank
}
// where the subject is now (live for the creatures that move; the event's spot for the rest)
function where(q) {
  const sim = K.G.sim, ev = q.ev, k = q.key;
  if (k === 'chick') { const e = ev.egg; if (e && e.body && e.alive) { const b = e.body.getPosition(); return { x: b.x, y: b.y }; } }
  if (k.startsWith('pw:')) { const e = ev.egg; if (e && e.body && e.alive) { const b = e.body.getPosition(); return { x: b.x, y: b.y }; } }
  if (k.startsWith('lv:')) { const L = K.leadEgg(sim); if (!L) return null; const e = special(sim) || L.egg, p = e.body.getPosition(); return { x: p.x, y: p.y }; }
  if (k === 'snake') { const S = find(sim.snakes, ev.id); const h = S && S.pts && S.pts[0]; if (h) return { x: h.x, y: h.y }; }
  if (k === 'pip') { const P = find(sim.pips, ev.id); if (P && sim.pipBody) return sim.pipBody(P); }
  if (k === 'coco') { const C = find(sim.cocos, ev.id); if (C && sim.cocoBody) return sim.cocoBody(C); }
  if (k === 'urchin') { const U = find(sim.urchins, ev.id); if (U) return { x: U.x, y: U.y }; }
  if (k.startsWith('creep_')) { const C = find(sim.creeps, ev.id); if (C && sim.creepHead) return sim.creepHead(C); } // 0.8.18 creeper: follow it
  if (k.startsWith('bandit')) { const b = banditLesson(sim); if (b) return b; }
  if (k === 'kits') { const L = sim.kitLesson && sim.kitLesson(); if (L) return { x: L.at.x, y: L.at.y }; } // 0.8.18 kits
  if (k === 'salFireUp') { const C = find(sim.sals, ev.id); const h = C && C.pts && C.pts[0]; if (h) return { x: h.x, y: h.y }; } // 0.8.18: the white-hot salamander, live
  return Number.isFinite(ev.x) && Number.isFinite(ev.y) ? { x: ev.x, y: ev.y } : null;
}
// the egg a level's caption is about (a duck egg, a quail...), else none
function special(sim) {
  const kinds = K.G.level.eggKinds;
  if (!kinds || !kinds.length) return null;
  return sim.aliveEggs().find((e) => kinds.includes(e.kind)) || null;
}
function ringOf(spec, q, p) {
  const sim = K.G.sim, n = sim.rings.length, d = Math.hypot(p.x, p.y);
  const floor = Math.max(0, Math.min(n - 1, sim.chAt(d)));
  if (q.key.startsWith('bandit')) { const b = banditLesson(sim); return b ? b.ring : n - 1; }
  if (q.key === 'kits') { const L = sim.kitLesson && sim.kitLesson(); return L ? L.ring : n - 1; } // 0.8.18 kits: the floor they walk on
  if (q.key === 'coco') { const C = find(sim.cocos, q.ev.id); if (C && Number.isInteger(C.ch)) return Math.max(0, Math.min(n - 1, C.at === 'ceil' ? C.ch - 1 : C.ch)); }
  switch (spec.ring) {
    case 'outer': return n - 1;
    case 'ev': return Number.isInteger(q.ev.ring) && q.ev.ring >= 0 && q.ev.ring < n ? q.ev.ring : floor;
    case 'own': { let bi = 0, bd = 1e9; sim.rings.forEach((r, i) => { const dd = Math.abs(r.r - d); if (dd < bd) { bd = dd; bi = i; } }); return bi; }
    default: return floor;
  }
}
// the gap of ring r nearest world angle a (world angle), or null
function nearGap(r, a) {
  if (!r || !r.gaps || !r.gaps.length) return null;
  const ra = r.body.getAngle();
  let best = null, bd = 9;
  for (const g of r.gaps) { const ga = wrap(ra + g.a), dd = Math.abs(wrap(ga - a)); if (dd < bd) { bd = dd; best = ga; } }
  return best;
}
// the finger's path on the ring, fixed when the moment begins: from a0 to a1 (world angles)
function path(spec, q, p, ri) {
  const sim = K.G.sim, r = sim.rings[ri], sa = Math.atan2(p.y, p.x);
  if (spec.g === 'tap' || spec.g === 'look' || !r) return null;
  const ga = nearGap(r, sa);
  let a0 = sa, a1, dir = 0;
  const sw = Math.min(0.85, 2.4 / r.r); // the drag: about a thumb's sweep, never more than ~2.4 m of rim
  if (spec.g === 'away') {
    const s = ga == null ? 1 : Math.sign(wrap(ga - sa)) || 1; // the ring goes the way that carries the gap off
    a0 = sa; a1 = a0 + s * sw; // the finger starts under the subject, in the spotlight
  } else if (spec.g === 'open') {
    if (ga == null) { a1 = sa + sw; } else {
      let d = wrap(sa - ga);
      if (Math.abs(d) < 0.25) d = (Math.sign(d) || 1) * 0.6; // already there: show the little nudge
      d = Math.max(-Math.max(sw, 3.2 / r.r), Math.min(Math.max(sw, 3.2 / r.r), d));
      a1 = sa; a0 = sa - d;
    }
  } else if (spec.g === 'shake') { // 0.8.19 (aggroB): a short swing to and fro (the frozen egg: shake its ice off)
    a1 = a0 + Math.min(0.4, 1.2 / r.r);
  } else { // spin
    const b = q.key.startsWith('bandit') ? banditLesson(sim) : null;
    dir = b && b.dir ? b.dir : q.key.startsWith('creep_') && q.ev.away ? q.ev.away : 0; // 0.8.18 creeper: the way that carries it off the egg
    a1 = a0 + (dir || 1) * sw;
  }
  return { a0, a1, r: r.r, dir };
}
// the thing a tap lesson points at: a fire orb for a thorn vine, else the subject
function tapTarget(q, p) {
  const sim = K.G.sim;
  if (q.key === 'vineClose') {
    let best = null, bd = 1e9;
    for (const o of sim.orbs || []) if (o.alive && /^fire_(red|black)$/.test(o.type)) { const dd = Math.hypot(o.x - p.x, o.y - p.y); if (dd < bd) { bd = dd; best = { x: o.x, y: o.y }; } }
    if (best) return best;
    for (const e of sim.aliveEggs()) if (e.fire > 0) { const b = e.body.getPosition(); return { x: b.x, y: b.y }; }
  }
  if (q.key === 'salFireUp') { // 0.8.18: water cools a white-hot salamander: the water orb (or a water egg) nearest him
    let best = null, bd = 1e9;
    for (const o of sim.orbs || []) if (o.alive && o.type === 'water') { const dd = Math.hypot(o.x - p.x, o.y - p.y); if (dd < bd) { bd = dd; best = { x: o.x, y: o.y }; } }
    if (best) return best;
    for (const e of sim.aliveEggs()) if (e.water > 0) { const b = e.body.getPosition(); return { x: b.x, y: b.y }; }
  }
  return { x: p.x, y: p.y };
}

// ---- the clock: called once per frame from update (wall dt); returns the world's time scale
export function lessonTick(dt) {
  const G = K.G, sim = G.sim;
  if (!G.lrun) return 1;
  pinchTick(dt);
  const m = G.lesson;
  if (m) {
    if (G.screen !== 'play' || !sim || sim.state !== 'play') T.finish(m, false);
    else if (!m.done && m.out == null) { watchAnswer(m); if (m.stay && m.out == null && !where(m.q)) T.finish(m, false); } // (a staying moment whose subject is gone steps aside)
    if (T.tick(m, dt)) { T.end(K.save, G.lrun, m, G.t); G.lesson = null; K.persist(); }
    return m.done ? 1 : T.scaleAt(m);
  }
  if (!G.lessonQ.length || G.screen !== 'play' || !sim || sim.state !== 'play') return 1;
  G.lessonQ = G.lessonQ.filter((q) => q.until > G.t);
  for (const q of G.lessonQ) {
    const spec = T.lessonOf(q.key), p = where(q);
    if (!p || !Number.isFinite(p.x)) continue;
    const ri = ringOf(spec, q, p), held = heldRing();
    const plan = T.want(K.save, G.lrun, q.key, {
      now: G.t, timeLeft: sim.timeLimit ? sim.timeLeft : null, held, ring: spec.g === 'look' || spec.g === 'tap' ? held : ri,
      adapt: K.save.adapt !== false, calm: !!K.save.calm, busy: K.busy(), replayWon: K.won(),
    });
    if (!plan) continue;
    G.lessonQ = G.lessonQ.filter((x) => x !== q);
    const m = T.begin(G.lrun, plan, G.t);
    Object.assign(m, { q, spec, ri, p, path: path(spec, q, p, ri), tap: spec.g === 'tap' ? tapTarget(q, p) : null, ang0: sim.rings[ri] ? sim.rings[ri].body.getAngle() : 0, tapAt: null });
    m.stay = !!m.path; // 0.8.19: a turn lesson stays until the player turns that ring
    G.lesson = m;
    if (plan.lean) K.camMoment(p.x, p.y, plan.hold, 0.45); // a lean, not a zoom
    K.audio.play('hud_pop', { vol: 0.35, pitch: 0.7 });
    return T.scaleAt(m);
  }
  return 1;
}
function heldRing() { const r = K.G.sim.rings.find((q) => q.held || q.keyHeld); return r ? r.i : null; }
// the player's own answer: the lesson's ring turned by hand (the right way when it has one), or the tapped thing
function watchAnswer(m) {
  const sim = K.G.sim, r = sim.rings[m.ri];
  if (m.path && r && (r.held || r.keyHeld)) {
    const to = Number.isFinite(r.target) ? r.target : r.body.getAngle(); // the finger's own drag (the ring itself follows at the slowed world's pace)
    const d = wrap(to - m.ang0), need = m.path.dir;
    if (Math.abs(d) >= T.TEACH.turnOk && (!need || Math.sign(d) === need)) return answered(m);
  }
  if (!m.stay && m.tapAt != null && K.G.t - m.tapAt > 0.08 && !(r && (r.held || r.keyHeld) && m.path)) T.finish(m, false); // a tap elsewhere: it steps aside
}
function answered(m) {
  T.finish(m, true);
  const p = m.p;
  K.G.fx.sparkle(p.x, p.y, 12, '#ffe58a');
  K.audio.play('star', { vol: 0.5, pitch: 1.25 });
  K.buzz && K.buzz('tap');
}
// a pointer went down in play (before the ring grab): a tap lesson's thing answers it; anything else lets it go
export function lessonTap(x, y) {
  const m = K.G.lesson;
  if (K.G.pinchTip && K.G.pinchTip.out == null) K.G.pinchTip.out = K.G.pinchTip.age; // any touch skips the pinch lesson
  if (!m || m.done || m.out != null) return;
  if (m.tap) { const s = K.toScreen(m.tap.x, m.tap.y); if (Math.hypot(s.x - x, s.y - y) < 70 * K.ui.u) return answered(m); }
  m.tapAt = K.G.t;
}
// the time scale this frame (update multiplies the world's dt by it)
export function lessonScale() { const m = K.G.lesson; return m && !m.done ? T.scaleAt(m) : 1; }
export function lessonHoldsClock() { return T.holdsClock(K.G.lesson); }
export function lessonStepped() { const m = K.G.lesson; if (m && !m.done) m.simIn += DT; }

// ---- the picture
export function drawLesson(ctx, W, H) {
  const G = K.G, m = G.lesson, sim = G.sim;
  if (sim) drawPops(ctx);
  if (sim) { drawCoachDim(ctx, W, H); drawPinch(ctx); }
  if (!m || m.done || !sim) return;
  const u = K.ui.u, show = T.showAt(m), calm = m.calm, low = K.low();
  if (show <= 0.01) return;
  // the subject: live
  const p0 = where(m.q);
  if (p0 && Number.isFinite(p0.x)) m.p = { x: p0.x, y: p0.y };
  const c = K.toScreen(m.p.x, m.p.y), k = G.cam.k;
  const R0 = Math.max(52 * u, Math.min(118 * u, 1.05 * k));
  const pop = calm ? 1 : backOut(m.age / 0.32); // the spotlight lands with a small overshoot
  const R = R0 * (calm ? 1 : 1.35 - 0.35 * pop);
  // dim round the spot (calm: one soft flat veil, no hole moving)
  ctx.save();
  const a = (calm ? 0.24 : 0.46) * show;
  if (m.path) drawRingFocus(ctx, W, H, m.ri, show, calm); // 0.8.19: a turn lesson: everything but its ring goes off colour
  else if (calm || low) {
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(c.x, c.y, R, 0, Math.PI * 2, true);
    ctx.fillStyle = `rgba(14,8,4,${a})`; ctx.fill('evenodd');
  } else {
    const g = ctx.createRadialGradient(c.x, c.y, R * 0.9, c.x, c.y, R * 1.9);
    g.addColorStop(0, 'rgba(14,8,4,0)'); g.addColorStop(0.4, `rgba(14,8,4,${a * 0.8})`); g.addColorStop(1, `rgba(14,8,4,${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  // the spotlight's rim: a warm ring, and one ripple out as it lands
  ctx.globalAlpha = (m.path ? 0 : 0.75) * show; ctx.strokeStyle = '#fff1c2'; ctx.lineWidth = 3 * u;
  ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, Math.PI * 2); ctx.stroke();
  if (!calm && !m.path && m.age < 0.6) { const q = m.age / 0.6; ctx.globalAlpha = 0.6 * (1 - q) * show; ctx.lineWidth = (5 - 3 * q) * u; ctx.beginPath(); ctx.arc(c.x, c.y, R * (1 + 0.45 * ss(q)), 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
  // the answer, done by the ghost finger
  const LOOP = 2.1; // s: a staying finger does its drag again and again (press, drag along the ring, lift, a breath)
  const hq = m.out != null && m.ok ? 1 : m.stay ? Math.min(1, ((Math.max(0, m.age - T.TEACH.easeIn * 0.5) % LOOP) / LOOP) * 1.12) : Math.max(0, Math.min(1, (m.age - T.TEACH.easeIn * 0.5) / Math.max(0.3, m.hold)));
  if (m.spec.g === 'power') drawPowerMoment(ctx, m, hq, show, u, calm, c, R);
  else if (m.path) drawTurn(ctx, m, hq, show, u, calm);
  else if (m.tap) drawTap(ctx, m, hq, show, u, calm, c, R);
  // a look lesson: at most three words under the spotlight
  if (m.spec.g === 'look' && m.words) {
    const sz = 22 * u, y = Math.min(c.y + R + 22 * u, G.play.y + G.play.h - 30 * u), x = Math.max(G.play.x + 90 * u, Math.min(G.play.x + G.play.w - 90 * u, c.x));
    const rise = calm ? 1 : backOut(Math.min(1, m.age / 0.35));
    ctx.save(); ctx.globalAlpha = show; ctx.translate(x, y + (1 - rise) * 10 * u);
    ctx.font = `800 ${Math.round(sz)}px ${K.FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = sz * 0.26; ctx.strokeStyle = 'rgba(40,16,4,0.85)'; ctx.strokeText(m.words, 0, 0);
    ctx.fillStyle = '#fff6d6'; ctx.fillText(m.words, 0, 0);
    const w = ctx.measureText(m.words).width;
    ctx.restore();
    if (K.ui.record) K.ui.record({ x: x - w / 2, y: y - sz / 2, w, h: sz }, 'lesson:words', 'lesson:words');
  }
  // the answer landed: a gold ring bursts from the spot
  if (m.ok && m.out != null) {
    const q = Math.min(1, (m.age - m.out) / 0.45);
    ctx.save(); ctx.globalAlpha = (1 - q) * 0.9; ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = (6 - 4 * q) * u;
    ctx.beginPath(); ctx.arc(c.x, c.y, R * (1 + 0.6 * ss(q)), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
}
// the drag along the ring: a faint arc from start to end with an arrow head, the finger presses, drags with a little
// pull back first (anticipation), runs a touch past the end and settles back (overshoot, settle), lifts and fades
function drawTurn(ctx, m, hq, show, u, calm) {
  const G = K.G, P = m.path, ring = G.sim.rings[m.ri];
  const turned = ring ? wrap(ring.body.getAngle() - m.ang0) : 0; // the arc rides the ring as it turns
  const a0 = P.a0 + turned, a1 = P.a1 + turned;
  const at = (a) => K.toScreen(Math.cos(a) * P.r, Math.sin(a) * P.r);
  const span = a1 - a0;
  // where the finger is along the arc, 0..1
  let f;
  if (calm) f = 1;
  else if (hq < 0.2) f = 0;
  else if (hq < 0.3) f = -0.08 * Math.sin(((hq - 0.2) / 0.1) * Math.PI / 2); // the small pull back
  else if (hq < 0.72) f = -0.08 + 1.16 * ss((hq - 0.3) / 0.42); // the drag, a touch past the end
  else f = 1.08 - 0.08 * ss((hq - 0.72) / 0.13); // settles on the end
  if (m.spec.g === 'shake' && !calm) f = hq < 0.2 ? 0 : hq > 0.85 ? 1 : (1 - Math.cos(((hq - 0.2) / 0.65) * 3 * Math.PI)) / 2; // (aggroB) to, fro, to
  const press = !calm && hq > 0.16 && hq < 0.86;
  const fa = calm ? 1 : ss(hq / 0.12) * (1 - ss((hq - 0.88) / 0.12));
  // the arc and its head
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const N = 24, pts = [];
  for (let i = 0; i <= N; i++) pts.push(at(a0 + span * (i / N)));
  const line = (to, lw, col, al) => { ctx.globalAlpha = al; ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); pts.slice(0, Math.max(2, Math.round(to * N) + 1)).forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke(); };
  line(1, 10 * u, 'rgba(40,18,4,0.55)', 0.7 * show);
  line(1, 4.5 * u, '#fff6d6', 0.65 * show);
  if (f > 0) line(Math.min(1, f), 6 * u, '#ffd34d', show);
  const e = pts[N], e0 = pts[N - 2], ang = Math.atan2(e.y - e0.y, e.x - e0.x), hs = 13 * u;
  ctx.globalAlpha = show * (calm ? 1 : 0.55 + 0.45 * ss((f - 0.5) / 0.4));
  ctx.fillStyle = '#ffd34d'; ctx.strokeStyle = 'rgba(40,18,4,0.6)'; ctx.lineWidth = 2.5 * u;
  ctx.beginPath(); ctx.moveTo(e.x + Math.cos(ang) * hs, e.y + Math.sin(ang) * hs);
  ctx.lineTo(e.x + Math.cos(ang + 2.4) * hs, e.y + Math.sin(ang + 2.4) * hs); ctx.lineTo(e.x + Math.cos(ang - 2.4) * hs, e.y + Math.sin(ang - 2.4) * hs); ctx.closePath();
  ctx.stroke(); ctx.fill();
  if (m.spec.g === 'shake') { // (aggroB) a head at both ends: to and fro
    const b = pts[0], b0 = pts[2], ab = Math.atan2(b.y - b0.y, b.x - b0.x);
    ctx.beginPath(); ctx.moveTo(b.x + Math.cos(ab) * hs, b.y + Math.sin(ab) * hs);
    ctx.lineTo(b.x + Math.cos(ab + 2.4) * hs, b.y + Math.sin(ab + 2.4) * hs); ctx.lineTo(b.x + Math.cos(ab - 2.4) * hs, b.y + Math.sin(ab - 2.4) * hs); ctx.closePath();
    ctx.stroke(); ctx.fill();
  }
  ctx.restore();
  const h = at(a0 + span * f);
  K.hand(ctx, h.x, h.y, 46 * u, press, fa * show);
}
// the tap: the finger comes down on the thing twice, a ring opening under it each time
function drawTap(ctx, m, hq, show, u, calm, c, R) {
  const s = K.toScreen(m.tap.x, m.tap.y), dd = Math.hypot(c.x - s.x, c.y - s.y);
  if (dd > R + 30 * u) { // a dotted way from the thing to the subject it answers (the fire to the vine), drawn as it is reached
    const ux = (c.x - s.x) / dd, uy = (c.y - s.y) / dd, L0 = 26 * u, L1 = dd - R - 6 * u, f = calm ? 1 : ss((hq - 0.1) / 0.5);
    ctx.save(); ctx.lineCap = 'round'; ctx.setLineDash([2 * u, 9 * u]); ctx.lineDashOffset = calm ? 0 : -m.age * 30 * u;
    for (const [lw, col, al] of [[7 * u, 'rgba(40,18,4,0.5)', 0.6], [3.5 * u, '#ffd34d', 0.95]]) {
      ctx.globalAlpha = al * show; ctx.strokeStyle = col; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(s.x + ux * L0, s.y + uy * L0); ctx.lineTo(s.x + ux * (L0 + (L1 - L0) * f), s.y + uy * (L0 + (L1 - L0) * f)); ctx.stroke();
    }
    ctx.restore();
  }
  const beat = calm ? 0.5 : (hq * 2) % 1, press = !calm && beat > 0.35 && beat < 0.6;
  const fa = calm ? 1 : ss(hq / 0.1) * (1 - ss((hq - 0.9) / 0.1));
  ctx.save();
  if (!calm && beat > 0.35) { const q = (beat - 0.35) / 0.65; ctx.globalAlpha = (1 - q) * 0.85 * show; ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = (5 - 3 * q) * u; ctx.beginPath(); ctx.arc(s.x, s.y, (14 + 26 * ss(q)) * u, 0, Math.PI * 2); ctx.stroke(); }
  ctx.globalAlpha = 0.8 * show; ctx.strokeStyle = '#fff1c2'; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.arc(s.x, s.y, 20 * u, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  const lift = calm || press ? 0 : beat < 0.35 ? 16 * (1 - ss(beat / 0.35)) : 16 * ss((beat - 0.6) / 0.4); // down, press, up
  K.hand(ctx, s.x, s.y + lift * u, 46 * u, press, fa * show);
}

// ---- 0.8.18 power pickups (no card): the first two pickups of a power are a moment on the egg that took it (the effect,
// its icon and its name), later ones only the icon popping at the egg. main.js calls lessonPower from the 'pickup' event.
export function lessonPower(ev) {
  const G = K.G, sim = G.sim;
  if (!G.lrun) lessonReset();
  if (!ev || !ev.power || !sim) return;
  const key = 'pw:' + ev.power, p = ev.egg && ev.egg.body ? ev.egg.body.getPosition() : { x: ev.x, y: ev.y };
  const ctx = { now: G.t, timeLeft: sim.timeLimit ? sim.timeLeft : null, held: null, ring: null, adapt: K.save.adapt !== false, calm: !!K.save.calm, busy: K.busy(), replayWon: K.won() };
  const P = T.powerPlan(K.save, G.lrun, key, ctx);
  if (P.kind === 'wait') { pop(ev, p); return; }
  T.meet(K.save, G.lrun, key); K.persist();
  if (P.kind === 'pop') { pop(ev, p); return; }
  const q = { key, ev, until: G.t };
  const m = T.begin(G.lrun, P.plan, G.t);
  Object.assign(m, { q, spec: T.lessonOf(key), ri: -1, p: { x: p.x, y: p.y }, path: null, tap: null, ang0: 0, tapAt: null, power: ev.power, gag: GAG[ev.power] || null, gagHit: false });
  G.lesson = m;
  if (P.plan.lean) K.camMoment(p.x, p.y, P.plan.hold, 0.45);
}
function pop(ev, p) { K.G.pwPops.push({ id: ev.power, egg: ev.egg, x: p.x, y: p.y, t0: K.G.t }); }
// the third pickup on: the power's icon pops out of the egg (overshoot, settle), rises a little and fades (0.8 s)
function drawPops(ctx) {
  const G = K.G, u = K.ui.u, calm = !!K.save.calm;
  G.pwPops = (G.pwPops || []).filter((q) => G.t - q.t0 < 0.8);
  for (const q of G.pwPops) {
    const a = (G.t - q.t0) / 0.8;
    if (q.egg && q.egg.body && q.egg.alive) { const b = q.egg.body.getPosition(); q.x = b.x; q.y = b.y; }
    const s = K.toScreen(q.x, q.y), k = calm ? 1 : backOut(a / 0.3), rise = calm ? 0 : 26 * u * ss(a), al = 1 - ss((a - 0.6) / 0.4);
    ctx.save(); ctx.globalAlpha = al;
    K.drawOrb(ctx, q.id, s.x, s.y - 30 * u - rise, 15 * u * k, G.t, true);
    ctx.restore();
  }
}
// what each power's moment shows besides its own effect art (an icon gag where the effect is not self-evident)
const GAG = {
  stone: 'tooth', rockskin: 'tooth', iron: 'tooth', feather: 'tooth', golden: 'tooth',
  fire_red: 'thorn', frostnova: 'thorn', brittle: 'thorn',
  fire_green: 'heal', hourglass: 'clock', bubble: 'up', fire_black: 'down', shrink: 'shrink',
  thunder: 'crack', thorn: 'crack', curse: 'clock2', frost: 'flake', water: 'splash',
};
function drawPowerMoment(ctx, m, hq, show, u, calm, c, R) {
  const G = K.G, name = K.powerName(m.power), id = m.power;
  const right = c.x < (G.play.x + G.play.w / 2); // the icon and name sit on the roomier side of the egg
  const sd = right ? 1 : -1;
  // the gag, in screen space by the egg
  const g = m.gag, ink = 'rgba(40,18,4,0.85)';
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const er = Math.max(22 * u, Math.min(32 * u, 0.34 * G.cam.k)); // the gag's scale: the egg's size on screen, never too small to read
  if (g === 'tooth') { // a snake's fang flies at the shell, pings off it and tumbles away
    const hit = 0.42, f = calm ? 1 : hq;
    if (!m.gagHit && f >= hit && !calm) { m.gagHit = true; K.audio.play('steel_clang', { vol: 0.45, pitch: 1.6 }); }
    let x, y, rot, al;
    if (calm) { x = c.x - sd * er * 1.7; y = c.y - er * 1.2; rot = 0.6; al = 0.85; }
    else if (f < hit) { const k = ss(f / hit); x = c.x - sd * (er * 3.4 - er * 2.3 * k); y = c.y - er * (2.6 - 1.7 * k); rot = -0.5 * sd; al = ss(f / 0.12); }
    else { const k = (f - hit) / (1 - hit); x = c.x - sd * (er * 1.1 + er * 2.2 * k); y = c.y - er * 0.9 - er * 2.0 * Math.sin(k * 2.2) + er * 2.4 * k * k; rot = -0.5 * sd + sd * 7 * k; al = 1 - ss((k - 0.6) / 0.4); }
    ctx.save(); ctx.globalAlpha = show * al; ctx.translate(x, y); ctx.rotate(rot);
    const fs = er * 0.8;
    ctx.beginPath(); ctx.moveTo(-fs * 0.45, -fs * 0.6); ctx.quadraticCurveTo(0, -fs * 0.75, fs * 0.45, -fs * 0.6); ctx.quadraticCurveTo(fs * 0.3, fs * 0.2, 0, fs * 0.95); ctx.quadraticCurveTo(-fs * 0.3, fs * 0.2, -fs * 0.45, -fs * 0.6); ctx.closePath();
    ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.lineWidth = 2 * u; ctx.strokeStyle = ink; ctx.stroke();
    ctx.restore();
    if (!calm && f >= hit && f < hit + 0.25) { // the ping: a white star on the shell
      const k = (f - hit) / 0.25, px = c.x - sd * er * 0.9, py = c.y - er * 0.75;
      ctx.globalAlpha = show * (1 - k); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5 * u;
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3, r0 = 4 * u, r1 = (8 + 12 * k) * u; ctx.beginPath(); ctx.moveTo(px + Math.cos(a) * r0, py + Math.sin(a) * r0); ctx.lineTo(px + Math.cos(a) * r1, py + Math.sin(a) * r1); ctx.stroke(); }
    }
  } else if (g === 'thorn') { // a thorn by the egg; a lick of the power's flame, the thorn chars and crumbles
    const f = calm ? 1 : hq, tx = c.x - sd * er * 1.9, ty = c.y + er * 0.3, burnt = ss((f - 0.3) / 0.35), gone = ss((f - 0.6) / 0.3);
    const ts = er * 0.75 * (1 - 0.7 * gone);
    ctx.globalAlpha = show * (1 - gone);
    ctx.beginPath(); ctx.moveTo(tx - ts * 0.5, ty + ts * 0.5); ctx.lineTo(tx, ty - ts * 0.8); ctx.lineTo(tx + ts * 0.5, ty + ts * 0.5); ctx.closePath();
    ctx.fillStyle = burnt > 0.5 ? '#2a1a14' : '#b3263a'; ctx.fill(); ctx.lineWidth = 2 * u; ctx.strokeStyle = ink; ctx.stroke();
    if (f > 0.2 && f < 0.75 && !calm) { const k = (f - 0.2) / 0.55, fl = Math.sin(k * Math.PI); ctx.globalAlpha = show * fl; K.flame(ctx, tx, ty - ts * 0.2, er * 0.9 * fl, G.t); }
    if (gone > 0 && !calm) { ctx.globalAlpha = show * (1 - gone) * 0.8; ctx.fillStyle = '#5a4a40'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(tx + (i - 2) * 4 * u, ty + ts * 0.5 + gone * 14 * u * (1 + (i % 2)), 1.8 * u, 0, 7); ctx.fill(); } }
  } else if (g === 'heal' || g === 'crack') { // a crack on the shell: it mends (green), or it appears (a bad orb)
    const f = calm ? 1 : hq, k = g === 'heal' ? 1 - ss((f - 0.25) / 0.45) : ss((f - 0.15) / 0.3);
    ctx.globalAlpha = show * k; ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 2.6 * u;
    ctx.beginPath(); ctx.moveTo(c.x - er * 0.5, c.y - er * 0.35); ctx.lineTo(c.x - er * 0.15, c.y - er * 0.05); ctx.lineTo(c.x - er * 0.3, c.y + er * 0.2); ctx.lineTo(c.x + er * 0.15, c.y + er * 0.45); ctx.stroke();
    if (g === 'heal' && f > 0.3) { ctx.globalAlpha = show * (1 - ss((f - 0.7) / 0.3)); ctx.fillStyle = '#8dff8a'; for (let i = 0; i < 4; i++) { const a = G.t * 3 + i * 1.6; ctx.beginPath(); ctx.arc(c.x + Math.cos(a) * er * 0.9, c.y + Math.sin(a) * er * 0.9, 2.6 * u, 0, 7); ctx.fill(); } }
  } else if (g === 'clock' || g === 'clock2') { // seconds fly from the egg to the timer (the curse: the timer runs off faster)
    const to = K.clockAt(); 
    if (to) for (let i = 0; i < 3; i++) {
      const f = calm ? 1 : clamp01((hq - 0.15 - i * 0.12) / 0.45), k = ss(f), from = g === 'clock' ? c : to, dst = g === 'clock' ? to : c;
      const x = from.x + (dst.x - from.x) * k, y = from.y + (dst.y - from.y) * k - Math.sin(k * Math.PI) * 50 * u;
      ctx.globalAlpha = show * (calm ? (i ? 0 : 1) : Math.sin(Math.min(1, f * 1.1) * Math.PI) * 0.95 + (f >= 1 ? 0 : 0.05));
      K.clock(ctx, calm ? to.x : x, calm ? to.y + 24 * u : y, 26 * u);
    }
  } else if (g === 'up' || g === 'down') { // the way the egg is about to go
    const dir = g === 'up' ? -1 : 1;
    for (let i = 0; i < 2; i++) { const f = calm ? 0.5 : (hq * 1.6 + i * 0.5) % 1, yy = c.y + dir * (er * 1.3 + f * er * 1.3 + i * 10 * u); ctx.globalAlpha = show * (calm ? 1 : Math.sin(f * Math.PI)); ctx.beginPath(); ctx.moveTo(c.x - 9 * u, yy - dir * 5 * u); ctx.lineTo(c.x, yy + dir * 4 * u); ctx.lineTo(c.x + 9 * u, yy - dir * 5 * u); ctx.strokeStyle = 'rgba(40,18,4,0.55)'; ctx.lineWidth = 7 * u; ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.4 * u; ctx.stroke(); }
  } else if (g === 'flake') { const f = calm ? 1 : backOut(clamp01(hq / 0.35)); ctx.globalAlpha = show; K.picto(ctx, 'freeze', c.x - sd * er * 1.8, c.y + er * 0.4, er * 1.1 * f, G.t); }
  ctx.restore();
  // the icon and the name, floating out beside the egg (overshoot, settle), a little drift up, gone with the moment
  const k = calm ? 1 : backOut(clamp01(m.age / 0.32)), drift = calm ? 0 : -6 * u * ss(hq);
  const ix = c.x + sd * (er + 30 * u), iy = c.y - er * 0.7 + drift;
  ctx.save(); ctx.globalAlpha = show;
  K.drawOrb(ctx, id, ix, iy, 19 * u * k, G.t, true);
  const sz = 23 * u; ctx.font = `800 ${Math.round(sz)}px ${K.FONT}`; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const w = ctx.measureText(name).width, P = G.play;
  let tx = right ? ix + 26 * u : ix - 26 * u - w; tx = Math.max(P.x + 8 * u, Math.min(P.x + P.w - 8 * u - w, tx));
  const ty = iy + (1 - k) * 8 * u;
  ctx.textAlign = 'left'; ctx.lineWidth = sz * 0.26; ctx.strokeStyle = 'rgba(40,16,4,0.85)'; ctx.strokeText(name, tx, ty);
  ctx.fillStyle = '#fff6d6'; ctx.fillText(name, tx, ty); // (the orb beside it carries the power's colour)
  ctx.restore();
  if (K.ui.record) K.ui.record({ x: tx, y: ty - sz / 2, w, h: sz }, 'lesson:power', 'lesson:power');
}
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// ---------------------------------------------------------------- 0.8.19: the ring under the finger, in full colour
// Everything but ring ri (and the channel on its floor, where the eggs it carries lie) goes to an off colour: grey and a
// cool veil; the ring itself keeps its colour and gets a soft warm glow. Calm and low: the flat veil only, a steady glow.
export function drawRingFocus(ctx, W, H, ri, show, calm) {
  const G = K.G, sim = G.sim, ring = sim && sim.rings[ri];
  if (!ring || show <= 0.01) return;
  const c = K.toScreen(0, 0), k = G.cam.k, u = K.ui.u, low = K.low();
  const Ro = (ring.r + RING_TH / 2 + 0.07) * k, Ri = ri > 0 ? (sim.rings[ri - 1].r + RING_TH / 2 + 0.05) * k : 0;
  const hole = () => { ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.moveTo(c.x + Ro, c.y); ctx.arc(c.x, c.y, Ro, 0, Math.PI * 2); if (Ri > 0) { ctx.moveTo(c.x + Ri, c.y); ctx.arc(c.x, c.y, Ri, 0, Math.PI * 2); } };
  ctx.save();
  if (!calm && !low) { ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = 0.72 * show; ctx.fillStyle = '#808080'; hole(); ctx.fill('evenodd'); ctx.globalCompositeOperation = 'source-over'; }
  ctx.globalAlpha = 1; ctx.fillStyle = `rgba(26,30,52,${(calm ? 0.28 : low ? 0.46 : 0.32) * show})`; hole(); ctx.fill('evenodd');
  // the glow: soft and warm on the ring's own band, breathing slowly
  const br = calm ? 1 : 0.8 + 0.2 * Math.sin(G.t * 2.6), Rm = ring.r * k, bw = RING_TH * k;
  for (const [lw, al] of [[bw + 22 * u, 0.1], [bw + 12 * u, 0.14], [bw + 4 * u, 0.2]]) { ctx.globalAlpha = al * br * show; ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(c.x, c.y, Rm, 0, Math.PI * 2); ctx.stroke(); }
  ctx.globalAlpha = 0.7 * show; ctx.strokeStyle = '#fff3c4'; ctx.lineWidth = 2 * u;
  ctx.beginPath(); ctx.arc(c.x, c.y, Rm + bw / 2 + 2 * u, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}
// level 1's coach (main.js drawKeyHint notes the ring its hand is on each frame it shows): the same off colour, eased
function drawCoachDim(ctx, W, H) {
  const G = K.G, C = G.coachRing, on = !!C && G.t - C.t < 0.12 && !G.lesson;
  G.coachDim = Math.max(0, Math.min(1, (G.coachDim || 0) + (on ? 1 : -1) * (K.save.calm ? 1 : 0.05)));
  if (C && G.coachDim > 0.01) drawRingFocus(ctx, W, H, C.i, ss(G.coachDim), !!K.save.calm);
}

// ---------------------------------------------------------------- 0.8.19: the pinch lesson (zoom, wordless, once)
// The owner: "we might want to show the zoom in and zoom out options during the tutorial itself". Levels 2 and 3 (level 1
// belongs to the drag coach), once in a player's life (save.pinchSeen), never for a player who has zoomed himself
// (save.zoomed), at a calm moment: a few seconds into play, no finger down, no moment, card or toast up. Two ghost fingers
// land on the vault, spread (the camera pushes in with them, engine/shots.js demo), hold, pinch back (it pulls back out),
// lift. Any touch skips it. Calm: the two fingers and their arrows, still, and the camera does not move.
const PINCH = { at: 5, len: 4.6, zoom: 1.2 };
function pinchTick(dt) {
  const G = K.G, sim = G.sim, P = G.pinchTip;
  if (P) {
    P.age += dt;
    if (G.screen !== 'play' || !sim || sim.state !== 'play') { G.pinchTip = null; return; }
    if (P.out != null ? P.age > P.out + 0.3 : P.age >= PINCH.len) G.pinchTip = null;
    return;
  }
  const s = K.save;
  if (s.pinchSeen || s.zoomed || !G.level || G.demo || !(G.level.id === 2 || G.level.id === 3) || G.screen !== 'play' || !sim || sim.state !== 'play') return;
  if (G.cv.playT < PINCH.at || G.lesson || G.lessonQ.length || G.teach || G.tourPause || G.zm != null || K.busy() || heldRing() != null || (G.tp && G.tp.size)) return;
  if (sim.timeLimit && sim.timeLeft < 20) return;
  s.pinchSeen = 1; K.persist();
  G.pinchTip = { age: 0, out: null };
  K.audio.play('hud_pop', { vol: 0.3, pitch: 0.8 });
}
// 0..1 how far the two fingers are spread at this age (anticipation, overshoot, settle; then back)
function pinchSpread(a) {
  if (a < 0.6) return 0;
  if (a < 0.8) return -0.08 * Math.sin(((a - 0.6) / 0.2) * Math.PI / 2); // a small squeeze first
  if (a < 1.7) return -0.08 + 1.08 * backOut((a - 0.8) / 0.9);
  if (a < 2.6) return 1;
  if (a < 3.5) return 1 - backOut((a - 2.6) / 0.9);
  return 0;
}
// the camera's part of the pinch lesson (1 = none)
export function pinchZoom() {
  const P = K && K.G.pinchTip;
  if (!P || K.save.calm) return 1;
  const w = P.out != null ? 1 - ss((P.age - P.out) / 0.3) : 1;
  return 1 + (PINCH.zoom - 1) * Math.max(0, pinchSpread(P.age)) * w;
}
// a lesson holds the world in slow motion: the camera director stands still
export function lessonFrozen() { const m = K && K.G.lesson; return !!m && !m.done && T.scaleAt(m) < 0.98; }
function drawPinch(ctx) {
  const G = K.G, P = G.pinchTip;
  if (!P) return;
  const u = K.ui.u, calm = !!K.save.calm, A = G.play, cx = A.x + A.w / 2, cy = A.y + A.h * 0.5;
  const show = ss(P.age / 0.3) * (P.out != null ? 1 - ss((P.age - P.out) / 0.3) : 1 - ss((P.age - (PINCH.len - 0.4)) / 0.4));
  if (show <= 0.01) return;
  const sp = calm ? 0.6 : pinchSpread(P.age), d = (46 + 62 * sp) * u, ux = 0.64, uy = -0.77; // the fingers part along a slant
  const press = calm || (P.age > 0.45 && P.age < 3.75), opening = P.age < 2.2;
  ctx.save(); ctx.lineCap = 'round';
  // the stretch between the fingers: a soft band and two arrow heads that point the way they are going
  const x0 = cx - ux * d, y0 = cy - uy * d, x1 = cx + ux * d, y1 = cy + uy * d;
  for (const [lw, col, al] of [[9 * u, 'rgba(40,18,4,0.5)', 0.6], [3.5 * u, '#fff6d6', 0.9]]) {
    ctx.globalAlpha = al * show; ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.setLineDash([2 * u, 10 * u]);
    ctx.beginPath(); ctx.moveTo(x0 + ux * 26 * u, y0 + uy * 26 * u); ctx.lineTo(x1 - ux * 26 * u, y1 - uy * 26 * u); ctx.stroke();
  }
  ctx.setLineDash([]);
  if (press) for (const [x, y] of [[x0, y0], [x1, y1]]) { ctx.globalAlpha = 0.5 * show; ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.arc(x, y, 19 * u, 0, Math.PI * 2); ctx.stroke(); }
  for (const s of [-1, 1]) { // arrow heads beyond each finger (out while opening, in while closing)
    const dir = (calm || opening ? 1 : -1) * s, bx = cx + ux * s * (d + 40 * u), by = cy + uy * s * (d + 40 * u), ang = Math.atan2(uy * dir, ux * dir), hs = 11 * u;
    ctx.globalAlpha = show * (press ? 0.95 : 0.4); ctx.fillStyle = '#ffd34d'; ctx.strokeStyle = 'rgba(40,18,4,0.6)'; ctx.lineWidth = 2.5 * u; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(bx + Math.cos(ang) * hs, by + Math.sin(ang) * hs); ctx.lineTo(bx + Math.cos(ang + 2.4) * hs, by + Math.sin(ang + 2.4) * hs); ctx.lineTo(bx + Math.cos(ang - 2.4) * hs, by + Math.sin(ang - 2.4) * hs); ctx.closePath(); ctx.stroke(); ctx.fill();
  }
  ctx.restore();
  const lift = press ? 0 : 14 * u;
  K.hand(ctx, x0, y0 + lift, 46 * u, press, show);
  K.hand(ctx, x1, y1 + lift, 46 * u, press, show);
}
