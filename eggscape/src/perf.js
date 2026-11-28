// Graphics quality (2026-11-19 speed pass). mykee's friend's 2-3 year old Xiaomi: the rings looked "stuck", the game
// ran at a few frames a second while a new phone was smooth. The cost was the drawing (every ring, creature and
// backdrop painted from shapes 60 times a second), not the physics. This module picks how much to draw:
//
//   high    full resolution (up to 2x device pixels), every effect, 60 fps
//   medium  1.5x / 1.25x pixels, no light shafts or menu sparkle
//   low     1x / 0.8x pixels, one flat backdrop picture (no parallax), no ambient creatures, frozen menu scenes,
//           fewer particles
//
// Settings > Display: Graphics Auto / High / Medium / Low, Frame rate Auto / 30 / 60.
// Auto starts from what the phone says about itself (cores, memory, graphics chip; read on the phone, sent nowhere),
// or from what this phone learned last time, then watches the real frame time: it steps down while frames take too
// long and back up after a long run of easy frames. The step it settles on is saved, so the next launch starts there.

// the ladder Auto walks: [tier, max device-pixel ratio]
export const STEPS = [['high', 2], ['high', 1.75], ['medium', 1.5], ['medium', 1.25], ['low', 1], ['low', 0.8]];
export const GFX_LIST = ['auto', 'high', 'medium', 'low'];
export const FPS_LIST = ['auto', 30, 60];
const FIRST = { high: 0, medium: 2, low: 4 };
// 0.8.17 sharpness (mykee 2026-11-26: a tester on Auto played on a blurry picture that looked good on High and never
// knew). Three faults made Auto softer than the phone needed:
//  1. the DETAIL tier and the RESOLUTION were one ladder, so a phone short of JS time (too many drawing commands) was
//     moved to Medium and lost a quarter of its pixels too, which does not buy back any JS time;
//  2. the climb back asked for JS work under half a frame even for a step that only adds pixels, so a mid phone with
//     every frame on time sat on a soft picture for good;
//  3. a phone that says little about itself started soft.
// Now Auto also keeps a resolution floor ("sharp", save.gfxSharp): the pixels Auto holds on to while the detail tier
// moves. Heavy JS work lowers the detail and KEEPS the pixels; late frames with light JS work lower the pixels first;
// clean frames give pixels back even when the JS work is too high for a richer tier.
export const RES = [2, 1.75, 1.5, 1.25, 1, 0.8];
const resDown = (r) => RES.find((v) => v < r - 0.01) || 0, resUp = (r) => [...RES].reverse().find((v) => v > r + 0.01) || 0;

// What the phone says about itself. Nothing here leaves the device.
export function deviceGuess(nav = typeof navigator !== 'undefined' ? navigator : {}) {
  const cores = +nav.hardwareConcurrency || 0, mem = +nav.deviceMemory || 0;
  const mobile = /Android|iPhone|iPad|Mobile/i.test(nav.userAgent || '');
  let gpu = '';
  try {
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas'), gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (gl) {
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        gpu = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
        const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
      }
    }
  } catch (_) { gpu = ''; }
  // graphics chips of older and budget phones: Adreno 3xx-5xx and 60x-61x, Mali-T, Mali-G31..G57 and G71/G72, PowerVR
  const weakGpu = /Adreno[^0-9]*([3-5]\d\d|6[01]\d)\b|Mali-(T|G3\d|G5[0-7]|G7[12]\b)|PowerVR|SGX|Vivante|VideoCore/i.test(gpu);
  let tier = 'high', unknown = false;
  // 0.8.18 (a tester's iPhone 15 Pro log, 2026-11-26): Safari and WKWebView say "4 cores", no memory size and only
  // "Apple GPU" on every iPhone, so the rule below called a flagship a Low phone and Auto drew it at 1x on a 3x screen
  // (the blurry picture that "looked good on High"). Apple devices are judged by their screen instead: every iPhone
  // with a 3x screen is strong; the 2x ones (SE, older) start on Medium and climb if they can.
  const apple = /iPhone|iPad|iPod/i.test(nav.userAgent || '') || (/Macintosh/i.test(nav.userAgent || '') && +nav.maxTouchPoints > 1);
  if (apple) {
    const dpr = (typeof window !== 'undefined' && +window.devicePixelRatio) || +nav.dpr || 0;
    tier = dpr >= 3 || /iPad|Macintosh/i.test(nav.userAgent || '') ? 'high' : 'medium'; unknown = tier === 'medium';
  } else if (mobile) {
    if ((mem && mem <= 2) || (cores && cores <= 4)) tier = 'low';
    else if ((mem && mem <= 4) || weakGpu) tier = (mem && mem <= 4 && weakGpu) ? 'low' : 'medium';
    // a phone that tells us little (no memory size, or no graphics chip name) starts on Medium, not High: Auto steps up
    // after ~12 s of easy frames anyway, while starting too high would make the first seconds stutter (mykee 2026-11-19)
    else if (!mem || !gpu || !cores) { tier = 'medium'; unknown = true; }
  }
  return { tier, cores, mem, gpu, mobile, unknown };
}

