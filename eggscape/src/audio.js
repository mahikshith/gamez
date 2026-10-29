/*
 * Eggscape audio: every sound is synthesized with WebAudio (no audio files).
 *
 *   import { audio } from './audio.js';
 *   audio.unlock();                 // on first user gesture
 *   audio.play('egg_bump', { intensity: 0.7, pan: -0.3 });
 *   audio.music({ root: 'C', scale: 'major', bpm: 112, mood: 'farm' });
 *
 * Signal flow
 *   voices -> [ui | world -> worldFilter(underwater)] -> sfx(toggle) ----\
 *   sfx sends -> sfxVerb ----------------------------------------------> master -> compressor -> soft clip (-1.2 dBFS) -> out
 *   music instances (crossfaded) -> duck -> musicBus(-18 dB, toggle) --/
 *
 * createAudioEngine(ctx) builds an independent engine on any BaseAudioContext
 * (OfflineAudioContext included); tools/audio/render.mjs uses it to render WAVs.
 * Every public method is wrapped so it never throws.
 */

const MAX_VOICES = 24;
const MERGE_WINDOW = 0.03;      // s: same-name plays inside this window merge
const MUSIC_BUS_DB = -18;       // music fader relative to the SFX fader (both feed the limiter)
const XFADE = 1.0;              // s: music crossfade
const LOOKAHEAD = 0.25;         // s: music scheduler horizon
const TICK_MS = 50;
const CEILING = 0.87;           // soft-clip ceiling, about -1.2 dBFS

export const SFX_NAMES = [
  'ui_tap', 'ui_back', 'ui_open', 'grab', 'release',
  'egg_bump', 'egg_crack', 'egg_break', 'egg_save', 'combo',
  'star', 'level_win', 'level_fail', 'unlock',
  'thorn_hit', 'thorn_snap', 'fire_ignite', 'fire_burn', 'steel_on', 'steel_clang',
  'bubble_on', 'bubble_pop', 'twin_hatch', 'portal_enter', 'portal_exit',
  'bomb_fuse', 'bomb_explode', 'glass_crack', 'glass_break', 'rock_hit', 'wood_break',
  'splash', 'lava_sizzle', 'thunder', 'wind_gust', 'motor_tick', 'rewind', 'score_tick', 'countdown', 'squish',
];

export const MATERIALS = ['wood', 'stone', 'ice', 'mushroom', 'glass', 'metal', 'coral', 'vine', 'cloud', 'obsidian', 'bone', 'gold'];

// Sounds that are interface/feedback, not world events: they bypass the underwater filter.
const UI_SOUNDS = new Set(['ui_tap', 'ui_back', 'ui_open', 'combo', 'star', 'level_win', 'level_fail', 'unlock', 'score_tick', 'countdown', 'egg_save', 'rewind']);
// Random pitch spread per sound (fraction). Musical stings stay in tune.
const PITCH_VAR = {
  ui_tap: 0.015, ui_back: 0.01, ui_open: 0.01, score_tick: 0.004, countdown: 0,
  egg_save: 0, combo: 0, star: 0, level_win: 0, level_fail: 0, unlock: 0, rewind: 0.02,
};
const DEFAULT_PITCH_VAR = 0.045;
// Per-sound loudness trim (linear), from the render.mjs level analysis.
const SFX_GAIN = {
  ui_back: 1.4, ui_open: 1.4, egg_crack: 1.6, egg_break: 1.3, egg_save: 1.25, combo: 1.6, star: 1.25,
  thorn_hit: 1.6, bubble_on: 1.6, portal_enter: 1.5, portal_exit: 1.8, twin_hatch: 1.4,
  wind_gust: 2.4, rewind: 2.1, bomb_fuse: 0.7, fire_burn: 1.3,
};

// Surface materials: f/r/d = modal knock (base Hz, partial ratios, decay s), n/nf/nq = contact noise,
// cr = stick-slip creak rate range (Hz), bp/q = creak resonances, cl = creak level,
// ru/rt/rf/rl = grind/rumble noise colour, filter type, freq, level.
const MAT = {
  wood:     { lv: 0.26, f: 380, r: [1, 2.64, 4.2], d: 0.07, n: 0.5, nf: 1600, nq: 1.2, cr: [16, 40], bp: [520, 1150], q: 9, cl: 0.5, ru: 'brown', rt: 'lowpass', rf: 320, rl: 0.35 },
  stone:    { lv: 0.38, f: 240, r: [1, 1.93, 3.2], d: 0.04, n: 0.8, nf: 900, nq: 0.8, cr: [9, 20], bp: [300, 700], q: 4, cl: 0.2, ru: 'brown', rt: 'lowpass', rf: 230, rl: 0.8 },
  ice:      { lv: 0.83, f: 1500, r: [1, 2.9, 5.1], d: 0.12, n: 0.3, nf: 5000, nq: 1.5, cr: [30, 70], bp: [1900, 3100], q: 14, cl: 0.22, ru: 'white', rt: 'highpass', rf: 4500, rl: 0.1 },
  mushroom: { lv: 0.28, f: 170, r: [1, 1.5, 2.2], d: 0.14, n: 0.15, nf: 500, nq: 1, bend: 1, cr: [8, 20], bp: [260, 520], q: 5, cl: 0.45, ru: 'brown', rt: 'lowpass', rf: 200, rl: 0.25 },
  glass:    { lv: 1.6, f: 2100, r: [1, 2.32, 4.25, 6.63], d: 0.22, n: 0.2, nf: 6000, nq: 2, cr: [40, 90], bp: [2600, 3900], q: 22, cl: 0.14, ru: 'white', rt: 'highpass', rf: 6000, rl: 0.05 },
  metal:    { lv: 0.42, f: 560, r: [1, 2.756, 5.404, 8.933], d: 0.4, n: 0.25, nf: 3000, nq: 2, cr: [45, 95], bp: [880, 1460], q: 16, cl: 0.28, ru: 'pink', rt: 'bandpass', rf: 1800, rl: 0.18 },
  coral:    { lv: 0.42, f: 760, r: [1, 2.2, 3.7], d: 0.06, n: 0.7, nf: 2800, nq: 1, cr: [20, 50], bp: [900, 1700], q: 6, cl: 0.25, ru: 'pink', rt: 'bandpass', rf: 1400, rl: 0.35 },
  vine:     { lv: 0.29, f: 230, r: [1, 2.1, 3.3], d: 0.06, n: 0.4, nf: 1100, nq: 1, cr: [12, 30], bp: [420, 900], q: 6, cl: 0.4, ru: 'brown', rt: 'lowpass', rf: 500, rl: 0.3 },
  cloud:    { lv: 4.0, f: 300, r: [1, 1.7], d: 0.05, n: 0.7, nf: 600, nq: 0.6, cr: [0, 0], bp: [500, 900], q: 1, cl: 0, ru: 'pink', rt: 'bandpass', rf: 700, rl: 0.45 },
  obsidian: { lv: 0.53, f: 920, r: [1, 2.45, 4.6], d: 0.1, n: 0.35, nf: 3800, nq: 1.4, cr: [14, 34], bp: [700, 1500], q: 10, cl: 0.25, ru: 'brown', rt: 'lowpass', rf: 260, rl: 0.6 },
  bone:     { lv: 0.41, f: 1050, r: [1, 2.1, 3.9], d: 0.045, n: 0.5, nf: 3200, nq: 1.2, cr: [22, 55], bp: [850, 1900], q: 11, cl: 0.33, ru: 'pink', rt: 'bandpass', rf: 900, rl: 0.15 },
  gold:     { lv: 0.68, f: 820, r: [1, 2.756, 5.404], d: 0.45, n: 0.2, nf: 4000, nq: 2, cr: [40, 85], bp: [1300, 2200], q: 18, cl: 0.24, ru: 'pink', rt: 'bandpass', rf: 2400, rl: 0.12 },
};

// ---------------------------------------------------------------- music theory
const NOTE = { C: 0, 'C#': 1, DB: 1, D: 2, 'D#': 3, EB: 3, E: 4, F: 5, 'F#': 6, GB: 6, G: 7, 'G#': 8, AB: 8, A: 9, 'A#': 10, BB: 10, B: 11 };
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], pentatonic: [0, 2, 4, 7, 9],
};
const PENT = new Set([0, 2, 4, 7, 9]);

// Rhythm templates (onset steps within a 16-step bar)
const RH = {
  bouncy: [[0, 3, 6, 8, 10, 12], [0, 2, 4, 6, 8, 11, 14], [0, 4, 6, 8, 12], [0, 3, 4, 7, 8, 12, 14], [0, 2, 3, 6, 8, 12]],
  sparse: [[0, 6, 8], [0, 8, 12], [2, 8], [0, 10], [0, 4, 12]],
  flowing: [[0, 6, 12], [0, 4, 8, 12], [0, 8, 10], [0, 3, 8, 12], [0, 6, 8, 14]],
  driving: [[0, 2, 4, 6, 8, 10, 12, 14], [0, 3, 6, 8, 11, 14], [0, 4, 8, 10, 12], [0, 2, 3, 6, 8, 10, 12]],
  groove: [[0, 3, 6, 10, 12], [2, 5, 8, 11, 14], [0, 6, 7, 10], [0, 3, 8, 11, 13]],
};

// Mood presets. prog = chord roots as scale degrees (0-based) per section;
// bpc = bars per chord; pattern strings are 16 steps: X accent, x normal, o ghost, . rest.
// Bass tokens: R root, r ghost root, 5 fifth, 3 third, 8 octave, 7 step below, a approach to next chord, - hold.
const PRESETS = {
  happy: {
    scale: 'major', bpm: 112, trim: 1.25, swing: 0, bpc: 1, secBars: 8, form: ['A', 'A', 'B', 'A', 'C'],
    prog: { A: [0, 4, 5, 3], B: [3, 4, 0, 5], C: [5, 3, 0, 4] },
    pad: { in: ['B', 'C', 'I'], lvl: 0.035, cut: 1500, a: 0.5, r: 0.8 },
    comp: { inst: 'pluck', pat: '..x...x...x...x.', lvl: 0.065, in: ['A', 'B'] },
    bass: { inst: 'pluck', pat: 'R...5..rR...5.a.', lvl: 0.34 },
    drums: { in: ['A', 'B'], kick: 'X.......x.......', clap: '....x.......x...', shaker: 'o.x.o.x.o.x.o.xo', lvl: 0.9 },
    lead: { inst: 'marimba', alt: 'pluck', oct: 12, rh: 'bouncy', dens: 0.75, lvl: 0.2, fx: 0.18, in: ['A', 'B'] },
    verb: 0.16, delay: { steps: 3, fb: 0.25, mix: 0.5 },
  },
  calm: {
    scale: 'major', bpm: 92, trim: 0.7, swing: 0, bpc: 1, secBars: 8, form: ['A', 'B', 'A', 'C'],
    prog: { A: [0, 5, 3, 4], B: [3, 0, 4, 5], C: [3, 4, 0, 0] },
    pad: { in: ['A', 'B', 'C', 'I'], lvl: 0.03, cut: 1300, a: 0.8, r: 1.0 },
    comp: { inst: 'pluck', pat: 'x.....x...x.....', lvl: 0.05, in: ['A', 'B'] },
    bass: { inst: 'round', pat: 'R-----5-R-----5-', lvl: 0.3 },
    drums: { in: ['B'], kick: 'x.......x.......', shaker: '..o...o...o...o.', lvl: 0.7 },
    lead: { inst: 'marimba', alt: 'bell', oct: 12, rh: 'flowing', dens: 0.6, lvl: 0.18, fx: 0.22, in: ['A', 'B'] },
    verb: 0.22, delay: { steps: 3, fb: 0.3, mix: 0.5 },
  },
  adventure: {
    scale: 'dorian', bpm: 100, trim: 1.5, swing: 0.08, bpc: 1, secBars: 8, form: ['A', 'A', 'B', 'C', 'A', 'B'],
    prog: { A: [0, 6, 3, 0], B: [2, 3, 4, 3], C: [0, 3, 0, 6] },
    pad: { in: ['B', 'C', 'I'], lvl: 0.03, cut: 1300, a: 0.6, r: 0.9 },
    arp: { inst: 'pluck', pat: 'x.x.x.x.x.x.x.x.', lvl: 0.04, in: ['A', 'B'] },
    bass: { inst: 'pluck', pat: 'R.....R...5.....', lvl: 0.34 },
    drums: { in: ['A', 'B'], kick: 'X.......x..x....', rim: '....x.......x...', shaker: 'o.x.o.x.o.x.o.x.', lvl: 0.85 },
    lead: { inst: 'pluck', alt: 'bell', oct: 12, rh: 'bouncy', dens: 0.6, lvl: 0.18, fx: 0.2, in: ['A', 'B', 'C'] },
    verb: 0.2, delay: { steps: 3, fb: 0.28, mix: 0.5 },
  },
  spooky: {
    scale: 'minor', bpm: 76, trim: 1.1, swing: 0, bpc: 2, secBars: 8, form: ['A', 'B', 'A', 'C'],
    prog: { A: [0, 5, 3, 4], B: [0, 3, 5, 4], C: [5, 4, 0, 0] },
    pad: { in: ['A', 'B', 'C', 'I'], lvl: 0.045, cut: 650, a: 1.6, r: 2.0 },
    bass: { inst: 'sub', pat: 'R-------........', lvl: 0.38 },
    drums: { in: ['B'], kick: 'x..o............', lvl: 0.55 },
    lead: { inst: 'bell', alt: 'bell', oct: 12, rh: 'sparse', dens: 0.45, lvl: 0.13, fx: 0.45, in: ['A', 'B', 'C'] },
    verb: 0.38, delay: { steps: 6, fb: 0.38, mix: 0.6 },
  },
  cave: {
    scale: 'minor', bpm: 84, swing: 0, bpc: 2, secBars: 8, form: ['A', 'B', 'A', 'C'],
    prog: { A: [0, 5, 2, 6], B: [3, 5, 0, 4], C: [5, 6, 0, 0] },
    pad: { in: ['A', 'B', 'C', 'I'], lvl: 0.04, cut: 1900, a: 1.8, r: 2.2, air: true },
    arp: { inst: 'bell', pat: 'x.....x.....x...', lvl: 0.05, in: ['A', 'B', 'C'], rand: true },
    bass: { inst: 'sub', pat: 'R---------------', lvl: 0.3 },
    lead: { inst: 'bell', alt: 'marimba', oct: 12, rh: 'sparse', dens: 0.5, lvl: 0.12, fx: 0.5, in: ['A', 'B'] },
    verb: 0.45, delay: { steps: 6, fb: 0.42, mix: 0.6 },
  },
  desert: {
    scale: 'phrygian', bpm: 96, trim: 1.55, swing: 0.05, bpc: 1, secBars: 8, form: ['A', 'A', 'B', 'C'],
    prog: { A: [0, 1, 0, 6], B: [0, 6, 5, 1], C: [0, 0, 1, 0] },
    drone: { lvl: 0.04 },
    bass: { inst: 'pluck', pat: 'R.....R.R...5...', lvl: 0.3 },
    drums: { in: ['A', 'B', 'C'], dum: 'X.....x.x...x...', tek: '...x..x.....x.x.', shaker: '..o...o...o...o.', lvl: 0.8 },
    lead: { inst: 'oud', alt: 'oud', oct: 12, rh: 'flowing', dens: 0.7, lvl: 0.17, fx: 0.18, in: ['A', 'B'] },
    verb: 0.24, delay: { steps: 3, fb: 0.25, mix: 0.45 },
  },
  underwater: {
    scale: 'lydian', bpm: 88, trim: 1.1, swing: 0, bpc: 1, secBars: 8, form: ['A', 'B', 'A', 'C'],
    prog: { A: [0, 3, 5, 4], B: [5, 3, 4, 0], C: [3, 0, 3, 4] },
    filter: { f: 1100, q: 1.2, depth: 380, rate: 0.09 },
    pad: { in: ['A', 'B', 'C', 'I'], lvl: 0.035, cut: 1600, a: 1.0, r: 1.5 },
    comp: { inst: 'epiano', pat: 'x.....x...x.....', lvl: 0.07, in: ['A', 'B'] },
    arp: { inst: 'bubble', pat: 'x..x..x..x..x...', lvl: 0.04, in: ['A', 'B', 'C'], rand: true },
    bass: { inst: 'round', pat: 'R.....5...R.....', lvl: 0.34 },
    drums: { in: ['A', 'B'], shaker: '..o...o...o...o.', kick: 'x.........x.....', lvl: 0.6 },
    lead: { inst: 'vibes', alt: 'bell', oct: 12, rh: 'flowing', dens: 0.55, lvl: 0.17, fx: 0.3, in: ['A', 'B'] },
    verb: 0.36, delay: { steps: 4, fb: 0.35, mix: 0.5 },
  },
  storm: {
    scale: 'minor', bpm: 120, trim: 1.4, swing: 0, bpc: 1, secBars: 8, form: ['A', 'B', 'A', 'C'],
    prog: { A: [0, 0, 5, 6], B: [3, 3, 0, 4], C: [5, 6, 0, 0] },
    pad: { in: ['A', 'B', 'C', 'I'], lvl: 0.04, cut: 1200, a: 0.6, r: 0.8, trem: true },
    arp: { inst: 'pluck', pat: 'x.x.x.x.x.x.x.x.', lvl: 0.035, in: ['B'] },
    bass: { inst: 'saw', pat: 'R.r.R.r.R.r.R.r.', lvl: 0.26 },
    drums: { in: ['A', 'B'], kick: 'X.......X.......', hat: '..o...o...o...o.', fillTom: true, lvl: 0.85 },
    lead: { inst: 'square', alt: 'bell', oct: 12, rh: 'sparse', dens: 0.5, lvl: 0.12, fx: 0.25, in: ['A', 'C'] },
    verb: 0.3, delay: { steps: 3, fb: 0.3, mix: 0.45 },
  },
  volcano: {
    scale: 'minor', bpm: 132, trim: 0.9, swing: 0, bpc: 1, secBars: 8, form: ['A', 'A', 'B', 'C'],
    prog: { A: [0, 6, 5, 6], B: [5, 6, 0, 0], C: [0, 0, 5, 6] },
    pad: { in: ['B', 'C', 'I'], lvl: 0.035, cut: 1100, a: 0.4, r: 0.6 },
    arp: { inst: 'pluck', pat: 'x.x.x.x.x.x.x.x.', lvl: 0.035, in: ['B', 'C'] },
    bass: { inst: 'saw', pat: 'R.R.R.R5R.R.R.8.', lvl: 0.28 },
    drums: { in: ['A', 'B'], kick: 'X..x..X.X..x....', clap: '....X.......X...', hat: 'o.x.o.x.o.x.o.x.', tom: '.......x......x.', fillTom: true, lvl: 0.9 },
    lead: { inst: 'square', alt: 'square', oct: 12, rh: 'driving', dens: 0.6, lvl: 0.12, fx: 0.15, in: ['A', 'B'] },
    verb: 0.2, delay: { steps: 3, fb: 0.22, mix: 0.4 },
  },
  heist: {
    scale: 'dorian', bpm: 104, trim: 0.8, swing: 0.2, bpc: 1, secBars: 8, form: ['A', 'A', 'B', 'A', 'C'],
    prog: { A: [0, 3, 0, 3], B: [6, 2, 3, 4], C: [0, 0, 3, 3] },
    comp: { inst: 'epiano', pat: '..X...x..x....x.', lvl: 0.07, in: ['A', 'B', 'C'] },
    bass: { inst: 'round', pat: 'R..r..5.8..7..5a', lvl: 0.34 },
    drums: { in: ['A', 'B'], kick: 'X.....x...X.....', clap: '....x.......x...', hat: 'x.ox.xo.x.ox.xox', rim: '..........x....x', lvl: 0.8 },
    lead: { inst: 'vibes', alt: 'pluck', oct: 12, rh: 'groove', dens: 0.6, lvl: 0.15, fx: 0.2, in: ['A', 'B'] },
    verb: 0.2, delay: { steps: 3, fb: 0.25, mix: 0.4 },
  },
};

