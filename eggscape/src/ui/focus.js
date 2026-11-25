// 0.8.16 (mykee: "when the user clicks on [the blinking mark] we are not showing it to the user or auto scrolling where
// they need to click next"): one "scroll to it and point at it" for every list in the game (the shop's tabs, Settings).
// A scroller S ({ y, v, max, to } of scroll.js) carries S.hl = { key, t0, dur, point }: the thing with that key gets a
// pulsing gold ring for dur seconds (a steady one under Calm motion) and, with point, the teaching hand tapping where the
// next tap goes. Any touch ends it (focusEnd). The numbers are pure (tools/test-shop.mjs); focusDraw paints.
// No imports (the test loads this file alone): main.js hands over the game's own teaching hand once.
let drawHand = () => {};
export const focusUseHand = (fn) => { drawHand = fn; };

export const FOCUS_LEN = 4; // seconds the ring and the hand stay unless the player touches something first

// which shop tab holds a thing: 'skin:gold' -> skins, 'hen:farmer' / 'set:winter' -> hens, 'chick:thunder' and every
// booster -> boosters, the rest (coin packs, bundles, the bank) -> deals
export const tabForKey = (k, isBooster = () => false) => (!k ? 'deals'
  : /^(chick|boost|kit|item|charge):|^(boosts|chicks|premium)$/.test(k) || isBooster(k) ? 'boosters'
    : /^(hen|set):|^sets$/.test(k) ? 'hens' : /^skin:/.test(k) ? 'skins' : 'deals');

// ask for it: the list lands on `key` the next time it is laid out (S.want), then keeps the ring on it
export function focusAsk(S, key, dur = FOCUS_LEN, point = true) { S.want = key; S.hlDur = dur; S.point = point; S.hl = null; return S; }
export function focusStart(S, key, t, dur = FOCUS_LEN, point = true) { S.hl = { key, t0: t, dur, point }; return S.hl; }
// a touch anywhere: the ring and the hand let go, and a trip still under way stops where it is
export function focusEnd(S) { if (S && S.hl) { S.hl = null; S.to = null; } }

// where the list should scroll so a row (its top `off`, its height `h`) sits in the upper middle of a window `avail`
// high: a short row starts 22% down (room under it for the pointer), a tall one just under the top; never past the ends
export function focusY(off, h, avail, max, s = 1) {
  const lead = h < avail * 0.72 ? Math.max(8 * s, Math.min(avail * 0.22, avail - h - 8 * s)) : 8 * s;
  return Math.max(0, Math.min(Math.max(0, max), off - lead));
}
// start the trip there: from where the list stands now, eased by scroll.js (about 0.4 s); Calm motion: straight there
export function focusTrip(S, to, calm) { S.v = 0; if (calm) { S.y = to; S.to = null; } else S.to = to; }

// how it looks at time t: null when over; a = opacity, p = the ring's pulse 0..1, bob = the hand's bounce 0..1,
// press = the hand is down. Calm motion: a steady ring and a still hand.
export function focusLook(F, t, calm = false) {
  if (!F) return null;
  const el = t - F.t0, dur = F.dur || FOCUS_LEN;
  if (!(el >= 0) || el >= dur) return null;
  if (calm) return { a: 1, p: 0, bob: 0, press: false, point: !!F.point };
  const q = (el % 0.9) / 0.9; // one tap every 0.9 s
  return { a: Math.min(1, el / 0.2, (dur - el) / 0.5), p: 0.5 - 0.5 * Math.cos(el * Math.PI * 2 / 0.75), bob: 0.5 - 0.5 * Math.cos(q * Math.PI * 2), press: q > 0.38 && q < 0.62, point: !!F.point };
}

// the ring round rect R (corner radius r) and, with tip, the hand whose finger touches tip. The ring sits outside the
// tile; the hand comes up from below the button so the art and the price stay clear. box: the hand stays inside it.
export function focusDraw(ctx, ui, look, R, r, s, tip = null, box = null) {
  if (!look || !R) return;
  const o = (4 + 4 * look.p) * s;
  ctx.save(); ctx.globalAlpha = look.a;
  ui.roundRect(R.x - o, R.y - o, R.w + 2 * o, R.h + 2 * o, r + o); ctx.lineWidth = (6 + 3 * look.p) * s; ctx.strokeStyle = 'rgba(255,214,60,0.5)'; ctx.stroke();
  ui.roundRect(R.x - o, R.y - o, R.w + 2 * o, R.h + 2 * o, r + o); ctx.lineWidth = 3 * s; ctx.strokeStyle = '#fff3a8'; ctx.stroke();
  ctx.restore();
  if (tip && look.point) focusHand(ctx, look, tip, s, box);
}
export function focusHand(ctx, look, tip, s, box = null) {
  let hs = (tip.size || 46) * s, x = tip.x, y = tip.y + (1 - look.bob) * 9 * s;
  // no room under the button (the list's last row): a smaller hand, on the button's end, clear of the name and the price
  if (box && tip.y + 9 * s > box.y + box.h - hs * 1.04) { hs *= 0.78; y = Math.min(y, box.y + box.h - hs); if (tip.side != null) x = tip.side; }
  drawHand(ctx, x, y, hs, look.press, look.a);
}
