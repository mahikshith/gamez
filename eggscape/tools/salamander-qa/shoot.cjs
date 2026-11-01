// Salamander art QA: bundles harness.js, loads the real dev build, renders film strips at in-game scale.
// Usage: node tools/build.mjs --dev && node tools/salamander-qa/shoot.cjs [scenario ...]
// Writes PNGs to eggscape/qa/salamander/ (git-ignored).
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '../..');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const OUT = path.join(ROOT, 'qa/salamander');
const ALL = ['walk', 'turn', 'idle', 'breath', 'hiss', 'dazed', 'flee', 'level', 'head', 'blend'];
const NAMES = { perf: 'perf-scratch', headbig: 'x-headbig', studio: 'x-studio', walk: '1-walk', turn: '2-turn-gap', idle: '3-idle', breath: '4-breath', hiss: '5-hiss-cool', dazed: '6-dazed', flee: '7-flee', level: '8-level', head: '9-head-2x', blend: '10-blend' };

(async () => {
  const { build } = await import('esbuild');
  const res = await build({ entryPoints: [path.join(__dirname, 'harness.js')], bundle: true, write: false, format: 'iife', target: 'es2019', loader: { '.webp': 'dataurl' } });
  const js = res.outputFiles[0].text;
  fs.mkdirSync(OUT, { recursive: true });
  const list = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.addInitScript(() => { window.requestAnimationFrame = () => 0; }); // we drive frames by hand
  await p.goto('file://' + path.join(ROOT, 'dist/dev/index.html'));
  await p.waitForFunction(() => window.__egg && window.__egg.G, null, { timeout: 15000 });
  await p.waitForTimeout(500);
  await p.addScriptTag({ content: js });
  for (const name of list) {
    const t0 = Date.now();
    const r = await p.evaluate((n) => window.__salqa.S[n](), name);
    const f = path.join(OUT, `${NAMES[name] || name}.png`);
    fs.writeFileSync(f, Buffer.from(r.png.split(',')[1], 'base64'));
    console.log(name, '->', f, r.info ? JSON.stringify(r.info) : '', `${Date.now() - t0}ms`);
  }
  if (errs.length) console.log('PAGE ERRORS:\n' + errs.join('\n'));
  await b.close();
})();
