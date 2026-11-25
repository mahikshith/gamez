// Bandit the Raccoon (the Farm's night raider): a chunky grey raccoon with a black mask, a ringed tail and a patched loot
// sack. Crisp cel-shaded code art in the thieves' house style: a dark outline only, two-tone fur with a back highlight,
// big eyes with lids and brows. He stands upright, seen three-quarter from the side.
//
// drawRaccoon(ctx, x, y, s, t, pose, o) draws him in a local y-DOWN pixel space:
//   (x, y)  the floor point between his feet; he faces +x (o.face -1 mirrors). s = px per 100 rig units; he stands
//           about 116 units tall (RACCOON_M metres per 100 units puts him near 1.2 m).
//   pose    from raccoonPose(state, t, u, opt): plain numbers, so poses blend (raccoonBlend)
//   o       { face, frozen (icy colours), stars 0..3 (overrides the pose), eye: 'normal' | 'lock' | 'wide' | 'squeeze' |
//             'spiral' | 'happy' | 'angry', egg: false (do not draw the stand-in egg he hugs: draw your own at out.hold),
//             out: {} receives paw, mouth, head, hold {x, y} and holdR in the same px space }
// raccoonPose states: idle (rubbing paws), sneak (tiptoe; u > 0 = the gait phase in cycles, else it runs on t), peek
// (u: eyes lock, then the lip lick), reach (u: wind-up, the arm shoots out, groping; opt.to = [x, y] the paw's target in
// rig units, default [88, -24]), grab (u: the yank home, the hug, then glee), pinched (u: the jolt with the paw still
// stuck at opt.to, the yank, then hopping about shaking a red paw), dizzy (u: the sack slips over his head), whistle (u:
// breath in, the blow, panting), laugh, defeated (u: the tumble into the sack, then legs kicking).
import { spline, blinkAt, hash, clamp, lerp, ss, back, ik } from './castkit.js';
import { dizzyStars, spiralEye } from './status.js';

const TAU = Math.PI * 2;
export const RACCOON_M = 1.05; // metres per 100 rig units
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixHex = (a, b, k) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
const PAL = {
  line: '#221622', fur: '#9494aa', furLo: '#6f6c88', furHi: '#b9bacd', cream: '#f1ece2', creamLo: '#cfc6c4', mask: '#3b3548', maskHi: '#575068',
  paw: '#40394e', pawHi: '#5d5570', nose: '#1a1118', earIn: '#e59a9a', eyeW: '#fffdf4', iris: '#8a4a12', irisHi: '#e09a2a', pupil: '#150a06',
  mouth: '#5a1420', tongue: '#f0707c', tooth: '#ffffff', ringD: '#3b3548', ringL: '#c2c3d4',
  sack: '#c99c58', sackLo: '#9d7436', sackHi: '#e2c080', rope: '#6e4a22', patchA: '#c2553a', patchB: '#5f8f6a', stitch: '#3a2410',
  egg: '#fff1d6', eggLo: '#e6c9a0', hurt: '#ef4634', hurtHi: '#ff8a70', note: '#ffe680', sweat: '#8fd4ff',
};
const ICED = {};
for (const c in PAL) ICED[c] = mixHex(PAL[c], '#bfe6ff', 0.55);

// ------------------------------------------------------------------ poses
// by: torso centre height; dx: shift; rot: lean (+ = toward +x); sq: squash (- = stretch); hx, hy, hr, hsc: the head in the
// torso's frame; a0 / a1: near / far paw, f0 / f1: near / far foot (torso frame); look, looky: pupils -1..1; lid, lidLo:
// 0 open .. 1 shut; brow -1 sad .. 1 fierce; pup: pupil size; happy / squeeze / spiral: eye styles (> 0.5); jaw, smile,
// teeth, pucker, tongue (ta: its angle), cheek: puffed; ear 0 up .. 1 flat; tail: base angle (+ up), tc: curl, tw: wave,
// puff; sk*: the sack (x, y, rotation, size, o: open, f: in front, strap); egg: the hugged egg (ex, ey); throb: the red
// paw; hand: 0 mitt, 1 pointing, 2 two fingers (whistle); note: whistle sound; stars; sweat
const REST = { by: 36, dx: 0, rot: 0, sq: 0, hx: 5, hy: -42, hr: 0, hsc: 1, a0x: -15, a0y: 10, a1x: 23, a1y: 9, f0x: -8, f0y: 33, f1x: 10, f1y: 33,
  look: 0.3, looky: 0, lid: 0.12, lidLo: 0, brow: 0.2, pup: 1, happy: 0, squeeze: 0, spiral: 0, jaw: 0, smile: 0.6, teeth: 0, pucker: 0, tongue: 0, ta: 0.8, cheek: 0,
  ear: 0, tail: 0.15, tc: 1.0, tw: 0, puff: 0, skx: -25, sky: -9, skr: -0.32, sks: 1, sko: 0, skf: 0, strap: 1, egg: 0, ex: 16, ey: 2, throb: 0, hand: 0, note: 0, stars: 0, sweat: 0 };
