#!/usr/bin/env node
// Builds one HTML page with the game's own audio engine inside it: every sound effect, every world's music and the
// theme tune candidates, each on a button, so the owner can listen on a phone and say what he likes.
//   node tools/audio/soundboard.mjs <out.html>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = process.argv[2];
if (!out) { console.error('usage: soundboard.mjs <out.html>'); process.exit(1); }
const r = await build({ entryPoints: [path.join(ROOT, 'src/audio.js')], bundle: true, format: 'iife', globalName: 'EggAudio', minify: true, write: false, target: 'es2019' });
const engine = r.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const { SFX_NAMES, TUNES } = await import(path.join(ROOT, 'src/audio.js'));
// every world's music spec, read as text from themes.js (so no canvas code runs here)
const src = fs.readFileSync(path.join(ROOT, 'src/themes.js'), 'utf8'), worlds = [];
for (const m of src.matchAll(/\{ id: '(\w+)', name: '([^']+)',[^\n]*?music: (\{[^}]*\})/g)) worlds.push({ id: m[1], name: m[2], spec: Function('return ' + m[3])() });
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
const rest = SFX_NAMES.filter((n) => !used.has(n));
if (rest.length) GROUPS.push(['Other', rest]);
for (const g of GROUPS) g[1] = g[1].filter((n) => SFX_NAMES.includes(n));
const DATA = {
  tunes: Object.entries(TUNES).map(([id, T]) => ({ id, name: T.name, bpm: T.bpm })),
  weasel: { old: [['weasel_chitter', 'Old chatter']], neu: [['weasel_snicker', 'Snicker (sneaks in, steals)'], ['weasel_sniff', 'Sniff (about to pounce)'], ['weasel_yelp', 'Yelp (bonked, chased off)']] },
  worlds, groups: GROUPS,
};
const html = fs.readFileSync(path.join(ROOT, 'tools/audio/soundboard.tpl.html'), 'utf8')
  .replace('/*__ENGINE__*/', () => engine).replace('/*__DATA__*/', () => 'const DATA = ' + JSON.stringify(DATA) + ';');
fs.writeFileSync(out, html);
console.log('wrote', out, (html.length / 1024).toFixed(0) + ' KB', worlds.length + ' worlds', SFX_NAMES.length + ' sounds');
