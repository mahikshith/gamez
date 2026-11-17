// Octopus villain QA (v3.5): strip sheets at real phone scale (390x844, DPR 2) from the live dev build.
// Sheets: compare (old build vs new), poses (idle/hunt/warn/grab/carry/squirt/struck on every kind of backdrop), hunt (across
// channels, ink, grab, carry, let go, cooldown), states (frozen, cracking, thaw, zap, stunned), den (lurk, rise), level (the
// existing level with the octopus in it, full phone screen).
// Usage: node tools/octo-strips.cjs [dist/dev] [outDir=qa/octo] [--port=8991] [--old=/path/to/old/dist/dev] [--only=a,b]
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const opt = (n, d) => ((process.argv.find((a) => a.startsWith(`--${n}=`)) || '').split('=')[1] || d);
const PORT = +opt('port', 8991);
const dir = path.resolve(args[0] || 'dist/dev');
const out = path.resolve(args[1] || 'qa/octo');
const OLD = opt('old', '');
const ONLY = opt('only', '').split(',').filter(Boolean);
const VW = 390, VH = 844, DPR = 2;
fs.mkdirSync(out, { recursive: true });

const base = { eggs: 1, target: 1, time: 0, spacing: 1.05, material: 'coral', nest: { w: 2.6 }, seed: 77, tip: '', theme: 'reef' };
const rings = [{ gaps: [{ a: 90 }] }, { gaps: [{ a: 100 }] }, { gaps: [{ a: 160 }], thorns: [{ a: -140, n: 3 }] }, { gaps: [{ a: 20 }] }];
const lvl = (theme, extra = {}, mat) => ({ ...base, theme, material: mat || base.material, octopus: { ch: 2, a: -100, delay: 0, ...(extra.octopus || {}) }, rings, ...extra, octopus: { ch: 2, a: -100, delay: 0, ...(extra.octopus || {}) } });
const THEMES = [['reef', 'coral'], ['frozen', 'wood'], ['crystal', 'glass'], ['barn', 'wood'], ['volcano', 'obsidian']];

function serve(root, port) {
  return http.createServer((q, r) => {
    const f = path.join(root, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]);
    fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); });
  }).listen(port);
}

