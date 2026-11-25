// Coco the Monkey (Wild Woods): a small capuchin, brown coat, cream face and chest, a long curling tail, a banana never
// far away. Crisp cel-shaded code art in the thieves' house style: a dark outline only, two-tone fur with a back
// highlight, big eyes with lids and brows. Seen three-quarter from the side.
//
// drawMonkey(ctx, x, y, s, t, pose, o) draws him in a local y-DOWN pixel space:
//   (x, y)  the floor point between his feet; he faces +x (o.face -1 mirrors). s = px per 100 rig units; he stands about
//           92 units tall (MONKEY_M metres per 100 units puts him near 0.9 m). In the states hang, ride and slipoff
//           (x, y) is instead the point on the ring he holds on to: he hangs below it. Draw him over the ring.
//   pose    from monkeyPose(state, t, u): plain numbers, so poses blend (monkeyBlend)
//   o       { face, frozen (icy colours), stars 0..3 (overrides the pose), eye: 'normal' | 'lock' | 'wide' | 'squeeze' |
//             'spiral' | 'happy' | 'angry', out: {} receives hand (the near hand: where the peel leaves it), mouth, head
//             {x, y} in the same px space }
// monkeyPose states: idle (scratching), hang (upside down by the tail, swinging), ride (both hands on the ring, pumping
// it to and fro), eat (u: shows the banana off, three bites, a gulp, then eyes the peel: the telegraph), toss (u: wind-up,
// the throw (the peel leaves the hand at u = TOSS_RELEASE), a snigger behind his hand), slipoff (u: the grip goes, then he
// spins off flailing. The flight is in the pose: pose.dx / pose.dy (rig units from the grip point, drawn by drawMonkey) take
// him opt.dx (150) along and opt.drop (150: grip point down to the floor) down, to land sitting; opt.travel false = none), dizzy, sulk (arms crossed, turned away, peeking back), laugh (pointing),
// scared, defeated (asleep on his back hugging a banana).
// drawPeel(ctx, x, y, s, t, o) is the banana peel in the world: lying (default), flying (o.rot, o.air) or slipping (o.slip).
import { spline, blinkAt, hash, clamp, lerp, ss, back, ik, zed } from './castkit.js';
import { dizzyStars, spiralEye } from './status.js';

const TAU = Math.PI * 2;
export const MONKEY_M = 0.98; // metres per 100 rig units
export const TOSS_RELEASE = 0.42;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixHex = (a, b, k) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
const PAL = {
  line: '#2a1206', fur: '#8a4f2a', furLo: '#653418', furHi: '#ad6c3c', cream: '#fbe6bf', creamLo: '#e6c391', skin: '#f3c79c', skinLo: '#d99f72', lid: '#e3ad80', earIn: '#f09a8c',
  eyeW: '#fffdf4', iris: '#5a2c0e', irisHi: '#a0621e', pupil: '#150a06', mouth: '#5a1420', tongue: '#f0707c', tooth: '#ffffff', nose: '#4a2210',
  ban: '#ffd632', banLo: '#e3a318', banIn: '#fff3b8', banTip: '#5a3a10', sweat: '#8fd4ff', puff: '#ffffff', skid: '#fff3b8',
};
const ICED = {};
for (const c in PAL) ICED[c] = mixHex(PAL[c], '#bfe6ff', 0.55);

// ------------------------------------------------------------------ poses
// by: torso centre height (negative = hanging below the grip point); dx; rot: whole-body turn (+ = toward +x, pi = upside
// down); sq: squash (- = stretch); hx, hy, hr, hsc: the head in the torso's frame; a0 / a1: near / far hand, f0 / f1: near
// / far foot (torso frame); ab: the near arm passes behind the head; tx, ty: the tail's curl centre (torso frame), tb: bow,
// tr: curl radius, tc: curl turns; look, looky, lid, lidLo, brow, pup, happy / squeeze / spiral / sleep (eye styles), jaw,
// smile, teeth, pucker, tongue (ta), cheek (chewing); turn -1..1: the face turned away; fluff: hair on end; ear; ban: banana
// in the near hand (bl: fruit left, whole: unpeeled, ba: its angle), peel: the empty peel in the hand; hand: 1 = pointing;
// grip: fists; stars, zz (sleep), sweat, huff (sulky steam); cross: arms folded; dy: a drop below the anchor (the slip-off's fall)
const REST = { by: 27, dx: 0, dy: 0, cross: 0, rot: 0, sq: 0, hx: 3, hy: -33, hr: 0, hsc: 1, a0x: -13, a0y: 8, a1x: 17, a1y: 7, ab: 0, f0x: -7, f0y: 25, f1x: 9, f1y: 25,
  tx: -33, ty: -12, tb: 12, tr: 7, tc: 1.25, look: 0.3, looky: 0, lid: 0.1, lidLo: 0, brow: 0.1, pup: 1, happy: 0, squeeze: 0, spiral: 0, sleep: 0,
  jaw: 0, smile: 0.8, teeth: 0, pucker: 0, tongue: 0, ta: 1.2, cheek: 0, turn: 0, fluff: 0, ear: 0, ban: 0, bl: 1, whole: 0, ba: 0, peel: 0, hand: 0, grip: 0, stars: 0, zz: 0, sweat: 0, huff: 0 };
