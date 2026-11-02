// Frog QA (v3.3 M8): film strips from the live dev build at real phone scale (390x844, DPR 2), plus a big pose gallery
// and a full-level view. Every row is the real sim driving the real renderer.
// Rows: idle, crouch (the hop telegraph), hop up, hop down, landing, lick + gulp (orb), lick + gulp (chick), scared leap
// (flame on an egg), plug (an egg lands on a frog sitting in a gap, then the frog hops away and the egg drops).
// Usage: node tools/frog-strips.cjs [dist/dev] [outDir=qa/frog] [port=8779]
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const dir = path.resolve(args[0] || 'dist/dev');
const out = path.resolve(args[1] || 'qa/frog');
const PORT = +(args[2] || 8779);
const VW = 390, VH = 844, DPR = 2, CROP = 130;
fs.mkdirSync(out, { recursive: true });

const base = { eggs: 1, target: 1, time: 0, spacing: 1.05, material: 'vine', nest: { w: 2.6 }, seed: 77, tip: '', theme: 'bramble' };
// four rings; the frog's options are set by which rings have a gap near the bottom
const STUDIO = {
  idle: { ...base, rings: [{ gaps: [{ a: 90 }] }, { gaps: [{ a: 90 }] }, { gaps: [{ a: 90 }] }, { gaps: [{ a: 90 }] }], frog: { ch: 2, a: -90, delay: 99 } },
  crouch: { ...base, rings: [{ gaps: [{ a: 90 }] }, { gaps: [{ a: 90 }] }, { gaps: [{ a: -90 }] }, { gaps: [{ a: 90 }] }], frog: { ch: 2, a: -100, delay: 0.3 } },
  up: { ...base, rings: [{ gaps: [{ a: 90 }] }, { gaps: [{ a: -80 }] }, { gaps: [{ a: 90 }] }, { gaps: [{ a: 90 }] }], frog: { ch: 2, a: -100, delay: 0.3 } },
  down: { ...base, rings: [{ gaps: [{ a: 90 }] }, { gaps: [{ a: 90 }] }, { gaps: [{ a: -80 }] }, { gaps: [{ a: -110 }] }], frog: { ch: 2, a: -100, delay: 0.3 } },
  lick: { ...base, rings: [{ gaps: [{ a: 90 }] }, { gaps: [{ a: 90 }] }, { gaps: [{ a: 90 }] }, { gaps: [{ a: 90 }] }], orbs: [{ type: 'fire_red', ch: 2, a: -75 }], frog: { ch: 2, a: -100, delay: 99 } },
  chick: { ...base, eggs: 2, rings: [{ gaps: [{ a: 90 }] }, { gaps: [{ a: 90 }] }, { gaps: [{ a: 90 }] }, { gaps: [{ a: 90 }] }], frog: { ch: 2, a: -100, delay: 99 } },
  scared: { ...base, eggs: 2, rings: [{ gaps: [{ a: 90 }] }, { gaps: [{ a: -80 }] }, { gaps: [{ a: 90 }] }, { gaps: [{ a: 90 }] }], frog: { ch: 2, a: -100, delay: 99 } },
  plug: { ...base, rings: [{ gaps: [{ a: -90 }] }, { gaps: [{ a: -90 }] }, { gaps: [{ a: 90 }] }, { gaps: [{ a: 90 }] }], frog: { ch: 1, a: -90, delay: 99 } },
  level: { ...base, eggs: 2, rings: [{ gaps: [{ a: 90 }] }, { gaps: [{ a: -90 }, { a: 90 }] }, { gaps: [{ a: -60 }, { a: 140 }] }, { gaps: [{ a: -120 }, { a: 40 }] }, { gaps: [{ a: -80 }] }],
    orbs: [{ type: 'water', ch: 3, a: -60 }, { type: 'stone', ch: 2, a: -120 }], frog: [{ ch: 1, a: -90, delay: 99 }, { ch: 3, a: -100, delay: 99, face: -1 }, { ch: 2, a: -50, delay: 99 }] },
};

