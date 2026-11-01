// Chick kinds QA (v3.2): film strips at real in-game scale. For each kind: hatch -> ready -> tap -> power -> after,
// cropped around the chick from the live dev build (the tap is a real mouse click on the chick).
// Usage: node tools/chick-strips.cjs [dist/dev] [outDir=qa/chicks] [kinds=glow,dash,swoop,bulk,pick] [--size WxH]
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const dir = path.resolve(args[0] || 'dist/dev');
const out = path.resolve(args[1] || 'qa/chicks');
const kinds = (args[2] || 'glow,dash,swoop,bulk,pick').split(',');
const si = process.argv.indexOf('--size');
const [VW, VH] = si > 0 ? process.argv[si + 1].split('x').map(Number) : [1280, 720];
const ZOOM = process.argv.includes('--zoom') ? 3 : 1; // --zoom: the same frames at 3x pixel density, cropped tighter
const CROP = Math.round(Math.min(VW, VH) * (ZOOM > 1 ? 0.2 : 0.42));
const TAG = ZOOM > 1 ? '-zoom' : '';
fs.mkdirSync(out, { recursive: true });

// Studio levels: the egg starts in the centre chamber next to a hatch orb, with something for the power to act on.
const base = { eggs: 1, target: 1, time: 0, spacing: 1.05, material: 'wood', nest: { w: 2.6 }, seed: 77, tip: '' };
const STUDIO = {
  glow: { ...base, theme: 'farm', eggs: 2, orbs: [{ type: 'hatch_glow', ch: 0, a: -90 }], snake: { delay: 0.3, speed: 0.5, a: -40 }, rings: [{ gaps: [{ a: 120 }], thorns: [{ a: -50, n: 2 }, { a: -130, n: 2 }] }, { gaps: [{ a: -30 }] }, { gaps: [{ a: 160 }] }] },
  dash: { ...base, theme: 'bramble', material: 'vine', orbs: [{ type: 'hatch_dash', ch: 0, a: -90 }, { type: 'fire_green', ch: 0, a: -20 }], rings: [{ gaps: [{ a: 120 }], thorns: [{ a: -25, n: 3, kind: 'blunt' }] }, { gaps: [{ a: -30 }] }, { gaps: [{ a: 160 }] }] },
  swoop: { ...base, theme: 'orchard', orbs: [{ type: 'hatch_swoop', ch: 1, a: -90 }], rings: [{ gaps: [{ a: -90 }, { a: 90, curtain: 1 }] }, { gaps: [{ a: 150 }] }, { gaps: [{ a: 20 }] }] },
  bulk: { ...base, theme: 'jungle', material: 'vine', orbs: [{ type: 'hatch_bulk', ch: 0, a: -90 }], rings: [{ gaps: [{ a: 90 }], thorns: [{ a: -50, n: 2 }, { a: -130, n: 2 }] }, { gaps: [{ a: -30 }] }, { gaps: [{ a: 160 }] }] },
  pick: { ...base, theme: 'blizzard', orbs: [{ type: 'hatch_pick', ch: 0, a: -90 }], rings: [{ gaps: [], ice: true }, { gaps: [{ a: -60 }], ice: [{ a: 160, len: 2 }] }, { gaps: [{ a: 160 }] }] },
};
// seconds after the tap for the 'power' and 'after' frames
const WHEN = { glow: [0.22, 1.6], dash: [0.45, 2.2], swoop: [0.3, 2.6], bulk: [1.2, 6.0], pick: [0.4, 1.2] };

