// Coral Reef QA (world 8): film strips at real phone scale (390x844, DPR 2) from the live dev build.
// Sheets: hermit crab, pufferfish, jellyfish, King Crab (every pose and state), underwater (eggs rising, bobbing and
// arriving at the boat), and the boss card + boss bar emblem. Every level here is underwater (water: true).
// Usage: node tools/reef-strips.cjs [dist/dev] [outDir=qa/reef] [--port=9053] [--only=hermit,puffer,...]
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const opt = (k, d) => ((process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || d);
const PORT = +opt('port', 9053), ONLY = opt('only', '').split(',').filter(Boolean);
const dir = path.resolve(args[0] || 'dist/dev');
const out = path.resolve(args[1] || 'qa/reef');
const VW = 390, VH = 844, DPR = 2, CROP = 150;
fs.mkdirSync(out, { recursive: true });

const base = { eggs: 1, target: 1, time: 0, spacing: 1.05, material: 'coral', nest: { w: 2.6 }, seed: 77, tip: '', theme: 'reef', water: true };
const R4 = (g3) => [{ gaps: [{ a: -90 }] }, { gaps: [{ a: -100 }] }, { gaps: [{ a: 70 }] }, { gaps: g3 || [{ a: -30 }] }];
const HERM = { ...base, hermit: { ch: 3, a: 118, delay: 0 }, rings: R4([{ a: 200 }]) };
const PUFL = { ...base, eggs: 2, puffer: { ch: 2, a: 112, delay: 0 }, rings: R4() };
const JELL = { ...base, jelly: { ch: 1, a: 60, delay: 0 }, rings: R4() };
const KING = { ...base, eggs: 3, target: 2, boss: 'kingcrab', bossFight: { kind: 'kingcrab', delay: 0.5, phases: [{ attacks: ['snap'], every: 2.5 }] }, rings: R4([{ a: 75 }]) };
const RISE = { ...base, eggs: 3, target: 3, rings: [{ gaps: [{ a: 90 }] }, { gaps: [{ a: 90 }] }, { gaps: [{ a: 90 }] }, { gaps: [{ a: 90 }] }] };

const srv = http.createServer((q, r) => {
  const f = path.join(dir, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); });
}).listen(PORT);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push('console: ' + m.text()); });
  await p.goto(`http://localhost:${PORT}/`);
  await p.waitForTimeout(900);
  const ev = (fn, ...a) => p.evaluate(fn, ...a);
  const start = (L, mode = 'medium') => ev(([L, mode]) => {
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
      // rest egg i against the outer wall (underwater: the ceiling at the top) of channel ch at world angle a (deg)
      egg(i, ch, a, v = 0) { const e = E.G.sim.eggs[i], R = E.G.sim.rings[ch], r = R.r - 0.08 - 0.3, w = (a * Math.PI) / 180; e.body.setTransform({ x: r * Math.cos(w), y: r * Math.sin(w) }, w - Math.PI / 2); e.body.setLinearVelocity({ x: 0, y: v }); e.body.setAngularVelocity(0); e.ch = ch; return e; },
      at(i, x, y, vx = 0, vy = 0) { const e = E.G.sim.eggs[i]; e.body.setTransform({ x, y }, 0); e.body.setLinearVelocity({ x: vx, y: vy }); e.body.setAngularVelocity(0); },
      park(i) { const e = E.G.sim.eggs[i]; e.body.setTransform({ x: 0.3 * i - 0.3, y: 0.5 }, 0); e.body.setLinearVelocity({ x: 0, y: 0 }); },
      eggAt(i) { const q = E.G.sim.eggs[i].body.getPosition(); return { x: q.x, y: q.y }; },
      herm() { const s = E.G.sim, H = s.hermits[0]; return { ...s.hermitBody(H), ph: H.ph }; },
      puff() { const s = E.G.sim, P = s.puffs[0]; return { ...s.puffXY(P), ph: P.ph }; },
      jel() { const J = E.G.sim.jellies[0]; return { x: J.x, y: J.y - 0.2, ph: J.ph }; },
      claw(i) { const C = E.G.sim.kc.claws[i]; return { ...E.G.sim.kcTip(C), ph: C.ph }; },
      crab() { const K = E.G.sim.kc; return { x: K.bx, y: K.by + 0.3 }; },
      k() { return E.G.cam.k; },
    };
    Q.run(0.3);
  }, [L, mode]);

  const sheets = {};
  let row = null;
  const newRow = (sheet, name) => { row = { name, frames: [] }; (sheets[sheet] = sheets[sheet] || []).push(row); };
  const shoot = async (label, world, C = CROP) => {
    const at = await ev((w) => Q.scr(w.x, w.y), world);
    const cx = Math.round(Math.min(Math.max(at.x, C / 2), VW - C / 2)), cy = Math.round(Math.min(Math.max(at.y, C / 2), VH - C / 2));
    const f = path.join(out, `f-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
    await ev(() => { Q.quiet(); __egg.frame(1 / 600); });
    await p.screenshot({ path: f, clip: { x: cx - C / 2, y: cy - C / 2, width: C, height: C } });
    row.frames.push({ f, label, C });
  };
  const full = async (label) => {
    const f = path.join(out, `f-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
    await ev(() => { Q.quiet(); __egg.frame(1 / 600); });
    await p.screenshot({ path: f });
    row.frames.push({ f, label, full: 1 });
  };
  const want = (s) => !ONLY.length || ONLY.includes(s);
  const H = () => ev(() => Q.herm()), PF = () => ev(() => Q.puff()), JF = () => ev(() => Q.jel());

  // ================================================================ hermit crab
  if (want('hermit')) {
    await start(HERM);
    await ev(() => { Q.park(0); Q.run(1.0); });
    newRow('hermit', 'walk (no egg near): scuttles along the channel ceiling-floor, legs ripple, shell bobs');
    for (let i = 0; i < 5; i++) { await shoot(`${(i * 0.35).toFixed(2)} s`, await H()); await ev(() => Q.run(0.35)); }
    await start(HERM);
    await ev(() => { Q.s.hermits[0].a = (110 * Math.PI) / 180; Q.egg(0, 3, 92); Q.run(0.9); });
    newRow('hermit', 'stalk, then the telegraph: claws up and snapping, mean brows (Easy 1.25 s, Medium 0.85 s)');
    await shoot('stalk', await H());
    await ev(() => Q.until(() => Q.s.hermits[0].ph === 'pinch'));
    for (const u of [0.1, 0.5, 0.9]) { await ev((u) => Q.until(() => { const X = Q.s.hermits[0]; return X.ph !== 'pinch' || 1 - X.t / X.dur >= u; }), u); await shoot(`pinch ${Math.round(u * 100)}%`, await H()); }
    newRow('hermit', 'tuck and carry: the egg goes in its shell (safe from thorns and stings) and it walks off with it');
    await ev(() => Q.until(() => Q.s.hermits[0].ph === 'carry')); await shoot('tucked', await H());
    for (let i = 0; i < 4; i++) { await ev(() => Q.run(0.5)); await shoot(`carry +${((i + 1) * 0.5).toFixed(1)} s`, await H()); }
    newRow('hermit', 'turn a gap under it: the egg slips out and floats up through the gap');
    await ev(() => { const X = Q.s.hermits[0], g = Q.s.rings[3].gaps[0]; Q.setRing(3, ((X.a + X.face * 0.12 - g.a) * 180) / Math.PI); });
    const slip = await H();
    for (const d of [0.02, 0.25, 0.4, 0.5, 0.6]) { await ev((d) => Q.run(d), d); await shoot(`+${d}`, slip); }
    newRow('hermit', 'flipped (an egg or rock hits it): on its back, legs kicking, lets go, dizzy stars');
    await start(HERM);
    await ev(() => { Q.s.hermits[0].a = (110 * Math.PI) / 180; Q.egg(0, 3, 92); Q.until(() => Q.s.hermits[0].ph === 'carry'); Q.run(0.3); Q.s.hermitFlip(Q.s.hermits[0], 'drop'); });
    const fl = await H();
    for (const d of [0.05, 0.4, 0.8, 1.2, 1.4]) { await ev((d) => Q.run(d), d); await shoot(`flip +${d}`, fl); }
    newRow('hermit', 'frozen (frost nova) holding its egg; thaw; zapped (spiral eyes, bolt)');
    await start(HERM);
    await ev(() => { Q.s.hermits[0].a = (110 * Math.PI) / 180; Q.egg(0, 3, 92); Q.until(() => Q.s.hermits[0].ph === 'carry'); Q.run(0.3); Q.s.p2All('ice', 2.5); Q.run(0.3); });
    await shoot('frozen', await H()); await ev(() => Q.run(1.4)); await shoot('frozen 1.7 s', await H()); await ev(() => Q.run(1.1)); await shoot('thaw', await H());
    await ev(() => { const X = Q.s.hermits[0]; X.hitCD = 0; Q.s.hermitFlip(X, 'zap'); X.zp = 0.3; Q.run(0.1); }); await shoot('zapped', await H());
    await ev(() => Q.run(0.5)); await shoot('stunned', await H());
    newRow('hermit', 'close-ups (60 css px crops): walk, pinch, carry, flipped');
    await start(HERM);
    await ev(() => { Q.park(0); Q.run(1); }); await shoot('walk', await H(), 60);
    await ev(() => { Q.s.hermits[0].a = (110 * Math.PI) / 180; Q.egg(0, 3, 92); Q.until(() => { const X = Q.s.hermits[0]; return X.ph === 'pinch' && X.t < X.dur * 0.5; }); }); await shoot('pinch', await H(), 60);
    await ev(() => { Q.until(() => Q.s.hermits[0].ph === 'carry'); Q.run(0.5); }); await shoot('carry', await H(), 60);
    await ev(() => { Q.s.hermitFlip(Q.s.hermits[0], 'drop'); Q.run(0.5); }); await shoot('flipped', await H(), 60);
  }

  // ================================================================ pufferfish
  if (want('puffer')) {
    await start(PUFL);
    await ev(() => { Q.park(0); Q.park(1); Q.run(0.8); });
    newRow('puffer', 'drift (nothing near its gap): a small fish wandering the channel');
    for (let i = 0; i < 4; i++) { await shoot(`${(i * 0.5).toFixed(1)} s`, await PF()); await ev(() => Q.run(0.5)); }
    await start(PUFL);
    await ev(() => { Q.park(1); Q.egg(0, 2, 92); Q.run(0.05); });
    newRow('puffer', 'an egg near the gap: it darts over the gap and puffs up in jerks (the telegraph), then a spiky ball plugs the gap');
    await ev(() => Q.until(() => Q.s.puffs[0].ph === 'dart')); await shoot('dart', await PF());
    await ev(() => Q.until(() => Q.s.puffs[0].ph === 'swell')); await shoot('swell 0%', await PF());
    await ev(() => Q.run(0.25)); await shoot('swell 50%', await PF());
    await ev(() => Q.until(() => Q.s.puffs[0].ph === 'big')); await ev(() => Q.run(0.1)); await shoot('big', await PF());
    await ev(() => Q.run(1.5)); await shoot('big 1.6 s', await PF());
    newRow('puffer', 'bump: a slow egg bounces off it safely; a fast one (Medium > 1.5 m/s underwater) is pricked by the spines');
    const side = (v) => { const P = Q.s.puffs[0], r = Q.s.reefMid(P.ch) - 0.05, a = P.a + 0.3; Q.at(1, r * Math.cos(a), r * Math.sin(a), Math.sin(a) * v, -Math.cos(a) * v); };
    await ev((f) => { (0, eval)(f)(0.9); Q.run(0.25); }, side.toString());
    await shoot('soft bounce', await PF());
    await ev(() => Q.run(0.3)); await shoot('bounced', await PF());
    await ev((f) => { Q.s.eggs[1].crackCD = 0; (0, eval)(f)(3.2); Q.run(0.2); }, side.toString());
    await shoot('spines!', await PF());
    newRow('puffer', 'popped (a zap or a thorn): air jet, it tumbles back, dazed; then frozen (frost nova) while swollen');
    await ev(() => { Q.s.puffPop(Q.s.puffs[0], 'zap'); });
    const pp = await PF();
    for (const d of [0.1, 0.3, 0.3]) { await ev((d) => Q.run(d), d); await shoot(`pop +${d}`, pp); }
    await ev(() => Q.run(0.4)); await shoot('dazed', await PF());
    await start(PUFL);
    await ev(() => { Q.park(1); Q.egg(0, 2, 92); Q.until(() => Q.s.puffs[0].ph === 'big'); Q.run(0.2); Q.s.p2All('ice', 3); Q.run(0.3); });
    await shoot('frozen big', await PF());
    newRow('puffer', 'close-ups (60 css px): drift, swell, big, popped');
    await start(PUFL);
    await ev(() => { Q.park(0); Q.park(1); Q.run(0.8); }); await shoot('drift', await PF(), 60);
    await ev(() => { Q.egg(0, 2, 92); Q.until(() => Q.s.puffs[0].ph === 'swell'); Q.run(0.2); }); await shoot('swell', await PF(), 60);
    await ev(() => { Q.until(() => Q.s.puffs[0].ph === 'big'); Q.run(0.3); }); await shoot('big', await PF(), 60);
    await ev(() => { Q.s.puffPop(Q.s.puffs[0], 'zap'); Q.run(0.7); }); await shoot('dazed', await PF(), 60);
  }

  // ================================================================ jellyfish
  if (want('jelly')) {
    await start(JELL);
    await ev(() => { Q.park(0); Q.run(1.5); });
    newRow('jelly', 'float and pulse: drifts round the vault through the walls, its heart glows');
    for (let i = 0; i < 5; i++) { await shoot(`${(i * 0.3).toFixed(1)} s`, await JF()); await ev(() => Q.run(0.3)); }
    newRow('jelly', 'sting: an egg it touches cracks (tentacles crackle yellow)');
    await ev(() => { const J = Q.s.jellies[0]; Q.at(0, J.x, J.y - 0.25); Q.s.eggs[0].body.setActive(true); Q.run(0.05); });
    const js = await JF();
    for (const d of [0.02, 0.15, 0.3]) { await ev((d) => Q.run(d), d); await shoot(`+${d}`, js); }
    newRow('jelly', 'flushed (water): swept out of the vault, comes back later; stunned (the live ring or a zap)');
    await start(JELL);
    await ev(() => { Q.park(0); Q.run(1.5); Q.s.jellyFlush(Q.s.jellies[0]); });
    const jf = await JF();
    for (const d of [0.1, 0.6, 1.0]) { await ev((d) => Q.run(d), d); await shoot(`flush +${d}`, jf); }
    await start(JELL);
    await ev(() => { Q.park(0); Q.run(1.5); Q.s.jellyStun(Q.s.jellies[0], 4, true); Q.run(0.1); });
    await shoot('zapped', await JF()); await ev(() => Q.run(0.6)); await shoot('stunned', await JF());
    newRow('jelly', 'frozen (frost nova), thaw; and its glow lighting up a silt cloud');
    await start(JELL);
    await ev(() => { Q.park(0); Q.run(1.5); Q.s.p2All('ice', 2); Q.run(0.3); });
    await shoot('frozen', await JF()); await ev(() => Q.run(2)); await shoot('thaw', await JF());
    await start({ ...KING, jelly: { ch: 2, a: 30, delay: 0 } });
    await ev(() => { Q.park(0); Q.park(1); Q.park(2); Q.run(1.5); const J = Q.s.jellies[0]; Q.s.kc.silt = { x: J.x + 0.8, y: J.y, r: 1.45, t: 3, dur: 3.5 }; Q.run(0.5); });
    await shoot('silt lit', await JF(), 200);
  }

  // ================================================================ King Crab
  if (want('king')) {
    const C0 = () => ev(() => Q.claw(Q.s.kc.claws[1].ph !== 'idle' ? 1 : 0));
    await start(KING);
    await ev(() => { Q.s.bx.boss.t = 99; Q.park(0); Q.park(1); Q.park(2); Q.run(1); });
    newRow('king', 'idle on the sea floor: breathing, eyes on the eggs, claws sway (whole phone, scaled)');
    await full('idle'); await shoot('body', await ev(() => Q.crab()), 220); await ev(() => Q.run(0.6)); await shoot('body +0.6 s', await ev(() => Q.crab()), 220);
    await shoot('left claw', await ev(() => Q.claw(0)));
    // a snap: egg at the top of the outer channel, the outer gap 15 degrees off
    await start(KING);
    await ev(() => { Q.park(1); Q.park(2); Q.egg(0, 3, 92); Q.s.bx.boss.t = 0.2; Q.until(() => Q.s.kc.claws.some((C) => C.ph === 'aim')); });
    const id = await ev(() => Q.s.kc.claws.findIndex((C) => C.ph === 'aim'));
    newRow('king', 'the telegraph: a claw rises over the gap, opens, tracks it, then locks (chevrons on the gap, a reticle on the egg)');
    for (const u of [0.15, 0.5, 0.8, 0.97]) { await ev(([u, id]) => Q.until(() => { const C = Q.s.kc.claws[id]; return C.ph !== 'aim' || C.warn >= u; }), [u, id]); await shoot(`aim ${Math.round(u * 100)}%`, await ev((id) => Q.claw(id), id), 170); }
    await full('aim (whole)');
    newRow('king', 'reach in through the gap, sweep along the channel, snap, pull the egg out to its pile');
    for (const ph of ['reach', 'sweep', 'snap', 'pull']) { await ev(([ph, id]) => Q.until(() => Q.s.kc.claws[id].ph === ph, 4), [ph, id]); await ev(() => Q.run(0.08)); await shoot(ph, await ev((id) => Q.claw(id), id), 170); }
    await ev((id) => Q.run(0.6), id); await shoot('pull +0.6', await ev((id) => Q.claw(id), id), 170);
    await ev((id) => Q.until(() => Q.s.kc.claws[id].ph === 'idle', 8), id); await ev(() => Q.run(0.3)); await shoot('on the pile', await ev(() => Q.crab()), 220);
    // stuck
    await start(KING);
    await ev(() => { Q.park(1); Q.park(2); Q.egg(0, 3, 92); Q.s.bx.boss.t = 0.2; Q.until(() => Q.s.kc.claws.some((C) => C.ph === 'sweep'), 6); });
    const sid = await ev(() => Q.s.kc.claws.findIndex((C) => C.ph === 'sweep'));
    await ev(() => { const R = Q.s.rings[3]; Q.setRing(3, (R.body.getAngle() * 180) / Math.PI + 25); Q.run(0.1); });
    newRow('king', 'turn the ring on it: the gap closes on the arm and the claw is STUCK (pinch marks, sweat, "hit me" arrow)');
    const st = await ev((id) => Q.claw(id), sid);
    await shoot(st.ph, st, 170); await ev(() => Q.run(0.6)); await shoot('stuck +0.6', await ev((id) => Q.claw(id), sid), 170); await shoot('crab', await ev(() => Q.crab()), 220);
    await full('stuck (whole)');
    newRow('king', 'hit (an egg knocks the stuck claw): ouch, the claw recoils hurt, a shell gone, an egg back; then a bonk on a closed ring');
    await ev((id) => { Q.s.kcHitClaw(Q.s.kc.claws[id], 'egg'); Q.run(0.1); }, sid);
    await shoot('hit', await ev((id) => Q.claw(id), sid), 170); await shoot('crab flinch', await ev(() => Q.crab()), 220);
    await ev(() => Q.run(0.4)); await shoot('hurt +0.5', await ev((id) => Q.claw(id), sid), 170);
    await start(KING);
    await ev(() => { Q.park(1); Q.park(2); Q.egg(0, 3, 92); Q.s.bx.boss.t = 0.2; Q.until(() => Q.s.kc.claws.some((C) => C.ph === 'aim' && C.warn > 0.75)); const R = Q.s.rings[3]; Q.setRing(3, (R.body.getAngle() * 180) / Math.PI - 50); Q.until(() => Q.s.kc.claws.some((C) => C.ph === 'bonk'), 4); Q.run(0.2); });
    await shoot('bonk', await ev(() => Q.claw(Q.s.kc.claws.findIndex((C) => C.ph === 'bonk'))), 170);
    newRow('king', 'frozen (frost nova): body and claws iced; stunned (lightning): spiral eyes, stars; a zapped claw recoils');
    await start(KING);
    await ev(() => { Q.s.bx.boss.t = 99; Q.park(0); Q.park(1); Q.park(2); Q.run(0.6); Q.s.p2All('ice', 4); Q.run(0.4); });
    await full('frozen (whole)'); await shoot('frozen body', await ev(() => Q.crab()), 220);
    await ev(() => Q.run(2.5)); await shoot('thawing', await ev(() => Q.crab()), 220);
    await ev(() => { Q.run(1); Q.s.p2All('bolt', 2); Q.run(0.3); }); await shoot('stunned', await ev(() => Q.crab()), 220);
    await start(KING);
    await ev(() => { Q.park(1); Q.park(2); Q.egg(0, 3, 92); Q.s.bx.boss.t = 0.2; Q.until(() => Q.s.kc.claws.some((C) => C.ph === 'sweep' || C.ph === 'reach'), 6); Q.run(0.05); const C = Q.s.kc.claws.find((C) => C.ph === 'sweep' || C.ph === 'reach'); Q.s.kcRecoil(C, 'zap'); Q.run(0.05); });
    await shoot('claw zapped', await C0(), 170);
    newRow('king', 'twin claws (phase 3) and the silt cloud');
    await start({ ...KING, eggs: 3, bossFight: { kind: 'kingcrab', delay: 0.5, phases: [{ attacks: ['snap2'], every: 3 }] }, rings: R4([{ a: 75 }, { a: 105 }]) });
    await ev(() => { Q.park(2); Q.egg(0, 3, 84); Q.egg(1, 3, 97); Q.s.bx.boss.t = 0.2; Q.until(() => Q.s.kc.claws.filter((C) => C.ph === 'aim' && C.warn > 0.6).length >= 1); });
    await full('twin aim');
    await start({ ...KING, bossFight: { kind: 'kingcrab', delay: 0.5, phases: [{ attacks: ['silt'], every: 3 }] } });
    await ev(() => { Q.park(1); Q.park(2); Q.egg(0, 3, 92); Q.s.bx.boss.t = 0.2; Q.until(() => Q.s.bx.boss.atk && Q.s.bx.boss.atk.ph === 'warn'); Q.run(0.4); });
    await shoot('stamp (silt telegraph)', await ev(() => Q.crab()), 220);
    await ev(() => { Q.until(() => !!Q.s.kc.silt, 3); Q.run(0.6); });
    await full('silt cloud');
    newRow('king', 'defeated: no shells left, it gives back every egg and sinks away');
    await start(KING);
    await ev(() => { Q.park(1); Q.park(2); Q.egg(0, 3, 92); Q.s.bx.boss.t = 0.2; Q.until(() => Q.s.kc.claws.some((C) => C.ph === 'pull' && C.eid), 8); Q.until(() => Q.s.kc.pile.length > 0, 6); const K = Q.s.kc; K.hp = 1; const C = K.claws[0]; C.hitCD = 0; Q.s.kcHitClaw(C, 'egg'); Q.run(0.2); });
    await shoot('beaten', await ev(() => Q.crab()), 220);
    await ev(() => Q.run(0.8)); await shoot('+1 s', await ev(() => Q.crab()), 220);
    await ev(() => Q.run(1.2)); await full('+2.2 s (whole)');
  }

  // ================================================================ underwater: eggs rising to the boat
  if (want('water')) {
    await start(RISE);
    newRow('water', 'eggs rising: buoyant, slow, a little bob and wobble, bubbles trail them (following egg 1)');
    await ev(() => Q.run(0.2));
    for (let i = 0; i < 6; i++) { await shoot(`${(0.5 + i * 0.6).toFixed(1)} s`, await ev(() => Q.eggAt(0))); await ev(() => Q.run(0.6)); }
    newRow('water', 'arriving: up through the last gap into the basket under the boat; the hen cheers');
    const boat = await ev(() => { const n = Q.s.nest.getPosition(); return { x: n.x, y: Q.s.groundY + 0.1 }; });
    for (let i = 0; i < 5; i++) { await shoot(`${i ? '+' + (i * 0.5).toFixed(1) : 'near'} s`, boat, 190); await ev(() => Q.run(0.5)); }
    await ev(() => Q.run(3)); await full('later (whole)');
    newRow('water', 'the level at rest: the surface, sky band, boat, basket, rise guide arrows (whole phone)');
    await start({ ...RISE, rings: R4() });
    await ev(() => Q.run(1.5)); await full('start'); await shoot('surface', await ev(() => { const n = Q.s.nest.getPosition(); return { x: n.x, y: Q.s.groundY }; }), 220);
  }

  // ================================================================ boss card + boss bar emblem
  if (want('card')) {
    newRow('card', 'the boss card (intro) at two moments, and the boss bar emblem chip (HUD crop)');
    for (const t of [0.2, 1.4]) {
      const f = path.join(out, `f-card-${t}.png`);
      const data = await ev((t) => { const c = document.createElement('canvas'); c.width = 440; c.height = 640; const x = c.getContext('2d'); x.fillStyle = '#1b2a3a'; x.fillRect(0, 0, 440, 640); x.scale(2, 2); __egg.thiefArt.drawBossCard(x, 'kingcrab', 10, 10, 200, 300, t, null); return c.toDataURL(); }, t);
      fs.writeFileSync(f, Buffer.from(data.split(',')[1], 'base64'));
      row.frames.push({ f, label: `card t=${t}`, C: 220 });
    }
    await start(KING);
    await ev(() => Q.run(0.5));
    const fb = path.join(out, `f-bar.png`);
    await p.screenshot({ path: fb, clip: { x: 0, y: 92, width: 200, height: 40 } });
    row.frames.push({ f: fb, label: 'boss bar chip', C: 200, h: 40 });
  }

  // ================================================================ sheets
  const kk = await ev(() => Q.k()).catch(() => 0);
  for (const [name, rows] of Object.entries(sheets)) {
    const cell = (x) => {
      const w = x.full ? 230 : x.C === 60 ? 210 : Math.round((x.C || CROP) * 1.4), h = x.full ? Math.round(230 * VH / VW) : x.h ? Math.round(w * x.h / x.C) : w * (x.C === 60 ? 1 : 1);
      return `<div><img style="width:${w}px;height:${x.full ? h : x.h ? h : w}px;display:block;border-radius:6px;object-fit:contain;background:#000" src="data:image/png;base64,${fs.readFileSync(x.f).toString('base64')}"><div style="padding:2px;max-width:${w}px">${x.label}</div></div>`;
    };
    const html = `<html><body style="margin:0;background:#10202c;color:#e6f4ff;font:14px sans-serif;padding:8px"><div style="margin:0 0 8px">reef ${name}: real phone scale (390x844 @2x, about ${kk.toFixed(1)} px per m); crops shown at 1.4x, close-ups 3.5x, whole phones at 0.6x</div>${rows.map((r) => `<div style="margin-bottom:10px"><div style="font-weight:bold;margin:2px 0 4px">${r.name}</div><div style="display:flex;gap:6px;flex-wrap:wrap">${r.frames.map(cell).join('')}</div></div>`).join('')}</body></html>`;
    const p2 = await b.newPage({ viewport: { width: 1300, height: 400 } });
    await p2.setContent(html);
    await p2.screenshot({ path: path.join(out, `reef-${name}.png`), fullPage: true });
    await p2.close();
    for (const r of rows) for (const x of r.frames) fs.unlinkSync(x.f);
    console.log('-> ' + path.join(out, `reef-${name}.png`));
  }
  for (const e of errors) console.log('PAGE ERROR: ' + e);
  await b.close();
  srv.close();
})();
