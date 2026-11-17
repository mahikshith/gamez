// Gator Bayou QA (v3.7): film strips of every pose and state of the new cast at real phone scale (390x844, DPR 2), driven
// frame by frame in the live dev build: the alligator, the snapping turtle, the mosquito swarm, Grandpa Gator (the L45 boss),
// plus his boss card, the boss bar emblem and the bar itself.
// Usage: node tools/bayou-strips.cjs [dist/dev] [outDir=qa/bayou] [--port 9062]
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2), args = argv.filter((a) => !a.startsWith('--') && !/^\d+$/.test(a));
const port = +(argv[argv.indexOf('--port') + 1] || 9062) || 9062;
const dir = path.resolve(args[0] || 'dist/dev');
const out = path.resolve(args[1] || 'qa/bayou');
const VW = 390, VH = 844, DPR = 2;
fs.mkdirSync(out, { recursive: true });

const base = { eggs: 3, target: 2, time: 0, spacing: 1.0, material: 'wood', theme: 'bayou', nest: { w: 2.6 }, seed: 77, tip: '' };
const rings5 = [{ gaps: [{ a: 90 }] }, { gaps: [{ a: 90 }] }, { gaps: [{ a: 120 }, { a: -30 }] }, { gaps: [{ a: 60 }, { a: -150 }] }, { gaps: [{ a: 100 }] }];
const STUDIO = {
  gator: { ...base, gator: { ch: 3, a: -90, delay: 0 }, rings: rings5 },
  turtle: { ...base, turtle: { ch: 3, a: -90, delay: 0 }, rings: rings5 },
  mosquito: { ...base, mosquito: { ch: 3, a: -90, delay: 99 }, rings: rings5 },
  grandpa: { ...base, boss: 'gator', bossFight: { kind: 'gator', delay: 99, hp: 3, a: -90, phases: [{ attacks: ['sweep'], every: 99 }] }, gator: [{ ch: 3, a: -60, call: 1 }], rings: [...rings5, { gaps: [{ a: 80 }] }] },
};