const KEYS = Object.keys(REST);
// world targets (rig units, floor at y = 0) into the torso's frame
function fin(p, w) {
  const c = Math.cos(-p.rot), s = Math.sin(-p.rot), sy = 1 - p.sq, sx = 1 + p.sq * 0.7;
  for (const k in w) { const X = w[k][0] / sx - p.dx, Y = w[k][1] / sy + p.by; p[k + 'x'] = X * c - Y * s; p[k + 'y'] = X * s + Y * c; }
  return p;
}
const P = (o) => Object.assign({}, REST, o);
const fract = (x) => x - Math.floor(x);
export function raccoonPose(state, t, u = 0, opt = {}) {
  const to = opt.to || [88, -24], br = Math.sin(t * 2.6);
  switch (state) {
    case 'sneak': { // tiptoe: high knees, hunched, paws held up limp, eyes shifting, the sack bouncing a beat behind
      const ph = u > 0 ? u : t * 1.25, L = 17, st = (off, x0) => { const q = fract(ph + off); return q < 0.45 ? [x0 - L / 2 + ss(0, 1, q / 0.45) * L, -Math.sin((q / 0.45) * Math.PI) * 15] : [x0 + L / 2 - ((q - 0.45) / 0.55) * L, 0]; };
      const bob = Math.cos(ph * TAU * 2), lag = Math.cos(ph * TAU * 2 - 1.1);
      return fin(P({ by: 32.5 + 1.8 * bob, rot: 0.2, hx: 11, hy: -40 - bob, hr: -0.2 + 0.03 * lag, a0x: 15, a0y: -12 + 2.5 * lag, a1x: 27, a1y: -15 - 2.5 * lag, look: Math.sin(t * 1.7) * 0.9, lid: 0.3, brow: 0.7, smile: 0.25,
        ear: -0.2 + 0.2 * Math.max(0, Math.sin(t * 3.1)), tail: 0.25, tc: 0.5, tw: Math.sin(ph * TAU) * 0.5, sky: -9 + 2.6 * lag, skr: -0.36 + 0.06 * lag }), { f0: [...st(0, -8)].map((v, i) => (i ? v - 3 : v)), f1: [...st(0.5, 10)].map((v, i) => (i ? v - 3 : v)) });
    }
    case 'peek': { // stops dead, leans in, the eyes lock and widen; then a slow greedy lick right round the lips
      const e = back(ss(0, 0.22, u)), k = ss(0.36, 0.92, u), tg = ss(0, 0.12, k) * (1 - ss(0.86, 1, k)), rub = Math.sin(t * 16) * tg;
      return fin(P({ by: 34 - 2 * e + 0.5 * br, rot: 0.2 * e, hx: 5 + 8 * e, hy: -42 + e, hr: -0.14 * e + 0.05 * Math.sin(k * TAU), look: 1, looky: 0.15, lid: lerp(0, 0.34, ss(0.3, 0.45, u)), lidLo: 0.2 * tg, brow: 0.5 + 0.4 * tg, pup: 1 + 0.38 * e - 0.1 * tg,
        tongue: tg * 1.4, ta: Math.PI * 0.9 + k * Math.PI * 1.25, smile: 0.9, jaw: 0.12 * tg, ear: -0.45 * e, a0x: 17 + 2 * rub, a0y: -9 - 1.5 * rub, a1x: 23 - 2 * rub, a1y: -8 + 1.5 * rub, tail: 0.15 + 0.3 * e, tc: 1.0, tw: Math.sin(t * 9) * 0.5 * (0.3 + tg) }), { f0: [-9, -3], f1: [12, -3] });
    }
    case 'reach': { // wind-up (back and low), the arm shoots through with an overshoot, then he gropes about blind, tongue out
      const a = ss(0, 0.2, u) * (1 - ss(0.2, 0.3, u)), sh = back(ss(0.22, 0.4, u), 2.4), g = ss(0.42, 0.55, u), gx = Math.sin(t * 9) * 5 * g, gy = Math.sin(t * 13) * 9 * g;
      const p = P({ by: 35 - 6 * a - 2 * sh, dx: -10 * a + 12 * sh, rot: -0.3 * a + 0.36 * sh, sq: 0.13 * a - 0.05 * sh * (1 - g), hx: 5 + 2 * sh, hy: -42, hr: 0.1 * a - 0.5 * sh + 0.04 * Math.sin(t * 6.3) * g, look: lerp(0.9, -0.5, sh), looky: -0.7 * sh, lid: 0.1 + 0.2 * g, lidLo: 0.3 * g,
        brow: 0.8, tongue: sh, ta: 0.75 + 0.25 * Math.sin(t * 6.3) * g, smile: 0.3, ear: 0.3 * a - 0.2 * sh, tail: 0.15 + 1.0 * sh, tc: 1.0 - 0.8 * sh, tw: Math.sin(t * 8) * 0.25 * g, a1x: 22 + 3 * sh, a1y: 2 - 14 * sh, sky: -9 - 3 * sh, skr: -0.32 - 0.2 * sh });
      fin(p, { f0: [-10 - 8 * sh, -3 - 9 * sh + 2 * Math.sin(t * 6.3) * g], f1: [14, -3] });
      const w = fin({ ...p }, { a0: [to[0] + gx, to[1] + gy] });
      p.a0x = lerp(lerp(-15, -34, a), w.a0x, clamp(sh, 0, 1.08)); p.a0y = lerp(lerp(10, -14, a), w.a0y, clamp(sh, 0, 1.08));
      return p;
    }
    case 'grab': { // yanks the egg home, squashes round it, then bounces with it, cheek to shell
      const k = ss(0, 0.28, u), hug = back(ss(0.24, 0.42, u)), gl = ss(0.42, 0.55, u), h = Math.abs(Math.sin(t * 7.5)) * gl;
      const p = P({ by: 36 - 5 * Math.sin(ss(0.2, 0.45, u) * Math.PI) + 5 * h, dx: 10 * (1 - k), rot: lerp(0.34, -0.1, k) + 0.05 * Math.sin(t * 7.5) * gl, sq: 0.1 * Math.sin(ss(0.2, 0.45, u) * Math.PI) - 0.05 * h, hx: 6, hy: -42, hr: lerp(-0.3, 0.3, hug), look: 0.8, looky: 0.6,
        lid: 0.15, happy: gl, smile: 1, jaw: 0.25 + 0.4 * gl, teeth: gl, brow: 0.1, ear: -0.2 * gl, tail: 0.35, tc: 1.0, tw: Math.sin(t * 15) * (0.2 + 0.7 * gl), egg: 1, sky: -9 - 4 * h, a1x: 30, a1y: -9 });
      fin(p, { f0: [-9, -3 - 5 * h], f1: [11, -3 - 5 * h] });
      const far = fin({ ...p, rot: 0.34, dx: 10 }, { e: to }); // where the egg was
      p.ex = lerp(far.ex, 23, k); p.ey = lerp(far.ey, 0, k) - 4 * Math.sin(k * Math.PI);
      p.a0x = p.ex + lerp(-2, 9, hug); p.a0y = p.ey + lerp(4, 13, hug); p.a1x = p.ex + 10; p.a1y = p.ey - 12 * hug;
      return p;
    }
    case 'pinched': { // the jolt: rigid, eyes popping, fur on end, the paw still caught; then free and hopping on one foot
      const fr = ss(0.16, 0.3, u), sh = Math.sin(t * 60) * (1 - fr), hop = Math.abs(Math.sin(t * 8.5)) * fr, wag = Math.sin(t * 27) * fr, cry = ss(0.3, 0.42, u);
      const p = P({ by: 36 + 2 * (1 - fr) + 9 * hop, dx: lerp(8, Math.sin(t * 4.25) * 9, fr) + sh, rot: lerp(0.18, -0.12 + 0.1 * Math.sin(t * 4.25), fr), sq: lerp(-0.13, 0.06 - 0.12 * hop, fr), hx: 5, hy: -43, hr: lerp(-0.25, -0.12 + 0.12 * Math.sin(t * 8.5), fr), hsc: 1 + 0.08 * (1 - fr),
        look: lerp(0.9, 0.7, fr), looky: lerp(0, 0.5, fr), lid: 0, pup: lerp(0.45, 1, cry), squeeze: cry * (Math.sin(t * 4.25 + 1) > -0.55 ? 1 : 0), brow: -0.9, jaw: lerp(1, 0.55 + 0.35 * Math.abs(Math.sin(t * 8.5)), fr), smile: -0.8, teeth: 1, ear: 1, tail: 1.35, tc: lerp(0.1, 0.7, fr), tw: Math.sin(t * 30) * 0.3, puff: 1 - 0.5 * fr,
        throb: 1, sweat: 1, a1x: 21, a1y: -6, sky: -9 - 6 * hop, skr: -0.32 - 0.25 * hop });
      fin(p, { f0: [-9 + 3 * fr, -3 - 15 * fr - 3 * hop], f1: [11, -3 - 9 * hop * 1.0] });
      const w = fin({ ...p }, { a0: to });
      p.a0x = lerp(w.a0x, 27 + 5 * wag, fr); p.a0y = lerp(w.a0y, -22 + 6 * Math.cos(t * 27), fr);
      return p;
    }
    case 'dizzy': { // legs gone to jelly, a slow sway, spiral eyes, the sack creeping over his head like a hat that is too big
      const w = Math.sin(t * 2.3), w2 = Math.sin(t * 2.3 - 0.7), s = 0.25 + 0.75 * clamp(u, 0, 1), dn = ss(0.45, 1, s);
      const p = P({ by: 33 + 1.2 * Math.sin(t * 4.6), dx: 6 * w, rot: 0.13 * w, hx: 5 + 2 * w2, hy: -41, hr: 0.22 * w2, spiral: 1, lid: 0, brow: -0.7, jaw: 0.35, smile: -0.3, tongue: 1, ta: 1.3 + 0.3 * w2, ear: 0.8, tail: 0.1, tc: 0.2, tw: w2 * 0.3,
        a0x: -19 - 4 * w2, a0y: 8, a1x: 27 - 4 * w2, a1y: 7, stars: 3, skf: 1, sko: 1, strap: 0, sks: 1.22 });
      fin(p, { f0: [-13, -3], f1: [15, -3] });
      p.skx = p.hx - 2 + 5 * w2 * (1 - dn); p.sky = p.hy + lerp(-36, -12, dn) + 1.5 * Math.sin(t * 4.6); p.skr = Math.PI + p.hr + lerp(-0.5, 0, dn) + 0.1 * w2;
      return p;
    }
    case 'whistle': { // a big breath (chest up, head back), two fingers in, then he doubles forward and blows, cheeks out
      const inn = ss(0, 0.2, u) * (1 - ss(0.24, 0.32, u)), bl = back(ss(0.26, 0.36, u)) * (1 - ss(0.8, 0.92, u)), pant = ss(0.88, 1, u), sh = Math.sin(t * 45) * 0.6 * clamp(bl, 0, 1);
      const p = P({ by: 36 + 2 * inn - 2 * bl, dx: sh, rot: -0.2 * inn + 0.22 * bl, sq: -0.08 * inn + 0.05 * bl + 0.03 * pant * Math.sin(t * 9), hx: 5 + 3 * bl, hy: -42 - 2 * inn, hr: -0.3 * inn + 0.12 * bl, cheek: clamp(bl, 0, 1.1), squeeze: bl > 0.5 ? 1 : 0, pucker: ss(0.1, 0.25, u) * (1 - pant), lid: 0.2, brow: 0.6,
        look: 0.8, ear: 0.6 * bl, tail: 0.15 + 1.0 * bl, tc: 1.0 - 0.7 * bl, puff: 0.5 * bl, note: clamp(bl, 0, 1), hand: 2 * (1 - pant), jaw: 0.5 * pant, tongue: pant, ta: 1.2, a1x: 24, a1y: 3, smile: 0.3 });
      fin(p, { f0: [-10, -3], f1: [13, -3] });
      const k = ss(0.05, 0.22, u) * (1 - pant); // the paw to the mouth
      p.a0x = lerp(-15, p.hx + 20, k); p.a0y = lerp(10, p.hy + 16, k);
      return p;
    }
    case 'laugh': { // head thrown back, pointing, the other paw on a shaking belly, one foot stamping
      const h = Math.abs(Math.sin(t * 9)), h2 = Math.sin(t * 9);
      return fin(P({ by: 35 + 2.5 * h, rot: -0.2 - 0.04 * h, sq: 0.05 * h2, hx: 4, hy: -42 - h, hr: -0.32 - 0.1 * h, happy: 1, jaw: 0.7 + 0.3 * h, smile: 1, teeth: 1, brow: 0.3, ear: 0.2, a0x: 33, a0y: -17 + 3 * h, hand: 1, a1x: 17, a1y: 6 + 2 * h,
        tail: 0.25, tc: 1.0, tw: Math.sin(t * 9) * 0.7, sky: -9 - 3 * h }), { f0: [-9, -3], f1: [13, -3 - 6 * Math.max(0, Math.sin(t * 9 + 1.2))] });
    }
    case 'defeated': { // a forward tumble, head first into his own sack; then only legs, tail and a wobbling sack
      const k = ss(0, 0.5, u), kb = back(k, 1.2), kick = ss(0.45, 0.6, u), w = Math.sin(t * 5) * kick;
      const p = P({ rot: Math.PI * kb + 0.1 * w, by: lerp(36, 80, k) + 10 * Math.sin(k * Math.PI), dx: 12 * k + 2 * w, sq: 0.05 * Math.sin(t * 10) * kick, hr: -0.2 * Math.sin(k * Math.PI), lid: 0, pup: 0.6, jaw: 0.8 * (1 - k), smile: -0.5, brow: -0.8, ear: 0.7,
        a0x: lerp(-15, 6, k), a0y: lerp(10, -30, k), a1x: lerp(23, 14, k), a1y: lerp(9, -30, k), f0x: -9 + 12 * Math.sin(t * 10) * kick, f0y: 35 - 8 * Math.abs(Math.cos(t * 10)) * kick, f1x: 11 - 12 * Math.sin(t * 10) * kick, f1y: 35 - 8 * Math.abs(Math.sin(t * 10)) * kick,
        tail: lerp(0.15, 0.5 + 0.5 * Math.sin(t * 5 + 1), k), tc: lerp(0.9, 0.4, k), tw: Math.sin(t * 10) * 0.5 * kick, puff: 0.4 * kick, skf: 1, sko: ss(0.05, 0.3, u), strap: 0, sks: lerp(1, 1.75, ss(0.05, 0.4, u)) });
      const q = fin({ ...p }, { sk: [lerp(-25, 7, ss(0.02, 0.35, u)) + 1.5 * w, lerp(-45, -34, ss(0.02, 0.35, u))] });
      p.skx = q.skx; p.sky = q.sky; p.skr = lerp(-0.32, -p.rot + 0.07 * Math.sin(t * 10 + 1) * kick, ss(0.02, 0.3, u));
      return p;
    }
    default: { // idle: rubbing his paws, eyes wandering over the loot, tail swishing
      const c = Math.cos(t * 6.5), s = Math.sin(t * 6.5), gl = Math.sin(t * 0.7);
      return fin(P({ by: 36 + 0.7 * br, sq: 0.012 * br, rot: 0.05 + 0.02 * gl, hx: 5 + 1.5 * gl, hr: 0.06 * gl, look: 0.5 + 0.5 * gl, lid: 0.22, brow: 0.5, smile: 0.9, a0x: 17 + 2.6 * c, a0y: -6 + 2.6 * s, a1x: 22 - 2.6 * c, a1y: -5 - 2.6 * s,
        ear: -0.1 + 0.5 * twitch(t), tail: 0.12 + 0.1 * Math.sin(t * 1.6), tc: 1.0, tw: Math.sin(t * 2.4) * 0.6, sky: -9 - 0.8 * br }), { f0: [-8, -3], f1: [10, -3] });
    }
  }
}
function twitch(t) { const k = Math.floor(t / 2.1), f = fract(t / 2.1); return hash(k) > 0.4 ? Math.sin(clamp((f - 0.3) / 0.09, 0, 1) * Math.PI) : 0; }