const MOOD_WORDS = [
  ['happy', ['happy', 'farm', 'barn', 'orchard', 'pumpkin', 'meadow', 'sunny', 'hay', 'bouncy']],
  ['calm', ['calm', 'menu', 'title', 'map', 'gentle', 'relax']],
  ['spooky', ['spooky', 'night', 'haunt', 'grave', 'ghost', 'creepy']],
  ['cave', ['cave', 'crystal', 'frozen', 'ice', 'blizzard', 'snow', 'winter', 'airy']],
  ['desert', ['desert', 'dune', 'pyramid', 'tomb', 'sand', 'egypt']],
  ['underwater', ['underwater', 'coral', 'reef', 'ocean', 'sea', 'water', 'aqua']],
  ['storm', ['storm', 'thunder', 'sky', 'tense', 'rain']],
  ['volcano', ['volcano', 'dragon', 'lava', 'fire', 'driving', 'lair']],
  ['heist', ['heist', 'vault', 'finale', 'fox', 'clock', 'groove']],
  ['adventure', ['adventure', 'wood', 'forest', 'bramble', 'jungle', 'ruin', 'pine', 'mushroom', 'glade', 'pirate', 'cove']],
];
export const MOODS = Object.keys(PRESETS);

function resolveMood(m) {
  const s = String(m || '').toLowerCase();
  if (has(PRESETS, s)) return s;
  for (const [name, words] of MOOD_WORDS) for (const w of words) if (s.includes(w)) return name;
  return 'calm';
}

// ---------------------------------------------------------------- small utils
const has = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const dbToGain = (db) => Math.pow(10, db / 20);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const NOOP_HANDLE = Object.freeze({ stop() {}, duration: 0, playing: false });

