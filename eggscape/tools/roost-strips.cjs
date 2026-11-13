// Rooster + eagle art QA: before/after strips drawn straight from the art modules (no game boot).
// Bundles src/render/allies.js + v3art.js from two source trees (old, new) with esbuild and paints every pose at
// in-game size and 3x, old on top, new below. Sheets: rooster.jpg, eagle.jpg.
// Usage: node tools/roost-strips.cjs <oldSrcDir> [newSrcDir=src] [outDir=qa/roost]
const { chromium } = require('playwright');
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const [oldDir, newDir = 'src', out = 'qa/roost'] = process.argv.slice(2);
if (!oldDir) { console.error('usage: node tools/roost-strips.cjs <oldSrcDir> [newSrcDir] [outDir]'); process.exit(1); }
fs.mkdirSync(out, { recursive: true });

async function bundle(dir, name) {
  const r = await esbuild.build({
    stdin: { contents: `import { ALLY_ART } from './render/allies.js'; import { drawEagle } from './render/v3art.js'; window.${name} = { ...ALLY_ART, drawEagle };`, resolveDir: path.resolve(dir), loader: 'js' },
    plugins: [{ name: 'stub-assets', setup(b) { // art only: binary assets are not needed
      b.onResolve({ filter: /\.(webp|png|jpe?g|ogg|mp3|wav|svg|woff2?|ttf)$/ }, (a) => ({ path: a.path, namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export default ""', loader: 'js' }));
    } }],
    bundle: true, write: false, nodePaths: [path.resolve(__dirname, '../node_modules')], format: 'iife', logLevel: 'silent',
    define: { __DEV__: 'true', __TEST__: 'false', __PORTAL__: '"web"', __GD_ID__: '""' },
  });
  return r.outputFiles[0].text;
}

// [label, anim, k, tt]
const ROOSTER = [
  ['idle', 'idle', 0, 0.3], ['idle b', 'idle', 0, 1.4], ['strut a', 'strut', 0, 0.1], ['strut b', 'strut', 0, 0.3], ['crouch', 'crouch', 1, 0],
  ['puff .5', 'puff', 0.5, 0], ['puff 1', 'puff', 1, 0], ['crow .1', 'crow', 0.1, 0.05], ['crow', 'crow', 0.5, 0.31], ['crow b', 'crow', 0.8, 0.42],
  ['fly up', 'fly', 0.5, 0.26], ['fly down', 'fly', 0.5, 0.09], ['land a', 'land', 0.2, 0.1], ['land b', 'land', 0.75, 0.3], ['land c', 'land', 1, 0.4],
];
// [label, opts]
const EAGLE = [
  ['glide', { w: { glide: 1 } }], ['flap up', { w: { flap: 1 }, phase: 0 }], ['flap mid', { w: { flap: 1 }, phase: 1.57 }], ['flap down', { w: { flap: 1 }, phase: 3.14 }], ['flap mid2', { w: { flap: 1 }, phase: 4.71 }],
  ['hover', { w: { hover: 1 }, phase: 0.8 }], ['hover b', { w: { hover: 1 }, phase: 3.9 }], ['dive', { w: { dive: 1 }, pitch: 1.2 }], ['strike', { w: { strike: 1 } }], ['carry', { w: { carry: 1 }, phase: 1, grab: { x: 0, y: 30 } }],
  ['carry b', { w: { carry: 1 }, phase: 4, grab: { x: 0, y: 30 } }], ['dazed', { w: { dazed: 1 }, stars: 1 }], ['perch (folded)', { w: { perch: 1 } }], ['glide>dive', { w: { glide: 0.5, dive: 0.5 } }], ['glide left', { w: { glide: 1 }, face: -1 }],
];

(async () => {
  const [o, n] = await Promise.all([bundle(oldDir, 'OLD'), bundle(newDir, 'NEW')]);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.setContent('<body style="margin:0;background:#888"><canvas id="c"></canvas></body>');
  await p.addScriptTag({ content: o });
  await p.addScriptTag({ content: n });
  const sheet = async (file, kind, rows, small, cols) => {
    const dim = await p.evaluate(([kind, rows, small, cols]) => {
      const big = small * 3, cw = big * (kind === 'eagle' ? 2.9 : 1.75), chS = small * (kind === 'eagle' ? 2.2 : 1.6) + 16, chB = big * (kind === 'eagle' ? 2.1 : 1.5) + 18;
      const nr = Math.ceil(rows.length / cols), bandH = 2 * chS + 2 * chB;
      const c = document.getElementById('c'); c.width = Math.round(cw * cols); c.height = Math.round(bandH * nr);
      const x = c.getContext('2d');
      const bg = x.createLinearGradient(0, 0, 0, c.height); bg.addColorStop(0, '#bfe3f5'); bg.addColorStop(1, '#8fc9a0'); x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height);
      const draw = (A, r, cx, cy, s) => {
        x.save();
        try {
          if (kind === 'rooster') A.drawRooster(x, cx, cy, s, A.roosterPose(r[1], r[2], r[3]));
          else A.drawEagle(x, cx, cy, s, 0.4, r[1]);
        } catch (e) { x.fillStyle = 'red'; x.fillText(String(e).slice(0, 40), cx - 60, cy); }
        x.restore();
      };
      rows.forEach((r, i) => {
        const cx = (i % cols + 0.5) * cw + (kind === 'rooster' ? cw * 0.06 : 0), y0 = Math.floor(i / cols) * bandH;
        const ys = [y0 + chS * 0.5, y0 + chS * 1.5, y0 + 2 * chS + chB * 0.5, y0 + 2 * chS + chB * 1.5];
        [[OLD, small], [NEW, small], [OLD, big], [NEW, big]].forEach(([A, s], j) => {
          draw(A, r, cx, ys[j] + (kind === 'rooster' ? s * 0.12 : 0), s);
          x.fillStyle = j % 2 ? '#0a5a2a' : '#7a1810'; x.font = 'bold 12px sans-serif';
          x.fillText((j % 2 ? 'NEW ' : 'OLD ') + r[0] + (j > 1 ? ' 3x' : ''), (i % cols) * cw + 5, ys[j] - (j > 1 ? chB : chS) * 0.5 + 13);
        });
        x.strokeStyle = 'rgba(0,0,0,0.25)'; x.strokeRect((i % cols) * cw, y0, cw, bandH);
      });
      return { w: c.width, h: c.height };
    }, [kind, rows, small, cols]);
    await p.setViewportSize({ width: dim.w, height: dim.h });
    await p.locator('#c').screenshot({ path: path.join(out, file), type: 'jpeg', quality: 88 });
    console.log(file, dim.w + 'x' + dim.h);
  };
  await sheet('rooster.jpg', 'rooster', ROOSTER, 60, 5);
  await sheet('eagle.jpg', 'eagle', EAGLE, 50, 5);
  if (errs.length) console.log('PAGE ERRORS', errs.slice(0, 5));
  await b.close();
})();
