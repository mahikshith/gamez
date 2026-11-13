// Mama design sheets (art review only): the new mother hen (src/render/mama.js) beside the Frost Chick (src/render/strike.js).
// Usage: node tools/mama-sheet.cjs <outDir>
// Writes mama-hero.jpg, mama-moods.jpg, mama-launch.jpg and mama-launch.gif (or mama-launch-strip.jpg when ffmpeg is missing).
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const out = path.resolve(process.argv[2] || 'qa/mama');
fs.mkdirSync(out, { recursive: true });

const PAGE = () => {
  const { drawMama, mamaLaunch, MAMA_CHICK, MAMA_LAUNCH_T, drawStrikeChick } = window.M;
  const cv = document.getElementById('c'), ctx = cv.getContext('2d');
  const size = (w, h) => { cv.width = w * 2; cv.height = h * 2; cv.style.width = w + 'px'; cv.style.height = h + 'px'; ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.clearRect(0, 0, w, h); };
  const GREEN = ['#86c257', '#69a843', '#5a9638'], DARK = ['#232a3d', '#171c2b', '#10141f'];
  const backdrop = (x, y, w, h, gy, pal) => {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = pal[0]; ctx.fillRect(x, y, w, h); ctx.fillStyle = pal[1]; ctx.fillRect(x, gy - h * 0.035, w, h); ctx.fillStyle = pal[2];
    for (let i = 0; i < w / 46; i++) { const gx = x + 20 + i * 46 + ((i * 37) % 23), g = gy + 14 + ((i * 53) % 5) * (h * 0.02); ctx.beginPath(); ctx.moveTo(gx - 7, g); ctx.lineTo(gx - 3, g - 9); ctx.lineTo(gx, g - 2); ctx.lineTo(gx + 4, g - 11); ctx.lineTo(gx + 8, g); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  };
  const label = (txt, x, y, px = 15, col = '#fff') => { ctx.save(); ctx.font = `700 ${px}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = px * 0.28; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineJoin = 'round'; ctx.strokeText(txt, x, y); ctx.fillStyle = col; ctx.fillText(txt, x, y); ctx.restore(); };
  // the Frost Chick with its feet at (fx, fy)
  const chick = (fx, fy, sc, t, o = {}) => {
    ctx.save(); ctx.translate(fx, fy); ctx.rotate(o.rot || 0);
    drawStrikeChick(ctx, 'freeze', 0, -0.57 * sc, sc, t, { fog: false, shadow: !!o.shadow, mood: o.mood, squash: o.squash, stretch: o.stretch, trail: o.trail, wing: o.wing, look: o.look });
    ctx.restore();
  };
  const MOODS = ['idle', 'proud', 'worried', 'gasp', 'angry', 'cry', 'cheer', 'smug'];
  const launchFrame = (x, gy, s, u, t) => {
    const p = mamaLaunch(u), c = p.chick;
    drawMama(ctx, x, gy, s, t, { ...p, shadow: true });
    chick(x + c.x * s, gy + c.y * s, s * MAMA_CHICK, t, { rot: c.rot, squash: c.squash, stretch: c.stretch, mood: c.mood, trail: c.held ? 0 : 1, wing: c.held ? 0 : 1 });
  };
  window.sheets = {
    hero() {
      const W = 900, H = 900, s = 600, gy = 810; size(W * 2, H);
      [GREEN, DARK].forEach((pal, i) => {
        const x = i * W; backdrop(x, 0, W, H, gy, pal);
        drawMama(ctx, x + 415, gy, s, 0.4, { shadow: true, blink: 0 });
        chick(x + 800, gy, s * MAMA_CHICK, 0.4, { shadow: true, look: { x: -0.7, y: -0.6 } });
      });
      return [W * 2, H];
    },
    moods() {
      const CW = 330, CH = 372, s = 250, W = CW * 4, H = CH * 2 + 150 * 2; size(W, H);
      MOODS.forEach((m, i) => {
        const x = (i % 4) * CW, y = Math.floor(i / 4) * CH; backdrop(x, y, CW, CH, y + CH - 38, GREEN);
        drawMama(ctx, x + 150, y + CH - 38, s, 0.4 + i * 0.37, { mood: m, shadow: true, blink: 0, lift: m === 'cheer' ? 0.07 : 0 });
        label(m, x + CW / 2, y + 26, 19);
      });
      [GREEN, DARK].forEach((pal, r) => {
        const y = CH * 2 + r * 150; backdrop(0, y, W, 150, y + 118, pal);
        MOODS.forEach((m, i) => { const x = i * (W / 8) + W / 16; drawMama(ctx, x - 6, y + 118, 60, 0.4 + i * 0.37, { mood: m, shadow: true, blink: 0, lift: m === 'cheer' ? 0.07 : 0 }); label(m, x, y + 22, 12); });
        label('60 px', 28, y + 142, 11, '#ffe9a8');
      });
      return [W, H];
    },
    launch() {
      const U = [0.02, 0.08, 0.24, 0.38, 0.47, 0.56, 0.78], CW = 380, CH = 470, s = 196, W = CW * U.length; size(W, CH);
      U.forEach((u, i) => {
        const x = i * CW; ctx.save(); ctx.beginPath(); ctx.rect(x, 0, CW, CH); ctx.clip(); backdrop(x, 0, CW, CH, CH - 40, i % 2 ? GREEN : [GREEN[0], '#64a23f', GREEN[2]]);
        launchFrame(x + 185, CH - 40, s, u, 0.4); ctx.restore();
        label(Math.round(u * MAMA_LAUNCH_T * 1000) + ' ms', x + CW / 2, 26, 18);
      });
      return [W, CH];
    },
    strip() {
      const N = 12, CW = 250, CH = 330, s = 146, W = CW * 6; size(W, CH * 2);
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1) * 0.92, x = (i % 6) * CW, y = Math.floor(i / 6) * CH; ctx.save(); ctx.beginPath(); ctx.rect(x, y, CW, CH); ctx.clip(); backdrop(x, y, CW, CH, y + CH - 30, GREEN);
        launchFrame(x + 98, y + CH - 30, s, u, 0.4); ctx.restore(); label(Math.round(u * MAMA_LAUNCH_T * 1000) + ' ms', x + CW / 2, y + 22, 14);
      }
      return [W, CH * 2];
    },
    // one frame of the film: f < 0 the chick hops up from the ground (sheet-only lead-in), then the launch, then a hold
    film(f, slow) {
      const W = 520, H = 470, s = 200, gx = 215, gy = H - 44, sc = s * MAMA_CHICK; size(W, H); backdrop(0, 0, W, H, gy, GREEN);
      if (f < 0) {
        const k = 1 + f, c0 = mamaLaunch(0).chick, x0 = gx + 0.8 * s, x1 = gx + c0.x * s, y1 = gy + c0.y * s, e = k * k * (3 - 2 * k);
        drawMama(ctx, gx, gy, s, 0.4, { ...mamaLaunch(0), shadow: true, look: { x: lerp(0.6, -0.3, k), y: lerp(0.3, -0.7, k) } });
        chick(lerp(x0, x1, e), lerp(gy, y1, e) - Math.sin(k * Math.PI) * 0.42 * s, sc, 0.4, { mood: k < 0.15 ? 'crouch' : 'ready', squash: k < 0.15 ? 0.3 : -0.15, wing: k > 0.15 ? 1 : 0, rot: -k * 0.2 * (1 - k) * 4, look: { x: -0.8, y: -0.3 } });
      } else launchFrame(gx, gy, s, Math.min(1, f), 0.4);
      label(slow ? 'slow' : 'real time', W - 54, 26, 14);
      return [W, H];
    },
  };
  function lerp(a, b, k) { return a + (b - a) * k; }
};

(async () => {
  const esbuild = require(path.join(root, 'node_modules/esbuild'));
  const built = await esbuild.build({
    stdin: { contents: `export * from './src/render/mama.js'; export { drawStrikeChick } from './src/render/strike.js';`, resolveDir: root, loader: 'js' },
    bundle: true, format: 'iife', globalName: 'M', write: false, logLevel: 'error',
    loader: { '.webp': 'dataurl', '.png': 'dataurl', '.jpg': 'dataurl', '.svg': 'dataurl', '.mp3': 'empty', '.ogg': 'empty', '.wav': 'empty', '.m4a': 'empty' },
  });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
  const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  await p.setContent('<body style="margin:0;background:#000"><canvas id="c" style="display:block"></canvas></body>');
  await p.addScriptTag({ content: built.outputFiles[0].text + '\nwindow.M = M;' });
  await p.addScriptTag({ content: `(${PAGE.toString()})();` });
  const shot = async (file, fn, args = [], type = 'jpeg') => {
    const [w, h] = await p.evaluate(([f, a]) => window.sheets[f](...a), [fn, args]);
    await p.setViewportSize({ width: Math.ceil(w), height: Math.ceil(h) });
    await p.screenshot({ path: file, clip: { x: 0, y: 0, width: w, height: h }, ...(type === 'jpeg' ? { type, quality: 92 } : { type }) });
  };
  await shot(path.join(out, 'mama-hero.jpg'), 'hero');
  await shot(path.join(out, 'mama-moods.jpg'), 'moods');
  await shot(path.join(out, 'mama-launch.jpg'), 'launch');
  // the film: the hop in, the launch in real time (30 ms frames), a hold, then the same again slowed down
  let gif = false;
  try {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mama-')); let n = 0;
    const frame = async (f, slow, hold = 1) => { const file = path.join(tmp, 'src.png'); await shot(file, 'film', [f, slow], 'png'); for (let i = 0; i < hold; i++) fs.copyFileSync(file, path.join(tmp, `f${String(n++).padStart(4, '0')}.png`)); };
    for (const [slow, step] of [[false, 1], [true, 0.34]]) {
      await frame(-1, slow, 14);
      for (let f = -1 + 0.11 * step; f < 0; f += 0.11 * step) await frame(f, slow);
      const du = (0.03 / 0.62) * step; for (let u = 0; u < 1; u += du) await frame(u, slow);
      await frame(1, slow, 20);
    }
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '100/3', '-i', path.join(tmp, 'f%04d.png'), '-vf', 'scale=520:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', '-loop', '0', path.join(out, 'mama-launch.gif')]);
    fs.rmSync(tmp, { recursive: true, force: true }); gif = true;
  } catch (e) { console.log('gif skipped: ' + String(e.message || e).split('\n')[0]); }
  if (!gif) await shot(path.join(out, 'mama-launch-strip.jpg'), 'strip');
  await b.close();
  if (errors.length) { console.log('PAGE ERRORS\n' + errors.join('\n')); process.exit(1); }
  console.log('wrote ' + fs.readdirSync(out).filter((f) => f.startsWith('mama-')).join(', ') + ' -> ' + out);
})().catch((e) => { console.error(e); process.exit(1); });
