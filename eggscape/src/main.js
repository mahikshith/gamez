// Eggscape: game shell. Screens, input, camera, events -> VFX/SFX/score, HUD.
import { Sim, DT } from './sim/sim.js';
import { RING_TH, clamp, lerp } from './sim/geom.js';
import { LEVELS } from './data/levels.js';
import { THEMES, createBackdrop } from './themes.js';
import { audio } from './audio.js';
import { portal } from './sdk/portal.js';
import { FX } from './render/fx.js';
import * as W from './render/world.js';
import { UI, FONT, ICON, drawStar, drawEggIcon, drawFox } from './ui/ui.js';
import fontUrl from '../assets/fonts/fredoka-600-latin.woff2';
import { botTick } from './dev/bot.js';

const DEV = typeof __DEV__ !== 'undefined' ? __DEV__ : true;

// ---------------------------------------------------------------- save
const SAVE_VER = 1;
const defaultSave = () => ({ v: SAVE_VER, unlocked: 1, stars: {}, best: {}, streak: 0, sfx: true, music: true, seen: {} });
let save = defaultSave();
function persist() {
  try { portal.save(JSON.stringify(save)); } catch (e) { /* never block */ }
}

// ---------------------------------------------------------------- canvas
const canvas = document.getElementById('game') || Object.assign(document.body.appendChild(document.createElement('canvas')), { id: 'game' });
const ctx = canvas.getContext('2d');
const ui = new UI(ctx);
let W_ = 0, H_ = 0, DPR = 1;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W_ = Math.max(320, window.innerWidth);
  H_ = Math.max(320, window.innerHeight);
  canvas.width = Math.round(W_ * DPR);
  canvas.height = Math.round(H_ * DPR);
  canvas.style.width = W_ + 'px';
  canvas.style.height = H_ + 'px';
  ui.resize(W_, H_);
  if (G.backdrop) G.backdrop.resize(W_, H_, DPR);
  G.camSnap = true;
}

// ---------------------------------------------------------------- game state
const G = {
  screen: 'loading',
  t: 0,
  li: 0,
  sim: null,
  level: null,
  theme: null,
  backdrop: null,
  fx: new FX(),
  cam: { x: 0, y: 0, k: 60 },
  camSnap: true,
  acc: 0,
  hitstop: 0,
  held: new Map(), // pointerId -> { ring, x, y }
  hover: null,
  keySel: 0,
  keys: {},
  popups: [],
  toasts: [],
  toast: null,
  result: null,
  screenT: 0,
  adBusy: false,
  usedRewind: false,
  doubled: false,
  golden: false,
  firstInput: false,
  fuseHandle: null,
  lastTick: -1,
  overlaps: [],
  hudBottom: 0,
  play: { x: 0, y: 0, w: 0, h: 0 },
};

function themeFor(level) {
  return THEMES.find((t) => t.id === level.theme) || THEMES[(level.id - 1) % THEMES.length];
}

function startLevel(i, opts = {}) {
  // leaving a level that was not won (quit, or gave up after a fail) ends the star streak
  if (G.sim && !G.result && G.sim.t > 1 && save.streak) { save.streak = 0; persist(); }
  G.run = (G.run || 0) + 1;
  G.li = i;
  G.level = LEVELS[i];
  G.theme = themeFor(G.level);
  G.sim = new Sim(G.level, { golden: !!opts.golden });
  G.golden = !!opts.golden;
  G.backdrop = createBackdrop(G.theme, G.level.id * 97);
  G.backdrop.resize(W_, H_, DPR);
  G.fx = new FX();
  G.popups = [];
  G.toasts = [];
  G.toast = null;
  G.result = null;
  G.usedRewind = false;
  G.doubled = false;
  G.held.clear();
  G.keySel = firstGrabbable(0, 1);
  G.camSnap = true;
  G.acc = 0;
  G.lastTick = -1;
  stopFuse();
  audio.setMaterial(G.level.material || 'wood');
  audio.setUnderwater(!!G.level.water);
  audio.setWind(0);
  audio.setFireLoop(false);
  audio.music(G.theme.music);
  setScreen(opts.direct ? 'play' : 'intro');
  if (opts.direct) {
    portal.gameplayStart();
    toast(G.level.tip, 3.2);
  }
}

function setScreen(s) {
  G.screen = s;
  G.screenT = 0;
  ui.pressedId = null;
}

function firstGrabbable(from, dir) {
  const rings = G.sim ? G.sim.rings : [];
  for (let k = 0; k < rings.length; k++) {
    const i = (((from + dir * k) % rings.length) + rings.length) % rings.length;
    if (rings[i].grabbable) return i;
  }
  return 0;
}

// ---------------------------------------------------------------- toasts & popups
function toast(text, life = 2.6, icon = null) {
  if (!text) return;
  G.toasts.push({ text, life, icon });
}

function popup(wx, wy, text, o = {}) {
  const s = toScreen(wx, wy);
  G.popups.push({ x: s.x, y: s.y, text, sub: o.sub || '', color: o.color || '#fff', life: o.life || 1.3, max: o.life || 1.3, size: (o.size || 26) * ui.u, placed: false });
}

// ---------------------------------------------------------------- camera
function computeLayout() {
  const u = ui.u;
  const twoRows = W_ < 760;
  G.hudBottom = Math.round((twoRows ? 104 : 64) * u);
  const top = G.hudBottom + 8 * u;
  G.play = { x: 0, y: top, w: W_, h: H_ - top - 6 * u };
}

function camTarget() {
  const sim = G.sim;
  if (!sim) return { x: 0, y: 0, k: 60 };
  const n = sim.rings.length;
  let maxCh = 0;
  for (const e of sim.aliveEggs()) maxCh = Math.max(maxCh, sim.channelOf(e));
  const showAll = G.screen !== 'play' || maxCh >= n - 1 || (sim.nestAmp && maxCh >= n - 2) || sim.state !== 'play' || n <= 2;
  let R, yMin, yMax;
  if (showAll) {
    R = sim.outerR + 0.45;
    yMin = sim.groundY - 0.25;
    yMax = R;
  } else {
    const ring = sim.rings[Math.min(n - 1, Math.max(1, maxCh + 1))];
    R = ring.r + RING_TH + 0.5;
    yMin = -R;
    yMax = R;
  }
  const P = G.play;
  const k = Math.min(P.w / (2 * R), P.h / (yMax - yMin), 190);
  return { x: 0, y: (yMin + yMax) / 2, k };
}

function updateCamera(dt) {
  const T = camTarget();
  if (G.camSnap) { G.cam = { ...T }; G.camSnap = false; return; }
  const a = 1 - Math.exp(-dt * 2.6);
  G.cam.x = lerp(G.cam.x, T.x, a);
  G.cam.y = lerp(G.cam.y, T.y, a);
  G.cam.k = lerp(G.cam.k, T.k, a);
}

function toScreen(x, y) {
  const P = G.play;
  const cx = P.x + P.w / 2, cy = P.y + P.h / 2;
  return { x: cx + (x - G.cam.x) * G.cam.k, y: cy - (y - G.cam.y) * G.cam.k };
}
function toWorld(sx, sy) {
  const P = G.play;
  const cx = P.x + P.w / 2, cy = P.y + P.h / 2;
  return { x: (sx - cx) / G.cam.k + G.cam.x, y: -(sy - cy) / G.cam.k + G.cam.y };
}

// ---------------------------------------------------------------- input
function onFirstInput() {
  audio.unlock();
  if (!G.firstInput) { G.firstInput = true; applyAudioSettings(); }
}

