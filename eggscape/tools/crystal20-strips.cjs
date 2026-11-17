// Level 20 villains (Duke Quartz, the crystal thorn-back, and his cousin Spike: sim/thornback.js, art render/crystal20.js)
// film strips at 390x844 with a 3x inset round the subject under each frame: entry, crystal flick and standing crystal,
// hip-check, stone-egg flip, each golem attack from him, Spike's entry, the duel, defeat. Then a soak: 3000 frames with
// every attack, a drop, a hip-check, a flip and all six Chick Strikes, page errors counted. From the dev build.
// Usage: node tools/crystal20-strips.cjs [dist/dev/index.html] [outDir] [--only=enter,drop,hip,flip,stomp,punch,cage,shards,spike,duel,defeat,soak,inlevel]
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const html = path.resolve(args[0] || 'dist/dev/index.html'), out = path.resolve(args[1] || 'qa/crystal20');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  const ONLY = ((process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || '').split(',').filter(Boolean), want = (s) => !ONLY.length || ONLY.includes(s);
  const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + html); await p.waitForTimeout(900);
  const ev = (fn, a) => p.evaluate(fn, a);
  // attacks: null = the real level; [] = no attacks; ['stomp'] = that one. o.spike: Spike's delay (999 = he stays out)
  const start = (attacks, o = {}) => ev(([attacks, o]) => {
    globalThis.__eggDebug = 1;
    const E = __egg, L = E.LEVELS.find((l) => l.id === 20);
    E.setSave({ mode: o.mode || 'medium', calm: false, seen: {} });
    const bf = attacks ? { ...L.bossFight, delay: o.delay ?? 2.2, thorn: { ...L.bossFight.thorn }, spike: { ...L.bossFight.spike, delay: o.spike ?? 999 }, phases: [{ attacks: attacks.length ? attacks : ['stomp'], every: attacks.length ? (o.every || 30) : 999 }] } : L.bossFight;
    if (attacks && !attacks.length) bf.delay = 999;
    E.G.demo = { ...JSON.parse(JSON.stringify(L)), id: 990, bossFight: bf };
    E.start(-2, { direct: true }); E.G.paused = true; E.G.toast = null; E.G.toasts.length = 0;
    window.Q = {
      get s() { return E.G.sim; },
      get C() { return E.G.sim.duke(); },
      get S() { return E.G.sim.thornOf('spike'); },
      run(s) { for (let i = 0; i < Math.round(s * 60); i++) E.frame(1 / 60); },
      until(f, max = 30) { for (let i = 0; i < max * 60 && !f(); i++) E.frame(1 / 60); return f(); },
      quiet() { E.G.toast = null; E.G.toasts.length = 0; },
      scr(x, y) { const G = E.G, P = G.play; return { x: P.x + P.w / 2 + (x - G.cam.x) * G.cam.k, y: P.y + P.h / 2 - (y - G.cam.y) * G.cam.k }; },
      mid(C) { const q = C.pts[Math.min(C.pts.length - 1, 14)]; return q; },
      egg(i, ch, a) {
        const s = E.G.sim, e = s.eggs[i], up = Math.sin(a) > 0, ring = s.rings[up ? ch - 1 : ch], r = ring.r + (up ? 1 : -1) * 0.38;
        e.body.setTransform({ x: r * Math.cos(a), y: r * Math.sin(a) }, 0); e.body.setLinearVelocity({ x: 0, y: 0 }); e.body.setAngularVelocity(0); e.body.setAwake(true);
        return e;
      },
      eggAhead(i, d, C = Q.C) { const h = C.pts[0], ch = this.s.salCh(C), a = Math.atan2(h.y, h.x) + C.dir * d / Math.hypot(h.x, h.y); return this.egg(i, ch, a); },
      // lay a crawler down in channel ch, snout at world angle a, walking dir
      place(C, ch, a, dir) {
        const s = this.s, r = s.salMid(ch), m = C.pts.length || 60;
        C.rad = r; C.a = a; C.dir = dir; C.pts = []; C.climb = null; C.car = -1; C.climbCD = 6;
        for (let i = 0; i < m; i++) C.pts.push(s.salPt({}, a - dir * (i * 0.05) / r, r));
        s.salCarry(C); s.salSet(C, 'walk');
      },
    };
    Q.run(0.5);
  }, [attacks, o]);
  const frames = [];
  const shot = async (name, label, who = 'C') => {
    const g = await ev((who) => { Q.quiet(); __egg.frame(1 / 600); const head = who.endsWith('H'), C = who === 'both' ? null : Q[head ? who.slice(0, -1) : who]; let q; if (C && C.pts.length > 2) q = head ? C.pts[0] : Q.mid(C); else if (who === 'both' && Q.C.pts.length > 2 && Q.S.pts.length > 2) { const a = Q.C.pts[0], b = Q.S.pts[0]; q = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; } return q ? Q.scr(q.x, q.y) : { x: 195, y: 300 }; }, who);
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
  const seq = async (name, list, who) => { for (const [d, l, f] of list) { if (f) await ev(f); await ev((d) => Q.run(d), d); await shot(name, l, who); } };
  const inside = (w = 'C') => ev((w) => Q.until(() => Q[w].ph !== 'wait' && Q[w].ph !== 'in'), w);

  if (want('enter')) {
    await start(null);
    await ev(() => Q.until(() => Q.C.ph === 'in'));
    await seq('enter', [[0.05, 'Duke Quartz at the outer gap'], [0.6, 'crawls in through the gap'], [0.7, 'through the ring'], [0.7, 'tail follows'], [0.7, 'inside'], [1.2, 'waddles the outer channel']]);
    sheet('enter');
  }
  if (want('drop')) {
    await start([], {});
    await inside();
    await ev(() => { Q.C.dropT = 99; Q.run(3.5); Q.C.dropT = 0; });
    await ev(() => Q.until(() => Q.C.ph === 'drop', 10));
    await seq('drop', [[0.1, 'hunches'], [0.25, 'flicks a crystal off his back'], [0.25, 'it flies behind him'], [0.3, 'it stands as a spike'], [1.5, 'he walks on: it blocks the floor'], [4.4, 'crumbling after 8 s'], [0.6, 'gone']]);
    sheet('drop');
  }
  if (want('hip')) {
    await start([], {});
    await inside();
    await ev(() => { Q.C.dropT = 99; Q.run(0.6); Q.place(Q.C, Q.s.rings.length - 1, -Math.PI / 2 - 0.35, 1); Q.egg(0, Q.s.rings.length - 1, -Math.PI / 2 + 0.02); });
    await ev(() => Q.until(() => Q.C.ph === 'hip' || (Q.C.ph === 'brake' && Q.C.pend === 'hip'), 20));
    await seq('hip', [[0.05, 'reaches the egg'], [0.25, 'crouch'], [0.15, 'hip-check'], [0.25, 'egg shoved along'], [0.5, 'egg rolls on'], [1.0, 'loses interest']], 'CH');
    sheet('hip');
  }
  if (want('flip')) {
    await start([], {});
    await inside();
    // at the bottom of the outer channel: a stone egg rolls down the slope into him
    await ev(() => { Q.C.dropT = 99; Q.C.bored = 99; Q.run(0.6); Q.place(Q.C, Q.s.rings.length - 1, -Math.PI / 2 - 0.1, 1); const e = Q.egg(0, Q.s.rings.length - 1, -Math.PI / 2 + 0.45); e.stone = 8; });
    await ev(() => Q.until(() => Q.C.ph === 'flip' || Q.s.eggs[0].body.getPosition().x < Q.C.pts[0].x + 0.9, 6));
    await seq('flip', [[0.02, 'a stone egg rolls at him'], [0.25, 'flipped on his back'], [0.5, 'legs kicking'], [1.5, 'still down (4 s)'], [1.9, 'rights himself'], [0.6, 'back to the hunt']]);
    sheet('flip');
  }
  for (const nm of ['stomp', 'punch', 'cage', 'shards']) {
    if (!want(nm)) continue;
    await start([nm], { delay: 7 });
    await inside();
    await ev(() => { Q.C.dropT = 99; Q.C.bored = 99; Q.egg(1, 2, -Math.PI / 2 + 0.25); Q.egg(2, 3, -Math.PI / 2 - 0.35); }); // two eggs resting in channel valleys: targets for the cage and the rain
    await upTo(nm, 'warn');
    if (nm === 'stomp') await seq(nm, [[0.1, 'stomp telegraph: he rears'], [0.4, 'rears high'], [0.4, 'about to slam']]);
    if (nm === 'punch') await seq(nm, [[0.1, 'punch telegraph: tail coils'], [0.45, 'tail cocked at the wall'], [0.4, 'about to swipe']]);
    if (nm === 'cage') await seq(nm, [[0.2, 'cage telegraph: he presses down'], [0.5, 'crystals race to the egg'], [0.6, 'they reach the marks']]);
    if (nm === 'shards') await seq(nm, [[0.2, 'shards telegraph: he shakes his back'], [0.5, 'shards leave his spines'], [0.6, 'they arc to the wedge']]);
    await upTo(nm, 'act');
    await seq(nm, [[0.08, 'act: ' + nm], [0.5, 'after'], [1.4, 'back to the hunt']]);
    sheet(nm);
  }
  if (want('spike')) {
    await start([], { spike: 1.0 });
    await ev(() => Q.until(() => Q.S.ph === 'in'));
    await seq('spike', [[0.05, 'Spike at another gap'], [0.7, 'crawls in'], [0.8, 'through the ring'], [0.8, 'inside'], [1.2, 'hunting'], [0.01, 'drops a thorn', () => { Q.S.dropT = 0; Q.until(() => Q.S.ph === 'drop', 5); Q.run(0.45); }], [0.7, 'the thorn stands']], 'S');
    sheet('spike');
  }
  if (want('duel')) {
    await start([], { spike: 1.0 });
    await inside(); await inside('S');
    await ev(() => { const s = Q.s, ch = s.rings.length - 1; Q.C.dropT = Q.S.dropT = 99; Q.C.bored = Q.S.bored = 99; Q.place(Q.C, ch, -Math.PI / 2 - 0.17, 1); Q.place(Q.S, ch, -Math.PI / 2 + 0.17, -1); Q.C.fcd = Q.S.fcd = 0; Q.C.weakT = Q.S.weakT = null; Q.C.duels = 0; for (const e of s.eggs) if (e.alive) Q.egg(e.id - 1, ch - 2, Math.PI / 2); });
    await ev(() => Q.until(() => Q.C.ph === 'duel', 8));
    await seq('duel', [[0.05, 'they meet: square-up'], [0.35, 'rear, rattle, growl'], [0.4, 'beat 1: Spike flicks a thorn'], [0.3, 'the Duke bats it off'], [0.45, 'beat 2: the Duke flicks a crystal'], [0.25, 'Spike ducks'], [0.45, 'beat 3: tail swipes'], [0.15, 'Spike takes it'], [0.3, 'thrown 1 m'], [0.6, 'Spike on his back'], [0.8, 'the Duke gloats, walks on'], [1.5, 'Spike still down']], 'both');
    sheet('duel');
  }
  if (want('defeat')) {
    await start([], {});
    await inside();
    await ev(() => Q.run(1));
    await ev(() => { const s = Q.s, C = Q.C; s.salRelease(C); C.ph = 'beat'; C.pend = null; C.climb = null; }); // his beaten exit as the win plays it (salEndStep), without the vault burst and win card that cover it in the game
    await seq('defeat', [[0.1, 'beaten: goes limp'], [0.6, 'dazed'], [0.6, 'trundles off'], [0.45, 'off along the channel'], [0.35, 'fading in a glitter'], [0.4, 'gone']]);
    sheet('defeat');
  }
  if (want('soak')) {
    await start(['stomp', 'cage', 'punch', 'shards'], { every: 2.5, delay: 4, spike: 12 });
    const res = await ev(() => {
      const s = Q.s, n = {}, em = s.emit.bind(s), ch = s.rings.length - 1, B = -Math.PI / 2;
      s.emit = (type, d) => { n[type] = (n[type] || 0) + 1; if (type === 'bossAct') n['act:' + d.attack] = (n['act:' + d.attack] || 0) + 1; return em(type, d); };
      const ids = ['freeze', 'thunder', 'bomb', 'decoy', 'tornado', 'glue'], fired = [];
      let f = 0;
      const tick = () => {
        if (f % 120 === 60 && (!n['act:cage'] || !n['act:shards']) && s.eggs[2].alive && !s.eggs[2].saved && s.channelOf(s.eggs[2]) < 1) Q.egg(2, 2, B + 0.3); // an egg out in a channel: a target for the cage and the rain
        if (f > 900 && f % 330 === 0 && fired.length < ids.length && s.state === 'play') { const id = ids[fired.length], r = __egg.strike(id); fired.push(id + ':' + (r && r.ok ? 'ok' : JSON.stringify(r))); }
        __egg.frame(1 / 60); f++;
      };
      const until = (fn, max) => { for (let i = 0; i < max * 60 && !fn(); i++) tick(); return fn(); };
      const free = () => ['walk', 'block', 'brake'].includes(Q.C.ph) && !s.bx.boss.atk;
      until(() => Q.C.ph !== 'wait' && Q.C.ph !== 'in', 10);
      // a hip-check, then a stone-egg flip, both at the bottom of the outer channel (the boss clock held so he is free)
      until(free, 8); s.bx.boss.t = Math.max(s.bx.boss.t, 3); Q.C.bored = 0; Q.C.dropT = 4; Q.place(Q.C, ch, B - 0.35, 1); Q.egg(0, ch, B + 0.02);
      until(() => n.thornHip, 5);
      until(free, 8); s.bx.boss.t = Math.max(s.bx.boss.t, 3); Q.place(Q.C, ch, B - 0.1, 1); const st = Q.egg(1, ch, B + 0.45); st.stone = 8;
      until(() => n.thornFlip, 6);
      while (f < 3000) tick();
      return { frames: f, n, fired, state: s.state, t: s.t.toFixed(1) };
    });
    console.log('soak', JSON.stringify(res));
  }
  if (want('inlevel')) {
    await start(null);
    await ev(() => Q.until(() => Q.S.ph !== 'wait' && Q.S.ph !== 'in' && Q.C.ph !== 'in', 40));
    await ev(() => { const s = Q.s, ch = s.rings.length - 1; Q.place(Q.S, ch - 1, -Math.PI / 2 + 0.9, -1); Q.run(1.2); });
    await ev(() => { Q.quiet(); __egg.frame(1 / 600); });
    await p.screenshot({ path: path.join(out, 'inlevel.png') });
  }
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no page errors');
  await b.close();
})();
