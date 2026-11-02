// The egg thieves (v3.6): the weasel, the rat and the Rat King on one four-legged rig (sim/thieves.js has the rules).
// Crisp cel-shaded code art: a dark outline only (never a pale rim or halo), two-tone shading, expressive faces.
//
// drawThief(ctx, x, y, s, t, pose, o, kind) draws one, seen from the side, in a local y-DOWN pixel space:
//   (x, y)  the floor point between its feet; it faces +x (o.face -1 mirrors it). s = px per 100 rig units
//           (RIG[kind].s m x px per metre).
//   pose    a pose object from thiefPose(kind, state, t, u, odo) (plain numbers, so poses blend)
//   o       {only: 'head' (the over-pass on a held egg), frozen (s left, or 0), zap 0..1, stars 0..3, sweat 0..1,
//            tears 0..1, eye: 'normal' | 'lock' | 'wide' | 'squeeze' | 'spiral' | 'happy' | 'angry', crown, cape,
//            out: {} receives mouth, nose and head {x, y} in the same px space}
// thiefPose states: idle (sniff), prowl (trot), stalk, crouch (u = telegraph), leap (u = flight), grab, carry, toss,
// trapped, hurt, stunned, bonk, laugh, defeated, stand (sits up: cards), and for the rat brace (behind the egg), push
// (rolling it), cross (sits up, furious), scared (bolts for the hole).
// Frozen and stunned follow the shared creature-state look (agent-brief-2): its own colours tinted toward #bfe6ff inside
// an ice shell that follows its silhouette with a dark-blue rim; stunned = slack pose, spiral eyes, tongue out, three stars.
import { RIG } from '../sim/thieves.js';
import { dizzyStars, spiralEye, boltStroke } from './status.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
const fract = (x) => x - Math.floor(x);
const hash = (n) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixHex = (a, b, k) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
const desat = (c, k) => { const A = hex(c), L = 0.299 * A[0] + 0.587 * A[1] + 0.114 * A[2]; return '#' + A.map((v) => Math.round(v + (L - v) * k).toString(16).padStart(2, '0')).join(''); };
const RIM = '#2f6f9e', SHELL = 'rgb(214,240,255)';

// ------------------------------------------------------------------ species
// line: the outline; fur/furLo/furHi: 2-tone body + back highlight; belly: the underside; skin: rat ears, nose, paws, tail
const PALS = {
  weasel: { line: '#2a1206', fur: '#a5582a', furLo: '#7c3d1a', furHi: '#c4733a', belly: '#f7e6c2', bellyLo: '#e2c99a', paw: '#7c3d1a', dark: '#3d1a08', nose: '#1d0b04', eyeW: '#fffaf0', iris: '#3a1a08', pupil: '#120602', mouth: '#4a1010', tongue: '#e0606a', earIn: '#d98a7a', tooth: '#ffffff' },
  rat: { line: '#1c1622', fur: '#8c8496', furLo: '#696172', furHi: '#a9a1b4', belly: '#d9d2de', bellyLo: '#bdb4c4', paw: '#ef9ea8', dark: '#4a4252', nose: '#e4707e', eyeW: '#fff6f6', iris: '#2a0c12', pupil: '#0c0306', mouth: '#4a1018', tongue: '#e0606a', earIn: '#f2a6b0', tooth: '#f6dc7a', tail: '#e7a0a8', tailLo: '#c97c88' },
  ratking: { line: '#1a1010', fur: '#8f7064', furLo: '#6c5148', furHi: '#ab8b7e', belly: '#cdbfb6', bellyLo: '#b0a096', paw: '#e2909a', dark: '#3a2a26', nose: '#d8606e', eyeW: '#fff2d8', iris: '#7a1010', pupil: '#120304', mouth: '#4a1018', tongue: '#e0606a', earIn: '#e8969e', tooth: '#f6dc7a', tail: '#d8909a', tailLo: '#b46c78', cape: '#a03cb4', capeLo: '#742485', gold: '#ffcf3a', goldLo: '#c8901a' },
};
const ICED = {};
for (const k in PALS) { ICED[k] = {}; for (const c in PALS[k]) ICED[k][c] = mixHex(desat(PALS[k][c], 0.75), '#a8d8f8', 0.6); }

// rig geometry (units: 100 = RIG[kind].s): rest height of the torso centre, feet, leg joints and lengths, head size
const SP = {
  weasel: { by: 26, feet: [32, 38, -38, -32], legF: [30, 7, 10, 12], legH: [-36, 6, 11, 12], hs: 1.5, neck: [38, -9], head: [12, -9], tailLen: 46, stride: 22, lift: 6, stand: [47, -11] },
  rat: { by: 22, feet: [24, 29, -26, -20], legF: [20, 8, 9, 10], legH: [-26, 7, 12, 12], hs: 1.4, neck: [26, -7], head: [11, -6], tailLen: 88, stride: 18, lift: 5, stand: [37, -5] },
};
SP.ratking = SP.rat;
const spOf = (kind) => SP[kind] || SP.weasel;
const isRat = (kind) => kind === 'rat' || kind === 'ratking';

// ------------------------------------------------------------------ poses
// by: torso centre height; dx: shift; pitch (+ nose up); st: stretch; sq: squash; hx, hy, hr: head offset and pitch; jaw 0..1;
// ear 0 up .. 1 flat back; look: pupils -1..1; lid 0 open .. 1 shut; brow -1 sad .. 1 fierce; tail: base angle (+ up), tc:
// curl, tw: wave; puff: bristle; tongue 0..1; whisk: whisker twitch; paw: front paws raised 0..1 (rat push)
const KEYS = ['by', 'dx', 'pitch', 'st', 'sq', 'hx', 'hy', 'hr', 'jaw', 'ear', 'look', 'lid', 'brow', 'tail', 'tc', 'tw', 'puff', 'tongue', 'whisk',
  'f0x', 'f0y', 'f1x', 'f1y', 'f2x', 'f2y', 'f3x', 'f3y'];
