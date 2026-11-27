// node tools/test-layout.mjs : the layout rules (src/ui/layout-rules.js, run through tools/qa-layout.cjs) on a handful of
// key states at 450x1000 and 853x384 of the dev build (dist/dev: run `node tools/build.mjs --target web --dev` first).
// Exits 1 on any break that is neither exempt (tools/layout-allow.cjs) nor one of the breaks already open when the
// checker came in (tools/layout-known.cjs: the worklist, to be emptied page by page; a fixed one is reported as stale).
// --baseline rewrites tools/layout-known.cjs from this run (only when the lead says so). The full run of every state and
// size: QA_RULES=1 in tools/qa-overlap.cjs.
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const LAYOUT = require('./qa-layout.cjs');
const here = path.dirname(fileURLToPath(import.meta.url)), dist = path.join(here, '..', 'dist', 'dev', 'index.html');
const KNOWN_F = path.join(here, 'layout-known.cjs');
// 1. the rules themselves on made-up frames: each rule fires on its break and stays quiet on a clean page
const { lint } = await import('../src/ui/layout-rules.js');
let bad = 0; const ok = (c, m) => { if (!c) { console.log('FAIL ' + m); bad++; } };
const frame = (rects, buttons, texts = []) => ({ w: 450, h: 1000, A: { x: 0, y: 0, w: 450, h: 1000, x1: 450, y1: 1000, cx: 225, cy: 500 }, rects, buttons, texts });
const btn = (id, x, y, w, h, o = {}) => [{ x, y, w, h, tag: 'btn:' + id, group: 'btn:' + id, ui: 1, kind: 'btn', ...o }, { id, x, y, w, h }];
const page = (...bs) => frame(bs.map((b) => b[0]), bs.map((b) => b[1]));
const rules = (f, o = { screen: 'intro' }) => new Set(lint(f, o).map((q) => q.rule));
{ const clean = page(btn('back', 16, 16, 56, 56), btn('t:0', 25, 300, 120, 120), btn('t:1', 165, 300, 120, 120), btn('t:2', 305, 300, 120, 120), btn('mid', 25, 600, 400, 60), btn('go', 25, 900, 400, 70));
  const r = rules(clean); ok(!['ONSCREEN', 'TAPSIZE', 'EVENGAP', 'ALIGN', 'CROWD', 'THUMB'].some((k) => r.has(k)), 'a clean page breaks no rule (' + [...r].join(',') + ')'); }
ok(rules(page(btn('go', 300, 900, 200, 70))).has('ONSCREEN'), 'ONSCREEN: a button past the right edge');
ok(rules(frame([{ x: 400, y: 100, w: 30, h: 60, tag: 'face', group: 'faces', r0: { x: 400, y: 100, w: 60, h: 60 } }], [{ id: 'face:x', x: 400, y: 100, w: 30, h: 60 }])).has('ONSCREEN'), 'ONSCREEN: a face its strip cuts to half');
ok(rules(page(btn('x', 100, 100, 40, 40))).has('TAPSIZE'), 'TAPSIZE: 40 px');
ok(rules(page(btn('go', 25, 900, 400, 50))).has('TAPSIZE') && !rules(page(btn('go', 25, 900, 400, 50)), { screen: 'title' }).has('TAPSIZE'), 'TAPSIZE: PLAY under 56 on the level flow only');
ok(rules(page(btn('t:0', 25, 300, 120, 120), btn('t:1', 155, 300, 120, 120), btn('t:2', 305, 300, 120, 120))).has('EVENGAP'), 'EVENGAP: gaps 10 / 30');
ok(rules(page(btn('a', 25, 600, 400, 60), btn('b', 35, 700, 390, 60))).has('ALIGN'), 'ALIGN: wide buttons 10 px apart on the left');
ok(rules(page(btn('t:0', 25, 300, 120, 120), btn('t:1', 165, 304, 120, 120), btn('t:2', 305, 300, 120, 120))).has('ALIGN'), 'ALIGN: a tile 4 px off the row line');
ok(rules(page(btn('a', 25, 20, 400, 60), btn('go', 25, 900, 400, 70))).has('BALANCE'), 'BALANCE: everything at the edges, a hole between');
ok(rules(page(btn('a', 25, 300, 100, 60), btn('b', 128, 300, 100, 60))).has('CROWD'), 'CROWD: 3 px apart');
ok(rules(frame([{ x: 10, y: 10, w: 100, h: 20, tag: 't', group: 't', kind: 'text' }], [], [{ str: 'A long title', size: 20, fit: 0.7, cut: false, a: 1, x: 10, y: 10, w: 100, h: 20 }])).has('TEXT'), 'TEXT: squeezed to 70 %');
ok(rules(page(btn('go', 25, 300, 400, 70))).has('THUMB'), 'THUMB: PLAY in the top third');
if (bad) { console.log(`FAIL the rules themselves: ${bad}`); process.exit(1); }
if (process.env.LAYOUT_UNIT) { console.log('ok   the rules on made-up frames'); process.exit(0); }

