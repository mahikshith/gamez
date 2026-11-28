// which graphics path Chromium is on under the GPU= flags: WebGL renderer string and 2D-canvas raster timing hints
const { open } = require('./lib.cjs');
(async () => { const { page, close } = await open();
  console.log('GPU=' + (process.env.GPU || 'default'), await page.evaluate(() => { const c = document.createElement('canvas'), gl = c.getContext('webgl'); if (!gl) return 'no webgl'; const e = gl.getExtension('WEBGL_debug_renderer_info'); return gl.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : gl.RENDERER); }));
  await close(); })();
