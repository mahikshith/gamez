// lint819: the owner's layout complaints as rules on what the UI layer recorded this frame (ui.rects: every text and
// button rect; ui.buttons: every tap box; ui.texts: every text drawn, with its fit, dev builds only). One function,
// lint(ui, o), used three ways: the dev build's runtime guard (ui.js begin(), rules ONSCREEN, TAPSIZE, CROWD, once a
// second), tools/qa-overlap.cjs with QA_RULES=1 (every state, every rule) and tools/test-layout.mjs (a few key states).
// A finding: { rule, tag, msg, sev } (sev: bigger is worse; the report sorts on it). Exemptions live in one file,
// tools/layout-allow.cjs, each with its reason; nothing here is exempt by tag.

// tolerances, CSS px unless said
export const TOL = {
  tap: 44, // TAPSIZE: every tap box at least this in both directions
  tapFlow: 56, // TAPSIZE: what a level-flow page needs (play, next, resume, retry, booster ticks, double coins)
  cut: 0.9, // ONSCREEN: a tap box its strip shows less than 90 % of (in either direction) is cut
  gap: 2, // EVENGAP: gaps in one row / column may differ this much; sizes of one role too
  edge: 2, // ALIGN: left / right edges of a column, the centre line of a row
  centre: 4, // ALIGN: a row wider than half the column sits on the column's centre this close
  band: 0.22, // BALANCE: largest empty horizontal band, share of the safe height
  margin: 2, // BALANCE: top and bottom margins may differ this many times (the smaller counted as at least 3 % of the height)
  crowd: 6, // CROWD: two recorded things of different groups at least this far apart
  fit: 0.85, // TEXT: text squeezed under 85 % of its size (or ellipsized) to fit its maxW
  fonts: 3, // FONTS: font sizes per page (sizes within 1 px count as one)
  words: 12, // WORDS: words per page
  thumb: 0.55, // THUMB: the primary button's centre lies below this share of the safe height (the lower 45 %)
};
// the tap boxes a level-flow page needs (rule 2's 56 px list)
export const FLOW_IDS = /^(go|play|next|inext|resume|retry|restart|double|adboost|gotit|finish|party:play|tr:play|sk:go|strip:more|shop:boosts|boost:.*|wv:(go|retry|resume|next|map))$/;
// the primary button of a level-flow page, best first (rule 8)
const PRIMARY = ['go', 'play', 'next', 'inext', 'resume', 'retry', 'gotit', 'finish', 'party:play', 'wv:go', 'wv:retry', 'wv:resume'];
// the level-flow screens (rules 2's 56 px and 8)
export const FLOW_SCREENS = /^(intro|play|pause|win|fail|result)$/;
export const ALL = ['ONSCREEN', 'TAPSIZE', 'EVENGAP', 'ALIGN', 'BALANCE', 'CROWD', 'TEXT', 'FONTS', 'WORDS', 'THUMB'];

const r1 = (v) => Math.round(v * 10) / 10;
const near = (a, b, t) => Math.abs(a - b) <= t;
const geo = (a, b) => near(a.x, b.x, 0.6) && near(a.y, b.y, 0.6) && near(a.w, b.w, 0.6) && near(a.h, b.h, 0.6);

