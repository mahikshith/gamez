// The camera director (0.8.19, the owner: "whenever the villains are coming up and doing stuff, we are focusing on the egg
// and the villains are moving out of the screen ... camera movements need to be properly handled for all the levels, with
// a single villain or a double villain"). Pure: no canvas, no sim. main.js hands it the resting frame its own camera
// wants (base), the cast (engine/shotcast.js: one actor per live villain, with what it is doing) and the eggs; it answers
// the frame to hold. tools/test-shots.mjs proves the rules.
//
//   CONTAIN  an actor that is entering, telling or striking is never out of frame: the frame widens and slides just
//            enough to hold its body and its target, every egg with it; two villains: both. It lingers SHOTS.linger s
//            after the last act, so a busy fight never has the camera hunting.
//   ENTER    a villain's entrance gets one short establishing move toward it (in, hold, out, eased), then the frame
//            that holds it and the eggs. Once per villain per level try.
//   HIT      a power lands on villains (the rooster's crow): the frame goes to the villains it hit at that moment,
//            pushes in a little, holds, and returns.
//   DEMO     the pinch lesson's own small push in and back (zoom factor from the lesson).
//   The player's own zoom wins for SHOTS.user s after a touch. Calm: no establishing move, no push, slower easing, the
//   containment only. Low: the same frames without the zoom part of the moves (pans only).
export const SHOTS = {
  pad: 0.5, // m of air round a body
  eggPad: 0.45,
  ahead: 0.4, // s a fast body is looked ahead
  linger: 1.6, // s the widened frame is held after the last act
  estIn: 0.55, estHold: 0.9, estOut: 0.7, estPull: 0.55, estZoom: 1.1, // the entrance: toward it this far, this much closer
  hitIn: 0.22, hitHold: 0.95, hitOut: 0.45, hitZoom: 1.22,
  user: 4, // s the player's own zoom is left alone
  minK: 0.6, // never wider than this share of the whole-vault scale
  smooth: 0.45, smoothEst: 0.36, smoothHit: 0.2, smoothLate: 0.24, calmSlow: 1.7, // (late: an acting body is outside the frame right now)
};
const ss = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const ACTING = (a) => a.act === 'enter' || a.act === 'tell' || a.act === 'strike';

export function newShots() { return { seen: {}, est: null, hit: null, keep: null, keepT: 0, on: false }; }

// a body's box (and its target point, when it has one)
export function boxesOf(a, pad = SHOTS.pad) {
  const r = (a.r || 0.4) + pad, out = [{ x0: a.x - r, x1: a.x + r, y0: a.y - r, y1: a.y + r }];
  if (Number.isFinite(a.tx) && Number.isFinite(a.ty)) out.push({ x0: a.tx - SHOTS.eggPad, x1: a.tx + SHOTS.eggPad, y0: a.ty - SHOTS.eggPad, y1: a.ty + SHOTS.eggPad });
  return out;
}
// the nearest frame to T (same or smaller scale, slid as little as it can) that holds every box; view = { w, h } px
export function fit(T, boxes, view, kMin = 0) {
  if (!boxes.length) return { x: T.x, y: T.y, k: T.k };
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const b of boxes) { x0 = Math.min(x0, b.x0); x1 = Math.max(x1, b.x1); y0 = Math.min(y0, b.y0); y1 = Math.max(y1, b.y1); }
  const k = Math.max(kMin, Math.min(T.k, view.w / (x1 - x0), view.h / (y1 - y0))), hw = view.w / (2 * k), hh = view.h / (2 * k);
  // (when kMin stops the zoom the boxes cannot all fit: the frame centres on them)
  return { x: x1 - x0 > 2 * hw ? (x0 + x1) / 2 : clamp(T.x, x1 - hw, x0 + hw), y: y1 - y0 > 2 * hh ? (y0 + y1) / 2 : clamp(T.y, y1 - hh, y0 + hh), k };
}
// how much of a body's box lies outside the frame cam (0..1); the audit's measure
export function outside(a, cam, view) {
  const r = a.r || 0.4, hw = view.w / (2 * cam.k), hh = view.h / (2 * cam.k);
  const ix = Math.max(0, Math.min(a.x + r, cam.x + hw) - Math.max(a.x - r, cam.x - hw)), iy = Math.max(0, Math.min(a.y + r, cam.y + hh) - Math.max(a.y - r, cam.y - hh));
  return 1 - (ix * iy) / (4 * r * r);
}
const bell = (t, a, h, o) => (t < a ? ss(t / a) : t < a + h ? 1 : 1 - ss((t - a - h) / o));

// a power landed on these actors now
export function hit(S, actors) {
  if (!actors || !actors.length) return false;
  S.hit = { boxes: actors.flatMap((a) => boxesOf({ x: a.x, y: a.y, r: a.r })), t: 0 };
  return true;
}

