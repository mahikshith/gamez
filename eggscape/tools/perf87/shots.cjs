// same-sim-time screenshots for a before/after pixel diff. Usage: DIST=... node shots.cjs outDir [ids=1,13,20,27,44,50] [tiers=low08,medium,high]
// Math.random is seeded and the frames are stepped with a fixed dt, so two builds show the same moment.
const { open } = require('./lib.cjs');
const fs = require('fs'), path = require('path');
const [out, ids = '1,13,20,27,44,50', tiers = 'low08,medium,high', skin = ''] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
(async () => {
  for (const tier of tiers.split(',')) for (const id of ids.split(',').map(Number)) {
    const { page, close } = await open(); // a fresh page per shot: nothing carried over from an earlier level
    await page.evaluate(() => { window.requestAnimationFrame = () => 0; }); // stop the game's own loop: only our fixed steps move time
    await page.waitForTimeout(100);
    const url = await page.evaluate(([id, tier, skin]) => { __egg.G.t = 0; let s = 12345; Math.random = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); const E = __egg, H = __h; if (skin) E.save.wallet.skin = skin; H.startLevel(id, tier); for (let f = 0; f < 150; f++) { H.play(); E.frame(1 / 60); } return document.querySelector('canvas').toDataURL('image/png'); }, [id, tier, skin]);
    fs.writeFileSync(path.join(out, `${tier}-L${id}${skin ? '-' + skin : ''}.png`), Buffer.from(url.split(',')[1], 'base64'));
    await close();
  }
})();
