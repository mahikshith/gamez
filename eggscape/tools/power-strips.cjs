// v3.4 powers QA: film strips at real phone scale (390x844 css, DPR 2) from the live dev build, one row per power
// (pickup card, active, what it does to a creature, the downside showing, the end) and one per combo, from the studio
// demos in src/data/power-demos.js. The egg is put on the orb for a real pickup (contact -> takeOrb -> events -> card).
// Usage: node tools/power-strips.cjs [dist/dev] [outDir=qa/powers] [only=frostnova,combo_shatter,...] [--keep]
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const dir = path.resolve(args[0] || 'dist/dev');
const out = path.resolve(args[1] || 'qa/powers');
const only = args[2] ? args[2].split(',') : null;
const PORT = 8942;
const VW = 390, VH = 844, DPR = 2;
const CLOSE = 170; // a close crop: an egg is ~18 px in it, as on the phone
fs.mkdirSync(out, { recursive: true });

// A scenario is a list of steps run in the page; each returns what to shoot. Crops: 'card' (the HUD and the power
// card), 'vault' (the whole vault), or a close crop on 'egg' | 'snake' | 'sal' | 'eagle' | 'decoy' | 'portal' |
// {ring, a, dr} (a point on a ring) | {x, y} (world).
const S = {
  frostnova: [
    ['wait for the snake', 'Q.run(2.2)'],
    ['pickup', 'Q.take("frostnova"); Q.run(0.15)', 'card'],
    ['all frozen', 'Q.run(0.5)', 'vault'],
    ['snake frozen', 'Q.run(0.3)', 'snake'],
    ['brittle thorn: touch shatters', 'Q.eggAt(Q.thorn(1)); Q.run(0.35)', 'egg'],
    ['rings locked (frost)', 'Q.tryTurn(1, 40); Q.run(0.4)', 'vault'],
    ['then icy: eggs slide', 'Q.run(1.6); Q.tryTurn(1, 60); Q.run(0.5)', 'egg'],
    ['thawed', 'Q.hold(); Q.run(5)', 'vault'],
  ],
  shock: [
    ['wait for the creatures', 'Q.run(2.6)'],
    ['pickup', 'Q.take("shock"); Q.run(0.15)', 'card'],
    ['ring live', 'Q.run(0.4)', 'vault'],
    ['salamander zapped', 'Q.until("Q.fx(\'c\')", 4)', 'sal'],
    ['downside: egg bounced', 'Q.eggOnRing(); Q.run(0.12)', 'egg'],
    ['end', 'Q.run(6)', 'vault'],
  ],
  thunderclap: [
    ['wait for the eagle', 'Q.until("Q.eagleIn()", 6); Q.run(0.3)'],
    ['pickup', 'Q.take("thunderclap"); Q.run(0.1)', 'card'],
    ['clap', 'Q.run(0.15)', 'vault'],
    ['snake stunned', 'Q.run(0.4)', 'snake'],
    ['eagle stunned (less)', 'Q.run(0.1)', 'eagle'],
    ['downside: portal dark', 'Q.run(0.4)', 'portal'],
    ['downside: door dark', '', { ring: 1, gap: 0 }],
    ['power back', 'Q.run(5.5)', 'vault'],
  ],
  laser: [
    ['wait', 'Q.run(1.5)'],
    ['pickup', 'Q.take("laser"); Q.run(0.15)', 'card'],
    ['beak ready', 'Q.run(0.8)', 'vault'],
    ['shot 1: thorns', 'Q.fire(-60); Q.run(0.12)', 'vault'],
    ['shot 2: curtain + wall', 'Q.run(0.4); Q.fire(-30); Q.run(0.12)', 'vault'],
    ['downside: sponge burnt', 'Q.run(0.3); Q.fire(-115); Q.run(0.15)', { ring: 1, pad: 0 }],
    ['end', 'Q.hold(); Q.run(10)', 'vault'],
  ],
  spin: [
    ['wait for the snakes', 'Q.run(2.6)'],
    ['pickup', 'Q.take("spin"); Q.run(0.15)', 'card'],
    ['spinning', 'Q.run(0.5)', 'vault'],
    ['snake flung out', 'Q.run(0.25)', 'snake'],
    ['downside: eggs tumble', 'Q.run(0.2)', 'egg'],
    ['still', 'Q.run(3)', 'vault'],
  ],
  pepper: [
    ['wait for the eagle', 'Q.until("Q.eagleIn()", 6); Q.run(0.2)'],
    ['pickup', 'Q.take("pepper"); Q.run(0.15)', 'card'],
    ['downside: smoke', 'Q.run(0.4)', 'vault'],
    ['snake sneezes', 'Q.run(0.3)', 'snake'],
    ['eagle sneezes', 'Q.run(0.1)', 'eagle'],
    ['smoke clears', 'Q.run(2.6)', 'vault'],
    ['end', 'Q.run(6)', 'vault'],
  ],
  shrink: [
    ['wait for the snake', 'Q.run(2.4)'],
    ['pickup', 'Q.take("shrink"); Q.run(0.15)', 'card'],
    ['tiny eggs', 'Q.run(0.4)', 'egg'],
    ['through a grate', 'Q.eggAtGap(1, 0, 0.35); Q.run(0.45)', { ring: 1, gap: 0 }],
    ['snake lost them', 'Q.run(0.2)', 'snake'],
    ['downside: cracks easier', 'Q.drop(1.6); Q.run(0.6)', 'egg'],
    ['about to grow', 'Q.run(5.6)', 'egg'],
    ['end', 'Q.run(1.4)', 'egg'],
  ],
  iron: [
    ['wait for the snake', 'Q.run(2.8)'],
    ['pickup', 'Q.take("iron"); Q.run(0.15)', 'card'],
    ['iron eggs', 'Q.run(0.4)', 'egg'],
    ['smash thorns', 'Q.eggAt(Q.thorn(1)); Q.run(0.3)', 'egg'],
    ['downside: narrow gap barred', 'Q.eggAtGap(1, 0, 0.32); Q.run(0.6)', { ring: 1, gap: 0 }],
    ['downside: sinks through sponge', 'Q.eggAtPad(1); Q.run(0.35)', { ring: 1, pad: 0 }],
    ['wearing off', 'Q.run(5.6)', 'egg'],
    ['end', 'Q.run(1.2)', 'egg'],
  ],
  decoy: [
    ['wait for the eagle', 'Q.until("Q.eagleIn()", 6); Q.run(0.2)'],
    ['pickup', 'Q.take("decoy"); Q.run(0.15)', 'card'],
    ['decoy out', 'Q.run(0.5)', 'vault'],
    ['snake chases it', 'Q.run(1.2)', 'snake'],
    ['downside: plugs a gap', 'Q.decoyToGap(1, 0); Q.run(0.6)', { ring: 1, gap: 0 }],
    ['popped', 'Q.until("!Q.decoy()", 9); Q.run(0.1)', 'vault'],
  ],
  combo_shatter: [
    ['wait for the snakes', 'Q.run(2.8)'],
    ['frost nova', 'Q.take("frostnova"); Q.run(0.5)', 'vault'],
    ['+ shock: COMBO!', 'Q.take("shock"); Q.run(0.15)', 'card'],
    ['shattered out', 'Q.run(0.35)', 'vault'],
    ['snake knocked out', 'Q.run(0.2)', 'snake'],
    ['end', 'Q.run(7)', 'vault'],
  ],
  combo_sweep: [
    ['wait', 'Q.run(1.5)'],
    ['laser', 'Q.take("laser"); Q.run(0.6)', 'vault'],
    ['+ spin: COMBO!', 'Q.take("spin"); Q.run(0.15)', 'card'],
    ['the beam sweeps', 'Q.run(0.45)', 'vault'],
    ['full circle', 'Q.run(0.6)', 'vault'],
    ['end', 'Q.run(3)', 'vault'],
  ],
  combo_cannon: [
    ['wait', 'Q.run(2.2)'],
    ['shrink', 'Q.take("shrink"); Q.run(0.5)', 'egg'],
    ['+ iron: COMBO!', 'Q.take("iron"); Q.run(0.15)', 'card'],
    ['tiny cannonballs', 'Q.run(0.4)', 'egg'],
    ['smash thorns', 'Q.eggAt(Q.thorn(1)); Q.run(0.3)', 'egg'],
    ['slip through a grate', 'Q.eggAtGap(1, 0, 0.3); Q.run(0.45)', { ring: 1, gap: 0 }],
    ['smash the wall', 'Q.eggAtBarrier(0); Q.run(0.3)', 'egg'],
  ],
  combo_twister: [
    ['wait for the snakes', 'Q.run(2.8)'],
    ['pepper', 'Q.take("pepper"); Q.run(0.4)', 'vault'],
    ['+ spin: COMBO!', 'Q.take("spin"); Q.run(0.15)', 'card'],
    ['smoke blown off', 'Q.run(0.3)', 'vault'],
    ['snake sneezed out', 'Q.run(0.3)', 'snake'],
    ['end', 'Q.run(3)', 'vault'],
  ],
  combo_magnet: [
    ['wait', 'Q.run(1.5)'],
    ['iron', 'Q.take("iron"); Q.run(0.5)', 'egg'],
    ['+ shock: COMBO!', 'Q.take("shock"); Q.run(0.15)', 'card'],
    ['egg sticks to the live ring', 'Q.run(0.5)', 'egg'],
    ['turn: carried round', 'Q.run(0.8); Q.tryTurn(Q.shockRing(), 100, 1.6)', 'vault'],
    ['end', 'Q.run(6)', 'vault'],
  ],
  combo_stink: [
    ['wait for the snakes', 'Q.run(2.8)'],
    ['decoy', 'Q.take("decoy"); Q.run(0.4)', 'vault'],
    ['+ pepper: COMBO!', 'Q.take("pepper"); Q.run(0.15)', 'card'],
    ['peppered decoy', 'Q.run(0.6)', 'decoy'],
    ['bitten: stink cloud', 'Q.bite(); Q.run(0.2)', 'vault'],
    ['snakes run off', 'Q.run(0.6)', 'snake'],
  ],
};

