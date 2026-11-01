// Screenshots every theme in tools/backdrop-preview.html at portrait + landscape, builds a contact sheet,
// and benchmarks draw(). Usage: node tools/shoot-backdrops.cjs [themeId,...] [--bench] [--sizes=390x844,1280x720]
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(__dirname, 'shots');
const args = process.argv.slice(2);
const only = args.find((a) => !a.startsWith('--'));
const bench = args.includes('--bench');
const sizesArg = (args.find((a) => a.startsWith('--sizes=')) || '').slice(8);
const SIZES = (sizesArg || '390x844,1280x720').split(',').map((s) => s.split('x').map(Number));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  // `import url from '...webp'` (esbuild dataurl loader in the real build): answer module requests with a data-URL module
  if (p.endsWith('.webp') && req.headers['sec-fetch-dest'] === 'script') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(`export default "data:image/webp;base64,${fs.readFileSync(p).toString('base64')}";`); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
  await page.goto(`${base}/tools/backdrop-preview.html?ui=0&t=0`);
  const ids = only ? only.split(',') : await page.evaluate(async () => (await import('/src/themes.js')).THEMES.map((t) => t.id));
  const shots = [];
  for (const id of ids) for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`${base}/tools/backdrop-preview.html?theme=${id}&w=${w}&h=${h}&dpr=${process.env.DPR||1}&t=${process.env.T||3.7}&ui=0`);
    await page.waitForFunction(() => window.__ready);
    const file = path.join(OUT, `${id}-${w}x${h}.png`);
    await page.screenshot({ path: file }); shots.push({ id, w, h, file });
    if (bench) {
      const r = await page.evaluate(() => window.bench(240));
      const rz = await page.evaluate(() => window.resizeMs());
      console.log(`${id} ${w}x${h}`, JSON.stringify(r), 'resize', rz, 'ms');
    }
  }
  console.log('shots:', shots.length);
  {
    // contact sheet: 20 rows x (portrait + landscape), 4 themes per row
    const sheet = await browser.newPage();
    await sheet.setViewportSize({ width: 1600, height: 900 });
    await sheet.goto(`${base}/tools/backdrop-preview.html?ui=0&t=0&theme=farm&w=10&h=10`);
    const data = shots.map((s) => ({ id: s.id, w: s.w, h: s.h, url: `/tools/shots/${path.basename(s.file)}` }));
    const dims = await sheet.evaluate(async (data) => {
      document.body.innerHTML = ''; document.body.style.overflow = 'visible'; document.body.style.background = '#1b1b1f';
      const ids = [...new Set(data.map((d) => d.id))];
      const per = data.length <= 8 ? 2 : 4, ph = data.length <= 8 ? 420 : 300, pw = Math.round(390 / 844 * ph), lw = Math.round(1280 / 720 * ph), pad = 10, lab = 18;
      const cellW = pw + lw + pad * 3, cellH = ph + pad * 2 + lab;
      const cv = document.createElement('canvas'); cv.width = cellW * per; cv.height = cellH * Math.ceil(ids.length / per);
      document.body.appendChild(cv); const c = cv.getContext('2d'); c.fillStyle = '#1b1b1f'; c.fillRect(0, 0, cv.width, cv.height);
      const load = (u) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = u; });
      for (let k = 0; k < ids.length; k++) {
        const x0 = (k % per) * cellW, y0 = Math.floor(k / per) * cellH;
        c.fillStyle = '#ddd'; c.font = '600 13px system-ui'; c.fillText(`${k + 1}. ${ids[k]}`, x0 + pad, y0 + 14);
        const p = data.find((d) => d.id === ids[k] && d.w < d.h), l = data.find((d) => d.id === ids[k] && d.w > d.h);
        if (p) c.drawImage(await load(p.url), x0 + pad, y0 + lab + pad, pw, ph);
        if (l) c.drawImage(await load(l.url), x0 + pad * 2 + pw, y0 + lab + pad, lw, ph);
      }
      cv.style.display = 'block'; return { w: cv.width, h: cv.height };
    }, data);
    await sheet.setViewportSize({ width: dims.w, height: dims.h });
    await sheet.screenshot({ path: path.join(OUT, only ? 'subset-contact.png' : 'backdrops-contact.png'), clip: { x: 0, y: 0, width: dims.w, height: dims.h } });
    console.log('contact sheet', dims);
  }
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