function pointerDown(e) {
  e.preventDefault();
  onFirstInput();
  const x = e.clientX, y = e.clientY;
  const id = ui.hit(x, y);
  if (id) { ui.pressedId = id; G.pressPointer = e.pointerId; return; }
  if (G.screen === 'title') return press('play');
  if (G.screen !== 'play' || !G.sim || G.sim.state !== 'play') return;
  const w = toWorld(x, y);
  const r = Math.hypot(w.x, w.y);
  if (r > G.sim.outerR + 1.2 && w.y < -G.sim.outerR) return; // touching the ground area
  const ring = G.sim.ringAt(r);
  if (!ring.grabbable) {
    audio.play('motor_tick', { vol: 0.8 });
    ring.denied = 0.35;
    return;
  }
  for (const h of G.held.values()) if (h.ring === ring) return;
  G.held.set(e.pointerId, { ring, x, y });
  ring.held = true;
  ring.target = ring.body.getAngle();
  G.keySel = ring.i;
  audio.play('grab', { vol: 0.6 });
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
}

function pointerMove(e) {
  const x = e.clientX, y = e.clientY;
  const h = G.held.get(e.pointerId);
  if (h) {
    const c = toScreen(0, 0);
    const px = h.x - c.x, py = h.y - c.y;
    const dx = x - h.x, dy = y - h.y;
    const rr = Math.max(Math.hypot(px, py), 90 * ui.u);
    // screen y is down, world angle is counter-clockwise
    const dTheta = -(px * dy - py * dx) / (rr * rr);
    h.ring.target += dTheta;
    h.x = x;
    h.y = y;
  } else if (e.pointerType === 'mouse' && G.screen === 'play' && G.sim) {
    const w = toWorld(x, y);
    G.hover = G.sim.ringAt(Math.hypot(w.x, w.y));
  }
}

function pointerUp(e) {
  const h = G.held.get(e.pointerId);
  if (h) {
    h.ring.held = false;
    G.held.delete(e.pointerId);
    audio.play('release', { vol: 0.4 });
  }
  if (ui.pressedId && e.pointerId === G.pressPointer) {
    const id = ui.hit(e.clientX, e.clientY);
    const was = ui.pressedId;
    ui.pressedId = null;
    if (id === was) press(id);
  }
}

function keyDown(e) {
  onFirstInput();
  const k = e.key;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(k)) e.preventDefault();
  G.keys[k.toLowerCase()] = true;
  if ((k === 'Escape' || k === 'p' || k === 'P') && !e.repeat) {
    if (G.screen === 'play') press('pause');
    else if (G.screen === 'pause') press('resume');
    return;
  }
  if (G.screen === 'play' && G.sim) {
    if (k === 'ArrowUp' || k === 'w' || k === 'W') G.keySel = firstGrabbable(Math.min(G.sim.rings.length - 1, G.keySel + 1), 1);
    if (k === 'ArrowDown' || k === 's' || k === 'S') G.keySel = firstGrabbable(Math.max(0, G.keySel - 1), -1);
    if (/^[1-5]$/.test(k)) G.keySel = Math.min(G.sim.rings.length - 1, +k - 1);
  } else if ((k === 'Enter' || k === ' ') && !e.repeat) {
    if (G.screen === 'win' && !(G.result && G.result.t > 1.2)) return;
    const primary = { title: 'play', intro: 'go', win: 'next', fail: 'retry', pause: 'resume' }[G.screen];
    if (primary) press(primary);
  }
}
function keyUp(e) {
  G.keys[e.key.toLowerCase()] = false;
}

function keyboardTurn(dt) {
  if (G.screen !== 'play' || !G.sim) return;
  const ring = G.sim.rings[G.keySel];
  if (!ring || !ring.grabbable) return;
  const dir = (G.keys['arrowleft'] || G.keys['a'] ? 1 : 0) - (G.keys['arrowright'] || G.keys['d'] ? 1 : 0);
  if (dir) {
    if (!ring.held) ring.target = ring.body.getAngle();
    ring.target += dir * G.sim.maxOmega(ring) * dt * 1.1;
    ring.keyHeld = true;
  } else ring.keyHeld = false;
}

// ---------------------------------------------------------------- buttons
async function press(id) {
  audio.play(id === 'pause' || id === 'levels' ? 'ui_back' : 'ui_tap');
  switch (id) {
    case 'play': {
      const i = Math.min(LEVELS.length - 1, save.unlocked - 1);
      await breakThen(() => startLevel(i));
      break;
    }
    case 'levels':
      portal.gameplayStop();
      setScreen('levels');
      break;
    case 'go':
      setScreen('play');
      portal.gameplayStart();
      toast(G.level.tip, 3.4);
      break;
    case 'golden': {
      const ok = await rewarded('golden');
      if (ok) {
        startLevel(G.li, { golden: true });
        toast('Golden shell: your first egg survives one thorn.', 3);
      }
      break;
    }
    case 'pause':
      if (G.screen === 'play') { setScreen('pause'); portal.gameplayStop(); releaseAll(); }
      break;
    case 'resume':
      setScreen('play');
      portal.gameplayStart();
      break;
    case 'restart':
    case 'retry':
      portal.gameplayStop();
      if (id === 'retry' && G.screen === 'fail') { save.streak = 0; persist(); }
      startLevel(G.li, { direct: true });
      break;
    case 'next': {
      const n = Math.min(LEVELS.length - 1, G.li + 1);
      if (G.li === LEVELS.length - 1) { setScreen('levels'); break; }
      await breakThen(() => startLevel(n));
      break;
    }
    case 'rewind': {
      const ok = await rewarded('rewind');
      const back = ok && G.sim.rewind(5);
      if (back) {
        releaseAll();
        stopFuse();
        G.sim = back;
        G.run = (G.run || 0) + 1;
        G.usedRewind = true;
        G.fx = new FX();
        setScreen('play');
        portal.gameplayStart();
        audio.play('rewind');
        toast('Rewound 5 seconds. Streak kept!', 2.4);
      }
      break;
    }
    case 'double': {
      if (G.doubled) break;
      const ok = await rewarded('double');
      if (ok && G.result) {
        G.doubled = true;
        G.result.total *= 2;
        G.result.shownTotal = G.result.total;
        recordResult();
        audio.play('combo', { intensity: 1 });
        portal.happy();
      }
      break;
    }
    case 'sfx':
      save.sfx = !save.sfx;
      applyAudioSettings();
      persist();
      break;
    case 'music':
      save.music = !save.music;
      applyAudioSettings();
      persist();
      break;
    case 'back':
      setScreen('title');
      break;
    default:
      if (id && id.startsWith('lv:')) {
        const i = +id.slice(3);
        if (i < save.unlocked) await breakThen(() => startLevel(i));
      }
  }
}

function releaseAll() {
  for (const h of G.held.values()) h.ring.held = false;
  G.held.clear();
}

async function breakThen(fn) {
  if (G.adBusy) return;
  G.adBusy = true;
  portal.gameplayStop();
  try { await portal.commercialBreak(); } catch (_) {}
  G.adBusy = false;
  fn();
}

async function rewarded(tag) {
  if (G.adBusy) return false;
  G.adBusy = true;
  portal.gameplayStop();
  let ok = false;
  try { ok = await portal.rewarded(tag); } catch (_) { ok = false; }
  G.adBusy = false;
  if (!ok) toast('No ad available right now. Try again in a moment.', 2.4);
  return ok;
}

function applyAudioSettings() {
  const allowed = portal.audioAllowed();
  audio.setSfx(save.sfx && allowed);
  audio.setMusic(save.music && allowed);
}

