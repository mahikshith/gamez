// lint819 layout checker, the QA side. The rules themselves are src/ui/layout-rules.js (run in the page by the UI layer:
// __egg.ui.lint); this file runs them on a state the way a player meets it: at rest, with every scrolling strip that
// drew this frame at both ends, and after one tap on each icon / tile that reveals something in place. Exemptions:
// tools/layout-allow.cjs. Used by tools/qa-overlap.cjs (QA_RULES=1: every state) and tools/test-layout.mjs (a few).
// CLI: node tools/qa-layout.cjs report <findings.json> [more.json ...] <out.md>   (the worklist, grouped by page, worst first)
const fs = require('fs');
const path = require('path');
const ALLOW = require('./layout-allow.cjs');

// in the page: the state's findings. a: { label, play: bool, taps: bool }
function inPage(a) {
  const E = __egg, G = E.G, ui = E.ui, out = [];
  ui.guardOff = true; // the QA reads the rules itself: no console noise from the dev guard
  const MODS = ['settingsOpen', 'detail', 'got', 'party', 'treasure', 'stuckAsk', 'leaveAsk', 'remAsk', 'skipAsk', 'waitList', 'getMore', 'offer', 'chickBuy', 'album', 'setSub', 'mapTravel', 'nudge', 'ageAsk', 'card', 'lesson'];
  const page = () => G.screen + (G.screen === 'intro' && G.itab === 'chicks' ? '+chicks' : '') + MODS.filter((k) => G[k]).map((k) => '+' + k).join('');
  const play = () => a.play || G.screen === 'play';
  const had = new Set(); // the same break seen again (after a tap, at a strip's end) is the same break
  const run = (at) => { for (const f of ui.lint({ screen: G.screen, play: play() })) { const k = f.rule + '|' + f.tag + '|' + f.msg; if (!had.has(k)) { had.add(k); out.push({ ...f, at, page: page() }); } } };
  const fr = (n) => { for (let i = 0; i < n; i++) E.frame(1 / 60); };
  run('rest');
  // every strip that scrolled this frame (glide() stamps S.t), at both ends
  const live = Object.keys(G).filter((k, i, K) => { const S = G[k]; return S && typeof S === 'object' && typeof S.y === 'number' && typeof S.max === 'number' && S.max > 1 && S.t === G.t && K.findIndex((j) => G[j] === S) === i; }); // (one strip under two names once)
  for (const k of live) {
    const S = G[k], y0 = S.y;
    for (const [nm, y] of [['start', 0], ['end', S.max]]) { if (Math.abs(y - y0) < 1) continue; S.y = y; S.v = 0; S.to = null; fr(3); run(k + '@' + nm); }
    S.y = y0; S.v = 0; S.to = null; fr(1);
  }
  // one tap on each icon / tile that shows something in place (a face's demo, a star's goal, a shop tile's sheet)
  if (a.taps) {
    const scr = G.screen, ids = [...new Set(ui.buttons.map((b) => b.id).filter((id) => /^(face:(?!chick)|star:\d|perk:|tile:)/.test(id)))].slice(0, 10);
    for (const id of ids) {
      if (G.screen !== scr) break;
      const d0 = G.detail;
      E.press(id); fr(24); run('tap ' + id);
      if (G.detail !== d0) { G.detail = d0; fr(2); }
    }
  }
  return out;
}

// the findings of the state the page is in now (allow list applied: allowed ones come back with .allowed = reason)
async function lintHere(p, label, size, o = {}) {
  const play = /(-play$|-zoom$|^wonder-[a-z]+$|^bandit$|^urchin-play$|^lesson-|^star-lost$|^scarecrow$|^power-card$|^strip-attn$)/.test(label);
  let f;
  try { f = await p.evaluate(inPage, { label, play, taps: o.taps !== false }); } catch (e) { return [{ rule: 'ERROR', tag: label, msg: String(e).split('\n')[0], sev: 0, state: label, size }]; }
  return f.map((q) => ({ ...q, state: label, size, allowed: allowed(q, label) }));
}

function allowed(q, state) {
  for (const a of ALLOW) {
    if (a.rule && a.rule !== q.rule) continue;
    if (a.tag && !a.tag.test(q.tag)) continue;
    if (a.state && !a.state.test(state)) continue;
    if (a.page && !a.page.test(q.page || '')) continue;
    if (a.msg && !a.msg.test(q.msg)) continue;
    return a.why;
  }
  return null;
}

