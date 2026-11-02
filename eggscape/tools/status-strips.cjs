// Creature-state QA (v3.5): film strips at real phone scale (390x844 css, DPR 2) from the live dev build. One row per creature:
// normal, frozen (forming, held, cracking), thaw (shards, shake), zap (arcs), stunned. The states come from the real sim hooks
// (sim.p2All('ice' | 'bolt'), the rooster's crow), so they show exactly what a power or an ally does in a level.
// Usage: node tools/status-strips.cjs [dist/dev] [outDir=qa/status] [only=eagle,sal,fish,blizzard,snow]
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const dir = path.resolve(args[0] || 'dist/dev');
const out = path.resolve(args[1] || 'qa/status');
const only = args[2] ? args[2].split(',') : null;
const PORT = +process.env.QA_PORT || 8981;
const VW = 390, VH = 844, DPR = 2;
fs.mkdirSync(out, { recursive: true });

const base = { eggs: 1, target: 1, time: 0, spacing: 1.05, material: 'wood', nest: { w: 2.6 }, seed: 77, tip: '', theme: 'farm', rings: [{ gaps: [{ a: 90 }] }, { gaps: [{ a: 90 }] }, { gaps: [{ a: 60 }] }, { gaps: [{ a: 120 }] }] };
const L = {
  eagle: { ...base, theme: 'storm', eagle: { delay: 0.2, every: 99 } },
  snow: { ...base, theme: 'blizzard', eagle: { delay: 0.2, every: 99 } },
  sal: { ...base, theme: 'volcano', material: 'obsidian', salamander: { delay: 0.2, every: 99, a: 150, ch: 2 } },
  fish: { ...base, theme: 'reef', fish: [{ ch: 2, n: 8, a: 120, speed: 0.5, turn: 0 }] },
  blizzard: { ...base, theme: 'blizzard', material: 'stone', boss: 'blizzard', bossFight: { kind: 'blizzard', delay: 99, gale: 5, phases: [{ attacks: ['gale'], every: 50 }] } },
};
const CROP = { eagle: 240, snow: 240, sal: 200, fish: 150, blizzard: 260 };

