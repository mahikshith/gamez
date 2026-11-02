// Vault shapes QA (v3.3 M10): for each studio shape (square, hex, rocking vault, spiral) one sheet with the whole level
// at phone size and a 6-frame strip of the egg rolling through it. The run is the planner's own solution (replayed
// move by move through the sim), so the sheet also shows the planner clears the level.
// Usage: node tools/shape-strips.cjs [dist/dev] [outDir=qa/shapes] [--only square,hex] [--port 8931]
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const args = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
const dir = path.resolve(args[0] || 'dist/dev');
const out = path.resolve(args[1] || 'qa/shapes');
const PORT = +flag('--port', 8931);
const VW = 390, VH = 844, DPR = 2, CROP = 190;
fs.mkdirSync(out, { recursive: true });

const srv = http.createServer((q, r) => {
  const f = path.join(dir, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); });
}).listen(PORT);

const BLURB = {
  square: 'Square vault. Flat sides are ledges (an egg parks anywhere on one); turning a side past ~20 deg tips it down the slope into the corner pocket.',
  hex: 'Hex vault. Six short ledges, slopes between them every 60 deg: less turning per drop, eggs run further on each slope.',
  rock: 'Rocking vault (hazard). Every 4.4 s the whole vault leans 25 deg one way, then back (orange arrows warn 1.2 s ahead, the level vial shows the lean). Strip: no player input; the egg parked on a ledge is carried to a corner, then poured through the corner gap.',
  spiral: 'Spiral ring. One ring is a one-turn ramp: no gap, its seam is the way down. Turning it lifts or lowers the floor under the egg.',
};

// The planner's run: pick 6 moments spread over the part where the egg moves, shoot each centred on the egg.
async function planStrip(p, res, name, frames, begin) {
  // pass 1: the egg's path; pick 6 ticks spread over the part where it moves
  const track = await p.evaluate((plan) => { const o = []; for (const s of Q.run(plan)) o.push(s); return o; }, res.plan);
  const live = track.filter((s) => s.alive);
  const moving = live.filter((s, i) => i > 0 && Math.hypot(s.x - live[i - 1].x, s.y - live[i - 1].y) > 0.004);
  const pool = moving.length >= 6 ? moving : live;
  const picks = [0, 1, 2, 3, 4, 5].map((i) => pool[Math.round((i * (pool.length - 1)) / 5)].tick);
  // pass 2: replay and shoot those ticks, centred on the egg
  await begin();
  const ticks = new Set(picks);
  await p.evaluate((plan) => { window.IT = Q.run(plan); }, res.plan);
  for (let k = 0; k < track.length; k++) {
    const s = await p.evaluate(() => { const n = IT.next(); if (n.done) return null; const v = n.value, q = Q.scr(v.x, v.y); return { ...v, sx: q.x, sy: q.y }; });
    if (!s) break;
    if (!ticks.has(s.tick)) continue;
    const cx = Math.round(Math.min(Math.max(s.sx, CROP / 2), VW - CROP / 2)), cy = Math.round(Math.min(Math.max(s.sy, CROP / 2), VH - CROP / 2));
    const f = path.join(out, `${name}-${frames.length}.png`);
    await p.screenshot({ path: f, clip: { x: cx - CROP / 2, y: cy - CROP / 2, width: CROP, height: CROP } });
    const mv = s.a.ring >= 0 ? `ring ${s.a.ring} ${s.a.delta > 0 ? '+' : ''}${Math.round((s.a.delta * 180) / Math.PI)} deg` : `wait ${s.a.wait} s`;
    frames.push({ f, label: `${s.t.toFixed(1)} s, ${mv}` });
  }
}

// Rocking vault: no player input at all. The egg is parked on ring 1's bottom ledge; the vault leans one way (the egg
// rides up, then rolls to the low corner), comes back, and leans the other way (the corner gap pours it out).
const SCENE = {
  async rock(p, out, frames) {
    await p.evaluate(() => { const s = __egg.G.sim, e = s.eggs[0], R = s.rings[1]; e.body.setTransform({ x: 0.4, y: -(R.r - 0.08 - 0.22) }, 0); e.ch = 1; });
    const C = 400;
    for (const [at, label] of [[1.2, 'parked on the ledge'], [3.0, 'warning: arrows + creak'], [4.6, 'leaning 25 deg: egg rides up'], [6.2, 'it rolls to the low corner'], [12.2, 'level again; warning the other way'], [15.4, 'leaning back: poured through the gap']]) {
      const s = await p.evaluate((at) => {
        const E = __egg, sim = E.G.sim;
        while (sim.t < at && sim.state === 'play') { for (const r of sim.rings) r.target = r.body.getAngle(); sim.step(); sim.events.length = 0; if (Math.round(sim.t / (1 / 120)) % 2 === 0) E.frame(1 / 60); }
        E.frame(1 / 60);
        return Q.scr(0, -0.3);
      }, at);
      const cx = Math.round(Math.min(Math.max(s.x, C / 2), VW - C / 2)), cy = Math.round(Math.min(Math.max(s.y, C / 2), VH - C / 2));
      const f = path.join(out, `rock-${frames.length}.png`);
      await p.screenshot({ path: f, clip: { x: cx - C / 2, y: cy - C / 2, width: C, height: C } });
      frames.push({ f, label: `${at.toFixed(1)} s, ${label}` });
    }
  },
};