const SETUP = ([L, mode]) => {
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
    egg(i, ch, a) { const e = E.G.sim.eggs[i], R = E.G.sim.rings[ch], r = R.r - 0.08 - 0.3, w = (a * Math.PI) / 180; e.body.setTransform({ x: r * Math.cos(w), y: r * Math.sin(w) }, w); e.body.setLinearVelocity({ x: 0, y: 0 }); e.body.setAngularVelocity(0); e.ch = ch; return e; },
    park(i) { const e = E.G.sim.eggs[i]; e.body.setTransform({ x: 0, y: -0.4 }, 0); e.body.setLinearVelocity({ x: 0, y: 0 }); },
    oct() { const C = E.G.sim.octos[0]; return { x: C.rad * Math.cos(C.a), y: C.rad * Math.sin(C.a), ph: C.ph, t: C.t, dur: C.dur }; },
    k() { return E.G.cam.k; },
  };
  Q.run(0.3);
};

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const srv = serve(dir, PORT);
  const srvOld = OLD ? serve(path.resolve(OLD), PORT + 1) : null;
  const mkPage = async (port) => {
    const p = await b.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR });
    p.on('pageerror', (e) => errors.push(String(e)));
    p.on('console', (m) => { if (m.type() === 'warning' && /sea art/.test(m.text())) errors.push(m.text()); });
    await p.goto(`http://localhost:${port}/`);
    await p.waitForTimeout(900);
    return p;
  };
  const p = await mkPage(PORT);
  const ev = (fn, ...a) => p.evaluate(fn, ...a);
  const start = (L, mode = 'medium', pg = p) => pg.evaluate(SETUP, [L, mode]);
  const sheets = {};
  let row = null;
  const newRow = (sheet, name) => { row = { name, frames: [] }; (sheets[sheet] = sheets[sheet] || []).push(row); };
  const shoot = async (label, world, C = 110, pg = p) => {
    const at = await pg.evaluate((w) => Q.scr(w.x, w.y), world);
    const cx = Math.round(Math.min(Math.max(at.x, C / 2), VW - C / 2)), cy = Math.round(Math.min(Math.max(at.y, C / 2), VH - C / 2));
    const f = path.join(out, `f-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
    await pg.screenshot({ path: f, clip: { x: cx - C / 2, y: cy - C / 2, width: C, height: C } });
    row.frames.push({ f, label });
  };
  const octAt = (pg = p) => pg.evaluate(() => Q.oct());
  const want = (n) => !ONLY.length || ONLY.includes(n);
  const setup = async (L, mode, f) => { await start(L, mode); await ev(f || (() => { Q.park(0); Q.run(0.8); Q.quiet(); })); };

  // ---------------- compare: old vs new, same moments, real scale
  if (want('compare')) {
    const po = OLD ? await mkPage(PORT + 1) : null;
    const L = lvl('reef');
    const moments = [
      ['idle', () => { Q.park(0); Q.run(0.8); Q.quiet(); }],
      ['hunting', () => { Q.egg(0, 2, -40); Q.run(0.5); Q.quiet(); }],
      ['about to grab', () => { Q.egg(0, 2, -80); Q.until(() => { const C = Q.s.octos[0]; return C.ph === 'warn' && C.t < C.dur * 0.4; }); Q.quiet(); }],
      ['held', () => { Q.egg(0, 2, -80); Q.until(() => Q.s.octos[0].ph === 'carry'); Q.run(0.8); Q.quiet(); }],
    ];
    for (const [name, pg, tag] of [['old', po], ['new', p]]) {
      if (!pg) continue;
      newRow('compare', `${name} (real phone scale: crops 110 css px, 2x)`);
      for (const [lab, f] of moments) { await start(L, 'medium', pg); await pg.evaluate(f); await shoot(lab, await octAt(pg), 110, pg); }
      void tag;
    }
    newRow('compare', 'new, 60 px crops (the size of an egg row)');
    for (const [lab, f] of moments) { await start(L, 'medium'); await ev(f); await shoot(lab, await octAt(), 70); }
  }

  // ---------------- poses on every backdrop
  if (want('poses')) {
    const poses = [
      ['idle', () => { Q.park(0); Q.run(1.0); }],
      ['hunt', () => { Q.egg(0, 2, -40); Q.until(() => Q.s.octos[0].ph === 'seek'); Q.run(0.3); }],
      ['warn', () => { Q.egg(0, 2, -80); Q.until(() => { const C = Q.s.octos[0]; return C.ph === 'warn' && C.t < C.dur * 0.35; }); }],
      ['carry', () => { Q.egg(0, 2, -80); Q.until(() => Q.s.octos[0].ph === 'carry'); Q.run(1); }],
    ];
    for (const [theme, mat] of THEMES) {
      newRow('poses', `${theme}: idle (scheming), hunting (eyes locked, arms reaching), warn (red flush, arms rising), carry (smug, egg clutched)`);
      for (const [lab, f] of poses) { await start(lvl(theme, { octopus: { a: -110 } }, mat)); await ev((f) => { Q.run(0.2); (0, eval)('(' + f + ')')(); Q.quiet(); }, f.toString()); await shoot(lab, await octAt(), 100); }
    }
  }

  // ---------------- hunt: across channels, ink, grab, carry, let go, cooldown
  if (want('hunt')) {
    const L = lvl('crystal', { octopus: { a: -100, den: true }, eggs: 2, target: 1 }, 'glass');
    await start(L, 'hard');
    await ev(() => { Q.s.octos[0].inkCd = 0; Q.park(1); Q.egg(0, 3, -40); Q.quiet(); });
    newRow('hunt', 'across channels (Hard): wakes in its den, rises, climbs through the gap toward an egg in channel 3');
    const seq = async (n, d, lab) => { for (let i = 0; i < n; i++) { await ev((d) => Q.run(d), d); await shoot(lab(i), await octAt()); } };
    await ev(() => Q.until(() => Q.s.octos[0].ph === 'rise'));
    await shoot('wakes', await octAt());
    await seq(5, 0.9, (i) => `+${((i + 1) * 0.9).toFixed(1)} s ${['', '', '', '', ''][i]}`);
    newRow('hunt', 'telegraph and the signature move: squirt (arms up, swelling) then an ink cloud blacks out the ring sector');
    await ev(() => Q.until(() => ['squirt', 'warn'].includes(Q.s.octos[0].ph), 20));
    for (const d of [0.1, 0.35, 0.3, 0.2, 0.5, 1.0, 1.4]) { await ev((d) => Q.run(d), d); const C = await ev(() => { const C = Q.s.octos[0]; return { ph: C.ph, sq: C.sqT }; }); await shoot(`${C.ph}${C.sq < 9 ? ' ink ' + C.sq.toFixed(1) : ''}`, await octAt(), 130); }
    // a clean grab, carry and let go + cooldown
    await start(lvl('reef'), 'medium');
    await ev(() => { Q.egg(0, 2, -80); Q.quiet(); });
    newRow('hunt', 'grab, carry, and the cooldown: after a zap it does not come straight back for the same egg');
    await ev(() => Q.until(() => Q.s.octos[0].ph === 'grab')); await shoot('grab', await octAt());
    await ev(() => Q.until(() => Q.s.octos[0].ph === 'carry')); await ev(() => Q.run(0.6)); await shoot('held', await octAt());
    await ev(() => { Q.quiet(); Q.s.octHit(Q.s.octos[0], 'water'); Q.run(0.2); }); await shoot('water: let go', await octAt());
    await ev(() => { Q.run(0.8); }); await shoot('jet', await octAt());
    const eggp = await ev(() => { const p = Q.s.eggs[0].body.getPosition(); return { x: p.x, y: p.y }; });
    await ev(() => Q.run(5)); await shoot('+5 s: ignores the egg', await octAt());
    const ban = await ev(() => { const C = Q.s.octos[0]; return { ph: C.ph, ban: C.ban, banT: +C.banT.toFixed(1) }; });
    console.log('cooldown check', JSON.stringify(ban), JSON.stringify(eggp));
  }

  // ---------------- states: frozen, stunned
  if (want('states')) {
    const L = lvl('frozen', { octopus: { a: -100, den: false } }, 'wood');
    for (const theme of [['frozen', 'wood'], ['crystal', 'glass']]) {
      const LL = lvl(theme[0], {}, theme[1]);
      await start(LL); await ev(() => { Q.park(0); Q.run(1); Q.quiet(); });
      newRow('states', `${theme[0]}: FROZEN, normal, ice growing, held, cracking (last 1 s), thaw shards, shaking itself off`);
      const o = await octAt();
      await shoot('normal', o, 100);
      await ev(() => { Q.s.seaFreeze(4); Q.run(0.1); }); await shoot('freezing', await octAt(), 100);
      await ev(() => Q.run(1.5)); await shoot('frozen', await octAt(), 100);
      await ev(() => Q.run(1.1)); await shoot('cracking', await octAt(), 100);
      await ev(() => Q.run(0.9)); await shoot('shivering', await octAt(), 100);
      await ev(() => Q.until(() => Q.s.octos[0].fz === 0)); await ev(() => Q.run(0.12)); await shoot('thaw: shards', await octAt(), 100);
      await ev(() => Q.run(0.25)); await shoot('shards fall', await octAt(), 100);
      await ev(() => Q.run(0.2)); await shoot('shakes off', await octAt(), 100);
      await start(LL); await ev(() => { Q.park(0); Q.run(1); Q.quiet(); });
      newRow('states', `${theme[0]}: STUNNED, zap arcs 0.1 s, 0.3 s, dizzy (slack, spiral eyes, stars), later, recovering`);
      await ev(() => { Q.s.seaStun(3, 0.3); Q.run(0.08); }); await shoot('zap arcs', await octAt(), 100);
      await ev(() => Q.run(0.15)); await shoot('flash fades', await octAt(), 100);
      await ev(() => Q.run(0.5)); await shoot('dizzy', await octAt(), 100);
      await ev(() => Q.run(0.4)); await shoot('dizzy +0.4', await octAt(), 100);
      await ev(() => Q.run(0.4)); await shoot('dizzy +0.8', await octAt(), 100);
      await ev(() => Q.until(() => Q.s.octos[0].stn === 0)); await ev(() => Q.run(0.4)); await shoot('recovered', await octAt(), 100);
    }
    void L;
    // frozen while holding an egg
    await start(lvl('reef')); await ev(() => { Q.egg(0, 2, -80); Q.until(() => Q.s.octos[0].ph === 'carry'); Q.run(0.5); Q.s.seaFreeze(3); Q.run(0.8); Q.quiet(); });
    newRow('states', 'frozen while holding an egg (the egg stays held, safe), then stunned by thunder: it lets go');
    await shoot('frozen, egg held', await octAt(), 100);
    await start(lvl('reef')); await ev(() => { Q.egg(0, 2, -80); Q.until(() => Q.s.octos[0].ph === 'carry'); Q.run(0.5); Q.quiet(); Q.s.seaStun(3, 0.3); Q.run(0.1); });
    await shoot('thunder: zap, lets go', await octAt(), 100);
    await ev(() => Q.run(0.6)); await shoot('dazed', await octAt(), 100);
  }

  // ---------------- den: lurk and rise (a non-sea world)
  if (want('den')) {
    for (const [theme, mat] of [['frozen', 'wood'], ['crystal', 'glass'], ['barn', 'wood']]) {
      await start(lvl(theme, { octopus: { a: -100, den: true } }, mat));
      await ev(() => { Q.park(0); Q.run(2); Q.quiet(); });
      newRow('den', `${theme}: the den (a puddle on the ring floor): lurking (only eyes), an egg comes near, rises, hunts`);
      await shoot('lurking', await octAt(), 100);
      await ev(() => { Q.run(0.5); }); await shoot('+0.5 s', await octAt(), 100);
      await ev(() => { Q.egg(0, 2, -45); Q.until(() => Q.s.octos[0].ph === 'rise'); Q.run(0.15); }); await shoot('rising', await octAt(), 100);
      await ev(() => Q.run(0.35)); await shoot('risen', await octAt(), 100);
      await ev(() => Q.run(0.6)); await shoot('hunting', await octAt(), 100);
    }
  }

  // ---------------- level: the existing level, full phone screen
  let levelFiles = [];
  if (want('level')) {
    const { studioL13 } = await import(pathToFileURL(path.resolve(__dirname, 'octo-l13.mjs')).href);
    for (const mode of ['medium']) {
      const L = studioL13();
      await start(L, mode);
      await ev(() => { Q.park(0); Q.run(8.5); Q.quiet(); });
      const f1 = path.join(out, 'octo-level-lurk.png'); await p.screenshot({ path: f1 });
      await ev(() => { Q.egg(0, 2, -25); Q.until(() => ['seek', 'warn', 'squirt', 'grab'].includes(Q.s.octos[0].ph), 8); Q.run(0.5); Q.quiet(); });
      const f2 = path.join(out, 'octo-level-hunt.png'); await p.screenshot({ path: f2 });
      await ev(() => Q.until(() => Q.s.octos[0].ph === 'carry', 12)); await ev(() => { Q.run(0.6); Q.quiet(); });
      const f3 = path.join(out, 'octo-level-carry.png'); await p.screenshot({ path: f3 });
      levelFiles = [f1, f2, f3];
    }
  }

  // ---------------- sheets
  const k = await ev(() => Q.k());
  const W2 = +opt('w', 220);
  for (const [name, rows] of Object.entries(sheets)) {
    const html = `<html><body style="margin:0;background:#10202c;color:#e6f4ff;font:14px sans-serif;padding:8px"><div style="margin:0 0 8px">octopus ${name}: real phone scale (390x844 @2x; ~41 px per m on a 4-ring level, ~35 on 5-6 rings; crops shown at 2x)</div>${rows.map((r) => `<div style="margin-bottom:10px"><div style="font-weight:bold;margin:2px 0 4px">${r.name}</div><div style="display:flex;gap:6px;flex-wrap:wrap">${r.frames.map((x) => `<div><img style="width:${W2}px;display:block;border-radius:6px" src="data:image/png;base64,${fs.readFileSync(x.f).toString('base64')}"><div style="padding:2px">${x.label}</div></div>`).join('')}</div></div>`).join('')}</body></html>`;
    const p2 = await b.newPage({ viewport: { width: (W2 + 6) * 6 + 24, height: 400 } });
    await p2.setContent(html);
    await p2.screenshot({ path: path.join(out, `octo-${name}.png`), fullPage: true });
    await p2.close();
    for (const r of rows) for (const x of r.frames) fs.unlinkSync(x.f);
    console.log('-> ' + path.join(out, `octo-${name}.png`));
  }
  for (const f of levelFiles) console.log('-> ' + f);
  for (const e of errors) console.log('PAGE ERROR: ' + e);
  await b.close();
  srv.close();
  if (srvOld) srvOld.close();
})();