const srv = http.createServer((q, r) => {
  const f = path.join(dir, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); });
}).listen(PORT);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  await p.goto(`http://localhost:${PORT}/`);
  await p.waitForTimeout(900);
  const rows = [];
  for (const name of Object.keys(L)) {
    if (only && !only.includes(name)) continue;
    await p.evaluate(([spec]) => {
      const E = __egg;
      E.setSave({ mode: 'medium', calm: false, seen: {} });
      E.G.demo = { id: 990, name: 'Studio', ...spec };
      E.start(-2, { direct: true });
      E.G.paused = true;
      E.G.toast = null; E.G.toasts.length = 0;
      window.Q = {
        scr(x, y) { const G = E.G, P = G.play; return { x: P.x + P.w / 2 + (x - G.cam.x) * G.cam.k, y: P.y + P.h / 2 - (y - G.cam.y) * G.cam.k }; },
        run(s) { for (let i = 0; i < Math.round(s * 60); i++) E.frame(1 / 60); },
        sim() { return E.G.sim; },
        // put the time left on whatever is frozen / stunned (and its marker), so a strip can show the last second
        left(t) {
          const s = E.G.sim, e = s.eagle, c = (s.sals || [])[0], f = (s.schools || [])[0], b = s.bx && s.bx.boss;
          if (e && e.phase === 'dazed') e.t = t;
          if (c && c.ph === 'daze') c.t = t;
          if (f) { if (f.fz > 0) f.fz = t; if (f.sn > 0) f.sn = t; }
          if (b && b.dizzy > 0) b.dizzy = t;
          for (const k in s.p2.fx) s.p2.fx[k].t = t;
        },
        lift() { const s = E.G.sim, e = s.eagle; if (e) { e.x = -0.6; e.y = s.outerR + 0.2; e.vx = e.vy = 0; } },
      };
      Q.run(0.5);
    }, [L[name]]);
    const at = async () => p.evaluate((n) => {
      const s = Q.sim(), E = s.eagle, C = (s.sals || [])[0], S = (s.schools || [])[0], B = s.bx && s.bx.boss;
      if (n === 'eagle' || n === 'snow') return E ? { x: E.x, y: E.y, ph: E.phase } : null;
      if (n === 'sal') return C && C.pts.length ? { x: C.pts[3].x, y: C.pts[3].y, ph: C.ph } : null;
      if (n === 'fish') return S ? s.fishXY(S) : null;
      if (n === 'blizzard') { const g = window.__egg.G; return B ? { x: B.x, y: s.outerR + 1.6, ph: 'boss' } : null; }
    }, name);
    // let the creature arrive
    for (let i = 0; i < 400; i++) {
      const ok = await p.evaluate((n) => { const s = Q.sim(); return n === 'eagle' || n === 'snow' ? s.eagle && (s.eagle.phase === 'circle' || s.eagle.phase === 'perch') : n === 'sal' ? (s.sals || [])[0] && (s.sals[0].ph === 'walk' || s.sals[0].ph === 'rest') : true; }, name);
      if (ok) break;
      await p.evaluate(() => Q.run(0.1));
    }
    const frames = [];
    const shoot = async (label) => {
      const w = await at();
      if (!w) return;
      const s = await p.evaluate(([x, y]) => Q.scr(x, y), [w.x, w.y]);
      const C = CROP[name], cx = Math.round(Math.min(Math.max(s.x, C / 2), VW - C / 2)), cy = Math.round(Math.min(Math.max(s.y, C / 2), VH - C / 2));
      const f = path.join(out, `${name}-${frames.length}.png`);
      await p.screenshot({ path: f, clip: { x: cx - C / 2, y: cy - C / 2, width: C, height: C } });
      frames.push({ f, label });
    };
    const ev = (fn, ...a) => p.evaluate(fn, ...a);
    await shoot('normal');
    if (name === 'eagle' || name === 'snow') await ev(() => Q.lift());
    await ev(() => { Q.run(0.1); Q.sim().p2All('ice', 12); Q.run(0.05); });
    await shoot('frozen 0.05 s');
    await ev(() => Q.run(0.4)); await shoot('frozen 0.45 s');
    await ev(() => Q.run(1.6)); await shoot('frozen 2.0 s');
    await ev(() => { Q.left(0.75); Q.run(0.3); }); await shoot('cracking (0.45 s left)');
    await ev(() => Q.run(0.45)); await shoot('thaw');
    await ev(() => Q.run(0.2)); await shoot('thaw +0.2');
    await ev(() => Q.run(0.3)); await shoot('thaw +0.5');
    await ev(() => Q.run(1.5));
    await ev(() => { Q.sim().p2All('bolt', 3); Q.run(0.08); });
    await shoot('zap');
    await ev(() => Q.run(0.5)); await shoot('stunned 0.6 s');
    await ev(() => Q.run(0.6)); await shoot('stunned 1.2 s');
    rows.push({ name, frames, bg: name === 'snow' ? '#fff' : '#111' });
  }
  const W2 = 150;
  const html = `<html><body style="margin:0;background:#1d1712;color:#f5e6c8;font:13px sans-serif;padding:8px">${rows.map((r) => `<div style="margin-bottom:10px"><div style="font-weight:bold;margin:2px 0 4px">${r.name}</div><div style="display:flex;gap:6px">${r.frames.map((x) => `<div><img style="width:${W2}px;display:block;border-radius:6px" src="data:image/png;base64,${fs.readFileSync(x.f).toString('base64')}"><div style="padding:2px">${x.label}</div></div>`).join('')}</div></div>`).join('')}</body></html>`;
  const p2 = await b.newPage({ viewport: { width: (W2 + 6) * 11 + 20, height: 400 } });
  await p2.setContent(html);
  await p2.screenshot({ path: path.join(out, 'status-strips.png'), fullPage: true });
  await p2.close();
  for (const r of rows) for (const x of r.frames) fs.unlinkSync(x.f);
  for (const e of errors) console.log('PAGE ERROR: ' + e);
  console.log('wrote', path.join(out, 'status-strips.png'));
  await b.close();
  srv.close();
})();