function rest(sp) {
  return { by: sp.by, dx: 0, pitch: 0, st: 1, sq: 0, hx: 0, hy: 0, hr: 0, jaw: 0, ear: 0, look: 0.3, lid: 0.2, brow: 0.3, tail: 0.15, tc: 0.4, tw: 0, puff: 0, tongue: 0, whisk: 0,
    f0x: sp.feet[0], f0y: 0, f1x: sp.feet[1], f1y: 0, f2x: sp.feet[2], f2y: 0, f3x: sp.feet[3], f3y: 0 };
}
// one gait cycle advances 2 x stride units; metres per cycle per species
export const cycleOf = (kind) => (2 * spOf(kind).stride * RIG[kind].s) / 100;
// a trot (weasel: bounding pairs; rat: scurry): diagonal pairs, feet planted in stance
function trot(sp, ph, L = sp.stride, lift = sp.lift, bound = 0) {
  const f = {};
  const offs = bound ? [0, 0.08, 0.5, 0.58] : [0, 0.5, 0.5, 0];
  sp.feet.forEach((x0, i) => {
    const p = fract(ph + offs[i]);
    let x, y;
    if (p < 0.5) { x = x0 + L / 2 - (p / 0.5) * L; y = 0; } else { const q = (p - 0.5) / 0.5; x = x0 - L / 2 + ss(0, 1, q) * L; y = -Math.sin(q * Math.PI) * lift; }
    f[`f${i}x`] = x; f[`f${i}y`] = y;
  });
  return f;
}
export function thiefPose(kind, state, t, u = 0, odo = 0) {
  const sp = spOf(kind), B = sp.by, R = rest(sp), P = (o) => Object.assign({}, R, o), rat = isRat(kind);
  const ph = (odo / cycleOf(kind)) || 0, bob = Math.sin(ph * TAU * 2), F = sp.feet;
  const arch = rat ? 0 : Math.sin(ph * TAU * 2) * 0.05; // the weasel's bounding back
  switch (state) {
    case 'prowl': return P({ ...trot(sp, ph, sp.stride, sp.lift, rat ? 0 : 1), by: B + 1.4 * bob, pitch: arch, hx: 2, hy: 2 + bob, hr: 0.08, tail: rat ? 0.05 : 0.2, tc: 0.3, tw: Math.sin(ph * TAU) * 0.3, ear: -0.1, look: 0.6, lid: 0.25, whisk: Math.sin(t * 9) });
    case 'stalk': return P({ ...trot(sp, ph, sp.stride * 0.7, sp.lift * 0.6), by: B * 0.8 + 0.6 * bob, pitch: -0.05, hx: 6, hy: 5, hr: 0.05, tail: 0, tc: 0.15, tw: Math.sin(t * 3) * 0.1, ear: -0.35, look: 1, lid: 0.45, brow: 0.9, whisk: Math.sin(t * 12) });
    case 'carry': return P({ ...trot(sp, ph, sp.stride * 0.85, sp.lift), by: B + 1.2 * bob, pitch: 0.04 + arch * 0.5, hx: 3, hy: rat ? 0 : 1, hr: rat ? -0.02 : -0.06, jaw: 0.8, tail: 0.6 + 0.1 * Math.sin(t * 7), tc: 0.6, tw: Math.sin(t * 7) * 0.3, ear: 0.1, look: 0.8, lid: 0.5, brow: 0.7 });
    case 'scared': return P({ ...trot(sp, ph, sp.stride * 1.2, sp.lift * 1.3, rat ? 0 : 1), by: B * 0.85 + bob, pitch: -0.04, hx: 4, hy: 2, hr: 0.15, jaw: 0.35, tail: rat ? 0.15 : 0.5, tc: 0.1, tw: Math.sin(t * 18) * 0.25, ear: 1, look: -0.6, lid: 0, brow: -0.8, puff: 0.6, whisk: Math.sin(t * 20) });
    case 'defeated': return P({ ...trot(sp, ph, sp.stride * 0.7, sp.lift * 0.7), by: B * 0.85 + 1.5 * Math.abs(bob), pitch: -0.08, hx: 3, hy: 8, hr: 0.45, tail: rat ? -0.05 : -0.5, tc: -0.2, tw: Math.sin(t * 3) * 0.06, ear: 1, lid: 0.8, brow: -1, jaw: 0.25 + 0.15 * Math.max(0, Math.sin(t * 8)) });
    case 'crouch': { // drop low, rump up, wiggle faster toward the spring, tail lashing, eyes locked
      const e = ss(0, 0.35, u), w = Math.sin(t * (14 + 10 * u)) * e;
      return P({ by: lerp(B, B * 0.6, e), dx: w * 1.8, pitch: lerp(0, -0.14, e) + w * 0.03, hx: lerp(0, 7, e), hy: lerp(0, 4, e), hr: lerp(0, -0.16, e), ear: lerp(0, -0.45, e), look: 1, lid: lerp(0.3, 0.55, e), brow: 1,
        tail: lerp(0.2, 0.1, e), tc: 0.2, tw: Math.sin(t * 13) * 0.4 * e, f0x: F[0] + 8 * e, f1x: F[1] + 8 * e, f2x: F[2] - 4 * e, f3x: F[3] - 4 * e, whisk: Math.sin(t * 16) });
    }
    case 'leap': { // spring: stretched out, forelegs reaching, hind legs kicked back; tuck at the top, forelegs down to land
      const tuck = Math.sin(clamp(u, 0, 1) * Math.PI), land = ss(0.7, 1, u);
      return P({ by: B, st: 1.14 - 0.1 * tuck * (1 - land), hx: 5, hy: -2, hr: lerp(-0.15, 0.25, land), jaw: lerp(0.75, 0.4, land), ear: 0.75, look: 1, lid: 0.1, brow: 1, tail: -0.05, tc: -0.1, tw: 0.15 * Math.sin(t * 9),
        f0x: lerp(F[0] + 40, F[0] + 14, land), f0y: lerp(-B * 0.6, -4, land), f1x: lerp(F[1] + 34, F[1] + 14, land), f1y: lerp(-B * 0.5, -3, land), f2x: lerp(F[2] - 40, F[2] - 8, tuck * 0.6), f2y: lerp(-B * 0.5, -B * 0.25, tuck), f3x: lerp(F[3] - 36, F[3] - 6, tuck * 0.6), f3y: lerp(-B * 0.4, -B * 0.2, tuck) });
    }
    case 'grab': { const d = Math.sin(clamp(u, 0, 1) * Math.PI); // head dips, jaws snap shut on the egg
      return P({ by: B * 0.85, pitch: -0.08 * d, hx: 8 * d + 2, hy: 8 * d, hr: 0.3 * d, jaw: lerp(0.8, 0.42, ss(0.35, 0.7, u)), ear: 0.2, look: 1, lid: 0.35, brow: 1, tail: 0.4, tw: Math.sin(t * 10) * 0.2, f0x: F[0] + 6, f1x: F[1] + 6 });
    }
    case 'toss': { const w = ss(0, 0.75, u), f = ss(0.75, 1, u); // wind-up: head back, then a flick up and forward
      return P({ by: B, pitch: lerp(0, 0.12, w) - 0.18 * f, hx: lerp(0, -6, w) + 10 * f, hy: lerp(0, -6, w) - 3 * f, hr: lerp(0, -0.5, w) + 0.6 * f, jaw: 0.25 + 0.6 * f, ear: 0.3, look: 0.6, lid: 0.55, brow: 1, tail: 0.5 + 0.3 * w, tw: Math.sin(t * 8) * 0.2 });
    }
    case 'trapped': { const sp2 = t * 15; // scrabbling: paws paddle fast in place, ears flat, tail bristled
      return P({ by: B * 0.75 + Math.sin(sp2 * 2) * 1.2, dx: Math.sin(t * 37) * 1, pitch: 0.12 + Math.sin(t * 9) * 0.05, hx: 3, hy: -3, hr: -0.4 + Math.sin(t * 11) * 0.12, jaw: 0.45 + 0.25 * Math.sin(t * 13), ear: 1, look: Math.sin(t * 5), lid: 0, brow: -0.6, tail: 0.45, tc: 0.9, tw: Math.sin(t * 23) * 0.3, puff: 1,
        f0x: F[0] + 4 + Math.cos(sp2) * 9, f0y: -Math.max(0, Math.sin(sp2)) * B * 0.45, f1x: F[1] + 4 + Math.cos(sp2 + 3.1) * 9, f1y: -Math.max(0, Math.sin(sp2 + 3.1)) * B * 0.45,
        f2x: F[2] + Math.cos(sp2 * 1.3 + 1) * 6, f2y: -Math.max(0, Math.sin(sp2 * 1.3 + 1)) * B * 0.25, f3x: F[3] + Math.cos(sp2 * 1.3 + 4) * 6, f3y: -Math.max(0, Math.sin(sp2 * 1.3 + 4)) * B * 0.25 });
    }
    case 'hurt': { const k = Math.sin(clamp(u, 0, 1) * Math.PI); // a jolt: thrown back and squashed, eyes squeezed, a yelp
      return P({ by: B * (0.9 - 0.15 * k), dx: -5 * k, sq: 0.12 * k, pitch: 0.2 * k, hx: -3 * k, hy: -5 * k, hr: -0.5 * k, jaw: 0.8 * k, ear: 1, lid: 1, brow: -1, tail: 0.9 * k, tc: 1, puff: k, f0x: F[0] + 4, f1x: F[1] + 4 });
    }
    case 'stunned': { const w = Math.sin(t * 2.2); // slack: head droops, body sags with a slow wobble, tongue out
      return P({ by: B * 0.72 + 1.2 * w, dx: w * 1.2, pitch: -0.1 + w * 0.05, hx: 3 + 2 * w, hy: 9, hr: 0.55 + 0.1 * w, jaw: 0.4, tongue: 1, ear: 0.85, lid: 0, brow: -0.8, tail: -0.3, tc: -0.1, tw: w * 0.05,
        f0x: F[0] + 6, f1x: F[1] + 6, f2x: F[2] - 4, f3x: F[3] - 4 });
    }
    case 'bonk': { const k = 1 - ss(0, 1, u); // the pounce was blocked: flattened, then shakes it off
      return P({ by: lerp(B * 0.9, B * 0.5, k), sq: 0.22 * k, pitch: -0.06 * k, hx: 3, hy: 5 * k, hr: 0.3 * k, jaw: 0.2, ear: k + 0.2, lid: 0.6 * k, brow: -0.5, tail: -0.2 * k + 0.2, puff: 0.6 * k, f0x: F[0] + 14, f1x: F[1] + 14, f2x: F[2] - 10, f3x: F[3] - 10 });
    }
    case 'laugh': case 'cross': { // sits up on its haunches: a cackle, or (cross) a furious squeak
      const cr = state === 'cross', h = Math.abs(Math.sin(t * (cr ? 14 : 9)));
      const pt = rat ? 0.75 : 0.6;
      return P({ by: B * 1.15 + (rat ? 7 : 2) + 2 * h, dx: -6, pitch: pt, hx: 2, hy: -4 - 1.5 * h, hr: cr ? pt * 0.6 - 0.05 - 0.06 * h : pt * 0.6 - 0.55 - 0.08 * h, jaw: cr ? 0.5 + 0.4 * h : 0.6 + 0.3 * h, ear: cr ? 0.6 : 0.15, lid: cr ? 0.35 : 1, brow: cr ? 1 : 0.6, tail: pt + (rat ? 0.15 : -0.1), tc: 0.9, tw: Math.sin(t * 9) * 0.2,
        f0x: F[0] - 14, f0y: -B * 0.9, f1x: F[1] - 16, f1y: -B * 0.8, f2x: F[2] + 8, f3x: F[3] + 10, whisk: Math.sin(t * 25) });
    }
    case 'stand': { // up on its hind legs, periscope style (cards)
      const br = Math.sin(t * 2.2);
      const [sb, sd] = sp.stand, sh = { x: sd + sp.legF[0] * Math.cos(1.2) + sp.legF[1] * Math.sin(1.2), y: -sb - sp.legF[0] * Math.sin(1.2) + sp.legF[1] * Math.cos(1.2) };
      return P({ by: sb + br, dx: sd, pitch: 1.2, hx: 2, hy: -2, hr: 0.58 + 0.04 * Math.sin(t * 1.3), ear: 0, look: 0.4, lid: 0.25, brow: 0.5, tail: rat ? 1.32 : 1.08, tc: 0.7, tw: Math.sin(t * 1.6) * 0.15,
        f0x: sh.x + 7, f0y: sh.y + 16, f1x: sh.x + 4, f1y: sh.y + 15, f2x: F[2] + 18, f3x: F[3] + 22, whisk: Math.sin(t * 7) });
    }
    case 'brace': { // the rat behind the egg: head down, nose to the shell, front paws up on it, haunches bunched
      const e = ss(0, 0.3, u), w = Math.sin(t * (12 + 10 * u)) * e;
      return P({ by: lerp(B, B * 0.78, e), dx: w * 1.4, pitch: lerp(0, -0.12, e), hx: 4, hy: lerp(0, 3, e), hr: lerp(0, 0.18, e), ear: lerp(0, -0.3, e), look: 1, lid: 0.4, brow: 1,
        tail: 0.1, tc: 0.4, tw: Math.sin(t * 10) * 0.3 * e, f0x: F[0] + 10 * e, f0y: -B * 0.55 * e, f1x: F[1] + 8 * e, f1y: -B * 0.4 * e, f2x: F[2] - 6 * e, f3x: F[3] - 6 * e, whisk: Math.sin(t * 22) });
    }
    case 'push': { // rolling it: low, nose and front paws on the egg, the hind legs do the walking
      const g = trot(sp, ph, sp.stride * 0.8, sp.lift * 0.6);
      return P({ ...g, f0x: F[0] + 10 + Math.sin(ph * TAU) * 2, f0y: -B * 0.55 - Math.max(0, Math.sin(ph * TAU)) * 2, f1x: F[1] + 8 + Math.sin(ph * TAU + 3) * 2, f1y: -B * 0.42 - Math.max(0, Math.sin(ph * TAU + 3)) * 2,
        by: B * 0.8 + 0.8 * bob, pitch: -0.12, hx: 4, hy: 3, hr: 0.2, ear: -0.2, look: 1, lid: 0.45, brow: 0.9, tail: 0.15, tc: 0.3, tw: Math.sin(ph * TAU) * 0.3, whisk: Math.sin(t * 14) });
    }
    default: { // idle: stands and sniffs in short bursts, ears twitch, whiskers quiver, tail sways
      const sn = Math.max(0, Math.sin(t * 0.9)), bur = Math.sin(t * 22) * ss(0.4, 0.8, sn), tw = slotTwitch(t);
      return P({ by: B + Math.sin(t * 2.4) * 0.6, hx: 2 + 3 * sn, hy: 8 * sn - 1, hr: 0.45 * sn + 0.05 * bur, ear: -0.1 + tw * 0.4, look: 0.5 + 0.4 * sn, lid: 0.25, tail: 0.2 + 0.06 * Math.sin(t * 1.7), tc: 0.5, tw: Math.sin(t * 1.9) * 0.18, whisk: bur * 2 + Math.sin(t * 5) * 0.3 });
    }
  }
}
function slotTwitch(t) { const k = Math.floor(t / 2.3), f = fract(t / 2.3); return hash(k) > 0.5 ? Math.sin(clamp((f - 0.3) / 0.08, 0, 1) * Math.PI) : 0; }

