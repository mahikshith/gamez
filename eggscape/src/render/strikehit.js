// Chick Strike: how a villain takes the hit. Render only: nothing here touches the sim.
//
// One generic reaction layer for every target (16 creature kinds, every boss), built from what stkTargets() gives: the
// position, the kind (an approximate size) and the direction the chick came from.
//   strikeLayer(ctx, sim, k, t, types, fn)  wraps a creature layer's draw call (main.js). While one of its creatures
//     reacts, the patch of the layer around it is drawn to a scratch canvas (a "sprite" of that creature), tinted
//     (flash, zap silhouette, frost, soot, red face) and put back squashed, shaken, spun or flung. The rest of the layer is
//     drawn as usual. With no reaction running it is a plain fn(ctx).
//   drawHitFx(ctx, sim, k, t, S, chick)  the props over it: ice block, sparks, smoke, blast, funnel, stars, goo, steam.
//   strikeAct(key)  the acting cue for a creature's own rig: shock, frozen, dazed, angry, eager, strain, ouch (or null).
//   hitBegin(ev, ang) / hitRage(ev)  from the stkHit / stkRage events.
import { geckoAnchor } from './gecko15.js';
import { STRIKE, FLIGHT } from '../data/strikes.js';

const TAU = Math.PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, u) => a + (b - a) * u;
const ss = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const back = (u) => { const c = 1.9; u = clamp(u, 0, 1) - 1; return 1 + (c + 1) * u * u * u + c * u * u; };
const out3 = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);

// approximate body radius per kind (m): effects stay in scale with the cast
const SIZE = { snake: 0.46, sal: 0.5, eagle: 0.8, thief: 0.46, frog: 0.5, octo: 0.62, fish: 0.5, hermit: 0.42, puff: 0.46, jelly: 0.46, kc: 1.05, spider: 0.38, beetle: 0.38, jack: 0.42, gator: 0.95, turtle: 0.5, mosq: 0.36, bx: 0.85 };
const sizeOf = (T) => (SIZE[T.type] || 0.5) * (T.type === 'snake' ? clamp(T.ref.size || 1, 0.8, 1.5) : T.boss && T.type !== 'bx' && T.type !== 'kc' ? 1.2 : 1);

const RX = new Map(); // key -> reaction
const SNAP = {}; // key -> { cv, cr, t }: the creature as it was just before a bomb or a twister took it
const FRM = { sim: null, t: -1, st: 0, T: new Map() };
let REVEAL = null; // the decoy's raspberry: { x, y, t0 }
const NEW = []; // reactions waiting for their first frame

export function hitBegin(ev, ang) { if (!ev.miss) NEW.push({ id: ev.id, key: ev.key || '', x: ev.x, y: ev.y, ang: ang || 0, boss: !!ev.boss, d: 0 }); }
export function hitRage(ev) { REVEAL = { x: ev.x, y: ev.y, t0: null }; NEW.push({ rage: 1 }); }

function make(o, T, t) {
  const r = sizeOf(T);
  const R = { id: o.id, key: T.key, type: T.type, r, cr: Math.min(2.1, r * 2.1), x: o.x ?? T.x, y: o.y ?? T.y, ang: o.ang || 0, t0: t + (o.d || 0), lx: T.x, ly: T.y, live: true, end: null, seed: Math.floor(hash(t * 7.3 + T.x) * 1000), snap: null, cv: null, pt: -1, P: null, el0: o.el0 || 0 };
  const sn = SNAP[T.key];
  if (sn && (o.id === 'bomb' || o.id === 'tornado')) { R.snap = sn; delete SNAP[T.key]; if (o.id === 'bomb') tintCv(sn.cv, '#ff8a3a', 0.2); }
  RX.set(T.key, R);
  return R;
}
// once a frame: where everyone is, new reactions, chained bolts, finished ones out
function begin(sim, t) {
  if (FRM.sim !== sim || sim.t < FRM.st - 0.4) { RX.clear(); REVEAL = null; FRM.sim = sim; for (const q in SNAP) delete SNAP[q]; }
  FRM.st = sim.t;
  if (FRM.t === t) return;
  FRM.t = t; FRM.T.clear();
  const L = sim.stkTargets(), gk = geckoAnchor(sim);
  if (gk) for (const T of L) if (T.key === 'bx') { T.x = gk.x; T.y = gk.y; } // L15: the boss is the gecko on the ring
  for (const T of L) FRM.T.set(T.key, T);
  const K = sim.stk;
  for (const o of NEW) {
    if (o.rage) { // everyone was fooled: those not already in the act join it angry
      let n = 0;
      for (const T of L) { const R = RX.get(T.key); if (R && R.id === 'decoy') continue; if (n++ < 6) make({ id: 'decoy', el0: 2 }, T, t); }
      continue;
    }
    if (o.id === 'decoy') { let n = 0; for (const T of [...L].sort((a, b) => Math.hypot(a.x - o.x, a.y - o.y) - Math.hypot(b.x - o.x, b.y - o.y))) if (n < 4) make({ id: 'decoy', d: 0.1 * n++ }, T, t); continue; }
    const T = FRM.T.get(o.key);
    if (T) make(o, T, t);
    else if (o.key) { const R = make(o, { key: o.key, type: o.boss ? 'bx' : 'thief', x: o.x, y: o.y, ref: {} }, t); R.live = false; } // it left with the hit (blown out of the vault)
    if (o.id === 'thunder' && K) { // the bolt's other victims: the same, a beat later each
      const E = K.fx.find((e) => e.k === 'thunder'), pts = (E && E.pts) || [];
      for (let i = 1; i < pts.length; i++) { const C = L.find((X) => X.key !== o.key && Math.hypot(X.x - pts[i].x, X.y - pts[i].y) < 0.5); if (C) make({ id: 'thunder', d: 0.16 * i, ang: Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x) }, C, t); }
    }
  }
  NEW.length = 0;
  for (const R of RX.values()) {
    const T = FRM.T.get(R.key);
    R.live = !!T; if (T) { R.lx = T.x; R.ly = T.y; }
    if (R.done || t - R.t0 > 22 || t < R.t0 - 2) RX.delete(R.key);
  }
}

