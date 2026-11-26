// Eggscape build: node tools/build.mjs [--target all|web|poki|crazygames|gamedistribution|youtube|app|ios] [--dev] [--entry path]
// --target app: Android WebView shell (portal 'web', real progression, own save key, __APP__ true). Never part of 'all'.
// --target ios: the iPhone shell (eggscape/ios, built with xtool). The web profile as it is (purchases and ads are not
// wired on iOS yet, so the game must see no money shop): __APP__ false; the shell sets window.EGG_APP and window.EggApp
// itself. The page is also copied to ios/Resources/game/, which xtool bundles into the app. Never part of 'all'.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { zipFiles } from './zip.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// the version shown in Settings: the Android versionName (the APK's), else package.json
const appVersion = (() => { try { const m = /versionName\s+'([^']+)'/.exec(readFileSync(join(ROOT, 'android/app/build.gradle'), 'utf8')); if (m) return m[1]; } catch (_) { /* no android shell */ } try { return JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version; } catch (_) { return ''; } })();
// 0.8.17: the Android versionCode beside the name (Settings' footer: "Eggscape 0.8.17 (25)"); '' without the shell
const appBuild = (() => { try { const m = /versionCode\s+(\d+)/.exec(readFileSync(join(ROOT, 'android/app/build.gradle'), 'utf8')); if (m) return m[1]; } catch (_) { /* no android shell */ } return ''; })();
const TARGETS = ['web', 'poki', 'crazygames', 'gamedistribution', 'youtube'];
const ALL_TARGETS = [...TARGETS, 'app', 'ios'];
const MAX_HTML = 5 * 1024 * 1024;
const MAX_GZIP = 2 * 1024 * 1024;

const HEAD = {
  web: '',
  app: '',
  ios: '',
  // poki/crazygames tags are async so a slow/blackholed SDK host can never block page load; the adapter waits for the global.
  poki: '<script async id="poki-sdk" onerror="window.__sdkFail=1" src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js"></script>',
  crazygames: '<script async id="cg-sdk" onerror="window.__sdkFail=1" src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>',
  gamedistribution: '', // adapter sets window.GD_OPTIONS then injects main.min.js itself
  youtube: '<script src="https://www.youtube.com/game_api/v1"></script>', // must precede game code
};

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def; };
const dev = args.includes('--dev');
const test = args.includes('--test'); // playtest build: everything unlocked, separate save
const targetArg = opt('--target', 'all');
const entry = resolve(ROOT, opt('--entry', 'src/main.js'));
const gdId = process.env.GD_GAME_ID || 'REPLACE_WITH_GD_GAME_ID';

if (targetArg !== 'all' && !ALL_TARGETS.includes(targetArg)) {
  console.error(`Unknown target "${targetArg}". Use all|${ALL_TARGETS.join('|')}`);
  process.exit(2);
}
if (!existsSync(entry)) { console.error(`Entry not found: ${entry}`); process.exit(2); }
if (!process.env.GD_GAME_ID && (targetArg === 'all' || targetArg === 'gamedistribution')) {
  console.warn('\n!! GD_GAME_ID is not set: the GameDistribution build carries a placeholder id and will not show ads.\n!! Register the game on gamedistribution.com, then rebuild with GD_GAME_ID=<id>.\n');
}

const template = readFileSync(join(ROOT, 'src/index.template.html'), 'utf8');
for (const ph of ['<!--PORTAL_HEAD-->', '<!--GAME_SCRIPT-->']) {
  if (!template.includes(ph)) { console.error(`Template missing ${ph}`); process.exit(2); }
}

const fmt = (n) => (n / 1024).toFixed(1).padStart(8) + ' KB';