// One frame of direction. base: the resting frame { x, y, k }; cast: actors { key, x, y, r, act, tx, ty }; eggs: points;
// view { w, h } px; o: { dt, live (s of play so far), wholeK (the whole-vault scale), calm, low, userAge (s since the
// player's own zoom), cam (the camera now), demo (the pinch lesson's zoom factor, 1 = none), frozen (a lesson holds the world: stand still) }.
// Returns null (nothing to direct: the base frame stands) or { x, y, k, smooth }.
export function direct(S, base, cast, eggs, view, o) {
  const dt = o.dt || 0, calm = !!o.calm, low = !!o.low;
  // entrances are noted even while the player's zoom rules, so they are not replayed late
  let entrant = null;
  for (const a of cast) {
    const was = S.seen[a.key] | 0, now = a.act === 'enter' ? 2 : 1;
    if (was < now && (a.act === 'enter' || (!was && o.live > 1))) entrant = a;
    if (was < now) S.seen[a.key] = now;
  }
  if (o.frozen && S.last) return S.last;
  if (o.userAge < SHOTS.user) { S.est = S.hit = S.keep = null; S.on = false; S.last = null; return null; }
  if (entrant && !S.est && !calm) S.est = { key: entrant.key, t: 0, x: entrant.x, y: entrant.y, r: entrant.r };
  const kMin = (o.wholeK || base.k) * SHOTS.minK, eggBoxes = eggs.map((p) => ({ x0: p.x - SHOTS.eggPad, x1: p.x + SHOTS.eggPad, y0: p.y - SHOTS.eggPad, y1: p.y + SHOTS.eggPad }));
  // contain: every acting body and its target, and the eggs
  const acting = cast.filter(ACTING);
  let boxes = acting.flatMap((a) => boxesOf(a));
  // a body thrown or leaping fast: where it will be in SHOTS.ahead s is in the frame too (the camera is there first)
  const P = S.pos || (S.pos = {});
  for (const a of cast) {
    const q = P[a.key];
    if (q && dt > 0 && ACTING(a)) { let dx = ((a.x - q.x) / dt) * SHOTS.ahead, dy = ((a.y - q.y) / dt) * SHOTS.ahead; const d = Math.hypot(dx, dy); if (d > 0.3) { if (d > 3) { dx *= 3 / d; dy *= 3 / d; } boxes.push(...boxesOf({ x: a.x + dx, y: a.y + dy, r: a.r })); } }
    P[a.key] = { x: a.x, y: a.y };
  }
  if (boxes.length) { S.keep = boxes; S.keepT = SHOTS.linger; } else if (S.keep && (S.keepT -= dt) > 0) boxes = S.keep; else S.keep = null;
  const demo = o.demo && o.demo !== 1 ? o.demo : 1;
  if (!boxes.length && !S.est && !S.hit && demo === 1) { S.on = false; S.last = null; return null; }
  let T = boxes.length ? fit(base, [...boxes, ...eggBoxes], view, kMin) : { x: base.x, y: base.y, k: base.k };
  let smooth = SHOTS.smooth;
  // the entrance: toward it and back
  const E = S.est;
  if (E) {
    const a = cast.find((q) => q.key === E.key);
    if (a) { E.x = a.x; E.y = a.y; E.r = a.r; }
    E.t += dt;
    const w = bell(E.t, SHOTS.estIn, SHOTS.estHold, SHOTS.estOut);
    if (E.t >= SHOTS.estIn + SHOTS.estHold + SHOTS.estOut || !a) S.est = null;
    else {
      const to = fit({ x: lerp(T.x, E.x, SHOTS.estPull), y: lerp(T.y, E.y, SHOTS.estPull), k: T.k * (low ? 1 : SHOTS.estZoom) }, [...boxes, ...boxesOf({ x: E.x, y: E.y, r: E.r })], view, kMin); // (whoever else is acting stays in it)
      T = { x: lerp(T.x, to.x, w), y: lerp(T.y, to.y, w), k: lerp(T.k, to.k, w) };
      smooth = lerp(smooth, SHOTS.smoothEst, w);
    }
  }
  // the hit: the villains a power landed on
  const H = S.hit;
  if (H) {
    H.t += dt;
    if (H.t >= SHOTS.hitIn + SHOTS.hitHold + SHOTS.hitOut) S.hit = null;
    else if (calm) T = fit(T, H.boxes, view, kMin); // calm: they are simply in the frame
    else {
      const w = bell(H.t, SHOTS.hitIn, SHOTS.hitHold, SHOTS.hitOut);
      let cx = 0, cy = 0;
      for (const b of H.boxes) { cx += (b.x0 + b.x1) / 2; cy += (b.y0 + b.y1) / 2; }
      const to = fit({ x: cx / H.boxes.length, y: cy / H.boxes.length, k: base.k * (low ? 1 : SHOTS.hitZoom) }, H.boxes, view, kMin);
      T = { x: lerp(T.x, to.x, w), y: lerp(T.y, to.y, w), k: lerp(T.k, to.k, w) };
      smooth = lerp(smooth, SHOTS.smoothHit, w);
    }
  }
  if (demo !== 1) T.k *= demo;
  if (calm) smooth *= SHOTS.calmSlow;
  if (o.cam && acting.some((a) => outside(a, o.cam, view) > 0.15)) smooth = Math.min(smooth, SHOTS.smoothLate); // somebody acts out of frame: get there now
  S.on = true;
  return (S.last = { x: T.x, y: T.y, k: T.k, smooth });
}
