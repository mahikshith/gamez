// Eggscape: game shell. Screens, input, camera, events -> VFX/SFX/score, HUD.
import { Sim, DT, LEGACY_ORB, EAGLE_LEN, REWIND_S, SCARE_S, isHardLevel } from './sim/sim.js';
import { hintSearch, actSteps } from './sim/search.js';
import { RING_TH, clamp, lerp } from './sim/geom.js';
import { curtainFront, vineFront } from './render/v3art.js'; // where a burning thorn curtain's fire has got to
import { LEVELS } from './data/levels.js';
import { DAILY } from './data/daily.js';
import { THEMES, createBackdrop, setSceneCalm } from './themes.js';
import { bodyCache, ringCache, releaseRings } from './render/ringart.js';
import { dragTo, grab, glideStep, snapPx } from './scroll.js';
import { diag } from './diag.js'; // 0.8.7: the built-in speed log (Settings > Display > Share log)
import { formStats } from './render/castkit.js';
import { PERF, applySettings, tick as perfTick, takeStep, newLevel as perfNewLevel, STEPS, TIER_NAME } from './perf.js';
import { speedTest, openSpeedTest } from './speedtest.js'; // 2026-11-20: Settings > Display > Speed test (on the player's own phone)
import { audio, MAIN_THEME } from './audio.js';
import { portal } from './sdk/portal.js';
import { FX } from './render/fx.js';
import * as W from './render/world.js';
import { themeBack, themeWash, themeTick, logoDress } from './ui/theme.js';
import { menuFxBack, menuFxFront, menuFxStats } from './ui/menufx.js'; // the skin's living effect over the menus
import { UI, FONT, ICON, drawStar, drawEggIcon, drawAdBadge, setAdOff } from './ui/ui.js';
import { drawTitleScene, drawLogo, titleTap } from './render/title.js';
import { drawSnake } from './render/characters.js';
import * as MS from './render/mapscene.js'; // the world map: land, road, scenery and cast
import { chestSpot as mfChestSpot } from './render/mapfarm.js'; // 0.8.17: where a boss's treasure chest stands
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
import { drawStore, drawCoin, drawBoosterStrip, drawChest, drawGlassEgg, storeItem, drawOfferArt, drawBoosterIcon, drawSkinPreview, drawHenSkinPreview, iapRows, iapValueLine, drawIapBanner, drawPart, drawItemArt, PROMISE, valueBadge } from './ui/store.js';
import * as GL from './goals.js'; // 2026-11-20: the three star goals of each level
import * as SK from './skip.js'; // 2026-11-23: the pause page's Skip level (one rewarded video)
import { createPurse } from './ui/purse.js'; // 2026-11-23: one coin-gain effect for every place the purse grows
import { createLanding, createPrizePop } from './ui/landing.js'; // 0.8.17: every reward lands on its page (the purse and the bag), every video says what it gave
import * as DR from './director.js'; // 2026-11-20: the Director (help ladder, freebies, trials, home nudges)
import * as OF from './offers.js'; // 2026-11-16: the offer engine, the age question and child-safe mode
import * as ENG from './engine/index.js'; // 0.8.15: the background subsystems (Ledger, Pulse, Oracle, Conductor, Herald) behind one safe face
import * as SP from './spin.js'; // 0.8.15: the Lucky Spin's rules
import * as MINT from './engine/mint.js'; // 0.8.17: the coin loop's one table (world gates in order, replays, the online share, the win-video pot)
import { drawSlot, slotGeom, stripPos, drawSliceIcon, drawTicket, drawSlotIcon, drawVillainCard, releaseSlot, SLICE_COL } from './render/slot.js'; // and its machine: three reels and a lever
import * as CK from './clock.js'; // 0.8.17: the game's day only moves forward (the phone's date cannot repeat daily things)
import * as GD from './guard.js'; // 0.8.17: a refunded one-time purchase is taken back (the store's own record)
import * as WT from './waiting.js'; // 0.8.17: video rewards met offline wait for a connection
import * as BR from './brain.js'; // 2026-11-23: the Brain, one arbiter over the Director and the offer engine (who is playing, when to ask, what fits)
import fontUrl from '../assets/fonts/fredoka-600-latin.woff2';
import { botTick } from './dev/bot.js';
import { geckoStrikeEv, drawGeckoCard, geckoAnchor } from './render/gecko15.js'; // L15: the frost gecko boss
import { drawBossRings, drawBossUnder, drawBossOver, drawBossActor, drawBossBar, drawMagnetField, bossPose, setBossView } from './render/boss.js'; // bosses (v3.1)
import { galeNow, BOSS_TITLE, ATTACK_NAME, BOSS_MODE } from './sim/boss.js';
import { magnetEvent, magnetLean } from './render/magnet.js'; // 2026-11-20: the magnet's look
import { drawChickEgg, drawChickFX, drawHardIce, chickEvent, chickLabel, drawKindChick, drawReady } from './render/chicks.js'; // v3.2 chick kinds
import { drawP2Back, drawP2Front, p2Event, drawLiveRing } from './render/powers2.js'; // v3.4 powers and combos
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
import { drawUrchins, urchinEvent } from './render/urchinplay.js'; // 0.8.17 urchin: Spike the sea urchin (level 46)
import { drawDenAlone, drawThiefDens, eggInDen, drawThieves, drawThievesOver, thiefEvent, drawThief, thiefPose, thiefBlend, drawThiefCard, drawThiefEmblem } from './render/thieves.js'; // v3.6 the weasel and the rats
import { drawBandit, bandHides, banditEvent } from './render/banditplay.js'; // 0.8.17 bandit
import { RIG as THIEF_RIG } from './sim/thieves.js';
import { THIEF_DEMOS } from './data/thief-demo.js'; // v3.6 thief studio levels (dev)
import { LAB_DEMOS } from './data/lab-demos.js'; // v4 Shape Lab studio levels: the clockwork cast and the owl
import { drawClockwork, drawClockworkTele, cwEvent, drawCwIntro } from './render/clockwork.js'; // v4 clockwork spider, wind-up beetle, spring jack
import { owlEvent, drawOwlArt } from './render/owl.js'; // v4 the Clockwork Owl
import { movesEvent } from './render/bossmoves.js'; // the boss variety moves
import { drawSalamanders, drawSalHeat, drawSalamander, salAnim } from './render/salamander.js'; // v3.2 lava salamander
import { drawCrawler, SPECIES as CRAWLER_SPECIES, crawlerAnim } from './render/crawlers.js'; // the salamander's cousins (dev strips; not in a level yet)
import { drawFrogs, drawFrogTele, frogEvent, frogAnim, drawFrog } from './render/frog.js'; // v3.3 frog
import { drawPips, pipEvent, pipCalm } from './render/pip.js'; // 0.8.17 pip
import { PIP_DEMO } from './data/pip-demo.js'; // 0.8.17 pip: his practice vault (joins LAB_DEMOS below)
import { drawCocos, drawCocoOver, cocoEvent, cocoCalm } from './render/coco.js'; // 0.8.17 coco
import { COCO_DEMO } from './data/coco-demo.js'; // 0.8.17 coco: his practice vault (joins LAB_DEMOS below)
import { drawBayou, drawBayouOver, bayouEvent, drawGator, drawTurtle, drawSwarm, drawGatorCard, drawGatorEmblem } from './render/bayou.js'; // v3.7 Gator Bayou
import { ringReach, ringPt } from './sim/shapes.js'; // v3.3 M10 vault shapes
import { drawRockHud } from './render/shapes.js';
import { strikeLayer } from './render/strikehit.js'; // Chick Strike: the villains' hit reactions
import { streakFlame } from './ui/flame.js';
import { pictoCheck, pictoCross, pictoWarn, pictoClock, pictoFlame, pictoGem, pictoTarget, pictoCracked, pictoBroken, pictoGoal, pictoPower, pictoPerk, pictoStarMinus, pictoNoVideo } from './ui/picto.js'; // icon-first cards
import { drawStrikeWorld, strikeEvent, drawStrikeButton, drawStrikeToken, drawStrikeStage, drawStrikeChick, strikeSeat } from './render/strike.js';
import { drawPremiumBadge } from './render/premium.js'; // the premium chicks' crown // Chick Strike powers
import { STRIKES, STRIKE, STRIKE_FROM, EGG_STRIKES } from './data/strikes.js';
import { focusAsk, focusStart, focusEnd, focusY, focusTrip, focusLook, focusDraw, focusUseHand, tabForKey } from './ui/focus.js'; // 0.8.16: scroll to the thing and point at it
import { drawHand as teachHand } from './render/wonder.js';
focusUseHand(teachHand); // the teaching hand (Papa Rooster's first call)
import { stampStats, stampSweep } from './render/stamp.js';
import { cvStats, freeCanvas } from './render/cvfree.js';
import * as CB from './render/celebrate.js'; // 0.8.15 the celebration kit: rays, bursts, confetti, arcs, the gift box, the bag
import { REC, recInit, recWindow, recProbe, recDue, recPre, recGo, recIll } from './recover.js';
import { drawHowTo, howToPlan, chickPlan, toyPlan, floorPlan, chickTeach, threatWords, BASIC as HOWTO_BASIC, ROOSTER as HOWTO_ROOSTER, LOOP as HOWTO_LOOP } from './render/howto.js'; // 2026-11-20: show, don't tell
import { createWonder } from './wonder.js'; // WONDER: the bonus world (own screen, own loop) and the Extras menu screen
import * as SQ from './side.js'; // 0.8.17: the side quests (a Wonder Vault a world, off the road on the map)
import * as MSIDE from './render/mapside.js'; // 0.8.17: their doors and trails on the map
import { VILLAIN_INFO, ATTACK_EXTRA, villainKinds, bossAttacks } from './data/villain-info.js'; // the "i" panel: who is in this vault
import { drawVillainPortrait, PORTRAIT_BG, hasPortrait } from './render/villain-art.js';
import { drawExtrasMark } from './render/extras.js';
import * as ROAD from './road.js'; // 0.8.17: sixty levels, six a world; the old saves' level ids move once (migrateRoad)
import * as AL from './album.js'; // 0.8.17: the combo album (drawAlbum)
import * as RS from './reset.js'; // 0.8.17: Settings > Reset progress (what goes, what stays)
import { PRIVACY, PRIVACY_URL, PRIVACY_DATE } from './data/privacy.js'; // 0.8.17: Settings > Privacy policy
import { vibrate, installApp } from './app.js'; // Android WebView proof shell: bridge vibration, back button, FPS overlay (no-ops outside EGG_APP)
// Safety net: an animated size that dips below zero (a shrinking bubble, a tiny card on a short screen) makes arc() /
// ellipse() THROW, which kills the rest of that frame every frame. Clamp the radius to 0 instead (NaN too).
for (const P of [typeof CanvasRenderingContext2D !== 'undefined' && CanvasRenderingContext2D.prototype, typeof OffscreenCanvasRenderingContext2D !== 'undefined' && OffscreenCanvasRenderingContext2D.prototype].filter(Boolean)) {
  const arc = P.arc, el = P.ellipse;
  P.arc = function (x, y, r, a0, a1, ccw) { return arc.call(this, x, y, r > 0 ? r : 0, a0, a1, ccw); };
  if (el) P.ellipse = function (x, y, rx, ry, rot, a0, a1, ccw) { return el.call(this, x, y, rx > 0 ? rx : 0, ry > 0 ? ry : 0, rot, a0, a1, ccw); };
}

const DEV = typeof __DEV__ !== 'undefined' ? __DEV__ : true;
const PREVIEW = typeof __PREVIEW__ !== 'undefined' ? __PREVIEW__ : ''; // a show build (tools/build.mjs EGG_PREVIEW): opens on one page, saves nothing
// playtest build (build.mjs --test): every level, booster and skin unlocked, plenty of coins
const TEST = typeof __TEST__ !== 'undefined' && __TEST__;

// ---------------------------------------------------------------- save
// 0.8.7 (mykee: "by default at least between medium and high ring turning speed"): new players start at 150%; a save
// still on the old default of 100% moves up once (save.rsDef), a speed the player picked is never touched
const RING_SPEED_DEFAULT = 1.5;
const SAVE_VER = 3; // v3: 35 new levels, progress resets; settings, wallet and discoveries carry over
// mode: difficulty (F32); stars/best are kept per mode (Medium uses the v1 keys); calm = reduced motion
const defaultSave = () => ({ v: SAVE_VER, road: ROAD.ROAD_V, unlocked: 1, stars: {}, best: {}, streak: 0, sfx: true, music: true, seen: {}, mode: 'medium', calm: false, intro: {}, bonus: {}, wallet: E.defaultWallet(), gates: {}, ringSpeed: RING_SPEED_DEFAULT, rsDef: 2, adClaim: 0, daily: { day: '', best: 0, paid: '' } });
let save = defaultSave();
const MODE_LIST = ['easy', 'medium', 'hard'];
const sk = (id, mode = save.mode) => (mode === 'medium' ? String(id) : mode[0] + id);
const starsOf = (id) => save.stars[sk(id)] || 0;
// star gates (I5): environment k (0-based) opens at GATE * k stars, counting each level's best over all modes
const GATE = 7, PER_ENV = ROAD.PER_ENV; // 0.8.17: six levels a world (road.js)
const bestStarsOf = (id) => Math.max(0, ...MODE_LIST.map((m) => save.stars[sk(id, m)] || 0));
// 2026-11-20 first-five ladder: nothing is sold or advertised until level 3 is won. The one switch for every entry point
// (level page Boosters tab, Free booster video, coin/shop chip; win card Bonus chest and offers; the Director's nudges
// and fail help; offer cards anywhere). The map's own shop button stays. Tune it here.
E.setPlatform(!ads.moneyShop); // 0.8.11: a web portal sells nothing, so wins and videos pay more there (economy.js PLATFORM)
const earlyDays = () => DR.earlyDays(save); // src/director.js: SELL_AFTER
const bestTotal = () => LEVELS.reduce((a, L) => a + bestStarsOf(L.id), 0) + SQ.sideTotal(save); // 0.8.17: a side quest's bonus stars count (gates, chests, the map's total)
// a brand-new player (nothing won yet, nothing unlocked): home is the logo and one big PLAY, and PLAY goes straight into
// level 1 with the teaching hand (no map, no level card). Any win, or a level unlocked, and home is the full home.
const firstRun = () => !TEST && !allOpen() && bestTotal() === 0 && (save.unlocked || 1) <= 1;
const envOf = (i) => Math.floor(i / PER_ENV);
const envNeed = (k) => (TEST ? 0 : MINT.worldNeed(k, PER_ENV)); // 0.8.17: GATE (7) stars a world of five, scaled by PER_ENV (six a world since 0.8.17)
// a world gate opens by stars, or for coins (2026-11-15: "or they can buy with the coins they earn"); a tester switch opens all.
// 0.8.17 (mykee: "users cannot unlock a far distant world without unlocking the previous one"; the Mint): only the next
// world, once the one before is open and its boss is won or skipped, for the stars it is missing (MINT.gatePrice: 75 a
// star, at least 150; nothing at the star target). It was a flat 80 + 40 a world, any world, from the first one.
const GATE_COINS = (k) => MINT.gatePrice(k, bestTotal(), PER_ENV);
// world k's boss (or its last level) is won or skipped: the next world may open
const envBoss = (k) => { const Lw = LEVELS.slice(k * PER_ENV, (k + 1) * PER_ENV), b = Lw.find((L) => L.boss) || Lw[Lw.length - 1]; return !!b && (bestStarsOf(b.id) > 0 || SK.isSkipped(save, b.id)); };
// Settings (2026-11-15): how fast the rings follow a finger, 0.6x .. 2x of the designed speed
const RING_SPEEDS = [0.6, 0.8, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4, 5]; // 2026-11-16 mykee: experienced players want even faster (300%; no extra tunnelling seen in a 3x wall-crossing check)
const ringSpeed = () => (RING_SPEEDS.includes(+save.ringSpeed) ? +save.ringSpeed : RING_SPEED_DEFAULT);
// 0.8.17: the hidden tester switch (7 taps on the logo) works only in dev builds and the separate unlocked test builds;
// in a store build the taps do nothing and an old save.tester flag is ignored (it opened the $2.99 unlock for free)
const UNLOCKED = typeof __UNLOCKED__ !== 'undefined' && !!__UNLOCKED__; /* global __UNLOCKED__ */
const TESTER_OK = DEV || TEST || UNLOCKED;
const allOpen = () => TEST || UNLOCKED || (TESTER_OK && !!save.tester) || !!(save.wallet && save.wallet.noAds); // 2026-11-20: Unlock Everything ($2.99) opens every level
// open: the world before is open and its boss passed (MINT.worldReady), and the stars are there or the gate was bought
function envOpen(k) {
  if (allOpen()) return true;
  const st = bestTotal();
  for (let j = 0; j <= k; j++) if (!MINT.worldReady(j, () => true, envBoss) || !(st >= envNeed(j) || !!(save.gates && save.gates[j]))) return false;
  return true;
}
// 0.8.17: world k may be opened now (by stars or for coins): the world before is open and its boss passed. The map's gate
// shows its coin button only then (GATE_COINS(k) is 0 when the stars are already there: it opens by itself)
const envReady = (k) => !envOpen(k) && MINT.worldReady(k, envOpen, envBoss);
const playable = (i) => i >= 0 && i < LEVELS.length && (allOpen() || (i < save.unlocked && envOpen(envOf(i))));
// the level the Play button means: the first one not yet cleared (in the order of the map), else the frontier.
// 2026-11-15: it was save.unlocked - 1, which an everything-unlocked build set to 50 ("PLAY Level 50" on every launch)
function nextIdx() {
  const lim = allOpen() ? LEVELS.length : Math.min(LEVELS.length, save.unlocked);
  for (let i = 0; i < lim; i++) if (!bestStarsOf(LEVELS[i].id) && !SK.isSkipped(save, LEVELS[i].id)) return i; // a skipped level is passed (no stars)
  return Math.max(0, lim - 1);
}
function loadSave(s) {
  s = ROAD.migrateRoad(s); // 0.8.17: a save from the 50-level road moves to the 60-level numbering, once (save.road)
  save = { ...defaultSave(), ...s };
  if (s.rsDef !== 2) { save.rsDef = 2; if (!(+s.ringSpeed) || +s.ringSpeed === 1) save.ringSpeed = RING_SPEED_DEFAULT; }
  save.wallet = E.sanitizeWallet(save.wallet);
  CK.bind(save, () => { const b = appBridge(); return b && typeof b.uptime === 'function' ? Number(b.uptime()) : undefined; }); // the game's day (save.clock)
  if (!MODE_LIST.includes(save.mode)) save.mode = 'medium';
  for (const [o, n] of Object.entries(LEGACY_ORB)) if (save.seen[o]) save.seen[n] = 1; // v1 discoveries
  ads.rebind(save);
  ENG.boot(save); // the Ledger looks at this purse without filing anything
}
// visual-only weather per theme; levels with a physics `weather` field use that instead
const THEME_WEATHER = { farm: 'leaves', coop: 'leaves', hayfield: 'leaves', pond: 'leaves', windmill: 'leaves', redbarn: 'leaves', orchard: 'leaves', bramble: 'leaves', mushroom: 'fireflies', frozen: 'snow', blizzard: 'snow', dunes: 'sandstorm', haunted: 'ghosts', dragon: 'ash' };
// seven environments of five (v3)
const WORLDS = ['The Farm', 'Wild Woods', 'Frozen Lake', 'Crystal Caves', 'Volcano', 'Storm Peaks', 'The Thieves\u2019 Vault', 'Coral Reef', 'Gator Bayou', 'Shape Lab'];
// test build lab pages (v3.6): every studio vault, reachable without the dev console
const LAB = [
  { name: 'Chicks', items: CHICK_DEMOS.map((d) => [d.kind, d.kind[0].toUpperCase() + d.kind.slice(1)]) },
  { name: 'Creatures', items: [['frog', 'Frog'], ['octopus', 'Octo'], ['octoden', 'Puddle'], ['fish', 'Fish'], ['reef', 'Reef'], ['penguin', 'Pip']] }, // 0.8.17 pip
  { name: 'Thieves', items: [['weasel', 'Weasel'], ['rats', 'Rats'], ['weaselboss', 'Raid'], ['ratking', 'King'], ['bandit', 'Bandit']] }, // 0.8.17 bandit
  { name: 'Bayou', items: [['gator', 'Gator'], ['turtle', 'Turtle'], ['mosquito', 'Bugs'], ['grandpa', 'Grandpa']] },
  { name: 'Allies', items: [['rooster', 'Rooster'], ['goose', 'Goose']] },
  { name: 'Coral Reef', items: [['hermit', 'Hermit'], ['puffer', 'Puffer'], ['jelly', 'Jelly'], ['kingcrab', 'King'], ['urchin', 'Urchin']] }, // 0.8.17 urchin
  { name: 'Powers', items: [['frostnova', 'Frost'], ['shock', 'Shock'], ['thunderclap', 'Clap'], ['laser', 'Laser'], ['spin', 'Spin']] },
  { name: 'More powers', items: [['pepper', 'Pepper'], ['shrink', 'Shrink'], ['iron', 'Iron'], ['decoy', 'Decoy']] },
  { name: 'Warp Gate', items: [['warp', 'Snake'], ['warp_eagle', 'Eagle'], ['warp_sal', 'Lizard'], ['warp_frog', 'Frog'], ['warp_octo', 'Octo']] },
  { name: 'Combos', items: [['combo_shatter', 'Smash'], ['combo_sweep', 'Sweep'], ['combo_cannon', 'Cannon'], ['combo_twister', 'Twist']] },
  { name: 'More combos', items: [['combo_magnet', 'Magnet'], ['combo_stink', 'Stink'], ['combo_bait', 'Bait'], ['warp_boss', 'Boss']] },
  { name: 'Clockwork', items: [['spider', 'Spider'], ['beetle', 'Beetle'], ['jack', 'Jack'], ['owl', 'Owl']] }, // v4 Shape Lab
];
if (!LAB_DEMOS.includes(PIP_DEMO)) LAB_DEMOS.push(PIP_DEMO); // 0.8.17 pip: Practice > Creatures > Pip, and ?demo=penguin
if (!LAB_DEMOS.includes(COCO_DEMO)) { LAB_DEMOS.push(COCO_DEMO); LAB.find((g) => g.name === 'Creatures').items.push(['monkey', 'Coco']); } // 0.8.17 coco: Practice > Creatures > Coco, and ?demo=monkey
const BONUS_TEXT = (b, fuse = 1) => ({ turns: `${b.n} turns or fewer`, prize: 'Save the speckled egg', orbs: 'Collect every orb', time: `Finish within ${Math.round(b.s * fuse)} s` })[b.kind] || '';
const BONUS_COINS = 15;
const AD_BOOST = ['golden', 'time', 'stone', 'sponge']; // the intro card's free booster, by level
// Daily Vault (C7): one pre-validated layout per day, the same for everyone; level index -1
const DAILY_COINS = MINT.FAUCETS.dailyVault.coins; // 0.8.17 the Mint: 15 (was 40)
// 0.8.17: the game's own day (src/clock.js): it only moves forward, so moving the phone's date back and forth no longer
// repeats the chest, the samples, the spins and the freebies (same 'YYYY-MM-DD' key as before)
const today = () => CK.today();
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
const strikesOpen = () => STRIKES.filter((S) => (!S.premium && strikeReach() >= S.unlock) || E.ownsChick(save.wallet, S.id) || DR.trialChick(save) === S.id || (G.trialChick && G.level && G.trialChick.lid === G.level.id && G.trialChick.id === S.id));
// 2026-11-15: the power chick is chosen per level on the intro card. It no longer carries over silently from the last
// level; a retry of the same level keeps the choice (G.stkSel is per level id).
function strikeFor(L, i) {
  const open = strikesOpen();
  if (!open.length || (i >= 0 && L.id < STRIKE_FROM)) return null;
  const sel = G.stkSel && G.stkSel.lid === (L && L.id) ? G.stkSel.id : null;
  return sel && open.some((S) => S.id === sel) ? sel : null;
}
let lastCoins = null;
// the Ledger files every change of the purse under a reason: the press that caused it, or the one named by the code (win, treasure, taste)
let ledWhy = 'other';
const ledWhyOf = (id) => (/^(buy|item|chick|charge|hen|skin|kit|set|gate|cb):/.test(id) || id === 'deal' ? 'shop' : /^rewind/.test(id) ? 'rewind' : /^skip/.test(id) ? 'skip' : /^spin/.test(id) ? 'spin' : id === 'chest' ? 'chest' : id === 'tr:open' ? 'treasure' : id === 'home:chest' ? 'daily' : id === 'ad:coins' || id === 'double' ? 'video' : /^(nudge|sample|help|of)(:|$)/.test(id) ? 'gift' : id === 'go' || id === 'ally' || id === 'strike' || id === 'bank' ? 'use' : 'other');
const ledger = (why) => ENG.sync(save, why, today());
// what is waiting for the player's next visit: what each note of the Herald's catalogue needs to be true (herald.js
// CATALOGUE), and the Oracle's "something is waiting"
function waitingCtx() {
  const total = bestTotal(), ch = E.chestFor(total, save.wallet.chests), on = SP.open(save), spins = on ? SP.banked(save) : 0, left = on ? SP.left(save) : 0, w = save.wallet;
  let wk = -1; for (let k = 1; k < WORLDS.length && k * PER_ENV < LEVELS.length; k++) if (!envOpen(k)) { wk = k; break; } // the next world still behind its star gate
  const nx = LEVELS[nextIdx()], won = (id) => bestStarsOf(id) > 0, att = save.dir && save.dir.att && nx ? save.dir.att[nx.id] : null;
  const bag = Object.keys(w.owned || {}).filter((b) => w.owned[b] > 0 && E.BOOSTERS[b]), stuck = nx && !won(nx.id) && att && att.streak >= 3 ? nx.id : 0;
  const adDay = save.adDay && save.adDay.n > 0 ? save.adDay.day : '';
  return { spins, spinLeft: spins ? 0 : left, starsToChest: ch && !ch.ready ? ch.at - total : 0, chestSkin: !!(ch && ch.reward.skin && !E.ownsSkin(w, ch.reward.skin)), daily: true, child: OF.childSafe(save), waiting: spins > 0 || left === 1,
    chestDay: w.daily || '', dailyOn: true, videosOn: !!ads.moneyShop && !ads.premium, videoDay: adDay, premium: !!ads.premium, charges: w.charges || 0, chargeMax: E.MAX_CHARGES, premDay: w.premDay || '',
    starsToWorld: wk > 0 ? Math.max(0, envNeed(wk) - total) : 0, nextWorld: wk > 0 ? WORLDS[wk] : '', nextBoss: nx && nx.boss && !won(nx.id) && playable(nextIdx()) ? nx.id : 0, quest: '', flame: DR.hotCount(save),
    stuck, stuckBoost: stuck && bag.length ? E.BOOSTERS[bag[0]].name : '', unlocked: save.unlocked || 1, allDone: LEVELS.every((L) => won(L.id)), newContent: false, giftOk: !earlyDays() };
}
// what a skin, an outfit or a chick costs him right now: half while a half-price ticket is held (economy.js COUPON)
const upPrice = (list) => E.unlockPrice(save.wallet, list).price;
const appBridge = () => { try { return typeof window !== 'undefined' && window.EggApp ? window.EggApp : null; } catch (_) { return null; } };
// the game came to the front: a session starts or goes on; the notes that were pending are cancelled and graded
function engOpen() {
  const b = appBridge(); let from = '';
  try { if (b && typeof b.openedFrom === 'function') from = String(b.openedFrom() || ''); } catch (_) { /* no shell */ }
  const R = ENG.open(save, Date.now(), from);
  try { if (b && typeof b.notifyCancel === 'function') b.notifyCancel(); } catch (_) { /* no shell */ }
  remSt.t = -1e9; remInf.t = -1e9; // the phone's settings may have changed while he was away
  if (R && R.reminder && R.reminder.fired) diag.note({ reminder: R.reminder });
  if (R && R.awayH >= 20) G.offerTried = false; // a day or more away: the home's one card (the welcome-back gift) may show again
  if (from === 'test') { G.remLand = null; toast('The test note arrived. Reminders work on this phone!', 3.2); audio.play('unlock'); }
  else if (R && R.reminder && R.reminder.hit && R.reminder.land) G.remLand = { to: R.reminder.land, t: G.t }; // the tap lands on what the note spoke of
  if (G.remFrom === 'sys' && remPhone() === 'granted') { ENG.herald.answer(save, true); G.remFrom = null; G.remAsk = null; persist(); audio.play('unlock'); toast('Reminders are on. One a day at most.', 2.8); } // back from the phone's settings with them allowed
}
// the game went to the background: the Oracle notes its guess for "comes back", the Herald plans its series (app only)
function engClose(screen = G.screen) {
  tallyFlush();
  const P = ENG.close(save, { ...waitingCtx(), unlocked: save.unlocked || 1, screen, level: G.level && G.li >= 0 ? G.level.id : 0, lastWon: G.screen === 'win' }, Date.now()), b = appBridge();
  try {
    if (P && b && typeof b.notifyAt === 'function') {
      if (typeof b.notifyCancel === 'function') b.notifyCancel(); // a fresh series, never one left over
      b.notifyAt(String(P.at), P.id, P.title, P.text);
      if (typeof b.notifyMore === 'function') (P.more || []).forEach((m, i) => b.notifyMore(String(i + 1), String(m.at), m.id, m.title, m.text)); // the rest of the series; all are cancelled on opening
    }
  } catch (_) { /* no shell */ }
}
// where a tap on a note lands (herald.js CATALOGUE land): the spin page, the coop's chest, the map's star chest, the level
function remLanding() {
  const L = G.remLand;
  if (!L || modalOpen() || G.settingsOpen || G.adBusy || !['title', 'levels'].includes(G.screen) || G.t - L.t < 0.4) return;
  G.remLand = null;
  if (L.to === 'spin' && SP.open(save)) openSpin();
  else if ((L.to === 'level' || L.to === 'map' || L.to === 'chest' || L.to === 'quest') && G.screen !== 'levels') press('levels');
  else if ((L.to === 'daily' || L.to === 'charge' || L.to === 'home' || L.to === 'coins') && G.screen !== 'title') setScreen('title');
}
// ---- reminders (app only): the Herald (engine/herald.js) decides; this is the question, the bell chip and the switch.
// 0.8.17 (mykee: "even if the user skips or says not now, when they come back we should always show it"): while they are
// off, a small bell with a slash on the home and the map opens the question; the question itself comes back at happy
// moments (a boss win, a spin banked, a welcome back), once per three days of play at most, never after a loss.
const remCan = () => { const b = appBridge(); return !!(b && typeof b.notifyAsk === 'function' && typeof b.notifyState === 'function') && !OF.childSafe(save); };
const remSt = { v: '', t: -1e9 }, remInf = { v: {}, t: -1e9 };
function remPhone() { // "granted" | "ask" | "never" (Android will not ask again) | "off": what the phone says; asked of the shell at most every two seconds
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (now - remSt.t > 2000) { remSt.t = now; try { remSt.v = String(appBridge().notifyState() || ''); } catch (_) { remSt.v = ''; } }
  return remSt.v;
}
function remInfo() { // the phone's side (Reminders.java info): channel, battery saver, the planned notes, the last fired and opened
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (now - remInf.t > 2000) { remInf.t = now; try { const b = appBridge(); remInf.v = b && typeof b.notifyInfo === 'function' ? JSON.parse(String(b.notifyInfo() || '{}')) || {} : {}; } catch (_) { remInf.v = {}; } }
  return remInf.v;
}
const remOn = () => { const H = ENG.herald.state(save); return H.ok === 1 && !H.off && remPhone() === 'granted'; };
const remSys = () => ['never', 'off'].includes(remPhone()); // only the phone's own settings can turn them on now
const remChipOn = () => remCan() && !remOn() && !earlyDays();
function remRequest(from) { // Android's own question (13+), a plain yes where the phone needs none, or the phone's settings page when Android will not ask
  G.remFrom = from; remSt.t = -1e9;
  if (remSys()) { G.remFrom = 'sys'; try { appBridge().notifySettings('app'); } catch (_) { /* no shell */ } return; }
  try { appBridge().notifyAsk(); } catch (_) { /* no shell */ }
}
function remTest() { // Settings: a real note through the real path in about ten seconds
  const b = appBridge();
  if (remPhone() !== 'granted') { remRequest('test'); return; }
  try { if (b && typeof b.notifyTest === 'function') { b.notifyTest('10'); toast('A test note comes in about 10 seconds. You can leave the game.', 3.4); audio.play('ui_open'); } else toast('Update the app to send a test note.', 2.8); } catch (_) { /* no shell */ }
}
// the speed log's notif line: permission, channel, battery saver, planned times, last fired, last opened from
function remLine() {
  const I = remInfo(), t = (ms) => (ms ? new Date(ms).toISOString().slice(5, 16).replace('T', ' ') : '-');
  return `perm ${remPhone() || '?'}, chan ${I.chan || '?'}, battery ${I.battery || '?'}${I.strict ? ' (strict maker ' + I.maker + ')' : ''}, sdk ${I.sdk || '?'}, planned ${(I.plan || []).map((q) => q.id + '@' + t(q.at)).join(' ') || '-'}, fired ${I.firedId || '-'} ${t(I.firedAt)}, opened ${I.openId || '-'} ${t(I.openAt)}, replanned ${I.replanN || 0} ${t(I.replanAt)}; herald ${ENG.lines(save).herald}`;
}
// may the question show at this happy moment? moment: 'boss' | 'spin' | 'welcome' | 'chip'
function remAskOk(moment) {
  if (!remCan()) return false;
  const P = save.eng && save.eng.pulse, S = P && P.sess && P.sess[P.sess.length - 1];
  return ENG.herald.askNow(save, { moment, on: remOn(), child: OF.childSafe(save), won3: !earlyDays(), won5: bestStarsOf(5) > 0, sess: S ? S.t : 0, days: (P && P.days) || [] });
}
function remAskShow(moment) {
  const P = save.eng && save.eng.pulse, S = P && P.sess && P.sess[P.sess.length - 1];
  ENG.herald.noteAsk(save, { sess: S ? S.t : 0 });
  G.remAsk = { ...waitingCtx(), moment, t0: G.t }; audio.play('ui_open');
  BR.why(save, moment === 'chip' ? 'home' : moment === 'welcome' ? 'home' : 'win', 'reminder', `the reminder question (${moment})`); persist();
}
if (typeof window !== 'undefined') window.__eggNotif = (ok) => {
  const from = G.remFrom;
  try {
    remSt.t = -1e9;
    ENG.herald.answer(save, !!ok);
    BR.why(save, 'home', 'reminder', ok ? 'reminders allowed' : 'reminders not allowed on the phone (the bell stays)');
    persist();
    if (ok && from === 'test') remTest();
    else if (ok) { audio.play('unlock'); toast('Reminders are on. One a day at most.', 2.8); }
    else if (from === 'set' || from === 'test') toast('Allow notifications for Eggscape in your phone settings.', 3.4);
  } catch (_) { /* optional */ }
  G.remFrom = null;
};
// ---- the Tally (engine/tally.js): which buttons and offers were on a page he saw, which he tapped, seconds per screen.
// Looked at three times a second, never per frame; one count per visit of a page.
const TAL_IDS = new Set(['double', 'bonus', 'sample', 'chest', 'daily', 'rewind', 'rewind:coins', 'skip:ad', 'skip:ticket', 'skip:coins', 'ad:coins', 'adboost', 'shop', 'store', 'win:shop', 'gm:shop', 'gm:ad', 'tr:shop', 'tr:open',
  'home:chest', 'home:bank', 'home:premium', 'home:charge', 'home:hen', 'premium', 'set:novideo', 'chip:skip', 'strike', 'ally', 'settings', 'practice', 'extras', 'info', 'retry', 'next', 'restart', 'hint', 'cb:buy', 'pause:skip', 'store:coins', 'set:remind', 'rem:yes', 'calm', 'spin', 'leave:stay', 'leave:go', 'spin:retry']);
const TAL_PRE = /^(buy|charge|chick|hen|skin|kit|item|iap|gm:iap|try|boost|hset|spin|stk:buy|stk:pick|tr:boss|lv|tab):/;
const talCache = new Map();
function tallyKey(id) {
  if (!id) return null;
  if (id === 'of:buy' || id === 'of:ad') return G.offer ? 'of:' + G.offer.id : null;
  if (id === 'nudge:yes') return G.nudge ? 'nudge:' + G.nudge.kind : null;
  if (id === 'help:go') return G.failHelp ? 'help:' + G.failHelp.kind : null;
  let k = talCache.get(id);
  if (k === undefined) { const m = TAL_IDS.has(id) ? null : TAL_PRE.exec(id); k = TAL_IDS.has(id) ? id : m ? (m[1] === 'tab' ? id : m[1]) : null; if (talCache.size < 400) talCache.set(id, k); }
  return k;
}
const talView = { n: 0, key: '', seen: new Set(), sc: '', t0: 0 };
function tallyFlush() { // the seconds on the screen that was up are filed; the clock starts again
  const now = performance.now();
  if (talView.sc && talView.t0) ENG.tally.screen(save, talView.sc, (now - talView.t0) / 1000, save.unlocked || 1);
  if (talView.sc === 'intro' && talView.t0 && G.li >= 0) ENG.pacer.card(save, (now - talView.t0) / 1000); // the Pacer: how long the level card holds him
  talView.sc = G.screen || ''; talView.t0 = now;
}
function tallyFrame() {
  if (++talView.n % 20) return;
  if (talView.sc !== G.screen) tallyFlush();
  const key = `${G.scrSeq}|${G.settingsOpen ? 1 : 0}|${G.offer ? G.offer.id : ''}|${G.detail || ''}|${G.getMore ? 1 : 0}|${G.nudge ? 1 : 0}|${G.remAsk ? 1 : 0}|${G.chickBuy || ''}|${G.skipAsk ? 1 : 0}|${G.treasure ? 1 : 0}`;
  if (key !== talView.key) { talView.key = key; talView.seen.clear(); }
  for (const b of ui.buttons) { const k = tallyKey(b.id); if (k && !talView.seen.has(k)) { talView.seen.add(k); ENG.tally.seen(save, k); } }
}
function persist() {
  if (PREVIEW) return;
  ledger(ledWhy);
  { // the Director counts coins spent (any drop in the purse is a spend: coins only ever leave through a purchase)
    const c = save.wallet ? save.wallet.coins || 0 : 0;
    if (lastCoins != null && c < lastCoins) DR.noteSpend(save, lastCoins - c, G.screen || 'any');
    lastCoins = c;
  }
  try { portal.save(JSON.stringify(save)); } catch (e) { /* never block */ }
}

// ---------------------------------------------------------------- canvas
const canvas = document.getElementById('game') || Object.assign(document.body.appendChild(document.createElement('canvas')), { id: 'game' });
// 2026-11-20 speed: an opaque canvas. Every screen paints the whole canvas each frame anyway (nothing below it ever
// shows), and an opaque canvas lets the compositor skip blending it over the page and skip the page background under it
// (one less full-screen fill a frame, which a phone's graphics chip pays for). desynchronized is NOT used: on some
// WebViews it draws straight to the screen and tears.
let ctx = canvas.getContext('2d', { alpha: false }); // (let: a HUD layer is painted through the same code, on its own canvas: hudLayer)
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
  pscroll: { y: 0, v: 0, max: 0, t: 0 }, escroll: { y: 0, v: 0, max: 0, t: 0 }, pdrag: null, // Practice and Extras screen scroll
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
const wonder = createWonder({ ctx, ui, audio, size: () => ({ W: W_, H: H_, DPR }), save: () => save, persist: () => persist(), time: () => G.t, escroll: () => G.escroll, album: () => xsAlbumRow(), albumIcon: (c, x, y, S, t) => albumRowIcon(c, x, y, S, t), albumMark: (xr, y, h) => markBadge(xr - 4 * ui.u, y + 4 * ui.u, Math.min(11 * ui.u, h * 0.14), G.t, '!'), albumLead: (S, off, R, vh) => albumLead(S, off, R, vh), glide: (S, dt) => glideDt(S, dt), setScreen: (s) => setScreen(s),
  // 0.8.17 side quests: a win pays (the Mint's sideQuest row) and files its stars; the coins fly to the purse on its page;
  // leaving goes back to the map at the vault's door
  sideWin: (key, stars) => { const before = save.wallet.coins, r = SQ.sideWin(save, key, stars); save.wallet = E.addCoins(save.wallet, r.coins); ledger('win'); persist(); purse.hold(before); return { ...r, before }; },
  sideCoins: (key) => SQ.sideCoins(save, key), sideStars: () => ({ have: SQ.sideTotal(save), max: SQ.SIDE_MAX }), drawCoin: (c, x, y, r, t) => drawCoin(c, x, y, r, t),
  coinsFly: (P, at) => { purse.gain({ from: P.before, src: at }); },
  leave: (side) => { if (G.theme) audio.music(G.theme.music); audio.setMaterial((G.level && G.level.material) || 'wood'); if (side) { G.world = side.w; G.sideFocus = side.w; G.mapTravel = null; setScreen('levels'); } else setScreen('extras'); },
  // 0.8.17 polish: a side quest's card, pause, win and fail pages are laid out with the road's own page kit (the win and
  // fail pages' full page and side stage, her stage, the art stage, the pause tiles, the purse), never a copy of it
  kit: { head: () => CARD_HEAD, page: (title, build, o = {}) => { const hb = G.hudBottom; G.hudBottom = ui.A.y; try { return stackCard(title, build, o); } finally { G.hudBottom = hb; } },
    side: () => cardSide(), stage: (sd, card) => { const hb = G.hudBottom; G.hudBottom = ui.A.y; try { return sideStage(sd, card); } finally { G.hudBottom = hb; } },
    henStage: (b, s, win) => henStage(b, s, win), artStage: (x, y, w, h, s, d) => artStage(x, y, w, h, s, d), tiles: (items, s, cols) => pauseTiles(items, s, cols),
    sunburst: (cx, cy, R, col, n) => sunburst(cx, cy, R, col, n), feathers: (a) => winFeathers(a), dim: (a) => dim(a), purse: () => purse } });

function themeFor(level) {
  return THEMES.find((t) => t.id === level.theme) || THEMES[(level.id - 1) % THEMES.length];
}

// 2026-11-16 (mykee: the screen hangs when a level is tapped): a level's backdrop is the heaviest thing a level start
// builds (several full-screen painted layers), so the last few are kept, and the level the player is most likely to
// tap next is built ahead while the home or map screen sits idle
const BD = new Map();
const BG_FORCE = DEV && typeof location !== 'undefined' ? new URLSearchParams(location.search).get('bg') : null;
// 0.8.10: the phone says memory is short (Android onTrimMemory, levels 10/15 while the game is on screen, 60/80 behind):
// every picture the screen in front does not need goes back now, instead of waiting until the system kills the page
function trimPictures(level) {
  try {
    stampSweep();
    MS.mapRelease(G.screen === 'levels' ? G.world : G.li >= 0 ? envOf(G.li) : -1);
    for (const [k, v] of [...BD]) if (v !== G.backdrop) { v.sz = ''; if (v.dispose) v.dispose(); BD.delete(k); }
    diag.note({ trim: level, fr: [cvStats.freed, Math.round(cvStats.mb)] });
  } catch (_) { /* never in the way of the game */ }
}
if (typeof window !== 'undefined') window.__eggTrim = trimPictures;
function backdropFor(theme, seed) {
  const key = theme.id + '|' + seed, sz = W_ + 'x' + H_ + '@' + DPR;
  let b = BD.get(key);
  if (b) BD.delete(key);
  else {
    b = createBackdrop(theme, seed);
    const r0 = b.resize; b.resize = (w, h, d) => { b.sz = w + 'x' + h + '@' + d; return r0.call(b, w, h, d); };
  }
  BD.set(key, b);
  // 0.8.10: two are kept (the level in play and the one built ahead), and one that leaves hands its pictures back at
  // once (about 25 MB each on a sharp screen; they used to wait for the garbage collector: render/cvfree.js)
  while (BD.size > 2) {
    let old = null;
    for (const [k, v] of BD) if (v !== b && v !== G.backdrop) { old = k; break; }
    if (old == null) break;
    const v = BD.get(old); BD.delete(old); v.sz = ''; if (v.dispose) v.dispose();
  }
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

// the egg skin worn in play (a free try counts) and its power (src/economy.js SKINS[id].perk, run by src/sim/perks.js)
const eggPerkId = () => DR.trialSkin(save) || E.equippedSkin(save.wallet);
const eggPerk = () => E.skinPerk(eggPerkId());

function startLevel(i, opts = {}) {
  if (G.sim && G.sim.state === 'failed' && G.level) G.fails[G.level.id] = 1; // allies (v3.5): help is offered after a fail
  G.allyOpen = G.allyAd = false;
  // leaving a level that was not won (quit, or gave up after a fail) ends the star streak
  if (G.sim && !G.result && G.sim.t > 1 && save.streak) { save.streak = 0; persist(); }
  G.run = (G.run || 0) + 1;
  G.li = i;
  if (i !== -2) G.demo = null; // 0.8.17: a practice vault played before does not follow into the road (it turned off the skip and the Pacer there)
  G.level = i === -2 && G.demo ? G.demo : i < 0 ? dailyLevel() : LEVELS[i]; // -2: a dev chick demo (v3.2)
  G.theme = themeFor(G.level);
  if (DEV && BG_FORCE) G.theme = THEMES.find((th) => th.id === BG_FORCE) || G.theme; // dev: ?bg=coop forces a level's backdrop theme
  G.boost = opts.boost || {};
  introAutoPick(G.level, i);
  G.sim = new Sim(G.level, { golden: !!opts.golden, mode: save.mode, ...G.boost, strike: strikeFor(G.level, i), perk: i === -2 ? null : eggPerkId() });
  releaseRings(G.sim.rings); stampSweep(); // 0.8.10: the last level's ring and prop pictures go back to the phone now (render/cvfree.js)
  MS.mapRelease(i >= 0 ? envOf(i) : -1); // and the map's pictures: only the played world's band waits for the way back
  G.sim.ringSpeed = ringSpeed();
  // portals explain themselves the first time they show up anywhere (a practice vault has no intro card)
  if (G.sim.portals.some((pt) => pt.pull || Math.hypot(pt.ax - pt.bx, pt.ay - pt.by) > 0.05) && !save.seen.portalTip) {
    save.seen.portalTip = 1; G.portalTip = 1;
  }
  G.introFoe = null; G.stkPick = null; G.stkWob = -9; G.stkFullT = 0; G.henAt = null; G.stkHint = null; G.stkHintN = 0;
  G.golden = !!opts.golden;
  G.adBoost = opts.adBoost || null;
  G.freeRewind = !!G.boost.rewind;
  perfNewLevel(save); // Auto's 30 fps fallback is decided again in each level
  G.backdrop = backdropFor(G.theme, G.level.id * 97);
  if (G.weather && G.weather.dispose) G.weather.dispose(); // 0.8.10: the last level's weather sprites go back
  G.weather = createWeather(G.level.weather || THEME_WEATHER[G.theme.id] || 'none', G.level.id * 31);
  G.weather.resize(W_, H_, DPR);
  W.setSkin(DR.trialSkin(save) || save.wallet.skin); // an egg skin on trial (the Director's win gift) is worn in play
  G.perkT = -9; // the HUD power chip pulses when the skin's power fires
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
  // level 1 until it is first won: the teaching hand drags the inner ring until the player has turned a ring, then
  // shows the next ring the same way whenever they stall for 4 s (drawKeyHint)
  G.teach = i === 0 && G.level.id === 1 && !bestStarsOf(1) ? { turns: 0, idle: 0, first: true, last: null } : null;
  G.hen = { mood: 'idle', t: 0 };
  G.fx = new FX();
  G.popups = [];
  G.toasts = [];
  G.toast = null;
  G.result = null;
  G.burstAt = null;
  G.usedRewind = false;
  G.goals = GL.levelGoals(G.level, G.sim.MD.fuse, i >= 0, G.sim.mode); G.goalOk = [true, true, true];
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
  audio.music({ ...G.theme.music, lvl: G.level.id, boss: !!G.level.bossFight }); // the world's tune, in this level's arrangement (a boss: faster, heavier drums)
  setScreen(opts.direct ? 'play' : 'intro');
  if (opts.direct) {
    portal.gameplayStart();
    audio.musicIntro(); // the world's short intro sting, then its loop
    toast(shortTip(G.level.tip), 3.2);
  }
}
// (0.8.14: the 4 s "Change ring speed and sound in Settings" toast is gone: nobody read it. The ring speed strip on the
// level cards of levels 2 to 5 and the mark on the Settings buttons do that job now.)

function setScreen(s) {
  if (G.screen === 'intro' && s !== 'intro' && G.toast) G.toast = null; // the level page's hints stay on the level page
  G.screen = s;
  G.screenT = 0;
  G.scrSeq = (G.scrSeq || 0) + 1; // a frozen backdrop (frozenBack) belongs to one visit of one screen
  G.offerTried = false; // each end card / home visit / intro may ask the offer engine once
  if (s !== 'title') G.homeIntro = false; // the app-start entrance plays once; coming back to home only fades in
  ui.pressedId = null;
  if (s !== 'play' && s !== 'pause' && s !== 'info') hudLayersFree(); // the HUD's still layers (hudLayer) are for play
  if (s === 'fail') G.fscroll = { y: 0, v: 0, max: 0, t: G.t }; // the fail page scrolls only on a short screen
  if (s === 'title' || s === 'levels') { warmNext(); audio.music(MAIN_THEME); } // home and the map play the main theme
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
  // 0.8.15: a tip is never cut in the middle of a sentence (33 tips ended like "...carry a bomb away from your").
  // Up to 84 letters (two lines on a phone) it stays whole; a longer one ends at its last comma or colon before that,
  // or keeps only its opening sentence; failing both it stays whole on three lines
  if (q.length > 84) {
    const c = q.slice(0, 84), i = Math.max(c.lastIndexOf(','), c.lastIndexOf(':'), c.lastIndexOf(';'));
    if (i >= 30) q = c.slice(0, i) + '.';
    else if (ss[0].length <= 84 && ss[0].length >= 22) q = ss[0];
  }
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
  G.popups.push({ x: s.x, y: s.y, text, key, n: 1, sub: o.sub || '', color: o.color || '#fff', life: o.life || 1.3, max: o.life || 1.3, size: (o.size || 26) * ui.u, placed: false, down: !!o.down });
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
  if (sim.band) hds.push(sim.bandHead(sim.band)); // 0.8.17 bandit
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
  // a small vault (level 1) is narrower than the basket with the hen beside it: the whole-vault shot widens to hold
  // both, so the first thing a new player sees is the hen at her basket (2026-11-20: she stood off screen)
  let cx = 0;
  if (all && !sim.water && !sim.nestAmp && sim.nestX0 != null) {
    const l = Math.min(-R, sim.nestX0 - sim.nestW / 2 - 0.25), r = Math.max(R, sim.nestX0 + sim.nestW / 2 + 1.5);
    if (r - l > 2 * R + 1e-6) { R = (r - l) / 2; cx = (l + r) / 2; }
  }
  const k = Math.min((P.w - 2 * m) / (2 * R), (P.h - 2 * m) / (yMax - yMin), 190);
  return { x: cx, y: (yMin + yMax) / 2, k, R, yMin, yMax };
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
  const F = frameOf(true, maxCh);
  // 0.8.11 tablets (mykee: "people could download the APK on a tablet"): on a big screen the whole vault already shows
  // the eggs larger than a phone's close-up does, so the camera rests on the whole vault there, basket and hen in the
  // shot, instead of pushing in and cropping the rings (measured: 1280x800 lost the basket, 800x1280 the outer ring).
  // Steady once the fit reaches TABLET_K px per metre, and until it falls clearly below (no flicker at the line).
  cv.steady = Math.min(W_, H_) >= TABLET_MIN && F.k >= (cv.steady ? TABLET_K * 0.9 : TABLET_K);
  const whole = !live || sky || camWide() || cv.steady || maxCh >= n - 1 || (sim.nestAmp && maxCh >= n - 2) || n <= 2;
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

// nest.reach: while the hen is out with the basket (or an egg is about to drop to her) keep her run in the shot: from
// the basket's far rim to the hen, both where they are and where she is running to. [left, right, extra pan room, dir]
const RZ = [{ x: 0, y: 0 }, { x: 0, y: 0 }, 0, 0];
function reachZone(sim, L) {
  if (!sim.reach || (L.ch < sim.rings.length - 1 && sim.hr.mode === 'idle')) return null;
  const H = sim.hr, X0 = sim.nestX0, n = sim.nest.getPosition(), to = H.mode === 'run' ? H.tx : H.x;
  const hen = G.henAt ? G.henAt.x - n.x + 0.4 * (G.henAt.s || 1) : sim.nestW / 2 + 1.3;
  RZ[0].x = X0 + Math.min(H.x, to) - sim.nestW / 2 - 0.15; RZ[0].y = sim.nestY;
  RZ[1].x = X0 + Math.max(H.x, to) + hen; RZ[1].y = sim.nestY + 1.1;
  RZ[2] = Math.max(Math.abs(H.x), Math.abs(to)) + 0.5; RZ[3] = Math.sign(to - H.x) || Math.sign(H.x);
  return RZ;
}
// after the frame is settled: slide it (no zoom) so the run is in it, the side she runs to first
function reachPan(T, rz) {
  const hw = G.play.w / (2 * T.k), a = rz[0].x - 0.2, b = rz[1].x + 0.25;
  if (b - a <= 2 * hw) T.x = clamp(T.x, b - hw, a + hw);
  else T.x = rz[3] < 0 ? a + hw : b - hw;
}

// The director: where the camera wants to be. Shots, in order: the win push-in on nest and hen, the level's
// establishing shot (wide, or on the boss), the last egg's approach, then the base frame leaning toward the action.
// A player zoom (buttons, wheel, pinch) overrides the leaning; reduced motion keeps the plain base frame.
function camTarget() {
  const sim = G.sim;
  if (!sim) return { x: 0, y: 0, k: 60 };
  const cv = G.cv, B = camBase(), F = cv.F, P = G.play, gy = sim.gy || 1;
  cv.smooth = 0.4;
  if (fuseIntroOn() && !sim.water) { // the fuse intro needs the spark (the top of the vault) in the shot, on a wide screen too
    const top = sim.outerR + 0.8, bot = B.y - P.h / (2 * B.k);
    if (B.y + P.h / (2 * B.k) < top) { const k = Math.min(B.k, P.h / (top - bot)); cv.smooth = 0.2; return { x: B.x, y: top - P.h / (2 * k), k }; }
  }
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
  if (sim.rings.length <= 2) { cv.smooth = 0.5; return B; } // a two-ring vault is one steady shot: rings, basket and hen
  if (camWide() || cv.steady) { cv.smooth = 0.5; return B; } // landscape, or a tablet: a steady whole-vault shot, no hunting
  const L = leadEgg(sim);
  if (!L) return B;
  // the last egg needed is on its way out: lean in on it and the nest (gently; never while something hunts overhead)
  const need1 = (sim.level.target || 1) - sim.savedLog.length === 1, n = sim.rings.length;
  if (need1 && L.ch >= n - 1 && !cv.sky && !boss && !sim.nestAmp) {
    const nest = sim.nest.getPosition(), out = L.ch >= n;
    const T = { x: lerp(L.x, nest.x, 0.5), y: lerp(L.y, nest.y, 0.5) + 0.3 * gy, k: Math.min(F.k * (out ? 1.32 : 1.12), 190) };
    cv.smooth = 0.5;
    const rz = reachZone(sim, L);
    const T2 = keepInView(T, [...eggPts, { x: nest.x - sim.nestW / 2, y: nest.y - 0.2 * gy }, { x: nest.x + sim.nestW / 2 + (sim.water ? 0 : 1.3), y: nest.y + 0.9 * gy }], 0.5);
    if (rz) { reachPan(T2, rz); if (sim.hr.mode !== 'idle') cv.smooth = 0.3; }
    return T2;
  }
  // 2026-11-15 action cam (mykee: "no in-game camera movement"): during play the camera follows the action on its own:
  // it pushes in (up to ACTION_ZOOM) on the lead egg and the gap it is heading for, and pulls back out just enough to
  // keep every egg and any villain close to an egg in the shot. While a finger holds a ring the shot holds still, so the
  // ring never slides under the finger. Pinch and the zoom buttons still take over (G.zm), reduced motion keeps it still.
  if (!cv.sky && !boss && !sim.kc && !sim.water) { // bosses, the King Crab and the sea keep their framed shots
    if (sim.rings.some((r) => r.held || r.keyHeld) && cv.lastAct) return cv.lastAct;
    const fx0 = lerp(L.x, L.gx, 0.4), fy0 = lerp(L.y, L.gy, 0.4);
    const pts = [...eggPts], rz = reachZone(sim, L);
    if (sim.stkTargets) for (const v of sim.stkTargets()) if (eggPts.some((p) => Math.hypot(p.x - v.x, p.y - v.y) < 2.6)) pts.push({ x: v.x, y: v.y });
    const k0 = Math.min(F.k * ACTION_ZOOM, 190);
    let T = keepInView({ x: lerp(F.x, fx0, 0.6), y: lerp(F.y, fy0, 0.6), k: k0 }, pts, 0.85);
    T.k = Math.max(T.k, F.k); // never wider than the whole vault
    // never show empty space past the vault when it could show vault instead
    const hw = P.w / (2 * T.k), hh = P.h / (2 * T.k);
    const mx = Math.max(0, F.R + 0.4 + (rz ? rz[2] : 0) - hw);
    T.x = clamp(T.x, F.x - mx, F.x + mx);
    if (F.yMax - F.yMin > 2 * hh) T.y = clamp(T.y, F.yMin + hh, F.yMax - hh); else T.y = (F.yMin + F.yMax) / 2;
    cv.smooth = 0.9; // slow and soft: a camera operator, not a chase cam
    if (rz) { reachPan(T, rz); if (sim.hr.mode !== 'idle') cv.smooth = 0.3; } // nest.reach: keep up with the hen's run
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
  const T3 = keepInView({ x: B.x + dx, y: B.y + dy, k: B.k }, eggPts, 0.5), rz3 = reachZone(sim, L);
  if (rz3) { reachPan(T3, rz3); if (sim.hr.mode !== 'idle') cv.smooth = 0.3; } // nest.reach (a boss level too)
  return T3;
}
const TABLET_MIN = 600, TABLET_K = 36; // a screen at least 600 px on its short side; the whole vault fits at 36 px a metre or more (a phone's close-up of a six-ring vault is 34 to 38)
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
  focusEnd(G.sscroll); focusEnd(G.setpage); // any touch: the ring and the hand let go
  if (!G.adBusy && G.detail && !G.got && G.dscroll && G.detail === 'iap:' + G.dscroll.key && G.dscroll.max > 0 && G.dlRect && x >= G.dlRect.x && x <= G.dlRect.x + G.dlRect.w && y >= G.dlRect.y && y <= G.dlRect.y + G.dlRect.h) { // the bundle sheet's list scrolls under a finger
    const D = G.dscroll; G.pdrag = { pid: e.pointerId, sc: D, y0: y, s0: D.y, moved: false, last: y, lt: performance.now(), v: 0, smp: [] }; D.v = 0; D.to = null;
  }
  if (G.adBusy || modalOpen()) { if (id) { ui.pressedId = id; G.pressPointer = e.pointerId; } return; } // a sheet or popup takes every tap (and an ad wait: only its "Back to game")
  const SC = G.settingsOpen && G.setpage ? G.setpage : G.screen === 'practice' ? G.pscroll : G.screen === 'extras' ? G.escroll : G.screen === 'info' ? G.iscroll : G.screen === 'store' ? G.sscroll : G.screen === 'pause' ? (G.ppRectR && x >= G.ppRectR.x ? G.ppageR : G.ppage) : G.screen === 'fail' && G.fscroll && G.fscroll.max > 0 ? G.fscroll : null;
  if (SC) G.pdrag = { pid: e.pointerId, sc: SC, y0: y, s0: SC.y, moved: false, last: y, lt: performance.now(), v: 0, smp: [] };
  if (SC && G.settingsOpen && /^rs:\d+$/.test(id || '')) Object.assign(G.pdrag, { bar: true, x0: x }); // the ring speed bar: a sideways drag slides it, an up/down one scrolls the page
  if (G.screen === 'intro') { // 2026-11-19 level page: the page scrolls up/down, the chick row left/right (the first clear move picks)
    const inR = (R) => R && x >= R.x && x <= R.x + R.w && y >= R.y && y <= R.y + R.h;
    const land = ui.A.w > ui.A.h * 1.15, cx = inR(G.carRect) && G.car && G.car.max > 0 ? G.car : null;
    const cy = inR(G.ipRect) && G.ipage && G.ipage.max > 0 ? G.ipage : land && inR(G.ipRectR) && G.ipageR && G.ipageR.max > 0 ? G.ipageR : null;
    if (cx || cy) G.pdrag = { pid: e.pointerId, cand: { x: cx, y: cy }, x0: x, y0: y, s0: 0, moved: false, last: y, lt: performance.now(), v: 0, smp: [] };
  }
  if (G.shopHand) G.shopHand = null; // the shop hand (map) goes on any tap; the tap itself still does its job
  if (G.screen === 'levels' && G.mapTravel && !G.treasure) G.mapTravel = null; // a touch during the trip: the map is the player's now (not while the boss treasure sheet is up: the trip goes on after it)
  if (G.screen === 'levels' && !G.settingsOpen && y > levelPageTop()) G.pdrag = { pid: e.pointerId, sc: G.mscroll, y0: y, s0: G.mscroll.y, moved: false, last: y, lt: performance.now(), v: 0, smp: [] }; // the world map scrolls by drag; a tap on a stop still presses
  // 0.8.7: a finger put on a list that is still gliding catches it there (it used to keep sliding under the finger
  // until the finger moved), and that touch does not also press the button it happened to land on
  if (G.pdrag) { const pd0 = G.pdrag; for (const q of [pd0.sc, pd0.cand && pd0.cand.x, pd0.cand && pd0.cand.y]) if (q) { if (Math.abs(q.v) > 90) pd0.caught = true; q.v = 0; q.to = null; } if (pd0.caught) return; }
  if (G.screen === 'play' && fuseIntroSkip()) { G.pdrag = null; return; } // a tap skips the fuse intro (and does nothing else)
  if (id) { ui.pressedId = id; G.pressPointer = e.pointerId; return; }
  if (G.screen === 'info') { const C = G.infoCard; if (C && (x < C.x || x > C.x + C.w || y < C.y - 10 * ui.u || y > C.y + C.h + 6 * ui.u)) { G.pdrag = null; press('info:close'); } return; } // a tap off the card closes it
  if (G.screen === 'play' && G.toast && G.toast.tip && G.toastRect) { const R = G.toastRect; if (x >= R.x && x <= R.x + R.w && y >= R.y && y <= R.y + R.h) { G.toast.life = Math.min(G.toast.life, 0.2); return; } } // a tap on a villain tip puts it away
  if (G.screen === 'wonder') { wonder.pointerDown(e); try { canvas.setPointerCapture(e.pointerId); } catch (_) {} return; } // WONDER
  if (G.screen === 'title') {
    // hidden tester switch: tap the logo 7 times within 3 s to open (or lock again) every level and world
    const LR = ui.rects.find((r) => r.tag === 'title:logo');
    if (TESTER_OK && LR && x >= LR.x && x <= LR.x + LR.w && y >= LR.y && y <= LR.y + LR.h) {
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
  if (pd && pd.pid === e.pointerId && (G.settingsOpen || G.screen === 'practice' || G.screen === 'extras' || G.screen === 'info' || G.screen === 'levels' || G.screen === 'store' || G.screen === 'intro' || G.screen === 'pause' || G.screen === 'fail')) { // 0.8.7: the pause page was missing here, so it never scrolled under a finger (0.8.10: and Settings over the title, mykee: "users are not able to scroll it")
    if (pd.bar && (pd.scrub || (!pd.moved && Math.abs(x - pd.x0) > 9 * ui.u && Math.abs(x - pd.x0) > Math.abs(y - pd.y0)))) { // the speed bar follows the finger sideways
      if (!pd.scrub) { pd.scrub = pd.moved = true; ui.pressedId = null; }
      const b = ui.buttons.find((q) => /^rs:\d+$/.test(q.id) && x >= q.x && x < q.x + q.w), L = ui.buttons.filter((q) => /^rs:\d+$/.test(q.id));
      const id = b ? b.id : L.length ? (x < L[0].x ? L[0].id : L[L.length - 1].id) : null;
      if (id && RING_SPEEDS[+id.slice(3)] !== ringSpeed()) press(id);
      return;
    }
    if (!pd.moved && pd.cand) { // the level page: two scrollers under the finger, the first clear move picks the axis
      const dx = x - pd.x0, dy = y - pd.y0;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 9 * ui.u) {
        const ax = Math.abs(dx) > Math.abs(dy) ? (pd.cand.x ? 'x' : null) : (pd.cand.y ? 'y' : null);
        if (!ax) { G.pdrag = null; return; }
        pd.ax = ax; pd.sc = pd.cand[ax]; pd.moved = true; ui.pressedId = null; pd.y0 = ax === 'x' ? x : y; pd.s0 = grab(pd.sc, scrollLim());
      }
    } else if (!pd.moved && Math.abs(y - pd.y0) > 9 * ui.u) { pd.moved = true; ui.pressedId = null; pd.y0 = y; pd.s0 = grab(pd.sc, scrollLim()); } // no jump by the 9 px slop
    if (pd.moved) {
      // 2026-11-19 (mykee: "the scroll is so slow"): the fling speed is the finger's speed over its last ~100 ms (every
      // coalesced touch point counts), not a smoothed per-event guess that lagged behind a quick flick
      // (pd.ax 'x': a sideways row; its offset still lives in sc.y and pd.y0 holds the start x)
      const hx = pd.ax === 'x', c = hx ? x : y;
      const now = performance.now(), pts = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      if (pts.length) for (const q of pts) pd.smp.push([hx ? q.clientX : q.clientY, q.timeStamp || now]); else pd.smp.push([c, now]);
      while (pd.smp.length > 2 && now - pd.smp[0][1] > 100) pd.smp.shift();
      pd.last = c; pd.lt = now;
      dragTo(pd.sc, pd.s0 + pd.y0 - c, scrollLim()); // follows the finger; past an end it stretches (scroll.js)
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
  if (pd && pd.pid === e.pointerId) { if (pd.moved && pd.sc && !pd.scrub) pd.sc.v = flingSpeed(pd); G.pdrag = null; }
  if (G.screen === 'wonder') wonder.pointerUp(e); // WONDER
  const ct = G.chickTap; // v3.2: tap = power
  if (ct && ct.pid === e.pointerId && Math.hypot(e.clientX - ct.x, e.clientY - ct.y) < 14 * ui.u && G.t - ct.t < 0.45 && G.sim) { G.sim.tapChick(ct.id); buzz('chick'); }
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
  if (G.detail && G.dscroll && G.detail === 'iap:' + G.dscroll.key && G.dscroll.max > 0 && !G.got) { e.preventDefault(); G.dscroll.y = clamp(G.dscroll.y + clamp(e.deltaY, -400, 400), 0, G.dscroll.max); G.dscroll.v = 0; return; }
  if (modalOpen()) return;
  const SC = G.settingsOpen && G.setpage ? G.setpage : G.screen === 'practice' ? G.pscroll : G.screen === 'extras' ? G.escroll : G.screen === 'info' ? G.iscroll : G.screen === 'store' ? G.sscroll : G.screen === 'levels' ? G.mscroll : G.screen === 'pause' ? (G.ppRectR && e.clientX >= G.ppRectR.x ? G.ppageR : G.ppage) : G.screen === 'fail' && G.fscroll && G.fscroll.max > 0 ? G.fscroll : G.screen === 'intro' ? (e.shiftKey && G.car ? G.car : G.ipRectR && ui.A.w > ui.A.h * 1.15 && e.clientX >= G.ipRectR.x ? G.ipageR : G.ipage) : null;
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
  if (modalOpen()) { if (k === 'Escape') { if (G.got) press('got:tap'); else if (G.party) press(G.party.phase === 'show' ? 'party:tap' : 'party:close'); else if (G.parent) G.parent = null; else if (G.waitList) G.waitList = null; else if (G.getMore) G.getMore = null; else if (G.chickBuy) G.chickBuy = null; else if (G.detail) G.detail = null; else if (G.offer) press('of:no'); else if (G.leaveAsk) press('leave:stay'); else if (G.treasure) G.treasure = null; else if (G.skipAsk) G.skipAsk = null; else if (G.stuckAsk) press('stuck:no'); } return; }
  if (G.screen === 'info' && !e.repeat && (k === 'Escape' || k === 'i' || k === 'I' || k === 'Enter' || k === ' ')) { press('info:close'); return; } // the "i" panel
  if (G.screen === 'info' && (k === 'ArrowDown' || k === 'ArrowUp' || k === 'PageDown' || k === 'PageUp')) { const S = G.iscroll, d = (k.startsWith('Page') ? 0.8 * H_ : 60 * ui.u) * (k.endsWith('Up') ? -1 : 1); S.y = clamp(S.y + d, 0, S.max); S.v = 0; return; }
  if ((k === 'i' || k === 'I') && !e.repeat && (G.screen === 'play' || G.screen === 'pause')) { press('info'); return; }
  if (k === 'Escape' && !e.repeat && G.settingsOpen) { press('set:close'); return; }
  if ((k === 'Escape' || k === 'p' || k === 'P') && !e.repeat) {
    if (G.screen === 'play') press('pause');
    else if (G.screen === 'pause') press('resume');
    else if (k === 'Escape' && (G.screen === 'practice' || G.screen === 'extras')) press('back');
    else if (k === 'Escape' && G.screen === 'spin') press('spin:back');
    else if (k === 'Escape' && G.screen === 'wonder') wonder.back();
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
  if (DIAG_MARK.test(id)) diag.mark(id); // the speed log: a hitch right after one of these names it
  { const k = tallyKey(id); if (k) ENG.tally.took(save, k); }
  ledger(ledWhy); ledWhy = ledWhyOf(id); // what changed before this press is filed under the last reason; what this press changes, under its own
  { const b = ui.buttons.find((q) => q.id === id); if (b && b.w < ui.w * 1.5) G.pressAt = { x: b.x + b.w / 2, y: b.y + b.h / 2 }; } // coins a press brings fly from its button (purse.gain)
  audio.play(id === 'pause' || id === 'levels' || id === 'practice' ? 'ui_back' : 'ui_tap');
  prizePop.skip(); // a video's little celebration goes on its way at a tap (0.8.17)
  if (G.screen === 'intro' && G.level && G.li >= 0 && /^(boost:|adboost$|shop:boosts$|strip:more$|strip:back$)/.test(id) && !(save.seen || {})['strip:' + G.level.id]) { save.seen = { ...save.seen, ['strip:' + G.level.id]: 1 }; persist(); } // the booster strip was touched: its call for attention rests on this level for good
  if (id.startsWith('foe:')) { const k = id.slice(4); G.introFoe = G.introFoe === k ? null : k; return; } // intro: a villain portrait opens its one-line card
  if (id.startsWith('wait:go:')) { await waitClaim(id.slice(8)); return; } // 0.8.17: one waiting reward, one video
  if (id.startsWith('xs:') || (id === 'set:close' && G.setSub) || (id === 'back' && G.album && G.screen === 'extras')) { await xsPress(id); return; } // 0.8.17: the combo album, Settings' privacy / reset / footer (xsPress)
  switch (id) {
    case 'ad:back': ads.cancelWait(); break; // an ad that never said it closed: back to the game (no reward)
    case 'zoom:in': setZoom((G.zm || 0) + 0.34); break;
    case 'zoom:out': setZoom((G.zm || 0) - 0.34); break;
    case 'zoom:auto': G.zm = null; break;
    case 'strike': fireStrike(); break; // Chick Strike
    case 'bank': if (G.screen === 'play' && G.sim && G.sim.fireBanked()) audio.play('unlock', { pitch: 1.3 }); break; // a saved chick's kept power
    case 'stk:gotit': { const id = G.stkCard; save.strikeSeen = { ...(save.strikeSeen || {}) }; for (const S of strikesOpen()) if (S.id !== DR.trialChick(save)) save.strikeSeen[S.id] = 1; /* a chick on free try still gets its own card when it really joins */ if (id) { G.stkSel = { lid: G.level.id, id }; G.sim.stkEquip(strikeFor(G.level, G.li)); } G.stkCard = null; persist(); break; }
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
        if (ok) { G.allyAd = true; popPrize('Farm friend', (c, x, y, S, t) => drawPart(c, 'ally', x, y, S, t), 'btn:ally', 0.3); } // (the friends' menu opens on the ally button it flies to)
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
      if (G.screen === 'title' && firstRun()) { portal.gameplayStop(); startLevel(0, { direct: true }); break; } // first launch: PLAY is level 1, playing
      // 2026-11-20 (mykee: "people wouldn't even look at the map"): home's PLAY opens the map, Angry Birds style, with
      // the hen at the next level; one more tap there opens the level page
      const i = nextIdx();
      portal.gameplayStop();
      G.world = envOf(i); G.mapTravel = null; G.toasts = []; G.toast = null;
      setScreen('levels');
      break;
    }
    case 'leave:stay': G.leaveAsk = null; if (G.screen === 'pause') await press('resume'); break;
    case 'leave:go': { const to = G.leaveAsk && G.leaveAsk.to; G.leaveAsk = null; if (to) await press(to); break; }
    case 'levels':
      if (leaveAsk('levels')) break;
      portal.gameplayStop();
      if (G.screen !== 'title' && G.demo && G.level === G.demo) { setScreen('practice'); break; } // a practice vault goes back to the Practice screen, where it was opened
      G.world = clamp(envOf(nextIdx()), 0, Math.ceil(LEVELS.length / ROAD.PER_ENV) - 1);
      setScreen('levels');
      break;
    case 'go': {
      // The first two levels with a choice of chicks (level 13 for every player) ask the player to tap one (mykee,
      // 2026-11-24: "provide the opportunity for the user to tap on the chick rather than defaulting"). Until 0.8.12
      // PLAY only sent them to the Chicks tab with a 2 s toast: a tester's log shows 105 taps on PLAY over three app
      // starts and no level 13. Now the button itself says PICK A CHICK, a hand taps the chicks, a refused tap makes
      // them jump, and the third refused tap takes the newest chick along so the card can never be a dead end.
      if (G.screen === 'intro' && introChicks().need) {
        const A = G.pickAsk && G.pickAsk.lid === G.level.id ? G.pickAsk : (G.pickAsk = { lid: G.level.id, n: 0, t: 0 });
        A.n++; A.t = G.t;
        if (A.n < 3) {
          G.itab = 'chicks'; if (G.ipage) { G.ipage.y = 0; G.ipage.v = 0; G.ipage.to = null; } // the Chicks tab (0.8.14: on a phone on its side too)
          audio.play('cluck', { pitch: 0.8, vol: 0.5 });
          toast('Tap a chick first', 2.4); break;
        }
        const open = strikesOpen(), S = open[open.length - 1];
        G.toasts = []; G.toast = null; // (the nudge's own toast goes with it)
        G.stkSel = { lid: G.level.id, id: S.id }; G.introPick = { id: S.id, t: G.t, lid: G.level.id };
        G.sim.stkEquip(strikeFor(G.level, G.li));
      }
      { const T = introChicks(); if (T.id) { save.lastStk = T.id; if (T.choice) save.seen.pickN = (save.seen.pickN || 0) + 1; persist(); } }
      if (worldOpener(G.level)) { save.intro[G.level.id] = 1; persist(); }
      pacerGo(); // the level card's dare: taken or declined (the Pacer)
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
      const hot = G.li >= 0 && !(G.dare && G.dare.kind === 'noboost') ? DR.hotBoosts(save).filter((b) => !boost[b]) : []; // (a "no boosters" dare takes the streak's free ones' place)
      for (const b of hot) { boost[b] = true; picked++; }
      const pg = !(G.dare && G.dare.kind === 'noboost') ? pacerRetry() : {}; // the Pacer's free booster after "Keep trying", when he comes back by the level card
      for (const b of Object.keys(pg.boost || {})) if (!boost[b]) { boost[b] = true; picked++; }
      if (picked) {
        persist();
        startLevel(G.li, { direct: true, golden: G.golden || boost.golden, boost, adBoost: G.adBoost });
        if (pg.boost) pacerGiftPop(pg.boost);
        if (hot.length) toast(`Win streak ${DR.hotCount(save)}: free ${hot.map((b) => E.BOOSTERS[b].name).join(' + ')}!`, 3);
        break;
      }
      if (G.li >= 0 && G.level) ENG.levelStart(save, { levelId: G.level.id, hard: isHardLevel(G.level) }); // the Oracle notes its guess for this try
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
      { const pid = id.slice(9), cur = G.sim.stk && G.sim.stk.id; G.stkSel = { lid: G.level.id, id: cur === pid && strikesOpen().length < 2 ? null : pid }; G.introPick = { id: pid, t: G.t, lid: G.level.id }; } // a lone chick toggles; with a choice, a tap picks
      G.sim.stkEquip(strikeFor(G.level, G.li));
      audio.play('cluck', { pitch: 2.2, vol: 0.5 });
      break;
    case 'gotit':
      save.intro[G.level.id] = 1;
      persist();
      break;
    case 'shop':
    case 'store': { // 0.8.14: with the shop mark on, the shop opens on the thing the coins now reach, with a ring on it
      const M = shopMarkNow();
      G.shopHand = null;
      if (M.pick && (M.on || G.screen === 'pause')) openStoreOn(M.pick.key); else openStore('deals'); // (the pause page's banner names the pick: it opens on it)
      break;
    }
    case 'win:shop': // the win card's "New in shop" chip: the shop, on the thing this win's coins reach
      if (G.result && G.result.mark) openStoreOn(G.result.mark);
      break;
    case 'shop:boosts': // the level card's empty booster well: the shop's Boosts row
      openStore('boosters', 'boosts');
      break;
    case 'home': // back to the title from the shop or the pause card (the level in progress is left)
      if (leaveAsk('home')) break;
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
      const R = E.dailyChest(today()), src = G.pressAt;
      save.wallet = w; persist(); audio.play('treasure_open'); void src;
      if (G.screen === 'store') G.storeFlash = { id: 'free:daily', t0: G.t }; // the shop's FREE TODAY tile
      // 0.8.17: a YOU GOT! of its own (it was a toast while the coins flew to a purse at the bottom of home): the open
      // chest, the coins landing in the purse chip on the page, the charges in the bag chip
      startGot({ name: 'Daily chest', art: 'chest', quiet: true, coins: R.coins, items: [{ art: 'coins', label: '+' + R.coins }, { art: 'charge', label: `+${R.charges} Chick Charge${R.charges > 1 ? 's' : ''}` }] });
      break;
    }
    case 'home:premium': // 0.8.17: straight onto the Unlock Everything page (it was the shop, then its card, then the page)
      openStore('deals', 'iap:' + PREMIUM_SKU); G.detail = 'iap:' + PREMIUM_SKU; G.payBack = true;
      break;
    case 'home:charge': { // Premium's free Chick Charge of the day
      const w = E.claimPremiumCharge(save.wallet, today());
      if (w) { save.wallet = w; persist(); audio.play('unlock'); toast('Your free Chick Charge for today. Thank you for Premium!', 2.8); }
      break;
    }
    case 'gate:0': case 'gate:1': case 'gate:2': case 'gate:3': case 'gate:4': case 'gate:5': case 'gate:6': case 'gate:7': case 'gate:8': case 'gate:9': {
      const k = +id.slice(5), B = MINT.gateBuy(k, { stars: bestTotal(), perEnv: PER_ENV, coins: save.wallet.coins, open: envOpen, bossPassed: envBoss }), price = B.price;
      if (B.why === 'open') break;
      if (B.why === 'order') { audio.play('ui_back'); toast(envOpen(k - 1) ? `Beat the boss of ${WORLDS[k - 1] || 'the world before'} first` : `Open ${WORLDS[k - 1] || 'the world before'} first`, 2.4); break; } // nothing is taken
      if (!B.ok) { needCoins(price); break; }
      save.wallet = { ...save.wallet, coins: save.wallet.coins - price };
      save.gates = { ...(save.gates || {}), [k]: 1 };
      persist(); // 0.8.17: the map opens its gate on screen (padlock, gate, fog, sign) with its own sounds, no toast
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
    case 'wait:open': // 0.8.17: the gift mark (map, home): the rewards that waited for a connection
      G.waitList = { t0: G.t }; audio.play('hud_pop', { vol: 0.8 });
      break;
    case 'wait:close':
      G.waitList = null;
      break;
    case 'dt:close': // a pay page opened from outside the shop (Home, Settings, an offer) goes back where the player was
      if (G.payBack && G.detail && G.detail.startsWith('iap:')) { G.detail = null; G.payBack = false; await press('back'); break; }
      G.detail = null;
      break;
    case 'help:go': await takeHelp(); break;
    case 'nudge:no': if (G.nudge && G.nudge.kind === 'keep') DR.clearKeepAsk(save, G.nudge.what); G.nudge = null; persist(); break;
    case 'nudge:yes': {
      const n = G.nudge;
      if (!n) break;
      if (n.kind === 'keep') {
        const hen = n.what === 'hen', w = hen ? E.buyHenSkin(save.wallet, n.id) : E.buySkin(save.wallet, n.id);
        if (!w) { needCoins(n.price); break; }
        save.wallet = w; DR.clearKeepAsk(save, n.what); if (!hen) W.setSkin(w.skin); G.nudge = null; persist();
        startGot({ name: hen ? n.name : n.name + ' egg', key: (hen ? 'hen:' : 'skin:') + n.id, items: [], line: hen ? 'Your hen wears it now' : 'On your eggs now' }); // 0.8.17: the reveal, worn
      } else if (n.kind === 'welcome') {
        const b = E.BOOSTER_ORDER[Math.floor(Math.random() * 5)];
        save.wallet = { ...save.wallet, coins: save.wallet.coins + n.coins, owned: { ...(save.wallet.owned || {}), [b]: ((save.wallet.owned || {})[b] || 0) + 1 } };
        G.nudge = null; persist(); audio.play('level_win'); G.remWelcome = G.t + 3.2; // then, at this happy moment, perhaps the reminder question
        startGot({ name: 'Welcome back!', art: 'coins', quiet: true, coins: n.coins, items: [{ art: 'coins', label: '+' + n.coins }, { art: 'boost:' + b, label: E.BOOSTERS[b].name }] }); // 0.8.17: shown, not a toast
      } else if (n.kind === 'afford') {
        G.nudge = null; persist();
        openStoreOn(n.item); // straight onto that chick or egg, with a ring on it
      }
      break;
    }
    case 'of:no': // "No thanks" on an offer
      if (G.offer) { OF.markDismissed(save, G.offer, Date.now(), G.offer.lv); BR.note(save, 'no', { id: G.offer.id }); if (!G.offer.sku) BR.note(save, 'videoNo'); persist(); }
      G.offer = null;
      break;
    case 'of:buy': {
      const O = G.offer;
      G.offer = null;
      if (O) BR.note(save, 'yes', { id: O.id });
      if (O && O.id === 'skip_videos') { openStore('deals', 'iap:' + PREMIUM_SKU); G.detail = 'iap:' + PREMIUM_SKU; G.payBack = true; } // a look at what it gives, never a payment from the card
      else if (O && O.sku) await buyIap(O.sku);
      break;
    }
    case 'of:ad': { // a rewarded offer: a free Chick Charge, or free coins
      const O = G.offer;
      G.offer = null;
      if (!O) break;
      if (O.item === 'coins') { await press('ad:coins'); break; }
      if (await rewarded('charge')) {
        save.wallet = { ...save.wallet, charges: Math.min(E.MAX_CHARGES, save.wallet.charges + 1) };
        persist(); startGot({ name: 'Chick Charge', art: 'charge', what: 'Send your chick any time', items: [{ art: 'charge', label: '+1' }] }); // 0.8.17: it lands in the bag chip
      } else { OF.markDismissed(save, O, Date.now(), O.lv); BR.note(save, 'no', { id: O.id }); BR.note(save, 'videoNo'); persist(); } // no ad: counts as declined (the helper may follow later)
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
    case 'rem:yes': G.remAsk = null; remRequest('card'); break; // (Android's question, or the phone's settings page when it will not ask)
    case 'rem:no': // "Not now": the bell stays on the home and the map, and the question comes back at a happy moment in three days of play
      G.remAsk = null; ENG.herald.answer(save, false); BR.why(save, 'win', 'reminder', 'reminders: not now'); persist();
      break;
    case 'rem:later': G.remAsk = null; break; // the back key: the same as "Not now", without an answer
    case 'rem:chip': if (remChipOn()) remAskShow('chip'); break; // the bell with a slash: the question, whenever he wants it
    case 'set:remtest': remTest(); break;
    case 'set:remsys': try { appBridge().notifySettings(remSys() ? 'app' : 'battery'); } catch (_) { /* no shell */ } G.remFrom = remSys() ? 'sys' : null; break;
    case 'set:remind':
      if (remOn()) { ENG.herald.setOff(save, true); try { appBridge().notifyCancel(); } catch (_) { /* no shell */ } persist(); }
      else if (remPhone() === 'granted') { ENG.herald.answer(save, true); ENG.herald.setOff(save, false); persist(); audio.play('unlock'); toast('Reminders are on. One a day at most.', 2.8); }
      else remRequest('set');
      break;
    case 'pc:0': case 'pc:1': case 'pc:2': {
      const P = G.parent;
      G.parent = null;
      if (!P) break;
      if (P.q.choices[+id.slice(3)] === P.q.answer) { if (P.reset) xsOpen('reset1'); else await buyIap(P.sku, true); } // 0.8.17: or Reset progress
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
    case 'gm:shop': { // "Open shop": the coin packs on Deals (from inside the shop too), on the pack the sheet suggested
      const sku = G.getMore && G.getMore.sku; G.getMore = null;
      openStore('deals', sku && ads.moneyShop ? 'iap:' + sku : 'coins');
      break;
    }
    case 'gm:ad':
      await press('ad:coins');
      break;
    case 'ad:coins': {
      if (adCd() > 0) break;
      const fd = save.adDay && save.adDay.day === today() ? save.adDay.n | 0 : 0;
      const pay = adCoins(), src = G.pressAt, ok = await rewarded('coins', { kind: 'coins', n: pay, key: `free:${today()}:${fd}`, kept: () => { save.adClaim = Date.now(); save.adDay = E.noteFreeCoins(save.adDay, today()); } });
      if (ok) {
        save.wallet = E.addCoins(save.wallet, pay); void src;
        startGot({ name: 'Free coins', art: 'coins', quiet: true, coins: pay, items: [{ art: 'coins', label: '+' + pay }] }); // 0.8.17: a YOU GOT! with the purse on it: the video's coins land in front of the player
        save.adClaim = Date.now();
        save.adDay = E.noteFreeCoins(save.adDay, today());
        G.storeFlash = { id: 'ad', t0: G.t };
        persist();
        audio.play('combo', { intensity: 0.5 });
        if (G.getMore && save.wallet.coins >= G.getMore.price) G.getMore = null; // (the purse on the YOU GOT! says it)
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
        popPrize('Hint', (c, x, y, S) => lampIcon(c, x, y, S), null, 0.2); // then the hint shows on the board
      }
      break;
    }
    case 'tr:close': if (land.busy()) { land.finish(); break; } G.treasure = null; land.clear(); break; // (a tap while the coins fly lands them all; the next closes)
    case 'tr:open': { // the boss treasure: paid once, then the sheet shows what came out
      const T = G.treasure, w = T && bossBeaten(T.id) ? E.openBossTreasure(save.wallet, T.id) : null;
      if (w) { // its own cue (not the win sting); the coins follow the lid into the purse chip on the page, the booster and the charges into the bag chip (0.8.17)
        const c0 = save.wallet.coins, R = E.bossTreasure(T.id), at = (i) => { const q = ui.rects.find((r) => r.tag === 'tr:itemart' + i); return q ? { x: q.x + q.w / 2, y: q.y + q.h / 2 } : G.pressAt; };
        save.wallet = w; persist(); audio.play('treasure_open'); buzz('treasure'); T.openedAt = G.t;
        land.start({ from: c0, to: w.coins, src: at(0), delay: 0.35, items: [{ art: 'boost:' + R.booster, src: at(1), ...landWhere('boost:' + R.booster) }, { art: 'charge', src: at(2), ...landWhere('charge') }] });
      }
      break;
    }
    case 'tr:shop': G.treasure = null; land.clear(); openStore('boosters', 'premium'); break; // "See premium chicks": their row
    case 'tr:play': { const T = G.treasure; G.treasure = null; land.clear(); const i = LEVELS.findIndex((Lv) => Lv.id === T.id); if (i >= 0 && playable(i)) startLevel(i); break; }
    case 'chest': {
      const total = bestTotal();
      const ch = E.chestFor(total, save.wallet.chests), sk = ch && ch.reward.skin && !E.ownsSkin(save.wallet, ch.reward.skin) ? E.SKINS[ch.reward.skin] : null;
      const w = E.openChest(save.wallet, ch);
      if (w) { // 0.8.15: what came out is shown, not told (the same reveal a shop pack and a spin prize get): the egg skin or the
        // booster large, and each thing in the chest popping in under it while the coins fly to the purse
        const c0 = save.wallet.coins, gained = w.coins - c0, B = E.BOOSTERS[ch.reward.booster], gotB = E.ownedCount(w, ch.reward.booster) > E.ownedCount(save.wallet, ch.reward.booster);
        save.wallet = w; persist(); audio.play('treasure_open'); if (gained > 0) purse.hold(c0);
        startGot({ name: sk ? `${sk.name} egg` : 'Star chest', art: sk ? 'egg:' + ch.reward.skin : 'chest', quiet: true, coins: gained,
          items: [gained > 0 && { art: 'coins', label: '+' + gained }, gotB && B && { art: 'boost:' + ch.reward.booster, label: B.name }].filter(Boolean), line: sk ? 'Yours to keep' : 'Added to your bag' });
      }
      break;
    }
    case 'adboost': {
      // pre-level card (G24): a completed rewarded ad gives one free booster for this run, a different one per level
      const b = AD_BOOST[Math.abs(G.level.id) % AD_BOOST.length];
      const ok = await rewarded('booster');
      if (ok) {
        if (b === 'golden') startLevel(G.li, { golden: true, adBoost: b });
        else startLevel(G.li, { boost: { [b]: true }, adBoost: b });
        popPrize(E.BOOSTERS[b].name, (c, x, y, S, t) => drawBoosterIcon(c, b, x, y, S, t), ['btn:go', 'btn:inext'], 0.5); // 0.8.17: it pops, then flies onto PLAY (it comes along into the level)
      }
      break;
    }
    case 'pause':
      // once the level is decided the end card is coming: pausing then would strand the player
      if (G.screen === 'play' && G.sim.state === 'play') { setScreen('pause'); portal.gameplayStop(); releaseAll(); }
      else if (G.screen === 'intro') setScreen('levels');
      break;
    case 'stuck:ad': case 'stuck:ticket': case 'stuck:coins': // the Pacer's "Stuck? Skip this one": the fail card's own skip
      if (id === 'stuck:ad' && !ads.videoOk) { videoOff(null); break; } // no video now: the sad hen's line, as every video button; the pop-up stays (coins or Keep trying)
      G.stuckAsk = null;
      if (G.screen === 'fail') await skipGo(id.slice(6));
      break;
    case 'stuck:no': // "Keep trying": back to the fail page; the next try starts with a free booster
      if (G.stuckAsk && G.level) { ENG.pacer.declined(save, G.level.id); pacerWhy('fail', 'stuck:no', `kept trying on level ${G.level.id}`); persist(); }
      G.stuckAsk = null;
      break;
    case 'dare:chip': { // the level card's dare: a tap takes it, another tap puts it back
      const d = dareNow();
      if (!d || G.screen !== 'intro') break;
      d.took = !d.took; ENG.pacer.dareTake(save, G.level.id, d.took); persist();
      G.dareFx = { t0: G.t, on: d.took };
      audio.play(d.took ? 'fire_ignite' : 'ui_back', d.took ? { vol: 0.7 } : undefined); buzz('tap');
      break;
    }
    case 'pause:skip': // the pause page's Skip level: a small sheet first (what happens, one video, cancel)
      if (G.screen === 'pause' && skipNow()) G.skipAsk = { t0: G.t };
      break;
    case 'sk:no':
      G.skipAsk = null;
      break;
    case 'sk:go': // the pause sheet's button: a Skip Ticket if the player owns one, else the video
      G.skipAsk = null;
      if (G.screen === 'pause') await skipGo(skipWays()[0]);
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
    case 'retry': {
      portal.gameplayStop();
      if (id === 'retry' && G.screen === 'fail') { save.streak = 0; persist(); }
      if (id === 'restart' && G.screen === 'pause') pacerRestart(); // a restart that hides a loss counts as one (the Pacer)
      const po = id === 'retry' && G.screen === 'fail' ? pacerRetry() : {}; // the try after "Keep trying": one free booster
      startLevel(G.li, { direct: true, ...po });
      if (po.boost) pacerGiftPop(po.boost);
      break;
    }
    case 'next': {
      // 2026-11-20 (Google Play ad policy: no interstitial as a level begins, none between a tap and what it starts):
      // the between-levels break, when one is due, comes here, as the player leaves the score card, before the map
      if (G.adBusy) break;
      if (G.screen === 'win') await breakThen(() => {});
      const n = Math.min(LEVELS.length - 1, G.li + 1);
      if (G.li < 0) { setScreen(G.demo && G.level === G.demo ? 'practice' : 'title'); break; }
      if (G.li === LEVELS.length - 1) { setScreen('levels'); break; }
      if (!playable(n)) { const due = treasureDue(G.li); G.world = envOf(n); G.toasts = []; G.toast = null; setScreen('levels'); if (due) G.treasure = { id: due, t: G.t, openedAt: null }; break; } // the next environment waits behind its star gate (a boss treasure still shut opens first)
      // 2026-11-20 (mykee: show the map between stages): back to the map, the hen hops along the road to the next stop,
      // and its level page opens on arrival (a tap anywhere first stops the trip and leaves the map in the player's hands)
      portal.gameplayStop();
      G.world = envOf(n); G.mapTravel = { from: G.li, to: n, t0: -1 }; G.toasts = []; G.toast = null;
      setScreen('levels');
      break;
    }
    case 'skip:ad': // the fail card's Skip level (0.8.14: from the first loss): the same skip as the pause page's
    case 'skip:ticket':
    case 'skip:coins':
      if (G.screen === 'fail') await skipGo(id.slice(5));
      break;
    case 'rewind': {
      // a Free rewind booster pays for it; otherwise it is a rewarded ad
      const free = G.freeRewind;
      const ok = free || await rewarded('rewind');
      if (free) G.freeRewind = false;
      const back = ok && G.sim.rewind(REWIND_S);
      if (back) rewound(back);
      break;
    }
    case 'rewind:coins': { // Royal Match's continue: coins instead of a video, a little dearer each time on this level
      if (G.screen !== 'fail' || G.usedRewind || !G.sim.canRewind()) break;
      const lid = G.level.id, price = DR.rewindPrice((G.rewindBuys || {})[lid]);
      if (save.wallet.coins < price) { needCoins(price); break; }
      const back = G.sim.rewind(REWIND_S);
      if (!back) break;
      save.wallet = { ...save.wallet, coins: save.wallet.coins - price };
      G.rewindBuys = { ...(G.rewindBuys || {}), [lid]: ((G.rewindBuys || {})[lid] || 0) + 1 };
      persist();
      rewound(back);
      break;
    }
    case 'sample': { // 2026-11-20 shop 2.0, FREE TODAY: a boost never tried, free; once all are tried, today's boost for a video
      const S = E.sampleFor(save.wallet, today());
      if (S.done || (S.video && !(await rewarded('sample')))) break;
      const w = E.claimSample(save.wallet, today());
      if (!w) break;
      save.wallet = w; persist(); G.storeFlash = { id: 'free:sample', t0: G.t };
      startGot({ name: E.BOOSTERS[S.id].name, art: 'boost:' + S.id, what: E.BOOSTERS[S.id].line, items: [{ art: 'boost:' + S.id, label: '+1' }] }); // 0.8.17: into the bag chip, with how many
      break;
    }
    case 'bonus': { // the win card's Bonus chest (when an ad break would have been due): 40 coins and a boost for a video
      if (G.doubled || !G.result || !G.result.chest || !(G.li >= 0 && G.level)) break;
      const src = G.pressAt;
      if (!(await rewarded('bonus'))) break; // Premium: granted at once, no video (ads.rewarded)
      const R = E.bonusChest(G.level.id), first = !G.result.purseGo;
      save.wallet = E.openBonusChest(save.wallet, G.level.id); G.doubled = true; G.result.chestOpen = true; save.mint = MINT.winVideoTake(save.mint, today(), R.coins);
      recordResult(); persist();
      G.result.purseGo = true; void src; // (the win's own coins land with these, if their roll had not run yet)
      audio.play('treasure_open'); portal.happy();
      startGot({ name: 'Bonus chest', art: 'chest', quiet: true, coins: R.coins, coins0: first && G.result.purse0 != null ? G.result.purse0 : undefined, items: [{ art: 'coins', label: '+' + R.coins }, { art: 'boost:' + R.booster, label: E.BOOSTERS[R.booster].name }] }); // 0.8.17
      break;
    }
    case 'double': {
      if (G.doubled || (G.result && G.result.dblOk === false)) break;
      const dk = G.result && G.level ? (G.result.waitKey = G.result.waitKey || `double:${G.level.id}:${Date.now()}`) : '';
      const ok = await rewarded('double', dk && G.result.coins > 0 ? { kind: 'coins', n: G.result.coins, key: dk } : null);
      if (ok && dk) save.waiting = { ...WT.clean(save.waiting), list: waitingList().filter((it) => it.key !== dk) }; // doubled after all: nothing waits for it
      if (ok && G.result) {
        const r = G.result, a = r.coins || 0, first = !r.purseGo;
        G.doubled = true; save.mint = MINT.winVideoTake(save.mint, today(), a); // the Mint's win-video pot
        r.total *= 2;
        r.shownTotal = r.total;
        save.wallet = E.addCoins(save.wallet, a);
        r.coins *= 2;
        recordResult();
        // 2026-11-23 the doubling moment (drawWinCoins): "+30" on the card, a big x2 stamps onto it, the number rolls to
        // "+60" with a burst, then the purse rolls from the old total to the new one. The wallet is already paid.
        r.dbl = { t0: G.t, a, b: r.coins, beat: 0 };
        r.purseGo = true;
        purse.gain({ from: first ? r.purse0 : undefined, src: r.coinAt || G.pressAt, delay: save.calm ? 0.25 : DBL_LEN });
        audio.play('combo', { intensity: 1 });
        portal.happy();
      }
      break;
    }
    case 'settings':
      G.settingsOpen = true; G.setSeq = (G.setSeq || 0) + 1;
      if (!save.seen.setOpen) { save.seen = { ...save.seen, setOpen: 1 }; G.setFirst = { seq: G.setSeq }; persist(); } // the first visit: the ring speed row draws the eye
      break;
    case 'set:close':
      G.settingsOpen = false;
      break;
    case 'gfx:auto': case 'gfx:high': case 'gfx:medium': case 'gfx:low':
      save.gfx = id.slice(4);
      if (save.gfx === 'auto') save.gfxStep = -1; // Auto starts again from the phone's own guess
      applySettings(save); setDPR(); persist();
      break;
    case 'set:adapt': // the Pacer's honesty switch: off = no skip pop-up, no dares, no marks, the plain hint timing
      save.adapt = save.adapt === false; persist();
      break;
    case 'set:fpsshow':
      save.showFps = !save.showFps; persist();
      break;
    case 'set:log': { // hand the speed log to the share sheet (app) or save it as a file (web)
      diag.note({ brain: BR.trace(save), who: BR.model(save), tries: DR.triesLine(save), mode: save.mode, eng: ENG.lines(save, { levelId: save.unlocked || 1 }), notif: remCan() ? remLine() : 'web', tal: ENG.tally.table(save), first: (save.eng && save.eng.pulse && save.eng.pulse.first) || 0, spin: save.spin || null }); // the Brain's last decisions travel with the speed log; 0.8.15: tries and wins per level (how hard the game really is)
      const how = diag.share();
      toast(how === 'download' ? 'Speed log saved to your downloads' : how ? 'Pick where to send the speed log' : 'Could not share the log here', 2.6);
      break;
    }
    case 'set:speed': // 2026-11-20: about 13 s on this phone, then one results screen; nothing saved changes unless "Use best setting"
      openSpeedTest({ canvas, ctx, save, persist, font: FONT, applySettings: () => { applySettings(save); setDPR(); }, done: () => resize() });
      break;
    case 'fps:auto': case 'fps:30': case 'fps:60':
      save.fps = id === 'fps:auto' ? 'auto' : +id.slice(4);
      applySettings(save); persist();
      break;
    case 'set:novideo': case 'chip:skip': // the "what you get" sheet of Unlock Everything: the shop opens on it, nothing is charged
      G.skipChip = null; G.settingsOpen = false; openStore('deals', 'iap:' + PREMIUM_SKU); G.detail = 'iap:' + PREMIUM_SKU; G.payBack = true;
      break;
    case 'set:restore':
      ads.restore(); toast('Checking your purchases...', 2);
      break;
    case 'rs:-': case 'rs:+': case 'rs:0': case 'rs:1': case 'rs:2': case 'rs:3': case 'rs:4': case 'rs:5': case 'rs:6': case 'rs:7': case 'rs:8': case 'rs:9': case 'rs:10': case 'rs:11': { // one per RING_SPEEDS (0.8.10: the bars past 200% did nothing)
      const k = RING_SPEEDS.indexOf(ringSpeed()), n = id === 'rs:-' ? k - 1 : id === 'rs:+' ? k + 1 : +id.slice(3);
      save.ringSpeed = RING_SPEEDS[clamp(n, 0, RING_SPEEDS.length - 1)];
      if (G.sim) G.sim.ringSpeed = save.ringSpeed;
      if (!save.seen.rsTried) { save.seen = { ...save.seen, rsTried: 1 }; if (G.screen === 'intro') G.rsDone = { seq: G.scrSeq, lid: G.level && G.level.id }; } // the level card's strip: a tick and where it lives
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
      if (save.vibe) { lastBuzz.t = -9; buzz('win'); } // one sample, so the player feels what it is
      break;
    case 'shake':
      save.shake = save.shake === false;
      persist();
      if (save.shake && !save.calm) G.fx.shake = Math.max(G.fx.shake, 0.6);
      break;
    case 'practice': // the Practice screen: every studio vault as a tile (also reachable from the pause card)
      portal.gameplayStop();
      setScreen('practice');
      break;
    case 'spin': openSpin(); break;
    case 'spin:back': closeSpin(); break;
    case 'spin:go': case 'spin:lever': await spinGo('free'); break; // (the lever also pulls a Try again that costs nothing; one that takes a video is asked for by its own button)
    case 'spin:ad': await spinGo('ad'); break;
    case 'spin:retry': await spinGo('retry'); break;
    case 'spin:coin': await spinGo('coin'); break;
    case 'spin:skip': spinSkip(); break;
    case 'spin:odds': if (G.spin && G.spin.st === 'idle') G.spin.sheet = true; break;
    case 'spin:odds:x': case 'spin:odds:ok': if (G.spin) G.spin.sheet = false; break;
    case 'back':
      G.getMore = null; G.detail = null;
      if (G.screen === 'store') shopSeen(); // (after a purchase fewer things are in reach: saving up again lights the mark)
      setScreen(G.screen === 'store' ? G.storeFrom || 'title' : G.screen === 'practice' ? 'extras' : 'title');
      break;
    case 'extras': // the Extras menu: Wonder Vaults (bonus) and, in the test build, the Practice vaults
      portal.gameplayStop();
      if (G.screen === 'title') G.escroll = { y: 0, v: 0, max: 0, t: G.t, want: albumMarkOn() ? 'album' : null }; // 0.8.17: home's album mark leads to the album row
      setScreen('extras');
      break;
    default:
      if (id && id.startsWith('tr:boss:')) { G.treasure = { id: +id.slice(8), t: G.t, openedAt: null }; } // a boss treasure on the map
      else if (id && id.startsWith('pgdn:')) { const c = CHEV[id.slice(5)]; if (c) { c.S.v = 0; c.S.to = Math.min(c.S.max, c.S.y + c.h * 0.7); audio.play('ui_tap'); } }
      else if (id === 'how:next') { if (G.how) { G.how.i++; G.how.t0 = G.t; } }
      else if (id && id.startsWith('how:pick:')) { if (G.how) { G.how.i = +id.slice(9); G.how.t0 = G.t; audio.play('ui_tap'); } } // a threat's tile on the level card: play its scene again
      else if (id && id.startsWith('lv:')) {
        const i = +id.slice(3);
        if (playable(i)) startLevel(i);
      } else if (id && id.startsWith('demo:')) {
        // test build: the chick lab (v3.2), one practice vault per chick kind
        const k = id.slice(5), d = k === 'frog' ? FROG_DEMO : [...CHICK_DEMOS, ...SEA_DEMOS, ...POWER_DEMOS, ...THIEF_DEMOS, ...ALLY_DEMOS, ...REEF_DEMOS, ...BAYOU_DEMOS, ...LAB_DEMOS].find((x) => x.kind === k);
        if (d) { G.demo = d; startLevel(-2); }
      } else if (id && id.startsWith('sq:') && id !== 'sq:bonus') { // 0.8.17: a side quest's door on the map ('sq:' + world): the hen walks the trail, then its card
        const q = MSIDE.sidePlan(mapLayoutNow()).find((p) => p.w === +id.slice(3));
        if (q && !G.sideWalk && SQ.sideOpen(save, q, allOpen())) { G.mapTravel = null; G.sideReveal = null; G.sideWalk = { q, t0: G.screenT }; audio.play('hen_hop'); }
      } else if (id === 'sq:bonus') { // the Extras page's Bonus vaults: the map, at the first open side quest (else the first one)
        const Q = SQ.SIDE.filter((q) => SQ.sideOpen(save, q, allOpen())), q = Q.find((p) => SQ.sideStars(save, p.key) < 3) || Q[0] || SQ.SIDE[0];
        if (q) { G.world = q.w; G.sideFocus = q.w; G.mapTravel = null; setScreen('levels'); }
      } else if (id && id.startsWith('wv:')) { // WONDER: the bonus world's own buttons
        wonder.press(id);
      } else if (id && id.startsWith('mode:')) {
        save.mode = id.slice(5);
        persist();
      } else if (id === 'strip:more' || id === 'strip:back') { // the booster row one page on or back (0.8.17: it scrolls, ">>" then "<<"; it starts at the first again on another level)
        const lid = G.level && G.level.id, P = G.boostPg && G.boostPg.lid === lid ? G.boostPg : (G.boostPg = { lid, k: 0 });
        if (P.n) P.k = E.stripStep(P.n, P.fit, P.k, id === 'strip:more' ? 1 : -1); audio.play('ui_tap');
      } else if (id && id.startsWith('boost:')) {
        const b = id.slice(6);
        if (G.boostSel.has(b)) G.boostSel.delete(b); else { G.boostSel.add(b); if (!(save.seen || {})['bu:' + b]) { save.seen = { ...(save.seen || {}), ['bu:' + b]: 1 }; persist(); } }
        G.boostLast = b;
      } else if (id === 'car:prev' || id === 'car:next') { // the chick picker's arrows: one chick back / on (the row glides, the stage plays it)
        const R = G.car; if (R && R.step) { const k = clamp(Math.round((R.to != null ? R.to : R.y) / R.step) + (id === 'car:next' ? 1 : -1), 0, Math.round(R.max / R.step)); R.v = 0; R.to = k * R.step; audio.play('ui_tap'); }
      } else if (id === 'inext') { await press('itab:chicks');
      } else if (id && id.startsWith('itab:')) { // the level page's tabs
        if (G.itab !== id.slice(5)) { G.itab = id.slice(5); if (G.ipage) { G.ipage.y = 0; G.ipage.v = 0; G.ipage.to = null; } }
      } else if (id === 'party:tap') { // the unlock party: a tap skips to the coins
        const R = G.party; if (R && R.phase === 'show') { R.t0 = G.t - partyEnd(R.sku === PREMIUM_SKU ? E.bundleParts(R.sku).chicks.length : 0); R.cues = 99; R.arrived = true; }
      } else if (id === 'party:close') { G.party = null;
      } else if (id === 'party:play') { // PLAY: the map, the hen at the next level (home's PLAY)
        G.party = null; G.detail = null; G.getMore = null; await press('play');
      } else if (id && id.startsWith('pay:tip:')) { // a perk tile on a pay page: its one-line detail in place (a second tap puts the words back)
        const i = +id.slice(8), sku = G.detail && G.detail.slice(4);
        G.payTip = G.payTip && G.payTip.sku === sku && G.payTip.i === i && G.t - G.payTip.t0 < 4 ? null : { sku, i, t0: G.t };
        audio.play('ui_tap');
      } else if (id && id.startsWith('tile:')) { // a shop tile: its detail sheet
        const k = id.slice(5);
        G.payBack = false;
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
        if (w) { save.wallet = w; persist(); G.storeFlash = { id, t0: G.t }; const S = STRIKE[k] || {}; startGot({ name: S.name || 'Power chick', key: id, items: [], what: S.up, line: 'Yours for every level' }); } // 0.8.17: the reveal, not a toast
        else if (E.CHICK_PRICES[k] && save.wallet.coins < upPrice(E.CHICK_PRICES[k])) needCoins(upPrice(E.CHICK_PRICES[k]));
      } else if (id && id.startsWith('charge:')) {
        const w = E.buyCharges(save.wallet, id.slice(7)), P = E.CHARGE_PACKS.find((q) => q.id === id.slice(7));
        if (w) { save.wallet = w; persist(); G.storeFlash = { id, t0: G.t }; audio.play('unlock'); }
        else if (P && save.wallet.coins < P.price) needCoins(P.price);
      } else if (id && id.startsWith('hen:')) {
        const k = id.slice(4);
        const had = E.ownsHenSkin(save.wallet, k), w = had ? E.equipHenSkin(save.wallet, k) : E.buyHenSkin(save.wallet, k);
        if (w) { save.wallet = w; DR.endTrial(save, 'hen'); persist(); G.storeFlash = { id, t0: G.t }; if (had) audio.play('unlock'); else startGot({ name: E.HEN_SKINS[k].name, key: id, items: [], line: 'Your hen wears it now' }); } // a chosen look ends a trial; 0.8.17: a new outfit gets the reveal, worn
        else if (E.HEN_SKINS[k] && save.wallet.coins < upPrice(E.HEN_SKINS[k].price)) needCoins(upPrice(E.HEN_SKINS[k].price));
      } else if (id && id.startsWith('skin:')) {
        const k = id.slice(5);
        const had = E.ownsSkin(save.wallet, k), w = had ? E.equipSkin(save.wallet, k) : E.buySkin(save.wallet, k);
        if (w) { save.wallet = w; DR.endTrial(save, 'skin'); persist(); W.setSkin(w.skin); G.storeFlash = { id, t0: G.t }; if (had) audio.play('unlock'); else startGot({ name: E.SKINS[k].name + ' egg', key: id, items: [], line: 'On your eggs now' }); } // 0.8.17: a new egg gets the reveal, worn
        else if (E.SKINS[k] && save.wallet.coins < upPrice(E.SKINS[k].price)) needCoins(upPrice(E.SKINS[k].price));
      } else if (id === 'got:tap') { // the purchase reveal: a tap skips to its end (every coin landed at once), the next closes it
        const R = G.got, busy = land.busy();
        if (busy) land.finish();
        if (R && !save.calm && G.t - R.t0 < R.end) { R.t0 = G.t - R.end; R.popped = R.items.length; if (R.coins0 != null) R.landed = true; }
        else if (!busy) { G.got = null; land.clear(); }
      } else if (id === 'deal:buy') { // TODAY'S DEAL (coins, once a day)
        const D = E.dailyDeal(save.wallet, today()), w = D && !D.done ? E.buyDeal(save.wallet, today()) : null;
        if (w) {
          const it = storeItem(D.key, storeState()), parts = it && it.parts ? it.parts : []; // one egg or outfit: the prize alone, big
          save.wallet = w; if (D.key.startsWith('hen:') || D.key.startsWith('set:')) DR.endTrial(save, 'hen'); if (D.key.startsWith('skin:') || D.key.startsWith('set:')) { DR.endTrial(save, 'skin'); W.setSkin(w.skin); }
          persist(); G.storeFlash = { id: 'deal', t0: G.t };
          startGot({ name: it ? it.name : "Today's deal", key: D.key, items: parts.map((P) => ({ art: P.art, label: P.text })) });
        } else if (D && !D.done) needCoins(D.price);
      } else if (id && id.startsWith('kit:')) { // 2026-11-20 shop 2.0: a kit of boosts for coins (all or nothing)
        const k = id.slice(4), w = E.buyKit(save.wallet, k);
        if (w) { save.wallet = w; persist(); G.storeFlash = { id, t0: G.t }; startGot({ name: E.KITS[k].name, key: 'kit:' + k, items: E.KITS[k].parts.map((b) => ({ art: 'boost:' + b, label: '+1 ' + E.BOOSTERS[b].name })) }); }
        else if (E.KITS[k] && !E.kitFull(save.wallet, k)) needCoins(E.kitPrice(k));
      } else if (id && id.startsWith('hset:')) { // a hen outfit and its egg, both put on ('set:' is the settings card's)
        const k = id.slice(5), S = E.SETS[k], w = E.buySet(save.wallet, k);
        if (w) { save.wallet = w; DR.endTrial(save, 'hen'); DR.endTrial(save, 'skin'); persist(); W.setSkin(w.skin); G.storeFlash = { id: 'set:' + k, t0: G.t }; startGot({ name: S.name + ' set', key: 'set:' + k, items: [{ art: 'hen:' + S.hen, label: E.HEN_SKINS[S.hen].name }, { art: 'egg:' + S.egg, label: E.SKINS[S.egg].name + ' egg' }] }); }
        else if (S && E.setAvailable(save.wallet, k)) needCoins(E.setPrice(save.wallet, k));
      } else if (id && id.startsWith('try:')) { // "Try it free": wear it for the next few levels (the Director's trial machinery)
        const [kind, k] = [id.slice(4, id.indexOf(':', 4)), id.slice(id.indexOf(':', 4) + 1)];
        const owned = kind === 'hen' ? E.ownsHenSkin(save.wallet, k) : E.ownsSkin(save.wallet, k);
        if (DR.startTry(save, kind, k, Date.now(), owned)) {
          persist(); G.storeFlash = { id: kind + ':' + k, t0: G.t }; audio.play('unlock'); G.detail = null;
          const name = kind === 'hen' ? E.HEN_SKINS[k].name : E.SKINS[k].name + ' egg';
          const pk = kind === 'skin' ? E.skinPerk(k) : null; // a free try brings the power along: say so
          toast(pk ? `Trying the ${name} for ${DR.DIR.skinLevels} levels, with ${pk.name}` : `Trying the ${name} for ${DR.DIR.skinLevels} levels`, 2.8);
        }
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

// back 12 seconds into the level from the fail card (a video, coins or a Free rewind): the run and the win streak go on
function rewound(back) {
  releaseAll();
  stopFuse();
  G.sim = back;
  releaseRings(back.rings); // 0.8.10: the pictures of the rings that were rewound away
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
  popPrize(`Back ${REWIND_S} seconds`, (c, x, y, S) => rewindArt(c, x, y, S), 'hud:clock', 0.7); // 0.8.17: it flies onto the clock
}

async function breakThen(fn, info = {}) {
  if (G.adBusy) return;
  G.adBusy = true; G.adVis = 0;
  portal.gameplayStop();
  try { await ads.between({ levelId: G.level && G.li >= 0 ? G.level.id : 0, afterFail: G.screen === 'fail' || (G.li >= 0 && G.level && DR.frustration(save, G.level.id) >= 0.5), ...info }); } catch (_) {} // no ad break on a losing streak
  G.adBusy = false;
  fn();
}

// keepIt: a reward tied to a moment that will pass ({ kind: 'coins' | 'spin', n, key, kept() }): met with no video to
// show, it waits for a connection (src/waiting.js) and kept() uses the moment up
async function rewarded(tag, keepIt = null) {
  if (G.adBusy) return false;
  if (!ads.videoOk) { videoOff(keepIt); return false; } // 0.8.17: never a free reward in place of a video, never a failing one
  G.adBusy = true; G.adVis = 0;
  portal.gameplayStop();
  let ok = false;
  diag.mark('ad:start:' + tag);
  try { ok = await ads.rewarded(tag); } catch (_) { ok = false; }
  G.adBusy = false; diag.mark('ad:end:' + (ok ? 'ok' : 'no'));
  if (ok && !ads.premium) {
    const now = Date.now(); OF.noteRewarded(save, now); BR.note(save, 'video'); ENG.video(save);
    if (OF.skipChip(save, now, ads.moneyShop)) { OF.markChip(save, now); G.skipChip = { t0: G.t }; } // once a day, after the 3rd video of the day
    persist();
  } // the offer engine counts watched ads
  // 0.8.17 (mykee: "right after the reward ads we are not actually showing the user whether they got the reward or not"):
  // every caller shows what the video gave (a YOU GOT! with the purse and the bag, or the prize popping to where it is
  // used); a video closed early, or none to show, says so: the sad hen and one line, never silence
  if (!ok) prizePop.start({ sad: true, name: 'No reward this time' });
  return ok;
}
// 0.8.17 (mykee: "when the user is offline there is no way to display those ads"): a video button tapped while none can
// be shown says how to get it, in one line; a reward whose moment will pass waits (at most 3, src/waiting.js)
function videoOff(keepIt) {
  if (keepIt && !earlyDays()) {
    const S = WT.clean(save.waiting), list = WT.keep(S.list, keepIt, Date.now(), { early: earlyDays() });
    if (list.some((it) => it.key === keepIt.key) && !S.list.some((it) => it.key === keepIt.key)) {
      save.waiting = { ...S, list };
      try { if (keepIt.kept) keepIt.kept(); } catch (_) { /* the moment's own bookkeeping */ }
      persist();
    }
  }
  prizePop.start({ sad: true, name: ads.videoWhy === 'offline' ? 'Connect to get this reward' : 'No video right now' }); // the one line, over every page
}
const waitingList = () => WT.clean(save.waiting).list;
// the gift mark shows once a video can be shown again (and never before level 3 is won)
const waitShown = () => waitingList().length > 0 && ads.videoOk && !earlyDays();
// claim one waiting reward: one video, then the normal reward moment (the YOU GOT! with its purse, or the Lucky Spin)
async function waitClaim(id) {
  const it0 = waitingList().find((x) => x.id === id);
  if (!it0 || (it0.kind === 'coins' && WT.room(save.waiting, today()) < it0.n)) return;
  if (!(await rewarded('wait'))) return;
  const r = WT.claim(save.waiting, id, today());
  if (!r.item) return;
  save.waiting = r.state;
  if (!r.state.list.length) G.waitList = null;
  if (r.item.kind === 'coins') {
    save.wallet = E.addCoins(save.wallet, r.item.n);
    startGot({ name: 'Free coins', art: 'coins', quiet: true, coins: r.item.n, items: [{ art: 'coins', label: '+' + r.item.n }] });
    audio.play('combo', { intensity: 0.5 });
  } else {
    const P = SP.state(save);
    P.bank = Math.min(SP.SPIN.bankMax, P.bank + r.item.n);
    G.waitList = null;
    if (SP.open(save)) openSpin(); // the spin waits on the machine: he pulls it himself
  }
  persist();
}
// ---------------------------------------------------------------- shop (2026-11-16 revamp)
// the shop opens on a tab (and optionally scrolled to a section: 'coins' | 'bank'); Back returns to the exact screen it
// was opened from (title, intro, fail card, pause)
// want: a row ('coins', 'boosts', 'premium') or one card ('chick:frost', 'skin:dino', 'iap:coins_s'); the shop opens
// on its tab, scrolled so that card sits whole near the top, with a ring on it (ui/store.js). No tab: the card's own.
const storeTabFor = (k) => tabForKey(k, (b) => !!E.BOOSTERS[b]);
function openStore(tab, want = null, point = false) { // point: the thing gets the ring and the tapping hand for ~4 s (openStoreOn)
  if (G.screen !== 'store') { G.storeFrom = G.screen; G.storeFlash = null; setScreen('store'); }
  shopSeen(); // the shop mark goes off: what the coins reach is in front of the player now
  G.storeTab = tab || storeTabFor(want);
  G.sscroll = { y: 0, v: 0, max: 0, t: G.t, want };
  if (point && want) focusAsk(G.sscroll, want);
  G.getMore = null; G.detail = null; G.chickBuy = null; // (the level card's chick sheet used to stay open over the shop)
  G.toasts = []; G.toast = null; // the level's tips do not follow into the shop
}
// 0.8.16: every marked way into the shop lands ON the thing: its tab, scrolled to it, a ring round it, the hand on its price
const openStoreOn = (key) => openStore(null, key, true);
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
  else if (r !== true) { // cancelled or failed: back where the player was, one calm line (on the pay page itself when it is open)
    if (G.detail === 'iap:' + sku) G.payNote = { sku, t0: G.t }; else toast('No payment was made', 2.2);
  }
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
// The Brain's plan for the Featured tab (brain.js shopPlan): the bundle that leads, the order of the bundles, and up to
// three coin things for this player (what they tried free, what their purse can pay for, what helps on their level).
// Asked once a second and when the purse changes, not every frame. G.forYou (QA) overrides the picks.
function shopBrain() {
  const w = save.wallet, sig = `${w.coins}|${(w.skins || []).length}|${(w.henSkins || []).length}|${(w.chicks || []).length}|${w.noAds}|${w.starter}|${w.collector}`;
  if (G.shopPlan && G.shopPlan.sig === sig && G.t - G.shopPlan.at < 1 && G.t >= G.shopPlan.at) return G.shopPlan.out;
  const D = DR.dirState(save), tr = D.trials || {}, items = [];
  for (const id of E.SKIN_ORDER) if (id !== 'classic') items.push({ key: 'skin:' + id, kind: 'skin', price: upPrice(E.SKINS[id].price), owned: (w.skins || []).includes(id), tried: (tr.skins || []).includes(id) });
  for (const id of E.HEN_SKIN_ORDER) if (id !== 'classic' && !E.HEN_SKINS[id].premium) items.push({ key: 'hen:' + id, kind: 'hen', price: upPrice(E.HEN_SKINS[id].price), owned: (w.henSkins || []).includes(id), tried: (tr.hens || []).includes(id) });
  for (const c of lockedChicks()) items.push({ key: 'chick:' + c.id, kind: 'chick', price: c.price, owned: false, tried: (tr.chicks || []).includes(c.id) });
  for (const id of E.BOOSTER_ORDER) items.push({ key: 'boost:' + id, kind: 'boost', price: E.BOOSTERS[id].price, owned: E.ownedCount(w, id) });
  for (const id of Object.keys(E.KITS)) items.push({ key: 'kit:' + id, kind: 'kit', price: E.kitPrice(id), owned: false });
  for (const id of E.SET_ORDER) { const S = E.SETS[id], has = (w.henSkins || []).includes(S.hen) && (w.skins || []).includes(S.egg); items.push({ key: 'set:' + id, kind: 'set', price: E.setPrice(w, id), owned: has }); }
  const bundles = ads.moneyShop ? ['starter_nest', PREMIUM_SKU, 'eggscape_collector'].filter((k) => E.iapAvailable(w, k)) : [];
  const P = BR.shopPlan(save, { now: Date.now(), bundles, items, lastLoss: G.lastLoss || null });
  const forYou = (G.forYou || P.forYou).filter((p) => storeItem(p.key, { wallet: w }));
  if (!G.shopPlan || G.shopPlan.pick !== forYou.map((p) => p.key).join()) BR.why(save, 'shop', forYou.map((p) => p.key).join(' ') || null, `lead ${P.hero || 'none'}; for you by taste ${P.model.taste}, purse ${P.model.coins}`);
  G.shopPlan = { sig, at: G.t, pick: forYou.map((p) => p.key).join(), out: { forYou, hero: P.hero, order: P.order.length ? P.order : null } };
  return G.shopPlan.out;
}
// forYou ([{ key, why }], the FOR YOU row), hero (a bundle sku) and order ([sku, ...], the BUNDLES row): the Brain's plan. balHold: the balance shown while a purchase reveal's coins fly.
const storeState = () => ({ wallet: save.wallet, t: G.t, flash: G.storeFlash ? { id: G.storeFlash.id, t: G.t - G.storeFlash.t0 } : null, price: (sku) => ads.price(sku), reach: strikeReach(), money: ads.moneyShop, dailyOpen: save.wallet.daily === today(), dailyIn: chestInText(), day: today(), trial: { skin: DR.trialSkin(save), hen: DR.trialHen(save) },
  ...shopBrain(), balHold: purse.held() ?? (G.got && G.got.coins0 != null && !G.got.flown ? G.got.coins0 : null) });
// popups and sheets over any screen; while one shows only its own buttons take taps
// the id of level index li when it is a beaten boss whose treasure chest is still shut (else 0)
function treasureDue(li) { const Lf = LEVELS[li]; return Lf && Lf.boss && E.bossTreasure(Lf.id) && bossBeaten(Lf.id) && !E.treasureOpened(save.wallet, Lf.id) ? Lf.id : 0; }
function modalOpen() { return !!(G.got || G.party || G.waitList || G.getMore || G.detail || G.offer || G.ageAsk || G.remAsk || G.leaveAsk || G.parent || G.chickBuy || G.treasure || G.nudge || (G.skipAsk && G.screen === 'pause') || (G.stuckAsk && G.screen === 'fail' && G.screenT >= STUCK_AFTER)); }
function drawModals() {
  if (!modalOpen()) return;
  ui.buttons.length = 0; ui.rects.length = 0;
  const hb = G.hudBottom;
  if (G.screen === 'store' || G.screen === 'title') G.hudBottom = 0; // no HUD under these
  try {
    if (G.got) { if (G.party) drawParty(true); drawGot(); } // the coins' reveal runs over the unlock party's stage
    else if (G.party) drawParty();
    else if (G.parent) drawParentCheck();
    else if (G.waitList) drawWaitList();
    else if (G.getMore) drawGetMore();
    else if (G.chickBuy) drawChickBuy();
    else if (G.detail) drawDetail();
    else if (G.offer) drawOffer();
    else if (G.nudge) drawNudge();
    else if (G.ageAsk) drawAgeAsk();
    else if (G.remAsk) drawRemAsk();
    else if (G.leaveAsk) drawLeaveAsk();
    else if (G.treasure) drawTreasure();
    else if (G.skipAsk) drawSkipAsk();
    else if (G.stuckAsk) drawStuckAsk();
  } finally { G.hudBottom = hb; }
}
// ---- boss treasure (2026-11-19, mykee: "after clearing a boss level, show some treasure, the unlockables, the new birds;
// as levels go on new villains come: show what is coming and how it connects"). A chest stands beside every boss on the
// map. Locked: it shows what it holds and who guards it. Beaten: it glows; open it for coins, a booster and Chick Charges.
// Inside it also shows the chick that joins at the next level (what it does, the villains it answers) and the next
// world's new villains, so the reward points at the levels ahead. Bosses 36-60 add no free chick: the shop's premium
// chicks are offered instead (one button, never a popup).
const bossBeaten = (id) => bestStarsOf(id) > 0;
function newKindsFor(w) { // villains that first appear in world w (its PER_ENV levels), in order of appearance
  const seen = new Set(), out = [];
  for (const Lv of LEVELS) {
    const ks = villainKinds(Lv).filter((k) => hasPortrait(k) || VILLAIN_INFO[k]);
    const inW = Lv.id > w * ROAD.PER_ENV && Lv.id <= (w + 1) * ROAD.PER_ENV;
    for (const k of ks) { if (inW && !seen.has(k) && !out.includes(k)) out.push(k); }
    if (Lv.id <= w * ROAD.PER_ENV) ks.forEach((k) => seen.add(k));
  }
  return out;
}
function drawTreasure() {
  // 0.8.16: the treasure is a page of its own over the dimmed map (it hung under the map's header, and on a squat
  // screen that room was too small: its button fell off the bottom)
  const hb = G.hudBottom, T = G.treasure;
  // 0.8.17: a beaten treasure's page has the purse (and then the bag) on it, top right: on a phone held upright the card starts under them
  if (bossBeaten(T.id) && !T.land && !E.treasureOpened(save.wallet, T.id)) { T.land = 1; land.start({ wait: true, from: save.wallet.coins, to: save.wallet.coins }); }
  G.hudBottom = ui.A.y + (T.land && ui.A.h > ui.A.w ? 70 * ui.u : 0);
  try { drawTreasurePage(); } finally { G.hudBottom = hb; }
  if (G.treasure && G.treasure.land && land.active()) landDraw(); // 0.8.17: its coins land in the purse chip on the page, its booster and charges in the bag
}
function drawTreasurePage() {
  const T = G.treasure, R = E.bossTreasure(T.id);
  if (!R) { G.treasure = null; return; }
  const Lb = LEVELS.find((Lv) => Lv.id === T.id), beaten = bossBeaten(T.id), opened = E.treasureOpened(save.wallet, T.id);
  const w = ROAD.worldOfId(T.id) + 1, chick = STRIKES.find((S) => S.unlock === T.id + 1), nk = w < WORLDS.length ? newKindsFor(w).slice(0, 4) : [];
  const bossName = (VILLAIN_INFO['boss:' + (Lb && Lb.boss)] || {}).name || (Lb ? Lb.name : 'the boss');
  dim(0.78);
  const fresh = T.openedAt != null ? G.t - T.openedAt : 9;
  const title = opened ? (fresh < 9 ? 'Treasure collected!' : 'Boss treasure') : beaten ? 'Boss treasure!' : 'Boss treasure';
  // 0.8.16 (mykee: full screen, bigger art): the room a tall phone leaves goes to the pictures, first the coming
  // villains (up to the column's width), then the chest. chH: the chest block's height in units; pMax: a portrait's side.
  const build = (chH, pMax) => (s, iw) => {
    const B = [], ck = chH / 118;
    B.push({ h: chH * s, gap: 2 * s, draw: (x, y, w2) => { // the chest: locked, glowing, or open with its prizes flying out
      const cx = x + w2 / 2, cy = y + 64 * ck * s;
      if (opened && fresh < 1.4 && !save.calm) { const a = fresh / 1.4; sunburst(cx, cy, 120 * s * (0.6 + a), `rgba(255,226,120,${0.35 * (1 - a)})`, 14); }
      drawChest(ctx, cx, cy, 92 * ck * s, G.t, opened ? 'open' : beaten ? 'ready' : 'locked');
      if (!beaten) drawPadlock(cx, cy + 14 * ck * s, 13 * ck * s, null);
      ui.record({ x: cx - 50 * ck * s, y, w: 100 * ck * s, h: 112 * ck * s }, 'tr:art');
    } });
    B.push(lineBlock(beaten ? (opened ? 'You opened this treasure.' : `You beat ${bossName}. It is yours!`) : `Beat ${bossName} (Level ${T.id}) to open it.`, 16.5 * s, { tag: 'tr:status', gap: 4 * s, color: beaten ? ui.C.ink : ui.C.ink2 }));
    // what is inside: coins, a booster, Chick Charges
    const items = [['coin', `${R.coins} coins`], ['boost', `${(E.BOOSTERS[R.booster] || {}).name || 'Booster'} booster`], ['charge', `${R.charges} Chick Charges`]];
    // 0.8.16 (design critique: three short rows left half the well empty): the prizes stand side by side, each a big
    // picture with its words under it, across the column's whole width
    const cw3 = (iw - 16 * s) / items.length, wr = items.map(([, txt]) => wrapText(txt, 15 * s, cw3 - 8 * s).slice(0, 2)), nl = Math.max(...wr.map((l) => l.length));
    const IH = 26 * s + 50 * s + nl * 18 * s + 12 * s;
    B.push({ h: IH, gap: 10 * s, draw: (x, y, w2) => {
      ui.well(x, y, w2, IH, { s, a: '#f3e2bd', b: '#fbf0d6' });
      ui.text(opened ? 'YOU GOT' : 'INSIDE', x + w2 / 2, y + 14 * s, { size: 13.5 * s, align: 'center', color: ui.C.ink2, tag: 'tr:inhead' });
      items.forEach(([k], i) => {
        const ix = x + 8 * s + cw3 * (i + 0.5), iy = y + 26 * s + 25 * s;
        if (k === 'coin') drawCoin(ctx, ix, iy, 19 * s, G.t); else if (k === 'boost') drawBoosterIcon(ctx, R.booster, ix, iy, 48 * s, G.t); else pictoPower(ctx, 'thunder', ix, iy, 44 * s, G.t);
        ui.record({ x: ix - 22 * s, y: iy - 22 * s, w: 44 * s, h: 44 * s }, 'tr:itemart' + i);
        wr[i].forEach((l, j) => ui.text(l, ix, iy + 25 * s + 11 * s + j * 18 * s, { size: 15 * s, align: 'center', color: ui.C.ink, maxW: cw3 - 6 * s, tag: 'tr:item' + i + ':' + j }));
        if (opened) pictoCheck(ctx, ix + 22 * s, iy - 16 * s, 20 * s);
      });
    } });
    if (chick) { // the chick that joins next: its art, what it does, from which level
      const ul = wrapText(chick.up, 15 * s, iw - 120 * s).slice(0, 3), CH = Math.max(104 * s, 30 * s + 22 * s + ul.length * 19 * s + 10 * s);
      B.push({ right: true, h: CH, gap: 10 * s, draw: (x, y, w2) => {
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
      const P = Math.min(pMax * s, (iw - (nk.length - 1) * 10 * s) / nk.length), NH = 30 * s + P + 38 * s;
      B.push({ right: true, h: NH, gap: 10 * s, draw: (x, y, w2) => {
        ui.text(`COMING UP IN ${(WORLDS[w] || 'the next world').toUpperCase()}`, x + w2 / 2, y + 12 * s, { size: 13.5 * s, align: 'center', color: ui.C.ink2, maxW: w2, tag: 'tr:nexthead' });
        const x0 = x + w2 / 2 - (nk.length * P + (nk.length - 1) * 10 * s) / 2;
        nk.forEach((k, i) => {
          const I = VILLAIN_INFO[k] || { group: 'creature', name: k }, bg = PORTRAIT_BG[I.group] || PORTRAIT_BG.creature, px = x0 + i * (P + 10 * s), py = y + 26 * s;
          ui.well(px, py, P, P, { s, r: 12 * s, a: bg[0], b: bg[1], border: 'rgba(40,24,10,0.7)', shade: 'rgba(0,0,10,0.45)', paint: () => drawVillainPortrait(ctx, k, px + P / 2, py + P / 2, P, G.t + i * 0.7) });
          wrapText(I.name, 12.5 * s, P + 8 * s).slice(0, 2).forEach((l, j) => ui.text(l, px + P / 2, py + P + 12 * s + j * 14 * s, { size: 12.5 * s, align: 'center', color: ui.C.ink, maxW: P + 8 * s, tag: 'tr:nk' + i + ':' + j }));
        });
      } });
    }
    B.push({ right: true, h: 58 * s, gap: 14 * s, draw: (x, y, w2) => {
      if (beaten && !opened) ui.button('tr:open', 'OPEN', x, y, w2, 58 * s, { kind: 'gold', shimmer: true, size: 24 * s });
      else if (!beaten && Lb && playable(LEVELS.indexOf(Lb))) { const hw = (w2 - 10 * s) / 2; ui.button('tr:close', 'Close', x, y, hw, 58 * s, { kind: 'tertiary', size: 19 * s }); ui.button('tr:play', `Play Level ${T.id}`, x + hw + 10 * s, y, hw, 58 * s, { kind: 'primary', icon: ICON.play, size: 18 * s }); }
      else ui.button('tr:close', opened ? 'Great!' : 'Close', x, y, w2, 58 * s, { kind: 'primary', size: 22 * s });
    } });
    if (!chick && w >= 7 && opened) B.push({ right: true, h: 44 * s, gap: 8 * s, draw: (x, y, w2) => ui.button('tr:shop', 'See premium chicks', x, y, w2, 44 * s, { kind: 'secondary', size: 16 * s }) });
    return B;
  };
  let chH = 118, pMax = 64;
  const A = ui.A, u = ui.u;
  if (cardFull({}, A)) {
    const iw1 = fullInner(A, u) / u, rest = build(118, 64)(1, iw1).reduce((a, b) => a + (b.gap ?? 10) + b.h, 0) + CARD_HEAD + 22;
    let extra = Math.max(0, (A.y1 - Math.max(G.hudBottom, A.y) - 30 * u) / u - rest - 30);
    if (nk.length) { const d = Math.min(extra, (iw1 - (nk.length - 1) * 10) / nk.length - 64, 30); pMax += Math.max(0, d); extra -= Math.max(0, d); }
    chH = Math.min(118 + extra, 190);
  }
  stackCard(title, build(chH, pMax), { ribbon: '#d89a1c', grow: 1.15, twoCol: true }); // 0.8.16: landscape opens into two columns (the whole card used to shrink to 0.58)
}
// ---- the offer engine's moments (offers.js): the end card after its first second, home on arrival, the intro (a line)
function offerCtx() {
  const lv = G.li >= 0 && G.level ? G.level.id : null, st = G.sim && G.screen === 'fail' ? G.sim.stats() : null;
  return { now: Date.now(), money: ads.moneyShop, levelId: lv, fails: lv != null ? ads.fails(lv) : 0, prevFails: G.prevFails || 0,
    nearMiss: !!(st && st.saved === st.target - 1), lastPrice: G.lastPrice || 0, adReady: adCd() === 0, lean: BR.lean(save, { levelId: lv }) };
}
// what the Director needs to know about this loss
function failCtx(st) {
  const L = G.level, kinds = villainKinds(L, G.sim).filter((k) => VILLAIN_INFO[k] && VILLAIN_INFO[k].group !== 'hazard');
  G.lastLoss = G.sim.timeLimit && G.sim.timeLeft <= 0 ? 'time' : G.sim.rings.some((r) => r.thorns && r.thorns.length) && st.saved < st.target - 1 ? 'thorns' : kinds.length ? 'villains' : 'nest'; // the Brain's shop pick: what would have helped
  const c = lockedChicks()[0] || null;
  return { levelId: L.id, now: Date.now(), nearMiss: st.saved === st.target - 1, timeout: !!G.sim.timeLimit && G.sim.timeLeft <= 0, // a level with no clock (L1) never times out
    thorns: G.sim.rings.some((r) => r.thorns && r.thorns.length), villains: kinds.length > 0, lockedChick: c, chickLevel: L.id >= STRIKE_FROM,
    owned: (save.wallet && save.wallet.owned) || {}, adReady: !G.adBusy };
}
// the fail card's help: a freebie, or the booster that fits, then straight back into the level
async function takeHelp() {
  const H = G.failHelp, lid = G.level && G.level.id;
  if (!H || G.screen !== 'fail' || lid == null) return;
  const boostRun = (b) => startLevel(G.li, b === 'golden' ? { direct: true, golden: true } : { direct: true, boost: { [b]: true } });
  if (H.pacer) { ENG.pacer.gave(save, lid, H.pacer); persist(); } // the Pacer's free hint or Scarecrow: once per level
  if (H.kind === 'freeHint') { G.failHelp = null; G.hintFree = lid; portal.gameplayStop(); startLevel(G.li, { direct: true }); return; } // the hint shows once the next try is running
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
    if (await rewarded('booster')) { G.failHelp = null; boostRun(H.id); popPrize(E.BOOSTERS[H.id].name, (c, x, y, S, t) => drawBoosterIcon(c, H.id, x, y, S, t), null, 0.5); } // 0.8.17: it pops over the level it starts
  }
}
// home: the Director's one nudge (keep a trial skin, welcome back, you can afford a chick or skin)
function homeNudge(now) {
  const chicks = strikeReach() >= STRIKE_FROM ? STRIKES.filter((S) => !strikesOpen().includes(S) && E.CHICK_PRICES[S.id]).map((S) => ({ id: S.id, name: S.name, price: E.CHICK_PRICES[S.id] })).sort((a, b) => a.price - b.price) : [];
  const n = DR.homeNudge(save, { now, chicks });
  if (!n) return false;
  if (n.kind !== 'keep') DR.noteNudge(save, n, now);
  BR.note(save, 'ask', { id: 'nudge:' + n.kind, kind: 'nudge' }, now); BR.why(save, 'home', 'nudge:' + n.kind, 'the Director\'s nudge comes before any paid offer', now);
  persist();
  G.nudge = n;
  return true;
}
function offerMoments() {
  remLanding(); // a note was tapped: open what it spoke of
  if (G.remWelcome && !modalOpen() && !G.settingsOpen && !G.adBusy && G.t > G.remWelcome) { G.remWelcome = 0; if (['title', 'levels'].includes(G.screen) && remAskOk('welcome')) { remAskShow('welcome'); return; } } // after the welcome-back gift
  if (G.offerTried || modalOpen() || G.settingsOpen || G.adBusy) return;
  const sc = G.screen;
  if ((sc === 'title' || (sc === 'levels' && !G.mapTravel && !G.treasure)) && G.screenT > 1.4) { // home, or the map (the app opens on it now)
    G.offerTried = true;
    if (sc === 'title' && OF.needsAge(save, ads.moneyShop) && !G.ageLater) { G.ageAsk = true; return; } // first launch, once the home is up
    if (earlyDays()) return; // nothing sold before L3 is won
    if (BR.gate(save, 'home').nudge && homeNudge(Date.now())) return; // the Director's nudge comes first; the paid offer can wait for another visit
  } else if ((sc === 'win' || sc === 'fail') && G.screenT > 1 && G.li >= 0 && !(sc === 'win' && revealing(G.result))) { G.offerTried = true; if ((sc === 'fail' && G.failHelp) || earlyDays()) return; } // one help on a fail card, never two
  else if (sc === 'intro' && G.screenT > 0.3 && G.li >= 0) { G.offerTried = true; G.introTip = null; if (earlyDays()) return; } // the intro's gentle chick line
  else return;
  if (sc === 'win' && G.remDue) { // the reminder question (free): it takes this card's one ask
    const mo = G.remDue; G.remDue = null;
    if (remAskOk(mo)) { remAskShow(mo); return; }
  }
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
  // the Brain's gate: a paid offer needs the money gate (it backs off after a "no", rests after a purchase, and leaves a
  // winning run alone); a free or video suggestion only needs "one ask at a time"
  const gt = BR.gate(save, moment, ctx2), paid = !!o.sku;
  if (paid ? !gt.money : !gt.nudge) { BR.why(save, moment, null, `${o.id} held back: ${gt.why}`, ctx2.now); return; }
  OF.markShown(save, o, ctx2.now, ctx2.levelId);
  BR.note(save, 'ask', { id: o.id, kind: paid ? 'money' : 'video' }, ctx2.now); BR.why(save, moment, o.id, 'the best fit at a calm moment', ctx2.now);
  persist();
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
        : ui.button('of:buy', O.id === 'skip_videos' ? 'See what you get' : ads.price(O.sku), x, y, w, 58 * s, { kind: 'gold', shimmer: true, size: 24 * s }) },
      { h: 56 * s, gap: 10 * s, draw: (x, y, w) => ui.button('of:no', 'No thanks', x, y, w, 56 * s, { kind: 'tertiary', size: 21 * s }) },
    ];
  }, { ribbon: '#e8402e' });
}
// the Director's home nudge: keep a trial skin, a welcome-back gift, or "you can unlock X now". One card, big art.
function drawNudge() {
  const n = G.nudge;
  dim(0.55);
  const title = n.kind === 'keep' ? (n.what === 'hen' ? `Keep the ${n.name}?` : `Keep the ${n.name} Egg?`) : n.kind === 'welcome' ? 'Welcome back!' : 'You can unlock it now!';
  const line = n.kind === 'keep' ? 'Your free try is over. Keep it for good:' : n.kind === 'welcome' ? `A gift for coming back: ${n.coins} coins and a free booster.` : `You have the coins for ${n.name}.`;
  stackCard(title, (s, iw) => [
    { h: 132 * s, gap: 4 * s, draw: (x, y, w) => {
      const aw = Math.min(w, 170 * s);
      ui.well(x + (w - aw) / 2, y, aw, 132 * s, { s, a: '#ffe9b0', b: '#fff6dc' });
      if (n.kind === 'keep' && n.what === 'hen') drawHenSkinPreview(ctx, n.id, x + w / 2, y + 70 * s, 118 * s, G.t);
      else if (n.kind === 'keep' || (n.kind === 'afford' && n.item.startsWith('skin:'))) drawSkinPreview(ctx, n.kind === 'keep' ? n.id : n.item.slice(5), x + w / 2, y + 66 * s, 104 * s, G.t);
      else if (n.kind === 'afford') drawStrikeChick(ctx, n.item.slice(6), x + w / 2, y + 72 * s, 112 * s, G.t, {});
      else drawOfferArt(ctx, 'coins', x + w / 2, y + 66 * s, 120 * s, G.t, save.wallet);
      ui.record({ x: x + (w - aw) / 2, y, w: aw, h: 132 * s }, 'nudge:art');
    } },
    ...wrapText(line, 16.5 * s, iw).slice(0, 2).map((l, i) => lineBlock(l, 16.5 * s, { color: ui.C.ink, tag: 'nudge:line' + i, gap: i ? 2 * s : 10 * s })),
    { h: 58 * s, gap: 14 * s, draw: (x, y, w) => n.kind === 'keep'
      ? ui.button('nudge:yes', String(n.price), x, y, w, 58 * s, { kind: save.wallet.coins >= n.price ? 'gold' : 'off', dim: 1, shimmer: save.wallet.coins >= n.price, icon: (c, X, Y, S) => drawCoin(c, X, Y, S * 0.5, G.t), size: 24 * s })
      : ui.button('nudge:yes', n.kind === 'welcome' ? 'Collect' : 'See it', x, y, w, 58 * s, { kind: 'primary', shimmer: true, size: 22 * s }) },
    ...(n.kind === 'welcome' ? [] : [{ h: 52 * s, gap: 10 * s, draw: (x, y, w) => ui.button('nudge:no', n.kind === 'keep' ? 'No thanks' : 'Later', x, y, w, 52 * s, { kind: 'tertiary', size: 20 * s }) }]),
  ], { ribbon: n.kind === 'welcome' ? '#3cb043' : '#d89a1c' });
}
// the reminder question (0.8.15; 0.8.17 worded around the real thing waiting): the note itself is the picture, as it
// will look on the phone, saying what is really coming; the button names it ("Tell me when my spin is ready"). When
// Android will no longer ask (refused before) or the phone has them switched off, the button opens the phone's own page.
function remPreview(R) {
  if (R.spins > 0) return ['Your Lucky Spin is ready', 'spin'];
  if (R.spinLeft > 0) return [R.spinLeft === 1 ? 'One win to your Lucky Spin' : `${R.spinLeft} wins to your Lucky Spin`, 'spin'];
  if (R.starsToChest === 1) return ['One star to your next chest', 'chest'];
  if (R.flame >= 2) return [`Your ${R.flame}-win flame is still burning`, 'flame'];
  return ['A fresh chest landed in the coop', 'chest'];
}
function drawRemAsk() {
  const R = G.remAsk, [text, what] = remPreview(R), sys = remSys(), calm = save.calm;
  const yes = sys ? 'Turn on in phone settings' : what === 'spin' ? 'Tell me when my spin is ready' : what === 'flame' ? 'Tell me before it goes out' : 'Tell me when my chest is ready';
  // the note slides down into place (eased) and gives a little ring; Calm: it simply sits there
  const k = calm ? 1 : clamp((G.t - (R.t0 ?? G.t - 1)) / 0.55, 0, 1), e = 1 - Math.pow(1 - k, 3), ring = calm ? 0 : Math.max(0, 1 - Math.abs(G.t - (R.t0 ?? -9) - 0.7) / 0.35);
  dim(0.55);
  stackCard('Want a reminder?', (s, iw) => [
    { h: 96 * s, gap: 6 * s, draw: (x, y, w) => {
      const bw = Math.min(w, 320 * s), bx = x + (w - bw) / 2, bh = 72 * s, by = y + 12 * s - (1 - e) * 22 * s + (calm ? 0 : Math.sin(G.t * 2.2) * 2 * s * k), d = 44 * s;
      ctx.save(); ctx.globalAlpha *= 0.25 + 0.75 * e;
      ctx.shadowColor = 'rgba(40,20,5,0.35)'; ctx.shadowBlur = 14 * s; ctx.shadowOffsetY = 4 * s;
      ui.roundRect(bx, by, bw, bh, 18 * s); ctx.fillStyle = '#fffdf6'; ctx.fill();
      ctx.restore();
      ui.roundRect(bx, by, bw, bh, 18 * s); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(70,40,10,0.35)'; ctx.stroke();
      const ix = bx + 14 * s + d / 2, iy = by + bh / 2;
      ctx.beginPath(); ctx.arc(ix, iy, d / 2, 0, 7); ctx.fillStyle = '#e8a020'; ctx.fill();
      ctx.save(); ctx.translate(ix, iy - d * 0.3); ctx.rotate(Math.sin(G.t * 26) * 0.32 * ring); ctx.translate(-ix, -(iy - d * 0.3)); // the bell rings once as the note lands
      ctx.fillStyle = '#fff'; SI.bell(ctx, ix, iy, d * 0.78); ctx.restore();
      const tx = bx + 14 * s + d + 12 * s, tw = bw - (tx - bx) - 12 * s, ts = Math.min(17 * s, tw * 17 / Math.max(1, ui.measure(text, 17)));
      ui.text('Eggscape', tx, by + bh / 2 - 12 * s, { size: 13 * s, color: ui.C.ink2, maxW: tw, tag: 'rem:app' });
      ui.text(text, tx, by + bh / 2 + 9 * s, { size: ts, color: ui.C.ink, maxW: tw, tag: 'rem:text' });
      ui.record({ x: bx + 14 * s, y: by + (bh - d) / 2, w: d, h: d }, 'rem:icon');
    } },
    { ...lineBlock(sys ? 'Notifications are off for Eggscape on this phone.' : 'One a day at most. Never at night.', 15 * s, { color: ui.C.ink2, tag: 'rem:why', gap: 8 * s }), right: true },
    { h: 58 * s, gap: 14 * s, right: true, draw: (x, y, w) => ui.button('rem:yes', yes, x, y, w, 58 * s, { kind: 'primary', shimmer: true, size: Math.min(22 * s, (w - 28 * s) * 22 / Math.max(1, ui.measure(yes, 22))) }) },
    { h: 52 * s, gap: 10 * s, right: true, draw: (x, y, w) => ui.button('rem:no', 'Not now', x, y, w, 52 * s, { kind: 'tertiary', size: 20 * s }) },
  ], { ribbon: '#e8a020', twoCol: true }); // 0.8.17 (mykee: landscape "too much empty UI space"): on its side the note left, the words and the buttons right
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
  const S = STRIKE[id], price = upPrice(E.CHICK_PRICES[id]);
  if (!S || !price) return null;
  return { price, canAfford: save.wallet.coins >= price, owned: strikesOpen().some((q) => q.id === id) };
}
function lockedChicks() {
  if (!G.sim || !G.sim.stk || !G.sim.stk.any || (G.li >= 0 && G.level.id < STRIKE_FROM)) return [];
  const open = strikesOpen();
  return STRIKES.filter((S) => !open.includes(S) && E.CHICK_PRICES[S.id])
    .map((S) => ({ id: S.id, name: S.name, unlock: S.unlock, price: upPrice(E.CHICK_PRICES[S.id]), canAfford: save.wallet.coins >= upPrice(E.CHICK_PRICES[S.id]) }))
    .sort((a, b) => a.price - b.price || a.unlock - b.unlock);
}
function buyChickForLevel(id) {
  const O = chickOffer(id);
  if (!O || O.owned) return false;
  const w = E.buyChick(save.wallet, id);
  if (!w) { needCoins(O.price); return false; }
  save.wallet = w; persist();
  if (G.level) { G.stkSel = { lid: G.level.id, id }; G.sim.stkEquip(strikeFor(G.level, G.li)); }
  G.introTip = null;
  startGot({ name: STRIKE[id].name, key: 'chick:' + id, items: [], what: STRIKE[id].up, line: 'Picked for this level' }); // 0.8.17: the reveal (it was a toast), the chick already picked
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
    { h: 56 * s, gap: 14 * s, draw: (x, y, w) => ui.button('cb:buy', `Unlock ${O.price}`, x, y, w, 56 * s, { kind: O.canAfford ? 'primary' : 'off', shimmer: O.canAfford, icon: (c, X, Y, Z) => drawCoin(c, X, Y, Z * 0.5, G.t), size: 21 * s }) },
    ...(!O.canAfford && ads.moneyShop ? [packRow(E.packFor(O.price - save.wallet.coins), s, 'cb')] : []), // 0.8.17: short of coins, the pack that covers it right here (one tap fewer than Get more)
    { h: 48 * s, gap: 10 * s, draw: (x, y, w) => ui.button('cb:close', 'Not now', x, y, w, 48 * s, { kind: 'tertiary', size: 19 * s }) },
  ], { ribbon: S.premium ? '#b8860b' : '#f0a01c' });
}

// a shop tile's detail sheet: the art big, the name, what it does, and its buy / equip button
function drawDetail() {
  if (G.screen === 'store' && G.detail.startsWith('iap:') && E.IAP[G.detail.slice(4)]) return drawIapSheet(G.detail.slice(4));
  const it = G.screen === 'store' ? storeItem(G.detail, storeState()) : null;
  if (!it) { G.detail = null; return; }
  // an egg or outfit the player does not own: "Try it free" under the price (each one once; trying shows how long is left)
  const dk = G.detail.slice(0, G.detail.indexOf(':')), di = G.detail.slice(G.detail.indexOf(':') + 1);
  const tryK = (dk === 'skin' || dk === 'hen') && !it.owned && (it.trying || DR.canTry(save, dk, di, false)) ? [dk, di] : null;
  dim(0.55);
  // 0.8.16 (mykee: full screen, bigger art before more text): on a phone the item's stage takes the height the rest of
  // the sheet leaves (the fail page's rule for the hen's stage) and runs the column's whole width, so a tall screen
  // shows a big egg or hen instead of a small picture and bands of paper. artH: the stage's height in units.
  const build = (artH) => (s, iw) => {
    const C = ui.C, B = it.btn, lines = wrapText(it.line, 16.5 * s, iw).slice(0, 4), AH = artH * s;
    return [
      { h: AH, gap: 4 * s, draw: (x, y, w) => {
        const aw = artH > 140 ? w : Math.min(w, 170 * s);
        ui.well(x + (w - aw) / 2, y, aw, AH, { s, a: '#cfe9fb', b: '#eaf6ff' });
        it.icon(ctx, x + w / 2, y + AH / 2, Math.min(AH * 0.9, aw * 0.8), G.t, it.flash < 0.6 ? 1 + 0.2 * Math.sin((it.flash / 0.6) * Math.PI) : 1);
        ui.record({ x: x + (w - aw) / 2, y, w: aw, h: AH }, 'dt:art');
      } },
      ...lines.map((l, i) => lineBlock(l, 16.5 * s, { color: C.ink, tag: 'dt:line' + i, gap: i ? 2 * s : 10 * s })),
      ...(it.perk ? [{ ...perkRow(it.perk, s, 10 * s), right: true }] : []), // an egg skin's power: the icon, its name and four words
      ...(it.parts || []).map((P, i) => partRow(P, s, 'dt:part' + i, i ? 2 * s : 10 * s)), // a kit or a set: what is inside, one row each
      ...(it.sub && it.sub.strike ? [{ h: 24 * s, gap: 6 * s, draw: (x, y, w) => { // a half-price ticket in hand: the old price struck through, and what the ticket does
        const was = it.sub.text, tail = '  Half price with your ticket', fs = 15 * s, ww = ui.measure(was, fs), tw2 = ui.measure(tail, fs), x0 = x + (w - ww - tw2) / 2, cy = y + 12 * s;
        ui.text(was, x0, cy, { size: fs, color: it.sub.color, tag: 'dt:was' });
        ctx.save(); ctx.strokeStyle = '#e8402e'; ctx.lineWidth = 2.4 * s; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0 - 2 * s, cy + fs * 0.18); ctx.lineTo(x0 + ww + 2 * s, cy - fs * 0.18); ctx.stroke(); ctx.restore();
        ui.text(tail, x0 + ww, cy, { size: fs, color: '#7a48e8', maxW: w - ww, tag: 'dt:sub' });
      } }] : it.sub ? [lineBlock(it.sub.text, 14 * s, { color: it.sub.color, tag: 'dt:sub', gap: 5 * s })] /* 0.8.16: stays with the words above it when the page shares out its air */ : []),
      { right: true, h: 56 * s, gap: 14 * s, draw: (x, y, w) => ui.button(B.id, B.label, x, y, w, 56 * s, { kind: B.kind, disabled: B.disabled, keepFace: B.keepFace, dim: B.keepFace ? 1 : undefined, icon: B.coin ? (c, X, Y, S) => drawCoin(c, X, Y, S * 0.5, G.t) : B.icon || null, size: 22 * s, shimmer: !B.disabled && B.kind !== 'off' }) },
      ...(tryK && it.perk && !it.trying ? [{ ...lineBlock('The power comes with it.', 14 * s, { color: C.ink2, tag: 'dt:perkfree', gap: 8 * s }), right: true }] : []),
      ...(tryK ? [{ right: true, h: 50 * s, gap: 10 * s, draw: (x, y, w) => it.trying // 2026-11-20: "Try it free" (worn for the next levels)
        ? ui.button('try:on', `Trying: ${DR.trials(save)[tryK[0]].left} level${DR.trials(save)[tryK[0]].left > 1 ? 's' : ''} left`, x, y, w, 50 * s, { kind: 'secondary', disabled: true, keepFace: true, dim: 1, size: 18 * s })
        : ui.button('try:' + tryK.join(':'), 'Try it free', x, y, w, 50 * s, { kind: 'secondary', size: 20 * s }) }] : []),
      { right: true, h: 50 * s, gap: 10 * s, draw: (x, y, w) => ui.button('dt:close', 'Close', x, y, w, 50 * s, { kind: 'tertiary', size: 20 * s }) },
    ];
  };
  let artH = 140;
  const A = ui.A, u = ui.u;
  if (cardFull({}, A)) {
    const rest = build(0)(1, fullInner(A, u) / u).reduce((a, b) => a + (b.gap ?? 10) + b.h, 0) + CARD_HEAD + 22;
    artH = clamp((A.y1 - A.y - 30 * u) / u - rest - 40, 140, 380); // (up to a square stage)
  }
  stackCard(it.name, build(artH), { ribbon: '#7a48e8', grow: 1.2, twoCol: true }); // 0.8.16: landscape: the picture and its words left, the power and the buttons right
}
// an egg skin's power on its sheet: the icon in a cell, then "Name: four words"
const perkRow = (P, s, gap) => ({ h: 44 * s, gap, draw: (x, y, w) => {
  ui.roundRect(x + 2 * s, y, w - 4 * s, 44 * s, 11 * s); ctx.fillStyle = 'rgba(122,72,232,0.14)'; ctx.fill();
  ui.roundRect(x + 6 * s, y + 4 * s, 36 * s, 36 * s, 9 * s); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill();
  pictoPerk(ctx, P.icon, x + 24 * s, y + 22 * s, 30 * s, G.t);
  ui.text(P.name, x + 50 * s, y + 15 * s, { size: 16 * s, maxW: w - 58 * s, color: ui.C.ink, tag: 'dt:perkname' });
  ui.text(P.line, x + 50 * s, y + 33 * s, { size: 13.5 * s, maxW: w - 58 * s, color: '#5a2ea8', tag: 'dt:perkline' });
} });
// one "what you get" row: the part's art in a small cell, then its words (a kit's boosts, a set's outfit and egg)
const partRow = (P, s, tag, gap, o = {}) => ({ h: 40 * s, gap, draw: (x, y, w) => {
  ui.roundRect(x + 2 * s, y + 2 * s, 36 * s, 36 * s, 9 * s); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill();
  drawPart(ctx, P.art, x + 20 * s, y + 20 * s, 34 * s, G.t);
  ui.text(P.text, x + 48 * s, y + 20 * s, { size: 16 * s, maxW: w - 52 * s, color: ui.C.ink, tag, noRecord: o.noRecord });
} });
// 0.8.17 THE PAY PAGE (mykee: "Do you really think the user will find it attractive and pay for something this sloppy?
// ... make it seamless, make it really cool"), G.detail 'iap:<sku>': a page of its own over the shop, one layout for
// every real-money product. A warm stage with slow rays shows what is bought (Unlock Everything: the Golden Hen on her
// coins, the golden egg, the six power chicks in an arc round her, each in its own idle: the chicks ARE the list of
// chicks); under it equal perk tiles, picture first and at most three words (a tap shows the one-line detail in place),
// or for coins the one amount; then one big buy button with the price in it and the value sticker on its corner, a quiet
// "One-time purchase" and a text "Not now". The round close button sits top left. Leftover height is shared as even
// gaps; landscape puts the stage left and the rest right. Calm: the rays and the cast stand still, nothing pops in.
const PAY = { key: null, t0: 0 }; // the page's own clock: its entrance plays once per opening
const payNum = (v) => v.toLocaleString('en-US');
const strikeName = (id) => (STRIKE[id] || {}).name || id;
// the perk tiles: [{ art, label (three words at most), line (the detail a tap shows) }]; [] for coins and the bank
function payTiles(sku) {
  const P = E.IAP[sku], B = E.bundleParts(sku), n = LEVELS.length;
  if (!P || !B || P.bank || E.COIN_PACKS.includes(sku)) return [];
  const chicks = B.chicks.map((id) => strikeName(id).replace(/ Chick$/, '')).join(', '); // (short: it fits its tile)
  if (sku === PREMIUM_SKU) return [
    { art: 'levels', label: `All ${n} levels`, line: `Every one of the ${n} levels open now` },
    { art: 'chicks', label: `${B.chicks.length} power chicks`, line: chicks },
    { art: 'coins', label: `${payNum(B.coins)} coins`, line: 'Straight into your purse' },
    { art: 'goldset', label: 'Golden Hen + egg', line: 'The Golden Hen outfit and the golden egg' },
    { art: 'daily', label: 'Free charge daily', line: 'A free Chick Charge every day' },
    { art: 'bonus', label: 'Every bonus instantly', line: 'Every bonus is yours at once' }, // 0.8.17 (mykee): no word about videos where people pay
  ];
  const T = [];
  if (B.coins) T.push({ art: 'coins', label: `${payNum(B.coins)} coins`, line: 'Straight into your purse' });
  if (B.premium) T.push({ art: 'levels', label: 'Everything unlocked', line: `All ${n} levels open, every bonus at once` });
  if (B.hens.length > 1) T.push({ art: 'hens', label: `${B.hens.length} hen outfits`, line: 'Every outfit in the shop' });
  else if (B.hens.length) T.push({ art: 'hen:' + B.hens[0], label: E.HEN_SKINS[B.hens[0]].name, line: 'A new outfit for your hen' });
  if (B.eggs.length > 1) T.push({ art: 'eggs', label: `${B.eggs.length} egg skins`, line: 'Every egg in the shop, each with its power' });
  if (B.chicks.length) T.push({ art: 'chicks', label: `${B.chicks.length} power chicks`, line: chicks });
  if (B.charges) T.push({ art: 'charge', label: `${B.charges} Chick Charges`, line: 'Send a chick at the villains' });
  if (B.boosts) T.push({ art: 'boosts', label: `${B.boosts * E.BOOSTER_ORDER.length} boosts`, line: `${B.boosts} of every boost` });
  if (B.ally) T.push({ art: 'ally', label: `${B.ally} Ally Tickets`, line: 'Call a farm friend into a level' });
  if (B.daily) T.push({ art: 'daily', label: 'Free charge daily', line: 'A free Chick Charge every day' });
  return T;
}
const PAY_VERB = { eggscape_premium: 'Unlock all', eggscape_collector: 'Get it all', egg_bank: 'Crack it' };
const payHero = (sku) => sku === PREMIUM_SKU || sku === 'eggscape_collector';
// a picture on a tile: the store's part art, plus the Golden Hen with her egg
function payArt(art, cx, cy, c, t) {
  if (art === 'goldset') { drawHenSkinPreview(ctx, 'golden', cx - c * 0.12, cy + c * 0.02, c * 0.86, t); drawSkinPreview(ctx, 'golden', cx + c * 0.3, cy + c * 0.16, c * 0.4, t); return; }
  drawPart(ctx, art, cx, cy, c, t);
}
// a mound of coins standing on by (its foot), w wide, rows high (the widest row at the bottom). Returns its height.
function coinHeap(cx, by, w, rows, t) {
  const r = w / ((rows + 2) * 1.45);
  for (let k = 0; k < rows; k++) {
    const n = rows + 2 - k, yy = by - r - k * r * 0.8;
    for (let i = 0; i < n; i++) drawCoin(ctx, cx + (i - (n - 1) / 2) * r * 1.45 + (k % 2 ? r * 0.1 : 0), yy, r, t + i * 0.7 + k * 1.3);
  }
  return r * 2 + (rows - 1) * r * 0.8;
}
// a sparkle that twinkles at a hashed spot of the stage (still when calm)
function payTwinkles(x, y, w, h, t, n, calm) {
  for (let i = 0; i < n; i++) {
    const hx = (Math.sin(i * 91.7 + 3.1) * 43758.5) % 1, hy = (Math.sin(i * 47.3 + 1.7) * 24634.6) % 1;
    const tw = calm ? 0.8 : Math.max(0, Math.sin(t * (1.3 + (i % 3) * 0.4) + i * 2.1));
    CB.glint(ctx, x + Math.abs(hx) * w, y + Math.abs(hy) * h * 0.7, (5 + (i % 3) * 2.5) * ui.u * tw, i % 3 ? '#fff6c8' : '#ffffff');
  }
}
// one power chick in its own idle (i picks it: a hop, a flap, a head tilt, a look round, a wobble, a stretch)
function chickIdle(id, i, x, y, sz, t, calm, flip) {
  const o = { flip, shadow: false }, ph = t + i * 1.37;
  let dy = 0;
  if (!calm) switch (i % 6) {
    case 0: { const k = Math.max(0, Math.sin(ph * 3.1)); dy = -k * sz * 0.16; o.squash = k < 0.2 ? 0.18 * (1 - k / 0.2) : 0; break; }
    case 1: o.wing = Math.sin(ph * 0.9) > 0.35 ? Math.abs(Math.sin(ph * 8)) : 0; break;
    case 2: o.rot = Math.sin(ph * 1.6) * 0.13; o.look = { x: Math.sin(ph * 0.8), y: 0.2 }; break;
    case 3: o.look = { x: Math.sin(ph * 1.1) > 0 ? 1 : -0.6, y: Math.cos(ph * 0.7) * 0.4 }; break;
    case 4: o.squash = Math.sin(ph * 4.2) * 0.12; break;
    default: { const k = Math.max(0, Math.sin(ph * 2.2)); dy = -k * k * sz * 0.1; o.stretch = k * 0.1; o.wing = k > 0.85 ? 1 : 0; }
  }
  ctx.save(); ctx.fillStyle = 'rgba(70,30,0,0.22)'; ctx.beginPath(); ctx.ellipse(x, y + sz * 0.57, sz * 0.38 * (1 + dy / sz), sz * 0.07, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  drawStrikeChick(ctx, id, x, y + dy, sz, calm ? 1.3 + i : t, o);
}
// the hen in an outfit, alive (her own idle and cheers), then the player's own outfit back
function henAs(skin, mood, x, y, h, o = {}) {
  setHenSkin(skin);
  try { drawHenAnim(ctx, mood, x, y, h, G.t, { calm: save.calm, shadow: 0, ...o }); } finally { setHenSkin(G.henSkinCur || 'classic'); }
}
// where the stage's chicks stand: an arc round the middle, half each side, the outer ones further up (a group photo)
function payChickSpots(n, cx, floor, w, h) {
  const L = Math.ceil(n / 2), out = [];
  for (let i = 0; i < n; i++) {
    const left = i < L, j = left ? i : i - L, m = left ? L : n - L, k = m > 1 ? j / (m - 1) : 0;
    out.push({ x: cx + (left ? -1 : 1) * w * (0.22 + 0.185 * k), y: floor - h * (0.02 + 0.13 * k * k + 0.09 * k), back: k > 0.5, flip: !left });
  }
  return out;
}
// the stage: a warm window with slow rays and sparkles, and the product's own cast. o: { age (s since the page opened;
// the cast pops in), henDX (the hen's walk-in offset), henMood, chickK (i => 0..1 pop), lockA (i => lock state or null) }
function payStage(sku, x, y, w, h, s, o = {}) {
  const calm = save.calm, t = G.t, P = E.IAP[sku], cx = x + w / 2, age = calm ? 9 : o.age ?? 9;
  ctx.save();
  ui.roundRect(x, y, w, h, 22 * s);
  const g = ctx.createRadialGradient(cx, y + h * 0.55, 0, cx, y + h * 0.55, Math.max(w, h) * 0.75);
  g.addColorStop(0, '#fff3c2'); g.addColorStop(0.45, '#ffd36a'); g.addColorStop(1, '#e98a1e');
  ctx.fillStyle = g; ctx.fill();
  ctx.clip();
  CB.rays(ctx, cx, y + h * 0.5, Math.hypot(w, h) * 0.7, calm ? 0.2 : t * 0.1, 'rgba(255,255,255,0.22)', 14, 0.5);
  CB.glow(ctx, cx, y + h * 0.5, Math.min(w, h) * 0.55, 0.65);
  const floor = y + h * 0.9;
  ctx.fillStyle = 'rgba(160,80,10,0.18)'; ctx.beginPath(); ctx.ellipse(cx, floor + h * 0.02, w * 0.48, h * 0.09, 0, 0, Math.PI * 2); ctx.fill();
  payTwinkles(x, y, w, h, t, 9, calm);
  const pop = (d, px, py, draw) => { const k = calm ? 1 : backK((age - d) / 0.36); if (k <= 0.01) return; ctx.save(); ctx.translate(px, py); ctx.scale(k, k); ctx.translate(-px, -py); draw(); ctx.restore(); };
  const H = Math.min(h * 0.56, w * (o.big ? 0.5 : 0.44)); // (the party's taller stage takes a bigger cast)
  if (sku === 'eggscape_collector') { // The Whole Coop: three hens in their best outfits on a wide heap, a row of eggs in front
    const Hc = H * 0.88;
    pop(0.04, cx, floor, () => {
      const hh = coinHeap(cx, floor, Math.min(w * 0.62, Hc * 1.5), 2, t);
      henAs('pirate', 'idle', cx - Hc * 0.66, floor - hh * 0.62 - Hc * 0.36, Hc * 0.76, { key: 'payA', face: 1, phase: 0.4 });
      henAs('santa', 'idle', cx + Hc * 0.66, floor - hh * 0.62 - Hc * 0.36, Hc * 0.76, { key: 'payB', face: -1, phase: 0.9 });
      henAs('golden', o.henMood || 'idle', cx + (o.henDX || 0), floor - hh * 0.78 - Hc * 0.45, Hc, { key: 'pay', face: 1, n: o.henN || 0, look: o.henLook });
    });
    const eggs = ['galaxy', 'thunder', 'lava', 'pearl', 'robot'], es = Math.min(H * 0.3, w * 0.12);
    eggs.forEach((e, i) => pop(0.16 + 0.05 * i, cx + (i - 2) * es * 1.05, floor + es * 0.05 - (i % 2) * es * 0.12, () => drawSkinPreview(ctx, e, cx + (i - 2) * es * 1.05, floor + es * 0.05 - (i % 2) * es * 0.12, es, t + i)));
  } else if (sku === PREMIUM_SKU) {
    const ids = E.bundleParts(sku).chicks, cs = Math.min(H * 0.42, w * (ids.length > 6 ? 0.11 : 0.14)), spots = payChickSpots(ids.length, cx, floor - cs * 0.55, w, h);
    const chick = (i) => { const p = spots[i], k = o.chickK ? o.chickK(i) : 1, L = o.lockA ? o.lockA(i) : null;
      if (L != null) { // a padlock stands where the chick will be; it shakes, then bursts open
        const a = clamp(L, 0, 1), sh = a < 0.5 && !calm ? Math.sin(G.t * 60) * 0.12 * (a / 0.5) : 0;
        if (a < 0.55) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(sh); ctx.globalAlpha *= a < 0.45 ? 1 : 1 - (a - 0.45) / 0.1; drawPadlock(0, 0, cs * 0.5 * (1 + Math.max(0, a - 0.4) * 1.5), null); ctx.restore(); }
        if (a > 0.45) { CB.burst(ctx, p.x, p.y, cs * 0.9, (a - 0.45) / 0.55); CB.sparks(ctx, p.x, p.y, cs * 0.4, (a - 0.45) / 0.55, 8, i); }
      }
      if (k > 0.01) { ctx.save(); ctx.translate(p.x, p.y); ctx.scale(k, k); ctx.translate(-p.x, -p.y); chickIdle(ids[i], i, p.x, p.y, cs * (p.back ? 0.9 : 1), t, calm, p.flip); ctx.restore(); }
    };
    const order = spots.map((p, i) => i).sort((a, b) => spots[a].y - spots[b].y);
    const back = order.filter((i) => spots[i].back), front = order.filter((i) => !spots[i].back);
    back.forEach((i) => pop(0.2 + 0.05 * i, spots[i].x, spots[i].y, () => chick(i)));
    const hx = cx + (o.henDX || 0);
    pop(0.04, cx, floor, () => {
      const hh = coinHeap(cx, floor, H * 1.05, 3, t);
      henAs('golden', o.henMood || 'idle', hx - H * 0.04, floor - hh * 0.78 - H * 0.45, H, { key: 'pay', face: 1, n: o.henN || 0, look: o.henLook });
      drawSkinPreview(ctx, 'golden', cx + H * 0.42, floor - hh * 0.5 - H * 0.13, H * 0.34, t);
    });
    front.forEach((i) => pop(0.12 + 0.05 * i, spots[i].x, spots[i].y, () => chick(i)));
  } else if (sku === 'starter_nest' || sku === 'bundle_helper') {
    pop(0.04, cx, floor, () => {
      const hh = coinHeap(cx, floor, H * 0.95, 3, t);
      if (sku === 'starter_nest') henAs(P.hen || 'cocoa', 'idle', cx, floor - hh * 0.78 - H * 0.45, H, { key: 'pay', face: 1 });
      else { chickIdle('freeze', 0, cx - H * 0.27, floor - hh * 0.8 - H * 0.24, H * 0.46, t, calm, false); chickIdle('thunder', 3, cx + H * 0.29, floor - hh * 0.8 - H * 0.22, H * 0.44, t, calm, true); }
    });
    const side = H * 0.42, bx = Math.min(w * 0.36, H * 1.05);
    pop(0.16, cx - bx, floor - side * 0.5, () => { drawBoosterIcon(ctx, 'stone', cx - bx - side * 0.16, floor - side * 0.42, side * 0.8, t); drawBoosterIcon(ctx, 'golden', cx - bx + side * 0.34, floor - side * 0.36, side * 0.72, t + 1); });
    pop(0.22, cx + bx, floor - side * 0.5, () => {
      if (sku === 'bundle_helper') drawItemArt(ctx, 'ally', cx + bx, floor - side * 0.55, side * 1.25, t);
      else drawStrikeToken(ctx, 'freeze', cx + bx, floor - side * 0.55, side * 0.42, t, true);
    });
  } else if (P.bank) {
    const b = save.wallet.bank || 0;
    pop(0.04, cx, floor - h * 0.4, () => drawGlassEgg(ctx, cx, floor - h * 0.42, Math.min(h * 0.74, w * 0.55), Math.min(1, b / E.BANK_CAP), t));
  } else { // a coin pack: its pile, bigger the bigger the pack
    const k = E.COIN_PACKS.indexOf(sku);
    pop(0.04, cx, floor, () => coinHeap(cx, floor, Math.min(w * (0.6 + 0.07 * k), h * (0.8 + 0.08 * k)), 3 + k, t));
  }
  ctx.restore();
  ctx.save(); ui.roundRect(x, y, w, h, 22 * s); ctx.lineWidth = 3 * s; ctx.strokeStyle = '#ffe9a0'; ctx.stroke(); ui.roundRect(x - 2 * s, y - 2 * s, w + 4 * s, h + 4 * s, 24 * s); ctx.lineWidth = 2 * s; ctx.strokeStyle = 'rgba(60,20,0,0.6)'; ctx.stroke(); ctx.restore();
  if (!o.noRecord) ui.record({ x, y, w, h }, 'pay:stage');
}
// a round close glyph (white X with a dark edge) for the page's top-left button
const xIcon = (c, X, Y, S) => { c.save(); c.lineCap = 'round'; for (const [col, lw] of [['rgba(20,8,0,0.6)', S * 0.26], ['#fff', S * 0.16]]) { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.moveTo(X - S * 0.22, Y - S * 0.22); c.lineTo(X + S * 0.22, Y + S * 0.22); c.moveTo(X + S * 0.22, Y - S * 0.22); c.lineTo(X - S * 0.22, Y + S * 0.22); c.stroke(); } c.restore(); };
// one perk tile: the picture first, then its three words (tapped: the one-line detail in their place)
function payTile(T, i, x, y, w, h, s, t, tip) {
  const tag = 'pay:tile:' + i, across = w > h * 1.45;
  ui.roundRect(x, y + 3 * s, w, h, 14 * s); ctx.fillStyle = 'rgba(16,4,34,0.4)'; ctx.fill();
  ui.roundRect(x, y, w, h, 14 * s);
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, tip ? '#fff3c4' : '#fffaf0'); g.addColorStop(1, tip ? '#ffd97a' : '#f5deb0');
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2 * s; ctx.strokeStyle = '#e7b04a'; ctx.stroke();
  ui.record({ x, y, w, h }, tag, tag);
  ui.buttons.push({ id: 'pay:tip:' + i, x, y, w, h });
  const str = tip ? T.line : T.label, nMax = tip ? (across ? 4 : 3) : 2;
  let fs = tip ? (across ? 14 * s : 12.5 * s) : across ? 18 * s : 15.5 * s;
  const fitL = (mw) => { let L = wrapText(str, fs, mw); while (L.length > nMax && fs > 10.5 * s) { fs *= 0.93; L = wrapText(str, fs, mw); } return L.slice(0, nMax); };
  if (across) {
    const c = Math.min(h * 0.8, w * 0.36), tx = x + 12 * s + c, tw = x + w - 8 * s - tx, L = fitL(tw);
    payArt(T.art, x + 6 * s + c / 2, y + h / 2, c, t);
    L.forEach((l, q) => ui.text(l, tx + tw / 2, y + h / 2 + (q - (L.length - 1) / 2) * fs * 1.15, { size: fs, align: 'center', maxW: tw, color: ui.C.ink, tag: `${tag}:l${q}`, group: tag }));
  } else {
    const L = fitL(w - 10 * s), th = L.length * fs * 1.12, c = Math.min(w * 0.62, h - th - 14 * s);
    payArt(T.art, x + w / 2, y + 6 * s + c / 2, c, t);
    const ty = y + h - 7 * s - th + fs * 0.56;
    L.forEach((l, q) => ui.text(l, x + w / 2, ty + q * fs * 1.12, { size: fs, align: 'center', maxW: w - 8 * s, color: ui.C.ink, tag: `${tag}:l${q}`, group: tag }));
  }
}
// the buy button: big, the verb and the price in a white tag, a shine sweep, the value sticker on its corner
function payBuy(sku, x, y, w, h, s, can, price) {
  const id = 'iap:' + sku, hero = payHero(sku);
  if (!can) { ui.button('dt:owned', E.IAP[sku].bank ? `Opens at ${E.BANK_OPEN}` : 'Yours', x, y, w, h, { kind: 'tertiary', disabled: true, keepFace: true, dim: 1, icon: E.IAP[sku].bank ? null : ICON.check, size: 21 * s }); return; }
  const b = ui.button(id, '', x, y, w, h, { kind: hero ? 'gold' : 'primary', shimmer: !save.calm });
  const line = hero ? '#6b3d04' : '#134f0f', verb = PAY_VERB[sku] || (E.COIN_PACKS.includes(sku) ? 'Buy' : 'Get it');
  let ls = 26 * s, ps = 22 * s;
  const fit = () => ui.measure(verb, ls) + 14 * s + ui.measure(price, ps) + 26 * s;
  while (fit() > w - 34 * s && ls > 15 * s) { ls *= 0.94; ps *= 0.94; }
  const pw = ui.measure(price, ps) + 26 * s, ph = ps * 1.5, x0 = x + w / 2 - fit() / 2;
  ui.text(verb, x0, b.cy, { size: ls, color: '#fff', stroke: line, strokeW: Math.max(2 * s, ls * 0.15), shadow: line, shadowD: ls * 0.07, noRecord: true });
  const px = x0 + ui.measure(verb, ls) + 14 * s;
  ui.roundRect(px, b.cy - ph / 2, pw, ph, ph / 2); ctx.fillStyle = '#fffaea'; ctx.fill(); ctx.lineWidth = 2 * s; ctx.strokeStyle = line; ctx.stroke();
  ui.text(price, px + pw / 2, b.cy + 0.5 * s, { size: ps, align: 'center', color: hero ? '#8a4a00' : '#1f6a17', noRecord: true });
  const r = Math.min(31 * s, h * 0.5);
  valueBadge(ui, ctx, E.bundleTimes(sku), x + w - r * 0.7, y - r * 0.12, r, s, G.t, 'pay:value', 'btn:' + id); // the same numbers as the value line used to
}
// (the name stays: every way in, the shop's cards, Home's Unlock all, Settings and the offers, opens it)
function drawIapSheet(sku) {
  const P = E.IAP[sku], can = E.iapAvailable(save.wallet, sku), price = ads.price(sku), calm = save.calm, A = ui.A;
  if (PAY.key !== sku || G.t < PAY.t0) { PAY.key = sku; PAY.t0 = G.t; G.payTip = null; if (!calm) audio.play('ui_open'); }
  ui.calm = calm;
  const age = calm ? 9 : G.t - PAY.t0, tiles = payTiles(sku), once = P.type === 'once';
  // the page: a deep purple ground with a warm glow where the stage stands
  ctx.save();
  const bg = ctx.createLinearGradient(0, 0, 0, H_); bg.addColorStop(0, '#41206e'); bg.addColorStop(1, '#1c0b34');
  ctx.globalAlpha = calm ? 1 : clamp(age / 0.18, 0, 1);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W_, H_);
  ctx.restore();
  const Pb = ui.pageBox(), s = Pb.s, X = Pb.x, W = Pb.w, wide = A.w > A.h * 1.15;
  // the header: the round close button, the name on its ribbon
  ui.button('dt:close', '', X, Pb.y, Pb.h, Pb.h, { kind: 'hud', icon: xIcon, iconS: 1.15, round: Pb.h / 2 });
  const rw = Math.min(ui.measure(P.name, 25 * s) + 56 * s, W - 2 * (Pb.h + 26 * s));
  ui.ribbon(P.name, A.cx, Pb.y + 2 * s, rw, Pb.h - 6 * s, { s, color: payHero(sku) ? '#d89a1c' : '#8a5ad8', size: Math.min(25 * s, 25 * s * (rw - 30 * s) / ui.measure(P.name, 25 * s)), tag: 'card:title' });
  const top = Pb.bottom, bottom = A.y1 - 10 * s;
  const note = G.payNote && G.payNote.sku === sku && G.t - G.payNote.t0 < 4 ? 'No payment was made' : once && can ? 'One-time purchase' : '';
  const btnH = 70 * s, noteH = note ? 22 * s : 0, notH = 46 * s, amt = !tiles.length;
  const amountStr = P.bank ? payNum(save.wallet.bank || 0) : amt ? payNum(P.coins || 0) : '';
  const gT = 10 * s;
  // the column(s): portrait stacks stage, tiles, button; landscape puts the stage left and the rest right
  const RX = wide ? X + W - Math.min(440 * s, (W - 18 * s) / 2) : X, RW = wide ? X + W - RX : W;
  const cols = wide ? (tiles.length === 4 ? 4 : 3) : tiles.length === 4 ? 2 : 3, rows = tiles.length ? Math.ceil(tiles.length / cols) : 0, tw = (RW - (cols - 1) * gT) / cols;
  const fixedB = btnH + (noteH ? 8 * s + noteH : 0) + 4 * s + notH; // the button, its quiet line, Not now
  const minG = [12 * s, 14 * s, 30 * s, 6 * s]; // header-stage, stage-tiles, tiles-button (the sticker's room), Not now-bottom
  let th = tiles.length ? clamp(tw * (cols === 2 ? 0.5 : 0.82), 76 * s, 118 * s) : 0;
  const amtH = amt ? 70 * s : 0;
  let stage, Y0, gaps;
  if (!wide) {
    const block = () => (rows ? rows * th + (rows - 1) * gT : amtH);
    let room = bottom - top - fixedB - block() - minG.reduce((a, b) => a + b, 0);
    if (room < 170 * s && rows) { th = Math.max(64 * s, th - (170 * s - room) / rows); room = bottom - top - fixedB - block() - minG.reduce((a, b) => a + b, 0); }
    const sh = clamp(room, 120 * s, Math.min(W * 1.02, 470 * s)), extra = Math.max(0, room - sh) / 4;
    gaps = minG.map((g) => g + extra);
    stage = { x: X, y: top + gaps[0], w: W, h: sh };
    Y0 = stage.y + sh + gaps[1];
  } else {
    stage = { x: X, y: top + 12 * s, w: RX - X - 18 * s, h: bottom - top - 12 * s };
    const blockMax = bottom - top - fixedB - 12 * s - 30 * s - 6 * s;
    if (rows) th = clamp((blockMax - (rows - 1) * gT) / rows, 60 * s, Math.min(tw * 0.95, 118 * s));
    const used = (rows ? rows * th + (rows - 1) * gT : amtH) + 30 * s + fixedB, free = Math.max(0, bottom - top - 12 * s - used);
    gaps = [0, 0, 30 * s + Math.min(free * 0.2, 20 * s), 0]; // a little more air above the button, the rest above and below
    Y0 = top + 12 * s + (free - (gaps[2] - 30 * s)) / 2;
  }
  payStage(sku, stage.x, stage.y, stage.w, stage.h, s, { age });
  let y = Y0;
  const popIn = (d, cx, cy, draw) => { const k = calm ? 1 : backK((age - d) / 0.34); if (k <= 0.01) return; ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy); draw(); ctx.restore(); };
  if (rows) {
    const tip = G.payTip && G.payTip.sku === sku && G.t - G.payTip.t0 < 4 ? G.payTip.i : -1;
    tiles.forEach((T, i) => {
      const r = Math.floor(i / cols), k = i % cols, inRow = Math.min(cols, tiles.length - r * cols), x0 = RX + (RW - (inRow * tw + (inRow - 1) * gT)) / 2 + k * (tw + gT), y0 = y + r * (th + gT);
      popIn(0.22 + 0.045 * i, x0 + tw / 2, y0 + th / 2, () => payTile(T, i, x0, y0, tw, th, s, G.t, i === tip));
    });
    y += rows * th + (rows - 1) * gT;
  } else { // one clear amount: the coin and the number
    const ns = 52 * s, nw = ui.measure(amountStr, ns), cw = ui.measure('coins', 24 * s), total = 48 * s + 12 * s + nw + 10 * s + cw, x0 = RX + RW / 2 - total / 2, cy = y + amtH / 2;
    popIn(0.2, RX + RW / 2, cy, () => {
      drawCoin(ctx, x0 + 24 * s, cy, 23 * s, G.t);
      ui.num(amountStr, x0 + 60 * s, cy, { size: ns, tag: 'pay:amt', maxW: RW - 140 * s });
      ui.text('coins', x0 + 70 * s + nw, cy + 6 * s, { size: 24 * s, color: '#ffe9b0', tag: 'pay:unit' });
    });
    y += amtH;
  }
  y += gaps[2];
  popIn(0.36, RX + RW / 2, y + btnH / 2, () => payBuy(sku, RX, y, RW, btnH, s, can, price));
  y += btnH;
  if (noteH) { y += 8 * s; ui.text(note, RX + RW / 2, y + noteH / 2, { size: 15 * s, align: 'center', color: 'rgba(255,236,206,0.78)', maxW: RW, tag: 'pay:once' }); y += noteH; }
  y += 4 * s;
  ui.button('dt:close', 'Not now', RX, y, RW, notH, { ghost: true, textColor: 'rgba(255,240,220,0.92)', size: 19 * s });
}

// 0.8.17 THE UNLOCK PARTY (mykee: "Even unlocking things could be as celebratory as possible"): Unlock Everything or The
// Whole Coop bought, a full-screen moment built from what was bought. Confetti; the Golden Hen struts in onto her coins;
// a padlock stands where each power chick will be, shakes and bursts, and the chick pops out with its own sound; then the
// coins: the shared "YOU GOT!" reveal (gotIap, drawGot) flies them into the purse over this stage; and when that closes
// the stage stays, everyone in place, over one big PLAY. A tap skips to the coins. Calm: the still picture, no confetti,
// nothing walks or breaks; the reveal comes at once.
// G.party = { sku, t0, phase: 'show' | 'got' (drawGot runs over it) | 'end', cues, tE }
const PARTY = { in: 0.95, ch0: 1.2, gap: 0.28 };
const CHICK_SND = { freeze: 'frost_lick', thunder: 'thunder', bomb: 'bomb_fuse', decoy: 'decoy_peep', tornado: 'wind_gust', glue: 'squish', phoenix: 'fire_ignite', tock: 'motor_tick', bubble: 'bubble_pop' };
function startParty(sku) {
  G.party = { sku, t0: G.t, phase: 'show', cues: 0, arrived: false };
  G.detail = null; G.parent = null; G.payBack = false;
  const P = E.IAP[sku]; if (P && P.coins) purse.hold(Math.max(0, save.wallet.coins - P.coins)); // the purse shows the old total until the reveal flies the coins in
  if (save.calm) { G.party.phase = 'got'; gotIap(sku); return; }
  audio.play('tada'); buzz('treasure');
}
const partyEnd = (n) => PARTY.ch0 + PARTY.gap * n + 0.55; // the coins' beat
function drawParty(under) {
  const R = G.party, calm = save.calm, A = ui.A, u = ui.u, P = E.IAP[R.sku];
  if (!P) { G.party = null; return; }
  const ids = R.sku === PREMIUM_SKU ? E.bundleParts(R.sku).chicks : [], n = ids.length; // (the Coop's stage shows its hens and eggs)
  if (!under && R.phase === 'got' && !G.got) { R.phase = 'end'; R.tE = G.t; }
  const t = R.phase === 'show' ? G.t - R.t0 : 99, show = R.phase === 'show';
  if (show && !calm) { // the cues: the hen arrives, each padlock bursts with its chick's own sound, then the coins
    if (!R.arrived && t >= PARTY.in) { R.arrived = true; audio.play('flap', { vol: 0.6 }); audio.play('cluck', { vol: 0.8 }); }
    while (R.cues < n && t >= PARTY.ch0 + PARTY.gap * R.cues) { const id = ids[R.cues]; audio.play('glass_break', { vol: 0.35, pitch: 1.5 }); audio.play(CHICK_SND[id] || 'decoy_peep', { vol: 0.45 }); R.cues++; buzz('tap'); }
    if (t >= partyEnd(n)) { R.phase = 'got'; gotIap(R.sku); }
  }
  ctx.save();
  const bg = ctx.createLinearGradient(0, 0, 0, H_); bg.addColorStop(0, '#41206e'); bg.addColorStop(1, '#1c0b34');
  ctx.globalAlpha = calm || !show ? 1 : clamp(t / 0.2, 0, 1);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W_, H_);
  ctx.restore();
  const Pb = ui.pageBox(), s = Pb.s, X = Pb.x, W = Pb.w, wide = A.w > A.h * 1.15;
  const title = R.sku === PREMIUM_SKU ? 'Everything unlocked!' : 'The whole coop is yours!';
  const coinW = Math.max(84 * s, ui.measure(String(purse.shown()).replace(/\d/g, '0'), 19 * s) + 56 * s);
  const rw = Math.min(ui.measure(title, 25 * s) + 56 * s, W - 2 * (Math.max(Pb.h, coinW) + 22 * s));
  const playH = 72 * s, top = Pb.bottom + 12 * s, bottom = A.y1 - 12 * s;
  // the stage: as big as the page allows above the PLAY button (landscape: a wide window, PLAY under it)
  const sw = wide ? Math.min(W, (bottom - top - playH - 18 * s) * 1.9) : W, sh = Math.min(wide ? bottom - top - playH - 18 * s : sw * 1.5, bottom - top - playH - 40 * s);
  const gapE = Math.max(0, bottom - top - sh - playH) / 3, sx = A.cx - sw / 2, sy = top + gapE;
  const lockA = (i) => { const tb = PARTY.ch0 + PARTY.gap * i; if (!show || t < 0.3 + 0.05 * i) return null; const a = (t - (tb - 0.22)) / 0.5; return a >= 1 ? null : Math.max(0, a); };
  const chickK = (i) => (show ? (calm ? 1 : backK((t - (PARTY.ch0 + PARTY.gap * i)) / 0.34)) : 1);
  const walk = show && !calm ? smooth01(t / PARTY.in) : 1;
  payStage(R.sku, sx, sy, sw, sh, s, { age: 9, henDX: -(1 - walk) * (sw * 0.5 + A.w * 0.35), henLook: walk < 1 ? 1 : undefined, henMood: show && t < PARTY.in ? 'idle' : 'happy', henN: show ? (R.arrived ? 1 : 0) : 2 + Math.floor(G.t / 2.4), chickK, lockA, noRecord: under, big: !wide });
  if (!calm && show) { // confetti: a burst from the top, a second as the last chick lands
    CB.confetti(ctx, A.cx, A.y + A.h * 0.12, t - 0.05, { n: 70, speed: A.h * 0.9, g: A.h * 0.9, life: 2.6, seed: 7, size: Math.max(6, 8 * u), spread: Math.PI * 1.3, dir: Math.PI / 2 });
    CB.confetti(ctx, A.cx, sy + sh * 0.45, t - (PARTY.ch0 + PARTY.gap * (n - 1)), { n: 50, speed: sh * 1.6, g: sh * 1.4, life: 2.2, seed: 11, size: Math.max(6, 7 * u) });
  }
  ui.ribbon(title, A.cx, Pb.y + 2 * s, rw, Pb.h - 6 * s, { s, color: '#d89a1c', size: Math.min(25 * s, 25 * s * (rw - 30 * s) / ui.measure(title, 25 * s)), tag: 'card:title', noRecord: under });
  { // the purse, top right: the coins bought fly into it and it counts up (src/ui/purse.js)
    const cx0 = X + W - coinW, ch = Pb.h - 8 * s, cy0 = Pb.y + 4 * s, k = purse.pop();
    ctx.save(); ctx.translate(cx0 + coinW / 2, cy0 + ch / 2); ctx.scale(k, k); ctx.translate(-(cx0 + coinW / 2), -(cy0 + ch / 2));
    ui.glass(cx0, cy0, coinW, ch, { r: ch / 2, a: 'rgba(58,36,20,0.94)', b: 'rgba(28,16,8,0.94)', border: 'rgba(255,224,160,0.6)' });
    drawCoin(ctx, cx0 + ch / 2 + 2 * s, cy0 + ch / 2, ch * 0.34, G.t); purse.at({ x: cx0 + ch / 2 + 2 * s, y: cy0 + ch / 2 });
    ui.text(String(purse.shown()), cx0 + ch + 6 * s, cy0 + ch / 2 + 0.5 * s, { size: 19 * s, color: '#fff8e0', stroke: '#8a4a04', strokeW: 3 * s, maxW: coinW - ch - 14 * s, tag: 'party:coins', noRecord: under });
    ctx.restore();
  }
  if (under) return;
  if (show) { ui.buttons.push({ id: 'party:tap', x: -1e4, y: -1e4, w: 3e4, h: 3e4 }); return; } // a tap anywhere: on to the coins
  if (R.phase !== 'end') return;
  ui.button('party:close', '', X, Pb.y, Pb.h, Pb.h, { kind: 'hud', icon: xIcon, iconS: 1.15, round: Pb.h / 2 });
  const k = calm ? 1 : backK((G.t - R.tE) / 0.4), py = sy + sh + gapE, pw = wide ? Math.min(W, 460 * s) : W;
  if (k > 0.01) { ctx.save(); ctx.translate(A.cx, py + playH / 2); ctx.scale(k, k); ctx.translate(-A.cx, -(py + playH / 2)); ui.button('party:play', 'PLAY', A.cx - pw / 2, py, pw, playH, { kind: 'primary', icon: ICON.play, shimmer: !calm, size: 30 * s }); ctx.restore(); }
}
const smooth01 = (k) => { const x = clamp(k, 0, 1); return x * x * (3 - 2 * x); };

// 0.8.9 JACKPOT (mykee: "they should feel like they are hitting a jackpot"): a bundle, a coin pack, a kit, a set or the
// daily deal landing in the wallet plays "YOU GOT!": rays, the prize big, what was inside popping out one by one with
// its count, coins flying to the balance (which waits for them), a sound and a buzz. A tap skips to the end, the next
// closes it. Calm motion: the still end picture, nothing flies. Single coin tiles keep their quick flash.
const GOT_SHORT = { bonus: 'Every bonus', novideo: 'No videos', levels: 'All levels', daily: '+1 charge a day' };
function gotItems(rows) {
  const short = (t) => t.replace(/^\d+ of every boost \((\d+) in all\)$/, '$1 boosts').replace(' hen outfits', ' outfits').replace(' egg skins', ' eggs').replace(' power chicks', ' chicks').replace(' Chick Charges', ' charges').replace(' Ally Tickets', ' tickets').replace(/ outfit$/, '');
  return rows.map((R) => ({ art: R.art, label: GOT_SHORT[R.art] || (/^\d/.test(R.text) ? '+' + short(R.text) : short(R.text)) })).slice(0, 8);
}
function startGot(o) { // o: { name, sku?, key?, items: [{ art, label }], coins? (coins paid in, they fly) }
  const n = o.items.length;
  G.got = { t0: G.t, popped: 0, landed: false, ...o, end: 0.6 + 0.14 * n + 0.75, land: 0.6 + 0.14 * n + 0.6, coins0: o.coins0 ?? (o.coins > 0 ? Math.max(0, save.wallet.coins - o.coins) : null) }; // (o.coins0: the purse before, when more than these coins are still to land)
  land.clear(); // (0.8.17: its purse and bag chips are on the page from its first frame: drawGot starts the landing)
  G.detail = null;
  if (!o.quiet) { audio.play('tada'); buzz('treasure'); } // (the Lucky Spin's machine has played its own fanfare)
}
function gotIap(sku) {
  const P = E.IAP[sku];
  if (!P) return;
  const rows = P.bank ? [{ art: 'coins', text: 'Bank coins' }] : iapRows(sku, LEVELS.length);
  startGot({ name: P.name, sku, items: gotItems(rows), coins: rows[0] && rows[0].art === 'coins' ? (P.coins || 0) : 0 });
}
function drawGot() {
  const R = G.got, calm = save.calm, A = ui.A, u = ui.u, t = calm ? R.end + 1 : G.t - R.t0, ink = 'rgba(60,28,6,0.9)';
  if (!calm) {
    while (R.popped < R.items.length && t >= 0.6 + 0.14 * R.popped + 0.08) { R.popped++; audio.play('hud_pop', { vol: 0.7 }); }
    if (!R.landed && R.coins0 != null && t >= R.land) R.landed = true; // (the purse's own landing sounds and buzzes)
  }
  dim(0.84 * clamp(t / 0.18, 0, 1));
  // 0.8.17: on a phone held upright the top row belongs to the purse and the bag (ui/landing.js): the page starts under it
  // and the whole picture (headline to the last row) stands in the middle of the room left: even gaps above and below
  const top = A.h > A.w ? 62 * u : 0, S = Math.min(A.w * 0.9, (A.h - top) * 0.46, 420 * u), cx = A.cx, hh = S * 0.5, hs = Math.min(39 * u, 0.12 * S);
  const ws = Math.min(20 * u, 0.062 * S), WL = R.what ? wrapText(R.what, ws, Math.min(A.w - 48 * u, 380 * u)).slice(0, 3) : [], whatH = WL.length ? WL.length * ws * 1.3 + 0.03 * S : 0;
  const n = R.items.length, per = Math.max(1, Math.min(4, n)), rowsN = Math.ceil(n / per), cell = Math.min(S * 0.27, (A.w - 30 * u) / per);
  const ls = Math.max(13 * u, Math.min(18 * u, cell * 0.16)), rowH = cell * 0.78 + ls * 2.6;
  const willBag = R.items.some((it) => landWhere(it.art)), lineOn = R.line ? !(willBag && R.line === 'Added to your bag') : R.line !== '' && !willBag && R.coins0 == null; // (0.8.17: the purse and the bag chips show it)
  const above = 0.98 * S + hs * 0.85, below = 0.02 * S + whatH + rowsN * rowH + (lineOn ? 40 * u : 0), mid = A.y + top + (A.h - top) / 2;
  const cy = Math.max(A.y + top + above + 4 * u, Math.min(mid + (above - below) / 2, A.y1 - below - 8 * u)), heroY = cy - 0.42 * S;
  ctx.save(); ctx.globalAlpha = clamp(t / 0.18, 0, 1);
  sunburst(cx, heroY, S * 1.3, 'rgba(255,226,140,0.17)', 14);
  const g = ctx.createRadialGradient(cx, heroY, 0, cx, heroY, S * 0.75); g.addColorStop(0, 'rgba(255,220,120,0.42)'); g.addColorStop(1, 'rgba(255,220,120,0)');
  ctx.fillStyle = g; ctx.fillRect(cx - S, heroY - S, 2 * S, 2 * S);
  ctx.restore();
  const pop = (t0, x, y, draw) => { const k = calm ? 1 : backK((t - t0) / 0.32); if (k <= 0.01) return; ctx.save(); ctx.translate(x, y); ctx.scale(k, k); draw(); ctx.restore(); };
  if (!calm) { // 0.8.17 (mykee: "make it like a celebration"): a burst of light and confetti as the prize pops, as big as the prize
    const wt = clamp(((R.coins || 0) + 40 * R.items.length) / 300, 0.15, 1);
    if (t > 0.18 && t < 0.78) { ctx.save(); ctx.globalAlpha = 0.6; CB.burst(ctx, cx, heroY, S * (0.38 + 0.25 * wt), (t - 0.18) / 0.6); ctx.restore(); }
    CB.confetti(ctx, cx, heroY, t - 0.1, { n: Math.round(18 + 34 * wt), speed: S * (1.4 + 0.6 * wt), g: S * 1.5, life: 1.9, seed: 3, size: Math.max(6, S * 0.024) });
  }
  // the prize: the bundle's banner art, or the item itself
  const hw = Math.min(A.w - 30 * u, S * 1.05);
  pop(0.1, cx, heroY, () => {
    if (R.sku) drawIapBanner(ctx, R.sku, 0, 0, hw, hh, G.t, save.wallet);
    else if (R.art) spinArt(ctx, R.art, 0, 0, hh * 1.5, G.t); // a wheel prize
    else { const it = storeItem(R.key, storeState()); if (it) it.icon(ctx, 0, 0, hh * 1.1, G.t, 1); }
  });
  if (calm || t > 0.35) ui.text(R.name, cx, heroY + hh * 0.62, { size: Math.min(34 * u, 0.1 * S), align: 'center', color: '#fff6c8', stroke: ink, strokeW: 5 * u, maxW: A.w - 40 * u, tag: 'got:name' });
  // what was inside: one by one into a grid (up to 4 a row)
  // what it does, in one or two lines under its name (R.what: a booster's, a chick's, a ticket's own line)
  if (WL.length && (calm || t > 0.5)) WL.forEach((ln, q) => ui.text(ln, cx, heroY + hh * 0.62 + 0.1 * S + q * ws * 1.3, { size: ws, align: 'center', color: '#ffffff', stroke: ink, strokeW: 4 * u, maxW: A.w - 40 * u, tag: 'got:what' + q }));
  const rowTop = heroY + hh * 0.62 + 0.13 * S + whatH;
  let coinAt = null;
  const at = [];
  R.items.forEach((it, j) => {
    const r = Math.floor(j / per), inRow = Math.min(per, n - r * per), k = j - r * per, x = cx + (k - (inRow - 1) / 2) * cell, y = rowTop + r * rowH + cell * 0.32, t0 = 0.6 + 0.14 * j;
    at[j] = { x, y };
    if (it.art === 'coins' && !coinAt) coinAt = { x, y };
    pop(t0, x, y, () => drawPart(ctx, it.art, 0, 0, cell * 0.72, G.t));
    if (calm || t > t0 + 0.2) { const wr = ui.measure(it.label, ls) > cell - 6 * u, L = wr ? wrapText(it.label, ls * 0.92, cell - 6 * u).slice(0, 2) : [it.label]; L.forEach((ln, q) => ui.text(ln, x, y + cell * 0.36 + ls * 0.7 + q * ls * 1.05, { size: wr ? ls * 0.92 : ls, align: 'center', color: '#fff', stroke: ink, strokeW: 4 * u, maxW: cell - 4 * u, tag: `got:l${j}:${q}` })); }
  });
  // 0.8.17 the landing (ui/landing.js): the purse chip on the page with the count before, the coins flying from the pile
  // into it as the row fills, the boosters and charges into the bag chip beside it (eggs and outfits: the shop's)
  if (!R.flown) {
    R.flown = true;
    const its = [];
    R.items.forEach((it, j) => { const wh = landWhere(it.art); if (wh) its.push({ art: it.art, src: at[j], ...wh }); });
    if (R.coins0 != null || its.length) land.start({ from: R.coins0 ?? save.wallet.coins, to: save.wallet.coins, src: coinAt || { x: cx, y: heroY }, items: its, delay: calm ? 0 : Math.max(0, R.land - 0.6 - t) });
  }
  const yEnd = Math.min(A.y1 - 34 * u, rowTop + rowsN * rowH + 16 * u);
  if (t > R.end - 0.2 && lineOn) tickLine(R.line || 'Added to your bag', cx, yEnd, Math.min(22 * u, 0.07 * S), { stroke: ink, fit: A.w - 36 * u, tag: 'got:line', coin: !!R.lineCoin });
  pop(0.06, cx, cy - 0.98 * S, () => { const hs = Math.min(39 * u, 0.12 * S), w = Math.min(A.w - 36 * u, ui.measure('YOU GOT!', hs) + 80 * u); ui.ribbon('YOU GOT!', 0, -hs * 0.85, w, hs * 1.7, { color: '#d89a1c', size: hs, noRecord: true }); });
  landDraw(); // over everything on the page: the purse, the bag and what flies into them
  ui.buttons.push({ id: 'got:tap', x: -1e4, y: -1e4, w: 3e4, h: 3e4 }); // a tap anywhere
}

// the cheapest coin pack that covers a gap, as one row: the pile, the amount, its price (one tap to the store's sheet)
const packRow = (sku, s, tg) => ({ h: 66 * s, gap: 12 * s, draw: (x, y, w) => {
  const P = E.IAP[sku];
  ui.well(x, y, w, 66 * s, { s });
  for (const [dx, dy] of [[-9, 6], [9, 6], [0, -6]]) drawCoin(ctx, x + 36 * s + dx * s, y + 33 * s + dy * s, 12 * s, G.t + dx);
  ui.record({ x: x + 12 * s, y: y + 15 * s, w: 48 * s, h: 36 * s }, tg + ':pile');
  const bw = Math.max(96 * s, ui.measure(ads.price(sku), 18 * s) + 30 * s);
  ui.num(P.coins.toLocaleString('en-US'), x + 70 * s, y + 24 * s, { size: 22 * s, tag: tg + ':amt', maxW: w - bw - 90 * s });
  ui.text('coins', x + 70 * s, y + 47 * s, { size: 14 * s, color: ui.C.ink2, tag: tg + ':unit', maxW: w - bw - 90 * s });
  ui.button('gm:iap:' + sku, ads.price(sku), x + w - bw - 9 * s, y + 11 * s, bw, 44 * s, { kind: 'primary', size: 18 * s, shimmer: !save.calm });
} });
// 0.8.17 a gift box (the rewards that waited for a connection): a red box, a gold ribbon and bow; S: its width.
// t: the bow's little wiggle (0 in Calm)
function drawGift(c, x, y, S, t = 0) {
  const w = S, h = S * 0.62, lidH = S * 0.24, lx = x - w / 2, by = y - h * 0.2, rr = S * 0.08, ink = '#5a1608';
  c.save(); c.lineJoin = 'round'; c.lineWidth = Math.max(1.5, S * 0.045);
  c.fillStyle = 'rgba(40,20,4,0.22)'; c.beginPath(); c.ellipse(x, by + h + S * 0.03, w * 0.55, S * 0.07, 0, 0, Math.PI * 2); c.fill();
  const box = (x0, y0, bw, bh, a, b) => { ui.roundRect(x0, y0, bw, bh, rr); const g = c.createLinearGradient(0, y0, 0, y0 + bh); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.fill(); c.strokeStyle = ink; c.stroke(); };
  box(lx + w * 0.05, by, w * 0.9, h, '#f05a3c', '#c8301e'); // the box
  c.fillStyle = '#ffd34a'; c.fillRect(x - S * 0.08, by + c.lineWidth / 2, S * 0.16, h - c.lineWidth); // the ribbon down
  const wig = t ? Math.sin(t * 4) * 0.08 : 0;
  c.save(); c.translate(x, by - lidH * 0.2); c.rotate(wig * 0.25);
  box(-w / 2, -lidH * 0.8, w, lidH, '#ff7a54', '#e0412a'); // the lid
  c.fillStyle = '#ffd34a'; c.fillRect(-S * 0.08, -lidH * 0.8 + c.lineWidth / 2, S * 0.16, lidH - c.lineWidth);
  for (const sx of [-1, 1]) { // the bow: two loops
    c.save(); c.rotate(sx * (0.5 + wig)); c.beginPath(); c.ellipse(sx * S * 0.13, -lidH * 0.8 - S * 0.07, S * 0.15, S * 0.085, 0, 0, Math.PI * 2);
    c.fillStyle = '#ffd34a'; c.fill(); c.strokeStyle = '#8a5a06'; c.stroke(); c.restore();
  }
  c.beginPath(); c.arc(0, -lidH * 0.8 - S * 0.02, S * 0.065, 0, Math.PI * 2); c.fillStyle = '#ffe680'; c.fill(); c.strokeStyle = '#8a5a06'; c.stroke();
  c.restore();
  c.fillStyle = 'rgba(255,255,255,0.28)'; c.fillRect(lx + w * 0.12, by + h * 0.12, w * 0.08, h * 0.6); // a glint
  c.restore();
}
// the gift mark on the map: a purple pill under the header's right edge, "N rewards waiting", the gift bobbing on it
const waitMarkW = (h) => { const n = waitingList().length; return ui.measure(`${n} reward${n > 1 ? 's' : ''} waiting`, 16 * ui.u) + h * 1.1 + 34 * ui.u; }; // (0.8.17: the map keeps its stops' taps clear of it)
function waitMark(xr, y, h) {
  if (!waitShown()) { G.waitMarkT = null; return; }
  const u = ui.u, n = waitingList().length, label = `${n} reward${n > 1 ? 's' : ''} waiting`, size = 16 * u, w = waitMarkW(h);
  const T0 = G.waitMarkT ?? (G.waitMarkT = G.t), k = save.calm ? 1 : backK(Math.min(1, (G.t - T0) / 0.35)); // it pops in once
  ctx.save(); ctx.translate(xr - w / 2, y + h / 2); ctx.scale(k, k); ctx.translate(-(xr - w / 2), -(y + h / 2));
  ui.button('wait:open', label, xr - w, y, w, h, { kind: 'ad', shimmer: true, size, round: h * 0.42, iconS: 1.35, icon: (c, X, Y, S) => drawGift(c, X, Y + (save.calm ? 0 : Math.sin(G.t * 2.4) * 1.5 * u) + S * 0.08, S * 0.95, save.calm ? 0 : G.t) });
  ctx.restore();
}
// the page of waiting rewards: each one, what it pays, and one video to claim it (the gift mark opens it)
function drawWaitList() {
  const L = waitingList();
  if (!L.length) { G.waitList = null; return; }
  dim(0.55);
  const wide = L.length > 1 && ui.A.w > ui.A.h * 1.15;
  stackCard('Rewards waiting', (s) => {
    const C = ui.C, day = today();
    return [
      ...L.map((it, i) => ({ h: 76 * s, gap: i > (wide ? 1 : 0) ? 10 * s : 14 * s, right: wide && i % 2 === 1, draw: (x, y, w) => {
        ui.well(x, y, w, 76 * s, { s });
        const ax = x + 42 * s, ay = y + 38 * s, bw = 128 * s;
        if (it.kind === 'coins') for (const [dx, dy] of [[-10, 7], [10, 7], [0, -7]]) drawCoin(ctx, ax + dx * s, ay + dy * s, 14 * s, G.t + dx);
        else drawSlotIcon(ctx, ax, ay, 24 * s, save.calm ? 0 : G.t);
        ui.record({ x: x + 12 * s, y: y + 12 * s, w: 60 * s, h: 52 * s }, 'wl:art' + i);
        if (it.kind === 'coins') {
          ui.num('+' + it.n, x + 84 * s, y + 28 * s, { size: 24 * s, tag: 'wl:n' + i, maxW: w - bw - 104 * s });
          ui.text('coins', x + 84 * s, y + 54 * s, { size: 14 * s, color: C.ink2, tag: 'wl:u' + i, maxW: w - bw - 104 * s });
        } else ui.text('Lucky Spin', x + 84 * s, y + 38 * s, { size: 19 * s, color: C.ink, tag: 'wl:n' + i, maxW: w - bw - 104 * s });
        const full = it.kind === 'coins' && WT.room(save.waiting, day) < it.n; // over today's ceiling: it waits for tomorrow
        ui.button('wait:go:' + it.id, full ? 'Tomorrow' : 'Watch', x + w - bw - 10 * s, y + 13 * s, bw, 50 * s, full ? { kind: 'off', disabled: true, size: 17 * s } : { kind: 'ad', ad: true, shimmer: i === 0, size: 19 * s });
      } })),
      { h: 52 * s, gap: 16 * s, right: wide && L.length % 2 === 1, draw: (x, y, w) => ui.button('wait:close', 'Close', x, y, w, 52 * s, { kind: 'tertiary', size: 20 * s }) },
    ];
  }, { ribbon: '#7a48e8', full: false, twoCol: wide }); // 0.8.17: on its side the rewards stand in two columns (the Close under the shorter one)
}

function drawGetMore() {
  const M = G.getMore;
  dim(0.55);
  stackCard('Get more coins', (s) => {
    const C = ui.C, cd = adCd();
    return [
      lineBlock(`You need ${M.short} more coin${M.short > 1 ? 's' : ''}.`, 18 * s, { color: C.ink, tag: 'gm:need' }),
      ads.moneyShop && packRow(M.sku, s, 'gm'), // the cheapest pack that covers it, first
      { h: 50 * s, gap: 10 * s, draw: (x, y, w) => ui.button('gm:ad', cd > 3600 ? 'More free coins tomorrow' : cd > 0 ? `Free coins in ${fmtTime(cd)}` : `Watch an ad: +${adCoins()} coins`, x, y, w, 50 * s, { kind: 'ad', ad: cd <= 0, disabled: cd > 0, shimmer: cd <= 0, size: 16.5 * s }) },
      // the web has no coin packs: the second way to coins there is the Free tab (the daily gift, the free sample), and wins
      !ads.moneyShop && lineBlock('Every win pays coins too.', 14.5 * s, { color: C.ink2, tag: 'gm:win', gap: 8 * s }),
      { h: 46 * s, gap: 10 * s, draw: (x, y, w) => ui.button('gm:shop', ads.moneyShop ? 'Open shop' : 'Free gifts', x, y, w, 46 * s, { kind: 'secondary', icon: (c, X, Y, S) => shopIcon(c, X, Y, S), size: 17 * s }) },
      { h: 56 * s, gap: 14 * s, draw: (x, y, w) => ui.button('gm:close', 'Close', x, y, w, 56 * s, { kind: 'tertiary', size: 21 * s }) },
    ].filter(Boolean);
  }, { ribbon: '#e89a10' });
}
function onGrant(sku) {
  const P = E.IAP[sku];
  BR.note(save, 'buy', { money: true }); // the Brain rests after a purchase: no paid offer for a day
  G.storeFlash = { id: 'iap:' + sku, t0: G.t };
  if (G.getMore && save.wallet.coins >= G.getMore.price) G.getMore = null;
  if (P && G.screen !== 'play') { // 0.8.9: the "YOU GOT!" reveal (not over a running level); 0.8.17: the unlock party first
    G.detail = null; G.parent = null;
    if (P.premium && !G.got && !G.party) startParty(sku); else gotIap(sku);
    return;
  }
  audio.play('unlock');
  toast(`Thank you! ${P ? P.name : 'Your purchase'} is yours.`, 3);
}
// 0.8.17 a refunded one-time purchase was taken back (src/guard.js): one calm line, once; the shop offers it again
function guardNote() {
  const r = GD.takeNote(save.guard);
  if (!r.line) return;
  save.guard = r.guard; G.featAt = null; persist();
  toast(r.line, 4.5);
}

// 2026-11-23 the pause page's Skip level (src/skip.js holds the rule): a real journey level, not won, not skipped
// before, not the last, not level 1 while the first-run coach teaches; one rewarded video the player picks. It sits
// quietly on the pause page: no pop-up offers it.
const skipLv = () => ({ id: G.level ? G.level.id : 0, count: LEVELS.length, journey: G.li >= 0 && LEVELS[G.li] === G.level && !G.demo, coaching: !!G.teach || firstRun(), won: !!G.level && bestStarsOf(G.level.id) > 0 });
// can this level be skipped now: in play (the pause page) or once it is lost (the fail card)
const skipNow = () => !!G.sim && (G.screen === 'fail' ? G.sim.state !== 'play' : G.sim.state === 'play') && SK.canSkip(save, skipLv());
// how it can be paid now, in button order (src/skip.js skipWays): 'ticket' | 'ad', then 'coins' while stuck (fail card only)
const skipWays = () => (skipNow() ? SK.skipWays(save, skipLv(), { stuck: G.screen === 'fail' && G.li >= 0 && (ads.stuck(G.level.id) || ENG.pacer.losses(save, G.level.id) >= SK_STUCK), tickets: save.wallet.tickets.skip }) : []);
// The one skip (0.8.14: the pause sheet and the fail card end the same way): pay (a ticket, a video or coins), then
// SK.applySkip, and the map, where the hen hops to the next stop and its level page opens (a star gate: the map waits).
async function skipGo(way) {
  const from = G.screen, ways = skipWays();
  if (!ways.includes(way)) return false;
  const lid = G.level.id, li = G.li, still = () => G.screen === from && G.li === li && skipNow();
  if (way === 'coins' && save.wallet.coins < SKIP_COINS) { needCoins(SKIP_COINS); return false; }
  if (way === 'ad' && !(await rewarded('skip'))) return false; // no video, no skip (rewarded() says so: the sad hen); Premium: at once
  if (!still()) return false;
  if (way === 'ticket') { const w = E.useTicket(save.wallet, 'skip'); if (!w) return false; save.wallet = w; }
  if (way === 'coins') save.wallet = { ...save.wallet, coins: save.wallet.coins - SKIP_COINS };
  if (!SK.applySkip(save, skipLv())) return false;
  ads.won(lid); diag.mark('skip:' + lid + ':' + way); persist();
  portal.gameplayStop(); releaseAll(); stopFuse();
  // as Next does after a win: the map, the hen hops to the next stop and its level page opens
  const n = li + 1;
  G.world = envOf(n); G.toasts = []; G.toast = null; G.skipAsk = null;
  G.mapTravel = playable(n) ? { from: li, to: n, t0: -1 } : null;
  setScreen('levels'); // (no toast: on a small map it covers the stops; the hen's hop says it)
  if (way === 'ad') popPrize('Level skipped', (c, x, y, S, t) => drawItemArt(c, 'skip', x, y, S, t), null, 0.8); // 0.8.17: what the video gave, then the hop
  return true;
}
function drawSkipAsk() {
  if (G.screen !== 'pause') { G.skipAsk = null; return; }
  dim(0.55);
  stackCard('Skip level?', (s) => [
    lineBlock('Skip to the next level', 19 * s, { color: ui.C.ink, tag: 'sk:what' }),
    lineBlock('Come back for stars any time', 14.5 * s, { color: ui.C.ink2, tag: 'sk:back', gap: 6 * s }),
    { h: 56 * s, gap: 16 * s, draw: (x, y, w) => save.wallet.tickets.skip > 0 ? ui.button('sk:go', 'Use a Skip Ticket', x, y, w, 56 * s, { kind: 'orange', icon: (c, X, Y, S) => drawItemArt(c, 'skip', X, Y, S * 1.5, G.t), iconS: 1.3, size: 19 * s }) // 0.8.14: a ticket the player owns comes first
      : ui.button('sk:go', ads.premium ? 'Skip level' : 'Watch to skip', x, y, w, 56 * s, ads.premium ? { kind: 'secondary', icon: ICON.next, size: 20 * s } : { kind: 'ad', ad: true, size: 19 * s }) },
    { h: 50 * s, gap: 10 * s, draw: (x, y, w) => ui.button('sk:no', 'Cancel', x, y, w, 50 * s, { kind: 'tertiary', size: 19 * s }) },
  ], { ribbon: '#7a48e8' });
}

// ---- the Pacer (src/engine/pacer.js, 0.8.17, mykee: "push the struggling players ... never ever reduce the time or
// increase the time for them"): what is fitted to the player around the play. The play itself (the fuse, the rings, the
// villains, odds and prices) is never touched. Every decision is filed in the Brain's trace with the Pacer's reason.
const STUCK_AFTER = 0.5; // s: the fail page settles first, then the pop-up rises over it
const SK_STUCK = 3; // losses in a row that open the coin skip (ads.js STUCK_FAILS; the Pacer's own count survives a restart)
const LOSS_BOOST = { time: 'nest', thorns: 'snips', villains: 'stone', nest: 'nest' }; // why it was lost -> the most useful start booster (as director.js bestBoost, but never the Slow fuse: the Pacer has no time lever; out of time: the Wide Nest)
const pacerWhy = (moment, pick, why) => { if (why) BR.why(save, moment, pick, 'pacer: ' + why); };
// after a loss (onFail, the Director's help already picked): the pop-up, a free hint, a free Scarecrow at a boss
function pacerFail() {
  const L = G.level, id = L.id;
  ENG.pacer.result(save, { id, won: false });
  const P = ENG.pacer.failPlan(save, { levelId: id, boss: !!L.boss, early: earlyDays(), canSkip: SK.canSkip(save, skipLv()), now: Date.now() });
  G.stuckAsk = null;
  if (P.scare) G.failHelp = { kind: 'trialBoost', id: 'scare', label: `Free ${E.BOOSTERS.scare.name}`, line: E.BOOSTERS.scare.line, pacer: 'scare' };
  else if (P.hint) G.failHelp = { kind: 'freeHint', id: 'hint', label: 'Show me the way', line: 'A free hint on your next try.', pacer: 'hint' };
  if (P.ask) { G.stuckAsk = { lid: id, t0: null }; ENG.pacer.asked(save, id); }
  else if (P.gift) ENG.pacer.declined(save, id); // no skip on this level (won before): the next try's free booster all the same
  pacerWhy('fail', P.ask ? 'stuck:ask' : P.scare ? 'help:scare' : P.hint ? 'help:hint' : null, P.why);
}
// the retry after "Keep trying": one free start booster, the one that answers why it was lost (once per level)
function pacerRetry() {
  const id = G.li >= 0 && G.level ? G.level.id : 0;
  if (!id || !ENG.pacer.retryGift(save, id)) return {};
  const b = LOSS_BOOST[G.lastLoss] || 'stone';
  pacerWhy('fail', 'gift:' + b, `the try after "Keep trying" on level ${id} starts with a free ${E.BOOSTERS[b].name}`); persist();
  return { boost: { [b]: true } };
}
const pacerGiftPop = (boost) => { const b = Object.keys(boost)[0]; popPrize(`Free ${E.BOOSTERS[b].name}`, (c, x, y, S, t) => drawBoosterIcon(c, b, x, y, S, t), null, 0.5); };
// a restart from the pause page: a soft loss when most of the fuse is gone or an egg was lost
function pacerRestart() {
  if (!(G.li >= 0 && G.level && G.sim && G.sim.state === 'play')) return;
  const sim = G.sim, used = sim.timeLimit ? 1 - Math.max(0, sim.timeLeft) / sim.timeLimit : 0;
  if (ENG.pacer.restart(save, G.level.id, { used, lost: sim.stats().broken })) { pacerWhy('pause', 'soft', `a restart on level ${G.level.id} counted as a loss`); persist(); }
}
// the free hint: the solver's next move, shown as the Hint button shows it, once the try is running
function freeHintTick() {
  if (G.screen !== 'play' || !G.sim || G.sim.state !== 'play' || fuseIntroOn() || !G.level || G.hintFree !== G.level.id || G.sim.t < 0.6) return;
  G.hintFree = 0;
  const out = {};
  G.hint = { out, gen: hintSearch(Sim, G.level, G.sim.fullState(), { mode: G.sim.mode, ...G.boost }, out) };
  popPrize('Hint', (c, x, y, S) => lampIcon(c, x, y, S), null, 0.2);
}
// the level card's dare: asked once per visit of the card; the Pacer keeps the same one while it is this level's
function dareNow() {
  if (G.li < 0 || !G.level || G.screen !== 'intro' || earlyDays()) return null;
  const L = G.level, k = L.id + ':' + G.scrSeq;
  if (G.dareC && G.dareC.k === k) return G.dareC.d;
  const a = (save.dir && save.dir.att && save.dir.att[L.id]) || {}, gl = G.goals || [];
  const d = ENG.pacer.dareFor(save, { levelId: L.id, boss: !!L.boss, tries: a.tries || 0, eggs: L.eggs, target: L.target, turns: L.bonus && L.bonus.kind === 'turns' ? L.bonus.n : 0,
    chick: !!(G.sim && G.sim.stk && G.sim.stk.any && strikesOpen().length), goals: gl.map((g) => g.kind).concat(gl.filter((g) => g.b).map((g) => g.b.kind)), now: Date.now() });
  G.dareC = { k, d };
  if (d && d.why) { pacerWhy('intro', 'dare:' + d.kind, d.why); persist(); }
  return d;
}
// PLAY from the level card: the dare is taken (it rides along until this level is won) or declined
function pacerGo() {
  if (G.li < 0 || !G.level) return;
  const d = dareNow(), lid = G.level.id;
  G.dare = d ? ENG.pacer.dareStart(save, lid) : G.dare && G.dare.lid === lid ? G.dare : null;
  if (G.dare && !G.dare.lid) G.dare.lid = lid;
  if (d) { pacerWhy('intro', 'dare:' + d.kind, `dare ${d.short} on level ${lid} ${G.dare ? 'taken' : 'declined'}`); persist(); }
  G.dareC = null;
}
// a win: a dare met pays its share on top; the Pacer files the run (a first-try three-star win feeds "cruising")
function pacerWin() {
  if (!(G.li >= 0 && G.level && G.result)) return;
  const L = G.level, r = G.result, sim = G.sim, a = (save.dir && save.dir.att && save.dir.att[L.id]) || {};
  const d = G.dare && G.dare.lid === L.id ? G.dare : null;
  let met = false;
  if (d) {
    const st = sim.stats();
    met = ENG.pacer.dareMet(d, { broken: st.broken, saved: st.saved, total: st.total, turns: sim.turns || 0, boosts: Object.values(G.boost || {}).filter(Boolean).length + (G.golden ? 1 : 0), chicks: (sim.stk && sim.stk.n) || 0 });
    const add = met ? ENG.pacer.dareCoins(r.coins) : 0;
    r.coins += add;
    r.dare = { long: d.long, ok: met, res: met ? `+${add} coins` : 'Missed' };
    G.dare = null;
    pacerWhy('win', 'dare:' + d.kind, `dare ${d.short} on level ${L.id} ${met ? `met: +${add} coins` : 'missed: the win pays as usual'}`);
  }
  ENG.pacer.result(save, { id: L.id, won: true, stars: r.stars, first: !(a.tries > 0), mode: sim.mode, dare: d ? { kind: d.kind, met } : null });
}
// the chip on the level card's perks row: a flame-edged pill, the dare and what it pays; a tap lights it (taken)
function dareChip(x, y, maxW, s, dry) {
  const d = dareNow();
  if (!d) return 0;
  const h = 34 * s, fs = 14.5 * s, lab = 'Dare: ' + d.short, pay = `+${Math.round(MINT.FAUCETS.dare.share * 100)}%`, cr = 8 * s; // the Mint's dare share (FAUCETS.dare)
  const lw = ui.measure(lab, fs), pw = ui.measure(pay, fs), w = Math.min(maxW, 30 * s + lw + 10 * s + cr * 2 + 4 * s + pw + (d.took ? 26 * s : 0) + 12 * s);
  if (dry) return w;
  const on = !!d.took, t = G.t, calm = save.calm, fx = G.dareFx && G.t - G.dareFx.t0 < 0.5 ? G.dareFx : null;
  const k = fx && !calm ? 1 + 0.12 * Math.sin(Math.PI * Math.min(1, (G.t - fx.t0) / 0.5)) * (1 - (G.t - fx.t0) / 0.5) : 1; // a bump as it lights (eased out)
  ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.scale(k, k); ctx.translate(-(x + w / 2), -(y + h / 2));
  // the flame edge: little tongues of fire licking up all round the pill (still under Calm), brighter when taken
  const fl = on ? 1 : 0.7;
  for (let i = 0; i < 14; i++) {
    const q = i / 14, ex = x + 8 * s + q * (w - 16 * s), up = (calm ? 0.6 : 0.55 + 0.45 * Math.sin(t * 7 + i * 2.1)) * (on ? 9 : 6) * s;
    ctx.beginPath(); ctx.moveTo(ex - 5 * s, y + 4 * s); ctx.quadraticCurveTo(ex, y - up * 0.3, ex + 1 * s, y - up); ctx.quadraticCurveTo(ex + 3 * s, y - up * 0.2, ex + 5 * s, y + 4 * s); ctx.closePath();
    ctx.fillStyle = `rgba(255,${(120 + 60 * Math.abs(Math.sin(i * 1.7))) | 0},30,${0.85 * fl})`; ctx.fill();
  }
  ui.roundRect(x, y, w, h, h / 2);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  if (on) { g.addColorStop(0, '#ff8a2a'); g.addColorStop(1, '#d8341c'); } else { g.addColorStop(0, 'rgba(92,34,12,0.94)'); g.addColorStop(1, 'rgba(60,18,6,0.94)'); }
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 2.5 * s; const rg = ctx.createLinearGradient(x, 0, x + w, 0); rg.addColorStop(0, '#ffd23a'); rg.addColorStop(0.5, '#ff6a1a'); rg.addColorStop(1, '#ffd23a'); ctx.strokeStyle = rg; ctx.stroke();
  ctx.restore();
  const cy = y + h / 2;
  pictoFlame(ctx, x + 16 * s, cy, 24 * s);
  ui.text(lab, x + 30 * s, cy, { size: fs, color: '#fff', maxW: lw + 1, noRecord: true });
  const px = x + 30 * s + lw + 10 * s;
  drawCoin(ctx, px + cr, cy, cr, 0);
  ui.text(pay, px + cr * 2 + 4 * s, cy, { size: fs, color: '#ffe066', noRecord: true });
  if (on) { const tx = x + w - 20 * s; ctx.beginPath(); ctx.arc(tx, cy, 10 * s, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); pictoCheck(ctx, tx, cy, 15 * s, '#2f9e1c'); }
  ui.record({ x, y, w, h }, 'intro:darechip');
  ui.buttons.push({ id: 'dare:chip', x, y, w, h });
  return w;
}
// the map: a flame where a dare was met; at a star gate, the three stops where the next star is nearest sparkle "+1"
function pacerStopMark(id, x, y, r, t, calm) {
  if (G.pmarkT !== G.t) { // worked out once a frame
    G.pmarkT = G.t;
    const k = envOf(Math.min(LEVELS.length - 1, (save.unlocked || 1) - 1)), short = envOpen(k) ? 0 : envNeed(k) - bestTotal();
    const sig = `${short}|${bestTotal()}|${save.adapt !== false}`;
    if (!G.pmarks || G.pmarks.sig !== sig) {
      const rows = LEVELS.map((L) => ({ id: L.id, stars: bestStarsOf(L.id), best: Math.max(0, ...MODE_LIST.map((m) => save.best[sk(L.id, m)] || 0)) }));
      G.pmarks = { sig, ids: ENG.pacer.marks(save, { short, rows }) };
    }
  }
  const u = ui.u, R = Math.max(r, 20 * u);
  if (ENG.pacer.dared(save, id)) { // a dare met: a small flame badge on the nest's shoulder
    const fx = x - R * 0.95, fy = y - R * 0.55;
    ctx.beginPath(); ctx.arc(fx, fy, 10 * u, 0, 7); ctx.fillStyle = 'rgba(70,20,6,0.9)'; ctx.fill(); ctx.lineWidth = 2 * u; ctx.strokeStyle = '#ffb02a'; ctx.stroke();
    pictoFlame(ctx, fx, fy, 15 * u);
  }
  if (G.pmarks.ids.includes(id)) { // "+1 star here": a star that twinkles over the stop (steady under Calm)
    const tw = ui.measure('+1', 13 * u) + 14 * u, side = x + R * 0.95 + tw + 11 * u > ui.A.x1 - 4 * u ? -1 : 1; // the side with room (never off the screen's edge)
    const sx = x + side * R * 0.95 - (side < 0 ? tw : 0), sy = y - R * 0.75, p = calm ? 0.5 : 0.5 + 0.5 * Math.sin(t * 3.2 + id), rr = (9 + 2 * p) * u;
    ctx.save(); ctx.globalAlpha = 0.35 + 0.35 * p; ctx.beginPath(); ctx.arc(sx, sy, rr * 1.9, 0, 7); ctx.fillStyle = '#fff3a0'; ctx.fill(); ctx.restore();
    drawStar(ctx, sx, sy, rr, true);
    ui.text('+1', sx + rr + 3 * u, sy + 1 * u, { size: 13 * u, color: '#fff', stroke: 'rgba(40,20,5,0.9)', tag: 'map:plus' + id, noRecord: sy - 12 * u < levelPageTop() || sy + 12 * u > (G.mapView ? G.mapView.vb : ui.A.y1) }); // (half under the header or the PLAY bar: not a thing to read)
  }
}
// "Stuck? Skip this one" (the Pacer, after the third loss in a row): over the fail page before its buttons, the hen
// worried, two equal ways to skip (a video, or coins: the fail card's own skip) and a quiet "Keep trying"
function drawStuckAsk() {
  const A = G.stuckAsk;
  if (G.screen !== 'fail' || !G.level || A.lid !== G.level.id) { G.stuckAsk = null; return; }
  if (A.t0 == null) { A.t0 = G.t; audio.play('cluck', { pitch: 0.78, vol: 0.55 }); }
  const ways = skipWays();
  if (!ways.length) { G.stuckAsk = null; return; }
  const p = save.calm ? 1 : clamp((G.t - A.t0) / 0.42, 0, 1), c1 = 1.7, e = 1 + (c1 + 1) * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); // ease out with a little overshoot
  dim(0.6 * Math.min(1, p * 1.6));
  const first = ways[0], coins = ways.includes('coins');
  ctx.save(); // (no fade: the card's buttons and her art paint at full strength; it rises and grows into place instead)
  const cx = ui.A.cx, cy = ui.A.cy, sc = 0.55 + 0.45 * e;
  ctx.translate(cx, cy + (1 - e) * 90 * ui.u); ctx.scale(sc, sc); ctx.translate(-cx, -cy);
  const portrait = ui.A.h > ui.A.w * 1.15;
  stackCard('Stuck?', (s) => { const hh = portrait ? clamp((ui.A.y1 - Math.max(G.hudBottom, ui.A.y) - 30 * ui.u) / s - 248, 128, 560) : 176; return [ // (0.8.17 polish: the stage fills to the buttons, no gap left over) // her stage takes the room a tall phone gives (no blank paper); on its side she stands left of the buttons
    { h: hh * s, gap: portrait ? 4 * s : 0, draw: (x, y, w) => {
      const aw = Math.min(w, Math.max(190, hh * 1.3) * s);
      ui.well(x + (w - aw) / 2, y, aw, hh * s, { s, a: '#d9e8ff', b: '#eef5ff' });
      drawHenAnim(ctx, 'worried', x + w / 2, y + hh / 2 * s, Math.min(hh * 0.78 * s, aw * 0.86), G.t, { key: 'stuck', face: 1, calm: save.calm, shadow: 0 });
      ui.record({ x: x + (w - aw) / 2, y, w: aw, h: hh * s }, 'stuck:hen');
    } },
    { ...lineBlock('Skip this one', 21 * s, { color: ui.C.ink, tag: 'stuck:line', gap: portrait ? 10 * s : 0 }), right: true },
    { h: 58 * s, gap: 14 * s, right: true, draw: (x, y, w) => {
      const hw = coins ? (w - 10 * s) / 2 : w;
      if (first === 'ticket') ui.button('stuck:ticket', 'Ticket', x, y, hw, 58 * s, { kind: 'orange', icon: (c, X, Y, S) => drawItemArt(c, 'skip', X, Y, S * 1.5, G.t), iconS: 1.3, size: 20 * s });
      else if (ads.premium) ui.button('stuck:ad', 'Skip', x, y, hw, 58 * s, { kind: 'secondary', icon: ICON.next, size: 20 * s });
      else ui.button('stuck:ad', 'Watch', x, y, hw, 58 * s, { kind: 'ad', ad: true, size: 20 * s }); // offline: dimmed with the no-signal badge, as every video button (setAdOff)
      if (coins) ui.button('stuck:coins', String(SKIP_COINS), x + hw + 10 * s, y, hw, 58 * s, { kind: save.wallet.coins >= SKIP_COINS ? 'gold' : 'off', dim: 1, icon: (c, X, Y, S) => drawCoin(c, X, Y, S * 0.5, G.t), size: 22 * s });
    } },
    { h: 48 * s, gap: 12 * s, right: true, draw: (x, y, w) => ui.button('stuck:no', 'Keep trying', x, y, w, 48 * s, { kind: 'tertiary', size: 18 * s }) },
  ]; }, { ribbon: '#5a82c8', pop: false, grow: 1.12, twoCol: true });
  ctx.restore();
}

// the one coin-gain effect (src/ui/purse.js): every counter draws purse.shown(); every grant calls purse.gain()
const purse = createPurse({ clock: () => G.t, calm: () => !!save.calm, wallet: () => (save && save.wallet ? save.wallet.coins || 0 : 0), screen: () => G.screen, sound: (n, o) => audio.play(n, o), buzz: (k) => buzz(k) });
// 0.8.17 (ui/landing.js): a reward page's own purse and bag chips, and the prize pop after a video. land.start / land.draw
// are what any reward page calls (the Lucky Spin too); landItems turns a page's "what was inside" into things that fly.
const land = createLanding({ clock: () => G.t, calm: () => !!save.calm, sound: (n, o) => audio.play(n, o), buzz: (k) => buzz(k), hold: (v) => purse.hold(v), release: () => purse.release() });
const prizePop = createPrizePop({ clock: () => G.t, calm: () => !!save.calm, sound: (n, o) => audio.play(n, o), buzz: (k) => buzz(k) });
const LAND_KIT = { ui: null, coin: (c, x, y, r, t) => drawCoin(c, x, y, r, t), art: (c, a, x, y, s, t) => drawPart(c, a, x, y, s, t), bag: (c, x, y, s, b) => CB.bag(c, x, y, s, b), shop: (c, x, y, s) => shopIcon(c, x, y, s),
  sadHen: (c, x, y, h, t) => drawHenAnim(c, 'sad', x, y, h, t, { key: 'pop', face: 1, n: 0, calm: save.calm, shadow: 0 }),
  hen: (c, x, y, h, t) => drawHenAnim(c, 'happy', x, y, h, t, { key: 'popHappy', face: 1, n: Math.floor(t / 1.7), calm: save.calm, shadow: 0 }), dim: (a) => dim(a) };
const landDraw = () => { LAND_KIT.ui = ui; land.draw(ctx, ui.u, ui.A, LAND_KIT); };
// where a prize lives: coins to the purse; boosters, charges and tickets to the bag (with how many there are now); eggs,
// outfits and chicks to the shop; a bundle's summary pictures ("All levels", "No videos") stay on the page
function landWhere(art) {
  const w = save.wallet;
  if (art.startsWith('boost:')) return { dest: 'bag', n: E.ownedCount(w, art.slice(6)) };
  if (art === 'charge') return { dest: 'bag', n: w.charges };
  if (art === 'ally') return { dest: 'bag', n: (w.tickets || {}).ally || 0 };
  if (/^(egg|hen|chick):/.test(art)) return { dest: 'shop' };
  return null;
}
// a video's prize: a small celebration, the prize big with its name, then flown to where it is used (to: a recorded
// rect's tag, or a point; w: its weight 0..1, the size of the party). Over a running level it keeps to the top third.
function popPrize(name, art, to = null, w = 0.4) {
  const at = () => { if (!to) return null; if (typeof to === 'object' && !Array.isArray(to)) return to; const r = ui.rects.find((q) => [].concat(to).includes(q.tag)); return r ? { x: r.x + r.w / 2, y: r.y + r.h / 2 } : null; };
  prizePop.start({ name, art, to: at, w, live: G.screen === 'play' });
}
function rewindArt(c, x, y, S) { // the rewind's prize: a blue disc with the rewind arrows
  const r = S * 0.42, g = c.createLinearGradient(0, y - r, 0, y + r); g.addColorStop(0, '#8fd0ff'); g.addColorStop(1, '#2f7fd8');
  c.save(); c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = g; c.fill(); c.lineWidth = S * 0.05; c.strokeStyle = '#123c6e'; c.stroke();
  c.beginPath(); c.arc(x - r * 0.25, y - r * 0.35, r * 0.35, 0, 7); c.fillStyle = 'rgba(255,255,255,0.3)'; c.fill(); c.restore();
  ICON.rewind(c, x, y, S * 0.6);
}
// ---- the shop mark (0.8.14, director.js shopMark): a blinking badge on every shop button while the coins reach
// something new (an egg, an outfit, a reached chick, a set) the player has not seen in the shop yet
function markItems() {
  const w = save.wallet, tr = DR.dirState(save).trials || {}, items = [];
  for (const id of E.SKIN_ORDER) if (id !== 'classic') items.push({ key: 'skin:' + id, kind: 'skin', price: upPrice(E.SKINS[id].price), owned: (w.skins || []).includes(id), tried: (tr.skins || []).includes(id) });
  for (const id of E.HEN_SKIN_ORDER) if (id !== 'classic' && !E.HEN_SKINS[id].premium) items.push({ key: 'hen:' + id, kind: 'hen', price: upPrice(E.HEN_SKINS[id].price), owned: (w.henSkins || []).includes(id), tried: (tr.hens || []).includes(id) });
  for (const c of lockedChicks()) items.push({ key: 'chick:' + c.id, kind: 'chick', price: c.price, owned: false, tried: (tr.chicks || []).includes(c.id) });
  for (const id of E.SET_ORDER) { const S = E.SETS[id]; items.push({ key: 'set:' + id, kind: 'set', price: E.setPrice(w, id), owned: (w.henSkins || []).includes(S.hen) && (w.skins || []).includes(S.egg) }); }
  return items.filter((i) => storeItem(i.key, { wallet: w }));
}
const MARK_OFF = { on: false, n: 0, pick: null };
function shopMarkNow() { // asked by every shop button each frame: worked out again when the purse or what is owned changes
  if (!save || !save.wallet) return MARK_OFF;
  const w = save.wallet, sig = `${w.coins}|${(w.skins || []).length}|${(w.henSkins || []).length}|${(w.chicks || []).length}|${save.seen.shopSawN || 0}|${strikeReach()}|${earlyDays() ? 1 : 0}`;
  if (!G.markC || G.markC.sig !== sig) { let m = MARK_OFF; try { m = DR.shopMark(save, { items: markItems() }); } catch (e) { m = MARK_OFF; } G.markC = { sig, m }; }
  return G.markC.m;
}
// the shop was opened: what it shows now counts as seen (the mark waits for the coins to reach something more)
function shopSeen() { const m = shopMarkNow(); if ((save.seen.shopSawN || 0) !== m.n) { DR.seenShop(save, m); persist(); } }
// the mark itself: a red badge with a white "!" (or a count) that pulses 1 -> 1.18 every 1.2 s; still under Calm
function markBadge(x, y, r, t, label = '!', steady = false) {
  const still = save.calm || steady, k = still ? 1 : 1 + 0.09 * (1 - Math.cos(((t % 1.2) / 1.2) * Math.PI * 2));
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  if (!still) { const a = ((t % 1.2) / 1.2); ctx.globalAlpha = 0.45 * (1 - a); ctx.beginPath(); ctx.arc(0, 0, r * (1 + 0.7 * a), 0, 7); ctx.fillStyle = '#ff6b5a'; ctx.fill(); ctx.globalAlpha = 1; }
  ctx.beginPath(); ctx.arc(0, r * 0.12, r, 0, 7); ctx.fillStyle = 'rgba(60,8,4,0.35)'; ctx.fill(); // its shadow
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7);
  const g = ctx.createLinearGradient(0, -r, 0, r); g.addColorStop(0, '#ff6a55'); g.addColorStop(1, '#d8251a');
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = Math.max(1.5, r * 0.18); ctx.strokeStyle = '#fff'; ctx.stroke();
  ui.text(label, 0, r * 0.04, { size: r * (label.length > 1 ? 1.05 : 1.35), align: 'center', color: '#fff', noRecord: true });
  ctx.restore();
}
// a shop thing's picture (the mark's bubble, the win card's chip, the pause page's shop banner): h is its height
function markArt(key, x, y, h) {
  const [k, id] = key.split(':');
  if (k === 'skin') drawSkinPreview(ctx, id, x, y, h * 0.9, G.t);
  else if (k === 'hen') drawHenSkinPreview(ctx, id, x, y, h, G.t);
  else if (k === 'chick') drawStrikeChick(ctx, id, x, y + h * 0.08, h * 0.8, G.t, {});
  else if (k === 'set' && E.SETS[id]) drawHenSkinPreview(ctx, E.SETS[id].hen, x, y, h, G.t);
}
const markWhat = (key) => ({ skin: 'egg', hen: 'outfit', chick: 'chick', set: 'set' }[key.split(':')[0]] || 'thing');
const markName = (key) => { const [k, id] = key.split(':'); return k === 'skin' ? eggName(E.SKINS[id].name) : k === 'hen' ? E.HEN_SKINS[id].name : k === 'chick' ? (STRIKES.find((S) => S.id === id) || {}).name || 'chick' : k === 'set' ? (E.SETS[id] || {}).name || 'set' : ''; };
// the first time the mark turns on (once ever, save.seen.shopHand): on the map, not during the hen's trip or under a
// sheet, the teaching hand taps the shop button and a bubble under it shows what the coins reach. Not a modal: the map
// still works; it goes after ~6 s or on any tap. (a tap on the shop button opens the shop on it, as always)
const SHOP_HAND_LEN = 6;
function drawShopHand() {
  const M = shopMarkNow();
  if (!G.shopHand) {
    if (save.seen.shopHand || !M.on || !M.pick || G.mapTravel || G.treasure || modalOpen() || G.settingsOpen || G.screenT < 0.8 || !G.shopBtn || G.shopBtn.t !== G.t) return;
    G.shopHand = { t0: G.t, key: M.pick.key }; save.seen = { ...save.seen, shopHand: 1 }; persist();
  }
  const H = G.shopHand, el = G.t - H.t0, B = G.shopBtn;
  if (el > SHOP_HAND_LEN || !B || B.t !== G.t || modalOpen() || G.mapTravel) { G.shopHand = null; return; }
  const u = ui.u, A = ui.A, a = Math.min(1, el / 0.3, (SHOP_HAND_LEN - el) / 0.4);
  ctx.save(); ctx.globalAlpha = a;
  // the bubble under the button: the thing's picture and one line, a tail pointing up at the button
  const txt = `You can get a new ${markWhat(H.key)}!`, ts = 15 * u, ph = 46 * u, bh = 56 * u;
  const bw = Math.min(A.w - 24 * u, ui.measure(txt, ts) + ph + 34 * u), bx = clamp(B.x + B.w / 2 - bw / 2, A.x + 12 * u, A.x1 - 12 * u - bw), by = B.y + B.h + 14 * u;
  ui.roundRect(bx, by + 3 * u, bw, bh, 16 * u); ctx.fillStyle = 'rgba(30,14,4,0.35)'; ctx.fill();
  ui.roundRect(bx, by, bw, bh, 16 * u); ctx.fillStyle = '#fff8e6'; ctx.fill(); ctx.lineWidth = 2.5 * u; ctx.strokeStyle = '#e0a020'; ctx.stroke();
  const tx = clamp(B.x + B.w / 2, bx + 22 * u, bx + bw - 22 * u);
  ctx.beginPath(); ctx.moveTo(tx - 9 * u, by + 1); ctx.lineTo(tx, by - 10 * u); ctx.lineTo(tx + 9 * u, by + 1); ctx.closePath(); ctx.fillStyle = '#fff8e6'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(tx - 9 * u, by); ctx.lineTo(tx, by - 10 * u); ctx.lineTo(tx + 9 * u, by); ctx.stroke();
  markArt(H.key, bx + 12 * u + ph / 2, by + bh / 2 + 2 * u, ph * 0.86);
  ui.text(txt, bx + 18 * u + ph, by + bh / 2 + 0.5 * u, { size: ts, color: '#5a2c08', maxW: bw - ph - 28 * u, noRecord: true });
  ctx.restore();
  // the hand taps the button (still under Calm: it just points)
  const per = 1.1, q = save.calm ? 0.5 : (el % per) / per, press = q > 0.4 && q < 0.7, hs = Math.min(B.h * 1.3, 56 * u);
  teachHand(ctx, B.x + B.w * 0.8, B.y + B.h * (press ? 0.5 : 0.66), hs, press, a); // on the right half: the coin count stays readable
}
// 0.8.14 the same mark on every way into Settings (home's gear, the pause button, the pause page's tile), from level 2
// until Settings was opened once (save.seen.setOpen)
const settingsMarkOn = () => !!save && !save.seen.setOpen && (save.unlocked || 1) >= 2 && !firstRun();
function setMarkAt(x, y, w, h, steady = false) {
  if (!settingsMarkOn()) return;
  const r = Math.min(10 * ui.u, h * 0.26);
  markBadge(Math.min(x + w - r * 0.3, ui.A.x1 - r - 1), Math.max(y + r * 0.3, ui.A.y + r + 1), r, G.t, '!', steady);
}
// a coin counter (the gold shop button on home and the map): the rolling number, a pop when the coins land
// 0.8.14: with the shop mark on, a shimmer runs over it and the badge pulses on its top right corner
function purseBtn(x, y, w, h, size) {
  const sc = purse.pop(), cx = x + w / 2, cy = y + h / 2, M = shopMarkNow();
  if (sc !== 1) { ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-cx, -cy); }
  ui.button('shop', String(purse.shown()), x, y, w, h, { kind: 'gold', shimmer: M.on, icon: (c, X, Y, S) => { drawCoin(c, X, Y, S * 0.56, G.t); purse.at({ x: X, y: Y }); }, size });
  if (M.on) { const r = Math.min(11 * ui.u, h * 0.26); markBadge(Math.min(x + w - r * 0.35, ui.A.x1 - r - 1), Math.max(y + r * 0.2, ui.A.y + r + 1), r, G.t); }
  if (sc !== 1) ctx.restore();
  if (M.on) G.shopBtn = { x, y, w, h, t: G.t }; // where the map's one-time hand points
}

const DIAG_MARK = /^(iap:|deal:|buy:|item:|chick:|charge:|hen:|skin:|kit:|hset:|try:|sample$|bonus$|ad:|go$|retry$|next$|home:chest$|tr:)/;
// Haptics on the hero beats (the app's EggApp bridge, navigator.vibrate on the web). 0.8.9: only the Vibration switch turns
// them off (not sound, not Calm motion), and each beat has its own pattern [on, off, on, ...] in ms: 18 to 30 ms one-shots
// were not felt on most phones.
const HAPTIC = { attack: [40, 35, 60], slam: [70, 40, 90], save: 30, crack: 45, broke: [60, 40, 80], star: 35, win: [40, 60, 40, 60, 120], fail: [120, 80, 160], strike: 50, crow: 70, boss: 80, hit: 40, thorn: 35, pick: 25, chick: 20, treasure: [30, 40, 30, 40, 150], tap: 25, tick: 20 };
const EV_BUZZ = { break: 'broke', bossHit: 'hit', bossFlinch: 'hit', thiefHit: 'hit', thiefDefeat: 'hit', snakeRecoil: 'hit', eagleSlam: 'hit', kcHit: 'hit', gatorHit: 'hit', owlJam: 'hit', allyKnock: 'hit', pickup: 'pick', thornSnap: 'thorn', thornBurn: 'thorn', stkLaunch: 'strike', stkSnip: 'pick' }; // events that had a sound but no buzz
let lastBuzz = { t: -9, p: 0 };
// 0.8.10 (mykee on 0.8.9: "I didn't feel vibrations or any shaky effects on any level. The user should feel it when an
// egg is cracked or hurt, when a villain attacks"). Measured: a crack shook the view 1.4 px and a break 3.9 px (on a
// phone's sharp screen: nothing), and a villain grabbing, biting or stinging an egg neither shook nor buzzed. Every
// moment a villain goes for an egg, or something hits hard, now has a shake (trauma 0..1) and a buzz.
const EV_HURT = {
  // a villain goes for an egg
  snakeEat: [0.5, 'attack'], snakeHit: [0.3, 'hit'], venomSpit: [0.35, 'attack'], eagleGrab: [0.55, 'attack'], eagleSteal: [0.55, 'attack'], eagleDive: [0.25, 'tick'],
  thiefGrab: [0.5, 'attack'], thiefPounce: [0.4, 'attack'], chamSnatch: [0.45, 'attack'], chamGulp: [0.5, 'attack'], geckoLick: [0.35, 'attack'],
  frogTongue: [0.35, 'attack'], frogEat: [0.5, 'attack'], frogGulp: [0.45, 'attack'], frogLand: [0.2, 'tick'], octGrab: [0.5, 'attack'], octInk: [0.3, 'attack'],
  hermitGrab: [0.45, 'attack'], gatorSnap: [0.55, 'attack'], jellySting: [0.45, 'attack'], mosqLatch: [0.35, 'attack'], owlGrab: [0.5, 'attack'], owlSlam: [0.6, 'slam'],
  turtleClamp: [0.45, 'attack'], mvDiveGrab: [0.5, 'attack'], kcSnap: [0.5, 'attack'], salScorch: [0.45, 'attack'], salFire: [0.3, 'attack'], salEat: [0.6, 'attack'], salFrostBite: [0.45, 'attack'], salCoil: [0.25, 'attack'], puffSpine: [0.35, 'attack'],
  thornSwipe: [0.4, 'attack'], thornThrown: [0.3, 'attack'], ratCuff: [0.3, 'attack'], webCatch: [0.3, 'attack'], spiderFlung: [0.3, 'attack'],
  // hits that land
  icicleHit: [0.45, 'hit'], emberHit: [0.4, 'hit'], lightning: [0.6, 'slam'], quake: [0.7, 'slam'], explode: [0.7, 'slam'], smash: [0.55, 'slam'], scorch: [0.4, 'hit'],
  heatCrack: [0.4, 'hit'], lavaBlast: [0.55, 'slam'], bossStomp: [0.75, 'slam'], bossPunch: [0.65, 'slam'], bossThrow: [0.3, 'hit'], cannonSmash: [0.55, 'slam'], beetleCrush: [0.5, 'slam'],
  mvShardHit: [0.4, 'hit'], mvMagma: [0.5, 'slam'], kcBonk: [0.4, 'hit'], stkHit: [0.35, 'hit'], stkBlast: [0.55, 'slam'], laserHit: [0.25, 'hit'],
};
// the power chick is ready: the button starts its heartbeat, the phone thumps lub-dub, a "Power ready!" tag pops by it
function powerReady() {
  G.stkFullT = G.t; G.stkBeats = 0;
  if ((G.stkHintN || 0) < 2) { G.stkHintN = (G.stkHintN || 0) + 1; G.stkHint = G.t; } // the first two times on a level: the tap coach on the badge
  heartBuzz();
  if (strikeShown()) { const r = strikeBtnRect(); G.popups.push({ x: r.x + r.w / 2, y: r.y - 16 * ui.u, text: 'Power ready!', key: 'pready', n: 1, sub: '', color: '#ffcf3a', life: 1.6, max: 1.6, size: 20 * ui.u, placed: false }); }
}
function heartBuzz() {
  if (save.vibe === false) return;
  try { vibrate([30, 130, 50]); lastBuzz = { t: G.t, p: 80 }; } catch (_) { /* optional */ }
}
function buzz(kind) {
  if (save.vibe === false) return; // its own switch in Settings (2026-11-16 research: every top casual game has one)
  const pat = HAPTIC[kind] || 25, pw = Array.isArray(pat) ? pat.reduce((a, v, i) => a + (i % 2 ? 0 : v), 0) : pat;
  if (G.t - lastBuzz.t < 0.06 && pw <= lastBuzz.p) return; // one buzz per 60 ms: the stronger beat wins
  lastBuzz = { t: G.t, p: pw };
  try { vibrate(pat); } catch (_) { /* haptics are optional */ }
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
// the live eggs over the basket are drawn by drawNest between the eggs at home and its front wall (no allocation a frame)
const NEST_O = { k: 60, t: 0, mid: () => { const sim = G.sim; for (const e of sim.aliveEggs()) if (overNest(sim, e)) drawEggFelt(e, NEST_O.t, NEST_O.k); } };
function nestPass(k, t) { NEST_O.k = k; NEST_O.t = t; return NEST_O; }
// an egg over the basket, low enough that its bottom is below the rim: drawn between the eggs at home and the front wall
function overNest(sim, e) {
  if (sim.water || !e.body) return false;
  const p = e.body.getPosition(), n = sim.nest.getPosition(), dy = p.y - n.y;
  return dy < 0.95 && dy > -0.3 && Math.abs(p.x - n.x) < sim.nestW / 2 + 0.05;
}
function drawEggFelt(e, t, k) {
  const ml = e.joint && !save.calm ? magnetLean(e) : null; // 2026-11-20: magnetised eggs stretch toward each other while they are pulled
  if (!ml) { drawEggFelt0(e, t, k); return; }
  const p = e.body.getPosition();
  ctx.save();
  ctx.translate(p.x + ml.dx, p.y + ml.dy); ctx.rotate(ml.a); ctx.scale(1 + ml.s, 1 - ml.s * 0.5); ctx.rotate(-ml.a); ctx.translate(-p.x, -p.y);
  drawEggFelt0(e, t, k);
  ctx.restore();
}
function drawEggFelt0(e, t, k) {
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
// the weasel has its own little voice per moment (snicker / sniff / yelp); the rats keep their squeak
const thiefVoice = (ev, w = 'weasel_snicker') => (ev.kind === 'rat' || ev.kind === 'ratking' ? 'rat_squeak' : w);
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
  stkSnip: (ev) => ['thorn_snap', { vol: 0.55, pitch: 1.5 + (ev.n % 4) * 0.1 }],
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
  thiefWarn: (ev) => [thiefVoice(ev, 'weasel_sniff'), { vol: 0.7 }],
  thiefGrab: (ev) => [thiefVoice(ev), { vol: 0.7, pitch: 1.1 }, 'hit'],
  thiefHit: (ev) => ['creature_hurt', { pitch: ev.kind === 'rat' ? 1.5 : ev.boss ? 0.75 : 1.1 }],
  thiefFlinch: (ev) => ['creature_hurt', { vol: 0.6, pitch: ev.kind === 'rat' ? 1.6 : 1.2 }],
  thiefDaze: ['stun_stars', { pitch: 1.1 }],
  thiefDefeat: ['creature_hurt', { pitch: 0.7 }],
  thiefFlee: (ev) => [thiefVoice(ev, 'weasel_yelp'), { vol: 0.6, pitch: 1.05 }],
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
  salAlert: (ev) => (ev.sp === 'gecko' ? ['gecko_chirp', { vol: 0.55, pitch: 1.25 }] : ['sal_huff', { vol: 0.55, pitch: ev.sp === 'thornback' ? 0.8 : 1.3 }]), // the brain: it has noticed an egg (the "!" is the art's)
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
  hermitRoll: ['bubble_on', { vol: 0.45, pitch: 0.8 }], // the entrance: its shell tumbles in, clacks down, the crab pops out
  hermitIn: ['rock_hit', { vol: 0.3, pitch: 1.6 }],
  hermitPop: ['crab_snap', { vol: 0.7 }],
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
  mvPopMiss: ['weasel_yelp', { vol: 0.5, pitch: 0.9 }],
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
// The egg skin's power firing (sim/perks.js 'perk'): one short beat built from effects the game already has, a sound
// from the set, a light buzz, and the HUD chip pulses. No flashes, so Calm motion needs nothing switched off.
function perkBeat(ev, fx) {
  const P = eggPerk();
  if (!P) return;
  G.perkT = G.t;
  buzz('pick');
  const x = ev.x, y = ev.y;
  if (ev.id === 'robot') { // Grip: a servo sparkle as it brakes on ice (no popup: it happens often)
    fx.sparkle(x, y - 0.1, 5, '#cfe4ff');
    audio.play('motor_tick', { vol: 0.35, pitch: 1.6 });
    return;
  }
  if (ev.id === 'galaxy') { // Star Pull: the orb streaks in
    fx.sparkle(ev.ox ?? x, ev.oy ?? y, 8, '#bfa8ff');
    fx.whoosh(ev.ox ?? x, ev.oy ?? y, x - (ev.ox ?? x), y - (ev.oy ?? y));
    audio.play('power_pickup', { vol: 0.5, pitch: 1.35 });
    return;
  }
  const say = (txt, col) => popup(x, y + 0.55, txt, { color: col, size: 20, life: 1.1 });
  if (ev.id === 'speckled') { fx.sparkle(x, y, 12, '#9bff8a'); fx.impact(x, y, 0.3, '#b6ffa0'); audio.play('near_miss', { vol: 0.8 }); say('LUCKY FRECKLES!', '#8dff78'); }
  else if (ev.id === 'dino') { fx.chips(x, y, '#5fd16a', 9, 2.4); fx.impact(x, y, 0.34, '#7fe08a'); audio.play('thorn_snap'); audio.play('steel_on', { vol: 0.4, pitch: 1.4 }); say('THICK SHELL!', '#7fe08a'); }
  else if (ev.id === 'lava') { for (let i = 0; i < 7; i++) fx.flameAt(x + (Math.random() - 0.5) * 0.3, y + (Math.random() - 0.5) * 0.3, 1.1); fx.smoke(x, y + 0.25, 3); audio.play('fire_burn'); audio.play('fire_ignite', { vol: 0.5, pitch: 1.3 }); say('HOT SHELL!', '#ff9b3a'); }
  else if (ev.id === 'frosty') { const fxx = ev.vx ?? x, fxy = ev.vy ?? y; fx.sparkle(fxx, fxy, 14, '#dff6ff'); fx.wave(fxx, fxy, 1.1, '#dff6ff', 0.5, 0.12); audio.play('glass_crack', { vol: 0.8, pitch: 0.75 }); audio.play('frost_lick', { vol: 0.6 }); say('FROST TOUCH!', '#bfe6ff'); }
  else if (ev.id === 'thunder') { const zx = ev.vx ?? x, zy = ev.vy ?? y; fx.sparkle(zx, zy, 12, '#ffe14a'); fx.impact(zx, zy, 0.4, '#fff3a6'); audio.play('thunder', { vol: 0.6, pitch: 1.2 }); say('THUNDER EGG!', '#ffe14a'); }
  else if (ev.id === 'pearl') { fx.sparkle(x, y, 14, '#ffd8ef'); fx.wave(x, y, 0.9, '#fff6ff', 0.5, 0.1); audio.play('glass_crack', { vol: 0.5, pitch: 1.5 }); audio.play('unlock', { vol: 0.5 }); say('PEARL SHINE!', '#ffc9ea'); }
  else if (ev.id === 'gator') { const gx = ev.vx ?? x, gy = ev.vy ?? y; fx.chips(gx, gy, '#4aa84f', 8, 2.2); audio.play('gator_snap', { vol: 0.8 }); say('SNAP BACK!', '#8de08a'); }
}
// the HUD's power chip: the equipped egg's power icon in a small glass pill, pulsing for a beat when it fires
function perkChipHud(x, y, u) {
  const P = eggPerk();
  if (!P) return 0;
  const h = 30 * u, w = 34 * u, age = G.t - (G.perkT ?? -9), pu = age < 0.6 && !save.calm ? 1 + 0.22 * Math.sin((age / 0.6) * Math.PI) : 1;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2); ctx.scale(pu, pu); ctx.translate(-(x + w / 2), -(y + h / 2));
  ui.glass(x, y, w, h, age < 0.9 ? { a: 'rgba(96,72,32,0.95)', b: 'rgba(58,40,14,0.95)', border: 'rgba(255,226,122,0.9)' } : {});
  pictoPerk(ctx, P.icon, x + w / 2, y + h / 2, 22 * u, G.t);
  ctx.restore();
  ui.record({ x, y, w, h }, 'hud:perk');
  return w;
}

function handleEvents() {
  const sim = G.sim;
  const fx = G.fx;
  for (const ev of sim.events) {
    playEv(ev);
    if (EV_BUZZ[ev.type]) buzz(EV_BUZZ[ev.type]);
    const hurt = EV_HURT[ev.type];
    if (hurt) { fx.shake = Math.max(fx.shake, hurt[0]); if (!EV_BUZZ[ev.type]) buzz(hurt[1]); }
    // moment camera (these events also have their own cases below)
    if (ev.type === 'allyKnock') camMoment(ev.x, ev.y, 0.7); // the goose lands on its victim
    else if (ev.type === 'stkLaunch') camMoment(ev.tx, ev.ty, 0.65); // the power chick in flight: hold where it lands
    else crawlerMoment(ev);
    switch (ev.type) {
      case 'allyCrow': // the rooster crows: one short shake and a beat of hit-stop (calm: none); the wave itself is drawn in render/allies.js
        fx.kick(0.34); hitStop(0.06); camPunch(0.03, ev.x, ev.y); camMoment(ev.x, ev.y);
        audio.play('crow_old'); // 2026-11-23 mykee: the rebuilt crow is out, the earlier one is back
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
        fx.shake = Math.max(fx.shake, 0.4 + 0.15 * clamp((ev.v || 4) / 8, 0, 1)); // 0.8.10: a crack is felt
        buzz('crack');
        if (ev.why === 'spike') audio.play('rock_hit', { vol: 0.6 });
        // v3: crack stage pop (G34), so every crack is explained
        // a scorch crack: the popup steps aside from the salamander's head, which breathes right there
        let px = ev.x;
        if (ev.why === 'scorch' && sim.sals) { const h = sim.sals.map((C) => C.pts[0]).filter(Boolean).sort((a, b) => Math.hypot(a.x - ev.x, a.y - ev.y) - Math.hypot(b.x - ev.x, b.y - ev.y))[0]; if (h) px += h.x > ev.x ? -0.7 : 0.7; }
        popup(px, ev.y + 0.55, `Crack ${ev.n || ev.egg.cracks}/3`, { sub: ev.why === 'fall' && v3Fall ? (v3Fall === 'eagle' ? 'dropped by the eagle' : `fell ${v3Fall} rings`) : ev.why === 'scorch' ? 'red-hot wall' : ev.why === 'frostbite' ? 'frost bite' : ev.why === 'thornback' ? 'rammed by a thorn-back' : ev.why === 'spike' ? 'grey spikes crack, never break' : '', color: (ev.n || 1) >= 2 ? '#ff7a6a' : '#ffc24a', size: 18, life: 1.1 });
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
        fx.kick(0.6); fx.shake = Math.max(fx.shake, 0.7); // 0.8.10: a lost egg thumps
        G.hitstop = save.calm ? 0.07 : 0.1;
        camPunch(0.05, ev.x, ev.y);
        hen('cry', 2.2);
        const why = { thorn: 'Thorn!', thief: 'Stolen!', ground: 'Missed the nest', lava: 'Into the lava', impact: 'Smashed!', lost: 'Lost', snake: 'The snake got it!', sal: 'Eaten!', frostbite: 'Frost bite!', thornback: 'Rammed!', eagle: 'The eagle took it!', spike: 'Spiked!', ember: 'Burnt!', lightning: 'Zapped!', zap: 'Zapped!', thornball: 'Thorn ball!', blast: 'Blasted!', fall: 'Fell too far!', curtain: 'Thorn curtain!', lavarock: 'Lava rock!', icicle: 'Icicle!', heat: 'Too hot!' }[ev.why] || '';
        if (why && ev.why !== 'fuse') popup(ev.x, ev.y + 0.5, why, { color: '#ff8a7a', size: 20, life: 1.2 });
        break;
      }
      case 'save': {
        { const np = sim.nest.getPosition(); if (!G.nestDrops || G.nestDrops.run !== G.run) G.nestDrops = { run: G.run }; G.nestDrops[ev.n - 1] = { x: ev.x - np.x, y: ev.y - np.y, a: ev.egg && ev.egg.body ? ev.egg.body.getAngle() : 0, t0: G.t }; } // the egg at home starts where the live one was
        if (ev.egg && ev.egg.chick && !ev.egg.powU && sim.banked && sim.banked().includes(ev.egg)) toast('Your chick kept its power. Tap the glowing chick button to use it.', 3);
        audio.play('egg_save', { pitch: (1 + (ev.combo - 1) * 0.12) * (ev.egg && ev.egg.caught ? 1.22 : 1) }); // nest.reach: a catch sings a little higher
        if (ev.combo > 1) audio.play('combo', { intensity: (ev.combo - 2) / 2 });
        buzz('save');
        if (sim.water) { fx.sparkle(ev.x, ev.y, 14); fx.wave(ev.x, ev.y, 1.2, '#fff6c2', 0.5, 0.12); fx.wave(ev.x, ev.y, 1.9, '#ffffff', 0.65, 0.06, { delay: 0.08 }); }
        else fx.nestBurst(ev.x, ev.y - 0.12, G.theme?.palette?.nestStraw || '#d9b45a', sim.groundY + 0.02);
        camPunch(0.035, ev.x, ev.y);
        const noPts = G.li === 0 && G.level.id === 1; // level 1 shows no score (the first-five ladder): the egg counts, not points
        flyToHud(ev.x, ev.y + 0.3, noPts ? 'hud:tray' : 'hud:score', Math.min(3, 1 + (ev.perfect ? 1 : 0) + (ev.combo > 1 ? 1 : 0)));
        const parts = [];
        if (ev.perfect && !noPts) parts.push('PERFECT');
        if (ev.combo > 1 && !noPts) parts.push('COMBO x' + ev.combo);
        popup(ev.x, ev.y + (G.sim.water ? -1.15 : 0.9), noPts ? 'Home!' : '+' + ev.pts, { sub: parts.join('  '), color: '#ffe066', size: 30, life: 1.6, down: !!G.sim.water });
        portal.happy();
        hen('happy', 1.6);
        break;
      }
      case 'lunge': // nest.reach: the hen runs the basket under a falling egg
        if (!save.calm) fx.dust(ev.x + (sim.nestW / 2 + 0.7) * (ev.dir > 0 ? 1 : 0.4), sim.groundY + 0.04, 5, 'rgba(214,190,150,0.8)');
        audio.play('flap', { intensity: 0.6, vol: 0.6 });
        break;
      case 'catch': // ... and caught it (after the normal 'save')
        popup(ev.x, ev.y + 1.75, 'CATCH!', { color: '#7dff8a', size: 32, life: 1.4 });
        camPunch(0.05, ev.x, ev.y);
        hen('catch', 2.4);
        break;
      case 'catchMiss': // she ran for it and it still broke: the 'break' above has her crying already; she looks at it
        hen('sad', 1.8);
        break;
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
        popup(ev.x, ev.y + 0.95, chickLabel(ev.egg), { color: '#ffe14d', size: 24 }); // (2026-11-20: above the chick, clear of its pop out of the shell)
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
        magnetEvent(ev, fx);
        break;
      case 'magnetMiss':
        magnetEvent(ev, fx);
        break;
      case 'goldenSave':
        audio.play('thorn_snap');
        popup(ev.egg.body.getPosition().x, ev.egg.body.getPosition().y + 0.5, 'GOLDEN SHELL!', { color: '#ffd23f', size: 22 });
        break;
      case 'perk': perkBeat(ev, fx); break; // the egg skin's power fires (sim/perks.js)
      case 'timeout':
        if (ev.won) break;
        audio.play('level_fail');
        toast("Time's up!", 2.2);
        break;
      case 'laserHit': // v0.8.9: the beam singes a villain (sim/powers2.js p2LaserFoes): sizzle, soot and smoke, a buzz
        audio.play('lava_sizzle', { vol: 0.6, pitch: 1.6 }); audio.play('glass_crack', { vol: 0.35, pitch: 2.2 });
        fx.chips(ev.x, ev.y, '#2b1a12', 8, 2); fx.smoke(ev.x, ev.y + 0.1, ev.boss ? 3 : 5, 'rgba(50,44,44,0.6)');
        buzz('hit');
        if (!save.seen.laserFoe) { save.seen.laserFoe = 1; persist(); tipToast('The laser stuns villains too!'); }
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
        pipEvent(ev, fx, { popup, audio }); // 0.8.17 pip
        cocoEvent(ev, fx, { popup, audio }); // 0.8.17 coco
        seaEvent(ev, fx, { popup, audio, once: (key, text, d = 3.2) => { if (!G.predToast[key]) { G.predToast[key] = 1; tipToast(text); } } }); // v3.3
        p2Event(ev, fx, P2_API); // v3.4 powers and combos
        bayouEvent(ev, fx, { popup, audio, once: (key, text, d = 3.2) => { if (!G.predToast[key]) { G.predToast[key] = 1; tipToast(text); } } }); // v3.7 Gator Bayou
        thiefEvent(ev, fx, { popup: denPopup, audio, hitStop, once: (key, text, d = 3.2) => { if (!G.predToast[key]) { G.predToast[key] = 1; tipToast(text); } } }); // v3.6 the weasel and the rats
        banditEvent(ev, fx, { popup, audio, hitStop, calm: save.calm, once: (key, text) => { if (!G.predToast[key]) { G.predToast[key] = 1; tipToast(text); } } }); // 0.8.17 bandit
        reefEvent(ev, fx, { popup, audio, once: (key, text, d = 3.2) => { if (!G.predToast[key]) { G.predToast[key] = 1; tipToast(text); } } }); // world 8 reef
        urchinEvent(ev, fx, { popup, audio, buzz, calm: save.calm }); // 0.8.17 urchin
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
  // 0.8.10 (mykee on L9: "Do they have to click on it?"): the "Power ready!" tag lived 1.6 s and the heartbeat is a gold
  // shimmer in a corner, so a player who did not know the badge was a button never saw either. The first two times it fills
  // on a level, a big gold ring pulses round it and a finger taps it until the chick goes.
  if (G.stkHint != null && !(G.sim.stkReady && G.sim.stkReady())) G.stkHint = null;
  if (G.stkHint != null && (EGG_STRIKES.has(K.id) || !G.sim.stkTargets || G.sim.stkTargets().length > 0)) { // (with no villain in yet a tap only says "No villain": the coach waits)
    const cx = r.x + r.w / 2, cy = r.y + r.w / 2, u = ui.u, ph = save.calm ? 0.35 : ((G.t - G.stkHint) * 1.2) % 1, press = !save.calm && ph > 0.35 && ph < 0.6;
    ctx.save();
    for (const q of save.calm ? [0.35] : [ph, (ph + 0.5) % 1]) { ctx.globalAlpha = 0.85 * (1 - q); ctx.strokeStyle = '#ffcf3a'; ctx.lineWidth = (7 - 4 * q) * u; ctx.beginPath(); ctx.arc(cx, cy, r.w * (0.62 + 0.55 * q), 0, 7); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.lineWidth = 3 * u; ctx.strokeStyle = 'rgba(60,30,0,0.6)'; ctx.beginPath(); ctx.arc(cx, cy, r.w * 0.6, 0, 7); ctx.stroke();
    ctx.restore();
    ctx.save(); ctx.translate(cx + r.w * 0.04, cy - r.w * (press ? 0.02 : 0.16)); ctx.rotate(Math.PI + 0.25); teachHand(ctx, 0, 0, r.w * 1.05, press, 1); ctx.restore(); // from above: the badge sits on the screen's bottom edge
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
    G.card = { id, t: 0, dur: first ? 2.6 : 1.3, album: first }; // 0.8.17: the first time it says "Added to your album"
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
      if (!ev.hurt) popup(ev.x, ev.y + 0.5, ev.blocked ? 'Blocked!' : 'Shove!', { color: ev.blocked ? '#cfe8ff' : '#ffe1a8', size: 16, life: 0.8 }); // (a ram that cracks: the crack popup names it)
      else { fx.chips(ev.x, ev.y, '#f3e8d2', 5, 1.8); fx.shake = Math.max(fx.shake, 0.18); }
      once('thornHip', 'A thorn-back rams an egg along the channel and cracks it. Keep your eggs away from his snout.');
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
      if (!ev.bite) popup(ev.x, ev.y + 0.55, 'Licked frozen!', { color: '#bfeaff', size: 18, life: 1.0 }); // (a frost bite: the crack popup names it)
      once('geckoLick', 'His lick bites: a crack, and the egg is frozen stuck until it thaws.');
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
    // ---- 0.8.14: the bite, the frost salamander, fire against frost
    case 'salCoil':
      audio.play('sal_call', { vol: 0.75, pitch: ev.frost ? 1.5 : 1.3 });
      once('salCoil', ev.frost ? 'The frost salamander is about to bite. Roll the egg away!' : 'The salamander is about to eat that egg. Roll it away!');
      break;
    case 'salEat':
      audio.play('squish', { intensity: 0.9, pitch: 0.65 });
      audio.play('rock_hit', { vol: 0.5, pitch: 1.4 });
      if (!ev.chick) fx.chips(ev.x, ev.y, '#f3e8d2', 8, 2);
      fx.shake = Math.max(fx.shake, 0.25);
      break;
    case 'salSnapMiss':
      audio.play('rock_hit', { vol: 0.45, pitch: 1.7 });
      popup(ev.x, ev.y + 0.6, ev.guard ? 'Feather!' : 'Missed!', { color: '#c9ff9e', size: 18, life: 0.9 });
      break;
    case 'salOuch':
      audio.play('rock_hit', { vol: 0.9, pitch: 0.8 });
      fx.sparkle(ev.x, ev.y, 8, '#fff2a8');
      fx.shake = Math.max(fx.shake, 0.2);
      popup(ev.x, ev.y + 0.6, 'Too hard to bite!', { color: '#fff2a8', size: 18, life: 1.0 });
      break;
    case 'salFrostBite':
      audio.play('frost_lick', { vol: 0.9 });
      fx.sparkle(ev.x, ev.y, 10, '#dff6ff');
      fx.chips(ev.x, ev.y, '#d9f3ff', 6, 1.6);
      if (ev.soft) popup(ev.x, ev.y + 0.55, 'Frozen!', { color: '#bfeaff', size: 18, life: 1.0 });
      once('salFrostBite', 'A frost bite cracks the egg and freezes it stuck until it thaws.');
      break;
    case 'salFrost':
      audio.play('frost_lick', { vol: 0.7, pitch: 0.8 });
      fx.sparkle(ev.x, ev.y, 8, '#dff6ff');
      once('salFrost', 'Frost breath ices the wall. Eggs slide on ice.');
      break;
    case 'salFace':
      audio.play('sal_call', { vol: 0.85, pitch: 1.1 });
      fx.sparkle(ev.x, ev.y, 10, '#ffe27a');
      popup(ev.x, ev.y + 0.75, 'Fire vs frost!', { color: '#ffe27a', size: 24, life: 1.3 });
      once('salFace', 'Fire meets frost! While they fight, neither one touches your eggs.');
      break;
    case 'salFaceJet':
      audio.play(ev.frost ? 'frost_lick' : 'sal_breath', { vol: 0.6 });
      break;
    case 'salFaceBurst':
      audio.play('ember_hiss', { vol: 0.9 });
      audio.play('splash', { vol: 0.5, pitch: 0.8 });
      fx.smoke(ev.x, ev.y, 6, 'rgba(236,244,255,0.6)');
      fx.wave(ev.x, ev.y, 0.9, '#eaf6ff', 0.45, 0.07);
      fx.shake = Math.max(fx.shake, 0.3);
      popup(ev.x, ev.y + 0.75, 'Both knocked out!', { color: '#c9ff9e', size: 20, life: 1.3 });
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
    const SH = winShow(r);
    if (revealing(r) && r.t >= SH) { rvTap(r); return; } // a tap during a reward reveal: to its open state, then the next one (or the card)
    // with rewards waiting: first to the stars' end state (all landed, held), the next tap on to the rewards; without: straight to the card, the routine at its final pose
    const end = revealing(r) ? (r.t < r.starEnd ? r.starEnd : SH) : Math.max(routine(r.cheer).len, SH + WIN_IN * 0.6 + WIN_COUNT);
    if (r.t < end) { const snd = r.stars && r.t < starAt(r, r.stars - 1); r.t = end; r.shownTotal = r.total; if (snd) { audio.play('star', { intensity: (r.stars - 1) / 2 }); buzz('star'); } }
  } else if (G.screen === 'fail') G.screenT = Math.max(G.screenT, routine('encourage').len);
}

function stopFuse() {
  if (G.fuseHandle && G.fuseHandle.stop) G.fuseHandle.stop();
  G.fuseHandle = null;
}

// ---------------------------------------------------------------- results
// 2026-11-16 (mykee: "I saved every egg and still got 2 stars"): which stars are still within reach, shown live in the
// egg tray, with a short note the moment one is lost. 2nd star: no egg lost; 3rd: also no egg cracked.
// 0.8.7: the three goals change from level to level (src/goals.js); a star is its goal, each judged on its own
function goalsLive(sim) {
  if (!sim || !G.goals) return [true, true, true];
  const F = GL.facts(sim);
  return G.goals.map((g) => GL.judge(g, F) !== 'lost');
}
function watchStars() {
  if (G.screen !== 'play' || !G.sim || G.sim.state !== 'play' || G.li === -1 || !G.goals) return;
  if ((G.goalTick = (G.goalTick || 0) + 1) % 6) return; // ten times a second is plenty
  const now = goalsLive(G.sim), was = G.goalOk || [true, true, true];
  for (let i = 1; i < 3; i++) if (was[i] && !now[i]) { const l = GL.lostLine(G.goals[i]); if (l) toast(`${l}: a star is gone`, 2.4); }
  G.goalOk = now;
}
const TRAY_STARS = (u) => 6 * u + 3 * 15 * u; // the width the tray's star group takes
function drawTrayStars(x, y, u) {
  if (G.li === -1) return;
  const ok = G.goalOk || [true, true, true];
  ctx.fillStyle = 'rgba(255,232,196,0.3)';
  ctx.fillRect(x, y - 9 * u, 1.5 * u, 18 * u);
  for (let i = 0; i < 3; i++) drawStar(ctx, x + 6 * u + 15 * u * (i + 0.5), y, 6.6 * u, ok[i], 1, false);
  ui.record({ x: x + 6 * u, y: y - 8 * u, w: 45 * u, h: 16 * u }, 'hud:stars');
}

function computeResult() {
  const sim = G.sim;
  const st = sim.stats();
  const L = G.level;
  const timeBonus = Math.floor(sim.timeLeft) * 10;
  // 0.8.7: one star per goal (src/goals.js); a rewind (an ad reward) costs no star
  const goals = G.goals || GL.levelGoals(L, sim.MD.fuse, G.li >= 0, sim.mode), F = GL.facts(sim), sc = GL.score(goals, { ...F, won: st.saved >= st.target });
  const stars = sc.stars;
  const streak = stars === 3 ? (save.streak || 0) + 1 : 0;
  const streakMult = [1, 1, 1.2, 1.5, 2][Math.min(4, streak)];
  const base = st.score + timeBonus;
  const total = Math.round(base * streakMult);
  // coins (F7) and the bonus objective (C3): bonus coins are paid the first time it is met, per mode
  const bonus = !!L.bonus && sim.bonusMet();
  const bonusCoins = bonus && !save.bonus[sk(L.id, sim.mode)] && G.li >= 0 ? BONUS_COINS : 0;
  // 0.8.17 the Mint: a level won again without a new star pays its replay share (40%); Easy pays its share (FAUCETS.easy)
  let coins = E.levelCoins({ stars, saved: st.saved, eggs: st.total, perfect: st.perfect, levelId: L.id, hard: isHardLevel(L) && G.li >= 0, fresh: G.li >= 0 ? stars > bestStarsOf(L.id) : true, easy: G.li >= 0 && sim.mode === 'easy' }).total + bonusCoins;
  if (G.li < 0) coins = G.li === -1 && stars && save.daily.paid !== today() ? coins + DAILY_COINS : 0; // the Daily Vault pays once a day; a lab vault pays nothing
  const cracked = sim.savedLog.filter((q) => q.cracks > 0).length, used = sim.timeLimit ? Math.max(0, sim.timeLimit - Math.max(0, sim.timeLeft)) : sim.t;
  return { broken: st.broken, cracked, used, stars, saved: st.saved, eggs: st.total, eggScore: st.score, timeBonus, streak, streakMult, total, shownTotal: 0, t: 0, target: st.target, perfect: st.perfect, rewound: G.usedRewind, coins, bonus, hasBonus: !!L.bonus && !goals.some((g) => g.kind === L.bonus.kind || (g.b && g.b.kind === L.bonus.kind)), // a bonus that is a star goal is not listed twice
    goals: goals.map((g, i) => ({ long: g.long, ok: sc.met[i], res: GL.outcome(g, F, sc.met[i]) })) };
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
  G.result.purse0 = save.wallet.coins; // the purse before this win: the card rolls it up to the new total (purse.gain)
  pacerWin(); // the Pacer: a dare met pays its share (before the skin's power and the bank, like the win's own coins)
  { // the egg skin's coin power (Shiny, Midas, Treasure Sense) first, then Golden Hour, then the bank's share
    const pre = G.result.coins, pk = eggPerk();
    G.result.coins = E.perkCoins(eggPerkId(), pre, G.sim.savedLog.length);
    G.result.perkCoins = G.result.coins - pre; G.result.perkGold = !!(pk && pk.id === 'golden');
    // 0.8.17 the Mint's online share, its own line on the win page; offline the line is simply absent (never blocks play)
    G.result.online = MINT.onlineBonus(pre, MINT.isOnline({ web: !ads.moneyShop, nav: typeof navigator !== 'undefined' ? navigator : null, bridge: typeof window !== 'undefined' ? window.EggApp : null }));
    G.result.coins += G.result.online;
    const P = E.payWin(save.wallet, G.result.coins, ads.moneyShop);
    ledger(ledWhy); save.wallet = P.wallet; G.result.coins = P.coins; G.result.goldHour = P.doubled; ledger('win'); ledWhy = 'win';
    // 0.8.17: the win page's videos share the Mint's pot a day (Double coins, the Bonus chest's coins): offered only while it holds them
    G.result.dblOk = MINT.winVideoOk(save.mint, today(), G.result.coins);
  }
  if (G.result.bonus) save.bonus[sk(G.level.id, G.sim.mode)] = 1;
  if (G.li >= 0 && G.level) { // the Director: the result, a skin trial running down, and now and then a new one as a gift
    DR.noteResult(save, G.level.id, true, { saved: G.sim.savedLog.length }); BR.note(save, 'level');
    ENG.result(save, { id: G.level.id, won: true, secs: G.sim.t, near: false }, { hard: isHardLevel(G.level), videoShown: !ads.premium && !earlyDays(), coinShown: false, rewound: !!G.usedRewind, boosts: Object.keys(G.boost || {}).filter((k) => G.boost[k]).length });
    DR.tickTrial(save);
    G.result.hot = DR.hotCount(save);
    // 2026-11-20 shop 2.0 (no interstitials in the app): when an ad break would have been due, the win card offers a
    // Bonus chest video instead of Double coins. Never on a losing streak.
    if (!earlyDays() && MINT.winVideoOk(save.mint, today(), E.BONUS_CHEST.coins) && ads.bonusDue({ levelId: G.level.id, frustrated: DR.frustration(save, G.level.id) >= 0.5 })) { ads.noteBonus(); G.result.chest = E.bonusChest(G.level.id); }
  }
  G.trialChick = null;
  G.result.prevBest = G.li >= 0 ? save.best[sk(L.id, G.sim.mode)] || 0 : null; // the card's "NEW BEST!" compares with the best before this run
  // the spin meter (spin.js): a fresh win (first pass, more stars than before, today's first Daily Vault) is one step,
  // and time in the game is a slower one. Judged before the result is filed, counted after it (level 3 opens the wheel).
  const freshWin = G.li >= 0 ? G.result.stars > bestStarsOf(L.id) : G.li === -1 && G.result.stars > 0 && save.daily.paid !== today();
  recordResult();
  if (G.li >= -1) {
    const got = SP.noteWin(save, freshWin), played = G.sim.t >= 15 && SP.notePlayed(save, today());
    G.result.spin = { fresh: freshWin && SP.open(save), got: (got ? 1 : 0) + (played ? 1 : 0), ...SP.meter(save) };
    if (G.li >= 0) { const mo = L.boss ? 'boss' : G.result.spin.got ? 'spin' : ''; G.remDue = mo && remAskOk(mo) ? mo : null; } // 0.8.17: the reminder question at a happy moment (a boss beaten, a spin banked)
    persist();
  }
  if (G.li >= 0 && L.boss && E.bossTreasure(L.id) && !E.treasureOpened(save.wallet, L.id) && bossBeaten(L.id)) { // the boss treasure opens in the celebration, not on the map
    const w = E.openBossTreasure(save.wallet, L.id);
    if (w) { save.wallet = w; G.result.treasure = E.bossTreasure(L.id); ledWhy = 'treasure'; persist(); ledWhy = 'win'; }
  }
  if (G.li >= 0) { // a taste (Director): a free try of a store item, after recordResult so a chick this win unlocks anyway is not "tasted"
    const nextOk = G.li + 1 < LEVELS.length && L.id + 1 >= STRIKE_FROM;
    const chicks = nextOk ? STRIKES.filter((S) => !strikesOpen().includes(S) && E.CHICK_PRICES[S.id]).map((S) => ({ id: S.id, name: S.name, price: E.CHICK_PRICES[S.id] })) : [];
    const T = DR.winTaste(save, { levelId: L.id, boss: !!L.boss, chicks });
    if (T) {
      DR.startTaste(save, T, Date.now());
      if (T.kind === 'boost') { save.wallet = E.tasteBooster(save.wallet, T.id); ledger('gift'); }
      if (T.kind === 'chick') G.stkSel = { lid: L.id + 1, id: T.id }; // picked for the next level by itself
      G.result.gift = T; persist();
    }
  }
  G.result.hotB = G.li >= 0 && G.result.hot >= 2 ? DR.hotBoosts(save) : []; // what the next level's start will give (the same call it uses)
  { const r = G.result, list = [];
    if (r.treasure) list.push({ kind: 'treasure' });
    if (r.gift) list.push({ kind: 'gift' });
    if (r.hotB.length) list.push({ kind: 'hot' });
    r.rv = { list: list.slice(0, 3), i: 0, t: 0 }; }
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
  buzz('fail');
  if (G.li >= 0 && G.level) ads.fail(G.level.id);
  G.failHelp = null;
  G.failSpin = null;
  if (G.li >= 0 && G.level) { // the Director: note the loss, then pick the one help card for the fail screen
    const st = G.sim.stats();
    DR.noteResult(save, G.level.id, false, { saved: st.saved }); BR.note(save, 'level');
    { const canRew = !G.usedRewind && G.sim.canRewind(); ENG.result(save, { id: G.level.id, won: false, secs: G.sim.t, near: st.target >= 2 && st.saved === st.target - 1 }, { hard: isHardLevel(G.level), near: st.target >= 2 && st.saved === st.target - 1, videoShown: !ads.premium, coinShown: canRew && !ads.premium, price: DR.rewindPrice((G.rewindBuys || {})[G.level.id]), rewound: !!G.usedRewind, boosts: Object.keys(G.boost || {}).filter((k) => G.boost[k]).length }); }
    DR.tickTrial(save);
    { // the spin meter: the third loss in a row on a level banks a cheer-up spin (once per level); time played is a slow step
      const run = ((save.dir && save.dir.att && save.dir.att[G.level.id]) || {}).streak || 0;
      const cheer = SP.noteLoss(save, G.level.id, run, today()), played = G.sim.t >= 15 && SP.notePlayed(save, today());
      G.failSpin = { cheer, got: (cheer ? 1 : 0) + (played ? 1 : 0), ...SP.meter(save) };
    }
    G.failHelp = earlyDays() ? null : DR.failHelp(save, { ...failCtx(st), struggling: !!(save.adapt !== false && (ENG.pacer.read(save, { levelId: G.level.id }) || {}).struggling) });
    pacerFail(); // the Pacer: the skip pop-up, a free hint, a free Scarecrow at a boss
    if (st.target >= 2 && st.saved === st.target - 1) BR.why(save, 'fail', 'soclose', `one egg short on level ${G.level.id}: ${earlyDays() || G.usedRewind || !G.sim.canRewind() ? 'said so, RETRY leads' : 'Rewind leads, RETRY under it'}`);
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
  fuseIntroTick(dt, sim); // the fuse intro: the world waits until it ends
  const running = (G.screen === 'play' && !fuseIntroOn()) || ((G.screen === 'win' || G.screen === 'fail') && G.screenT < 4);
  keyboardTurn(dt);
  // slow motion (power cards, the last egg) scales the world's time, not the UI's
  const sdt = G.slow ? dt * slowScale(G.slow) : dt;
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
  else if (G.hintFree) freeHintTick(); // the Pacer's free hint, once the try is running
  if (G.hitstop > 0) G.hitstop -= dt;
  else if (running && !G.adBusy) {
    // 2026-11-20 pacing: the step count rounds a little early (acc may sit up to a quarter step below zero), so a frame
    // of exactly two steps never wobbles between 1 and 3 on float noise; a long frame catches up over the next few
    // frames (at most 8 steps in one) instead of in one heavy frame that makes the next one late as well
    G.acc = Math.min(G.acc + Math.min(sdt, 0.1), 0.1);
    let n = 0;
    while (G.acc >= DT * 0.75 && n < 8) { if (DEV && G.autoplay) botTick(sim, G.botMem || (G.botMem = {})); sim.step(); G.acc -= DT; n++; }
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
  // a burning thorn curtain burns with the game's own fire: flames climb from both burning ends as they eat outward
  for (const ring of sim.rings) for (const g of ring.gaps) {
    const C = g.curtain;
    if (!C || !C.alive || !C.burning) continue;
    if (C.vine) { // a sealed thorn vine burns back from its tip
      const a = ring.body.getAngle() + g.a + vineFront(g.len, RING_TH, 1, C.burn) / ring.r, x = ring.r * Math.cos(a), y = ring.r * Math.sin(a);
      G.fx.flameAt(x, y + 0.04, 1.15); G.fx.flameAt(x, y - 0.06, 0.9);
      continue;
    }
    const A = ring.body.getAngle() + g.a, off = curtainFront(g.len, RING_TH, C.burn) / ring.r;
    for (const sd of [-1, 1]) {
      const a = A + sd * off, x = ring.r * Math.cos(a), y = ring.r * Math.sin(a);
      G.fx.flameAt(x, y + 0.04, 1.15); G.fx.flameAt(x, y - 0.06, 0.9);
      if (Math.random() < 0.06) G.fx.smoke(x, y + 0.25, 1);
    }
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
  // 0.8.17: a level's villain tip never follows the player out of the level. Its clock only runs in play, so one carried
  // to the home page, the map or the shop by a fast Back used to stay there for good
  if (G.screen !== 'play' && G.screen !== 'pause' && G.screen !== 'info' && G.screen !== 'intro') { if (G.toast && G.toast.tip) G.toast = null; if (G.toasts.some((q) => q.tip)) G.toasts = G.toasts.filter((q) => !q.tip); }
  if (G.toast && (!G.toast.tip || G.screen === 'play') && !fuseIntroOn()) { G.toast.life -= dt; if (G.toast.life <= 0) G.toast = null; } // a villain tip's clock stops while the game is paused
  if (!G.toast && G.toasts.length) G.toast = { ...G.toasts.shift(), t0: G.t };
  if (G.result && G.screen === 'win') {
    const r = G.result, RV = r.rv, SH = winShow(r);
    if (save.calm && !(revealing(r) && r.t >= SH)) skipCheer(); // reduced motion: straight to the card and her final pose (each reward still shows for a second)
    if (revealing(r) && r.t >= SH) { // the reward reveals hold the show's clock: the card waits behind them
      r.t = SH;
      const it = RV.list[RV.i], P = rvPlan(r, it), a = RV.t, b = RV.t + dt;
      if (save.calm) { if (a === 0) { audio.play(...REVEAL_SND[it.kind]); buzz('win'); rvClaim(r, it); } RV.t = b; if (b >= 1) rvNext(r); return; }
      for (const [at, fn] of P.cues) if (a <= at && b > at) fn(); // its sounds and ticks, each on its beat
      RV.t = b;
      if (RV.t >= P.end && !land.busy()) rvNext(r); // (it waits for the coins to land in the purse on the page)
      return;
    }
    const R0 = routine(r.cheer), t0 = r.t;
    r.t += dt;
    // the score (and the coins with it) counts up as the card comes in: the show before it belongs to the stars
    const k = clamp((r.t - SH - WIN_IN * 0.6) / WIN_COUNT, 0, 1);
    const shown = Math.round(r.total * k);
    if (shown !== r.shownTotal && k < 1 && Math.floor(r.t * 20) !== Math.floor((r.t - dt) * 20)) audio.play('score_tick', { vol: 0.3 });
    r.shownTotal = shown;
    for (let s = 0; s < r.stars; s++) if (r.t >= starAt(r, s) && t0 < starAt(r, s)) { audio.play('star', { intensity: s / 2 }); buzz('star'); } // each star lands: its bell and a tick
    if (r.stars === 3) { const f = starAt(r, 2) + 0.06; if (r.t >= f && t0 < f) { audio.play('confetti'); buzz('win'); } } // three of three: the finish
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

// slow motion: a plain { left, scale } holds its scale; one with `dur` (the winning egg) eases the sim clock down to
// `scale`, holds, and eases back up, so the world glides into slow motion and out (never a frame-rate drop)
function slowScale(S) {
  if (!S.dur) return S.scale;
  const u = clamp(1 - S.left / S.dur, 0, 1), sm = (x) => x * x * (3 - 2 * x);
  const k = u < 0.22 ? sm(u / 0.22) : u > 0.6 ? 1 - sm((u - 0.6) / 0.4) : 1;
  return 1 + (S.scale - 1) * k;
}
// The last egg (C9; 2026-11-20 first-five ladder): the moment the egg that wins the level drops out of the outer ring
// toward the basket (every other egg is home, gone or falling too, and enough will be home), time eases into slow
// motion for about half a second of play and the hen leans in; the catch then lands with its burst and her cheer.
function lastEggMoment(sim) {
  if (G.lastEgg || G.screen !== 'play' || sim.state !== 'play') return;
  const alive = sim.aliveEggs(), n = sim.rings.length;
  if (!alive.length || alive.some((e) => sim.channelOf(e) < n) || sim.savedLog.length + alive.length < (sim.level.target || 1)) return;
  const nx = sim.nest.getPosition().x;
  for (const e of alive) {
    const p = e.body.getPosition(), v = e.body.getLinearVelocity();
    if (v.y * (sim.gy || 1) < -0.5 && Math.abs(p.x + v.x * 0.3 - nx) < sim.nestW / 2 + 0.4) {
      G.lastEgg = true;
      if (!save.calm) G.slow = { left: 1.1, dur: 1.1, scale: 0.3 }; // ~0.5 s of play stretched over 1.1 s
      hen('worried', 1.1);
      return;
    }
  }
}

// ---------------------------------------------------------------- render
const MENU_FX = { title: 1, levels: 1, store: 1, extras: 1, practice: 1, info: 1, intro: 1, pause: 1, win: 1, fail: 1, spin: 1 };
const SCENE_SCREENS = { title: 1, store: 1, practice: 1, levels: 1, spin: 1 }; // these paint a full themed scene (0.8.10: the map paints its own whole picture too, and the wash, drawn after it, dimmed its header and PLAY); the others keep the game behind and get a wash
function menuFx() { if (MENU_FX[G.screen] && !SCENE_SCREENS[G.screen]) themeWash(ctx, ui.skin, W_, H_); if (MENU_FX[G.screen]) menuFxBack(ctx, ui.skin, save, W_, H_, ui.u, DPR, G.t); }
function renderAll() { themeTick(G.t, save.calm || PERF.low); render(); drawSkipChip(); if (MENU_FX[G.screen] && !(G.infoFrom === 'wonder' && G.screen === 'info')) menuFxFront(ctx, ui.skin, save, ui.buttons, H_, ui.u, G.t); purse.draw(ctx, ui.u, ui.A, drawCoin, ui); LAND_KIT.ui = ui; prizePop.draw(ctx, ui.u, ui.A, LAND_KIT); if (G.adBusy) drawAdWait(W_, H_); } // + snow piles on the buttons, the gold sweep; the ad wait over every screen (title, map, Wonder included)
function drawStoreScreen() { // the shop's toast floats over its scrolling list (like a clipped card, it records nothing)
  drawStore(ui, ctx, W_, H_, { ...storeState(), area: ui.A, adReady: adCd() === 0, adCooldownLeft: adCd(), adCoins: adCoins(), tab: G.storeTab, scroll: G.sscroll, dragging: !!(G.pdrag && G.pdrag.moved), featured: storeFeatured() }); { const ci = ui.rects.find((r) => r.tag === 'store:coinicon'); if (ci) purse.at({ x: ci.x + ci.w / 2, y: ci.y + ci.h / 2 }); } const n0 = ui.rects.length; drawToast(); ui.rects.length = n0; menuFx(); /* the shop paints its own backdrop: the effect drifts over it */
}
function render() {
  const t = G.t;
  setSpriteCalm(save.calm); // reduced motion holds the flat sprites still
  setSceneCalm(save.calm); // and the farm scenes' live touches (src/render/farmscene.js)
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ui.begin();
  setAdOff(!ads.videoOk); // 0.8.17: offline (or no video loaded): every video button shows its offline state
  if (G.screen === 'wonder' || (G.screen === 'info' && G.infoFrom === 'wonder')) { wonder.render(); if (G.screen === 'info') drawInfo(); if (DEV || G.checkOverlaps) G.overlaps = ui.overlaps(); return; } // WONDER (the "i" panel can sit over a Wonder Vault)
  if (!G.sim) {
    ctx.fillStyle = '#1b1410';
    ctx.fillRect(0, 0, W_, H_);
    return;
  }
  if (G.screen === 'levels') { drawLevels(); menuFx(); drawToast(); drawModals(); if (DEV || G.checkOverlaps) G.overlaps = ui.overlaps(); return; } // the map covers the screen: no vault drawn under it
  if (G.screen === 'spin') { drawSpin(); drawToast(); drawModals(); if (DEV || G.checkOverlaps) G.overlaps = ui.overlaps(); return; } // 0.8.15: the Lucky Spin paints its own room too
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
  // Screen shake from trauma (fx.shake, 0..1): power 1.4 (0.35 is about 2.5 px, 0.7 about 7), so small hits still read and big ones thump; smooth
  // noise (summed sines), not per-frame random, with a whisper of roll. A few px at most. Reduced motion (C10)
  // turns off shakes, punches and flashes.
  // 0.8.10: stronger (a crack about 6 px, a broken egg about 11, a boss slam about 16): 0.8.9's 1.4 px crack was not seen on a phone
  const tr = save.calm || save.shake === false ? 0 : Math.pow(fx.shake, 1.15), amp = clamp(19 * ui.u, 15, 26) * tr;
  const ox = save.calm || save.shake === false ? 0 : amp * (Math.sin(t * 53.1) + 0.6 * Math.sin(t * 31.7 + 2.1)) / 1.6 + G.weather.shakeX;
  const oy = save.calm || save.shake === false ? 0 : amp * (Math.sin(t * 47.3 + 1.3) + 0.6 * Math.sin(t * 27.9 + 0.4)) / 1.6 + G.weather.shakeY;
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
  { const bq = blastQ(); if (bq < 0.3) { if (bq > 0) { ctx.save(); ctx.globalAlpha *= 1 - bq / 0.3; } W.drawVaultBack(ctx, sim, G.theme); if (bq > 0) ctx.restore(); } } // premium pass: plate behind the vault (it goes with the vault: it used to stay as a ghost disc)
  if (DEV && G.probe) G.probe('vaultback');
  fx.draw(ctx, 'back');
  blastXf(() => { // v3 portals; an orb-only swirl (entry = exit, no pull) is drawn as an orb spring (2026-11-16)
    const spring = (pt) => !pt.pull && Math.hypot(pt.ax - pt.bx, pt.ay - pt.by) < 0.05;
    for (const pt of sim.portals) if (!spring(pt)) { W.drawPortalLink(ctx, pt, t); W.drawPortalPull(ctx, pt, t); }
    for (const pt of sim.portals) { if (spring(pt)) W.drawOrbSpring(ctx, pt.ax, pt.ay, t); else { W.drawPortal(ctx, pt.ax, pt.ay, t, false); W.drawPortal(ctx, pt.bx, pt.by, t, true); } }
  }, 0.4);
  if (sim.timeLimit && sim.state === 'play') W.drawFuse(ctx, sim.outerR + 0.32, fuseShown(sim) / sim.timeLimit, t, G.screen === 'play' ? fx : null, sim.rings[sim.rings.length - 1]); // v4: hugs a shaped vault
  if (DEV && G.probe) G.probe('portalsFuse');
  if (sim.water) drawSurface(ctx, sim, G.theme, t, k, sim.savedLog.length); else W.drawNest(ctx, sim, G.theme, t, sim.savedLog.length, G.nestDrops && G.nestDrops.run === G.run ? G.nestDrops : null, G.t, nestPass(k, t)); // world 8: the basket under the boat
  if (DEV && G.probe) G.probe('nest');
  if (sim.band) blastXf(() => drawBandit(ctx, sim, t, k, save.calm), 2.6); // 0.8.17 bandit: under the rings (their edge pinches his arm)
  { const tl = toWorld(0, G.hudBottom + 8 * ui.u), tr = toWorld(W_, 0); allyFrame(sim, { x0: tl.x, x1: tr.x, top: tl.y }, save.calm, G.screen === 'play' ? fx : null); } // the rooster's perch and the crow wave (render only)
  if (DEV && G.probe) G.probe('ally');
  const eggPts = sim.aliveEggs().map((e) => e.body.getPosition());
  const V3O = { hot: sim.aliveEggs().some((e) => e.fire > 0 && (e.fireKind === 'fire_red' || e.fireKind === 'fire_black')) }; // a flame is about: thorn curtains glow like tinder
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
      W.drawV3Ring(ctx, ring, k, t, G.theme, V3O);
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
  blastXf(() => drawThiefDens(ctx, sim, t, k, 'in', (e) => drawEggFelt(e, t, k)), 2.2); // 0.8.16: inside the weasel's stump (a thief in its doorway, the stolen eggs), then its front: a thief outside is in front of it
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
  drawScarecrowAt(sim, k, t);
  if (G.screen === 'play' || G.screen === 'intro') { if (sim.water) drawRiseGuide(ctx, sim, t); else W.drawDropGuide(ctx, sim.rings[sim.rings.length - 1], sim.reach ? sim.nestX0 : sim.nest.getPosition().x, sim.nestW, t); } // nest.reach: judged from her home spot (no flicker while she runs)
  for (const r of sim.rocks) if (r.alive) W.drawRock(ctx, r, G.theme);
  for (const b of sim.bombs) if (b.alive) b.spark = W.drawBomb(ctx, b, t);
  for (const d of sim.debris) W.drawDebris(ctx, d, G.theme);
  blastXf(() => { W.drawLavaRocks(ctx, sim, k, t); W.drawIcicles(ctx, sim, k, t); }, 16.2); // v3
  blastXf(() => drawBossUnder(ctx, sim, k, t), 4.3);
  W.drawEagleAt(ctx, sim, t, k, 'back'); // predators (v3): eagle shadow under the eggs
  SL(['sal'], (c) => drawSalamanders(c, sim, t, k)); // v3.2: the lava salamander walks the floor, under the eggs
  blastXf(() => drawFrogTele(ctx, sim, k, t), 5.2); // v3.3: the frog's hop mark, then the frog itself (eggs land on it)
  { const wx = warpXfBegin(ctx, sim, 'f'); SL(['frog'], (c) => drawFrogs(c, sim, t, k, G.theme)); warpXfEnd(ctx, wx); }
  { const wx = warpXfBegin(ctx, sim, 'o'); SL(['octo', 'fish'], (c) => drawSeaUnder(c, sim, t, k, G.theme)); warpXfEnd(ctx, wx); } // v3.3: fish, ink, the octopus (the arms behind a held egg)
  SL(['hermit', 'puff', 'jelly', 'kc'], (c) => drawReefUnder(c, sim, t, k, G.theme)); // world 8: bubbles, hermit crabs, puffers, jellyfish, the King Crab
  SL(['urchin'], (c) => drawUrchins(c, sim, t, k, save.calm)); // 0.8.17 urchin: Spike rolls on the channel floor, under the eggs
  SL(['thief'], (c) => drawThieves(c, sim, t, k)); // v3.6: the weasel and the rats on the ring floor
  SL(['pip'], (c) => { pipCalm(save.calm); drawPips(c, sim, t, k); }); // 0.8.17 pip: on his channel floor, under the eggs he holds
  SL(['coco'], (c) => { cocoCalm(save.calm); drawCocos(c, sim, t, k); }); // 0.8.17 coco: on his ring and his floor, under the eggs (and his peels)
  blastXf(() => drawClockworkTele(ctx, sim, t, k), 6.1); SL(['spider', 'beetle', 'jack'], (c) => drawClockwork(c, sim, t, k)); // v4: webs, spring jacks, wind-up beetles, spiders
  SL(['gator', 'turtle'], (c) => drawBayou(c, sim, t, k)); // v3.7: gators and snapping turtles on the channel floor (eggs roll over them)
  if (DEV && G.probe) G.probe('creatures');
  for (const e of sim.aliveEggs()) if (!overNest(sim, e) && !eggInDen(sim, e) && !bandHides(sim, e)) drawEggFelt(e, t, k); /* 0.8.17 bandit: not his sack */ // v3.2: chick kinds, tinted eggs; game feel: through the egg's squash (an egg dropping into the basket was drawn with the nest, behind its front wall)
  drawChickFX(ctx, sim, t, k);
  drawMagnetField(ctx, sim, t, k, save.calm); // v3.1 magnet; 2026-11-20: over the eggs (the two poles, the field lines, the pull)
  blastXf(() => { const wx = warpXfBegin(ctx, sim, 'o'); drawSeaOver(ctx, sim, t, k); warpXfEnd(ctx, wx); }, 10.4); // v3.3: the arms wrapped over a held egg
  blastXf(() => drawReefOver(ctx, sim, t, k), 8.2); // world 8: claws over a held egg, the silt cloud
  if (sim.water) drawBoat(ctx, sim, t, k); // world 8: the boat on the surface, over the hen's legs
  blastXf(() => drawThiefDens(ctx, sim, t, k, true), 2.2); // 2026-11-19: the den's rim and shade over a stolen egg (it lies inside); the stump's red alert
  blastXf(() => drawThievesOver(ctx, sim, t, k), 9.1); // v3.6: the weasel's jaws over a held egg, the trap ring
  SL(['coco'], (c) => drawCocoOver(c, sim, t, k)); // 0.8.17 coco: his tail's curl over the egg he holds, a peel in flight
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
  if (G.screen !== 'title' && G.screen !== 'levels' && G.screen !== 'store' && G.screen !== 'extras' && G.screen !== 'practice' && G.screen !== 'info' && G.screen !== 'intro' && G.screen !== 'win' && G.screen !== 'fail') drawHUD();
  if (DEV && G.probe) G.probe('hud'); // the intro card carries the name, eggs and time (mykee: the name showed twice)
  if (G.screen === 'play') drawFlyers(); // prizes on their way to the HUD
  if (G.screen === 'play') {
    // the power card owns the top of the screen while it shows
    if (G.card) drawCard();
    else if (!fuseIntroOn()) { drawPopups(); drawToast(); } // the fuse intro holds the tips back
    drawKeyHint();
    drawFuseIntro();
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
  if (G.screen === 'extras') { if (G.album) drawAlbum(); else wonder.drawExtras(); } // Extras: Wonder Vaults + the Practice button (0.8.17: the combo album over it)
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
const blastQ = () => (G.burstAt != null && G.sim && (G.sim.state === 'winning' || G.sim.state === 'won') ? (G.t - G.burstAt) / BLAST_T : 0);
// 2026-11-20 (mykee: "when the level is completed everything breaks ... certain instances where it's not properly
// handled"): the layer used to swell to 2.6x from the vault's centre while it fell, so a weasel, a gator or the Rat King
// standing on the ground sank through the earth, and portals hung on as giant ghosts. Now it is blown off in under half a
// second: a small kick outward and up, a slight turn, gone.
function blastXf(draw, seed = 0) {
  const q = blastQ();
  if (q <= 0) return draw();
  if (q >= 0.55) return;
  const u = q / 0.55, e = 1 - (1 - u) * (1 - u);
  ctx.save();
  ctx.globalAlpha *= 1 - u * u;
  ctx.translate(0, 0.5 * e * (G.sim.gy || 1)); // lifted off (world y is up; under water "up" is down)
  ctx.rotate((seed % 2 ? 1 : -1) * 0.12 * e);
  ctx.scale(1 + 0.28 * e, 1 + 0.28 * e);
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

// which boosters this level has a use for (they lead the level card's row) and which it has none for (they come last)
// a booster's lesson (level card): the one he owns, has never picked and this level has a use for; none in the first levels
function boostTeach(L) { return earlyDays() ? null : boostUse(L).first.find((id) => E.ownedCount(save.wallet, id) > 0 && !(save.seen || {})['bu:' + id]) || null; }
function boostUse(L) {
  const foes = villainKinds(L).some((k) => (VILLAIN_INFO[k] || {}).group !== 'hazard'), thorns = (L.rings || []).some((r) => r.thorns && r.thorns.length);
  return { first: [foes && 'scare', thorns && 'snips'].filter(Boolean), last: [!foes && 'scare', !thorns && 'snips'].filter(Boolean) };
}
// The Scarecrow booster in the level (0.8.15, mykee: "one time immunity from villains"): it stands at the nest's other
// side from the hen for its 20 seconds with the time left on a dial over its hat, and tips over when the time is up.
function drawScarecrowAt(sim, k, t) {
  const left = sim.scareT || 0, S = G.scareFx && G.scareFx.run === G.run ? G.scareFx : (G.scareFx = { run: G.run, on: false, t0: t, endT: -9 });
  if (left > 0) { if (!S.on) { S.on = true; S.t0 = t; } S.endT = t; }
  const gone = left > 0 ? 0 : t - S.endT;
  if (!S.on || gone > 1 || k < 20 || !G.henAt) return;
  const n = sim.nest.getPosition(), H = G.henAt, calm = save.calm, h = H.s * k * 1.12;
  const pop = calm ? 1 : Math.min(1, (t - S.t0) / 0.32), grow = pop < 1 ? 1 + 0.18 * Math.sin(pop * Math.PI) : 1; // up out of the ground with a small overshoot
  const fall = calm ? 0 : clamp(gone / 0.45, 0, 1), fade = clamp(1 - (gone - 0.55) / 0.4, 0, 1);
  ctx.save();
  ctx.translate(2 * n.x - H.x, H.y); ctx.scale(1 / k, -1 / k);
  ctx.globalAlpha = fade;
  ctx.fillStyle = 'rgba(0,0,0,0.24)'; ctx.beginPath(); ctx.ellipse(0, 0, h * 0.3, h * 0.06, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.rotate(-fall * fall * 1.45); ctx.scale(grow, pop * grow);
  drawBoosterIcon(ctx, 'scare', 0, -h * 0.5, h, calm ? 0 : t);
  ctx.restore();
  if (left > 0) { // the dial: a white disc, a green rim that runs down (orange in the last five seconds), the seconds in it
    const r = Math.max(11, h * 0.2), cy = -h * 1.16 - r, f = clamp(left / SCARE_S, 0, 1), hot = left <= 5, beat = hot && !calm ? 1 + 0.08 * Math.sin(t * 12) : 1;
    ctx.save(); ctx.translate(0, cy); ctx.scale(beat * pop, beat * pop);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.lineWidth = Math.max(1.5, r * 0.12); ctx.strokeStyle = '#4a2c10'; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.76, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.lineWidth = r * 0.24; ctx.lineCap = 'round'; ctx.strokeStyle = hot ? '#f08a1c' : '#3aa82c'; ctx.stroke();
    ctx.font = `600 ${r * 0.92}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = hot ? '#c85a08' : '#3a2410'; ctx.fillText(String(Math.ceil(left)), 0, r * 0.06);
    ctx.restore();
  }
  ctx.restore();
}
const HEN_N = { x: 0, y: 0 };
// The hen sits beside the nest (F16) and reacts: happy on a save, gasp on a crack, cry on a break.
function drawHenAt(sim, k, t) {
  if (k < 20) return; // too small to read
  // on a phone the vault leaves k ~ 35 px/m: draw her at least ~50 px tall so she is visible, and step her out from the nest
  const n = sim.nest.getPosition();
  const seat = sim.water ? boatSeat(sim, t) : null; // world 8: she rides in the boat
  // nest.reach: her spot is worked out at the basket's home and carried along with it (she holds it as it runs; the
  // ring clearance below would otherwise pin her in place while the basket ran off)
  const run = sim.reach && !seat ? n.x - sim.nestX0 : 0;
  if (run) HEN_N.x = sim.nestX0, HEN_N.y = n.y;
  const nh = run ? HEN_N : n;
  // v4: the mascot is as big as her patch allows (up to 66 px, was 52): she steps out from the nest until her comb and
  // brow clear the outermost ring, and takes the largest size that keeps her within ~1 m of where she used to stand
  let s = Math.max(0.95, Math.min(52, k * 1.5) / k), hx = seat ? seat.x : nh.x + sim.nestW / 2 + 0.6 + (s - 0.95) / 2;
  if (seat) s = Math.max(s, Math.min(60, k * 1.7) / k);
  else for (const px of (G.henPx && G.henPx.run === G.run ? [G.henPx.px] : [66, 63, 60, 57, 54])) {
    // the size is picked ONCE per run: re-picking it every frame made her shrink and grow as a moving nest (Daily) changed what fit
    const c = Math.max(0.95, Math.min(px, k * 1.9) / k), base = nh.x + sim.nestW / 2 + 0.6 + (c - 0.95) / 2, R = sim.outerR + 0.1;
    let x = base;
    for (const [ox, oy] of [[0.32, 0.97], [0.46, 0.85]]) { const y = sim.groundY + oy * c * (sim.gy || 1), d = R * R - y * y; if (d > 0) x = Math.max(x, Math.sqrt(d) + ox * c - nh.x * 0); }
    const last = G.henPx && G.henPx.run === G.run; // a locked size is used as it is; x still follows the ring
    if (last || (x - base <= 1.1 && x + 0.45 * c <= sim.outerR + 0.5)) { s = c; hx = x; if (!last && k > 25) G.henPx = { run: G.run, px }; break; }
  }
  hx += run;
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
    // nest.reach: she holds the basket and runs it under an egg: hand her its speed, its acceleration and where its rim is
    let carry = null;
    if (sim.reach && !seat) {
      const v = sim.nest.getLinearVelocity().x, a = hp && dtr > 0 && dtr < 0.2 && hp.run === G.run ? (v - (hp.v || 0)) / dtr : 0, C = G.henCarry || (G.henCarry = { v: 0, a: 0, rx: 0, ry: 0 });
      C.v = v; C.a = clamp(a, -60, 60); C.rx = ((n.x + sim.nestW / 2 + 0.1 - hx) * k * 100) / hs; C.ry = 49 - ((sim.nestY + 0.5 - sim.groundY) * k * 100) / hs;
      carry = C;
      // dust at her feet and straw off the basket's trailing edge while she sprints (a few bits, not every frame)
      if (Math.abs(v) > 2.2 && G.screen === 'play' && !save.calm && t - (G.henDustT || 0) > 0.07) {
        G.henDustT = t; const dir = Math.sign(v);
        G.fx.dust(hx - dir * 0.15, sim.groundY + 0.04, 2, 'rgba(214,190,150,0.75)');
        G.fx.add({ x: n.x - dir * (sim.nestW / 2 + 0.05), y: sim.nestY + 0.45, vx: -dir * (1 + Math.random() * 1.5), vy: 0.8 + Math.random() * 1.4, g: 9.5, drag: 0.8, life: 0.7, size: 0.05 + Math.random() * 0.03, color: G.theme?.palette?.nestStraw || '#d9b45a', type: 'chip', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 16, floor: sim.groundY + 0.02 });
      }
    }
    G.henPrev = { x: hx, t, run: G.run, v: carry ? carry.v : 0 };
    drawHenActor(ctx, G.hen.mood, 0, -0.49 * hs, hs, t, { key: 'level', n: G.hen.n, look: G.screen === 'play' && !carry ? look : carry ? undefined : 0, danger: G.danger, shadow: 0.26, drift, carry });
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
  const alb = c.album && /^combo_/.test(c.id) ? 22 * u : 0; // 0.8.17: a combo's first time: "Added to your album"
  const h = Math.max(icon + 8 * u, 16 * u + 24 * u + lines.length * lineS * 1.25 + 10 * u + alb);
  ctx.save();
  ctx.globalAlpha = a; ui.aBase = a;
  const k = ui.pop(c.t, 0.22);
  if (k !== 1) { ctx.translate(A.cx, y + h / 2); ctx.scale(k, k); ctx.translate(-A.cx, -(y + h / 2)); }
  ui.glass(x, y, w, h, { r: 16 * u, border: info.color, lw: 2.5 * u, a: 'rgba(58,36,20,0.95)', b: 'rgba(26,15,8,0.95)', record: true, tag: 'card', group: 'card' });
  drawPowerCard(ctx, c.id, x + 6 * u, y, icon * 2, h, G.t, ui);
  const tx = x + icon + 16 * u;
  ui.text(info.name, tx, y + 10 * u + 12 * u, { size: 22 * u, color: info.color, stroke: 'rgba(0,0,0,0.6)', maxW: w - icon - 26 * u, tag: 'card:name', group: 'card' });
  lines.forEach((l, i) => ui.text(l, tx, y + 40 * u + lineS * 1.25 * (i + 0.5), { size: lineS, color: '#fff', maxW: w - icon - 26 * u, tag: 'card:l' + i, group: 'card' }));
  if (alb) { // the album's picture and the line, in the card's gold (it fades in a beat after the card)
    const ay = y + 40 * u + lineS * 1.25 * lines.length + 3 * u + 9 * u, k = save.calm ? 1 : clamp((c.t - 0.35) / 0.3, 0, 1);
    ctx.save(); ctx.globalAlpha *= k; albumIcon(ctx, tx + 9 * u, ay, 20 * u, 0);
    ui.text('Added to your album', tx + 24 * u, ay + 0.5 * u, { size: 13.5 * u, color: '#ffd23f', maxW: w - icon - 50 * u, tag: 'card:album', group: 'card' }); ctx.restore();
  }
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
  if (G.li >= 0 && G.li < 4 && G.level && G.level.id < 5) return false; // the first-five ladder: Papa Rooster arrives with the L5 boss
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
function allyTicket(x, y, bs, tk) {
  const u = ui.u, tw2 = 30 * u, th2 = 17 * u, tx2 = x + bs - tw2 + 6 * u, ty2 = y + bs - th2 + 2 * u;
  ui.roundRect(tx2, ty2, tw2, th2, 4 * u); ctx.fillStyle = '#e0412d'; ctx.fill(); ctx.lineWidth = 1.5 * u; ctx.strokeStyle = '#5a110a'; ctx.stroke();
  ui.text('x' + Math.min(tk, 99), tx2 + tw2 / 2, ty2 + th2 / 2 + 0.5 * u, { size: 12 * u, align: 'center', color: '#fff', maxW: tw2 - 4 * u, noRecord: true });
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
  const tk = save.wallet.tickets.ally;
  const coach = !!(can && !G.allyOpen && !(save.seen && save.seen.rooster) && G.li >= 0);
  // 0.8.15 speed: the button and its badge stand still (hudLayer) unless it is pressed, coached or open
  const still = !btnLive('ally') && !coach && !G.allyOpen;
  const face = () => {
    ui.button('ally', '', x, y, bs, bs, { kind: 'gold', icon: allyIcon, iconS: 1.45, disabled: !can, round: 15 * u });
    if (!still) return;
    if (!free && can && tk > 0) allyTicket(x, y, bs, tk); else if (!free && can) drawAdBadge(ctx, x + bs - 21 * u, y + bs - 15 * u, 22 * u, 16 * u);
  };
  G.roosterCoach = coach;
  if (still) { hudLayer('ally', W_ + ',' + H_ + '|' + (can ? 1 : 0) + (free ? 1 : 0) + '|' + Math.min(tk || 0, 99) + '|' + G.henSkinCur + '|' + (save.calm ? 1 : 0), x - 3 * u, y - 3 * u, bs + 12 * u, bs + 9 * u, face); return; }
  face();
  // 2026-11-20 (mykee: "we did not show the user how to use Papa Rooster"): the first time he can help, a hand taps his
  // button and a bubble says what he does; that first call is free
  if (G.roosterCoach) {
    const msg = 'Tap Papa Rooster: he chases thieves away!', ts = 15 * u, tw = Math.min(ui.A.w - 24 * u, ui.measure(msg, ts) + 28 * u), th2 = 34 * u;
    const bx = clamp(x + bs / 2 - tw * 0.25, ui.A.x + 10 * u, ui.A.x1 - tw - 10 * u), by = y - th2 - 26 * u;
    ui.roundRect(bx, by, tw, th2, th2 / 2); ctx.fillStyle = '#fff8e6'; ctx.fill(); ctx.lineWidth = 2.5 * u; ctx.strokeStyle = '#c9342c'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + bs / 2 - 8 * u, by + th2); ctx.lineTo(x + bs / 2, by + th2 + 10 * u); ctx.lineTo(x + bs / 2 + 8 * u, by + th2); ctx.closePath(); ctx.fillStyle = '#fff8e6'; ctx.fill();
    ui.text(msg, bx + tw / 2, by + th2 / 2 + 0.5 * u, { size: ts, align: 'center', color: '#7a1f12', maxW: tw - 16 * u, tag: 'coach:rooster' });
    const ph = (G.t * 1.1) % 1, press = ph > 0.35 && ph < 0.6;
    if (!save.calm) teachHand(ctx, x + bs * 0.62, y + bs * (press ? 0.3 : 0.42), bs * 0.8, press, 1);
  }
  if (!free && can && tk > 0) allyTicket(x, y, bs, tk); // "Use ticket (N)": a red ticket stub with the count instead of the ad badge
  else if (!free && can && !G.roosterCoach) drawAdBadge(ctx, x + bs - 21 * u, y + bs - 15 * u, 22 * u, 16 * u);
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
// ---- HUD layers (0.8.15 speed pass). A budget phone (vivo I2409, Dimensity 6300) ran every level at 15 to 27 fps with
// 12 to 45 ms of script work a frame, and shrinking the canvas changed nothing: the time goes into the drawing calls
// themselves, not the pixels. The HUD was a sixth of them (glass chips, stroked text, gradients, buttons), repainted 60
// times a second while it changes a few times a level. Now the parts that stand still are painted once onto their own
// small canvas and copied with one drawImage until something they show changes (the key); what moves every frame (the
// clock's hand, a score that is popping, a pressed button, the boss bar) is still drawn live over the copy.
//   hudLayer(slot, key, x, y, w, h, paint) -> what paint returned when the layer was last painted (its layout)
// paint draws with the usual ctx / ui (both point at the layer's canvas while it runs); the rects and buttons it
// records are replayed on every frame the copy is used, so taps and the overlap check see the same thing.
const HL = new Map();
const HUD_CACHE = { on: true, builds: 0 };
// A layer is at most this many pixels. Measured in headless Chromium: copying a 768x246 layer (High at 2x) made the
// browser flush the frame's drawing right there, in the middle of the frame, while 576x185 (1.5x) did not. The phones
// this pass is for run Low and Medium, where the layers are far smaller; a bigger HUD is drawn live as before.
const HL_MAX_PX = 120000;
function hudLayer(slot, key, x, y, w, h, paint) {
  const m = HUD_CACHE.on && ctx === ui.ctx && ctx.getTransform ? ctx.getTransform() : null;
  if (!m || Math.abs(m.a - DPR) > 1e-5 || Math.abs(m.d - DPR) > 1e-5 || m.b || m.c || m.e || m.f || ctx.globalAlpha !== 1) return paint(); // not the plain screen transform: draw as before
  const x0 = Math.max(0, Math.floor(x * DPR)), y0 = Math.max(0, Math.floor(y * DPR));
  const pw = Math.min(canvas.width, Math.ceil((x + w) * DPR)) - x0, ph = Math.min(canvas.height, Math.ceil((y + h) * DPR)) - y0;
  if (!(pw > 0 && ph > 0) || pw * ph > HL_MAX_PX) return paint();
  let L = HL.get(slot);
  if (!L || L.key !== key || L.x0 !== x0 || L.y0 !== y0 || L.pw !== pw || L.ph !== ph || L.dpr !== DPR) {
    const cv = (L && L.cv) || document.createElement('canvas');
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
    const c = cv.getContext('2d');
    if (!c) return paint();
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, pw, ph);
    c.setTransform(DPR, 0, 0, DPR, -x0, -y0);
    const main = ctx, r0 = ui.rects.length, b0 = ui.buttons.length;
    let ret;
    leakState(main, c);
    ctx = c; ui.ctx = c;
    try { ret = paint(); } finally { ctx = main; ui.ctx = main; }
    L = { cv, key, x0, y0, pw, ph, dpr: DPR, ret, rects: ui.rects.slice(r0), buttons: ui.buttons.slice(b0), left: { lineJoin: c.lineJoin, lineCap: c.lineCap, lineWidth: c.lineWidth, miterLimit: c.miterLimit, textAlign: c.textAlign, textBaseline: c.textBaseline, fillStyle: c.fillStyle, strokeStyle: c.strokeStyle, font: c.font } };
    HL.set(slot, L);
    HUD_CACHE.builds++;
  } else {
    for (let i = 0; i < L.rects.length; i++) ui.rects.push(L.rects[i]);
    for (let i = 0; i < L.buttons.length; i++) ui.buttons.push(L.buttons[i]);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(L.cv, x0, y0);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  leakState(L.left, ctx);
  return L.ret;
}
// Drawing code all over the game leans on what earlier code left set on the context (ui.text leaves round line joins,
// and the ring arrows are drawn with them): a layer's paint must leave the screen's context as painting there would
function leakState(from, to) {
  to.lineJoin = from.lineJoin; to.lineCap = from.lineCap; to.lineWidth = from.lineWidth; to.miterLimit = from.miterLimit;
  to.textAlign = from.textAlign; to.textBaseline = from.textBaseline;
  to.fillStyle = from.fillStyle; to.strokeStyle = from.strokeStyle;
  if (to.font !== from.font) to.font = from.font;
}
// the layers give their pixels back when play is left (render/cvfree.js: a dropped canvas keeps its memory for a while)
function hudLayersFree() { for (const L of HL.values()) freeCanvas(L.cv); HL.clear(); }
const btnLive = (id) => ui.pressedId === id || !!ui.spring[id]; // a button that is pressed or still springing back is drawn live

function drawHUD() {
  if (G.sideHud) { if (G.screen === 'win' || G.screen === 'fail') return; return drawSideHUD(); } // the result card and the hen take the stage
  const u = ui.u, sim = G.sim, A = ui.A;
  ui.calm = save.calm;
  const st = sim.stats();
  if (HUDS.lv !== G.run) { HUDS.lv = G.run; HUDS.score = st.score; HUDS.bump = 0; }
  if (st.score !== HUDS.score) { HUDS.bump = st.score > HUDS.score ? 1 : 0; HUDS.score = st.score; }
  HUDS.bump *= 0.88;
  // what moves this frame is left out of the still layer and drawn live over it
  const P = eggPerk(), perkAge = G.t - (G.perkT ?? -9);
  const V = { st, pause: btnLive('pause'), bump: HUDS.bump > 0.02 && !save.calm, perk: !!P && perkAge < 0.9 };
  let tray = '';
  for (const e of sim.eggs) tray += e.fled ? 'f' : e.saved ? 's' : e.alive ? 'a' + e.cracks : 'b' + e.cracks;
  const timeTxt = sim.timeLimit ? fmtTime(sim.timeLeft) : '';
  const key = G.run + '|' + G.li + '|' + G.level.id + '|' + A.x + ',' + A.y + ',' + A.w + ',' + A.h + ',' + W_ + ',' + G.hudBottom + ',' + G.bossBar + '|' + G.henSkinCur + '|' + (save.calm ? 1 : 0) + (V.pause ? 1 : 0) + (V.bump ? 1 : 0) + (V.perk ? 1 : 0) + (settingsMarkOn() ? 1 : 0)
    + '|' + (P ? P.icon : '') + '|' + st.score + '|' + tray + '|' + st.saved + '/' + hudNeed(st) + '|' + (G.goalOk ? G.goalOk.join() : '') + '|' + timeTxt.length + '|' + (sim.bx && sim.bx.boss ? 1 : 0);
  const Y = hudLayer('top', key, 0, 0, W_, G.hudBottom + 20 * u, () => hudStill(V, timeTxt));
  // ---- live: what the layer left out
  const row1 = Y.row1;
  if (V.pause) { ui.button('pause', '', Y.X0, Y.Y0, Y.bs, Y.bs, { kind: 'hud', icon: ICON.pause, iconS: 1.25, round: 15 * u }); setMarkAt(Y.X0, Y.Y0, Y.bs, Y.bs, true); }
  if (V.bump && !Y.noScore) {
    ctx.save();
    { const k = 1 + 0.22 * HUDS.bump; ctx.translate(Y.sx, Y.sy); ctx.scale(k, k); ctx.translate(-Y.sx, -Y.sy); }
    ui.num(String(st.score), Y.sx, Y.sy, { size: Y.sS, align: Y.stk ? 'center' : 'right', tag: 'hud:score' });
    ctx.restore();
  }
  // stall watch: Finish (enough eggs home) or Retry (stuck), centred under the HUD
  if (G.screen === 'play' && sim.state === 'play' && G.stall && G.stall.run === G.run) {
    const enough = sim.savedLog.length >= (G.level.target || 1);
    if ((enough && G.stall.t >= 5) || (!enough && G.stall.t >= 22)) {
      const fw = Math.min(220 * u, A.w - 2 * Y.pad), fh = 44 * u, fx = A.cx - fw / 2, fy = G.hudBottom + 10 * u;
      const k = save.calm ? 1 : 1 + 0.03 * Math.sin(G.t * 4);
      ctx.save(); ctx.translate(A.cx, fy + fh / 2); ctx.scale(k, k); ctx.translate(-A.cx, -(fy + fh / 2));
      if (enough) ui.button('finish', 'Finish level', fx, fy, fw, fh, { kind: 'primary', shimmer: true, icon: ICON.check, size: 18 * u });
      else ui.button('retry', 'Stuck? Retry', fx, fy, fw, fh, { kind: 'secondary', icon: ICON.retry, size: 17 * u });
      ctx.restore();
    }
  }
  if (V.perk) perkChipHud(Y.X0 + Y.bs + 8 * u, row1 - 15 * u, u); // the equipped egg's power, while it pulses
  if (Y.clk) { // the clock in the title pill: the clock face, the time (red and pulsing in the last 10 s)
    const low = sim.timeLeft <= 10, cx0 = Y.cx0, clk = Y.clk;
    ctx.save();
    fuseSlot(cx0 + clk / 2, row1);
    if (low && !save.calm) { const k = 1 + 0.06 * Math.sin(G.t * 12), cc = cx0 + clk / 2; ctx.translate(cc, row1); ctx.scale(k, k); ctx.translate(-cc, -row1); }
    hudClock(cx0 + 8 * u + 11 * u, row1 + 1 * u, 10 * u, low, sim.timeLeft / sim.timeLimit);
    ui.record({ x: cx0 + 8 * u, y: row1 - 11 * u, w: 22 * u, h: 22 * u }, 'hud:clock', 'hud:time');
    ui.text(timeTxt, cx0 + 8 * u + 22 * u + 5 * u, row1 + 0.5 * u, { size: Y.timeS * 0.9, color: low ? '#ff9a7a' : '#fff', stroke: 'rgba(30,14,4,0.75)', strokeW: 3.2 * u, tag: 'hud:time', group: 'hud:time' });
    ctx.restore();
  }
  if (timeTxt && !Y.twoRows) {
    const tx = Y.trayX + Y.trayPillW + 8 * u, trayY = Y.trayY, timePillW = Y.timePillW, pillH = Y.pillH;
    const low = sim.timeLeft <= 10;
    ctx.save();
    fuseSlot(tx + timePillW / 2, trayY);
    if (low && !save.calm) { const k = 1 + 0.05 * Math.sin(G.t * 12), cx = tx + timePillW / 2; ctx.translate(cx, trayY); ctx.scale(k, k); ctx.translate(-cx, -trayY); }
    ui.glass(tx, trayY - pillH / 2, timePillW, pillH, low ? { a: 'rgba(196,52,30,0.95)', b: 'rgba(120,22,10,0.95)', border: 'rgba(255,190,160,0.8)' } : {});
    hudClock(tx + 8 * u + 11 * u, trayY + 1 * u, 10 * u, low, sim.timeLeft / sim.timeLimit);
    ui.record({ x: tx + 8 * u, y: trayY - 11 * u, w: 22 * u, h: 22 * u }, 'hud:clock', 'hud:time');
    ui.text(timeTxt, tx + 8 * u + 22 * u + 5 * u, trayY + 0.5 * u, { size: Y.timeS, color: low ? '#fff2c0' : '#fff', stroke: 'rgba(30,14,4,0.75)', strokeW: 3.2 * u, tag: 'hud:time', group: 'hud:time' });
    ctx.restore();
  }
  G.infoLow = 0;
  if (G.bossBar && sim.bx && sim.bx.boss) drawBossBar(ctx, ui, sim, Y.bossX, Y.bossY, Y.bossW, Y.bossH, G.t); // (its iron housing is in the layer)
  if (G.screen === 'play' && sim.state === 'play') { if (zoomWanted()) drawZoomBtns(); drawAllyBtn(); drawStrikeBtn(); drawBankBtn(); }
}
// the HUD's still parts (the scrim, pause, the score chip, the level pill, the egg tray, the boss bar's housing), and
// the layout the live parts are placed by. V: what is drawn live this frame instead (see drawHUD).
function hudStill(V, timeTxt) {
  const u = ui.u;
  const sim = G.sim;
  const pal = G.theme.palette;
  const A = ui.A, twoRows = A.w < 760 || A.h > A.w * 1.05;
  const pad = 12 * u, X0 = A.x + pad, Y0 = A.y + pad; // the HUD lives in the safe rect (the scrim still paints edge to edge)
  const bs = 46 * u;
  // scrim: the world's plate tint, fading out under the HUD
  const plate = /^rgba\(/.test(pal.plate || '') ? pal.plate : 'rgba(20,14,10,0.55)';
  const al = (a) => plate.replace(/[\d.]+\)$/, a + ')');
  const g = ctx.createLinearGradient(0, A.y * 0.5, 0, G.hudBottom + 12 * u);
  g.addColorStop(0, al(0.82)); g.addColorStop(0.7, al(0.5)); g.addColorStop(1, al(0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W_, G.hudBottom + 12 * u);
  const row1 = Y0 + bs / 2;
  if (!V.pause) {
    ui.button('pause', '', X0, Y0, bs, bs, { kind: 'hud', icon: ICON.pause, iconS: 1.25, round: 15 * u });
    setMarkAt(X0, Y0, bs, bs, true); // 0.8.14: Settings lives behind pause until it was opened once (a still badge: never a blink during play)
  }
  // score chip (right)
  const st = V.st;
  const scoreTxt = String(st.score);
  const scoreSize = 24 * u, lblS = 11 * u;
  const scoreW = Math.max(ui.measure(scoreTxt, scoreSize), ui.measure('000', scoreSize));
  const lblW = ui.measure('SCORE', lblS);
  // two rows (phones): the label sits over the number, so the chip is narrow and the title pill keeps room for the clock
  const stk = twoRows, sS = stk ? 19 * u : scoreSize, sW = stk ? Math.max(ui.measure(scoreTxt, sS), ui.measure('000', sS)) : scoreW;
  // level 1 shows only what matters (2026-11-20 first-five ladder): the eggs and pause, no score
  const noScore = G.li === 0 && G.level.id === 1;
  const chipH = stk ? 44 * u : 36 * u, chipW = noScore ? -8 * u : stk ? Math.max(ui.measure('SCORE', 9.5 * u), sW) + 24 * u : 13 * u + lblW + 7 * u + scoreW + 14 * u, chipX = A.x1 - pad - chipW;
  const sx = stk ? chipX + chipW / 2 : A.x1 - pad - 14 * u, sy = stk ? row1 + 6 * u : row1;
  if (!noScore) {
  ui.glass(chipX, row1 - chipH / 2, chipW, chipH);
  ui.text('SCORE', stk ? chipX + chipW / 2 : chipX + 13 * u, stk ? row1 - 10 * u : row1 + 1 * u, { size: stk ? 9.5 * u : lblS, align: stk ? 'center' : 'left', color: 'rgba(255,232,196,0.85)', tag: 'hud:scoreLabel' });
  if (!V.bump) ui.num(scoreTxt, sx, sy, { size: sS, align: stk ? 'center' : 'right', tag: 'hud:score' });
  }
  let leftEdge = X0 + bs + 8 * u;
  { const pw = V.perk ? 34 * u : perkChipHud(leftEdge, row1 - 15 * u, u); if (pw) leftEdge += pw + 8 * u; } // the equipped egg's power
  const rightEdge = chipX - 8 * u;
  // tray + timer content
  const slots = Math.max(G.level.eggs, sim.eggs.length);
  const icon = 26 * u * Math.min(1, 4.5 / slots);
  const traySpace = icon * 0.9;
  const states = [];
  for (const e of sim.eggs) if (!e.fled) states.push(e.saved ? 'saved' : e.alive ? 'alive' : 'broken'); // a fled chick leaves the tray
  while (states.length < slots) states.push('empty');
  const trayW = slots * traySpace;
  const needN = hudNeed(st), met = st.saved >= needN;
  const needTxt = `${st.saved}/${needN}`, needS = 18 * u;
  const needW = ui.measure(needTxt.replace(/\d/g, '0'), needS);
  const pillH = 34 * u;
  const starW = G.li === -1 ? 0 : TRAY_STARS(u);
  const trayPillW = 10 * u + trayW + 9 * u + needW + 13 * u + starW;
  const timeS = 21 * u;
  const timeW = timeTxt ? ui.measure(timeTxt.replace(/\d/g, '0'), timeS) : 0;
  const timePillW = timeTxt ? 8 * u + 22 * u + 5 * u + timeW + 13 * u : 0;
  const groupW = trayPillW + (timeTxt && !twoRows ? 8 * u + timePillW : 0); // two rows: the clock rides in the title pill
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
  let cx0 = 0;
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
    if (clk) { // the clock in the title pill: a rule here, the clock face and the time live (drawHUD)
      cx0 = tx + nw + 8 * u;
      ctx.fillStyle = 'rgba(255,232,196,0.3)'; ctx.fillRect(cx0, row1 - pillH * 0.28, 1.5 * u, pillH * 0.56);
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
  const Y = { X0, Y0, bs, pad, row1, twoRows, noScore, sx, sy, sS, stk, clk, cx0, timeS, trayX, trayY, trayPillW, timePillW, pillH, bossX: 0, bossY: 0, bossW: 0, bossH: 0 };
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
    Y.bossX = bx; Y.bossY = by; Y.bossW = bw; Y.bossH = bh;
  }
  return Y;
}

// the egg count the HUD pill counts toward: level 1 wins with one egg but its stars count all of them (1, 2, all 3 home)
function hudNeed(st) { return G.li === 0 && G.level && G.level.id === 1 ? st.total : st.target; }
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
  setMarkAt(X0, y, bs, bs, true); // 0.8.14: the Settings mark (see the portrait HUD)
  // (the "i" button moved into the pause page, 2026-11-19)
  perkChipHud(X0 + bs + gap, Y0 + (bs - 30 * u) / 2, u); // the equipped egg's power
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
  const st = sim.stats(), needN = hudNeed(st), met = st.saved >= needN;
  const slots = Math.max(G.level.eggs, sim.eggs.length), states = [];
  for (const e of sim.eggs) if (!e.fled) states.push(e.saved ? 'saved' : e.alive ? 'alive' : 'broken');
  while (states.length < slots) states.push('empty');
  const needTxt = `${st.saved}/${needN}`, needS = 18 * u, needW = ui.measure(needTxt.replace(/\d/g, '0'), needS);
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
    fuseSlot(X0 + tw / 2, cy);
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
    if (sx + sw <= X0 + cw + 4 * u && !(G.li === 0 && G.level.id === 1)) { // level 1: no score (the first-five ladder)
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
  if (G.screen === 'play' && sim.state === 'play') { if (zoomWanted()) drawZoomBtns(); drawAllyBtn(); drawStrikeBtn(); drawBankBtn(); }
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
// levels 1-2 (2026-11-20 first-five ladder): no zoom buttons while the whole vault shows its eggs at a good size (an
// egg at least ~30 px across); a player zoom already set keeps them, so it can be undone
function zoomWanted() {
  if (!(G.li >= 0 && G.li <= 1 && G.level && G.level.id <= 2) || G.zm != null) return true;
  const F = G.cv && G.cv.F;
  return !F || F.k * 0.56 < 30 * ui.u;
}
function drawZoomBtns() {
  const { bs, pad, side } = G.zb, P = G.play, u = ui.u, gap = 8 * u;
  const items = [['zoom:in', ICON.zoom(true), ''], ['zoom:out', ICON.zoom(false), '']];
  if (G.zm != null) items.push(['zoom:auto', null, 'auto']);
  const at = (i) => {
    const x = side ? ui.A.x1 - pad - bs : ui.A.x1 - pad - bs * (i + 1) - gap * i;
    // landscape: centred in the right column, but never up on the Chick Strike button at its top
    const y = side ? Math.max(P.y + (P.h - (bs * 3 + gap * 2)) / 2, strikeShown() ? P.y + bs + gap * 2 : 0) + (bs + gap) * i : G.zb.bot;
    return [x, y];
  };
  const paint = () => items.forEach(([id, icon, label], i) => {
    const [x, y] = at(i);
    ui.button(id, label, x, y, bs, bs, { kind: 'hud', icon, iconS: 1.3, size: label ? 13 * u : undefined, round: 15 * u });
  });
  if (items.some(([id]) => btnLive(id))) return paint(); // a pressed button squashes: drawn live
  // 0.8.15 speed: the buttons stand still, so they are one picture (hudLayer) until one is pressed or the layout moves
  const [xa, ya] = at(0), [xb, yb] = at(items.length - 1), x0 = Math.min(xa, xb) - 3 * u, y0 = Math.min(ya, yb) - 3 * u;
  hudLayer('zoom', items.length + '|' + W_ + ',' + H_ + '|' + G.henSkinCur + '|' + (save.calm ? 1 : 0), x0, y0, Math.max(xa, xb) + bs + 3 * u - x0, Math.max(ya, yb) + bs + 6 * u - y0, paint);
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
    let down = p.down; // (under the sea the score stacks downward, under the boat: upward it covered the hen)
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

// "Skip videos for good": a small chip at the foot of the screen for 5 s after the day's 3rd+ video. Not a popup: it takes the
// lowest free spot that touches nothing recorded (so never the reward, NEXT or a card), and not at all in play or over a sheet.
const CHIP_LIFE = 5;
function drawSkipChip() {
  const K = G.skipChip;
  if (!K) return;
  const age = G.t - K.t0;
  if (age > CHIP_LIFE || G.screen === 'play' || ads.premium) { G.skipChip = null; return; }
  if (modalOpen() || G.settingsOpen || G.adBusy || G.screen === 'wonder' || (G.screen === 'store' && G.detail)) return;
  const u = ui.u, A = ui.A, size = 15.5 * u, label = 'Skip videos for good', h = 38 * u, ic = 26 * u;
  const w = Math.min(A.w - 24 * u, ui.measure(label, size) + ic + 40 * u), x = A.cx - w / 2;
  let y = null;
  for (let yy = A.y1 - h - 10 * u; yy > A.y1 - 190 * u; yy -= 6 * u) { // up from the bottom edge until nothing recorded is under it
    if (!ui.rects.some((r) => x < r.x + r.w + 4 * u && x + w > r.x - 4 * u && yy < r.y + r.h + 4 * u && yy + h > r.y - 4 * u)) { y = yy; break; }
  }
  if (y == null) { K.made = K.made == null ? G.t : K.made; if (G.t - K.made > 45) G.skipChip = null; else K.t0 = G.t; return; } // no free spot on this screen: it waits for the next one (at most 45 s), its 5 s start when it shows
  const a = Math.min(1, age * 4, (CHIP_LIFE - age) * 3);
  ctx.save(); ctx.globalAlpha = a; ui.aBase = a;
  ui.glass(x, y, w, h, { r: h / 2, a: 'rgba(58,36,20,0.94)', b: 'rgba(28,16,8,0.94)', border: 'rgba(255,224,160,0.6)', record: true, tag: 'chip:skip', group: 'chip:skip' });
  pictoNoVideo(ctx, x + 12 * u + ic / 2, y + h / 2, ic);
  ui.text(label, x + 12 * u + ic + 6 * u, y + h / 2, { size, color: '#fff8e8', maxW: w - ic - 30 * u, group: 'chip:skip', tag: 'chip:skip:l' });
  ui.aBase = 1; ctx.restore();
  ui.buttons.push({ id: 'chip:skip', x, y: y - 4 * u, w, h: h + 8 * u });
  if (DEV || G.checkOverlaps) G.overlaps = ui.overlaps();
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
// 2026-11-20 first-five ladder: until the level is first won it stays up until the player has turned a ring once; after
// that it comes back, on the ring under the egg furthest along, whenever the player stalls for 4 s (G.teach).
// ---------------------------------------------------------------- the fuse intro (2026-11-20, owner: "they did not even
// realize that there was a timer"; then, on seeing the first version: "for the first time we could show the timer and
// then it animates and goes to the top section of the page and then simply show that the fuse starts. That's it").
// The first fuse level of a save (level 2 in the ladder) opens with it, once:
//   0.00-1.15  the timer, big, in the middle of the screen, with two big words
//   1.15-1.75  it flies to its place in the top bar and lands with a bounce
//   1.95-3.50  a match strike lights the fuse at the top of the vault, the rope is picked out, big words; then play
// The world does not step until it ends (update), a tap skips to the end, calm: two stills.
// Then, on the first three fuse levels, the HUD timer pulses with a flare of the spark at half time and at 10 s left.
const FI_D = 3.5, FI_CALM = 2.4, FI_FLY = 1.15, FI_LAND = 1.75, FI_STRIKE = 1.95;
function fuseIntroOn() { return !!(G.fi && G.fi.run === G.run); }
function fuseIntroTick(dt, sim) {
  if (G.screen !== 'play') return;
  if (!G.fi && G.li >= 0 && sim.timeLimit && sim.state === 'play' && sim.t === 0 && !G.demo && !save.seen.fuseIntro) {
    G.fi = { run: G.run, t: 0, calm: !!save.calm, ticked: 0, home: false };
    save.seen.fuseIntro = 1; persist();
  }
  if (sim.timeLimit && sim.t === 0 && G.li >= 0 && G.fuseLv !== G.run) { // the first three fuse levels get the pulses
    G.fuseLv = G.run;
    const id = G.level.id;
    if (id > (save.seen.fuseMax || 0)) { save.seen.fuseMax = id; save.seen.fuseN = (save.seen.fuseN || 0) + 1; persist(); }
    G.fuseHint = (save.seen.fuseN || 0) <= 3 && id <= (save.seen.fuseMax || 0) ? { run: G.run, half: false, ten: false } : null;
  }
  if (fuseIntroOn()) {
    const F = G.fi, D = F.calm ? FI_CALM : FI_D;
    F.t = DEV && G.fiHold != null ? G.fiHold : F.t + dt; // (dev: strips hold a moment)
    if (!F.calm) {
      if (!F.pop) { F.pop = true; audio.play('hud_pop'); }
      if (F.t >= FI_LAND - 0.05 && !F.home) { F.home = true; audio.play('countdown', { pitch: 1.3 }); }
      if (F.t >= FI_STRIKE && !F.lit) { F.lit = true; G.fuseHandle = audio.play('bomb_fuse'); }
    }
    if (F.t >= D) { G.fi = null; stopFuse(); }
    return;
  }
  const H = G.fuseHint;
  if (H && H.run === G.run && sim.state === 'play' && sim.timeLimit) {
    if (!H.half && sim.timeLeft <= sim.timeLimit / 2) { H.half = true; G.fp = { run: G.run, t0: G.t }; }
    if (!H.ten && sim.timeLeft <= 10 && sim.timeLimit > 14) { H.ten = true; G.fp = { run: G.run, t0: G.t }; }
  }
}
function fuseIntroSkip() { const F = G.fi; if (!fuseIntroOn()) return false; const D = F.calm ? FI_CALM : FI_D; if (F.t < D - 0.3) F.t = D - 0.3; return true; }
function fuseShown(sim) { return fuseIntroOn() ? sim.timeLimit : sim.timeLeft; } // the intro shows the whole time: nothing has burnt yet
function ease01(k) { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); }
const fpK = () => (G.fp && G.fp.run === G.run && G.t - G.fp.t0 < 0.9 ? (G.t - G.fp.t0) / 0.9 : -1);
// the HUD timer's slot: where the intro flies from and back to; hidden while the big one is out, pulsing on a flare
function fuseSlot(cx, cy) {
  G.fiSlot = { x: cx, y: cy };
  if (fuseIntroOn()) { ctx.globalAlpha = 0; return; }
  const k = fpK();
  if (k >= 0 && !save.calm) { const s = 1 + 0.32 * Math.sin(Math.PI * k); ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy); }
}
// the timer pill as the HUD draws it (clock face + m:ss), centred at 0,0 in the current transform
function timerPill(secs, frac, u) {
  const timeTxt = fmtTime(secs), timeS = 21 * u, timeW = ui.measure(timeTxt.replace(/\d/g, '0'), timeS), w = 8 * u + 22 * u + 5 * u + timeW + 13 * u, h = 34 * u, x = -w / 2;
  ui.glass(x, -h / 2, w, h);
  hudClock(x + 8 * u + 11 * u, 1 * u, 10 * u, false, frac);
  ui.text(timeTxt, x + 8 * u + 22 * u + 5 * u, 0.5 * u, { size: timeS, color: '#fff', stroke: 'rgba(30,14,4,0.75)', strokeW: 3.2 * u, noRecord: true });
  return { w, h, clockX: x + 19 * u };
}
function fuseWords(lines, cx, y, maxW, size, a) {
  ctx.save(); ctx.globalAlpha *= a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  let sz = size;
  ctx.font = `700 ${Math.round(sz)}px ${FONT}`;
  const wid = Math.max(...lines.map((l) => ctx.measureText(l).width));
  if (wid > maxW) { sz *= maxW / wid; ctx.font = `700 ${Math.round(sz)}px ${FONT}`; }
  lines.forEach((l, i) => {
    const yy = y + i * sz * 1.08;
    ctx.lineWidth = sz * 0.22; ctx.strokeStyle = '#3a1606'; ctx.strokeText(l, cx, yy + sz * 0.06);
    ctx.fillStyle = i ? '#ffd34d' : '#fff'; ctx.fillText(l, cx, yy);
  });
  ctx.restore();
  return sz * 1.08 * lines.length;
}
function drawFuseIntro() {
  const sim = G.sim, u = ui.u, A = ui.A;
  const k = fpK();
  if (!fuseIntroOn()) { // the reinforcing flare: a burst of light on the spark while the HUD timer pulses
    if (k < 0 || !sim || !sim.timeLimit || sim.state !== 'play' || save.calm) return;
    const p = toScreen(W.FUSE_TIP.x, W.FUSE_TIP.y), a = Math.sin(Math.PI * k);
    ctx.save(); ctx.globalAlpha = 0.85 * a; ctx.fillStyle = '#ffe58a'; ctx.beginPath(); ctx.arc(p.x, p.y, (8 + 16 * a) * u, 0, 7); ctx.fill();
    ctx.globalAlpha = a; ctx.strokeStyle = '#fff6c8'; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.arc(p.x, p.y, (12 + 30 * k) * u, 0, 7); ctx.stroke(); ctx.restore();
    if (G.fiSlot) { ctx.save(); ctx.globalAlpha = 0.6 * a; ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 3 * u; ctx.setLineDash([3 * u, 7 * u]); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(G.fiSlot.x, G.fiSlot.y); ctx.stroke(); ctx.restore(); }
    return;
  }
  const F = G.fi, calm = F.calm, T = F.t, D = calm ? FI_CALM : FI_D, secs = sim.timeLimit;
  const slot = G.fiSlot || { x: A.cx, y: A.y + 40 * u };
  const big = { x: A.cx, y: A.y + A.h * 0.4 }, S = Math.min(3, (A.w * 0.72) / (100 * u), (A.h * 0.15) / (34 * u));
  const show = calm ? 1 : ease01(T / 0.25) * (1 - ease01((T - (D - 0.3)) / 0.3));
  const fly = calm ? (T < FI_CALM / 2 ? 0 : 1) : ease01((T - FI_FLY) / (FI_LAND - FI_FLY)); // 0 in the middle, 1 home in the top bar
  const lit = calm ? fly : ease01((T - FI_STRIKE) / 0.2);
  // a dim veil so the timer, the spark and the words read (one flat fill)
  ctx.save(); ctx.globalAlpha = 0.5 * show; ctx.fillStyle = '#0c0603'; ctx.fillRect(0, 0, W_, H_); ctx.restore();
  // the fuse starts: the rope is picked out from the spark round the vault, a match strike lights it
  if (lit > 0) {
    const p = toScreen(W.FUSE_TIP.x, W.FUSE_TIP.y), outer = sim.rings[sim.rings.length - 1];
    if (!(outer && outer.prof)) { // a round vault (a shaped one keeps the world's own rope)
      const c0 = toScreen(0, 0), R = (sim.outerR + 0.32) * G.cam.k, sweep = calm ? 1 : ease01((T - FI_STRIKE) / 0.7);
      ctx.save(); ctx.globalAlpha = 0.9 * show; ctx.lineCap = 'round'; ctx.strokeStyle = '#ffe9b0'; ctx.lineWidth = 4 * u;
      ctx.beginPath(); ctx.arc(c0.x, c0.y, R, -Math.PI / 2 - 6.2832 * sweep, -Math.PI / 2); ctx.stroke(); ctx.restore();
    }
    const fl = calm ? 0 : clamp(1 - (T - FI_STRIKE) / 0.45, 0, 1); // the strike flash
    ctx.save();
    ctx.globalAlpha = 0.5 * show * lit; ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(p.x, p.y, (18 + (calm ? 0 : 5 * Math.sin(G.t * 20))) * u, 0, 7); ctx.fill();
    ctx.globalAlpha = show * lit; ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.arc(p.x, p.y, 7 * u, 0, 7); ctx.fill();
    if (fl > 0) { ctx.globalAlpha = fl; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4 * u; ctx.lineCap = 'round'; for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283 + 0.3, r0 = 12 * u, r1 = (20 + 38 * (1 - fl)) * u; ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * r0, p.y + Math.sin(a) * r0); ctx.lineTo(p.x + Math.cos(a) * r1, p.y + Math.sin(a) * r1); ctx.stroke(); } }
    if (!calm) for (let i = 0; i < 2; i++) { const q = ((T - FI_STRIKE) * 0.9 + i * 0.5) % 1; ctx.globalAlpha = show * (1 - q) * 0.8; ctx.strokeStyle = '#ffe58a'; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.arc(p.x, p.y, (14 + 46 * q) * u, 0, 7); ctx.stroke(); } // rings off the spark: look here
    ctx.restore();
  }
  // the timer: big in the middle, then up to its place in the top bar, landing with a bounce; it nods when the fuse is lit
  const pop = calm ? 1 : 1 - Math.pow(1 - clamp(T / 0.32, 0, 1), 3) + 0.14 * Math.sin(clamp(T / 0.45, 0, 1) * Math.PI);
  const landK = calm ? 1 : clamp((T - FI_LAND) / 0.32, 0, 1), nodK = calm ? 1 : clamp((T - FI_STRIKE) / 0.4, 0, 1);
  const cx = big.x + (slot.x - big.x) * fly, cy = big.y + (slot.y - big.y) * fly;
  const sc = pop * (S + (1 - S) * fly) * (1 + 0.03 * Math.sin(G.t * 6) * (1 - fly)) + (T >= FI_LAND ? 0.3 * Math.sin(landK * Math.PI) * (1 - landK) + 0.22 * Math.sin(nodK * Math.PI) : 0);
  if (!calm && fly >= 1 && nodK < 1) { ctx.save(); ctx.globalAlpha = (1 - nodK) * show; ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.ellipse(cx, cy, (52 + 34 * nodK) * u, (20 + 22 * nodK) * u, 0, 0, 7); ctx.stroke(); ctx.restore(); }
  ctx.save(); ctx.globalAlpha = show < 1 && T > 1 ? 1 : Math.min(1, show * 1.6); ctx.translate(cx, cy); ctx.scale(sc, sc);
  timerPill(secs, 1, u);
  ctx.restore();
  // big words across the screen: the timer first, then the fuse
  const wy = big.y + 34 * u * S * 0.5 + 40 * u, size = Math.min(A.w * 0.15, 72 * u), maxW = A.w - 32 * u;
  const w1 = calm ? 1 - fly : ease01((T - 0.18) / 0.2) * (1 - ease01((T - (FI_FLY - 0.12)) / 0.2));
  const w2 = calm ? fly : ease01((T - FI_STRIKE) / 0.2) * (1 - ease01((T - (D - 0.4)) / 0.25));
  if (w1 > 0.01) { const s1 = 0.8 + 0.2 * w1; ctx.save(); ctx.translate(A.cx, wy); ctx.scale(s1, s1); ctx.translate(-A.cx, -wy); fuseWords(['YOUR TIME'], A.cx, wy, maxW, size, w1); ctx.restore(); }
  if (w2 > 0.01) { const y2 = big.y, s2 = 0.8 + 0.2 * w2; ctx.save(); ctx.translate(A.cx, y2); ctx.scale(s2, s2); ctx.translate(-A.cx, -y2); fuseWords(['THE FUSE', 'IS LIT!'], A.cx, y2, maxW, size, w2); ctx.restore(); }
  if (show > 0.5) { ctx.save(); ctx.globalAlpha = 0.7 * show; ctx.font = `600 ${Math.round(14 * u)}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText('Tap to skip', A.cx, A.y + A.h - 22 * u); ctx.restore(); }
}
function drawKeyHint() {
  const T = G.teach;
  if (G.sim.state !== 'play') return; // the level is decided: no drag hand over a vault that is bursting
  if (G.level.id !== 1 || G.held.size || (!T && G.sim.savedLog.length > 0)) return;
  const sim = G.sim, L = leadEgg(sim);
  if (!L) return;
  let r = sim.rings[0];
  if (T) {
    if (T.last == null) T.last = G.t;
    if (sim.turns !== T.turns || sim.rings.some((q) => q.held || q.keyHeld)) { T.turns = sim.turns; T.last = G.t; if (T.turns > 0) T.first = false; }
    if (!T.first) {
      if (G.t - T.last < 3 || sim.state !== 'play') return;
      if (L.ch >= sim.rings.length) return;
      r = sim.rings[L.ch];
    } else if (L.ch < sim.rings.length) r = sim.rings[L.ch];
  }
  // the lesson in one motion: a hand takes the ring where its gap is now and drags it along the ring until the gap sits
  // under the egg; the gap lights up there and the arrows say "down". Then it starts again.
  const u = ui.u, c = toScreen(0, 0), R = r.r * G.cam.k, E = toScreen(L.x, L.y), Gp = toScreen(L.gx, L.gy);
  const ea = Math.atan2(E.y - c.y, E.x - c.x), ga = Math.atan2(Gp.y - c.y, Gp.x - c.x);
  let d = ea - ga; d = Math.atan2(Math.sin(d), Math.cos(d));
  if (Math.abs(d) < 0.14) return; // the gap is already under the egg: nothing to teach
  const P = 3.4, q = save.calm ? 0.6 : (G.t % P) / P, mv = ease01((q - 0.14) / 0.5), end = ga + d;
  const ang = ga + d * mv, hx = c.x + Math.cos(ang) * R, hy = c.y + Math.sin(ang) * R;
  const show = save.calm ? 1 : ease01(q / 0.1) * (1 - ease01((q - 0.9) / 0.1)), land = save.calm ? 1 : ease01((q - 0.62) / 0.12) * (1 - ease01((q - 0.95) / 0.05));
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // the way: a dashed arc from the gap to the egg
  ctx.globalAlpha = show;
  for (const [lw, col] of [[6 * u, 'rgba(40,18,4,0.5)'], [3 * u, '#fff']]) {
    ctx.beginPath(); ctx.arc(c.x, c.y, R, Math.min(ga, end), Math.max(ga, end));
    ctx.strokeStyle = col; ctx.setLineDash([7 * u, 8 * u]); ctx.lineWidth = lw; ctx.stroke();
  }
  ctx.setLineDash([]);
  // the gap, lit under the egg, and two arrows down toward the next ring and the basket
  if (land > 0) {
    const gw = Math.max(0.22, (r.gaps[0] ? r.gaps[0].len / r.r : 0.5)) / 2, pulse = save.calm ? 1 : 0.75 + 0.25 * Math.sin(G.t * 7);
    ctx.globalAlpha = land * pulse;
    ctx.beginPath(); ctx.arc(c.x, c.y, R, end - gw, end + gw); ctx.strokeStyle = 'rgba(255,224,110,0.55)'; ctx.lineWidth = 15 * u; ctx.stroke();
    ctx.beginPath(); ctx.arc(c.x, c.y, R, end - gw, end + gw); ctx.strokeStyle = '#fff3b0'; ctx.lineWidth = 4 * u; ctx.stroke();
    const tx = c.x + Math.cos(end) * R, ty = c.y + Math.sin(end) * R;
    for (let i = 0; i < 2; i++) {
      const yy = ty + (16 + i * 13) * u, a2 = land * (save.calm ? 1 : 0.45 + 0.55 * Math.max(0, Math.sin(G.t * 6 - i * 1.2)));
      ctx.globalAlpha = a2; ctx.beginPath(); ctx.moveTo(tx - 8 * u, yy - 4 * u); ctx.lineTo(tx, yy + 3 * u); ctx.lineTo(tx + 8 * u, yy - 4 * u);
      ctx.strokeStyle = 'rgba(40,18,4,0.55)'; ctx.lineWidth = 7 * u; ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.4 * u; ctx.stroke();
    }
  }
  // the hand: a pointing glove, tilted, pressing down while it drags
  ctx.globalAlpha = show;
  const press = 1 - 0.1 * (q > 0.12 && q < 0.7 ? 1 : 0);
  ctx.translate(hx, hy); ctx.rotate(-0.35); ctx.scale(u * press, u * press);
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
  // two words above the vault until the first turn (a card over the level has the floor)
  if (T && T.first && !G.card) {
    const txt = 'Drag the ring', ts = 18 * u, wd = ui.measure(txt, ts) + 30 * u, hh = 34 * u;
    const py = Math.max(G.hudBottom + 8 * u, c.y - sim.outerR * G.cam.k - hh - 10 * u), px = ui.A.cx - wd / 2;
    ctx.save(); ctx.globalAlpha = ease01(G.screenT / 0.5);
    ui.roundRect(px, py, wd, hh, hh / 2); ctx.fillStyle = 'rgba(30,14,4,0.62)'; ctx.fill();
    ui.text(txt, ui.A.cx, py + hh / 2 + 0.5 * u, { size: ts, align: 'center', color: '#fff', tag: 'coach:drag' });
    ctx.restore();
  }
}

// Centered card used by intro/pause/win/fail: a cream card in a wooden frame with a ribbon header. Content is a
// vertical stack of blocks built for a scale s (pixels per design unit). The stack is measured first; if it is
// taller than the room below the HUD, everything is rebuilt at a smaller scale, so blocks can never overlap.
// build(s, w) returns [{ h, gap?, draw(x, y, w) }]; w is the card's inner width.
// o.ribbon: header colour; the card pops in with the screen (o.dx / o.dy: it slides instead, the win card).
const CARD_HEAD = 50;
// 0.8.10 (mykee: "settings, celebrations, rewards, the level card are not full screen, please make them full screen
// according to the user's screen"): a stack card fills the safe area on a phone. The panel runs edge to edge and from
// the ribbon down to the bottom lip; its content column keeps a readable width and sits in the middle of that panel, so
// a tall screen gives the art and the rows more room instead of leaving the game showing round a small card.
// Landscape and tablets keep the floating card (a page 1000 px wide reads badly), as does any caller passing full: false.
function cardFull(o, A) {
  if (o.full === false || o.twoCol && A.w > A.h * 1.15) return false;
  return A.h > A.w * 1.15; // portrait: the page is the screen
}
const fullInner = (A, s) => Math.min(A.w - 32 * ui.u, Math.max(372 * s, 440 * ui.u));
function stackCard(title, build, o = {}) {
  const u = ui.u;
  ui.calm = save.calm;
  const A = ui.A, top = Math.max(G.hudBottom, A.y) + 16 * u; // the ribbon stands 8 units proud of the card
  const avail = A.y1 - top - 14 * u; // and the base lip 5 below
  let full = cardFull(o, A);
  // o.twoCol on a wide screen (landscape): blocks marked right: true stack in a second column beside the rest
  const two = !!o.twoCol && A.w > A.h * 1.15;
  const colH = (L, s) => L.reduce((a, b) => a + (b.gap ?? 10 * s) + b.h, 0);
  const measure = (s) => {
    if (two) {
      const w = Math.min(o.maxW || A.w - 32 * u, 780 * s), cw = (w - 48 * s - 28 * s) / 2;
      const blocks = build(s, cw), hl = colH(blocks.filter((b) => !b.right), s), hr = colH(blocks.filter((b) => b.right), s);
      return { s, w, blocks, cw, hl, hr, h: CARD_HEAD * s + Math.max(hl, hr) + 22 * s };
    }
    const w = full ? A.w : Math.min(o.maxW || A.w - 32 * u, 420 * s);
    // the content column, centred on a full page. 0.8.16 (mykee: "it's not full screen"): it is the page column of the
    // shop, Settings and the level card (ui.pageBox: 16 units from each edge), not a card's width that scales with s,
    // so a page that could not grow (s = u) is as wide as one that did
    const inner = full ? fullInner(A, s) : w - 48 * s;
    const blocks = build(s, inner);
    const h = CARD_HEAD * s + colH(blocks, s) + 22 * s;
    return { s, w, blocks, h, inner };
  };
  let m = measure(two && o.maxW ? Math.min(u, o.maxW / 740) : u); // two columns in a limited width: each keeps its reading width
  // a narrower card wraps its text into more lines, so one rescale can still be too tall: step down until it fits
  // (o.minS: never below this scale; with o.scroll the rest scrolls instead, 0.8.14 the fail page)
  const minS = Math.max(u * 0.45, o.minS || 0);
  for (let n = 0; n < 4 && m.h > avail + 0.5 && m.s > minS + 0.001; n++) m = measure(Math.max(minS, m.s * Math.min(0.97, avail / m.h)));
  const scrolls = !!o.scroll && m.h > avail + 0.5;
  if (o.scroll && !scrolls) { o.scroll.max = 0; o.scroll.y = 0; }
  // 0.8.10 (mykee: a page that is "empty or half empty"): a full page with room to spare grows its own content
  // instead of leaving a void, up to o.grow (a third bigger by default: enough to fill a tall phone, never comic).
  if (full && !two && m.h < avail * 0.94) {
    const cap = u * (o.grow || 1.34);
    for (let n = 0; n < 3 && m.s < cap - 0.001 && m.h < avail * 0.94; n++) {
      const t = measure(Math.min(cap, m.s * Math.min(1.5, (avail * 0.94) / m.h)));
      if (t.h > avail) break;
      m = t;
    }
    // a card of a few lines and a button (a boss's hello, a short notice) stays a floating card: stretched over a
    // whole page it would be mostly blank paper
    if (m.h < avail * 0.6 && o.full !== true) { full = false; m = measure(u); }
  }
  const { s, w, blocks } = m;
  const inner = m.inner ?? w - 48 * s, pad = (w - inner) / 2; // where the content column starts inside the panel
  const h = full ? avail : Math.min(m.h, avail);
  const x = full ? A.x : (o.cx || A.cx) - w / 2;
  const y = full ? top : Math.max(top, (A.y1 + Math.max(G.hudBottom, A.y)) / 2 - h / 2);
  if (scrolls && !two) { // too tall even at o.minS: the frame fills the room and the blocks scroll inside it (pageScroll)
    const V = { x, y: y + CARD_HEAD * s - 8 * s, w, h: h - CARD_HEAD * s + 2 * s };
    if (o.hidden) return { x, y, w, h, s, full, V };
    ctx.save();
    if (o.dx || o.dy) ctx.translate(o.dx || 0, o.dy || 0);
    ui.frame(x, y, w, h, { s, r: full ? 2 * s : 24 * s });
    pageScroll(blocks, o.scroll, V, x + pad, inner, s, true);
    const rw = clamp(ui.measure(title, 24 * s) + 56 * s, w * 0.6, w - 14 * s);
    ui.ribbon(title, x + w / 2, y - 8 * s, rw, 40 * s, { s, color: o.ribbon || '#ee5a36', size: 24 * s, tag: 'card:title' });
    ctx.restore();
    return { x, y, w, h, s, full, V };
  }
  // a full page spreads what is left over: the blocks keep their order, the room goes above and below them
  const slack = full ? Math.max(0, h - m.h) : 0;
  // o.hidden: lay out only (each block's at(x, y, w) learns where it will sit); o.dx / o.dy: slide the card (win card entrance)
  // what is still left over after growing is shared out between the rows (a little air everywhere, not one hole at the
  // bottom); anything beyond a comfortable gap sits above and below the stack
  // (the lines of one paragraph, blocks with a hairline gap, stay together)
  const loose = (b) => (b.gap ?? 10 * s) >= 6 * s, nLoose = blocks.filter(loose).length;
  const air = nLoose ? Math.min(slack / (nLoose + 1), 26 * s) : 0;
  const top0 = Math.max(0, slack - air * nLoose) * 0.42;
  if (o.hidden && two) { // the same two columns as drawn below, only the targets
    const maxC = Math.max(m.hl, m.hr);
    for (const [R, ch] of [[false, m.hl], [true, m.hr]]) {
      let cy = y + CARD_HEAD * s + (maxC - ch) / 2;
      const cx = x + 24 * s + (R ? m.cw + 28 * s : 0);
      for (const b of blocks) { if (!!b.right !== R) continue; cy += b.gap ?? 10 * s; if (b.at) b.at(cx, cy, m.cw); cy += b.h; }
    }
    return { x, y, w, h, s, full, two };
  }
  if (o.hidden) {
    let cy = y + CARD_HEAD * s + top0;
    for (const b of blocks) { cy += (b.gap ?? 10 * s) + (loose(b) ? air : 0); if (b.at) b.at(x + pad, cy, inner); cy += b.h; }
    return { x, y, w, h, s, full };
  }
  ctx.save();
  if (o.dx || o.dy) ctx.translate(o.dx || 0, o.dy || 0);
  else if (o.pop !== false) {
    const k = ui.pop(G.screenT, 0.32);
    if (k !== 1) { ctx.translate(x + w / 2, y + h / 2); ctx.scale(k, k); ctx.translate(-(x + w / 2), -(y + h / 2)); }
  }
  ui.frame(x, y, w, h, { s, r: full ? 2 * s : 24 * s });
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
  let cy = y + CARD_HEAD * s + top0;
  for (const b of blocks) {
    cy += (b.gap ?? 10 * s) + (loose(b) ? air : 0);
    if (b.at) b.at(x + pad, cy, inner);
    b.draw(x + pad, cy, inner);
    cy += b.h;
  }
  ctx.restore();
  return { x, y, w, h, s, full };
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
function worldOpener(L) { return !!(L && L.intro && !L.boss && G.li >= 0 && (L.id - 1) % ROAD.PER_ENV === 0 && !save.intro[L.id]); }
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
    // 0.8.14 (mykee, on the "Lava rocks" card: "it just shows the lava salamander. That is quite dumb"): the card plays
    // the new thing's own scene, big (what it does to an egg, then what to do), and the page is filled
    const IP = introPlans(L), hb0 = G.hudBottom;
    if (IP.length) G.hudBottom = ui.A.y; // the page starts at the top of the safe area (drawHUD skips 'intro'), like the fail page
    try { stackCard(L.intro.title, (s, iw) => [
      // (the framed villain portrait card was removed at the owner's request: bosses introduce themselves in the level)
      ...(IP.length ? [introStage(IP, s, iw, wrapText(L.intro.line, 17 * s, iw).slice(0, 4).length)] : L.intro.chick ? [{ h: 104 * s, gap: 0, draw: (x, y, w) => artStage(x, y, w, 104 * s, s, () => chickIntroArt(L.intro.chick, x, y, w, 104 * s)) }] // v3.2: meet the chick kind
        : L.intro.cw ? [{ h: 100 * s, gap: 0, draw: (x, y, w) => artStage(x, y, w, 100 * s, s, () => drawCwIntro(ctx, L.intro.cw, x, y, w, 100 * s, G.t)) }] // v4: meet the clockwork creature
        : !L.boss && L.salamander ? [{ h: 96 * s, gap: 0, draw: (x, y, w) => artStage(x, y, w, 96 * s, s, () => salIntroArt(x, y, w, 96 * s)) }] : []), // v3.2: meet the salamander
      ...wrapText(L.intro.line, 17 * s, iw).slice(0, 4).map((l, i) => lineBlock(l, 17 * s, { tag: 'wintro:' + i, gap: i ? 2 * s : 8 * s })),
      { h: 58 * s, gap: 18 * s, draw: (x, y, w) => ui.button('gotit', 'GOT IT', x, y, w, 58 * s, { kind: 'primary', shimmer: true, icon: ICON.play, size: 23 * s }) },
    ], { ribbon: L.boss ? '#c9342c' : acc, full: IP.length ? true : undefined }); } finally { G.hudBottom = hb0; }
    return;
  }
  drawLevelIntro(L, acc);
}
// The scenes a level's "new thing" card plays (0.8.14): each villain or hazard first met on this level, then a toy or a
// ring floor that is new here. A chick's or a clockwork creature's own card keeps its own art.
const INTRO_KINDS = { 43: ['turtle'], 44: ['current'] }; // a card about something met a level earlier
function introPlans(L) {
  const I = G.introP;
  if (I && I.id === L.id && I.li === G.li) return I.P;
  let P = [];
  if (G.li >= 0 && !L.intro.chick && !L.intro.cw) {
    const ks = (INTRO_KINDS[L.id] || villainKinds(L).filter((k) => kindFirst(k) === L.id)).filter((k) => !L.boss || /^boss:/.test(k));
    P = ks.slice(0, 3).map((k) => howToPlan(k, { harm: true }));
    if (!P.length) {
      const foeOf = L.salamander ? 'salamander' : L.eagle ? 'eagle' : 'snake';
      for (const k of levelThings(L)) {
        if (teachFirst(k) !== L.id) continue;
        const [kind, id] = k.split(':');
        if (kind === 'toy') P.push(toyPlan(id, foeOf)); else if (kind === 'floor') P.push(floorPlan(id));
      }
      P = P.slice(0, 2);
    }
  }
  G.introP = { id: L.id, li: G.li, P, i: 0, t0: G.t };
  return P;
}
function introStage(P, s, iw, lines = 3) {
  // the stage takes the room the page has left (a tall phone: nearly square; a short one: a wide strip), never less than 0.6 of its width
  const room = (ui.A.y1 - ui.A.y - 30 * ui.u) / s - (250 + 24 * lines);
  const stH = clamp(room * s, iw * 0.6, Math.min(iw * 1.12, 440 * s)), capH = 36 * s, n = P.length;
  return { h: stH + capH, gap: 4 * s, draw: (x, y, w) => {
    const I = G.introP;
    if (!save.calm && n > 1 && G.t - I.t0 >= (P[I.i % n].loop || HOWTO_LOOP)) { I.i = (I.i + 1) % n; I.t0 = G.t; }
    const plan = P[I.i % n], th = G.theme && G.theme.palette;
    const ho = { rooster: allyIcon, world: howWorld(), calm: save.calm, sky0: th && th.skyTop, sky1: th && th.skyBottom, ground: th && th.groundTop, ring: th && th.ring && th.ring.base, ringEdge: th && th.ring && th.ring.dark };
    drawHowTo(ctx, plan, x, y, w, stH, G.t - I.t0, ho);
    ui.roundRect(x, y, w, stH, Math.min(18, stH * 0.08)); ctx.lineWidth = 2.5 * s; ctx.strokeStyle = 'rgba(90,50,16,0.55)'; ctx.stroke();
    ui.record({ x, y, w, h: stH }, 'wintro:stage');
    const harmNow = plan.kind && !save.calm && (ho._phase === 'harm' || (!plan.harm && ho._pt < 1.6));
    ui.text(harmNow ? threatWords(plan.kind) : plan.cap, x + w / 2, y + stH + capH / 2 + 1 * s, { size: 18 * s, align: 'center', color: harmNow ? '#b8321e' : '#2d6a1c', maxW: w, tag: 'wintro:cap' });
  } };
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
    // 0.8.10: the speed log shows two or three frames of 60 to 140 ms every time a level card or the pause page opens.
    // The shrunken copy was 84x187: a web view keeps canvases that small in ordinary memory, so copying the screen
    // into it read the whole frame back from the graphics chip, every frame of the first quarter second. Now the
    // scratch picture is a third of the screen (large enough to stay on the chip); the frame is shrunk into it, then
    // shrunk again inside it (to a ninth), and that corner is stretched back over the screen: no read-back at all.
    const cw = canvas.width, ch = canvas.height, sw = Math.max(260, Math.round(cw / 3)), sh = Math.max(260, Math.round(ch / 3));
    const tw = Math.max(8, Math.round(sw / 3)), tH = Math.max(8, Math.round(sh / 3));
    const o = G.introBlur || (G.introBlur = document.createElement('canvas'));
    if (o.width !== sw || o.height !== sh) { o.width = sw; o.height = sh; }
    const oc = o.getContext('2d');
    oc.imageSmoothingEnabled = true; oc.imageSmoothingQuality = 'high';
    oc.globalCompositeOperation = 'copy'; oc.drawImage(canvas, 0, 0, sw, sh);
    oc.globalCompositeOperation = 'source-over'; oc.drawImage(o, 0, 0, sw, sh, 0, 0, tw, tH);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(o, 0.5, 0.5, tw - 1, tH - 1, 0, 0, cw, ch);
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
// 2026-11-24 (mykee: "show it to the user visually, some way to select a power chick ... if they click on play, some
// indication that they need to select a chick"): while a pick is asked for, a hand taps the chicks in turn; after a
// refused PLAY it taps faster and the tiles jump (pickAsked: seconds since that tap).
const pickJump = (bt, locked, T) => { const a = T.need && !locked ? pickAsked() : 9, b = Math.min(bt, a); return { bounce: b < 0.45 && !save.calm ? 1.6 * (1 - b / 0.45) : 0, bt: b }; };
const pickAsked = () => (G.pickAsk && G.level && G.pickAsk.lid === G.level.id && G.pickAsk.n ? G.t - G.pickAsk.t : 99);
function pickHand(tiles, T, V, s) { // tiles: [{ id, locked, x, y, w, h }] as drawn; V: the row's visible rect
  if (!T || !T.need) return;
  const ok = tiles.filter((q) => !q.locked && q.x + q.w * 0.5 > V.x + 8 * s && q.x + q.w * 0.5 < V.x + V.w - 8 * s);
  if (!ok.length) return;
  const per = pickAsked() < 4 ? 1.0 : 1.6, ph = save.calm ? 0.5 : (G.t % per) / per, q = ok[save.calm ? 0 : Math.floor(G.t / per) % ok.length];
  const press = ph > 0.42 && ph < 0.72, lift = press ? 0 : Math.min(1, Math.abs(ph - 0.57) * 3.2);
  const hx = q.x + q.w * 0.5, hy = q.y + q.h * 0.9, hs = Math.min(q.w * 0.62, 92 * s); // 0.8.14: it taps the card's bottom edge, so the chick, its name and its power stay readable
  teachHand(ctx, hx + lift * hs * 0.1, hy + lift * hs * 0.16, hs, press, 1);
}
// one chick card. sel: 0..1 eased selection (lift, grow, bright border, glow, check); dim: another card is chosen
function chickCard(S, x, y, w, h, s, o) {
  const sel = o.sel, pulse = o.need && !save.calm ? 1 + 0.018 * Math.sin(G.t * 4 + o.i * 0.9) : 1;
  const bn = o.bounce ? 1 + 0.07 * o.bounce * Math.sin(o.bt * 24) : 1;
  const foc = o.foc == null ? sel : o.foc; // foc: 0..1, the one playing on the stage (bigger, raised); sel: the one coming along (border, tick)
  const k = (1 + 0.06 * foc) * pulse * bn, cx = x + w / 2, cy = y + h / 2 - 4 * s * foc;
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
      const lz = bz * 0.7, lx = o.lockR ? w - pad - lz * 0.65 : pad + lz * 0.65, ly = pad + lz * 0.65; // (lockR: the picker row keeps its left corner for the row's arrow)
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
    drawPremiumBadge(ctx, o.lockR != null ? w / 2 : 16 * s, 4 * s, 11 * s, G.t); // (the picker row: over the middle, clear of the row's arrows and the tick)
  }
  if (foc > 0.02 && sel < 0.98) { ctx.save(); ctx.globalAlpha *= foc * (1 - sel); ui.roundRect(0, 0, w, h, r); ctx.lineWidth = 3.5 * s; ctx.strokeStyle = '#fff3cf'; ctx.stroke(); ui.roundRect(-1.75 * s, -1.75 * s, w + 3.5 * s, h + 3.5 * s, r + 1.75 * s); ctx.lineWidth = 1.5 * s; ctx.strokeStyle = 'rgba(90,50,16,0.75)'; ctx.stroke(); ctx.restore(); } // in focus, not (yet) the chosen one: a pale rim
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
  glideDt(S, dt);
}
// the stretch past a list's ends (px): none with Reduced motion
const scrollLim = () => (save.calm ? 0 : 110 * ui.u);
function glideDt(S, dt) {
  if (G.pdrag && G.pdrag.sc === S) { S.to = null; if (G.pdrag.moved) return; } // under a finger: the finger moves it
  glideStep(S, dt, scrollLim());
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
const lvLaser = () => ((G.level && G.level.orbs) || []).some((o) => o.type === 'laser'); // v0.8.9: the laser cannon hits villains too
const CHEV = {}; let CHEV_N = 0; // the scroll arrows on screen: id -> its scroller and view height
const pageColH = (B, s) => B.reduce((a, b) => a + (b.gap ?? 10 * s) + b.h, 0);
// a scrolling column of blocks inside V (screen coordinates; the scroll is applied to y, so recorded rects are real)
// 0.8.17: two columns of blocks that scroll as one page (Settings on a phone on its side), else as pageScroll
function pageScroll2(L, R, S, V, xl, xr, w, s) {
  const H = Math.max(pageColH(L, s), pageColH(R, s)) + 18 * s;
  S.max = Math.max(0, H - V.h);
  glide(S);
  const r0 = ui.rects.length, b0 = ui.buttons.length, sY = snapPx(S.y, DPR);
  ctx.save(); ctx.beginPath(); ctx.rect(V.x, V.y, V.w, V.h); ctx.clip();
  for (const [B, x] of [[L, xl], [R, xr]]) { let y = V.y + 6 * s - sY; for (const b of B) { y += b.gap ?? 10 * s; if (y + b.h > V.y - 40 * s && y < V.y + V.h + 40 * s) b.draw(x, y, w); y += b.h; } }
  ctx.restore();
  clipRecorded(r0, b0, V);
  if (S.max > 0) {
    const fade = (yy, down) => { const g = ctx.createLinearGradient(0, yy, 0, yy + (down ? 22 : -22) * s); g.addColorStop(0, 'rgba(12,7,3,0.55)'); g.addColorStop(1, 'rgba(12,7,3,0)'); ctx.fillStyle = g; ctx.fillRect(V.x, down ? yy : yy - 22 * s, V.w, 22 * s); };
    if (S.y > 1) fade(V.y, true);
    if (S.y < S.max - 1) { fade(V.y + V.h, false);
      const cx2 = Math.min(V.x + V.w - 22 * s, xr + w + 2 * s), cy2 = V.y + V.h - 22 * s, cid = S.cid || (S.cid = ++CHEV_N);
      chevron(cx2, cy2 + (save.calm ? 0 : 3 * s * Math.sin(G.t * 4)), 17 * s, 'd', 1);
      CHEV[cid] = { S, h: V.h }; ui.buttons.push({ id: 'pgdn:' + cid, x: cx2 - 26 * s, y: cy2 - 26 * s, w: 52 * s, h: 52 * s }); }
  }
}
function pageScroll(blocks, S, V, x, w, s, top) {
  const H = pageColH(blocks, s) + 18 * s;
  S.max = Math.max(0, H - V.h);
  glide(S);
  const r0 = ui.rects.length, b0 = ui.buttons.length;
  ctx.save(); ctx.beginPath(); ctx.rect(V.x, V.y, V.w, V.h); ctx.clip();
  const sY = snapPx(S.y, DPR);
  let y = V.y + (S.max > 0 || top ? 6 * s : Math.max(6 * s, (V.h - H) * 0.35)) - sY;
  G.ipAnchor = {};
  for (const b of blocks) { y += b.gap ?? 10 * s; if (b.anchor) G.ipAnchor[b.anchor] = y + sY - V.y - 8 * s; if (y + b.h > V.y - 40 * s && y < V.y + V.h + 40 * s) b.draw(x, y, w); y += b.h; }
  ctx.restore();
  clipRecorded(r0, b0, V);
  if (S.max > 0) { // soft edges, and an arrow while there is more below
    const fade = (yy, down) => { const g = ctx.createLinearGradient(0, yy, 0, yy + (down ? 22 : -22) * s); g.addColorStop(0, 'rgba(12,7,3,0.55)'); g.addColorStop(1, 'rgba(12,7,3,0)'); ctx.fillStyle = g; ctx.fillRect(V.x, down ? yy : yy - 22 * s, V.w, 22 * s); };
    if (S.y > 1) fade(V.y, true);
    if (S.y < S.max - 1) { fade(V.y + V.h, false);
      // the "more below" arrow is a button too (0.8.7, mykee: "I click on that arrow and it leads nowhere"): one tap, most of a page down
      const cx2 = Math.min(V.x + V.w - 22 * s, x + w + 2 * s), cy2 = V.y + V.h - 22 * s, cid = S.cid || (S.cid = ++CHEV_N);
      chevron(cx2, cy2 + (save.calm ? 0 : 3 * s * Math.sin(G.t * 4)), 17 * s, 'd', 1);
      CHEV[cid] = { S, h: V.h }; ui.buttons.push({ id: 'pgdn:' + cid, x: cx2 - 26 * s, y: cy2 - 26 * s, w: 52 * s, h: 52 * s }); }
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
      HOWW.sim = new Sim({ id: -77, theme: L.theme, material: L.material || 'wood', eggs: 1, target: 1, time: 99, spacing: 1.05, nest: { w: 2.6 }, rings: [{ gaps: [{ a: -90 }] }, { gaps: [{ a: -90 }], thorns: [{ a: -104 }, { a: -76 }] }] }, { mode: 'medium' });
      for (const th of HOWW.sim.rings[HOWW.sim.rings.length - 1].thorns) th.alive = false; // shown only by the toy scenes (level card how-to)
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
    ring(c, C, k, ang, t, door = null, deco = null) {
      try { ring.body.setAngle(ang); } catch (e) { /* drawn at its last angle */ }
      { // the toy scenes (howto 'toy'): thorns by the gap that a flame burns, a thorn curtain across it
        const on = !!(deco && deco.thorns && !deco.burnt), g = ring.gaps[0];
        ring.thorns.forEach((th, i) => { const live = on && (deco.one == null || deco.one === i); if (th.alive && !live && deco && deco.burnt) W.thornCrumble(th, t); th.alive = live; }); // one: the far thorn only (the ice scene)
        if (g) g.curtain = deco && deco.curtain != null ? { alive: deco.curtain < 1, burn: deco.curtain, burning: deco.curtain > 0 && deco.curtain < 1, fixes: [] } : null;
      }
      { const g = ring.gaps[0]; if (g) { if (door != null) { g.shut = g.shut || { period: 4, open: 0.5, phase: 0 }; g.o = door; } else if (g.shut) { g.shut = null; g.o = 1; } } } // the gate-door scene (how-to 'doors')
      // 0.8.7: painted straight onto the stage, not through the ring's picture cache. At this zoom that picture is
      // 2048 px square and was repainted whenever the demo turned the ring 0.2 rad; three scenes on the pause page,
      // each at its own angle, repainted it every frame (the scroll there crawled). Clipped to a small stage the
      // direct paint is cheap.
      const on = bodyCache.on; bodyCache.on = false;
      // 0.8.10 the floor scenes: the ring in that material (ice, cloud) and a honey pad that rides it (off: radians from the gap)
      const mat0 = ring.mat; if (deco && deco.mat) ring.mat = deco.mat;
      ring.honey = deco && deco.honey ? [{ a: -Math.PI / 2 + deco.honey.off, len: deco.honey.len, dry: 0 }] : [];
      c.save(); c.translate(C.x, C.y); c.scale(k, -k);
      try { W.drawRing(c, ring, G.theme, k, t, { eggs: [] }); if (ring.gaps[0] && ring.gaps[0].curtain) W.drawV3Ring(c, ring, k, t, G.theme); } finally { c.restore(); bodyCache.on = on; ring.mat = mat0; } // the curtain: the game's own drawV3Ring (and so drawThornCurtain)
    },
    egg(c, X, Y, stone, worry, C, k, t, look = null) {
      try { egg.body.setTransform({ x: (X - C.x) / k, y: -(Y - C.y) / k }, (look && look.rot) || (worry ? Math.sin(t * 22) * 0.08 : 0)); } catch (e) { return; }
      egg.stone = stone || (look && look.iron) ? 1 : 0; egg.iron = look && look.iron ? 1 : 0; // iron: the Electromagnet card
      egg.fire = look && look.fire ? 6 : 0; egg.fireKind = look && look.fire ? 'fire_red' : null; egg.chick = !!(look && look.chick); egg.cracks = (look && look.cracks) || 0;
      c.save(); c.translate(C.x, C.y); c.scale(k, -k);
      try { W.drawEgg(c, egg, t, k); } finally { c.restore(); egg.fire = 0; egg.chick = false; egg.iron = 0; egg.cracks = 0; }
    },
    live(c, C, k, t, a) { c.save(); c.translate(C.x, C.y); c.scale(k, -k); try { drawLiveRing(c, ring, k, t, a); } finally { c.restore(); } }, // the shock ring (Electromagnet card)
    orb(c, type, X, Y, r, t) { drawOrb(c, type, X, Y, r, t, true); },
    portal(c, X, Y, k, t, out) { c.save(); c.translate(X, Y); c.scale(k, -k); try { W.drawPortal(c, 0, 0, t, out); } finally { c.restore(); } },
    nest(c, X, Y, wPx, glow, t) {
      const p = sim.nest.getPosition(), kn = wPx / sim.nestW;
      c.save(); c.translate(X, Y); c.scale(kn, -kn); c.translate(-p.x, -p.y);
      W.drawNest(c, sim, G.theme, t, 0);
      c.restore();
    },
  };
}
// 0.8.10 (mykee: L11's card said nothing about the slippery ice; on L9 "Do they have to click on [the chick]?"): what a
// level teaches comes from the level itself. Each thing it holds (a ring floor, a toy orb, the power chick, the other
// orbs) has a key; the first level that has a key acts it out on the card, later levels show it as a small chip.
const HATCH_NAME = { hatch_glow: 'Glow chick', hatch_bulk: 'Bulk chick', hatch_dash: 'Dash chick', hatch_swoop: 'Swoop chick', hatch_pick: 'Drill chick' };
const TEACH_TOY = { fire_red: 'flame', twin: 'twin', hatch_glow: 'glow', hatch_bulk: 'bulk', warp: 'warp' }; // orbs with an acted scene (howto.js TOY)
function levelThings(L) {
  const R = L.rings || [], O = [...new Set((L.orbs || []).map((o) => o.type))], f = [];
  const mat = (r) => r.mat || L.material || 'wood';
  if (R.some((r) => mat(r) === 'ice')) f.push('floor:ice');
  if (R.some((r) => r.honey && r.honey.length)) f.push('floor:honey');
  if (R.some((r) => mat(r) === 'cloud')) f.push('floor:cloud');
  if (L.id >= STRIKE_FROM) f.push('chick');
  for (const o of O) if (TEACH_TOY[o]) f.push('toy:' + TEACH_TOY[o]);
  if (R.some((r) => r.curtain)) f.push('toy:curtain');
  if ((L.portals || []).some((p) => p.a && p.b && (p.a[0] !== p.b[0] || p.a[1] !== p.b[1]))) f.push('toy:portal'); // (a portal that only emits orbs is no portal)
  if (O.includes('hatch_glow') && L.id >= STRIKE_FROM) f.push('mix:glow'); // the first level with a hatch chick AND a power chick: tap which? (L9)
  for (const o of O) if (!TEACH_TOY[o]) f.push('orb:' + o);
  return f;
}
let TEACH0 = null; // key -> the first level id that has it
function teachFirst(key) {
  if (!TEACH0) { TEACH0 = {}; for (const L of LEVELS) for (const k of levelThings(L)) if (!(k in TEACH0)) TEACH0[k] = L.id; }
  return TEACH0[key];
}
// 2026-11-23: the first campaign level each villain or hazard kind is met on (its card teaches it in full)
let KIND0 = null;
function kindFirst(k) {
  if (!KIND0) { KIND0 = {}; for (const L of LEVELS) for (const x of villainKinds(L)) if (!(x in KIND0)) KIND0[x] = L.id; }
  return KIND0[k];
}
// the level card's tile for a scene (2026-11-23): its art and two or three words; a tap plays that scene again
const TOY_ORB = { flame: 'fire_red', twin: 'twin', curtain: 'fire_red', portal: 'warp', glow: 'hatch_glow', bulk: 'hatch_bulk', warp: 'warp', bait: 'decoy', sweep: 'laser', twister: 'pepper', magnet: 'iron' };
function howTile(p) {
  if (p.move === 'rooster') return { name: 'Rooster helps', art: (c, X, Y, r) => allyIcon(c, X, Y, r * 1.5) };
  if (p.teach) return { name: 'Your chick', art: teachChip('chick').art };
  if (p.move === 'floor') return { name: p.name, art: teachChip('floor:' + p.surf).art };
  if (p.move === 'toy') return { name: p.name, art: (c, X, Y, r) => drawOrb(c, TOY_ORB[p.toy] || 'fire_red', X, Y, r, G.t, true) };
  if (p.kind) return { name: threatWords(p.kind), boss: /^boss:/.test(p.kind), art: (c, X, Y, r) => drawVillainPortrait(c, p.kind, X, Y, r * 3.3, G.t) };
  return null;
}
// a reminder chip: the thing's own art and a short name ('New' ones in green)
function teachChip(key) {
  const [kind, id] = key.split(':'), MAT = { ice: ['#a8dcf5', '#3f7fa8'], honey: ['#f2b233', '#9a5a0a'], cloud: ['#dfe6f2', '#7d879a'] };
  const name = kind === 'floor' ? { ice: 'Ice', honey: 'Honey', cloud: 'Cloud' }[id] : kind === 'chick' ? 'Tap chick' : kind === 'toy' ? ({ flame: 'Red flame', twin: 'Twin egg', curtain: 'Curtain', portal: 'Portal', glow: 'Glow chick', bulk: 'Bulk chick', warp: 'Warp gate' }[id] || id) : HATCH_NAME[id] || powerInfo(id).name;
  const art = (c, X, Y, r) => {
    if (kind === 'floor') { const M = MAT[id]; c.save(); c.lineCap = 'round'; c.lineWidth = r * 0.62; c.strokeStyle = M[1]; c.beginPath(); c.arc(X, Y - r * 1.2, r * 1.9, Math.PI * 0.32, Math.PI * 0.68); c.stroke(); c.lineWidth = r * 0.42; c.strokeStyle = M[0]; c.stroke(); c.restore(); }
    else if (kind === 'chick') { const id2 = strikeFor(G.level, G.li) || (strikesOpen()[0] || {}).id || 'freeze'; drawStrikeChick(c, id2, X - r * 0.15, Y + r * 0.25, r * 1.6, 0.4, { feet: false, fog: false }); }
    else drawOrb(c, kind === 'toy' ? ({ flame: 'fire_red', twin: 'twin', glow: 'hatch_glow', bulk: 'hatch_bulk', warp: 'warp', curtain: 'fire_red', portal: 'warp' }[id] || id) : id, X, Y, r, G.t, true);
  };
  return { key, name, art };
}
// ---- the level card, 0.8.14 (mykee 2026-11-24, on his phone: "the salamanders are quite small", "I have never ever seen
// the boosters", "the title is not centered, and the coins are not properly aligned", "highlight that in the green
// color", "there shouldn't be overlapping text", "make it full screen"; and look at how Candy Crush and Angry Birds do
// it: one header line, big art, one big button, a centred grid with equal margins).
// One page over the whole safe rect, top to bottom: a header line (back, the level ribbon, the coins) with the level's
// name and world under it; a cream sheet that rises from the bottom edge holding the tabs (Level | Chicks), the tab's
// content, the boosters strip and the big button, both pinned at the bottom. The Level tab: the goal, a big stage with
// nothing drawn on it, its caption under it, the tiles of what is on the level (the one playing in green), the reminder
// chips and the stars. The Chicks tab: the carousel, and a big stage playing the power of the chick in its middle
// (locked ones too, with their way in under it). A phone on its side: the stage on the left, the rest on the right.
// Only when a small screen cannot hold it all does the middle scroll; the stage, the tiles and the button stay in view.
const tabPulse = () => (save.calm ? 1 : 1 + 0.09 * (1 - Math.cos((G.t / 1.2) * Math.PI * 2))); // 1 -> 1.18 -> 1, every 1.2 s
// a round mark on whatever needs the player (a tab, a booster to take, the free video): red, white rim, a "!", pulsing
function tabMark(x, y, r) {
  const k = tabPulse(), R = r * k;
  ctx.save();
  if (!save.calm && !PERF.low) { ctx.beginPath(); ctx.arc(x, y, R * 1.45, 0, 7); ctx.fillStyle = `rgba(255,70,40,${(0.32 * (k - 1) / 0.18).toFixed(3)})`; ctx.fill(); }
  ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fillStyle = '#e8402a'; ctx.fill(); ctx.lineWidth = Math.max(1.5, R * 0.2); ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.fillStyle = '#fff'; ui.roundRect(x - R * 0.13, y - R * 0.58, R * 0.26, R * 0.72, R * 0.13); ctx.fill();
  ctx.beginPath(); ctx.arc(x, y + R * 0.42, R * 0.15, 0, 7); ctx.fill();
  ctx.restore();
}
// the ring speed strip (levels 2 to 5): ringSpeedStrip below, by the Settings page
// its height, measured once per level by drawing it where nothing shows (it may record buttons: those are taken back)
function ringStripH(x, w, s) {
  const key = (G.level && G.level.id) + ':' + G.li + ':' + Math.round(w) + ':' + s.toFixed(3) + ':' + rsStripH(); // (0.8.17 polish: a short screen's strip grows its line after the first change; measured again then, PLAY stays clear)
  if (G.rsMeas && G.rsMeas.key === key) return G.rsMeas.h;
  const r0 = ui.rects.length, b0 = ui.buttons.length;
  ctx.save(); ctx.globalAlpha = 0; let h = 0;
  try { h = +ringSpeedStrip(x, -9999, w, s) || 0; } catch (e) { h = 0; }
  ctx.restore();
  ui.rects.length = r0; ui.buttons.length = b0;
  G.rsMeas = { key, h };
  return h;
}
// the chips that used to sit on the stage (the win streak, a free try, the egg's power): measured, then drawn in a row
function perkItems(s) {
  const out = [], H = 34 * s;
  for (const f of [dareChip, hotBadge, tryChip, perkChipCard]) { const w = f(0, 0, 9999, s, true); if (w > 0) out.push({ w, h: H, draw: (x, y, maxW) => f(x, y, maxW, s, false) }); }
  return out;
}
function drawLevelIntro(L, acc) {
  ui.calm = save.calm;
  introBackdrop();
  const u = ui.u, A = ui.A, C = ui.C, wo = worldOpener(L);
  const land = A.w > A.h * 1.15;
  G.introAcc = tintHex(/^#[0-9a-f]{6}$/i.test((ui.skin && ui.skin.ribbon) || '') ? ui.skin.ribbon : acc);
  const kinds = G.li >= 0 && G.infoKinds ? G.infoKinds.filter((k) => hasPortrait(k) || VILLAIN_INFO[k]).slice(0, 8) : [];
  const label = G.li === -2 ? 'Lab' : G.li < 0 ? `Daily Vault ${today().slice(5)}` : `Level ${L.id}`;
  const world = wo ? (WORLDS[envOf(G.li)] || L.intro.title) : WORLDS[envOf(G.li)] || '';
  const hardLv = isHardLevel(L) && G.li >= 0 && save.mode !== 'easy'; // 0.8.15: the level before each boss (sim.js HARD_LEVEL)
  const INK = 'rgba(40,20,5,0.9)';
  const pg = G.ipage || (G.ipage = { y: 0, v: 0, max: 0, t: G.t, lid: null });
  if (pg.lid !== L.id + ':' + G.li) { pg.lid = L.id + ':' + G.li; pg.y = 0; pg.v = 0; G.itab = 'level'; }
  const T = introChicks(), locked = lockedChicks();
  if (!T.open.length && locked.length) T.id = null;
  const items = [...T.open.map((S) => ({ S })), ...locked.map((c) => ({ S: STRIKE[c.id], locked: c }))];
  const hasCh = items.length > 0, lvTab = !hasCh || G.itab !== 'chicks';
  const early = earlyDays(), showBoost = !!save.wallet && !early;
  const s = u * clamp(A.w / (390 * u), 0.82, 1), pad = 16 * u, gp = 6 * s;
  const th = G.theme && G.theme.palette;
  const iwP = Math.min(A.w - 2 * pad, 520 * s), W0 = Math.min(A.w - 2 * pad, 1180 * s), gap2 = 20 * s; // portrait: one column; on its side: two
  const lwL = Math.min((W0 - gap2) * 0.52, 640 * s), rwL = W0 - gap2 - lwL;
  const howOpts = (extra) => ({ rooster: allyIcon, world: howWorld(), calm: save.calm, sky0: th && th.skyTop, sky1: th && th.skyBottom, ground: th && th.groundTop, ring: th && th.ring && th.ring.base, ringEdge: th && th.ring && th.ring.dark, ...extra });
  const stageFrame = (x, y, w, h) => { ui.roundRect(x, y, w, h, Math.min(18 * s, h * 0.08)); ctx.lineWidth = 3 * s; ctx.strokeStyle = 'rgba(90,50,16,0.6)'; ctx.stroke(); };

  // ---- what the level teaches (0.8.10 / 2026-11-23): the scenes, the tiles under the stage, the reminder chips
  const howTeach = () => {
    if (G.howT && G.howT.lid === pg.lid) return G.howT;
    const toys = G.li >= 0 ? { 2: ['flame'], 3: ['twin', 'curtain'], 4: ['portal', 'glow'], 21: ['bulk'], 26: ['warp'], 32: ['warp'], 51: ['bait'], 53: ['sweep', 'twister'], 56: ['magnet'] }[L.id] || [] : []; // the first-five ladder: each level's new toy, first (2026-11-20: and the Practice content placed in L22-L47 of the 50-level road, L26-L56 now)
    const things = G.li >= 0 ? levelThings(L) : [], fresh = things.filter((k) => teachFirst(k) === L.id), foeOf = L.salamander ? 'salamander' : L.eagle ? 'eagle' : 'snake';
    const chickOn = things.includes('chick') && strikesOpen().length > 0, chickId = strikeFor(L, G.li) || (strikesOpen()[0] || {}).id;
    const foe = (kinds.find((k) => !/^(icicles|lava|lightning|embers|quake|rain|current|gusts|popthorns|vines|doors|curse|thornorb)$/.test(k)) || 'snake').replace(/^boss:/, '');
    const acted = [], P0 = [];
    for (const id of toys) { P0.push(toyPlan(id, foeOf)); acted.push('toy:' + id); }
    for (const k of fresh) {
      const [kind, id] = k.split(':');
      if (kind === 'floor') P0.push(floorPlan(id));
      else if (kind === 'toy' && !toys.includes(id)) P0.push(toyPlan(id, foeOf));
      else if (kind === 'mix') P0.push({ ...toyPlan(id, foeOf), again: 1 });
      else if (kind === 'chick' && chickOn && chickId) P0.push(chickTeach(chickId, foe in VILLAIN_INFO ? foe : 'snake'));
      else continue;
      acted.push(k);
    }
    // 2026-11-23 (mykee: the level card is the only lesson now): every threat in the level has its scene (what it does,
    // then what to do) and a tile under the stage. The scenes that play by themselves are the ones new here: met for
    // the first time on this level, or not yet met by this player. The others wait on their tiles, a tap away.
    const newK = (k) => !save.seen['v:' + k] || (G.li >= 0 && kindFirst(k) === L.id);
    const vNew = kinds.filter(newK).map((k) => howToPlan(k, { harm: true })), vOld = kinds.filter((k) => !newK(k)).map((k) => howToPlan(k, { harm: true }));
    let P = [...P0, ...vNew];
    if (kinds.some((k) => k === 'weasel' || k === 'rats' || k === 'boss:weasel') && G.sim && G.sim.ally && G.sim.ally.avail.includes('rooster') && !(G.li >= 0 && G.li < 4 && L.id < 5)) P.push(HOWTO_ROOSTER); // Papa Rooster from L5 (the first-five ladder)
    if (!P.length && !vOld.length) P = [HOWTO_BASIC];
    let auto = P.map((p, i) => i);
    P = [...P, ...(P.length && ENG.pacer.cards(save) === 'new' ? [] : vOld)]; // the Pacer: a player who skips every card sees only what is new
    if (!auto.length) auto = P.map((p, i) => i); // nothing new: the reminders take turns
    const shown = new Set(P.filter((p) => p.move === 'floor').map((p) => 'floor:' + p.surf).concat(P.filter((p) => p.move === 'toy').map((p) => 'toy:' + p.toy), P.some((p) => p.teach) ? ['chick'] : []));
    const chips = things.filter((k) => !shown.has(k) && !acted.includes(k) && !k.startsWith('mix:') && (k !== 'chick' || chickOn)).map((k) => ({ ...teachChip(k), fresh: teachFirst(k) === L.id }));
    chips.sort((a, b) => b.fresh - a.fresh); // the new ones first
    const tiles = P.map((p, i) => { const Ti = howTile(p); return Ti && { ...Ti, i, fresh: auto.includes(i) && !!(p.kind ? newK(p.kind) : p.move !== 'rooster') }; }).filter(Boolean);
    return (G.howT = { lid: pg.lid, plans: P, chips, auto, tiles: tiles.length > 1 ? tiles : [] }); // one scene alone needs no tiles: its stage and caption already say it all
  };
  const HT = howTeach(), plans = HT.plans, nP = plans.length, auto = HT.auto;
  const Hw = G.how || (G.how = { i: 0, t0: G.t, lid: null });
  if (Hw.lid !== pg.lid) { Hw.lid = pg.lid; Hw.i = auto[0] || 0; Hw.t0 = G.t; } // the new one first (L31: the gate doors)
  if (!save.calm && nP > 1 && G.t - Hw.t0 >= (plans[Hw.i % nP].loop || HOWTO_LOOP)) { const at = auto.indexOf(Hw.i % nP); Hw.i = at < 0 ? auto[0] : auto[(at + 1) % auto.length]; Hw.t0 = G.t; } // the new ones take turns; a tapped reminder plays once
  const plan = plans[Hw.i % nP];

  // ---- the header: back on the left, the level ribbon in the middle, the coins on the right, one centre line
  const HDR = 52 * s; // = ui.pageBox's header line (shop, Settings, Extras, Practice)
  const header = (x, y, w) => {
    ui.button(G.li === -1 ? 'back' : 'levels', '', x, y, HDR, HDR, { kind: 'hud', icon: ICON.left, iconS: 1.3, round: HDR / 2 });
    const cbw = early ? 0 : Math.max(104 * s, ui.measure(String(save.wallet.coins), 21 * s) + 64 * s);
    if (cbw) purseBtn(x + w - cbw, y, cbw, HDR, 21 * s); // the coins roll and pop like every other counter (ui/purse.js)
    // 0.8.16: the ribbon's words are always whole ("Daily Va..." beside a big purse): centred when that fits, else
    // moved into the room between the back button and the purse, then smaller letters; never an ellipsis
    const tail = 16 * s, L0 = x + HDR + 8 * s + tail, R0 = x + w - (cbw ? cbw + 8 * s : HDR + 8 * s) - tail, lw = ui.measure(label, 25 * s);
    const rw = Math.min(R0 - L0, Math.max(150 * s, lw + 48 * s)), rcx = clamp(x + w / 2, L0 + rw / 2, R0 - rw / 2);
    ui.ribbon(label, rcx, y + 2 * s, rw, HDR - 6 * s, { s, color: hardLv ? '#d8342a' : acc, size: Math.min(25 * s, (25 * s * (rw - 40 * s)) / Math.max(1, lw)), tag: 'intro:level' });
    return { ribL: rcx - rw / 2 - tail };
  };
  // the level's name (big) and its world (small): one compact block
  const nameH = 31 * s + (world ? 18 * s : 0);
  const nameBlock = (x, y, w) => {
    ui.text(L.name, x + w / 2, y + 15 * s, { size: 27 * s, align: 'center', maxW: w, color: '#fff', stroke: INK, shadow: 'rgba(0,0,0,0.35)', tag: 'intro:name' });
    if (world && !hardLv) ui.text(world, x + w / 2, y + 31 * s + 9 * s, { size: 15 * s, align: 'center', maxW: w, color: '#ffe27a', stroke: INK, tag: 'intro:world' });
    else if (world) { // a hard level: a red pill "Hard level" and what it pays, where the world's name sits
      const a = 'Hard level', b = '+50%', fs = 15 * s, aw = ui.measure(a, fs), bw2 = ui.measure(b, fs), cr = 8 * s, pw = aw + 20 * s, tw = pw + 8 * s + cr * 2 + 4 * s + bw2, px = x + (w - tw) / 2, cy = y + 31 * s + 9 * s;
      ui.roundRect(px, cy - 11 * s, pw, 22 * s, 11 * s); ctx.fillStyle = '#d8342a'; ctx.fill(); ctx.lineWidth = 1.5 * s; ctx.strokeStyle = 'rgba(60,10,4,0.85)'; ctx.stroke();
      ui.text(a, px + pw / 2, cy, { size: fs, align: 'center', color: '#fff', tag: 'intro:world' });
      drawCoin(ctx, px + pw + 8 * s + cr, cy, cr, 0);
      ui.text(b, px + pw + 8 * s + cr * 2 + 4 * s, cy, { size: fs, color: '#ffe27a', stroke: INK, tag: 'intro:hardpay' });
    }
  };
  // a cream sheet rising from the bottom edge: everything below the title sits on it (no card floating on the dark)
  const sheet = (x, y, w) => {
    const full = x <= A.x + 1 && x + w >= A.x1 - 1;
    const sx = full ? -8 * s : x, sw = full ? W_ + 16 * s : w;
    ui.frame(sx, y, sw, H_ - y + 40 * s, { s, r: 26 * s, shadow: false, plain: true });
  };

  // ---- the tabs, with a pulsing mark on the one that needs the player
  const TABH = 42 * s;
  const newChick = T.open.some((S) => !S.premium && S.unlock === L.id && G.li >= 0);
  const chickMark = T.need || newChick || (!early && locked.some((c) => c.canAfford));
  const tabs = (x, y, w) => {
    const cur = lvTab ? 'level' : 'chicks';
    ui.roundRect(x, y, w, TABH, TABH / 2); ctx.fillStyle = 'rgba(110,64,22,0.2)'; ctx.fill(); ctx.lineWidth = 1.5 * s; ctx.strokeStyle = 'rgba(110,64,22,0.35)'; ctx.stroke();
    const sw = (w - 8 * s) / 2;
    [['level', 'Level', (c, X, Y, S) => pictoTarget(c, X, Y, S * 0.9)], ['chicks', 'Chicks', T.id ? (c, X, Y, S) => pictoPower(c, T.id, X, Y, S * 1.05, G.t) : null]].forEach(([id, lab, icon], i) => {
      const on = cur === id, bx = x + 4 * s + i * sw;
      ui.button('itab:' + id, lab, bx, y + 4 * s, sw, TABH - 8 * s, { kind: on ? 'gold' : 'tertiary', size: 19 * s, icon: icon || undefined, round: (TABH - 8 * s) / 2 });
      if (id === 'chicks' && chickMark && !on) tabMark(bx + sw - 16 * s, y + TABH / 2 - 1 * s, 10 * s);
    });
  };

  // ---- the Level tab's pieces
  const perks = perkItems(s);
  const perkRows = (w) => { const rows = []; for (const p of [...perks].sort((a, b) => b.w - a.w)) { const r = rows.find((q) => q.reduce((a, o) => a + o.w + gp, 0) + p.w <= w); if (r) r.push(p); else rows.push([p]); } return rows; }; // the fewest rows: widest first, each into the first row it fits
  const perkBlock = (w) => { const R = perkRows(w); return !R.length ? null : { h: R.length * 34 * s + (R.length - 1) * 6 * s, gap: gp, draw: (x, y, ww) => {
    R.forEach((row, r) => { const tw = row.reduce((a, p) => a + Math.min(p.w, ww), 0) + (row.length - 1) * gp; let cx = x + (ww - tw) / 2; for (const p of row) { p.draw(cx, y + r * 40 * s, Math.min(p.w, ww)); cx += Math.min(p.w, ww) + gp; } });
  } }; };
  const goalRow = { h: 30 * s, gap: gp, draw: (x, y, w) => {
    const nE = L.eggs, tl = G.sim && G.sim.timeLimit, es = 24 * s, sp = 26 * s, fs = 18 * s, cy = y + 15 * s;
    const need = L.target === L.eggs ? `Bring all ${nE} home` : `Bring ${L.target} of ${nE} home`, ts = tl ? `${Math.round(tl)} s` : '';
    const nw = ui.measure(need, fs), tw = tl ? 26 * s + 6 * s + ui.measure(ts, fs) : 0, eggsW = nE * sp;
    const total = eggsW + 10 * s + nw + (tl ? 22 * s + tw : 0), sc = Math.min(1, w / total);
    let gx = x + w / 2 - (total * sc) / 2;
    for (let i = 0; i < nE; i++) { ctx.globalAlpha = i < L.target ? 1 : 0.38; drawEggIcon(ctx, gx + sp * sc * (i + 0.5), cy, es * sc, 'alive'); }
    ctx.globalAlpha = 1;
    ui.record({ x: gx, y: cy - es * sc / 2, w: eggsW * sc, h: es * sc }, 'intro:eggs');
    gx += (eggsW + 10 * s) * sc;
    ui.text(need, gx, cy, { size: fs * sc, color: C.ink, maxW: nw * sc + 4 * s, tag: 'intro:need' }); // (+4: a scaled size measures a hair wider; 0.8.17 "Bring 3 of 5 ho...")
    if (tl) { gx += (nw + 22 * s) * sc; pictoClock(ctx, gx + 13 * s * sc, cy, 24 * s * sc); ui.text(ts, gx + 32 * s * sc, cy, { size: fs * sc, color: C.warn, tag: 'intro:time' }); }
  } };
  // the caption under the stage: who or what it is (bold) and what to do (green); red while the harm plays
  const capOf = (p) => {
    if (!p) return { name: '', line: '' };
    if (p.teach) return { name: 'New: ' + ((STRIKE[p.power] || {}).name || 'Chick'), line: p.cap };
    if (p.move === 'rooster') return { name: 'Papa Rooster helps', line: p.cap, col: '#b8401e' };
    if (p.kind) { const I = VILLAIN_INFO[p.kind] || { name: p.kind }; return { name: I.name, line: p.cap, harm: threatWords(p.kind), col: I.group === 'boss' ? '#b3301c' : null }; }
    if (p.move === 'toy' || p.move === 'floor') return { name: (p.again ? '' : 'New: ') + p.name, line: p.cap, col: p.again ? null : '#2d7a1c' };
    return { name: p.name || '', line: p.cap || '' };
  };
  const capFs = 17 * s, nameFs = 19 * s;
  const capLines = (w) => Math.min(2, Math.max(1, ...plans.map((p) => { const c = capOf(p); return Math.max(wrapText(c.line || '', capFs, w - 8 * s).length, c.harm ? wrapText(c.harm, capFs, w - 8 * s).length : 1); })));
  const capBlock = (w) => { const nl = capLines(w), named = plans.some((p) => capOf(p).name); return { h: (named ? nameFs * 1.3 : 0) + nl * capFs * 1.22 + 2 * s, gap: 6 * s, draw: (x, y, ww) => {
    const c = capOf(plan), ho = G.howO || {};
    const harmNow = c.harm && !save.calm && (ho._phase === 'harm' || (!plan.harm && ho._pt < 1.6));
    let yy = y;
    if (named) { if (c.name) ui.text(c.name, x + ww / 2, yy + nameFs * 0.62, { size: nameFs, align: 'center', maxW: ww, color: c.col || C.ink, tag: 'intro:capname' }); yy += nameFs * 1.3; }
    const lines = wrapText(harmNow ? c.harm : c.line || '', capFs, ww - 8 * s).slice(0, nl);
    lines.forEach((l, i) => ui.text(l, x + ww / 2, yy + capFs * 0.62 + i * capFs * 1.22, { size: capFs, align: 'center', maxW: ww, color: harmNow ? '#b8321e' : '#2d6a1c', tag: 'intro:cap' + i }));
  } }; };
  const levelStage = (h) => ({ h, gap: gp, draw: (x, y, w) => {
    const ho = howOpts(); G.howO = ho;
    drawHowTo(ctx, plan, x, y, w, h, G.t - Hw.t0, ho);
    stageFrame(x, y, w, h);
    ui.record({ x, y, w, h }, 'intro:stage');
    if (nP > 1) ui.buttons.push({ id: 'how:next', x, y, w, h });
  } });
  // the tiles of what is on this level: one even grid; the one playing is green with a play mark; a tap plays it again
  // (a name too long for its tile takes two lines, never an ellipsis; the tiles then stand a little taller)
  const tiles = HT.tiles, tn = tiles.length, tCols = tn === 5 ? 5 : Math.min(tn, 4), /* (0.8.17: five in one row, not four and a lone one) */ tRows = tn ? Math.ceil(tn / tCols) : 0, tGap = 8 * s, tFs = 14 * s;
  const tileLines = (w) => { const cw = (w - (tCols - 1) * tGap) / tCols; return tiles.map((Ti) => (ui.measure(Ti.name, tFs) <= cw - 8 * s ? [Ti.name] : wrapText(Ti.name, tFs, cw - 8 * s).slice(0, 2))); };
  const tileBlock = (w0) => { const TL = tn ? tileLines(w0) : [], two = TL.some((l) => l.length > 1), tileH = (two ? 72 : 58) * s; return !tn ? (nP > 1 ? { h: 14 * s, gap: gp, draw: (x, y, w) => { for (let q = 0; q < nP; q++) { ctx.beginPath(); ctx.arc(x + w / 2 + (q - (nP - 1) / 2) * 16 * s, y + 7 * s, (q === Hw.i % nP ? 5 : 3.5) * s, 0, 7); ctx.fillStyle = q === Hw.i % nP ? '#3cb043' : 'rgba(120,80,30,0.35)'; ctx.fill(); } } } : null)
    : { h: tRows * tileH + (tRows - 1) * tGap, gap: gp, draw: (x, y, w) => {
      const cw = (w - (tCols - 1) * tGap) / tCols, fs = tFs, nl = two ? 2 : 1;
      tiles.forEach((Ti, k) => {
        const c = k % tCols, r = Math.floor(k / tCols), inRow = Math.min(tCols, tn - r * tCols), rx = x + c * (cw + tGap) + ((tCols - inRow) * (cw + tGap)) / 2, ry = y + r * (tileH + tGap), on = Ti.i === Hw.i % nP;
        ui.roundRect(rx, ry, cw, tileH, 12 * s); ctx.fillStyle = on ? '#5cbf3a' : 'rgba(122,80,40,0.10)'; ctx.fill();
        if (on) { const g = ctx.createLinearGradient(0, ry, 0, ry + tileH); g.addColorStop(0, 'rgba(255,255,255,0.28)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fill(); }
        ctx.lineWidth = (on ? 3 : 1.5) * s; ctx.strokeStyle = on ? '#2f7a1c' : Ti.boss ? 'rgba(160,30,40,0.55)' : 'rgba(122,80,40,0.35)'; ctx.stroke();
        const ar = Math.min(58 * s * 0.27, cw * 0.24), tl = TL[k], ty0 = ry + tileH - 6 * s - nl * fs * 1.12;
        ctx.save(); ctx.beginPath(); ctx.rect(rx + 2 * s, ry + 2 * s, cw - 4 * s, ty0 - ry - 2 * s); ctx.clip(); Ti.art(ctx, rx + cw / 2, ry + 4 * s + ar * 1.05, ar); ctx.restore();
        tl.forEach((l, j) => ui.text(l, rx + cw / 2, ty0 + (nl - tl.length) * fs * 0.56 + fs * 0.56 + j * fs * 1.12, { size: fs, align: 'center', color: on ? '#fff' : Ti.boss ? '#a01e28' : C.ink, stroke: on ? '#2a6a18' : null, strokeW: 3 * s, maxW: cw - 8 * s, tag: 'intro:tile' + k + ':' + j }));
        if (on) { // the "playing" mark: a white disc with a green play triangle, top left
          const mx = rx + 11 * s, my = ry + 11 * s, mr = 7.5 * s;
          ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
          ctx.beginPath(); ctx.moveTo(mx - mr * 0.3, my - mr * 0.45); ctx.lineTo(mx + mr * 0.5, my); ctx.lineTo(mx - mr * 0.3, my + mr * 0.45); ctx.closePath(); ctx.fillStyle = '#2f7a1c'; ctx.fill();
        }
        if (Ti.fresh && !on) { ctx.beginPath(); ctx.arc(rx + cw - 9 * s, ry + 9 * s, 5 * s, 0, 7); ctx.fillStyle = '#ff9f1c'; ctx.fill(); ctx.lineWidth = 1.5 * s; ctx.strokeStyle = '#fff'; ctx.stroke(); } // new on this card
        ui.buttons.push({ id: 'how:pick:' + Ti.i, x: rx, y: ry, w: cw, h: tileH });
      });
    } }; };
  // the reminder chips (what this level also holds, taught on an earlier card): every one whole, wrapped to more rows
  const chips = HT.chips, chH = 28 * s, chFs = 14 * s;
  const chipRows = (w) => { const ws = chips.map((c) => Math.min(w, chH + ui.measure(c.name, chFs) + 12 * s)), R = []; let cur = [], cw = 0; ws.forEach((cw0, i) => { if (cur.length && cw + gp * 0.75 + cw0 > w) { R.push(cur); cur = []; cw = 0; } cw += (cur.length ? gp * 0.75 : 0) + cw0; cur.push(i); }); if (cur.length) R.push(cur); return { R, ws }; };
  const chipBlock = (w) => { if (!chips.length) return null; const { R, ws } = chipRows(w); return { h: R.length * chH + (R.length - 1) * 6 * s, gap: gp, draw: (x, y, ww) => {
    R.forEach((row, r) => {
      const tw = row.reduce((a, i) => a + ws[i], 0) + (row.length - 1) * gp * 0.75; let cx = x + (ww - tw) / 2; const cy = y + r * (chH + 6 * s);
      for (const i of row) {
        const c = chips[i];
        ui.roundRect(cx, cy, ws[i], chH, chH / 2); ctx.fillStyle = c.fresh ? 'rgba(46,120,40,0.16)' : 'rgba(122,80,40,0.12)'; ctx.fill(); ctx.lineWidth = 1.5 * s; ctx.strokeStyle = c.fresh ? 'rgba(46,120,40,0.7)' : 'rgba(122,80,40,0.4)'; ctx.stroke();
        c.art(ctx, cx + chH / 2 + 1 * s, cy + chH / 2, chH * 0.36);
        ui.text(c.name, cx + chH + 2 * s, cy + chH / 2 + 0.5 * s, { size: chFs, color: c.fresh ? '#2d6a1c' : C.ink, maxW: ws[i] - chH - 8 * s, tag: 'intro:chip' + i });
        cx += ws[i] + gp * 0.75;
      }
    });
  } }; };
  // the three star goals, one compact row
  const starBlock = G.li >= 0 ? { h: 30 * s, gap: gp, draw: (x, y, w) => {
    const lab = (G.goals || GL.levelGoals(L, 1, G.li >= 0, save.mode)).map((g) => g.short), cw3 = w / 3, sr = 10.5 * s, fs = 15 * s;
    ctx.fillStyle = 'rgba(122,80,40,0.18)'; ctx.fillRect(x, y, w, 1.5 * s);
    for (let i = 0; i < 3; i++) {
      const tw = Math.min(ui.measure(lab[i], fs), cw3 - sr * 2 - 12 * s), gx = x + cw3 * i + (cw3 - (sr * 2 + 5 * s + tw)) / 2, cy = y + 17 * s;
      if (i) { ctx.fillStyle = 'rgba(122,80,40,0.16)'; ctx.fillRect(x + cw3 * i, y + 7 * s, 1.2 * s, 20 * s); }
      drawStar(ctx, gx + sr, cy, sr, true);
      ui.text(lab[i], gx + sr * 2 + 5 * s, cy, { size: fs, color: C.ink, maxW: tw + 1, tag: 'intro:star' + i });
    }
  } } : null;

  // ---- the Chicks tab's pieces: the carousel (snaps a chick to its middle) and that chick's power on a big stage
  const nI = items.length;
  const R = G.car || (G.car = { y: 0, v: 0, max: 0, t: G.t, lid: null });
  // 0.8.16 (mykee: "they are not center aligned ... a lot of empty space ... no left hand or right hand options"):
  // whole tiles across the row's full width (three; four on a phone on its side), never a cut one, never a blank side.
  // R.y is the chick in focus (the one the stage plays), in steps; the row shows the window around it: at the list's
  // start the focus is the left tile, at its end the right one. A round arrow at each end steps one chick.
  const NV = land ? 4 : 3;
  const carDims = (w) => { const gap = 10 * s, cw = (w - (NV - 1) * gap) / NV; return { cw, ch: Math.round(cw * (land ? 1.1 : 1.06)), gap, step: cw + gap }; };
  { const D = carDims(land ? rwL : iwP); R.step = D.step; R.max = Math.max(0, (nI - 1) * D.step);
    if (R.lid !== L.id + ':' + G.li) { // a new level: the picked chick is the one in focus
      R.lid = L.id + ':' + G.li; R.v = 0; R.to = null; R.pt = G.introPick ? G.introPick.t : 0; R.cb = G.chickBuy || null;
      R.y = Math.max(0, items.findIndex((it) => it.S.id === T.id)) * D.step;
    } }
  const carCenter = () => (nI ? clamp(Math.round(R.y / Math.max(1, R.step || 1)), 0, nI - 1) : 0);
  let handLater = null;
  const CTOP = 16 * s, CBOT = 16 * s; // room above for the raised tile and its tick; below for the dots
  const carBlock = (w0) => { const D = carDims(w0); return { h: D.ch + CTOP + CBOT, gap: gp, draw: (x, y, w) => {
    const { cw, ch, step, gap } = D, rowH = D.ch + CTOP + CBOT;
    if (G.introPick && G.introPick.t !== R.pt) { R.pt = G.introPick.t; const k = items.findIndex((it) => it.S.id === G.introPick.id); if (k >= 0) { R.v = 0; R.to = k * step; } } // a tapped chick takes the focus
    if ((G.chickBuy || null) !== R.cb) { R.cb = G.chickBuy || null; const k = items.findIndex((it) => it.S.id === R.cb); if (k >= 0) { R.v = 0; R.to = k * step; } } // so does a locked one
    glide(R);
    if (!(G.pdrag && (G.pdrag.sc === R || (G.pdrag.cand && G.pdrag.cand.x === R))) && R.to == null && Math.abs(R.v) < 260) { // snap: always a whole chick
      const k = clamp(Math.round(R.y / step), 0, nI - 1);
      if (Math.abs(R.y - k * step) > 0.5) { R.v = 0; R.to = k * step; } else R.y = k * step;
    }
    const nv = Math.min(nI, NV), rowW = nv * step - gap, wy = clamp(R.y - Math.floor((NV - 1) / 2) * step, 0, Math.max(0, (nI - NV) * step));
    const off = (w - rowW) / 2 - wy, V = { x, y, w, h: rowH }, ci = carCenter();
    G.carRect = V;
    const r0 = ui.rects.length, b0 = ui.buttons.length;
    const cy = y + CTOP, tl = [];
    const ns = Math.min(17 * s, cw / 7.2), ls = Math.min(13.5 * s, cw / 9);
    const lines = items.map(({ S }) => wrapText((POWER_WORDS[S.id] || [''])[0], ls, cw - 14 * s - ls * 2.2).slice(0, 1));
    const two = items.some(({ S }) => ui.measure(S.name, ns) > cw - 14 * s), textH = ns * 1.15 * (two ? 2 : 1) + 6 * s + ls * 1.2 + ls * 0.6 + 6 * s;
    // the arrows (the game's round back button): the left one from the second chick on, the right one until the last
    const az = 44 * s, ay = cy + 7 * s + (ch - 14 * s - textH) / 2 - az / 2, aL = nI > 1 && ci > 0 ? x - az * 0.37 : null, aR = nI > 1 && ci < nI - 1 ? x + w - az * 0.63 : null;
    ctx.save(); ctx.beginPath(); ctx.rect(x - 8 * s, y, w + 16 * s, rowH); ctx.clip();
    const Asel = (G.cardSel || (G.cardSel = {})), Afoc = (G.cardFoc || (G.cardFoc = {}));
    const ease = (M, id, want) => { const st = M[id] || (M[id] = { v: want, t: G.t }); const dt = Math.min(0.05, Math.max(0, G.t - st.t)); st.t = G.t; st.v += (want - st.v) * Math.min(1, dt * 14); return st.v; };
    const paint = (i) => {
      const { S, locked: LK } = items[i], rx = x + off + i * step;
      if (rx + cw < x - 12 * s || rx > x + w + 12 * s) return;
      const sel = ease(Asel, S.id, S.id === T.id ? 1 : 0), foc = ease(Afoc, S.id, i === ci ? 1 : 0);
      const pk = G.introPick && G.introPick.id === S.id ? G.introPick : null, bt = pk ? G.t - pk.t : 9;
      ctx.save(); ctx.globalAlpha *= 1 - (T.need ? 0.1 : 0.22) * (1 - foc); // the others step back a little
      chickCard(S, rx, cy, cw, ch, s, { sel, foc, lockR: rx + cw / 2 < x + w / 2 - 1, dim: false, locked: LK, tipGlow: !!(LK && G.introTip && G.introTip.id === S.id), need: T.need, i, acc: G.introAcc, wide: false, lines: lines[i], ls, ns, two, textH, ...pickJump(bt, !!LK, T) });
      ctx.restore();
      // (the tile's own tap area stops where an arrow sits over it)
      const x0 = Math.max(rx, aL != null ? aL + az + 2 * s : -1e9), x1 = Math.min(rx + cw, aR != null ? aR - 2 * s : 1e9);
      if (x1 - x0 < 12 * s) return;
      const rect = { x: x0, y: cy, w: x1 - x0, h: ch }, bid = LK ? 'stk:buy:' + S.id : 'stk:pick:' + S.id;
      ui.record(rect, 'btn:' + bid, 'btn:' + bid); ui.buttons.push({ id: bid, ...rect });
      tl.push({ id: S.id, locked: !!LK, x: rx, y: cy, w: cw, h: ch });
    };
    for (let i = 0; i < nI; i++) if (i !== ci) paint(i);
    if (nI) paint(ci); // the one in focus last: it is raised over its neighbours
    ctx.restore();
    clipRecorded(r0, b0, V);
    if (aL != null) ui.button('car:prev', '', aL, ay, az, az, { kind: 'hud', icon: ICON.left, iconS: 1.3, round: az / 2 });
    if (aR != null) ui.button('car:next', '', aR, ay, az, az, { kind: 'hud', icon: ICON.right, iconS: 1.3, round: az / 2 });
    handLater = () => pickHand(tl, T, V, s); // drawn last, over the row and the stage under it: the hand taps the card's bottom edge
    if (nI > 1) { // where you are: a dot per chick (the one in focus bright)
      for (let p = 0; p < nI; p++) { ctx.beginPath(); ctx.arc(x + w / 2 + (p - (nI - 1) / 2) * 13 * s, y + rowH - 6 * s, (p === ci ? 4 : 3) * s, 0, 7); ctx.fillStyle = p === ci ? '#c9842a' : 'rgba(120,80,30,0.3)'; ctx.fill(); }
    }
  } }; };
  // the chick in focus: its power playing (locked ones too), its name, upside and downside, and its way in
  const cS = nI ? items[carCenter()] : null;
  const chickStage = (h) => ({ h, gap: gp, draw: (x, y, w) => {
    if (!cS) return;
    const S = cS.S, Hc = G.howC || (G.howC = { id: null, t0: G.t });
    if (Hc.id !== S.id) { Hc.id = S.id; Hc.t0 = G.t; }
    const foe = kinds.find((k) => !/^(icicles|lava|lightning|embers|quake|rain|current|gusts|popthorns|vines|doors|curse|thornorb)$/.test(k)) || 'snake', fk = foe.replace(/^boss:/, '');
    drawHowTo(ctx, chickPlan(S.id, '', fk in VILLAIN_INFO ? fk : foe), x, y, w, h, G.t - Hc.t0, howOpts());
    stageFrame(x, y, w, h);
    ui.record({ x, y, w, h }, 'intro:chickstage');
    if (cS.locked) { // a small lock ribbon across the top left corner (part of the stage's picture, no words to read)
      ctx.save(); ui.roundRect(x, y, w, h, Math.min(18 * s, h * 0.08)); ctx.clip();
      ctx.translate(x + 30 * s, y + 30 * s); ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = '#25355c'; ctx.fillRect(-70 * s, -13 * s, 140 * s, 26 * s); ctx.fillStyle = 'rgba(255,226,122,0.9)'; ctx.fillRect(-70 * s, -13 * s, 140 * s, 2 * s); ctx.fillRect(-70 * s, 11 * s, 140 * s, 2 * s);
      ctx.rotate(Math.PI / 4); const lz = 15 * s;
      ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = lz * 0.16; ctx.beginPath(); ctx.arc(0, -lz * 0.12, lz * 0.26, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = '#ffd24a'; ui.roundRect(-lz * 0.4, -lz * 0.14, lz * 0.8, lz * 0.6, lz * 0.1); ctx.fill();
      ctx.restore();
    }
  } });
  const chFsN = 20 * s, chFsU = 16 * s, chFsD = 15 * s, wayH = 38 * s;
  // one upside line and one downside line (the longer wordings step down to a shorter one, never cut or wrapped)
  const oneLine = (alts, fs, w) => alts.find((q) => q && ui.measure(q, fs) <= w) || alts[alts.length - 1];
  const upOf = (S, w) => oneLine([S.up, shortTip(S.up), (POWER_WORDS[S.id] || [''])[0]], chFsU, w);
  const dnOf = (S, w) => oneLine([S.down && 'Downside: ' + S.down, S.down && 'Downside: ' + shortTip(S.down), 'Downside: ' + (POWER_WORDS[S.id] || ['', ''])[1]], chFsD, w);
  // 0.8.17: the name, its one line and its way in; the downside line only when the column has room to spare (dn)
  const chickCap = (w, dn = true) => {
    return { h: chFsN * 1.2 + chFsU * 1.22 + 3 * s + (dn ? chFsD * 1.22 : 0) + 5 * s + wayH, gap: 6 * s, draw: (x, y, ww) => {
      if (!cS) return;
      const S = cS.S, LK = cS.locked;
      let yy = y;
      ui.text(S.name, x + ww / 2, yy + chFsN * 0.62, { size: chFsN, align: 'center', maxW: ww, color: S.col ? ui.tint(S.col[1], -0.3) : C.ink, tag: 'intro:pickname' }); yy += chFsN * 1.2;
      ui.text(upOf(S, ww - 8 * s), x + ww / 2, yy + chFsU * 0.62, { size: chFsU, align: 'center', maxW: ww, color: C.ink, tag: 'intro:pickup' }); yy += chFsU * 1.22 + 3 * s;
      if (dn) ui.text(dnOf(S, ww - 8 * s), x + ww / 2, yy + chFsD * 0.62, { size: chFsD, align: 'center', maxW: ww, color: C.warn, tag: 'intro:pickdn' });
      const wy = y + chFsN * 1.2 + chFsU * 1.22 + 3 * s + (dn ? chFsD * 1.22 : 0) + 5 * s, cy = wy + wayH / 2;
      if (LK) { // its way in: free at a later level (or a premium one), and unlocking it now for coins (the same sheet as today)
        const tip = G.introTip && G.introTip.id === S.id ? shortTip(G.introTip.line) || G.introTip.line : '';
        const free = tip || (S.premium ? 'A premium chick' : `Free at level ${S.unlock}`), buy = !early;
        const bw = buy ? Math.min(ww * 0.5, ui.measure(`Unlock ${LK.price}`, 18 * s) + 64 * s) : 0, fw = ww - bw - (buy ? 10 * s : 0);
        const fl = wrapText(free, 15 * s, fw - 30 * s).slice(0, 2), fx = x + (buy ? 0 : (ww - Math.min(fw, ui.measure(fl[0] || '', 15 * s) + 28 * s)) / 2);
        // a small padlock, then the words
        const lz = 18 * s, lx = fx + lz * 0.55; ctx.strokeStyle = '#7a5a30'; ctx.lineWidth = lz * 0.14; ctx.beginPath(); ctx.arc(lx, cy - lz * 0.12, lz * 0.24, Math.PI, 0); ctx.stroke(); ctx.fillStyle = '#9a7038'; ui.roundRect(lx - lz * 0.36, cy - lz * 0.14, lz * 0.72, lz * 0.56, lz * 0.1); ctx.fill();
        fl.forEach((l, i) => ui.text(l, fx + lz * 1.25, cy + (i - (fl.length - 1) / 2) * 17 * s, { size: 15 * s, color: tip ? '#1f5fa8' : C.ink2, maxW: fw - lz * 1.3, tag: 'intro:way' + i }));
        if (buy) ui.button('stk:buy:' + S.id, `Unlock ${LK.price}`, x + ww - bw, wy, bw, wayH, { kind: LK.canAfford ? 'primary' : 'secondary', icon: (c, X, Y, Z) => drawCoin(c, X, Y, Z * 0.5, G.t), size: 18 * s });
      } else if (S.id === T.id) { // the one coming along: a green pill with a check
        const str = 'Your chick for this level', pw = Math.min(ww, ui.measure(str, 16 * s) + 50 * s), px = x + ww / 2 - pw / 2, ph = 34 * s, py = cy - ph / 2;
        ui.roundRect(px, py, pw, ph, ph / 2); ctx.fillStyle = '#4cae2e'; ctx.fill(); ctx.lineWidth = 2 * s; ctx.strokeStyle = '#2f7a1c'; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px + 14 * s, py + ph * 0.52); ctx.lineTo(px + 20 * s, py + ph * 0.72); ctx.lineTo(px + 31 * s, py + ph * 0.3); ctx.lineWidth = 3.5 * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#fff'; ctx.stroke();
        ui.text(str, px + 38 * s, cy, { size: 16 * s, color: '#fff', maxW: pw - 46 * s, tag: 'intro:yours' });
      } else { // one to take: say how (the tile is the button; the hand shows it while a pick is owed)
        const str = T.need ? 'Tap its card to take it along' : 'Tap its card to take it instead';
        ui.text(str, x + ww / 2, cy, { size: 16 * s, align: 'center', maxW: ww, color: T.need ? '#b8401e' : C.ink2, tag: 'intro:taketip' });
      }
    } };
  };

  // ---- the bottom: the big button, the boosters strip right above it, and the ring speed strip above that
  // 0.8.16: the booster tiles run from PLAY's left edge to its right one. On a tall phone six fill the width; on a
  // short one they keep their size and the room between them grows (drawBoosterStrip spreads a full row)
  const BTN = 56 * s, BC0 = 49 * s, bcFull = Math.min((iwP - 5 * 8 * s) / 6, 72 * s);
  const STRIP = 19 * s + (land ? BC0 : Math.max(BC0, BC0 + (bcFull - BC0) * clamp((A.h / s - 640) / 160, 0, 1)));
  const bigButton = (x, y, w) => {
    if (lvTab) ui.button(hasCh ? 'inext' : 'go', hasCh ? 'NEXT' : 'PLAY', x, y, w, BTN, { kind: 'primary', shimmer: true, icon: hasCh ? ICON.next : ICON.play, size: 27 * s });
    else ui.button('go', T.need ? 'PICK A CHICK' : 'PLAY', x, y, w, BTN, T.need ? { kind: 'off', size: 24 * s } : { kind: 'primary', shimmer: true, icon: ICON.play, size: 27 * s }); // need: the button says what is missing (it still takes the tap and nudges)
  };
  const adOn = showBoost && !G.adBoost && !G.golden;
  const boostState = () => ({ wallet: G.golden ? { ...save.wallet, owned: { ...save.wallet.owned, golden: 0 } } : save.wallet, hide: G.golden ? ['golden'] : [], selected: G.boostSel, lastTapped: G.boostLast, t: G.t,
    ad: adOn ? AD_BOOST[Math.abs(L.id) % AD_BOOST.length] : null, mark: null, attn: stripAttn(L), s, scroll: G.boostPg && G.boostPg.lid === L.id ? G.boostPg : (G.boostPg = { lid: L.id, k: 0 }), ...boostUse(L), teach: boostTeach(L) });
  // 0.8.17 (mykee: "an even more blinking effect so that the user will be able to point it out"): the strip blinks its rim
  // twice every 2.4 s and a shine runs over it (ui/store.js stripAttn), with a tapping hand on the first three level
  // cards of a session; once the player has touched the strip on this level it rests there for good. Calm: a steady rim.
  if (G.stripLid !== pg.lid) { G.stripLid = pg.lid; G.stripVisits = (G.stripVisits || 0) + (showBoost ? 1 : 0); }
  const stripAttn = (Lv) => (G.li < 0 || (save.seen || {})['strip:' + Lv.id] ? null : { calm: !!save.calm, pointer: G.stripVisits <= 3 ? (px, py, c, t) => { const q = save.calm ? 0.5 : (t % 1.1) / 1.1, down = q > 0.45 && q < 0.7; teachHand(ctx, px, py + (save.calm ? 0 : -Math.abs(Math.sin(q * Math.PI)) * c * 0.14), Math.min(c * 0.62, 40 * s), down, 1); } : null });
  const bottom = (x, w, mb = 6 * s) => { // draws from the bottom of the safe rect up (mb above its edge); returns the top of what it drew
    let y = A.y1 - mb - BTN;
    bigButton(x, y, w);
    if (showBoost) { y -= gp + STRIP; drawBoosterStrip(ui, ctx, x, y, w, STRIP, boostState()); }
    const rh = ringStripH(x, w, s);
    if (rh > 0) { y -= gp + rh; ringSpeedStrip(x, y, w, s); }
    return y;
  };

  // fits blocks and one stretchy stage into the height V.h: the stage takes what is left (within lo..hi); any room
  // beyond hi is shared out as air between the blocks; below lo the column scrolls (pageScroll adds 6 + 18 px)
  const fitCol = (pre, mk, post, Vh, lo, hi) => {
    const fixed = pageColH([...pre, ...post], s) + 6 * s + gp;
    let h = clamp(Vh - fixed, lo, hi);
    const left = Vh - fixed - h, B = [...pre, mk(h), ...post].filter(Boolean);
    if (left > 0.5 * s) { const n = B.length + 1, add = Math.min(left / n, 40 * s); for (const b of B) b.gap = (b.gap ?? 10 * s) + add; }
    return B;
  };

  const column = (B, S, V, x, w) => {
    if (pageColH(B, s) + 6 * s > V.h + 0.5) { pageScroll(B, S, V, x, w, s, true); return; }
    S.y = 0; S.v = 0; S.max = 0; G.ipAnchor = {};
    let y = V.y; for (const b of B) { y += b.gap ?? 10 * s; b.draw(x, y, w); y += b.h; }
  };
  // 0.8.17 (mykee 2026-11-26: "the top section of the level card is too empty ... and the level card feels congested
  // because of it"): the stage used to take every spare pixel (its top half only sky) while the blocks under it sat
  // 6 px apart. Portrait now lays the sheet as one column from the tabs down to PLAY with ONE gap between every block
  // (under PLAY too): the stage takes what is left up to 0.9 of its width (past that a stage only adds sky; its art is
  // sized by the width), the room left is shared out as the gap, and past a calm gap the stage grows again. The goal
  // and the timer sit in one band. A page too short for even gaps keeps the scrolling column below (false).
  const goalBand = { h: 40 * s, draw: (x, y, w) => {
    ui.roundRect(x, y, w, 40 * s, 20 * s); ctx.fillStyle = 'rgba(122,80,40,0.10)'; ctx.fill(); ctx.lineWidth = 1.5 * s; ctx.strokeStyle = 'rgba(122,80,40,0.28)'; ctx.stroke();
    goalRow.draw(x + 12 * s, y + 5 * s, w - 24 * s);
  } };
  const evenPortrait = (x0, yT, iw) => {
    const tight = 6 * s, STG = { stage: true, h: 0 };
    const lay = (dn) => {
      const it = [];
      if (hasCh) it.push({ h: TABH, first: true, draw: (x, y, w) => tabs(x, y, w) });
      if (lvTab) { const pk = perkBlock(iw); if (pk) it.push(pk); it.push(goalBand, STG, { ...capBlock(iw), tight: true }); for (const b of [tileBlock(iw), chipBlock(iw), starBlock]) if (b) it.push(b); }
      else it.push(STG, { ...chickCap(iw, dn), tight: true }, carBlock(iw));
      const rh = ringStripH(x0, iw, s);
      if (rh > 0) it.push({ h: rh, draw: (x, y, w) => ringSpeedStrip(x, y, w, s) });
      if (showBoost) it.push({ h: STRIP, draw: (x, y, w) => drawBoosterStrip(ui, ctx, x, y, w, STRIP, boostState()) });
      it.push({ h: BTN, draw: (x, y, w) => bigButton(x, y, w) });
      const F = it.reduce((a, b) => a + b.h + (b.tight ? tight : 0), 0), n = it.filter((b) => !b.tight && !b.first).length + 1;
      const avail = A.y1 - yT - F, lo = lvTab ? Math.min(165 * s, iw * 0.5) : Math.min(150 * s, iw * 0.45), hi1 = iw * 0.9, hi2 = Math.min(iw * (lvTab ? 1.2 : 1.05), 560 * s);
      let st = clamp(avail - n * 14 * s, lo, hi1), G0 = (avail - st) / n;
      if (G0 > 28 * s) { st = Math.max(st, Math.min(hi2, avail - n * 28 * s)); G0 = (avail - st) / n; }
      return { it, st, G0, ok: G0 >= 10 * s };
    };
    let P = lay(true);
    if (!lvTab && P.st < iw * 0.7) { const P2 = lay(false); if (P2.ok) P = P2; } // the downside line rides along while the stage keeps (nearly) its full size
    if (!P.ok || (!lvTab && !nI)) return false;
    const V = { x: A.x, y: yT, w: A.w, h: A.y1 - yT };
    G.ipRect = V; G.ipRectR = null; pg.y = 0; pg.v = 0; pg.max = 0; G.ipAnchor = {};
    let y = yT;
    for (const b of P.it) {
      if (!b.first) y += b.tight ? tight : P.G0;
      if (b.stage) { (lvTab ? levelStage(P.st) : chickStage(P.st)).draw(x0, y, iw); y += P.st; } else { b.draw(x0, y, iw); y += b.h; }
    }
    return true;
  };
  const k = ui.pop(G.screenT, 0.32);
  ctx.save();
  if (k !== 1) { ctx.translate(A.cx, A.cy); ctx.scale(k, k); ctx.translate(-A.cx, -A.cy); }
  if (!land) {
    const iw = iwP, x0 = A.cx - iw / 2;
    let y = A.y + 4 * s;
    header(x0, y, iw); y += HDR + 3 * s;
    nameBlock(x0, y, iw); y += nameH + 6 * s;
    sheet(Math.max(A.x, x0 - pad), y, Math.min(A.w, iw + 2 * pad));
    y += 10 * s;
    if (evenPortrait(x0, y, iw)) { if (handLater) handLater(); ctx.restore(); return; }
    if (hasCh) { tabs(x0, y, iw); y += TABH + 2 * s; }
    const yb = bottom(x0, iw);
    const V = { x: A.x, y, w: A.w, h: yb - y };
    G.ipRect = V; G.ipRectR = null;
    const pre = [], post = [];
    let B;
    if (lvTab) {
      const pk = perkBlock(iw); if (pk) pre.push(pk);
      pre.push(goalRow);
      post.push(capBlock(iw), ...[tileBlock(iw), chipBlock(iw), starBlock].filter(Boolean));
      B = fitCol(pre, levelStage, post, V.h, Math.min(165 * s, iw * 0.5), Math.min(iw * 1.1, 560 * s)); // (0.8.16: a page with little else grows its picture, nearly square, as the level's own card does)
    } else {
      // 0.8.17 (mykee: the chick row where the thumb is): the demo on top, as big as the column allows, then the chosen chick's
      // name and line, then the row of chicks in the lower third just above the boosters and the main button
      const hiS = Math.min(iw * 0.95, 560 * s), loS = Math.min(150 * s, iw * 0.45), carB = carBlock(iw);
      const dnOn = V.h - (pageColH([chickCap(iw, true), carB], s) + 6 * s + gp) >= Math.min(hiS, iw * 0.8); // the downside line rides along when the stage still gets (nearly) its full size
      post.push(chickCap(iw, dnOn), carB);
      B = fitCol(pre, chickStage, post, V.h, loS, hiS);
    }
    if (B.length) B[0] = { ...B[0], gap: B[0].gap - gp };
    column(B, pg, V, x0, iw);
  } else {
    // a phone on its side: the header across the top; the stage and its caption on the left; the tabs, the tab's
    // tiles or the carousel, the boosters strip and the big button on the right
    const x0 = A.cx - W0 / 2, lw = lwL, rw = rwL, lx = x0, rx = x0 + lw + gap2;
    let y = A.y + 6 * s;
    const hd = header(x0, y, W0);
    // the level's name and world ride in the header line, over the left column, when they fit between back and the ribbon
    const ncx = lx + lw / 2, nMax = 2 * Math.min(ncx - (x0 + HDR + 10 * s), hd.ribL - 10 * s - ncx);
    const nameUp = nMax > 0 && ui.measure(L.name, 22 * s) <= nMax && ui.measure(world, 13 * s) <= nMax;
    if (nameUp) {
      ui.text(L.name, ncx, y + (world ? 13 : 22) * s, { size: 22 * s, align: 'center', maxW: nMax, color: '#fff', stroke: INK, shadow: 'rgba(0,0,0,0.35)', tag: 'intro:name' });
      if (world) ui.text(world, ncx, y + 35 * s, { size: 13 * s, align: 'center', maxW: nMax, color: '#ffe27a', stroke: INK, tag: 'intro:world' });
    }
    y += HDR + 8 * s;
    sheet(A.w <= W0 + 2 * pad + 1 ? A.x : x0 - pad, y, A.w <= W0 + 2 * pad + 1 ? A.w : W0 + 2 * pad);
    y += 12 * s;
    // left: the name, then the stage (the level's scene, or the middle chick's power) and its caption
    const V = { x: A.x, y, w: lx + lw + gap2 / 2 - A.x, h: A.y1 - 10 * s - y }; // (0.8.17: its foot level with the big button's, 10 px over the edge)
    G.ipRect = V;
    const nmB = { h: nameH, gap: 0, draw: (x, yy, w) => { // the name on the cream: brown ink
      ui.text(L.name, x + w / 2, yy + 15 * s, { size: 25 * s, align: 'center', maxW: w, color: C.ink, tag: 'intro:name' });
      if (world) ui.text(world, x + w / 2, yy + 31 * s + 9 * s, { size: 15 * s, align: 'center', maxW: w, color: '#b0700a', tag: 'intro:world' });
    } };
    const top = nameUp ? [] : [nmB];
    // right: the tabs on top, the boosters and the big button at the bottom, the tab's content between (it scrolls when short)
    // 0.8.17 (mykee: "too much empty UI space" on a phone on its side): the Level tab's blocks spread over the whole column
    // with one even gap (they used to stop 20 px apart over a dead band above the boosters); while there is room the star
    // goals, then the goal band, move over from the left, and the stage there grows into the height they leave
    let ry = y;
    if (hasCh) { tabs(rx, ry, rw); ry += TABH + 4 * s; }
    const yb = bottom(rx, rw, 10 * s) - 4 * s;
    const pr = G.ipageR || (G.ipageR = { y: 0, v: 0, max: 0, t: G.t, lid: null });
    if (pr.lid !== pg.lid + ':' + (lvTab ? 0 : 1)) { pr.lid = pg.lid + ':' + (lvTab ? 0 : 1); pr.y = 0; pr.v = 0; }
    G.ipRectR = { x: rx - gap2 / 2, y: ry, w: A.x1 - (rx - gap2 / 2), h: yb - ry };
    const RB = (lvTab ? [perkBlock(rw), tileBlock(rw), chipBlock(rw)] : [carBlock(rw)]).filter(Boolean);
    const fitsR = (list) => G.ipRectR.h - 6 * s - list.reduce((a, b) => a + b.h, 0) >= (list.length + 1) * 12 * s;
    let goalR = false, starR = false;
    if (lvTab && starBlock && fitsR([...RB, starBlock])) { RB.push(starBlock); starR = true; }
    if (lvTab && fitsR([goalBand, ...RB])) { RB.unshift(goalBand); goalR = true; }
    const B = lvTab ? fitCol([...top, ...(goalR ? [] : [goalRow])], levelStage, [capBlock(lw), starR ? null : starBlock].filter(Boolean), V.h, 150 * s, lw * 0.75) : fitCol(top, chickStage, [chickCap(lw)], V.h, 130 * s, lw * 0.75);
    B[0] = { ...B[0], gap: 0 };
    column(B, pg, V, lx, lw);
    const room = G.ipRectR.h - pageColH(RB.map((b) => ({ ...b, gap: 0 })), s) - 6 * s;
    if (room > 0 && RB.length && lvTab) { const add = room / (RB.length + 1); RB.forEach((b, i) => { RB[i] = { ...b, gap: add }; }); }
    else {
      if (room > 0 && RB.length) RB[0] = { ...RB[0], gap: (RB[0].gap ?? 10 * s) + room }; // the chick row rides low, just above the boosters (0.8.17: the thumb)
      if (RB.length) RB[0] = { ...RB[0], gap: RB[0].gap - gp };
    }
    column(RB, pr, G.ipRectR, rx, rw);
  }
  if (handLater) handLater();
  ctx.restore();
}
// the level card's perks row (0.8.14: off the stage, mykee: "there shouldn't be overlapping text"). Each chip is 34 units
// tall, drawn from its top-left corner within maxW; dry: only measure. Each returns its width (0: nothing to show).
// a taste running (egg skin, hen outfit or chick on free try): its art, its name, the levels left
function tryChip(x, y, maxW, s, dry) {
  if (G.li < 0) return 0;
  const R = DR.trials(save), k = R.skin ? 'skin' : R.hen ? 'hen' : R.chick ? 'chick' : null;
  if (!k) return 0;
  const q = R[k], T = { kind: k, id: q.id, name: k === 'skin' ? (E.SKINS[q.id] || {}).name || q.id : k === 'hen' ? (E.HEN_SKINS[q.id] || {}).name || q.id : (STRIKE[q.id] || {}).name || q.id };
  const h = 34 * s, fs = 14 * s, lv = `${q.left} ${q.left === 1 ? 'level' : 'levels'}`;
  let str = `Free try: ${tasteName(T)}, ${lv} left`;
  for (const alt of [`Free try: ${tasteName(T)}, ${lv}`, `${tasteName(T)}: free, ${lv}`]) if (h + ui.measure(str, fs) + 14 * s > maxW) str = alt; // a long name: a shorter form, never cut
  const w = Math.min(maxW, h + ui.measure(str, fs) + 14 * s);
  if (dry) return w;
  ui.roundRect(x, y, w, h, h / 2); ctx.fillStyle = 'rgba(30,70,130,0.92)'; ctx.fill(); ctx.lineWidth = 1.5 * s; ctx.strokeStyle = 'rgba(200,230,255,0.9)'; ctx.stroke();
  tasteArt(T, x + h / 2 + 2 * s, y + h / 2, h * 0.8, false);
  ui.text(str, x + h + 4 * s, y + h / 2, { size: fs, color: '#fff', maxW: w - h - 12 * s, noRecord: true });
  ui.record({ x, y, w, h }, 'intro:try');
  return w;
}
// the equipped egg's power: its icon and at most four words
function perkChipCard(x, y, maxW, s, dry) {
  const P = eggPerk();
  if (!P) return 0;
  const h = 34 * s, fs = 14 * s, str = P.line;
  const w = Math.min(maxW, h + ui.measure(str, fs) + 14 * s);
  if (dry) return w;
  ui.roundRect(x, y, w, h, h / 2); ctx.fillStyle = 'rgba(70,40,110,0.92)'; ctx.fill();
  ctx.lineWidth = 1.5 * s; ctx.strokeStyle = 'rgba(226,206,255,0.9)'; ctx.stroke();
  pictoPerk(ctx, P.icon, x + h / 2 + 2 * s, y + h / 2, h * 0.76, G.t);
  ui.text(str, x + h + 2 * s, y + h / 2, { size: fs, color: '#fff', maxW: w - h - 10 * s, noRecord: true });
  ui.record({ x, y, w, h }, 'intro:perk');
  return w;
}
// Midas (the Golden egg's power): three little gold glints breathing over the coins on the win card
function goldGlints(x, y, s) {
  ctx.save(); ctx.fillStyle = '#fff3a0';
  for (const [dx, dy, ph] of [[-7, -11, 0], [32, 9, 2.1], [13, -13, 4.2]]) {
    const R = 4.5 * s * (0.5 + 0.5 * Math.sin(G.t * 3 + ph)), cx = x + dx * s, cy = y + dy * s;
    ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.quadraticCurveTo(cx, cy, cx + R, cy); ctx.quadraticCurveTo(cx, cy, cx, cy + R); ctx.quadraticCurveTo(cx, cy, cx - R, cy); ctx.quadraticCurveTo(cx, cy, cx, cy - R); ctx.fill();
  }
  ctx.restore();
}
// the win streak: a flame with the count and the free boosters it brings to this level
function hotBadge(x, y, maxW, s, dry) {
  const hb = G.li >= 0 ? DR.hotBoosts(save) : [];
  if (!hb.length) return 0;
  const n = `${DR.hotCount(save)} wins`, ih = 26 * s, nw = ui.measure(n, 15 * s), fw = ui.measure('Free', 14 * s) + 8 * s, w = 12 * s + 22 * s + nw + 8 * s + fw + hb.length * (ih + 2 * s) + 8 * s;
  if (dry) return w;
  const p = save.calm ? 0 : 0.5 + 0.5 * Math.sin(G.t * 3), cy = y + 17 * s;
  ui.roundRect(x, y, w, 34 * s, 17 * s); ctx.fillStyle = 'rgba(150,40,10,0.92)'; ctx.fill();
  ctx.lineWidth = 2 * s; ctx.strokeStyle = `rgba(255,${200 + 40 * p | 0},120,0.9)`; ctx.stroke();
  streakFlame(ctx, 'hot:card', x + 6 * s + 11 * s, cy + 1 * s, 25 * s, DR.hotCount(save), G.t, save.calm);
  ui.text(n, x + 30 * s, cy, { size: 15 * s, color: '#fff', noRecord: true });
  ui.text('Free', x + 30 * s + nw + 8 * s, cy, { size: 14 * s, color: '#ffe066', noRecord: true }); // the boosters cost nothing: say so
  hb.forEach((b, i) => drawBoosterIcon(ctx, b, x + 30 * s + nw + 8 * s + fw + i * (ih + 2 * s) + ih / 2, cy, ih * 0.92, G.t));
  ui.record({ x, y, w, h: 34 * s }, 'intro:hot');
  return w;
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
// 0.8.14 (mykee: "not properly aligned ... not properly shown with definite icons ... a different kind of color coding
// for this pause menu ... for different buttons"): equal tiles, each its own colour, the icon and the label INSIDE the
// tile; a short last row is centred. items: [id, label, icon, face (a kind name or a palette), mark?]
function pauseTiles(items, s, cols = 3) {
  const gap = 10 * s, th = (cols > 3 ? 66 : 78) * s, rows = Math.ceil(items.length / cols);
  return { h: rows * th + (rows - 1) * gap, gap: 12 * s, draw: (x, y, w) => {
    items.forEach(([id, label, icon, face, mark], i) => {
      // 0.8.16: a short last row spans the column too (same left and right edges as the row above)
      const r = Math.floor(i / cols), c = i % cols, inRow = Math.min(cols, items.length - r * cols), tw = (w - gap * (inRow - 1)) / inRow;
      const bx = x + c * (tw + gap), by = y + r * (th + gap);
      const B = ui.button(id, '', bx, by, tw, th, { ...(typeof face === 'string' ? { kind: face } : { face }), round: 18 * s });
      const isz = (cols > 3 ? 28 : 32) * s, ls = (cols > 3 ? 14.5 : 16) * s, cy = B.cy;
      icon(ctx, bx + tw / 2, cy - ls * 0.62 - 2 * s, isz);
      ui.text(label, bx + tw / 2, cy + isz * 0.5 + 4 * s, { size: ls, align: 'center', color: '#fff', stroke: 'rgba(30,14,4,0.55)', strokeW: 3 * s, maxW: tw - 10 * s, tag: 'pause:lbl:' + id, group: 'btn:' + id });
      if (mark) mark(bx, by, tw, th);
    });
  } };
}
// a lamp (the pause page's hint)
function lampIcon(c, x, y, S) {
  c.save(); c.lineJoin = 'round';
  const r = S * 0.3, gy = y - S * 0.08;
  c.beginPath(); c.arc(x, gy, r, Math.PI * 0.78, Math.PI * 2.22); c.lineTo(x + r * 0.42, gy + r * 1.25); c.lineTo(x - r * 0.42, gy + r * 1.25); c.closePath();
  c.fillStyle = '#ffe066'; c.fill(); c.lineWidth = Math.max(1.5, S * 0.06); c.strokeStyle = '#7a4a08'; c.stroke();
  c.fillStyle = '#fff'; c.globalAlpha = 0.7; c.beginPath(); c.ellipse(x - r * 0.35, gy - r * 0.3, r * 0.16, r * 0.3, 0.5, 0, 7); c.fill(); c.globalAlpha = 1;
  c.fillStyle = '#8a8f9a'; c.fillRect(x - r * 0.45, gy + r * 1.28, r * 0.9, r * 0.22); c.fillRect(x - r * 0.38, gy + r * 1.55, r * 0.76, r * 0.2);
  c.strokeRect(x - r * 0.45, gy + r * 1.28, r * 0.9, r * 0.22);
  c.restore();
}
// the pause page's SHOP banner: gold, the coin total, three things the player does not own yet (what the coins reach
// first), the mark when the coins reach something new, and one line when something can be had now. Tap: the shop on it.
function pauseShop(s) {
  const H = 96 * s;
  return { h: H, gap: 12 * s, draw: (x, y, w) => {
    const M = shopMarkNow(), coins = save.wallet.coins;
    const B = ui.button('shop', '', x, y, w, H, { kind: 'gold', shimmer: true, shimmerOff: 60, round: 20 * s });
    const fy = B.cy - (H - 6 * s) / 2, top = fy + 34 * s, grp = 'btn:shop';
    // three pictures: not owned, the ones the coins reach first (dearest of those), then the nearest ones beyond
    const own = markItems().filter((i) => !i.owned && (i.kind === 'skin' || i.kind === 'hen'));
    const can = own.filter((i) => i.price <= coins).sort((a, b) => b.price - a.price), far = own.filter((i) => i.price > coins).sort((a, b) => a.price - b.price);
    const pics = (M.pick && (M.pick.kind === 'skin' || M.pick.kind === 'hen') ? [own.find((i) => i.key === M.pick.key)] : []).concat(can, far).filter((v, i, a) => v && a.findIndex((q) => q.key === v.key) === i).slice(0, 3);
    const pw = Math.min(54 * s, (w * 0.46) / 3), px0 = x + w - 12 * s - pics.length * pw;
    pics.forEach((it, i) => {
      const cx = px0 + (i + 0.5) * pw;
      ctx.beginPath(); ctx.arc(cx, top, pw * 0.46, 0, 7); ctx.fillStyle = it.price <= coins ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.28)'; ctx.fill();
      markArt(it.key, cx, top + 1 * s, pw * 0.82);
    });
    ui.record({ x: px0, y: top - pw * 0.46, w: pics.length * pw, h: pw * 0.92 }, 'pause:shoppics', grp);
    shopIcon(ctx, x + 32 * s, top, 34 * s);
    ui.text('Shop', x + 56 * s, top - 8 * s, { size: 25 * s, color: '#fff', stroke: '#8a4a04', strokeW: 4 * s, maxW: px0 - x - 66 * s, tag: 'pause:shop', group: grp });
    ui.text(String(purse.shown()), x + 57 * s, top + 15 * s, { size: 16 * s, color: '#fff8e0', stroke: '#8a4a04', strokeW: 3 * s, maxW: px0 - x - 66 * s, tag: 'pause:coins', group: grp });
    // one short line when the coins reach something
    if (M.pick) {
      const t = `You can get the ${markName(M.pick.key)}`, ly = fy + H - 6 * s - 18 * s;
      ui.roundRect(x + 10 * s, ly - 12 * s, w - 20 * s, 24 * s, 12 * s); ctx.fillStyle = 'rgba(120,60,0,0.28)'; ctx.fill();
      ui.text(t, x + w / 2, ly, { size: 14.5 * s, align: 'center', color: '#fff', stroke: 'rgba(90,40,0,0.7)', strokeW: 2.5 * s, maxW: w - 36 * s, tag: 'pause:shopline', group: grp });
    } else ui.text('New eggs and outfits', x + w / 2, fy + H - 6 * s - 18 * s, { size: 14.5 * s, align: 'center', color: '#fff', stroke: 'rgba(90,40,0,0.7)', strokeW: 2.5 * s, maxW: w - 36 * s, tag: 'pause:shopline', group: grp });
    if (M.on) markBadge(x + w - 8 * s, y + 6 * s, 12 * s, G.t);
  } };
}
// 0.8.7 (mykee: "the info on the pause page should be an animation, not text"): each villain of this level as its
// own little cartoon (the level card's stage: the villain's game rig, the move that beats it), one line under it
function foeStage(kd, i, s, iw) {
  const C = ui.C, stH = Math.min((iw - 24 * s) * 0.58, 220 * s), plan = howToPlan(kd), I = VILLAIN_INFO[kd] || { name: kd }, H = 12 * s + stH + 36 * s;
  return { h: H, gap: 10 * s, draw: (x, y, w) => {
    ui.well(x, y, w, H, { s, a: '#f3e2bd', b: '#fbf0d6' });
    const sx = x + 12 * s, sy = y + 12 * s, sw = w - 24 * s, th = G.theme && G.theme.palette;
    drawHowTo(ctx, plan, sx, sy, sw, stH, G.t + i * 1.3, { rooster: allyIcon, world: howWorld(), calm: save.calm, sky0: th && th.skyTop, sky1: th && th.skyBottom, ground: th && th.groundTop, ring: th && th.ring && th.ring.base, ringEdge: th && th.ring && th.ring.dark });
    ui.roundRect(sx, sy, sw, stH, Math.min(18, stH * 0.08)); ctx.lineWidth = 2.5 * s; ctx.strokeStyle = 'rgba(90,50,16,0.55)'; ctx.stroke();
    ui.record({ x: sx, y: sy, w: sw, h: stH }, 'pause:stage' + i);
    const nm = I.name, ts = 15 * s, tw = Math.min(sw - 20 * s, ui.measure(nm, ts) + 22 * s);
    ui.roundRect(sx + sw - 8 * s - tw, sy + 8 * s, tw, 26 * s, 13 * s); ctx.fillStyle = I.group === 'boss' ? 'rgba(160,30,40,0.9)' : 'rgba(30,24,40,0.72)'; ctx.fill();
    ui.text(nm, sx + sw - 8 * s - tw / 2, sy + 21 * s, { size: ts, align: 'center', color: '#fff', maxW: tw - 12 * s, noRecord: true });
    if (I.group !== 'hazard' && lvLaser()) { // v0.8.9: a red tag in the stage's corner says what the laser does to it
      const lt = I.group === 'boss' ? 'Laser: it flinches' : 'Laser: stuns it', ls = 13.5 * s, lw = ui.measure(lt, ls) + 20 * s;
      ui.roundRect(sx + 8 * s, sy + stH - 34 * s, lw, 26 * s, 13 * s); ctx.fillStyle = 'rgba(176,34,24,0.9)'; ctx.fill();
      ui.text(lt, sx + 8 * s + lw / 2, sy + stH - 21 * s, { size: ls, align: 'center', color: '#fff', noRecord: true });
    }
    ui.text(plan.cap, x + w / 2, sy + stH + 18 * s, { size: 16.5 * s, align: 'center', color: '#2d6a1c', maxW: w - 24 * s, tag: 'pause:cap' + i });
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
    (() => { const c = G.li >= 0 && !earlyDays() ? pageLead('pause').lead : null; return c ? leadBlock(c, s, { gap: 12 * s, tag: 'pause:lead', quiet: true }) : null; })(), // 0.8.15: what waits for him or what he is closest to (the Conductor's one thing)
    earlyDays() ? null : pauseShop(s), // 0.8.14: the shop, big and gold, right under Resume (never before level 3 is won)
    pauseTiles([
      ['restart', 'Restart', ICON.retry, 'secondary'], ['levels', 'Levels', ICON.grid, ui.faceOf('#1f9e94')], ['home', 'Home', ICON.home, ui.faceOf('#e0507e')],
      ['settings', 'Settings', (c, X, Y, S) => settingsIcon(c, X, Y, S, '#fff4dc', (ui.skin && ui.skin.kinds && ui.skin.kinds.ad || {}).b || '#7c4fe0'), 'ad', (bx, by, bw, bh) => setMarkAt(bx, by, bw, bh)], ['practice', 'Practice', (c, X, Y, S) => pictoTarget(c, X, Y, S * 0.95), 'orange'],
    ], s, wide ? 5 : 3),
    // the hint and Skip level: two equal halves, each with its icon and the video mark (Skip only when src/skip.js allows it)
    G.hint ? lineBlock('Hint…', 18 * s, { color: '#ffe27a', stroke: 'rgba(40,20,5,0.9)', tag: 'pause:hint', gap: 14 * s })
      : sim.state !== 'play' && !skipNow() ? null : { h: 58 * s, gap: 12 * s, draw: (x, y, w) => {
        const sk = skipNow(), hn = sim.state === 'play', hw = sk && hn ? (w - 10 * s) / 2 : w, tk = save.wallet.tickets.skip > 0;
        if (hn) ui.button('hint', 'Hint', x, y, hw, 58 * s, { kind: 'ad', ad: !ads.premium, icon: lampIcon, iconS: 1.25, size: 19 * s, round: 18 * s });
        if (sk) ui.button('pause:skip', 'Skip level', x + (hn ? hw + 10 * s : 0), y, hw, 58 * s, { ...(tk ? { kind: 'orange', icon: (c, X, Y, S) => drawItemArt(c, 'skip', X, Y, S * 1.5, G.t) } : { face: ui.faceOf('#5a6ee0'), ad: !ads.premium, icon: ICON.next }), iconS: 1.15, size: 19 * s, round: 18 * s });
      } },
    // the three stars of this level and how each stands right now
    G.li >= 0 && G.goals && sim.state === 'play' ? { h: 3 * 32 * s + 12 * s, gap: 14 * s, draw: (x, y, w) => {
      ui.well(x, y, w, 3 * 32 * s + 12 * s, { s, a: '#f3e2bd', b: '#fbf0d6' });
      const ok = goalsLive(sim);
      G.goals.forEach((g, i) => {
        const ry = y + 6 * s + 32 * s * (i + 0.5);
        if (i) { ctx.fillStyle = 'rgba(122,80,40,0.16)'; ctx.fillRect(x + 10 * s, ry - 16 * s, w - 20 * s, 1.2 * s); }
        drawStar(ctx, x + 26 * s, ry, 11 * s, ok[i]);
        ui.text(g.long, x + 48 * s, ry, { size: 16.5 * s, color: ok[i] ? C.ink : 'rgba(80,50,25,0.6)', maxW: w - 96 * s, tag: 'pause:goal' + i });
        if (!ok[i]) pictoCross(ctx, x + w - 24 * s, ry, 22 * s);
      });
    } } : null,
    ...(kinds.length ? [pageSection(kinds.length === 1 ? 'WHO HUNTS YOUR EGGS' : `WHO HUNTS YOUR EGGS (${kinds.length})`, s, 'pfoes'), ...kinds.map((kd, i) => foeStage(kd, i, s, iw))] : []),
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
    pageScroll([pageSection(kinds.length === 1 ? 'WHO HUNTS YOUR EGGS' : `WHO HUNTS YOUR EGGS (${kinds.length})`, s, 'pfoes'), ...kinds.map((kd, i) => foeStage(kd, i, s, rw))], pr, G.ppRectR, rx, rw, s);
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

// 0.8.17: the bell with a slash (reminders are off): a quiet round chip on the home and the map's header, never over
// play. A tap opens the reminder question. A gold dot when something is waiting right now that a note would have told
// him about (a spin banked, today's chest); it swings a little now and then (Calm: still).
function drawRemChip(x, y, d) {
  const dot = ENG.herald.waiting(save, waitingCtx()), sw = save.calm || !dot ? 0 : Math.sin(G.t * 18) * 0.22 * Math.max(0, 1 - ((G.t % 6) / 0.6));
  ui.button('rem:chip', '', x, y, d, d, { kind: 'hud', round: d / 2, icon: (c, X, Y, S) => {
    c.save(); c.fillStyle = '#fff4dc'; c.translate(X, Y - S * 0.3); c.rotate(sw); c.translate(-X, -(Y - S * 0.3)); SI.bell(c, X, Y + S * 0.04, S * 1.2); c.restore();
    c.save(); c.lineCap = 'round'; c.strokeStyle = 'rgba(40,20,5,0.75)'; c.lineWidth = S * 0.2; c.beginPath(); c.moveTo(X - S * 0.36, Y - S * 0.36); c.lineTo(X + S * 0.36, Y + S * 0.36); c.stroke();
    c.strokeStyle = '#ff8a6a'; c.lineWidth = S * 0.1; c.stroke(); c.restore();
  }, iconS: 1.55 });
  if (dot) { const r = d * 0.13, cx = x + d * 0.84, cy = y + d * 0.16; ctx.beginPath(); ctx.arc(cx, cy, r + 1.5, 0, 7); ctx.fillStyle = 'rgba(40,20,5,0.6)'; ctx.fill(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fillStyle = '#ffd23a'; ctx.fill(); }
}
// Settings, the Reminders card (app only): the switch, the state in plain words, a test note, and the phone's own page
// when the phone is in the way (blocked there, or a battery saver known to stop alarms)
function remCard(s) {
  const I = remInfo(), on = remOn(), ph = remPhone(), H = ENG.herald.state(save);
  const fix = remSys() ? 'app' : I.strict && I.battery === 'saver' && on ? 'battery' : '';
  const st = remSys() ? 'Blocked in the phone\u2019s settings' : !on ? 'Off' : fix === 'battery' ? 'On \u00b7 the battery saver may stop them' : 'On \u00b7 one a day at most, never at night';
  const hh = 66 * s, bh = 44 * s, h = hh + bh + 12 * s;
  return { h, gap: 8 * s, draw: (x, y, w) => {
    ui.well(x, y, w, h, { s, r: 16 * s, a: '#f6e6c2', b: '#ecd3a2' });
    const d = 42 * s, bx = x + 12 * s, by = y + (hh - d) / 2, sw = 58 * s, sh = 32 * s, tx = bx + d + 12 * s, tw = w - (tx - x) - sw - 22 * s;
    setBadge('bell', on ? '#e8a020' : '#a98f73', bx, by, d);
    ui.text('Reminders', tx, y + hh / 2 - 9 * s, { size: 19 * s, color: ui.C.ink, maxW: tw, tag: 'set:l:set:remind' });
    ui.text(st, tx, y + hh / 2 + 13 * s, { size: 13 * s, color: fix ? '#b0421c' : ui.C.ink2, maxW: tw, tag: 'set:s:set:remind' });
    setSwitch(x + w - sw - 12 * s, y + (hh - sh) / 2, sw, sh, on);
    ui.buttons.push({ id: 'set:remind', x, y, w, h: hh });
    const ry = y + hh, iw = w - 24 * s, half = (iw - 10 * s) / 2;
    if (fix) {
      ui.button('set:remtest', 'Send a test', x + 12 * s, ry, half, bh, { kind: 'secondary', size: Math.min(16 * s, half * 16 / (ui.measure('Send a test', 16) + 24)), icon: (c, X, Y, S) => { c.save(); c.fillStyle = '#fff'; SI.bell(c, X, Y, S); c.restore(); } });
      ui.button('set:remsys', fix === 'battery' ? 'Battery' : 'Phone settings', x + 12 * s + half + 10 * s, ry, half, bh, { kind: 'orange', size: Math.min(16 * s, half * 16 / (ui.measure('Phone settings', 16) + 24)), icon: (c, X, Y, S) => settingsIcon(c, X, Y, S * 1.05, '#fff4dc') });
    } else ui.button('set:remtest', 'Send a test in 10 seconds', x + 12 * s, ry, iw, bh, { kind: 'secondary', size: Math.min(16 * s, (iw - 60 * s) * 16 / ui.measure('Send a test in 10 seconds', 16)), icon: (c, X, Y, S) => { c.save(); c.fillStyle = '#fff'; SI.bell(c, X, Y, S); c.restore(); } });
  } };
}

// Settings (2026-11-15, mykee; 0.8.9: a full page with an icon on every row, "not half page"): the pause page's kit
// (header ribbon, one scrolling column, a big Done pinned below). Opens over the home or the pause page; only its own
// buttons take taps while it shows. Three sections: Sound and feel, Gameplay, Display.
const SI = { // white glyphs for the colored badges, drawn in a box of about S px around (x, y)
  sound: (c, x, y, S) => { c.beginPath(); c.moveTo(x - S * 0.34, y - S * 0.12); c.lineTo(x - S * 0.16, y - S * 0.12); c.lineTo(x + S * 0.04, y - S * 0.3); c.lineTo(x + S * 0.04, y + S * 0.3); c.lineTo(x - S * 0.16, y + S * 0.12); c.lineTo(x - S * 0.34, y + S * 0.12); c.closePath(); c.fill(); c.lineWidth = S * 0.09; c.beginPath(); c.arc(x + S * 0.06, y, S * 0.18, -0.9, 0.9); c.stroke(); c.beginPath(); c.arc(x + S * 0.06, y, S * 0.33, -0.9, 0.9); c.stroke(); },
  note: (c, x, y, S) => { c.beginPath(); c.ellipse(x - S * 0.14, y + S * 0.22, S * 0.15, S * 0.11, -0.4, 0, 7); c.fill(); c.lineWidth = S * 0.1; c.beginPath(); c.moveTo(x - S * 0.02, y + S * 0.2); c.lineTo(x - S * 0.02, y - S * 0.3); c.lineTo(x + S * 0.26, y - S * 0.18); c.stroke(); },
  buzz: (c, x, y, S) => vibeIcon(true)(c, x, y, S * 1.15),
  bell: (c, x, y, S) => { c.beginPath(); c.moveTo(x - S * 0.32, y + S * 0.2); c.quadraticCurveTo(x - S * 0.22, y + S * 0.08, x - S * 0.22, y - S * 0.06); c.quadraticCurveTo(x - S * 0.22, y - S * 0.34, x, y - S * 0.34); c.quadraticCurveTo(x + S * 0.22, y - S * 0.34, x + S * 0.22, y - S * 0.06); c.quadraticCurveTo(x + S * 0.22, y + S * 0.08, x + S * 0.32, y + S * 0.2); c.closePath(); c.fill(); c.beginPath(); c.arc(x, y + S * 0.28, S * 0.09, 0, 7); c.fill(); c.beginPath(); c.arc(x, y - S * 0.36, S * 0.05, 0, 7); c.fill(); },
  shake: (c, x, y, S) => { c.lineWidth = S * 0.09; const w = S * 0.4, h = S * 0.56; for (const [dx, a] of [[-0.09, 0.45], [0.09, 1]]) { c.globalAlpha = a; ui.roundRect(x + S * dx - w / 2, y - h / 2, w, h, S * 0.08); c.stroke(); } c.globalAlpha = 1; for (const d of [-1, 1]) { c.beginPath(); c.moveTo(x + d * S * 0.4, y - S * 0.14); c.lineTo(x + d * S * 0.4, y + S * 0.14); c.stroke(); } },
  ring: (c, x, y, S) => { c.lineWidth = S * 0.13; c.lineCap = 'round'; c.beginPath(); c.arc(x, y, S * 0.28, -0.3, Math.PI * 1.45); c.stroke(); const ax = x + S * 0.28 * Math.cos(-0.3), ay = y + S * 0.28 * Math.sin(-0.3); c.beginPath(); c.moveTo(ax + S * 0.17, ay - S * 0.02); c.lineTo(ax - S * 0.08, ay - S * 0.2); c.lineTo(ax - S * 0.1, ay + S * 0.1); c.closePath(); c.fill(); },
  flag: (c, x, y, S) => { c.lineWidth = S * 0.1; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - S * 0.22, y + S * 0.34); c.lineTo(x - S * 0.22, y - S * 0.34); c.stroke(); c.beginPath(); c.moveTo(x - S * 0.22, y - S * 0.32); c.lineTo(x + S * 0.32, y - S * 0.14); c.lineTo(x - S * 0.22, y + S * 0.06); c.closePath(); c.fill(); },
  sparkle: (c, x, y, S) => { const st = (cx, cy, R) => { c.beginPath(); for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4 - Math.PI / 2, r = i % 2 ? R * 0.26 : R; c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } c.closePath(); c.fill(); }; st(x - S * 0.06, y + S * 0.04, S * 0.36); st(x + S * 0.28, y - S * 0.26, S * 0.15); },
  fps: (c, x, y, S) => { c.font = `800 ${S * 0.66}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('60', x, y + S * 0.04); },
  leaf: (c, x, y, S) => { c.beginPath(); c.moveTo(x - S * 0.32, y + S * 0.32); c.quadraticCurveTo(x - S * 0.4, y - S * 0.3, x + S * 0.32, y - S * 0.34); c.quadraticCurveTo(x + S * 0.4, y + S * 0.3, x - S * 0.32, y + S * 0.32); c.fill(); c.strokeStyle = 'rgba(40,90,30,0.8)'; c.lineWidth = S * 0.07; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - S * 0.3, y + S * 0.3); c.lineTo(x + S * 0.14, y - S * 0.14); c.stroke(); },
  novideo: (c, x, y, S) => pictoNoVideo(c, x, y, S * 1.18, '#fff', '#ff6a50'),
  watch: (c, x, y, S) => { c.lineWidth = S * 0.1; c.lineCap = 'round'; c.beginPath(); c.arc(x, y + S * 0.06, S * 0.29, 0, 7); c.stroke(); c.fillRect(x - S * 0.08, y - S * 0.4, S * 0.16, S * 0.1); c.beginPath(); c.moveTo(x, y + S * 0.06); c.lineTo(x + S * 0.14, y - S * 0.1); c.stroke(); },
  dial: (c, x, y, S) => { c.lineWidth = S * 0.11; c.lineCap = 'round'; c.beginPath(); c.arc(x, y + S * 0.12, S * 0.32, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); c.beginPath(); c.moveTo(x, y + S * 0.12); c.lineTo(x + S * 0.17, y - S * 0.12); c.stroke(); c.beginPath(); c.arc(x, y + S * 0.12, S * 0.07, 0, 7); c.fill(); },
  file: (c, x, y, S) => { c.beginPath(); c.moveTo(x - S * 0.26, y - S * 0.36); c.lineTo(x + S * 0.08, y - S * 0.36); c.lineTo(x + S * 0.28, y - S * 0.16); c.lineTo(x + S * 0.28, y + S * 0.36); c.lineTo(x - S * 0.26, y + S * 0.36); c.closePath(); c.fill(); c.strokeStyle = 'rgba(40,40,60,0.55)'; c.lineWidth = S * 0.07; for (const k of [0, 0.14, 0.28]) { c.beginPath(); c.moveTo(x - S * 0.14, y - S * 0.0 + S * k); c.lineTo(x + S * 0.16, y + S * k); c.stroke(); } },
};
function setBadge(kind, col, x, y, d) {
  ui.roundRect(x, y, d, d, d * 0.3); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = Math.max(1.5, d * 0.05); ctx.strokeStyle = 'rgba(40,20,5,0.55)'; ctx.stroke();
  ctx.save(); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineJoin = 'round'; SI[kind](ctx, x + d / 2, y + d / 2, d * 0.62); ctx.restore();
}
function setSwitch(x, y, w, h, on) {
  ui.roundRect(x, y, w, h, h / 2); ctx.fillStyle = on ? '#3eb42d' : '#a98f73'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = on ? '#256f19' : '#6e5238'; ctx.stroke();
  const r = h / 2 - 3, kx = on ? x + w - h / 2 : x + h / 2;
  ctx.beginPath(); ctx.arc(kx, y + h / 2 + 1, r, 0, 7); ctx.fillStyle = 'rgba(40,20,5,0.25)'; ctx.fill();
  ctx.beginPath(); ctx.arc(kx, y + h / 2, r, 0, 7); ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(70,40,10,0.5)'; ctx.stroke();
  if (on) pictoCheck(ctx, x + h * 0.5, y + h / 2, h * 0.42, '#fff'); // the green side also says "on" in a shape, not just a colour
}
// a big row: badge, name (and a small line), then a switch (on !== undefined), a value, or a chevron; the whole row is the button
function setRow(s, id, label, kind, col, o = {}) {
  const h = (o.sub ? 66 : 60) * s;
  return { h, gap: 8 * s, draw: (x, y, w) => {
    ui.well(x, y, w, h, { s, r: 16 * s, a: '#f6e6c2', b: '#ecd3a2' });
    const d = 42 * s, bx = x + 12 * s, by = y + (h - d) / 2, sw = 58 * s, sh = 32 * s;
    setBadge(kind, col, bx, by, d);
    const tx = bx + d + 12 * s, tw = w - (tx - x) - sw - 22 * s;
    ui.text(label, tx, y + h / 2 - (o.sub ? 9 : 0) * s, { size: 19 * s, color: ui.C.ink, maxW: tw, tag: 'set:l:' + id });
    if (o.sub) ui.text(o.sub, tx, y + h / 2 + 13 * s, { size: 13 * s, color: ui.C.ink2, maxW: tw, tag: 'set:s:' + id });
    if (o.on !== undefined) setSwitch(x + w - sw - 12 * s, y + (h - sh) / 2, sw, sh, o.on);
    else if (o.act) { ui.roundRect(x + w - 82 * s - 10 * s, y + (h - 34 * s) / 2, 82 * s, 34 * s, 17 * s); ctx.fillStyle = '#3a80ea'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#1d4a9a'; ctx.stroke(); ui.text(o.act, x + w - 51 * s, y + h / 2 + 1 * s, { size: 15 * s, align: 'center', color: '#fff', tag: 'set:a:' + id }); }
    ui.buttons.push({ id, x, y, w, h });
  } };
}
// a card with a header (badge, name, value) and a control under it: ring speed, difficulty, graphics, frame rate
function setCard(s, label, kind, col, val, ctlH, ctl, hint) {
  const hh = 62 * s, hn = hint ? 22 * s : 0, h = hh + ctlH + hn + 10 * s;
  return { h, gap: 8 * s, draw: (x, y, w) => {
    ui.well(x, y, w, h, { s, r: 16 * s, a: '#f6e6c2', b: '#ecd3a2' });
    const d = 42 * s, bx = x + 12 * s, by = y + (hh - d) / 2 - 1 * s;
    setBadge(kind, col, bx, by, d);
    ui.text(label, bx + d + 12 * s, by + d / 2, { size: 19 * s, color: ui.C.ink, tag: 'set:l:' + label });
    if (val) ui.text(val, x + w - 14 * s, by + d / 2, { size: 16 * s, align: 'right', color: ui.C.ink2, maxW: w * 0.4, tag: 'set:v:' + label });
    ctl(x + 12 * s, y + hh, w - 24 * s);
    if (hint) ui.text(hint, x + w / 2, y + hh + ctlH + 12 * s, { size: 13 * s, align: 'center', color: ui.C.ink2, maxW: w - 24 * s, tag: 'set:h:' + label });
  } };
}
function setHead(title, s) {
  return { h: 22 * s, gap: 14 * s, draw: (x, y, w) => {
    ui.text(title.toUpperCase(), x + 4 * s, y + 11 * s, { size: 15 * s, color: '#fff', stroke: 'rgba(30,14,4,0.85)', strokeW: 3 * s, tag: 'set:sec:' + title });
    const tw = ui.measure(title.toUpperCase(), 15 * s) + 16 * s; ctx.fillStyle = 'rgba(255,240,210,0.25)'; ctx.fillRect(x + tw, y + 10 * s, w - tw, 2 * s);
  } };
}
const rsLabel = (sp) => `${sp === RING_SPEED_DEFAULT ? 'Standard' : sp < RING_SPEED_DEFAULT ? 'Slower' : sp >= 3.5 ? 'Pro' : 'Faster'} ${Math.round(sp * 100)}%`;
// the ring speed control: - [one bar per speed] + (Settings, and the level card's strip; the same press ids rs:-, rs:+, rs:<i>)
function ringSpeedCtl(x, y, w, s, k, h = 46 * s) {
  const bw = h, n = RING_SPEEDS.length, tx = x + bw + 8 * s, tw = w - 2 * bw - 16 * s, cw2 = tw / n, bh = h * 30 / 46;
  ui.button('rs:-', '', x, y, bw, h, { kind: k > 0 ? 'secondary' : 'off', disabled: k <= 0, icon: ICON.left, iconS: 1.2 });
  ui.button('rs:+', '', x + w - bw, y, bw, h, { kind: k < n - 1 ? 'secondary' : 'off', disabled: k >= n - 1, icon: ICON.right, iconS: 1.2 });
  ui.well(tx, y + (h - bh) / 2, tw, bh, { s });
  for (let i = 0; i < n; i++) {
    const cx = tx + cw2 * (i + 0.5), onI = i <= k, hgt = (9 + i * 18 / (n - 1)) * s * (h / (46 * s)), dfl = RING_SPEEDS.indexOf(RING_SPEED_DEFAULT);
    ui.roundRect(cx - cw2 * 0.3, y + h / 2 - hgt / 2, cw2 * 0.6, hgt, 3 * s);
    ctx.fillStyle = onI ? (i === dfl ? '#3eb42d' : i < dfl ? '#3a80ea' : RING_SPEEDS[i] >= 3.5 ? '#e0452f' : '#f3781c') : 'rgba(110,80,50,0.25)'; ctx.fill();
    ui.buttons.push({ id: 'rs:' + i, x: tx + cw2 * i, y, w: cw2, h });
  }
  ui.record({ x: tx, y: y + (h - bh) / 2, w: tw, h: bh }, 'set:rsbar');
}
// a soft gold ring round a row that should draw the eye (t: seconds since it began, it lets go after dur; Calm: still)
// ---- 0.8.14 (mykee: "users have never tried increasing the settings or the ring speed ... In the initial first 5 levels
// itself, we should show these controls"): the ring speed strip on the level card of levels 2 to 5, until the player
// has changed the speed once (save.seen.rsTried) or has won level 5. It is the real control: a small ring turning at
// the chosen speed, the same - / bars / + as Settings, and the teaching hand tapping + until the player touches it.
// After the first change, for that visit: a tick and "You can change it any time in Settings" with the gear.
const RS_STRIP_H = 84, RS_STRIP_LOW = 60; // a short screen (a 360x640 phone): no words before the first change, the ring, the bars and the hand say it
const rsStripH = () => (!save.seen.rsTried && ui.A.h < 800 * ui.u ? RS_STRIP_LOW : RS_STRIP_H);
function ringSpeedStripOn() {
  if (G.screen !== 'intro' || G.li < 0 || G.demo || !G.level || G.level.id < 2 || G.level.id > 5) return false;
  if (bestStarsOf(5) > 0) return false;
  return !save.seen.rsTried || !!(G.rsDone && G.rsDone.seq === G.scrSeq && G.rsDone.lid === G.level.id);
}
function ringSpeedStrip(x, y, w, s) {
  if (!ringSpeedStripOn()) return 0;
  const H = rsStripH() * s, C = ui.C, sp = ringSpeed(), k = RING_SPEEDS.indexOf(sp), done = !!save.seen.rsTried, low = H < RS_STRIP_H * s;
  ui.well(x, y, w, H, { s, r: 16 * s, a: '#f6e6c2', b: '#ecd3a2' });
  // the little ring: it turns at the chosen speed, so a change shows at once
  const rr = 17 * s, rcx = x + 12 * s + rr + 2 * s, rcy = y + H - 8 * s - 22 * s, dt = clamp(G.t - (G.rsT ?? G.t), 0, 0.1), ang = save.calm ? 0.6 : (G.rsAng = (G.rsAng || 0) + dt * 1.6 * sp);
  G.rsT = G.t;
  ctx.save(); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(rcx, rcy, rr, ang + 0.55, ang + Math.PI * 2 - 0.55); ctx.lineWidth = 7 * s; ctx.strokeStyle = '#6b3f17'; ctx.stroke();
  ctx.beginPath(); ctx.arc(rcx, rcy, rr, ang + 0.55, ang + Math.PI * 2 - 0.55); ctx.lineWidth = 4 * s; ctx.strokeStyle = '#d99a4e'; ctx.stroke();
  drawEggIcon(ctx, rcx, rcy, 15 * s, 'alive');
  ctx.restore();
  ui.record({ x: rcx - rr - 4 * s, y: rcy - rr - 4 * s, w: 2 * rr + 8 * s, h: 2 * rr + 8 * s }, 'rs:ring');
  // the top line: what it is and a nudge; after the first change, where it lives
  const ty = y + 17 * s, lx = x + 14 * s;
  if (low) { /* no words: the hand on + says it */ } else if (!done) {
    ui.text('RING SPEED', lx, ty, { size: 14.5 * s, color: C.ink, tag: 'rs:head' });
    ui.text('Too slow? Turn it up', x + w - 14 * s, ty, { size: 13.5 * s, align: 'right', color: C.ink2, maxW: w - ui.measure('RING SPEED', 14.5 * s) - 44 * s, tag: 'rs:hint' });
  } else {
    const t = 'You can change it any time in Settings', ts = Math.min(13.5 * s, (w - 70 * s) * 20 / ui.measure(t, 20)), tw = ui.measure(t, ts), x1 = x + w / 2 - (tw + 46 * s) / 2;
    pictoCheck(ctx, x1 + 9 * s, ty, 18 * s);
    ui.text(t, x1 + 22 * s, ty, { size: ts, color: '#2d6a1c', tag: 'rs:done' });
    settingsIcon(ctx, x1 + 22 * s + tw + 14 * s, ty, 20 * s, '#6b3f17', '#f0dcb2');
  }
  const cx = rcx + rr + 12 * s, ch = 44 * s;
  ringSpeedCtl(cx, y + H - 8 * s - ch, x + w - 10 * s - cx, s, k, ch);
  if (!done) { // the hand taps + until the player touches the control
    const B = ui.buttons.find((b) => b.id === 'rs:+'), per = 1.2, q = save.calm ? 0.5 : (G.t % per) / per, press = q > 0.42 && q < 0.72;
    if (B) teachHand(ctx, B.x + B.w * 0.58, B.y + B.h * (press ? 0.45 : 0.62), Math.min(B.h * 1.15, 52 * s), press, 1);
  }
  return H;
}
// the strip as a block for the level card's pinned column (RS_STRIP_H tall), or nothing
const rsStripBlock = (s) => (ringSpeedStripOn() ? [{ h: rsStripH() * s, gap: 8 * s, draw: (x, y, w) => ringSpeedStrip(x, y, w, s) }] : []);
function drawSettings() {
  if (G.setSub) { if (G.setSub.seq === G.setSeq) return drawSetSub(); xsClose(); } // 0.8.17: the privacy page and the reset card (drawSetSub)
  ui.buttons.length = 0; ui.rects.length = 0; ui.calm = save.calm;
  const u = ui.u, A = ui.A, C = ui.C, s = u * clamp(A.w / (390 * u), 0.82, 1), pad = 16 * u, land = A.h < 520 * u;
  const bg = ctx.createLinearGradient(0, 0, 0, H_); bg.addColorStop(0, '#3b2468'); bg.addColorStop(1, '#1c1233');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W_, H_); // a full page: nothing of the game shows behind it
  // 0.8.17 (mykee: landscape "too much empty UI space"): a phone on its side lays the sections in two columns that scroll together
  const two = A.w > A.h * 1.15 && A.w - 2 * pad >= 700 * s, W2 = Math.min(A.w - 2 * pad, 1100 * s), cgap = 24 * s;
  const cw = two ? (W2 - cgap) / 2 : Math.min(A.w - 2 * pad, 560 * s), x0 = two ? A.cx - W2 / 2 : A.cx - cw / 2;
  const pg = G.setpage || (G.setpage = { y: 0, v: 0, max: 0, t: G.t, lid: null });
  if (pg.lid !== G.setSeq) { pg.lid = G.setSeq; pg.y = 0; pg.v = 0; pg.to = null; pg.hl = null; if (G.setFirst && G.setFirst.seq === G.setSeq) { focusStart(pg, 'rs', G.t + 0.15, undefined, false); G.setRsAt = true; } } // the marked way in: the ring speed row
  // header: back, the ribbon, and (landscape) Done
  // (0.8.14: the one page header, ui.pageHeader; back sits on the rows' left edge, Done on their right edge)
  const P = ui.pageBox(two ? 1100 * s : 560 * s), hy = P.y, hh = P.h;
  ui.pageHeader(P, { back: 'set:close', title: 'Settings', color: '#7a48e8', tag: 'set:title', right: land ? { w: 130 * s, draw: (x, y, w, h) => ui.button('set:close', 'Done', x, y, w, h, { kind: 'primary', icon: ICON.check, size: 19 * s }) } : null });
  let vb = A.y1 - (land ? 2 * u : pad);
  if (!land) {
    setFooter(A.cx, A.y1 - pad - 6 * s, s); // 0.8.17: the version and the support id (a tap copies them)
    ui.button('set:close', 'Done', x0, A.y1 - pad - 20 * s - 56 * s, cw, 56 * s, { kind: 'primary', icon: ICON.check, size: 22 * s });
    vb = A.y1 - pad - 20 * s - 56 * s - 8 * s;
  }
  const vt = hy + hh + 8 * s, V = { x: A.x, y: vt, w: A.w, h: Math.max(60, vb - vt) };
  const B = [], on = (v) => v !== false, heads = [];
  if (remCan()) { heads.push(B.length); B.push(setHead('Notifications', s)); B.push(remCard(s)); } // 0.8.17: first, so it is in the first screenful (app only, never for a child profile)
  heads.push(B.length); B.push(setHead('Sound and feel', s));
  if (portal.showMuteButton) { B.push(setRow(s, 'sfx', 'Sound', 'sound', '#3a80ea', { on: save.sfx })); B.push(setRow(s, 'music', 'Music', 'note', '#9a5ae8', { on: save.music })); }
  if (__APP__ || (typeof navigator !== 'undefined' && navigator.vibrate)) B.push(setRow(s, 'vibe', 'Vibration', 'buzz', '#e8702f', { on: on(save.vibe) }));
  B.push(setRow(s, 'shake', 'Screen shake', 'shake', '#d8453a', { on: on(save.shake) && !save.calm, sub: save.calm ? 'Off while Calm motion is on' : null }));
  heads.push(B.length); B.push(setHead('Gameplay', s));
  const sp = ringSpeed(), k = RING_SPEEDS.indexOf(sp);
  const rsLook = focusLook(pg.hl, G.t, save.calm); // the first visit (the Settings mark): the ring round this row ~4 s or until a touch
  if (pg.hl && !rsLook && G.t - pg.hl.t0 >= 0) pg.hl = null;
  const rsCard = setCard(s, 'Ring speed', 'ring', '#2fa84f', rsLabel(sp), 46 * s, (x, y, w) => ringSpeedCtl(x, y, w, s, k));
  const rsB = rsLook ? { ...rsCard, draw: (x, y, w) => { rsCard.draw(x, y, w); focusDraw(ctx, ui, rsLook, { x, y, w, h: rsCard.h }, 16 * s, s); } } : rsCard;
  B.push(rsB);
  B.push(setCard(s, 'Difficulty', 'flag', '#e0a21c', null, 42 * s, (x, y, w) => modeRow(x, y, w, 42 * s, s)));
  B.push(setRow(s, 'set:adapt', 'Adaptive help', 'sparkle', '#e0507e', { on: save.adapt !== false, sub: 'Help and dares that fit how you play' })); // the Pacer's switch (src/engine/pacer.js)
  heads.push(B.length); B.push(setHead('Display', s));
  const gl = save.gfx === 'auto' ? `Auto picked ${TIER_NAME[PERF.tier]} for this phone` : save.gfx === 'high' ? 'Sharpest picture, every effect' : save.gfx === 'medium' ? 'Softer picture, fewer light effects' : 'Smoothest on older phones';
  B.push(setCard(s, 'Graphics', 'sparkle', '#2aa7a0', null, 42 * s, (x, y, w) => segRow('gfx:', [['auto', 'Auto'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']], save.gfx, x, y, w, 42 * s, s), gl));
  const fl = save.fps === 30 ? 'Saves battery, keeps the phone cool' : save.fps === 60 ? 'Smoothest motion, uses more battery' : `Now ${PERF.fpsCap} fps`;
  B.push(setCard(s, 'Frame rate', 'fps', '#3a80ea', null, 42 * s, (x, y, w) => segRow('fps:', [['auto', 'Auto'], [30, '30 fps'], [60, '60 fps']], save.fps, x, y, w, 42 * s, s), fl));
  B.push(setRow(s, 'calm', 'Calm motion', 'leaf', '#4aa83a', { on: !!save.calm, sub: 'No shake or flashes' }));
  B.push(setRow(s, 'set:fpsshow', 'Show fps', 'dial', '#8a6ad0', { on: !!save.showFps }));
  B.push(setRow(s, 'set:speed', 'Speed test', 'watch', '#e8702f', { act: 'Start' }));
  B.push(setRow(s, 'set:log', 'Share speed log', 'file', '#5a7aa8', { act: 'Share' })); // 0.8.7: the game notes frame rates and hitches by itself; this hands the file over
  if (ads.moneyShop && !ads.premium && !OF.childSafe(save)) B.push(setRow(s, 'set:novideo', 'No videos', 'novideo', '#7a48e8', { act: 'See' })); // the sheet of Unlock Everything (no payment starts here)
  if (ads.canBuyPremium || ads.premium) B.push(setRow(s, 'set:restore', 'Restore purchases', 'ring', '#c88a1c', { act: 'Restore' }));
  B.push(...xsSetBlocks(s)); // 0.8.17: Privacy policy, Reset progress (their own block, last)
  if (land) B.push({ h: 28 * s, gap: 8 * s, draw: (x, y, w) => setFooter(x + w / 2, y + 14 * s, s) }); // the version and the support id (a tap copies them)
  G.setRect = V;
  let BL = B, BR = null;
  if (two) { // the split at the section heading that leaves the two columns the most even
    let best = null;
    for (const i of heads) { if (!i) continue; const l = B.slice(0, i), r = B.slice(i), m = Math.max(pageColH(l, s), pageColH(r, s)); if (!best || m < best.m) best = { m, l, r }; }
    if (best) { BL = best.l; BR = best.r; }
  }
  if (G.setRsAt) { // the first visit: the ring speed row in view (on a short screen the page starts scrolled to it)
    const col = BR && BR.includes(rsB) ? BR : BL;
    G.setRsAt = false; let yy = 0; for (const b of col) { yy += b.gap ?? 10 * s; if (b === rsB) break; yy += b.h; }
    const H = Math.max(pageColH(BL, s), BR ? pageColH(BR, s) : 0) + 18 * s; focusTrip(pg, focusY(yy, rsCard.h, V.h, Math.max(0, H - V.h), s), save.calm); // scrolled to (about 0.4 s), the row in the upper middle
  }
  if (BR) pageScroll2(BL, BR, pg, V, x0, x0 + cw + cgap, cw, s);
  else pageScroll(B, pg, V, x0, cw, s, true);
}
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
  glideDt(S, dt);
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
    const th = Math.max(26 * s, vh * vh / listH), ty = vy + clamp(S.y / S.max, 0, 1) * (vh - th);
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
const WIN_SHOW = 1.6, WIN_IN = 0.38; // WIN_SHOW: the shortest show (the real one waits for the stars: winShow)
// 0.8.15 (mykee: "the screen spends very less time on the stars and immediately showing gifts"): the stars have their own
// beat. Over the end of her cheer each earned star flies up from her into its big socket, STAR_GAP apart, with a squash, a
// ring, sparks, a bell and a tick; three of three end on a finish (rays sweep, confetti, she jumps). With rewards waiting
// the row is then held for STAR_HOLD so it can be read, and stays small at the top of the page through the reveals.
// Win to the first reward: about 3 to 3.4 s with three stars, 1.8 with one. No star lands a second time on the card.
const STAR_GAP = 0.45, STAR_FLY = 0.36, STAR_HOLD = 0.6, WIN_COUNT = 0.8; // WIN_COUNT: the card's count-up
function winShow(r) { // when the show ends (the rewards or the card come); also sets r.star0 (the first landing) and r.starEnd
  if (r.show == null) {
    const s0 = routine(r.cheer).stars[0];
    r.star0 = clamp(s0 != null ? s0 : 0.95, 0.85, 1.4); // the first star lands on her first star beat
    r.starEnd = (r.stars ? r.star0 + STAR_GAP * (r.stars - 1) : 0.6) + (r.stars === 3 ? 0.5 : 0.2);
    r.show = Math.max(WIN_SHOW, r.starEnd + (r.rv && r.rv.list.length ? STAR_HOLD : 0.25));
  }
  return r.show;
}
const starAt = (r, q) => { winShow(r); return r.star0 + STAR_GAP * q; }; // when star q lands
const winIn = (r) => (revealing(r) ? 0 : save.calm ? 1 : clamp((r.t - winShow(r)) / WIN_IN, 0, 1));
// what this win unlocked, shown one by one between her show and the card (onWin builds r.rv.list); a tap skips to the next
const revealing = (r) => !!(r && r.rv && r.rv.i < r.rv.list.length);
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
  return { box, henH: Math.min(box.w * (sd.big ? 0.6 : 0.48), box.h * 0.6) }; // sd.big: a narrow patch beside a two-column card, she fills more of it
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
  const R = Math.min(A.w * 0.1, avail * 0.07), hh = Math.min(A.h * 0.3, A.w * 0.5, (avail - 2.8 * R - band) / 1.5); // wings spread she is ~1.2x as wide as tall
  const y0 = top + (avail - (2.8 * R + 1.5 * hh + band)) / 2, by = y0 + 2.8 * R;
  return { box: { x: A.x, y: by, w: A.w, h: 1.5 * hh }, henH: hh, R, stars: [0, 1, 2].map((k) => ({ x: A.cx + (k - 1) * R * 2.55, y: y0 + 1.5 * R - (k === 1 ? R * 0.35 : 0) })), titleY: by + 1.5 * hh + band * 0.45, titleX: A.cx, full: { x: 0, y: top, w: ui.w, h: avail } };
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
// ---- 0.8.16 the win page's tiles
// one of two or three rewards side by side: its art on top, its name, a ticked line (each was shown big in its reveal)
function winLootTile(r, kind, x, y, w, h, s) {
  const C = ui.C, cx = x + w / 2, hot = kind === 'hot', l1 = y + 65 * s, l2 = y + 83 * s, tw = w - 12 * s;
  ui.well(x, y, w, h, { s, a: hot ? '#ffe0cc' : '#ffe9b0', b: hot ? '#fff3ea' : '#fff6dc' });
  const line2 = (str, tag) => tickLine(str, cx, l2, 12.5 * s, { color: '#2d7a1c', fit: tw, tag });
  if (kind === 'treasure') { // the open chest (when the tile is wide enough for it) and its three things with their counts
    const its = treasureItems(r.treasure), chest = w >= 168 * s, x0 = x + (chest ? 50 * s : 4 * s), iw = Math.min(46 * s, (x + w - 4 * s - x0) / 3), xi = x0 + (x + w - 4 * s - x0 - 3 * iw) / 2;
    if (chest) drawChest(ctx, x + 28 * s, y + 30 * s, 42 * s, G.t, 'open');
    its.forEach(([k2, n], j) => { const ix = xi + (j + 0.5) * iw; rewardIcon(k2, r.treasure, ix, y + 21 * s, 26 * s); ui.text(n, ix, y + 43 * s, { size: 13 * s, align: 'center', color: C.ink, maxW: iw - 2 * s, tag: 'win:tri' + j }); });
    ui.text('Boss treasure', cx, l1, { size: 14.5 * s, align: 'center', color: C.ink, maxW: tw, tag: 'win:tr' });
    line2('In your bag', 'win:tr2');
  } else if (kind === 'gift') { // the free try: the thing itself
    const T = r.gift;
    tasteArt(T, cx, y + 29 * s, (T.kind === 'hen' ? 50 : T.kind === 'boost' ? 64 : 46) * s, false); // (a booster's icon draws small for its size)
    ui.text(tasteName(T), cx, l1, { size: 14.5 * s, align: 'center', color: C.ink, maxW: tw, tag: 'win:gift' });
    line2(T.kind === 'boost' ? '+1 in your bag' : `Free for ${DR.DIR.skinLevels} levels`, 'win:gift2');
  } else { // the win streak: its flame, and the boosters it brings to the next level
    const hb = r.hotB || [], iw = Math.min(30 * s, (w - 56 * s) / Math.max(1, hb.length)), gw = 40 * s + hb.length * iw, fx = cx - gw / 2 + 20 * s;
    streakFlame(ctx, 'hot:win', fx, y + 30 * s, 38 * s, r.hot, G.t, save.calm);
    hb.forEach((b, j) => drawBoosterIcon(ctx, b, fx + 20 * s + (j + 0.5) * iw, y + 29 * s, Math.min(30 * s, iw * 1.05), G.t));
    ui.text(`${r.hot} wins in a row`, cx, hb.length ? l1 : y + 72 * s, { size: 14.5 * s, align: 'center', color: C.ink, maxW: tw, tag: 'win:hot' });
    if (hb.length) line2('Free next level', 'win:hot2');
  }
}
// the SHOP, big: a gold tile with the thing the coins reach (or the nearest one beyond them) on a bright disc, the
// purse's count (the win's coins fly here), and the blinking mark on its corner while there is something new
function winShopTile(r, x, y, w, h, s) {
  const M = shopMarkNow(), coins = save.wallet.coins, id = r.mark ? 'win:shop' : 'shop', grp = 'btn:' + id;
  const sig = `${coins}|${(save.wallet.skins || []).length}|${(save.wallet.henSkins || []).length}`;
  if (!r.shopT || r.shopT.sig !== sig) { // its pictures: the marked thing, then what the coins reach (dearest first), then the nearest beyond
    const own = markItems().filter((i) => !i.owned && (i.kind === 'skin' || i.kind === 'hen'));
    const can = own.filter((i) => i.price <= coins).sort((a, b) => b.price - a.price), far = own.filter((i) => i.price > coins).sort((a, b) => a.price - b.price);
    const lead = r.mark ? [{ key: r.mark, price: 0 }] : [];
    r.shopT = { sig, pics: lead.concat(can, far).filter((v, i, a) => a.findIndex((q) => q.key === v.key) === i).slice(0, 3) };
  }
  const pics = r.shopT.pics, B = ui.button(id, '', x, y, w, h, { kind: 'gold', shimmer: !!r.mark, shimmerOff: 60, round: 18 * s });
  const cy = B.cy, R = Math.min(33 * s, h * 0.37), dx = x + 14 * s + R;
  const disc = (px, rr, lit) => { ctx.beginPath(); ctx.arc(px, cy, rr, 0, 7); ctx.fillStyle = lit ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.3)'; ctx.fill(); ctx.lineWidth = 1.5 * s; ctx.strokeStyle = 'rgba(122,62,4,0.35)'; ctx.stroke(); };
  disc(dx, R, true);
  if (pics[0]) markArt(pics[0].key, dx, cy + 1 * s, R * 1.62); else shopIcon(ctx, dx, cy, R * 1.3);
  ui.record({ x: dx - R, y: cy - R, w: 2 * R, h: 2 * R }, 'win:shoppic', grp);
  // a lone tile (no spin beside it) is wide: two more pictures stand at its right end
  const more = w > 300 * s ? pics.slice(1) : [], r2 = R * 0.8, mx = x + w - 14 * s - more.length * (2 * r2 + 6 * s);
  more.forEach((it, i) => { const px = mx + r2 + i * (2 * r2 + 6 * s); disc(px, r2, it.price <= coins); markArt(it.key, px, cy + 1 * s, r2 * 1.62); });
  const tx = dx + R + 12 * s, tw = (more.length ? mx : x + w) - 10 * s - tx, sc = purse.pop();
  ui.text('Shop', tx, cy - 13 * s, { size: 25 * s, color: '#fff', stroke: '#8a4a04', strokeW: 4 * s, maxW: tw, tag: 'win:shopt', group: grp });
  const py = cy + 16 * s, px = tx + 10 * s;
  ctx.save(); if (sc !== 1) { ctx.translate(px, py); ctx.scale(sc, sc); ctx.translate(-px, -py); }
  drawCoin(ctx, px, py, 10 * s, G.t); purse.at({ x: px, y: py });
  ui.text(String(purse.shown()), px + 15 * s, py + 0.5 * s, { size: 17 * s, color: '#fff8e0', stroke: '#8a4a04', strokeW: 3 * s, maxW: tw - 25 * s, tag: 'win:shopc', group: grp });
  ctx.restore();
  if (M.on || r.mark) { const br = 11 * s; markBadge(x + w - br * 0.9, y + br * 0.7, br, G.t); }
}
// the LUCKY SPIN beside it: a spin waits = an orange tile with the machine, SPIN and how many; none waits = a quiet
// tile with the wins still to go (a tap opens the machine all the same: coins and videos turn it too)
function winSpinTile(x, y, w, h, s, leads) {
  const C = ui.C, M = SP.meter(save), n = M.bank, on = n > 0, grp = 'btn:spin';
  const B = ui.button('spin', '', x, y, w, h, { kind: on ? 'orange' : 'tertiary', shimmer: leads, round: 18 * s });
  const cy = B.cy, R = Math.min(33 * s, h * 0.37), dx = x + 14 * s + R, tx = dx + R + 12 * s, tw = x + w - 10 * s - tx;
  ctx.beginPath(); ctx.arc(dx, cy, R, 0, 7); ctx.fillStyle = on ? 'rgba(255,255,255,0.62)' : 'rgba(122,80,40,0.13)'; ctx.fill(); ctx.lineWidth = 1.5 * s; ctx.strokeStyle = on ? 'rgba(122,40,4,0.35)' : 'rgba(122,80,40,0.3)'; ctx.stroke();
  drawSlotIcon(ctx, dx - R * 0.06, cy, R * 0.74, save.calm ? 0 : G.t);
  ui.record({ x: dx - R, y: cy - R, w: 2 * R, h: 2 * R }, 'win:spinpic', grp);
  if (on) {
    ui.text('SPIN', tx, cy - 13 * s, { size: 25 * s, color: '#fff', stroke: '#692b04', strokeW: 4 * s, maxW: tw, tag: 'win:spint', group: grp });
    const sub = n > 1 ? `${n} free spins` : 'Free spin';
    ui.text(sub, tx, cy + 16 * s, { size: Math.min(16 * s, (tw * 16) / ui.measure(sub, 16)), color: '#fff8e0', stroke: '#692b04', strokeW: 3 * s, maxW: tw, tag: 'win:spinc', group: grp });
    const br = 11 * s; markBadge(x + w - br * 0.9, y + br * 0.7, br, G.t, String(n), !leads);
    return;
  }
  ui.text('Lucky Spin', tx, cy - 22 * s, { size: Math.min(18 * s, (tw * 18) / ui.measure('Lucky Spin', 18)), color: C.ink, maxW: tw, tag: 'win:spint', group: grp }); // shrinks whole, never cut
  for (let i = 0; i < M.of; i++) { // the wins that fill it
    const px = tx + 9 * s + i * 21 * s, got = i < M.have;
    ctx.beginPath(); ctx.arc(px, cy + 1 * s, 8 * s, 0, TAU); ctx.fillStyle = got ? '#fff6c8' : 'rgba(122,80,40,0.16)'; ctx.fill(); ctx.lineWidth = 1.8 * s; ctx.strokeStyle = got ? '#3a9a2c' : 'rgba(122,80,40,0.45)'; ctx.stroke();
    if (got) pictoCheck(ctx, px, cy + 1 * s, 14 * s);
  }
  ui.record({ x: tx, y: cy - 8 * s, w: M.of * 21 * s, h: 18 * s }, 'win:spinpips', grp);
  ui.text(`${M.left} more win${M.left > 1 ? 's' : ''}`, tx, cy + 23 * s, { size: 13.5 * s, color: C.ink2, maxW: tw, tag: 'win:spinc', group: grp });
}
function drawWinPage() {
  const r = G.result, u = ui.u, SH = winShow(r), k = winIn(r), e = k * k * (3 - 2 * k), inCard = k >= 1;
  const C = ui.C;
  if (!G.frzActive) { dim(0.62 + 0.18 * e); if (k >= 1 && r.t > SH + WIN_IN + 0.9) captureBack(); } // the board sinks under the page as the card comes; once still, it is kept
  { // rays over the whole page, then the drifting feathers (still under reduced motion)
    const A = ui.A;
    ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * e;
    sunburst(A.cx, A.y + A.h * 0.36, Math.max(ui.w, ui.h) * 0.85, 'rgba(255,226,140,0.07)', 16);
    const g = ctx.createRadialGradient(A.cx, A.y + A.h * 0.36, 0, A.cx, A.y + A.h * 0.36, Math.max(ui.w, ui.h) * 0.6);
    g.addColorStop(0, 'rgba(255,214,120,0.22)'); g.addColorStop(1, 'rgba(255,214,120,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, ui.w, ui.h);
    ctx.restore();
    winFeathers(0.35 + 0.5 * e);
  }
  let sd = cardSide(), cardO = sd ? sd.cardO : {};
  const side = !!sd;
  const pw = routinePower(r.stars), calm = save.calm, seed = G.level.id || 0;
  // the stage takes the room the rest of the card leaves (a tall phone: the full 184 units; a squat screen: less)
  // 0.8.16: measured from what this win really shows (it was a fixed guess, so a boss win with a treasure, a free try
  // and a spin ran over and the whole page was shrunk to fit: narrow, crowded and small)
  const A = ui.A, rowH = 100;
  let stH = 0, compact = false; // set below, once the rest is known
  // (compact: no room for her stage and none beside the card either: she shares the star row, left of the stars)
  const title = G.level.boss && G.li >= 0 ? 'Boss beaten!' : r.stars === 3 ? 'Perfect clutch!' : r.stars === 2 ? 'Great job!' : 'Vault cracked!';
  const BIG = bigStage(side);
  // confetti fired during the show keeps the show's geometry (full screen), so it does not jump when she flies to the card
  const fxBig = { cx: BIG.box.x + BIG.box.w / 2, gy: BIG.box.y + BIG.box.h - BIG.henH * 0.05, S: BIG.henH / 100, clip: BIG.full, until: SH + WIN_IN };
  const T = {}; // where her stage and the stars sit on the card: the targets of her flight
  const cnt = r.total ? clamp(r.shownTotal / r.total, 0, 1) : 1; // the coins count up with the score
  const WL = G.li >= 0 && !earlyDays() && SP.open(save) ? pageLead('win') : null; // (nothing is pointed at in the first levels)
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
          T.stars.forEach((p, q) => drawWinStar(r, q, p.x, p.y, T.R, calm)); // landed in the show: here they simply are
        } else T.stars.forEach((p) => drawStar(ctx, p.x, p.y, T.R, false, 1, true)); // the sockets wait on the card for the flying stars
        if (compact) ui.record(T.box, 'win:hen');
        ui.record(T.row, 'win:stars');
      } };
    B.push(starRow); // the stars on top
    if (!side && !compact) B.push({ h: stH * s, gap: 6 * s,
      at: (x, y, w) => { T.box = { x, y, w, h: stH * s }; T.henH = 0.685 * stH * s; T.clip = { x: 0, y: G.hudBottom, w: ui.w, h: y + stH * s - G.hudBottom }; },
      draw: () => { henStage(T.box, s, true); if (inCard) drawCelebration(ctx, r.cheer, r.t, T.box, { pw, calm, henH: T.henH, seed, clip: T.clip, fxBig }); ui.record(T.box, 'win:hen'); } });
    // level 1 (2026-11-20 first-five ladder): the stars, the hen and one big NEXT; nothing else to read or tap
    const first = G.li === 0 && G.level.id === 1;
    // how you did: each star's goal, ticked or crossed, with what happened (why it is 1 or 2 stars); the level's
    // bonus goal, when it has one, is a fourth line with a target instead of a star
    const goals = (r.goals || []).map((g) => [g.long, g.ok, g.res]);
    const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    if (r.hasBonus) goals.push(['Bonus goal', !!r.bonus, r.bonus ? 'Done' : 'Missed', 'target']);
    if (r.dare) goals.push([r.dare.long, r.dare.ok, r.dare.res, 'flame']); // the Pacer's dare, when one was taken
    const gh = 40 * s, GH = 30 * s + goals.length * gh + 6 * s;
    if (!first) B.push({ h: GH, gap: 10 * s, draw: (x, y, w) => {
      ui.well(x, y, w, GH, { s, a: '#f3e2bd', b: '#fbf0d6' });
      // the heading, and on its right your time (0.8.16: the time's own panel is gone)
      if (r.used != null) {
        ui.text('HOW YOU DID', x + 14 * s, y + 17 * s, { size: 14 * s, color: C.ink2, tag: 'win:howhead' });
        const tt = mmss(r.used), tw = ui.measure(tt, 15 * s);
        pictoClock(ctx, x + w - 22 * s - tw, y + 17 * s, 17 * s);
        ui.text(tt, x + w - 12 * s, y + 17 * s, { size: 15 * s, align: 'right', color: C.ink, tag: 'win:vclock' });
      } else ui.text('HOW YOU DID', x + w / 2, y + 16 * s, { size: 14 * s, align: 'center', color: C.ink2, tag: 'win:howhead' });
      const sr = 7.5 * s, gx = x + 12 * s;
      goals.forEach(([txt, ok, res, pic], i) => {
        const ry = y + 30 * s + i * gh + gh / 2;
        if (i) { ctx.fillStyle = 'rgba(122,80,40,0.16)'; ctx.fillRect(x + 10 * s, ry - gh / 2, w - 20 * s, 1.2 * s); }
        if (pic === 'flame') pictoFlame(ctx, gx + sr * 1.6, ry, 24 * s); else if (pic) pictoTarget(ctx, gx + sr * 1.6, ry, 24 * s); else drawStar(ctx, gx + sr * 1.6, ry, sr * 1.7, ok); // one star, one goal
        const ix = x + w - 22 * s;
        (ok ? pictoCheck : pictoCross)(ctx, ix, ry, 24 * s);
        const rw = ui.measure(res, 14.5 * s), tx = gx + sr * 3.6 + 8 * s, rx = ix - 18 * s;
        ui.text(res, rx, ry, { size: 14.5 * s, align: 'right', color: ok ? '#2d7a1c' : '#b3301c', maxW: w * 0.36, tag: 'win:res' + i });
        ui.text(txt, tx, ry, { size: 16 * s, color: ok ? C.ink : 'rgba(80,50,25,0.75)', maxW: rx - Math.min(rw, w * 0.36) - 10 * s - tx, tag: 'win:goal' + i });
      });
    } });
    // 0.8.16 what the win paid, in ONE panel (it was three: a time and coins panel, a "New in shop" bar, the score):
    // the score as a sum (mykee: "egg points, time bonus, the streak: what exactly are those?") Egg points + Time left
    // x streak; under its line the total with NEW BEST! or the best so far, and beside that the coins, counting up and
    // rolling into the purse
    const fmt = (n) => Math.round(n).toLocaleString('en-US');
    const terms = [['egg', fmt(r.eggScore), 'Egg points']];
    if (r.timeBonus) terms.push(['+'], ['clock', fmt(r.timeBonus), 'Time left']);
    if (r.streakMult > 1) terms.push(['x'], ['flame', 'x' + r.streakMult, '3-star streak']);
    const best = r.prevBest != null ? (r.total > r.prevBest ? 'new' : r.prevBest) : null, SH = ((best != null ? 126 : 108) + (r.online ? 16 : 0)) * s; // 0.8.17: the online line's room
    if (!first) B.push({ h: SH, gap: 8 * s, draw: (x, y, w) => {
      ui.well(x, y, w, SH, { s, a: '#f3e2bd', b: '#fbf0d6' });
      const ops = terms.filter((q) => q.length === 1).length, nt = terms.length - ops, ow = 16 * s, tw = (w - 12 * s - ops * ow) / nt;
      let tx = x + 6 * s;
      terms.forEach((q, i) => {
        if (q.length === 1) { ui.text(q[0], tx + ow / 2, y + 26 * s, { size: 20 * s, align: 'center', color: C.ink2, tag: 'win:op' + i }); tx += ow; return; }
        const [k2, v, lab] = q, mx = tx + tw / 2, vw = Math.min(ui.measure(v, 19 * s), tw - 30 * s), ix = mx - (vw + 26 * s) / 2 + 11 * s;
        if (k2 === 'egg') drawEggIcon(ctx, ix, y + 24 * s, 22 * s, 'saved'); else if (k2 === 'clock') pictoClock(ctx, ix, y + 24 * s, 22 * s); else pictoFlame(ctx, ix, y + 24 * s, 24 * s);
        ui.text(v, ix + 15 * s, y + 25 * s, { size: 19 * s, color: k2 === 'flame' ? C.warn : C.ink, maxW: tw - 30 * s, tag: 'win:v' + k2 });
        ui.text(lab, mx, y + 47 * s, { size: 12 * s, align: 'center', color: C.ink2, maxW: tw - 4 * s, tag: 'win:l' + k2 });
        tx += tw;
      });
      ctx.fillStyle = 'rgba(122,80,40,0.25)'; ctx.fillRect(x + 12 * s, y + 60 * s, w - 24 * s, 1.5 * s); // the line under a sum
      const LW = w * 0.62, ry = y + (best != null ? 82 : 84) * s; // left of the fold: the total; right of it: the coins
      ui.text('=', x + 20 * s, ry, { size: 24 * s, align: 'center', color: C.ink2, tag: 'win:eq' });
      ui.text('SCORE', x + 36 * s, ry, { size: 14 * s, color: C.ink2, tag: 'win:scorelab' });
      const labR = x + 36 * s + ui.measure('SCORE', 14 * s) + 8 * s, totW = x + LW - 8 * s - labR, tcx = labR + totW / 2; // the total keeps clear of its label
      ui.num(fmt(r.shownTotal), tcx, ry, { size: 32 * s, align: 'center', maxW: totW, tag: 'win:total' });
      if (best === 'new') { if (r.shownTotal >= r.total) { const bw = Math.min(120 * s, LW - 20 * s), bx = Math.max(x + 10 * s + bw / 2, Math.min(tcx, x + LW - 10 * s - bw / 2)); ui.ribbon('NEW BEST!', bx, y + 102 * s, bw, 21 * s, { s, color: '#3eaa2a', size: 13.5 * s, noRecord: true }); ui.record({ x: bx - bw / 2, y: y + 102 * s, w: bw, h: 21 * s }, 'win:best'); } }
      else if (best != null) ui.text('Best ' + fmt(best), tcx, y + 111 * s, { size: 14 * s, align: 'center', color: C.ink2, maxW: totW + 40 * s, tag: 'win:best' });
      ctx.fillStyle = 'rgba(122,80,40,0.25)'; ctx.fillRect(x + LW, y + 70 * s, 1.5 * s, SH - 80 * s); // the fold
      const ix = x + LW + 28 * s, iy = y + 62 * s + (SH - 62 * s) / 2 - 1 * s - (r.online ? 8 * s : 0); // (the online line sits under them)
      drawCoin(ctx, ix, iy, 13 * s, G.t);
      if (r.perkGold && !save.calm) goldGlints(ix, iy, s); // Midas (the Golden egg): the count-up shimmers
      drawWinCoins(r, ix, iy, w - LW - 4 * s, s, cnt, inCard); // the count-up, its roll into the purse, and the doubling moment
    } });
    // what this win unlocked. Each was shown big in its reveal a moment ago, so here it is a keepsake: one alone keeps
    // its row; two or three stand side by side as tiles (0.8.16: three full rows made the page too tall)
    const rowWell = (x, y, w, h, a, b) => ui.well(x, y, w, h, { s, a, b });
    const loot = [r.treasure && 'treasure', r.gift && 'gift', r.hot >= 2 && 'hot'].filter(Boolean);
    if (loot.length > 1) B.push({ h: 96 * s, gap: 8 * s, right: true, draw: (x, y, w) => {
      if (!inCard) return;
      const g = 8 * s, tw = (w - g * (loot.length - 1)) / loot.length;
      loot.forEach((k2, i) => winLootTile(r, k2, x + i * (tw + g), y, tw, 96 * s, s));
    } });
    else if (r.treasure) B.push({ h: 60 * s, gap: 8 * s, right: true, draw: (x, y, w) => { // the boss treasure, opened: the chest and what it gave
      if (!inCard) return;
      rowWell(x, y, w, 60 * s, '#ffe9b0', '#fff6dc');
      drawChest(ctx, x + 34 * s, y + 32 * s, 46 * s, G.t, 'open');
      ui.text('Boss treasure', x + 66 * s, y + 18 * s, { size: 15.5 * s, color: C.ink, maxW: w * 0.42, tag: 'win:tr' });
      tickLine('In your bag', x + 66 * s, y + 41 * s, 13 * s, { align: 'left', color: '#2d7a1c', maxW: w * 0.4, tag: 'win:tr2' });
      const its = treasureItems(r.treasure), iw = Math.min(46 * s, (w * 0.5) / 3);
      its.forEach(([k2, n], j) => { const ix = x + w - 8 * s - (2.5 - j) * iw; rewardIcon(k2, r.treasure, ix, y + 23 * s, 26 * s); ui.text(n, ix, y + 47 * s, { size: 13 * s, align: 'center', color: C.ink, maxW: iw - 2 * s, tag: 'win:tri' + j }); });
    } });
    else if (r.gift) B.push({ h: 64 * s, gap: 8 * s, right: true, draw: (x, y, w) => { // the taste: a store item, already on, for the next levels
      if (!inCard) return;
      const T = r.gift;
      rowWell(x, y, w, 64 * s, '#ffe9b0', '#fff6dc');
      tasteArt(T, x + 34 * s, y + 32 * s, (T.kind === 'hen' ? 54 : 50) * s, false);
      const tag = T.kind === 'boost' ? 'Added' : 'Equipped', bw = Math.max(72 * s, ui.measure(tag, 14 * s) + 22 * s), bx = x + w - bw - 8 * s; // the tag on the right
      ui.roundRect(bx, y + 19 * s, bw, 26 * s, 13 * s); ctx.fillStyle = '#3eaa2a'; ctx.fill();
      ui.text(tag, bx + bw / 2, y + 32 * s, { size: 14 * s, align: 'center', color: '#fff', maxW: bw - 10 * s, tag: 'win:equip' });
      ui.text('Free try: ' + tasteName(T), x + 66 * s, y + 21 * s, { size: 16 * s, color: C.ink, maxW: bx - x - 72 * s, tag: 'win:gift' });
      tickLine(T.kind === 'boost' ? '+1 in your bag' : 'On for the next ' + DR.DIR.skinLevels + ' levels', x + 66 * s, y + 44 * s, 13 * s, { align: 'left', color: '#2d7a1c', maxW: bx - x - 72 * s, tag: 'win:gift2' });
    } });
    else if (r.hot >= 2) B.push({ h: 56 * s, gap: 8 * s, right: true, draw: (x, y, w) => { // the win streak, and the boosters it brings to the next level
      if (!inCard) return;
      const hb = r.hotB || [];
      rowWell(x, y, w, 56 * s, '#ffe0cc', '#fff3ea');
      streakFlame(ctx, 'hot:win', x + 26 * s, y + 29 * s, 38 * s, r.hot, G.t, save.calm);
      const iw = 34 * s, ax = x + w - 8 * s - hb.length * iw;
      ui.text(r.hot + ' wins in a row', x + 50 * s, y + (hb.length ? 18 : 28) * s, { size: 15.5 * s, color: C.ink, maxW: ax - x - 56 * s, tag: 'win:hot' });
      if (hb.length) tickLine('Free next level', x + 50 * s, y + 39 * s, 13 * s, { align: 'left', color: '#2d7a1c', maxW: ax - x - 56 * s, tag: 'win:hot2' });
      hb.forEach((b, j) => drawBoosterIcon(ctx, b, ax + (j + 0.5) * iw, y + 28 * s, 30 * s, G.t));
    } });
    // 0.8.16 (mykee: "the shop icon should be highlighted, a bigger kind of thing. Right now we added a horizontal
    // bar"): the two places this win's coins can go stand as two big tiles above the buttons: the SHOP (gold, the thing
    // the coins reach pictured on it, the purse's count, the blinking mark) and the LUCKY SPIN (orange with its count
    // when a spin waits; quiet with the wins still to go when none does). Not in the early days, not in Practice.
    if (r.mark === undefined) { const M = shopMarkNow(); r.mark = !first && M.on && M.pick ? M.pick.key : null; }
    const spinLeads = !!(WL && WL.lead && WL.lead.id === 'spin');
    if (!first && !earlyDays() && G.li >= 0) B.push({ h: 92 * s, gap: 10 * s, right: true, draw: (x, y, w) => {
      if (!inCard || revealing(r)) return;
      const g = 10 * s, tw = WL ? (w - g) / 2 : w;
      winShopTile(r, x, y, tw, 92 * s, s);
      if (WL) winSpinTile(x + tw + g, y, tw, 92 * s, s, spinLeads);
    } });
    const last = G.li < 0 || G.li === LEVELS.length - 1, nextLeads = !spinLeads;
    B.push({ h: 58 * s, gap: 12 * s, right: true, draw: (x, y, w) => {
      if (!inCard) return;
      if (first) { ui.button('next', 'NEXT', x, y, w, 58 * s, { kind: 'primary', shimmer: true, icon: ICON.next, size: 26 * s }); return; }
      const rw = w * 0.36;
      ui.button('restart', 'Retry', x, y, rw, 58 * s, { kind: 'secondary', icon: ICON.retry, size: 19 * s });
      ui.button('next', last ? 'ALL LEVELS' : 'NEXT', x + rw + 10 * s, y, w - rw - 10 * s, 58 * s, { kind: 'primary', shimmer: nextLeads, icon: ICON.next, size: 24 * s });
    } });
    if (!earlyDays() && (r.chest || r.dblOk !== false || G.doubled)) B.push({ h: 48 * s, right: true, draw: (x, y, w) => { // nothing advertised before L3 is won (the Double coins video too); 0.8.17: none once the day's win-video pot is spent
      if (!inCard) return;
      if (r.chest && !G.doubled) { // the Bonus chest: one video, the chest, its coins and its boost shown as art on the button
        const bw = w, bx = x, ch = r.chest, B2 = ui.button('bonus', '', bx, y, bw, 48 * s, { kind: 'ad', shimmer: true });
        let cx = bx + 14 * s;
        const cy = B2.cy;
        if (!ads.premium) { drawAdBadge(ctx, cx, cy, 24 * s, 17 * s); cx += 30 * s; } // Premium: no video, the chest opens at once
        drawChest(ctx, cx + 17 * s, cy + 3 * s, 34 * s, G.t, 'ready'); cx += 40 * s;
        const ax = bx + bw - 16 * s; // what is inside, as art: a boost and coins
        drawBoosterIcon(ctx, ch.booster, ax - 14 * s, cy, 30 * s, G.t); drawCoin(ctx, ax - 40 * s, cy + 6 * s, 9 * s, G.t); drawCoin(ctx, ax - 48 * s, cy - 3 * s, 9 * s, G.t + 1);
        ui.text('Bonus chest', cx, cy, { size: 17 * s, maxW: ax - 60 * s - cx, color: '#fff', stroke: '#2b1566', strokeW: 3 * s, tag: 'win:bonus', group: 'btn:bonus' });
      } else if (!G.doubled) ui.button('double', (r.coins || 0) > 0 ? `Double coins: +${r.coins}` : 'Double', x, y, w, 48 * s, { kind: 'ad', ad: true, size: 16 * s });
      else ui.text(r.chestOpen ? 'Bonus chest opened!' : 'Coins doubled!', x + w / 2, y + 24 * s, { size: 18 * s, align: 'center', color: C.good, tag: 'win:doubled' });
    } });
    return B;
  };
  const RIB = '#f0542e';
  { // her stage takes what the rest leaves; under 100 units she moves beside the stars
    const fixed = build(1).reduce((a, b) => a + (b.gap ?? 10) + b.h, 0), room = (A.y1 - Math.max(G.hudBottom, A.y) - 30 * u) / u - CARD_HEAD - 22 - fixed;
    compact = !side && room < 78; stH = clamp(room, 78, 230);
  }
  let card = stackCard(title, build, { ...cardO, hidden: true }); // lay out first: her flight needs the targets
  // 0.8.15 a short wide screen (a phone on its side, a browser window): one column there shrank to small print and
  // tiny buttons. The card opens into two columns (the stars and their goals; the score, the rewards and the buttons),
  // her patch keeps at least 200 units beside it
  if (side && card.s < 0.8 * u && G.li !== 0) {
    const maxW = A.w - 248 * u, c2 = maxW >= 360 * u ? stackCard(title, build, { hidden: true, twoCol: true, maxW }) : null;
    if (c2 && c2.s > card.s * 1.15) {
      const sw = Math.min(A.w - c2.w - 48 * u, Math.max(c2.w * 0.6, 300 * u)), left = A.x + (A.w - (sw + 16 * u + c2.w)) / 2;
      sd = { x: left, w: sw, big: true }; cardO = { cx: left + sw + 16 * u + c2.w / 2, maxW, twoCol: true };
      card = stackCard(title, build, { ...cardO, hidden: true });
    }
  }
  if (side) { const ss = sideStage(sd, card); T.box = ss.box; T.henH = ss.henH; T.clip = ss.box; }
  // the card slides in: up from below (portrait), in from the right (landscape)
  const dx = side ? (1 - e) * (ui.w - card.x + 20 * u) : 0, dy = side ? 0 : (1 - e) * (ui.h - card.y + 20 * u);
  // the show's big title under her feet: it fades as the card (which has its own) comes, and the card passes over it
  const ta = save.calm || r.rvDone != null || (revealing(r) && r.t >= SH) ? 0 : 1 - ss01((r.t - SH + 0.15) / 0.3); // gone under the reward reveals
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
  if (inCard) { winFinish(r, BIG, calm); return; }
  // the show, and her flight into the card: everything eases from the big layout to its card spot (which slides with the card)
  const tdx = side ? 0 : dx, tdy = side ? 0 : dy; // in landscape her stage does not slide, only the card
  const L = (a, b2) => a + (b2 - a) * e;
  const fq = r.stars === 3 && !calm ? (r.t - starAt(r, 2) - 0.06) / 0.42 : -1, hop = fq > 0 && fq < 1 ? Math.sin(fq * Math.PI) * BIG.henH * 0.16 * (1 - e) : 0; // three of three: she jumps with the finish
  const box = { x: L(BIG.box.x, T.box.x + tdx), y: L(BIG.box.y, T.box.y + tdy) - Math.sin(e * Math.PI) * ui.h * 0.05 - hop, w: L(BIG.box.w, T.box.w), h: L(BIG.box.h, T.box.h) };
  if (k <= 0 && !calm) { // the show: rays turn behind her
    ctx.save(); ctx.globalAlpha = Math.min(1, r.t * 3);
    sunburst(BIG.box.x + BIG.box.w / 2, BIG.box.y + BIG.box.h - BIG.henH * 0.55, Math.max(ui.w, ui.h) * 0.75, 'rgba(255,236,170,0.1)', 14);
    ctx.restore();
  }
  const henH = L(BIG.henH, T.henH);
  drawCelebration(ctx, r.cheer, r.t, box, { pw, calm, henH, seed, clip: BIG.full, fxBig });
  // the stars: big over her in the show; small at the top of the page through the reward reveals; then into the card
  const rvOn = revealing(r) && r.t >= SH, MINI = rvOn || r.rvDone != null ? miniStars() : null;
  const m = !MINI ? 0 : rvOn && !calm && r.rv.i === 0 ? ss01(r.rv.t / 0.4) : 1, from = { x: box.x + box.w / 2, y: box.y + box.h - henH * 0.62 };
  const stars = () => BIG.stars.forEach((p, q) => {
    const x0 = m ? lerp(p.x, MINI.stars[q].x, m) : p.x, y0 = m ? lerp(p.y, MINI.stars[q].y, m) : p.y, R0 = m ? lerp(BIG.R, MINI.R, m) : BIG.R;
    drawWinStar(r, q, L(x0, T.stars[q].x + dx), L(y0, T.stars[q].y + dy), L(R0, T.R), calm, from);
  });
  if (rvOn) { drawReveal(r, stars); return; }
  if (r.rvDone != null && !calm) { const q = (G.t - r.rvDone) / 0.3; if (q < 1) dim(0.84 * (1 - q)); } // the reveals' shade lifts as the card comes
  winFinish(r, BIG, calm);
  stars();
}
// three stars of three: rays sweep out from the row and confetti is thrown over the page (it goes on falling over the card)
function winFinish(r, BIG, calm) {
  if (calm || r.stars !== 3 || r.rvDone != null) return;
  const t = r.t - starAt(r, 2) - 0.06, c = BIG.stars[1], R = BIG.R;
  if (t <= 0 || t > 2) return;
  if (t < 0.7) { const a = t / 0.7; ctx.save(); ctx.globalAlpha = (1 - a) * 0.9; CB.rays(ctx, c.x, c.y + R * 0.4, R * (3 + 8 * CB.easeOut(a)), a * 0.8, 'rgba(255,240,170,0.45)', 14, 0.4); ctx.restore(); }
  CB.confetti(ctx, c.x, c.y, t, { n: 56, speed: R * 24, g: R * 20, life: 2, seed: 3, size: Math.max(6, R * 0.26), spread: Math.PI * 1.5 });
}

// 0.8.9 (mykee: "treasures and freebies need to be shown in the celebration... unlocked right after it, not on the map"):
// after her show, one big reveal per thing this win unlocked (the boss treasure, a free try, the win streak's free boosters).
// 0.8.15 (mykee: "a proper cool celebratory animation on the gifts and unlockables"): each reveal is an event in four
// beats, built from one kit (render/celebrate.js):
//   arrival (0 .. land): the page dims deeper, rays turn, the hero (chest, gift box, flame) drops in and bounces;
//   anticipation (.. open): it shakes and glows harder (the chest's lid rattles over a line of light, the box wobbles,
//     the flame swells while its count runs up);
//   the open: a burst of light and confetti; what is inside jumps out one by one in an arc and lands in a row, each with
//     a pop and a tick, the coins' count rolling up (a free try: the character itself rises out of the box into a
//     spotlight with a ring of sparkles and a name ribbon);
//   the claim (after a hold): the coins fly to the purse, boosters and charges to the bag (bottom right), each with a
//     landing flash; then the next reveal or the card.
// About 2.6 to 3 s each untouched. A tap jumps to the open state (everything out, landed), the next tap moves on.
// Reduced motion: each one a still of its open state for 1 s.
const RV_ARC = 0.38, RV_FLY = 0.42; // s: a thing's jump out of the hero, and its flight to where it lives
const REVEAL_SND = { treasure: ['treasure_open'], gift: ['unlock'], hot: ['combo', { intensity: 1 }] }; // 2026-11-23: the treasure's own music, not the win sting again
// one reveal's clock (s) and its sounds, worked out once
function rvPlan(r, it) {
  if (it.P) return it.P;
  const kind = it.kind, n = kind === 'treasure' ? 3 : kind === 'hot' ? r.hotB.length : 1, fly = kind !== 'gift' || r.gift.kind === 'boost';
  const land = 0.3, open = 0.9, pop = (j) => open + 0.1 + 0.13 * j, set = pop(n - 1) + RV_ARC + 0.1;
  const claim = set + (kind === 'gift' ? 0.9 : 0.6), end = fly ? claim + 0.07 * (n - 1) + RV_FLY + 0.3 : claim + 0.15;
  const cues = [[open, () => { audio.play(...REVEAL_SND[kind]); audio.play('confetti'); buzz(kind === 'treasure' ? 'treasure' : 'win'); }]];
  if (kind === 'hot') { const c = Math.min(8, r.hot - 1); for (let q = 1; q <= c; q++) cues.push([land + 0.1 + (q / c) * (open - land - 0.15), () => audio.play('score_tick', { vol: 0.4, pitch: 1 + 0.1 * q })]); } // the count runs up
  else {
    cues.push([0, () => audio.play('flap', { vol: 0.5 })], [land, () => { audio.play('egg_land', { vol: 0.8 }); buzz('tick'); }]);
    for (const q of [0.48, 0.62, 0.76]) cues.push([q, () => { audio.play('ring_tick', { vol: 0.7 }); buzz('tick'); }]); // the rattle
  }
  for (let j = 0; j < n; j++) cues.push([pop(j) + RV_ARC, () => { audio.play('hud_pop', { vol: 0.7, pitch: 1 + 0.12 * j }); buzz('tick'); }]); // each thing lands in the row
  if (kind === 'treasure') for (let q = 1; q < 7; q++) cues.push([pop(0) + RV_ARC + 0.07 * q, () => audio.play('score_tick', { vol: 0.3, pitch: 1 + 0.1 * q })]); // the coins count up
  cues.push([claim, () => rvClaim(r, it)]);
  if (fly) for (let j = kind === 'treasure' ? 1 : 0; j < n; j++) cues.push([claim + 0.07 * j + RV_FLY, () => { audio.play('hud_pop', { vol: 0.45, pitch: 1.3 }); buzz('tick'); }]); // into the bag (the purse has its own landing)
  return (it.P = { land, open, pop, set, claim, end, n, fly, cues });
}
// 0.8.17 the reveal's landing (ui/landing.js): from its first frame the purse chip (the count before) and the bag chip
// stand top right on the page; at the claim the treasure's coins fly from the row into the purse, its booster and charges
// (or a free try's booster) into the bag, which then shows them with how many there are now
function rvLand(r, it) {
  if (it.landOn || !(it.kind === 'treasure' || (it.kind === 'gift' && r.gift.kind === 'boost'))) return;
  it.landOn = true;
  const g = rvGeom(), A = ui.A, u = ui.u, p0 = (r.purse0 ?? save.wallet.coins) + (r.trFlown && it.kind !== 'treasure' && r.treasure ? r.treasure.coins : 0);
  if (it.kind === 'treasure') {
    const R = r.treasure, sp = Math.min(g.S * 0.38, (A.w - 30 * u) / 3), isz = g.S * 0.3, at = (j) => ({ x: g.cx + (j - 1) * sp, y: g.rowY });
    land.start({ wait: true, from: p0, to: p0 + R.coins, src: at(0), items: [
      { art: 'boost:' + R.booster, src: at(1), size: isz / 0.82, ...landWhere('boost:' + R.booster) },
      { art: 'charge', src: at(2), size: isz, draw: (c, x, y, S) => pictoPower(c, 'thunder', x, y, S * 0.95, G.t), dest: 'bag', n: save.wallet.charges }] });
  } else land.start({ wait: true, from: p0, to: p0, items: [{ art: 'boost:' + r.gift.id, src: { x: g.cx, y: g.heroY }, size: g.S * 0.76, ...landWhere('boost:' + r.gift.id) }] });
}
// the claim: what is in the row sets off for the purse and the bag (once)
function rvClaim(r, it) {
  rvLand(r, it);
  if (it.landOn && !it.claimed) { it.claimed = true; land.go(); }
  if (it.kind === 'treasure' && !r.trFlown && r.purse0 != null) r.trFlown = true; // (the win's own coins follow on the card)
}
function rvNext(r) {
  const RV = r.rv;
  rvClaim(r, RV.list[RV.i]);
  land.finish(); land.clear(); // (a tap while it flew: all of it landed at once, nothing lost)
  RV.i++; RV.t = 0;
  if (!revealing(r)) { r.rvDone = G.t; CB.releaseCelebrate(); }
}
// a tap: to the open state (all of it out and landed), then on
function rvTap(r) {
  const RV = r.rv, it = RV.list[RV.i], P = rvPlan(r, it);
  if (it.claimed && land.busy()) { land.finish(); return; } // coins in the air: the first tap lands them all, the next moves on
  if (save.calm || RV.t >= P.set) { rvNext(r); return; }
  if (RV.t < P.open) { audio.play(...REVEAL_SND[it.kind]); buzz('win'); }
  RV.t = P.set;
}
// the reveals' layout (the hero in the upper middle, a row under it, the headline ribbon on top)
function rvGeom() {
  // 0.8.17: on a phone held upright the top row is the purse's and the bag's (ui/landing.js): the reveal starts under it
  const A = ui.A, u = ui.u, top = A.h > A.w ? 62 * ui.u : 0, S = Math.min(A.w * 0.9, (A.h - top) * 0.46, 420 * u), cy = A.y + top + (A.h - top) * 0.52;
  const ls = Math.max(17 * u, Math.min(27 * u, 0.085 * S)); // the lines of words
  // room: the free height under the last line of words (the bag and, on a short screen, the stars live there); a wide screen has the corners free anyway
  return { S, cx: A.cx, cy, top, heroY: cy - 0.3 * S, rowY: cy + 0.27 * S, hy: cy - 0.98 * S, hs: Math.min(39 * u, 0.12 * S), ls, room: A.w > A.h * 1.15 ? 1e4 : A.y1 - 8 * u - (cy + 0.74 * S + ls * 0.8) };
}
// where the stars wait through the reveals: a small row above the headline (no room there: the bottom left corner,
// across from the bag, under the last line of words)
function miniStars() {
  const A = ui.A, u = ui.u, g = rvGeom(), R1 = Math.min(20 * u, A.w * 0.052), top = g.hy - g.hs * 0.85 - A.y - g.top, mid = top >= 2 * R1 + 12 * u, R = mid ? R1 : Math.min(R1, g.room / 2.3);
  const x0 = mid ? A.cx : A.x + 14 * u + 3.3 * R, y = mid ? A.y + g.top + top / 2 : A.y1 - 8 * u - R * 1.1; // (under the purse's row)
  return { R, stars: [0, 1, 2].map((q) => ({ x: x0 + (q - 1) * 2.3 * R, y: y - (mid && q === 1 ? R * 0.3 : 0) })) };
}
const eggName = (n) => n.replace(/ Egg$/, '') + ' Egg'; // the skins' names: "Robo Egg" and "Galaxy" alike
const backK = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2); // a pop that overshoots
// what a boss treasure holds, as [art, count, label] (the reveal and the card's row)
const treasureItems = (R) => [['coin', '+' + R.coins, 'coins'], ['boost', '+1', (E.BOOSTERS[R.booster] || {}).name || 'Booster'], ['charge', '+' + R.charges, 'Chick Charges']];
function rewardIcon(k, R, x, y, sz) {
  if (k === 'coin') drawCoin(ctx, x, y, sz * 0.42, G.t); else if (k === 'boost') drawBoosterIcon(ctx, R.booster, x, y, sz, G.t); else pictoPower(ctx, 'thunder', x, y, sz * 0.95, G.t);
}
// one line under a reveal or in a card row: a green tick, then the words
function tickLine(str, x, y, size, o = {}) {
  if (o.fit) size = Math.min(size, o.fit * 20 / (ui.measure(str, 20) + 28)); // a long line shrinks whole (tick and words), never cut
  const tw = ui.measure(str, size), w = size * 1.35 + tw, x0 = o.align === 'left' ? x : x - w / 2;
  if (o.coin) drawCoin(ctx, x0 + size * 0.5, y, size * 0.5, G.t); else pictoCheck(ctx, x0 + size * 0.5, y, size * 1.15); // (o.coin: a line about coins still to find is not a tick)
  ui.text(str, x0 + size * 1.35, y, { size, color: o.color || '#fff', stroke: o.stroke, strokeW: o.stroke ? Math.max(2, size * 0.2) : undefined, maxW: o.maxW ? o.maxW - size * 1.35 : undefined, tag: o.tag });
}
// a taste's art (the reveal's hero, the card's row): the egg skin, the hen in the outfit (alive: she cheers), the chick, the booster
const tasteName = (T) => (T.kind === 'skin' ? eggName(T.name) : T.name);
const tasteLine = (T) => (T.kind === 'boost' ? '+1 in your bag' : `${T.kind === 'skin' ? 'On your eggs for' : T.kind === 'hen' ? 'On your hen for' : 'Free to use for'} the next ${DR.DIR.skinLevels} levels`);
function tasteArt(T, x, y, h, live) {
  if (T.kind === 'skin') drawSkinPreview(ctx, T.id, x, y, h * 0.92, G.t);
  else if (T.kind === 'hen') {
    if (!live) { drawHenSkinPreview(ctx, T.id, x, y, h, G.t); return; }
    setHenSkin(T.id);
    try { drawHenAnim(ctx, 'happy', x, y, h, G.t, { key: 'taste', face: 1, n: Math.floor(G.t / 1.7), calm: save.calm, shadow: 0 }); } finally { setHenSkin(G.henSkinCur || 'classic'); }
  } else if (T.kind === 'chick') drawStrikeChick(ctx, T.id, x, y + h * 0.1, h * 0.82, G.t, {});
  else drawBoosterIcon(ctx, T.id, x, y, h * 0.82, G.t);
}
// 0.8.9 TASTE: every reveal is big and sits in the middle of the page (mykee: "never small visuals")
function drawReveal(r, drawStars) {
  const RV = r.rv, it = RV.list[RV.i], calm = save.calm, A = ui.A, u = ui.u, ink = 'rgba(60,28,6,0.9)', P = rvPlan(r, it);
  const t = calm ? P.set + 0.3 : RV.t, fin = calm ? 1 : clamp(RV.t / 0.18, 0, 1);
  dim(0.84 * (RV.i ? 1 : fin)); // the show sinks under the first one (deep: the prize alone on the page)
  const { S, cx, cy, heroY, rowY, hy, hs, ls, room } = rvGeom();
  const opened = t >= P.open, oa = t - P.open; // oa: seconds since it opened
  const ant = calm || opened ? 0 : clamp((t - P.land - 0.12) / (P.open - P.land - 0.12), 0, 1); // the anticipation builds
  ctx.save(); ctx.globalAlpha = fin; // rays and a warm glow behind the prize (the glow beats harder before it opens)
  CB.rays(ctx, cx, heroY, S * 1.25, calm ? 0.13 : G.t * 0.12, 'rgba(255,226,140,0.17)', 14);
  if (!calm && !PERF.low) CB.rays(ctx, cx, heroY, S * 0.85, -G.t * 0.2, 'rgba(255,244,200,0.09)', 9, 0.32);
  CB.glow(ctx, cx, heroY, S * (0.75 + 0.1 * ant * Math.abs(Math.sin(t * 16))), 0.5 + 0.35 * ant);
  ctx.restore();
  if (drawStars) drawStars(); // the win's stars, small on top: never lost
  // the hero's arrival: it falls in, lands with a squash and a small bounce, then shakes harder and harder
  const lp = calm ? 1 : clamp(t / P.land, 0, 1), bq = calm ? 1 : clamp((t - P.land) / 0.24, 0, 1);
  const off = lp < 1 ? -(heroY - A.y + S * 0.7) * (1 - lp * lp) : -S * 0.06 * Math.sin(bq * Math.PI), sq = lp >= 1 && bq < 0.45 ? 1 - 0.16 * Math.sin((bq / 0.45) * Math.PI) : 1;
  const shake = ant ? Math.sin(t * 58) * 0.085 * ant : 0;
  const hero = (fy, draw) => { ctx.save(); ctx.translate(cx, fy + off); ctx.rotate(shake); ctx.scale(1 / sq, sq); ctx.translate(-cx, -fy); draw(); ctx.restore(); };
  const fx = (col) => { // the open: light, then confetti over everything but the words
    if (calm || !opened) return;
    CB.burst(ctx, cx, heroY, S * 0.72, oa / 0.6, col);
    CB.confetti(ctx, cx, heroY, oa, { n: 46, speed: S * 1.9, g: S * 1.5, life: 1.9, seed: RV.i + 5, size: Math.max(6, S * 0.026) });
  };
  // where things go at the claim: the purse (top right, ui/purse.js floats it there), the bag (bottom right)
  const purseAt = { x: A.x1 - 82 * u, y: A.y + 28 * u }, bagS = Math.min(84 * u, S * 0.27, room * 0.92), bagAt = { x: A.x1 - 16 * u - bagS * 0.6, y: A.y1 - 8 * u - bagS * 0.56 }; // the bag keeps clear of the last line of words
  let bagN = 0; // things on their way to the bag this reveal
  const late = []; // things in flight to where they live: drawn over the words
  rvLand(r, it); // the purse and bag chips, on the page from its first frame (ui/landing.js flies the treasure and a free booster)
  const byLand = !!it.landOn;
  // one thing that jumps out of the hero (j: its turn), lands at (sx, sy), and at the claim flies to dst
  const item = (j, sx, sy, dst, draw) => {
    const t0 = P.pop(j), a = calm ? 1 : clamp((t - t0) / RV_ARC, 0, 1);
    if (a <= 0) return 0;
    const f0 = byLand ? P.claim + (j ? 0.1 + 0.14 * (j - 1) : 0) : P.claim + 0.07 * j, fl = calm || !P.fly ? 0 : clamp((t - f0) / RV_FLY, 0, 1);
    if (byLand && fl > 0) return 2; // the landing flies it from here
    if (dst === bagAt && !byLand) bagN++;
    if (fl >= 1) { CB.landFlash(ctx, dst.x, dst.y, 26 * u, (t - f0 - RV_FLY) / 0.3); return 2; }
    let x, y, sc, rot = 0;
    if (fl > 0) { const e = fl * fl; [x, y] = CB.arcPt(sx, sy, dst.x, dst.y, e, dst === bagAt ? S * 0.32 : S * 0.05, dst === bagAt ? 0 : -S * 0.3); sc = 1 - 0.62 * e; rot = (dst === bagAt ? 1 : -1) * e * 1.2; }
    else {
      [x, y] = CB.arcPt(cx, heroY, sx, sy, a, S * 0.46, 0);
      const h = t - t0 - RV_ARC; sc = a < 1 ? 0.3 + 0.7 * a : 1 + (calm || h > 0.22 ? 0 : 0.24 * Math.sin((h / 0.22) * Math.PI)); rot = (1 - a) * (j % 2 ? 1.6 : -1.6);
      if (!calm && h > 0 && h < 0.3) CB.landFlash(ctx, sx, sy, S * 0.16, h / 0.3);
    }
    const put = () => { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc); draw(); ctx.restore(); };
    if (fl > 0) late.push(put); else put();
    return a >= 1 && fl < 0.05 ? 1 : 0; // 1: it stands in the row (its words show)
  };
  if (it.kind === 'treasure') {
    const R = r.treasure, items = treasureItems(R), cs = S * 0.8;
    hero(heroY + cs * 0.4, () => {
      if (!opened) { // closed: its lid rattles over a line of light
        drawChest(ctx, cx, heroY, cs, 0, 'ready');
        CB.chestLid(ctx, cx, heroY, cs, ant * 0.055 * (0.5 + 0.5 * Math.sin(t * 44)), ant * 0.045 * Math.sin(t * 31));
      } else { // it springs open
        const j = calm || oa > 0.26 ? 0 : Math.sin((oa / 0.26) * Math.PI) * 0.2;
        ctx.translate(cx, heroY + cs * 0.4); ctx.scale(1 - j * 0.5, 1 + j); ctx.translate(-cx, -(heroY + cs * 0.4));
        drawChest(ctx, cx, heroY, cs, G.t, 'open');
      }
    });
    fx('#fff3b0');
    // what was inside jumps out of the chest into a row; at the claim the coins fly to the purse, the rest to the bag
    const sp = Math.min(S * 0.38, (A.w - 30 * u) / 3), isz = S * 0.3, ns = Math.max(20 * u, isz * 0.34);
    it.src = { x: cx - sp, y: rowY };
    items.forEach(([k, n, lab], j) => {
      const sx = cx + (j - 1) * sp;
      if (item(j, sx, rowY, k === 'coin' ? purseAt : bagAt, () => rewardIcon(k, R, 0, 0, isz)) !== 1) return;
      const num = k === 'coin' && !calm ? '+' + CB.rollTo(R.coins, (t - P.pop(j) - RV_ARC) / 0.5) : n; // the coins count up
      ui.text(num, sx, rowY + isz * 0.7, { size: ns, align: 'center', color: '#fff6c8', stroke: ink, strokeW: 4.5 * u, tag: 'rv:n' + j });
      ui.text(lab, sx, rowY + isz * 0.7 + ns, { size: Math.min(ls * 0.82, (sp - 10 * u) * 20 / ui.measure(lab, 20)), align: 'center', color: '#fff', stroke: ink, maxW: sp - 6 * u, tag: 'rv:l' + j });
    });
    if (t > P.set - 0.25 && !byLand) tickLine('Added to your bag', cx, cy + 0.74 * S, ls, { stroke: ink, fit: A.w - 36 * u, tag: 'rv:line' }); // (0.8.17: the bag chip shows it)
  } else if (it.kind === 'gift') { // a taste: it comes in a gift box; out of it rises the item itself, alive, in a spotlight
    const T = r.gift, bs = S * 0.6, by = heroY + S * 0.08, ha = calm ? 1 : clamp(oa / 0.42, 0, 1);
    if (opened) CB.spotlight(ctx, cx, 0, heroY + S * 0.39, S * 0.1, S * 0.5, ha);
    if (!calm && oa < 0.7) hero(by + bs * 0.4, () => CB.giftBox(ctx, cx, by, bs, opened
      ? { lidX: oa * S * 0.55, lidY: -(2.8 * oa - 1.7 * oa * oa) * S, lidRot: oa * 7, lidA: 1 - oa / 0.7, bodyA: 1 - clamp((oa - 0.1) / 0.3, 0, 1) } // the lid flies off, the box fades under what was in it
      : { lidY: -ant * bs * 0.05 * (0.5 + 0.5 * Math.sin(t * 44)), lidRot: ant * 0.07 * Math.sin(t * 31) }));
    fx('#e8f6ff');
    if (opened) {
      const fl = calm || !P.fly ? 0 : clamp((t - P.claim) / RV_FLY, 0, 1); // a booster leaves for the bag; a chick, a skin, an outfit stays (it is on)
      if (P.fly && !byLand) bagN++;
      if (byLand && fl > 0) { /* the landing flies it to the bag chip */ }
      else if (fl >= 1) CB.landFlash(ctx, bagAt.x, bagAt.y, 26 * u, (t - P.claim - RV_FLY) / 0.3);
      else {
        const k = calm ? 1 : backK(ha), [x, y] = fl > 0 ? CB.arcPt(cx, heroY, bagAt.x, bagAt.y, fl * fl, S * 0.3, 0) : [cx, heroY + (1 - CB.easeOut(ha)) * S * 0.16];
        const still = T.kind === 'skin' || T.kind === 'boost', sc = k * (1 - 0.72 * fl * fl);
        const put = () => {
          ctx.save(); ctx.translate(x, y + (still && !calm ? Math.sin(G.t * 2.6) * S * 0.012 : 0)); ctx.scale(sc, sc);
          if (still) ctx.rotate(calm ? 0 : Math.sin(G.t * 3) * 0.06);
          tasteArt(T, 0, 0, S * (still ? 0.76 : 0.66), true); ctx.restore(); // a chick's crest and a jumping hen stay clear of the headline
        };
        if (fl > 0) late.push(put); else put();
        if (fl <= 0 && ha >= 1) CB.sparkleRing(ctx, cx, heroY, S * 0.5, S * 0.43, calm ? 1.3 : G.t, 10, S * 0.05);
      }
    }
    if (calm || oa > 0.32) { // its name, on a ribbon that pops in
      const ns = Math.min(34 * u, 0.105 * S), nm = tasteName(T), rh = ns * 1.6, rw = Math.min(A.w - 40 * u, ui.measure(nm, ns) + 70 * u), ny = cy + 0.2 * S, pk = calm ? 1 : backK((oa - 0.32) / 0.3);
      ctx.save(); ctx.translate(cx, ny); ctx.scale(pk, pk); ctx.translate(-cx, -ny);
      ui.ribbon(nm, cx, ny - rh * 0.55, rw, rh, { color: '#d89a1c', size: ns, noRecord: true });
      ctx.restore();
      ui.record({ x: cx - rw / 2, y: ny - rh * 0.55, w: rw, h: rh * 1.2 }, 'rv:name');
    }
    if (calm || oa > 0.5) { // "From the shop", with the shop's own icon: where it lives
      const fs = ls * 0.85, fw = ui.measure('From the shop', fs) + fs * 1.7, fxx = cx - fw / 2;
      shopIcon(ctx, fxx + fs * 0.7, cy + 0.38 * S, fs * 1.9);
      ui.text('From the shop', fxx + fs * 1.7, cy + 0.38 * S, { size: fs, color: '#ffe9b0', stroke: ink, tag: 'rv:shop' });
    }
    if (calm || oa > 0.65) tickLine(tasteLine(T), cx, cy + 0.6 * S, ls, { stroke: ink, fit: A.w - 36 * u, tag: 'rv:line' });
  } else { // the win streak: the flame catches and swells while its count runs up, then throws out the boosters the next level starts with
    const ig = calm ? 1 : backK(t / 0.32), cnt = calm || opened ? r.hot : Math.max(1, Math.round(1 + (r.hot - 1) * ant));
    const sw = calm ? 1 : opened ? 1 + (oa < 0.3 ? 0.28 * Math.sin((oa / 0.3) * Math.PI) : 0) : 1 + 0.14 * ant + 0.03 * ant * Math.sin(t * 38);
    ctx.save(); ctx.translate(cx, heroY - S * 0.04); ctx.rotate(shake * 0.35); ctx.scale(ig * sw, ig * sw);
    streakFlame(ctx, 'hot:rv', 0, 0, S * 0.66, Math.max(2, cnt), G.t, calm);
    ctx.restore();
    if (calm || t > 0.15) { const ny = heroY + S * 0.1; ctx.save(); ctx.translate(cx, ny); ctx.scale(sw, sw); ctx.translate(-cx, -ny); ui.num(String(cnt), cx, ny, { size: S * 0.26, align: 'center', tag: 'rv:count' }); ctx.restore(); }
    fx('#ffd9a0');
    const B = r.hotB, sp = Math.min(S * 0.42, (A.w - 30 * u) / B.length), isz = S * 0.36;
    B.forEach((b, j) => {
      const bx = cx + (j - (B.length - 1) / 2) * sp;
      if (item(j, bx, rowY, bagAt, () => drawBoosterIcon(ctx, b, 0, 0, isz, G.t)) === 1) ui.text((E.BOOSTERS[b] || {}).name || b, bx, rowY + isz * 0.68, { size: ls * 0.85, align: 'center', color: '#fff', stroke: ink, maxW: sp - 6 * u, tag: 'rv:b' + j });
    });
    if (calm || t > P.set - 0.25) tickLine('Free at the start of the next level', cx, cy + 0.68 * S, ls, { stroke: ink, fit: A.w - 36 * u, tag: 'rv:line' });
  }
  for (const f of late) f();
  if (bagN && !calm && t > P.claim - 0.25) { // the bag comes up for what is going into it, bumps as each thing lands, and goes
    const up = Math.min(clamp((t - P.claim + 0.25) / 0.2, 0, 1), clamp((P.end - t) / 0.14, 0, 1));
    let bump = 0;
    for (let j = 0; j < P.n; j++) { const h = (t - P.claim - 0.07 * j - RV_FLY) / 0.2; if (h > 0 && h < 1) bump = Math.max(bump, Math.sin(h * Math.PI)); }
    CB.bag(ctx, bagAt.x, bagAt.y + (1 - CB.easeOut(up)) * bagS * 1.6, bagS, bump);
  }
  { // the headline: a ribbon that pops in (drawn last: a jumping hen or a chick's fuse goes under it)
    const head = it.kind === 'treasure' ? 'BOSS TREASURE!' : it.kind === 'gift' ? 'FREE TRY!' : `${r.hot} WINS IN A ROW!`;
    const hw = Math.min(A.w - 36 * u, ui.measure(head, hs) + 80 * u), pk = calm ? 1 : backK(t / 0.3);
    ctx.save(); ctx.translate(cx, hy); ctx.scale(pk, pk); ctx.translate(-cx, -hy);
    ui.ribbon(head, cx, hy - hs * 0.85, hw, hs * 1.7, { color: it.kind === 'hot' ? '#e4572a' : it.kind === 'gift' ? '#2f8fd8' : '#d89a1c', size: hs, noRecord: true });
    ctx.restore();
  }
  if (RV.list.length > 1) RV.list.forEach((q, j) => { ctx.beginPath(); ctx.arc(cx + (j - (RV.list.length - 1) / 2) * 18 * u, Math.min(A.y1 - 22 * u, cy + 0.9 * S), (j === RV.i ? 6 : 4) * u, 0, 7); ctx.fillStyle = j === RV.i ? '#fff' : 'rgba(255,255,255,0.4)'; ctx.fill(); });
  if (byLand) landDraw(); // the purse and the bag, over the reveal
}

// 2026-11-23 the win card's coins (mykee: "when the ad is finished ... show the coins double kind of a thing, the
// existing count and the double count"). Without a doubling: "+N" counts up with the score, then rolls into the purse
// (purse.gain: coins fly from this cell to the purse, top right). With one: the label keeps the first count ("Coins 30 x2"),
// a big x2 stamps down beside "+30", the number rolls to "+60" with a burst of coins, and then the purse rolls from the
// old total to the new one. Reduced motion: the stamp is simply there, a 0.25 s roll and the pop.
const DBL_LEN = 1.05; // s from the end of the video to the purse's own roll
function drawWinCoins(r, ix, iy, cw, s, cnt, inCard) {
  const C = ui.C, calm = save.calm, tx = ix + 20 * s, maxW = cw - 50 * s, D = r.dbl, col = '#a85f00';
  r.coinAt = { x: ix, y: iy };
  if (!r.purseGo && inCard && cnt >= 1 && r.purse0 != null) { // the tally has counted up: into the purse
    r.purseGo = true;
    purse.gain({ from: r.purse0 + (r.trFlown && r.treasure ? r.treasure.coins : 0), src: r.coinAt });
  }
  if (r.online) winOnlineLine(r, ix, iy, cw, s, cnt);
  if (!D) {
    ui.text('Coins', tx, iy - 10 * s, { size: 12.5 * s, color: C.ink2, maxW, tag: 'win:lcoin' });
    ui.text('+' + Math.round((r.coins || 0) * cnt), tx, iy + 9 * s, { size: 19 * s, color: col, maxW, tag: 'win:vcoin' });
    return;
  }
  const t = G.t - D.t0, ST = calm ? 0 : 0.32, R0 = calm ? 0 : 0.42, R1 = calm ? 0.25 : 0.95;
  const k = clamp((t - R0) / (R1 - R0), 0, 1), val = Math.round(D.a + (D.b - D.a) * (1 - (1 - k) ** 3));
  if (!calm && D.beat < 1 && t >= ST) { D.beat = 1; audio.play('star', { intensity: 1 }); buzz('star'); } // the stamp lands
  if (D.beat < 2 && t >= R1) { D.beat = 2; if (!calm) audio.play('tada', { intensity: 0.5 }); buzz('tick'); } // the burst
  if (k > 0 && k < 1 && Math.floor(t / 0.06) !== D.tk) { D.tk = Math.floor(t / 0.06); audio.play('score_tick', { vol: 0.3, pitch: 1 + 0.6 * k }); }
  const vw = ui.measure('+' + D.b, 19 * s), vx = tx + vw / 2, vy = iy + 9 * s;
  ui.text(`Coins ${D.a} x2`, tx, iy - 10 * s, { size: 12.5 * s, color: C.ink2, maxW, tag: 'win:lcoin' }); // the first count stays readable
  const pq = (t - R1) / 0.3, pk = pq > 0 && pq < 1 ? 1 + 0.35 * Math.sin(pq * Math.PI) : 1;
  ctx.save(); ctx.translate(vx, vy); ctx.scale(pk, pk); ctx.translate(-vx, -vy);
  ui.text('+' + val, tx, vy, { size: 19 * s, color: col, maxW, tag: 'win:vcoin' });
  ctx.restore();
  if (!calm) { // the burst as it lands on the doubled number: a ring and coins thrown out
    const q = (t - R1) / 0.55;
    if (q > 0 && q < 1) {
      ctx.save(); ctx.globalAlpha = 1 - q;
      ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 5 * s * (1 - q); ctx.beginPath(); ctx.arc(vx, vy, (12 + 40 * q) * s, 0, 7); ctx.stroke();
      for (let i = 0; i < 9; i++) { const a = i * 0.698 + 0.2, rr = (14 + 46 * q) * s; drawCoin(ctx, vx + Math.cos(a) * rr, vy + Math.sin(a) * rr - 14 * s * Math.sin(q * Math.PI), 6 * s * (1 - 0.5 * q), G.t + i); }
      ctx.restore();
    }
    CB.confetti(ctx, vx, vy, t - R1, { n: 26, speed: 260 * s, g: 420 * s, life: 1.4, seed: 7, size: 6 * s }); // 0.8.17 (mykee: "make it like a celebration"): the video's doubling goes off
  }
  // the x2 stamp: falls in big and tilted, lands beside the first count with a squash and a shock ring, and stays
  const cx0 = ix - 24 * s, sx = Math.min(cx0 + cw - 22 * s, tx + vw + 24 * s), sy = vy + 1 * s, p = ST ? clamp(t / ST, 0, 1) : 1;
  const land = t - ST, sq = !calm && land > 0 && land < 0.16 ? 1 + 0.22 * Math.sin((land / 0.16) * Math.PI) : 1;
  const sc = (3.2 - 2.2 * p * p) * sq, rot = -0.6 * (1 - p) - 0.16;
  if (!calm && land > 0 && land < 0.4) { const q = land / 0.4; ctx.save(); ctx.globalAlpha = 1 - q; ctx.strokeStyle = '#fff3b0'; ctx.lineWidth = 4 * s * (1 - q); ctx.beginPath(); ctx.arc(sx, sy, (10 + 30 * q) * s, 0, 7); ctx.stroke(); ctx.restore(); }
  ctx.save(); ctx.globalAlpha = Math.min(1, p * 2.5); ctx.translate(sx, sy); ctx.rotate(rot); ctx.scale(sc, sc);
  ui.text('x2', 0, 0, { size: 22 * s, align: 'center', color: '#ff5a1f', stroke: '#fffaf0', strokeW: 4.5 * s, noRecord: true });
  ctx.restore();
  ui.record({ x: sx - 15 * s, y: sy - 9 * s, w: 30 * s, h: 19 * s }, 'win:x2'); // its resting place (the overlap check)
}

// 0.8.17 the Mint's online share (mykee: offline players see no videos, so "the engine provides less coins"): its own
// line under the coins, a small signal mark and "Online bonus +N". It pops in with a soft tick once the count-up has
// finished (an eased overshoot; Calm: it is simply there). Offline the line is absent.
function winOnlineLine(r, ix, iy, cw, s, cnt) {
  const calm = save.calm, x0 = ix - 13 * s, y0 = iy + 28 * s, maxW = cw - 26 * s, txt = `Online bonus +${r.online}`;
  if (cnt < 1 && !calm) return; // it comes when the count-up is done
  if (r.onT == null) { r.onT = G.t; if (!calm) audio.play('hud_pop', { vol: 0.5 }); }
  const p = calm ? 1 : clamp((G.t - r.onT) / 0.35, 0, 1), c1 = 1.70158, q = p - 1, e = 1 + (c1 + 1) * q * q * q + c1 * q * q; // ease-out-back
  const sz = 12 * s, bw = 13 * s;
  ctx.save(); ctx.globalAlpha = Math.min(1, p * 3); ctx.translate(x0, y0); ctx.scale(e, e); ctx.translate(-x0, -y0);
  for (let i = 0; i < 3; i++) { const h = (4 + 3 * i) * s; ui.roundRect(x0 + i * 4.4 * s, y0 + 5 * s - h, 3 * s, h, 1.2 * s); ctx.fillStyle = '#2d9a3a'; ctx.fill(); } // the signal mark
  ui.text(txt, x0 + bw + 4 * s, y0, { size: sz, color: '#2d7a1c', maxW: maxW - bw - 4 * s, tag: 'win:online', noRecord: p < 1 });
  ctx.restore();
}

// One result star. In the show it flies up from the hen (from) along an arc with a tail of glints, growing and spinning,
// and lands in its socket on its beat (starAt) with a squash, a flash, a ring and sparks, then springs back to size.
// On the card (no from) it has landed long ago and is simply there.
function drawWinStar(r, q, sx, sy, rad, calm, from) {
  drawStar(ctx, sx, sy, rad, false, 1, true);
  const v = r.t - starAt(r, q) + STAR_FLY;
  if (q >= r.stars || v < 0) return;
  if (v < STAR_FLY && !calm) { // in flight
    const p = v / STAR_FLY, f = from || { x: sx, y: sy + rad * 5 }, side = (q - 1) * rad * 2.4, lift = rad * 3;
    for (let j = 3; j >= 1; j--) { // its tail
      const pj = p - j * 0.1;
      if (pj <= 0) continue;
      const [tx, ty] = CB.arcPt(f.x, f.y, sx, sy, pj * pj, lift, side);
      ctx.globalAlpha = 0.75 - 0.18 * j; CB.glint(ctx, tx, ty, rad * (0.62 - 0.12 * j));
    }
    ctx.globalAlpha = 1;
    const [x, y] = CB.arcPt(f.x, f.y, sx, sy, p * p, lift, side);
    ctx.save(); ctx.globalAlpha = Math.min(1, p * 4); ctx.translate(x, y); ctx.rotate(-2.8 * (1 - p));
    drawStar(ctx, 0, 0, rad, true, 0.45 + 0.85 * p + 0.45 * Math.sin(p * Math.PI)); ctx.restore();
    return;
  }
  const h = v - STAR_FLY;
  let kx = 1, ky = 1;
  if (!calm && h < 0.52) { // the hit: flat and wide, then a spring back to size
    if (h < 0.08) { const p = h / 0.08; kx = 1.3 + 0.1 * p; ky = 1.3 - 0.6 * p; }
    else { const w = (h - 0.08) / 0.44, o = Math.cos(w * Math.PI * 2.5) * (1 - w) * (1 - w); kx = 1 + 0.4 * o; ky = 1 - 0.3 * o; }
  }
  ctx.save(); ctx.translate(sx, sy + rad * (1 - ky) * 0.5); ctx.scale(kx, ky);
  drawStar(ctx, 0, 0, rad, true, 1); ctx.restore();
  if (h < 0.5 && !calm) {
    const a = h / 0.5;
    if (h < 0.14) { ctx.save(); ctx.globalAlpha = 0.6 * (1 - h / 0.14); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx, sy, rad * (1 + 2.2 * h / 0.14), 0, 7); ctx.fill(); ctx.restore(); }
    CB.landFlash(ctx, sx, sy, rad * 2, a);
    CB.sparks(ctx, sx, sy, rad, a, PERF.low ? 6 : 10, q);
  }
}

// The fail card: the hen on the same stage as the win card (render/cheer.js 'encourage'): sad for a moment, then she
// shakes it off and cheers you on, so kids are not put off. Landscape: she stands left of the card.
// Kind and clear: how close you were (eggs home against eggs needed), then one big RETRY.
// 0.8.14 (mykee: "the problem is it is not full screen ... along with the retry ... an option to skip the level as well
// ... We need to properly adjust the skip, retry, and everything inside the level card"): a full page like the win page
// (no HUD over it, paper to the safe edges in portrait; the win card's side stage in landscape). Top to bottom: the
// reason, the hen, the egg slots, the one help offer, then RETRY (the biggest), Rewind 12s | Rewind coins, and
// Skip level | Levels (stuck with the coin way: the two skips share the row and Levels gets its own). The room a tall
// phone gives goes to her stage first; a short screen scrolls the page rather than shrinking a button.
function drawFail() {
  const hb = G.hudBottom;
  G.hudBottom = ui.A.y; // the page starts at the top of the safe area (drawHUD skips 'fail')
  try { drawFailPage(); } finally { G.hudBottom = hb; }
}
const FAIL_BTN = 58; // the rows' buttons (design units): 53 px at 384 px wide, 50 at 360 (never less: o.minS)
function drawFailPage() {
  const st = G.sim.stats(), u = ui.u, C = ui.C, A = ui.A;
  const timeout = !!G.sim.timeLimit && G.sim.timeLeft <= 0;
  const sd = cardSide();
  dim(sd ? 0.74 : 0.6);
  if (sd) { ctx.save(); ctx.globalAlpha = 0.6; sunburst(sd.x + sd.w / 2, A.y + A.h * 0.62, Math.min(sd.w * 0.62, A.h * 0.6), 'rgba(200,214,255,0.1)'); ctx.restore(); }
  const ways = skipWays(), rew = !G.usedRewind && G.sim.canRewind(), hl = rew && G.li >= 0 ? DR.hotLost(save) : 0;
  const coinR = rew && !G.freeRewind && !ads.premium && G.li >= 0, price = DR.rewindPrice((G.rewindBuys || {})[G.level.id]);
  const Hp0 = G.failHelp, BH = FAIL_BTN;
  // 0.8.15 "So close": one egg short of the goal is the best moment to offer the way back in (research: the near miss is
  // where a continue is worth most to the player). The page says so, the missing slot glows, and Rewind leads; RETRY stays
  // one row under it, green, free. Never in the first levels (nothing is sold there), never a timer.
  const near = st.target >= 2 && st.saved === st.target - 1, lead = near && rew && !earlyDays();
  // 0.8.15 the Conductor: the way back in, a gift that waits, the Director's help and the meter are candidates; one
  // leads (it alone shimmers), an ask the Brain holds back is not shown, and with nothing else a line says what is near
  const cheer = !!(G.failSpin && G.failSpin.cheer), hk = Hp0 ? (Hp0.kind === 'trialChick' || Hp0.kind === 'trialBoost' || Hp0.kind === 'freeHint' ? 'rescue' : Hp0.kind === 'adBoost' ? 'video' : 'coins') : null;
  const FL = G.li >= 0 ? pageLead('fail', [lead ? { id: 'rewind', sys: 'rewind', kind: 'rescue', near: st.saved / st.target } : null, Hp0 ? { id: 'help', sys: 'director', kind: hk, near: 0.9, price: Hp0.price } : null, ...nearThings().map((c) => (c.id === 'spin' && cheer ? { ...c, kind: 'rescue' } : c))].filter(Boolean)) : { lead: null, order: [], held: [] };
  const top = FL.lead ? FL.lead.id : null, Hp = Hp0 && !FL.held.some((h) => h.id === 'help') ? Hp0 : null, prog = !Hp && !SP.banked(save) ? FL.order.find((c) => c.kind === 'progress') : null;
  const hotB = (() => { let o = []; if (hl >= 2 && (save.unlocked || 1) >= 6) for (const [n, b] of DR.HOT) if (hl >= n) o = b; return o; })(); // what the streak was worth
  const build = (stH) => (s) => {
    const B = [];
    // why it failed: an icon and two or three words (the ribbon above says the same)
    B.push({ h: 30 * s, gap: sd ? 2 * s : 4 * s, draw: (x, y, w) => {
      const t = near ? 'Just one egg short' : timeout ? 'No time left' : 'Too many eggs lost', tw = ui.measure(t, 19 * s) + 34 * s, x0 = x + w / 2 - tw / 2;
      if (near) drawEggIcon(ctx, x0 + 12 * s, y + 15 * s, 24 * s, 'alive'); else if (timeout) pictoClock(ctx, x0 + 12 * s, y + 15 * s, 28 * s); else pictoBroken(ctx, x0 + 12 * s, y + 15 * s, 28 * s);
      ui.text(t, x0 + 30 * s, y + 15 * s, { size: 19 * s, color: C.warn, maxW: w - 34 * s, tag: 'fail:cheer' });
    } });
    if (!sd && stH > 0) B.push({ h: stH * s, gap: 8 * s, draw: (x, y, w) => {
      const box = { x, y, w, h: stH * s };
      henStage(box, s, false);
      drawCelebration(ctx, 'encourage', G.screenT, box, { henH: Math.min(0.685 * stH, 150) * s, calm: save.calm, pw: 0.5 }); // a tall stage gives her air, not a close-up
      ui.record(box, 'fail:hen');
    } });
    // how close: one slot per egg needed, the ones that got home filled in (landscape: the count beside them, one row)
    const EH = sd ? 44 : 62;
    B.push({ h: EH * s, gap: 8 * s, draw: (x, y, w) => {
      ui.well(x, y, w, EH * s, { s });
      const lab = `${st.saved}/${st.target}`, lw = sd ? ui.measure(lab, 17 * s) + 14 * s : 0;
      const n = Math.max(1, st.target), sp = Math.min(30 * s, (w - 20 * s - lw) / n), es = Math.min(26 * s, sp * 0.95), mid = x + (w - lw) / 2;
      for (let i = 0; i < n; i++) {
        const ex = mid + (i - (n - 1) / 2) * sp, ey = y + (sd ? EH / 2 : 20) * s;
        if (i < st.saved) drawEggIcon(ctx, ex, ey, es, 'saved');
        else if (near && i === st.saved) { // the one that was missing: its place glows and the egg that nearly made it fades in and out
          const p = save.calm ? 0.6 : 0.5 + 0.5 * Math.sin(G.screenT * 4.2);
          ctx.save(); ctx.globalAlpha = 0.3 + 0.45 * p; ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.ellipse(ex, ey, es * (0.54 + 0.07 * p), es * (0.64 + 0.07 * p), 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
          drawEggIcon(ctx, ex, ey, es, 'slot');
          ctx.save(); ctx.globalAlpha = 0.25 + 0.4 * p; drawEggIcon(ctx, ex, ey - (save.calm ? 0 : (1 - p) * 3 * s), es * 0.9, 'alive'); ctx.restore();
        } else drawEggIcon(ctx, ex, ey, es, 'slot');
      }
      ui.record({ x: mid - n * sp / 2, y: y + (sd ? EH / 2 - 13 : 7) * s, w: n * sp, h: 26 * s }, 'fail:eggs');
      if (sd) ui.text(lab, mid + n * sp / 2 + 10 * s, y + EH / 2 * s, { size: 17 * s, maxW: lw, color: C.ink, tag: 'fail:stat' });
      else ui.text(lab, x + w / 2, y + 47 * s, { size: 17 * s, align: 'center', maxW: w - 16 * s, color: C.ink, tag: 'fail:stat' });
    } });
    if (SP.banked(save) > 0) B.push(spinRowBlock(s, { cheer, quiet: top !== 'spin' })); // 0.8.15: a spin that waits (the cheer-up spin after three losses lands here)
    else if (prog) B.push({ h: 26 * s, gap: 4 * s, draw: (x, y, w) => leadLine(prog, x + w / 2, y + 13 * s, s, { size: 15, ink: C.info, maxW: w, tag: 'fail:near' }) });
    if (G.sim.ally && G.sim.ally.avail.length) B.push(lineBlock('A farm friend can help', 14 * s, { color: C.info, tag: 'fail:ally', gap: (sd ? 3 : 6) * s }));
    if (Hp) B.push({ h: 78 * s, gap: 10 * s, draw: (x, y, w) => { // the Director's help: a freebie, or the booster that fits
      const free = Hp.kind === 'trialChick' || Hp.kind === 'trialBoost' || Hp.kind === 'freeHint', ad = Hp.kind === 'adBoost';
      ui.well(x, y, w, 78 * s, { s, a: free ? '#d8f5c0' : '#ffe9b0', b: free ? '#f0ffe4' : '#fff6dc' });
      const ax = x + 38 * s, ay = y + 39 * s;
      if (Hp.kind === 'trialChick') drawStrikeChick(ctx, Hp.id, ax, ay + 6 * s, 48 * s, G.t, {});
      else if (Hp.kind === 'freeHint') lampIcon(ctx, ax, ay, 60 * s); // the Pacer's free hint: the Hint button's lamp
      else drawBoosterIcon(ctx, Hp.id, ax, ay, 56 * s, G.t);
      const bw = Math.min(118 * s, w * 0.3), tx = x + 74 * s, tw = x + w - bw - 16 * s - tx;
      ui.text(Hp.label, tx, y + 26 * s, { size: 16.5 * s, color: ui.C.ink, maxW: tw, tag: 'fail:help' });
      const ln = wrapText(Hp.line, 12.5 * s, tw).slice(0, 2);
      ln.forEach((l, i) => ui.text(l, tx, y + 48 * s + i * 15 * s, { size: 12.5 * s, color: ui.C.ink2, maxW: tw, tag: 'fail:help' + i }));
      const lab = free ? 'FREE' : ad ? 'Watch' : String(Hp.price);
      ui.button('help:go', lab, x + w - bw - 8 * s, y + 13 * s, bw, 52 * s, free ? { kind: 'primary', shimmer: top === 'help', size: 20 * s } : ad ? { kind: 'ad', ad: true, size: 17 * s } : { kind: save.wallet.coins >= Hp.price ? 'gold' : 'off', dim: 1, icon: (c, X, Y, S) => drawCoin(c, X, Y, S * 0.5, G.t), size: 19 * s });
      ui.record({ x, y, w, h: 78 * s }, 'panel:failhelp'); // (a panel: its own words and button sit on it)
    } });
    // row A: RETRY, the whole width, the biggest (one egg short with a Rewind to offer: Rewind takes that place, RETRY the row under it)
    const RH = sd ? 62 : 68;
    const retryRow = () => B.push(lead ? { h: BH * s, gap: 10 * s, draw: (x, y, w) => ui.button('retry', 'RETRY', x, y, w, BH * s, { kind: 'primary', icon: ICON.retry, size: 22 * s }) }
      : { h: RH * s, gap: (sd ? 10 : 14) * s, draw: (x, y, w) => ui.button('retry', 'RETRY', x, y, w, RH * s, { kind: 'primary', shimmer: top !== 'spin' && top !== 'help', icon: ICON.retry, size: 27 * s }) });
    // row B: Rewind 12 s, a Free rewind booster or a video, beside Rewind for coins (dearer each time on this level). It keeps the win streak.
    const rewRows = () => {
      const h = (lead ? RH : BH) * s, fs = (lead ? 20 : 18) * s;
      if (hl >= 2) B.push({ h: 26 * s, gap: (lead ? (sd ? 8 : 12) : 10) * s, draw: (x, y, w) => { // the streak, and the boosters it was giving at every start
        const t = `Rewind keeps your ${hl}-win streak`, iw = hotB.length * 24 * s + (hotB.length ? 6 * s : 0), tm = Math.min(ui.measure(t, 15 * s), w - 30 * s - iw), tw = tm + 30 * s + iw, x0 = x + w / 2 - tw / 2;
        pictoFlame(ctx, x0 + 11 * s, y + 13 * s, 24 * s);
        ui.text(t, x0 + 26 * s, y + 13 * s, { size: 15 * s, color: C.warn, maxW: tm, tag: 'fail:hot' });
        hotB.forEach((id, i) => drawBoosterIcon(ctx, id, x0 + 26 * s + tm + 18 * s + i * 24 * s, y + 13 * s, 24 * s, G.t));
        if (hotB.length) ui.record({ x: x0 + 26 * s + tm + 6 * s, y: y + s, w: iw - 6 * s, h: 24 * s }, 'fail:hotb');
      } });
      B.push({ h, gap: hl >= 2 ? 4 * s : (lead ? (sd ? 10 : 14) : 12) * s, draw: (x, y, w) => {
        const hw = coinR ? (w - 10 * s) / 2 : w;
        ui.button('rewind', G.freeRewind ? 'Free rewind' : `Rewind ${REWIND_S}s`, x, y, hw, h, G.freeRewind || ads.premium ? { kind: 'secondary', icon: ICON.rewind, size: fs, shimmer: lead && top === 'rewind' } : { kind: 'ad', ad: true, size: fs, shimmer: lead && top === 'rewind' });
        if (coinR) ui.button('rewind:coins', 'Rewind ' + price, x + hw + 10 * s, y, hw, h, { kind: save.wallet.coins >= price ? 'gold' : 'off', dim: 1, icon: (c, X, Y, S) => drawCoin(c, X, Y, S * 0.5, G.t), size: fs });
      } });
    };
    if (lead) { rewRows(); retryRow(); } else { retryRow(); if (rew) rewRows(); }
    // row C: Skip level (a ticket the player owns, else a video) and Levels; stuck: the two skips, Levels under them
    const skipBtn = (way, x, y, w, h) => {
      if (way === 'ticket') ui.button('skip:ticket', 'Skip level', x, y, w, h, { kind: 'orange', icon: (c, X, Y, S) => drawItemArt(c, 'skip', X, Y, S * 1.5, G.t), iconS: 1.3, size: 18 * s });
      else if (way === 'ad') ui.button('skip:ad', 'Skip level', x, y, w, h, ads.premium ? { kind: 'secondary', icon: ICON.next, size: 18 * s } : { kind: 'ad', ad: true, size: 18 * s });
      else ui.button('skip:coins', 'Skip ' + SKIP_COINS, x, y, w, h, { kind: save.wallet.coins >= SKIP_COINS ? 'gold' : 'off', dim: 1, icon: (c, X, Y, S) => drawCoin(c, X, Y, S * 0.5, G.t), size: 18 * s }); // too few coins: the tap opens Get more
    };
    const lvBtn = (x, y, w, h) => ui.button('levels', 'Levels', x, y, w, h, { kind: 'tertiary', icon: ICON.grid, size: 18 * s });
    const gC = (sd ? 8 : 12) * s; // (0.8.17: on its side 4 px less, so the page fits without a 5 px scroll and Levels is whole)
    if (ways.length === 2) {
      B.push({ h: BH * s, gap: gC, draw: (x, y, w) => { const hw = (w - 10 * s) / 2; skipBtn(ways[0], x, y, hw, BH * s); skipBtn(ways[1], x + hw + 10 * s, y, hw, BH * s); } });
      B.push({ h: BH * s, gap: 10 * s, draw: (x, y, w) => lvBtn(x, y, w, BH * s) });
    } else if (ways.length === 1) B.push({ h: BH * s, gap: gC, draw: (x, y, w) => { const hw = (w - 10 * s) / 2; skipBtn(ways[0], x, y, hw, BH * s); lvBtn(x + hw + 10 * s, y, hw, BH * s); } });
    else B.push({ h: BH * s, gap: gC, draw: (x, y, w) => lvBtn(x, y, w, BH * s) });
    return B;
  };
  // her stage takes what the rest of the page leaves (portrait): 130 to 260 units
  let stH = 0;
  if (!sd) {
    const rest = build(0)(1).reduce((a, b) => a + (b.gap ?? 10) + b.h, 0) + CARD_HEAD + 22 + 8;
    const roomU = (A.y1 - A.y - 30 * u) / u;
    stH = clamp(roomU - rest - 24, 130, 260);
  }
  const title = near ? 'So close!' : timeout ? 'Out of time!' : 'Too many eggs broke';
  const card = stackCard(title, build(stH), { ...(sd ? sd.cardO : { full: true }), ribbon: near ? '#e0882a' : '#5a82c8', minS: u, scroll: G.fscroll, grow: 1.2 });
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
  const fr = firstRun(); // a brand-new player: the logo's arrival is the moment (slower), one big PLAY, nothing else yet
  const intro = !!G.homeIntro && !save.calm && G.screenT < (fr ? 2.6 : 1.2), T = fr ? G.screenT * 0.55 : G.screenT;
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
  const wide = A.w > A.h * 1.15;
  // 0.8.16 (mykee: "it's not full screen"): in portrait the buttons stand on the page column (ui.pageBox: the level
  // card's and the shop's edges); landscape keeps its two columns
  const bw = wide ? Math.min(310 * u, A.w - 44 * u) : ui.pageBox(440 * u).w;
  // buttons sit on the meadow at the bottom: Play, then Levels | Daily | Shop, then the difficulty row
  // landscape: two balanced columns, logo + vault on the left, the buttons on the right, the meadow low across both
  const lx = wide ? A.x + A.w * 0.29 : cx, bx = wide ? A.x + A.w * 0.73 : cx;
  const blockH = (fr ? 100 : 184) * u; // Play + Levels row + difficulty + Extras
  const ground = wide ? A.y1 - Math.max(96 * u, A.h * 0.2) : A.y1 - (fr ? 124 : 208) * u - 16 * u;
  const by = wide ? Math.max(A.y + 14 * u, A.y + (ground - A.y - blockH) / 2 + 4 * u) : A.y1 - (fr ? 124 : 208) * u; // room for the Extras row (and its lip, clear of the phone's bottom edge) under the difficulty row
  if (!themeBack(ctx, ui.skin, W_, H_, ground)) G.backdrop.drawGround(ctx, 0, ground, W_, H_ - ground, G.t); // a skin pack paints its whole scene instead
  // the earth under the controls falls into shade, so the buttons carry the bottom of the screen
  const sg = ctx.createLinearGradient(0, ground + 20 * u, 0, H_);
  sg.addColorStop(0, 'rgba(30,14,4,0)'); sg.addColorStop(1, 'rgba(30,14,4,0.5)');
  ctx.fillStyle = sg; ctx.fillRect(0, ground + 20 * u, W_, H_ - ground - 20 * u);
  menuFx(); // the skin's falling effect: over the scene, under the logo and buttons
  // 0.8.16 (mykee: "look at the home page, especially the title and the unlock button"): on a tall phone the title
  // spans the page column, the buttons' own edges, and stands clear under the Settings button; nothing shares its
  // row any more (Unlock all moved down into the button block). Shorter screens keep the title between the corners.
  const tall = !wide && A.h >= A.w * 1.9;
  const logoS = tall ? bw / 5.02 : Math.min(66 * u, (wide ? A.w * 0.5 : A.w) / 7.3, A.h / 6);
  const ty = tall ? A.y + 56 * u + logoS * 0.57 : A.y + Math.max(16 * u + logoS / 2, Math.min(A.h * 0.12, 72 * u));
  const logo = drawLogo(ctx, 'EGGSCAPE', lx, ty, logoS, G.t, intro ? T * 1.7 : 9, FONT, ui.skin && ui.skin.pack ? (c, ch, i, sz, n) => logoDress(ui.skin, c, ch, i, sz, n) : null); // intro: the letters drop in a quicker cascade
  ui.record(logo, 'title:logo');
  const subY = ty + logoS * 0.5 + 18 * u;
  G.titleToastY = subY + 16 * u;
  { const p = ent(0.3, 0.32); ctx.save(); ctx.globalAlpha *= p; ctx.translate(0, (1 - p) * 14 * u); // the tagline slides up under the title
    ui.text(TEST || UNLOCKED ? 'Test build: everything unlocked' : 'Get every egg home to the hen', lx, subY, { size: 17 * u, align: 'center', color: '#fff', stroke: 'rgba(50,24,6,0.8)', strokeW: 4 * u, shadow: 'rgba(50,24,6,0.8)', tag: 'title:sub', maxW: (wide ? A.w * 0.5 : A.w) - 32 * u }); ctx.restore(); }
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
  if (!fr) homeHit('home:hen', hx - henH * 0.45, ground - henH, henH * 0.9, henH); // (first launch: the hen only welcomes)
  const chestOpen = save.wallet.daily === today(), cs = Math.min(eggH * 1.35, 62 * u);
  const chx = wide ? bx + bw / 2 + Math.min(70 * u, (A.x1 - bx - bw / 2) * 0.5) : A.x1 - Math.max(cs * 0.7, A.w * 0.12), chy = ground - cs * 0.42;
  if (!fr && !(wide && chx + cs * 0.6 > A.x1)) {
    const tagS = 13 * u;
    pop(0.4, chx, ground, () => {
      drawChest(ctx, chx, chy, cs, G.t, chestOpen ? 'open' : 'ready');
      // 0.8.17: "Opens in 6h 12m", kept on the screen; beside the landscape buttons it takes two lines when one does not fit
      let L = [chestOpen ? chestInText() : 'FREE'], tgw = ui.measure(L[0], tagS) + 14 * u, tcx = Math.min(chx, A.x1 - 4 * u - tgw / 2);
      if (wide && chestOpen && tcx - tgw / 2 < bx + bw / 2 + 4 * u) { L = ['Opens in', L[0].replace(/^Opens in /, '')]; tgw = Math.max(...L.map((l) => ui.measure(l, tagS))) + 14 * u; tcx = Math.min(chx, A.x1 - 4 * u - tgw / 2); }
      const tlh = tagS * 1.2, ty = chy - cs * 0.62 - tagS - (L.length - 1) * tlh;
      ui.roundRect(tcx - tgw / 2, ty, tgw, tagS * 1.6 + (L.length - 1) * tlh, tagS * 0.8);
      ctx.fillStyle = chestOpen ? 'rgba(40,24,10,0.7)' : '#e8402e'; ctx.fill();
      L.forEach((l, i) => ui.text(l, tcx, ty + tagS * 0.8 + i * tlh, { size: tagS, align: 'center', color: '#fff', tag: 'title:chesttag' + (i || '') }));
    });
    homeHit('home:chest', chx - cs * 0.6, chy - cs * 0.62 - tagS, cs * 1.2, cs * 1.1 + tagS);
  }
  pop(0.05, vx, vy, () => drawTitleScene(ctx, { cx: vx, cy: vy, R, ground, h: eggH, W: W_, H: H_, u, onLand: () => audio.play('hen_land', { vol: 0.5 }) }, G.t, save.calm), 0.5); // the toy vault and the meadow friends settle in
  if (!fr && waitShown()) { // 0.8.17: rewards that waited for a connection: a gift on the meadow (over the egg friends), its tag says how many
    const n = waitingList().length, tagS = 13 * u, gS = Math.min(cs * 0.9, 54 * u), gx = wide ? A.x + A.w * 0.43 : A.x + A.w * 0.44, gy = ground - gS * 0.42;
    const tagT = `${n} reward${n > 1 ? 's' : ''} waiting`, tgw = ui.measure(tagT, tagS) + 16 * u, ty0 = gy - gS * 0.62 - tagS * 1.25;
    const T0 = G.waitMarkT ?? (G.waitMarkT = G.t), k = save.calm ? 1 : backK(Math.min(1, (G.t - T0) / 0.35));
    ctx.save(); ctx.translate(gx, ground); ctx.scale(k, k); ctx.translate(-gx, -ground);
    drawGift(ctx, gx, gy + (save.calm ? 0 : Math.abs(Math.sin(G.t * 2.2)) * -3 * u), gS, save.calm ? 0 : G.t);
    ui.roundRect(gx - tgw / 2, ty0, tgw, tagS * 1.6, tagS * 0.8); ctx.fillStyle = '#7a48e8'; ctx.fill();
    ui.text(tagT, gx, ty0 + tagS * 0.8, { size: tagS, align: 'center', color: '#fff', tag: 'title:waittag' });
    ctx.restore();
    homeHit('wait:open', gx - Math.max(gS * 0.6, tgw / 2), ty0, Math.max(gS * 1.2, tgw), ground - ty0);
  }
  pop(0.2, A.x + 30 * u, A.y + 30 * u, () => { ui.button('settings', '', A.x + 10 * u, A.y + 10 * u, 40 * u, 40 * u, { kind: 'hud', icon: (c, x, y, sz) => settingsIcon(c, x, y, sz * 1.1, '#fff4dc'), round: 13 * u }); setMarkAt(A.x + 10 * u, A.y + 10 * u, 40 * u, 40 * u); }); // 0.8.14: the Settings mark
  if (remChipOn()) pop(0.3, A.x1 - 30 * u, A.y + 30 * u, () => drawRemChip(A.x1 - 50 * u, A.y + 10 * u, 40 * u)); // 0.8.17: reminders are off: the bell with a slash, in the other top corner
  // remove ads / buy the game (app, until bought), or Premium's free Chick Charge of the day: 0.8.16, a button of the
  // block, beside Extras (same height, same size of words, the column's right edge), no longer a pill over the title
  const side = fr ? null : ads.canBuyPremium ? { id: 'home:premium', label: 'Unlock all', o: { kind: 'gold', icon: (c, x, y, sz) => drawStar(c, x, y, sz * 0.48, true) } }
    : ads.premium && save.wallet.premDay !== today() && save.wallet.charges < E.MAX_CHARGES ? { id: 'home:charge', label: 'Free charge', o: { kind: 'primary', shimmer: true, icon: (c, x, y, sz) => drawStrikeToken(c, 'freeze', x, y, sz * 0.42, G.t, true) } } : null;
  // PLAY breathes
  const ph = (fr ? 84 : 70) * u, br = save.calm ? 1 : 1 + 0.018 * Math.sin(G.t * 2.6);
  pop(0.25, bx, by + ph / 2, () => {
    ctx.save();
    ctx.translate(bx, by + ph / 2); ctx.scale(br, br); ctx.translate(-bx, -(by + ph / 2));
    ui.button('play', nextIdx() > 0 ? `PLAY  Level ${LEVELS[nextIdx()].id}` : 'PLAY', bx - bw / 2, by, bw, ph, { kind: 'primary', shimmer: true, icon: ICON.play, size: (fr ? 34 : 28) * u, round: 20 * u });
    ctx.restore();
  });
  if (fr) { if (fade) ctx.globalAlpha = 1; return; } // first launch: PLAY alone (Levels, Daily, Shop, Extras and the bank come with the first win)
  const ry = by + ph + 8 * u, rh = 54 * u;
  const bankEh = Math.min(rh * 0.8, 44 * u), bankEw = bankEh * 0.78, bankOn = save.wallet.bank > 0 && ads.moneyShop;
  const bankIn = bankOn && bx + bw / 2 + 8 * u + bankEw > A.x1 - 2 * u; // 0.8.16: no room beside the row: the egg ends the row, on the column's right edge
  const tw = (bw - 16 * u - (bankIn ? bankEw + 8 * u : 0)) / 3, /* 0.8.14: one gutter, 8 units, across and down the block */ paid = save.daily.paid === today();
  pop(0.33, bx - bw / 2 + tw / 2, ry + rh / 2, () => ui.button('levels', 'Levels', bx - bw / 2, ry, tw, rh, { kind: 'secondary', icon: ICON.grid, size: 17 * u }));
  pop(0.4, bx - bw / 2 + tw * 1.5 + 8 * u, ry + rh / 2, () => ui.button('daily', paid ? dailyNextText() : 'Daily', bx - bw / 2 + tw + 8 * u, ry, tw, rh, paid ? { kind: 'off', size: 13 * u } : { kind: 'orange', icon: ICON.day, size: 17 * u }));
  pop(0.47, bx - bw / 2 + tw * 2.5 + 16 * u, ry + rh / 2, () => purseBtn(bx - bw / 2 + 2 * (tw + 8 * u), ry, tw, rh, 18 * u));
  // the Golden Egg Bank: a small glass egg beside the coins, filling as wins drop coins in (tap: its card in the shop)
  if (bankOn) {
    const eh = bankEh, ew = bankEw, ex = bx + bw / 2 + (bankIn ? -ew / 2 : 8 * u + ew / 2), ey = ry + rh / 2 - 2 * u;
    {
      pop(0.5, ex, ey, () => drawGlassEgg(ctx, ex, ey, eh, save.wallet.bank / E.BANK_CAP, G.t));
      ui.record({ x: ex - ew / 2, y: ey - eh / 2, w: ew, h: eh }, 'title:bank');
      homeHit('home:bank', ex - ew / 2 - 4 * u, ey - eh / 2 - 4 * u, ew + 8 * u, eh + 8 * u);
    }
  }
  // (2026-11-16 research: no top casual game puts a difficulty switch on home; it lives in Settings)
  // Extras: as wide as Play, 52 u tall, with the Extras page's little planet and egg
  const ey = ry + rh + 8 * u, ew = side ? (bw - 8 * u) / 2 : bw, es = side ? 18 * u : 20 * u;
  pop(0.54, bx - bw / 2 + ew / 2, ey + 26 * u, () => ui.button('extras', 'Extras', bx - bw / 2, ey, ew, 52 * u, { kind: 'ad', icon: (c, x, y, s) => drawExtrasMark(c, x, y, s * 1.25, save.calm ? 0 : G.t), iconS: side ? 1.5 : 1.8, size: es, round: 17 * u }));
  if (albumMarkOn()) pop(0.6, bx - bw / 2 + ew - 4 * u, ey + 4 * u, () => markBadge(Math.min(bx - bw / 2 + ew - 3 * u, A.x1 - 12 * u), ey + 3 * u, 11 * u, G.t, '!')); // 0.8.17: a new combo find (it leads to its album tile)
  if (side) pop(0.6, bx + bw / 2 - ew / 2, ey + 26 * u, () => ui.button(side.id, side.label, bx + bw / 2 - ew, ey, ew, 52 * u, { ...side.o, size: es, round: 17 * u }));
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
  if (!G.mapL || G.mapL.key !== k) { G.mapL = MS.mapLayout({ W: W_, A, u: ui.u, n: LEVELS.length }); G.mapL.key = k; MSIDE.sidePlan(G.mapL); } // (the side quests' doors first: the scenery keeps off them)
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
  else mapFocusY(L.stops[Math.min(LEVELS.length - 1, w * ROAD.PER_ENV)].y, 0.62);
}
function drawLevels() {
  const u = ui.u, A = ui.A, pad = 14 * u, S = G.mscroll;
  ui.calm = save.calm;
  const L = mapLayoutNow(), vt = levelPageTop(), vb = A.y1, vh = vb - vt;
  S.max = Math.max(0, L.H - vh);
  let fresh = false;
  if (G.screenT < S.seenT || S.focus !== G.world + ':' + S.enter) { mapFocusWorld(G.world); S.focus = G.world + ':' + S.enter; fresh = true; } // just opened: show where the player is
  const SIDES = MSIDE.sidePlan(L); // 0.8.17: the side quests' doors and trails
  if (G.sideFocus != null) { const q = SIDES.find((p) => p.w === G.sideFocus); if (q) mapFocusY(q.y, 0.55); G.sideFocus = null; G.sideWalk = null; } // back from a side quest (or Extras' Bonus vaults): at its door
  S.seenT = G.screenT;
  const dt = Math.min(0.1, Math.max(0, G.t - (S.t || G.t))); S.t = G.t;
  const camTo = (y, f, snap) => { const want = clamp(y - vh * f, 0, S.max); S.y = snap ? want : S.y + (want - S.y) * Math.min(1, dt * 6); S.v = 0; return Math.abs(want - S.y) < 3; }; // the camera glides there
  // the trip to the next stop after a win (2026-11-20): the camera follows the hen hopping along, a burst on arrival,
  // then the level page opens by itself
  const TR = G.mapTravel && L.stops[G.mapTravel.from] && L.stops[G.mapTravel.to] ? G.mapTravel : null;
  // 0.8.17 (mykee: "show the user that the lock icon completely breaks away"; "we could have shown it without a pop-up"):
  // what the map has shown open so far this session. A level newer than that breaks its padlock as the hen sets off for
  // it; a world newer than that opens its gate on screen (the padlock breaks, the gate swings open, the fog rolls away,
  // the sign drops in), then the hen walks in
  const topPlay = () => { for (let i = LEVELS.length - 1; i >= 0; i--) if (playable(i)) return i; return -1; };
  let oMask = 0; for (let w = 0; w < L.nw; w++) if (envOpen(w)) oMask |= 1 << w;
  if (!G.mapSeen || G.mapSeen.sv !== save) { // (a save loaded afresh starts what was seen afresh)
    const sn = G.mapSeen = { top: topPlay(), w: oMask, sv: save }; G.mapGate = null;
    if (TR && TR.to === sn.top && !bestStarsOf(LEVELS[TR.to].id)) { // the first map of the session is this trip: its level (and world) just opened
      sn.top = TR.to - 1; const w2 = envOf(TR.to);
      if (w2 !== envOf(TR.from) && !LEVELS.some((l, i) => envOf(i) === w2 && bestStarsOf(l.id) > 0)) sn.w &= ~(1 << w2);
    }
  }
  const SN = G.mapSeen;
  SN.w &= oMask;
  if (!G.mapGate) for (let w = 0; w < L.nw; w++) if ((oMask >> w) & 1 && !((SN.w >> w) & 1)) {
    G.mapGate = { w, t0: null };
    const tp = topPlay(); // opened for coins (or by stars from a replay): once it is open the hen walks in from the stop before it
    if (!G.mapTravel && tp > SN.top && tp === nextIdx() && tp > 0 && envOf(tp) === w && (bestStarsOf(LEVELS[tp - 1].id) > 0 || SK.isSkipped(save, LEVELS[tp - 1].id))) G.mapTravel = { from: tp - 1, to: tp, t0: -1 };
    break;
  }
  const GA = G.mapGate, GATE_T = 1.45;
  if (GA) {
    camTo(MS.gateSpot(L, GA.w).y - 30 * u, 0.5, fresh);
    if (GA.t0 == null && Math.abs(S.y - clamp(MS.gateSpot(L, GA.w).y - 30 * u - vh * 0.5, 0, S.max)) < 40 * u) GA.t0 = G.t; // the gate on screen first, then it opens
    const gs = GA.t0 == null ? -1 : G.t - GA.t0;
    if (gs >= 0.32 && !GA.snd) { GA.snd = 1; audio.play('unlock', { pitch: 0.85 }); buzz('tap'); }
    if (gs >= 1.2 && !GA.snd2) { GA.snd2 = 1; audio.play('tada'); }
    if (gs >= GATE_T) {
      SN.w |= 1 << GA.w; G.mapGate = null;
    }
  } else if (!TR) SN.top = Math.max(SN.top, topPlay());
  const gateHold = !!(TR && G.mapGate); // a world opening first, then the trip
  // a boss was just beaten and its treasure is still shut: the chest opens first, then the hen walks on (2026-11-20:
  // the win chain walked straight past it to the next level, so most players never saw their boss reward)
  if (TR && !TR.tr) {
    TR.tr = 1;
    const due = treasureDue(TR.from);
    if (due) G.treasure = { id: due, t: G.t, openedAt: null };
  }
  // 0.8.17 a side quest that just opened (its branch level won, this is the trip from it): the camera eases to its door,
  // the trail draws in, the door pops with a sound and the hen looks at it; then the trip goes on. Any other one open and
  // not yet shown (an old save, Unlock Everything) simply stands open.
  if (!G.sideReveal && !G.mapGate) {
    const uq = SQ.sideUnseen(save, allOpen());
    if (uq) {
      const q = SIDES.find((p) => p.key === uq.key);
      if (q && TR && TR.from === q.i && !TR.arrived && TR.t0 < 0 && envOpen(q.w)) G.sideReveal = { q, t0: null };
      else if (!(TR && TR.from === uq.i)) { for (const p of SQ.SIDE) if (SQ.sideOpen(save, p, allOpen())) SQ.markSeen(save, p.key); persist(); }
    }
  }
  const SR = G.sideReveal, SR_T = 1.7;
  if (SR) {
    camTo(SR.q.y, 0.5, fresh || save.calm); // (calm: a cut, no glide)
    if (SR.t0 == null && Math.abs(S.y - clamp(SR.q.y - vh * 0.5, 0, S.max)) < 30 * u) SR.t0 = G.t;
    const rs = SR.t0 == null ? -1 : G.t - SR.t0;
    if (rs >= 0.5 && !SR.snd) { SR.snd = 1; audio.play('unlock', { pitch: 1.25 }); audio.play('star', { pitch: 1.2 }); buzz('tap'); }
    if (TR) TR.face = SR.q.x > L.stops[TR.from].x ? 1 : -1; // the hen looks at it
    if (rs >= SR_T) { for (const p of SQ.SIDE) if (SQ.sideOpen(save, p, allOpen())) SQ.markSeen(save, p.key); persist(); G.sideReveal = null; }
  }
  if (TR && TR.unl == null) TR.unl = TR.to > SN.top && !allOpen() ? 1 : 0;
  const UNL0 = 0.2, TRIP0 = TR && TR.unl ? 0.8 : 0.5; // the padlock breaks from 0.2 s; she sets off once it is gone
  if (TR && (G.treasure || gateHold || G.sideReveal)) { const a = L.stops[TR.from]; TR.t0 = -1; TR.x = a.x; TR.y = a.y; TR.p = 0; TR.e = 0; TR.dur = 1.2; } // the trip waits for the treasure sheet (and the gate)
  else if (TR) {
    if (TR.t0 < 0) TR.t0 = G.screenT;
    // 0.8.14: she walks the ROAD (the road is the curve x = pathX(y) through every stop), not a straight line over the
    // scenery; a longer stretch (a world's last stop to the next world's first) takes a little longer
    const a = L.stops[TR.from], b = L.stops[TR.to], dur = 1.2 * clamp(Math.abs(b.y - a.y) / (L.BH * L.stepFY), 1, 1.8), p = clamp((G.screenT - TR.t0 - TRIP0) / dur, 0, 1), e = p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p);
    TR.y = a.y + (b.y - a.y) * e; TR.x = L.pathX(TR.y); TR.p = p; TR.e = e; TR.dur = dur;
    camTo((TR.y + b.y) / 2, 0.55, fresh); // both stops in view: the padlock breaking ahead and the hen
    if (TR.unl && !TR.snd && G.screenT - TR.t0 - UNL0 >= 0.32) { TR.snd = 1; audio.play('unlock'); buzz('tap'); }
    if (p >= 1 && !TR.arrived) { TR.arrived = G.screenT; audio.play(TR.unl ? 'hen_land' : 'unlock', TR.unl ? {} : { pitch: 1.15 }); if (!TR.unl) buzz('tap'); }
    if (TR.arrived && G.screenT - TR.arrived > 0.6) { G.mapTravel = null; if (playable(TR.to)) press('lv:' + TR.to); }
  }
  const ulS = TR && TR.unl ? (TR.t0 < 0 ? -1 : G.screenT - TR.t0 - UNL0) : null; // the padlock break on the stop she goes to (s)
  // her nest while she climbs out of one and settles into the next (0.8.17: the nest's front is drawn over her then)
  const inA = TR ? 1 - ss01(TR.e / 0.12) : 0, inB = TR ? ss01((TR.e - 0.88) / 0.12) : 0;
  glideDt(S, dt);
  const sy = snapPx(S.y - vt, DPR); // map y -> screen y is (y - sy); whole device pixels, so the painted land stays crisp
  const t = G.t, calm = save.calm;
  // the land and the road, under everything
  ctx.save(); ctx.beginPath(); ctx.rect(0, vt, W_, vb - vt + (H_ - vb)); ctx.clip();
  MS.drawLand(ctx, L, sy, vt, H_, DPR);
  const nx = nextIdx();
  let doneTo = null; for (let i = 0; i < LEVELS.length; i++) if (bestStarsOf(LEVELS[i].id) > 0 || SK.isSkipped(save, LEVELS[i].id)) doneTo = L.stops[i].y;
  MS.drawRoad(ctx, L, sy, vt, H_, doneTo);
  // 0.8.17 the side quests' trails: stepping stones off the road (under the scenery's creatures, the stops and the hen)
  const sqState = (q) => (!envOpen(q.w) || !SQ.sideOpen(save, q, allOpen()) || (G.sideReveal && G.sideReveal.q === q && G.sideReveal.t0 == null) ? 'locked' : SQ.sideStars(save, q.key) > 0 ? 'won' : 'open');
  const srS = G.sideReveal && G.sideReveal.t0 != null ? G.t - G.sideReveal.t0 : -1;
  for (const q of SIDES) {
    if (q.y - sy < vt - 160 * u || q.y - sy > H_ + 120 * u) continue;
    const rv = G.sideReveal && G.sideReveal.q === q, n = rv && !save.calm ? Math.floor(q.trail.stones.length * ss01(srS / 0.5)) : 1e9;
    MSIDE.drawSideTrail(ctx, L, q, sy, rv && srS < 0.5 ? 'open' : sqState(q), n);
  }
  if (ui.skin && ui.skin.pack && ui.skin.pack.bg) drawRoadDress(ctx, L, sy, vt, H_, t, ui.skin.pack.bg, calm);
  MS.drawCast(ctx, L, sy, vt, H_, t, calm, DPR);
  const wide = mapWide(), gateW = G.mapGate ? G.mapGate.w : -1, ctaOn = playable(nx) && envOpen(envOf(nx)) && envOf(nx) !== gateW; // (not while its world's gate opens)
  const ctaH = (wide ? 52 : 60) * u, ctaW = Math.min(A.w - 2 * pad, (wide ? 250 : 440) * u), ctaX = wide ? A.x1 - pad - ctaW : A.cx - ctaW / 2, ctaY = vb - ctaH - (wide ? 4 : 20) * u; // 0.8.16: on the page column, clear of the bottom edge
  const tapBot = ctaOn && !wide ? ctaY - 6 * u : vb; // stops under the PLAY bar keep no tap target
  const wmY = (ctaOn ? ctaY - 12 * u : vb - 16 * u) - 46 * u, wmX = waitShown() ? A.x1 - pad - waitMarkW(46 * u) : Infinity; // 0.8.17: nor under the gift mark (waitMark below)
  G.mapView = { vt, vb: tapBot, cta: ctaOn ? { x: ctaX, y: ctaY, w: ctaW, h: ctaH } : null }; // QA: the part of the map that shows
  // a place's landmarks (0.8.7 the Farm, 0.8.10 the Crystal Caves, 0.8.12 the Volcano and the Vault): scenery beside the
  // road, drawn far to near; the level to play's landmark glows. 0.8.14: they are no longer the buttons (mykee: the hen
  // stood on the road by one landmark while its level's sign stood at another); the stop is the nest on the road
  const PL = MS.PLACES;
  const placeW = Object.keys(PL).map(Number).sort((a, b) => b - a);
  for (const w of placeW) {
    const Pz = PL[w], i0 = w * ROAD.PER_ENV;
    for (let k = Math.min(LEVELS.length - i0, Pz.landmarks.length) - 1; k >= 0; k--) {
      const m = Pz.stop(L, k), i = m ? m.gi : i0 + k; // (0.8.17: a landmark stands by its own stop, not always the k-th)
      if (!m || L.stops[i].w !== w || m.y - sy - 230 * u > H_ || m.y - sy + 60 * u < vt) continue;
      const cur = playable(i) && envOpen(w) && i === nx && !(TR && !TR.arrived);
      Pz.drawLandmark(ctx, L, m, sy, t, calm, 0, cur ? (calm ? 0.75 : 0.6 + 0.3 * Math.sin(t * 2.6)) : 0, DPR);
    }
    if (Pz.drawFront) Pz.drawFront(ctx, L, sy, t, calm, vt, H_); // the Farm's crow perches on the barn's vane: it flies over the landmarks
  }
  // the stops (0.8.14, mykee: "do we need to show flags for all the levels?"): one marker per level ON the road, the same
  // in every world (render/mapscene.js drawStop). 0.8.17 (mykee: "they are too small ... the previous build was displaying
  // quite good"): a locked level is a big stone disc with its number and a padlock; a won one its nest and golden egg, the
  // number on a badge at the front and the stars on a dark plate; the level to play the hen in her nest, a bigger badge
  let curAt = null, fromAt = null;
  for (let i = 0; i < LEVELS.length; i++) {
    const st0 = L.stops[i], x = st0.x, y = st0.y - sy;
    if (y < vt - 90 * u || y > H_ + 60 * u) continue;
    const Lv = LEVELS[i], w = st0.w, gated = !envOpen(w) || w === gateW, open = playable(i), boss = !!Lv.boss;
    const state = gated ? 'far' : open && i === nx ? 'cur' : bestStarsOf(Lv.id) > 0 ? 'won' : open && SK.isSkipped(save, Lv.id) ? 'skip' : open ? 'open' : 'far';
    const bx = MS.stopBox(L, state, boss);
    let x0 = x + bx.x0, x1 = x + bx.x1, y0 = y + bx.y0, y1 = y + bx.y1;
    if (x1 - x0 < 48) { x0 = x - 24; x1 = x + 24; } // a touch box of at least 48 px each way
    if (y1 - y0 < 48) { const m2 = (y0 + y1) / 2; y0 = m2 - 24; y1 = m2 + 24; }
    for (const ob of ui.buttons) { // (0.8.17 polish: two stops close on the road, a tablet's map: the later one's box gives way, so one tap is one level)
      if (!/^lv:/.test(ob.id) || x1 <= ob.x || x0 >= ob.x + ob.w || y1 <= ob.y || y0 >= ob.y + ob.h) continue;
      if ((y0 + y1) / 2 < ob.y + ob.h / 2) y1 = Math.min(y1, ob.y - 1); else y0 = Math.max(y0, ob.y + ob.h + 1);
    }
    let tb = ctaOn && wide && x1 > ctaX - 6 * u ? Math.min(tapBot, ctaY - 6 * u) : tapBot;
    if (x1 > wmX - 6 * u && y1 > wmY - 6 * u) tb = Math.min(tb, wmY - 6 * u);
    let p = 0;
    if (state !== 'far' && y0 >= vt + 2 * u && y1 <= tb) { // a stop half under the header or the PLAY bar keeps no tap target
      ui.button('lv:' + i, '', x0, y0, x1 - x0, y1 - y0, { ghost: true, disabled: !open });
      p = calm ? 0 : ui.pressAmt('lv:' + i, ui.pressedId === 'lv:' + i);
    }
    // the nest the hen sits in is drawn in two passes, its front (rim, badge, plate) over her
    const henIn = TR ? (i === TR.from && inA > 0) || (i === TR.to && inB > 0) : state === 'cur' && !G.sideWalk; // (0.8.17: she is out on a side quest's trail)
    const o = { w, num: Lv.id, stars: starsOf(Lv.id), boss, DPR, p, part: henIn ? 'back' : 'all', hard: isHardLevel(Lv) && save.mode !== 'easy' };
    if (TR && i === TR.from) { TR.fromSt = state; fromAt = { x, y, o }; } // the nest she climbs out of
    if (TR && i === TR.to && ulS != null && ulS < MS.UNLOCK_T && state === 'cur') { // its padlock breaks away, then it turns into her nest
      if (ulS < 0) MS.drawStop(ctx, L, x, y, 'next', o); else MS.drawUnlock(ctx, L, x, y, o, ulS, calm);
      continue;
    }
    if (state === 'cur') { if (!(TR && !TR.arrived)) MS.drawStopCall(ctx, L, x, y, t, calm, boss); curAt = { x, y, o, boss, i }; }
    MS.drawStop(ctx, L, x, y, state, o);
    if (state === 'won' || state === 'cur') pacerStopMark(Lv.id, x, y, L.stopR, t, calm); // the Pacer: a dare met here, or "+1 star here" at a star gate
  }
  // 0.8.17 the side quests' doors (render/mapside.js): locked (dim, a padlock), open (it glows and bobs), won (its stars).
  // A tap on an open one walks the hen down its trail and opens its card; one half under the header or PLAY takes no tap.
  for (const q of SIDES) {
    const y = q.y - sy;
    if (y < vt - 120 * u || y > H_ + 90 * u) continue;
    const st = sqState(q), rv = G.sideReveal && G.sideReveal.q === q;
    if (rv && srS < 0.5) continue; // (the reveal: the trail draws in first, then the door pops)
    const b = q.box, by0 = b.y0 - sy, by1 = b.y1 - sy;
    let tb = tapBot; if (b.x1 > wmX - 6 * u && by1 > wmY - 6 * u) tb = Math.min(tb, wmY - 6 * u); if (ctaOn && wide && b.x1 > ctaX - 6 * u) tb = Math.min(tb, ctaY - 6 * u);
    let p = 0;
    if (st !== 'locked' && by0 >= vt + 2 * u && by1 <= tb && !G.sideWalk) { ui.button('sq:' + q.w, '', b.x0, by0, b.x1 - b.x0, by1 - by0, { ghost: true }); p = calm ? 0 : ui.pressAmt('sq:' + q.w, ui.pressedId === 'sq:' + q.w); }
    const bo = (k) => { const q2 = k - 1; return 1 + 2.7 * q2 * q2 * q2 + 1.7 * q2 * q2; }, pop = rv && !calm ? 0.35 + 0.65 * bo(clamp((srS - 0.5) / 0.4, 0, 1)) : 1;
    MSIDE.drawSideDoor(ctx, L, q, sy, rv ? 'open' : st, { t, calm, stars: SQ.sideStars(save, q.key), DPR, p, pop, glow: rv && calm ? 0.8 : 0 });
    if (rv) MSIDE.drawSideBurst(ctx, L, q, sy, srS - 0.5, calm);
  }
  // the boss treasures: a chest beside every boss stop, on the side away from where the hen would stand
  for (let i = 0; i < LEVELS.length; i++) {
    const Lv = LEVELS[i];
    if (!Lv.boss || !E.bossTreasure(Lv.id)) continue;
    const st0 = L.stops[i], spot = mfChestSpot(L, i, A, u), r = spot.r, y = st0.y - sy; // 0.8.14: clear of the boss's nest and its ring
    if (y < vt - r * 3 || y > H_ + r * 3 || !envOpen(st0.w)) continue;
    const cr = spot.cr, cx = spot.x; // 0.8.17 (mapfarm.js chestSpot): the outer side, unless the screen edge or a neighbouring stop is in the way
    const cy = spot.y - sy, beaten = bossBeaten(Lv.id), opened = E.treasureOpened(save.wallet, Lv.id), state = opened ? 'open' : beaten ? 'ready' : 'locked';
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
  // the hen (0.8.14): her feet in the level to play's nest, facing the road ahead; after a win she walks the ROAD from the
  // nest just won to the next one and steps into it (the nest's front rim is drawn over her feet), then a burst
  const hh = L.stopR * 2; // drawHenAnim: her feet rest at cy + 0.5 h
  const ahead = (i) => { const a = L.stops[i], n2 = L.stops[i + 1] || null, b2 = L.stops[i - 1] || a; const dx = n2 ? n2.x - a.x : a.x - b2.x; return dx >= 0 ? 1 : -1; };
  // worlds behind their gate: fog, and the gate across the road at the world's foot (0.8.17: no card over the map)
  const totalStars = bestTotal();
  let firstShut = -1; for (let w = 0; w < L.nw; w++) if (!envOpen(w)) { firstShut = w; break; }
  for (let w = 0; w < L.nw; w++) {
    const top = L.bandTop(w) - sy, bot = top + L.BH;
    if (bot < vt - 40 * u || top > H_ + 80 * u) continue;
    const opening = w === gateW, gs = opening && G.mapGate.t0 != null ? G.t - G.mapGate.t0 : -1, locked = !envOpen(w) || opening;
    if (locked) MS.drawFog(ctx, L, w, sy, t, calm, gs < 0 ? 0 : ss01((gs - 0.45) / 0.95)); // opening: the fog rolls away upward
    // the world sign at its foot: number and name on a wooden board (opening: it drops in once the gate has swung open)
    const sp = MS.signSpot(L, w), name = WORLDS[w] || '', ns = 15 * u, sk = opening ? clamp((gs - 0.85) / 0.5, 0, 1) : locked ? 0 : 1;
    const syy = sp.y - sy - (calm ? 0 : (1 - sk) * (1 - sk) * 60 * u);
    if ((!locked || sk > 0) && syy > vt - 30 * u && syy < H_ + 30 * u) {
      ctx.save(); if (sk < 1) ctx.globalAlpha = ss01(sk * 2.5);
      const tw = ui.measure(name, ns), bw2 = tw + 52 * u, bh2 = 30 * u, bx2 = clamp(L.pathX(sp.y) + (L.pathX(sp.y) < A.cx ? 1 : -1) * (bw2 / 2 + L.roadW), A.x + bw2 / 2 + 6 * u, A.x1 - bw2 / 2 - 6 * u);
      ctx.fillStyle = '#5a3a1a'; ctx.fillRect(bx2 - bw2 * 0.3, syy - 4 * u, 5 * u, 22 * u); ctx.fillRect(bx2 + bw2 * 0.3 - 5 * u, syy - 4 * u, 5 * u, 22 * u);
      ui.roundRect(bx2 - bw2 / 2, syy - bh2, bw2, bh2, 8 * u); ctx.fillStyle = '#c99a5a'; ctx.fill(); ctx.lineWidth = 3 * u; ctx.strokeStyle = '#5a3a1a'; ctx.stroke();
      ctx.beginPath(); ctx.arc(bx2 - bw2 / 2 + 15 * u, syy - bh2 / 2, 10 * u, 0, 7); ctx.fillStyle = MS.WORLD_LOOK[w].accent; ctx.fill();
      ctx.font = `600 ${Math.round(12 * u)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(String(w + 1), bx2 - bw2 / 2 + 15 * u, syy - bh2 / 2 + 0.5 * u);
      ctx.font = `600 ${Math.round(ns)}px ${FONT}`; ctx.fillStyle = '#3a2008'; ctx.fillText(name, bx2 + 12 * u, syy - bh2 / 2 + 0.5 * u);
      ctx.restore();
    }
    if (!locked) continue;
    // the gate: a star, have / need and a thin bar on its board, no sentence. Only the first shut world may be opened with
    // coins (0.8.17): its coin button hangs under the board (not before level 3 is won); farther worlds show the board only
    // coins open a world only when it may open right now (envReady on the coin branch: the world before is open and its boss
    // won or skipped; until that merges, the same rule inline) and stars alone do not already open it (price 0)
    const bi = Math.min(LEVELS.length, w * PER_ENV) - 1, ready = typeof envReady === 'function' ? envReady(w) : w === firstShut && bi >= 0 && (bestStarsOf(LEVELS[bi].id) > 0 || SK.isSkipped(save, LEVELS[bi].id));
    const coin = ready && GATE_COINS(w) > 0 && gs < 0 && !earlyDays(), g = MS.drawGate(ctx, L, w, sy, { have: totalStars, need: envNeed(w), s: gs, calm, coin });
    const Bd = g.board, by0 = Bd.y - sy;
    if (gs < 0 && by0 >= vt + 2 * u && by0 + Bd.h <= tapBot) ui.record({ x: Bd.x, y: by0, w: Bd.w, h: Bd.h }, 'levels:gateboard' + w, 'levels:gateboard' + w);
    if (coin) {
      const price = GATE_COINS(w), rich = save.wallet.coins >= price, Bt = g.btn, bty = Bt.y - sy;
      if (bty + Bt.h < vt || bty > H_ || (ctaOn && wide && Bt.x + Bt.w > ctaX - 6 * u && bty + Bt.h > ctaY - 6 * u)) continue; // (never under PLAY in the corner)
      const full = bty >= vt + 2 * u && bty + Bt.h <= tapBot, n0 = ui.rects.length, b0 = ui.buttons.length;
      const r = ui.button('gate:' + w, '', Bt.x, bty, Bt.w, Bt.h, { kind: rich ? 'gold' : 'off', disabled: !rich, dim: 1 });
      if (!full) { ui.rects.length = n0; ui.buttons.length = b0; }
      const fs = 18 * u, ow = ui.measure('Open', fs), pw = ui.measure(String(price), fs), cr = 9 * u, tot = ow + 9 * u + cr * 2 + 5 * u + pw, lx = Bt.x + Bt.w / 2 - tot / 2;
      const tc = { size: fs, color: '#fff', stroke: rich ? '#6b3d04' : 'rgba(40,40,48,0.8)', strokeW: 3 * u, noRecord: true };
      ui.text('Open', lx, r.cy + 0.5 * u, tc);
      drawCoin(ctx, lx + ow + 9 * u + cr, r.cy, cr, rich && !calm ? G.t : 0);
      ui.text(String(price), lx + ow + 9 * u + cr * 2 + 5 * u, r.cy + 0.5 * u, tc);
    }
  }
  // 0.8.17: the hen last, over every stop, sign and gate (she walked behind a world's sign)
  G.mapHen = null;
  if (TR) {
    const bA = !!LEVELS[TR.from].boss, bB = !!LEVELS[TR.to].boss, fa = MS.stopFeet(L, bA), fb = MS.stopFeet(L, bB), e = TR.e;
    const sA = TR.fromSt || 'won'; // 0.8.16: she climbs out of the nest she sat in and settles into the next one
    const steps = Math.max(3, Math.round(4 * (TR.dur || 1.2) / 1.2));
    const hop = calm || TR.arrived ? 0 : Math.abs(Math.sin(e * Math.PI * steps)) * hh * 0.2 * (1 - e * 0.4);
    const dirY = L.stops[TR.to].y < L.stops[TR.from].y ? -1 : 1, dx = L.pathX(TR.y + dirY * 8 * u) - TR.x;
    if (TR.face == null) TR.face = ahead(TR.from) * (dirY < 0 ? 1 : -1);
    if (G.sideReveal) { /* she looks at the side quest's door (set above) */ } else if (TR.arrived || e > 0.92) TR.face = ahead(TR.to); else if (Math.abs(dx) > 1.5 * u) TR.face = dx > 0 ? 1 : -1;
    const gy = TR.y - sy + fa + (fb - fa) * e + inA * (MS.nestSeat(L, sA, bA, hh) - fa) + inB * (MS.nestSeat(L, 'cur', bB, hh) - fb), hx = TR.x; // the ground under her feet (in a nest: down in the straw)
    if (hop > 0.5) { ctx.beginPath(); ctx.ellipse(hx, gy + 1 * u, hh * 0.26 * (1 - hop / (hh * 0.6)), hh * 0.065, 0, 0, 7); ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fill(); }
    // 0.8.17 (mykee: "the hen and the nest are coinciding ... I could see the hen background"): she is drawn whole and
    // opaque over every stop; only in a nest is anything of her hidden (what pokes out under it), and that nest's front
    // is drawn over her. On the road between, nothing clips her.
    const na = L.stops[inA > 0 ? TR.from : TR.to];
    ctx.save(); if (inA > 0) MS.nestClip(ctx, L, na.x, na.y - sy, sA, bA); else if (inB > 0) MS.nestClip(ctx, L, na.x, na.y - sy, 'cur', bB);
    drawHenAnim(ctx, TR.arrived ? 'happy' : 'idle', hx, gy - hop - hh * 0.5, hh, t, { key: 'map', face: TR.face, calm, shadow: 0 });
    ctx.restore();
    G.mapHen = { x: hx, y: gy - hop, to: TR.to };
    if (inA > 0 && fromAt) MS.drawStop(ctx, L, fromAt.x, fromAt.y, sA, { ...fromAt.o, part: 'front' });
    if (inB > 0 && curAt && curAt.i === TR.to) MS.drawStop(ctx, L, curAt.x, curAt.y, 'cur', { ...curAt.o, part: 'front' });
    if (TR.arrived) {
      const k = clamp((G.screenT - TR.arrived) / 0.6, 0, 1), b = L.stops[TR.to], by = b.y - sy;
      ctx.save(); ctx.globalAlpha = 1 - k; ctx.lineWidth = 4 * u * (1 - k) + 1; ctx.strokeStyle = '#ffe27a';
      ctx.beginPath(); ctx.ellipse(b.x, by + 4 * u, L.stopR * (1.3 + 1.4 * k), L.stopR * (0.6 + 0.7 * k), 0, 0, 7); ctx.stroke();
      for (let q = 0; q < 8; q++) { const an = q * Math.PI / 4 + 0.3, rr = L.stopR * (1.2 + 1.6 * k); drawStar(ctx, b.x + Math.cos(an) * rr, by - hh * 0.3 + Math.sin(an) * rr * 0.8, 6 * u * (1 - k * 0.5), true); }
      ctx.restore();
    }
  } else if (G.sideWalk) { // 0.8.17: she hops out of her nest and down the side quest's trail to its door, then its card opens
    const W = G.sideWalk, q = W.q, st = L.stops[q.i], tr = q.trail, k = clamp((G.screenT - W.t0) / 1.0, 0, 1), e = k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k);
    camTo((q.y + st.y) / 2, 0.55, false);
    const P = e < 0.2 ? { x: st.x + (tr.a.x - st.x) * (e / 0.2), y: st.y + (tr.a.y - st.y) * (e / 0.2) } : tr.f((e - 0.2) / 0.8);
    const h2 = hh * 0.86, hop = calm || k >= 1 ? 0 : Math.abs(Math.sin(k * Math.PI * 5)) * h2 * 0.14, face = q.x > st.x ? 1 : -1;
    if (hop > 0.5) { ctx.beginPath(); ctx.ellipse(P.x, P.y - sy + 1 * u, h2 * 0.24, h2 * 0.06, 0, 0, 7); ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fill(); }
    drawHenAnim(ctx, k >= 1 ? 'happy' : 'idle', P.x, P.y - sy - hop - h2 * 0.5, h2, t, { key: 'map', face, calm, shadow: 0 });
    G.mapHen = { x: P.x, y: P.y - sy - hop, side: q.w };
    if (k >= 1 && !W.done) { W.done = G.screenT; audio.play('hen_land'); }
    if (W.done && G.screenT - W.done > 0.25) { G.sideWalk = null; wonder.start(q.key, { side: { w: q.w } }); }
  } else if (curAt) {
    const fy = curAt.y + MS.nestSeat(L, 'cur', curAt.boss, hh); // 0.8.16: sitting IN the nest, her lower half in the straw
    ctx.save(); MS.nestClip(ctx, L, curAt.x, curAt.y, 'cur', curAt.boss);
    drawHenAnim(ctx, 'idle', curAt.x, fy - hh * 0.5, hh, t, { key: 'map', face: ahead(curAt.i), calm, shadow: 0 });
    ctx.restore();
    G.mapHen = { x: curAt.x, y: fy, to: curAt.i };
    MS.drawStop(ctx, L, curAt.x, curAt.y, 'cur', { ...curAt.o, part: 'front' });
  }
  ctx.restore();
  // the fixed header: a soft band so the map slides under it
  const hb = ctx.createLinearGradient(0, 0, 0, vt + 10 * u);
  hb.addColorStop(0, 'rgba(26,16,48,0.94)'); hb.addColorStop(Math.max(0, (vt - 4 * u) / (vt + 10 * u)), 'rgba(26,16,48,0.88)'); hb.addColorStop(1, 'rgba(26,16,48,0)');
  ctx.fillStyle = hb; ctx.fillRect(0, 0, W_, vt + 10 * u);
  const X0 = A.x + pad, X1 = A.x1 - pad, Y0 = A.y + pad, hy = Y0 + 23 * u;
  ui.button('back', '', X0, Y0, 46 * u, 46 * u, { kind: 'hud', icon: ICON.left, iconS: 1.3, round: 15 * u });
  const remB = remChipOn() ? 46 * u + 8 * u : 0; if (remB) drawRemChip(X0 + 54 * u, Y0, 46 * u); // 0.8.17: reminders are off: the bell with a slash, beside back
  const starTxt = `${totalStars} / ${LEVELS.length * 3 + SQ.SIDE_MAX}`, stw = ui.measure(starTxt, 17 * u); // (0.8.17: the side quests' bonus stars count too)
  const chipW = 9 * u + 22 * u + 4 * u + stw + 12 * u, chipX = X1 - chipW;
  ui.glass(chipX, hy - 18 * u, chipW, 36 * u);
  drawStar(ctx, chipX + 9 * u + 11 * u, hy, 9.5 * u, true);
  ui.record({ x: chipX + 9 * u, y: hy - 11 * u, w: 22 * u, h: 22 * u }, 'levels:staricon', 'levels:stars');
  ui.text(starTxt, X1 - 12 * u, hy + 0.5 * u, { size: 17 * u, align: 'right', color: '#fff', stroke: 'rgba(30,14,4,0.7)', strokeW: 3 * u, tag: 'levels:stars', group: 'levels:stars' });
  // shop and the next star chest: their own row on a phone, beside the stars in landscape
  const chest = E.chestFor(totalStars, save.wallet.chests);
  const spinOn = SP.open(save), nb = spinOn ? 3 : 2; // 0.8.15: the Lucky Spin joins the row once it exists (level 3 won)
  const bw4 = wide ? (spinOn ? 108 : 120) * u : 0, rowY = wide ? Y0 + 1 * u : Y0 + 46 * u + 12 * u, rh = 44 * u;
  const midW = wide ? bw4 * nb + 10 * u * (nb - 1) : Math.min(A.w - 2 * pad, 440 * u), mx = wide ? chipX - 14 * u - midW : A.cx - midW / 2, half = (midW - 10 * u * (nb - 1)) / nb;
  purseBtn(mx, rowY, half, rh, 17 * u);
  if (chest) ui.button('chest', chest.ready ? 'Open!' : `${totalStars}/${chest.at}`, mx + half + 10 * u, rowY, half, rh, { kind: chest.ready ? 'primary' : 'off', shimmer: chest.ready, disabled: !chest.ready, dim: 1, iconS: 1.25, icon: (c, x, y, s2) => { drawChest(c, x, y, s2, G.t, chest.ready ? 'ready' : 'locked'); if (chest.reward.skin && !E.ownsSkin(save.wallet, chest.reward.skin)) drawSkinPreview(c, chest.reward.skin, x - s2 * 0.55, y - s2 * 0.08, s2 * 0.8, G.t); }, size: 15 * u });
  if (spinOn) { // free spins waiting: green and it says so; none: the meter (wins so far of the three a spin takes)
    const M = SP.meter(save);
    ui.button('spin', M.bank ? (M.bank > 1 ? `Spin x${M.bank}` : 'Spin!') : `${M.have}/${M.of}`, mx + 2 * (half + 10 * u), rowY, half, rh, { kind: M.bank ? 'primary' : 'secondary', shimmer: !!M.bank, iconS: 1.2, icon: (c, x, y, s2) => drawSlotIcon(c, x, y, s2 * 0.42, M.bank && !save.calm ? G.t : 0), size: 15 * u });
  }
  // the ribbon names the world in the middle of the view
  const midY = S.y + vh * 0.5;
  let wv = 0;
  for (let w = L.nw - 1; w >= 0; w--) if (midY >= L.bandTop(w) - L.BH * 0.02) { wv = w; break; }
  for (let w = 0; w < L.nw; w++) if (midY >= L.bandTop(w)) { wv = w; break; }
  const titleL = X0 + 46 * u + remB + 18 * u, titleR = (wide ? mx : chipX) - 18 * u, wname = WORLDS[wv] || 'Levels';
  const rbw = clamp(ui.measure(wname, 20 * u) + 36 * u, Math.min(120 * u, titleR - titleL), titleR - titleL);
  ui.ribbon(wname, (titleL + titleR) / 2, hy - 18 * u, rbw, 36 * u, { color: MS.WORLD_LOOK[wv].accent, size: 20 * u, tag: 'levels:title' });
  // how far along: a thin bar of the whole journey and the levels still to play
  const cleared = LEVELS.reduce((a, Lv) => a + (bestStarsOf(Lv.id) > 0 ? 1 : 0), 0), left = LEVELS.length - cleared;
  const py = wide ? Y0 + 46 * u + 12 * u : rowY + rh + 10 * u + 10 * u, pw = Math.min(A.w - 2 * pad, (wide ? 340 : 440) * u), px0 = A.cx - pw / 2;
  const lt = left ? `${left} level${left === 1 ? '' : 's'} to go` : 'Every level cleared!', ltw = ui.measure(lt, 13 * u), bw3 = pw - ltw - 12 * u;
  ui.roundRect(px0, py - 4 * u, bw3, 8 * u, 4 * u); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
  if (cleared) { ui.roundRect(px0, py - 4 * u, Math.max(8 * u, bw3 * cleared / LEVELS.length), 8 * u, 4 * u); ctx.fillStyle = '#f6c454'; ctx.fill(); }
  ui.text(lt, px0 + pw, py + 0.5 * u, { size: 13 * u, align: 'right', color: '#fff', stroke: 'rgba(30,14,4,0.65)', strokeW: 2.5 * u, tag: 'levels:left' });
  // the big PLAY at the foot of the screen (the map runs on under it)
  if (ctaOn) {
    if (!wide) { const fb = ctx.createLinearGradient(0, ctaY - 30 * u, 0, H_); fb.addColorStop(0, 'rgba(20,10,30,0)'); fb.addColorStop(1, 'rgba(20,10,30,0.5)'); ctx.fillStyle = fb; ctx.fillRect(0, ctaY - 30 * u, W_, H_ - ctaY + 30 * u); }
    ui.button('lv:' + nx, `PLAY  Level ${LEVELS[nx].id}`, ctaX, ctaY, ctaW, ctaH, { kind: 'primary', shimmer: true, icon: ICON.play, size: (wide ? 20 : 23) * u, round: 18 * u });
  }
  waitMark(X1, wmY, 46 * u); // 0.8.17: rewards that waited for a connection, over PLAY's right end
  drawShopHand(); // 0.8.14: once, the first time the shop mark turns on
  if (S.max > 0 && !calm) { // a thin scroll thumb
    const th = Math.max(30 * u, vh * vh / L.H), ty2 = vt + clamp(S.y / S.max, 0, 1) * (vh - th - 4 * u);
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
// ---------------------------------------------------------------- the Lucky Spin page (0.8.15)
// Rules: spin.js (the odds, the three ways to spin, what a prize turns into). Art: render/slot.js, a three-reel
// machine with a lever (mykee: "a three column turning slot machine like Jetpack Joyride uses"). This page asks spin.js
// for the result FIRST (it is in the wallet and saved before a reel moves), then runs the three reels onto it.
// Every pull ends on three of a kind: three of a prize win it, three villains take it (mykee, 12:41: "every spin
// doesn't win"). A mixed row is never shown, so there is no staged near miss, and nothing is lost by closing the game
// mid-spin. The machine never sells coins: a coin spin with too few coins says so and stops.
// The cast (mykee: "character pictures for powerups and villains ... the hen should have proper expressions and
// movements"): the reels show the booster that is really being won, the player's own power chick for a Chick Charge
// and a villain he has met; the hen on the roof walks along with the reels, frets while they run, hops as each prize
// locks, dances for the row, and gasps and cries when the villains come up and laugh on the reels.
// 0.8.17 (mykee: "we don't have to show the result card to the user ... it is not a good experience"): no card. The
// machine and the cast tell it: a prize rises out of the tray and flies to where it lives (coins onto the purse in the
// header, a thing into the bag); a villain row flashes red, the cabinet sags and smokes, the villains cackle in place.
const TAU = Math.PI * 2;
const spinSlices = () => SP.wheel(save);
// the thieves that can come up on the reels, with the voice each has in the game; only ones this player has met
const SPIN_VILLAINS = { weasel: 'weasel_snicker', snake: 'snake_hiss', rats: 'rat_squeak', octopus: 'ink_squirt', frog: 'tongue_lick', eagle: 'eagle_screech', salamander: 'sal_huff', chameleon: 'tongue_lick', hermit: 'crab_snap', gator: 'gator_snap', spider: 'gear_whir' };
function spinVillain(not) {
  const met = Object.keys(SPIN_VILLAINS).filter((k) => save.seen['v:' + k] && hasPortrait(k)), pool = met.length > 1 ? met.filter((k) => k !== not) : met;
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : 'weasel'; // (which villain is looks only: the roll was made before this)
}
const spinChick = () => { const open = strikesOpen(); return (open.find((k) => k.id === save.lastStk) || open[open.length - 1] || { id: 'freeze' }).id; };
const spinBoost = () => { const all = E.BOOSTER_ORDER.filter((b) => b !== 'scare'); return all[Math.floor(Math.random() * all.length)]; };
// the reels' pictures with the cast put in
const spinReels = (C) => spinSlices().map((sl) => (sl.kind === 'villain' ? { ...sl, who: C.who } : sl.kind === 'booster' ? { ...sl, item: sl.id === 'b2' ? C.item2 : C.item } : sl.kind === 'charge' ? { ...sl, chick: C.chick } : sl));
const villainName = (k) => `The ${(VILLAIN_INFO[k] || {}).name || "villain"}`;
const sliceName = (s) => (s.kind === 'villain' ? 'Three villains' : s.kind === 'coins' ? `${s.n} coins` : s.kind === 'booster' ? (s.n > 1 ? `${s.n} boosters` : '1 booster') : s.kind === 'coupon' ? 'Half-price ticket' : s.kind === 'charge' ? E.CHARGE_ITEM.name : s.kind === 'scare' ? E.BOOSTERS.scare.name : s.kind === 'skip' ? E.ITEMS.skip.name : 'Rare bird');
const sliceNote = (s) => (s.kind === 'villain' ? 'No prize. Never three times in a row' : s.kind === 'booster' ? 'Any kind' : s.kind === 'coupon' ? `${Math.round((E.COUPON.coins * SP.coinX(save)) / 5) * 5} coins if you hold one` : s.kind === 'scare' ? 'Villains keep away at the start' : s.kind === 'rare' ? 'An outfit or a chick you do not own' : '');
// the prize's picture: the reveal's hero and the odds sheet's rows share it
function spinArt(c, art, x, y, s, t) { if (art === 'chest') drawChest(c, x, y + s * 0.06, s * 0.62, t, 'open'); else if (art === 'ticket') drawTicket(c, x, y, s * 0.9); else if (art === 'skip') drawItemArt(c, 'skip', x, y, s, t); else drawPart(c, art, x, y, s, t); }
const REEL_T = [1.9, 2.55, 3.3]; // seconds each reel runs on its own: left, middle, right (the last one keeps you waiting)
// 0.8.17 TAP TO STOP (mykee: "the moment they tap on the screen the slot machine slowly stops"): while the reels turn,
// each tap stops the next reel still at speed (left, middle, right); it eases down over about STOP_T, runs a touch past
// its picture and settles back with a clunk. The result was rolled when the lever was pulled (spinGo asks spin.js
// first, and it is in the wallet before a reel moves): a tap NEVER changes it, only when each reel comes to rest. A tapped
// reel still stops on the rolled picture (its stop place is the rolled one plus whole turns); when it is too far to ease
// there in time, the reel (a blur at that speed) skips whole tiles unseen.
const STOP_T = 0.45, STOP_OV = 0.14, STOP_BACK = 0.12;
function reelAt(r, t) { // a running reel's place at time t: its own run, or the stop a tap gave it
  const s = r.stop;
  if (s) {
    const k = t - s.t0;
    if (k >= s.T + STOP_BACK) return s.p1;
    if (k >= s.T) { const q = 1 - (k - s.T) / STOP_BACK; return s.p1 + STOP_OV * q * q; }
    const q = Math.max(0, k / s.T), D = s.p1 + STOP_OV - s.p0; // a cubic from its speed at the tap down to rest
    return s.p0 + s.v0 * s.T * (q - 2 * q * q + q * q * q) + D * (3 * q * q - 2 * q * q * q);
  }
  const x = clamp((t - r.t0) / r.dur, 0, 1), b0 = r.a0 - 0.28, u1 = (x - 0.05) / 0.85; // a kick back, a run that gathers and fades, a little too far, and home
  return x < 0.05 ? r.a0 - 0.28 * Math.sin((x / 0.05) * Math.PI / 2) : x < 0.9 ? b0 + (r.a1 + 0.16 - b0) * (1 - Math.pow(1 - Math.pow(u1, 1.35), 2.4)) : r.a1 + 0.16 * Math.pow(1 - (x - 0.9) / 0.1, 2);
}
const reelLock = (r) => (r.stop ? r.stop.t0 + r.stop.T : r.t0 + r.dur * 0.9); // the clunk
const reelEnd = (r) => (r.stop ? r.stop.t0 + r.stop.T + STOP_BACK : r.t0 + r.dur);
const reelSettling = (r, t) => !!r.stop || r.done || t >= r.t0 + r.dur * 0.62; // already slowing to its stop by itself
const nextReel = (S) => (S.run ? S.run.findIndex((r) => !r.want && !reelSettling(r, G.t)) : -1);
function stopReel(S, i) {
  const r = S.run[i], t = G.t, n = spinSlices().length, p0 = reelAt(r, t), v0 = (reelAt(r, t + 0.01) - p0) / 0.01;
  if (v0 < 7) { r.want = true; return; } // still winding up: it stops as soon as it is up to speed
  r.want = false;
  let p1 = r.a1 + n * Math.ceil((p0 + (v0 * STOP_T) / 3 + 0.2 - STOP_OV - r.a1) / n), D = p1 + STOP_OV - p0, jump = 0; // the rolled picture, whole turns on
  if (D > v0 * 0.7) { jump = Math.round(D - v0 * STOP_T * 0.6); D -= jump; } // too far to ease there: skip whole tiles (a blur)
  const T = clamp(STOP_T, D / v0, (3 * D) / v0); // the ease starts at the reel's own speed and never runs backward
  r.stop = { t0: t, p0: p0 + jump, v0, p1, T };
}
// the nudge (mykee: "show it to the user, kind of a nudge"): a hand taps the reel that stops next, for the first five
// spins on this device and again whenever the last three went by without a tap. Per device (browser storage).
const NUDGE_KEY = 'egg.spinNudge';
function nudgeRead() { try { const o = JSON.parse(localStorage.getItem(NUDGE_KEY) || '{}') || {}; return { n: Math.max(0, o.n | 0), taps: Array.isArray(o.taps) ? o.taps.slice(-3) : [] }; } catch (e) { return { n: 0, taps: [] }; } }
const nudgeOn = () => { const o = nudgeRead(); return o.n < 5 || (o.taps.length >= 3 && !o.taps.some(Boolean)); };
function nudgeNote(tapped) { const o = nudgeRead(); o.n++; o.taps = [...o.taps, !!tapped].slice(-3); try { localStorage.setItem(NUDGE_KEY, JSON.stringify(o)); } catch (e) { /* (a private window: the hand just shows again) */ } }
function openSpin() {
  if (!SP.open(save) || G.screen === 'spin') return;
  const b1 = spinBoost();
  land.clear();
  G.spin = { from: G.screen, reels: G.spin && G.spin.reels ? G.spin.reels.map((p) => Math.round(p)) : [0, 1, 2], run: null, st: 'idle', leverT: -9, tickT: -9, buzzT: -9, sheet: false, lit: false,
    cast: { who: spinVillain(), item: b1, item2: spinBoost(), chick: spinChick() }, hx: 0.5, hv: 0, henN: 0, stops: 0, miss: false, missT: -99 };
  resetHen('spin');
  G.getMore = null; G.detail = null; G.toasts = []; G.toast = null;
  setScreen('spin'); audio.play('ui_open');
}
function closeSpin() {
  const S = G.spin;
  if (S && S.sheet) { S.sheet = false; return; }
  if (S && S.st !== 'idle') return spinSkip();
  land.clear(); releaseSlot();
  setScreen(S && S.from && S.from !== 'spin' ? S.from : 'levels');
}
// a tap while the machine is busy: it stops the next reel; with the row in, it sends the prize on its way (a second
// lands it at once); after the villains, it lets them go
function spinSkip() {
  const S = G.spin;
  if (!S) return;
  if (S.st === 'spinning' && S.run) { const i = nextReel(S); if (i >= 0) { S.tapped = true; stopReel(S, i); audio.play('slot_tick', { vol: 0.7, pitch: 0.8 }); buzz('tap'); } }
  else if (S.st === 'stopped') { S.st = 'prize'; S.popT = G.t - SPIN_POP; audio.play('hud_pop', { vol: 0.8 }); }
  else if (S.st === 'prize') { if (!S.flyT) S.popT = Math.min(S.popT, G.t - SPIN_POP - spinHold(S)); else if (land.busy()) land.finish(); }
  else if (S.st === 'stolen' && G.t - S.tStop > 0.5) S.tStop = G.t - 9;
}
async function spinGo(how) {
  const S = G.spin;
  if (!S || S.st !== 'idle' || S.sheet || G.adBusy || G.screen !== 'spin') return;
  const day = today(), W = SP.ways(save, day);
  if (how === 'free' ? !W.free : how === 'ad' ? !W.ad : how === 'retry' ? !W.retry : W.coin == null) return;
  if (how === 'coin' && save.wallet.coins < W.coin) { S.shortT = G.t; audio.play('ui_back'); return; } // the machine sells nothing: no "Get more" sheet here
  const SPk = how === 'ad' ? { kind: 'spin', n: 1, key: `spin:${day}:${SP.state(save).t.ad}`, kept: () => { SP.state(save).t.ad++; } } : null; // 0.8.17: offline, the video spin waits
  if (how === 'ad' || (how === 'retry' && W.retry === 'ad')) { if (!(await rewarded('spin', SPk))) return; if (G.screen !== 'spin' || G.spin !== S || S.st !== 'idle') return; }
  if (land.busy()) land.finish();
  land.clear(); S.landOff = 0; // (the last prize's chips go)
  const snap = (w) => JSON.stringify({ ...E.sanitizeWallet(w), coins: 0 }), w0 = snap(save.wallet), c0 = E.sanitizeWallet(save.wallet).coins, M0 = SP.meter(save);
  // THE RESULT IS ROLLED HERE, before a reel moves (and saved): taps on the reels only choose when each one stops
  const res = SP.spin(save, how, day);
  if (!res) return;
  S.shown = { W, M: M0 }; // the controls keep showing what they showed until the reels have stopped: they must not give the result away
  S.res = res; S.miss = !!res.miss; S.stops = 0; S.henN++; S.popT = 0; S.flyT = 0; S.tapped = false; S.nudge = !save.calm && nudgeOn();
  // the cast for this pull: the booster really won (else any), his chick, and a villain he knows (a new face each time)
  S.cast = { who: res.miss ? spinVillain(S.cast.who) : S.cast.who, item: res.prize && res.prize.kind === 'booster' && res.slice.id === 'b1' ? res.prize.item : S.cast.item, item2: res.prize && res.prize.kind === 'booster' && res.slice.id === 'b2' ? res.prize.item : S.cast.item2, chick: spinChick() };
  if (res.miss) { ledWhy = 'spin'; BR.why(save, 'spin', 'vil', how); persist(); S.got = null; S.big = 0; S.missHow = how; }
  else spinPrize(S, res, how, w0, c0);
  // each reel runs on by whole turns and comes to rest on the result's picture
  const SL = spinSlices(), n = SL.length, idx = SL.findIndex((q) => q.id === res.slice.id);
  S.run = [0, 1, 2].map((r) => { const a0 = S.reels[r], k = stripPos(r, idx, n); let a1 = Math.ceil(a0) + (2 + r) * n; a1 += (((k - a1) % n) + n) % n; return { a0, a1, t0: G.t + 0.16 + r * 0.04, dur: REEL_T[r], done: false, want: false, stop: null }; });
  S.lit = false; S.leverT = G.t;
  audio.play('slot_lever'); buzz('tap');
  if (save.calm) { S.run.forEach((r, i) => { S.reels[i] = r.a1; }); S.run = null; S.st = S.miss ? 'stolen' : 'stopped'; S.tStop = G.t; S.lit = !S.miss; if (S.miss) { S.missT = G.t; S.vSide = -1; audio.play('slot_miss'); } } else { S.st = 'spinning'; audio.play('slot_spin', { intensity: 1, vol: 0.8 }); }
}
// a winning pull: what the machine shows (the prize is already in the wallet; the counters hold the purse before it)
function spinPrize(S, res, how, w0, c0) {
  const snap = (w) => JSON.stringify({ ...E.sanitizeWallet(w), coins: 0 });
  const P = res.prize, gained = save.wallet.coins - (c0 - res.paid), conv = P.kind !== 'coins' && gained > 0 && snap(save.wallet) === w0; // a full bag paid coins instead
  ledWhy = 'spin'; BR.why(save, 'spin', res.slice.id, how); persist();
  purse.hold(c0 - res.paid); // the prize's coins land on the purse with the prize, not before
  const chick = P.kind === 'chick' ? STRIKES.find((k) => k.id === P.item) : null, coins = P.kind === 'coins' || conv, w = save.wallet;
  S.big = P.rare || P.kind === 'coupon' || res.slice.id === 'c3' ? 1 : 0.4; // how loud the machine cheers
  const art = coins ? 'coins' : P.kind === 'booster' ? 'boost:' + P.item : P.kind === 'coupon' ? 'ticket' : P.kind === 'charge' ? 'charge' : P.kind === 'skip' ? 'skip' : P.kind === 'hen' ? 'hen:' + P.item : 'chick:' + P.item;
  S.got = {
    name: coins ? `${gained} coins` : P.kind === 'booster' ? (P.n > 1 ? `${P.n} x ${P.name}` : P.name) : P.kind === 'hen' ? `${P.name} outfit` : chick ? chick.name : P.name,
    art, coins: gained > 0 ? gained : 0, from: c0 - res.paid,
    // 0.8.16 (mykee: "if the user gets any power up from the reward machine, they should know what exactly it does")
    what: coins ? '' : P.kind === 'booster' ? E.BOOSTERS[P.item].line : chick ? chick.up : P.kind === 'charge' ? E.CHARGE_ITEM.line : P.kind === 'skip' ? E.ITEMS.skip.line : P.kind === 'coupon' ? 'Half off one thing in the shop' : '',
    // where it lives: coins on the purse; boosters, charges and tickets in the bag (with how many there are now); looks in the shop
    where: coins ? null : P.kind === 'booster' ? { dest: 'bag', n: E.ownedCount(w, P.item) } : P.kind === 'charge' ? { dest: 'bag', n: w.charges } : P.kind === 'skip' ? { dest: 'bag', n: (w.tickets || {}).skip || 0 } : P.kind === 'coupon' ? { dest: 'bag' } : { dest: 'shop' },
  };
}
// the prize out of the tray: it rises and grows (SPIN_POP), shows its name and what it does (spinHold), then flies
const SPIN_POP = 0.4;
const spinHold = (S) => (S.got && S.got.where ? (S.got.what ? 1.5 : 1.1) : 0.55);
function drawSpin() {
  const u = ui.u, A = ui.A, S = G.spin, calm = save.calm;
  if (!S) { setScreen('levels'); return; }
  ui.calm = calm;
  spinBack();
  menuFx();
  if (S.flyGo && S.got && S.popAt) { // the prize sets off: the coins from the pile, the thing from where it stands, at the size it has there
    const R = S.got, Q = S.popAt; S.flyGo = false;
    land.start({ from: R.from, to: save.wallet.coins, src: { x: Q.x, y: Q.y }, items: R.where ? [{ art: R.art, src: { x: Q.x, y: Q.y }, size: Q.size, draw: (c, x, y, s2, t) => spinArt(c, R.art, x, y, s2, t), ...R.where }] : [] });
  }
  const wide = A.w > A.h * 1.2, P = ui.pageBox(wide ? Infinity : 440 * u), s = P.s, hold = S.st !== 'idle' && S.shown, W = hold ? S.shown.W : SP.ways(save, today()), M = hold ? S.shown.M : SP.meter(save), SL = spinReels(S.cast);
  const coinW = Math.max(84 * s, ui.measure(String(purse.shown()).replace(/\d/g, '0'), 17 * s) + 56 * s), long = P.w - 2 * (coinW + 24 * s) >= ui.measure('Lucky Spin', 25 * s) + 48 * s; // a narrow phone: the ribbon says Spin whole, not Lucky Sp...
  // 0.8.17: while a prize lands (ui/landing.js) the landing draws the purse chip in its own place, and the bag chip it
  // fills stands where the title was
  const LS = land.active() ? land.state : null, bagOn = !!(LS && LS.items > 0);
  ui.pageHeader(P, { back: 'spin:back', title: bagOn ? null : long ? 'Lucky Spin' : 'Spin', color: '#e8a020', tag: 'spin:title', right: { w: coinW, draw: (bx, by, bw, bh) => { S.purseR = { x: bx, y: by + (bh - 44 * s) / 2, w: bw, h: 44 * s, size: 17 * s }; if (!LS) purseBtn(bx, by + (bh - 44 * s) / 2, bw, 44 * s, 17 * s); } } });
  // ---- layout (mykee, 13:29: "dont add the pics or images on top of the slot machine and so does the text ... u are
  // pushing ui buttons to the very bottom"): nothing stands on the machine. Portrait: the machine, the floor in front of
  // it where the hen walks, then the controls right under her, and what is left over goes between them. Landscape: the
  // hen's patch of floor, the machine, the controls beside them. 0.8.17: no odds button under the controls (a small
  // round "i" on the cabinet's corner opens the odds page): that height went to the hen and the gaps.
  const top = P.bottom + 6 * u, bot = A.y1 - 10 * u, bh = (wide ? 66 : 72) * u, ctlH = 36 * u + bh;
  let mx, my, mw, mh, hh, cX, cY, cW, floorY, henX, beside = false;
  if (wide) {
    cW = Math.min(340 * u, A.w * 0.42);
    const lw = A.w - cW - 3 * P.pad, areaH = bot - top;
    // a phone on its side: the hen beside the machine. A tablet on its side has the height for the portrait stack (the
    // hen on the floor under a taller machine), and that makes the machine a good deal bigger: take whichever is bigger
    const mwA = Math.min(areaH / 0.83, lw / 1.56, 420 * u), mwB = Math.min(areaH / 1.2, lw / 1.1, 460 * u);
    if (mwB > mwA) {
      mw = mwB; mh = mw * clamp((areaH - mw * 0.34 - 12 * u) / (mw * 1.05), 0.78, 1.12); hh = clamp(areaH - mh * 1.05 - 12 * u, mw * 0.3, mw * 0.4);
      const gap = Math.max(0, (areaH - mh * 1.05 - hh) / 3);
      mx = A.x + P.pad + (lw - mw * 1.091) / 2; my = top + gap; floorY = my + mh * 1.05 + gap + hh; henX = (hx) => mx + mw * hx;
    } else {
      beside = true; mw = mwA; mh = mw * 0.78; hh = mw * 0.32;
      const gx = A.x + P.pad + (lw - mw * 1.54) / 2;
      mx = gx + mw * 0.45; my = top + (areaH - mh * 1.04) / 2; floorY = my + mh * 1.02;
      henX = (hx) => gx + mw * 0.19 + (hx - 0.5) * mw * 0.1;
    }
    cX = A.x1 - P.pad - cW; cY = top + Math.max(0, (areaH - ctlH) / 2);
  } else {
    // the full screen (mykee, 13:34: "use full screen and clear ui layouts"): the machine as wide as the page allows,
    // and what height is left over is shared out as four even gaps, never left as one empty band
    const areaH = bot - top - ctlH;
    mw = Math.min((areaH - 24 * u) / 1.5, (A.w / 2 - 6 * u) / 0.571, 440 * u); mh = mw * 1.12; hh = clamp(areaH - mh * 1.05 - 24 * u - 4 * 14 * u, mw * 0.32, mw * 0.5);
    const gap = Math.max(4 * u, (areaH - mh * 1.05 - hh) / 4);
    // the cabinet a touch left of the middle (its lever stands out on the right); the buttons as wide as the page column
    mx = A.cx - mw * 0.52; cW = P.w; cX = P.x; my = top + gap; floorY = my + mh * 1.05 + gap + hh; cY = floorY + gap;
    henX = (hx) => mx + mw * hx;
  }
  // ---- the reels: each runs up to speed, runs on, and settles onto its picture with a small bounce (or a tap stops it)
  const n = SL.length, speed = [0, 0, 0];
  if (S.st === 'spinning' && S.run) {
    const dtF = Math.max(1 / 240, G.t - (S.lastT || G.t));
    S.run.forEach((r, i) => {
      if (r.want && !r.stop) { if (reelSettling(r, G.t)) r.want = false; else if (reelAt(r, G.t + 0.01) - reelAt(r, G.t) >= 0.07) stopReel(S, i); } // a tap while it wound up: now
      const prev = S.reels[i], pos = reelAt(r, G.t);
      S.reels[i] = pos; speed[i] = (pos - prev) / dtF;
      if (Math.floor(pos) !== Math.floor(prev) && !r.done && G.t - S.tickT > 0.05) { S.tickT = G.t; audio.play('slot_tick', { vol: 0.55, pitch: 0.92 + 0.1 * i }); if (G.t - S.buzzT > 0.16 && speed[i] < 9) { S.buzzT = G.t; buzz('tick'); } }
      if (G.t >= reelLock(r) && !r.done) { r.done = true; S.joltT = G.t; S.stops++; S.henN++; audio.play('slot_stop', { pitch: (S.miss ? [0.84, 0.75, 0.667] : [1, 1.125, 1.26])[i] }); buzz('pick'); } // it locks as it overshoots: the clunk (a step up for each prize, a step down for each villain), and the cabinet takes the knock
    });
    if (S.run.every((r) => G.t >= reelEnd(r))) {
      S.run.forEach((r, i) => { S.reels[i] = r.a1; }); S.run = null; S.tStop = G.t; S.henN++;
      nudgeNote(S.tapped);
      if (S.miss) { S.st = 'stolen'; S.missT = G.t; S.vSide = -1; audio.play('slot_miss'); buzz('fail'); }
      else { S.st = 'stopped'; S.lit = true; audio.play('slot_win', { intensity: S.big }); audio.play('cluck', { vol: 0.7 }); buzz('treasure'); }
    }
  }
  S.lastT = G.t;
  const refill = () => { if (PREVIEW && !SP.banked(save) && !SP.ways(save, today()).retry) SP.state(save).bank = 2; };
  const R = S.got;
  if (S.st === 'stopped' && G.t - S.tStop > (calm ? 0.15 : 0.35)) { S.st = 'prize'; S.popT = G.t; audio.play(R && R.where ? 'unlock' : 'hud_pop', { vol: 0.8, intensity: S.big }); if (!calm) audio.play('confetti', { vol: 0.35 + 0.3 * S.big }); }
  else if (S.st === 'prize') {
    if (!S.flyT && G.t - S.popT >= SPIN_POP + spinHold(S)) { S.flyT = G.t; S.flyGo = true; } // (the landing starts at the top of the next frame, where the prize stands)
    else if (S.flyT && !land.busy() && G.t - S.flyT > 0.3) { S.st = 'idle'; S.doneT = G.t; S.landOff = G.t + (R && R.coins ? 1.6 : 0.9); refill(); }
  } else if (S.st === 'stolen') { // the villains laugh on the reels with their own voice; the machine sags and smokes
    if (!S.voiceT || S.voiceT < S.tStop) { if (G.t - S.tStop > 0.45) { S.voiceT = G.t; audio.play(SPIN_VILLAINS[S.cast.who] || 'weasel_snicker', { vol: 0.9 }); audio.play('cluck', { vol: 0.5, pitch: 1.25 }); } }
    if (G.t - S.tStop > (calm ? 1.6 : 2.7)) { S.st = 'idle'; S.doneT = G.t; refill(); }
  }
  if (S.st === 'idle' && S.landOff && G.t > S.landOff && !land.busy()) { land.clear(); S.landOff = 0; } // the "+N" has faded: the header's own chips again
  // ---- the scene
  const mcx = mx + mw / 2, mcy = my + mh * 0.5;
  ctx.save(); ctx.globalAlpha = 0.9; sunburst(mcx, mcy, mw * 1.25, 'rgba(255,214,120,0.09)', 14); ctx.restore();
  { const g = ctx.createRadialGradient(mcx, mcy, mw * 0.2, mcx, mcy, mw); g.addColorStop(0, 'rgba(255,220,130,0.26)'); g.addColorStop(1, 'rgba(255,220,130,0)'); ctx.fillStyle = g; ctx.fillRect(mcx - mw, mcy - mw, mw * 2, mw * 2); }
  const idle = S.st === 'idle', litK = S.lit ? (idle ? clamp(1 - (G.t - (S.doneT || 0)) / 2.5, 0, 1) : 1) : 0;
  const lt = G.t - S.leverT, lk = calm ? 0 : lt < 0.13 ? lt / 0.13 : lt < 0.42 ? 1 : clamp(1 - (lt - 0.42) / 0.5, 0, 1) * (1 + 0.12 * Math.sin((lt - 0.42) * 22) * clamp(1 - (lt - 0.42) / 0.5, 0, 1));
  { const jt = G.t - Math.max(S.joltT || -9, S.leverT + 0.13); if (!calm && jt >= 0 && jt < 0.22) my += Math.sin(jt * 60) * 2.2 * u * (1 - jt / 0.22); } // a reel locking, the lever hitting bottom: the cabinet shudders
  const stolen = S.st === 'stolen', sT = G.t - S.tStop, badK = stolen ? clamp(sT / 0.2, 0, 1) : S.miss && idle ? clamp(1 - (G.t - (S.doneT || 0)) / 0.6, 0, 1) : 0;
  // the villains' row: the cabinet sags on its feet (down with a small bounce, up again as they go)
  const sag = calm ? badK : stolen ? clamp(sT / 0.28, 0, 1) ** 0.5 * (1 + 0.18 * Math.sin(clamp(sT / 0.5, 0, 1) * Math.PI)) : badK;
  ctx.save();
  if (sag > 0) { ctx.translate(mcx, my + mh); ctx.scale(1 + 0.03 * sag, 1 - 0.055 * sag); ctx.translate(-mcx, -(my + mh)); }
  const GM = drawSlot(ctx, mx, my, mw, mh, SL, S.reels, { dpr: Math.min(DPR, 2), t: G.t, calm, lit: litK, bad: badK, winT: S.st === 'stopped' || S.st === 'prize' ? G.t - S.tStop : 9, speed, lever: clamp(lk, 0, 1.1), ready: (W.free || W.retry === 'free') && idle });
  ctx.restore();
  // and smoke puffs out from its shoulders (Calm: no smoke)
  if (stolen && !calm) for (let i = 0; i < 12; i++) {
    const q = (sT - 0.1 - i * 0.17) / 1.3; if (q <= 0 || q >= 1) continue;
    const side = i % 2 ? 1 : -1, e = 1 - (1 - q) ** 2, pr = mw * (0.04 + 0.065 * e), px = mcx + side * mw * (0.42 + 0.14 * e), py = Math.max(P.bottom + pr, GM.bodyY + mw * 0.03 - mw * 0.2 * e), sd = side; // (from its shoulders, never up into the header)
    ctx.save(); ctx.globalAlpha = 0.8 * (1 - q) ** 1.2;
    ctx.fillStyle = '#9a8ea8'; ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.arc(px - sd * pr * 0.72, py + pr * 0.32, pr * 0.72, 0, TAU); ctx.arc(px + sd * pr * 0.6, py + pr * 0.42, pr * 0.62, 0, TAU); ctx.fill();
    ctx.fillStyle = '#d6cee0'; ctx.beginPath(); ctx.arc(px - pr * 0.22, py - pr * 0.28, pr * 0.55, 0, TAU); ctx.arc(px - sd * pr * 0.8, py + pr * 0.1, pr * 0.35, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // the hen on the floor in front of the machine: she walks along with the reels, frets while they run, hops for each
  // prize that locks, dances for the row; the villains make her gasp, then cry
  {
    const spinning = S.st === 'spinning';
    const tx = spinning ? [0.2, 0.5, 0.8][Math.min(2, S.stops)] : 0.5; // she trots to stand under the reel that locks next
    const dtH = calm ? 0 : clamp(G.t - (S.henT || G.t), 0, 0.05), want = clamp((tx - S.hx) * 6, -0.34, 0.34); // machine-widths a second: a trot, never a slide
    S.hv += (want - S.hv) * (1 - Math.exp(-dtH * 10)); S.hx = calm ? tx : clamp(S.hx + S.hv * dtH, 0.16, 0.84); S.henT = G.t;
    const mood = spinning ? (S.miss && S.stops > 0 ? 'gasp' : S.stops > 0 ? 'happy' : 'worried') : S.st === 'stopped' || S.st === 'prize' ? (S.big >= 1 ? 'dance' : 'happy') : stolen ? (sT < 0.45 ? 'gasp' : 'cry') : G.t - S.missT < 5 ? 'sad' : G.t - (S.doneT || -9) < 1.2 && !S.miss ? 'happy' : 'idle';
    const drift = calm ? 0 : (S.hv * mw * (beside ? 0.1 : 1)) / (hh / 100), hxp = henX(S.hx);
    ui.record({ x: hxp - hh * 0.4, y: floorY - hh * 0.9, w: hh * 0.8, h: hh * 0.9 }, 'spin:hen');
    drawHenAnim(ctx, mood, hxp, floorY - hh * 0.5, hh, G.t, { key: 'spin', face: 1, n: S.henN, drift, calm, danger: spinning && !S.stops ? 0.5 : 0 });
  }
  ui.record({ x: mx, y: GM.bodyY, w: mw, h: GM.bodyH }, 'spin:machine');
  if (idle) ui.buttons.push({ id: 'spin:lever', x: GM.lever.x - GM.lever.h * 0.35, y: GM.lever.y - GM.lever.h * 1.3, w: GM.lever.h * 0.95, h: GM.lever.h * 2.3 }); // a tap on the lever is the SPIN button's tap
  // ---- the prize out of the tray (0.8.17, mykee: "we don't have to show the result card"): it rises out of the tray
  // under the reels and grows, its name on a ribbon under it and what it does under that, then it flies to where it
  // lives (ui/landing.js: coins pour from it in arcs onto the purse, a thing flies into the bag or to the shop)
  const ty = GM.py + GM.ph + GM.bodyH * 0.1175, popY = GM.wy + GM.wh * 0.38, S0 = Math.min(GM.wh * 1.02, mw * 0.5);
  if (R && S.popT && (S.st === 'prize' || (idle && S.flyT && G.t - S.flyT < 3))) {
    const pt = G.t - S.popT, fl = S.flyT ? G.t - S.flyT : -1, items = !!R.where;
    const inK = calm ? 1 : clamp(pt / SPIN_POP, 0, 1), rise = calm ? 1 : 1 - (1 - inK) ** 3, sc = calm ? 1 : 0.25 + 0.75 * backK(inK);
    const LS2 = land.state, coinsOut = !items && fl >= 0 ? (LS2 ? clamp((LS2.rel - (LS2.end - 0.35)) / 0.3, 0, 1) : 1) : 0; // the pile sinks back once the last coins are out
    const gone = items ? (fl >= 0 && !S.flyGo ? 1 : 0) : coinsOut, py = ty + (popY - ty) * rise * (1 - (calm ? 0 : coinsOut)), k2 = sc * (1 - 0.75 * gone);
    const party = clamp(pt / 0.2, 0, 1) * (1 - clamp(fl >= 0 ? fl / 0.3 : 0, 0, 1));
    if (party > 0) { // the light behind it
      ctx.save(); ctx.globalAlpha = party;
      sunburst(mcx, py, S0 * 1.2, 'rgba(255,240,170,0.42)', 12);
      const g = ctx.createRadialGradient(mcx, py, 0, mcx, py, S0 * 0.72); g.addColorStop(0, 'rgba(255,248,200,0.95)'); g.addColorStop(0.55, 'rgba(255,228,140,0.7)'); g.addColorStop(1, 'rgba(255,220,120,0)'); ctx.fillStyle = g; ctx.fillRect(mcx - S0, py - S0, S0 * 2, S0 * 2);
      ctx.restore();
    }
    if (gone < 1 && k2 > 0.01) { ctx.save(); ctx.translate(mcx, py + (calm ? 0 : Math.sin(G.t * 5) * S0 * 0.015 * inK)); ctx.scale(k2, k2); spinArt(ctx, R.art, 0, 0, S0 * (items ? 0.92 : 1.05), G.t); ctx.restore(); }
    S.popAt = { x: mcx, y: py, size: S0 * 0.92 }; // (the landing sets off from here, at the top of the next frame)
    const nk = calm ? 1 : clamp((pt - SPIN_POP * 0.6) / 0.25, 0, 1), na = 1 - clamp(fl >= 0 ? fl / 0.2 : 0, 0, 1);
    if (nk > 0 && na > 0) { // its name on a ribbon, what it does under it (one or two lines)
      const ns = Math.min(24 * u, S0 * 0.15), rw = Math.min(A.w - 24 * u, Math.max(mw * 0.62, ui.measure(R.name, ns) + 70 * u)), rh = ns * 1.7, ry = popY + S0 * 0.46;
      const ws = 16 * u, WL = R.what ? wrapText(R.what, ws, Math.min(A.w - 32 * u, mw * 0.98)).slice(0, 2) : [], wy = ry + rh + 6 * u;
      ctx.save(); ctx.globalAlpha = na; ctx.translate(mcx, ry + rh / 2); const kk = calm ? 1 : backK(nk); ctx.scale(kk, kk); ctx.translate(-mcx, -(ry + rh / 2));
      ui.ribbon(R.name, mcx, ry, rw, rh, { color: '#d89a1c', size: ns, noRecord: true });
      ctx.restore();
      ui.rects.push({ x: mcx - rw / 2, y: ry, w: rw, h: rh, tag: 'spin:prize', group: 'spin:prize', container: 'spin:machine' });
      if (WL.length) {
        const wk = calm ? 1 : clamp((pt - SPIN_POP - 0.1) / 0.25, 0, 1);
        if (wk > 0) {
          const bw = Math.max(...WL.map((l) => ui.measure(l, ws))) + 28 * u, bhh = WL.length * ws * 1.3 + 12 * u;
          ctx.save(); ctx.globalAlpha = na * wk;
          ui.roundRect(mcx - bw / 2, wy, bw, bhh, 12 * u); ctx.fillStyle = 'rgba(40,12,24,0.82)'; ctx.fill(); ctx.lineWidth = 2 * u; ctx.strokeStyle = 'rgba(255,214,110,0.8)'; ctx.stroke();
          WL.forEach((l, q) => ui.text(l, mcx, wy + 6 * u + ws * 0.65 + q * ws * 1.3, { size: ws, align: 'center', color: '#fff6dc', noRecord: true }));
          ctx.restore();
          ui.rects.push({ x: mcx - bw / 2, y: wy, w: bw, h: bhh, tag: 'spin:what', group: 'spin:what', container: 'spin:machine' });
        }
      }
    }
  }
  // ---- the odds: a small round "i" on the cabinet's top left corner, beside the sign (the stores ask that the odds are
  // one tap away; mykee: "do we have to show the probability to the user? No")
  const ir = 17 * u, ix = Math.min(mx + mw * 0.1 - ir - 4 * u, mx + ir), iy = GM.bodyY - ir - 5 * u;
  ui.button('spin:odds', 'i', ix - ir, iy - ir, ir * 2, ir * 2, { kind: 'tertiary', round: ir, size: 21 * u, ...(idle ? {} : { disabled: true, keepFace: true, dim: 0.45 }) });
  // ---- the controls: how near the next free spin is, the ways to spin now
  ctx.save(); if (!idle) ctx.globalAlpha = 0.45;
  {
    const x = cX, y = cY, w = cW, my = y + 15 * u, fs = 15.5 * u, off = idle ? {} : { disabled: true, keepFace: true, dim: 0.45 }; // while the reels run the buttons rest
    const short = G.t - (S.shortT || -9) < 2.2; // a coin spin he cannot pay: the line says so for a moment (and the button shakes its head)
    const lost = S.miss && idle && (W.sure || G.t - S.missT < 6); // the villains took the last pull (0.8.16: it is lost; after two in a row the next one wins)
    const txt = short ? 'Not enough coins for this spin' : lost ? (W.sure ? `${villainName(S.cast.who)} got it! Next pull wins` : `${villainName(S.cast.who)} got it!`) : M.bank >= SP.SPIN.bankMax ? 'Your free spins are waiting' : `${M.left} more win${M.left > 1 ? 's' : ''} to a free spin`;
    const pw = M.of * 22 * u, tw = Math.min(ui.measure(txt, fs), w - pw - 10 * u), x0 = x + w / 2 - (pw + 8 * u + tw) / 2;
    for (let i = 0; i < M.of; i++) {
      const px = x0 + 11 * u + i * 22 * u;
      ctx.beginPath(); ctx.arc(px, my, 8.5 * u, 0, TAU); ctx.fillStyle = i < M.have ? '#fff6c8' : 'rgba(20,8,30,0.45)'; ctx.fill(); ctx.lineWidth = 2 * u; ctx.strokeStyle = i < M.have ? '#3a9a2c' : 'rgba(255,232,176,0.55)'; ctx.stroke();
      if (i < M.have) pictoCheck(ctx, px, my, 15 * u);
    }
    ui.record({ x: x0, y: my - 10 * u, w: pw, h: 20 * u }, 'spin:pips', 'spin:meter');
    ui.text(txt, x0 + pw + 8 * u, my, { size: fs, color: short ? '#ffb0a0' : '#ffe8b0', stroke: 'rgba(20,8,30,0.7)', strokeW: 3 * u, maxW: tw, tag: 'spin:meter', group: 'spin:meter' });
    const by = y + 36 * u, opts = [W.ad && 'ad', W.coin != null && 'coin'].filter(Boolean);
    if (W.free) ui.button('spin:go', M.bank > 1 ? `SPIN  x${M.bank}` : 'SPIN', x, by, w, bh, { kind: 'primary', shimmer: idle, size: 29 * u, iconS: 1.15, icon: (c, X, Y, S2) => drawSlotIcon(c, X, Y, S2 * 0.46, calm ? 0 : G.t), ...off });
    else if (!opts.length) ui.button('spin:back', 'Win levels to spin again', x, by, w, bh, { kind: 'secondary', size: 19 * u, ...off });
    else opts.forEach((k, i) => {
      const bw = (w - 10 * u * (opts.length - 1)) / opts.length, bx = x + i * (bw + 10 * u), rich = W.coin != null && save.wallet.coins >= W.coin;
      const sh = k === 'coin' && !calm && G.t - (S.shortT || -9) < 0.4 ? Math.sin((G.t - S.shortT) * 40) * 4 * u : 0; // too few coins: the button shakes its head
      if (k === 'retry') ui.button('spin:retry', 'Try again', bx, by, bw, bh, W.retry === 'free' || ads.premium ? { kind: 'primary', shimmer: idle, size: 22 * u, icon: (c, X, Y, S2) => drawSlotIcon(c, X, Y, S2 * 0.46, 0), ...off } : { kind: 'ad', ad: true, shimmer: idle, size: 22 * u, ...off });
      else if (k === 'ad') ui.button('spin:ad', ads.premium ? 'Free spin' : 'Spin', bx, by, bw, bh, ads.premium ? { kind: 'secondary', size: 22 * u, icon: (c, X, Y, S2) => drawSlotIcon(c, X, Y, S2 * 0.46, 0), ...off } : { kind: 'ad', ad: true, size: 22 * u, ...off });
      else ui.button('spin:coin', `Spin ${W.coin}`, bx + sh, by, bw, bh, { kind: rich ? 'gold' : 'off', dim: 1, icon: (c, X, Y, S2) => drawCoin(c, X, Y, S2 * 0.5, G.t), size: 22 * u, ...off });
    });
  }
  ctx.restore();
  // ---- the nudge: a small hand taps the reel that stops next (no words; Calm: it only points)
  if (S.st === 'spinning' && S.nudge && !S.tapped) {
    const i = nextReel(S), el = G.t - S.leverT - 0.3;
    if (i >= 0 && el > 0) {
      const per = 0.8, q = calm ? 0.2 : (el % per) / per, press = !calm && q > 0.35 && q < 0.6, hs = Math.min(GM.cw * 0.95, 62 * u);
      const a = Math.min(1, el / 0.25) * clamp((S.run[i].t0 + S.run[i].dur * 0.62 - G.t) / 0.2, 0, 1);
      teachHand(ctx, GM.wx[i] + GM.cw * 0.55, GM.wy + GM.wh * (press ? 0.6 : 0.68), hs, press, a);
    }
  }
  if (!idle) { ui.buttons.length = 0; ui.buttons.push({ id: 'spin:skip', x: -1e4, y: -1e4, w: 3e4, h: 3e4 }); } // a tap anywhere: the next reel stops (and later, the prize goes on its way)
  if (land.active()) land.draw(ctx, u, A, { ...LAND_KIT, ui, purse: S.purseR }); // the purse (and the bag) in the header, and what flies into them
  if (S.sheet) drawSpinOdds(spinSlices().map((sl) => (sl.kind === 'villain' ? { ...sl, who: S.cast.who } : sl)));
}
// the odds: every prize on the reels, what it is, how often it comes
function spinBack() { if (!themeBack(ctx, ui.skin, W_, H_, H_ * 0.8, true)) { const bg = ctx.createLinearGradient(0, 0, 0, H_); bg.addColorStop(0, '#221a52'); bg.addColorStop(0.6, '#3d2560'); bg.addColorStop(1, '#5a2a5e'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W_, H_); } }
// A full page with the page header every other page has (mykee, 13:34: "use full screen and clear ui layouts rather
// than half congested things"): the rows share the whole height, two short lines under them, one OK as wide as the page
function drawSpinOdds(SL) {
  // two columns on a wide screen, and on a squat one (a square fold-out, 600x600) where twelve rows in one column would crush
  const u = ui.u, A = ui.A, wide = A.w > A.h * 1.2, cols = wide || A.h < 560 * u ? 2 : 1, rowsN = Math.ceil(SL.length / cols);
  ui.buttons.length = 0; ui.rects.length = 0;
  spinBack();
  const P = ui.pageBox(cols === 2 ? Infinity : 440 * u), s = P.s, long = P.w - 2 * (P.h + 24 * s) >= ui.measure('Prizes and odds', 25 * s) + 48 * s;
  ui.pageHeader(P, { back: 'spin:odds:x', title: long ? 'Prizes and odds' : 'Prizes', color: '#e8a020', tag: 'odds:title' });
  const foot = wide ? ['Villains never come three times in a row. Same odds for everyone, and they never change.'] : ['Villains never come three times in a row.', 'Same odds for everyone. They never change.'];
  const top = P.bottom + 10 * u, bot = A.y1 - 10 * u, btnH = (wide ? 48 : 56) * u, fs = 14 * u, footH = foot.length * 20 * u + 8 * u, g = 10 * u;
  const rowH = Math.min(58 * u, (bot - top - btnH - footH - 2 * g - 16 * u) / rowsN), panelH = rowsN * rowH + 16 * u, used = panelH + g + footH + g + btnH;
  const x = P.x, w = P.w, y = top + Math.max(0, (bot - top - used) * 0.4);
  ui.frame(x, y, w, panelH, { s: u, r: 22 * u });
  const cw = (w - 24 * u) / cols, ks = clamp(rowH / (46 * u), 0.7, 1.12);
  SL.forEach((sl, i) => {
    const c = Math.floor(i / rowsN), r = i % rowsN, rx = x + 12 * u + c * cw, my = y + 8 * u + r * rowH + rowH / 2, C = SLICE_COL[sl.id], note = sliceNote(sl);
    const ch = rowH - 8 * u, chw = Math.max(46 * u, ch * 1.1);
    ui.roundRect(rx + 4 * u, my - ch / 2, chw, ch, 9 * u); ctx.fillStyle = C[1]; ctx.fill(); ctx.lineWidth = 1.5 * u; ctx.strokeStyle = 'rgba(60,28,6,0.55)'; ctx.stroke();
    drawSliceIcon(ctx, sl, rx + 4 * u + chw / 2, my, Math.min(ch * 0.92, chw * 0.8), G.t);
    const pct = `${+sl.pct.toFixed(2)}%`, pw = ui.measure('12.75%', 17 * u * ks) + 6 * u, tx = rx + chw + 14 * u, tw = cw - chw - 26 * u - pw;
    const fit = (str, size) => size * clamp(tw / ui.measure(str, size), 0.76, 1); // a narrow column: smaller print before a cut-off word
    ui.text(sliceName(sl), tx, note ? my - 8 * u * ks : my, { size: fit(sliceName(sl), 16 * u * ks), color: ui.C.ink, maxW: tw, tag: 'odds:n' + i });
    if (note) ui.text(note, tx, my + 10 * u * ks, { size: fit(note, 11.5 * u * ks), color: ui.C.ink2, maxW: tw, tag: 'odds:s' + i });
    ui.text(pct, rx + cw - 8 * u, my, { size: 17 * u * ks, align: 'right', color: ui.C.ink, tag: 'odds:p' + i });
    if (r > 0) { ctx.fillStyle = 'rgba(90,50,14,0.12)'; ctx.fillRect(rx + 4 * u, my - rowH / 2 - 0.5 * u, cw - 8 * u, 1 * u); } // a hairline between rows
  });
  const fy = y + panelH + g;
  foot.forEach((l, i) => ui.text(l, A.cx, fy + 14 * u + i * 20 * u, { size: fs, align: 'center', color: '#ffe8b0', stroke: 'rgba(20,8,30,0.7)', strokeW: 3 * u, maxW: w - 8 * u, tag: 'odds:f' + i }));
  const okW = Math.min(w, 380 * u);
  ui.button('spin:odds:ok', 'OK', A.cx - okW / 2, fy + footH + g, okW, btnH, { kind: 'primary', size: 22 * u });
}
// ---- the Conductor on a page (0.8.15, engine/conduct.js): what waits for the player and what he is closest to; ONE of
// them leads a page. Asked once per visit of a page (and again when what it is made from changes), never per frame.
function nearThings() {
  const out = [];
  if (SP.open(save)) { const M = SP.meter(save); if (M.bank > 0) out.push({ id: 'spin', sys: 'spin', kind: 'gift', near: 1, n: M.bank }); if (M.bank < SP.SPIN.bankMax) out.push({ id: 'meter', sys: 'spin', kind: 'progress', near: M.have / M.of, left: M.left, have: M.have, of: M.of }); }
  const ts = bestTotal(), ch = E.chestFor(ts, save.wallet.chests);
  if (ch) out.push(ch.ready ? { id: 'chest', sys: 'chest', kind: 'gift', near: 1 } : { id: 'stars', sys: 'chest', kind: 'progress', near: clamp(1 - (ch.at - ts) / E.STARS_PER_CHEST, 0, 1), left: ch.at - ts });
  return out;
}
function pageLead(moment, cands = nearThings()) {
  const key = `${G.scrSeq}|${moment}|${cands.map((c) => c.id + c.kind[0] + Math.round((c.near || 0) * 100)).join(',')}`;
  if (!G.leadC || G.leadC.key !== key) G.leadC = { key, L: ENG.lead(save, moment, cands, { levelId: G.level && G.level.id }) };
  return G.leadC.L;
}
const leadWords = (c) => (c.id === 'spin' ? (c.n > 1 ? `${c.n} free spins are waiting` : 'A free spin is waiting') : c.id === 'chest' ? 'A star chest is ready on the map' : c.id === 'meter' ? `${c.left} more win${c.left > 1 ? 's' : ''} to a free spin` : `${c.left} more star${c.left > 1 ? 's' : ''} to the next chest`);
// one line for it: its small picture (the spin meter's ticks, a star, the chest, the machine) and the words
function leadLine(c, cx, y, s, o = {}) {
  const txt = leadWords(c), fs = (o.size || 16) * s, iw = c.id === 'meter' ? c.of * 20 * s : 26 * s, tw = Math.min(ui.measure(txt, fs), (o.maxW || 1e4) - iw - 8 * s), x0 = cx - (iw + 8 * s + tw) / 2, light = !o.ink;
  if (c.id === 'meter') for (let i = 0; i < c.of; i++) {
    const px = x0 + 10 * s + i * 20 * s;
    ctx.beginPath(); ctx.arc(px, y, 8 * s, 0, TAU); ctx.fillStyle = i < c.have ? '#fff6c8' : light ? 'rgba(20,8,30,0.45)' : 'rgba(122,80,40,0.16)'; ctx.fill(); ctx.lineWidth = 1.8 * s; ctx.strokeStyle = i < c.have ? '#3a9a2c' : light ? 'rgba(255,232,176,0.55)' : 'rgba(122,80,40,0.45)'; ctx.stroke();
    if (i < c.have) pictoCheck(ctx, px, y, 14 * s);
  } else if (c.id === 'stars') drawStar(ctx, x0 + 13 * s, y, 11 * s, true);
  else if (c.id === 'chest') drawChest(ctx, x0 + 13 * s, y, 24 * s, G.t, 'ready');
  else drawSlotIcon(ctx, x0 + 13 * s, y, 11 * s, save.calm ? 0 : G.t);
  ui.record({ x: x0, y: y - 11 * s, w: iw, h: 22 * s }, (o.tag || 'lead') + ':pic', o.tag || 'lead');
  ui.text(txt, x0 + iw + 8 * s, y, { size: fs, color: o.ink || '#ffe8b0', stroke: light ? 'rgba(20,8,30,0.75)' : undefined, strokeW: light ? 3 * s : undefined, maxW: tw, tag: o.tag || 'lead', group: o.tag || 'lead' });
}
const leadBlock = (c, s, o = {}) => (c.id === 'spin' ? spinRowBlock(s, o) : { h: 28 * s, gap: o.gap ?? 10 * s, draw: (x, y, w) => leadLine(c, x + w / 2, y + 14 * s, s, { ...o, maxW: w }) });
// Leaving a level that is being played, with something close: one card, once a session, no clock on it. "Keep playing"
// goes back to the level, "Leave" leaves. (mykee: "anticipatory unlock ... when they quit, remind them")
function leaveAsk(to) {
  if (G.leftAsked || G.screen !== 'pause' || G.li < 0 || !G.sim || G.sim.state !== 'play' || earlyDays()) return false;
  const L = pageLead('leaving'), c = L.lead;
  if (!c || !(c.kind === 'gift' || (c.near || 0) >= 0.5)) return false;
  G.leftAsked = true; G.leaveAsk = { to, c, t0: G.t };
  return true;
}
function drawLeaveAsk() {
  const R = G.leaveAsk;
  dim(0.55);
  stackCard('So close', (s) => [
    { h: 54 * s, gap: 10 * s, draw: (x, y, w) => { ui.well(x, y, w, 54 * s, { s, a: '#ffe9b0', b: '#fff6dc' }); leadLine(R.c, x + w / 2, y + 27 * s, s, { size: 17, ink: ui.C.ink, maxW: w - 20 * s, tag: 'leave:t' }); ui.record({ x, y, w, h: 54 * s }, 'panel:leave'); } },
    { h: 60 * s, gap: 14 * s, draw: (x, y, w) => ui.button('leave:stay', 'Keep playing', x, y, w, 60 * s, { kind: 'primary', shimmer: true, icon: ICON.play, size: 23 * s }) },
    { h: 52 * s, gap: 10 * s, draw: (x, y, w) => ui.button('leave:go', 'Leave', x, y, w, 52 * s, { kind: 'tertiary', size: 20 * s }) },
  ], { ribbon: '#e8a020' });
}
// the machine's entry on other pages: a row with its small picture, how many spins wait, and SPIN
function spinRowBlock(s, o = {}) {
  return { h: 70 * s, gap: o.gap ?? 10 * s, draw: (x, y, w) => {
    const n = SP.banked(save), bw = Math.min(124 * s, w * 0.34);
    ui.well(x, y, w, 70 * s, { s, a: '#ffe9b0', b: '#fff6dc' });
    drawSlotIcon(ctx, x + 36 * s, y + 36 * s, 22 * s, save.calm ? 0 : G.t);
    const tx = x + 68 * s, tw = x + w - bw - 16 * s - tx;
    const long = o.cheer ? 'A cheer-up spin for you' : n > 1 ? `${n} free spins waiting` : 'A free spin is waiting';
    const say = ui.measure(long, 16 * s) <= tw ? long : o.cheer ? 'Cheer-up spin' : n > 1 ? `${n} free spins` : 'Free spin waiting'; // a narrow column: the short wording, never cut off
    ui.text(say, tx, y + 35 * s, { size: 16 * s, color: ui.C.ink, maxW: tw, tag: 'spinrow:t' });
    ui.button('spin', 'SPIN', x + w - bw - 8 * s, y + 10 * s, bw, 50 * s, { kind: 'primary', shimmer: o.quiet ? false : true, size: 21 * s });
    ui.record({ x, y, w, h: 70 * s }, 'panel:spinrow');
  } };
}

function drawPractice() {
  const u = ui.u, A = ui.A, pad = ui.pageBox().pad, S = G.pscroll, vb = A.y1; // the list scrolls down to the bottom of the safe rect
  ui.calm = save.calm;
  const dt = Math.min(0.1, Math.max(0, G.t - (S.t || G.t))); S.t = G.t;
  if (!themeBack(ctx, ui.skin, W_, H_, H_ * 0.8, true)) {
    const bg = ctx.createLinearGradient(0, 0, 0, H_);
    bg.addColorStop(0, '#1c1440'); bg.addColorStop(1, '#3a2152');
    ctx.globalAlpha = 0.96; ctx.fillStyle = bg; ctx.fillRect(0, 0, W_, H_); ctx.globalAlpha = 1;
  }
  menuFx();
  const cols = A.w > A.h ? 5 : 3, gap = 12 * u, cw = Math.min((A.w - pad * 2 - gap * (cols - 1)) / cols, 136 * u), chh = cw;
  const gridW = cols * cw + (cols - 1) * gap, x0 = A.cx - gridW / 2;
  const P = ui.pageBox(gridW); // 0.8.14: the header stands on the grid's own column (ui.pageHeader)
  const vt = P.bottom + 8 * P.s, secH = 36 * u; // the list's top edge, a section header's height
  let total = 0;
  for (const g of LAB) total += secH + Math.ceil(g.items.length / cols) * (chh + gap) + 6 * u;
  S.max = Math.max(0, total + pad - (vb - vt));
  glideDt(S, dt);
  // the list, clipped under the header
  ctx.save(); ctx.beginPath(); ctx.rect(0, vt, W_, vb - vt); ctx.clip();
  let y = vt - S.y + 4 * u, gi = 0;
  for (const g of LAB) {
    const face0 = ui.faceOf(PRACTICE_FACES[gi % PRACTICE_FACES.length]);
    if (y + secH > vt && y < vb) ui.text(g.name, x0 + 2 * u, y + secH / 2 - 2 * u, { size: 17 * u, color: '#ffe8b0', stroke: 'rgba(20,8,30,0.7)', strokeW: 3 * u, tag: 'practice:h' + gi, maxW: gridW - 4 * u, noRecord: y < vt || y + secH > vb });
    y += secH;
    g.items.forEach(([k, label], j) => {
      const c = j % cols, r = Math.floor(j / cols), nr = Math.min(cols, g.items.length - r * cols); // a short last row is centred, like the shop's
      const x = x0 + (cols - nr) * (cw + gap) / 2 + c * (cw + gap), ty = y + r * (chh + gap);
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
  ui.pageHeader(P, { back: 'back', title: 'Practice', color: '#8a5ad8', tag: 'practice:title' });
  if (S.max > 0 && !save.calm) { // a thin scroll thumb
    const th = Math.max(30 * u, (vb - vt) * (vb - vt) / (total + pad)), ty2 = vt + clamp(S.y / S.max, 0, 1) * (vb - vt - th - 4 * u);
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
// 2026-11-20 pacing: ivs is a slow average of the callback gaps near iv (a precise refresh interval for snapping dt);
// err is the time snapped off dt and not yet given back
const VSYNC = { last: 0, buf: [], iv: 1000 / 60, ivs: 0, err: 0 };
// ================================================================ 0.8.17 extras: the combo album, the daily chest's
// "Opens in", and Settings' Privacy policy, Reset progress and version footer. The rules and the words live in
// src/album.js, src/clock.js (opensIn), src/reset.js and src/data/privacy.js; this block draws them and takes their taps
// (ids 'xs:*', one line at the top of press()).

// ---- the daily chest: when it opens next. The game's own day (src/clock.js) decides, so the countdown ends exactly when
// the chest can open, also after the phone's clock was set back. Plain information on a free gift: no urgency styling.
const chestInText = () => CK.opensText(CK.opensIn(save.clock, Date.now()));

// ---- the combo album: a page over the Extras screen (G.album; G.screen stays 'extras'). Opened from its row on the
// Extras page (and from home's Extras button through that page); a new find marks both, and opening lands on its tile.
const albumNow = () => AL.albumOf(save.seen);
const comboName = (id) => powerInfo(id).name;
function xsAlbumRow() { const D = albumNow(); return { n: D.n, total: D.total, fresh: D.fresh.length > 0 || D.prize, pitch: 'Two powers at once' }; }
const albumMarkOn = () => { const D = albumNow(); return D.fresh.length > 0 || D.prize; };
function openAlbum() {
  const D = albumNow(), want = D.fresh[0] || (D.prize ? '_prize' : null);
  G.album = { keep: G.escroll, fresh: D.fresh.slice(), t0: G.t, want, went: false, snd: {} };
  G.escroll = { y: 0, v: 0, max: 0, t: G.t };
  if (D.fresh.length) { save.seen = AL.albumSeen(save.seen, D.fresh); persist(); } // shown now: the marks go
  audio.play('ui_open');
}
// the Extras page's album row (wonder.js): reached from home's mark, the page scrolls to it and rings it
function albumLead(S, off, R, vh) {
  if (S.want === 'album') { S.want = null; focusTrip(S, focusY(off, R.h, vh, S.max, ui.u), save.calm); focusStart(S, 'album', G.t + 0.1, 4, false); }
  const look = S.hl && S.hl.key === 'album' ? focusLook(S.hl, G.t, save.calm) : null;
  if (look) focusDraw(ctx, ui, look, R, 18 * ui.u, ui.u);
}
function closeAlbum() { if (!G.album) return; G.escroll = G.album.keep || G.escroll; G.album = null; }
// two orbs side by side and the spark: the combo's shape, as a dark silhouette with a "?" (a combo not found yet)
function comboShadow(c, x, y, r, a = 1) {
  c.save(); c.globalAlpha *= a; c.lineWidth = Math.max(1.5, r * 0.07); c.strokeStyle = 'rgba(200,180,255,0.35)'; c.fillStyle = '#1d1433';
  for (const [dx, dy] of [[-0.42, 0.06], [0.42, -0.06]]) { c.beginPath(); c.arc(x + dx * r, y + dy * r, r * 0.6, 0, 7); c.fill(); c.stroke(); }
  c.beginPath(); for (let i = 0; i < 8; i++) { const q = (i * Math.PI) / 4 - Math.PI / 2, rr = i % 2 ? r * 0.13 : r * 0.36; c.lineTo(x + Math.cos(q) * rr, y + Math.sin(q) * rr); } c.closePath(); c.fill(); c.stroke();
  c.restore();
  ui.text('?', x, y + r * 0.04, { size: r * 0.95, align: 'center', color: '#cdb8ff', stroke: '#1d1433', strokeW: r * 0.16, noRecord: true });
}
// the album row's picture on the Extras page: a photo album with the first combo found on its cover
function albumIcon(c, x, y, S, t) {
  const w = S * 0.74, h = S * 0.8, x0 = x - w / 2, y0 = y - h / 2, lw = Math.max(1.5, S * 0.035);
  c.save(); c.lineJoin = 'round';
  ui.roundRect(x0 + S * 0.05, y0 + S * 0.04, w, h, S * 0.07); c.fillStyle = '#fff4dc'; c.fill(); c.lineWidth = lw; c.strokeStyle = '#5a1838'; c.stroke(); // the pages
  ui.roundRect(x0, y0, w, h, S * 0.07); const g = c.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, '#d8487e'); g.addColorStop(1, '#8e2452'); c.fillStyle = g; c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect(x0 + S * 0.07, y0, S * 0.05, h); // the spine's stitch
  ui.roundRect(x0 + w * 0.2, y0 + h * 0.14, w * 0.7, h * 0.72, S * 0.05); c.fillStyle = '#3a1430'; c.fill();
  c.fillStyle = '#ffd24a'; for (const [cx, cy, d] of [[x0 + w * 0.2, y0 + h * 0.14, 1], [x0 + w * 0.9, y0 + h * 0.86, -1]]) { c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + d * S * 0.12, cy); c.lineTo(cx, cy + d * S * 0.12); c.closePath(); c.fill(); }
  c.restore();
  const f = albumNow().list.find((q) => q.found), r = S * 0.21, cx = x0 + w * 0.55, cy = y0 + h * 0.5;
  if (f) drawOrb(c, 'combo_' + f.id, cx, cy, r, save.calm ? 0 : t); else comboShadow(c, cx, cy, r);
}
// ...on the Extras page, in the same rounded picture tile as the rows above it (render/extras.js well)
function albumRowIcon(c, x, y, S, t) {
  const x0 = x - S / 2, y0 = y - S / 2, g = c.createLinearGradient(0, y0, 0, y0 + S); g.addColorStop(0, '#f2a0c4'); g.addColorStop(1, '#c4507e');
  ui.roundRect(x0, y0, S, S, S * 0.22); c.fillStyle = g; c.fill();
  c.save(); ui.roundRect(x0, y0, S, S, S * 0.22); c.clip(); const sh = c.createLinearGradient(0, y0, 0, y0 + S); sh.addColorStop(0, 'rgba(0,0,0,0.28)'); sh.addColorStop(0.18, 'rgba(0,0,0,0)'); sh.addColorStop(0.8, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(255,255,255,0.14)'); c.fillStyle = sh; c.fillRect(x0, y0, S, S); c.restore();
  albumIcon(c, x, y + S * 0.02, S * 0.92, t);
  ui.roundRect(x0, y0, S, S, S * 0.22); c.lineWidth = S * 0.045; c.strokeStyle = 'rgba(20,8,30,0.55)'; c.stroke();
}
// the prize medal: a gold disc with a star on two ribbon tails (grey until the album is whole)
function albumMedal(c, x, y, R, lit, t) {
  c.save(); c.lineJoin = 'round'; c.lineWidth = Math.max(1.5, R * 0.08); c.strokeStyle = lit ? '#5a3000' : '#3a3050';
  for (const [d, col] of [[-1, lit ? '#e8402e' : '#6a6080'], [1, lit ? '#3a80ea' : '#7a7090']]) {
    c.beginPath(); c.moveTo(x + d * R * 0.2, y + R * 0.3); c.lineTo(x + d * R * 0.75, y + R * 1.45); c.lineTo(x + d * R * 0.42, y + R * 1.3); c.lineTo(x + d * R * 0.3, y + R * 1.62); c.lineTo(x - d * R * 0.12, y + R * 0.5); c.closePath(); c.fillStyle = col; c.fill(); c.stroke();
  }
  const g = c.createRadialGradient(x - R * 0.3, y - R * 0.35, R * 0.1, x, y, R);
  g.addColorStop(0, lit ? '#fff3b0' : '#c9c0dc'); g.addColorStop(1, lit ? '#e8a018' : '#8a80a0');
  c.beginPath(); c.arc(x, y, R, 0, 7); c.fillStyle = g; c.fill(); c.stroke();
  c.beginPath(); c.arc(x, y, R * 0.76, 0, 7); c.lineWidth = Math.max(1, R * 0.05); c.strokeStyle = lit ? 'rgba(120,60,0,0.5)' : 'rgba(60,50,80,0.4)'; c.stroke();
  c.restore();
  drawStar(c, x, y + R * 0.03, R * 0.5, lit);
  if (lit && !save.calm) { c.save(); c.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3); c.fillStyle = '#fff'; c.beginPath(); for (let i = 0; i < 8; i++) { const q = (i * Math.PI) / 4, rr = i % 2 ? R * 0.05 : R * 0.2; c.lineTo(x + R * 0.55 + Math.cos(q) * rr, y - R * 0.55 + Math.sin(q) * rr); } c.fill(); c.restore(); }
}
// one tile: the combo's art (or its silhouette), its name and what it does (or the hint); the last tile is the prize
function albumTile(it, x, y, w, h, s, o) {
  const prize = !!it.prize, D = o.D, found = prize ? D.done : it.found && o.k > 0;
  const col = prize ? (D.done ? '#ffc23a' : '#8a7aa8') : found ? '#ffc94a' : '#6a58a8';
  const lip = 5 * s, fh = h - lip, r = 18 * s, tint = ui.tint, ink = found ? tint(col, -0.74) : '#f2eaff';
  ui.roundRect(x, y + lip, w, fh, r); ctx.fillStyle = tint(col, -0.42); ctx.fill();
  ui.roundRect(x, y, w, fh, r); const g = ctx.createLinearGradient(0, y, 0, y + fh); g.addColorStop(0, tint(col, found ? 0.6 : 0.25)); g.addColorStop(1, tint(col, found ? 0.12 : -0.12));
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2.5 * s; ctx.strokeStyle = tint(col, -0.5); ctx.stroke();
  // the words from the bottom up: the name, then the line (or the prize's count / button)
  const ns = o.ns, ls = o.ls, lh = o.lh, nY = y + fh - 10 * s - o.nMax * lh - ns * 0.62, aTop = y + 8 * s, aBot = nY - ns * 0.7 - 4 * s;
  const acx = x + w / 2, acy = (aTop + aBot) / 2, aD = Math.min(w * 0.7, aBot - aTop);
  if (found) { const lg = ctx.createRadialGradient(acx, acy, 0, acx, acy, aD * 0.6); lg.addColorStop(0, 'rgba(255,255,255,0.75)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = lg; ctx.fillRect(x, aTop, w, aBot - aTop + 6 * s); }
  const grp = 'album:t:' + it.id, t = save.calm ? 0 : G.t;
  if (prize) albumMedal(ctx, acx, acy - aD * 0.14, aD * 0.3, D.done, t);
  else if (found) {
    const k = o.k, sc = k < 1 ? Math.max(0.05, backK(k)) : 1;
    if (k < 1) { // the reveal: a ring of sparks and the art popping out of its silhouette
      ctx.save(); ctx.globalAlpha = 1 - k; comboShadow(ctx, acx, acy, aD / 2.3 * (1 + 0.3 * k)); ctx.restore();
      for (let i = 0; i < 10; i++) { const q = (i / 10) * Math.PI * 2 + 0.3, rr = aD * (0.25 + 0.45 * k); ctx.save(); ctx.globalAlpha = 1 - k; ctx.fillStyle = i % 2 ? '#fff3a8' : '#ffffff'; ctx.beginPath(); ctx.arc(acx + Math.cos(q) * rr, acy + Math.sin(q) * rr, (3.5 - 2 * k) * s, 0, 7); ctx.fill(); ctx.restore(); }
    }
    ctx.save(); ctx.translate(acx, acy); ctx.scale(sc, sc); drawOrb(ctx, 'combo_' + it.id, 0, 0, aD / 2.3, t); ctx.restore();
  } else comboShadow(ctx, acx, acy, aD / 2.3);
  ui.record({ x: acx - aD / 2, y: aTop, w: aD, h: aBot - aTop }, 'album:art:' + it.id, grp);
  const name = prize ? 'Album prize' : found ? it.name : '? ? ?';
  ui.text(name, acx, nY, { size: ns, align: 'center', maxW: w - 14 * s, color: ink, stroke: found ? null : 'rgba(20,10,40,0.6)', strokeW: 3 * s, tag: 'album:name:' + it.id, group: grp });
  const ly = nY + ns * 0.62 + 4 * s;
  if (prize) {
    const bh = Math.min(40 * s, o.nMax * lh + 2 * s), bw = Math.min(w - 20 * s, 150 * s), bx = acx - bw / 2;
    if (D.prize) ui.button('xs:prize', '+' + AL.ALBUM_PRIZE, bx, ly + (o.nMax * lh - bh) / 2, bw, bh, { kind: 'gold', icon: (c, X, Y, S2) => drawCoin(c, X, Y, S2 * 0.5, G.t), size: 18 * s, shimmer: true });
    else ui.text(D.done ? 'Complete!' : `${D.n} / ${D.total} found`, acx, ly + o.nMax * lh / 2, { size: 15 * s, align: 'center', maxW: w - 14 * s, color: ink, tag: 'album:count', group: grp });
  } else o.lines.forEach((l, i) => ui.text(l, acx, ly + lh * (i + 0.5) + (o.nMax - o.lines.length) * lh / 2, { size: ls, align: 'center', maxW: w - 12 * s, color: found ? tint(col, -0.62) : 'rgba(236,226,255,0.88)', tag: 'album:l' + i + ':' + it.id, group: grp }));
  if (o.fresh) { const pw = ui.measure('NEW', 11 * s) + 14 * s, ph = 19 * s; ui.roundRect(x + 7 * s, y + 7 * s, pw, ph, ph / 2); ctx.fillStyle = '#e8402e'; ctx.fill(); ctx.lineWidth = 1.5 * s; ctx.strokeStyle = '#fff'; ctx.stroke(); ui.text('NEW', x + 7 * s + pw / 2, y + 7 * s + ph / 2 + 0.5 * s, { size: 11 * s, align: 'center', color: '#fff', tag: 'album:new:' + it.id, group: grp }); }
  if (o.look) focusDraw(ctx, ui, o.look, { x, y, w, h }, r, s);
}
function drawAlbum() {
  const AB = G.album, A = ui.A, u = ui.u, calm = save.calm, S = G.escroll, D = albumNow();
  ui.calm = calm;
  const bg = ctx.createLinearGradient(0, 0, 0, H_); bg.addColorStop(0, '#1c1440'); bg.addColorStop(1, '#3a2152'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W_, H_);
  const items = [...D.list, { prize: true, id: '_prize' }], wide = A.w > A.h * 1.15, cols = wide ? 4 : 2, rows = Math.ceil(items.length / cols);
  const P = ui.pageBox(wide ? 900 * u : 560 * u), s = P.s, gap = 12 * s, vt = P.bottom + 8 * s, vb = A.y1 - 8 * s, V = { x: A.x, y: vt, w: A.w, h: vb - vt };
  const tw = (P.w - gap * (cols - 1)) / cols, ns = 17 * s, ls = 13.5 * s, lh = ls * 1.24;
  const lineOf = (it) => (it.found ? powerInfo('combo_' + it.id).line : AL.hintText(it.id, comboName));
  const wraps = items.map((it) => (it.prize ? [] : wrapText(lineOf(it), ls, tw - 18 * s).slice(0, 3)));
  const nMax = Math.max(2, ...wraps.map((q) => q.length)), textH = ns * 1.3 + nMax * lh + 14 * s;
  const need = 8 * s + Math.min(tw * 0.5, 84 * s) + textH + 5 * s, room = V.h - 10 * s;
  const th = clamp((room - (rows - 1) * gap) / rows, need, need * 1.3);
  const air = Math.min(30 * s, Math.max(0, room - rows * th - (rows - 1) * gap) / (rows + 1)), rowGap = gap + air;
  const total = 6 * s + air * 2 + rows * th + (rows - 1) * rowGap + 4 * s;
  S.max = Math.max(0, total - V.h);
  glide(S);
  if (AB.want && !AB.went) { // the new find (or the prize waiting): the page lands on its tile and rings it
    AB.went = true; const i = items.findIndex((q) => q.id === AB.want);
    if (i >= 0) { focusTrip(S, focusY(6 * s + air + Math.floor(i / cols) * (th + rowGap), th, V.h, S.max, s), calm); focusStart(S, AB.want, G.t + 0.1, 4, false); }
  }
  const r0 = ui.rects.length, b0 = ui.buttons.length, y0 = vt + 6 * s + air - snapPx(S.y, DPR);
  ctx.save(); ctx.beginPath(); ctx.rect(V.x, V.y, V.w, V.h); ctx.clip();
  items.forEach((it, i) => {
    const c = i % cols, rr = Math.floor(i / cols), inRow = Math.min(cols, items.length - rr * cols), rx = P.x + (P.w - (inRow * tw + (inRow - 1) * gap)) / 2;
    const x = rx + c * (tw + gap), y = y0 + rr * (th + rowGap);
    if (y > V.y + V.h || y + th < V.y) return;
    const fi = AB.fresh.indexOf(it.id), fresh = fi >= 0;
    let k = 1;
    if (fresh && !calm) { // a new find turns over from its silhouette, one after the other
      k = clamp((G.t - AB.t0 - 0.45 - fi * 0.3) / 0.55, 0, 1);
      if (k > 0 && !AB.snd[it.id]) { AB.snd[it.id] = 1; audio.play('star', { pitch: 1 + fi * 0.08 }); }
    }
    const look = S.hl && S.hl.key === it.id ? focusLook(S.hl, G.t, calm) : null;
    albumTile(it, x, y, tw, th, s, { D, k, fresh, look, ns, ls, lh, nMax, lines: wraps[i] });
  });
  ctx.restore();
  clipRecorded(r0, b0, V);
  if (S.max > 0 && !calm) { const th2 = Math.max(30 * u, V.h * V.h / total), ty2 = vt + clamp(S.y / S.max, 0, 1) * (V.h - th2 - 4 * u); ui.roundRect(A.x1 - 5 * u, ty2, 3 * u, th2, 1.5 * u); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fill(); }
  // the header: back, the title, the count (the same chip as the Extras page's stars)
  const cnt = `${D.n} / ${D.total}`, cw = 10 * s + 22 * s + 6 * s + ui.measure(cnt, 17 * s) + 12 * s;
  ui.pageHeader(P, { back: 'xs:alback', title: 'Combo album', color: '#c0558a', tag: 'album:title', right: { w: cw, draw: (x, y, w, h) => {
    const ch = h - 6 * s, cy = y + 2 * s + ch / 2;
    ui.glass(x, cy - ch / 2, w, ch);
    albumIcon(ctx, x + 10 * s + 11 * s, cy, 24 * s, calm ? 0 : G.t);
    ui.text(cnt, x + w - 12 * s, cy + 0.5 * s, { size: 17 * s, color: '#fff', align: 'right', stroke: 'rgba(30,14,4,0.7)', strokeW: 3 * s, tag: 'album:count:head' });
  } } });
}
function albumPrize() {
  const D = albumNow();
  if (!D.prize) return;
  save.wallet = E.addCoins(save.wallet, AL.ALBUM_PRIZE); save.seen = { ...save.seen, albumPrize: 1 }; persist();
  startGot({ name: 'Album complete!', art: 'coins', coins: AL.ALBUM_PRIZE, items: [{ art: 'coins', label: '+' + AL.ALBUM_PRIZE }] });
}

// ---- Settings, the bottom block: Privacy policy, Reset progress, and the footer (version and support id)
SI.shield = (c, x, y, S) => { c.beginPath(); c.moveTo(x, y - S * 0.38); c.quadraticCurveTo(x + S * 0.2, y - S * 0.26, x + S * 0.34, y - S * 0.27); c.quadraticCurveTo(x + S * 0.36, y + S * 0.22, x, y + S * 0.4); c.quadraticCurveTo(x - S * 0.36, y + S * 0.22, x - S * 0.34, y - S * 0.27); c.quadraticCurveTo(x - S * 0.2, y - S * 0.26, x, y - S * 0.38); c.closePath(); c.fill(); c.strokeStyle = 'rgba(30,60,130,0.85)'; c.lineWidth = S * 0.09; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(x - S * 0.14, y + S * 0.01); c.lineTo(x - S * 0.03, y + S * 0.12); c.lineTo(x + S * 0.16, y - S * 0.1); c.stroke(); };
SI.restart = (c, x, y, S) => { c.lineWidth = S * 0.12; c.lineCap = 'round'; c.beginPath(); c.arc(x, y + S * 0.02, S * 0.28, -Math.PI * 0.55, Math.PI * 1.2); c.stroke(); const a = -Math.PI * 0.55, ax = x + S * 0.28 * Math.cos(a), ay = y + S * 0.02 + S * 0.28 * Math.sin(a); c.beginPath(); c.moveTo(ax - S * 0.2, ay - S * 0.04); c.lineTo(ax + S * 0.06, ay - S * 0.16); c.lineTo(ax + S * 0.04, ay + S * 0.14); c.closePath(); c.fill(); };
// the support id: random, made once and kept in the save (no device identifiers); the footer shows its first 8 characters
function supportId() {
  if (!save.sid) {
    let id = '';
    try { const a = new Uint8Array(8); crypto.getRandomValues(a); id = Array.from(a, (b) => b.toString(16).padStart(2, '0')).join(''); } catch (_) { id = (Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10)).padEnd(16, '0'); }
    save.sid = id; persist();
  }
  return String(save.sid).slice(0, 8);
}
/* global __BUILD__ */
const verText = () => `Eggscape ${__VERSION__}${typeof __BUILD__ !== 'undefined' && __BUILD__ ? ` (${__BUILD__})` : ''}`;
function copyText(str) {
  const old = () => { try { const ta = document.createElement('textarea'); ta.value = str; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); } catch (_) { /* nothing to copy into */ } };
  try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(str).catch(old); return; } } catch (_) { /* older web view */ }
  old();
}
// the footer line at (cx, cy): "Eggscape 0.8.17 (25) · ID 3f9a2c1d"; a tap copies both and it says "Copied" a moment
function setFooter(cx, cy, s) {
  const el = G.t - (G.copiedAt ?? -9), on = el < 1.6, size = 12.5 * s;
  const str = `${verText()}  ·  ID ${supportId()}`, w = ui.measure(str, size);
  if (on) {
    const a = save.calm ? 1 : Math.min(1, el / 0.15, (1.6 - el) / 0.3), k = save.calm ? 1 : Math.max(0.3, backK(Math.min(1, el / 0.25))), ts = 14 * s * k, cw = ui.measure('Copied', ts) + 22 * s * k;
    ctx.save(); ctx.globalAlpha *= a; // it pops in (eased, a little overshoot) and fades out
    pictoCheck(ctx, cx - cw / 2 + 8 * s * k, cy, 15 * s * k, '#8fe07a');
    ui.text('Copied', cx - cw / 2 + 20 * s * k, cy + 0.5 * s, { size: ts, color: '#dff7d4', tag: 'set:copied' });
    ctx.restore();
  } else ui.text(str, cx, cy, { size, align: 'center', color: 'rgba(255,240,210,0.7)', tag: 'set:version' });
  ui.buttons.push({ id: 'xs:sid', x: cx - w / 2 - 12 * s, y: cy - 12 * s, w: w + 24 * s, h: 24 * s });
}
// the rows for drawSettings (one line there): their own block, after everything else
const xsSetBlocks = (s) => [setHead('Privacy and data', s), setRow(s, 'xs:privacy', 'Privacy policy', 'shield', '#3a80ea', { act: 'Read' }), setRow(s, 'xs:reset', 'Reset progress', 'restart', '#d8453a', { act: 'Reset' })];

// the pages behind them, drawn in place of the Settings list while G.setSub is up (its own scroller swapped in)
function xsOpen(kind) {
  const keep = G.setSub ? G.setSub.keep : G.setpage;
  G.setSub = { kind, seq: G.setSeq, t0: G.t, keep, k: 0, lt: G.t, q: 0 };
  G.setpage = { y: 0, v: 0, max: 0, t: G.t, lid: G.setSeq };
  audio.play('ui_open');
}
function xsClose() { if (!G.setSub) return; G.setpage = G.setSub.keep || G.setpage; G.setSub = null; }
function openLink(url) { // the hosted policy: Android's web view hands an https link to the browser (MainActivity); the web opens a tab
  if (!/^https:\/\//.test(url)) return false;
  try {
    if (typeof __APP__ !== 'undefined' && __APP__) { window.location.href = url; return true; }
    if (typeof window !== 'undefined' && window.EGG_APP === true) return false; // the iPhone shell: no outside links yet, the page in the game
    return !!window.open(url, '_blank', 'noopener');
  } catch (_) { return false; }
}
const subBg = () => { const bg = ctx.createLinearGradient(0, 0, 0, H_); bg.addColorStop(0, '#3b2468'); bg.addColorStop(1, '#1c1233'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W_, H_); };
// a picture-and-words row in a well: the reset card's lists
const xsItemRow = (s, art, label, col) => ({ h: 50 * s, gap: 4 * s, draw: (x, y, w) => {
  art(x + 32 * s, y + 25 * s, 40 * s);
  ui.text(label, x + 64 * s, y + 25 * s, { size: 17 * s, color: col, maxW: w - 72 * s, tag: 'reset:i:' + label });
} });
function xsWellBlock(s, head, ok, rows) {
  const hh = 40 * s, h = hh + rows.reduce((a, b) => a + b.h + b.gap, 0) + 10 * s;
  return { h, gap: 10 * s, draw: (x, y, w) => {
    ui.well(x, y, w, h, { s, r: 16 * s, a: '#f6e6c2', b: '#ecd3a2' });
    const bx = x + 14 * s, by = y + 10 * s, d = 24 * s;
    ctx.beginPath(); ctx.arc(bx + d / 2, by + d / 2, d / 2, 0, 7); ctx.fillStyle = ok ? '#3eb42d' : '#d8453a'; ctx.fill();
    (ok ? pictoCheck : pictoCross)(ctx, bx + d / 2, by + d / 2, d * 0.62, '#fff');
    ui.text(head, bx + d + 10 * s, by + d / 2 + 0.5 * s, { size: 15 * s, color: ok ? '#2d6a1c' : '#a3271c', tag: 'reset:head:' + head });
    let yy = y + hh;
    for (const R of rows) { yy += R.gap; R.draw(x + 4 * s, yy, w - 8 * s); yy += R.h; }
  } };
}
function drawSetSub() {
  const SB = G.setSub, u = ui.u, A = ui.A, s = u * clamp(A.w / (390 * u), 0.82, 1), pad = 16 * u, land = A.h < 520 * u, calm = save.calm;
  ui.buttons.length = 0; ui.rects.length = 0; ui.calm = calm;
  subBg();
  const P = ui.pageBox(560 * s), cw = P.w, x0 = P.x, pg = G.setpage;
  const title = SB.kind === 'privacy' ? 'Privacy policy' : 'Reset progress', color = SB.kind === 'privacy' ? '#3a80ea' : '#d8453a';
  const B = [];
  let bottom = null; // the big button(s) pinned under the list (portrait); landscape: Cancel in the header, the rest in the list
  if (SB.kind === 'privacy') {
    B.push({ h: 18 * s, gap: 4 * s, draw: (x, y, w) => ui.text('Updated ' + PRIVACY_DATE, x + w / 2, y + 9 * s, { size: 13 * s, align: 'center', color: 'rgba(255,240,210,0.75)', tag: 'pp:date' }) });
    for (const [head, ...paras] of PRIVACY) {
      const iw = cw - 32 * s, ps = 15 * s, plh = ps * 1.34, L = paras.map((p) => wrapText(p, ps, iw)), n = L.reduce((a, b) => a + b.length, 0);
      const h = 16 * s + 22 * s + 6 * s + n * plh + (L.length - 1) * 6 * s + 12 * s;
      B.push({ h, gap: 10 * s, draw: (x, y, w) => {
        ui.well(x, y, w, h, { s, r: 16 * s, a: '#f6e6c2', b: '#ecd3a2' });
        ui.text(head, x + 16 * s, y + 16 * s + 11 * s, { size: 19 * s, color: ui.C.ink, maxW: w - 32 * s, tag: 'pp:h:' + head });
        let yy = y + 16 * s + 22 * s + 6 * s;
        L.forEach((lines, j) => { lines.forEach((l, i) => ui.text(l, x + 16 * s, yy + plh * (i + 0.5), { size: ps, color: ui.C.ink2, maxW: w - 30 * s, tag: `pp:${head}:${j}:${i}` })); yy += lines.length * plh + 6 * s; });
      } });
    }
    bottom = { id: 'xs:subback', label: 'Done', kind: 'primary', icon: ICON.check };
  } else if (SB.kind === 'reset1') {
    const ink = ui.C.ink, gone = [
      xsItemRow(s, (x, y, S) => { drawStar(ctx, x, y, S * 0.42, true); }, 'Levels and stars', ink),
      xsItemRow(s, (x, y, S) => { drawBoosterIcon(ctx, 'golden', x + S * 0.12, y - S * 0.06, S * 0.66, 0); drawCoin(ctx, x - S * 0.16, y + S * 0.12, S * 0.26, 0); }, 'Coins and power-ups', ink),
      xsItemRow(s, (x, y, S) => drawHenSkinPreview(ctx, 'santa', x, y + S * 0.02, S * 0.95, 0), 'Hens, eggs and chicks', ink),
      xsItemRow(s, (x, y, S) => albumIcon(ctx, x, y, S * 1.05, 0), 'Combo album', ink),
    ];
    const kept = [xsItemRow(s, (x, y, S) => settingsIcon(ctx, x, y, S * 0.9, '#6b3f17', '#f0dcb2'), 'Your settings', ink)];
    if (ads.moneyShop) kept.unshift(xsItemRow(s, (x, y, S) => drawGift(ctx, x, y, S * 0.9, 0), 'Purchases: the store gives them back', ink));
    B.push({ h: 118 * s, gap: 4 * s, hen: 1, draw: (x, y, w, h = 118 * s) => drawHenAnim(ctx, 'worried', x + w / 2, y + h / 2, h * 0.95, G.t, { key: 'reset', calm, shadow: 0 }) });
    B.push(xsWellBlock(s, 'Erased', false, gone));
    B.push(xsWellBlock(s, 'Kept', true, kept));
    const red = { h: 50 * s, gap: 14 * s, draw: (x, y, w) => ui.button('xs:next', 'Reset progress', x + w * 0.15, y, w * 0.7, 50 * s, { kind: 'red', size: 18 * s, icon: (c, X, Y, S2) => { c.save(); c.fillStyle = '#fff'; c.strokeStyle = '#fff'; SI.restart(c, X, Y, S2); c.restore(); } }) };
    if (land) B.push(red);
    bottom = { id: 'xs:subback', label: 'Cancel', kind: 'primary', extra: land ? null : red };
  } else { // reset2: hold the red button two seconds (a ring fills); letting go drains it
    const dt = clamp(G.t - SB.lt, 0, 0.1), down = ui.pressedId === 'xs:hold';
    SB.lt = G.t;
    SB.k = clamp(SB.k + (down ? dt / 2 : -dt * 1.6), 0, 1);
    const q = Math.floor(SB.k * 8);
    if (down && q > SB.q) audio.play('ring_tick', { pitch: 0.9 + q * 0.09 });
    SB.q = q;
    if (SB.k >= 1) { ui.pressedId = null; G.pressPointer = null; doReset(); return; }
    const avail = (land ? A.y1 - 8 * s : A.y1 - pad - 72 * s) - (P.bottom + 8 * s), hd = Math.min(land ? avail * 0.62 : Math.min(cw * 0.6, 300 * s), avail * (land ? 0.5 : 0.36)), henH = Math.min(land ? 120 * s : Math.min(cw * 0.78, 340 * s), avail - hd - 40 * s, land ? avail : avail * 0.4); // (0.8.17 polish: a tall phone grows the hen and the button, the gaps stay a comfortable even few)
    B.push({ h: Math.max(60 * s, avail - 20 * s), gap: 6 * s, draw: (x, y, w) => {
      const H = Math.max(60 * s, avail - 20 * s), sp = (H - henH - hd) / 3, hy = y + sp + henH / 2, cx = x + w / 2, cy = y + sp * 2 + henH + hd / 2, R = hd / 2;
      drawHenAnim(ctx, down ? 'gasp' : 'worried', cx, hy, henH, G.t, { key: 'reset', calm, shadow: 0 });
      // the ring round the button: a dark track, the fill eased in and out of its ends
      const k = SB.k, e = k * k * (3 - 2 * k), lw = 12 * s;
      ctx.save(); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(cx, cy, R + lw, 0, 7); ctx.lineWidth = lw; ctx.strokeStyle = 'rgba(20,8,30,0.55)'; ctx.stroke();
      if (e > 0.002) { ctx.beginPath(); ctx.arc(cx, cy, R + lw, -Math.PI / 2, -Math.PI / 2 + e * Math.PI * 2); ctx.lineWidth = lw * 0.72; ctx.strokeStyle = '#ffd23f'; ctx.stroke(); }
      ctx.restore();
      ui.record({ x: cx - R - lw * 1.5, y: cy - R - lw * 1.5, w: 2 * R + 3 * lw, h: 2 * R + 3 * lw }, 'reset:ring', 'btn:xs:hold');
      const b = ui.button('xs:hold', '', cx - R, cy - R, 2 * R, 2 * R, { kind: 'red', round: R });
      const fy = b.cy;
      ctx.save(); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.translate(cx, fy - R * 0.2); ctx.rotate(calm ? 0 : -e * Math.PI * 2); SI.restart(ctx, 0, 0, R * 0.62); ctx.restore();
      ui.text('Hold', cx, fy + R * 0.36, { size: Math.min(28 * s, R * 0.3), align: 'center', color: '#fff', stroke: 'rgba(90,10,5,0.8)', strokeW: 4 * s, tag: 'reset:hold', group: 'btn:xs:hold' });
    } });
    bottom = { id: 'xs:subback', label: 'Cancel', kind: 'primary' };
  }
  // header (landscape: the big button sits in the header's right slot, like Settings' Done)
  ui.pageHeader(P, { back: 'xs:subback', title, color, tag: 'sub:title', right: land && bottom ? { w: 130 * s, draw: (x, y, w, h) => ui.button(bottom.id, bottom.label, x, y, w, h, { kind: bottom.kind, icon: bottom.icon, size: 19 * s }) } : null });
  let vb = A.y1 - (land ? 2 * u : pad);
  if (!land && bottom) {
    const bh = 60 * s, by = A.y1 - pad - bh;
    ui.button(bottom.id, bottom.label, x0, by, cw, bh, { kind: bottom.kind, icon: bottom.icon, size: 23 * s });
    vb = by - 10 * s;
    if (bottom.extra) { bottom.extra.draw(x0, vb - bottom.extra.h, cw); vb -= bottom.extra.h + 14 * s; }
  }
  const vt = P.bottom + 8 * s, V = { x: A.x, y: vt, w: A.w, h: Math.max(60, vb - vt) };
  if (SB.kind === 'reset1' && !land) { // a tall phone: the hen grows into the spare room, what is left spreads over the gaps (a short one: she gets smaller first)
    const sum = B.reduce((a, b) => a + b.h + b.gap, 0), spare = V.h - sum - 8 * s;
    if (spare < 0) { const hen = B.find((b) => b.hen); hen.h = Math.max(72 * s, hen.h + spare); }
    else if (spare > 0) { const hen = B.find((b) => b.hen), g = Math.min(spare * 0.5, 60 * s), d = (spare - g) / (B.length + 1); hen.h += g; for (const b of B) b.gap += d; }
    for (const b of B) if (b.hen) { const d0 = b.draw, hh = b.h; b.draw = (x, y, w) => d0(x, y, w, hh); }
  }
  if (SB.kind === 'reset2') { pg.y = 0; pg.max = 0; let y = vt; for (const b of B) { y += b.gap ?? 10 * s; b.draw(x0, y, cw); y += b.h; } return; }
  pageScroll(B, pg, V, x0, cw, s, SB.kind === 'privacy');
}
// child-safe mode: a grown-up's sum first (drawParentCheck), then the card
function askReset() { if (OF.childSafe(save)) G.parent = { reset: true, q: OF.parentQuestion() }; else xsOpen('reset1'); }
// the wipe: the save starts again with what src/reset.js keeps, the store is asked for the purchases, home
function doReset() {
  const fresh = RS.resetSave(save, defaultSave());
  xsClose(); G.settingsOpen = false; closeAlbum();
  loadSave(fresh); lastCoins = null;
  G.fails = {}; G.got = null; G.party = null; G.detail = null; G.parent = null; G.offer = null; G.nudge = null; G.toasts = []; G.toast = null;
  G.markC = null; G.shopPlan = null; G.forYou = null; G.stkSel = null; G.trialChick = null;
  for (const L of LEVELS) ads.won(L.id); // the stuck counts of this session
  persist();
  OF.startSession(save, Date.now());
  ads.restore(); // the store's own record: Android hands every purchase it still knows back (window.__eggGrant, no coins twice)
  portal.gameplayStop();
  startLevel(nextIdx()); setScreen('title'); G.homeIntro = true; G.screenT = 0;
  audio.play('rewind'); buzz('win');
}
// every 'xs:' tap (and Back while one of these pages is up)
async function xsPress(id) {
  switch (id) {
    case 'xs:album': openAlbum(); break;
    case 'back': case 'xs:alback': closeAlbum(); break;
    case 'xs:prize': albumPrize(); break;
    case 'xs:privacy': if (!(PRIVACY_URL && openLink(PRIVACY_URL))) xsOpen('privacy'); break;
    case 'xs:reset': askReset(); break;
    case 'xs:next': xsOpen('reset2'); break;
    case 'xs:hold': break; // a tap is not a hold (the ring drains)
    case 'set:close': case 'xs:subback': xsClose(); break;
    case 'xs:sid': copyText(`${verText()}, support id ${supportId()}`); G.copiedAt = G.t; audio.play('hud_pop'); break;
  }
}

function frame(now) {
  requestAnimationFrame(frame); // first: an error below can never stop the loop (a stopped loop is a frozen level)
  if (VSYNC.last) {
    const d = now - VSYNC.last;
    if (d > 4 && d < 45) { VSYNC.buf.push(d); if (VSYNC.buf.length >= 31) { VSYNC.buf.sort((a, b) => a - b); VSYNC.iv = VSYNC.buf[15]; VSYNC.buf.length = 0; if (!VSYNC.ivs || Math.abs(VSYNC.ivs - VSYNC.iv) > VSYNC.iv * 0.2) VSYNC.ivs = VSYNC.iv; } }
    if (VSYNC.ivs && Math.abs(d - VSYNC.ivs) < VSYNC.ivs * 0.25) VSYNC.ivs += (d - VSYNC.ivs) * 0.05;
  }
  VSYNC.last = now;
  if (speedTest.active) { speedTest.frame(now); last = now; return; } // the speed test has the screen (and the taps) until it closes
  // 2026-11-16 battery (mykee: the phone heats up): never draw faster than 60 fps (a 120 Hz screen called us twice as
  // often for nothing). 2026-11-19: 30 fps when Settings > Frame rate says so, or when Auto finds the phone can't hold 45.
  // 2026-11-20 (mykee: stutters even on a high-end phone): the cap counts whole screen refreshes. The old time test drew
  // every SECOND refresh on a 90 Hz screen (45 fps, a visible judder), Auto read 45 fps as "too slow" and walked the
  // phone down to Low and 30 fps. Now 60 and 90 Hz draw every refresh, 120 and 144 Hz every second one.
  const every = Math.max(1, Math.floor((1000 / PERF.fpsCap) / VSYNC.iv + 0.1), VSYNC.iv < 14.5 ? PERF.pace : 1); // PERF.pace: a fast screen that keeps missing refreshes draws every second one
  if (now - last < every * VSYNC.iv - VSYNC.iv * 0.5) return;
  // a slow phone catches up instead of slowing the world down (the cap was 0.05 s: at 5 fps the rings turned at a
  // quarter speed and looked stuck); past 0.1 s a frame is a hitch and the world waits
  const raw = last ? now - last : 16, dt = Math.min(0.1, frameDt(raw) / 1000 || 0.016);
  last = now;
  if (G.paused) return;
  if (takeStep(save, G.screen === 'play' && !!G.sim)) {
    if (recIll() && save.gfx === 'auto' && REC.stepOk >= 0) save.gfxStep = REC.stepOk; // a step taken while the drawing is ill is not this phone's own level (src/recover.js)
    setDPR(); persist(); // a quality change lands before this frame draws (no empty frame); Auto remembers it
  }
  if (REC.want && !G.adBusy && (G.screen !== 'play' || REC.state !== 'ok')) recProbe({ n: gpuProbe() }); // rare: three early on, then on the menus about every two minutes, and whenever the watchdog asks
  try {
    { const hs = DR.trialHen(save) || save.wallet.henSkin; if (G.henSkinCur !== hs) { G.henSkinCur = hs; setHenSkin(hs); ui.skin = skinUI(hs); } } // hen + rooster skin (an outfit on trial too), and the menus' theme
    const w0 = performance.now(), b0 = stampStats.builds;
    update(dt);
    renderAll();
    tallyFrame();
    FPSM.lastWork = performance.now() - w0;
    FPSM.work += FPSM.lastWork;
    FPSM.baked = stampStats.builds !== b0; // this frame baked pictures (a new skin's eggs, thorns): the next gap is not the phone's pace
  } catch (e) {
    const msg = String((e && e.message) || e);
    G.errs = G.errs || {};
    if (!G.errs[msg]) { G.errs[msg] = 1; console.error('[eggscape] frame error', e); diag.error(msg); }
    try { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalAlpha = 1; } catch (_) { /* reset */ }
  }
  if (save.showFps) drawFpsMeter(raw);
  if (G.adBusy) adWatch(raw);
  perfTick(save, raw, !document.hidden && !G.paused && !G.adBusy && G.screen === 'play', FPSM.lastWork || 0, FPSM.bakedPrev, VSYNC.iv);
  if (!document.hidden) diag.frame(raw, FPSM.lastWork || 0, VSYNC.iv, every, G.screen);
  watchFrame(raw, FPSM.lastWork || 0, every);
  FPSM.bakedPrev = FPSM.baked; FPSM.baked = false; // 2026-11-19: Auto judges the phone on the game itself, not on a heavy menu (a themed home screen used to talk it down to Low for the next level)
}
// ---- the slow-drawing watchdog's hands (the thinking is in src/recover.js)
// one second of frames on one screen, as the watchdog wants it: no hidden page, no ad, not a screen's first 0.7 s
// (it is still building its pictures), no frame that follows a picture bake
const RW = { scr: '', n: 0, span: 0, js: 0, t: 0 };
function watchFrame(raw, work, every) {
  if (!REC.on || REC.state === 'off') return;
  const s = G.screen;
  if (s !== RW.scr || document.hidden || G.adBusy || raw > 400) { if (s !== RW.scr) RW.t = 0; RW.scr = s; RW.n = RW.span = RW.js = 0; return; }
  if ((RW.t += raw) < 700 || FPSM.bakedPrev) return;
  RW.n++; RW.span += raw; RW.js += work;
  if (RW.span < 1000) return;
  let fps = RW.n * 1000 / RW.span, js = RW.js / RW.n;
  RW.n = RW.span = RW.js = 0;
  const cap = 1000 / (every * VSYNC.iv);
  if (DEV && FAKE) { const ill = fakeIll(); fps = cap * (ill ? FAKE.fps || 0.4 : 1); js = ill ? js * (FAKE.js || 8) + 30 : Math.min(js, 8); } // the page test plays a healthy phone that falls ill (a headless browser has no steady pace of its own)
  recWindow({ scr: s, fps, js, dpr: DPR, cap, step: PERF.step, hot: REC.bad > 0 && phoneHot() });
  if (REC.note) { const n = REC.note; REC.note = ''; if (n === 'ok') toast('Back to full speed', 2.2); }
  const busy = G.adBusy || ads.busy || !!G.getMore || !!G.detail || !!G.chickBuy || G.settingsOpen || speedTest.active || G.screenT < 0.5;
  const rung = recDue(s, busy, G.sim ? G.sim.t : 99);
  if (rung) cure(rung);
  else { const pre = recPre(s, busy); if (pre) cure(pre, true); } // ahead of time, at the point this phone fell ill before
}
// Android's own word on heat (0 none, 1 light, 2 moderate, 3 severe ...): a phone that throttles itself is slow for
// another reason. Only asked while the watchdog is already counting bad seconds.
function phoneHot() {
  try { const b = window.EggApp; if (b && typeof b.deviceInfo === 'function') return (JSON.parse(b.deviceInfo(false) || '{}').thermal || 0) >= 2; } catch (_) { /* no shell */ }
  return false;
}
// The probe: one fixed drawing job on a fresh canvas, timed to the last pixel. With the graphics chip it takes a
// millisecond or three; painted by the processor, several times that. Reading one pixel back (through a 1 px canvas
// that is kept off the chip on purpose) makes the web view finish the job before the clock stops. The fresh canvas is
// handed straight back. The game's own canvas is never read.
let PROBE_PIX = null;
const FAKE = DEV ? (() => { try { return JSON.parse(sessionStorage.getItem('egg.fake') || 'null'); } catch (_) { return null; } })() : null;
// dev only: { loads: pages still ill, after: healthy seconds before it starts, fps, js, p, ok } in sessionStorage 'egg.fake'
function fakeIll() { return FAKE.loads > 0 && (REC.wins >= (FAKE.after || 24) || !!FAKE.came); }
function gpuProbe() {
  if (DEV && FAKE) return fakeIll() ? FAKE.p || 40 : FAKE.ok || 2;
  try {
    const N = 384, c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d');
    if (!PROBE_PIX) { const d = document.createElement('canvas'); d.width = d.height = 1; PROBE_PIX = d.getContext('2d', { willReadFrequently: true }); }
    const t0 = performance.now();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 24; i++) {
      const x = (i * 97) % N, y = (i * 61) % N, gr = g.createRadialGradient(x, y, 4, x, y, N);
      gr.addColorStop(0, 'rgba(255,200,120,0.06)'); gr.addColorStop(1, 'rgba(40,80,200,0.02)');
      g.fillStyle = gr; g.fillRect(0, 0, N, N);
    }
    PROBE_PIX.drawImage(c, 0, 0, N, N, 0, 0, 1, 1);
    PROBE_PIX.getImageData(0, 0, 1, 1);
    const ms = performance.now() - t0;
    freeCanvas(c);
    return ms;
  } catch (_) { return 0; }
}
// The cure (rung 1 loads the page again, 2 ends the page's process, 3 starts the app again). The save goes first, with
// the quality step from before the phone fell ill; the Android shell also keeps a copy of the save for the next start,
// because the web view writes its storage to disk a few seconds late and rungs 2 and 3 do not wait for it.
function cure(rung, pre = false) {
  if (!pre && save.gfx === 'auto' && REC.stepOk >= 0) save.gfxStep = REC.stepOk;
  persist();
  recGo({ scr: G.screen, li: G.li, world: G.world }, pre ? rung : 0);
  diag.flush();
  if (DEV && FAKE && FAKE.loads > 0) { FAKE.loads--; FAKE.came = 1; try { sessionStorage.setItem('egg.fake', JSON.stringify(FAKE)); } catch (_) { /* test only */ } }
  try {
    const b = window.EggApp;
    if (rung >= 2 && b && typeof b.recover === 'function') {
      let rec = ''; try { rec = localStorage.getItem('eggscape.rec.v1') || ''; } catch (_) { rec = ''; }
      b.recover(rung, JSON.stringify({ at: Date.now(), save: JSON.stringify(save), rec, log: diag.lines().slice(-400).join('\n') }));
      return;
    }
  } catch (_) { /* an older shell: the page reload below */ }
  location.reload();
}
// 2026-11-20 pacing (tools/perf87/pacing.mjs): the world advances by whole screen refreshes. Callback times wobble by
// a millisecond or so; fed straight in, a 60 Hz frame got 1, 2 or 3 physics steps (8.3 ms each) at random instead
// of 2, and things on screen moved in uneven jumps even at a full 60 fps. A gap within 30% of a whole number of
// refreshes counts as exactly that many; the time snapped off is given back a tenth at a time (all at once past half a
// refresh, or with the next gap that is not a whole number of refreshes), so the game clock never drifts from the real one.
function frameDt(raw) {
  const iv = VSYNC.ivs, n = iv ? Math.max(1, Math.round(raw / iv)) : 0;
  if (!n || Math.abs(raw - n * iv) >= iv * 0.3) { const r = raw + VSYNC.err; VSYNC.err = 0; return r; }
  let s = n * iv; VSYNC.err += raw - s;
  const c = Math.abs(VSYNC.err) > iv * 0.5 ? VSYNC.err : VSYNC.err * 0.1;
  s += c; VSYNC.err -= c;
  return s;
}
// scrolling lists and the map (2026-11-19, mykee: "so slow"): a fling glides about 1/SCROLL_DRAG s of its speed (was 3.6-4.2)
// (the numbers and the feel live in scroll.js)
// Settings > Display > Show frame rate (2026-11-19): frames per second over the last second, the quality step, and the
// canvas resolution, in the top-left corner, so a tester can tell us how a phone really runs
// 2026-11-20: also the screen's refresh rate, the game's own work per frame (ms, update + drawing commands) and the
// worst frame gap of the last second: a high gap with low work means the phone's graphics chip, not the game code
const FPSM = { n: 0, acc: 0, fps: 0, work: 0, wms: 0, worst: 0, w: 0, txt: '', tw: 0, font: '', dpr: 0, tier: '' };
function drawFpsMeter(ms) {
  FPSM.n++; FPSM.acc += ms; FPSM.worst = Math.max(FPSM.worst, ms);
  if (FPSM.acc >= 1000) { FPSM.fps = Math.round(FPSM.n * 1000 / FPSM.acc); FPSM.wms = FPSM.work / FPSM.n; FPSM.w = FPSM.worst; FPSM.n = 0; FPSM.acc = 0; FPSM.work = 0; FPSM.worst = 0; FPSM.txt = ''; }
  // the line (and its width) is built once a second or when the quality step changes, not every frame (no per-frame strings)
  if (!FPSM.txt || FPSM.dpr !== DPR || FPSM.tier !== PERF.tier) {
    FPSM.dpr = DPR; FPSM.tier = PERF.tier; FPSM.font = `700 11px ${FONT}`;
    FPSM.txt = `${FPSM.fps} fps \u00b7 ${Math.round(1000 / VSYNC.iv)} Hz \u00b7 ${TIER_NAME[PERF.tier]} \u00b7 ${DPR.toFixed(2)}x \u00b7 ${FPSM.wms.toFixed(1)} ms \u00b7 max ${Math.round(FPSM.w)}`;
    ctx.font = FPSM.font; FPSM.tw = ctx.measureText(FPSM.txt).width + 10;
  }
  const txt = FPSM.txt;
  ctx.save(); ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.font = FPSM.font; const w = FPSM.tw;
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
    if (document.hidden) { const sc0 = G.screen; clearKeys(); if (G.screen === 'play') press('pause'); DR.noteSeen(save, Date.now()); engClose(sc0); persist(); } // the Director: when the app was last open (welcome-back gift)
    else { talView.t0 = performance.now(); engOpen(); }
    audioHold('hidden', document.hidden);
  });
  window.addEventListener('blur', clearKeys);
  installApp(() => { // Android back button (see app.js): consume it where the game has a natural "back"
    if (G.adBusy) { ads.cancelWait(); return true; } // a pending ad that never reported back: Back returns to the game
    if (modalOpen()) { // a sheet closes first (an offer counts as "No thanks"; the age question waits for next launch)
      if (G.parent) G.parent = null; else if (G.waitList) G.waitList = null; else if (G.getMore) G.getMore = null; else if (G.chickBuy) G.chickBuy = null; else if (G.detail) G.detail = null;
      else if (G.offer) press('of:no'); else if (G.ageAsk) press('age:later'); else if (G.remAsk) press('rem:later'); else if (G.leaveAsk) press('leave:stay'); else if (G.treasure) G.treasure = null;
      return true;
    }
    if (G.settingsOpen) { press('set:close'); return true; } // the Settings page closes first
    switch (G.screen) {
      case 'play': press('pause'); return true;
      case 'pause': press('resume'); return true;
      case 'info': press('info:close'); return true;
      case 'practice': case 'extras': case 'store': case 'levels': press('back'); return true;
      case 'spin': press('spin:back'); return true;
      case 'wonder': return wonder.back(); // 0.8.17: a side quest's card / pause page / end page (wonder.js)
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
  // 0.8.17: the separate everything-unlocked test app (build flag __UNLOCKED__, its own app id): once, the whole coop,
  // both bundles' boosters, charges and tickets, and a deep purse, so every page and animation can be tried at once
  if (typeof __UNLOCKED__ !== 'undefined' && __UNLOCKED__ && !save.unlockedKit) {
    let w = save.wallet;
    for (const sku of ['eggscape_collector', 'starter_nest', 'bundle_helper']) w = E.grantIap(w, sku, 'unlocked-build:' + sku, Date.now()).wallet;
    save.wallet = E.addCoins(w, 20000); save.unlockedKit = 1; persist();
  }
  if (PREVIEW === 'spin') { const stars = {}; for (let i = 1; i < 12; i++) stars[i] = 2; save = defaultSave(); loadSave({ ...save, unlocked: 12, stars, wallet: { ...save.wallet, coins: 300 }, spin: { wins: 1, bank: 3 } }); } // the Lucky Spin to show: a player at level 12 with three spins
  // the app build used to be an everything-unlocked test build: its saves carry 50 fake levels and 99999 coins. The first
  // real-progression launch starts the journey fresh (settings and the hen's skins carry over).
  if (typeof __APP__ !== 'undefined' && __APP__ && !save.real) {
    const keep = { sfx: save.sfx, music: save.music, mode: save.mode, calm: save.calm, ringSpeed: save.ringSpeed, saver: save.saver, gfx: save.gfx, fps: save.fps, gfxStep: save.gfxStep };
    save = { ...defaultSave(), ...keep };
    ads.rebind(save);
  }
  save.real = 1;
  // 0.8.12: a cure by the slow-drawing watchdog that started the page's process or the whole app again (src/recover.js):
  // the Android shell kept the save, the watchdog's notes and the end of the speed log, because the web view writes
  // its own storage to disk a few seconds late
  try {
    const b = window.EggApp, raw = b && typeof b.unstash === 'function' ? b.unstash() : '';
    const st = raw ? JSON.parse(raw) : null;
    if (st && Date.now() - st.at < 60000) {
      const sv = JSON.parse(st.save); if (sv && sv.v === SAVE_VER) { loadSave(sv); ads.rebind(save); persist(); }
      if (st.rec) localStorage.setItem('eggscape.rec.v1', st.rec);
      if (st.log) { // the lines the storage did not get to keep (either side may be a few lines ahead of the other)
        const K = 'eggscape.diag.v1', old = localStorage.getItem(K) || '', have = new Set(old.split('\n').slice(-900));
        const add = st.log.split('\n').filter((l) => l && !have.has(l)); if (add.length) localStorage.setItem(K, (old ? old + '\n' : '') + add.join('\n'));
      }
    }
  } catch (_) { /* no shell, or nothing kept */ }
  // 0.8.12: quality steps learned by 0.8.9 to 0.8.11 may be the ill phone's (mykee's flagship came back from its restart on
  // Low at 0.8x): Auto starts once more from the phone's own guess
  if (!save.seen.gfx812) { save.seen.gfx812 = 1; if (save.gfx === 'auto') save.gfxStep = -1; }
  applySettings(save); setDPR(); // graphics quality: the phone's own guess or what it learned last time (src/perf.js)
  diag.init({
    version: __VERSION__, app: typeof __APP__ !== 'undefined' && !!__APP__, perf: PERF, guess: () => PERF.guess,
    counters: () => [stampStats.builds, bodyCache.builds, formStats.bakes],
    haptics: () => { try { const b = typeof window !== 'undefined' && window.EggApp; return b && b.hapticInfo ? JSON.parse(b.hapticInfo() || '{}') : null; } catch (_) { return null; } },
    canvas, freed: () => [cvStats.freed, Math.round(cvStats.mb)],
    // the web view gave the canvas back after losing it: every cached picture may be blank, so the ones in reach are repainted
    onRestore: () => { releaseRings([]); stampSweep(); stampSweep(); if (G.backdrop) G.backdrop.resize(W_, H_, DPR); if (G.weather) G.weather.resize(W_, H_, DPR); G.frz = null; },
    sim: () => G.sim, state: () => (G.sim ? G.sim.state : ''),
    level: () => ({
      id: G.li >= 0 && G.level ? G.level.id : G.li, mode: save.mode || '', gfx: save.gfx || 'auto', fpsSet: save.fps || 'auto', step: PERF.step, low: PERF.low ? 1 : 0,
      cap: PERF.fpsCap, pace: PERF.pace, hz: Math.round(1000 / VSYNC.iv), cv: [canvas.width, canvas.height], dpr: Math.round(DPR * 100) / 100,
      egg: save.wallet.skin || '', hen: G.henSkinCur || '', rs: ringSpeed(), calm: save.calm ? 1 : 0,
      rings: G.sim.rings.length, eggs: G.sim.eggs.length, foes: G.level ? villainKinds(G.level, G.sim) : [],
    }),
  });
  // the slow-drawing watchdog (src/recover.js): back = where the player was when a cure began, if this start is one
  const back = (() => {
    try {
      const q = new URLSearchParams(location.search), b = window.EggApp;
      return recInit({ storage: localStorage, log: (o) => diag.note(o), rungs: b && typeof b.recover === 'function' ? 3 : 1, age: () => ({ s: performance.now() / 1000, fr: cvStats.freed }), off: TEST || q.get('rec') === '0' || !!q.get('demo') });
    } catch (_) { return null; }
  })();
  if (TEST) {
    const owned = {};
    for (const id of E.BOOSTER_ORDER) owned[id] = E.MAX_OWNED;
    save.unlocked = LEVELS.length;
    save.wallet = E.sanitizeWallet({ ...save.wallet, coins: Math.max(save.wallet.coins, 99999), owned, skins: E.SKIN_ORDER });
    persist();
  }
  ads.attach(save, persist, onGrant);
  ads.onRevoke(guardNote); guardNote(); // 0.8.17: a refund taken back says so once (also one noted before a restart)
  OF.startSession(save, Date.now()); if (!DR.dirState(save).lastSeen) DR.noteSeen(save, Date.now()); engOpen(); persist();
  if (OF.childSafe(save) && ads.moneyShop) ads.setChildSafe(true); // the shell also remembers it; this keeps both in step
  applyAudioSettings();
  // title runs over the live next level. A brand-new player meets the title (the logo moment, one big PLAY), and PLAY goes
  // straight into level 1 (press 'play'); a returning player opens the app on the map (2026-11-20, mykee).
  if (back) { // a cure by the slow-drawing watchdog: straight back to the level card, the map or home, with no entrance
    if (back.scr === 'intro' && back.li >= 0 && LEVELS[back.li]) startLevel(back.li);
    else { startLevel(nextIdx()); if (back.scr === 'levels') { G.world = back.world >= 0 ? back.world : envOf(nextIdx()); setScreen('levels'); } else setScreen('title'); }
  } else {
  startLevel(nextIdx());
  if (bestTotal() > 0 && !TEST) { G.world = envOf(nextIdx()); setScreen('levels'); } else setScreen('title');
  }
  if (PREVIEW === 'spin') { G.world = envOf(nextIdx()); setScreen('levels'); openSpin(); }
  if (DEV) { const d = new URLSearchParams(location.search).get('demo'); if (d) window.__egg.startDemo(d); } // v3.2: ?demo=glow
  if (!back) { G.homeIntro = true; G.screenT = 0; } // the home page plays its entrance from here (the setup above must not eat it)
  const sp = document.getElementById('splash'); // the plain sky behind the canvas goes as soon as the first frames are painted
  if (sp) requestAnimationFrame(() => requestAnimationFrame(() => sp.remove()));
  if (sp) { const minShow = back ? 0 : 2300 - (performance.now() - (window.__t0 || 0)); /* the launch sting plays out (egg in the nest) before the home screen */ setTimeout(() => { sp.classList.add('out'); setTimeout(() => sp.remove(), 500); }, Math.max(0, minShow)); }
  portal.loadingDone();
  last = performance.now();
  requestAnimationFrame(frame);
}

// test hook (used by the QA bot and screenshot tools); compiled out of release builds
if (DEV) window.__egg = {
  diag, rec: REC,
  howto: { drawHowTo, howToPlan, chickPlan, BASIC: HOWTO_BASIC, ROOSTER: HOWTO_ROOSTER, rooster: (c, x, y, s) => allyIcon(c, x, y, s) },
  stampStats,
  perf: { bodyCache, ringCache, PERF, STEPS, hud: HUD_CACHE, hudLayers: HL, applySettings: () => { applySettings(save); setDPR(); } },
  mapJump(w) { G.world = w; G.mscroll.focus = ''; }, // map shots: show world w
  sidePlan() { return MSIDE.sidePlan(mapLayoutNow()).map((q) => ({ w: q.w, key: q.key, i: q.i, x: q.x, y: q.y, R: q.R, box: q.box, stones: q.trail.stones.length })); }, // 0.8.17 QA: the side quests' doors
  sideFocus(w) { G.world = w; G.sideFocus = w; G.mscroll.focus = ''; }, // map shots: centre side quest w's door
  mapScroll(y) { G.mscroll.y = y; G.mscroll.v = 0; G.mscroll.focus = G.world + ':' + G.mscroll.enter; },
  G, LEVELS, LAB, ui, art: { drawOctopus: devOcto, octoAnim: devOctoAnim, drawJelly: devJelly }, drawVillainPortrait, PORTRAIT_BG, HEN_SKIN_ORDER: E.HEN_SKIN_ORDER, SKIN_ORDER: E.SKIN_ORDER, setEggSkin: (k) => W.setSkin(k),
  get sim() { return G.sim; },
  start: (i, o) => startLevel(i, o),
  endRun: (won) => (won ? onWin() : onFail()), // the real win and fail paths (the engine, the spin meter, the reminder question), not just the card
  CHICK_DEMOS,
  startFrog(o = {}) { G.demo = FROG_DEMO; startLevel(-2, o); }, // v3.3 frog studio level
  wonder, // WONDER: the bonus world's controller (state, toScreen) for strips and QA
  startDemo(kind, o = {}) { if (wonder.has(kind)) return wonder.start(kind); const D = [...CHICK_DEMOS, ...SEA_DEMOS, ...POWER_DEMOS, ...THIEF_DEMOS, ...REEF_DEMOS, ...BAYOU_DEMOS, ...LAB_DEMOS]; G.demo = D.find((d) => d.kind === kind || d.id === kind) || CHICK_DEMOS[0]; startLevel(-2, o); }, // v3.2 chick demos, v3.3 sea, v3.4 powers
  POWER_DEMOS,
  THIEF_DEMOS,
  bayouArt: { drawGator, drawTurtle, drawSwarm, drawGatorCard, drawGatorEmblem }, // v3.7 Gator Bayou strips
  thiefArt: { drawThief, thiefPose, thiefBlend, RIG: THIEF_RIG, drawThiefCard, drawThiefEmblem, drawBossCard, drawDenAlone }, // v3.6 thief strips
  press,
  strike(id) { if (!G.sim || !G.sim.stk) return null; if (id) G.sim.stkEquip(id); return fireStrike(true); }, // Chick Strike: fill the meter and fire
  strikeArt: { drawStrikeButton, drawStrikeToken, drawStrikeStage, drawStrikeChick },
  chickArt: { drawKindChick, drawChickEgg }, // chick kinds pose sheets (QA strips)
  step(seconds) { const n = Math.round(seconds / DT); for (let i = 0; i < n; i++) G.sim.step(); handleEvents(); },
  frame(dt = 1 / 60) { update(dt); renderAll(); tallyFrame(); }, fxStats: menuFxStats,
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
  purse, // the coin-gain effect (QA strips: purse.state)
  land, prizePop, // 0.8.17 the reward landing and the prize pop (QA strips: land.state, prizePop.state)
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
  setSave(s) { loadSave({ road: ROAD.ROAD_V, ...s }); }, // (QA saves are written in today's numbering; pass road: 0 for a save from the 50-level road)
  ads, // shop QA: stuck counts, prices, the purchase bridge
  get save() { return save; },
  // QA only: jump straight to an end screen with a plausible result
  showResult(kind, stars = 3, cheer = null, t = 9, extra = null) {
    if (kind === 'win') G.result = { broken: stars < 2 ? 1 : 0, cracked: stars === 2 ? 1 : 0, used: 47, stars, saved: stars < 2 ? 2 : 3, eggs: 3, eggScore: 4200, timeBonus: 380, streak: stars === 3 ? 3 : 0, streakMult: stars === 3 ? 1.5 : 1, total: 6870, shownTotal: 6870, t, target: 2, perfect: stars === 3, rewound: false, coins: 34, bonus: true, hasBonus: stars === 3, cheer: cheer || pickRoutine({ stars }), prevBest: 7200, hotB: [] };
    if (kind === 'win' && extra) { Object.assign(G.result, extra); const r = G.result; r.rv = { list: [r.treasure && { kind: 'treasure' }, r.gift && { kind: 'gift' }, r.hotB.length && { kind: 'hot' }].filter(Boolean).slice(0, 3), i: 0, t: 0 }; if (t > WIN_SHOW) r.rv.i = r.rv.list.length; } // QA: rewards (extra: { treasure, gift, hot, hotB })
    else if (kind !== 'win') G.sim.state = 'failed';
    setScreen(kind);
  },
};

boot();
