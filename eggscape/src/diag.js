// The built-in speed log (0.8.7, mykee: "rather than screenshotting things, build an inbuilt logger: frame rates,
// screen refresh rate, CPU config, everything that could help us debug, at which level things go wrong").
// It runs quietly in every build and keeps about the last two hours of play on the phone (one browser storage key,
// 400 KB at most; the oldest lines fall off). NOTHING is ever sent by the game: Settings > Display > Share log hands
// the file to Android's share sheet (or downloads it on the web) and the tester sends it.
// What a line holds (one small JSON object per line, k = kind, t = seconds since the session began):
//   ses   a session began: build, time                       dev   the phone as the web view and Android describe it
//   lvl   a level began: level, graphics step, canvas size, frame cap, pace, skins, villains, rings
//   w     2 s of play: frames, gaps counted in screen refreshes [1, 2, 3, 4+], late frames, worst gap (ms),
//         the game's own work per frame (average / worst ms), pictures baked
//   scr   a menu screen that was left: the same numbers over the visit
//   hit   one hitch (a gap over 100 ms): where, and what had just happened (mk)
//   gov   Auto changed the graphics step, the frame cap or the pace, and why
//   end   the level's summary, with Android's heat and memory state
//   ctx   the web view took the canvas off the graphics chip (lost) or gave it back (back): 0.8.10, see render/cvfree.js
//   mk    something worth knowing about (a purchase, an ad, a skin put on)   err   a frame error   vis   app hidden / shown
// No names, accounts, locations or identifiers. Pure bookkeeping in frame(): no allocation, a few adds per frame.

const KEY = 'eggscape.diag.v1', MAX = 400000, HITCH = 100, WIN = 2000;
const r1 = (x) => Math.round(x * 10) / 10;
const D = {
  on: false, lines: [], size: 0, t0: 0, env: null, loaded: false, dirty: false, lastSave: 0,
  // the open window (2 s of play, or a menu visit)
  n: 0, g1: 0, g2: 0, g3: 0, g4: 0, late: 0, worst: 0, js: 0, jsx: 0, span: 0, c0: null,
  scr: '', lvl: null, sim: null, gov: '', mark: '', markT: -99, hits: 0,
  // the level's totals
  L: null,
};
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const T = () => r1((now() - D.t0) / 1000);
function store() { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (_) { return null; } }

function push(o) {
  if (!D.on) return;
  let s; try { s = JSON.stringify(o); } catch (_) { return; }
  D.lines.push(s); D.size += s.length + 1; D.dirty = true;
  while (D.size > MAX && D.lines.length > 1) D.size -= D.lines.shift().length + 1;
}
function native(full) {
  try { const b = typeof window !== 'undefined' && window.EggApp; if (b && typeof b.deviceInfo === 'function') return JSON.parse(b.deviceInfo(!!full) || '{}'); } catch (_) { /* no shell, or an older one */ }
  return null;
}
function counters() { try { return D.env && D.env.counters ? D.env.counters() : null; } catch (_) { return null; } }
function govKey() { const P = D.env && D.env.perf; return P ? P.step + '|' + P.fpsCap + '|' + (P.pace || 1) : ''; }
function resetWin() { D.n = D.g1 = D.g2 = D.g3 = D.g4 = D.late = D.worst = D.js = D.jsx = D.span = 0; D.c0 = counters(); }
function winLine(k, extra) {
  if (!D.n) return null;
  const o = { k, t: T(), n: D.n, fps: r1(D.n / Math.max(0.001, D.span / 1000)), g: [D.g1, D.g2, D.g3, D.g4], late: D.late, worst: Math.round(D.worst), js: r1(D.js / D.n), jsx: r1(D.jsx) };
  const c1 = counters(); if (c1 && D.c0) { const d = c1.map((v, i) => v - (D.c0[i] || 0)); if (d.some((v) => v > 0)) o.bk = d; }
  return Object.assign(o, extra || null);
}
function closeLevel(res) {
  const L = D.L; if (!L) return;
  const w = winLine('w'); if (w) push(w);
  const o = { k: 'end', t: T(), id: L.id, res: res || '', s: Math.round((now() - L.at) / 1000), n: L.n, fps: r1(L.n / Math.max(0.001, L.span / 1000)), late: L.n ? r1(100 * L.late / L.n) : 0, worst: Math.round(L.worst), js: L.n ? r1(L.js / L.n) : 0, jsx: r1(L.jsx), hits: L.hits };
  const nat = native(false); if (nat) o.nat = nat;
  try { if (D.env.freed) o.fr = D.env.freed(); } catch (_) { /* optional */ } // [pictures given back so far, MB]
  push(o);
  D.L = null; D.sim = null; resetWin(); save();
}
function openLevel(info) {
  D.L = { id: info.id, at: now(), n: 0, span: 0, late: 0, worst: 0, js: 0, jsx: 0, hits: 0 };
  const o = Object.assign({ k: 'lvl', t: T() }, info); delete o.sim;
  const nat = native(false); if (nat) o.nat = nat;
  push(o); resetWin();
}
function save(force) {
  if (!D.on || !D.dirty) return;
  const t = now(); if (!force && t - D.lastSave < 8000) return;
  D.lastSave = t; D.dirty = false;
  const S = store(); if (!S) return;
  try { S.setItem(KEY, D.lines.join('\n')); } catch (_) { // the storage is full: keep the newer half and try once more
    try { const h = D.lines.length >> 1; D.lines.splice(0, h); D.size = D.lines.reduce((a, l) => a + l.length + 1, 0); S.setItem(KEY, D.lines.join('\n')); } catch (__) { /* the log is optional */ }
  }
}