const KEYS = Object.keys(REST);
function fin(p, w) {
  const c = Math.cos(-p.rot), s = Math.sin(-p.rot), sy = 1 - p.sq, sx = 1 + p.sq * 0.7;
  for (const k in w) { const X = w[k][0] / sx - p.dx, Y = w[k][1] / sy + p.by; p[k + 'x'] = X * c - Y * s; p[k + 'y'] = X * s + Y * c; }
  return p;
}
const P = (o) => Object.assign({}, REST, o);
const fract = (x) => x - Math.floor(x);
const bump = (a, b, x) => Math.sin(clamp((x - a) / (b - a), 0, 1) * Math.PI);
const SIT = 20; // torso centre height when he sits
export function monkeyPose(state, t, u = 0, opt = {}) {
  const br = Math.sin(t * 2.8);
  switch (state) {
    case 'hang': { // upside down by the tail: a lazy pendulum, arms trailing a beat behind, a grin for whoever is watching
      const th = 0.44 * Math.sin(t * 2.5), lag = 0.44 * Math.sin(t * 2.5 - 0.6), lag2 = Math.sin(t * 2.5 - 1.3), L = 56;
      const p = P({ dx: Math.sin(th) * L, by: -Math.cos(th) * L, rot: Math.PI - lag * 1.25, hr: 0.2 * lag2, hx: 3, a0x: -31 - 11 * lag2, a0y: -37 + 5 * Math.abs(lag2), a1x: 34 - 11 * lag2, a1y: -35 + 5 * Math.abs(lag2), ab: 1,
        f0x: -12, f0y: 17 + br, f1x: 13, f1y: 16 - br, look: 0.2 - 0.6 * lag2, looky: -0.3, lid: 0.15, smile: 1, jaw: 0.3 + 0.2 * Math.max(0, lag2), teeth: 1, brow: 0.4, tongue: Math.max(0, Math.sin(t * 1.25)) > 0.8 ? 1 : 0, ta: 1.4, tr: 8, tc: 1.15, tb: 9 * lag2, ear: 0.1 * lag2 });
      return fin(p, { t: [0, 1] });
    }
    case 'ride': { // right way up, both fists on the ring: he pumps it like a swing, legs kicking through, tail whipping
      const w = t * 4.2, th = 0.34 * Math.sin(w), v = Math.cos(w), L = 66, lag = Math.sin(w - 0.9);
      const p = P({ dx: Math.sin(th) * L, by: -Math.cos(th) * L, rot: -th * 1.5, sq: -0.05 * Math.abs(v), hr: th * 0.9 + 0.1, hx: 3 + 2 * v, grip: 1, ab: 1, f0x: -7 + 15 * lag, f0y: 25 - 5 * Math.abs(lag), f1x: 9 + 15 * Math.sin(w - 0.5), f1y: 24 - 5 * Math.abs(lag),
        look: 0.3 + 0.5 * v, looky: -0.5, lid: 0.1, happy: v > 0.55 ? 1 : 0, smile: 1, jaw: 0.45 + 0.3 * Math.abs(v), teeth: 1, tongue: v < -0.3 ? 1 : 0, ta: 1.3, brow: 0.7, tx: -30 - 10 * lag, ty: 2 - 14 * Math.abs(lag), tb: 14 * lag, tr: 6, tc: 1.3 + 0.3 * lag, ear: 0.2 * v });
      return fin(p, { a0: [-21, -1], a1: [25, -1] });
    }
    case 'eat': { // sitting: admires it, three greedy bites (cheeks working), a gulp, then a slow sly look at the empty peel
      const show = ss(0, 0.1, u) * (1 - ss(0.14, 0.2, u)), bites = [0.3, 0.44, 0.58], done = ss(0.6, 0.66, u), gulp = bump(0.64, 0.76, u), sly = ss(0.78, 0.9, u);
      let open = 0, near = 0, nb = 0;
      for (const b of bites) { open = Math.max(open, bump(b - 0.09, b + 0.005, u)); near = Math.max(near, bump(b - 0.1, b + 0.06, u)); if (u > b) nb++; }
      const chew = u > bites[0] && u < 0.7 ? Math.abs(Math.sin(t * 14)) * (1 - open) : 0;
      const p = P({ by: SIT + 0.6 * br + 2 * show, rot: -0.1 - 0.12 * gulp + 0.06 * near, hx: 3 + 2 * near, hr: -0.1 * show - 0.4 * gulp + 0.12 * near + 0.12 * sly, look: lerp(0.9, 0.7, sly), looky: lerp(-0.5 * show + 0.2, 0.3, sly), lid: 0.1 + 0.3 * near + 0.3 * sly, lidLo: 0.25 * sly, happy: gulp > 0.5 ? 1 : 0, brow: 0.2 + 0.7 * sly,
        jaw: Math.max(open * 0.95, chew * 0.25), cheek: Math.min(1, nb * 0.5) * (1 - ss(0.66, 0.74, u)), smile: lerp(0.9, 1, sly), teeth: sly, tongue: show > 0.5 ? 1 : 0, ta: 0.5, ban: 1 - done, peel: done, bl: 1 - nb / 3, ba: lerp(0.4, -1.0, near) - 0.2 * show,
        a0x: lerp(lerp(21, 26, show), 23, near) + 4 * sly, a0y: lerp(lerp(-10, -34, show), -13, near) - 8 * sly + 1.5 * Math.sin(t * 5) * sly, a1x: 13 + 3 * gulp, a1y: 5, tx: -30, ty: 6 - 5 * sly, tb: 8 + 4 * br, tc: 1.3, ear: -0.2 * show });
      return fin(p, { f0: [21, -3], f1: [29, -3] });
    }
    case 'toss': { // up on his feet: the arm goes right back (a sly look), whips over, the peel flies; then a snigger behind his hand
      const w = ss(0, 0.3, u) * (1 - ss(0.34, 0.42, u)), th = back(ss(0.34, 0.47, u), 2.2), sn = ss(0.68, 0.8, u), sh = Math.sin(t * 22) * sn;
      const p = P({ by: 27 - 3 * w + 2 * Math.sin(clamp(th, 0, 1) * Math.PI) + 0.8 * sh, dx: -5 * w + 7 * th * (1 - sn), rot: -0.34 * w + 0.4 * th * (1 - sn) - 0.08 * sn, sq: 0.07 * w - 0.06 * bump(0.36, 0.5, u), hr: 0.25 * w - 0.2 * th * (1 - sn) - 0.1 * sn, hx: 3,
        look: lerp(0.9, 0.5, sn), looky: 0.4 * th, lid: 0.3 * w + 0.1, lidLo: 0.3 * w, brow: 0.8 * (1 - sn), happy: sn, jaw: 0.6 * bump(0.36, 0.56, u) + 0.3 * sn, smile: 1, teeth: 1, tongue: w > 0.6 ? 1 : 0, ta: 0.4, peel: u < TOSS_RELEASE ? 1 : 0,
        a0x: lerp(lerp(-13, -27, w), lerp(36, 13, sn), clamp(th, 0, 1.1)), a0y: lerp(lerp(8, -26, w), lerp(-6, -19, sn), clamp(th, 0, 1.1)), a1x: lerp(17, 22, w), a1y: lerp(7, -4, w) + 8 * sn, tx: -33 + 12 * th, ty: -12 - 14 * th * (1 - sn), tb: 12 - 20 * th * (1 - sn), tc: 1.25 - 0.8 * th * (1 - sn), ear: -0.3 * w });
      return fin(p, { f0: [-9 - 4 * w, -2], f1: [9 + 8 * th * (1 - sn), -2] });
    }
    case 'slipoff': case 'slip-off': { // fingers peel off the ring one hand at a time, a frozen "uh-oh", then he cartwheels away
      const go = ss(0.16, 0.24, u), fl = Math.sin(t * 34), e1 = ss(0, 0.07, u), e2 = ss(0.08, 0.16, u);
      const tr = opt.travel === false ? 0 : 1, f = clamp((u - 0.2) / 0.7, 0, 1), DX = opt.dx != null ? opt.dx : 150, DROP = opt.drop != null ? opt.drop : 150, land = bump(0.9, 1.04, u) * tr;
      const p = P({ dx: tr * DX * f, dy: tr * ((DROP - 66 - SIT) * f * f - 34 * Math.sin(f * Math.PI)), by: -66 - 3 * go * (1 - f), rot: -0.2 * e1 * (1 - go) + (tr ? 4 * Math.PI * f : Math.max(0, u - 0.18) * 13), sq: -0.1 * e2 * (1 - go) + 0.04 * fl * go + 0.2 * land, hr: -0.2 * e2 + 0.15 * fl * go, hsc: 1 + 0.06 * e2, look: 0, looky: lerp(-0.7, 0, go), lid: 0, pup: 0.5, brow: -0.9, jaw: 0.5 + 0.5 * e2, smile: -0.8, teeth: 1 - go, fluff: e2, ear: 0.8, ab: 1 - go, sweat: 1 - go,
        spiral: ss(0.55, 0.6, u), tongue: ss(0.55, 0.6, u), ta: 1.5, f0x: -7 - 12 * go + 4 * fl * go, f0y: 25 - 2 * go, f1x: 9 + 14 * go - 4 * fl * go, f1y: 24 - 4 * go, tx: lerp(-30, -38, go), ty: lerp(2, 20, go) + 5 * fl * go, tb: 10 * fl * go, tr: 5, tc: lerp(1.3, 0.5, go) });
      const q = fin({ ...p, dx: 0, rot: -0.2 * e1 }, { a0: [-21, -1], a1: [25, -1] }); p.a0x = q.a0x; p.a0y = q.a0y; p.a1x = q.a1x; p.a1y = q.a1y;
      const g0 = p.a0x, g1 = p.a0y, h0 = p.a1x, h1 = p.a1y; // one hand slips first, then the other
      p.a0x = lerp(lerp(g0, g0 - 6 + 2 * fl, e1), -30 + 4 * fl, go); p.a0y = lerp(lerp(g1, g1 + 9, e1), -22 - 5 * fl, go); p.a1x = lerp(lerp(h0, h0 + 5, e2), 33 + 4 * fl, go); p.a1y = lerp(lerp(h1, h1 + 8, e2), -20 + 5 * fl, go);
      return p;
    }
    case 'dizzy': { // sat down hard: head rolling, spiral eyes, tongue out, arms and tail gone limp
      const w = Math.sin(t * 2.3), w2 = Math.sin(t * 2.3 - 0.8);
      return fin(P({ by: SIT - 1 + 0.6 * Math.sin(t * 4.6), dx: 3 * w, rot: 0.14 * w, hx: 3 + 3 * w2, hr: 0.3 * w2, spiral: 1, lid: 0, brow: -0.7, jaw: 0.35, smile: -0.2, tongue: 1, ta: 1.4 + 0.3 * w2, ear: 0.6, stars: 3,
        a0x: -16 - 3 * w2, a0y: 16, a1x: 19 - 3 * w2, a1y: 16, tx: -38, ty: 15, tb: -3 + 2 * w2, tr: 5, tc: 0.5 }), { f0: [21, -3], f1: [29, -3] });
    }
    case 'sulk': { // sits turned away, arms folded, nose in the air; the tail thumps; now and then one eye sneaks a look back
      const pk = bump(0.68, 0.86, fract(t / 3.4)), fl = Math.pow(Math.max(0, Math.sin(t * 6)), 4), hf = fract(t / 1.3);
      return fin(P({ by: SIT + 0.5 * br, rot: -0.16, hx: 0, hy: -34, hr: -0.36 + 0.12 * pk, turn: -1 + 0.4 * pk, lid: 1 - 0.6 * pk, look: 1, looky: 0.3, brow: 1, smile: -1, pucker: 0.4, cross: 1, grip: 1, a0x: 14, a0y: -4 + 0.5 * br, a1x: -10, a1y: 3 + 0.5 * br,
        tx: -33 - 4 * fl, ty: 9 - 22 * fl, tb: 5 + 12 * fl, tr: 5.5, tc: 1.1, ear: 0.4, huff: hf < 0.6 ? hf / 0.6 : 0 }), { f0: [29, -3], f1: [36, -4] });
    }
    case 'laugh': { // leaning back, pointing, a hand on his belly, one foot drumming, the tail curling and uncurling
      const h = Math.abs(Math.sin(t * 9)), h2 = Math.sin(t * 9);
      return fin(P({ by: 27 + 2.5 * h, rot: -0.24 - 0.05 * h, sq: 0.05 * h2, hr: -0.3 - 0.1 * h, happy: 1, jaw: 0.7 + 0.3 * h, smile: 1, teeth: 1, brow: 0.3, a0x: 31, a0y: -13 + 3 * h, hand: 1, a1x: 12, a1y: 4 + 2 * h,
        tx: -31, ty: -10 - 4 * h, tb: 10 + 5 * h2, tc: 1.2 + 0.4 * h2, ear: 0.2 }), { f0: [-8, -2], f1: [11, -2 - 6 * Math.max(0, Math.sin(t * 9 + 1.2))] });
    }
    case 'scared': { // straight up off the floor, every hair on end, arms flung up, the tail a stiff zigzag, knees knocking
      const sh = Math.sin(t * 55), kn = Math.sin(t * 24);
      return fin(P({ by: 30 + 0.6 * sh, dx: 0.8 * sh, rot: -0.1, sq: -0.1, hy: -34, hr: -0.14, hsc: 1.05, look: 0.8, looky: 0.1, lid: 0, pup: 0.42, brow: -1, jaw: 0.75 + 0.2 * kn, smile: -0.9, teeth: 1, fluff: 1, ear: -0.3, sweat: 1,
        a0x: -24 + 2 * kn, a0y: -30, a1x: 27 - 2 * kn, a1y: -32, ab: 0, tx: -22, ty: -40, tb: 6 * kn, tr: 3, tc: 0.4 }), { f0: [-9 + 2 * kn, -2], f1: [10 - 2 * kn, -2] });
    }
    case 'defeated': { // flat on his back, fast asleep round a banana: slow breaths, a snore, a foot that twitches in a dream
      const b = Math.sin(t * 1.7), tw = Math.pow(Math.max(0, Math.sin(t * 0.9)), 20) * Math.sin(t * 30);
      return tailFlat(fin(P({ rot: -Math.PI / 2 + 0.06, by: 17 + 0.8 * b, hx: 9, hy: -31, hr: 0.75 + 0.04 * b, sleep: 1, lid: 0, smile: 0.9, jaw: 0.22 + 0.2 * Math.max(0, b), brow: -0.3, ban: 1, whole: 1, ba: 2.0 + 0.04 * b,
        a0x: 16 + 1.2 * b, a0y: 5, a1x: 17 + 1.2 * b, a1y: -9, f0x: 8, f0y: 28 + 3 * tw, f1x: 20 + 2 * tw, f1y: 20, zz: 1, ear: 0.3 }), { t: [46, -7] }));
    }
    default: { // idle: on his feet, a little bounce, scratching his ribs, looking about, the tail curling
      const sc = Math.sin(t * 17) * (Math.sin(t * 1.3) > 0 ? 1 : 0), gl = Math.sin(t * 0.8);
      return fin(P({ by: 27 + 0.8 * br, sq: 0.012 * br, hr: 0.1 * gl, hx: 3 + gl, look: 0.4 + 0.5 * gl, lid: 0.12, a0x: -9 + 1.5 * sc, a0y: 0 + 2.5 * sc, a1x: 17, a1y: 7 + 0.6 * br, tb: 12 + 4 * Math.sin(t * 1.9), tc: 1.25 + 0.25 * Math.sin(t * 1.9), ear: 0.4 * twitch(t) }), { f0: [-8, -2], f1: [9, -2] });
    }
  }
}
function tailFlat(p) { p.tb = -5; p.tr = 5; p.tc = 1.1; return p; }
function twitch(t) { const k = Math.floor(t / 2.1), f = fract(t / 2.1); return hash(k + 9) > 0.4 ? Math.sin(clamp((f - 0.3) / 0.09, 0, 1) * Math.PI) : 0; }

