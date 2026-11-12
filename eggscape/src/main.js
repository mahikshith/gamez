// Eggscape: game shell. Screens, input, camera, events -> VFX/SFX/score, HUD.
import { Sim, DT, LEGACY_ORB, EAGLE_LEN } from './sim/sim.js';
import { hintSearch, actSteps } from './sim/search.js';
import { RING_TH, clamp, lerp } from './sim/geom.js';
import { LEVELS } from './data/levels.js';
import { DAILY } from './data/daily.js';
import { THEMES, createBackdrop } from './themes.js';
import { audio } from './audio.js';
import { portal } from './sdk/portal.js';
import { FX } from './render/fx.js';
import * as W from './render/world.js';
import { UI, FONT, ICON, drawStar, drawEggIcon, drawAdBadge } from './ui/ui.js';
import { drawTitleScene, drawLogo, titleTap } from './render/title.js';
import { drawSnake } from './render/characters.js';
import { POWER_INFO, drawOrb, drawPowerCard } from './render/powers.js';
import { drawSprite, drawBossCard, drawHenActor, setSpriteCalm, drawHenLegacy, ANIMATED_HEN } from './render/sprites.js';
import { drawHenAnim, henIdleEvents, resetHen } from './render/hen.js';
import { drawCelebration, pickRoutine, routine, routineCues, routinePower, ROUTINES } from './render/cheer.js';
import { drawAllies, ALLY_ART } from './render/allies.js'; // v3.4 farm allies
import { ALLY_DEMOS } from './data/ally-demos.js';
import { createWeather } from './render/weather.js';
import * as E from './economy.js';
import { drawStore, drawCoin, drawBoosterPicker, drawChest } from './ui/store.js';
import fontUrl from '../assets/fonts/fredoka-600-latin.woff2';
import { botTick } from './dev/bot.js';
import { drawBossRings, drawBossUnder, drawBossOver, drawBossActor, drawBossBar, drawMagnetField, bossPose, setBossView } from './render/boss.js'; // bosses (v3.1)
import { galeNow, BOSS_TITLE, ATTACK_NAME } from './sim/boss.js';
import { drawChickEgg, drawChickFX, drawHardIce, chickEvent, chickLabel, drawKindChick, drawReady } from './render/chicks.js'; // v3.2 chick kinds
import { drawP2Back, drawP2Front, p2Event } from './render/powers2.js'; // v3.4 powers and combos
import { warpXfBegin, warpXfEnd } from './render/warp.js'; // v3.4 warp gate: a creature drawn going through it
import { POWER_DEMOS } from './data/power-demos.js'; // v3.4 studio vaults
import { CHICK_DEMOS } from './data/chick-demos.js';
import { BAYOU_DEMOS } from './data/bayou-demos.js'; // v3.7 Gator Bayou studio vaults
import { FROG_DEMO } from './data/frog-demo.js'; // v3.3 frog studio level (dev)
import { SEA_DEMOS } from './data/sea-demos.js'; // v3.3 studio levels (dev)
import { REEF_DEMOS } from './data/reef-demos.js'; // world 8 studio levels (dev)
import { drawSeaUnder, drawSeaOver, seaEvent, seaAnim } from './render/sea.js'; // v3.3 octopus and fish
import { drawReefUnder, drawReefOver, reefEvent, drawSurface, drawBoat, boatSeat, drawRiseGuide } from './render/reef.js'; // world 8 Coral Reef (underwater)
import { drawThiefDens, drawThieves, drawThievesOver, thiefEvent, drawThief, thiefPose, thiefBlend, drawThiefCard, drawThiefEmblem } from './render/thieves.js'; // v3.6 the weasel and the rats
import { RIG as THIEF_RIG } from './sim/thieves.js';
import { THIEF_DEMOS } from './data/thief-demo.js'; // v3.6 thief studio levels (dev)
import { LAB_DEMOS } from './data/lab-demos.js'; // v4 Shape Lab studio levels: the clockwork cast and the owl
import { drawClockwork, drawClockworkTele, cwEvent, drawCwIntro } from './render/clockwork.js'; // v4 clockwork spider, wind-up beetle, spring jack
import { owlEvent } from './render/owl.js'; // v4 the Clockwork Owl
import { drawSalamanders, drawSalHeat, drawSalamander, salAnim } from './render/salamander.js'; // v3.2 lava salamander
import { drawFrogs, drawFrogTele, frogEvent, frogAnim, drawFrog } from './render/frog.js'; // v3.3 frog
import { drawBayou, drawBayouOver, bayouEvent, drawGator, drawTurtle, drawSwarm, drawGatorCard, drawGatorEmblem } from './render/bayou.js'; // v3.7 Gator Bayou
import { ringReach, ringPt } from './sim/shapes.js'; // v3.3 M10 vault shapes
import { drawRockHud } from './render/shapes.js';

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
const WORLDS = ['The Farm', 'Wild Woods', 'Frozen Lake', 'Crystal Caves', 'Volcano', 'Storm Peaks', 'The Thieves\u2019 Vault', 'Coral Reef', 'Gator Bayou', 'Shape Lab'];
// test build lab pages (v3.6): every studio vault, reachable without the dev console
const LAB = [
  { name: 'Chicks', items: CHICK_DEMOS.map((d) => [d.kind, d.kind[0].toUpperCase() + d.kind.slice(1)]) },
  { name: 'Creatures', items: [['frog', 'Frog'], ['octopus', 'Octo'], ['octoden', 'Puddle'], ['fish', 'Fish'], ['reef', 'Reef']] },
  { name: 'Thieves', items: [['weasel', 'Weasel'], ['rats', 'Rats'], ['weaselboss', 'Raid'], ['ratking', 'King']] },
  { name: 'Bayou', items: [['gator', 'Gator'], ['turtle', 'Turtle'], ['mosquito', 'Bugs'], ['grandpa', 'Grandpa']] },
  { name: 'Allies', items: [['rooster', 'Rooster'], ['goose', 'Goose']] },
  { name: 'Coral Reef', items: [['hermit', 'Hermit'], ['puffer', 'Puffer'], ['jelly', 'Jelly'], ['kingcrab', 'King']] },
  { name: 'Powers', items: [['frostnova', 'Frost'], ['shock', 'Shock'], ['thunderclap', 'Clap'], ['laser', 'Laser'], ['spin', 'Spin']] },
  { name: 'More powers', items: [['pepper', 'Pepper'], ['shrink', 'Shrink'], ['iron', 'Iron'], ['decoy', 'Decoy']] },
  { name: 'Warp Gate', items: [['warp', 'Snake'], ['warp_eagle', 'Eagle'], ['warp_sal', 'Lizard'], ['warp_frog', 'Frog'], ['warp_octo', 'Octo']] },
  { name: 'Combos', items: [['combo_shatter', 'Smash'], ['combo_sweep', 'Sweep'], ['combo_cannon', 'Cannon'], ['combo_twister', 'Twist']] },
  { name: 'More combos', items: [['combo_magnet', 'Magnet'], ['combo_stink', 'Stink'], ['combo_bait', 'Bait'], ['warp_boss', 'Boss']] },
  { name: 'Clockwork', items: [['spider', 'Spider'], ['beetle', 'Beetle'], ['jack', 'Jack'], ['owl', 'Owl']] }, // v4 Shape Lab
];
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
  cam: { x: 0, y: 0, k: 60, zoom: 1 },
  cv: { vx: 0, vy: 0, vk: 0, kick: 0, kickV: 0, kx: 0, ky: 0, playT: 0, est: false, smooth: 0.4, F: null }, // camera director state
  view: { x: 0, y: 0, k: 60, zoom: 1, dx: 0, dy: 0, shakeX: 0, shakeY: 0 }, // read-only camera info for the backdrop / weather layers
  bcam: { x: 0, y: 0, zoom: 1 }, // the camera as the backdrop's parallax sees it
  flyers: [], // prizes flying to the HUD (screen space)
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
  fails: {}, // level id -> 1 once it was failed this session (unlocks the ally button, v3.5)
  allyOpen: false, // the Rooster / Goose choice is showing
  allyAd: false, // a rewarded ad was watched for the ally this attempt
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
  if (G.sim && G.sim.state === 'failed' && G.level) G.fails[G.level.id] = 1; // allies (v3.5): help is offered after a fail
  G.allyOpen = G.allyAd = false;
  // leaving a level that was not won (quit, or gave up after a fail) ends the star streak
  if (G.sim && !G.result && G.sim.t > 1 && save.streak) { save.streak = 0; persist(); }
  G.run = (G.run || 0) + 1;
  G.li = i;
  G.level = i === -2 && G.demo ? G.demo : i < 0 ? dailyLevel() : LEVELS[i]; // -2: a dev chick demo (v3.2)
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
  G.cv.est = true; G.cv.playT = 0;
  G.flyers = [];
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

// v3.6 thieves: their labels come fast (Snatched, TRAPPED, OUCH): a new one replaces the last instead of stacking
function denPopup(wx, wy, text, o = {}) {
  G.popups = G.popups.filter((p) => !p.den);
  const n = G.popups.length;
  popup(wx, wy, text, o);
  if (G.popups.length > n) G.popups[G.popups.length - 1].den = 1;
}
function popup(wx, wy, text, o = {}) {
  const s = toScreen(wx, wy);
  // v3.1: the same label again within 0.5 s (several eggs cracking at once) merges into one: "Crack ×3"
  const key = text.replace(/\s*(\d+\/\d+|×\d+)$/, '');
  const twin = !o.sub && G.popups.find((p) => p.key === key && !p.sub && p.max - p.life < 0.5);
  if (twin) {
    twin.n++;
    twin.text = key + ' ×' + twin.n;
    twin.x += (s.x - twin.x) / twin.n;
    twin.life = twin.max;
    return;
  }
  G.popups.push({ x: s.x, y: s.y, text, key, n: 1, sub: o.sub || '', color: o.color || '#fff', life: o.life || 1.3, max: o.life || 1.3, size: (o.size || 26) * ui.u, placed: false });
}

// ---------------------------------------------------------------- camera
function computeLayout() {
  const u = ui.u;
  const twoRows = W_ < 760;
  G.hudBottom = Math.round((twoRows ? 104 : 64) * u);
  // bosses (v3.1): the phase bar gets its own strip under the HUD plate
  G.bossBar = G.level && G.level.bossFight ? Math.round(30 * u) : 0;
  G.hudBottom += G.bossBar;
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
    if (sim.water) { yMin = -R; yMax = sim.groundY + 1.5; } // underwater: the boat and the hen on the surface at the top
  } else {
    const ring = sim.rings[Math.min(n - 1, Math.max(3, maxCh + 2))];
    R = ringReach(ring) + RING_TH / 2 + 0.5;
    yMin = -R + 0.3; // height-limited screens crop a little margin, never a ring
    yMax = R - 0.3;
  }
  // predators (v3): every snake in (or about to enter) the vault is framed, like the furthest egg; so is every thief. An eagle level keeps fixed headroom for it (no zoom pumping as it flies)
  const hds = [];
  for (const S of sim.snakes || []) if (!S.gone && S.inside && S.rad <= sim.outerR + 1.5) hds.push({ x: S.rad * Math.cos(S.a), y: S.rad * Math.sin(S.a) });
  for (const C of sim.sals || []) if (C.ph !== 'wait' && C.ph !== 'gone' && C.pts.length) hds.push(C.pts[0]); // v3.2 salamander
  const A = sim.eagle;
  if (A && all) {
    // fixed headroom over the vault for it, and the whole bird (wings and all) is always in the frame
    // once it is hunting; only its first sweep in and its exit come from off screen
    yMax = Math.max(yMax, sim.outerR + 1.4 * EAGLE_LEN);
    if (A.phase !== 'away' && A.phase !== 'enter' && A.phase !== 'flee') {
      R = Math.max(R, Math.abs(A.x) + 0.85 * EAGLE_LEN); // a raised wing reaches about one body length out
      yMax = Math.max(yMax, A.y + 0.8 * EAGLE_LEN);
      yMin = Math.min(yMin, A.y - 0.6 * EAGLE_LEN);
    }
  }
  for (const T of sim.thieves || []) if (T.ph !== 'gone' && T.ph !== 'wait' && T.ph !== 'hide') hds.push(sim.thBody(T)); // v3.6 thieves
  if (sim.kc && all) { R = Math.max(R, sim.outerR + 0.72); yMin = Math.min(yMin, sim.kc.by - 0.95); yMax = Math.max(yMax, sim.kc.by + 0.95); } // world 8: the King Crab's arms hug the vault
  const BQ = bossPose(sim, false); // bosses (v3.1): keep the boss over the vault in frame
  // the big Blizzard cloud only when framing the whole vault (portrait screens have the height to spare); a zoomed-in
  // view stays on the eggs
  if (BQ && (all || BQ.h < 2)) hds.push({ x: BQ.x, y: BQ.y + BQ.h * 0.5 });
  for (const hd of hds) {
    if (all) { R = Math.max(R, Math.abs(hd.x) + 0.6); yMin = Math.min(yMin, hd.y - 0.6); yMax = Math.max(yMax, hd.y + 0.6); }
    else { R = Math.max(R, Math.hypot(hd.x, hd.y) + 0.6); yMin = -R; yMax = R; }
  }
  const P = G.play;
  const k = Math.min(P.w / (2 * R), P.h / (yMax - yMin), 190);
  return { x: 0, y: (yMin + yMax) / 2, k, R, yMin, yMax };
}

// The base frame: the whole vault, or the eggs' rings; plus the player's own zoom. (The shot the camera rests on.)
function camBase() {
  const sim = G.sim, cv = G.cv;
  const n = sim.rings.length, eggs = sim.aliveEggs();
  let maxCh = 0;
  for (const e of eggs) maxCh = Math.max(maxCh, sim.channelOf(e));
  const live = G.screen === 'play' && sim.state === 'play';
  const sky = sim.eagle && sim.eagle.phase !== 'away'; // the eagle hunts round the outside: show all of it
  const whole = !live || sky || maxCh >= n - 1 || (sim.nestAmp && maxCh >= n - 2) || n <= 2;
  const F = frameOf(true, maxCh);
  let A = whole ? F : frameOf(false, maxCh);
  // a snake or a boss outside the eggs' rings widens the close-up frame into a square; never let that zoom
  // out further than the whole vault (it cropped big vaults AND shrank the eggs): show the whole vault instead
  if (A.k < F.k) A = F;
  cv.F = F; cv.live = live; cv.whole = A === F; cv.sky = !!sky; cv.maxCh = maxCh;
  const z = G.zm;
  if (z == null || !live) return A;
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

// Never lose what matters: zoom out and slide just enough that every point (plus a margin, in metres) is in the play area.
function keepInView(T, pts, m) {
  if (!pts.length) return T;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  x0 -= m; x1 += m; y0 -= m; y1 += m;
  const P = G.play, k = Math.min(T.k, P.w / (x1 - x0), P.h / (y1 - y0)), hw = P.w / (2 * k), hh = P.h / (2 * k);
  return { x: clamp(T.x, x1 - hw, x0 + hw), y: clamp(T.y, y1 - hh, y0 + hh), k };
}

// the egg furthest along (ties: the lowest), and the gap in the ring under it that it is heading for
function leadEgg(sim) {
  let lead = null, lc = -1, ly = 0;
  const gy = sim.gy || 1;
  for (const e of sim.aliveEggs()) {
    const c = sim.channelOf(e), y = e.body.getPosition().y * gy;
    if (c > lc || (c === lc && y < ly)) { lead = e; lc = c; ly = y; }
  }
  if (!lead) return null;
  const p = lead.body.getPosition(), out = { egg: lead, ch: lc, x: p.x, y: p.y, gx: p.x, gy: p.y };
  const ring = sim.rings[lc];
  if (ring && ring.gaps.length) {
    const ra = ring.body.getAngle(), ea = Math.atan2(p.y, p.x);
    let best = 9, ga = 0;
    for (const g of ring.gaps) { const d = Math.abs(Math.atan2(Math.sin(ra + g.a - ea), Math.cos(ra + g.a - ea))); if (d < best) { best = d; ga = g.a; } }
    const [lx, ly2] = ringPt(ring, ga, ring.r), c = Math.cos(ra), s = Math.sin(ra);
    out.gx = lx * c - ly2 * s; out.gy = lx * s + ly2 * c;
  } else if (lc >= sim.rings.length) { const n = sim.nest.getPosition(); out.gx = n.x; out.gy = n.y; } // out of the vault: the nest
  return out;
}

// The director: where the camera wants to be. Shots, in order: the win push-in on nest and hen, the level's
// establishing shot (wide, or on the boss), the last egg's approach, then the base frame leaning toward the action.
// A player zoom (buttons, wheel, pinch) overrides the leaning; reduced motion keeps the plain base frame.
function camTarget() {
  const sim = G.sim;
  if (!sim) return { x: 0, y: 0, k: 60 };
  const cv = G.cv, B = camBase(), F = cv.F, P = G.play, gy = sim.gy || 1;
  cv.smooth = 0.4;
  if (save.calm) return B;
  const eggPts = sim.aliveEggs().map((e) => e.body.getPosition());
  // win: push in on the nest and the hen; the nest sits low in the frame, the sky (or sea) above her
  if (sim.state === 'won' || sim.state === 'winning' || G.screen === 'win') {
    const n = sim.nest.getPosition(), k = clamp(Math.min(F.k * 1.55, P.w / (sim.nestW + 2.3)), F.k, 190);
    cv.smooth = 0.55;
    return { x: n.x + (sim.water ? 0 : 0.5), y: n.y + (P.h / k) * 0.2 * gy, k };
  }
  // establishing shot: behind the intro card the camera creeps in from wide; a boss level opens on the boss
  const boss = bossPose(sim, false), opening = G.screen === 'intro' || (G.screen === 'play' && boss && cv.playT < 0.8);
  if (G.screen === 'play' && cv.playT < 1.4) cv.smooth = lerp(0.8, cv.smooth, ss01(cv.playT / 1.4));
  if (opening) {
    if (boss) {
      const top = boss.y + boss.h * 0.62, bot = Math.min(-0.4, ...eggPts.map((p) => p.y)) - 0.6, hw = Math.max(Math.abs(boss.x) + boss.h * 0.75, sim.outerR * 0.55);
      const k = clamp(Math.min(P.w / (2 * hw), P.h / (top - bot), F.k * 1.7), F.k, 190);
      return keepInView({ x: boss.x * 0.5, y: (top + bot) / 2, k }, eggPts, 0.45);
    }
    return { x: F.x, y: F.y, k: F.k * lerp(CAM_WIDE, 0.92, ss01(G.screenT / 3)) };
  }
  if (G.zm != null || !cv.live) return B;
  const L = leadEgg(sim);
  if (!L) return B;
  // the last egg needed is on its way out: lean in on it and the nest (gently; never while something hunts overhead)
  const need1 = (sim.level.target || 1) - sim.savedLog.length === 1, n = sim.rings.length;
  if (need1 && L.ch >= n - 1 && !cv.sky && !boss && !sim.nestAmp) {
    const nest = sim.nest.getPosition(), out = L.ch >= n;
    const T = { x: lerp(L.x, nest.x, 0.5), y: lerp(L.y, nest.y, 0.5) + 0.3 * gy, k: Math.min(F.k * (out ? 1.32 : 1.12), 190) };
    cv.smooth = 0.5;
    return keepInView(T, [...eggPts, { x: nest.x - sim.nestW / 2, y: nest.y - 0.2 * gy }, { x: nest.x + sim.nestW / 2 + (sim.water ? 0 : 1.3), y: nest.y + 0.9 * gy }], 0.5);
  }
  // lean toward the action: the lead egg and the gap it is heading for. A whole-vault frame only moves in the
  // room it has to spare (nothing of the vault is cropped); a close-up may slide a little further.
  const fx_ = lerp(L.x, L.gx, 0.35), fy_ = lerp(L.y, L.gy, 0.35);
  let dx = (fx_ - B.x) * 0.3, dy = (fy_ - B.y) * 0.3;
  if (cv.whole) {
    const sx = Math.max(0, P.w / (2 * B.k) - F.R) + 0.1, sy = Math.max(0, P.h / (2 * B.k) - (F.yMax - F.yMin) / 2) + 0.1;
    dx = clamp(dx, -sx, sx); dy = clamp(dy, -Math.min(sy, 0.9), Math.min(sy, 0.9));
  } else { const d = Math.hypot(dx, dy); if (d > 0.6) { dx *= 0.6 / d; dy *= 0.6 / d; } }
  return keepInView({ x: B.x + dx, y: B.y + dy, k: B.k }, eggPts, 0.5);
}
const CAM_WIDE = 0.8; // the establishing shot starts this much wider than the whole vault

// player zoom z: -1 whole vault, 0 auto (null), +1 twice auto
function setZoom(z) {
  z = clamp(z, -1, 1);
  G.zm = Math.abs(z) < 0.05 ? null : z;
}

// critically damped follow (eases out of rest and into it; no lurch when the target jumps)
function smoothDamp(cur, target, vel, smooth, dt) {
  const om = 2 / smooth, x = om * dt, ex = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const ch = cur - target, tmp = (vel + om * ch) * dt;
  return [target + (ch + tmp) * ex, (vel - om * tmp) * ex];
}

// a quick zoom kick toward (x, y) in the world: overshoots a little and settles (the punch on big moments)
function camPunch(amt, x, y) {
  if (save.calm) return;
  const cv = G.cv;
  cv.kickV += amt * 44;
  if (x != null) { cv.kx = x; cv.ky = y; } else { cv.kx = G.cam.x; cv.ky = G.cam.y; }
}

function updateCamera(dt) {
  const cv = G.cv, cam = G.cam;
  if (G.screen === 'pause' && !G.camSnap) return; // the shot holds under the pause card
  if (G.screen === 'play') cv.playT += dt;
  let T = camTarget();
  if (G.camSnap) {
    G.camSnap = false;
    // a new level opens wide (or on its boss) and eases in; a resize just snaps
    if (cv.est && !save.calm && G.screen === 'play' && !bossPose(G.sim, false)) T = { x: cv.F.x, y: cv.F.y, k: cv.F.k * CAM_WIDE };
    cv.est = false;
    cam.x = T.x; cam.y = T.y; cam.k = T.k;
    cv.vx = cv.vy = cv.vk = cv.kick = cv.kickV = 0;
  } else {
    const st = cv.smooth || 0.4;
    [cam.x, cv.vx] = smoothDamp(cam.x, T.x, cv.vx, st, dt);
    [cam.y, cv.vy] = smoothDamp(cam.y, T.y, cv.vy, st, dt);
    const [lk, vk] = smoothDamp(Math.log(cam.k), Math.log(T.k), cv.vk, st * 1.15, dt);
    cam.k = Math.exp(lk); cv.vk = vk;
  }
  // the punch spring (under-damped: one small overshoot)
  const om = 24, h = Math.min(dt, 0.033);
  cv.kickV += (-om * om * cv.kick - 2 * 0.5 * om * cv.kickV) * h;
  cv.kick = clamp(cv.kick + cv.kickV * h, -0.08, 0.12);
  if (Math.abs(cv.kick) < 1e-4 && Math.abs(cv.kickV) < 1e-3) cv.kick = cv.kickV = 0;
  // what the backdrop and the weather may read: where the camera is against its resting frame (metres), and how
  // far it is zoomed against the whole vault. The backdrop turns this into parallax between its layers.
  const fk = cv.F ? cv.F.k : cam.k;
  cam.zoom = (cam.k * (1 + cv.kick)) / fk;
  G.view.x = cam.x; G.view.y = cam.y; G.view.k = cam.k; G.view.zoom = cam.zoom;
  G.view.dx = (cam.x - (cv.F ? cv.F.x : 0)) * cam.k; G.view.dy = -(cam.y - (cv.F ? cv.F.y : 0)) * cam.k; // screen px the world has slid from rest
  G.bcam.x = cam.x * 2.2; G.bcam.y = (cam.y - (cv.F ? cv.F.y : 0)) * 2.2; G.bcam.zoom = 1 + (cam.zoom - 1) * 1.6;
  if (G.weather) G.weather.view = G.view;
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
  if (G.screen === 'title') { if (titleTap(x, y)) audio.play('hen_hop', { vol: 0.6 }); return; } // tap an egg friend: it jumps and flips (only the buttons start a level)
  if (G.screen === 'win' || G.screen === 'fail') return skipCheer(); // a tap off the buttons skips the hen's routine to its end
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
  const ch = G.sim.chickAt(w.x, w.y, 34 * ui.u / G.cam.k); // v3.2: a tap on a ready chick (released without dragging) uses its power
  G.chickTap = ch ? { id: ch.id, pid: e.pointerId, x, y, t: G.t } : null;
  G.laserTap = !ch && G.sim.laserReady() ? { pid: e.pointerId, x, y, t: G.t } : null; // v3.4: a tap fires the laser beak
  if (r > G.sim.outerR + 1.2 && w.y < -G.sim.outerR) return; // touching the ground area
  const ring = G.sim.ringAt(r, Math.atan2(w.y, w.x));
  if (ring.lock > 0) { lockedRing(ring); return; } // bosses (v3.1): frozen or punched
  if (!ring.grabbable) {
    audio.play('motor_tick', { vol: 0.8 });
    ring.denied = 0.35;
    return;
  }
  for (const h of G.held.values()) if (h.ring === ring) return;
  G.held.set(e.pointerId, { ring, x, y });
  if (G.hintShow && G.hintShow.ring === ring.i) G.hintShow = null;
  ring.held = true;
  ring.grabT = G.t; // game feel: the grab pulse (drawRingPulse)
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
    G.hover = G.sim.ringAt(Math.hypot(w.x, w.y), Math.atan2(w.y, w.x));
  }
}

