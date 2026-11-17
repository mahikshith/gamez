// The hen's celebrations QA (render/cheer.js): film strips from the live dev build, on the real win / fail cards.
// Sheets written to <outDir>:
//   cheer-<routine>.png  every routine frame by frame (every 0.1 s, plus its hold): the real win screen on a 390x844
//                        phone at DPR 2: the full-screen show, her flight into the card, and the card
//   cheer-show.png       the show into the card at 30 fps, portrait and landscape
//   cheer-landscape.png  each routine on an 844x390 landscape phone (the stage beside the card), 6 beats each
//   cheer-screens.png    full phone screens: the win card at 1, 2 and 3 stars mid-routine and at the end, a boss win,
//                        the fail card (sad, shaking it off, cheering you on), both orientations
//   cheer-react.png      the in-level reactions at in-level size (52 px hen): egg saved, egg cracked, a close shave,
//                        three variants each, 7 frames per variant
// Usage: node tools/cheer-strips.cjs [dist/dev] [outDir=qa/cheer] [--port 9093] [--only backflip,chicks]
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const args = argv.filter((a, i) => !a.startsWith('--') && !['--port', '--only'].includes(argv[i - 1]));
const dir = path.resolve(args[0] || 'dist/dev');
const out = path.resolve(args[1] || 'qa/cheer');
const PORT = +(opt('--port') || 9093);
const ONLY = opt('--only') ? opt('--only').split(',') : null;
fs.mkdirSync(out, { recursive: true });

const srv = http.createServer((q, r) => {
  const f = path.join(dir, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); });
}).listen(PORT);

// which star count each routine is filmed with (the result that picks it)
const STARS = { cheer: 1, pump: 2, dance: 2, juggle: 2, backflip: 3, chicks: 3, strut: 3 };

