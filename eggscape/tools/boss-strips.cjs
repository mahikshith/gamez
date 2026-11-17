// Boss variety move film strips (sim/bossmoves.js): each move alone on its boss level, at 390x844, DPR 2, from the dev build.
// Usage: node tools/boss-strips.cjs [dist/dev/index.html] [outDir] [--only=cage,shards,magma,whip,dive,wgust,pop]
// (copied from tools/crab-strips.cjs)
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const html = path.resolve(args[0] || 'dist/dev/index.html'), out = path.resolve(args[1] || 'qa/bosses');
const ONLY = ((process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || '').split(',').filter(Boolean);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + html); await p.waitForTimeout(900);
  const ev = (fn, a) => p.evaluate(fn, a);
  const start = (id, attack, extra = {}) => ev(([id, attack, extra]) => {
    const E = __egg, L = E.LEVELS.find((l) => l.id === id);
    E.setSave({ mode: 'medium', calm: true, seen: {} });
    const bf = { ...L.bossFight, delay: 0.4, phases: [{ attacks: [attack], every: 30 }] };
    E.G.demo = { ...JSON.parse(JSON.stringify(L)), id: 990, ...extra, bossFight: bf };
    E.start(-2, { direct: true }); E.G.paused = true; E.G.toast = null; E.G.toasts.length = 0;
    window.Q = {
      get s() { return E.G.sim; },
      run(s) { for (let i = 0; i < Math.round(s * 60); i++) E.frame(1 / 60); },
      until(f, max = 20) { for (let i = 0; i < max * 60 && !f(); i++) E.frame(1 / 60); return f(); },
      quiet() { E.G.toast = null; E.G.toasts.length = 0; E.G.popups.length = 0; },
      egg(i, ch, a) { const e = E.G.sim.eggs[i], R = E.G.sim.rings[ch], r = R.r - 0.08 - 0.3, w = (a * Math.PI) / 180; e.body.setTransform({ x: r * Math.cos(w), y: r * Math.sin(w) }, 0); e.body.setLinearVelocity({ x: 0, y: 0 }); },
      park(i) { const e = E.G.sim.eggs[i]; e.body.setTransform({ x: 0.25 * i - 0.4, y: 0.3 }, 0); e.body.setLinearVelocity({ x: 0, y: 0 }); },
      ringTo(i, deg) { const R = E.G.sim.rings[i]; R.target = (deg * Math.PI) / 180; },
      ringBy(i, deg) { const R = E.G.sim.rings[i]; R.target = R.body.getAngle() + (deg * Math.PI) / 180; },
      turn(i, deg, secs) { const n = Math.round(secs * 60), R = E.G.sim.rings[i], g = R.body.getAngle() + (deg * Math.PI) / 180; for (let k = 0; k < n; k++) { R.target = R.body.getAngle() + Math.max(-0.5, Math.min(0.5, g - R.body.getAngle())); E.frame(1 / 60); } },
      hold(i, on) { E.G.sim.rings[i].held = on; },
      ringAt(i, deg) { const R = E.G.sim.rings[i], a = (deg * Math.PI) / 180; R.body.setTransform(R.body.getPosition(), a); R.target = a; R.body.setAngularVelocity(0); },
      gapTo(i, worldDeg) { const R = E.G.sim.rings[i]; Q.ringAt(i, worldDeg - (R.gaps[0].a * 180) / Math.PI); },
      solidTo(i, worldDeg) { const R = E.G.sim.rings[i]; Q.ringAt(i, worldDeg - (R.gaps[0].a * 180) / Math.PI + 90); },
      scr(x, y) { const G = E.G, P = G.play; return { x: P.x + P.w / 2 + (x - G.cam.x) * G.cam.k, y: P.y + P.h / 2 - (y - G.cam.y) * G.cam.k }; },
    };
    Q.run(0.2);
  }, [id, attack, extra]);
  const frames = [];
  const shot = async (name, label) => {
    const r = await ev(() => { Q.quiet(); __egg.frame(1 / 600); const R = Q.s.outerR, a = Q.scr(0, R + 1.6), c = Q.scr(0, -(R + 2.3)); return { y0: a.y, y1: c.y }; });
    const f = path.join(out, `f-${name}-${String(frames.length).padStart(2, '0')}.png`);
    const y0 = Math.max(0, Math.floor(r.y0)), y1 = Math.min(844, Math.ceil(r.y1));
    await p.screenshot({ path: f, clip: { x: 0, y: y0, width: 390, height: y1 - y0 } });
    frames.push({ f, label });
  };
  const sheet = (name) => {
    const fs2 = frames.map((q) => q.f);
    require('child_process').execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageDraw
files=sys.argv[2:]; out=sys.argv[1]
ims=[Image.open(f).convert('RGB') for f in files]
cols=5
sc=0.62; ims=[i.resize((int(i.width*sc),int(i.height*sc)),Image.LANCZOS) for i in ims]
h=ims[0].height; w=ims[0].width
rows=(len(ims)+cols-1)//cols
sh=Image.new('RGB',(cols*w+(cols-1)*6,rows*h+(rows-1)*6),(20,20,24))
d=ImageDraw.Draw(sh)
for n,im in enumerate(ims):
    x,y=(n%cols)*(w+6),(n//cols)*(h+6)
    sh.paste(im,(x,y)); d.rectangle([x,y,x+26,y+18],fill=(0,0,0)); d.text((x+4,y+3),str(n),fill=(255,255,255))
sh.save(out,quality=84)
`, path.join(out, `strip-${name}.jpg`), ...fs2]);
    fs.writeFileSync(path.join(out, `strip-${name}.txt`), frames.map((q, i) => `${i}: ${q.label}`).join('\n'));
    for (const f of fs2) fs.unlinkSync(f);
    frames.length = 0;
  };
  const want = (s) => !ONLY.length || ONLY.includes(s);
  const upTo = (nm, ph) => ev(([nm, ph]) => Q.until(() => { const A = Q.s.bx.boss.atk; return A && A.name === nm && A.ph === ph; }), [nm, ph]);
  const seq = async (name, list) => { for (const [d, l, f] of list) { if (f) await ev(f); await ev((d) => Q.run(d), d); await shot(name, l); } };
  const prep = (f) => ev(f);

  if (want('cage')) {
    await start(20, 'cage');
    await prep(() => { for (const i of [1, 2]) Q.park(i); Q.solidTo(3, -90); Q.egg(0, 3, -90); Q.run(0.3); });
    await upTo('cage', 'warn');
    await seq('cage', [[0.1, 'telegraph: cell + crystal outlines'], [0.5, 'telegraph'], [0.5, 'telegraph: outlines fill']]);
    await upTo('cage', 'act');
    await seq('cage', [[0.15, 'crystals grow across the channel'], [0.5, 'sealed']]);
    await seq('cage', [[0.05, 'counter: turn the inner ring', () => Q.turn(2, 35, 0.6)], [0.05, 'stress cracks', () => Q.turn(2, 20, 0.4)], [0.3, 'sheared off', () => Q.turn(2, 20, 0.4)], [0.8, 'free']]);
    sheet('cage');
  }
  if (want('shards')) {
    await start(20, 'shards');
    await prep(() => { Q.park(1); Q.park(2); Q.gapTo(2, -90); Q.solidTo(3, -90); Q.egg(0, 3, -90); Q.run(0.6); });
    await upTo('shards', 'warn');
    await seq('shards', [[0.1, 'telegraph: wedge marked'], [0.5, 'glints fall, egg ringed red (no roof)'], [0.05, 'counter: turn a wall over it', () => Q.turn(2, 50, 0.5)], [0.2, 'roofed: ring turns green']]);
    await upTo('shards', 'act');
    await seq('shards', [[0.2, 'shards pour through'], [0.6, 'raining'], [0.8, 'raining'], [0.8, 'over']]);
    sheet('shards');
  }
  if (want('magma')) {
    await start(25, 'magma');
    await prep(() => { Q.park(1); Q.park(2); Q.gapTo(4, -72); Q.egg(0, 4, -90); Q.run(0.5); });
    await upTo('magma', 'warn');
    await seq('magma', [[0.05, 'telegraph: ring glows; counter: turn the gap under the egg', () => Q.turn(4, -45, 1.4)], [0.3, 'egg drops off the ring'], [0.2, 'glow pulses faster']]);
    await upTo('magma', 'act');
    await seq('magma', [[0.15, 'red-hot'], [0.8, 'thorns on it burn away'], [1.2, 'still hot'], [2.2, 'cooled']]);
    sheet('magma');
  }
  if (want('whip')) {
    await start(25, 'whip');
    await prep(() => { Q.park(1); Q.park(2); Q.gapTo(4, 0); Q.egg(0, 4, -90); Q.run(0.5); });
    await upTo('whip', 'warn');
    await seq('whip', [[0.1, 'telegraph: ring flashes, arrows coil'], [0.5, 'coiling'], [0.5, 'about to whip']]);
    await upTo('whip', 'act');
    await seq('whip', [[0.2, 'WHIP: ring knocked'], [0.4, 'quarter turn'], [0.4, 'done']]);
    await ev(() => { Q.s.bx.boss.t = 0.1; });
    await upTo('whip', 'warn');
    await seq('whip', [[0.6, 'second whip: player holds the ring', () => Q.hold(Q.s.bx.boss.atk.ring, true)]]);
    await upTo('whip', 'act');
    await seq('whip', [[0.2, 'held: only 20 deg'], [0.5, 'held', () => Q.hold(Q.s.bx.boss.atk ? 0 : 3, false)]]);
    sheet('whip');
  }
  if (want('dive')) {
    await start(30, 'dive', { eagle: undefined, snake: undefined });
    await prep(() => { Q.park(1); Q.park(2); Q.gapTo(4, -100); Q.egg(0, 5, -100); Q.run(0.6); });
    await upTo('dive', 'warn');
    await seq('dive', [[0.1, 'shadow circles wide, locked egg ringed red'], [0.5, 'shadow tightens'], [0.6, 'shadow small and dark on the egg']]);
    await upTo('dive', 'act');
    await seq('dive', [[0.1, 'the eagle stoops'], [0.35, 'snatched: carried up'], [0.4, 'carried up one ring'], [0.6, 'dropped in the channel inside']]);
    await ev(() => { Q.s.bx.boss.t = 0.1; });
    await upTo('dive', 'warn');
    await seq('dive', [[0.3, 'second dive: player turns a wall over the egg', () => Q.turn(3, 70, 1.2)], [0.3, 'roofed: ring turns green']]);
    await upTo('dive', 'act');
    await seq('dive', [[0.15, 'BONK: dizzy']]);
    sheet('dive');
  }
  if (want('wgust')) {
    await start(30, 'wgust', { eagle: undefined, snake: undefined });
    await prep(() => { Q.park(2); Q.egg(0, 5, -100); Q.egg(1, 4, -70); Q.run(0.6); });
    await upTo('wgust', 'warn');
    await seq('wgust', [[0.1, 'telegraph: chevrons show the way'], [0.6, 'chevrons fill in'], [0.6, 'about to blow']]);
    await upTo('wgust', 'act');
    await seq('wgust', [[0.4, 'beat 1: eggs pushed'], [0.5, 'beat 2'], [0.5, ''], [0.5, 'beat 3'], [0.8, 'over']]);
    sheet('wgust');
  }
  if (want('pop')) {
    await start(5, 'pop', { portals: [] });
    await prep(() => { Q.park(1); Q.park(2); Q.gapTo(3, -40); Q.egg(0, 3, -95); Q.run(0.6); });
    await upTo('pop', 'warn');
    await seq('pop', [[0.1, 'telegraph: dirt puffs, outline of where he stands'], [0.6, 'mound swells'], [0.6, 'puffs fly faster']]);
    await upTo('pop', 'act');
    await seq('pop', [[0.15, 'POP: the weasel blocks the channel'], [0.5, 'standing in the way']]);
    await seq('pop', [[0.05, 'counter: turn the floor ring so he comes round into the egg', () => Q.turn(3, -30, 0.6)], [0.12, 'bonk!'], [0.6, 'stunned at his den, egg fine']]);
    sheet('pop');
  }
  console.log('errors', errs.slice(0, 5));
  await b.close();
})();
