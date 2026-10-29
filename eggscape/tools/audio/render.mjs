#!/usr/bin/env node
// Renders every Eggscape SFX / loop / music theme through an OfflineAudioContext in headless
// Chromium (Playwright), writes WAVs to tools/audio/out/ and prints an analysis table.
//
//   node tools/audio/render.mjs            render + analyse everything
//   node tools/audio/render.mjs --quick    SFX + loops only (skip music and long tests)
//   node tools/audio/render.mjs --serve    just serve the repo for preview.html (http://127.0.0.1:8123/tools/audio/preview.html)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { DEMO_SPECS } from './demo-specs.js';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const OUT = path.join(HERE, 'out');
const args = new Set(process.argv.slice(2));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.wav': 'audio/wav', '.css': 'text/css' };
function serve(port = 0) {
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (u === '/__harness') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<!doctype html><meta charset="utf-8"><button id="unlock">unlock</button><script type="module" src="/tools/audio/render-page.js"></script>');
      return;
    }
    const f = path.join(ROOT, path.normalize(u).replace(/^([/\\])+/, ''));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => srv.listen(port, '127.0.0.1', () => r(srv)));
}

if (args.has('--serve')) {
  const srv = await serve(8123);
  console.log('Preview: http://127.0.0.1:' + srv.address().port + '/tools/audio/preview.html');
  await new Promise(() => {});
}

