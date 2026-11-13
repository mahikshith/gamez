// Mama design sheets (art review only): the new mother hen (src/render/mama.js) beside the Frost Chick (src/render/strike.js).
// Usage: node tools/mama-sheet.cjs <outDir>
// Writes mama-hero.jpg (idle pose on green and on dark, with the chick at true size), mama-moods.jpg (the still moods,
// large and at 60 px), mama-anims.jpg (6 key frames of every animation) and mama-preview.html (ONE self-contained page that
// plays every animation live; tap a cell to enlarge it).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const out = path.resolve(process.argv[2] || 'qa/mama');
fs.mkdirSync(out, { recursive: true });

// shared by the sheets and the preview page: one animation frame, her feet at (x, gy)
const SCENE = () => {
  const { drawMama, MAMA_ANIMS, MAMA_CHICK, drawStrikeChick } = window.M;
  window.mamaChick = (ctx, fx, fy, sc, t, o = {}) => { // the Frost Chick with its feet at (fx, fy)
    ctx.save(); ctx.translate(fx, fy); ctx.rotate(o.rot || 0);
    drawStrikeChick(ctx, 'freeze', 0, -0.57 * sc, sc, t, { fog: false, shadow: !!o.shadow, mood: o.mood, squash: o.squash, stretch: o.stretch, trail: o.trail, wing: o.wing, look: o.look });
    ctx.restore();
  };
  window.mamaFrame = (ctx, name, u, x, gy, s) => {
    const p = MAMA_ANIMS[name].pose(u), c = p.chick;
    if (c && c.air && !c.held && c.x < 0) window.mamaChick(ctx, x + c.x * s, gy + c.y * s, s * MAMA_CHICK, u, { rot: c.rot, squash: c.squash, mood: c.mood, wing: 1, shadow: c.y > -0.02 }); // hopping in behind her
    drawMama(ctx, x, gy, s, u, { ...p, shadow: true });
    if (c && !(c.air && !c.held && c.x < 0)) window.mamaChick(ctx, x + c.x * s, gy + c.y * s, s * MAMA_CHICK, u, { rot: c.rot, squash: c.squash, stretch: c.stretch, mood: c.mood, trail: c.held ? 0 : 1, wing: c.held ? 0 : 1, shadow: !c.held && !c.air });
  };
};