if (!fs.existsSync(dist)) { console.log('FAIL no dev build at dist/dev (node tools/build.mjs --target web --dev)'); process.exit(1); }
const SIZES = (process.env.LAYOUT_SIZES || '450x1000,853x384').split(',').map((s) => s.split('x').map(Number));

// the key states: each a function run in the page (it sets the state up and draws it); names as in tools/qa-overlap.cjs
const SAVE = (lv, extra = '') => `const E = __egg, st = {}; for (let i = 1; i < ${lv}; i++) st[i] = 3; E.setSave({ unlocked: ${lv}, stars: st, wallet: { coins: 147 }, seen: { pickN: 2, rsTried: 1, setOpen: 1, shopHand: 1 } }); const s = E.save; for (let i = 1; i <= 60; i++) s.intro[i] = 1; s.strikeSeen = new Proxy({}, { get: () => 1 }); E.G.toasts = []; E.G.toast = null; ${extra}`;
const F = (n) => `for (let k = 0; k < ${n}; k++) E.frame(1 / 60);`;
const TO_PLAY = `for (let k = 0; k < 4 && E.G.screen === 'intro'; k++) { E.press(k % 2 ? 'inext' : 'go'); ${F(3)} } if (E.G.screen === 'intro') E.G.screen = 'play';`;
const ONLY_S = process.env.LAYOUT_ONLY ? new RegExp(process.env.LAYOUT_ONLY) : null;
const STATES = [
  ['title', `${SAVE(12)} E.G.screen = 'title'; E.G.screenT = 5; ${F(20)}`],
  ['levels', `${SAVE(12)} E.G.screen = 'title'; E.press('levels'); ${F(60)} E.G.mapTravel = null; ${F(2)}`],
  ['L6-intro', `${SAVE(6)} E.start(5); ${F(10)} if (E.ui.buttons.some((b) => b.id === 'stk:gotit')) E.press('stk:gotit'); ${F(5)} if (E.ui.buttons.some((b) => b.id === 'gotit')) E.press('gotit'); ${F(60)}`],
  ['L12-play', `${SAVE(12)} E.start(11); ${F(20)} ${TO_PLAY} ${F(60)}`],
  ['pause', `const E = __egg; E.press('pause'); ${F(30)}`],
  ['win', `${SAVE(12)} E.start(11); E.press('go'); E.frame(1 / 60); E.showResult('win', 3); ${F(400)}`],
  ['fail', `${SAVE(12)} E.start(11); ${F(20)} ${TO_PLAY} E.step(14); E.showResult('fail'); ${F(120)}`],
  ['store', `${SAVE(20)} E.G.screen = 'title'; E.press('shop'); ${F(30)}`],
];

