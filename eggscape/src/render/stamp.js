// Stamps (2026-11-20 speed pass, mykee: still stutters on real phones). A picture that does not change from frame to
// frame (the nest's straw, a resting sponge pad) is painted ONCE onto its own small canvas, in the drawing's own units,
// and then copied each frame with one drawImage. On a phone one copy costs a fraction of the dozens of curved strokes,
// clips and gradients it replaces. The stamp is repainted only when its key changes or the camera zooms in past it.
//
//   stamp(ctx, slot, key, x0, y0, x1, y1, paint)  -> true when it drew the stamp
//     slot   any object or string the stamp belongs to (one canvas per slot)
//     key    anything that changes the picture (colours, state): a different key repaints
//     box    x0..x1, y0..y1 in the drawing's units (the current transform's space)
//     paint  (c) => draw the picture on context c, in the same units
const SL = new Map();
const MAX = 2048;
export const stampStats = { builds: 0, on: true };
export function stamp(ctx, slot, key, x0, y0, x1, y1, paint) {
  if (!stampStats.on || typeof document === 'undefined' || !ctx.getTransform) return false;
  const m = ctx.getTransform(), sc = Math.hypot(m.a, m.b) || 1;
  const bw = x1 - x0, bh = y1 - y0;
  if (!(bw > 0 && bh > 0)) return false;
  let S = SL.get(slot);
  if (!S || S.key !== key || sc > S.sc * 1.06 || sc < S.sc * 0.5) {
    let s = sc * 1.12; // headroom: the camera's small zooms do not repaint it
    if (bw * s > MAX || bh * s > MAX) s = MAX / Math.max(bw, bh);
    const W = Math.max(2, Math.ceil(bw * s)), H = Math.max(2, Math.ceil(bh * s));
    const cv = (S && S.cv) || document.createElement('canvas');
    if (cv.width < W || cv.height < H || cv.width > W * 1.6 || cv.height > H * 1.6) { cv.width = W; cv.height = H; }
    const c = cv.getContext('2d');
    if (!c) return false;
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, cv.width, cv.height);
    const sx = cv.width / bw, sy = cv.height / bh;
    c.setTransform(sx, 0, 0, sy, -x0 * sx, -y0 * sy);
    paint(c);
    S = { cv, key, sc: Math.max(sx, sy) };
    SL.set(slot, S);
    if (SL.size > 64) { const first = SL.keys().next().value; if (first !== slot) SL.delete(first); }
    stampStats.builds++;
  }
  ctx.drawImage(S.cv, x0, y0, bw, bh);
  return true;
}
export function dropStamp(slot) { SL.delete(slot); }