// eased pose blending per thief id: every pose change glides over ~0.12 s
const MEM = {};
export function thiefBlend(id, pose, t, rate = 9) {
  let m = MEM[id];
  if (!m || t < m.t - 0.5 || t - m.t > 1) { m = MEM[id] = { t, p: { ...pose } }; return m.p; }
  const a = 1 - Math.exp(-(t - m.t) * rate);
  m.t = t;
  for (const k of KEYS) m.p[k] += (pose[k] - m.p[k]) * a;
  return m.p;
}

// ------------------------------------------------------------------ drawing
function ik(jx, jy, fx, fy, a, b) {
  let dx = fx - jx, dy = fy - jy, d = Math.hypot(dx, dy);
  const m = a + b - 0.3;
  if (d > m) { fx = jx + (dx / d) * m; fy = jy + (dy / d) * m; dx = fx - jx; dy = fy - jy; d = m; }
  d = Math.max(d, Math.abs(a - b) + 0.5);
  const base = Math.atan2(dy, dx), A = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
  const k1 = { x: jx + a * Math.cos(base + A), y: jy + a * Math.sin(base + A) }, k2 = { x: jx + a * Math.cos(base - A), y: jy + a * Math.sin(base - A) };
  return { knee: k1.x < k2.x ? k1 : k2, fx, fy };
}
const pathOf = (pts, close = true) => (c) => { c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); if (close) c.closePath(); };
// a smooth closed path through points (quadratic midpoints)
const blob = (pts) => (c) => {
  c.beginPath();
  const n = pts.length, mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  let m = mid(pts[n - 1], pts[0]);
  c.moveTo(m.x, m.y);
  for (let i = 0; i < n; i++) { m = mid(pts[i], pts[(i + 1) % n]); c.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y); }
  c.closePath();
};

