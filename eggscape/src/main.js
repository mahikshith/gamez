// Eggscape: game shell. Screens, input, camera, events -> VFX/SFX/score, HUD.
import { Sim, DT, LEGACY_ORB } from './sim/sim.js';
import { hintSearch, actSteps } from './sim/search.js';
import { RING_TH, clamp, lerp } from './sim/geom.js';
import { LEVELS } from './data/levels.js';
import { DAILY } from './data/daily.js';
import { THEMES, createBackdrop } from './themes.js';
import { audio } from './audio.js';
import { portal } from './sdk/portal.js';
import { FX } from './render/fx.js';
import * as W from './render/world.js';
import { UI, FONT, ICON, drawStar, drawEggIcon } from './ui/ui.js';
import { drawSnake } from './render/characters.js';
import { POWER_INFO, drawOrb, drawPowerCard } from './render/powers.js';
import { drawSprite, drawBossCard, drawFoxActor, drawHenActor, setSpriteCalm } from './render/sprites.js';
import { createWeather } from './render/weather.js';
import * as E from './economy.js';
import { drawStore, drawCoin, drawBoosterPicker, drawChest } from './ui/store.js';
import fontUrl from '../assets/fonts/fredoka-600-latin.woff2';
import { botTick } from './dev/bot.js';

const DEV = typeof __DEV__ !== 'undefined' ? __DEV__ : true;
// playtest build (build.mjs --test): every level, booster and skin unlocked, plenty of coins
const TEST = typeof __TEST__ !== 'undefined' && __TEST__;

// ---------------------------------------------------------------- save
const SAVE_VER = 3; // v3: 35 new levels, progress resets; settings, wallet and discoveries carry over
// mode: difficulty (F32); stars/best are kept per mode (Medium uses the v1 keys); calm = reduced motion
const defaultSave = () => ({ v: SAVE_VER, unlocked: 1, stars: {}, best: {}, streak: 0, sfx: true, music: true, seen: {}, mode: 'medium', calm: false, intro: {}, bonus: {}, wallet: E.defaultWallet(), adClaim: 0, daily: { day: '', best: 0, paid: '' } });
let save = defaultSave();
const MODE_LIST = ['easy', 'medium', 'hard'];
const sk = (id, mode = save.mode) => (mode === 'medium' ? String(id) : mode[0] + id);
const starsOf = (id) => save.stars[sk(id)] || 0;
// star gates (I5): environment k (0-based) opens at GATE * k stars, counting each level's best over all modes
const GATE = 7, PER_ENV = 5;
const bestStarsOf = (id) => Math.max(0, ...MODE_LIST.map((m) => save.stars[sk(id, m)] || 0));
const bestTotal = () => LEVELS.reduce((a, L) => a + bestStarsOf(L.id), 0);
const envOf = (i) => Math.floor(i / PER_ENV);
const envNeed = (k) => (TEST ? 0 : GATE * k);
const envOpen = (k) => bestTotal() >= envNeed(k);
const playable = (i) => i >= 0 && i < save.unlocked && envOpen(envOf(i));
function loadSave(s) {
  save = { ...defaultSave(), ...s };
  save.wallet = E.sanitizeWallet(save.wallet);
  if (!MODE_LIST.includes(save.mode)) save.mode = 'medium';
  for (const [o, n] of Object.entries(LEGACY_ORB)) if (save.seen[o]) save.seen[n] = 1; // v1 discoveries
}
// visual-only weather per theme; levels with a physics `weather` field use that instead
const THEME_WEATHER = { farm: 'leaves', orchard: 'leaves', bramble: 'leaves', mushroom: 'fireflies', frozen: 'snow', blizzard: 'snow', dunes: 'sandstorm', haunted: 'ghosts', dragon: 'ash' };
// seven environments of five (v3)
const WORLDS = ['The Farm', 'Wild Woods', 'Frozen Lake', 'Crystal Caves', 'Volcano', 'Storm Peaks', 'The Fox\u2019s Fortress'];
const BONUS_TEXT = (b, fuse = 1) => ({ turns: `${b.n} turns or fewer`, prize: 'Save the speckled egg', orbs: 'Collect every orb', time: `Finish within ${Math.round(b.s * fuse)} s` })[b.kind] || '';
const BONUS_COINS = 15;
const AD_BOOST = ['golden', 'time', 'stone', 'sponge']; // the intro card's free booster, by level
// Daily Vault (C7): one pre-validated layout per day, the same for everyone; level index -1
const DAILY_COINS = 40;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function dailyLevel() {
  const d = new Date();
  return DAILY[Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5) % DAILY.length];
}
const dailyBest = () => (save.daily.day === today() ? save.daily.best : 0);
const powerInfo = (id) => POWER_INFO[id] || { name: id, line: '', color: '#fff' };
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
  if (G.weather) G.weather.resize(W_, H_, DPR);
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
  zm: null, // player zoom (null = auto)
  tp: new Map(), // touch pointers in play: pointerId -> { x, y }
  pinch: null,
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
  weather: null,
  slow: null, // { left, scale }: slow motion (power cards, last egg)
  card: null, // { id, t, dur }: power popup card
  hint: null, // { gen, out, cpu } while searching; hintShow = { ring, dir, t } after
  hintShow: null,
  boostSel: new Set(),
  boostLast: null,
  storeFrom: 'title',
  storeTab: 'boosters',
  storeFlash: null,
  world: 0,
  hen: { mood: 'idle', t: 0 },
  pointer: { x: 0, y: 0 },
};

function themeFor(level) {
  return THEMES.find((t) => t.id === level.theme) || THEMES[(level.id - 1) % THEMES.length];
}

function startLevel(i, opts = {}) {
  // leaving a level that was not won (quit, or gave up after a fail) ends the star streak
  if (G.sim && !G.result && G.sim.t > 1 && save.streak) { save.streak = 0; persist(); }
  G.run = (G.run || 0) + 1;
  G.li = i;
  G.level = i < 0 ? dailyLevel() : LEVELS[i];
  G.theme = themeFor(G.level);
  G.boost = opts.boost || {};
  G.sim = new Sim(G.level, { golden: !!opts.golden, mode: save.mode, ...G.boost });
  G.golden = !!opts.golden;
  G.adBoost = opts.adBoost || null;
  G.freeRewind = !!G.boost.rewind;
  G.backdrop = createBackdrop(G.theme, G.level.id * 97);
  G.backdrop.resize(W_, H_, DPR);
  G.weather = createWeather(G.level.weather || THEME_WEATHER[G.theme.id] || 'none', G.level.id * 31);
  G.weather.resize(W_, H_, DPR);
  W.setSkin(save.wallet.skin);
  G.slow = G.card = G.hint = G.hintShow = null;
  G.lastEgg = false;
  G.snakeToast = false;
  G.predToast = {}; // predators (v3): first-time toasts
  G.danger = 0;
  G.onewayTip = false; // v3
  G.hen = { mood: 'idle', t: 0 };
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
  G.zm = null;
  G.pinch = null;
  G.tp.clear();
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
  // zoom buttons get their own strip (right column in landscape, bottom row in portrait) so they never sit on rings
  const bs = Math.max(40, 48 * u), pad = 8 * u, side = W_ > H_;
  G.zb = { bs, pad, side };
  const sw = side ? bs + 2 * pad : 0, sh = side ? 0 : bs + pad + 2 * u;
  G.play = { x: 0, y: top, w: W_ - sw, h: H_ - top - 6 * u - sh };
}

// Frame the vault. all: whole vault plus ground and nest. Else the ring the eggs are in plus two more outward.
function frameOf(all, maxCh) {
  const sim = G.sim, n = sim.rings.length;
  let R, yMin, yMax;
  if (all) {
    R = sim.outerR + 0.45;
    yMin = sim.groundY - 0.25;
    yMax = R;
  } else {
    const ring = sim.rings[Math.min(n - 1, Math.max(3, maxCh + 2))];
    R = ring.r + RING_TH + 0.5;
    yMin = -R + 0.3; // height-limited screens crop a little margin, never a ring
    yMax = R - 0.3;
  }
  // predators (v3): every snake in (or about to enter) the vault is framed, like the furthest egg; so is
  // the eagle while it attacks, and the fox's head over the top
  const hds = [];
  for (const S of sim.snakes || []) if (!S.gone && S.inside && S.rad <= sim.outerR + 1.5) hds.push({ x: S.rad * Math.cos(S.a), y: S.rad * Math.sin(S.a) });
  const EA = sim.eagle;
  if (EA && (EA.phase === 'warn' || EA.phase === 'dive')) hds.push({ x: EA.x, y: EA.y });
  if (sim.fox) hds.push({ x: sim.fox.x, y: sim.outerR + 0.6 });
  for (const hd of hds) {
    if (all) { R = Math.max(R, Math.abs(hd.x) + 0.6); yMin = Math.min(yMin, hd.y - 0.6); yMax = Math.max(yMax, hd.y + 0.6); }
    else { R = Math.max(R, Math.hypot(hd.x, hd.y) + 0.6); yMin = -R; yMax = R; }
  }
  const P = G.play;
  const k = Math.min(P.w / (2 * R), P.h / (yMax - yMin), 190);
  return { x: 0, y: (yMin + yMax) / 2, k, R, yMin, yMax };
}

