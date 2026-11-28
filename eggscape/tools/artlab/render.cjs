// node tools/artlab/render.cjs <script.js> <out.png> [w] [h]: bundles entry.js, runs the script (a function body with
// ctx, W, H, ART in scope) on a canvas, saves the PNG.
const { chromium } = require('playwright');
const esbuild = require('esbuild'); const fs = require('fs'); const path = require('path');
(async () => {
  const [, , scriptPath, out, w = 1024, h = 1024] = process.argv;
  const js = esbuild.buildSync({ entryPoints: [path.join(__dirname, 'entry.js')], bundle: true, write: false, format: 'iife', loader: { '.woff2': 'dataurl', '.webp': 'dataurl' }, define: { __PORTAL__: '"web"', __GD_ID__: '""', __DEV__: 'true', __TEST__: 'false', __APP__: 'false' } }).outputFiles[0].text;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +w, height: +h } });
  p.on('pageerror', (e) => console.log('ERR', String(e))); p.on('console', (m) => console.log('LOG', m.text()));
  await p.setContent(`<style>canvas{background:#557}</style><canvas id=c width=${w} height=${h}></canvas><style>body{margin:0}</style>`);
  await p.addScriptTag({ content: js });
  const body = fs.readFileSync(scriptPath, 'utf8');
  const data = await p.evaluate(async ([body]) => { await window.ARTREADY; const c = document.getElementById('c'), ctx = c.getContext('2d'); await (new Function('ctx', 'W', 'H', 'ART', 'return (async()=>{' + body + '})()'))(ctx, c.width, c.height, window.ART); return c.toDataURL('image/png'); }, [body]);
  fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64')); await b.close();
})();
