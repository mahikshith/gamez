// Den fox QA (v3.5): strip sheets at real phone scale (390x844, DPR 2) from the live dev build.
//   rig.png      every rig pose at real level scale and close up, the frozen / cracking / zap / stunned states beside
//                the normal pose
//   pounce.png   a pounce through a lined-up gap (telegraph, leap, grab, back out, carry, stash) and a blocked pounce
//   trap.png     a fox caught in the inner channel: the gap turned away, trapped, hit by a falling egg, stunned;
//                frozen and zapped in the level beside the normal pose
//   faces.png    the old fox art beside the new face (one design everywhere), the new boss cards
//   insitu.png   the new face where it appears: boss intro cards, a normal level's thrower, title, win, fail
//   level.png    full phone screens of the den levels
// Usage: node tools/fox-strips.cjs [dist/dev] [outDir=qa/fox] [--port=9001]
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const PORT = +((process.argv.find((a) => a.startsWith('--port=')) || '').split('=')[1] || 9001);
const dir = path.resolve(args[0] || 'dist/dev');
const out = path.resolve(args[1] || 'qa/fox');
const SPRITES = path.resolve(__dirname, '../assets/sprites');
const VW = 390, VH = 844, DPR = 2, CROP = 170;
fs.mkdirSync(out, { recursive: true });

const srv = http.createServer((q, r) => {
  const f = path.join(dir, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); });
}).listen(PORT);