async function bundle(portal, { minify, sourcemap }) {
  const isApp = portal === 'app';
  if (isApp || portal === 'ios') portal = 'web';
  const res = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: 'iife',
    target: 'es2019',
    minify,
    sourcemap: sourcemap ? 'inline' : false,
    legalComments: 'none',
    charset: 'utf8',
    loader: { '.woff2': 'dataurl', '.webp': 'dataurl' },
    define: {
      __PORTAL__: JSON.stringify(portal),
      __GD_ID__: JSON.stringify(gdId),
      __DEV__: JSON.stringify(!minify),
      __TEST__: JSON.stringify(test),
      __APP__: JSON.stringify(isApp),
      __VERSION__: JSON.stringify(appVersion),
      __BUILD__: JSON.stringify(appBuild),
      __PREVIEW__: JSON.stringify(process.env.EGG_PREVIEW || ''), // EGG_PREVIEW=spin: the build opens on the Lucky Spin with spins to pull (a page to show, nothing is saved)
    },
    logLevel: 'warning',
  });
  return res.outputFiles[0].text;
}

// Keep the inline script from terminating or confusing the HTML parser.
function escapeInline(js) {
  return js.split('</script').join('<\\/script').split('<!--').join('<\\!--');
}

function writeCredits(dir) {
  writeFileSync(join(dir, 'CREDITS.txt'),
`Eggscape
========
Game code, art and audio: original (art drawn in code, audio synthesized with WebAudio).

Third-party:
- planck.js (Box2D port) - MIT License - https://github.com/piqnt/planck.js
- Fredoka font (subset, embedded) - SIL Open Font License 1.1 - see LICENSE-font.txt
`);
  const ofl = join(ROOT, 'assets/fonts/OFL.txt');
  if (existsSync(ofl)) copyFileSync(ofl, join(dir, 'LICENSE-font.txt'));
  else console.warn('warning: assets/fonts/OFL.txt missing');
}

async function buildOne(label, portal, { minify, sourcemap, zip }) {
  const js = await bundle(portal, { minify, sourcemap });
  const html = template
    .replace('<!--PORTAL_HEAD-->', () => HEAD[portal])
    .replace('<!--GAME_SCRIPT-->', () => `<script>\n${escapeInline(js)}\n</script>`);
  const dir = join(ROOT, 'dist', label);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
  writeCredits(dir);
  let zipSize = 0;
  if (zip) {
    const zp = join(ROOT, 'dist', `eggscape-${label}.zip`);
    zipFiles(dir, ['index.html', 'CREDITS.txt', 'LICENSE-font.txt'].filter((f) => existsSync(join(dir, f))), zp);
    zipSize = statSync(zp).size;
  }
  const buf = Buffer.from(html, 'utf8');
  return { label, raw: buf.length, gz: gzipSync(buf, { level: 9 }).length, zip: zipSize };
}

const rows = [];
const list = test ? [] : targetArg === 'all' ? TARGETS : [targetArg];
mkdirSync(join(ROOT, 'dist'), { recursive: true });
for (const t of list) rows.push(await buildOne(t, t, { minify: !dev, sourcemap: false, zip: t !== 'app' && t !== 'ios' }));
if (list.includes('ios')) { // the page xtool bundles (ios/xtool.yml resources); generated, not committed (ios/.gitignore)
  const out = join(ROOT, 'ios/Resources/game');
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  for (const f of ['index.html', 'CREDITS.txt', 'LICENSE-font.txt']) if (existsSync(join(ROOT, 'dist/ios', f))) copyFileSync(join(ROOT, 'dist/ios', f), join(out, f));
  console.log('copied dist/ios -> ios/Resources/game');
}
if (test) rows.push(await buildOne('test', 'web', { minify: true, sourcemap: false, zip: false }));
if (dev) rows.push(await buildOne('dev', 'web', { minify: false, sourcemap: true, zip: false }));

console.log('\ntarget              index.html        gzip          zip');
let fail = false;
for (const r of rows) {
  console.log(`${r.label.padEnd(18)} ${fmt(r.raw)} ${fmt(r.gz)} ${r.zip ? fmt(r.zip) : '       -   '}`);
  if (r.label !== 'dev' && !dev && (r.raw > MAX_HTML || r.gz > MAX_GZIP)) {
    console.error(`FAIL: ${r.label} exceeds budget (html<=5MB, gzip<=2MB)`);
    fail = true;
  }
}
if (fail) process.exit(1);
