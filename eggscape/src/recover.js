// The slow-drawing watchdog (0.8.12). mykee, twice (speed logs of 0.8.9 and 0.8.10, Nothing A024): ten or eleven minutes
// in, as the level 13 card opened, every screen became 5 to 10 times dearer to draw at once (the card 33 fps, play 70
// to 85 ms of drawing a frame where it had been 6 to 10, the shop 22 fps with 4 ms of game work), memory was fine, no
// "context lost" was reported, and nothing brought the speed back until he closed the app and opened it again. That is
// the web view no longer drawing with the graphics chip. Why it lets go is not known yet; this module makes sure the
// game notices within seconds, puts it right by itself, and writes down what it took, so the next log names the cause.
//
// Three signs (a "window" is one second of measured frames on one screen):
//   probe  a fixed drawing job on a fresh canvas takes 3x (and 8 ms) longer than it did while the phone was healthy
//   menu   a menu screen runs under 0.72 of the rate this same screen held earlier at this resolution or sharper
//   play   the game's own work per frame is over 3x (and over 30 ms) what play cost earlier at this resolution or sharper
// A sign only counts on a phone that has shown at least 20 healthy seconds this session and is not throttling for heat.
// Two bad windows in a row ask for a probe; a slow probe is proof ("gpu"). Without that proof it takes six bad windows
// over at least two different screens with no healthy window between them ("fps": a hard level slows play, it does
// not slow the menus).
//
// The cure climbs a ladder, at a calm moment (level card, map, home; or in the first seconds of a level):
//   1  load the page again                         (canvas state kept by the page)
//   2  end the page's own process, start it again  (the web view's drawing process; Android app only)
//   3  start the whole app again                   (the graphics thread lives in the app's process; what mykee did by hand)
// After each rung the game comes back where the player was, checks again, and climbs if it is still slow. The rung that
// worked is remembered and tried first the next time. If none works the watchdog rests for a day. At most three cures
// in ten minutes. Everything is written to the speed log as "rec" and "prb" lines. Nothing leaves the phone.

const KEY = 'eggscape.rec.v1';
const SAFE = { intro: 1, levels: 1, title: 1 };
const MENU = 0.72, JS_X = 3, JS_MIN = 30, NEED = 20, DAY = 86400000;

export const REC = {
  on: false, rungs: 1, state: 'off', // ok | suspect | sick | verify | off
  healthy: 0, bad: 0, badScr: {}, ref: {}, stepOk: -1,
  base: 0, probes: 0, last: null, want: false, wins: 0,
  why: '', rung: 0, inc: null, v: null, note: '', store: {}, log: null, st: null, now: Date.now,
};

function load() { try { const s = REC.st && REC.st.getItem(KEY); const o = s ? JSON.parse(s) : {}; return o && typeof o === 'object' ? o : {}; } catch (_) { return {}; } }
function keep() { try { if (REC.st) REC.st.setItem(KEY, JSON.stringify(REC.store)); } catch (_) { /* optional */ } }
function say(o) { try { if (REC.log) REC.log(Object.assign({ k: 'rec' }, o)); } catch (_) { /* optional */ } }
const r1 = (x) => Math.round(x * 10) / 10;
// the probe's own verdict: is ms slow against the healthy time? (no healthy time, or a phone that never drew fast: no verdict)
export function probeSlow(ms, base = REC.base) { return base > 0 && base < 12 && ms > Math.max(3 * base, base + 8); }

