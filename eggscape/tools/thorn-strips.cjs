// Living thorns QA (v3.3 M3): film strips at real phone scale from the live dev build.
// Rows: sway (idle), approach (an egg comes close: bristle, then the stab when it breaks), burn (fire egg: char and
// crumble), retract (shiver before springing back out), vine (creeps across a gap, warns, seals, burns back, regrows).
// Usage: node tools/thorn-strips.cjs [dist/dev] [outDir=qa/thorns]
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const dir = path.resolve(args[0] || 'dist/dev');
const out = path.resolve(args[1] || 'qa/thorns');
const VW = 390, VH = 844, DPR = 2, CROP = 170;
fs.mkdirSync(out, { recursive: true });

const base = { eggs: 1, target: 1, time: 0, spacing: 1.05, material: 'wood', nest: { w: 2.6 }, seed: 77, tip: '', theme: 'farm' };
const STUDIO = {
  sway: { ...base, rings: [{ gaps: [{ a: 90 }] }, { gaps: [{ a: 90 }], thorns: [{ a: -60, n: 3 }, { a: -120, n: 2 }] }, { gaps: [{ a: 60 }] }] },
  approach: { ...base, rings: [{ gaps: [{ a: 90 }] }, { gaps: [{ a: 90 }], thorns: [{ a: -40, n: 3 }] }, { gaps: [{ a: 60 }] }] },
  burn: { ...base, rings: [{ gaps: [{ a: 90 }] }, { gaps: [{ a: 90 }], thorns: [{ a: -40, n: 3 }] }, { gaps: [{ a: 60 }] }] },
  retract: { ...base, theme: 'volcano', material: 'obsidian', rings: [{ gaps: [{ a: 90 }] }, { gaps: [{ a: 90 }], thorns: [{ a: -60, n: 3 }, { a: -120, n: 3 }], retract: { period: 3, on: 0.5, phase: 0 } }, { gaps: [{ a: 60 }] }] },
  vine: { ...base, theme: 'bramble', material: 'vine', rings: [{ gaps: [{ a: 90 }] }, { gaps: [{ a: -60, vine: 1 }, { a: 120 }] }, { gaps: [{ a: 60 }] }] },
};

