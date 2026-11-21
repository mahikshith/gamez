// p87 villain bench. Needs a dev build (node tools/build.mjs --target web --dev).
// Usage: node tools/perf87/vbench.cjs [ids=13,20,27,31,35,40,45,50] [tiers=high,medium,low] [throttles=4,6]
// env: GPU=1 launches Chromium with GPU-raster flags; VIEW=393x851x2.75; FRAMES=N sample frames; NOFPS=1 skip throttled fps;
//      CALLS=1 print per-file canvas call counts; OUT=file.json writes all numbers.
// Per level and tier:
//   flush   = mean ms of one play frame drawn + getImageData(0,0,1,1) (forces the raster), unhooked (p90 too)
//   hook    = the same frame re-drawn (frame(0)) with every draw call wrapped (stack-attributed), all calls drawn
//   skip    = the same frame re-drawn with the draw calls owned by LANE files skipped -> lane = hook - skip
//   per-file: canvas calls by the first src/render file on the stack (castkit/stamp count for their caller), and the
//             per-call raster time (getImageData before and after each draw call on the main canvas, minus the empty pair)
//   fps@Nx = rAF fps and world speed for 4 s with CDP CPU throttle N
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '../../dist/dev');
const [ids = '13,20,27,31,35,40,45,50', tiers = 'high,medium,low', thr = '4,6'] = process.argv.slice(2);
const HTML = process.env.HTML || path.join(dir, 'index.html'); // HTML=other/index.html benches another build (before/after)
const html = fs.readFileSync(HTML, 'utf8').split('\n');
const FILES = []; html.forEach((l, i) => { const m = /^ {2}\/\/ (src\/[\w/.-]+\.js)$/.exec(l); if (m) FILES.push([i + 1, m[1]]); });
const OTHER = ['world', 'ringart', 'fx', 'weather', 'boardart', 'mapscene', 'mapamb', 'howto', 'stamp', 'castkit'];
const PORT = 8600 + Math.floor(Math.random() * 300);
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; fs.readFile(u === '/' ? HTML : path.join(dir, u), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': 'text/html' }); r.end(d); }); }).listen(PORT);
const FR = +(process.env.FRAMES || 10);

async function measure(page, id, tier) {
  return page.evaluate(({ id, tier, FILES, OTHER, FR, calls, WARM, FN }) => {
    const E = __egg, G = E.G;
    E.save.gfx = tier; E.save.fps = 'auto'; E.perf.applySettings();
    const i = E.LEVELS.findIndex((l) => l.id === id); E.start(i); E.press('go'); G.screen = 'play';
    for (let f = 0; f < WARM * 60; f++) E.frame(1 / 60);
    const cv = document.querySelector('canvas'), main = cv.getContext('2d'), P = CanvasRenderingContext2D.prototype;
    const gid = P.getImageData, flush = () => gid.call(main, 0, 0, 1, 1);
    // 1) plain flushed cost
    const pl = []; for (let f = 0; f < 40; f++) { const t0 = performance.now(); E.frame(1 / 60); flush(); pl.push(performance.now() - t0); }
    pl.sort((a, b) => a - b);
    // attribution
    const fileOf = (ln) => { let lo = 0, hi = FILES.length - 1, r = null; while (lo <= hi) { const m = (lo + hi) >> 1; if (FILES[m][0] <= ln) { r = FILES[m][1]; lo = m + 1; } else hi = m - 1; } return r; };
    const lineCache = new Map();
    const short = (f) => f.replace('src/render/', '').replace('.js', '');
    const owner = () => {
      const old = Error.prepareStackTrace, lim = Error.stackTraceLimit; Error.prepareStackTrace = (e, cs) => cs; Error.stackTraceLimit = 24;
      const cs = new Error().stack; Error.prepareStackTrace = old; Error.stackTraceLimit = lim;
      let helper = null;
      for (let k = 2; k < cs.length; k++) { const ln = cs[k].getLineNumber(); let f = lineCache.get(ln); if (f === undefined) { f = fileOf(ln) || '?'; lineCache.set(ln, f); }
        if (!f.startsWith('src/render/')) { if (f.startsWith('src/')) return helper || short(f); continue; }
        const s = short(f); if (s === 'castkit' || s === 'stamp') { helper = helper || s; continue; } return FN ? s + ':' + (cs[k].getFunctionName() || 'anon@' + ln) : s; }
      return helper || '?';
    };
    const DRAW = ['fill', 'stroke', 'drawImage', 'fillRect', 'strokeRect', 'fillText', 'strokeText', 'clip', 'putImageData'];
    const COUNT = ['save', 'restore', 'beginPath', 'arc', 'ellipse', 'bezierCurveTo', 'quadraticCurveTo', 'lineTo', 'createLinearGradient', 'createRadialGradient', 'createPattern', 'getImageData', 'setLineDash', 'clearRect'];
    const orig = {}; for (const n of [...DRAW, ...COUNT]) orig[n] = P[n];
    const origCE = document.createElement;
    let mode = 'off', skipSet = null, stats = null, rast = null, empty = 0;
    const bump = (o, n, k = 1) => { o[n] = (o[n] || 0) + k; };
    const install = () => {
      for (const n of DRAW) P[n] = function (...a) {
        if (this !== main) return orig[n].apply(this, a);
        const o = owner();
        if (stats) { const s = stats[o] || (stats[o] = {}); bump(s, n); if (this.shadowBlur > 0 && this.shadowColor !== 'rgba(0, 0, 0, 0)') bump(s, 'BLUR'); if (this.filter && this.filter !== 'none') bump(s, 'FILTER'); if (this.globalAlpha < 1) bump(s, 'alpha<1'); if (this.globalCompositeOperation !== 'source-over') bump(s, 'gco'); }
        if (mode === 'skip' && skipSet(o) && n !== 'clip') return;
        if (rast) { flush(); const t0 = performance.now(); const r = orig[n].apply(this, a); flush(); bump(rast, o, performance.now() - t0 - empty); return r; }
        return orig[n].apply(this, a);
      };
      for (const n of COUNT) P[n] = function (...a) { if (stats && (this === main || n.startsWith('create') || n === 'getImageData')) { const o = owner(); const s = stats[o] || (stats[o] = {}); bump(s, n + (this === main ? '' : '@off')); } return orig[n].apply(this, a); };
      document.createElement = function (t, ...r) { if (stats && String(t).toLowerCase() === 'canvas') { const o = owner(); const s = stats[o] || (stats[o] = {}); bump(s, 'NEWCANVAS'); } return origCE.call(this, t, ...r); };
    };
    const uninstall = () => { for (const n of [...DRAW, ...COUNT]) P[n] = orig[n]; document.createElement = origCE; };
    const isLane = (o) => (o = o.split(':')[0], !OTHER.includes(o)) && o !== '?' && !o.startsWith('src/') && o !== 'main';
    // empty flush pair cost
    { let t = 0; for (let k = 0; k < 50; k++) { flush(); const t0 = performance.now(); flush(); t += performance.now() - t0; } empty = t / 50; }
    install();
    const hook = [], skip = [], perFrame = {}; let ownStats = {}; const rastSum = {};
    try {
      for (let f = 0; f < FR; f++) {
        uninstall(); for (let k = 0; k < 6; k++) E.frame(1 / 60); install();
        for (let rep = 0; rep < 2; rep++) {
          mode = 'full'; flush(); let t0 = performance.now(); E.frame(0); flush(); hook.push(performance.now() - t0);
          mode = 'skip'; skipSet = isLane; flush(); t0 = performance.now(); E.frame(0); flush(); skip.push(performance.now() - t0);
        }
        mode = 'full';
        if (f < 3) { stats = {}; E.frame(0); for (const [o, s] of Object.entries(stats)) { const d = ownStats[o] || (ownStats[o] = {}); for (const [k, v] of Object.entries(s)) bump(d, k, v / 3); } stats = null; }
        if (f < 3) { rast = {}; E.frame(0); for (const [o, v] of Object.entries(rast)) bump(rastSum, o, v / 3); rast = null; }
      }
    } finally { uninstall(); mode = 'off'; }
    const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length, med = (a) => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };
    const round = (o) => { for (const k in o) { if (typeof o[k] === 'number') o[k] = +o[k].toFixed(1); else if (o[k] && typeof o[k] === 'object') round(o[k]); } return o; };
    return round({ w: cv.width, h: cv.height, flush: avg(pl), p90: pl[Math.floor(pl.length * 0.9)], hook: med(hook), skip: med(skip), lane: med(hook) - med(skip), laneCalls: (() => { const L = {}; for (const [o, st] of Object.entries(ownStats)) if (isLane(o)) for (const k of ['fill', 'stroke', 'drawImage', 'clip', 'save', 'createLinearGradient', 'createRadialGradient', 'NEWCANVAS']) L[k] = (L[k] || 0) + (st[k] || 0); return L; })(), flushMed: pl[pl.length >> 1], rast: rastSum, stats: ownStats, empty, screen: G.screen, simT: G.sim.t });
  }, { id, tier, FILES, OTHER, FR, calls: !!process.env.CALLS, WARM: +(process.env.WARM || 20), FN: !!process.env.FN });
}
async function fps(page, cdp, rate) {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => new Promise((res) => { const E = __egg; const iv = []; let last = 0; const t0 = performance.now(); const simT0 = E.sim.t;
    function f(now) { if (last) iv.push(now - last); last = now; if (now - t0 < 4000) requestAnimationFrame(f); else { iv.sort((a, b) => a - b); const avg = iv.reduce((a, b) => a + b, 0) / iv.length; res({ fps: +(1000 / avg).toFixed(1), worst: +iv[iv.length - 1].toFixed(0), world: +((E.sim.t - simT0) / ((now - t0) / 1000)).toFixed(2) }); } }
    requestAnimationFrame(f); }));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  return r;
}
(async () => {
  const args = process.env.GPU ? ['--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--enable-accelerated-2d-canvas', ...(process.env.GPU === 'egl' ? ['--use-gl=egl'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])] : ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'];
  const b = await chromium.launch({ args });
  const [VW, VH, VD] = (process.env.VIEW || '393x851x2.75').split('x').map(Number);
  const page = await b.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: VD, hasTouch: true });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__egg && __egg.G.screen === 'title', null, { timeout: 60000 });
  const gpu = await page.evaluate(() => { const c = document.createElement('canvas').getContext('webgl'); const d = c && c.getExtension('WEBGL_debug_renderer_info'); return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'no webgl'; });
  console.log('renderer:', gpu, '| args', args.join(' '));
  await page.evaluate(() => { const s = __egg.save; s.unlocked = 50; s.intro = new Proxy({}, { get: () => 1 }); s.seen.pickN = 5; s.seen = new Proxy(s.seen, { get: (o, k) => (k in o ? o[k] : 5) }); });
  const cdp = await page.context().newCDPSession(page);
  const all = [];
  for (const tier of tiers.split(',')) for (const id of ids.split(',').map(Number)) {
    const m = await measure(page, id, tier);
    const f = {}; if (!process.env.NOFPS) for (const r of thr.split(',').map(Number)) f['fps@' + r + 'x'] = await fps(page, cdp, r);
    all.push({ tier, id, ...m, ...f });
    const top = Object.entries(m.rast).sort((a, b) => b[1] - a[1]).slice(0, +(process.env.TOP || 8)).map(([k, v]) => `${k} ${v}`).join(', ');
    console.log(`${tier.padEnd(6)} L${String(id).padEnd(3)} ${m.w}x${m.h} ${m.screen}@${m.simT}s flush ${m.flush} (med ${m.flushMed} p90 ${m.p90}) | hooked ${m.hook} skipLane ${m.skip} => lane ${m.lane} | ${Object.entries(f).map(([k, v]) => `${k} ${v.fps}/${v.worst}ms w${v.world}`).join(' ')}`);
    console.log(`        raster ms/file: ${top}`);
    console.log(`        lane calls/frame: ${Object.entries(m.laneCalls).map(([k, v]) => k + ' ' + Math.round(v)).join(', ')}`);
    if (process.env.CALLS) for (const [o, s] of Object.entries(m.stats).sort((a, b) => (b[1].fill || 0) + (b[1].stroke || 0) - (a[1].fill || 0) - (a[1].stroke || 0)).slice(0, 10)) console.log(`          ${o.padEnd(12)} ${JSON.stringify(s)}`);
  }
  if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(all, null, 1));
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