export function drawThief(ctx, x, y, s, t, pose, o = {}, kind = 'weasel') {
  if (!(s > 0)) return;
  const rat = isRat(kind), king = kind === 'ratking', sp = spOf(kind), frozen = o.frozen > 0, only = o.only;
  const C = frozen ? ICED[kind] : PALS[kind], PAL = PALS[kind];
  const u = s / 100, ow = Math.max(2.6, 1.2 / u); // outline half-width in units (never under ~1.2 px)
  const p = pose, HS = sp.hs;
  ctx.save();
  try {
    ctx.translate(x, y);
    if (frozen && o.frozen < 1) ctx.translate(Math.sin(t * 70) * 0.6 * (1 - o.frozen), 0); // the last second: it shivers
    ctx.scale(u * (o.face < 0 ? -1 : 1), u);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const cx = p.dx, cy = -p.by, cp = Math.cos(p.pitch), sn = Math.sin(p.pitch), sy = 1 - p.sq, sx = p.st * (1 + p.sq * 0.6);
    const T = (lx, ly) => ({ x: cx + (lx * sx) * cp + (ly * sy) * sn, y: cy - (lx * sx) * sn + (ly * sy) * cp });
    // ---- torso
    const torsoPath = rat
      ? blob([T(-40, 8), T(-44, -6), T(-36, -20), T(-20, -24), T(0, -20), T(18, -14), T(30, -9), T(33, 2), T(26, 10), T(6, 13), T(-16, 14), T(-32, 13)])
      : blob([T(-50, 4), T(-52, -6), T(-42, -13), T(-14, -14), T(14, -12), T(36, -12), T(46, -6), T(44, 6), T(30, 10), T(6, 10), T(-24, 10), T(-42, 9)]);
    // ---- head frame: neck point on the torso, then the skull centre
    const N = T(sp.neck[0], sp.neck[1]), hcx = N.x + sp.head[0] + p.hx, hcy = N.y + sp.head[1] + p.hy - p.pitch * 14, hr = p.hr - p.pitch * 0.6;
    const hc = Math.cos(hr) * HS, hs = Math.sin(hr) * HS;
    const H = (lx, ly) => ({ x: hcx + lx * hc - ly * hs, y: hcy + lx * hs + ly * hc });
    const jawA = p.jaw * 0.6, JP = { x: rat ? -2 : 0, y: 5 };
    const J = (lx, ly) => { const dx = lx - JP.x, dy = ly - JP.y, c = Math.cos(jawA), s2 = Math.sin(jawA); return H(JP.x + dx * c - dy * s2, JP.y + dx * s2 + dy * c); };
    // skull + snout as one shape (weasel: a short blunt wedge; rat: a long pointed cone)
    const skull = rat
      ? blob([H(-14, -2), H(-12, -11), H(-2, -13), H(10, -10), H(22, -6), H(32, -1.5), H(33, 1.5), H(24, 5), H(10, 8), H(-4, 9), H(-12, 6)])
      : blob([H(-14, 0), H(-12, -10), H(-2, -13), H(10, -11), H(20, -6), H(27, -2), H(27, 2), H(18, 5), H(6, 8), H(-6, 9), H(-13, 6)]);
    const jaw = rat ? pathOf([J(-2, 5), J(22, 5), J(20, 8), J(6, 9.5), J(-2, 9)]) : pathOf([J(0, 4.5), J(22, 3.6), J(20, 7.5), J(8, 9.5), J(0, 9)]);
    const neck = pathOf(rat ? [T(10, -14), T(34, 4), H(4, 8), H(-10, 0)] : [T(20, -12), T(46, 2), H(4, 8), H(-11, -2)]);
    // ears: the weasel's small and round, low on the head; the rat's big, round and pink inside
    const ear = (back) => {
      const er = rat ? (king ? 9.5 : 9) : 5.5, ea = -p.ear * 0.9 + (back ? 0.2 : 0);
      const b = rat ? H(-5 + (back ? -4 : 0), -10 + (back ? 1 : 0)) : H(-7 + (back ? -4 : 0), -9 + (back ? 1 : 0));
      const c = Math.cos(ea + hr - 0.25) * HS, s2 = Math.sin(ea + hr - 0.25) * HS, R2 = (lx, ly) => ({ x: b.x + lx * c - ly * s2, y: b.y + lx * s2 + ly * c });
      const sq = rat ? 0.92 - 0.5 * clamp(p.ear, 0, 1) : 1;
      const pts = []; for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; pts.push(R2(Math.cos(a) * er * 0.82 * sq, -er * 0.95 + Math.sin(a) * er)); }
      const inner = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; inner.push(R2(Math.cos(a) * er * 0.5 * sq + er * 0.08, -er * 0.95 + Math.sin(a) * er * 0.62)); }
      return { path: blob(pts), inner: blob(inner) };
    };
    // tail: the weasel's a furry taper with a dark tip; the rat's long, naked and pink
    const tailP = (() => {
      const base = rat ? T(-40, -4) : T(-49, -4), n = rat ? 16 : 10, len = sp.tailLen * (1 + p.puff * 0.06), ctr = [];
      let a = Math.PI + p.pitch - p.tail, px = base.x, py = base.y;
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        ctr.push({ x: px, y: py, a });
        a += (-p.tc * (rat ? 0.07 : 0.14) + p.tw * Math.sin(f * 3 + (rat ? t * 2 : 0)) * (rat ? 0.09 : 0.12)) * (0.4 + f) + (rat ? Math.sin(f * 5 + 1) * 0.05 : 0);
        px += Math.cos(a) * (len / n); py -= Math.sin(a) * (len / n);
      }
      const w = rat ? (f) => 4.2 * (1 - f) + 0.9 : (f) => (5 + 5 * Math.sin(Math.min(1, f * 1.4) * Math.PI * 0.6) - 4.5 * ss(0.75, 1, f)) * (1 + p.puff * 0.4);
      const L = [], Rr = [];
      ctr.forEach((q, i) => { const f = i / n, nx = Math.sin(q.a), ny = Math.cos(q.a), ww = w(f); L.push({ x: q.x + nx * ww, y: q.y + ny * ww }); Rr.push({ x: q.x - nx * ww, y: q.y - ny * ww }); });
      const tip = ctr[n];
      return { ctr, path: (c) => {
        c.beginPath(); c.moveTo(L[0].x, L[0].y);
        for (let i = 1; i <= n; i++) c.lineTo(L[i].x, L[i].y);
        c.quadraticCurveTo(tip.x + Math.cos(tip.a) * (rat ? 1.5 : 6), tip.y - Math.sin(tip.a) * (rat ? 1.5 : 6), Rr[n].x, Rr[n].y);
        for (let i = n - 1; i >= 0; i--) c.lineTo(Rr[i].x, Rr[i].y);
        c.closePath();
      } };
    })();
    // legs
    const [jfx, jfy, fa, fb] = sp.legF, [jhx, jhy, ha, hb] = sp.legH;
    const legs = [
      { j: T(jfx, jfy), f: [p.f0x, p.f0y], a: fa, b: fb, w0: rat ? 8 : 9, w1: rat ? 5.5 : 6.5, far: false, front: true },
      { j: T(jfx + 4, jfy - 2), f: [p.f1x, p.f1y], a: fa, b: fb, w0: rat ? 7 : 8, w1: rat ? 5 : 6, far: true, front: true },
      { j: T(jhx, jhy), f: [p.f2x, p.f2y], a: ha, b: hb, w0: rat ? 11 : 10, w1: rat ? 6 : 6.5, far: false, front: false },
      { j: T(jhx + 5, jhy - 2), f: [p.f3x, p.f3y], a: ha, b: hb, w0: rat ? 10 : 9, w1: rat ? 5.5 : 6, far: true, front: false },
    ].map((L) => { const r = ik(L.j.x, L.j.y, L.f[0], L.f[1], L.a, L.b); return { ...L, k: r.knee, fx: r.fx, fy: r.fy }; });

    // ---- passes: 'outline' (dark), 'rim' / 'ice' (the frozen shell, drawn first), 'fill'
    const SH = 5, RW = 2; // ice shell thickness beyond the outline, its dark rim (units)
    const fillPath = (path, pass, fill) => {
      path(ctx);
      if (pass === 'outline') { ctx.strokeStyle = C.line; ctx.lineWidth = 2 * ow; ctx.stroke(); }
      else if (pass === 'rim') { ctx.strokeStyle = RIM; ctx.lineWidth = 2 * (ow + SH); ctx.stroke(); ctx.fillStyle = RIM; ctx.fill(); }
      else if (pass === 'ice') { ctx.strokeStyle = SHELL; ctx.lineWidth = 2 * (ow + SH - RW); ctx.stroke(); ctx.fillStyle = SHELL; ctx.fill(); }
      else { ctx.fillStyle = fill; ctx.fill(); }
    };
    const drawLimb = (L, pass) => {
      const lw = (w) => (pass === 'outline' ? w + 2 * ow : pass === 'rim' ? w + 2 * ow + 2 * SH : pass === 'ice' ? w + 2 * ow + 2 * SH - 2 * RW : w);
      const col = pass === 'outline' ? C.line : pass === 'rim' ? RIM : pass === 'ice' ? SHELL : null;
      const seg = (a, b, w, c2) => { ctx.strokeStyle = col || c2; ctx.lineWidth = lw(w); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };
      const Fp = { x: L.fx, y: L.fy }, furc = L.far ? C.furLo : C.fur;
      seg(L.j, L.k, L.w0, furc);
      seg(L.k, Fp, L.w1, rat ? (L.far ? C.furLo : C.fur) : furc);
      // paw (the rat's pink; the hind foot long)
      ctx.fillStyle = col || (rat ? C.paw : L.far ? C.dark : C.paw);
      const pw = rat && !L.front ? 6.5 : 4.2, ph2 = rat ? 2.6 : 3.2, grow = col ? lw(0) / 2 : 0;
      ctx.beginPath(); ctx.ellipse(Fp.x + (rat && !L.front ? 3 : 1.5), Fp.y - 1.5, pw + grow, ph2 + grow, 0, 0, TAU); ctx.fill();
    };
    const earN = ear(false), earF = ear(true);
    const headParts = (pass) => { fillPath(skull, pass, C.fur); };
    const groups = only === 'head'
      ? [(pass) => fillPath(earF.path, pass, C.furLo), (pass) => headParts(pass), (pass) => fillPath(earN.path, pass, C.fur)]
      : [
        (pass) => { for (const L of legs) if (L.far) drawLimb(L, pass); },
        (pass) => fillPath(tailP.path, pass, rat ? C.tail : C.fur),
        (pass) => fillPath(earF.path, pass, C.furLo),
        (pass) => { if (p.jaw > 0.05) fillPath(jaw, pass, C.fur); fillPath(torsoPath, pass, C.fur); fillPath(neck, pass, C.fur); if (pass === 'fill') { torsoShade(); if (o.cape) { cape(); headParts('outline'); } } headParts(pass); },
        (pass) => { for (const L of legs) if (!L.far) drawLimb(L, pass); },
        (pass) => fillPath(earN.path, pass, C.fur),
      ];
    if (frozen) { for (const g of groups) g('rim'); for (const g of groups) g('ice'); }
    const headTop = H(-3, -20);
    if (o.stars > 0) dizzyStars(ctx, headTop.x, headTop.y - 6, 17, 5, t, { n: Math.round(o.stars), layer: 'back', size: Math.max(5, 3.4 / u) });
    groups.forEach((g, gi) => {
      g('outline'); g('fill');
      if (only === 'head' && gi === 1) headDetails();
      if (only !== 'head') {
        if (gi === 1) tailDetail();
        if (gi === 3) headDetails();
      }
      if ((only !== 'head' && gi === 5) || (only === 'head' && gi === 2)) fillPath(earN.inner, 'fill', rat ? C.earIn : C.earIn);
      if ((only !== 'head' && gi === 2) || (only === 'head' && gi === 0)) fillPath(earF.inner, 'fill', rat ? mixHex(C.earIn, C.line, 0.25) : mixHex(C.earIn, C.line, 0.3));
    });
    if (o.crown) crown();
    function crown() { // the Rat King's crown, set between the ears
      const Pp = [[-15, -12], [-17, -27], [-10, -20], [-5, -31], [0, -20], [7, -27], [6, -11]].map(([a, b]) => H(a, b));
      ctx.beginPath(); Pp.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath();
      ctx.strokeStyle = C.line; ctx.lineWidth = 2 * ow; ctx.stroke();
      ctx.fillStyle = frozen ? mixHex('#ffcf3a', '#bfe6ff', 0.55) : '#ffcf3a'; ctx.fill();
      const lo = [H(-15, -12), H(6, -11), H(6.5, -15), H(-15.5, -16)];
      ctx.fillStyle = frozen ? mixHex('#c8901a', '#bfe6ff', 0.55) : '#c8901a'; ctx.beginPath(); lo.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.fill();
      for (const [gx, gy, col] of [[-5, -16, '#e0312b'], [-12, -15, '#3a8ae0'], [2, -15, '#3ab04a']]) { const g = H(gx, gy); ctx.fillStyle = frozen ? '#9fc6e6' : col; ctx.beginPath(); ctx.arc(g.x, g.y, 2.2, 0, TAU); ctx.fill(); ctx.lineWidth = ow * 0.5; ctx.strokeStyle = C.line; ctx.stroke(); }
    }
    function cape() { // a royal cape over the shoulders, trailing down the back
      const P2 = [T(28, -12), T(18, -18), T(-4, -22), T(-28, -22), T(-40, -10), T(-38, 6), T(-22, 4), T(-8, 0), T(10, -2), T(24, -2)];
      const pth = blob(P2);
      pth(ctx); ctx.strokeStyle = C.line; ctx.lineWidth = 2 * ow; ctx.stroke(); ctx.fillStyle = C.cape; ctx.fill();
      ctx.save(); pth(ctx); ctx.clip();
      ctx.fillStyle = C.capeLo; const a = T(-50, -2), b = T(40, 0); ctx.fillRect(Math.min(a.x, b.x) - 40, Math.min(a.y, b.y), 200, 60);
      ctx.restore();
      // a gold clasp at the throat
      const q = T(26, -6); ctx.beginPath(); ctx.arc(q.x, q.y, 3.6, 0, TAU); ctx.fillStyle = frozen ? mixHex('#ffcf3a', '#bfe6ff', 0.55) : '#ffcf3a'; ctx.fill(); ctx.lineWidth = ow * 0.7; ctx.strokeStyle = C.line; ctx.stroke();
    }
    function tailDetail() {
      ctx.save(); tailP.path(ctx); ctx.clip();
      if (rat) { // a darker underside and the ring segments of a naked tail
        ctx.strokeStyle = C.tailLo; ctx.lineWidth = 1.2;
        tailP.ctr.forEach((q, i) => { if (i < 1 || i % 2) return; const nx = Math.sin(q.a), ny = Math.cos(q.a); ctx.beginPath(); ctx.moveTo(q.x - nx * 6, q.y - ny * 6); ctx.lineTo(q.x + nx * 6, q.y + ny * 6); ctx.stroke(); });
      } else { // the dark tip
        const q = tailP.ctr[tailP.ctr.length - 1];
        ctx.fillStyle = C.dark; ctx.beginPath(); ctx.arc(q.x, q.y, 15, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    function torsoShade() {
      ctx.save(); torsoPath(ctx); ctx.clip();
      // the belly (cream on the weasel with a crisp line, pale grey on the rat) and a cel shade under it
      ctx.fillStyle = C.belly;
      const a = T(-60, rat ? 5 : 2), m1 = T(-10, rat ? 3 : 0), b = T(60, rat ? -2 : -2);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(m1.x, m1.y, b.x, b.y); ctx.lineTo(b.x, b.y + 50); ctx.lineTo(a.x, a.y + 50); ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.bellyLo;
      const a2 = T(-60, 10), b2 = T(60, 8);
      ctx.beginPath(); ctx.moveTo(a2.x, a2.y); ctx.lineTo(b2.x, b2.y); ctx.lineTo(b2.x, b2.y + 40); ctx.lineTo(a2.x, a2.y + 40); ctx.closePath(); ctx.fill();
      // fur shade on the flank and a back highlight
      ctx.fillStyle = C.furLo;
      const s0 = T(-46, -2), s1 = T(-20, -6), s2 = T(10, -4);
      ctx.beginPath(); ctx.moveTo(s0.x, s0.y); ctx.quadraticCurveTo(s1.x, s1.y, s2.x, s2.y); ctx.quadraticCurveTo(T(-14, 2).x, T(-14, 2).y, s0.x, s0.y); ctx.fill();
      ctx.fillStyle = C.furHi;
      const h0 = rat ? T(-34, -18) : T(-40, -11), h1 = rat ? T(-16, -24) : T(-10, -14), h2 = rat ? T(6, -16) : T(30, -11), h3 = rat ? T(-14, -17) : T(-6, -9);
      ctx.beginPath(); ctx.moveTo(h0.x, h0.y); ctx.quadraticCurveTo(h1.x, h1.y - 2, h2.x, h2.y); ctx.quadraticCurveTo(h3.x, h3.y, h0.x, h0.y); ctx.fill();
      ctx.restore();
      // haunch line
      ctx.strokeStyle = C.line; ctx.lineWidth = ow * 0.6;
      const k0 = rat ? T(-14, -14) : T(-24, -8), k1 = rat ? T(-12, 2) : T(-22, 4), k2 = rat ? T(-26, 10) : T(-34, 8);
      ctx.beginPath(); ctx.moveTo(k0.x, k0.y); ctx.quadraticCurveTo(k1.x, k1.y, k2.x, k2.y); ctx.stroke();
      // the throat: cream (weasel) or pale (rat) under the head, into the chest
      ctx.save(); neck(ctx); ctx.clip();
      ctx.fillStyle = C.belly;
      const r = [H(-6, 4), H(10, 6), T(rat ? 40 : 50, 4), T(rat ? 28 : 36, 8), T(rat ? 18 : 24, 0)];
      ctx.beginPath(); r.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    function headDetails() {
      // lower face: the weasel's cream jaw and lips, the rat's paler muzzle
      ctx.save(); skull(ctx); ctx.clip();
      ctx.fillStyle = C.belly;
      const m = rat ? [H(-14, 4), H(4, 2.5), H(20, 1.5), H(34, 1), H(34, 12), H(-14, 12)] : [H(-14, 3), H(-2, 2.5), H(12, 1), H(22, 0.5), H(30, 0.5), H(30, 12), H(-14, 12)];
      ctx.beginPath(); m.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); ctx.fill();
      // cel shade at the back of the head
      ctx.fillStyle = C.furLo; const b0 = H(-16, -14), b1 = H(-6, -2), b2 = H(-16, 8);
      ctx.beginPath(); ctx.moveTo(b0.x, b0.y); ctx.quadraticCurveTo(b1.x, b1.y, b2.x, b2.y); ctx.lineTo(H(-20, 8).x, H(-20, 8).y); ctx.lineTo(H(-20, -14).x, H(-20, -14).y); ctx.closePath(); ctx.fill();
      ctx.restore();
      if (p.jaw > 0.05) { // open mouth: dark inside, teeth, the lower jaw
        const mp = rat ? [H(0, 4.5), H(26, 3.5), J(22, 5), J(-2, 6)] : [H(2, 4), H(24, 2.6), J(22, 3.6), J(0, 5.5)];
        ctx.fillStyle = C.mouth; ctx.beginPath(); mp.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); ctx.fill();
        if (rat) { const a = H(23, 3), b = H(28, 3), c = H(27.5, 8), d = H(23.5, 8); ctx.fillStyle = C.tooth; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill(); ctx.lineWidth = ow * 0.4; ctx.strokeStyle = C.line; ctx.stroke(); }
        else { ctx.fillStyle = C.tooth; for (const tx of [19, 11]) { const a = H(tx - 1.4, 3.2), b = H(tx + 1.4, 3.2), c = H(tx, 6.2); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.fill(); } }
        fillPath(jaw, 'fill', C.belly);
        ctx.strokeStyle = C.line; ctx.lineWidth = ow * 0.7; jaw(ctx); ctx.stroke();
      } else { // closed: a sly line (weasel), buck teeth (rat)
        ctx.strokeStyle = C.line; ctx.lineWidth = ow * 0.55;
        if (rat) {
          const a = H(4, 4.5), b = H(24, 4), c = H(26, 3.6);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + 1.2, c.x, c.y); ctx.stroke();
          const t0 = H(24, 4), t1 = H(28.5, 4), t2 = H(28, 8.4), t3 = H(24.5, 8.4);
          ctx.fillStyle = C.tooth; ctx.beginPath(); ctx.moveTo(t0.x, t0.y); ctx.lineTo(t1.x, t1.y); ctx.lineTo(t2.x, t2.y); ctx.lineTo(t3.x, t3.y); ctx.closePath(); ctx.fill(); ctx.lineWidth = ow * 0.4; ctx.stroke();
          const tm0 = H(26.3, 4.2), tm1 = H(26.2, 8.2); ctx.beginPath(); ctx.moveTo(tm0.x, tm0.y); ctx.lineTo(tm1.x, tm1.y); ctx.stroke();
        } else {
          const a = H(4, 3), b = H(16, 4.8), c = H(25, 2.4);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(b.x, b.y + 1.2, c.x, c.y); ctx.stroke();
          const f0 = H(17, 4.4), f1 = H(19.5, 4.1), f2 = H(18.2, 7.4);
          ctx.fillStyle = C.tooth; ctx.lineWidth = ow * 0.35; ctx.beginPath(); ctx.moveTo(f0.x, f0.y); ctx.lineTo(f1.x, f1.y); ctx.lineTo(f2.x, f2.y); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
      }
      if (p.tongue > 0.05) {
        const a = J(10, 7), b = J(16, 7), tip = J(13 + 2 * Math.sin(t * 3), 7 + 9 * p.tongue);
        ctx.fillStyle = C.tongue; ctx.strokeStyle = C.line; ctx.lineWidth = ow * 0.5;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(tip.x - 4, tip.y, tip.x, tip.y + 1.5); ctx.quadraticCurveTo(tip.x + 4, tip.y, b.x, b.y); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      // nose
      const nq = rat ? H(33, 0) : H(27, -0.5);
      ctx.fillStyle = frozen ? C.nose : PAL.nose; ctx.strokeStyle = C.line; ctx.lineWidth = ow * 0.45;
      ctx.beginPath(); ctx.ellipse(nq.x, nq.y, (rat ? 3 : 3.2) * HS, (rat ? 2.6 : 2.5) * HS, hr, 0, TAU); ctx.fill(); if (rat) ctx.stroke();
      // whiskers (dark: they must read on pale floors), twitching
      ctx.strokeStyle = C.line; ctx.lineWidth = Math.max(0.5, ow * 0.32);
      const w0 = rat ? H(26, 1.5) : H(21, 1.5), wl = rat ? 15 : 11;
      for (let i = 0; i < (rat ? 3 : 2); i++) {
        const a = hr + (-0.35 + i * 0.32) + p.whisk * 0.06, e = { x: w0.x + Math.cos(a) * wl * HS, y: w0.y + Math.sin(a) * wl * HS };
        ctx.beginPath(); ctx.moveTo(w0.x, w0.y); ctx.quadraticCurveTo((w0.x + e.x) / 2, (w0.y + e.y) / 2 - 2, e.x, e.y); ctx.stroke();
      }
      drawEye();
    }
    function drawEye() {
      const e = rat ? H(8, -4) : H(6, -4), em = o.eye || 'normal';
      ctx.save();
      ctx.translate(e.x, e.y); ctx.rotate(hr); ctx.scale(HS, HS);
      ctx.lineWidth = ow * 0.6; ctx.strokeStyle = C.line;
      const bro = em === 'angry' ? 1 : p.brow;
      if (em === 'spiral') spiralEye(ctx, 0, 0, 4.6, t, 1, C.line);
      else if (em === 'squeeze' || em === 'happy') {
        ctx.beginPath();
        if (em === 'squeeze') { ctx.moveTo(-4.5, -3.2); ctx.lineTo(2.8, 0); ctx.lineTo(-4.5, 3); } else { ctx.moveTo(-4.5, 1.5); ctx.quadraticCurveTo(0, -4.5, 4.5, 1.5); }
        ctx.stroke();
      } else {
        const wide = em === 'wide', lock = em === 'lock';
        const W = rat ? (wide ? 5.4 : 4.8) : wide ? 5.4 : 5, Hh = rat ? (wide ? 5.4 : 4.8) : wide ? 4.8 : 3.6;
        const shape = () => { ctx.beginPath(); if (rat) ctx.ellipse(0, 0, W, Hh, 0, 0, TAU); else { ctx.moveTo(-W, 0.6); ctx.quadraticCurveTo(-1, -Hh * 1.35, W, -0.6); ctx.quadraticCurveTo(1, Hh * 1.2, -W, 0.6); ctx.closePath(); } };
        shape(); ctx.fillStyle = C.eyeW; ctx.fill();
        ctx.save(); shape(); ctx.clip();
        const lx = clamp(p.look, -1, 1) * 1.6 + (lock ? 1.2 : 0);
        ctx.fillStyle = C.iris; ctx.beginPath(); ctx.arc(lx, 0.2, rat ? (wide ? 3.2 : 3.6) : wide ? 2.8 : 3.1, 0, TAU); ctx.fill();
        ctx.fillStyle = C.pupil; ctx.beginPath(); ctx.arc(lx, 0.2, lock ? 1.1 : wide ? 1.2 : 1.7, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(lx + 1.1, -1.1, 1.05, 0, TAU); ctx.fill();
        const lid = wide ? 0 : p.lid;
        if (lid > 0.02) { ctx.fillStyle = C.fur; ctx.beginPath(); ctx.moveTo(-W - 1, -Hh * 1.5); ctx.lineTo(W + 1, -Hh * 1.5); ctx.lineTo(W + 1, -Hh * 1.2 + lid * Hh * 2 - 1); ctx.lineTo(-W - 1, -Hh * 1.2 + lid * Hh * 2.2 + 0.8 * bro); ctx.closePath(); ctx.fill(); }
        ctx.restore();
        shape(); ctx.stroke();
        if (lid > 0.02) { ctx.lineWidth = ow * 0.75; ctx.beginPath(); ctx.moveTo(-W, -Hh * 1.2 + lid * Hh * 2.2 + 0.8 * bro); ctx.lineTo(W, -Hh * 1.2 + lid * Hh * 2 - 1); ctx.stroke(); }
      }
      // brow: fierce slopes down to the snout, sad lifts
      ctx.strokeStyle = C.line; ctx.lineWidth = ow * 0.85;
      ctx.beginPath(); ctx.moveTo(-5, -6.5 - bro * 0.5 - (bro < 0 ? 1.5 : 0)); ctx.lineTo(5.5, -6 + bro * 2.4 - (bro < 0 ? -1.6 * bro : 0)); ctx.stroke();
      if (o.tears > 0) {
        ctx.fillStyle = '#7fd0ff'; ctx.strokeStyle = RIM; ctx.lineWidth = ow * 0.35;
        for (let i = 0; i < 2; i++) { const f = fract(t * 1.4 + i * 0.5), ty = 3 + f * 12; ctx.globalAlpha = 1 - f * 0.6; ctx.beginPath(); ctx.ellipse(-2 + i * 2, ty, 1.6, 2.3, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
    if (o.sweat > 0) { // sweat drops over the head (trapped)
      ctx.fillStyle = '#9fe0ff'; ctx.strokeStyle = RIM; ctx.lineWidth = ow * 0.4;
      for (let i = 0; i < 2; i++) { const f = fract(t * 2.2 + i * 0.5), q = H(-12 - i * 6 - f * 5, -18 + f * 4); ctx.globalAlpha = o.sweat * (1 - f); ctx.beginPath(); ctx.moveTo(q.x, q.y - 3.5); ctx.quadraticCurveTo(q.x + 2.6, q.y, q.x, q.y + 2); ctx.quadraticCurveTo(q.x - 2.6, q.y, q.x, q.y - 3.5); ctx.fill(); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    if (o.stars > 0) dizzyStars(ctx, headTop.x, headTop.y - 6, 17, 5, t, { n: Math.round(o.stars), layer: 'front', size: Math.max(5, 3.4 / u) });
    if (frozen) iceDetails(ctx, T, H, ow, t, o);
    if (o.zap > 0) zapArcs(ctx, T, H, ow, t, o.zap);
    if (o.out) {
      const fl = o.face < 0 ? -1 : 1, mo = rat ? H(14, 6) : H(17, 5), no = rat ? H(34, 0) : H(27, 0), hd = H(0, -4);
      o.out.mouth = { x: x + mo.x * u * fl, y: y + mo.y * u }; o.out.nose = { x: x + no.x * u * fl, y: y + no.y * u }; o.out.head = { x: x + hd.x * u * fl, y: y + hd.y * u };
    }
  } catch (e) { /* art never breaks the frame */ }
  ctx.restore();
}

function iceDetails(ctx, T, H, ow, t, o) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.95)'; // glints: crisp white facets on the shell
  for (const [q, r] of [[T(-14, -18), 4], [H(-5, -14), 3.2], [T(26, -18), 2.8]]) {
    ctx.beginPath(); ctx.moveTo(q.x, q.y - r); ctx.lineTo(q.x + r * 0.3, q.y - r * 0.3); ctx.lineTo(q.x + r, q.y); ctx.lineTo(q.x + r * 0.3, q.y + r * 0.3); ctx.lineTo(q.x, q.y + r); ctx.lineTo(q.x - r * 0.3, q.y + r * 0.3); ctx.lineTo(q.x - r, q.y); ctx.lineTo(q.x - r * 0.3, q.y - r * 0.3); ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = RIM; ctx.lineWidth = ow * 0.5; // frost crystals on the outline (dark blue so they read on snow)
  for (const q of [T(-48, -12), T(8, -20), H(14, -12), T(36, 16), T(-36, 16)]) {
    for (let i = 0; i < 3; i++) { const an = (i * Math.PI) / 3; ctx.beginPath(); ctx.moveTo(q.x - Math.cos(an) * 3.2, q.y - Math.sin(an) * 3.2); ctx.lineTo(q.x + Math.cos(an) * 3.2, q.y + Math.sin(an) * 3.2); ctx.stroke(); }
  }
  if (o.frozen < 1) { // hairline cracks spreading over the last second
    const k = 1 - o.frozen;
    ctx.strokeStyle = RIM; ctx.lineWidth = ow * 0.4;
    [T(-6, -16), T(20, 2), H(4, -6), T(-30, 2)].forEach((q, j) => {
      ctx.beginPath(); ctx.moveTo(q.x, q.y);
      let x = q.x, y = q.y;
      for (let i = 0; i < 4 * k; i++) { x += (hash(j * 9 + i) - 0.5) * 14; y += (hash(j * 7 + i + 3) - 0.3) * 10; ctx.lineTo(x, y); }
      ctx.stroke();
    });
  }
  ctx.restore();
}
// the zap: 0.3 s of crisp jagged arcs along the body (the game's one lightning look: dark edge, blue, gold, pale core)
function zapArcs(ctx, T, H, ow, t, k) {
  const seed = Math.floor(t * 30);
  for (let j = 0; j < 2; j++) {
    const pts = [T(-46, -4 + j * 6), T(-22, -14 + j * 10), T(4, -10 + j * 8), T(28, -10 + j * 10), H(8, -8 + j * 6)];
    ctx.beginPath();
    pts.forEach((q, i) => { const jx = (hash(seed + i * 3 + j * 11) - 0.5) * 10, jy = (hash(seed + i * 5 + j * 7) - 0.5) * 10; i ? ctx.lineTo(q.x + jx, q.y + jy) : ctx.moveTo(q.x + jx, q.y + jy); });
    boltStroke(ctx, ow * 0.55, k, null, 'miter');
  }
}

// ------------------------------------------------------------------ in the level (world space: metres, y up)
const pxAt = (ctx, x, y, k, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(1 / k, -1 / k); try { f(); } catch (e) { /* never break the frame */ } ctx.restore(); };
const DM = {}; // per thief id: last pose (held while frozen), thaw time

function lookOf(T) {
  const u = T.dur > 0 ? clamp(1 - T.t / T.dur, 0, 1) : 0, o = {};
  let st = 'idle', uu = u;
  switch (T.ph) {
    case 'prowl': st = 'prowl'; break;
    case 'stalk': st = 'stalk'; break;
    case 'carry': st = 'carry'; break;
    case 'inner': st = T.eid ? 'carry' : 'stalk'; o.eye = 'wide'; o.sweat = 0.5; break;
    case 'home': st = T.ai === 'roll' || T.k === 'scare' ? 'scared' : 'prowl'; o.eye = 'wide'; break;
    case 'toss': st = 'toss'; break;
    case 'crouch': st = 'crouch'; o.eye = 'lock'; break;
    case 'brace': st = 'brace'; o.eye = 'lock'; break;
    case 'push': st = 'push'; break;
    case 'leap': st = T.blocked ? 'hurt' : 'leap'; uu = T.blocked ? 0.5 : T.lu; o.eye = T.blocked ? 'squeeze' : 'lock'; break;
    case 'grab': st = 'grab'; break;
    case 'stash': st = T.ai === 'roll' ? 'push' : 'grab'; break;
    case 'trapped': st = 'trapped'; o.eye = 'wide'; o.sweat = 1; break;
    case 'hurt': st = 'hurt'; o.eye = 'squeeze'; break;
    case 'stunned': st = 'stunned'; o.eye = 'spiral'; o.stars = 3; break;
    case 'bonk': st = 'bonk'; o.eye = 'squeeze'; o.stars = 2; break;
    case 'laugh': st = 'laugh'; o.eye = 'happy'; break;
    case 'cross': case 'drop': st = T.ai === 'roll' ? 'cross' : 'idle'; o.eye = 'angry'; break;
    case 'defeated': st = 'defeated'; o.eye = 'squeeze'; o.tears = 1; break;
    case 'flee': st = T.boss ? 'defeated' : 'scared'; o.eye = T.boss ? 'squeeze' : 'wide'; if (T.boss) o.tears = 1; break;
    default: st = 'idle';
  }
  if (T.zap > 0) o.zap = clamp(T.zap / 0.3, 0, 1);
  return { st, u: uu, o };
}
// the frame of a thief: its feet on the floor at (T.a, T.r), "up" toward the vault's middle
function frameAt(ctx, T, k, f) {
  const x = T.r * Math.cos(T.a), y = T.r * Math.sin(T.a);
  pxAt(ctx, x, y, k, () => { ctx.rotate(Math.atan2(-Math.cos(T.a), -Math.sin(T.a))); f(); });
}
function leapPitch(sim, T) { return sim.thPitch ? sim.thPitch(T) : 0; }

// the dens: an arched burrow (the weasel's and the Rat King's) or a gnawed round hole (the rats') in the floor ring
export function drawThiefDens(ctx, sim, t, k) {
  for (const T of sim.thieves || []) {
    if (T.home >= 0) continue; // it shares its boss's den
    if (T.kind === 'rat' && sim.thieves.some((o) => o.kind === 'rat' && o.home < 0 && o.id < T.id && o.denA === T.denA && o.run === T.run)) continue; // a pair shares one hole
    const ring = sim.rings[T.run], a = ring.body.getAngle() + T.denA, rf = ring.r - 0.08;
    pxAt(ctx, rf * Math.cos(a), rf * Math.sin(a), k, () => {
      ctx.rotate(Math.atan2(-Math.cos(a), -Math.sin(a)));
      const rat = T.kind === 'rat', w = (rat ? 0.34 : T.kind === 'ratking' ? 0.6 : 0.5) * k, h = (rat ? 0.3 : 0.44) * k, lw = Math.max(1.2, 0.04 * k);
      ctx.beginPath();
      if (rat) { // a gnawed round hole: toothy rim
        for (let i = 0; i <= 16; i++) { const an = Math.PI + (i / 16) * Math.PI, rr = (i % 2 ? 0.88 : 1); ctx.lineTo(Math.cos(an) * w * rr, Math.sin(an) * h * 1.15 * rr + 2); }
      } else { ctx.moveTo(-w, 2); ctx.bezierCurveTo(-w, -h * 1.25, w, -h * 1.25, w, 2); }
      ctx.closePath();
      const g = ctx.createLinearGradient(0, -h, 0, 0); g.addColorStop(0, '#120806'); g.addColorStop(1, '#2e1a10');
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = lw; ctx.strokeStyle = '#1a0c06'; ctx.stroke();
      if (!rat) { // straw on its floor
        ctx.strokeStyle = '#b8902e'; ctx.lineWidth = Math.max(1, 0.022 * k);
        for (let i = 0; i < 7; i++) { const x = (-0.8 + (i / 6) * 1.6) * w * 0.8, an = (hash(i) - 0.5) * 1.2; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + Math.sin(an) * 0.14 * k, -Math.cos(an) * 0.1 * k); ctx.stroke(); }
      }
      // two eyes glinting in the dark while it hides inside
      if (T.ph === 'hide' || T.ph === 'wait') {
        const bl = Math.sin(t * 0.8 + T.id) > 0.92 ? 0.2 : 1;
        ctx.fillStyle = rat ? '#ff5a6a' : '#ffd23a';
        for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * w * 0.22, -h * 0.5, Math.max(1.2, 0.035 * k), Math.max(1.2, 0.035 * k) * bl, 0, 0, TAU); ctx.fill(); }
      }
      const O = T, n = O.stash.length;
      if (n && sim.state === 'play') { ctx.fillStyle = `rgba(230,50,40,${0.55 + 0.4 * Math.sin(t * 6)})`; ctx.beginPath(); ctx.arc(0, -h * 1.25, Math.max(3, 0.09 * k), 0, TAU); ctx.fill(); }
    });
  }
}

// a thief in the level (under the eggs); the pounce / roll telegraph first
export function drawThieves(ctx, sim, t, k) {
  for (const T of sim.thieves || []) {
    if (T.ph === 'wait' || T.ph === 'gone' || T.ph === 'hide') continue;
    if (T.ph === 'crouch') telegraph(ctx, sim, T, t, k);
    if (T.ph === 'brace') rollMark(ctx, sim, T, t, k);
    drawOne(ctx, sim, T, t, k, false);
  }
}
// over the eggs: the head of a thief holding an egg in its jaws, the trap ring
export function drawThievesOver(ctx, sim, t, k) {
  for (const T of sim.thieves || []) {
    if (T.ph === 'trapped') {
      const b = sim.thBody(T), u = 0.5 + 0.5 * Math.sin(t * 8), R = RIG[T.kind].s * 0.62;
      ctx.save(); ctx.setLineDash([0.14, 0.09]); ctx.lineDashOffset = -t * 0.6;
      ctx.strokeStyle = '#3a2400'; ctx.lineWidth = Math.max(0.07, 4 / k); ctx.beginPath(); ctx.arc(b.x, b.y, R + 0.04 * u, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgb(255,${200 + 30 * u | 0},60)`; ctx.lineWidth = Math.max(0.045, 2.4 / k); ctx.beginPath(); ctx.arc(b.x, b.y, R + 0.04 * u, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    if (T.eid && T.ai === 'hunt' && DM[T.id] && DM[T.id].pose) drawOne(ctx, sim, T, t, k, true);
  }
}
function drawOne(ctx, sim, T, t, k, head) {
  const D = DM[T.id] || (DM[T.id] = { pose: null, fz: 0, thawT: -9 });
  const L = lookOf(T), frozen = T.frozen > 0, s = RIG[T.kind].s * k;
  const hop = head ? D.hop || 0 : (D.hop = hopOver(sim, T));
  if (hop > 0.05) { L.st = 'leap'; L.u = 0.5 - 0.35 * Math.sign(D.hopD || 0); }
  let pose;
  if (head) pose = D.pose;
  else {
    if (frozen && D.pose) pose = D.pose; // held still in the ice
    else { pose = thiefBlend('t' + T.id, thiefPose(T.kind, L.st, t, L.u, T.odo), t, T.ph === 'leap' || T.ph === 'trapped' ? 22 : 9); D.pose = { ...pose }; }
    if (D.fz > 0 && !frozen) D.thawT = t;
    D.fz = T.frozen;
  }
  const o = { ...L.o, face: T.face, frozen: frozen ? T.frozen : 0, crown: T.kind === 'ratking', cape: T.kind === 'ratking' };
  if (frozen) { o.eye = o.eye === 'spiral' ? 'normal' : o.eye; o.stars = 0; o.sweat = 0; o.zap = 0; }
  if (head) { o.only = 'head'; o.stars = 0; o.sweat = 0; o.zap = 0; }
  let alpha = T.ph === 'flee' ? T.alpha : 1, pop = T.ph === 'in' ? 0.35 + 0.65 * easeBack(clamp(1 - T.t / Math.max(0.01, T.dur), 0, 1)) : 1;
  if (T.ph === 'warp') { const w = T.warp / 1.1; pop = w < 0.5 ? 1 - ss(0, 0.5, w) * 0.95 : 0.05 + 0.95 * ss(0.5, 1, w); alpha *= w < 0.5 ? 1 - 0.6 * ss(0.3, 0.5, w) : 0.4 + 0.6 * ss(0.5, 0.8, w); }
  frameAt(ctx, T, k, () => {
    ctx.globalAlpha *= alpha;
    const pitch = leapPitch(sim, T), shake = !head && t - D.thawT < 0.5 ? Math.sin(t * 60) * 0.12 * (1 - (t - D.thawT) / 0.5) : 0, spin = T.ph === 'warp' ? (T.warp / 1.1) * 9 : 0;
    const mid = -RIG[T.kind].bodyY * k;
    ctx.translate(0, mid - hop * k); ctx.rotate(-pitch * T.face + shake + spin); ctx.scale(pop, pop); ctx.translate(0, -mid);
    drawThief(ctx, 0, 0, s, t, pose, o, T.kind);
    if (!head && t - D.thawT < 0.6) thawShards(ctx, k, (t - D.thawT) / 0.6, mid);
  });
}
// a walking thief meets an egg on its floor that it is not after (a rat getting behind its egg, a weasel passing one by):
// it hops over it instead of walking through it. Render only: a lift in metres on a smooth arc over the egg.
function hopOver(sim, T) {
  if (T.ph !== 'prowl' && T.ph !== 'home' && T.ph !== 'flee') return 0;
  let best = 0;
  for (const e of sim.eggs) {
    if (!e.alive || e.saved || !e.body || e.thf) continue;
    const p = e.body.getPosition(), r = Math.hypot(p.x, p.y);
    if (Math.abs(r - (T.r - 0.21)) > 0.3) continue; // not resting on its floor
    const d = wrap(Math.atan2(p.y, p.x) - T.a) * T.r * T.face, w = 0.55; // + ahead of its middle
    if (Math.abs(d) > w) continue;
    const lift = 0.46 * Math.cos((d / w) * Math.PI / 2);
    if (lift > best) { best = lift; (DM[T.id] || {}).hopD = d; }
  }
  return best;
}
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
function easeBack(x) { return 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2); }
function thawShards(ctx, k, f, mid) {
  ctx.save();
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (hash(i * 3) - 0.5) * 2.6, v = (0.4 + hash(i) * 0.5) * k, x = Math.cos(a) * v * f * 0.8, y = mid + Math.sin(a) * v * f * 0.8 + 1.4 * k * f * f, r = (0.04 + 0.035 * hash(i + 5)) * k;
    ctx.globalAlpha = 1 - f; ctx.fillStyle = SHELL; ctx.strokeStyle = RIM; ctx.lineWidth = Math.max(1, 0.014 * k);
    ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.8, y + r * 0.2); ctx.lineTo(x - r * 0.3, y + r); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}
// the pounce telegraph: a dashed arc from the thief and a paw mark where it will land (grey with a cross when the gap
// has turned away: the pounce is blocked). Dark-edged so it reads on every world, never a pale rim.
function telegraph(ctx, sim, T, t, k) {
  const L = sim.huntLanding(T), u = clamp(1 - T.t / T.dur, 0, 1), b = sim.thBody(T);
  const ok = T.k !== 'pounce' || sim.thAligned(T.run - 1, T.gi, T.a);
  const ring = sim.rings[T.run - 1], cr = ring.r - 0.6, cx = cr * Math.cos(T.a), cy = cr * Math.sin(T.a);
  ctx.save();
  ctx.setLineDash([0.12, 0.1]); ctx.lineCap = 'round';
  const path = () => { ctx.beginPath(); ctx.moveTo(b.x, b.y); if (T.k === 'pounce') ctx.quadraticCurveTo(cx, cy, L.x, L.y); else ctx.lineTo(L.x, L.y); };
  path(); ctx.strokeStyle = 'rgba(30,8,4,0.55)'; ctx.lineWidth = Math.max(0.06, 3.4 / k); ctx.stroke();
  path(); ctx.strokeStyle = ok ? `rgba(255,70,50,${0.6 + 0.4 * u})` : 'rgba(120,120,120,0.85)'; ctx.lineWidth = Math.max(0.035, 1.8 / k); ctx.stroke();
  ctx.setLineDash([]);
  if (!ok) { const r = ring.r, X = r * Math.cos(T.a), Y = r * Math.sin(T.a), s = 0.13; for (const [c, w] of [['#1a0c06', 4], ['#ff5a4a', 2.2]]) { ctx.strokeStyle = c; ctx.lineWidth = Math.max(0.04, w / k); ctx.beginPath(); ctx.moveTo(X - s, Y - s); ctx.lineTo(X + s, Y + s); ctx.moveTo(X - s, Y + s); ctx.lineTo(X + s, Y - s); ctx.stroke(); } }
  ctx.restore();
  pawMark(ctx, L, k, t, u, ok);
}
function pawMark(ctx, L, k, t, u, ok) {
  pxAt(ctx, L.x, L.y, k, () => {
    ctx.rotate(Math.atan2(-Math.cos(L.a), -Math.sin(L.a)));
    const s = Math.max(0.17 * k, 6) * (1 + 0.08 * Math.sin(t * 14)), col = ok ? `rgba(230,40,30,${0.55 + 0.45 * u})` : 'rgba(90,90,90,0.7)';
    ctx.translate(0, -s * 0.55);
    ctx.fillStyle = col; ctx.strokeStyle = '#2a0a04'; ctx.lineWidth = Math.max(1, s * 0.09);
    ctx.beginPath(); ctx.ellipse(0, s * 0.18, s * 0.42, s * 0.34, 0, 0, TAU); ctx.fill(); ctx.stroke();
    for (const [x, y] of [[-0.42, -0.28], [-0.15, -0.5], [0.15, -0.5], [0.42, -0.28]]) { ctx.beginPath(); ctx.ellipse(x * s, y * s, s * 0.14, s * 0.18, x * 0.6, 0, TAU); ctx.fill(); ctx.stroke(); }
  });
}
// the roll telegraph: a dashed arrow along the floor from the egg toward the hole
function rollMark(ctx, sim, T, t, k) {
  const e = sim.eggs.find((q) => q.id === T.tgt);
  if (!e || !e.body) return;
  const p = e.body.getPosition(), r = Math.hypot(p.x, p.y), a0 = Math.atan2(p.y, p.x), u = clamp(1 - T.t / T.dur, 0, 1), len = (0.5 + 0.4 * u) / r, a1 = a0 + T.face * len;
  ctx.save();
  ctx.lineCap = 'round'; ctx.setLineDash([0.1, 0.08]); ctx.lineDashOffset = -t * 0.5 * T.face;
  for (const [c, w] of [['rgba(30,8,4,0.6)', 3.6], [`rgba(255,120,40,${0.6 + 0.4 * u})`, 2]]) {
    ctx.strokeStyle = c; ctx.lineWidth = Math.max(0.03, w / k);
    ctx.beginPath(); ctx.arc(0, 0, r, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke();
  }
  ctx.setLineDash([]);
  const hx = r * Math.cos(a1), hy = r * Math.sin(a1), tx = -Math.sin(a1) * T.face, ty = Math.cos(a1) * T.face, nx = Math.cos(a1), ny = Math.sin(a1), s = 0.12;
  ctx.beginPath(); ctx.moveTo(hx + tx * s, hy + ty * s); ctx.lineTo(hx - nx * s * 0.7, hy - ny * s * 0.7); ctx.lineTo(hx + nx * s * 0.7, hy + ny * s * 0.7); ctx.closePath();
  ctx.fillStyle = `rgba(255,120,40,${0.7 + 0.3 * u})`; ctx.fill(); ctx.strokeStyle = '#2a0a04'; ctx.lineWidth = Math.max(0.02, 1.2 / k); ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------ portraits (screen space, y down)
// The boss card: the same frame as the painted cards, a night backdrop, the thief standing tall in front (the Rat King
// crowned and caped, two of his rats at his feet), an egg it has its eye on. Code-drawn: the same animal as in the level.
export function drawThiefCard(ctx, kind, x, y, w, h, t, age) {
  const king = kind === 'ratking';
  const H0 = Math.min(h, w * 2.06), W0 = H0 / 2.06, pad = Math.max(2, H0 * 0.025);
  const e = age == null ? 1 : Math.min(1, Math.max(0, age / 0.45));
  const pop = e < 1 ? 0.6 + 0.4 * (1 - Math.pow(1 - e, 3)) + Math.sin(e * Math.PI) * 0.08 : 1;
  const dw = (W0 - pad * 2) * pop, dh = (H0 - pad * 2) * pop, cx = x + w / 2, cy = y + h / 2 + Math.sin(t * 2.1) * h * 0.012, r = dw * 0.07;
  const rr = (px, py, pw, ph, rad) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(px, py, pw, ph, rad) : ctx.rect(px, py, pw, ph); };
  ctx.save();
  ctx.globalAlpha *= Math.min(1, e * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; rr(cx - dw / 2 + pad * 0.6, cy - dh / 2 + pad * 1.2, dw, dh, r); ctx.fill();
  ctx.fillStyle = '#5a3a1c'; rr(cx - dw / 2 - pad, cy - dh / 2 - pad, dw + pad * 2, dh + pad * 2, r + pad); ctx.fill();
  ctx.fillStyle = '#f2c25a'; rr(cx - dw / 2 - pad * 0.45, cy - dh / 2 - pad * 0.45, dw + pad * 0.9, dh + pad * 0.9, r + pad * 0.45); ctx.fill();
  rr(cx - dw / 2, cy - dh / 2, dw, dh, r);
  ctx.save(); ctx.clip();
  const g = ctx.createLinearGradient(0, cy - dh / 2, 0, cy + dh / 2);
  if (king) { g.addColorStop(0, '#1c1030'); g.addColorStop(0.6, '#4a2a5a'); g.addColorStop(1, '#7a4a3a'); } else { g.addColorStop(0, '#1f2a4a'); g.addColorStop(0.6, '#3f5a3a'); g.addColorStop(1, '#8a6a32'); }
  ctx.fillStyle = g; ctx.fillRect(cx - dw / 2, cy - dh / 2, dw, dh);
  // a moon and a few stars
  ctx.fillStyle = '#f6eccb'; ctx.beginPath(); ctx.arc(cx + dw * 0.24, cy - dh * 0.34, dw * 0.12, 0, TAU); ctx.fill();
  ctx.fillStyle = king ? '#1c1030' : '#1f2a4a'; ctx.beginPath(); ctx.arc(cx + dw * 0.29, cy - dh * 0.36, dw * 0.1, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,248,220,0.85)';
  for (let i = 0; i < 6; i++) { const sx = cx - dw * 0.42 + ((i * 37) % 80) / 100 * dw, sy = cy - dh * 0.46 + ((i * 53) % 30) / 100 * dh; ctx.fillRect(sx, sy, Math.max(1, dw * 0.012), Math.max(1, dw * 0.012)); }
  // the floor: a grassy farm bank (weasel) or the vault's stone (Rat King)
  const fy = cy + dh * 0.36;
  ctx.fillStyle = king ? '#3a2e3e' : '#4a6a2a'; ctx.fillRect(cx - dw / 2, fy, dw, dh);
  ctx.fillStyle = king ? '#2a2030' : '#35501e'; ctx.fillRect(cx - dw / 2, fy + dh * 0.05, dw, dh);
  ctx.strokeStyle = '#140c08'; ctx.lineWidth = Math.max(1, dw * 0.012); ctx.beginPath(); ctx.moveTo(cx - dw / 2, fy); ctx.lineTo(cx + dw / 2, fy); ctx.stroke();
  // an egg it has its eye on
  const ex = cx - dw * (king ? 0.36 : 0.3), eh = dh * (king ? 0.14 : 0.17);
  eggIcon(ctx, ex, fy - eh * 0.5, eh, t);
  const s = dw * (king ? 0.78 : 0.86), fx = cx + dw * (king ? 0.12 : 0.1);
  if (king) for (const [ox, f] of [[-0.04, -1], [0.42, -1]]) drawThief(ctx, cx + dw * ox, fy, dw * 0.36, t + ox * 3, thiefPose('rat', 'idle', t + ox * 3), { face: f }, 'rat');
  drawThief(ctx, fx, fy, s, t, thiefPose(kind, 'stand', t), { face: -1, crown: king, cape: king, eye: king ? 'normal' : 'lock' }, kind);
  ctx.restore();
  ctx.restore();
  return true;
}
function eggIcon(ctx, x, y, h, t) {
  const w = h * 0.75;
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 2) * 0.05);
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) { const a = (i / 24) * TAU, s2 = Math.sin(a); ctx.lineTo((w / 2) * Math.cos(a) * (1 + 0.13 * s2), (h / 2) * s2); }
  ctx.closePath();
  ctx.fillStyle = '#fbf3e0'; ctx.fill(); ctx.lineWidth = Math.max(1, h * 0.06); ctx.strokeStyle = '#3a2410'; ctx.stroke();
  ctx.fillStyle = '#e6d4b0'; ctx.beginPath(); ctx.ellipse(w * 0.12, h * 0.16, w * 0.26, h * 0.22, 0, 0, TAU); ctx.fill();
  ctx.restore();
}
// the head in a round chip (the boss bar emblem): the thief seen from the side, looking at you
export function drawThiefEmblem(ctx, kind, r, t) {
  const s = r * (kind === 'ratking' ? 1.5 : 1.45);
  ctx.save();
  ctx.translate(-r * 0.62, 0);
  const pose = { ...thiefPose(kind, 'idle', 0.2), hx: 0, hy: 0, hr: -0.2 };
  drawThief(ctx, -s * 0.18, r * 0.95, s, t, pose, { only: 'head', crown: kind === 'ratking', eye: 'lock', face: 1 }, kind);
  ctx.restore();
}

// events -> popups, sounds, one-time tips
export function thiefEvent(ev, fx, U) {
  const { popup, audio, once } = U, rat = ev.kind === 'rat', king = ev.kind === 'ratking';
  const who = rat ? 'rat' : king ? 'Rat King' : 'weasel';
  switch (ev.type) {
    case 'thiefIn':
      audio.play('grab', { vol: 0.45, pitch: rat ? 1.5 : 0.8 });
      if (rat) once('thiefRat', 'Rats! They roll eggs to their hole. Turn a gap under a rolling egg and it drops through. Light and water scare them off.', 4.4);
      else if (!king) once('thiefWeasel', 'A weasel! It pounces through gaps to steal eggs. Turn the gap away as it crouches, or trap it inside.', 4.4);
      else once('thiefKing', 'The Rat King! Trap him behind a turned ring and hit him. His rats roll eggs to his den.', 4.4);
      break;
    case 'thiefWarn': audio.play('squish', { vol: 0.35, pitch: rat ? 1.6 : 0.85 }); break;
    case 'thiefPounce': audio.play('wind_gust', { vol: 0.4, pitch: 1.6 }); break;
    case 'thiefRoll': audio.play('egg_bump', { vol: 0.4, pitch: 1.4 }); break;
    case 'thiefBonk': audio.play('rock_hit', { vol: 0.7 }); fx.sparkle(ev.x, ev.y, 6, '#ffe08a'); popup(ev.x, ev.y + 0.6, 'Blocked!', { color: '#bff0a0', size: 18, life: 0.9 }); break;
    case 'thiefGrab': audio.play('grab', { vol: 0.75 }); if (!rat) popup(ev.x, ev.y + 0.6, 'Snatched!', { color: '#ff9a6a', size: 18, life: 0.9 }); break;
    case 'thiefGap': audio.play('unlock', { vol: 0.5, pitch: 1.3 }); popup(ev.x, ev.y + 0.6, 'Down the gap!', { color: '#bff0a0', size: 18, life: 1 }); once('thiefGap', 'The rat rolled your egg into a gap: free help!', 3); break;
    case 'thiefTrapped': audio.play('glass_crack', { vol: 0.5, pitch: 1.4 }); fx.sparkle(ev.x, ev.y, 10, '#ffd63c'); popup(ev.x, ev.y + 0.8, 'TRAPPED!', { color: '#ffd63c', size: 20, life: 1.2 }); once('thiefTrapped', `Trapped! Now hit the ${who}: drop an egg on it, burn it with a flaming egg, or save an egg.`, 4); break;
    case 'thiefHit': audio.play('thorn_snap', { vol: 0.8 }); fx.sparkle(ev.x, ev.y, 14, '#ffe08a'); fx.shake = Math.max(fx.shake || 0, 0.3); popup(ev.x, ev.y + 0.9, ev.boss ? (ev.hp > 0 ? `OUCH! ${ev.hp} left` : 'DEFEATED!') : 'OUCH!', { color: '#ff6a4a', size: 22, life: 1.2 }); break;
    case 'thiefStash':
      audio.play('level_fail', { vol: 0.25, pitch: 1.6 });
      popup(ev.x, ev.y + 0.7, ev.lost ? 'Into the hole!' : 'Stashed!', { color: '#ff7a5a', size: 18, life: 1 });
      if (!ev.lost) once('thiefStash', `The ${who} stashed an egg in its den. Hit it while it is trapped to win it back.`, 4);
      break;
    case 'thiefDrop': if (ev.why === 'tired' || ev.why === 'turned') popup(ev.x, ev.y + 0.6, 'Dropped it!', { color: '#bff0a0', size: 16, life: 0.8 }); break;
    case 'thiefScared': audio.play('egg_bump', { vol: 0.5, pitch: 1.9 }); popup(ev.x, ev.y + 0.6, 'Eek!', { color: '#bff0ff', size: 18, life: 0.8 }); break;
    case 'thiefFreeze': audio.play('glass_crack', { vol: 0.5 }); break;
    default: break;
  }
}