// ---------------------------------------------------------------- events
let lastBump = 0;
function handleEvents() {
  const sim = G.sim;
  const fx = G.fx;
  for (const ev of sim.events) {
    switch (ev.type) {
      case 'bump':
        if (G.t - lastBump > 0.05 && ev.v > 1.2) {
          lastBump = G.t;
          audio.play('egg_bump', { intensity: clamp(ev.v / 6, 0, 1) });
        }
        if (ev.v > 3.8) { const p = ev.egg.body.getPosition(); fx.dust(p.x, p.y - 0.25, 5); }
        break;
      case 'crack':
        audio.play('egg_crack');
        fx.chips(ev.x, ev.y, '#f3e8d2', 6, 2);
        fx.shake = Math.max(fx.shake, 0.25);
        break;
      case 'break': {
        audio.play(ev.why === 'lava' ? 'lava_sizzle' : 'egg_break');
        if (ev.why === 'thorn') audio.play('thorn_hit');
        if (ev.why === 'lava') { fx.smoke(ev.x, ev.y, 8, 'rgba(70,60,60,0.6)'); fx.chips(ev.x, ev.y, '#ffb347', 10, 3); }
        else fx.yolk(ev.x, ev.y, sim.groundY + 0.02);
        fx.shake = Math.max(fx.shake, 0.55);
        G.hitstop = 0.07;
        const why = { thorn: 'Thorn!', fox: 'The fox took it', ground: 'Missed the nest', lava: 'Into the lava', impact: 'Smashed!', lost: 'Lost' }[ev.why] || '';
        if (why && ev.why !== 'fox') popup(ev.x, ev.y + 0.5, why, { color: '#ff8a7a', size: 20, life: 1.2 });
        break;
      }
      case 'save': {
        audio.play('egg_save', { pitch: 1 + (ev.combo - 1) * 0.12 });
        if (ev.combo > 1) audio.play('combo', { intensity: (ev.combo - 2) / 2 });
        fx.sparkle(ev.x, ev.y, 14);
        fx.punch = 1;
        const parts = [];
        if (ev.perfect) parts.push('PERFECT');
        if (ev.combo > 1) parts.push('COMBO x' + ev.combo);
        popup(ev.x, ev.y + 0.9, '+' + ev.pts, { sub: parts.join('  '), color: '#ffe066', size: 30, life: 1.6 });
        portal.happy();
        break;
      }
      case 'gate':
        audio.play('combo', { intensity: clamp((ev.gx - 2) / 3, 0, 1) });
        fx.sparkle(ev.x, ev.y, 8, '#ffd23f');
        popup(ev.x, ev.y + 0.45, 'x' + ev.gx, { color: '#ffd23f', size: 28, life: 1 });
        break;
      case 'comet':
        audio.play('fire_ignite');
        popup(ev.x, ev.y + 0.5, 'COMET!', { sub: 'safe landing + double score', color: '#9fe8ff', size: 26, life: 1.4 });
        break;
      case 'squish':
        if (G.t - lastBump > 0.05) { lastBump = G.t; audio.play('squish', { intensity: clamp(ev.v / 6, 0, 1) }); }
        fx.dust(ev.x, ev.y, 3, 'rgba(255,230,150,0.7)');
        break;
      case 'cometLand':
        fx.wave(ev.x, ev.y, 0.9, '#bff1ff', 0.4, 0.1);
        audio.play('egg_bump', { intensity: 0.4 });
        break;
      case 'pickup': {
        const names = { fire: 'FIRE EGG', steel: 'STEEL SHELL', bubble: 'BUBBLE', twin: 'TWIN EGG', magnet: 'MAGNET' };
        const tips = {
          fire: 'Burns thorns. Careful: it burns wood and vines too.',
          steel: 'Unbreakable for 8 s. Heavy: it cracks eggs it hits.',
          bubble: 'Floats and pops instead of the egg. It drifts up.',
          twin: 'A new egg hatched! It starts with one crack.',
          magnet: 'Two eggs tied together. One can hold the other.',
        };
        const snd = { fire: 'fire_ignite', steel: 'steel_on', bubble: 'bubble_on', twin: 'twin_hatch', magnet: 'unlock' }[ev.type];
        audio.play(snd || 'unlock');
        fx.sparkle(ev.x, ev.y, 10);
        popup(ev.x, ev.y + 0.5, names[ev.type] || ev.type, { color: '#ffffff', size: 22, life: 1.2 });
        if (!save.seen[ev.type]) { save.seen[ev.type] = 1; persist(); toast(tips[ev.type], 3.4); }
        break;
      }
      case 'twin':
        fx.sparkle(ev.x, ev.y, 12, '#ffe58a');
        break;
      case 'twinFull':
        popup(ev.egg.body.getPosition().x, ev.egg.body.getPosition().y + 0.5, 'Nest is full (4)', { size: 18 });
        break;
      case 'portal':
        audio.play('portal_enter');
        setTimeout(() => audio.play('portal_exit'), 90);
        fx.sparkle(ev.x, ev.y, 8, '#9d8cff');
        fx.sparkle(ev.x2, ev.y2, 10, '#ffc27a');
        break;
      case 'thornBurn':
        audio.play('fire_burn');
        fx.smoke(ev.x, ev.y, 4);
        fx.chips(ev.x, ev.y, '#ff8a3a', 6, 2);
        break;
      case 'thornSnap':
        audio.play('thorn_snap');
        fx.chips(ev.x, ev.y, '#aab2bd', 5, 2);
        break;
      case 'segBurn':
        audio.play('fire_burn');
        fx.smoke(ev.x, ev.y, 6);
        fx.chips(ev.x, ev.y, '#ff7a1a', 8, 2.5);
        break;
      case 'segBreak':
        audio.play(ev.mat === 'glass' ? 'glass_break' : 'wood_break');
        fx.chips(ev.x, ev.y, ev.mat === 'glass' ? '#d9fbff' : '#c9a26a', 10, 3);
        break;
      case 'glassCrack':
        audio.play('glass_crack', { vol: 0.7 });
        break;
      case 'bombLit':
        stopFuse();
        G.fuseHandle = audio.play('bomb_fuse');
        break;
      case 'explode':
        stopFuse();
        audio.play('bomb_explode');
        audio.duck(0.6, 0.6);
        fx.explosion(ev.x, ev.y, ev.R);
        break;
      case 'segBlast':
        break;
      case 'bubbleOn':
        break;
      case 'bubblePop':
        audio.play('bubble_pop');
        fx.burst(ev.x, ev.y, 10, (i, a, b) => ({ x: ev.x + Math.cos(a * 6.3) * 0.38, y: ev.y + Math.sin(a * 6.3) * 0.38, vx: Math.cos(a * 6.3) * 1.5, vy: Math.sin(a * 6.3) * 1.5, drag: 4, life: 0.35, size: 0.03, color: '#dff6ff' }));
        break;
      case 'steelOff':
        audio.play('steel_on', { pitch: 0.7, vol: 0.5 });
        break;
      case 'magnetOn':
      case 'magnetOff':
        audio.play('ui_open', { vol: 0.5 });
        break;
      case 'goldenSave':
        audio.play('thorn_snap');
        popup(ev.egg.body.getPosition().x, ev.egg.body.getPosition().y + 0.5, 'GOLDEN SHELL!', { color: '#ffd23f', size: 22 });
        break;
      case 'timeout':
        if (ev.won) break;
        audio.play('level_fail');
        toast("Time's up! The fox is back.", 2.2);
        break;
      case 'vaultBurst':
        audio.play('bomb_explode', { vol: 0.8 });
        audio.play('wood_break');
        fx.flash = 0.6;
        fx.flashColor = '#fff7da';
        fx.shake = 0.8;
        break;
      case 'won':
        onWin();
        break;
      case 'failed':
        onFail();
        break;
    }
  }
  sim.events.length = 0;
}

function stopFuse() {
  if (G.fuseHandle && G.fuseHandle.stop) G.fuseHandle.stop();
  G.fuseHandle = null;
}

