// what the backdrop holds after a level start per tier (layer canvas sizes vs the main canvas)
const { open } = require('./lib.cjs');
(async () => { const { page, close } = await open();
  for (const tier of (process.argv[2] || 'high,low08,medium,high').split(',')) for (const id of [1, 27]) console.log(tier, id, await page.evaluate(([id, tier]) => { __h.startLevel(id, tier); __egg.frame(1/60); const G = __egg.G, cv = document.querySelector('canvas');
    const H = __h; H.reset(); H.ops = {}; H.on = true; G.backdrop.draw(cv.getContext('2d'), G.t, G.bcam); H.on = false;
    return cv.width + 'x' + cv.height + ' dpr=' + devicePixelRatio + ' imgs=' + H.imgs.map((i) => `${i.sw}x${i.sh}@${i.scale}a${i.alpha}`).join(' '); }, [id, tier]));
  await close(); })();