const MEM = {};
export function monkeyBlend(id, pose, t, rate = 10) {
  let m = MEM[id];
  if (!m || t < m.t - 0.5 || t - m.t > 1) { m = MEM[id] = { t, p: { ...pose } }; return m.p; }
  const a = 1 - Math.exp(-(t - m.t) * rate);
  m.t = t;
  m.p.rot += Math.round((pose.rot - m.p.rot) / TAU) * TAU; // turn the short way round
  for (const k of KEYS) m.p[k] += (pose[k] - m.p[k]) * a;
  return m.p;
}

// ------------------------------------------------------------------ drawing kit
const blobP = (pts) => (c) => { c.beginPath(); spline(c, pts, true); };
const ellP = (x, y, rx, ry, r = 0) => (c) => { c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), r, 0, TAU); };
const ink = (c, path, fill, line, lw) => { path(c); c.lineWidth = lw * 2; c.strokeStyle = line; c.stroke(); c.fillStyle = fill; c.fill(); };
const fillP = (c, path, fill) => { path(c); c.fillStyle = fill; c.fill(); };
const inset = (pts, k, ox, oy) => { let cx = 0, cy = 0; for (const q of pts) { cx += q[0]; cy += q[1]; } cx /= pts.length; cy /= pts.length; return pts.map((q) => [cx + (q[0] - cx) * k + ox, cy + (q[1] - cy) * k + oy]); };
function hose(c, pts, w, col, line, lw) {
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); spline(c, pts, false); c.lineWidth = w + lw * 2; c.strokeStyle = line; c.stroke(); c.lineWidth = w; c.strokeStyle = col; c.stroke();
}