// ---------------------------------------------------------------- results
function computeResult() {
  const sim = G.sim;
  const st = sim.stats();
  const L = G.level;
  const timeBonus = Math.floor(sim.timeLeft) * 10;
  let stars = st.saved >= st.target ? 1 : 0;
  if (stars && st.broken === 0) stars = 2;
  if (stars === 2 && st.perfect && !G.usedRewind) stars = 3;
  const streak = stars === 3 ? (save.streak || 0) + 1 : 0;
  const streakMult = [1, 1, 1.2, 1.5, 2][Math.min(4, streak)];
  const base = st.score + timeBonus;
  const total = Math.round(base * streakMult);
  return { stars, saved: st.saved, eggs: st.total, eggScore: st.score, timeBonus, streak, streakMult, total, shownTotal: 0, t: 0, target: st.target, perfect: st.perfect, rewound: G.usedRewind };
}

function recordResult() {
  const r = G.result;
  const id = G.level.id;
  if (r.stars > 0) {
    save.stars[id] = Math.max(save.stars[id] || 0, r.stars);
    save.best[id] = Math.max(save.best[id] || 0, r.total);
    save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, id + 1));
    save.streak = r.streak;
  }
  persist();
  const totalScore = Object.values(save.best).reduce((a, b) => a + b, 0);
  portal.submitScore(totalScore);
}

function onWin() {
  stopFuse();
  G.sim.burstVault();
  G.result = computeResult();
  recordResult();
  portal.gameplayStop();
  portal.happy();
  const run = G.run;
  setTimeout(() => {
    if (G.run === run && G.sim && G.result && G.screen === 'play') { setScreen('win'); audio.play('level_win'); }
  }, 1100);
}

function onFail() {
  stopFuse();
  portal.gameplayStop();
  releaseAll();
  const run = G.run;
  setTimeout(() => { if (G.run === run && G.sim && G.sim.state === 'failed' && G.screen === 'play') { setScreen('fail'); audio.play('level_fail'); } }, 350);
}

// ---------------------------------------------------------------- update
function update(dt) {
  G.t += dt;
  G.screenT += dt;
  computeLayout();
  if (!G.sim) return;
  const sim = G.sim;
  // the world only runs in play (plus a few seconds of settling behind the end cards), never behind menus
  const running = G.screen === 'play' || ((G.screen === 'win' || G.screen === 'fail') && G.screenT < 4);
  keyboardTurn(dt);
  if (G.hitstop > 0) G.hitstop -= dt;
  else if (running && !G.adBusy) {
    G.acc += Math.min(dt, 0.1);
    let n = 0;
    while (G.acc >= DT && n < 24) { if (DEV && G.autoplay) botTick(sim, G.botMem || (G.botMem = {})); sim.step(); G.acc -= DT; n++; }
    handleEvents();
  }
  for (const r of sim.rings) if (r.denied > 0) r.denied -= dt;

  // per-egg fear + flames
  for (const e of sim.aliveEggs()) {
    const p = e.body.getPosition();
    e.fear = Math.max(0, e.fear - dt);
    for (const ring of sim.rings) {
      const a0 = ring.body.getAngle();
      for (const th of ring.thorns) {
        if (!th.alive || th.ext < 0.5) continue;
        const tx = th.tip * Math.cos(a0 + th.a), ty = th.tip * Math.sin(a0 + th.a);
        if (Math.hypot(tx - p.x, ty - p.y) < 0.55) e.fear = 0.4;
      }
    }
    const v = e.body.getLinearVelocity();
    if (e.fire > 0) { G.fx.flameAt(p.x, p.y + 0.05, 1.1, v.x, v.y); G.fx.flameAt(p.x, p.y - 0.1, 0.9, v.x, v.y); }
    if (e.comet) G.fx.add({ x: p.x + (Math.random() - 0.5) * 0.3, y: p.y + (Math.random() - 0.5) * 0.3, vx: v.x, vy: v.y + 0.6, life: 0.25, size: 0.08, grow: -0.2, color: '#9fe8ff', hot: '#ffffff', type: 'flame' });
  }
  for (const b of sim.bombs) {
    if (b.alive && b.lit && b.spark) G.fx.add({ x: b.spark.x, y: b.spark.y, vx: (Math.random() - 0.5) * 2, vy: Math.random() * 2, g: 4, life: 0.25, size: 0.02, color: '#ffd34d', type: 'spark' });
  }
  for (const pt of sim.portals) {
    if (Math.random() < 0.5) {
      const a = Math.random() * 6.283;
      G.fx.add({ x: pt.ax + Math.cos(a) * 0.5, y: pt.ay + Math.sin(a) * 0.5, vx: -Math.cos(a) * 1.0, vy: -Math.sin(a) * 1.0, life: 0.45, size: 0.025, color: '#b9a8ff', layer: 'back' });
      G.fx.add({ x: pt.bx, y: pt.by, vx: Math.cos(a) * 1.0, vy: Math.sin(a) * 1.0, life: 0.45, size: 0.025, color: '#ffcf8a', layer: 'back' });
    }
  }
  if (Math.abs(sim.wind) > 0.6 && Math.random() < 0.6) {
    const P = G.play;
    const w = toWorld(sim.wind > 0 ? P.x : P.x + P.w, P.y + Math.random() * P.h);
    G.fx.add({ x: w.x, y: w.y, vx: sim.wind * 3.2, vy: 0, life: 1.2, size: 0.012, color: 'rgba(255,255,255,0.55)', type: 'spark' });
  }
  G.fx.update(dt);
  updateCamera(dt);

  // audio loops
  let turn = 0;
  for (const r of sim.rings) if ((r.held || r.keyHeld || r.motor) && G.screen === 'play') turn = Math.max(turn, Math.abs(r.omega) / (sim.maxOmega(r) || 1) * (r.motor ? 0.35 : 1));
  audio.setRingTurn(G.screen === 'play' ? clamp(turn, 0, 1) : 0);
  audio.setFireLoop(G.screen === 'play' && sim.aliveEggs().some((e) => e.fire > 0));
  audio.setWind(G.screen === 'play' && G.level.wind ? Math.abs(sim.wind) / (G.level.wind.strength || 1) : 0);
  if (G.screen !== 'play') stopFuse();
  if (G.screen === 'play' && sim.timeLimit && sim.timeLeft <= 10 && sim.state === 'play') {
    const s = Math.ceil(sim.timeLeft);
    if (s !== G.lastTick) { G.lastTick = s; audio.play('countdown', { pitch: s <= 3 ? 1.3 : 1 }); }
  }

  // popups
  for (const p of G.popups) { p.life -= dt; p.y -= 34 * ui.u * dt; }
  G.popups = G.popups.filter((p) => p.life > 0);
  // toasts
  if (G.toast) { G.toast.life -= dt; if (G.toast.life <= 0) G.toast = null; }
  if (!G.toast && G.toasts.length) G.toast = { ...G.toasts.shift(), t0: G.t };
  if (G.result && G.screen === 'win') {
    const r = G.result;
    r.t += dt;
    const k = clamp((r.t - 0.9) / 1.0, 0, 1);
    const shown = Math.round(r.total * k);
    if (shown !== r.shownTotal && k < 1 && Math.floor(r.t * 20) !== Math.floor((r.t - dt) * 20)) audio.play('score_tick', { vol: 0.4 });
    r.shownTotal = shown;
    for (let s = 0; s < 3; s++) {
      const at = 0.25 + s * 0.3;
      if (r.t >= at && r.t - dt < at && s < r.stars) audio.play('star', { intensity: s / 2 });
    }
  }
}

