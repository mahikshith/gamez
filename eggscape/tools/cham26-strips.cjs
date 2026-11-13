// Level 26: Sly the chameleon, the orb thief (sim/chameleon.js, art render/cham26.js). Film strips at 390x844 with a 3x
// inset round him under each frame: entry, walking then fading into camo, eyes lock + tongue snatch + gulp, an egg beating
// him to an orb, eating the black flame and going sick, coughing an orb back up, a stone bump. Then a soak: 3000 frames
// of the real level with a snatch, a missed snatch, the sick cough-up, a stone bump and all six Chick Strikes, page errors
// counted. From the dev build.
// Usage: node tools/cham26-strips.cjs [dist/dev/index.html] [outDir] [--only=enter,camo,snatch,beat,sick,bump,soak,inlevel]
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const html = path.resolve(args[0] || 'dist/dev/index.html'), out = path.resolve(args[1] || 'qa/cham26');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  const ONLY = ((process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || '').split(',').filter(Boolean), want = (s) => !ONLY.length || ONLY.includes(s);
  const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + html); await p.waitForTimeout(900);
  const ev = (fn, a) => p.evaluate(fn, a);
  // o.delay: his entry (s); o.real: the real level (else a copy with no gusts and no lightning, so nothing else moves)
  const start = (o = {}) => ev((o) => {
    globalThis.__eggDebug = 1;
    const E = __egg, L = E.LEVELS.find((l) => l.id === 26);
    E.setSave({ mode: o.mode || 'medium', calm: false, seen: {}, strikeSeen: { freeze: 1, thunder: 1, bomb: 1, decoy: 1, tornado: 1, glue: 1 } });
    if (o.real) E.start(25, { direct: true });
    else {
      const D = { ...JSON.parse(JSON.stringify(L)), id: 990, chameleon: { ...L.chameleon, delay: o.delay ?? 0.5 } };
      delete D.gusts; delete D.weather;
      E.G.demo = D; E.start(-2, { direct: true });
    }
    E.G.paused = true; E.G.toast = null; E.G.toasts.length = 0;
    window.Q = {
      get s() { return E.G.sim; },
      get C() { return E.G.sim.chamOf(); },
      run(s) { for (let i = 0; i < Math.round(s * 60); i++) E.frame(1 / 60); },
      until(f, max = 30) { for (let i = 0; i < max * 60 && !f(); i++) E.frame(1 / 60); return f(); },
      quiet() { E.G.toast = null; E.G.toasts.length = 0; },
      scr(x, y) { const G = E.G, P = G.play; return { x: P.x + P.w / 2 + (x - G.cam.x) * G.cam.k, y: P.y + P.h / 2 - (y - G.cam.y) * G.cam.k }; },
      orb(type) { return E.G.sim.orbs.find((o) => o.alive && o.type === type); },
      egg(i, ch, a) {
        const s = E.G.sim, e = s.eggs[i], up = Math.sin(a) > 0, ring = s.rings[up ? ch - 1 : ch], r = ring.r + (up ? 1 : -1) * 0.38;
        e.body.setTransform({ x: r * Math.cos(a), y: r * Math.sin(a) }, 0); e.body.setLinearVelocity({ x: 0, y: 0 }); e.body.setAngularVelocity(0); e.body.setAwake(true);
        return e;
      },
      // the eggs out of the way: parked on the top of the inner chamber
      park() { const s = E.G.sim; s.eggs.forEach((e, i) => { if (e.alive && !e.saved) { e.body.setTransform({ x: -0.5 + 0.5 * i, y: 0.2 }, 0); e.body.setLinearVelocity({ x: 0, y: 0 }); } }); },
      // lay him down in channel ch, snout at world angle a, walking dir
      place(ch, a, dir) {
        const s = this.s, C = this.C, r = s.salMid(ch), m = C.pts.length || 60;
        C.rad = r; C.a = a; C.dir = dir; C.pts = []; C.climb = null; C.car = -1; C.climbCD = 6;
        for (let i = 0; i < m; i++) C.pts.push(s.salPt({}, a - dir * (i * 0.05) / r, r));
        s.salCarry(C); s.salSet(C, 'walk');
      },
      // in front of the orb of this type, d m back along its channel
      before(type, d, dir = 1) { const o = this.orb(type), r = this.s.salMid(o.ch); this.place(o.ch, Math.atan2(o.y, o.x) - dir * d / r, dir); return o; },
    };
    Q.run(0.3);
  }, o);
  const frames = [];
  const shot = async (name, label, who = 'mid') => {
    const g = await ev((who) => { Q.quiet(); __egg.frame(1 / 600); const C = Q.C; let q; if (C && C.pts.length > 2) q = who === 'head' ? C.pts[0] : C.pts[Math.min(C.pts.length - 1, 10)]; return q ? Q.scr(q.x, q.y) : { x: 195, y: 300 }; }, who);
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
  const seq = async (name, list, who) => { for (const [d, l, f] of list) { if (f) await ev(f); await ev((d) => Q.run(d), d); await shot(name, l, who); } };
  const inside = () => ev(() => Q.until(() => Q.C.ph !== 'wait' && Q.C.ph !== 'in', 20));

  if (want('enter')) {
    await start({ real: true });
    await ev(() => Q.until(() => Q.C.ph === 'in'));
    await seq('enter', [[0.05, 'Sly at the outer gap (4 s in)'], [0.6, 'creeps in through the gap'], [0.6, 'through the ring'], [0.6, 'tail follows'], [0.5, 'inside'], [1.2, 'after the nearest orb']]);
    sheet('enter');
  }
  if (want('camo')) {
    await start();
    await inside();
    await ev(() => { Q.park(); Q.before('bubble', 3.2); });
    await seq('camo', [[0.3, 'walking (no camo)'], [0.8, 'walking'], [0.01, 'stops to digest', () => { Q.s.salSet(Q.C, 'digest', 4); }], [0.4, 'fading into the ring'], [0.4, 'fading'], [0.5, 'camo 85%: eyes still move'], [1.0, 'camo'], [0.01, 'walks: camo shimmers off', () => { Q.C.t = 0; Q.run(0.1); }], [0.2, 'shimmer'], [0.35, 'back to green']]);
    sheet('camo');
  }
  if (want('snatch')) {
    await start();
    await inside();
    await ev(() => { Q.park(); Q.before('bubble', 2.6); });
    await ev(() => Q.until(() => Q.C.ph === 'lock', 10));
    await seq('snatch', [[0.02, 'in reach: stops'], [0.25, 'eyes converge'], [0.25, 'locked, throat bulges'], [0.17, 'tongue shoots'], [0.12, 'sticks'], [0.12, 'reels it in'], [0.15, 'orb at the mouth'], [0.12, 'gulp'], [0.3, 'the lump goes down'], [0.8, 'digesting']], 'head');
    sheet('snatch');
  }
  if (want('beat')) {
    await start();
    await inside();
    await ev(() => { Q.park(); Q.before('bubble', 2.6); });
    await ev(() => Q.until(() => Q.C.ph === 'lock', 10));
    await seq('beat', [[0.2, 'he locks on'], [0.15, 'an egg takes the orb first', () => { const o = Q.orb('bubble'); const e = Q.s.eggs[0]; e.body.setTransform({ x: o.x, y: o.y + 0.05 }, 0); e.body.setLinearVelocity({ x: 0, y: 0 }); }], [0.12, 'the tongue snaps on nothing'], [0.15, 'snap'], [0.25, 'annoyed blink'], [0.3, 'annoyed'], [0.5, 'off to the next orb']], 'head');
    sheet('beat');
  }
  if (want('sick')) {
    await start();
    await inside();
    await ev(() => { Q.park(); const C = Q.C; C.goods = [{ type: 'bubble', src: 'start' }]; C.ate = ['bubble']; Q.s.orbs.forEach((o) => { if (o.alive && o.type !== 'fire_black') { o.alive = false; Q.s.kill.push(o.body); } }); Q.before('fire_black', 2.6); }); // as if he ate the bubble already, and the eggs took the rest
    await ev(() => Q.until(() => Q.C.ph === 'lock', 10));
    await seq('sick', [[0.4, 'locks on the black flame'], [0.3, 'snatches it'], [0.35, 'gulp'], [0.35, 'sick: Bleurgh'], [0.3, 'retching'], [0.15, 'HURK'], [0.12, 'the bubble orb arcs out'], [0.2, 'arcing'], [0.25, 'lands in his channel'], [1.0, 'staggering, harmless'], [1.6, 'still sick']], 'head');
    sheet('sick');
  }
  if (want('bump')) {
    await start();
    await inside();
    await ev(() => { Q.park(); const n = Q.s.rings.length - 1; Q.C.goal = -1; Q.place(n, -Math.PI / 2 - 0.12, 1); Q.s.orbs.forEach((o) => { if (o.alive) { o.alive = false; Q.s.kill.push(o.body); } }); const e = Q.egg(0, n, -Math.PI / 2 + 0.4); e.stone = 8; });
    await ev(() => Q.until(() => Q.C.ph === 'stagger', 6));
    await seq('bump', [[0.02, 'a stone egg rolls into him'], [0.15, 'bumped aside'], [0.25, 'staggering'], [0.5, 'staggering 1 s'], [0.6, 'no orbs left: naps'], [1.0, 'napping']]);
    sheet('bump');
  }
  if (want('soak')) {
    await start({ real: true });
    const res = await ev(() => {
      const s = Q.s, n = {}, em = s.emit.bind(s);
      s.emit = (type, d) => { n[type] = (n[type] || 0) + 1; return em(type, d); };
      const ids = ['freeze', 'thunder', 'bomb', 'decoy', 'tornado', 'glue'], fired = [];
      let f = 0;
      const tick = () => {
        if (f > 1500 && f % 100 === 0 && fired.length < ids.length && s.state === 'play' && s.stkTargets().length) { const id = ids[fired.length], r = __egg.strike(id); fired.push(id + ':' + (r && r.ok ? 'ok' : JSON.stringify(r))); }
        __egg.frame(1 / 60); f++;
      };
      const until = (fn, max) => { for (let i = 0; i < max * 60 && !fn(); i++) tick(); return fn(); };
      const free = () => ['walk', 'nap', 'brake'].includes(Q.C.ph);
      until(() => Q.C.ph !== 'wait' && Q.C.ph !== 'in', 12);
      Q.park();
      // a snatch (the bubble), a miss (the thunder orb, taken by an egg), the black flame (sick, coughs the bubble), a stone bump
      until(free, 6); Q.before('bubble', 2.4); until(() => n.chamGulp, 6);
      until(() => free() || Q.C.ph === 'digest', 8); Q.C.t = 0; Q.run(0.05); const tb = Q.orb('thunder') ? 'thunder' : 'magnet'; Q.before(tb, 2.4); until(() => Q.C.ph === 'lock', 6); { const o = Q.orb(tb); if (o) { const e = s.eggs.find((x) => x.alive && !x.saved); e.body.setTransform({ x: o.x, y: o.y + 0.05 }, 0); e.body.setLinearVelocity({ x: 0, y: 0 }); } } until(() => n.chamMiss, 3); n.why = Q.C.ph + ':' + tb + ':' + !!Q.orb(tb);
      until(free, 4); Q.before('fire_black', 2.4); until(() => n.chamCoughed, 8);
      until(free, 9); Q.C.sickT = 0; const ch = s.rings.length - 1; Q.place(ch, -Math.PI / 2 - 0.12, 1); const e = Q.egg(1, ch, -Math.PI / 2 + 0.4); e.stone = 8; until(() => n.chamBump, 5);
      while (f < 3000) tick();
      const C = Q.C;
      return { frames: f, n: Object.fromEntries(Object.entries(n).filter(([k]) => /^cham|^stk|^p2Hit|why/.test(k))), fired, state: s.state, t: s.t.toFixed(1), ph: C.ph, nan: C.pts.some((q) => !isFinite(q.x) || !isFinite(q.y)) };
    });
    console.log('soak', JSON.stringify(res));
  }
  if (want('inlevel')) {
    await start({ real: true });
    await ev(() => { Q.until(() => Q.C.ph !== 'wait' && Q.C.ph !== 'in', 20); Q.before('bubble', 2.5); Q.until(() => Q.C.ph === 'reel', 10); Q.run(0.05); });
    await ev(() => { Q.quiet(); __egg.frame(1 / 600); });
    await p.screenshot({ path: path.join(out, 'inlevel.png') });
  }
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no page errors');
  await b.close();
})();