// The live quality state. main.js calls tick() once a frame with the frame interval in ms.
export const PERF = {
  step: 0, // index into STEPS while Auto; fixed tiers use their own first step
  want: -1, // a step change waiting for the start of the next frame
  acc: 0, n: 0, good: 0, warm: 0, slow30: false, work: 0, lift: 0, probes: 0,
  miss: 0, bad: 0, // late frames in the current window; bad windows in a row
  held30: false, // the last level ended on the 30 fps fallback: play starts there again (see newLevel)
  fails: [0, 0, 0, 0, 0, 0], // per step: how often Auto had to leave it this session (climbing back waits longer)
  pace: 1, pn: 0, pm: 0, // fast screens (72-100 Hz): draw every refresh (1) or every second one (2); frames and missed frames of the pace window
  why: '', // the last decision, for the fps meter / speed test ('gpu' = frames late with little JS work, 'js' = JS work)
  guess: null,
  get tier() { return STEPS[this.step][0]; },
  get low() { return this.tier === 'low'; },
  get lite() { return this.tier !== 'high'; },
  sharp: 0, wantSharp: -1, sharpFails: 0, sgood: 0, // Auto's resolution floor (0 = the step's own), a change waiting for the next level, how often it had to give pixels back
  dprCap: 2,
  fpsCap: 60,
};

// settings -> state. save.gfx / save.fps / save.gfxStep (Auto's learned step). Old Battery saver = Low at 30 fps.
export function applySettings(save) {
  if (save.saver) { if (!save.gfx || save.gfx === 'auto') save.gfx = 'low'; if (!save.fps || save.fps === 'auto') save.fps = 30; save.saver = false; }
  if (!GFX_LIST.includes(save.gfx)) save.gfx = 'auto';
  if (!FPS_LIST.includes(save.fps)) save.fps = 'auto';
  if (save.gfx === 'auto') {
    if (!(save.gfxStep >= 0 && save.gfxStep < STEPS.length)) {
      PERF.guess = PERF.guess || deviceGuess();
      save.gfxStep = FIRST[PERF.guess.tier];
      // a phone that tells us little starts with fewer effects but nearly all its pixels: blur is what a player sees first
      save.gfxSharp = PERF.guess.unknown ? 1.75 : 0;
    }
    PERF.step = save.gfxStep;
    PERF.sharp = RES.includes(save.gfxSharp) && save.gfxSharp > STEPS[PERF.step][1] ? save.gfxSharp : 0;
  } else { PERF.step = FIRST[save.gfx]; PERF.sharp = 0; }
  PERF.wantSharp = -1; PERF.sharpFails = 0; PERF.sgood = 0;
  PERF.acc = PERF.n = PERF.good = PERF.warm = PERF.miss = PERF.bad = PERF.work = 0; PERF.want = -1;
  PERF.fails.fill(0);
  PERF.pace = 1; PERF.pn = PERF.pm = 0;
  PERF.held30 = false;
  PERF.slow30 = false; // 2026-11-19: a settings change starts clean (a learned 30 fps cap used to stick even after picking High)
  refresh(save);
}
function refresh(save) {
  if (PERF.sharp <= STEPS[PERF.step][1]) PERF.sharp = 0;
  PERF.dprCap = Math.max(STEPS[PERF.step][1], save.gfx === 'auto' ? PERF.sharp : 0);
  PERF.fpsCap = save.fps === 30 ? 30 : save.fps === 60 ? 60 : (PERF.slow30 ? 30 : 60);
}