// the peel in its own frame (the stalk end at 0,0): splay 0 = hanging limp from a hand, 1 = flat on the floor
function peelShape(c, C, lw, splay, t) {
  const sw = Math.sin(t * 9) * 2.2 * (1 - splay), sw2 = Math.sin(t * 9 - 1) * 2.2 * (1 - splay);
  const fl = [[lerp(-14 + sw, -15, splay), lerp(13, 3, splay), lerp(-4, -8, splay), lerp(9, -4, splay)], [lerp(14 + sw2, 15, splay), lerp(14, 3, splay), lerp(4, 8, splay), lerp(9, -4, splay)], [lerp(0.5 + sw, 3, splay), lerp(22, 5, splay), lerp(-1, 1, splay), lerp(11, 1, splay)]];
  for (const [i, f] of fl.entries()) { const pts = [[0, 0], [f[2], f[3]], [f[0], f[1]]], w = lerp(3.8, 5.6, splay); hose(c, pts, w, i === 2 ? C.ban : C.banLo, C.line, lw); c.beginPath(); spline(c, pts, false); c.lineWidth = w * 0.55; c.strokeStyle = C.banIn; c.stroke(); }
  hose(c, [[0, 1], [0.5, -5]], 4.6, C.ban, C.line, lw); hose(c, [[0.5, -5.5], [0.8, -7]], 2.6, C.banTip, C.line, lw * 0.6);
}
// the peel as a prop. (x, y) = the floor point under it. o: { rot (spin, in the air), air 0..1 (flaps trailing), slip 0..1 (an
// egg has just stepped on it: squashed flat and skidding toward -x * face), face, frozen }
export function drawPeel(ctx, x, y, s, t, o = {}) {
  if (!(s > 0)) return;
  const u = s / 100, C = o.frozen > 0 ? ICED : PAL, lw = Math.max(2.1, 1.1 / u), air = o.air || 0, sl = clamp(o.slip || 0, 0, 1), sq = Math.sin(Math.min(1, sl * 3) * Math.PI) * 0.4;
  ctx.save(); ctx.translate(x, y); ctx.scale(u * (o.face < 0 ? -1 : 1), u); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (sl > 0.02) { // skid lines and a little puff behind it
    ctx.globalAlpha = 1 - sl; ctx.lineWidth = lw * 1.2; ctx.strokeStyle = C.skid; ctx.beginPath(); for (const [a, b, l] of [[8, -2, 22], [12, -8, 16], [10, -14, 11]]) { ctx.moveTo(a + sl * 10, b); ctx.lineTo(a + sl * 10 + l * (0.4 + sl), b); } ctx.stroke(); ctx.globalAlpha = 1;
  }
  ctx.translate(-sl * 26, -6 * (1 - air) - 2 * air); ctx.rotate((o.rot || 0) - sl * 0.5); ctx.scale(1 + sq * 0.5, 1 - sq);
  peelShape(ctx, C, lw, 1 - 0.5 * air, t);
  ctx.restore();
}