// ---------------------------------------------------------------- render
function render() {
  const t = G.t;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ui.begin();
  if (!G.sim) {
    ctx.fillStyle = '#1b1410';
    ctx.fillRect(0, 0, W_, H_);
    return;
  }
  const sim = G.sim;
  const fx = G.fx;
  G.backdrop.draw(ctx, t, G.cam);
  // ground band
  const gy = toScreen(0, sim.groundY).y;
  if (gy < H_) G.backdrop.drawGround(ctx, 0, gy, W_, H_ - gy, t);

  // world
  const P = G.play;
  const cx = P.x + P.w / 2, cy = P.y + P.h / 2;
  const sh = fx.shake * fx.shake * 7;
  const ox = (Math.random() - 0.5) * sh, oy = (Math.random() - 0.5) * sh;
  const k = G.cam.k * (1 + 0.025 * fx.punch);
  ctx.setTransform(DPR * k, 0, 0, -DPR * k, DPR * (cx + ox - G.cam.x * k), DPR * (cy + oy + G.cam.y * k));
  fx.draw(ctx, 'back');
  for (const pt of sim.portals) { W.drawPortal(ctx, pt.ax, pt.ay, t, false); W.drawPortal(ctx, pt.bx, pt.by, t, true); }
  if (sim.timeLimit && sim.state === 'play') W.drawFuse(ctx, sim.outerR + 0.32, sim.timeLeft / sim.timeLimit, t, G.screen === 'play' ? fx : null);
  W.drawNest(ctx, sim, G.theme, t, sim.savedLog.length);
  const eggPts = sim.aliveEggs().map((e) => e.body.getPosition());
  for (const ring of sim.rings) {
    const held = ring.held || (ring.keyHeld && G.keySel === ring.i);
    const hover = !held && G.screen === 'play' && ((G.hover === ring && ring.grabbable) || (G.keys.__kb && G.keySel === ring.i));
    ctx.save();
    if (ring.denied > 0) ctx.rotate(Math.sin(t * 60) * 0.01 * ring.denied);
    W.drawRing(ctx, ring, G.theme, k, t, { held, hover, eggs: eggPts, simT: sim.t });
    ctx.restore();
    W.drawItems(ctx, ring, t, G.screen === 'play' ? fx : null);
  }
  if (G.screen === 'play' || G.screen === 'intro') W.drawDropGuide(ctx, sim.rings[sim.rings.length - 1], sim.nest.getPosition().x, sim.nestW, t);
  for (const r of sim.rocks) if (r.alive) W.drawRock(ctx, r, G.theme);
  for (const b of sim.bombs) if (b.alive) b.spark = W.drawBomb(ctx, b, t);
  for (const d of sim.debris) W.drawDebris(ctx, d, G.theme);
  // magnet ropes
  for (const e of sim.aliveEggs()) {
    if (e.joint && e.joint.a === e) {
      const a = e.joint.a.body.getPosition(), b = e.joint.b.body.getPosition();
      ctx.strokeStyle = '#d6262e';
      ctx.lineWidth = 0.035;
      ctx.setLineDash([0.08, 0.05]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  for (const e of sim.aliveEggs()) W.drawEgg(ctx, e, t, k);
  fx.draw(ctx, 'front');
  for (const e of sim.aliveEggs()) W.drawEggMult(ctx, e, k, FONT);

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  G.backdrop.drawAmbient(ctx, t, G.cam);
  if (fx.flash > 0) {
    ctx.globalAlpha = fx.flash * 0.6;
    ctx.fillStyle = fx.flashColor;
    ctx.fillRect(0, 0, W_, H_);
    ctx.globalAlpha = 1;
  }

  // UI
  if (G.screen !== 'title' && G.screen !== 'levels') drawHUD();
  if (G.screen === 'play') { drawPopups(); drawToast(); drawKeyHint(); }
  if (G.screen === 'intro') drawIntro();
  if (G.screen === 'pause') drawPause();
  if (G.screen === 'win') drawWin();
  if (G.screen === 'fail') drawFail();
  if (G.screen === 'title') drawTitle();
  if (G.screen === 'levels') drawLevels();
  if (G.adBusy) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, W_, H_);
  }
  if (DEV || G.checkOverlaps) G.overlaps = ui.overlaps();
}

function dim(a = 0.55) {
  ctx.fillStyle = `rgba(16,10,6,${a})`;
  ctx.fillRect(0, 0, W_, H_);
}

function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

function drawHUD() {
  const u = ui.u;
  const sim = G.sim;
  const pal = G.theme.palette;
  const twoRows = W_ < 760;
  const pad = 12 * u;
  const bs = 46 * u;
  // plate
  ctx.fillStyle = pal.plate || 'rgba(20,14,10,0.55)';
  ctx.fillRect(0, 0, W_, G.hudBottom);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, G.hudBottom - 2, W_, 2);
  const row1 = pad + bs / 2;
  ui.button('pause', '', pad, pad, bs, bs, { icon: ICON.pause, color: '#5a8dee', dark: '#2f5bb0' });
  // score (right)
  const st = sim.stats();
  const scoreTxt = String(st.score);
  const scoreSize = 26 * u;
  const scoreW = ui.measure(scoreTxt, scoreSize);
  const scoreR = ui.text(scoreTxt, W_ - pad, row1 + 2 * u, { size: scoreSize, align: 'right', color: '#ffe066', stroke: 'rgba(0,0,0,0.55)', tag: 'hud:score' });
  ui.text('SCORE', W_ - pad - scoreW - 8 * u, row1 + 3 * u, { size: 13 * u, align: 'right', color: 'rgba(255,255,255,0.75)', tag: 'hud:scoreLabel' });
  const leftEdge = pad + bs + 10 * u;
  const rightEdge = W_ - pad - scoreW - 8 * u - ui.measure('SCORE', 13 * u) - 12 * u;
  // tray + timer content
  const slots = Math.max(G.level.eggs, sim.eggs.length);
  const icon = 24 * u * Math.min(1, 4.5 / slots);
  const traySpace = icon * 0.95;
  const states = [];
  for (const e of sim.eggs) states.push(e.saved ? 'saved' : e.alive ? 'alive' : 'broken');
  while (states.length < slots) states.push('empty');
  const trayW = slots * traySpace;
  const needTxt = `need ${st.target}`;
  const needW = ui.measure(needTxt, 13 * u);
  const timeTxt = sim.timeLimit ? fmtTime(sim.timeLeft) : '';
  const timeW = timeTxt ? ui.measure(timeTxt, 22 * u) + 26 * u : 0;
  const lvlTxt = `${G.level.id}. ${G.level.name}`;
  let trayX, trayY;
  if (twoRows) {
    ui.text(lvlTxt, (leftEdge + rightEdge) / 2, row1, { size: 19 * u, align: 'center', maxW: rightEdge - leftEdge, color: '#fff', stroke: 'rgba(0,0,0,0.5)', tag: 'hud:level' });
    trayY = pad + bs + 12 * u + icon / 2 + 2 * u;
    const groupW = trayW + 8 * u + needW + 20 * u + timeW;
    trayX = W_ / 2 - groupW / 2;
  } else {
    const groupW = trayW + 8 * u + needW + 20 * u + timeW;
    const lvlMax = Math.max(60 * u, (W_ / 2 - groupW / 2) - leftEdge - 12 * u);
    ui.text(lvlTxt, leftEdge, row1, { size: 19 * u, maxW: lvlMax, color: '#fff', stroke: 'rgba(0,0,0,0.5)', tag: 'hud:level' });
    trayY = row1;
    trayX = W_ / 2 - groupW / 2;
  }
  states.forEach((s, i) => {
    const e = sim.eggs[i];
    drawEggIcon(ctx, trayX + traySpace * (i + 0.5), trayY, icon, s, e ? e.cracks : 0);
  });
  ui.record({ x: trayX, y: trayY - icon / 2, w: trayW, h: icon }, 'hud:tray');
  ui.text(needTxt, trayX + trayW + 8 * u, trayY, { size: 13 * u, color: st.saved >= st.target ? '#9dff9d' : 'rgba(255,255,255,0.8)', tag: 'hud:need' });
  if (timeTxt) {
    const tx = trayX + trayW + 8 * u + needW + 20 * u;
    const low = sim.timeLeft <= 10;
    // little fuse-bomb clock icon
    ctx.fillStyle = low ? '#ff5a3c' : '#e9d3a1';
    ctx.beginPath();
    ctx.arc(tx + 9 * u, trayY + 1 * u, 8 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx + 9 * u, trayY + 1 * u);
    ctx.lineTo(tx + 9 * u, trayY - 4 * u);
    ctx.moveTo(tx + 9 * u, trayY + 1 * u);
    ctx.lineTo(tx + 13 * u, trayY + 1 * u);
    ctx.stroke();
    ui.record({ x: tx, y: trayY - 8 * u, w: 18 * u, h: 18 * u }, 'hud:clock', 'hud:time');
    const pulse = low ? 1 + 0.08 * Math.sin(G.t * 12) : 1;
    ui.text(timeTxt, tx + 24 * u, trayY + 1 * u, { size: 22 * u * pulse, color: low ? '#ff7a5a' : '#fff', stroke: 'rgba(0,0,0,0.5)', tag: 'hud:time', group: 'hud:time' });
  }
}

