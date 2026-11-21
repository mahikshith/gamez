// Play-frame cost per level and graphics tier, with a layer breakdown (2026-11-20 stutter pass, world-layer lane).
// Usage: node tools/perf87/bench.cjs [ids=1,13,20,27,35,44,50] [tiers=low,medium,high] [throttles=4,6] [parts=flush,layers,count,churn,fps]
// env VIEW=393x851x2.6 GPU=1|0 OUT=file.json
//  flush   one play frame drawn + getImageData(0,0,1,1) (forces raster): mean / p90 ms over 40 frames
//  layers  the same frame with a flush after every layer (G.probe segments in main.js render() + wrapped backdrop,
//          weather and particle calls): ms per layer, mean of 20 frames. Each flush costs a little; compare rows.
//  count   one frame: device pixels written by drawImage / fillRect on the main canvas over the canvas area
//          ("overdraw"), full-screen ops, scaled or rotated copies of big pictures, gradients, shadow/filter use,
//          offscreen canvases painted (bakes)
//  churn   10 s (600 frames) of play with rings turning: stamp builds, ring body / face builds, canvases created /
//          resized, offscreen pixels painted per second
//  fps     real-time rAF loop for 4 s under CDP CPU throttle (each throttle): fps and p95 frame gap
const { open } = require('./lib.cjs');
const [ids = '1,13,20,27,35,44,50', tiers = 'low,medium,high', thr = '4,6', parts = 'flush,layers,count,churn,fps'] = process.argv.slice(2);
const want = new Set(parts.split(','));
(async () => {
  const { page, close } = await open();
  const cdp = await page.context().newCDPSession(page);
  const all = [];
  for (const tier of tiers.split(',')) for (const id of ids.split(',').map(Number)) {
    const row = await page.evaluate(([id, tier, want]) => {
      const E = __egg, G = E.G, H = __h, out = { tier, id };
      H.startLevel(id, tier);
      for (let f = 0; f < 180; f++) { H.play(); E.frame(1 / 60); }
      const cv = document.querySelector('canvas'); out.canvas = cv.width + 'x' + cv.height;
      const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2); };
      if (want.includes('flush')) {
        const ts = []; for (let f = 0; f < 40; f++) { H.play(); H.flush(); const t0 = performance.now(); E.frame(1 / 60); H.flush(); ts.push(performance.now() - t0); }
        out.flush = { mean: +(ts.reduce((a, b) => a + b, 0) / ts.length).toFixed(2), p90: q(ts, 0.9) };
      }
      if (want.includes('layers')) {
        const acc = {}; let last = 0;
        const add = (k, v) => { acc[k] = (acc[k] || 0) + v; };
        // canvas calls per layer on the main canvas (fill + stroke + clip + gradients), from one extra frame
        const opsOf = () => { const n = H.n; return (n['main.fill'] || 0) + (n['main.stroke'] || 0) + (n['main.clip'] || 0) + (n['main.createLinearGradient'] || 0) + (n['main.createRadialGradient'] || 0) + (n['main.drawImage'] || 0) + (n['main.fillRect'] || 0); };
        { const ops = {}; let o0 = 0; H.reset(); H.on = true; G.probe = (name) => { const o = opsOf(); ops[name] = (ops[name] || 0) + o - o0; o0 = o; }; H.play(); E.frame(1 / 60); H.on = false; G.probe = null; out.layerOps = ops; }
        G.probe = (name) => { H.flush(); const n = performance.now(); add('seg.' + name, n - last); last = n; };
        const wrap = (obj, m, label) => { const o = obj[m]; obj[m] = function (...a) { H.flush(); const t0 = performance.now(); const r = o.apply(this, a); H.flush(); add(label, performance.now() - t0); return r; }; return () => { obj[m] = o; }; };
        const un = [wrap(G.backdrop, 'draw', 'backdrop.draw'), wrap(G.backdrop, 'drawGround', 'backdrop.ground'), wrap(G.backdrop, 'drawAmbient', 'backdrop.ambient'), wrap(G.weather, 'drawBack', 'weather.back'), wrap(G.weather, 'drawFront', 'weather.front'), wrap(G.fx, 'draw', 'fx.draw')];
        const N = 20; let tot = 0;
        for (let f = 0; f < N; f++) { H.play(); H.flush(); last = performance.now(); const t0 = last; E.frame(1 / 60); H.flush(); const n = performance.now(); add('seg.(end)', n - last); tot += n - t0; }
        un.forEach((u) => u()); G.probe = null;
        out.layers = Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, +(v / N).toFixed(2)]));
        out.layersTotal = +(tot / N).toFixed(2);
      }
      if (want.includes('count')) {
        H.play(); H.reset(); H.ops = {}; H.on = true; E.frame(1 / 60); H.on = false;
        const A = cv.width * cv.height, big = (i) => i.sw * i.sh > 200 * 200;
        const imgA = H.imgs.reduce((a, i) => a + i.area, 0), rectA = H.rects.reduce((a, i) => a + i.area, 0);
        const full = [...H.imgs, ...H.rects].filter((i) => i.area > 0.6 * A);
        const byFn = {}; for (const i of [...H.imgs, ...H.rects]) byFn[i.st] = (byFn[i.st] || 0) + i.area / A;
        out.count = { overdraw: +((imgA + rectA) / A).toFixed(2), imgOverdraw: +(imgA / A).toFixed(2), fullScreenOps: full.length, fullAlpha: full.filter((i) => i.alpha < 1).length,
          drawImage: H.imgs.length, bigScaled: H.imgs.filter((i) => big(i) && Math.abs(i.scale - 1) > 0.03).map((i) => `${i.sw}x${i.sh}@${i.scale}${i.rot ? 'r' : ''}:${i.st}`).slice(0, 12),
          bigRotated: H.imgs.filter((i) => big(i) && i.rot).length, n: H.n, bakesThisFrame: [...H.bakes.values()].map((b) => `${b.w}x${b.h}:${b.st}`).slice(0, 10),
          ops: Object.entries(H.ops).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => k + '=' + v), topArea: Object.entries(byFn).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => k + '=' + v.toFixed(2)) };
      }
      if (want.includes('churn')) {
        const s0 = E.stampStats.builds, b0 = E.perf.bodyCache.builds, r0 = E.perf.ringCache.builds;
        H.reset(); H.on = true; let px = 0, bakeFrames = 0; const bs = {};
        for (let f = 0; f < 600; f++) { H.play(); H.bakes = new Map(); E.frame(1 / 60); if (H.bakes.size) bakeFrames++; for (const b of H.bakes.values()) { px += b.w * b.h; bs[b.st] = (bs[b.st] || 0) + 1; } }
        H.on = false;
        out.churn = { stampBuilds: E.stampStats.builds - s0, bodyBuilds: E.perf.bodyCache.builds - b0, faceBuilds: E.perf.ringCache.builds - r0, canvasCreated: H.n.canvasCreated || 0, canvasResized: H.n.canvasResized || 0,
          bakeFrames, offscreenMpxPerSec: +(px / 10 / 1e6).toFixed(2), gradientsPerFrame: +(((H.n['main.createLinearGradient'] || 0) + (H.n['main.createRadialGradient'] || 0) + (H.n['off.createLinearGradient'] || 0) + (H.n['off.createRadialGradient'] || 0)) / 600).toFixed(1),
          bakers: Object.entries(bs).sort((a, b) => b[1] - a[1]).slice(0, 8) };
      }
      return out;
    }, [id, tier, [...want]]);
    if (want.has('fps')) {
      row.fps = {};
      for (const t of thr.split(',').map(Number)) {
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: t });
        await page.waitForTimeout(500);
        row.fps['x' + t] = await page.evaluate(() => new Promise((res) => { const E = __egg, iv = []; let last = 0; const t0 = performance.now(), s0 = E.sim.t;
          function f(now) { if (last) iv.push(now - last); last = now; __h.play(); if (now - t0 < 4000) requestAnimationFrame(f); else { iv.sort((a, b) => a - b); const avg = iv.reduce((a, b) => a + b, 0) / iv.length; res({ fps: +(1000 / avg).toFixed(1), p95: +iv[Math.floor(iv.length * 0.95)].toFixed(1), world: +((E.sim.t - s0) / ((now - t0) / 1000)).toFixed(2) }); } }
          requestAnimationFrame(f); }));
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      }
    }
    all.push(row);
    console.log(JSON.stringify(row));
  }
  if (process.env.OUT) require('fs').writeFileSync(process.env.OUT, JSON.stringify(all, null, 1));
  await close();
})().catch((e) => { console.error(e); process.exit(1); });
