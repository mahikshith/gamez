// Spike the Sea Urchin (the Coral Reef's living thorn): a purple-black ball of long spines, two googly eyes peeking
// between them, tiny tube feet, permanently grumpy. Crisp cel-shaded code art in the thieves' house style: a dark outline
// only, two-tone shading with a back highlight, big eyes with heavy lids and brows.
//
// drawUrchin(ctx, x, y, s, t, pose, o) draws him in a local y-DOWN pixel space:
//   (x, y)  the floor point under him; he faces +x (o.face -1 mirrors). s = px per 100 rig units; with his spines out he
//           is about 117 units across (URCHIN_M metres per 100 units puts him near 0.9 m), napping about 62 (the napping body is egg-sized).
//   pose    from urchinPose(state, t, u): plain numbers, so poses blend (urchinBlend)
//   o       { face, frozen (s left, or 0: an ice shell round his silhouette, icy colours, glints; he shivers in the last
//             second), stars 0..3 (overrides the pose), eye: 'normal' | 'lock' | 'wide' | 'squeeze' | 'spiral' | 'happy' |
//             'angry', out: {} receives eye, mouth, top, centre {x, y}, R (body radius, px: a soft bump) and spikeR (how
//             far the spines reach from the centre, px: what cracks an egg) in the same px space }
// urchinPose states: nap (spines in, half-shut eyes, a bubble), puff (u: the bubble pops, he wakes cross, breathes in,
// then the spines slide out one ring at a time and lift him off the floor), roll (u > 0 = turns of the wheel, else it
// runs on t: THE GAME MOVES HIM, URCHIN_TURN metres a turn), bump (u: squashed on a wall whose face is about 52 units
// ahead of (x, y), bounces back, furious; the game then turns him round with o.face), flipped (u: the tumble onto his
// back, then feet waving), dizzy, laugh, scared (spines flat), defeated (u: he strains, every spine pops off, bald and
// blushing).
import { blinkAt, hash, clamp, lerp, ss, back, zed } from './castkit.js';
import { dizzyStars, spiralEye } from './status.js';

const TAU = Math.PI * 2;
const fract = (x) => x - Math.floor(x);
export const URCHIN_M = 0.8; // metres per 100 rig units
const R0 = 25, L0 = 30, L1 = 21, L2 = 12, STUB = 7, NS = 7, LOW = 31, TIP = R0 * 0.86 + STUB + L0; // body radius, spine lengths (three rings), spines in a long ring, centre height when they are in, how far a long one reaches
export const URCHIN_TURN = (2 * NS * TIP * Math.sin(Math.PI / NS) / 100) * URCHIN_M; // metres rolled in one turn (he walks on the tips of the long ring)
// centre height standing on the long spines (out by sp0) at a given turn: the wheel is a polygon, so he bobs as he rolls
const standH = (spin, sp0 = 1) => { const d = fract((Math.PI / 2 - spin) / (TAU / NS) + 0.5) - 0.5; return (R0 * 0.86 + STUB + L0 * sp0) * Math.cos(d * TAU / NS); };
const HI = standH(0);
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixHex = (a, b, k) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
const PAL = {
  line: '#170b2a', body: '#56309a', bodyLo: '#391e6c', bodyHi: '#8d66d8', spine: '#a274f0', spineLo: '#6b40ba', tip: '#ff5fae', tipDull: '#c9b0f0',
  lid: '#a888ea', eyeW: '#fffdf4', iris: '#f5b51c', irisLo: '#d9780a', pupil: '#160a20', mouth: '#3a0f2c', tongue: '#ff7f9a', tooth: '#ffffff',
  foot: '#f7bfe8', footLo: '#cf86c6', blush: '#ff6fa8', bubble: '#c6ecff', bubLine: '#16467c', sweat: '#8fd4ff', glint: '#fff6c0',
};
const ICED = {};
for (const c in PAL) ICED[c] = mixHex(PAL[c], '#bfe6ff', 0.55);
const RIM = '#2f6f9e', SHELL = '#d6f0ff', SH = 4.6, RW = 1.9;