// 2026-11-20 governor rework (mykee's flagship walked down to Low 0.8x at 30 fps with 2-7 ms of JS work a frame).
// The old rule stepped down on ONE 2 s window whose MEAN gap was over 22 ms: a few GC pauses, a cache bake or an ad
// could do that, and a 90 Hz screen that drew every second refresh (45 fps) sat right on the line. Now:
//  - a frame is LATE when its gap is over 1.5 frame budgets (budget = 1000 / fps cap: 16.7 ms at 60, so a 90 Hz screen
//    drawing every second refresh, 22 ms, is on time; a missed refresh at 60 Hz, 33 ms, is late);
//  - a window is bad when over 20% of its frames are late; it takes TWO bad windows in a row (4 s of play) to step
//    down, so a short burst of effects or a GC storm is not mistaken for a slow phone;
//  - hitches over 120 ms, the first 3 s of a screen, frames after picture bakes and ad time are never counted;
//  - the lever follows the evidence: JS work under 60% of the budget means the time goes into drawing pixels (raster,
//    GPU, compositing), so Auto takes the next ladder step, which lowers the resolution first (High 2x -> 1.75x);
//    heavy JS work (over 60% of the budget) means fewer canvas commands help more: it skips to the next detail tier;
//  - climbing back needs 12 s of clean frames (under 3% late, work under half the budget), and twice as long again for
//    each time the step above already failed this session (24, 48 s; after 3 failures it stays down until the next
//    launch), so Auto cannot see-saw between two steps.
const LATE = 1.5, BAD = 0.2, CLEAN = 0.03, JS_HEAVY = 0.6;

