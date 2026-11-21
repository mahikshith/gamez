// shared harness for the perf87 benches (2026-11-20 stutter pass, world-layer lane). Needs a dev build.
// env: VIEW=393x851x2.6 (phone), GPU=1 (launch Chromium with GPU-raster flags), DIST=path to dist/dev
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dir = process.env.DIST || path.join(__dirname, '../../dist/dev');
async function open() {
  const PORT = 8100 + Math.floor(Math.random() * 800);
  const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; fs.readFile(path.join(dir, u === '/' ? 'index.html' : u), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': 'text/html' }); r.end(d); }); }).listen(PORT);
  const args = process.env.GPU === '1' ? ['--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--enable-accelerated-2d-canvas', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    : process.env.GPU === '0' ? ['--disable-gpu', '--disable-accelerated-2d-canvas', '--disable-gpu-rasterization'] : [];
  const b = await chromium.launch({ args });
  const [VW, VH, VD] = (process.env.VIEW || '393x851x2.6').split('x').map(Number);
  const page = await b.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: VD, hasTouch: true });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.addInitScript(INIT);
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__egg && __egg.G.screen === 'title', null, { timeout: 60000 });
  await page.evaluate(() => { const s = __egg.save; s.unlocked = 50; s.intro = new Proxy({}, { get: () => 1 }); s.seen.pickN = 5; s.fps = 60; });
  const close = async () => { await b.close(); srv.close(); };
  return { b, page, close };
}
// page helpers, installed before the game loads
const INIT = () => {
  const P = CanvasRenderingContext2D.prototype, H = window.__h = { on: false, main: null, n: {}, imgs: [], rects: [], bakes: new Map(), alphaFull: 0 };
  const main = () => H.main || (H.main = document.querySelector('canvas') && document.querySelector('canvas').getContext('2d'));
  const inc = (k, v = 1) => { H.n[k] = (H.n[k] || 0) + v; };
  const devArea = (m, w, h) => Math.abs(m.a * m.d - m.b * m.c) * w * h;
  const wrapDraw = (name) => { const o = P[name]; P[name] = function (...a) {
    if (H.on) {
      if (this.shadowBlur > 0 && this.shadowColor !== 'rgba(0, 0, 0, 0)') inc('shadowBlur');
      if (this.filter && this.filter !== 'none') inc('filter');
      if (this === main()) {
        inc('main.' + name);
        if (H.ops) { const st = (new Error().stack.split('\n')[2] || '').trim().split(' ')[1]; H.ops[st] = (H.ops[st] || 0) + 1; }
        const m = this.getTransform(), cw = this.canvas.width, ch = this.canvas.height;
        if (name === 'drawImage') {
          const src = a[0], sw = a.length >= 9 ? a[3] : (src.width || 0), sh = a.length >= 9 ? a[4] : (src.height || 0);
          const dw = a.length >= 9 ? a[7] : a.length >= 5 ? a[3] : sw, dh = a.length >= 9 ? a[8] : a.length >= 5 ? a[4] : sh;
          const area = Math.min(devArea(m, dw, dh), cw * ch * 4), sx = Math.hypot(m.a, m.b) * dw / Math.max(1, sw);
          H.imgs.push({ sw: Math.round(sw), sh: Math.round(sh), area, scale: +sx.toFixed(2), rot: Math.abs(m.b) > 1e-6, alpha: this.globalAlpha, op: this.globalCompositeOperation, st: (new Error().stack.split('\n')[2] || '').trim().split(' ')[1] });
        } else if (name === 'fillRect') {
          const area = Math.min(devArea(m, Math.abs(a[2]), Math.abs(a[3])), cw * ch * 4);
          H.rects.push({ area, alpha: this.globalAlpha, grad: typeof this.fillStyle !== 'string', st: (new Error().stack.split('\n')[2] || '').trim().split(' ')[1] });
        }
      } else {
        const cv = this.canvas; let e = H.bakes.get(cv);
        if (!e) H.bakes.set(cv, (e = { w: cv.width, h: cv.height, calls: 0, st: (new Error().stack.split('\n')[3] || '').trim().split(' ')[1] }));
        e.calls++;
      }
    }
    return o.apply(this, a); }; };
  ['drawImage', 'fillRect', 'fill', 'stroke', 'fillText', 'strokeText', 'clearRect', 'putImageData'].forEach(wrapDraw);
  for (const g of ['createLinearGradient', 'createRadialGradient', 'createPattern', 'clip']) { const o = P[g]; P[g] = function (...a) { if (H.on) { inc((this === main() ? 'main.' : 'off.') + g); if (H.ops && g !== 'clip') { const st = 'G:' + (new Error().stack.split('\n')[2] || '').trim().split(' ')[1]; H.ops[st] = (H.ops[st] || 0) + 1; } } return o.apply(this, a); }; }
  const ce = Document.prototype.createElement;
  Document.prototype.createElement = function (t, ...a) { const el = ce.call(this, t, ...a); if (H.on && String(t).toLowerCase() === 'canvas') inc('canvasCreated'); return el; };
  const wd = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width');
  Object.defineProperty(HTMLCanvasElement.prototype, 'width', { get() { return wd.get.call(this); }, set(v) { if (H.on) inc('canvasResized'); wd.set.call(this, v); } });
  H.reset = () => { H.ops = null; H.n = {}; H.imgs = []; H.rects = []; H.bakes = new Map(); };
  // a deterministic "player": turns a random ring a little, as perf-tiers.cjs does
  let rr = 7, ring = 0, until = 0, dir = 1; const rnd = () => ((rr = (rr * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  H.play = () => { const s = __egg.sim; if (!s || !s.rings) return; if (s.t >= until) { ring = Math.floor(rnd() * s.rings.length); dir = rnd() < 0.5 ? -1 : 1; until = s.t + 0.3 + rnd() * 1.5; } const R = s.rings[ring]; if (R && !R.motor) R.target = R.body.getAngle() + 0.5 * dir; };
  H.seed = (n) => { rr = n; until = 0; };
  H.flush = () => main().getImageData(0, 0, 1, 1);
  // tier 'low08' = Low at 0.8x pixels (Auto's last step, where the owner's phone sits)
  H.startLevel = (id, tier) => { const E = __egg, G = E.G; if (tier === 'low08') { E.save.gfx = 'auto'; E.save.gfxStep = 5; E.perf.applySettings(); } else if (tier) { E.save.gfx = tier; E.perf.applySettings(); } const i = E.LEVELS.findIndex((l) => l.id === id); E.start(i); E.press('go'); for (const b of ['stk:gotit', 'gotit']) try { E.press(b); } catch (_) {} G.screen = 'play'; H.seed(7 + id); };
};
module.exports = { open };
