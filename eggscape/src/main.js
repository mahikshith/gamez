// Eggscape: game shell. Screens, input, camera, events -> VFX/SFX/score, HUD.
import { Sim, DT, LEGACY_ORB, EAGLE_LEN } from './sim/sim.js';
import { hintSearch, actSteps } from './sim/search.js';
import { RING_TH, clamp, lerp } from './sim/geom.js';
import { LEVELS } from './data/levels.js';
import { DAILY } from './data/daily.js';
import { THEMES, createBackdrop } from './themes.js';
import { bodyCache, ringCache } from './render/ringart.js';
import { PERF, applySettings, tick as perfTick, takeStep, STEPS, TIER_NAME } from './perf.js';
import { audio } from './audio.js';
import { portal } from './sdk/portal.js';
import { FX } from './render/fx.js';
import * as W from './render/world.js';
import { themeBack, themeWash, themeTick, logoDress } from './ui/theme.js';
import { menuFxBack, menuFxFront, menuFxStats } from './ui/menufx.js'; // the skin's living effect over the menus
import { UI, FONT, ICON, drawStar, drawEggIcon, drawAdBadge } from './ui/ui.js';
import { drawTitleScene, drawLogo, titleTap } from './render/title.js';
import { drawSnake } from './render/characters.js';
import * as MS from './render/mapscene.js'; // the world map: land, road, scenery and cast
import { drawRoadDress } from './render/mapamb.js'; // the outfit's pack strings its garland along the road
import { POWER_INFO, drawOrb, drawPowerCard } from './render/powers.js';
import { drawSprite, drawBossCard, drawHenActor, setSpriteCalm, drawHenLegacy, ANIMATED_HEN } from './render/sprites.js';
import { drawHenAnim, henIdleEvents, resetHen, setHenSkin } from './render/hen.js';
import { drawCelebration, pickRoutine, routine, routineCues, routinePower, ROUTINES } from './render/cheer.js';
import { drawAllies, ALLY_ART, allyFrame, crowRingXf, crowEggXf, crowFlinch } from './render/allies.js'; // v3.4 farm allies
import { ALLY_DEMOS } from './data/ally-demos.js';
import { createWeather } from './render/weather.js';
import * as E from './economy.js';
import ads, { SKIP_COINS, PREMIUM_SKU } from './ads.js'; // 2026-11-15: rewarded/interstitial policy; 2026-11-16: every in-app product
import { drawStore, drawCoin, drawBoosterPicker, drawChest, drawGlassEgg, storeItem, drawOfferArt, drawBoosterIcon, drawSkinPreview } from './ui/store.js';
import * as DR from './director.js'; // 2026-11-20: the Director (help ladder, freebies, trials, home nudges)
import * as OF from './offers.js'; // 2026-11-16: the offer engine, the age question and child-safe mode
import fontUrl from '../assets/fonts/fredoka-600-latin.woff2';
import { botTick } from './dev/bot.js';
import { geckoStrikeEv, drawGeckoCard, geckoAnchor } from './render/gecko15.js'; // L15: the frost gecko boss
import { drawBossRings, drawBossUnder, drawBossOver, drawBossActor, drawBossBar, drawMagnetField, bossPose, setBossView } from './render/boss.js'; // bosses (v3.1)
import { galeNow, BOSS_TITLE, ATTACK_NAME, BOSS_MODE } from './sim/boss.js';
import { drawChickEgg, drawChickFX, drawHardIce, chickEvent, chickLabel, drawKindChick, drawReady } from './render/chicks.js'; // v3.2 chick kinds
import { drawP2Back, drawP2Front, p2Event } from './render/powers2.js'; // v3.4 powers and combos
import { warpXfBegin, warpXfEnd } from './render/warp.js'; // v3.4 warp gate: a creature drawn going through it
import { POWER_DEMOS } from './data/power-demos.js'; // v3.4 studio vaults
import { CHICK_DEMOS } from './data/chick-demos.js';
import { P2_TYPES } from './sim/powers2.js';
import { skinUI } from './data/skin-ui.js'; // the hen skin re-themes the menus (mykee 2026-11-16) // practice tiles: which ids are power orbs
import { BAYOU_DEMOS } from './data/bayou-demos.js'; // v3.7 Gator Bayou studio vaults
import { FROG_DEMO } from './data/frog-demo.js'; // v3.3 frog studio level (dev)
import { SEA_DEMOS } from './data/sea-demos.js'; // v3.3 studio levels (dev)
import { drawOctopus as devOcto, octoAnim as devOctoAnim } from './render/octopus.js'; // (dev hook: art sheets)
import { drawJelly as devJelly } from './render/reef.js';
import { REEF_DEMOS } from './data/reef-demos.js'; // world 8 studio levels (dev)
import { drawSeaUnder, drawSeaOver, seaEvent, seaAnim } from './render/sea.js'; // v3.3 octopus and fish
import { drawReefUnder, drawReefOver, reefEvent, drawSurface, drawBoat, boatSeat, drawRiseGuide } from './render/reef.js'; // world 8 Coral Reef (underwater)
import { drawThiefDens, drawThieves, drawThievesOver, thiefEvent, drawThief, thiefPose, thiefBlend, drawThiefCard, drawThiefEmblem } from './render/thieves.js'; // v3.6 the weasel and the rats
import { RIG as THIEF_RIG } from './sim/thieves.js';
import { THIEF_DEMOS } from './data/thief-demo.js'; // v3.6 thief studio levels (dev)
import { LAB_DEMOS } from './data/lab-demos.js'; // v4 Shape Lab studio levels: the clockwork cast and the owl
import { drawClockwork, drawClockworkTele, cwEvent, drawCwIntro } from './render/clockwork.js'; // v4 clockwork spider, wind-up beetle, spring jack
import { owlEvent, drawOwlArt } from './render/owl.js'; // v4 the Clockwork Owl
import { movesEvent } from './render/bossmoves.js'; // the boss variety moves
import { drawSalamanders, drawSalHeat, drawSalamander, salAnim } from './render/salamander.js'; // v3.2 lava salamander
import { drawCrawler, SPECIES as CRAWLER_SPECIES, crawlerAnim } from './render/crawlers.js'; // the salamander's cousins (dev strips; not in a level yet)
import { drawFrogs, drawFrogTele, frogEvent, frogAnim, drawFrog } from './render/frog.js'; // v3.3 frog
import { drawBayou, drawBayouOver, bayouEvent, drawGator, drawTurtle, drawSwarm, drawGatorCard, drawGatorEmblem } from './render/bayou.js'; // v3.7 Gator Bayou
import { ringReach, ringPt } from './sim/shapes.js'; // v3.3 M10 vault shapes
import { drawRockHud } from './render/shapes.js';
import { strikeLayer } from './render/strikehit.js'; // Chick Strike: the villains' hit reactions
import { pictoCheck, pictoCross, pictoWarn, pictoClock, pictoFlame, pictoGem, pictoTarget, pictoCracked, pictoBroken, pictoGoal, pictoPower, pictoStarMinus } from './ui/picto.js'; // icon-first cards
import { drawStrikeWorld, strikeEvent, drawStrikeButton, drawStrikeToken, drawStrikeStage, drawStrikeChick, strikeSeat } from './render/strike.js';
import { drawPremiumBadge } from './render/premium.js'; // the premium chicks' crown // Chick Strike powers
import { STRIKES, STRIKE, STRIKE_FROM } from './data/strikes.js';
import { drawHand as teachHand } from './render/wonder.js'; // the teaching hand (Papa Rooster's first call)
import { stampStats } from './render/stamp.js';
import { drawHowTo, howToPlan, chickPlan, BASIC as HOWTO_BASIC, ROOSTER as HOWTO_ROOSTER, LOOP as HOWTO_LOOP } from './render/howto.js'; // 2026-11-20: show, don't tell
import { createWonder } from './wonder.js'; // WONDER: the bonus world (own screen, own loop) and the Extras menu screen
import { VILLAIN_INFO, ATTACK_EXTRA, villainKinds, bossAttacks } from './data/villain-info.js'; // the "i" panel: who is in this vault
import { drawVillainPortrait, PORTRAIT_BG, hasPortrait } from './render/villain-art.js';
import { vibrate, installApp } from './app.js'; // Android WebView proof shell: bridge vibration, back button, FPS overlay (no-ops outside EGG_APP)
// Safety net: an animated size that dips below zero (a shrinking bubble, a tiny card on a short screen) makes arc() /
// ellipse() THROW, which kills the rest of that frame every frame. Clamp the radius to 0 instead (NaN too).
for (const P of [typeof CanvasRenderingContext2D !== 'undefined' && CanvasRenderingContext2D.prototype, typeof OffscreenCanvasRenderingContext2D !== 'undefined' && OffscreenCanvasRenderingContext2D.prototype].filter(Boolean)) {
  const arc = P.arc, el = P.ellipse;
  P.arc = function (x, y, r, a0, a1, ccw) { return arc.call(this, x, y, r > 0 ? r : 0, a0, a1, ccw); };
  if (el) P.ellipse = function (x, y, rx, ry, rot, a0, a1, ccw) { return el.call(this, x, y, rx > 0 ? rx : 0, ry > 0 ? ry : 0, rot, a0, a1, ccw); };
}

const DEV = typeof __DEV__ !== 'undefined' ? __DEV__ : true;
// playtest build (build.mjs --test): every level, booster and skin unlocked, plenty of coins
const TEST = typeof __TEST__ !== 'undefined' && __TEST__;

// ---------------------------------------------------------------- save
const SAVE_VER = 3; // v3: 35 new levels, progress resets; settings, wallet and discoveries carry over
// mode: difficulty (F32); stars/best are kept per mode (Medium uses the v1 keys); calm = reduced motion
const defaultSave = () => ({ v: SAVE_VER, unlocked: 1, stars: {}, best: {}, streak: 0, sfx: true, music: true, seen: {}, mode: 'medium', calm: false, intro: {}, bonus: {}, wallet: E.defaultWallet(), gates: {}, ringSpeed: 1, adClaim: 0, daily: { day: '', best: 0, paid: '' } });
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
// a world gate opens by stars, or for coins (2026-11-15: "or they can buy with the coins they earn"); a tester switch opens all
const GATE_COINS = (k) => 80 + 40 * k;
// Settings (2026-11-15): how fast the rings follow a finger, 0.6x .. 2x of the designed speed
const RING_SPEEDS = [0.6, 0.8, 1, 1.25, 1.5, 1.75, 2, 2.5, 3]; // 2026-11-16 mykee: experienced players want even faster (300%; no extra tunnelling seen in a 3x wall-crossing check)
const ringSpeed = () => (RING_SPEEDS.includes(+save.ringSpeed) ? +save.ringSpeed : 1);
const allOpen = () => TEST || !!save.tester || !!(save.wallet && save.wallet.noAds); // 2026-11-20: Unlock Everything ($3.99) opens every level
const envOpen = (k) => allOpen() || bestTotal() >= envNeed(k) || !!(save.gates && save.gates[k]);
const playable = (i) => i >= 0 && i < LEVELS.length && (allOpen() || (i < save.unlocked && envOpen(envOf(i))));
// the level the Play button means: the first one not yet cleared (in the order of the map), else the frontier.
// 2026-11-15: it was save.unlocked - 1, which an everything-unlocked build set to 50 ("PLAY Level 50" on every launch)
function nextIdx() {
  const lim = allOpen() ? LEVELS.length : Math.min(LEVELS.length, save.unlocked);
  for (let i = 0; i < lim; i++) if (!bestStarsOf(LEVELS[i].id)) return i;
  return Math.max(0, lim - 1);
}
function loadSave(s) {
  save = { ...defaultSave(), ...s };
  save.wallet = E.sanitizeWallet(save.wallet);
  if (!MODE_LIST.includes(save.mode)) save.mode = 'medium';
  for (const [o, n] of Object.entries(LEGACY_ORB)) if (save.seen[o]) save.seen[n] = 1; // v1 discoveries
  ads.rebind(save);
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
// the free-coins video: what it pays now (a little less each time, six a day), and seconds until the next one
const adCoins = () => E.freeCoinsNext(save.adDay, today());
function adCd() {
  if (adCoins() > 0) return E.adCooldownLeft(save.adClaim, Date.now());
  const d = new Date(), m = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return Math.max(3601, Math.ceil((m - d) / 1000)); // done for today ('Tomorrow')
}
function dailyLevel() {
  const d = new Date();
  return DAILY[Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5) % DAILY.length];
}
// time to the next Daily Vault: it turns over at local midnight (the same clock today() uses), so it survives reloads
const dailyNextText = () => { const d = new Date(), m = Math.max(1, Math.ceil((new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1) - d) / 6e4)), h = Math.floor(m / 60); return h ? `Next ${h}h ${String(m % 60).padStart(2, '0')}m` : `Next ${m}m`; };
const dailyBest = () => (save.daily.day === today() ? save.daily.best : 0);
const powerInfo = (id) => POWER_INFO[id] || { name: id, line: '', color: '#fff' };
// Chick Strike: the chicks the player has reached (save.unlocked counts levels; the level being started counts too), and the one equipped
const strikeReach = () => Math.max(save.unlocked || 1, G.level && G.li >= 0 ? G.level.id : 0);
// 2026-11-16: a chick bought in the shop (wallet.chicks) is open from then on, whatever the level
// (a premium chick has no level: it is open only once bought)
const strikesOpen = () => STRIKES.filter((S) => (!S.premium && strikeReach() >= S.unlock) || E.ownsChick(save.wallet, S.id) || (G.trialChick && G.level && G.trialChick.lid === G.level.id && G.trialChick.id === S.id));
// 2026-11-15: the power chick is chosen per level on the intro card. It no longer carries over silently from the last
// level; a retry of the same level keeps the choice (G.stkSel is per level id).
function strikeFor(L, i) {
  const open = strikesOpen();
  if (!open.length || (i >= 0 && L.id < STRIKE_FROM)) return null;
  const sel = G.stkSel && G.stkSel.lid === (L && L.id) ? G.stkSel.id : null;
  return sel && open.some((S) => S.id === sel) ? sel : null;
}
let lastCoins = null;
function persist() {
  { // the Director counts coins spent (any drop in the purse is a spend: coins only ever leave through a purchase)
    const c = save.wallet ? save.wallet.coins || 0 : 0;
    if (lastCoins != null && c < lastCoins) DR.noteSpend(save, lastCoins - c, G.screen || 'any');
    lastCoins = c;
  }
  try { portal.save(JSON.stringify(save)); } catch (e) { /* never block */ }
}

// ---------------------------------------------------------------- canvas
const canvas = document.getElementById('game') || Object.assign(document.body.appendChild(document.createElement('canvas')), { id: 'game' });
const ctx = canvas.getContext('2d');
const ui = new UI(ctx);
let W_ = 0, H_ = 0, DPR = 1;

// Safe area (the one source of truth, ui.safe / ui.A): the larger of the CSS env(safe-area-inset-*) probe, the Android
// shell's real insets (window.__eggSafe, CSS px, injected by MainActivity on load and on every insets change) and a
// small floor, so nothing interactive or textual sits under a camera cutout, a gesture bar or on the very edge.
const SAFE_FLOOR = 8;
let safeProbe = null;
function safeInsets() {
  let e = { t: 0, b: 0, l: 0, r: 0 };
  try {
    if (!safeProbe && document.body) {
      safeProbe = document.createElement('div');
      safeProbe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
      document.body.appendChild(safeProbe);
    }
    if (safeProbe) {
      const cs = getComputedStyle(safeProbe);
      e = { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
    }
  } catch (_) { /* no probe: the floor and the shell's insets still hold */ }
  const n = (typeof window !== 'undefined' && window.__eggSafe) || {};
  const f = (k) => Math.round(Math.max(SAFE_FLOOR, e[k] || 0, +n[k] || 0));
  return { t: f('t'), b: f('b'), l: f('l'), r: f('r') };
}

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, PERF.dprCap);
  W_ = Math.max(320, window.innerWidth);
  H_ = Math.max(320, window.innerHeight);
  canvas.width = Math.round(W_ * DPR);
  canvas.height = Math.round(H_ * DPR);
  canvas.style.width = W_ + 'px';
  canvas.style.height = H_ + 'px';
  ui.resize(W_, H_, safeInsets());
  if (G.backdrop) G.backdrop.resize(W_, H_, DPR);
  if (G.weather) G.weather.resize(W_, H_, DPR);
  G.camSnap = true;
  wonder.resize(); // WONDER
}

// ---------------------------------------------------------------- game state
const G = {
  pscroll: { y: 0, v: 0, max: 0, t: 0 }, pdrag: null, // Practice screen scroll
  mscroll: { y: 0, v: 0, max: 0, t: 0, seenT: Infinity, focus: '', enter: 0 }, mapL: null, // the world map's scroll (px from the map's top) and layout
  iscroll: { y: 0, v: 0, max: 0, t: 0 }, infoKinds: [], infoNew: false, infoFrom: 'play', infoCard: null, // the "i" panel (drawInfo)
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
  storeTab: 'deals',
  storeFlash: null,
  world: 0,
  hen: { mood: 'idle', t: 0 },
  pointer: { x: 0, y: 0 },
};

// WONDER: the bonus world's controller. It gets the canvas, the UI kit and a few shell services; it never touches the campaign save keys.
const wonder = createWonder({ ctx, ui, audio, size: () => ({ W: W_, H: H_, DPR }), save: () => save, persist: () => persist(), time: () => G.t, setScreen: (s) => setScreen(s), leave: () => { if (G.theme) audio.music(G.theme.music); audio.setMaterial((G.level && G.level.material) || 'wood'); setScreen('extras'); } });

function themeFor(level) {
  return THEMES.find((t) => t.id === level.theme) || THEMES[(level.id - 1) % THEMES.length];
}

// 2026-11-16 (mykee: the screen hangs when a level is tapped): a level's backdrop is the heaviest thing a level start
// builds (several full-screen painted layers), so the last few are kept, and the level the player is most likely to
// tap next is built ahead while the home or map screen sits idle
const BD = new Map();
function backdropFor(theme, seed) {
  const key = theme.id + '|' + seed, sz = W_ + 'x' + H_ + '@' + DPR;
  let b = BD.get(key);
  if (b) BD.delete(key);
  else {
    b = createBackdrop(theme, seed);
    const r0 = b.resize; b.resize = (w, h, d) => { b.sz = w + 'x' + h + '@' + d; return r0.call(b, w, h, d); };
  }
  BD.set(key, b);
  if (BD.size > 3) BD.delete(BD.keys().next().value);
  if (b.sz !== sz) b.resize(W_, H_, DPR);
  b.setParallax(0, 0);
  return b;
}
let warmT = 0;
function warmNext() {
  clearTimeout(warmT);
  warmT = setTimeout(() => {
    const go = () => {
      if (G.screen !== 'title' && G.screen !== 'levels') return;
      const L = LEVELS[clamp((save.unlocked || 1) - 1, 0, LEVELS.length - 1)];
      try { backdropFor(themeFor(L), L.id * 97); } catch (_) { /* built at level start instead */ }
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 1500 }); else go();
  }, 700);
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
  introAutoPick(G.level, i);
  G.sim = new Sim(G.level, { golden: !!opts.golden, mode: save.mode, ...G.boost, strike: strikeFor(G.level, i) });
  G.sim.ringSpeed = ringSpeed();
  // portals explain themselves the first time they show up anywhere (a practice vault has no intro card)
  if (G.sim.portals.some((pt) => pt.pull || Math.hypot(pt.ax - pt.bx, pt.ay - pt.by) > 0.05) && !save.seen.portalTip) {
    save.seen.portalTip = 1; G.portalTip = 1;
  }
  G.introFoe = null; G.stkPick = null; G.stkWob = -9; G.stkFullT = 0; G.henAt = null;
  G.golden = !!opts.golden;
  G.adBoost = opts.adBoost || null;
  G.freeRewind = !!G.boost.rewind;
  G.backdrop = backdropFor(G.theme, G.level.id * 97);
  G.weather = createWeather(G.level.weather || THEME_WEATHER[G.theme.id] || 'none', G.level.id * 31);
  G.weather.resize(W_, H_, DPR);
  W.setSkin(DR.trialSkin(save) || save.wallet.skin); // an egg skin on trial (the Director's win gift) is worn in play
  G.slow = G.card = G.hint = G.hintShow = null;
  G.lastEgg = false;
  G.snakeToast = false;
  G.predToast = {}; // predators (v3): first-time toasts
  // the "i" panel: who is in this vault, and whether any of it is new to this player (the HUD button pulses, "New!")
  G.infoKinds = villainKinds(G.level, G.sim);
  G.infoNew = G.infoKinds.some((k) => !save.seen['v:' + k]);
  G.iscroll = { y: 0, v: 0, max: 0, t: 0 };
  G.sscroll = { y: 0, v: 0, max: 0, t: 0 }; // the shop's card list (18 hens, 15 eggs: it scrolls)
  G.danger = 0;
  G.onewayTip = false; // v3
  G.hen = { mood: 'idle', t: 0 };
  G.fx = new FX();
  G.popups = [];
  G.toasts = [];
  G.toast = null;
  G.result = null;
  G.burstAt = null;
  G.usedRewind = false;
  G.starsLive = 3;
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
    audio.musicIntro(); // the world's short intro sting, then its loop
    toast(shortTip(G.level.tip), 3.2);
  }
}

function setScreen(s) {
  if (G.screen === 'intro' && s !== 'intro' && G.toast) G.toast = null; // the level page's hints stay on the level page
  G.screen = s;
  G.screenT = 0;
  G.scrSeq = (G.scrSeq || 0) + 1; // a frozen backdrop (frozenBack) belongs to one visit of one screen
  G.offerTried = false; // each end card / home visit / intro may ask the offer engine once
  if (s !== 'title') G.homeIntro = false; // the app-start entrance plays once; coming back to home only fades in
  ui.pressedId = null;
  if (s === 'title' || s === 'levels') warmNext();
  // 2026-11-16 mykee: "you don't have to put New on the i every single time": a kind is new in the first level it is
  // played in only, whether or not the player opens the panel (the tag stays up for the rest of that level)
  if (s === 'play' && G.infoNew && G.infoKinds && G.infoKinds.some((k) => !save.seen['v:' + k])) { for (const k of G.infoKinds) save.seen['v:' + k] = 1; persist(); }
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
// owner 2026-11-16: players come to play, not to read. A message is one short line (the first sentence, about six words)
// with an icon; the first-time tips keep two short sentences at most.
function shortToast(t) {
  if (!t || t.length <= 44) return t;
  const ss = t.split(/(?<=[.!?])\s/);
  let q = ss[0];
  if (q.length < 22 && ss[1]) q += ' ' + ss[1];
  if (q.length > 60) { const c = q.slice(0, 60); q = c.slice(0, c.lastIndexOf(' ')); }
  return q;
}
// the icon a message wears: given, else guessed from its words
function toastIcon(T) {
  if (T.icon) return T.icon;
  const t = T.text;
  if (/time/i.test(t)) return 'clock'; if (/coin|treasure|chest/i.test(t)) return 'coin'; if (/streak|rewound/i.test(t)) return 'flame';
  if (/egg/i.test(t)) return T.tip ? 'warn' : 'egg'; if (/frozen|freez|ice/i.test(t)) return 'freeze'; return T.tip ? 'warn' : null;
}
function toast(text, life = 2.6, icon = null) {
  if (!text) return;
  text = shortToast(text);
  // a short game message never waits behind a long villain tip: the tip steps aside (keeping the rest of its time) and
  // the message goes ahead of any queued tips
  if (G.toast && G.toast.tip) { G.toasts.unshift({ ...G.toast, life: Math.max(2.5, G.toast.life) }); G.toast = null; }
  const T = { text, life, icon }, i = G.toasts.findIndex((q) => q.tip);
  if (i < 0) G.toasts.push(T); else G.toasts.splice(i, 0, T);
}
// First-time villain / boss / hazard tips: they stay TIP_LIFE s of play (the clock stops while paused) or until tapped,
// and queue one after another instead of stacking. The same lines live on in the "i" panel.
const TIP_LIFE = 7;
function tipToast(text) {
  text = shortToast(text);
  if (!text || (G.toast && G.toast.text === text) || G.toasts.some((q) => q.text === text)) return;
  G.toasts.push({ text, life: TIP_LIFE, icon: null, tip: true });
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
  const u = ui.u, A = ui.A;
  const twoRows = A.w < 760 || A.h > A.w * 1.05; // a portrait tablet too (one row squeezed the title)
  // landscape phones (2026-11-16, mykee: "landscape needs proper work"): the HUD moves into a column on the left so the
  // vault gets the whole height of the screen instead of sitting under a top band
  G.sideHud = A.w > A.h * 1.3 && A.h < 560 * u;
  G.hudCol = G.sideHud ? Math.round(Math.min(200 * u, A.w * 0.24)) : 0;
  G.hudBottom = A.y + Math.round((G.sideHud ? 0 : twoRows ? 111 : 64) * u); // portrait: 7u more air under the two HUD rows (all inside the safe rect)
  // bosses (v3.1): the phase bar gets its own strip under the HUD plate (in the side column on a landscape phone)
  G.bossBar = G.level && G.level.bossFight ? Math.round(30 * u) : 0;
  if (!G.sideHud && !twoRows) G.hudBottom += G.bossBar; // portrait (two rows): the boss bar sits beside the eggs, no third row
  const top = G.hudBottom + 8 * u;
  // zoom buttons get their own strip (right column in landscape, bottom row in portrait) so they never sit on rings
  // (the bottom buttons are ~15% bigger than they were (48u), and sit on the safe rect, off the gesture bar)
  const bs = Math.max(46, 55 * u), pad = 8 * u, side = A.w > A.h;
  G.zb = { bs, pad, side, bot: A.y1 - 6 * u - bs };
  const sw = side ? bs + 2 * pad : 0, sh = side ? 0 : bs + pad + 2 * u;
  // the vault frames inside the safe rect (the playfield itself still paints edge to edge)
  const lw = G.sideHud ? G.hudCol + 2 * 12 * u : 0;
  G.play = { x: A.x + lw, y: top, w: A.w - sw - lw, h: A.y1 - top - 6 * u - sh };
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
  if (BQ && BQ.pad) R = Math.max(R, sim.outerR + BQ.pad); // L15: room for the frost gecko on the outside of the outer ring
  for (const hd of hds) {
    if (all) { R = Math.max(R, Math.abs(hd.x) + 0.6); yMin = Math.min(yMin, hd.y - 0.6); yMax = Math.max(yMax, hd.y + 0.6); }
    else { R = Math.max(R, Math.hypot(hd.x, hd.y) + 0.6); yMin = -R; yMax = R; }
  }
  const P = G.play;
  // a wide play area is height-limited: keep an even margin all round so the rings and the hen never touch the edge
  const m = camWide() ? 10 * ui.u : 0;
  const k = Math.min((P.w - 2 * m) / (2 * R), (P.h - 2 * m) / (yMax - yMin), 190);
  return { x: 0, y: (yMin + yMax) / 2, k, R, yMin, yMax };
}

// landscape: the play area is much wider than tall, so the vault is framed by its height. Zooming in on the eggs would
// crop the rings top and bottom (and the hen), so the camera rests on the whole vault and only the player's zoom moves it.
const camWide = () => !!G.play && G.play.w > G.play.h * 1.25;

// The base frame: the whole vault, or the eggs' rings; plus the player's own zoom. (The shot the camera rests on.)
function camBase() {
  const sim = G.sim, cv = G.cv;
  const n = sim.rings.length, eggs = sim.aliveEggs();
  let maxCh = 0;
  for (const e of eggs) maxCh = Math.max(maxCh, sim.channelOf(e));
  const live = G.screen === 'play' && sim.state === 'play';
  const sky = sim.eagle && sim.eagle.phase !== 'away'; // the eagle hunts round the outside: show all of it
  const whole = !live || sky || camWide() || maxCh >= n - 1 || (sim.nestAmp && maxCh >= n - 2) || n <= 2;
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
  if (camWide()) { cv.smooth = 0.5; return B; } // landscape: a steady whole-vault shot, no hunting
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
  // 2026-11-15 action cam (mykee: "no in-game camera movement"): during play the camera follows the action on its own:
  // it pushes in (up to ACTION_ZOOM) on the lead egg and the gap it is heading for, and pulls back out just enough to
  // keep every egg and any villain close to an egg in the shot. While a finger holds a ring the shot holds still, so the
  // ring never slides under the finger. Pinch and the zoom buttons still take over (G.zm), reduced motion keeps it still.
  if (!cv.sky && !boss && !sim.kc && !sim.water) { // bosses, the King Crab and the sea keep their framed shots
    if (sim.rings.some((r) => r.held || r.keyHeld) && cv.lastAct) return cv.lastAct;
    const fx0 = lerp(L.x, L.gx, 0.4), fy0 = lerp(L.y, L.gy, 0.4);
    const pts = [...eggPts];
    if (sim.stkTargets) for (const v of sim.stkTargets()) if (eggPts.some((p) => Math.hypot(p.x - v.x, p.y - v.y) < 2.6)) pts.push({ x: v.x, y: v.y });
    const k0 = Math.min(F.k * ACTION_ZOOM, 190);
    let T = keepInView({ x: lerp(F.x, fx0, 0.6), y: lerp(F.y, fy0, 0.6), k: k0 }, pts, 0.85);
    T.k = Math.max(T.k, F.k); // never wider than the whole vault
    // never show empty space past the vault when it could show vault instead
    const hw = P.w / (2 * T.k), hh = P.h / (2 * T.k);
    const mx = Math.max(0, F.R + 0.4 - hw);
    T.x = clamp(T.x, F.x - mx, F.x + mx);
    if (F.yMax - F.yMin > 2 * hh) T.y = clamp(T.y, F.yMin + hh, F.yMax - hh); else T.y = (F.yMin + F.yMax) / 2;
    cv.smooth = 0.9; // slow and soft: a camera operator, not a chase cam
    cv.lastAct = T;
    return T;
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
const ACTION_ZOOM = 1.32; // the action cam pushes in this far past the whole-vault frame at most
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

// moment camera: an ally's hit or a power chick's landing. The camera eases toward the point of contact, pushes in a
// modest 16%, holds, and eases back, all through the normal camera springs (just a pulled-in target). One at a time,
// never in reduced motion, never while a finger holds a ring (the shot must stand still under it).
function camMoment(x, y, hold = 0.6) {
  const cv = G.cv;
  if (save.calm || cv.mom || G.screen !== 'play' || !G.sim || G.sim.state !== 'play' || G.sim.rings.some((r) => r.held)) return;
  cv.mom = { x, y, t: 0, hold };
}
// 2026-11-16 (owner on L21: the crawlers need the salamander's close-ups): the crawlers' signature moves get the moment
// camera too. The frost gecko's lick and his frost breath / deep freeze (L15), a thorn-back's spike drop, flip and duel
// (L20), Sly's snatch and his sick cough (L26). At most one every CRAWL_GAP s so a busy fight never keeps the camera
// hunting; camMoment itself skips calm mode, a held ring and a moment already running.
const CRAWL_GAP = 5;
function crawlerMoment(ev) {
  const sim = G.sim, cv = G.cv;
  if (!sim || save.calm || G.t - (cv.crawlT ?? -99) < CRAWL_GAP) return;
  let x = ev.x, y = ev.y, hold = 0.6;
  switch (ev.type) {
    case 'geckoLick': x = (ev.x + ev.hx) / 2; y = (ev.y + ev.hy) / 2; hold = 0.75; break; // his tongue and the egg it freezes
    case 'chamSnatch': x = (ev.x + ev.hx) / 2; y = (ev.y + ev.hy) / 2; hold = 0.6; break; // the tongue and the orb
    case 'chamSick': hold = 0.75; break;
    case 'thornFlip': hold = 0.65; break;
    case 'thornDuel': hold = 1.1; break;
    case 'spikeUp': { if (ev.own == null) return; const C = (sim.sals || []).find((c) => c.id === ev.own); if (!C || !C.pts.length) return; x = (ev.x + C.pts[0].x) / 2; y = (ev.y + C.pts[0].y) / 2; hold = 0.5; break; } // the spike and the lizard that shed it
    case 'bossWarn': { // Baron von Brr winds up his frost breath or the deep freeze
      if (ev.kind !== 'blizzard' || (ev.attack !== 'gale' && ev.attack !== 'freeze')) return;
      const g = geckoAnchor(sim);
      if (!g) return;
      x = g.x; y = g.y; hold = 0.8; break;
    }
    default: return;
  }
  if (!(Number.isFinite(x) && Number.isFinite(y))) return;
  const was = cv.mom;
  camMoment(x, y, hold);
  if (cv.mom && cv.mom !== was) { cv.crawlT = G.t; camPunch(0.02, x, y); }
}
const MOM_IN = 0.18, MOM_OUT = 0.3, MOM_ZOOM = 1.16;
// the pulled-in version of the resting target T (weight 0..1 follows the moment's in, hold and out)
function camMomentTarget(T, dt) {
  const M = G.cv.mom;
  if (!M) return T;
  M.t += dt;
  const end = MOM_IN + M.hold + MOM_OUT;
  if (M.t >= end || save.calm || G.screen !== 'play') { G.cv.mom = null; return T; }
  const w = M.t < MOM_IN ? ss01(M.t / MOM_IN) : M.t > end - MOM_OUT ? ss01((end - M.t) / MOM_OUT) : 1;
  const k = T.k * MOM_ZOOM, P = G.play, hw = P.w / (2 * k), hh = P.h / (2 * k);
  // follow the point, but never show more than a little past the resting frame's edges
  const tx = clamp(M.x, T.x - (P.w / (2 * T.k)) * 0.45, T.x + (P.w / (2 * T.k)) * 0.45), ty = clamp(M.y, T.y - (P.h / (2 * T.k)) * 0.45, T.y + (P.h / (2 * T.k)) * 0.45);
  G.cv.smooth = lerp(G.cv.smooth || 0.4, 0.3, w);
  return { x: lerp(T.x, clamp(tx, T.x - hw * 0.3 - 1, T.x + hw * 0.3 + 1), w), y: lerp(T.y, ty, w), k: lerp(T.k, k, w) };
}

function updateCamera(dt) {
  const cv = G.cv, cam = G.cam;
  if (G.screen === 'pause' && !G.camSnap) return; // the shot holds under the pause card
  if (G.screen === 'play') cv.playT += dt;
  let T = camTarget();
  // 2026-11-16 (mykee: "screen stuck, hard to control" on L13): while a finger holds a ring the camera stands
  // completely still, so the ring under the finger never slides away from it. It eases on once the finger lets go.
  if (!G.camSnap && G.screen === 'play' && G.sim && G.sim.rings.some((r) => r.held)) { T = { x: cam.x, y: cam.y, k: cam.k }; cv.vx = cv.vy = cv.vk = 0; }
  if (!G.camSnap) T = camMomentTarget(T, dt); else G.cv.mom = null;
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
  if (G.adBusy || modalOpen()) { if (id) { ui.pressedId = id; G.pressPointer = e.pointerId; } return; } // a sheet or popup takes every tap (and an ad wait: only its "Back to game")
  const SC = G.screen === 'practice' ? G.pscroll : G.screen === 'info' ? G.iscroll : G.screen === 'store' ? G.sscroll : G.screen === 'pause' ? (G.ppRectR && x >= G.ppRectR.x ? G.ppageR : G.ppage) : null;
  if (SC) G.pdrag = { pid: e.pointerId, sc: SC, y0: y, s0: SC.y, moved: false, last: y, lt: performance.now(), v: 0, smp: [] };
  if (G.screen === 'intro') { // 2026-11-19 level page: the page scrolls up/down, the chick row left/right (the first clear move picks)
    const inR = (R) => R && x >= R.x && x <= R.x + R.w && y >= R.y && y <= R.y + R.h;
    const land = ui.A.w > ui.A.h * 1.15, cx = inR(G.carRect) && G.car && G.car.max > 0 ? G.car : null;
    const cy = inR(G.ipRect) && G.ipage && G.ipage.max > 0 ? G.ipage : land && inR(G.ipRectR) && G.ipageR && G.ipageR.max > 0 ? G.ipageR : null;
    if (cx || cy) G.pdrag = { pid: e.pointerId, cand: { x: cx, y: cy }, x0: x, y0: y, s0: 0, moved: false, last: y, lt: performance.now(), v: 0, smp: [] };
  }
  if (G.screen === 'levels' && G.mapTravel) G.mapTravel = null; // a touch during the trip: the map is the player's now
  if (G.screen === 'levels' && y > levelPageTop()) G.pdrag = { pid: e.pointerId, sc: G.mscroll, y0: y, s0: G.mscroll.y, moved: false, last: y, lt: performance.now(), v: 0, smp: [] }; // the world map scrolls by drag; a tap on a stop still presses
  if (id) { ui.pressedId = id; G.pressPointer = e.pointerId; return; }
  if (G.screen === 'info') { const C = G.infoCard; if (C && (x < C.x || x > C.x + C.w || y < C.y - 10 * ui.u || y > C.y + C.h + 6 * ui.u)) { G.pdrag = null; press('info:close'); } return; } // a tap off the card closes it
  if (G.screen === 'play' && G.toast && G.toast.tip && G.toastRect) { const R = G.toastRect; if (x >= R.x && x <= R.x + R.w && y >= R.y && y <= R.y + R.h) { G.toast.life = Math.min(G.toast.life, 0.2); return; } } // a tap on a villain tip puts it away
  if (G.screen === 'wonder') { wonder.pointerDown(e); try { canvas.setPointerCapture(e.pointerId); } catch (_) {} return; } // WONDER
  if (G.screen === 'title') {
    // hidden tester switch: tap the logo 7 times within 3 s to open (or lock again) every level and world
    const LR = ui.rects.find((r) => r.tag === 'title:logo');
    if (LR && x >= LR.x && x <= LR.x + LR.w && y >= LR.y && y <= LR.y + LR.h) {
      G.logoTaps = (G.logoTaps || []).filter((q) => G.t - q < 3); G.logoTaps.push(G.t);
      if (G.logoTaps.length >= 7) { G.logoTaps = []; save.tester = !save.tester; persist(); toast(save.tester ? 'Tester mode: every level open' : 'Tester mode off', 2.4); }
    }
    if (titleTap(x, y)) audio.play('hen_hop', { vol: 0.6 }); return;
  } // tap an egg friend: it jumps and flips (only the buttons start a level)
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
  if (G.sim.stkOn()) { const pk = G.sim.stkPickAt(w.x, w.y); if (pk) G.stkPick = { key: pk, t: G.t }; } // Chick Strike: a tapped creature is the next target (1.5 s)
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

const TOUCH_TURN_GAIN = 1.3;
function pointerMove(e) {
  const x = e.clientX, y = e.clientY;
  G.pointer = { x, y };
  const pd = G.pdrag;
  if (pd && pd.pid === e.pointerId && (G.screen === 'practice' || G.screen === 'info' || G.screen === 'levels' || G.screen === 'store' || G.screen === 'intro')) {
    if (!pd.moved && pd.cand) { // the level page: two scrollers under the finger, the first clear move picks the axis
      const dx = x - pd.x0, dy = y - pd.y0;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 9 * ui.u) {
        const ax = Math.abs(dx) > Math.abs(dy) ? (pd.cand.x ? 'x' : null) : (pd.cand.y ? 'y' : null);
        if (!ax) { G.pdrag = null; return; }
        pd.ax = ax; pd.sc = pd.cand[ax]; pd.moved = true; ui.pressedId = null; pd.y0 = ax === 'x' ? x : y; pd.s0 = pd.sc.y;
      }
    } else if (!pd.moved && Math.abs(y - pd.y0) > 9 * ui.u) { pd.moved = true; ui.pressedId = null; pd.y0 = y; pd.s0 = pd.sc.y; } // no jump by the 9 px slop
    if (pd.moved) {
      // 2026-11-19 (mykee: "the scroll is so slow"): the fling speed is the finger's speed over its last ~100 ms (every
      // coalesced touch point counts), not a smoothed per-event guess that lagged behind a quick flick
      // (pd.ax 'x': a sideways row; its offset still lives in sc.y and pd.y0 holds the start x)
      const hx = pd.ax === 'x', c = hx ? x : y;
      const now = performance.now(), pts = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      if (pts.length) for (const q of pts) pd.smp.push([hx ? q.clientX : q.clientY, q.timeStamp || now]); else pd.smp.push([c, now]);
      while (pd.smp.length > 2 && now - pd.smp[0][1] > 100) pd.smp.shift();
      pd.last = c; pd.lt = now;
      pd.sc.y = clamp(pd.s0 + pd.y0 - c, 0, pd.sc.max); pd.sc.v = 0;
    }
    return;
  }
  if (G.screen === 'wonder') { wonder.pointerMove(e); return; } // WONDER
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
    // touch gain: a thumb sweeps a short arc, so a finger turns the ring a bit further than it travels (a mouse stays 1:1)
    const dTheta = (-(px * dy - py * dx) / (rr * rr)) * (e.pointerType === 'mouse' ? 1 : TOUCH_TURN_GAIN);
    h.ring.target += dTheta;
    onewayDrag(h, dTheta);
    h.x = x;
    h.y = y;
  } else if (e.pointerType === 'mouse' && G.screen === 'play' && G.sim) {
    const w = toWorld(x, y);
    G.hover = G.sim.ringAt(Math.hypot(w.x, w.y), Math.atan2(w.y, w.x));
  }
}

// the speed a released drag carries on with (px/s, + = content moves up): the finger's travel over its last ~100 ms;
// a finger that stopped before lifting carries nothing
function flingSpeed(pd) {
  const now = performance.now(), S = pd.smp || [];
  if (S.length < 2 || now - S[S.length - 1][1] > 90) return 0;
  const a = S[0], b = S[S.length - 1], dt = Math.max(16, b[1] - a[1]);
  return clamp(((a[0] - b[0]) / dt) * 1000 * 1.15, -7000, 7000);
}
function pointerUp(e) {
  const pd = G.pdrag;
  if (pd && pd.pid === e.pointerId) { if (pd.moved && pd.sc) pd.sc.v = flingSpeed(pd); G.pdrag = null; }
  if (G.screen === 'wonder') wonder.pointerUp(e); // WONDER
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
  if (modalOpen()) return;
  const SC = G.screen === 'practice' ? G.pscroll : G.screen === 'info' ? G.iscroll : G.screen === 'store' ? G.sscroll : G.screen === 'levels' ? G.mscroll : G.screen === 'pause' ? (G.ppRectR && e.clientX >= G.ppRectR.x ? G.ppageR : G.ppage) : G.screen === 'intro' ? (e.shiftKey && G.car ? G.car : G.ipRectR && ui.A.w > ui.A.h * 1.15 && e.clientX >= G.ipRectR.x ? G.ipageR : G.ipage) : null;
  if (SC) { e.preventDefault(); SC.y = clamp(SC.y + clamp(e.deltaY * (e.deltaMode === 1 ? 32 : 1), -400, 400), 0, SC.max); SC.v = 0; return; } // 2026-11-19: the world map scrolls with a mouse wheel too
  if (G.screen !== 'play' || !G.sim || G.sim.state !== 'play') return;
  e.preventDefault();
  setZoom((G.zm || 0) - clamp(e.deltaY, -120, 120) * 0.003);
}

function keyDown(e) {
  onFirstInput();
  const k = e.key;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(k)) e.preventDefault();
  G.keys[k.toLowerCase()] = true;
  if (modalOpen()) { if (k === 'Escape') { if (G.parent) G.parent = null; else if (G.getMore) G.getMore = null; else if (G.chickBuy) G.chickBuy = null; else if (G.detail) G.detail = null; else if (G.offer) press('of:no'); else if (G.treasure) G.treasure = null; } return; }
  if (G.screen === 'info' && !e.repeat && (k === 'Escape' || k === 'i' || k === 'I' || k === 'Enter' || k === ' ')) { press('info:close'); return; } // the "i" panel
  if (G.screen === 'info' && (k === 'ArrowDown' || k === 'ArrowUp' || k === 'PageDown' || k === 'PageUp')) { const S = G.iscroll, d = (k.startsWith('Page') ? 0.8 * H_ : 60 * ui.u) * (k.endsWith('Up') ? -1 : 1); S.y = clamp(S.y + d, 0, S.max); S.v = 0; return; }
  if ((k === 'i' || k === 'I') && !e.repeat && (G.screen === 'play' || G.screen === 'pause')) { press('info'); return; }
  if ((k === 'Escape' || k === 'p' || k === 'P') && !e.repeat) {
    if (G.screen === 'play') press('pause');
    else if (G.screen === 'pause') press('resume');
    else if (k === 'Escape' && (G.screen === 'practice' || G.screen === 'extras')) press('back');
    return;
  }
  if (G.screen === 'play' && G.sim) {
    if (k === 'ArrowUp' || k === 'w' || k === 'W') G.keySel = firstGrabbable(Math.min(G.sim.rings.length - 1, G.keySel + 1), 1);
    if (k === 'ArrowDown' || k === 's' || k === 'S') G.keySel = firstGrabbable(Math.max(0, G.keySel - 1), -1);
    if (/^[1-7]$/.test(k)) G.keySel = Math.min(G.sim.rings.length - 1, +k - 1);
    if ((k === ' ' || k === 'c' || k === 'C') && !e.repeat) { const c = G.sim.aliveEggs().find((x) => G.sim.canTap(x)); if (c) G.sim.tapChick(c.id); else if (G.sim.laserReady()) { const L = G.sim.aliveEggs().sort((a, b) => G.sim.channelOf(b) - G.sim.channelOf(a))[0], p = L ? L.body.getPosition() : { x: 0, y: -1 }; G.sim.fireLaser(Math.atan2(p.y, p.x)); } } // v3.2: space taps a ready chick (v3.4: else fires the laser along the leading egg)
  } else if ((k === 'Enter' || k === ' ') && !e.repeat) {
    if (G.screen === 'win' && !(G.result && winIn(G.result) >= 1)) return skipCheer();
    const primary = { title: 'play', intro: G.level.intro && !save.intro[G.level.id] && !worldOpener(G.level) ? 'gotit' : 'go', win: 'next', fail: 'retry', pause: 'resume' }[G.screen];
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
  audio.play(id === 'pause' || id === 'levels' || id === 'practice' ? 'ui_back' : 'ui_tap');
  if (id.startsWith('foe:')) { const k = id.slice(4); G.introFoe = G.introFoe === k ? null : k; return; } // intro: a villain portrait opens its one-line card
  switch (id) {
    case 'ad:back': ads.cancelWait(); break; // an ad that never said it closed: back to the game (no reward)
    case 'zoom:in': setZoom((G.zm || 0) + 0.34); break;
    case 'zoom:out': setZoom((G.zm || 0) - 0.34); break;
    case 'zoom:auto': G.zm = null; break;
    case 'strike': fireStrike(); break; // Chick Strike
    case 'bank': if (G.screen === 'play' && G.sim && G.sim.fireBanked()) audio.play('unlock', { pitch: 1.3 }); break; // a saved chick's kept power
    case 'stk:gotit': { const id = G.stkCard; save.strikeSeen = { ...(save.strikeSeen || {}) }; for (const S of strikesOpen()) save.strikeSeen[S.id] = 1; if (id) { G.stkSel = { lid: G.level.id, id }; G.sim.stkEquip(strikeFor(G.level, G.li)); } G.stkCard = null; persist(); break; }
    case 'ally': {
      // allies (v3.5): free on Easy and after a fail; otherwise a rewarded ad (never costs progress, the button stays on a miss)
      if (G.screen !== 'play' || !allyShown()) break;
      if (!allyKinds().some((k) => G.sim.allyCan(k))) { toast('Nothing for a farm friend to help with yet.', 2.2); break; }
      if (G.roosterCoach) { save.seen = { ...(save.seen || {}), rooster: 1 }; persist(); G.allyAd = true; G.roosterCoach = false; } // the lesson: his first call is on the house
      if (!allyFree() && !G.allyAd && save.wallet.tickets.ally > 0) { // an Ally Ticket (shop) stands in for the ad
        const w = E.useTicket(save.wallet, 'ally');
        if (w) { save.wallet = w; persist(); G.allyAd = true; toast(`Ally Ticket used (${w.tickets.ally} left)`, 2); }
      }
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
      // 2026-11-20 (mykee: "people wouldn't even look at the map"): home's PLAY opens the map, Angry Birds style, with
      // the hen at the next level; one more tap there opens the level page
      const i = nextIdx();
      portal.gameplayStop();
      G.world = envOf(i); G.mapTravel = null; G.toasts = []; G.toast = null;
      setScreen('levels');
      break;
    }
    case 'levels':
      portal.gameplayStop();
      if (G.screen !== 'title' && G.demo && G.level === G.demo) { setScreen('practice'); break; } // a practice vault goes back to the Practice screen, where it was opened
      G.world = clamp(envOf(nextIdx()), 0, Math.ceil(LEVELS.length / PER_ENV) - 1);
      setScreen('levels');
      break;
    case 'go': {
      if (G.screen === 'intro' && introChicks().need) { // a first-timer picks a chick first: PLAY takes them to the chick row
        if (ui.A.w > ui.A.h * 1.15) { if (G.ipageR && G.ipAnchorR && G.ipAnchorR.chick != null) G.ipageR.to = G.ipAnchorR.chick; }
        else { G.itab = 'chicks'; if (G.ipage) { G.ipage.y = 0; G.ipage.v = 0; G.ipage.to = null; } } // portrait: the Chicks tab
        G.pickNudge = G.t; toast('Pick a chick to take along first', 2); break;
      }
      { const T = introChicks(); if (T.id) { save.lastStk = T.id; if (T.choice) save.seen.pickN = (save.seen.pickN || 0) + 1; persist(); } }
      if (worldOpener(G.level)) { save.intro[G.level.id] = 1; persist(); }
      // owned boosters picked on the intro card are spent now and the level restarts with them
      const boost = { ...G.boost }; // keeps a booster the intro ad already gave
      let picked = 0;
      for (const b of G.boostSel) {
        if (b === 'golden' && G.golden) continue; // the golden-shell ad already gave one
        const w = E.useBooster(save.wallet, b);
        if (w) { save.wallet = w; boost[b] = true; picked++; }
      }
      G.boostSel.clear();
      // the win streak's free start boosters (Director: two or more levels won in a row)
      const hot = G.li >= 0 ? DR.hotBoosts(save).filter((b) => !boost[b]) : [];
      for (const b of hot) { boost[b] = true; picked++; }
      if (picked) {
        persist();
        startLevel(G.li, { direct: true, golden: G.golden || boost.golden, boost, adBoost: G.adBoost });
        if (hot.length) toast(`Win streak ${DR.hotCount(save)}: free ${hot.map((b) => E.BOOSTERS[b].name).join(' + ')}!`, 3);
        break;
      }
      setScreen('play');
      portal.gameplayStart();
      audio.musicIntro(); // the world's short intro sting, then its loop
      toast(shortTip(G.level.tip), 3.4);
      break;
    }
    case 'daily':
      startLevel(-1);
      break;
    case 'stk:buy:freeze': case 'stk:buy:thunder': case 'stk:buy:bomb': case 'stk:buy:decoy': case 'stk:buy:tornado': case 'stk:buy:glue':
    case 'stk:buy:phoenix': case 'stk:buy:tock': case 'stk:buy:bubble':
      G.chickBuy = id.slice(8); // a locked chick on the intro: its small buy sheet
      break;
    case 'stk:pick:freeze': case 'stk:pick:thunder': case 'stk:pick:bomb': case 'stk:pick:decoy': case 'stk:pick:tornado': case 'stk:pick:glue':
    case 'stk:pick:phoenix': case 'stk:pick:tock': case 'stk:pick:bubble':
      { const pid = id.slice(9), cur = G.sim.stk && G.sim.stk.id; G.stkSel = { lid: G.level.id, id: cur === pid && strikesOpen().length < 2 ? null : pid }; G.introPick = { id: pid, t: G.t }; } // a lone chick toggles; with a choice, a tap picks
      G.sim.stkEquip(strikeFor(G.level, G.li));
      audio.play('cluck', { pitch: 2.2, vol: 0.5 });
      break;
    case 'gotit':
      save.intro[G.level.id] = 1;
      persist();
      break;
    case 'shop':
    case 'store':
      openStore('deals');
      break;
    case 'home': // back to the title from the shop or the pause card (the level in progress is left)
      goHome();
      break;
    case 'store:coins': // the balance's "+": the coin packs on Deals
      openStore('deals', 'coins');
      break;
    case 'home:bank': // the glass egg on home: the Golden Egg Bank card
      openStore('deals', 'bank');
      break;
    case 'home:hen':
      G.henHomeHop = G.t + 1.2; G.henHomeN = (G.henHomeN || 0) + 1; audio.play('hen_hop', { vol: 0.6 });
      openStore('hens');
      break;
    case 'home:chest': {
      const w = E.openDailyChest(save.wallet, today());
      if (!w) { toast('Come back tomorrow for another chest.', 2.2); break; }
      const R = E.dailyChest(today());
      save.wallet = w; persist(); audio.play('unlock');
      toast(`Treasure! +${R.coins} coins, +${R.charges} Chick Charge${R.charges > 1 ? 's' : ''}`, 3);
      break;
    }
    case 'home:premium':
      openStore('deals');
      break;
    case 'home:charge': { // Premium's free Chick Charge of the day
      const w = E.claimPremiumCharge(save.wallet, today());
      if (w) { save.wallet = w; persist(); audio.play('unlock'); toast('Your free Chick Charge for today. Thank you for Premium!', 2.8); }
      break;
    }
    case 'gate:0': case 'gate:1': case 'gate:2': case 'gate:3': case 'gate:4': case 'gate:5': case 'gate:6': case 'gate:7': case 'gate:8': case 'gate:9': {
      const k = +id.slice(5), price = GATE_COINS(k);
      if (envOpen(k)) break;
      if (save.wallet.coins < price) { needCoins(price); break; }
      save.wallet = { ...save.wallet, coins: save.wallet.coins - price };
      save.gates = { ...(save.gates || {}), [k]: 1 };
      persist(); audio.play('unlock'); toast(`${WORLDS[k] || 'World'} is open!`, 2.4);
      break;
    }
    case 'tab:deals':
    case 'tab:boosters':
    case 'tab:hens':
    case 'tab:skins':
      G.storeTab = id.slice(4);
      G.sscroll = { y: 0, v: 0, max: 0, t: G.t };
      G.detail = null;
      break;
    case 'premium':
      await buyIap(PREMIUM_SKU);
      break;
    case 'gm:close':
      G.getMore = null;
      break;
    case 'dt:close':
      G.detail = null;
      break;
    case 'help:go': await takeHelp(); break;
    case 'nudge:no': if (G.nudge && G.nudge.kind === 'keep') DR.clearKeepAsk(save); G.nudge = null; persist(); break;
    case 'nudge:yes': {
      const n = G.nudge;
      if (!n) break;
      if (n.kind === 'keep') {
        const w = E.buySkin(save.wallet, n.id);
        if (!w) { needCoins(n.price); break; }
        save.wallet = w; DR.clearKeepAsk(save); W.setSkin(w.skin); G.nudge = null; persist(); audio.play('unlock'); toast(`The ${n.name} Egg is yours!`, 2.4);
      } else if (n.kind === 'welcome') {
        const b = E.BOOSTER_ORDER[Math.floor(Math.random() * 5)];
        save.wallet = { ...save.wallet, coins: save.wallet.coins + n.coins, owned: { ...(save.wallet.owned || {}), [b]: ((save.wallet.owned || {})[b] || 0) + 1 } };
        G.nudge = null; persist(); audio.play('level_win'); toast(`+${n.coins} coins and a free ${E.BOOSTERS[b].name}!`, 2.8);
      } else if (n.kind === 'afford') {
        G.nudge = null; persist();
        openStore(n.item.startsWith('chick:') ? 'boosters' : 'skins');
      }
      break;
    }
    case 'of:no': // "No thanks" on an offer
      if (G.offer) { OF.markDismissed(save, G.offer, Date.now(), G.offer.lv); persist(); }
      G.offer = null;
      break;
    case 'of:buy': {
      const O = G.offer;
      G.offer = null;
      if (O && O.sku) await buyIap(O.sku);
      break;
    }
    case 'of:ad': { // a rewarded offer: a free Chick Charge, or free coins
      const O = G.offer;
      G.offer = null;
      if (!O) break;
      if (O.item === 'coins') { await press('ad:coins'); break; }
      if (await rewarded('charge')) {
        save.wallet = { ...save.wallet, charges: Math.min(E.MAX_CHARGES, save.wallet.charges + 1) };
        persist(); audio.play('unlock'); toast('A Chick Charge is in your bag. Send your chick any time!', 2.8);
      } else { OF.markDismissed(save, O, Date.now(), O.lv); persist(); } // no ad: counts as declined (the helper may follow later)
      break;
    }
    case 'age:u13': case 'age:13':
      save.age = id === 'age:u13' ? 'u13' : '13+';
      G.ageAsk = false; persist();
      ads.setChildSafe(save.age === 'u13');
      break;
    case 'age:later':
      G.ageAsk = false; G.ageLater = true; // asked again next launch
      break;
    case 'pc:0': case 'pc:1': case 'pc:2': {
      const P = G.parent;
      G.parent = null;
      if (!P) break;
      if (P.q.choices[+id.slice(3)] === P.q.answer) await buyIap(P.sku, true);
      else toast('Not quite. Ask a grown-up to help.', 2.4);
      break;
    }
    case 'pc:cancel':
      G.parent = null;
      break;
    case 'cb:buy': // the intro's chick sheet: unlock it for coins and pick it for this level
      if (G.chickBuy) { const k = G.chickBuy; if (buyChickForLevel(k)) G.chickBuy = null; }
      break;
    case 'cb:close':
      G.chickBuy = null;
      break;
    case 'gm:shop': // "Open shop": the coin packs on Deals (from inside the shop too)
      G.getMore = null;
      openStore('deals', 'coins');
      break;
    case 'gm:ad':
      await press('ad:coins');
      break;
    case 'ad:coins': {
      if (adCd() > 0) break;
      const pay = adCoins(), ok = await rewarded('coins');
      if (ok) {
        save.wallet = E.addCoins(save.wallet, pay);
        save.adClaim = Date.now();
        save.adDay = E.noteFreeCoins(save.adDay, today());
        G.storeFlash = { id: 'ad', t0: G.t };
        persist();
        audio.play('combo', { intensity: 0.5 });
        if (G.getMore && save.wallet.coins >= G.getMore.price) { G.getMore = null; toast('Now you have enough coins!', 2.2); }
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
    case 'tr:close': G.treasure = null; break;
    case 'tr:open': { // the boss treasure: paid once, then the sheet shows what came out
      const T = G.treasure, w = T && bossBeaten(T.id) ? E.openBossTreasure(save.wallet, T.id) : null;
      if (w) { save.wallet = w; persist(); audio.play('level_win'); vibrate(30); T.openedAt = G.t; }
      break;
    }
    case 'tr:shop': G.treasure = null; openStore('boosters'); break;
    case 'tr:play': { const T = G.treasure; G.treasure = null; const i = LEVELS.findIndex((Lv) => Lv.id === T.id); if (i >= 0 && playable(i)) startLevel(i); break; }
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
    case 'info': // the "i" panel: what the villains here do. From play it pauses the game; closing resumes.
      if (!G.sim || !G.infoKinds.length) break;
      if (G.screen === 'play' && G.sim.state === 'play') { G.infoFrom = 'play'; portal.gameplayStop(); releaseAll(); }
      else if (G.screen === 'pause') G.infoFrom = 'pause';
      else break;
      openInfo();
      break;
    case 'info:close':
      if (G.screen !== 'info') break;
      if (G.infoFrom === 'pause') setScreen('pause');
      else if (G.infoFrom === 'wonder') setScreen('wonder');
      else { setScreen('play'); portal.gameplayStart(); }
      break;
    case 'finish':
      if (G.screen === 'play' && G.sim && G.sim.finish()) audio.play('unlock');
      break;
    case 'restart':
    case 'retry':
      portal.gameplayStop();
      if (id === 'retry' && G.screen === 'fail') { save.streak = 0; persist(); }
      startLevel(G.li, { direct: true });
      break;
    case 'next': {
      // 2026-11-20 (Google Play ad policy: no interstitial as a level begins, none between a tap and what it starts):
      // the between-levels break, when one is due, comes here, as the player leaves the score card, before the map
      if (G.adBusy) break;
      if (G.screen === 'win') await breakThen(() => {});
      const n = Math.min(LEVELS.length - 1, G.li + 1);
      if (G.li < 0) { setScreen(G.demo && G.level === G.demo ? 'practice' : 'title'); break; }
      if (G.li === LEVELS.length - 1) { setScreen('levels'); break; }
      if (!playable(n)) { G.world = envOf(n); setScreen('levels'); break; } // the next environment waits behind its star gate
      // 2026-11-20 (mykee: show the map between stages): back to the map, the hen hops along the road to the next stop,
      // and its level page opens on arrival (a tap anywhere first stops the trip and leaves the map in the player's hands)
      portal.gameplayStop();
      G.world = envOf(n); G.mapTravel = { from: G.li, to: n, t0: -1 }; G.toasts = []; G.toast = null;
      setScreen('levels');
      break;
    }
    case 'skip:ad': {
      if (G.screen !== 'fail') break;
      if (await rewarded('skip')) skipLevel();
      break;
    }
    case 'skip:ticket': {
      if (G.screen !== 'fail' || !(G.li >= 0 && ads.stuck(G.level.id))) break;
      const w = E.useTicket(save.wallet, 'skip');
      if (w) { save.wallet = w; persist(); skipLevel(); }
      break;
    }
    case 'skip:coins': {
      if (G.screen !== 'fail') break;
      if (save.wallet.coins < SKIP_COINS) { needCoins(SKIP_COINS); break; }
      save.wallet = { ...save.wallet, coins: save.wallet.coins - SKIP_COINS };
      skipLevel();
      break;
    }
    case 'rewind': {
      // a Free rewind booster pays for it; otherwise it is a rewarded ad
      const free = G.freeRewind;
      const ok = free || await rewarded('rewind');
      if (free) G.freeRewind = false;
      const back = ok && G.sim.rewind(5);
      if (back) rewound(back);
      break;
    }
    case 'rewind:coins': { // Royal Match's continue: coins instead of a video, a little dearer each time on this level
      if (G.screen !== 'fail' || G.usedRewind || !G.sim.canRewind()) break;
      const lid = G.level.id, price = DR.rewindPrice((G.rewindBuys || {})[lid]);
      if (save.wallet.coins < price) { needCoins(price); break; }
      const back = G.sim.rewind(5);
      if (!back) break;
      save.wallet = { ...save.wallet, coins: save.wallet.coins - price };
      G.rewindBuys = { ...(G.rewindBuys || {}), [lid]: ((G.rewindBuys || {})[lid] || 0) + 1 };
      persist();
      rewound(back);
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
    case 'settings':
      G.settingsOpen = true;
      break;
    case 'set:close':
      G.settingsOpen = false;
      break;
    case 'stab:display': case 'stab:gameplay': case 'stab:sound':
      G.setTab = id.slice(5);
      break;
    case 'gfx:auto': case 'gfx:high': case 'gfx:medium': case 'gfx:low':
      save.gfx = id.slice(4);
      if (save.gfx === 'auto') save.gfxStep = -1; // Auto starts again from the phone's own guess
      applySettings(save); setDPR(); persist();
      break;
    case 'set:fpsshow':
      save.showFps = !save.showFps; persist();
      break;
    case 'fps:auto': case 'fps:30': case 'fps:60':
      save.fps = id === 'fps:auto' ? 'auto' : +id.slice(4);
      applySettings(save); persist();
      break;
    case 'set:restore':
      ads.restore(); toast('Checking your purchases...', 2);
      break;
    case 'rs:-': case 'rs:+': case 'rs:0': case 'rs:1': case 'rs:2': case 'rs:3': case 'rs:4': case 'rs:5': case 'rs:6': {
      const k = RING_SPEEDS.indexOf(ringSpeed()), n = id === 'rs:-' ? k - 1 : id === 'rs:+' ? k + 1 : +id.slice(3);
      save.ringSpeed = RING_SPEEDS[clamp(n, 0, RING_SPEEDS.length - 1)];
      if (G.sim) G.sim.ringSpeed = save.ringSpeed;
      persist();
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
    case 'vibe':
      save.vibe = save.vibe === false;
      persist();
      if (save.vibe) buzz('win');
      break;
    case 'practice': // the Practice screen: every studio vault as a tile (also reachable from the pause card)
      portal.gameplayStop();
      setScreen('practice');
      break;
    case 'back':
      G.getMore = null; G.detail = null;
      setScreen(G.screen === 'store' ? G.storeFrom || 'title' : G.screen === 'practice' ? 'extras' : 'title');
      break;
    case 'extras': // the Extras menu: Wonder Vaults (bonus) and, in the test build, the Practice vaults
      portal.gameplayStop();
      setScreen('extras');
      break;
    default:
      if (id && id.startsWith('tr:boss:')) { G.treasure = { id: +id.slice(8), t: G.t, openedAt: null }; } // a boss treasure on the map
      else if (id === 'how:next') { if (G.how) { G.how.i++; G.how.t0 = G.t; } }
      else if (id && id.startsWith('lv:')) {
        const i = +id.slice(3);
        if (playable(i)) startLevel(i);
      } else if (id && id.startsWith('demo:')) {
        // test build: the chick lab (v3.2), one practice vault per chick kind
        const k = id.slice(5), d = k === 'frog' ? FROG_DEMO : [...CHICK_DEMOS, ...SEA_DEMOS, ...POWER_DEMOS, ...THIEF_DEMOS, ...ALLY_DEMOS, ...REEF_DEMOS, ...BAYOU_DEMOS, ...LAB_DEMOS].find((x) => x.kind === k);
        if (d) { G.demo = d; startLevel(-2); }
      } else if (id && id.startsWith('wv:')) { // WONDER: the bonus world's own buttons
        wonder.press(id);
      } else if (id && id.startsWith('mode:')) {
        save.mode = id.slice(5);
        persist();
      } else if (id && id.startsWith('boost:')) {
        const b = id.slice(6);
        if (G.boostSel.has(b)) G.boostSel.delete(b); else G.boostSel.add(b);
        G.boostLast = b;
      } else if (id && id.startsWith('itab:')) { // the level page's tabs
        if (G.itab !== id.slice(5)) { G.itab = id.slice(5); if (G.ipage) { G.ipage.y = 0; G.ipage.v = 0; G.ipage.to = null; } }
      } else if (id && id.startsWith('tile:')) { // a shop tile: its detail sheet
        const k = id.slice(5);
        if (k.startsWith('go:')) await press('tab:' + k.slice(3)); // the web shop's "Spend your coins" tiles: a tab
        else G.detail = k;
      } else if (id && (id.startsWith('iap:') || id.startsWith('feat:') || id.startsWith('gm:iap:'))) {
        await buyIap(id.slice(id.lastIndexOf(':') + 1));
      } else if (id && id.startsWith('buy:')) {
        const k = id.slice(4), w = E.buy(save.wallet, k);
        if (w) { save.wallet = w; persist(); G.storeFlash = { id: k, t0: G.t }; audio.play('unlock'); }
        else if (E.BOOSTERS[k] && E.ownedCount(save.wallet, k) < E.MAX_OWNED) needCoins(E.BOOSTERS[k].price);
      } else if (id && id.startsWith('item:')) {
        const k = id.slice(5), w = E.buyItem(save.wallet, k);
        if (w) { save.wallet = w; persist(); G.storeFlash = { id, t0: G.t }; audio.play('unlock'); }
        else if (E.ITEMS[k] && save.wallet.coins < E.ITEMS[k].price) needCoins(E.ITEMS[k].price);
      } else if (id && id.startsWith('chick:')) {
        const k = id.slice(6), w = E.buyChick(save.wallet, k);
        if (w) { save.wallet = w; persist(); G.storeFlash = { id, t0: G.t }; audio.play('unlock'); toast(`${(STRIKES.find((S) => S.id === k) || {}).name || 'Power chick'} is yours!`, 2.4); }
        else if (E.CHICK_PRICES[k] && save.wallet.coins < E.CHICK_PRICES[k]) needCoins(E.CHICK_PRICES[k]);
      } else if (id && id.startsWith('charge:')) {
        const w = E.buyCharges(save.wallet, id.slice(7)), P = E.CHARGE_PACKS.find((q) => q.id === id.slice(7));
        if (w) { save.wallet = w; persist(); G.storeFlash = { id, t0: G.t }; audio.play('unlock'); }
        else if (P && save.wallet.coins < P.price) needCoins(P.price);
      } else if (id && id.startsWith('hen:')) {
        const k = id.slice(4);
        const w = E.ownsHenSkin(save.wallet, k) ? E.equipHenSkin(save.wallet, k) : E.buyHenSkin(save.wallet, k);
        if (w) { save.wallet = w; persist(); G.storeFlash = { id, t0: G.t }; audio.play('unlock'); }
        else if (E.HEN_SKINS[k] && save.wallet.coins < E.HEN_SKINS[k].price) needCoins(E.HEN_SKINS[k].price);
      } else if (id && id.startsWith('skin:')) {
        const k = id.slice(5);
        const w = E.ownsSkin(save.wallet, k) ? E.equipSkin(save.wallet, k) : E.buySkin(save.wallet, k);
        if (w) { save.wallet = w; persist(); W.setSkin(w.skin); G.storeFlash = { id, t0: G.t }; audio.play('unlock'); }
        else if (E.SKINS[k] && save.wallet.coins < E.SKINS[k].price) needCoins(E.SKINS[k].price);
      }
  }
}

// the "i" panel opens: refresh the list from the live sim (a boss may have called more in), count it all as seen
function openInfo() {
  G.infoKinds = villainKinds(G.level, G.sim);
  let fresh = false;
  for (const k of G.infoKinds) if (!save.seen['v:' + k]) { save.seen['v:' + k] = 1; fresh = true; }
  if (fresh) persist();
  G.infoNew = false;
  G.iscroll = { y: 0, v: 0, max: 0, t: G.t };
  G.pdrag = null;
  setScreen('info');
}

// 0.8.1 ad wait (mykee's test ad: "no option for us to go back"). While an ad is up the app is covered and no frames
// run here, so G.adVis counts only the time the game is on screen again with the ad still not reported closed: the
// ad's screen was dropped (app reopened from its icon, the system cleaned it up). After 1.5 s a "Back to game" button
// shows; after 8 s the game lets go by itself. Back does the same at any time.
function adWatch(ms) {
  if (document.hidden) return;
  G.adVis = (G.adVis || 0) + Math.min(ms, 100) / 1000;
  if (G.adVis > 8) ads.cancelWait();
}
function drawAdWait(W_, H_) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, W_, H_);
  ui.buttons.length = 0; ui.rects.length = 0; // nothing under the shade takes a tap while an ad is pending
  if ((G.adVis || 0) < 1.5) return;
  const s = ui.u, w = Math.min(320 * s, W_ - 40 * s), h = 150 * s, x = (W_ - w) / 2, y = (H_ - h) / 2;
  ui.panel(x, y, w, h, { r: 20 * s });
  ui.text('Waiting for the ad to close', W_ / 2, y + 34 * s, { size: 19 * s, align: 'center', maxW: w - 30 * s, color: '#fff6dc', noRecord: true });
  ui.button('ad:back', 'Back to game', x + 30 * s, y + 70 * s, w - 60 * s, 56 * s, { kind: 'secondary', size: 21 * s });
}

function releaseAll() {
  for (const h of G.held.values()) h.ring.held = false;
  G.held.clear();
}

// back 5 seconds into the level from the fail card (a video, coins or a Free rewind): the run and the win streak go on
function rewound(back) {
  releaseAll();
  stopFuse();
  G.sim = back;
  G.run = (G.run || 0) + 1;
  G.usedRewind = true;
  G.lastEgg = false;
  G.hint = G.hintShow = G.card = G.slow = null;
  G.fx = new FX();
  G.failHelp = null;
  DR.keepHot(save); persist();
  setScreen('play');
  portal.gameplayStart();
  audio.play('rewind');
  toast('Rewound 5 seconds. Streak kept!', 2.4);
}

async function breakThen(fn, info = {}) {
  if (G.adBusy) return;
  G.adBusy = true; G.adVis = 0;
  portal.gameplayStop();
  try { await ads.between({ levelId: G.level && G.li >= 0 ? G.level.id : 0, afterFail: G.screen === 'fail' || (G.li >= 0 && G.level && DR.frustration(save, G.level.id) >= 0.5), ...info }); } catch (_) {} // no ad break on a losing streak
  G.adBusy = false;
  fn();
}

async function rewarded(tag) {
  if (G.adBusy) return false;
  G.adBusy = true; G.adVis = 0;
  portal.gameplayStop();
  let ok = false;
  try { ok = await ads.rewarded(tag); } catch (_) { ok = false; }
  G.adBusy = false;
  if (ok && !ads.premium) { OF.noteRewarded(save); persist(); } // the offer engine counts watched ads
  if (!ok) toast('No ad available right now. Try again in a moment.', 2.4);
  return ok;
}
// ---------------------------------------------------------------- shop (2026-11-16 revamp)
// the shop opens on a tab (and optionally scrolled to a section: 'coins' | 'bank'); Back returns to the exact screen it
// was opened from (title, intro, fail card, pause)
function openStore(tab, want = null) {
  if (G.screen !== 'store') { G.storeFrom = G.screen; G.storeFlash = null; setScreen('store'); }
  G.storeTab = tab;
  G.sscroll = { y: 0, v: 0, max: 0, t: G.t, want };
  G.getMore = null; G.detail = null;
  G.toasts = []; G.toast = null; // the level's tips do not follow into the shop
}
function goHome() {
  portal.gameplayStop(); releaseAll();
  G.getMore = null; G.detail = null; G.settingsOpen = false;
  G.toasts = []; G.toast = null; // the level's tips stay with the level
  setScreen('title');
}
// too few coins for something: the small "Get more" sheet (the cheapest pack that covers it, a free-coins ad, the shop)
function needCoins(price) {
  G.lastPrice = price; // the offer engine: the player came up short of this
  const short = Math.max(1, price - save.wallet.coins);
  G.getMore = { price, short, sku: E.packFor(short), t0: G.t };
  audio.play('ui_back');
}
// a real-money product. Web and dev builds have no store: a toast says so. The grant itself arrives through
// ads.js (window.__eggGrant) and thanks the player in onGrant below; this only reports a purchase that did not finish.
async function buyIap(sku, checked = false) {
  if (!E.IAP[sku] || !E.iapAvailable(save.wallet, sku) || !ads.moneyShop) return;
  if (OF.childSafe(save) && !checked) { G.parent = { sku, q: OF.parentQuestion() }; return; } // child-safe: a grown-up first
  if (!ads.canBuy) { toast('Purchases work in the app', 2.4); return; }
  const r = await ads.purchase(sku);
  if (r === 'pending') toast('Payment pending: it arrives as soon as it clears.', 3.2);
  else if (r === 'web') toast('Purchases work in the app', 2.4);
  else if (r !== true) toast('Purchase not completed.', 2.2);
}
// the featured card on Deals: the offer engine's pick, else the Starter Nest while it is for sale, else Premium
function storeFeatured() {
  if (!ads.moneyShop) return null;
  if (G.featAt != null && G.t - G.featAt < 1 && G.screenT > 0.05) return G.feat; // asked once a second, not every frame
  G.featAt = G.t; G.feat = featuredPick();
  return G.feat;
}
function featuredPick() {
  const o = OF.evaluate(save, 'shop', offerCtx());
  if (o && o.sku) return { sku: o.sku, title: o.title, line: o.line };
  if (E.iapAvailable(save.wallet, 'starter_nest') && !save.wallet.payer) return { sku: 'starter_nest' };
  if (E.iapAvailable(save.wallet, PREMIUM_SKU)) return { sku: PREMIUM_SKU };
  return null;
}
const storeState = () => ({ wallet: save.wallet, t: G.t, flash: G.storeFlash ? { id: G.storeFlash.id, t: G.t - G.storeFlash.t0 } : null, price: (sku) => ads.price(sku), reach: strikeReach(), money: ads.moneyShop, dailyOpen: save.wallet.daily === today() });
// popups and sheets over any screen; while one shows only its own buttons take taps
function modalOpen() { return !!(G.getMore || G.detail || G.offer || G.ageAsk || G.parent || G.chickBuy || G.treasure || G.nudge); }
function drawModals() {
  if (!modalOpen()) return;
  ui.buttons.length = 0; ui.rects.length = 0;
  const hb = G.hudBottom;
  if (G.screen === 'store' || G.screen === 'title') G.hudBottom = 0; // no HUD under these
  try {
    if (G.parent) drawParentCheck();
    else if (G.getMore) drawGetMore();
    else if (G.chickBuy) drawChickBuy();
    else if (G.detail) drawDetail();
    else if (G.offer) drawOffer();
    else if (G.nudge) drawNudge();
    else if (G.ageAsk) drawAgeAsk();
    else if (G.treasure) drawTreasure();
  } finally { G.hudBottom = hb; }
}
// ---- boss treasure (2026-11-19, mykee: "after clearing a boss level, show some treasure, the unlockables, the new birds;
// as levels go on new villains come: show what is coming and how it connects"). A chest stands beside every boss on the
// map. Locked: it shows what it holds and who guards it. Beaten: it glows; open it for coins, a booster and Chick Charges.
// Inside it also shows the chick that joins at the next level (what it does, the villains it answers) and the next
// world's new villains, so the reward points at the levels ahead. Bosses 35-50 add no free chick: the shop's premium
// chicks are offered instead (one button, never a popup).
const bossBeaten = (id) => bestStarsOf(id) > 0;
function newKindsFor(w) { // villains that first appear in world w (levels 5w+1 .. 5w+5), in order of appearance
  const seen = new Set(), out = [];
  for (const Lv of LEVELS) {
    const ks = villainKinds(Lv).filter((k) => hasPortrait(k) || VILLAIN_INFO[k]);
    const inW = Lv.id > w * 5 && Lv.id <= w * 5 + 5;
    for (const k of ks) { if (inW && !seen.has(k) && !out.includes(k)) out.push(k); }
    if (Lv.id <= w * 5) ks.forEach((k) => seen.add(k));
  }
  return out;
}
function drawTreasure() {
  const T = G.treasure, R = E.bossTreasure(T.id);
  if (!R) { G.treasure = null; return; }
  const Lb = LEVELS.find((Lv) => Lv.id === T.id), beaten = bossBeaten(T.id), opened = E.treasureOpened(save.wallet, T.id);
  const w = T.id / 5, chick = STRIKES.find((S) => S.unlock === T.id + 1), nk = w < WORLDS.length ? newKindsFor(w).slice(0, 4) : [];
  const bossName = (VILLAIN_INFO['boss:' + (Lb && Lb.boss)] || {}).name || (Lb ? Lb.name : 'the boss');
  dim(0.66);
  const fresh = T.openedAt != null ? G.t - T.openedAt : 9;
  const title = opened ? (fresh < 9 ? 'Treasure collected!' : 'Boss treasure') : beaten ? 'Boss treasure!' : 'Boss treasure';
  stackCard(title, (s, iw) => {
    const B = [];
    B.push({ h: 118 * s, gap: 2 * s, draw: (x, y, w2) => { // the chest: locked, glowing, or open with its prizes flying out
      const cx = x + w2 / 2, cy = y + 64 * s;
      if (opened && fresh < 1.4 && !save.calm) { const a = fresh / 1.4; sunburst(cx, cy, 120 * s * (0.6 + a), `rgba(255,226,120,${0.35 * (1 - a)})`, 14); }
      drawChest(ctx, cx, cy, 92 * s, G.t, opened ? 'open' : beaten ? 'ready' : 'locked');
      if (!beaten) drawPadlock(cx, cy + 14 * s, 13 * s, null);
      ui.record({ x: cx - 50 * s, y, w: 100 * s, h: 112 * s }, 'tr:art');
    } });
    B.push(lineBlock(beaten ? (opened ? 'You opened this treasure.' : `You beat ${bossName}. It is yours!`) : `Beat ${bossName} (Level ${T.id}) to open it.`, 16.5 * s, { tag: 'tr:status', gap: 4 * s, color: beaten ? ui.C.ink : ui.C.ink2 }));
    // what is inside: coins, a booster, Chick Charges
    const items = [['coin', `${R.coins} coins`], ['boost', `${(E.BOOSTERS[R.booster] || {}).name || 'Booster'} booster`], ['charge', `${R.charges} Chick Charges`]];
    const ih = 36 * s, IH = 26 * s + items.length * ih + 6 * s;
    B.push({ h: IH, gap: 10 * s, draw: (x, y, w2) => {
      ui.well(x, y, w2, IH, { s, a: '#f3e2bd', b: '#fbf0d6' });
      ui.text(opened ? 'YOU GOT' : 'INSIDE', x + w2 / 2, y + 14 * s, { size: 13.5 * s, align: 'center', color: ui.C.ink2, tag: 'tr:inhead' });
      items.forEach(([k, txt], i) => {
        const ry = y + 26 * s + i * ih + ih / 2, ix = x + 30 * s;
        if (k === 'coin') drawCoin(ctx, ix, ry, 12 * s, G.t); else if (k === 'boost') drawBoosterIcon(ctx, R.booster, ix, ry, 30 * s, G.t); else pictoPower(ctx, 'thunder', ix, ry, 28 * s, G.t);
        ui.text(txt, ix + 24 * s, ry, { size: 17 * s, color: ui.C.ink, maxW: w2 - 70 * s, tag: 'tr:item' + i });
        if (opened) pictoCheck(ctx, x + w2 - 22 * s, ry, 22 * s);
      });
    } });
    if (chick) { // the chick that joins next: its art, what it does, from which level
      const ul = wrapText(chick.up, 15 * s, iw - 120 * s).slice(0, 3), CH = Math.max(104 * s, 30 * s + 22 * s + ul.length * 19 * s + 10 * s);
      B.push({ h: CH, gap: 10 * s, draw: (x, y, w2) => {
        ui.well(x, y, w2, CH, { s, a: '#e3f2ff', b: '#f4faff' });
        const aw = 96 * s; artStage(x + 8 * s, y + (CH - aw) / 2, aw, aw, s, () => drawStrikeStage(ctx, chick.id, x + 8 * s, y + (CH - aw) / 2 + 4 * s, aw, aw - 8 * s, G.t));
        const tx = x + aw + 20 * s, tw = w2 - aw - 30 * s;
        let ty = y + 18 * s;
        ui.text(beaten ? 'NEW CHICK JOINS YOU' : 'UNLOCKS A NEW CHICK', tx, ty, { size: 12.5 * s, color: '#2f6fa8', maxW: tw, tag: 'tr:chickhead' }); ty += 22 * s;
        ui.text(chick.name, tx, ty, { size: 18 * s, color: chick.col ? ui.tint(chick.col[1], -0.3) : ui.C.ink, maxW: tw, tag: 'tr:chickname' }); ty += 22 * s;
        ul.forEach((l, i) => { ui.text(l, tx, ty, { size: 15 * s, color: ui.C.ink, maxW: tw, tag: 'tr:chickup' + i }); ty += 19 * s; });
      } });
    }
    if (nk.length) { // the next world's new villains, big enough to recognise
      const P = Math.min(64 * s, (iw - (nk.length - 1) * 10 * s) / nk.length), NH = 30 * s + P + 38 * s;
      B.push({ h: NH, gap: 10 * s, draw: (x, y, w2) => {
        ui.text(`COMING UP IN ${(WORLDS[w] || 'the next world').toUpperCase()}`, x + w2 / 2, y + 12 * s, { size: 13.5 * s, align: 'center', color: ui.C.ink2, maxW: w2, tag: 'tr:nexthead' });
        const x0 = x + w2 / 2 - (nk.length * P + (nk.length - 1) * 10 * s) / 2;
        nk.forEach((k, i) => {
          const I = VILLAIN_INFO[k] || { group: 'creature', name: k }, bg = PORTRAIT_BG[I.group] || PORTRAIT_BG.creature, px = x0 + i * (P + 10 * s), py = y + 26 * s;
          ui.well(px, py, P, P, { s, r: 12 * s, a: bg[0], b: bg[1], border: 'rgba(40,24,10,0.7)', shade: 'rgba(0,0,10,0.45)', paint: () => drawVillainPortrait(ctx, k, px + P / 2, py + P / 2, P, G.t + i * 0.7) });
          wrapText(I.name, 12.5 * s, P + 8 * s).slice(0, 2).forEach((l, j) => ui.text(l, px + P / 2, py + P + 12 * s + j * 14 * s, { size: 12.5 * s, align: 'center', color: ui.C.ink, maxW: P + 8 * s, tag: 'tr:nk' + i + ':' + j }));
        });
      } });
    }
    B.push({ h: 58 * s, gap: 14 * s, draw: (x, y, w2) => {
      if (beaten && !opened) ui.button('tr:open', 'OPEN', x, y, w2, 58 * s, { kind: 'gold', shimmer: true, size: 24 * s });
      else if (!beaten && Lb && playable(LEVELS.indexOf(Lb))) { const hw = (w2 - 10 * s) / 2; ui.button('tr:close', 'Close', x, y, hw, 58 * s, { kind: 'tertiary', size: 19 * s }); ui.button('tr:play', `Play Level ${T.id}`, x + hw + 10 * s, y, hw, 58 * s, { kind: 'primary', icon: ICON.play, size: 18 * s }); }
      else ui.button('tr:close', opened ? 'Great!' : 'Close', x, y, w2, 58 * s, { kind: 'primary', size: 22 * s });
    } });
    if (!chick && w >= 7 && opened) B.push({ h: 44 * s, gap: 8 * s, draw: (x, y, w2) => ui.button('tr:shop', 'See premium chicks', x + w2 * 0.15, y, w2 * 0.7, 44 * s, { kind: 'secondary', size: 16 * s }) });
    return B;
  }, { ribbon: '#d89a1c' });
}
// ---- the offer engine's moments (offers.js): the end card after its first second, home on arrival, the intro (a line)
function offerCtx() {
  const lv = G.li >= 0 && G.level ? G.level.id : null, st = G.sim && G.screen === 'fail' ? G.sim.stats() : null;
  return { now: Date.now(), money: ads.moneyShop, levelId: lv, fails: lv != null ? ads.fails(lv) : 0, prevFails: G.prevFails || 0,
    nearMiss: !!(st && st.saved === st.target - 1), lastPrice: G.lastPrice || 0, adReady: adCd() === 0 };
}
// what the Director needs to know about this loss
function failCtx(st) {
  const L = G.level, kinds = villainKinds(L, G.sim).filter((k) => VILLAIN_INFO[k] && VILLAIN_INFO[k].group !== 'hazard');
  const c = lockedChicks()[0] || null;
  return { levelId: L.id, now: Date.now(), nearMiss: st.saved === st.target - 1, timeout: G.sim.timeLeft <= 0,
    thorns: G.sim.rings.some((r) => r.thorns && r.thorns.length), villains: kinds.length > 0, lockedChick: c, chickLevel: L.id >= STRIKE_FROM,
    owned: (save.wallet && save.wallet.owned) || {}, adReady: !G.adBusy };
}
// the fail card's help: a freebie, or the booster that fits, then straight back into the level
async function takeHelp() {
  const H = G.failHelp, lid = G.level && G.level.id;
  if (!H || G.screen !== 'fail' || lid == null) return;
  const boostRun = (b) => startLevel(G.li, b === 'golden' ? { direct: true, golden: true } : { direct: true, boost: { [b]: true } });
  if (H.kind === 'trialChick') {
    DR.noteTrial(save, lid, H, Date.now()); persist();
    G.trialChick = { lid, id: H.id };
    G.stkSel = { lid, id: H.id };
    G.failHelp = null; portal.gameplayStop();
    startLevel(G.li, { direct: true });
    G.trialChick = { lid, id: H.id }; // (startLevel keeps it: the trial lasts this one try)
    toast(`${(STRIKE[H.id] || {}).name || 'Your chick'} is with you this try. Tap it to send it!`, 3.2);
  } else if (H.kind === 'trialBoost') {
    DR.noteTrial(save, lid, H, Date.now()); persist();
    G.failHelp = null; boostRun(H.id);
    toast(`Free ${E.BOOSTERS[H.id].name}: ${E.BOOSTERS[H.id].line}`, 3.2);
  } else if (H.kind === 'buyBoost') {
    if (save.wallet.coins < H.price) { needCoins(H.price); return; }
    save.wallet = { ...save.wallet, coins: save.wallet.coins - H.price }; persist();
    G.failHelp = null; boostRun(H.id);
  } else if (H.kind === 'adBoost') {
    if (await rewarded('booster')) { G.failHelp = null; boostRun(H.id); toast(`${E.BOOSTERS[H.id].name}: ${E.BOOSTERS[H.id].line}`, 3); }
  }
}
// home: the Director's one nudge (keep a trial skin, welcome back, you can afford a chick or skin)
function homeNudge(now) {
  const chicks = strikeReach() >= STRIKE_FROM ? STRIKES.filter((S) => !strikesOpen().includes(S) && E.CHICK_PRICES[S.id]).map((S) => ({ id: S.id, name: S.name, price: E.CHICK_PRICES[S.id] })).sort((a, b) => a.price - b.price) : [];
  const n = DR.homeNudge(save, { now, chicks });
  if (!n) return false;
  if (n.kind !== 'keep') DR.noteNudge(save, n, now);
  persist();
  G.nudge = n;
  return true;
}
function offerMoments() {
  if (G.offerTried || modalOpen() || G.settingsOpen || G.adBusy) return;
  const sc = G.screen;
  if ((sc === 'title' || (sc === 'levels' && !G.mapTravel && !G.treasure)) && G.screenT > 1.4) { // home, or the map (the app opens on it now)
    G.offerTried = true;
    if (sc === 'title' && OF.needsAge(save, ads.moneyShop) && !G.ageLater) { G.ageAsk = true; return; } // first launch, once the home is up
    if (homeNudge(Date.now())) return; // the Director's nudge comes first; the paid offer can wait for another visit
  } else if ((sc === 'win' || sc === 'fail') && G.screenT > 1 && G.li >= 0) { G.offerTried = true; if (sc === 'fail' && G.failHelp) return; } // one help on a fail card, never two
  else if (sc === 'intro' && G.screenT > 0.3 && G.li >= 0) { G.offerTried = true; G.introTip = null; } // the intro's gentle chick line
  else return;
  const moment = sc === 'title' || sc === 'levels' ? 'home' : sc;
  const ctx2 = offerCtx();
  if (moment === 'intro') {
    const c = lockedChicks()[0];
    if (!c) return;
    const o = OF.evaluate(save, 'intro', { ...ctx2, chick: c });
    if (o) { OF.markShown(save, o, ctx2.now, ctx2.levelId); persist(); G.introTip = { id: c.id, line: o.line }; }
    return;
  }
  const o = OF.evaluate(save, moment, ctx2);
  if (!o) return;
  OF.markShown(save, o, ctx2.now, ctx2.levelId); persist();
  G.offer = { ...o, lv: ctx2.levelId };
}
// a calm modal card: art, title, one line, the price (or the free video), and a big "No thanks". No timers.
function drawOffer() {
  const O = G.offer;
  dim(0.55);
  stackCard(O.title, (s, iw) => {
    const C = ui.C, lines = wrapText(O.line, 16.5 * s, iw).slice(0, 3), ad = O.item === 'charge' || O.item === 'coins';
    return [
      { h: 132 * s, gap: 4 * s, draw: (x, y, w) => {
        const aw = Math.min(w, 170 * s);
        ui.well(x + (w - aw) / 2, y, aw, 132 * s, { s, a: '#ffe9b0', b: '#fff6dc' });
        drawOfferArt(ctx, O.sku || O.item, x + w / 2, y + 66 * s, 120 * s, G.t, save.wallet);
        ui.record({ x: x + (w - aw) / 2, y, w: aw, h: 132 * s }, 'of:art');
      } },
      ...lines.map((l, i) => lineBlock(l, 16.5 * s, { color: C.ink, tag: 'of:line' + i, gap: i ? 2 * s : 10 * s })),
      { h: 58 * s, gap: 14 * s, draw: (x, y, w) => ad
        ? ui.button('of:ad', O.item === 'coins' ? `Watch: +${adCoins()} coins` : 'Watch: free Chick Charge', x, y, w, 58 * s, { kind: 'ad', ad: true, shimmer: true, size: 18 * s })
        : ui.button('of:buy', ads.price(O.sku), x + w * 0.1, y, w * 0.8, 58 * s, { kind: 'gold', shimmer: true, size: 24 * s }) },
      { h: 56 * s, gap: 10 * s, draw: (x, y, w) => ui.button('of:no', 'No thanks', x, y, w, 56 * s, { kind: 'tertiary', size: 21 * s }) },
    ];
  }, { ribbon: '#e8402e' });
}
// the Director's home nudge: keep a trial skin, a welcome-back gift, or "you can unlock X now". One card, big art.
function drawNudge() {
  const n = G.nudge;
  dim(0.55);
  const title = n.kind === 'keep' ? `Keep the ${n.name} Egg?` : n.kind === 'welcome' ? 'Welcome back!' : 'You can unlock it now!';
  const line = n.kind === 'keep' ? 'Your free try is over. Keep it for good:' : n.kind === 'welcome' ? `A gift for coming back: ${n.coins} coins and a free booster.` : `You have the coins for ${n.name}.`;
  stackCard(title, (s, iw) => [
    { h: 132 * s, gap: 4 * s, draw: (x, y, w) => {
      const aw = Math.min(w, 170 * s);
      ui.well(x + (w - aw) / 2, y, aw, 132 * s, { s, a: '#ffe9b0', b: '#fff6dc' });
      if (n.kind === 'keep' || (n.kind === 'afford' && n.item.startsWith('skin:'))) drawSkinPreview(ctx, n.kind === 'keep' ? n.id : n.item.slice(5), x + w / 2, y + 66 * s, 104 * s, G.t);
      else if (n.kind === 'afford') drawStrikeChick(ctx, n.item.slice(6), x + w / 2, y + 72 * s, 112 * s, G.t, {});
      else drawOfferArt(ctx, 'coins', x + w / 2, y + 66 * s, 120 * s, G.t, save.wallet);
      ui.record({ x: x + (w - aw) / 2, y, w: aw, h: 132 * s }, 'nudge:art');
    } },
    ...wrapText(line, 16.5 * s, iw).slice(0, 2).map((l, i) => lineBlock(l, 16.5 * s, { color: ui.C.ink, tag: 'nudge:line' + i, gap: i ? 2 * s : 10 * s })),
    { h: 58 * s, gap: 14 * s, draw: (x, y, w) => n.kind === 'keep'
      ? ui.button('nudge:yes', String(n.price), x + w * 0.1, y, w * 0.8, 58 * s, { kind: save.wallet.coins >= n.price ? 'gold' : 'off', dim: 1, shimmer: save.wallet.coins >= n.price, icon: (c, X, Y, S) => drawCoin(c, X, Y, S * 0.5, G.t), size: 24 * s })
      : ui.button('nudge:yes', n.kind === 'welcome' ? 'Collect' : 'See it', x + w * 0.1, y, w * 0.8, 58 * s, { kind: 'primary', shimmer: true, size: 22 * s }) },
    ...(n.kind === 'welcome' ? [] : [{ h: 52 * s, gap: 10 * s, draw: (x, y, w) => ui.button('nudge:no', n.kind === 'keep' ? 'No thanks' : 'Later', x, y, w, 52 * s, { kind: 'tertiary', size: 20 * s }) }]),
  ], { ribbon: n.kind === 'welcome' ? '#3cb043' : '#d89a1c' });
}
// first launch (app only, behind OF.AGE_GATE): a neutral question, two equal buttons, nothing pre-chosen
function drawAgeAsk() {
  dim(0.6);
  stackCard('Welcome!', (s) => [
    lineBlock('How old are you?', 22 * s, { color: ui.C.ink, tag: 'age:q', gap: 6 * s }),
    { h: 64 * s, gap: 18 * s, draw: (x, y, w) => {
      const hw = (w - 12 * s) / 2;
      ui.button('age:u13', 'Under 13', x, y, hw, 64 * s, { kind: 'secondary', size: 20 * s });
      ui.button('age:13', '13 or older', x + hw + 12 * s, y, hw, 64 * s, { kind: 'secondary', size: 20 * s });
    } },
    lineBlock('This keeps the game right for you.', 13.5 * s, { color: ui.C.ink2, tag: 'age:why', gap: 14 * s }),
  ], { ribbon: '#3a80ea' });
}
// child-safe mode: a grown-up answers a small sum before any real-money purchase
function drawParentCheck() {
  const P = G.parent;
  dim(0.6);
  stackCard('Ask a grown-up', (s) => [
    lineBlock('For a grown-up: what is', 16 * s, { color: ui.C.ink2, tag: 'pc:lead', gap: 4 * s }),
    lineBlock(`${P.q.a} x ${P.q.b} ?`, 30 * s, { color: ui.C.ink, tag: 'pc:q', gap: 6 * s }),
    { h: 58 * s, gap: 14 * s, draw: (x, y, w) => {
      const bw = (w - 20 * s) / 3;
      P.q.choices.forEach((v, i) => ui.button('pc:' + i, String(v), x + i * (bw + 10 * s), y, bw, 58 * s, { kind: 'secondary', size: 24 * s }));
    } },
    { h: 50 * s, gap: 12 * s, draw: (x, y, w) => ui.button('pc:cancel', 'Cancel', x, y, w, 50 * s, { kind: 'tertiary', size: 20 * s }) },
  ], { ribbon: '#3a80ea' });
}

// ---- power chicks on the intro (2026-11-16, owner: "pick up the chicks before the level with the coins they have").
// The intro's chick picker can show the chicks not unlocked yet; these are the calls it needs:
//   lockedChicks()          [{ id, name, price, unlock, canAfford }] cheapest first (empty before STRIKE_FROM / no villains)
//   chickOffer(id)          { price, canAfford, owned } or null
//   buyChickForLevel(id)    buys it for coins and picks it for this level (true); too few coins opens Get more (false)
//   press('stk:buy:<id>')   opens the small buy sheet (drawChickBuy)
//   G.introTip              { id, line } | null: the offer engine's gentle suggestion for this intro (a line, no popup)
function chickOffer(id) {
  const S = STRIKE[id], price = E.CHICK_PRICES[id];
  if (!S || !price) return null;
  return { price, canAfford: save.wallet.coins >= price, owned: strikesOpen().some((q) => q.id === id) };
}
function lockedChicks() {
  if (!G.sim || !G.sim.stk || !G.sim.stk.any || (G.li >= 0 && G.level.id < STRIKE_FROM)) return [];
  const open = strikesOpen();
  return STRIKES.filter((S) => !open.includes(S) && E.CHICK_PRICES[S.id])
    .map((S) => ({ id: S.id, name: S.name, unlock: S.unlock, price: E.CHICK_PRICES[S.id], canAfford: save.wallet.coins >= E.CHICK_PRICES[S.id] }))
    .sort((a, b) => a.price - b.price || a.unlock - b.unlock);
}
function buyChickForLevel(id) {
  const O = chickOffer(id);
  if (!O || O.owned) return false;
  const w = E.buyChick(save.wallet, id);
  if (!w) { needCoins(O.price); return false; }
  save.wallet = w; persist(); audio.play('unlock');
  if (G.level) { G.stkSel = { lid: G.level.id, id }; G.sim.stkEquip(strikeFor(G.level, G.li)); }
  G.introTip = null;
  toast(`${STRIKE[id].name} is yours!`, 2.4);
  return true;
}
function drawChickBuy() {
  const S = STRIKE[G.chickBuy], O = chickOffer(G.chickBuy);
  if (!S || !O) { G.chickBuy = null; return; }
  dim(0.55);
  stackCard(S.name, (s, iw) => [
    { h: 112 * s, gap: 4 * s, draw: (x, y, w) => { artStage(x + (w - 150 * s) / 2, y, 150 * s, 112 * s, s, () => drawStrikeStage(ctx, S.id, x + (w - 150 * s) / 2, y + 6 * s, 150 * s, 100 * s, G.t)); ui.record({ x: x + (w - 150 * s) / 2, y, w: 150 * s, h: 112 * s }, 'cb:art'); } },
    ...wrapText(S.up, 15.5 * s, iw).slice(0, 2).map((l, i) => lineBlock(l, 15.5 * s, { color: ui.C.ink, tag: 'cb:up' + i, gap: i ? 2 * s : 10 * s })),
    lineBlock(S.premium ? 'Premium chick: yours for good, in every level with villains.' : `Free at level ${S.unlock}, or yours now for every level.`, 13.5 * s, { color: S.premium ? '#b0700a' : ui.C.ink2, tag: 'cb:free', gap: 6 * s }),
    ...(S.premium ? wrapText('Downside: ' + S.down, 13.5 * s, iw).slice(0, 2).map((l, i) => lineBlock(l, 13.5 * s, { color: ui.C.warn, tag: 'cb:dn' + i, gap: i ? 2 * s : 4 * s })) : []),
    { h: 56 * s, gap: 14 * s, draw: (x, y, w) => ui.button('cb:buy', `Unlock ${O.price}`, x + w * 0.1, y, w * 0.8, 56 * s, { kind: O.canAfford ? 'primary' : 'off', shimmer: O.canAfford, icon: (c, X, Y, Z) => drawCoin(c, X, Y, Z * 0.5, G.t), size: 21 * s }) },
    { h: 48 * s, gap: 10 * s, draw: (x, y, w) => ui.button('cb:close', 'Not now', x, y, w, 48 * s, { kind: 'tertiary', size: 19 * s }) },
  ], { ribbon: S.premium ? '#b8860b' : '#f0a01c' });
}

// a shop tile's detail sheet: the art big, the name, what it does, and its buy / equip button
function drawDetail() {
  const it = G.screen === 'store' ? storeItem(G.detail, storeState()) : null;
  if (!it) { G.detail = null; return; }
  dim(0.55);
  stackCard(it.name, (s, iw) => {
    const C = ui.C, B = it.btn, lines = wrapText(it.line, 16.5 * s, iw).slice(0, 4);
    return [
      { h: 140 * s, gap: 4 * s, draw: (x, y, w) => {
        const aw = Math.min(w, 170 * s);
        ui.well(x + (w - aw) / 2, y, aw, 140 * s, { s, a: '#cfe9fb', b: '#eaf6ff' });
        it.icon(ctx, x + w / 2, y + 70 * s, 128 * s, G.t, it.flash < 0.6 ? 1 + 0.2 * Math.sin((it.flash / 0.6) * Math.PI) : 1);
        ui.record({ x: x + (w - aw) / 2, y, w: aw, h: 140 * s }, 'dt:art');
      } },
      ...lines.map((l, i) => lineBlock(l, 16.5 * s, { color: C.ink, tag: 'dt:line' + i, gap: i ? 2 * s : 10 * s })),
      ...(it.sub ? [lineBlock(it.sub.text, 14 * s, { color: it.sub.color, tag: 'dt:sub', gap: 6 * s })] : []),
      { h: 56 * s, gap: 14 * s, draw: (x, y, w) => ui.button(B.id, B.label, x + w * 0.1, y, w * 0.8, 56 * s, { kind: B.kind, disabled: B.disabled, keepFace: B.keepFace, dim: B.keepFace ? 1 : undefined, icon: B.coin ? (c, X, Y, S) => drawCoin(c, X, Y, S * 0.5, G.t) : B.icon || null, size: 22 * s, shimmer: !B.disabled && B.kind !== 'off' }) },
      { h: 50 * s, gap: 10 * s, draw: (x, y, w) => ui.button('dt:close', 'Close', x, y, w, 50 * s, { kind: 'tertiary', size: 20 * s }) },
    ];
  }, { ribbon: '#7a48e8' });
}
function drawGetMore() {
  const M = G.getMore;
  dim(0.55);
  stackCard('Get more coins', (s) => {
    const C = ui.C, P = E.IAP[M.sku], cd = adCd();
    return [
      lineBlock(`You need ${M.short} more coin${M.short > 1 ? 's' : ''}.`, 18 * s, { color: C.ink, tag: 'gm:need' }),
      ads.moneyShop && { h: 66 * s, gap: 12 * s, draw: (x, y, w) => { // the cheapest pack that covers it
        ui.well(x, y, w, 66 * s, { s });
        for (const [dx, dy] of [[-9, 6], [9, 6], [0, -6]]) drawCoin(ctx, x + 36 * s + dx * s, y + 33 * s + dy * s, 12 * s, G.t + dx);
        ui.record({ x: x + 12 * s, y: y + 15 * s, w: 48 * s, h: 36 * s }, 'gm:pile');
        const bw = Math.max(96 * s, ui.measure(ads.price(M.sku), 18 * s) + 30 * s);
        ui.num(P.coins.toLocaleString('en-US'), x + 70 * s, y + 24 * s, { size: 22 * s, tag: 'gm:amt', maxW: w - bw - 90 * s });
        ui.text('coins', x + 70 * s, y + 47 * s, { size: 14 * s, color: C.ink2, tag: 'gm:unit', maxW: w - bw - 90 * s });
        ui.button('gm:iap:' + M.sku, ads.price(M.sku), x + w - bw - 9 * s, y + 11 * s, bw, 44 * s, { kind: 'primary', size: 18 * s });
      } },
      { h: 50 * s, gap: 10 * s, draw: (x, y, w) => ui.button('gm:ad', cd > 3600 ? 'More free coins tomorrow' : cd > 0 ? `Free coins in ${fmtTime(cd)}` : `Watch an ad: +${adCoins()} coins`, x, y, w, 50 * s, { kind: 'ad', ad: cd <= 0, disabled: cd > 0, shimmer: cd <= 0, size: 16.5 * s }) },
      { h: 46 * s, gap: 10 * s, draw: (x, y, w) => ui.button('gm:shop', 'Open shop', x + w * 0.12, y, w * 0.76, 46 * s, { kind: 'secondary', icon: (c, X, Y, S) => shopIcon(c, X, Y, S), size: 17 * s }) },
      { h: 56 * s, gap: 14 * s, draw: (x, y, w) => ui.button('gm:close', 'Close', x, y, w, 56 * s, { kind: 'tertiary', size: 21 * s }) },
    ].filter(Boolean);
  }, { ribbon: '#e89a10' });
}
function onGrant(sku) {
  const P = E.IAP[sku];
  G.storeFlash = { id: 'iap:' + sku, t0: G.t };
  if (G.getMore && save.wallet.coins >= G.getMore.price) G.getMore = null;
  audio.play('unlock');
  toast(`Thank you! ${P ? P.name : 'Your purchase'} is yours.`, 3);
}

// stuck help: skip this level. It opens the next one; the skipped level keeps no stars and can be played any time.
function skipLevel() {
  const L = G.level;
  save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, L.id + 1));
  save.skipped = { ...(save.skipped || {}), [L.id]: 1 };
  ads.won(L.id);
  persist();
  const n = Math.min(LEVELS.length - 1, G.li + 1);
  if (!playable(n)) { G.world = envOf(n); setScreen('levels'); return; }
  startLevel(n);
}

// Haptics on the hero beats (the app's EggApp bridge, navigator.vibrate on the web); off with reduced motion or sound off.
const HAPTIC_MS = { save: 18, crack: 30, star: 22, win: 45, strike: 35, crow: 40, boss: 40, hit: 22 };
// the power chick is ready: the button starts its heartbeat, the phone thumps lub-dub, a "Power ready!" tag pops by it
function powerReady() {
  G.stkFullT = G.t; G.stkBeats = 0;
  heartBuzz();
  if (strikeShown()) { const r = strikeBtnRect(); G.popups.push({ x: r.x + r.w / 2, y: r.y - 16 * ui.u, text: 'Power ready!', key: 'pready', n: 1, sub: '', color: '#ffcf3a', life: 1.6, max: 1.6, size: 20 * ui.u, placed: false }); }
}
function heartBuzz() {
  if (save.calm || !save.sfx) return;
  try { vibrate(28); setTimeout(() => vibrate(42), 190); } catch (_) { /* optional */ }
}
function buzz(kind) {
  if (save.calm || save.vibe === false) return; // its own switch in Settings (2026-11-16 research: every top casual game has one)
  try { vibrate(HAPTIC_MS[kind] || 20); } catch (_) { /* haptics are optional */ }
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
  ctx.strokeStyle = '#ffc83a'; // gold, never white (white reads as thorns)
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
  if ((Math.abs(sq) < 0.004 && fs < 0.004) || save.calm) { const p0 = e.body.getPosition(); ctx.save(); crowEggXf(ctx, p0.x, p0.y, G.sim.gy || 1); if (!drawChickEgg(ctx, e, t, k)) W.drawEgg(ctx, e, t, k); ctx.restore(); return; }
  const p = e.body.getPosition();
  ctx.save();
  crowEggXf(ctx, p.x, p.y, G.sim.gy || 1); // the rooster's crow: a startled hop
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
// Signature sounds per event, layered on (or, for events that had none, instead of) the handlers' own sounds below:
// every villain family has a voice, every power / chick / ally beat is heard. [sfx, opts, haptic] or (ev) => that.
// Hero beats that land on the player (a boss attack, a snap at an egg) also buzz. A per-event 60 ms gate keeps
// bursts of the same event from machine-gunning.
const thiefVoice = (ev) => (ev.kind === 'rat' || ev.kind === 'ratking' ? 'rat_squeak' : 'weasel_chitter');
const EVENT_SFX = {
  // allies: the rooster's crow lives in handleEvents (with its haptic); the goose honks
  allyCall: (ev) => (ev.kind === 'goose' ? ['goose_honk'] : ['cluck', { intensity: 1, pitch: 0.85 }]),
  allyKnock: (ev) => (ev.kind === 'goose' || !ev.kind ? ['goose_honk', { pitch: 1.1 }, 'hit'] : ['wing_bat', {}, 'hit']),
  allyBump: ['wing_bat', { vol: 0.6 }],
  allyGone: ['flap', { intensity: 1 }],
  // Chick Strike: the hen bats the chick off her wing; the side effects of each strike
  stkFire: ['wing_bat'],
  stkIcy: ['glass_crack', { vol: 0.4, pitch: 1.7 }],
  stkJolt: ['jelly_zap', { vol: 0.45, pitch: 1.4 }],
  stkShove: ['egg_bump', { vol: 0.35, intensity: 0.4 }],
  stkBlast: ['wind_gust', { vol: 0.4, pitch: 1.8 }],
  stkCalm: ['cluck', { vol: 0.35, pitch: 1.3 }],
  decoyOn: ['decoy_peep'],
  // the premium chicks (their hit sounds play in render/strike.js strikeEvent)
  stkScoop: ['fire_ignite', { vol: 0.6, pitch: 1.4 }],
  stkDrop: ['star', { vol: 0.5, pitch: 1.2 }],
  stkTick: (ev) => ['ring_tick', { vol: 0.55, pitch: ev.n % 2 ? 1.5 : 1.25 }],
  stkTockEnd: ['rewind', { vol: 0.45, pitch: 1.6 }],
  stkBubbleOn: ['bubble_on', { vol: 0.5, pitch: 1.2 }],
  stkPop: ['bubble_pop', { vol: 0.5, pitch: 1.3 }],
  stkSnip: (ev) => ['thorn_snap', { vol: 0.55, pitch: 1.5 + ev.n * 0.1 }],
  // powers
  powerOn: ['power_use'],
  magnetOn: ['power_use', { pitch: 0.8 }],
  magnetMiss: ['release', { vol: 0.4 }],
  honeyOff: ['bubble_pop', { vol: 0.4, pitch: 0.8 }],
  bubbleOn: ['bubble_on', { vol: 0.7 }],
  fireOut: ['lava_sizzle', { vol: 0.3, pitch: 1.6 }],
  twin: ['twin_hatch'],
  twinFull: ['motor_tick', { vol: 0.5, pitch: 1.3 }],
  hatch: ['twin_hatch', { pitch: 1.2 }],
  mend: ['unlock', { vol: 0.45, pitch: 1.5 }],
  meltHeal: ['glass_crack', { vol: 0.3, pitch: 1.8 }],
  p2Fling: ['wind_gust', { vol: 0.5, pitch: 1.6 }],
  // the snake
  snakeIn: ['snake_hiss', { vol: 0.6 }],
  snakeRear: ['snake_hiss', { vol: 0.7, pitch: 1.1 }],
  snakeHit: ['snake_strike', {}, 'hit'],
  snakeEat: ['snake_strike', { vol: 0.6, pitch: 0.8 }],
  snakeRecoil: ['creature_hurt', { pitch: 1.1 }],
  snakeDaze: ['stun_stars'],
  // the eagle
  eagleIn: ['eagle_screech', { vol: 0.6 }],
  eagleWarn: ['eagle_screech', { vol: 0.5, pitch: 1.1 }],
  eagleDive: ['eagle_dive'],
  eagleGrab: ['eagle_screech', { vol: 0.5, pitch: 1.2 }, 'hit'],
  eagleSlam: ['creature_hurt', { pitch: 0.9 }],
  eagleDazed: ['stun_stars', { pitch: 0.9 }],
  eagleDaze: ['stun_stars', { pitch: 0.9 }],
  eagleFlee: ['eagle_screech', { vol: 0.4, pitch: 0.9 }],
  eagleWake: ['eagle_screech', { vol: 0.35, pitch: 1.2 }],
  eagleEat: ['snake_strike', { vol: 0.5, pitch: 0.6 }],
  // the weasel, the rats and the Rat King
  thiefIn: (ev) => [thiefVoice(ev), { vol: 0.7 }],
  thiefWarn: (ev) => [thiefVoice(ev), { vol: 0.6 }],
  thiefGrab: (ev) => [thiefVoice(ev), { vol: 0.7, pitch: 1.1 }, 'hit'],
  thiefHit: (ev) => ['creature_hurt', { pitch: ev.kind === 'rat' ? 1.5 : ev.boss ? 0.75 : 1.1 }],
  thiefFlinch: (ev) => ['creature_hurt', { vol: 0.6, pitch: ev.kind === 'rat' ? 1.6 : 1.2 }],
  thiefDaze: ['stun_stars', { pitch: 1.1 }],
  thiefDefeat: ['creature_hurt', { pitch: 0.7 }],
  thiefFlee: (ev) => [thiefVoice(ev), { vol: 0.5, pitch: 1.2 }],
  thiefBack: (ev) => [thiefVoice(ev), { vol: 0.4 }],
  thiefHide: ['release', { vol: 0.4 }],
  thiefMiss: ['wind_gust', { vol: 0.3, pitch: 2 }],
  thiefDrop: ['release', { vol: 0.5 }],
  thiefThaw: ['glass_crack', { vol: 0.35, pitch: 1.5 }],
  ratDizzy: ['stun_stars', { pitch: 1.3 }],
  ratSquabble: ['rat_squeak'],
  ratCuff: ['rat_squeak', { pitch: 1.1 }],
  // salamander, gecko, chameleon, frog: fire and tongues
  salFire: ['sal_breath', {}, 'hit'],
  salPuff: ['sal_breath', { vol: 0.5, pitch: 1.35 }],
  salHit: ['sal_yelp', { pitch: 0.95 }],
  salFlinch: ['sal_yelp', { vol: 0.6, pitch: 1.1 }],
  salShrug: ['sal_huff', { vol: 0.5 }],
  salRivalEnd: ['sal_huff', { vol: 0.55, pitch: 0.9 }],
  geckoLick: ['frost_lick'],
  geckoMiss: ['gecko_chirp', { vol: 0.5, pitch: 1.1 }],
  geckoShrug: ['gecko_chirp', { vol: 0.4, pitch: 0.92 }],
  chamSnatch: ['tongue_lick', { pitch: 0.85 }, 'hit'],
  chamMiss: ['tongue_lick', { vol: 0.5, pitch: 0.8 }],
  chamCoughed: ['squish', { vol: 0.6, pitch: 1.2 }],
  chamDrop: ['release', { vol: 0.5 }],
  chamWell: ['cheer_up', { vol: 0.6 }],
  frogTongue: ['tongue_lick', { pitch: 0.75 }],
  frogLick: ['tongue_lick', { vol: 0.7, pitch: 0.7 }],
  // hermit crab and the King Crab boss
  hermitIn: ['crab_snap', { vol: 0.7 }],
  hermitWarn: ['crab_snap', { vol: 0.5, pitch: 1.2 }],
  hermitGrab: ['crab_snap', {}, 'hit'],
  hermitDrop: ['release', { vol: 0.5 }],
  hermitFlip: ['rock_hit', { vol: 0.6, pitch: 1.3 }],
  kcWarn: ['boss_roar', { vol: 0.8, pitch: 1.2 }],
  kcReach: ['crab_snap', { pitch: 0.7 }],
  kcSnap: (ev) => (ev.miss ? ['crab_snap', { pitch: 0.6 }] : ['boss_slam', { pitch: 1.2 }, 'boss']),
  kcHit: ['creature_hurt', { pitch: 0.6 }],
  kcRecoil: ['creature_hurt', { vol: 0.7, pitch: 0.65 }],
  kcBonk: ['rock_hit', { pitch: 0.8 }],
  kcStuck: ['steel_clang', { vol: 0.6, pitch: 0.8 }],
  kcPile: ['rock_hit', { vol: 0.6 }],
  kcGive: ['unlock', { vol: 0.6, pitch: 1.2 }],
  kcFree: ['unlock', { vol: 0.5, pitch: 1.3 }],
  kcDrop: ['release', { vol: 0.5 }],
  kcSilt: ['splash', { vol: 0.5, pitch: 0.7 }],
  kcBub: ['bubble_on', { vol: 0.6 }],
  kcBubEnd: ['bubble_pop'],
  kcWhirl: ['wind_gust', { vol: 0.6, pitch: 0.8 }],
  kcWhirlEnd: ['release', { vol: 0.4 }],
  kcBar: ['steel_on', { vol: 0.6 }],
  kcBarLand: ['boss_slam', {}, 'boss'],
  kcBarBump: ['steel_clang', { vol: 0.6 }],
  kcBarGone: ['glass_break', { vol: 0.5 }],
  kcDefeat: ['boss_roar', { pitch: 0.75 }],
  // octopus, jellyfish, puffer, fish, turtle
  octInk: ['ink_squirt'],
  octSquirt: ['ink_squirt', { pitch: 1.2 }],
  octJet: ['ink_squirt', { vol: 0.7, pitch: 0.8 }],
  octGrab: ['squish', { vol: 0.6, pitch: 0.7 }, 'hit'],
  jellyIn: ['bubble_on', { vol: 0.5, pitch: 1.3 }],
  jellySting: ['jelly_zap', {}, 'hit'],
  jellyStun: ['stun_stars', { pitch: 1.2 }],
  jellyFlush: ['splash', { vol: 0.5 }],
  puffIn: ['bubble_on', { vol: 0.5, pitch: 0.9 }],
  puffSwell: ['puff_swell'],
  puffBig: ['puff_swell', { pitch: 1.3 }],
  puffPop: ['bubble_pop', { pitch: 0.7 }],
  puffSpine: ['thorn_snap', { vol: 0.7 }],
  puffBounce: ['egg_bump', { vol: 0.5, intensity: 0.5 }],
  puffDart: ['wind_gust', { vol: 0.4, pitch: 1.8 }],
  puffShrink: ['release', { vol: 0.5, pitch: 1.4 }],
  fishIn: ['splash', { vol: 0.3, pitch: 1.5 }],
  turtleWarn: ['rock_hit', { vol: 0.4, pitch: 0.7 }],
  turtleLet: ['release', { vol: 0.5 }],
  turtleMiss: ['wind_gust', { vol: 0.3, pitch: 1.6 }],
  turtleRight: ['rock_hit', { vol: 0.5, pitch: 0.9 }],
  // gator, mosquitoes
  gatorWarn: ['boss_roar', { vol: 0.45, pitch: 1.7 }],
  gatorSnap: ['gator_snap', {}, 'hit'],
  gatorHit: ['creature_hurt', { pitch: 0.7 }],
  gatorDizzy: ['stun_stars', { pitch: 0.8 }],
  gatorGone: ['splash', { vol: 0.5, pitch: 0.7 }],
  mosqHunt: ['mosquito', { vol: 0.6 }],
  mosqLatch: ['mosquito'],
  mosqLift: ['mosquito', { vol: 0.6, pitch: 1.15 }],
  mosqDrop: ['mosquito', { vol: 0.4, pitch: 0.9 }],
  mosqBack: ['mosquito', { vol: 0.5 }],
  // clockwork: beetles, spiders, the owl
  beetleWind: ['gear_whir'],
  spiderSpin: ['gear_whir', { vol: 0.5, pitch: 1.4 }],
  owlWind: ['gear_whir', { pitch: 0.8 }],
  owlSlam: ['boss_slam', {}, 'boss'],
  owlJam: ['creature_hurt', { pitch: 0.6 }],
  // bosses: a roar on every telegraphed attack, a slam (and a buzz) when one lands, a hurt cry when hit
  bossWarn: ['boss_roar', { vol: 0.7 }],
  bossPhase: ['boss_roar', { pitch: 0.85 }],
  bossSummon: ['boss_roar', { vol: 0.6, pitch: 1.1 }],
  bossStomp: ['boss_slam', {}, 'boss'],
  bossPunch: ['boss_slam', { pitch: 1.15 }, 'boss'],
  bossHit: ['creature_hurt', { pitch: 0.6 }],
  bossFlinch: ['creature_hurt', { vol: 0.6, pitch: 0.65 }],
  bossStun: ['stun_stars', { pitch: 0.8 }],
  thornSwipe: ['boss_slam', { pitch: 1.1 }, 'boss'],
  thornBlocked: ['steel_clang', { vol: 0.5, pitch: 1.3 }],
  thornMiss: ['wind_gust', { vol: 0.3, pitch: 1.5 }],
  thornMissHip: ['wind_gust', { vol: 0.3, pitch: 1.7 }],
  mvWhip: (ev) => (ev.held ? null : ['boss_slam', { vol: 0.8 }, 'boss']),
  mvDiveGrab: ['eagle_screech', { vol: 0.6, pitch: 0.9 }, 'hit'],
  mvDiveDrop: ['release', { vol: 0.5 }],
  mvPopEnd: ['release', { vol: 0.4, pitch: 0.8 }],
  mvPopMiss: ['weasel_chitter', { vol: 0.5, pitch: 0.8 }],
  mvShardShrug: ['glass_crack', { vol: 0.3, pitch: 1.8 }],
  // hazards that had no sound
  fallWarn: ['near_miss', { vol: 0.6 }],
  lightningWarn: ['jelly_zap', { vol: 0.25, pitch: 1.8 }],
  heatCrack: ['lava_sizzle', { vol: 0.5, pitch: 1.3 }],
  scorch: ['lava_sizzle', { vol: 0.5, pitch: 1.2 }],
  emberFizz: ['lava_sizzle', { vol: 0.3, pitch: 1.8 }],
  gearFizz: ['lava_sizzle', { vol: 0.35, pitch: 1.5 }],
  fogGone: ['wind_gust', { vol: 0.3, pitch: 1.4 }],
  reefThaw: ['glass_crack', { vol: 0.35, pitch: 1.4 }],
  swoopClear: ['wind_gust', { vol: 0.3, pitch: 1.6 }],
  chickGlide: ['wind_gust', { vol: 0.3, pitch: 2 }],
  chickDashEnd: ['release', { vol: 0.4, pitch: 1.4 }],
};
const evGate = {};
function playEv(ev) {
  const e = EVENT_SFX[ev.type];
  if (!e) return;
  const r = typeof e === 'function' ? e(ev) : e;
  if (!r) return;
  if (G.t - (evGate[ev.type] ?? -1) < 0.06 && G.t >= (evGate[ev.type] ?? -1)) return;
  evGate[ev.type] = G.t;
  audio.play(r[0], { ...(r[1] || {}), pan: clamp((ev.x || 0) / 6, -0.6, 0.6) });
  if (r[2]) buzz(r[2]);
}
function handleEvents() {
  const sim = G.sim;
  const fx = G.fx;
  for (const ev of sim.events) {
    playEv(ev);
    // moment camera (these events also have their own cases below)
    if (ev.type === 'allyKnock') camMoment(ev.x, ev.y, 0.7); // the goose lands on its victim
    else if (ev.type === 'stkLaunch') camMoment(ev.tx, ev.ty, 0.65); // the power chick in flight: hold where it lands
    else crawlerMoment(ev);
    switch (ev.type) {
      case 'allyCrow': // the rooster crows: one short shake and a beat of hit-stop (calm: none); the wave itself is drawn in render/allies.js
        fx.kick(0.34); hitStop(0.06); camPunch(0.03, ev.x, ev.y); camMoment(ev.x, ev.y);
        audio.play('crow');
        buzz('crow');
        break;
      case 'bump':
        if (G.t - lastBump > 0.05 && ev.v > 1.2) {
          lastBump = G.t;
          const i = clamp(ev.v / 6, 0, 1);
          audio.play('egg_bump', { intensity: i, pitch: 1.12 - 0.3 * i }); // a harder hit rings lower: weight
          if (ev.v > 2.6) audio.play('egg_land', { intensity: clamp((ev.v - 2.6) / 4.5, 0, 1), vol: 0.5 + 0.5 * i });
        }
        eggLand(ev.egg, ev.v, fx);
        break;
      case 'graze': // thorn grace: a slow brush shoves the egg off instead of breaking it
        fx.chips(ev.x, ev.y, '#ffe9b0', 5, 1.4);
        fx.dust(ev.x, ev.y, 3, 'rgba(236,226,204,0.7)');
        audio.play('ring_tick', { vol: 0.55, pitch: 1.5 });
        if (!save.seen.graze) { save.seen.graze = 1; persist(); toast('Close call! A slow brush against a thorn only shoves the egg.', 3.4); }
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
        buzz('crack');
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
        { const np = sim.nest.getPosition(); if (!G.nestDrops || G.nestDrops.run !== G.run) G.nestDrops = { run: G.run }; G.nestDrops[ev.n - 1] = { x: ev.x - np.x, y: Math.max(ev.y - np.y, 0.5), t0: G.t }; }
        if (ev.egg && ev.egg.chick && !ev.egg.powU && sim.banked && sim.banked().includes(ev.egg)) toast('Your chick kept its power. Tap the glowing chick button to use it.', 3);
        audio.play('egg_save', { pitch: 1 + (ev.combo - 1) * 0.12 });
        if (ev.combo > 1) audio.play('combo', { intensity: (ev.combo - 2) / 2 });
        buzz('save');
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
        audio.play('power_pickup'); // the hero beat; the power's own sound sits under it
        if (snd) audio.play(snd, { vol: 0.7 });
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
        if (!G.snakeToast) { G.snakeToast = true; tipToast('A snake! Turn the rings so no gap lines up for it.'); }
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
        if (!G.predToast.vineClose) { G.predToast.vineClose = 1; tipToast('Thorn vines seal a gap when they reach across. Fire burns them back.'); }
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
        G.burstAt = G.t; // 2026-11-15: every creature and portal is blown out with the rings (blastXf), none left hanging
        audio.play('bomb_explode', { vol: 0.8 });
        audio.play('wood_break');
        fx.flash = 0.6;
        fx.flashColor = '#fff7da';
        fx.shake = 0.8;
        break;
      default:
        if (strikeEvent(geckoStrikeEv(G.sim, ev), fx, STRIKE_API)) { if (ev.type === 'stkReady') powerReady(); break; } // Chick Strike
        v3Event(ev, fx);
        predEvent(ev, fx); // predators (v3)
        bossEvent(ev, fx); // bosses (v3.1)
        chickEvent(ev, fx, { popup, audio, toast }); // v3.2 chick kinds
        salEvent(ev, fx); // v3.2 lava salamander
        frogEvent(ev, fx, { popup, audio, toast, once: (key, text) => { if (!G.predToast[key]) { G.predToast[key] = 1; tipToast(text); } } }); // v3.3 frog
        seaEvent(ev, fx, { popup, audio, once: (key, text, d = 3.2) => { if (!G.predToast[key]) { G.predToast[key] = 1; tipToast(text); } } }); // v3.3
        p2Event(ev, fx, P2_API); // v3.4 powers and combos
        bayouEvent(ev, fx, { popup, audio, once: (key, text, d = 3.2) => { if (!G.predToast[key]) { G.predToast[key] = 1; tipToast(text); } } }); // v3.7 Gator Bayou
        thiefEvent(ev, fx, { popup: denPopup, audio, hitStop, once: (key, text, d = 3.2) => { if (!G.predToast[key]) { G.predToast[key] = 1; tipToast(text); } } }); // v3.6 the weasel and the rats
        reefEvent(ev, fx, { popup, audio, once: (key, text, d = 3.2) => { if (!G.predToast[key]) { G.predToast[key] = 1; tipToast(text); } } }); // world 8 reef
        { const U = { popup, audio, once: (key, text, d = 3.2) => { if (!G.predToast[key]) { G.predToast[key] = 1; tipToast(text); } } }; cwEvent(ev, fx, U); owlEvent(ev, fx, U); movesEvent(ev, fx, U); } // v4 the clockwork cast, the owl
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

// ---------------------------------------------------------------- Chick Strike: event helpers (render/strike.js) and the button
const STRIKE_API = {
  popup, audio,
  get sim() { return G.sim; },
  once(key, text, d = 3.2) { if (!G.predToast[key]) { G.predToast[key] = 1; toast(text, d); } },
  hitStop: (s) => hitStop(s),
  punch: (a, x, y) => camPunch(a, x, y),
  buzz: (k) => buzz(k),
  slow(left, scale) { if (!save.calm) G.slow = { left, scale }; },
};
function strikeFrom() { return G.henAt ? strikeSeat(G.henAt) : {}; }
function fireStrike(force) {
  const sim = G.sim;
  if (!sim || !sim.stkOn() || G.screen !== 'play') return null;
  // meter not full: a Chick Charge from the bag sends the chick anyway (bought with coins / found in chests)
  const bag = !force && !sim.stkReady() && !sim.stk.fly && !sim.stk.spent && sim.state === 'play' && (save.wallet.charges || 0) > 0;
  if (!force && !bag && !sim.stkReady()) {
    G.stkWob = G.t; audio.play('motor_tick', { vol: 0.6, pitch: 1.4 });
    if (!sim.stk.fly && G.t - (G.stkNoBagT || -9) > 4) { G.stkNoBagT = G.t; toast('Not charged yet. Save eggs and grab orbs to fill it, or get Chick Charges in the shop.', 2.6); }
    return null;
  }
  const pick = G.stkPick && G.t - G.stkPick.t < 1.5 ? G.stkPick.key : null;
  const r = sim.stkFire({ ...strikeFrom(), pick, force, bag });
  if (!r.ok) {
    G.stkWob = G.t;
    if (r.why === 'none') toast('No villain to strike right now.', 2);
    else if (r.why === 'noegg') toast('No egg the chick can reach right now.', 2);
    else if (r.why === 'spent' && G.t - (G.stkNoBagT || -9) > 3) { G.stkNoBagT = G.t; toast('The Phoenix Chick flies once a level.', 2.2); }
  }
  else {
    G.stkPick = null;
    if (r.bag) { const w = E.useCharge(save.wallet); if (w) { save.wallet = w; persist(); } }
  }
  return r;
}
// the strike button: bottom left in portrait (the ally button moves one slot right), top of the right column in landscape
function strikeShown() { return !!(G.sim && G.sim.stkOn() && G.sim.state === 'play' && G.screen === 'play'); }
function strikeBtnRect() {
  const { bs, pad, side } = G.zb, u = ui.u;
  return side ? { x: ui.A.x1 - pad - bs, y: G.play.y, w: bs, h: bs } : { x: ui.A.x + pad, y: G.zb.bot, w: bs, h: bs };
}
function drawStrikeBtn() {
  if (!strikeShown()) return;
  const r = strikeBtnRect(), K = G.sim.stk;
  drawStrikeButton(ctx, r.x, r.y, r.w, { id: K.id, m: K.m, busy: !!(K.fly || K.phx || K.spent), t: G.t, fullT: G.stkFullT, wobT: G.stkWob, pressed: ui.pressedId === 'strike', calm: save.calm });
  const nb = save.wallet.charges || 0; // the Chick Charge bag: a small count badge on the button's corner
  if (nb > 0 && K.m < 1 && !K.fly && !K.spent) {
    const bx = r.x + r.w * 0.86, by = r.y + r.w * 0.14, br = 11 * ui.u;
    ctx.save(); ctx.fillStyle = '#2a7a2e'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * ui.u;
    ctx.beginPath(); ctx.arc(bx, by, br, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = `700 ${12 * ui.u}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('+' + Math.min(nb, 99), bx, by + 0.5 * ui.u); ctx.restore();
  }
  ui.record(r, 'btn:strike', 'btn:strike');
  ui.buttons.push({ id: 'strike', ...r });
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
  const once = (key, text) => { if (!G.predToast[key]) { G.predToast[key] = 1; tipToast(text); } }; // first-time villain tips stay ~7 s (tipToast)
  switch (ev.type) {
    case 'salIn':
      audio.play('sal_call', { vol: 0.9 }); audio.play('ember_hiss', { vol: 0.5 });
      fx.chips(ev.x, ev.y, '#ff9a3a', 10, 2.4);
      fx.sparkle(ev.x, ev.y, 8, '#ffb347');
      if (!ev.boss) once('salIn', 'The lava salamander! It rides the ring under it: turn that ring to steer it.');
      break;
    // L20: Duke Quartz and Spike, the thorn-backs (sim/thornback.js)
    case 'thornIn':
      audio.play('rock_hit', { vol: 0.45, pitch: ev.role === 'duke' ? 0.8 : 1.2 });
      fx.chips(ev.x, ev.y, ev.role === 'duke' ? '#d9c8ff' : '#e8d3a0', 8, 1.8);
      break;
    case 'thornInside':
      if (ev.role === 'duke') once('thornIn', 'Duke Quartz is in! He drops crystal spikes and shoves eggs. Stone flips him.');
      else once('spikeIn', 'His cousin Spike is in too! He drops thorns behind him.');
      break;
    case 'spikeUp': audio.play(ev.sk === 'crystal' ? 'glass_crack' : 'rock_hit', { vol: 0.5, pitch: ev.sk === 'crystal' ? 1.4 : 1.6 }); fx.chips(ev.x, ev.y, ev.sk === 'crystal' ? '#d9c8ff' : '#c9a160', 5, 1.4); break;
    case 'thornHip':
      audio.play('egg_bump', { vol: 0.7, pitch: 0.9 });
      popup(ev.x, ev.y + 0.5, ev.blocked ? 'Blocked!' : 'Shove!', { color: ev.blocked ? '#cfe8ff' : '#ffe1a8', size: 16, life: 0.8 });
      once('thornHip', 'A hip-check shoves an egg along the channel. It never cracks it by itself.');
      break;
    case 'thornFlip':
      audio.play('rock_hit', { vol: 0.9, pitch: 0.7 }); fx.shake = Math.max(fx.shake, 0.25);
      popup(ev.x, ev.y + 0.6, ev.role === 'duke' ? 'Flipped! No attack!' : 'Flipped!', { color: '#fff2a8', size: ev.role === 'duke' ? 15 : 18, life: 1.1 });
      break;
    case 'thornDuel':
      audio.play('wind_gust', { vol: 0.5, pitch: 0.5 }); audio.play('rock_hit', { vol: 0.4, pitch: 0.5 });
      popup(ev.x, ev.y + 0.8, 'Duel!', { color: '#ffcf6a', size: 20, life: 1 });
      once('thornDuel', 'The cousins duel when they meet. The loser is down 5 s. Weaken one first to pick the winner.');
      break;
    case 'thornBeat': audio.play(ev.k === 3 ? 'wind_gust' : 'glass_crack', { vol: 0.5, pitch: ev.k === 1 ? 1.6 : ev.k === 2 ? 1.2 : 0.7 }); break;
    case 'thornSwipe':
      audio.play('steel_clang', { vol: 0.8, pitch: 0.6 });
      fx.kick(0.34); hitStop(0.08); camPunch(0.035, ev.x, ev.y); fx.shake = Math.max(fx.shake, 0.3);
      break;
    case 'thornThrown': audio.play('rock_hit', { vol: 0.8, pitch: 0.6 }); popup(ev.x, ev.y + 0.7, ev.lose === 'duke' ? 'Duke down!' : 'Spike down!', { color: '#fff2a8', size: 18, life: 1.2 }); break;
    // L26: Sly the chameleon, the orb thief (sim/chameleon.js)
    case 'chamIn': audio.play('squish', { vol: 0.4, pitch: 1.4 }); fx.chips(ev.x, ev.y, '#9fe07a', 6, 1.4); break;
    case 'chamInside': once('chamIn', 'Sly steals power orbs with his tongue. Feed him the black flame to make him cough one up.'); break;
    case 'chamSnatch':
      fx.sparkle(ev.x, ev.y, 8, powerInfo(ev.power).color);
      popup(ev.x, ev.y + 0.5, 'Snatched!', { color: '#b8ff7a', size: 17, life: 0.9 });
      break;
    case 'chamGulp': audio.play('egg_bump', { vol: 0.5, pitch: 0.6 }); break;
    case 'chamMiss':
      popup(ev.x, ev.y + 0.5, 'Too slow, Sly!', { color: '#fff2a8', size: 16, life: 0.9 });
      break;
    case 'chamSick':
      audio.play('lava_sizzle', { vol: 0.5, pitch: 0.6 });
      popup(ev.x, ev.y + 0.6, 'Bleurgh!', { color: '#d7ff7a', size: 19, life: 1.1 });
      break;
    case 'chamCough': audio.play('squish', { vol: 0.9, pitch: 0.7 }); popup(ev.x, ev.y + 0.6, 'HURK!', { color: '#ffe680', size: 18, life: 0.8 }); break;
    case 'chamCoughed': fx.sparkle(ev.x, ev.y, 10, powerInfo(ev.power).color); popup(ev.x, ev.y + 0.45, 'Orb back!', { color: '#b8ff7a', size: 16, life: 0.9 }); break;
    case 'chamDrop': fx.sparkle(ev.x, ev.y, 6, powerInfo(ev.power).color); break;
    case 'chamBump': audio.play('rock_hit', { vol: 0.7, pitch: 1.1 }); popup(ev.x, ev.y + 0.55, 'Bump!', { color: '#ffe1a8', size: 16, life: 0.7 }); break;
    case 'geckoIn': // L15: Baron von Brr squeezes in through the outer ring (sim/salamander.js, species gecko)
      audio.play('glass_crack', { vol: 0.4, pitch: 1.8 }); audio.play('gecko_chirp', { vol: 0.7 });
      fx.chips(ev.x, ev.y, '#e6f6ff', 8, 1.8);
      break;
    case 'geckoInside':
      once('geckoIn', 'Baron von Brr is in! His feet ice the floor and his lick freezes eggs.');
      break;
    case 'geckoLick':
      fx.sparkle(ev.x, ev.y, 10, '#dff6ff'); // sound: frost_lick (EVENT_SFX)
      fx.chips(ev.x, ev.y, '#d9f3ff', 6, 1.6);
      popup(ev.x, ev.y + 0.55, 'Licked frozen!', { color: '#bfeaff', size: 18, life: 1.0 });
      once('geckoLick', 'A frozen egg is stuck, but nothing can crack it until it thaws.');
      break;
    case 'eggThaw':
      audio.play('glass_crack', { vol: 0.45, pitch: 1.5 });
      fx.chips(ev.x, ev.y, '#e6f6ff', 7, 1.8);
      break;
    case 'geckoShrug':
      popup(ev.x, ev.y + 0.5, 'Too hard to lick', { color: '#e6e6e6', size: 15, life: 0.8 });
      break;
    case 'salWarn':
      audio.play('sal_charge', { vol: 0.8 });
      fx.sparkle(ev.x, ev.y, 6, '#ffb347');
      break;
    case 'salFire': // sound: sal_breath (EVENT_SFX)
      fx.chips(ev.x, ev.y, '#ff9a3a', 12, 2.6);
      fx.sparkle(ev.x, ev.y, 8, '#ffd27a');
      fx.shake = Math.max(fx.shake, 0.2);
      if (ev.burnt) popup(ev.x, ev.y + 0.5, 'Thorns burnt!', { color: '#ffb347', size: 18, life: 0.9 });
      once('salFire', 'Red-hot wall! An egg that touches it cracks, but thorns on it burn away.');
      break;
    case 'salScorch':
      audio.play('ember_hiss', { vol: 0.7 });
      fx.smoke(ev.x, ev.y, 2, 'rgba(255,170,110,0.35)'); // the crack popup names the cause (red-hot wall)
      break;
    case 'salSteam':
      audio.play('ember_hiss', { vol: 0.6, pitch: 1.2 });
      fx.smoke(ev.x, ev.y + 0.15, 3, 'rgba(230,240,255,0.45)');
      popup(ev.x, ev.y + 0.6, 'Hiss! Cooled', { color: '#8fd0ff', size: 16, life: 0.9 });
      break;
    case 'salShrug':
      popup(ev.x, ev.y + 0.5, 'No crack', { color: '#e6e6e6', size: 15, life: 0.8 });
      break;
    case 'salCool':
      audio.play('ember_hiss');
      audio.play('splash', { vol: 0.5 });
      fx.smoke(ev.hx, ev.hy + 0.25, 3, 'rgba(230,240,255,0.4)'); // light: the grey creature must stay readable
      popup(ev.hx, ev.hy + 0.85, 'Cooled!', { color: '#8fd0ff', size: 20 });
      once('salCool', 'Water cools the salamander to stone: harmless for a few seconds.');
      break;
    case 'salHit': {
      const H = SAL_HIT[ev.kind];
      if (!H) break;
      audio.play(H[2] === 'lava_sizzle' ? 'ember_hiss' : H[2], { vol: 0.6, pitch: 1.3 });
      fx.sparkle(ev.x, ev.y, 8, H[1]);
      popup(ev.x, ev.y + 0.55, H[0], { color: H[1], size: 18, life: 0.9 });
      if (ev.kind === 'lava') once('salLava', 'Lava only recharges the salamander: its next breath comes sooner.');
      break;
    }
    case 'salRival':
      audio.play('sal_call', { vol: 0.8, pitch: 1.15 });
      fx.sparkle(ev.x, ev.y, 10, '#ffe27a');
      popup(ev.x, ev.y + 0.7, 'Face-off!', { color: '#ffe27a', size: 24, life: 1.2 });
      once('salRival', 'Snake vs salamander! While they square off, neither one bothers your eggs.');
      break;
    case 'salPuff': // sound: sal_breath (EVENT_SFX)
      fx.burst(ev.x, ev.y, 6, (i, a, b) => ({ x: ev.x, y: ev.y, vx: (ev.tx - ev.x) * (0.8 + a) + (b - 0.5), vy: (ev.ty - ev.y) * (0.8 + a) + (b - 0.5), drag: 3, life: 0.35, size: 0.05, color: '#ffb347' }));
      break;
    case 'salDive':
      audio.play('ember_hiss', { vol: 0.8 });
      audio.play('splash', { vol: 0.4, pitch: 0.6 });
      break;
  }
}

// ---------------------------------------------------------------- predators (v3)
// events -> SFX/VFX for snakes, barriers, the eagle and the chick (reuses existing sounds)
function predEvent(ev, fx) {
  const once = (key, text) => { if (!G.predToast[key]) { G.predToast[key] = 1; tipToast(text); } }; // first-time villain tips stay ~7 s (tipToast)
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
      audio.play('snake_hiss', { vol: 0.8 });
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
      audio.play('eagle_screech', { vol: 0.8 });
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
      if (!G.predToast.gust) { G.predToast.gust = 1; tipToast('A gust is coming! It shoves eggs along the channels.'); }
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
      fx.chips(ev.x, ev.y, ev.kind === 'ice' ? '#dff6ff' : ev.sk === 'thorn' ? '#c9a160' : '#a99bff', ev.kind === 'spike' && ev.how === 'melt' ? 5 : 10, 2.5);
      if (ev.kind === 'spike' && ev.how === 'shake') popup(ev.x, ev.y + 0.4, 'Shaken off!', { color: '#e9e0ff', size: 16, life: 0.9 });
      if (ev.kind === 'spike' && ev.how === 'fire') popup(ev.x, ev.y + 0.4, 'Burnt!', { color: '#ffb347', size: 16, life: 0.9 });
      else if (ev.how === 'fire' || ev.how === 'water') popup(ev.x, ev.y + 0.4, 'Melted!', { color: '#bfeaff', size: 18, life: 0.9 });
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
  return; // 2026-11-16 (mykee): no red screen edge when a gator opens its mouth or a snake closes in; the heartbeat sound stays
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
    if (r.t < end) { r.t = end; r.shownTotal = r.total; if (r.stars) { audio.play('star', { intensity: (r.stars - 1) / 2 }); buzz('star'); } }
  } else if (G.screen === 'fail') G.screenT = Math.max(G.screenT, routine('encourage').len);
}

function stopFuse() {
  if (G.fuseHandle && G.fuseHandle.stop) G.fuseHandle.stop();
  G.fuseHandle = null;
}

// ---------------------------------------------------------------- results
// 2026-11-16 (mykee: "I saved every egg and still got 2 stars"): which stars are still within reach, shown live in the
// egg tray, with a short note the moment one is lost. 2nd star: no egg lost; 3rd: also no egg cracked.
function starsLive(sim) {
  if (!sim) return 3;
  const st = sim.stats();
  if (st.broken > 0) return 1;
  return sim.eggs.some((e) => !e.fled && e.cracks > 0) ? 2 : 3;
}
function watchStars() {
  if (G.screen !== 'play' || !G.sim || G.sim.state !== 'play' || G.li === -1) return;
  const n = starsLive(G.sim), was = G.starsLive == null ? 3 : G.starsLive;
  if (n < was) toast(n === 1 ? 'An egg was lost: 2nd and 3rd stars gone' : 'An egg cracked: 3rd star gone', 2.4);
  G.starsLive = n;
}
const TRAY_STARS = (u) => 6 * u + 3 * 15 * u; // the width the tray's star group takes
function drawTrayStars(x, y, u) {
  const n = G.li === -1 ? 0 : starsLive(G.sim);
  if (!n) return;
  ctx.fillStyle = 'rgba(255,232,196,0.3)';
  ctx.fillRect(x, y - 9 * u, 1.5 * u, 18 * u);
  for (let i = 0; i < 3; i++) drawStar(ctx, x + 6 * u + 15 * u * (i + 0.5), y, 6.6 * u, i < n, 1, false);
  ui.record({ x: x + 6 * u, y: y - 8 * u, w: 45 * u, h: 16 * u }, 'hud:stars');
}

function computeResult() {
  const sim = G.sim;
  const st = sim.stats();
  const L = G.level;
  const timeBonus = Math.floor(sim.timeLeft) * 10;
  let stars = st.saved >= st.target ? 1 : 0;
  if (stars && st.broken === 0) stars = 2;
  if (stars === 2 && st.perfect) stars = 3; // 2026-11-16: a rewind (an ad reward) no longer costs the 3rd star
  const streak = stars === 3 ? (save.streak || 0) + 1 : 0;
  const streakMult = [1, 1, 1.2, 1.5, 2][Math.min(4, streak)];
  const base = st.score + timeBonus;
  const total = Math.round(base * streakMult);
  // coins (F7) and the bonus objective (C3): bonus coins are paid the first time it is met, per mode
  const bonus = !!L.bonus && sim.bonusMet();
  const bonusCoins = bonus && !save.bonus[sk(L.id, sim.mode)] && G.li >= 0 ? BONUS_COINS : 0;
  let coins = E.levelCoins({ stars, saved: st.saved, eggs: st.total, perfect: st.perfect, levelId: L.id }).total + bonusCoins;
  if (G.li < 0) coins = G.li === -1 && stars && save.daily.paid !== today() ? coins + DAILY_COINS : 0; // the Daily Vault pays once a day; a lab vault pays nothing
  const cracked = sim.savedLog.filter((q) => q.cracks > 0).length, used = sim.timeLimit ? Math.max(0, sim.timeLimit - Math.max(0, sim.timeLeft)) : sim.t;
  return { broken: st.broken, cracked, used, stars, saved: st.saved, eggs: st.total, eggScore: st.score, timeBonus, streak, streakMult, total, shownTotal: 0, t: 0, target: st.target, perfect: st.perfect, rewound: G.usedRewind, coins, bonus, hasBonus: !!L.bonus,
    missed: stars === 1 ? '2nd star: lose no eggs' : stars === 2 ? '3rd star: every egg home without a crack' : '' };
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
  G.prevFails = G.li >= 0 && G.level ? ads.fails(G.level.id) : 0; // the offer engine: a level won after losing it 2+ times
  if (G.li >= 0 && G.level) ads.won(G.level.id);
  stopFuse();
  G.sim.burstVault();
  G.result = computeResult();
  audio.musicEnd('win'); // the loop stops on a cadence under the win fanfare; it comes back on its own
  // the hen's routine (render/cheer.js): by result, a boss, or the first win in a world; never the last one again
  const L = G.level, firstWorld = G.li >= 0 && L.world != null && !LEVELS.some((l) => l.world === L.world && bestStarsOf(l.id) > 0);
  G.result.cheer = pickRoutine({ stars: G.result.stars, streak: G.result.streak, boss: !!L.boss && G.li >= 0, firstWorld, last: save.lastCheer });
  save.lastCheer = G.result.cheer;
  { // Golden Hour doubles the coins; the Golden Egg Bank takes its share on top (app only)
    const P = E.payWin(save.wallet, G.result.coins, ads.moneyShop);
    save.wallet = P.wallet; G.result.coins = P.coins; G.result.goldHour = P.doubled;
  }
  if (G.result.bonus) save.bonus[sk(G.level.id, G.sim.mode)] = 1;
  if (G.li >= 0 && G.level) { // the Director: the result, a skin trial running down, and now and then a new one as a gift
    DR.noteResult(save, G.level.id, true, { saved: G.sim.savedLog.length });
    DR.tickTrial(save);
    const gift = DR.winGift(save);
    if (gift) { DR.startSkinTrial(save, gift.id, Date.now()); G.result.gift = gift; }
    G.result.hot = DR.hotCount(save);
  }
  G.trialChick = null;
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
  G.endCard = { kind: 'win', t: 1.1, run: G.run }; // counted in update(): game time, so a paused or hidden tab holds it
}

function onFail() {
  if (G.li >= 0 && G.level) ads.fail(G.level.id);
  G.failHelp = null;
  if (G.li >= 0 && G.level) { // the Director: note the loss, then pick the one help card for the fail screen
    const st = G.sim.stats();
    DR.noteResult(save, G.level.id, false, { saved: st.saved });
    DR.tickTrial(save);
    G.failHelp = DR.failHelp(save, failCtx(st));
    persist();
  }
  G.trialChick = null;
  stopFuse();
  audio.musicEnd('fail');
  portal.gameplayStop();
  releaseAll();
  G.fx.kick(0.3);
  camPunch(-0.035); // the frame sags back
  G.endCard = { kind: 'fail', t: 0.35, run: G.run }; // counted in update()
}

// ---------------------------------------------------------------- update
function update(dt) {
  G.t += dt;
  G.screenT += dt;
  watchStars();
  if (G.endCard && (G.endCard.t -= dt) <= 0) { // the win / fail card, on game time
    const C = G.endCard;
    G.endCard = null;
    if (G.run === C.run && G.sim && G.screen === 'play') {
      if (C.kind === 'win' && G.result) { setScreen('win'); audio.play('level_win'); buzz('win'); }
      else if (C.kind === 'fail' && G.sim.state === 'failed') { setScreen('fail'); audio.play('level_fail'); }
    }
  }
  offerMoments();
  computeLayout();
  if (G.screen === 'wonder') { wonder.update(dt); return; } // WONDER: its own loop; the campaign world stands still
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
  if (G.portalTip && G.screen === 'play' && !G.toast) { G.portalTip = 0; toast('Portal: an egg that falls into the purple swirl pops out of the orange one. Follow the dotted trail.', 3.6); }
  // stall watch (2026-11-15 softlock report): nothing moved and nothing came home for a while. Enough eggs home: offer
  // Finish. Not enough: after a long still spell offer Retry (an egg wedged, a creature sitting on it).
  if (G.screen === 'play' && sim.state === 'play') {
    const W = G.stall && G.stall.run === G.run ? G.stall : (G.stall = { run: G.run, t: 0, acc: 0, pos: null, saved: 0 });
    if ((W.acc += dt) >= 0.5) {
      W.acc = 0;
      const pos = sim.aliveEggs().map((e) => { const p = e.body.getPosition(); return [p.x, p.y]; }), sv = sim.savedLog.length;
      const moved = !W.pos || pos.length !== W.pos.length || sv !== W.saved || pos.some((p, i) => Math.hypot(p[0] - W.pos[i][0], p[1] - W.pos[i][1]) > 0.05);
      W.pos = pos; W.saved = sv; W.t = moved ? 0 : W.t + 0.5;
    }
  }
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
      if (sim.state === 'won' && G.result) { setScreen('win'); audio.play('level_win'); buzz('win'); }
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
    if (!pt.pull && Math.hypot(pt.ax - pt.bx, pt.ay - pt.by) < 0.05) continue; // an orb spring draws its own sparkles
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
  if (G.screen === 'play' && sim.stkReady && sim.stkReady() && G.stkFullT > 0 && (G.stkBeats || 0) < 3 && G.t - G.stkFullT > 5 * ((G.stkBeats || 0) + 1)) { G.stkBeats = (G.stkBeats || 0) + 1; heartBuzz(); } // still unused: a reminder thump
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
  if (G.toast && (!G.toast.tip || G.screen === 'play')) { G.toast.life -= dt; if (G.toast.life <= 0) G.toast = null; } // a villain tip's clock stops while the game is paused
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
    for (let s = 0; s < r.stars; s++) if (r.t >= R0.stars[s] && t0 < R0.stars[s]) { audio.play('star', { intensity: s / 2 }); buzz('star'); }
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
const MENU_FX = { title: 1, levels: 1, store: 1, extras: 1, practice: 1, info: 1, intro: 1, pause: 1, win: 1, fail: 1 };
const SCENE_SCREENS = { title: 1, store: 1, practice: 1 }; // these paint a full themed scene; the others keep the game behind and get a wash
function menuFx() { if (MENU_FX[G.screen] && !SCENE_SCREENS[G.screen]) themeWash(ctx, ui.skin, W_, H_); if (MENU_FX[G.screen]) menuFxBack(ctx, ui.skin, save, W_, H_, ui.u, DPR, G.t); }
function renderAll() { themeTick(G.t, save.calm || PERF.low); render(); if (MENU_FX[G.screen] && !(G.infoFrom === 'wonder' && G.screen === 'info')) menuFxFront(ctx, ui.skin, save, ui.buttons, H_, ui.u, G.t); if (G.adBusy) drawAdWait(W_, H_); } // + snow piles on the buttons, the gold sweep; the ad wait over every screen (title, map, Wonder included)
function drawStoreScreen() { // the shop's toast floats over its scrolling list (like a clipped card, it records nothing)
  drawStore(ui, ctx, W_, H_, { ...storeState(), area: ui.A, adReady: adCd() === 0, adCooldownLeft: adCd(), adCoins: adCoins(), tab: G.storeTab, scroll: G.sscroll, dragging: !!(G.pdrag && G.pdrag.moved), featured: storeFeatured() }); const n0 = ui.rects.length; drawToast(); ui.rects.length = n0; menuFx(); /* the shop paints its own backdrop: the effect drifts over it */
}
function render() {
  const t = G.t;
  setSpriteCalm(save.calm); // reduced motion holds the flat sprites still
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ui.begin();
  if (G.screen === 'wonder' || (G.screen === 'info' && G.infoFrom === 'wonder')) { wonder.render(); if (G.screen === 'info') drawInfo(); if (DEV || G.checkOverlaps) G.overlaps = ui.overlaps(); return; } // WONDER (the "i" panel can sit over a Wonder Vault)
  if (!G.sim) {
    ctx.fillStyle = '#1b1410';
    ctx.fillRect(0, 0, W_, H_);
    return;
  }
  if (G.screen === 'levels') { drawLevels(); menuFx(); drawToast(); drawModals(); if (DEV || G.checkOverlaps) G.overlaps = ui.overlaps(); return; } // the map covers the screen: no vault drawn under it
  if (G.screen === 'store') { drawStoreScreen(); drawModals(); if (DEV || G.checkOverlaps) G.overlaps = ui.overlaps(); return; } // 2026-11-19: the shop paints its whole room edge to edge, so no vault is drawn under it (it was, every frame)
  // 2026-11-19 speed (older phones): behind the level page (blurred) and the win page (shaded, once its card is in) the
  // board is a still picture, so it is painted once per visit and reused, instead of drawing the whole vault every
  // frame only to cover it. On an older phone that roughly doubles the frame rate of those two pages.
  if (G.frz && G.frz.key === frzKey()) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(G.frzC, 0, 0); ctx.restore();
    menuFx();
    G.frzActive = true;
    try { if (G.screen === 'intro') drawIntro(); else if (G.screen === 'pause') drawPause(); else drawWin(); } finally { G.frzActive = false; }
    if (G.settingsOpen && G.screen === 'pause') drawSettings();
    drawModals();
    if (DEV || G.checkOverlaps) G.overlaps = ui.overlaps();
    return;
  }
  const sim = G.sim;
  const fx = G.fx;
  if (DEV && G.probe) G.probe('bd0');
  // 2026-11-19 (mykee: a hen skin made everything lag): a skin pack paints the whole home scene, so the world's sky
  // under it is skipped (it was painted every frame and then covered). Kept during the short fade-in, which shows it.
  const packHome = G.screen === 'title' && ui.skin && ui.skin.pack && G.screenT >= 0.25;
  if (!packHome) {
    G.backdrop.draw(ctx, t, G.bcam); // parallax: the layers slide and breathe against the camera
    if (DEV && G.probe) G.probe('bd');
    G.weather.drawBack(ctx);
  }
  if (G.screen === 'title') { drawTitle(); drawToast(); if (G.settingsOpen) drawSettings(); drawModals(); if (DEV || G.checkOverlaps) G.overlaps = ui.overlaps(); return; } // the home screen has its own scene (its skin effect drawn inside drawTitle), no vault behind it
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
  if (gy < H_ && !sim.water) G.backdrop.drawGround(ctx, 0, gy, W_, H_ - gy, t, { x: cx + ox + (sim.nest.getPosition().x - camX) * k, k, nw: sim.nestW }); // underwater: no ground (the surface is drawn in the world)
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.translate(cx + ox, cy + oy);
  if (roll) ctx.rotate(roll);
  ctx.scale(k, -k);
  ctx.translate(-camX, -camY);
  if (DEV && G.probe) G.probe('ground');
  W.drawVaultBack(ctx, sim, G.theme); // premium pass: plate behind the vault
  if (DEV && G.probe) G.probe('vaultback');
  fx.draw(ctx, 'back');
  blastXf(() => { // v3 portals; an orb-only swirl (entry = exit, no pull) is drawn as an orb spring (2026-11-16)
    const spring = (pt) => !pt.pull && Math.hypot(pt.ax - pt.bx, pt.ay - pt.by) < 0.05;
    for (const pt of sim.portals) if (!spring(pt)) { W.drawPortalLink(ctx, pt, t); W.drawPortalPull(ctx, pt, t); }
    for (const pt of sim.portals) { if (spring(pt)) W.drawOrbSpring(ctx, pt.ax, pt.ay, t); else { W.drawPortal(ctx, pt.ax, pt.ay, t, false); W.drawPortal(ctx, pt.bx, pt.by, t, true); } }
  }, 0.4);
  if (sim.timeLimit && sim.state === 'play') W.drawFuse(ctx, sim.outerR + 0.32, sim.timeLeft / sim.timeLimit, t, G.screen === 'play' ? fx : null, sim.rings[sim.rings.length - 1]); // v4: hugs a shaped vault
  if (DEV && G.probe) G.probe('portalsFuse');
  if (sim.water) drawSurface(ctx, sim, G.theme, t, k, sim.savedLog.length); else W.drawNest(ctx, sim, G.theme, t, sim.savedLog.length, G.nestDrops && G.nestDrops.run === G.run ? G.nestDrops : null, G.t); // world 8: the basket under the boat
  if (DEV && G.probe) G.probe('nest');
  { const tl = toWorld(0, G.hudBottom + 8 * ui.u), tr = toWorld(W_, 0); allyFrame(sim, { x0: tl.x, x1: tr.x, top: tl.y }, save.calm, G.screen === 'play' ? fx : null); } // the rooster's perch and the crow wave (render only)
  if (DEV && G.probe) G.probe('ally');
  const eggPts = sim.aliveEggs().map((e) => e.body.getPosition());
  const stuck = sim.aliveEggs().filter((e) => e.honey > 0);
  for (const ring of sim.rings) {
    const held = ring.held || (ring.keyHeld && G.keySel === ring.i);
    const hover = !held && G.screen === 'play' && ((G.hover === ring && ring.grabbable) || (G.keys.__kb && G.keySel === ring.i));
    // level clear: whatever is fixed to a ring (curtains, grates, pads, honey, shutters, ice) leaves WITH the ring pieces
    blastXf(() => {
      ctx.save();
      if (ring.denied > 0) ctx.rotate(Math.sin(t * 60) * 0.01 * ring.denied);
      crowRingXf(ctx, ring.r, k); // the rooster's crow shivers every ring as the wave passes
      W.drawRing(ctx, ring, G.theme, k, t, { held, hover, eggs: eggPts, simT: sim.t, stuck, water: sim.water });
      if (DEV && G.probe) G.probe('ringDraw');
      W.drawV3Ring(ctx, ring, k, t, G.theme);
      drawHardIce(ctx, ring, k, t); // v3.2
      drawRingPulse(ring); // game feel: the grab ripple and detent blink
      if (DEV && G.probe) G.probe('ringExtras');
      ctx.restore();
    }, ring.i + 1);
  }
  if (DEV && G.probe) G.probe('rings');
  blastXf(() => drawRockHud(ctx, sim, k, t), 15.3); // v3.3 M10: the rocking vault's level and warning arrows
  setBossView({ top: G.cam.y + (G.play.h / 2) / G.cam.k, k: G.cam.k, u: ui.u }); // bosses (v3.1): the cloud comes into view
  blastXf(() => drawBossRings(ctx, sim, k, t), 12.1); // bosses (v3.1): frost, ice patches, walls, telegraphs on the rings
  blastXf(() => drawSalHeat(ctx, sim, k, t), 13.2); // v3.2: red-hot ring sections and the salamander's target mark
  blastXf(() => drawP2Back(ctx, sim, k, t), 14.1); // v3.4: live ring, scorched sponge, iron bars, brittle thorns, blackout, laser beak
  const SL0 = (types, fn) => strikeLayer(ctx, sim, k, t, types, (c) => crowFlinch(c, sim, types, fn));
  const SL = (types, fn) => blastXf(() => SL0(types, fn), types.length * 1.7 + types[0].length); // the crow wave makes a creature flinch as it passes // Chick Strike: a struck villain's layer is drawn through its reaction
  SL(['bx'], (c) => drawBossActor(c, sim, k, t));
  blastXf(() => drawThiefDens(ctx, sim, t, k), 2.2); // v3.6: the weasel's den and the rats' hole in the floor ring
  blastXf(() => { for (const ring of sim.rings) if (ring.gearOut) W.drawGearCog(ctx, ring, ring.gearOut, t); }, 17.1); // the idler cogs go with the rings
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
  blastXf(() => W.drawBarriers(ctx, sim, t, k), 3.1); // predators (v3)
  // floating orbs: mystery until discovered (F19)
  blastXf(() => { for (const o of sim.orbs) if (o.alive) flipped(o.x, o.y, (k) => drawOrb(ctx, o.type, 0, 0, 0.2 * k, t, !!save.seen[o.type])); }, 18.3); // a re-spawned orb can outlive the burst: it leaves with the rings
  if (DEV && G.probe) G.probe('mid');
  drawHenAt(sim, k, t);
  if (G.screen === 'play' || G.screen === 'intro') { if (sim.water) drawRiseGuide(ctx, sim, t); else W.drawDropGuide(ctx, sim.rings[sim.rings.length - 1], sim.nest.getPosition().x, sim.nestW, t); }
  for (const r of sim.rocks) if (r.alive) W.drawRock(ctx, r, G.theme);
  for (const b of sim.bombs) if (b.alive) b.spark = W.drawBomb(ctx, b, t);
  for (const d of sim.debris) W.drawDebris(ctx, d, G.theme);
  blastXf(() => { W.drawLavaRocks(ctx, sim, k, t); W.drawIcicles(ctx, sim, k, t); }, 16.2); // v3
  drawMagnetField(ctx, sim, t); // v3.1: a magnetic field look instead of a tether line
  blastXf(() => drawBossUnder(ctx, sim, k, t), 4.3);
  W.drawEagleAt(ctx, sim, t, k, 'back'); // predators (v3): eagle shadow under the eggs
  SL(['sal'], (c) => drawSalamanders(c, sim, t, k)); // v3.2: the lava salamander walks the floor, under the eggs
  blastXf(() => drawFrogTele(ctx, sim, k, t), 5.2); // v3.3: the frog's hop mark, then the frog itself (eggs land on it)
  { const wx = warpXfBegin(ctx, sim, 'f'); SL(['frog'], (c) => drawFrogs(c, sim, t, k, G.theme)); warpXfEnd(ctx, wx); }
  { const wx = warpXfBegin(ctx, sim, 'o'); SL(['octo', 'fish'], (c) => drawSeaUnder(c, sim, t, k, G.theme)); warpXfEnd(ctx, wx); } // v3.3: fish, ink, the octopus (the arms behind a held egg)
  SL(['hermit', 'puff', 'jelly', 'kc'], (c) => drawReefUnder(c, sim, t, k, G.theme)); // world 8: bubbles, hermit crabs, puffers, jellyfish, the King Crab
  SL(['thief'], (c) => drawThieves(c, sim, t, k)); // v3.6: the weasel and the rats on the ring floor
  blastXf(() => drawClockworkTele(ctx, sim, t, k), 6.1); SL(['spider', 'beetle', 'jack'], (c) => drawClockwork(c, sim, t, k)); // v4: webs, spring jacks, wind-up beetles, spiders
  SL(['gator', 'turtle'], (c) => drawBayou(c, sim, t, k)); // v3.7: gators and snapping turtles on the channel floor (eggs roll over them)
  if (DEV && G.probe) G.probe('creatures');
  for (const e of sim.aliveEggs()) drawEggFelt(e, t, k); // v3.2: chick kinds, tinted eggs; game feel: through the egg's squash
  drawChickFX(ctx, sim, t, k);
  blastXf(() => { const wx = warpXfBegin(ctx, sim, 'o'); drawSeaOver(ctx, sim, t, k); warpXfEnd(ctx, wx); }, 10.4); // v3.3: the arms wrapped over a held egg
  blastXf(() => drawReefOver(ctx, sim, t, k), 8.2); // world 8: claws over a held egg, the silt cloud
  if (sim.water) drawBoat(ctx, sim, t, k); // world 8: the boat on the surface, over the hen's legs
  blastXf(() => drawThiefDens(ctx, sim, t, k, true), 2.2); // 2026-11-19: the den's rim and shade over a stolen egg (it lies inside)
  blastXf(() => drawThievesOver(ctx, sim, t, k), 9.1); // v3.6: the weasel's jaws over a held egg, the trap ring
  SL(['mosq'], (c) => drawBayouOver(c, sim, t, k)); // v3.7: a turtle's beak round its egg, mosquito swarms
  SL(['snake'], (c) => W.drawSnakes(c, sim, t, k)); // predators (v3)
  for (const m of sim.embers) W.drawEmber(ctx, m, t);
  blastXf(() => drawBossOver(ctx, sim, k, t), 7.3); // bosses (v3.1): icicles, thrown orbs, fog, gale streaks
  { const wx = warpXfBegin(ctx, sim, 'e'); SL(['eagle'], (c) => W.drawEagleAt(c, sim, t, k)); warpXfEnd(ctx, wx); }
  blastXf(() => drawP2Front(ctx, sim, k, t), 11.3); // v3.4: decoy, frozen/zapped creatures, beams, spin, pepper cloud
  drawStrikeWorld(ctx, sim, k, t, G.henAt, (e) => drawEggFelt(e, t, k)); // Chick Strike: the chick on the hen's back, its flight, glue, twisters, chains
  drawAllies(ctx, sim, t, k); // v3.4: rooster and goose, in front of the vault AND of every creature layer (never half behind a villain)
  if (G.hintShow && G.screen === 'play') drawHintArrow(sim.rings[G.hintShow.ring], G.hintShow, t);
  if (DEV && G.probe) G.probe('eggsAllies');
  fx.draw(ctx, 'front');
  for (const e of sim.aliveEggs()) W.drawEggMult(ctx, e, k, FONT);

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (DEV && G.probe) G.probe('fxfront');
  G.weather.calm = save.calm;
  G.weather.drawFront(ctx);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  G.backdrop.drawAmbient(ctx, t, G.cam);
  if (DEV && G.probe) G.probe('weatherAmb');
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
  if (DEV && G.probe) G.probe('tintEtc');
  if (G.screen !== 'title' && G.screen !== 'levels' && G.screen !== 'store' && G.screen !== 'extras' && G.screen !== 'practice' && G.screen !== 'info' && G.screen !== 'intro' && G.screen !== 'win') drawHUD();
  if (DEV && G.probe) G.probe('hud'); // the intro card carries the name, eggs and time (mykee: the name showed twice)
  if (G.screen === 'play') drawFlyers(); // prizes on their way to the HUD
  if (G.screen === 'play') {
    // the power card owns the top of the screen while it shows
    if (G.card) drawCard();
    else { drawPopups(); drawToast(); }
    drawKeyHint();
  }
  if (G.screen !== 'play' && G.screen !== 'title' && G.screen !== 'levels' && G.screen !== 'store' && G.screen !== 'practice' && G.screen !== 'intro' && G.screen !== 'win' && G.screen !== 'pause') menuFx(); // behind the cards (not over the board); intro and win draw it over their frozen backdrop (never baked into it)
  if (G.screen === 'intro') drawIntro();
  if (G.screen === 'pause') drawPause();
  if (G.screen === 'info') drawInfo();
  if (G.screen === 'win') drawWin();
  if (G.screen === 'fail') drawFail();
  if (G.screen === 'title') drawTitle();
  if (G.screen === 'levels') drawLevels();
  if (G.screen === 'practice') drawPractice();
  if (G.screen === 'extras') wonder.drawExtras(); // Extras: Wonder Vaults + the Practice button
  if (G.screen === 'store') drawStoreScreen(); // (reached only if the early path above is skipped)
  if (G.settingsOpen && (G.screen === 'pause' || G.screen === 'title')) drawSettings();
  else G.settingsOpen = false;
  drawModals();
  if (DEV || G.checkOverlaps) G.overlaps = ui.overlaps();
}

// The art helpers draw in a local y-down space in pixels: run draw(k) there, centered at world
// (x, y); k = pixels per meter, so a size of m meters is m * k.
// level clear: the vault bursts, and whatever lived in it (creatures, portals, dens, bosses) is blown outward with the
// ring pieces, tumbling and fading, instead of hanging in the air where the rings were. seed: a per-layer spin.
const BLAST_T = 0.85;
function blastXf(draw, seed = 0) {
  const q = G.burstAt != null && G.sim && (G.sim.state === 'winning' || G.sim.state === 'won') ? (G.t - G.burstAt) / BLAST_T : 0;
  if (q <= 0) return draw();
  if (q >= 1) return;
  const e = q * q;
  ctx.save();
  ctx.globalAlpha *= 1 - q;
  ctx.translate(0, -1.6 * e); // falls a little as it flies (world y is up)
  ctx.rotate((seed % 2 ? 1 : -1) * 0.5 * e);
  ctx.scale(1 + 1.6 * e, 1 + 1.6 * e);
  try { draw(); } finally { ctx.restore(); }
}
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
  const n = sim.nest.getPosition();
  const seat = sim.water ? boatSeat(sim, t) : null; // world 8: she rides in the boat
  // v4: the mascot is as big as her patch allows (up to 66 px, was 52): she steps out from the nest until her comb and
  // brow clear the outermost ring, and takes the largest size that keeps her within ~1 m of where she used to stand
  let s = Math.max(0.95, Math.min(52, k * 1.5) / k), hx = seat ? seat.x : n.x + sim.nestW / 2 + 0.6 + (s - 0.95) / 2;
  if (seat) s = Math.max(s, Math.min(60, k * 1.7) / k);
  else for (const px of (G.henPx && G.henPx.run === G.run ? [G.henPx.px] : [66, 63, 60, 57, 54])) {
    // the size is picked ONCE per run: re-picking it every frame made her shrink and grow as a moving nest (Daily) changed what fit
    const c = Math.max(0.95, Math.min(px, k * 1.9) / k), base = n.x + sim.nestW / 2 + 0.6 + (c - 0.95) / 2, R = sim.outerR + 0.1;
    let x = base;
    for (const [ox, oy] of [[0.32, 0.97], [0.46, 0.85]]) { const y = sim.groundY + oy * c * (sim.gy || 1), d = R * R - y * y; if (d > 0) x = Math.max(x, Math.sqrt(d) + ox * c - n.x * 0); }
    const last = G.henPx && G.henPx.run === G.run; // a locked size is used as it is; x still follows the ring
    if (last || (x - base <= 1.1 && x + 0.45 * c <= sim.outerR + 0.5)) { s = c; hx = x; if (!last && k > 25) G.henPx = { run: G.run, px }; break; }
  }
  G.henAt = { x: hx, y: seat ? seat.y : sim.groundY, s }; // Chick Strike: where the chick rides and launches from
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
    // her patch moves with a sliding basket: hand her its speed so she walks with it (local units are hs/100 px)
    const hp = G.henPrev, dtr = hp ? t - hp.t : 0, drift = hp && dtr > 0 && dtr < 0.2 && hp.run === G.run ? ((hx - hp.x) / dtr) * k * 100 / hs : 0;
    G.henPrev = { x: hx, t, run: G.run };
    drawHenActor(ctx, G.hen.mood, 0, -0.49 * hs, hs, t, { key: 'level', n: G.hen.n, look: G.screen === 'play' ? look : 0, danger: G.danger, shadow: 0.26, drift });
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
  const A = ui.A, w = Math.min(A.w - 24 * u, 380 * u), x = A.cx - w / 2, y = G.hudBottom + 10 * u;
  const lineS = 15 * u, icon = 64 * u;
  const lines = wrapText(info.line, lineS, w - icon - 28 * u).slice(0, 3);
  const h = Math.max(icon + 8 * u, 16 * u + 24 * u + lines.length * lineS * 1.25 + 10 * u);
  ctx.save();
  ctx.globalAlpha = a; ui.aBase = a;
  const k = ui.pop(c.t, 0.22);
  if (k !== 1) { ctx.translate(A.cx, y + h / 2); ctx.scale(k, k); ctx.translate(-A.cx, -(y + h / 2)); }
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
// a chick that reached the nest with its power unused keeps it: a glowing chick button beside the strike / ally ones
function drawBankBtn() {
  const sim = G.sim, B = sim.banked ? sim.banked() : [];
  if (!B.length) return;
  const { bs, pad, side } = G.zb, u = ui.u, gap = 8 * u, n = (strikeShown() ? 1 : 0) + (allyShown() ? 1 : 0);
  const x = side ? ui.A.x1 - pad - bs : ui.A.x + pad + n * (bs + gap), y = side ? G.play.y + (strikeShown() ? bs + gap : 0) : G.zb.bot;
  const kind = B[0].chickKind, p = save.calm ? 0.5 : 0.5 + 0.5 * Math.sin(G.t * 5);
  ctx.save();
  ctx.beginPath(); ctx.arc(x + bs / 2, y + bs / 2, bs * (0.56 + 0.06 * p), 0, 7); ctx.fillStyle = `rgba(255,230,120,${0.25 + 0.25 * p})`; ctx.fill();
  ctx.restore();
  ui.button('bank', '', x, y, bs, bs, { kind: 'gold', round: bs / 2, icon: (c, cx, cy, sz) => drawKindChick(c, kind, cx, cy + sz * 0.08, sz * 0.62, G.t, {}) , iconS: 1.5 });
  if (B.length > 1) {
    const bx = x + bs * 0.86, by = y + bs * 0.14, br = 11 * u;
    ctx.save(); ctx.fillStyle = '#2a7a2e'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * u;
    ctx.beginPath(); ctx.arc(bx, by, br, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = `700 ${12 * u}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('x' + B.length, bx, by + 0.5 * u); ctx.restore();
  }
}
// the ally button sits in the zoom strip (bottom left in portrait, bottom of the right column in landscape); the choice opens beside or above it
function drawAllyBtn() {
  if (!allyShown()) { G.allyOpen = false; return; }
  const { bs, pad, side } = G.zb, u = ui.u, gap = 8 * u;
  const x = side ? ui.A.x1 - pad - bs : ui.A.x + pad + (strikeShown() ? bs + gap : 0), y = G.zb.bot; // Chick Strike takes the corner
  const free = allyFree() || G.allyAd, kinds = allyKinds(), can = kinds.some((k) => G.sim.allyCan(k));
  if (!can) G.allyOpen = false;
  if (can && !G.allyOpen && !save.calm) { // a slow ring says "help is here" without nagging
    const p = (G.t * 0.55) % 1;
    ui.roundRect(x - 5 * u * p, y - 5 * u * p, bs + 10 * u * p, bs + 10 * u * p, 15 * u + 5 * u * p);
    ctx.lineWidth = 2.5 * u; ctx.strokeStyle = `rgba(255,224,120,${0.7 * (1 - p)})`; ctx.stroke();
  }
  ui.button('ally', '', x, y, bs, bs, { kind: 'gold', icon: allyIcon, iconS: 1.45, disabled: !can, round: 15 * u });
  // 2026-11-20 (mykee: "we did not show the user how to use Papa Rooster"): the first time he can help, a hand taps his
  // button and a bubble says what he does; that first call is free
  G.roosterCoach = !!(can && !G.allyOpen && !(save.seen && save.seen.rooster) && G.li >= 0);
  if (G.roosterCoach) {
    const msg = 'Tap Papa Rooster: he chases thieves away!', ts = 15 * u, tw = Math.min(ui.A.w - 24 * u, ui.measure(msg, ts) + 28 * u), th2 = 34 * u;
    const bx = clamp(x + bs / 2 - tw * 0.25, ui.A.x + 10 * u, ui.A.x1 - tw - 10 * u), by = y - th2 - 26 * u;
    ui.roundRect(bx, by, tw, th2, th2 / 2); ctx.fillStyle = '#fff8e6'; ctx.fill(); ctx.lineWidth = 2.5 * u; ctx.strokeStyle = '#c9342c'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + bs / 2 - 8 * u, by + th2); ctx.lineTo(x + bs / 2, by + th2 + 10 * u); ctx.lineTo(x + bs / 2 + 8 * u, by + th2); ctx.closePath(); ctx.fillStyle = '#fff8e6'; ctx.fill();
    ui.text(msg, bx + tw / 2, by + th2 / 2 + 0.5 * u, { size: ts, align: 'center', color: '#7a1f12', maxW: tw - 16 * u, tag: 'coach:rooster' });
    const ph = (G.t * 1.1) % 1, press = ph > 0.35 && ph < 0.6;
    if (!save.calm) teachHand(ctx, x + bs * 0.62, y + bs * (press ? 0.3 : 0.42), bs * 0.8, press, 1);
  }
  const tk = save.wallet.tickets.ally;
  if (!free && can && tk > 0) { // "Use ticket (N)": a red ticket stub with the count instead of the ad badge
    const tw2 = 30 * u, th2 = 17 * u, tx2 = x + bs - tw2 + 6 * u, ty2 = y + bs - th2 + 2 * u;
    ui.roundRect(tx2, ty2, tw2, th2, 4 * u); ctx.fillStyle = '#e0412d'; ctx.fill(); ctx.lineWidth = 1.5 * u; ctx.strokeStyle = '#5a110a'; ctx.stroke();
    ui.text('x' + Math.min(tk, 99), tx2 + tw2 / 2, ty2 + th2 / 2 + 0.5 * u, { size: 12 * u, align: 'center', color: '#fff', maxW: tw2 - 4 * u, noRecord: true });
  } else if (!free && can && !G.roosterCoach) drawAdBadge(ctx, x + bs - 21 * u, y + bs - 15 * u, 22 * u, 16 * u);
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
  if (G.sideHud) { if (G.screen === 'win' || G.screen === 'fail') return; return drawSideHUD(); } // the result card and the hen take the stage
  const u = ui.u;
  const sim = G.sim;
  const pal = G.theme.palette;
  const A = ui.A, twoRows = A.w < 760 || A.h > A.w * 1.05;
  const pad = 12 * u, X0 = A.x + pad, Y0 = A.y + pad; // the HUD lives in the safe rect (the scrim still paints edge to edge)
  const bs = 46 * u;
  ui.calm = save.calm;
  // scrim: the world's plate tint, fading out under the HUD
  const plate = /^rgba\(/.test(pal.plate || '') ? pal.plate : 'rgba(20,14,10,0.55)';
  const al = (a) => plate.replace(/[\d.]+\)$/, a + ')');
  const g = ctx.createLinearGradient(0, A.y * 0.5, 0, G.hudBottom + 12 * u);
  g.addColorStop(0, al(0.82)); g.addColorStop(0.7, al(0.5)); g.addColorStop(1, al(0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W_, G.hudBottom + 12 * u);
  const row1 = Y0 + bs / 2;
  ui.button('pause', '', X0, Y0, bs, bs, { kind: 'hud', icon: ICON.pause, iconS: 1.25, round: 15 * u });
  // score chip (right)
  const st = sim.stats();
  const scoreTxt = String(st.score);
  const scoreSize = 24 * u, lblS = 11 * u;
  if (HUDS.lv !== G.run) { HUDS.lv = G.run; HUDS.score = st.score; HUDS.bump = 0; }
  if (st.score !== HUDS.score) { HUDS.bump = st.score > HUDS.score ? 1 : 0; HUDS.score = st.score; }
  HUDS.bump *= 0.88;
  const scoreW = Math.max(ui.measure(scoreTxt, scoreSize), ui.measure('000', scoreSize));
  const lblW = ui.measure('SCORE', lblS);
  // two rows (phones): the label sits over the number, so the chip is narrow and the title pill keeps room for the clock
  const stk = twoRows, sS = stk ? 19 * u : scoreSize, sW = stk ? Math.max(ui.measure(scoreTxt, sS), ui.measure('000', sS)) : scoreW;
  const chipH = stk ? 44 * u : 36 * u, chipW = stk ? Math.max(ui.measure('SCORE', 9.5 * u), sW) + 24 * u : 13 * u + lblW + 7 * u + scoreW + 14 * u, chipX = A.x1 - pad - chipW;
  ui.glass(chipX, row1 - chipH / 2, chipW, chipH);
  ui.text('SCORE', stk ? chipX + chipW / 2 : chipX + 13 * u, stk ? row1 - 10 * u : row1 + 1 * u, { size: stk ? 9.5 * u : lblS, align: stk ? 'center' : 'left', color: 'rgba(255,232,196,0.85)', tag: 'hud:scoreLabel' });
  ctx.save();
  const sx = stk ? chipX + chipW / 2 : A.x1 - pad - 14 * u, sy = stk ? row1 + 6 * u : row1;
  if (HUDS.bump > 0.02 && !save.calm) { const k = 1 + 0.22 * HUDS.bump; ctx.translate(sx, sy); ctx.scale(k, k); ctx.translate(-sx, -sy); }
  ui.num(scoreTxt, sx, sy, { size: sS, align: stk ? 'center' : 'right', tag: 'hud:score' });
  ctx.restore();
  // the "i" button (who is in this vault): beside pause in one row, under it when the HUD takes two rows
  // stall watch: Finish (enough eggs home) or Retry (stuck), centred under the HUD
  if (G.screen === 'play' && sim.state === 'play' && G.stall && G.stall.run === G.run) {
    const enough = sim.savedLog.length >= (G.level.target || 1);
    if ((enough && G.stall.t >= 5) || (!enough && G.stall.t >= 22)) {
      const fw = Math.min(220 * u, A.w - 2 * pad), fh = 44 * u, fx = A.cx - fw / 2, fy = G.hudBottom + 10 * u;
      const k = save.calm ? 1 : 1 + 0.03 * Math.sin(G.t * 4);
      ctx.save(); ctx.translate(A.cx, fy + fh / 2); ctx.scale(k, k); ctx.translate(-A.cx, -(fy + fh / 2));
      if (enough) ui.button('finish', 'Finish level', fx, fy, fw, fh, { kind: 'primary', shimmer: true, icon: ICON.check, size: 18 * u });
      else ui.button('retry', 'Stuck? Retry', fx, fy, fw, fh, { kind: 'secondary', icon: ICON.retry, size: 17 * u });
      ctx.restore();
    }
  }
  const infoOn = false; // 2026-11-19 (mykee): no "i" button in the HUD; who is in the vault is on the pause page
  let leftEdge = X0 + bs + 8 * u;
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
  const starW = G.li === -1 ? 0 : TRAY_STARS(u);
  const trayPillW = 10 * u + trayW + 9 * u + needW + 13 * u + starW;
  const timeTxt = sim.timeLimit ? fmtTime(sim.timeLeft) : '';
  const timeS = 21 * u;
  const timeW = timeTxt ? ui.measure(timeTxt.replace(/\d/g, '0'), timeS) : 0;
  const timePillW = timeTxt ? 8 * u + 22 * u + 5 * u + timeW + 13 * u : 0;
  const groupW = trayPillW + (timeTxt && !twoRows ? 8 * u + timePillW : 0); // two rows: the clock rides in the title pill
  // one-row HUD: the "i" sits beside pause when the level name keeps ~150u of room, else just under pause (left margin)
  const infoBeside = infoOn && !twoRows && (A.cx - groupW / 2) - (leftEdge + bs + 8 * u) - 12 * u >= 150 * u;
  if (infoBeside) leftEdge += bs + 8 * u;
  // level badge + name
  const isLv = G.li >= 0, nameS = 17 * u, bd = 26 * u;
  let trayX, trayY, lvlMax, lvlCx = null;
  if (twoRows) {
    lvlMax = rightEdge - leftEdge; lvlCx = (leftEdge + rightEdge) / 2;
    trayY = Y0 + bs + 12 * u + pillH / 2;
  } else {
    lvlMax = Math.max(60 * u, (A.cx - groupW / 2) - leftEdge - 12 * u);
    trayY = row1;
  }
  const boss2 = twoRows && G.bossBar && sim.bx && sim.bx.boss; // two rows: the boss bar shares the second row with the eggs
  trayX = boss2 ? X0 : A.cx - groupW / 2;
  const clk = twoRows && timeTxt ? 10 * u + 22 * u + 5 * u + timeW : 0; // the clock, beside the title (2026-11-19, mykee)
  {
    const inner = lvlMax - (isLv ? 4 * u + bd + 6 * u : 13 * u) - 13 * u - clk;
    const nw = Math.min(ui.measure(G.level.name, nameS), Math.max(20 * u, inner));
    const pw = (isLv ? 4 * u + bd + 6 * u : 13 * u) + nw + 13 * u + clk;
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
    if (clk) { // the clock in the title pill: a rule, the clock face, the time (red and pulsing in the last 10 s)
      const low = sim.timeLeft <= 10, cx0 = tx + nw + 8 * u;
      ctx.fillStyle = 'rgba(255,232,196,0.3)'; ctx.fillRect(cx0, row1 - pillH * 0.28, 1.5 * u, pillH * 0.56);
      ctx.save();
      if (low && !save.calm) { const k = 1 + 0.06 * Math.sin(G.t * 12), cc = cx0 + clk / 2; ctx.translate(cc, row1); ctx.scale(k, k); ctx.translate(-cc, -row1); }
      hudClock(cx0 + 8 * u + 11 * u, row1 + 1 * u, 10 * u, low, sim.timeLeft / sim.timeLimit);
      ui.record({ x: cx0 + 8 * u, y: row1 - 11 * u, w: 22 * u, h: 22 * u }, 'hud:clock', 'hud:time');
      ui.text(timeTxt, cx0 + 8 * u + 22 * u + 5 * u, row1 + 0.5 * u, { size: timeS * 0.9, color: low ? '#ff9a7a' : '#fff', stroke: 'rgba(30,14,4,0.75)', strokeW: 3.2 * u, tag: 'hud:time', group: 'hud:time' });
      ctx.restore();
    }
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
  if (starW) drawTrayStars(ex0 + trayW + 9 * u + needW + 6 * u, trayY, u);
  if (timeTxt && !twoRows) {
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
  G.infoLow = 0;
  if (infoOn) {
    const ib = twoRows || !infoBeside ? 40 * u : bs, ix = infoBeside ? X0 + bs + 8 * u : X0 + (bs - ib) / 2, iy = infoBeside ? Y0 : twoRows ? Y0 + bs + 12 * u + pillH / 2 - ib / 2 : G.hudBottom + 6 * u; // one-row HUD without room: under the HUD (and under a boss bar)
    drawInfoBtn(ix, iy, ib);
    if (!twoRows && !infoBeside) G.infoLow = iy + ib; // under pause, past the HUD: the toast starts below it
  }
  if (G.bossBar && sim.bx && sim.bx.boss) {
    // iron housing with a warm trim: the boss bar reads as its own piece of kit (two rows: beside the eggs, slimmer)
    const bx = boss2 ? trayX + trayPillW + 10 * u : X0, bh = boss2 ? pillH - 10 * u : G.bossBar - 8 * u, by = boss2 ? trayY - bh / 2 : G.hudBottom - G.bossBar + 2 * u, bw = boss2 ? A.x1 - pad - 2 * u - bx : A.w - 2 * pad, m = 3 * u;
    ui.roundRect(bx - m, by - m + 2.5 * u, bw + 2 * m, bh + 2 * m, bh);
    ctx.fillStyle = 'rgba(10,2,0,0.3)'; ctx.fill();
    ui.roundRect(bx - m, by - m, bw + 2 * m, bh + 2 * m, bh);
    const hg = ctx.createLinearGradient(0, by - m, 0, by + bh + m);
    hg.addColorStop(0, '#7a2a26'); hg.addColorStop(1, '#3a100e');
    ctx.fillStyle = hg; ctx.fill();
    ctx.lineWidth = 1.5 * u; ctx.strokeStyle = 'rgba(255,206,140,0.75)'; ctx.stroke();
    drawBossBar(ctx, ui, sim, bx, by, bw, bh, G.t);
  }
  if (G.screen === 'play' && sim.state === 'play') { drawZoomBtns(); drawAllyBtn(); drawStrikeBtn(); drawBankBtn(); }
}

// landscape phones: the HUD as a column on the left (pause + info, the level, the egg tray, the fuse, the score, the
// boss bar), so the vault takes the full height. Same pieces and tags as the top HUD.
function drawSideHUD() {
  const u = ui.u, sim = G.sim, pal = G.theme.palette, A = ui.A;
  const pad = 12 * u, X0 = A.x + pad, Y0 = A.y + pad, bs = 44 * u, cw = G.hudCol, pillH = 34 * u, gap = 8 * u;
  ui.calm = save.calm;
  const plate = /^rgba\(/.test(pal.plate || '') ? pal.plate : 'rgba(20,14,10,0.55)';
  const al = (a) => plate.replace(/[\d.]+\)$/, a + ')');
  const g = ctx.createLinearGradient(0, 0, X0 + cw + 24 * u, 0);
  g.addColorStop(0, al(0.7)); g.addColorStop(0.75, al(0.38)); g.addColorStop(1, al(0));
  ctx.fillStyle = g; ctx.fillRect(0, 0, X0 + cw + 24 * u, H_);
  let y = Y0;
  ui.button('pause', '', X0, y, bs, bs, { kind: 'hud', icon: ICON.pause, iconS: 1.25, round: 15 * u });
  // (the "i" button moved into the pause page, 2026-11-19)
  G.infoLow = 0;
  y += bs + gap;
  // level badge + name
  const isLv = G.li >= 0, nameS = 16 * u, bd = 26 * u;
  {
    const inner = cw - (isLv ? 4 * u + bd + 6 * u : 13 * u) - 13 * u, nw = Math.min(ui.measure(G.level.name, nameS), inner);
    const pw = (isLv ? 4 * u + bd + 6 * u : 13 * u) + nw + 13 * u, cy = y + pillH / 2;
    ui.glass(X0, y, pw, pillH);
    let tx = X0 + 13 * u;
    if (isLv) {
      const bx = X0 + 4 * u + bd / 2, acc = /^#[0-9a-f]{6}$/i.test(pal.accent || '') ? pal.accent : '#ffb52e';
      ctx.beginPath(); ctx.arc(bx, cy, bd / 2, 0, 7);
      const bg = ctx.createLinearGradient(0, cy - bd / 2, 0, cy + bd / 2);
      bg.addColorStop(0, ui.tint(acc, 0.3)); bg.addColorStop(1, ui.tint(acc, -0.12));
      ctx.fillStyle = bg; ctx.fill();
      ctx.lineWidth = 1.5 * u; ctx.strokeStyle = ui.tint(acc, -0.62); ctx.stroke();
      const nt = String(G.level.id);
      ui.text(nt, bx, cy, { size: (nt.length > 1 ? 13 : 15) * u, align: 'center', color: '#fff', stroke: ui.tint(acc, -0.62), strokeW: 3 * u, tag: 'hud:levelNum', group: 'hud:level' });
      tx = X0 + 4 * u + bd + 6 * u;
    }
    ui.text(G.level.name, tx, cy + 0.5 * u, { size: nameS, maxW: nw + 1, color: '#fff', stroke: 'rgba(30,14,4,0.7)', strokeW: 3 * u, tag: 'hud:level', group: 'hud:level' });
    y += pillH + gap;
  }
  // egg tray: every egg of the level, then saved / needed
  const st = sim.stats(), met = st.saved >= st.target;
  const slots = Math.max(G.level.eggs, sim.eggs.length), states = [];
  for (const e of sim.eggs) if (!e.fled) states.push(e.saved ? 'saved' : e.alive ? 'alive' : 'broken');
  while (states.length < slots) states.push('empty');
  const needTxt = `${st.saved}/${st.target}`, needS = 18 * u, needW = ui.measure(needTxt.replace(/\d/g, '0'), needS);
  const starW = G.li === -1 ? 0 : TRAY_STARS(u);
  const icon = Math.min(26 * u * Math.min(1, 4.5 / slots), (cw - 32 * u - needW - starW) / slots / 0.9), traySpace = icon * 0.9, trayW = slots * traySpace;
  const trayPillW = 10 * u + trayW + 9 * u + needW + 13 * u + starW, ty = y + pillH / 2;
  ui.glass(X0, y, trayPillW, pillH, met ? { a: 'rgba(52,96,36,0.92)', b: 'rgba(26,58,18,0.92)', border: 'rgba(190,255,150,0.6)' } : {});
  states.forEach((sx, i) => { const e = sim.eggs[i]; drawEggIcon(ctx, X0 + 10 * u + traySpace * (i + 0.5), ty, icon, sx, e ? e.cracks : 0); });
  ui.record({ x: X0 + 10 * u, y: ty - icon / 2, w: trayW, h: icon }, 'hud:tray');
  ctx.fillStyle = 'rgba(255,232,196,0.3)';
  ctx.fillRect(X0 + 10 * u + trayW + 3.5 * u, ty - pillH * 0.28, 1.5 * u, pillH * 0.56);
  ui.text(needTxt, X0 + 10 * u + trayW + 9 * u, ty + 0.5 * u, { size: needS, color: met ? '#b9ff9a' : '#fff', stroke: 'rgba(30,14,4,0.7)', strokeW: 3 * u, tag: 'hud:need' });
  if (starW) drawTrayStars(X0 + 10 * u + trayW + 9 * u + needW + 6 * u, ty, u);
  y += pillH + gap;
  // the fuse and the score share a row
  const timeTxt = sim.timeLimit ? fmtTime(sim.timeLeft) : '', timeS = 20 * u;
  let rx = X0;
  if (timeTxt) {
    const low = sim.timeLeft <= 10, timeW = ui.measure(timeTxt.replace(/\d/g, '0'), timeS), tw = 8 * u + 22 * u + 5 * u + timeW + 12 * u, cy = y + pillH / 2;
    ctx.save();
    if (low && !save.calm) { const k = 1 + 0.05 * Math.sin(G.t * 12), cx = X0 + tw / 2; ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy); }
    ui.glass(X0, y, tw, pillH, low ? { a: 'rgba(196,52,30,0.95)', b: 'rgba(120,22,10,0.95)', border: 'rgba(255,190,160,0.8)' } : {});
    hudClock(X0 + 8 * u + 11 * u, cy + 1 * u, 10 * u, low, sim.timeLeft / sim.timeLimit);
    ui.record({ x: X0 + 8 * u, y: cy - 11 * u, w: 22 * u, h: 22 * u }, 'hud:clock', 'hud:time');
    ui.text(timeTxt, X0 + 8 * u + 22 * u + 5 * u, cy + 0.5 * u, { size: timeS, color: low ? '#fff2c0' : '#fff', stroke: 'rgba(30,14,4,0.75)', strokeW: 3.2 * u, tag: 'hud:time', group: 'hud:time' });
    ctx.restore();
    rx = X0 + tw + gap;
  }
  {
    const scoreTxt = String(st.score), scoreS = 20 * u, cy = y + pillH / 2;
    if (HUDS.lv !== G.run) { HUDS.lv = G.run; HUDS.score = st.score; HUDS.bump = 0; }
    if (st.score !== HUDS.score) { HUDS.bump = st.score > HUDS.score ? 1 : 0; HUDS.score = st.score; }
    HUDS.bump *= 0.88;
    const sw = Math.max(ui.measure(scoreTxt, scoreS), ui.measure('000', scoreS)) + 26 * u, sx = Math.max(rx, X0 + cw - sw);
    if (sx + sw <= X0 + cw + 4 * u) {
      ui.glass(sx, y, sw, pillH);
      ctx.save();
      if (HUDS.bump > 0.02 && !save.calm) { const k = 1 + 0.22 * HUDS.bump, px = sx + sw - 13 * u; ctx.translate(px, cy); ctx.scale(k, k); ctx.translate(-px, -cy); }
      ui.num(scoreTxt, sx + sw - 13 * u, cy, { size: scoreS, align: 'right', tag: 'hud:score' });
      ctx.restore();
    }
  }
  y += pillH + gap;
  if (G.bossBar && sim.bx && sim.bx.boss) {
    const bw = cw, bh = G.bossBar - 8 * u, m = 3 * u, by = y + m;
    ui.roundRect(X0 - m, by - m + 2.5 * u, bw + 2 * m, bh + 2 * m, bh); ctx.fillStyle = 'rgba(10,2,0,0.3)'; ctx.fill();
    ui.roundRect(X0 - m, by - m, bw + 2 * m, bh + 2 * m, bh);
    const hg = ctx.createLinearGradient(0, by - m, 0, by + bh + m); hg.addColorStop(0, '#7a2a26'); hg.addColorStop(1, '#3a100e');
    ctx.fillStyle = hg; ctx.fill(); ctx.lineWidth = 1.5 * u; ctx.strokeStyle = 'rgba(255,206,140,0.75)'; ctx.stroke();
    drawBossBar(ctx, ui, sim, X0, by, bw, bh, G.t);
    y += G.bossBar + gap;
  }
  G.sideHudBottom = y;
  // stall watch: Finish / Stuck? Retry, at the foot of the column
  if (G.screen === 'play' && sim.state === 'play' && G.stall && G.stall.run === G.run) {
    const enough = sim.savedLog.length >= (G.level.target || 1);
    if ((enough && G.stall.t >= 5) || (!enough && G.stall.t >= 22)) {
      const fh = 42 * u, fy = Math.max(y + 4 * u, A.y1 - pad - fh);
      if (enough) ui.button('finish', 'Finish level', X0, fy, cw, fh, { kind: 'primary', shimmer: true, icon: ICON.check, size: 16 * u });
      else ui.button('retry', 'Stuck? Retry', X0, fy, cw, fh, { kind: 'secondary', icon: ICON.retry, size: 15 * u });
    }
  }
  if (G.screen === 'play' && sim.state === 'play') { drawZoomBtns(); drawAllyBtn(); drawStrikeBtn(); drawBankBtn(); }
}

// the HUD's "i": a round info glyph; while the level holds a kind this player has never opened, it pulses and wears a "New!" tag
const mkInfoIcon = (col, edge) => (c, x, y, s) => {
  c.save();
  c.fillStyle = edge;
  c.beginPath(); c.arc(x, y - s * 0.24 + s * 0.06, s * 0.12, 0, 7); c.fill();
  ui.roundRect(x - s * 0.1, y - s * 0.06 + s * 0.06, s * 0.2, s * 0.44, s * 0.08); c.fill();
  c.fillStyle = col;
  c.beginPath(); c.arc(x, y - s * 0.24, s * 0.12, 0, 7); c.fill();
  ui.roundRect(x - s * 0.1, y - s * 0.06, s * 0.2, s * 0.44, s * 0.08); c.fill();
  c.restore();
};
const infoIcon = mkInfoIcon('#fff8e6', 'rgba(18,9,3,0.55)'), infoIconInk = mkInfoIcon('#6b3f17', 'rgba(255,255,255,0.7)');
function drawInfoBtn(x, y, b) {
  const u = ui.u, fresh = G.infoNew;
  if (fresh && !save.calm) { // a slow ring, like the ally button's: "there is something new to read"
    const p = (G.t * 0.7) % 1;
    ui.roundRect(x - 5 * u * p, y - 5 * u * p, b + 10 * u * p, b + 10 * u * p, 15 * u + 5 * u * p);
    ctx.lineWidth = 2.5 * u; ctx.strokeStyle = `rgba(255,214,90,${0.8 * (1 - p)})`; ctx.stroke();
  }
  ui.button('info', '', x, y, b, b, { kind: fresh ? 'gold' : 'hud', icon: infoIcon, iconS: 1.25, round: 15 * u * (b / (46 * u)) });
  if (!fresh) return;
  const ts = 10.5 * u, tw = ui.measure('New!', ts) + 9 * u, th = ts + 6 * u, tx = x + b - tw + 9 * u, ty = Math.max(ui.A.y, y - th * 0.45);
  ui.roundRect(tx, ty, tw, th, th / 2); ctx.fillStyle = '#e8402e'; ctx.fill();
  ctx.lineWidth = 1.5 * u; ctx.strokeStyle = '#fff4dc'; ctx.stroke();
  ui.text('New!', tx + tw / 2, ty + th / 2, { size: ts, align: 'center', color: '#fff', tag: 'hud:infoNew', group: 'btn:info' });
}

// zoom -, +, and auto (only while the player has overridden auto zoom), in the strip computeLayout keeps clear of the vault
function drawZoomBtns() {
  const { bs, pad, side } = G.zb, P = G.play, u = ui.u, gap = 8 * u;
  const items = [['zoom:in', ICON.zoom(true), ''], ['zoom:out', ICON.zoom(false), '']];
  if (G.zm != null) items.push(['zoom:auto', null, 'auto']);
  items.forEach(([id, icon, label], i) => {
    const x = side ? ui.A.x1 - pad - bs : ui.A.x1 - pad - bs * (i + 1) - gap * i;
    // landscape: centred in the right column, but never up on the Chick Strike button at its top
    const y = side ? Math.max(P.y + (P.h - (bs * 3 + gap * 2)) / 2, strikeShown() ? P.y + bs + gap * 2 : 0) + (bs + gap) * i : G.zb.bot;
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
    const A = ui.A, w = Math.min(A.w - 16, Math.max(ui.measure(p.text, size), p.sub ? ui.measure(p.sub, subS) : 0)); // the sub line can be the wider one
    const edge = 12 * ui.u + size * 0.15; // v3.7: the outline stroke and the pop-in grow past the measured width; keep it all on screen
    const x = w + 2 * edge >= A.w ? A.cx : clamp(p.x, A.x + w / 2 + edge, A.x1 - w / 2 - edge);
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
    if (p.sub) ui.text(p.sub, x, y + size / 2 + subS / 2 + 2, { size: subS, align: 'center', color: '#fff', stroke: 'rgba(40,18,4,0.8)', alpha: a, maxW: A.w - 16, tag: 'popupsub' + placed.length, group: 'popup' + placed.length });
  }
}

function drawToast() {
  const T = G.toast;
  if (!T) return;
  const u = ui.u;
  const age = G.t - T.t0;
  const a = Math.min(1, age * 5, T.life * 3);
  const size = 16 * u;
  const A = ui.A, maxW = Math.min(A.w - 32 * u, 520 * u);
  const xw = T.tip ? 22 * u : 0; // a villain tip keeps a little close mark on its right: a tap puts it away
  const ico = toastIcon(T), icw = ico ? 26 * u : 0;
  const lines = wrapText(T.text, size, maxW - 32 * u - xw - icw);
  const h = Math.max(lines.length * size * 1.3 + 18 * u, ico ? 34 * u : 0);
  const w = Math.min(maxW, Math.max(...lines.map((l) => ui.measure(l, size))) + 32 * u + xw + icw);
  const x = A.cx - w / 2, y = G.screen === 'title' && G.titleToastY ? G.titleToastY : G.screen === 'store' ? A.y1 - h - 22 * u : Math.max(G.hudBottom + 10 * u, (G.infoLow || 0) + 8 * u);
  G.toastRect = { x, y, w, h };
  ctx.save();
  ctx.globalAlpha = a; ui.aBase = a;
  const k = ui.pop(age, 0.22);
  if (k !== 1) { ctx.translate(A.cx, y + h / 2); ctx.scale(k, k); ctx.translate(-A.cx, -(y + h / 2)); }
  ui.glass(x, y, w, h, { r: Math.min(h / 2, 18 * u), a: 'rgba(58,36,20,0.94)', b: 'rgba(28,16,8,0.94)', border: 'rgba(255,224,160,0.6)', record: true, tag: 'toast', group: 'toast' });
  if (ico) { // the icon in the left margin
    const ix = x + 22 * u, iy = y + h / 2, iz = 24 * u;
    if (ico === 'warn') pictoWarn(ctx, ix, iy, iz); else if (ico === 'clock') pictoClock(ctx, ix, iy, iz); else if (ico === 'flame') pictoFlame(ctx, ix, iy, iz);
    else if (ico === 'egg') drawEggIcon(ctx, ix, iy, iz, 'alive'); else if (ico === 'coin') drawCoin(ctx, ix, iy, 10 * u, G.t); else if (ico === 'check') pictoCheck(ctx, ix, iy, iz);
    else if (ico === 'cross') pictoCross(ctx, ix, iy, iz); else pictoPower(ctx, ico, ix, iy, iz, G.t);
  }
  lines.forEach((l, i) => ui.text(l, A.cx - xw / 2 + icw / 2, y + (h - lines.length * size * 1.3) / 2 + size * 1.3 * (i + 0.5), { size, align: 'center', color: '#fff8e8', group: 'toast', tag: 'toast:' + i }));
  if (T.tip) { // the close mark, and a hairline that runs down with the tip's time
    const cx = x + w - 13 * u - 4 * u, cy = y + h / 2, r = 4.5 * u;
    ctx.strokeStyle = 'rgba(255,232,190,0.75)'; ctx.lineWidth = 2 * u; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r); ctx.moveTo(cx + r, cy - r); ctx.lineTo(cx - r, cy + r); ctx.stroke();
    const k2 = clamp(T.life / TIP_LIFE, 0, 1), rr = Math.min(h / 2, 18 * u);
    ctx.fillStyle = 'rgba(255,214,120,0.55)'; ctx.fillRect(x + rr, y + h - 3 * u, (w - 2 * rr) * k2, 1.5 * u);
  }
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
  const A = ui.A, top = Math.max(G.hudBottom, A.y) + 16 * u; // the ribbon stands 8 units proud of the card
  const avail = A.y1 - top - 14 * u; // and the base lip 5 below
  // o.twoCol on a wide screen (landscape): blocks marked right: true stack in a second column beside the rest
  const two = !!o.twoCol && A.w > A.h * 1.15;
  const colH = (L, s) => L.reduce((a, b) => a + (b.gap ?? 10 * s) + b.h, 0);
  const measure = (s) => {
    if (two) {
      const w = Math.min(A.w - 32 * u, 780 * s), cw = (w - 48 * s - 28 * s) / 2;
      const blocks = build(s, cw), hl = colH(blocks.filter((b) => !b.right), s), hr = colH(blocks.filter((b) => b.right), s);
      return { s, w, blocks, cw, hl, hr, h: CARD_HEAD * s + Math.max(hl, hr) + 22 * s };
    }
    const w = Math.min(o.maxW || A.w - 32 * u, 420 * s);
    const blocks = build(s, w - 48 * s);
    const h = CARD_HEAD * s + colH(blocks, s) + 22 * s;
    return { s, w, blocks, h };
  };
  let m = measure(u);
  // a narrower card wraps its text into more lines, so one rescale can still be too tall: step down until it fits
  for (let n = 0; n < 4 && m.h > avail + 0.5 && m.s > u * 0.45; n++) m = measure(Math.max(u * 0.45, m.s * Math.min(0.97, avail / m.h)));
  const { s, w, blocks } = m;
  const h = Math.min(m.h, avail);
  const x = (o.cx || A.cx) - w / 2;
  const y = Math.max(top, (A.y1 + Math.max(G.hudBottom, A.y)) / 2 - h / 2);
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
  if (two) { // each column centred in the card's height
    const maxC = Math.max(m.hl, m.hr);
    for (const [R, ch] of [[false, m.hl], [true, m.hr]]) {
      let cy = y + CARD_HEAD * s + (maxC - ch) / 2;
      const cx = x + 24 * s + (R ? m.cw + 28 * s : 0);
      for (const b of blocks) {
        if (!!b.right !== R) continue;
        cy += b.gap ?? 10 * s;
        if (b.at) b.at(cx, cy, m.cw);
        b.draw(cx, cy, m.cw);
        cy += b.h;
      }
    }
    ui.roundRect(x + 24 * s + m.cw + 13 * s, y + CARD_HEAD * s + 4 * s, 2 * s, maxC - 4 * s, s); ctx.fillStyle = 'rgba(120,80,40,0.18)'; ctx.fill(); // the fold between the columns
    ctx.restore();
    return { x, y, w, h, s };
  }
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

// first level of a world, first visit: its intro line rides on the level card (one card, no extra tap)
function worldOpener(L) { return !!(L && L.intro && !L.boss && G.li >= 0 && (L.id - 1) % PER_ENV === 0 && !save.intro[L.id]); }
function drawIntro() {
  const L = G.level, C = ui.C;
  const acc = /^#[0-9a-f]{6}$/i.test(G.theme.palette.accent || '') ? G.theme.palette.accent : '#ee5a36';
  // Chick Strike: a new strike chick gets a card of its own, once (the newest one reached; any older unseen ones with it)
  const fresh = G.li >= 0 && G.sim && G.sim.stk && G.sim.stk.any ? strikesOpen().filter((S) => S.unlock <= L.id && !(save.strikeSeen || {})[S.id]) : [];
  if (fresh.length) {
    dim(0.62);
    const S = fresh[fresh.length - 1];
    G.stkCard = S.id;
    // a new chick gets a proper introduction (2026-11-19): a big stage, its power with its pictogram, the downside, how to use it
    stackCard('New chick!', (s, iw) => [
      { h: 34 * s, gap: 4 * s, draw: (x, y, w) => ui.text(S.name, x + w / 2, y + 17 * s, { size: 28 * s, align: 'center', maxW: w, color: S.col ? ui.tint(S.col[1], -0.3) : ui.C.ink, tag: 'stkname' }) },
      { h: 190 * s, gap: 8 * s, draw: (x, y, w) => { artStage(x, y, w, 190 * s, s, () => drawStrikeStage(ctx, S.id, x, y + 8 * s, w, 176 * s, G.t)); const bz = 46 * s; ctx.beginPath(); ctx.arc(x + w - bz * 0.7, y + 190 * s - bz * 0.7, bz * 0.56, 0, 7); ctx.fillStyle = '#25355c'; ctx.fill(); ctx.lineWidth = 2.5 * s; ctx.strokeStyle = '#fff'; ctx.stroke(); pictoPower(ctx, S.id, x + w - bz * 0.7, y + 190 * s - bz * 0.7, bz * 0.95, G.t); } },
      ...wrapText(S.up, 19 * s, iw).slice(0, 2).map((l, i) => lineBlock(l, 19 * s, { tag: 'stkup:' + i, gap: i ? 2 * s : 10 * s })),
      ...wrapText('Downside: ' + S.down, 16 * s, iw).slice(0, 2).map((l, i) => lineBlock(l, 16 * s, { color: ui.C.warn, tag: 'stkdown:' + i, gap: i ? 2 * s : 8 * s })),
      ...wrapText('Pick it on the level page. In the level, fill the chick button, then tap it at the right moment.', 15 * s, iw).slice(0, 3).map((l, i) => lineBlock(l, 15 * s, { color: ui.C.ink2, tag: 'stkhow' + i, gap: i ? 2 * s : 10 * s })),
      { h: 60 * s, gap: 16 * s, draw: (x, y, w) => ui.button('stk:gotit', 'GOT IT', x, y, w, 60 * s, { kind: 'primary', shimmer: true, icon: ICON.play, size: 24 * s }) },
    ], { ribbon: '#e8962a' });
    return;
  }
  if (L.intro && !save.intro[L.id] && !worldOpener(L)) {
    dim(0.62);
    // a world's new mechanic gets one screen of its own the first time (C6); a boss also shows its face (I6)
    stackCard(L.intro.title, (s, iw) => [
      // (the framed villain portrait card was removed at the owner's request: bosses introduce themselves in the level)
      ...(L.intro.chick ? [{ h: 104 * s, gap: 0, draw: (x, y, w) => artStage(x, y, w, 104 * s, s, () => chickIntroArt(L.intro.chick, x, y, w, 104 * s)) }] // v3.2: meet the chick kind
        : L.intro.cw ? [{ h: 100 * s, gap: 0, draw: (x, y, w) => artStage(x, y, w, 100 * s, s, () => drawCwIntro(ctx, L.intro.cw, x, y, w, 100 * s, G.t)) }] // v4: meet the clockwork creature
        : !L.boss && L.salamander ? [{ h: 96 * s, gap: 0, draw: (x, y, w) => artStage(x, y, w, 96 * s, s, () => salIntroArt(x, y, w, 96 * s)) }] : []), // v3.2: meet the salamander
      ...wrapText(L.intro.line, 17 * s, iw).slice(0, 4).map((l, i) => lineBlock(l, 17 * s, { tag: 'wintro:' + i, gap: i ? 2 * s : 8 * s })),
      { h: 58 * s, gap: 18 * s, draw: (x, y, w) => ui.button('gotit', 'GOT IT', x, y, w, 58 * s, { kind: 'primary', shimmer: true, icon: ICON.play, size: 23 * s }) },
    ], { ribbon: L.boss ? '#c9342c' : acc });
    return;
  }
  drawLevelIntro(L, acc);
}

// ---- the level intro: a full-screen page (mykee 2026-11-16: "this needs to be FULL SCREEN, not half the screen")
// The world behind goes soft and dark; title, goal, who is hunting, the chick picker and PLAY use the whole screen.
// Portrait: one column (title and goal on top, picker in the middle, PLAY at the bottom). Landscape: info left, picker + PLAY right.
const frzKey = () => `${G.screen}:${G.scrSeq}:${canvas.width}x${canvas.height}:${save.calm ? 1 : 0}`;
function captureBack() { // keep what is on the canvas now as this visit's backdrop
  try {
    const c = G.frzC || (G.frzC = document.createElement('canvas'));
    if (c.width !== canvas.width || c.height !== canvas.height) { c.width = canvas.width; c.height = canvas.height; }
    const x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height); x.drawImage(canvas, 0, 0);
    G.frz = { key: frzKey() };
  } catch (_) { G.frz = null; }
}
function introBackdrop() {
  if (G.frzActive) return; // the frozen picture already is this backdrop
  try { // a cheap blur: shrink the frame, stretch it back with smoothing (no per-frame ctx.filter on a phone)
    const cw = canvas.width, ch = canvas.height, k = 1 / 10, sw = Math.max(8, Math.round(cw * k)), sh = Math.max(8, Math.round(ch * k));
    const o = G.introBlur || (G.introBlur = document.createElement('canvas'));
    if (o.width !== sw || o.height !== sh) { o.width = sw; o.height = sh; }
    const oc = o.getContext('2d');
    oc.imageSmoothingEnabled = true; oc.imageSmoothingQuality = 'high';
    oc.clearRect(0, 0, sw, sh); oc.drawImage(canvas, 0, 0, sw, sh);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(o, 0, 0, cw, ch);
    ctx.restore();
  } catch (e) { /* the plain dim below is enough */ }
  dim(0.66);
  const g = ctx.createRadialGradient(W_ / 2, H_ * 0.45, Math.min(W_, H_) * 0.25, W_ / 2, H_ * 0.45, Math.max(W_, H_) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(8,4,2,0.5)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W_, H_);
  if (G.screenT > 0.25) captureBack(); // after the first frames (the scene settles): reuse it from now on
}

// which chicks this level offers: { open, id (the equipped one), choice (2+ to pick from), need (a first-timer must tap one) }
function introChicks() {
  const open = strikesOpen(), K = G.sim && G.sim.stk;
  if (!K || !K.any || !open.length || (G.li >= 0 && G.level.id < STRIKE_FROM)) return { open: [], id: null, choice: false, need: false };
  const choice = open.length > 1;
  return { open, id: K.id || null, choice, need: choice && !K.id && (save.seen.pickN || 0) < 2 };
}
// the first two levels with a choice ask for a pick; after that the last used chick (else the newest) is already on
function introAutoPick(L, i) {
  const open = strikesOpen();
  if (!open.length || (i >= 0 && L.id < STRIKE_FROM) || (G.stkSel && G.stkSel.lid === L.id)) return;
  if (open.length > 1 && (save.seen.pickN || 0) < 2) return;
  const last = open.find((S) => S.id === save.lastStk) || open[open.length - 1];
  G.stkSel = { lid: L.id, id: last.id };
}

// a chick's power in at most three words, and its downside in a few more (the icon carries the rest)
const POWER_WORDS = { freeze: ['Freeze 6s', 'Rings ice over'], thunder: ['Chain stun', 'Eggs get jolted'], bomb: ['Blast + clear', 'Eggs get shoved'], decoy: ['Lure 7s', 'Hunters speed up'], tornado: ['Twist ring', 'A ring spins'], glue: ['Glue 8s', 'Eggs can stick'],
  phoenix: ['Flies egg home', 'Once a level'], tock: ['Stop time 5s', 'Clock loses 10s'], bubble: ['Bubble eggs 6s', 'Eggs float, pop'] };
// a long tip as one short line: its first sentence, cut at a comma or a word before ~46 characters
function shortTip(t) {
  if (!t) return '';
  let q = t.split(/(?<=[.!?:;])\s/)[0].replace(/[.:;]$/, '');
  if (q.length > 46) { const c = q.slice(0, 46), i = Math.max(c.lastIndexOf(','), c.lastIndexOf(' \u2014 ')); q = i > 20 ? c.slice(0, i) : c.slice(0, c.lastIndexOf(' ')); }
  return q;
}
// one chick card. sel: 0..1 eased selection (lift, grow, bright border, glow, check); dim: another card is chosen
function chickCard(S, x, y, w, h, s, o) {
  const sel = o.sel, pulse = o.need && !save.calm ? 1 + 0.018 * Math.sin(G.t * 4 + o.i * 0.9) : 1;
  const bn = o.bounce ? 1 + 0.07 * o.bounce * Math.sin(o.bt * 24) : 1;
  const k = (1 + 0.08 * sel) * pulse * bn, cx = x + w / 2, cy = y + h / 2 - 7 * s * sel;
  const ac = o.acc, r = 16 * s;
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-w / 2, -h / 2);
  if (o.dim) ctx.globalAlpha = 0.8;
  // (2026-11-19, mykee: the see-through look read as broken) a locked card stays solid; its art gets a dark veil instead
  if (o.tipGlow && !PERF.low) { ctx.save(); ctx.shadowColor = '#ffc83a'; ctx.shadowBlur = (16 + (save.calm ? 0 : 8 * Math.sin(G.t * 3))) * s; ui.roundRect(0, 0, w, h, r); ctx.fillStyle = '#ffc83a'; ctx.fill(); ctx.restore(); }
  if (sel > 0.02 && !PERF.low) { // soft glow in the accent colour (a blur pass: not on Low graphics)
    ctx.save(); ctx.shadowColor = ac; ctx.shadowBlur = 26 * s * sel; ctx.globalAlpha *= sel;
    ui.roundRect(0, 0, w, h, r); ctx.fillStyle = ac; ctx.fill(); ctx.restore();
  }
  ui.frame(0, 0, w, h, { s: s * 0.62, r, shadow: sel < 0.5 });
  const pad = 7 * s;
  const PW = POWER_WORDS[S.id] || ['', ''];
  if (o.wide) { // a lone chick: art on the left; name, power pictogram + words, downside on the right
    const aw = Math.min(h - 2 * pad, w * 0.4);
    artStage(pad, pad, aw, h - 2 * pad, s, () => drawStrikeStage(ctx, S.id, pad, pad + 2 * s, aw, h - 2 * pad - 4 * s, G.t));
    const tx = pad * 2 + aw, tw = w - tx - pad * 1.5, iz = 30 * s;
    let ty = h / 2 - 38 * s;
    ui.text(S.name, tx, ty, { size: 19 * s, color: S.col ? ui.tint(S.col[1], -0.3) : ui.C.ink, maxW: tw, noRecord: true }); ty += 34 * s;
    pictoPower(ctx, S.id, tx + iz / 2, ty, iz, G.t); ui.text(PW[0], tx + iz + 6 * s, ty, { size: 16 * s, color: ui.C.ink, maxW: tw - iz - 6 * s, noRecord: true }); ty += 32 * s;
    pictoWarn(ctx, tx + iz / 2, ty, iz * 0.7); ui.text(PW[1], tx + iz + 6 * s, ty, { size: 13 * s, color: ui.C.warn, maxW: tw - iz - 6 * s, noRecord: true });
  } else {
    const ah = h - 2 * pad - o.textH;
    artStage(pad, pad, w - 2 * pad, ah, s, () => drawStrikeStage(ctx, S.id, pad, pad + 2 * s, w - 2 * pad, ah - 4 * s, G.t));
    // (the power badge moved off the art, 2026-11-19, mykee: it covered the chick; it now leads the power line below)
    const bz = Math.min(ah * 0.5, w * 0.36);
    if (o.locked) { ui.roundRect(pad + 1.5 * s, pad + 3.5 * s, w - 2 * pad - 3 * s, ah - 7 * s, 12 * s); ctx.fillStyle = 'rgba(10,14,30,0.38)'; ctx.fill(); }
    if (o.locked) { // a padlock on the art, and the coin price on a chip: green when affordable, grey when not
      const lz = bz * 0.7, lx = pad + lz * 0.65, ly = pad + lz * 0.65;
      ctx.beginPath(); ctx.arc(lx, ly, lz * 0.62, 0, 7); ctx.fillStyle = '#25355c'; ctx.fill(); ctx.lineWidth = 1.5 * s; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = lz * 0.12; ctx.beginPath(); ctx.arc(lx, ly - lz * 0.12, lz * 0.2, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = '#ffd24a'; ui.roundRect(lx - lz * 0.3, ly - lz * 0.12, lz * 0.6, lz * 0.42, lz * 0.08); ctx.fill();
      const price = o.locked.price, ph = Math.min(22 * s, ah * 0.4), pw = Math.min(w - 2 * pad - 6 * s, ph * 2 + ui.measure(String(price), ph * 0.7)), px = w / 2 - pw / 2, py = pad + ah - ph - 3 * s;
      ui.roundRect(px, py, pw, ph, ph / 2); ctx.fillStyle = o.locked.canAfford ? '#3eb42d' : '#8a7a68'; ctx.fill(); ctx.lineWidth = 1.5 * s; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.stroke();
      drawCoin(ctx, px + ph * 0.55, py + ph / 2, ph * 0.36, G.t);
      ui.text(String(price), px + ph * 1.0 + (pw - ph) / 2 - ph * 0.1, py + ph / 2 + 0.5 * s, { size: ph * 0.7, align: 'center', color: '#fff', maxW: pw - ph, noRecord: true });
    }
    let ty = pad + ah + o.ns * 0.75;
    const nmCol = S.col ? ui.tint(S.col[1], -0.3) : ui.C.ink;
    (o.two ? S.name.split(' ') : [S.name]).forEach((wd) => { ui.text(wd, w / 2, ty, { size: o.ns, align: 'center', color: nmCol, maxW: w - 2 * pad, noRecord: true }); ty += o.ns * 1.1; });
    ty += o.ls * 0.3;
    o.lines.forEach((l, j) => {
      if (j === 0) { // a solid round badge with the power's pictogram, then the power in words
        const bd = o.ls * 1.75, tw = Math.min(ui.measure(l, o.ls), w - 2 * pad - bd - 5 * s), x0 = w / 2 - (bd + 5 * s + tw) / 2;
        ctx.save(); ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(x0 + bd / 2, ty, bd / 2, 0, 7); ctx.fillStyle = '#25355c'; ctx.fill(); ctx.lineWidth = 1.5 * s; ctx.strokeStyle = '#fff'; ctx.stroke();
        pictoPower(ctx, S.id, x0 + bd / 2, ty, bd * 0.86, G.t);
        ctx.restore();
        ui.text(l, x0 + bd + 5 * s, ty, { size: o.ls, color: ui.C.ink, maxW: tw + 1, noRecord: true });
      } else ui.text(l, w / 2, ty, { size: o.ls, align: 'center', color: ui.C.ink, maxW: w - 2 * pad, noRecord: true });
      ty += o.ls * 1.2;
    });
  }
  if (S.premium) { // a premium chick: a gold inner rim and the crown on the card's top-left corner
    ctx.save(); ui.roundRect(3 * s, 3 * s, w - 6 * s, h - 6 * s, r - 3 * s); ctx.lineWidth = 2.5 * s; ctx.strokeStyle = '#ffc928'; ctx.stroke(); ctx.restore();
    drawPremiumBadge(ctx, 6 * s + 10 * s, 4 * s, 11 * s, G.t);
  }
  if (sel > 0.02) { // thick bright border + the check badge
    ctx.save(); ctx.globalAlpha *= sel; ctx.lineJoin = 'round';
    ui.roundRect(0, 0, w, h, r); ctx.lineWidth = 5 * s; ctx.strokeStyle = ac; ctx.stroke();
    ui.roundRect(2.5 * s, 2.5 * s, w - 5 * s, h - 5 * s, r - 2.5 * s); ctx.lineWidth = 1.5 * s; ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.stroke();
    const br = 13 * s, bx = w - 4 * s, by = 4 * s;
    ctx.beginPath(); ctx.arc(bx, by, br, 0, 7); ctx.fillStyle = '#3eb42d'; ctx.fill(); ctx.lineWidth = 2.5 * s; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx - br * 0.45, by + br * 0.02); ctx.lineTo(bx - br * 0.1, by + br * 0.38); ctx.lineTo(bx + br * 0.5, by - br * 0.34);
    ctx.lineWidth = 3 * s; ctx.lineCap = 'round'; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

// the picker block: cards in a grid (one row when they fit), or one wide card for a lone chick
function pickerBlocks(s, iw, minW) {
  const T = introChicks(), locked = lockedChicks(); // locked: chicks to unlock for coins (shop)
  if (!T.open.length && locked.length) T.id = null;
  if (!T.open.length && !locked.length) { // chicks only work on villains: on a level without any, they rest (and say so, no picker to anticipate)
    const rest = strikesOpen().length && !(G.li >= 0 && G.level.id < STRIKE_FROM);
    return { blocks: rest ? [lineBlock('No villains: chicks rest', 14.5 * s, { color: '#fff0d4', stroke: 'rgba(40,20,5,0.8)', tag: 'intro:rest', gap: 0 })] : [], T };
  }
  const items = [...T.open.map((S) => ({ S })), ...locked.map((c) => ({ S: STRIKE[c.id], locked: c }))];
  const n = items.length, gap = 10 * s, acc = G.introAcc;
  const maxCols = Math.max(1, Math.floor((iw + gap) / (minW + gap)));
  const rows = Math.ceil(n / maxCols), cols = Math.ceil(n / rows);
  const cw = Math.min(n === 1 ? 360 * s : 150 * s, (iw - (cols - 1) * gap) / cols);
  const ls = Math.max(10, Math.min(12.5 * s, cw / 9.5));
  const lines = items.map(({ S }) => wrapText((POWER_WORDS[S.id] || [''])[0], ls, cw - 14 * s).slice(0, 2));
  // the name is the bigger line (1.2x the power text); a narrow card breaks it in two ("Thunder / Chick") rather than shrinking it
  const nm = (S) => ui.measure(S.name, 100) / 100, nw = cw - 14 * s;
  let ns = ls * 1.2; const two = items.some(({ S }) => nm(S) * ns > nw);
  if (two) ns = Math.min(ns, nw / Math.max(...items.flatMap(({ S }) => S.name.split(' ').map((w) => ui.measure(w, 100) / 100))));
  const nl = Math.max(...lines.map((l) => l.length)), textH = ns * 1.15 * (two ? 2 : 1) + 4 * s + nl * ls * 1.2 + ls * 0.6 + 4 * s;
  const ch = n === 1 ? 118 * s : Math.min(rows > 1 ? 170 * s : 300 * s, 64 * s + textH + (rows > 1 ? 0 : 38 * s));
  const B = [];
  const hint = T.need ? 'Pick a chick to help you' : T.choice ? 'Your chick' : T.id ? 'Your chick' : 'Tap to take along';
  B.push({ h: 24 * s, gap: 0, draw: (x, y, w) => {
    const pu = T.need && !save.calm ? 1 + 0.04 * Math.sin(G.t * 4) : 1;
    ctx.save(); ctx.translate(x + w / 2, y + 12 * s); ctx.scale(pu, pu); ctx.translate(-(x + w / 2), -(y + 12 * s));
    ui.text(hint, x + w / 2, y + 12 * s, { size: 18 * s, align: 'center', maxW: w, color: T.need ? '#ffe27a' : '#fff6e0', stroke: 'rgba(40,20,5,0.85)', tag: 'intro:pickhint' });
    ctx.restore();
  } });
  B.push({ h: rows * ch + (rows - 1) * gap + 22 * s, gap: 10 * s, draw: (x, y, w) => {
    y += 16 * s; // room for a lifted card
    items.forEach(({ S, locked: LK }, i) => {
      const r = Math.floor(i / cols), inRow = r === rows - 1 ? n - r * cols : cols, c = i - r * cols;
      const rx = x + w / 2 - (inRow * cw + (inRow - 1) * gap) / 2 + c * (cw + gap), ry = y + r * (ch + gap);
      const A = (G.cardSel || (G.cardSel = {})), want = S.id === T.id ? 1 : 0, st = A[S.id] || (A[S.id] = { v: want, t: G.t });
      const dt = Math.min(0.05, Math.max(0, G.t - st.t)); st.t = G.t; st.v += (want - st.v) * Math.min(1, dt * 14);
      const pk = G.introPick && G.introPick.id === S.id ? G.introPick : null, bt = pk ? G.t - pk.t : 9;
      chickCard(S, rx, ry, cw, ch, s, { sel: st.v, dim: !!T.id && S.id !== T.id && T.choice, locked: LK, tipGlow: !!(LK && G.introTip && G.introTip.id === S.id), need: T.need, i, acc, wide: n === 1, lines: lines[i], ls, ns, two, textH,
        bounce: bt < 0.4 && !save.calm ? 1 - bt / 0.4 : 0, bt });
      const rect = { x: rx, y: ry, w: cw, h: ch };
      const bid = LK ? 'stk:buy:' + S.id : 'stk:pick:' + S.id;
      ui.record(rect, 'btn:' + bid, 'btn:' + bid);
      ui.buttons.push({ id: bid, ...rect });
    });
  } });
  if (G.introTip && locked.some((c) => c.id === G.introTip.id) && !T.id) B.push(lineBlock(shortTip(G.introTip.line) || G.introTip.line, 13.5 * s, { color: '#ffe27a', stroke: 'rgba(40,20,5,0.85)', tag: 'intro:offer', gap: 2 * s }));
  const S = T.id ? STRIKE[T.id] : null;
  if (S && T.choice) B.push({ h: 20 * s, gap: 2 * s, draw: (x, y, w) => { // the downside: a warning sign and a few words
    const tw = Math.min(w, ui.measure((POWER_WORDS[S.id] || ['', ''])[1], 14 * s) + 28 * s), x0 = x + w / 2 - tw / 2;
    pictoWarn(ctx, x0 + 9 * s, y + 10 * s, 18 * s);
    ui.text((POWER_WORDS[S.id] || ['', ''])[1], x0 + 22 * s, y + 10 * s, { size: 14 * s, color: '#ffb48a', stroke: 'rgba(40,20,5,0.8)', maxW: w - 24 * s, tag: 'intro:stkdn' });
  } });
  return { blocks: B, T };
}

// ---- the level page (rebuilt 2026-11-19 after mykee: "villains too small", "chick cards too small", "letters too small",
// "we are not showing how many coins they have", "make it a scrollable menu to pick the chick").
// One page that scrolls up and down: title, the goal, how to earn each star, every villain as a big animated portrait
// with what it does and how to beat it, the tip, then the chicks in a big row that swipes left and right, then the
// boosters. PLAY and Levels stay pinned at the bottom; the coin balance (a shortcut to the shop) at the top.
// Landscape: the information scrolls on the left, the chick row, boosters and PLAY sit on the right.
// Anything recorded for taps outside the visible window is cut away (clipRecorded), so a hidden button never takes a tap.
function clipRecorded(r0, b0, V) {
  const cut = (a) => {
    const x0 = Math.max(a.x, V.x), y0 = Math.max(a.y, V.y), x1 = Math.min(a.x + a.w, V.x + V.w), y1 = Math.min(a.y + a.h, V.y + V.h);
    return x1 - x0 > 1 && y1 - y0 > 1 ? { ...a, x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
  };
  ui.rects.splice(r0, Infinity, ...ui.rects.slice(r0).map(cut).filter(Boolean));
  ui.buttons.splice(b0, Infinity, ...ui.buttons.slice(b0).map(cut).filter(Boolean));
}
// a scroller's glide (the same feel as the map and the shop): fling, friction, clamp
function glide(S) {
  const dt = Math.min(0.1, Math.max(0, G.t - (S.t || G.t))); S.t = G.t;
  if (S.to != null) { S.v = 0; S.y += (Math.min(S.to, S.max) - S.y) * Math.min(1, dt * 9); if (Math.abs(Math.min(S.to, S.max) - S.y) < 1 || (G.pdrag && G.pdrag.sc === S)) S.to = null; }
  else if (!G.pdrag || !G.pdrag.moved || G.pdrag.sc !== S) { if (Math.abs(S.v) > 8) { S.y += S.v * dt; S.v *= Math.exp(-SCROLL_DRAG * dt); } else S.v = 0; }
  const cl = clamp(S.y, 0, S.max); if (cl !== S.y) S.v = 0; S.y = cl;
}
function chevron(x, y, sz, dir, a = 1) { // a small round arrow: there is more this way
  ctx.save(); ctx.globalAlpha *= a;
  ctx.beginPath(); ctx.arc(x, y, sz, 0, 7); ctx.fillStyle = 'rgba(30,18,8,0.72)'; ctx.fill(); ctx.lineWidth = Math.max(1, sz * 0.12); ctx.strokeStyle = 'rgba(255,240,200,0.75)'; ctx.stroke();
  ctx.beginPath();
  if (dir === 'l' || dir === 'r') { const d = dir === 'l' ? -1 : 1; ctx.moveTo(x - d * sz * 0.22, y - sz * 0.42); ctx.lineTo(x + d * sz * 0.26, y); ctx.lineTo(x - d * sz * 0.22, y + sz * 0.42); }
  else { const d = dir === 'u' ? -1 : 1; ctx.moveTo(x - sz * 0.42, y - d * sz * 0.2); ctx.lineTo(x, y + d * sz * 0.26); ctx.lineTo(x + sz * 0.42, y - d * sz * 0.2); }
  ctx.lineWidth = sz * 0.24; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#fff3cf'; ctx.stroke();
  ctx.restore();
}

// ---- page pieces shared by the level page and the pause page
const pageSection = (str, s, tag) => ({ h: 26 * s, gap: 18 * s, draw: (x, y, w) => {
  const ts = 17 * s, tw = Math.min(w, ui.measure(str, ts)), lw = Math.max(0, (w - tw) / 2 - 14 * s);
  if (lw > 12 * s) { ctx.fillStyle = 'rgba(255,226,122,0.45)'; ctx.fillRect(x, y + 13 * s, lw, 1.5 * s); ctx.fillRect(x + w - lw, y + 13 * s, lw, 1.5 * s); }
  ui.text(str, x + w / 2, y + 13 * s, { size: ts, align: 'center', maxW: w, color: '#ffe27a', stroke: 'rgba(40,20,5,0.9)', tag: 'intro:sec:' + tag });
} });
// every villain: a big living portrait, its name, what it does and how to beat it (no tapping needed to read it)
function foeCard(k, i, s, iw) {
  const C = ui.C;
  const I = VILLAIN_INFO[k] || { name: k, does: '', group: 'creature' }, P = 96 * s, tx0 = P + 26 * s, tw = iw - tx0 - 14 * s;
  const ds = 15.5 * s, bs = 15 * s, dl = wrapText(I.does || '', ds, tw).slice(0, 2), bl = I.beat ? wrapText('Beat it: ' + I.beat, bs, tw).slice(0, 2) : [];
  const th = 12 * s + 26 * s + dl.length * ds * 1.25 + (bl.length ? 5 * s + bl.length * bs * 1.25 : 0) + 10 * s, h = Math.max(P + 18 * s, th);
  return { h, gap: i ? 10 * s : 8 * s, draw: (x, y, w) => {
    const grp = 'intro:foe' + i;
    ui.well(x, y, w, h, { s, a: '#f3e2bd', b: '#fbf0d6' });
    const bg = PORTRAIT_BG[I.group] || PORTRAIT_BG.creature, px = x + 11 * s, py = y + (h - P) / 2;
    ui.well(px, py, P, P, { s, r: 14 * s, a: bg[0], b: bg[1], border: 'rgba(40,24,10,0.7)', shade: 'rgba(0,0,10,0.45)', paint: () => drawVillainPortrait(ctx, k, px + P / 2, py + P / 2, P, G.t) });
    ui.record({ x: px, y: py, w: P, h: P }, grp + ':art', grp);
    let ty = y + 12 * s + 13 * s;
    const nm = ui.text(I.name, x + tx0, ty, { size: 20 * s, color: I.group === 'boss' ? '#b3301c' : '#5a2f0e', maxW: tw, tag: grp + ':name', group: grp });
    if (I.group === 'boss' && nm.x + nm.w + 56 * s < x + w - 10 * s) { // a red BOSS tag after a boss's name
      const ts = 11 * s, tg = ui.measure('BOSS', ts) + 12 * s, gx = nm.x + nm.w + 8 * s;
      ui.roundRect(gx, ty - ts * 0.8, tg, ts * 1.6, ts * 0.8); ctx.fillStyle = '#c9342c'; ctx.fill();
      ui.text('BOSS', gx + tg / 2, ty, { size: ts, align: 'center', color: '#fff', noRecord: true });
    }
    ty += 13 * s + ds * 0.72;
    dl.forEach((l) => { ui.text(l, x + tx0, ty, { size: ds, color: C.ink, maxW: tw, tag: grp + ':d' + l.slice(0, 10), group: grp }); ty += ds * 1.25; });
    if (bl.length) { ty += 5 * s; bl.forEach((l) => { ui.text(l, x + tx0, ty, { size: bs, color: '#2d7a1c', maxW: tw, tag: grp + ':b' + l.slice(0, 10), group: grp }); ty += bs * 1.25; }); }
  } };
}
const pageColH = (B, s) => B.reduce((a, b) => a + (b.gap ?? 10 * s) + b.h, 0);
// a scrolling column of blocks inside V (screen coordinates; the scroll is applied to y, so recorded rects are real)
function pageScroll(blocks, S, V, x, w, s, top) {
  const H = pageColH(blocks, s) + 18 * s;
  S.max = Math.max(0, H - V.h);
  glide(S);
  const r0 = ui.rects.length, b0 = ui.buttons.length;
  ctx.save(); ctx.beginPath(); ctx.rect(V.x, V.y, V.w, V.h); ctx.clip();
  let y = V.y + (S.max > 0 || top ? 6 * s : Math.max(6 * s, (V.h - H) * 0.35)) - S.y;
  G.ipAnchor = {};
  for (const b of blocks) { y += b.gap ?? 10 * s; if (b.anchor) G.ipAnchor[b.anchor] = y + S.y - V.y - 8 * s; if (y + b.h > V.y - 40 * s && y < V.y + V.h + 40 * s) b.draw(x, y, w); y += b.h; }
  ctx.restore();
  clipRecorded(r0, b0, V);
  if (S.max > 0) { // soft edges, and an arrow while there is more below
    const fade = (yy, down) => { const g = ctx.createLinearGradient(0, yy, 0, yy + (down ? 22 : -22) * s); g.addColorStop(0, 'rgba(12,7,3,0.55)'); g.addColorStop(1, 'rgba(12,7,3,0)'); ctx.fillStyle = g; ctx.fillRect(V.x, down ? yy : yy - 22 * s, V.w, 22 * s); };
    if (S.y > 1) fade(V.y, true);
    if (S.y < S.max - 1) { fade(V.y + V.h, false); chevron(Math.min(V.x + V.w - 18 * s, x + w + 6 * s), V.y + V.h - 18 * s + (save.calm ? 0 : 3 * s * Math.sin(G.t * 4)), 14 * s, 'd', S.y < 12 * s ? 1 : 0.6); }
  }
}

// The level card's how-to stage in the game's own art (2026-11-20, mykee: "the weasel looks cartoonish and too small,
// use the proper in-game drawings"): a tiny stand-in vault (one ring of the level's material, one egg, the nest) built
// once per level and never stepped. The stage poses it each frame (ring angle, egg position) and draws it with the very
// functions the play screen uses; the backdrop is the level's own, painted once into a small picture.
const HOWW = { key: '', sim: null, ringR: 2.1, bk: '', bcv: null };
function howWorld() {
  const L = G.level;
  if (!L || !G.theme) return null;
  const key = L.id + '|' + (L.material || 'wood') + '|' + G.theme.id;
  if (HOWW.key !== key) {
    HOWW.key = key; HOWW.bk = '';
    try {
      HOWW.sim = new Sim({ id: -77, theme: L.theme, material: L.material || 'wood', eggs: 1, target: 1, time: 99, spacing: 1.05, nest: { w: 2.6 }, rings: [{ gaps: [{ a: -90 }] }, { gaps: [{ a: -90 }] }] }, { mode: 'medium' });
      HOWW.ringR = HOWW.sim.rings[HOWW.sim.rings.length - 1].r;
    } catch (e) { HOWW.sim = null; }
  }
  if (!HOWW.sim) return null;
  const sim = HOWW.sim, ring = sim.rings[sim.rings.length - 1], egg = sim.eggs[0];
  return {
    ringR: HOWW.ringR,
    back(c, x, y, w, h) {
      const bk = key + '|' + Math.round(w) + 'x' + Math.round(h) + '@' + DPR;
      if (HOWW.bk !== bk) {
        try {
          const cv = HOWW.bcv || (HOWW.bcv = document.createElement('canvas'));
          cv.width = Math.max(2, Math.ceil(w * DPR)); cv.height = Math.max(2, Math.ceil(h * DPR));
          const b = G.backdrop || backdropFor(G.theme, L.id * 97), q = cv.getContext('2d'), sc = w / W_, gy = H_ * 0.8;
          q.setTransform(DPR * sc, 0, 0, DPR * sc, 0, DPR * (h * 0.9 - gy * sc));
          b.draw(q, 0, { x: 0, y: 0, zoom: 1 });
          b.drawGround(q, 0, gy, W_, H_ - gy, 0);
          HOWW.bk = bk;
        } catch (e) { return false; }
      }
      c.drawImage(HOWW.bcv, x, y, w, h);
      return true;
    },
    ring(c, C, k, ang, t) {
      try { ring.body.setAngle(ang); } catch (e) { /* drawn at its last angle */ }
      c.save(); c.translate(C.x, C.y); c.scale(k, -k);
      W.drawRing(c, ring, G.theme, k, t, { eggs: [] });
      c.restore();
    },
    egg(c, X, Y, stone, worry, C, k, t) {
      try { egg.body.setTransform({ x: (X - C.x) / k, y: -(Y - C.y) / k }, worry ? Math.sin(t * 22) * 0.08 : 0); } catch (e) { return; }
      egg.stone = stone ? 1 : 0;
      c.save(); c.translate(C.x, C.y); c.scale(k, -k);
      W.drawEgg(c, egg, t, k);
      c.restore();
    },
    nest(c, X, Y, wPx, glow, t) {
      const p = sim.nest.getPosition(), kn = wPx / sim.nestW;
      c.save(); c.translate(X, Y); c.scale(kn, -kn); c.translate(-p.x, -p.y);
      W.drawNest(c, sim, G.theme, t, 0);
      c.restore();
    },
  };
}
function drawLevelIntro(L, acc) {
  const section = pageSection, foeRow = foeCard, colH = pageColH, scrollCol = pageScroll;
  ui.calm = save.calm;
  introBackdrop();
  const u = ui.u, A = ui.A, C = ui.C, wo = worldOpener(L);
  const land = A.w > A.h * 1.15;
  G.introAcc = tintHex(/^#[0-9a-f]{6}$/i.test((ui.skin && ui.skin.ribbon) || '') ? ui.skin.ribbon : acc);
  const kinds = G.li >= 0 && G.infoKinds ? G.infoKinds.filter((k) => hasPortrait(k) || VILLAIN_INFO[k]).slice(0, 8) : [];
  const label = G.li === -2 ? 'Lab' : G.li < 0 ? `Daily Vault ${today().slice(5)}` : `Level ${L.id}`;
  const INK = 'rgba(40,20,5,0.9)';
  const head = (s) => [
    { h: 44 * s, gap: 0, draw: (x, y, w) => ui.ribbon(label, x + w / 2, y, clamp(ui.measure(label, 28 * s) + 74 * s, 160 * s, w), 44 * s, { s, color: acc, size: 28 * s, tag: 'intro:level' }) },
    { h: 42 * s, gap: 8 * s, draw: (x, y, w) => ui.text(L.name, x + w / 2, y + 22 * s, { size: 34 * s, align: 'center', maxW: w, color: '#fff', stroke: INK, shadow: 'rgba(0,0,0,0.35)', tag: 'intro:name' }) },
    ...(wo || WORLDS[envOf(G.li)] ? [lineBlock(wo ? (WORLDS[envOf(G.li)] || L.intro.title) : WORLDS[envOf(G.li)], 17 * s, { color: '#ffe27a', stroke: INK, tag: 'intro:world', gap: 2 * s })] : []),
  ];
  // the goal card (2026-11-19, mykee: "too much verbosity"): eggs and the clock on top, the three stars as a short strip
  // under them (mirrors computeResult: 1 enough eggs home, 2 none lost, 3 none cracked), the bonus goal last
  const goal = (s) => {
    const bon = G.li >= 0 && L.bonus ? BONUS_TEXT(L.bonus, G.sim.MD.fuse) : '', stars = G.li >= 0;
    const H = 84 * s + (stars ? 70 * s : 0) + (bon ? 34 * s : 0) + 4 * s;
    return [{ h: H, gap: 14 * s, draw: (x, y, w) => {
      ui.well(x, y, w, H, { s, a: '#f3e2bd', b: '#fbf0d6' });
      const n = L.eggs, tl = G.sim && G.sim.timeLimit, sp = Math.min(44 * s, (w * 0.55) / n), es = Math.min(38 * s, sp * 0.95);
      const gx = tl ? x + w * 0.36 : x + w / 2, ey = y + 34 * s;
      for (let i = 0; i < n; i++) { ctx.globalAlpha = i < L.target ? 1 : 0.38; drawEggIcon(ctx, gx + (i - (n - 1) / 2) * sp, ey, es, 'alive'); }
      ctx.globalAlpha = 1;
      ui.record({ x: gx - n * sp / 2, y: ey - 20 * s, w: n * sp, h: 40 * s }, 'intro:eggs');
      const need = L.target === L.eggs ? `Bring all ${n} eggs home` : `Bring ${L.target} of ${n} eggs home`;
      ui.text(need, gx, y + 68 * s, { size: 16 * s, align: 'center', color: C.ink, maxW: tl ? w * 0.64 : w - 24 * s, tag: 'intro:need' });
      if (tl) { // the clock and its seconds
        const cx = x + w * 0.83;
        ctx.fillStyle = 'rgba(122,80,40,0.18)'; ctx.fillRect(x + w * 0.68, y + 14 * s, 1.5 * s, 56 * s);
        pictoClock(ctx, cx, y + 32 * s, 32 * s);
        ui.text(`${Math.round(tl)} s`, cx, y + 68 * s, { size: 19 * s, align: 'center', color: C.warn, tag: 'intro:time', maxW: w * 0.3 });
      }
      let yy = y + 84 * s;
      if (stars) {
        ctx.fillStyle = 'rgba(122,80,40,0.18)'; ctx.fillRect(x + 12 * s, yy, w - 24 * s, 1.5 * s);
        const lab = [L.target === L.eggs ? `All ${n} home` : `${L.target} of ${n} home`, 'Lose none', 'No cracks'], cw3 = (w - 16 * s) / 3, sr = 9.5 * s;
        for (let i = 0; i < 3; i++) {
          const cx = x + 8 * s + cw3 * (i + 0.5);
          if (i) { ctx.fillStyle = 'rgba(122,80,40,0.14)'; ctx.fillRect(cx - cw3 / 2, yy + 10 * s, 1.2 * s, 50 * s); }
          for (let j = 0; j < 3; j++) drawStar(ctx, cx + (j - 1) * sr * 2.15, yy + 22 * s, sr, j <= i);
          ui.text(lab[i], cx, yy + 50 * s, { size: 16 * s, align: 'center', color: C.ink, maxW: cw3 - 8 * s, tag: 'intro:star' + i });
        }
        yy += 70 * s;
      }
      if (bon) {
        ctx.fillStyle = 'rgba(122,80,40,0.18)'; ctx.fillRect(x + 12 * s, yy, w - 24 * s, 1.5 * s);
        const str = 'Bonus: ' + bon, tw = Math.min(w - 40 * s, ui.measure(str, 15.5 * s)) + 30 * s, x0 = x + w / 2 - tw / 2;
        pictoTarget(ctx, x0 + 11 * s, yy + 17 * s, 22 * s); ui.text(str, x0 + 28 * s, yy + 17 * s, { size: 15.5 * s, color: '#1f5fa8', maxW: w - 44 * s, tag: 'intro:bonus' });
      }
    } },
    ...(G.li === -1 ? [lineBlock(dailyBest() ? `Today's best: ${dailyBest()}` : `First win today: +${DAILY_COINS} coins`, 16 * s, { color: '#9bd8ff', stroke: 'rgba(10,20,40,0.8)', tag: 'intro:daily', gap: 10 * s })] : []),
    ];
  };
  const foes = (s, iw) => !kinds.length ? [] : [section(kinds.length === 1 ? 'WHO HUNTS YOUR EGGS' : `WHO HUNTS YOUR EGGS (${kinds.length})`, s, 'foes'), ...kinds.map((k, i) => foeRow(k, i, s, iw))];
  // the chicks: big cards in a row that swipes sideways, and the picked chick's power in words under it
  const chicks = (s, iw) => {
    const T = introChicks(), locked = lockedChicks();
    if (!T.open.length && locked.length) T.id = null;
    if (!T.open.length && !locked.length) {
      const rest = strikesOpen().length && !(G.li >= 0 && G.level.id < STRIKE_FROM);
      return { T, blocks: rest ? [lineBlock('No villains here: your chicks rest', 16 * s, { color: '#fff0d4', stroke: INK, tag: 'intro:rest', gap: 16 * s })] : [] };
    }
    const items = [...T.open.map((S) => ({ S })), ...locked.map((c) => ({ S: STRIKE[c.id], locked: c }))];
    const n = items.length, gap = 12 * s, one = n === 1;
    const cw = one ? Math.min(iw, 380 * s) : Math.min(164 * s, (iw - 2 * gap) / 2.35), ch = one ? 136 * s : cw * 1.3;
    const ns = Math.min(18 * s, cw / 8.2), ls = Math.min(15 * s, cw / 10);
    const lines = items.map(({ S }) => wrapText((POWER_WORDS[S.id] || [''])[0], ls, cw - 14 * s - ls * 2.2).slice(0, 2));
    const nw = cw - 14 * s, two = items.some(({ S }) => ui.measure(S.name, ns) > nw);
    const nl = Math.max(...lines.map((l) => l.length)), textH = ns * 1.15 * (two ? 2 : 1) + 6 * s + nl * ls * 1.2 + ls * 0.6 + 6 * s;
    const B = [{ ...section(T.need ? 'PICK A CHICK TO HELP YOU' : 'YOUR CHICK', s, 'chick'), anchor: 'chick' }];
    if (!one) B.push(lineBlock('Swipe for more. Tap one to take it.', 14 * s, { color: '#fff0d4', stroke: INK, tag: 'intro:swipe', gap: 2 * s }));
    const rowH = ch + 30 * s;
    B.push({ h: rowH, gap: 4 * s, draw: (x, y, w) => {
      const R = G.car || (G.car = { y: 0, v: 0, max: 0, t: G.t, lid: null });
      const total = n * cw + (n - 1) * gap, pad = 6 * s;
      R.max = Math.max(0, total - w + 2 * pad);
      if (R.lid !== L.id + ':' + G.li) { // a new level: the picked chick starts in view
        R.lid = L.id + ':' + G.li; R.v = 0;
        const si = Math.max(0, items.findIndex((it) => it.S.id === T.id));
        R.y = clamp(si * (cw + gap) - (w - cw) / 2, 0, R.max);
      }
      glide(R);
      const off = total <= w ? (w - total) / 2 : pad - R.y, V = { x, y, w, h: rowH };
      G.carRect = V;
      const r0 = ui.rects.length, b0 = ui.buttons.length;
      ctx.save(); ctx.beginPath(); ctx.rect(x - 4 * s, y, w + 8 * s, rowH); ctx.clip();
      const cy = y + 18 * s;
      items.forEach(({ S, locked: LK }, i) => {
        const rx = x + off + i * (cw + gap);
        if (rx + cw < x - 10 * s || rx > x + w + 10 * s) return;
        const Asel = (G.cardSel || (G.cardSel = {})), want = S.id === T.id ? 1 : 0, st = Asel[S.id] || (Asel[S.id] = { v: want, t: G.t });
        const dt = Math.min(0.05, Math.max(0, G.t - st.t)); st.t = G.t; st.v += (want - st.v) * Math.min(1, dt * 14);
        const pk = G.introPick && G.introPick.id === S.id ? G.introPick : null, bt = pk ? G.t - pk.t : 9;
        chickCard(S, rx, cy, cw, ch, s, { sel: st.v, dim: !!T.id && S.id !== T.id && T.choice, locked: LK, tipGlow: !!(LK && G.introTip && G.introTip.id === S.id), need: T.need, i, acc: G.introAcc, wide: one, lines: lines[i], ls, ns, two, textH,
          bounce: bt < 0.4 && !save.calm ? 1 - bt / 0.4 : 0, bt });
        const rect = { x: rx, y: cy, w: cw, h: ch }, bid = LK ? 'stk:buy:' + S.id : 'stk:pick:' + S.id;
        ui.record(rect, 'btn:' + bid, 'btn:' + bid); ui.buttons.push({ id: bid, ...rect });
      });
      ctx.restore();
      clipRecorded(r0, b0, V);
      if (R.max > 0) { // arrows where there is more, and a row of dots for where you are
        const ay = cy + ch / 2, az = 15 * s;
        if (R.y > 2) chevron(x + az * 0.6, ay, az, 'l');
        if (R.y < R.max - 2) chevron(x + w - az * 0.6, ay, az, 'r', 0.9 + (save.calm ? 0 : 0.1 * Math.sin(G.t * 4)));
        const pages = Math.min(n, Math.ceil(total / (cw + gap) - w / (cw + gap)) + 1), cur = Math.round((R.y / R.max) * (pages - 1));
        for (let p = 0; p < pages; p++) { ctx.beginPath(); ctx.arc(x + w / 2 + (p - (pages - 1) / 2) * 14 * s, y + rowH - 5 * s, (p === cur ? 4 : 3) * s, 0, 7); ctx.fillStyle = p === cur ? '#ffe27a' : 'rgba(255,240,210,0.4)'; ctx.fill(); }
      }
    } });
    // the chosen chick in words: what it does and what it costs you
    const S = T.id ? STRIKE[T.id] : null, tipL = !S && G.introTip && locked.some((c) => c.id === G.introTip.id) ? (shortTip(G.introTip.line) || G.introTip.line) : '';
    if (S) {
      // 2026-11-20 (show, don't tell): the picked chick's power as a moving cartoon, then its upside and downside
      const ul = wrapText(S.up || (POWER_WORDS[S.id] || [''])[0], 16 * s, iw - 30 * s).slice(0, 2), dl = wrapText('Downside: ' + (S.down || (POWER_WORDS[S.id] || ['', ''])[1]), 15 * s, iw - 30 * s).slice(0, 2);
      const stH = Math.min((iw - 24 * s) * 0.64, 250 * s);
      const h = 12 * s + 24 * s + stH + 10 * s + ul.length * 20 * s + 4 * s + dl.length * 19 * s + 8 * s;
      B.push({ h, gap: 8 * s, draw: (x, y, w) => {
        ui.well(x, y, w, h, { s, a: '#f3e2bd', b: '#fbf0d6' });
        let yy = y + 12 * s + 11 * s;
        ui.text(S.name, x + w / 2, yy, { size: 19 * s, align: 'center', color: S.col ? ui.tint(S.col[1], -0.3) : C.ink, maxW: w - 24 * s, tag: 'intro:pickname' }); yy += 15 * s;
        const Hc = G.howC || (G.howC = { id: null, t0: G.t });
        if (Hc.id !== S.id) { Hc.id = S.id; Hc.t0 = G.t; }
        const foe = kinds.find((k) => !/^(icicles|lava|lightning|embers|quake|rain|current|gusts|popthorns|vines|curse|thornorb)$/.test(k)) || 'snake', th = G.theme && G.theme.palette;
        drawHowTo(ctx, chickPlan(S.id, '', foe.replace(/^boss:/, '') in VILLAIN_INFO ? foe.replace(/^boss:/, '') : foe), x + 12 * s, yy, w - 24 * s, stH, G.t - Hc.t0, { world: howWorld(), calm: save.calm, sky0: th && th.skyTop, sky1: th && th.skyBottom, ground: th && th.groundTop, ring: th && th.ring && th.ring.base, ringEdge: th && th.ring && th.ring.dark });
        ui.roundRect(x + 12 * s, yy, w - 24 * s, stH, Math.min(18, stH * 0.08)); ctx.lineWidth = 2.5 * s; ctx.strokeStyle = 'rgba(90,50,16,0.55)'; ctx.stroke();
        ui.record({ x: x + 12 * s, y: yy, w: w - 24 * s, h: stH }, 'intro:chickstage');
        yy += stH + 10 * s + 9 * s;
        ul.forEach((l, i) => { ui.text(l, x + w / 2, yy, { size: 16 * s, align: 'center', color: C.ink, maxW: w - 24 * s, tag: 'intro:pickup' + i }); yy += 20 * s; });
        yy += 4 * s;
        dl.forEach((l, i) => { ui.text(l, x + w / 2, yy, { size: 15 * s, align: 'center', color: C.warn, maxW: w - 24 * s, tag: 'intro:pickdn' + i }); yy += 19 * s; });
      } });
    } else if (tipL) B.push(lineBlock(tipL, 15 * s, { color: '#ffe27a', stroke: INK, tag: 'intro:offer', gap: 6 * s }));
    return { T, blocks: B };
  };
  const boost = (s) => !save.wallet ? [] : [section('BOOSTERS', s, 'boost'), { h: 76 * s, gap: 8 * s, draw: (x, y, w) => {
    ui.well(x, y, w, 76 * s, { s, a: '#dcbb84', b: '#e9d2a2' });
    drawBoosterPicker(ui, ctx, x + 6 * s, y + 4 * s, w - 12 * s, 68 * s, { wallet: G.golden ? { ...save.wallet, owned: { ...save.wallet.owned, golden: 0 } } : save.wallet, selected: G.boostSel, lastTapped: G.boostLast, t: G.t });
  } }];
  const play = (s, w0, need) => ({ h: 66 * s, gap: 0, draw: (x, y, w) => ui.button('go', 'PLAY', x + (w - w0) / 2, y, w0, 66 * s, { kind: 'primary', shimmer: !need, icon: ICON.play, size: 28 * s }) });
  const links = (s) => ({ h: 50 * s, gap: 10 * s, draw: (x, y, w) => {
    const ad = !G.adBoost && !G.golden, bw = ad ? w * 0.4 : w * 0.5, gp = 10 * s, aw = w - bw - gp, tw = ad ? w : bw, x0 = x + (w - tw) / 2;
    ui.button(G.li === -1 ? 'back' : 'levels', G.li === -1 ? 'Menu' : 'Levels', x0, y, bw, 50 * s, { kind: 'tertiary', icon: ICON.grid, size: 17 * s });
    if (ad) ui.button('adboost', 'Free booster', x0 + bw + gp, y, aw, 50 * s, { kind: 'ad', ad: true, size: 17 * s });
  } });

  // the how-to card (2026-11-20, mykee's friend: "nobody reads the instructions"): a short looping cartoon of the move
  // that beats each villain (or, with no villain, of the basic move), one short line under it, the goal and the stars,
  // and PLAY right inside the card. Several villains take turns (tap the stage for the next one).
  const howPlans = () => {
    const P0 = kinds.length ? kinds.map((k) => howToPlan(k)) : [HOWTO_BASIC];
    if (kinds.some((k) => k === 'weasel' || k === 'rats' || k === 'boss:weasel') && G.sim && G.sim.ally && G.sim.ally.avail.includes('rooster')) P0.push(HOWTO_ROOSTER);
    return P0;
  };
  const howCard = (s, iw, availH, withPlay, need) => {
    const plans = howPlans(), n = plans.length, pd = 12 * s;
    const goalH = 54 * s, capH = 34 * s, dotsH = n > 1 ? 18 * s : 0, playH = withPlay ? 76 * s : 0, starH = G.li >= 0 ? 52 * s : 0;
    const fixed = pd * 2 + goalH + capH + dotsH + playH + 6 * s;
    let stageH = Math.min((iw - 2 * pd) * 0.6, 260 * s), stars = starH > 0;
    if (availH && fixed + starH + stageH < availH) stageH = Math.min((iw - 2 * pd) * 1.02, 390 * s, availH - fixed - starH); // a tall phone: a bigger stage
    if (availH && fixed + starH + stageH > availH) {
      const room = availH - fixed - starH;
      if (room >= 140 * s) stageH = room; else { stars = false; stageH = clamp(availH - fixed, 120 * s, stageH); }
    }
    const H = fixed + stageH + (stars ? starH : 0);
    return [{ h: H, gap: 4 * s, draw: (x, y, w) => {
      ui.well(x, y, w, H, { s, a: '#f3e2bd', b: '#fbf0d6' });
      // the goal: eggs to bring home and the clock, one row
      const nE = L.eggs, tl = G.sim && G.sim.timeLimit, sp = Math.min(34 * s, (w * 0.3) / nE), es = Math.min(30 * s, sp * 0.95);
      let gx = x + pd + 6 * s + es / 2;
      for (let i = 0; i < nE; i++) { ctx.globalAlpha = i < L.target ? 1 : 0.38; drawEggIcon(ctx, gx + i * sp, y + pd + goalH / 2, es, 'alive'); }
      ctx.globalAlpha = 1;
      const need2 = L.target === L.eggs ? `Bring all ${nE} home` : `Bring ${L.target} of ${nE} home`, tx = gx + nE * sp - sp / 2 + 10 * s;
      ui.text(need2, tx, y + pd + goalH / 2, { size: 18 * s, color: C.ink, maxW: x + w - pd - tx - (tl ? 86 * s : 0), tag: 'intro:need' });
      if (tl) { const cx2 = x + w - pd - 70 * s; pictoClock(ctx, cx2, y + pd + goalH / 2, 26 * s); ui.text(`${Math.round(tl)} s`, cx2 + 18 * s, y + pd + goalH / 2, { size: 19 * s, color: C.warn, tag: 'intro:time', maxW: 56 * s }); }
      // the stage
      const Hw = G.how || (G.how = { i: 0, t0: G.t, lid: null });
      if (Hw.lid !== pg.lid) { Hw.lid = pg.lid; Hw.i = 0; Hw.t0 = G.t; }
      if (!save.calm && n > 1 && G.t - Hw.t0 >= HOWTO_LOOP) { Hw.i = (Hw.i + 1) % n; Hw.t0 = G.t; }
      const plan = plans[Hw.i % n], th = G.theme && G.theme.palette, sx = x + pd, sy2 = y + pd + goalH, sw = w - 2 * pd;
      drawHowTo(ctx, plan, sx, sy2, sw, stageH, G.t - Hw.t0, { rooster: allyIcon, world: howWorld(), calm: save.calm, sky0: th && th.skyTop, sky1: th && th.skyBottom, ground: th && th.groundTop, ring: th && th.ring && th.ring.base, ringEdge: th && th.ring && th.ring.dark });
      ui.roundRect(sx, sy2, sw, stageH, Math.min(18, stageH * 0.08)); ctx.lineWidth = 2.5 * s; ctx.strokeStyle = 'rgba(90,50,16,0.55)'; ctx.stroke();
      ui.record({ x: sx, y: sy2, w: sw, h: stageH }, 'intro:stage');
      hotBadge(sx + 8 * s, sy2 + stageH - 8 * s, s); // bottom left, clear of the villain and the egg
      if (n > 1) { ui.buttons.push({ id: 'how:next', x: sx, y: sy2, w: sw, h: stageH }); }
      // a name tag on the stage: who this is (BOSS in red)
      if (plan.kind && plan.move !== 'rooster') {
        const I = VILLAIN_INFO[plan.kind] || { name: plan.kind }, nm = I.name, ts = 15 * s, tw = Math.min(sw - 20 * s, ui.measure(nm, ts) + 22 * s);
        ui.roundRect(sx + sw - 8 * s - tw, sy2 + 8 * s, tw, 26 * s, 13 * s); ctx.fillStyle = I.group === 'boss' ? 'rgba(160,30,40,0.9)' : 'rgba(30,24,40,0.72)'; ctx.fill();
        ui.text(nm, sx + sw - 8 * s - tw / 2, sy2 + 21 * s, { size: ts, align: 'center', color: '#fff', maxW: tw - 12 * s, noRecord: true });
      } else if (plan.move === 'rooster') {
        const nm = 'Papa Rooster helps', ts = 15 * s, tw = ui.measure(nm, ts) + 22 * s;
        ui.roundRect(sx + sw - 8 * s - tw, sy2 + 8 * s, tw, 26 * s, 13 * s); ctx.fillStyle = 'rgba(200,60,30,0.9)'; ctx.fill();
        ui.text(nm, sx + sw - 8 * s - tw / 2, sy2 + 21 * s, { size: ts, align: 'center', color: '#fff', noRecord: true });
      }
      let yy = sy2 + stageH;
      ui.text(plan.cap, x + w / 2, yy + capH / 2 + 1 * s, { size: 17.5 * s, align: 'center', color: '#2d6a1c', maxW: w - 2 * pd, tag: 'intro:cap' });
      yy += capH;
      if (n > 1) { for (let q = 0; q < n; q++) { ctx.beginPath(); ctx.arc(x + w / 2 + (q - (n - 1) / 2) * 16 * s, yy + 6 * s, (q === Hw.i % n ? 5 : 3.5) * s, 0, 7); ctx.fillStyle = q === Hw.i % n ? '#c9842a' : 'rgba(120,80,30,0.35)'; ctx.fill(); } yy += dotsH; }
      if (stars) { // the three stars, short
        ctx.fillStyle = 'rgba(122,80,40,0.18)'; ctx.fillRect(x + pd, yy, w - 2 * pd, 1.5 * s);
        const lab = [L.target === L.eggs ? `All ${nE} home` : `${L.target} of ${nE} home`, 'Lose none', 'No cracks'], cw3 = (w - 2 * pd) / 3, sr = 8 * s;
        for (let i = 0; i < 3; i++) {
          const cx3 = x + pd + cw3 * (i + 0.5);
          for (let j = 0; j < 3; j++) drawStar(ctx, cx3 + (j - 1) * sr * 2.15, yy + 16 * s, sr, j <= i);
          ui.text(lab[i], cx3, yy + 38 * s, { size: 14.5 * s, align: 'center', color: C.ink, maxW: cw3 - 6 * s, tag: 'intro:star' + i });
        }
        yy += starH;
      }
      if (withPlay) ui.button('go', 'PLAY', x + pd, yy + 8 * s, w - 2 * pd, 62 * s, { kind: 'primary', shimmer: !need, icon: ICON.play, size: 28 * s });
    } }];
  };
  // two quick tabs under the title (portrait): Level (the goal, stars, villains) and Chicks (the helper chick, boosters)
  const tabs = (s, P) => ({ h: 52 * s, gap: 10 * s, draw: (x, y, w) => {
    const T = P.T, hasCh = T.open.length || lockedChicks().length, cur = G.itab === 'chicks' ? 'chicks' : 'level';
    ui.roundRect(x, y, w, 52 * s, 26 * s); ctx.fillStyle = 'rgba(24,13,5,0.62)'; ctx.fill(); ctx.lineWidth = 1.5 * s; ctx.strokeStyle = 'rgba(255,226,122,0.4)'; ctx.stroke();
    const sw = (w - 10 * s) / 2;
    [['level', 'Level', (c, X, Y, S) => pictoTarget(c, X, Y, S * 0.9)], ['chicks', hasCh ? 'Chicks' : 'Boosters', T.id ? (c, X, Y, S) => pictoPower(c, T.id, X, Y, S * 1.05, G.t) : null]].forEach(([id, lab, icon], i) => {
      const on = cur === id, bx = x + 5 * s + i * sw;
      ui.button('itab:' + id, lab, bx, y + 5 * s, sw, 42 * s, { kind: on ? 'gold' : 'tertiary', size: 19 * s, icon: icon || undefined });
      if (id === 'chicks' && T.need && !on) { // a first-timer still has to pick: a pulsing dot on the tab
        const pr = 9 * s * (save.calm ? 1 : 1 + 0.12 * Math.sin(G.t * 5)), dx = bx + sw - 10 * s, dy = y + 9 * s;
        ctx.beginPath(); ctx.arc(dx, dy, pr, 0, 7); ctx.fillStyle = '#e8402a'; ctx.fill(); ctx.lineWidth = 2 * s; ctx.strokeStyle = '#fff'; ctx.stroke();
        ui.text('!', dx, dy + 0.5 * s, { size: 13 * s, align: 'center', color: '#fff', noRecord: true });
      }
    });
  } });
  const s = u * clamp(A.w / (390 * u), 0.82, 1);
  const pad = 16 * u;
  const pg = G.ipage || (G.ipage = { y: 0, v: 0, max: 0, t: G.t, lid: null });
  if (pg.lid !== L.id + ':' + G.li) { pg.lid = L.id + ':' + G.li; pg.y = 0; pg.v = 0; G.itab = 'level'; }
  const k = ui.pop(G.screenT, 0.32);
  ctx.save();
  if (k !== 1) { ctx.translate(A.cx, A.cy); ctx.scale(k, k); ctx.translate(-A.cx, -A.cy); }
  // the coin balance, top right: tap it to open the shop
  const topH = 46 * s, cbw = Math.max(104 * s, ui.measure(String(save.wallet.coins), 19 * s) + 62 * s);
  ui.button('shop', String(save.wallet.coins), A.x1 - pad - cbw, A.y + 8 * u, cbw, topH - 4 * s, { kind: 'gold', icon: (c, x, y, sz) => drawCoin(c, x, y, sz * 0.56, G.t), size: 19 * s });
  const P = chicks(s, land ? Math.min(A.w * 0.5, 600 * s) : Math.min(A.w - 2 * pad, 520 * s));
  if (land) {
    const rw = Math.min(A.w * 0.5 - pad * 1.5, 600 * s), lw = Math.min(A.w - rw - pad * 3, 520 * s), lx = A.x + pad + (A.w - 3 * pad - lw - rw) / 2, rx = lx + lw + pad;
    const left = [...head(s), ...howCard(s, lw, 0, false, P.T.need)];
    const bot = [play(s, Math.min(rw, 380 * s), P.T.need), links(s)], hb = colH(bot, s);
    const y0 = A.y + topH + 10 * u, y1 = A.y1 - 10 * u;
    G.ipRect = { x: A.x, y: A.y + 6 * u, w: lx + lw + pad / 2 - A.x, h: y1 - A.y - 6 * u }; // the coin chip sits over the right column only
    scrollCol(left, pg, G.ipRect, lx, lw, s);
    // the right column scrolls on its own (a phone on its side is short), PLAY and Levels pinned under it
    const pr = G.ipageR || (G.ipageR = { y: 0, v: 0, max: 0, t: G.t, lid: null });
    if (pr.lid !== pg.lid) { pr.lid = pg.lid; pr.y = 0; pr.v = 0; }
    G.ipRectR = { x: rx - pad / 2, y: y0, w: A.x1 - (rx - pad / 2), h: y1 - hb - 6 * s - y0 };
    const anchors = G.ipAnchor; // the PLAY nudge scrolls the right column to the chick row
    scrollCol([...P.blocks, ...boost(s)], pr, G.ipRectR, rx, rw, s);
    G.ipAnchorR = G.ipAnchor; G.ipAnchor = anchors;
    let by = y1 - hb; for (const b of bot) { by += b.gap ?? 10 * s; b.draw(rx, by, rw); by += b.h; }
  } else {
    const iw = Math.min(A.w - 2 * pad, 520 * s), x0 = A.cx - iw / 2, lvTab = G.itab !== 'chicks';
    // 2026-11-20: on the Level tab PLAY sits inside the how-to card, right under the cartoon
    const bot = lvTab ? [{ ...links(s), gap: 0 }] : [play(s, iw, P.T.need), links(s)], hb = colH(bot, s) + 8 * s;
    // the title and the two tabs stay put; the tab's content scrolls under them
    let hy = A.y + topH - 2 * s;
    for (const b of [...head(s), tabs(s, P)]) { hy += b.gap ?? 10 * s; b.draw(x0, hy, iw); hy += b.h; }
    const y0 = hy + 4 * s, y1 = A.y1 - hb - 8 * u;
    G.ipRect = { x: A.x, y: y0, w: A.w, h: y1 - y0 };
    const body = !lvTab ? [...P.blocks, ...boost(s)] : [...howCard(s, iw, y1 - y0 - 34 * s, true, P.T.need)];
    if (body.length) body[0] = { ...body[0], gap: 6 * s };
    scrollCol(body, pg, G.ipRect, x0, iw, s, true);
    let by = y1 + 8 * u; for (const b of bot) { by += b.gap ?? 10 * s; b.draw(x0, by, iw); by += b.h; }
  }
  ctx.restore();
}
// the win streak on the level card: a flame with the count and the free boosters it brings to this level
function hotBadge(x, y, s) {
  const hb = G.li >= 0 ? DR.hotBoosts(save) : [];
  if (!hb.length) return;
  const n = `${DR.hotCount(save)} wins`, ih = 30 * s, nw = ui.measure(n, 16 * s), w = 12 * s + 24 * s + nw + 8 * s + hb.length * (ih + 2 * s) + 6 * s;
  y -= ih + 8 * s; // (y is the badge's bottom)
  const p = save.calm ? 0 : 0.5 + 0.5 * Math.sin(G.t * 3);
  ui.roundRect(x, y, w, ih + 8 * s, (ih + 8 * s) / 2); ctx.fillStyle = 'rgba(150,40,10,0.9)'; ctx.fill();
  ctx.lineWidth = 2 * s; ctx.strokeStyle = `rgba(255,${200 + 40 * p | 0},120,0.9)`; ctx.stroke();
  pictoFlame(ctx, x + 6 * s + 12 * s, y + 4 * s + ih / 2, 24 * s);
  ui.text(n, x + 32 * s, y + 4 * s + ih / 2, { size: 16 * s, color: '#fff', noRecord: true });
  hb.forEach((b, i) => drawBoosterIcon(ctx, b, x + 32 * s + nw + 8 * s + i * (ih + 2 * s) + ih / 2, y + 4 * s + ih / 2, ih * 0.92, G.t));
  ui.record({ x, y, w, h: ih + 8 * s }, 'intro:hot');
}
const tintHex = (c) => c.length === 7 ? ui.tint(c, 0.35) : c; // the accent, a step brighter for borders and glow

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
function bossPortrait(ctx, bossId, x, y, w, h, t) { if (bossId === 'blizzard') return drawGeckoCard(ctx, x, y, w, h, t, G.screenT - 0.15); drawBossCard(ctx, bossId, x, y, w, h, t, G.screenT - 0.15); }

// ---- the pause page (rebuilt 2026-11-19, mykee: "increase the size of the pause menu", "not properly aligned", "show the
// info right there"): a full page like the level page. The goal and clock with the sound toggles, one big Resume, six
// big tiles in an even 3 x 2 grid (Restart, Levels, Home / Shop, Settings, Practice), the hint, then every villain of
// this vault as a big card (what it does, how to beat it): the old "i" panel, now right here. It scrolls when long.
function pauseTiles(items, s, cols = 3) { // items: [id, label, icon, kind]; an even grid (3 across; 6 on a phone on its side)
  const gap = (cols > 3 ? 8 : 10) * s, th = (cols > 3 ? 54 : 64) * s, lh = 24 * s, rows = Math.ceil(items.length / cols);
  return { h: rows * (th + lh) + (rows - 1) * gap, gap: 14 * s, draw: (x, y, w) => {
    const tw = (w - gap * (cols - 1)) / cols;
    items.forEach(([id, label, icon, kind], i) => {
      const r = Math.floor(i / cols), c = i % cols, bx = x + c * (tw + gap), by = y + r * (th + lh + gap);
      ui.button(id, '', bx, by, tw, th, { kind, icon, iconS: 1.45, round: 18 * s });
      ui.text(label, bx + tw / 2, by + th + 12 * s, { size: (cols > 3 ? 14 : 16) * s, align: 'center', color: '#fff6e0', stroke: 'rgba(40,20,5,0.9)', maxW: tw, tag: 'pause:lbl:' + id });
    });
  } };
}
function drawPause() {
  ui.calm = save.calm;
  introBackdrop();
  const u = ui.u, A = ui.A, C = ui.C, sim = G.sim, st = sim.stats(), L = G.level;
  const s = u * clamp(A.w / (390 * u), 0.82, 1), pad = 16 * u, iw = Math.min(A.w - 2 * pad, 520 * s), x0 = A.cx - iw / 2;
  const pg = G.ppage || (G.ppage = { y: 0, v: 0, max: 0, t: G.t, lid: null });
  if (pg.lid !== G.scrSeq) { pg.lid = G.scrSeq; pg.y = 0; pg.v = 0; G.pauseKinds = sim.state === 'play' && G.li >= 0 ? villainKinds(L, sim).filter((k) => hasPortrait(k) || VILLAIN_INFO[k]).slice(0, 8) : []; }
  const kinds = G.pauseKinds || [];
  const k = ui.pop(G.screenT, 0.25);
  ctx.save();
  if (k !== 1) { ctx.translate(A.cx, A.cy); ctx.scale(k, k); ctx.translate(-A.cx, -A.cy); }
  const tb = portal.showMuteButton, wide = A.w > A.h * 1.15;
  const blocks = [
    { h: 46 * s, gap: 0, draw: (x, y, w) => ui.ribbon('Paused', x + w / 2, y, clamp(ui.measure('Paused', 28 * s) + 80 * s, 170 * s, w), 46 * s, { s, color: '#3a80ea', size: 28 * s, tag: 'pause:title' }) },
    { h: 30 * s, gap: 6 * s, draw: (x, y, w) => ui.text(G.li >= 0 ? `Level ${L.id} · ${L.name}` : L.name, x + w / 2, y + 15 * s, { size: 20 * s, align: 'center', maxW: w, color: '#fff', stroke: 'rgba(40,20,5,0.9)', tag: 'pause:name' }) },
    // the goal and the clock, and the sound and music toggles
    { h: 56 * s, gap: 12 * s, draw: (x, y, w) => {
      const bw = tb ? 2 * 48 * s + 8 * s : 0, gw = w - bw - (tb ? 10 * s : 0);
      ui.well(x, y, gw, 56 * s, { s, a: '#f3e2bd', b: '#fbf0d6' });
      const a = `${st.saved}/${st.target} home`, b = sim.timeLimit ? fmtTime(sim.timeLeft) : '', aw = 32 * s + ui.measure(a, 20 * s), bw2 = b ? 32 * s + ui.measure(b, 20 * s) : 0, gp = b ? 26 * s : 0;
      let gx = x + gw / 2 - (aw + gp + bw2) / 2;
      drawEggIcon(ctx, gx + 12 * s, y + 28 * s, 30 * s, 'alive'); ui.text(a, gx + 30 * s, y + 28 * s, { size: 20 * s, color: st.saved >= st.target ? C.good : C.ink, tag: 'pause:goal' });
      if (b) { gx += aw + gp; pictoClock(ctx, gx + 12 * s, y + 28 * s, 28 * s); ui.text(b, gx + 30 * s, y + 28 * s, { size: 20 * s, color: sim.timeLeft <= 10 ? C.bad : C.warn, tag: 'pause:time' }); }
      if (tb) {
        ui.button('sfx', '', x + w - bw, y + 4 * s, 48 * s, 48 * s, { kind: save.sfx ? 'tertiary' : 'off', icon: ICON.sound(save.sfx), iconS: 1.2, round: 14 * s });
        ui.button('music', '', x + w - 48 * s, y + 4 * s, 48 * s, 48 * s, { kind: save.music ? 'tertiary' : 'off', icon: ICON.note(save.music), iconS: 1.2, round: 14 * s });
      }
    } },
    { h: 66 * s, gap: 14 * s, draw: (x, y, w) => ui.button('resume', 'Resume', x, y, w, 66 * s, { kind: 'primary', shimmer: true, icon: ICON.play, size: 28 * s, round: 20 * s }) },
    pauseTiles([
      ['restart', 'Restart', ICON.retry, 'secondary'], ['levels', 'Levels', ICON.grid, 'secondary'], ['home', 'Home', ICON.home, 'secondary'],
      ['shop', 'Shop', (c, X, Y, S) => shopIcon(c, X, Y, S), 'gold'], ['settings', 'Settings', (c, X, Y, S) => settingsIcon(c, X, Y, S, '#fff4dc', (ui.skin && ui.skin.kinds && ui.skin.kinds.ad || {}).b || '#7c4fe0'), 'ad'], ['practice', 'Practice', (c, X, Y, S) => pictoTarget(c, X, Y, S * 0.95), 'orange'],
    ], s, wide ? 6 : 3),
    G.hint ? lineBlock('Hint…', 18 * s, { color: '#ffe27a', stroke: 'rgba(40,20,5,0.9)', tag: 'pause:hint', gap: 14 * s })
      : sim.state !== 'play' ? null : { h: 54 * s, gap: 14 * s, draw: (x, y, w) => ui.button('hint', 'Watch for a hint', x, y, w, 54 * s, { kind: 'ad', ad: true, size: 19 * s, round: 18 * s }) },
    ...(kinds.length ? [pageSection(kinds.length === 1 ? 'WHO HUNTS YOUR EGGS' : `WHO HUNTS YOUR EGGS (${kinds.length})`, s, 'pfoes'), ...kinds.map((kd, i) => foeCard(kd, i, s, iw))] : []),
  ].filter(Boolean);
  const land = A.w > A.h * 1.15 && kinds.length;
  if (land) { // a phone on its side: the controls on the left, the villains scroll on their own on the right
    const lw = Math.min((A.w - 3 * pad) * 0.5, 460 * s), rw = Math.min(A.w - 3 * pad - lw, 520 * s), lx = A.cx - (lw + rw + pad) / 2, rx = lx + lw + pad;
    const nf = 2 + kinds.length; // the section heading, then the villain cards
    G.ppRect = { x: A.x, y: A.y + 6 * u, w: rx - pad / 2 - A.x, h: A.h - 12 * u };
    pageScroll(blocks.slice(0, blocks.length - nf + 1), pg, G.ppRect, lx, lw, s);
    const pr = G.ppageR || (G.ppageR = { y: 0, v: 0, max: 0, t: G.t, lid: null });
    if (pr.lid !== pg.lid) { pr.lid = pg.lid; pr.y = 0; pr.v = 0; }
    G.ppRectR = { x: rx - pad / 2, y: A.y + 6 * u, w: A.x1 - (rx - pad / 2), h: A.h - 12 * u };
    pageScroll([pageSection(kinds.length === 1 ? 'WHO HUNTS YOUR EGGS' : `WHO HUNTS YOUR EGGS (${kinds.length})`, s, 'pfoes'), ...kinds.map((kd, i) => foeCard(kd, i, s, rw))], pr, G.ppRectR, rx, rw, s);
  } else {
    G.ppRect = { x: A.x, y: A.y + 6 * u, w: A.w, h: A.h - 12 * u }; G.ppRectR = null;
    pageScroll(blocks, pg, G.ppRect, x0, iw, s);
  }
  ctx.restore();
}

// the Settings and Shop icons follow the skin: a snowflake and a gift box in the winter outfits
function settingsIcon(c, x, y, sz, col, hole) {
  if (!(ui.skin && ui.skin.icons && ui.skin.icons.settings === 'snowflake')) return gearIcon(c, x, y, sz, col, hole);
  c.save(); c.translate(x, y); c.rotate(save.calm ? 0 : G.t * 0.4); c.strokeStyle = col; c.lineCap = 'round'; c.lineWidth = sz * 0.1;
  const R = sz * 0.44;
  c.beginPath();
  for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3, ca = Math.cos(a), sa = Math.sin(a); c.moveTo(0, 0); c.lineTo(ca * R, sa * R);
    for (const k of [0.55]) { const bx = ca * R * k, by = sa * R * k, b = R * 0.28; c.moveTo(bx, by); c.lineTo(bx + Math.cos(a + 0.8) * b, by + Math.sin(a + 0.8) * b); c.moveTo(bx, by); c.lineTo(bx + Math.cos(a - 0.8) * b, by + Math.sin(a - 0.8) * b); } }
  c.stroke(); c.restore();
}
function shopIcon(c, x, y, S) {
  if (!(ui.skin && ui.skin.icons && ui.skin.icons.shop === 'gift')) return drawCoin(c, x, y, S * 0.5, G.t);
  const w = S * 0.8, h = S * 0.6, x0 = x - w / 2, y0 = y - h / 2 + S * 0.12, lw = Math.max(1.5, S * 0.06);
  c.save(); c.lineJoin = 'round';
  const box = (bx, by, bw, bh) => { c.beginPath(); c.roundRect ? c.roundRect(bx, by, bw, bh, S * 0.06) : c.rect(bx, by, bw, bh); };
  box(x0, y0, w, h); c.fillStyle = '#e8402e'; c.fill(); c.lineWidth = lw; c.strokeStyle = '#5a110a'; c.stroke();
  box(x0 - S * 0.05, y0 - S * 0.16, w + S * 0.1, S * 0.2); c.fillStyle = '#ff6a50'; c.fill(); c.stroke();
  c.fillStyle = '#ffd24a'; c.fillRect(x - S * 0.07, y0 - S * 0.16, S * 0.14, h + S * 0.16); c.strokeRect(x - S * 0.07, y0 - S * 0.16, S * 0.14, h + S * 0.16);
  for (const d of [-1, 1]) { c.beginPath(); c.ellipse(x + d * S * 0.13, y0 - S * 0.24, S * 0.14, S * 0.08, d * 0.5, 0, Math.PI * 2); c.fillStyle = '#ffd24a'; c.fill(); c.stroke(); }
  c.restore();
}
// a gear (the Settings button)
function gearIcon(c, x, y, sz, col = '#6b3f17', hole = null) {
  c.save(); c.translate(x, y); c.fillStyle = col; c.beginPath();
  const R = sz * 0.42, r = sz * 0.3;
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, rr = i % 2 ? r : R; c.lineTo(Math.cos(a - 0.12) * rr, Math.sin(a - 0.12) * rr); c.lineTo(Math.cos(a + 0.12) * rr, Math.sin(a + 0.12) * rr); }
  c.closePath(); c.fill(); if (hole) c.fillStyle = hole; else c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(0, 0, sz * 0.13, 0, 7); c.fill(); c.restore();
}

// a row of square icon buttons with a label under each (pause card, settings toggles). items: [id, label, icon, kind]
function iconRow(items, s, tag, o = {}) {
  const sqMax = o.sq || 66;
  return { h: Math.min(sqMax, 66) * s + 26 * s, gap: o.gap ?? 4 * s, draw: (x, y, w) => {
    const n = items.length, gap = 8 * s, sq = Math.min(sqMax * s, (w - gap * (n - 1)) / n), x0 = x + (w - (sq * n + gap * (n - 1))) / 2;
    items.forEach(([id, label, icon, kind], i) => {
      const bx = x0 + i * (sq + gap), big = id === 'resume';
      ui.button(id, '', bx, y, sq, sq, { kind, icon, iconS: big ? 1.55 : 1.35, round: 16 * s, shimmer: big });
      ui.text(label, bx + sq / 2, y + sq + 13 * s, { size: 13 * s, align: 'center', color: ui.C.ink, maxW: sq + gap, tag: tag + ':lbl:' + id });
    });
  } };
}
// a small section heading on a card, with a rule either side
function sectionBlock(title, s) {
  return { h: 18 * s, gap: 12 * s, draw: (x, y, w) => {
    const tw = ui.measure(title.toUpperCase(), 11.5 * s), cx = x + w / 2, cy = y + 9 * s;
    ctx.fillStyle = 'rgba(122,80,40,0.28)';
    ctx.fillRect(x, cy - 0.75 * s, w / 2 - tw / 2 - 10 * s, 1.5 * s); ctx.fillRect(cx + tw / 2 + 10 * s, cy - 0.75 * s, w / 2 - tw / 2 - 10 * s, 1.5 * s);
    ui.text(title.toUpperCase(), cx, cy, { size: 11.5 * s, align: 'center', color: ui.C.ink2, tag: 'sec:' + title });
  } };
}
// a phone with buzz marks (the vibration toggle); struck through when off
const vibeIcon = (on) => (c, x, y, S) => {
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  const w = S * 0.36, h = S * 0.6;
  ui.roundRect(x - w / 2, y - h / 2, w, h, S * 0.07); c.fillStyle = '#fff'; c.fill();
  c.fillStyle = 'rgba(40,60,110,0.55)'; c.fillRect(x - w / 2 + S * 0.05, y - h / 2 + S * 0.07, w - S * 0.1, h - S * 0.18);
  c.strokeStyle = '#fff'; c.lineWidth = S * 0.06;
  for (const d of [-1, 1]) { c.beginPath(); c.moveTo(x + d * S * 0.3, y - S * 0.16); c.lineTo(x + d * S * 0.38, y - S * 0.05); c.lineTo(x + d * S * 0.3, y + S * 0.05); c.lineTo(x + d * S * 0.38, y + S * 0.16); c.stroke(); }
  if (!on) { c.strokeStyle = '#e8402e'; c.lineWidth = S * 0.09; c.beginPath(); c.moveTo(x - S * 0.38, y - S * 0.38); c.lineTo(x + S * 0.38, y + S * 0.38); c.stroke(); }
  c.restore();
};

// Settings (2026-11-15, mykee): sound, music, ring speed, difficulty, reduced motion, restore purchases. Opens over the
// home or the pause card; only its own buttons take taps while it shows.
function drawSettings() {
  ui.buttons.length = 0; ui.rects.length = 0;
  dim(0.55);
  // 2026-11-19 (mykee): grouped like a real game's options: Display (graphics quality, frame rate, calm motion),
  // Gameplay (ring speed, difficulty), Sound (sound, music, vibration). One tab shows at a time, so the card fits a
  // 360x640 phone; the tabs, Restore purchases, Done and the version stay put.
  const tab = SET_TABS.some((t) => t[0] === G.setTab) ? G.setTab : 'display';
  stackCard('Settings', (s) => {
    const C = ui.C, B = [];
    B.push({ h: 44 * s, gap: 4 * s, draw: (x, y, w) => segRow('stab:', SET_TABS, tab, x, y, w, 44 * s, s) });
    if (tab === 'display') {
      B.push(sectionBlock('Graphics', s));
      B.push({ h: 42 * s, gap: 6 * s, draw: (x, y, w) => segRow('gfx:', [['auto', 'Auto'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']], save.gfx, x, y, w, 42 * s, s) });
      const gl = save.gfx === 'auto' ? `Auto picked ${TIER_NAME[PERF.tier]} for this phone` : save.gfx === 'high' ? 'Sharpest picture, every effect' : save.gfx === 'medium' ? 'Softer picture, fewer light effects' : 'Smoothest on older phones';
      B.push(lineBlock(gl, 13 * s, { color: C.ink2, tag: 'set:gfxhint', gap: 4 * s }));
      B.push(sectionBlock('Frame rate', s));
      B.push({ h: 42 * s, gap: 6 * s, draw: (x, y, w) => segRow('fps:', [['auto', 'Auto'], [30, '30 fps'], [60, '60 fps']], save.fps, x, y, w, 42 * s, s) });
      B.push(lineBlock(save.fps === 30 ? 'Saves battery, keeps the phone cool' : save.fps === 60 ? 'Smoothest motion, uses more battery' : `Now ${PERF.fpsCap} fps`, 13 * s, { color: C.ink2, tag: 'set:fpshint', gap: 4 * s }));
      B.push({ h: 42 * s, gap: 12 * s, draw: (x, y, w) => ui.button('calm', save.calm ? 'Calm motion: on' : 'Calm motion: off', x + w * 0.1, y, w * 0.8, 42 * s, { kind: 'tertiary', icon: save.calm ? ICON.check : null, size: 14.5 * s }) });
      B.push(lineBlock('Calm motion: no screen shake or flashes', 13 * s, { color: C.ink2, tag: 'set:calmhint', gap: 4 * s }));
      B.push({ h: 40 * s, gap: 10 * s, draw: (x, y, w) => ui.button('set:fpsshow', save.showFps ? 'Show frame rate: on' : 'Show frame rate: off', x + w * 0.1, y, w * 0.8, 40 * s, { kind: 'tertiary', icon: save.showFps ? ICON.check : null, size: 14 * s }) });
    } else if (tab === 'gameplay') {
      const sp = ringSpeed(), k = RING_SPEEDS.indexOf(sp);
      B.push(sectionBlock('Ring speed', s));
      B.push(lineBlock(`${sp === 1 ? 'Normal' : sp < 1 ? 'Slower' : 'Faster'} (${Math.round(sp * 100)}%)`, 17 * s, { color: C.ink, tag: 'set:rslabel', gap: 6 * s }));
      B.push({ h: 46 * s, gap: 6 * s, draw: (x, y, w) => { // - [nine steps] +
        const bw = 46 * s, n = RING_SPEEDS.length, tx = x + bw + 8 * s, tw = w - 2 * bw - 16 * s, cw = tw / n;
        ui.button('rs:-', '', x, y, bw, 46 * s, { kind: k > 0 ? 'secondary' : 'off', disabled: k <= 0, icon: ICON.left, iconS: 1.2 });
        ui.button('rs:+', '', x + w - bw, y, bw, 46 * s, { kind: k < n - 1 ? 'secondary' : 'off', disabled: k >= n - 1, icon: ICON.right, iconS: 1.2 });
        ui.well(tx, y + 8 * s, tw, 30 * s, { s });
        for (let i = 0; i < n; i++) {
          const cx = tx + cw * (i + 0.5), on = i <= k, hgt = (10 + i * 2.2) * s;
          ui.roundRect(cx - cw * 0.3, y + 23 * s - hgt / 2, cw * 0.6, hgt, 3 * s);
          ctx.fillStyle = on ? (i === 2 ? '#3eb42d' : i < 2 ? '#3a80ea' : '#f3781c') : 'rgba(110,80,50,0.25)'; ctx.fill();
          ui.buttons.push({ id: 'rs:' + i, x: tx + cw * i, y, w: cw, h: 46 * s });
        }
        ui.record({ x: tx, y: y + 8 * s, w: tw, h: 30 * s }, 'set:rsbar');
      } });
      B.push(lineBlock('How fast a ring follows your finger', 13 * s, { color: C.ink2, tag: 'set:rshint', gap: 2 * s }));
      B.push(sectionBlock('Difficulty', s));
      B.push({ h: 42 * s, gap: 6 * s, draw: (x, y, w) => modeRow(x, y, w, 42 * s, s) });
      B.push(lineBlock('Easy: slower villains, more time', 13 * s, { color: C.ink2, tag: 'set:modehint', gap: 4 * s }));
    } else {
      const tog = [];
      if (portal.showMuteButton) tog.push(['sfx', 'Sound', ICON.sound(save.sfx), save.sfx], ['music', 'Music', ICON.note(save.music), save.music]);
      if (__APP__ || (typeof navigator !== 'undefined' && navigator.vibrate)) tog.push(['vibe', 'Vibration', vibeIcon(save.vibe !== false), save.vibe !== false]);
      B.push(sectionBlock('Sound and feel', s));
      if (tog.length) B.push(iconRow(tog.map(([id, label, icon, on]) => [id, label + (on ? '' : ' off'), icon, on ? 'secondary' : 'off']), s, 'set'));
      else B.push(lineBlock('Sound follows the game site\u2019s own volume', 14 * s, { color: C.ink2, tag: 'set:portalsnd', gap: 8 * s }));
    }
    if (ads.canBuyPremium || ads.premium) B.push({ h: 40 * s, gap: 14 * s, draw: (x, y, w) => ui.button('set:restore', 'Restore purchases', x + w * 0.15, y, w * 0.7, 40 * s, { kind: 'tertiary', size: 14.5 * s }) });
    B.push({ h: 52 * s, gap: 12 * s, draw: (x, y, w) => ui.button('set:close', 'Done', x, y, w, 52 * s, { kind: 'primary', icon: ICON.check, size: 20 * s }) });
    B.push(lineBlock('Eggscape ' + __VERSION__, 11.5 * s, { color: C.ink2, tag: 'set:version', gap: 6 * s }));
    return B;
  }, { ribbon: '#7a48e8' });
}
const SET_TABS = [['display', 'Display'], ['gameplay', 'Gameplay'], ['sound', 'Sound']];
// a segmented control on a cream card: a recessed track, the chosen option a raised green key (like Easy/Medium/Hard)
function segRow(pre, opts, cur, x, y, w, h, s) {
  const p = 3 * s, bw = (w - 2 * p) / opts.length;
  ui.well(x, y, w, h, { r: h / 2, s });
  opts.forEach(([v, label], i) => {
    const on = cur === v, size = Math.min(15.5 * s, h * 0.4, (bw - 8 * s) / Math.max(3, label.length * 0.56));
    const hit = { x: x + p + i * bw, y, w: bw, h };
    if (on) ui.button(pre + v, label, x + p + i * bw, y + p, bw, h - 2 * p - 1 * s, { kind: 'primary', round: h / 2, size, hit });
    else ui.button(pre + v, label, x + p + i * bw, y + p, bw, h - 2 * p, { ghost: true, textColor: ui.C.ink2, size, hit });
  });
}

// "Who's in this vault" (the "i" panel): the pause card's kit (cream card, wooden frame, ribbon), one row per villain,
// boss or hazard of this level: a live portrait drawn by its own renderer, its name, what it does, how to beat it (a boss
// also lists the attacks this level uses, each with its counter). The list scrolls (drag, wheel, arrows) between the
// ribbon and a fixed footer button; rows cut by the list edge are clipped and record nothing for the overlap check.
// The world stands still behind it (screen 'info'); closing goes back to play or to the pause card.
function infoRows(s, iw) {
  const C = ui.C, P = Math.round(64 * s), gap = 12 * s, tx = P + gap, tw = iw - tx;
  const nameS = 17.5 * s, lineS = 14 * s, atkS = 13.2 * s, lh = 1.3;
  return G.infoKinds.map((kind, ri) => {
    const I = VILLAIN_INFO[kind] || { group: 'creature', name: kind, does: '', beat: '' };
    const items = []; // { str, size, color, x, y, pre?, preColor? } laid out from the row's top-left
    let y = 2 * s;
    // icon-first: a warning sign for what it does, a check for how to beat it; one short line each (owner: players come to play, not to read)
    const add = (str, size, color, ico, indent = 0) => {
      const iw2 = ico ? size * 1.5 : 0, lines = wrapText(str, size, tw - indent - iw2).slice(0, 2);
      lines.forEach((l, i) => {
        items.push({ str: l, ico: i === 0 ? ico : null, size, color, x: tx + (i ? 0 : 0) + iw2, y: y + size * lh / 2 });
        y += size * lh;
      });
    };
    const tag = I.group === 'boss' ? 'BOSS' : I.group === 'hazard' ? 'HAZARD' : '';
    items.push({ str: I.name, size: nameS, color: I.group === 'boss' ? C.bad : C.ink, x: tx, y: y + nameS * 0.6, name: true, tag });
    y += nameS * 1.25;
    add(shortTip(I.does), lineS, C.ink, 'warn');
    if (I.group === 'boss') {
      const atks = bossAttacks(G.level).filter((a) => I.attacks && I.attacks[a]);
      if (atks.length) add(atks.map((a) => ATTACK_NAME[a] || ATTACK_EXTRA[a] || a).join(' \u00b7 '), atkS, C.ink2, 'bolt');
      const P3 = (G.level.bossFight && G.level.bossFight.phases) || [];
      if (P3.length > 1) add(`${P3.length} phases`, atkS, C.ink2, 'bar');
    }
    add(shortTip(I.beat), lineS, C.ink, 'ok');
    const h = Math.max(P, y) + 14 * s;
    return { kind, I, items, h, P, ri };
  });
}
// the boss bar's "PHASE 1/3" in plain words (mykee 2026-11-16): what a phase is and when the next one starts
function phaseWords(level) {
  const P = (level.bossFight && level.bossFight.phases) || [];
  if (P.length < 2) return '';
  const ev = (BOSS_MODE[save.mode] || BOSS_MODE.medium).every, egg = (n) => n + (n === 1 ? ' egg' : ' eggs');
  const when = P.slice(1).map((p, i) => {
    const a = p.at || {}, bits = [];
    if (a.saved != null) bits.push('when ' + egg(a.saved) + ' ' + (a.saved === 1 ? 'is' : 'are') + ' home');
    if (a.t) bits.push('after ' + Math.round(a.t * ev) + ' seconds');
    return bits.length ? 'phase ' + (i + 2) + ' starts ' + bits.join(' or ') : '';
  }).filter(Boolean);
  const head = `The bar at the top splits the fight into ${P.length} phases. In each new phase the boss attacks faster and with new moves.`;
  return when.length ? head + ' ' + when.join('; ').replace(/^p/, 'P') + '.' : head;
}
function drawInfo() {
  dim(0.62);
  const u = ui.u, s = u, C = ui.C;
  ui.calm = save.calm;
  const S = G.iscroll, dt = Math.min(0.1, Math.max(0, G.t - (S.t || G.t))); S.t = G.t;
  const A = ui.A, w = Math.min(A.w - 24 * u, 470 * u), x = A.cx - w / 2, fw = 7 * s, pad = 14 * s, iw = w - 2 * fw - 2 * pad;
  const rows = infoRows(s, iw), title = 'Who\u2019s in this vault';
  const footH = 50 * s, head = CARD_HEAD * s, listH = rows.length ? rows.reduce((a, r) => a + r.h, 0) + 4 * s : 64 * s;
  const top = A.y + 12 * u + 8 * s, maxH = A.y1 - top - 12 * u - 5 * s;
  const h = Math.min(maxH, head + listH + 12 * s + footH + 16 * s), y = Math.max(top, A.cy - h / 2);
  G.infoCard = { x, y, w, h };
  ctx.save();
  const k = ui.pop(G.screenT, 0.32);
  if (k !== 1) { ctx.translate(x + w / 2, y + h / 2); ctx.scale(k, k); ctx.translate(-(x + w / 2), -(y + h / 2)); }
  ui.frame(x, y, w, h, { s, r: 24 * s });
  const rw = clamp(ui.measure(title, 24 * s) + 56 * s, w * 0.6, w - 14 * s);
  ui.ribbon(title, x + w / 2, y - 8 * s, rw, 40 * s, { s, color: '#7a3fb8', size: 24 * s, tag: 'info:title' });
  // the list viewport, between the ribbon and the footer
  const vx = x + fw + pad, vy = y + head - 4 * s, vw = iw, vh = Math.max(20 * s, y + h - fw - 12 * s - footH - 10 * s - vy);
  S.max = Math.max(0, listH - vh);
  if (!G.pdrag || !G.pdrag.moved) { if (Math.abs(S.v) > 8) { S.y += S.v * dt; S.v *= Math.exp(-SCROLL_DRAG * dt); } else S.v = 0; }
  const cl = clamp(S.y, 0, S.max); if (cl !== S.y) S.v = 0; S.y = cl;
  ctx.save(); ctx.beginPath(); ctx.rect(x + fw, vy, w - 2 * fw, vh); ctx.clip();
  if (!rows.length) ui.text('Nothing hunts your eggs here: just you, the rings and gravity.', x + w / 2, vy + 30 * s, { size: 14.5 * s, align: 'center', maxW: iw, color: C.ink2, tag: 'info:empty' });
  let ry = vy + 4 * s - S.y;
  for (const R of rows) {
    if (ry + R.h > vy - 2 && ry < vy + vh + 2) {
      if (R.ri) { ctx.fillStyle = 'rgba(122,78,30,0.22)'; ctx.fillRect(vx, ry - 1 * s, vw, 1.5 * s); }
      const py = ry + 6 * s, bg = PORTRAIT_BG[R.I.group] || PORTRAIT_BG.creature;
      ui.well(vx, py, R.P, R.P, { s, r: 12 * s, a: bg[0], b: bg[1], border: 'rgba(40,24,10,0.7)', shade: 'rgba(0,0,10,0.45)',
        paint: () => drawVillainPortrait(ctx, R.kind, vx + R.P / 2, py + R.P / 2, R.P, G.t) });
      const grp = 'info:r' + R.ri;
      for (const it of R.items) {
        const yy = py + it.y, inside = yy - it.size * 0.6 >= vy && yy + it.size * 0.6 <= vy + vh;
        let xx = vx + it.x;
        if (it.ico) { // the trait icon sits in the margin left of the text
          const ix = xx - it.size * 0.85, isz = it.size * 1.25;
          if (it.ico === 'warn') pictoWarn(ctx, ix, yy, isz); else if (it.ico === 'ok') pictoCheck(ctx, ix, yy, isz); else if (it.ico === 'bolt') pictoPower(ctx, 'thunder', ix, yy, isz, G.t); else pictoClock(ctx, ix, yy, isz * 0.9);
        }
        const r1 = ui.text(it.str, xx, yy, { size: it.size, color: it.color, maxW: vx + vw - xx, tag: grp + ':' + it.str.slice(0, 18), group: grp, noRecord: !inside });
        if (it.tag) { // a small group tag after the name when it fits
          const ts = 10.5 * s, tw2 = ui.measure(it.tag, ts) + 10 * s, tx2 = r1.x + r1.w + 8 * s;
          if (tx2 + tw2 <= vx + vw) {
            ui.roundRect(tx2, yy - ts * 0.75, tw2, ts * 1.5, ts * 0.75); ctx.fillStyle = it.tag === 'BOSS' ? '#c9342c' : '#6a6f7c'; ctx.fill();
            ui.text(it.tag, tx2 + tw2 / 2, yy, { size: ts, align: 'center', color: '#fff', tag: grp + ':tag', group: grp, noRecord: !inside });
          }
        }
      }
    }
    ry += R.h;
  }
  ctx.restore();
  // soft edges where the list scrolls under the header and the footer
  if (S.max > 0) {
    const fade = (yy, up) => { // the card's cream at that height (ui.frame: #fffaea at the top to #f6e2ba at the bottom)
      const f = clamp((yy - y) / h, 0, 1), c = [255 - 9 * f, 250 - 24 * f, 234 - 48 * f].map(Math.round).join(',');
      const g = ctx.createLinearGradient(0, yy, 0, yy + (up ? -10 : 10) * s); g.addColorStop(0, `rgba(${c},0.95)`); g.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = g; ctx.fillRect(x + fw, up ? yy - 10 * s : yy, w - 2 * fw, 10 * s); };
    if (S.y > 1) fade(vy, false);
    if (S.y < S.max - 1) fade(vy + vh, true);
    const th = Math.max(26 * s, vh * vh / listH), ty = vy + (S.y / S.max) * (vh - th);
    ui.roundRect(x + w - fw - 6 * s, ty, 3.5 * s, th, 1.75 * s); ctx.fillStyle = 'rgba(122,78,30,0.45)'; ctx.fill();
  }
  const fy = y + h - fw - 12 * s - footH;
  ui.button('info:close', G.infoFrom === 'pause' ? 'Back' : 'Back to the vault', x + fw + pad, fy, iw, footH, { kind: 'primary', icon: G.infoFrom === 'pause' ? ICON.left : ICON.play, size: 19 * s });
  ctx.restore();
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
  const u = ui.u, A = ui.A, cw = Math.min(A.w - 32 * u, 420 * u);
  if (!(A.w > A.h * 1.15 && A.w - cw - 48 * u >= 200 * u)) return null;
  const sw = Math.min(A.w - cw - 48 * u, Math.max(cw, 300 * u)), left = A.x + (A.w - (sw + 16 * u + cw)) / 2;
  return { x: left, w: sw, cardO: { cx: left + sw + 16 * u + cw / 2, maxW: cw } };
}
// her side stage: she stands on the card's bottom line, as tall as the room allows
function sideStage(sd, card) {
  const u = ui.u, top = Math.max(G.hudBottom, ui.A.y) + 6 * u, box = { x: sd.x, y: top, w: sd.w, h: card.y + card.h - 10 * u - top };
  return { box, henH: Math.min(box.w * 0.48, box.h * 0.6) };
}
// the show's layout: the hen big in the middle, room above her for her biggest jump, the stars, the title below
function bigStage(side) {
  const u = ui.u, A = ui.A, top = Math.max(G.hudBottom, A.y) + 6 * u, avail = A.y1 - top, band = Math.max(40 * u, avail * 0.1);
  if (side) { // landscape: she stands left of centre, the stars beside her at chest height
    const hh = Math.min(A.h * 0.34, (avail - band) / 1.45, A.w * 0.22), y = top + (avail - band - hh * 1.45) / 2;
    const box = { x: A.x, y, w: A.w * 0.8, h: hh * 1.45 }, R = Math.min(A.w * 0.05, hh * 0.2);
    const sx = A.x + A.w * 0.4 + hh * 0.62 + R * 2.9;
    return { box, henH: hh, R, stars: [0, 1, 2].map((k) => ({ x: sx + (k - 1) * R * 2.6, y: y + hh * 0.75 - (k === 1 ? R * 0.35 : 0) })), titleY: y + hh * 1.45 + band * 0.5, titleX: A.x + A.w * 0.4, full: { x: 0, y: top, w: ui.w, h: avail } };
  }
  // 2026-11-15: she was a full-screen close-up ("hen just comes up to the screen"): now a stage-sized figure with room around her
  const R = Math.min(A.w * 0.085, avail * 0.065), hh = Math.min(A.h * 0.3, A.w * 0.5, (avail - 2.8 * R - band) / 1.5); // wings spread she is ~1.2x as wide as tall
  const y0 = top + (avail - (2.8 * R + 1.5 * hh + band)) / 2, by = y0 + 2.8 * R;
  return { box: { x: A.x, y: by, w: A.w, h: 1.5 * hh }, henH: hh, R, stars: [0, 1, 2].map((k) => ({ x: A.cx + (k - 1) * R * 2.7, y: y0 + 1.5 * R - (k === 1 ? R * 0.35 : 0) })), titleY: by + 1.5 * hh + band * 0.45, titleX: A.cx, full: { x: 0, y: top, w: ui.w, h: avail } };
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

// 2026-11-19 (mykee: "the celebration page is not clear enough... too congested... should be big across the whole page,
// feathers glowing; stars at the top, the hen, then what they achieved, the time, what they didn't achieve; Retry on the
// left, Next on the right"): the win is a full page. No HUD; the board sinks under a deep shade with turning rays and
// drifting feathers; the card takes the whole height: stars on top, the hen, then each star's goal ticked or crossed in
// words (why it is 1 or 2 stars), the time, coins and score.
function drawWin() {
  const hb = G.hudBottom;
  G.hudBottom = ui.A.y; // the page starts at the top of the safe area
  try { drawWinPage(); } finally { G.hudBottom = hb; }
}
// feathers and glints drifting down the whole page (fewer on Low graphics, still under reduced motion)
function winFeathers(alpha) {
  const n = PERF.low ? 7 : 16, t = save.calm ? 0 : G.t, u = ui.u;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const h1 = ((i * 7919) % 101) / 101, h2 = ((i * 4271) % 97) / 97, sp = 26 + 30 * h2, sz = (9 + 7 * h1) * u;
    const y = ((t * sp * u + h2 * ui.h * 1.3) % (ui.h + 60 * u)) - 30 * u, x = h1 * ui.w + Math.sin(t * 0.9 + i * 1.7) * 26 * u;
    ctx.save(); ctx.globalAlpha = alpha * (0.55 + 0.35 * h1); ctx.translate(x, y); ctx.rotate(Math.sin(t * 1.3 + i) * 0.7 + h2 * 2);
    if (i % 3 === 2) { // a glint: a soft four-point star
      const g = sz * 0.7; ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.moveTo(0, -g); ctx.quadraticCurveTo(0, 0, g, 0); ctx.quadraticCurveTo(0, 0, 0, g); ctx.quadraticCurveTo(0, 0, -g, 0); ctx.quadraticCurveTo(0, 0, 0, -g); ctx.fill();
    } else { // a feather: a cream vane with a quill
      ctx.fillStyle = i % 2 ? '#fff8e8' : '#ffe9c4'; ctx.beginPath(); ctx.ellipse(0, 0, sz * 0.32, sz, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(160,110,60,0.55)'; ctx.lineWidth = Math.max(1, sz * 0.07); ctx.beginPath(); ctx.moveTo(0, -sz * 0.9); ctx.lineTo(0, sz * 1.25); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}
function drawWinPage() {
  const r = G.result, R0 = routine(r.cheer), u = ui.u, k = winIn(r), e = k * k * (3 - 2 * k), inCard = k >= 1;
  const C = ui.C;
  if (!G.frzActive) { dim(0.62 + 0.18 * e); if (k >= 1 && r.t > WIN_SHOW + WIN_IN + 0.9) captureBack(); } // the board sinks under the page as the card comes; once still, it is kept
  { // rays over the whole page, then the drifting feathers (still under reduced motion)
    const A = ui.A;
    ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * e;
    sunburst(A.cx, A.y + A.h * 0.36, Math.max(ui.w, ui.h) * 0.85, 'rgba(255,226,140,0.07)', 16);
    const g = ctx.createRadialGradient(A.cx, A.y + A.h * 0.36, 0, A.cx, A.y + A.h * 0.36, Math.max(ui.w, ui.h) * 0.6);
    g.addColorStop(0, 'rgba(255,214,120,0.22)'); g.addColorStop(1, 'rgba(255,214,120,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, ui.w, ui.h);
    ctx.restore();
    winFeathers(0.35 + 0.5 * e);
  }
  const sd = cardSide(), side = !!sd, cardO = sd ? sd.cardO : {};
  const pw = routinePower(r.stars), calm = save.calm, seed = G.level.id || 0;
  // the stage takes the room the rest of the card leaves (a tall phone: the full 184 units; a squat screen: less)
  const A = ui.A, room = (A.y1 - Math.max(G.hudBottom, A.y) - 30 * u) / u - 650, stH = clamp(room, 120, 200);
  // a squat screen with no room beside the card either (600x600): she shares the star row, left of the stars
  const compact = !side && room < 50, rowH = compact ? 100 : 58; // only a really squat screen (600x600) puts her beside the stars
  const title = G.level.boss && G.li >= 0 ? 'Boss beaten!' : r.stars === 3 ? 'Perfect clutch!' : r.stars === 2 ? 'Great job!' : 'Vault cracked!';
  const BIG = bigStage(side);
  // confetti fired during the show keeps the show's geometry (full screen), so it does not jump when she flies to the card
  const fxBig = { cx: BIG.box.x + BIG.box.w / 2, gy: BIG.box.y + BIG.box.h - BIG.henH * 0.05, S: BIG.henH / 100, clip: BIG.full, until: WIN_SHOW + WIN_IN };
  const T = {}; // where her stage and the stars sit on the card: the targets of her flight
  const cnt = r.total ? clamp(r.shownTotal / r.total, 0, 1) : 1; // the coins count up with the score
  const build = (s) => {
    const B = [];
    const starRow = { h: (compact ? rowH : 74) * s, gap: 0,
      at: (x, y, w) => {
        let mx = x + w / 2, my = y;
        if (compact) { T.box = { x, y, w: w * 0.36, h: rowH * s }; T.henH = 68 * s; T.clip = { x: 0, y: G.hudBottom, w: ui.w, h: y + rowH * s - G.hudBottom }; mx = x + w * 0.36 + (w * 0.64) / 2; my = y + (rowH - 58) * s * 0.6; }
        const R = compact ? 25 * s : 31 * s, sp = compact ? 66 * s : 80 * s;
        T.stars = [0, 1, 2].map((q) => ({ x: mx + (q - 1) * sp, y: my + R + 6 * s - (q === 1 ? 7 * s : 0) })); T.R = R; T.row = { x: mx - sp - R, y: my, w: 2 * (sp + R), h: 2 * R + 10 * s };
      },
      draw: () => {
        if (inCard) {
          if (compact) drawCelebration(ctx, r.cheer, r.t, T.box, { pw, calm, henH: T.henH, seed, clip: T.clip, fxBig });
          T.stars.forEach((p, q) => drawWinStar(r, R0, q, p.x, p.y, T.R, calm));
        } else T.stars.forEach((p) => drawStar(ctx, p.x, p.y, T.R, false, 1, true)); // the sockets wait on the card for the flying stars
        if (compact) ui.record(T.box, 'win:hen');
        ui.record(T.row, 'win:stars');
      } };
    B.push(starRow); // the stars on top
    if (!side && !compact) B.push({ h: stH * s, gap: 6 * s,
      at: (x, y, w) => { T.box = { x, y, w, h: stH * s }; T.henH = 0.685 * stH * s; T.clip = { x: 0, y: G.hudBottom, w: ui.w, h: y + stH * s - G.hudBottom }; },
      draw: () => { henStage(T.box, s, true); if (inCard) drawCelebration(ctx, r.cheer, r.t, T.box, { pw, calm, henH: T.henH, seed, clip: T.clip, fxBig }); ui.record(T.box, 'win:hen'); } });
    // how you did: each star's goal, ticked or crossed, with what happened (why it is 1 or 2 stars)
    const broken = r.broken ?? (r.stars < 2 ? 1 : 0), cracked = r.cracked ?? 0, egg = (n) => n + (n === 1 ? ' egg' : ' eggs');
    const goals = [
      [r.target === r.eggs ? `All ${r.eggs} eggs home` : `${r.target} of ${r.eggs} eggs home`, r.stars >= 1, `${r.saved} home`],
      ['Lose no eggs', r.stars >= 2, broken ? `${egg(broken)} lost` : 'None lost'],
      ['No cracked eggs', r.stars >= 3, cracked ? `${egg(cracked)} cracked` : r.stars >= 3 ? 'No cracks' : broken ? 'Eggs were lost' : 'An egg cracked'],
    ];
    const gh = 40 * s, GH = 30 * s + 3 * gh + 6 * s;
    B.push({ h: GH, gap: 10 * s, draw: (x, y, w) => {
      ui.well(x, y, w, GH, { s, a: '#f3e2bd', b: '#fbf0d6' });
      ui.text('HOW YOU DID', x + w / 2, y + 16 * s, { size: 14 * s, align: 'center', color: C.ink2, tag: 'win:howhead' });
      const sr = 7.5 * s, gx = x + 12 * s;
      goals.forEach(([txt, ok, res], i) => {
        const ry = y + 30 * s + i * gh + gh / 2;
        if (i) { ctx.fillStyle = 'rgba(122,80,40,0.16)'; ctx.fillRect(x + 10 * s, ry - gh / 2, w - 20 * s, 1.2 * s); }
        for (let j = 0; j < 3; j++) drawStar(ctx, gx + sr + j * sr * 2.05, ry, sr, j <= i && ok);
        const ix = x + w - 22 * s;
        (ok ? pictoCheck : pictoCross)(ctx, ix, ry, 24 * s);
        const rw = ui.measure(res, 14.5 * s), tx = gx + sr * 6.2 + 8 * s, rx = ix - 18 * s;
        ui.text(res, rx, ry, { size: 14.5 * s, align: 'right', color: ok ? '#2d7a1c' : '#b3301c', maxW: w * 0.36, tag: 'win:res' + i });
        ui.text(txt, tx, ry, { size: 16 * s, color: ok ? C.ink : 'rgba(80,50,25,0.75)', maxW: rx - Math.min(rw, w * 0.36) - 10 * s - tx, tag: 'win:goal' + i });
      });
    } });
    // the numbers, each with its name: time, coins, egg points, time bonus (+ streak, bonus goal)
    const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    const cells = [];
    if (r.used != null) cells.push(['clock', 'Your time', mmss(r.used), C.ink]);
    cells.push(['coin', 'Coins', '+' + Math.round((r.coins || 0) * cnt), '#a85f00']);
    cells.push(['egg', 'Egg points', String(r.eggScore), C.ink]);
    if (r.timeBonus) cells.push(['gem', 'Time bonus', '+' + r.timeBonus, C.ink]);
    if (r.streakMult > 1) cells.push(['flame', 'Star streak', 'x' + r.streakMult, C.warn]);
    if (r.hot >= 2) cells.push(['flame', 'Wins in a row', String(r.hot), C.warn]);
    if (r.hasBonus) cells.push(['target', 'Bonus goal', r.bonus ? 'Done' : 'Missed', r.bonus ? C.good : C.bad]);
    const ch = 48 * s, nr = Math.ceil(cells.length / 2), CH = nr * ch + 10 * s;
    B.push({ h: CH, gap: 8 * s, draw: (x, y, w) => {
      ui.well(x, y, w, CH, { s });
      cells.forEach(([k2, lab, v, col], i) => {
        const cx = x + (i % 2) * w / 2, cy = y + 5 * s + ch * Math.floor(i / 2), ix = cx + 24 * s, iy = cy + ch / 2;
        if (k2 === 'egg') drawEggIcon(ctx, ix, iy, 26 * s, 'saved'); else if (k2 === 'gem') pictoGem(ctx, ix, iy, 26 * s); else if (k2 === 'clock') pictoClock(ctx, ix, iy, 26 * s);
        else if (k2 === 'flame') pictoFlame(ctx, ix, iy, 28 * s); else if (k2 === 'target') pictoTarget(ctx, ix, iy, 26 * s); else drawCoin(ctx, ix, iy, 12 * s, G.t);
        ui.text(lab, ix + 20 * s, iy - 10 * s, { size: 12.5 * s, color: C.ink2, maxW: w / 2 - 50 * s, tag: 'win:l' + k2 });
        ui.text(v, ix + 20 * s, iy + 9 * s, { size: 19 * s, color: col, maxW: w / 2 - 50 * s, tag: 'win:v' + k2 });
      });
    } });
    B.push({ h: 52 * s, gap: 8 * s, draw: (x, y, w) => {
      ui.text('SCORE', x + w / 2, y + 7 * s, { size: 13 * s, align: 'center', color: '#ffe9b0', stroke: 'rgba(60,30,8,0.6)', tag: 'win:scorelab' });
      ui.num(String(r.shownTotal), x + w / 2, y + 32 * s, { size: 36 * s, align: 'center', maxW: w, tag: 'win:total' });
    } });
    if (G.li >= 0 && G.level.boss && E.bossTreasure(G.level.id) && !E.treasureOpened(save.wallet, G.level.id)) // the boss's treasure is waiting
      B.push(lineBlock('A boss treasure waits for you on the map!', 15 * s, { color: '#b86a00', tag: 'win:treasure', gap: 4 * s }));
    if (r.gift) B.push({ h: 64 * s, gap: 6 * s, draw: (x, y, w) => { // the Director's gift: an egg skin to wear for the next levels
      if (!inCard) return;
      ui.well(x, y, w, 64 * s, { s, a: '#ffe9b0', b: '#fff6dc' });
      drawSkinPreview(ctx, r.gift.id, x + 34 * s, y + 32 * s, 50 * s, G.t);
      ui.text(`Free try: ${r.gift.name} Egg`, x + 66 * s, y + 22 * s, { size: 17 * s, color: ui.C.ink, maxW: w - 76 * s, tag: 'win:gift' });
      ui.text(`Your eggs wear it for the next ${DR.DIR.skinLevels} levels`, x + 66 * s, y + 44 * s, { size: 13.5 * s, color: ui.C.ink2, maxW: w - 76 * s, tag: 'win:gift2' });
    } });
    // Retry on the left, Next on the right (mykee 2026-11-19); their space is always reserved
    const last = G.li < 0 || G.li === LEVELS.length - 1;
    B.push({ h: 58 * s, gap: 12 * s, draw: (x, y, w) => {
      if (!inCard) return;
      const rw = w * 0.36;
      ui.button('restart', 'Retry', x, y, rw, 58 * s, { kind: 'secondary', icon: ICON.retry, size: 19 * s });
      ui.button('next', last ? 'ALL LEVELS' : 'NEXT', x + rw + 10 * s, y, w - rw - 10 * s, 58 * s, { kind: 'primary', shimmer: true, icon: ICON.next, size: 24 * s });
    } });
    B.push({ h: 48 * s, draw: (x, y, w) => {
      if (!inCard) return;
      if (!G.doubled) ui.button('double', (r.coins || 0) > 0 ? `Double coins: +${r.coins}` : 'Double', x + w * 0.1, y, w * 0.8, 48 * s, { kind: 'ad', ad: true, size: 16 * s });
      else ui.text('Coins doubled!', x + w / 2, y + 24 * s, { size: 18 * s, align: 'center', color: C.good, tag: 'win:doubled' });
    } });
    return B;
  };
  const RIB = '#f0542e';
  const card = stackCard(title, build, { ...cardO, hidden: true }); // lay out first: her flight needs the targets
  if (side) { const ss = sideStage(sd, card); T.box = ss.box; T.henH = ss.henH; T.clip = ss.box; }
  // the card slides in: up from below (portrait), in from the right (landscape)
  const dx = side ? (1 - e) * (ui.w - card.x + 20 * u) : 0, dy = side ? 0 : (1 - e) * (ui.h - card.y + 20 * u);
  // the show's big title under her feet: it fades as the card (which has its own) comes, and the card passes over it
  const ta = save.calm ? 0 : 1 - ss01((r.t - WIN_SHOW + 0.15) / 0.3);
  if (ta > 0.01) {
    const ts = Math.min(34 * u, A.w * 0.085), tw = Math.min(A.w - 56 * u, ui.measure(title, ts) + 60 * u), pk = ui.pop(r.t, 0.35);
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
  const box = { x: L(BIG.box.x, T.box.x + tdx), y: L(BIG.box.y, T.box.y + tdy) - Math.sin(e * Math.PI) * ui.h * 0.05, w: L(BIG.box.w, T.box.w), h: L(BIG.box.h, T.box.h) };
  if (k <= 0 && !calm) { // the show: rays turn behind her
    ctx.save(); ctx.globalAlpha = Math.min(1, r.t * 3);
    sunburst(BIG.box.x + BIG.box.w / 2, BIG.box.y + BIG.box.h - BIG.henH * 0.55, Math.max(ui.w, ui.h) * 0.75, 'rgba(255,236,170,0.1)', 14);
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
  const sd = cardSide(), room = (ui.A.y1 - Math.max(G.hudBottom, ui.A.y) - 30 * u) / u - 400, stH = clamp(room, 110, 184);
  const card = stackCard(timeout ? 'Out of time!' : 'Too many eggs broke', (s) => {
    const B = [];
    if (!sd) B.push({ h: stH * s, gap: 0, draw: (x, y, w) => {
      const box = { x, y, w, h: stH * s };
      henStage(box, s, false);
      drawCelebration(ctx, 'encourage', G.screenT, box, { henH: 0.685 * stH * s, calm: save.calm, pw: 0.5 });
      ui.record(box, 'fail:hen');
    } });
    // why it failed: an icon and two or three words (the ribbon above says the same)
    B.push({ h: 30 * s, gap: sd ? 2 * s : 8 * s, draw: (x, y, w) => {
      const t = timeout ? 'No time left' : 'Too many eggs lost', tw = ui.measure(t, 19 * s) + 34 * s, x0 = x + w / 2 - tw / 2;
      if (timeout) pictoClock(ctx, x0 + 12 * s, y + 15 * s, 28 * s); else pictoBroken(ctx, x0 + 12 * s, y + 15 * s, 28 * s);
      ui.text(t, x0 + 30 * s, y + 15 * s, { size: 19 * s, color: C.warn, maxW: w - 34 * s, tag: 'fail:cheer' });
    } });
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
      ui.text(`${st.saved}/${st.target}`, x + w / 2, y + 47 * s, { size: 17 * s, align: 'center', maxW: w - 16 * s, color: C.ink, tag: 'fail:stat' });
    } });
    if (G.sim.ally && G.sim.ally.avail.length) B.push(lineBlock('A farm friend can help', 14 * s, { color: C.info, tag: 'fail:ally', gap: 6 * s }));
    const Hp = G.failHelp;
    if (Hp) B.push({ h: 78 * s, gap: 10 * s, draw: (x, y, w) => { // the Director's help: a freebie, or the booster that fits
      const free = Hp.kind === 'trialChick' || Hp.kind === 'trialBoost', ad = Hp.kind === 'adBoost';
      ui.well(x, y, w, 78 * s, { s, a: free ? '#d8f5c0' : '#ffe9b0', b: free ? '#f0ffe4' : '#fff6dc' });
      const ax = x + 38 * s, ay = y + 39 * s;
      if (Hp.kind === 'trialChick') drawStrikeChick(ctx, Hp.id, ax, ay + 6 * s, 48 * s, G.t, {});
      else drawBoosterIcon(ctx, Hp.id, ax, ay, 56 * s, G.t);
      const bw = Math.min(118 * s, w * 0.3), tx = x + 74 * s, tw = x + w - bw - 16 * s - tx;
      ui.text(Hp.label, tx, y + 26 * s, { size: 16.5 * s, color: ui.C.ink, maxW: tw, tag: 'fail:help' });
      const ln = wrapText(Hp.line, 12.5 * s, tw).slice(0, 2);
      ln.forEach((l, i) => ui.text(l, tx, y + 48 * s + i * 15 * s, { size: 12.5 * s, color: ui.C.ink2, maxW: tw, tag: 'fail:help' + i }));
      const lab = free ? 'FREE' : ad ? 'Watch' : String(Hp.price);
      ui.button('help:go', lab, x + w - bw - 8 * s, y + 15 * s, bw, 48 * s, free ? { kind: 'primary', shimmer: true, size: 20 * s } : ad ? { kind: 'ad', ad: true, size: 17 * s } : { kind: save.wallet.coins >= Hp.price ? 'gold' : 'off', dim: 1, icon: (c, X, Y, S) => drawCoin(c, X, Y, S * 0.5, G.t), size: 19 * s });
      ui.record({ x, y, w, h: 78 * s }, 'fail:helpcard');
    } });
    B.push({ h: 60 * s, gap: 14 * s, draw: (x, y, w) => ui.button('retry', 'RETRY', x, y, w, 60 * s, { kind: 'primary', shimmer: true, icon: ICON.retry, size: 25 * s }) });
    // stuck (3 losses in a row on this level): skip ahead with an ad or coins
    if (G.li >= 0 && ads.stuck(G.level.id) && G.li < LEVELS.length - 1) B.push({ h: 46 * s, gap: 10 * s, draw: (x, y, w) => {
      const hw = (w - 8 * s) / 2, rich = save.wallet.coins >= SKIP_COINS, tk = save.wallet.tickets.skip;
      ui.button('skip:ad', 'Skip level', x, y, hw, 46 * s, ads.premium ? { kind: 'secondary', icon: ICON.next, size: 15 * s } : { kind: 'ad', ad: true, size: 15 * s });
      if (tk > 0) ui.button('skip:ticket', `Use Skip Ticket (${tk})`, x + hw + 8 * s, y, hw, 46 * s, { kind: 'secondary', size: 14 * s }); // bought in the shop
      else ui.button('skip:coins', 'Skip ' + SKIP_COINS, x + hw + 8 * s, y, hw, 46 * s, { kind: rich ? 'gold' : 'off', dim: 1, icon: (c, X, Y, S) => drawCoin(c, X, Y, S * 0.5, G.t), size: 15 * s }); // too few coins: the tap opens Get more
    } });
    if (!G.usedRewind && G.sim.canRewind()) {
      // Rewind 5 s: a Free rewind booster, or a video, or coins (dearer each time on this level). It keeps the win streak.
      const hl = G.li >= 0 ? DR.hotLost(save) : 0;
      if (hl >= 2) B.push({ h: 26 * s, gap: 8 * s, draw: (x, y, w) => {
        const t = `Rewind keeps your ${hl}-win streak`, tw = ui.measure(t, 15 * s) + 30 * s, x0 = x + w / 2 - tw / 2;
        pictoFlame(ctx, x0 + 11 * s, y + 13 * s, 24 * s);
        ui.text(t, x0 + 26 * s, y + 13 * s, { size: 15 * s, color: C.warn, maxW: w - 30 * s, tag: 'fail:hot' });
      } });
      const coinR = !G.freeRewind && !ads.premium && G.li >= 0, price = DR.rewindPrice((G.rewindBuys || {})[G.level.id]);
      B.push({ h: 50 * s, gap: hl >= 2 ? 4 * s : 10 * s, draw: (x, y, w) => {
        const hw = coinR ? (w - 8 * s) / 2 : w;
        ui.button('rewind', G.freeRewind ? 'Free rewind' : 'Rewind 5s', x, y, hw, 50 * s, G.freeRewind || ads.premium ? { kind: 'secondary', icon: ICON.rewind, size: 16.5 * s } : { kind: 'ad', ad: true, size: 16.5 * s });
        if (coinR) ui.button('rewind:coins', 'Rewind ' + price, x + hw + 8 * s, y, hw, 50 * s, { kind: save.wallet.coins >= price ? 'gold' : 'off', dim: 1, icon: (c, X, Y, S) => drawCoin(c, X, Y, S * 0.5, G.t), size: 16.5 * s });
      } });
    }
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
// App-start entrance (2026-11-16, mykee: tap the icon -> home right away, the title animating in): each piece of the home
// pops in on its own beat, ~0.9 s in all. Input is never blocked (hit rects are laid out at their final spot). Calm: instant.
const introBack = (p) => { const c = 1.9; p = Math.min(1, Math.max(0, p)); return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
function drawTitle() {
  const u = ui.u;
  ui.calm = save.calm;
  const intro = !!G.homeIntro && !save.calm && G.screenT < 1.2, T = G.screenT;
  // a piece's progress 0..1 (starts at `d` s, takes `dur` s); 1 when there is no entrance
  const ent = (d, dur = 0.32) => (intro ? Math.min(1, Math.max(0, (T - d) / dur)) : 1);
  // draw fn() popped in around (px, py): scale with a little overshoot, fading up
  const pop = (d, px, py, fn, dur) => {
    const p = ent(d, dur);
    if (p >= 1) { fn(); return; }
    if (p <= 0) { ctx.save(); ctx.globalAlpha = 0; fn(); ctx.restore(); return; } // unseen yet, but its tap target is already there
    const k = Math.max(0.02, introBack(p));
    ctx.save(); ctx.globalAlpha = Math.min(1, p * 2.2); ctx.translate(px, py); ctx.scale(k, k); ctx.translate(-px, -py); fn(); ctx.restore();
  };
  const fade = !intro && !G.homeIntro && G.screenT < 0.2 && G.t > 1; // returning from a level or the map: a short fade, not the entrance
  if (fade) ctx.globalAlpha = 0.25 + G.screenT / 0.2 * 0.75;
  const A = ui.A, cx = A.cx; // the meadow paints edge to edge; the logo and the buttons sit in the safe rect
  const bw = Math.min(310 * u, A.w - 44 * u);
  const wide = A.w > A.h * 1.15;
  // buttons sit on the meadow at the bottom: Play, then Levels | Daily | Shop, then the difficulty row
  // landscape: two balanced columns, logo + vault on the left, the buttons on the right, the meadow low across both
  const lx = wide ? A.x + A.w * 0.29 : cx, bx = wide ? A.x + A.w * 0.73 : cx;
  const blockH = 184 * u; // Play + Levels row + difficulty + Extras
  const ground = wide ? A.y1 - Math.max(96 * u, A.h * 0.2) : A.y1 - 204 * u - 16 * u;
  const by = wide ? Math.max(A.y + 14 * u, A.y + (ground - A.y - blockH) / 2 + 4 * u) : A.y1 - 204 * u; // room for the Extras row (and its lip, clear of the phone's bottom edge) under the difficulty row
  if (!themeBack(ctx, ui.skin, W_, H_, ground)) G.backdrop.drawGround(ctx, 0, ground, W_, H_ - ground, G.t); // a skin pack paints its whole scene instead
  // the earth under the controls falls into shade, so the buttons carry the bottom of the screen
  const sg = ctx.createLinearGradient(0, ground + 20 * u, 0, H_);
  sg.addColorStop(0, 'rgba(30,14,4,0)'); sg.addColorStop(1, 'rgba(30,14,4,0.5)');
  ctx.fillStyle = sg; ctx.fillRect(0, ground + 20 * u, W_, H_ - ground - 20 * u);
  menuFx(); // the skin's falling effect: over the scene, under the logo and buttons
  const logoS = Math.min(66 * u, (wide ? A.w * 0.5 : A.w) / 7.3, A.h / 6);
  const ty = A.y + Math.max(16 * u + logoS / 2, Math.min(A.h * 0.12, 72 * u));
  const logo = drawLogo(ctx, 'EGGSCAPE', lx, ty, logoS, G.t, intro ? T * 1.7 : 9, FONT, ui.skin && ui.skin.pack ? (c, ch, i, sz, n) => logoDress(ui.skin, c, ch, i, sz, n) : null); // intro: the letters drop in a quicker cascade
  ui.record(logo, 'title:logo');
  const subY = ty + logoS * 0.5 + 18 * u;
  G.titleToastY = subY + 16 * u;
  { const p = ent(0.3, 0.32); ctx.save(); ctx.globalAlpha *= p; ctx.translate(0, (1 - p) * 14 * u); // the tagline slides up under the title
    ui.text(TEST ? 'Test build: everything unlocked' : 'Get every egg home to the hen', lx, subY, { size: 17 * u, align: 'center', color: '#fff', stroke: 'rgba(50,24,6,0.8)', strokeW: 4 * u, shadow: 'rgba(50,24,6,0.8)', tag: 'title:sub', maxW: (wide ? A.w * 0.5 : A.w) - 32 * u }); ctx.restore(); }
  // the toy vault: centred between the subtitle and the meadow, or to the left of the buttons on a wide screen
  const eggH = Math.min(46 * u, (ground - subY) * 0.22);
  let vx = cx, vy, R;
  if (wide) {
    const top = subY + 18 * u, bot = ground - eggH * 2.2;
    R = Math.min((bot - top) / 2, A.w * 0.2);
    vx = lx; vy = (top + bot) / 2;
  } else {
    const top = subY + 22 * u, bot = ground - eggH * 2.4;
    R = Math.min((bot - top) / 2, A.w * 0.4);
    vy = (top + bot) / 2;
  }
  if (R < 40 * u) R = 0;
  else ui.record({ x: vx - R, y: vy - R, w: 2 * R, h: 2 * R }, 'title:vault');
  // the hen stands on the meadow in her outfit (tap: her wardrobe), the daily treasure chest waits on the other side
  const henH = Math.min(eggH * 2.3, 110 * u), hx = wide ? A.x + A.w * 0.075 : A.x + Math.max(henH * 0.48, A.w * 0.13);
  const ft = ctx.createRadialGradient(hx, ground, 2, hx, ground, henH * 0.5); ft.addColorStop(0, 'rgba(40,20,4,0.28)'); ft.addColorStop(1, 'rgba(40,20,4,0)');
  ctx.fillStyle = ft; ctx.beginPath(); ctx.ellipse(hx, ground, henH * 0.5, henH * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  pop(0.2, hx, ground, () => drawHenAnim(ctx, G.henHomeHop > G.t ? 'happy' : 'idle', hx, ground - henH * 0.5, henH, G.t, { key: 'home', face: 1, calm: save.calm, n: G.henHomeN || 0, shadow: 0 }), 0.4);
  homeHit('home:hen', hx - henH * 0.45, ground - henH, henH * 0.9, henH);
  const chestOpen = save.wallet.daily === today(), cs = Math.min(eggH * 1.35, 62 * u);
  const chx = wide ? bx + bw / 2 + Math.min(70 * u, (A.x1 - bx - bw / 2) * 0.5) : A.x1 - Math.max(cs * 0.7, A.w * 0.12), chy = ground - cs * 0.42;
  if (!(wide && chx + cs * 0.6 > A.x1)) {
    const tagS = 13 * u;
    pop(0.4, chx, ground, () => {
      drawChest(ctx, chx, chy, cs, G.t, chestOpen ? 'open' : 'ready');
      const tagT = chestOpen ? 'Tomorrow' : 'FREE', tgw = ui.measure(tagT, tagS) + 14 * u;
      ui.roundRect(chx - tgw / 2, chy - cs * 0.62 - tagS, tgw, tagS * 1.6, tagS * 0.8);
      ctx.fillStyle = chestOpen ? 'rgba(40,24,10,0.7)' : '#e8402e'; ctx.fill();
      ui.text(tagT, chx, chy - cs * 0.62 - tagS * 0.2, { size: tagS, align: 'center', color: '#fff', tag: 'title:chesttag' });
    });
    homeHit('home:chest', chx - cs * 0.6, chy - cs * 0.62 - tagS, cs * 1.2, cs * 1.1 + tagS);
  }
  pop(0.05, vx, vy, () => drawTitleScene(ctx, { cx: vx, cy: vy, R, ground, h: eggH, W: W_, H: H_, u, onLand: () => audio.play('hen_land', { vol: 0.5 }) }, G.t, save.calm), 0.5); // the toy vault and the meadow friends settle in
  pop(0.2, A.x + 30 * u, A.y + 30 * u, () => ui.button('settings', '', A.x + 10 * u, A.y + 10 * u, 40 * u, 40 * u, { kind: 'hud', icon: (c, x, y, sz) => settingsIcon(c, x, y, sz * 1.1, '#fff4dc'), round: 13 * u }));
  // remove ads / buy the game (app, until bought): a small gold pill in the top corner
  if (ads.canBuyPremium) {
    const ps = 14 * u, pw2 = ui.measure('Unlock all', ps) + 44 * u, py2 = A.y + 10 * u;
    pop(0.3, A.x1 - pw2 / 2 - 10 * u, py2 + 17 * u, () => ui.button('home:premium', 'Unlock all', A.x1 - pw2 - 10 * u, py2, pw2, 34 * u, { kind: 'gold', size: ps, icon: (c, x, y, sz) => drawStar(c, x, y, sz * 0.48, true) }));
  } else if (ads.premium && save.wallet.premDay !== today() && save.wallet.charges < E.MAX_CHARGES) { // Premium: a free Chick Charge every day
    const ps = 14 * u, lbl = 'Free charge', pw2 = ui.measure(lbl, ps) + 50 * u, py2 = A.y + 10 * u;
    pop(0.3, A.x1 - pw2 / 2 - 10 * u, py2 + 17 * u, () => ui.button('home:charge', lbl, A.x1 - pw2 - 10 * u, py2, pw2, 34 * u, { kind: 'primary', shimmer: true, size: ps, icon: (c, x, y, sz) => drawStrikeToken(c, 'freeze', x, y, sz * 0.42, G.t, true) }));
  }
  // PLAY breathes
  const ph = 70 * u, br = save.calm ? 1 : 1 + 0.018 * Math.sin(G.t * 2.6);
  pop(0.25, bx, by + ph / 2, () => {
    ctx.save();
    ctx.translate(bx, by + ph / 2); ctx.scale(br, br); ctx.translate(-bx, -(by + ph / 2));
    ui.button('play', nextIdx() > 0 ? `PLAY  Level ${LEVELS[nextIdx()].id}` : 'PLAY', bx - bw / 2, by, bw, ph, { kind: 'primary', shimmer: true, icon: ICON.play, size: 28 * u, round: 20 * u });
    ctx.restore();
  });
  const tw = (bw - 16 * u) / 3, ry = by + ph + 10 * u, rh = 54 * u, paid = save.daily.paid === today();
  pop(0.33, bx - bw / 2 + tw / 2, ry + rh / 2, () => ui.button('levels', 'Levels', bx - bw / 2, ry, tw, rh, { kind: 'secondary', icon: ICON.grid, size: 17 * u }));
  pop(0.4, bx - bw / 2 + tw * 1.5 + 8 * u, ry + rh / 2, () => ui.button('daily', paid ? dailyNextText() : 'Daily', bx - bw / 2 + tw + 8 * u, ry, tw, rh, paid ? { kind: 'off', size: 13 * u } : { kind: 'orange', icon: ICON.day, size: 17 * u }));
  pop(0.47, bx - bw / 2 + tw * 2.5 + 16 * u, ry + rh / 2, () => ui.button('shop', String(save.wallet.coins), bx - bw / 2 + 2 * (tw + 8 * u), ry, tw, rh, { kind: 'gold', icon: (c, x, y, s) => drawCoin(c, x, y, s * 0.56, G.t), size: 18 * u }));
  // the Golden Egg Bank: a small glass egg beside the coins, filling as wins drop coins in (tap: its card in the shop)
  if (save.wallet.bank > 0 && ads.moneyShop) {
    const eh = Math.min(rh * 0.8, 44 * u), ew = eh * 0.78, ex = bx + bw / 2 + 8 * u + ew / 2, ey = ry + rh / 2 - 2 * u;
    if (ex + ew / 2 <= A.x1 - 2 * u) {
      pop(0.5, ex, ey, () => drawGlassEgg(ctx, ex, ey, eh, save.wallet.bank / E.BANK_CAP, G.t));
      ui.record({ x: ex - ew / 2, y: ey - eh / 2, w: ew, h: eh }, 'title:bank');
      homeHit('home:bank', ex - ew / 2 - 4 * u, ey - eh / 2 - 4 * u, ew + 8 * u, eh + 8 * u);
    }
  }
  // (2026-11-16 research: no top casual game puts a difficulty switch on home; it lives in Settings)
  pop(0.54, bx, ry + rh + 32 * u, () => ui.button('extras', 'Extras', bx - bw / 2 + bw * 0.12, ry + rh + 12 * u, bw * 0.76, 40 * u, { kind: 'ad', icon: (c, x, y, s) => drawStar(c, x, y, s * 0.5, true), size: 16 * u, round: 14 * u }));
  if (fade) ctx.globalAlpha = 1;
}

// an invisible tap target on the home scene (the hen, the chest)
function homeHit(id, x, y, w, h) { ui.buttons.push({ id, x, y, w, h }); }

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

// The world map (2026-11-16, mykee: "one continuous page you scroll up and down through every world, a wavy road, each
// world in its own theme, the hens, rooster and villains living in the scenery"). World 1 at the bottom, World 10 at
// the top. Art and layout: render/mapscene.js. Here: the scroll (drag + momentum, like Practice), the stops as buttons,
// the hen at the next level, world signs, gate cards on worlds behind their star gate, and the fixed header and PLAY.
const mapWide = () => ui.A.w > ui.A.h * 1.25; // landscape: one header row, PLAY in the corner
function mapHeaderH() { return (mapWide() ? 14 + 46 + 8 + 20 : 14 + 46 + 12 + 44 + 10 + 26) * ui.u; } // back row, shop/chest row, progress line
function levelPageTop() { return ui.A.y + mapHeaderH(); }
function mapLayoutNow() {
  const A = ui.A, k = `${W_}x${H_}x${A.x}x${A.y}x${A.w}x${A.h}x${ui.u}`;
  if (!G.mapL || G.mapL.key !== k) { G.mapL = MS.mapLayout({ W: W_, A, u: ui.u, n: LEVELS.length }); G.mapL.key = k; }
  return G.mapL;
}
// scroll so map y sits at view fraction f (0 top .. 1 bottom of the map view)
function mapFocusY(y, f = 0.6) {
  const L = mapLayoutNow(), S = G.mscroll, vt = levelPageTop(), vb = ui.A.y1;
  S.max = Math.max(0, L.H - (vb - vt));
  S.y = clamp(y - (vb - vt) * f, 0, S.max); S.v = 0;
}
function mapFocusWorld(w) {
  const L = mapLayoutNow(), nx = nextIdx();
  if (envOf(nx) === w && envOpen(w)) mapFocusY(L.stops[nx].y, 0.55);
  else if (!envOpen(w)) mapFocusY(L.bandTop(w) + L.BH * 0.9, 0.62); // the gate card
  else mapFocusY(L.stops[Math.min(LEVELS.length - 1, w * PER_ENV)].y, 0.62);
}
function drawLevels() {
  const u = ui.u, A = ui.A, pad = 14 * u, S = G.mscroll;
  ui.calm = save.calm;
  const L = mapLayoutNow(), vt = levelPageTop(), vb = A.y1, vh = vb - vt;
  S.max = Math.max(0, L.H - vh);
  if (G.screenT < S.seenT || S.focus !== G.world + ':' + S.enter) { mapFocusWorld(G.world); S.focus = G.world + ':' + S.enter; } // just opened: show where the player is
  S.seenT = G.screenT;
  // the trip to the next stop after a win (2026-11-20): the camera follows the hen hopping along, a burst on arrival,
  // then the level page opens by itself
  const TR = G.mapTravel && L.stops[G.mapTravel.from] && L.stops[G.mapTravel.to] ? G.mapTravel : null;
  if (TR) {
    if (TR.t0 < 0) TR.t0 = G.screenT;
    const a = L.stops[TR.from], b = L.stops[TR.to], p = clamp((G.screenT - TR.t0 - 0.5) / 1.2, 0, 1), e = p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p);
    TR.x = a.x + (b.x - a.x) * e; TR.y = a.y + (b.y - a.y) * e; TR.p = p; TR.e = e;
    mapFocusY(TR.y, 0.55);
    if (p >= 1 && !TR.arrived) { TR.arrived = G.screenT; audio.play('unlock', { pitch: 1.15 }); buzz('tap'); }
    if (TR.arrived && G.screenT - TR.arrived > 0.6) { G.mapTravel = null; if (playable(TR.to)) press('lv:' + TR.to); }
  }
  const dt = Math.min(0.1, Math.max(0, G.t - (S.t || G.t))); S.t = G.t;
  if (!G.pdrag || !G.pdrag.moved) { if (Math.abs(S.v) > 8) { S.y += S.v * dt; S.v *= Math.exp(-SCROLL_DRAG * dt); } else S.v = 0; }
  const cl = clamp(S.y, 0, S.max); if (cl !== S.y) S.v = 0; S.y = cl;
  const sy = S.y - vt; // map y -> screen y is (y - sy)
  const t = G.t, calm = save.calm;
  // the land and the road, under everything
  ctx.save(); ctx.beginPath(); ctx.rect(0, vt, W_, vb - vt + (H_ - vb)); ctx.clip();
  MS.drawLand(ctx, L, sy, vt, H_, DPR);
  const nx = nextIdx();
  let doneTo = null; for (let i = 0; i < LEVELS.length; i++) if (bestStarsOf(LEVELS[i].id) > 0) doneTo = L.stops[i].y;
  MS.drawRoad(ctx, L, sy, vt, H_, doneTo);
  if (ui.skin && ui.skin.pack && ui.skin.pack.bg) drawRoadDress(ctx, L, sy, vt, H_, t, ui.skin.pack.bg, calm);
  MS.drawCast(ctx, L, sy, vt, H_, t, calm, DPR);
  const wide = mapWide(), ctaOn = playable(nx) && envOpen(envOf(nx));
  const ctaH = (wide ? 52 : 60) * u, ctaW = Math.min(A.w - 2 * pad, (wide ? 250 : 320) * u), ctaX = wide ? A.x1 - pad - ctaW : A.cx - ctaW / 2, ctaY = vb - ctaH - 4 * u;
  const tapBot = ctaOn && !wide ? ctaY - 6 * u : vb; // stops under the PLAY bar keep no tap target
  // the stops
  const BOSS = { a: '#c93a54', b: '#7a1a40', lip: '#42091f', line: '#22040e', ink: '#fff', rim: 'rgba(255,214,96,0.95)' };
  const sr = Math.min(8 * u, L.stopR * 0.26);
  let henAt = null;
  for (let i = 0; i < LEVELS.length; i++) {
    const st0 = L.stops[i], x = st0.x, y = st0.y - sy, Lv = LEVELS[i], boss = !!Lv.boss, r = boss ? L.stopR * 1.2 : L.stopR;
    if (y < vt - r * 2 || y > H_ + r * 2) continue;
    const w = st0.w, locked = !envOpen(w), open = playable(i), cur = open && i === nx;
    const acc = MS.WORLD_LOOK[w].accent;
    const face = open ? (boss ? BOSS : ui.faceOf(ui.mix(acc, '#d8862a', 0.15))) : ui.faceOf(ui.mix(boss ? '#8a2a48' : acc, '#6c7080', boss ? 0.6 : 0.75));
    if (cur && !calm) { const p = 0.5 + 0.5 * Math.sin(t * 4); ctx.beginPath(); ctx.arc(x, y + 2 * u, r + (5 + 5 * p) * u, 0, 7); ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.3 * p})`; ctx.fill(); }
    const inView = y - r >= vt + 2 * u && y + r + sr * 3 <= tapBot && !(ctaOn && wide && x + r > ctaX - 6 * u && y + r + sr * 3 > ctaY - 6 * u);
    if (locked || !inView) { // a quiet stone (behind a gate, or half under the header / screen edge: no tap target)
      ctx.beginPath(); ctx.arc(x, y + 3 * u, r, 0, 7); ctx.fillStyle = face.lip || face.b; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = face.a; ctx.fill(); ctx.lineWidth = 3 * u; ctx.strokeStyle = face.line; ctx.stroke();
      if (!locked) { const ns = Math.min(28 * u, r * 0.76); ctx.font = `600 ${Math.round(ns)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = Math.max(3, ns * 0.2); ctx.strokeStyle = face.line; ctx.strokeText(String(Lv.id), x, y); ctx.fillStyle = '#fff'; ctx.fillText(String(Lv.id), x, y); }
      if (!locked && open) for (let q = 0; q < 3; q++) drawStar(ctx, x + (q - 1) * sr * 2.4, y + r + sr * 1.15 - (q === 1 ? sr * 0.35 : 0), sr, q < starsOf(Lv.id));
      if (cur) henAt = { x, y, r };
      continue;
    }
    const grp = 'btn:lv:' + i;
    const b = ui.button('lv:' + i, '', x - r, y - r, 2 * r, 2 * r, { face, disabled: !open, keepFace: true, round: r, shimmer: cur });
    const fy = y - r + b.dy, fh = 2 * r - Math.min(6 * u, r * 0.26);
    if (open) {
      if (boss) drawCrown(x, fy - r * 0.02, Math.min(12 * u, r * 0.3));
      const ns = Math.min(28 * u, r * 0.76);
      ui.text(String(Lv.id), x, fy + fh * 0.5, { size: ns, align: 'center', color: '#fff', stroke: face.line, strokeW: Math.max(3, ns * 0.2), shadow: face.line, group: grp, tag: 'lvnum' + i });
      for (let q = 0; q < 3; q++) drawStar(ctx, x + (q - 1) * sr * 2.4, y + r + sr * 1.15 - (q === 1 ? sr * 0.35 : 0), sr, q < starsOf(Lv.id));
    } else {
      ui.text(String(Lv.id), x, fy + fh * 0.3, { size: Math.min(14 * u, r * 0.4), align: 'center', color: 'rgba(255,255,255,0.8)', stroke: face.line, strokeW: 2.5 * u, group: grp, tag: 'lvnum' + i });
      drawPadlock(x, fy + fh * 0.64, Math.min(10 * u, r * 0.3), null);
    }
    if (cur) henAt = { x, y, r };
  }
  // the boss treasures: a chest beside every boss stop, on the side away from where the hen would stand
  for (let i = 0; i < LEVELS.length; i++) {
    const Lv = LEVELS[i];
    if (!Lv.boss || !E.bossTreasure(Lv.id)) continue;
    const st0 = L.stops[i], r = L.stopR * 1.2, y = st0.y - sy;
    if (y < vt - r * 3 || y > H_ + r * 3 || !envOpen(st0.w)) continue;
    const side = st0.x < A.cx ? -1 : 1, cr = Math.min(r * 0.95, 34 * u);
    let cx = st0.x + side * (r + cr * 1.25);
    if (cx - cr < A.x + 4 * u || cx + cr > A.x1 - 4 * u) cx = st0.x - side * (r + cr * 1.25); // no room that way: the other side
    const cy = y - r * 0.15, beaten = bossBeaten(Lv.id), opened = E.treasureOpened(save.wallet, Lv.id), state = opened ? 'open' : beaten ? 'ready' : 'locked';
    const bob = state === 'ready' && !calm ? Math.abs(Math.sin(t * 3 + i)) * 4 * u : 0;
    ctx.beginPath(); ctx.ellipse(cx, cy + cr * 0.55, cr * 0.7, cr * 0.16, 0, 0, 7); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
    drawChest(ctx, cx, cy - bob, cr * 1.7, t + i, state);
    if (state === 'locked') drawPadlock(cx, cy + cr * 0.12, Math.min(9 * u, cr * 0.28), null);
    if (state === 'ready') { // a gold tag under it: there is something to open
      const ts = 12 * u, tw = ui.measure('OPEN!', ts) + 14 * u;
      ui.roundRect(cx - tw / 2, cy + cr * 0.62, tw, ts * 1.55, ts * 0.77); ctx.fillStyle = '#e8962a'; ctx.fill(); ctx.lineWidth = 2 * u; ctx.strokeStyle = '#fff3cf'; ctx.stroke();
      ui.text('OPEN!', cx, cy + cr * 0.62 + ts * 0.78, { size: ts, align: 'center', color: '#fff', noRecord: true });
    }
    const rect = { x: cx - cr, y: cy - cr, w: 2 * cr, h: cr * 1.9 };
    if (rect.y >= vt && rect.y + rect.h <= tapBot && !(ctaOn && wide && rect.x + rect.w > ctaX - 6 * u && rect.y + rect.h > ctaY - 6 * u)) {
      ui.record(rect, 'btn:tr:boss:' + Lv.id, 'btn:tr:boss:' + Lv.id); ui.buttons.push({ id: 'tr:boss:' + Lv.id, ...rect });
    }
  }
  // the hen waits beside the next level, on the side with more room
  if (TR) { // on the way: hopping along the road from the stop just won to the next one, then a burst where it lands
    const r = L.stopR, hh = r * 2, hop = calm ? 0 : Math.abs(Math.sin(TR.e * Math.PI * 4)) * r * 0.7 * (1 - TR.e * 0.3), dir = L.stops[TR.to].x >= L.stops[TR.from].x ? 1 : -1;
    const hx = TR.x, hy = TR.y - sy - r * 0.9 - hop;
    ctx.beginPath(); ctx.ellipse(hx, TR.y - sy + r * 0.2, hh * 0.28 * (1 - hop / (r * 2)), hh * 0.07, 0, 0, 7); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
    drawHenAnim(ctx, TR.arrived ? 'happy' : 'idle', hx, hy - hh * 0.32, hh, t, { key: 'map', face: dir, calm, shadow: 0 });
    if (TR.arrived) {
      const k = clamp((G.screenT - TR.arrived) / 0.6, 0, 1), b = L.stops[TR.to], by = b.y - sy;
      ctx.save(); ctx.globalAlpha = 1 - k; ctx.lineWidth = 4 * u * (1 - k) + 1; ctx.strokeStyle = '#ffe27a';
      ctx.beginPath(); ctx.arc(b.x, by, L.stopR * (1 + 1.4 * k), 0, 7); ctx.stroke();
      for (let q = 0; q < 8; q++) { const an = q * Math.PI / 4 + 0.3, rr = L.stopR * (1.1 + 1.6 * k); drawStar(ctx, b.x + Math.cos(an) * rr, by + Math.sin(an) * rr, 6 * u * (1 - k * 0.5), true); }
      ctx.restore();
    }
  } else if (henAt) {
    const hh = henAt.r * 2, side = henAt.x < A.cx ? 1 : -1, hx = henAt.x + side * (henAt.r + hh * 0.4), hy = henAt.y + henAt.r * 0.2;
    drawHenAnim(ctx, 'idle', hx, hy - hh * 0.32, hh, t, { key: 'map', face: -side, calm, shadow: 0 });
  }
  // worlds behind their gate: fog, and the gate card at the foot of the world
  const totalStars = bestTotal();
  for (let w = 0; w < L.nw; w++) {
    const top = L.bandTop(w) - sy, bot = top + L.BH;
    if (bot < vt - 40 * u || top > H_) continue;
    const locked = !envOpen(w);
    if (locked) MS.drawFog(ctx, L, w, sy, t, calm);
    // the world sign at its foot: number and name on a wooden board
    const sp = MS.signSpot(L, w), syy = sp.y - sy, name = WORLDS[w] || '', ns = 15 * u;
    if (!locked && syy > vt - 30 * u && syy < H_ + 30 * u) {
      const tw = ui.measure(name, ns), bw2 = tw + 52 * u, bh2 = 30 * u, bx2 = clamp(L.pathX(sp.y) + (L.pathX(sp.y) < A.cx ? 1 : -1) * (bw2 / 2 + L.roadW), A.x + bw2 / 2 + 6 * u, A.x1 - bw2 / 2 - 6 * u);
      ctx.fillStyle = '#5a3a1a'; ctx.fillRect(bx2 - bw2 * 0.3, syy - 4 * u, 5 * u, 22 * u); ctx.fillRect(bx2 + bw2 * 0.3 - 5 * u, syy - 4 * u, 5 * u, 22 * u);
      ui.roundRect(bx2 - bw2 / 2, syy - bh2, bw2, bh2, 8 * u); ctx.fillStyle = '#c99a5a'; ctx.fill(); ctx.lineWidth = 3 * u; ctx.strokeStyle = '#5a3a1a'; ctx.stroke();
      ctx.beginPath(); ctx.arc(bx2 - bw2 / 2 + 15 * u, syy - bh2 / 2, 10 * u, 0, 7); ctx.fillStyle = MS.WORLD_LOOK[w].accent; ctx.fill();
      ctx.font = `600 ${Math.round(12 * u)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(String(w + 1), bx2 - bw2 / 2 + 15 * u, syy - bh2 / 2 + 0.5 * u);
      ctx.font = `600 ${Math.round(ns)}px ${FONT}`; ctx.fillStyle = '#3a2008'; ctx.fillText(name, bx2 + 12 * u, syy - bh2 / 2 + 0.5 * u);
    }
    if (locked) {
      const need = envNeed(w), price = GATE_COINS(w), rich = save.wallet.coins >= price;
      const cw = Math.min(A.w - 2 * pad, 330 * u), ch = 176 * u, cx0 = A.cx - cw / 2, cy0 = L.bandTop(w) + L.BH * 0.86 - ch - sy;
      if (cy0 + ch < vt || cy0 > vb) continue;
      const full = cy0 >= vt && cy0 + ch <= vb, n0 = ui.rects.length, b0 = ui.buttons.length;
      ui.frame(cx0, cy0, cw, ch, { s: u, r: 18 * u, fw: 5 * u, lip: 4 * u, record: full, tag: 'levels:gatecard' + w });
      ui.text(`World ${w + 1}: ${WORLDS[w]}`, A.cx, cy0 + 26 * u, { size: 17 * u, align: 'center', color: '#8a6238', maxW: cw - 24 * u, tag: 'levels:gatename' + w, noRecord: !full });
      drawPadlock(A.cx - ui.measure(`Collect ${need} stars to open`, 17 * u) / 2 - 16 * u, cy0 + 58 * u, 11 * u, null);
      ui.text(`Collect ${need} stars to open`, A.cx + 8 * u, cy0 + 58 * u, { size: 17 * u, align: 'center', color: ui.C.ink, maxW: cw - 60 * u, tag: 'levels:gate' + w, noRecord: !full });
      drawStar(ctx, A.cx - ui.measure(`You have ${totalStars}`, 15 * u) / 2 - 12 * u, cy0 + 86 * u, 7 * u, true);
      ui.text(`You have ${totalStars}`, A.cx + 4 * u, cy0 + 86 * u, { size: 15 * u, align: 'center', color: '#8a6238', tag: 'levels:gatehave' + w, noRecord: !full });
      ui.button('gate:' + w, `Open now  ${price}`, cx0 + 18 * u, cy0 + 112 * u, cw - 36 * u, 46 * u, { kind: rich ? 'gold' : 'off', disabled: !rich, dim: 1, icon: (c, X, Y, S2) => drawCoin(c, X, Y, S2 * 0.5, G.t), size: 17 * u });
      if (!full) { ui.rects.length = n0; ui.buttons.length = b0; }
    }
  }
  ctx.restore();
  // the fixed header: a soft band so the map slides under it
  const hb = ctx.createLinearGradient(0, 0, 0, vt + 10 * u);
  hb.addColorStop(0, 'rgba(26,16,48,0.94)'); hb.addColorStop(Math.max(0, (vt - 4 * u) / (vt + 10 * u)), 'rgba(26,16,48,0.88)'); hb.addColorStop(1, 'rgba(26,16,48,0)');
  ctx.fillStyle = hb; ctx.fillRect(0, 0, W_, vt + 10 * u);
  const X0 = A.x + pad, X1 = A.x1 - pad, Y0 = A.y + pad, hy = Y0 + 23 * u;
  ui.button('back', '', X0, Y0, 46 * u, 46 * u, { kind: 'hud', icon: ICON.left, iconS: 1.3, round: 15 * u });
  const starTxt = `${totalStars} / ${LEVELS.length * 3}`, stw = ui.measure(starTxt, 17 * u);
  const chipW = 9 * u + 22 * u + 4 * u + stw + 12 * u, chipX = X1 - chipW;
  ui.glass(chipX, hy - 18 * u, chipW, 36 * u);
  drawStar(ctx, chipX + 9 * u + 11 * u, hy, 9.5 * u, true);
  ui.record({ x: chipX + 9 * u, y: hy - 11 * u, w: 22 * u, h: 22 * u }, 'levels:staricon', 'levels:stars');
  ui.text(starTxt, X1 - 12 * u, hy + 0.5 * u, { size: 17 * u, align: 'right', color: '#fff', stroke: 'rgba(30,14,4,0.7)', strokeW: 3 * u, tag: 'levels:stars', group: 'levels:stars' });
  // shop and the next star chest: their own row on a phone, beside the stars in landscape
  const chest = E.chestFor(totalStars, save.wallet.chests);
  const bw4 = wide ? 120 * u : 0, rowY = wide ? Y0 + 1 * u : Y0 + 46 * u + 12 * u, rh = 44 * u;
  const midW = wide ? bw4 * 2 + 10 * u : Math.min(A.w - 2 * pad, 340 * u), mx = wide ? chipX - 14 * u - midW : A.cx - midW / 2, half = (midW - 10 * u) / 2;
  ui.button('shop', String(save.wallet.coins), mx, rowY, half, rh, { kind: 'gold', icon: (c, x, y, s2) => drawCoin(c, x, y, s2 * 0.56, G.t), size: 17 * u });
  if (chest) ui.button('chest', chest.ready ? 'Open!' : `${totalStars}/${chest.at}`, mx + half + 10 * u, rowY, half, rh, { kind: chest.ready ? 'primary' : 'off', shimmer: chest.ready, disabled: !chest.ready, dim: 1, iconS: 1.25, icon: (c, x, y, s2) => drawChest(c, x, y, s2, G.t, chest.ready ? 'ready' : 'locked'), size: 15 * u });
  // the ribbon names the world in the middle of the view
  const midY = S.y + vh * 0.5;
  let wv = 0;
  for (let w = L.nw - 1; w >= 0; w--) if (midY >= L.bandTop(w) - L.BH * 0.02) { wv = w; break; }
  for (let w = 0; w < L.nw; w++) if (midY >= L.bandTop(w)) { wv = w; break; }
  const titleL = X0 + 46 * u + 18 * u, titleR = (wide ? mx : chipX) - 18 * u, wname = WORLDS[wv] || 'Levels';
  const rbw = clamp(ui.measure(wname, 20 * u) + 36 * u, Math.min(120 * u, titleR - titleL), titleR - titleL);
  ui.ribbon(wname, (titleL + titleR) / 2, hy - 18 * u, rbw, 36 * u, { color: MS.WORLD_LOOK[wv].accent, size: 20 * u, tag: 'levels:title' });
  // how far along: a thin bar of the whole journey and the levels still to play
  const cleared = LEVELS.reduce((a, Lv) => a + (bestStarsOf(Lv.id) > 0 ? 1 : 0), 0), left = LEVELS.length - cleared;
  const py = wide ? Y0 + 46 * u + 12 * u : rowY + rh + 10 * u + 10 * u, pw = Math.min(A.w - 2 * pad, 340 * u), px0 = A.cx - pw / 2;
  const lt = left ? `${left} level${left === 1 ? '' : 's'} to go` : 'Every level cleared!', ltw = ui.measure(lt, 13 * u), bw3 = pw - ltw - 12 * u;
  ui.roundRect(px0, py - 4 * u, bw3, 8 * u, 4 * u); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
  if (cleared) { ui.roundRect(px0, py - 4 * u, Math.max(8 * u, bw3 * cleared / LEVELS.length), 8 * u, 4 * u); ctx.fillStyle = '#f6c454'; ctx.fill(); }
  ui.text(lt, px0 + pw, py + 0.5 * u, { size: 13 * u, align: 'right', color: '#fff', stroke: 'rgba(30,14,4,0.65)', strokeW: 2.5 * u, tag: 'levels:left' });
  // the big PLAY at the foot of the screen (the map runs on under it)
  if (ctaOn) {
    if (!wide) { const fb = ctx.createLinearGradient(0, ctaY - 30 * u, 0, H_); fb.addColorStop(0, 'rgba(20,10,30,0)'); fb.addColorStop(1, 'rgba(20,10,30,0.5)'); ctx.fillStyle = fb; ctx.fillRect(0, ctaY - 30 * u, W_, H_ - ctaY + 30 * u); }
    ui.button('lv:' + nx, `PLAY  Level ${LEVELS[nx].id}`, ctaX, ctaY, ctaW, ctaH, { kind: 'primary', shimmer: true, icon: ICON.play, size: (wide ? 20 : 23) * u, round: 18 * u });
  }
  if (S.max > 0 && !calm) { // a thin scroll thumb
    const th = Math.max(30 * u, vh * vh / L.H), ty2 = vt + (S.y / S.max) * (vh - th - 4 * u);
    ui.roundRect(A.x1 - 5 * u, ty2, 3 * u, th, 1.5 * u); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
  }
}

// PRACTICE: every studio vault as a tile, grouped under the LAB names; same tile kit and grid as the level map, scrolled vertically
const PRACTICE_FACES = ['#d8862a', '#3a9a6a', '#4a82d0', '#b05aa8', '#c85a4a', '#2f9aa8', '#8a7ad8', '#9a8a2a'];
// a practice tile's picture (mykee 2026-11-16: themed icons, not a letter): the chick, the creature's portrait, the power
// or combo orb, the warp gate with who goes through it, the ally itself. Returns false when nothing fits (the letter stays).
const PRACTICE_PORTRAIT = { octoden: 'octopus', reef: 'fish', weaselboss: 'weasel', ratking: 'rats', grandpa: 'gator', kingcrab: 'hermit', warp: 'snake', warp_eagle: 'eagle', warp_sal: 'salamander', warp_frog: 'frog', warp_octo: 'octopus', warp_boss: 'weasel' };
function practiceIcon(k, x, y, r, t) {
  const c = ctx;
  try {
    if (CHICK_DEMOS.some((d) => d.kind === k)) { drawKindChick(c, k, x, y + r * 0.12, r * 1.45, t); return true; }
    if (k === 'rooster' || k === 'goose') {
      const A2 = ALLY_ART, P = k === 'rooster' ? A2.roosterPose('idle', 0, t) : A2.goosePose('idle', 0, t);
      (k === 'rooster' ? A2.drawRooster : A2.drawGoose)(c, x, y + r * 0.85, r * 1.9, P); return true;
    }
    if (k === 'owl') { c.save(); c.translate(x, y + r * 0.1); drawOwlArt(c, r * 1.8, t); c.restore(); return true; }
    if (k.startsWith('combo_')) { drawOrb(c, 'combo_' + k.slice(6), x, y, r * 1.05, t); return true; }
    if (P2_TYPES.includes(k)) { drawOrb(c, k, x, y, r * 1.05, t); return true; }
    const pk = PRACTICE_PORTRAIT[k] || k;
    if (k.startsWith('warp')) { // the gate behind, the traveller in front
      c.save(); c.translate(x, y); c.scale(r / 0.55, r / 0.55); W.drawPortal(c, 0, 0, t, false); c.restore();
      if (hasPortrait(pk)) drawVillainPortrait(c, pk, x + r * 0.35, y + r * 0.3, r * 1.15, t);
      return true;
    }
    if (hasPortrait(pk)) { drawVillainPortrait(c, pk, x, y, r * 2.5, t); if (pk !== k && /boss|king|grandpa/.test(k)) drawCrown(x, y - r * 0.95, r * 0.32); return true; }
  } catch (e) { /* a missing drawer keeps the letter */ }
  return false;
}
function drawPractice() {
  const u = ui.u, A = ui.A, pad = 14 * u, S = G.pscroll, vb = A.y1; // the list scrolls down to the bottom of the safe rect
  ui.calm = save.calm;
  const dt = Math.min(0.1, Math.max(0, G.t - (S.t || G.t))); S.t = G.t;
  if (!themeBack(ctx, ui.skin, W_, H_, H_ * 0.8)) {
    const bg = ctx.createLinearGradient(0, 0, 0, H_);
    bg.addColorStop(0, '#1c1440'); bg.addColorStop(1, '#3a2152');
    ctx.globalAlpha = 0.96; ctx.fillStyle = bg; ctx.fillRect(0, 0, W_, H_); ctx.globalAlpha = 1;
  }
  menuFx();
  const cols = A.w > A.h ? 5 : 3, gap = 12 * u, cw = Math.min((A.w - pad * 2 - gap * (cols - 1)) / cols, 136 * u), chh = cw;
  const gridW = cols * cw + (cols - 1) * gap, x0 = A.cx - gridW / 2;
  const vt = A.y + 70 * u, secH = 36 * u; // the list's top edge, a section header's height
  let total = 0;
  for (const g of LAB) total += secH + Math.ceil(g.items.length / cols) * (chh + gap) + 6 * u;
  S.max = Math.max(0, total + pad - (vb - vt));
  if (!G.pdrag || !G.pdrag.moved) { // momentum
    if (Math.abs(S.v) > 8) { S.y += S.v * dt; S.v *= Math.exp(-SCROLL_DRAG * dt); } else S.v = 0;
  }
  const cl = clamp(S.y, 0, S.max); if (cl !== S.y) S.v = 0; S.y = cl;
  // the list, clipped under the header
  ctx.save(); ctx.beginPath(); ctx.rect(0, vt, W_, vb - vt); ctx.clip();
  let y = vt - S.y + 4 * u, gi = 0;
  for (const g of LAB) {
    const face0 = ui.faceOf(PRACTICE_FACES[gi % PRACTICE_FACES.length]);
    if (y + secH > vt && y < vb) ui.text(g.name, x0 + 2 * u, y + secH / 2 - 2 * u, { size: 17 * u, color: '#ffe8b0', stroke: 'rgba(20,8,30,0.7)', strokeW: 3 * u, tag: 'practice:h' + gi, maxW: gridW - 4 * u, noRecord: y < vt || y + secH > vb });
    y += secH;
    g.items.forEach(([k, label], j) => {
      const c = j % cols, r = Math.floor(j / cols), x = x0 + c * (cw + gap), ty = y + r * (chh + gap);
      if (ty + chh < vt || ty > vb) return;
      const part = ty < vt || ty + chh > vb, n0 = ui.rects.length, nb = ui.buttons.length;
      const b = ui.button('demo:' + k, '', x, ty, cw, chh, { face: face0, keepFace: true, round: 18 * u });
      const fy = ty + b.dy, fh = chh - Math.min(6 * u, chh * 0.13), mxT = x + cw / 2, grp = 'btn:demo:' + k;
      const rad = Math.min(24 * u, fh * 0.26);
      ctx.beginPath(); ctx.arc(mxT, fy + fh * 0.38, rad, 0, 7); ctx.fillStyle = 'rgba(30,10,0,0.28)'; ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.rect(x + 3 * u, fy + 3 * u, cw - 6 * u, fh * 0.64); ctx.clip();
      const pic = practiceIcon(k, mxT, fy + fh * 0.38, rad * 1.15, G.t);
      ctx.restore();
      if (!pic) ui.text(label[0].toUpperCase(), mxT, fy + fh * 0.38 + 1 * u, { size: rad * 1.25, align: 'center', color: '#fff', stroke: face0.line, strokeW: 3 * u, shadow: face0.line, group: grp, tag: 'pl' + k });
      ui.text(label, mxT, fy + fh * 0.76, { size: Math.min(15 * u, fh * 0.15), align: 'center', color: '#fff', stroke: face0.line, strokeW: 3 * u, group: grp, tag: 'pn' + k, maxW: cw - 12 * u });
      if (part) { // a tile cut by the list edge keeps a tap area only inside the list and records nothing for the overlap check
        ui.rects.length = n0;
        const bt = ui.buttons[nb]; if (bt) { const t2 = Math.max(bt.y, vt), b2 = Math.min(bt.y + bt.h, vb); if (b2 - t2 < 8 * u) ui.buttons.length = nb; else { bt.y = t2; bt.h = b2 - t2; } }
      }
    });
    y += Math.ceil(g.items.length / cols) * (chh + gap) + 6 * u; gi++;
  }
  ctx.restore();
  // header band over the list: back, title
  ctx.fillStyle = '#1c1440'; ctx.globalAlpha = 0.94; ctx.fillRect(0, 0, W_, vt - 4 * u); ctx.globalAlpha = 1;
  const g2 = ctx.createLinearGradient(0, vt - 4 * u, 0, vt + 10 * u); g2.addColorStop(0, 'rgba(10,4,24,0.55)'); g2.addColorStop(1, 'rgba(10,4,24,0)'); ctx.fillStyle = g2; ctx.fillRect(0, vt - 4 * u, W_, 14 * u);
  const hy = A.y + pad + 23 * u;
  ui.button('back', '', A.x + pad, A.y + pad, 46 * u, 46 * u, { kind: 'hud', icon: ICON.left, iconS: 1.3, round: 15 * u });
  const tl = A.x + pad + 68 * u, trr = A.x1 - pad - 68 * u;
  ui.ribbon('Practice', A.cx, hy - 19 * u, clamp(170 * u, 90 * u, Math.max(90 * u, trr - tl)), 36 * u, { color: '#8a5ad8', size: 21 * u, tag: 'practice:title' });
  if (S.max > 0 && !save.calm) { // a thin scroll thumb
    const th = Math.max(30 * u, (vb - vt) * (vb - vt) / (total + pad)), ty2 = vt + (S.y / S.max) * (vb - vt - th - 4 * u);
    ui.roundRect(A.x1 - 5 * u, ty2, 3 * u, th, 1.5 * u); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fill();
  }
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
// the screen's own refresh interval (ms), from the median gap between frame callbacks (drawn or skipped)
const VSYNC = { last: 0, buf: [], iv: 1000 / 60 };
function frame(now) {
  requestAnimationFrame(frame); // first: an error below can never stop the loop (a stopped loop is a frozen level)
  if (VSYNC.last) { const d = now - VSYNC.last; if (d > 4 && d < 45) { VSYNC.buf.push(d); if (VSYNC.buf.length >= 31) { VSYNC.buf.sort((a, b) => a - b); VSYNC.iv = VSYNC.buf[15]; VSYNC.buf.length = 0; } } }
  VSYNC.last = now;
  // 2026-11-16 battery (mykee: the phone heats up): never draw faster than 60 fps (a 120 Hz screen called us twice as
  // often for nothing). 2026-11-19: 30 fps when Settings > Frame rate says so, or when Auto finds the phone can't hold 45.
  // 2026-11-20 (mykee: stutters even on a high-end phone): the cap counts whole screen refreshes. The old time test drew
  // every SECOND refresh on a 90 Hz screen (45 fps, a visible judder), Auto read 45 fps as "too slow" and walked the
  // phone down to Low and 30 fps. Now 60 and 90 Hz draw every refresh, 120 and 144 Hz every second one.
  const every = Math.max(1, Math.floor((1000 / PERF.fpsCap) / VSYNC.iv + 0.1));
  if (now - last < every * VSYNC.iv - VSYNC.iv * 0.5) return;
  // a slow phone catches up instead of slowing the world down (the cap was 0.05 s: at 5 fps the rings turned at a
  // quarter speed and looked stuck); past 0.1 s a frame is a hitch and the world waits
  const raw = last ? now - last : 16, dt = Math.min(0.1, raw / 1000 || 0.016);
  last = now;
  if (G.paused) return;
  if (takeStep(save, G.screen === 'play' && !!G.sim)) { setDPR(); persist(); } // a quality change lands before this frame draws (no empty frame); Auto remembers it
  try {
    if (G.henSkinCur !== save.wallet.henSkin) { G.henSkinCur = save.wallet.henSkin; setHenSkin(G.henSkinCur); ui.skin = skinUI(G.henSkinCur); } // hen + rooster skin, and the menus' theme
    const w0 = performance.now();
    update(dt);
    renderAll();
    FPSM.work += performance.now() - w0;
  } catch (e) {
    const msg = String((e && e.message) || e);
    G.errs = G.errs || {};
    if (!G.errs[msg]) { G.errs[msg] = 1; console.error('[eggscape] frame error', e); }
    try { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalAlpha = 1; } catch (_) { /* reset */ }
  }
  if (save.showFps) drawFpsMeter(raw);
  if (G.adBusy) adWatch(raw);
  perfTick(save, raw, !document.hidden && !G.paused && G.screen === 'play'); // 2026-11-19: Auto judges the phone on the game itself, not on a heavy menu (a themed home screen used to talk it down to Low for the next level)
}
// scrolling lists and the map (2026-11-19, mykee: "so slow"): a fling glides about 1/SCROLL_DRAG s of its speed (was 3.6-4.2)
const SCROLL_DRAG = 2.3;
// Settings > Display > Show frame rate (2026-11-19): frames per second over the last second, the quality step, and the
// canvas resolution, in the top-left corner, so a tester can tell us how a phone really runs
// 2026-11-20: also the screen's refresh rate, the game's own work per frame (ms, update + drawing commands) and the
// worst frame gap of the last second: a high gap with low work means the phone's graphics chip, not the game code
const FPSM = { n: 0, acc: 0, fps: 0, work: 0, wms: 0, worst: 0, w: 0 };
function drawFpsMeter(ms) {
  FPSM.n++; FPSM.acc += ms; FPSM.worst = Math.max(FPSM.worst, ms);
  if (FPSM.acc >= 1000) { FPSM.fps = Math.round(FPSM.n * 1000 / FPSM.acc); FPSM.wms = FPSM.work / FPSM.n; FPSM.w = FPSM.worst; FPSM.n = 0; FPSM.acc = 0; FPSM.work = 0; FPSM.worst = 0; }
  const txt = `${FPSM.fps} fps \u00b7 ${Math.round(1000 / VSYNC.iv)} Hz \u00b7 ${TIER_NAME[PERF.tier]} \u00b7 ${DPR.toFixed(2)}x \u00b7 ${FPSM.wms.toFixed(1)} ms \u00b7 max ${Math.round(FPSM.w)}`;
  ctx.save(); ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.font = `700 11px ${FONT}`; const w = ctx.measureText(txt).width + 10;
  const x = W_ / 2 - w / 2, y = ui.A.y1 - 17; // bottom centre, between the corner buttons
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x, y, w, 15); ctx.fillStyle = FPSM.fps >= 50 ? '#7dff6a' : FPSM.fps >= 28 ? '#ffd23a' : '#ff6a5a'; ctx.textBaseline = 'middle'; ctx.fillText(txt, x + 5, y + 8);
  ctx.restore();
}
// adaptive quality: src/perf.js (2026-11-19). Before that (2026-11-15/16) only the resolution adapted, 2x to 1.5x.
function setDPR() {
  const d = Math.min(window.devicePixelRatio || 1, PERF.dprCap);
  if (Math.abs(d - DPR) < 0.01) return;
  const up = d > DPR;
  DPR = d;
  canvas.width = Math.round(W_ * DPR); canvas.height = Math.round(H_ * DPR);
  // the backdrop's layers are rebuilt only for a sharper step (a rebuild is a visible hitch on a slow phone, and a
  // quality step DOWN mid-level is exactly when the phone is struggling): going down, the old layers just scale
  if (G.backdrop && up) G.backdrop.resize(W_, H_, DPR);
  if (G.weather) G.weather.resize(W_, H_, DPR);
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
  window.addEventListener('eggsafe', resize); // the Android shell's insets arrived or changed
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));
  canvas.addEventListener('pointerdown', pointerDown, { passive: false });
  canvas.addEventListener('wheel', wheel, { passive: false });
  window.addEventListener('pointermove', pointerMove);
  window.addEventListener('pointerup', pointerUp);
  window.addEventListener('pointercancel', pointerUp);
  window.addEventListener('keydown', (e) => { G.keys.__kb = true; keyDown(e); });
  window.addEventListener('keyup', keyUp);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearKeys(); if (G.screen === 'play') press('pause'); DR.noteSeen(save, Date.now()); persist(); } // the Director: when the app was last open (welcome-back gift)
    audioHold('hidden', document.hidden);
  });
  window.addEventListener('blur', clearKeys);
  installApp(() => { // Android back button (see app.js): consume it where the game has a natural "back"
    if (G.adBusy) { ads.cancelWait(); return true; } // a pending ad that never reported back: Back returns to the game
    if (modalOpen()) { // a sheet closes first (an offer counts as "No thanks"; the age question waits for next launch)
      if (G.parent) G.parent = null; else if (G.getMore) G.getMore = null; else if (G.chickBuy) G.chickBuy = null; else if (G.detail) G.detail = null;
      else if (G.offer) press('of:no'); else if (G.ageAsk) press('age:later'); else if (G.treasure) G.treasure = null;
      return true;
    }
    switch (G.screen) {
      case 'play': press('pause'); return true;
      case 'pause': press('resume'); return true;
      case 'info': press('info:close'); return true;
      case 'practice': case 'extras': case 'store': case 'levels': press('back'); return true;
      default: return false;
    }
  });
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
  // the app build used to be an everything-unlocked test build: its saves carry 50 fake levels and 99999 coins. The first
  // real-progression launch starts the journey fresh (settings and the hen's skins carry over).
  if (typeof __APP__ !== 'undefined' && __APP__ && !save.real) {
    const keep = { sfx: save.sfx, music: save.music, mode: save.mode, calm: save.calm, ringSpeed: save.ringSpeed, saver: save.saver, gfx: save.gfx, fps: save.fps, gfxStep: save.gfxStep };
    save = { ...defaultSave(), ...keep };
    ads.rebind(save);
  }
  save.real = 1;
  applySettings(save); setDPR(); // graphics quality: the phone's own guess or what it learned last time (src/perf.js)
  if (TEST) {
    const owned = {};
    for (const id of E.BOOSTER_ORDER) owned[id] = E.MAX_OWNED;
    save.unlocked = LEVELS.length;
    save.wallet = E.sanitizeWallet({ ...save.wallet, coins: Math.max(save.wallet.coins, 99999), owned, skins: E.SKIN_ORDER });
    persist();
  }
  ads.attach(save, persist, onGrant);
  OF.startSession(save, Date.now()); if (!DR.dirState(save).lastSeen) DR.noteSeen(save, Date.now()); persist();
  if (OF.childSafe(save) && ads.moneyShop) ads.setChildSafe(true); // the shell also remembers it; this keeps both in step
  applyAudioSettings();
  // title runs over the live next level
  startLevel(nextIdx());
  // 2026-11-20 (mykee): a returning player opens the app on the map (a first launch still meets the home screen)
  if (bestTotal() > 0 && !TEST) { G.world = envOf(nextIdx()); setScreen('levels'); } else setScreen('title');
  if (DEV) { const d = new URLSearchParams(location.search).get('demo'); if (d) window.__egg.startDemo(d); } // v3.2: ?demo=glow
  G.homeIntro = true; G.screenT = 0; // the home page plays its entrance from here (the setup above must not eat it)
  const sp = document.getElementById('splash'); // the plain sky behind the canvas goes as soon as the first frames are painted
  if (sp) requestAnimationFrame(() => requestAnimationFrame(() => sp.remove()));
  if (sp) { const minShow = 2300 - (performance.now() - (window.__t0 || 0)); /* the launch sting plays out (egg in the nest) before the home screen */ setTimeout(() => { sp.classList.add('out'); setTimeout(() => sp.remove(), 500); }, Math.max(0, minShow)); }
  portal.loadingDone();
  last = performance.now();
  requestAnimationFrame(frame);
}

// test hook (used by the QA bot and screenshot tools); compiled out of release builds
if (DEV) window.__egg = {
  howto: { drawHowTo, howToPlan, chickPlan, BASIC: HOWTO_BASIC, ROOSTER: HOWTO_ROOSTER, rooster: (c, x, y, s) => allyIcon(c, x, y, s) },
  stampStats,
  perf: { bodyCache, ringCache, PERF, STEPS, applySettings: () => { applySettings(save); setDPR(); } },
  mapJump(w) { G.world = w; G.mscroll.focus = ''; }, // map shots: show world w
  mapScroll(y) { G.mscroll.y = y; G.mscroll.v = 0; G.mscroll.focus = G.world + ':' + G.mscroll.enter; },
  G, LEVELS, LAB, ui, art: { drawOctopus: devOcto, octoAnim: devOctoAnim, drawJelly: devJelly }, drawVillainPortrait, PORTRAIT_BG, HEN_SKIN_ORDER: E.HEN_SKIN_ORDER, SKIN_ORDER: E.SKIN_ORDER, setEggSkin: (k) => W.setSkin(k),
  get sim() { return G.sim; },
  start: (i, o) => startLevel(i, o),
  CHICK_DEMOS,
  startFrog(o = {}) { G.demo = FROG_DEMO; startLevel(-2, o); }, // v3.3 frog studio level
  wonder, // WONDER: the bonus world's controller (state, toScreen) for strips and QA
  startDemo(kind, o = {}) { if (wonder.has(kind)) return wonder.start(kind); const D = [...CHICK_DEMOS, ...SEA_DEMOS, ...POWER_DEMOS, ...THIEF_DEMOS, ...REEF_DEMOS, ...BAYOU_DEMOS, ...LAB_DEMOS]; G.demo = D.find((d) => d.kind === kind || d.id === kind) || CHICK_DEMOS[0]; startLevel(-2, o); }, // v3.2 chick demos, v3.3 sea, v3.4 powers
  POWER_DEMOS,
  THIEF_DEMOS,
  bayouArt: { drawGator, drawTurtle, drawSwarm, drawGatorCard, drawGatorEmblem }, // v3.7 Gator Bayou strips
  thiefArt: { drawThief, thiefPose, thiefBlend, RIG: THIEF_RIG, drawThiefCard, drawThiefEmblem, drawBossCard }, // v3.6 thief strips
  press,
  strike(id) { if (!G.sim || !G.sim.stk) return null; if (id) G.sim.stkEquip(id); return fireStrike(true); }, // Chick Strike: fill the meter and fire
  strikeArt: { drawStrikeButton, drawStrikeToken, drawStrikeStage, drawStrikeChick },
  step(seconds) { const n = Math.round(seconds / DT); for (let i = 0; i < n; i++) G.sim.step(); handleEvents(); },
  frame(dt = 1 / 60) { update(dt); renderAll(); }, fxStats: menuFxStats,
  actSteps, // film strips replay planner moves through this
  snakeArt: drawSnake, // palette strips
  hen: { anim: drawHenAnim, legacy: drawHenLegacy, events: henIdleEvents, reset: resetHen }, // M7 strips
  cheer: { draw: drawCelebration, routine, ROUTINES, pick: pickRoutine, power: routinePower }, // the hen's win routines (strips)
  allyArt: ALLY_ART, // v3.4: ally strips
  callAlly: (kind, o) => G.sim.callAlly(kind, o),
  startAllyDemo(kind = 'rooster', o = {}) { G.demo = ALLY_DEMOS.find((d) => d.kind === kind) || ALLY_DEMOS[0]; startLevel(-2, o); },
  snAnim: W.snAnim,
  salAnim, // v3.2: the salamander's last drawn feet (QA strips)
  geckoAnchor: () => geckoAnchor(G.sim), // L15: where the frost gecko boss is drawn (QA strips)
  crawlerArt: { drawCrawler, SPECIES: CRAWLER_SPECIES, crawlerAnim, drawSalamander }, // cousins: gecko, thornback, chameleon (QA strips)
  frogAnim, // v3.3: the frog's eased looks (QA strips)
  frogArt: drawFrog, // v3.3: pose gallery (QA strips)
  seaAnim, // v3.3: the octopus's and fishes' render state (QA strips)
  handle: () => handleEvents(),
  overlaps: () => G.overlaps,
  // the "i" panel (tools/info-check.cjs, qa-overlap): the table, the kind finder, the portraits, and an opener for any screen
  VILLAIN_INFO, villainKinds, bossAttacks, villainArt: drawVillainPortrait,
  openInfo() {
    if (G.screen === 'wonder') {
      const W2 = wonder.state, kinds = new Set(villainKinds(W2.level));
      for (const sm of (W2.game && W2.game.sims) || []) for (const k of villainKinds(W2.level, sm)) kinds.add(k);
      G.infoKinds = [...kinds]; G.infoFrom = 'wonder'; G.iscroll = { y: 0, v: 0, max: 0, t: G.t }; setScreen('info');
    } else { G.infoFrom = G.screen === 'pause' ? 'pause' : 'play'; openInfo(); }
    return G.infoKinds.slice();
  },
  uiRect: (tag) => ui.rects.find((r) => r.tag === tag) || null, // QA strips: where a recorded block was drawn
  setSave(s) { loadSave(s); },
  ads, // shop QA: stuck counts, prices, the purchase bridge
  get save() { return save; },
  // QA only: jump straight to an end screen with a plausible result
  showResult(kind, stars = 3, cheer = null, t = 9) {
    if (kind === 'win') G.result = { broken: stars < 2 ? 1 : 0, cracked: stars === 2 ? 1 : 0, used: 47, stars, saved: stars < 2 ? 2 : 3, eggs: 3, eggScore: 4200, timeBonus: 380, streak: stars === 3 ? 3 : 0, streakMult: stars === 3 ? 1.5 : 1, total: 6870, shownTotal: 6870, t, target: 2, perfect: stars === 3, rewound: false, coins: 34, bonus: true, hasBonus: stars === 3, cheer: cheer || pickRoutine({ stars }) };
    else G.sim.state = 'failed';
    setScreen(kind);
  },
};

boot();