// =========================================================================
export function createAudioEngine(externalCtx = null, options = {}) {
  let ctx = null, offline = false, ready = false, failed = false, unlockedOnce = false;
  let sfxOn = true, musicOn = true, paused = false;
  const useLimiter = options.limiter !== false;
  const rand = mulberry32(options.seed != null ? options.seed : (Math.random() * 4294967296) >>> 0);
  const rr = (a, b) => a + (b - a) * rand();
  const N = {};               // shared graph nodes
  const BUF = {};             // generated buffers
  let voices = [];
  const lastPlay = new Map();
  let tickTock = 0;

  const st = { material: 'wood', ring: 0, fire: false, wind: 0, underwater: false };
  const loops = { ring: null, fire: null, wind: null, uw: null };
  let ringIdleSince = 0, windIdleSince = 0, ringIdleTimer = 0, windIdleTimer = 0;

  let musicSpec = null;       // desired spec (kept while music is off)
  let curInst = null;
  let instances = [];
  let schedTimer = null;

  // ------------------------------------------------------------- context
  function ensure() {
    if (ready) return true;
    if (failed) return false;
    try {
      if (externalCtx) ctx = externalCtx;
      else {
        const g = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
        const AC = g.AudioContext || g.webkitAudioContext;
        if (!AC) { failed = true; return false; }
        try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); }
      }
      offline = typeof ctx.startRendering === 'function';
      buildGraph();
      ready = true;
      return true;
    } catch (e) {
      failed = true; ctx = null;
      return false;
    }
  }

  function mkGain(v = 1) { const g = ctx.createGain(); g.gain.value = v; return g; }
  function mkFilter(type, f, q = 0.707) {
    const b = ctx.createBiquadFilter(); b.type = type;
    b.frequency.value = clamp(f, 10, ctx.sampleRate * 0.49); b.Q.value = q; return b;
  }

  function makeNoise(kind, sec = 2) {
    const len = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    const r = mulberry32(kind === 'white' ? 11 : kind === 'pink' ? 23 : 37);
    if (kind === 'white') for (let i = 0; i < len; i++) d[i] = r() * 2 - 1;
    else if (kind === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = r() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      }
    } else {
      let last = 0;
      for (let i = 0; i < len; i++) { last = (last + 0.02 * (r() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    }
    // normalise and fade loop seam
    let pk = 0; for (let i = 0; i < len; i++) pk = Math.max(pk, Math.abs(d[i]));
    const k = 0.95 / (pk || 1); const fade = 256;
    for (let i = 0; i < len; i++) d[i] *= k;
    for (let i = 0; i < fade; i++) { const w = i / fade; d[i] = d[i] * w + d[len - fade + i] * (1 - w); }
    return b;
  }

  function makeIR(sec, decay, damp, seed) {
    const sr = ctx.sampleRate, len = Math.floor(sr * sec);
    const b = ctx.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c), r = mulberry32(seed + c * 101);
      let lp = 0; const pre = Math.floor(sr * 0.012);
      for (let i = 0; i < len; i++) {
        if (i < pre) { d[i] = 0; continue; }
        const x = (i - pre) / (len - pre);
        const a = 0.85 - damp * x;          // brighter early, darker tail
        lp += clamp(a, 0.05, 1) * ((r() * 2 - 1) - lp);
        d[i] = lp * Math.pow(1 - x, decay);
      }
    }
    return b;
  }

  // Sparse crackle texture (fire, fuse, lava)
  function makeCrackle(sec = 4, rate = 26) {
    const sr = ctx.sampleRate, len = Math.floor(sr * sec);
    const b = ctx.createBuffer(1, len, sr); const d = b.getChannelData(0); const r = mulberry32(77);
    let t = 0;
    while (true) {
      t += -Math.log(1 - r()) / rate; const i0 = Math.floor(t * sr); if (i0 >= len - 400) break;
      const a = Math.pow(r(), 2.2) * (r() < 0.12 ? 1 : 0.45);
      const L = Math.floor(sr * (0.0006 + r() * 0.004));
      const tau = L / 4;
      for (let i = 0; i < L; i++) d[i0 + i] += (r() * 2 - 1) * a * Math.exp(-i / tau);
    }
    return b;
  }

  // Bubble texture for underwater ambience
  function makeBubbles(sec = 6) {
    const sr = ctx.sampleRate, len = Math.floor(sr * sec);
    const b = ctx.createBuffer(1, len, sr); const d = b.getChannelData(0); const r = mulberry32(91);
    let t = 0.2;
    while (t < sec - 0.3) {
      const f0 = 500 + r() * 1100, L = Math.floor(sr * (0.03 + r() * 0.05)), i0 = Math.floor(t * sr);
      const a = 0.15 + r() * 0.35; let ph = 0;
      for (let i = 0; i < L; i++) {
        const x = i / L; const f = f0 * (1 + 1.6 * x * x);
        ph += 2 * Math.PI * f / sr; d[i0 + i] += Math.sin(ph) * a * Math.sin(Math.PI * Math.min(1, x * 6)) * (1 - x);
      }
      t += 0.05 + r() * (r() < 0.25 ? 0.08 : 0.9);
    }
    return b;
  }

  function buf(name) {
    if (BUF[name]) return BUF[name];
    if (name === 'crackle') BUF[name] = makeCrackle();
    else if (name === 'bubbles') BUF[name] = makeBubbles();
    else BUF[name] = makeNoise(name);
    return BUF[name];
  }

  function softClipCurve() {
    const n = 2048, c = new Float32Array(n), lin = 0.7, room = CEILING - lin;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1, a = Math.abs(x);
      const y = a <= lin ? a : lin + room * Math.tanh((a - lin) / room);
      c[i] = Math.sign(x) * y;
    }
    return c;
  }
  function satCurve(k = 2.2) {
    const n = 1024, c = new Float32Array(n), norm = Math.tanh(k);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * k) / norm; }
    return c;
  }

  function buildGraph() {
    N.master = mkGain(1);
    if (useLimiter) {
      const c = ctx.createDynamicsCompressor();
      // Safety limiter: transparent below about -7 dBFS. The spec'd DynamicsCompressor adds automatic
      // make-up gain (+2.9 dB for these settings), which N.post cancels so quiet sounds pass at unity.
      c.threshold.value = -6; c.knee.value = 3; c.ratio.value = 20; c.attack.value = 0.002; c.release.value = 0.15;
      N.comp = c;
      N.post = mkGain(dbToGain(-2.9));
      N.clip = ctx.createWaveShaper(); N.clip.curve = softClipCurve(); N.clip.oversample = 'none';
      N.master.connect(c); c.connect(N.post); N.post.connect(N.clip); N.clip.connect(ctx.destination);
    } else N.master.connect(ctx.destination);

    N.sfx = mkGain(sfxOn ? 1 : 0); N.sfx.connect(N.master);
    N.ui = mkGain(1); N.ui.connect(N.sfx);
    N.world = mkGain(1);
    N.wf = mkFilter('lowpass', ctx.sampleRate / 2, 0.5);
    N.world.connect(N.wf); N.wf.connect(N.sfx);
    N.sv = ctx.createConvolver(); N.sv.buffer = makeIR(1.1, 3.2, 0.6, 5);
    N.svOut = mkGain(0.55); N.sv.connect(N.svOut); N.svOut.connect(N.sfx);

    N.mIn = mkGain(1);
    N.duck = mkGain(1);
    N.mBus = mkGain(musicOn ? dbToGain(MUSIC_BUS_DB) : 0);
    N.mIn.connect(N.duck); N.duck.connect(N.mBus); N.mBus.connect(N.master);
    N.mVerb = ctx.createConvolver(); N.mVerb.buffer = makeIR(2.8, 2.6, 0.75, 9);
    N.mVerbOut = mkGain(0.7); N.mVerb.connect(N.mVerbOut); N.mVerbOut.connect(N.duck);
    N.sat = satCurve();
  }

  function now() { return ctx.currentTime; }
  function ramp(param, v, tau = 0.05) {
    const t = now(); param.cancelScheduledValues(t); param.setTargetAtTime(v, t, tau);
  }

  // ------------------------------------------------------------- voice primitives
  // A voice owns an output gain -> panner -> bus; builders add nodes relative to v.t.
  function newVoice(name, o, dest) {
    const t = now() + (offline ? 0.005 : 0.003);
    const out = mkGain(o.vol * (SFX_GAIN[name] || 1));
    let pan = null;
    if (ctx.createStereoPanner) { pan = ctx.createStereoPanner(); pan.pan.value = clamp(o.pan, -1, 1); out.connect(pan); pan.connect(dest); }
    else out.connect(dest);
    return { name, t, end: t, out, pan, srcs: [], nodes: [], done: false, o };
  }
  function vg(v, val = 0) { const g = mkGain(val); v.nodes.push(g); return g; }
  function vf(v, type, f, q) { const b = mkFilter(type, f, q); v.nodes.push(b); return b; }
  function vsrc(v, node, t0, t1, offset) {
    if (offset != null) node.start(t0, offset); else node.start(t0);
    node.stop(t1); v.srcs.push(node); if (t1 > v.end) v.end = t1; return node;
  }
  const fc = (f) => clamp(f, 1, ctx.sampleRate * 0.45);
  function vosc(v, type, f, t0, t1) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = fc(f); return vsrc(v, o, t0, t1); }
  function vnoise(v, color, t0, t1, rate = 1) {
    const s = ctx.createBufferSource(); s.buffer = buf(color); s.loop = true; s.playbackRate.value = rate;
    return vsrc(v, s, t0, t1, rand() * s.buffer.duration * 0.9);
  }
  // Envelope: linear (or exp) attack, optional hold, exponential decay to -60 dB.
  function env(param, t0, a, peak, hold, d, expA) {
    peak = Math.max(peak, 1e-4);
    if (expA) { param.setValueAtTime(peak * 0.001, t0); param.exponentialRampToValueAtTime(peak, t0 + Math.max(a, 0.001)); }
    else { param.setValueAtTime(0, t0); param.linearRampToValueAtTime(peak, t0 + Math.max(a, 0.0003)); }
    const td = t0 + Math.max(a, 0.0003) + (hold || 0);
    if (hold) param.setValueAtTime(peak, td);
    param.exponentialRampToValueAtTime(peak * 0.001, td + Math.max(d, 0.002));
    param.setValueAtTime(0, td + Math.max(d, 0.002) + 0.001);
    return td + d + 0.002;
  }
  function sweep(param, t0, pts) {   // pts: [[dt, value], ...] exponential segments
    param.setValueAtTime(fc(pts[0][1]), t0 + pts[0][0]);
    for (let i = 1; i < pts.length; i++) param.exponentialRampToValueAtTime(fc(pts[i][1]), t0 + pts[i][0]);
  }
  function send(v, amt) { const g = vg(v, amt); v.out.connect(g); g.connect(N.sv); }

  // tone: oscillator with optional glide / frequency points / filter
  function tone(v, p) {
    const type = p.type || 'sine', t0 = v.t + (p.t || 0), a = p.a != null ? p.a : 0.002, d = p.d != null ? p.d : 0.15;
    const tEnd = t0 + a + (p.hold || 0) + d + 0.01;
    const o = vosc(v, type, p.f, t0, tEnd + 0.01);
    if (p.det) o.detune.value = p.det;
    if (p.fp) sweep(o.frequency, t0, p.fp);
    else if (p.f2) { o.frequency.setValueAtTime(fc(p.f), t0); o.frequency.exponentialRampToValueAtTime(fc(p.f2), t0 + (p.gl || a + d)); }
    if (p.vib) {
      const l = vosc(v, 'sine', p.vib[0], t0, tEnd + 0.01), lg = vg(v, p.f * p.vib[1]);
      l.connect(lg); lg.connect(o.frequency);
    }
    const amp = vg(v, 0);
    env(amp.gain, t0, a, p.g != null ? p.g : 0.3, p.hold, d, p.expA);
    let node = o;
    if (p.lp) { const f = vf(v, 'lowpass', p.lp, p.lq || 0.7); o.connect(f); node = f; }
    node.connect(amp); amp.connect(p.to || v.out);
    return { o, amp, t0, tEnd };
  }

  // nz: filtered noise burst
  function nz(v, p) {
    const t0 = v.t + (p.t || 0), a = p.a != null ? p.a : 0.001, d = p.d != null ? p.d : 0.1;
    const tEnd = t0 + a + (p.hold || 0) + d + 0.01;
    const s = vnoise(v, p.color || 'white', t0, tEnd + 0.01, p.rate || 1);
    let node = s;
    if (p.type) {
      const f = vf(v, p.type, p.f || 1000, p.q != null ? p.q : 0.8);
      if (p.fp) sweep(f.frequency, t0, p.fp);
      else if (p.f2) { f.frequency.setValueAtTime(fc(p.f), t0); f.frequency.exponentialRampToValueAtTime(fc(p.f2), t0 + (p.sw || a + d)); }
      node.connect(f); node = f;
    }
    if (p.type2) { const f2 = vf(v, p.type2, p.f3 || 1000, p.q2 || 0.7); node.connect(f2); node = f2; }
    const amp = vg(v, 0);
    env(amp.gain, t0, a, p.g != null ? p.g : 0.3, p.hold, d, p.expA);
    node.connect(amp); amp.connect(p.to || v.out);
    return { s, amp, t0, tEnd };
  }

  // modal: struck object as a sum of decaying sine partials
  function modal(v, p) {
    const ratios = p.r || [1], n = ratios.length;
    for (let i = 0; i < n; i++) {
      const amp = p.amps ? p.amps[i] : 1 / (1 + i * 0.7);
      const dec = (p.d || 0.1) * (p.decs ? p.decs[i] : 1 / Math.sqrt(1 + i * 0.8));
      tone(v, { t: p.t, f: p.f * ratios[i] * (i ? rr(0.995, 1.005) : 1), a: p.a || 0.0008, d: dec, g: (p.g || 0.2) * amp, to: p.to });
    }
  }

  // bell: harmonic-ish chime partials
  function bell(v, p) {
    modal(v, { t: p.t, f: p.f, r: [1, 2.0, 3.01, 4.17], amps: [1, 0.32, 0.14, 0.07], decs: [1, 0.6, 0.4, 0.25], d: p.d || 0.8, g: p.g, a: 0.002, to: p.to });
  }

  // pings: random short sine tinkles
  function pings(v, p) {
    for (let i = 0; i < p.n; i++) {
      const x = Math.pow(rand(), p.curve || 1.6);
      tone(v, { t: (p.t || 0) + x * p.dur, f: rr(p.fmin, p.fmax), a: 0.0005, d: rr(p.dmin, p.dmax), g: p.g * (1 - x * (p.fade != null ? p.fade : 0.6)) * rr(0.5, 1), to: p.to });
    }
  }

  // grains: many short noise bursts using ONE source/filter/gain (cheap crackles & crunches)
  function grains(v, p) {
    const t0 = v.t + (p.t || 0), times = [];
    for (let i = 0; i < p.n; i++) times.push(Math.pow(rand(), p.curve || 1) * p.dur);
    times.sort((a, b) => a - b);
    for (let i = 1; i < times.length; i++) if (times[i] < times[i - 1] + 0.0015) times[i] = times[i - 1] + 0.0015;
    const tEnd = t0 + times[times.length - 1] + p.decay * 6 + 0.01;
    const s = vnoise(v, p.color || 'white', t0, tEnd);
    const f = vf(v, p.type || 'bandpass', p.fmin, p.q != null ? p.q : 1.2);
    const amp = vg(v, 0);
    for (let i = 0; i < times.length; i++) {
      const ti = t0 + times[i], ai = p.g * rr(0.35, 1) * (1 - (times[i] / p.dur) * (p.fade != null ? p.fade : 0.5));
      f.frequency.setValueAtTime(fc(rr(p.fmin, p.fmax)), ti);
      amp.gain.setValueAtTime(0, ti);
      amp.gain.linearRampToValueAtTime(ai, ti + 0.0004);
      amp.gain.setTargetAtTime(0, ti + 0.0004, p.decay * rr(0.6, 1.4) / 2.5);
    }
    s.connect(f); f.connect(amp); amp.connect(p.to || v.out);
  }

  // ------------------------------------------------------------- SFX designs
  const SFX = {
    ui_tap(v, o) {
      const p = o.p;
      tone(v, { f: 1250 * p, f2: 820 * p, gl: 0.03, a: 0.001, d: 0.05, g: 0.3 });
      tone(v, { type: 'triangle', f: 2500 * p, a: 0.0005, d: 0.018, g: 0.06 });
      nz(v, { a: 0.0005, d: 0.01, g: 0.1, type: 'highpass', f: 4000 });
    },
    ui_back(v, o) {
      const p = o.p;
      nz(v, { color: 'pink', a: 0.01, d: 0.12, g: 0.05, type: 'bandpass', f: 3000, f2: 900, q: 1.2 });
      tone(v, { type: 'triangle', f: 784 * p, a: 0.003, d: 0.08, g: 0.2, lp: 3000 });
      tone(v, { type: 'triangle', f: 587.3 * p, t: 0.065, a: 0.003, d: 0.14, g: 0.22, lp: 2500 });
      tone(v, { f: 1568 * p, d: 0.03, g: 0.035 });
    },
    ui_open(v, o) {
      const p = o.p;
      nz(v, { color: 'pink', a: 0.06, d: 0.12, g: 0.06, type: 'bandpass', f: 600, f2: 3500, sw: 0.15, q: 1.3 });
      bell(v, { t: 0.02, f: 659.3 * p, d: 0.3, g: 0.14 });
      bell(v, { t: 0.09, f: 987.8 * p, d: 0.4, g: 0.15 });
    },
    grab(v, o) {
      const p = o.p, m = MAT[st.material];
      tone(v, { f: 230 * p, f2: 140 * p, gl: 0.05, a: 0.002, d: 0.07, g: 0.34 });
      nz(v, { color: 'pink', a: 0.0005, d: 0.02, g: 0.26, type: 'bandpass', f: 1800 * p, q: 1.8 });
      tone(v, { type: 'triangle', f: 1100 * p, a: 0.0005, d: 0.015, g: 0.05 });
      modal(v, { f: m.f * p, r: m.r, d: Math.min(m.d, 0.12) * 0.6, g: 0.07 });
    },
    release(v, o) {
      const p = o.p;
      tone(v, { f: 180 * p, f2: 120 * p, gl: 0.04, a: 0.002, d: 0.05, g: 0.22 });
      nz(v, { color: 'pink', a: 0.0008, d: 0.03, g: 0.12, type: 'lowpass', f: 1400 * p });
      tone(v, { type: 'triangle', f: 760 * p, a: 0.0005, d: 0.012, g: 0.035 });
    },
    egg_bump(v, o) {
      const p = o.p, i = o.i, m = MAT[st.material], lvl = 0.12 + 0.55 * i;
      // hollow shell
      modal(v, { f: rr(1650, 1900) * p, r: [1, 1.58, 2.37], amps: [1, 0.6, 0.35], d: 0.02 + 0.025 * i, g: lvl * 0.3 });
      // egg body thump
      tone(v, { f: 190 * p, f2: 95 * p, gl: 0.05, a: 0.0015, d: 0.05 + 0.06 * i, g: lvl * 0.75 });
      // surface material
      modal(v, { f: m.f * rr(0.95, 1.05), r: m.r, d: m.d * (0.5 + 0.6 * i), g: lvl * 0.3 });
      nz(v, { color: 'pink', a: 0.0006, d: 0.008 + 0.025 * i, g: lvl * m.n * 0.55, type: 'bandpass', f: m.nf * (0.6 + 0.6 * i), q: m.nq });
      if (m.bend) tone(v, { f: m.f * 1.7 * p, f2: m.f * 0.9 * p, gl: 0.09, a: 0.003, d: 0.12, g: lvl * 0.35 });
    },
    egg_crack(v, o) {
      const p = o.p, n = 3 + Math.floor(rand() * 3);
      let t = 0;
      for (let k = 0; k < n; k++) {
        nz(v, { t, a: 0.0003, d: rr(0.004, 0.012), g: rr(0.25, 0.42) * (k ? 0.75 : 1), type: 'bandpass', f: rr(2500, 6000) * p, q: 1.5 });
        t += rr(0.004, 0.018);
      }
      modal(v, { f: rr(2100, 2500) * p, r: [1, 1.47, 2.09], d: 0.045, g: 0.16 });
      nz(v, { a: 0.0008, d: 0.05, g: 0.16, type: 'highpass', f: 1800 });
      tone(v, { f: 320 * p, f2: 180 * p, gl: 0.03, d: 0.04, g: 0.12 });
    },
    egg_break(v, o) {
      const p = o.p;
      nz(v, { d: 0.012, g: 0.42, type: 'highpass', f: 2500 });
      grains(v, { t: 0.002, dur: 0.13, n: 16, type: 'bandpass', fmin: 1800 * p, fmax: 6000 * p, q: 1.4, g: 0.42, decay: 0.008 });
      modal(v, { f: 2000 * p, r: [1, 1.52, 2.3], d: 0.05, g: 0.13 });
      // wet splat
      nz(v, { t: 0.015, color: 'pink', a: 0.004, d: 0.24, g: 0.42, type: 'lowpass', f: 2400, f2: 260, sw: 0.18, q: 2.2 });
      tone(v, { t: 0.012, f: 260 * p, f2: 70 * p, gl: 0.12, d: 0.16, g: 0.32 });
      nz(v, { t: 0.09, color: 'pink', d: 0.12, g: 0.14, type: 'bandpass', f: 900, f2: 450, q: 3 });
      pings(v, { t: 0.13, dur: 0.35, n: 5, fmin: 3000, fmax: 6500, g: 0.05, dmin: 0.02, dmax: 0.06 });
    },
    egg_save(v, o) {
      const f = 1046.5 * o.pitch;
      tone(v, { f: 140, f2: 75, gl: 0.1, a: 0.004, d: 0.16, g: 0.4 });
      grains(v, { dur: 0.12, n: 10, type: 'bandpass', fmin: 2500, fmax: 5000, q: 0.8, g: 0.12, decay: 0.012 });
      bell(v, { t: 0.05, f, d: 0.9, g: 0.2 });
      bell(v, { t: 0.11, f: f * 1.5, d: 0.8, g: 0.15 });
      tone(v, { t: 0.05, f: f * 4, d: 0.12, g: 0.025 });
      send(v, 0.3);
    },
    combo(v, o) {
      const i = o.i, steps = 3 + Math.round(i * 2), base = 1318.5 * Math.pow(2, Math.round(i * 4) / 12) * o.pitch;
      const iv = [0, 4, 7, 12, 16];
      for (let k = 0; k < steps; k++) {
        const f = base * Math.pow(2, iv[k] / 12) * 0.75;
        const last = k === steps - 1;
        bell(v, { t: k * 0.055, f, d: last ? 0.7 : 0.25, g: last ? 0.17 : 0.12 });
      }
      nz(v, { a: 0.12, d: 0.35, g: 0.05 + 0.03 * i, type: 'highpass', f: 5000, f2: 9000, sw: 0.4 });
      pings(v, { t: steps * 0.055, dur: 0.3, n: 3 + steps, fmin: 4000, fmax: 8000, g: 0.04, dmin: 0.03, dmax: 0.1 });
      send(v, 0.3);
    },
    star(v, o) {
      const idx = o.i < 0.25 ? 0 : o.i < 0.75 ? 1 : 2, f = [1046.5, 1318.5, 1568][idx] * o.pitch;
      tone(v, { f: 300, f2: 620, gl: 0.08, a: 0.005, d: 0.1, g: 0.12 });
      bell(v, { t: 0.02, f, d: 0.9, g: 0.17 });
      bell(v, { t: 0.02, f: f * 1.5, d: 0.6, g: 0.07 });
      bell(v, { t: 0.02, f: f * 2, d: 0.5, g: 0.05 });
      pings(v, { t: 0.06, dur: 0.35, n: 3 + idx * 2, fmin: f * 2.5, fmax: f * 5, g: 0.04, dmin: 0.03, dmax: 0.09 });
      nz(v, { a: 0.03, d: 0.3, g: 0.035 + idx * 0.01, type: 'highpass', f: 6000 });
      send(v, 0.3);
    },
    level_win(v, o) {
      const p = o.pitch, C5 = 523.25 * p;
      const brass = (t, f, hold, g) => {
        for (const det of [-7, 7]) {
          const r = tone(v, { type: 'sawtooth', t, f, det, a: 0.03, hold, d: 0.35, g, lp: f * 3, lq: 1.2 });
          r.o.frequency.setValueAtTime(f * 0.985, v.t + t); r.o.frequency.exponentialRampToValueAtTime(f, v.t + t + 0.04);
        }
      };
      const n = [[0, 0.75], [0.13, 1], [0.26, 1.26], [0.39, 1.5]];
      for (const [t, k] of n) brass(t, C5 * k, 0.07, 0.07);
      brass(0.6, C5 * 1.5, 0.95, 0.06);
      brass(0.6, C5 * 1.26, 0.95, 0.05);
      brass(0.6, C5, 0.95, 0.06);
      brass(0.6, C5 * 0.5, 0.95, 0.05);
      tone(v, { f: 110, f2: 55, gl: 0.15, d: 0.3, g: 0.35 });
      tone(v, { t: 0.6, f: 120, f2: 50, gl: 0.2, d: 0.45, g: 0.45 });
      nz(v, { t: 0.6, a: 0.005, d: 1.3, g: 0.07, type: 'highpass', f: 6000 });
      [2, 2.52, 3, 4].forEach((k, j) => bell(v, { t: 0.62 + j * 0.07, f: C5 * k, d: 0.9, g: 0.07 }));
      pings(v, { t: 0.9, dur: 0.8, n: 8, fmin: 3000, fmax: 7000, g: 0.035, dmin: 0.05, dmax: 0.15 });
      send(v, 0.28);
    },
    level_fail(v, o) {
      const p = o.pitch;
      const ep = (t, f, d, g) => {
        tone(v, { t, f, a: 0.006, d, g, lp: 2200 });
        tone(v, { t, f: f * 2, a: 0.004, d: d * 0.4, g: g * 0.25 });
      };
      ep(0, 622.25 * p, 0.45, 0.16);      // Eb5
      ep(0.2, 523.25 * p, 0.45, 0.15);    // C5
      ep(0.4, 415.3 * p, 0.6, 0.15);      // Ab4
      for (const f of [261.63, 311.13, 392]) tone(v, { type: 'triangle', t: 0.62, f: f * p, a: 0.08, hold: 0.25, d: 0.7, g: 0.08, lp: 900 });
      tone(v, { t: 0.62, f: 130.8 * p, a: 0.05, hold: 0.2, d: 0.7, g: 0.16 });
      send(v, 0.25);
    },
    unlock(v, o) {
      const p = o.pitch, f = 1046.5 * p;
      nz(v, { color: 'pink', a: 0.42, d: 0.08, g: 0.12, type: 'bandpass', f: 400, f2: 4500, sw: 0.48, q: 2, expA: true });
      tone(v, { f: 400 * p, f2: 1600 * p, gl: 0.45, a: 0.4, d: 0.08, g: 0.05, expA: true });
      tone(v, { t: 0.45, f: 160, f2: 80, gl: 0.12, d: 0.2, g: 0.3 });
      [1, 1.26, 1.5, 1.89].forEach((k, j) => bell(v, { t: 0.45 + j * 0.035, f: f * k, d: 1.0, g: 0.09 }));
      pings(v, { t: 0.5, dur: 0.6, n: 7, fmin: 3500, fmax: 8000, g: 0.04, dmin: 0.04, dmax: 0.12 });
      send(v, 0.35);
    },
    thorn_hit(v, o) {
      const p = o.p;
      nz(v, { d: 0.007, g: 0.4, type: 'highpass', f: 5000 });
      nz(v, { a: 0.002, d: 0.09, g: 0.24, type: 'bandpass', f: 2600 * p, f2: 1300 * p, q: 3 });
      tone(v, { f: 400 * p, f2: 200 * p, gl: 0.04, d: 0.05, g: 0.18 });
      grains(v, { t: 0.004, dur: 0.05, n: 4, fmin: 3000, fmax: 5200, q: 2, g: 0.2, decay: 0.005 });
    },
    thorn_snap(v, o) {
      const p = o.p;
      nz(v, { d: 0.005, g: 0.5, type: 'highpass', f: 3000 });
      grains(v, { t: 0.004, dur: 0.045, n: 6, fmin: 1200 * p, fmax: 3500 * p, q: 2, g: 0.32, decay: 0.006 });
      modal(v, { f: 1400 * p, r: [1, 2.6, 4.1], d: 0.03, g: 0.14 });
      modal(v, { t: 0.002, f: 2600 * p, r: [1, 2.756, 5.404], d: 0.16, g: 0.05 });
    },
    fire_ignite(v, o) {
      const p = o.p;
      nz(v, { color: 'pink', a: 0.03, d: 0.55, g: 0.42, type: 'lowpass', f: 250, f2: 3200 * p, sw: 0.12, q: 1 });
      tone(v, { f: 90, f2: 55, gl: 0.25, a: 0.02, d: 0.25, g: 0.3 });
      nz(v, { a: 0.05, d: 0.4, g: 0.05, type: 'highpass', f: 2500 });
      grains(v, { t: 0.08, dur: 0.5, n: 14, fmin: 1500, fmax: 5000, g: 0.18, decay: 0.006 });
    },
    fire_burn(v, o) {
      const p = o.p;
      nz(v, { a: 0.02, d: 0.6, g: 0.05, type: 'highpass', f: 2200 * p });
      nz(v, { color: 'brown', a: 0.05, d: 0.6, g: 0.4, type: 'lowpass', f: 480 });
      grains(v, { dur: 0.8, n: 34, fmin: 700 * p, fmax: 3200 * p, q: 1.2, g: 0.34, decay: 0.006 });
      for (let k = 0; k < 3; k++) modal(v, { t: rr(0.05, 0.6), f: rr(480, 820), r: MAT.wood.r, d: 0.03, g: 0.07 });
    },
    steel_on(v, o) {
      const p = o.p;
      nz(v, { a: 0.07, d: 0.2, g: 0.07, type: 'highpass', f: 4000, f2: 9000, sw: 0.25, expA: true });
      modal(v, { t: 0.07, f: 520 * p, r: [1, 2.756, 5.404, 8.933], amps: [1, 0.6, 0.4, 0.2], d: 0.6, g: 0.2 });
      tone(v, { t: 0.07, f: 160 * p, f2: 90 * p, gl: 0.06, d: 0.1, g: 0.28 });
      nz(v, { t: 0.07, d: 0.02, g: 0.28, type: 'bandpass', f: 2500, q: 1.5 });
      modal(v, { t: 0.17, f: 780 * p, r: [1, 2.756, 5.404], d: 0.3, g: 0.07 });
      nz(v, { t: 0.17, d: 0.012, g: 0.12, type: 'bandpass', f: 3500, q: 2 });
    },
    steel_clang(v, o) {
      const p = o.p, i = o.i, lvl = 0.12 + 0.5 * i, f = rr(430, 470) * p;
      modal(v, { f, r: [1, 1.004, 2.756, 5.404, 8.933, 13.34], amps: [1, 0.7, 0.55, 0.35, 0.2, 0.1], d: 0.35 + 0.4 * i, g: lvl * 0.28 });
      nz(v, { d: 0.015, g: lvl * 0.4, type: 'bandpass', f: 3000, q: 1.2 });
      tone(v, { f: 150 * p, f2: 80 * p, gl: 0.05, d: 0.08, g: lvl * 0.4 });
    },
    bubble_on(v, o) {
      const p = o.p;
      tone(v, { f: 280 * p, f2: 900 * p, gl: 0.18, a: 0.01, d: 0.22, g: 0.24 });
      tone(v, { t: 0.08, f: 600 * p, f2: 1500 * p, gl: 0.1, a: 0.005, d: 0.12, g: 0.1 });
      for (let k = 0; k < 4; k++) { const f = rr(800, 1600) * p, t = rr(0.15, 0.4); tone(v, { t, f, f2: f * 1.8, gl: 0.03, a: 0.002, d: 0.04, g: 0.06 }); }
      tone(v, { type: 'triangle', t: 0.12, f: 2093 * p, a: 0.01, d: 0.3, g: 0.03 });
      send(v, 0.2);
    },
    bubble_pop(v, o) {
      const p = o.p;
      tone(v, { f: 900 * p, f2: 2600 * p, gl: 0.012, a: 0.0005, d: 0.03, g: 0.36 });
      nz(v, { d: 0.008, g: 0.28, type: 'highpass', f: 3000 });
      for (let k = 0; k < 3; k++) { const f = rr(2000, 3500); tone(v, { t: rr(0.02, 0.1), f, f2: f * 1.4, gl: 0.015, d: 0.02, g: 0.06 }); }
    },
    twin_hatch(v, o) {
      const p = o.p;
      tone(v, { f: 500 * p, f2: 1200 * p, gl: 0.02, a: 0.001, d: 0.045, g: 0.28 });
      nz(v, { d: 0.006, g: 0.22, type: 'highpass', f: 2500 });
      grains(v, { t: 0.002, dur: 0.04, n: 4, fmin: 2500, fmax: 5000, g: 0.16, decay: 0.005 });
      const chirp = (t, k) => tone(v, { t, f: 2400 * k * p, fp: [[0, 2400 * k * p], [0.03, 3600 * k * p], [0.075, 3000 * k * p]], a: 0.006, d: 0.07, g: 0.12, vib: [38, 0.02] });
      chirp(0.08, 1); chirp(0.2, 1.12);
      send(v, 0.15);
    },
    portal_enter(v, o) {
      const p = o.p;
      if (v.pan) { const b = clamp(o.pan, -1, 1); v.pan.pan.setValueAtTime(clamp(b - 0.5, -1, 1), v.t); v.pan.pan.linearRampToValueAtTime(clamp(b + 0.5, -1, 1), v.t + 0.6); }
      nz(v, { color: 'pink', a: 0.25, d: 0.4, g: 0.36, type: 'bandpass', f: 300 * p, f2: 2800 * p, sw: 0.5, q: 2.5 });
      tone(v, { f: 900 * p, f2: 220 * p, gl: 0.6, a: 0.05, d: 0.55, g: 0.08, vib: [9, 0.04] });
      tone(v, { t: 0.5, f: 120, f2: 60, gl: 0.1, d: 0.15, g: 0.24 });
      send(v, 0.25);
    },
    portal_exit(v, o) {
      const p = o.p;
      if (v.pan) { const b = clamp(o.pan, -1, 1); v.pan.pan.setValueAtTime(clamp(b + 0.5, -1, 1), v.t); v.pan.pan.linearRampToValueAtTime(clamp(b - 0.5, -1, 1), v.t + 0.5); }
      nz(v, { color: 'pink', a: 0.45, d: 0.04, g: 0.36, type: 'bandpass', f: 2800 * p, f2: 350 * p, sw: 0.47, q: 2.5, expA: true });
      tone(v, { f: 220 * p, f2: 900 * p, gl: 0.45, a: 0.45, d: 0.05, g: 0.08, vib: [9, 0.04], expA: true });
      tone(v, { t: 0.45, f: 300 * p, f2: 900 * p, gl: 0.03, d: 0.05, g: 0.2 });
      send(v, 0.2);
    },
    bomb_fuse(v, o) {
      const p = o.p, dur = 2.5, t0 = v.t, tEnd = t0 + dur;
      // hiss with sputtering band
      const s = vnoise(v, 'white', t0, tEnd + 0.05);
      const bp = vf(v, 'bandpass', 5200 * p, 1.4);
      const lfo = vosc(v, 'sine', 7.3, t0, tEnd + 0.05), lg = vg(v, 900);
      lfo.connect(lg); lg.connect(bp.frequency);
      const hissAmp = vg(v, 0);
      hissAmp.gain.setValueAtTime(0, t0); hissAmp.gain.linearRampToValueAtTime(0.13, t0 + 0.06);
      hissAmp.gain.linearRampToValueAtTime(0.19, tEnd - 0.05); hissAmp.gain.linearRampToValueAtTime(0, tEnd);
      s.connect(bp); bp.connect(hissAmp); hissAmp.connect(v.out);
      // sparks
      const c = ctx.createBufferSource(); c.buffer = buf('crackle'); c.loop = true; vsrc(v, c, t0, tEnd + 0.05, rand() * 3);
      const hp = vf(v, 'highpass', 2200, 0.7), ca = vg(v, 0);
      ca.gain.setValueAtTime(0, t0); ca.gain.linearRampToValueAtTime(0.35, t0 + 0.05);
      ca.gain.linearRampToValueAtTime(0.55, tEnd - 0.05); ca.gain.linearRampToValueAtTime(0, tEnd);
      c.connect(hp); hp.connect(ca); ca.connect(v.out);
      // light igniting tick
      nz(v, { d: 0.01, g: 0.2, type: 'highpass', f: 3000 });
    },
    bomb_explode(v, o) {
      const p = o.p;
      const sh = ctx.createWaveShaper(); sh.curve = N.sat; v.nodes.push(sh);
      const shIn = vg(v, 1), shOut = vg(v, 0.75); shIn.connect(sh); sh.connect(shOut); shOut.connect(v.out);
      tone(v, { f: 110 * p, f2: 36 * p, gl: 0.35, a: 0.003, d: 0.9, g: 0.75, to: shIn });
      nz(v, { color: 'brown', a: 0.004, d: 1.2, g: 0.8, type: 'lowpass', f: 1800, f2: 150, sw: 0.6, q: 0.9, to: shIn });
      nz(v, { a: 0.001, d: 0.08, g: 0.26, type: 'bandpass', f: 2500, q: 0.7 });
      grains(v, { t: 0.08, dur: 0.9, n: 18, fmin: 600, fmax: 2500, g: 0.16, decay: 0.02, curve: 1.8 });
      nz(v, { color: 'brown', t: 0.05, a: 0.1, d: 1.4, g: 0.28, type: 'lowpass', f: 120 });
      send(v, 0.22);
    },
    glass_crack(v, o) {
      const p = o.p;
      nz(v, { d: 0.004, g: 0.36, type: 'highpass', f: 4000 });
      pings(v, { dur: 0.06, n: 6, fmin: 3000 * p, fmax: 7500 * p, g: 0.1, dmin: 0.03, dmax: 0.12 });
      modal(v, { f: 2400 * p, r: [1, 2.32, 4.25], d: 0.15, g: 0.09 });
      grains(v, { t: 0.003, dur: 0.05, n: 5, fmin: 4000, fmax: 7000, q: 2, g: 0.13, decay: 0.004 });
    },
    glass_break(v, o) {
      const p = o.p;
      nz(v, { a: 0.001, d: 0.18, g: 0.4, type: 'highpass', f: 1200 });
      tone(v, { f: 200 * p, f2: 90 * p, gl: 0.06, d: 0.08, g: 0.22 });
      pings(v, { dur: 0.9, n: 26, fmin: 2500 * p, fmax: 9000 * p, g: 0.11, dmin: 0.03, dmax: 0.25, curve: 2 });
      grains(v, { t: 0.01, dur: 0.5, n: 14, fmin: 3000, fmax: 8000, g: 0.15, decay: 0.01, curve: 1.6 });
      send(v, 0.15);
    },
    rock_hit(v, o) {
      const p = o.p, i = o.i, lvl = 0.35 + 0.65 * i;
      modal(v, { f: 210 * p, r: [1, 1.93, 3.2], amps: [1, 0.4, 0.15], d: 0.07, g: 0.3 * lvl });
      nz(v, { color: 'brown', a: 0.002, d: 0.14, g: 0.6 * lvl, type: 'lowpass', f: 600 });
      tone(v, { f: 115 * p, f2: 55 * p, gl: 0.08, d: 0.14, g: 0.4 * lvl });
      grains(v, { t: 0.005, dur: 0.12, n: 7, fmin: 900, fmax: 2200, g: 0.07 * lvl, decay: 0.008 });
    },
    wood_break(v, o) {
      const p = o.p;
      nz(v, { d: 0.005, g: 0.45, type: 'highpass', f: 2500 });
      grains(v, { t: 0.003, dur: 0.18, n: 12, fmin: 800 * p, fmax: 3000 * p, q: 1.5, g: 0.34, decay: 0.01 });
      modal(v, { f: 420 * p, r: MAT.wood.r, d: 0.08, g: 0.22 });
      modal(v, { t: 0.09, f: 620 * p, r: MAT.wood.r, d: 0.06, g: 0.13 });
      modal(v, { t: 0.21, f: 300 * p, r: MAT.wood.r, d: 0.07, g: 0.1 });
      tone(v, { type: 'sawtooth', f: 90 * p, f2: 60 * p, gl: 0.25, a: 0.01, d: 0.25, g: 0.1, lp: 700, lq: 5 });
      nz(v, { color: 'pink', d: 0.15, g: 0.2, type: 'bandpass', f: 1200, q: 0.8 });
    },
    splash(v, o) {
      const p = o.p;
      nz(v, { a: 0.002, d: 0.26, g: 0.42, type: 'bandpass', f: 2600 * p, f2: 900 * p, sw: 0.2, q: 0.5 });
      nz(v, { color: 'pink', a: 0.01, d: 0.45, g: 0.28, type: 'lowpass', f: 3000, f2: 600, sw: 0.4 });
      tone(v, { f: 400 * p, f2: 150 * p, gl: 0.08, d: 0.1, g: 0.22 });
      for (let k = 0; k < 7; k++) { const f = rr(900, 2400) * p; tone(v, { t: rr(0.1, 0.6), f, f2: f * 1.6, gl: 0.025, a: 0.002, d: 0.04, g: 0.06 }); }
    },
    lava_sizzle(v, o) {
      const p = o.p;
      nz(v, { a: 0.01, d: 0.9, g: 0.2, type: 'highpass', f: 3000 * p, f2: 5000 * p, sw: 0.8 });
      grains(v, { dur: 0.8, n: 22, fmin: 3000, fmax: 7000, g: 0.18, decay: 0.004 });
      tone(v, { f: 150 * p, f2: 70 * p, gl: 0.2, d: 0.25, g: 0.28 });
      tone(v, { t: 0.25, f: 120 * p, f2: 60 * p, gl: 0.15, d: 0.2, g: 0.14 });
      nz(v, { color: 'pink', a: 0.1, d: 0.8, g: 0.08, type: 'bandpass', f: 1800, q: 0.7 });
    },
    thunder(v, o) {
      const p = o.p;
      nz(v, { a: 0.01, d: 0.25, g: 0.1, type: 'bandpass', f: 1200 * p, q: 0.6, type2: 'lowpass', f3: 2200 });
      for (let k = 0; k < 4; k++) {
        nz(v, { color: 'brown', t: rr(0, 1.0) * (k ? 1 : 0.1), a: rr(0.1, 0.4), d: rr(1.0, 2.0), g: rr(0.35, 0.55), type: 'lowpass', f: rr(160, 300) * p, q: 0.8 });
      }
      send(v, 0.3);
    },
    wind_gust(v, o) {
      const p = o.p;
      if (v.pan) { const b = clamp(o.pan, -1, 1); v.pan.pan.setValueAtTime(clamp(b - 0.4, -1, 1), v.t); v.pan.pan.linearRampToValueAtTime(clamp(b + 0.4, -1, 1), v.t + 1.5); }
      nz(v, { color: 'pink', a: 0.6, hold: 0.2, d: 0.8, g: 0.36, type: 'bandpass', fp: [[0, 350 * p], [0.7, 1300 * p], [1.6, 500 * p]], q: 1.4 });
      nz(v, { a: 0.6, hold: 0.15, d: 0.7, g: 0.07, type: 'bandpass', fp: [[0, 900 * p], [0.7, 1700 * p], [1.5, 1100 * p]], q: 14 });
    },
    motor_tick(v, o) {
      const p = o.p * ((tickTock++ & 1) ? 0.84 : 1);
      tone(v, { f: 3400 * p, a: 0.0003, d: 0.012, g: 0.18 });
      nz(v, { d: 0.004, g: 0.24, type: 'highpass', f: 5000 });
      modal(v, { f: 1800 * p, r: [1, 2.756], d: 0.025, g: 0.08 });
      tone(v, { f: 600 * p, f2: 400 * p, gl: 0.02, d: 0.02, g: 0.08 });
    },
    rewind(v, o) {
      const p = o.p, t0 = v.t, T = 0.85;
      const saw = vosc(v, 'sawtooth', 180 * p, t0, t0 + T + 0.05);
      saw.frequency.setValueAtTime(180 * p, t0); saw.frequency.exponentialRampToValueAtTime(1400 * p, t0 + T);
      const wob = vosc(v, 'sine', 13, t0, t0 + T + 0.05), wg = vg(v, 35); wob.connect(wg); wg.connect(saw.detune);
      const bp = vf(v, 'bandpass', 360 * p, 2);
      bp.frequency.setValueAtTime(360 * p, t0); bp.frequency.exponentialRampToValueAtTime(2800 * p, t0 + T);
      const trem = vg(v, 0.55), tl = vosc(v, 'square', 8, t0, t0 + T + 0.05), tlg = vg(v, 0.45);
      tl.frequency.setValueAtTime(8, t0); tl.frequency.exponentialRampToValueAtTime(32, t0 + T);
      tl.connect(tlg); tlg.connect(trem.gain);
      const amp = vg(v, 0); env(amp.gain, t0, 0.05, 0.13, T - 0.12, 0.08);
      saw.connect(bp); bp.connect(trem); trem.connect(amp); amp.connect(v.out);
      nz(v, { color: 'pink', a: 0.1, hold: 0.6, d: 0.15, g: 0.13, type: 'bandpass', f: 800 * p, f2: 4000 * p, sw: 0.8, q: 1.2 });
      tone(v, { t: T, f: 900 * p, f2: 600 * p, gl: 0.03, d: 0.03, g: 0.1 });
    },
    // squish: egg lands on a foam/sponge pad ("safe landing"). Soft attacks only, no clicks.
    squish(v, o) {
      const p = o.p, i = o.i, lvl = 0.25 + 0.6 * i;
      tone(v, { f: 165 * p, f2: 85 * p, gl: 0.08, a: 0.006, d: 0.08 + 0.05 * i, g: lvl * 0.6 });
      nz(v, { color: 'pink', a: 0.008, d: 0.07 + 0.03 * i, g: lvl * 0.4, type: 'lowpass', f: 950 * p, f2: 320 * p, sw: 0.09, q: 0.9 });
      nz(v, { color: 'pink', t: 0.018, a: 0.028, d: 0.07, g: lvl * 0.14, type: 'bandpass', f: 1250 * p, f2: 650 * p, sw: 0.09, q: 1.4, type2: 'lowpass', f3: 2400 });
      tone(v, { t: 0.014, f: 320 * p, f2: 170 * p, gl: 0.05, a: 0.008, d: 0.05, g: lvl * 0.1 });
    },
    score_tick(v, o) {
      const p = o.p;
      tone(v, { f: 2000 * p, a: 0.0008, d: 0.025, g: 0.16 });
      tone(v, { type: 'triangle', f: 4000 * p, a: 0.0005, d: 0.01, g: 0.035 });
    },
    countdown(v, o) {
      const p = o.pitch, go = o.i >= 0.5;
      if (!go) {
        tone(v, { f: 880 * p, a: 0.006, hold: 0.06, d: 0.12, g: 0.22 });
        tone(v, { type: 'triangle', f: 880 * p, a: 0.006, hold: 0.06, d: 0.1, g: 0.06, lp: 3000 });
      } else {
        for (const k of [1, 1.335]) {
          tone(v, { f: 1318.5 * k * p, a: 0.006, hold: 0.14, d: 0.3, g: 0.17 });
          tone(v, { type: 'triangle', f: 1318.5 * k * p, a: 0.006, hold: 0.14, d: 0.25, g: 0.04, lp: 4000 });
        }
        send(v, 0.2);
      }
    },
  };

  // ------------------------------------------------------------- voice management
  function cleanupVoice(v) {
    if (v.cleaned) return;
    if (!offline && ctx.currentTime < v.end) { setTimeout(() => cleanupVoice(v), (v.end - ctx.currentTime + 0.1) * 1000); return; }
    v.cleaned = true; v.done = true;
    for (const n of v.nodes) { try { n.disconnect(); } catch (e) {} }
    for (const s of v.srcs) { try { s.disconnect(); } catch (e) {} }
    try { v.out.disconnect(); } catch (e) {}
    if (v.pan) { try { v.pan.disconnect(); } catch (e) {} }
    v.nodes.length = 0; v.srcs.length = 0;
  }
  function stopVoice(v, fade = 0.04) {
    if (v.done) return;
    v.done = true;
    const t = now();
    try {
      v.out.gain.cancelScheduledValues(t);
      v.out.gain.setValueAtTime(v.out.gain.value, t);
      v.out.gain.linearRampToValueAtTime(0, t + fade);
    } catch (e) {}
    for (const s of v.srcs) { try { s.stop(t + fade + 0.02); } catch (e) {} }
    v.end = Math.min(v.end, t + fade + 0.03);
    if (!offline) setTimeout(() => cleanupVoice(v), (fade + 0.1) * 1000);
  }

  function play(name, opts) {
    if (!ready || !sfxOn || paused || !has(SFX, name)) return NOOP_HANDLE;
    if (ctx.state === 'closed' || (!offline && ctx.state !== 'running')) return NOOP_HANDLE;
    opts = opts || {};
    const o = {
      vol: clamp(opts.vol != null ? +opts.vol : 1, 0, 2) || 0,
      pitch: clamp(opts.pitch != null ? +opts.pitch : 1, 0.25, 4) || 1,
      pan: clamp(opts.pan != null ? +opts.pan : 0, -1, 1) || 0,
      i: clamp(opts.intensity != null ? +opts.intensity : (name === 'star' || name === 'combo' || name === 'countdown' ? 0 : 0.6), 0, 1) || 0,
    };
    if (o.vol <= 0.001) return NOOP_HANDLE;
    const t = now();
    // merge same-name hits inside the window
    const lp = lastPlay.get(name);
    if (lp && !lp.v.done && t - lp.time < MERGE_WINDOW) {
      if (o.vol > lp.vol) { lp.vol = o.vol; try { lp.v.out.gain.value = o.vol * (SFX_GAIN[name] || 1); } catch (e) {} }
      return lp.h;
    }
    // voice cap: drop finished, then steal the oldest (fuses last)
    voices = voices.filter((x) => !x.done && x.end > t);
    while (voices.length >= MAX_VOICES) {
      let k = -1;
      for (let j = 0; j < voices.length; j++) if (voices[j].name !== 'bomb_fuse') { k = j; break; }
      if (k < 0) k = 0;
      stopVoice(voices[k], 0.015);
      voices.splice(k, 1);
    }
    const pv = PITCH_VAR[name] != null ? PITCH_VAR[name] : DEFAULT_PITCH_VAR;
    o.p = o.pitch * (pv ? rr(1 - pv, 1 + pv) : 1);
    const v = newVoice(name, o, UI_SOUNDS.has(name) ? N.ui : N.world);
    try { SFX[name](v, o); } catch (e) { stopVoice(v, 0.01); return NOOP_HANDLE; }
    voices.push(v);
    if (!offline) setTimeout(() => cleanupVoice(v), (v.end - t + 0.15) * 1000);
    const h = { stop() { try { stopVoice(v); } catch (e) {} }, duration: v.end - v.t, get playing() { return !v.done && ctx.currentTime < v.end; } };
    lastPlay.set(name, { time: t, v, h, vol: o.vol });
    if (name === 'level_win') duckMusic(0.55, 2.2);
    else if (name === 'level_fail' || name === 'unlock') duckMusic(0.45, 1.4);
    else if (name === 'bomb_explode' || name === 'thunder') duckMusic(0.3, 1.0);
    return h;
  }

  // ------------------------------------------------------------- continuous loops
  function loopSrc(color, rate = 1) {
    const s = ctx.createBufferSource(); s.buffer = buf(color); s.loop = true; s.playbackRate.value = rate;
    s.start(now(), rand() * s.buffer.duration * 0.9); return s;
  }
  function killLoop(L, fade = 0.08) {
    if (!L || L.dead) return;
    L.dead = true;
    const t = now();
    try { L.out.gain.cancelScheduledValues(t); L.out.gain.setValueAtTime(L.out.gain.value, t); L.out.gain.linearRampToValueAtTime(0, t + fade); } catch (e) {}
    for (const s of L.srcs) { try { s.stop(t + fade + 0.05); } catch (e) {} }
    const done = () => { for (const n of L.nodes) { try { n.disconnect(); } catch (e) {} } };
    if (!offline) setTimeout(done, (fade + 0.2) * 1000);
  }

  // Ring creak: stick-slip sawtooth pulses through material resonances + grind noise.
  function buildRingLoop() {
    const m = MAT[st.material] || MAT.wood;
    const L = { srcs: [], nodes: [], m, out: mkGain(m.lv || 1) };
    L.nodes.push(L.out); L.out.connect(N.world);
    if (m.cl > 0) {
      const saw = ctx.createOscillator(); saw.type = 'sawtooth'; saw.frequency.value = m.cr[0]; saw.start(now());
      const jit = loopSrc('white', 0.0003), jg = mkGain((m.cr[1] - m.cr[0]) * 0.35 + 4);
      jit.connect(jg); jg.connect(saw.frequency);
      const b1 = mkFilter('bandpass', m.bp[0], m.q), b2 = mkFilter('bandpass', m.bp[1], m.q);
      const amp = mkGain(0);
      const burst = loopSrc('white', 0.00012), bg = mkGain(0);
      burst.connect(bg); bg.connect(amp.gain);
      saw.connect(b1); saw.connect(b2); b1.connect(amp); b2.connect(amp); amp.connect(L.out);
      L.srcs.push(saw, jit, burst); L.nodes.push(jg, b1, b2, amp, bg, saw, jit, burst);
      L.saw = saw; L.camp = amp; L.cdepth = bg;
    }
    const rs = loopSrc(m.ru), rf = mkFilter(m.rt, m.rf, m.rt === 'bandpass' ? 1.2 : 0.8), ramp_ = mkGain(0);
    rs.connect(rf); rf.connect(ramp_); ramp_.connect(L.out);
    L.srcs.push(rs); L.nodes.push(rs, rf, ramp_); L.ramp = ramp_;
    return L;
  }
  function applyRing() {
    if (!ready) return;
    const s = st.ring, t = now();
    if (s < 0.01 || !sfxOn) {
      if (loops.ring) {
        if (!ringIdleSince) ringIdleSince = t || 1e-6;
        setRingParams(loops.ring, 0);
        if (t - ringIdleSince > 1.5 || !sfxOn) { killLoop(loops.ring, 0.1); loops.ring = null; }
        else if (!offline && !ringIdleTimer) ringIdleTimer = setTimeout(() => { ringIdleTimer = 0; try { applyRing(); } catch (e) {} }, 1600);
      }
      return;
    }
    ringIdleSince = 0;
    if (!loops.ring || loops.ring.dead) loops.ring = buildRingLoop();
    setRingParams(loops.ring, s);
  }
  function setRingParams(L, s) {
    const m = L.m, t = now(), tau = 0.07;
    const K = 7.5;
    if (L.saw) {
      L.saw.frequency.setTargetAtTime(m.cr[0] + (m.cr[1] - m.cr[0]) * s, t, tau);
      L.camp.gain.setTargetAtTime(m.cl * Math.pow(s, 1.2) * K * 0.55, t, tau);
      L.cdepth.gain.setTargetAtTime(m.cl * s * K * 0.6, t, tau);
    }
    L.ramp.gain.setTargetAtTime(m.rl * Math.pow(s, 1.5) * 0.22, t, tau);
  }

  function buildFireLoop() {
    const L = { srcs: [], nodes: [], out: mkGain(0) };
    const c = ctx.createBufferSource(); c.buffer = buf('crackle'); c.loop = true; c.start(now(), rand() * 3);
    const chp = mkFilter('highpass', 600, 0.7), clp = mkFilter('lowpass', 4200, 0.7), cg = mkGain(0.4);
    c.connect(chp); chp.connect(clp); clp.connect(cg); cg.connect(L.out); L.nodes.push(clp);
    const roar = loopSrc('brown'), rlp = mkFilter('lowpass', 420, 0.7), rg = mkGain(0.32);
    const lfo = loopSrc('white', 0.00008), lg = mkGain(0.12); lfo.connect(lg); lg.connect(rg.gain);
    roar.connect(rlp); rlp.connect(rg); rg.connect(L.out);
    const hiss = loopSrc('white'), hhp = mkFilter('highpass', 5000, 0.7), hg = mkGain(0.008);
    hiss.connect(hhp); hhp.connect(hg); hg.connect(L.out);
    L.out.connect(N.world);
    L.srcs.push(c, roar, lfo, hiss); L.nodes.push(c, chp, cg, roar, rlp, rg, lfo, lg, hiss, hhp, hg, L.out);
    L.out.gain.setTargetAtTime(0.5, now(), 0.2);
    return L;
  }
  function applyFire() {
    if (!ready) return;
    const want = st.fire && sfxOn;
    if (want && !loops.fire) loops.fire = buildFireLoop();
    else if (!want && loops.fire) { killLoop(loops.fire, 0.4); loops.fire = null; }
  }

  function buildWindLoop() {
    const L = { srcs: [], nodes: [], out: mkGain(0) };
    const n = loopSrc('pink'), bp = mkFilter('bandpass', 500, 0.9);
    const l1 = ctx.createOscillator(); l1.frequency.value = 0.07; l1.start(now());
    const l1g = mkGain(220); l1.connect(l1g); l1g.connect(bp.frequency);
    const amp = mkGain(0.5), gust = loopSrc('white', 0.00006), gg = mkGain(0.45);
    gust.connect(gg); gg.connect(amp.gain);
    n.connect(bp); bp.connect(amp); amp.connect(L.out);
    const w = loopSrc('white'), wbp = mkFilter('bandpass', 1300, 12);
    const l2 = ctx.createOscillator(); l2.frequency.value = 0.11; l2.start(now());
    const l2g = mkGain(380); l2.connect(l2g); l2g.connect(wbp.frequency);
    const wg = mkGain(0.12); w.connect(wbp); wbp.connect(wg); wg.connect(amp);
    L.out.connect(N.world);
    L.srcs.push(n, l1, gust, w, l2); L.nodes.push(n, bp, l1, l1g, amp, gust, gg, w, wbp, l2, l2g, wg, L.out);
    L.bp = bp; L.wbp = wbp; L.wg = wg;
    return L;
  }
  function applyWind() {
    if (!ready) return;
    const lv = sfxOn ? st.wind : 0, t = now();
    if (lv < 0.01) {
      if (loops.wind) {
        loops.wind.out.gain.setTargetAtTime(0, t, 0.25);
        if (!windIdleSince) windIdleSince = t || 1e-6;
        if (t - windIdleSince > 2 || !sfxOn) { killLoop(loops.wind, 0.3); loops.wind = null; }
        else if (!offline && !windIdleTimer) windIdleTimer = setTimeout(() => { windIdleTimer = 0; try { applyWind(); } catch (e) {} }, 2100);
      }
      return;
    }
    windIdleSince = 0;
    if (!loops.wind || loops.wind.dead) loops.wind = buildWindLoop();
    const L = loops.wind;
    L.out.gain.setTargetAtTime(Math.pow(lv, 1.3) * 0.58, t, 0.3);
    L.bp.frequency.setTargetAtTime(380 + lv * 700, t, 0.3);
    L.wg.gain.setTargetAtTime(0.04 + lv * lv * 0.14, t, 0.3);
  }

  function applyUnderwater() {
    if (!ready) return;
    const t = now(), on = st.underwater;
    N.wf.frequency.cancelScheduledValues(t);
    N.wf.frequency.setTargetAtTime(on ? 700 : ctx.sampleRate / 2, t, on ? 0.12 : 0.2);
    N.wf.Q.setTargetAtTime(on ? 2.5 : 0.5, t, 0.15);
    const want = on && sfxOn;
    if (want && !loops.uw) {
      const L = { srcs: [], nodes: [], out: mkGain(0) };
      const b = loopSrc('brown'), lp = mkFilter('lowpass', 170, 0.8), bg = mkGain(0.35);
      b.connect(lp); lp.connect(bg); bg.connect(L.out);
      const bub = ctx.createBufferSource(); bub.buffer = buf('bubbles'); bub.loop = true; bub.start(now(), rand() * 5);
      const blp = mkFilter('lowpass', 1600, 0.7), bbg = mkGain(0.22);
      bub.connect(blp); blp.connect(bbg); bbg.connect(L.out);
      L.out.connect(N.sfx);
      L.srcs.push(b, bub); L.nodes.push(b, lp, bg, bub, blp, bbg, L.out);
      L.out.gain.setTargetAtTime(0.26, t, 0.4);
      loops.uw = L;
    } else if (!want && loops.uw) { killLoop(loops.uw, 0.5); loops.uw = null; }
  }
  function refreshLoops() { applyRing(); applyFire(); applyWind(); applyUnderwater(); }

  // ------------------------------------------------------------- music
  function degMidi(scale, deg, base) {
    const n = scale.length, o = Math.floor(deg / n), i = deg - o * n;
    return base + scale[i] + 12 * o;
  }
  function snapChordTone(d) {
    const pc = ((d % 7) + 7) % 7;
    if (pc === 0 || pc === 2 || pc === 4) return d;
    return (pc === 1 || pc === 3) ? d - 1 : d + (pc === 6 ? 1 : -1);
  }
  function genMotif(rng, rhythms, dens, slow) {
    const bars = [];
    let deg = [0, 2, 4][Math.floor(rng() * 3)];
    for (let b = 0; b < 2; b++) {
      const tpl = rhythms[Math.floor(rng() * rhythms.length)];
      const on = tpl.filter((s, k) => k === 0 || rng() < dens);
      const bar = new Array(16).fill(null);
      on.forEach((s, k) => {
        if (s % 8 === 0) deg = snapChordTone(deg + (rng() < 0.5 ? 0 : (rng() < 0.5 ? 1 : -1)));
        else { const r = rng(); deg += r < 0.3 ? 1 : r < 0.6 ? -1 : r < 0.75 ? 2 : r < 0.9 ? -2 : 0; }
        if (deg > 9) deg -= 3; if (deg < -3) deg += 3;
        const next = k + 1 < on.length ? on[k + 1] : 16;
        bar[s] = { deg, len: Math.min(next - s, slow ? 8 : 5), vel: (s % 4 === 0 ? 0.85 : 0.65) + rng() * 0.15 };
      });
      bars.push(bar);
    }
    return bars;
  }
  function cloneMotif(m) { return m.map((bar) => bar.map((e) => (e ? { ...e } : null))); }
  function mutate(m, rng, amt) {
    const c = cloneMotif(m);
    for (const bar of c) for (let s = 1; s < 16; s++) {
      const e = bar[s];
      if (e && rng() < amt) {
        if (rng() < 0.3) bar[s] = null;
        else e.deg = s % 8 === 0 ? snapChordTone(e.deg + (rng() < 0.5 ? 2 : -2)) : e.deg + (rng() < 0.5 ? 1 : -1);
      } else if (!e && s % 2 === 0 && rng() < amt * 0.25) {
        let p = s - 1; while (p >= 0 && !bar[p]) p--;
        if (p >= 0) { bar[s] = { deg: bar[p].deg + (rng() < 0.5 ? 1 : -1), len: 2, vel: 0.6 }; bar[p].len = Math.min(bar[p].len, s - p); }
      }
    }
    return c;
  }
  function transposeMotif(m, k) {
    const c = cloneMotif(m);
    for (const bar of c) bar.forEach((e, s) => { if (e) e.deg = s % 8 === 0 ? snapChordTone(e.deg + k) : e.deg + k; });
    return c;
  }
  function cadence(m) {
    const c = cloneMotif(m), bar = c[1];
    for (let s = 9; s < 16; s++) bar[s] = null;
    bar[8] = { deg: 0, len: 8, vel: 0.75 };
    return c;
  }

  function createInstance(spec, t0) {
    const pname = resolveMood(spec.mood);
    const P = PRESETS[pname];
    const rootKey = String(spec.root || 'C').trim().toUpperCase();
    const pc = has(NOTE, rootKey) ? NOTE[rootKey] : 0;
    const scaleName = has(SCALES, spec.scale) ? spec.scale : P.scale;
    const harm = scaleName === 'pentatonic' ? SCALES.major : SCALES[scaleName];
    const pent = scaleName === 'pentatonic';
    const bpm = clamp(+spec.bpm || P.bpm, 50, 200);
    const sd = 60 / bpm / 4;
    const rng = mulberry32(hashStr(pname + '|' + pc + '|' + scaleName + '|' + bpm));
    const tonic3 = pc >= 7 ? 36 + pc : 48 + pc;   // pad / harmony centre (G2..F#3)
    const I = {
      key: pname + '|' + pc + '|' + scaleName + '|' + bpm, P, pname, sd, rng, harm, pent,
      bassBase: tonic3 - 12, padLo: tonic3 + 3, leadBase: tonic3 + 12 + (P.lead ? P.lead.oct : 12),
      nt: t0, idx: 0, dead: false, stopAt: 0, secIdx: -2, sec: 'I', barInSec: 0, cycle: 0,
      chord: 0, nextChord: 0, motifA: null, motifB: null, variants: null, arpI: 0, leadInst: P.lead ? P.lead.inst : null,
      nodes: [],
    };
    const keep = (n) => { I.nodes.push(n); return n; };
    I.xf = keep(mkGain(0)); I.xf.connect(N.mIn);
    I.vs = keep(mkGain(P.verb)); I.xf.connect(I.vs); I.vs.connect(N.mVerb);
    I.bus = keep(mkGain(P.trim || 1));
    if (P.filter) {
      const lp = keep(mkFilter('lowpass', P.filter.f, P.filter.q));
      const lfo = keep(ctx.createOscillator()); lfo.frequency.value = P.filter.rate; lfo.start(t0);
      const lg = keep(mkGain(P.filter.depth)); lfo.connect(lg); lg.connect(lp.frequency);
      I.bus.connect(lp); lp.connect(I.xf); I.lfo = lfo;
    } else I.bus.connect(I.xf);
    I.fx = keep(mkGain(1));
    const dl = keep(ctx.createDelay(2)); dl.delayTime.value = Math.min(1.9, P.delay.steps * sd);
    const dlf = keep(mkFilter('lowpass', 2600, 0.5)), fb = keep(mkGain(P.delay.fb)), dmix = keep(mkGain(P.delay.mix));
    I.fx.connect(dl); dl.connect(dlf); dlf.connect(fb); fb.connect(dl); dlf.connect(dmix); dmix.connect(I.bus);
    I.drums = keep(mkGain(P.drums ? P.drums.lvl : 1)); I.drums.connect(I.bus);
    // shared tremolo bus (vibes / tremolo pads): one LFO per instance
    I.trem = keep(mkGain(0.8));
    const tl = keep(ctx.createOscillator()); tl.frequency.value = pname === 'storm' ? 6.5 : 4.8; tl.start(t0);
    const tlg = keep(mkGain(0.2)); tl.connect(tlg); tlg.connect(I.trem.gain); I.trem.connect(I.bus); I.tlfo = tl;
    I.xf.gain.setValueAtTime(0, t0); I.xf.gain.linearRampToValueAtTime(1, t0 + XFADE);
    return I;
  }

  function destroyInstance(I) {
    I.dead = true;
    const kill = () => {
      try { I.lfo && I.lfo.stop(); } catch (e) {}
      try { I.tlfo.stop(); } catch (e) {}
      for (const n of I.nodes) { try { n.disconnect(); } catch (e) {} }
    };
    if (offline) return;
    setTimeout(kill, 3500);   // after reverb/delay tails
  }

  // --- music instruments: each builds a short-lived node chain that disconnects itself on end
  function mNodes(src, list) { src.onended = () => { for (const n of list) { try { n.disconnect(); } catch (e) {} } }; }
  function mOsc(type, f, t, t1, list, det) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; if (det) o.detune.value = det;
    o.start(t); o.stop(t1); list.push(o); return o;
  }
  function mEnv(g, t, a, peak, d, sus, dur, r) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    if (sus > 0) {
      g.gain.setTargetAtTime(peak * sus, t + a, d / 3);
      g.gain.setTargetAtTime(0, t + Math.max(dur, a + 0.01), r / 4);
      return t + Math.max(dur, a + 0.01) + r * 1.1;
    }
    g.gain.setTargetAtTime(0, t + a, d / 4);
    return t + a + d * 1.25;
  }
  function mNoise(t, t1, list, rate = 1, color = 'white') {
    const s = ctx.createBufferSource(); s.buffer = buf(color); s.loop = true; s.playbackRate.value = rate;
    s.start(t, rand() * 1.5); s.stop(t1); list.push(s); return s;
  }

  const INST = {
    pluck(I, t, f, dur, vel, dest, fx) {
      const L = [], g = mkGain(0), lp = mkFilter('lowpass', Math.min(f * 8, 7000), 1.2); L.push(g, lp);
      lp.frequency.setValueAtTime(Math.min(f * 9, 7000), t); lp.frequency.setTargetAtTime(f * 1.6, t, 0.08);
      const end = mEnv(g, t, 0.004, vel, Math.min(0.25 + dur * 0.6, 0.9), 0, 0, 0);
      const o1 = mOsc('triangle', f, t, end, L), o2 = mOsc('sawtooth', f, t, end, L, 7), m2 = mkGain(0.35); L.push(m2);
      o1.connect(lp); o2.connect(m2); m2.connect(lp); lp.connect(g); g.connect(dest); if (fx) { const s = mkGain(fx); L.push(s); g.connect(s); s.connect(I.fx); }
      mNodes(o1, L);
    },
    marimba(I, t, f, dur, vel, dest, fx) {
      const L = [], g = mkGain(0); L.push(g);
      const end = mEnv(g, t, 0.002, vel, 0.55, 0, 0, 0);
      const o1 = mOsc('sine', f, t, end, L), o2 = mOsc('sine', f * 3.99, t, t + 0.12, L), g2 = mkGain(0); L.push(g2);
      g2.gain.setValueAtTime(0.3, t); g2.gain.setTargetAtTime(0, t, 0.02);
      o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(dest); if (fx) { const s = mkGain(fx); L.push(s); g.connect(s); s.connect(I.fx); }
      mNodes(o1, L);
    },
    bell(I, t, f, dur, vel, dest, fx) {
      const L = [], g = mkGain(0); L.push(g);
      const end = mEnv(g, t, 0.003, vel, 1.6, 0, 0, 0);
      const c = mOsc('sine', f, t, end, L), m = mOsc('sine', f * 3.5, t, end, L), mg = mkGain(0); L.push(mg);
      mg.gain.setValueAtTime(f * 1.4, t); mg.gain.setTargetAtTime(f * 0.15, t, 0.15);
      m.connect(mg); mg.connect(c.frequency); c.connect(g); g.connect(dest);
      if (fx) { const s = mkGain(fx); L.push(s); g.connect(s); s.connect(I.fx); }
      mNodes(c, L);
    },
    epiano(I, t, f, dur, vel, dest, fx) {
      const L = [], g = mkGain(0); L.push(g);
      const end = mEnv(g, t, 0.005, vel, 1.2, 0.35, Math.max(dur, 0.2), 0.3);
      const c = mOsc('sine', f, t, end, L), m = mOsc('sine', f, t, end, L), mg = mkGain(0); L.push(mg);
      mg.gain.setValueAtTime(f * 1.3, t); mg.gain.setTargetAtTime(f * 0.2, t, 0.12);
      m.connect(mg); mg.connect(c.frequency); c.connect(g); g.connect(dest);
      if (fx) { const s = mkGain(fx); L.push(s); g.connect(s); s.connect(I.fx); }
      mNodes(c, L);
    },
    vibes(I, t, f, dur, vel, dest, fx) {
      const L = [], g = mkGain(0); L.push(g);
      const end = mEnv(g, t, 0.003, vel, 1.4, 0, 0, 0);
      const o1 = mOsc('sine', f, t, end, L), o2 = mOsc('sine', f * 4, t, t + 0.3, L), g2 = mkGain(0); L.push(g2);
      g2.gain.setValueAtTime(0.18, t); g2.gain.setTargetAtTime(0, t, 0.05);
      o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(I.trem);
      if (fx) { const s = mkGain(fx); L.push(s); g.connect(s); s.connect(I.fx); }
      mNodes(o1, L);
    },
    oud(I, t, f, dur, vel, dest, fx) {
      const L = [], g = mkGain(0), lp = mkFilter('lowpass', 4000, 2.5); L.push(g, lp);
      lp.frequency.setValueAtTime(Math.min(f * 10, 6000), t); lp.frequency.setTargetAtTime(f * 2, t, 0.1);
      const end = mEnv(g, t, 0.003, vel, 0.7, 0, 0, 0);
      const o = mOsc('sawtooth', f, t, end, L), o2 = mOsc('triangle', f, t, end, L, -5);
      o.frequency.setValueAtTime(f * 0.97, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
      const m = mkGain(0.5); L.push(m);
      o.connect(m); m.connect(lp); o2.connect(lp); lp.connect(g); g.connect(dest);
      if (fx) { const s = mkGain(fx); L.push(s); g.connect(s); s.connect(I.fx); }
      mNodes(o, L);
    },
    square(I, t, f, dur, vel, dest, fx) {
      const L = [], g = mkGain(0), lp = mkFilter('lowpass', 1700, 1); L.push(g, lp);
      const end = mEnv(g, t, 0.015, vel, 0.3, 0.6, dur, 0.15);
      const o = mOsc('square', f, t, end, L), o2 = mOsc('triangle', f, t, end, L, 6), m = mkGain(0.45); L.push(m);
      const vib = mOsc('sine', 5.5, t, end, L), vg_ = mkGain(0); L.push(vg_);
      vg_.gain.setValueAtTime(0, t); vg_.gain.linearRampToValueAtTime(f * 0.006, t + 0.25);
      vib.connect(vg_); vg_.connect(o.frequency); vg_.connect(o2.frequency);
      o.connect(m); m.connect(lp); o2.connect(lp); lp.connect(g); g.connect(dest);
      if (fx) { const s = mkGain(fx); L.push(s); g.connect(s); s.connect(I.fx); }
      mNodes(o, L);
    },
    bubble(I, t, f, dur, vel, dest) {
      const L = [], g = mkGain(0); L.push(g);
      const end = mEnv(g, t, 0.003, vel, 0.07, 0, 0, 0);
      const o = mOsc('sine', f, t, end + 0.02, L);
      o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.06);
      o.connect(g); g.connect(dest); mNodes(o, L);
    },
  };
  const BASS = {
    pluck(I, t, f, dur, vel) {
      const L = [], g = mkGain(0), lp = mkFilter('lowpass', f * 6, 1); L.push(g, lp);
      lp.frequency.setValueAtTime(f * 7, t); lp.frequency.setTargetAtTime(f * 2, t, 0.06);
      const end = mEnv(g, t, 0.005, vel, 0.5, 0.35, dur, 0.08);
      const o = mOsc('triangle', f, t, end, L), o2 = mOsc('sawtooth', f, t, end, L), m = mkGain(0.25), h = mOsc('sine', f * 2, t, end, L), hg = mkGain(0.2);
      L.push(m, hg);
      o.connect(lp); o2.connect(m); m.connect(lp); h.connect(hg); hg.connect(lp); lp.connect(g); g.connect(I.bus); mNodes(o, L);
    },
    round(I, t, f, dur, vel) {
      const L = [], g = mkGain(0), lp = mkFilter('lowpass', f * 4, 0.7); L.push(g, lp);
      const end = mEnv(g, t, 0.008, vel, 0.4, 0.6, dur, 0.09);
      const o = mOsc('sine', f, t, end, L), o2 = mOsc('triangle', f, t, end, L), h = mOsc('sine', f * 2, t, end, L), hg = mkGain(0.22); L.push(hg);
      o.connect(lp); o2.connect(lp); h.connect(hg); hg.connect(lp); lp.connect(g); g.connect(I.bus); mNodes(o, L);
    },
    saw(I, t, f, dur, vel) {
      const L = [], g = mkGain(0), lp = mkFilter('lowpass', f * 8, 3.5); L.push(g, lp);
      lp.frequency.setValueAtTime(f * 10, t); lp.frequency.setTargetAtTime(f * 2.5, t, 0.05);
      const end = mEnv(g, t, 0.004, vel, 0.25, 0.55, dur, 0.06);
      const o = mOsc('sawtooth', f, t, end, L), o2 = mOsc('square', f * 0.5, t, end, L, -10), m = mkGain(0.4); L.push(m);
      o.connect(lp); o2.connect(m); m.connect(lp); lp.connect(g); g.connect(I.bus); mNodes(o, L);
    },
    sub(I, t, f, dur, vel) {
      const L = [], g = mkGain(0); L.push(g);
      const end = mEnv(g, t, 0.06, vel, 0.5, 0.85, dur, 0.4);
      const o = mOsc('sine', f, t, end, L), h = mOsc('triangle', f * 2, t, end, L), hg = mkGain(0.18); L.push(hg);
      o.connect(g); h.connect(hg); hg.connect(g); g.connect(I.bus); mNodes(o, L);
    },
  };
  function pad(I, t, midis, dur, P) {
    const L = [], g = mkGain(0), lp = mkFilter('lowpass', P.cut, 0.6); L.push(g, lp);
    const end = mEnv(g, t, P.a, P.lvl, 0.5, 1, dur, P.r);
    let first = null;
    for (const m of midis) {
      const f = mtof(m);
      for (const det of [-9, 8]) { const o = mOsc('sawtooth', f, t, end, L, det + (rand() * 4 - 2)); o.connect(lp); first = first || o; }
      if (P.air) { const o = mOsc('sine', f * 2, t, end, L); const ag = mkGain(0.4); L.push(ag); o.connect(ag); ag.connect(lp); }
    }
    lp.connect(g); g.connect(P.trem ? I.trem : I.bus);
    if (first) mNodes(first, L);
  }
  const DRUM = {
    kick(I, t, v) {
      const L = [], g = mkGain(0); L.push(g);
      const end = mEnv(g, t, 0.002, 0.9 * v, 0.32, 0, 0, 0);
      const o = mOsc('sine', 170, t, end, L); o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
      o.connect(g); g.connect(I.drums); mNodes(o, L);
    },
    clap(I, t, v) {
      const L = [], g = mkGain(0), bp = mkFilter('bandpass', 1300, 1.4); L.push(g, bp);
      const s = mNoise(t, t + 0.25, L), a = 0.28 * v;
      for (const dt of [0, 0.011, 0.022]) { g.gain.setValueAtTime(a, t + dt); g.gain.setTargetAtTime(0, t + dt + 0.001, 0.004); }
      g.gain.setValueAtTime(a * 0.8, t + 0.03); g.gain.setTargetAtTime(0, t + 0.031, 0.04);
      s.connect(bp); bp.connect(g); g.connect(I.drums); mNodes(s, L);
    },
    hat(I, t, v) {
      const L = [], g = mkGain(0), hp = mkFilter('highpass', 7500, 0.7); L.push(g, hp);
      const end = mEnv(g, t, 0.001, 0.09 * v, 0.045, 0, 0, 0);
      const s = mNoise(t, end, L); s.connect(hp); hp.connect(g); g.connect(I.drums); mNodes(s, L);
    },
    shaker(I, t, v) {
      const L = [], g = mkGain(0), bp = mkFilter('bandpass', 6500, 0.9); L.push(g, bp);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.1 * v, t + 0.012); g.gain.setTargetAtTime(0, t + 0.014, 0.018);
      const s = mNoise(t, t + 0.12, L); s.connect(bp); bp.connect(g); g.connect(I.drums); mNodes(s, L);
    },
    rim(I, t, v) {
      const L = [], g = mkGain(0); L.push(g);
      const end = mEnv(g, t, 0.0008, 0.12 * v, 0.03, 0, 0, 0);
      const o = mOsc('triangle', 1700, t, end, L); const bp = mkFilter('bandpass', 2500, 2); L.push(bp);
      const s = mNoise(t, end, L), ng = mkGain(0.6); L.push(ng);
      o.connect(g); s.connect(bp); bp.connect(ng); ng.connect(g); g.connect(I.drums); mNodes(o, L);
    },
    tom(I, t, v, f = 110) {
      const L = [], g = mkGain(0); L.push(g);
      const end = mEnv(g, t, 0.003, 0.6 * v, 0.5, 0, 0, 0);
      const o = mOsc('sine', f, t, end, L); o.frequency.setValueAtTime(f * 1.4, t); o.frequency.exponentialRampToValueAtTime(f * 0.7, t + 0.3);
      const s = mNoise(t, t + 0.1, L, 1, 'pink'), lp = mkFilter('lowpass', 900, 0.7), ng = mkGain(0); L.push(lp, ng);
      ng.gain.setValueAtTime(0.25 * v, t); ng.gain.setTargetAtTime(0, t, 0.02);
      o.connect(g); s.connect(lp); lp.connect(ng); ng.connect(g); g.connect(I.drums); mNodes(o, L);
    },
    dum(I, t, v) { DRUM.tom(I, t, v * 0.9, 95); },
    tek(I, t, v) {
      const L = [], g = mkGain(0), bp = mkFilter('bandpass', 3200, 2.2); L.push(g, bp);
      const end = mEnv(g, t, 0.0008, 0.22 * v, 0.045, 0, 0, 0);
      const s = mNoise(t, end, L); s.connect(bp); bp.connect(g); g.connect(I.drums); mNodes(s, L);
    },
  };
  const VEL = { X: 1, x: 0.72, o: 0.4 };

  function chordAt(I, sec, barInSec) {
    const P = I.P, prog = P.prog[sec === 'I' ? 'A' : sec] || P.prog.A;
    return prog[Math.floor(barInSec / P.bpc) % prog.length];
  }
  function sectionOf(I, bar) {
    const P = I.P, intro = 2;
    if (bar < intro) return { sec: 'I', barInSec: bar, cycle: 0, secIdx: -1 };
    const b = bar - intro, secIdx = Math.floor(b / P.secBars);
    return { sec: P.form[secIdx % P.form.length], barInSec: b % P.secBars, cycle: Math.floor(secIdx / P.form.length), secIdx };
  }
  function newSection(I, info) {
    const P = I.P, L = P.lead, rng = I.rng;
    if (!L) { I.variants = null; return; }
    const rh = RH[L.rh] || RH.flowing, slow = P.bpc > 1;
    let m;
    if (info.sec === 'A') {
      I.motifA = I.motifA ? mutate(I.motifA, rng, 0.12 + 0.05 * Math.min(info.cycle, 3)) : genMotif(rng, rh, L.dens, slow);
      m = I.motifA;
      const third = rng() < 0.5 ? transposeMotif(m, 2) : mutate(m, rng, 0.3);
      I.variants = [m, rng() < 0.5 ? m : mutate(m, rng, 0.15), third, cadence(m)];
      I.leadInst = info.cycle % 2 === 1 && L.alt ? L.alt : L.inst;
      I.leadOct = 0;
    } else if (info.sec === 'B') {
      I.motifB = I.motifB ? mutate(I.motifB, rng, 0.2) : genMotif(rng, RH.flowing, L.dens * 0.85, slow);
      m = I.motifB;
      I.variants = [m, mutate(m, rng, 0.2), transposeMotif(m, -2), cadence(m)];
      I.leadInst = L.alt || L.inst; I.leadOct = (I.pname === 'spooky' || P.bpc > 1) ? 0 : -12;
    } else if (info.sec === 'C') {
      m = genMotif(rng, RH.sparse, 0.35, true);
      I.variants = [m, mutate(m, rng, 0.3), m, cadence(m)];
      I.leadInst = L.alt || L.inst; I.leadOct = 0;
    } else I.variants = null;
  }
  function inSec(list, sec) { return !list || list.includes(sec) || (sec === 'I' && list.includes('I')); }

  function stepInstance(I, idx, t) {
    const P = I.P, bar = Math.floor(idx / 16), s = idx % 16, sd = I.sd;
    if (s === 0) {
      const info = sectionOf(I, bar);
      if (info.barInSec === 0 && info.secIdx !== I.secIdx) newSection(I, info);
      I.sec = info.sec; I.barInSec = info.barInSec; I.cycle = info.cycle; I.secIdx = info.secIdx;
      I.chord = chordAt(I, info.sec, info.barInSec);
      const nx = sectionOf(I, bar + 1); I.nextChord = chordAt(I, nx.sec, nx.barInSec);
      I.lastBarOfSec = nx.barInSec === 0;
      // pad
      if (P.pad && P.pad.in.includes(I.sec) && I.barInSec % P.bpc === 0) {
        const deg = I.chord, mids = [];
        const tones = P.pad.air ? [0, 2, 4, 6] : [0, 2, 4];
        for (const k of tones) {
          let m = degMidi(I.harm, deg + k, 0);
          m = ((m % 12) + 12) % 12; m += I.padLo - (I.padLo % 12); if (m < I.padLo) m += 12;
          mids.push(m);
        }
        const len = (I.sec === 'I' ? 2 : P.bpc) * 16 * sd;
        pad(I, t, mids, len, P.pad);
      }
      // drone (desert): root + fifth for 4 bars
      if (P.drone && bar % 4 === 0) {
        const r = I.bassBase + 12;
        pad(I, t, [r, r + 7], 4 * 16 * sd - 0.05, { lvl: P.drone.lvl, cut: 700, a: 1.2, r: 1.2 });
      }
    }
    const sec = I.sec, swing = s % 2 === 1 ? P.swing * sd : 0, tt = t + swing;
    const hv = () => 0.9 + I.rng() * 0.2;
    // drums
    const D = P.drums;
    if (D && sec !== 'I' && inSec(D.in, sec)) {
      const fill = I.lastBarOfSec && s >= 12 && (I.secIdx % 2 === 1);
      for (const k of ['kick', 'clap', 'hat', 'shaker', 'rim', 'tom', 'dum', 'tek']) {
        const pat = D[k]; if (!pat) continue;
        const c = pat[s]; if (c === '.' || !VEL[c]) continue;
        if (fill && (k === 'clap' || k === 'tom')) continue;
        DRUM[k](I, tt, VEL[c] * hv());
      }
      if (fill) {
        if (D.fillTom) DRUM.tom(I, tt, 0.55 * hv(), 150 - (s - 12) * 15);
        else if (D.clap || D.rim) (D.rim && !D.clap ? DRUM.rim : DRUM.clap)(I, tt, (0.3 + (s - 12) * 0.1) * hv());
      }
    }
    // bass
    const B = P.bass;
    if (B) {
      const c = B.pat[s];
      if (c && c !== '.' && c !== '-') {
        let len = 1; while (s + len < 16 && B.pat[s + len] === '-') len++;
        let deg = I.chord, oct = 0, v = 1;
        if (c === '5') deg += 4; else if (c === '3') deg += 2; else if (c === '8') oct = 12; else if (c === '7') deg -= 1;
        else if (c === 'a') deg = I.nextChord + (I.rng() < 0.5 ? 1 : -1);
        else if (c === 'r') v = 0.55;
        let m = degMidi(I.harm, deg, I.bassBase) + oct;
        while (m > I.bassBase + 14) m -= 12; while (m < I.bassBase - 5) m += 12;
        const quiet = sec === 'C' ? 0.8 : 1;
        BASS[B.inst](I, tt, mtof(m), len * sd * 0.92, B.lvl * v * quiet * hv());
      }
    }
    // comp (chord stabs)
    const C = P.comp;
    if (C && inSec(C.in, sec) && sec !== 'I') {
      const c = C.pat[s];
      if (VEL[c]) {
        let len = 1; while (s + len < 16 && C.pat[s + len] === '.') len++;
        for (const k of [0, 2, 4]) {
          let m = degMidi(I.harm, I.chord + k, 0); m = ((m % 12) + 12) % 12; m += I.padLo - (I.padLo % 12); if (m < I.padLo) m += 12;
          INST[C.inst](I, tt + k * 0.004, mtof(m + (C.inst === 'pluck' ? 12 : 0)), Math.min(len, 3) * sd, C.lvl * VEL[c] * hv(), I.bus, 0);
        }
      }
    }
    // arpeggio / texture
    const A = P.arp;
    if (A && inSec(A.in, sec) && sec !== 'I' && A.pat[s] === 'x' && (!A.rand || I.rng() < 0.55)) {
      const tones = [0, 2, 4, 7, 9, 11];
      const k = A.rand ? tones[Math.floor(I.rng() * tones.length)] : tones[I.arpI++ % 4];
      let m = degMidi(I.harm, I.chord + k, I.padLo - (I.padLo % 12) + 12);
      if (I.pent) m = snapPent(m, I.bassBase);
      INST[A.inst](I, tt, mtof(m), sd * 2, A.lvl * hv(), I.bus, A.inst === 'bell' ? 0.6 : 0.25);
    }
    // lead motif
    const Ld = P.lead;
    if (Ld && I.variants && inSec(Ld.in, sec)) {
      const mv = I.variants[Math.floor(I.barInSec / 2) % 4];
      const e = mv && mv[I.barInSec % 2][s];
      if (e) {
        let m = degMidi(I.harm, I.chord + e.deg, I.leadBase - 12 + (I.leadOct || 0));
        if (I.pent) m = snapPent(m, I.bassBase);
        const lvl = Ld.lvl * (sec === 'C' ? 0.75 : 1);
        INST[I.leadInst || Ld.inst](I, tt + (I.rng() - 0.5) * 0.006, mtof(m), e.len * sd * 0.95, lvl * e.vel * hv(), I.bus, Ld.fx);
      }
    }
  }
  function snapPent(m, base) {
    const rel = (((m - base) % 12) + 12) % 12;
    if (PENT.has(rel)) return m;
    for (const d of [-1, 1, -2, 2]) if (PENT.has((((m + d - base) % 12) + 12) % 12)) return m + d;
    return m;
  }

  function scheduleInstance(I, until, nowT) {
    while (I.nt < until) {
      if (I.stopAt && I.nt >= I.stopAt) { destroyInstance(I); return; }
      if (I.nt >= nowT - 0.02) { try { stepInstance(I, I.idx, I.nt); } catch (e) {} }
      I.idx++; I.nt += I.sd;
    }
  }
  function schedTick() {
    schedTimer = null;
    if (!ready) return;
    const t = now();
    for (const I of instances) if (!I.dead) scheduleInstance(I, t + LOOKAHEAD, t);
    instances = instances.filter((I) => !I.dead);
    if (instances.length && !offline) schedTimer = setTimeout(schedTick, TICK_MS);
  }
  // Offline contexts have no wall clock: drive the same scheduler with suspend() checkpoints
  // so only a lookahead's worth of notes exists at a time (like real-time playback).
  let offlineChain = false;
  function offlineCheckpoint(t, k = 1) {
    const q = 128 / ctx.sampleRate, end = ctx.length / ctx.sampleRate;
    const at = Math.ceil(t / q) * q + k * q;
    if (at >= end || k > 16) { offlineChain = false; return; }
    const onSuspend = () => {
      schedTick();
      if (instances.length) offlineCheckpoint(now() + 0.15); else offlineChain = false;
      setTimeout(() => ctx.resume(), 0);   // lets a rejected (duplicate) checkpoint retry first
    };
    try { ctx.suspend(at).then(onSuspend, () => offlineCheckpoint(t, k + 1)); }
    catch (e) { offlineCheckpoint(t, k + 1); }
  }
  function startScheduler() {
    if (offline) {
      schedTick();
      if (!offlineChain && instances.length) { offlineChain = true; offlineCheckpoint(now() + 0.15); }
      return;
    }
    if (!schedTimer) schedTimer = setTimeout(schedTick, 0);
  }
  function fadeOutInstance(I, sec) {
    const t = now();
    I.xf.gain.cancelScheduledValues(t);
    I.xf.gain.setValueAtTime(I.xf.gain.value, t);
    I.xf.gain.linearRampToValueAtTime(0, t + sec);
    I.stopAt = t + sec + 0.05;
  }
  function startMusic(spec) {
    const t = now() + 0.05;
    const I = createInstance(spec, t);
    if (curInst) fadeOutInstance(curInst, XFADE);
    curInst = I; instances.push(I);
    startScheduler();
  }
  function specKey(spec) {
    const p = resolveMood(spec.mood);
    return p + '|' + String(spec.root || '').toUpperCase() + '|' + (spec.scale || '') + '|' + (spec.bpm || '');
  }

  function duckMusic(amount, seconds) {
    if (!ready) return;
    const t = now(), a = clamp(+amount || 0, 0, 1), s = Math.max(0.05, +seconds || 0.5);
    N.duck.gain.cancelScheduledValues(t);
    N.duck.gain.setValueAtTime(N.duck.gain.value, t);
    N.duck.gain.setTargetAtTime(1 - a, t, 0.04);
    N.duck.gain.setTargetAtTime(1, t + s, 0.35);
  }

  // ------------------------------------------------------------- public API
  function unlock() {
    if (!ensure()) return;
    if (!unlockedOnce) {
      unlockedOnce = true;
      if (!offline) {
        try { const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch (e) {}
      }
      refreshLoops();
      if (musicOn && musicSpec && !curInst) startMusic(musicSpec);
    }
    if (!offline && !paused && ctx.state !== 'running' && ctx.resume) { try { ctx.resume().catch(() => {}); } catch (e) {} }
  }
  function setSfx(on) {
    sfxOn = !!on;
    if (!ready) return;
    ramp(N.sfx.gain, sfxOn ? 1 : 0, 0.04);
    if (!sfxOn) for (const v of voices) stopVoice(v, 0.05);
    refreshLoops();
  }
  function setMusic(on) {
    musicOn = !!on;
    if (!ready) return;
    ramp(N.mBus.gain, musicOn ? dbToGain(MUSIC_BUS_DB) : 0, 0.15);
    if (!musicOn) { if (curInst) { fadeOutInstance(curInst, 0.5); curInst = null; } }
    else if (musicSpec && !curInst && unlockedOnce) startMusic(musicSpec);
  }
  function pauseAll() {
    if (paused) return;
    paused = true;
    if (!ready || offline) return;
    ramp(N.master.gain, 0, 0.015);
    setTimeout(() => { if (paused && ctx.state === 'running') { try { ctx.suspend().catch(() => {}); } catch (e) {} } }, 90);
  }
  function resumeAll() {
    if (!paused) return;
    paused = false;
    if (!ready || offline) return;
    const go = () => ramp(N.master.gain, 1, 0.08);
    if (unlockedOnce && ctx.state !== 'running') { try { ctx.resume().then(go, go); } catch (e) { go(); } }
    else go();
    if (instances.length) startScheduler();
  }
  function setRingTurn(speed) {
    st.ring = clamp(+speed || 0, 0, 1);
    if (ready && unlockedOnce) applyRing();
  }
  function setMaterial(mat) {
    const m = has(MAT, mat) ? mat : 'wood';
    if (m === st.material) return;
    st.material = m;
    if (ready && loops.ring) { killLoop(loops.ring, 0.12); loops.ring = null; applyRing(); }
  }
  function setFireLoop(on) { st.fire = !!on; if (ready && unlockedOnce) applyFire(); }
  function setWind(level) { st.wind = clamp(+level || 0, 0, 1); if (ready && unlockedOnce) applyWind(); }
  function setUnderwater(on) { st.underwater = !!on; if (ready && unlockedOnce) applyUnderwater(); }
  function music(spec) {
    if (!spec || typeof spec !== 'object') return;
    const key = specKey(spec);
    if (musicSpec && specKey(musicSpec) === key && curInst) return;
    musicSpec = { ...spec };
    if (!ready || !musicOn || !unlockedOnce) return;
    startMusic(musicSpec);
  }
  function stopMusic() {
    musicSpec = null;
    if (!ready) return;
    if (curInst) { fadeOutInstance(curInst, XFADE); curInst = null; }
  }
  function duck(amount, seconds) { duckMusic(amount, seconds); }

  const safe = (fn, fallback) => function () { try { const r = fn.apply(null, arguments); return r === undefined ? fallback : r; } catch (e) { return fallback; } };
  return {
    unlock: safe(unlock), setSfx: safe(setSfx), setMusic: safe(setMusic), pauseAll: safe(pauseAll), resumeAll: safe(resumeAll),
    play: safe(play, NOOP_HANDLE), setRingTurn: safe(setRingTurn), setMaterial: safe(setMaterial),
    setFireLoop: safe(setFireLoop), setWind: safe(setWind), setUnderwater: safe(setUnderwater),
    music: safe(music), stopMusic: safe(stopMusic), duck: safe(duck),
    // diagnostics (not part of the game contract)
    get ctx() { return ctx; },
    get ready() { return ready; },
    stats: safe(() => ({ voices: voices.filter((v) => !v.done && v.end > ctx.currentTime).length, musicInstances: instances.length, mood: curInst ? curInst.pname : null, loops: Object.keys(loops).filter((k) => loops[k]) }), {}),
    sfxNames: SFX_NAMES, materials: MATERIALS, moods: MOODS,
  };
}

export const audio = createAudioEngine();
export default audio;
