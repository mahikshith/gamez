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
  let tier = 'high';
  if (mobile) {
    if ((mem && mem <= 2) || (cores && cores <= 4)) tier = 'low';
    else if ((mem && mem <= 4) || weakGpu) tier = (mem && mem <= 4 && weakGpu) ? 'low' : 'medium';
    // a phone that tells us little (no memory size, or no graphics chip name) starts on Medium, not High: Auto steps up
    // after ~12 s of easy frames anyway, while starting too high would make the first seconds stutter (mykee 2026-11-19)
    else if (!mem || !gpu || !cores) tier = 'medium';
  }
  return { tier, cores, mem, gpu, mobile };
}

// The live quality state. main.js calls tick() once a frame with the frame interval in ms.
export const PERF = {
  step: 0, // index into STEPS while Auto; fixed tiers use their own first step
  want: -1, // a step change waiting for the start of the next frame
  acc: 0, n: 0, good: 0, warm: 0, slow30: false, work: 0, lift: 0, probes: 0,
  miss: 0, bad: 0, // late frames in the current window; bad windows in a row
  fails: [0, 0, 0, 0, 0, 0], // per step: how often Auto had to leave it this session (climbing back waits longer)
  pace: 1, pn: 0, pm: 0, // fast screens (72-100 Hz): draw every refresh (1) or every second one (2); frames and missed frames of the pace window
  why: '', // the last decision, for the fps meter / speed test ('gpu' = frames late with little JS work, 'js' = JS work)
  guess: null,
  get tier() { return STEPS[this.step][0]; },
  get low() { return this.tier === 'low'; },
  get lite() { return this.tier !== 'high'; },
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
    }
    PERF.step = save.gfxStep;
  } else PERF.step = FIRST[save.gfx];
  PERF.acc = PERF.n = PERF.good = PERF.warm = PERF.miss = PERF.bad = PERF.work = 0; PERF.want = -1;
  PERF.fails.fill(0);
  PERF.pace = 1; PERF.pn = PERF.pm = 0;
  PERF.slow30 = false; // 2026-11-19: a settings change starts clean (a learned 30 fps cap used to stick even after picking High)
  refresh(save);
}
function refresh(save) {
  PERF.dprCap = STEPS[PERF.step][1];
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
  const budget = 1000 / PERF.fpsCap;
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
    if (PERF.step < STEPS.length - 1) {
      let to = PERF.step + 1;
      if (js) { const t = STEPS[PERF.step][0]; while (to < STEPS.length - 1 && STEPS[to][0] === t) to++; } // straight to the next detail tier
      PERF.fails[PERF.step] = Math.min(3, PERF.fails[PERF.step] + 1);
      PERF.want = to; return true;
    }
    if (!PERF.slow30 && save.fps === 'auto') { PERF.slow30 = true; refresh(save); } // the lowest step still can't hold the pace: a steady 30 beats a jumpy 40
    return false;
  }
  PERF.bad = 0;
  if (late < CLEAN && wavg < budget * 0.5 && PERF.fpsCap === 60) {
    const f = PERF.step > 0 ? PERF.fails[PERF.step - 1] : 0, need = f >= 3 ? Infinity : 12 * 2 ** f;
    if ((PERF.good += 2) >= need && PERF.step > 0) { PERF.want = PERF.step - 1; PERF.good = 0; PERF.why = 'up'; return true; }
  } else PERF.good = 0;
  return false;
}
// a new level: Auto's 30 fps fallback starts over (a slow stretch in one level, or a skin's first pictures being
// baked, no longer holds every later level at 30)
export function newLevel(save) {
  PERF.lift = 0; PERF.acc = PERF.n = PERF.work = PERF.miss = PERF.bad = 0; PERF.warm = 0;
  if (PERF.slow30 && save.fps === 'auto') { PERF.slow30 = false; refresh(save); }
}
// the waiting step change lands (called at the start of a frame, before drawing)
// 2026-11-20: a step UP waits for the next level (changing the resolution mid-level is itself a visible hitch, and
// Auto used to climb and fall again and again during play); a step DOWN lands at once, then Auto waits again
export function takeStep(save, playing = false) {
  if (PERF.want < 0) return false;
  if (playing && PERF.want < PERF.step) return false;
  PERF.warm = 0; PERF.bad = 0;
  PERF.step = PERF.want; PERF.want = -1;
  if (save.gfx === 'auto') save.gfxStep = PERF.step;
  refresh(save);
  return true;
}
// the speed test (src/speedtest.js) draws at each step in turn, then puts back exactly what was running
export function benchStep(i, dprCap = STEPS[i][1]) { PERF.step = i; PERF.dprCap = dprCap; }
// for the Settings line: what Auto is running right now
export const TIER_NAME = { high: 'High', medium: 'Medium', low: 'Low' };
