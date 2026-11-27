// The first levels' tour (0.8.17; mykee: "Initial levels like 1, 2 and 3: introduce the user to the settings and
// everything in the pause menu, and shop too"; "many users feel there are too many buttons"). No new buttons and one
// or two words at most: a gold ring and the teaching hand on what is already there. Each step once ever (save.seen),
// never a sheet, never holding a tap (any touch ends it and still does its job), never in play's busy moments.
//   pauseBtn   once level 1 is won, the first quiet spell of play (hands off, nothing else on screen): the ring and the
//              hand on the pause button, "Pause" under it (~2.6 s)
//   pausePage  the first time the pause page opens: the ring speed, the sound switches and Resume light up in turn (~2 s)
//              (0.8.19, the rebuilt page: the turtle-to-hare slider, the three round switches top right, the big Resume)
//   shop       once level 3 is won (director.js earlyDays over), on the map or the pause page: the hand on the shop
//              button and one free taste (an egg to try free). It shows where the shop is: never a price, never an offer.
// Every step asks the Brain's gate first (brain.js: a tour step is not an ask; in play only in a quiet spell).
// Pure: the numbers and rules here (tools/test-tour.mjs); main.js draws.
import { gate } from './brain.js';
import { earlyDays } from './director.js';

export const TOUR = { pauseAfter: 3, pauseIdle: 2.5, pauseLen: 2.6, pageDelay: 0.3, pageStep: 0.7, pageLen: 2.3, shopLen: 4.5 };
const KEY = { pauseBtn: 'tourPause', pausePage: 'tourPP', shop: 'tourShop' };
export const TOUR_STEPS = Object.keys(KEY);

export const tourSeen = (save, step) => !!(save && save.seen && save.seen[KEY[step]]);
export function tourMark(save, step) { if (KEY[step]) save.seen = { ...(save.seen || {}), [KEY[step]]: 1 }; return save; }

// may this step start now? ctx: { screen, levelId (the road level in hand; 0 for none), won1 (level 1 is won),
//   quiet (play: hands off long enough and nothing else on screen), busy (a sheet, a trip, another hand ...), now }
export function tourMay(save, step, ctx = {}) {
  if (!save || !KEY[step] || tourSeen(save, step) || ctx.busy) return false;
  const lv = Number(ctx.levelId) || 0;
  if (step === 'pauseBtn') {
    if (ctx.screen !== 'play' || !ctx.won1 || lv < 2 || !ctx.quiet) return false;
    return gate(save, 'play', { ...ctx, tour: true }).nudge;
  }
  if (step === 'pausePage') {
    if (ctx.screen !== 'pause' || lv < 1) return false;
    return gate(save, 'pause', { ...ctx, tour: true }).nudge;
  }
  if (step === 'shop') { // nothing of the shop is pointed at before level 3 is won, and never in play
    if (earlyDays(save) || !['levels', 'title', 'pause'].includes(ctx.screen)) return false;
    return gate(save, ctx.screen === 'pause' ? 'pause' : 'home', { ...ctx, tour: true }).nudge;
  }
  return false;
}

// the pause page's steps at el seconds since it opened: 'rs' (ring speed), 'snd' (the switches), 'go' (Resume), the
// ring's opacity a, and done. Calm motion: the three at once, steady. has: which of them the page shows.
export function tourPageAt(el, calm = false, has = { rs: true, snd: true, go: true }) {
  const T = TOUR, t = el - T.pageDelay, order = ['rs', 'snd', 'go'].filter((k) => has[k]);
  if (t < 0) return { on: [], a: 0, done: false };
  if (t >= T.pageLen || !order.length) return { on: [], a: 0, done: true };
  const a = Math.min(1, t / 0.15, (T.pageLen - t) / 0.3);
  if (calm) return { on: order, a, done: false };
  const step = Math.min(order.length - 1, Math.floor(t / T.pageStep));
  return { on: [order[step]], a, step, done: false };
}

// the free taste: the first egg (else outfit) not owned that may be tried free now. items: [{ key, owned, canTry }].
// Only the key goes out: the tour shows the thing, never what it costs.
export function shopTaste(items) {
  const L = (Array.isArray(items) ? items : []).filter((i) => i && !i.owned && i.canTry && /^(skin|hen):/.test(i.key));
  const t = L.find((i) => /^skin:/.test(i.key)) || L[0];
  return t ? t.key : null;
}