// the worklist: grouped by page, the same break across states and sizes counted once, worst first
function report(all, title = 'Layout rule breaks') {
  const norm = (t) => String(t).replace(/\d+(\.\d+)?/g, '#');
  const pages = new Map();
  for (const q of all) {
    if (q.allowed) continue;
    const pg = (q.page || '?').replace(/\+mapTravel/, '');
    if (!pages.has(pg)) pages.set(pg, new Map());
    // one entry per kind of break: a page-wide rule once a page; a cut / small tap box once per id family
    const fam = String(q.tag).replace(/^(btn:[^:]+):.*/, '$1:*'), cutOrTap = q.rule === 'TAPSIZE' || /^cut /.test(q.msg);
    const m = pages.get(pg), k = /^(FONTS|WORDS|BALANCE)$/.test(q.rule) ? q.rule + '|' + q.msg.split(' ')[0].replace(/\d+/, '#') + (q.rule === 'BALANCE' ? q.msg.split(' ')[0] : '') : q.rule + '|' + norm(cutOrTap ? fam : q.tag) + '|' + norm(q.msg).replace(/[\d#]+/g, '#').replace(/^cut .*/, 'cut');
    const e = m.get(k) || { rule: q.rule, tag: q.tag, msg: q.msg, sev: q.sev, n: 0, sizes: new Set(), states: new Set(), at: q.at };
    e.n++; e.sizes.add(q.size); e.states.add(q.state);
    if (q.sev > e.sev) Object.assign(e, { sev: q.sev, tag: q.tag, msg: q.msg, at: q.at });
    m.set(k, e);
  }
  const P = [...pages].map(([pg, m]) => ({ pg, L: [...m.values()].sort((a, b) => b.sev - a.sev || b.n - a.n) }));
  P.sort((a, b) => b.L[0].sev - a.L[0].sev || b.L.length - a.L.length);
  const tot = P.reduce((s, p) => s + p.L.length, 0), byRule = {};
  for (const p of P) for (const e of p.L) byRule[e.rule] = (byRule[e.rule] || 0) + 1;
  const worst = P.flatMap((p) => p.L.map((e) => ({ ...e, pg: p.pg }))).sort((a, b) => b.sev - a.sev).slice(0, 10);
  const st = (e) => { const s = [...e.states]; return s.slice(0, 4).join(', ') + (s.length > 4 ? ` +${s.length - 4}` : ''); };
  let md = `# ${title}\n\n${tot} distinct breaks on ${P.length} pages (${all.length} raw findings, ${all.filter((q) => q.allowed).length} on the allow list). By rule: ${Object.entries(byRule).sort((a, b) => b[1] - a[1]).map(([r, n]) => `${r} ${n}`).join(', ')}.\n\n`;
  md += `Columns: severity (bigger is worse), rule, what (tag), the measure, sizes, where (a state of tools/qa-overlap.cjs; "at" = rest, a strip at an end, or after a tap).\n\n## Ten worst\n\n`;
  worst.forEach((e, i) => { md += `${i + 1}. **${e.pg}** ${e.rule} \`${e.tag}\`: ${e.msg} (${[...e.sizes].join(', ')}; ${st(e)}; at ${e.at})\n`; });
  for (const p of P) {
    md += `\n## ${p.pg} (${p.L.length})\n\n| sev | rule | what | measure | sizes | where | at |\n|---|---|---|---|---|---|---|\n`;
    for (const e of p.L) md += `| ${e.sev} | ${e.rule} | \`${String(e.tag).replace(/\|/g, '/').slice(0, 90)}\` | ${String(e.msg).replace(/\|/g, '/').slice(0, 140)} | ${[...e.sizes].join(' ')} | ${st(e)} (${e.n}x) | ${e.at} |\n`;
  }
  return md;
}

module.exports = { lintHere, allowed, report, inPage };

if (require.main === module && process.argv[2] === 'report') {
  const args = process.argv.slice(3), outMd = args.pop();
  const all = args.flatMap((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
  fs.writeFileSync(outMd, report(all, 'Layout rule breaks, ' + new Date().toISOString().slice(0, 10)));
  console.log('wrote', path.resolve(outMd));
}
