// Shape Lab QA (v4): film strips at real phone scale (390x844, DPR 2) from the live dev build, one labelled row per
// creature state: the Clockwork Owl (every pose and state), its gear bombs, the clockwork spider and its web, the wind-up
// beetle, the spring jack. States are set straight on the sim, then the game renders a frame.
// Usage: node tools/lab-strips.cjs [dist/dev] [outDir=qa/lab]   (QA_PORT, default 9071)
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const dir = path.resolve(args[0] || 'dist/dev');
const out = path.resolve(args[1] || 'qa/lab');
const PORT = +(process.env.QA_PORT || 9071);
const VW = 390, VH = 844, DPR = 2;
fs.mkdirSync(out, { recursive: true });

const srv = http.createServer((q, r) => {
  const f = path.join(dir, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); });
}).listen(PORT);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(`http://localhost:${PORT}/`);
  await p.waitForTimeout(900);
  const ev = (fn, a) => p.evaluate(fn, a);
  const start = (kind) => ev((kind) => {
    const E = __egg;
    E.setSave({ mode: 'medium', calm: false, seen: {} });
    E.startDemo(kind, { direct: true });
    E.G.paused = true;
    window.Q = {
      E, get s() { return E.G.sim; },
      scr(x, y) { const G = E.G, P = G.play; return { x: P.x + P.w / 2 + (x - G.cam.x) * G.cam.k, y: P.y + P.h / 2 - (y - G.cam.y) * G.cam.k }; },
      run(s) { for (let i = 0; i < Math.round(s * 60); i++) E.frame(1 / 60); },
      still(n = 2) { for (let i = 0; i < n; i++) E.frame(0.001); },
      setRing(i, deg) { const R = E.G.sim.rings[i], a = (deg * Math.PI) / 180; R.body.setTransform(R.body.getPosition(), a); R.target = a; R.body.setAngularVelocity(0); R.omega = 0; },
      park(e, x, y) { e.body.setTransform({ x, y }, 0); e.body.setLinearVelocity({ x: 0, y: 0 }); e.body.setAngularVelocity(0); e.ch = E.G.sim.channelOf(e); },
      away() { for (const e of E.G.sim.eggs) if (e.body) Q.park(e, 0.25 * e.id - 0.3, 0.2); },
      hush() { E.G.toast = null; E.G.toasts.length = 0; E.G.popups.length = 0; },
    };
    Q.run(0.3);
    Q.hush();
  }, kind);
  const rows = [];
  const row = (name, crop) => { const r = { name, crop, frames: [] }; rows.push(r); return r; };
  const shoot = async (r, label, w) => {
    await ev(() => Q.hush());
    const at = await ev((w) => Q.scr(w.x, w.y), w), C = r.crop;
    const cx = Math.round(Math.min(Math.max(at.x, C / 2), VW - C / 2)), cy = Math.round(Math.min(Math.max(at.y, C / 2), VH - C / 2));
    const f = path.join(out, `${r.name.replace(/\W+/g, '_')}-${r.frames.length}.png`);
    await p.screenshot({ path: f, clip: { x: cx - C / 2, y: cy - C / 2, width: C, height: C } });
    r.frames.push({ f, label });
  };

  // ---------------- the Clockwork Owl
  await start('owl');
  const owlAt = () => ev(() => { const B = Q.s.bx.boss; return { x: B.x, y: B.y - 0.3 }; });
  const ow = row('Clockwork Owl: poses', 150);
  const atk = (o) => ev((o) => { const s = Q.s, B = s.bx.boss; B.t = 99; s.owl.sw = null; s.owl.jam = 0; B.dizzy = 0; B.flinch = 0; B.atk = o ? { ...o, t: o.dur * (1 - o.u), dur: o.dur } : null; }, o);
  await ev(() => { const s = Q.s; s.bx.boss.t = 99; Q.away(); Q.run(1.2); });
  await shoot(ow, 'idle', await owlAt());
  await ev(() => Q.run(0.3)); await shoot(ow, 'idle, wingbeat', await owlAt());
  // an egg in the outer channel under the outer gap
  await ev(() => { const s = Q.s, n = s.rings.length, o = s.rings[n - 1]; Q.setRing(n - 1, -90 - (o.spec.gaps[0].a)); const r = s.rings[n - 2].r + 0.5; Q.park(s.eggs[0], 0.35, -r); });
  const egg0 = await ev(() => { const p = Q.s.eggs[0].body.getPosition(); return { x: p.x, y: p.y, id: Q.s.eggs[0].id }; });
  await atk({ name: 'swoop', ph: 'warn', dur: 1.25, u: 0.7, eid: egg0.id, tx: egg0.x, ty: egg0.y, aim: egg0.x });
  await ev(() => { Q.s.bx.boss.x = 0.5; Q.still(); });
  await shoot(ow, 'swoop: marks an egg', await owlAt());
  await ev((e) => { const s = Q.s; s.bx.boss.atk = null; s.owl.sw = { x: e.x, y: e.y, t: 0.75 * 0.62, res: 'grab' }; Q.still(); }, egg0);
  await shoot(ow, 'swoop: the dive', { x: egg0.x * 0.5, y: egg0.y + 1.6 });
  await ev(() => { const s = Q.s; s.owl.sw = null; s.bx.boss.dizzy = 2; Q.run(0.4); });
  await shoot(ow, 'hit the brass: reels', await owlAt());
  await atk({ name: 'wind', ph: 'warn', dur: 1.2, u: 0.6, rings: [1, 2], dirs: [1, -1] }); await ev(() => Q.run(0.05));
  await shoot(ow, 'wind-up: key spins', await owlAt());
  await atk({ name: 'gears', ph: 'warn', dur: 0.9, u: 0.85, spots: [], aim: 0 }); await ev(() => Q.run(0.05));
  await shoot(ow, 'gear drop: hatch open', await owlAt());
  await atk(null); await ev(() => { const B = Q.s.bx.boss; B.flinch = 0.5; Q.run(0.06); });
  await shoot(ow, 'hit (egg saved)', await owlAt());
  const ow2 = row('Clockwork Owl: states', 150);
  await ev(() => { const s = Q.s; s.owl.jam = 3.4; s.bx.boss.dizzy = 3.4; Q.run(0.4); });
  await shoot(ow2, 'JAMMED by an iron egg', await owlAt());
  await ev(() => Q.run(0.5)); await shoot(ow2, 'jammed: sparks, smoke', await owlAt());
  await ev(() => { const s = Q.s; s.owl.jam = 0; s.bx.boss.dizzy = 0; Q.run(1.2); s.p2Mark('b', 'ice', 4, s.bx.boss.x, s.bx.boss.y); s.bx.boss.dizzy = 4; Q.run(0.5); });
  await shoot(ow2, 'frozen (frost nova)', await owlAt());
  await ev(() => { const s = Q.s; s.bx.boss.dizzy = 0.6; Q.run(0.75); delete s.p2.fx.b; });
  await shoot(ow2, 'thaw', await owlAt());
  await ev(() => { const s = Q.s; Q.run(1); s.p2Mark('b', 'zap', 1.2, s.bx.boss.x, s.bx.boss.y); s.bx.boss.dizzy = 3; Q.run(0.12); });
  await shoot(ow2, 'thunderclap: zap', await owlAt());
  await ev(() => Q.run(0.6)); await shoot(ow2, 'stalled (stunned)', await owlAt());
  await ev(() => { const s = Q.s; s.bx.boss.dizzy = 0; s.owl.down = 1; s.owl.hp = 0; Q.run(0.8); });
  await shoot(ow2, 'broken down', await ev(() => ({ x: Q.s.bx.boss.x, y: Q.s.outerR + 0.6 })));
  // gear bombs
  await start('owl');
  const gb = row('Gear bombs', 120);
  await ev(() => { const s = Q.s; s.bx.boss.t = 99; Q.away(); Q.setRing(1, 0); s.owl.gb.push({ id: 1, ri: 1, la: -1.2, ph: 'fly', t: 0.3, x0: s.bx.boss.x, y0: s.bx.boss.y, dud: 0 }); Q.still(); });
  const gAt = () => ev(() => { const s = Q.s, G = s.owl.gb[0]; return G ? s.gearAt(G) : s.owlFloor(1, -1.2, 0.16); });
  await shoot(gb, 'dropped', await gAt());
  await ev(() => Q.run(0.32)); await shoot(gb, 'landed, ticking', await gAt());
  await ev(() => Q.run(1.0)); await shoot(gb, 'blinks faster', await gAt());
  const gpos = await gAt();
  await ev(() => Q.run(0.6)); await shoot(gb, 'BURST', gpos);
  await ev(() => Q.run(0.3)); await shoot(gb, 'floor blown open', gpos);
  await ev(() => { const s = Q.s; s.owl.gb.push({ id: 2, ri: 1, la: -2.0, ph: 'tick', t: 0.2, x0: 0, y0: 0, dud: 1 }); Q.run(0.1); });
  await shoot(gb, 'dud (iron egg)', await ev(() => Q.s.owlFloor(1, -2.0, 0.16)));

  // ---------------- the spider
  await start('spider');
  const sp = row('Clockwork spider + web', 120);
  await ev(() => { const s = Q.s, g = s.rings[1].spec.gaps[0].a; Q.setRing(1, -90 - g); Q.away(); const S = s.cw.sp[0]; S.ph = 'wait'; S.t = 99; S.gi = 0; Q.run(0.2); });
  const spAt = () => ev(() => { const q = Q.s.cwSpider(Q.s.cw.sp[0]); return { x: (q.x + q.gx) / 2, y: (q.y + q.gy) / 2 }; });
  await ev(() => { const S = Q.s.cw.sp[0]; S.ph = 'down'; S.dur = 1.6; S.t = 1.2; Q.still(); });
  const spw = await spAt();
  await shoot(sp, 'winds down (telegraph)', spw);
  await ev(() => { const S = Q.s.cw.sp[0]; S.t = 0.3; Q.still(); }); await shoot(sp, 'nearly there', spw);
  await ev(() => { const s = Q.s, S = s.cw.sp[0]; S.ph = 'spin'; S.dur = 0.9; S.t = 0.45; s.cw.webs[0].k = 0.5; Q.run(0.05); }); await shoot(sp, 'spinning the web', spw);
  await ev(() => { const s = Q.s, S = s.cw.sp[0]; Q.run(0.5); S.t = 0.4; }); await ev(() => Q.still()); await shoot(sp, 'web done, climbs back', spw);
  // an egg drops onto it
  await ev(() => { const s = Q.s, W = s.cwFloor(1, s.rings[1].gaps[0].a, 0.9); Q.park(s.eggs[0], W.x, W.y); Q.run(0.9); });
  await shoot(sp, 'egg caught (no crack)', spw);
  await ev(() => { const s = Q.s; s.eggs[0].iron = 1; Q.run(0.12); }); await shoot(sp, 'iron egg tears it', spw);
  await ev(() => { const s = Q.s, S = s.cw.sp[0]; s.eggs[0].iron = 0; Q.away(); S.ph = 'down'; S.dur = 1.6; S.t = 0.8; S.ice = 4; s.p2Mark('cs0', 'ice', 4); Q.run(0.4); }); await shoot(sp, 'frozen', spw);
  await ev(() => { const s = Q.s, S = s.cw.sp[0]; S.ice = 0; Q.run(1.2); S.ph = 'down'; S.t = 0.8; S.stun = 3; Q.run(0.5); }); await shoot(sp, 'stunned', spw);

  // ---------------- the beetle
  await start('beetle');
  const bt = row('Wind-up beetle', 120);
  const bAt = () => ev(() => { const q = Q.s.cwBeetlePose(Q.s.cw.bt[0]); return { x: q.x, y: q.y + 0.15 }; });
  await ev(() => { const s = Q.s; Q.setRing(1, 0); Q.away(); const B = s.cw.bt[0]; B.la = -1.95; B.dir = 1; B.ph = 'walk'; B.wind = 5; Q.run(0.4); });
  await shoot(bt, 'walking', await bAt());
  await ev(() => { const s = Q.s, B = s.cw.bt[0], q = s.cwFloor(1, B.la + 0.5 / s.rings[1].r, 0.3); Q.park(s.eggs[0], q.x, q.y); Q.run(0.8); });
  await shoot(bt, 'bulldozes an egg', await bAt());
  await ev(() => Q.run(0.7)); await shoot(bt, 'still pushing', await bAt());
  await ev(() => { const B = Q.s.cw.bt[0]; B.wind = 0.02; Q.run(0.5); }); await shoot(bt, 'key runs down: a wall', await bAt());
  await ev(() => { const B = Q.s.cw.bt[0]; B.ph = 'click'; B.t = 0.6; Q.run(0.1); }); await shoot(bt, 'ring turned: rewinds', await bAt());
  await ev(() => { const s = Q.s, B = s.cw.bt[0]; Q.away(); B.ph = 'tip'; B.t = 3; Q.run(0.3); }); await shoot(bt, 'spin storm: tipped', await bAt());
  await ev(() => { const s = Q.s, B = s.cw.bt[0]; B.ph = 'walk'; B.wind = 4; B.ice = 4; s.p2Mark('cb0', 'ice', 4); Q.run(0.4); }); await shoot(bt, 'frozen', await bAt());
  await ev(() => { const s = Q.s, B = s.cw.bt[0]; B.ice = 0; Q.run(1.2); B.stun = 3; Q.run(0.5); }); await shoot(bt, 'stunned', await bAt());

  // ---------------- the jack
  await start('jack');
  const jk = row('Spring jack', 120);
  const jAt = () => ev(() => { const J = Q.s.cw.jk[0], q = Q.s.cwFloor(J.fi, J.la, 0.35); return { x: q.x, y: q.y }; });
  await ev(() => { const s = Q.s; Q.setRing(1, 30); Q.away(); Q.run(0.2); });
  await shoot(jk, 'ready', await jAt());
  const jw = await jAt();
  await ev(() => { const s = Q.s, J = s.cw.jk[0], q = s.cwFloor(J.fi, J.la + 0.65 / s.rings[1].r, 0.3); Q.park(s.eggs[0], q.x, q.y); Q.still(); });
  await shoot(jk, 'egg near: lid rattles', jw);
  await ev(() => { const s = Q.s, J = s.cw.jk[0]; J.ph = 'out'; J.t = 0.4; const q = s.cwFloor(J.fi, J.la, 0.75); Q.park(s.eggs[0], q.x, q.y); Q.still(); });
  await shoot(jk, 'BOING: egg bounced up', jw);
  await ev(() => { const s = Q.s, J = s.cw.jk[0]; Q.away(); J.ph = 'reload'; J.t = 1.1; Q.still(); }); await shoot(jk, 'winding back', jw);
  await ev(() => { const s = Q.s, J = s.cw.jk[0]; J.ph = 'jam'; J.t = 9; Q.still(); }); await shoot(jk, 'jammed (iron egg)', jw);
  await ev(() => { const s = Q.s, J = s.cw.jk[0]; J.ph = 'ready'; J.ice = 4; s.p2Mark('cj0', 'ice', 4); Q.run(0.4); }); await shoot(jk, 'frozen', jw);

  // one sheet
  const html = `<html><body style="margin:0;background:#1d1712;color:#f5e6c8;font:14px sans-serif;padding:8px">${rows.map((r) => `<div style="margin-bottom:10px"><div style="font-weight:bold;margin:2px 0 4px">${r.name}</div><div style="display:flex;gap:6px;flex-wrap:wrap">${r.frames.map((x) => `<div><img style="width:${Math.round(r.crop * 1.7)}px;display:block;border-radius:6px" src="data:image/png;base64,${fs.readFileSync(x.f).toString('base64')}"><div style="padding:2px;width:${Math.round(r.crop * 1.7)}px">${x.label}</div></div>`).join('')}</div></div>`).join('')}</body></html>`;
  const p2 = await b.newPage({ viewport: { width: 1700, height: 400 } });
  await p2.setContent(html);
  await p2.screenshot({ path: path.join(out, 'lab-strips.png'), fullPage: true });
  await p2.close();
  for (const r of rows) for (const x of r.frames) fs.unlinkSync(x.f);
  for (const e of errors) console.log('PAGE ERROR: ' + e);
  console.log('-> ' + path.join(out, 'lab-strips.png'));
  await b.close();
  srv.close();
})();