// ---------------------------------------------------------------- the pose of one reaction this frame
// P: { on, hide, src ('live' | 'snap'), x, y (where the sprite's centre goes), rot, sx, sy, ax, a1, a2 (squash along the
// axis ax), tint, ta, alpha, xf (it is moved or bent: the live one is cut out of the layer) }
function pose(R, sim, t) {
  if (R.pt === t) return R.P;
  R.pt = t;
  const el = t - R.t0 + R.el0, K = sim.stk;
  const P = R.P = { on: false, hide: false, src: 'live', x: R.lx, y: R.ly, rot: 0, sx: 1, sy: 1, ax: 0, a1: 1, a2: 1, tint: null, ta: 0, alpha: 1, xf: false, el, act: null };
  if (el < 0) return P;
  P.on = true;
  const r = R.r;
  // the impact: squashed along the chick's line, shoved back, settling on a spring
  if (el < 0.6 && R.id !== 'decoy' && !R.el0) {
    const v = el < 0.07 ? el / 0.07 : Math.exp(-(el - 0.07) * 8) * Math.cos((el - 0.07) * 25);
    P.x += Math.cos(R.ang) * r * 0.34 * v; P.y += Math.sin(R.ang) * r * 0.34 * v;
    P.ax = R.ang; P.a1 = 1 - 0.32 * v; P.a2 = 1 + 0.24 * v; P.xf = true; P.act = 'shock';
  }
  const tint = (c, a) => { if (a > P.ta) { P.tint = c; P.ta = a; } };
  const E = K && K.fx.find((e) => e.k === R.id && e.key === R.key);
  if (R.id === 'freeze') {
    if (R.end == null && !E && el > 0.3) R.end = t;
    if (el < 0.12) tint('#ffffff', 0.95 * (1 - el / 0.12));
    if (R.end == null) {
      tint('#bfe4ff', 0.4 * ss(0.04, 0.4, el)); P.act = el < 0.4 ? 'shock' : 'frozen';
      if (E && E.t < 1.7) { const a = 1 - E.t / 1.7; R.shv = Math.sin(t * 64) * r * 0.045 * a; P.x += R.shv; P.xf = true; } else R.shv = 0;
    } else {
      const e2 = t - R.end; R.shv = 0; P.xf = true; P.act = e2 < 1.5 ? 'dazed' : null;
      tint('#bfe4ff', 0.4 * (1 - ss(0, 0.8, e2)));
      if (e2 < 0.95) P.rot = Math.sin(e2 * 40) * 0.2 * Math.sin((Math.PI * e2) / 0.95); // the shake-off
      else if (e2 < 1.22) { const u = (e2 - 0.95) / 0.27; P.sy = 1 + 0.16 * u; P.sx = 1 - 0.08 * u; P.rot = -0.12 * u; } // ah... ah...
      else if (e2 < 1.7) { const v = Math.exp(-(e2 - 1.22) * 9) * Math.cos((e2 - 1.22) * 22); P.sy = 1 - 0.22 * v; P.sx = 1 + 0.2 * v; P.rot = 0.14 * v; } // choo
      else R.done = true;
    }
  } else if (R.id === 'thunder') {
    const T = STRIKE.thunder.t;
    P.xf = true;
    if (el < 0.08) { tint('#ffffff', 1); P.sy *= 1.24; P.sx *= 0.84; P.act = 'shock'; }
    else if (el < 0.66) {
      const f = Math.floor(el / 0.055);
      tint(f % 2 ? '#0a0e26' : '#fff7b4', f % 2 ? 0.94 : 0.82);
      P.x += (hash(f * 3.1 + R.seed) - 0.5) * r * 0.16; P.y += (hash(f * 5.7 + R.seed) - 0.5) * r * 0.12; P.sy *= 1.16; P.sx *= 0.9; P.act = 'shock';
    } else if (el < T + 0.5) {
      const fade = 1 - ss(T - 0.3, T + 0.5, el);
      tint('#22160e', (0.2 + 0.32 * Math.exp(-(el - 0.66) * 0.9)) * fade); P.act = el < T ? 'dazed' : null;
      const ph = (el * 1.3 + hash(R.seed)) % 1; R.tw = ph < 0.1 && el < T ? 1 - ph / 0.1 : 0;
      if (R.tw) { P.rot = (Math.floor(el * 1.3) % 2 ? 1 : -1) * 0.12 * R.tw; P.sy *= 1 + 0.08 * R.tw; }
      else P.rot = Math.sin(el * 4.2) * 0.035 * fade; // swaying, frazzled
    } else R.done = true;
  } else if (R.id === 'bomb' || R.id === 'tornado') {
    const bomb = R.id === 'bomb', FT = bomb ? 0.95 : 1.2;
    P.xf = true;
    // where it comes down: where the sim put it (the outer channel, outside the vault), else off the edge of the vault
    if (el < FT) {
      const away = Math.hypot(R.x, R.y) || 1, off = { x: (R.x / away) * (sim.outerR + 2.2), y: (R.y / away) * (sim.outerR + 2.2) + 0.6 };
      const to = R.live ? { x: R.lx, y: R.ly } : off, u = el / FT;
      P.hide = R.live; P.src = R.snap ? 'snap' : 'live'; P.act = 'shock';
      if (R.type === 'snake') P.hr = lerp(6, R.cr * 0.92, ss(0.8, 1, u)); // its whole length is in the air, not only the head
      if (bomb) {
        const e = Math.pow(u, 0.85), d = Math.hypot(to.x - R.x, to.y - R.y), h = 1.9 + 0.2 * d, sp = to.x >= R.x ? -1 : 1;
        P.x = lerp(R.x, to.x, e); P.y = lerp(R.y, to.y, e) + h * 4 * e * (1 - e);
        P.rot = sp * TAU * (1.6 + 0.2 * d) * e; const fl = Math.sin(el * 38); P.sx = 1 + 0.15 * fl; P.sy = 1 - 0.15 * fl; // tumbling, flailing
        if (!R.live) { P.alpha = 1 - ss(0.7, 1, u); P.sx *= 1 - 0.4 * u; P.sy *= 1 - 0.4 * u; }
        tint('#ff8a3a', R.snap ? 0 : 0.2);
      } else {
        const lift = r * 1.15 * ss(0, 0.3, el) * (1 - ss(1.04, 1.2, el)), go = ss(0.42, 1.0, el), th = Math.max(0, el - 0.22) * TAU * 3.1 * (1 - 0.4 * ss(0.9, 1.2, el));
        R.fx = lerp(R.x, to.x, go); R.fy = lerp(R.y, to.y, go); R.th = th;
        const spin = ss(0.2, 0.34, el) * (1 - ss(1.08, 1.2, el)), c = Math.cos(th);
        P.x = R.fx + Math.sin(th) * r * 0.3 * spin; P.y = R.fy + lift + Math.sin(el * 11) * r * 0.08 * spin;
        P.sx = lerp(1, (Math.abs(c) * 0.75 + 0.2) * (c < 0 ? -1 : 1), spin); P.sy = 1 + 0.34 * spin; P.rot = Math.sin(th) * 0.3 * spin; // turning on its axis, stretched
      }
      if (!R.live && !R.snap) P.on = false;
    } else if (!R.live) { P.on = false; R.gone = true; R.back = null; if (el > 14) R.done = true; }
    else {
      if (R.gone && R.back == null) R.back = t; // it climbs back in later, still sooty
      const e3 = R.back != null ? t - R.back : el - FT;
      if (bomb) {
        tint('#1a1410', 0.5 * (1 - ss(1.6, 3.4, e3)));
        const v = R.back != null ? 0 : Math.exp(-e3 * 6) * Math.cos(e3 * 17);
        P.sy = 1 - 0.38 * v; P.sx = 1 + 0.3 * v; P.y -= r * 0.3 * v; P.act = 'dazed';
        R.cough = 0;
        for (const c0 of [0.75, 1.7]) { const q = e3 - c0; if (q > 0 && q < 0.5) { const w = Math.exp(-q * 10) * Math.cos(q * 26); P.sy *= 1 - 0.14 * w; P.sx *= 1 + 0.12 * w; P.rot = 0.1 * w; R.cough = q; R.coughN = c0; P.act = 'ouch'; } }
        if (e3 > 3.4) R.done = true;
      } else {
        const v = Math.exp(-e3 * 4.6) * Math.cos(e3 * 13), env = 1 - ss(1.4, 2.5, e3);
        P.sy = 1 - 0.52 * v; P.sx = 1 + 0.42 * v; P.y += r * (0.3 * Math.abs(Math.sin(e3 * 8.5)) * Math.exp(-e3 * 3.5) - 0.42 * Math.max(0, v)); // flat, a bounce, flat again
        P.rot = Math.sin(e3 * 5.2) * 0.13 * env * ss(0.3, 0.7, e3); P.x += Math.sin(e3 * 2.6) * r * 0.08 * env; // dizzy wobble
        R.dz = env * ss(0.15, 0.5, e3); P.act = 'dazed';
        if (e3 > 2.5) R.done = true;
      }
    }
  } else if (R.id === 'glue') {
    if (R.end == null && !E && el > 0.3) R.end = t;
    const rad = Math.hypot(R.lx, R.ly) || 1, sg = R.seed % 2 ? 1 : -1, gx = (-R.ly / rad) * sg, gy = (R.lx / rad) * sg;
    R.gx = gx; R.gy = gy; P.xf = true;
    if (R.end == null) {
      const ph = Math.max(0, el - 0.45) % 1.7;
      const s = el < 0.45 ? 0 : ph < 1.2 ? Math.pow(ph / 1.2, 1.6) * (1 + 0.04 * Math.sin(ph * 46)) : Math.exp(-(ph - 1.2) * 11) * Math.cos((ph - 1.2) * 27); // straining forward, snapped back
      R.gs = s; P.act = ph < 1.2 ? 'strain' : 'ouch';
      P.x += gx * r * 0.5 * s; P.y += gy * r * 0.5 * s;
      const a1 = 1 + 0.22 * s, a2 = 1 - 0.1 * s;
      if (el > 0.45) { P.ax = Math.atan2(gy, gx); P.a1 = a1; P.a2 = a2; }
      const ld = Math.exp(-el * 9) * Math.cos(el * 20); P.sy *= 1 - 0.14 * ld; P.sx *= 1 + 0.1 * ld; // the splat's weight
      tint('#9a5ce0', 0.16 * ss(0, 0.3, el));
    } else {
      const e2 = t - R.end, u = clamp(e2 / 0.4, 0, 1), v = Math.exp(-Math.max(0, e2 - 0.4) * 9) * Math.cos(Math.max(0, e2 - 0.4) * 22);
      R.gs = 0; P.y += r * 0.55 * 4 * u * (1 - u); // peels free with a hop
      if (e2 > 0.4) { P.sy = 1 - 0.2 * v; P.sx = 1 + 0.16 * v; }
      if (e2 > 1) R.done = true;
    }
  } else if (R.id === 'decoy') {
    const dc = sim.p2 && sim.p2.decoy && sim.p2.decoy.stk, rage = K && K.rage > 0, D = (K && K.dcyAt) || { x: R.x, y: R.y };
    R.rage = rage; R.dc = dc; P.xf = true;
    if (rage) {
      if (R.rg == null) R.rg = t;
      const e2 = t - R.rg, pop = Math.exp(-e2 * 7) * Math.cos(e2 * 20);
      tint('#e61e1e', 0.36 + 0.12 * Math.sin(t * 15)); P.act = 'angry';
      P.x += Math.sin(t * 83) * r * 0.035; P.sy = 1 + 0.07 * Math.abs(Math.sin(t * 9.5)) + 0.25 * pop; P.sx = 1 - 0.04 * Math.abs(Math.sin(t * 9.5)) - 0.15 * pop;
    } else if (dc) {
      const dx = D.x - R.lx, dy = D.y - R.ly, d = Math.hypot(dx, dy) || 1;
      if (el < 0.5) { const v = el < 0.1 ? -el / 0.1 : Math.exp(-(el - 0.1) * 7) * Math.cos((el - 0.1) * 16); P.sy = 1 + 0.2 * v; P.sx = 1 - 0.13 * v; P.act = 'shock'; } // the take
      else {
        const ph = (el - 0.5) % 1.25, l = ph < 0.3 ? Math.sin((Math.PI * ph) / 0.3) : 0; P.act = 'eager';
        P.x += (dx / d) * r * (0.38 * l + 0.03 * Math.sin(el * 17)); P.y += (dy / d) * r * (0.38 * l + 0.03 * Math.sin(el * 17)); // lunging, sniffing
        if (l) { P.ax = Math.atan2(dy, dx); P.a1 = 1 + 0.16 * l; P.a2 = 1 - 0.08 * l; }
      }
    } else if (el > 0.6) R.done = true;
  }
  return P;
}
// the cue for the creature whose sim object is ref (its rig acts it out: see snake.js, thieves.js, salamander.js, bayou.js)
export function strikeActOf(ref) { if (!RX.size) return null; for (const R of RX.values()) { const T = FRM.T.get(R.key); if (T && T.ref === ref && R.P && !R.done) return R.P.act; } return null; }
// a strike landed this very step: its own popup speaks, the power-up popups ("Zap!", "Frozen!") stay quiet
export function strikeQuiet() { return NEW.some((o) => o.id); }
// glued, blown or whirled here: the stun under it is silent (no zap arcs every time the glue's hold is topped up)
export function strikeMuteAt(x, y) { for (const R of RX.values()) if ((R.id === 'glue' || R.id === 'bomb' || R.id === 'tornado') && Math.hypot(R.lx - x, R.ly - y) < 1) return true; return false; }

