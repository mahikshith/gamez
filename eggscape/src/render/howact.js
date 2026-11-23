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
  const eA = S.eA, off = (S.eggS * 0.4 + s * 0.42) / S.floor;
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
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(p.x, p.y); ctx.rotate(-phi + rot);
  drawThief(ctx, 0, 0, s, tt, thiefPose('rat', st, tt, u, odo), o, 'rat');
  ctx.restore();
  return { threat, bonk: 0, x: p.x, y: p.y - s, own: true };
}

// ------------------------------------------------------------------ the crawlers (salamander, chameleon, thorn-back)
// They walk the ring's floor toward the egg. Turn: the ring carries it off and it slips away. A stone egg flips Spike.
function crawler(species) {
  return (ctx, S) => {
    const { T, t, m, k } = S, s = 0.6 * k * (species === 'thornback' ? 0.92 : 1), H = hitOf(S), lift = s * 0.2;
    const stop = -(S.eggS * 0.46 + s * 0.12) / S.floor, start = stop - 0.62;
    const walk = ease(seg(T, 0.2, 1.3));
    let vA = lerp(start, stop, walk), pose = walk < 1 ? 'walk' : 'idle', p = 0, tt = t, status = null, alpha = 1, glue = 0, threat = T < TB;
    let gait = (vA - start) * S.floor;
    if (m === 'turn') {
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
    const o = { heading, curve: -1 / S.floor, trail, gait, pose, p, status, look: { x: 0.6, y: -0.3 }, id: 9300 };
    if (species === 'salamander') drawSalamander(ctx, head.x, head.y, s, tt, { ...o, glow: 0.8 }); else drawCrawler(ctx, head.x, head.y, s, tt, o, species);
    ctx.restore();
    return { threat, bonk: 0, x: head.x, y: head.y - s * 0.6, own: true };
  };
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

const CRAWL = () => ({ g0: 0.4, dTh: -0.4, pan: 0.1 }); // the crawlers come along the ring from the left: the camera steps that way
export const ACTORS = {
  // pan: the camera steps to the villain's side (a share of the stage's width), so it is whole in the picture
  snake: { draw: snake, stage: () => ({ g0: 0.42, dTh: -0.42, hand: [-0.14, -0.56], pan: -0.1 }), aim: (S) => S.at(S.g0, -(S.band / 2 + 0.3 * S.k)) },
  'boss:snake': { draw: twoSnakes, stage: () => ({ g0: 0.42, dTh: -0.42, hand: [-0.14, -0.56] }), aim: (S) => S.at(S.g0, -(S.band / 2 + 0.3 * S.k)) },
  weasel: { draw: weasel, stage: () => ({ g0: 0.36, dTh: -0.36, hand: [-0.14, -0.5], pan: -0.16 }), aim: (S) => ({ x: S.at(S.g0, 0).x, y: S.ground - 0.3 * S.k }) },
  rats: { draw: rats, stage: (m) => ({ g0: RAT_ROLL - 0.42, dTh: 0.42, hand: [0.16, 0.58], egg: (T) => RAT_ROLL * ease(seg(T, 0.3, m === 'turn' ? 2.25 : 2.1)) }), aim: (S) => S.at(RAT_ROLL + 0.3, 0.25 * S.k) },
  'boss:ratking': { draw: (c, S) => weasel(c, S, 'ratking', { crown: 1 }), stage: () => ({ g0: 0.36, dTh: -0.36, hand: [-0.14, -0.5], pan: -0.2 }), aim: (S) => ({ x: S.at(S.g0, 0).x, y: S.ground - 0.4 * S.k }) },
  'boss:gator': { draw: bossGator, stage: () => ({ g0: 0.4, dTh: -0.4, pan: 0.1 }) },
  salamander: { draw: crawler('salamander'), stage: CRAWL, aim: (S) => S.at(-0.3, 0.15 * S.k) },
  chameleon: { draw: crawler('chameleon'), stage: CRAWL, aim: (S) => S.at(-0.3, 0.15 * S.k) },
  spike: { draw: crawler('thornback'), stage: CRAWL, aim: (S) => S.at(-0.3, 0.15 * S.k) },
};
// the moves an actor plays; any other plan keeps the portrait
ACTORS['boss:weasel'] = ACTORS.weasel; // the Weasel Raid's boss is the weasel himself: his whole body, not a head on the ring
const PLAYS = { 'boss:ratking': ['turn', 'tap', 'rooster'], 'boss:gator': ['drop'], 'boss:snake': ['tap'], 'boss:weasel': ['turn', 'tap', 'rooster'], snake: ['turn', 'tap'], weasel: ['turn', 'tap', 'rooster'], rats: ['turn', 'tap'], salamander: ['turn', 'tap'], chameleon: ['turn', 'tap'], spike: ['stone', 'tap'] };
export function actorFor(plan) {
  const k = plan && plan.kind;
  return k && ACTORS[k] && PLAYS[k].includes(plan.move) ? ACTORS[k] : null;
}