function camTarget() {
  const sim = G.sim;
  if (!sim) return { x: 0, y: 0, k: 60 };
  const n = sim.rings.length, eggs = sim.aliveEggs();
  let maxCh = 0;
  for (const e of eggs) maxCh = Math.max(maxCh, sim.channelOf(e));
  const live = G.screen === 'play' && sim.state === 'play';
  const A = frameOf(!live || maxCh >= n - 1 || (sim.nestAmp && maxCh >= n - 2) || n <= 2, maxCh);
  const z = G.zm;
  if (z == null || !live) return A;
  const F = frameOf(true, maxCh);
  if (z < 0) { // out: slide to the whole vault (k in log steps)
    const t = -z;
    return { x: lerp(A.x, F.x, t), y: lerp(A.y, F.y, t), k: A.k * Math.pow(Math.min(1, F.k / A.k), t) };
  }
  // in: up to 2x the auto level, following the eggs' centre inside the vault frame
  const k = A.k * Math.pow(2, z), P = G.play;
  let cx = A.x, cy = A.y;
  if (eggs.length) {
    cx = cy = 0;
    for (const e of eggs) { const p = e.body.getPosition(); cx += p.x; cy += p.y; }
    cx = lerp(A.x, cx / eggs.length, Math.min(1, z * 2));
    cy = lerp(A.y, cy / eggs.length, Math.min(1, z * 2));
  }
  const hw = P.w / (2 * k), hh = P.h / (2 * k), mx = Math.max(0, F.R - hw);
  return { x: clamp(cx, -mx, mx), y: F.yMax - F.yMin > 2 * hh ? clamp(cy, F.yMin + hh, F.yMax - hh) : (F.yMin + F.yMax) / 2, k };
}

// player zoom z: -1 whole vault, 0 auto (null), +1 twice auto
function setZoom(z) {
  z = clamp(z, -1, 1);
  G.zm = Math.abs(z) < 0.05 ? null : z;
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
  if (e.pointerType === 'touch') {
    // a second finger means pinch-zoom: let go of any ring and turn nothing until the fingers lift
    G.tp.set(e.pointerId, { x, y });
    if (G.tp.size > 1) {
      for (const h of G.held.values()) h.ring.held = false;
      G.held.clear();
      if (!G.pinch) { const [a, b] = [...G.tp.values()]; G.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: G.zm || 0 }; }
      return;
    }
  }
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
  if (G.hintShow && G.hintShow.ring === ring.i) G.hintShow = null;
  ring.held = true;
  ring.target = ring.body.getAngle();
  G.keySel = ring.i;
  audio.play('grab', { vol: 0.6 });
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
}

function pointerMove(e) {
  const x = e.clientX, y = e.clientY;
  G.pointer = { x, y };
  const tp = G.tp.get(e.pointerId);
  if (tp) {
    tp.x = x; tp.y = y;
    if (G.pinch) {
      const [a, b] = [...G.tp.values()];
      setZoom(G.pinch.z + Math.log2(Math.hypot(a.x - b.x, a.y - b.y) / G.pinch.d));
      return;
    }
  }
  const h = G.held.get(e.pointerId);
  if (h) {
    const c = toScreen(0, 0);
    const px = h.x - c.x, py = h.y - c.y;
    const dx = x - h.x, dy = y - h.y;
    const rr = Math.max(Math.hypot(px, py), 90 * ui.u);
    // screen y is down, world angle is counter-clockwise
    const dTheta = -(px * dy - py * dx) / (rr * rr);
    h.ring.target += dTheta;
    onewayDrag(h, dTheta);
    h.x = x;
    h.y = y;
  } else if (e.pointerType === 'mouse' && G.screen === 'play' && G.sim) {
    const w = toWorld(x, y);
    G.hover = G.sim.ringAt(Math.hypot(w.x, w.y));
  }
}

function pointerUp(e) {
  G.tp.delete(e.pointerId);
  if (G.tp.size < 2) G.pinch = null;
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

function wheel(e) {
  if (G.screen !== 'play' || !G.sim || G.sim.state !== 'play') return;
  e.preventDefault();
  setZoom((G.zm || 0) - clamp(e.deltaY, -120, 120) * 0.003);
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
    if (/^[1-7]$/.test(k)) G.keySel = Math.min(G.sim.rings.length - 1, +k - 1);
  } else if ((k === 'Enter' || k === ' ') && !e.repeat) {
    if (G.screen === 'win' && !(G.result && G.result.t > 1.2)) return;
    const primary = { title: 'play', intro: G.level.intro && !save.intro[G.level.id] ? 'gotit' : 'go', win: 'next', fail: 'retry', pause: 'resume' }[G.screen];
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
    if (ring.oneway && dir !== ring.oneway) { onewayDrag(ring, -1); return; }
    if (!ring.held) ring.target = ring.body.getAngle();
    ring.target += dir * G.sim.maxOmega(ring) * dt * 1.1;
    ring.keyHeld = true;
  } else ring.keyHeld = false;
}