const srv = http.createServer((q, r) => { fs.readFile(dist, (e, d) => { r.writeHead(e ? 404 : 200, { 'content-type': 'text/html' }); r.end(d); }); }).listen(0);
const b = await chromium.launch();
const all = [];
for (const [w, h] of SIZES) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).split('\n')[0]));
  await p.goto(`http://localhost:${srv.address().port}/`);
  await p.waitForFunction(() => window.__egg && ['title', 'levels', 'play'].includes(__egg.G.screen), null, { timeout: 120000 });
  for (const [name, js] of STATES) {
    if (ONLY_S && !ONLY_S.test(name)) continue;
    try { await p.evaluate(`(() => { ${js} })()`); } catch (e) { all.push({ rule: 'ERROR', tag: name, msg: String(e).split('\n')[0], state: name, size: `${w}x${h}` }); continue; }
    if (process.env.LAYOUT_SHOTS) await p.screenshot({ path: path.join(process.env.LAYOUT_SHOTS, `${name}-${w}x${h}.png`) }); // (before the taps: the state as it opens)
    all.push(...(await LAYOUT.lintHere(p, name, `${w}x${h}`)));
  }
  for (const e of errs) all.push({ rule: 'ERROR', tag: 'page', msg: e, state: '-', size: `${w}x${h}` });
  await p.close();
}
await b.close(); srv.close();

if (process.env.LAYOUT_JSON) fs.writeFileSync(process.env.LAYOUT_JSON, JSON.stringify(all));
const key = (q) => `${q.size} ${q.state} ${q.rule} ${q.tag}`; // (not where in the state: a tap or a strip's end finds the same break)
if (process.argv.includes('--baseline')) {
  if (ONLY_S) { console.log('--baseline needs every state (no LAYOUT_ONLY)'); process.exit(1); }
  const open = all.filter((q) => !q.allowed && q.rule !== 'ERROR');
  const txt = `// lint819: the layout breaks already open when the checker came in (2026-11-27), on tools/test-layout.mjs's key states.
// NOT exemptions: this is the worklist the pages are being fixed against (the full one: scratchpad lint819/report-now.md).
// test-layout fails on any break not here and not in tools/layout-allow.cjs, and names entries here that no longer
// happen (fixed: delete them). Written by \`node tools/test-layout.mjs --baseline\`; never add a line by hand to get green.
module.exports = [
${[...new Set(open.map(key))].sort().map((k) => `  ${JSON.stringify(k)}, // ${open.find((q) => key(q) === k).msg.replace(/\n/g, ' ').slice(0, 110)}`).join('\n')}
];
`;
  fs.writeFileSync(KNOWN_F, txt);
  console.log(`baseline: ${open.length} open breaks written to ${KNOWN_F}`);
  process.exit(0);
}
const KNOWN = new Set(fs.existsSync(KNOWN_F) ? require(KNOWN_F) : []);
const fresh = all.filter((q) => !q.allowed && !KNOWN.has(key(q)));
const now = new Set(all.map(key)), ran = new Set(STATES.filter(([n]) => !ONLY_S || ONLY_S.test(n)).map(([n]) => n)), stale = [...KNOWN].filter((k) => !now.has(k) && ran.has(k.split(' ')[1]) && SIZES.some(([w, h]) => k.startsWith(`${w}x${h} `)));
for (const q of fresh.sort((a, c) => (c.sev || 0) - (a.sev || 0)).slice(0, 25)) console.log(`FAIL ${q.size} ${q.state} ${q.rule} ${q.tag}: ${q.msg} (at ${q.at})`);
if (fresh.length > 25) console.log(`FAIL ... ${fresh.length - 25} more`);
if (stale.length) console.log(`fixed (delete from tools/layout-known.cjs): ${stale.length}: ${stale.slice(0, 5).join(' | ')}`);
console.log(`${fresh.length ? 'FAIL' : 'ok  '} layout rules on ${STATES.length} states x ${SIZES.length} sizes: ${fresh.length} new breaks, ${all.filter((q) => KNOWN.has(key(q))).length} known open, ${all.filter((q) => q.allowed).length} exempt`);
process.exit(fresh.length ? 1 : 0);
