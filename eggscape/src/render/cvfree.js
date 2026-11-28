// Giving pictures back (0.8.10). mykee's speed log, levels 1 to 18 on a flagship: the phone's free memory fell by
// about 115 MB with EVERY level (5151 MB at level 5, 4234 MB at level 12), and at level 13 drawing collapsed on every
// screen: frame time followed the pixel count (75 ms at 840x1866, 45 ms at 630x1400, 19 ms at 420x933), the mark of a
// web view that has lost its graphics-chip canvases and paints with the processor. A canvas nobody points at any more
// keeps its pixels (graphics memory, on a phone) until the garbage collector happens to run, and this game allocates so
// little script memory that it rarely does: each level left 40 to 110 MB of dead backdrop layers and ring pictures
// behind. So every cache that drops a canvas now shrinks it to 1x1 first, which returns the pixels at once.
// 1x1, not 0x0: drawImage of an empty canvas throws, and a late draw of a freed picture must stay harmless.
export const cvStats = { freed: 0, mb: 0 };
export function freeCanvas(cv) {
  try {
    if (!cv || !(cv.width > 1 || cv.height > 1)) return;
    cvStats.freed++; cvStats.mb += cv.width * cv.height * 4 / 1048576;
    cv.width = 1; cv.height = 1;
  } catch (_) { /* a picture that cannot shrink is left to the collector */ }
}

// every picture reachable from an object (its fields, arrays and Maps, a few levels down): a per-level helper that is
// thrown away gives its sprites back in one call
export function freeDeep(o, depth = 3) {
  if (!o || typeof o !== 'object') return;
  if (typeof o.getContext === 'function') { freeCanvas(o); return; }
  if (depth <= 0) return;
  if (ArrayBuffer.isView(o)) return;
  const vals = Array.isArray(o) ? o : o instanceof Map ? [...o.values()] : o instanceof Set ? [...o] : Object.values(o);
  for (const v of vals) if (v && typeof v === 'object') freeDeep(v, depth - 1);
}
