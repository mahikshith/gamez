// The "i" panel check. Fails (exit 1) when a level, practice vault or Wonder Vault carries a villain, boss attack or
// hazard that src/data/villain-info.js does not cover, when a level key is neither a known villain/hazard nor known
// board furniture (so a NEW creature key can never slip in unexplained), or when opening the panel throws.
// 1) a static scan of the level data (its own key map, independent of villainKinds), 2) in the dev build: every level
// 1-50, every practice vault and every Wonder Vault is started, the panel opened (the HUD "i", or the test opener when
// the list is empty) and drawn for a while at two sizes, with zero page errors and no overlapping text allowed.
// Usage: node tools/info-check.cjs [dist/dev]   (env INFO_PORT, default 8810)
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dir = path.resolve(process.argv[2] || path.join(root, 'dist/dev'));
const PORT = +process.env.INFO_PORT || 8810;
const problems = [];
const bad = (s) => problems.push(s);

// board furniture: level keys that are not villains or hazards (a key in neither list fails the check)
const BOARD = new Set(['id', 'key', 'kind', 'theme', 'name', 'eggs', 'target', 'time', 'spacing', 'material', 'nest', 'bonus', 'tip', 'seed', 'world', 'intro',
  'rings', 'orbs', 'portals', 'barriers', 'weatherOpts', 'eggKinds', 'water', 'shape', 'rock', 'boss', 'chickEggs', 'allies', 'pitch', 'wonder', 'r0', 'solve', 'fails', 'cw']);
const RING_BOARD = new Set(['gaps', 'thorns', 'pads', 'mat', 'gear', 'oneway', 'ice', 'honey', 'shape', 'fixed', 'grate']);
const GAP_BOARD = new Set(['a', 'len', 'x', 'shut', 'curtain', 'grate']);
// villain / hazard keys -> table kind
const CREATURE = ['snake', 'weasel', 'rats', 'octopus', 'fish', 'frog', 'eagle', 'salamander', 'hermit', 'puffer', 'jelly', 'gator', 'turtle', 'mosquito', 'spider', 'beetle', 'jack'];
const HAZARD_KEY = { icicles: 'icicles', lava: 'lava', gusts: 'gusts', wind: 'gusts' };
const WEATHER = { thunder: 'lightning', current: 'current', embers: 'embers', quake: 'quake', rain: 'rain' };
const ORB = { curse: 'curse', thorn: 'thornorb' };
const listOf = (v) => (!v ? [] : Array.isArray(v) ? v : [v]);

function scan(L, where, INFO) {
  const want = new Set();
  const F = L.bossFight, boss = F && (F.kind || L.boss);
  if (boss) {
    want.add('boss:' + boss);
    const B = INFO['boss:' + boss];
    for (const P of F.phases || []) {
      for (const a of P.attacks || []) if (boss !== 'snake' && !(B && B.attacks && B.attacks[a])) bad(`${where}: boss ${boss} attack "${a}" has no counter in the table`);
      if (P.heat && !(B && B.attacks && B.attacks.heat)) bad(`${where}: boss ${boss} heat phase has no line in the table`);
    }
  }
  for (const k of Object.keys(L)) {
    if (BOARD.has(k) || k === 'bossFight' || k === 'weather') continue;
    if (CREATURE.includes(k)) {
      const n = listOf(L[k]).length;
      if ((k === 'snake' && boss === 'snake') || (k === 'eagle' && boss === 'eagle') || (k === 'salamander' && boss === 'salamander' && n === 1)) continue;
      if (n) want.add(k);
    } else if (HAZARD_KEY[k]) want.add(HAZARD_KEY[k]);
    else bad(`${where}: level key "${k}" is neither a villain/hazard nor known board furniture`);
  }
  if (L.weather) { if (WEATHER[L.weather]) want.add(WEATHER[L.weather]); else bad(`${where}: weather "${L.weather}" not in the table`); }
  for (const [ri, r] of (L.rings || []).entries()) {
    for (const k of Object.keys(r)) {
      if (k === 'retract') want.add('popthorns');
      else if (k === 'vine' || k === 'vineOpts') want.add('vines');
      else if (!RING_BOARD.has(k)) bad(`${where}: ring ${ri} key "${k}" unknown`);
    }
    for (const g of r.gaps || []) for (const k of Object.keys(g)) { if (k === 'vine') want.add('vines'); else if (!GAP_BOARD.has(k)) bad(`${where}: gap key "${k}" unknown`); }
  }
  const orbs = [...(L.orbs || []).map((o) => o.type), ...(L.portals || []).flatMap((p) => p.emit || []), ...((F && F.throws) || [])];
  for (const t of orbs) if (ORB[t]) want.add(ORB[t]);
  for (const k of want) if (!INFO[k]) bad(`${where}: "${k}" is missing from VILLAIN_INFO`);
  return want;
}

