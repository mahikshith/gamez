const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const D = __dirname; const u = (f) => 'file://' + path.join(D, f);
const css = `@font-face{font-family:F;src:url(${u('fredoka-600-latin.woff2')})}*{margin:0;box-sizing:border-box}body{font-family:F,sans-serif;overflow:hidden}`;
const shots = [['L1', 'Turn the rings, free the eggs', '#3d8fe0', '#1c4f9c'], ['L15', 'Outsmart 10 crafty bosses', '#6a7fd6', '#2b3577'], ['L25', 'Roll through 10 wild worlds', '#e0662b', '#7a1f12'], ['L40', 'Dive into the Coral Reef', '#19a7c9', '#0b4f7d'], ['L50', 'Crack the Clockwork Lab', '#2f6fb3', '#14254f'], ['win', 'Bring every egg home', '#f0a020', '#b7530f'], ['levels', '50 handcrafted levels', '#5fb04a', '#1f6a3a'], ['shop', 'Boosters and egg skins', '#7b4fd0', '#35207a']];
const LOGO = (px) => `<div style="font-size:${px}px;letter-spacing:${px*0.02}px;line-height:1;text-align:center;position:relative"><div style="position:absolute;inset:0;-webkit-text-stroke:${px*0.22}px #4a2508;color:#4a2508;transform:translateY(${px*0.07}px)">EGGSCAPE</div><div style="position:relative;background:linear-gradient(#fff3a8 10%,#ffc233 45%,#f07a12 90%);-webkit-background-clip:text;color:transparent">EGGSCAPE</div></div>`;
const page = (w, h, body) => `<html><head><style>${css}</style></head><body style="width:${w}px;height:${h}px">${body}</body></html>`;
const cap = (t, s) => `<div style="font-size:${s}px;color:#fff;text-align:center;line-height:1.05;-webkit-text-stroke:${s / 9}px #3b230f;paint-order:stroke fill;text-shadow:0 ${s / 12}px 0 #3b230f">${t}</div>`;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const render = async (w, h, body, out) => { await p.setViewportSize({ width: w, height: h }); fs.writeFileSync(path.join(D,'_p.html'), page(w, h, body)); await p.goto(u('_p.html')); await p.waitForLoadState('networkidle'); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(150); await p.screenshot({ path: path.join(D, out) }); };
  let i = 1;
  for (const [f, t, c1, c2] of shots) {
    const body = (W, H) => `<div style="width:100%;height:100%;background:linear-gradient(${c1},${c2});display:flex;flex-direction:column;align-items:center"><div style="height:${H * 0.15}px;display:flex;align-items:center;padding:0 ${W * 0.06}px">${cap(t, W * 0.074)}</div><img src="${u('raw/' + f + '.png')}" style="height:${H * 0.83}px;border-radius:${W * 0.045}px;border:${W * 0.009}px solid #3b230f;box-shadow:0 ${W * 0.012}px 0 rgba(0,0,0,.28)"></div>`;
    await render(1080, 1920, body(1080, 1920), `phone-${i}.png`);
    if (i <= 4) await render(1600, 2560, body(1600, 2560), `tablet-${i}.png`);
    i++;
  }
  const sky = 'radial-gradient(circle at 30% 20%,#9bd8ff,#3d8fe0 70%)';
  await render(1024, 500, `<div style="width:100%;height:100%;background:${sky};position:relative"><img src="${u('raw/L5.png')}" style="position:absolute;right:40px;top:-235px;width:520px;clip-path:circle(232px at 260px 485px)"><div style="position:absolute;left:40px;top:200px;width:520px;white-space:nowrap">${LOGO(84)}</div><img src="${u('hen.png')}" style="position:absolute;right:20px;bottom:24px;width:200px;border-radius:50%;border:8px solid #fff;box-shadow:0 6px 0 rgba(0,0,0,.25)"></div>`, 'feature-1024x500.png');
  const cover = (w, h) => `<div style="width:100%;height:100%;position:relative;background:#3d8fe0"><img src="${u(w > h ? 'raw/L1-wide.png' : 'raw/L5.png')}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:${w > h ? 'center' : '50% 62%'}"><div style="position:absolute;left:0;right:0;top:0;height:42%;background:linear-gradient(rgba(20,60,130,.92),rgba(20,60,130,0))"></div><div style="position:absolute;left:0;right:0;top:${h * 0.07}px">${LOGO(Math.min(w * 0.15, h * 0.2))}</div></div>`;
  for (const [w, h] of [[1920, 1080], [800, 1200], [800, 800]]) await render(w, h, cover(w, h), `crazygames-${w}x${h}.png`);
  await render(628, 628, `<img src="${u('icon-1024.png')}" style="width:628px">`, 'poki-628.png');
  await b.close();
})();
