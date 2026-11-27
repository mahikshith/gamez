// node tools/test-unlocked.mjs : the everything-unlocked test app (EGG_UNLOCKED=1) grants the whole coop on every launch, and a normal
// build grants none of it. Needs the normal dev build in dist/dev (`node tools/build.mjs --target web --dev`); this test builds
// the unlocked one itself into a temp folder and then builds the normal dev build again, so dist/dev is left as it was found.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), page = path.join(root, 'dist/dev/index.html');
if (!fs.existsSync(page)) { console.log('FAIL no dev build: node tools/build.mjs --target web --dev'); process.exit(1); }
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const b = await chromium.launch();

// a page's save after its start (and after a second start on the same storage: a launch must not lose or re-grant anything)
async function launched(file, twice) {
  const srv = http.createServer((q, r) => fs.readFile(file, (e, d) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(d); })).listen(0);
  const ctx = await b.newContext({ viewport: { width: 450, height: 1000 } }), p = await ctx.newPage();
  const url = `http://localhost:${srv.address().port}/?shop=app`;
  const read = async () => { await p.waitForFunction(() => window.__egg && window.__egg.G.screen, null, { timeout: 60000 }); return p.evaluate(() => { const E = window.__egg, s = E.save, w = s.wallet; return { coins: w.coins, skins: w.skins.length, hens: w.henSkins.length, chicks: w.chicks.length, owned: Object.values(w.owned), charges: w.charges, tickets: w.tickets, treasures: w.treasures.length, noAds: !!w.noAds, unlocked: s.unlocked, bank: s.spin ? s.spin.bank : 0, kit: s.unlockedKit || 0 }; }); };
  await p.goto(url); let a = await read(), c = null;
  if (twice) { await p.reload(); c = await read(); }
  await ctx.close(); srv.close();
  return { a, c };
}

// 1. a normal build grants nothing
const N = (await launched(page, true));
for (const [k, s] of [['first start', N.a], ['second start', N.c]]) {
  ok(s.coins === 0 && s.skins === 1 && s.hens === 1 && s.chicks === 0 && s.owned.length === 0, `normal build, ${k}: empty purse, classic egg and hen, no chicks, no boosters (coins ${s.coins}, skins ${s.skins}, hens ${s.hens}, chicks ${s.chicks})`);
  ok(!s.noAds && s.unlocked === 1 && s.charges === 0 && s.treasures === 0 && s.bank === 0 && s.kit === 0, `normal build, ${k}: no Premium, level 1 only, no charges, no treasures, no spins, no kit mark`);
}

// 2. the unlocked build: built here, into a temp folder (the dev build is rebuilt afterwards)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'egg-unl-'));
const build = (env) => spawnSync('node', ['tools/build.mjs', '--target', 'web', '--dev'], { cwd: root, env: { ...process.env, ...env }, encoding: 'utf8' });
try {
  const r = build({ EGG_UNLOCKED: '1' });
  if (r.status !== 0) { ok(false, 'the unlocked build builds'); } else {
    fs.copyFileSync(page, path.join(tmp, 'index.html'));
    const U = await launched(path.join(tmp, 'index.html'), true);
    for (const [k, s] of [['first start', U.a], ['second start', U.c]]) {
      ok(s.coins >= 50000 && s.skins >= 15 && s.hens >= 15 && s.chicks >= 9, `unlocked build, ${k}: a big purse (${s.coins}), every egg (${s.skins}), outfit (${s.hens}) and chick (${s.chicks})`);
      ok(s.owned.length === 8 && s.owned.every((n) => n === 9) && s.charges >= 30 && s.tickets.ally >= 90 && s.tickets.skip >= 90, `unlocked build, ${k}: every booster stocked to the cap, charges and tickets full`);
      ok(s.noAds && s.unlocked >= 60 && s.treasures >= 10 && s.bank >= 3, `unlocked build, ${k}: Premium on, every level open, every boss treasure, Lucky Spin pulls banked`);
    }
  }
} finally {
  const r2 = build({ EGG_UNLOCKED: '0' });
  ok(r2.status === 0, 'dist/dev rebuilt as the normal build');
  fs.rmSync(tmp, { recursive: true, force: true });
}
await b.close();
console.log(fails ? `FAILED ${fails}` : 'all ok');
process.exit(fails ? 1 : 0);