function harness() {
  window.requestAnimationFrame = () => 0; // the tool drives every frame
  const E = __egg;
  window.Q = {
    boot(i = 1) { E.setSave({ mode: 'medium', calm: false, seen: {}, unlocked: 30 }); E.start(i, { direct: true }); E.G.toast = null; if (E.G.toasts) E.G.toasts.length = 0; E.frame(1 / 60); },
    win(stars, cheer) { E.showResult('win', stars, cheer, 0); E.frame(1 / 60); },
    fail() { E.showResult('fail'); E.frame(1 / 60); },
    // advance the card to time t (s since it opened), one 60 fps frame at a time
    to(t) { const G = E.G; const now = () => (G.screen === 'win' ? G.result.t : G.screenT); let n = 0; while (now() < t - 1e-6 && n++ < 2000) E.frame(1 / 60); return now(); },
    rect(tag) { return E.uiRect(tag); },
    len(name) { return E.cheer.routine(name).len; },
    stars(name) { return E.cheer.routine(name).stars; },
  };
  // in-level hen cells (as tools/hen-strips.cjs): a ground strip, the hen 52 px tall, her clock stepped at 60 fps
  window.cell = (fn, w, hh, h) => {
    const c = document.createElement('canvas');
    c.width = w * 2; c.height = hh * 2;
    const x = c.getContext('2d');
    x.scale(2, 2);
    const g = x.createLinearGradient(0, 0, 0, hh);
    g.addColorStop(0, '#6f8fb3'); g.addColorStop(0.72, '#9ab6cf'); g.addColorStop(0.72, '#6b9a4a'); g.addColorStop(1, '#4f7a38');
    x.fillStyle = g; x.fillRect(0, 0, w, hh);
    fn(x, w / 2, hh * 0.8 - 0.49 * h, h);
    return c.toDataURL('image/png');
  };
  window.react = (mood, variant, at, h, w, hh) => {
    const H = E.hen; H.reset('rx');
    const outs = [], tmp = document.createElement('canvas').getContext('2d');
    let t = 50, n = 0, m = 'idle';
    const draw = (x, cx, cy, hh2) => H.anim(x, m, cx, cy, hh2, t, { key: 'rx', n, variant, shadow: 0.26 });
    const ats = at.slice();
    for (let i = 0; i < 60 * 6 && ats.length; i++) {
      const el = i / 60;
      if (el >= 0.3 && n === 0) { m = mood; n = 1; }
      if (el >= 0.3 + (mood === 'gasp' ? 1.2 : 1.1) && m !== 'idle') m = 'idle';
      draw(tmp, 0, 0, h);
      if (el >= ats[0] + 0.3 - 1e-6) { outs.push(window.cell(draw, w, hh, h)); ats.shift(); }
      t += 1 / 60;
    }
    return outs;
  };
}

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const open = async (w, h) => {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    p.on('pageerror', (e) => errors.push(String(e)));
    await p.goto('http://localhost:' + PORT + '/');
    await p.waitForTimeout(1000);
    await p.evaluate(harness);
    return p;
  };
  const b64 = (buf) => 'data:image/png;base64,' + buf.toString('base64');
  const grp = (title, cells, w) => `<div style="margin-bottom:12px"><div style="font-weight:bold;margin:2px 0 4px">${title}</div><div style="display:flex;gap:4px;flex-wrap:wrap">${cells.map((c) => `<div><img style="width:${c.w || w}px;display:block;border-radius:4px" src="${c.url}"><div style="font-size:11px;padding:1px 2px">${c.label || ''}</div></div>`).join('')}</div></div>`;
  const wrap = (body) => `<html><body style="margin:0;background:#1d1712;color:#f5e6c8;font:13px sans-serif;padding:8px">${body}</body></html>`;
  const sheet = async (html, file, width) => {
    const p2 = await b.newPage({ viewport: { width, height: 300 } });
    await p2.setContent(html);
    await p2.waitForTimeout(150);
    await p2.screenshot({ path: path.join(out, file), fullPage: true });
    await p2.close();
  };
  const routines = (await (await open(390, 844)).evaluate(() => __egg.cheer.ROUTINES)).filter((r) => !ONLY || ONLY.includes(r));

  // ---- portrait: every routine frame by frame, cropped from the real card
  const p = await open(390, 844);
  for (const name of routines) {
    const len = await p.evaluate((n) => Q.len(n), name), st = await p.evaluate((n) => Q.stars(n), name);
    await p.evaluate(([s, n]) => { Q.boot(); Q.win(s, n); }, [STARS[name], name]);
    const cells = [];
    const times = [];
    for (let t = 0; t <= len + 0.45; t += 0.1) times.push(Math.round(t * 100) / 100);
    times.push(Math.round((len + 1.6) * 100) / 100); // well into the hold
    for (const t of times) {
      await p.evaluate((tt) => Q.to(tt), t);
      const marks = st.filter((x, i) => i < STARS[name] && Math.abs(x - t) < 0.051).length ? ' STAR' : '';
      cells.push({ url: b64(await p.screenshot()), label: `${t.toFixed(2)} s${t > len ? ' (hold)' : ''}${t >= 1.98 && t < 2.08 ? ' CARD IN' : ''}${marks}`, w: 175 });
    }
    await sheet(wrap(grp(`${name} (filmed as a ${STARS[name]}-star win): 390x844 phone, DPR 2, full screens at 45% (the show until 1.6 s, the flight into the card until 1.98 s); length ${len} s, stars at ${st.map((x) => x.toFixed(2)).join(', ')} s`, cells, 0)), `cheer-${name}.png`, 1470);
    console.log('routine', name, len);
  }

  // ---- 3x close-ups: the stage drawn straight onto a canvas, the hen 300 px tall, 12 beats per routine
  const cl = [];
  for (const name of routines) {
    const urls = await p.evaluate(([n, s2]) => {
      const C = __egg.cheer, R = C.routine(n), res = [], W = 360, Hh = 330;
      const ts = []; for (let i = 0; i < 12; i++) ts.push((R.len + 0.5) * i / 11);
      for (const t of ts) {
        const c = document.createElement('canvas'); c.width = W; c.height = Hh;
        const x = c.getContext('2d'); x.fillStyle = '#2a1e14'; x.fillRect(0, 0, W, Hh);
        C.draw(x, n, t, { x: 0, y: 0, w: W, h: Hh }, { pw: C.power(s2), henH: 200 });
        res.push({ url: c.toDataURL(), label: t.toFixed(2) + ' s' });
      }
      return res;
    }, [name, STARS[name]]);
    cl.push(grp(name + ' (close-up, hen 200 px)', urls.map((u) => ({ ...u, w: 180 })), 180));
  }
  await sheet(wrap(cl.join('')), 'cheer-closeup.png', 2240);

  // ---- landscape
  const pl = await open(844, 390);
  const land = [];
  for (const name of routines) {
    const len = await pl.evaluate((n) => Q.len(n), name);
    await pl.evaluate(([s, n]) => { Q.boot(); Q.win(s, n); }, [STARS[name], name]);
    const cells = [];
    for (const t of [0.35, len * 0.3, len * 0.5, len * 0.7, len * 0.88, len + 0.8]) { await pl.evaluate((tt) => Q.to(tt), t); cells.push({ url: b64(await pl.screenshot()), label: `${name} ${t.toFixed(2)} s` }); }
    land.push(grp(name, cells, 380));
  }
  await sheet(wrap('<div style="margin-bottom:6px">844x390 landscape phone, DPR 2 (shown at 45%)</div>' + land.join('')), 'cheer-landscape.png', 2380);

  // ---- the show into the card, frame by frame (every 1/30 s from 1.5 to 2.1 s), portrait and landscape
  const tr = [];
  for (const [pg, W, lab] of [[p, 175, 'portrait 390x844'], [pl, 300, 'landscape 844x390']]) {
    for (const [s2, n] of [[3, 'backflip'], [1, 'cheer']]) {
      await pg.evaluate(([a2, b2]) => { Q.boot(); Q.win(a2, b2); }, [s2, n]);
      const cells = [];
      for (let t = 1.5; t <= 2.12; t += 1 / 30) { await pg.evaluate((tt) => Q.to(tt), t); cells.push({ url: b64(await pg.screenshot()), label: t.toFixed(2) + ' s' }); }
      tr.push(grp(`${lab}: ${n} (${s2} star${s2 > 1 ? 's' : ''}), the hen flies into the card as it slides in`, cells, W));
    }
  }
  await sheet(wrap(tr.join('')), 'cheer-show.png', 1900);

  // ---- full screens
  const scr = [];
  for (const [pg, W, label] of [[p, 260, 'portrait 390x844'], [pl, 400, 'landscape 844x390']]) {
    const cells = [];
    for (const [s, name, t] of [[1, 'cheer', 1.0], [1, 'cheer', 9], [2, 'dance', 1.3], [2, 'dance', 9], [3, 'backflip', 1.0], [3, 'backflip', 1.5], [3, 'backflip', 9]]) {
      await pg.evaluate(([s2, n]) => { Q.boot(); Q.win(s2, n); }, [s, name]);
      await pg.evaluate((tt) => Q.to(tt), t);
      cells.push({ url: b64(await pg.screenshot()), label: `win ${s} star${s > 1 ? 's' : ''} (${name}) ${t > 5 ? 'end' : t + ' s'}` });
    }
    await pg.evaluate(() => { Q.boot(4); Q.win(3, 'strut'); }); await pg.evaluate(() => Q.to(9)); // level 5 is a boss
    cells.push({ url: b64(await pg.screenshot()), label: 'boss win (strut) end' });
    for (const t of [0.3, 0.6, 1.0, 4]) {
      await pg.evaluate(() => { Q.boot(); Q.fail(); });
      await pg.evaluate((tt) => Q.to(tt), t);
      cells.push({ url: b64(await pg.screenshot()), label: `fail ${t} s` });
    }
    scr.push(grp(label, cells, W));
  }
  await sheet(wrap(scr.join('')), 'cheer-screens.png', 1900);

  // ---- in-level reactions
  const rx = [];
  const AT = { happy: [0, 0.1, 0.25, 0.4, 0.55, 0.75, 1.0], gasp: [0, 0.06, 0.14, 0.25, 0.4, 0.55, 0.75], phew: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9] };
  const NAMES = { happy: ['hop', 'twirl', 'wing pump'], gasp: ['jump', 'wings to cheeks', 'flinch + head shake'], phew: ['brow wipe', 'relieved slump', 'heart'] };
  for (const mood of ['happy', 'gasp', 'phew']) for (let v = 0; v < 3; v++) {
    const urls = await p.evaluate(([m, vv, at]) => react(m, vv, at, 52, 110, 92), [mood, v, AT[mood]]);
    rx.push(grp(`${mood === 'happy' ? 'egg saved' : mood === 'gasp' ? 'egg cracked' : 'close shave'}: ${NAMES[mood][v]}`, urls.map((u, i) => ({ url: u, label: AT[mood][i].toFixed(2) + ' s' })), 110));
  }
  await sheet(wrap('<div style="margin-bottom:6px">in-level size: the hen 52 css px tall, as on a 390x844 phone (cells 110 css px)</div>' + rx.join('')), 'cheer-react.png', 830);

  for (const e of errors) console.log('PAGE ERROR: ' + e);
  console.log('wrote ' + out);
  await b.close();
  srv.close();
})();