(async () => {
  const { SHAPE_STUDIO } = await import(path.resolve(__dirname, 'shape-studio.mjs'));
  const { solve } = await import(path.resolve(__dirname, 'planner.mjs'));
  const only = flag('--only', '');
  const names = Object.keys(SHAPE_STUDIO).filter((n) => !only || only.split(',').includes(n));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(`http://localhost:${PORT}/`);
  await p.waitForTimeout(900);
  for (const name of names) {
    const L = SHAPE_STUDIO[name];
    const res = solve(L, { mode: 'medium', replay: true });
    console.log(`${name}: planner ${res.state}, ${res.moves} moves, ${res.t} s`);
    // start the level frozen (hitstop keeps the game loop from stepping the sim; we step it ourselves)
    const begin = () => p.evaluate((L) => {
      const E = __egg;
      E.setSave({ mode: 'medium', calm: true, seen: { gears: 1 } });
      E.G.demo = { ...L };
      E.start(-2, { direct: true });
      E.G.toast = null; E.G.toasts.length = 0;
      E.G.hitstop = 1e9;
      for (let i = 0; i < 40; i++) E.frame(1 / 60); // camera settles
      window.Q = {
        scr(x, y) { const G = E.G, P = G.play; return { x: P.x + P.w / 2 + (x - G.cam.x) * G.cam.k, y: P.y + P.h / 2 - (y - G.cam.y) * G.cam.k }; },
        // replay the plan, rendering every 2 sim steps; calls back with (tick) so the caller can pick frames
        * run(plan) {
          let tick = 0;
          for (const a of plan) {
            const it = E.actSteps(E.G.sim, a, 2.5, 2);
            for (const _ of it) { E.frame(1 / 60); const e = E.G.sim.eggs[0]; yield { tick: tick++, t: E.G.sim.t, alive: e.alive && !e.saved, x: e.body ? e.body.getPosition().x : 0, y: e.body ? e.body.getPosition().y : 0, a }; }
            if (E.G.sim.state !== 'play') break;
          }
        },
      };
    }, L);
    await begin();
    const full = path.join(out, `${name}-full.png`);
    await p.screenshot({ path: full });
    const W2 = CROP * 1.3, img = (f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;
    const frames = [];
    if (SCENE[name]) await SCENE[name](p, out, frames);
    else await planStrip(p, res, name, frames, begin);
    // the sheet: full level on the left, the strip in two rows of three
    const html = `<html><body style="margin:0;background:#1d1712;color:#f5e6c8;font:14px sans-serif;padding:10px;width:${Math.round(260 + (W2 + 8) * 3 + 40)}px">
      <div style="font-weight:bold;font-size:17px;margin-bottom:4px">${name} (studio level, Medium, planner: ${res.state} in ${res.moves} moves)</div>
      <div style="margin-bottom:8px;max-width:${Math.round(260 + (W2 + 8) * 3)}px">${BLURB[name] || ''}</div>
      <div style="display:flex;gap:12px;align-items:flex-start">
        <div><img style="width:260px;display:block;border-radius:6px" src="${img(full)}"><div style="padding:2px">whole level (390x844 phone)</div></div>
        <div style="display:grid;grid-template-columns:repeat(3,${W2}px);gap:8px">${frames.map((x, i) => `<div><img style="width:${W2}px;display:block;border-radius:6px" src="${img(x.f)}"><div style="padding:2px">${i + 1}. ${x.label}</div></div>`).join('')}</div>
      </div></body></html>`;
    const p2 = await b.newPage({ viewport: { width: 1100, height: 400 } });
    await p2.setContent(html);
    const sheet = path.join(out, `shapes-${name}.png`);
    await p2.screenshot({ path: sheet, fullPage: true });
    await p2.close();
    for (const x of frames) fs.unlinkSync(x.f);
    fs.unlinkSync(full);
    console.log('-> ' + sheet);
  }
  for (const e of errors) console.log('PAGE ERROR: ' + e);
  await b.close();
  srv.close();
})();