(async () => {
  const imp = (f) => import(path.join(root, 'src/data', f));
  const { VILLAIN_INFO: INFO } = await imp('villain-info.js');
  const { LEVELS } = await imp('levels.js');
  const { DAILY } = await imp('daily.js');
  const { WONDER_LEVELS } = await imp('wonder-levels.js');
  const demos = [];
  for (const f of ['chick-demos', 'sea-demos', 'power-demos', 'thief-demo', 'ally-demos', 'reef-demos', 'bayou-demos', 'lab-demos', 'frog-demo']) for (const v of Object.values(await imp(f + '.js'))) demos.push(...listOf(v));
  // the table itself: every entry has its lines, none over ~70 characters (80 is a hard stop)
  for (const [k, I] of Object.entries(INFO)) {
    for (const f of ['name', 'does', 'beat', 'group']) if (!I[f]) bad(`table ${k}: no ${f}`);
    for (const line of [I.does, I.beat, ...Object.values(I.attacks || {})]) if (line && line.length > 80) bad(`table ${k}: line over 80 characters: ${line}`);
  }
  const expect = {};
  LEVELS.forEach((L, i) => { expect['L' + (i + 1)] = [...scan(L, `L${L.id}`, INFO)]; });
  DAILY.forEach((L, i) => scan(L, `daily ${i}`, INFO));
  demos.forEach((L) => { expect['demo:' + L.kind] = [...scan(L, `practice ${L.kind}`, INFO)]; });
  WONDER_LEVELS.forEach((L) => { expect['wonder:' + L.key] = [...scan(L, `wonder ${L.key}`, INFO)]; for (const V of (L.wonder && L.wonder.vaults) || []) scan(V, `wonder ${L.key} vault`, INFO); });

  // ---- in the dev build
  const srv = http.createServer((q, r) => {
    const u = q.url.split('?')[0], f = path.join(dir, u === '/' ? 'index.html' : u);
    fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); });
  }).listen(PORT);
  const b = await chromium.launch();
  let opened = 0;
  for (const [w, h] of [[390, 844], [640, 360]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    const errors = [];
    p.on('pageerror', (e) => errors.push(String(e)));
    await p.goto(`http://localhost:${PORT}/`);
    await p.waitForTimeout(800);
    const labs = await p.evaluate(() => __egg.LAB.flatMap((g) => g.items.map((it) => it[0])));
    const wonders = await p.evaluate(() => __egg.wonder.LEVELS.map((L) => L.key));
    const runs = [...LEVELS.map((L, i) => ({ id: 'L' + (i + 1), i })), ...labs.map((k) => ({ id: 'demo:' + k, demo: k })), ...wonders.map((k) => ({ id: 'wonder:' + k, demo: k, wonder: 1 }))];
    for (const R of runs) {
      const r = await p.evaluate(async (R) => {
        const E = __egg, G = E.G;
        if (R.wonder) E.startDemo(R.demo); else if (R.demo) { G.screen = 'practice'; await E.press('demo:' + R.demo); } else E.start(R.i); // a practice tile, as the Practice screen opens it
        if (!R.wonder) E.press('go');
        for (let k = 0; k < 30; k++) E.frame(1 / 60);
        const hud = !R.wonder && E.uiRect('btn:info'); // the HUD button is there when (and only when) the list is not empty
        const kinds = R.wonder ? E.openInfo() : G.infoKinds.slice();
        if (!R.wonder) { if (kinds.length) E.press('info'); else E.openInfo(); }
        let ov = [];
        for (let k = 0; k < 40; k++) { E.frame(1 / 60); if (k === 39) ov = E.overlaps(); }
        const S = G.iscroll; S.y = S.max; E.frame(1 / 60); ov = ov.concat(E.overlaps());
        const screen = G.screen;
        E.press('info:close'); E.frame(1 / 60);
        return { kinds, hud: !!hud, screen, back: G.screen, missing: kinds.filter((k) => !E.VILLAIN_INFO[k]), ov: ov.map((o) => o.join(' x ')) };
      }, R);
      opened++;
      const where = `${w}x${h} ${R.id}`;
      if (r.screen !== 'info') bad(`${where}: the panel did not open (screen ${r.screen})`);
      if (r.missing.length) bad(`${where}: kinds missing from the table: ${r.missing.join(', ')}`);
      if (!R.wonder && r.hud !== r.kinds.length > 0) bad(`${where}: HUD "i" shown=${r.hud} but ${r.kinds.length} kinds`);
      if (r.ov.length) bad(`${where}: overlaps: ${r.ov.join('; ')}`);
      const exp = expect[R.id];
      if (exp) for (const k of exp) if (!r.kinds.includes(k)) bad(`${where}: the level has "${k}" but the panel does not list it`);
      if (w === 390 && R.i !== undefined) console.log(`${R.id.padEnd(4)} ${r.kinds.join(', ') || '(none)'}`);
    }
    for (const e of errors) bad(`${w}x${h} PAGE ERROR: ${e}`);
    await p.close();
  }
  await b.close();
  srv.close();
  console.log(problems.length ? problems.join('\n') : 'INFO OK');
  console.log(`panel opened ${opened} times (levels 1-${LEVELS.length}, ${demos.length} practice vaults in data, Wonder Vaults); problems: ${problems.length}`);
  process.exit(problems.length ? 1 : 0);
})();
