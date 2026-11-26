// The level card's actors (2026-11-20, mykee: "the snake was not even animated... you could pick the animation from the
// level itself: the frozen look, the snake crawling"). On the how-to stage (howto.js) these villains are no longer a
// portrait sliding along the ring: each is drawn by its OWN game rig doing what it does in a vault. The snake slithers
// up under a gap and lunges at it, the weasel prowls in, crouches and pounces, the rats roll the egg away, the crawlers
// walk the ring. Frozen, zapped, dizzy and scared are the rigs' own looks (the ice shell and the stars of play).
//
//   ACTORS[kind] = { stage(m) -> the stage's set-up for this villain (where the gap starts, which way the ring turns,
//                               where the hand drags, how the egg moves), draw(ctx, S) -> what the stage needs back }
//   S: { x, y, w, h, cx, C, floor, band, k (px per metre), at(phi, lift), T (s into the loop), t (art clock), m (move),
//        g0 (the gap's first angle), th (ring turn so far), fx (the power's effect), eggS, egg {x, y}, ground (y) }
//   draw returns { threat (the egg looks worried), bonk 0..1 with x, y (the stage writes BONK! there) }
// Timings match howto.js: 'turn' = walk in 0.2-1.3, ring turns 1.45-2.25, the hit at 1.85;
// 'tap' / 'rooster' = walk in 0.2-1.3, the power lands at 2.15, ring turns 2.75-3.3.
import { drawSnake } from './snake.js';
import { drawThief, thiefPose } from './thieves.js';
import { RIG } from '../sim/thieves.js';
import { drawCrawler } from './crawlers.js';
import { drawSalamander } from './salamander.js';
import { drawGator } from './bayou.js';
import { GATOR } from '../sim/bayou.js';
import { pipActor } from './pip.js'; // 0.8.17 pip
import { urchinActor } from './urchinplay.js'; // 0.8.17 urchin
import { cocoActor } from './coco.js'; // 0.8.17 coco
import { drawBanditPerch } from './banditplay.js'; // 0.8.17 bandit (0.8.18: on the ring)
import { RING_TH } from '../sim/geom.js'; // 0.8.18 bandit
import { creeperActor, creeperActorFor } from './creeper.js'; // 0.8.18 creeper

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => { u = clamp(u, 0, 1); return u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u); };
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const lerp = (a, b, k) => a + (b - a) * k;
const TB = 1.85, HIT = 2.15; // the bonk of a 'turn', the moment a power lands
const GLUE = '#c9a3ff';