function drawPopups() {
  const placed = [];
  for (const p of G.popups) {
    const a = Math.min(1, p.life / 0.4);
    const size = p.size * (p.life > p.max - 0.15 ? 1 + (p.life - (p.max - 0.15)) * 3 : 1);
    let y = Math.max(p.y, G.hudBottom + 20 * ui.u + size / 2);
    const w = ui.measure(p.text, size);
    const subS = 14 * ui.u;
    const h = size + (p.sub ? subS + 2 : 0);
    let x = clamp(p.x, w / 2 + 8, W_ - w / 2 - 8);
    // avoid other popups and the toast
    for (let tries = 0; tries < 8; tries++) {
      const hitR = placed.find((q) => Math.abs(q.x - x) < (q.w + w) / 2 + 4 && Math.abs(q.y - y) < (q.h + h) / 2 + 2);
      if (!hitR) break;
      y = hitR.y - (hitR.h + h) / 2 - 4;
    }
    p.y = Math.max(p.y, y);
    placed.push({ x, y, w, h });
    ui.text(p.text, x, y, { size, align: 'center', color: p.color, stroke: 'rgba(0,0,0,0.6)', alpha: a, tag: 'popup:' + p.text + placed.length, group: 'popup' + placed.length });
    if (p.sub) ui.text(p.sub, x, y + size / 2 + subS / 2 + 2, { size: subS, align: 'center', color: '#fff', stroke: 'rgba(0,0,0,0.6)', alpha: a, maxW: W_ - 16, tag: 'popupsub' + placed.length, group: 'popup' + placed.length });
  }
}

function drawToast() {
  const T = G.toast;
  if (!T) return;
  const u = ui.u;
  const age = G.t - T.t0;
  const a = Math.min(1, age * 5, T.life * 3);
  const size = 16 * u;
  const maxW = Math.min(W_ - 32 * u, 520 * u);
  const lines = wrapText(T.text, size, maxW - 28 * u);
  const h = lines.length * size * 1.3 + 18 * u;
  const w = Math.min(maxW, Math.max(...lines.map((l) => ui.measure(l, size))) + 28 * u);
  const x = W_ / 2 - w / 2, y = G.hudBottom + 10 * u;
  ctx.globalAlpha = a;
  ui.panel(x, y, w, h, { fill: 'rgba(20,14,10,0.8)', r: 12 * u, record: true, tag: 'toast', group: 'toast' });
  lines.forEach((l, i) => ui.text(l, W_ / 2, y + 9 * u + size * 1.3 * (i + 0.5), { size, align: 'center', color: '#fff', alpha: a, group: 'toast', tag: 'toast:' + i }));
  ctx.globalAlpha = 1;
  // popups must stay below the toast
  G.toastBottom = y + h;
}