// o: { storage, log (line) => void, rungs 1..3, now () => ms, off true = switched off (a test, a demo) }
// -> the mark to come back to after a cure that is under 25 s old ({ scr, li, world, rung, why, ... }), or null
export function recInit(o = {}) {
  REC.st = o.storage || null; REC.log = o.log || null; REC.rungs = Math.max(1, Math.min(3, o.rungs || 1)); REC.now = o.now || Date.now;
  REC.store = load(); REC.base = +REC.store.base || 0;
  REC.healthy = REC.bad = REC.probes = REC.wins = 0; REC.badScr = {}; REC.ref = {}; REC.stepOk = -1; REC.last = null; REC.want = false; REC.inc = null; REC.v = null; REC.why = ''; REC.rung = 0;
  const t = REC.now(), m = REC.store.mark;
  REC.on = !o.off; REC.state = REC.on ? 'ok' : 'off';
  if (REC.on && REC.store.off && t - REC.store.off < DAY) { REC.state = 'off'; say({ e: 'rest', h: r1((DAY - (t - REC.store.off)) / 3600000) }); }
  if (m) { delete REC.store.mark; keep(); }
  if (!REC.on || !m || !(t - m.at >= 0 && t - m.at < 25000)) return null;
  if (REC.state === 'off') return m; // still land where the player was
  REC.state = 'verify'; REC.v = { m, n: 0, fps: 0, p: null }; REC.want = true;
  say({ e: 'back', rung: m.rung, why: m.why, ms: t - m.at });
  return m;
}

// one second of frames on one screen. w: { scr, fps, js (ms of game work a frame), dpr, cap (the rate asked for), step,
// hot (Android says the phone is throttling for heat) }
export function recWindow(w) {
  if (!REC.on || REC.state === 'off') return;
  REC.wins++;
  if (REC.state === 'verify') return verify(w);
  if (REC.state === 'sick') return;
  const fine = w.fps >= 0.85 * w.cap, r = REC.ref[w.scr];
  let bad = false;
  if (REC.healthy >= NEED && r && w.dpr <= r.dpr + 0.01) {
    if (w.scr === 'play') bad = r.n >= 5 && w.js > Math.max(JS_X * r.js, JS_MIN);
    else bad = r.n >= 2 && w.fps < MENU * r.fps;
  }
  if (bad && w.hot) return; // a hot phone slows itself down: not this fault, and starting again would not cool it
  if (bad) {
    REC.bad++; REC.badScr[w.scr] = 1;
    if (!REC.inc) REC.inc = { scr: w.scr, fps: r1(w.fps), js: r1(w.js), ref: r1(r.fps), rjs: r1(r.js), dpr: w.dpr };
    if (REC.bad === 2) { REC.state = 'suspect'; REC.want = true; say({ e: 'suspect', s: w.scr, fps: r1(w.fps), js: r1(w.js), ref: r1(r.fps), rjs: r1(r.js) }); }
    else if (REC.bad > 2) {
      if (REC.bad % 4 === 0) REC.want = true; // ask the probe again while it lasts
      // no proof from the probe (it has no healthy time to compare with, or fresh canvases are fine and only the game's
      // own is slow): every screen slow for six seconds, menus included, on a phone that is not hot
      if (REC.bad >= 6 && Object.keys(REC.badScr).length >= 2) sick('fps');
    }
    return;
  }
  if (fine) {
    if (REC.bad) { if (REC.state === 'suspect') say({ e: 'clear', s: w.scr, fps: r1(w.fps) }); REC.bad = 0; REC.badScr = {}; REC.inc = null; REC.state = 'ok'; }
    REC.healthy++; REC.stepOk = w.step;
    if (!r || w.dpr > r.dpr + 0.01) REC.ref[w.scr] = { fps: w.fps, js: w.js, dpr: w.dpr, n: 1 };
    else { r.n++; r.fps += (w.fps - r.fps) * 0.15; r.js += (w.js - r.js) * 0.15; if (w.dpr < r.dpr) r.dpr = w.dpr; }
    // a healthy phone keeps its probe time fresh: three early in the session, then one about every two minutes of windows
    if (REC.probes < 3 ? REC.wins % 3 === 0 : REC.wins % 120 === 0) REC.want = true;
  }
}
function sick(why) {
  if (REC.state === 'sick') return;
  const t = REC.now(), h = (REC.store.hist || []).filter((x) => t - x < 600000);
  REC.store.hist = h;
  if (h.length >= 3) { REC.state = 'off'; say({ e: 'limit' }); keep(); return; } // three cures in ten minutes: leave it to the quality steps
  REC.state = 'sick'; REC.why = why; REC.rung = REC.rung || Math.min(REC.rungs, REC.store.best || 1);
  say(Object.assign({ e: 'sick', why, rung: REC.rung, p: REC.last, base: r1(REC.base) }, REC.inc));
}

