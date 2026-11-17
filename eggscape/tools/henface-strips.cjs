// The hen's acting face and the wing launch (v5): QA sheets from the live dev build.
//   faces.jpg        every state's face close up, OLD (left) beside NEW (right)
//   faces-phone.jpg  the same beats at the in-game size (hen 52 css px tall, DPR 2, shown 3x, nearest neighbour)
//   launch.jpg       the Chick Strike in a real level at 390x844, 8 frames (charging, hop-on, wind-up, bat, flight, hit,
//                    return, landed) with a 3x inset on the hen, for 'freeze' and 'bomb'
//   win-fail.jpg     the win card and the fail card
// Usage: node tools/henface-strips.cjs [dist/dev/index.html] [outDir=qa/henface] [--old <older dist/dev/index.html>] [--only=faces,launch,cards]
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const argv = process.argv.slice(2);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const args = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--old');
const html = path.resolve(args[0] || 'dist/dev/index.html'), out = path.resolve(args[1] || 'qa/henface');
const OLD = opt('--old') ? path.resolve(opt('--old')) : null;
const ONLY = ((argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || '').split(',').filter(Boolean);
const want = (s) => !ONLY.length || ONLY.includes(s);
fs.mkdirSync(out, { recursive: true });
const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'henface-'));

// [label, mood, seconds into the mood, variant, lead-in mood]
const BEATS = [
  ['idle (confident, one brow up)', 'idle', 0.35],
  ['idle: a glance, eyes first', 'idle', 'glance'],
  ['idle: blink on the head turn', 'idle', 'turn'],
  ['worried (pinched, darting)', 'worried', 1.0],
  ['worried: next dart', 'worried', 1.45],
  ['gasp: the take (+0.15 s)', 'gasp', 0.15, 0],
  ['gasp: recovering (+0.6 s)', 'gasp', 0.6, 0],
  ['cheer: crouch (+0.07 s)', 'happy', 0.07, 0],
  ['cheer: top of the hop', 'happy', 0.3, 0],
  ['cheer: landed, grin', 'happy', 0.56, 0],
  ['phew: relief, lids shut', 'phew', 0.5, 1],
  ['phew: the breath out', 'phew', 0.62, 0],
  ['cry: bawling', 'cry', 1.0],
  ['cry: wiping an eye', 'cry', 1.62],
  ['dance: on the ground', 'dance', 0.95],
  ['dance: top of the hop', 'dance', 1.07],
];

function compose(script, a) { require('child_process').execFileSync('python3', ['-c', script, ...a], { stdio: 'inherit' }); }
const GRID = `
import sys
from PIL import Image, ImageDraw, ImageFont
out=sys.argv[1]; cols=int(sys.argv[2]); sc=float(sys.argv[3]); near=sys.argv[4]=='1'; rest=sys.argv[5:]
files=rest[0::2]; labels=rest[1::2]
ims=[Image.open(f).convert('RGB') for f in files]
ims=[i.resize((int(i.width*sc),int(i.height*sc)),Image.NEAREST if near else Image.LANCZOS) for i in ims]
w=max(i.width for i in ims); h=max(i.height for i in ims)+20
rows=(len(ims)+cols-1)//cols
sh=Image.new('RGB',(cols*w+(cols-1)*6,rows*h+(rows-1)*6),(20,20,24))
d=ImageDraw.Draw(sh)
try: f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',13)
except Exception: f=None
for n,im in enumerate(ims):
    x=(n%cols)*(w+6); y=(n//cols)*(h+6)
    sh.paste(im,(x,y+20)); d.text((x+4,y+3),labels[n],fill=(240,230,210),font=f)
sh.save(out,quality=86)
`;
// a frame with a 3x inset of the hen beside it
const INSET = `
import sys
from PIL import Image
src,dst,x,y,w,h=sys.argv[1],sys.argv[2],*[int(float(v)) for v in sys.argv[3:7]]
im=Image.open(src).convert('RGB')
x=max(0,min(im.width-w,x)); y=max(0,min(im.height-h,y))
c=im.crop((x,y,x+w,y+h)).resize((int(w*1.5),int(h*1.5)),Image.LANCZOS)
full=im.resize((im.width//2,im.height//2),Image.LANCZOS)
o=Image.new('RGB',(full.width+6+c.width,max(full.height,c.height)),(20,20,24))
o.paste(full,(0,0)); o.paste(c,(full.width+6,full.height-c.height))
o.save(dst)
`;