function eyeDraw(c, x, y, rx, ry, e, C, lw, t, dir) {
  if (e.spiral > 0.5) { ink(c, ellP(x, y, rx, ry), C.eyeW, C.line, lw * 0.7); spiralEye(c, x, y, Math.min(rx, ry), t, dir, C.line); return; }
  if (e.happy > 0.5 || e.squeeze > 0.5 || e.sleep > 0.5) {
    c.beginPath();
    if (e.squeeze > 0.5) { c.moveTo(x - rx * 0.75 * dir, y - ry * 0.55); c.lineTo(x + rx * 0.5 * dir, y); c.lineTo(x - rx * 0.75 * dir, y + ry * 0.55); }
    else if (e.sleep > 0.5) { c.moveTo(x - rx * 0.9, y - ry * 0.05); c.quadraticCurveTo(x, y + ry * 0.85, x + rx * 0.9, y - ry * 0.05); }
    else { c.moveTo(x - rx * 0.9, y + ry * 0.3); c.quadraticCurveTo(x, y - ry * 1.05, x + rx * 0.9, y + ry * 0.3); }
    c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = lw * 1.25; c.strokeStyle = C.line; c.stroke();
    return;
  }
  if (e.lid > 0.9) { // shut: the lid itself, with a lash line (it tilts with the brow)
    ink(c, ellP(x, y, rx, ry), C.lid, C.line, lw * 0.7); c.beginPath(); c.moveTo(x - rx * 0.85, y + ry * (0.25 - 0.35 * e.mad * dir)); c.quadraticCurveTo(x, y + ry * 0.75, x + rx * 0.85, y + ry * (0.25 + 0.35 * e.mad * dir)); c.lineCap = 'round'; c.lineWidth = lw * 1.1; c.strokeStyle = C.line; c.stroke(); return;
  }
  const g = 1 + 0.12 * clamp(1.1 - e.pup, 0, 1); rx *= g; ry *= g;
  ink(c, ellP(x, y, rx, ry), C.eyeW, C.line, lw * 0.7);
  const ir = Math.min(rx, ry) * 0.7 * clamp(e.pup, 0.4, 1.3), px = x + e.look * (rx - ir) * 0.95, py = y + e.looky * (ry - ir) * 0.95 + (ry - ir) * 0.12;
  fillP(c, ellP(px, py, ir, ir), C.iris); fillP(c, ellP(px, py + ir * 0.25, ir * 0.8, ir * 0.7), C.irisHi); fillP(c, ellP(px, py, ir * 0.6, ir * 0.6), C.pupil);
  fillP(c, ellP(px - ir * 0.36, py - ir * 0.4, ir * 0.32, ir * 0.32), '#ffffff'); fillP(c, ellP(px + ir * 0.34, py + ir * 0.36, ir * 0.14, ir * 0.14), '#ffffff');
  const lid = clamp(e.lid, 0, 1), lo = clamp(e.lidLo, 0, 1);
  c.save(); c.translate(x, y);
  if (lid > 0.02) { c.save(); c.rotate(e.mad * dir); const v = clamp(-1 + 2 * lid, -0.999, 0.999), a = Math.asin(v); c.beginPath(); c.ellipse(0, 0, rx + 0.3, ry + 0.3, 0, Math.PI - a, TAU + a); c.closePath(); c.fillStyle = C.lid; c.fill(); c.lineWidth = lw * 0.7; c.strokeStyle = C.line; c.stroke(); c.restore(); }
  if (lo > 0.02) { const v = clamp(1 - 1.2 * lo, -0.999, 0.999), a = Math.asin(v); c.beginPath(); c.ellipse(0, 0, rx + 0.3, ry + 0.3, 0, a, Math.PI - a); c.closePath(); c.fillStyle = C.lid; c.fill(); c.lineWidth = lw * 0.7; c.strokeStyle = C.line; c.stroke(); }
  c.restore();
}

