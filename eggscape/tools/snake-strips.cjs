// Snake QA: film strips at real phone scale (390x844 css, DPR 2) from the live dev build.
// Sheets: start (the first 4 s after a snake comes in, in real snake levels), motion (slither, strike, venom spit),
// states (stunned by a thunderclap, a rooster crow and a rival clash; frozen, its last second and the thaw),
// skins (every skin and kind, the boss crown, at real scale and 2x).
// Usage: node tools/snake-strips.cjs [dist/dev] [outDir=qa/snake] [sheets=start,motion,states,skins] [--port=8971] [--tag=after]
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flag = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const dir = path.resolve(args[0] || 'dist/dev');
const out = path.resolve(args[1] || 'qa/snake');
const sheets = (args[2] || 'start,motion,states,skins').split(',');
const PORT = +flag('port', 8971), TAG = flag('tag', '');
const VW = 390, VH = 844, DPR = 2, CROP = 170;
fs.mkdirSync(out, { recursive: true });

// studio vault: 4 rings, one egg resting in channel 2, the snake comes in from the top
const base = { eggs: 1, target: 1, time: 0, spacing: 1.05, material: 'wood', nest: { w: 2.6 }, seed: 77, tip: '', theme: 'bramble' };
const vault = (snake, extra = {}) => ({ ...base, rings: [{ gaps: [{ a: 90 }] }, { gaps: [{ a: 200 }] }, { gaps: [{ a: 20 }] }, { gaps: [{ a: 160 }] }], snake, ...extra });

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
  await p.evaluate(() => {
    window.Q = {
      begin(L, mode = 'medium') {
        const E = __egg;
        E.setSave({ mode, calm: false, seen: {} });
        if (typeof L === 'number') E.start(L, { direct: true });
        else { E.G.demo = { id: 990, name: 'Studio', ...L }; E.start(-2, { direct: true }); }
        E.G.paused = true; // only our frames drive it (the page's own loop would add real time between shots)
        Q.quiet();
      },
      quiet() { const G = __egg.G; G.toast = null; G.toasts.length = 0; G.card = null; G.hint = null; if (G.popups) G.popups.length = 0; },
      scr(x, y) { const G = __egg.G, P = G.play; return { x: P.x + P.w / 2 + (x - G.cam.x) * G.cam.k, y: P.y + P.h / 2 - (y - G.cam.y) * G.cam.k }; },
      run(s) { for (let i = 0; i < Math.round(s * 60); i++) { __egg.frame(1 / 60); Q.quiet(); } },
      S(i = 0) { return __egg.G.sim.snakes[i]; },
      // the snake's middle (or head) on screen
      at(i = 0, part = 'mid') {
        const S = Q.S(i), T = S.pts;
        if (!T.length) { return Q.scr(S.rad * Math.cos(S.a), S.rad * Math.sin(S.a)); }
        if (part === 'head') return Q.scr(T[0].x, T[0].y);
        let x = 0, y = 0;
        for (const q of T) { x += q.x; y += q.y; }
        return Q.scr(x / T.length, y / T.length);
      },
      // fast-forward until the snake is about to come in
      toEntry(i = 0, lead = 0) { for (let n = 0; n < 60 * 40 && Q.S(i).wait > lead; n++) Q.run(1 / 60); },
      // an egg resting on the floor of channel c at world angle a (deg)
      egg(c, a, j = 0) { const s = __egg.G.sim, e = s.eggs[j], R = s.rings[c], r = R.r - 0.08 - 0.3, w = (a * Math.PI) / 180; e.body.setTransform({ x: r * Math.cos(w), y: r * Math.sin(w) }, 0); e.body.setLinearVelocity({ x: 0, y: 0 }); e.body.setAngularVelocity(0); return e; },
      // lay the snake down whole in channel c, head at world angle a (deg), heading ccw (dir 1) or cw (-1)
      // lay it facing the way it will crawl (auto), or forced (fixed: true) to make it turn back on itself
      lay(c, a, dir = 1, i = 0, fixed = false) {
        Q.lay0(c, a, dir, i);
        if (fixed) return;
        const S = Q.S(i), a0 = S.a;
        for (let k = 0; k < 4; k++) __egg.G.sim.step();
        const moved = Math.atan2(Math.sin(S.a - a0), Math.cos(S.a - a0));
        if (moved * dir < -1e-4) Q.lay0(c, a, -dir, i); else if (moved * dir <= 1e-4) Q.lay0(c, a, dir, i);
        else Q.lay0(c, a, dir, i);
      },
      lay0(c, a, dir = 1, i = 0) {
        const s = __egg.G.sim, S = Q.S(i), R = s.rings, r = c >= R.length ? s.outerR + 0.35 : (R[c - 1].r + R[c].r) / 2, m = Math.ceil(S.len / 0.05) + 1;
        S.rad = r; S.a = (a * Math.PI) / 180; S.pts = []; S.wait = 0; S.inside = true;
        for (let k = 0; k < m; k++) S.pts.push(s.trailPt(S, {}, S.a - dir * (k * 0.05) / r, r));
      },
      hold() { for (const R of __egg.G.sim.rings) { R.target = R.body.getAngle(); R.body.setAngularVelocity(0); } },
    };
  });
  const ev = (fn, a) => p.evaluate(fn, a);
  const shot = async (name, at, crop = CROP) => {
    const cx = Math.round(Math.min(Math.max(at.x, crop / 2), VW - crop / 2)), cy = Math.round(Math.min(Math.max(at.y, crop / 2), VH - crop / 2));
    const f = path.join(out, `_${name}.png`);
    await p.screenshot({ path: f, clip: { x: cx - crop / 2, y: cy - crop / 2, width: crop, height: crop } });
    return f;
  };
  const sheet = async (file, title, rows, scale = 1.5) => {
    const maxN = Math.max(...rows.map((r) => r.frames.length)), cw = Math.max(...rows.flatMap((r) => r.frames.map((f) => f.w || CROP)));
    const html = `<html><body style="margin:0;background:#1d1712;color:#f5e6c8;font:14px sans-serif;padding:8px"><div style="font-weight:bold;font-size:17px;margin-bottom:8px">${title}</div>${rows.map((r) => `<div style="margin-bottom:10px"><div style="font-weight:bold;margin:2px 0 4px">${r.name}</div><div style="display:flex;gap:6px">${r.frames.map((x) => `<div><img style="width:${(x.w || CROP) * scale}px;display:block;border-radius:6px" src="data:image/png;base64,${fs.readFileSync(x.f).toString('base64')}"><div style="padding:2px;max-width:${(x.w || CROP) * scale}px">${x.label}</div></div>`).join('')}</div></div>`).join('')}</body></html>`;
    const p2 = await b.newPage({ viewport: { width: Math.round((cw * scale + 6) * maxN + 24), height: 400 } });
    await p2.setContent(html);
    await p2.screenshot({ path: path.join(out, file), fullPage: true });
    await p2.close();
    for (const r of rows) for (const x of r.frames) { try { fs.unlinkSync(x.f); } catch (e) { /* shared */ } }
    console.log('-> ' + path.join(out, file));
  };
  const sfx = TAG ? `-${TAG}` : '';

  if (sheets.includes('start')) {
    // the first 4 s of a snake in real levels (Medium): from 0.2 s before it starts moving, every 0.5 s
    const rows = [];
    for (const [id, mode, si] of [[12, 'medium', 0], [13, 'medium', 0], [18, 'medium', 0], [10, 'medium', 0], [10, 'medium', 1], [12, 'easy', 0]]) {
      await ev(([id, mode]) => { const i = __egg.LEVELS.findIndex((L) => L.id === id); Q.begin(i, mode); }, [id, mode]);
      await ev((si) => { Q.toEntry(si, 1); }, si);
      const frames = [];
      const lab = await ev((si) => { const S = Q.S(si); return `v ${S.speed.toFixed(2)} m/s, len ${S.len.toFixed(1)} m`; }, si);
      // fixed crop: where the head will be 1.5 s after it starts moving (the same spot for before and after)
      for (let k = 0; k <= 8; k++) {
        const at = await ev((si) => { const S = Q.S(si); return S.pts.length ? Q.at(si, 'head') : Q.scr((S.rad - 0.3) * Math.cos(S.a), (S.rad - 0.3) * Math.sin(S.a)); }, si);
        frames.push({ f: await shot(`st${id}${si}${k}`, at, 200), w: 200, label: `${(k * 0.5 - 1).toFixed(1)} s` });
        await ev(() => Q.run(0.5));
      }
      rows.push({ name: `L${id} ${mode}${si ? ' (2nd snake)' : ''}: ${lab}`, frames });
    }
    await sheet(`start${sfx}.png`, 'Snake entry: from 1 s before it starts moving (its level delay ends at 0 s) to 3 s after (real scale crops on the head, shown 1.25x)', rows, 1.25);
  }

  if (sheets.includes('motion')) {
    const rows = [];
    // slither: a free run along channel 3 with nothing to hunt (egg out of reach in the centre)
    await ev((L) => { Q.begin(L); Q.egg(1, -90); Q.lay(3, 30, 1); Q.hold(); Q.run(0.3); }, vault({ delay: 0, speed: 0.45 }));
    let fr = [];
    for (let k = 0; k < 7; k++) { fr.push({ f: await shot(`sl${k}`, await ev(() => Q.at(0, 'mid'))), label: `${(k * 0.25).toFixed(2)} s` }); await ev(() => Q.run(0.25)); }
    rows.push({ name: 'slither (Medium speed, channel 3)', frames: fr });
    // hairpin: it turns back on itself (tight bend, body over body)
    await ev((L) => { Q.begin(L); Q.egg(1, -90); Q.lay(3, 30, 1, 0, true); Q.hold(); Q.run(0.3); }, vault({ delay: 0, speed: 0.45 }));
    fr = [];
    for (let k = 0; k < 6; k++) { fr.push({ f: await shot(`hp${k}`, await ev(() => Q.at(0, 'head'))), label: `${(k * 0.4).toFixed(1)} s` }); await ev(() => Q.run(0.4)); }
    rows.push({ name: 'hairpin: turning back on itself', frames: fr });
    // strike: the egg rests just ahead in the same channel
    await ev((L) => { Q.begin(L); Q.egg(2, -90); Q.lay(2, -62, -1); Q.hold(); Q.run(1 / 60); }, vault({ delay: 0, speed: 0.45 }));
    fr = [];
    const until = (cond, max = 3) => ev(([c, m]) => { for (let i = 0; i < m * 60 && !eval(c); i++) Q.run(1 / 60); }, [cond, max]);
    const sk = async (lab) => fr.push({ f: await shot(`sk${fr.length}`, await ev(() => Q.at(0, 'head'))), label: lab });
    await sk('closing in');
    await until('Q.S().mouthOpen > 0.3'); await sk('hunting: mouth opens');
    await until('Q.S().strike > 0'); await sk('in range: coils');
    await ev(() => Q.run(0.15)); await sk('coiled');
    await until('Q.S().lunge > 0'); await ev(() => Q.run(0.04)); await sk('bite');
    await ev(() => Q.run(0.12)); await sk('');
    await ev(() => Q.run(0.3)); await sk('chew');
    await ev(() => Q.run(0.6)); await sk('grin');
    rows.push({ name: 'strike', frames: fr });
    // spitter rears and spits at a wall
    await ev((L) => { Q.begin(L); Q.egg(1, 70); Q.lay(2, 130, -1); Q.hold(); Q.S().vsT = 0.2; Q.run(1 / 60); }, vault({ delay: 0, speed: 0.45, kind: 'spitter' }));
    fr = [];
    for (let k = 0; k < 7; k++) { fr.push({ f: await shot(`sp${k}`, await ev(() => Q.at(0, 'head'))), label: `${(k * 0.18).toFixed(2)} s` }); await ev(() => Q.run(0.18)); }
    rows.push({ name: 'spitter: rear and spit', frames: fr });
    await sheet(`motion${sfx}.png`, 'Snake motion (real scale crops, shown 1.5x)', rows);
  }

  if (sheets.includes('states')) {
    const rows = [];
    const L = vault({ delay: 0, speed: 0.45 });
    const setup = async (fn) => { await ev((L) => { Q.begin(L); Q.egg(1, -90); Q.lay(3, 60, 1); Q.hold(); Q.run(0.6); }, L); if (fn) await ev(fn); };
    const film = async (name, steps, part = 'head') => {
      const fr = [];
      for (const [lab, dt] of steps) {
        if (dt) await ev((d) => Q.run(d), dt);
        const st = await ev(() => { const S = Q.S(); return S.stun > 0 ? ` (stun ${S.stun.toFixed(2)})` : ''; });
        fr.push({ f: await shot(`${name}${fr.length}`, await ev((p) => Q.at(0, p), part)), label: lab + st });
      }
      rows.push({ name, frames: fr });
    };
    await setup();
    await film('normal', [['crawl', 0], ['', 0.2], ['', 0.2]]);
    await setup(() => { const s = __egg.G.sim; s.p2Snake(Q.S(), 'bolt', 5); });
    await film('stunned: thunderclap (zap first)', [['0.05 s', 0.05], ['0.2 s', 0.15], ['0.5 s', 0.3], ['1 s', 0.5], ['2 s', 1], ['3 s', 1], ['wakes', 2.3]]);
    await setup(() => { const S = Q.S(); S.stun = 3; S.hurt = 'crow'; S.mood = 'shock'; S.moodT = 0.5; });
    await film('stunned: rooster crow', [['0.1 s', 0.1], ['0.6 s', 0.5], ['1.2 s', 0.6], ['2 s', 0.8], ['wakes', 1.3]]);
    await setup(() => { const S = Q.S(); S.stun = 2.2; S.hurt = 'clash'; S.knock = 0.6; S.mood = 'ouch'; S.moodT = 0.5; S.mouthOpen = 1; });
    await film('stunned: rival clash', [['0.1 s', 0.1], ['0.5 s', 0.4], ['1 s', 0.5], ['1.6 s', 0.6]]);
    await setup(() => { __egg.G.sim.p2Snake(Q.S(), 'ice', 4); });
    await film('frozen (4 s)', [['0.1 s', 0.1], ['0.4 s', 0.3], ['2 s', 1.6], ['3.2 s: cracks', 1.2], ['3.7 s', 0.5], ['3.95 s', 0.25], ['thaw', 0.15], ['shake off', 0.3]]);
    await setup(() => { __egg.G.sim.p2Snake(Q.S(), 'ice', 4); });
    await film('frozen: whole body', [['0.5 s', 0.5], ['3.5 s', 3]], 'mid');
    await sheet(`states${sfx}.png`, 'Snake states (real scale crops, shown 1.5x)', rows);
  }

  if (sheets.includes('skins')) {
    const rows = [];
    for (const [scale, crop] of [[1, CROP], [2, 120]]) {
      const fr = [];
      for (const [lab, sn] of [['violet (Mooncoil)', { skin: 'violet' }], ['emerald (fast)', { kind: 'fast' }], ['amber (constrictor)', { kind: 'constrictor' }], ['crimson (spitter)', { kind: 'spitter' }], ['boss (crowned)', { size: 1.5, len: 1.6 }], ['small (0.8)', { size: 0.8 }], ['reuse: eel palette', { skin: 'eel' }], ['reuse: vine palette', { skin: 'vine' }]]) {
        await ev(([L]) => { Q.begin(L); Q.egg(1, -90); Q.lay(3, 50, 1); Q.hold(); Q.run(0.5); }, [vault({ delay: 0, speed: 0.45, ...sn }, sn.size > 1.2 ? { boss: 'snake' } : {})]);
        const at = await ev(() => Q.at(0, 'head'));
        if (scale === 1) fr.push({ f: await shot(`sk${fr.length}`, at), label: lab });
        else {
          const f = path.join(out, `_skz${fr.length}.png`);
          await p.screenshot({ path: f, clip: { x: Math.round(at.x - crop / 2), y: Math.round(at.y - crop / 2), width: crop, height: crop } });
          fr.push({ f, w: crop, label: lab });
        }
      }
      rows.push({ name: scale === 1 ? 'real scale (shown 1.5x)' : 'zoomed (shown 3x)', frames: fr, scale });
    }
    // two sheets in one: real scale at 1.5x, the zoom row at 3x
    await sheet(`skins${sfx}.png`, 'Snake skins and kinds', [rows[0]]);
    // (zoomed row as its own sheet)
    await sheet(`skins-zoom${sfx}.png`, 'Snake heads zoomed', [rows[1]], 3);
  }

  for (const e of errors) console.log('PAGE ERROR: ' + e);
  await b.close();
  srv.close();
})();
