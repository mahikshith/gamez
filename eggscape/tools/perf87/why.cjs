// why the ring body sprites re-bake (new / key change / turned past bodyCache.turn / zoom) during 10 s of play
const { open } = require('./lib.cjs');
(async () => { const { page, close } = await open();
  for (const id of (process.argv[2] || '27,44').split(',').map(Number)) console.log(id, JSON.stringify(await page.evaluate(([id, tier]) => { const E = __egg, H = __h; H.startLevel(id, tier); for (let f = 0; f < 120; f++) { H.play(); E.frame(1 / 60); }
    E.perf.bodyCache.why = {}; for (let f = 0; f < 600; f++) { H.play(); E.frame(1 / 60); } const w = E.perf.bodyCache.why; E.perf.bodyCache.why = null;
    return { why: Object.fromEntries(Object.entries(w).slice(0, 30)), rings: E.sim.rings.map((r) => ({ r: r.r, motor: !!r.motor, prof: !!r.prof })) }; }, [id, process.argv[3] || 'low08'])));
  await close(); })();
