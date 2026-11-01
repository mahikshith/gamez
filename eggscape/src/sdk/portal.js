// Portal SDK adapter. One API for every portal; the portal is chosen at build time
// via the global constant __PORTAL__ (esbuild `define`). Every SDK call is guarded:
// a missing/blocked SDK (ad blocker), environment 'disabled', or an exception must
// never block or crash the game. Ads fail open (game continues), rewarded fails closed (false).

/* global __PORTAL__, __GD_ID__, __DEV__, __TEST__, ytgame */
const NAME = typeof __PORTAL__ !== 'undefined' ? __PORTAL__ : 'web';
const GD_ID = typeof __GD_ID__ !== 'undefined' ? __GD_ID__ : 'REPLACE_WITH_GD_GAME_ID';
const DEV = typeof __DEV__ !== 'undefined' ? !!__DEV__ : false;

const INIT_TIMEOUT = 4000;
const AD_TIMEOUT = 120000; // absolute safety net: an ad can never hold the game hostage
// the test build keeps its own save so it never touches real progress
const SAVE_KEY = typeof __TEST__ !== 'undefined' && __TEST__ ? 'eggscape_test_save' : 'eggscape_save';
const SAVE_DEBOUNCE = 500;

const SDK_URL = {
  poki: 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js',
  crazygames: 'https://sdk.crazygames.com/crazygames-sdk-v3.js',
  gamedistribution: 'https://html5.api.gamedistribution.com/main.min.js',
  youtube: 'https://www.youtube.com/game_api/v1',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const safe = (fn, fallback) => { try { return fn(); } catch (e) { return fallback; } };
const log = (...a) => { if (DEV) { try { console.warn('[portal]', ...a); } catch (e) { /* ignore */ } } };

// Resolve with promise result, or `fallback` after ms. Never rejects.
function guard(p, ms, fallback) {
  return new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve(fallback); } }, ms);
    Promise.resolve(p).then(
      (v) => { if (!done) { done = true; clearTimeout(t); resolve(v); } },
      () => { if (!done) { done = true; clearTimeout(t); resolve(fallback); } }
    );
  });
}

function loadScript(src, id, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok) => { if (!settled) { settled = true; resolve(ok); } };
    try {
      const s = document.createElement('script');
      if (id) s.id = id;
      s.async = true;
      s.src = src;
      s.onload = () => finish(true);
      s.onerror = () => finish(false);
      (document.head || document.documentElement).appendChild(s);
    } catch (e) { finish(false); }
    setTimeout(() => finish(false), timeoutMs);
  });
}

// The build injects an async <script id=...> for the SDK. If that tag exists we only wait for
// its global (polling, bounded); if there is no tag (dev / unusual host) we inject one ourselves.
async function ensureGlobal(getter, url, id, ms) {
  if (safe(getter)) return true;
  if (document.getElementById(id)) {
    const end = Date.now() + ms;
    while (Date.now() < end && !window.__sdkFail) { await sleep(50); if (safe(getter)) return true; }
    return false;
  }
  await loadScript(url, id, ms);
  return !!safe(getter);
}

// ---- state -----------------------------------------------------------------
let sdk = null;            // portal SDK object once usable
let initPromise = null;
let wantPlaying = false;   // what the game asked for
let reportedPlaying = false; // what we told the portal
let inputSeen = false;     // Poki wants gameplayStart only after first user input
let adActive = false;
let loadingStarted = false;
let ytReadyDone = false;
let loadingDoneWanted = false;
let cgLoadingSent = false;
let loadingDoneSent = false;
let ytAudioOn = true;
let cgMuted = false;
const pauseReasons = new Set();
const pauseCbs = [];
const resumeCbs = [];
const audioCbs = [];
let lastAudio = true;

function setPaused(reason, on) {
  const before = pauseReasons.size > 0;
  if (on) pauseReasons.add(reason); else pauseReasons.delete(reason);
  const after = pauseReasons.size > 0;
  if (before !== after) {
    const list = after ? pauseCbs : resumeCbs;
    list.slice().forEach((cb) => safe(cb));
  }
}

function audioAllowedNow() { return !(ytAudioOn === false || cgMuted === true); }
function emitAudio() {
  const a = audioAllowedNow();
  if (a !== lastAudio) { lastAudio = a; audioCbs.slice().forEach((cb) => safe(() => cb(a))); }
}

