// garbage made per play frame (GC pauses are frame hitches too): CDP sampling heap profiler over 300 frames, the
// functions that allocate most (bytes per frame, self). Usage: node alloc.cjs [ids=20,27] [tier=low08]
const { open } = require('./lib.cjs');
(async () => { const { page, close } = await open(); const cdp = await page.context().newCDPSession(page);
  for (const id of (process.argv[2] || '20,27').split(',').map(Number)) {
    await page.evaluate(([id, tier]) => { const E = __egg, H = __h; H.startLevel(id, tier); for (let f = 0; f < 120; f++) { H.play(); E.frame(1 / 60); } }, [id, process.argv[3] || 'low08']);
    await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.startSampling', { samplingInterval: 4096, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
    const N = 300; await page.evaluate((N) => { const E = __egg, H = __h; for (let f = 0; f < N; f++) { H.play(); E.frame(1 / 60); } }, N);
    const { profile } = await cdp.send('HeapProfiler.stopSampling');
    const by = {}; let tot = 0;
    const walk = (n) => { const f = n.callFrame, k = (f.functionName || '(anon)') + ':' + (f.lineNumber + 1); const s = n.selfSize; if (s) { by[k] = (by[k] || 0) + s; tot += s; } (n.children || []).forEach(walk); };
    walk(profile.head);
    console.log('L' + id, 'KB/frame', (tot / N / 1024).toFixed(1), Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, v]) => k + '=' + (v / N / 1024).toFixed(1)).join(' '));
  }
  await close(); })();