// what a power does to a villain at time T (after HIT): the same few answers for every rig
function hitOf(S) {
  const { T, m } = S;
  if ((m !== 'tap' && m !== 'rooster') || T < HIT) return { k: '', u: 0, age: 0 };
  const fx = m === 'rooster' ? 'flee' : S.fx || 'zap', age = T - HIT;
  return { k: fx, u: seg(T, HIT, HIT + 1.2), age };
}
// a blast's flash where it lands (the first third of a second)
function boom(ctx, x, y, r, age) {
  if (age > 0.34) return;
  const q = age / 0.34;
  ctx.save(); ctx.globalAlpha *= 1 - q; ctx.fillStyle = '#ff8a3a';
  ctx.beginPath(); for (let i = 0; i < 16; i++) { const an = (i * Math.PI) / 8, rr = (i % 2 ? 0.5 : 1) * r * (0.5 + q); ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); } ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff2b0'; ctx.beginPath(); ctx.arc(x, y, r * 0.3 * (1 - q), 0, TAU); ctx.fill();
  ctx.restore();
}
function puddle(ctx, x, y, rx, a) {
  ctx.save(); ctx.globalAlpha *= 0.75 * a; ctx.fillStyle = GLUE;
  ctx.beginPath(); ctx.ellipse(x, y, rx, rx * 0.3, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha *= 0.6; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x - rx * 0.3, y - rx * 0.08, rx * 0.22, rx * 0.06, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

// ------------------------------------------------------------------ the snake
// It comes from outside the vault, up to the gap it wants to go through. Turn: the gap slides away as it lunges, its
// nose meets the wall. A power catches it poised under the gap.
const SN = { pts: [], len: [] };
function snakeTrack(S, Wh) {
  const g = S.g0, sd = g >= 0 ? 1 : -1;
  const tip = S.at(g, -(S.band / 2 + Wh * 2.3)), wall = S.at(g, -(S.band / 2 + Wh * 0.75));
  const B0 = { x: S.cx + sd * (S.w * 0.5 + Wh * 4), y: S.y + S.h * 1.02 }, B1 = { x: S.cx + sd * S.w * 0.5, y: S.y + S.h * 0.7 };
  const B2 = { x: tip.x + sd * Wh * 1.6, y: tip.y + Wh * 4.2 };
  const P = SN.pts, L = SN.len, n = 36;
  let acc = 0;
  for (let i = 0; i <= n; i++) {
    const u = i / n, v = 1 - u, x = v * v * v * B0.x + 3 * v * v * u * B1.x + 3 * v * u * u * B2.x + u * u * u * tip.x, y = v * v * v * B0.y + 3 * v * v * u * B1.y + 3 * v * u * u * B2.y + u * u * u * tip.y;
    if (i) acc += Math.hypot(x - P[i - 1].x, y - P[i - 1].y);
    (P[i] || (P[i] = {})).x = x; P[i].y = y; L[i] = acc;
  }
  P.length = L.length = n + 1;
  // past the tip the track runs straight on to the wall (the lunge); before its start, straight back out of the panel
  const ext = Math.hypot(wall.x - tip.x, wall.y - tip.y), total = acc;
  const pt = (s) => {
    if (s <= 0) { const dx = P[1].x - P[0].x, dy = P[1].y - P[0].y, l = Math.hypot(dx, dy) || 1; return { x: P[0].x + (dx / l) * s, y: P[0].y + (dy / l) * s, nx: -dy / l, ny: dx / l }; }
    if (s >= total) { const q = Math.min(1.6, (s - total) / (ext || 1)), dx = wall.x - tip.x, dy = wall.y - tip.y, l = ext || 1; return { x: tip.x + dx * q, y: tip.y + dy * q, nx: -dy / l, ny: dx / l }; }
    let i = 1; while (i < n && L[i] < s) i++;
    const f = (s - L[i - 1]) / ((L[i] - L[i - 1]) || 1), dx = P[i].x - P[i - 1].x, dy = P[i].y - P[i - 1].y, l = Math.hypot(dx, dy) || 1;
    return { x: lerp(P[i - 1].x, P[i].x, f), y: lerp(P[i - 1].y, P[i].y, f), nx: -dy / l, ny: dx / l };
  };
  return { pt, total, ext, wall, tip, sd };
}
const SBODY = [];
function snake(ctx, S, O = {}) {
  const { T, t, m, k } = S, r = 0.074 * k * (O.size || 1), Wh = r * 1.9 * 1.16, TR = snakeTrack(S, Wh), H = hitOf(S); // three quarters of its size in a vault: the stage is a close-up of one gap
  const walk = ease(seg(T, 0.2, 1.3));
  let sH = TR.total * (0.12 + 0.88 * walk), expr = walk < 1 ? 'hunt' : 'snarl', mouth = 0, frozen = 0, flash = 0, droop = 0, stars = 0, tt = t, bonk = 0, threat = T < TB, glue = 0;
  if (m === 'turn') {
    const lunge = ease(seg(T, 1.62, TB));
    if (T >= 1.62 && T < TB) { sH = TR.total + TR.ext * lunge; expr = 'strike'; mouth = lunge; }
    else if (T >= TB) { // its nose met the wall: thrown back, dizzy, then it slinks off the way it came
      const back = ease(seg(T, TB, TB + 0.3)), out = ease(seg(T, 3.0, 4.3));
      sH = TR.total + TR.ext * (1 - back) - TR.total * (0.14 * back + 0.62 * out);
      expr = T < TB + 0.3 ? 'ouch' : 'dizzy'; droop = seg(T, TB + 0.1, TB + 0.5) * (1 - 0.5 * out); stars = seg(T, TB + 0.15, TB + 0.45) * (1 - seg(T, 3.4, 3.9));
      bonk = seg(T, TB, TB + 0.55); threat = false;
    }
  } else if (H.k) {
    threat = false;
    if (H.k === 'freeze') { frozen = seg(H.age, 0, 0.2); tt = t - H.age; expr = 'frozen'; }
    else if (H.k === 'stop') { tt = t - H.age; expr = 'shock'; }
    else if (H.k === 'zap') { const z = 1 - seg(H.age, 0, 0.3); flash = z > 0 ? (Math.sin(t * 60) > 0 ? 0.85 : 0.35) * z : 0; expr = z > 0 ? 'shock' : 'dizzy'; droop = seg(H.age, 0.25, 0.6); stars = seg(H.age, 0.3, 0.55); }
    else if (H.k === 'blast') { const out = ease(seg(H.age, 0, 0.55)); sH = TR.total * (1 - 0.85 * out); expr = 'ouch'; stars = out * (1 - seg(H.age, 0.9, 1.3)); droop = 0.6 * out; }
    else if (H.k === 'flee') { const out = ease(seg(H.age, 0.1, 1.0)); sH = TR.total * (1 - 0.9 * out); expr = 'shock'; }
    else if (H.k === 'glue') { glue = seg(H.age, 0, 0.25); expr = 'snarl'; sH = TR.total - Wh * 0.5 * Math.abs(Math.sin(t * 9)) * glue; }
    else if (H.k === 'bubble') { // it goes for the egg in its bubble and bounces off
      const go = ease(seg(H.age, 0.2, 0.42)), back = ease(seg(H.age, 0.42, 0.75));
      sH = TR.total + TR.ext * 1.5 * (go - back); expr = H.age < 0.42 ? 'strike' : 'dizzy'; mouth = go * (1 - back);
      droop = seg(H.age, 0.5, 0.9); stars = seg(H.age, 0.5, 0.8); bonk = H.age > 0.42 ? seg(H.age, 0.42, 0.95) : 0;
    } else { expr = 'shock'; } // the phoenix carries the egg off: it can only stare
  } else if (walk >= 1) { threat = true; } // poised under the gap, tongue out
  // the body: it follows its own track, so every bend passes through the same places (a real slither, no sliding)
  const Ls = 2.5 * k * (O.size || 1), step = Math.max(5, Wh * 0.22), wl = TAU / (Wh * 5.2), amp = Wh * 0.42;
  let n = 0;
  for (let d = 0; d <= Ls; d += step) {
    const s = sH - d, q = TR.pt(s), taper = Math.min(1, d / (Wh * 2.2)) * (1 - 0.5 * droop), w = Math.sin(s * wl) * amp * taper;
    const o = SBODY[n] || (SBODY[n] = { x: 0, y: 0 });
    o.x = q.x + q.nx * w; o.y = q.y + q.ny * w; n++;
  }
  SBODY.length = n;
  const head = SBODY[0];
  if (glue > 0) puddle(ctx, head.x, head.y + Wh * 0.9, Wh * 2.4, glue);
  if (H.k === 'blast') boom(ctx, TR.tip.x, TR.tip.y, Wh * 3, H.age);
  drawSnake(ctx, SBODY, r, tt, { skin: O.skin || 'violet', thick: 1.16, head: 5.4, wave: 0, expr, mouthOpen: mouth, frozen, flash, droop, stars, look: { x: -TR.sd * 0.5, y: -0.7 } });
  return { threat, bonk, x: TR.wall.x + TR.sd * Wh * 0.6, y: TR.wall.y - S.band - Wh * 2.6, own: true };
}

// ------------------------------------------------------------------ the weasel
// On the ground under the vault: it prowls in, crouches under the gap and springs at it. Turn: the wall is there instead.
function weasel(ctx, S, K = 'weasel', X = null) { // K: the rig ('ratking': the Rat King, crowned, a little under his vault size so he fits the stage)
  const { T, t, m, k } = S, s = RIG[K].s * k * (K === 'ratking' ? 0.8 : 1), H = hitOf(S), g = S.g0, sd = g >= 0 ? 1 : -1, face = -sd;
  const gy = S.ground, wallP = S.at(g, -(S.band / 2)), xg = wallP.x + sd * s * 0.38, x0 = S.cx + sd * (S.w * 0.5 + s * 0.9);
  const walk = ease(seg(T, 0.2, 1.0));
  let x = lerp(x0, xg, walk), y = gy, rot = 0, st = walk < 1 ? 'prowl' : 'crouch', u = seg(T, 1.0, 1.65), odo = Math.abs(x - x0) / k, tt = t;
  const o = { face, eye: walk < 1 ? 'normal' : 'lock' };
  let bonk = 0, threat = T < TB, glue = 0, alpha = 1;
  const top = wallP.y + s * 0.5; // its feet when its nose is at the ring
  if (m === 'turn') {
    if (T >= 1.65 && T < TB) { const q = seg(T, 1.65, TB); st = 'leap'; u = q * 0.55; y = lerp(gy, top, 1 - (1 - q) * (1 - q)); rot = face * -0.9 * (1 - 0.3 * q); o.eye = 'lock'; }
    else if (T >= TB) {
      const fall = seg(T, TB, TB + 0.42), out = seg(T, 3.3, 4.3);
      y = lerp(top, gy, fall * fall); x = xg + sd * s * 0.35 * ease(fall);
      if (fall < 1) { st = 'hurt'; u = 0.5; rot = face * (-0.9 + 2.2 * fall); o.eye = 'squeeze'; }
      else { st = 'stunned'; o.eye = 'spiral'; o.stars = 3; }
      bonk = seg(T, TB, TB + 0.55); threat = false; alpha = 1 - out;
    }
  } else if (H.k) {
    threat = false; u = 0.6;
    if (H.k === 'freeze') { o.frozen = 1; tt = t - H.age; }
    else if (H.k === 'stop') { tt = t - H.age; }
    else if (H.k === 'zap') { const z = 1 - seg(H.age, 0, 0.3); if (z > 0) { o.zap = z; st = 'hurt'; u = 0.5; o.eye = 'squeeze'; } else { st = 'stunned'; o.eye = 'spiral'; o.stars = 3; } }
    else if (H.k === 'blast') { const q = seg(H.age, 0, 0.95); st = 'tumble'; o.eye = 'squeeze'; o.stars = 2; x = xg + sd * S.w * 0.1 * q; y = gy - S.h * 0.62 * Math.sin(Math.PI * Math.min(1, q * 0.8)); rot = sd * q * 9; alpha = 1 - seg(H.age, 0.7, 0.95); }
    else if (H.k === 'flee') { const q = seg(H.age, 0.05, 1.0); st = 'scared'; o.face = sd; o.eye = 'wide'; x = xg + sd * (S.w * 0.5 + s) * q * q; odo += q * 3; }
    else if (H.k === 'glue') { glue = seg(H.age, 0, 0.25); st = 'trapped'; o.eye = 'wide'; o.sweat = 1; }
    else { st = 'stalk'; o.eye = 'wide'; odo = 0; }
  }
  if (glue > 0) puddle(ctx, x, gy + s * 0.02, s * 0.6, glue);
  if (H.k === 'blast') boom(ctx, xg, gy - s * 0.25, s * 0.7, H.age);
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.translate(x, y - s * 0.24); if (rot) ctx.rotate(rot); ctx.translate(0, s * 0.24);
  drawThief(ctx, 0, 0, s, tt, thiefPose(K, st, tt, u, odo), X ? { ...o, ...X } : o, K);
  ctx.restore();
  return { threat, bonk, x: wallP.x - sd * s * 0.35, y: wallP.y - S.band - s * 0.5, own: true };
}

// ------------------------------------------------------------------ the rats
// Inside the vault: one rat rolls the egg along the floor toward its hole. Turn: a gap comes under the rolling egg.
const RAT_ROLL = -0.36;
function rats(ctx, S) {
  const { T, t, m, k } = S, s = RIG.rat.s * k, H = hitOf(S);
  const eA = S.eA, off = (S.eggS * 0.5 + s * 0.6) / S.floor; // 0.8.14: his nose and paws ON the egg's shell, not his head behind it
  let phi = eA + off, st = 'push', u = 0, tt = t, odo = Math.abs(eA) * S.floor / k, alpha = 1, rot = 0, lift = 0, glue = 0;
  const o = { face: -1, eye: 'normal' };
  let threat = true;
  if (m === 'turn' && T >= 2.3) { // the egg is gone through the gap: it stares down after it, then slopes off
    const q = seg(T, 2.3, 2.9), out = seg(T, 3.0, 4.2);
    st = q < 1 ? 'startle' : 'defeated'; o.eye = q < 1 ? 'wide' : 'normal'; o.face = q < 1 ? -1 : 1;
    phi = RAT_ROLL + off + 0.75 * out * out; odo = out * 2.4; threat = false;
  } else if (H.k) {
    threat = false; phi = RAT_ROLL + off;
    if (H.k === 'freeze') { o.frozen = 1; tt = t - H.age; }
    else if (H.k === 'stop') { tt = t - H.age; }
    else if (H.k === 'zap') { const z = 1 - seg(H.age, 0, 0.3); if (z > 0) { o.zap = z; st = 'hurt'; u = 0.5; o.eye = 'squeeze'; } else { st = 'stunned'; o.eye = 'spiral'; o.stars = 3; } }
    else if (H.k === 'blast') { const q = seg(H.age, 0, 0.7); st = 'tumble'; o.eye = 'squeeze'; o.stars = 2; phi += 0.5 * q; lift = s * 1.1 * Math.sin(Math.PI * Math.min(1, q * 1.15)); rot = q * 7; alpha = 1 - seg(H.age, 0.55, 0.8); }
    else if (H.k === 'flee') { const q = seg(H.age, 0.05, 1.0); st = 'scared'; o.face = 1; o.eye = 'wide'; phi += 0.9 * q * q; odo += q * 3; }
    else if (H.k === 'glue') { glue = seg(H.age, 0, 0.25); st = 'trapped'; o.eye = 'wide'; o.sweat = 1; }
    else { st = 'startle'; o.eye = 'wide'; }
  }
  const p = S.at(phi, lift);
  if (glue > 0) puddle(ctx, p.x, p.y, s * 0.55, glue);
  if (H.k === 'blast') { const b = S.at(RAT_ROLL + off, s * 0.25); boom(ctx, b.x, b.y, s * 0.7, H.age); }
  // 0.8.14: the pack. A second rat trots behind the pusher (rats come in a pack), and dust kicks up while the egg rolls
  if (st === 'push' || (m === 'turn' && T >= 2.3)) {
    const phi2 = phi + (s * 1.25) / S.floor, p2 = S.at(phi2, 0), s2 = s * 0.86;
    ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(p2.x, p2.y); ctx.rotate(-phi2);
    drawThief(ctx, 0, 0, s2, tt + 0.4, thiefPose('rat', st === 'push' ? 'prowl' : st, tt + 0.4, u, odo + 0.35), { ...o }, 'rat');
    ctx.restore();
  }
  if (st === 'push' && odo > 0.02 && Math.abs(eA) < Math.abs(RAT_ROLL) * 0.98) {
    ctx.save(); ctx.fillStyle = 'rgba(235,225,205,0.55)';
    for (let i = 0; i < 3; i++) { const q = (tt * 1.6 + i / 3) % 1, d = S.at(phi + (s * 0.35 + q * s * 0.5) / S.floor, s * (0.05 + 0.2 * q)); ctx.globalAlpha = alpha * 0.6 * (1 - q); ctx.beginPath(); ctx.arc(d.x, d.y, s * (0.06 + 0.1 * q), 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(p.x, p.y); ctx.rotate(-phi + rot);
  drawThief(ctx, 0, 0, s, tt, thiefPose('rat', st, tt, u, odo), o, 'rat');
  ctx.restore();
  return { threat, bonk: 0, x: p.x, y: p.y - s, own: true };
}

// ------------------------------------------------------------------ the crawlers (salamander, chameleon, thorn-back)
// They walk the ring's floor toward the egg. Turn: the ring carries it off and it slips away. A stone egg flips Spike.
// 0.8.14 (mykee: "the salamanders are quite small when compared to the eggs"): they are drawn near their size in the vault
// (snout to hips about a metre, so two eggs long and more with the tail), not at 0.6 m as before.
const CRAWL_S = { salamander: 1.0, thornback: 1.06, chameleon: 0.9 };
function crawler(species, X = {}) {
  return (ctx, S) => {
    const { T, t, m, k } = S, s = (CRAWL_S[species] || 1) * (X.big || 1) * k, H = hitOf(S), lift = s * 0.16;
    const stop = -(S.eggS * 0.46 + s * 0.1) / S.floor, start = stop - 0.7;
    const walk = ease(seg(T, 0.2, 1.3));
    let vA = lerp(start, stop, walk), pose = walk < 1 ? 'walk' : 'idle', p = 0, tt = t, status = null, alpha = 1, glue = 0, threat = T < TB;
    let gait = (vA - start) * S.floor;
    let aim = 0, fireLen = 0, target = null;
    if (m === 'harm') { // 2026-11-23 the harm beat (howto.js harmBeat): what this crawler does, acted by its own rig
      threat = true;
      if (species === 'salamander') { // 0.8.14 the bite: it walks right up to the egg, coils with its jaws wide, and snaps (BITE_AT)
        if (T > 1.0) { pose = T < BITE_AT + 0.2 ? 'bite' : 'chew'; p = T < BITE_AT ? 0.8 * seg(T, 1.0, BITE_AT) : T < BITE_AT + 0.2 ? 0.8 + 0.2 * seg(T, BITE_AT, BITE_AT + 0.2) : seg(T, BITE_AT + 0.2, BITE_AT + 1.2); }
      } else if (species === 'chameleon') { // it stops short of the orb by the egg and its tongue snatches the orb
        const st2 = stop - 0.34; vA = lerp(start, st2, walk); gait = (vA - start) * S.floor;
        if (T > 1.0) { pose = 'snatch'; p = seg(T, 1.0, 2.0); target = S.at(CHAM_ORB, S.eggS * 0.4); }
      } else { // the thorn-back walks on into the egg and shoves it along the channel
        const push = ease(seg(T, 1.0, 1.9)); vA = lerp(start, stop, walk) + BUMP_A * push; gait = (vA - start) * S.floor;
        if (T > 1.9) { pose = 'idle'; gait = (stop + BUMP_A - start) * S.floor; }
      }
    } else if (m === 'turn') {
      vA += S.th; // it rides the ring
      if (T >= TB) { const q = seg(T, TB, 3.1); pose = 'dazed'; vA -= 0.75 * q * q; threat = false; }
    } else if (m === 'stone') {
      vA = stop - 0.1; pose = 'idle'; gait = 0;
      if (T >= 1.95) { pose = 'flipped'; p = 0.16 + 0.6 * seg(T, 1.95, 3.6); vA -= 0.28 * ease(seg(T, 1.95, 2.5)); threat = false; alpha = 1 - seg(T, 3.6, 4.2); }
    } else if (H.k) {
      threat = false;
      if (H.k === 'freeze') { tt = t - H.age; status = { k: 'ice', age: H.age, left: 9, hold: tt, zap: -1, crack: 0, seed: 5 }; }
      else if (H.k === 'stop') { tt = t - H.age; }
      else if (H.k === 'zap') { if (H.age < 0.3) status = { k: 'stun', age: H.age, left: 9, hold: t, zap: H.age / 0.3, crack: 0, seed: 5 }; pose = 'dazed'; }
      else if (H.k === 'blast' || H.k === 'flee') { const q = seg(H.age, 0.05, 1.0); pose = 'flee'; vA -= 0.8 * q * q; gait -= 0.8 * q * q * S.floor; if (H.k === 'blast') pose = 'dazed'; }
      else if (H.k === 'glue') { glue = seg(H.age, 0, 0.25); pose = 'idle'; }
      else { pose = 'idle'; }
      if (m === 'tap' && H.k !== 'flee' && H.k !== 'blast') vA += S.th;
    }
    const head = S.at(vA, lift), heading = -vA, trail = (d) => S.at(vA - d / S.floor, lift);
    if (glue > 0) { const q = S.at(vA - (s * 0.9) / S.floor, 0); puddle(ctx, q.x, q.y - 2, s * 0.9, glue); }
    if (H.k === 'blast') { const b = S.at(stop - 0.12, lift); boom(ctx, b.x, b.y, s * 0.6, H.age); }
    ctx.save(); ctx.globalAlpha *= alpha;
    const o = { heading, curve: -1 / S.floor, trail, gait, pose, p, status, look: { x: 0.6, y: -0.3 }, id: 9300, skin: X.skin };
    if (aim || fireLen) { o.aim = aim; o.fireLen = fireLen; }
    if (target) o.target = target;
    if (species === 'salamander') drawSalamander(ctx, head.x, head.y, s, tt, { ...o, glow: 0.8, frost: X.frost }); else drawCrawler(ctx, head.x, head.y, s, tt, o, species);
    ctx.restore();
    return { threat, bonk: 0, x: head.x, y: head.y - s * 0.45, own: true };
  };
}

// Fire meets frost (0.8.14): the two salamanders close in on the egg from both sides, see each other, breathe, and the
// steam knocks both out: the fire one cools to grey, the frost one sees stars. The egg between them is fine.
export const FACE_T = { hiss: 1.25, jet: 2.0, out: 3.0 };
function faceoff(ctx, S) {
  const { T, t, k } = S, s = 0.92 * k, lift = s * 0.16, walk = ease(seg(T, 0.2, 1.15)), stop = (S.eggS * 0.62 + s * 0.1) / S.floor, far = stop + 0.6;
  const mid = S.at(0, S.eggS * 1.35); // where the two jets meet: over the egg
  const one = (sd, frost) => { // sd -1: comes from the left, +1: from the right
    const vA = sd * lerp(far, stop, walk), head = S.at(vA, lift), heading = sd < 0 ? -vA : Math.PI - vA;
    const trail = (d) => S.at(vA + sd * d / S.floor, lift), gait = (far - Math.abs(vA)) * S.floor;
    let pose = walk < 1 ? 'walk' : 'idle', p = 0, status = null, cool = 0, aim = 0, fireLen = 0;
    if (T >= FACE_T.hiss) {
      const want = Math.atan2(mid.y - head.y, mid.x - head.x); aim = clamp(Math.atan2(Math.sin(want - heading), Math.cos(want - heading)), -1.15, 1.15);
      fireLen = clamp(Math.hypot(mid.x - head.x, mid.y - head.y) / (s / 100) * 0.8, 12, 90);
      if (T < FACE_T.jet) { pose = 'hiss'; p = 0.12 + 0.6 * seg(T, FACE_T.hiss, FACE_T.jet); }
      else if (T < FACE_T.out) { pose = 'breath'; p = 0.36 + 0.46 * seg(T, FACE_T.jet, FACE_T.out); }
      else if (frost) { pose = 'dazed'; aim = 0; fireLen = 0; status = { k: 'stun', age: T - FACE_T.out, left: 9, hold: t, zap: -1, crack: 0, seed: 7 }; }
      else { pose = 'cool'; cool = seg(T, FACE_T.out, FACE_T.out + 0.4); aim = 0; fireLen = 0; }
    }
    const o = { heading, curve: sd < 0 ? -1 / S.floor : 1 / S.floor, trail, gait, pose, p, status, look: { x: 0.7, y: sd < 0 ? -0.3 : 0.3 }, id: frost ? 9311 : 9310, glow: 0.8, frost, cool };
    if (aim || fireLen) { o.aim = aim; o.fireLen = fireLen; }
    drawSalamander(ctx, head.x, head.y, s, t, o);
  };
  one(-1, 0); one(1, 1);
  if (T > FACE_T.jet + 0.25) { // the steam where fire meets frost
    const g = seg(T, FACE_T.jet + 0.25, FACE_T.jet + 0.7), end = seg(T, FACE_T.out, FACE_T.out + 0.9);
    ctx.save();
    for (let i = 0; i < 8; i++) {
      const f = (((t * 0.8 + i * 0.31) % 1) + 1) % 1, an = i * 2.4 + t * 0.5, rr = (0.12 + 0.3 * f + 0.35 * end) * k;
      ctx.fillStyle = `rgba(242,248,255,${0.62 * g * (1 - f * 0.6) * (1 - end)})`;
      ctx.beginPath(); ctx.arc(mid.x + Math.cos(an) * rr * 0.8, mid.y + Math.sin(an) * rr * 0.5 - (f * 0.3 + end * 0.3) * k, (0.12 + 0.12 * f + 0.1 * end) * k, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  return { threat: T < FACE_T.out, bonk: 0, x: mid.x, y: mid.y - s * 0.3, own: true };
}

// Serpent Hollow (2026-11-23, mykee: "a congested head and body"): the boss is two snakes, so two snakes act it, each
// whole and on its own side: the big slow one comes up under the gap, the small fast one from the other side.
function twoSnakes(ctx, S) {
  snake(ctx, { ...S, g0: -S.g0 * 1.25, T: Math.max(0, S.T - 0.12) }, { size: 0.72, skin: 'emerald' });
  return snake(ctx, S, { size: 1.12 });
}

// Grandpa Gator (2026-11-23: a boss is shown whole, never as a head): he lumbers along the ring to the egg, an egg from
// above lands on him, he sees stars and rides the ring away. Timings are howto.js's 'drop'.
function bossGator(ctx, S) {
  const { T, t, k } = S, walk = ease(seg(T, 0.2, 1.3)), hit = T > 2.0, s = GATOR.L * k * 0.9;
  const phi = -0.6 - 0.3 * (1 - walk) + (hit ? S.th : 0), p = S.at(phi, 0);
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-phi);
  drawGator(ctx, s, t, { boss: 1, walk: hit ? 0 : 1, bend: S.floor, jaw: hit ? 0.12 : 0.2 + 0.3 * Math.abs(Math.sin(t * 5)), eye: hit ? 'spiral' : 'open', stars: hit ? 1 : 0, gait: walk < 1 ? walk * 3 : 0 });
  ctx.restore();
  return { threat: !hit, bonk: hit ? seg(T, 2.0, 2.55) : 0, x: p.x + s * 0.2, y: p.y - s * 0.45, own: true };
}

// 0.8.17 bandit; 0.8.18: Bandit the raccoon sits ON the ring's floor left of the egg (render/banditplay.js drawBanditPerch,
// the same art and size as in play). He spits in his paws (a faint arrow on the ring shows his way) and cranks the ring
// toward him, the floor dragging the egg his way. Turn (the counter): the hand turns the ring hard the other way, he is
// shaken, loses his seat and tumbles off; the gap the turn brought round drops the egg home. Harm: he cranks the egg up to
// him, stretches, grabs it and stuffs it in his sack. under() draws his tail behind the ring, draw() the rest of him.
const BAND_PHI = -0.56, BAND_G0 = -0.46; // his seat (stage angle: 0 is the bottom, + to the right) and the gap's start
const BT = { spit: [0.3, 0.85], crank: [0.85, 1.4], turn: [1.45, 2.25], shake: [1.5, 2.05], off: [2.05, 2.7] }; // the counter's clock
const BHm = { spit: [0.2, 0.6], crank: [0.6, 2.0], reach: [1.35, 1.75], grab: [1.75, 2.7] }; // the harm beat's clock
const BCR = 0.09, BHR = 0.26; // how far his crank turns the ring (rad) in the counter, in the harm
// the ring turn and the egg on each clock (howto.js reads them through ACTORS['boss:raccoon'].stage)
function bandTh(T) { return -BCR * ease(seg(T, BT.crank[0], BT.crank[1])) + (BCR - BAND_G0) * ease(seg(T, BT.turn[0], BT.turn[1])); }
function bandEgg(T) { const c = -0.75 * BCR * ease(seg(T, BT.crank[0], BT.crank[1])); return c * (1 - ease(seg(T, BT.turn[0] + 0.1, BT.turn[1]))); }
export function bandHarmEgg(S, T) {
  const th = -BHR * ease(seg(T, BHm.crank[0], BHm.crank[1])), eA = 0.72 * th * (1 - 0.2 * seg(T, BHm.grab[0], BHm.grab[1]));
  return { th, eA, eLift: 0, eAlpha: T < BHm.grab[0] ? 1 : 0, hand: null };
}
function bandit(ctx, S, layer) {
  const { T, t, k, C, floor } = S, harm = S.m === 'harm', calm = !!S.calm;
  const W = (P) => ({ x: (P.x - C.x) / k, y: -(P.y - C.y) / k }), r = floor / k + RING_TH / 2, a = -Math.PI / 2 + BAND_PHI;
  const eggA = harm ? bandHarmEgg(S, T).eA : bandEgg(T), eggW = W(S.at(eggA, S.eggS * 0.5));
  let st = 'sit', u = 0, add = null, eye = 'normal', toW = null, at = null, th = null, hug = false;
  const spit = harm ? BHm.spit : BT.spit, crank = harm ? BHm.crank : BT.crank;
  if (T >= spit[0] && T < spit[1]) { add = spitAdd(seg(T, spit[0], spit[1]), t); }
  if (T >= crank[0] && T < (harm ? BHm.reach[0] : BT.shake[0])) { st = 'crank'; u = 0.001 + (T - crank[0]) * 0.9; }
  let ar = { threat: true, bonk: 0, x: S.at(BAND_PHI, S.eggS * 2.6).x, y: S.at(BAND_PHI, S.eggS * 2.6).y, own: true };
  if (harm) {
    if (T >= BHm.reach[0] && T < BHm.grab[0]) { st = 'reach'; u = 0.82 * seg(T, BHm.reach[0], BHm.grab[0]); eye = 'lock'; toW = eggW; }
    else if (T >= BHm.grab[0]) { st = 'grab'; u = seg(T, BHm.grab[0], BHm.grab[1]); toW = W(S.at(eggA, S.eggS * 0.5)); hug = true; }
  } else if (T >= BT.shake[0]) {
    const off = T >= BT.off[0], q = seg(T, BT.off[0], BT.off[1]);
    st = off ? 'fall' : 'shaken'; u = off ? q : 1; eye = 'squeeze';
    if (off) { const P0 = S.at(BAND_PHI, 0), fx = (P0.x - C.x) / k, fy = -(P0.y - C.y) / k; at = { x: fx - 1.2 * q, y: fy + 1.3 * Math.sin(q * Math.PI * 0.8) - 2.2 * q * q }; th = (-Math.PI / 2 - a) * (1 - q); } // he goes over backwards, upright again by the time he lands
    ar = { threat: false, bonk: seg(T, BT.shake[0], BT.shake[0] + 0.6), x: ar.x, y: ar.y, own: true, word: 'WHOA!' };
  }
  const alpha = !harm && T >= BT.off[0] ? 1 - seg(T, BT.off[0] + 0.35, BT.off[1]) : 1;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(C.x, C.y); ctx.scale(k, -k);
  try {
    if (layer === 'front' && (st === 'crank' || (add && !harm) || (add && harm))) bandArrow(ctx, r - RING_TH / 2, a, T, calm); // his way, along the floor
    drawBanditPerch(ctx, r, a, t, k, st, u, { face: 1, inner: true, layer, calm: true, add, eye, toW, eyeW: st === 'sit' ? eggW : null, egg: hug ? undefined : false, at, th: th == null ? undefined : th });
  } finally { ctx.restore(); }
  return ar;
}
// the spit telegraph's paws (banditplay.js lookPerch uses its own copy of the same beat)
function spitAdd(q, t) {
  const up = ss2(0, 0.25, q) * (1 - ss2(0.5, 0.62, q)), pt = ss2(0.3, 0.38, q) * (1 - ss2(0.44, 0.55, q)), rub = ss2(0.55, 0.65, q), w = Math.sin(t * 22) * rub;
  return { a0x: lerp(14, 11, up) + 3 * w, a0y: lerp(-20, -16, up) + lerp(0, 8, rub) - 1.5 * w, a1x: lerp(25, 19, up) - 3 * w, a1y: lerp(-19, -16, up) + lerp(0, 8, rub) + 1.5 * w, pucker: up * (1 - pt), cheek: 0.6 * up, jaw: 0.5 * pt, g0: 0.3, g1: 0.3, brow: 0.5 + 0.45 * rub, looky: 0.6 * rub };
}
const ss2 = (a, b, x) => { const v = clamp((x - a) / (b - a), 0, 1); return v * v * (3 - 2 * v); };
function bandArrow(ctx, rf, a, T, calm) { // a faint arrow along the floor from the egg toward him (the way he turns it)
  ctx.save(); ctx.globalAlpha *= 0.55 * (calm ? 1 : 0.7 + 0.3 * Math.sin(T * 9)); ctx.strokeStyle = '#ffdc7a'; ctx.fillStyle = '#ffdc7a'; ctx.lineCap = 'round'; ctx.lineWidth = RING_TH * 0.5;
  const r = rf + RING_TH / 2, a0 = a + 0.12, a1 = a + 0.62;
  ctx.setLineDash([0.34, 0.22]); ctx.beginPath(); ctx.arc(0, 0, r, a0, a1); ctx.stroke(); ctx.setLineDash([]);
  const hx = r * Math.cos(a0), hy = r * Math.sin(a0), tx = Math.sin(a0), ty = -Math.cos(a0), nx = Math.cos(a0), ny = Math.sin(a0);
  ctx.beginPath(); ctx.moveTo(hx + tx * 0.42, hy + ty * 0.42); ctx.lineTo(hx + nx * 0.3, hy + ny * 0.3); ctx.lineTo(hx - nx * 0.3, hy - ny * 0.3); ctx.closePath(); ctx.fill();
  ctx.restore();
}
const banditActor = {
  under: (ctx, S) => { bandit(ctx, S, 'back'); },
  draw: (ctx, S) => bandit(ctx, S, 'front'),
  stage: () => ({ g0: BAND_G0, dTh: -BAND_G0, hand: [-0.16, 0.36], th: bandTh, egg: bandEgg, pan: -0.12 }),
  aim: (S) => S.at(BAND_PHI, S.eggS * 1.6),
};

// the harm beats' marks (howto.js reads them too): where the salamander's jet lands, where Sly's orb sits, how far the
// thorn-back shoves the egg
export const BREATH_AT = 0, CHAM_ORB = -0.22, BUMP_A = 0.36, BITE_AT = 1.75; // BITE_AT: s into the harm beat when the jaws shut
const CREEP_KINDS = new Set(['swampvine', 'frostcrawler', 'lavaflow', 'anemone', 'spark', 'sawtooth', 'shard']); // 0.8.18 the creeper family
export const harmActor = (kind) => (kind === 'boss:raccoon' || kind === 'salamander' || kind === 'frostsal' || kind === 'chameleon' || kind === 'spike' || kind === 'boss:golem' || kind === 'urchin' || kind === 'creeper' || CREEP_KINDS.has(kind) ? ACTORS[kind] : null); // 0.8.17 urchin, 0.8.18 creeper
const CRAWL = () => ({ g0: 0.4, dTh: -0.4, pan: 0.2 }); // the crawlers come along the ring from the left: the camera steps that way
export const ACTORS = {
  // pan: the camera steps to the villain's side (a share of the stage's width), so it is whole in the picture
  snake: { draw: snake, stage: () => ({ g0: 0.42, dTh: -0.42, hand: [-0.14, -0.56], pan: -0.1 }), aim: (S) => S.at(S.g0, -(S.band / 2 + 0.3 * S.k)) },
  'boss:snake': { draw: twoSnakes, stage: () => ({ g0: 0.42, dTh: -0.42, hand: [-0.14, -0.56] }), aim: (S) => S.at(S.g0, -(S.band / 2 + 0.3 * S.k)) },
  weasel: { draw: weasel, stage: () => ({ g0: 0.36, dTh: -0.36, hand: [-0.14, -0.5], pan: -0.16 }), aim: (S) => ({ x: S.at(S.g0, 0).x, y: S.ground - 0.3 * S.k }) },
  rats: { draw: rats, stage: (m) => ({ g0: RAT_ROLL - 0.42, dTh: 0.42, hand: [0.16, 0.58], egg: (T) => RAT_ROLL * ease(seg(T, 0.3, m === 'turn' ? 2.25 : 2.1)) }), aim: (S) => S.at(RAT_ROLL + 0.3, 0.25 * S.k) },
  'boss:ratking': { draw: (c, S) => weasel(c, S, 'ratking', { crown: 1 }), stage: () => ({ g0: 0.36, dTh: -0.36, hand: [-0.14, -0.5], pan: -0.2 }), aim: (S) => ({ x: S.at(S.g0, 0).x, y: S.ground - 0.4 * S.k }) },
  'boss:gator': { draw: bossGator, stage: () => ({ g0: 0.4, dTh: -0.4, pan: 0.1 }) },
  salamander: { draw: crawler('salamander'), stage: CRAWL, aim: (S) => S.at(-0.3, 0.15 * S.k) },
  frostsal: { draw: crawler('salamander', { frost: 1 }), stage: CRAWL, aim: (S) => S.at(-0.3, 0.15 * S.k) },
  faceoff: { draw: faceoff, stage: () => ({ g0: 2.6, dTh: 0, pan: 0 }) },
  chameleon: { draw: crawler('chameleon'), stage: CRAWL, aim: (S) => S.at(-0.3, 0.15 * S.k) },
  spike: { draw: crawler('thornback'), stage: CRAWL, aim: (S) => S.at(-0.3, 0.15 * S.k) },
  'boss:golem': { draw: crawler('thornback', { skin: 'crystal', big: 1.12 }), stage: CRAWL, aim: (S) => S.at(-0.3, 0.15 * S.k) }, // 0.8.14 Duke Quartz in person (he was a round badge)
};
// the moves an actor plays; any other plan keeps the portrait
ACTORS['boss:raccoon'] = banditActor; // 0.8.17 bandit
ACTORS['boss:weasel'] = ACTORS.weasel; // the Weasel Raid's boss is the weasel himself: his whole body, not a head on the ring
const PLAYS = { 'boss:raccoon': ['turn'], 'boss:ratking': ['turn', 'tap', 'rooster'], 'boss:gator': ['drop'], 'boss:snake': ['tap'], 'boss:weasel': ['turn', 'tap', 'rooster'], snake: ['turn', 'tap'], weasel: ['turn', 'tap', 'rooster'], rats: ['turn', 'tap'], salamander: ['turn', 'tap'], frostsal: ['turn', 'tap'], faceoff: ['faceoff'], chameleon: ['turn', 'tap'], spike: ['stone', 'tap'], 'boss:golem': ['stone', 'tap'] };
ACTORS.penguin = pipActor; PLAYS.penguin = ['turn']; // 0.8.17 pip
ACTORS.urchin = urchinActor; PLAYS.urchin = ['turn']; // 0.8.17 urchin: Spike acts his own scene
ACTORS.monkey = cocoActor; PLAYS.monkey = ['turn']; // 0.8.17 coco
ACTORS.creeper = creeperActor; PLAYS.creeper = ['turn']; // 0.8.18 creeper: it crawls, curls up by the gap, the egg rolls over it
for (const [kind, form] of [['swampvine', 'vine'], ['frostcrawler', 'frost'], ['lavaflow', 'lava'], ['anemone', 'anemone'], ['spark', 'spark'], ['sawtooth', 'saw'], ['shard', 'shard']]) { ACTORS[kind] = creeperActorFor(form); PLAYS[kind] = ['turn']; } // 0.8.18 the family's forms
export function actorFor(plan) {
  const k = plan && plan.kind;
  return k && ACTORS[k] && PLAYS[k].includes(plan.move) ? ACTORS[k] : null;
}