const b64 = (buf) => 'data:image/png;base64,' + buf.toString('base64');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(`http://localhost:${PORT}/`);
  await p.waitForTimeout(900);
  const ev = (fn, ...a) => p.evaluate(fn, ...a);
  await ev(() => {
    const E = __egg;
    window.Q = {
      get s() { return E.G.sim; },
      get F() { return E.G.sim.den; },
      scr(x, y) { const G = E.G, P = G.play; return { x: P.x + P.w / 2 + (x - G.cam.x) * G.cam.k, y: P.y + P.h / 2 - (y - G.cam.y) * G.cam.k }; },
      run(s) { for (let i = 0; i < Math.round(s * 60); i++) E.frame(1 / 60); },
      until(f, max = 20) { for (let i = 0; i < max * 60 && !f(); i++) E.frame(1 / 60); return !!f(); },
      quiet() { E.G.toast = null; E.G.toasts.length = 0; },
      setRing(i, deg) { const R = E.G.sim.rings[i], a = (deg * Math.PI) / 180; R.body.setTransform(R.body.getPosition(), a); R.target = a; R.body.setAngularVelocity(0); },
      egg(i, ch, a) { const e = E.G.sim.eggs[i], R = E.G.sim.rings[ch], r = R.r - 0.08 - 0.3, w = (a * Math.PI) / 180; e.body.setTransform({ x: r * Math.cos(w), y: r * Math.sin(w) }, w); e.body.setLinearVelocity({ x: 0, y: 0 }); e.body.setAngularVelocity(0); e.ch = ch; return e; },
      // the fox on the den-run floor at world angle deg, ready to hunt
      fox(deg, ph = 'prowl') { const F = E.G.sim.den, s = E.G.sim; F.a = (deg * Math.PI) / 180; F.r = s.denFloor(s.rings.length - 1); F.ch = s.rings.length - 1; F.carA = s.rings[s.rings.length - 1].body.getAngle(); s.denSet(ph); F.next = 0; },
      body() { return E.G.sim.denBody(); },
      start(kind, mode) { E.setSave({ mode, calm: false, seen: {}, intro: {} }); E.startDemo(kind, { direct: true }); Q.run(0.2); },
    };
  });
  const tmp = path.join(out, '_tmp');
  fs.mkdirSync(tmp, { recursive: true });
  let shotN = 0;
  // a crop of the phone screen around a world point (CROP css px square)
  const crop = async (pt, size = CROP) => {
    const c = await ev((pt) => Q.scr(pt.x, pt.y), pt);
    const x = Math.max(0, Math.min(VW - size, c.x - size / 2)), y = Math.max(0, Math.min(VH - size, c.y - size / 2));
    return p.screenshot({ clip: { x, y, width: size, height: size } });
  };
  const full = () => p.screenshot();
  const at = (fn, arg) => ev(fn, arg);
  const cell = async (cap, pt) => ({ cap, img: await crop(pt || (await at(() => Q.body()))) });

  // ---------- the rig: an in-page canvas gallery at two scales
  const POSES = [
    { st: 'idle', t: 0.5, egg: 1, cap: 'idle (egg for scale)' }, { st: 'idle', t: 1.7, cap: 'idle sniff' }, { st: 'prowl', odo: 0, cap: 'prowl 1' }, { st: 'prowl', odo: 0.12, cap: 'prowl 2' }, { st: 'prowl', odo: 0.24, cap: 'prowl 3' }, { st: 'stalk', odo: 0.1, cap: 'stalk' },
    { st: 'crouch', u: 0.2, o: { eye: 'lock' }, cap: 'crouch: wiggle' }, { st: 'crouch', u: 0.85, o: { eye: 'lock' }, cap: 'crouch: eyes lock' }, { st: 'leap', u: 0.15, o: { eye: 'lock' }, cap: 'leap: push off' }, { st: 'leap', u: 0.5, o: { eye: 'lock' }, cap: 'leap: stretched' }, { st: 'leap', u: 0.9, cap: 'leap: land' }, { st: 'grab', u: 0.5, egg: 2, cap: 'grab' },
    { st: 'carry', odo: 0.1, egg: 2, cap: 'carry (egg in jaws)' }, { st: 'toss', u: 0.5, cap: 'toss: wind up' }, { st: 'toss', u: 0.95, cap: 'toss: throw' }, { st: 'trapped', t: 1.1, o: { eye: 'wide', sweat: 1 }, cap: 'trapped: scrabble' }, { st: 'hurt', u: 0.5, o: { eye: 'squeeze' }, cap: 'hurt' }, { st: 'laugh', o: { eye: 'happy' }, cap: 'laugh (stashed)' },
    { st: 'bonk', u: 0.2, o: { eye: 'squeeze', stars: 2 }, cap: 'bonk (blocked)' }, { st: 'defeated', odo: 0.1, o: { eye: 'squeeze', tears: 1 }, cap: 'defeated, runs off' },
    { st: 'idle', t: 1.1, cap: 'NORMAL' }, { st: 'idle', t: 1.1, o: { frozen: 3 }, cap: 'FROZEN' }, { st: 'idle', t: 1.1, o: { frozen: 0.5 }, cap: 'FROZEN: last second, cracks' }, { st: 'stunned', t: 1.1, o: { zap: 1, eye: 'spiral' }, cap: 'ZAP: 0.3 s arcs' }, { st: 'stunned', t: 1.1, o: { eye: 'spiral', stars: 3 }, cap: 'STUNNED' },
  ];
  const gallery = (k, cols) => ev(([k, POSES, cols]) => {
    const A = __egg.foxArt, DPR = 2, cw = Math.round(Math.max(2.3 * k, 120)), chh = Math.round(1.3 * k) + 30, rows = Math.ceil(POSES.length / cols);
    const c = document.createElement('canvas');
    c.width = cw * cols * DPR; c.height = chh * rows * DPR;
    const ctx = c.getContext('2d');
    ctx.scale(DPR, DPR);
    POSES.forEach((q, i) => {
      const x0 = (i % cols) * cw, y0 = Math.floor(i / cols) * chh, fl = y0 + chh - 18 - 0.15 * k;
      ctx.fillStyle = (i + Math.floor(i / cols)) % 2 ? '#a9d4f0' : '#9cc8e8'; ctx.fillRect(x0, y0, cw, chh);
      ctx.fillStyle = '#8a5a2e'; ctx.fillRect(x0, fl, cw, 0.16 * k); // the ring floor
      ctx.fillStyle = '#5b3a1c'; ctx.fillRect(x0, fl + 0.16 * k - 1, cw, 1);
      const t = q.t ?? 1.3, pose = A.foxPose(q.st, t, q.u ?? 0.5, q.odo ?? 0);
      if (q.egg === 1) { ctx.fillStyle = '#fff8ea'; ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x0 + cw * 0.12, fl - 0.27 * k, 0.2 * k, 0.27 * k, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      A.drawDenFox(ctx, x0 + cw * 0.52, fl, A.FOXRIG.torso * k, t, pose, q.o || {});
      if (q.egg === 2) { const mx = x0 + cw * 0.52 + A.FOXRIG.mouthX * A.FOXRIG.torso * k * 1.0, my = fl - A.FOXRIG.mouthY * k; ctx.fillStyle = '#fff8ea'; ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(mx, my, 0.27 * k, 0.2 * k, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = '#0d1b2a'; ctx.font = '600 11px sans-serif'; ctx.textBaseline = 'alphabetic'; ctx.fillText(q.cap, x0 + 4, y0 + chh - 5);
    });
    return c.toDataURL('image/png');
  }, [k, POSES, cols]);
  const realK = await ev(() => { Q.start('foxden', 'medium'); return __egg.G.cam.k; });
  const rigReal = await gallery(realK, 6);
  const rigClose = await gallery(110, 5);

  // ---------- pounce: the gap of ring 3 (gap 1, a plain 0.95 m gap at ring-local 150 deg) lined up at world -75 deg
  const setup = (mode) => ev((mode) => {
    Q.start('foxden', mode);
    Q.setRing(3, 135); // gap 1 at world -75
    Q.egg(0, 3, -95); // the egg rests at the bottom of channel 3, about a metre from the gap
    Q.fox(-20);
    Q.run(0.6); Q.quiet();
  }, mode);
  const P = [];
  await setup('medium');
  P.push(await cell('prowl toward the gap'));
  await at(() => Q.until(() => Q.F.ph === 'crouch' || Q.F.ph === 'stalk'));
  P.push(await cell('stalk'));
  await at(() => { Q.until(() => Q.F.ph === 'crouch'); Q.run(Q.F.dur * 0.3); Q.quiet(); });
  P.push(await cell('crouch: wiggle, paw mark, arc'));
  await at(() => { Q.run(Math.max(0, Q.F.t - 0.15)); Q.quiet(); });
  P.push(await cell('eyes lock, about to go'));
  await at(() => { Q.until(() => Q.F.ph === 'leap'); Q.run(Q.F.ldur * 0.3); });
  P.push(await cell('leap through the gap'));
  await at(() => { Q.run(Q.F.ldur * 0.4); });
  P.push(await cell('leap: landing'));
  await at(() => { Q.until(() => Q.F.ph === 'grab'); Q.run(0.1); });
  P.push(await cell('grab: "Snatched!"'));
  await at(() => { Q.until(() => Q.F.ph === 'inner'); Q.run(0.3); Q.quiet(); });
  P.push(await cell('back to the gap, egg in jaws'));
  await at(() => { Q.until(() => Q.F.ph === 'leap'); Q.run(Q.F.ldur * 0.5); });
  P.push(await cell('hop out'));
  await at(() => { Q.until(() => Q.F.ph === 'carry'); Q.run(0.8); Q.quiet(); });
  P.push(await cell('carry to the den'));
  await at(() => { Q.until(() => Q.F.ph === 'stash', 15); Q.run(0.3); Q.quiet(); });
  P.push(await cell('stash in the den'));
  await at(() => { Q.until(() => Q.F.ph === 'laugh'); Q.run(0.3); Q.quiet(); });
  P.push(await cell('laugh: "Stashed!"'));

  const BL = [];
  await setup('medium');
  await at(() => { Q.until(() => Q.F.ph === 'crouch'); Q.run(Q.F.dur * 0.4); Q.quiet(); });
  BL.push(await cell('crouch: gap lined up'));
  await at(() => { Q.setRing(3, 160); Q.run(0.08); Q.quiet(); });
  BL.push(await cell('player turns the ring: grey X'));
  await at(() => { Q.until(() => Q.F.ph === 'leap'); Q.until(() => Q.F.blocked, 2); Q.run(0.03); });
  BL.push(await cell('leaps anyway: bonk'));
  await at(() => { Q.until(() => Q.F.ph === 'bonk'); Q.run(0.25); });
  BL.push(await cell('"Blocked!" dizzy'));
  await at(() => { Q.run(0.6); Q.quiet(); });
  BL.push(await cell('shakes it off'));
  // the easy telegraph: a longer crouch
  const EZ = [];
  for (const mode of ['easy', 'medium', 'hard']) {
    await setup(mode);
    const d = await at(() => { Q.until(() => Q.F.ph === 'crouch'); const d = Q.F.dur; Q.run(d * 0.5); Q.quiet(); return d; });
    EZ.push(await cell(`${mode}: crouch ${d.toFixed(2)} s`));
  }

  // ---------- trap: the fox in channel 3 with the egg, the player turns ring 3 so no gap is in reach
  const TR = [];
  await setup('medium');
  await at(() => { Q.until(() => Q.F.ph === 'inner'); Q.run(0.15); Q.quiet(); });
  TR.push(await cell('in channel 3 with the egg'));
  await at(() => { Q.setRing(3, 215); Q.until(() => Q.F.ph === 'trapped', 2); Q.run(0.15); });
  TR.push(await cell('gap turned away: "TRAPPED!"'));
  await at(() => { Q.run(0.9); Q.quiet(); });
  TR.push(await cell('trapped: drops the egg, scrabbles'));
  // an egg dropped on it
  await at(() => {
    const s = Q.s, F = Q.F, e = s.eggs[1], q = s.denPt(0.05, 0.95), d = Math.hypot(q.x, q.y);
    e.body.setTransform(q, 0); e.body.setLinearVelocity({ x: (q.x / d) * 3, y: (q.y / d) * 3 }); e.ch = s.channelOf(e);
    Q.run(0.05);
  });
  TR.push(await cell('an egg falls on it'));
  await at(() => { Q.until(() => Q.F.ph === 'hurt', 2); Q.run(0.15); });
  TR.push(await cell('hit: "OUCH! 2 left"'));
  await at(() => { Q.until(() => Q.F.ph === 'stunned', 2); Q.run(0.6); Q.quiet(); });
  TR.push(await cell('stunned after the hit'));
  const hpNow = await at(() => Q.F.hp);
  // states in the level
  const ST = [];
  await setup('medium');
  await at(() => { Q.F.next = 99; Q.run(0.6); Q.quiet(); });
  ST.push(await cell('NORMAL'));
  await at(() => { Q.s.denP2('ice', 4); Q.run(0.4); Q.quiet(); });
  ST.push(await cell('FROZEN'));
  await at(() => { Q.F.frozen = 0.55; Q.run(0.15); Q.quiet(); });
  ST.push(await cell('FROZEN: cracks, shivers'));
  await at(() => { Q.until(() => !(Q.F.frozen > 0), 2); Q.run(0.12); Q.quiet(); });
  ST.push(await cell('thaw: shards pop off'));
  await at(() => { Q.run(1.2); Q.s.denP2('zap', 2.5); Q.run(0.12); Q.quiet(); });
  ST.push(await cell('ZAP: arcs (0.3 s)'));
  await at(() => { Q.run(0.8); Q.quiet(); });
  ST.push(await cell('STUNNED: stars, spiral eyes'));

  // ---------- the face: old art beside the new one
  const OLD = { evil: 'fox_evil', laugh: 'fox_laugh', cry: 'fox_cry', shocked: 'fox_shock' };
  const oldImg = (n) => { const f = path.join(SPRITES, n + '.webp'); return fs.existsSync(f) ? 'data:image/webp;base64,' + fs.readFileSync(f).toString('base64') : null; };
  const newFaces = await ev(() => {
    const A = __egg.foxArt, out = {};
    const one = (mood, o, sz = 150, bg = '#3b2a4a') => {
      const c = document.createElement('canvas'); c.width = c.height = sz * 2;
      const ctx = c.getContext('2d'); ctx.scale(2, 2); ctx.fillStyle = bg; ctx.fillRect(0, 0, sz, sz);
      A.drawFoxFace(ctx, sz / 2, sz * 0.47, sz * 0.36, mood, 0.8, o);
      return c.toDataURL('image/png');
    };
    for (const m of ['idle', 'smug', 'evil', 'angry', 'laugh', 'shocked', 'cry']) out[m] = one(m, {});
    out.king = one('evil', { crown: true });
    // the same face small (the in-level emblem size and the thrower size)
    const small = (sz) => { const c = document.createElement('canvas'); c.width = c.height = sz * 2; const ctx = c.getContext('2d'); ctx.scale(2, 2); ctx.fillStyle = '#3b2a4a'; ctx.fillRect(0, 0, sz, sz); A.drawFoxFace(ctx, sz / 2, sz * 0.47, sz * 0.36, 'smug', 0.8, {}); return c.toDataURL('image/png'); };
    out.s24 = small(24); out.s40 = small(40);
    const card = (id) => { const w = 300, h = 190, c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2; const ctx = c.getContext('2d'); ctx.scale(2, 2); A.drawBossCard(ctx, id, 0, 0, w, h, 1.2, 3); return c.toDataURL('image/png'); };
    out.card = card('boss_fox'); out.cardKing = card('boss_foxking');
    return out;
  });

  // ---------- the new face in the game: intro cards, a normal level's thrower, title, win, fail
  const IN = [];
  const scrFull = async (cap, fn, arg) => { await ev(fn, arg); IN.push({ cap, img: await full(), full: 1 }); };
  await scrFull('L5 intro: boss card', () => { const E = __egg; E.setSave({ mode: 'medium', calm: false, seen: {}, intro: {} }); E.start(4); for (let k = 0; k < 50; k++) E.frame(1 / 60); });
  await scrFull('L35 intro: Fox King card', () => { const E = __egg; E.setSave({ mode: 'medium', calm: false, seen: {}, intro: {} }); E.start(34); for (let k = 0; k < 50; k++) E.frame(1 / 60); });
  await ev(() => { const E = __egg; E.setSave({ mode: 'medium', calm: false, seen: {}, intro: { 4: 1 } }); E.start(3, { direct: true }); Q.run(2); Q.quiet(); });
  const thrower = await ev(() => { const F = Q.s.fox; return F ? { x: F.x, y: Q.s.outerR + 0.6 } : null; });
  IN.push({ cap: 'L4: the fox thrower', img: await full(), full: 1 });
  if (thrower) IN.push({ cap: 'L4 thrower, real scale', img: await crop(thrower, 170) });
  await ev(() => { Q.until(() => Q.s.fox && Q.s.fox.t < 0.45, 16); Q.quiet(); });
  const thrower2 = await ev(() => { const F = Q.s.fox; return F ? { x: F.x, y: Q.s.outerR + 0.6 } : null; });
  if (thrower2) IN.push({ cap: 'L4 thrower winding up', img: await crop(thrower2, 170) });
  await scrFull('title', () => { const E = __egg; E.G.screen = 'title'; E.G.screenT = 5; for (let i = 0; i < 20; i++) E.frame(1 / 60); });
  await scrFull('win (fox cries)', () => { const E = __egg; E.start(4, { direct: true }); E.frame(1 / 60); E.showResult('win', 3); for (let k = 0; k < 300; k++) E.frame(1 / 60); });
  await scrFull('fail (fox laughs)', () => { const E = __egg; E.start(4, { direct: true }); E.frame(1 / 60); E.showResult('fail'); for (let k = 0; k < 120; k++) E.frame(1 / 60); });

  // ---------- full phone screens of the den levels
  const LV = [];
  await setup('medium');
  await at(() => { Q.until(() => Q.F.ph === 'crouch'); Q.run(Q.F.dur * 0.5); Q.quiet(); });
  LV.push({ cap: 'Fox Raid (den), medium: the pounce telegraph', img: await full(), full: 1 });
  await at(() => { Q.until(() => Q.F.ph === 'inner'); Q.setRing(3, 215); Q.until(() => Q.F.ph === 'trapped', 2); Q.run(0.5); Q.quiet(); });
  LV.push({ cap: 'trapped (boss bar: TRAPPED!)', img: await full(), full: 1 });
  await ev(() => { Q.start('foxden', 'easy'); Q.run(25); Q.quiet(); });
  LV.push({ cap: 'Fox Raid (den), easy, 25 s untouched', img: await full(), full: 1 });
  await ev(() => { Q.start('foxkingden', 'hard'); Q.run(45); Q.quiet(); });
  LV.push({ cap: 'Fox King (den), hard, 45 s untouched', img: await full(), full: 1 });

  // ---------- assemble the sheets
  const sheet = async (name, title, sections, width = 1300) => {
    const sec = sections.map((s) => `<h2>${esc(s.title)}</h2>${s.note ? `<p>${esc(s.note)}</p>` : ''}<div class="row">${s.cells.map((c) => `<figure><img src="${typeof c.img === 'string' ? c.img : b64(c.img)}" style="${c.full ? 'width:280px' : c.w ? `width:${c.w}px` : `width:${CROP}px`}"><figcaption>${esc(c.cap)}</figcaption></figure>`).join('')}</div>`).join('');
    const html = `<html><head><style>body{margin:0;padding:14px;background:#1d1f27;color:#e8e8ee;font:13px system-ui,sans-serif;width:${width}px}h1{font-size:20px;margin:0 0 6px}h2{font-size:15px;margin:16px 0 4px;color:#ffd38a}p{margin:0 0 6px;color:#b9bccb;max-width:${width - 40}px}.row{display:flex;flex-wrap:wrap;gap:8px}figure{margin:0;background:#2a2d38;padding:4px;border-radius:6px}figure img{display:block;image-rendering:auto}figcaption{font-size:12px;padding-top:3px;max-width:280px}</style></head><body><h1>${esc(title)}</h1>${sec}</body></html>`;
    const q = await b.newPage({ viewport: { width: width + 28, height: 900 }, deviceScaleFactor: 1 });
    await q.setContent(html);
    await q.waitForTimeout(200);
    await q.screenshot({ path: path.join(out, name), fullPage: true });
    await q.close();
    console.log('wrote', path.join(out, name));
  };
  await sheet('rig.png', 'Den fox rig: every pose', [
    { title: `Real level scale (${realK.toFixed(1)} px per metre, the egg is ~${Math.round(realK * 0.56)} px tall)`, note: 'Shown at 1x css size of a 390x844 phone. The last row: NORMAL, then the shared creature states.', cells: [{ cap: 'poses at real scale', img: rigReal, w: Math.round(Math.max(2.3 * realK, 120)) * 6 }] },
    { title: 'Close up (110 px per metre)', cells: [{ cap: 'poses close up', img: rigClose, w: 1260 }] },
  ]);
  await sheet('pounce.png', 'Pounce through a lined-up gap (medium)', [
    { title: 'Pounce, grab, back out, carry, stash', note: 'Crops at real phone scale. The fox stands on the den-run floor (the outer ring), lines up under a gap of the next ring in, crouches (arc + paw mark), leaps through and grabs the egg.', cells: P },
    { title: 'Blocked pounce: the player turns the ring during the crouch', note: 'The arc turns grey with an X as soon as the gap no longer lines up; the leap bonks off the ring.', cells: BL },
    { title: 'Telegraph length by mode (mid-crouch)', cells: EZ },
  ]);
  await sheet('trap.png', 'Trap and hit', [
    { title: 'Trapped in channel 3, then hit', note: `The ring the fox stands on in the inner channel does not carry it, so turning it takes the gap away: no gap in reach = trapped. It drops the egg, can't throw, and a falling egg, flaming egg, rock, save or power hits it (hp now ${hpNow}).`, cells: TR },
    { title: 'States in the level (shared look spec)', cells: ST },
  ]);
  await sheet('faces.png', 'One fox everywhere: old art beside the new face', [
    { title: 'Old (raster sprites, no longer used)', cells: Object.entries(OLD).map(([m, n]) => ({ cap: n, img: oldImg(n), w: 150 })).concat([{ cap: 'boss_fox (old card)', img: oldImg('boss_fox'), w: 240 }, { cap: 'boss_foxking (old card)', img: oldImg('boss_foxking'), w: 240 }]).filter((c) => c.img) },
    { title: 'New face (code-drawn, src/render/foxface.js)', cells: ['evil', 'laugh', 'cry', 'shocked', 'idle', 'smug', 'angry'].map((m) => ({ cap: m, img: newFaces[m], w: 150 })).concat([{ cap: 'Fox King', img: newFaces.king, w: 150 }, { cap: '24 px', img: newFaces.s24, w: 24 }, { cap: '40 px', img: newFaces.s40, w: 40 }]) },
    { title: 'New boss cards', cells: [{ cap: 'boss_fox', img: newFaces.card, w: 300 }, { cap: 'boss_foxking', img: newFaces.cardKing, w: 300 }] },
  ]);
  await sheet('insitu.png', 'The new fox face in the game', [{ title: 'Screens (390x844)', cells: IN }]);
  await sheet('level.png', 'Den fox levels: full phone screens', [{ title: '390x844', cells: LV }]);
  fs.rmSync(tmp, { recursive: true, force: true });
  if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'));
  await b.close();
  srv.close();
})().catch((e) => { console.error(e); srv.close(); process.exit(1); });