// first user input (for Poki gameplayStart rule)
function watchInput() {
  if (typeof window === 'undefined') return;
  const on = () => {
    inputSeen = true;
    ['pointerdown', 'keydown', 'touchstart', 'mousedown'].forEach((e) => window.removeEventListener(e, on, true));
    syncGameplay();
  };
  ['pointerdown', 'keydown', 'touchstart', 'mousedown'].forEach((e) => window.addEventListener(e, on, true));
}

function syncGameplay() {
  const desired = wantPlaying && !adActive && (NAME !== 'poki' || inputSeen);
  if (desired === reportedPlaying) return;
  if (!sdk) return; // not sent yet: doInit calls this again once the SDK is up
  reportedPlaying = desired;
  if (NAME === 'poki') safe(() => (desired ? sdk.gameplayStart() : sdk.gameplayStop()));
  else if (NAME === 'crazygames') safe(() => (desired ? sdk.game.gameplayStart() : sdk.game.gameplayStop()));
}

// Loading signals may be requested before the SDK is ready (or after a slow init); this replays them.
function applyLoading() {
  if (!sdk) return;
  if (NAME === 'crazygames') {
    if (loadingStarted && !cgLoadingSent) { cgLoadingSent = true; safe(() => sdk.game.loadingStart()); }
    if (loadingDoneWanted && !loadingDoneSent) { loadingDoneSent = true; safe(() => sdk.game.loadingStop()); }
  } else if (NAME === 'poki') {
    if (loadingDoneWanted && !loadingDoneSent) { loadingDoneSent = true; safe(() => sdk.gameLoadingFinished()); }
  } else if (NAME === 'youtube') {
    if (loadingDoneWanted && !ytReadyDone) {
      ytReadyDone = true; loadingDoneSent = true;
      safe(() => sdk.game.firstFrameReady());
      safe(() => sdk.game.gameReady());
    }
  }
}

// ---- per-portal init ---------------------------------------------------------
async function initPoki() {
  if (!(await ensureGlobal(() => window.PokiSDK, SDK_URL.poki, 'poki-sdk', 3000))) return;
  const p = window.PokiSDK;
  if (DEV) safe(() => p.setDebug && p.setDebug(true));
  // init() rejects when an ad blocker is active; Poki's API stays callable (ads are just skipped).
  await Promise.resolve(safe(() => p.init())).then(() => {}, () => {});
  sdk = p;
}

async function initCrazy() {
  const get = () => window.CrazyGames && window.CrazyGames.SDK;
  if (!(await ensureGlobal(get, SDK_URL.crazygames, 'cg-sdk', 3000))) return;
  const S = get();
  await S.init();
  if (S.environment === 'disabled') return; // calls would throw
  sdk = S;
  cgMuted = !!safe(() => S.game.settings.muteAudio, false);
  safe(() => S.game.addSettingsChangeListener((settings) => {
    cgMuted = !!(settings && settings.muteAudio);
    emitAudio();
  }));
  emitAudio();
}

function initGD() {
  return new Promise((resolve) => {
    let done = false;
    const fin = () => { if (!done) { done = true; resolve(); } };
    window.GD_OPTIONS = {
      gameId: GD_ID,
      onEvent: (e) => {
        const n = e && e.name;
        if (n === 'SDK_GAME_PAUSE') setPaused('sys', true);
        else if (n === 'SDK_GAME_START') setPaused('sys', false);
        else if (n === 'SDK_READY') { sdk = window.gdsdk || sdk; fin(); }
        else if (n === 'SDK_REWARDED_WATCH_COMPLETE') gdRewardedGranted = true;
        else if (n === 'SDK_ERROR') fin();
      },
    };
    if (window.gdsdk) { sdk = window.gdsdk; fin(); return; }
    loadScript(SDK_URL.gamedistribution, 'gamedistribution-jssdk', 3500).then((ok) => { if (!ok) fin(); });
    // SDK_READY normally ends this; the outer 4 s race is the final fallback.
  });
}
let gdRewardedGranted = false;

