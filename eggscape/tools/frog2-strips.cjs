// Frog round 2 QA (v3.5): film strips at real phone scale (390x844, DPR 2) from the live dev build, before vs after.
// Sheets: frog2-compare (old build next to new), frog2-tongue (lick, shot, catch, haul, gulp: orb and chick), frog2-states
// (normal, frozen, cracking, thawing, stunned, zapped), frog2-worlds (six worlds), frog2-contrast (every world), frog2-poses
// (big gallery, from tools/frog-strips.cjs), frog2-level (the studio level).
// Usage: node tools/frog2-strips.cjs [dist/dev] [outDir] [port=8961] [beforeDist] [beforePort=8962]
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const dir = path.resolve(args[0] || 'dist/dev');
const out = path.resolve(args[1] || 'qa/frog2');
const PORT = +(args[2] || 8961);
const BEFORE = args[3] ? path.resolve(args[3]) : null, BPORT = +(args[4] || PORT + 1);
const ONLY = process.env.ONLY || '';
const VW = 390, VH = 844, DPR = 2, CROP = 130;
fs.mkdirSync(out, { recursive: true });

const base = { eggs: 1, target: 1, time: 0, spacing: 1.05, material: 'vine', nest: { w: 2.6 }, seed: 77, tip: '', theme: 'bramble' };
const R4 = (g2) => [{ gaps: [{ a: 90 }] }, { gaps: [{ a: 90 }] }, { gaps: g2 || [{ a: 90 }] }, { gaps: [{ a: 90 }] }];
const STUDIO = {
  idle: { ...base, rings: R4(), frog: { ch: 2, a: -90, delay: 99 } },
  crouch: { ...base, rings: [{ gaps: [{ a: 90 }] }, { gaps: [{ a: 90 }] }, { gaps: [{ a: -90 }] }, { gaps: [{ a: 90 }] }], frog: { ch: 2, a: -100, delay: 0.3 } },
  orb: { ...base, rings: R4(), orbs: [{ type: 'fire_red', ch: 2, a: -75 }], frog: { ch: 2, a: -100, delay: 99 } },
  chick: { ...base, eggs: 2, rings: R4(), frog: { ch: 2, a: -100, delay: 99 } },
  plug: { ...base, rings: [{ gaps: [{ a: -90 }] }, { gaps: [{ a: -90 }] }, { gaps: [{ a: 90 }] }, { gaps: [{ a: 90 }] }], frog: { ch: 1, a: -90, delay: 99 } },
  level: { ...base, eggs: 2, rings: [{ gaps: [{ a: 90 }] }, { gaps: [{ a: -90 }, { a: 90 }] }, { gaps: [{ a: -60 }, { a: 140 }] }, { gaps: [{ a: -120 }, { a: 40 }] }, { gaps: [{ a: -80 }] }],
    orbs: [{ type: 'water', ch: 3, a: -60 }, { type: 'stone', ch: 2, a: -120 }], frog: [{ ch: 1, a: -90, delay: 99 }, { ch: 3, a: -100, delay: 99, face: -1 }, { ch: 2, a: -50, delay: 99 }] },
};
const WORLDS6 = [['bramble', 'vine'], ['reef', 'coral'], ['cove', 'darkwood'], ['frozen', 'ice'], ['volcano', 'obsidian'], ['farm', 'wood']];
const WORLDS = [['farm', 'wood'], ['barn', 'wood'], ['orchard', 'wood'], ['pumpkin', 'darkwood'], ['bramble', 'vine'], ['mushroom', 'mushroom'], ['crystal', 'glass'], ['frozen', 'ice'], ['blizzard', 'stone'], ['dunes', 'stone'], ['tomb', 'stone'],
  ['jungle', 'vine'], ['reef', 'coral'], ['cove', 'darkwood'], ['storm', 'cloud'], ['clock', 'metal'], ['haunted', 'bone'], ['volcano', 'obsidian'], ['dragon', 'gold'], ['vault', 'metal']];

