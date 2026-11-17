// Chick Strike film strips (after tools/crab-strips.cjs): one per strike (button full, fire, hop, launch, flight, impact,
// effect, downside) at 390x844, plus a HUD sheet (button states, intro picker, unlock card) at 390x844 and 640x360.
// Usage: node tools/strike-strips.cjs [dist/dev/index.html] [outDir] [--only=freeze,thunder,bomb,decoy,tornado,glue,hud]
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const html = path.resolve(args[0] || 'dist/dev/index.html'), out = path.resolve(args[1] || 'qa/strike');
const ONLY = ((process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || '').split(',').filter(Boolean);
fs.mkdirSync(out, { recursive: true });
const want = (s) => !ONLY.length || ONLY.includes(s);
// where each strike is filmed: level, the creature kind to aim at
const PLAN = { freeze: [7, 'snake'], thunder: [43, 'gator'], bomb: [8, 'snake'], decoy: [9, 'snake'], tornado: [22, 'sal'], glue: [31, 'thief'] };

function sheet(frames, file, cols, sc) {
  require('child_process').execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageDraw, ImageFont
out=sys.argv[1]; cols=int(sys.argv[2]); sc=float(sys.argv[3]); rest=sys.argv[4:]
files=rest[0::2]; labels=rest[1::2]
ims=[Image.open(f).convert('RGB') for f in files]
ims=[i.resize((int(i.width*sc),int(i.height*sc)),Image.LANCZOS) for i in ims]
w=max(i.width for i in ims); h=max(i.height for i in ims)+22
rows=(len(ims)+cols-1)//cols
sh=Image.new('RGB',(cols*w+(cols-1)*6,rows*h+(rows-1)*6),(20,20,24))
d=ImageDraw.Draw(sh)
try: f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',14)
except Exception: f=None
for n,im in enumerate(ims):
    x=(n%cols)*(w+6); y=(n//cols)*(h+6)
    sh.paste(im,(x,y+22)); d.text((x+4,y+3),'%d  %s'%(n,labels[n]),fill=(240,230,210),font=f)
sh.save(out,quality=82)
`, file, String(cols), String(sc), ...frames.flatMap((q) => [q.f, q.label])]);
}

(async () => {
  const b = await chromium.launch();
  const errs = [];
  const page = async (w, h, dpr) => {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
    p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto('file://' + html); await p.waitForTimeout(800);
    await p.evaluate(() => {
      window.Q = {
        get s() { return __egg.G.sim; },
        run(s) { for (let i = 0; i < Math.round(s * 60); i++) __egg.frame(1 / 60); },
        quiet() { const G = __egg.G; G.toast = null; G.toasts.length = 0; },
      };
    });
    return p;
  };
  const p = await page(390, 844, 2);
  const ev = (fn, a) => p.evaluate(fn, a);
  for (const id of Object.keys(PLAN)) {
    if (!want(id)) continue;
    const [lv, kind] = PLAN[id];
    const frames = [];
    const shot = async (label) => { await ev(() => { Q.quiet(); __egg.frame(1 / 600); }); const f = path.join(out, `f-${id}-${String(frames.length).padStart(2, '0')}.png`); await p.screenshot({ path: f }); frames.push({ f, label }); };
    const ok = await ev(([lv, kind, id]) => {
      const E = __egg;
      E.setSave({ mode: 'medium', calm: false, strike: id, strikeSeen: { freeze: 1, thunder: 1, bomb: 1, decoy: 1, tornado: 1, glue: 1 }, seen: {}, intro: {} });
      E.start(lv - 1, { direct: true }); E.G.paused = true;
      for (let i = 0; i < 60 * 60 && !Q.s.stkTargets().some((T) => T.type === kind); i++) E.step(1 / 60);
      E.G.sim.stkEquip(id);
      Q.s.stk.m = 0.999;
      Q.run(0.6);
      return Q.s.stkTargets().some((T) => T.type === kind);
    }, [lv, kind, id]);
    if (!ok) { console.log('no target for', id); continue; }
    await shot('meter full: gold ring, pulse, chick stands up');
    await ev(([kind]) => { const T = Q.s.stkTargets().find((X) => X.type === kind); __egg.G.stkPick = { key: T.key, t: __egg.G.t }; __egg.press('strike'); }, [kind]);
    await ev(() => Q.run(0.1)); await shot('tap: slow motion, crouch on her back');
    await ev(() => Q.run(0.25)); await shot('hop off her back by the nest');
    await ev(() => Q.run(0.25)); await shot('landing squash, then launch');
    await ev(() => Q.run(0.14)); await shot('flight: streak, squawk');
    await ev(() => Q.run(0.2)); await shot('flight');
    await ev(() => { for (let i = 0; i < 120 && !Q.s.stk.fx.length && !(Q.s.p2.decoy && Q.s.p2.decoy.stk); i++) __egg.frame(1 / 60); }); await shot('impact (hit-stop, camera kick)');
    await ev(() => Q.run(0.35)); await shot('effect');
    await ev(() => Q.run(1.2)); await shot('effect holds');
    // the downside
    if (id === 'freeze') { await ev(() => Q.run(0.8)); await shot('downside: the two nearest rings are icy (pale)'); }
    if (id === 'thunder') { await ev(() => Q.run(0.2)); await shot('downside: eggs near the bolt were jolted'); }
    if (id === 'bomb') { await ev(() => Q.run(0.6)); await shot('downside: eggs shoved; creature out of the vault'); }
    if (id === 'decoy') { await ev(() => { for (let i = 0; i < 60 * 9 && !(Q.s.stk.rage > 0); i++) __egg.frame(1 / 60); }); await shot('downside: they noticed, rushing (anger marks)'); await ev(() => Q.run(1)); await shot('rage'); }
    if (id === 'tornado') { await ev(() => Q.run(0.4)); await shot('downside: nearest ring spun round'); }
    if (id === 'glue') {
      await ev(() => { const P = Q.s.stk.glue[0], e = Q.s.aliveEggs()[0]; if (P && e) { e.body.setTransform({ x: P.x, y: P.y + 0.15 }, 0); e.body.setLinearVelocity({ x: 0, y: 0 }); } Q.run(0.3); });
      await shot('downside: an egg touching the glue is stuck'); await ev(() => Q.run(1)); await shot('still stuck');
    }
    sheet(frames, path.join(out, `strip-${id}.jpg`), 6, 0.42);
    console.log('strip', id, frames.length, 'frames');
  }
  await p.close();
  if (want('hud')) {
    const frames = [];
    for (const [w, h] of [[390, 844], [640, 360]]) {
      const q = await page(w, h, 2);
      const e2 = (fn, a) => q.evaluate(fn, a);
      const shotHud = async (label, clip) => { await e2(() => { Q.quiet(); __egg.frame(1 / 600); }); const f = path.join(out, `h-${w}-${String(frames.length).padStart(2, '0')}.png`); await q.screenshot({ path: f, clip }); frames.push({ f, label: `${w}x${h} ${label}` }); };
      await e2(() => { const E = __egg; E.setSave({ mode: 'medium', strike: 'thunder', strikeSeen: { freeze: 1, thunder: 1, bomb: 1, decoy: 1, tornado: 1, glue: 1 }, intro: { 7: 1 } }); E.start(6, { direct: true }); E.G.paused = true; for (let i = 0; i < 60 * 12; i++) E.step(1 / 60); Q.run(0.2); });
      const box = await e2(() => { const r = __egg.uiRect('btn:strike'); return r; });
      const clip = box ? { x: Math.max(0, box.x - 14), y: Math.max(0, box.y - 14), width: Math.min(w - Math.max(0, box.x - 14), 150), height: Math.min(h - Math.max(0, box.y - 14), box.h + 28) } : undefined;
      for (const m of [0.15, 0.55, 0.9]) { await e2((m) => { Q.s.stk.m = m; }, m); await shotHud(`charging ${Math.round(m * 100)}%`, clip); }
      await e2(() => { __egg.press('strike'); Q.run(0.15); }); await shotHud('not yet: wobble', clip);
      await e2(() => { Q.s.stk.m = 0.999; Q.run(0.1); }); await shotHud('full: gold', clip);
      await e2(() => Q.run(0.08)); await shotHud('full: pulse', clip);
      await shotHud('play screen, full', undefined);
      // the intro picker and the unlock card
      await e2(() => { const E = __egg; E.setSave({ mode: 'medium', strike: 'bomb', unlocked: 50, strikeSeen: { freeze: 1, thunder: 1, bomb: 1, decoy: 1, tornado: 1, glue: 1 }, intro: { 33: 1 } }); E.start(32); E.G.paused = true; Q.run(0.6); });
      await shotHud('intro card: the strike picker', undefined);
      await e2(() => { const E = __egg; E.setSave({ mode: 'medium', unlocked: 21, strikeSeen: { freeze: 1, thunder: 1, bomb: 1 }, intro: { 21: 1 } }); E.start(20); E.G.paused = true; Q.run(0.6); });
      await shotHud('unlock card (first reach of level 21)', undefined);
      const ov = await e2(() => __egg.overlaps().length);
      console.log(w, 'overlaps on last screen', ov);
      await q.close();
    }
    sheet(frames.filter((f) => !/screen|card/.test(f.label)), path.join(out, 'hud-buttons.jpg'), 6, 1);
    sheet(frames.filter((f) => /screen|card/.test(f.label)), path.join(out, 'hud-screens.jpg'), 3, 0.5);
  }
  console.log('page errors', errs.length, errs.slice(0, 4));
  await b.close();
})();
