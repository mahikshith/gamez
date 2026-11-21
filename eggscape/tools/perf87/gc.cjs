// GC and allocation during real-time play (rAF loop, not __egg.frame). Usage:
//   node tools/build.mjs --target web --dev && node tools/perf87/gc.cjs [ids=20,45] [--secs 20] [--throttle 4] [--gfx high]
// Phone-sized page (393x851 @2.75x), CDP CPU throttle. Reports per level: frames, allocation per frame (sampling heap
// profiler incl. objects already collected), GC events (count, total and longest pause, from a trace), and the top
// allocating functions (bundle line -> source file via esbuild's "// src/..." markers).
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '../../dist/dev');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const ids = (args[0] && !args[0].startsWith('--') ? args[0] : '20,45').split(',').map(Number);
const SECS = +opt('--secs', 20), THR = +opt('--throttle', 4), GFX = opt('--gfx', 'high');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8').split('\n');
const marks = []; html.forEach((l, i) => { const m = /^\s*\/\/ (src\/\S+)/.exec(l); if (m) marks.push([i, m[1]]); });
const srcOf = (line) => { let f = '?'; for (const [i, n] of marks) { if (i > line) break; f = n; } return f; };
const PORT = 8600 + Math.floor(Math.random() * 300);
const srv = http.createServer((q, r) => { fs.readFile(path.join(dir, 'index.html'), (e, d) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(d); }); }).listen(PORT);
(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2.75, hasTouch: true });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__egg && __egg.G.screen === 'title', null, { timeout: 90000 });
  await page.evaluate((gfx) => { const E = __egg; const s = E.save; s.unlocked = 50; s.intro = new Proxy({}, { get: () => 1 }); s.seen.pickN = 5; s.gfx = gfx; s.fps = 60; E.perf.applySettings(); }, GFX);
  const cdp = await page.context().newCDPSession(page);
  for (const id of ids) {
    await page.evaluate((id) => { const E = __egg, i = E.LEVELS.findIndex((l) => l.id === id); E.start(i); E.press('go'); try { E.press('stk:gotit'); E.press('gotit'); } catch (_) {} }, id);
    await page.waitForTimeout(1500);
    // keep turning rings like a player, and count real frames
    await page.evaluate(() => {
      const E = __egg; window.__fr = { n: 0, gaps: [] }; let last = 0;
      const f = (t) => { if (last) __fr.gaps.push(t - last); last = t; __fr.n++; if (!__fr.stop) requestAnimationFrame(f); }; requestAnimationFrame(f);
      let rr = 7; const rnd = () => ((rr = (rr * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      __fr.iv = setInterval(() => { const s = E.G.sim; if (!s) return; const R = s.rings[Math.floor(rnd() * s.rings.length)]; if (R && !R.motor) R.target = R.body.getAngle() + (rnd() < 0.5 ? -1 : 1) * (0.3 + rnd()); }, 400);
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: THR });
    await cdp.send('HeapProfiler.enable');
    await cdp.send('HeapProfiler.collectGarbage');
    await cdp.send('HeapProfiler.startSampling', { samplingInterval: 4096, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
    const events = [];
    cdp.on('Tracing.dataCollected', (d) => { for (const e of d.value) events.push(e); });
    const done = new Promise((res) => cdp.once('Tracing.tracingComplete', res));
    await cdp.send('Tracing.start', { categories: 'v8,disabled-by-default-v8.gc,devtools.timeline', transferMode: 'ReportEvents' });
    const f0 = await page.evaluate(() => { __fr.n = 0; __fr.gaps = []; return performance.now(); });
    await page.waitForTimeout(SECS * 1000);
    const fr = await page.evaluate(() => { const g = __fr.gaps.slice().sort((a, b) => a - b); return { n: __fr.n, p50: g[g.length >> 1], p95: g[Math.floor(g.length * 0.95)], max: g[g.length - 1], screen: __egg.G.screen, state: __egg.G.sim && __egg.G.sim.state }; });
    await cdp.send('Tracing.end'); await done;
    const prof = await cdp.send('HeapProfiler.stopSampling');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await page.evaluate(() => { __fr.stop = 1; clearInterval(__fr.iv); });
    // allocation by function (self)
    const by = new Map(); let total = 0;
    const walk = (n) => { const cf = n.callFrame; const key = `${cf.functionName || '(anon)'} @${cf.lineNumber + 1}`; const v = n.selfSize; total += v; if (v) by.set(key, (by.get(key) || 0) + v); for (const c of n.children) walk(c); };
    walk(prof.profile.head);
    const gcs = events.filter((e) => e.ph === 'X' && /^(MinorGC|MajorGC|V8\.GCScavenger|V8\.GCFinalizeMC|V8\.GC_MC_BACKGROUND|ScavengeGC|V8\.GCIncrementalMarking|V8\.GCCompactor)$/.test(e.name));
    const sum = {}; for (const e of gcs) { const s = sum[e.name] || (sum[e.name] = { n: 0, ms: 0, max: 0 }); s.n++; s.ms += e.dur / 1000; s.max = Math.max(s.max, e.dur / 1000); }
    console.log(`\nL${id} gfx=${GFX} throttle ${THR}x ${SECS}s: frames ${fr.n} (${(fr.n / SECS).toFixed(1)} fps) gap p50 ${fr.p50 && fr.p50.toFixed(1)} p95 ${fr.p95 && fr.p95.toFixed(1)} max ${fr.max && fr.max.toFixed(0)} [${fr.screen}/${fr.state}]`);
    console.log(`  allocated ~${(total / 1048576).toFixed(1)} MB = ${(total / Math.max(1, fr.n) / 1024).toFixed(1)} KB/frame, ${(total / SECS / 1048576).toFixed(2)} MB/s`);
    for (const [k, s] of Object.entries(sum)) console.log(`  ${k}: ${s.n}x total ${s.ms.toFixed(1)} ms, longest ${s.max.toFixed(1)} ms`);
    const top = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, +opt('--top', 18));
    for (const [k, v] of top) { const ln = +k.split('@')[1]; console.log(`  ${(v / SECS / 1024).toFixed(1).padStart(7)} KB/s  ${k.padEnd(40)} ${srcOf(ln - 1)}  | ${(html[ln - 1] || '').trim().slice(0, 90)}`); }
    await page.evaluate(() => { __egg.G.paused = false; });
  }
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