async function initYT() {
  if (typeof ytgame === 'undefined' || !ytgame || !ytgame.IN_PLAYABLES_ENV) {
    if (typeof ytgame === 'undefined' && !(await loadScript(SDK_URL.youtube, 'yt-sdk', 2500))) return;
  }
  const y = typeof ytgame !== 'undefined' ? ytgame : null;
  if (!y || !y.IN_PLAYABLES_ENV) return;
  sdk = y;
  safe(() => y.system.onPause(() => setPaused('sys', true)));
  safe(() => y.system.onResume(() => setPaused('sys', false)));
  ytAudioOn = safe(() => y.system.isAudioEnabled(), true) !== false;
  safe(() => y.system.onAudioEnabledChange((on) => { ytAudioOn = on !== false; emitAudio(); }));
  emitAudio();
}

const hasCloud = () => (NAME === 'youtube' || NAME === 'crazygames') && !!sdk;
async function readCloud() {
  if (!hasCloud()) return null;
  const MISS = {};
  let v = MISS;
  try {
    if (NAME === 'youtube') v = await guard(sdk.game.loadData(), 3000, MISS);
    else v = await guard(Promise.resolve(sdk.data.getItem('save')), 3000, MISS);
  } catch (e) { v = MISS; }
  if (v === MISS) return null; // timed out or failed: stay unread, so no cloud writes this session
  cloudRead = true;
  return v;
}
let gameLoadedSave = false;

async function doInit() {
  watchInput();
  try {
    if (NAME === 'poki') await initPoki();
    else if (NAME === 'crazygames') await initCrazy();
    else if (NAME === 'gamedistribution') await initGD();
    else if (NAME === 'youtube') await initYT();
  } catch (e) {
    log('init failed', e);
    if (NAME !== 'poki') sdk = NAME === 'gamedistribution' ? sdk : null;
  }
  applyLoading();
  syncGameplay();
  // SDK arrived after the game already loaded its save from localStorage: hand the cloud copy over
  if (hasCloud() && !cloudRead && gameLoadedSave) {
    const v = await readCloud();
    if (typeof v === 'string' && v.length) cloudCbs.slice().forEach((cb) => safe(() => cb(v)));
  }
}

// ---- ads ---------------------------------------------------------------------
// Runs `fn` (which performs the portal ad call and resolves when done) between pause/resume.
async function withAd(fn, fallback) {
  if (adActive) return fallback;
  adActive = true;
  syncGameplay();           // Poki/CG: gameplayStop around ads
  setPaused('ad', true);
  let result = fallback;
  try { result = await guard(fn(), AD_TIMEOUT, fallback); } catch (e) { result = fallback; }
  adActive = false;
  setPaused('ad', false);
  if (NAME === 'gamedistribution') setPaused('sys', false); // GD may not send SDK_GAME_START
  syncGameplay();
  return result;
}

function cgAd(type) {
  return new Promise((resolve) => {
    try {
      sdk.ad.requestAd(type, {
        adStarted: () => {},
        adFinished: () => resolve(true),
        adError: () => resolve(false),
      });
    } catch (e) { resolve(false); }
  });
}

// ---- save --------------------------------------------------------------------
let pendingSave = null;
let saveTimer = 0;
// Cloud writes start only after the cloud copy was read; otherwise a slow SDK init would let the
// local save overwrite the player's real cloud progress.
let cloudRead = false;
const cloudCbs = [];

function lsGet() { return safe(() => window.localStorage.getItem(SAVE_KEY), null); }
function lsSet(s) { safe(() => window.localStorage.setItem(SAVE_KEY, s)); }

function writeSave(str) {
  // Always mirror to localStorage (cheap, survives SDK outages), then the portal store.
  lsSet(str);
  try {
    if (!cloudRead) return;
    if (NAME === 'youtube' && sdk) Promise.resolve(safe(() => sdk.game.saveData(str))).catch(() => {});
    else if (NAME === 'crazygames' && sdk) Promise.resolve(safe(() => sdk.data.setItem('save', str))).catch(() => {});
  } catch (e) { /* never throw */ }
}

function flushSave() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = 0; }
  if (pendingSave !== null) { const s = pendingSave; pendingSave = null; writeSave(s); }
}

if (typeof window !== 'undefined') {
  safe(() => window.addEventListener('pagehide', flushSave));
  safe(() => document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); }));
}