// ------------------------------------------------------------------ poses
// by: centre height; dx: shift; rot: the body's (and face's) roll, PI = on his back; sq: squash on the world axes (- =
// stretch); spin: the spines' own turn; sp0 / sp1 / sp2: how far each ring of spines is out (long, short, the cones on his
// face); bend: tips trailing the turn; droop; flat: laid back; jit: chatter; wob: uneven lengths; crumple: the spines
// toward +x folded; swell: body size; fx, fy: face shift; look, looky; lid, lidLo; brow -1 worried .. 1 furious; pup;
// happy / squeeze / spiral (> 0.5); jaw, smile -1..1, teeth, tongue; feet: tube-foot length, fw: their wiggle; bub: the
// sleep bubble's size; pop: its burst 0..1; zz; stars; sweat; blush; shd: the spines shed 0..1; hair: the last one; ting
const REST = { by: HI, dx: 0, rot: 0, sq: 0, spin: 0, sp0: 1, sp1: 1, sp2: 1, bend: 0, droop: 0, flat: 0, jit: 0, wob: 0, crumple: 0, swell: 0, fx: 0, fy: 0,
  look: 0.4, looky: 0, lid: 0.3, lidLo: 0, brow: 0.8, pup: 1, happy: 0, squeeze: 0, spiral: 0, jaw: 0, smile: -0.6, teeth: 0, tongue: 0, feet: 1, fw: 0.2,
  bub: 0, pop: 0, zz: 0, stars: 0, sweat: 0, blush: 0, shd: 0, hair: 0, ting: 0 };
