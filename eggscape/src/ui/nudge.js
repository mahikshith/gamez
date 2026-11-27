// card819: PLAY with no booster ticked (mykee 2026-11-27: "the user does not click on the power-up checks and clicks on
// play ... it is not blinking, it is not showing"). If the player owns a booster that fits this level and has ticked
// none, the first PLAY tap does not start: the tick boxes pulse and a ghost finger taps the best one; the next tap starts.
// Once per card opening, never before level 3 is won (nothing advertised then), never when none is owned (no selling).
// o: { won3, owned: { id: count }, order: ids in the strip's order, first: ids this level has a clear use for,
//      last: ids it has no use for (a Scarecrow where no villain lives), hide: ids not offered here, ticked: n, nudged }
// returns the booster to point at, or null (PLAY starts)
export function playNudge(o) {
  if (!o || !o.won3 || o.nudged || (o.ticked || 0) > 0) return null;
  const owned = o.owned || {}, hide = o.hide || [], last = o.last || [], first = o.first || [];
  const fits = (o.order || Object.keys(owned)).filter((id) => (owned[id] || 0) > 0 && !hide.includes(id) && !last.includes(id));
  if (!fits.length) return null;
  return fits.find((id) => first.includes(id)) || fits[0];
}
