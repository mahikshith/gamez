// Thunder / lightning / zap look QA (v3.5): the same scenes drawn by two builds (before and after), side by side, at real phone scale.
// Usage: node tools/thunder-strips.cjs <beforeDist> <afterDist> [outDir=qa/thunder]   (ports QA_PORT and QA_PORT+1)
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const dirs = { before: path.resolve(args[0]), after: path.resolve(args[1]) };
const out = path.resolve(args[2] || 'qa/thunder');
const PORT = +process.env.QA_PORT || 8983;
const VW = 390, VH = 844, DPR = 2;
fs.mkdirSync(out, { recursive: true });

const base = { eggs: 3, target: 1, time: 0, spacing: 1.05, material: 'wood', nest: { w: 2.6 }, seed: 77, tip: '', theme: 'storm', rings: [{ gaps: [{ a: 90 }] }, { gaps: [{ a: 90 }] }, { gaps: [{ a: 60 }] }, { gaps: [{ a: 120 }] }] };
const LV = {
  clap: { ...base, eagle: { delay: 99, every: 99 }, snake: { delay: 0.2, speed: 0.3, a: 40 }, salamander: { delay: 0.2, ch: 2, a: -40 } },
  weather: { ...base, weather: 'thunder' },
  boss: { ...base, boss: 'storm', bossFight: { kind: 'storm', delay: 0.4, phases: [{ attacks: ['bolt'], every: 50 }] } },
  chick: { ...base, theme: 'farm' },
};
// each scene: setup (runs in page), then shots [label, seconds to run before the shot, crop {x,y,w,h} in css px]
const FULL = { x: 0, y: 150, w: 390, h: 420 };
const SCENES = [
  { id: 'clap', lv: 'clap', title: 'Thunderclap: bolts + flash + stunned creatures', setup: `Q.run(1.2); S.p2Take(S.aliveEggs()[0], 'thunderclap');`, shots: [['0.05 s', 0.05, FULL], ['0.2 s', 0.15, FULL], ['0.5 s', 0.3, FULL], ['1.2 s', 0.7, FULL]] },
  { id: 'shock', lv: 'clap', title: 'Shock ring: arcs on the live ring', setup: `Q.run(1.2); S.p2Take(S.aliveEggs()[0], 'shock');`, shots: [['0.1 s', 0.1, FULL], ['0.5 s', 0.4, FULL], ['1.0 s', 0.5, FULL]] },
  { id: 'ring', lv: 'clap', title: 'Stunned ring (drawStun)', setup: `Q.run(0.5); S.rings[1].stun = 2; S.rings[2].stun = 2;`, shots: [['a', 0.02, FULL], ['b', 0.1, FULL], ['c', 0.2, FULL]] },
  { id: 'weather', lv: 'weather', title: 'Weather lightning: warning, strike, screen flash', setup: `Q.run(0.3); S.wx.next = 0;`, shots: [['warn', 0.4, FULL], ['warn+', 0.5, FULL], ['strike', 0.35, FULL], ['strike+', 0.1, FULL], ['strike++', 0.15, FULL]] },
  { id: 'egg', lv: 'clap', title: 'Thunder egg zap', setup: `Q.run(0.6); const e = S.aliveEggs()[0]; e.zap = 1; window.Q.egg = e; 0;`, shots: [['a', 0.05, 'egg'], ['b', 0.1, 'egg'], ['c', 0.15, 'egg']] },
  { id: 'chick', lv: 'chick', title: 'Glow chick flash', setup: `Q.run(0.6); const e = S.aliveEggs()[0]; Q.hatch('glow', e);`, shots: [['a', 0.05, FULL], ['b', 0.15, FULL], ['c', 0.2, FULL]] },
  { id: 'boss', lv: 'boss', title: 'Storm boss bolt', setup: `Q.run(0.3);`, shots: [['warn', 0.7, FULL], ['strike', 0.4, FULL], ['strike+', 0.1, FULL]] },
];

const servers = Object.entries(dirs).map(([k, dir], i) => http.createServer((q, r) => {
  const f = path.join(dir, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); });
}).listen(PORT + i));

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const res = {};
  for (const [bi, k] of Object.keys(dirs).entries()) {
    const p = await b.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR });
    p.on('pageerror', (e) => errors.push(k + ': ' + String(e)));
    await p.goto(`http://localhost:${PORT + bi}/`);
    await p.waitForTimeout(900);
    for (const sc of SCENES) {
      await p.evaluate(([spec]) => {
        const E = __egg;
        E.setSave({ mode: 'medium', calm: false, seen: {} });
        E.G.demo = { id: 990, name: 'Studio', ...spec };
        E.start(-2, { direct: true });
        E.G.paused = true; E.G.toast = null; E.G.toasts.length = 0;
        window.S = E.G.sim;
        window.Q = {
          run(s) { for (let i = 0; i < Math.round(s * 60); i++) E.frame(1 / 60); },
          scr(x, y) { const G = E.G, P = G.play; return { x: P.x + P.w / 2 + (x - G.cam.x) * G.cam.k, y: P.y + P.h / 2 - (y - G.cam.y) * G.cam.k }; },
          hatch(kind, e) { const s = E.G.sim; s.hatchOrb(e, 'hatch_' + kind); s.hatch(e, true); s.tapChick(e.id); },
        };
      }, [LV[sc.lv]]);
      await p.evaluate(sc.setup).catch((e) => errors.push(k + ' ' + sc.id + ': ' + e.message));
      const frames = [];
      for (const [label, run, crop] of sc.shots) {
        await p.evaluate((s) => Q.run(s), run);
        let clip = crop;
        if (crop === 'egg') { const pt = await p.evaluate(() => { const q = Q.egg.body.getPosition(); return Q.scr(q.x, q.y); }); clip = { x: Math.max(0, pt.x - 70), y: Math.max(0, pt.y - 90), w: 140, h: 180 }; }
        const f = path.join(out, `${k}-${sc.id}-${frames.length}.png`);
        await p.screenshot({ path: f, clip: { x: clip.x, y: clip.y, width: clip.w, height: clip.h } });
        frames.push({ f, label, w: clip.w, h: clip.h });
      }
      (res[sc.id] = res[sc.id] || {})[k] = frames;
    }
    await p.close();
  }
  const FW = 150;
  const html = `<html><body style="margin:0;background:#1d1712;color:#f5e6c8;font:13px sans-serif;padding:8px">${SCENES.map((sc) => `<div style="margin-bottom:14px"><div style="font-weight:bold;margin:2px 0 4px;font-size:15px">${sc.title}</div>${['before', 'after'].map((k) => `<div style="display:flex;gap:6px;margin-bottom:4px;align-items:flex-start"><div style="width:50px;padding-top:4px;font-weight:bold">${k}</div>${(res[sc.id][k] || []).map((x) => `<div><img style="width:${FW * 1.4}px;display:block;border-radius:6px" src="data:image/png;base64,${fs.readFileSync(x.f).toString('base64')}"><div>${x.label}</div></div>`).join('')}</div>`).join('')}</div>`).join('')}</body></html>`;
  const p2 = await b.newPage({ viewport: { width: 1250, height: 400 } });
  await p2.setContent(html);
  await p2.screenshot({ path: path.join(out, 'thunder-strips.png'), fullPage: true });
  for (const sc of SCENES) for (const k in res[sc.id]) for (const x of res[sc.id][k]) fs.unlinkSync(x.f);
  for (const e of errors) console.log('ERROR: ' + e);
  console.log('wrote', path.join(out, 'thunder-strips.png'));
  await b.close();
  servers.forEach((s) => s.close());
})();