const MEM = {};
export function raccoonBlend(id, pose, t, rate = 10) {
  let m = MEM[id];
  if (!m || t < m.t - 0.5 || t - m.t > 1) { m = MEM[id] = { t, p: { ...pose } }; return m.p; }
  const a = 1 - Math.exp(-(t - m.t) * rate);
  m.t = t;
  for (const k of KEYS) m.p[k] += (pose[k] - m.p[k]) * a;
  return m.p;
}

// ------------------------------------------------------------------ drawing kit
const blobP = (pts) => (c) => { c.beginPath(); spline(c, pts, true); };
const ellP = (x, y, rx, ry, r = 0) => (c) => { c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), r, 0, TAU); };
const ink = (c, path, fill, line, lw) => { path(c); c.lineWidth = lw * 2; c.strokeStyle = line; c.stroke(); c.fillStyle = fill; c.fill(); };
const fillP = (c, path, fill) => { path(c); c.fillStyle = fill; c.fill(); };
// the lit part of a blob: the same shape pulled in and pushed toward the light (top-left), so it never leaves the outline
const inset = (pts, k, ox, oy) => { let cx = 0, cy = 0; for (const q of pts) { cx += q[0]; cy += q[1]; } cx /= pts.length; cy /= pts.length; return pts.map((q) => [cx + (q[0] - cx) * k + ox, cy + (q[1] - cy) * k + oy]); };
function hose(c, pts, w, col, line, lw) {
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); spline(c, pts, false); c.lineWidth = w + lw * 2; c.strokeStyle = line; c.stroke(); c.lineWidth = w; c.strokeStyle = col; c.stroke();
}