const KEYS = Object.keys(REST);
const P = (o) => Object.assign({}, REST, o);
export function urchinPose(state, t, u = 0) {
  switch (state) {
    case 'nap': { // a low round lump: spines in, eyes almost shut, a bubble swelling with each breath; now and then one cross peek
      const b = Math.sin(t * 1.6), b2 = Math.sin(t * 1.6 - 0.9), f = fract(t / 5.2), pk = ss(0.78, 0.84, f) * (1 - ss(0.92, 0.98, f));
      return P({ by: LOW, sq: 0.05 + 0.03 * b, swell: 0.03 * b, sp0: 0, sp1: 0, sp2: 0, lid: 0.72 - 0.3 * pk, lidLo: 0.2, brow: 0.5 + 0.4 * pk, look: 0.2 + 0.7 * pk, looky: 0.6 - 0.4 * pk, smile: -0.5, bub: 0.55 + 0.45 * b2, zz: 1, feet: 0.8, fw: 0.05, fy: 1.5 });
    }
    case 'puff': { // pop: awake and cross. A big breath in, then shing, shing, shing: three rings of spines, each one lifting him higher
      const wake = ss(0, 0.05, u), st = wake * (1 - ss(0.1, 0.2, u)), jump = Math.sin(ss(0, 0.16, u) * Math.PI), inh = ss(0.1, 0.27, u) * (1 - ss(0.28, 0.36, u));
      const r0 = back(ss(0.3, 0.46, u), 2.8), r1 = back(ss(0.48, 0.64, u), 2.8), r2 = back(ss(0.66, 0.8, u), 2.8), done = ss(0.84, 1, u), strain = ss(0.28, 0.4, u) * (1 - done);
      const pulse = (a) => Math.sin(ss(a, a + 0.12, u) * Math.PI);
      return P({ by: LOW + 4 * jump + (HI - LOW) * r0 + 2.5 * (r1 - ss(0.48, 0.64, u)) + 2.5 * (r2 - ss(0.66, 0.8, u)), sq: 0.05 * (1 - wake) + 0.13 * inh - 0.05 * (pulse(0.3) + pulse(0.48) + pulse(0.66)), swell: -0.08 * inh + 0.09 * strain + 0.05 * (pulse(0.3) + pulse(0.48) + pulse(0.66)),
        sp0: r0, sp1: r1, sp2: r2, jit: 0.7 * strain, lid: lerp(0.72, 0, wake) + 0.48 * ss(0.12, 0.3, u), lidLo: 0.2 * ss(0.12, 0.3, u), brow: lerp(0.5, -0.4, st) + 0.5 * ss(0.12, 0.3, u) * (1 - st), pup: 1 - 0.4 * st, jaw: 0.5 * st + 0.3 * done, look: 0.9, looky: 0.2 * (1 - wake),
        smile: lerp(-0.6, 0.8, done), teeth: ss(0.3, 0.4, u), bub: 1 - ss(0, 0.02, u), pop: u < 0.2 ? ss(0, 0.2, u) : 0, feet: 1, fw: 0.3, fy: 1.5 * (1 - wake), ting: Math.max(pulse(0.4), pulse(0.58), pulse(0.76)) });
    }
    case 'roll': { // the wheel: spines turning, tips trailing, a cog's bump as each one takes his weight; the face rocks and glares
      const ph = u > 0 ? u : t * 0.3, a = ph * TAU;
      return P({ by: standH(a), spin: a, rot: 0.1 * Math.sin(a * 2), fy: 1.2 * Math.sin(a * 2 + 1), bend: -0.16, look: 1, lid: 0.38, lidLo: 0.15, brow: 1, smile: -0.8, jaw: 0.3, teeth: 1, fw: 0.5, jit: 0.12 });
    }
    case 'bump': { // crunch: the front spines fold, he squashes flat on the wall, bounces back with every spine twanging, then seethes
      const im = 1 - ss(0.05, 0.2, u), re = ss(0.1, 0.4, u), hop = Math.sin(re * Math.PI), dec = 1 - ss(0.25, 0.8, u), boing = Math.sin(t * 30) * dec * ss(0.12, 0.2, u), grr = ss(0.6, 0.75, u);
      return P({ by: HI - 5 * im + 9 * hop, dx: lerp(21, -10, re), sq: -0.24 * im, crumple: im, spin: -1.2 * ss(0.1, 0.5, u), rot: -0.25 * hop, sp0: 1 + 0.22 * boing, sp1: 1 - 0.22 * boing, squeeze: u < 0.45 ? 1 : 0, stars: u < 0.7 ? 3 : 0,
        brow: lerp(-0.6, 1, grr), jaw: lerp(0.7, 0.35, grr), teeth: grr, smile: -0.9, jit: 0.6 * grr, lid: 0.3 * grr, look: 1 });
    }
    case 'flipped': { // a hop and half a turn: he lands on his back and cannot get up. Feet waving, eyes wide, rocking
      const k = ss(0, 0.3, u), kb = back(k, 1.4), hop = Math.sin(k * Math.PI), on = ss(0.3, 0.45, u), rock = Math.sin(t * 5.2) * on;
      return P({ by: lerp(HI, 40, k) + 22 * hop, rot: Math.PI * kb + 0.22 * rock, dx: -8 * k + 3 * rock, sp0: lerp(1, 0.42, k), sp1: lerp(1, 0.35, k), sp2: lerp(1, 0.3, k), droop: 0.3 * on, lid: 0, pup: 0.6, brow: -1, look: Math.sin(t * 3.1) * on, looky: -0.3,
        jaw: 0.45 + 0.25 * Math.sin(t * 9), smile: -0.7, feet: 1 + 1.4 * on, fw: 0.2 + 0.7 * on, sweat: on, jit: 0.3 * on, wob: 0.3 * on });
    }
    case 'dizzy': { // a slow sway, spines at sixes and sevens, spiral eyes
      const w = Math.sin(t * 2.2), w2 = Math.sin(t * 2.2 - 0.8);
      return P({ by: 49 + 1.5 * Math.sin(t * 4.4), dx: 6 * w, rot: 0.2 * w, spin: 0.25 * w2, sp0: 0.7, sp1: 0.65, sp2: 0.6, wob: 1, droop: 0.4, spiral: 1, lid: 0, brow: -0.6, jaw: 0.4, tongue: 1, smile: -0.2, stars: 3, fw: 0.3 });
    }
    case 'laugh': { // a mean snicker: bouncing, spines chattering in and out
      const h = Math.abs(Math.sin(t * 9)), h2 = Math.sin(t * 9);
      return P({ by: HI + 4 * h, sq: 0.05 * h2, rot: -0.14 - 0.05 * h, fy: -1.5 * h, happy: 1, brow: 0.7, jaw: 0.65 + 0.35 * h, smile: 1, teeth: 1, sp0: 0.9 + 0.14 * h, sp1: 0.9 + 0.14 * (1 - h), jit: 0.4, spin: 0.06 * h2, fw: 0.4 });
    }
    case 'scared': { // every spine laid flat back, eyes like saucers, trembling
      const sh = Math.sin(t * 43);
      return P({ by: 34 + 0.5 * sh, dx: -3 + 0.9 * sh, rot: -0.14, sq: 0.05, flat: 1, sp0: 0.85, sp1: 0.75, sp2: 0.1, lid: 0, pup: 0.5, brow: -1, look: 0.7, jaw: 0.42 + 0.1 * sh, smile: -1, sweat: 1, feet: 1.2, fw: 0.6, swell: -0.04 });
    }
    case 'defeated': { // he strains for one last puff: every spine pops off and clatters down. Bald, blushing, one hair left
      const st = ss(0, 0.14, u) * (1 - ss(0.16, 0.19, u)), go = ss(0.17, 0.24, u), sh = ss(0.17, 0.62, u), dn = ss(0.2, 0.42, u), on = ss(0.5, 0.68, u), gl = Math.sin(t * 1.9), bo = Math.sin(ss(0.36, 0.6, u) * Math.PI);
      return P({ by: lerp(HI, LOW - 1.5, dn) + 6 * Math.sin(dn * Math.PI), swell: 0.13 * st, sq: 0.1 * bo + 0.03 * on, jit: st, sp2: 1 - go, shd: sh, hair: on, squeeze: st > 0.5 ? 1 : 0, lid: 0.12 * on, pup: lerp(1, 0.7, go), brow: lerp(1, -0.9, go),
        look: on * gl * 0.95, looky: 0.2 * on, blush: on, jaw: 0.55 * go * (1 - on), smile: lerp(-0.6, -0.35, on), feet: 1, fw: 0.15, teeth: st });
    }
    default: { // idle: stands on his spines, scowling about
      const gl = Math.sin(t * 0.9);
      return P({ by: HI + 0.8 * Math.sin(t * 2.2), spin: 0.05 * Math.sin(t * 1.1), look: 0.5 + 0.5 * gl, rot: 0.04 * gl, jit: 0.05 });
    }
  }
}