// ---------------------------------------------------------------- the sprite of one creature, cut from its layer
function tintCv(cv, col, a) { const o = cv.getContext('2d'); o.save(); o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-atop'; o.globalAlpha = a; o.fillStyle = col; o.fillRect(0, 0, cv.width, cv.height); o.restore(); }
function grab(ctx, fn, x, y, cr, into) {
  const m = ctx.getTransform(), ds = Math.hypot(m.a, m.b) || 80, sc = Math.min(ds, 300 / cr), n = Math.max(8, Math.ceil(2 * cr * sc));
  const S = into || { cv: document.createElement('canvas'), cr };
  if (S.cv.width !== n) { S.cv.width = n; S.cv.height = n; }
  S.cr = cr;
  const o = S.cv.getContext('2d');
  o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-over'; o.globalAlpha = 1; o.clearRect(0, 0, n, n);
  o.save(); o.setTransform(sc, 0, 0, -sc, n / 2 - x * sc, n / 2 + y * sc);
  try { fn(o); } catch (e) { /* art never breaks the frame */ }
  o.restore(); o.setTransform(1, 0, 0, 1, 0, 0); o.globalAlpha = 1;
  const g = o.createRadialGradient(n / 2, n / 2, n * 0.38, n / 2, n / 2, n * 0.5); g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
  o.globalCompositeOperation = 'destination-in'; o.fillStyle = g; o.fillRect(0, 0, n, n); o.globalCompositeOperation = 'source-over';
  return S;
}
function put(ctx, S, P) {
  ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(P.rot);
  if (P.a1 !== 1 || P.a2 !== 1) { ctx.rotate(P.ax); ctx.scale(P.a1, P.a2); ctx.rotate(-P.ax); }
  ctx.scale(P.sx, -P.sy); ctx.globalAlpha *= P.alpha; ctx.imageSmoothingEnabled = true;
  ctx.drawImage(S.cv, -S.cr, -S.cr, 2 * S.cr, 2 * S.cr);
  ctx.restore();
}
export function strikeLayer(ctx, sim, k, t, types, fn) {
  const K = sim.stk;
  if (!K || (!RX.size && !NEW.length && !K.fly)) return fn(ctx);
  begin(sim, t);
  const F = K.fly;
  if (F && F.ph === 'fly' && (F.id === 'bomb' || F.id === 'tornado') && F.t > FLIGHT.fly - 0.1) { // what it looked like before it went flying
    const T = FRM.T.get(F.key);
    if (T && types.includes(T.type)) { const r = sizeOf(T); SNAP[T.key] = grab(ctx, fn, T.x, T.y, Math.min(2.1, r * 2.1), SNAP[T.key]); }
  }
  let L = null;
  for (const R of RX.values()) if (types.includes(R.type)) { const P = pose(R, sim, t); if (P.on && (P.xf || P.ta > 0.01 || P.hide)) (L = L || []).push(R); }
  if (!L) return fn(ctx);
  for (const R of L) {
    const P = R.P; P.img = null;
    if (P.src === 'snap' && R.snap) P.img = R.snap;
    else if (R.live) { P.img = R.cv = grab(ctx, fn, R.lx, R.ly, R.cr, R.cv); if (P.ta > 0.01) tintCv(R.cv.cv, P.tint, P.ta); }
  }
  ctx.save();
  let hole = false;
  ctx.beginPath();
  for (const R of L) if (R.live && (R.P.xf || R.P.hide)) { if (!hole) { ctx.rect(-500, -500, 1000, 1000); hole = true; } const hr = R.P.hr || R.cr * 0.92; ctx.moveTo(R.lx + hr, R.ly); ctx.arc(R.lx, R.ly, hr, 0, TAU); }
  if (hole) ctx.clip('evenodd');
  fn(ctx);
  ctx.restore();
  for (const R of L) if (R.P.img) put(ctx, R.P.img, R.P);
}

// ---------------------------------------------------------------- the props
// local frame at (x, y): metres, y down, so art reads like screen art
function at(ctx, x, y, f, s = 1) { ctx.save(); ctx.translate(x, y); ctx.scale(s, -s); f(); ctx.restore(); }
function puff(ctx, x, y, r, col, hi, a) { // a soft-edged cloud ball with a lit top-left
  if (a <= 0.01 || r <= 0) return;
  ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = hi; ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.28, r * 0.55, 0, TAU); ctx.fill();
}
function star(ctx, x, y, r, rot, n = 5, inner = 0.45) { ctx.beginPath(); for (let i = 0; i < n * 2; i++) { const a = rot + (i / (n * 2)) * TAU, q = i % 2 ? r * inner : r; if (i) ctx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); else ctx.moveTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } ctx.closePath(); }
function zap(ctx, x0, y0, x1, y1, n, amp, seed) {
  ctx.beginPath(); ctx.moveTo(x0, y0);
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1;
  for (let i = 1; i < n; i++) { const f = i / n, o = (hash(seed + i * 1.7) - 0.5) * 2 * amp; ctx.lineTo(x0 + dx * f - (dy / l) * o, y0 + dy * f + (dx / l) * o); }
  ctx.lineTo(x1, y1);
}
const BLOCK = [[-0.92, -0.62], [-0.5, -1.02], [0.34, -1.08], [0.96, -0.66], [1.06, 0.3], [0.7, 0.98], [-0.52, 1.02], [-1.04, 0.42]];
function iceBlock(ctx, u, g, crack, seed) { // a chunky cut block: you see the villain through it
  const pt = (i, f = 1) => [BLOCK[i % 8][0] * u * 1.22 * f, BLOCK[i % 8][1] * u * 1.16 * f];
  const path = (f) => { ctx.beginPath(); for (let i = 0; i < 8; i++) { const [x, y] = pt(i, f); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.closePath(); };
  ctx.save(); ctx.scale(g, g); ctx.lineJoin = 'round';
  ctx.globalAlpha = 0.28; ctx.fillStyle = '#12304a'; ctx.beginPath(); ctx.ellipse(0, u * 1.2, u * 1.25, u * 0.2, 0, 0, TAU); ctx.fill(); // it sits on the floor
  ctx.globalAlpha = 1;
  const gr = ctx.createLinearGradient(-u, -u, u, u); gr.addColorStop(0, 'rgba(226,246,255,0.42)'); gr.addColorStop(0.5, 'rgba(150,208,250,0.14)'); gr.addColorStop(1, 'rgba(70,140,220,0.4)');
  path(1); ctx.fillStyle = gr; ctx.fill();
  // the cut faces: a lit top and left bevel, a shaded bottom and right one
  for (let i = 0; i < 8; i++) {
    const [x0, y0] = pt(i), [x1, y1] = pt(i + 1), [x2, y2] = pt(i + 1, 0.74), [x3, y3] = pt(i, 0.74), lit = i === 7 || i < 2;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath();
    ctx.fillStyle = lit ? `rgba(255,255,255,${i === 0 ? 0.5 : 0.32})` : i >= 3 && i <= 5 ? `rgba(30,90,170,${i === 4 ? 0.34 : 0.22})` : 'rgba(255,255,255,0.08)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = u * 0.025; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x3, y3); ctx.stroke();
  }
  path(0.74); ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = u * 0.03; ctx.stroke();
  path(1); ctx.strokeStyle = '#2a78ba'; ctx.lineWidth = u * 0.13; ctx.stroke(); ctx.strokeStyle = '#eefaff'; ctx.lineWidth = u * 0.06; ctx.stroke();
  // the shine: two slanted bars and a glint
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (const [x, w] of [[-0.5, 0.13], [-0.26, 0.05]]) { ctx.beginPath(); ctx.moveTo(u * x, -u * 0.5); ctx.lineTo(u * (x + w), -u * 0.5); ctx.lineTo(u * (x + w - 0.3), u * 0.1); ctx.lineTo(u * (x - 0.3), u * 0.1); ctx.closePath(); ctx.fill(); }
  star(ctx, u * 0.62, -u * 0.6, u * 0.2, 0, 4, 0.25); ctx.fillStyle = '#ffffff'; ctx.fill();
  // snow on top, an icicle or two
  ctx.fillStyle = '#f6fcff'; ctx.beginPath(); ctx.moveTo(-u * 0.6, -u * 1.16); ctx.quadraticCurveTo(-u * 0.1, -u * 1.5, u * 0.42, -u * 1.24); ctx.quadraticCurveTo(u * 0.2, -u * 1.08, u * 0.02, -u * 1.2); ctx.quadraticCurveTo(-u * 0.3, -u * 1.04, -u * 0.6, -u * 1.16); ctx.fill();
  if (crack > 0) { // cracks run in from three corners, forking
    ctx.lineCap = 'round';
    for (let j = 0; j < 3; j++) {
      const [x0, y0] = pt([1, 4, 6][j]), n = 5, len = Math.min(1, crack * 1.25 - j * 0.12);
      if (len <= 0) continue;
      for (const [w, c] of [[0.09, '#1d5fa6'], [0.035, '#ffffff']]) {
        ctx.beginPath(); ctx.moveTo(x0, y0);
        for (let i = 1; i <= n; i++) { const f = (i / n) * len; if (i / n > len + 0.2) break; ctx.lineTo(x0 * (1 - f * 0.95) + (hash(seed + j * 9 + i) - 0.5) * u * 0.42, y0 * (1 - f * 0.95) + (hash(seed + j * 5 + i * 3) - 0.5) * u * 0.42); }
        ctx.strokeStyle = c; ctx.lineWidth = u * w; ctx.stroke();
      }
    }
  }
  ctx.restore();
}
function shards(ctx, u, e2, seed) { // the block bursts: wedges of ice thrown out, turning, falling
  const a = 1 - ss(0.35, 0.75, e2);
  if (a <= 0) return;
  for (let i = 0; i < 11; i++) {
    const an = (i / 11) * TAU + hash(seed + i) * 0.5, v = u * (3.2 + hash(seed + i * 3) * 3), x = Math.cos(an) * (u * 0.6 + v * e2), y = Math.sin(an) * (u * 0.6 + v * e2) * 0.8 - u * 1.5 * e2 + u * 9 * e2 * e2, s = u * (0.2 + hash(i + seed * 2) * 0.22);
    ctx.save(); ctx.translate(x, y); ctx.rotate(an + e2 * (8 + i) * (i % 2 ? 1 : -1)); ctx.globalAlpha = a;
    ctx.beginPath(); ctx.moveTo(-s, s * 0.5); ctx.lineTo(s * 0.2, -s); ctx.lineTo(s, s * 0.6); ctx.closePath(); ctx.fillStyle = '#e4f6ff'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(s * 0.2, -s); ctx.lineTo(s, s * 0.6); ctx.lineTo(s * 0.15, s * 0.3); ctx.closePath(); ctx.fillStyle = '#7fc2f2'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-s, s * 0.5); ctx.lineTo(s * 0.2, -s); ctx.lineTo(s, s * 0.6); ctx.closePath(); ctx.strokeStyle = '#2a78ba'; ctx.lineWidth = u * 0.035; ctx.stroke();
    ctx.restore();
  }
  if (e2 < 0.2) { ctx.globalAlpha = 1 - e2 / 0.2; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = u * 0.25 * (1 - e2 / 0.2); ctx.beginPath(); ctx.arc(0, 0, u * (1 + e2 * 7), 0, TAU); ctx.stroke(); }
  ctx.globalAlpha = 1;
}
function funnel(ctx, u, t, a, th) { // a small twister: a tapering body, turning bands, grit caught in it
  const H = u * 3.5, w = (v) => u * (0.2 + 1.25 * v * v), sway = (v) => Math.sin(t * 6 + v * 3.2) * u * 0.28 * v;
  ctx.save(); ctx.globalAlpha = a * 0.5;
  const g = ctx.createLinearGradient(-u, 0, u, 0); g.addColorStop(0, '#eafff8'); g.addColorStop(0.55, '#8fdcc6'); g.addColorStop(1, '#3f9d8a');
  ctx.beginPath();
  for (let i = 0; i <= 10; i++) { const v = i / 10; ctx.lineTo(sway(v) - w(v), u * 0.9 - v * H); }
  for (let i = 10; i >= 0; i--) { const v = i / 10; ctx.lineTo(sway(v) + w(v), u * 0.9 - v * H); }
  ctx.closePath(); ctx.fillStyle = g; ctx.fill();
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const v = (i + 0.5) / 9, ph = (th * 1.0 + t * 9 + i * 1.3) % TAU;
    ctx.globalAlpha = a * 0.9; ctx.strokeStyle = i % 2 ? '#f4fffb' : '#2f9a86'; ctx.lineWidth = u * (0.07 + 0.08 * v);
    ctx.beginPath(); ctx.ellipse(sway(v), u * 0.9 - v * H, w(v), w(v) * 0.24, 0, ph, ph + 2.6); ctx.stroke();
  }
  for (let i = 0; i < 7; i++) { const v = (t * 1.5 + i / 7) % 1, an = t * 10 + i * 2.2; ctx.globalAlpha = a * (1 - v); ctx.fillStyle = i % 2 ? '#6f8f6a' : '#c9b48a'; ctx.beginPath(); ctx.ellipse(sway(v) + Math.cos(an) * w(v) * 1.1, u * 0.9 - v * H + Math.sin(an) * w(v) * 0.24, u * 0.09, u * 0.05, an, 0, TAU); ctx.fill(); }
  // dust kicked up at its foot
  for (let i = 0; i < 4; i++) { const an = t * 7 + i * 1.6; puff(ctx, Math.cos(an) * u * 0.5, u * 0.95 + Math.sin(an) * u * 0.08, u * 0.2, '#cfe9de', '#f4fffb', a * 0.6); }
  ctx.restore();
}
function gooCap(ctx, u, t, s, a) { // a dollop over its back, dripping
  ctx.save(); ctx.globalAlpha = a; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-u * 0.95, -u * 0.05);
  ctx.bezierCurveTo(-u * 1.05, -u * 0.95, -u * 0.3, -u * 1.25, u * 0.1, -u * 1.05);
  ctx.bezierCurveTo(u * 0.7, -u * 1.2, u * 1.1, -u * 0.6, u * 0.95, -u * 0.05);
  for (let i = 0; i < 5; i++) { // the drips along its lower edge
    const x1 = u * (0.95 - (i + 1) * 0.38), x0 = u * (0.95 - i * 0.38), d = u * (0.1 + 0.22 * hash(i + 2) + 0.1 * Math.sin(t * 2.4 + i * 1.7) + 0.18 * s * (i % 2));
    ctx.bezierCurveTo(x0 - u * 0.04, d * 1.3, x1 + u * 0.1, d * 1.3, x1, -u * 0.05 + (i === 4 ? 0 : u * 0.06));
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -u * 1.2, 0, u * 0.5); g.addColorStop(0, '#d9b4ff'); g.addColorStop(0.5, '#a868ec'); g.addColorStop(1, '#7a3fc0');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#4f2386'; ctx.lineWidth = u * 0.07; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.ellipse(-u * 0.42, -u * 0.8, u * 0.26, u * 0.1, -0.5, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(-u * 0.05, -u * 0.95, u * 0.06, 0, TAU); ctx.fill();
  ctx.restore();
}
function bang(ctx, u, col, line) { // "!"
  ctx.lineJoin = 'round'; ctx.lineWidth = u * 0.16; ctx.strokeStyle = line; ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(-u * 0.2, -u); ctx.lineTo(u * 0.2, -u); ctx.lineTo(u * 0.1, -u * 0.05); ctx.lineTo(-u * 0.1, -u * 0.05); ctx.closePath(); ctx.stroke(); ctx.fill();
  ctx.beginPath(); ctx.arc(0, u * 0.3, u * 0.15, 0, TAU); ctx.stroke(); ctx.fill();
}