function wrapText(text, size, maxW) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ui.measure(t, size) > maxW && cur) { lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawKeyHint() {
  if (G.level.id !== 1 || G.sim.savedLog.length > 0 || G.held.size) return;
  // animated hand showing the drag gesture on the inner ring
  const r = G.sim.rings[0];
  const c = toScreen(0, 0);
  const R = r.r * G.cam.k;
  const a = -Math.PI * 0.75 + Math.sin(G.t * 1.6) * 0.6;
  const x = c.x + Math.cos(a) * R, y = c.y + Math.sin(a) * R;
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 14 * ui.u, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(c.x, c.y, R, -Math.PI * 0.75 - 0.6, -Math.PI * 0.75 + 0.6);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// Centered card used by intro/pause/win/fail. Content is a vertical stack of blocks built for a
// scale s (pixels per design unit). The stack is measured first; if it is taller than the room
// below the HUD, everything is rebuilt at a smaller scale, so blocks can never overlap.
// build(s, w) returns [{ h, gap?, draw(x, y, w) }]; w is the card's inner width.
function stackCard(title, build) {
  const u = ui.u;
  const top = G.hudBottom + 10 * u;
  const avail = H_ - top - 10 * u;
  const measure = (s) => {
    const w = Math.min(W_ - 32 * u, 420 * s);
    const blocks = build(s, w - 48 * s);
    const h = 58 * s + blocks.reduce((a, b) => a + (b.gap ?? 10 * s) + b.h, 0) + 20 * s;
    return { s, w, blocks, h };
  };
  let m = measure(u);
  if (m.h > avail) m = measure(u * Math.max(0.55, avail / m.h));
  const { s, w, blocks } = m;
  const h = Math.min(m.h, avail);
  const x = W_ / 2 - w / 2;
  const y = Math.max(top, (H_ + G.hudBottom) / 2 - h / 2);
  ui.panel(x, y, w, h, { fill: 'rgba(32,22,14,0.92)', r: 22 * s, border: 'rgba(255,224,170,0.35)' });
  ui.text(title, W_ / 2, y + 32 * s, { size: 30 * s, align: 'center', maxW: w - 32 * s, color: '#ffe8b0', stroke: 'rgba(0,0,0,0.5)', tag: 'card:title' });
  let cy = y + 58 * s;
  for (const b of blocks) {
    cy += b.gap ?? 10 * s;
    b.draw(x + 24 * s, cy, w - 48 * s);
    cy += b.h;
  }
  return { x, y, w, h, s };
}

// one centered line of text as a stack block
const lineBlock = (str, size, o = {}) => ({
  h: size * 1.25, gap: o.gap,
  draw: (x, y, w) => ui.text(str, x + w / 2, y + size * 0.62, { size, align: 'center', maxW: w, ...o }),
});

function drawIntro() {
  dim(0.35);
  const L = G.level;
  stackCard(`Level ${L.id}`, (s, iw) => {
    const tip = wrapText(L.tip, 15 * s, iw).slice(0, 3);
    const B = [
      lineBlock(L.name, 20 * s, { color: '#fff', tag: 'intro:name', gap: 0 }),
      { h: 28 * s, draw: (x, y, w) => {
        for (let i = 0; i < L.eggs; i++) drawEggIcon(ctx, x + w / 2 + (i - (L.eggs - 1) / 2) * 30 * s, y + 14 * s, 26 * s, 'alive');
        ui.record({ x: x + w / 2 - L.eggs * 15 * s, y, w: L.eggs * 30 * s, h: 28 * s }, 'intro:eggs');
      } },
      lineBlock(`Save ${L.target} of ${L.eggs} eggs before the fuse burns out`, 15 * s, { color: '#ffe066', tag: 'intro:goal' }),
      ...tip.map((l, i) => lineBlock(l, 15 * s, { color: 'rgba(255,255,255,0.85)', tag: 'intro:tip' + i, gap: i ? 2 * s : 8 * s })),
      { h: 58 * s, gap: 16 * s, draw: (x, y, w) => ui.button('go', 'PLAY', x, y, w, 58 * s, { color: '#46b83d', dark: '#2a7a24', icon: ICON.play, size: 24 * s }) },
    ];
    if (!G.golden) B.push({ h: 48 * s, draw: (x, y, w) => ui.button('golden', 'Start with a golden shell', x, y, w, 48 * s, { color: '#d49a1c', dark: '#8a5f0a', ad: true, size: 15 * s }) });
    return B;
  });
}

function drawPause() {
  dim(0.55);
  stackCard('Paused', (s) => {
    const B = [
      { h: 56 * s, gap: 4 * s, draw: (x, y, w) => ui.button('resume', 'RESUME', x, y, w, 56 * s, { color: '#46b83d', dark: '#2a7a24', icon: ICON.play }) },
      { h: 48 * s, draw: (x, y, w) => ui.button('restart', 'Restart', x, y, w, 48 * s, { color: '#5a8dee', dark: '#2f5bb0', icon: ICON.retry, size: 18 * s }) },
      { h: 48 * s, draw: (x, y, w) => ui.button('levels', 'Levels', x, y, w, 48 * s, { color: '#5a8dee', dark: '#2f5bb0', icon: ICON.grid, size: 18 * s }) },
    ];
    if (portal.showMuteButton) B.push({ h: 46 * s, gap: 14 * s, draw: (x, y, w) => {
      const hw = (w - 12 * s) / 2;
      ui.button('sfx', 'Sound', x, y, hw, 46 * s, { color: save.sfx ? '#8a6a4a' : '#5a4a3a', dark: '#4a3420', icon: ICON.sound(save.sfx), size: 16 * s });
      ui.button('music', 'Music', x + hw + 12 * s, y, hw, 46 * s, { color: save.music ? '#8a6a4a' : '#5a4a3a', dark: '#4a3420', icon: ICON.note(save.music), size: 16 * s });
    } });
    return B;
  });
}

function drawWin() {
  dim(0.45);
  const r = G.result;
  stackCard(r.stars === 3 ? 'Perfect clutch!' : 'Vault cracked!', (s) => {
    const rows = [['Eggs saved', `${r.saved} / ${r.eggs}`], ['Egg points', String(r.eggScore)], ['Time bonus', '+' + r.timeBonus]];
    if (r.streakMult > 1) rows.push(['Star streak', 'x' + r.streakMult]);
    const B = [
      { h: 62 * s, gap: 0, draw: (x, y, w) => {
        for (let k = 0; k < 3; k++) {
          const pop = clamp((r.t - (0.25 + k * 0.3)) * 5, 0, 1);
          const sc = k < r.stars ? (pop < 1 ? pop * 1.25 : 1) : 1;
          drawStar(ctx, x + w / 2 + (k - 1) * 64 * s, y + 34 * s - (k === 1 ? 8 * s : 0), 26 * s, k < r.stars && pop > 0, k < r.stars ? Math.max(0.01, sc) : 1);
        }
        ui.record({ x: x + w / 2 - 96 * s, y, w: 192 * s, h: 62 * s }, 'win:stars');
      } },
      ...rows.map(([a, b], i) => ({ h: 20 * s, gap: i ? 4 * s : 10 * s, draw: (x, y, w) => {
        ui.text(a, x + 6 * s, y + 10 * s, { size: 16 * s, color: 'rgba(255,255,255,0.8)', tag: 'win:' + a, maxW: w / 2 - 6 * s });
        ui.text(b, x + w - 6 * s, y + 10 * s, { size: 16 * s, align: 'right', color: '#fff', tag: 'win:v' + a, maxW: w / 2 - 16 * s });
      } })),
      lineBlock(String(r.shownTotal), 38 * s, { color: '#ffe066', stroke: 'rgba(0,0,0,0.5)', tag: 'win:total', gap: 8 * s }),
    ];
    if (r.rewound) B.push(lineBlock('Rewind used: 3 stars locked', 12 * s, { color: 'rgba(255,255,255,0.6)', tag: 'win:rw', gap: 0 }));
    // buttons appear after the stars land, but their space is always reserved
    const ready = r.t > 1.2;
    const last = G.li === LEVELS.length - 1;
    B.push({ h: 56 * s, gap: 14 * s, draw: (x, y, w) => {
      if (!ready) return;
      ui.button('next', last ? 'ALL LEVELS' : 'NEXT', x, y, w * 0.62, 56 * s, { color: '#46b83d', dark: '#2a7a24', icon: ICON.next });
      ui.button('restart', '', x + w * 0.62 + 10 * s, y, w * 0.38 - 10 * s, 56 * s, { color: '#5a8dee', dark: '#2f5bb0', icon: ICON.retry });
    } });
    B.push({ h: 48 * s, draw: (x, y, w) => {
      if (!ready) return;
      if (!G.doubled) ui.button('double', 'Double this score', x, y, w, 48 * s, { color: '#d49a1c', dark: '#8a5f0a', ad: true, size: 16 * s });
      else ui.text('Score doubled!', x + w / 2, y + 24 * s, { size: 18 * s, align: 'center', color: '#ffe066', tag: 'win:doubled' });
    } });
    return B;
  });
}

function drawFail() {
  dim(0.5);
  const st = G.sim.stats();
  const timeout = G.sim.timeLeft <= 0;
  stackCard(timeout ? 'The fox is back!' : 'Too many eggs broke', (s) => {
    const B = [
      { h: 100 * s, gap: 0, draw: (x, y, w) => {
        drawFox(ctx, x + w / 2, y + 56 * s, 84 * s, 'smug', G.t);
        ui.record({ x: x + w / 2 - 42 * s, y, w: 84 * s, h: 100 * s }, 'fail:fox');
      } },
      lineBlock(`Saved ${st.saved}, needed ${st.target}`, 17 * s, { color: '#fff', tag: 'fail:stat' }),
    ];
    if (!G.usedRewind && G.sim.canRewind()) B.push({ h: 54 * s, gap: 14 * s, draw: (x, y, w) => ui.button('rewind', 'Rewind 5 s, keep streak', x, y, w, 54 * s, { color: '#d49a1c', dark: '#8a5f0a', ad: true, size: 16 * s }) });
    B.push({ h: 56 * s, gap: 12 * s, draw: (x, y, w) => ui.button('retry', 'RETRY', x, y, w, 56 * s, { color: '#46b83d', dark: '#2a7a24', icon: ICON.retry }) });
    B.push({ h: 46 * s, draw: (x, y, w) => ui.button('levels', 'Levels', x, y, w, 46 * s, { color: '#5a8dee', dark: '#2f5bb0', icon: ICON.grid, size: 17 * s }) });
    return B;
  });
}

function drawTitle() {
  dim(0.25);
  const u = ui.u;
  const cx = W_ / 2;
  const logoS = Math.min(64 * u, W_ / 7.5, H_ / 6);
  const ty = Math.max(16 * u + logoS / 2, Math.min(H_ * 0.2, 70 * u));
  ui.text('EGGSCAPE', cx, ty, { size: logoS, align: 'center', color: '#fff3d6', stroke: '#5a2e0e', strokeW: logoS * 0.2, tag: 'title:logo', maxW: W_ - 24 * u });
  const subY = ty + logoS * 0.5 + 16 * u;
  ui.text('Get the eggs out of the fox’s vault', cx, subY, { size: 17 * u, align: 'center', color: '#fff', stroke: 'rgba(0,0,0,0.6)', tag: 'title:sub', maxW: W_ - 32 * u });
  const bw = Math.min(300 * u, W_ - 48 * u);
  const by = Math.min(H_ - 140 * u, subY + 190 * u);
  ui.button('play', save.unlocked > 1 ? `PLAY  Level ${save.unlocked}` : 'PLAY', cx - bw / 2, by, bw, 64 * u, { color: '#46b83d', dark: '#2a7a24', icon: ICON.play, size: 24 * u });
  ui.button('levels', 'Levels', cx - bw / 2, by + 76 * u, bw, 50 * u, { color: '#5a8dee', dark: '#2f5bb0', icon: ICON.grid, size: 18 * u });
  // the fox takes whatever room is left: between subtitle and buttons, or beside the buttons
  const room = by - (subY + 12 * u) - 10 * u;
  if (room >= 60 * u) {
    const fs = Math.min(90 * u, room / 1.25);
    const fy = subY + 12 * u + (room - fs * 1.2) / 2 + fs * 0.67;
    drawFox(ctx, cx, fy, fs, 'smug', G.t);
    ui.record({ x: cx - fs / 2, y: fy - fs * 0.67, w: fs, h: fs * 1.19 }, 'title:fox');
  } else {
    const side = (W_ - bw) / 2 - 20 * u;
    const fs = Math.min(90 * u, side * 0.8, 126 * u / 1.2);
    if (fs >= 40 * u) {
      const fx = cx - bw / 2 - 12 * u - fs / 2, fy = by + 63 * u - fs * 0.52 + fs * 0.67;
      drawFox(ctx, fx, fy, fs, 'smug', G.t);
      ui.record({ x: fx - fs / 2, y: fy - fs * 0.67, w: fs, h: fs * 1.19 }, 'title:fox');
    }
  }
}

function drawLevels() {
  dim(0.6);
  const u = ui.u;
  const pad = 14 * u;
  const titleY = 34 * u;
  ui.button('back', '', pad, pad, 46 * u, 46 * u, { color: '#5a8dee', dark: '#2f5bb0', icon: ICON.rewind });
  ui.text('Levels', W_ / 2, titleY + 4 * u, { size: 28 * u, align: 'center', color: '#ffe8b0', stroke: 'rgba(0,0,0,0.5)', tag: 'levels:title' });
  const totalStars = Object.values(save.stars).reduce((a, b) => a + b, 0);
  const starTxt = `${totalStars} / ${LEVELS.length * 3}`;
  const stw = ui.measure(starTxt, 18 * u);
  drawStar(ctx, W_ - pad - stw - 16 * u, titleY + 4 * u, 11 * u, true);
  ui.record({ x: W_ - pad - stw - 28 * u, y: titleY - 8 * u, w: 24 * u, h: 24 * u }, 'levels:staricon', 'levels:stars');
  ui.text(starTxt, W_ - pad, titleY + 4 * u, { size: 18 * u, align: 'right', color: '#fff', tag: 'levels:stars', group: 'levels:stars' });
  const top = 78 * u;
  const cols = W_ > H_ ? 5 : 4;
  const rows = Math.ceil(LEVELS.length / cols);
  const gap = 10 * u;
  const cw = Math.min((W_ - pad * 2 - gap * (cols - 1)) / cols, 130 * u);
  const chh = Math.min((H_ - top - pad - gap * (rows - 1)) / rows, cw * 1.05);
  const gridW = cols * cw + (cols - 1) * gap;
  const x0 = W_ / 2 - gridW / 2;
  LEVELS.forEach((L, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const x = x0 + c * (cw + gap), y = top + r * (chh + gap);
    const th = THEMES.find((t) => t.id === L.theme) || THEMES[0];
    const open = i < save.unlocked;
    const col = open ? th.palette.accent || '#c98a3a' : '#4a4038';
    ui.button('lv:' + i, '', x, y, cw, chh, { color: col, dark: shade(col), disabled: !open });
    const num = String(L.id);
    ui.text(num, x + cw / 2, y + chh * 0.36, { size: Math.min(28 * u, chh * 0.34), align: 'center', color: open ? '#fff' : 'rgba(255,255,255,0.5)', stroke: 'rgba(0,0,0,0.4)', group: 'btn:lv:' + i, tag: 'lvnum' + i });
    if (open) {
      const s = save.stars[L.id] || 0;
      const sr = Math.min(8 * u, cw / 12);
      for (let k = 0; k < 3; k++) drawStar(ctx, x + cw / 2 + (k - 1) * sr * 2.6, y + chh * 0.72, sr, k < s);
    } else {
      // padlock
      const lx = x + cw / 2, ly = y + chh * 0.72, ls = Math.min(10 * u, cw / 10);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(lx - ls, ly - ls * 0.3, ls * 2, ls * 1.4);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = ls * 0.35;
      ctx.beginPath();
      ctx.arc(lx, ly - ls * 0.3, ls * 0.7, Math.PI, 0);
      ctx.stroke();
    }
  });
}

function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.floor(v * 0.6));
  return '#' + ((f(n >> 16) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).padStart(6, '0');
}

// ---------------------------------------------------------------- loop
let last = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  if (!G.paused) {
    update(dt);
    render();
  }
  requestAnimationFrame(frame);
}

