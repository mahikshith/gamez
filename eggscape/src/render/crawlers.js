// Crawlers: four-legged lizards that walk the rings, seen from above. One rig, several species.
// Pure Canvas 2D, no assets, no offscreen canvases. Draws in a local y-DOWN pixel space like the other
// character helpers (wrap it in pxSpace from world space); the space is assumed screen-aligned.
//
// drawCrawler(ctx, x, y, s, t, opts, species)
//   species       'salamander' | 'gecko' | 'thornback' | 'chameleon' (or a config object, see SPECIES)
//   x, y          snout position (px). s = snout-to-hips length in px (SPECIES[].svl gives the in-game metres).
//   t             seconds (idle motion, blink, flicker).
//   opts.heading  travel direction (rad, y-down) used when no trail is given
//   opts.curve    path curvature (1/px, + turns clockwise on screen); a ring channel of radius R px is 1/R
//   opts.trail    optional d => {x, y}: the walked path, d px behind the snout (same space as x, y). The spine
//                 and the planted feet follow it, so the body bends round any curve the head took.
//   opts.gait     distance walked (px). Drives the leg cycle and body wave; feet stay planted while it grows.
//   opts.pose     'walk' | 'idle' | 'flee' | 'dazed' plus species poses:
//                 salamander 'hiss' 'breath' 'cool'; gecko 'frost' 'melt'; thornback 'lay' 'flipped';
//                 chameleon 'snatch' 'sick'
//   opts.p        0..1 progress through a one-shot pose
//   opts.blend    eased pose channels from crawlerAnim() (smooth pose changes, walk stops with all feet down)
//   opts.glow     0..1 skin glow (salamander magma, gecko frost sparkle)
//   opts.cool     0..1 salamander cooled grey look (pose 'cool' = 1)
//   opts.camo     0..1 chameleon blend into opts.camoColor ([r, g, b], the ring it sits on)
//   opts.target   {x, y} chameleon tongue target (same space as x, y)
//   opts.aim      head turn (rad) off the body line
//   opts.look     {x, y} pupils, -1..1 (x = toward the snout); opts.blink 0..1 override
//   opts.dive     px past a lava hole (salamander 'flee'): the hole sits this far behind the snout
//   opts.fireLen  fire jet length in units of s/100
//   opts.id       keeps per-creature face orientation stable (the face flips to stay upright on screen)
//   opts.out      optional object; receives feet [{x, y, lift}], fire tip, tongue tip, thorn {x, y, k}
// In game: s = SPECIES[name].svl * k (k = px per metre).

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mod = (a, b) => ((a % b) + b) % b;
const sstep = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
const lerp = (a, b, k) => a + (b - a) * k;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixA = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const rgb = (c, al = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${al})`;
const hues = (h) => { // hue (0..1) -> saturated rgb, for the chameleon's sick flashing
  const f = (n) => { const k = (n + h * 12) % 12; return 255 * (0.62 - 0.38 * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
  return [f(0), f(8), f(4)];
};
const pal = (o) => { const r = {}; for (const k in o) r[k] = hex(o[k]); return r; };

/* ---------------------------------------------------------------- species */
// Units: U = s / 100 (s = snout to hips). hw = body half-width table [u, w]. legs: upper/lower lengths (front f,
// hind h), lat = how far out the feet plant from the path, toes per foot. head: wedge shape and eye layout.
export const SPECIES = {
  salamander: {
    svl: 1.8, len: 196, sh: 32, hip: 82, neck: 13, stride: 40, duty: 0.6, wave: 5.2, tailWave: 11,
    hw: [[14, 8.5], [24, 9.5], [32, 11.5], [44, 13], [58, 13.6], [72, 12.8], [84, 11.2], [96, 8.2], [112, 6.4], [140, 4.4], [168, 2.6], [196, 0.7]],
    legs: { l1f: 12, l2f: 12, l1h: 13.5, l2h: 13, latF: 22.5, latH: 24, up: 7.4, lo: 5.6, toe: 2.3, pad: 3.6, toesF: 4, toesH: 5, toeLen: 5.2, feet: 'claws' },
    pattern: 'plates', rim: 0.95, halo: [255, 120, 30], glows: true,
    head: { scale: 1.28, W: 15.8, B: 9.2, tip: 16.8, sn: 10.2, eyeX: -3, eyeY: 14.6, eyeR: 6.2, eyes: 'lid', brows: 'glow', mouth: 'smirk', plates: true, frill: true },
    pal: pal({ line: '#2a1209', rock: '#6c3925', rockHi: '#ad6a40', rockLo: '#3a170c', magLo: '#8c2208', magMid: '#ff6512', magHot: '#ffc43c', jaw: '#ffc768', belly: '#ffd98a', eye: '#ffd52e', eyeLo: '#e58a12', brow: '#ffe98a', browLo: '#ff9a2a', claw: '#ffb43c', pupil: '#1e0a04' }),
  },
  gecko: {
    svl: 1.1, len: 178, sh: 34, hip: 76, neck: 13, stride: 36, duty: 0.62, wave: 4.2, tailWave: 7,
    hw: [[12, 9], [22, 9.5], [30, 11], [44, 12.6], [58, 12.6], [70, 11.4], [80, 10], [92, 9.6], [112, 8.6], [140, 5.6], [162, 3], [178, 0.9]],
    legs: { l1f: 12, l2f: 12, l1h: 12.5, l2h: 12.5, latF: 21, latH: 22, up: 6.4, lo: 5, toe: 2.4, pad: 3, toesF: 5, toesH: 5, toeLen: 6, feet: 'pads' },
    pattern: 'crystals', rim: 0.7, halo: [170, 230, 255], glows: false,
    head: { scale: 1.3, W: 16, B: 9, tip: 13.5, sn: 12, eyeX: -2, eyeY: 13.2, eyeR: 7.6, eyes: 'gecko', mouth: 'smile', plates: false },
    pal: pal({ line: '#0e1838', rock: '#d8f4ff', rockHi: '#ffffff', rockLo: '#14285a', magLo: '#1f3a78', magMid: '#2f5fb0', magHot: '#8fe0ff', jaw: '#bfe6ff', belly: '#d8f2ff', eye: '#c8f4ff', eyeLo: '#6fc0e6', brow: '#ffffff', browLo: '#bfe6ff', claw: '#ffffff', pupil: '#0c1830' }),
  },
  thornback: {
    svl: 1.5, len: 150, sh: 30, hip: 72, neck: 12, stride: 34, duty: 0.62, wave: 3.4, tailWave: 5,
    hw: [[12, 10], [22, 12], [32, 15.5], [46, 18], [60, 18], [72, 14.5], [82, 8.5], [100, 5.6], [125, 3], [150, 0.8]],
    legs: { l1f: 9.5, l2f: 9, l1h: 10.5, l2h: 10, latF: 24, latH: 25, up: 8, lo: 6.4, toe: 2.4, pad: 3.8, toesF: 4, toesH: 5, toeLen: 4.6, feet: 'claws' },
    pattern: 'scales', rim: 0.5, halo: null, glows: false, spikes: true,
    head: { scale: 1.2, W: 17, B: 11, tip: 13.5, sn: 6.5, eyeX: -3.5, eyeY: 11.5, eyeR: 4.8, eyes: 'lid', brows: 'rock', mouth: 'grump', plates: true, horns: true },
    pal: pal({ line: '#2a1a0c', rock: '#7d5a30', rockHi: '#b08a4e', rockLo: '#3a2810', magLo: '#4a5c1a', magMid: '#7f972e', magHot: '#bfcf62', jaw: '#e8dca8', belly: '#efe2b0', eye: '#ffcf3a', eyeLo: '#d88a1a', brow: '#8a6a3a', browLo: '#5a4020', claw: '#f2e2b0', pupil: '#1e1004', spike: '#efe0b0', spikeTip: '#d43a2a' }),
  },
  chameleon: {
    svl: 1.4, len: 210, sh: 30, hip: 78, neck: 14, stride: 36, duty: 0.66, wave: 2.2, tailWave: 3, curl: 150,
    hw: [[14, 7.5], [24, 8.5], [34, 10.2], [50, 11.6], [64, 11.6], [76, 10], [86, 7], [100, 5], [130, 3.8], [170, 2.8], [210, 1.6]],
    legs: { l1f: 13, l2f: 13, l1h: 14, l2h: 13.5, latF: 21, latH: 22, up: 5.6, lo: 4.6, toe: 3.4, pad: 3.2, toesF: 2, toesH: 2, toeLen: 5, feet: 'mitts' },
    pattern: 'bands', rim: 0.55, halo: null, glows: false, crest: true,
    head: { scale: 1.25, W: 12.5, B: 9, tip: 18, sn: 5.5, eyeX: -1.5, eyeY: 10.5, eyeR: 6.6, eyes: 'turret', mouth: 'long', plates: false, casque: true },
    pal: pal({ line: '#1d2a10', rock: '#2f8a3c', rockHi: '#6cd06a', rockLo: '#1a4a20', magLo: '#3c9a3e', magMid: '#64c45a', magHot: '#c2f07a', jaw: '#e6f5a0', belly: '#eef8b8', eye: '#7fd46a', eyeLo: '#3a8a3a', brow: '#ffe66a', browLo: '#e0b030', claw: '#d8f0a0', pupil: '#101a08', dot: '#ffe66a' }),
  },
};

/* ---------------------------------------------------------------- current species (set per draw) */
const NS = 50; // spine samples
let SP = SPECIES.salamander, UMAX = 196, DU = UMAX / (NS - 1), U_SH = 32, U_HIP = 82, U_HEAD = 13, STRIDE = 40, DUTY = 0.6;
function useSpecies(sp) {
  SP = sp;
  UMAX = sp.len; DU = UMAX / (NS - 1); U_SH = sp.sh; U_HIP = sp.hip; U_HEAD = sp.neck; STRIDE = sp.stride; DUTY = sp.duty;
  if (!sp._legs) sp._legs = [
    { g: U_SH, side: -1, off: 0, front: true },
    { g: U_SH, side: 1, off: 0.5, front: true },
    { g: U_HIP, side: -1, off: 0.5, front: false },
    { g: U_HIP, side: 1, off: 0, front: false },
  ];
}
function hwAt(u) {
  const HW = SP.hw;
  if (u <= HW[0][0]) return HW[0][1];
  for (let i = 1; i < HW.length; i++) {
    if (u <= HW[i][0]) {
      const a = HW[i - 1], b = HW[i], k = (u - a[0]) / (b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * (k * k * (3 - 2 * k));
    }
  }
  return HW[HW.length - 1][1];
}

/* ---------------------------------------------------------------- skin patterns (laid out once per species) */
// Each pattern piece is a polygon in spine space: [u0, v0, u1, v1, ...] with v = fraction of the half-width.
function pattern(sp) {
  if (sp._pat) return sp._pat;
  const out = [];
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const plate = (u0, u1, a, b, s, r) => {
    const j = (r - 0.5) * 1.2, L = u1 - u0, um = (u0 + u1) / 2 + j * 0.6, vm = (a + b) / 2 + (r - 0.5) * 0.12;
    out.push(s === 0
      ? [u0 + L * 0.18, a, um, a * 1.02, u1 - L * 0.12, a * 0.9, u1, vm, u1 - L * 0.12, b * 0.9, u0 + L * 0.2, b, u0, vm]
      : [u0, a, u1, a, u1 + 0.4, vm, u1 - L * 0.22, b, u0 + L * 0.25, b, u0 - 0.3, vm + (b - a) * 0.12]);
  };
  const hexAt = (u, v, r) => { // a small crystal / spot, r in U
    const w = hwAt(u), p = [], ph = rnd() * 0.5;
    for (let i = 0; i < 6; i++) { const a = ph + (i * TAU) / 6; p.push(u + Math.cos(a) * r, v + (Math.sin(a) * r) / w); }
    out.push(p);
  };
  if (sp.pattern === 'plates') {
    const crack = 2, E = 0.8;
    for (const side of [-1, 1]) {
      let u = side < 0 ? 22 : 27;
      while (u < 100) {
        const w = hwAt(u + 5), s = clamp(w * 0.92, 7, 12.5);
        plate(u + crack / 2, Math.min(u + s, 104) - crack / 2, side * (crack / 2) / w, side * E, side, rnd());
        u += s;
      }
    }
    for (let u = 104; u < 186;) {
      const s = clamp(hwAt(u) * 1.25, 3.6, 9);
      plate(u + crack / 2, u + s - crack / 2, -E, E, 0, rnd());
      u += s;
    }
  } else if (sp.pattern === 'scales') {
    const crack = 1.5;
    for (let row = 0, u = 20; u < 140; row++) {
      const w = hwAt(u), s = clamp(w * 0.5, 4, 7.5), n = w > 12 ? 3 : w > 5 ? 2 : 1;
      const cw = 1.7 / n;
      for (let c = 0; c < n; c++) {
        const sh = row % 2 ? 0.12 : -0.12;
        const a = -0.85 + c * cw + (crack / 2) / w + (n > 1 ? sh : 0), b = -0.85 + (c + 1) * cw - (crack / 2) / w + (n > 1 ? sh : 0);
        plate(u + crack / 2, u + s - crack / 2, clamp(a, -0.85, 0.85), clamp(b, -0.85, 0.85), n === 1 ? 0 : 1, rnd());
      }
      u += s;
    }
  } else if (sp.pattern === 'crystals') {
    for (let u = 26; u < 160; u += 7 + rnd() * 3) {
      const n = hwAt(u) > 9 ? 2 : 1;
      for (let i = 0; i < n; i++) hexAt(u + rnd() * 3, (n === 1 ? 0 : i ? 0.42 : -0.42) + (rnd() - 0.5) * 0.3, 1.8 + rnd() * 1.8 * Math.min(1, hwAt(u) / 9));
    }
  } else if (sp.pattern === 'bands') {
    for (let u = 30; u < 190; u += 15) {
      const w0 = 5 + rnd() * 2;
      out.push([u, -1.3, u + w0, -1.3, u + w0 + 2, -0.4, u + w0 - 1, 0, u + w0 + 2, 0.4, u + w0, 1.3, u, 1.3, u + 2, 0.5, u - 1, 0, u + 2, -0.5]);
    }
  }
  sp._pat = out;
  return out;
}

/* ---------------------------------------------------------------- reused buffers */
const sx = new Float32Array(NS), sy = new Float32Array(NS), sw = new Float32Array(NS);
const snx = new Float32Array(NS), sny = new Float32Array(NS); // right-hand normal
const bx = new Float32Array(NS), by = new Float32Array(NS); // unreared spine (for the ground shadow)
const PT = { x: 0, y: 0, a: 0 };
const faceUp = {}; // per creature id: which way the face reads (+1 = forward is screen-up)

function blinkAt(t, seed = 0) {
  const period = 3.1 + seed * 0.9;
  const p = mod(t + seed * 1.7, period);
  const d = 0.16;
  return p < d ? Math.sin((p / d) * Math.PI) : 0;
}
function spInto(u, o) {
  const f = clamp(u / DU, 0, NS - 1.001), i = f | 0, k = f - i;
  o.x = sx[i] + (sx[i + 1] - sx[i]) * k;
  o.y = sy[i] + (sy[i + 1] - sy[i]) * k;
  o.nx = snx[i] + (snx[i + 1] - snx[i]) * k;
  o.ny = sny[i] + (sny[i + 1] - sny[i]) * k;
  o.w = sw[i] + (sw[i + 1] - sw[i]) * k;
  return o;
}
const spAt = (u) => spInto(u, { x: 0, y: 0, nx: 0, ny: 0, w: 0 });

/* ---------------------------------------------------------------- pose channels */
// Every pose resolves to the same continuous channels, so poses can be eased into one another (crawlerAnim).
const CHANNELS = ['walk', 'rear', 'crouch', 'mouth', 'fire', 'swell', 'dazed', 'angry', 'shake', 'flee', 'splay', 'tongue', 'steam', 'frill', 'melt', 'roll', 'flail', 'lay', 'lick', 'snatch', 'sick', 'frost'];
function poseParams(pose, p) {
  const P = {};
  for (const c of CHANNELS) P[c] = 0;
  P.frill = 0.22;
  switch (pose) {
    case 'walk': P.walk = 1; break;
    case 'frost': P.walk = 1; P.frost = 1; break;
    case 'flee': P.walk = 1; P.flee = 1; P.frill = 0; break;
    case 'idle': break;
    case 'hiss': {
      const k = sstep(p / 0.15) * (1 - sstep((p - 0.85) / 0.15));
      P.crouch = 0.5 * Math.sin(Math.PI * clamp(p / 0.2, 0, 1));
      P.rear = 0.42 * k; P.mouth = k; P.angry = k; P.shake = k; P.tongue = k; P.frill = 0.22 + 0.78 * k; break;
    }
    case 'breath': {
      // 0-.1 coil (crouch), .08-.25 pitch up, .25-.42 inhale (swell, glow), .42-.86 fire, .86-1 settle
      P.crouch = Math.sin(Math.PI * clamp(p / 0.16, 0, 1));
      const up = sstep((p - 0.06) / 0.2) * (1 - sstep((p - 0.86) / 0.14));
      P.rear = up;
      P.swell = sstep((p - 0.2) / 0.2) * (1 - sstep((p - 0.44) / 0.06));
      P.mouth = up * (0.25 + 0.75 * sstep((p - 0.36) / 0.08));
      P.fire = sstep((p - 0.42) / 0.05) * (1 - sstep((p - 0.82) / 0.07));
      P.angry = up;
      P.frill = 0.22 + 0.6 * up;
      break;
    }
    case 'dazed': P.dazed = 1; P.splay = 1; P.tongue = 0.6; P.frill = 0; break;
    case 'cool': P.steam = 1; P.frill = 0; break;
    case 'melt': { // gecko: slumps into a puddle (eyes left floating), then pulls itself back together
      P.melt = sstep(p / 0.4) * (1 - sstep((p - 0.72) / 0.28));
      P.steam = P.melt * 0.6;
      break;
    }
    case 'lay': { // thornback: hunch, a thorn pops off the back and is flicked behind
      P.crouch = Math.sin(Math.PI * clamp(p / 0.35, 0, 1)) * 0.8;
      P.lay = p;
      P.angry = 0.5 * Math.sin(Math.PI * p);
      break;
    }
    case 'flipped': { // thornback: knocked on its back, flails, rights itself
      P.roll = p < 0.16 ? sstep(p / 0.16) : p < 0.84 ? 1 : 1 - sstep((p - 0.84) / 0.16);
      P.flail = p > 0.12 && p < 0.88 ? 1 : 0;
      P.dazed = P.flail;
      break;
    }
    case 'snatch': { // chameleon: tongue shoots out, sticks, reels back in, gulps
      P.snatch = p < 0.22 ? sstep(p / 0.22) : p < 0.34 ? 1 : 1 - sstep((p - 0.34) / 0.38);
      P.mouth = clamp(P.snatch * 3, 0, 1) * 0.5;
      P.crouch = 0.4 * Math.sin(Math.PI * clamp(p / 0.25, 0, 1));
      P.swell = p > 0.72 ? Math.sin(Math.PI * (p - 0.72) / 0.28) * 0.6 : 0;
      break;
    }
    case 'sick': P.walk = 1; P.flee = 1; P.sick = 1; P.dazed = 0.6; break;
  }
  return P;
}

// Optional pose blender for the game: eases every channel, lets a walk run on to a phase where all four feet are
// planted before it stops (no foot pops), and reports how far the body moved this frame.
//   const A = crawlerAnim(); each frame: const adv = A.update(dt, { pose, p, speed, stride }); pathPos += adv;
//   drawCrawler(ctx, x, y, s, t, { ...A.opts(), trail, ... }, species)      (stride = species.stride / 100 * s)
export function crawlerAnim() {
  const st = { gait: 0, v: 0, stopAt: null, pose: 'idle', p: 0, B: poseParams('idle', 0) };
  const rates = { walk: 7, rear: 9, crouch: 14, mouth: 14, fire: 18, swell: 10, dazed: 5, angry: 9, shake: 12, flee: 6, splay: 5, tongue: 12, steam: 3, frill: 8, melt: 6, roll: 10, flail: 10, lay: 30, lick: 12, snatch: 30, sick: 6, frost: 4 };
  return {
    st,
    update(dt, want) {
      dt = clamp(dt || 0, 0, 0.1);
      const pose = want.pose || 'idle', moving = pose === 'walk' || pose === 'flee' || pose === 'frost' || pose === 'sick';
      const tgt = poseParams(pose, clamp(want.p || 0, 0, 1));
      st.pose = pose; st.p = want.p || 0;
      let adv = 0;
      const sp = Math.max(0, want.speed || 0); // px / s along the path
      if (moving) {
        st.stopAt = null;
        st.v += (sp - st.v) * (1 - Math.exp(-dt * 6));
        adv = st.v * dt;
      } else if (st.v > 1e-3 || st.stopAt !== null) {
        // run on to the next "all feet down" phase (0.05 or 0.55 of the stride), slowing as it arrives
        const L = want.stride || 1;
        if (st.stopAt === null) {
          const q = st.gait / L, base = Math.floor(q);
          st.stopAt = [base + 0.05, base + 0.55, base + 1.05].find((x) => x > q + 0.02) * L;
        }
        const r = st.stopAt - st.gait;
        const v = Math.min(Math.max(st.v, 4), Math.max(r * 5, 2));
        adv = Math.min(r, v * dt);
        st.v = r - adv > 0.01 ? v : 0;
        if (!(r - adv > 0.01)) st.stopAt = null;
      }
      st.gait += adv;
      for (const c of CHANNELS) st.B[c] += (tgt[c] - st.B[c]) * (1 - Math.exp(-dt * rates[c]));
      if (st.stopAt !== null) st.B.walk = Math.max(st.B.walk, 0.02); // feet keep stepping until all four are down
      return adv;
    },
    opts() { return { gait: st.gait, pose: st.pose, p: st.p, blend: st.B }; },
  };
}

/* ---------------------------------------------------------------- per-frame palette */
const GREY = pal({ line: '#25211f', rock: '#6b6560', rockHi: '#a29a92', rockLo: '#3f3b38', mag: '#4a4542', jaw: '#8d8780', belly: '#a39d95', eye: '#e6dcb0' });
function framePalette(sp, cool, camo, camoC, sick, t) {
  const S = sp.pal, K = {};
  for (const k in S) K[k] = S[k];
  if (cool > 0) {
    for (const k of ['rock', 'rockHi', 'rockLo']) K[k] = mixA(S[k], GREY[k], cool);
    for (const k of ['magLo', 'magMid', 'magHot', 'claw']) K[k] = mixA(S[k], GREY.mag, cool);
    K.line = mixA(S.line, GREY.line, cool); K.jaw = mixA(S.jaw, GREY.jaw, cool); K.belly = mixA(S.belly, GREY.belly, cool);
    K.eye = mixA(S.eye, GREY.eye, cool); K.eyeLo = mixA(S.eyeLo, GREY.eye, cool * 0.7);
    K.brow = mixA(S.brow, GREY.rockHi, cool); K.browLo = mixA(S.browLo, GREY.rockHi, cool);
  }
  if (sick > 0) {
    const h = mod(t * 1.6, 1);
    const a = hues(h), b = hues(mod(h + 0.33, 1)), c = hues(mod(h + 0.66, 1));
    for (const k of ['magLo', 'magMid']) K[k] = mixA(S[k], a, sick);
    K.magHot = mixA(S.magHot, mixA(a, [255, 255, 255], 0.4), sick);
    for (const k of ['rock', 'rockLo']) K[k] = mixA(S[k], b, sick);
    K.rockHi = mixA(S.rockHi, c, sick);
  }
  if (camo > 0 && camoC) {
    const lo = mixA(camoC, [0, 0, 0], 0.25), hi = mixA(camoC, [255, 255, 255], 0.12);
    for (const k of ['magLo', 'magMid', 'rock', 'rockLo', 'belly', 'jaw', 'claw', 'eyeLo']) K[k] = mixA(K[k], k === 'rockLo' ? lo : camoC, camo * 0.92);
    for (const k of ['magHot', 'rockHi', 'eye']) K[k] = mixA(K[k], hi, camo * 0.9);
    K.line = mixA(K.line, lo, camo * 0.75);
  }
  return K;
}

/* ---------------------------------------------------------------- main */
export function drawCrawler(ctx, x, y, s, t = 0, opts = {}, species = 'salamander') {
  if (!(s > 0)) return;
  const sp = typeof species === 'string' ? SPECIES[species] : species;
  if (!sp) return;
  opts = opts || {};
  ctx.save();
  try {
    useSpecies(sp);
    drawBody(ctx, x, y, s, t, opts);
  } catch (e) {
    if (opts.debug) throw e; // art must never break the frame (QA tools pass debug to see errors)
  }
  ctx.restore();
}

function drawBody(ctx, x0, y0, s, t, opts) {
  const U = s / 100;
  const pose = opts.pose || 'walk';
  const p = clamp(opts.p || 0, 0, 1);
  const P = poseParams(pose, p);
  if (opts.blend) for (const c of CHANNELS) if (opts.blend[c] !== undefined) P[c] = opts.blend[c];
  if (opts.rear !== undefined) P.rear = opts.rear;
  if (opts.mouth !== undefined) P.mouth = opts.mouth;
  const cool = clamp(opts.cool !== undefined ? opts.cool : pose === 'cool' ? 1 : 0, 0, 1);
  if (cool > 0.3) P.steam = Math.max(P.steam, cool);
  const camo = clamp(opts.camo || 0, 0, 1) * (1 - P.sick);
  const glow = clamp(opts.glow !== undefined ? opts.glow : 0.75, 0, 1) * (1 - cool) + P.swell * 0.5 * (1 - cool);
  const gait = (opts.gait || 0) / U; // in U
  const K = framePalette(SP, cool, camo, opts.camoColor, P.sick, t);
  const magAt = (k) => (k < 0.5 ? mixA(K.magLo, K.magMid, k * 2) : mixA(K.magMid, K.magHot, k * 2 - 1));
  K.magAt = magAt;
  ctx.translate(x0, y0);

  // ---- path: d (px) behind the snout -> PT {x, y, a (travel angle)}
  const trail = opts.trail;
  const h0 = opts.heading || 0, kap = opts.curve || 0;
  let path;
  if (typeof trail === 'function') {
    const e = 2 * U;
    path = (d) => {
      const dd = Math.max(0, d);
      const q = trail(dd), qa = trail(dd + e), qb = trail(Math.max(0, dd - e));
      let a = Math.atan2(qb.y - qa.y, qb.x - qa.x);
      if (!(dd > e)) { const qc = trail(dd + 2 * e); a = Math.atan2(q.y - qc.y, q.x - qc.x); }
      PT.x = q.x - x0 + (d < 0 ? Math.cos(a) * -d : 0);
      PT.y = q.y - y0 + (d < 0 ? Math.sin(a) * -d : 0);
      PT.a = a;
      return PT;
    };
  } else {
    path = (d) => {
      const a = h0 - kap * d;
      if (Math.abs(kap) < 1e-7) { PT.x = -d * Math.cos(h0); PT.y = -d * Math.sin(h0); }
      else { PT.x = -(Math.sin(h0) - Math.sin(a)) / kap; PT.y = -(-Math.cos(h0) + Math.cos(a)) / kap; }
      PT.a = a;
      return PT;
    };
  }

  // ---- spine
  const ph = (gait / STRIDE) * TAU; // body wave phase
  const wk = P.walk * (1 - P.rear * 0.8) * (1 - P.melt) * (1 - P.roll);
  const A = SP.wave * (P.flee ? 1.25 : 1) * wk;
  const breathe = 1 + 0.035 * Math.sin(t * 2.3) * (1 - P.walk) + P.swell * 0.12;
  const idleSway = (1 - P.walk) * (1 - P.dazed * 0.5) * (1 - P.roll);
  const cph = Math.cos(ph);
  for (let i = 0; i < NS; i++) {
    const u = i * DU;
    const q = path(u * U);
    let lat;
    if (u < U_SH) lat = A * 0.42 * cph * (1 - u / U_SH);
    else if (u < U_HIP) lat = -A * cph * Math.sin((Math.PI * (u - U_SH)) / (U_HIP - U_SH));
    else {
      const r = clamp((u - U_HIP) / 26, 0, 1), f = (u - U_HIP) / (UMAX - U_HIP);
      lat = -(2.5 + SP.tailWave * f) * r * Math.cos(ph - (u - U_HIP) * (TAU / 120)) * wk;
      lat += idleSway * r * (Math.sin(t * 1.25 - u * 0.045) * (2 + 9 * f * f) * (SP.curl ? 0.3 : 1)); // lazy tail curl
      lat += P.shake * r * Math.sin(t * 22 - u * 0.1) * 5 * f; // rattling tail tip on a hiss
      lat += P.flail * r * Math.sin(t * 17 - u * 0.08) * 4 * f; // thrashing on its back
    }
    const nx = -Math.sin(q.a), ny = Math.cos(q.a);
    bx[i] = q.x + nx * lat * U;
    by[i] = q.y + ny * lat * U;
    let w = hwAt(u);
    if (u > U_SH - 6 && u < U_HIP + 6) w *= breathe;
    sw[i] = w * U;
  }
  // chameleon: the tail tip rolls up into a spiral
  if (SP.curl) {
    const i0 = Math.round(SP.curl / DU);
    const curlK = 1 - 0.55 * P.walk * (1 - P.sick); // it uncurls a little while walking
    let a = Math.atan2(by[i0] - by[i0 - 1], bx[i0] - bx[i0 - 1]);
    for (let i = i0 + 1; i < NS; i++) {
      const f = (i - i0) / (NS - 1 - i0);
      a += (0.18 + 0.75 * f * f) * curlK + Math.sin(t * 1.3) * 0.01;
      bx[i] = bx[i - 1] + Math.cos(a) * DU * U;
      by[i] = by[i - 1] + Math.sin(a) * DU * U;
    }
  }
  // pitch up: the front half first coils (foreshortened), then swings up toward the camera
  const hipI = Math.round(U_HIP / DU);
  const fore = 0.22 * P.crouch + 0.26 * Math.sin(Math.PI * clamp(P.rear, 0, 1)) * (1 - P.crouch * 0.5);
  for (let i = 0; i < NS; i++) {
    let X = bx[i], Y = by[i];
    if ((P.rear > 0 || P.crouch > 0) && i < hipI) {
      const f = (U_HIP - i * DU) / U_HIP;
      const c = 1 - f * fore + 0.07 * P.rear * f;
      X = bx[hipI] + (X - bx[hipI]) * c;
      Y = by[hipI] + (Y - by[hipI]) * c;
      sw[i] *= 1 + 0.3 * P.rear * f + 0.06 * P.crouch * f;
    }
    sx[i] = X; sy[i] = Y;
  }
  // melting (gecko): the body slumps toward its middle and spreads
  if (P.melt > 0) {
    const mi = Math.round((U_SH + U_HIP) / 2 / DU), mx = sx[mi], my = sy[mi];
    for (let i = 0; i < NS; i++) {
      sx[i] = mx + (sx[i] - mx) * (1 - 0.55 * P.melt);
      sy[i] = my + (sy[i] - my) * (1 - 0.55 * P.melt);
      sw[i] *= 1 + 0.35 * P.melt + 0.05 * Math.sin(t * 9 + i);
    }
  }
  // rolling over (thornback): the body narrows to its edge and opens again belly-up
  const rc = Math.cos(Math.PI * P.roll), belly = rc < 0;
  if (P.roll > 0) for (let i = 0; i < NS; i++) sw[i] *= Math.max(0.18, Math.abs(rc));
  for (let i = 0; i < NS; i++) {
    const a = Math.max(0, i - 1), b = Math.min(NS - 1, i + 1);
    const tx = sx[a] - sx[b], ty = sy[a] - sy[b], l = Math.hypot(tx, ty) || 1;
    snx[i] = -ty / l; sny[i] = tx / l;
  }

  const lw = Math.max(1.15, 2.3 * U);
  const lineA = 1 - 0.55 * camo;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const fadeA = 1 - 0.88 * sstep((P.melt - 0.6) / 0.3); // a melted gecko is only a puddle and a pair of eyes

  // ---- dive clip (flee into a lava pit): everything past the pit's centre line is under the lava
  let hole = null;
  if (opts.dive !== undefined && opts.dive !== null) {
    const q = path(opts.dive);
    hole = { x: q.x, y: q.y, a: q.a, r: 21 * U };
    drawPit(ctx, hole, U, t, true);
    ctx.save();
    ctx.beginPath();
    ctx.rect(-1e4, -1e4, 2e4, 2e4);
    const ca = Math.cos(hole.a), sa = Math.sin(hole.a), L = 1e4;
    ctx.moveTo(hole.x - sa * L, hole.y + ca * L);
    ctx.lineTo(hole.x - sa * L + ca * L, hole.y + ca * L + sa * L);
    ctx.lineTo(hole.x + sa * L + ca * L, hole.y - ca * L + sa * L);
    ctx.lineTo(hole.x + sa * L, hole.y - ca * L);
    ctx.closePath();
    ctx.clip('evenodd');
  }

  // ---- melt puddle under the gecko
  if (P.melt > 0.02) drawPuddle(ctx, spAt((U_SH + U_HIP) / 2), U, P.melt, t, K);

  // ---- feet
  const feet = [];
  for (const L of SP._legs) feet.push(footFor(L, gait, P, path, U, t, belly));
  if (opts.out) opts.out.feet = feet.map((f) => ({ x: f.fx + x0, y: f.fy + y0, lift: f.lift }));

  ctx.globalAlpha = fadeA;
  // ---- ground shadow (unreared body, offset down-right like the snake)
  const so = 3.2 * U;
  if (P.rear > 0) for (let i = 0; i < hipI; i++) {
    const f = (U_HIP - i * DU) / U_HIP, k = P.rear * f * f;
    bx[i] += 7 * U * k; by[i] += 9 * U * k;
  }
  if (P.melt < 0.5) {
    ctx.fillStyle = `rgba(0,0,0,${(0.3 - 0.08 * P.rear) * (1 - camo * 0.6)})`;
    ctx.beginPath();
    outlineFrom(ctx, P.melt > 0 || P.roll > 0 ? sx : bx, P.melt > 0 || P.roll > 0 ? sy : by, so, so * 1.25, 1);
    ctx.fill();
    ctx.beginPath();
    const hw0 = SP.head.W * SP.head.scale * 1.02;
    ctx.ellipse(bx[1] + so + 2 * U, by[1] + so * 1.25, hw0 * U * (1 + 0.15 * P.rear), hw0 * 0.95 * U * (1 + 0.15 * P.rear), 0, 0, TAU);
    ctx.fill();
  }

  // ---- legs (under the body: shoulders and hips are hidden by the body outline)
  const limbC = SP.glows ? mixA(K.magMid, K.rock, 0.38) : mixA(K.magMid, K.magLo, 0.35);
  const L4 = { U, lw, K, limbC, lineA };
  const upFront = P.rear > 0.35;
  if (!belly) drawLegs(ctx, upFront ? feet.filter((f) => !f.L.front) : feet, L4);

  // ---- body
  const bodyPath = (ox, oy) => {
    for (let i = 1; i < NS; i++) {
      const X = sx[i] + snx[i] * sw[i] + ox, Y = sy[i] + sny[i] * sw[i] + oy;
      if (i === 1) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    }
    for (let i = NS - 1; i >= 1; i--) ctx.lineTo(sx[i] - snx[i] * sw[i] + ox, sy[i] - sny[i] * sw[i] + oy);
    ctx.closePath();
  };
  const g0 = spAt(0), tl = spAt(UMAX);
  const grad = ctx.createLinearGradient(g0.x, g0.y, tl.x, tl.y);
  for (let k = 0; k <= 5; k++) {
    const f = k / 5;
    const gl = SP.glows ? clamp(glow * (0.86 + 0.26 * Math.sin(t * 2.4 - f * 7)) - f * 0.18 * glow + 0.08, 0, 1) : 0.5 + 0.12 * Math.sin(f * 9 + 1) - f * 0.1;
    grad.addColorStop(f, rgb(belly ? mixA(K.belly, K.jaw, f) : magAt(gl)));
  }
  if (SP.halo && glow > 0.05 && !cool && !belly) {
    ctx.beginPath();
    bodyPath(0, 0);
    ctx.strokeStyle = rgb(SP.halo, 0.3 * glow * (1 - camo));
    ctx.lineWidth = lw + 6 * U;
    ctx.stroke();
  }
  // thornback fringe spikes poke out from under the body edge
  if (SP.spikes && !belly) drawFringe(ctx, U, lw, K, lineA);
  ctx.beginPath();
  bodyPath(0, 0);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.save();
  ctx.clip();
  if (!belly) {
    // pattern: a light pass, then the base shifted down-right (top-left rim catches the light)
    const PL = pattern(SP);
    const patPath = (ox, oy) => { ctx.beginPath(); for (const pl of PL) polyShape(ctx, pl, ox, oy); };
    const patA = 1 - 0.75 * camo;
    patPath(0, 0);
    ctx.fillStyle = rgb(K.rockHi, patA);
    ctx.fill();
    ctx.save();
    ctx.clip();
    patPath(0.9 * U, 1.1 * U);
    ctx.fillStyle = rgb(K.rock, patA);
    ctx.fill();
    ctx.restore();
    if (SP.pattern === 'crystals') drawSparkles(ctx, U, t, glow, P.frost);
    // rim just inside the outline: the silhouette reads against dark rings
    ctx.beginPath();
    bodyPath(0, 0);
    ctx.strokeStyle = rgb(SP.glows ? magAt(clamp(glow + 0.3, 0, 1)) : K.magHot, SP.rim * (1 - 0.7 * camo));
    ctx.lineWidth = 3.6 * U;
    ctx.stroke();
    if (SP.crest) drawFlankDots(ctx, U, K, camo);
    if (P.rear > 0.02) drawBelly(ctx, U, P.rear, K, lw, 16, 50);
  } else {
    drawBelly(ctx, U, 1, K, lw, 10, U_HIP + 30); // belly up
  }
  // cel shadow: lower-right crescent of the whole body
  ctx.beginPath();
  ctx.rect(-1e4, -1e4, 2e4, 2e4);
  bodyPath(-3.4 * U, -4.2 * U);
  ctx.fillStyle = rgb(K.rockLo, 0.38 * (1 - camo * 0.6));
  ctx.fill('evenodd');
  ctx.restore();
  ctx.beginPath();
  bodyPath(0, 0);
  ctx.strokeStyle = rgb(K.line, lineA);
  ctx.lineWidth = lw;
  ctx.stroke();
  if (SP.spikes && !belly) drawSpikes(ctx, U, lw, K, P, t, opts.out, x0, y0);
  if (SP.crest && !belly) drawCrest(ctx, U, lw, K, lineA);
  if (belly) drawLegs(ctx, feet, L4); // legs flail in the air above the upturned belly
  if (upFront) drawLegs(ctx, feet.filter((f) => f.L.front), L4);

  // ---- head
  const hc = spAt(U_HEAD);
  const hb = spAt(U_HEAD + 12);
  const hcx = hc.x, hcy = hc.y;
  let ha = Math.atan2(hcy - hb.y, hcx - hb.x) + (opts.aim || 0);
  ha += Math.sin(t * 3.1) * 0.28 * P.dazed;
  if (P.shake) ha += Math.sin(t * 31) * 0.05 * P.shake;
  if (P.sick) ha += Math.sin(t * 13) * 0.12 * P.sick;
  const hs = (SP.head.scale + 0.3 * P.rear) * U * (1 - 0.2 * P.melt);
  // face reads upright on screen: forward = up while the head points up-screen, flipped while it points down
  const id = opts.id | 0, upness = -Math.sin(ha);
  let fu = faceUp[id] === undefined ? (upness >= 0 ? 1 : -1) : faceUp[id];
  if (upness > 0.3) fu = 1; else if (upness < -0.3) fu = -1;
  faceUp[id] = fu;
  ctx.globalAlpha = 1;
  if (P.melt > 0.75) { // only the eyes float on the puddle
    ctx.save();
    ctx.translate(hcx, hcy + 6 * U * P.melt);
    ctx.rotate(ha);
    ctx.scale(hs, hs);
    for (const sd of [-1, 1]) drawEye(ctx, SP.head.eyeX * 0.6, sd * SP.head.eyeY * 0.7, sd, t, blinkAt(t, 0.4), { x: 0, y: 0 }, P, lw / hs, K, fu);
    ctx.restore();
  } else {
    ctx.globalAlpha = fadeA;
    ctx.save();
    ctx.translate(hcx, hcy);
    ctx.rotate(ha);
    ctx.scale(hs, belly ? -hs : hs);
    HS_PX = hs; BELLY = belly;
    drawHead(ctx, t, opts, P, glow, cool, lw / hs, K, fu, lineA);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // ---- fire jet (salamander) / tongue (chameleon)
  const ca = Math.cos(ha), sa = Math.sin(ha);
  if (P.fire > 0.01) {
    const mx = hcx + ca * (16 + 6 * P.mouth) * hs, my = hcy + sa * (16 + 6 * P.mouth) * hs;
    const tip = drawFire(ctx, mx, my, ha, P.fire, U, t, opts.fireLen || 60);
    if (opts.out) opts.out.fire = { x: tip.x + x0, y: tip.y + y0 };
  }
  if (P.snatch > 0.01) {
    const mx = hcx + ca * (SP.head.tip - 1) * hs, my = hcy + sa * (SP.head.tip - 1) * hs;
    const tg = opts.target ? { x: opts.target.x - x0, y: opts.target.y - y0 } : { x: mx + ca * 120 * U, y: my + sa * 120 * U };
    const tip = { x: lerp(mx, tg.x, P.snatch), y: lerp(my, tg.y, P.snatch) };
    drawLongTongue(ctx, mx, my, tip.x, tip.y, U, lw, t);
    if (opts.out) opts.out.tongue = { x: tip.x + x0, y: tip.y + y0, k: P.snatch };
  }

  if (hole) {
    ctx.restore();
    drawPit(ctx, hole, U, t, false, opts.dive > 0 && opts.dive < UMAX * U ? 1 : 0);
  }

  // ---- steam (cooling, melting), frost breath, dizzy stars
  if (P.steam > 0.01) drawSteam(ctx, U, t, P.steam * (opts.steam !== undefined ? opts.steam : 1));
  if (P.frost > 0.01 || SP === SPECIES.gecko) drawFrostBreath(ctx, hcx + ca * 16 * hs, hcy + sa * 16 * hs, ha, U, t, 0.4 + 0.6 * P.frost);
  if (P.dazed > 0.3) drawStars(ctx, hcx, hcy, U, t);
}

// Foot position for one leg: planted feet sit at a fixed spot on the walked path (no sliding); a swinging
// foot travels to the next plant and lifts toward the camera.
function footFor(L, gait, P, path, U, t, belly) {
  const G = SP.legs;
  const rf = DUTY * STRIDE / 2 + (L.front ? 4 : -6);
  const lat = (L.front ? G.latF : G.latH) + P.splay * 5;
  const q = gait / STRIDE + L.off;
  const n = Math.floor(q), psi = q - n;
  const plantS = (m) => (m - L.off) * STRIDE - L.g + rf;
  let S, lift = 0;
  if (psi < DUTY || P.walk < 0.01) S = psi < DUTY ? plantS(n) : plantS(n + 1);
  else {
    const w = (psi - DUTY) / (1 - DUTY);
    S = lerp(plantS(n), plantS(n + 1), sstep(w));
    lift = Math.sin(Math.PI * w);
  }
  const d = (gait - S) * U;
  const pt = path(d);
  const nx = -Math.sin(pt.a), ny = Math.cos(pt.a);
  const ll = lat - lift * 5;
  let fx = pt.x + nx * L.side * ll * U, fy = pt.y + ny * L.side * ll * U;
  let fa = pt.a + L.side * (L.front ? 0.55 : 1.2);
  const swing = lift;
  // rearing: front feet come off the ground and paddle at the chest
  if (L.front && P.rear > 0) {
    const g = spAt(L.g + 12);
    const tx = g.x + g.nx * L.side * 21 * U, ty = g.y + g.ny * L.side * 21 * U;
    const wv = Math.sin(t * 9 + L.side) * 2 * U * P.rear;
    fx = lerp(fx, tx + wv, P.rear);
    fy = lerp(fy, ty - wv, P.rear);
    lift = Math.max(lift, P.rear);
  }
  // melting: feet splay out into the puddle
  if (P.melt > 0) {
    const g = spAt(L.g);
    const tx = g.x + g.nx * L.side * (lat + 4) * U, ty = g.y + g.ny * L.side * (lat + 4) * U;
    fx = lerp(fx, tx, P.melt); fy = lerp(fy, ty, P.melt);
  }
  // on its back: legs paddle at the sky
  if (P.roll > 0.5) {
    const g = spAt(L.g), k = sstep((P.roll - 0.5) * 2);
    const ph = t * 15 + (L.front ? 0 : 2) + L.side;
    const out = g.w / U + 7 + (L.front ? 0 : 2), tx = g.x + g.nx * L.side * out * U + Math.cos(ph) * 3.5 * U, ty = g.y + g.ny * L.side * out * U + Math.sin(ph) * 3.5 * U;
    fx = lerp(fx, tx, k); fy = lerp(fy, ty, k);
    fa += Math.sin(ph) * 0.6 * k;
    lift = Math.max(lift, k);
  }
  const g = spAt(L.g);
  const hipK = belly ? 0.8 : 0.5;
  const hip = { x: g.x + g.nx * L.side * g.w * hipK, y: g.y + g.ny * L.side * g.w * hipK };
  const g2 = spAt(L.g - 4);
  const ba = Math.atan2(g2.y - g.y, g2.x - g.x);
  return { L, hip, fx, fy, fa, lift, swing, ba };
}

function ik(hx, hy, fx, fy, l1, l2, prefer) {
  let dx = fx - hx, dy = fy - hy, D = Math.hypot(dx, dy) || 1e-6;
  const max = (l1 + l2) * 0.995;
  if (D > max) { fx = hx + (dx / D) * max; fy = hy + (dy / D) * max; dx = fx - hx; dy = fy - hy; D = max; }
  const a = Math.acos(clamp((l1 * l1 + D * D - l2 * l2) / (2 * l1 * D), -1, 1));
  const b = Math.atan2(dy, dx);
  const k1x = hx + Math.cos(b + a) * l1, k1y = hy + Math.sin(b + a) * l1;
  const k2x = hx + Math.cos(b - a) * l1, k2y = hy + Math.sin(b - a) * l1;
  const d1 = k1x * prefer.x + k1y * prefer.y, d2 = k2x * prefer.x + k2y * prefer.y;
  return d1 > d2 ? { kx: k1x, ky: k1y, fx, fy } : { kx: k2x, ky: k2y, fx, fy };
}

function drawLegs(ctx, feet, L4) {
  if (!feet.length) return;
  const { U, lw, K, limbC, lineA } = L4, G = SP.legs;
  const up = G.up * U, lo = G.lo * U, toe = G.toe * U, pad = G.pad * U;
  const J = feet.map((F) => {
    const L = F.L;
    const l1 = (L.front ? G.l1f : G.l1h) * U, l2 = (L.front ? G.l2f : G.l2h) * U;
    // elbows point back, knees point forward, both away from the body
    const ca = Math.cos(F.ba), sa = Math.sin(F.ba), nx = -sa * L.side, ny = ca * L.side;
    const pref = L.front ? { x: -ca + nx * 1.2, y: -sa + ny * 1.2 } : { x: ca + nx * 1.2, y: sa + ny * 1.2 };
    return { F, ...ik(F.hip.x, F.hip.y, F.fx, F.fy, l1, l2, pref) };
  });
  const sc = (F) => 1 + 0.18 * F.lift;
  // toe tips (for the toe strokes, pads and claw dots)
  const tips = (F, fx, fy, fn) => {
    const n = F.L.front ? G.toesF : G.toesH;
    const curl = 1 - 0.45 * F.swing;
    if (G.feet === 'mitts') { // chameleon: two opposed bundles of fused toes
      for (const k of [-1, 1]) {
        const a = F.fa + k * 0.75, len = G.toeLen * U * curl * sc(F);
        fn(fx + Math.cos(a) * len, fy + Math.sin(a) * len, a);
      }
      return;
    }
    const spread = G.feet === 'pads' ? 1.9 : F.L.front ? 1.5 : 1.7;
    for (let i = 0; i < n; i++) {
      const a = F.fa + (i / (n - 1) - 0.5) * spread;
      const len = G.toeLen * U * (F.L.front ? 1 : 1.1) * curl * (1 + (i === n - 2 ? 0.25 : 0)) * sc(F);
      fn(fx + Math.cos(a) * len, fy + Math.sin(a) * len, a);
    }
  };
  const pass = (extra, col) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = up + extra;
    ctx.beginPath();
    for (const j of J) { ctx.moveTo(j.F.hip.x, j.F.hip.y); ctx.lineTo(j.kx, j.ky); }
    ctx.stroke();
    ctx.lineWidth = lo + extra;
    ctx.beginPath();
    for (const j of J) { ctx.moveTo(j.kx, j.ky); ctx.lineTo(j.fx, j.fy); }
    ctx.stroke();
    ctx.lineWidth = (G.feet === 'mitts' ? toe * 1.5 : toe) + extra;
    ctx.beginPath();
    for (const j of J) tips(j.F, j.fx, j.fy, (X, Y) => { ctx.moveTo(j.fx, j.fy); ctx.lineTo(X, Y); });
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath();
    for (const j of J) {
      const r = (pad + extra / 2) * sc(j.F);
      ctx.moveTo(j.fx + r, j.fy); ctx.arc(j.fx, j.fy, r, 0, TAU);
      if (G.feet === 'pads') tips(j.F, j.fx, j.fy, (X, Y) => { const rr = 1.7 * U + extra / 2; ctx.moveTo(X + rr, Y); ctx.arc(X, Y, rr, 0, TAU); });
    }
    ctx.fill();
  };
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  for (const j of J) if (j.F.lift > 0.15) { const r = pad * 1.2; ctx.moveTo(j.fx + r + 3 * U * j.F.lift, j.fy + 4 * U * j.F.lift); ctx.arc(j.fx + 3 * U * j.F.lift, j.fy + 4 * U * j.F.lift, r, 0, TAU); }
  ctx.fill();
  pass(lw * 2, rgb(K.line, lineA));
  pass(0, rgb(limbC));
  ctx.strokeStyle = rgb(K.rockHi, 0.6);
  ctx.lineWidth = up * 0.32;
  ctx.beginPath();
  for (const j of J) {
    const ox = -0.22 * up, oy = -0.26 * up;
    ctx.moveTo(j.F.hip.x + ox, j.F.hip.y + oy);
    ctx.lineTo(j.kx + ox, j.ky + oy);
    ctx.lineTo(j.fx + ox * 0.6, j.fy + oy * 0.6);
  }
  ctx.stroke();
  if (G.feet !== 'pads') { // claw tips
    ctx.fillStyle = rgb(K.claw);
    ctx.beginPath();
    for (const j of J) tips(j.F, j.fx, j.fy, (X, Y) => { ctx.moveTo(X + 1.1 * U, Y); ctx.arc(X, Y, 1.1 * U, 0, TAU); });
    ctx.fill();
  } else { // sticky toe pads catch the light
    ctx.fillStyle = rgb(K.magHot);
    ctx.beginPath();
    for (const j of J) tips(j.F, j.fx, j.fy, (X, Y) => { ctx.moveTo(X + 0.9 * U, Y - 0.4 * U); ctx.arc(X - 0.2 * U, Y - 0.4 * U, 0.9 * U, 0, TAU); });
    ctx.fill();
  }
}

// Pale throat and chest (rearing), or the whole belly when a crawler is on its back.
const BQ = { x: 0, y: 0, nx: 0, ny: 0, w: 0 };
function drawBelly(ctx, U, k, K, lw, u0, u1) {
  const pt = (u, v) => { const q = spInto(u, BQ); return [q.x + q.nx * q.w * v, q.y + q.ny * q.w * v]; };
  const a = clamp(k * 1.3, 0, 1);
  ctx.beginPath();
  for (let i = 0; i <= 8; i++) { const u = lerp(u0, u1, i / 8), v = 0.82 * Math.sin(Math.PI * (0.15 + 0.85 * i / 8)) + 0.1; const [X, Y] = pt(u, v); if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }
  for (let i = 8; i >= 0; i--) { const u = lerp(u0, u1, i / 8), v = 0.82 * Math.sin(Math.PI * (0.15 + 0.85 * i / 8)) + 0.1; const [X, Y] = pt(u, -v); ctx.lineTo(X, Y); }
  ctx.closePath();
  ctx.fillStyle = rgb(K.belly, a);
  ctx.fill();
  ctx.strokeStyle = rgb(K.line, a * 0.9);
  ctx.lineWidth = lw * 0.8;
  ctx.stroke();
  ctx.beginPath();
  for (let u = u0 + 6; u < u1 - 2; u += 5.5) {
    const [ax, ay] = pt(u, -0.6), [mx, my] = pt(u + 1.6, 0), [bx2, by2] = pt(u, 0.6);
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(mx, my, bx2, by2);
  }
  ctx.strokeStyle = `rgba(160,100,40,${0.55 * a})`;
  ctx.lineWidth = 1.1 * U;
  ctx.stroke();
}

const PQ = { x: 0, y: 0, nx: 0, ny: 0, w: 0 };
function polyShape(ctx, pts, ox, oy) {
  const n = pts.length / 2;
  for (let i = 0; i < n; i++) {
    const q = spInto(pts[2 * i], PQ);
    const X = q.x + q.nx * q.w * pts[2 * i + 1] + ox, Y = q.y + q.ny * q.w * pts[2 * i + 1] + oy;
    if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
  }
  ctx.closePath();
}

function outlineFrom(ctx, X, Y, ox, oy, i0) {
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 0; j < NS - i0; j++) {
      const i = pass ? NS - 1 - j : i0 + j;
      const a = Math.max(0, i - 1), b = Math.min(NS - 1, i + 1);
      const tx = X[a] - X[b], ty = Y[a] - Y[b], l = Math.hypot(tx, ty) || 1;
      const nx = -ty / l, ny = tx / l, w = sw[i] * (pass ? -1 : 1);
      const px = X[i] + nx * w + ox, py = Y[i] + ny * w + oy;
      if (!pass && !j) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
}

/* ---------------------------------------------------------------- body extras */
const XQ = { x: 0, y: 0, nx: 0, ny: 0, w: 0 };
// Thornback: a fringe of short spikes round the body edge (drawn under the body so only the points show).
function drawFringe(ctx, U, lw, K, lineA) {
  ctx.beginPath();
  for (let u = 24; u < 100; u += 5.5) for (const sd of [-1, 1]) {
    const q = spInto(u, XQ), a = q.x + q.nx * q.w * sd * 0.92, b = q.y + q.ny * q.w * sd * 0.92;
    const tx = -q.ny * sd, ty = q.nx * sd; // along the body (toward the tail on both sides after the sign flip)
    const L = (3.2 + 1.6 * Math.sin(u)) * U;
    ctx.moveTo(a + tx * 2.2 * U * sd, b + ty * 2.2 * U * sd);
    ctx.lineTo(a + q.nx * sd * L - tx * 1.6 * U * sd, b + q.ny * sd * L - ty * 1.6 * U * sd);
    ctx.lineTo(a - tx * 2.2 * U * sd, b - ty * 2.2 * U * sd);
    ctx.closePath();
  }
  ctx.fillStyle = rgb(K.spike);
  ctx.fill();
  ctx.strokeStyle = rgb(K.line, lineA);
  ctx.lineWidth = lw * 0.8;
  ctx.stroke();
}
// Thornback: two rows of conical thorns down the back and a ring on the tail; one pops off on 'lay'.
function drawSpikes(ctx, U, lw, K, P, t, out, x0, y0) {
  const cone = (u, v, r, lean) => {
    const q = spInto(u, XQ);
    const X = q.x + q.nx * q.w * v, Y = q.y + q.ny * q.w * v;
    const tx = -q.ny, ty = q.nx; // toward the tail
    const bx0 = X - tx * r * 0.2, by0 = Y - ty * r * 0.2;
    // seen from above a cone is a teardrop pointing back, tip lit
    ctx.moveTo(bx0 + q.nx * r * 0.75, by0 + q.ny * r * 0.75);
    ctx.quadraticCurveTo(bx0 - tx * r * 0.9, by0 - ty * r * 0.9, bx0 - q.nx * r * 0.75, by0 - q.ny * r * 0.75);
    ctx.lineTo(X + tx * r * lean, Y + ty * r * lean);
    ctx.closePath();
  };
  const layU = 80, lay = P.lay;
  const popped = lay > 0.35; // the thorn at the hips has left the back
  ctx.beginPath();
  for (let u = 32; u < 90; u += 12) for (const v of [-0.48, 0.48]) {
    if (popped && Math.abs(u - layU) < 4 && v > 0) continue;
    cone(u, v, 4.4 * U, 1.7);
  }
  for (let u = 98; u < 134; u += 9) cone(u, 0, 2.8 * U, 1.6);
  ctx.fillStyle = rgb(K.spike);
  ctx.fill();
  ctx.strokeStyle = rgb(K.line);
  ctx.lineWidth = lw * 0.75;
  ctx.stroke();
  ctx.beginPath(); // lit tips
  for (let u = 32; u < 90; u += 12) for (const v of [-0.48, 0.48]) {
    if (popped && Math.abs(u - layU) < 4 && v > 0) continue;
    const q = spInto(u, XQ), X = q.x + q.nx * q.w * v - q.ny * 4.4 * U * 1.2, Y = q.y + q.ny * q.w * v + q.nx * 4.4 * U * 1.2;
    ctx.moveTo(X + 1.5 * U, Y); ctx.arc(X, Y, 1.5 * U, 0, TAU);
  }
  ctx.fillStyle = rgb(K.spikeTip);
  ctx.fill();
  // the popping thorn: rises off the back, arcs behind the tail
  if (lay > 0.25 && lay < 0.98) {
    const k = clamp((lay - 0.3) / 0.6, 0, 1);
    const a = spAt(layU), b = spAt(Math.min(UMAX - 4, layU + 70));
    const X = lerp(a.x + a.nx * a.w * 0.48, b.x + b.nx * 14 * U, k), Y = lerp(a.y + a.ny * a.w * 0.48, b.y + b.ny * 14 * U, k);
    const r = 4.2 * U * (1 + 0.6 * Math.sin(Math.PI * k));
    drawCrawlerThorn(ctx, X, Y - Math.sin(Math.PI * k) * 6 * U, r, t * 9, 0, K);
    if (out) out.thorn = { x: X + x0, y: Y + y0, k };
  }
}
// Chameleon: a saw-tooth crest down the spine.
function drawCrest(ctx, U, lw, K, lineA) {
  ctx.beginPath();
  let first = true;
  for (let u = 20; u <= 120; u += 2.5) {
    const q = spInto(u, XQ), up = Math.round(u / 2.5) % 2 ? 2.6 * U * (1 - (u - 20) / 140) : 0;
    const X = q.x - q.nx * up, Y = q.y - q.ny * up; // the teeth lean to one side so they read from above
    if (first) { ctx.moveTo(X, Y); first = false; } else ctx.lineTo(X, Y);
  }
  ctx.strokeStyle = rgb(K.line, lineA);
  ctx.lineWidth = lw * 1.6;
  ctx.stroke();
  ctx.strokeStyle = rgb(K.magHot, lineA);
  ctx.lineWidth = lw * 0.7;
  ctx.stroke();
}
function drawFlankDots(ctx, U, K, camo) {
  ctx.beginPath();
  for (let u = 26; u < 104; u += 7) for (const v of [-0.62, 0.62]) {
    const q = spInto(u + (v > 0 ? 3 : 0), XQ), X = q.x + q.nx * q.w * v, Y = q.y + q.ny * q.w * v;
    ctx.moveTo(X + 1.3 * U, Y); ctx.arc(X, Y, 1.3 * U, 0, TAU);
  }
  ctx.fillStyle = rgb(K.dot || K.magHot, 1 - 0.85 * camo);
  ctx.fill();
}
// Gecko: frost glints that twinkle on the crystals.
function drawSparkles(ctx, U, t, glow, frost) {
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 0.7 * U;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const f = mod(t * 0.9 + i * 0.37, 1), tw = Math.sin(f * Math.PI) * (0.5 + 0.5 * frost);
    if (tw < 0.2) continue;
    const q = spInto(30 + i * 19, XQ), v = (i % 2 ? 0.4 : -0.4), X = q.x + q.nx * q.w * v, Y = q.y + q.ny * q.w * v, r = 2.6 * U * tw;
    ctx.moveTo(X - r, Y); ctx.lineTo(X + r, Y); ctx.moveTo(X, Y - r); ctx.lineTo(X, Y + r);
  }
  ctx.stroke();
  void glow;
}

// A loose thorn (thornback drops): game-red point on a dark base, crumbling to grit when crumble -> 1.
export function drawCrawlerThorn(ctx, x, y, r, rot = 0, crumble = 0, K = null) {
  ctx.save();
  ctx.translate(x, y);
  if (crumble > 0) {
    ctx.fillStyle = `rgba(140,100,60,${1 - crumble})`;
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4, d = r * (0.3 + crumble * 1.4), rr = r * 0.22 * (1 - crumble * 0.6);
      ctx.moveTo(Math.cos(a) * d + rr, Math.sin(a) * d + crumble * r * 0.6);
      ctx.arc(Math.cos(a) * d, Math.sin(a) * d + crumble * r * 0.6, rr, 0, TAU);
    }
    ctx.fill();
    if (crumble > 0.5) { ctx.restore(); return; }
    ctx.globalAlpha = 1 - crumble * 2;
  }
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.25);
  ctx.lineTo(r * 0.75, r * 0.6);
  ctx.quadraticCurveTo(0, r * 0.9, -r * 0.75, r * 0.6);
  ctx.closePath();
  ctx.fillStyle = '#d43a2a';
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.22);
  ctx.strokeStyle = K ? rgb(K.line) : '#3a0e08';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.15, -r * 0.8);
  ctx.lineTo(-r * 0.42, r * 0.35);
  ctx.strokeStyle = 'rgba(255,220,200,0.8)';
  ctx.lineWidth = Math.max(0.8, r * 0.16);
  ctx.stroke();
  ctx.restore();
}

/* ---------------------------------------------------------------- head (local: +x = snout, units = U) */
// Front edge of the head as bezier segments [c1x, c1y, c2x, c2y, x, y] from the right jaw corner round the snout.
function frontSegs(H, tip) {
  const W = H.W, sn = H.sn;
  return [
    [-1, W],
    [4.5, W, 9.5, W * 0.86, tip - 4.2, sn],
    [tip - 1, sn * 0.72, tip, sn * 0.37, tip, 0],
    [tip, -sn * 0.37, tip - 1, -sn * 0.72, tip - 4.2, -sn],
    [9.5, -W * 0.86, 4.5, -W, -1, -W],
  ];
}
function emitSegs(ctx, segs, ox, k, reverse, move) {
  const T = (x, y) => [ox + (x - ox) * k, y * k];
  if (!reverse) {
    const [x0, y0] = T(segs[0][0], segs[0][1]);
    if (move) ctx.moveTo(x0, y0); else ctx.lineTo(x0, y0);
    for (let i = 1; i < segs.length; i++) {
      const g = segs[i], a = T(g[0], g[1]), b = T(g[2], g[3]), c = T(g[4], g[5]);
      ctx.bezierCurveTo(a[0], a[1], b[0], b[1], c[0], c[1]);
    }
  } else {
    const L = segs[segs.length - 1], [x0, y0] = T(L[4], L[5]);
    if (move) ctx.moveTo(x0, y0); else ctx.lineTo(x0, y0);
    for (let i = segs.length - 1; i >= 1; i--) {
      const g = segs[i], p = i > 1 ? segs[i - 1] : null;
      const end = p ? T(p[4], p[5]) : T(segs[0][0], segs[0][1]);
      const a = T(g[2], g[3]), b = T(g[0], g[1]);
      ctx.bezierCurveTo(a[0], a[1], b[0], b[1], end[0], end[1]);
    }
  }
}
function headOutline(ctx, H, tip, open) {
  const W = H.W, B = H.B;
  ctx.beginPath();
  ctx.moveTo(-15.5, B);
  ctx.bezierCurveTo(-10.5, B + (W - B) * 0.5, -6.5, W, -1, W);
  emitSegs(ctx, frontSegs(H, tip), 0, 1, false, false);
  ctx.bezierCurveTo(-6.5, -W, -10.5, -B - (W - B) * 0.5, -15.5, -B);
  if (!open) { ctx.quadraticCurveTo(-17.5, 0, -15.5, B); ctx.closePath(); }
}

// Salamander neck frill: hot webbed spikes behind the cheeks; folded small while walking, flared on a hiss.
function drawFrill(ctx, P, glow, lw, K) {
  const f = clamp(P.frill, 0, 1);
  if (f < 0.02) return;
  const line = rgb(K.line);
  for (const sd of [-1, 1]) {
    const bases = [[-14.5, 6.5], [-12.5, 10.5], [-9.5, 13.5]];
    const angs = [2.75, 2.35, 1.95];
    const lens = [6 + 9 * f, 7 + 12 * f, 5 + 9 * f];
    const tips = bases.map((b, i) => [b[0] + Math.cos(angs[i]) * lens[i] * (0.4 + 0.6 * f), sd * (b[1] + Math.sin(angs[i]) * lens[i] * (0.4 + 0.6 * f))]);
    ctx.beginPath();
    ctx.moveTo(-15.5, sd * 4);
    for (let i = 0; i < 3; i++) {
      ctx.lineTo(tips[i][0], tips[i][1]);
      if (i < 2) { const mx = (tips[i][0] + tips[i + 1][0]) / 2, my = (tips[i][1] + tips[i + 1][1]) / 2; ctx.quadraticCurveTo((mx + bases[i][0]) / 2, (my + sd * bases[i][1]) / 2 + sd * 1.2, tips[i + 1][0] * 0.98 + mx * 0.02, tips[i + 1][1]); }
    }
    ctx.lineTo(-6, sd * 13);
    ctx.closePath();
    ctx.fillStyle = rgb(K.magAt(clamp(0.45 + 0.45 * f * glow + 0.1, 0, 1)));
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = line;
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 3; i++) { ctx.moveTo(bases[i][0], sd * bases[i][1]); ctx.lineTo(tips[i][0], tips[i][1]); }
    ctx.lineWidth = lw * 0.9;
    ctx.strokeStyle = rgb(K.rock);
    ctx.stroke();
  }
}
// Thornback: a crown of horns round the back of the head.
function drawHorns(ctx, lw, K, H) {
  const horn = (bx0, by0, a, L, w) => {
    ctx.moveTo(bx0 + Math.cos(a + 1.57) * w, by0 + Math.sin(a + 1.57) * w);
    ctx.lineTo(bx0 + Math.cos(a) * L, by0 + Math.sin(a) * L);
    ctx.lineTo(bx0 + Math.cos(a - 1.57) * w, by0 + Math.sin(a - 1.57) * w);
    ctx.closePath();
  };
  ctx.beginPath();
  for (const sd of [-1, 1]) {
    horn(-13, sd * (H.B + 1), Math.PI - sd * 0.55, 9, 2.4);
    horn(-8, sd * (H.W - 1.5), Math.PI - sd * 1.05, 7, 2.2);
    horn(-3, sd * (H.W + 0.2), Math.PI - sd * 1.45, 5, 1.8);
  }
  horn(-15, 0, Math.PI, 7, 2.6);
  ctx.fillStyle = rgb(K.spike);
  ctx.fill();
  ctx.strokeStyle = rgb(K.line);
  ctx.lineWidth = lw * 0.85;
  ctx.stroke();
}
// Chameleon: a casque, a raised helmet ridge running back over the neck.
function drawCasque(ctx, lw, K, lineA) {
  ctx.beginPath();
  ctx.moveTo(-2, -4.5);
  ctx.quadraticCurveTo(-14, -6.5, -26, -1.2);
  ctx.lineTo(-27, 0);
  ctx.lineTo(-26, 1.2);
  ctx.quadraticCurveTo(-14, 6.5, -2, 4.5);
  ctx.closePath();
  ctx.fillStyle = rgb(K.magMid);
  ctx.fill();
  ctx.strokeStyle = rgb(K.line, lineA);
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-3, 0);
  ctx.lineTo(-25, 0);
  ctx.strokeStyle = rgb(K.magHot, 0.9 * lineA);
  ctx.lineWidth = 1.6;
  ctx.stroke();
}

function drawHead(ctx, t, opts, P, glow, cool, lw, K, fu, lineA) {
  const H = SP.head;
  const m = clamp(P.mouth, 0, 1);
  const tip = H.tip - 4 * m;
  const line = rgb(K.line, lineA);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (H.frill) drawFrill(ctx, P, glow, lw, K);
  if (H.horns) drawHorns(ctx, lw, K, H);
  if (H.casque) drawCasque(ctx, lw, K, lineA);

  // lower jaw + open mouth (under the upper head)
  if (m > 0.02) {
    const jx = tip + 2 + 12 * m * (H.tip / 16.8), jw = H.W - 0.3 + 1.5 * P.angry;
    ctx.beginPath();
    ctx.moveTo(-2, -jw);
    ctx.bezierCurveTo(7, -jw - 1, jx, -13 * (0.55 + 0.45 * m) * (H.sn / 10.2), jx, 0);
    ctx.bezierCurveTo(jx, 13 * (0.55 + 0.45 * m) * (H.sn / 10.2), 7, jw + 1, -2, jw);
    ctx.closePath();
    ctx.fillStyle = rgb(K.jaw);
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = line;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(1, -jw + 2.5);
    ctx.bezierCurveTo(8, -jw + 2, jx - 3.2, -10 * m * (H.sn / 10.2), jx - 3.2, 0);
    ctx.bezierCurveTo(jx - 3.2, 10 * m * (H.sn / 10.2), 8, jw - 2, 1, jw - 2.5);
    ctx.closePath();
    ctx.fillStyle = P.fire > 0.05 ? '#ffd860' : '#6e0d0a';
    ctx.fill();
    if (H.mouth === 'smirk') {
      ctx.fillStyle = '#fff4dc';
      ctx.strokeStyle = line;
      ctx.lineWidth = lw * 0.5;
      ctx.beginPath();
      for (const sd of [-1, 1]) {
        const bx0 = jx - 4.6, by0 = sd * 8 * m;
        ctx.moveTo(bx0 + 1.5, by0 - 2 * sd);
        ctx.lineTo(bx0 - 3.6, by0 - 0.2 * sd);
        ctx.lineTo(bx0 + 1.8, by0 + 2 * sd);
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();
    }
    if (P.fire < 0.3 && P.snatch < 0.05) drawTongue(ctx, 5, 0, jx - 5 + 3 * P.tongue + Math.sin(t * 18) * 1.5 * P.tongue, t, lw);
  } else if (P.tongue > 0 || (H.eyes === 'lid' && !BELLY && P.lay < 0.05 && mod(t, 2.7) < 0.32)) {
    const fl = P.tongue > 0 ? 0.7 : Math.sin((mod(t, 2.7) / 0.32) * Math.PI);
    drawTongue(ctx, tip - 2, 0, tip + 10 * fl, t, lw);
  }

  // upper head
  const segs = frontSegs(H, tip);
  headOutline(ctx, H, tip, false);
  ctx.fillStyle = BELLY ? rgb(K.belly) : rgb(SP.glows ? K.magAt(clamp(glow * 0.75 + 0.2, 0, 1)) : K.magMid);
  ctx.fill();
  ctx.save();
  ctx.clip();
  if (BELLY) { // the pale chin with throat folds
    ctx.beginPath();
    for (const x of [-12, -8, -4]) { ctx.moveTo(x, -H.B * 0.7); ctx.quadraticCurveTo(x + 2, 0, x, H.B * 0.7); }
    ctx.strokeStyle = rgb(K.line, 0.35);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  } else {
  // pale upper lip round the snout
  ctx.beginPath();
  emitSegs(ctx, segs, 2, 1, false, true);
  emitSegs(ctx, segs, 2, 0.7, true, false);
  ctx.closePath();
  ctx.fillStyle = rgb(K.jaw);
  ctx.fill();
  if (H.plates) {
    const plate = (ox, oy) => {
      ctx.beginPath();
      for (const sd of [-1, 1]) {
        const poly = (pts) => { pts.forEach(([x, y], i) => (i ? ctx.lineTo(x + ox, sd * y + oy) : ctx.moveTo(x + ox, sd * y + oy))); ctx.closePath(); };
        poly([[-19, 1.3], [-9, 1.3], [-8.4, 4.8], [-10.2, 8], [-17, 8.8]]);
        poly([[-7.6, 1.3], [0.6, 1.3], [1.4, 4], [-0.2, 6.2], [-6.4, 6.4]]);
        poly([[2.2, 1.3], [7.8 - 2 * m, 1.3], [8.4 - 2.5 * m, 3.8], [6.6 - 2 * m, 5.6], [3.2, 4.8]]);
      }
    };
    plate(0, 0);
    ctx.fillStyle = rgb(K.rockHi);
    ctx.fill();
    plate(0.6, 0.8);
    ctx.fillStyle = rgb(K.rock);
    ctx.fill();
  } else if (SP.pattern === 'crystals') {
    ctx.beginPath();
    for (const [x, y, r] of [[-10, 0, 2.4], [-5, 5, 1.6], [-5, -5, 1.6], [3, 0, 1.8]]) { ctx.moveTo(x + r, y); for (let i = 1; i < 6; i++) ctx.lineTo(x + Math.cos(i * TAU / 6) * r, y + Math.sin(i * TAU / 6) * r); ctx.closePath(); }
    ctx.fillStyle = rgb(K.rock);
    ctx.fill();
  } else if (SP.pattern === 'bands') {
    ctx.beginPath();
    ctx.moveTo(-6, -H.W); ctx.lineTo(-3, H.W); ctx.lineTo(1, H.W); ctx.lineTo(-2, -H.W); ctx.closePath();
    ctx.fillStyle = rgb(K.rock, 0.7);
    ctx.fill();
  }
  }
  ctx.beginPath(); // cel shadow, lower-right of the head
  ctx.rect(-40, -40, 80, 80);
  ctx.ellipse(-3, -3.5, H.W + 5, H.W + 5, 0, 0, TAU);
  ctx.fillStyle = rgb(K.rockLo, 0.3);
  ctx.fill('evenodd');
  ctx.restore();
  // rim inside the outline, then the outline (open at the neck so the head flows out of the body)
  ctx.save();
  headOutline(ctx, H, tip, false);
  ctx.clip();
  headOutline(ctx, H, tip, true);
  ctx.strokeStyle = rgb(SP.glows ? K.magAt(clamp(glow + 0.3, 0, 1)) : K.magHot, 0.9 * SP.rim);
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
  headOutline(ctx, H, tip, true);
  ctx.lineWidth = lw;
  ctx.strokeStyle = line;
  ctx.stroke();

  drawMouth(ctx, H, segs, m, lw, line, fu, t, tip);

  // nostrils
  ctx.fillStyle = line;
  ctx.beginPath();
  const nr = H.sn * 0.33;
  const nx0 = 2 + (tip - 2) * 0.74 - 3.4;
  ctx.moveTo(nx0 + 1.15, -nr); ctx.ellipse(nx0, -nr, 1.15, 1.45, 0, 0, TAU);
  ctx.moveTo(nx0 + 1.15, nr); ctx.ellipse(nx0, nr, 1.15, 1.45, 0, 0, TAU);
  ctx.fill();

  const blink = opts.blink !== undefined ? clamp(opts.blink, 0, 1) : P.dazed > 0.5 ? 0 : blinkAt(t, 0.4);
  const look = opts.look || { x: 0, y: 0 };
  for (const sd of [-1, 1]) drawEye(ctx, H.eyeX, sd * H.eyeY, sd, t, blink, look, P, lw, K, fu);
  // gecko: no eyelids, so it licks an eye clean now and then
  if (H.eyes === 'gecko') {
    const lk = mod(t + 1.3, 4.6);
    if (lk < 0.5) {
      const k = Math.sin((lk / 0.5) * Math.PI), sd = Math.floor(t / 4.6) % 2 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(tip - 1, 0);
      ctx.quadraticCurveTo(tip + 4 * k, sd * H.eyeY * 0.9 * k, lerp(tip, H.eyeX + 2, k), sd * H.eyeY * k);
      ctx.strokeStyle = '#4a0a10';
      ctx.lineWidth = 3.4 + lw;
      ctx.stroke();
      ctx.strokeStyle = '#ff6f8a';
      ctx.lineWidth = 3.2;
      ctx.stroke();
    }
  }
}

// Mouth line round the snout, ending just in front of the eyes. smirk: one corner curls up toward the eye and one
// fang hangs over the lip (salamander); grump: both corners turned down (thornback); smile: soft up-turned corners
// (gecko); long: a chameleon's lip line. Never thinner than ~2.4 screen px so it reads at 1x.
let HS_PX = 1, BELLY = false; // head units -> px, and whether the crawler lies on its back (set per draw)
function drawMouth(ctx, H, segs, m, lw, line, fu, t, tip) {
  const mw = Math.max(lw * 1.35, 2.4 / HS_PX);
  ctx.strokeStyle = line;
  ctx.lineWidth = mw;
  ctx.lineCap = 'round';
  // corner in front of the eye socket, then along the jaw round the snout tip
  const ex = H.eyeX + H.eyeR + 2.2, cy = Math.min(H.W * 0.72, H.eyeY - 2.5);
  const cx = Math.max(ex, 1.5), tx = 2 + (tip - 2) * 0.74;
  const sn = H.sn * 0.74;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.bezierCurveTo(cx + (tx - cx) * 0.45, cy * 0.98, tx - 1.2, sn * 0.9, tx, 0);
  ctx.bezierCurveTo(tx - 1.2, -sn * 0.9, cx + (tx - cx) * 0.45, -cy * 0.98, cx, -cy);
  ctx.stroke();
  if (m > 0.02) return;
  ctx.beginPath();
  if (H.mouth === 'smirk') {
    // the curled-up corner is on the side that reads as "up" on screen (toward the brows)
    const sd = fu > 0 ? 1 : -1;
    ctx.moveTo(cx, sd * cy);
    ctx.quadraticCurveTo(cx - 3.2, sd * (cy + 0.8), cx - 2.4, sd * (cy - 4.2));
    ctx.moveTo(cx, -sd * cy);
    ctx.lineTo(cx - 1.4, -sd * (cy + 0.3));
    ctx.stroke();
    // one fang over the lip, poking past the jaw line
    const fx = cx + (tx - cx) * 0.32, fy = sd * cy * 0.99;
    ctx.beginPath();
    ctx.moveTo(fx - 2.6, fy - sd * 0.6);
    ctx.lineTo(fx + 2.2, fy - sd * 0.6);
    ctx.lineTo(fx - 0.8, fy + sd * 6.4);
    ctx.closePath();
    ctx.fillStyle = '#fff4dc';
    ctx.fill();
    ctx.lineWidth = Math.max(lw * 0.6, 1 / HS_PX);
    ctx.stroke();
  } else if (H.mouth === 'grump') {
    for (const sd of [-1, 1]) { ctx.moveTo(cx, sd * cy); ctx.quadraticCurveTo(cx - 1.6, sd * (cy + 0.6), cx - 2.6, sd * (cy + 2.8)); }
    ctx.stroke();
  } else if (H.mouth === 'smile') {
    for (const sd of [-1, 1]) { ctx.moveTo(cx, sd * cy); ctx.quadraticCurveTo(cx - 2.4, sd * (cy + 0.3), cx - 2.8, sd * (cy - 2.6)); }
    ctx.stroke();
  }
  void t;
}

function drawTongue(ctx, x0, y0, x1, t, lw) {
  if (x1 <= x0 + 0.5) return;
  const wob = Math.sin(t * 20) * 1.2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo((x0 + x1) / 2, y0 + wob, x1, y0 + wob * 0.6);
  ctx.moveTo(x1, y0 + wob * 0.6);
  ctx.lineTo(x1 + 3, y0 - 2.4 + wob);
  ctx.moveTo(x1, y0 + wob * 0.6);
  ctx.lineTo(x1 + 3, y0 + 2.8 + wob);
  ctx.strokeStyle = '#4a0a10';
  ctx.lineWidth = 2.8 + lw;
  ctx.stroke();
  ctx.strokeStyle = '#ff5470';
  ctx.lineWidth = 2.6;
  ctx.stroke();
}
// Chameleon: the long sticky tongue (px space).
function drawLongTongue(ctx, x0, y0, x1, y1, U, lw, t) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const sag = Math.sin(t * 25) * 0.6 * U;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo((x0 + x1) / 2 + nx * sag, (y0 + y1) / 2 + ny * sag, x1, y1);
  ctx.strokeStyle = '#4a0a10';
  ctx.lineWidth = 3.2 * U + lw;
  ctx.stroke();
  ctx.strokeStyle = '#ff6f8a';
  ctx.lineWidth = 3.2 * U;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x1, y1, 4.4 * U, 0, TAU);
  ctx.fillStyle = '#ff6f8a';
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = '#4a0a10';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x1 - 1.4 * U, y1 - 1.4 * U, 1.3 * U, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fill();
  ctx.restore();
}

// Eyes. The face reads upright on screen: in the eye's frame "up" is +x (the snout) when fu = 1, -x when fu = -1,
// so lids and brows always sit on the screen-upper side.
function drawEye(ctx, ex, ey, sd, t, blink, look, P, lw, K, fu) {
  const E = SP.head, R = E.eyeR, line = rgb(K.line);
  ctx.save();
  ctx.translate(ex, ey);
  if (fu < 0) ctx.scale(-1, 1);
  const lx = clamp(look.x || 0, -1, 1) * fu, ly = clamp(look.y || 0, -1, 1);
  if (E.eyes === 'turret') { turretEye(ctx, R, sd, t, lx, ly, P, lw, K, line); ctx.restore(); return; }
  ctx.beginPath(); // socket dome
  ctx.arc(0, 0, R + 1.2, 0, TAU);
  ctx.fillStyle = rgb(E.eyes === 'gecko' ? K.magMid : K.rock);
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = line;
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.clip();
  ctx.fillStyle = rgb(K.eye);
  ctx.fillRect(-R, -R, 2 * R, 2 * R);
  ctx.beginPath(); // shade on the lower side
  ctx.arc(2.2, -sd * 0.5, R, 0, TAU);
  ctx.rect(-R * 2, -R * 2, R * 4, R * 4);
  ctx.fillStyle = rgb(K.eyeLo, 0.7);
  ctx.fill('evenodd');
  if (P.dazed > 0.5) {
    ctx.beginPath();
    const rot = t * 7 * sd;
    for (let i = 0; i <= 32; i++) {
      const a = rot + i * 0.52, r = (0.2 + i * 0.165) * (R / 6.2);
      const X = Math.cos(a) * r, Y = Math.sin(a) * r;
      if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
    }
    ctx.strokeStyle = line;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  } else {
    const px = lx * R * 0.32 + 0.8 * fu * 0, py = ly * R * 0.32;
    ctx.fillStyle = rgb(K.pupil);
    ctx.beginPath();
    if (E.eyes === 'gecko') ctx.ellipse(px, py, R * 0.62, R * 0.2, 0, 0, TAU); // slit pupil across the eye
    else { const pr = R * (0.48 - 0.08 * P.angry); ctx.ellipse(px, py, pr * (1 + 0.15 * P.angry), pr * (1.05 - 0.3 * P.angry), 0, 0, TAU); }
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px + 1.3, py - 1.2 * sd, R * 0.2, 0, TAU);
    ctx.arc(px - 1.1, py + 1.1 * sd, R * 0.09, 0, TAU);
    ctx.fill();
  }
  if (E.eyes === 'gecko') {
    // no lids: a blink is a quick squeeze from both sides
    if (blink > 0.05) {
      ctx.fillStyle = rgb(K.magMid);
      ctx.fillRect(R - 2 * R * blink * 0.5, -R, 2 * R, 2 * R);
      ctx.fillRect(-R - 2 * R + 2 * R * blink * 0.5, -R, 2 * R, 2 * R);
    }
    ctx.restore();
  } else {
    // upper lid from the screen-upper side (+x in this frame), slanted so the inner corners sit lower: a V
    const base = P.dazed > 0.5 ? 0.36 : (E.brows === 'rock' ? 0.34 : 0.2) + 0.14 * P.angry;
    const lid = Math.max(blink, base);
    const slant = (1.9 + 1.5 * P.angry) * (1 - blink) * (R / 6.2);
    const Fr = R + 3, Bk = -R - 3, yI = -sd * (R + 3), yO = sd * (R + 3);
    const xE = R - 2 * R * lid;
    ctx.beginPath();
    ctx.moveTo(Fr, yI);
    ctx.lineTo(xE - slant, yI);
    ctx.lineTo(xE + slant, yO);
    ctx.lineTo(Fr, yO);
    ctx.closePath();
    const low = 0.2 * P.angry;
    const xL = -R + 2 * R * low;
    if (low > 0.01) {
      ctx.moveTo(Bk, yI);
      ctx.lineTo(xL + 0.6, yI);
      ctx.lineTo(xL - 0.6, yO);
      ctx.lineTo(Bk, yO);
      ctx.closePath();
    }
    ctx.fillStyle = rgb(K.rock);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(xE - slant, yI);
    ctx.lineTo(xE + slant, yO);
    if (low > 0.01) { ctx.moveTo(xL + 0.6, yI); ctx.lineTo(xL - 0.6, yO); }
    ctx.strokeStyle = line;
    ctx.lineWidth = lw * 1.1;
    ctx.stroke();
    ctx.restore();
    // brow ridge just above the hood (it stays put through a blink)
    const xb = R - 2 * R * base + 1.4 * (R / 6.2), sb = (1.9 + 2.2 * P.angry) * (R / 6.2);
    const ax = xb - sb * 1.15, ay = -sd * (R + 0.8), cx = xb + 1.2, cy = sd * 0.4, bx0 = xb + sb * 0.9, by0 = sd * (R + 0.4);
    const ridge = (w0, w1) => {
      const Lp = [], Rp = [];
      for (let i = 0; i <= 8; i++) {
        const u = i / 8, v = 1 - u;
        const X = v * v * ax + 2 * u * v * cx + u * u * bx0, Y = v * v * ay + 2 * u * v * cy + u * u * by0;
        const dx = 2 * v * (cx - ax) + 2 * u * (bx0 - cx), dy = 2 * v * (cy - ay) + 2 * u * (by0 - cy), l = Math.hypot(dx, dy) || 1;
        const w = lerp(w0, w1, u);
        Lp.push([X - (dy / l) * w, Y + (dx / l) * w]);
        Rp.push([X + (dy / l) * w, Y - (dx / l) * w]);
      }
      ctx.beginPath();
      Lp.forEach(([X, Y], i) => (i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y)));
      for (let i = Rp.length - 1; i >= 0; i--) ctx.lineTo(Rp[i][0], Rp[i][1]);
      ctx.closePath();
    };
    if (E.brows === 'glow') {
      ridge(2.6, 1.3); // soft glow
      ctx.fillStyle = `rgba(255,170,50,${0.32 * (1 - clamp(P.steam, 0, 1))})`;
      ctx.fill();
      ridge(1.25, 0.55);
      ctx.lineWidth = lw * 0.7;
      ctx.strokeStyle = line;
      ctx.stroke();
      ctx.fillStyle = rgb(mixA(K.browLo, K.brow, 0.7));
      ctx.fill();
    } else if (E.brows === 'rock') {
      ridge(2.2, 1.2);
      ctx.lineWidth = lw * 0.8;
      ctx.strokeStyle = line;
      ctx.stroke();
      ctx.fillStyle = rgb(K.rockHi);
      ctx.fill();
    }
    ctx.restore();
    ctx.save();
    ctx.translate(ex, ey);
  }
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.strokeStyle = line;
  ctx.lineWidth = lw * 0.9;
  ctx.stroke();
  ctx.restore();
}
// Chameleon turret eye: a skin-covered cone with a small peephole that roves on its own.
function turretEye(ctx, R, sd, t, lx, ly, P, lw, K, line) {
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fillStyle = rgb(K.magMid);
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = line;
  ctx.stroke();
  ctx.beginPath(); // concentric skin rings make the cone
  ctx.arc(0, 0, R * 0.68, 0, TAU);
  ctx.moveTo(R * 0.36, 0);
  ctx.arc(0, 0, R * 0.36, 0, TAU);
  ctx.strokeStyle = rgb(K.rock, 0.8);
  ctx.lineWidth = lw * 0.7;
  ctx.stroke();
  // each eye roves independently unless told where to look
  let a = Math.atan2(ly, lx);
  if (!lx && !ly) a = Math.sin(t * 0.9 + sd * 2.1) * 1.6 + (sd > 0 ? 0.6 : -0.6) + Math.sin(t * 2.7 + sd) * 0.4;
  if (P.dazed > 0.5) a = t * 9 * sd;
  const d = R * 0.42, px = Math.cos(a) * d, py = Math.sin(a) * d;
  ctx.beginPath();
  ctx.arc(px, py, R * 0.36, 0, TAU);
  ctx.fillStyle = rgb(K.eye);
  ctx.fill();
  ctx.lineWidth = lw * 0.8;
  ctx.strokeStyle = line;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(px + Math.cos(a) * R * 0.08, py + Math.sin(a) * R * 0.08, R * 0.17, 0, TAU);
  ctx.fillStyle = rgb(K.pupil);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(px - R * 0.08, py - R * 0.1, R * 0.07, 0, TAU);
  ctx.fillStyle = '#fff';
  ctx.fill();
}

/* ---------------------------------------------------------------- effects */
// Fire jet: three outlined layers of ten blobs (cheap), a splash where it lands.
function drawFire(ctx, x, y, a, k, U, t, len) {
  const reach = sstep(k * 1.6);
  const L = len * U * (0.3 + 0.7 * reach);
  const ca = Math.cos(a), sa = Math.sin(a);
  const layers = [['#5a1206', 1.12], ['#ff7a1e', 0.9], ['#ffe27a', 0.45]];
  for (const [col, wk] of layers) {
    ctx.fillStyle = col;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const f = i / 9;
      const fl = Math.sin(t * 37 + i * 2.1) * 0.5 + Math.sin(t * 23 + i * 1.3) * 0.5;
      const d = L * f;
      const r = (4 + 16 * Math.pow(f, 0.75)) * U * wk * k * (1 + 0.16 * fl) * (f > 0.88 ? 1 - (f - 0.88) * 2.5 : 1);
      const off = fl * 2 * U * f;
      const X = x + ca * d - sa * off, Y = y + sa * d + ca * off;
      ctx.moveTo(X + r, Y);
      ctx.arc(X, Y, Math.max(0.5, r), 0, TAU);
    }
    ctx.fill();
  }
  const tx = x + ca * L, ty = y + sa * L;
  ctx.fillStyle = '#ffd860';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const f = mod(t * 3.1 + i * 0.29, 1), sd = i % 2 ? 1 : -1;
    const d = f * 16 * U * reach, X = tx - sa * sd * d - ca * f * 6 * U, Y = ty + ca * sd * d - sa * f * 6 * U;
    const r = 1.7 * U * (1 - f) * k;
    ctx.moveTo(X + r, Y);
    ctx.arc(X, Y, Math.max(0.3, r), 0, TAU);
  }
  ctx.fill();
  return { x: tx, y: ty };
}

function drawSteam(ctx, U, t, k) {
  ctx.save();
  ctx.fillStyle = '#f6f8fa';
  for (let i = 0; i < 9; i++) {
    const f = mod(t * 0.55 + i * 0.29, 1);
    const q = spAt(Math.min(UMAX, 8 + i * 17));
    const X = q.x + Math.sin(i * 4.1 + t * 1.3) * 4 * U, Y = q.y - f * 26 * U;
    const r = (3 + f * 6) * U;
    ctx.globalAlpha = k * 0.6 * Math.sin(f * Math.PI);
    ctx.beginPath();
    ctx.arc(X, Y, r, 0, TAU);
    ctx.arc(X + r * 0.7, Y + r * 0.2, r * 0.7, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}
// Gecko: little puffs of frosty breath.
function drawFrostBreath(ctx, x, y, a, U, t, k) {
  ctx.save();
  ctx.fillStyle = '#eaf8ff';
  for (let i = 0; i < 3; i++) {
    const f = mod(t * 0.8 + i / 3, 1);
    if (f > 0.7) continue;
    const d = (3 + f * 14) * U, X = x + Math.cos(a) * d + Math.sin(i * 3 + t) * 2 * U, Y = y + Math.sin(a) * d - f * 4 * U;
    ctx.globalAlpha = 0.55 * k * Math.sin((f / 0.7) * Math.PI);
    ctx.beginPath();
    ctx.arc(X, Y, (1.6 + f * 4) * U, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}
// Gecko: the meltwater puddle, a soft blob with a bright rim and a few ice chips left floating in it.
function drawPuddle(ctx, c, U, k, t, K) {
  ctx.save();
  ctx.translate(c.x, c.y);
  const r = (12 + 22 * k) * U, n = 12, P = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, j = 1 + 0.16 * Math.sin(a * 3 + 1) + 0.08 * Math.sin(a * 5 + 2) + 0.03 * Math.sin(a * 2 + t * 2);
    P.push([Math.cos(a) * r * j, Math.sin(a) * r * 0.78 * j]);
  }
  const blob = () => {
    ctx.beginPath();
    const m = (i) => [(P[i % n][0] + P[(i + 1) % n][0]) / 2, (P[i % n][1] + P[(i + 1) % n][1]) / 2];
    let q = m(n - 1);
    ctx.moveTo(q[0], q[1]);
    for (let i = 0; i < n; i++) { q = m(i); ctx.quadraticCurveTo(P[i][0], P[i][1], q[0], q[1]); }
    ctx.closePath();
  };
  blob();
  ctx.fillStyle = `rgba(52,120,205,${0.85 * k})`;
  ctx.fill();
  ctx.lineWidth = Math.max(1, 1.6 * U);
  ctx.strokeStyle = rgb(K.line, 0.7 * k);
  ctx.stroke();
  ctx.save();
  ctx.clip();
  ctx.beginPath(); // lighter shallows toward the top-left edge
  ctx.rect(-r * 2, -r * 2, r * 4, r * 4);
  ctx.ellipse(r * 0.08, r * 0.1, r * 0.98, r * 0.72, 0, 0, TAU);
  ctx.fillStyle = `rgba(160,220,255,${0.75 * k})`;
  ctx.fill('evenodd');
  ctx.restore();
  ctx.fillStyle = `rgba(245,252,255,${0.95 * k})`; // floating ice chips
  ctx.strokeStyle = rgb(K.line, 0.5 * k);
  ctx.lineWidth = Math.max(0.8, 0.8 * U);
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = i * 1.9 + 0.5, d = r * (0.35 + 0.12 * i), X = Math.cos(a) * d, Y = Math.sin(a) * d * 0.7 + Math.sin(t * 2 + i) * 0.6 * U, q = (2.2 - i * 0.3) * U;
    ctx.moveTo(X - q, Y); ctx.lineTo(X, Y - q * 0.8); ctx.lineTo(X + q, Y + q * 0.1); ctx.lineTo(X + q * 0.2, Y + q * 0.8); ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawStars(ctx, hx, hy, U, t) {
  ctx.save();
  ctx.lineJoin = 'round';
  for (let i = 0; i < 3; i++) {
    const a = t * 3.2 + (i * TAU) / 3;
    const X = hx + Math.cos(a) * 22 * U, Y = hy + Math.sin(a) * 12 * U - 6 * U;
    const r = (5.4 + 1.2 * Math.sin(a)) * U;
    ctx.beginPath();
    for (let j = 0; j < 10; j++) {
      const rr = j % 2 ? r * 0.45 : r, b = -Math.PI / 2 + (j * Math.PI) / 5 + t * 2;
      const px = X + Math.cos(b) * rr, py = Y + Math.sin(b) * rr;
      if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = '#ffe14a';
    ctx.fill();
    ctx.lineWidth = Math.max(1, 0.9 * U);
    ctx.strokeStyle = '#5a3008';
    ctx.stroke();
  }
  ctx.restore();
}

// A deep molten pit in the channel floor. back: crusted rim, steep glowing walls and the lava pool far below;
// front: a molten film over whatever has gone in, the near lip, and a splash while something dives.
function drawPit(ctx, H, U, t, back, splash = 0) {
  ctx.save();
  ctx.translate(H.x, H.y);
  const r = H.r;
  const blob = (rr, k, ph) => {
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * TAU, j = 1 + k * (0.07 * Math.sin(a * 5 + ph) + 0.05 * Math.sin(a * 3 + ph * 2));
      const X = Math.cos(a) * rr * j, Y = Math.sin(a) * rr * 0.9 * j;
      if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
    }
    ctx.closePath();
  };
  if (back) {
    // heat haze on the floor around it
    const hz = ctx.createRadialGradient(0, 0, r * 0.8, 0, 0, r * 1.9);
    hz.addColorStop(0, 'rgba(255,110,30,0.4)');
    hz.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = hz;
    ctx.fillRect(-r * 2, -r * 2, r * 4, r * 4);
    // crust rim: dark rock, chunky, its top-left edge catching light
    blob(r * 1.36, 1, 0.7);
    ctx.fillStyle = '#2a1209';
    ctx.fill();
    blob(r * 1.26, 1, 0.7);
    ctx.fillStyle = '#5b3020';
    ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < 9; i++) { const a = i * 0.7 + 0.3, X = Math.cos(a) * r * 1.22, Y = Math.sin(a) * r * 1.1, rr = r * (0.1 + 0.05 * Math.sin(i * 3)); ctx.moveTo(X + rr, Y); ctx.arc(X, Y, rr, 0, TAU); }
    ctx.fillStyle = '#8a5236';
    ctx.fill();
    // steep inner walls: dark at the far (top-left) lip, glowing hotter toward the bottom
    blob(r * 1.08, 0.6, 1.9);
    const wg = ctx.createRadialGradient(r * 0.22, r * 0.26, r * 0.2, -r * 0.15, -r * 0.18, r * 1.25);
    wg.addColorStop(0, '#ff7a1e');
    wg.addColorStop(0.45, '#a52a0c');
    wg.addColorStop(0.85, '#3a0e06');
    wg.addColorStop(1, '#1a0603');
    ctx.fillStyle = wg;
    ctx.fill();
    // glowing cracks in the walls
    ctx.beginPath();
    for (let i = 0; i < 5; i++) { const a = i * 1.25 + 0.4; ctx.moveTo(Math.cos(a) * r * 1.02, Math.sin(a) * r * 0.92); ctx.lineTo(Math.cos(a + 0.12) * r * 0.75, Math.sin(a + 0.12) * r * 0.66); }
    ctx.strokeStyle = 'rgba(255,150,40,0.7)';
    ctx.lineWidth = Math.max(0.8, 1 * U);
    ctx.stroke();
    // the pool far down, offset away from the light so the walls read as depth
    ctx.save();
    ctx.translate(r * 0.2, r * 0.24);
    blob(r * 0.62, 0.8, t * 0.6);
    const pg = ctx.createRadialGradient(-r * 0.1, -r * 0.1, r * 0.05, 0, 0, r * 0.62);
    pg.addColorStop(0, '#fff6c0');
    pg.addColorStop(0.35, '#ffc23a');
    pg.addColorStop(0.8, '#ff6212');
    pg.addColorStop(1, '#c2300a');
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.fillStyle = 'rgba(255,246,200,0.9)';
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const f = mod(t * 0.9 + i * 0.33, 1);
      const X = Math.cos(i * 2.4) * r * 0.3, Y = Math.sin(i * 2.4) * r * 0.25, rr = r * 0.09 * Math.sin(f * Math.PI);
      ctx.moveTo(X + rr, Y);
      ctx.arc(X, Y, Math.max(0.2, rr), 0, TAU);
    }
    ctx.fill();
    ctx.restore();
  } else {
    // what has gone over the edge darkens and reddens as it drops toward the lava
    ctx.save();
    blob(r * 1.08, 0.6, 1.9);
    ctx.clip();
    ctx.rotate(H.a);
    const g = ctx.createLinearGradient(-r, 0, r * 0.15, 0);
    g.addColorStop(0, 'rgba(60,10,4,0)');
    g.addColorStop(0.55, 'rgba(90,16,6,0.5)');
    g.addColorStop(1, 'rgba(255,110,30,0.75)');
    ctx.fillStyle = g;
    ctx.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
    ctx.rotate(-H.a);
    // the far (top-left) wall stays in view above whatever went in: a dark crescent that reads as depth
    ctx.beginPath();
    ctx.rect(-r * 2, -r * 2, r * 4, r * 4);
    ctx.ellipse(r * 0.2, r * 0.26, r * 0.98, r * 0.86, 0, 0, TAU);
    const wg = ctx.createLinearGradient(-r, -r, 0, 0);
    wg.addColorStop(0, '#1a0603');
    wg.addColorStop(1, '#7a1e08');
    ctx.fillStyle = wg;
    ctx.fill('evenodd');
    ctx.restore();
    // near (bottom-right) lip overlaps the body
    ctx.save();
    blob(r * 1.36, 1, 0.7);
    ctx.clip();
    ctx.beginPath();
    ctx.rect(-r * 2, -r * 2, r * 4, r * 4);
    ctx.ellipse(-r * 0.1, -r * 0.12, r * 1.12, r * 0.98, 0, 0, TAU);
    ctx.fillStyle = '#5b3020';
    ctx.fill('evenodd');
    ctx.restore();
    blob(r * 1.36, 1, 0.7);
    ctx.lineWidth = Math.max(1.2, 2.2 * U);
    ctx.strokeStyle = '#2a1209';
    ctx.stroke();
    if (splash > 0) {
      ctx.fillStyle = '#ffb030';
      ctx.strokeStyle = '#5a1206';
      ctx.lineWidth = Math.max(0.8, 1 * U);
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const f = mod(t * 2.2 + i * 0.31, 1), a = i * 0.9;
        const d = r * (0.3 + f * 0.9), X = Math.cos(a) * d, Y = Math.sin(a) * d * 0.9 - Math.sin(f * Math.PI) * r * 0.45;
        const rr = r * 0.13 * (1 - f) * splash;
        ctx.moveTo(X + rr, Y);
        ctx.arc(X, Y, Math.max(0.2, rr), 0, TAU);
      }
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}