const SHEETS = () => {
  const { drawMama, MAMA_ANIMS, MAMA_MOODS, MAMA_CHICK } = window.M;
  const cv = document.getElementById('c'), ctx = cv.getContext('2d');
  const size = (w, h) => { cv.width = w * 2; cv.height = h * 2; cv.style.width = w + 'px'; cv.style.height = h + 'px'; ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.clearRect(0, 0, w, h); };
  const GREEN = ['#86c257', '#69a843', '#5a9638'], DARK = ['#232a3d', '#171c2b', '#10141f'];
  const backdrop = (x, y, w, h, gy, pal) => {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = pal[0]; ctx.fillRect(x, y, w, h); ctx.fillStyle = pal[1]; ctx.fillRect(x, gy - h * 0.035, w, h); ctx.fillStyle = pal[2];
    for (let i = 0; i < w / 46; i++) { const gx = x + 20 + i * 46 + ((i * 37) % 23), g = gy + 14 + ((i * 53) % 5) * (h * 0.02); ctx.beginPath(); ctx.moveTo(gx - 7, g); ctx.lineTo(gx - 3, g - 9); ctx.lineTo(gx, g - 2); ctx.lineTo(gx + 4, g - 11); ctx.lineTo(gx + 8, g); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  };
  const label = (txt, x, y, px = 15, col = '#fff', al = 'center') => { ctx.save(); ctx.font = `700 ${px}px system-ui, sans-serif`; ctx.textAlign = al; ctx.lineWidth = px * 0.28; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineJoin = 'round'; ctx.strokeText(txt, x, y); ctx.fillStyle = col; ctx.fillText(txt, x, y); ctx.restore(); };
  window.sheets = {
    hero() {
      const W = 900, H = 900, s = 600, gy = 810; size(W * 2, H);
      [GREEN, DARK].forEach((pal, i) => {
        const x = i * W; backdrop(x, 0, W, H, gy, pal);
        drawMama(ctx, x + 400, gy, s, 0.4, { shadow: true, blink: 0 });
        window.mamaChick(ctx, x + 790, gy, s * MAMA_CHICK, 0.4, { shadow: true, look: { x: -0.7, y: -0.6 } });
      });
      return [W * 2, H];
    },
    moods() {
      const CW = 330, CH = 372, s = 250, W = CW * 4, H = CH * 2 + 150 * 2; size(W, H);
      MAMA_MOODS.forEach((m, i) => {
        const x = (i % 4) * CW, y = Math.floor(i / 4) * CH; backdrop(x, y, CW, CH, y + CH - 38, GREEN);
        drawMama(ctx, x + 150, y + CH - 38, s, 0.4 + i * 0.37, { mood: m, shadow: true, blink: 0, lift: m === 'cheer' ? 0.07 : 0 });
        label(m, x + CW / 2, y + 26, 19);
      });
      [GREEN, DARK].forEach((pal, r) => {
        const y = CH * 2 + r * 150; backdrop(0, y, W, 150, y + 118, pal);
        MAMA_MOODS.forEach((m, i) => { const x = i * (W / 8) + W / 16; drawMama(ctx, x - 6, y + 118, 60, 0.4 + i * 0.37, { mood: m, shadow: true, blink: 0, lift: m === 'cheer' ? 0.07 : 0 }); label(m, x, y + 22, 12); });
        label('60 px', 28, y + 142, 11, '#ffe9a8');
      });
      return [W, H];
    },
    anims(from = 0, to = 99) { // rows [from, to): 6 key frames each
      const names = Object.keys(MAMA_ANIMS).slice(from, to), CW = 290, CH = 330, s = 150, W = CW * 6, H = CH * names.length; size(W, H);
      names.forEach((n, r) => {
        const A = MAMA_ANIMS[n];
        A.keys.forEach((u, i) => {
          const x = i * CW, y = r * CH; ctx.save(); ctx.beginPath(); ctx.rect(x, y, CW, CH); ctx.clip(); backdrop(x, y, CW, CH, y + CH - 34, (i + r) % 2 ? GREEN : [GREEN[0], '#64a23f', GREEN[2]]);
          window.mamaFrame(ctx, n, u, x + (n === 'launch' ? 160 : 132), y + CH - 34, s); ctx.restore();
          label((u * 1000 | 0) + ' ms', x + CW - 12, y + 22, 13, '#fff', 'right');
        });
        label(n + (A.loop ? '  (loop ' : '  (one-shot ') + A.len + ' s)', 10, r * CH + 24, 17, '#ffe9a8', 'left');
      });
      return [W, H];
    },
  };
};

// the live page: a responsive grid of canvases, one per animation
const LIVE = () => {
  const { MAMA_ANIMS } = window.M, grid = document.getElementById('grid'), cells = [];
  let speed = 1, clock = 0, last = performance.now();
  for (const name of Object.keys(MAMA_ANIMS)) {
    const A = MAMA_ANIMS[name], el = document.createElement('div'); el.className = 'cell';
    el.innerHTML = `<canvas></canvas><b>${name}</b><i>${A.loop ? 'loop' : 'one-shot'} ${A.len} s</i>`;
    el.addEventListener('click', () => { const big = el.classList.contains('big'); cells.forEach((c) => c.el.classList.remove('big')); if (!big) { el.classList.add('big'); el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } });
    grid.appendChild(el); cells.push({ name, A, el, cv: el.firstChild });
  }
  const sp = document.getElementById('speed');
  sp.addEventListener('click', () => { speed = speed === 1 ? 0.25 : 1; sp.textContent = speed === 1 ? 'Slow motion: off' : 'Slow motion: on (0.25x)'; });
  function tick(now) {
    clock += Math.min(0.1, (now - last) / 1000) * speed; last = now;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    for (const c of cells) {
      const r = c.cv.getBoundingClientRect(); if (r.bottom < -50 || r.top > innerHeight + 50 || r.width < 2) continue;
      const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr); if (c.cv.width !== w || c.cv.height !== h) { c.cv.width = w; c.cv.height = h; }
      const ctx = c.cv.getContext('2d'), W = r.width, H = r.height, gy = H * 0.86, launch = c.name === 'launch';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#eef3f8'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#7fbf52'; ctx.fillRect(0, gy - H * 0.03, W, H); ctx.fillStyle = '#6cab45'; ctx.fillRect(0, gy + H * 0.05, W, H);
      const s = Math.min(H * (launch ? 0.4 : 0.46), W * (launch ? 0.36 : 0.5)), total = c.A.loop ? c.A.len : c.A.len + 0.8, u = c.A.loop ? clock % c.A.len : Math.min(c.A.len, clock % total);
      window.mamaFrame(ctx, c.name, u, W * (launch ? 0.5 : 0.47), gy, s);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
};

const HTML = (bundle) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mama animation preview</title>
<style>
  html, body { margin: 0; background: #f4f1ea; color: #2b2a26; font: 500 14px/1.35 system-ui, -apple-system, 'Segoe UI', sans-serif; }
  header { padding: 14px 16px 10px; display: flex; gap: 10px 16px; align-items: center; flex-wrap: wrap; }
  h1 { font-size: 18px; margin: 0; } header span { color: #6b675d; }
  button { font: inherit; font-weight: 600; padding: 8px 14px; border-radius: 999px; border: 1px solid #c9c3b4; background: #fff; color: inherit; cursor: pointer; }
  #grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(165px, 1fr)); gap: 10px; padding: 0 12px 28px; }
  .cell { position: relative; background: #fff; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.14); cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .cell canvas { display: block; width: 100%; aspect-ratio: 1 / 1.08; }
  .cell b { position: absolute; left: 10px; top: 8px; font-size: 14px; text-transform: capitalize; }
  .cell i { position: absolute; right: 10px; top: 9px; font-style: normal; font-size: 11px; color: #6b675d; }
  .cell.big { grid-column: 1 / -1; } .cell.big canvas { aspect-ratio: auto; height: min(80vh, 110vw); }
</style></head>
<body>
<header><h1>Mama: animations</h1><span>Tap a cell to enlarge it. One-shots replay after a short hold.</span><button id="speed">Slow motion: off</button></header>
<div id="grid"></div>
<script>${bundle.replace(/<\/script/g, '<\\/script')}\nwindow.M = M;</script>
<script>(${SCENE.toString()})();(${LIVE.toString()})();</script>
</body></html>
`;

(async () => {
  const esbuild = require(path.join(root, 'node_modules/esbuild'));
  const none = {}; for (const e of ['.webp', '.png', '.jpg', '.svg', '.mp3', '.ogg', '.wav', '.m4a']) none[e] = 'empty'; // the chick is drawn by code
  const built = await esbuild.build({
    stdin: { contents: `export * from './src/render/mama.js'; export { drawStrikeChick } from './src/render/strike.js';`, resolveDir: root, loader: 'js' },
    bundle: true, format: 'iife', globalName: 'M', write: false, logLevel: 'error', minify: true, loader: none,
  });
  const bundle = built.outputFiles[0].text;
  fs.writeFileSync(path.join(out, 'mama-preview.html'), HTML(bundle));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
  const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  await p.setContent('<body style="margin:0;background:#000"><canvas id="c" style="display:block"></canvas></body>');
  await p.addScriptTag({ content: bundle + '\nwindow.M = M;' });
  await p.addScriptTag({ content: `(${SCENE.toString()})();(${SHEETS.toString()})();` });
  const shot = async (file, fn, args = []) => {
    const [w, h] = await p.evaluate(([f, a]) => window.sheets[f](...a), [fn, args]);
    await p.setViewportSize({ width: Math.ceil(w), height: Math.ceil(h) });
    await p.screenshot({ path: file, clip: { x: 0, y: 0, width: w, height: h }, type: 'jpeg', quality: 90 });
  };
  await shot(path.join(out, 'mama-hero.jpg'), 'hero');
  await shot(path.join(out, 'mama-moods.jpg'), 'moods');
  await shot(path.join(out, 'mama-anims.jpg'), 'anims');
  if (process.argv[3]) for (let i = 0; i < 10; i += 2) await shot(path.join(process.argv[3], `rows-${i}.jpg`), 'anims', [i, i + 2]); // review crops
  // the preview page must run clean on a phone-width viewport with no network
  const q = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  q.on('pageerror', (e) => errors.push('preview: ' + String(e))); q.on('request', (r) => { if (!r.url().startsWith('file:')) errors.push('preview requested ' + r.url()); });
  await q.goto('file://' + path.join(out, 'mama-preview.html')); await q.waitForTimeout(700);
  if (process.argv[3]) { await q.screenshot({ path: path.join(process.argv[3], 'preview-390.jpg'), type: 'jpeg', quality: 85 }); await q.click('.cell:nth-child(10)'); await q.waitForTimeout(400); await q.screenshot({ path: path.join(process.argv[3], 'preview-big.jpg'), type: 'jpeg', quality: 85 }); }
  await b.close();
  if (errors.length) { console.log('PAGE ERRORS\n' + errors.join('\n')); process.exit(1); }
  console.log(`wrote mama-hero.jpg, mama-moods.jpg, mama-anims.jpg, mama-preview.html (${(fs.statSync(path.join(out, 'mama-preview.html')).size / 1024) | 0} KB) -> ${out}`);
})().catch((e) => { console.error(e); process.exit(1); });