// a probe ran. p: { n: ms the fixed job took on a fresh canvas }
export function recProbe(p) {
  if (!REC.on) return;
  REC.probes++; REC.last = r1(p.n); REC.want = false;
  const slow = probeSlow(p.n);
  try { if (REC.log) REC.log({ k: 'prb', n: REC.last, base: r1(REC.base), st: REC.state, slow: slow ? 1 : 0 }); } catch (_) { /* optional */ }
  if (REC.state === 'verify') { REC.v.p = p; return verdict(); }
  if (REC.state === 'suspect') { if (slow) sick('gpu'); return; }
  // healthy: the best time this phone has shown is the yardstick (kept between sessions)
  if (REC.state === 'ok' && !REC.bad && p.n > 0 && (!REC.base || p.n < REC.base)) { REC.base = p.n; REC.store.base = r1(p.n); keep(); }
}

function verify(w) { const v = REC.v; v.n++; v.fps += w.fps; v.cap = w.cap; verdict(); }
function verdict() {
  const v = REC.v; if (!v || !v.p || v.n < 3) return;
  const m = v.m, fps = v.fps / v.n, pOk = !probeSlow(v.p.n), fOk = fps >= 0.8 * (m.ref || v.cap || 60);
  const ok = m.why === 'gpu' ? pOk : fOk && (pOk || !(REC.base > 0));
  REC.v = null;
  if (ok) {
    REC.store.best = m.rung; keep();
    REC.note = 'ok';
    say({ e: 'ok', rung: m.rung, why: m.why, fps: r1(fps), was: m.fps, p: r1(v.p.n), base: r1(REC.base) });
    REC.state = 'ok'; REC.healthy = NEED; REC.bad = 0; REC.badScr = {}; REC.inc = null; REC.rung = 0;
    return;
  }
  say({ e: 'still', rung: m.rung, why: m.why, fps: r1(fps), was: m.fps, p: r1(v.p.n), base: r1(REC.base) });
  if (m.rung < REC.rungs) { REC.state = 'sick'; REC.why = m.why; REC.rung = m.rung + 1; REC.inc = { scr: m.scr, fps: m.fps, js: m.js, ref: m.ref, rjs: m.rjs }; return; }
  REC.store.off = REC.now(); keep(); REC.state = 'off'; REC.rung = 0; say({ e: 'gaveup' }); // the whole ladder did not help: rest for a day, the quality steps take over
}

// is it time? scr: the screen, busy: an ad, a purchase, a sheet or a card in the way, playT: seconds into the level (play only)
// -> the rung to climb now, or 0
export function recDue(scr, busy, playT = 99) {
  if (!REC.on || REC.state !== 'sick' || busy) return 0;
  if (SAFE[scr] || (scr === 'play' && playT < 12)) return REC.rung;
  return 0;
}
// the cure starts: the mark the next page (or the next app start) comes back to. where: { scr, li, world }
export function recGo(where) {
  const t = REC.now(), i = REC.inc || {};
  const m = { at: t, scr: where.scr === 'play' ? 'intro' : where.scr, li: where.li, world: where.world, rung: REC.rung, why: REC.why, fps: i.fps || 0, js: i.js || 0, ref: i.ref || 0, rjs: i.rjs || 0 };
  REC.store.mark = m; (REC.store.hist = REC.store.hist || []).push(t); keep();
  say({ e: 'go', rung: m.rung, why: m.why, s: where.scr, step: REC.stepOk });
  REC.state = 'off'; // this page is done
  return m;
}
// the watchdog believes the phone is ill: quality steps taken now are not the phone's own level and are not remembered
export function recIll() { return REC.on && (REC.state === 'suspect' || REC.state === 'sick'); }