// Audio is silenced while any reason holds (an ad or system pause, a hidden tab); it comes back
// only when every reason has let go, so showing the tab mid-ad keeps the ad silent.
const audioHolds = new Set();
function audioHold(why, on) {
  const before = audioHolds.size;
  if (on) audioHolds.add(why); else audioHolds.delete(why);
  if (!before && audioHolds.size) audio.pauseAll();
  else if (before && !audioHolds.size) audio.resumeAll();
}

// keys held while focus leaves the window never get their keyup
function clearKeys() {
  for (const k in G.keys) if (k !== '__kb') G.keys[k] = false;
  releaseAll();
}

// ---------------------------------------------------------------- boot
async function boot() {
  resize();
  window.addEventListener('resize', resize);
  canvas.addEventListener('pointerdown', pointerDown, { passive: false });
  window.addEventListener('pointermove', pointerMove);
  window.addEventListener('pointerup', pointerUp);
  window.addEventListener('pointercancel', pointerUp);
  window.addEventListener('keydown', (e) => { G.keys.__kb = true; keyDown(e); });
  window.addEventListener('keyup', keyUp);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearKeys(); if (G.screen === 'play') press('pause'); }
    audioHold('hidden', document.hidden);
  });
  window.addEventListener('blur', clearKeys);
  portal.onPause(() => { G.paused = true; clearKeys(); audioHold('portal', true); });
  portal.onResume(() => { G.paused = false; last = performance.now(); audioHold('portal', false); });
  portal.onAudioChange(() => applyAudioSettings());

  portal.loadingStart();
  try {
    const face = new FontFace('Fredoka', `url(${fontUrl})`, { weight: '600' });
    document.fonts.add(await face.load());
  } catch (_) { /* fallback fonts are fine */ }
  await portal.init();
  try {
    const raw = await portal.loadSave();
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.v === SAVE_VER) save = { ...defaultSave(), ...s };
    }
  } catch (_) { save = defaultSave(); }
  applyAudioSettings();
  // title runs over the live first level
  startLevel(Math.min(LEVELS.length - 1, save.unlocked - 1));
  setScreen('title');
  const ld = document.getElementById('loading');
  if (ld) ld.remove();
  portal.loadingDone();
  last = performance.now();
  requestAnimationFrame(frame);
}

// test hook (used by the QA bot and screenshot tools); compiled out of release builds
if (DEV) window.__egg = {
  G, LEVELS,
  get sim() { return G.sim; },
  start: (i, o) => startLevel(i, o),
  press,
  step(seconds) { const n = Math.round(seconds / DT); for (let i = 0; i < n; i++) G.sim.step(); handleEvents(); },
  frame(dt = 1 / 60) { update(dt); render(); },
  overlaps: () => G.overlaps,
  setSave(s) { save = { ...defaultSave(), ...s }; },
  get save() { return save; },
  // QA only: jump straight to an end screen with a plausible result
  showResult(kind, stars = 3) {
    if (kind === 'win') G.result = { stars, saved: 3, eggs: 3, eggScore: 4200, timeBonus: 380, streak: stars === 3 ? 3 : 0, streakMult: stars === 3 ? 1.5 : 1, total: 6870, shownTotal: 6870, t: 9, target: 2, perfect: stars === 3, rewound: false };
    else G.sim.state = 'failed';
    setScreen(kind);
  },
};

boot();