const srv = http.createServer((q, r) => {
  const f = path.join(dir, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); });
}).listen(PORT);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(`http://localhost:${PORT}/`);
  await p.waitForTimeout(900);
  const ev = (fn, ...a) => p.evaluate(fn, ...a);
  const rows = [];
  for (const [name, L] of Object.entries(STUDIO)) {
    if (name === 'level') continue;
    await ev(([L]) => {
      const E = __egg;
      E.setSave({ mode: 'medium', calm: false, seen: {} });
      E.G.demo = { id: 990, name: 'Studio', ...L };
      E.start(-2, { direct: true });
      E.G.paused = true;
      E.G.toast = null; E.G.toasts.length = 0; E.G.predToast = {};
      window.Q = {
        scr(x, y) { const G = E.G, P = G.play; return { x: P.x + P.w / 2 + (x - G.cam.x) * G.cam.k, y: P.y + P.h / 2 - (y - G.cam.y) * G.cam.k }; },
        run(s) { for (let i = 0; i < Math.round(s * 60); i++) E.frame(1 / 60); },
        F() { return E.G.sim.frogs[0]; },
        // park every egg in the centre chamber, still
        park() { for (const e of E.G.sim.eggs) if (e.body) { e.body.setTransform({ x: 0, y: 0.1 }, 0); e.body.setLinearVelocity({ x: 0, y: 0 }); e.body.setType('static'); } },
        // hold an egg (or chick) at a world point
        hold(i, x, y) { const e = E.G.sim.eggs[i]; e.body.setType('static'); e.body.setTransform({ x, y }, 0); },
        until(f, max = 6) { for (let i = 0; i < max * 60 && !f(); i++) E.frame(1 / 60); },
      };
      if (E.G.sim.level.eggs > 0 && !window.keepEggs) Q.park();
      Q.run(0.4);
    }, [L]);
    const frames = [];
    let anchor = null;
    const shoot = async (label, world) => {
      if (world) anchor = world;
      const at = await ev((w) => Q.scr(w.x, w.y), anchor); // the camera may move: follow the world point
      const cx = Math.round(Math.min(Math.max(at.x, CROP / 2), VW - CROP / 2)), cy = Math.round(Math.min(Math.max(at.y, CROP / 2), VH - CROP / 2));
      const f = path.join(out, `${name}-${frames.length}.png`);
      await p.screenshot({ path: f, clip: { x: cx - CROP / 2, y: cy - CROP / 2, width: CROP, height: CROP } });
      frames.push({ f, label });
    };
    const foot = () => ev(() => { const F = Q.F(); return { x: F.x, y: F.y }; });
    const mid = () => ev(() => { const F = Q.F(), T = __egg.G.sim.rings[F.ti]; const w = T.body.getAngle() + F.tla; return { x: (F.x + T.r * Math.cos(w)) / 2, y: (F.y + T.r * Math.sin(w)) / 2 }; });
    const step = (s) => ev((s) => Q.run(s), s);
    if (name === 'idle') {
      const w = await foot();
      for (let i = 0; i < 8; i++) { await shoot(`${(i * 0.42).toFixed(2)} s`, i ? null : w); await step(0.42); }
    } else if (name === 'crouch') {
      await ev(() => Q.until(() => Q.F().ph === 'crouch'));
      const w = await foot();
      for (const [i, lab] of ['0 s', '0.15 s', '0.3 s', '0.45 s', '0.6 s', '0.69 s'].entries()) { await shoot(lab, i ? null : w); await step(i === 0 ? 0.15 : i === 5 ? 0.09 : 0.15); }
    } else if (name === 'up' || name === 'down') {
      await ev(() => Q.until(() => Q.F().ph === 'crouch'));
      const w0 = await foot();
      await shoot('crouch end', w0);
      await ev(() => Q.until(() => Q.F().ph === 'crouch' && Q.F().t > Q.F().dur - 0.04));
      // film the whole arc from the midpoint of take-off and landing, frame by frame
      await ev(() => Q.until(() => Q.F().ph === 'hop'));
      const w = await mid();
      const hd = await ev(() => Q.F().hd);
      await shoot('take-off', w);
      for (let i = 1; i <= 7; i++) { await step(hd / 8); await shoot(`${Math.round((i / 8) * 100)}%`); }
      await ev(() => Q.until(() => Q.F().ph === 'land'));
      await shoot('land');
      await step(0.12); await shoot('squash');
      await step(0.3); await shoot('settled');
    } else if (name === 'lick') {
      await ev(() => { Q.F().lickCD = 0; Q.until(() => Q.F().ph === 'lick'); });
      const w = await foot();
      await shoot('lick 0', w);
      for (const t of [0.12, 0.12, 0.12]) { await step(t); await shoot('licking'); }
      await ev(() => Q.until(() => Q.F().ph === 'tongue'));
      await step(0.04); await shoot('tongue out');
      await step(0.08); await shoot('hit');
      await step(0.08); await shoot('hauled back');
      await ev(() => Q.until(() => Q.F().ph === 'gulp'));
      await shoot('gulp 0');
      for (const t of [0.15, 0.15, 0.15]) { await step(t); await shoot('gulp'); }
      await step(0.5); await shoot('done');
    } else if (name === 'chick') {
      // a hatched chick floats by, held still: the frog licks, snatches, swallows
      await ev(() => { const s = __egg.G.sim, F = Q.F(); const e = s.eggs[1]; e.body.setType('dynamic'); s.hatch(e); const a = F.wa + 0.2, r = F.rf - 0.5; Q.hold(1, r * Math.cos(a), r * Math.sin(a)); F.lickCD = 0; Q.until(() => Q.F().ph === 'lick'); });
      const w = await foot();
      await shoot('lick', w);
      await step(0.3); await shoot('licking');
      await ev(() => Q.until(() => Q.F().ph === 'tongue'));
      await step(0.04); await shoot('tongue out');
      await step(0.08); await shoot('hit');
      await step(0.08); await shoot('hauled back');
      await ev(() => Q.until(() => Q.F().ph === 'gulp'));
      await shoot('gulp 0');
      await step(0.2); await shoot('gulp');
      await step(0.25); await shoot('gulp');
      await step(0.5); await shoot('done');
    } else if (name === 'scared') {
      // an egg with a red flame rolls up next to it
      await ev(() => { const s = __egg.G.sim, F = Q.F(), e = s.eggs[1]; e.body.setType('static'); e.fire = 99; e.fireKind = 'fire_red'; const a = F.wa + 0.45, r = F.rf - 0.3; e.body.setTransform({ x: r * Math.cos(a), y: r * Math.sin(a) }, 0); });
      const w = await foot();
      await shoot('flame near', w);
      await ev(() => Q.until(() => Q.F().ph === 'crouch', 1));
      await shoot('startled');
      await step(0.14); await shoot('leaps');
      const m = await mid();
      for (let i = 0; i < 4; i++) { await step(0.12); await shoot('in the air', i ? null : m); }
      await ev(() => Q.until(() => Q.F().ph === 'land'));
      await shoot('lands');
      await step(0.4); await shoot('settled');
    } else if (name === 'plug') {
      // the frog sits in the gap of ring 1; an egg from the centre chamber drops onto it
      await ev(() => { const s = __egg.G.sim; const e = s.eggs[0]; e.body.setType('dynamic'); e.body.setTransform({ x: 0.05, y: -0.55 }, 0); e.body.setLinearVelocity({ x: 0, y: 0 }); window.keepEggs = 1; });
      const w = await ev(() => { const F = Q.F(); return { x: F.x, y: F.y + 0.7 }; });
      await shoot('egg above', w);
      await ev(() => Q.until(() => __egg.G.sim.eggs[0].body.getLinearVelocity().y < -2.5, 3));
      await shoot('falling');
      await ev(() => Q.until(() => Q.F().bump > 0.1, 3));
      await shoot('lands: soft');
      await step(0.1); await shoot('squash');
      await step(0.12); await shoot('bounce');
      await step(0.5); await shoot('rests on it');
      // now let it hop away: the plug goes
      await ev(() => { Q.F().next = 0; });
      await ev(() => Q.until(() => Q.F().ph === 'crouch', 2));
      await shoot('frog crouches');
      await ev(() => Q.until(() => Q.F().ph === 'hop', 2));
      await step(0.2); await shoot('hops away');
      await step(0.35); await shoot('egg drops');
      await step(0.5); await shoot('through');
    }
    rows.push({ name, frames });
  }

  // full-level view at phone scale
  await ev(([L]) => {
    const E = __egg;
    E.setSave({ mode: 'medium', calm: false, seen: {} });
    E.G.demo = { id: 990, name: 'Studio', ...L };
    E.start(-2, { direct: true });
    E.G.toast = null; E.G.toasts.length = 0;
    for (let i = 0; i < 90; i++) E.frame(1 / 60);
  }, [STUDIO.level]);
  await p.screenshot({ path: path.join(out, 'frog-level.png') });

  // a hop, caught mid-air, in the full view
  await ev(() => { const s = __egg.G.sim; s.frogs[1].next = 0; for (let i = 0; i < 60 * 4 && s.frogs[1].ph !== 'hop'; i++) __egg.frame(1 / 60); for (let i = 0; i < 12; i++) __egg.frame(1 / 60); });
  await p.screenshot({ path: path.join(out, 'frog-level-hop.png') });

  // big pose gallery (the same art, 3x)
  const gp = await b.newPage({ viewport: { width: 1320, height: 700 }, deviceScaleFactor: 1 });
  gp.on('pageerror', (e) => errors.push(String(e)));
  await gp.goto(`http://localhost:${PORT}/`);
  await gp.waitForTimeout(900);
  await gp.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 1320; c.height = 700;
    c.style = 'position:fixed;left:0;top:0;z-index:99';
    document.body.appendChild(c);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#3d5f34'; ctx.fillRect(0, 0, 1320, 700);
    const P = [
      ['idle', {}], ['blink', { blink: 1 }], ['throat pulse', { puff: 0.35 }], ['crouch: telegraph', { crouch: 1, puff: 1 }],
      ['launch', { stretch: 0.5, crouch: 0.3 }], ['air', { stretch: 1 }], ['squash', { squash: 0.8 }], ['lick: lips', { lick: 0.22, mouth: 0.2 }],
      ['tongue out', { mouth: 1, tongue: { x: 118, y: -26 } }], ['gulp', { gulp: 0.4, puff: 0.5 }], ['scared', { scared: 1, crouch: 0.7 }], ['in a gap', { plug: 1 }],
    ];
    ctx.font = '15px sans-serif';
    P.forEach(([n, o], i) => {
      const x = 130 + (i % 4) * 320, y = 185 + Math.floor(i / 4) * 215;
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x - 118, y - 120, 300, 160);
      ctx.fillStyle = '#fff'; ctx.fillText(n, x - 108, y - 98);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x - 118, y, 300, 2);
      __egg.frogArt(ctx, x + 20, y, 250, 1.3 + i * 0.4, { id: i, ...o });
    });
  });
  await gp.screenshot({ path: path.join(out, 'frog-poses.png') });
  await gp.close();

  // one sheet: a labelled row per scenario
  const W2 = Math.round(CROP * 2);
  const img = (f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;
  const html = `<html><body style="margin:0;background:#1d1712;color:#f5e6c8;font:14px sans-serif;padding:8px">${rows.map((r) => `<div style="margin-bottom:10px"><div style="font-weight:bold;margin:2px 0 4px">${esc(r.name)}</div><div style="display:flex;gap:6px">${r.frames.map((x) => `<div><img style="width:${W2}px;display:block;border-radius:6px" src="${img(x.f)}"><div style="padding:2px">${esc(x.label)}</div></div>`).join('')}</div></div>`).join('')}</body></html>`;
  const p2 = await b.newPage({ viewport: { width: Math.round((W2 + 6) * 7 + 20), height: 400 } });
  await p2.setContent(html);
  await p2.screenshot({ path: path.join(out, 'frog-strips.png'), fullPage: true });
  await p2.close();
  for (const r of rows) for (const x of r.frames) fs.unlinkSync(x.f);
  for (const e of errors) console.log('PAGE ERROR: ' + e);
  console.log('-> ' + path.join(out, 'frog-strips.png') + ', frog-poses.png, frog-level.png, frog-level-hop.png');
  await b.close();
  srv.close();
})();