// One frame went by (ms = time since the last drawn frame). Returns true when the step changed (main.js then resizes
// the canvas at the start of the next frame). measuring: false on screens that stand still or while paused.
// work: the game's own time on the last frame (ms, update + drawing commands).
// skip: this gap is not the phone's pace (the frame before it baked pictures): left out, the window goes on
// iv: the screen's refresh interval (ms)
export function tick(save, ms, measuring, work = 0, skip = false, iv = 16.7) {
  if (!measuring) { PERF.acc = PERF.n = PERF.work = PERF.miss = 0; PERF.warm = 0; PERF.pn = PERF.pm = 0; return false; }
  if (PERF.held30) { // play begins after a level that ended at 30: start there, do not fall to it again (newLevel)
    PERF.held30 = false;
    if (save.fps === 'auto' && !PERF.slow30) { PERF.slow30 = true; PERF.lift = 0; PERF.why = 'held'; refresh(save); }
  }
  if (skip) return false;
  if ((PERF.warm += ms / 1000) < 3) return false; // a screen's first seconds build caches: not a measure of the phone
  if (ms > 120) return false; // one hitch (loading, garbage collection), not a slow phone
  // 2026-11-20 the pace on a fast screen (mykee's 91 Hz phone; the root of its stutter): at 90 Hz a frame has 11 ms,
  // not 16.7. A frame that needs 12-16 ms (fine at 60 Hz) misses its refresh and shows for 22 ms, so play jumped
  // between 91 and 45 fps from one frame to the next. The app asks the screen for its 60 Hz mode (MainActivity); where
  // the screen stays fast and more than one frame in eight misses, the game draws every SECOND refresh from then on:
  // a steady 45 looks far smoother than 91 and 45 mixed. It stays that way for the session (a new Settings choice tries again).
  if (iv < 14.5 && PERF.pace === 1 && PERF.fpsCap === 60) {
    PERF.pn++; if (ms > iv * 1.5) PERF.pm++;
    if (PERF.pn >= 120) { if (PERF.pm > PERF.pn * 0.125) { PERF.pace = 2; PERF.why = 'pace'; PERF.acc = PERF.n = PERF.work = PERF.miss = PERF.bad = 0; } PERF.pn = PERF.pm = 0; }
  }
  // 0.8.18 (the same iPhone log): Low Power Mode holds the screen at 30 Hz. Every frame then takes 33 ms, which is
  // on time for THAT screen, but against a 16.7 ms budget every frame counted as late and Auto walked down to Low
  // 0.8x for nothing. A frame can never be earlier than the screen's own refresh: that is the budget's floor.
  const budget = Math.max(1000 / PERF.fpsCap, iv > 0 ? iv * 0.98 : 0);
  PERF.acc += ms / 1000; PERF.n++; PERF.work += work;
  if (ms > budget * LATE) PERF.miss++;
  if (PERF.acc < 2) return false;
  const avg = PERF.acc / PERF.n, wavg = PERF.work / PERF.n, late = PERF.miss / PERF.n;
  PERF.acc = PERF.n = PERF.work = PERF.miss = 0;
  // 2026-11-20 (mykee, 0.8.6: after buying a skin the meter went red at 30 fps and stayed, with 6.5 ms of work a
  // frame): the 30 fps fallback used to latch for good. Now, held at 30 with lots of room (work well under a 60 fps
  // frame), it tries 60 again after a few calm seconds, waiting longer each time it has to fall back
  if (PERF.slow30 && save.fps === 'auto') {
    if (wavg < 10 && avg < 1 / 26) { if (++PERF.lift >= 3 * (1 + PERF.probes)) { PERF.slow30 = false; PERF.lift = 0; PERF.probes = Math.min(4, PERF.probes + 1); refresh(save); } }
    else PERF.lift = 0;
    return false;
  }
  if (save.gfx !== 'auto') return false;
  if (late > BAD) {
    PERF.good = 0;
    if (++PERF.bad < 2) return false; // one bad window (a burst of effects, a GC storm): wait for a second one
    PERF.bad = 0;
    const js = wavg > budget * JS_HEAVY;
    PERF.why = js ? 'js' : 'gpu';
    PERF.sgood = 0;
    // 0.8.17: pixels held above the step's own resolution go first when the drawing (not the JS) is late
    if (!js && PERF.sharp > STEPS[PERF.step][1]) {
      const r = resDown(PERF.sharp);
      PERF.wantSharp = r > STEPS[PERF.step][1] ? r : 0; PERF.sharpFails = Math.min(3, PERF.sharpFails + 1);
      PERF.want = PERF.step; return true;
    }
    if (PERF.step < STEPS.length - 1) {
      let to = PERF.step + 1;
      if (js) { // straight to the next detail tier, and the pixels stay (0.8.17: fewer commands is the cure, not blur)
        const t = STEPS[PERF.step][0]; while (to < STEPS.length - 1 && STEPS[to][0] === t) to++;
        PERF.wantSharp = PERF.dprCap;
      }
      PERF.fails[PERF.step] = Math.min(3, PERF.fails[PERF.step] + 1);
      PERF.want = to; return true;
    }
    if (!PERF.slow30 && save.fps === 'auto') { PERF.slow30 = true; refresh(save); } // the lowest step still can't hold the pace: a steady 30 beats a jumpy 40
    return false;
  }
  PERF.bad = 0;
  // 0.8.17: a step up inside the same tier only adds pixels, which costs raster time, not JS: it may be taken with JS
  // work up to 80% of the frame (it used to need under 50%, and mid phones stayed soft with every frame on time)
  const pixelsOnly = PERF.step > 0 && STEPS[PERF.step - 1][0] === STEPS[PERF.step][0] && PERF.sharp < STEPS[PERF.step - 1][1];
  if (late < CLEAN && wavg < budget * (pixelsOnly ? 0.8 : 0.5) && PERF.fpsCap === 60) {
    const f = PERF.step > 0 ? PERF.fails[PERF.step - 1] : 0, need = f >= 3 ? Infinity : 12 * 2 ** f;
    if ((PERF.good += 2) >= need && PERF.step > 0) { PERF.want = PERF.step - 1; PERF.good = 0; PERF.sgood = 0; PERF.why = 'up'; return true; }
  } else PERF.good = 0;
  // ... and where the JS work is too high for a richer tier but every frame is on time, the pixels alone come back
  if (late < CLEAN && wavg < budget * 0.8 && PERF.fpsCap === 60 && PERF.dprCap < RES[0] && PERF.want < 0) {
    const need = PERF.sharpFails >= 3 ? Infinity : 12 * 2 ** PERF.sharpFails;
    if ((PERF.sgood += 2) >= need) { PERF.wantSharp = resUp(PERF.dprCap); PERF.want = PERF.step; PERF.sgood = 0; PERF.why = 'sharp'; return true; }
  } else PERF.sgood = 0;
  return false;
}
// a new level: its card runs at 60 again
export function newLevel(save) {
  PERF.lift = 0; PERF.acc = PERF.n = PERF.work = PERF.miss = PERF.bad = 0; PERF.warm = 0;
  // 0.8.15 (a budget phone's log: Auto went back to 60 on every level card and fell to 30 about 10 s into play, every
  // level, so each level began with seconds of stutter): the cap a level ENDED on is remembered for the session. The
  // level card still runs at 60 (it is light); the first frame of play returns to 30. A phone that only had a slow
  // stretch gets 60 back the usual way (a few calm seconds with room to spare, see tick), and then the next level
  // starts at 60 too.
  if (PERF.slow30 && save.fps === 'auto') { PERF.slow30 = false; PERF.held30 = true; refresh(save); }
}
// the waiting step change lands (called at the start of a frame, before drawing)
// 2026-11-20: a step UP waits for the next level (changing the resolution mid-level is itself a visible hitch, and
// Auto used to climb and fall again and again during play); a step DOWN lands at once, then Auto waits again
export function takeStep(save, playing = false) {
  if (PERF.want < 0) return false;
  const moreSharp = PERF.wantSharp > PERF.dprCap + 0.01 && PERF.want === PERF.step; // pixels coming back: between levels, like any step up
  if (playing && (PERF.want < PERF.step || moreSharp)) return false;
  PERF.warm = 0; PERF.bad = 0;
  PERF.step = PERF.want; PERF.want = -1;
  if (PERF.wantSharp >= 0) { PERF.sharp = PERF.wantSharp; PERF.wantSharp = -1; }
  if (save.gfx === 'auto') { save.gfxStep = PERF.step; save.gfxSharp = PERF.sharp > STEPS[PERF.step][1] ? PERF.sharp : 0; }
  refresh(save);
  return true;
}
// the speed test (src/speedtest.js) draws at each step in turn, then puts back exactly what was running
export function benchStep(i, dprCap = STEPS[i][1]) { PERF.step = i; PERF.dprCap = dprCap; }
// 0.8.17 the picture advisor: what Settings says about the picture right now, and whether another choice would suit
// this phone better. devDpr = the screen's own pixel ratio. Read on the phone, sent nowhere.
//   sharp   the drawn pixels against what this screen can show at the game's best (2x): 1 = as sharp as it gets
//   tip     '' or one honest sentence; to = the Graphics choice the tip speaks of
export function advise(save, devDpr = 1) {
  const best = Math.min(devDpr || 1, RES[0]), now = Math.min(devDpr || 1, PERF.dprCap), sharp = best > 0 ? now / best : 1;
  const soft = sharp < 0.8, g = PERF.guess;
  let line, tip = '', to = '';
  if (save.gfx === 'auto') {
    line = `Auto: ${TIER_NAME[PERF.tier]} detail, ${soft ? 'softer picture to stay smooth' : 'sharp picture'}`;
    if (soft) { tip = 'High is sharper, but play may stutter on this phone'; to = 'high'; }
  } else if (save.gfx === 'high') line = 'Sharpest picture, every effect';
  else {
    line = save.gfx === 'medium' ? 'Softer picture, fewer light effects' : 'Smoothest on older phones';
    if (soft && g && g.tier === 'high') { tip = 'This phone can show a sharper picture: try Auto'; to = 'auto'; }
  }
  return { sharp, soft, line, tip, to };
}
// for the Settings line: what Auto is running right now
export const TIER_NAME = { high: 'High', medium: 'Medium', low: 'Low' };
