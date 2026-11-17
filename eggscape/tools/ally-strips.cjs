// Farm allies QA (v3.4): film strips at real phone scale from the live dev build.
// Sheets (outDir): allies-rooster.png and allies-goose.png (one row per animation, crops at 390x844 DPR 2 scale),
// allies-zoom-*.png (same frames 2.4x bigger, for the art), allies-scale.png (hen + rooster + goose side by side) and
// allies-levels.png (the whole level during each action: studio level with a snake and a boss).
// Usage: node tools/ally-strips.cjs [dist/dev] [outDir=qa/allies] [--port 8951]
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const pi = argv.indexOf('--port');
const PORT = pi >= 0 ? +argv[pi + 1] : 8951;
const args = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--port');
const dir = path.resolve(args[0] || 'dist/dev');
const out = path.resolve(args[1] || 'qa/allies');
const VW = 390, VH = 844, DPR = 2;
fs.mkdirSync(out, { recursive: true });

const base = { eggs: 3, target: 2, time: 0, spacing: 1.05, material: 'wood', nest: { w: 2.6 }, seed: 77, tip: '', theme: 'farm' };
const rings = [{ gaps: [{ a: 90 }] }, { gaps: [{ a: 90 }] }, { gaps: [{ a: 60 }] }, { gaps: [{ a: 0 }] }];
const BOSS = { kind: 'weasel', delay: 4, den: { a: 40, hp: 3 }, throws: ['thorn'], phases: [{ attacks: ['throw'], every: 5 }] };
// the studio level: a snake already inside and a weasel boss (the goose's pick is the snake; the rooster stuns both)
const STUDIO = { ...base, rings, snake: { delay: 0.2, speed: 0.5, a: 20 }, bossFight: BOSS };

const srv = http.createServer((q, r) => {
  const f = path.join(dir, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); });
}).listen(PORT);

