// Egg thieves QA (v3.6): strip sheets at real phone scale (390x844, DPR 2) from the live dev build.
//   rig.png      every pose of the weasel, the rat and the Rat King at real level scale and close up (an egg for scale,
//                held eggs where the sim puts them), the frozen / cracking / zap / stunned states beside the normal pose
//   weasel.png   in the level: a pounce through a lined-up gap, a blocked pounce, a trap and a hit, the states
//   rats.png     in the level: brace, roll, an egg rolled into a gap, the hop over an egg, light and water scaring them
//   bosses.png   the weasel boss (L5) and the Rat King (L35) fights: telegraph, trapped + boss bar, throw, summon
//   levels.png   full phone screens of L4, L5, L13, L19, L31, L32 and L35
//   worlds.png   a weasel and the rats in every world's look (contrast check)
//   screens.png  title, level map, win, fail, the L5 / L35 intro cards, the boss cards and emblems
// Usage: node tools/thief-strips.cjs [dist/dev] [outDir=qa/thief] [--port=9031]
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const PORT = +((process.argv.find((a) => a.startsWith('--port=')) || '').split('=')[1] || 9031);
const dir = path.resolve(args[0] || 'dist/dev');
const out = path.resolve(args[1] || 'qa/thief');
const VW = 390, VH = 844, DPR = 2, CROP = 190;
fs.mkdirSync(out, { recursive: true });

