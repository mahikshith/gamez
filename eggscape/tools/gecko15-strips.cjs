// Level 15 villain (the frost gecko, render/gecko15.js) film strips: each attack (telegraph, act, after), hurt, phase,
// defeat and a Chick Strike, at 390x844 with a 3x inset of the gecko under each frame. From the dev build.
// Usage: node tools/gecko15-strips.cjs [dist/dev/index.html] [outDir]
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const html = path.resolve(args[0] || 'dist/dev/index.html'), out = path.resolve(args[1] || 'qa/gecko15');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  const ONLY = ((process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || '').split(',').filter(Boolean), want = (s) => !ONLY.length || ONLY.includes(s);
  const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + html); await p.waitForTimeout(900);
  const ev = (fn, a) => p.evaluate(fn, a);
  const start = (attack, mode = 'medium') => ev(([attack, mode]) => {
    globalThis.__eggDebug = 1;
    const E = __egg, L = E.LEVELS.find((l) => l.id === 15);
    E.setSave({ mode, calm: false, seen: {} });
    const bf = attack ? { ...L.bossFight, delay: 2.2, phases: [{ attacks: [attack], every: 30 }] } : L.bossFight;
    E.G.demo = { ...JSON.parse(JSON.stringify(L)), id: 990, bossFight: bf };
    E.start(-2, { direct: true }); E.G.paused = true; E.G.toast = null; E.G.toasts.length = 0;
    window.Q = {
      get s() { return E.G.sim; },
      run(s) { for (let i = 0; i < Math.round(s * 60); i++) E.frame(1 / 60); },
      until(f, max = 20) { for (let i = 0; i < max * 60 && !f(); i++) E.frame(1 / 60); return f(); },
      quiet() { E.G.toast = null; E.G.toasts.length = 0; },
      scr(x, y) { const G = E.G, P = G.play; return { x: P.x + P.w / 2 + (x - G.cam.x) * G.cam.k, y: P.y + P.h / 2 - (y - G.cam.y) * G.cam.k }; },
    };
    Q.run(1.2);
  }, [attack, mode]);
  const frames = [];
  const shot = async (name, label) => {
    const g = await ev(() => { Q.quiet(); __egg.frame(1 / 600); const a = __egg.geckoAnchor(); return a ? Q.scr(a.x, a.y) : { x: 195, y: 200 }; });
    const f = path.join(out, `f-${name}-${String(frames.length).padStart(2, '0')}.png`);
    await p.screenshot({ path: f });
    frames.push({ f, label, gx: g.x, gy: g.y });
  };
  const sheet = (name) => {
    require('child_process').execFileSync('python3', ['-c', `
import sys, json
from PIL import Image, ImageDraw
out=sys.argv[1]; fr=json.loads(sys.argv[2])
W,H,IW,IH=390,844,130,80
tiles=[]
for q in fr:
    im=Image.open(q['f']).convert('RGB')
    t=Image.new('RGB',(W,H+IH*3+4),(20,20,24))
    t.paste(im.resize((W,H),Image.LANCZOS),(0,0))
    x=min(max(q['gx']-IW/2,0),W-IW); y=min(max(q['gy']-IH/2,0),H-IH)
    t.paste(im.crop((int(x*3),int(y*3),int(x*3)+IW*3,int(y*3)+IH*3)),(0,H+4))
    d=ImageDraw.Draw(t); d.rectangle([x,y,x+IW,y+IH],outline=(255,220,90))
    d.rectangle([0,0,W,15],fill=(0,0,0)); d.text((4,2),q['label'],fill=(255,255,255))
    tiles.append(t)
sh=Image.new('RGB',(len(tiles)*(W+6)-6,tiles[0].height),(20,20,24))
for n,t in enumerate(tiles): sh.paste(t,(n*(W+6),0))
sh.save(out,quality=86)
`, path.join(out, `strip-${name}.jpg`), JSON.stringify(frames)]);
    for (const q of frames) fs.unlinkSync(q.f);
    frames.length = 0;
  };
  const upTo = (nm, ph) => ev(([nm, ph]) => Q.until(() => { const A = Q.s.bx.boss.atk; return A && A.name === nm && A.ph === ph; }), [nm, ph]);
  const seq = async (name, list) => { for (const [d, l, f] of list) { if (f) await ev(f); await ev((d) => Q.run(d), d); await shot(name, l); } };

  if (want('gale')) {
  await start('gale');
  await shot('gale', 'idle: before the attack');
  await upTo('gale', 'warn');
  await seq('gale', [[0.12, 'gale telegraph: scuttles upwind'], [0.5, 'telegraph: rears, throat puffs'], [0.4, 'telegraph: inhale']]);
  await upTo('gale', 'act');
  await seq('gale', [[0.2, 'act: he blows'], [1.2, 'act: gale along the rings'], [1.8, 'after: settles']]);
  sheet('gale'); }
  if (want('freeze')) {
  await start('freeze');
  await upTo('freeze', 'warn');
  await seq('freeze', [[0.1, 'freeze telegraph: crawls to the ring side'], [0.4, 'telegraph: turns in'], [0.3, 'telegraph: pads + lick, frost runs']]);
  await upTo('freeze', 'act');
  await seq('freeze', [[0.1, 'act: ring freezes'], [0.5, 'after: ring locked'], [1.4, 'after: walks off']]);
  sheet('freeze'); }
  if (want('icicles')) {
  await start('icicles');
  await upTo('icicles', 'warn');
  await seq('icicles', [[0.2, 'icicles telegraph: tail coils'], [0.22, 'telegraph: tail whips up'], [0.14, 'telegraph: icicles fly off the tail'], [0.25, 'telegraph: they hang']]);
  await upTo('icicles', 'act');
  await seq('icicles', [[0.15, 'act: they drop'], [0.8, 'after']]);
  sheet('icicles'); }
  if (want('hurt')) {
  await start('gale');
  await seq('hurt', [[0.3, 'before'], [0.08, 'hit: hop + shock', () => { const B = Q.s.bx.boss; B.flinch = 0.9; }], [0.2, 'hurt take'], [0.5, 'recovers'], [0.25, 'phase change: reels', () => { Q.s.bx.boss.dizzy = 1.8; }], [0.9, 'dizzy'], [1.4, 'back']]);
  sheet('hurt'); }
  if (want('defeat')) {
  await start('gale');
  await seq('defeat', [[0.3, 'before'], [0.25, 'beaten: shock, feet scrabble', () => { Q.s.state = 'winning'; Q.s.endTimer = 30; }], [0.5, 'slips'], [0.4, 'slides round the ring on his belly'], [0.4, 'slides'], [0.4, 'drops'], [0.35, 'skids across the yard'], [0.4, 'skids'], [0.5, 'skids away']]);
  sheet('defeat'); }
  for (const id of ['freeze', 'bomb']) {
    if (!want('strike')) break;
    await start('gale');
    await ev(() => Q.run(0.5));
    const r = await ev((id) => JSON.stringify(__egg.strike(id)), id);
    console.log('strike', id, r);
    await seq('strike-' + id, [[0.5, id + ' strike: chick hops'], [0.55, 'flies at HIM'], [0.35, 'flies'], [0.25, 'lands on him'], [0.5, 'reaction'], [1.2, 'reaction'], [2.5, 'after']]);
    sheet('strike-' + id);
  }

  // one clean in-level frame: the real level, mid-fight
  await start(null);
  await upTo('gale', 'act');
  await ev(() => Q.run(0.5));
  await ev(() => { Q.quiet(); __egg.frame(1 / 600); });
  await p.screenshot({ path: path.join(out, 'inlevel.png') });
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no page errors');
  await b.close();
})();
