// Thorn contrast QA: one crop per world theme with red/bone thorns, blunt spikes, outward thorns and a sealed thorn
// vine, at real phone scale, so a thorn that melts into its backdrop is caught before a player meets it.
// Usage: node tools/thorn-contrast.cjs [dist/dev] [outDir=qa/thorns]
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const dir = path.resolve(args[0] || 'dist/dev');
const out = path.resolve(args[1] || 'qa/thorns');
const VW = 390, VH = 844, DPR = 2, CW = 300, CH = 230;
fs.mkdirSync(out, { recursive: true });
const MAT = { farm: 'wood', barn: 'wood', orchard: 'wood', pumpkin: 'wood', bramble: 'vine', jungle: 'vine', mushroom: 'mushroom', frozen: 'ice', blizzard: 'stone', crystal: 'stone', volcano: 'obsidian', storm: 'metal', vault: 'metal', clock: 'metal' };

const srv = http.createServer((q, r) => {
  const f = path.join(dir, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); });
}).listen(8781);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto('http://localhost:8781/');
  await p.waitForTimeout(900);
  const shots = [];
  for (const [theme, material] of Object.entries(MAT)) {
    const L = {
      eggs: 1, target: 1, time: 0, spacing: 1.05, material, nest: { w: 2.6 }, seed: 77, tip: '', theme,
      rings: [{ gaps: [{ a: 90 }] },
        { gaps: [{ a: -100, vine: 1 }, { a: 120 }], thorns: [{ a: -55, n: 3 }, { a: -150, n: 2, kind: 'blunt' }, { a: -10, n: 2, side: 'out' }] },
        { gaps: [{ a: 60 }], thorns: [{ a: -80, n: 3 }] }],
    };
    const at = await p.evaluate(([L]) => {
      const E = __egg;
      E.setSave({ mode: 'medium', calm: false, seen: {} });
      E.G.demo = { id: 990, name: 'Studio', ...L };
      E.start(-2, { direct: true });
      E.G.paused = true; E.G.toast = null; E.G.toasts.length = 0;
      const S = E.G.sim, R = S.rings[1];
      R.body.setTransform(R.body.getPosition(), 0); R.target = 0;
      const e = S.eggs[0]; e.body.setTransform({ x: 0, y: 0.2 }, 0);
      const C = R.gaps[0].curtain; if (C) { C.alive = true; C.u = 1; }
      for (let i = 0; i < 30; i++) E.frame(1 / 60);
      E.G.toast = null; E.G.toasts.length = 0;
      for (let i = 0; i < 2; i++) E.frame(1 / 60);
      const G = E.G, P = G.play, x = 0.45, y = -R.r * 0.62;
      return { x: P.x + P.w / 2 + (x - G.cam.x) * G.cam.k, y: P.y + P.h / 2 - (y - G.cam.y) * G.cam.k };
    }, [L]);
    const cx = Math.round(Math.min(Math.max(at.x, CW / 2), VW - CW / 2)), cy = Math.round(Math.min(Math.max(at.y, CH / 2), VH - CH / 2));
    const f = path.join(out, `contrast-${theme}.png`);
    await p.screenshot({ path: f, clip: { x: cx - CW / 2, y: cy - CH / 2, width: CW, height: CH } });
    shots.push({ f, theme });
  }
  const html = `<html><body style="margin:0;background:#1d1712;color:#f5e6c8;font:14px sans-serif;padding:8px"><div style="display:grid;grid-template-columns:repeat(4,${CW}px);gap:8px">${shots.map((x) => `<div><img style="width:${CW}px;display:block;border-radius:6px" src="data:image/png;base64,${fs.readFileSync(x.f).toString('base64')}"><div style="padding:2px">${x.theme}</div></div>`).join('')}</div></body></html>`;
  const p2 = await b.newPage({ viewport: { width: (CW + 8) * 4 + 16, height: 400 } });
  await p2.setContent(html);
  await p2.screenshot({ path: path.join(out, 'thorn-contrast.png'), fullPage: true });
  for (const x of shots) fs.unlinkSync(x.f);
  for (const e of errors) console.log('PAGE ERROR: ' + e);
  console.log('-> ' + path.join(out, 'thorn-contrast.png'));
  await b.close();
  srv.close();
})();