// chick(id, x, y, s, o): strike.js's chick painter, in px at the current origin
export function drawHitFx(ctx, sim, k, t, S, chick) {
  const K = sim.stk, done = new Set();
  if (!K || (!RX.size && !NEW.length && !REVEAL)) return done;
  begin(sim, t);
  for (const R of RX.values()) {
    const P = pose(R, sim, t), el = P.el, u = R.r;
    if (el < 0) continue;
    done.add(R.key);
    ctx.save();
    if (R.id === 'freeze') {
      if (R.end == null) {
        // frost races over it, then the block snaps shut around it
        if (el < 0.4) at(ctx, R.lx, R.ly, () => { ctx.strokeStyle = '#f2fbff'; ctx.lineCap = 'round'; ctx.lineWidth = u * 0.07; ctx.globalAlpha = 1 - ss(0.2, 0.4, el); for (let i = 0; i < 10; i++) { const an = (i / 10) * TAU + 0.2, r0 = u * 1.5 * ss(0, 0.3, el), r1 = r0 * 0.55; zap(ctx, Math.cos(an) * r1, Math.sin(an) * r1, Math.cos(an) * r0, Math.sin(an) * r0, 3, u * 0.12, i + R.seed); ctx.stroke(); } });
        const E = K.fx.find((e) => e.k === 'freeze' && e.key === R.key), crack = E ? clamp(1 - E.t / 1.9, 0, 1) : 0;
        const g = back(ss(0.1, 0.4, el) * 1);
        if (el > 0.1) at(ctx, R.lx + (R.shv || 0), R.ly, () => iceBlock(ctx, u, g, crack, R.seed));
      } else {
        const e2 = t - R.end;
        at(ctx, R.lx, R.ly, () => {
          shards(ctx, u, e2, R.seed);
          // shaken-off drops, then the sneeze
          if (e2 > 0.1 && e2 < 1) for (let i = 0; i < 8; i++) { const b = 0.1 + i * 0.1, q = e2 - b; if (q < 0 || q > 0.4) continue; const sd = i % 2 ? 1 : -1, x = sd * u * (0.7 + q * 4), y = -u * 0.4 - u * 2.2 * q + u * 9 * q * q; ctx.globalAlpha = 1 - q / 0.4; ctx.fillStyle = '#bfe8ff'; ctx.beginPath(); ctx.ellipse(x, y, u * 0.07, u * 0.11, sd * 0.6, 0, TAU); ctx.fill(); }
          if (e2 > 1.22 && e2 < 1.75) { const q = (e2 - 1.22) / 0.53, sd = R.lx > 0 ? -1 : 1; for (let i = 0; i < 4; i++) puff(ctx, sd * u * (0.8 + out3(q) * (0.7 + i * 0.3)), -u * 0.1 + (i - 1.5) * u * 0.2 * out3(q), u * (0.16 + 0.14 * q), '#e2f4ff', '#ffffff', 0.9 * (1 - q)); ctx.globalAlpha = 1 - q; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = u * 0.06; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { const an = (i - 1) * 0.4; ctx.beginPath(); ctx.moveTo(sd * u * 0.9 * Math.cos(an), u * 0.9 * Math.sin(an) - u * 0.1); ctx.lineTo(sd * u * (1.3 + q) * Math.cos(an), u * (1.3 + q) * Math.sin(an) - u * 0.1); ctx.stroke(); } }
        });
      }
    } else if (R.id === 'thunder') {
      at(ctx, P.x, P.y, () => {
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if (el < 0.66) {
          const f = Math.floor(el / 0.055), a = el < 0.08 ? 1 : 0.9;
          if (el < 0.14) { const g = ctx.createRadialGradient(0, 0, u * 0.2, 0, 0, u * 2); g.addColorStop(0, 'rgba(255,255,240,0.9)'); g.addColorStop(1, 'rgba(255,240,150,0)'); ctx.globalAlpha = 1 - el / 0.14; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, u * 2, 0, TAU); ctx.fill(); }
          ctx.globalAlpha = a; // a crown of forks jumping round it
          for (let i = 0; i < 7; i++) { const an = (i / 7) * TAU + hash(f + i) * 0.8, r0 = u * 0.95, r1 = u * (1.35 + hash(f * 3 + i) * 0.5); for (const [w, c] of [[0.13, '#3d6bff'], [0.06, '#fffbd0']]) { zap(ctx, Math.cos(an) * r0, Math.sin(an) * r0, Math.cos(an + 0.3) * r1, Math.sin(an + 0.3) * r1, 4, u * 0.16, f * 7 + i); ctx.strokeStyle = c; ctx.lineWidth = u * w; ctx.stroke(); } }
        } else {
          const T = STRIKE.thunder.t, fade = 1 - ss(T - 0.2, T + 0.4, el);
          for (let i = 0; i < 4; i++) { // smoke curling off it
            const v = ((el - 0.66) * 0.55 + i / 4) % 1, x = (i - 1.5) * u * 0.42 + Math.sin(v * 7 + i * 2) * u * 0.2, y = -u * 0.7 - v * u * 1.7;
            puff(ctx, x, y, u * (0.13 + 0.2 * v), '#5a5560', '#9b97a4', 0.62 * Math.sin(v * Math.PI) * fade);
          }
          if (R.tw) for (let i = 0; i < 3; i++) { const an = hash(Math.floor(el * 1.3) + i * 3) * TAU, r0 = u * 0.5, r1 = u * 1.15; ctx.globalAlpha = R.tw; for (const [w, c] of [[0.11, '#3d6bff'], [0.05, '#fffbd0']]) { zap(ctx, Math.cos(an) * r0, Math.sin(an) * r0, Math.cos(an + 0.5) * r1, Math.sin(an + 0.5) * r1, 3, u * 0.14, i + Math.floor(el * 1.3)); ctx.strokeStyle = c; ctx.lineWidth = u * w; ctx.stroke(); } }
        }
      });
    } else if (R.id === 'bomb') {
      at(ctx, R.x, R.y, () => {
        if (el < 0.18) { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, u * 2.3); g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, 'rgba(255,214,110,0.95)'); g.addColorStop(1, 'rgba(255,110,40,0)'); ctx.globalAlpha = 1 - el / 0.18; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, u * (1.5 + el * 5), 0, TAU); ctx.fill(); }
        if (el < 0.5) { const q = el / 0.5, rr = u * (0.9 + 3 * out3(q)); ctx.globalAlpha = 1 - q; ctx.strokeStyle = '#fff3d0'; ctx.lineWidth = u * 0.42 * (1 - q) + u * 0.04; ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke(); ctx.strokeStyle = '#ff9a4a'; ctx.lineWidth = u * 0.12 * (1 - q); ctx.beginPath(); ctx.arc(0, 0, rr * 0.86, 0, TAU); ctx.stroke(); }
        if (el < 0.85) { const q = el / 0.85, o = out3(el / 0.5); for (let i = 0; i < 9; i++) { const an = (i / 9) * TAU + 0.4, d = u * (0.4 + (1.3 + hash(i + R.seed) * 0.7) * o); puff(ctx, Math.cos(an) * d, Math.sin(an) * d * 0.8 - u * 0.5 * q, u * (0.36 + 0.24 * o) * (1 - 0.3 * q), el < 0.2 ? '#ff8a3a' : '#3b322e', el < 0.2 ? '#ffd27a' : '#6a5f58', 0.8 * (1 - ss(0.35, 1, q))); } }
      });
      if (!R.live && el < 0.95 && el > 0.8 && R.snap) at(ctx, P.x, P.y, () => { ctx.globalAlpha = 1; ctx.fillStyle = '#ffffff'; star(ctx, 0, 0, u * 0.6 * Math.sin(((el - 0.8) / 0.15) * Math.PI), el * 6, 4, 0.2); ctx.fill(); }); // gone: a twinkle
      if (R.live && R.cough > 0) at(ctx, P.x, P.y, () => { const q = R.cough / 0.5, sd = (R.lx > 0 ? -1 : 1) * (R.coughN > 1 ? -1 : 1); for (let i = 0; i < 3; i++) puff(ctx, sd * u * (0.7 + out3(q) * (0.5 + i * 0.28)), -u * (0.15 + q * 0.5 + (i % 2) * 0.16), u * (0.14 + 0.16 * q + i * 0.03), '#4a413c', '#8a7f78', 0.85 * (1 - q)); });
      if (R.live && el > 0.95 && el < 1.25 && R.back == null) at(ctx, R.lx, R.ly, () => { const q = (el - 0.95) / 0.3; for (const sd of [-1, 1]) puff(ctx, sd * u * (0.8 + q * 0.7), u * 0.6 - q * u * 0.2, u * (0.18 + 0.14 * q), '#cbbfae', '#efe7da', 0.7 * (1 - q)); });
    } else if (R.id === 'tornado') {
      if (el < 1.45) at(ctx, R.fx ?? R.lx, R.fy ?? R.ly, () => funnel(ctx, u, t, Math.min(1, el / 0.18) * (1 - ss(1.15, 1.45, el)), R.th || 0));
      else if (R.live) at(ctx, P.x, P.y, () => {
        const e3 = el - 1.2;
        if (e3 < 0.55) { const q = (e3 - 0.25) / 0.3; if (q > 0) for (const sd of [-1, 1]) puff(ctx, sd * u * (0.9 + q * 0.7), u * 0.6 - q * u * 0.15, u * (0.18 + 0.14 * q), '#cbbfae', '#efe7da', 0.7 * (1 - q)); }
        const a = R.dz || 0;
        if (a > 0.02) for (let i = 0; i < 3; i++) { // stars going round its head
          const an = t * 5.5 + (i / 3) * TAU, z = Math.sin(an), x = Math.cos(an) * u * 0.8, y = -u * 1.15 + z * u * 0.2, s = u * (0.2 + 0.05 * z);
          ctx.globalAlpha = a * (0.7 + 0.3 * z); star(ctx, x, y, s, t * 3 + i, 5, 0.48); ctx.fillStyle = '#ffd84a'; ctx.strokeStyle = '#a8690e'; ctx.lineWidth = u * 0.045; ctx.lineJoin = 'round'; ctx.stroke(); ctx.fill();
          ctx.fillStyle = '#fff6c0'; ctx.beginPath(); ctx.arc(x - s * 0.15, y - s * 0.15, s * 0.2, 0, TAU); ctx.fill();
        }
      });
    } else if (R.id === 'glue') {
      const e2 = R.end == null ? -1 : t - R.end, a = R.end == null ? 1 : 1 - ss(0.05, 0.3, e2), s = R.gs || 0, drop = ss(0, 0.16, el);
      at(ctx, 0, 0, () => {
        // strands from the floor to its body: they thin as it pulls, one snaps at the end
        ctx.lineCap = 'round';
        const bx = P.x, by = -P.y;
        for (let i = 0; i < 4; i++) {
          if (e2 > 0.02 * i + 0.02 || el < 0.2) continue;
          const o = (i - 1.5) * 0.46, fx = R.lx + o * u * 1.5 - (R.gx || 0) * u * 0.3, fy = -R.ly + u * (0.8 + 0.1 * (i % 2)), hx = bx + o * u * 0.9, hy = by + u * (0.1 + 0.2 * Math.abs(o));
          const mx = (fx + hx) / 2 + (R.gy || 0) * u * 0.1, my = (fy + hy) / 2 + u * 0.28 * (1 - s);
          ctx.beginPath(); ctx.moveTo(fx, fy); ctx.quadraticCurveTo(mx, my, hx, hy);
          ctx.strokeStyle = '#4f2386'; ctx.lineWidth = u * (0.2 - 0.07 * Math.max(0, s)); ctx.stroke(); ctx.strokeStyle = '#b77cf2'; ctx.lineWidth = u * (0.12 - 0.05 * Math.max(0, s)); ctx.stroke();
          ctx.fillStyle = '#7a3fc0'; ctx.beginPath(); ctx.ellipse(fx, fy, u * 0.2, u * 0.08, 0, 0, TAU); ctx.fill();
        }
      });
      at(ctx, P.x, P.y + u * 0.5 - (1 - drop) * u * 2.2, () => { ctx.rotate(-P.rot); ctx.scale(lerp(0.5, 1, drop) * (1 + 0.1 * s), lerp(1.5, 1, drop) * (1 + 0.2 * Math.exp(-el * 9) * Math.cos(el * 20))); gooCap(ctx, u * 0.5, t, s, a * Math.min(1, el / 0.06)); });
      if (e2 >= 0 && e2 < 0.3) at(ctx, R.lx, R.ly, () => { const q = e2 / 0.3; ctx.globalAlpha = 1 - q; ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round'; ctx.lineWidth = u * 0.09; for (let i = 0; i < 7; i++) { const an = (i / 7) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(an) * u * (0.25 + q * 0.5), u * 0.75 + Math.sin(an) * u * (0.25 + q * 0.5)); ctx.lineTo(Math.cos(an) * u * (0.5 + q * 0.8), u * 0.75 + Math.sin(an) * u * (0.5 + q * 0.8)); ctx.stroke(); } ctx.fillStyle = '#d9b4ff'; star(ctx, 0, u * 0.75, u * 0.45 * (1 - q), 0.3, 6, 0.5); ctx.fill(); }); // pop
    } else if (R.id === 'decoy') {
      at(ctx, P.x, P.y, () => {
        if (R.rage) {
          const e2 = t - (R.rg ?? t);
          for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) { const v = (t * 1.9 + i / 3 + (sd > 0 ? 0.17 : 0)) % 1; puff(ctx, sd * u * (0.55 + v * 0.75), -u * (0.85 + v * 0.75), u * (0.1 + 0.16 * v), '#ffe3da', '#ffffff', 0.9 * (1 - v)); } // steam out of both ears
          if (e2 < 0.7) { const g = back(e2 / 0.2) * (1 - ss(0.5, 0.7, e2)); ctx.save(); ctx.translate(u * 0.1, -u * 1.75); ctx.scale(g, g); ctx.rotate(0.15); bang(ctx, u * 0.55, '#ff4a36', '#5a0f0a'); ctx.translate(-u * 0.45, 0); ctx.rotate(-0.3); ctx.lineWidth = u * 0.09; ctx.strokeStyle = '#5a0f0a'; ctx.fillStyle = '#ff4a36'; ctx.font = `900 ${u * 0.95}px sans-serif`; ctx.textAlign = 'center'; ctx.strokeText('?', 0, u * 0.25); ctx.fillText('?', 0, u * 0.25); ctx.restore(); }
        } else if (R.dc) {
          if (el < 0.9) { const g = back(el / 0.18) * (1 - ss(0.7, 0.9, el)); ctx.save(); ctx.translate(0, -u * 1.7 - u * 0.1 * Math.sin(el * 9)); ctx.scale(g, g); bang(ctx, u * 0.85, '#ffd84a', '#6b3a08'); ctx.restore(); }
          else { // it can already taste it: an egg in a thought bubble
            const g = back((el - 0.9) / 0.25), bob = Math.sin(t * 3.2) * u * 0.05, sd = R.lx > 0 ? -1 : 1;
            ctx.save(); ctx.translate(sd * u * 0.85, -u * 1.75 + bob); ctx.scale(g * 1.35, g * 1.35);
            ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = u * 0.06;
            for (const [x, y, rr] of [[-sd * u * 0.52, u * 0.62, 0.07], [-sd * u * 0.4, u * 0.46, 0.11]]) { ctx.beginPath(); ctx.arc(x, y, u * rr, 0, TAU); ctx.fill(); ctx.stroke(); }
            ctx.beginPath(); for (let i = 0; i < 7; i++) { const an = (i / 7) * TAU; ctx.arc(Math.cos(an) * u * 0.3, Math.sin(an) * u * 0.22, u * 0.24, an - 1.2, an + 1.2); } ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.ellipse(0, 0, u * 0.42, u * 0.34, 0, 0, TAU); ctx.fill();
            ctx.rotate(0.2 * Math.sin(t * 4)); ctx.beginPath(); ctx.moveTo(0, -u * 0.26); ctx.bezierCurveTo(u * 0.2, -u * 0.24, u * 0.22, u * 0.24, 0, u * 0.24); ctx.bezierCurveTo(-u * 0.22, u * 0.24, -u * 0.2, -u * 0.24, 0, -u * 0.26); ctx.fillStyle = '#fff1d6'; ctx.fill(); ctx.strokeStyle = '#a8713a'; ctx.lineWidth = u * 0.05; ctx.stroke();
            ctx.restore();
          }
        }
      });
    }
    ctx.restore();
  }
  // the reveal: the shell bursts, the chick blows a raspberry at them, then ducks away
  if (REVEAL) {
    if (REVEAL.t0 == null) REVEAL.t0 = t;
    const e = t - REVEAL.t0, s = S * 0.7;
    if (e > 1.7 || e < 0) REVEAL = null;
    else {
      ctx.save(); ctx.translate(REVEAL.x, REVEAL.y); ctx.scale(1 / k, -1 / k);
      const g = back(e / 0.22) * (1 - ss(1.45, 1.7, e)), hop = Math.abs(Math.sin(e * 9)) * s * 0.08 * (e < 1.4 ? 1 : 0);
      for (const sd of [-1, 1]) { // the two halves of the shell
        const q = Math.min(1, e / 0.5), x = sd * s * (0.2 + q * 0.75), y = -s * 0.9 * q + s * 1.5 * q * q + s * 0.1;
        ctx.save(); ctx.translate(x, y); ctx.rotate(sd * q * 2.4); ctx.globalAlpha = 1 - ss(0.9, 1.3, e);
        ctx.beginPath(); ctx.arc(0, 0, s * 0.3, 0, Math.PI); for (let i = 0; i <= 4; i++) ctx.lineTo(-s * 0.3 + i * s * 0.15, i % 2 ? -s * 0.1 : 0); ctx.closePath(); ctx.fillStyle = '#fff1d6'; ctx.fill(); ctx.strokeStyle = '#a8713a'; ctx.lineWidth = s * 0.05; ctx.lineJoin = 'round'; ctx.stroke();
        ctx.restore();
      }
      ctx.save(); ctx.translate(0, -hop - s * 0.1); ctx.scale(g, g * (1 + 0.08 * Math.sin(e * 30)));
      chick('decoy', 0, 0, s, { feet: false, mood: 'yell', wing: 0.5 + 0.5 * Math.sin(e * 28), squash: 0.05 * Math.sin(e * 30), look: { x: 1, y: 0.1 }, fog: false });
      tongue(ctx, s, e);
      ctx.restore();
      ctx.restore();
    }
  }
  return done;
}
function tongue(ctx, s, e) { // the raspberry: a flapping tongue and spit (the chick faces right, its beak at about +0.3 s)
  const w = Math.sin(e * 46), bx = s * 0.36, by = -s * 0.1;
  ctx.save(); ctx.translate(bx, by); ctx.rotate(0.25 + w * 0.22);
  ctx.beginPath(); ctx.moveTo(0, -s * 0.06); ctx.quadraticCurveTo(s * 0.3, -s * 0.1, s * 0.32, s * 0.02); ctx.quadraticCurveTo(s * 0.3, s * 0.12, 0, s * 0.06); ctx.closePath();
  ctx.fillStyle = '#ff6f8f'; ctx.fill(); ctx.strokeStyle = '#a02a4a'; ctx.lineWidth = s * 0.03; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(s * 0.06, 0); ctx.lineTo(s * 0.24, 0); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#d8f2ff'; ctx.strokeStyle = '#6aa6c8'; ctx.lineWidth = s * 0.02;
  for (let i = 0; i < 6; i++) { const v = (e * 3.2 + i / 6) % 1, an = (i - 2.5) * 0.22 + 0.1; ctx.globalAlpha = 1 - v; ctx.beginPath(); ctx.ellipse(bx + s * 0.3 + Math.cos(an) * s * 0.55 * v, by + Math.sin(an) * s * 0.55 * v + s * 0.3 * v * v, s * 0.045, s * 0.03, an, 0, TAU); ctx.fill(); ctx.stroke(); }
  ctx.globalAlpha = 1;
}
