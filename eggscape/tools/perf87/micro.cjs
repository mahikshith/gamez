// micro: is a baked sprite (drawImage) cheaper than the path art it replaces, under CPU raster and GPU raster?
// node tools/perf87/micro.cjs   (GPU=1 for --enable-gpu-rasterization + swiftshader)
const { chromium } = require('playwright');
(async () => {
  const args = process.env.GPU ? ['--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--enable-accelerated-2d-canvas', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'];
  const b = await chromium.launch({ args }); const p = await b.newPage({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2.75 });
  await p.setContent('<canvas width=1080 height=2340 style="width:393px;height:851px"></canvas>');
  const r = await p.evaluate(() => {
    const cv = document.querySelector('canvas'), c = cv.getContext('2d'); const TAU = Math.PI * 2;
    const path = (x) => { x.beginPath(); x.moveTo(0, -40); x.bezierCurveTo(30, -40, 45, -20, 45, 5); x.bezierCurveTo(45, 35, 20, 45, 0, 45); x.bezierCurveTo(-30, 45, -45, 30, -45, 0); x.bezierCurveTo(-45, -25, -25, -40, 0, -40); x.closePath(); };
    const art = (x) => { // castkit form: fill, clip, shifted fill, clip, shifted fill, inner bits, ink
      x.save(); path(x); x.fillStyle = '#1873c4'; x.fill(); x.clip(); x.save(); x.translate(-4, -7); path(x); x.fillStyle = '#8fdcff'; x.fill(); x.clip(); x.translate(3, 5); path(x); x.fillStyle = '#38aef0'; x.fill(); x.restore();
      for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(-20 + i * 8, 10, 3, 0, TAU); x.fillStyle = '#bfeaff'; x.fill(); }
      x.restore(); path(x); x.lineWidth = 3; x.strokeStyle = '#114a86'; x.lineJoin = 'round'; x.stroke(); };
    const N = 40, sprites = [];
    for (let k = 0; k < N; k++) { const s = document.createElement('canvas'); s.width = s.height = 300; const x = s.getContext('2d'); x.setTransform(3, 0, 0, 3, 150, 150); art(x); sprites.push(s); }
    const flush = () => c.getImageData(0, 0, 1, 1);
    const run = (name, fn) => { const T = []; for (let f = 0; f < 30; f++) { c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#4a7'; c.fillRect(0, 0, 1080, 2340); flush(); const t0 = performance.now(); for (let k = 0; k < N; k++) { c.setTransform(2.75 * Math.cos(f * 0.1 + k), 2.75 * Math.sin(f * 0.1 + k), -2.75 * Math.sin(f * 0.1 + k), 2.75 * Math.cos(f * 0.1 + k), 100 + (k % 8) * 120, 150 + Math.floor(k / 8) * 400); fn(k); } flush(); T.push(performance.now() - t0); } T.sort((a, b) => a - b); return name + ' ' + T[15].toFixed(1) + 'ms'; };
    const run2 = (name, rot, fn) => { const T = []; for (let f = 0; f < 30; f++) { c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#4a7'; c.fillRect(0, 0, 1080, 2340); flush(); const t0 = performance.now(); for (let k = 0; k < N; k++) { const a = rot ? f * 0.1 + k : 0; c.setTransform(2.75 * Math.cos(a), 2.75 * Math.sin(a), -2.75 * Math.sin(a), 2.75 * Math.cos(a), 100 + (k % 8) * 120 + f * 0.37, 150 + Math.floor(k / 8) * 400); fn(k); } flush(); T.push(performance.now() - t0); } T.sort((a, b) => a - b); return name + (rot ? ' rot ' : ' upright ') + T[15].toFixed(1) + 'ms'; };
    const S1 = []; for (let k = 0; k < N; k++) { const s = document.createElement('canvas'); s.width = s.height = 276; const x = s.getContext('2d'); x.setTransform(2.75, 0, 0, 2.75, 138, 138); art(x); S1.push(s); }
    return [run2('paths', 0, () => art(c)), run2('1:1 sprites', 0, (k) => c.drawImage(S1[k], -50.18, -50.18, 100.36, 100.36)), run2('paths', 1, () => art(c)), run2('1:1 sprites', 1, (k) => c.drawImage(S1[k], -50.18, -50.18, 100.36, 100.36)), run2('1:1 sprites nosmooth', 1, (k) => { c.imageSmoothingEnabled = false; c.drawImage(S1[k], -50.18, -50.18, 100.36, 100.36); c.imageSmoothingEnabled = true; })].join(' | ') + '\n' + [run('paths', () => art(c)), run('one sprite', () => c.drawImage(sprites[0], -50, -50, 100, 100)), run('40 sprites', (k) => c.drawImage(sprites[k], -50, -50, 100, 100)), run('paths', () => art(c)), run('40 sprites', (k) => c.drawImage(sprites[k], -50, -50, 100, 100))].join(' | ');
  });
  console.log(process.env.GPU ? 'GPU raster:' : 'default:', r); await b.close();
})();
