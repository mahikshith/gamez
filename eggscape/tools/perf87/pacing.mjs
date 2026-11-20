// Frame pacing model of main.js frame(now) + the fixed-step in update(): node tools/perf87/pacing.mjs [new]
// A display at H Hz fires rAF at each vsync while the main thread is free; a drawn frame keeps the thread busy for
// work x refresh. Callback timestamps get +-jit ms of noise. Reports drawn fps, the gap pattern, steps per drawn frame,
// and the judder: how far the world time shown drifts from even spacing (ms, p95).
const NEW = process.argv.includes('new');
const DT = 1 / 120;
function run(H, cap, workF, jit, secs = 20, seed = 1) {
  let r = seed; const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const iv0 = 1000 / H;
  const VS = { last: 0, buf: [], iv: 1000 / 60 }, P = { last: 0, acc: 0, err: 0 };
  let busyUntil = 0, drawn = 0, steps = {}, gaps = {}, world = 0, wall0 = null, dev = [], dts = [];
  for (let k = 1; k < secs * H; k++) {
    const vs = k * iv0; if (vs < busyUntil) continue;
    const now = vs + (rnd() - 0.5) * 2 * jit;
    // --- frame(now) head
    if (VS.last) { const d = now - VS.last; if (d > 4 && d < 45) { VS.buf.push(d); if (VS.buf.length >= 31) { VS.buf.sort((a, b) => a - b); VS.iv = VS.buf[15]; VS.buf.length = 0; if (NEW && (!VS.ivs || Math.abs(VS.ivs - VS.iv) > VS.iv * 0.2)) VS.ivs = VS.iv; } if (NEW && VS.ivs && Math.abs(d - VS.ivs) < VS.ivs * 0.25) VS.ivs += (d - VS.ivs) * 0.05; } }
    VS.last = now;
    const every = Math.max(1, Math.floor((1000 / cap) / VS.iv + 0.1));
    let dt;
    if (!NEW) {
      if (now - P.last < every * VS.iv - VS.iv * 0.5) continue;
      const raw = P.last ? now - P.last : 16; dt = Math.min(0.1, raw / 1000 || 0.016); P.last = now;
    } else {
      if (P.last && now - P.last < every * VS.iv - VS.iv * 0.5) continue;
      const raw = P.last ? now - P.last : 16; P.last = now;
      // snap to whole refreshes of a slowly-averaged refresh interval; the rounding error is fed back a little each frame
      const iv = VS.ivs, n = iv ? Math.max(1, Math.round(raw / iv)) : 0;
      let s = raw;
      if (n && Math.abs(raw - n * iv) < iv * 0.3) {
        s = n * iv; P.err += raw - s;
        const c = Math.abs(P.err) > iv * 0.5 ? P.err : P.err * 0.1; s += c; P.err -= c;
      } else { s = raw + P.err; P.err = 0; }
      dt = Math.min(0.1, s / 1000);
    }
    // --- update fixed step
    P.acc += dt; let n = 0;
    if (!NEW) while (P.acc >= DT && n < 24) { P.acc -= DT; n++; world += DT * 1000; }
    else { P.acc = Math.min(P.acc, 0.1); while (P.acc >= DT * 0.75 && n < 8) { P.acc -= DT; n++; world += DT * 1000; } }
    if (NEW) { /* nothing else */ }
    dts.push(dt * 1000);
    steps[n] = (steps[n] || 0) + 1;
    const g = Math.round(dt * 1000 / iv0); gaps[g] = (gaps[g] || 0) + 1;
    drawn++;
    // shown time = vsync of presentation; judder = world - (vs - wall0) deviation around its mean
    if (wall0 === null) wall0 = vs - world;
    dev.push(world - (vs - wall0));
    const w = workF * iv0 * (0.85 + 0.3 * rnd());
    busyUntil = vs + w;
  }
  const m = dev.reduce((a, b) => a + b, 0) / dev.length; const ad = dev.map((d) => Math.abs(d - m)).sort((a, b) => a - b);
  const dm = dts.reduce((a, b) => a + b, 0) / dts.length, dsd = Math.sqrt(dts.reduce((a, b) => a + (b - dm) ** 2, 0) / dts.length);
  return { fps: (drawn / secs).toFixed(1), gaps: JSON.stringify(gaps), steps: JSON.stringify(steps), judderP95: ad[Math.floor(ad.length * 0.95)].toFixed(2), dtSD: dsd.toFixed(2) };
}
console.log(NEW ? 'NEW pacing' : 'CURRENT pacing');
for (const H of [60, 90, 120, 144]) for (const cap of [60, 30]) for (const [wf, jit] of [[0.3, 0], [0.3, 1.5], [0.9, 1], [1.2, 1], [1.5, 1]]) {
  const o = run(H, cap, wf, jit);
  console.log(`${H}Hz cap${cap} work${wf}x jit${jit}ms: ${o.fps} fps gaps(refreshes)=${o.gaps} steps/frame=${o.steps} dtSD=${o.dtSD}ms judder95=${o.judderP95}ms`);
}