const MEM = {};
export function urchinBlend(id, pose, t, rate = 10) {
  let m = MEM[id];
  if (!m || t < m.t - 0.5 || t - m.t > 1) { m = MEM[id] = { t, p: { ...pose } }; return m.p; }
  const a = 1 - Math.exp(-(t - m.t) * rate);
  m.t = t;
  for (const k of KEYS) m.p[k] += (pose[k] - m.p[k]) * a;
  return m.p;
}

// ------------------------------------------------------------------ drawing kit
// MODE 0 paints; 1 and 2 lay the ice shell down first (every inked shape grown: the dark rim, then the pale ice)
let MODE = 0;
const ellP = (x, y, rx, ry, r = 0) => (c) => { c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), r, 0, TAU); };
const ink = (c, path, fill, line, lw) => {
  path(c);
  if (MODE) { c.lineWidth = (lw + (MODE === 1 ? SH : SH - RW)) * 2; c.strokeStyle = c.fillStyle = MODE === 1 ? RIM : SHELL; c.stroke(); c.fill(); return; }
  c.lineWidth = lw * 2; c.strokeStyle = line; c.stroke(); c.fillStyle = fill; c.fill();
};
const fillP = (c, path, fill) => { if (MODE) return; path(c); c.fillStyle = fill; c.fill(); };
// one spine from its root (bx, by): a is the way it grows, ad the way its tip points, L its length, w its half-width
function spine(c, bx, by, a, ad, L, w, droop, C, lw, tipCol) {
  const ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca;
  const tx = bx + Math.cos(ad) * L, ty = by + Math.sin(ad) * L + droop * L * 0.45, mx = bx + ca * L * 0.45, my = by + sa * L * 0.45 + droop * L * 0.08;
  const p0 = [bx + nx * w, by + ny * w], p1 = [bx - nx * w, by - ny * w], c0 = [mx + nx * w * 0.55, my + ny * w * 0.55], c1 = [mx - nx * w * 0.55, my - ny * w * 0.55];
  ink(c, (q) => { q.beginPath(); q.moveTo(p0[0], p0[1]); q.quadraticCurveTo(c0[0], c0[1], tx, ty); q.quadraticCurveTo(c1[0], c1[1], p1[0], p1[1]); q.closePath(); }, C.spineLo, C.line, lw);
  if (MODE || L < 7) return;
  // the lit core, toward the top-left light
  const k = 0.5, ox = -0.7, oy = -1.0;
  c.beginPath(); c.moveTo(bx + nx * w * k + ox, by + ny * w * k + oy); c.quadraticCurveTo(mx + nx * w * 0.3 + ox, my + ny * w * 0.3 + oy, lerp(mx, tx, 0.75), lerp(my, ty, 0.75)); c.quadraticCurveTo(mx - nx * w * 0.3 + ox, my - ny * w * 0.3 + oy, bx - nx * w * k + ox, by - ny * w * k + oy); c.closePath(); c.fillStyle = C.spine; c.fill();
  // the tip: hot pink when he is armed
  const s = 0.6, B = (a0, a1, a2) => (1 - s) * (1 - s) * a0 + 2 * (1 - s) * s * a1 + s * s * a2;
  c.beginPath(); c.moveTo(B(p0[0], c0[0], tx), B(p0[1], c0[1], ty)); c.lineTo(tx, ty); c.lineTo(B(p1[0], c1[0], tx), B(p1[1], c1[1], ty)); c.closePath(); c.fillStyle = tipCol; c.fill();
}
function bubbleShape(c, x, y, r, t, pop, C, lw) {
  if (MODE) return;
  if (pop > 0.01 && pop < 0.99) { // burst: a ring of drops flying out
    c.save(); c.lineCap = 'round'; c.globalAlpha *= 1 - pop * pop;
    for (const [w, col] of [[lw * 2.2, C.bubLine], [lw * 1.0, C.bubble]]) { c.lineWidth = w; c.strokeStyle = col; c.beginPath(); for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8 + 0.3, a0 = r * (0.9 + 1.1 * pop), a1 = a0 + r * 0.5 * (1 - pop * 0.5); c.moveTo(x + Math.cos(a) * a0, y + Math.sin(a) * a0); c.lineTo(x + Math.cos(a) * a1, y + Math.sin(a) * a1); } c.stroke(); }
    c.restore(); return;
  }
  if (r < 0.6 || pop >= 0.99) return;
  const wob = 1 + 0.05 * Math.sin(t * 7);
  c.save(); c.globalAlpha *= 0.62; ellP(x, y, r * wob, r / wob)(c); c.fillStyle = C.bubble; c.fill(); c.restore();
  ellP(x, y, r * wob, r / wob)(c); c.lineWidth = lw * 1.3; c.strokeStyle = C.bubLine; c.stroke();
  c.beginPath(); c.arc(x, y, r * 0.66, Math.PI * 1.08, Math.PI * 1.5); c.lineWidth = Math.max(lw * 0.9, r * 0.16); c.lineCap = 'round'; c.strokeStyle = '#ffffff'; c.stroke();
  fillP(c, ellP(x + r * 0.42, y + r * 0.4, r * 0.1, r * 0.1), '#ffffff');
}
// The sleep bubble on its own (it drifts off when he wakes, or as a pickup hint). (x, y) centre, r in px, o: { pop 0..1 }
export function drawUrchinBubble(ctx, x, y, r, t, o = {}) {
  if (!(r > 0)) return;
  ctx.save(); bubbleShape(ctx, x, y, r, t, o.pop || 0, PAL, Math.max(1.2, r * 0.09)); ctx.restore();
}