const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.json': 'application/json', '.css': 'text/css' };
const srv = http.createServer((q, r) => {
  const u = q.url.split('?')[0], f = path.join(dir, u === '/' ? 'index.html' : u);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(d); });
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
    E.G.paused = true; // the page's own loop must not run between the hand-stepped frames and the screenshots
    window.Q = {
      get s() { return E.G.sim; },
      T(i = 0) { return E.G.sim.thieves[i]; },
      scr(x, y) { const G = E.G, P = G.play; return { x: P.x + P.w / 2 + (x - G.cam.x) * G.cam.k, y: P.y + P.h / 2 - (y - G.cam.y) * G.cam.k }; },
      run(s) { for (let i = 0; i < Math.round(s * 60); i++) E.frame(1 / 60); },
      until(f, max = 20) { for (let i = 0; i < max * 60 && !f(); i++) E.frame(1 / 60); return !!f(); },
      quiet() { E.G.toast = null; E.G.toasts.length = 0; },
      setRing(i, deg) { const R = E.G.sim.rings[i], a0 = (deg * Math.PI) / 180, a = Math.atan2(Math.sin(a0), Math.cos(a0)); /* planck keeps angles in (-pi, pi] */ R.body.setTransform(R.body.getPosition(), a); R.target = a; R.body.setAngularVelocity(0); },
      // an egg lying on the floor of channel ch at world angle deg
      egg(i, ch, deg) { const s = E.G.sim, e = s.eggs[i], r = s.thFloor(ch) - 0.22, w = (deg * Math.PI) / 180; e.body.setTransform({ x: r * Math.cos(w), y: r * Math.sin(w) }, w); e.body.setLinearVelocity({ x: 0, y: 0 }); e.body.setAngularVelocity(0); e.ch = ch; return e; },
      park(i) { const e = E.G.sim.eggs[i]; Q.egg(i, 0, 90); return e; }, // out of the way: the top of the innermost channel
      // a thief on the floor of its run at world angle deg, ready to act
      put(i, deg, ph = 'prowl', face = 1) { const s = E.G.sim, T = s.thieves[i]; T.a = (deg * Math.PI) / 180; T.ch = T.run; T.r = s.thFloor(T.run); T.carA = s.rings[T.run].body.getAngle(); T.face = face; s.thSet(T, ph); T.next = 0; return T; },
      body(i = 0) { return E.G.sim.thBody(E.G.sim.thieves[i]); },
      // turn ring ri so its first gap a thief fits through sits at world angle deg
      lineGap(ri, deg, min = 0.6) { const s = E.G.sim, R = s.rings[ri], g = R.gaps.find((g) => s.snakeGap(g) && g.len >= min) || R.gaps[0]; Q.setRing(ri, deg - (g.a * 180) / Math.PI); },
      // turn ring ri so every gap is as far as it gets from thief 0 (it is trapped)
      trapRing(ri) { const s = E.G.sim, R = s.rings[ri], T = s.thieves[0]; let best = 0, bd = -1; for (let d = 0; d < 360; d += 5) { const a = (d * Math.PI) / 180; const m = Math.min(...R.gaps.map((g) => Math.abs(Math.atan2(Math.sin(a + g.a - T.a), Math.cos(a + g.a - T.a))))); if (m > bd) { bd = m; best = d; } } Q.setRing(ri, best); },
      start(kind, mode) { E.setSave({ mode, calm: false, seen: {}, intro: {} }); E.startDemo(kind, { direct: true }); E.G.paused = true; Q.run(0.2); },
      level(id, mode = 'medium', intro = false) { E.setSave({ mode, calm: false, seen: {}, intro: intro ? {} : { [id]: 1 } }); E.start(id - 1, { direct: !intro }); E.G.paused = true; },
    };
  });
  const crop = async (pt, size = CROP) => {
    const c = await ev((pt) => Q.scr(pt.x, pt.y), pt);
    const x = Math.max(0, Math.min(VW - size, c.x - size / 2)), y = Math.max(0, Math.min(VH - size, c.y - size / 2));
    return p.screenshot({ clip: { x, y, width: size, height: size } });
  };
  const full = () => p.screenshot();
  const at = (fn, arg) => ev(fn, arg);
  const cell = async (cap, i = 0, size) => ({ cap, img: await crop(await at((i) => Q.body(i), i), size) });
  const fullCell = async (cap) => ({ cap, img: await full(), full: 1 });

  // ---------- the rigs: an in-page canvas gallery at two scales
  const POSES = {
    weasel: [
      { st: 'idle', t: 0.5, egg: 1, cap: 'idle (egg for scale)' }, { st: 'idle', t: 1.75, cap: 'sniff' }, { st: 'prowl', odo: 0, cap: 'trot 1' }, { st: 'prowl', odo: 0.2, cap: 'trot 2' }, { st: 'prowl', odo: 0.4, cap: 'trot 3' }, { st: 'stalk', odo: 0.1, cap: 'stalk' },
      { st: 'crouch', u: 0.2, o: { eye: 'lock' }, cap: 'crouch: wiggle' }, { st: 'crouch', u: 0.85, o: { eye: 'lock' }, cap: 'crouch: eyes lock' }, { st: 'leap', u: 0.15, o: { eye: 'lock' }, cap: 'pounce: push off' }, { st: 'leap', u: 0.5, o: { eye: 'lock' }, cap: 'pounce: stretched' }, { st: 'leap', u: 0.9, cap: 'pounce: land' }, { st: 'grab', u: 0.5, egg: 3, cap: 'grab' },
      { st: 'carry', odo: 0.1, egg: 2, cap: 'carry (egg in jaws)' }, { st: 'carry', odo: 0.3, egg: 2, cap: 'carry 2' }, { st: 'trapped', t: 1.1, o: { eye: 'wide', sweat: 1 }, cap: 'trapped: scrabble' }, { st: 'hurt', u: 0.5, o: { eye: 'squeeze' }, cap: 'hit' }, { st: 'bonk', u: 0.2, o: { eye: 'squeeze', stars: 2 }, cap: 'bonk (blocked)' }, { st: 'laugh', o: { eye: 'happy' }, cap: 'laugh (stashed)' },
      { st: 'toss', u: 0.6, cap: 'toss (boss)' }, { st: 'scared', odo: 0.1, o: { eye: 'wide' }, cap: 'flee home' }, { st: 'defeated', odo: 0.1, o: { eye: 'squeeze', tears: 1 }, cap: 'defeated' }, { st: 'stand', cap: 'stand (card)' },
      { st: 'idle', t: 1.1, cap: 'NORMAL' }, { st: 'idle', t: 1.1, o: { frozen: 3 }, cap: 'FROZEN' }, { st: 'idle', t: 1.1, o: { frozen: 0.5 }, cap: 'CRACKING (last 1 s)' }, { st: 'stunned', t: 1.1, o: { zap: 1, eye: 'spiral' }, cap: 'ZAP: 0.3 s arcs' }, { st: 'stunned', t: 1.1, o: { eye: 'spiral', stars: 3 }, cap: 'STUNNED' },
    ],
    rat: [
      { st: 'idle', t: 0.5, egg: 1, cap: 'idle (egg for scale)' }, { st: 'idle', t: 1.75, cap: 'sniff' }, { st: 'prowl', odo: 0, cap: 'trot 1' }, { st: 'prowl', odo: 0.15, cap: 'trot 2' }, { st: 'prowl', odo: 0.3, cap: 'trot 3' }, { st: 'leap', u: 0.5, hop: 1, cap: 'hop over an egg' },
      { st: 'brace', u: 0.2, o: { eye: 'lock' }, egg: 4, cap: 'brace: wiggle' }, { st: 'brace', u: 0.85, o: { eye: 'lock' }, egg: 4, cap: 'brace: about to roll' }, { st: 'push', odo: 0, egg: 4, cap: 'roll 1 (nose + paws)' }, { st: 'push', odo: 0.1, egg: 4, cap: 'roll 2' }, { st: 'push', odo: 0.2, egg: 4, cap: 'roll 3' }, { st: 'cross', o: { eye: 'angry' }, cap: 'cross (egg fell through)' },
      { st: 'laugh', o: { eye: 'happy' }, cap: 'laugh (into the hole)' }, { st: 'scared', odo: 0.1, o: { eye: 'wide' }, cap: 'scared: flee to the hole' }, { st: 'hurt', u: 0.5, o: { eye: 'squeeze' }, cap: 'hit' }, { st: 'stand', cap: 'stand (card)' },
      { st: 'idle', t: 1.1, cap: 'NORMAL' }, { st: 'idle', t: 1.1, o: { frozen: 3 }, cap: 'FROZEN' }, { st: 'idle', t: 1.1, o: { frozen: 0.5 }, cap: 'CRACKING' }, { st: 'stunned', t: 1.1, o: { zap: 1, eye: 'spiral' }, cap: 'ZAP' }, { st: 'stunned', t: 1.1, o: { eye: 'spiral', stars: 3 }, cap: 'STUNNED' },
    ],
    ratking: [
      { st: 'idle', t: 0.5, egg: 1, cap: 'idle (egg for scale)' }, { st: 'prowl', odo: 0, cap: 'trot 1' }, { st: 'prowl', odo: 0.25, cap: 'trot 2' }, { st: 'crouch', u: 0.85, o: { eye: 'lock' }, cap: 'crouch' }, { st: 'leap', u: 0.5, o: { eye: 'lock' }, cap: 'pounce' }, { st: 'carry', odo: 0.1, egg: 2, cap: 'carry' },
      { st: 'toss', u: 0.6, cap: 'toss a curse orb' }, { st: 'trapped', t: 1.1, o: { eye: 'wide', sweat: 1 }, cap: 'trapped' }, { st: 'hurt', u: 0.5, o: { eye: 'squeeze' }, cap: 'hit' }, { st: 'laugh', o: { eye: 'happy' }, cap: 'laugh' }, { st: 'defeated', odo: 0.1, o: { eye: 'squeeze', tears: 1 }, cap: 'defeated' }, { st: 'stand', cap: 'stand (card)' },
      { st: 'idle', t: 1.1, cap: 'NORMAL' }, { st: 'idle', t: 1.1, o: { frozen: 3 }, cap: 'FROZEN' }, { st: 'stunned', t: 1.1, o: { zap: 1, eye: 'spiral' }, cap: 'ZAP' }, { st: 'stunned', t: 1.1, o: { eye: 'spiral', stars: 3 }, cap: 'STUNNED' },
    ],
  };
  const gallery = (kind, k, cols) => ev(([kind, POSES, k, cols]) => {
    const A = __egg.thiefArt, G = A.RIG[kind], DPR = 2, cw = Math.round(Math.max(2.1 * k, 150)), chh = Math.round(1.05 * k) + 30, rows = Math.ceil(POSES.length / cols);
    const c = document.createElement('canvas');
    c.width = cw * cols * DPR; c.height = chh * rows * DPR;
    const ctx = c.getContext('2d');
    ctx.scale(DPR, DPR);
    const egg = (x, y, ang, kk) => { // the game's egg outline (geom.js eggPoint), cream with a dark edge
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.beginPath();
      for (let i = 0; i < 28; i++) { const t = (i / 28) * Math.PI * 2, s = Math.sin(t); ctx.lineTo(0.21 * kk * Math.cos(t) * (1 - 0.13 * s), -0.28 * kk * s); }
      ctx.closePath(); ctx.fillStyle = '#fbf3e0'; ctx.fill(); ctx.lineWidth = Math.max(1, 0.025 * kk); ctx.strokeStyle = '#3a2410'; ctx.stroke(); ctx.restore();
    };
    POSES.forEach((q, i) => {
      const x0 = (i % cols) * cw, y0 = Math.floor(i / cols) * chh, fl = y0 + chh - 18 - 0.12 * k, X = x0 + cw * 0.36;
      ctx.fillStyle = (i + Math.floor(i / cols)) % 2 ? '#a9d4f0' : '#9cc8e8'; ctx.fillRect(x0, y0, cw, chh);
      ctx.fillStyle = '#8a5a2e'; ctx.fillRect(x0, fl, cw, 0.16 * k); // the ring floor
      ctx.fillStyle = '#5b3a1c'; ctx.fillRect(x0, fl + 0.16 * k - 1, cw, 1);
      const t = q.t ?? 1.3, pose = A.thiefPose(kind, q.st, t, q.u ?? 0.5, q.odo ?? 0), o = { ...(q.o || {}), crown: kind === 'ratking', cape: kind === 'ratking' };
      const lift = q.hop ? 0.4 * k : 0;
      if (q.egg === 1) egg(X - 0.6 * k, fl - 0.21 * k, Math.PI / 2, k);
      if (q.hop) egg(X, fl - 0.21 * k, Math.PI / 2, k);
      if (q.egg === 3) egg(X + G.mouthX * k, fl - 0.21 * k, Math.PI / 2, k);
      A.drawThief(ctx, X, fl - lift, G.s * k, t, pose, o, kind);
      if (q.egg === 2) { egg(X + G.mouthX * k, fl - G.mouthY * k, Math.PI / 2, k); A.drawThief(ctx, X, fl, G.s * k, t, pose, { ...o, only: 'head' }, kind); }
      if (q.egg === 4) egg(X + (G.mouthX + 0.19) * k, fl - 0.21 * k, Math.PI / 2 + (q.odo || 0) * 4, k);
      ctx.fillStyle = '#0d1b2a'; ctx.font = '600 11px sans-serif'; ctx.textBaseline = 'alphabetic'; ctx.fillText(q.cap, x0 + 4, y0 + chh - 4);
    });
    return { url: c.toDataURL('image/png'), w: cw * cols };
  }, [kind, POSES[kind], k, cols]);
  const realK = await ev(() => { Q.start('weasel', 'medium'); Q.run(2); return __egg.G.cam.k; });
  const RIGS = [];
  for (const kind of ['weasel', 'rat', 'ratking']) {
    const real = await gallery(kind, realK, 6), close = await gallery(kind, 120, 6);
    RIGS.push({ kind, real, close });
  }

  // ---------- the weasel in the level (studio 911: 4 rings, the run is channel 3, normal spacing)
  // ring 2's gap 0 (ring-local -80) lined up at world -75; the egg one channel in, a metre past the gap
  const wSetup = (mode) => ev((mode) => {
    Q.start('weasel', mode);
    Q.setRing(2, 5); Q.setRing(3, 0);
    Q.egg(0, 2, -100); Q.park(1); Q.park(2);
    Q.put(0, -20, 'prowl', -1);
    Q.run(0.4); Q.quiet();
  }, mode);
  const W = [];
  await wSetup('medium');
  W.push(await cell('prowl toward the gap'));
  await at(() => { Q.until(() => Q.T().ph === 'crouch'); Q.run(Q.T().dur * 0.4); Q.quiet(); });
  W.push(await cell('crouch: wiggle, paw mark, arc'));
  await at(() => { Q.until(() => Q.T().ph === 'leap'); Q.run(Q.T().ldur * 0.45); });
  W.push(await cell('pounce up through the gap'));
  await at(() => { Q.until(() => Q.T().ph === 'grab'); Q.run(0.15); });
  W.push(await cell('grab: "Snatched!"'));
  await at(() => { Q.until(() => Q.T().ph === 'inner'); Q.run(0.35); Q.quiet(); });
  W.push(await cell('back to the gap, egg in jaws'));
  await at(() => { Q.until(() => Q.T().ph === 'leap'); Q.run(Q.T().ldur * 0.5); });
  W.push(await cell('hop out with the egg'));
  await at(() => { Q.until(() => Q.T().ph === 'carry'); Q.run(0.8); Q.quiet(); });
  W.push(await cell('carry home'));
  await at(() => { Q.until(() => Q.T().ph === 'stash', 20); Q.run(0.3); Q.quiet(); });
  W.push(await cell('stash in the den'));
  await at(() => { Q.until(() => Q.T().ph === 'laugh'); Q.run(0.3); Q.quiet(); });
  W.push(await cell('laugh: "Stashed!"'));
  const WB = [];
  await wSetup('medium');
  await at(() => { Q.until(() => Q.T().ph === 'crouch'); Q.run(Q.T().dur * 0.4); Q.quiet(); });
  WB.push(await cell('crouch: gap lined up'));
  await at(() => { Q.setRing(2, 35); Q.run(0.08); Q.quiet(); });
  WB.push(await cell('player turns the ring: grey X'));
  await at(() => { Q.until(() => Q.T().ph === 'leap'); Q.until(() => Q.T().blocked, 2); Q.run(0.03); });
  WB.push(await cell('leaps anyway: bonk'));
  await at(() => { Q.until(() => Q.T().ph === 'bonk'); Q.run(0.25); });
  WB.push(await cell('"Blocked!" dizzy'));
  const WT = [];
  await wSetup('medium');
  await at(() => { Q.until(() => Q.T().ph === 'inner'); Q.run(0.1); Q.quiet(); });
  WT.push(await cell('in channel 2 with the egg'));
  await at(() => { Q.setRing(2, 180); Q.until(() => Q.T().ph === 'trapped', 3); Q.run(0.2); });
  WT.push(await cell('gap turned away: "TRAPPED!"'));
  await at(() => { Q.run(0.9); Q.quiet(); });
  WT.push(await cell('drops the egg, scrabbles'));
  await at(() => { // an egg dropped on it from the channel above
    const s = Q.s, T = Q.T(), e = s.eggs[1], q = s.thPt(T, 0, 0.75);
    e.body.setTransform(q, 0); e.body.setLinearVelocity({ x: -q.x * 0.6, y: -q.y * 0.6 }); e.ch = s.channelOf(e);
    Q.until(() => Q.T().ph === 'hurt', 2); Q.run(0.12);
  });
  WT.push(await cell('an egg falls on it: hit'));
  await at(() => { Q.run(0.7); Q.quiet(); });
  WT.push(await cell('runs home to hide'));
  const EZ = [];
  for (const mode of ['easy', 'medium', 'hard']) {
    await wSetup(mode);
    const d = await at(() => { Q.until(() => Q.T().ph === 'crouch'); const d = Q.T().dur; Q.run(d * 0.5); Q.quiet(); return d; });
    EZ.push(await cell(`${mode}: crouch ${d.toFixed(2)} s`));
  }
  const WS = [];
  await wSetup('medium');
  await at(() => { Q.T().next = 99; Q.T().tgt = 0; Q.run(0.5); Q.quiet(); });
  WS.push(await cell('NORMAL'));
  await at(() => { Q.s.thiefP2('ice', 4); Q.run(0.4); Q.quiet(); });
  WS.push(await cell('FROZEN'));
  await at(() => { Q.T().frozen = 0.55; Q.run(0.15); Q.quiet(); });
  WS.push(await cell('FROZEN: cracks, shivers'));
  await at(() => { Q.until(() => !(Q.T().frozen > 0), 2); Q.run(0.12); Q.quiet(); });
  WS.push(await cell('thaw: shards pop off'));
  await at(() => { Q.run(1.5); Q.s.thiefP2('zap', 2.5); Q.run(0.1); Q.quiet(); });
  WS.push(await cell('ZAP: arcs (0.3 s)'));
  await at(() => { Q.run(0.8); Q.quiet(); });
  WS.push(await cell('STUNNED: stars, spiral eyes'));

  // ---------- the rats (studio 912: a pair, hole at ring-local 50 on ring 3; ring 3's gaps at -150 and 10)
  const rSetup = (mode, deg = -100) => ev(([mode, deg]) => {
    Q.start('rats', mode);
    Q.setRing(3, 0);
    Q.egg(0, 3, deg); Q.park(1); Q.park(2);
    Q.put(0, deg - 40, 'prowl', 1); const R2 = Q.T(1); R2.ph = 'wait'; R2.t = 99;
    Q.run(0.3); Q.quiet();
  }, [mode, deg]);
  const R = [];
  await rSetup('medium');
  await at(() => { Q.until(() => Q.T().ph === 'brace'); Q.run(Q.T().dur * 0.5); Q.quiet(); });
  R.push(await cell('brace behind the egg: arrow'));
  await at(() => { Q.until(() => Q.T().ph === 'push'); Q.run(0.6); Q.quiet(); });
  R.push(await cell('rolls it: nose + front paws'));
  await at(() => { Q.run(1.5); Q.quiet(); });
  R.push(await cell('rolling toward the hole'));
  await at(() => { Q.setRing(3, -60); Q.until(() => Q.T().ph === 'cross', 14); Q.run(0.1); });
  R.push(await cell('a gap turned under it: drops'));
  await at(() => { Q.run(0.4); });
  R.push(await cell('"Down the gap!" cross rat'));
  const RH = [];
  await ev(() => { Q.start('rats', 'medium'); Q.setRing(3, 0); Q.egg(0, 3, -100); Q.park(1); Q.park(2); Q.put(0, -92, 'prowl', -1); const R2 = Q.T(1); R2.ph = 'wait'; R2.t = 99; Q.run(0.1); Q.quiet(); });
  for (let i = 0; i < 5; i++) { await at(() => { Q.run(0.2); Q.quiet(); }); RH.push(await cell(`walks round the egg ${i + 1}: hops over`)); }
  const RS = [];
  await rSetup('medium', -60);
  await at(() => { Q.until(() => Q.T().ph === 'push'); Q.run(0.4); Q.until(() => Q.T().ph === 'stash', 25); Q.run(0.2); Q.quiet(); });
  RS.push(await cell('the egg reaches the hole'));
  await at(() => { Q.until(() => Q.T().ph === 'laugh', 3); Q.run(0.2); });
  RS.push(await cell('"Into the hole!" (lost)'));
  const RF = [];
  await rSetup('medium');
  await at(() => { Q.until(() => Q.T().ph === 'push'); Q.run(0.5); Q.s.thiefHit('flash', {}); Q.run(0.15); });
  RF.push(await cell('glow flash: "Eek!"'));
  await at(() => { Q.run(0.6); Q.quiet(); });
  RF.push(await cell('bolts for the hole'));
  await at(() => { Q.s.thiefP2('ice', 4); Q.run(0.3); Q.quiet(); });
  RF.push(await cell('FROZEN'));
  await at(() => { Q.T().frozen = 0; Q.T().ph = 'prowl'; Q.s.thiefP2('zap', 2.5); Q.run(0.1); Q.quiet(); });
  RF.push(await cell('ZAP'));
  await at(() => { Q.run(0.8); Q.quiet(); });
  RF.push(await cell('STUNNED'));
  const RE = [];
  for (const mode of ['easy', 'medium', 'hard']) {
    await rSetup(mode);
    const d = await at(() => { Q.until(() => Q.T().ph === 'brace'); const d = Q.T().dur; Q.run(d * 0.5); Q.quiet(); return d; });
    RE.push(await cell(`${mode}: brace ${d.toFixed(2)} s`));
  }

  // ---------- the boss fights (full screens)
  const B = [];
  // a boss hunt set up by hand: an egg one channel in from the run, a gap of that ring lined up beside it
  const bossHunt = (id, mode) => ev(([id, mode]) => {
    Q.level(id, mode); Q.run(3.5);
    const s = Q.s, T = Q.T(), ri = T.run - 1, G = __egg.thiefArt.RIG[T.kind];
    Q.lineGap(ri, -90 + (1.3 / s.thFloor(ri)) * 180 / Math.PI, G.gapMin); // 1.3 m from the egg: in pounce range
    Q.egg(0, ri, -90); Q.park(1); Q.park(2);
    Q.put(0, -30, 'prowl', -1); T.next = 0;
    Q.run(0.3); Q.quiet();
  }, [id, mode]);
  for (const [id, who] of [[5, 'the weasel'], [35, 'the Rat King']]) {
    await bossHunt(id, 'medium');
    await ev(() => { Q.until(() => Q.T().ph === 'crouch', 10); Q.run(Q.T().dur * 0.5); Q.quiet(); });
    B.push(await fullCell(`L${id}: ${who} lines up a pounce`));
    await ev(() => { Q.until(() => Q.T().ph === 'inner', 10); Q.run(0.1); Q.quiet(); });
    B.push(await fullCell(`L${id}: egg snatched, inside the ring`));
    await ev(() => { Q.trapRing(Q.T().run - 1); Q.until(() => Q.T().ph === 'trapped', 3); Q.run(0.5); Q.quiet(); });
    B.push(await fullCell(`L${id}: trapped (boss bar: TRAPPED! HIT IT)`));
    await ev(() => { const s = Q.s, T = Q.T(), e = s.eggs[1], q = s.thPt(T, 0, 0.8); e.body.setTransform(q, 0); e.body.setLinearVelocity({ x: -q.x * 0.6, y: -q.y * 0.6 }); e.ch = s.channelOf(e); Q.until(() => Q.T().ph === 'hurt', 2); Q.run(0.15); });
    B.push(await fullCell(`L${id}: hit (one hp off)`));
  }
  await ev(() => { Q.level(5, 'hard'); Q.run(50); Q.quiet(); });
  B.push(await fullCell('L5 hard, 50 s untouched (throws)'));
  await ev(() => { Q.level(35, 'medium'); Q.run(38); Q.quiet(); });
  B.push(await fullCell('L35 phase 2: his rats come in'));
  await ev(() => { Q.level(35, 'medium'); Q.run(3.5); const s = Q.s, R = s.thieves.find((t) => t.kind === 'rat'), i = s.thieves.indexOf(R); Q.egg(0, R.run, -110); Q.park(1); Q.park(2); s.thieves.filter((t) => t.kind === 'rat').forEach((t, j) => { t.ph = 'wait'; t.t = j ? 99 : 0.01; }); Q.run(0.5); Q.put(i, -150, 'prowl', 1); Q.until(() => s.thieves[i].ph === 'push', 12); Q.run(1.2); Q.quiet(); });
  B.push(await fullCell('L35: a rat rolls an egg to the king\u2019s den'));
  await ev(() => { Q.level(35, 'hard'); Q.run(70); Q.quiet(); });
  B.push(await fullCell('L35 hard, 70 s untouched'));

  // ---------- full phone screens of the touched levels
  const LV = [];
  for (const [id, t, cap] of [[4, 14, 'L4 Pumpkin Patch: the weasel'], [13, 14, 'L13 Duck Pond: the octopus den'], [19, 14, 'L19 Glass Floor: the rats'], [31, 16, 'L31 The Thieves’ Gate'], [32, 14, 'L32 Clockwork Keep: rats'], [5, 3.5, 'L5 at the start'], [35, 3.5, 'L35 at the start']]) {
    await ev(([id, t]) => { Q.level(id, 'medium'); Q.run(t); Q.quiet(); }, [id, t]);
    LV.push(await fullCell(cap));
  }

  // ---------- every world's look: a weasel and the rats on each theme (contrast, no halos)
  const WL = [];
  for (const theme of ['farm', 'barn', 'orchard', 'pumpkin', 'bramble', 'jungle', 'mushroom', 'frozen', 'blizzard', 'crystal', 'volcano', 'storm', 'vault', 'clock']) {
    await ev((theme) => {
      const E = __egg, D = E.THIEF_DEMOS, base = D.find((d) => d.kind === 'weasel');
      const L = { ...base, id: 990, kind: 'theme-' + theme, theme, weasel: { a: -70, delay: 0.2 }, rats: { a: -120, n: 2, delay: 0.3, gap: 0.4 } };
      const i = D.findIndex((d) => d.kind === L.kind); if (i >= 0) D.splice(i, 1); D.push(L);
      E.setSave({ mode: 'medium', calm: false, seen: {}, intro: {} }); E.startDemo(L.kind, { direct: true }); E.G.paused = true;
      Q.park(0); Q.park(1); Q.park(2); Q.run(2.5); Q.quiet();
    }, theme);
    WL.push({ cap: theme, img: await p.screenshot({ clip: { x: 0, y: VH * 0.42, width: VW, height: VH * 0.5 } }), w: 300 });
  }

  // ---------- screens: title, map, intro cards, win, fail
  const SC = [];
  await ev(() => { const E = __egg; E.setSave({ mode: 'medium', calm: false, seen: {}, intro: {} }); E.G.screen = 'title'; E.G.screenT = 5; for (let i = 0; i < 30; i++) E.frame(1 / 60); });
  SC.push(await fullCell('title'));
  await ev(() => { const E = __egg; E.G.world = 6; E.G.screen = 'levels'; E.G.screenT = 3; for (let i = 0; i < 30; i++) E.frame(1 / 60); });
  SC.push(await fullCell('level map, world 7'));
  await ev(() => { Q.level(5, 'medium', true); for (let k = 0; k < 50; k++) __egg.frame(1 / 60); });
  SC.push(await fullCell('L5 intro: boss card'));
  await ev(() => { Q.level(35, 'medium', true); for (let k = 0; k < 50; k++) __egg.frame(1 / 60); });
  SC.push(await fullCell('L35 intro: Rat King card'));
  await ev(() => { Q.level(31, 'medium', true); for (let k = 0; k < 50; k++) __egg.frame(1 / 60); });
  SC.push(await fullCell('L31 intro: world 7'));
  await ev(() => { const E = __egg; Q.level(5); E.frame(1 / 60); E.showResult('win', 3); for (let k = 0; k < 300; k++) E.frame(1 / 60); });
  SC.push(await fullCell('win'));
  await ev(() => { const E = __egg; Q.level(5); E.frame(1 / 60); E.showResult('fail'); for (let k = 0; k < 120; k++) E.frame(1 / 60); });
  SC.push(await fullCell('fail'));
  const cards = await ev(() => {
    const A = __egg.thiefArt, o = {};
    const card = (id) => { const w = 300, h = 190, c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2; const ctx = c.getContext('2d'); ctx.scale(2, 2); A.drawBossCard(ctx, id, 0, 0, w, h, 1.2, 3); return c.toDataURL('image/png'); };
    const emb = (kind, r, bg) => { const sz = r * 2 + 8, c = document.createElement('canvas'); c.width = c.height = sz * 2; const ctx = c.getContext('2d'); ctx.scale(2, 2); ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(sz / 2, sz / 2, r, 0, 7); ctx.fill(); ctx.save(); ctx.beginPath(); ctx.arc(sz / 2, sz / 2, r, 0, 7); ctx.clip(); ctx.translate(sz / 2, sz / 2); A.drawThiefEmblem(ctx, kind, r, 1.2); ctx.restore(); return c.toDataURL('image/png'); };
    o.cardW = card('boss_weasel'); o.cardK = card('boss_ratking');
    o.embW = emb('weasel', 20, '#e9b552'); o.embK = emb('ratking', 20, '#7a4a9a'); o.embW2 = emb('weasel', 44, '#e9b552'); o.embK2 = emb('ratking', 44, '#7a4a9a');
    return o;
  });
  const CARDS = [{ cap: 'boss_weasel card', img: cards.cardW, w: 300 }, { cap: 'boss_ratking card', img: cards.cardK, w: 300 }, { cap: 'emblem 20 px', img: cards.embW, w: 48 }, { cap: 'emblem 20 px', img: cards.embK, w: 48 }, { cap: 'emblem 44 px', img: cards.embW2, w: 96 }, { cap: 'emblem 44 px', img: cards.embK2, w: 96 }];

  // ---------- assemble the sheets
  const sheet = async (name, title, sections, width = 1300) => {
    const sec = sections.map((s) => `<h2>${esc(s.title)}</h2>${s.note ? `<p>${esc(s.note)}</p>` : ''}<div class="row">${s.cells.map((c) => `<figure><img src="${typeof c.img === 'string' ? c.img : b64(c.img)}" style="${c.full ? 'width:280px' : c.w ? `width:${c.w}px` : `width:${CROP}px`}"><figcaption>${esc(c.cap)}</figcaption></figure>`).join('')}</div>`).join('');
    const html = `<html><head><style>body{margin:0;padding:14px;background:#1d1f27;color:#e8e8ee;font:13px system-ui,sans-serif;width:${width}px}h1{font-size:20px;margin:0 0 6px}h2{font-size:15px;margin:16px 0 4px;color:#ffd38a}p{margin:0 0 6px;color:#b9bccb;max-width:${width - 40}px}.row{display:flex;flex-wrap:wrap;gap:8px}figure{margin:0;background:#2a2d38;padding:4px;border-radius:6px}figure img{display:block;image-rendering:auto;max-width:${width - 20}px}figcaption{font-size:12px;padding-top:3px;max-width:280px}</style></head><body><h1>${esc(title)}</h1>${sec}</body></html>`;
    const q = await b.newPage({ viewport: { width: width + 28, height: 900 }, deviceScaleFactor: 2 });
    await q.setContent(html);
    await q.waitForTimeout(200);
    await q.screenshot({ path: path.join(out, name), fullPage: true });
    await q.close();
    console.log('wrote', path.join(out, name));
  };
  const rigSec = [];
  for (const R0 of RIGS) {
    rigSec.push({ title: `${R0.kind}: real level scale (${realK.toFixed(1)} px per metre; an egg is ${Math.round(realK * 0.56)} x ${Math.round(realK * 0.42)} px)`, note: 'CSS px of a 390x844 phone. Held eggs sit where the sim pins them (RIG.mouthX / mouthY).', cells: [{ cap: '', img: R0.real.url, w: R0.real.w }] });
    rigSec.push({ title: `${R0.kind}: close up (120 px per metre)`, cells: [{ cap: '', img: R0.close.url, w: Math.min(1270, R0.close.w) }] });
  }
  await sheet('rig.png', 'Egg thieves: every pose (weasel, rat, Rat King)', rigSec);
  await sheet('weasel.png', 'The weasel in the level (medium unless noted)', [
    { title: 'Pounce, grab, back out, carry, stash', note: 'Crops at real phone scale. It prowls the outer channel, lines up under a gap of the next ring in, crouches (arc + paw mark), leaps through and grabs the egg.', cells: W },
    { title: 'Blocked pounce: the player turns the ring during the crouch', cells: WB },
    { title: 'Trap and hit', note: 'Inside the inner channel the ring does not carry it: turn the gap away and it is trapped. It drops the egg; an egg dropped on it hits it.', cells: WT },
    { title: 'Telegraph length by mode (mid-crouch)', cells: EZ },
    { title: 'States in the level (shared look spec)', cells: WS },
  ]);
  await sheet('rats.png', 'The rats in the level (medium unless noted)', [
    { title: 'Brace, roll, and a gap turned under the egg', note: 'The rat braces behind the egg (an arrow shows where it will roll), rolls it with its nose and front paws, and the egg drops through a gap the player turns under it.', cells: R },
    { title: 'Getting behind its egg: it hops over it', cells: RH },
    { title: 'An egg rolled into the hole is lost', cells: RS },
    { title: 'Light and water scare it; frozen, zap, stunned', cells: RF },
    { title: 'Telegraph length by mode (mid-brace)', cells: RE },
  ]);
  await sheet('bosses.png', 'Boss fights: the Weasel (L5) and the Rat King (L35)', [{ title: 'Full phone screens (390x844)', cells: B }]);
  await sheet('levels.png', 'Touched levels: full phone screens (medium)', [{ title: '390x844', cells: LV }]);
  await sheet('worlds.png', 'A weasel and two rats on every world (lower half of the screen)', [{ title: 'Contrast check: dark outline only, no pale rims', cells: WL }]);
  await sheet('screens.png', 'Screens: title, map, intro cards, win, fail', [{ title: 'Screens (390x844)', cells: SC }, { title: 'Boss cards and boss bar emblems', cells: CARDS }]);
  if (errors.length) console.log('PAGE ERRORS:\n' + [...new Set(errors)].join('\n'));
  await b.close();
  srv.close();
})().catch((e) => { console.error(e); srv.close(); process.exit(1); });