const srv = http.createServer((q, r) => {
  const f = path.join(dir, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); });
}).listen(PORT);

// page-side helpers (installed once per scenario)
function install(kind) {
  const E = __egg, D2R = Math.PI / 180;
  E.setSave({ mode: 'medium', calm: false, seen: {} });
  E.startDemo(kind, { direct: true });
  E.G.paused = true;
  E.G.toast = null; E.G.toasts.length = 0;
  const sim = () => E.G.sim;
  // no pickups until the scenario says so
  for (const o of sim().orbs) o.taken = true;
  let follow = null; // the egg the strip follows
  // the eggs wait where they start until the first pickup, so the creatures come in without anything breaking first
  let pin = sim().eggs.map((e) => { const q = e.body.getPosition(); return [e, q.x, q.y]; });
  const tick = () => {
    if (pin) for (const [e, x, y] of pin) if (e.alive && e.body) { e.body.setTransform({ x, y }, 0); e.body.setLinearVelocity({ x: 0, y: 0 }); e.body.setAngularVelocity(0); }
    E.frame(1 / 60);
  };
  const Q = (window.Q = {
    // keep the eggs where they are now (a long wait to the end of a power, not the point of the frame)
    hold() { pin = sim().eggs.filter((e) => e.alive && !e.saved && e.body).map((e) => { const q = e.body.getPosition(); return [e, q.x, q.y]; }); },
    run(s) { for (let i = 0; i < Math.round(s * 60); i++) tick(); },
    until(cond, max) { for (let i = 0; i < max * 60 && !eval(cond); i++) tick(); },
    scr(x, y) { const G = E.G, P = G.play; return { x: P.x + P.w / 2 + (x - G.cam.x) * G.cam.k, y: P.y + P.h / 2 - (y - G.cam.y) * G.cam.k }; },
    egg() {
      const s = sim();
      if (follow && follow.alive && !follow.saved && follow.body) return follow;
      follow = s.eggs.find((e) => e.alive && !e.saved && e.body) || null;
      return follow;
    },
    fx(pre) { return Object.keys(sim().p2.fx).some((k) => k[0] === pre); },
    eagleIn() { const A = sim().eagle; return A && !A.end && A.phase !== 'away' && A.phase !== 'enter' && Math.hypot(A.x, A.y) < 6; },
    decoy() { return sim().p2d && sim().p2d.alive ? sim().p2d : null; },
    // a snake reaches the decoy and bites (staged: the same call snakeStep makes)
    bite() { const s = sim(), Sn = s.snakes.find((x) => !x.gone && x.pts.length > 1); if (Sn && Q.decoy()) { s.decoyBite(Sn); E.handle(); } },
    shockRing() { return sim().p2.shockR; },
    // put the followed egg on the orb: a real pickup through the contact
    // (the contact path: orb.taken, then takeOrb; the egg may already overlap the orb, so no new contact would begin)
    take(type) {
      const s = sim(), o = s.orbs.find((x) => x.alive && x.type === type), e = Q.egg();
      if (!o || !e) return;
      pin = null;
      e.body.setTransform({ x: o.x, y: o.y }, 0); e.body.setLinearVelocity({ x: 0, y: 0 });
      o.taken = true;
      s.takeOrb(e, o);
      E.frame(1 / 60);
    },
    fire(deg) { const s = sim(); if (s.laserReady()) { s.fireLaser(deg * D2R); E.handle(); } },
    ringPt(i, a, dr = 0) { const R = sim().rings[i], w = R.body.getAngle() + a, r = R.r + dr; return { x: r * Math.cos(w), y: r * Math.sin(w) }; },
    thorn(i) { const R = sim().rings[i], th = R.thorns.find((t) => t.alive); return th ? Q.ringPt(i, th.a, -0.3) : Q.ringPt(i, -Math.PI / 2, -0.3); },
    eggAt(p, vy = -1) { const e = Q.egg(); if (!e) return; e.body.setTransform({ x: p.x, y: p.y }, 0); e.body.setLinearVelocity({ x: 0, y: vy }); e.body.setAngularVelocity(0); },
    // turn ring i so its gap g faces down, then drop the egg onto it from inside
    gapDown(i, g) { const R = sim().rings[i], G0 = R.gaps[g], a = -Math.PI / 2 - G0.a; R.body.setTransform(R.body.getPosition(), a); R.target = a; R.body.setAngularVelocity(0); return G0; },
    eggAtGap(i, g, dr = 0.32) { Q.gapDown(i, g); Q.eggAt(Q.ringPt(i, sim().rings[i].gaps[g].a, -dr), -0.6); },
    // ring-local angle of the middle of ring i's pads (burnt ones too)
    padA(i) { const P = sim().rings[i].segs.filter((x) => x.pad || x.padBurnt); if (!P.length) return 0; const sg = P[P.length >> 1]; return (sg.a0 + sg.a1) / 2; },
    eggAtPad(i) { const R = sim().rings[i], pa = Q.padA(i), a = -Math.PI / 2 - pa; R.body.setTransform(R.body.getPosition(), a); R.target = a; Q.eggAt(Q.ringPt(i, pa, -0.3), -2.5); },
    eggAtBarrier(k) { const b = sim().barriers[k]; if (!b) return; const R = sim().rings[b.ring], w = R.body.getAngle() + b.a - 0.12, r = b.base - b.h * 0.5; Q.eggAt({ x: r * Math.cos(w), y: r * Math.sin(w) }, 0); const e = Q.egg(); e.body.setLinearVelocity({ x: 2.5 * Math.sin(w), y: -2.5 * Math.cos(w) }); },
    eggOnRing() { const s = sim(), i = s.p2.shockR, e = Q.egg(); if (!e || i < 0) return; Q.eggAt(Q.ringPt(i, -Math.PI / 2 - s.rings[i].body.getAngle(), -0.34), -1.5); },
    drop(h) { const e = Q.egg(), R = sim().rings[1]; Q.gapDown(1, 0); const a = -Math.PI / 2; Q.eggAt({ x: 0.3, y: (R.r - 0.36) * Math.sin(a) + h }, -4); },
    decoyToGap(i, g) { const d = Q.decoy(); if (!d) return; Q.gapDown(i, g); const p = Q.ringPt(i, sim().rings[i].gaps[g].a, -0.1); d.body.setTransform({ x: p.x, y: p.y }, 0); d.body.setLinearVelocity({ x: 0, y: -1 }); },
    // try to turn ring i by deg over s seconds the way the player does (through its target)
    tryTurn(i, deg, s = 0.6) { const R = sim().rings[i], n = Math.round(s * 60); for (let k = 0; k < n; k++) { R.target = R.body.getAngle() + (deg * D2R) / n * 4; E.frame(1 / 60); } },
    // screen point to centre a crop on
    at(what) {
      const s = sim();
      let w = null;
      if (what === 'vault') w = { x: 0, y: 0 };
      else if (what === 'egg') { const e = Q.egg(); if (e) { const q = e.body.getPosition(); w = { x: q.x, y: q.y }; } }
      else if (what === 'snake') { const Sn = s.snakes.find((x) => !x.gone && x.pts.length) ; if (Sn) w = { x: Sn.pts[0].x, y: Sn.pts[0].y }; }
      else if (what === 'sal') { const C = (s.sals || []).find((x) => x.pts && x.pts.length); if (C) w = { x: C.pts[0].x, y: C.pts[0].y }; }
      else if (what === 'eagle') { const A = s.eagle; if (A) w = { x: A.x, y: A.y }; }
      else if (what === 'decoy') { const d = Q.decoy(); if (d) { const q = d.body.getPosition(); w = { x: q.x, y: q.y }; } }
      else if (what === 'portal') { const P = s.portals[0]; if (P) w = { x: P.ax ?? P.a.x ?? P.a[0], y: P.ay ?? P.a.y ?? P.a[1] }; }
      else if (what && what.ring != null) {
        const R = s.rings[what.ring];
        const a = what.gap != null ? R.gaps[what.gap].a : what.pad != null ? Q.padA(what.ring) : (what.a || 0);
        w = Q.ringPt(what.ring, a, what.dr || -0.15);
      }
      return w ? Q.scr(w.x, w.y) : null;
    },
  });
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(`http://localhost:${PORT}/`);
  await p.waitForTimeout(900);
  const rows = [];
  for (const [kind, steps] of Object.entries(S)) {
    if (only && !only.includes(kind)) continue;
    await p.evaluate(install, kind);
    const frames = [];
    const vault = await p.evaluate(() => Q.at('vault'));
    let last = { x: VW / 2, y: VH / 2 };
    for (const [label, code, crop] of steps) {
      if (code) await p.evaluate(code);
      if (!crop) continue;
      const f = path.join(out, `${kind}-${frames.length}.png`);
      let clip;
      if (crop === 'card') clip = { x: 0, y: 0, width: VW, height: 230 };
      else if (crop === 'vault') { const h = 420; clip = { x: 0, y: Math.round(Math.max(0, vault.y - h / 2)), width: VW, height: h }; }
      else {
        const c = (await p.evaluate((w) => Q.at(w), crop)) || last;
        last = c;
        const top = (await p.evaluate(() => !!__egg.G.card)) ? 240 : 100; // below the HUD (and the card while it shows)
        const cx = Math.round(Math.min(Math.max(c.x, CLOSE / 2), VW - CLOSE / 2)), cy = Math.round(Math.min(Math.max(c.y, top + CLOSE / 2), VH - CLOSE / 2));
        clip = { x: cx - CLOSE / 2, y: cy - CLOSE / 2, width: CLOSE, height: CLOSE };
      }
      await p.screenshot({ path: f, clip });
      frames.push({ f, label, w: clip.width, h: clip.height });
    }
    rows.push({ kind, frames });
    console.log(kind, frames.length + ' frames');
  }
  // sheets: a few rows each, the crops at their css size (real phone scale)
  const per = 3;
  const sheets = [];
  for (let i = 0; i < rows.length; i += per) {
    const part = rows.slice(i, i + per);
    const html = `<html><body style="margin:0;background:#1d1712;color:#f5e6c8;font:13px sans-serif;padding:8px">${part.map((r) => `<div style="margin-bottom:12px"><div style="font-weight:bold;font-size:16px;margin:2px 0 4px">${r.kind}</div><div style="display:flex;gap:6px;align-items:flex-start">${r.frames.map((x) => `<div><img style="width:${x.w}px;height:${x.h}px;display:block;border-radius:6px" src="data:image/png;base64,${fs.readFileSync(x.f).toString('base64')}"><div style="padding:2px;max-width:${x.w}px">${x.label}</div></div>`).join('')}</div></div>`).join('')}</body></html>`;
    const width = Math.max(...part.map((r) => r.frames.reduce((a, x) => a + x.w + 6, 0))) + 20;
    const p2 = await b.newPage({ viewport: { width, height: 400 }, deviceScaleFactor: 1.5 });
    await p2.setContent(html);
    const name = path.join(out, `powers-${String(sheets.length + 1).padStart(2, '0')}-${part.map((r) => r.kind.replace('combo_', '+')).join('-')}.png`);
    await p2.screenshot({ path: name, fullPage: true });
    await p2.close();
    sheets.push(name);
  }
  if (!process.argv.includes('--keep')) for (const r of rows) for (const x of r.frames) fs.unlinkSync(x.f); // --keep: the single frames too
  for (const e of errors) console.log('PAGE ERROR: ' + e);
  for (const s of sheets) console.log('-> ' + s);
  await b.close();
  srv.close();
})();
