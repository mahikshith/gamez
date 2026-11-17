// King Crab move film strips (level 40 art and rings, one attack at a time) at 390x844, DPR 2, from the dev build.
// Usage: node tools/crab-strips.cjs [dist/dev/index.html] [outDir] [--only=bubbles,barnacles,whirl,poses]
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const html = path.resolve(args[0] || 'dist/dev/index.html'), out = path.resolve(args[1] || 'qa/crab');
const ONLY = ((process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || '').split(',').filter(Boolean);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + html); await p.waitForTimeout(900);
  const ev = (fn, a) => p.evaluate(fn, a);
  const start = (attack, every = 30) => ev(([attack, every]) => {
    const E = __egg, L = E.LEVELS.find((l) => l.id === 40);
    E.setSave({ mode: 'medium', calm: true, seen: { kcBub: 1, kcWhirl: 1, kcBar: 1 } });
    E.G.demo = { ...JSON.parse(JSON.stringify(L)), id: 990, jelly: undefined, bossFight: { kind: 'kingcrab', delay: 0.4, phases: [{ attacks: [attack], every }] } };
    E.start(-2, { direct: true }); E.G.paused = true; E.G.toast = null; E.G.toasts.length = 0;
    window.Q = {
      get s() { return E.G.sim; },
      run(s) { for (let i = 0; i < Math.round(s * 60); i++) E.frame(1 / 60); },
      until(f, max = 20) { for (let i = 0; i < max * 60 && !f(); i++) E.frame(1 / 60); return f(); },
      quiet() { E.G.toast = null; E.G.toasts.length = 0; E.G.popups.length = 0; },
      egg(i, ch, a) { const e = E.G.sim.eggs[i], R = E.G.sim.rings[ch], r = R.r - 0.08 - 0.3, w = (a * Math.PI) / 180; e.body.setTransform({ x: r * Math.cos(w), y: r * Math.sin(w) }, 0); e.body.setLinearVelocity({ x: 0, y: 0 }); },
      park(i) { const e = E.G.sim.eggs[i]; e.body.setTransform({ x: 0.25 * i - 0.4, y: 0.3 }, 0); e.body.setLinearVelocity({ x: 0, y: 0 }); },
      ringTo(i, deg) { const R = E.G.sim.rings[i]; R.target = (deg * Math.PI) / 180; },
      ringAt(i, deg) { const R = E.G.sim.rings[i], a = (deg * Math.PI) / 180; R.body.setTransform(R.body.getPosition(), a); R.target = a; R.body.setAngularVelocity(0); },
      gapTo(i, worldDeg) { const R = E.G.sim.rings[i]; Q.ringAt(i, worldDeg - (R.gaps[0].a * 180) / Math.PI); },
      scr(x, y) { const G = E.G, P = G.play; return { x: P.x + P.w / 2 + (x - G.cam.x) * G.cam.k, y: P.y + P.h / 2 - (y - G.cam.y) * G.cam.k }; },
    };
    for (const e of E.G.sim.eggs) { /* eggs start in the core */ }
    Q.run(0.2);
  }, [attack, every]);
  const frames = [];
  const shot = async (name, label) => {
    const r = await ev(() => { Q.quiet(); __egg.frame(1 / 600); const R = Q.s.outerR, a = Q.scr(0, R + 0.7), c = Q.scr(0, -(R + 2.3)); return { y0: a.y, y1: c.y }; });
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
h=ims[0].height; w=ims[0].width; cols=6
sc=0.62; ims=[i.resize((int(i.width*sc),int(i.height*sc)),Image.LANCZOS) for i in ims]
h=ims[0].height; w=ims[0].width
rows=(len(ims)+cols-1)//cols
sh=Image.new('RGB',(cols*w+(cols-1)*6,rows*h+(rows-1)*6),(20,20,24))
for n,im in enumerate(ims):
    sh.paste(im,((n%cols)*(w+6),(n//cols)*(h+6)))
sh.save(out,quality=84)
`, path.join(out, `strip-${name}.jpg`), ...fs2]);
    fs.writeFileSync(path.join(out, `strip-${name}.txt`), frames.map((q, i) => `${i}: ${q.label}`).join('\n'));
    frames.length = 0;
  };
  const want = (s) => !ONLY.length || ONLY.includes(s);
  const atkIs = (nm, ph) => `(() => { const A = Q.s.bx.boss.atk; return A && A.name === '${nm}' && A.ph === '${ph}'; })()`;
  const upTo = (nm, ph, extra = '') => ev(([nm, ph]) => Q.until(() => { const A = Q.s.bx.boss.atk; return A && A.name === nm && A.ph === ph; }), [nm, ph]);

  if (want('bubbles')) {
    await start('bubbles');
    await ev(() => { for (const i of [1, 2, 3]) Q.park(i); Q.gapTo(4, 80); Q.egg(0, 4, 118); });
    await ev(() => Q.run(0.2));
    await upTo('bubbles', 'warn');
    for (const [d, l] of [[0.15, 'wind-up: crab squats, column appears'], [0.45, 'telegraph'], [0.45, 'telegraph'], [0.4, 'it swells, mouth wide']]) { await ev((d) => Q.run(d), d); await shot('bubbles', l); }
    await upTo('bubbles', 'act'); await ev(() => Q.run(0.2)); await shot('bubbles', 'blow: plume starts');
    for (const [d, l] of [[0.6, 'plume sweeps, egg caught'], [0.6, 'egg carried'], [0.6, 'carried'], [0.6, 'under the open gap'], [0.5, 'rides out through the gap']]) { await ev((d) => Q.run(d), d); await shot('bubbles', l); }
    await ev(() => Q.run(1.2)); await shot('bubbles', 'plume over; crab relaxes');
    sheet('bubbles');
  }
  if (want('barnacles')) {
    await start('barnacles');
    await ev(() => { for (const i of [2, 3]) Q.park(i); Q.egg(0, 4, 118); Q.egg(1, 3, -45); });
    await ev(() => Q.run(0.2));
    await upTo('barnacles', 'warn');
    for (const [d, l] of [[0.15, 'wind-up: claws open and lift, rings marked'], [0.4, 'marks pulse'], [0.4, 'marks pulse'], [0.4, 'claws shake']]) { await ev((d) => Q.run(d), d); await shot('barnacles', l); }
    await upTo('barnacles', 'act'); await ev(() => Q.run(0.15)); await shot('barnacles', 'flick: claws snap shut');
    await ev(() => Q.run(0.25)); await shot('barnacles', 'barnacles in flight');
    await ev(() => Q.run(0.5)); await shot('barnacles', 'clamped on the gaps');
    await ev(() => Q.run(1.2)); await shot('barnacles', 'plugged: egg blocked');
    await ev(() => { Q.ringTo(4, (Q.s.rings[4].body.getAngle() * 180) / Math.PI + 100); Q.run(0.4); }); await shot('barnacles', 'counter: turn the ring, grit rim grows');
    await ev(() => Q.run(0.5)); await shot('barnacles', 'scraped off');
    await ev(() => Q.run(0.8)); await shot('barnacles', 'ring-3 barnacle remains');
    sheet('barnacles');
  }
  if (want('whirl')) {
    await start('whirl');
    await ev(() => { for (const i of [2, 3]) Q.park(i); Q.gapTo(3, -140); Q.egg(0, 3, 100); Q.egg(1, 3, 120); });
    await ev(() => Q.run(0.2));
    await upTo('whirl', 'warn');
    for (const [d, l] of [[0.15, 'tucks in: legs pulled up'], [0.45, 'spiral marks the channel'], [0.45, 'spinning up'], [0.45, 'spinning']]) { await ev((d) => Q.run(d), d); await shot('whirl', l); }
    await upTo('whirl', 'act'); await ev(() => Q.run(0.3)); await shot('whirl', 'whirlpool on: eggs dragged round');
    await ev(() => Q.run(0.8)); await shot('whirl', 'dragged');
    await ev(() => { Q.ringTo(3, (Q.s.rings[3].body.getAngle() * 180) / Math.PI - 80); Q.run(0.3); }); await shot('whirl', 'counter: turn the ring against it, flow slackens (green)');
    await ev(() => Q.run(0.5)); await shot('whirl', 'held');
    await ev(() => Q.run(1.0)); await shot('whirl', 'whirl dies down');
    sheet('whirl');
  }
  console.log('errors', errs.slice(0, 5));
  await b.close();
})();
