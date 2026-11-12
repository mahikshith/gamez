// King Crab new poses at 3x: rest, bubble wind-up, blow, tuck/spin, barnacle toss wind-up and flick.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const html = path.resolve(process.argv[2] || 'dist/dev/index.html'), out = path.resolve(process.argv[3] || 'qa/crab');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  await p.goto('file://' + html); await p.waitForTimeout(900);
  const files = [];
  const one = async (attack, adv, label) => {
    await p.evaluate(([attack]) => {
      const E = __egg, L = E.LEVELS.find((l) => l.id === 40);
      E.setSave({ mode: 'medium', calm: true, seen: {} });
      E.G.demo = { ...JSON.parse(JSON.stringify(L)), id: 990, jelly: undefined, bossFight: { kind: 'kingcrab', delay: 0.4, phases: [{ attacks: [attack], every: 30 }] } };
      E.start(-2, { direct: true }); E.G.paused = true;
      window.run = (s) => { for (let i = 0; i < Math.round(s * 60); i++) E.frame(1 / 60); };
      window.until = (nm, ph) => { for (let i = 0; i < 1200; i++) { const A = E.sim.bx.boss.atk; if (A && A.name === nm && A.ph === ph) return; E.frame(1 / 60); } };
      run(0.3);
    }, [attack]);
    await p.evaluate(adv);
    const box = await p.evaluate(() => { const E = __egg, K = E.sim.kc, G = E.G, P = G.play; E.G.toast = null; E.G.popups.length = 0; E.frame(1 / 600); const x = P.x + P.w / 2 + (K.bx - G.cam.x) * G.cam.k, y = P.y + P.h / 2 - (K.by - G.cam.y) * G.cam.k; return { x, y, k: G.cam.k }; });
    const f = path.join(out, `pose-${files.length}.png`);
    await p.screenshot({ path: f, clip: { x: Math.max(0, box.x - 110), y: box.y - 90, width: 220, height: 150 } });
    files.push(f);
  };
  await one('snap', () => run(0.5), 'rest');
  await one('bubbles', () => { until('bubbles', 'warn'); run(0.6); }, 'bubbles wind-up');
  await one('bubbles', () => { until('bubbles', 'act'); run(0.4); }, 'blowing');
  await one('whirl', () => { until('whirl', 'warn'); run(0.9); }, 'tuck');
  await one('whirl', () => { until('whirl', 'act'); run(0.5); }, 'spinning');
  await one('barnacles', () => { until('barnacles', 'warn'); run(0.8); }, 'toss wind-up');
  await one('barnacles', () => { until('barnacles', 'act'); run(0.15); }, 'flick');
  await b.close();
  require('child_process').execFileSync('python3', ['-c', `
import sys
from PIL import Image
fs=sys.argv[2:]; ims=[Image.open(f).convert('RGB') for f in fs]; w,h=ims[0].size; cols=4; rows=(len(ims)+cols-1)//cols
sh=Image.new('RGB',(cols*w+(cols-1)*8,rows*h+(rows-1)*8),(20,20,24))
for n,i in enumerate(ims): sh.paste(i,((n%cols)*(w+8),(n//cols)*(h+8)))
sh.save(sys.argv[1],quality=88)`, path.join(out, 'crab-poses.jpg'), ...files]);
})();