// the sack in its own frame (centre 0,0; the neck at the top): open 0 = tied shut, 1 = gaping
function sackShape(c, C, lw, open, t) {
  const n = lerp(5, 17, open), body = [[0, 20], [13, 17], [19, 6], [17, -7], [n + 1, -15], [-n - 1, -15], [-17, -7], [-19, 6], [-13, 17]];
  const top = open > 0.5 ? [[-n - 2, -15], [-n - 3, -21], [-n * 0.4, -19], [0, -22], [n * 0.4, -19], [n + 3, -21], [n + 2, -15], [0, -12]] : [[-6, -15], [-11, -25], [-3, -22], [2, -27], [6, -22], [12, -24], [6, -15]];
  ink(c, blobP(top), C.sackLo, C.line, lw);
  ink(c, blobP(body), C.sackLo, C.line, lw);
  fillP(c, blobP(inset(body, 0.84, -1.5, -2)), C.sack);
  fillP(c, ellP(-8, -4, 5, 8, 0.35), C.sackHi);
  // patches and stitches
  c.save(); c.translate(5, 5); c.rotate(0.25); c.fillStyle = C.patchA; c.strokeStyle = C.stitch; c.lineWidth = lw * 0.55; c.beginPath(); c.rect(-5.5, -5, 11, 10); c.fill(); c.stroke();
  c.beginPath(); for (const [a, b] of [[-7.5, -2], [-7.5, 3], [7.5, -2], [7.5, 3]]) { c.moveTo(a - 1.6, b); c.lineTo(a + 1.6, b); } c.stroke(); c.restore();
  c.save(); c.translate(-9, 10); c.rotate(-0.4); c.fillStyle = C.patchB; c.beginPath(); c.rect(-3.5, -3, 7, 6); c.fill(); c.lineWidth = lw * 0.5; c.strokeStyle = C.stitch; c.stroke(); c.restore();
  if (open <= 0.5) { c.beginPath(); c.moveTo(-7, -15.5); c.quadraticCurveTo(0, -13.5, 7, -15.5); c.lineCap = 'round'; c.lineWidth = lw * 2.2; c.strokeStyle = C.line; c.stroke(); c.lineWidth = lw * 1.1; c.strokeStyle = C.rope; c.stroke(); }
}
// the loot sack as a prop standing on the floor at (x, y). o: { rot, open 0..1, squash, frozen }
export function drawSack(ctx, x, y, s, t, o = {}) {
  if (!(s > 0)) return;
  const u = s / 100, C = o.frozen > 0 ? ICED : PAL, lw = Math.max(2.3, 1.15 / u), q = o.squash || 0;
  ctx.save(); ctx.translate(x, y); ctx.scale(u * (1 + q * 0.6), u * (1 - q)); ctx.rotate(o.rot || 0); ctx.translate(0, -20); ctx.lineJoin = 'round';
  sackShape(ctx, C, lw, o.open || 0, t);
  ctx.restore();
}