const srv = http.createServer((q, r) => {
  const f = path.join(dir, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); });
}).listen(port);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(`http://localhost:${port}/`);
  await p.waitForTimeout(900);
  const rows = [];
  const ev = (fn, ...a) => p.evaluate(fn, ...a);
  for (const [name, L] of Object.entries(STUDIO)) {
    await ev(([L]) => {
      const E = __egg;
      E.setSave({ mode: 'medium', calm: false, seen: {} });
      E.G.demo = { id: 990, name: 'Studio', ...L };
      E.start(-2, { direct: true });
      E.G.toast = null; E.G.toasts && (E.G.toasts.length = 0);
      const S = () => E.G.sim;
      window.Q = {
        scr(x, y) { const G = E.G, P = G.play; return { x: P.x + P.w / 2 + (x - G.cam.x) * G.cam.k, y: P.y + P.h / 2 - (y - G.cam.y) * G.cam.k }; },
        run(s) { for (let i = 0; i < Math.round(s * 60); i++) E.frame(1 / 60); E.G.toast = null; },
        setRing(i, deg) { const R = S().rings[i], a = (deg * Math.PI) / 180; R.body.setTransform(R.body.getPosition(), a); R.target = a; R.body.setAngularVelocity(0); },
        // world point at angle a (deg) on the floor of channel ch, raised h m
        fp(ch, a, h = 0) { const r = S().byFloor(ch) - h, w = (a * Math.PI) / 180; return { x: r * Math.cos(w), y: r * Math.sin(w) }; },
        egg(i, x, y) { const e = S().eggs[i]; e.body.setTransform({ x, y }, 0); e.body.setLinearVelocity({ x: 0, y: 0 }); e.body.setAngularVelocity(0); return e; },
        park() { S().eggs.forEach((e, i) => { if (e.body) Q.egg(i, -0.25 + i * 0.25, 0.25); }); },
        quiet() { S().events.length = 0; E.G.toast = null; },
      };
      Q.park(); Q.run(0.3);
    }, [L]);
    const frames = [];
    const CROP = name === 'grandpa' ? 230 : 170;
    let at = null;
    const shoot = async (label, world, crop = CROP) => {
      if (world) at = await ev((w) => Q.scr(w.x, w.y), world);
      const cx = Math.round(Math.min(Math.max(at.x, crop / 2), VW - crop / 2)), cy = Math.round(Math.min(Math.max(at.y, crop / 2), VH - crop / 2));
      const f = path.join(out, `${name}-${frames.length}.png`);
      await p.screenshot({ path: f, clip: { x: cx - crop / 2, y: cy - crop / 2, width: crop, height: crop } });
      frames.push({ f, label, w: crop });
    };
    if (name === 'gator') {
      const c = await ev(() => { Q.setRing(2, 0); Q.setRing(3, 0); const G = __egg.G.sim.gators[0]; G.ph = 'log'; G.next = 9; Q.run(0.3); return Q.fp(3, -90, 0.3); });
      await shoot('asleep: a log', c);
      await ev(() => { const s = __egg.G.sim, G = s.gators[0]; Q.setRing(3, -60); const p = Q.fp(3, -90, 0.62); Q.egg(0, p.x - 0.3, p.y); Q.run(0.4); });
      await shoot('its back is a bridge');
      await ev(() => { Q.park(); const G = __egg.G.sim.gators[0]; G.next = 0; G.a = -100 * Math.PI / 180; const p = Q.fp(2, -55, 0.25); Q.egg(0, p.x, p.y); Q.run(0.7); });
      await shoot('wakes, creeps under the egg');
      // an egg over a gap of ring 2 right above its jaws
      await ev(() => { const s = __egg.G.sim, G = s.gators[0]; Q.park(); G.a = -95 * Math.PI / 180; G.face = 1; G.next = 0; const J = s.gJaw(G), ja = Math.atan2(J.y, J.x) * 180 / Math.PI; Q.setRing(2, ja - (-30)); const p = Q.fp(2, ja, 0.25); Q.egg(0, p.x, p.y + 0.1); G.ph = 'warn'; G.t = 0; G.dur = 0.9; Q.run(0.3); });
      await shoot('jaws open at the gap');
      await ev(() => { const G = __egg.G.sim.gators[0]; G.t = G.dur * 0.75; Q.run(0.05); });
      await shoot('about to snap');
      await ev(() => { const s = __egg.G.sim, G = s.gators[0]; const J = s.gJaw(G); Q.egg(0, J.x, J.y); G.ph = 'warn'; G.t = G.dur - 0.01; Q.run(0.08); });
      await shoot('CHOMP: cracks the egg');
      await ev(() => { const s = __egg.G.sim, G = s.gators[0]; Q.park(); Q.run(1.2); G.ph = 'warn'; G.t = G.dur - 0.01; G.next = 0; Q.run(0.1); });
      await shoot('gap turned away: missed');
      await ev(() => { const s = __egg.G.sim, G = s.gators[0]; Q.run(1); s.gFlee(G, 8, 'pepper'); Q.run(0.25); });
      await shoot('pepper: sneezes, flees');
      await ev(() => { const s = __egg.G.sim, G = s.gators[0]; Q.run(2.5); G.a = -90 * Math.PI / 180; G.ph = 'log'; G.next = 9; G.frz = G.frzMax = 4; Q.run(0.4); });
      await shoot('frozen', await ev(() => Q.fp(3, -90, 0.3)));
      await ev(() => { const G = __egg.G.sim.gators[0]; G.frz = 0.5; Q.run(0.15); });
      await shoot('ice cracks');
      await ev(() => { const G = __egg.G.sim.gators[0]; G.frz = 0; G.stn = G.stnMax = 3; G.zap = 0; Q.run(1.2); });
      await shoot('stunned');
    } else if (name === 'turtle') {
      const c = await ev(() => { Q.setRing(3, 0); const T = __egg.G.sim.turtles[0]; T.next = 0; const p = Q.fp(3, -60, 0.21); Q.egg(0, p.x, p.y); Q.run(0.8); return Q.fp(3, -82, 0.3); });
      await shoot('crawls to the egg', c);
      await ev(() => { const s = __egg.G.sim, T = s.turtles[0]; for (let i = 0; i < 600 && T.ph === 'crawl'; i++) Q.run(1 / 60); if (T.ph !== 'warn') { if (T.eid) s.tLet(T, 'end'); s.bySet(T, 'warn', 0.6); } T.t = 0.3; Q.run(0.02); Q.quiet(); });
      await shoot('pulls its head back');
      await ev(() => { const s = __egg.G.sim, T = s.turtles[0]; for (let i = 0; i < 300 && T.ph !== 'clamp'; i++) Q.run(1 / 60); Q.run(0.2); });
      await shoot('CLAMP: egg is safe, stuck');
      await ev(() => Q.run(1.2));
      await shoot('holds it');
      await ev(() => { const s = __egg.G.sim, T = s.turtles[0]; s.tFlip(T, 'drop'); Q.run(0.3); });
      await shoot('a drop flips it');
      await ev(() => Q.run(1.4));
      await shoot('on its back, egg free');
      await ev(() => { const s = __egg.G.sim, T = s.turtles[0]; Q.park(); T.ph = 'right'; T.t = 0.3; T.dur = 0.7; Q.run(0.05); });
      await shoot('rights itself');
      await ev(() => { const s = __egg.G.sim, T = s.turtles[0]; Q.run(1); T.ph = 'shell'; T.t = 0; T.dur = 9; Q.run(0.3); });
      await shoot('pepper: hides in shell');
      await ev(() => { const s = __egg.G.sim, T = s.turtles[0]; T.ph = 'crawl'; T.next = 9; T.frz = T.frzMax = 4; Q.run(0.4); });
      await shoot('frozen');
      await ev(() => { const T = __egg.G.sim.turtles[0]; T.frz = 0; T.stn = T.stnMax = 3; Q.run(1.2); });
      await shoot('stunned');
    } else if (name === 'mosquito') {
      const c = await ev(() => { const Qm = __egg.G.sim.mosqs[0]; Q.run(0.5); return { x: Qm.hx, y: Qm.hy }; });
      await shoot('hovers at home', c);
      await ev(() => { const s = __egg.G.sim, M = s.mosqs[0]; Q.setRing(3, 0); const p = Q.fp(3, -60, 0.21); Q.egg(0, p.x, p.y); M.next = 0; Q.run(0.5); });
      await shoot('flies at an egg');
      await ev(() => { const s = __egg.G.sim, M = s.mosqs[0]; for (let i = 0; i < 400 && M.ph !== 'latch'; i++) Q.run(1 / 60); Q.run(0.25); });
      const e0 = await ev(() => { const p = __egg.G.sim.eggs[0].body.getPosition(); return { x: p.x, y: p.y + 0.3 }; });
      await shoot('latches on (buzz)', e0);
      await ev(() => { const s = __egg.G.sim, M = s.mosqs[0]; for (let i = 0; i < 300 && M.ph !== 'lift'; i++) Q.run(1 / 60); Q.run(0.9); });
      await shoot('lifts the egg');
      await ev(() => Q.run(0.8));
      await shoot('higher');
      await ev(() => { const s = __egg.G.sim, e = s.eggs[0]; e.fire = 5; e.fireKind = 'fire_red'; Q.run(0.25); });
      await shoot('a flame scatters it');
      await ev(() => { const s = __egg.G.sim, M = s.mosqs[0]; s.eggs[0].fire = 0; Q.park(); Q.run(4.5); M.ph = 'roam'; M.next = 9; M.x = M.hx; M.y = M.hy; M.frz = M.frzMax = 4; Q.run(0.3); });
      await shoot('frozen', c);
      await ev(() => { const M = __egg.G.sim.mosqs[0]; M.frz = 0; M.y = M.hy; M.stn = M.stnMax = 3; Q.run(0.6); });
      await shoot('stunned');
    } else if (name === 'grandpa') {
      const c = await ev(() => { Q.setRing(4, 0); Q.setRing(5, 0); const G = __egg.G.sim.gators[0]; G.ph = 'log'; G.next = 9; G.a = -90 * Math.PI / 180; Q.run(0.3); return Q.fp(5, -90, 0.4); });
      await shoot('Grandpa: idle', c);
      await ev(() => { const s = __egg.G.sim, B = s.bx.boss, G = s.gators[0]; G.next = 9; G.ph = 'atk'; B.atk = { name: 'sweep', ph: 'warn', t: 0.5, dur: 1.1 }; Q.run(0.25); });
      await shoot('tail sweep: winds up');
      await ev(() => { const s = __egg.G.sim, B = s.bx.boss; B.atk.ph = 'act'; B.atk.t = 0.3; Q.run(0.05); });
      await shoot('sweep: the rings shake');
      await ev(() => { const s = __egg.G.sim, B = s.bx.boss, G = s.gators[0]; B.atk = null; G.ph = 'atk'; Q.run(0.6); B.atk = { name: 'roll', ph: 'warn', t: 0.5, dur: 1.2, ring: 4, dir: 1 }; G.ph = 'atk'; Q.run(0.3); });
      await shoot('death roll: bites in');
      await ev(() => { const s = __egg.G.sim, B = s.bx.boss, G = s.gators[0]; B.atk = null; G.ph = 'dizzy'; G.dz = 3; G.roll = 0.6; Q.run(0.08); });
      await shoot('rolls: spins a ring');
      await ev(() => { const s = __egg.G.sim, G = s.gators[0]; G.roll = 0; G.ph = 'dizzy'; G.dz = 3; Q.run(0.5); });
      await shoot('DIZZY: hit window');
      await ev(() => { const s = __egg.G.sim, G = s.gators[0]; G.hitCD = 0; s.gatorHurt(G, 'egg'); Q.run(0.2); });
      await shoot('hit: loses a tooth');
      await ev(() => { const s = __egg.G.sim, G = s.gators[0]; Q.run(1); G.ph = 'log'; G.next = 9; G.frz = G.frzMax = 4; Q.run(0.4); });
      await shoot('frozen');
      await ev(() => { const G = __egg.G.sim.gators[0]; G.frz = 0; G.stn = G.stnMax = 3; Q.run(1.2); });
      await shoot('stunned');
      await ev(() => { const s = __egg.G.sim, G = s.gators[0]; G.stn = 0; G.ph = 'beaten'; G.t = 0.5; G.dur = 1.8; Q.run(0.1); });
      await shoot('beaten: swims off');
      await ev(() => { const s = __egg.G.sim, B = s.gators[1]; s.bayouSummon(); Q.run(0.9); B.next = 9; Q.run(0.2); });
      await shoot('calls a baby gator', await ev(() => { const B = __egg.G.sim.gators[1]; return { x: B.x * 0.85, y: B.y * 0.85 }; }), 170);
    }
    rows.push({ name, frames });
  }
  // the boss card, the emblem (bar size and 4x) and the bar in play
  {
    const frames = [];
    const f1 = path.join(out, 'card.png');
    await ev(() => {
      const cv = document.createElement('canvas'); cv.width = 260 * 2; cv.height = 300 * 2; cv.id = 'qa-card';
      Object.assign(cv.style, { position: 'fixed', left: '0', top: '0', width: '260px', height: '300px', zIndex: 99, background: '#1d1712' });
      document.body.appendChild(cv);
      const c = cv.getContext('2d'); c.scale(2, 2);
      __egg.bayouArt.drawGatorCard(c, 10, 10, 240, 190, 1.3, null);
      for (const [x, d] of [[40, 26], [130, 104]]) { c.save(); c.beginPath(); c.arc(x, 250, d / 2, 0, Math.PI * 2); c.fillStyle = '#2f5a3a'; c.fill(); c.lineWidth = Math.max(1, d * 0.06); c.strokeStyle = '#ffe3b0'; c.stroke(); c.clip(); c.translate(x, 250); __egg.bayouArt.drawGatorEmblem(c, d / 2, 1); c.restore(); }
    });
    await p.screenshot({ path: f1, clip: { x: 0, y: 0, width: 260, height: 300 } });
    frames.push({ f: f1, label: 'boss card, emblem at bar size and 4x', w: 260 });
    await ev(() => document.getElementById('qa-card').remove());
    const f2 = path.join(out, 'bar.png');
    await ev(() => { const s = __egg.G.sim, G = s.gators[0]; G.ph = 'dizzy'; G.dz = 3; Q.run(0.1); });
    await p.screenshot({ path: f2, clip: { x: 0, y: 90, width: 390, height: 40 } });
    frames.push({ f: f2, label: 'boss bar (dizzy)', w: 390 });
    rows.push({ name: 'card and bar', frames });
  }
  const html = `<html><body style="margin:0;background:#1d1712;color:#f5e6c8;font:14px sans-serif;padding:8px">${rows.map((r) => `<div style="margin-bottom:10px"><div style="font-weight:bold;margin:2px 0 4px">${r.name}</div><div style="display:flex;flex-wrap:wrap;gap:6px">${r.frames.map((x) => `<div><img style="width:${Math.round(x.w * 1.3)}px;display:block;border-radius:6px" src="data:image/png;base64,${fs.readFileSync(x.f).toString('base64')}"><div style="padding:2px;max-width:${Math.round(x.w * 1.3)}px">${x.label}</div></div>`).join('')}</div></div>`).join('')}</body></html>`;
  const p2 = await b.newPage({ viewport: { width: 1660, height: 400 } });
  await p2.setContent(html);
  await p2.screenshot({ path: path.join(out, 'bayou-strips.png'), fullPage: true });
  await p2.close();
  for (const r of rows) for (const x of r.frames) fs.unlinkSync(x.f);
  for (const e of errors) console.log('PAGE ERROR: ' + e);
  console.log('-> ' + path.join(out, 'bayou-strips.png'));
  await b.close();
  srv.close();
})();
