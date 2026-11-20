#!/usr/bin/env node
// Builds one HTML page with the game's own audio engine inside it: every sound effect, every world's music and the
// theme tune candidates, each on a button, so the owner can listen on a phone and say what he likes.
//   node tools/audio/soundboard.mjs <out.html> [--old=<git ref>]
// --old (default HEAD): the engine and themes.js of that git ref are bundled as a second engine, so every world's music
// can be played OLD beside NEW. The 22 effects rebuilt on 2026-11-20 keep their old versions as '<name>_old'.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = process.argv.slice(2).find((a) => !a.startsWith('--'));
const OLD_REF = (process.argv.find((a) => a.startsWith('--old=')) || '--old=HEAD').slice(6);
const gitShow = (f) => { try { return execFileSync('git', ['show', OLD_REF + ':./' + f], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }); } catch (e) { return null; } };
if (!out) { console.error('usage: soundboard.mjs <out.html>'); process.exit(1); }
const r = await build({ entryPoints: [path.join(ROOT, 'src/audio.js')], bundle: true, format: 'iife', globalName: 'EggAudio', minify: true, write: false, target: 'es2019' });
const engine = r.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
// the old engine, for OLD world music (bundled from the git ref; skipped when it is the same file)
const oldSrc = gitShow('src/audio.js'), curSrc = fs.readFileSync(path.join(ROOT, 'src/audio.js'), 'utf8');
let oldEngine = '';
if (oldSrc && oldSrc !== curSrc) {
  const o = await build({ stdin: { contents: oldSrc, resolveDir: path.join(ROOT, 'src'), loader: 'js' }, bundle: true, format: 'iife', globalName: 'EggAudioOld', minify: true, write: false, target: 'es2019' });
  oldEngine = o.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
}
const { SFX_NAMES, TUNES, MAIN_THEME } = await import(path.join(ROOT, 'src/audio.js'));
// every world's music spec, read as text from themes.js (so no canvas code runs here), and the old ref's spec beside it
const specs = (src) => { const o = {}; for (const m of (src || '').matchAll(/\{ id: '(\w+)', name: (?:'([^']+)'|"([^"]+)"),[^\n]*?music: (\{[^}]*\})/g)) o[m[1]] = { name: m[2] || m[3], spec: Function('return ' + m[4])() }; return o; };
const now = specs(fs.readFileSync(path.join(ROOT, 'src/themes.js'), 'utf8')), before = oldEngine ? specs(gitShow('src/themes.js')) : {};
const NOTES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'], PC = { C: 0, 'C#': 1, DB: 1, D: 2, 'D#': 3, EB: 3, E: 4, F: 5, 'F#': 6, GB: 6, G: 7, 'G#': 8, AB: 8, A: 9, 'A#': 10, BB: 10, B: 11 };
const MODE = { major: 'major', minor: 'minor', dorian: 'dorian', lydian: 'lydian', phrygian: 'phrygian', mixolydian: 'mixolydian', harmonicMinor: 'harmonic minor', phrygianDominant: 'phrygian dominant', doubleHarmonic: 'double harmonic' };
const ACC = { polka: 'tuba oom-pah, clucks', barnyard: 'stomp-clap, walking bass', skip: 'skipping bass, shaker', squeeze: 'accordion polka, snare', bigband: 'brass chords, tuba, cymbals',
  hoedown: 'stomp-clap, walking bass', swing: 'swing: pizzicato bass, brushes', tiptoe: 'staccato low strings, wood block', jig: 'jig: bodhran, drone fifths', glade: 'soft off-beat plucks, shaker',
  waltz: 'waltz: harp arpeggios, sleigh sparkle', shimmer: 'pulsing arpeggio bass, hats', caravan: 'dum-tek hand drums, drone', gallop: 'sleigh bells, galloping bass', jungle: 'toms and shaker',
  charmer: 'frame drum, drone', shanty: 'stomps, a crew "ho!", accordion chords', calypso: 'calypso bass, bubble percussion', heroic: 'driving sixteenths, timpani', clockwork: 'tick-tock blocks, ratchet, pizzicato',
  spookwaltz: 'spooky waltz: low pluck, glassy chords', wardrum: 'war drums and toms', halftime: 'half-time drums, slow brass', heist: 'sneaky walking bass, finger snaps', tinker: 'bouncy bass, clap, wood blocks',
  swamp: 'swamp shuffle: jaw harp, brushes', shuffle: 'shuffle', bounce: 'bounce' };
const INSTN = { square: 'chiptune square', pluck: 'pluck', vibes: 'vibraphone', woodmarimba: 'marimba', musicbox: 'music box', shehnai: 'nasal reed', glass: 'glass bells', glock: 'glockenspiel', steel: 'steel drum', slide: 'slide guitar', jaw: 'jaw harp', pizz: 'pizzicato' };
const inst = (i) => INSTN[i] || i;
function describe(spec) {
  const T = TUNES[spec.tune]; if (!T) return '';
  const R = (T.arrs && spec.arr != null && T.arrs[spec.arr]) || {}, lead = (R.lead || T.lead).inst, tr = R.tr || 0;
  const root = NOTES[((PC[String(T.root).toUpperCase()] + tr) % 12 + 12) % 12];
  return [root + ' ' + (T.pent ? 'minor pentatonic' : MODE[T.scale] || T.scale), (R.bpm || T.bpm) + ' bpm', inst(lead), ACC[R.acc || T.acc] || ''].join(' · ');
}
const worlds = Object.entries(now).map(([id, w]) => {
  const T = TUNES[w.spec.tune] || {};
  return { id, name: w.name, spec: w.spec, tune: T.name || '', info: describe(w.spec), level2: !!T && w.spec.arr == null && !!w.spec.tune, old: before[id] ? before[id].spec : null };
});
const REBUILT = ['grab', 'release', 'ring_tick', 'squish', 'hen_hop', 'crow', 'level_win', 'strike_hit', 'rock_hit', 'fire_ignite', 'portal_enter', 'portal_exit', 'thunder',
  'snake_strike', 'tongue_lick', 'gator_snap', 'sal_charge', 'sal_yelp', 'puff_swell', 'creature_hurt', 'boss_roar', 'boss_slam'];
const MT = TUNES[MAIN_THEME.tune];
const GROUPS = [
  ['Eggs and rings', ['egg_save', 'combo', 'egg_bump', 'egg_land', 'egg_crack', 'egg_break', 'near_miss', 'squish', 'grab', 'release', 'ring_tick', 'motor_tick', 'gear_whir']],
  ['Winning and losing', ['star', 'level_win', 'level_fail', 'tada', 'cheer_up', 'confetti', 'unlock', 'countdown', 'score_tick', 'hud_pop', 'rewind']],
  ['The hen and her helpers', ['cluck', 'hen_hop', 'hen_land', 'flap', 'wing_bat', 'crow', 'goose_honk', 'decoy_peep', 'strike_launch', 'strike_hit']],
  ['Powers', ['power_pickup', 'power_use', 'fire_ignite', 'fire_burn', 'steel_on', 'steel_clang', 'bubble_on', 'bubble_pop', 'twin_hatch', 'portal_enter', 'portal_exit', 'bomb_fuse', 'bomb_explode', 'thunder', 'splash']],
  ['Villains', ['snake_hiss', 'snake_strike', 'rat_squeak', 'eagle_screech', 'eagle_dive', 'tongue_lick', 'gecko_chirp', 'frost_lick', 'sal_call', 'sal_charge', 'sal_breath', 'sal_yelp', 'sal_huff', 'fire_breath', 'ember_hiss', 'crab_snap', 'ink_squirt', 'gator_snap', 'mosquito', 'jelly_zap', 'puff_swell', 'creature_hurt', 'stun_stars', 'boss_roar', 'boss_slam']],
  ['The world', ['thorn_hit', 'thorn_snap', 'glass_crack', 'glass_break', 'rock_hit', 'wood_break', 'lava_sizzle', 'wind_gust']],
  ['Menus', ['ui_tap', 'ui_back', 'ui_open']],
];
const used = new Set(GROUPS.flatMap((g) => g[1]).concat(['weasel_chitter', 'weasel_snicker', 'weasel_sniff', 'weasel_yelp']));
for (const g of GROUPS) g[1] = g[1].filter((n) => !REBUILT.includes(n)); // the rebuilt ones have their own section
const rest = SFX_NAMES.filter((n) => !used.has(n));
if (rest.length) GROUPS.push(['Other', rest]);
for (const g of GROUPS) g[1] = g[1].filter((n) => SFX_NAMES.includes(n));
const DATA = {
  main: { spec: MAIN_THEME, name: MT.name, info: describe(MAIN_THEME), arrs: (MT.arrs || []).map((a, i) => ({ spec: { ...MAIN_THEME, arr: i }, name: a.name, info: describe({ ...MAIN_THEME, arr: i }) })) },
  others: Object.entries(TUNES).filter(([id]) => ['caper', 'sunny'].includes(id)).map(([id, T]) => ({ spec: { tune: id }, name: T.name, info: describe({ tune: id }) })),
  rebuilt: REBUILT.filter((n) => SFX_NAMES.includes(n)), hasOld: !!oldEngine, oldRef: OLD_REF,
  weasel: { old: [['weasel_chitter', 'Old chatter']], neu: [['weasel_snicker', 'Snicker (sneaks in, steals)'], ['weasel_sniff', 'Sniff (about to pounce)'], ['weasel_yelp', 'Yelp (bonked, chased off)']] },
  worlds, groups: GROUPS,
};
const html = fs.readFileSync(path.join(ROOT, 'tools/audio/soundboard.tpl.html'), 'utf8')
  .replace('/*__ENGINE__*/', () => engine).replace('/*__OLD_ENGINE__*/', () => oldEngine).replace('/*__DATA__*/', () => 'const DATA = ' + JSON.stringify(DATA) + ';');
fs.writeFileSync(out, html);
console.log('wrote', out, (html.length / 1024).toFixed(0) + ' KB', worlds.length + ' worlds', SFX_NAMES.length + ' sounds', DATA.rebuilt.length + ' rebuilt', oldEngine ? 'old engine from ' + OLD_REF : 'no old engine (same as ' + OLD_REF + ')');
