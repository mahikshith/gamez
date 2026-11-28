// node tools/test-scroll.mjs : the scroll feel (src/scroll.js) as numbers
import { dragTo, grab, glideStep, rubber, overOf, snapPx, scrollFeel, FEEL_RATE } from '../src/scroll.js';
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const run = (S, fps, secs, lim) => { let peak = 0, steps = 0; for (let t = 0; t < secs; t += 1 / fps) { glideStep(S, 1 / fps, lim); peak = Math.max(peak, Math.abs(overOf(S))); steps++; } return peak; };
const LIM = 120;
{ const S = { y: 500, v: 0, max: 2000 }; dragTo(S, 640, LIM); ok(S.y === 640, 'inside the list the content follows the finger 1:1'); }
{ const S = { y: 0, v: 0, max: 2000 }; dragTo(S, -40, LIM); const a = -S.y; dragTo(S, -400, LIM); const b = -S.y; dragTo(S, -4000, LIM); const c = -S.y;
  ok(a > 28 && a < 40 && b > a && c > b && c < LIM, `past the top it stretches and never beyond the limit (${a.toFixed(0)}, ${b.toFixed(0)}, ${c.toFixed(0)} of ${LIM})`); }
{ const S = { y: 0, v: 0, max: 2000 }; dragTo(S, -90, LIM); const w = grab(S, LIM); ok(Math.abs(w + 90) < 0.5, 'a list caught mid-stretch carries on from the same finger offset'); }
{ const S = { y: 0, v: 0, max: 2000 }; dragTo(S, -300, LIM); run(S, 60, 1.2, LIM); ok(S.y === 0 && S.v === 0, 'released past the top it settles exactly on the top'); }
{ const S = { y: 1000, v: 3000, max: 2000 }; run(S, 60, 0.12, LIM); const y60 = S.y; const T = { y: 1000, v: 3000, max: 2000 }; run(T, 120, 0.12 + 1e-9, LIM); const U = { y: 1000, v: 3000, max: 2000 }; run(U, 30, 0.12 + 1e-9, LIM);
  ok(Math.abs(y60 - T.y) < 30 && Math.abs(y60 - U.y) < 60, `a fling travels the same at 30, 60 and 120 fps (${U.y.toFixed(0)}, ${y60.toFixed(0)}, ${T.y.toFixed(0)})`); }
{ const S = { y: 1000, v: 1500, max: 2000 }; let last = S.y, mono = true, maxStep = 0, jerk = 0, pd = null; for (let i = 0; i < 400; i++) { glideStep(S, 1 / 60, LIM); const d = S.y - last; if (d < -1e-6) mono = false; if (pd != null) jerk = Math.max(jerk, Math.abs(d - pd)); pd = d; last = S.y; maxStep = Math.max(maxStep, d); }
  ok(mono && S.y < 2000 && S.v === 0, `a fling that stops inside the list only ever slows (ends at ${S.y.toFixed(0)})`); ok(jerk < 2.2, `no frame of it jumps (largest change in step ${jerk.toFixed(2)} px)`); }
{ const S = { y: 1700, v: 5000, max: 2000 }; const peak = run(S, 60, 2, LIM); ok(peak > 8 && peak <= LIM + 0.01 && S.y === 2000 && S.v === 0, `a hard fling into the end runs ${peak.toFixed(0)} px past it and comes back to rest on it`); }
{ const S = { y: 1990, v: 300, max: 2000 }; const peak = run(S, 60, 2, LIM); ok(peak < 25 && S.y === 2000, `a gentle one barely passes the end (${peak.toFixed(1)} px)`); }
{ const S = { y: 1700, v: 5000, max: 2000 }; const peak = run(S, 60, 2, 0); ok(peak === 0 && S.y === 2000, 'Reduced motion: the plain stop, no stretch'); }
{ const S = { y: 0, v: 0, max: 0 }; dragTo(S, 200, LIM); const o = S.y; run(S, 60, 1, LIM); ok(o > 0 && o < LIM && S.y === 0, 'a list that fits the screen still gives a little and returns'); }
{ const S = { y: 100, v: 0, max: 2000, to: 700 }; run(S, 60, 1.5, LIM); ok(S.y === 700 && S.to == null, 'an asked-for trip arrives and ends'); }
{ const S = { y: 100, v: 0, max: 400, to: 9999 }; run(S, 60, 1.5, LIM); ok(S.y === 400 && S.to == null, 'a trip past the end stops on the end'); }
// 0.8.17 the scroll haptics (scrollFeel): ticks while flung, never faster than FEEL_RATE a second; a bump at the end once; a settle tick
{ const S = { y: 0, v: 6000, max: 20000 }, ev = []; let t = 0; scrollFeel(S, { step: 40, now: t }); for (let i = 0; i < 600; i++) { glideStep(S, 1 / 60, LIM); t += 1 / 60; const f = scrollFeel(S, { step: 40, now: t }); if (f) ev.push([f, t]); }
  const fl = ev.filter((e) => e[0] === 'flick'), gaps = fl.slice(1).map((e, i) => e[1] - fl[i][1]);
  ok(fl.length >= 8 && Math.min(...gaps) >= 1 / FEEL_RATE - 1e-6, `a long fling ticks as it passes items (${fl.length} ticks, never closer than ${(Math.min(...gaps) * 1000).toFixed(0)} ms)`);
  ok(!ev.some((e) => e[0] === 'edge'), 'a fling that stops inside the list never bumps'); }
{ const S = { y: 1500, v: 5000, max: 2000 }, ev = []; let t = 0; scrollFeel(S, { step: 100, now: t }); for (let i = 0; i < 180; i++) { glideStep(S, 1 / 60, LIM); t += 1 / 60; const f = scrollFeel(S, { step: 100, now: t }); if (f) ev.push(f); }
  ok(ev.filter((e) => e === 'edge').length === 1, `a fling into the end bumps once (${ev.join(',')})`); }
{ const S = { y: 1500, v: 5000, max: 2000 }, ev = []; let t = 0; scrollFeel(S, { step: 100, now: t, calm: true }); for (let i = 0; i < 180; i++) { glideStep(S, 1 / 60, 0); t += 1 / 60; const f = scrollFeel(S, { step: 100, now: t, calm: true }); if (f) ev.push(f); }
  ok(ev.length === 1 && ev[0] === 'edge', `Calm: no running ticks, the end still bumps once (${ev.join(',')})`); }
{ const S = { y: 0, v: 0, max: 800 }, ev = []; scrollFeel(S, { step: 200, now: 0, snap: true }); S.to = 400; let t = 0; for (let i = 0; i < 120; i++) { glideStep(S, 1 / 60, LIM); t += 1 / 60; const f = scrollFeel(S, { step: 200, now: t, snap: true }); if (f) ev.push(f); }
  ok(ev.filter((e) => e === 'settle').length === 1 && ev[ev.length - 1] === 'settle', `a snapping list that lands on a new item ticks once as it settles (${ev.join(',')})`); }
{ const S = { y: 300, v: 0, max: 800 }, ev = []; scrollFeel(S, { step: 100, now: 0 }); for (let i = 1; i < 60; i++) { dragTo(S, 300 + i * 3, LIM); const f = scrollFeel(S, { step: 100, now: i / 60, held: true }); if (f) ev.push(f); }
  ok(!ev.length, 'a finger dragging a plain list inside it: no ticks'); }
ok(snapPx(10.37, 2.75) * 2.75 % 1 < 1e-9 || Math.abs(Math.round(snapPx(10.37, 2.75) * 2.75) - snapPx(10.37, 2.75) * 2.75) < 1e-9, 'draw offsets land on whole device pixels');
ok(rubber(0, LIM) === 0, 'no pull, no stretch');
console.log(fails ? `\n${fails} FAILED` : '\nall scroll checks pass'); process.exit(fails ? 1 : 0);