function eyeDraw(c, x, y, rx, ry, e, C, lw, t, dir) {
  if (e.spiral > 0.5) { ink(c, ellP(x, y, rx, ry), C.eyeW, C.line, lw * 0.7); spiralEye(c, x, y, Math.min(rx, ry), t, dir, C.line); return; }
  if (e.happy > 0.5 || e.squeeze > 0.5) { // shut: a pale arc on the dark mask (happy), or a tight > < (squeeze)
    c.beginPath();
    if (e.squeeze > 0.5) { c.moveTo(x - rx * 0.75 * dir, y - ry * 0.55); c.lineTo(x + rx * 0.5 * dir, y); c.lineTo(x - rx * 0.75 * dir, y + ry * 0.55); }
    else { c.moveTo(x - rx * 0.9, y + ry * 0.3); c.quadraticCurveTo(x, y - ry * 1.05, x + rx * 0.9, y + ry * 0.3); }
    c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = lw * 2.5; c.strokeStyle = C.line; c.stroke(); c.lineWidth = lw * 1.25; c.strokeStyle = C.cream; c.stroke();
    return;
  }
  if (e.lid > 0.9) { // shut: the lid itself, with a lash line (it tilts with the brow)
    ink(c, ellP(x, y, rx, ry), C.maskHi, C.line, lw * 0.7); c.beginPath(); c.moveTo(x - rx * 0.85, y + ry * (0.25 - 0.35 * e.mad * dir)); c.quadraticCurveTo(x, y + ry * 0.75, x + rx * 0.85, y + ry * (0.25 + 0.35 * e.mad * dir)); c.lineCap = 'round'; c.lineWidth = lw * 1.1; c.strokeStyle = C.cream; c.stroke(); return;
  }
  const g = 1 + 0.12 * clamp(1.1 - e.pup, 0, 1); rx *= g; ry *= g;
  ink(c, ellP(x, y, rx, ry), C.eyeW, C.line, lw * 0.7);
  const ir = Math.min(rx, ry) * 0.66 * clamp(e.pup, 0.4, 1.3), px = x + e.look * (rx - ir) * 0.95, py = y + e.looky * (ry - ir) * 0.95 + (ry - ir) * 0.12;
  fillP(c, ellP(px, py, ir, ir), C.iris); fillP(c, ellP(px, py + ir * 0.25, ir * 0.8, ir * 0.7), C.irisHi); fillP(c, ellP(px, py, ir * 0.58, ir * 0.58), C.pupil);
  fillP(c, ellP(px - ir * 0.36, py - ir * 0.4, ir * 0.3, ir * 0.3), '#ffffff'); fillP(c, ellP(px + ir * 0.34, py + ir * 0.36, ir * 0.13, ir * 0.13), '#ffffff');
  const lid = clamp(e.lid, 0, 1), lo = clamp(e.lidLo, 0, 1);
  c.save(); c.translate(x, y);
  if (lid > 0.02) { c.save(); c.rotate(e.mad * dir); const v = clamp(-1 + 2 * lid, -0.999, 0.999), a = Math.asin(v); c.beginPath(); c.ellipse(0, 0, rx + 0.3, ry + 0.3, 0, Math.PI - a, TAU + a); c.closePath(); c.fillStyle = C.maskHi; c.fill(); c.lineWidth = lw * 0.7; c.strokeStyle = C.line; c.stroke(); c.restore(); }
  if (lo > 0.02) { const v = clamp(1 - 1.2 * lo, -0.999, 0.999), a = Math.asin(v); c.beginPath(); c.ellipse(0, 0, rx + 0.3, ry + 0.3, 0, a, Math.PI - a); c.closePath(); c.fillStyle = C.maskHi; c.fill(); c.lineWidth = lw * 0.7; c.strokeStyle = C.line; c.stroke(); }
  c.restore();
}

function hand(c, x, y, ang, r, C, lw, mode, throb, t) {
  c.save(); c.translate(x, y); c.rotate(ang);
  const hot = throb > 0.02, pul = hot ? 1 + 0.45 * throb * (0.65 + 0.35 * Math.sin(t * 15)) : 1, col = hot ? C.hurt : C.paw, hi = hot ? C.hurtHi : C.pawHi;
  c.scale(pul, pul);
  const fs = [[r * 0.95, -r * 0.62, r * 0.46], [r * 1.18, 0, r * 0.5], [r * 0.95, r * 0.62, r * 0.46]];
  if (mode > 1.5) { hose(c, [[r * 0.5, -r * 0.35], [r * 2.2, -r * 0.5]], r * 0.62, col, C.line, lw); hose(c, [[r * 0.5, r * 0.25], [r * 2.2, r * 0.25]], r * 0.62, col, C.line, lw); } else if (mode > 0.5) hose(c, [[r * 0.5, -r * 0.3], [r * 2.5, -r * 0.45]], r * 0.66, col, C.line, lw);
  c.fillStyle = C.line; c.beginPath(); c.arc(0, 0, r + lw, 0, TAU); if (mode < 0.5) for (const f of fs) { c.moveTo(f[0], f[1]); c.arc(f[0], f[1], f[2] + lw, 0, TAU); } c.fill();
  c.fillStyle = col; c.beginPath(); c.arc(0, 0, r, 0, TAU); if (mode < 0.5) for (const f of fs) { c.moveTo(f[0], f[1]); c.arc(f[0], f[1], f[2], 0, TAU); } c.fill();
  fillP(c, ellP(-r * 0.25, -r * 0.35, r * 0.42, r * 0.28, -0.5), hi);
  c.restore();
  if (hot) { // pain ticks round the paw
    c.save(); c.translate(x, y); c.lineCap = 'round'; const k = 0.5 + 0.5 * Math.sin(t * 15), R0 = r * pul + lw * 2.2;
    for (const [w, col2] of [[lw * 2.3, C.line], [lw * 1.1, C.hurtHi]]) { c.lineWidth = w; c.strokeStyle = col2; c.beginPath(); for (let i = 0; i < 5; i++) { const a = -2.5 + i * 0.75 + ang * 0.2; c.moveTo(Math.cos(a) * R0, Math.sin(a) * R0); c.lineTo(Math.cos(a) * (R0 + r * (0.5 + 0.4 * k)), Math.sin(a) * (R0 + r * (0.5 + 0.4 * k))); } c.stroke(); }
    c.restore();
  }
}