function faceHarness() {
  const H = __egg.hen;
  window.requestAnimationFrame = () => 0;
  const paint = (fn, w, hh, cx, cy, h) => {
    const c = document.createElement('canvas'); c.width = w * 2; c.height = hh * 2;
    const x = c.getContext('2d'); x.scale(2, 2);
    const g = x.createLinearGradient(0, 0, 0, hh); g.addColorStop(0, '#6f8fb3'); g.addColorStop(1, '#9ab6cf'); x.fillStyle = g; x.fillRect(0, 0, w, hh);
    x.fillStyle = '#6b9a4a'; x.fillRect(0, cy + 0.49 * h, w, hh);
    fn(x, cx, cy, h);
    return c.toDataURL('image/png');
  };
  // run the hen to a beat and paint it: close (the head fills the cell) or whole (phone size)
  window.beat = (mood, at, variant, h, close) => {
    H.reset('q');
    let tm = 100; const tmp = document.createElement('canvas').getContext('2d');
    const step = (m, n) => { tm += 1 / 60; H.anim(tmp, m, 0, 0, h, tm, { key: 'q', n, variant }); };
    H.anim(tmp, 'idle', 0, 0, h, tm, { key: 'q', n: 0 });
    let secs = at;
    if (typeof at === 'string') { // find a glance in her idle schedule: 'glance' = eyes gone, head not yet; 'turn' = the head is turning
      secs = 0.3;
      if (H.events) for (let i = 0; i < 60 * 30; i++) { const e0 = H.events(i / 60), e1 = H.events((i + (at === 'glance' ? 5 : 13)) / 60); if (Math.abs(e0.dx) < 0.01 && Math.abs(e1.dx) > 1.0 && e1.peck < 0 && e1.ruffle < 0) { secs = (i + (at === 'glance' ? 5 : 13)) / 60; break; } }
      for (let i = 0; i < Math.round(secs * 60); i++) step('idle', 0);
    } else {
      for (let i = 0; i < 30; i++) step('idle', 0);
      for (let i = 0; i < Math.round(secs * 60); i++) step(mood, 1);
    }
    const draw = (x, cx, cy, hh) => H.anim(x, mood, cx, cy, hh, tm, { key: 'q', n: typeof at === 'string' ? 0 : 1, variant, shadow: 0.26 });
    return close ? paint(draw, Math.round(h * 0.86), Math.round(h * 0.82), h * 0.6, h * 0.82, h) : paint(draw, Math.round(h * 1.9), Math.round(h * 1.75), h * 0.95, h * 1.1, h);
  };
}

