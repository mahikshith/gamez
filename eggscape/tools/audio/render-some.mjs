#!/usr/bin/env node
// Renders chosen sounds / tunes to WAV (and MP3 when ffmpeg is there), for listening on a phone.
//   node tools/audio/render-some.mjs <outDir> tune:strut tune:caper sfx:weasel_snicker sfx:weasel_chitter world:farm
// tune:<id>[:seconds] a composed theme (src/audio.js TUNES); sfx:<name>[:pitch]; mood:<mood>:<root>:<scale>:<bpm>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [OUT, ...what] = process.argv.slice(2);
if (!OUT || !what.length) { console.error('usage: render-some.mjs <outDir> tune:strut sfx:crow ...'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (u === '/__harness') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><meta charset="utf-8"><script type="module" src="/tools/audio/render-page.js"></script>'); return; }
  const f = path.join(ROOT, path.normalize(u).replace(/^([/\\])+/, ''));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
function writeWav(file, inter, sr) {
  const n = inter.length, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, inter[i] || 0)) * 32767), 44 + i * 2);
  fs.writeFileSync(file, b);
}
const { chromium } = require('playwright');
const browser = await chromium.launch(), page = await browser.newPage();
page.on('pageerror', (e) => console.error('[page error]', e.message));
await page.goto('http://127.0.0.1:' + srv.address().port + '/__harness');
await page.waitForFunction(() => window.ready === true);
for (const w of what) {
  const [kind, a, b, c, d] = w.split(':');
  let cs;
  if (kind === 'tune') cs = { kind: 'music', id: 'tune_' + a, spec: { tune: a }, dur: +b || 34, loop: true, music: true };
  else if (kind === 'sfx') cs = { kind: 'sfx', id: 'sfx_' + a + (b ? '_p' + b : ''), name: a, opts: b ? { pitch: +b } : {}, dur: 2.5 };
  else if (kind === 'mood') cs = { kind: 'music', id: 'mood_' + a, spec: { mood: a, root: b || 'C', scale: c || 'major', bpm: +d || 112 }, dur: 30, loop: true, music: true, intro: true };
  else { console.error('unknown', w); continue; }
  const res = await page.evaluate((cc) => window.renderCase(cc), cs);
  const inter = new Float32Array(Buffer.from(res.b64, 'base64').buffer.slice(0));
  let peak = 0, sum = 0, last = 0; for (let i = 0; i < inter.length; i++) { const x = Math.abs(inter[i]); if (x > peak) peak = x; sum += x * x; if (x > 0.003) last = i; }
  const cut = cs.music ? inter : inter.subarray(0, Math.min(inter.length, (last + 4410) & ~1));
  const wav = path.join(OUT, cs.id + '.wav'); writeWav(wav, cut, res.sr);
  try { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-b:a', '128k', path.join(OUT, cs.id + '.mp3')]); } catch (e) {}
  console.log(cs.id.padEnd(26), 'peak', (20 * Math.log10(peak || 1e-9)).toFixed(1), 'dB  rms', (10 * Math.log10(sum / inter.length || 1e-12)).toFixed(1), 'dB  len', (cut.length / 2 / res.sr).toFixed(2), 's  render', Math.round(res.ms), 'ms');
}
await browser.close(); srv.close();
