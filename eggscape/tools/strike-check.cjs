// Chick Strike matrix: every strike on every creature kind and every boss, in the dev build, 600 frames each (render
// included). Fails on any page error, console error, exception, NaN in a creature or egg position, or a strike that
// never lands. Usage: node tools/strike-check.cjs [dist/dev/index.html] [--only=freeze,glue] [--types=snake,kc]
const { chromium } = require('playwright');
const path = require('path');
const html = path.resolve(process.argv.slice(2).find((a) => !a.startsWith('--')) || 'dist/dev/index.html');
const opt = (k) => ((process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || '').split(',').filter(Boolean);
const IDS = opt('only').length ? opt('only') : ['freeze', 'thunder', 'bomb', 'decoy', 'tornado', 'glue'];
// one place to meet each creature kind (campaign level id, or a dev demo) and each boss (type*; L15's frost gecko is a sal boss)
const CASES = [
  ['snake', 7], ['octo', 13], ['sal', 22], ['eagle', 27], ['thief', 31], ['hermit', 36], ['puff', 37], ['jelly', 38],
  ['gator', 41], ['turtle', 42], ['mosq', 42], ['spider', 46], ['beetle', 48], ['jack', 48], ['frog', 'frog'], ['fish', 'fish'],
  ['thief*', 5], ['snake*', 10], ['sal*', 15], ['bx*', 20], ['sal*', 25], ['bx*', 30], ['thief*', 35], ['kc*', 40], ['gator*', 45], ['bx*', 50],
].filter(([t]) => !opt('types').length || opt('types').includes(t.replace('*', '')));

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  let errs = [];
  p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + html); await p.waitForTimeout(800);
  let fails = 0, n = 0;
  for (const [type, lv] of CASES) for (const id of IDS) {
    errs = [];
    const r = await p.evaluate(([type, lv, id]) => {
      const E = __egg, want = type.replace('*', ''), boss = type.endsWith('*');
      E.setSave({ mode: 'medium', calm: false, strikeSeen: { freeze: 1, thunder: 1, bomb: 1, decoy: 1, tornado: 1, glue: 1 } });
      if (lv === 'frog') E.startFrog({ direct: true }); else if (lv === 'fish') E.startDemo('fish', { direct: true }); else E.start(lv - 1, { direct: true });
      const sim = () => E.G.sim;
      const find = () => sim().stkTargets().find((T) => T.type === want && !!T.boss === boss);
      let T = null;
      for (let i = 0; i < 60 * 60 && !(T = find()); i++) { if (sim().state !== 'play') return { skip: 'level ended before a ' + type + ' showed' }; E.step(1 / 60); }
      if (!T) return { skip: 'no ' + type };
      const hits = [];
      const s0 = sim(), emit = s0.emit.bind(s0);
      s0.emit = (ty, d) => { if (ty === 'stkHit') hits.push(d); return emit(ty, d); };
      E.G.stkPick = { key: T.key, t: E.G.t };
      const fired = E.strike(id);
      if (!fired || !fired.ok) return { err: 'fire failed ' + JSON.stringify(fired) };
      const bad = [];
      for (let f = 0; f < 600; f++) {
        try { E.frame(1 / 60); } catch (e) { return { err: 'frame ' + f + ': ' + e.message }; }
        if (f % 30 === 0) {
          const s = sim();
          for (const X of s.stkTargets()) if (!Number.isFinite(X.x) || !Number.isFinite(X.y)) bad.push(X.key);
          for (const e of s.aliveEggs()) { const q = e.body.getPosition(); if (!Number.isFinite(q.x) || !Number.isFinite(q.y)) bad.push('egg' + e.id); }
          const K = s.stk; if (!Number.isFinite(K.m)) bad.push('meter');
        }
      }
      if (bad.length) return { err: 'NaN ' + bad.slice(0, 4).join(',') };
      const h = hits[0];
      if (!h) return { err: 'never hit' };
      return { ok: 1, key: T.key, hit: h.key, miss: !!h.miss, cancel: !!h.cancel, hurt: !!h.hurt };
    }, [type, lv, id]);
    n++;
    const tag = `${type.padEnd(7)} L${String(lv).padEnd(4)} ${id.padEnd(8)}`;
    if (r.skip) { console.log(`SKIP ${tag} ${r.skip}`); fails++; continue; }
    if (r.err || errs.length) { fails++; console.log(`FAIL ${tag} ${r.err || ''} ${errs.slice(0, 3).join(' | ')}`); continue; }
    console.log(`ok   ${tag} target ${r.key} -> ${r.miss ? 'MISS' : r.hit}${r.cancel ? ' (telegraph cancelled' + (r.hurt ? ', hit' : '') + ')' : ''}`);
  }
  console.log(`\n${n} cases, ${fails} failed/skipped`);
  await b.close();
  process.exit(fails ? 1 : 0);
})();