(async () => {
  const b = await chromium.launch();
  const errs = [];
  const open = async (file, w, h, dpr) => {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
    p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto('file://' + file); await p.waitForTimeout(800);
    return p;
  };
  const save = (url, name) => { const f = path.join(tmp, name); fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); return f; };

  if (want('faces')) {
    const builds = (OLD ? [['OLD', OLD]] : []).concat([['NEW', html]]);
    const close = [], phone = [];
    const pages = [];
    for (const [tag, file] of builds) { const p = await open(file, 390, 844, 2); await p.evaluate(faceHarness); pages.push([tag, p]); }
    for (let i = 0; i < BEATS.length; i++) {
      const [label, mood, at, variant] = BEATS[i];
      for (const [tag, p] of pages) {
        close.push({ f: save(await p.evaluate(([m, a, v]) => window.beat(m, a, v, 240, true), [mood, at, variant]), `c-${i}-${tag}.png`), label: `${tag}  ${label}` });
        phone.push({ f: save(await p.evaluate(([m, a, v]) => window.beat(m, a, v, 52, false), [mood, at, variant]), `p-${i}-${tag}.png`), label: `${tag} ${label}`.slice(0, 40) });
      }
    }
    for (const [, p] of pages) await p.close();
    compose(GRID, [path.join(out, 'faces.jpg'), '8', '0.5', '0', ...close.flatMap((q) => [q.f, q.label.slice(0, 32)])]);
    compose(GRID, [path.join(out, 'faces-phone.jpg'), '8', '1.5', '1', ...phone.flatMap((q) => [q.f, q.label.slice(0, 40)])]);
    console.log('faces', close.length, 'cells');
  }

  if (want('launch')) {
    const PLAN = { freeze: [7, 'snake'], bomb: [8, 'snake'] };
    const frames = [];
    const p = await open(html, 390, 844, 2);
    await p.evaluate(() => { window.Q = { get s() { return __egg.G.sim; }, run(s) { for (let i = 0; i < Math.round(s * 60); i++) __egg.frame(1 / 60); }, quiet() { const G = __egg.G; G.toast = null; G.toasts.length = 0; } }; });
    const ev = (fn, a) => p.evaluate(fn, a);
    for (const id of Object.keys(PLAN)) {
      const [lv, kind] = PLAN[id];
      const shot = async (label) => {
        await ev(() => { Q.quiet(); __egg.frame(1 / 600); });
        const raw = path.join(tmp, `l-${id}-${frames.length}.png`), f = path.join(tmp, `li-${id}-${frames.length}.png`);
        await p.screenshot({ path: raw });
        const h = await ev(() => { const G = __egg.G, P = G.play, k = G.cam.k, a = G.henAt; return { x: P.x + P.w / 2 + (a.x - G.cam.x) * k, y: P.y + P.h / 2 - (a.y - G.cam.y) * k, hs: a.s * k }; });
        compose(INSET, [raw, f, String((h.x - 1.15 * h.hs) * 2), String((h.y - 1.75 * h.hs) * 2), String(2.6 * h.hs * 2), String(2.1 * h.hs * 2)]);
        frames.push({ f, label: `${id}: ${label}` });
      };
      const ok = await ev(([lv, kind, id]) => {
        const E = __egg;
        E.setSave({ mode: 'medium', calm: false, strike: id, strikeSeen: { freeze: 1, thunder: 1, bomb: 1, decoy: 1, tornado: 1, glue: 1 }, seen: {}, intro: {} });
        E.start(lv - 1, { direct: true }); E.G.paused = true;
        for (let i = 0; i < 60 * 60 && !Q.s.stkTargets().some((T) => T.type === kind); i++) E.step(1 / 60);
        E.G.sim.stkEquip(id); Q.s.stk.m = 0.4; Q.run(0.8);
        return Q.s.stkTargets().some((T) => T.type === kind);
      }, [lv, kind, id]);
      if (!ok) { console.log('no target for', id); continue; }
      await shot('charging: on the ground behind her');
      await ev(() => { Q.s.stk.m = 0.9999; for (let i = 0; i < 200 && !(Q.s.stk.m >= 1); i++) __egg.frame(1 / 60); Q.run(0.2); }); await shot('meter full: it hops onto her back');
      await ev(() => Q.run(0.9));
      await ev(([kind]) => { const T = Q.s.stkTargets().find((X) => X.type === kind); __egg.G.stkPick = { key: T.key, t: __egg.G.t }; __egg.press('strike'); }, [kind]);
      const until = (ph, t) => ev(([ph, t]) => { for (let i = 0; i < 600; i++) { const F = Q.s.stk.fly; if (!F || (F.ph === ph && F.t >= t) || (ph === 'hop' && F.ph === 'fly')) break; __egg.frame(1 / 240); } __egg.frame(1 / 2000); const F = Q.s.stk.fly; return F ? F.ph + ' ' + F.t.toFixed(3) : 'none'; }, [ph, t]);
      console.log(id, await until('hop', 0.17)); await shot('fire: she winds her wing down and back');
      console.log(id, await until('hop', 0.3)); await shot('the bat: wing up under the chick');
      console.log(id, await until('fly', 0.16)); await shot('flight: follow-through, eyes on it');
      await ev(() => { for (let i = 0; i < 240 && Q.s.stk.fly; i++) __egg.frame(1 / 120); Q.run(0.05); }); await shot('the hit');
      await ev(() => Q.run(0.42)); await shot('backflip home');
      await ev(() => Q.run(0.5)); await shot('lands on the ground, gloats');
    }
    await p.close();
    compose(GRID, [path.join(out, 'launch.jpg'), '4', '0.62', '0', ...frames.flatMap((q) => [q.f, q.label])]);
    for (const id of Object.keys(PLAN)) { const fr = frames.filter((q) => q.label.startsWith(id)); if (fr.length) compose(GRID, [path.join(out, `launch-${id}.jpg`), '4', '0.62', '0', ...fr.flatMap((q) => [q.f, q.label])]); }
    console.log('launch', frames.length, 'frames');
  }

  if (want('cards')) {
    const p = await open(html, 390, 844, 2);
    await p.evaluate(() => { window.Q = { run(s) { for (let i = 0; i < Math.round(s * 60); i++) __egg.frame(1 / 60); } }; });
    const frames = [];
    const boot = () => p.evaluate(() => { const E = __egg; E.setSave({ mode: 'medium', calm: false, seen: {} }); E.start(0, { direct: true }); E.G.toast = null; E.G.paused = false; Q.run(0.3); });
    for (const [kind, arg, times] of [['win', 3, [1.0, 1.6, 2.3]], ['fail', undefined, [0.7, 1.2, 2.0]]]) {
      await boot();
      await p.evaluate(([k, a]) => __egg.showResult(k, a), [kind, arg]);
      let at = 0;
      for (const tm of times) { await p.evaluate((d) => Q.run(d), tm - at); at = tm; const f = path.join(tmp, `w-${kind}-${tm}.png`); await p.screenshot({ path: f }); frames.push({ f, label: `${kind} card +${tm}s` }); }
    }
    await p.close();
    compose(GRID, [path.join(out, 'win-fail.jpg'), '6', '0.5', '0', ...frames.flatMap((q) => [q.f, q.label])]);
    console.log('cards', frames.length);
  }
  console.log('page errors', errs.length, errs.slice(0, 4));
  await b.close();
})();
