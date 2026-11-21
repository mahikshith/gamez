// p87 A/B: two builds side by side in one browser, level by level, alternating, so machine drift hits both alike.
// Usage: node tools/perf87/ab.cjs <a.html> <b.html> [ids=13,20,27,31,35,40,45,50] [tiers=high,low] [throttles=4,6]
// env: GPU=1 (GPU raster flags + SwiftShader), VIEW=393x851x2.75, N=40 measured frames, ROUNDS=4 (A,B,B,A,...), OUT=json
// Per level/tier/build: the level is played 20 s by the simulation alone (no drawing), drawn 40 frames to settle, then
//   flush  = median / p90 ms of one frame drawn + getImageData(0,0,1,1) (the raster forced), N frames, ROUNDS rounds A,B,A,B
//   calls  = draw calls a frame from the creature lane (all src/render files but world, ringart, fx, weather, boardart,
//            mapscene, mapamb, howto): fills, strokes, clips, drawImage, gradients made (stack-attributed, 2 frames)
//   fps@Nx = rAF fps (mean, worst gap) for 3 s with CDP CPU throttle N, the game's own loop running
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs');
const [A, B, ids = '13,20,27,31,35,40,45,50', tiers = 'high,low', thr = '4,6'] = process.argv.slice(2);
const N = +(process.env.N || 40), ROUNDS = +(process.env.ROUNDS || 4);
const files = [A, B].map((h) => { const L = fs.readFileSync(h, 'utf8').split('\n'), F = []; L.forEach((l, i) => { const m = /^ {2}\/\/ (src\/[\w/.-]+\.js)$/.exec(l); if (m) F.push([i + 1, m[1]]); }); return F; });
const OTHER = ['world', 'ringart', 'fx', 'weather', 'boardart', 'mapscene', 'mapamb', 'howto'];
const PORT = 8400 + Math.floor(Math.random() * 300);
const srv = http.createServer((q, r) => { const f = q.url.startsWith('/b') ? B : A; fs.readFile(f, (e, d) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(d); }); }).listen(PORT);
async function open(b, which) {
  const [VW, VH, VD] = (process.env.VIEW || '393x851x2.75').split('x').map(Number);
  const page = await b.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: VD, hasTouch: true });
  await page.addInitScript(() => { let s = 1; window.__seed = (n) => { s = n; }; Math.random = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); });
  page.on('pageerror', (e) => console.log('[pageerror]', which, e.message));
  await page.goto(`http://localhost:${PORT}/${which}`);
  await page.waitForFunction(() => window.__egg && __egg.G.screen === 'title', null, { timeout: 60000 });
  await page.evaluate(() => { const s = __egg.save; s.unlocked = 50; s.intro = new Proxy({}, { get: () => 1 }); s.seen.pickN = 5; s.seen = new Proxy(s.seen, { get: (o, k) => (k in o ? o[k] : 5) }); });
  return { page, cdp: await page.context().newCDPSession(page) };
}
// one evaluate from the seed to the last measured frame, so both builds draw the very same frames (the game's own loop
// cannot run in between)
const setup = (page, id, tier) => page.evaluate(({ id, tier }) => { __seed(777); const E = __egg; E.G.t = 100; E.save.gfx = tier; E.save.fps = 'auto'; E.perf.applySettings(); const i = E.LEVELS.findIndex((l) => l.id === id); E.start(i); E.press('go'); E.G.screen = 'play'; E.step(20); for (let f = 0; f < 40; f++) E.frame(1 / 60); return E.G.screen; }, { id, tier });
const page2 = (page, id, tier) => page.evaluate(({ id, tier, N }) => { __seed(777); const E = __egg; E.G.t = 100; E.save.gfx = tier; E.save.fps = 'auto'; E.perf.applySettings(); const i = E.LEVELS.findIndex((l) => l.id === id); E.start(i); E.press('go'); E.G.screen = 'play'; E.step(20); for (let f = 0; f < 40; f++) E.frame(1 / 60);
  const c = document.querySelector('canvas').getContext('2d'); const T = []; for (let f = 0; f < N; f++) { const t0 = performance.now(); E.frame(1 / 60); c.getImageData(0, 0, 1, 1); T.push(performance.now() - t0); } return T; }, { id, tier, N });