function eyeDraw(c, x, y, rx, ry, e, C, lw, t, dir) {
  if (e.spiral > 0.5) { ink(c, ellP(x, y, rx, ry), C.eyeW, C.line, lw * 0.8); if (!MODE) spiralEye(c, x, y, Math.min(rx, ry), t, dir, C.line); return; }
  if (e.happy > 0.5 || e.squeeze > 0.5) { // shut: the lid, with a sharp arc (happy) or a tight > < (squeeze)
    ink(c, ellP(x, y, rx, ry), C.lid, C.line, lw * 0.8); if (MODE) return;
    c.beginPath();
    if (e.squeeze > 0.5) { c.moveTo(x - rx * 0.62 * dir, y - ry * 0.48); c.lineTo(x + rx * 0.5 * dir, y); c.lineTo(x - rx * 0.62 * dir, y + ry * 0.48); }
    else { c.moveTo(x - rx * 0.72, y + ry * 0.28); c.quadraticCurveTo(x, y - ry * 0.85, x + rx * 0.72, y + ry * 0.28); }
    c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = lw * 1.5; c.strokeStyle = C.line; c.stroke();
    return;
  }
  ink(c, ellP(x, y, rx, ry), C.eyeW, C.line, lw * 0.8); if (MODE) return;
  const ir = Math.min(rx, ry) * 0.62 * clamp(e.pup, 0.4, 1.3), px = x + e.look * (rx - ir) * 0.95, py = y + e.looky * (ry - ir) * 0.95 + (ry - ir) * 0.15;
  fillP(c, ellP(px, py, ir, ir), C.iris); fillP(c, ellP(px, py + ir * 0.28, ir * 0.82, ir * 0.66), C.irisLo); fillP(c, ellP(px, py, ir * 0.56, ir * 0.56), C.pupil);
  fillP(c, ellP(px - ir * 0.36, py - ir * 0.4, ir * 0.3, ir * 0.3), '#ffffff');
  const lid = clamp(e.lid, 0, 1), lo = clamp(e.lidLo, 0, 1);
  c.save(); c.translate(x, y);
  if (lid > 0.02) { c.save(); c.rotate(e.mad * dir); const v = clamp(-1 + 2 * lid, -0.999, 0.999), a = Math.asin(v); c.beginPath(); c.ellipse(0, 0, rx + 0.3, ry + 0.3, 0, Math.PI - a, TAU + a); c.closePath(); c.fillStyle = C.lid; c.fill(); c.lineWidth = lw * 0.8; c.strokeStyle = C.line; c.stroke(); c.restore(); }
  if (lo > 0.02) { const v = clamp(1 - 1.2 * lo, -0.999, 0.999), a = Math.asin(v); c.beginPath(); c.ellipse(0, 0, rx + 0.3, ry + 0.3, 0, a, Math.PI - a); c.closePath(); c.fillStyle = C.lid; c.fill(); c.lineWidth = lw * 0.8; c.strokeStyle = C.line; c.stroke(); }
  c.restore();
}
const wrapA = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };

