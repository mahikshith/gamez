// UI overlap QA: renders every screen of every level at several viewport sizes and asks the UI
// layer which recorded text/button rects overlap or leave the screen. Also saves a contact sheet.
// Usage: node tools/qa-overlap.cjs <dir with index.html + game.js (dev build)> [outDir]
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const dir = path.resolve(process.argv[2] || '.');
const out = path.resolve(process.argv[3] || path.join(dir, 'out'));
fs.mkdirSync(out, { recursive: true });

const SIZES = [[390, 844], [360, 640], [1280, 720], [640, 360], [600, 600], [768, 1024]];

const srv = http.createServer((q, r) => {
  const u = q.url.split('?')[0];
  const f = path.join(dir, u === '/' ? 'index.html' : u);
  fs.readFile(f, (e, d) => {
    if (e) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' });
    r.end(d);
  });
}).listen(8768);

(async () => {
  const b = await chromium.launch();
  const problems = [];
  const shots = [];
  for (const [w, h] of SIZES) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    const errors = [];
    p.on('pageerror', (e) => errors.push(String(e)));
    await p.goto('http://localhost:8768/');
    await p.waitForTimeout(800);
    const n = await p.evaluate(() => __egg.LEVELS.length);
    const check = async (label, fn, arg, shoot) => {
      const ov = await p.evaluate(fn, arg);
      if (ov.length) problems.push(`${w}x${h} ${label}: ${ov.map((o) => o.join(' x ')).join('; ')}`);
      if (shoot) { const f = path.join(out, `qa-${w}x${h}-${label}.png`); await p.screenshot({ path: f }); shots.push({ f, label: `${w}x${h} ${label}` }); }
    };
    const frames = (k) => { for (let i = 0; i < k; i++) __egg.frame(1 / 60); };
    await check('title', (k) => { const E = __egg; E.G.screen = 'title'; E.G.screenT = 5; for (let i = 0; i < 3; i++) E.frame(1 / 60); return E.overlaps(); }, 0, true);
    await check('levels', (k) => { const E = __egg; E.setSave({ unlocked: 20, stars: { 1: 3, 2: 2, 3: 1 } }); E.press('levels'); for (let i = 0; i < 30; i++) E.frame(1 / 60); return E.overlaps(); }, 0, true);
    await check('store', () => { const E = __egg; E.setSave({ unlocked: 20, wallet: { coins: 120, owned: { stone: 2, rewind: 1 } } }); E.press('shop'); for (let i = 0; i < 30; i++) E.frame(1 / 60); return E.overlaps(); }, 0, true);
    await check('store-skins', () => { const E = __egg; E.press('tab:skins'); for (let i = 0; i < 30; i++) E.frame(1 / 60); const o = E.overlaps(); E.press('back'); return o; }, 0, false);
    await check('power-card', () => { const E = __egg; E.start(0); E.press('go'); E.G.card = { id: 'fire_gold', t: 0.3, dur: 2 }; for (let i = 0; i < 3; i++) E.frame(1 / 60); return E.overlaps(); }, 0, false);
    for (let i = 0; i < n; i++) {
      const shoot = i === 0 || i === n - 1 || i === 12;
      await check(`L${i + 1}-intro`, (i) => { const E = __egg; E.start(i); for (let k = 0; k < 40; k++) E.frame(1 / 60); return E.overlaps(); }, i, shoot);
      await check(`L${i + 1}-play`, (i) => { const E = __egg; E.press('go'); for (let k = 0; k < 90; k++) E.frame(1 / 60); return E.overlaps(); }, i, shoot);
    }
    await check('pause', () => { const E = __egg; E.start(4); E.press('go'); for (let k = 0; k < 20; k++) E.frame(1 / 60); E.press('pause'); for (let k = 0; k < 30; k++) E.frame(1 / 60); return E.overlaps(); }, 0, true);
    for (const s of [3, 2, 1]) await check(`win${s}`, (s) => { const E = __egg; E.start(4); E.press('go'); E.frame(1 / 60); E.showResult('win', s); for (let k = 0; k < 400; k++) E.frame(1 / 60); return E.overlaps(); }, s, s === 3);
    await check('fail', () => { const E = __egg; E.start(4); E.press('go'); E.frame(1 / 60); E.showResult('fail'); for (let k = 0; k < 120; k++) E.frame(1 / 60); return E.overlaps(); }, 0, true);
    for (const e of errors) problems.push(`${w}x${h} PAGE ERROR: ${e}`);
    await p.close();
  }
  // contact sheet
  const html = `<html><body style="margin:0;background:#222;color:#ddd;font:12px sans-serif;display:flex;flex-wrap:wrap;gap:6px">${shots.map((s) => `<div><div>${s.label}</div><img src="data:image/png;base64,${fs.readFileSync(s.f).toString('base64')}" style="height:300px"></div>`).join('')}</body></html>`;
  const p2 = await b.newPage({ viewport: { width: 1800, height: 900 } });
  await p2.setContent(html);
  await p2.screenshot({ path: path.join(out, 'qa-sheet.png'), fullPage: true });
  shots.forEach((s) => fs.unlinkSync(s.f));
  await b.close();
  srv.close();
  console.log(problems.length ? problems.join('\n') : 'NO OVERLAPS');
  console.log(`checked ${SIZES.length} sizes; problems: ${problems.length}`);
})();