const flushRun = (page) => page.evaluate((N) => { const E = __egg, c = document.querySelector('canvas').getContext('2d'); const T = []; for (let f = 0; f < N; f++) { const t0 = performance.now(); E.frame(1 / 60); c.getImageData(0, 0, 1, 1); T.push(performance.now() - t0); } return T; }, N);
const calls = (page, FILES, OTHER) => page.evaluate(({ FILES, OTHER }) => {
  const E = __egg, main = document.querySelector('canvas').getContext('2d'), P = CanvasRenderingContext2D.prototype;
  const fileOf = (ln) => { let lo = 0, hi = FILES.length - 1, r = null; while (lo <= hi) { const m = (lo + hi) >> 1; if (FILES[m][0] <= ln) { r = FILES[m][1]; lo = m + 1; } else hi = m - 1; } return r; };
  const lane = () => { const o = Error.prepareStackTrace, l = Error.stackTraceLimit; Error.prepareStackTrace = (e, cs) => cs; Error.stackTraceLimit = 24; const cs = new Error().stack; Error.prepareStackTrace = o; Error.stackTraceLimit = l;
    for (let k = 2; k < cs.length; k++) { const f = fileOf(cs[k].getLineNumber()) || ''; if (!f.startsWith('src/render/')) { if (f.startsWith('src/')) return false; continue; } const s = f.slice(11, -3); if (s === 'castkit' || s === 'stamp') continue; return !OTHER.includes(s); } return false; };
  const names = ['fill', 'stroke', 'clip', 'drawImage', 'createLinearGradient', 'createRadialGradient'], orig = {}, n = {};
  for (const k of names) { orig[k] = P[k]; P[k] = function (...a) { if ((this === main || k.startsWith('create')) && lane()) n[k] = (n[k] || 0) + 0.5; return orig[k].apply(this, a); }; }
  try { E.frame(0); E.frame(0); } finally { for (const k of names) P[k] = orig[k]; }
  return n; }, { FILES, OTHER });
async function fps(page, cdp, rate) {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate }); await page.waitForTimeout(400);
  const r = await page.evaluate(() => new Promise((res) => { const iv = []; let last = 0; const t0 = performance.now(); function f(now) { if (last) iv.push(now - last); last = now; if (now - t0 < 3000) requestAnimationFrame(f); else { const avg = iv.reduce((a, b) => a + b, 0) / iv.length; res({ fps: +(1000 / avg).toFixed(1), worst: Math.round(Math.max(...iv)) }); } } requestAnimationFrame(f); }));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); return r;
}
const q = (T, p) => { const s = [...T].sort((a, b) => a - b); return +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(1); };
(async () => {
  const args = process.env.GPU ? ['--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--enable-accelerated-2d-canvas', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'];
  const b = await chromium.launch({ args });
  const P = [await open(b, 'a'), await open(b, 'b')];
  const all = [];
  console.log(`A=${A}\nB=${B}\n${process.env.GPU ? 'GPU raster' : 'default (software canvas raster)'}; flush ms = median/p90 of ${N * ROUNDS} frames`);
  for (const tier of tiers.split(',')) for (const id of ids.split(',').map(Number)) {
    const T = [[], []];
    for (let r = 0; r < ROUNDS; r++) for (const k of r % 2 ? [1, 0] : [0, 1]) T[k].push(...await page2(P[k].page, id, tier)); // A,B then B,A: the page measured second runs slower here
    const C = [await calls(P[0].page, files[0], OTHER), await calls(P[1].page, files[1], OTHER)];
    const F = [{}, {}];
    if (thr) for (const rate of thr.split(',').map(Number)) for (let k = 0; k < 2; k++) F[k][rate] = await fps(P[k].page, P[k].cdp, rate);
    const line = (k) => `flush ${q(T[k], 0.5)}/${q(T[k], 0.9)} | lane fill ${C[k].fill || 0} stroke ${C[k].stroke || 0} clip ${C[k].clip || 0} img ${C[k].drawImage || 0} grad ${(C[k].createLinearGradient || 0) + (C[k].createRadialGradient || 0)} | ${Object.entries(F[k]).map(([r, v]) => `${r}x ${v.fps}fps/${v.worst}ms`).join(' ')}`;
    console.log(`${tier.padEnd(6)} L${String(id).padEnd(3)} A ${line(0)}\n            B ${line(1)}`);
    all.push({ tier, id, A: { med: q(T[0], 0.5), p90: q(T[0], 0.9), calls: C[0], fps: F[0] }, B: { med: q(T[1], 0.5), p90: q(T[1], 0.9), calls: C[1], fps: F[1] } });
  }
  if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(all, null, 1));
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
