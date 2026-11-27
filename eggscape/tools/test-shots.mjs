// The camera director's rules (src/engine/shots.js): pure, no canvas. node tools/test-shots.mjs
import assert from 'node:assert/strict';
import { SHOTS, newShots, direct, fit, outside, hit, boxesOf } from '../src/engine/shots.js';
const view = { w: 450, h: 800 }, base = { x: 0, y: 0, k: 60 }, eggs = [{ x: 0, y: -1 }];
const O = (o = {}) => ({ dt: 1 / 60, live: 10, wholeK: 50, calm: false, low: false, userAge: 99, demo: 1, frozen: false, ...o });
const run = (S, cast, o, n, b = base) => { let D = null; for (let i = 0; i < n; i++) D = direct(S, b, cast, eggs, view, O(o)); return D; };
const inFrame = (a, D) => outside(a, D, view) < 1e-6;
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

// nothing acting: the base frame stands
ok(direct(newShots(), base, [], eggs, view, O()) === null, 'no cast, no direction');
ok(direct(newShots(), base, [{ key: 'a', x: 9, y: 0, r: 0.4, act: 'idle' }], eggs, view, O({ live: 0.2 })) === null, 'an idle villain far away does not move the camera');
// fit holds every box with the least change
{ const T = fit(base, boxesOf({ x: 5, y: 0, r: 0.5 }), view); ok(T.k === 60 && T.x > 0 && outside({ x: 5, y: 0, r: 0.5 }, T, view) === 0, 'fit slides'); }
{ const T = fit(base, [...boxesOf({ x: 6, y: 0, r: 0.5 }), ...boxesOf({ x: -6, y: 0, r: 0.5 })], view); ok(T.k < 60 && Math.abs(T.x) < 1e-9, 'fit widens for two sides'); }
// a striking villain off to the side is held in frame with its target and the eggs, after the entrance is over
{ const S = newShots(), a = { key: 'v', x: 5.5, y: 1, r: 0.5, act: 'strike', tx: 0, ty: -1 };
  const D = run(S, [a], { live: 0.2 }, 1); ok(D && inFrame(a, D) && inFrame({ x: 0, y: -1, r: 0.3 }, D), 'acting villain and egg are in the frame'); }
// two villains: both
{ const S = newShots(), a = { key: 'a', x: 5.5, y: 0, r: 0.5, act: 'strike' }, b = { key: 'b', x: -5.5, y: 2, r: 0.5, act: 'tell' };
  const D = run(S, [a, b], { live: 0.2 }, 1); ok(inFrame(a, D) && inFrame(b, D) && D.k >= 50 * SHOTS.minK, 'two villains are both in the frame'); }
// the entrance: toward it and back, eased (no jump between frames), once
{ const S = newShots(), a = { key: 'v', x: 4, y: 0, r: 0.5, act: 'enter' };
  const D0 = direct(S, base, [a], eggs, view, O()); let far = D0.x, prev = D0, jump = 0, last = D0;
  for (let i = 0; i < 200; i++) { const D = direct(S, base, [a], eggs, view, O()); if (!D) break; far = Math.max(far, D.x); jump = Math.max(jump, Math.abs(D.x - prev.x)); prev = D; last = D; ok(inFrame(a, D), 'the entrant stays in frame'); }
  ok(far > D0.x + 0.5, 'the establishing move goes toward the entrant'); ok(jump < 0.12, 'and never jumps'); ok(S.est === null && Math.abs(last.x - D0.x) < 0.05, 'and comes back');
  a.act = 'idle'; run(S, [a], {}, 200); a.act = 'strike'; run(S, [a], {}, 1); ok(S.est === null, 'no second entrance for the same villain'); }
// it lingers after the last act, then lets go
{ const S = newShots(), a = { key: 'v', x: 6, y: 0, r: 0.5, act: 'strike' }; run(S, [a], { live: 0.2 }, 2); a.act = 'idle';
  ok(run(S, [a], {}, 30) !== null, 'the frame lingers'); ok(run(S, [a], {}, 120) === null, 'then the base frame is back'); }
// the player's own zoom wins for a few seconds
{ const S = newShots(), a = { key: 'v', x: 6, y: 0, r: 0.5, act: 'strike' };
  ok(direct(S, base, [a], eggs, view, O({ userAge: 1 })) === null, 'the player zoomed a second ago: hands off'); ok(direct(S, base, [a], eggs, view, O({ userAge: SHOTS.user + 0.1 })) !== null, 'later the villain is framed again'); }
// a hit: the shot goes to the villains it landed on and returns; calm: no push in
{ const S = newShots(), v = [{ key: 'a', x: 3, y: 2, r: 0.5, act: 'idle' }, { key: 'b', x: 4, y: 1, r: 0.5, act: 'idle' }]; run(S, v, { live: 0.2 }, 1);
  ok(hit(S, v) && !hit(S, []), 'a hit needs somebody'); const D = run(S, v, {}, 30); ok(D.k > base.k && inFrame(v[0], D) && inFrame(v[1], D) && D.smooth < SHOTS.smooth, 'the hit pushes in on them, quickly');
  ok(run(S, v, {}, 200) === null, 'and returns');
  hit(S, v); const C = run(S, v, { calm: true }, 30); ok(C.k <= base.k + 1e-9, 'calm: no push'); }
// calm: no establishing move, slower; low: no zoom in the entrance; frozen: stands still
{ const S = newShots(), a = { key: 'v', x: 4, y: 0, r: 0.5, act: 'enter' }; const D = run(S, [a], { calm: true }, 20); ok(S.est === null && D.smooth > SHOTS.smooth, 'calm: containment only, slower'); }
{ const S = newShots(), a = { key: 'v', x: 2, y: 0, r: 0.5, act: 'enter' }; const D = run(S, [a], { low: true }, 40); ok(D.k <= base.k + 1e-9, 'low: pans only'); }
{ const S = newShots(), a = { key: 'v', x: 6, y: 0, r: 0.5, act: 'strike' }; const D = run(S, [a], { live: 0.2 }, 3); a.x = -6; const Z = direct(S, base, [a], eggs, view, O({ frozen: true })); ok(Z === D, 'frozen: the shot stands'); }
// the pinch lesson's demo zoom
{ const D = direct(newShots(), base, [], eggs, view, O({ demo: 1.2 })); ok(D && Math.abs(D.k - 72) < 1e-9, 'demo zoom'); }
// late: an acting body outside the camera right now gets a quicker move
{ const S = newShots(), a = { key: 'v', x: 9, y: 0, r: 0.5, act: 'strike' }; const D = direct(S, base, [a], eggs, view, O({ live: 0.2, cam: base })); ok(D.smooth <= SHOTS.smoothLate, 'late: quicker'); }
console.log(`test-shots: ${n} checks ok`);