const srv = http.createServer((q, r) => {
  const f = path.join(dir, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); });
}).listen(8771);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: ZOOM });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto('http://localhost:8771/');
  await p.waitForTimeout(900);
  for (const kind of kinds) {
    await p.evaluate(([L]) => {
      const E = __egg;
      E.setSave({ seen: { hatch_glow: 1, hatch_dash: 1, hatch_swoop: 1, hatch_bulk: 1, hatch_pick: 1, fire_green: 1 } });
      E.G.demo = { id: 990, name: 'Studio', ...L };
      E.start(-2, { direct: true });
      E.G.paused = true;
      E.G.toast = null; E.G.toasts.length = 0;
    }, [STUDIO[kind]]);
    const run = (s) => p.evaluate((s) => { for (let i = 0; i < Math.round(s * 60); i++) __egg.frame(1 / 60); }, s);
    const chick = () => p.evaluate(() => {
      const G = __egg.G, e = G.sim.eggs.find((x) => x.tint || x.chick) || G.sim.eggs[0];
      if (!e.body || !e.alive) return { id: e.id, gone: true, x: 0, y: 0 };
      const q = e.body.getPosition(), P = G.play;
      return { id: e.id, x: P.x + P.w / 2 + (q.x - G.cam.x) * G.cam.k, y: P.y + P.h / 2 - (q.y - G.cam.y) * G.cam.k, tint: e.tint, chick: e.chick, hatchT: e.hatchT, powU: e.powU, powK: e.powK };
    });
    const frames = [];
    let at = null; // keep the crop steady once the chick is found
    const shoot = async (label) => {
      const c = await chick();
      if (!c.gone) at = c; // follow the chick
      const cx = Math.round(Math.min(Math.max(at.x, CROP / 2), VW - CROP / 2)), cy = Math.round(Math.min(Math.max(at.y, CROP / 2), VH - CROP / 2));
      const f = path.join(out, `${kind}-${frames.length}-${label}.png`);
      await p.screenshot({ path: f, clip: { x: cx - CROP / 2, y: cy - CROP / 2, width: CROP, height: CROP } });
      frames.push({ f, label });
    };
    // hatch: wait for the tint, then catch it trembling
    for (let i = 0; i < 80; i++) { const c = await chick(); if (c.hatchT > 0 || c.chick) break; await run(0.1); }
    await run(0.3);
    await shoot('hatch');
    await run(1.0);
    if (kind === 'swoop') {
      // turn the curtain over the chick: ring 0 half a turn
      await p.evaluate(() => { const R = __egg.G.sim.rings[0], a = R.body.getAngle() + Math.PI; R.body.setTransform(R.body.getPosition(), a); R.target = a; });
      await run(0.6);
    }
    await shoot('ready');
    const c = await chick();
    // a real tap on the chick
    await p.mouse.move(c.x, c.y);
    await p.mouse.down();
    await p.mouse.up();
    await run(0.07);
    const used = await p.evaluate(() => __egg.G.sim.eggs.some((e) => e.chick && e.powU));
    await shoot('tap');
    await run(WHEN[kind][0]);
    await shoot('power');
    await run(WHEN[kind][1] - WHEN[kind][0]);
    await shoot('after');
    // strip: frames side by side with labels
    const html = `<html><body style="margin:0;background:#1d1712;color:#f5e6c8;font:15px sans-serif;display:flex;gap:6px;padding:6px">${frames.map((x) => `<div><div style="padding:2px 4px">${kind} - ${x.label}</div><img style="width:${CROP * ZOOM}px" src="data:image/png;base64,${fs.readFileSync(x.f).toString('base64')}"></div>`).join('')}</body></html>`;
    const W2 = CROP * ZOOM;
    const p2 = await b.newPage({ viewport: { width: (W2 + 6) * frames.length + 12, height: W2 + 40 } });
    await p2.setContent(html);
    await p2.screenshot({ path: path.join(out, `strip-${kind}${TAG}.png`) });
    await p2.close();
    frames.forEach((x) => fs.unlinkSync(x.f));
    console.log(`${kind}: tap ${used ? 'used the power' : 'DID NOT fire'} -> ${path.join(out, `strip-${kind}${TAG}.png`)}`);
  }
  for (const e of errors) console.log('PAGE ERROR: ' + e);
  await b.close();
  srv.close();
})();