// rows: [label, kind, phase, [seconds into the phase], crop (css px at zoom 1)]
const ROWS = {
  rooster: [
    ['fly in', 'in', [0.15, 0.4, 0.65, 0.9, 1.15, 1.45], 130],
    ['land', 'land', [0.02, 0.12, 0.22, 0.32, 0.38], 120],
    ['puff chest', 'puff', [0.05, 0.2, 0.35, 0.5], 120],
    ['crow + sound ring', 'crow', [0.05, 0.25, 0.4, 0.6, 0.8, 1.05], 150],
    ['proud strut', 'strut', [0.1, 0.4, 0.7, 1.0, 1.18], 120],
    ['fly off', 'out', [0.05, 0.2, 0.4, 0.65, 0.95, 1.3], 130],
  ],
  goose: [
    ['waddle in', 'in', [0.1, 0.5, 0.9, 1.3, 1.85], 100],
    ['neck-out hiss', 'hiss', [0.05, 0.2, 0.4, 0.6, 0.78], 110],
    ['charge', 'charge', [0.12, 0.45, 0.8, 1.15, 1.5, 1.9], 150],
    ['collide / knock', 'hit', [0.02, 0.1, 0.2, 0.3, 0.45], 130],
    ['waddle off', 'off', [0.1, 0.5, 0.9, 1.3, 1.75], 100],
  ],
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(`http://localhost:${PORT}/`);
  await p.waitForTimeout(900);
  const boot = (spec) => p.evaluate((L) => {
    const E = __egg;
    E.setSave({ mode: 'medium', calm: false, seen: {} });
    E.G.demo = { id: 990, name: 'Studio', ...L };
    E.start(-2, { direct: true });
    E.G.paused = true; E.G.toast = null; E.G.toasts.length = 0;
    window.Q = { run(s) { for (let i = 0; i < Math.round(s * 60); i++) E.frame(1 / 60); } };
    Q.run(0.6);
  }, spec);

  // ---- isolated frames: drive the sim, then draw only the ally on a flat backdrop (no HUD), crop around it
  await boot(STUDIO);
  const frameShot = (kind, ph, secs, crop, zoom) => p.evaluate(async ([kind, ph, secs, crop, zoom, DPR]) => {
    const E = __egg, A = E.allyArt, sim = E.G.sim, k0 = 41.2, k = k0 * zoom, R = sim.outerR, gy = sim.groundY;
    const imgs = [];
    for (const sec of secs) {
      // a fresh sim each frame (same level), call the ally, run to the wanted time inside the phase
      const s2 = new E.sim.constructor(sim.level, { mode: 'medium' });
      for (let i = 0; i < 240; i++) s2.step();
      s2.callAlly(kind);
      const act = () => s2.ally.act;
      // hit: the goose's hit stop (0.5 s); every other row: seconds into the phase
      const done = (a) => (ph === 'hit' ? a.ph === 'charge' && a.hs > 0 && a.hs <= 0.5 - sec + 1e-4 : a.ph === ph && a.t >= sec - 1e-4);
      for (let i = 0; i < 60 * 20 && act() && !done(act()); i++) s2.step();
      const a = act();
      if (!a) { imgs.push(null); continue; }
      const pl = A.allyPlace(a, R, gy);
      const W = crop * zoom, cv = document.createElement('canvas');
      cv.width = cv.height = Math.round(W * DPR);
      const c = cv.getContext('2d');
      // backdrop: sky, the vault's outer ring as a wooden band, grass and the ground
      c.fillStyle = '#9fd3f2'; c.fillRect(0, 0, cv.width, cv.height);
      c.setTransform(DPR * k, 0, 0, -DPR * k, cv.width / 2 - DPR * k * pl.x, cv.height / 2 + DPR * k * (pl.y + 0.55 * (a.kind === 'rooster' ? 1.3 : 1.2)));
      c.fillStyle = '#7bbf5a'; c.fillRect(-20, gy - 6, 40, 6);
      c.strokeStyle = '#7a4f2a'; c.lineWidth = 0.16; c.beginPath(); c.arc(0, 0, R - 0.08, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = '#b98550'; c.lineWidth = 0.08; c.beginPath(); c.arc(0, 0, R - 0.08, 0, Math.PI * 2); c.stroke();
      A.drawAllyAct(c, a, R, gy, k, true);
      imgs.push(cv.toDataURL());
    }
    return imgs;
  }, [kind, ph, secs, crop, zoom, DPR]);

  const sheets = {};
  for (const zoom of [1, 2.4]) {
    for (const kind of ['rooster', 'goose']) {
      const rows = [];
      for (const [label, ph, secs, crop] of ROWS[kind]) {
        const imgs = await frameShot(kind, ph, secs, crop, zoom);
        rows.push({ label, imgs, secs, crop });
      }
      sheets[`${zoom}-${kind}`] = rows;
    }
  }

  // ---- scale row: hen, rooster and goose side by side, standing (real scale and zoomed)
  const scale = await p.evaluate(async ([DPR]) => {
    const A = __egg.allyArt, k = 41.2, res = {};
    for (const zoom of [1, 2.4]) {
      const W = 250 * zoom, H = 90 * zoom, cv = document.createElement('canvas');
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      const c = cv.getContext('2d');
      c.scale(DPR * zoom, DPR * zoom);
      c.fillStyle = '#9fd3f2'; c.fillRect(0, 0, 250, 90);
      c.fillStyle = '#7bbf5a'; c.fillRect(0, 70, 250, 20);
      const gy = 76; // feet line
      const hs = 1.26 * k; // the game's hen (s = max(0.95, 52 px)): 52 px
      A.drawHen(c, 45, gy - 0.5 * 52 + 2, 52, 'idle', 0.3);
      A.drawRooster(c, 120, gy - 0.48 * A.SIZE.rooster * k, A.SIZE.rooster * k, A.roosterPose('idle', 0, 0.3));
      A.drawGoose(c, 195, gy - 0.48 * A.SIZE.goose * k, A.SIZE.goose * k, A.goosePose('idle', 0, 0.3));
      res[zoom] = cv.toDataURL();
      void hs;
    }
    return res;
  }, [DPR]);

  // ---- full level: the whole vault during each action
  const levels = [];
  for (const [kind, times, extra] of [['rooster', [0.6, 1.2, 1.7, 2.2, 2.65, 3.0, 3.4, 4.2, 5.4], ''], ['goose', [1.0, 2.2, 2.9, 3.4, 3.8, 4.2, 4.6, 5.1, 6.0], '']]) {
    await boot(STUDIO);
    await p.evaluate(() => Q.run(5));
    const shots = [];
    await p.evaluate((kind) => { window.__called = __egg.callAlly(kind); window.__t0 = __egg.sim.t; }, kind);
    let last = 0;
    for (const T of times) {
      await p.evaluate((dt) => Q.run(dt), T - last);
      last = T;
      const f = path.join(out, `lv-${kind}-${shots.length}.png`);
      await p.screenshot({ path: f, clip: { x: 0, y: 120, width: VW, height: 600 } });
      const info = await p.evaluate(() => { const s = __egg.sim, a = s.ally.act; return { ph: a && a.ph, sn: s.snakes.map((x) => +x.stun.toFixed(1)).join('/'), boss: +(s.bx.boss.dizzy || 0).toFixed(1) }; });
      shots.push({ f, label: `${T.toFixed(1)}s ${info.ph || 'done'}`, info });
    }
    levels.push({ kind, shots });
  }
  for (const e of errors) console.log('PAGE ERROR: ' + e);

  // ---- assemble
  const pg = await b.newPage({ viewport: { width: 1300, height: 400 }, deviceScaleFactor: DPR });
  const css = 'body{margin:0;background:#1d1712;color:#f5e6c8;font:13px sans-serif;padding:8px}h3{margin:10px 0 3px}.r{margin-bottom:8px}.f{display:flex;gap:4px;flex-wrap:wrap}.f div{font-size:11px}img{display:block;border-radius:4px}';
  for (const [key, rows] of Object.entries(sheets)) {
    const [zoom, kind] = key.split('-');
    const html = `<html><style>${css}</style><body>${rows.map((r) => `<div class="r"><h3>${kind}: ${r.label}</h3><div class="f">${r.imgs.map((u, i) => `<div>${u ? `<img style="width:${r.crop * zoom}px" src="${u}">` : 'missing'}${r.secs[i]}s</div>`).join('')}</div></div>`).join('')}</body></html>`;
    await pg.setViewportSize({ width: Math.round(zoom == 1 ? 8 * 160 : 4 * 2.4 * 160), height: 400 });
    await pg.setContent(html);
    await pg.screenshot({ path: path.join(out, zoom == 1 ? `allies-${kind}.png` : `allies-zoom-${kind}.png`), fullPage: true });
  }
  await pg.setViewportSize({ width: 900, height: 300 });
  await pg.setContent(`<html><style>${css}</style><body><h3>hen, rooster, goose at phone scale (390x844)</h3><img style="width:250px" src="${scale[1]}"><h3>2.4x</h3><img style="width:600px" src="${scale[2.4]}"></body></html>`);
  await pg.screenshot({ path: path.join(out, 'allies-scale.png'), fullPage: true });
  const lw = 215;
  await pg.setViewportSize({ width: lw * 9 + 80, height: 400 });
  await pg.setContent(`<html><style>${css}</style><body>${levels.map((L) => `<div class="r"><h3>${L.kind} in a studio level (snake + weasel boss)</h3><div class="f">${L.shots.map((s) => `<div><img style="width:${lw}px" src="data:image/png;base64,${fs.readFileSync(s.f).toString('base64')}">${s.label} snake stun ${s.info.sn} boss dizzy ${s.info.boss}</div>`).join('')}</div></div>`).join('')}</body></html>`);
  await pg.screenshot({ path: path.join(out, 'allies-levels.png'), fullPage: true });
  for (const L of levels) for (const s of L.shots) fs.unlinkSync(s.f);
  console.log('-> ' + out);
  await b.close();
  srv.close();
})();