export function drawUrchin(ctx, x, y, s, t, pose, o = {}) {
  if (!(s > 0)) return;
  const p = pose, u = s / 100, frozen = o.frozen > 0, C = frozen ? ICED : PAL, lw = Math.max(2.3, 1.15 / u), face = o.face < 0 ? -1 : 1;
  const sy = 1 - p.sq, sx = 1 + p.sq * 0.7, cr = Math.cos(p.rot), sr = Math.sin(p.rot), R = R0 * (1 + p.swell), cx = p.dx, cy = -p.by;
  const shiver = frozen && o.frozen < 1 ? Math.sin(t * 70) * 0.6 * (1 - o.frozen) : 0;
  const toPx = (lx, ly) => ({ x: x + shiver + (cx + lx * cr - ly * sr) * sx * u * face, y: y + (cy + lx * sr + ly * cr) * sy * u });
  const e = { look: p.look, looky: p.looky, lid: Math.max(p.lid, frozen ? 0 : blinkAt(t, 11)), lidLo: p.lidLo, pup: p.pup, happy: p.happy, squeeze: p.squeeze, spiral: p.spiral, mad: 0 };
  let brow = p.brow;
  if (o.eye === 'spiral') e.spiral = 1; else if (o.eye === 'happy') e.happy = 1; else if (o.eye === 'squeeze') e.squeeze = 1; else if (o.eye === 'wide') { e.pup = 0.55; e.lid = 0; } else if (o.eye === 'lock') { e.pup = 1.25; e.look = 1; } else if (o.eye === 'angry') brow = 1;
  if (frozen && !o.eye) { e.pup = 0.6; e.lid = 0; e.happy = e.squeeze = 0; brow = -0.8; }
  e.mad = clamp(brow, 0, 1) * 0.34;
  const stars = o.stars != null ? o.stars : p.stars, armed = clamp((p.sp0 + p.sp1) / 2, 0, 1), tipCol = mixHex(C.tipDull, C.tip, ss(0.5, 0.95, armed));
  const paint = () => {
    ctx.save();
    ctx.translate(x + shiver, y); ctx.scale(u * face, u); ctx.scale(sx, sy);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // ---- spines: the short ring, then the long one. Shed ones tumble to the floor and lie there
    for (const ring of [2, 1, 0]) for (let i = 0, n = ring === 2 ? 2 * NS : NS; i < n; i++) {
      const j = ring * NS + i, a = p.spin + p.rot + (ring === 2 ? ((i + 0.5) * TAU) / n : (i * TAU) / n + (ring ? TAU / n / 2 : 0)), ext = ring === 2 ? p.sp2 : ring ? p.sp1 : p.sp0, L9 = ring === 2 ? L2 : ring ? L1 : L0;
      let L = STUB * (ring === 2 ? 0.6 : 1) + L9 * ext * (1 + p.wob * 0.45 * Math.sin(t * 3.1 + j * 1.9)) * (1 + p.jit * 0.12 * Math.sin(t * 47 + j * 2.3));
      L *= 1 - p.crumple * 0.78 * Math.pow(Math.max(0, Math.cos(a)), 1.5);
      const w = ring === 2 ? 4.4 : ring ? 5.8 : 6.8, bx = cx + Math.cos(a) * R * 0.86, by = cy + Math.sin(a) * R * 0.86;
      const ad = a + p.bend + p.flat * wrapA(Math.PI - a) * 0.8 + p.crumple * Math.max(0, Math.cos(a)) * Math.sin(a) * 0.9;
      if (p.shd > 0.001) {
        const q = clamp((p.shd - j * 0.008) / 0.75, 0, 1), h = hash(j + 3), side = j % 2 ? 1 : -1, ex = cx + side * (29 + 38 * h), ey = -2.6 - (j % 3) * 1.2, ea = side > 0 ? 0.06 : Math.PI - 0.06, qe = q * q * (3 - 2 * q);
        const px = lerp(bx, ex, qe) + Math.cos(a) * 26 * Math.sin(q * Math.PI), py = lerp(by, ey, q * q) + Math.sin(a) * 18 * Math.sin(q * Math.PI) - 16 * Math.sin(q * Math.PI), an = lerp(a, ea + (side > 0 ? TAU : -TAU) * (h > 0.5 ? 1 : 0), qe);
        spine(ctx, px, py, an, an, STUB + L9, w, 0, C, lw, mixHex(C.tip, C.tipDull, q));
      } else spine(ctx, bx, by, a, ad, L, w, p.droop, C, lw, tipCol);
    }
    // ---- tube feet: little suckered tubes under him
    if (p.feet > 0.05) for (let i = 0; i < 5; i++) {
      const a = p.rot + Math.PI / 2 + (i - 2) * 0.4 + p.fw * Math.sin(t * 7.3 + i * 1.7), len = (8 + 2.5 * (i % 2)) * p.feet, bx = cx + Math.cos(a) * R * 0.82, by = cy + Math.sin(a) * R * 0.82, a2 = a + p.fw * 0.6 * Math.sin(t * 7.3 + i * 1.7 + 1), tx = bx + Math.cos(a2) * len, ty = by + Math.sin(a2) * len;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty);
      if (MODE) { ctx.lineWidth = 4.4 + (lw + (MODE === 1 ? SH : SH - RW)) * 2; ctx.strokeStyle = MODE === 1 ? RIM : SHELL; ctx.stroke(); }
      else { ctx.lineWidth = 4.4 + lw * 2; ctx.strokeStyle = C.line; ctx.stroke(); ctx.lineWidth = 4.4; ctx.strokeStyle = C.footLo; ctx.stroke(); }
      ink(ctx, ellP(tx, ty, 3.4, 3.4), C.foot, C.line, lw * 0.9);
    }
    // ---- body: a ball, lit from the top-left
    ink(ctx, ellP(cx, cy, R, R), C.bodyLo, C.line, lw);
    fillP(ctx, ellP(cx - 1.6, cy - 2.2, R * 0.89, R * 0.88), C.body);
    fillP(ctx, ellP(cx - R * 0.5, cy - R * 0.56, R * 0.3, R * 0.17, -0.7), C.bodyHi);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(p.rot);
    if (p.shd > 0.3 && !MODE) { ctx.globalAlpha = ss(0.3, 0.6, p.shd); for (let i = 0; i < 9; i++) { const a = (i * TAU) / 9 + 0.2; fillP(ctx, ellP(Math.cos(a) * R * 0.8, Math.sin(a) * R * 0.8, 1.5, 1.5), C.bodyLo); } ctx.globalAlpha = 1; }
    // the last hair: one curly spine on top
    if (p.hair > 0.03) {
      const hs = p.hair, sw = Math.sin(t * 2.6) * 2.5, pts = [[-2, -R + 2], [-4, -R - 8 * hs], [2 + sw, -R - 14 * hs], [8 + sw * 1.6, -R - 9 * hs]];
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); ctx.bezierCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1], pts[3][0], pts[3][1]);
      if (MODE) { ctx.lineWidth = 3.4 + (lw + (MODE === 1 ? SH : SH - RW)) * 2; ctx.strokeStyle = MODE === 1 ? RIM : SHELL; ctx.stroke(); }
      else { ctx.lineWidth = 3.4 + lw * 2; ctx.strokeStyle = C.line; ctx.stroke(); ctx.lineWidth = 3.4; ctx.strokeStyle = C.spine; ctx.stroke(); }
    }
    // ---- face: two googly eyes, heavy lids, thick brows, a small cross mouth
    ctx.translate(4 + p.fx, -4 + p.fy);
    if (p.blush > 0.03 && !MODE) { ctx.globalAlpha = clamp(p.blush, 0, 1) * 0.9; fillP(ctx, ellP(-13, 8.5, 6, 3.6, -0.1), C.blush); fillP(ctx, ellP(18, 8, 3.4, 3.2, 0), C.blush); ctx.globalAlpha = 1; }
    eyeDraw(ctx, 14.2, -4.5, 8.4, 10.4, e, C, lw, t, -1);
    eyeDraw(ctx, -4.8, -5, 11.4, 11.8, e, C, lw, t, 1);
    if (!MODE) {
      const browS = (bx, by2, len, dir) => { ctx.save(); ctx.translate(bx, by2 + (brow > 0 ? brow * 4.2 : brow * 2)); ctx.rotate((brow > 0 ? brow * 0.42 : brow * 0.32) * dir); ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(len, 0); ctx.lineWidth = lw * 2.5; ctx.strokeStyle = C.line; ctx.stroke(); ctx.restore(); };
      browS(-5.5, -19.5, 9.5, 1); browS(14.6, -18, 6.6, -1);
      // mouth
      const mx = 6.5, my = 12.5, mw = 7.6, sm = p.smile, jw = p.jaw;
      const lx0 = mx - mw, rx0 = mx + mw * 0.85, cy0 = my - sm * 2.4, cu = my + sm * 3.4, cl = cu + jw * 15;
      if (jw < 0.07) { ctx.beginPath(); ctx.moveTo(lx0, cy0); ctx.quadraticCurveTo(mx, cu, rx0, cy0); ctx.lineWidth = lw * 1.1; ctx.strokeStyle = C.line; ctx.stroke(); }
      else {
        const mp = (c) => { c.beginPath(); c.moveTo(lx0, cy0); c.quadraticCurveTo(mx, cu, rx0, cy0); c.quadraticCurveTo(mx, cl, lx0, cy0); c.closePath(); };
        ink(ctx, mp, C.mouth, C.line, lw * 0.7);
        if (p.teeth > 0.5) { ctx.beginPath(); ctx.moveTo(lx0 + 1.4, cy0 + 0.5); ctx.quadraticCurveTo(mx, cu + 0.5, rx0 - 1.4, cy0 + 0.5); ctx.quadraticCurveTo(mx, cu + 0.5 + Math.min(6, jw * 9), lx0 + 1.4, cy0 + 0.5); ctx.fillStyle = C.tooth; ctx.fill(); }
        else if (jw > 0.3) fillP(ctx, ellP(mx, (cy0 + cl) / 2 + jw * 1.5, mw * 0.5, jw * 2.4), C.tongue);
      }
      if (p.tongue > 0.03) { ctx.beginPath(); ctx.moveTo(mx + 1, my + 2); ctx.lineTo(mx + 3, my + 2 + 7.5 * p.tongue); ctx.lineWidth = 5 + lw * 1.2; ctx.strokeStyle = C.line; ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = C.tongue; ctx.stroke(); }
      // the sleep bubble at the corner of his mouth, and its pop
      const br = 13 * p.bub;
      if (p.bub > 0.03 && !frozen) bubbleShape(ctx, 15 + br * 0.85, 11 - br * 0.45, br, t, 0, C, lw * 0.8);
      if (p.pop > 0.01) bubbleShape(ctx, 26, 5, 13, t, p.pop, C, lw * 0.8);
      if (p.sweat > 0.05) for (let i = 0; i < 3; i++) { const f = fract(t * 1.7 + i / 3), an = -2.3 + i * 0.5, r0 = 26 + f * 16; ctx.save(); ctx.translate(Math.cos(an) * r0, -6 + Math.sin(an) * r0 + f * f * 8); ctx.rotate(an + Math.PI / 2); ctx.globalAlpha = p.sweat * (1 - f * f); ink(ctx, (c) => { c.beginPath(); c.moveTo(0, -5); c.quadraticCurveTo(3.4, 0, 0, 3); c.quadraticCurveTo(-3.4, 0, 0, -5); c.closePath(); }, C.sweat, C.line, lw * 0.6); ctx.restore(); }
    }
    ctx.restore();
    if (!MODE) {
      const topY = cy - R - 12 - L0 * 0.8 * clamp(p.sp0, 0, 1) * (1 - clamp(p.shd * 3, 0, 1));
      if (p.zz > 0.05 && !frozen) for (let i = 0; i < 2; i++) { ctx.save(); ctx.globalAlpha = p.zz; zed(ctx, cx - 20 - i * 3, cy - R - 2, 4.6, fract(t * 0.45 + i * 0.5), C.line, '#e8f4ff'); ctx.restore(); }
      if (stars > 0) dizzyStars(ctx, cx, topY, 26, 7, t, { n: Math.round(stars), layer: 'all', size: Math.max(6, 3.4 / u) });
      if (p.ting > 0.05) { // shing: a glint on the tips as a ring locks out
        ctx.fillStyle = C.glint; ctx.strokeStyle = C.line; ctx.lineWidth = lw * 0.6;
        for (let i = 0; i < 4; i++) { const a = p.spin + ((i * 2 - 2) * TAU) / NS, rr = R * 0.86 + STUB + L0 * clamp(p.sp0, 0, 1) + 6, gx = cx + Math.cos(a) * rr, gy = cy + Math.sin(a) * rr, k = p.ting * (i % 2 ? 0.7 : 1); ctx.beginPath(); for (let q = 0; q < 8; q++) { const r = (q % 2 ? 1.8 : 7.5) * k, b = (q * Math.PI) / 4; ctx.lineTo(gx + Math.cos(b) * r, gy + Math.sin(b) * r); } ctx.closePath(); ctx.stroke(); ctx.fill(); }
      }
    }
    ctx.restore();
  };
  if (frozen) { MODE = 1; try { paint(); MODE = 2; paint(); } finally { MODE = 0; } }
  paint();
  if (frozen) { // glints on the shell
    const g = (lx, ly, k) => { const q = toPx(lx, ly); ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(-0.6); ctx.lineCap = 'round'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1.2, 2.6 * u); ctx.beginPath(); ctx.moveTo(-6 * u * k, 0); ctx.lineTo(6 * u * k, 0); ctx.moveTo(-3 * u * k, 5 * u); ctx.lineTo(2 * u * k, 5 * u); ctx.stroke(); ctx.restore(); };
    g(-R * 0.75, -R * 0.2, 1.2);
    const tw = toPx(R * 0.9, -R * 1.1), k = 0.6 + 0.4 * Math.sin(t * 4); ctx.save(); ctx.translate(tw.x, tw.y); ctx.fillStyle = '#ffffff'; ctx.beginPath(); for (let i = 0; i < 8; i++) { const r = (i % 2 ? 1.6 : 7 * k) * u, a = (i * Math.PI) / 4; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.restore();
  }
  if (o.out) {
    o.out.eye = toPx(8 + p.fx, -9 + p.fy); o.out.mouth = toPx(10.5 + p.fx, 8.5 + p.fy); o.out.centre = toPx(0, 0); o.out.top = { x: x + cx * sx * u * face, y: y + (cy - R - STUB - L0 * clamp(p.sp0, 0, 1)) * sy * u };
    o.out.R = R * u; o.out.spikeR = p.shd > 0.2 ? R * u : (R * 0.86 + STUB + L0 * clamp(p.sp0, 0, 1.2)) * u;
  }
}
