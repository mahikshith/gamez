// Animated hen QA (V3-PLAN M7): film strips from the live dev build.
// Sheets written to <outDir>:
//   hen-states.png   one row per state (idle, walk, worried, cheer, cry, dance), 8 frames each, at in-level scale
//                    (hen 52 css px tall on a 390x844 phone, rendered at DPR 2)
//   hen-closeup.png  the 2x close-up row (104 px hen), one frame per state
//   hen-compare.png  old hen (reference sprites) beside the new one, per mood
//   hen-live.png     the real game: an egg falls into the nest (she shuffles under it, then cheers), an egg breaks (cry)
// Usage: node tools/hen-strips.cjs [dist/dev] [outDir=qa/hen] [port=8901]
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const dir = path.resolve(args[0] || 'dist/dev');
const out = path.resolve(args[1] || 'qa/hen');
const PORT = +(args[2] || 8901);
const VW = 390, VH = 844, DPR = 2;
fs.mkdirSync(out, { recursive: true });

const srv = http.createServer((q, r) => {
  const f = path.join(dir, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); });
}).listen(PORT);

// Row definitions. sched: [time, {mood, n, look, danger}] applied once t passes `time`. at: capture times (s).
const rows = [
  { name: 'idle: breathe, blink, peck, ruffle', idle: true },
  { name: 'walk: shuffle left under the egg, stop, shuffle right (grey tick = home)', look: true,
    sched: [[0, { look: 0 }], [0.5, { look: -1 }], [1.45, { look: 0 }], [1.7, { look: 1 }]], at: [0.45, 0.62, 0.8, 0.98, 1.3, 1.6, 1.85, 2.2] },
  { name: 'worried: a crack (gasp), head darts, feathers puff, then calms', sched: [[0.5, { mood: 'gasp', n: 1 }], [1.9, { mood: 'idle', n: 1 }]], at: [0.4, 0.52, 0.62, 0.8, 1.05, 1.45, 2.05, 2.6] },
  { name: 'cheer: an egg lands (crouch, hop, flap, land, burst)', sched: [[0.4, { mood: 'happy', n: 1 }], [2.0, { mood: 'idle', n: 1 }]], at: [0.38, 0.47, 0.58, 0.7, 0.86, 0.98, 1.2, 1.55] },
  { name: 'cry: an egg breaks (droop, sobs, wipe a tear), then recovers', sched: [[0.4, { mood: 'cry', n: 1 }], [2.6, { mood: 'idle', n: 1 }]], at: [0.35, 0.7, 1.1, 1.7, 2.2, 2.55, 3.0, 3.6] },
  { name: 'dance: win card (hops, kicks, wings in turns)', sched: [[0.2, { mood: 'dance', n: 0 }]], at: [0.1, 0.4, 0.55, 0.7, 0.85, 1.0, 1.15, 1.3] },
];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto('http://localhost:' + PORT + '/');
  await p.waitForTimeout(1200);

  // harness: draw the hen on a small ground cell, stepping its clock at 60 fps
  await p.evaluate(() => {
    const H = __egg.hen;
    window.cell = (fn, w, hh, h, mkOpts) => {
      const c = document.createElement('canvas');
      c.width = w * 2; c.height = hh * 2;
      const x = c.getContext('2d');
      x.scale(2, 2);
      const g = x.createLinearGradient(0, 0, 0, hh);
      g.addColorStop(0, '#6f8fb3'); g.addColorStop(0.72, '#9ab6cf'); g.addColorStop(0.72, '#6b9a4a'); g.addColorStop(1, '#4f7a38');
      x.fillStyle = g; x.fillRect(0, 0, w, hh);
      const gy = hh * 0.8;
      x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 1; x.beginPath(); x.moveTo(w / 2, gy - 3); x.lineTo(w / 2, gy + 4); x.stroke();
      x.strokeStyle = '#c9a24a'; x.lineCap = 'round'; x.lineWidth = Math.max(1, h * 0.022);
      for (const [a, bb, cc] of [[-0.42, -0.02, -0.22], [-0.3, 0.01, -0.05], [0.18, -0.01, 0.4], [0.3, 0.02, 0.5]]) { x.beginPath(); x.moveTo(w / 2 + a * h, gy + bb * h); x.lineTo(w / 2 + cc * h, gy + bb * h - h * 0.03); x.stroke(); }
      fn(x, w / 2, gy - 0.49 * h, h);
      return c.toDataURL('image/png');
    };
    // run a row: returns a data URL for each capture time
    window.runRow = (spec, h, w, hh) => {
      H.reset('strip');
      const st = { mood: 'idle', n: 0, look: spec.look ? 0 : undefined, danger: 0 };
      const sched = (spec.sched || []).slice();
      let at = spec.at.slice();
      const outs = [];
      let t = 100;
      const t0 = t;
      let last = null;
      const draw = (x, cx, cy, hh2) => H.anim(x, st.mood, cx, cy, hh2, t, { key: 'strip', n: st.n, look: st.look, danger: st.danger, shadow: 0.26 });
      for (let i = 0; i < 60 * 40 && at.length; i++) {
        while (sched.length && t - t0 >= sched[0][0]) Object.assign(st, sched.shift()[1]);
        // draw offscreen every frame so the state advances exactly as in the game
        const tmp = document.createElement('canvas').getContext('2d');
        draw(tmp, 0, 0, h);
        if (t - t0 >= at[0] - 1e-6) { outs.push(window.cell(draw, w, hh, h)); at.shift(); }
        t += 1 / 60;
      }
      return outs;
    };
    // times (in the hen's own clock) of the first blink peak, peck and ruffle
    window.evFind = (n) => {
      const r = { blink: null, peck: null, ruffle: null };
      for (let i = 0; i < 60 * 40; i++) {
        const tt = i / 60, e = H.events(tt);
        if (r.blink == null && e.blink > 0.97) r.blink = tt;
        if (r.peck == null && e.peck >= 0 && e.peck < 0.02) r.peck = tt;
        if (r.ruffle == null && e.ruffle >= 0 && e.ruffle < 0.02) r.ruffle = tt;
      }
      return r;
    };
  });

  const imgs = {};
  const H1 = 52, W1 = 130, HH1 = 92;
  for (const r of rows) {
    if (r.idle) {
      const ev = await p.evaluate(() => evFind());
      // the hen's clock starts at 0 when the row starts; capture: breathe, blink, peck 25/55/85 %, ruffle 30/65 %
      r.at = [0.3, ev.blink, ev.peck + 0.25, ev.peck + 0.62, ev.peck + 0.95, ev.ruffle + 0.2, ev.ruffle + 0.5, ev.ruffle + 0.72].map((v) => Math.round(v * 60) / 60);
      r.sched = [];
      r.sorted = r.at.map((v, i) => [v, i]).sort((a, b2) => a[0] - b2[0]);
    }
    const order = r.sorted;
    const spec = { ...r, at: order ? order.map((x) => x[0]) : r.at };
    let urls = await p.evaluate(([s, h, w, hh]) => runRow(s, h, w, hh), [spec, H1, W1, HH1]);
    if (order) { const o2 = []; order.forEach(([, i], k) => (o2[i] = urls[k])); urls = o2; }
    imgs[r.name] = { urls, at: r.at, tags: r.idle ? ['breathe', 'blink', 'peck 25%', 'peck 62%', 'peck 95%', 'ruffle 20%', 'ruffle 50%', 'ruffle 72%'] : null };
  }
  // 2x close-up row: one beat of each state at 104 px
  const close = [];
  const CL = [
    ['idle', [], 1.2], ['peck', [], null], ['gasp', [[0.4, { mood: 'gasp', n: 1 }]], 0.7], ['gasp', [[0.4, { mood: 'gasp', n: 1 }]], 1.1],
    ['cheer', [[0.4, { mood: 'happy', n: 1 }]], 0.7], ['land', [[0.4, { mood: 'happy', n: 1 }]], 0.95], ['cry', [[0.4, { mood: 'cry', n: 1 }]], 1.5], ['dance', [[0.2, { mood: 'dance', n: 0 }]], 0.85],
  ];
  const ev = await p.evaluate(() => evFind());
  for (const [nm, sched, at] of CL) {
    const a = nm === 'peck' ? ev.peck + 0.5 : at;
    const u = await p.evaluate(([s, a2]) => runRow({ sched: s, at: [a2] }, 104, 260, 184), [sched, Math.round(a * 60) / 60]);
    close.push({ url: u[0], label: nm });
  }

  // ---- side by side: old vs new
  const pairs = [];
  const MOODS = [['idle', 'idle'], ['happy', 'happy: catch'], ['gasp', 'gasp: crack'], ['worried', 'worried'], ['cry', 'cry'], ['dance', 'dance']];
  for (const [m, lab] of MOODS) {
    const t = m === 'happy' ? 0.55 : m === 'cry' ? 1.0 : 0.8;
    const u = await p.evaluate(([m2, t2]) => {
      const H = __egg.hen;
      H.reset('cmp');
      const old = window.cell((x, cx, cy, h) => H.legacy(x, m2, cx, cy, h, t2 + 100, { key: 'cmp-old' }), 130, 92, 52);
      let tm = 100;
      const tmp = document.createElement('canvas').getContext('2d');
      const o = { key: 'cmp', n: 1 };
      H.anim(tmp, 'idle', 0, 0, 52, tm, o);
      for (let i = 0; i < Math.round(t2 * 60); i++) { tm += 1 / 60; H.anim(tmp, m2, 0, 0, 52, tm, o); }
      const nw = window.cell((x, cx, cy, h) => H.anim(x, m2, cx, cy, h, tm, { ...o, shadow: 0.26 }), 130, 92, 52);
      return [old, nw];
    }, [m, t]);
    pairs.push({ old: u[0], nw: u[1], label: lab });
  }

  // ---- live: the real game. A studio level: an egg is dropped near the nest, lands (cheer), another breaks (cry).
  const live = [];
  const base = { eggs: 3, target: 1, time: 0, spacing: 1.05, material: 'wood', nest: { w: 2.6 }, seed: 77, tip: '', theme: 'farm', rings: [{ gaps: [{ a: -90 }] }, { gaps: [{ a: -90 }] }, { gaps: [{ a: -90 }] }] };
  await p.evaluate(([L]) => {
    const E = __egg;
    E.setSave({ mode: 'medium', calm: false, seen: {} });
    E.G.demo = { id: 990, name: 'Studio', ...L };
    E.start(-2, { direct: true });
    E.G.toast = null; E.G.toasts.length = 0;
    window.Q = {
      run(s) { for (let i = 0; i < Math.round(s * 60); i++) E.frame(1 / 60); },
      hen() {
        const G = E.G, s = G.sim, k = G.cam.k, P = G.play, sc = Math.max(0.95, Math.min(52, k * 1.5) / k), n = s.nest.getPosition();
        const x = n.x + s.nestW / 2 + 0.6 + (sc - 0.95) / 2;
        return { x: P.x + P.w / 2 + (x - G.cam.x) * k, y: P.y + P.h / 2 - (s.groundY - G.cam.y) * k, k };
      },
      put(i, x, y) { const e = E.G.sim.eggs[i]; e.body.setTransform({ x, y }, 0); e.body.setLinearVelocity({ x: 0, y: 0 }); },
    };
    Q.run(0.6);
  }, [base]);
  const CROP = 190;
  const shoot = async (label) => {
    const h = await p.evaluate(() => Q.hen());
    const cx = Math.round(Math.min(Math.max(h.x - 50, CROP / 2), VW - CROP / 2)), cy = Math.round(Math.min(Math.max(h.y - 40, CROP / 2), VH - CROP / 2));
    const buf = await p.screenshot({ clip: { x: cx - CROP / 2, y: cy - CROP / 2, width: CROP, height: CROP } });
    live.push({ url: 'data:image/png;base64,' + buf.toString('base64'), label });
  };
  await p.evaluate(() => { const G = __egg.G; G.paused = false; });
  await shoot('idle in the level');
  // an egg a few metres up and to the left of the nest, falling toward it: she shuffles toward it
  const nest = await p.evaluate(() => { const s = __egg.G.sim, n = s.nest.getPosition(); return { x: n.x, y: s.groundY, w: s.nestW }; });
  await p.evaluate(([nx, gy]) => { Q.put(0, nx + 0.05, gy + 3.4); }, [nest.x, nest.y]);
  for (const lab of ['egg falling', 'she shuffles', 'still near']) { await p.evaluate(() => Q.run(0.1)); await shoot(lab); }
  for (let i = 0; i < 8; i++) { await p.evaluate(() => Q.run(0.1)); const saved = await p.evaluate(() => __egg.G.sim.savedLog.length); if (saved) break; }
  for (const lab of ['egg lands', '+0.15 s', '+0.3 s', '+0.5 s']) { await shoot(lab); await p.evaluate(() => Q.run(0.13)); }
  await p.evaluate(() => Q.run(1.5));
  // an egg smashes on the ground away from the nest: cry
  await p.evaluate(([nx, gy]) => { Q.put(1, nx + 7, gy + 0.6); }, [nest.x, nest.y]);
  for (const lab of ['egg falls', 'breaks', 'cries', 'sobs', 'sobs', 'wipes']) { await p.evaluate(() => Q.run(0.28)); await shoot(lab); }
  const state = await p.evaluate(() => ({ hen: __egg.G.hen, saved: __egg.G.sim.savedLog.length }));
  console.log('live end state', JSON.stringify(state));

  // ---- sheets
  const grp = (title, cells, w) => `<div style="margin-bottom:12px"><div style="font-weight:bold;margin:2px 0 4px">${title}</div><div style="display:flex;gap:4px">${cells.map((c) => `<div><img style="width:${w}px;display:block;border-radius:4px" src="${c.url}"><div style="font-size:11px;padding:1px 2px">${c.label || ''}</div></div>`).join('')}</div></div>`;
  const wrap = (body) => `<html><body style="margin:0;background:#1d1712;color:#f5e6c8;font:13px sans-serif;padding:8px">${body}</body></html>`;
  const shot = async (html, file, width) => {
    const p2 = await b.newPage({ viewport: { width, height: 300 } });
    await p2.setContent(html);
    await p2.screenshot({ path: path.join(out, file), fullPage: true });
    await p2.close();
  };
  const stateRows = rows.map((r) => grp(r.name, imgs[r.name].urls.map((u, i) => ({ url: u, label: (imgs[r.name].tags ? imgs[r.name].tags[i] + ' ' : '') + imgs[r.name].at[i].toFixed(2) + ' s' })), W1 * 1.25)).join('');
  await shot(wrap(stateRows), 'hen-states.png', Math.round(W1 * 1.25 * 8 + 80));
  await shot(wrap(grp('2x close-up (104 px hen), one frame per state', close.slice(0, 4), 260) + grp('', close.slice(4), 260)), 'hen-closeup.png', 260 * 4 + 60);
  const cmpCells = [];
  for (const q of pairs) { cmpCells.push({ url: q.old, label: 'old ' + q.label }); cmpCells.push({ url: q.nw, label: 'new ' + q.label }); }
  await shot(wrap(grp('old hen (sprites) vs new hen (code-drawn), in-level scale', cmpCells, 130 * 1.15)), 'hen-compare.png', Math.round(130 * 1.15 * 12 + 80));
  await shot(wrap(grp('live: the real game, phone 390x844 (crops around the hen)', live, 150 * 1.3)), 'hen-live.png', Math.round(150 * 1.3 * 8 + 80));
  for (const e of errors) console.log('PAGE ERROR: ' + e);
  console.log('wrote ' + out);
  await b.close();
  srv.close();
})();
