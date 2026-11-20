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
  PERF.acc = PERF.n = PERF.good = PERF.warm = 0; PERF.want = -1;
  PERF.slow30 = false; // 2026-11-19: a settings change starts clean (a learned 30 fps cap used to stick even after picking High)
  refresh(save);
}
function refresh(save) {
  PERF.dprCap = STEPS[PERF.step][1];
  PERF.fpsCap = save.fps === 30 ? 30 : save.fps === 60 ? 60 : (PERF.slow30 ? 30 : 60);
}

// One frame went by (ms = time since the last drawn frame). Returns true when the step changed (main.js then resizes
// the canvas at the start of the next frame). measuring: false on screens that stand still or while paused.
// work: the game's own time on the last frame (ms, update + drawing commands).
// skip: this gap is not the phone's pace (the frame before it baked pictures): left out, the window goes on
export function tick(save, ms, measuring, work = 0, skip = false) {
  if (!measuring) { PERF.acc = PERF.n = PERF.work = 0; PERF.warm = 0; return false; }
  if (skip) return false;
  if ((PERF.warm += ms / 1000) < 3) return false; // a screen's first seconds build caches: not a measure of the phone
  if (ms > 120) return false; // one hitch (loading, garbage collection), not a slow phone
  PERF.acc += ms / 1000; PERF.n++; PERF.work += work;
  if (PERF.acc < 2) return false;
  const avg = PERF.acc / PERF.n, wavg = PERF.work / PERF.n;
  PERF.acc = PERF.n = PERF.work = 0;
  // 2026-11-20 (mykee, 0.8.6: after buying a skin the meter went red at 30 fps and stayed, with 6.5 ms of work a
  // frame): the 30 fps fallback used to latch for good. Now, held at 30 with lots of room (work well under a 60 fps
  // frame), it tries 60 again after a few calm seconds, waiting longer each time it has to fall back
  if (PERF.slow30 && save.fps === 'auto') {
    if (wavg < 10 && avg < 1 / 26) { if (++PERF.lift >= 3 * (1 + PERF.probes)) { PERF.slow30 = false; PERF.lift = 0; PERF.probes = Math.min(4, PERF.probes + 1); refresh(save); } }
    else PERF.lift = 0;
    return false;
  }
  if (save.gfx !== 'auto') return false;
  const target = PERF.fpsCap === 30 ? 1 / 26 : 1 / 45, easy = PERF.fpsCap === 30 ? 1 / 31 : 1 / 56;
  if (avg > target) {
    PERF.good = 0;
    if (PERF.step < STEPS.length - 1) { PERF.want = PERF.step + 1; return true; }
    if (!PERF.slow30 && save.fps === 'auto') { PERF.slow30 = true; refresh(save); } // the lowest step still can't hold 45: a steady 30 beats a jumpy 40
    return false;
  }
  if (avg < easy && PERF.fpsCap === 60) {
    if ((PERF.good += 2) >= 12 && PERF.step > 0) { PERF.want = PERF.step - 1; PERF.good = 0; return true; }
  } else PERF.good = 0;
  return false;
}
// a new level: Auto's 30 fps fallback starts over (a slow stretch in one level, or a skin's first pictures being
// baked, no longer holds every later level at 30)
export function newLevel(save) {
  PERF.lift = 0; PERF.acc = PERF.n = PERF.work = 0; PERF.warm = 0;
  if (PERF.slow30 && save.fps === 'auto') { PERF.slow30 = false; refresh(save); }
}
// the waiting step change lands (called at the start of a frame, before drawing)
// 2026-11-20: a step UP waits for the next level (changing the resolution mid-level is itself a visible hitch, and
// Auto used to climb and fall again and again during play); a step DOWN lands at once, then Auto waits again
export function takeStep(save, playing = false) {
  if (PERF.want < 0) return false;
  if (playing && PERF.want < PERF.step) return false;
  PERF.warm = 0;
  PERF.step = PERF.want; PERF.want = -1;
  if (save.gfx === 'auto') save.gfxStep = PERF.step;
  refresh(save);
  return true;
}
// for the Settings line: what Auto is running right now
export const TIER_NAME = { high: 'High', medium: 'Medium', low: 'Low' };