function hand(c, x, y, ang, r, C, lw, mode, grip) {
  c.save(); c.translate(x, y); c.rotate(ang);
  const k = 1 - 0.55 * clamp(grip, 0, 1), fs = [[r * 0.95 * k, -r * 0.6, r * 0.45], [r * 1.15 * k, 0, r * 0.48], [r * 0.95 * k, r * 0.6, r * 0.45]];
  if (mode > 0.5) hose(c, [[r * 0.5, -r * 0.3], [r * 2.6, -r * 0.45]], r * 0.66, C.skin, C.line, lw);
  c.fillStyle = C.line; c.beginPath(); c.arc(0, 0, r + lw, 0, TAU); if (mode < 0.5) for (const f of fs) { c.moveTo(f[0], f[1]); c.arc(f[0], f[1], f[2] + lw, 0, TAU); } c.fill();
  c.fillStyle = C.skin; c.beginPath(); c.arc(0, 0, r, 0, TAU); if (mode < 0.5) for (const f of fs) { c.moveTo(f[0], f[1]); c.arc(f[0], f[1], f[2], 0, TAU); } c.fill();
  fillP(c, ellP(r * 0.15, r * 0.4, r * 0.6, r * 0.32, 0.2), C.skinLo);
  c.restore();
}

export function drawMonkey(ctx, x, y, s, t, pose, o = {}) {
  if (!(s > 0)) return;
  const p = pose, u = s / 100, C = o.frozen > 0 ? ICED : PAL, lw = Math.max(2.1, 1.1 / u), face = o.face < 0 ? -1 : 1;
  const sy = 1 - p.sq, sx = 1 + p.sq * 0.7, cr = Math.cos(p.rot), sr = Math.sin(p.rot);
  const toPx = (lx, ly) => ({ x: x + (p.dx + lx * cr - ly * sr) * sx * u * face, y: y + (-p.by + p.dy + lx * sr + ly * cr) * sy * u });
  const shut = p.happy > 0.5 || p.squeeze > 0.5 || p.sleep > 0.5;
  const e = { look: p.look, looky: p.looky, lid: Math.max(p.lid, shut ? 0 : blinkAt(t, 7)), lidLo: p.lidLo, pup: p.pup, happy: p.happy, squeeze: p.squeeze, spiral: p.spiral, sleep: p.sleep, mad: 0 };
  let brow = p.brow;
  if (o.eye === 'spiral') e.spiral = 1; else if (o.eye === 'happy') e.happy = 1; else if (o.eye === 'squeeze') e.squeeze = 1; else if (o.eye === 'wide') { e.pup = 0.5; e.lid = 0; } else if (o.eye === 'lock') { e.pup = 1.3; e.look = 1; } else if (o.eye === 'angry') brow = 1;
  e.mad = clamp(brow, 0, 1) * 0.3;
  const stars = o.stars != null ? o.stars : p.stars;
  ctx.save();
  try {
    ctx.translate(x, y); ctx.scale(u * face, u); ctx.scale(sx, sy); ctx.translate(p.dx, -p.by + p.dy); ctx.rotate(p.rot);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // ---- tail: from the rump out to a curl (the curl is what grips the ring)
    {
      const R0 = [-11, 9], Cc = [p.tx, p.ty], dx = Cc[0] - R0[0], dy = Cc[1] - R0[1], d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, sgn = p.tc >= 0 ? 1 : -1, r0 = p.tr;
      const S = [Cc[0] + nx * r0 * sgn, Cc[1] + ny * r0 * sgn], pts = [R0];
      for (let i = 1; i < 6; i++) { const f = i / 6, bw = Math.sin(f * Math.PI) * p.tb; pts.push([lerp(R0[0], S[0], f) + nx * bw, lerp(R0[1], S[1], f) + ny * bw]); }
      const a0 = Math.atan2(S[1] - Cc[1], S[0] - Cc[0]), turns = Math.abs(p.tc), n = Math.max(2, Math.ceil(turns * 9));
      for (let i = 0; i <= n; i++) { const f = i / n, a = a0 - sgn * f * turns * TAU, r = r0 * (1 - 0.42 * f); pts.push([Cc[0] + Math.cos(a) * r, Cc[1] + Math.sin(a) * r]); }
      hose(ctx, pts, 6.4, C.fur, C.line, lw);
      ctx.beginPath(); spline(ctx, pts.slice(0, 6), false); ctx.lineWidth = 2; ctx.strokeStyle = C.furHi; ctx.stroke();
    }
    const limb = (ax, ay, bx, by2, l, w, far, dir) => { const k1 = ik(ax, ay, bx, by2, l, l, 1), k2 = ik(ax, ay, bx, by2, l, l, -1), k = (dir === 0 ? k1[1] > k2[1] : (k1[0] - k2[0]) * dir > 0) ? k1 : k2; hose(ctx, [[ax, ay], k, [bx, by2]], w, far ? C.furLo : C.fur, C.line, lw); return Math.atan2(by2 - k[1], bx - k[0]); };
    const foot = (fx, fy, far) => { ink(ctx, ellP(fx + 4, fy, 8, 4.3), far ? C.skinLo : C.skin, C.line, lw); if (!far) fillP(ctx, ellP(fx + 5, fy + 1.6, 5, 1.5), C.skinLo); };
    const arm = (far) => { const sx0 = far ? 9 : -6, sy0 = far ? -11 : -10, hx0 = far ? p.a1x : p.a0x, hy0 = far ? p.a1y : p.a0y;
      if (p.cross > 0.5) { const el = far ? [21, 4] : [-18, 5]; hose(ctx, [[sx0, sy0], el, [hx0, hy0]], 8.2, far ? C.furLo : C.furHi, C.line, lw); hand(ctx, hx0, hy0, far ? Math.PI : 0, 5.4, C, lw, 0, 1); return; }
      const a = limb(sx0, sy0, hx0, hy0, 22, 7, far, far ? 1 : hx0 > sx0 + 4 && p.ab <= 0.5 ? 0 : -1);
      if (!far && (p.ban > 0.5 || p.peel > 0.5)) { ctx.save(); ctx.translate(hx0, hy0);
        if (p.ban > 0.5) { ctx.rotate(p.ba); ctx.scale(1.3, 1.3); if (p.whole > 0.5) { hose(ctx, [[-2, 9], [-1, 0], [2, -10], [7, -18]], 7.6, C.ban, C.line, lw); ctx.beginPath(); spline(ctx, [[-0.5, 6], [0.5, 0], [3, -9]], false); ctx.lineWidth = 2.4; ctx.strokeStyle = C.banIn; ctx.stroke(); hose(ctx, [[7.5, -19], [9, -21.5]], 3, C.banTip, C.line, lw * 0.6); hose(ctx, [[-2.2, 10], [-2.6, 11.5]], 3, C.banTip, C.line, lw * 0.6); }
          else { if (p.bl > 0.05) hose(ctx, [[1, -6], [2 + 2 * p.bl, -7 - 13 * p.bl]], 6.4, C.banIn, C.line, lw); for (const [fx, fy] of [[-8, -2], [10, -3], [3, 1]]) hose(ctx, [[1.5, -7], [(fx + 1.5) / 2, -8], [fx, fy]], 4, C.banLo, C.line, lw); hose(ctx, [[-1, 8], [0, 0], [1.5, -7]], 7.6, C.ban, C.line, lw); } }
        else { ctx.rotate(-p.rot * 0.85); ctx.translate(0, 3); ctx.scale(1.2, 1.2); peelShape(ctx, C, lw, 0, t); }
        ctx.restore(); }
      hand(ctx, hx0, hy0, a, 5.2, C, lw, far ? 0 : p.hand, Math.max(p.grip, !far && (p.ban > 0.5 || p.peel > 0.5) ? 1 : 0));
    };
    // ---- far leg, torso, near leg
    limb(7, 11, p.f1x, p.f1y - 2, 15, 7.6, true, 1); foot(p.f1x, p.f1y, true);
    if (p.ab > 0.5) arm(true);
    const torso = [[-13, 13], [-15, 0], [-11, -13], [-3, -18], [6, -18], [12, -12], [15, 0], [13, 12], [5, 17], [-6, 17]];
    ink(ctx, blobP(torso), C.furLo, C.line, lw);
    fillP(ctx, blobP(inset(torso, 0.84, -1.5, -2)), C.fur);
    { const bt = p.cross > 0.5 ? -0.25 : Math.abs(p.turn), bx = p.cross > 0.5 ? -1 : -p.turn * 5; fillP(ctx, ellP(5.5 + bx, 1, 8.6 * (1 - 0.3 * bt), 12.5, 0.06), C.creamLo); fillP(ctx, ellP(5 + bx, 0, 7.6 * (1 - 0.3 * bt), 11, 0.06), C.cream); }
    fillP(ctx, ellP(-9, -9, 3, 6, 0.45), C.furHi);
    limb(-6, 11, p.f0x, p.f0y - 2, 15, 7.6, false, 1); foot(p.f0x, p.f0y, false);
    if (p.ab <= 0.5) arm(true);
    if (p.ab > 0.5) arm(false);
    // ---- head
    ctx.save();
    ctx.translate(p.hx, p.hy); ctx.rotate(p.hr); ctx.scale(p.hsc, p.hsc);
    if (stars > 0) dizzyStars(ctx, 0, -31, 23, 6.5, t, { n: Math.round(stars), layer: 'back', size: Math.max(5.5, 3.4 / u) });
    const tn = p.turn, fo = tn * 9, fk = 1 - 0.26 * Math.abs(tn);
    const earD = (bx, by2, r, far) => { ctx.save(); ctx.translate(bx, by2 + 2 * p.ear); ctx.rotate(-0.3 * p.ear * (far ? -1 : 1)); ink(ctx, ellP(0, 0, r * 0.92, r), far ? C.skinLo : C.skin, C.line, lw); fillP(ctx, ellP(far ? -1 : 1, 0.5, r * 0.5, r * 0.62), C.earIn); ctx.restore(); };
    earD(21 - fo * 0.3, -1, 8.2, true); earD(-22 - fo * 0.3, 1, 9.6, false);
    // hair tuft (stands on end when he is frightened)
    { const f = p.fluff, w = Math.sin(t * 50) * f; ctx.beginPath(); ctx.moveTo(-9, -19); ctx.lineTo(-8 - 3 * f, -27 - 9 * f); ctx.lineTo(-3, -23 - 2 * f); ctx.lineTo(0 + w, -31 - 12 * f); ctx.lineTo(4, -23 - 2 * f); ctx.lineTo(9 + 3 * f, -28 - 9 * f); ctx.lineTo(10, -18); ctx.closePath(); ctx.lineWidth = lw * 2; ctx.strokeStyle = C.line; ctx.stroke(); ctx.fillStyle = C.fur; ctx.fill(); }
    const ck = p.cheek, skull = [[0, -24], [13, -22], [22, -11], [24 + 2 * ck, 4], [17 + 2 * ck, 16], [4, 21], [-8, 20], [-19 - 2 * ck, 13], [-24 - ck, 0], [-20, -14], [-10, -22]];
    ink(ctx, blobP(skull), C.furLo, C.line, lw);
    fillP(ctx, blobP(inset(skull, 0.87, -1.5, -2.2)), C.fur);
    fillP(ctx, ellP(-9, -17.5, 7.5, 3, -0.4), C.furHi);
    // the face: a cream heart with a widow's peak, then the features (all slide and narrow when he turns away)
    ctx.save(); ctx.translate(fo, 0); ctx.scale(fk, 1);
    const fp = [[-15, -3], [-13, -12], [-5, -14.5], [3, -9], [10, -14], [18, -11], [21, -2], [20 + 2 * ck, 8], [13 + ck, 17], [4, 19], [-6, 17.5], [-14 - 2 * ck, 9]];
    fillP(ctx, blobP(fp), C.skinLo); fillP(ctx, blobP(inset(fp, 0.9, -0.8, -1)), C.cream);
    const browS = (bx, by2, len, dir) => { const a = (brow > 0 ? brow * 0.45 : brow * 0.35) * dir; ctx.save(); ctx.translate(bx, by2 + (brow > 0 ? brow * 2.4 : brow * 2)); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(-len, 0.6); ctx.quadraticCurveTo(0, -1.8, len, 0.6); ctx.lineWidth = lw * 1.25; ctx.strokeStyle = C.line; ctx.stroke(); ctx.restore(); };
    eyeDraw(ctx, 12, -3.5, 5.6, 7.3, e, C, lw, t, -1);
    eyeDraw(ctx, -5, -3, 6.9, 7.8, e, C, lw, t, 1);
    if (!(e.spiral > 0.5)) { browS(-6, -13.5, 5.5, 1); browS(12.5, -13.5, 4.4, -1); }
    // muzzle, nostrils, mouth
    fillP(ctx, ellP(5, 11.5, 11.5 + ck, 7.6, 0), C.skin);
    ctx.fillStyle = C.nose; ctx.beginPath(); ctx.ellipse(4.5, 6.4, 1.1, 1.5, 0.3, 0, TAU); ctx.ellipse(8.5, 6.4, 1.1, 1.5, -0.3, 0, TAU); ctx.fill();
    const mx = 6, my = 12.2, mw = lerp(8.5, 2.4, p.pucker), sm = p.smile * (1 - p.pucker * 0.5), jw = p.jaw;
    const lx0 = mx - mw, rx0 = mx + mw * 0.9, cy0 = my - sm * 2.4, cu = my + sm * 3.4, cl = cu + jw * 17, yu = (cy0 + cu) / 2, yl = (cy0 + cl) / 2;
    if (jw < 0.07) { ctx.beginPath(); ctx.moveTo(lx0, cy0); ctx.quadraticCurveTo(mx, cu, rx0, cy0); ctx.lineWidth = lw * 0.95; ctx.strokeStyle = C.line; ctx.stroke(); }
    else {
      const mp = (c) => { c.beginPath(); c.moveTo(lx0, cy0); c.quadraticCurveTo(mx, cu, rx0, cy0); c.quadraticCurveTo(mx, cl, lx0, cy0); c.closePath(); };
      ink(ctx, mp, C.mouth, C.line, lw * 0.6);
      if (jw > 0.3) fillP(ctx, ellP(mx, yl - jw * 2.8, mw * 0.5, jw * 2.2), C.tongue);
      if (p.teeth > 0.5 && jw > 0.2) { ctx.beginPath(); ctx.moveTo(lx0 + 1.8, cy0 + 0.6); ctx.quadraticCurveTo(mx, cu + 0.6, rx0 - 1.8, cy0 + 0.6); ctx.quadraticCurveTo(mx, cu + 0.6 + Math.min(4.5, jw * 5.5), lx0 + 1.8, cy0 + 0.6); ctx.fillStyle = C.tooth; ctx.fill(); }
    }
    if (p.tongue > 0.03) { const L2 = 7.5 * p.tongue, bx = mx + Math.cos(p.ta) * 2.5, by2 = yu + 1 + Math.sin(p.ta) * 1.5; hose(ctx, [[bx, by2], [bx + Math.cos(p.ta) * L2, by2 + Math.sin(p.ta) * L2]], 5, C.tongue, C.line, lw * 0.6); }
    ctx.restore();
    if (p.sweat > 0.05) for (let i = 0; i < 3; i++) { const f = fract(t * 1.7 + i / 3), a = -2.2 + i * 0.55, r0 = 28 + f * 15, dp = (c) => { c.beginPath(); c.moveTo(0, -5); c.quadraticCurveTo(3.4, 0, 0, 3); c.quadraticCurveTo(-3.4, 0, 0, -5); c.closePath(); }; ctx.save(); ctx.translate(Math.cos(a) * r0, Math.sin(a) * r0 + f * f * 8); ctx.rotate(a + Math.PI / 2); ctx.globalAlpha = p.sweat * (1 - f * f); ink(ctx, dp, C.sweat, C.line, lw * 0.6); ctx.restore(); }
    if (p.huff > 0.02) { const f = p.huff; ctx.save(); ctx.globalAlpha = 1 - f * f * f; for (const [bx, by2, r] of [[-6 - 9 * f, -34 - 14 * f, 5 + 5 * f], [-14 - 15 * f, -40 - 20 * f, 4 + 4 * f], [0 - 4 * f, -44 - 22 * f, 3 + 3 * f]]) ink(ctx, ellP(bx, by2, r, r * 0.85), C.puff, C.line, lw * 0.7); ctx.restore(); }
    if (p.zz > 0.5) for (let i = 0; i < 2; i++) { const f = fract(t * 0.45 + i * 0.5); zed(ctx, 22 + f * 6, -24, 3.6, f, C.line, C.cream); }
    if (stars > 0) dizzyStars(ctx, 0, -31, 23, 6.5, t, { n: Math.round(stars), layer: 'front', size: Math.max(5.5, 3.4 / u) });
    ctx.restore();
    if (p.ab <= 0.5) arm(false);
  } finally { ctx.restore(); }
  if (o.out) {
    const hc = Math.cos(p.hr), hs = Math.sin(p.hr), H = (lx, ly) => toPx(p.hx + (lx * hc - ly * hs) * p.hsc, p.hy + (lx * hs + ly * hc) * p.hsc);
    o.out.hand = toPx(p.a0x, p.a0y); o.out.mouth = H(6, 13); o.out.head = H(0, 0);
  }
}