// ---- public API --------------------------------------------------------------
export const portal = {
  name: NAME,
  fakeAds: NAME === 'web',
  showMuteButton: NAME !== 'youtube',

  init() {
    if (!initPromise) {
      initPromise = Promise.race([
        doInit().catch((e) => log('init error', e)),
        sleep(INIT_TIMEOUT),
      ]).then(() => undefined, () => undefined);
    }
    return initPromise;
  },

  loadingStart() {
    if (loadingStarted) return;
    loadingStarted = true;
    applyLoading(); // no-op until the SDK is up; replayed by doInit
  },
  loadingDone() {
    loadingDoneWanted = true;
    applyLoading();
  },

  gameplayStart() { wantPlaying = true; syncGameplay(); },
  gameplayStop() { wantPlaying = false; syncGameplay(); },

  async commercialBreak() {
    try {
      if (NAME === 'web' || !sdk) return;
      if (NAME === 'poki') {
        await withAd(() => Promise.resolve(sdk.commercialBreak(() => {})).then(() => true, () => true), true);
      } else if (NAME === 'crazygames') {
        await withAd(() => cgAd('midgame').then(() => true), true);
      } else if (NAME === 'gamedistribution') {
        await withAd(() => Promise.resolve(sdk.showAd()).then(() => true, () => true), true);
      } else if (NAME === 'youtube') {
        await withAd(() => Promise.resolve(sdk.ads.requestInterstitialAd()).then(() => true, () => true), true);
      }
    } catch (e) { /* fail open */ }
  },

  async rewarded(tag) {
    try {
      if (NAME === 'web') { await sleep(1200); return true; }
      if (!sdk) return false;
      if (NAME === 'poki') {
        return (await withAd(() => Promise.resolve(sdk.rewardedBreak({ size: 'small', onStart: () => {} })).then((ok) => ok === true, () => false), false)) === true;
      }
      if (NAME === 'crazygames') {
        return (await withAd(() => cgAd('rewarded'), false)) === true;
      }
      if (NAME === 'gamedistribution') {
        gdRewardedGranted = false;
        await withAd(async () => {
          try { await sdk.preloadAd('rewarded'); } catch (e) { return false; }
          try { await sdk.showAd('rewarded'); } catch (e) { /* reward flag decides */ }
          return true;
        }, false);
        const g = gdRewardedGranted; gdRewardedGranted = false;
        return g;
      }
      if (NAME === 'youtube') {
        return (await withAd(() => Promise.resolve(sdk.ads.requestRewardedAd(String(tag || 'reward'))).then((ok) => ok === true, () => false), false)) === true;
      }
    } catch (e) { /* fall through */ }
    return false;
  },

  happy() {
    if (!sdk) return;
    if (NAME === 'crazygames') safe(() => sdk.game.happytime());
    else if (NAME === 'poki') safe(() => sdk.happyTime && sdk.happyTime(1));
  },

  onPause(cb) { pauseCbs.push(cb); return () => { const i = pauseCbs.indexOf(cb); if (i >= 0) pauseCbs.splice(i, 1); }; },
  onResume(cb) { resumeCbs.push(cb); return () => { const i = resumeCbs.indexOf(cb); if (i >= 0) resumeCbs.splice(i, 1); }; },
  isPaused() { return pauseReasons.size > 0; },

  audioAllowed() { return audioAllowedNow(); },
  onAudioChange(cb) { audioCbs.push(cb); return () => { const i = audioCbs.indexOf(cb); if (i >= 0) audioCbs.splice(i, 1); }; },

  // cb(str) fires if a cloud save turns up after loadSave() had to fall back to localStorage
  onCloudSave(cb) { cloudCbs.push(cb); },

  async loadSave() {
    gameLoadedSave = true;
    try {
      const v = await readCloud();
      if (typeof v === 'string' && v.length) return v;
    } catch (e) { /* fall back to localStorage */ }
    const l = lsGet();
    return typeof l === 'string' && l.length ? l : null;
  },

  save(str) {
    try {
      pendingSave = String(str);
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(flushSave, SAVE_DEBOUNCE);
    } catch (e) { /* never throw */ }
  },

  submitScore(n) {
    try {
      const v = Math.max(0, Math.floor(Number(n)));
      if (!isFinite(v)) return;
      if (NAME === 'youtube' && sdk) Promise.resolve(safe(() => sdk.engagement.sendScore({ value: v }))).catch(() => {});
      // TODO(crazygames): leaderboard submission needs a per-game encryption key; intentionally a no-op.
    } catch (e) { /* ignore */ }
  },
};

export default portal;