export function drawRaccoon(ctx, x, y, s, t, pose, o = {}) {
  if (!(s > 0)) return;
  const p = pose, u = s / 100, C = o.frozen > 0 ? ICED : PAL, lw = Math.max(2.3, 1.15 / u), face = o.face < 0 ? -1 : 1;
  const sy = 1 - p.sq, sx = 1 + p.sq * 0.7, cr = Math.cos(p.rot), sr = Math.sin(p.rot);
  const toPx = (lx, ly) => ({ x: x + (p.dx + lx * cr - ly * sr) * sx * u * face, y: y + (-p.by + lx * sr + ly * cr) * sy * u });
  const e = { look: p.look, looky: p.looky, lid: Math.max(p.lid, p.happy > 0.5 || p.squeeze > 0.5 ? 0 : blinkAt(t, 3)), lidLo: p.lidLo, pup: p.pup, happy: p.happy, squeeze: p.squeeze, spiral: p.spiral, mad: 0 };
  let brow = p.brow;
  if (o.eye === 'spiral') e.spiral = 1; else if (o.eye === 'happy') e.happy = 1; else if (o.eye === 'squeeze') e.squeeze = 1; else if (o.eye === 'wide') { e.pup = 0.5; e.lid = 0; } else if (o.eye === 'lock') { e.pup = 1.3; e.look = 1; } else if (o.eye === 'angry') brow = 1;
  e.mad = clamp(brow, 0, 1) * 0.3;
  const stars = o.stars != null ? o.stars : p.stars;
  ctx.save();
  try {
    ctx.translate(x, y); ctx.scale(u * face, u); ctx.scale(sx, sy); ctx.translate(p.dx, -p.by); ctx.rotate(p.rot);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const sack = () => { ctx.save(); ctx.translate(p.skx, p.sky); ctx.rotate(p.skr); ctx.scale(p.sks, p.sks); sackShape(ctx, C, lw / p.sks, p.sko, t); ctx.restore(); };
    // ---- tail: a fat ringed brush, behind everything
    {
      const n = 10, len = 64 * (1 + p.puff * 0.08), ctr = [], seg = len / n;
      let a = Math.PI - p.tail, px = -15, py = 12;
      for (let i = 0; i <= n; i++) { const f = i / n; ctr.push([px, py, a]); a -= (p.tc * 0.17 + p.tw * 0.16 * Math.sin(f * 3.4)) * (0.35 + f); px += Math.cos(a) * seg; py -= Math.sin(a) * seg; }
      const wd = (f) => (4.5 + 9.5 * Math.sin(Math.min(1, f * 1.35) * Math.PI * 0.6) - 6 * ss(0.75, 1, f)) * (1 + p.puff * 0.45);
      const L = [], R = [];
      ctr.forEach((q, i) => { const w = wd(i / n), nx = Math.sin(q[2]), ny = Math.cos(q[2]); L.push([q[0] + nx * w, q[1] + ny * w]); R.push([q[0] - nx * w, q[1] - ny * w]); });
      const tip = ctr[n], tx = tip[0] + Math.cos(tip[2]) * 8, ty = tip[1] - Math.sin(tip[2]) * 8;
      const all = (c) => { c.beginPath(); c.moveTo(L[0][0], L[0][1]); for (let i = 1; i <= n; i++) c.lineTo(L[i][0], L[i][1]); c.quadraticCurveTo(tx, ty, R[n][0], R[n][1]); for (let i = n - 1; i >= 0; i--) c.lineTo(R[i][0], R[i][1]); c.closePath(); };
      ink(ctx, all, C.ringL, C.line, lw);
      ctx.fillStyle = C.ringD;
      for (const i of [1, 3, 5, 7]) { ctx.beginPath(); ctx.moveTo(L[i][0], L[i][1]); ctx.lineTo(L[i + 1][0], L[i + 1][1]); ctx.lineTo(R[i + 1][0], R[i + 1][1]); ctx.lineTo(R[i][0], R[i][1]); ctx.closePath(); ctx.fill(); }
      ctx.beginPath(); ctx.moveTo(L[9][0], L[9][1]); ctx.lineTo(L[10][0], L[10][1]); ctx.quadraticCurveTo(tx, ty, R[10][0], R[10][1]); ctx.lineTo(R[9][0], R[9][1]); ctx.closePath(); ctx.fill();
      if (p.puff > 0.3) { ctx.strokeStyle = C.line; ctx.lineWidth = lw * 0.8; ctx.beginPath(); for (let i = 2; i < n; i += 2) { const nx = Math.sin(ctr[i][2]), ny = Math.cos(ctr[i][2]); for (const sgn of [1, -1]) { const q = sgn > 0 ? L[i] : R[i]; ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0] + nx * sgn * 5 * p.puff, q[1] + ny * sgn * 5 * p.puff); } } ctx.stroke(); }
    }
    if (p.skf <= 0.5) sack();
    // ---- legs and feet
    const leg = (hx0, hy0, fx, fy, far) => {
      const k = ik(hx0, hy0, fx, fy - 2, 11.5, 11.5, -1);
      hose(ctx, [[hx0, hy0], k, [fx, fy - 2]], 11, far ? C.furLo : C.fur, C.line, lw);
      ink(ctx, ellP(fx + 4.5, fy, 9.5, 4.8), far ? C.mask : C.paw, C.line, lw);
      if (!far) fillP(ctx, ellP(fx + 3, fy - 1.6, 5, 1.6), C.pawHi);
    };
    leg(8, 14, p.f1x, p.f1y, true); leg(-7, 15, p.f0x, p.f0y, false);
    // ---- torso: a chunky pear, cream belly
    const torso = [[-21, 15], [-25, 1], [-20, -15], [-8, -24], [8, -24], [18, -16], [23, 0], [20, 14], [8, 21], [-10, 21]];
    ink(ctx, blobP(torso), C.furLo, C.line, lw);
    fillP(ctx, blobP(inset(torso, 0.85, -2, -2.5)), C.fur);
    fillP(ctx, ellP(8, 3, 12.5, 16, 0.08), C.creamLo); fillP(ctx, ellP(7, 1.5, 11, 14, 0.08), C.cream);
    fillP(ctx, ellP(-13, -12, 5, 8, 0.5), C.furHi);
    if (p.strap > 0.5) { ctx.beginPath(); ctx.moveTo(-17, -19); ctx.quadraticCurveTo(2, -8, 21, 6); ctx.lineWidth = lw * 2.6; ctx.strokeStyle = C.line; ctx.stroke(); ctx.lineWidth = lw * 1.3; ctx.strokeStyle = C.rope; ctx.stroke(); }
    // ---- the hugged egg, the far arm
    if (p.egg > 0.02 && o.egg !== false) {
      ctx.save(); ctx.translate(p.ex, p.ey); ctx.rotate(0.12); ctx.scale(p.egg, p.egg);
      const eg = (c) => { c.beginPath(); c.moveTo(0, -22); c.bezierCurveTo(13, -22, 18, -2, 18, 5); c.bezierCurveTo(18, 16, 10, 22, 0, 22); c.bezierCurveTo(-10, 22, -18, 16, -18, 5); c.bezierCurveTo(-18, -2, -13, -22, 0, -22); c.closePath(); };
      ink(ctx, eg, C.eggLo, C.line, lw); ctx.save(); ctx.translate(-1.5, -2); ctx.scale(0.87, 0.88); fillP(ctx, eg, C.egg); ctx.restore(); fillP(ctx, ellP(-7, -9, 3.5, 6, 0.4), '#ffffff');
      ctx.restore();
    }
    const arm = (sx0, sy0, hx0, hy0, far, mode, throb) => {
      const k1 = ik(sx0, sy0, hx0, hy0, 17, 17, 1), k2 = ik(sx0, sy0, hx0, hy0, 17, 17, -1), k = k1[1] > k2[1] ? k1 : k2, d = Math.hypot(hx0 - sx0, hy0 - sy0), w = d > 40 ? Math.max(6.5, 9.5 - (d - 40) * 0.05) : 9.5;
      hose(ctx, [[sx0, sy0], k, [hx0, hy0]], w, far ? C.furLo : C.fur, C.line, lw);
      hand(ctx, hx0, hy0, Math.atan2(hy0 - k[1], hx0 - k[0]), 6.4, C, lw, mode, throb, t);
    };
    arm(13, -13, p.a1x, p.a1y, true, 0, 0);
    // ---- head
    ctx.save();
    ctx.translate(p.hx, p.hy); ctx.rotate(p.hr); ctx.scale(p.hsc, p.hsc);
    if (stars > 0) dizzyStars(ctx, 0, -33, 25, 7, t, { n: Math.round(stars), layer: 'back', size: Math.max(6, 3.4 / u) });
    const ear = (bx, by2, far) => {
      ctx.save(); ctx.translate(bx, by2); ctx.rotate((far ? 0.25 : -0.3) - p.ear * (far ? -0.5 : 0.8) * (far ? -1 : 1) * 0.9); ctx.scale(1, 1 - 0.25 * clamp(p.ear, 0, 1));
      ink(ctx, blobP([[-8, 3], [-8, -7], [-1, -14], [6, -9], [8, 3]]), far ? C.furLo : C.fur, C.line, lw);
      fillP(ctx, blobP([[-4, 1], [-4.5, -5], [-0.5, -9.5], [3.5, -5.5], [4.5, 1]]), far ? C.mask : C.earIn);
      ctx.restore();
    };
    ear(15, -19, true); ear(-15, -18, false);
    const ck = p.cheek, hp = [[0, -25], [14, -23], [24, -13], [27, -2], [34 + 3 * ck, 6], [25 + 4 * ck, 13 + ck], [16, 19 + ck], [4, 21], [-9, 20 + ck], [-22 - 3 * ck, 15 + ck], [-36 - 3 * ck, 9], [-29, -1], [-27, -11], [-17, -21]];
    ink(ctx, blobP(hp), C.furLo, C.line, lw);
    fillP(ctx, blobP(inset(hp, 0.87, -1.5, -2.5)), C.fur);
    fillP(ctx, ellP(-10, -18.5, 9, 3.6, -0.32), C.furHi);
    // the mask: one dark band, pinched over the nose
    fillP(ctx, blobP([[-26, 3], [-22, -9], [-9, -14], [2, -8], [12, -13], [22, -10], [25, -1], [21, 6], [12, 5], [3, 2], [-7, 8], [-19, 9]]), C.mask);
    // white brows above it (they act), cream muzzle
    const browS = (bx, by2, len, dir) => { const a = (brow > 0 ? brow * 0.42 : brow * 0.3) * dir, lift = brow < 0 ? brow * 2 : -e.lid * 0 ; ctx.save(); ctx.translate(bx, by2 + lift + (brow > 0 ? brow * 2.2 : 0)); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(-len, 0.8); ctx.quadraticCurveTo(0, -2.2, len, 0.8); ctx.lineWidth = lw * 2.5; ctx.strokeStyle = C.line; ctx.stroke(); ctx.lineWidth = lw * 1.4; ctx.strokeStyle = C.cream; ctx.stroke(); ctx.restore(); };
    browS(-11, -17, 6.5, 1); browS(14, -16.5, 5, -1);
    eyeDraw(ctx, 14.5, -3.5, 6.2, 7.6, e, C, lw, t, -1);
    eyeDraw(ctx, -9, -3, 8.6, 8.8, e, C, lw, t, 1);
    const mz = [[-3, 9], [2, 2.5], [11, 0.5], [20, 2], [24.5 + 2 * ck, 8], [21 + 2 * ck, 15.5], [11, 18.5 + ck], [1, 16]];
    ink(ctx, blobP(mz), C.creamLo, C.line, lw * 0.55); fillP(ctx, blobP(inset(mz, 0.84, -0.8, -1.2)), C.cream);
    // mouth
    const mx = 11.5, my = 11.5, mw = lerp(7, 2.6, p.pucker), sm = p.smile * (1 - p.pucker), jw = Math.max(p.jaw, p.pucker * 0.3);
    const lx0 = mx - mw, rx0 = mx + mw * 0.85, cy0 = my - sm * 2.6, cu = my + sm * 3.6, cl = cu + jw * 21, yu = (cy0 + cu) / 2, yl = (cy0 + cl) / 2;
    if (jw < 0.07) { ctx.beginPath(); ctx.moveTo(lx0, cy0); ctx.quadraticCurveTo(mx, cu, rx0, cy0); ctx.lineWidth = lw * 0.95; ctx.strokeStyle = C.line; ctx.stroke(); }
    else {
      const mp = (c) => { c.beginPath(); c.moveTo(lx0, cy0); c.quadraticCurveTo(mx, cu, rx0, cy0); c.quadraticCurveTo(mx, cl, lx0, cy0); c.closePath(); };
      ink(ctx, mp, C.mouth, C.line, lw * 0.6);
      if (jw > 0.3) fillP(ctx, ellP(mx, yl - jw * 3.4, mw * 0.5, jw * 2.6), C.tongue);
      if (p.teeth > 0.5 && jw > 0.2) { ctx.beginPath(); ctx.moveTo(lx0 + 1.8, cy0 + 0.6); ctx.quadraticCurveTo(mx, cu + 0.6, rx0 - 1.8, cy0 + 0.6); ctx.quadraticCurveTo(mx, cu + 0.6 + Math.min(5, jw * 6), lx0 + 1.8, cy0 + 0.6); ctx.fillStyle = C.tooth; ctx.fill(); }
    }
    if (p.tongue > 0.03) { const L2 = 8.5 * p.tongue, bx = mx + Math.cos(p.ta) * 2.5, by2 = yu + 1 + Math.sin(p.ta) * 1.5; hose(ctx, [[bx, by2], [bx + Math.cos(p.ta) * L2, by2 + Math.sin(p.ta) * L2]], 5.4, C.tongue, C.line, lw * 0.6); }
    ink(ctx, ellP(19.5, 3.4, 5.2, 3.9, 0.15), C.nose, C.line, lw * 0.4); fillP(ctx, ellP(18.2, 2.2, 1.9, 1, 0.1), '#8a8494');
    // whiskers
    ctx.strokeStyle = C.line; ctx.lineWidth = lw * 0.5; ctx.beginPath();
    for (const [a, b, c2, d] of [[23, 9, 35, 7], [23, 12, 34, 14], [-1, 12, -12, 11], [-1, 14.5, -11, 17]]) { ctx.moveTo(a, b); ctx.lineTo(c2, d + Math.sin(t * 11 + a) * 0.6); }
    ctx.stroke();
    if (p.sweat > 0.05) { // drops flying off the brow
      for (let i = 0; i < 3; i++) { const f = fract(t * 1.7 + i / 3), a = -2.2 + i * 0.55, r0 = 30 + f * 16, dx2 = Math.cos(a) * r0, dy2 = Math.sin(a) * r0 + f * f * 8; ctx.save(); ctx.translate(dx2, dy2); ctx.rotate(a + Math.PI / 2); ctx.globalAlpha = p.sweat * (1 - f * f); const dp = (c) => { c.beginPath(); c.moveTo(0, -5); c.quadraticCurveTo(3.4, 0, 0, 3); c.quadraticCurveTo(-3.4, 0, 0, -5); c.closePath(); }; ink(ctx, dp, C.sweat, C.line, lw * 0.6); ctx.restore(); }
    }
    if (stars > 0) dizzyStars(ctx, 0, -33, 25, 7, t, { n: Math.round(stars), layer: 'front', size: Math.max(6, 3.4 / u) });
    // the whistle: sound arcs and a note leaving the mouth
    if (p.note > 0.05) {
      ctx.save(); ctx.translate(30, 10); ctx.globalAlpha = clamp(p.note, 0, 1); ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) { const f = fract(t * 2.2 + i / 3), r = 6 + f * 26; ctx.globalAlpha = clamp(p.note, 0, 1) * (1 - f); ctx.beginPath(); ctx.arc(-6, 0, r, -0.6, 0.6); ctx.lineWidth = lw * 2.4; ctx.strokeStyle = C.line; ctx.stroke(); ctx.lineWidth = lw * 1.1; ctx.strokeStyle = C.note; ctx.stroke(); }
      for (let i = 0; i < 2; i++) { const f = fract(t * 1.1 + i * 0.5), nx = 14 + f * 30, ny = -8 - f * 26 + Math.sin(f * 9 + i) * 4; ctx.globalAlpha = clamp(p.note, 0, 1) * Math.sin(f * Math.PI); ctx.save(); ctx.translate(nx, ny); ctx.rotate(0.2 * Math.sin(f * 8)); for (const [w, col] of [[lw * 2.6, C.line], [lw * 1.2, C.note]]) { ctx.lineWidth = w; ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(2.6, 4); ctx.lineTo(2.6, -8); ctx.lineTo(8, -6); ctx.stroke(); } ink(ctx, ellP(0, 4.5, 3.4, 2.6, -0.4), C.note, C.line, lw * 0.6); ctx.restore(); }
      ctx.restore();
    }
    ctx.restore();
    // ---- the near arm, over the head; the sack when it is in front
    arm(-7, -13, p.a0x, p.a0y, false, p.hand, p.throb);
    if (p.skf > 0.5) sack();
  } finally { ctx.restore(); }
  if (o.out) {
    const hc = Math.cos(p.hr), hs = Math.sin(p.hr), H = (lx, ly) => toPx(p.hx + (lx * hc - ly * hs) * p.hsc, p.hy + (lx * hs + ly * hc) * p.hsc);
    o.out.paw = toPx(p.a0x, p.a0y); o.out.mouth = H(13, 12); o.out.head = H(0, 0); o.out.hold = toPx(p.ex, p.ey); o.out.holdR = 22 * u;
  }
}
