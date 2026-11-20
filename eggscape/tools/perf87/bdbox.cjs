// how much of each backdrop layer is see-through: bounding box of pixels with alpha > 0, per level (High)
const { open } = require('./lib.cjs');
(async () => { const { page, close } = await open();
  for (const id of (process.argv[2] || '1,6,11,13,16,20,21,27,31,35,36,41,44,46,50').split(',').map(Number)) console.log(id, await page.evaluate(([id]) => { __h.startLevel(id, 'high'); __egg.frame(1/60);
    // reach the layers through a draw with drawImage spied
    const G = __egg.G, seen = []; const P = CanvasRenderingContext2D.prototype, o = P.drawImage; P.drawImage = function (...a) { if (a[0] && a[0].width > 300) seen.push(a[0]); return o.apply(this, a); };
    G.backdrop.draw(document.querySelector('canvas').getContext('2d'), G.t, G.bcam); P.drawImage = o;
    return G.theme.id + ' ' + seen.map((cv) => { const c = cv.getContext('2d'), d = c.getImageData(0, 0, cv.width, cv.height).data; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0, op = 0; for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) { const a = d[(y * cv.width + x) * 4 + 3]; if (a) { n++; if (a === 255) op++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
      return `${cv.width}x${cv.height}:bbox=${(((x1 - x0 + 1) * (y1 - y0 + 1)) / (cv.width * cv.height)).toFixed(2)},y0=${(y0 / cv.height).toFixed(2)},y1=${(y1 / cv.height).toFixed(2)},any=${(n / (cv.width * cv.height)).toFixed(2)},opaque=${(op / (cv.width * cv.height)).toFixed(2)}`; }).join(' | '); }, [id]));
  await close(); })();
