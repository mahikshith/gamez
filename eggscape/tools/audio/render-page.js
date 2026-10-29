// Browser-side helpers for render.mjs: offline rendering + API robustness checks.
import { audio, createAudioEngine, SFX_NAMES, MATERIALS } from '../../src/audio.js';

function toB64(f32) {
  const u8 = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}

window.renderCase = async (c) => {
  const sr = c.sr || 44100, len = Math.ceil(((c.dur || 5) + (c.preroll != null ? c.preroll : 0.5)) * sr);
  const ctx = new OfflineAudioContext(2, len, sr);
  const eng = createAudioEngine(ctx, { seed: c.seed != null ? c.seed : 1234, limiter: c.limiter !== false });
  eng.unlock();
  if (c.material) eng.setMaterial(c.material);
  // Pre-roll: the compressor needs a moment after context start, so actions happen at `pre`.
  const pre = c.preroll != null ? c.preroll : 0.5;
  let stats = null;
  const act = () => {
    if (c.kind === 'sfx') {
      const h = eng.play(c.name, c.opts || {});
      if (c.stopAt) ctx.suspend(pre + c.stopAt).then(() => { h.stop(); ctx.resume(); });
    } else if (c.kind === 'ring') eng.setRingTurn(c.speed);
    else if (c.kind === 'fire') eng.setFireLoop(true);
    else if (c.kind === 'wind') eng.setWind(c.level);
    else if (c.kind === 'underwater') eng.setUnderwater(true);
    else if (c.kind === 'music') {
      eng.music(c.spec);
      if (c.next) ctx.suspend(pre + c.next.at).then(() => { eng.music(c.next.spec); ctx.resume(); });
    } else if (c.kind === 'stress') {
      eng.music(c.spec); eng.setFireLoop(true); eng.setWind(1); eng.setRingTurn(1);
      let k = 0;
      for (const n of c.names) eng.play(n, { intensity: 1, vol: 1, pan: ((k++ % 5) - 2) / 2 });
      stats = eng.stats();
    }
  };
  if (pre > 0) ctx.suspend(pre).then(() => { act(); ctx.resume(); }); else act();
  const t0 = performance.now();
  const buf = await ctx.startRendering();
  const ms = performance.now() - t0;
  const skip = Math.round(pre * sr), n = len - skip;
  const L = buf.getChannelData(0), R = buf.getChannelData(1), out = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { out[2 * i] = L[i + skip]; out[2 * i + 1] = R[i + skip]; }
  return { sr, b64: toB64(out), stats, ms };
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const errors = [], notes = {};
const t = (label, fn) => { try { fn(); } catch (e) { errors.push(label + ': ' + (e && e.message)); } };
const spec = { root: 'C', scale: 'major', bpm: 112, mood: 'farm' };
window.apiPre = () => {
  // before unlock: everything must be a silent no-op
  t('pre-unlock', () => {
    audio.play('egg_bump', { intensity: 1 }); audio.setRingTurn(0.5); audio.setMaterial('glass');
    audio.music(spec); audio.duck(0.5, 1); audio.pauseAll(); audio.resumeAll();
    audio.setSfx(false); audio.setSfx(true); audio.setMusic(false); audio.setMusic(true);
    audio.setWind(1); audio.setWind(0); audio.setFireLoop(true); audio.setFireLoop(false);
    audio.setUnderwater(true); audio.setUnderwater(false);
    const h = audio.play('bomb_fuse'); h.stop(); h.stop();
  });
  t('garbage-args', () => {
    audio.play('nope'); audio.play(); audio.play(null, null); audio.play('toString'); audio.play('__proto__'); audio.play('constructor');
    audio.setMaterial('constructor'); audio.music({ mood: 'constructor', root: 'toString', scale: '__proto__' });
    audio.play('egg_bump', { intensity: NaN, pitch: -5, pan: 99, vol: 'x' });
    audio.setMaterial('lava'); audio.music(null); audio.music({}); audio.music('farm'); audio.setRingTurn(NaN); audio.duck('a', 'b');
  });
  notes.readyBeforeUnlock = audio.ready;
  document.getElementById('unlock').onclick = () => audio.unlock();   // harness clicks it = real user gesture
};
window.apiPost = async () => {
  await wait(300);
  notes.stateAfterUnlock = audio.ctx && audio.ctx.state;
  t('play-all', () => { for (const n of SFX_NAMES) audio.play(n, { intensity: Math.random(), pan: Math.random() * 2 - 1 }); });
  t('bad-names-unlocked', () => { for (const n of ['toString', '__proto__', 'constructor', 'hasOwnProperty', 'nope']) { const h = audio.play(n); h.stop(); } audio.setMaterial('constructor'); audio.setRingTurn(1); });
  notes.voicesAfterAll = audio.stats().voices;
  t('merge', () => { for (let i = 0; i < 20; i++) audio.play('score_tick'); });
  notes.voicesAfterMerge = audio.stats().voices;
  t('loops', () => {
    for (const m of MATERIALS) { audio.setMaterial(m); audio.setRingTurn(Math.random()); }
    audio.setFireLoop(true); audio.setWind(0.7); audio.setUnderwater(true);
  });
  t('music', () => { audio.music(spec); audio.music({ root: 'D', scale: 'minor', bpm: 120, mood: 'storm' }); audio.duck(0.6, 0.5); });
  await wait(1500);
  notes.statsRunning = audio.stats();
  t('pause', () => audio.pauseAll());
  await wait(400);
  notes.stateAfterPause = audio.ctx.state;
  t('play-while-paused', () => audio.play('egg_break'));
  t('resume', () => audio.resumeAll());
  await wait(400);
  notes.stateAfterResume = audio.ctx.state;
  t('toggle', () => { audio.setSfx(false); audio.setMusic(false); audio.setSfx(true); audio.setMusic(true); });
  t('stop', () => { audio.stopMusic(); audio.setFireLoop(false); audio.setWind(0); audio.setUnderwater(false); audio.setRingTurn(0); });
  await wait(2600);
  notes.statsAfterStop = audio.stats();
  // no AudioContext available at all
  const saved = [window.AudioContext, window.webkitAudioContext];
  window.AudioContext = undefined; window.webkitAudioContext = undefined;
  const e2 = createAudioEngine();
  t('no-audiocontext', () => {
    e2.unlock(); e2.play('egg_break').stop(); e2.music(spec); e2.setRingTurn(1); e2.setMaterial('ice');
    e2.setFireLoop(true); e2.setWind(1); e2.setUnderwater(true); e2.duck(1, 1); e2.pauseAll(); e2.resumeAll(); e2.stopMusic();
    e2.setSfx(false); e2.setMusic(false);
  });
  notes.noCtxReady = e2.ready;
  [window.AudioContext, window.webkitAudioContext] = saved;
  return { errors, notes };
};
window.ready = true;
