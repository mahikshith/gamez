// Equip each egg skin and each hen skin, start a level, and trace the first 3 s (2026-11-20 stutter pass).
// Usage: node tools/perf87/skins.cjs [level=20] [tier=low08] [which=egg,hen]
// per skin: first-3s frame trace (frame + flush, ms), worst frame and when, frames over 16.7 / 33 ms, stamp builds
// in the first 3 s and in the next 2 s, steady mean (frames 3-5 s), canvas ops per frame at steady state
const { open } = require('./lib.cjs');
const [lv = '20', tier = 'low08', which = 'egg,hen'] = process.argv.slice(2);
(async () => {
  const { page, close } = await open();
  const lists = await page.evaluate(() => ({ egg: __egg.SKIN_ORDER, hen: __egg.HEN_SKIN_ORDER }));
  const only = process.env.SKINS ? process.env.SKINS.split(',') : null; // SKINS=galaxy,lava: just these
  for (const kind of which.split(',')) for (const id of lists[kind].filter((x) => !only || only.includes(x))) {
    const r = await page.evaluate(([id, kind, lv, tier]) => {
      const E = __egg, H = __h, w = E.save.wallet;
      if (kind === 'egg') { w.skin = id; w.henSkin = 'classic'; } else { w.henSkin = id; w.skin = 'classic'; }
      const b0 = E.stampStats.builds; const tStart = performance.now();
      H.startLevel(+lv, tier);
      const startMs = performance.now() - tStart, bStart = E.stampStats.builds - b0;
      const tr = []; const b1 = E.stampStats.builds;
      for (let f = 0; f < 180; f++) { H.play(); const t0 = performance.now(); E.frame(1 / 60); H.flush(); tr.push(performance.now() - t0); }
      const b2 = E.stampStats.builds; let st = 0;
      for (let f = 0; f < 120; f++) { H.play(); const t0 = performance.now(); E.frame(1 / 60); H.flush(); st += performance.now() - t0; }
      const b3 = E.stampStats.builds;
      H.reset(); H.on = true; E.frame(1 / 60); H.on = false; const n = H.n;
      const worst = Math.max(...tr);
      return { kind, id, startMs: +startMs.toFixed(1), buildsAtStart: bStart, first3s: +(tr.reduce((a, b) => a + b, 0) / tr.length).toFixed(2), worst: +worst.toFixed(1), worstAt: tr.indexOf(worst), over17: tr.filter((x) => x > 16.7).length, over33: tr.filter((x) => x > 33).length, first10: tr.slice(0, 10).map((x) => +x.toFixed(1)), builds3s: b2 - b1, builds3to5: b3 - b2, steady: +(st / 120).toFixed(2), ops: (n['main.fill'] || 0) + (n['main.stroke'] || 0), grads: (n['main.createLinearGradient'] || 0) + (n['main.createRadialGradient'] || 0), clips: n['main.clip'] || 0 };
    }, [id, kind, lv, tier]);
    console.log(JSON.stringify(r));
  }
  await close();
})().catch((e) => { console.error(e); process.exit(1); });
