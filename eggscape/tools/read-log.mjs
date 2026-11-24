// Files what a shared speed log says about how its player played: node tools/read-log.mjs <log.txt> [more logs]
// Out of each log come only counts (the Tally: src/engine/tally.js): a row per level (tries, wins, seconds, one egg
// short, Rewinds, boosters), every tracked button shown against taken, seconds per screen, where sessions ended.
// They go into players/real.json, one entry per phone (a newer log of the same phone replaces the older: the counts
// are running totals), and the sum over all phones is what tools/sim-players.mjs reads instead of its guesses.
// Nothing else from the log is kept, and the log itself is not copied anywhere.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HOME = join(dirname(fileURLToPath(import.meta.url)), '..', 'players'), FILE = join(HOME, 'real.json');
const int = (v) => Math.max(0, Math.floor(Number(v) || 0));

export function parseLog(text) {
  let note = null, version = '';
  const head = /Eggscape speed log (\S+)/.exec(text); if (head) version = head[1];
  for (const line of String(text).split('\n')) {
    if (line[0] !== '{' || line.indexOf('"note"') < 0 || (line.indexOf('"tal"') < 0 && line.indexOf('"tries"') < 0)) continue;
    let o; try { o = JSON.parse(line); } catch (_) { continue; }
    if (o && o.k === 'note' && (o.tal || o.tries)) note = o; // the last one in the file is the newest
  }
  if (!note) return null;
  const T = note.tal || {}, lv = {};
  for (const [id, r] of Object.entries(T.lv || {})) if (int(id) > 0 && Array.isArray(r)) lv[int(id)] = [0, 1, 2, 3, 4, 5].map((i) => int(r[i]));
  // a log from before the Tally still has tries and wins per level as text: "7:4/1 8:2/1"
  if (!Object.keys(lv).length && typeof note.tries === 'string') for (const m of note.tries.matchAll(/(\d+):(\d+)\/(\d+)/g)) lv[int(m[1])] = [int(m[2]), int(m[3]), 0, 0, 0, 0];
  const b = {}; for (const [k, c] of Object.entries(T.b || {})) if (Array.isArray(c)) b[String(k).slice(0, 28)] = [int(c[0]), int(c[1])];
  const sc = {}; for (const [k, v] of Object.entries(T.sc || {})) sc[String(k).slice(0, 28)] = int(v);
  const ends = {}; for (const e of Array.isArray(T.end) ? T.end : []) if (e && e.sc) ends[String(e.sc).slice(0, 28)] = (ends[String(e.sc).slice(0, 28)] || 0) + 1;
  return { phone: String(int(note.first) || 'unknown-' + version), version, mode: String(note.mode || ''), lv, b, sc, ends, shop: { n: int(T.shop && T.shop.n), first: int(T.shop && T.shop.first) } };
}
export function merge(real, one, day) {
  const R = real && typeof real === 'object' ? real : {}; R.phones = R.phones || {};
  R.phones[one.phone] = { day, version: one.version, mode: one.mode, lv: one.lv, b: one.b, sc: one.sc, ends: one.ends, shop: one.shop };
  const levels = {}, buttons = {}, screens = {}, ends = {}; let shopFirst = [];
  for (const P of Object.values(R.phones)) {
    for (const [id, r] of Object.entries(P.lv || {})) { const L = (levels[id] = levels[id] || [0, 0, 0, 0, 0, 0]); r.forEach((v, i) => { L[i] += int(v); }); }
    for (const [k, c] of Object.entries(P.b || {})) { const B = (buttons[k] = buttons[k] || [0, 0]); B[0] += int(c[0]); B[1] += int(c[1]); }
    for (const [k, v] of Object.entries(P.sc || {})) screens[k] = (screens[k] || 0) + int(v);
    for (const [k, v] of Object.entries(P.ends || {})) ends[k] = (ends[k] || 0) + int(v);
    if (P.shop && P.shop.first) shopFirst.push(P.shop.first);
  }
  R.about = 'Counts from shared speed logs (tools/read-log.mjs). levels: id -> [tries, wins, seconds, one egg short, Rewinds, boosters]. buttons: name -> [shown, taken]. The simulator uses a level here once it has 8 tries.';
  R.logs = Object.keys(R.phones).length; R.levels = levels; R.buttons = buttons; R.screens = screens; R.ends = ends; R.shopFirst = shopFirst.sort((a, b) => a - b);
  return R;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (isMain) {
  const files = process.argv.slice(2);
  if (!files.length) { console.log('node tools/read-log.mjs <speed log> [more]'); process.exit(1); }
  let R = {}; try { R = JSON.parse(readFileSync(FILE, 'utf8')); } catch (_) { /* first log */ }
  let ok = 0;
  for (const f of files) {
    const one = parseLog(readFileSync(f, 'utf8'));
    if (!one) { console.log(`${f}: no play record in it (a log from before 0.8.15, or Share was not tapped)`); continue; }
    R = merge(R, one, new Date().toISOString().slice(0, 10)); ok++;
    const tries = Object.values(one.lv).reduce((a, r) => a + r[0], 0);
    console.log(`${f}: phone ${one.phone}, ${Object.keys(one.lv).length} levels, ${tries} tries, ${Object.keys(one.b).length} buttons`);
  }
  if (ok) { if (!existsSync(HOME)) mkdirSync(HOME, { recursive: true }); writeFileSync(FILE, JSON.stringify(R, null, 1) + '\n'); const n = Object.values(R.levels).filter((r) => r[0] >= 8).length; console.log(`players/real.json: ${R.logs} phone(s); ${n} levels now have enough tries for the simulator to use`); }
  process.exit(ok ? 0 : 1);
}
