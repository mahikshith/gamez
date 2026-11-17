// Status-look QA lab (not part of the game bundle): bundles lab.js, opens a blank page and renders sheets of creatures
// in their normal / frozen / stunned looks at real phone scale. Usage:
//   node tools/status-lab/shoot.cjs <sheet> <out.png> [--art path/to/v3art.js]   (sheets are named in lab.js)
const path = require('path');
const fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
(async () => {
  const { build } = await import('esbuild');
  const args = process.argv.slice(2);
  const ai = args.indexOf('--art');
  const art = ai >= 0 ? path.resolve(args.splice(ai, 2)[1]) : null;
  const alias = { name: 'alias', setup(b) { if (art) b.onResolve({ filter: /v3art\.js$/ }, () => ({ path: art })); } };
  const res = await build({ entryPoints: [path.join(__dirname, 'lab.js')], bundle: true, write: false, format: 'iife', target: 'es2019', loader: { '.webp': 'dataurl' }, plugins: [alias], logLevel: 'error', define: { __DEV__: 'true', __PORTAL__: '"web"', __TEST__: 'false' } });
  const [sheet, out] = args;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  await p.setContent('<html><body style="margin:0;background:#222"><canvas id="c"></canvas></body></html>');
  await p.addScriptTag({ content: res.outputFiles[0].text });
  if (process.env.DBG) await p.evaluate((d) => Object.assign(window, JSON.parse(d)), process.env.DBG);
  const png = await p.evaluate((s) => { if (location.hash) {} return window.lab.sheet(s); }, sheet);
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, Buffer.from(png.split(',')[1], 'base64'));
  if (errs.length) console.log('ERRORS:\n' + errs.join('\n'));
  console.log('wrote', out);
  await b.close();
})();
