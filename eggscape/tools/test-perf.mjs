// Auto quality and the 30 fps fallback (src/perf.js): node tools/test-perf.mjs
import { PERF, applySettings, tick, newLevel, takeStep, STEPS, advise, deviceGuess } from '../src/perf.js';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const save = { gfx: 'auto', fps: 'auto', gfxStep: STEPS.length - 1 };
applySettings(save);
const run = (secs, ms, work, skip = false) => { for (let t = 0; t < secs * 1000; t += ms) tick(save, ms, true, work, skip); };
run(3, 16, 4); // warm-up
run(6, 30, 20);
ok(PERF.fpsCap === 30, 'lowest step, slow frames, heavy work: falls back to 30 fps');
run(4, 33, 5);
ok(PERF.fpsCap === 30, 'not back at once');
run(4, 33, 5);
ok(PERF.fpsCap === 60, 'held at 30 with lots of room: tries 60 again after a few calm seconds');
run(6, 30, 20);
ok(PERF.fpsCap === 30, 'still slow: back to 30');
run(8, 33, 5);
ok(PERF.fpsCap === 30, 'the second try waits longer');
run(6, 33, 5);
ok(PERF.fpsCap === 60, '... then tries again');
run(6, 30, 20);
ok(PERF.fpsCap === 30, 'slow again');
newLevel(save);
ok(PERF.fpsCap === 60, 'a new level starts at 60 (its card)');
tick(save, 16, false); tick(save, 16, false);
ok(PERF.fpsCap === 60, 'the level card stays at 60');
tick(save, 30, true, 20);
ok(PERF.fpsCap === 30, '0.8.15: play after a level that ended at 30 starts at 30 (no fall every level)');
run(3, 33, 5); run(20, 33, 5);
ok(PERF.fpsCap === 60, '... and a phone with room gets 60 back after calm seconds');
newLevel(save); tick(save, 16, true, 4);
ok(PERF.fpsCap === 60, '... then the next level plays at 60 from the start');
applySettings(save);
run(3, 16, 4);
run(8, 60, 30, true);
ok(PERF.fpsCap === 60, 'gaps after frames that bake pictures (a new skin) are not counted');
const fixed = { gfx: 'low', fps: 'auto' }; applySettings(fixed);
for (let t = 0; t < 10000; t += 30) tick(fixed, 30, true, 20);
ok(PERF.fpsCap === 60, 'a fixed graphics setting never drops to 30 on its own');