// ---------------------------------------------------------------- buttons
async function press(id) {
  audio.play(id === 'pause' || id === 'levels' ? 'ui_back' : 'ui_tap');
  switch (id) {
    case 'zoom:in': setZoom((G.zm || 0) + 0.34); break;
    case 'zoom:out': setZoom((G.zm || 0) - 0.34); break;
    case 'zoom:auto': G.zm = null; break;
    case 'play': {
      const i = Math.min(LEVELS.length - 1, save.unlocked - 1);
      if (!playable(i)) { G.world = envOf(i); setScreen('levels'); break; } // a star gate: show it on the map
      await breakThen(() => startLevel(i));
      break;
    }
    case 'levels':
      portal.gameplayStop();
      G.world = clamp(envOf(save.unlocked - 1), 0, Math.ceil(LEVELS.length / PER_ENV) - 1);
      setScreen('levels');
      break;
    case 'go': {
      // owned boosters picked on the intro card are spent now and the level restarts with them
      const boost = { ...G.boost }; // keeps a booster the intro ad already gave
      let picked = 0;
      for (const b of G.boostSel) {
        if (b === 'golden' && G.golden) continue; // the golden-shell ad already gave one
        const w = E.useBooster(save.wallet, b);
        if (w) { save.wallet = w; boost[b] = true; picked++; }
      }
      G.boostSel.clear();
      if (picked) {
        persist();
        startLevel(G.li, { direct: true, golden: G.golden || boost.golden, boost, adBoost: G.adBoost });
        break;
      }
      setScreen('play');
      portal.gameplayStart();
      toast(G.level.tip, 3.4);
      break;
    }
    case 'daily':
      await breakThen(() => startLevel(-1));
      break;
    case 'gotit':
      save.intro[G.level.id] = 1;
      persist();
      break;
    case 'shop':
    case 'store':
      G.storeFrom = G.screen;
      G.storeFlash = null;
      setScreen('store');
      break;
    case 'tab:boosters':
    case 'tab:skins':
      G.storeTab = id.slice(4);
      break;
    case 'ad:coins': {
      if (E.adCooldownLeft(save.adClaim, Date.now()) > 0) break;
      const ok = await rewarded('coins');
      if (ok) {
        save.wallet = E.addCoins(save.wallet, E.AD_REWARDS.freeCoins.coins);
        save.adClaim = Date.now();
        G.storeFlash = { id: 'ad', t0: G.t };
        persist();
        audio.play('combo', { intensity: 0.5 });
      }
      break;
    }
    case 'calm':
      save.calm = !save.calm;
      persist();
      break;
    case 'hint': {
      const ok = await rewarded('hint');
      if (ok && G.sim && G.sim.state === 'play') {
        const out = {};
        G.hint = { out, gen: hintSearch(Sim, G.level, G.sim.fullState(), { mode: G.sim.mode, ...G.boost }, out) };
      }
      break;
    }
    case 'chest': {
      const total = bestTotal();
      const w = E.openChest(save.wallet, E.chestFor(total, save.wallet.chests));
      if (w) { save.wallet = w; persist(); audio.play('level_win'); toast('Chest opened! Coins and a booster.', 2.4); }
      break;
    }
    case 'adboost': {
      // pre-level card (G24): a completed rewarded ad gives one free booster for this run, a different one per level
      const b = AD_BOOST[Math.abs(G.level.id) % AD_BOOST.length];
      const ok = await rewarded('booster');
      if (ok) {
        if (b === 'golden') startLevel(G.li, { golden: true, adBoost: b });
        else startLevel(G.li, { boost: { [b]: true }, adBoost: b });
        toast(`Free booster: ${E.BOOSTERS[b].name}. ${E.BOOSTERS[b].line}`, 3.4);
      }
      break;
    }
    case 'pause':
      // once the level is decided the end card is coming: pausing then would strand the player
      if (G.screen === 'play' && G.sim.state === 'play') { setScreen('pause'); portal.gameplayStop(); releaseAll(); }
      else if (G.screen === 'intro') setScreen('levels');
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
      if (G.li < 0) { setScreen('title'); break; }
      if (G.li === LEVELS.length - 1) { setScreen('levels'); break; }
      if (!playable(n)) { G.world = envOf(n); setScreen('levels'); break; } // the next environment waits behind its star gate
      await breakThen(() => startLevel(n));
      break;
    }
    case 'rewind': {
      // a Free rewind booster pays for it; otherwise it is a rewarded ad
      const free = G.freeRewind;
      const ok = free || await rewarded('rewind');
      if (free) G.freeRewind = false;
      const back = ok && G.sim.rewind(5);
      if (back) {
        releaseAll();
        stopFuse();
        G.sim = back;
        G.run = (G.run || 0) + 1;
        G.usedRewind = true;
        G.lastEgg = false;
        G.hint = G.hintShow = G.card = G.slow = null;
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
        save.wallet = E.addCoins(save.wallet, G.result.coins);
        G.result.coins *= 2;
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
      setScreen(G.screen === 'store' ? G.storeFrom || 'title' : 'title');
      break;
    default:
      if (id && id.startsWith('lv:')) {
        const i = +id.slice(3);
        if (playable(i)) await breakThen(() => startLevel(i));
      } else if (id && id.startsWith('mode:')) {
        save.mode = id.slice(5);
        persist();
      } else if (id && id.startsWith('world:')) {
        G.world = clamp(G.world + +id.slice(6), 0, Math.ceil(LEVELS.length / PER_ENV) - 1);
      } else if (id && id.startsWith('boost:')) {
        const b = id.slice(6);
        if (G.boostSel.has(b)) G.boostSel.delete(b); else G.boostSel.add(b);
        G.boostLast = b;
      } else if (id && id.startsWith('buy:')) {
        const w = E.buy(save.wallet, id.slice(4));
        if (w) { save.wallet = w; persist(); G.storeFlash = { id: id.slice(4), t0: G.t }; audio.play('unlock'); }
      } else if (id && id.startsWith('skin:')) {
        const k = id.slice(5);
        const w = E.ownsSkin(save.wallet, k) ? E.equipSkin(save.wallet, k) : E.buySkin(save.wallet, k);
        if (w) { save.wallet = w; persist(); W.setSkin(w.skin); G.storeFlash = { id, t0: G.t }; audio.play('unlock'); }
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

// ---------------------------------------------------------------- v3 physics: events, input, tint
let v3Fall = 0; // rings of the fall that the next crack event explains
const V3_SOFT = { sponge: 'Soft landing', water: 'Splash! Soft landing', stone: 'Stone: no crack', feather: 'Guarded!', bubble: 'Soft landing' };
function v3Event(ev, fx) {
  switch (ev.type) {
    case 'fallWarn':
      popup(ev.x, ev.y + 0.45, '!', { color: '#ffb347', size: 24, life: 0.6 });
      break;
    case 'fallLand':
      v3Fall = ev.rings;
      fx.wave(ev.x, ev.y, 0.8 + 0.2 * ev.dmg, '#ffb27a', 0.4, 0.1);
      fx.shake = Math.max(fx.shake, 0.25 + 0.12 * ev.dmg);
      audio.play('rock_hit', { vol: 0.6 + 0.2 * ev.dmg });
      break;
    case 'softLand':
      if (!V3_SOFT[ev.why]) break;
      popup(ev.x, ev.y + 0.5, V3_SOFT[ev.why], { color: '#9dff9d', size: 16, life: 0.9 });
      if (ev.why === 'water') { audio.play('splash', { vol: 0.6 }); fx.dust(ev.x, ev.y - 0.2, 6, 'rgba(140,200,255,0.8)'); }
      break;
    case 'smash':
      audio.play('rock_hit');
      fx.chips(ev.x, ev.y, '#aab2bd', 8, 2.5);
      popup(ev.x, ev.y + 0.5, 'Smash!', { color: '#e6e6e6', size: 20, life: 0.9 });
      break;
    case 'curtainBurn':
      audio.play('fire_ignite');
      fx.smoke(ev.x, ev.y, 4);
      break;
    case 'curtainGone':
      audio.play('fire_burn');
      fx.smoke(ev.x, ev.y, 7);
      fx.chips(ev.x, ev.y, '#ff8a3a', 10, 2.5);
      popup(ev.x, ev.y + 0.5, 'Burnt away!', { color: '#ffb347', size: 20 });
      break;
    case 'powerOn': {
      const col = powerInfo(ev.power).color;
      for (const e of G.sim.aliveEggs()) { const p = e.body.getPosition(); fx.sparkle(p.x, p.y, 8, col); }
      if (!save.calm) { fx.flash = 0.3; fx.flashColor = col; }
      if (ev.power === 'foxcurse') hen('gasp', 1.4);
      break;
    }
    case 'powerOff':
      audio.play('release', { vol: 0.6 });
      break;
    case 'lavaWarn':
      audio.play('fire_ignite', { pitch: 0.6, vol: 0.5 });
      break;
    case 'lavaLand':
      audio.play('rock_hit');
      audio.play('lava_sizzle', { vol: 0.7 });
      fx.chips(ev.x, ev.y, '#ff9a3a', 10, 3);
      fx.smoke(ev.x, ev.y, 4);
      fx.shake = Math.max(fx.shake, 0.35);
      break;
    case 'lavaMelt':
      audio.play('lava_sizzle');
      fx.smoke(ev.x, ev.y, 6);
      popup(ev.x, ev.y + 0.5, 'Melted!', { color: '#ffb347', size: 18, life: 0.9 });
      break;
    case 'lavaBlast':
      audio.play('bomb_explode', { vol: 0.4 });
      fx.chips(ev.x, ev.y, '#ffb347', 8, 3);
      break;
    case 'lavaCool':
      audio.play('lava_sizzle');
      audio.play('splash', { vol: 0.5 });
      fx.smoke(ev.x, ev.y, 8, 'rgba(230,240,255,0.7)');
      popup(ev.x, ev.y + 0.5, 'Cooled!', { color: '#8fd0ff', size: 20 });
      break;
    case 'iceWarn':
      audio.play('glass_crack', { vol: 0.3, pitch: 1.6 });
      break;
    case 'icicleHit':
      audio.play('glass_break', { vol: 0.7 });
      fx.chips(ev.x, ev.y, '#d9f3ff', 10, 2.5);
      break;
    case 'icicleShatter':
      audio.play('glass_crack', { vol: 0.5 });
      fx.chips(ev.x, ev.y, '#d9f3ff', 7, 2);
      break;
  }
}

// one-way rings (G22): dragging the wrong way does nothing; past a small amount, shake and tick
function onewayDrag(h, dTheta) {
  const ring = h.ring || h;
  if (!ring.oneway || dTheta * ring.oneway >= 0) { h.wrong = 0; return; }
  h.wrong = (h.wrong || 0) + Math.abs(dTheta);
  if (h.wrong < 0.12 && h.ring) return;
  h.wrong = 0;
  if (ring.denied > 0.1) return;
  ring.denied = 0.35;
  audio.play('motor_tick', { vol: 0.8 });
  if (!G.onewayTip) { G.onewayTip = true; toast('This ring only turns one way: follow the arrows.', 2.6); }
}

// hourglass (cool) and fox curse (hot) tint the edges of the screen while they last
function drawV3Tint(sim) {
  const col = sim.slowT > 0 ? '120,180,255' : sim.curseT > 0 ? '255,120,30' : null;
  if (!col) return;
  const left = sim.slowT > 0 ? sim.slowT : sim.curseT, a = 0.42 * Math.min(1, left / 0.6);
  const g = ctx.createRadialGradient(W_ / 2, H_ / 2, Math.min(W_, H_) * 0.35, W_ / 2, H_ / 2, Math.max(W_, H_) * 0.75);
  g.addColorStop(0, `rgba(${col},0)`);
  g.addColorStop(1, `rgba(${col},${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W_, H_);
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
        fx.chips(ev.x, ev.y, '#f3e8d2', 9, 2.4);
        fx.shake = Math.max(fx.shake, 0.25);
        hen('gasp', 1.2);
        try { if (navigator.vibrate) navigator.vibrate(30); } catch (_) {}
        if (ev.why === 'spike') audio.play('rock_hit', { vol: 0.6 });
        // v3: crack stage pop (G34), so every crack is explained
        popup(ev.x, ev.y + 0.55, `Crack ${ev.n || ev.egg.cracks}/3`, { sub: ev.why === 'fall' && v3Fall ? `fell ${v3Fall} rings` : '', color: (ev.n || 1) >= 2 ? '#ff7a6a' : '#ffc24a', size: 18, life: 1.1 });
        break;
      case 'break': {
        audio.play(ev.why === 'lava' ? 'lava_sizzle' : 'egg_break');
        if (ev.why === 'thorn') audio.play('thorn_hit');
        if (ev.why === 'eagle') { /* carried off whole: no yolk */ }
        else if (ev.why === 'lava') { fx.smoke(ev.x, ev.y, 8, 'rgba(70,60,60,0.6)'); fx.chips(ev.x, ev.y, '#ffb347', 10, 3); }
        else fx.yolk(ev.x, ev.y, sim.groundY + 0.02);
        fx.shake = Math.max(fx.shake, 0.55);
        G.hitstop = 0.07;
        hen('cry', 2.2);
        const why = { thorn: 'Thorn!', fox: 'The fox took it', ground: 'Missed the nest', lava: 'Into the lava', impact: 'Smashed!', lost: 'Lost', snake: 'The snake got it!', eagle: 'The eagle took it!', spike: 'Spiked!', ember: 'Burnt!', lightning: 'Zapped!', zap: 'Zapped!', thornball: 'Thorn ball!', blast: 'Blasted!', fall: 'Fell too far!', curtain: 'Thorn curtain!', lavarock: 'Lava rock!', icicle: 'Icicle!' }[ev.why] || '';
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
        hen('happy', 1.6);
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
        // discovery (F19/C11): the first touch reveals the orb and is remembered
        const snd = { fire_red: 'fire_ignite', fire_black: 'fire_ignite', fire_green: 'unlock', fire_gold: 'twin_hatch', stone: 'steel_on', bubble: 'bubble_on', water: 'splash', thunder: 'thunder', thorn: 'thorn_hit', twin: 'twin_hatch', magnet: 'unlock', hourglass: 'rewind', feather: 'unlock', rockskin: 'steel_on', foxcurse: 'thorn_hit' }[ev.power];
        audio.play(snd || 'unlock');
        fx.sparkle(ev.x, ev.y, 12, powerInfo(ev.power).color);
        const first = !save.seen[ev.power];
        if (first) { save.seen[ev.power] = 1; persist(); }
        G.card = { id: ev.power, t: 0, dur: first ? 1.6 : 0.9 };
        G.slow = { left: first ? 1.2 : 0.5, scale: 0.25 };
        break;
      }
      case 'orbSpawn':
        audio.play('portal_exit', { vol: 0.5 });
        fx.sparkle(ev.x, ev.y, 8, powerInfo(ev.power).color);
        break;
      case 'meteor':
        audio.play('fire_ignite', { pitch: 0.7 });
        popup(ev.x, ev.y + 0.5, 'METEOR!', { sub: 'too far: it will crack', color: '#ff9a5a', size: 26, life: 1.4 });
        break;
      case 'meteorLand':
        fx.wave(ev.x, ev.y, 1.1, '#ffb27a', 0.45, 0.12);
        fx.shake = Math.max(fx.shake, 0.5);
        audio.play('rock_hit');
        break;
      case 'mend':
        fx.sparkle(ev.x, ev.y, 14, '#8dff8a');
        popup(ev.x, ev.y + 0.5, ev.n > 1 ? 'All mended!' : 'Mended!', { color: '#8dff8a', size: 22 });
        break;
      case 'hatch':
        fx.sparkle(ev.x, ev.y, 16, '#ffe14d');
        popup(ev.x, ev.y + 0.5, 'Chick!', { color: '#ffe14d', size: 24 });
        hen('happy', 1.2);
        break;
      case 'zap':
        audio.play('thunder', { vol: 0.5 });
        fx.sparkle(ev.x, ev.y, 10, '#bfe6ff');
        break;
      case 'honey':
        audio.play('squish', { intensity: 0.4 });
        break;
      case 'stoneHit':
        audio.play('rock_hit', { vol: 0.7 });
        break;
      case 'lightning': {
        audio.play('thunder');
        const sp = toScreen(ev.x, ev.y);
        G.weather.trigger('lightning', { sx: sp.x, sy: sp.y });
        fx.flash = 0.5;
        fx.flashColor = '#e8f4ff';
        fx.shake = Math.max(fx.shake, 0.4);
        fx.chips(ev.x, ev.y, '#dff3ff', 10, 3);
        break;
      }
      case 'quake':
        G.weather.trigger('quake', { strength: 1 });
        audio.play('rock_hit');
        fx.shake = Math.max(fx.shake, 0.7);
        break;
      case 'emberHit': {
        audio.play('lava_sizzle', { vol: 0.7 });
        fx.smoke(ev.x, ev.y, 4);
        const sp = toScreen(ev.x, ev.y);
        G.weather.trigger('ember_burst', { sx: sp.x, sy: sp.y });
        break;
      }
      case 'emberFizz':
        fx.smoke(ev.x, ev.y, 2, 'rgba(90,80,80,0.4)');
        break;
      case 'snakeIn':
        if (!G.snakeToast) { G.snakeToast = true; toast('A snake! Turn the rings so no gap lines up for it.', 3); }
        break;
      case 'snakeRecoil':
        popup(ev.x, ev.y + 0.5, 'Too hard to bite!', { size: 18 });
        audio.play('steel_clang', { vol: 0.6 });
        break;
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
      case 'stoneOff':
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
      default:
        v3Event(ev, fx);
        predEvent(ev, fx); // predators (v3)
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

// ---------------------------------------------------------------- predators (v3)
// events -> SFX/VFX for snakes, barriers, the eagle, the fox thrower and the chick (reuses existing sounds)
function predEvent(ev, fx) {
  const once = (key, text) => { if (!G.predToast[key]) { G.predToast[key] = 1; toast(text, 3); } };
  switch (ev.type) {
    case 'snakeEat':
      audio.play('squish', { intensity: 0.8, pitch: 0.7 });
      if (!ev.chick) fx.chips(ev.x, ev.y, '#f3e8d2', 6, 1.6);
      break;
    case 'chickFlee':
      // the bait got away: feathers, a cheep, no yolk and no lost star
      audio.play('egg_save', { pitch: 1.6, vol: 0.6 });
      fx.chips(ev.x, ev.y, '#ffe066', 10, 2.4);
      popup(ev.x, ev.y + 0.5, 'The chick flew off!', { color: '#ffe066', size: 18, life: 1.3 });
      break;
    case 'snakeHiss':
      audio.play('lava_sizzle', { vol: 0.5, pitch: 1.6 });
      popup(ev.x, ev.y + 0.5, 'Hsss!', { color: '#a8f06a', size: 18, life: 0.9 });
      once('barrier', 'The snake is stuck behind the wall. Its venom melts it soon!');
      break;
    case 'venomSpit':
      audio.play('squish', { intensity: 0.5, pitch: 1.4 });
      fx.burst(ev.x, ev.y, 6, (i, a, b) => ({ x: ev.x, y: ev.y, vx: (ev.tx - ev.x) * (1.5 + a) + (b - 0.5), vy: (ev.ty - ev.y) * (1.5 + a) + (b - 0.5), drag: 2, life: 0.4, size: 0.04, color: '#8be04e' }));
      break;
    case 'barrierMelt':
      audio.play('lava_sizzle', { vol: 0.8 });
      fx.smoke(ev.x, ev.y, 5, 'rgba(120,200,80,0.5)');
      fx.chips(ev.x, ev.y, '#8be04e', 8, 2);
      break;
    case 'barrierIgnite':
      audio.play('fire_ignite');
      fx.sparkle(ev.x, ev.y, 8, '#ff9a3a');
      break;
    case 'barrierBurn':
      audio.play('fire_burn');
      audio.play('wood_break', { vol: 0.7 });
      fx.smoke(ev.x, ev.y, 6);
      fx.chips(ev.x, ev.y, '#ff7a1a', 10, 2.5);
      break;
    case 'eagleIn':
      audio.play('wind_gust', { vol: 0.8 });
      once('eagle', 'An eagle! It reaches in through gaps in the outer ring.');
      break;
    case 'eagleWarn':
      // the screech: a high, bent glass crack over a gust
      audio.play('glass_crack', { pitch: 1.8, vol: 0.7 });
      audio.play('wind_gust', { vol: 0.5, pitch: 1.4 });
      popup(ev.x, ev.y + 0.6, '!', { color: '#ff5a3a', size: 34, life: 0.9 });
      break;
    case 'eagleDive':
      audio.play('wind_gust', { pitch: 1.6 });
      break;
    case 'eagleGrab':
      audio.play(ev.kind === 'snake' ? 'thorn_snap' : 'egg_crack', { pitch: 1.3 });
      fx.sparkle(ev.x, ev.y, 10, ev.kind === 'snake' ? '#b6ff8a' : '#fff6c2');
      fx.shake = Math.max(fx.shake, 0.35);
      if (ev.kind === 'snake') { popup(ev.x, ev.y + 0.5, 'Snake snatched!', { color: '#b6ff8a', size: 22 }); hen('happy', 1.2); }
      break;
    case 'eagleBounce':
      audio.play('steel_clang', { vol: 0.8 });
      fx.wave(ev.x, ev.y, 0.7, '#e6e6e6', 0.35, 0.06);
      popup(ev.x, ev.y + 0.5, 'Too tough!', { size: 18 });
      break;
    case 'eagleBlocked':
      audio.play('rock_hit', { vol: 0.7 });
      fx.dust(ev.x, ev.y, 5);
      popup(ev.x, ev.y + 0.4, 'Blocked!', { color: '#cfe8ff', size: 18 });
      break;
    case 'foxThrow':
      audio.play('portal_exit', { vol: 0.6, pitch: 0.8 });
      fx.sparkle(ev.x2, ev.y2, 8, powerInfo(ev.power).color);
      once('fox', 'The fox drops orbs into the outer channel. Not all of them help!');
      break;
    case 'chickPeck':
      audio.play('thorn_snap', { pitch: 1.3 });
      fx.chips(ev.x, ev.y - 0.2, '#aab2bd', 6, 2);
      popup(ev.x, ev.y + 0.6, 'Peck peck!', { color: '#ffe14d', size: 20 });
      break;
  }
}

// danger cue (I8): a heartbeat (two low egg bumps) that speeds up as a snake closes in, plus a faint red edge
function heartbeat(dt) {
  const lv = G.screen === 'play' && G.sim && G.sim.state === 'play' ? G.sim.danger || 0 : 0;
  G.danger = lerp(G.danger || 0, lv, 1 - Math.exp(-dt * 4));
  if (lv <= 0) { G.beat = 0; return; }
  if ((G.beat = (G.beat || 0) - dt) > 0) return;
  G.beat = lerp(1.1, 0.42, lv);
  audio.play('egg_bump', { intensity: 0.3 + 0.4 * lv, pitch: 0.42, vol: 0.5 + 0.4 * lv });
  setTimeout(() => audio.play('egg_bump', { intensity: 0.2 + 0.3 * lv, pitch: 0.38, vol: 0.35 + 0.3 * lv }), 160);
  G.beatT = G.t;
}

function drawDanger() {
  if (save.calm || !(G.danger > 0.05)) return;
  const p = Math.exp(-(G.t - (G.beatT || -9)) * 5);
  const a = G.danger * (0.12 + 0.18 * p);
  const g = ctx.createRadialGradient(W_ / 2, H_ / 2, Math.min(W_, H_) * 0.35, W_ / 2, H_ / 2, Math.max(W_, H_) * 0.75);
  g.addColorStop(0, 'rgba(200,0,0,0)');
  g.addColorStop(1, `rgba(200,0,0,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W_, H_);
}

function hen(mood, t) {
  G.hen = { mood, t };
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
  // coins (F7) and the bonus objective (C3): bonus coins are paid the first time it is met, per mode
  const bonus = !!L.bonus && sim.bonusMet();
  const bonusCoins = bonus && !save.bonus[sk(L.id, sim.mode)] && G.li >= 0 ? BONUS_COINS : 0;
  let coins = E.levelCoins({ stars, saved: st.saved, eggs: st.total, perfect: st.perfect, levelId: L.id }).total + bonusCoins;
  if (G.li < 0) coins = stars && save.daily.paid !== today() ? coins + DAILY_COINS : 0; // the Daily Vault pays once a day
  return { stars, saved: st.saved, eggs: st.total, eggScore: st.score, timeBonus, streak, streakMult, total, shownTotal: 0, t: 0, target: st.target, perfect: st.perfect, rewound: G.usedRewind, coins, bonus, hasBonus: !!L.bonus };
}

function recordResult() {
  const r = G.result;
  const id = G.level.id;
  if (G.li < 0) {
    if (save.daily.day !== today()) save.daily = { ...save.daily, day: today(), best: 0 };
    if (r.stars > 0) { save.daily.best = Math.max(save.daily.best, r.total); save.daily.paid = today(); }
  } else if (r.stars > 0) {
    const key = sk(id, G.sim.mode); // the mode this run was played in, even if changed on the pause card
    save.stars[key] = Math.max(save.stars[key] || 0, r.stars);
    save.best[key] = Math.max(save.best[key] || 0, r.total);
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
  save.wallet = E.addCoins(save.wallet, G.result.coins);
  if (G.result.bonus) save.bonus[sk(G.level.id, G.sim.mode)] = 1;
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
  // slow motion (power cards, the last egg) scales the world's time, not the UI's
  const sdt = G.slow ? dt * G.slow.scale : dt;
  if (G.slow && (G.slow.left -= dt) <= 0) G.slow = null;
  if (G.card && (G.card.t += dt) > G.card.dur) G.card = null;
  if (G.hen.t > 0 && (G.hen.t -= dt) <= 0) G.hen.mood = 'idle';
  if (G.hintShow && (G.hintShow.t -= dt) <= 0) G.hintShow = null;
  heartbeat(dt); // predators (v3)
  if (G.hint) hintWork();
  if (G.hitstop > 0) G.hitstop -= dt;
  else if (running && !G.adBusy) {
    G.acc += Math.min(sdt, 0.1);
    let n = 0;
    while (G.acc >= DT && n < 24) { if (DEV && G.autoplay) botTick(sim, G.botMem || (G.botMem = {})); sim.step(); G.acc -= DT; n++; }
    handleEvents();
  }
  for (const r of sim.rings) if (r.denied > 0) r.denied -= dt;
  // safety net: if an end-card timer was missed, route a decided level to its card
  if (G.screen === 'play' && (sim.state === 'won' || sim.state === 'failed')) {
    if ((G.endWait = (G.endWait || 0) + dt) > 2.5) {
      if (sim.state === 'won' && G.result) { setScreen('win'); audio.play('level_win'); }
      else if (sim.state === 'failed') { setScreen('fail'); audio.play('level_fail'); }
    }
  } else G.endWait = 0;
  lastEggMoment(sim);
  const heavy = W_ < 500 && ['current', 'fog', 'sandstorm'].includes(G.weather.kind);
  G.weather.update(dt, { wind: sim.wind, intensity: heavy ? 0.6 : 1 });

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
    if (e.fire > 0 && e.fireKind === 'fire_red') { G.fx.flameAt(p.x, p.y + 0.05, 1.1, v.x, v.y); G.fx.flameAt(p.x, p.y - 0.1, 0.9, v.x, v.y); }
    if (e.comet) G.fx.add({ x: p.x + (Math.random() - 0.5) * 0.3, y: p.y + (Math.random() - 0.5) * 0.3, vx: v.x, vy: v.y + 0.6, life: 0.25, size: 0.08, grow: -0.2, color: '#9fe8ff', hot: '#ffffff', type: 'flame' });
  }
  for (const b of sim.bombs) {
    if (b.alive && b.lit && b.spark) G.fx.add({ x: b.spark.x, y: b.spark.y, vx: (Math.random() - 0.5) * 2, vy: Math.random() * 2, g: 4, life: 0.25, size: 0.02, color: '#ffd34d', type: 'spark' });
  }
  for (const pt of sim.portals) {
    if (Math.random() < 0.5) {
      const a = Math.random() * 6.283;
      const R = pt.pull || 0.5; // v3: the suction field reaches further
      G.fx.add({ x: pt.ax + Math.cos(a) * R, y: pt.ay + Math.sin(a) * R, vx: -Math.cos(a) * R * 1.8, vy: -Math.sin(a) * R * 1.8, life: 0.45, size: 0.025, color: '#b9a8ff', layer: 'back' });
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

// The in-game hint (C4): a depth-1 search from a frozen copy of the world, ~10 ms per frame (the
// search yields every 30 sim steps and tries at most 24 moves), then a ghost arrow on the ring to turn.
function hintWork() {
  const H = G.hint, t0 = performance.now();
  let done = false;
  while (performance.now() - t0 < 10) if (H.gen.next().done) { done = true; break; }
  if (!done) return;
  G.hint = null;
  const b = H.out.best;
  if (b) G.hintShow = { ring: b.ring, dir: Math.sign(b.delta), amt: Math.min(Math.abs(b.delta), 2), t: 6 };
  else toast('Try turning the ring under an egg.', 2.4);
  if (G.screen === 'pause') press('resume');
}

// The last egg (C9): when the final egg needed is falling onto the nest, slow down and let the hen lean in.
function lastEggMoment(sim) {
  if (G.lastEgg || G.screen !== 'play' || sim.state !== 'play' || (sim.level.target || 1) - sim.savedLog.length !== 1) return;
  const nx = sim.nest.getPosition().x;
  for (const e of sim.aliveEggs()) {
    const p = e.body.getPosition(), v = e.body.getLinearVelocity();
    if (sim.channelOf(e) >= sim.rings.length && v.y < -1 && Math.abs(p.x - nx) < sim.nestW / 2 + 0.3 && p.y < sim.nestY + 2.2) {
      G.lastEgg = true;
      G.slow = { left: 0.9, scale: 0.35 };
      hen('worried', 1.1);
      return;
    }
  }
}

// ---------------------------------------------------------------- render
function render() {
  const t = G.t;
  setSpriteCalm(save.calm); // reduced motion holds the flat sprites still
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
  G.weather.drawBack(ctx);
  // ground band
  const gy = toScreen(0, sim.groundY).y;
  if (gy < H_) G.backdrop.drawGround(ctx, 0, gy, W_, H_ - gy, t);

  // world
  const P = G.play;
  const cx = P.x + P.w / 2, cy = P.y + P.h / 2;
  // reduced motion (C10) turns off shakes and flashes
  const sh = save.calm ? 0 : fx.shake * fx.shake * 7;
  const ox = save.calm ? 0 : (Math.random() - 0.5) * sh + G.weather.shakeX, oy = save.calm ? 0 : (Math.random() - 0.5) * sh + G.weather.shakeY;
  const k = G.cam.k * (1 + 0.025 * fx.punch);
  G.rk = k;
  ctx.setTransform(DPR * k, 0, 0, -DPR * k, DPR * (cx + ox - G.cam.x * k), DPR * (cy + oy + G.cam.y * k));
  fx.draw(ctx, 'back');
  for (const pt of sim.portals) W.drawPortalPull(ctx, pt, t); // v3
  for (const pt of sim.portals) { W.drawPortal(ctx, pt.ax, pt.ay, t, false); W.drawPortal(ctx, pt.bx, pt.by, t, true); }
  if (sim.timeLimit && sim.state === 'play') W.drawFuse(ctx, sim.outerR + 0.32, sim.timeLeft / sim.timeLimit, t, G.screen === 'play' ? fx : null);
  W.drawNest(ctx, sim, G.theme, t, sim.savedLog.length);
  const eggPts = sim.aliveEggs().map((e) => e.body.getPosition());
  const stuck = sim.aliveEggs().filter((e) => e.honey > 0);
  for (const ring of sim.rings) {
    const held = ring.held || (ring.keyHeld && G.keySel === ring.i);
    const hover = !held && G.screen === 'play' && ((G.hover === ring && ring.grabbable) || (G.keys.__kb && G.keySel === ring.i));
    ctx.save();
    if (ring.denied > 0) ctx.rotate(Math.sin(t * 60) * 0.01 * ring.denied);
    W.drawRing(ctx, ring, G.theme, k, t, { held, hover, eggs: eggPts, simT: sim.t, stuck });
    W.drawV3Ring(ctx, ring, k, t);
    ctx.restore();
  }
  for (const ring of sim.rings) if (ring.gear && ring.gear.i > ring.i) W.drawGearCog(ctx, ring, ring.gear, t);
  if (sim.wx.bolt) { const b = sim.boltPoint(sim.wx.bolt); W.drawBoltWarn(ctx, b.x, b.y, t); }
  W.drawBarriers(ctx, sim, t, k); // predators (v3)
  W.drawFoxThrower(ctx, sim, t, k);
  // floating orbs: mystery until discovered (F19)
  for (const o of sim.orbs) if (o.alive) flipped(o.x, o.y, (k) => drawOrb(ctx, o.type, 0, 0, 0.2 * k, t, !!save.seen[o.type]));
  drawHenAt(sim, k, t);
  if (G.screen === 'play' || G.screen === 'intro') W.drawDropGuide(ctx, sim.rings[sim.rings.length - 1], sim.nest.getPosition().x, sim.nestW, t);
  for (const r of sim.rocks) if (r.alive) W.drawRock(ctx, r, G.theme);
  for (const b of sim.bombs) if (b.alive) b.spark = W.drawBomb(ctx, b, t);
  for (const d of sim.debris) W.drawDebris(ctx, d, G.theme);
  W.drawLavaRocks(ctx, sim, k, t); // v3
  W.drawIcicles(ctx, sim, k, t);
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
  W.drawEagleAt(ctx, sim, t, k, 'back'); // predators (v3): eagle shadow under the eggs
  for (const e of sim.aliveEggs()) W.drawEgg(ctx, e, t, k);
  W.drawSnakes(ctx, sim, t, k); // predators (v3)
  for (const m of sim.embers) W.drawEmber(ctx, m, t);
  W.drawEagleAt(ctx, sim, t, k);
  if (G.hintShow && G.screen === 'play') drawHintArrow(sim.rings[G.hintShow.ring], G.hintShow, t);
  fx.draw(ctx, 'front');
  for (const e of sim.aliveEggs()) W.drawEggMult(ctx, e, k, FONT);

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  G.weather.calm = save.calm;
  G.weather.drawFront(ctx);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  G.backdrop.drawAmbient(ctx, t, G.cam);
  drawDanger(); // predators (v3)
  drawV3Tint(sim);
  if (fx.flash > 0 && !save.calm) {
    ctx.globalAlpha = fx.flash * 0.6;
    ctx.fillStyle = fx.flashColor;
    ctx.fillRect(0, 0, W_, H_);
    ctx.globalAlpha = 1;
  }


  // UI
  if (G.screen !== 'title' && G.screen !== 'levels' && G.screen !== 'store') drawHUD();
  if (G.screen === 'play') {
    // the power card owns the top of the screen while it shows
    if (G.card) drawCard();
    else { drawPopups(); drawToast(); }
    drawKeyHint();
  }
  if (G.screen === 'intro') drawIntro();
  if (G.screen === 'pause') drawPause();
  if (G.screen === 'win') drawWin();
  if (G.screen === 'fail') drawFail();
  if (G.screen === 'title') drawTitle();
  if (G.screen === 'levels') drawLevels();
  if (G.screen === 'store') { dim(0.7); drawStore(ui, ctx, W_, H_, { wallet: save.wallet, t: G.t, adReady: E.adCooldownLeft(save.adClaim, Date.now()) === 0, adCooldownLeft: E.adCooldownLeft(save.adClaim, Date.now()), flash: G.storeFlash ? { id: G.storeFlash.id, t: G.t - G.storeFlash.t0 } : null, tab: G.storeTab }); }
  if (G.adBusy) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, W_, H_);
  }
  if (DEV || G.checkOverlaps) G.overlaps = ui.overlaps();
}

// The art helpers draw in a local y-down space in pixels: run draw(k) there, centered at world
// (x, y); k = pixels per meter, so a size of m meters is m * k.
function flipped(x, y, draw) {
  const k = G.rk;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1 / k, -1 / k);
  draw(k);
  ctx.restore();
}

// The hen sits beside the nest (F16) and reacts: happy on a save, gasp on a crack, cry on a break.
function drawHenAt(sim, k, t) {
  if (k < 20) return; // too small to read
  // on a phone the vault leaves k ~ 35 px/m: draw her at least ~50 px tall so she is visible, and step her out from the nest
  const s = Math.max(0.95, Math.min(52, k * 1.5) / k);
  const n = sim.nest.getPosition();
  ctx.save();
  ctx.translate(n.x + sim.nestW / 2 + 0.6 + (s - 0.95) / 2, sim.groundY);
  ctx.scale(1 / k, -1 / k);
  // she stands ON the ground: a soft contact shadow and a little straw she has scratched out of the nest
  const hs = s * k;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.26)';
  ctx.beginPath(); ctx.ellipse(0, 0, hs * 0.36, hs * 0.075, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = G.theme?.palette?.nestStraw || '#c9a24a'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1, hs * 0.022);
  for (const [a, b, c] of [[-0.42, -0.02, -0.22], [-0.3, 0.01, -0.05], [0.18, -0.01, 0.4], [0.3, 0.02, 0.5]]) {
    ctx.beginPath(); ctx.moveTo(a * hs, b * hs); ctx.lineTo(c * hs, b * hs - hs * 0.03); ctx.stroke();
  }
  ctx.restore();
  // idle life while nothing is happening: she pecks at the straw now and then, and leans in when worried
  let lean = G.hen.mood === 'worried' ? -0.15 : 0, dip = 0;
  if (G.hen.mood === 'idle' || G.hen.mood === 'happy' || !G.hen.mood) {
    const cyc = t % 5.2;
    if (cyc > 4.2) { const q = (cyc - 4.2) / 1.0; const peck = Math.max(0, Math.sin(q * Math.PI * 2)); lean = 0.32 * peck; dip = 0.04 * peck; }
  }
  ctx.translate(-hs * 0.12, 0);
  ctx.rotate(lean);
  ctx.translate(hs * 0.12, hs * dip);
  drawHenActor(ctx, G.hen.mood, 0, -0.49 * hs, hs, t, { key: 'level' });
  ctx.restore();
}

// Ghost arrow for a hint (C4): along the ring, the way to turn it.
function drawHintArrow(ring, h, t) {
  const R = ring.r + RING_TH / 2 + 0.22, a0 = -Math.PI / 2 - (h.dir * h.amt) / 2, a1 = -Math.PI / 2 + (h.dir * h.amt) / 2;
  ctx.save();
  ctx.globalAlpha = 0.55 + 0.35 * Math.sin(t * 5);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.09;
  ctx.lineCap = 'round';
  ctx.setLineDash([0.18, 0.12]);
  ctx.beginPath();
  ctx.arc(0, 0, R, Math.min(a0, a1), Math.max(a0, a1));
  ctx.stroke();
  ctx.setLineDash([]);
  const hx = R * Math.cos(a1), hy = R * Math.sin(a1), tx = -Math.sin(a1) * h.dir, ty = Math.cos(a1) * h.dir;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(hx + tx * 0.28, hy + ty * 0.28);
  ctx.lineTo(hx - tx * 0.05 + ty * 0.2, hy - ty * 0.05 - tx * 0.2);
  ctx.lineTo(hx - tx * 0.05 - ty * 0.2, hy - ty * 0.05 + tx * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Power popup card (F14): orb, name and one line, while the world runs in slow motion.
function drawCard() {
  const c = G.card, info = powerInfo(c.id), u = ui.u;
  const a = Math.min(1, c.t * 6, (c.dur - c.t) * 4);
  const w = Math.min(W_ - 24 * u, 380 * u), x = W_ / 2 - w / 2, y = G.hudBottom + 10 * u;
  const lineS = 15 * u, icon = 64 * u;
  const lines = wrapText(info.line, lineS, w - icon - 28 * u).slice(0, 3);
  const h = Math.max(icon + 8 * u, 16 * u + 24 * u + lines.length * lineS * 1.25 + 10 * u);
  ctx.globalAlpha = a;
  ui.panel(x, y, w, h, { fill: 'rgba(24,16,10,0.88)', r: 14 * u, border: info.color, record: true, tag: 'card', group: 'card' });
  drawPowerCard(ctx, c.id, x + 6 * u, y, icon * 2, h, G.t, ui);
  const tx = x + icon + 16 * u;
  ui.text(info.name, tx, y + 10 * u + 12 * u, { size: 22 * u, color: info.color, stroke: 'rgba(0,0,0,0.6)', maxW: w - icon - 26 * u, tag: 'card:name', group: 'card', alpha: a });
  lines.forEach((l, i) => ui.text(l, tx, y + 40 * u + lineS * 1.25 * (i + 0.5), { size: lineS, color: '#fff', maxW: w - icon - 26 * u, tag: 'card:l' + i, group: 'card', alpha: a }));
  ctx.globalAlpha = 1;
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
  for (const e of sim.eggs) if (!e.fled) states.push(e.saved ? 'saved' : e.alive ? 'alive' : 'broken'); // a fled chick leaves the tray
  while (states.length < slots) states.push('empty');
  const trayW = slots * traySpace;
  const needTxt = `need ${st.target}`;
  const needW = ui.measure(needTxt, 13 * u);
  const timeTxt = sim.timeLimit ? fmtTime(sim.timeLeft) : '';
  const timeW = timeTxt ? ui.measure(timeTxt, 22 * u) + 26 * u : 0;
  const lvlTxt = G.li < 0 ? G.level.name : `${G.level.id}. ${G.level.name}`;
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
  if (G.screen === 'play' && sim.state === 'play') drawZoomBtns();
}

// zoom -, +, and auto (only while the player has overridden auto zoom), in the strip computeLayout keeps clear of the vault
function drawZoomBtns() {
  const { bs, pad, side } = G.zb, P = G.play, u = ui.u, gap = 8 * u;
  const ic = (plus) => (c, x, y, s) => {
    c.fillStyle = '#fff';
    c.fillRect(x - s * 0.3, y - s * 0.05, s * 0.6, s * 0.1);
    if (plus) c.fillRect(x - s * 0.05, y - s * 0.3, s * 0.1, s * 0.6);
  };
  const o = { color: '#5a8dee', dark: '#2f5bb0' };
  const items = [['zoom:in', ic(true), ''], ['zoom:out', ic(false), '']];
  if (G.zm != null) items.push(['zoom:auto', null, 'auto']);
  items.forEach(([id, icon, label], i) => {
    const x = side ? W_ - pad - bs : W_ - pad - bs * (i + 1) - gap * i;
    const y = side ? P.y + (P.h - (bs * 3 + gap * 2)) / 2 + (bs + gap) * i : H_ - 6 * u - bs;
    ui.button(id, label, x, y, bs, bs, { ...o, icon, size: 13 * u });
  });
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

// Easy / Medium / Hard (F32), as one row of three buttons
function modeRow(x, y, w, h, s) {
  const gap = 8 * s, bw = (w - 2 * gap) / 3;
  MODE_LIST.forEach((m, i) => {
    const on = save.mode === m;
    ui.button('mode:' + m, m[0].toUpperCase() + m.slice(1), x + i * (bw + gap), y, bw, h, { color: on ? '#46b83d' : '#6a5a4a', dark: on ? '#2a7a24' : '#3a2e22', size: Math.min(16 * s, h * 0.42) });
  });
}

function drawIntro() {
  dim(0.35);
  const L = G.level;
  if (L.intro && !save.intro[L.id]) {
    // a world's new mechanic gets one screen of its own the first time (C6); a boss also shows its face (I6)
    stackCard(L.intro.title, (s, iw) => [
      ...(L.boss ? [{ h: 190 * s, gap: 0, draw: (x, y, w) => bossPortrait(ctx, L.boss, x, y, w, 190 * s, G.t) }] : []),
      ...wrapText(L.intro.line, 17 * s, iw).slice(0, 4).map((l, i) => lineBlock(l, 17 * s, { color: '#fff', tag: 'wintro:' + i, gap: i ? 2 * s : 4 * s })),
      { h: 56 * s, gap: 18 * s, draw: (x, y, w) => ui.button('gotit', 'GOT IT', x, y, w, 56 * s, { color: '#46b83d', dark: '#2a7a24', icon: ICON.play, size: 22 * s }) },
    ]);
    return;
  }
  stackCard(G.li < 0 ? `Daily Vault ${today().slice(5)}` : `Level ${L.id}`, (s, iw) => {
    const tip = wrapText(L.tip, 15 * s, iw).slice(0, 3);
    const B = [
      lineBlock(L.name, 20 * s, { color: '#fff', tag: 'intro:name', gap: 0 }),
      { h: 28 * s, draw: (x, y, w) => {
        for (let i = 0; i < L.eggs; i++) drawEggIcon(ctx, x + w / 2 + (i - (L.eggs - 1) / 2) * 30 * s, y + 14 * s, 26 * s, 'alive');
        ui.record({ x: x + w / 2 - L.eggs * 15 * s, y, w: L.eggs * 30 * s, h: 28 * s }, 'intro:eggs');
      } },
      lineBlock(`Save ${L.target} of ${L.eggs} eggs before the fuse burns out`, 15 * s, { color: '#ffe066', tag: 'intro:goal' }),
      ...(G.li < 0 ? [lineBlock(dailyBest() ? `Today's best: ${dailyBest()}` : `First win today: +${DAILY_COINS} coins`, 14 * s, { color: '#9fe8ff', tag: 'intro:daily', gap: 4 * s })] : []),
      ...tip.map((l, i) => lineBlock(l, 15 * s, { color: 'rgba(255,255,255,0.85)', tag: 'intro:tip' + i, gap: i ? 2 * s : 8 * s })),
      ...(L.bonus ? [lineBlock('Bonus: ' + BONUS_TEXT(L.bonus, G.sim.MD.fuse), 14 * s, { color: '#9fe8ff', tag: 'intro:bonus', gap: 6 * s })] : []),
      { h: 58 * s, gap: 16 * s, draw: (x, y, w) => ui.button('go', 'PLAY', x, y, w, 58 * s, { color: '#46b83d', dark: '#2a7a24', icon: ICON.play, size: 24 * s }) },
      // start boosters bought in the store (F7/F21): tap to pick, each shows its one-liner
      { h: 72 * s, gap: 10 * s, draw: (x, y, w) => drawBoosterPicker(ui, ctx, x, y, w, 72 * s, { wallet: G.golden ? { ...save.wallet, owned: { ...save.wallet.owned, golden: 0 } } : save.wallet, selected: G.boostSel, lastTapped: G.boostLast, t: G.t }) },
    ];
    if (!G.adBoost && !G.golden) B.push({ h: 48 * s, draw: (x, y, w) => ui.button('adboost', 'Watch an ad: free booster', x, y, w, 48 * s, { color: '#d49a1c', dark: '#8a5f0a', ad: true, size: 15 * s }) });
    B.push({ h: 40 * s, draw: (x, y, w) => ui.button(G.li < 0 ? 'back' : 'levels', G.li < 0 ? 'Menu' : 'Levels', x + w * 0.25, y, w * 0.5, 40 * s, { color: '#5a8dee', dark: '#2f5bb0', icon: ICON.grid, size: 15 * s }) });
    return B;
  });
}

// BOSS PORTRAIT (I6): the boss's face on its intro card. Stub: the sprite agent wires
// sprites.drawBossCard(ctx, bossId, x, y, w, h, t) in here (bossIds: fox snake blizzard golem salamander eagle foxking).
function bossPortrait(ctx, bossId, x, y, w, h, t) { drawBossCard(ctx, bossId, x, y, w, h, t, G.screenT - 0.15); }

function drawPause() {
  dim(0.55);
  stackCard('Paused', (s) => {
    const B = [
      { h: 56 * s, gap: 4 * s, draw: (x, y, w) => ui.button('resume', 'RESUME', x, y, w, 56 * s, { color: '#46b83d', dark: '#2a7a24', icon: ICON.play }) },
      G.hint
        ? lineBlock('Finding a good move\u2026', 17 * s, { color: '#ffe066', tag: 'pause:hint' })
        : G.sim.state !== 'play' ? null : { h: 46 * s, draw: (x, y, w) => ui.button('hint', 'Show me a move', x, y, w, 46 * s, { color: '#d49a1c', dark: '#8a5f0a', ad: true, size: 16 * s }) },
      { h: 48 * s, draw: (x, y, w) => {
        const hw = (w - 10 * s) / 2;
        ui.button('restart', 'Restart', x, y, hw, 48 * s, { color: '#5a8dee', dark: '#2f5bb0', icon: ICON.retry, size: 17 * s });
        ui.button('levels', 'Levels', x + hw + 10 * s, y, hw, 48 * s, { color: '#5a8dee', dark: '#2f5bb0', icon: ICON.grid, size: 17 * s });
      } },
      { h: 40 * s, gap: 14 * s, draw: (x, y, w) => modeRow(x, y, w, 40 * s, s) },
    ].filter(Boolean);
    if (G.sim.mode !== save.mode) B.push(lineBlock('The new mode starts when you restart', 13 * s, { color: 'rgba(255,255,255,0.75)', tag: 'pause:modenote', gap: 4 * s }));
    B.push({ h: 40 * s, draw: (x, y, w) => ui.button('calm', save.calm ? 'Reduced motion: on' : 'Reduced motion: off', x, y, w, 40 * s, { color: save.calm ? '#8a6a4a' : '#5a4a3a', dark: '#4a3420', size: 15 * s }) });
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
    if (r.hasBonus) rows.push(['Bonus', r.bonus ? 'Done!' : 'Missed']);
    rows.push(['Coins', '+' + (r.coins || 0)]);
    const B = [
      { h: 62 * s, gap: 0, draw: (x, y, w) => {
        // the fox can't believe it; the hen is delighted (F16/F17)
        const side = (w - 192 * s) / 2 - 6 * s, cs = Math.min(58 * s, side);
        if (cs >= 36 * s) {
          drawFoxActor(ctx, 'cry', x + cs / 2, y + 36 * s, cs * 1.1, G.t, { key: 'win', enter: G.screenT - 0.1 });
          drawHenActor(ctx, 'dance', x + w - cs / 2, y + 62 * s - 0.5 * cs, cs, G.t, { key: 'win', enter: G.screenT - 0.25, phase: 1.3 });
          ui.record({ x, y: y + 36 * s - 0.6 * cs, w: cs, h: 1.2 * cs }, 'win:fox');
          ui.record({ x: x + w - cs, y: y + 62 * s - cs, w: cs, h: cs }, 'win:hen');
        }
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
    const last = G.li < 0 || G.li === LEVELS.length - 1;
    B.push({ h: 56 * s, gap: 14 * s, draw: (x, y, w) => {
      if (!ready) return;
      ui.button('next', last ? 'ALL LEVELS' : 'NEXT', x, y, w * 0.62, 56 * s, { color: '#46b83d', dark: '#2a7a24', icon: ICON.next });
      ui.button('restart', '', x + w * 0.62 + 10 * s, y, w * 0.38 - 10 * s, 56 * s, { color: '#5a8dee', dark: '#2f5bb0', icon: ICON.retry });
    } });
    B.push({ h: 48 * s, draw: (x, y, w) => {
      if (!ready) return;
      if (!G.doubled) ui.button('double', 'Double score and coins', x, y, w, 48 * s, { color: '#d49a1c', dark: '#8a5f0a', ad: true, size: 16 * s });
      else ui.text('Score and coins doubled!', x + w / 2, y + 24 * s, { size: 18 * s, align: 'center', color: '#ffe066', tag: 'win:doubled' });
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
        // the fox grins and laughs; the hen is sad (F16/F17)
        const evil = G.screenT % 2.4 < 1.2;
        drawFoxActor(ctx, evil ? 'evil' : 'laugh', x + w / 2 - 50 * s, y + 52 * s, 96 * s, G.t, { key: 'fail', enter: G.screenT });
        drawHenActor(ctx, 'cry', x + w / 2 + 56 * s, y + 98 * s - 0.5 * 64 * s, 64 * s, G.t, { key: 'fail', enter: G.screenT - 0.2, phase: 0.7 });
        ui.record({ x: x + w / 2 - 90 * s, y: y + 4 * s, w: 80 * s, h: 96 * s }, 'fail:fox');
        ui.record({ x: x + w / 2 + 24 * s, y: y + 34 * s, w: 64 * s, h: 64 * s }, 'fail:hen');
      } },
      lineBlock(`Saved ${st.saved}, needed ${st.target}`, 17 * s, { color: '#fff', tag: 'fail:stat' }),
    ];
    if (!G.usedRewind && G.sim.canRewind()) B.push({ h: 54 * s, gap: 14 * s, draw: (x, y, w) => ui.button('rewind', G.freeRewind ? 'Free rewind 5 s' : 'Rewind 5 s, keep streak', x, y, w, 54 * s, { color: '#d49a1c', dark: '#8a5f0a', ad: !G.freeRewind, size: 16 * s }) });
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
  ui.text(TEST ? 'Test build: everything unlocked' : 'Get the eggs out of the fox’s vault', cx, subY, { size: 17 * u, align: 'center', color: '#fff', stroke: 'rgba(0,0,0,0.6)', tag: 'title:sub', maxW: W_ - 32 * u });
  const bw = Math.min(300 * u, W_ - 48 * u);
  // Play, then Levels | Shop, then the difficulty row
  const by = Math.min(H_ - 186 * u, subY + 190 * u);
  ui.button('play', save.unlocked > 1 ? `PLAY  Level ${save.unlocked}` : 'PLAY', cx - bw / 2, by, bw, 64 * u, { color: '#46b83d', dark: '#2a7a24', icon: ICON.play, size: 24 * u });
  const tw = (bw - 20 * u) / 3;
  ui.button('levels', 'Levels', cx - bw / 2, by + 76 * u, tw, 50 * u, { color: '#5a8dee', dark: '#2f5bb0', icon: ICON.grid, size: 17 * u });
  ui.button('daily', 'Daily', cx - bw / 2 + tw + 10 * u, by + 76 * u, tw, 50 * u, { color: save.daily.paid === today() ? '#6a5a4a' : '#9b59d0', dark: save.daily.paid === today() ? '#3a2e22' : '#5e2f87', icon: ICON.play, size: 17 * u });
  ui.button('shop', String(save.wallet.coins), cx - bw / 2 + 2 * (tw + 10 * u), by + 76 * u, tw, 50 * u, { color: '#d49a1c', dark: '#8a5f0a', icon: (c, x, y, s) => drawCoin(c, x, y, s * 0.5, G.t), size: 17 * u });
  modeRow(cx - bw / 2, by + 136 * u, bw, 40 * u, u);
  // the fox takes whatever room is left: between subtitle and buttons, or beside the buttons; it leans toward the pointer
  const fox = (x, y, s) => {
    drawFoxActor(ctx, 'idle', x, y, s * 1.2, G.t, { key: 'title', enter: G.screenT, lean: (G.pointer.x - x) / 200 });
    ui.record({ x: x - s / 2, y: y - 0.6 * s, w: s, h: 1.2 * s }, 'title:fox');
  };
  const room = by - (subY + 12 * u) - 10 * u;
  if (room >= 60 * u) {
    const fs = Math.min(90 * u, room / 1.25);
    fox(cx, subY + 12 * u + room / 2, fs);
  } else {
    const side = (W_ - bw) / 2 - 20 * u;
    const fs = Math.min(90 * u, side * 0.8, 126 * u / 1.2);
    if (fs >= 40 * u) fox(cx - bw / 2 - 12 * u - fs / 2, by + 63 * u, fs);
  }
}

function drawLevels() {
  dim(0.6);
  const u = ui.u;
  const pad = 14 * u;
  const titleY = 34 * u;
  ui.button('back', '', pad, pad, 46 * u, 46 * u, { color: '#5a8dee', dark: '#2f5bb0', icon: ICON.rewind });
  const totalStars = bestTotal();
  const starTxt = `${totalStars} / ${LEVELS.length * 3}`;
  const stw = ui.measure(starTxt, 18 * u);
  drawStar(ctx, W_ - pad - stw - 16 * u, titleY + 4 * u, 11 * u, true);
  ui.record({ x: W_ - pad - stw - 28 * u, y: titleY - 8 * u, w: 24 * u, h: 24 * u }, 'levels:staricon', 'levels:stars');
  ui.text(starTxt, W_ - pad, titleY + 4 * u, { size: 18 * u, align: 'right', color: '#fff', tag: 'levels:stars', group: 'levels:stars' });
  const titleL = pad + 56 * u, titleR = W_ - pad - stw - 36 * u;
  ui.text(WORLDS[G.world] || 'Levels', (titleL + titleR) / 2, titleY + 4 * u, { size: 24 * u, align: 'center', maxW: titleR - titleL, color: '#ffe8b0', stroke: 'rgba(0,0,0,0.5)', tag: 'levels:title' });
  // world arrows, shop and the next star chest (C5/C6)
  const rowY = 70 * u, rh = 42 * u, nW = Math.ceil(LEVELS.length / PER_ENV);
  if (G.world > 0) ui.button('world:-1', '', pad, rowY, 46 * u, rh, { color: '#5a8dee', dark: '#2f5bb0', icon: ICON.rewind });
  if (G.world < nW - 1) ui.button('world:1', '', W_ - pad - 46 * u, rowY, 46 * u, rh, { color: '#5a8dee', dark: '#2f5bb0', icon: ICON.next });
  const midW = Math.min(W_ - 2 * pad - 2 * 56 * u, 320 * u), mx = W_ / 2 - midW / 2, half = (midW - 10 * u) / 2;
  ui.button('shop', String(save.wallet.coins), mx, rowY, half, rh, { color: '#d49a1c', dark: '#8a5f0a', icon: (c, x, y, s) => drawCoin(c, x, y, s * 0.5, G.t), size: 16 * u });
  const chest = E.chestFor(totalStars, save.wallet.chests);
  if (chest) ui.button('chest', chest.ready ? 'Open!' : `${totalStars}/${chest.at}`, mx + half + 10 * u, rowY, half, rh, { color: chest.ready ? '#46b83d' : '#6a5a4a', dark: chest.ready ? '#2a7a24' : '#3a2e22', disabled: !chest.ready, icon: (c, x, y, s) => drawChest(c, x, y, s, G.t, chest.ready ? 'ready' : 'locked'), size: 15 * u });
  let top = rowY + rh + 12 * u;
  // star gate (I5): a locked environment says how many stars it needs
  const locked = !envOpen(G.world);
  if (locked) {
    const need = envNeed(G.world), ly = top + 14 * u, txt = `Collect ${need} stars to open: you have ${totalStars}`;
    const tw = ui.measure(txt, 17 * u), lx = W_ / 2 - (tw + 30 * u) / 2;
    drawPadlock(lx + 9 * u, ly, 9 * u, '#ffe066');
    ui.text(txt, lx + 30 * u, ly, { size: 17 * u, color: '#ffe066', stroke: 'rgba(0,0,0,0.5)', tag: 'levels:gate', maxW: W_ - 2 * pad - 30 * u });
    top += 34 * u;
  }
  const first = G.world * PER_ENV, list = LEVELS.slice(first, first + PER_ENV);
  const cols = W_ > H_ ? 5 : 3;
  const rows = Math.ceil(list.length / cols);
  const gap = 10 * u;
  const cw = Math.min((W_ - pad * 2 - gap * (cols - 1)) / cols, 130 * u);
  const chh = Math.min((H_ - top - pad - gap * (rows - 1)) / rows, cw * 1.05);
  const gridW = cols * cw + (cols - 1) * gap;
  const x0 = W_ / 2 - gridW / 2;
  list.forEach((L, k) => {
    const i = first + k;
    const c = k % cols, r = Math.floor(k / cols);
    const x = x0 + c * (cw + gap), y = top + r * (chh + gap);
    const th = THEMES.find((t) => t.id === L.theme) || THEMES[0];
    const open = playable(i);
    const col = open ? th.palette.accent || '#c98a3a' : '#4a4038';
    ui.button('lv:' + i, '', x, y, cw, chh, { color: col, dark: shade(col), disabled: !open });
    const num = String(L.id);
    ui.text(num, x + cw / 2, y + chh * 0.36, { size: Math.min(28 * u, chh * 0.34), align: 'center', color: open ? '#fff' : 'rgba(255,255,255,0.5)', stroke: 'rgba(0,0,0,0.4)', group: 'btn:lv:' + i, tag: 'lvnum' + i });
    if (open) {
      const s = starsOf(L.id);
      const sr = Math.min(8 * u, cw / 12);
      for (let k = 0; k < 3; k++) drawStar(ctx, x + cw / 2 + (k - 1) * sr * 2.6, y + chh * 0.72, sr, k < s);
    } else drawPadlock(x + cw / 2, y + chh * 0.72, Math.min(10 * u, cw / 10), 'rgba(255,255,255,0.55)');
    if (L.boss) ui.text('BOSS', x + cw / 2, y + chh * 0.12, { size: Math.min(12 * u, chh * 0.13), align: 'center', color: open ? '#fff' : 'rgba(255,255,255,0.5)', stroke: 'rgba(90,20,10,0.75)', group: 'btn:lv:' + i, tag: 'lvboss' + i });
  });
}

function drawPadlock(lx, ly, ls, col) {
  ctx.fillStyle = col;
  ctx.fillRect(lx - ls, ly - ls * 0.3, ls * 2, ls * 1.4);
  ctx.strokeStyle = col;
  ctx.lineWidth = ls * 0.35;
  ctx.beginPath();
  ctx.arc(lx, ly - ls * 0.3, ls * 0.7, Math.PI, 0);
  ctx.stroke();
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
  canvas.addEventListener('wheel', wheel, { passive: false });
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
      if (s && s.v === SAVE_VER) loadSave(s);
      else if (s && (s.v === 1 || s.v === 2)) loadSave({ sfx: s.sfx, music: s.music, mode: s.mode, calm: s.calm, wallet: s.wallet, seen: s.seen });
    }
  } catch (_) { save = defaultSave(); }
  if (TEST) {
    const owned = {};
    for (const id of E.BOOSTER_ORDER) owned[id] = E.MAX_OWNED;
    save.unlocked = LEVELS.length;
    save.wallet = E.sanitizeWallet({ ...save.wallet, coins: Math.max(save.wallet.coins, 99999), owned, skins: E.SKIN_ORDER });
    persist();
  }
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
  actSteps, // film strips replay planner moves through this
  handle: () => handleEvents(),
  overlaps: () => G.overlaps,
  setSave(s) { loadSave(s); },
  get save() { return save; },
  // QA only: jump straight to an end screen with a plausible result
  showResult(kind, stars = 3) {
    if (kind === 'win') G.result = { stars, saved: 3, eggs: 3, eggScore: 4200, timeBonus: 380, streak: stars === 3 ? 3 : 0, streakMult: stars === 3 ? 1.5 : 1, total: 6870, shownTotal: 6870, t: 9, target: 2, perfect: stars === 3, rewound: false, coins: 34, bonus: true, hasBonus: stars === 3 };
    else G.sim.state = 'failed';
    setScreen(kind);
  },
};

boot();