// o: { rules: [...names] (default ALL), screen: 'intro'|..., flow: bool, play: bool (BALANCE exempt) }
export function lint(ui, o = {}) {
  const want = new Set(o.rules || ALL), out = [];
  const A = ui.A || { x: 0, y: 0, w: ui.w, h: ui.h, x1: ui.w, y1: ui.h, cx: ui.w / 2 };
  const SA = A.w * A.h, huge = (q) => q.w * q.h >= 0.3 * SA; // a tap-anywhere catcher or a whole picture: not a button to measure
  const add = (rule, tag, msg, sev) => out.push({ rule, tag, msg, sev: Math.round(sev) });
  const flow = o.flow ?? FLOW_SCREENS.test(o.screen || '');
  const R = ui.rects.filter((q) => q.w > 0.5 && q.h > 0.5);
  // every tap box with its recorded rect (ui.button() records 'btn:'+id; a page that pushes its own tap box records the
  // same geometry under its own tag) and its full size before a scrolling strip cut it (r0)
  const B = ui.buttons.map((b) => {
    const rec = R.find((q) => q.tag === 'btn:' + b.id && geo(q, b)) || R.find((q) => geo(q, b));
    const full = rec && rec.r0 ? rec.r0 : b;
    return { id: b.id, x: b.x, y: b.y, w: b.w, h: b.h, x1: b.x + b.w, y1: b.y + b.h, cx: b.x + b.w / 2, cy: b.y + b.h / 2, full, rec, ui: !!(rec && rec.ui), set: rec && rec.set, cut: full.w > 0 && (b.w < full.w * TOL.cut || b.h < full.h * TOL.cut) };
  });
  const seen = new Set();
  const once = (k) => (seen.has(k) ? false : (seen.add(k), true));

  // 1. ON SCREEN: every tap box (and every recorded text) inside the safe rect; a tap box its strip cuts is cut
  if (want.has('ONSCREEN')) {
    for (const q of [...B, ...R.filter((q) => q.kind === 'text')]) {
      if (q.id != null && huge(q)) continue;
      const out1 = Math.max(A.x - q.x, A.y - q.y, q.x + q.w - A.x1, q.y + q.h - A.y1);
      const tag = q.id != null ? 'btn:' + q.id : q.tag;
      if (out1 > 1 && once('on' + tag)) add('ONSCREEN', tag, `leaves the safe rect by ${r1(out1)} px`, 200 + out1);
      if (q.cut && once('cut' + tag)) add('ONSCREEN', tag, `cut by its strip: ${Math.round((100 * q.w * q.h) / (q.full.w * q.full.h))} % shown (${Math.round(q.w)}x${Math.round(q.h)} of ${Math.round(q.full.w)}x${Math.round(q.full.h)})`, 150 + 50 * (1 - (q.w * q.h) / (q.full.w * q.full.h)));
    }
  }
  // 2. TAP SIZE: 44 px both ways; 56 for what a level-flow page needs
  if (want.has('TAPSIZE')) {
    for (const q of B) {
      if (huge(q)) continue;
      const need = flow && FLOW_IDS.test(q.id) ? TOL.tapFlow : TOL.tap, m = Math.min(q.w, q.h);
      if (m < need - 0.5 && once('tap' + q.id)) add('TAPSIZE', 'btn:' + q.id, `${Math.round(q.w)}x${Math.round(q.h)} under ${need}`, 100 + 2 * (need - m));
    }
  }
  // groups for rules 3 and 4: an explicit layout group (o.group on ui.button / the group of ui.record, kept as .set), else
  // the id's family (face:*, star:*, tile:*); plus the page's wide buttons (a stack: same edges) and any three or more
  // ui buttons of one size on one line (a strip: even gaps)
  const fam = new Map(), put = (k, q) => { if (!fam.has(k)) fam.set(k, []); fam.get(k).push(q); };
  for (const q of B) {
    if (huge(q)) continue;
    let k = q.set || (q.id.includes(':') ? 'fam:' + q.id.split(':')[0] : null);
    if (k && !q.set) { // one family, one role: members of about one size (within 20 %); a header button of the same family is another role
      const like = [...fam.keys()].find((f) => f.startsWith(k + '#') && fam.get(f).some((m) => !m.cut && Math.abs(m.w - q.w) <= 0.2 * Math.max(m.w, q.w) && Math.abs(m.h - q.h) <= 0.2 * Math.max(m.h, q.h)));
      k = like || k + '#' + [...fam.keys()].filter((f) => f.startsWith(k + '#')).length;
    }
    if (k) put(k, q);
    if (q.ui && !q.cut && q.w >= 0.5 * A.w) put('stack', q);
  }
  const bySize = new Map();
  for (const q of B) if (q.ui && !huge(q) && !q.cut) { const k = `${Math.round(q.w)}x${Math.round(q.h)}@${Math.round(q.cy / 3)}`; if (!bySize.has(k)) bySize.set(k, []); bySize.get(k).push(q); }
  for (const [k, L] of bySize) if (L.length >= 3 && ![...fam.keys()].some((f) => f.startsWith('fam:' + L[0].id.split(':')[0] + '#'))) fam.set('strip:' + k, L);
  // a line of items breaks into blocks where a gap is over twice the items' size that way (another block of the page)
  const split = (L, ax) => { const d = ax === 'x' ? 'w' : 'h', out3 = [[L[0]]]; for (let i = 1; i < L.length; i++) { const p = L[i - 1], q = L[i], g = q[ax] - (p[ax] + p[d]); if (g > 2 * Math.max(p[d], q[d]) && g > 40) out3.push([q]); else out3[out3.length - 1].push(q); } return out3; };
  const rows = (L) => { // items sharing a line (centres close), left to right
    const s = [...L].sort((a, b) => a.cy - b.cy), out2 = [];
    for (const q of s) { const r = out2.find((r) => Math.abs(r.cy - q.cy) <= Math.max(4, 0.25 * Math.min(r.h, q.h))); if (r) r.L.push(q); else out2.push({ cy: q.cy, h: q.h, L: [q] }); }
    return out2.flatMap((r) => split(r.L.sort((a, b) => a.x - b.x), 'x')).filter((r) => r.length >= 2);
  };
  const cols = (L) => { // items stacked (horizontal overlap over half the narrower), top to bottom
    const s = [...L].sort((a, b) => a.y - b.y), out2 = [];
    for (const q of s) { const c = out2.find((c) => { const p = c[c.length - 1]; return Math.min(p.x1, q.x1) - Math.max(p.x, q.x) > 0.5 * Math.min(p.w, q.w) && q.y >= p.y1 - 2; }); if (c) c.push(q); else out2.push([q]); }
    return out2.flatMap((c) => split(c, 'y')).filter((c) => c.length >= 2);
  };
  const name = (k, L) => (k === 'stack' ? 'stack' : k.startsWith('strip:') ? 'strip' : k.replace(/^fam:/, '').replace(/#\d+$/, '')) + '[' + L.map((q) => q.id).join(',').slice(0, 80) + ']';
  // 3. EVEN GAPS and equal sizes in a row / column of one group
  if (want.has('EVENGAP') || want.has('ALIGN')) {
    for (const [k, L] of fam) {
      if (k === 'stack') { // the stack only aligns (rule 4)
        for (const c of cols(L)) {
          const dl = Math.max(...c.map((q) => q.x)) - Math.min(...c.map((q) => q.x)), dr = Math.max(...c.map((q) => q.x1)) - Math.min(...c.map((q) => q.x1));
          if (want.has('ALIGN') && Math.max(dl, dr) > TOL.edge) add('ALIGN', name(k, c), `wide buttons' edges differ: left ${r1(dl)} px, right ${r1(dr)} px`, 60 + Math.min(30, Math.max(dl, dr)));
        }
        continue;
      }
      for (const r of rows(L)) {
        const vis = r.filter((q) => !q.cut);
        const gaps = vis.slice(1).map((q, i) => q.x - vis[i].x1);
        const dw = Math.max(...vis.map((q) => q.w)) - Math.min(...vis.map((q) => q.w)), dh = Math.max(...vis.map((q) => q.h)) - Math.min(...vis.map((q) => q.h));
        if (want.has('EVENGAP')) {
          if (gaps.length >= 2 && Math.max(...gaps) - Math.min(...gaps) > TOL.gap) add('EVENGAP', name(k, r), `row gaps ${gaps.map(Math.round).join('/')} px`, 50 + Math.min(30, Math.max(...gaps) - Math.min(...gaps)));
          if (vis.length >= 2 && Math.max(dw, dh) > TOL.gap) add('EVENGAP', name(k, r), `row sizes differ by ${r1(Math.max(dw, dh))} px`, 45 + Math.min(30, Math.max(dw, dh)));
        }
        if (want.has('ALIGN')) {
          const dc = Math.max(...r.map((q) => q.cy)) - Math.min(...r.map((q) => q.cy));
          if (dc > TOL.edge) add('ALIGN', name(k, r), `row off one centre line by ${r1(dc)} px`, 55 + Math.min(30, dc));
          const x0 = Math.min(...r.map((q) => q.x)), x1 = Math.max(...r.map((q) => q.x1)), dx = (x0 + x1) / 2 - A.cx;
          if (!r.some((q) => q.cut) && x1 - x0 > 0.5 * A.w && Math.abs(dx) > TOL.centre && !o.offCentre) add('ALIGN', name(k, r), `row ${r1(dx)} px off the column's centre`, 50 + Math.min(30, Math.abs(dx)));
        }
      }
      for (const c of cols(L)) {
        if (rows(c).length) continue;
        const gaps = c.slice(1).map((q, i) => q.y - c[i].y1);
        const dl = Math.max(...c.map((q) => q.x)) - Math.min(...c.map((q) => q.x)), dr = Math.max(...c.map((q) => q.x1)) - Math.min(...c.map((q) => q.x1));
        if (want.has('EVENGAP') && gaps.length >= 2 && Math.max(...gaps) - Math.min(...gaps) > TOL.gap) add('EVENGAP', name(k, c), `column gaps ${gaps.map(Math.round).join('/')} px`, 50 + Math.min(30, Math.max(...gaps) - Math.min(...gaps)));
        if (want.has('ALIGN') && Math.max(dl, dr) > TOL.edge) add('ALIGN', name(k, c), `column edges differ: left ${r1(dl)} px, right ${r1(dr)} px`, 55 + Math.min(30, Math.max(dl, dr)));
      }
    }
  }
  // the things a page shows: recorded rects (no panels) and tap boxes without a rect, cut to the safe rect
  const things = [...R.filter((q) => !String(q.tag).startsWith('panel')), ...B.filter((q) => !q.rec && !huge(q))].map((q) => ({ tag: q.tag || 'btn:' + q.id, group: q.group || 'btn:' + q.id, set: q.set, container: q.container, kind: q.kind, x: q.x, y: q.y, w: q.w, h: q.h, x1: q.x + q.w, y1: q.y + q.h }));
  // 5. BALANCE: no empty band over 22 % of the height between the first and the last thing; top / bottom margins within 2x
  if (want.has('BALANCE') && !o.play) {
    const SW = ui.w * ui.h, pics = B.filter((q) => !q.rec && huge(q) && q.w * q.h < 0.6 * SW); // a big tap picture (the card's hero) is content; a tap-anywhere catcher is not
    const iv = [...things, ...pics].map((q) => [Math.max(A.y, q.y), Math.min(A.y1, q.y1)]).filter((v) => v[1] > v[0]).sort((a, b) => a[0] - b[0]);
    if (iv.length >= 2) {
      let end = iv[0][1], band = 0, at = 0;
      for (const [a, b] of iv) { if (a - end > band) { band = a - end; at = end; } end = Math.max(end, b); }
      if (band > TOL.band * A.h) add('BALANCE', 'page', `empty band ${Math.round(band)} px (${Math.round((100 * band) / A.h)} % of the height) from y ${Math.round(at)}`, 80 + (100 * band) / A.h);
      const top = iv[0][0] - A.y, bot = A.y1 - end, lo = Math.max(Math.min(top, bot), 0.03 * A.h);
      if (Math.max(top, bot) > TOL.margin * lo) add('BALANCE', 'page', `margins top ${Math.round(top)} px, bottom ${Math.round(bot)} px`, 70 + Math.min(30, 5 * Math.max(top, bot) / lo));
    }
  }
  // 6. CROWDING: nothing closer than 6 px unless one group; text over a button it does not belong to
  if (want.has('CROWD')) {
    const T = things.filter((q) => !huge(q));
    for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
      const a = T[i], b = T[j];
      if (a.group === b.group || a.container === b.group || b.container === a.group || (a.set && a.set === b.set)) continue;
      const dx = Math.max(a.x, b.x) - Math.min(a.x1, b.x1), dy = Math.max(a.y, b.y) - Math.min(a.y1, b.y1);
      if (dx < -1 && dy < -1) { // overlapping: only text over a button is this rule's (the rest is the overlap check's)
        const t = a.kind === 'text' ? a : b.kind === 'text' ? b : null, btn = t === a ? b : a;
        const inside = t && t.x >= btn.x - 1 && t.y >= btn.y - 1 && t.x1 <= btn.x1 + 1 && t.y1 <= btn.y1 + 1; // wholly on it: its own caption
        if (t && !inside && /^btn:/.test(btn.tag) && once('ob' + t.tag + btn.tag)) add('CROWD', t.tag + ' x ' + btn.tag, 'text over a button it does not belong to', 120);
        continue;
      }
      const gap = dx > 0 && dy > 0 ? Math.hypot(dx, dy) : Math.max(dx, dy, 0);
      if (gap < TOL.crowd && once('cr' + a.tag + b.tag)) add('CROWD', a.tag + ' x ' + b.tag, `${r1(gap)} px apart`, 30 + 5 * (TOL.crowd - gap));
    }
  }
  // 7. TEXT: squeezed or cut to fit; font sizes; words
  const TX = (ui.texts || []).filter((t) => t.a > 0.05 && t.x < ui.w && t.x + t.w > 0 && t.y < ui.h && t.y + t.h > 0);
  if (want.has('TEXT')) for (const t of TX) if ((t.fit < TOL.fit || t.cut) && once('tx' + t.str)) add('TEXT', t.tag || 'text:' + t.str, t.cut ? `cut to "${t.str}" (${Math.round(t.fit * 100)} %)` : `squeezed to ${Math.round(t.fit * 100)} % to fit`, 90 + (1 - t.fit) * 100 + (t.cut ? 30 : 0));
  if (want.has('FONTS') && TX.length) {
    const sz = [...new Set(TX.map((t) => Math.round(t.size)))].sort((a, b) => a - b), cl = [];
    for (const s of sz) if (!cl.length || s - cl[cl.length - 1][0] > 1) cl.push([s]); else cl[cl.length - 1].push(s);
    if (cl.length > TOL.fonts) add('FONTS', 'page', `${cl.length} font sizes: ${cl.map((c) => c.join('/')).join(', ')}`, 20 + Math.min(30, 3 * cl.length));
  }
  if (want.has('WORDS') && TX.length) {
    const ws = [], seenS = new Set();
    for (const t of TX) { const k = t.str + '@' + Math.round(t.x) + ',' + Math.round(t.y); if (seenS.has(k)) continue; seenS.add(k); for (const w of t.str.split(/\s+/)) if (/[A-Za-z].*[A-Za-z]/.test(w) || /^[A-Za-z]$/.test(w)) ws.push(w); }
    if (ws.length > TOL.words) add('WORDS', 'page', `${ws.length} words: ${ws.slice(0, 14).join(' ')}${ws.length > 14 ? ' ...' : ''}`, 25 + Math.min(40, ws.length));
  }
  // 8. THUMB: the primary button of a portrait level-flow page in the lower 45 % of the safe height
  if (want.has('THUMB') && flow && !o.play && A.h > A.w) {
    const p = PRIMARY.map((id) => B.find((q) => q.id === id)).find(Boolean);
    if (p) { const f = (p.cy - A.y) / A.h; if (f < TOL.thumb) add('THUMB', 'btn:' + p.id, `centre at ${Math.round(f * 100)} % of the height (want over ${TOL.thumb * 100} %)`, 75 + 100 * (TOL.thumb - f)); }
  }
  return out;
}

// the dev build's runtime guard (ui.js begin(), dev builds only): once a second, rules 1, 2 and 6 (on screen, tap size,
// crowding) on the frame just drawn; one console.warn per problem not seen before. ui.guardOff = true silences it (the
// QA reads the rules itself).
export function guard(ui) {
  if (ui.guardOff || !ui.rects.length || typeof performance === 'undefined') return;
  const now = performance.now();
  if (now - (ui.guardT || 0) < 1000) return;
  ui.guardT = now;
  const seen = (ui.guardSeen = ui.guardSeen || new Set());
  let f = [];
  try { f = lint(ui, { rules: ['ONSCREEN', 'TAPSIZE', 'CROWD'] }); } catch (e) { f = [{ rule: 'GUARD', tag: 'error', msg: String(e) }]; }
  for (const q of f) {
    const k = q.rule + '|' + q.tag;
    if (seen.has(k) || seen.size > 400) continue;
    seen.add(k);
    console.warn(`[layout] ${q.rule} ${q.tag}: ${q.msg}`);
  }
}