export const diag = {
  // env: { version, app (true in the Android shell), perf (PERF), guess () => deviceGuess(), counters () => [numbers that only grow],
  //        sim () => the level's sim (its identity tells a new level), level () => { id, ... } what to note about it,
  //        state () => 'won' | 'lost' | ... }
  init(env) {
    if (D.on) return;
    D.env = env || {}; D.on = true; D.t0 = now();
    const S = store();
    try { const old = S && S.getItem(KEY); if (old) { D.lines = old.split('\n').filter(Boolean); D.size = D.lines.reduce((a, l) => a + l.length + 1, 0); } } catch (_) { D.lines = []; D.size = 0; }
    while (D.size > MAX * 0.85 && D.lines.length > 1) D.size -= D.lines.shift().length + 1;
    push({ k: 'ses', at: new Date().toISOString(), v: D.env.version || '', app: !!D.env.app });
    const dev = { k: 'dev' };
    try {
      const nav = typeof navigator !== 'undefined' ? navigator : {}, g = D.env.guess ? D.env.guess() : null;
      dev.ua = String(nav.userAgent || '').slice(0, 220); dev.cores = +nav.hardwareConcurrency || 0; dev.mem = +nav.deviceMemory || 0;
      if (g) { dev.gpu = String(g.gpu || '').slice(0, 120); dev.tier = g.tier; }
      if (typeof window !== 'undefined') { dev.dpr = r1(window.devicePixelRatio || 1); dev.win = [window.innerWidth, window.innerHeight]; if (window.screen) dev.scr = [window.screen.width, window.screen.height]; }
      const c = nav.connection; if (c && c.saveData) dev.saveData = 1;
    } catch (_) { /* whatever it gave */ }
    const nat = native(true); if (nat) dev.nat = nat;
    push(dev);
    try { D.dev = JSON.stringify(dev); } catch (_) { D.dev = ''; } // kept aside: a long session pushes the line out of the log, the shared file still leads with it
    D.gov = govKey(); resetWin();
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { push({ k: 'vis', t: T(), h: document.hidden ? 1 : 0 }); if (document.hidden) save(true); });
    // 0.8.10: the canvas losing its graphics-chip backing is the suspected start of the level 13 collapse; the log says so now
    try {
      const cv = D.env.canvas;
      if (cv && cv.addEventListener) {
        cv.addEventListener('contextlost', () => { push({ k: 'ctx', t: T(), e: 'lost', s: D.scr }); save(true); });
        cv.addEventListener('contextrestored', () => { push({ k: 'ctx', t: T(), e: 'back', s: D.scr }); if (D.env.onRestore) { try { D.env.onRestore(); } catch (_) { /* optional */ } } });
      }
    } catch (_) { /* optional */ }
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => save(true));
      window.addEventListener('error', (e) => diag.error((e && e.message) || 'error'));
    }
    save(true);
  },
  // once per drawn frame: gap = ms since the frame before, work = ms the game spent on this one, iv = one screen
  // refresh (ms), every = refreshes per frame the cap asks for, screen = the screen's name, hz = the measured refresh rate
  frame(gap, work, iv, every, screen) {
    if (!D.on) return;
    if (screen !== D.scr) { // the screen changed: write down what was open
      const o = D.scr === 'play' ? winLine('w') : D.scr && D.span > 1500 ? winLine('scr', { s: D.scr }) : null;
      if (o) push(o);
      resetWin();
      if (D.L && screen !== 'play' && screen !== 'pause') { // the level is over (the pause page keeps it open)
        let st = ''; try { st = D.env.state ? D.env.state() : ''; } catch (_) { st = ''; }
        closeLevel(st && st !== 'play' ? st : 'left:' + screen);
      }
      D.scr = screen; save();
      return; // the first frame of a screen builds it: not the phone's pace
    }
    if (screen === 'play') { // a new level, or the same level started again
      let sim = null; try { sim = D.env.sim ? D.env.sim() : null; } catch (_) { sim = null; }
      if (sim && sim !== D.sim) {
        if (D.L) closeLevel('restart');
        let info = null; try { info = D.env.level ? D.env.level() : null; } catch (_) { info = null; }
        D.sim = sim; openLevel(info || { id: 0 });
        return;
      }
    }
    const k = iv > 0 ? gap / iv : 1, want = every || 1;
    D.n++; D.span += gap; D.js += work; if (work > D.jsx) D.jsx = work; if (gap > D.worst) D.worst = gap;
    if (k < 1.5) D.g1++; else if (k < 2.5) D.g2++; else if (k < 3.5) D.g3++; else D.g4++;
    const late = k > want + 0.5; if (late) D.late++;
    const L = D.L;
    if (L && screen === 'play') { L.n++; L.span += gap; L.js += work; if (work > L.jsx) L.jsx = work; if (gap > L.worst) L.worst = gap; if (late) L.late++; }
    if (gap > HITCH && D.hits < 400) {
      D.hits++; if (L) L.hits++;
      const o = { k: 'hit', t: T(), gap: Math.round(gap), js: r1(work), s: screen };
      if (now() - D.markT < 3000) { o.mk = D.mark; o.dm = r1((now() - D.markT) / 1000); }
      push(o);
    }
    const gk = govKey();
    if (gk !== D.gov) { const P = D.env.perf || {}; push({ k: 'gov', t: T(), from: D.gov, to: gk, why: P.why || '', s: screen }); D.gov = gk; }
    if (screen === 'play' && D.span >= WIN) { const o = winLine('w'); if (o) push(o); resetWin(); }
  },
  mark(name) { if (!D.on) return; D.mark = String(name).slice(0, 40); D.markT = now(); push({ k: 'mk', t: T(), m: D.mark }); },
  note(o) { push(Object.assign({ k: 'note', t: T() }, o)); },
  error(msg) { if (!D.on) return; D.errs = (D.errs || 0) + 1; if (D.errs <= 30) push({ k: 'err', t: T(), s: D.scr, msg: String(msg).slice(0, 200) }); },
  flush() { save(true); },
  clear() { D.lines = []; D.size = 0; D.dirty = true; push({ k: 'ses', at: new Date().toISOString(), v: (D.env && D.env.version) || '', cleared: 1 }); save(true); },
  stats() { let lv = 0; for (const l of D.lines) if (l.startsWith('{"k":"end"')) lv++; return { kb: Math.round(D.size / 1024), levels: lv, lines: D.lines.length }; },
  lines() { return D.lines.slice(); },
  text() {
    const st = diag.stats();
    return ['Eggscape speed log ' + ((D.env && D.env.version) || '') + ' / ' + new Date().toISOString(), `${st.levels} levels, ${st.lines} lines. One JSON object per line; the kinds are explained at the top of src/diag.js.`, D.dev || '{"k":"dev"}'].join('\n') + '\n' + D.lines.join('\n') + '\n';
  },
  // hands the log to the person: Android's share sheet in the app, the browser's share or a download on the web.
  // -> 'app' | 'share' | 'download' | '' (nothing worked)
  share() {
    if (D.L) { const w = winLine('w'); if (w) push(w); resetWin(); }
    save(true);
    const text = diag.text(), name = 'eggscape-log-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.txt';
    try { const b = typeof window !== 'undefined' && window.EggApp; if (b && typeof b.shareLog === 'function') { b.shareLog(name, text); return 'app'; } } catch (_) { /* fall through */ }
    try {
      if (typeof File !== 'undefined' && navigator.canShare) { const f = new File([text], name, { type: 'text/plain' }); if (navigator.canShare({ files: [f] })) { navigator.share({ files: [f], title: name }).catch(() => {}); return 'share'; } }
    } catch (_) { /* fall through */ }
    try {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); a.download = name;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      return 'download';
    } catch (_) { return ''; }
  },
  _D: D,
};