const serve = (root, port) => http.createServer((q, r) => {
  const f = path.join(root, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); });
}).listen(port);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const img = (f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;
let SEQ = 0;

(async () => {
  const servers = [serve(dir, PORT)];
  if (BEFORE) servers.push(serve(BEFORE, BPORT));
  const b = await chromium.launch();
  const errors = [];
  const open = async (port) => {
    const p = await b.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR });
    p.on('pageerror', (e) => errors.push(String(e)));
    await p.goto(`http://localhost:${port}/`);
    await p.waitForTimeout(900);
    return p;
  };
  const P1 = await open(PORT), P0 = BEFORE ? await open(BPORT) : null;

  // a lab = one page; setup(spec) starts the studio level and installs Q
  const setup = (p, L, keepEggs) => p.evaluate(([L, keepEggs]) => {
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
      park() { for (const e of E.G.sim.eggs) if (e.body) { e.body.setTransform({ x: 0, y: 0.1 }, 0); e.body.setLinearVelocity({ x: 0, y: 0 }); e.body.setType('static'); } },
      hold(i, x, y) { const e = E.G.sim.eggs[i]; e.body.setType('static'); e.body.setTransform({ x, y }, 0); },
      until(f, max = 6) { for (let i = 0; i < max * 60 && !f(); i++) E.frame(1 / 60); },
    };
    if (E.G.sim.level.eggs > 0 && !keepEggs) Q.park();
    Q.run(0.4);
  }, [L, !!keepEggs]);

  // a row of cropped screenshots around a world point
  const Row = (p, name) => {
    const frames = [];
    let anchor = null;
    return {
      frames, name,
      async shoot(label, world, dy = 0) {
        if (world) anchor = world;
        const at = await p.evaluate((w) => Q.scr(w.x, w.y), anchor);
        const cx = Math.round(Math.min(Math.max(at.x, CROP / 2), VW - CROP / 2)), cy = Math.round(Math.min(Math.max(at.y + dy, CROP / 2), VH - CROP / 2));
        const f = path.join(out, `_f${SEQ++}.png`);
        await p.screenshot({ path: f, clip: { x: cx - CROP / 2, y: cy - CROP / 2, width: CROP, height: CROP } });
        frames.push({ f, label });
      },
    };
  };
  const foot = (p) => p.evaluate(() => { const F = Q.F(); return { x: F.x, y: F.y }; });
  const step = (p, s) => p.evaluate((s) => Q.run(s), s);
  const sheet = async (fileName, rows, per = 8) => {
    const W2 = CROP * 2;
    const html = `<html><body style="margin:0;background:#1d1712;color:#f5e6c8;font:14px sans-serif;padding:8px">${rows.map((r) => `<div style="margin-bottom:10px"><div style="font-weight:bold;margin:2px 0 4px">${esc(r.name)}</div><div style="display:flex;flex-wrap:wrap;gap:6px">${r.frames.map((x) => `<div><img style="width:${W2}px;display:block;border-radius:6px" src="${img(x.f)}"><div style="padding:2px">${esc(x.label)}</div></div>`).join('')}</div></div>`).join('')}</body></html>`;
    const p2 = await b.newPage({ viewport: { width: Math.round((W2 + 6) * per + 20), height: 400 } });
    await p2.setContent(html);
    await p2.screenshot({ path: path.join(out, fileName), fullPage: true });
    await p2.close();
    for (const r of rows) for (const x of r.frames) fs.unlinkSync(x.f);
  };

  // ---------- scenarios (each works on either build)
  const sIdle = async (p, L, row, labelPrefix = '') => { await setup(p, L); await row.shoot(labelPrefix + 'idle', await foot(p), -8); };
  const sCrouch = async (p, L, row, pre = '') => {
    await setup(p, L); await p.evaluate(() => Q.until(() => Q.F().ph === 'crouch'));
    const w = await foot(p); await step(p, 0.35); await row.shoot(pre + 'crouch', w, -8);
  };
  const sTongue = async (p, L, row, pre = '', all = false, kind = 'orb') => {
    await setup(p, L, kind === 'chick');
    if (kind === 'chick') await p.evaluate(() => { const s = __egg.G.sim, F = Q.F(), e = s.eggs[1]; e.body.setType('dynamic'); s.hatch(e); const a = F.wa + 0.45, r = F.rf - 0.5; Q.hold(1, r * Math.cos(a), r * Math.sin(a)); F.lickCD = 0; Q.until(() => Q.F().ph === 'lick'); });
    else await p.evaluate(() => { Q.F().lickCD = 0; Q.until(() => Q.F().ph === 'lick'); });
    const w = await foot(p);
    if (all) await row.shoot(pre + 'lick', w, -8);
    await step(p, 0.3);
    if (all) await row.shoot(pre + 'licking', null, -8);
    await p.evaluate(() => Q.until(() => Q.F().ph === 'tongue'));
    await step(p, 0.05); await row.shoot(pre + 'tongue out', w, -8);
    if (all) { await step(p, 0.06); await row.shoot(pre + 'grab', null, -8); }
    await step(p, all ? 0.05 : 0.11); await row.shoot(pre + 'haul back', null, -8);
    if (all) { await step(p, 0.06); await row.shoot(pre + 'into mouth', null, -8); }
    await p.evaluate(() => Q.until(() => Q.F().ph === 'gulp'));
    await step(p, 0.12); await row.shoot(pre + 'gulp', w, -8);
    if (all) { await step(p, 0.2); await row.shoot(pre + 'gulp 2', null, -8); await step(p, 0.5); await row.shoot(pre + 'done', null, -8); }
  };

  // ---------- 1. before / after
  if (!ONLY || ONLY === 'compare') {
    const rows = [];
    for (const [tid, mat] of [['bramble', 'vine'], ['reef', 'coral']]) {
      const row = { name: `before | after: ${tid}`, frames: [] };
      for (const [P, tag] of P0 ? [[P0, 'BEFORE '], [P1, 'AFTER ']] : [[P1, 'AFTER ']]) {
        const R = Row(P, '');
        const L = (n) => ({ ...STUDIO[n], theme: tid, material: mat });
        await sIdle(P, L('idle'), R, tag);
        await sCrouch(P, L('crouch'), R, tag);
        await sTongue(P, L('orb'), R, tag);
        row.frames.push(...R.frames);
      }
      rows.push(row);
    }
    await sheet('frog2-compare.png', rows, 6);
  }
  // ---------- 2. tongue sequence
  if (!ONLY || ONLY === 'tongue') {
    const rows = [];
    for (const [kind, spec, tid, mat] of [['orb', 'orb', 'cove', 'darkwood'], ['chick', 'chick', 'bramble', 'vine']]) {
      const R = Row(P1, `tongue: ${kind} (${tid})`);
      await sTongue(P1, { ...STUDIO[spec], theme: tid, material: mat }, R, '', true, kind);
      rows.push(R);
    }
    await sheet('frog2-tongue.png', rows, 5);
  }
  // ---------- 3. states
  if (!ONLY || ONLY === 'states') {
    const rows = [];
    for (const [tid, mat] of [['cove', 'darkwood'], ['frozen', 'ice'], ['bramble', 'vine']]) {
      const R = Row(P1, `states on ${tid}: normal, frozen (freeze in, hold, cracks, thaw), stunned (zap flash, dizzy, recover)`);
      await setup(P1, { ...STUDIO.idle, theme: tid, material: mat });
      const w = await foot(P1);
      await R.shoot('normal', w, -8);
      await P1.evaluate(() => __egg.G.sim.frogHit('ice', 3));
      for (const [s, lab] of [[0.06, 'ice forms'], [0.3, 'frozen'], [1.4, 'held'], [1.0, 'cracks'], [0.35, 'cracks more']]) { await step(P1, s); await R.shoot(lab, null, -8); }
      for (const [s, lab] of [[0.12, 'thaw: shards'], [0.2, 'shards fall'], [0.25, 'shakes off'], [0.5, 'free']]) { await step(P1, s); await R.shoot(lab, null, -8); }
      await P1.evaluate(() => __egg.G.sim.frogHit('zap', 3));
      for (const [s, lab] of [[0.04, 'zap: arcs + flash'], [0.14, 'zap: arcs'], [0.2, 'dizzy in'], [0.45, 'dizzy'], [0.3, 'dizzy'], [1.4, 'dizzy'], [1.2, 'wakes']]) { await step(P1, s); await R.shoot(lab, null, -8); }
      rows.push(R);
    }
    await sheet('frog2-states.png', rows, 7);
  }
  // ---------- 4. worlds
  const worlds = async (list, fileName, name, per) => {
    const R = Row(P1, name);
    for (const [tid, mat] of list) {
      await setup(P1, { ...STUDIO.idle, theme: tid, material: mat });
      await step(P1, 0.2);
      await R.shoot(`${tid} / ${mat}`, await foot(P1), -8);
    }
    await sheet(fileName, [R], per);
  };
  if (!ONLY || ONLY === 'worlds') {
    await worlds(WORLDS6, 'frog2-worlds.png', 'the frog on six worlds', 6);
    await worlds(WORLDS, 'frog2-contrast.png', 'contrast check: the frog on every world', 7);
  }
  // ---------- 5. level view, hop
  if (!ONLY || ONLY === 'level') {
    await setup(P1, STUDIO.level, true);
    await step(P1, 1.5);
    await P1.screenshot({ path: path.join(out, 'frog2-level.png') });
  }
  for (const e of errors) console.log('PAGE ERROR: ' + e);
  console.log('-> ' + out);
  await b.close();
  servers.forEach((s) => s.close());
})();
