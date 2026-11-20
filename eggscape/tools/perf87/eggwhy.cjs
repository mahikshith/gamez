// egg sprite churn: sprites built in 10 s of play, how many were built before (evicted), zoom steps seen, eggs alive
const { open } = require('./lib.cjs');
(async () => { const { page, close } = await open();
  for (const id of (process.argv[2] || '50').split(',').map(Number)) console.log(id, JSON.stringify(await page.evaluate(([id, tier]) => { const E = __egg, H = __h; H.startLevel(id, tier); for (let f = 0; f < 120; f++) { H.play(); E.frame(1 / 60); }
    E.stampStats.dbg = {}; for (let f = 0; f < 600; f++) { H.play(); E.frame(1 / 60); } const d = E.stampStats.dbg; E.stampStats.dbg = null;
    return { egg: d.egg, again: d.eggAgain, distinct: d.seen && d.seen.size, sq: d.sq, eggs: E.sim.aliveEggs().length, kinds: E.sim.aliveEggs().map((e) => e.kind || '-').join(',') }; }, [id, process.argv[3] || 'low08'])));
  await close(); })();
