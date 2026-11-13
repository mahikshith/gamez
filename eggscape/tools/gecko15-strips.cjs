// Level 15 villain (Baron von Brr, the frost gecko: sim/salamander.js species 'gecko', art render/gecko15.js) film
// strips at 390x844 with a 3x inset round him under each frame: he crawls in through the outer ring, climbs inward,
// icy feet (an egg sliding), the lick (frozen egg), each blizzard attack from inside the vault, and a trap / stun.
// Then a soak: the real level for 3000 frames with every attack, a lick, a trap and all six Chick Strikes, page errors
// counted. From the dev build.
// Usage: node tools/gecko15-strips.cjs [dist/dev/index.html] [outDir] [--only=enter,climb,icy,lick,gale,freeze,icicles,trap,soak]
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
  // attacks: null = the real level; [] = no attacks (he only hunts); ['gale'] = that one, every `every` s
  const start = (attacks, o = {}) => ev(([attacks, o]) => {
    globalThis.__eggDebug = 1;
    const E = __egg, L = E.LEVELS.find((l) => l.id === 15);
    E.setSave({ mode: o.mode || 'medium', calm: false, seen: {} });
    const bf = attacks ? { ...L.bossFight, delay: o.delay ?? 2.2, gecko: { ...L.bossFight.gecko, ...(o.gecko || {}) }, phases: [{ attacks: attacks.length ? attacks : ['gale'], every: attacks.length ? (o.every || 30) : 999 }] } : L.bossFight;
    if (attacks && !attacks.length) bf.delay = 999;
    E.G.demo = { ...JSON.parse(JSON.stringify(L)), id: 990, bossFight: bf };
    E.start(-2, { direct: true }); E.G.paused = true; E.G.toast = null; E.G.toasts.length = 0;
    window.Q = {
      get s() { return E.G.sim; },
      get C() { return E.G.sim.geckoOf(); },
      run(s) { for (let i = 0; i < Math.round(s * 60); i++) E.frame(1 / 60); },
      until(f, max = 30) { for (let i = 0; i < max * 60 && !f(); i++) E.frame(1 / 60); return f(); },
      quiet() { E.G.toast = null; E.G.toasts.length = 0; },
      scr(x, y) { const G = E.G, P = G.play; return { x: P.x + P.w / 2 + (x - G.cam.x) * G.cam.k, y: P.y + P.h / 2 - (y - G.cam.y) * G.cam.k }; },
      // put egg i on the floor of channel ch at world angle a (rad), at rest
      egg(i, ch, a) {
        const s = E.G.sim, e = s.eggs[i], up = Math.sin(a) > 0, ring = s.rings[up ? ch - 1 : ch], r = ring.r + (up ? 1 : -1) * 0.38;
        e.body.setTransform({ x: r * Math.cos(a), y: r * Math.sin(a) }, 0); e.body.setLinearVelocity({ x: 0, y: 0 }); e.body.setAngularVelocity(0); e.body.setAwake(true);
        return e;
      },
      // the egg ahead of his snout, d m along his channel
      // the egg at rest at the bottom of his channel (eggs roll down: he finds them there)
      eggLow(i) { return this.egg(i, this.s.salCh(this.C), -Math.PI / 2 + 0.05 * this.C.dir); },
      near(i, d) { const e = this.s.eggs[i], p = e.body.getPosition(), h = this.C.pts[0]; return Math.hypot(p.x - h.x, p.y - h.y) < d; },
      eggAhead(i, d) { const C = this.C, h = C.pts[0], ch = this.s.salCh(C), a = Math.atan2(h.y, h.x) + C.dir * d / Math.hypot(h.x, h.y); return this.egg(i, ch, a); },
    };
    Q.run(0.5);
  }, [attacks, o]);
  const frames = [];
  const shot = async (name, label) => {
    const g = await ev(() => { Q.quiet(); __egg.frame(1 / 600); const a = __egg.geckoAnchor(); return a ? Q.scr(a.x, a.y) : { x: 195, y: 300 }; });
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
  const inside = () => ev(() => Q.until(() => Q.C.ph !== 'wait' && Q.C.ph !== 'in'));

  if (want('enter')) {
    await start(null);
    await ev(() => Q.until(() => Q.C.ph === 'in'));
    await seq('enter', [[0.05, 'appears at the outer gap'], [0.5, 'crawls in through the gap'], [0.7, 'through the ring'], [0.6, 'tail follows'], [0.8, 'inside: picks a way'], [1.2, 'walks the outer channel']]);
    sheet('enter');
  }
  if (want('climb')) {
    await start([], {});
    await inside();
    const ok = await ev(() => Q.until(() => Q.C.climb && Q.s.salCrossing(Q.C), 40));
    console.log('climb found', ok);
    await seq('climb', [[0.05, 'climbing inward through a gap'], [0.7, 'climbing'], [0.8, 'climbing'], [1.0, 'in the next channel'], [1.5, 'hunting on']]);
    sheet('climb');
  }
  if (want('icy')) {
    await start([], {});
    await inside();
    await ev(() => Q.run(2.5));
    await seq('icy', [[0.05, 'icy feet: frost prints, iced floor'], [0.01, 'an egg on his icy trail', () => { const C = Q.C, q = C.pts[Math.min(C.pts.length - 1, 30)]; Q.egg(0, Q.s.salCh(C), Math.atan2(q.y, q.x) + 0.12 * C.dir); }], [0.25, 'it slides fast'], [0.25, 'slides'], [0.35, 'slides'], [0.5, 'hard to stop']]);
    sheet('icy');
  }
  if (want('lick')) {
    await start([], {});
    await inside();
    await ev(() => Q.run(0.5));
    await ev(() => { Q.eggLow(0); });
    await ev(() => Q.until(() => Q.C.ph === 'lick' || (Q.C.ph === 'brake' && Q.C.pend === 'lick'), 30));
    await seq('lick', [[0.1, 'reaches the egg'], [0.3, 'the lick'], [0.2, 'ice runs over it'], [0.4, 'frozen solid'], [0.9, 'loses interest, wanders off'], [1.2, 'frozen egg rides its ring'], [0.9, 'about to thaw'], [0.4, 'thawed']]);
    sheet('lick');
  }
  for (const nm of ['gale', 'freeze', 'icicles']) {
    if (!want(nm)) continue;
    await start([nm], { delay: 9 });
    await inside();
    await ev(() => { Q.eggAhead(1, 2.4); Q.eggAhead(2, -2.6); });
    await upTo(nm, 'warn');
    if (nm === 'gale') await seq(nm, [[0.1, 'gale telegraph: faces the way it will blow'], [0.45, 'telegraph: rears, throat puffs'], [0.35, 'telegraph: inhale']]);
    if (nm === 'freeze') await seq(nm, [[0.1, 'freeze telegraph: turns to his wall'], [0.35, 'slaps the ring'], [0.35, 'licks, frost runs to it']]);
    if (nm === 'icicles') await seq(nm, [[0.2, 'icicles telegraph: tail coils'], [0.22, 'tail whips'], [0.14, 'icicles fly off the tail'], [0.25, 'they hang']]);
    await upTo(nm, 'act');
    await seq(nm, [[0.2, 'act: ' + nm + ' from him'], [0.8, 'act'], [1.6, 'after: back to the hunt']]);
    sheet(nm);
  }
  if (want('trap')) {
    await start([], {});
    await inside();
    await ev(() => Q.run(0.6));
    for (const id of ['glue', 'thunder', 'freeze']) {
      const r = await ev((id) => JSON.stringify(__egg.strike(id)), id);
      console.log('strike', id, r);
      await seq('trap', [[0.75, id + ': the chick flies at him'], [0.3, id + ': hit'], [1.0, id + ': trapped / stunned']]);
      await ev((id) => Q.run(id === 'freeze' ? 0 : 3), id);
    }
    sheet('trap');
  }
  if (want('soak')) {
    // the real level's fight, all attacks in rotation: 3000 frames, every strike, a lick, a trap; count what happened
    await start(['gale', 'freeze', 'icicles'], { every: 2.5, delay: 4 });
    const res = await ev(() => {
      const s = Q.s, n = {}, em = s.emit.bind(s);
      s.emit = (type, d) => { n[type] = (n[type] || 0) + 1; if (type === 'bossAct') n['act:' + d.attack] = (n['act:' + d.attack] || 0) + 1; return em(type, d); };
      const ids = ['freeze', 'thunder', 'bomb', 'decoy', 'tornado', 'glue'], fired = [];
      for (let f = 0; f < 3000; f++) {
        if (f > 700 && f % 20 === 0 && !n.geckoLick && Q.C.ph === 'walk' && Q.s.eggs[0].alive && !Q.s.eggs[0].saved) Q.eggAhead(0, 0.3); // a lick: an egg at his snout
        if (f > 300 && f % 380 === 0 && fired.length < ids.length && Q.s.state === 'play') { const id = ids[fired.length], r = __egg.strike(id); fired.push(id + ':' + (r && r.ok ? 'ok' : JSON.stringify(r))); }
        __egg.frame(1 / 60);
      }
      return { n, fired, state: Q.s.state, t: Q.s.t.toFixed(1) };
    });
    console.log('soak', JSON.stringify(res));
  }

  // one clean in-level frame: the real level, him inside the rings near an egg
  if (want('inlevel')) {
    await start([], {});
    await inside();
    await ev(() => Q.run(1.5));
    await ev(() => { Q.eggLow(0); });
    await ev(() => Q.until(() => Q.near(0, 1.3), 30));
    await ev(() => { Q.quiet(); __egg.frame(1 / 600); });
    await p.screenshot({ path: path.join(out, 'inlevel.png') });
  }
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no page errors');
  await b.close();
})();