const srv = http.createServer((q, r) => {
  const f = path.join(dir, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); });
}).listen(8779);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto('http://localhost:8779/');
  await p.waitForTimeout(900);
  const rows = [];
  for (const [name, L] of Object.entries(STUDIO)) {
    await p.evaluate(([L]) => {
      const E = __egg;
      E.setSave({ mode: 'medium', calm: false, seen: {} });
      E.G.demo = { id: 990, name: 'Studio', ...L };
      E.start(-2, { direct: true });
      E.G.paused = true;
      E.G.toast = null; E.G.toasts.length = 0;
      window.Q = {
        scr(x, y) { const G = E.G, P = G.play; return { x: P.x + P.w / 2 + (x - G.cam.x) * G.cam.k, y: P.y + P.h / 2 - (y - G.cam.y) * G.cam.k }; },
        run(s) { for (let i = 0; i < Math.round(s * 60); i++) E.frame(1 / 60); },
        // world point on ring i at ring-local angle a (deg), radius offset dr
        pt(i, a, dr = 0) { const R = E.G.sim.rings[i], w = R.body.getAngle() + (a * Math.PI) / 180, r = R.r + dr; return { x: r * Math.cos(w), y: r * Math.sin(w) }; },
        setRing(i, deg) { const R = E.G.sim.rings[i], a = (deg * Math.PI) / 180; R.body.setTransform(R.body.getPosition(), a); R.target = a; R.body.setAngularVelocity(0); },
        // rest the egg on the floor of channel 1 (ring 1's inner face) at world angle a
        egg(a) { const e = E.G.sim.eggs[0], R = E.G.sim.rings[1], r = R.r - 0.08 - 0.3, w = (a * Math.PI) / 180; e.body.setTransform({ x: r * Math.cos(w), y: r * Math.sin(w) }, 0); e.body.setLinearVelocity({ x: 0, y: 0 }); e.body.setAngularVelocity(0); e.ch = 1; return e; },
      };
      Q.run(0.5);
    }, [L]);
    const frames = [];
    let at = null;
    const shoot = async (label, world) => {
      if (world) at = await p.evaluate((w) => Q.scr(w.x, w.y), world);
      const cx = Math.round(Math.min(Math.max(at.x, CROP / 2), VW - CROP / 2)), cy = Math.round(Math.min(Math.max(at.y, CROP / 2), VH - CROP / 2));
      const f = path.join(out, `${name}-${frames.length}.png`);
      await p.screenshot({ path: f, clip: { x: cx - CROP / 2, y: cy - CROP / 2, width: CROP, height: CROP } });
      frames.push({ f, label });
    };
    const ev = (fn, ...a) => p.evaluate(fn, ...a);
    if (name === 'sway') {
      await ev(() => { Q.setRing(1, 0); const e = __egg.G.sim.eggs[0]; e.body.setTransform({ x: 0, y: 0.2 }, 0); });
      const w = await ev(() => Q.pt(1, -60, -0.25));
      for (let i = 0; i < 5; i++) { await shoot(`idle ${(i * 0.35).toFixed(2)} s`, i ? null : w); await ev(() => Q.run(0.35)); }
    } else if (name === 'approach' || name === 'burn') {
      // the egg rests at the bottom of channel 1; turning ring 1 brings the thorns to it
      await ev((burn) => { Q.setRing(1, -50); const e = Q.egg(-90); if (burn) { e.fire = 99; e.fireKind = 'fire_red'; } Q.run(0.4); }, name === 'burn');
      const w = await ev(() => { const e = __egg.G.sim.eggs[0].body.getPosition(); return { x: e.x, y: e.y }; });
      const step = async (deg, s) => ev(([d, s]) => { const R = __egg.G.sim.rings[1]; for (let i = 0; i < Math.round(s * 60); i++) { R.target = R.body.getAngle() + (d * Math.PI) / 180 / Math.round(s * 60) * 4; __egg.frame(1 / 60); } }, [deg, s]);
      await shoot('far', w);
      const labels = name === 'burn' ? ['close', 'touch', 'charring', 'crumbling', 'gone'] : ['close: bristles', 'closer: quivers', 'stab', 'after'];
      // turn the thorns into the egg a little at a time
      let hit = false;
      for (const lab of labels) {
        if (!hit) await step(-6, 0.25); else await ev(() => Q.run(0.22));
        const was = hit;
        hit = hit || (await ev(() => !__egg.G.sim.eggs[0].alive || __egg.G.sim.rings[1].thorns.some((t) => !t.alive)));
        // the fire egg rolls on in play; lift it out of frame so the char and crumble are what the strip shows
        if (name === 'burn' && hit && !was) await ev(() => { const e = __egg.G.sim.eggs[0]; e.fire = 0; e.body.setTransform({ x: 0, y: 0.2 }, 0); });
        await shoot(lab);
      }
    } else if (name === 'retract') {
      await ev(() => { Q.setRing(1, 0); const e = __egg.G.sim.eggs[0]; e.body.setTransform({ x: 0, y: 0.2 }, 0); });
      const w = await ev(() => Q.pt(1, -60, -0.25));
      // period 3, out for the first 0.5: in from 1.5 s; they come back at 3 s
      await ev(() => { const s = __egg.G.sim; Q.run(Math.max(0, 1.9 - (s.t % 3))); });
      for (const lab of ['in', 'shiver 0.4 s', 'shiver 0.2 s', 'out!', 'out']) { await shoot(lab, at ? null : w); await ev((d) => Q.run(d), lab === 'in' ? 0.7 : 0.2); }
    } else if (name === 'vine') {
      await ev(() => { Q.setRing(1, 0); const e = __egg.G.sim.eggs[0]; e.body.setTransform({ x: 0, y: 0.2 }, 0); });
      const w = await ev(() => Q.pt(1, -60));
      const C = () => ev(() => { const g = __egg.G.sim.rings[1].gaps[0].curtain; return { u: g.u, alive: g.alive, w: g.w }; });
      const until = async (f) => { for (let i = 0; i < 1200; i++) { const c = await C(); if (f(c)) return; await ev(() => Q.run(1 / 60)); } };
      await until((c) => c.u > 0.2); await shoot('grows', w);
      await until((c) => c.u > 0.55); await shoot('halfway');
      await until((c) => c.u > 0.85); await shoot('about to seal');
      await until((c) => c.alive); await ev(() => Q.run(0.1)); await shoot('sealed');
      // a fire egg touches it
      await ev(() => { const s = __egg.G.sim, e = s.eggs[0], R = s.rings[1], g = R.gaps[0], a = R.body.getAngle() + g.a, r = R.r - 0.08 - 0.32; e.fire = 99; e.fireKind = 'fire_red'; e.body.setTransform({ x: r * Math.cos(a), y: r * Math.sin(a) + 0.05 }, 0); e.body.setLinearVelocity({ x: 0, y: -1 }); Q.run(0.45); });
      await shoot('burning');
      await ev(() => { __egg.G.sim.eggs[0].body.setTransform({ x: 0, y: 0.2 }, 0); Q.run(0.8); });
      await shoot('burnt back');
      await until((c) => c.u > 0.15); await shoot('regrows');
    }
    rows.push({ name, frames });
  }
  // one sheet: a labelled row per scenario
  const W2 = CROP * 1.5;
  const html = `<html><body style="margin:0;background:#1d1712;color:#f5e6c8;font:14px sans-serif;padding:8px">${rows.map((r) => `<div style="margin-bottom:10px"><div style="font-weight:bold;margin:2px 0 4px">${r.name}</div><div style="display:flex;gap:6px">${r.frames.map((x) => `<div><img style="width:${W2}px;display:block;border-radius:6px" src="data:image/png;base64,${fs.readFileSync(x.f).toString('base64')}"><div style="padding:2px">${x.label}</div></div>`).join('')}</div></div>`).join('')}</body></html>`;
  const p2 = await b.newPage({ viewport: { width: Math.round((W2 + 6) * 7 + 20), height: 400 } });
  await p2.setContent(html);
  await p2.screenshot({ path: path.join(out, 'thorns-strips.png'), fullPage: true });
  await p2.close();
  for (const r of rows) for (const x of r.frames) fs.unlinkSync(x.f);
  for (const e of errors) console.log('PAGE ERROR: ' + e);
  console.log('-> ' + path.join(out, 'thorns-strips.png'));
  await b.close();
  srv.close();
})();
