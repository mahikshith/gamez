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

let K = null; // the kit main.js hands in (G, save, toScreen, ...)
export function lessonKit(kit) { K = kit; }

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const ss = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const backOut = (x) => { x = Math.max(0, Math.min(1, x)); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }; // overshoot, settle

// ---- state per level try
export function lessonReset() { const G = K.G; G.lrun = T.newRun(); G.lessonQ = []; G.lesson = null; }
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
  if (k.startsWith('lv:')) { const L = K.leadEgg(sim); if (!L) return null; const e = special(sim) || L.egg, p = e.body.getPosition(); return { x: p.x, y: p.y }; }
  if (k === 'snake') { const S = find(sim.snakes, ev.id); const h = S && S.pts && S.pts[0]; if (h) return { x: h.x, y: h.y }; }
  if (k === 'pip') { const P = find(sim.pips, ev.id); if (P && sim.pipBody) return sim.pipBody(P); }
  if (k === 'coco') { const C = find(sim.cocos, ev.id); if (C && sim.cocoBody) return sim.cocoBody(C); }
  if (k === 'urchin') { const U = find(sim.urchins, ev.id); if (U) return { x: U.x, y: U.y }; }
  if (k.startsWith('bandit')) { const b = banditLesson(sim); if (b) return b; }
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
  } else { // spin
    const b = q.key.startsWith('bandit') ? banditLesson(sim) : null;
    dir = b && b.dir ? b.dir : 0;
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
  return { x: p.x, y: p.y };
}

// ---- the clock: called once per frame from update (wall dt); returns the world's time scale
export function lessonTick(dt) {
  const G = K.G, sim = G.sim;
  if (!G.lrun) return 1;
  const m = G.lesson;
  if (m) {
    if (G.screen !== 'play' || !sim || sim.state !== 'play') T.finish(m, false);
    else if (!m.done && m.out == null) watchAnswer(m);
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
  if (m.tapAt != null && K.G.t - m.tapAt > 0.08 && !(r && (r.held || r.keyHeld) && m.path)) T.finish(m, false); // a tap elsewhere: it steps aside
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
  if (calm || low) {
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(c.x, c.y, R, 0, Math.PI * 2, true);
    ctx.fillStyle = `rgba(14,8,4,${a})`; ctx.fill('evenodd');
  } else {
    const g = ctx.createRadialGradient(c.x, c.y, R * 0.9, c.x, c.y, R * 1.9);
    g.addColorStop(0, 'rgba(14,8,4,0)'); g.addColorStop(0.4, `rgba(14,8,4,${a * 0.8})`); g.addColorStop(1, `rgba(14,8,4,${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  // the spotlight's rim: a warm ring, and one ripple out as it lands
  ctx.globalAlpha = 0.75 * show; ctx.strokeStyle = '#fff1c2'; ctx.lineWidth = 3 * u;
  ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, Math.PI * 2); ctx.stroke();
  if (!calm && m.age < 0.6) { const q = m.age / 0.6; ctx.globalAlpha = 0.6 * (1 - q) * show; ctx.lineWidth = (5 - 3 * q) * u; ctx.beginPath(); ctx.arc(c.x, c.y, R * (1 + 0.45 * ss(q)), 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
  // the answer, done by the ghost finger
  const hq = m.out != null && m.ok ? 1 : Math.max(0, Math.min(1, (m.age - T.TEACH.easeIn * 0.5) / Math.max(0.3, m.hold)));
  if (m.path) drawTurn(ctx, m, hq, show, u, calm);
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