// ---- the governor (2026-11-20 rework): robust to hitches, no see-saw, picks the lever from the evidence
let rr = 5; const rnd = () => ((rr = (rr * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const A = () => { const s = { gfx: 'auto', fps: 'auto', gfxStep: 0 }; applySettings(s); return s; };
// play secs of frames from gen() -> [gap ms, work ms] (or null = a frame after a picture bake); returns step changes taken
function play(s, secs, gen, opts = {}) {
  let t = 0, moves = 0;
  while (t < secs * 1000) {
    const f = gen(t); const skip = f === null; const [ms, w] = f || [16.7, 3];
    tick(s, ms, opts.measuring !== false, w, skip);
    if (PERF.want >= 0 && takeStep(s, opts.playing !== false)) moves++;
    t += ms;
  }
  return moves;
}
const steady = (ms, w) => () => [ms * (0.97 + 0.06 * rnd()), w];
let s = A();
play(s, 60, (t) => { const r = rnd(); return r < 0.04 ? [33.4, 4] : r < 0.05 ? [50, 6] : [16.7, 3]; });
ok(PERF.step === 0, 'flagship at 60 Hz with GC pauses (4% one missed refresh, 1% two): stays on High 2x');
s = A();
play(s, 60, (t) => (t % 2000 < 17 ? [160, 30] : [16.7, 3]));
ok(PERF.step === 0, 'a 160 ms hitch every 2 s (ads, loading): never counted');
s = A();
play(s, 60, steady(22.2, 4));
ok(PERF.step === 0 && PERF.fpsCap === 60, '90 Hz screen drawing every second refresh (45 fps, 22 ms): on pace, no step down');
s = A();
play(s, 3, steady(60, 4)); play(s, 30, steady(16.7, 3));
ok(PERF.step === 0, 'a slow level start (first 3 s baking caches): not counted');
s = A();
newLevel(s); play(s, 3, steady(16.7, 3)); play(s, 2.05, steady(33.4, 4)); play(s, 30, steady(16.7, 3));
ok(PERF.step === 0, 'one bad 2 s window (a burst of effects) is not enough to step down');
s = A();
play(s, 30, steady(40, 30), { measuring: false });
ok(PERF.step === 0, 'nothing is measured off the play screen or during ads');
s = A();
play(s, 3, steady(16.7, 3));
const m1 = play(s, 4.1, (t) => (rnd() < 0.35 ? [33.4, 3] : [16.7, 3]));
ok(PERF.step === 1 && m1 === 1 && PERF.why === 'gpu', `late frames with little JS work (raster-bound): one step, resolution first (High 2x -> 1.75x), got step ${PERF.step}`);
s = A();
play(s, 3, steady(16.7, 3));
play(s, 4.1, (t) => (rnd() < 0.35 ? [33.4, 14] : [16.7, 13]));
ok(PERF.step === 2 && PERF.why === 'js', `late frames with heavy JS work: straight to the next detail tier (Medium), got step ${PERF.step}`);
s = A();
play(s, 3, steady(16.7, 3));
play(s, 4.2, steady(33.4, 3));
ok(PERF.step === 1, 'a phone at a steady 30 fps steps down after two windows (4 s)');
// see-saw: step 0 is too heavy for this phone, step 1 is fine. 30 levels of 60 s each
s = A(); let moves = 0;
for (let lv = 0; lv < 30; lv++) {
  newLevel(s); takeStep(s, false);
  moves += play(s, 60, () => (PERF.step === 0 ? (rnd() < 0.3 ? [33.4, 3] : [16.7, 3]) : [16.7, 3]));
}
ok(moves <= 8 && PERF.step <= 1, `a phone between two steps does not see-saw: ${moves} step changes in 30 levels`);
// a slow phone still goes all the way down and to 30 fps
s = A();
for (let lv = 0; lv < 6; lv++) { newLevel(s); play(s, 20, () => [40 * (0.9 + 0.2 * rnd()), 12]); }
ok(PERF.step === STEPS.length - 1 && PERF.fpsCap === 30, `a truly slow phone still reaches Low 0.8x and 30 fps (step ${PERF.step}, ${PERF.fpsCap} fps)`);
// recovery: clean frames climb back one step per level
s = { gfx: 'auto', fps: 'auto', gfxStep: 3 }; applySettings(s);
for (let lv = 0; lv < 4; lv++) { newLevel(s); takeStep(s, false); play(s, 30, steady(16.7, 3)); }
newLevel(s); takeStep(s, false);
ok(PERF.step === 0, `a capable phone started low climbs back to High (step ${PERF.step})`);
// ---- 0.8.17 sharpness: the pixels and the detail are two levers (a tester on Auto played on a blurry picture)
s = A();
play(s, 3, steady(16.7, 3));
play(s, 4.1, () => (rnd() < 0.35 ? [33.4, 14] : [16.7, 13]));
ok(PERF.tier === 'medium' && PERF.dprCap === 2 && s.gfxSharp === 2, `heavy JS work lowers the detail and KEEPS the pixels (tier ${PERF.tier}, ${PERF.dprCap}x)`);
newLevel(s); play(s, 3, steady(16.7, 9)); play(s, 4.2, () => (rnd() < 0.35 ? [33.4, 5] : [16.7, 5]));
ok(PERF.tier === 'medium' && PERF.dprCap === 1.75, `then late frames with light JS work give pixels back first, one notch (${PERF.dprCap}x)`);
s = { gfx: 'auto', fps: 'auto', gfxStep: 2 }; applySettings(s);
for (let lv = 0; lv < 3; lv++) { newLevel(s); takeStep(s, false); play(s, 30, steady(16.7, 10)); }
newLevel(s); takeStep(s, false);
ok(PERF.tier === 'medium' && PERF.dprCap === 2, `a mid phone with every frame on time but busy JS (10 ms): stays Medium detail and gets its pixels back (${PERF.tier} ${PERF.dprCap}x)`);
s = { gfx: 'auto', fps: 'auto', gfxStep: 3 }; applySettings(s);
{ const before = PERF.dprCap; newLevel(s); play(s, 40, steady(16.7, 10)); ok(PERF.dprCap === before, 'pixels never come back in the middle of a level (the resize is a hitch)'); takeStep(s, false); ok(PERF.dprCap > before, '... they land with the next level'); }
s = { gfx: 'auto', fps: 'auto', gfxStep: 1 }; applySettings(s);
newLevel(s); play(s, 20, steady(16.7, 12)); newLevel(s); takeStep(s, false);
ok(PERF.step === 0, 'High 1.75x with on-time frames and 12 ms of JS: the last pixels come back (the old rule wanted under 8 ms)');
s = { gfx: 'auto', fps: 'auto', gfxStep: -1 }; PERF.guess = { tier: 'medium', unknown: true }; applySettings(s);
ok(PERF.tier === 'medium' && PERF.dprCap === 1.75, `a phone that says little about itself starts on Medium detail but 1.75x, not 1.5x (${PERF.dprCap}x)`);
PERF.guess = { tier: 'medium', unknown: false }; s = { gfx: 'auto', fps: 'auto', gfxStep: -1 }; applySettings(s);
ok(PERF.dprCap === 1.5, 'a phone with a known weak chip starts at 1.5x as before');
// a phone that cannot hold the extra pixels does not see-saw
s = { gfx: 'auto', fps: 'auto', gfxStep: 2 }; applySettings(s); moves = 0;
for (let lv = 0; lv < 30; lv++) { newLevel(s); if (takeStep(s, false)) moves++; moves += play(s, 60, () => (PERF.dprCap > 1.5 ? (rnd() < 0.3 ? [33.4, 10] : [16.7, 10]) : [16.7, 10])); }
ok(moves <= 8 && PERF.dprCap <= 1.75, `a phone that is only smooth at 1.5x does not see-saw: ${moves} changes in 30 levels`);
s = { gfx: 'high', fps: 'auto', gfxSharp: 2 }; applySettings(s); ok(PERF.dprCap === 2, 'High is 2x');
s = { gfx: 'low', fps: 'auto', gfxSharp: 2 }; applySettings(s); ok(PERF.dprCap === 1, 'a fixed choice is never sharpened behind the player\'s back');
{
  s = { gfx: 'auto', fps: 'auto', gfxStep: 3 }; applySettings(s); let a = advise(s, 3);
  ok(a.soft && a.to === 'high' && /softer/.test(a.line), 'the advisor: Auto on a soft picture says so and names High');
  s = { gfx: 'auto', fps: 'auto', gfxStep: 0 }; applySettings(s); a = advise(s, 3);
  ok(!a.soft && !a.tip && /sharp picture/.test(a.line), 'the advisor: Auto at full resolution says "sharp picture"');
  s = { gfx: 'auto', fps: 'auto', gfxStep: 4 }; applySettings(s); a = advise(s, 1);
  ok(!a.soft, 'the advisor: a 1x screen drawn at 1x is as sharp as it gets, no tip');
  PERF.guess = { tier: 'high' }; s = { gfx: 'low', fps: 'auto' }; applySettings(s); a = advise(s, 3);
  ok(a.to === 'auto' && a.tip, 'the advisor: Low picked by hand on a strong phone suggests Auto');
  PERF.guess = null;
}
// ---- 0.8.18 an iPhone 15 Pro's log: guessed Low, and Low Power Mode's 30 Hz screen read as a slow phone
{
  const g = deviceGuess({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148', hardwareConcurrency: 4, dpr: 3 });
  ok(g.tier === 'high', `an iPhone with a 3x screen is a strong phone whatever its "4 cores" say (${g.tier})`);
  const g2 = deviceGuess({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) Mobile/15E148', hardwareConcurrency: 4, dpr: 2 });
  ok(g2.tier === 'medium' && g2.unknown, 'an iPhone with a 2x screen starts on Medium detail with nearly all its pixels');
  const g3 = deviceGuess({ userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A057F) Mobile', hardwareConcurrency: 4, deviceMemory: 4, dpr: 2 });
  ok(g3.tier === 'low', 'a four-core Android phone is still a Low phone');
  const s = A(); let t = 0, moves = 0;
  while (t < 120000) { tick(s, 33.3 * (0.98 + 0.04 * rnd()), true, 5, false, 33.3); if (PERF.want >= 0 && takeStep(s, true)) moves++; t += 33.3; }
  ok(PERF.step === 0 && PERF.fpsCap === 60 && moves === 0, `a 30 Hz screen (Low Power Mode) with every frame on its refresh: Auto stays on High (step ${PERF.step}, cap ${PERF.fpsCap})`);
  t = 0; while (t < 20000) { tick(s, rnd() < 0.4 ? 66.6 : 33.3, true, 5, false, 33.3); if (PERF.want >= 0) takeStep(s, true); t += 40; }
  ok(PERF.step > 0, 'the same screen really missing refreshes still steps down');
}
// ---- the pace on a fast screen (90 Hz): missing refreshes locks every second refresh, quality stays
{
  const s = A(); let i = 0;
  const run90 = (secs, gen) => { for (let t = 0; t < secs * 1000;) { const [ms, w] = gen(i++); tick(s, ms, true, w, false, 11.1); t += ms; } };
  run90(4, () => [11.1, 4]);
  ok(PERF.pace === 1 && PERF.step === 0, '90 Hz, every frame in time: draws every refresh');
  run90(6, (k) => [k % 3 ? 11.1 : 22.2, 7]);
  ok(PERF.pace === 2, '90 Hz, one frame in three misses its refresh: locks to every second refresh');
  ok(PERF.step === 0 && PERF.fpsCap === 60, '... and the graphics stay where they were');
  run90(10, () => [22.2, 7]);
  ok(PERF.step === 0 && PERF.fpsCap === 60 && PERF.pace === 2, 'a steady 45 on the 90 Hz screen is on pace: nothing steps down');
  const s2 = A(); i = 0;
  for (let t = 0; t < 8000; t += 16.7) tick(s2, i++ % 4 ? 16.7 : 33.4, true, 6, false, 16.7);
  ok(PERF.pace === 1, 'a 60 Hz screen never changes pace');
}
console.log(bad ? `${bad} FAILED` : 'all perf checks passed');
process.exit(bad ? 1 : 0);
