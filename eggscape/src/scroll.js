// One scroll feel for every list in the game (0.8.7, mykee: "it should be buttery smooth, even when you scroll through
// any of the screens"). A scroller is { y, v, max }: y px from the top, v px/s after a fling, max the furthest y.
//   - under a finger the content follows it exactly; pulled past an end it stretches like a rubber band (it used to
//     stop dead, which reads as stuck)
//   - a fling glides and slows smoothly; one that reaches an end runs a little past it and settles back
//   - Reduced motion: no stretch, the plain stop
// Pure numbers, no drawing: main.js and ui/store.js call these, tools/test-scroll.mjs checks them.

export const SCROLL_DRAG = 2.3; // a fling keeps gliding for about 1/SCROLL_DRAG s of its speed
const EDGE_DRAG = 16, HOME = 13; // past an end: the fling dies fast, the content springs home (1/s)

// how far the content shows past its end for a finger pulled d px past it: 1:1 at first, never more than lim
export const rubber = (d, lim) => (lim <= 0 ? 0 : lim * (1 - 1 / (d / lim + 1)));
const unrubber = (o, lim) => (lim <= 0 ? 0 : lim * (1 / (1 - Math.min(0.98, o / lim)) - 1));
export const overOf = (S) => (S.y < 0 ? S.y : S.y > S.max ? S.y - S.max : 0);

// the finger's wanted offset (the offset at touch-down + the finger's travel) -> where the content sits
export function dragTo(S, want, lim = 0) {
  S.v = 0;
  S.y = want < 0 ? -rubber(-want, lim) : want > S.max ? S.max + rubber(want - S.max, lim) : want;
}
// the offset to start a drag from: a list caught mid-stretch carries on from the finger's point of view
export function grab(S, lim = 0) { const o = overOf(S); return o < 0 ? -unrubber(-o, lim) : o > 0 ? S.max + unrubber(o, lim) : S.y; }

// one frame of a free scroller (no finger on it)
export function glideStep(S, dt, lim = 0) {
  if (!(dt > 0)) return;
  if (S.to != null) { // an asked-for trip (the "more below" arrow, a jump to a section)
    const to = Math.max(0, Math.min(S.to, S.max));
    S.v = 0; S.y += (to - S.y) * (1 - Math.exp(-9 * dt));
    if (Math.abs(to - S.y) < 1) { S.y = to; S.to = null; }
    return;
  }
  if (lim <= 0) { // the plain stop
    if (Math.abs(S.v) > 8) { S.y += S.v * dt; S.v *= Math.exp(-SCROLL_DRAG * dt); } else S.v = 0;
    const cl = Math.max(0, Math.min(S.max, S.y)); if (cl !== S.y) { S.y = cl; S.v = 0; }
    return;
  }
  // small steps, so a slow frame and a fast one land in the same place
  for (let left = dt; left > 1e-6;) {
    const h = Math.min(left, 1 / 120); left -= h;
    const o = overOf(S);
    if (o) {
      if (S.v * o > 0) S.v *= Math.exp(-EDGE_DRAG * h); else S.v = 0; // still heading out: brake hard; heading home: the spring does it
      S.y += S.v * h;
      const o2 = overOf(S);
      if (o2 * o <= 0) { S.y = o < 0 ? 0 : S.max; S.v = 0; continue; }
      S.y -= o2 * (1 - Math.exp(-HOME * h));
      const o3 = overOf(S);
      if (Math.abs(o3) > lim) S.y -= o3 - Math.sign(o3) * lim;
      if (Math.abs(o3) < 0.4 && Math.abs(S.v) < 30) { S.y = o < 0 ? 0 : S.max; S.v = 0; }
    } else if (Math.abs(S.v) > 8) {
      S.y += S.v * h; S.v *= Math.exp(-SCROLL_DRAG * h);
      const o2 = overOf(S);
      if (o2) S.v = Math.sign(S.v) * Math.min(Math.abs(S.v), lim * 9); // arriving at an end: only so much carries past it
    } else { S.v = 0; break; }
  }
}
// where to draw: whole device pixels, so a picture stamped at the scroll offset stays crisp and does not shimmer
export const snapPx = (y, dpr = 1) => Math.round(y * dpr) / dpr;