// ------------------------------------------------------------------ analysis
const db = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}
function analyse(inter, sr) {
  const n = inter.length / 2;
  let nan = 0, peak = 0, first = -1, last = -1;
  const thr = Math.pow(10, -60 / 20);
  for (let i = 0; i < n; i++) {
    const l = inter[2 * i], r = inter[2 * i + 1];
    if (!Number.isFinite(l) || !Number.isFinite(r)) { nan++; continue; }
    const a = Math.max(Math.abs(l), Math.abs(r));
    if (a > peak) peak = a;
    if (a > thr) { if (first < 0) first = i; last = i; }
  }
  let sum = 0, cnt = 0;
  if (first >= 0) for (let i = first; i <= last; i++) { sum += inter[2 * i] ** 2 + inter[2 * i + 1] ** 2; cnt += 2; }
  const rms = cnt ? Math.sqrt(sum / cnt) : 0;
  // energy-weighted spectral centroid (mono, 2048 Hann, hop 1024)
  const N = 2048, win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
  let cw = 0, ew = 0;
  if (first >= 0) {
    for (let s = first; s < last; s += 1024) {
      const re = new Float64Array(N), im = new Float64Array(N);
      for (let i = 0; i < N && s + i < n; i++) re[i] = (inter[2 * (s + i)] + inter[2 * (s + i) + 1]) * 0.5 * win[i];
      fft(re, im);
      let num = 0, den = 0, en = 0;
      for (let k = 1; k < N / 2; k++) { const m = Math.hypot(re[k], im[k]); num += m * (k * sr / N); den += m; en += m * m; }
      if (den > 0) { cw += (num / den) * en; ew += en; }
    }
  }
  return { nan, peakDb: db(peak), rmsDb: db(rms), dur: last >= 0 ? (last + 1) / sr : 0, start: first >= 0 ? first / sr : 0, centroid: ew ? cw / ew : 0, lastIdx: last };
}
function windowRms(inter, sr, sec) {
  const n = inter.length / 2, w = Math.floor(sr * sec), out = [];
  for (let s = 0; s + w <= n; s += w) {
    let sum = 0; for (let i = s; i < s + w; i++) sum += inter[2 * i] ** 2 + inter[2 * i + 1] ** 2;
    out.push(db(Math.sqrt(sum / (2 * w))));
  }
  return out;
}
function writeWav(file, inter, sr, frames) {
  const ch = 2, bytes = frames * ch * 2, b = Buffer.alloc(44 + bytes);
  b.write('RIFF', 0); b.writeUInt32LE(36 + bytes, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(ch, 22); b.writeUInt32LE(sr, 24);
  b.writeUInt32LE(sr * ch * 2, 28); b.writeUInt16LE(ch * 2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(bytes, 40);
  for (let i = 0; i < frames * ch; i++) {
    const v = Math.max(-1, Math.min(1, Number.isFinite(inter[i]) ? inter[i] : 0));
    b.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  fs.writeFileSync(file, b);
}

// ------------------------------------------------------------------ cases
const MAXDUR = { squish: 0.25, thunder: 4.5, level_win: 3.2, bomb_fuse: 2.8, bomb_explode: 2.8, level_fail: 2.6, unlock: 2.6, egg_save: 2.2, combo: 2.2, star: 2.2 };
const SFX_NAMES = (await import(path.join(ROOT, 'src/audio.js'))).SFX_NAMES;
const MATS = (await import(path.join(ROOT, 'src/audio.js'))).MATERIALS;
const cases = [];
for (const name of SFX_NAMES) cases.push({ kind: 'sfx', id: name, name, opts: {} });
cases.push(
  { kind: 'sfx', id: 'egg_bump@i0.15', name: 'egg_bump', opts: { intensity: 0.15 } },
  { kind: 'sfx', id: 'egg_bump@i1', name: 'egg_bump', opts: { intensity: 1 } },
  { kind: 'sfx', id: 'egg_bump@glass', name: 'egg_bump', opts: { intensity: 0.8 }, material: 'glass' },
  { kind: 'sfx', id: 'egg_bump@metal', name: 'egg_bump', opts: { intensity: 0.8 }, material: 'metal' },
  { kind: 'sfx', id: 'egg_bump@mushroom', name: 'egg_bump', opts: { intensity: 0.8 }, material: 'mushroom' },
  { kind: 'sfx', id: 'egg_bump@stone', name: 'egg_bump', opts: { intensity: 0.8 }, material: 'stone' },
  { kind: 'sfx', id: 'egg_save@x4', name: 'egg_save', opts: { pitch: 1.5 } },
  { kind: 'sfx', id: 'combo@x4', name: 'combo', opts: { intensity: 1 } },
  { kind: 'sfx', id: 'star@2', name: 'star', opts: { intensity: 0.5 } },
  { kind: 'sfx', id: 'star@3', name: 'star', opts: { intensity: 1 } },
  { kind: 'sfx', id: 'countdown@go', name: 'countdown', opts: { intensity: 1 } },
  { kind: 'sfx', id: 'steel_clang@i1', name: 'steel_clang', opts: { intensity: 1 } },
  { kind: 'sfx', id: 'bomb_fuse@stop1s', name: 'bomb_fuse', opts: {}, stopAt: 1.0 },
  { kind: 'sfx', id: 'egg_break@vol2', name: 'egg_break', opts: { vol: 2 } },
  { kind: 'sfx', id: 'squish@i0.2', name: 'squish', opts: { intensity: 0.2 } },
  { kind: 'sfx', id: 'squish@i1', name: 'squish', opts: { intensity: 1 } },
);
for (const m of MATS) cases.push({ kind: 'ring', id: 'ring_' + m, material: m, speed: 0.8, dur: 2.5, loop: true });
cases.push({ kind: 'ring', id: 'ring_wood@0.2', material: 'wood', speed: 0.2, dur: 2.5, loop: true });
cases.push({ kind: 'fire', id: 'loop_fire', dur: 3, loop: true }, { kind: 'wind', id: 'loop_wind', level: 0.8, dur: 3, loop: true }, { kind: 'underwater', id: 'loop_underwater', dur: 3, loop: true });
const quick = args.has('--quick');
if (!quick) {
  for (const d of DEMO_SPECS) cases.push({ kind: 'music', id: 'music_' + d.label.toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, ''), spec: d.spec, dur: 40, loop: true, music: true });
  cases.push({ kind: 'music', id: 'music_xfade_farm_to_volcano', spec: DEMO_SPECS[1].spec, next: { at: 8, spec: DEMO_SPECS[8].spec }, dur: 14, loop: true, music: true });
  cases.push({ kind: 'music', id: 'music_long_farm_10min', spec: DEMO_SPECS[1].spec, dur: 600, sr: 22050, loop: true, music: true, long: true });
  const pool = [...SFX_NAMES, 'egg_bump', 'egg_break', 'bomb_explode', 'glass_break'];
  const names = []; for (let i = 0; i < 40; i++) names.push(pool[(i * 7) % pool.length]);
  cases.push({ kind: 'stress', id: 'stress_40_sounds+loops+music', names, spec: DEMO_SPECS[8].spec, dur: 4, loop: true });
}

// ------------------------------------------------------------------ run
fs.mkdirSync(OUT, { recursive: true });
const { chromium } = require('playwright');
const srv = await serve(0);
const base = 'http://127.0.0.1:' + srv.address().port;
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('[page error]', e.message));
await page.goto(base + '/__harness');
await page.waitForFunction(() => window.ready === true);

const rows = [];
let fails = 0;
for (const c of cases) {
  const res = await page.evaluate((cc) => window.renderCase(cc), c);
  const inter = new Float32Array(Buffer.from(res.b64, 'base64').buffer.slice(0));
  const a = analyse(inter, res.sr);
  let raw = null;
  if (!c.music && c.kind !== 'stress') {
    const r2 = await page.evaluate((cc) => window.renderCase({ ...cc, limiter: false }), c);
    raw = analyse(new Float32Array(Buffer.from(r2.b64, 'base64').buffer.slice(0)), r2.sr);
  }
  const frames = c.loop ? inter.length / 2 : Math.min(inter.length / 2, a.lastIdx + 1 + Math.floor(res.sr * 0.05));
  if (!c.long) writeWav(path.join(OUT, c.id.replace(/[@+]/g, '_') + '.wav'), inter, res.sr, Math.max(frames, 1));
  const issues = [];
  if (a.nan) issues.push(a.nan + ' NaN');
  if (a.peakDb > -1) issues.push('peak>-1dB');
  if (!(a.peakDb > -45) || a.dur === 0) issues.push('silent');
  if (c.kind === 'sfx') {
    const lim = MAXDUR[c.name] || 1.8;
    if (a.dur > lim) issues.push('too long (>' + lim + 's)');
    if (c.stopAt && a.dur > c.stopAt + 0.15) issues.push('stop() failed');
  }
  if (c.music) {
    const w = windowRms(inter, res.sr, c.long ? 30 : 5);
    const tail = w.slice(1);
    if (tail.some((x) => x < -55)) issues.push('dropout in window ' + tail.findIndex((x) => x < -55));
    a.windows = w;
    a.rtFactor = (c.dur * 1000) / res.ms;
  }
  if (c.kind === 'stress' && res.stats && res.stats.voices > 24) issues.push('voices ' + res.stats.voices + '>24');
  if (issues.length) fails++;
  rows.push({ c, a, raw, issues, stats: res.stats, ms: res.ms });
  process.stdout.write('.');
}
process.stdout.write('\n');

// timbre sanity: expected spectral centroid ranges (Hz)
const TIMBRE = {
  egg_crack: [2500, 12000], glass_crack: [3000, 12000], glass_break: [2500, 12000], thorn_hit: [2000, 12000], score_tick: [1500, 6000],
  bomb_explode: [0, 900], thunder: [0, 700], rock_hit: [0, 1800], bomb_fuse: [3000, 12000], lava_sizzle: [2000, 12000],
  egg_bump: [150, 2500], squish: [80, 1200], splash: [600, 4000], fire_burn: [800, 6000],
};
for (const r of rows) {
  const t = r.c.kind === 'sfx' && (r.c.id === r.c.name || r.c.name === 'squish') && TIMBRE[r.c.name];
  if (t && (r.a.centroid < t[0] || r.a.centroid > t[1])) { r.issues.push('centroid out of ' + t.join('-')); fails++; }
}

const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '-inf');
console.log('\n' + pad('sound', 34) + lpad('dur s', 7) + lpad('peak dB', 9) + lpad('raw pk', 8) + lpad('RMS dB', 8) + lpad('centroid', 10) + '  status');
console.log('-'.repeat(90));
for (const r of rows) {
  const { a } = r;
  console.log(pad(r.c.id, 34) + lpad(a.dur.toFixed(2), 7) + lpad(f1(a.peakDb), 9) + lpad(r.raw ? f1(r.raw.peakDb) : '', 8) + lpad(f1(a.rmsDb), 8) + lpad(Math.round(a.centroid) + ' Hz', 10) + '  ' + (r.issues.length ? 'FAIL: ' + r.issues.join(', ') : 'ok'));
}
const mus = rows.filter((r) => r.c.music);
if (mus.length) {
  console.log('\nMusic: RMS per window (dB) and offline render speed (x real-time, higher = cheaper)');
  for (const r of mus) console.log(pad(r.c.id, 34) + lpad(r.a.rtFactor.toFixed(0) + 'x', 7) + '  ' + r.a.windows.map((x) => x.toFixed(0)).join(' '));
}
const st = rows.find((r) => r.c.kind === 'stress');
if (st) console.log('\nStress: active voices after 40 plays =', st.stats && st.stats.voices, '| loops', st.stats && st.stats.loops.join(','));

// real AudioContext API checks
await page.evaluate(() => window.apiPre());
await page.click('#unlock');
const api = await page.evaluate(() => window.apiPost()).catch((e) => ({ errors: ['apiTests threw: ' + e.message], notes: {} }));
console.log('\nAPI checks (real AudioContext):', JSON.stringify(api.notes));
if (api.errors.length) { console.log('API ERRORS:', api.errors); fails++; } else console.log('API: no exceptions');

await browser.close();
srv.close();
console.log('\nWAVs in', OUT);
console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
