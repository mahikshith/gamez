// Sea creatures QA (v3.3 M8): film strips at real phone scale (390x844, DPR 2) from the live dev build.
// Octopus rows: idle drift, approach, about to grab (colour flush), grab/wrap, carry (through a gap), struck (zap, water,
// glow flash, lets go by itself), let go + ink jet. Fish rows: schooling, turn, pushing an egg, scatter, regroup.
// Plus one full-level view of the reef studio level (octopus, fish, snake, eagle).
// Usage: node tools/sea-strips.cjs [dist/dev] [outDir=qa/sea] [--port=8911]
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const PORT = +((process.argv.find((a) => a.startsWith('--port=')) || '').split('=')[1] || 8911);
const dir = path.resolve(args[0] || 'dist/dev');
const out = path.resolve(args[1] || 'qa/sea');
const VW = 390, VH = 844, DPR = 2, CROP = 150;
fs.mkdirSync(out, { recursive: true });

const base = { eggs: 1, target: 1, time: 0, spacing: 1.05, material: 'coral', nest: { w: 2.6 }, seed: 77, tip: '', theme: 'reef' };
const rings = [{ gaps: [{ a: 90 }] }, { gaps: [{ a: 100 }] }, { gaps: [{ a: 160 }], thorns: [{ a: -140, n: 3 }] }, { gaps: [{ a: 20 }] }];
const OCTO = { ...base, octopus: { ch: 2, a: -100, delay: 0 }, rings };
const FISHL = { ...base, fish: { ch: 2, n: 8, speed: 1.1, a: -150, turn: 0 }, rings };

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
  const ev = (fn, ...a) => p.evaluate(fn, ...a);
  const start = (L, mode = 'medium') => ev(([L, mode]) => {
    const E = __egg;
    E.setSave({ mode, calm: true, seen: {} });
    E.G.demo = { id: 990, name: 'Studio', ...L };
    E.start(-2, { direct: true });
    E.G.paused = true;
    E.G.toast = null; E.G.toasts.length = 0;
    window.Q = {
      get s() { return E.G.sim; },
      scr(x, y) { const G = E.G, P = G.play; return { x: P.x + P.w / 2 + (x - G.cam.x) * G.cam.k, y: P.y + P.h / 2 - (y - G.cam.y) * G.cam.k }; },
      run(s) { for (let i = 0; i < Math.round(s * 60); i++) E.frame(1 / 60); },
      until(f, max = 20) { for (let i = 0; i < max * 60 && !f(); i++) E.frame(1 / 60); return f(); },
      quiet() { E.G.toast = null; E.G.toasts.length = 0; E.G.popups.length = 0; },
      setRing(i, deg) { const R = E.G.sim.rings[i], a = (deg * Math.PI) / 180; R.body.setTransform(R.body.getPosition(), a); R.target = a; R.body.setAngularVelocity(0); },
      // rest egg i on the floor of channel ch at world angle a (deg)
      egg(i, ch, a) { const e = E.G.sim.eggs[i], R = E.G.sim.rings[ch], r = R.r - 0.08 - 0.3, w = (a * Math.PI) / 180; e.body.setTransform({ x: r * Math.cos(w), y: r * Math.sin(w) }, w); e.body.setLinearVelocity({ x: 0, y: 0 }); e.body.setAngularVelocity(0); e.ch = ch; return e; },
      park(i) { const e = E.G.sim.eggs[i]; e.body.setTransform({ x: 0, y: -0.4 }, 0); e.body.setLinearVelocity({ x: 0, y: 0 }); },
      oct() { const C = E.G.sim.octos[0]; return { x: C.rad * Math.cos(C.a), y: C.rad * Math.sin(C.a), ph: C.ph, t: C.t, dur: C.dur }; },
      school() { const S = E.G.sim.schools[0]; let x = 0, y = 0; for (const f of S.f) { x += f.r * Math.cos(f.a); y += f.r * Math.sin(f.a); } return { x: x / S.f.length, y: y / S.f.length, ph: S.ph }; },
      k() { return E.G.cam.k; },
    };
    Q.run(0.3);
  }, [L, mode]);

  const sheets = { octopus: [], fish: [] };
  let row = null;
  const newRow = (sheet, name) => { row = { name, frames: [] }; sheets[sheet].push(row); };
  const shoot = async (label, world, C = CROP) => {
    const at = await ev((w) => Q.scr(w.x, w.y), world);
    const cx = Math.round(Math.min(Math.max(at.x, C / 2), VW - C / 2)), cy = Math.round(Math.min(Math.max(at.y, C / 2), VH - C / 2));
    const f = path.join(out, `f-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
    await p.screenshot({ path: f, clip: { x: cx - C / 2, y: cy - C / 2, width: C, height: C } });
    row.frames.push({ f, label });
  };
  const octAt = () => ev(() => Q.oct());

  // ---------------- octopus
  // A: idle drift (no egg in its channel)
  await start(OCTO);
  await ev(() => { Q.park(0); Q.run(0.8); });
  newRow('octopus', 'idle drift (no egg in reach): slow wander, arms curl and pulse');
  for (let i = 0; i < 5; i++) { await shoot(`${(i * 0.4).toFixed(1)} s`, await octAt()); await ev(() => Q.run(0.4)); }
  // B: approach
  await start(OCTO);
  await ev(() => { Q.egg(0, 2, -55); Q.run(0.1); });
  newRow('octopus', 'approach: swims to the egg in its channel, eyes on it');
  for (let i = 0; i < 4; i++) { await shoot(`${(i * 0.35).toFixed(2)} s`, await octAt()); await ev(() => Q.run(0.35)); if ((await octAt()).ph === 'warn') break; }
  // C: warn flush
  await ev(() => Q.until(() => Q.s.octos[0].ph === 'warn'));
  newRow('octopus', 'about to grab: red flush pulses faster, mean brows, arms lift');
  for (const u of [0.1, 0.35, 0.6, 0.85]) { await ev((u) => Q.until(() => { const C = Q.s.octos[0]; return C.ph !== 'warn' || 1 - C.t / C.dur >= u; }), u); await shoot(`warn ${Math.round(u * 100)}%`, await octAt()); }
  // D: grab
  newRow('octopus', 'grab and wrap: three arms close over the egg');
  for (const u of [0.25, 0.7]) { await ev((u) => Q.until(() => { const C = Q.s.octos[0]; return C.ph === 'carry' || (C.ph === 'grab' && 1 - C.t / C.dur >= u); }), u); await shoot(`grab ${Math.round(u * 100)}%`, await octAt()); }
  await ev(() => Q.until(() => Q.s.octos[0].ph === 'carry')); await ev(() => Q.run(0.15)); await shoot('held', await octAt());
  await ev(() => Q.run(1)); await shoot('held 1 s', await octAt());
  // E: carry through a gap (ring 1's gap turned to just ahead of it)
  await ev(() => { const C = Q.s.octos[0], g = Q.s.rings[1].gaps[0]; Q.setRing(1, ((C.a - 0.35 - g.a) * 180) / Math.PI); });
  newRow('octopus', 'carry: creeps toward the inner rings through a gap, egg in its arms');
  for (let i = 0; i < 5; i++) { await ev(() => Q.run(0.9)); await shoot(`carry +${((i + 1) * 0.9).toFixed(1)} s`, await octAt()); }
  // F: struck, one each
  newRow('octopus', 'struck: zap, water, glow flash, and letting go by itself (Easy 6 s / Medium 10 s)');
  for (const kind of ['zap', 'water', 'flash', 'tired']) {
    await start(OCTO);
    await ev(() => { Q.egg(0, 2, -80); Q.until(() => Q.s.octos[0].ph === 'carry'); Q.run(0.4); Q.quiet(); });
    await ev((kind) => { const C = Q.s.octos[0]; if (kind === 'tired') Q.s.octLetGo(C, 'tired'); else Q.s.octHit(C, kind); Q.run(0.22); }, kind);
    await shoot(kind, await octAt());
  }
  // G: let go + ink jet (zap)
  await start(OCTO);
  await ev(() => { Q.egg(0, 2, -80); Q.until(() => Q.s.octos[0].ph === 'carry'); Q.run(0.4); Q.quiet(); });
  const rel = await octAt();
  await ev(() => { Q.s.octHit(Q.s.octos[0], 'zap'); });
  newRow('octopus', 'let go and ink jet escape (zapped): drops the egg, shoots off, ink cloud fades');
  for (const [d, lab] of [[0.1, 'let go'], [0.45, 'jet starts'], [0.25, 'jet'], [0.4, 'jet ends'], [1.2, 'rest, ink fading']]) { await ev((d) => Q.run(d), d); await shoot(lab, rel); }

  // close-ups (same phone render, a 60 px crop blown up): the face and arms in each state
  newRow('octopus', 'close-ups (60 css px crops, 2.5x the row above): idle, warn, held, zapped, jet');
  await start(OCTO);
  await ev(() => { Q.park(0); Q.run(0.8); Q.quiet(); }); await shoot('idle', await octAt(), 60);
  await ev(() => { Q.egg(0, 2, -80); Q.until(() => { const C = Q.s.octos[0]; return C.ph === 'warn' && C.t < C.dur * 0.4; }); Q.quiet(); }); await shoot('warn', await octAt(), 60);
  await ev(() => { Q.until(() => Q.s.octos[0].ph === 'carry'); Q.run(0.8); Q.quiet(); }); await shoot('held', await octAt(), 60);
  await ev(() => { Q.s.octHit(Q.s.octos[0], 'zap'); Q.run(0.25); Q.quiet(); }); await shoot('zapped', await octAt(), 60);
  await ev(() => { Q.run(0.5); Q.quiet(); }); await shoot('jet', await octAt(), 60);

  // ---------------- fish
  await start(FISHL);
  await ev(() => { Q.park(0); Q.run(0.5); });
  newRow('fish', 'schooling swim: a loose flock round the channel, the current streaks with them');
  for (let i = 0; i < 5; i++) { await shoot(`${(i * 0.3).toFixed(1)} s`, await ev(() => Q.school())); await ev(() => Q.run(0.3)); }
  newRow('fish', 'turn: the school reverses, each fish flips round in a ripple');
  await ev(() => { Q.s.schools[0].turnT = 0.001; Q.s.schools[0].every = 30; Q.run(0.05); });
  const tc = await ev(() => Q.school());
  for (let i = 0; i < 5; i++) { await shoot(`${(0.05 + i * 0.15).toFixed(2)} s`, tc); await ev(() => Q.run(0.15)); }
  newRow('fish', 'pushing an egg: the egg rides the current with them');
  await start(FISHL);
  await ev(() => { Q.egg(0, 2, -110); const S = Q.s.schools[0]; S.a = (-135 * Math.PI) / 180; for (const f of S.f) f.a = S.a + f.ox / 2.6; Q.run(0.2); });
  await ev(() => Q.run(0.6));
  for (let i = 0; i < 5; i++) { const e = await ev(() => { const p = Q.s.eggs[0].body.getPosition(); return { x: p.x, y: p.y }; }); await shoot(`${(0.8 + i * 0.5).toFixed(1)} s`, e); await ev(() => Q.run(0.5)); }
  newRow('fish', 'scatter (an egg dropped on them): dart off, no push for ~3 s');
  await start(FISHL);
  await ev(() => { Q.park(0); Q.run(0.3); const c = Q.school(); Q.s.fishScatter(Q.s.schools[0], c.x + 0.1, c.y + 0.3, 'egg'); });
  const sc = await ev(() => Q.school());
  for (const [d, lab] of [[0.05, 'scatter'], [0.25, '0.3 s'], [0.5, '0.8 s'], [1, '1.8 s'], [1, '2.8 s']]) { await ev((d) => Q.run(d), d); await shoot(lab, sc); }
  newRow('fish', 'regroup: they gather and swim on');
  const regroupRow = row;
  await ev(() => Q.until(() => Q.s.schools[0].ph === 'regroup'));
  for (const d of [0.05, 0.4, 0.4, 0.5, 0.5]) { await ev((d) => Q.run(d), d); const S = await ev(() => Q.school()); await shoot(S.ph, S); }

  newRow('fish', 'close-ups (60 css px crops): swim, turn, scatter');
  await start(FISHL);
  await ev(() => { Q.park(0); Q.run(0.6); });
  await shoot('swim', await ev(() => Q.school()), 60);
  await ev(() => { Q.s.schools[0].turnT = 0.001; Q.run(0.25); }); await shoot('turn', await ev(() => Q.school()), 60);
  await ev(() => { Q.run(1); const c = Q.school(); Q.s.fishScatter(Q.s.schools[0], c.x + 0.1, c.y + 0.3, 'egg'); Q.run(0.3); Q.quiet(); }); await shoot('scatter', await ev(() => Q.school()), 60);

  // ---------------- full level: the reef studio level with everyone in
  const full = path.join(out, 'sea-level.png');
  await ev(() => { const E = __egg; E.setSave({ mode: 'medium', calm: true, seen: {} }); E.startDemo('reef', { direct: true }); E.G.paused = true; });
  await ev(() => { Q.run(6.5); const e = Q.s.eggs[0]; const R = Q.s.rings[2], r = R.r - 0.38, w = (200 * Math.PI) / 180; e.body.setTransform({ x: r * Math.cos(w), y: r * Math.sin(w) }, 0); Q.run(3); });
  await p.screenshot({ path: full });
  const k = await ev(() => Q.k());

  // ---------------- sheets
  const W2 = CROP * 1.6;
  for (const [name, rows] of Object.entries(sheets)) {
    const html = `<html><body style="margin:0;background:#10202c;color:#e6f4ff;font:14px sans-serif;padding:8px"><div style="margin:0 0 8px">${name}: real phone scale (390x844 @2x, ${k.toFixed(1)} px per m; crops ${CROP} css px shown at 1.6x)</div>${rows.map((r) => `<div style="margin-bottom:10px"><div style="font-weight:bold;margin:2px 0 4px">${r.name}</div><div style="display:flex;gap:6px">${r.frames.map((x) => `<div><img style="width:${W2}px;display:block;border-radius:6px" src="data:image/png;base64,${fs.readFileSync(x.f).toString('base64')}"><div style="padding:2px">${x.label}</div></div>`).join('')}</div></div>`).join('')}</body></html>`;
    const p2 = await b.newPage({ viewport: { width: Math.round((W2 + 6) * 5 + 24), height: 400 } });
    await p2.setContent(html);
    await p2.screenshot({ path: path.join(out, `sea-${name}.png`), fullPage: true });
    await p2.close();
    for (const r of rows) for (const x of r.frames) fs.unlinkSync(x.f);
    console.log('-> ' + path.join(out, `sea-${name}.png`));
  }
  console.log('-> ' + full);
  for (const e of errors) console.log('PAGE ERROR: ' + e);
  await b.close();
  srv.close();
})();