function pointerUp(e) {
  const ct = G.chickTap; // v3.2: tap = power
  if (ct && ct.pid === e.pointerId && Math.hypot(e.clientX - ct.x, e.clientY - ct.y) < 14 * ui.u && G.t - ct.t < 0.45 && G.sim) G.sim.tapChick(ct.id);
  G.chickTap = null;
  const lt = G.laserTap;
  if (lt && lt.pid === e.pointerId && Math.hypot(e.clientX - lt.x, e.clientY - lt.y) < 14 * ui.u && G.t - lt.t < 0.45 && G.sim) { const w = toWorld(lt.x, lt.y); G.sim.fireLaser(Math.atan2(w.y, w.x)); }
  G.laserTap = null;
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
    if ((k === ' ' || k === 'c' || k === 'C') && !e.repeat) { const c = G.sim.aliveEggs().find((x) => G.sim.canTap(x)); if (c) G.sim.tapChick(c.id); else if (G.sim.laserReady()) { const L = G.sim.aliveEggs().sort((a, b) => G.sim.channelOf(b) - G.sim.channelOf(a))[0], p = L ? L.body.getPosition() : { x: 0, y: -1 }; G.sim.fireLaser(Math.atan2(p.y, p.x)); } } // v3.2: space taps a ready chick (v3.4: else fires the laser along the leading egg)
  } else if ((k === 'Enter' || k === ' ') && !e.repeat) {
    if (G.screen === 'win' && !(G.result && winIn(G.result) >= 1)) return skipCheer();
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
  if (ring.lock > 0) { ring.keyHeld = false; if (G.keys['arrowleft'] || G.keys['arrowright'] || G.keys['a'] || G.keys['d']) lockedRing(ring); return; }
  const dir = (G.keys['arrowleft'] || G.keys['a'] ? 1 : 0) - (G.keys['arrowright'] || G.keys['d'] ? 1 : 0);
  if (dir) {
    if (ring.oneway && dir !== ring.oneway) { onewayDrag(ring, -1); return; }
    if (!ring.held) ring.target = ring.body.getAngle();
    ring.target += dir * G.sim.maxOmega(ring) * dt * 1.1;
    if (!ring.keyHeld) ring.grabT = G.t;
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
    case 'ally': {
      // allies (v3.5): free on Easy and after a fail; otherwise a rewarded ad (never costs progress, the button stays on a miss)
      if (G.screen !== 'play' || !allyShown()) break;
      if (!allyKinds().some((k) => G.sim.allyCan(k))) { toast('Nothing for a farm friend to help with yet.', 2.2); break; }
      if (!allyFree() && !G.allyAd) {
        const ok = await rewarded('ally');
        if (ok) G.allyAd = true;
        if (G.screen === 'play') portal.gameplayStart();
        if (!ok) break;
      }
      G.allyOpen = !G.allyOpen;
      break;
    }
    case 'ally:rooster':
    case 'ally:goose':
      if (G.screen === 'play' && allyShown() && G.allyOpen && G.sim.allyCan(id.slice(5))) {
        if (G.sim.callAlly(id.slice(5))) G.allyOpen = false;
        else toast(id === 'ally:goose' ? 'The goose sees nothing to chase right now.' : 'The rooster cannot help right now.', 2.2);
      }
      break;
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
      } else if (id && id.startsWith('demo:') && (DEV || TEST)) {
        // test build: the chick lab (v3.2), one practice vault per chick kind
        const k = id.slice(5), d = k === 'frog' ? FROG_DEMO : [...CHICK_DEMOS, ...SEA_DEMOS, ...POWER_DEMOS, ...THIEF_DEMOS, ...ALLY_DEMOS, ...REEF_DEMOS, ...BAYOU_DEMOS, ...LAB_DEMOS].find((x) => x.kind === k);
        if (d) { G.demo = d; await breakThen(() => startLevel(-2)); }
      } else if (id && id.startsWith('lab:')) {
        G.labPage = (G.labPage || 0) + +id.slice(4);
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
      v3Fall = ev.egg && ev.egg.eagleDropped ? 'eagle' : ev.rings;
      fx.wave(ev.x, ev.y, 0.8 + 0.2 * ev.dmg, '#ffb27a', 0.4, 0.1);
      fx.land(ev.x, ev.y - 0.22 * (G.sim.gy || 1), 0, G.sim.gy || 1, 1);
      fx.kick(0.3 + 0.12 * ev.dmg);
      audio.play('rock_hit', { vol: 0.6 + 0.2 * ev.dmg });
      break;
    case 'softLand':
      if (!V3_SOFT[ev.why]) break;
      popup(ev.x, ev.y + 0.5, ev.why === 'stone' && ev.egg && ev.egg.iron ? 'Iron: no crack' : V3_SOFT[ev.why], { color: '#9dff9d', size: 16, life: 0.9 });
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
      if (ev.power === 'curse') hen('gasp', 1.4);
      break;
    }
    case 'powerOff':
      audio.play('release', { vol: 0.6 });
      break;
    case 'lavaWarn':
      audio.play('fire_ignite', { pitch: 0.6, vol: 0.5 });
      break;
    case 'rockWarn': // v3.3 M10: the vault is about to lean
      audio.play('motor_tick', { pitch: 0.55, vol: 0.9 });
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

// hourglass (cool) and the curse (hot) tint the edges of the screen while they last
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

// ---------------------------------------------------------------- game feel (render side only: the sim is never touched)
// Per-egg presentation state: a squash spring (kicked by landings, drawn in render), the last velocity (to find
// the surface normal of a hit), and the closest shave with a thorn.
const EGGFX = new WeakMap();
function eggFx(e) {
  let s = EGGFX.get(e);
  if (!s) EGGFX.set(e, (s = { s: 0, sv: 0, nx: 0, ny: 1, pvx: 0, pvy: 0, bt: -9, nearD: 9, nearX: 0, nearY: 0, nmT: -9, hurtT: -9, fs: 0, fa: 0 }));
  return s;
}
// what a landing kicks up, by the vault's material: [dust, grit, sparks on a hard hit]
const LAND_MAT = {
  wood: ['rgba(238,224,198,0.85)', '#d9b98a', 0], stone: ['rgba(214,210,204,0.85)', '#b9b3aa', 1], ice: ['rgba(232,246,255,0.85)', '#e4f6ff', 0], mushroom: ['rgba(240,226,236,0.8)', '#e7c9da', 0],
  glass: ['rgba(226,246,250,0.8)', '#dffbff', 1], metal: ['rgba(214,220,228,0.75)', '#c9d3df', 1], coral: ['rgba(250,222,214,0.8)', '#f4b9a6', 0], vine: ['rgba(214,236,196,0.8)', '#a9d18a', 0],
  cloud: ['rgba(255,255,255,0.85)', '#ffffff', 0], obsidian: ['rgba(120,110,126,0.8)', '#6a5f78', 1], bone: ['rgba(240,236,222,0.85)', '#e9e2cc', 0], gold: ['rgba(255,236,170,0.85)', '#ffd76a', 1],
};
// an egg hit something at closing speed v: squash it against the surface, kick up dust along it, thump
function eggLand(egg, v, fx) {
  const sim = G.sim, st = eggFx(egg), p = egg.body.getPosition(), vel = egg.body.getLinearVelocity();
  if (v <= 1.6 || G.t - st.bt < 0.09) return;
  st.bt = G.t;
  // the surface normal: the way the hit turned the egg's velocity (else straight back along its path)
  let nx = vel.x - st.pvx, ny = vel.y - st.pvy, d = Math.hypot(nx, ny);
  if (d < 0.3) { nx = -st.pvx; ny = -st.pvy; d = Math.hypot(nx, ny); }
  if (d < 0.05) { nx = 0; ny = sim.gy || 1; d = 1; }
  st.nx = nx / d; st.ny = ny / d;
  const pw = clamp((v - 1.2) / 5.5, 0, 1);
  st.sv += (egg.stone > 0 || egg.iron ? 0.3 : 1) * (2.5 + 9 * pw);
  if (v < 2.2) return;
  const M = sim.water ? ['rgba(200,232,255,0.6)', '#dff3ff', 0] : LAND_MAT[G.level.material || 'wood'] || LAND_MAT.wood;
  const cx = p.x - st.nx * 0.24, cy = p.y - st.ny * 0.24;
  fx.land(cx, cy, st.nx, st.ny, pw, M[0], M[1]);
  if (M[2] && pw > 0.5) for (let i = 0; i < 5; i++) { const sd = i & 1 ? 1 : -1, sp = 3 + Math.random() * 4; fx.add({ x: cx, y: cy, vx: -st.ny * sd * sp + st.nx * 2, vy: st.nx * sd * sp + st.ny * 2, g: 8, life: 0.2 + Math.random() * 0.2, size: 0.028, color: i % 2 ? '#ffd27a' : '#fff3c9', type: 'spark' }); }
  if (v > 4.6) fx.kick(0.1 + 0.14 * pw); // a heavy landing is felt
}
// hit-stop: the world holds for a few frames on a big moment (particles and the camera keep moving)
function hitStop(s) { if (!save.calm) G.hitstop = Math.max(G.hitstop, s); }
// a prize flies from the world to its place in the HUD (tag = a recorded HUD block), n of them staggered
function flyToHud(wx, wy, tag, n = 1) {
  const s = toScreen(wx, wy);
  for (let i = 0; i < n; i++) G.flyers.push({ x0: s.x, y0: s.y, tag, t: -i * 0.1, dur: 0.6 + i * 0.03, sd: i & 1 ? -1 : 1, i });
}
function updateFlyers(dt) {
  for (const f of G.flyers) {
    f.t += dt;
    if (f.t >= f.dur && !f.done) { f.done = 1; G.hudPop = { tag: f.tag, t: G.t }; audio.play('hud_pop', { pitch: 1 + 0.12 * f.i, vol: 0.7 }); }
  }
  if (G.flyers.length) G.flyers = G.flyers.filter((f) => !f.done);
}
function drawFlyers() {
  const u = ui.u, spot = (tag) => { const r = ui.rects.find((q) => q.tag === tag); return r ? { x: r.x + r.w / 2, y: r.y + r.h / 2 } : { x: W_ - 40 * u, y: 30 * u }; };
  for (const f of G.flyers) {
    if (f.t < 0) continue;
    const q = clamp(f.t / f.dur, 0, 1), T = spot(f.tag);
    // anticipation: it backs off a touch, then accelerates in along an arc
    const e = q * q * (2.6 * q - 1.6), dx = T.x - f.x0, dy = T.y - f.y0, L = Math.hypot(dx, dy) || 1, bow = Math.sin(Math.PI * clamp(e, 0, 1)) * Math.min(90 * u, L * 0.22) * f.sd;
    const x = f.x0 + dx * e - (dy / L) * bow, y = f.y0 + dy * e + (dx / L) * bow;
    const sc = (q < 0.18 ? 1.25 * Math.sin((q / 0.18) * Math.PI / 2) : lerp(1.25, 0.8, (q - 0.18) / 0.82));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(save.calm ? 0 : q * 5 * f.sd);
    drawStar(ctx, 0, 0, 11 * u * sc, true);
    ctx.restore();
  }
  const hp = G.hudPop;
  if (hp && G.t - hp.t < 0.3) {
    const q = (G.t - hp.t) / 0.3, T = spot(hp.tag), e = 1 - (1 - q) * (1 - q);
    ctx.globalAlpha = 1 - q;
    ctx.strokeStyle = '#ffe066';
    ctx.lineWidth = 3 * u * (1 - q) + 0.5;
    ctx.beginPath(); ctx.arc(T.x, T.y, (8 + 20 * e) * u, 0, 6.283); ctx.stroke();
    ctx.fillStyle = '#fff6c2';
    for (let i = 0; i < 6; i++) { const a = i * 1.047 + 0.4, r = (10 + 22 * e) * u; ctx.beginPath(); ctx.arc(T.x + Math.cos(a) * r, T.y + Math.sin(a) * r, 2.2 * u * (1 - q), 0, 6.283); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
}
// a ring answers the hand: both edges ripple outward on a grab, and blink on every detent it turns through
function drawRingPulse(ring) {
  const g = G.t - (ring.grabT ?? -9), tk = G.t - (ring.tickT ?? -9);
  if ((g > 0.4 && tk > 0.12) || save.calm) return;
  const edge = (rad) => {
    ctx.beginPath();
    if (!ring.prof) ctx.arc(0, 0, Math.max(0.02, rad), 0, 6.283);
    else { for (let i = 0; i <= 72; i++) { const [x, y] = ringPt(ring, (i / 72) * 6.283, rad); ctx.lineTo(x, y); } }
    ctx.stroke();
  };
  ctx.save();
  ctx.rotate(ring.body.getAngle());
  ctx.strokeStyle = '#fff8dc';
  if (g <= 0.4) {
    const q = g / 0.4, e = 1 - (1 - q) * (1 - q) * (1 - q);
    ctx.globalAlpha = (1 - q) * 0.8;
    ctx.lineWidth = 0.05 * (1 - q) + 0.012;
    edge(ring.r + RING_TH / 2 + 0.02 + 0.15 * e); edge(ring.r - RING_TH / 2 - 0.02 - 0.15 * e);
  }
  if (tk <= 0.12) {
    ctx.globalAlpha = 0.4 * (1 - tk / 0.12);
    ctx.lineWidth = 0.022;
    edge(ring.r + RING_TH / 2 + 0.015); edge(ring.r - RING_TH / 2 - 0.015);
  }
  ctx.restore();
}
// rings click through detents while a hand turns them (pitch by ring, loudness by speed)
const DETENT = Math.PI / 12;
let lastRingTick = 0;
function ringTicks(sim) {
  for (const r of sim.rings) {
    const a = Math.floor(r.body.getAngle() / DETENT);
    if (r.tk === undefined) r.tk = a;
    if (a === r.tk) continue;
    r.tk = a;
    if (!(r.held || r.keyHeld) || G.screen !== 'play' || G.t - lastRingTick < 0.035) continue;
    lastRingTick = G.t;
    r.tickT = G.t;
    audio.play('ring_tick', { pitch: 0.8 + 0.07 * r.i, intensity: clamp(Math.abs(r.omega) / (sim.maxOmega(r) || 1), 0, 1), vol: 0.75 });
  }
}
// Per frame, per egg: run the squash spring, remember the velocity, and call a near miss when an egg that came
// within a whisker of a thorn tip (nd metres, at ntx/nty) gets clear of it unhurt.
function eggFeel(sim, e, dt, nd, ntx, nty) {
  const st = eggFx(e), v = e.body.getLinearVelocity(), om = 34, h = Math.min(dt, 0.033);
  st.sv += (-om * om * st.s - 2 * 0.36 * om * st.sv) * h;
  st.s = clamp(st.s + st.sv * h, -0.13, 0.24);
  if (Math.abs(st.s) < 5e-4 && Math.abs(st.sv) < 0.01) st.s = st.sv = 0;
  // a long fall stretches the egg a little along its path (anticipation for the landing squash)
  const sp = Math.hypot(v.x, v.y), want = e.freefall > 0 && !e.chick ? clamp((sp - 4.5) / 9, 0, 1) * 0.085 : 0;
  st.fs = lerp(st.fs, want, 1 - Math.exp(-dt * 10));
  if (sp > 1) st.fa = Math.atan2(v.y, v.x);
  st.pvx = v.x; st.pvy = v.y;
  if (nd < 0.5) { if (nd < st.nearD) { st.nearD = nd; st.nearX = ntx; st.nearY = nty; } }
  else if (st.nearD < 9 && nd > 0.62) {
    if (st.nearD < 0.44 && sp > 0.9 && G.screen === 'play' && sim.state === 'play' && G.t - st.nmT > 2.5 && G.t - st.hurtT > 1 && !(e.fire > 0) && !(e.stone > 0) && !e.chick && !e.bubbleFix) {
      st.nmT = G.t;
      G.fx.whoosh(st.nearX, st.nearY, v.x, v.y);
      audio.play('near_miss', { vol: 0.7 });
      popup(st.nearX, st.nearY + 0.4, 'Close!', { color: '#bff3ff', size: 15, life: 0.7 });
    }
    st.nearD = 9;
  }
}
// draw one egg through its squash: pressed against the surface it hit (and planted on it), bulging sideways
function drawEggFelt(e, t, k) {
  const st = EGGFX.get(e), sq = st ? st.s : 0, fs = st && Math.abs(sq) < 0.02 ? st.fs : 0;
  if ((Math.abs(sq) < 0.004 && fs < 0.004) || save.calm) { if (!drawChickEgg(ctx, e, t, k)) W.drawEgg(ctx, e, t, k); return; }
  const p = e.body.getPosition();
  ctx.save();
  if (fs >= 0.004) { // falling: longer along the path, slimmer across
    ctx.translate(p.x, p.y); ctx.rotate(st.fa); ctx.scale(1 + fs, 1 - fs * 0.6); ctx.rotate(-st.fa); ctx.translate(-p.x, -p.y);
  } else {
    const a = Math.atan2(st.ny, st.nx);
    ctx.translate(p.x - st.nx * sq * 0.24, p.y - st.ny * sq * 0.24);
    ctx.rotate(a); ctx.scale(1 - sq, 1 + sq * 0.75); ctx.rotate(-a);
    ctx.translate(-p.x, -p.y);
  }
  if (!drawChickEgg(ctx, e, t, k)) W.drawEgg(ctx, e, t, k);
  ctx.restore();
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
          const i = clamp(ev.v / 6, 0, 1);
          audio.play('egg_bump', { intensity: i, pitch: 1.12 - 0.3 * i }); // a harder hit rings lower: weight
          if (ev.v > 2.6) audio.play('egg_land', { intensity: clamp((ev.v - 2.6) / 4.5, 0, 1), vol: 0.5 + 0.5 * i });
        }
        eggLand(ev.egg, ev.v, fx);
        break;
      case 'crack':
        audio.play('egg_crack');
        { // shell chips fly off the point of contact, a hit star marks it, the world holds a beat
          const st = eggFx(ev.egg), pw = clamp((ev.v || 4) / 8, 0.35, 1);
          st.hurtT = G.t; st.sv += 4;
          fx.shell(ev.x - st.nx * 0.2, ev.y - st.ny * 0.2, st.nx, st.ny, pw, 8, sim.water ? undefined : sim.groundY + 0.02);
          fx.impact(ev.x - st.nx * 0.3, ev.y - st.ny * 0.3, 0.24 + 0.1 * pw, '#ffe9b0');
          fx.kick(0.3 + 0.1 * pw);
          hitStop(0.05);
          camPunch(0.028, ev.x, ev.y);
        }
        hen('gasp', 1.2);
        try { if (navigator.vibrate) navigator.vibrate(30); } catch (_) {}
        if (ev.why === 'spike') audio.play('rock_hit', { vol: 0.6 });
        // v3: crack stage pop (G34), so every crack is explained
        // a scorch crack: the popup steps aside from the salamander's head, which breathes right there
        let px = ev.x;
        if (ev.why === 'scorch' && sim.sals) { const h = sim.sals.map((C) => C.pts[0]).filter(Boolean).sort((a, b) => Math.hypot(a.x - ev.x, a.y - ev.y) - Math.hypot(b.x - ev.x, b.y - ev.y))[0]; if (h) px += h.x > ev.x ? -0.7 : 0.7; }
        popup(px, ev.y + 0.55, `Crack ${ev.n || ev.egg.cracks}/3`, { sub: ev.why === 'fall' && v3Fall ? (v3Fall === 'eagle' ? 'dropped by the eagle' : `fell ${v3Fall} rings`) : ev.why === 'scorch' ? 'red-hot wall' : '', color: (ev.n || 1) >= 2 ? '#ff7a6a' : '#ffc24a', size: 18, life: 1.1 });
        break;
      case 'break': {
        if (ev.why === 'thorn') W.thornBite(G.sim, ev.x, ev.y, G.t); // v3.3: the thorn stabs
        audio.play(ev.why === 'lava' ? 'lava_sizzle' : 'egg_break');
        if (ev.why === 'thorn') audio.play('thorn_hit');
        if (ev.why === 'eagle') { /* carried off whole: no yolk */ }
        else if (ev.why === 'lava') { fx.smoke(ev.x, ev.y, 8, 'rgba(70,60,60,0.6)'); fx.chips(ev.x, ev.y, '#ffb347', 10, 3); }
        else fx.yolk(ev.x, ev.y, sim.groundY + 0.02);
        if (ev.why !== 'eagle' && ev.why !== 'thief' && ev.why !== 'snake') {
          fx.impact(ev.x, ev.y, 0.62, ev.why === 'thorn' || ev.why === 'curtain' || ev.why === 'thornball' ? '#ff6f5e' : '#ffd76a');
          fx.shell(ev.x, ev.y, 0, 1, 0.9, 9, sim.water ? undefined : sim.groundY + 0.02);
        }
        fx.kick(0.6);
        G.hitstop = save.calm ? 0.07 : 0.1;
        camPunch(0.05, ev.x, ev.y);
        hen('cry', 2.2);
        const why = { thorn: 'Thorn!', thief: 'Stolen!', ground: 'Missed the nest', lava: 'Into the lava', impact: 'Smashed!', lost: 'Lost', snake: 'The snake got it!', eagle: 'The eagle took it!', spike: 'Spiked!', ember: 'Burnt!', lightning: 'Zapped!', zap: 'Zapped!', thornball: 'Thorn ball!', blast: 'Blasted!', fall: 'Fell too far!', curtain: 'Thorn curtain!', lavarock: 'Lava rock!', icicle: 'Icicle!', heat: 'Too hot!' }[ev.why] || '';
        if (why && ev.why !== 'fuse') popup(ev.x, ev.y + 0.5, why, { color: '#ff8a7a', size: 20, life: 1.2 });
        break;
      }
      case 'save': {
        audio.play('egg_save', { pitch: 1 + (ev.combo - 1) * 0.12 });
        if (ev.combo > 1) audio.play('combo', { intensity: (ev.combo - 2) / 2 });
        if (sim.water) { fx.sparkle(ev.x, ev.y, 14); fx.wave(ev.x, ev.y, 1.2, '#fff6c2', 0.5, 0.12); fx.wave(ev.x, ev.y, 1.9, '#ffffff', 0.65, 0.06, { delay: 0.08 }); }
        else fx.nestBurst(ev.x, ev.y - 0.12, G.theme?.palette?.nestStraw || '#d9b45a', sim.groundY + 0.02);
        camPunch(0.035, ev.x, ev.y);
        flyToHud(ev.x, ev.y + 0.3, 'hud:score', Math.min(3, 1 + (ev.perfect ? 1 : 0) + (ev.combo > 1 ? 1 : 0)));
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
        const snd = { fire_red: 'fire_ignite', fire_black: 'fire_ignite', fire_green: 'unlock', fire_gold: 'twin_hatch', stone: 'steel_on', bubble: 'bubble_on', water: 'splash', thunder: 'thunder', thorn: 'thorn_hit', twin: 'twin_hatch', magnet: 'unlock', hourglass: 'rewind', feather: 'unlock', rockskin: 'steel_on', curse: 'thorn_hit', frostnova: 'glass_crack', shock: 'thunder', thunderclap: 'thunder', laser: 'fire_ignite', spin: 'wind_gust', pepper: 'squish', shrink: 'bubble_pop', iron: 'steel_on', decoy: 'twin_hatch' }[ev.power];
        audio.play(snd || 'unlock');
        fx.orbBurst(ev.x, ev.y, powerInfo(ev.power).color); // a burst in the orb's own colour
        eggFx(ev.egg).sv -= 5; // the egg swells with it for a beat
        hitStop(0.045);
        camPunch(0.04, ev.x, ev.y);
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
        popup(ev.x, ev.y + 0.5, chickLabel(ev.egg), { color: '#ffe14d', size: 24 });
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
        fx.flashColor = '#a9bdff';
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
        fx.sparkle(ev.x, ev.y, 7, '#fff1b8');
        fx.chips(ev.x, ev.y, '#d8cbb0', 5, 1.6);
        fx.shake = Math.max(fx.shake, 0.2);
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
        W.thornCrumble(ev.thorn, G.t); // v3.3: it chars, then crumbles
        audio.play('fire_burn');
        fx.smoke(ev.x, ev.y + 0.25, 2); // light, and above it, so the crumble stays readable
        fx.chips(ev.x, ev.y, '#ff8a3a', 6, 2);
        break;
      case 'vineClose': // v3.3: a thorn vine has sealed its gap
        audio.play('thorn_snap', { pitch: 0.8 });
        fx.chips(ev.x, ev.y, '#c23a55', 6, 1.5);
        if (!G.predToast.vineClose) { G.predToast.vineClose = 1; toast('Thorn vines seal a gap when they reach across. Fire burns them back.', 3.2); }
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
        toast("Time's up!", 2.2);
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
        bossEvent(ev, fx); // bosses (v3.1)
        chickEvent(ev, fx, { popup, audio, toast }); // v3.2 chick kinds
        salEvent(ev, fx); // v3.2 lava salamander
        frogEvent(ev, fx, { popup, audio, toast, once: (key, text) => { if (!G.predToast[key]) { G.predToast[key] = 1; toast(text, 3.2); } } }); // v3.3 frog
        seaEvent(ev, fx, { popup, audio, once: (key, text, d = 3.2) => { if (!G.predToast[key]) { G.predToast[key] = 1; toast(text, d); } } }); // v3.3
        p2Event(ev, fx, P2_API); // v3.4 powers and combos
        bayouEvent(ev, fx, { popup, audio, once: (key, text, d = 3.2) => { if (!G.predToast[key]) { G.predToast[key] = 1; toast(text, d); } } }); // v3.7 Gator Bayou
        thiefEvent(ev, fx, { popup: denPopup, audio, once: (key, text, d = 3.2) => { if (!G.predToast[key]) { G.predToast[key] = 1; toast(text, d); } } }); // v3.6 the weasel and the rats
        reefEvent(ev, fx, { popup, audio, once: (key, text, d = 3.2) => { if (!G.predToast[key]) { G.predToast[key] = 1; toast(text, d); } } }); // world 8 reef
        { const U = { popup, audio, once: (key, text, d = 3.2) => { if (!G.predToast[key]) { G.predToast[key] = 1; toast(text, d); } } }; cwEvent(ev, fx, U); owlEvent(ev, fx, U); } // v4 the clockwork cast, the owl
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

// ---------------------------------------------------------------- v3.4 powers: event helpers (render/powers2.js)
const P2_API = {
  popup, audio, toast,
  get sim() { return G.sim; },
  once(key, text, d = 3.2) { if (!G.predToast[key]) { G.predToast[key] = 1; toast(text, d); } },
  // a combo takes over the power card ("COMBO! <name>"); the first time it lingers (the album remembers it)
  combo(ev) {
    const id = 'combo_' + ev.id, first = !save.seen[id];
    if (first) { save.seen[id] = 1; persist(); }
    G.card = { id, t: 0, dur: first ? 2.2 : 1.3 };
    G.slow = { left: first ? 1.4 : 0.7, scale: 0.25 };
  },
};

// ---------------------------------------------------------------- v3.2 lava salamander: events -> SFX/VFX
const SAL_HIT = { lava: ['Recharged!', '#ffb347', 'lava_sizzle'], bolt: ['Zapped!', '#fff27a', 'glass_crack'], flash: ['Dazzled!', '#fff6c2', 'glass_crack'], dash: ['Bonk!', '#ffd6a0', 'rock_hit'], ice: ['Brr!', '#bfe9ff', 'glass_crack'], quake: ['Steady!', '#ffd6a0', 'rock_hit'] };
function salEvent(ev, fx) {
  const once = (key, text, d = 3.2) => { if (!G.predToast[key]) { G.predToast[key] = 1; toast(text, d); } };
  switch (ev.type) {
    case 'salIn':
      audio.play('lava_sizzle', { vol: 0.8, pitch: 0.8 });
      fx.chips(ev.x, ev.y, '#ff9a3a', 10, 2.4);
      fx.sparkle(ev.x, ev.y, 8, '#ffb347');
      if (!ev.boss) once('salIn', 'The lava salamander! It rides the ring under it: turn that ring to steer it.');
      break;
    case 'salWarn':
      audio.play('fire_ignite', { vol: 0.55, pitch: 0.55 });
      fx.sparkle(ev.x, ev.y, 6, '#ffb347');
      break;
    case 'salFire':
      audio.play('fire_burn', { vol: 0.9 });
      fx.chips(ev.x, ev.y, '#ff9a3a', 12, 2.6);
      fx.sparkle(ev.x, ev.y, 8, '#ffd27a');
      fx.shake = Math.max(fx.shake, 0.2);
      if (ev.burnt) popup(ev.x, ev.y + 0.5, 'Thorns burnt!', { color: '#ffb347', size: 18, life: 0.9 });
      once('salFire', 'Red-hot wall! An egg that touches it cracks, but thorns on it burn away.');
      break;
    case 'salScorch':
      audio.play('lava_sizzle', { vol: 0.7, pitch: 1.2 });
      fx.smoke(ev.x, ev.y, 2, 'rgba(255,170,110,0.35)'); // the crack popup names the cause (red-hot wall)
      break;
    case 'salSteam':
      audio.play('lava_sizzle', { vol: 0.6, pitch: 1.5 });
      fx.smoke(ev.x, ev.y + 0.15, 3, 'rgba(230,240,255,0.45)');
      popup(ev.x, ev.y + 0.6, 'Hiss! Cooled', { color: '#8fd0ff', size: 16, life: 0.9 });
      break;
    case 'salShrug':
      popup(ev.x, ev.y + 0.5, 'No crack', { color: '#e6e6e6', size: 15, life: 0.8 });
      break;
    case 'salCool':
      audio.play('lava_sizzle');
      audio.play('splash', { vol: 0.5 });
      fx.smoke(ev.hx, ev.hy + 0.25, 3, 'rgba(230,240,255,0.4)'); // light: the grey creature must stay readable
      popup(ev.hx, ev.hy + 0.85, 'Cooled!', { color: '#8fd0ff', size: 20 });
      once('salCool', 'Water cools the salamander to stone: harmless for a few seconds.');
      break;
    case 'salHit': {
      const H = SAL_HIT[ev.kind];
      if (!H) break;
      audio.play(H[2], { vol: 0.6, pitch: 1.3 });
      fx.sparkle(ev.x, ev.y, 8, H[1]);
      popup(ev.x, ev.y + 0.55, H[0], { color: H[1], size: 18, life: 0.9 });
      if (ev.kind === 'lava') once('salLava', 'Lava only recharges the salamander: its next breath comes sooner.');
      break;
    }
    case 'salRival':
      audio.play('lava_sizzle', { vol: 0.7, pitch: 1.7 });
      fx.sparkle(ev.x, ev.y, 10, '#ffe27a');
      popup(ev.x, ev.y + 0.7, 'Face-off!', { color: '#ffe27a', size: 24, life: 1.2 });
      once('salRival', 'Snake vs salamander! While they square off, neither one bothers your eggs.');
      break;
    case 'salPuff':
      audio.play('fire_ignite', { vol: 0.7 });
      fx.burst(ev.x, ev.y, 6, (i, a, b) => ({ x: ev.x, y: ev.y, vx: (ev.tx - ev.x) * (0.8 + a) + (b - 0.5), vy: (ev.ty - ev.y) * (0.8 + a) + (b - 0.5), drag: 3, life: 0.35, size: 0.05, color: '#ffb347' }));
      break;
    case 'salDive':
      audio.play('lava_sizzle', { vol: 0.8 });
      audio.play('splash', { vol: 0.4, pitch: 0.6 });
      break;
  }
}

// ---------------------------------------------------------------- predators (v3)
// events -> SFX/VFX for snakes, barriers, the eagle and the chick (reuses existing sounds)
function predEvent(ev, fx) {
  const once = (key, text) => { if (!G.predToast[key]) { G.predToast[key] = 1; toast(text, 3); } };
  switch (ev.type) {
    case 'snakeEat':
      audio.play('squish', { intensity: 0.8, pitch: 0.7 });
      if (!ev.chick) fx.chips(ev.x, ev.y, '#f3e8d2', 6, 1.6);
      break;
    case 'snakeClash':
      // two snakes butt heads: both reel back dizzy and it sheds an orb
      audio.play('rock_hit', { vol: 0.9 });
      audio.play('squish', { intensity: 0.7, pitch: 0.6 });
      fx.sparkle(ev.x, ev.y, 14, '#ffe27a');
      fx.wave(ev.x, ev.y, 0.9, '#fff1b8', 0.4, 0.07);
      fx.shake = Math.max(fx.shake, 0.5);
      fx.punch = 1;
      popup(ev.x, ev.y + 0.7, 'CLASH!', { color: '#c9ff9e', size: 30, sub: '+' + ev.pts, life: 1.3 });
      hen('happy', 1);
      once('clash', 'The snakes fought each other! Grab the orb they dropped.');
      break;
    case 'snakeDrop':
      audio.play('egg_bump', { intensity: 0.6, pitch: 0.6 });
      fx.dust(ev.x, ev.y, 6);
      break;
    case 'venomHole':
      // a spitter's glob burns through a ring: splash and sizzle
      audio.play('lava_sizzle', { vol: 0.8, pitch: 1.3 });
      fx.chips(ev.x, ev.y, '#8be04e', 10, 2.2);
      fx.smoke(ev.x, ev.y, 4, 'rgba(120,200,80,0.5)');
      once('venomHole', 'The red snake spits holes through the rings. Eggs can use them too!');
      break;
    case 'snakeHit': {
      // hazards hurt snakes too
      const H = { bolt: ['Zapped!', '#fff27a', 'glass_crack'], lava: ['Hot hot!', '#ff9a3a', 'lava_sizzle'], rock: ['Bonk!', '#ffd6a0', 'rock_hit'], ice: ['Frozen!', '#bfe9ff', 'glass_crack'] }[ev.kind];
      if (!H) break;
      audio.play(H[2], { vol: 0.6, pitch: 1.4 });
      fx.sparkle(ev.x, ev.y, 8, H[1]);
      popup(ev.x, ev.y + 0.5, H[0], { color: H[1], size: 18, life: 0.9 });
      break;
    }
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
      fx.burst(ev.x, ev.y, ev.rival ? 10 : 6, (i, a, b) => ({ x: ev.x, y: ev.y, vx: (ev.tx - ev.x) * (1.5 + a) + (b - 0.5), vy: (ev.ty - ev.y) * (1.5 + a) + (b - 0.5), drag: 2, life: ev.rival ? 0.5 : 0.4, size: ev.rival ? 0.07 : 0.04, color: '#8be04e' })); // at a salamander: bigger, so the duel reads
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
      once('eagle', 'An eagle! It dives at eggs in the outer channel. Keep solid ring under them.');
      break;
    case 'eagleWarn':
      // the screech: a high, bent glass crack over a gust; its shadow is already sweeping in
      audio.play('glass_crack', { pitch: 1.8, vol: 0.7 });
      audio.play('wind_gust', { vol: 0.5, pitch: 1.4 });
      if (ev.kind !== 'snake' && ev.kind !== 'orb') hen('worried', 1.4);
      break;
    case 'eagleDive':
      audio.play('wind_gust', { pitch: 1.6 });
      break;
    case 'eagleGrab':
      audio.play(ev.kind === 'snake' ? 'thorn_snap' : 'egg_crack', { pitch: 1.3 });
      fx.sparkle(ev.x, ev.y, 10, ev.kind === 'snake' ? '#b6ff8a' : '#fff6c2');
      fx.shake = Math.max(fx.shake, 0.35);
      fx.punch = 1;
      if (ev.kind === 'snake') { popup(ev.x, ev.y + 0.5, 'Snake snatched!', { color: '#b6ff8a', size: 22 }); hen('happy', 1.2); }
      else if (ev.kind === 'egg') { popup(ev.x, ev.y + 0.6, 'Grabbed!', { color: '#ff7a5a', size: 22 }); hen('worried', 2); once('eagleGrab', 'It drops what it catches back in from up high. That costs a crack.'); }
      break;
    case 'eagleDrop':
      audio.play('wind_gust', { vol: 0.5, pitch: 0.8 });
      popup(ev.x, ev.y + 0.5, 'Dropped!', { color: '#ffd27a', size: 18, life: 0.9 });
      break;
    case 'eagleDropSnake':
      audio.play('squish', { intensity: 0.6, pitch: 0.8 });
      fx.dust(ev.x, ev.y, 5);
      break;
    case 'eagleSteal':
      audio.play('portal_exit', { vol: 0.6, pitch: 1.4 });
      fx.sparkle(ev.x, ev.y, 10, powerInfo(ev.power).color);
      popup(ev.x, ev.y + 0.5, 'Orb stolen!', { color: '#ff9a5a', size: 18 });
      break;
    case 'eagleEat':
      fx.sparkle(ev.x, ev.y, 8, powerInfo(ev.power).color);
      break;
    case 'eagleBounce':
      audio.play('steel_clang', { vol: 0.8 });
      fx.wave(ev.x, ev.y, 0.7, '#e6e6e6', 0.35, 0.06);
      fx.shake = Math.max(fx.shake, 0.3);
      fx.punch = 1;
      popup(ev.x, ev.y + 0.5, 'Too tough!', { size: 18 });
      break;
    case 'eagleSlam':
      // talons on solid ring: CLANG, a dent of dust, and a dazed eagle
      audio.play('steel_clang', { vol: 0.9, pitch: 0.8 });
      audio.play('rock_hit', { vol: 0.7 });
      fx.dust(ev.x, ev.y, 7);
      fx.wave(ev.x, ev.y, 0.8, '#fff1c8', 0.3, 0.05);
      fx.shake = Math.max(fx.shake, 0.4);
      fx.punch = 1;
      popup(ev.x, ev.y + 0.4, ev.exposed ? 'Dodged!' : 'Clang!', { color: '#cfe8ff', size: 20 });
      if (ev.exposed) hen('happy', 1.2);
      break;
    case 'eagleFeather':
      audio.play('egg_save', { pitch: 1.4, vol: 0.5 });
      fx.sparkle(ev.x2, ev.y2, 10, '#fff6c2');
      once('eagleFeather', 'A dodged dive shakes a feather loose. Grab it!');
      break;
    case 'eagleDazed':
      if (ev.by !== 'slam' && ev.by !== 'bounce') { audio.play('rock_hit', { vol: 0.6, pitch: 1.3 }); fx.sparkle(ev.x, ev.y, 8, '#ffe66a'); }
      break;
    case 'eagleMiss':
      if (ev.why === 'gust') audio.play('wind_gust', { vol: 0.6 });
      break;
    case 'eagleScreech':
      audio.play('glass_crack', { pitch: 1.6, vol: 0.6 });
      break;
    case 'bossThrow':
      audio.play('portal_exit', { vol: 0.6, pitch: 0.8 });
      fx.sparkle(ev.x2, ev.y2, 8, powerInfo(ev.power).color);
      once('bossThrow', 'It throws orbs at the marked spots. Not all of them help!'); // bosses (v3.1)
      break;
    case 'chickPeck':
      audio.play('thorn_snap', { pitch: 1.3 });
      fx.chips(ev.x, ev.y - 0.2, '#aab2bd', 6, 2);
      popup(ev.x, ev.y + 0.6, 'Peck peck!', { color: '#ffe14d', size: 20 });
      break;
  }
}

// ---------------------------------------------------------------- bosses (v3.1)
// a frozen or punched ring refuses the player's hand
function lockedRing(ring) {
  if (ring.denied > 0.1) return;
  ring.denied = 0.35;
  audio.play('glass_crack', { vol: 0.5, pitch: 1.8 });
  if (!G.predToast.lock) { G.predToast.lock = 1; toast('Frozen solid! That ring thaws in a moment.', 2.4); }
}
const BOSS_WARN_SFX = {
  gale: ['wind_gust', { vol: 0.6, pitch: 0.7 }], freeze: ['glass_crack', { vol: 0.7, pitch: 0.6 }], icicles: ['glass_crack', { vol: 0.6, pitch: 1.5 }],
  stomp: ['rock_hit', { vol: 0.8, pitch: 0.5 }], punch: ['steel_clang', { vol: 0.7, pitch: 0.6 }], rock: ['fire_ignite', { vol: 0.7, pitch: 0.55 }],
  rock2: ['fire_ignite', { vol: 0.8, pitch: 0.5 }], throw: ['portal_exit', { vol: 0.5, pitch: 0.7 }], throw2: ['portal_exit', { vol: 0.6, pitch: 0.6 }],
  fog: ['bubble_on', { vol: 0.6, pitch: 0.45 }], bolt: ['thunder', { vol: 0.35, pitch: 1.7 }], bolt2: ['thunder', { vol: 0.4, pitch: 1.6 }],
};
function bossEvent(ev, fx) {
  const sim = G.sim, B = sim.bx && sim.bx.boss;
  const actor = B && !['snake', 'eagle'].includes(B.kind);
  // popups over the boss sit above the drawn actor (its sim point is lower than its head)
  const BQ = bossPose(sim), top = BQ ? { x: BQ.x, y: BQ.y + BQ.h * 0.5 } : { x: ev.x, y: (ev.y || 0) + 1 };
  switch (ev.type) {
    case 'gustWarn':
      audio.play('wind_gust', { vol: 0.35, pitch: 0.6 });
      if (!G.predToast.gust) { G.predToast.gust = 1; toast('A gust is coming! It shoves eggs along the channels.', 2.6); }
      break;
    case 'gust':
      audio.play('wind_gust', { vol: 1, pitch: 0.9 });
      fx.shake = Math.max(fx.shake, 0.15);
      break;
    case 'bossWarn': {
      const s = BOSS_WARN_SFX[ev.attack];
      if (s) audio.play(s[0], s[1]);
      if (actor) popup(top.x, top.y + 0.3, (ATTACK_NAME[ev.attack] || '') + '!', { color: '#ffcf6a', size: 20, life: 1.0 });
      break;
    }
    case 'bossAct':
      if (ev.attack === 'gale') { audio.play('wind_gust', { vol: 1.1, pitch: 0.85 }); fx.shake = Math.max(fx.shake, 0.2); }
      if (ev.attack === 'bolt' || ev.attack === 'bolt2') fx.shake = Math.max(fx.shake, 0.3);
      break;
    case 'bossPhase': {
      const names = (ev.attacks || []).map((a) => ATTACK_NAME[a]).filter((x, i, a) => x && a.indexOf(x) === i);
      toast(`${BOSS_TITLE[ev.kind] || 'The boss'}: phase ${ev.phase + 1} of ${ev.n}!${names.length ? ' ' + names.join(', ') + '.' : ''}`, 2.6);
      audio.play('unlock', { pitch: 0.6, vol: 0.8 });
      if (!save.calm) { fx.flash = 0.35; fx.flashColor = '#ff8a3d'; }
      fx.shake = Math.max(fx.shake, 0.35);
      break;
    }
    case 'bossHit':
      audio.play('steel_clang', { vol: 0.7, pitch: 1.3 });
      audio.play('rock_hit', { vol: 0.7, pitch: 0.7 });
      if (actor) {
        // the hit lands ON the boss: a big star, a ring, sparks thrown wide; the world holds and the camera punches in
        const bx = top.x, by = top.y - (BQ ? BQ.h * 0.4 : 0), sz = BQ ? clamp(BQ.h * 0.3, 0.6, 1.2) : 0.7;
        fx.impact(bx, by, sz, '#ffe27a');
        fx.wave(bx, by, sz * 3, '#ffffff', 0.5, 0.1, { delay: 0.05 });
        for (let i = 0; i < 16; i++) { const an = (i / 16) * 6.283 + Math.random() * 0.3, sp = 4 + Math.random() * 5; fx.add({ x: bx, y: by, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, drag: 3.5, g: 3, life: 0.35 + Math.random() * 0.3, size: 0.05, len: 0.05, color: i % 2 ? '#fff2a8' : '#ffffff', type: 'spark' }); }
        fx.sparkle(bx, by, 10, '#fff2a8');
        popup(top.x, top.y + 0.3, 'Ouch!', { color: '#fff2a8', size: 22, life: 0.9 });
        camPunch(0.055, bx, by);
      } else camPunch(0.03);
      fx.kick(0.45);
      hitStop(0.09);
      break;
    case 'freeze': {
      audio.play('glass_crack', { vol: 0.8, pitch: 0.8 });
      audio.play('glass_break', { vol: 0.35, pitch: 1.4 });
      const r = sim.rings[ev.ring];
      popup(ev.why === 'breath' ? 0 : ev.x, ev.why === 'breath' ? r.r + 0.35 : ev.y + 0.5, 'Frozen!', { color: '#bfeaff', size: 20, life: 1.1 });
      break;
    }
    case 'thaw':
      audio.play('glass_break', { vol: 0.3, pitch: 1.6 });
      break;
    case 'iceDrop':
      audio.play('glass_crack', { vol: 0.4, pitch: 2 });
      break;
    case 'wallUp':
      audio.play(ev.kind === 'ice' ? 'glass_crack' : 'glass_break', { vol: 0.6, pitch: ev.kind === 'ice' ? 1.2 : 0.7 });
      fx.chips(ev.x, ev.y, ev.kind === 'ice' ? '#dff6ff' : '#a99bff', 8, 2);
      break;
    case 'wallGone':
      audio.play('glass_break', { vol: 0.6 });
      fx.chips(ev.x, ev.y, ev.kind === 'ice' ? '#dff6ff' : '#a99bff', 10, 2.5);
      if (ev.how === 'fire' || ev.how === 'water') popup(ev.x, ev.y + 0.4, 'Melted!', { color: '#bfeaff', size: 18, life: 0.9 });
      if (ev.how === 'smash') popup(ev.x, ev.y + 0.4, 'Smash!', { color: '#e6e6e6', size: 18, life: 0.9 });
      break;
    case 'bossStomp':
      audio.play('rock_hit', { vol: 1, pitch: 0.45 });
      audio.play('bomb_explode', { vol: 0.35, pitch: 0.5 });
      fx.shake = Math.max(fx.shake, 0.75);
      fx.dust(ev.x, ev.y, 10);
      break;
    case 'bossPunch':
      audio.play('steel_clang', { vol: 1, pitch: 0.5 });
      fx.shake = Math.max(fx.shake, 0.5);
      break;
    case 'bossFog':
      audio.play('bubble_on', { vol: 0.7, pitch: 0.35 });
      break;
    case 'bossSummon':
      audio.play('lava_sizzle', { vol: 0.6, pitch: 1.6 });
      toast(ev.who === 'rats' ? 'His rats scurry in!' : ev.who === 'gators' ? 'Baby gators swim in!' : 'A snake slithers in!', 2.2);
      break;
    case 'heatWarn':
      audio.play('lava_sizzle', { vol: 0.5 });
      popup(ev.x, ev.y + 0.5, 'Hot!', { color: '#ff9a3d', size: 18, life: 0.9 });
      break;
    case 'bossFlinch':
      audio.play('egg_bump', { pitch: 0.6 });
      popup(top.x, top.y + 0.3, 'Whoa!', { color: '#ffcf6a', size: 18, life: 0.8 });
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
  G.hen = { mood, t, n: (G.hen.n || 0) + 1 };
}

// skip the hen's win / fail routine to its final pose (a tap off the buttons, Enter, or reduced motion)
function skipCheer() {
  const r = G.result;
  if (G.screen === 'win' && r) {
    const end = Math.max(routine(r.cheer).len, WIN_SHOW + WIN_IN); // straight to the card, the routine at its final pose
    if (r.t < end) { r.t = end; r.shownTotal = r.total; if (r.stars) audio.play('star', { intensity: (r.stars - 1) / 2 }); }
  } else if (G.screen === 'fail') G.screenT = Math.max(G.screenT, routine('encourage').len);
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
  if (G.li < 0) coins = G.li === -1 && stars && save.daily.paid !== today() ? coins + DAILY_COINS : 0; // the Daily Vault pays once a day; a lab vault pays nothing
  return { stars, saved: st.saved, eggs: st.total, eggScore: st.score, timeBonus, streak, streakMult, total, shownTotal: 0, t: 0, target: st.target, perfect: st.perfect, rewound: G.usedRewind, coins, bonus, hasBonus: !!L.bonus };
}

function recordResult() {
  const r = G.result;
  const id = G.level.id;
  if (G.li === -2) {
    // a lab vault (test build) touches no save
  } else if (G.li < 0) {
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
  // the hen's routine (render/cheer.js): by result, a boss, or the first win in a world; never the last one again
  const L = G.level, firstWorld = G.li >= 0 && L.world != null && !LEVELS.some((l) => l.world === L.world && bestStarsOf(l.id) > 0);
  G.result.cheer = pickRoutine({ stars: G.result.stars, streak: G.result.streak, boss: !!L.boss && G.li >= 0, firstWorld, last: save.lastCheer });
  save.lastCheer = G.result.cheer;
  save.wallet = E.addCoins(save.wallet, G.result.coins);
  if (G.result.bonus) save.bonus[sk(G.level.id, G.sim.mode)] = 1;
  recordResult();
  portal.gameplayStop();
  portal.happy();
  { // the payoff: three fountains of sparkles walk out from the nest while the camera pushes in on her
    const n = G.sim.nest.getPosition(), gy = G.sim.gy || 1;
    for (let j = 0; j < 3; j++) for (let i = 0; i < 9; i++) {
      const a = Math.random(), b = Math.random(), sd = j === 0 ? 0 : j === 1 ? -1 : 1;
      G.fx.add({ x: n.x + sd * 1.1 + (a - 0.5) * 0.3, y: n.y + 0.2 * gy, vx: (a - 0.5) * 2.4 + sd * 0.6, vy: (3 + b * 3.2) * gy, g: 6.5 * gy, drag: 0.8, life: 0.9 + b * 0.5, size: 0.07 + a * 0.08, color: ['#fff6c2', '#ffd94a', '#ffffff'][i % 3], type: 'star', rot: a * 3, vr: 2 + b * 4, delay: 0.25 + j * 0.16 + i * 0.02 });
    }
    camPunch(0.03, n.x, n.y);
  }
  const run = G.run;
  setTimeout(() => {
    if (G.run === run && G.sim && G.result && G.screen === 'play') { setScreen('win'); audio.play('level_win'); }
  }, 1100);
}

function onFail() {
  stopFuse();
  portal.gameplayStop();
  releaseAll();
  G.fx.kick(0.3);
  camPunch(-0.035); // the frame sags back
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
  ringTicks(sim);
  updateFlyers(dt);
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
    const feared = e.fear > 0;
    let nd = 9, ntx = 0, nty = 0; // the nearest live thorn tip (for the near-miss call)
    e.fear = Math.max(0, e.fear - dt);
    for (const ring of sim.rings) {
      const a0 = ring.body.getAngle();
      for (const th of ring.thorns) {
        if (!th.alive || th.ext < 0.5) continue;
        const [lx, ly] = ringPt(ring, th.a, th.tip), tx = lx * Math.cos(a0) - ly * Math.sin(a0), ty = lx * Math.sin(a0) + ly * Math.cos(a0); // v3.3 M10: shape-aware
        const td = Math.hypot(tx - p.x, ty - p.y);
        if (td < 0.55) e.fear = 0.4;
        if (td < nd) { nd = td; ntx = tx; nty = ty; }
      }
    }
    eggFeel(sim, e, dt, nd, ntx, nty);
    // a close shave: the egg got clear of a thorn unhurt, and the hen breathes out ('phew', a few variants)
    if (feared && e.fear === 0 && G.screen === 'play' && G.hen.mood === 'idle' && G.t - (G.phewT || -9) > 3) { G.phewT = G.t; hen('phew', 1); }
    const v = e.body.getLinearVelocity();
    if (e.fire > 0 && e.fireKind === 'fire_red') { G.fx.flameAt(p.x, p.y + 0.05, 1.1, v.x, v.y); G.fx.flameAt(p.x, p.y - 0.1, 0.9, v.x, v.y); }
    // v3.1 magnet: the pulled partner wobbles and throws small red/blue sparks
    if (e.magnet > 0 && e.joint && Math.random() < 0.3) { const q = Math.random() * 6.283; G.fx.add({ x: p.x + Math.cos(q) * 0.3, y: p.y + Math.sin(q) * 0.3, vx: Math.cos(q) * 0.8, vy: Math.sin(q) * 0.8, life: 0.25, size: 0.02, color: Math.random() < 0.5 ? '#ff4f5e' : '#4f8dff', type: 'spark' }); }
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
  for (const r of sim.rings) if ((r.held || r.keyHeld || r.motor || sim.rock) && G.screen === 'play') // the rocking vault creaks as it leans turn = Math.max(turn, Math.abs(r.omega) / (sim.maxOmega(r) || 1) * (r.motor ? 0.35 : 1));
  audio.setRingTurn(G.screen === 'play' ? clamp(turn, 0, 1) : 0);
  audio.setFireLoop(G.screen === 'play' && sim.aliveEggs().some((e) => e.fire > 0));
  audio.setWind(G.screen === 'play' ? Math.max(G.level.wind ? Math.abs(sim.wind) / (G.level.wind.strength || 1) : 0, Math.abs(galeNow(sim))) : 0);
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
    if (save.calm) skipCheer(); // reduced motion: straight to the card and her final pose
    const r = G.result, R0 = routine(r.cheer), t0 = r.t;
    r.t += dt;
    // the score counts up from the first star to the end of the routine; each star lands on one of her beats
    const s0 = R0.stars[0], k = clamp((r.t - s0) / Math.max(0.6, R0.len - 0.3 - s0), 0, 1);
    const shown = Math.round(r.total * k);
    if (shown !== r.shownTotal && k < 1 && Math.floor(r.t * 20) !== Math.floor((r.t - dt) * 20)) audio.play('score_tick', { vol: 0.3 });
    r.shownTotal = shown;
    for (let s = 0; s < r.stars; s++) if (r.t >= R0.stars[s] && t0 < R0.stars[s]) audio.play('star', { intensity: s / 2 });
    for (const [, name, o] of routineCues(r.cheer, t0, r.t)) audio.play(name, o);
  }
  if (G.screen === 'fail' && !save.calm) for (const [, name, o] of routineCues('encourage', G.screenT - dt, G.screenT)) audio.play(name, o);
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
  G.backdrop.draw(ctx, t, G.bcam); // parallax: the layers slide and breathe against the camera
  G.weather.drawBack(ctx);
  if (G.screen === 'title') { drawTitle(); if (DEV || G.checkOverlaps) G.overlaps = ui.overlaps(); return; } // the home screen has its own scene, no vault behind it
  // world
  const P = G.play, cv = G.cv;
  const cx = P.x + P.w / 2, cy = P.y + P.h / 2;
  // Screen shake from trauma (fx.shake, 0..1): squared, so small hits barely move and big ones thump; smooth
  // noise (summed sines), not per-frame random, with a whisper of roll. A few px at most. Reduced motion (C10)
  // turns off shakes, punches and flashes.
  const tr = save.calm ? 0 : fx.shake * fx.shake, amp = clamp(7 * ui.u, 5, 10) * tr;
  const ox = save.calm ? 0 : amp * (Math.sin(t * 53.1) + 0.6 * Math.sin(t * 31.7 + 2.1)) / 1.6 + G.weather.shakeX;
  const oy = save.calm ? 0 : amp * (Math.sin(t * 47.3 + 1.3) + 0.6 * Math.sin(t * 27.9 + 0.4)) / 1.6 + G.weather.shakeY;
  const roll = 0.012 * tr * Math.sin(t * 41.3 + 0.7);
  // the punch zooms about the point of impact, not the screen centre
  const kick = save.calm ? 0 : cv.kick, k = G.cam.k * (1 + 0.025 * fx.punch + kick);
  const camX = G.cam.x + (cv.kx - G.cam.x) * kick * 0.7, camY = G.cam.y + (cv.ky - G.cam.y) * kick * 0.7;
  G.rk = k;
  G.view.shakeX = ox; G.view.shakeY = oy;
  // ground band (drawn under the same camera as the world, so it never slips against it)
  const gy = cy + oy - (sim.groundY - camY) * k;
  if (gy < H_ && !sim.water) G.backdrop.drawGround(ctx, 0, gy, W_, H_ - gy, t); // underwater: no ground (the surface is drawn in the world)
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.translate(cx + ox, cy + oy);
  if (roll) ctx.rotate(roll);
  ctx.scale(k, -k);
  ctx.translate(-camX, -camY);
  W.drawVaultBack(ctx, sim, G.theme); // premium pass: plate behind the vault
  fx.draw(ctx, 'back');
  for (const pt of sim.portals) W.drawPortalPull(ctx, pt, t); // v3
  for (const pt of sim.portals) { W.drawPortal(ctx, pt.ax, pt.ay, t, false); W.drawPortal(ctx, pt.bx, pt.by, t, true); }
  if (sim.timeLimit && sim.state === 'play') W.drawFuse(ctx, sim.outerR + 0.32, sim.timeLeft / sim.timeLimit, t, G.screen === 'play' ? fx : null, sim.rings[sim.rings.length - 1]); // v4: hugs a shaped vault
  if (sim.water) drawSurface(ctx, sim, G.theme, t, k, sim.savedLog.length); else W.drawNest(ctx, sim, G.theme, t, sim.savedLog.length); // world 8: the basket under the boat
  const eggPts = sim.aliveEggs().map((e) => e.body.getPosition());
  const stuck = sim.aliveEggs().filter((e) => e.honey > 0);
  for (const ring of sim.rings) {
    const held = ring.held || (ring.keyHeld && G.keySel === ring.i);
    const hover = !held && G.screen === 'play' && ((G.hover === ring && ring.grabbable) || (G.keys.__kb && G.keySel === ring.i));
    ctx.save();
    if (ring.denied > 0) ctx.rotate(Math.sin(t * 60) * 0.01 * ring.denied);
    W.drawRing(ctx, ring, G.theme, k, t, { held, hover, eggs: eggPts, simT: sim.t, stuck });
    W.drawV3Ring(ctx, ring, k, t, G.theme);
    drawHardIce(ctx, ring, k, t); // v3.2
    drawRingPulse(ring); // game feel: the grab ripple and detent blink
    ctx.restore();
  }
  drawRockHud(ctx, sim, k, t); // v3.3 M10: the rocking vault's level and warning arrows
  setBossView({ top: G.cam.y + (G.play.h / 2) / G.cam.k, k: G.cam.k, u: ui.u }); // bosses (v3.1): the cloud comes into view
  drawBossRings(ctx, sim, k, t); // bosses (v3.1): frost, ice patches, walls, telegraphs on the rings
  drawSalHeat(ctx, sim, k, t); // v3.2: red-hot ring sections and the salamander's target mark
  drawP2Back(ctx, sim, k, t); // v3.4: live ring, scorched sponge, iron bars, brittle thorns, blackout, laser beak
  drawBossActor(ctx, sim, k, t);
  drawThiefDens(ctx, sim, t, k); // v3.6: the weasel's den and the rats' hole in the floor ring
  for (const ring of sim.rings) if (ring.gearOut) W.drawGearCog(ctx, ring, ring.gearOut, t);
  // gear trains: while the player turns one ring, the rings it drives show which way they go; the first time
  // ever, a label says so
  for (const ring of sim.rings) {
    if (!ring.gear) continue;
    const driven = ring.follower && ring.gear.some((r) => r.held || r.keyHeld) && Math.abs(ring.omega) > 0.2;
    ring.gearArr = Math.max(0, Math.min(1, (ring.gearArr || 0) + (driven ? 0.12 : -0.06)));
    if (driven) ring.gearDir = Math.sign(ring.omega);
    W.drawGearArrow(ctx, ring, ring.gearDir || 1, ring.gearArr * 0.85, t);
    if (driven && !save.seen.gears && G.screen === 'play') {
      save.seen.gears = 1;
      persist();
      popup(0, sim.outerR + 0.6, 'Geared!', { sub: 'linked rings turn the other way', color: '#ffd36b', size: 20, life: 2.4 });
    }
  }
  if (sim.wx.bolt) { const b = sim.boltPoint(sim.wx.bolt); W.drawBoltWarn(ctx, b.x, b.y, t); }
  W.drawBarriers(ctx, sim, t, k); // predators (v3)
  // floating orbs: mystery until discovered (F19)
  for (const o of sim.orbs) if (o.alive) flipped(o.x, o.y, (k) => drawOrb(ctx, o.type, 0, 0, 0.2 * k, t, !!save.seen[o.type]));
  drawHenAt(sim, k, t);
  if (G.screen === 'play' || G.screen === 'intro') { if (sim.water) drawRiseGuide(ctx, sim, t); else W.drawDropGuide(ctx, sim.rings[sim.rings.length - 1], sim.nest.getPosition().x, sim.nestW, t); }
  for (const r of sim.rocks) if (r.alive) W.drawRock(ctx, r, G.theme);
  for (const b of sim.bombs) if (b.alive) b.spark = W.drawBomb(ctx, b, t);
  for (const d of sim.debris) W.drawDebris(ctx, d, G.theme);
  W.drawLavaRocks(ctx, sim, k, t); // v3
  W.drawIcicles(ctx, sim, k, t);
  drawMagnetField(ctx, sim, t); // v3.1: a magnetic field look instead of a tether line
  drawBossUnder(ctx, sim, k, t);
  W.drawEagleAt(ctx, sim, t, k, 'back'); // predators (v3): eagle shadow under the eggs
  drawSalamanders(ctx, sim, t, k); // v3.2: the lava salamander walks the floor, under the eggs
  drawFrogTele(ctx, sim, k, t); // v3.3: the frog's hop mark, then the frog itself (eggs land on it)
  { const wx = warpXfBegin(ctx, sim, 'f'); drawFrogs(ctx, sim, t, k, G.theme); warpXfEnd(ctx, wx); }
  { const wx = warpXfBegin(ctx, sim, 'o'); drawSeaUnder(ctx, sim, t, k, G.theme); warpXfEnd(ctx, wx); } // v3.3: fish, ink, the octopus (the arms behind a held egg)
  drawReefUnder(ctx, sim, t, k, G.theme); // world 8: bubbles, hermit crabs, puffers, jellyfish, the King Crab
  drawThieves(ctx, sim, t, k); // v3.6: the weasel and the rats on the ring floor
  drawClockworkTele(ctx, sim, t, k); drawClockwork(ctx, sim, t, k); // v4: webs, spring jacks, wind-up beetles, spiders
  drawBayou(ctx, sim, t, k); // v3.7: gators and snapping turtles on the channel floor (eggs roll over them)
  for (const e of sim.aliveEggs()) drawEggFelt(e, t, k); // v3.2: chick kinds, tinted eggs; game feel: through the egg's squash
  drawChickFX(ctx, sim, t, k);
  { const wx = warpXfBegin(ctx, sim, 'o'); drawSeaOver(ctx, sim, t, k); warpXfEnd(ctx, wx); } // v3.3: the arms wrapped over a held egg
  drawReefOver(ctx, sim, t, k); // world 8: claws over a held egg, the silt cloud
  if (sim.water) drawBoat(ctx, sim, t, k); // world 8: the boat on the surface, over the hen's legs
  drawThievesOver(ctx, sim, t, k); // v3.6: the weasel's jaws over a held egg, the trap ring
  drawBayouOver(ctx, sim, t, k); // v3.7: a turtle's beak round its egg, mosquito swarms
  W.drawSnakes(ctx, sim, t, k); // predators (v3)
  for (const m of sim.embers) W.drawEmber(ctx, m, t);
  drawBossOver(ctx, sim, k, t); // bosses (v3.1): icicles, thrown orbs, fog, gale streaks
  { const wx = warpXfBegin(ctx, sim, 'e'); W.drawEagleAt(ctx, sim, t, k); warpXfEnd(ctx, wx); }
  drawAllies(ctx, sim, t, k); // v3.4: rooster and goose, in front of the vault
  drawP2Front(ctx, sim, k, t); // v3.4: decoy, frozen/zapped creatures, beams, spin, pepper cloud
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
  if (fx.flash > 0 && !save.calm && fx.flashColor === 'clap') {
    // thunderclap: one frame of deep blue darkness, then a quick pale-yellow light around where the bolt landed (radial, never the whole screen)
    const p = fx.flash / 0.7;
    if (p > 0.86) { ctx.globalAlpha = 0.4; ctx.fillStyle = '#0a1446'; ctx.fillRect(0, 0, W_, H_); }
    else {
      const c = toScreen(0, G.sim ? G.sim.outerR * 0.45 : 0), R = Math.min(W_, H_) * 0.55;
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, R);
      g.addColorStop(0, `rgba(255,244,190,${0.4 * p})`); g.addColorStop(0.55, `rgba(255,230,120,${0.12 * p})`); g.addColorStop(1, 'rgba(255,214,70,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(c.x - R, c.y - R, R * 2, R * 2);
    }
    ctx.globalAlpha = 1;
  } else if (fx.flash > 0 && !save.calm) {
    ctx.globalAlpha = fx.flash * 0.6;
    ctx.fillStyle = fx.flashColor;
    ctx.fillRect(0, 0, W_, H_);
    ctx.globalAlpha = 1;
  }


  // UI
  if (G.screen !== 'title' && G.screen !== 'levels' && G.screen !== 'store') drawHUD();
  if (G.screen === 'play') drawFlyers(); // prizes on their way to the HUD
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
  const seat = sim.water ? boatSeat(sim, t) : null; // world 8: she rides in the boat
  const hx = seat ? seat.x : n.x + sim.nestW / 2 + 0.6 + (s - 0.95) / 2;
  ctx.save();
  ctx.translate(hx, seat ? seat.y : sim.groundY);
  ctx.scale(1 / k, -1 / k);
  // she stands ON the ground: a soft contact shadow and a little straw she has scratched out of the nest
  const hs = s * k;
  ctx.save();
  if (!ANIMATED_HEN) { ctx.fillStyle = 'rgba(0,0,0,0.26)'; ctx.beginPath(); ctx.ellipse(0, 0, hs * 0.36, hs * 0.075, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = G.theme?.palette?.nestStraw || '#c9a24a'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1, hs * 0.022);
  if (!seat) for (const [a, b, c] of [[-0.42, -0.02, -0.22], [-0.3, 0.01, -0.05], [0.18, -0.01, 0.4], [0.3, 0.02, 0.5]]) {
    ctx.beginPath(); ctx.moveTo(a * hs, b * hs); ctx.lineTo(c * hs, b * hs - hs * 0.03); ctx.stroke();
  }
  ctx.restore();
  if (ANIMATED_HEN) {
    // M7: she shuffles toward the egg that is about to land (never off her patch) and reacts to every event herself
    let look = 0;
    for (const e of sim.eggs) {
      if (!e.alive || e.saved) continue;
      const p = e.body.getPosition(), l = -clamp(1.5 - ((p.y - sim.groundY) * (sim.gy || 1)) / 5, 0, 1) * (Math.abs(p.x - n.x) < 2.4 ? 1 : 0.3); // toward the nest as an egg nears the exit
      if (l < look) look = l;
    }
    drawHenActor(ctx, G.hen.mood, 0, -0.49 * hs, hs, t, { key: 'level', n: G.hen.n, look: G.screen === 'play' ? look : 0, danger: G.danger, shadow: 0.26 });
    ctx.restore();
    return;
  }
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
  const base = G.sim && G.sim.water ? Math.PI / 2 : -Math.PI / 2; // world 8: underwater the exit is at the top
  const R = ringReach(ring) + 0.22, a0 = base - (h.dir * h.amt) / 2, a1 = base + (h.dir * h.amt) / 2;
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
  ctx.save();
  ctx.globalAlpha = a; ui.aBase = a;
  const k = ui.pop(c.t, 0.22);
  if (k !== 1) { ctx.translate(W_ / 2, y + h / 2); ctx.scale(k, k); ctx.translate(-W_ / 2, -(y + h / 2)); }
  ui.glass(x, y, w, h, { r: 16 * u, border: info.color, lw: 2.5 * u, a: 'rgba(58,36,20,0.95)', b: 'rgba(26,15,8,0.95)', record: true, tag: 'card', group: 'card' });
  drawPowerCard(ctx, c.id, x + 6 * u, y, icon * 2, h, G.t, ui);
  const tx = x + icon + 16 * u;
  ui.text(info.name, tx, y + 10 * u + 12 * u, { size: 22 * u, color: info.color, stroke: 'rgba(0,0,0,0.6)', maxW: w - icon - 26 * u, tag: 'card:name', group: 'card' });
  lines.forEach((l, i) => ui.text(l, tx, y + 40 * u + lineS * 1.25 * (i + 0.5), { size: lineS, color: '#fff', maxW: w - icon - 26 * u, tag: 'card:l' + i, group: 'card' }));
  ui.aBase = 1;
  ctx.restore();
}

function dim(a = 0.55) {
  ctx.fillStyle = `rgba(24,12,5,${a})`;
  ctx.fillRect(0, 0, W_, H_);
}

// ---- allies (v3.5): one call per attempt, Rooster or Goose
const allyKinds = () => (G.sim && G.sim.ally ? G.sim.ally.avail : []);
function allyShown() {
  const A = G.sim && G.sim.ally;
  return !!(A && G.sim.state === 'play' && A.avail.length && !A.act && !A.used.rooster && !A.used.goose);
}
const gooseIcon = (c, x, y, s) => { // a white goose head on its neck, orange beak
  c.save(); c.lineJoin = 'round'; c.lineWidth = Math.max(1.5, s * 0.07); c.strokeStyle = '#4a2a12';
  c.fillStyle = '#fffaf0';
  c.beginPath(); c.moveTo(x - 0.26 * s, y + 0.5 * s); c.quadraticCurveTo(x - 0.3 * s, y + 0.1 * s, x - 0.2 * s, y - 0.1 * s); c.lineTo(x + 0.14 * s, y + 0.06 * s); c.quadraticCurveTo(x + 0.06 * s, y + 0.3 * s, x + 0.12 * s, y + 0.5 * s); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#f59a1c'; c.beginPath(); c.moveTo(x + 0.18 * s, y - 0.16 * s); c.lineTo(x + 0.56 * s, y - 0.02 * s); c.lineTo(x + 0.2 * s, y + 0.1 * s); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#fffaf0'; c.beginPath(); c.arc(x - 0.03 * s, y - 0.1 * s, 0.3 * s, 0, 7); c.fill(); c.stroke();
  c.fillStyle = '#2a1608'; c.beginPath(); c.arc(x + 0.08 * s, y - 0.14 * s, 0.055 * s, 0, 7); c.fill();
  c.restore();
};
const allyFree = () => G.sim.mode === 'easy' || !!G.fails[G.level.id];
const allyIcon = (c, x, y, s) => { // a little rooster head: red comb, orange beak, white face, wattle
  c.save(); c.lineJoin = 'round'; c.lineWidth = Math.max(1.5, s * 0.07); c.strokeStyle = '#4a2a12';
  c.fillStyle = '#e8402e';
  for (const [dx, dy, r] of [[-0.2, -0.3, 0.15], [0, -0.38, 0.18], [0.2, -0.3, 0.15]]) { c.beginPath(); c.arc(x + dx * s, y + dy * s, r * s, 0, 7); c.fill(); c.stroke(); }
  c.beginPath(); c.ellipse(x + 0.2 * s, y + 0.3 * s, 0.1 * s, 0.15 * s, 0, 0, 7); c.fill(); c.stroke();
  c.fillStyle = '#f59a1c'; c.beginPath(); c.moveTo(x + 0.26 * s, y - 0.08 * s); c.lineTo(x + 0.58 * s, y + 0.04 * s); c.lineTo(x + 0.26 * s, y + 0.16 * s); c.closePath(); c.fill(); c.stroke();
  const g = c.createRadialGradient(x - 0.1 * s, y - 0.1 * s, 0.02 * s, x, y, 0.36 * s);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#f3e2c2');
  c.fillStyle = g; c.beginPath(); c.arc(x, y + 0.02 * s, 0.34 * s, 0, 7); c.fill(); c.stroke();
  c.fillStyle = '#2a1608'; c.beginPath(); c.arc(x + 0.1 * s, y - 0.05 * s, 0.06 * s, 0, 7); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(x + 0.12 * s, y - 0.07 * s, 0.02 * s, 0, 7); c.fill();
  c.restore();
};
// the ally button sits in the zoom strip (bottom left in portrait, bottom of the right column in landscape); the choice opens beside or above it
function drawAllyBtn() {
  if (!allyShown()) { G.allyOpen = false; return; }
  const { bs, pad, side } = G.zb, u = ui.u, gap = 8 * u;
  const x = side ? W_ - pad - bs : pad, y = H_ - 6 * u - bs;
  const free = allyFree() || G.allyAd, kinds = allyKinds(), can = kinds.some((k) => G.sim.allyCan(k));
  if (!can) G.allyOpen = false;
  if (can && !G.allyOpen && !save.calm) { // a slow ring says "help is here" without nagging
    const p = (G.t * 0.55) % 1;
    ui.roundRect(x - 5 * u * p, y - 5 * u * p, bs + 10 * u * p, bs + 10 * u * p, 15 * u + 5 * u * p);
    ctx.lineWidth = 2.5 * u; ctx.strokeStyle = `rgba(255,224,120,${0.7 * (1 - p)})`; ctx.stroke();
  }
  ui.button('ally', '', x, y, bs, bs, { kind: 'gold', icon: allyIcon, iconS: 1.45, disabled: !can, round: 15 * u });
  if (!free && can) drawAdBadge(ctx, x + bs - 21 * u, y + bs - 15 * u, 22 * u, 16 * u);
  if (!G.allyOpen) return;
  const cw = 124 * u, ch = 46 * u;
  kinds.forEach((k, i) => {
    const bx = side ? x - gap - cw : x, by = y - (ch + gap) * (side ? kinds.length - 1 - i : kinds.length - i) + (side ? bs - ch : 0);
    ui.button('ally:' + k, k === 'rooster' ? 'Rooster' : 'Goose', bx, by, cw, ch, { kind: k === 'rooster' ? 'red' : 'secondary', size: 17 * u, iconS: 1.3, icon: k === 'rooster' ? allyIcon : gooseIcon, disabled: !G.sim.allyCan(k) });
  });
}

function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

// HUD (2026-11 premium pass). No flat plate: a soft scrim in the world's own tint, and on it dark glass chips with
// bold numerals. Top row: pause, the level badge and name, the score. Second row (one row on a wide screen): the egg
// tray with saved/needed, and the fuse clock. The boss bar sits in an iron housing under it.
const HUDS = { score: 0, bump: 0, lv: null };
function hudClock(cx, cy, r, low, frac) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx, cy + r * 0.12, r, 0, 7); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fillStyle = low ? '#ff5a3c' : '#ffb52e'; ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.16); ctx.strokeStyle = '#3a1c08'; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.68, 0, 7); ctx.fillStyle = '#fff8e6'; ctx.fill();
  // the time left as a pie, like the fuse round the vault
  if (frac > 0 && frac < 1) { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r * 0.68, -Math.PI / 2, -Math.PI / 2 + (1 - frac) * Math.PI * 2); ctx.closePath(); ctx.fillStyle = low ? 'rgba(255,90,60,0.5)' : 'rgba(120,80,40,0.28)'; ctx.fill(); }
  const a = -Math.PI / 2 + (1 - frac) * Math.PI * 2;
  ctx.strokeStyle = '#3a1c08'; ctx.lineWidth = Math.max(1.5, r * 0.17);
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - r * 0.3, cy - r * 1.18); ctx.lineTo(cx + r * 0.3, cy - r * 1.18); ctx.stroke();
  ctx.restore();
}
function drawHUD() {
  const u = ui.u;
  const sim = G.sim;
  const pal = G.theme.palette;
  const twoRows = W_ < 760;
  const pad = 12 * u;
  const bs = 46 * u;
  ui.calm = save.calm;
  // scrim: the world's plate tint, fading out under the HUD
  const plate = /^rgba\(/.test(pal.plate || '') ? pal.plate : 'rgba(20,14,10,0.55)';
  const al = (a) => plate.replace(/[\d.]+\)$/, a + ')');
  const g = ctx.createLinearGradient(0, 0, 0, G.hudBottom + 12 * u);
  g.addColorStop(0, al(0.82)); g.addColorStop(0.7, al(0.5)); g.addColorStop(1, al(0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W_, G.hudBottom + 12 * u);
  const row1 = pad + bs / 2;
  ui.button('pause', '', pad, pad, bs, bs, { kind: 'hud', icon: ICON.pause, iconS: 1.25, round: 15 * u });
  // score chip (right)
  const st = sim.stats();
  const scoreTxt = String(st.score);
  const scoreSize = 24 * u, lblS = 11 * u;
  if (HUDS.lv !== G.run) { HUDS.lv = G.run; HUDS.score = st.score; HUDS.bump = 0; }
  if (st.score !== HUDS.score) { HUDS.bump = st.score > HUDS.score ? 1 : 0; HUDS.score = st.score; }
  HUDS.bump *= 0.88;
  const scoreW = Math.max(ui.measure(scoreTxt, scoreSize), ui.measure('000', scoreSize));
  const lblW = ui.measure('SCORE', lblS);
  const chipH = 36 * u, chipW = 13 * u + lblW + 7 * u + scoreW + 14 * u, chipX = W_ - pad - chipW;
  ui.glass(chipX, row1 - chipH / 2, chipW, chipH);
  ui.text('SCORE', chipX + 13 * u, row1 + 1 * u, { size: lblS, color: 'rgba(255,232,196,0.85)', tag: 'hud:scoreLabel' });
  ctx.save();
  if (HUDS.bump > 0.02 && !save.calm) { const k = 1 + 0.22 * HUDS.bump, px = W_ - pad - 14 * u; ctx.translate(px, row1); ctx.scale(k, k); ctx.translate(-px, -row1); }
  ui.num(scoreTxt, W_ - pad - 14 * u, row1, { size: scoreSize, align: 'right', tag: 'hud:score' });
  ctx.restore();
  const leftEdge = pad + bs + 8 * u;
  const rightEdge = chipX - 8 * u;
  // tray + timer content
  const slots = Math.max(G.level.eggs, sim.eggs.length);
  const icon = 26 * u * Math.min(1, 4.5 / slots);
  const traySpace = icon * 0.9;
  const states = [];
  for (const e of sim.eggs) if (!e.fled) states.push(e.saved ? 'saved' : e.alive ? 'alive' : 'broken'); // a fled chick leaves the tray
  while (states.length < slots) states.push('empty');
  const trayW = slots * traySpace;
  const met = st.saved >= st.target;
  const needTxt = `${st.saved}/${st.target}`, needS = 18 * u;
  const needW = ui.measure(needTxt.replace(/\d/g, '0'), needS);
  const pillH = 34 * u;
  const trayPillW = 10 * u + trayW + 9 * u + needW + 13 * u;
  const timeTxt = sim.timeLimit ? fmtTime(sim.timeLeft) : '';
  const timeS = 21 * u;
  const timeW = timeTxt ? ui.measure(timeTxt.replace(/\d/g, '0'), timeS) : 0;
  const timePillW = timeTxt ? 8 * u + 22 * u + 5 * u + timeW + 13 * u : 0;
  const groupW = trayPillW + (timeTxt ? 8 * u + timePillW : 0);
  // level badge + name
  const isLv = G.li >= 0, nameS = 17 * u, bd = 26 * u;
  let trayX, trayY, lvlMax, lvlCx = null;
  if (twoRows) {
    lvlMax = rightEdge - leftEdge; lvlCx = (leftEdge + rightEdge) / 2;
    trayY = pad + bs + 9 * u + pillH / 2;
  } else {
    lvlMax = Math.max(60 * u, (W_ / 2 - groupW / 2) - leftEdge - 12 * u);
    trayY = row1;
  }
  trayX = W_ / 2 - groupW / 2;
  {
    const inner = lvlMax - (isLv ? 4 * u + bd + 6 * u : 13 * u) - 13 * u;
    const nw = Math.min(ui.measure(G.level.name, nameS), Math.max(20 * u, inner));
    const pw = (isLv ? 4 * u + bd + 6 * u : 13 * u) + nw + 13 * u;
    const px = lvlCx == null ? leftEdge : lvlCx - pw / 2;
    ui.glass(px, row1 - pillH / 2, pw, pillH);
    let tx = px + 13 * u;
    if (isLv) {
      const bx = px + 4 * u + bd / 2, acc = /^#[0-9a-f]{6}$/i.test(pal.accent || '') ? pal.accent : '#ffb52e';
      ctx.beginPath(); ctx.arc(bx, row1, bd / 2, 0, 7);
      const bg = ctx.createLinearGradient(0, row1 - bd / 2, 0, row1 + bd / 2);
      bg.addColorStop(0, ui.tint(acc, 0.3)); bg.addColorStop(1, ui.tint(acc, -0.12));
      ctx.fillStyle = bg; ctx.fill();
      ctx.lineWidth = 1.5 * u; ctx.strokeStyle = ui.tint(acc, -0.62); ctx.stroke();
      const nt = String(G.level.id);
      ui.text(nt, bx, row1, { size: (nt.length > 1 ? 13 : 15) * u, align: 'center', color: '#fff', stroke: ui.tint(acc, -0.62), strokeW: 3 * u, tag: 'hud:levelNum', group: 'hud:level' });
      tx = px + 4 * u + bd + 6 * u;
    }
    ui.text(G.level.name, tx, row1 + 0.5 * u, { size: nameS, maxW: nw + 1, color: '#fff', stroke: 'rgba(30,14,4,0.7)', strokeW: 3 * u, tag: 'hud:level', group: 'hud:level' });
  }
  // egg tray: every egg of the level, then saved / needed
  ui.glass(trayX, trayY - pillH / 2, trayPillW, pillH, met ? { a: 'rgba(52,96,36,0.92)', b: 'rgba(26,58,18,0.92)', border: 'rgba(190,255,150,0.6)' } : {});
  const ex0 = trayX + 10 * u;
  states.forEach((s, i) => {
    const e = sim.eggs[i];
    drawEggIcon(ctx, ex0 + traySpace * (i + 0.5), trayY, icon, s, e ? e.cracks : 0);
  });
  ui.record({ x: ex0, y: trayY - icon / 2, w: trayW, h: icon }, 'hud:tray');
  ctx.fillStyle = 'rgba(255,232,196,0.3)';
  ctx.fillRect(ex0 + trayW + 3.5 * u, trayY - pillH * 0.28, 1.5 * u, pillH * 0.56);
  ui.text(needTxt, ex0 + trayW + 9 * u, trayY + 0.5 * u, { size: needS, color: met ? '#b9ff9a' : '#fff', stroke: 'rgba(30,14,4,0.7)', strokeW: 3 * u, tag: 'hud:need' });
  if (timeTxt) {
    const tx = trayX + trayPillW + 8 * u;
    const low = sim.timeLeft <= 10;
    ctx.save();
    if (low && !save.calm) { const k = 1 + 0.05 * Math.sin(G.t * 12), cx = tx + timePillW / 2; ctx.translate(cx, trayY); ctx.scale(k, k); ctx.translate(-cx, -trayY); }
    ui.glass(tx, trayY - pillH / 2, timePillW, pillH, low ? { a: 'rgba(196,52,30,0.95)', b: 'rgba(120,22,10,0.95)', border: 'rgba(255,190,160,0.8)' } : {});
    hudClock(tx + 8 * u + 11 * u, trayY + 1 * u, 10 * u, low, sim.timeLeft / sim.timeLimit);
    ui.record({ x: tx + 8 * u, y: trayY - 11 * u, w: 22 * u, h: 22 * u }, 'hud:clock', 'hud:time');
    ui.text(timeTxt, tx + 8 * u + 22 * u + 5 * u, trayY + 0.5 * u, { size: timeS, color: low ? '#fff2c0' : '#fff', stroke: 'rgba(30,14,4,0.75)', strokeW: 3.2 * u, tag: 'hud:time', group: 'hud:time' });
    ctx.restore();
  }
  if (G.bossBar && sim.bx && sim.bx.boss) {
    // iron housing with a warm trim: the boss bar reads as its own piece of kit
    const bx = pad, by = G.hudBottom - G.bossBar + 2 * u, bw = W_ - 2 * pad, bh = G.bossBar - 8 * u, m = 3 * u;
    ui.roundRect(bx - m, by - m + 2.5 * u, bw + 2 * m, bh + 2 * m, bh);
    ctx.fillStyle = 'rgba(10,2,0,0.3)'; ctx.fill();
    ui.roundRect(bx - m, by - m, bw + 2 * m, bh + 2 * m, bh);
    const hg = ctx.createLinearGradient(0, by - m, 0, by + bh + m);
    hg.addColorStop(0, '#7a2a26'); hg.addColorStop(1, '#3a100e');
    ctx.fillStyle = hg; ctx.fill();
    ctx.lineWidth = 1.5 * u; ctx.strokeStyle = 'rgba(255,206,140,0.75)'; ctx.stroke();
    drawBossBar(ctx, ui, sim, bx, by, bw, bh, G.t);
  }
  if (G.screen === 'play' && sim.state === 'play') { drawZoomBtns(); drawAllyBtn(); }
}

// zoom -, +, and auto (only while the player has overridden auto zoom), in the strip computeLayout keeps clear of the vault
function drawZoomBtns() {
  const { bs, pad, side } = G.zb, P = G.play, u = ui.u, gap = 8 * u;
  const items = [['zoom:in', ICON.zoom(true), ''], ['zoom:out', ICON.zoom(false), '']];
  if (G.zm != null) items.push(['zoom:auto', null, 'auto']);
  items.forEach(([id, icon, label], i) => {
    const x = side ? W_ - pad - bs : W_ - pad - bs * (i + 1) - gap * i;
    const y = side ? P.y + (P.h - (bs * 3 + gap * 2)) / 2 + (bs + gap) * i : H_ - 6 * u - bs;
    ui.button(id, label, x, y, bs, bs, { kind: 'hud', icon, iconS: 1.3, size: label ? 13 * u : undefined, round: 15 * u });
  });
}

function drawPopups() {
  const placed = [];
  for (const p of G.popups) {
    const a = Math.min(1, p.life / 0.4);
    const size = p.size * (p.life > p.max - 0.15 ? 1 + (p.life - (p.max - 0.15)) * 3 : 1);
    const subS = 14 * ui.u;
    const h = size + (p.sub ? subS + 2 : 0);
    const minY = Math.max(G.hudBottom, G.toast ? G.toastBottom || 0 : 0) + 8 * ui.u + h / 2;
    let y = Math.max(p.y, minY);
    const w = Math.min(W_ - 16, Math.max(ui.measure(p.text, size), p.sub ? ui.measure(p.sub, subS) : 0)); // the sub line can be the wider one
    const edge = 12 * ui.u + size * 0.15; // v3.7: the outline stroke and the pop-in grow past the measured width; keep it all on screen
    const x = w + 2 * edge >= W_ ? W_ / 2 : clamp(p.x, w / 2 + edge, W_ - w / 2 - edge);
    // v3.1: never overlap an older popup: step above it, or below the whole stack when there is no room above.
    // The new spot sticks (p.y), so labels don't jump back and forth from frame to frame.
    const hit = (yy) => placed.find((q) => Math.abs(q.x - x) < (q.w + w) / 2 + 6 && Math.abs(q.y - yy) < (q.h + h) / 2 + 4);
    let down = false;
    for (let tries = 0, q; tries < 16 && (q = hit(y)); tries++) {
      if (!down) { y = q.y - (q.h + h) / 2 - 5; if (y < minY) { down = true; y = minY; } }
      else y = q.y + (q.h + h) / 2 + 5;
    }
    p.y = y;
    placed.push({ x, y, w, h });
    ui.text(p.text, x, y, { size, align: 'center', color: p.color, stroke: 'rgba(40,18,4,0.85)', strokeW: Math.max(3, size * 0.2), shadow: 'rgba(40,18,4,0.85)', alpha: a, tag: 'popup:' + p.text + placed.length, group: 'popup' + placed.length });
    if (p.sub) ui.text(p.sub, x, y + size / 2 + subS / 2 + 2, { size: subS, align: 'center', color: '#fff', stroke: 'rgba(40,18,4,0.8)', alpha: a, maxW: W_ - 16, tag: 'popupsub' + placed.length, group: 'popup' + placed.length });
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
  const lines = wrapText(T.text, size, maxW - 32 * u);
  const h = lines.length * size * 1.3 + 18 * u;
  const w = Math.min(maxW, Math.max(...lines.map((l) => ui.measure(l, size))) + 32 * u);
  const x = W_ / 2 - w / 2, y = G.hudBottom + 10 * u;
  ctx.save();
  ctx.globalAlpha = a; ui.aBase = a;
  const k = ui.pop(age, 0.22);
  if (k !== 1) { ctx.translate(W_ / 2, y + h / 2); ctx.scale(k, k); ctx.translate(-W_ / 2, -(y + h / 2)); }
  ui.glass(x, y, w, h, { r: Math.min(h / 2, 18 * u), a: 'rgba(58,36,20,0.94)', b: 'rgba(28,16,8,0.94)', border: 'rgba(255,224,160,0.6)', record: true, tag: 'toast', group: 'toast' });
  lines.forEach((l, i) => ui.text(l, W_ / 2, y + 9 * u + size * 1.3 * (i + 0.5), { size, align: 'center', color: '#fff8e8', group: 'toast', tag: 'toast:' + i }));
  ui.aBase = 1;
  ctx.restore();
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

// Level 1, before the first save: a gloved hand drags the inner ring back and forth along a dashed arc.
function drawKeyHint() {
  if (G.level.id !== 1 || G.sim.savedLog.length > 0 || G.held.size) return;
  const r = G.sim.rings[0];
  const c = toScreen(0, 0);
  const R = r.r * G.cam.k, u = ui.u;
  const sw = Math.sin(G.t * 1.6);
  const a0 = -Math.PI * 0.75, a = a0 + sw * 0.6;
  const x = c.x + Math.cos(a) * R, y = c.y + Math.sin(a) * R;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [lw, col] of [[6 * u, 'rgba(40,18,4,0.55)'], [3 * u, '#fff']]) {
    ctx.beginPath(); ctx.arc(c.x, c.y, R, a0 - 0.6, a0 + 0.6);
    ctx.strokeStyle = col; ctx.setLineDash([7 * u, 8 * u]); ctx.lineWidth = lw; ctx.stroke();
  }
  ctx.setLineDash([]);
  // the hand: a pointing glove, tilted, pressing a little as it changes direction
  const press = 1 - 0.08 * Math.abs(Math.cos(G.t * 1.6));
  ctx.translate(x, y); ctx.rotate(-0.35); ctx.scale(u * press, u * press);
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, 7); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
  const hand = () => {
    ctx.beginPath();
    ctx.moveTo(-5, 2); ctx.lineTo(-5, 22); ctx.quadraticCurveTo(-5, 27, 0, 27);
    ctx.lineTo(13, 27); ctx.quadraticCurveTo(20, 27, 20, 20); ctx.lineTo(20, 13); ctx.quadraticCurveTo(20, 9, 16, 9);
    ctx.lineTo(5, 8); ctx.lineTo(5, 2); ctx.quadraticCurveTo(5, -4, 0, -4); ctx.quadraticCurveTo(-5, -4, -5, 2); ctx.closePath();
  };
  ctx.translate(0, 3); hand(); ctx.fillStyle = 'rgba(40,18,4,0.35)'; ctx.fill(); ctx.translate(0, -3);
  hand(); ctx.fillStyle = '#fffdf6'; ctx.fill(); ctx.lineWidth = 2.6; ctx.strokeStyle = '#4a2a12'; ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(74,42,18,0.5)';
  ctx.beginPath(); ctx.moveTo(10, 10); ctx.lineTo(10, 16); ctx.moveTo(15, 11); ctx.lineTo(15, 16); ctx.stroke();
  ctx.restore();
}

// Centered card used by intro/pause/win/fail: a cream card in a wooden frame with a ribbon header. Content is a
// vertical stack of blocks built for a scale s (pixels per design unit). The stack is measured first; if it is
// taller than the room below the HUD, everything is rebuilt at a smaller scale, so blocks can never overlap.
// build(s, w) returns [{ h, gap?, draw(x, y, w) }]; w is the card's inner width.
// o.ribbon: header colour; the card pops in with the screen (o.dx / o.dy: it slides instead, the win card).
const CARD_HEAD = 50;
function stackCard(title, build, o = {}) {
  const u = ui.u;
  ui.calm = save.calm;
  const top = G.hudBottom + 16 * u; // the ribbon stands 8 units proud of the card
  const avail = H_ - top - 14 * u; // and the base lip 5 below
  const measure = (s) => {
    const w = Math.min(o.maxW || W_ - 32 * u, 420 * s);
    const blocks = build(s, w - 48 * s);
    const h = CARD_HEAD * s + blocks.reduce((a, b) => a + (b.gap ?? 10 * s) + b.h, 0) + 22 * s;
    return { s, w, blocks, h };
  };
  let m = measure(u);
  // a narrower card wraps its text into more lines, so one rescale can still be too tall: step down until it fits
  for (let n = 0; n < 4 && m.h > avail + 0.5 && m.s > u * 0.45; n++) m = measure(Math.max(u * 0.45, m.s * Math.min(0.97, avail / m.h)));
  const { s, w, blocks } = m;
  const h = Math.min(m.h, avail);
  const x = (o.cx || W_ / 2) - w / 2;
  const y = Math.max(top, (H_ + G.hudBottom) / 2 - h / 2);
  // o.hidden: lay out only (each block's at(x, y, w) learns where it will sit); o.dx / o.dy: slide the card (win card entrance)
  if (o.hidden) {
    let cy = y + CARD_HEAD * s;
    for (const b of blocks) { cy += b.gap ?? 10 * s; if (b.at) b.at(x + 24 * s, cy, w - 48 * s); cy += b.h; }
    return { x, y, w, h, s };
  }
  ctx.save();
  if (o.dx || o.dy) ctx.translate(o.dx || 0, o.dy || 0);
  else if (o.pop !== false) {
    const k = ui.pop(G.screenT, 0.32);
    if (k !== 1) { ctx.translate(x + w / 2, y + h / 2); ctx.scale(k, k); ctx.translate(-(x + w / 2), -(y + h / 2)); }
  }
  ui.frame(x, y, w, h, { s, r: 24 * s });
  const rw = clamp(ui.measure(title, 24 * s) + 56 * s, w * 0.6, w - 14 * s);
  ui.ribbon(title, x + w / 2, y - 8 * s, rw, 40 * s, { s, color: o.ribbon || '#ee5a36', size: 24 * s, tag: 'card:title' });
  let cy = y + CARD_HEAD * s;
  for (const b of blocks) {
    cy += b.gap ?? 10 * s;
    if (b.at) b.at(x + 24 * s, cy, w - 48 * s);
    b.draw(x + 24 * s, cy, w - 48 * s);
    cy += b.h;
  }
  ctx.restore();
  return { x, y, w, h, s };
}

// one centered line of text as a stack block (brown ink on the cream card)
const lineBlock = (str, size, o = {}) => ({
  h: size * 1.25, gap: o.gap,
  draw: (x, y, w) => ui.text(str, x + w / 2, y + size * 0.62, { size, align: 'center', maxW: w, color: ui.C.ink, ...o }),
});

// Easy / Medium / Hard (F32), as one segmented control: a recessed track, the chosen mode a raised green key.
// dark: on the scene (glass track, white ink) instead of on a cream card.
function modeRow(x, y, w, h, s, dark) {
  const p = 3 * s, bw = (w - 2 * p) / 3;
  if (dark) ui.glass(x, y, w, h, { r: h / 2 });
  else ui.well(x, y, w, h, { r: h / 2, s });
  MODE_LIST.forEach((m, i) => {
    const on = save.mode === m, label = m[0].toUpperCase() + m.slice(1), size = Math.min(16 * s, h * 0.42);
    const hit = { x: x + p + i * bw, y, w: bw, h };
    if (on) ui.button('mode:' + m, label, x + p + i * bw, y + p, bw, h - 2 * p - 1 * s, { kind: 'primary', round: h / 2, size, hit });
    else ui.button('mode:' + m, label, x + p + i * bw, y + p, bw, h - 2 * p, { ghost: true, textColor: dark ? 'rgba(255,244,222,0.9)' : ui.C.ink2, size, hit });
  });
}

// a dark stage inside a card for art that glows (chicks, salamander, clockwork)
function artStage(x, y, w, h, s, draw) {
  ui.well(x, y + 2 * s, w, h - 4 * s, { s, r: 14 * s, a: '#31476e', b: '#1b2742', border: 'rgba(40,24,10,0.7)', shade: 'rgba(0,0,10,0.45)' });
  draw();
}

// the boss's portrait hangs in a dark red hall with slow rays: this one is different
function bossStage(x, y, w, h, s) {
  ui.well(x, y + 2 * s, w, h - 6 * s, { s, r: 14 * s, a: '#6a1830', b: '#2c0a1c', border: 'rgba(40,10,10,0.8)', shade: 'rgba(0,0,0,0.5)',
    paint: () => sunburst(x + w / 2, y + h / 2, w * 0.7, 'rgba(255,120,90,0.13)') });
}

function drawIntro() {
  dim(0.42);
  const L = G.level, C = ui.C;
  const acc = /^#[0-9a-f]{6}$/i.test(G.theme.palette.accent || '') ? G.theme.palette.accent : '#ee5a36';
  if (L.intro && !save.intro[L.id]) {
    // a world's new mechanic gets one screen of its own the first time (C6); a boss also shows its face (I6)
    stackCard(L.intro.title, (s, iw) => [
      ...(L.boss ? [{ h: 190 * s, gap: 0, draw: (x, y, w) => { bossStage(x, y, w, 190 * s, s); bossPortrait(ctx, L.boss, x, y, w, 190 * s, G.t); } }] : []),
      ...(L.intro.chick ? [{ h: 104 * s, gap: 0, draw: (x, y, w) => artStage(x, y, w, 104 * s, s, () => chickIntroArt(L.intro.chick, x, y, w, 104 * s)) }] // v3.2: meet the chick kind
        : L.intro.cw ? [{ h: 100 * s, gap: 0, draw: (x, y, w) => artStage(x, y, w, 100 * s, s, () => drawCwIntro(ctx, L.intro.cw, x, y, w, 100 * s, G.t)) }] // v4: meet the clockwork creature
        : !L.boss && L.salamander ? [{ h: 96 * s, gap: 0, draw: (x, y, w) => artStage(x, y, w, 96 * s, s, () => salIntroArt(x, y, w, 96 * s)) }] : []), // v3.2: meet the salamander
      ...wrapText(L.intro.line, 17 * s, iw).slice(0, 4).map((l, i) => lineBlock(l, 17 * s, { tag: 'wintro:' + i, gap: i ? 2 * s : 8 * s })),
      { h: 58 * s, gap: 18 * s, draw: (x, y, w) => ui.button('gotit', 'GOT IT', x, y, w, 58 * s, { kind: 'primary', shimmer: true, icon: ICON.play, size: 23 * s }) },
    ], { ribbon: L.boss ? '#c9342c' : acc });
    return;
  }
  stackCard(G.li === -2 ? 'Lab' : G.li < 0 ? `Daily Vault ${today().slice(5)}` : `Level ${L.id}`, (s, iw) => {
    const tip = L.tip ? wrapText(L.tip, 15 * s, iw).slice(0, 3) : [];
    const B = [
      lineBlock(L.name, 23 * s, { tag: 'intro:name', gap: 2 * s }),
      // the goal: the level's eggs in a tray, and how many must get home
      { h: 70 * s, gap: 6 * s, draw: (x, y, w) => {
        ui.well(x, y, w, 70 * s, { s, a: '#dcbb84', b: '#e9d2a2' });
        const n = L.eggs, sp = Math.min(32 * s, (w - 20 * s) / n), es = Math.min(28 * s, sp * 0.95);
        for (let i = 0; i < n; i++) drawEggIcon(ctx, x + w / 2 + (i - (n - 1) / 2) * sp, y + 23 * s, es, 'alive');
        ui.record({ x: x + w / 2 - n * sp / 2, y: y + 9 * s, w: n * sp, h: 28 * s }, 'intro:eggs');
        ui.text(`Save ${L.target} of ${L.eggs} eggs before the fuse burns out`, x + w / 2, y + 53 * s, { size: 14.5 * s, align: 'center', maxW: w - 16 * s, color: C.warn, tag: 'intro:goal' });
      } },
      ...(G.li === -1 ? [lineBlock(dailyBest() ? `Today's best: ${dailyBest()}` : `First win today: +${DAILY_COINS} coins`, 14 * s, { color: C.info, tag: 'intro:daily', gap: 6 * s })] : []),
      ...tip.map((l, i) => lineBlock(l, 15 * s, { color: C.ink2, tag: 'intro:tip' + i, gap: i ? 2 * s : 8 * s })),
      ...(L.bonus ? [lineBlock('Bonus: ' + BONUS_TEXT(L.bonus, G.sim.MD.fuse), 14 * s, { color: C.info, tag: 'intro:bonus', gap: 6 * s })] : []),
      { h: 60 * s, gap: 14 * s, draw: (x, y, w) => ui.button('go', 'PLAY', x, y, w, 60 * s, { kind: 'primary', shimmer: true, icon: ICON.play, size: 25 * s }) },
      // start boosters bought in the store (F7/F21): tap to pick, each shows its one-liner
      { h: 72 * s, gap: 10 * s, draw: (x, y, w) => drawBoosterPicker(ui, ctx, x, y, w, 72 * s, { wallet: G.golden ? { ...save.wallet, owned: { ...save.wallet.owned, golden: 0 } } : save.wallet, selected: G.boostSel, lastTapped: G.boostLast, t: G.t }) },
    ];
    if (!G.adBoost && !G.golden) B.push({ h: 48 * s, draw: (x, y, w) => ui.button('adboost', 'Watch an ad: free booster', x, y, w, 48 * s, { kind: 'ad', ad: true, size: 15.5 * s }) });
    B.push({ h: 42 * s, draw: (x, y, w) => ui.button(G.li === -1 ? 'back' : 'levels', G.li === -1 ? 'Menu' : 'Levels', x + w * 0.22, y, w * 0.56, 42 * s, { kind: 'tertiary', icon: ICON.grid, size: 15.5 * s }) });
    return B;
  }, { ribbon: acc });
}

// v3.2: the lava salamander on its intro card, idling (code-drawn, the in-game art)
function salIntroArt(x, y, w, h) {
  const S = Math.min(w * 0.4, h * 1.25), t = G.t;
  ctx.save();
  const g = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, w * 0.5);
  g.addColorStop(0, 'rgba(255,110,30,0.28)'); g.addColorStop(1, 'rgba(255,110,30,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
  drawSalamander(ctx, x + w / 2 + 0.95 * S, y + h * 0.52, S, t, { heading: 0, curve: -0.12 / S, pose: 'idle', glow: 0.75 + 0.2 * Math.sin(t * 2), look: { x: 0.4, y: 0.5 }, id: 49 });
  ctx.restore();
}

// v3.2: a chick kind on its intro card: the ready chick with its halo, bouncing (the in-game art)
function chickIntroArt(kind, x, y, w, h) {
  const r = h * 0.3;
  drawReady(ctx, kind, x + w / 2, y + h * 0.55, r * 1.25, G.t);
  drawKindChick(ctx, kind, x + w / 2, y + h * 0.55, r * 1.6, G.t, { ready: true });
}

// BOSS PORTRAIT (I6): the boss's face on its intro card. Stub: the sprite agent wires
// sprites.drawBossCard(ctx, bossId, x, y, w, h, t) in here (bossIds: weasel snake blizzard golem salamander eagle ratking).
function bossPortrait(ctx, bossId, x, y, w, h, t) { drawBossCard(ctx, bossId, x, y, w, h, t, G.screenT - 0.15); }

function drawPause() {
  dim(0.6);
  stackCard('Paused', (s) => {
    const B = [
      { h: 58 * s, gap: 6 * s, draw: (x, y, w) => ui.button('resume', 'RESUME', x, y, w, 58 * s, { kind: 'primary', shimmer: true, icon: ICON.play, size: 23 * s }) },
      G.hint
        ? lineBlock('Finding a good move…', 17 * s, { color: ui.C.warn, tag: 'pause:hint' })
        : G.sim.state !== 'play' ? null : { h: 48 * s, draw: (x, y, w) => ui.button('hint', 'Show me a move', x, y, w, 48 * s, { kind: 'ad', ad: true, size: 16.5 * s }) },
      { h: 48 * s, draw: (x, y, w) => {
        const hw = (w - 10 * s) / 2;
        ui.button('restart', 'Restart', x, y, hw, 48 * s, { kind: 'secondary', icon: ICON.retry, size: 17 * s });
        ui.button('levels', 'Levels', x + hw + 10 * s, y, hw, 48 * s, { kind: 'secondary', icon: ICON.grid, size: 17 * s });
      } },
      { h: 42 * s, gap: 16 * s, draw: (x, y, w) => modeRow(x, y, w, 42 * s, s) },
    ].filter(Boolean);
    if (G.sim.mode !== save.mode) B.push(lineBlock('The new mode starts when you restart', 13 * s, { color: ui.C.ink2, tag: 'pause:modenote', gap: 4 * s }));
    B.push({ h: 42 * s, draw: (x, y, w) => ui.button('calm', save.calm ? 'Reduced motion: on' : 'Reduced motion: off', x, y, w, 42 * s, { kind: 'tertiary', icon: save.calm ? ICON.check : null, size: 15 * s }) });
    if (portal.showMuteButton) B.push({ h: 46 * s, gap: 10 * s, draw: (x, y, w) => {
      const hw = (w - 10 * s) / 2;
      ui.button('sfx', 'Sound', x, y, hw, 46 * s, { kind: save.sfx ? 'tertiary' : 'off', icon: ICON.sound(save.sfx), size: 16 * s });
      ui.button('music', 'Music', x + hw + 10 * s, y, hw, 46 * s, { kind: save.music ? 'tertiary' : 'off', icon: ICON.note(save.music), size: 16 * s });
    } });
    return B;
  }, { ribbon: '#3a80ea' });
}

// The win screen in two beats (Duolingo-style).
// 1) The show (0 .. WIN_SHOW s): the board dims and the hen takes ~40% of the screen in the middle, doing her routine
//    (render/cheer.js) with confetti; the stars land big above her (beside her in landscape), the title under her feet.
// 2) The card (WIN_SHOW .. + WIN_IN): she shrinks and flies up into her stage on the card while the card slides in (up from
//    below; in landscape in from the right while she settles on the left). The same routine carries on at card size.
// The buttons come with the card (~2 s), in space that is always reserved; a tap anywhere skips straight to the card.
const WIN_SHOW = 1.6, WIN_IN = 0.38;
const winIn = (r) => (save.calm ? 1 : clamp((r.t - WIN_SHOW) / WIN_IN, 0, 1));
const ss01 = (x) => { const k = clamp(x, 0, 1); return k * k * (3 - 2 * k); };

// landscape with room: a stage left of the card (the win and fail cards)
function cardSide() {
  const u = ui.u, cw = Math.min(W_ - 32 * u, 420 * u);
  if (!(W_ > H_ * 1.15 && W_ - cw - 48 * u >= 200 * u)) return null;
  const sw = Math.min(W_ - cw - 48 * u, Math.max(cw, 300 * u)), left = (W_ - (sw + 16 * u + cw)) / 2;
  return { x: left, w: sw, cardO: { cx: left + sw + 16 * u + cw / 2, maxW: cw } };
}
// her side stage: she stands on the card's bottom line, as tall as the room allows
function sideStage(sd, card) {
  const u = ui.u, top = G.hudBottom + 6 * u, box = { x: sd.x, y: top, w: sd.w, h: card.y + card.h - 10 * u - top };
  return { box, henH: Math.min(box.w * 0.48, box.h * 0.6) };
}
// the show's layout: the hen big in the middle, room above her for her biggest jump, the stars, the title below
function bigStage(side) {
  const u = ui.u, top = G.hudBottom + 6 * u, avail = H_ - top, band = Math.max(40 * u, avail * 0.1);
  if (side) { // landscape: she stands left of centre, the stars beside her at chest height
    const hh = Math.min(H_ * 0.45, (avail - band) / 1.45, W_ * 0.3), y = top + (avail - band - hh * 1.45) / 2;
    const box = { x: 0, y, w: W_ * 0.8, h: hh * 1.45 }, R = Math.min(W_ * 0.05, hh * 0.2);
    const sx = W_ * 0.4 + hh * 0.62 + R * 2.9;
    return { box, henH: hh, R, stars: [0, 1, 2].map((k) => ({ x: sx + (k - 1) * R * 2.6, y: y + hh * 0.75 - (k === 1 ? R * 0.35 : 0) })), titleY: y + hh * 1.45 + band * 0.5, titleX: W_ * 0.4, full: { x: 0, y: top, w: W_, h: avail } };
  }
  const R = Math.min(W_ * 0.085, avail * 0.065), hh = Math.min(H_ * 0.43, W_ * 0.74, (avail - 2.8 * R - band) / 1.5); // wings spread she is ~1.2x as wide as tall
  const y0 = top + (avail - (2.8 * R + 1.5 * hh + band)) / 2, by = y0 + 2.8 * R;
  return { box: { x: 0, y: by, w: W_, h: 1.5 * hh }, henH: hh, R, stars: [0, 1, 2].map((k) => ({ x: W_ / 2 + (k - 1) * R * 2.7, y: y0 + 1.5 * R - (k === 1 ? R * 0.35 : 0) })), titleY: by + 1.5 * hh + band * 0.45, titleX: W_ / 2, full: { x: 0, y: top, w: W_, h: avail } };
}

// slow rays behind a celebration (still when reduced motion is on); clip first if they must stay in a box
function sunburst(cx, cy, R, col, n = 12) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(save.calm ? 0.13 : G.t * 0.12);
  ctx.fillStyle = col;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, d = (Math.PI / n) * 0.55;
    ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - d) * R, Math.sin(a - d) * R); ctx.lineTo(Math.cos(a + d) * R, Math.sin(a + d) * R); ctx.closePath();
  }
  ctx.fill();
  ctx.restore();
}
// the hen's stage on a result card: a sky window with rays (win: warm noon; fail: a soft evening)
function henStage(box, s, win) {
  ui.well(box.x, box.y + 2 * s, box.w, box.h - 2 * s, { s, r: 16 * s, a: win ? '#58b9f5' : '#8fa6d8', b: win ? '#c9ecff' : '#e6d9ee', border: 'rgba(60,34,12,0.7)', shade: 'rgba(10,40,90,0.3)',
    paint: () => {
      sunburst(box.x + box.w / 2, box.y + box.h * 0.62, box.w * 0.8, win ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.16)');
      // a grassy knoll for her to stand on
      ctx.fillStyle = win ? '#6cc247' : '#7fae6a';
      ctx.beginPath(); ctx.ellipse(box.x + box.w / 2, box.y + box.h + box.h * 0.2, box.w * 0.75, box.h * 0.36, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.ellipse(box.x + box.w / 2, box.y + box.h + box.h * 0.22, box.w * 0.7, box.h * 0.36, 0, 0, 7); ctx.fill();
    } });
}

function drawWin() {
  const r = G.result, R0 = routine(r.cheer), u = ui.u, k = winIn(r), e = k * k * (3 - 2 * k), inCard = k >= 1;
  const C = ui.C;
  dim(0.5 + 0.12 * (1 - e)); // the show dims the board a little deeper
  const sd = cardSide(), side = !!sd, cardO = sd ? sd.cardO : {};
  const pw = routinePower(r.stars), calm = save.calm, seed = G.level.id || 0;
  // the stage takes the room the rest of the card leaves (a tall phone: the full 184 units; a squat screen: less)
  const room = (H_ - G.hudBottom - 30 * u) / u - 476, stH = clamp(room, 110, 184);
  // a squat screen with no room beside the card either (600x600): she shares the star row, left of the stars
  const compact = !side && room < 110, rowH = compact ? 100 : 58;
  const title = G.level.boss && G.li >= 0 ? 'Boss beaten!' : r.stars === 3 ? 'Perfect clutch!' : r.stars === 2 ? 'Great job!' : 'Vault cracked!';
  const BIG = bigStage(side);
  // confetti fired during the show keeps the show's geometry (full screen), so it does not jump when she flies to the card
  const fxBig = { cx: BIG.box.x + BIG.box.w / 2, gy: BIG.box.y + BIG.box.h - BIG.henH * 0.05, S: BIG.henH / 100, clip: BIG.full, until: WIN_SHOW + WIN_IN };
  const T = {}; // where her stage and the stars sit on the card: the targets of her flight
  const cnt = r.total ? clamp(r.shownTotal / r.total, 0, 1) : 1; // the coins count up with the score
  const build = (s) => {
    const rows = [['Eggs saved', `${r.saved} / ${r.eggs}`], ['Egg points', String(r.eggScore)], ['Time bonus', '+' + r.timeBonus]];
    if (r.streakMult > 1) rows.push(['Star streak', 'x' + r.streakMult]);
    if (r.hasBonus) rows.push(['Bonus', r.bonus ? 'Done!' : 'Missed']);
    rows.push(['Coins', '+' + Math.round((r.coins || 0) * cnt)]);
    const B = [];
    if (!side && !compact) B.push({ h: stH * s, gap: 0,
      at: (x, y, w) => { T.box = { x, y, w, h: stH * s }; T.henH = 0.685 * stH * s; T.clip = { x: 0, y: G.hudBottom, w: W_, h: y + stH * s - G.hudBottom }; },
      draw: () => { henStage(T.box, s, true); if (inCard) drawCelebration(ctx, r.cheer, r.t, T.box, { pw, calm, henH: T.henH, seed, clip: T.clip, fxBig }); ui.record(T.box, 'win:hen'); } });
    B.push({ h: rowH * s, gap: side ? 0 : 4 * s,
      at: (x, y, w) => {
        let mx = x + w / 2, my = y;
        if (compact) { T.box = { x, y, w: w * 0.36, h: rowH * s }; T.henH = 68 * s; T.clip = { x: 0, y: G.hudBottom, w: W_, h: y + rowH * s - G.hudBottom }; mx = x + w * 0.36 + (w * 0.64) / 2; my = y + (rowH - 58) * s * 0.6; }
        T.stars = [0, 1, 2].map((q) => ({ x: mx + (q - 1) * 66 * s, y: my + 31 * s - (q === 1 ? 6 * s : 0) })); T.R = 25 * s; T.row = { x: mx - 96 * s, y: my, w: 192 * s, h: 58 * s };
      },
      draw: () => {
        if (inCard) {
          if (compact) drawCelebration(ctx, r.cheer, r.t, T.box, { pw, calm, henH: T.henH, seed, clip: T.clip, fxBig });
          T.stars.forEach((p, q) => drawWinStar(r, R0, q, p.x, p.y, T.R, calm));
        } else T.stars.forEach((p) => drawStar(ctx, p.x, p.y, T.R, false, 1, true)); // the sockets wait on the card for the flying stars
        if (compact) ui.record(T.box, 'win:hen');
        ui.record(T.row, 'win:stars');
      } });
    // the tally: a recessed table, one line per source of points
    const rh = 22 * s;
    B.push({ h: rows.length * rh + 10 * s, gap: 8 * s, draw: (x, y, w) => {
      ui.well(x, y, w, rows.length * rh + 10 * s, { s });
      rows.forEach(([a, b], i) => {
        const ry = y + 5 * s + rh * (i + 0.5);
        if (i) { ctx.fillStyle = 'rgba(110,66,24,0.16)'; ctx.fillRect(x + 10 * s, ry - rh / 2, w - 20 * s, 1); }
        const coin = a === 'Coins', vx = x + w - 12 * s;
        ui.text(a, x + 12 * s, ry, { size: 15 * s, color: C.ink2, tag: 'win:' + a, maxW: w / 2 - 12 * s });
        const col = a === 'Bonus' ? (r.bonus ? C.good : C.ink2) : a === 'Star streak' ? C.warn : coin ? '#a85f00' : C.ink;
        const vr = ui.text(b, vx, ry, { size: 16 * s, align: 'right', color: col, tag: 'win:v' + a, maxW: w / 2 - 34 * s });
        if (coin) drawCoin(ctx, vr.x - 12 * s, ry, 8 * s, G.t);
      });
    } });
    B.push({ h: 46 * s, gap: 8 * s, draw: (x, y, w) => ui.num(String(r.shownTotal), x + w / 2, y + 24 * s, { size: 40 * s, align: 'center', maxW: w, tag: 'win:total' }) });
    if (r.rewound) B.push(lineBlock('Rewind used: 3 stars locked', 12 * s, { color: C.ink2, tag: 'win:rw', gap: 0 }));
    // the buttons come with the card; their space is always reserved
    const last = G.li < 0 || G.li === LEVELS.length - 1;
    B.push({ h: 58 * s, gap: 12 * s, draw: (x, y, w) => {
      if (!inCard) return;
      ui.button('next', last ? 'ALL LEVELS' : 'NEXT', x, y, w * 0.66, 58 * s, { kind: 'primary', shimmer: true, icon: ICON.next, size: 24 * s });
      ui.button('restart', '', x + w * 0.66 + 10 * s, y, w * 0.34 - 10 * s, 58 * s, { kind: 'secondary', icon: ICON.retry, iconS: 1.25 });
    } });
    B.push({ h: 48 * s, draw: (x, y, w) => {
      if (!inCard) return;
      if (!G.doubled) ui.button('double', 'Double score and coins', x, y, w, 48 * s, { kind: 'ad', ad: true, size: 16 * s });
      else ui.text('Score and coins doubled!', x + w / 2, y + 24 * s, { size: 18 * s, align: 'center', color: C.good, tag: 'win:doubled' });
    } });
    return B;
  };
  const RIB = '#f0542e';
  const card = stackCard(title, build, { ...cardO, hidden: true }); // lay out first: her flight needs the targets
  if (side) { const ss = sideStage(sd, card); T.box = ss.box; T.henH = ss.henH; T.clip = ss.box; }
  // the card slides in: up from below (portrait), in from the right (landscape)
  const dx = side ? (1 - e) * (W_ - card.x + 20 * u) : 0, dy = side ? 0 : (1 - e) * (H_ - card.y + 20 * u);
  // the show's big title under her feet: it fades as the card (which has its own) comes, and the card passes over it
  const ta = save.calm ? 0 : 1 - ss01((r.t - WIN_SHOW + 0.15) / 0.3);
  if (ta > 0.01) {
    const ts = Math.min(34 * u, W_ * 0.085), tw = Math.min(W_ - 56 * u, ui.measure(title, ts) + 60 * u), pk = ui.pop(r.t, 0.35);
    ctx.save();
    ctx.globalAlpha = ta; ui.aBase = ta;
    ctx.translate(BIG.titleX, BIG.titleY); ctx.scale(pk, pk); ctx.translate(-BIG.titleX, -BIG.titleY);
    ui.ribbon(title, BIG.titleX, BIG.titleY - ts * 0.85, tw, ts * 1.7, { color: RIB, size: ts, noRecord: true });
    ui.aBase = 1;
    ctx.restore();
  }
  if (side && k > 0) { // her side of a wide screen: rays behind her, fading in with the card
    ctx.save(); ctx.globalAlpha = e;
    sunburst(T.box.x + T.box.w / 2, T.box.y + T.box.h - T.henH * 0.55, Math.min(T.box.w * 0.62, T.box.h * 0.8), 'rgba(255,236,170,0.13)');
    ctx.restore();
  }
  if (k > 0) stackCard(title, build, { ...cardO, dx, dy, ribbon: RIB, pop: false });
  if (side && inCard) {
    drawCelebration(ctx, r.cheer, r.t, T.box, { pw, calm, henH: T.henH, seed, fxBig });
    ui.record({ x: T.box.x + T.box.w / 2 - T.henH * 0.6, y: T.box.y + T.box.h - T.henH * 1.5, w: T.henH * 1.2, h: T.henH * 1.5 }, 'win:hen');
  }
  if (inCard) return;
  // the show, and her flight into the card: everything eases from the big layout to its card spot (which slides with the card)
  const tdx = side ? 0 : dx, tdy = side ? 0 : dy; // in landscape her stage does not slide, only the card
  const L = (a, b2) => a + (b2 - a) * e;
  const box = { x: L(BIG.box.x, T.box.x + tdx), y: L(BIG.box.y, T.box.y + tdy) - Math.sin(e * Math.PI) * H_ * 0.05, w: L(BIG.box.w, T.box.w), h: L(BIG.box.h, T.box.h) };
  if (k <= 0 && !calm) { // the show: rays turn behind her
    ctx.save(); ctx.globalAlpha = Math.min(1, r.t * 3);
    sunburst(BIG.box.x + BIG.box.w / 2, BIG.box.y + BIG.box.h - BIG.henH * 0.55, Math.max(W_, H_) * 0.75, 'rgba(255,236,170,0.1)', 14);
    ctx.restore();
  }
  drawCelebration(ctx, r.cheer, r.t, box, { pw, calm, henH: L(BIG.henH, T.henH), seed, clip: BIG.full, fxBig });
  BIG.stars.forEach((p, q) => drawWinStar(r, R0, q, L(p.x, T.stars[q].x + dx), L(p.y, T.stars[q].y + dy), L(BIG.R, T.R), calm));
}

// One result star. It stamps into its socket: falls in big and tilted, hits on its beat (R0.stars[q]) with a squash and
// a shock ring, then springs back to size while sparks fly.
const STAR_FALL = 0.2;
function drawWinStar(r, R0, q, sx, sy, rad, calm) {
  drawStar(ctx, sx, sy, rad, false, 1, true);
  const v = r.t - R0.stars[q] + STAR_FALL;
  if (q >= r.stars || v < 0) return;
  let sc, rot = 0, al = 1, lift = 0;
  if (v < STAR_FALL) { const p = v / STAR_FALL; sc = 2.3 - 1.55 * p * p; rot = -0.9 * (1 - p); al = Math.min(1, p * 2.5); lift = rad * 1.4 * (1 - p * p); }
  else { const w = Math.min(1, (v - STAR_FALL) / 0.42); sc = 1 - 0.25 * Math.cos(w * Math.PI * 2.5) * (1 - w) * (1 - w); }
  ctx.save(); ctx.globalAlpha = al; ctx.translate(sx, sy - lift); ctx.rotate(rot);
  drawStar(ctx, 0, 0, rad, true, Math.max(0.01, sc)); ctx.restore();
  const h = v - STAR_FALL;
  if (h >= 0 && h < 0.5 && !calm) {
    const a = h / 0.5;
    ctx.save();
    ctx.globalAlpha = (1 - a) * 0.8; ctx.lineWidth = rad * 0.22 * (1 - a) + 1; ctx.strokeStyle = '#fff3b0';
    ctx.beginPath(); ctx.arc(sx, sy, rad * (1 + 1.3 * Math.sqrt(a)), 0, 7); ctx.stroke();
    ctx.restore();
    starSparks(sx, sy, rad, a, q);
  }
}

// a ring of small diamonds bursting from a star as it lands (palette colours, no glow)
function starSparks(cx, cy, r, a, k) {
  ctx.save();
  ctx.globalAlpha = 1 - a;
  const col = ['#ffd23f', '#ff7a9a', '#46b83d', '#5a8dee', '#e57d12', '#ffffff', '#ffd23f', '#ff7a9a'];
  for (let i = 0; i < 8; i++) {
    const q = (i / 8) * Math.PI * 2 + k, d = r * (1 + (1.1 + 0.3 * (i % 2)) * Math.sqrt(a)), sz = r * 0.19 * (1 - a * 0.6);
    ctx.save(); ctx.translate(cx + Math.cos(q) * d, cy + Math.sin(q) * d + r * 0.5 * a * a); ctx.rotate(q + a * 3);
    ctx.fillStyle = col[i]; ctx.beginPath(); ctx.moveTo(0, -sz); ctx.lineTo(sz * 0.6, 0); ctx.lineTo(0, sz); ctx.lineTo(-sz * 0.6, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// The fail card: the hen on the same stage as the win card (render/cheer.js 'encourage'): sad for a moment, then she
// shakes it off and cheers you on, so kids are not put off. Landscape: she stands left of the card.
// Kind and clear: how close you were (eggs home against eggs needed), then one big RETRY.
function drawFail() {
  dim(0.55);
  const st = G.sim.stats(), u = ui.u, C = ui.C;
  const timeout = G.sim.timeLeft <= 0;
  const sd = cardSide(), room = (H_ - G.hudBottom - 30 * u) / u - 400, stH = clamp(room, 110, 184);
  const card = stackCard(timeout ? 'Out of time!' : 'Too many eggs broke', (s) => {
    const B = [];
    if (!sd) B.push({ h: stH * s, gap: 0, draw: (x, y, w) => {
      const box = { x, y, w, h: stH * s };
      henStage(box, s, false);
      drawCelebration(ctx, 'encourage', G.screenT, box, { henH: 0.685 * stH * s, calm: save.calm, pw: 0.5 });
      ui.record(box, 'fail:hen');
    } });
    B.push(lineBlock(['So close! You can do it.', 'Nearly there! One more go?', 'Every try makes you better!'][(G.level.id || 0) % 3], 19 * s, { color: C.warn, tag: 'fail:cheer', gap: sd ? 2 * s : 8 * s }));
    // how close: one slot per egg needed, the ones that got home filled in
    B.push({ h: 62 * s, gap: 6 * s, draw: (x, y, w) => {
      ui.well(x, y, w, 62 * s, { s });
      const n = Math.max(1, st.target), sp = Math.min(30 * s, (w - 20 * s) / n), es = Math.min(26 * s, sp * 0.95);
      for (let i = 0; i < n; i++) {
        const ex = x + w / 2 + (i - (n - 1) / 2) * sp, ey = y + 20 * s;
        if (i < st.saved) drawEggIcon(ctx, ex, ey, es, 'saved');
        else drawEggIcon(ctx, ex, ey, es, 'slot');
      }
      ui.record({ x: x + w / 2 - n * sp / 2, y: y + 7 * s, w: n * sp, h: 26 * s }, 'fail:eggs');
      ui.text(`Saved ${st.saved}, needed ${st.target}`, x + w / 2, y + 47 * s, { size: 15 * s, align: 'center', maxW: w - 16 * s, color: C.ink, tag: 'fail:stat' });
    } });
    if (G.sim.ally && G.sim.ally.avail.length) B.push(lineBlock('Next try a farm friend can help', 14 * s, { color: C.info, tag: 'fail:ally', gap: 6 * s }));
    B.push({ h: 60 * s, gap: 14 * s, draw: (x, y, w) => ui.button('retry', 'RETRY', x, y, w, 60 * s, { kind: 'primary', shimmer: true, icon: ICON.retry, size: 25 * s }) });
    if (!G.usedRewind && G.sim.canRewind()) B.push({ h: 50 * s, gap: 10 * s, draw: (x, y, w) => ui.button('rewind', G.freeRewind ? 'Free rewind 5 s' : 'Rewind 5 s, keep streak', x, y, w, 50 * s, G.freeRewind ? { kind: 'secondary', icon: ICON.rewind, size: 16.5 * s } : { kind: 'ad', ad: true, size: 16.5 * s }) });
    B.push({ h: 44 * s, draw: (x, y, w) => ui.button('levels', 'Levels', x + w * 0.2, y, w * 0.6, 44 * s, { kind: 'tertiary', icon: ICON.grid, size: 16 * s }) });
    return B;
  }, { ...(sd ? sd.cardO : {}), ribbon: '#5a82c8' });
  if (sd) {
    const { box, henH } = sideStage(sd, card);
    drawCelebration(ctx, 'encourage', G.screenT, box, { henH, calm: save.calm, pw: 0.5 });
    ui.record({ x: box.x + box.w / 2 - henH * 0.6, y: box.y + box.h - henH * 1.5, w: henH * 1.2, h: henH * 1.5 }, 'fail:hen');
  }
}

// Home. One job: get the player playing. The logo, the toy vault (never the hen in the middle), and at thumb height
// one big PLAY that breathes and shimmers; under it the three places to go and the difficulty as a quiet switch.
function drawTitle() {
  const u = ui.u;
  ui.calm = save.calm;
  const cx = W_ / 2;
  const bw = Math.min(310 * u, W_ - 44 * u);
  const wide = W_ > H_ * 1.15;
  // buttons sit on the meadow at the bottom: Play, then Levels | Daily | Shop, then the difficulty row
  const by = H_ - 200 * u;
  const ground = by - 16 * u;
  G.backdrop.drawGround(ctx, 0, ground, W_, H_ - ground, G.t);
  // the earth under the controls falls into shade, so the buttons carry the bottom of the screen
  const sg = ctx.createLinearGradient(0, ground + 20 * u, 0, H_);
  sg.addColorStop(0, 'rgba(30,14,4,0)'); sg.addColorStop(1, 'rgba(30,14,4,0.5)');
  ctx.fillStyle = sg; ctx.fillRect(0, ground + 20 * u, W_, H_ - ground - 20 * u);
  const logoS = Math.min(66 * u, W_ / 7.3, H_ / 6);
  const ty = Math.max(16 * u + logoS / 2, Math.min(H_ * 0.12, 72 * u));
  const logo = drawLogo(ctx, 'EGGSCAPE', cx, ty, logoS, G.t, G.screenT, FONT);
  ui.record(logo, 'title:logo');
  const subY = ty + logoS * 0.5 + 18 * u;
  ui.text(TEST ? 'Test build: everything unlocked' : 'Get every egg home to the hen', cx, subY, { size: 17 * u, align: 'center', color: '#fff', stroke: 'rgba(50,24,6,0.8)', strokeW: 4 * u, shadow: 'rgba(50,24,6,0.8)', tag: 'title:sub', maxW: W_ - 32 * u });
  // the toy vault: centred between the subtitle and the meadow, or to the left of the buttons on a wide screen
  const eggH = Math.min(46 * u, (ground - subY) * 0.22);
  let vx = cx, vy, R;
  if (wide) {
    const side = (W_ - bw) / 2;
    vx = side / 2;
    R = Math.min(side * 0.4, ground * 0.4);
    vy = ground * 0.52;
  } else {
    const top = subY + 22 * u, bot = ground - eggH * 2.4;
    R = Math.min((bot - top) / 2, W_ * 0.4);
    vy = (top + bot) / 2;
  }
  if (R < 40 * u) R = 0;
  else ui.record({ x: vx - R, y: vy - R, w: 2 * R, h: 2 * R }, 'title:vault');
  drawTitleScene(ctx, { cx: vx, cy: vy, R, ground, h: eggH, W: W_, H: H_, u, onLand: () => audio.play('hen_land', { vol: 0.5 }) }, G.t, save.calm);
  // PLAY breathes
  const ph = 70 * u, br = save.calm ? 1 : 1 + 0.018 * Math.sin(G.t * 2.6);
  ctx.save();
  ctx.translate(cx, by + ph / 2); ctx.scale(br, br); ctx.translate(-cx, -(by + ph / 2));
  ui.button('play', save.unlocked > 1 ? `PLAY  Level ${save.unlocked}` : 'PLAY', cx - bw / 2, by, bw, ph, { kind: 'primary', shimmer: true, icon: ICON.play, size: 28 * u, round: 20 * u });
  ctx.restore();
  const tw = (bw - 16 * u) / 3, ry = by + ph + 10 * u, rh = 54 * u, paid = save.daily.paid === today();
  ui.button('levels', 'Levels', cx - bw / 2, ry, tw, rh, { kind: 'secondary', icon: ICON.grid, size: 17 * u });
  ui.button('daily', 'Daily', cx - bw / 2 + tw + 8 * u, ry, tw, rh, { kind: paid ? 'off' : 'orange', icon: paid ? ICON.check : ICON.day, size: 17 * u });
  ui.button('shop', String(save.wallet.coins), cx - bw / 2 + 2 * (tw + 8 * u), ry, tw, rh, { kind: 'gold', icon: (c, x, y, s) => drawCoin(c, x, y, s * 0.56, G.t), size: 18 * u });
  modeRow(cx - bw / 2, ry + rh + 10 * u, bw, 44 * u, u, true);
}

// a small gold crown (boss tiles)
function drawCrown(cx, cy, s) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-s, s * 0.5); ctx.lineTo(-s * 1.05, -s * 0.45); ctx.lineTo(-s * 0.45, 0); ctx.lineTo(0, -s * 0.75); ctx.lineTo(s * 0.45, 0); ctx.lineTo(s * 1.05, -s * 0.45); ctx.lineTo(s, s * 0.5); ctx.closePath();
  const g = ctx.createLinearGradient(0, -s * 0.75, 0, s * 0.5);
  g.addColorStop(0, '#fff0a0'); g.addColorStop(1, '#f2a516');
  ctx.lineWidth = s * 0.32; ctx.strokeStyle = '#4a1a04'; ctx.stroke();
  ctx.fillStyle = g; ctx.fill();
  ctx.fillStyle = '#e8402e';
  ctx.beginPath(); ctx.arc(0, s * 0.12, s * 0.17, 0, 7); ctx.fill();
  ctx.restore();
}

// World map page. Each world wears its own colours (its sky as the page, its accent on the ribbon and tiles), shows
// how far you are (stars in this world, the page dots), and makes the next level to play the loudest thing on screen.
function drawLevels() {
  const u = ui.u, C = ui.C;
  ui.calm = save.calm;
  const pad = 14 * u;
  const nW = Math.ceil(LEVELS.length / PER_ENV);
  const first = G.world * PER_ENV, list = LEVELS.slice(first, first + PER_ENV);
  const themeOf = (L) => THEMES.find((t) => t.id === L.theme) || THEMES[0];
  const hex = (c, d) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : d);
  const wp = themeOf(list[0] || LEVELS[0]).palette, wacc = hex(wp.accent, '#ee5a36');
  // the page: the world's sky, deepened, with a faint vault-ring motif
  const bg = ctx.createLinearGradient(0, 0, 0, H_);
  bg.addColorStop(0, ui.mix(hex(wp.skyTop, '#3f9fe6'), '#1a1030', 0.42));
  bg.addColorStop(1, ui.mix(hex(wp.skyBottom, '#dff3fb'), '#1a1030', 0.58));
  ctx.globalAlpha = 0.95; ctx.fillStyle = bg; ctx.fillRect(0, 0, W_, H_); ctx.globalAlpha = 1;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.055)'; ctx.lineWidth = 16 * u; ctx.lineCap = 'round';
  const mR = Math.min(W_, H_) * 0.5, mx0 = W_ * 0.86, my0 = H_ * 0.9;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(mx0, my0, mR * (0.45 + 0.3 * i), 2.4 + i * 0.5 + (save.calm ? 0 : G.t * 0.03 * (i % 2 ? -1 : 1)), 5.6 + i * 0.4 + (save.calm ? 0 : G.t * 0.03 * (i % 2 ? -1 : 1))); ctx.stroke(); }
  ctx.restore();
  // header: back, the world's ribbon, all stars
  const hy = pad + 23 * u;
  ui.button('back', '', pad, pad, 46 * u, 46 * u, { kind: 'hud', icon: ICON.left, iconS: 1.3, round: 15 * u });
  const totalStars = bestTotal();
  const starTxt = `${totalStars} / ${LEVELS.length * 3}`;
  const stw = ui.measure(starTxt, 17 * u);
  const chipW = 9 * u + 22 * u + 4 * u + stw + 12 * u, chipX = W_ - pad - chipW;
  ui.glass(chipX, hy - 18 * u, chipW, 36 * u);
  drawStar(ctx, chipX + 9 * u + 11 * u, hy, 9.5 * u, true);
  ui.record({ x: chipX + 9 * u, y: hy - 11 * u, w: 22 * u, h: 22 * u }, 'levels:staricon', 'levels:stars');
  ui.text(starTxt, W_ - pad - 12 * u, hy + 0.5 * u, { size: 17 * u, align: 'right', color: '#fff', stroke: 'rgba(30,14,4,0.7)', strokeW: 3 * u, tag: 'levels:stars', group: 'levels:stars' });
  const titleL = pad + 46 * u + 22 * u, titleR = chipX - 22 * u, wname = WORLDS[G.world] || 'Levels';
  const rbw = clamp(ui.measure(wname, 21 * u) + 36 * u, Math.min(120 * u, titleR - titleL), titleR - titleL);
  ui.ribbon(wname, (titleL + titleR) / 2, hy - 19 * u, rbw, 36 * u, { color: wacc, size: 21 * u, tag: 'levels:title' });
  // world arrows, shop and the next star chest (C5/C6)
  const rowY = 74 * u, rh = 46 * u;
  if (G.world > 0) ui.button('world:-1', '', pad, rowY, 46 * u, rh, { kind: 'secondary', icon: ICON.left, iconS: 1.3 });
  if (G.world < nW - 1) ui.button('world:1', '', W_ - pad - 46 * u, rowY, 46 * u, rh, { kind: 'secondary', icon: ICON.right, iconS: 1.3 });
  const midW = Math.min(W_ - 2 * pad - 2 * 56 * u, 320 * u), mx = W_ / 2 - midW / 2, half = (midW - 10 * u) / 2;
  ui.button('shop', String(save.wallet.coins), mx, rowY, half, rh, { kind: 'gold', icon: (c, x, y, s) => drawCoin(c, x, y, s * 0.56, G.t), size: 17 * u });
  const chest = E.chestFor(totalStars, save.wallet.chests);
  if (chest) ui.button('chest', chest.ready ? 'Open!' : `${totalStars}/${chest.at}`, mx + half + 10 * u, rowY, half, rh, { kind: chest.ready ? 'primary' : 'off', shimmer: chest.ready, disabled: !chest.ready, dim: 1, iconS: 1.25, icon: (c, x, y, s) => drawChest(c, x, y, s, G.t, chest.ready ? 'ready' : 'locked'), size: 15 * u });
  // where you are: one dot per world, and this world's stars
  const dy = rowY + rh + 13 * u, ds = 12 * u, ws = list.reduce((a, L) => a + starsOf(L.id), 0), wsTxt = `${ws}/${list.length * 3}`;
  const wsW = ui.measure(wsTxt, 13 * u), dotsW = nW * ds, allW = dotsW + 10 * u + 15 * u + wsW, dx0 = W_ / 2 - allW / 2;
  for (let i = 0; i < nW; i++) {
    const on = i === G.world, open = envOpen(i) && i * PER_ENV < save.unlocked;
    ctx.beginPath(); ctx.arc(dx0 + ds * (i + 0.5), dy, (on ? 4.6 : 3) * u, 0, 7);
    ctx.fillStyle = on ? '#fff' : open ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.38)'; ctx.fill();
    if (on) { ctx.lineWidth = 1.5 * u; ctx.strokeStyle = 'rgba(30,14,4,0.6)'; ctx.stroke(); }
  }
  ui.record({ x: dx0, y: dy - 5 * u, w: dotsW, h: 10 * u }, 'levels:dots');
  drawStar(ctx, dx0 + dotsW + 10 * u + 6 * u, dy, 5.5 * u, true);
  ui.text(wsTxt, dx0 + dotsW + 10 * u + 15 * u, dy + 0.5 * u, { size: 13 * u, color: '#fff', stroke: 'rgba(30,14,4,0.65)', strokeW: 2.5 * u, tag: 'levels:wstars' });
  let top = dy + 16 * u;
  // star gate (I5): a locked environment says how many stars it needs
  const locked = !envOpen(G.world);
  if (locked) {
    const need = envNeed(G.world), ly = top + 17 * u, txt = `Collect ${need} stars to open: you have ${totalStars}`;
    const ts = 16 * u, mw = W_ - 2 * pad - 52 * u, tw = Math.min(ui.measure(txt, ts), mw), gw = tw + 52 * u, lx = W_ / 2 - gw / 2;
    ui.glass(lx, ly - 17 * u, gw, 34 * u, { border: 'rgba(255,224,120,0.7)' });
    drawPadlock(lx + 20 * u, ly - 1 * u, 7 * u, '#ffe066');
    ui.text(txt, lx + 36 * u, ly + 0.5 * u, { size: ts, color: '#ffe680', stroke: 'rgba(30,14,4,0.7)', strokeW: 3 * u, tag: 'levels:gate', maxW: mw });
    top += 42 * u;
  }
  const cols = W_ > H_ ? 5 : 3;
  const rows = Math.ceil(list.length / cols);
  const gap = 12 * u;
  const cw = Math.min((W_ - pad * 2 - gap * (cols - 1)) / cols, 136 * u);
  const labH = TEST ? 44 * u : 0; // test build: a chick lab row under the grid
  // the next level to play, when it is on this page, also gets one big button under the grid (thumb height)
  const nextI = save.unlocked - 1, cta = nextI >= first && nextI < first + list.length && playable(nextI) && !starsOf(LEVELS[nextI].id);
  const ctaH = cta ? 62 * u : 0, ctaGap = cta ? 18 * u : 0;
  const roomH = H_ - top - pad - labH - (labH ? 22 * u : 0) - ctaH - ctaGap;
  const chh = Math.min((roomH - gap * (rows - 1)) / rows, cw * 1.0);
  top += Math.max(0, (roomH - rows * chh - gap * (rows - 1)) * 0.3); // spare room: the grid sits a little lower, nearer the thumb
  if (labH) {
    // test build: a paged lab under the grid, one practice vault per chick kind, creature, power and combo
    const pg = LAB[((G.labPage || 0) % LAB.length + LAB.length) % LAB.length], kinds = pg.items, lg = 8 * u, aw = 34 * u;
    const lw = Math.min(110 * u, (W_ - 2 * pad - 2 * (aw + lg) - lg * (kinds.length - 1)) / kinds.length);
    const lx0 = W_ / 2 - (kinds.length * lw + (kinds.length - 1) * lg) / 2, ly = H_ - pad - labH;
    ui.text('Lab: ' + pg.name, W_ / 2, ly - 12 * u, { size: 14 * u, align: 'center', color: '#ffe8b0', stroke: 'rgba(0,0,0,0.5)', tag: 'levels:lab' });
    ui.button('lab:-1', '<', pad, ly, aw, labH, { kind: 'ad', size: 20 * u });
    ui.button('lab:1', '>', W_ - pad - aw, ly, aw, labH, { kind: 'ad', size: 20 * u });
    kinds.forEach(([k, label], j) => ui.button('demo:' + k, label, lx0 + j * (lw + lg), ly, lw, labH, { kind: 'ad', size: Math.min(15 * u, lw * 0.2) }));
  }
  const gridW = cols * cw + (cols - 1) * gap;
  const x0 = W_ / 2 - gridW / 2;
  if (cta) {
    const bw = Math.min(gridW, 320 * u), cy = top + rows * chh + gap * (rows - 1) + ctaGap;
    ui.button('lv:' + nextI, `PLAY  Level ${LEVELS[nextI].id}`, W_ / 2 - bw / 2, cy, bw, ctaH, { kind: 'primary', shimmer: true, icon: ICON.play, size: 24 * u, round: 18 * u });
  }
  const BOSS = { a: '#c93a54', b: '#7a1a40', lip: '#42091f', line: '#22040e', ink: '#fff', rim: 'rgba(255,214,96,0.95)' };
  list.forEach((L, k) => {
    const i = first + k;
    const c = k % cols, r = Math.floor(k / cols);
    const open = playable(i), boss = !!L.boss;
    // portrait: the boss closes the page on a double-wide tile
    const wideT = boss && cols === 3 && c === 1 && k === list.length - 1;
    const x = x0 + c * (cw + gap), y = top + r * (chh + gap), tw = wideT ? cw * 2 + gap : cw;
    const acc = hex(themeOf(L).palette.accent, '#c98a3a');
    const s = starsOf(L.id), cur = open && i === save.unlocked - 1 && !s;
    const face = open ? (boss ? BOSS : ui.faceOf(ui.mix(acc, '#d8862a', 0.12))) : ui.faceOf(ui.mix(boss ? '#8a2a48' : acc, '#6c7080', boss ? 0.6 : 0.78));
    if (cur && !save.calm) { // the next level to play: a ring breathes round its tile
      const p = 0.5 + 0.5 * Math.sin(G.t * 4);
      ui.roundRect(x - (3 + 3 * p) * u, y - (3 + 3 * p) * u, tw + (6 + 6 * p) * u, chh + (6 + 6 * p) * u, (20 + 3 * p) * u);
      ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.3 * p})`; ctx.fill();
    }
    const b = ui.button('lv:' + i, '', x, y, tw, chh, { face, disabled: !open, keepFace: true, round: 18 * u, shimmer: cur });
    const fy = y + b.dy, fh = chh - Math.min(6 * u, chh * 0.13), mxT = x + tw / 2, grp = 'btn:lv:' + i;
    const num = String(L.id);
    if (open) {
      if (boss && wideT) { drawCrown(x + tw * 0.2, fy + fh * 0.45, Math.min(13 * u, fh * 0.15)); drawCrown(x + tw * 0.8, fy + fh * 0.45, Math.min(13 * u, fh * 0.15)); }
      ui.text(num, mxT, fy + fh * (boss ? 0.47 : 0.4), { size: Math.min(36 * u, fh * 0.4), align: 'center', color: '#fff', stroke: face.line, strokeW: Math.max(3, Math.min(36 * u, fh * 0.4) * 0.2), shadow: face.line, group: grp, tag: 'lvnum' + i });
      const sr = Math.min(9.5 * u, cw / 11, fh * 0.11);
      ui.roundRect(mxT - sr * 4.3, fy + fh * 0.78 - sr * 1.45, sr * 8.6, sr * 2.9, sr * 1.45);
      ctx.fillStyle = 'rgba(30,10,0,0.3)'; ctx.fill();
      for (let q = 0; q < 3; q++) drawStar(ctx, mxT + (q - 1) * sr * 2.65, fy + fh * 0.78, sr, q < s);
    } else {
      ui.text(num, mxT, fy + fh * 0.24, { size: Math.min(20 * u, fh * 0.22), align: 'center', color: 'rgba(255,255,255,0.78)', stroke: face.line, strokeW: 3 * u, group: grp, tag: 'lvnum' + i });
      drawPadlock(mxT, fy + fh * 0.6, Math.min(13 * u, fh * 0.14), null);
    }
    if (boss) {
      const bs2 = Math.min(12 * u, fh * 0.13), bwid = ui.measure('BOSS', bs2) + 16 * u, byy = fy + fh * (open ? 0.15 : 0.06 + 0) ;
      if (open) {
        ui.roundRect(mxT - bwid / 2, byy - bs2 * 0.8, bwid, bs2 * 1.6, bs2 * 0.8);
        ctx.fillStyle = '#ffd24a'; ctx.fill(); ctx.lineWidth = 1.5 * u; ctx.strokeStyle = '#4a1a04'; ctx.stroke();
        ui.text('BOSS', mxT, byy, { size: bs2, align: 'center', color: '#5a1a08', group: grp, tag: 'lvboss' + i });
      } else ui.text('BOSS', mxT, fy + fh * 0.9, { size: bs2, align: 'center', color: 'rgba(255,255,255,0.7)', stroke: face.line, strokeW: 2.5 * u, group: grp, tag: 'lvboss' + i });
    }
  });
}

function drawPadlock(lx, ly, ls, col) {
  // col null: the full-colour lock; a colour: a tinted one (the star-gate line)
  ui.lock(ctx, lx, ly, ls, col ? { a: col, b: col, steel: col } : {});
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
  if (DEV) { const d = new URLSearchParams(location.search).get('demo'); if (d) window.__egg.startDemo(d); } // v3.2: ?demo=glow
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
  CHICK_DEMOS,
  startFrog(o = {}) { G.demo = FROG_DEMO; startLevel(-2, o); }, // v3.3 frog studio level
  startDemo(kind, o = {}) { const D = [...CHICK_DEMOS, ...SEA_DEMOS, ...POWER_DEMOS, ...THIEF_DEMOS, ...REEF_DEMOS, ...BAYOU_DEMOS, ...LAB_DEMOS]; G.demo = D.find((d) => d.kind === kind || d.id === kind) || CHICK_DEMOS[0]; startLevel(-2, o); }, // v3.2 chick demos, v3.3 sea, v3.4 powers
  POWER_DEMOS,
  THIEF_DEMOS,
  bayouArt: { drawGator, drawTurtle, drawSwarm, drawGatorCard, drawGatorEmblem }, // v3.7 Gator Bayou strips
  thiefArt: { drawThief, thiefPose, thiefBlend, RIG: THIEF_RIG, drawThiefCard, drawThiefEmblem, drawBossCard }, // v3.6 thief strips
  press,
  step(seconds) { const n = Math.round(seconds / DT); for (let i = 0; i < n; i++) G.sim.step(); handleEvents(); },
  frame(dt = 1 / 60) { update(dt); render(); },
  actSteps, // film strips replay planner moves through this
  snakeArt: drawSnake, // palette strips
  hen: { anim: drawHenAnim, legacy: drawHenLegacy, events: henIdleEvents, reset: resetHen }, // M7 strips
  cheer: { draw: drawCelebration, routine, ROUTINES, pick: pickRoutine, power: routinePower }, // the hen's win routines (strips)
  allyArt: ALLY_ART, // v3.4: ally strips
  callAlly: (kind, o) => G.sim.callAlly(kind, o),
  startAllyDemo(kind = 'rooster', o = {}) { G.demo = ALLY_DEMOS.find((d) => d.kind === kind) || ALLY_DEMOS[0]; startLevel(-2, o); },
  snAnim: W.snAnim,
  salAnim, // v3.2: the salamander's last drawn feet (QA strips)
  frogAnim, // v3.3: the frog's eased looks (QA strips)
  frogArt: drawFrog, // v3.3: pose gallery (QA strips)
  seaAnim, // v3.3: the octopus's and fishes' render state (QA strips)
  handle: () => handleEvents(),
  overlaps: () => G.overlaps,
  uiRect: (tag) => ui.rects.find((r) => r.tag === tag) || null, // QA strips: where a recorded block was drawn
  setSave(s) { loadSave(s); },
  get save() { return save; },
  // QA only: jump straight to an end screen with a plausible result
  showResult(kind, stars = 3, cheer = null, t = 9) {
    if (kind === 'win') G.result = { stars, saved: 3, eggs: 3, eggScore: 4200, timeBonus: 380, streak: stars === 3 ? 3 : 0, streakMult: stars === 3 ? 1.5 : 1, total: 6870, shownTotal: 6870, t, target: 2, perfect: stars === 3, rewound: false, coins: 34, bonus: true, hasBonus: stars === 3, cheer: cheer || pickRoutine({ stars }) };
    else G.sim.state = 'failed';
    setScreen(kind);
  },
};

boot();
