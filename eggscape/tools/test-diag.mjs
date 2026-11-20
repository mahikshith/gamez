// node tools/test-diag.mjs : the built-in speed log (src/diag.js) on made-up frames
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
// a tiny stand-in for the browser
let clock = 0; const mem = {};
globalThis.performance = { now: () => clock };
globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
const { diag } = await import('../src/diag.js');
const PERF = { step: 2, fpsCap: 60, pace: 1, why: '' };
let sim = null, state = 'play', bakes = 0;
diag.init({ version: 'test', app: false, perf: PERF, guess: () => ({ gpu: 'Mali-G52', tier: 'medium' }), counters: () => [bakes, 0, 0], sim: () => sim, state: () => state, level: () => ({ id: 7, gfx: 'auto', foes: ['snake'] }) });
const run = (screen, frames, gap, work = 4) => { for (let i = 0; i < frames; i++) { clock += gap; diag.frame(gap, work, 16.7, 1, screen); } };
const kinds = () => diag.lines().map((l) => JSON.parse(l));
const of = (k) => kinds().filter((o) => o.k === k);
ok(of('ses').length === 1 && of('dev').length === 1 && of('dev')[0].gpu === 'Mali-G52', 'a session starts with the build and the phone');
ok(!/name|email|account|lat|lon/i.test(Object.keys(of('dev')[0]).join(',')), 'no personal fields about the player');
run('levels', 200, 16.7);
sim = { id: 1 }; run('play', 2, 16.7);
ok(of('scr').length === 1 && of('scr')[0].s === 'levels' && of('scr')[0].n > 150, 'a menu visit is one line');
ok(of('lvl').length === 1 && of('lvl')[0].id === 7 && of('lvl')[0].foes[0] === 'snake' && !('sim' in of('lvl')[0]), 'a level start notes the level and its villains');
run('play', 360, 16.7); // 6 s smooth
let w = of('w');
ok(w.length === 3 && w.every((o) => o.g[0] === o.n && o.late === 0 && Math.abs(o.fps - 59.9) < 0.6), `smooth play: one line per 2 s, every frame on time (${w.length} lines, ${w[0] && w[0].fps} fps)`);
bakes = 5; run('play', 60, 33.4, 9); // 2 s at half rate
w = of('w');
ok(w.length === 4 && w[3].g[1] === w[3].n && w[3].late === w[3].n && Math.abs(w[3].fps - 29.9) < 0.6 && w[3].js === 9 && w[3].bk && w[3].bk[0] === 5, 'slow play: gaps counted in refreshes, all late, work and baked pictures noted');
diag.mark('hen:pirate'); clock += 400; diag.frame(400, 180, 16.7, 1, 'play');
const h = of('hit');
ok(h.length === 1 && h[0].gap === 400 && h[0].mk === 'hen:pirate' && h[0].s === 'play', 'a hitch is one line with what had just happened');
PERF.step = 4; PERF.why = 'slow'; run('play', 3, 16.7);
ok(of('gov').length === 1 && of('gov')[0].from === '2|60|1' && of('gov')[0].to === '4|60|1' && of('gov')[0].why === 'slow', 'a graphics change by Auto is noted with its reason');
run('pause', 120, 16.7); run('play', 30, 16.7);
ok(of('end').length === 0 && of('lvl').length === 1, 'the pause page keeps the level open');
state = 'won'; run('win', 5, 16.7);
const e = of('end');
ok(e.length === 1 && e[0].res === 'won' && e[0].id === 7 && e[0].hits === 1 && e[0].worst === 400 && e[0].n > 400, `the level ends with its summary (${e[0] && e[0].n} frames, ${e[0] && e[0].late}% late)`);
state = 'play'; sim = { id: 2 }; run('play', 5, 16.7); sim = { id: 3 }; run('play', 5, 16.7);
ok(of('lvl').length === 3 && of('end').some((o) => o.res === 'restart'), 'a restart closes the level and opens the next');
diag.error('boom'); ok(of('err').length === 1, 'a frame error is noted');
diag.flush();
ok(typeof mem['eggscape.diag.v1'] === 'string' && mem['eggscape.diag.v1'].split('\n').length === diag.lines().length, 'the log is kept on the phone');
// the size limit: hours of play never grow past it
for (let i = 0; i < 9000; i++) run('play', 121, 16.7);
ok(diag.stats().kb <= 400 && diag.lines().length > 1000, `it stays under its size limit (${diag.stats().kb} KB, ${diag.lines().length} lines)`);
const t = diag.text();
ok(t.startsWith('Eggscape speed log test') && JSON.parse(t.split('\n')[2]).gpu === 'Mali-G52' && t.split('\n').slice(2).filter(Boolean).every((l) => { try { JSON.parse(l); return true; } catch (_) { return false; } }), 'the shared file is a header, the phone (even after hours of play), then one JSON object per line');
console.log(fails ? `\n${fails} FAILED` : '\nall speed log checks pass'); process.exit(fails ? 1 : 0);
