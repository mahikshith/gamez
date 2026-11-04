// The hen as mascot: choreographed level-complete routines for the win card and a kind pep talk for the fail card.
// Every routine is a pure function of time u (s since the card opened), so tapping to skip is just u = len, the strips
// can film any frame, and nothing is stored per frame. A routine gives:
//   len    when it reaches its final hold pose (the hold keeps breathing, blinking and now and then a small beat)
//   stars  when each star lands (main.js pops the stars at these beats; the hen reacts on each one)
//   cues   [time, sfx, opts]: synth hits played by main.js as u crosses them (src/audio.js)
//   pose   (u, pw) -> a full hen pose (render/hen.js KEYS); pw 0..1 is how big the result was
//   fx     confetti / feather bursts [{at, n, from}] and props (eggs, chicks, a crown) drawn around her
// Chosen by pickRoutine: 1 star a modest cheer, 2 stars a dance, 3 stars the backflip (on a star streak the chicks join
// in), the first win in a new world the egg juggle, a boss the crown and strut; never the same routine twice in a row.
import { drawHenPose, henPose, henSecondary, henIdleEvents, drawHeart } from './hen.js';
import { drawChick } from './characters.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
const fract = (x) => x - Math.floor(x);
const hash = (n) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
const env = (u, a, b, c, d) => ss(a, b, u) * (1 - ss(c, d, u)); // rise over a..b, fall over c..d
const LINE = '#6b4a2a';
// confetti in the game's own colours (UI green / blue / gold, the hen's reds and orange, the notes' pink): no white
const PAL = ['#f0402f', '#ffd23f', '#46b83d', '#5a8dee', '#ff7a9a', '#e57d12', '#ffb020', '#3fb6c8'];

/* ------------------------------------------------------------------ move helpers (all edit a pose P in place) */
// a jump: an anticipation crouch before t0, a parabola of height h (units) lasting `up` s, a squash-and-recover landing.
// k scales the squash and stretch. Returns the air phase 0..1 while airborne, else -1.
function jump(P, u, t0, up, h, k = 1, ant = 0.16) {
  const c = ss(t0 - ant, t0 - 0.03, u) * (1 - ss(t0 - 0.03, t0 + 0.03, u));
  P.sq -= 0.17 * k * c; P.lift -= 6 * k * c; P.hy += 3 * c; P.tail += 0.25 * c; P.wa -= 0.25 * c; P.wf -= 0.2 * c;
  let a = -1;
  if (u >= t0 && u < t0 + up) {
    a = (u - t0) / up;
    P.lift += h * 4 * a * (1 - a);
    P.sq += k * (0.17 * (1 - a) * (1 - a) - 0.03 * Math.sin(a * Math.PI) + 0.08 * a * a * a);
    P.fL += 5 * Math.sin(a * Math.PI); P.fR += 4 * Math.sin(a * Math.PI); // toes tuck in the air
  }
  const d = u - (t0 + up);
  if (d >= 0 && d < 0.6) {
    const e = Math.exp(-d / 0.085), w = Math.cos(d * 17);
    P.sq -= 0.21 * k * e * w; P.lift -= 6 * k * e * Math.max(0, w); P.hy += 3 * e * Math.max(0, w);
  }
  return a;
}
// a small on-the-beat bounce (no crouch): up `amp` units over `dur` s, with a squash on touch-down
function bounce(P, u, t, amp, dur = 0.22) {
  if (u >= t && u < t + dur) { const a = (u - t) / dur; P.lift += amp * Math.sin(a * Math.PI); P.sq += 0.05 * Math.sin(a * Math.PI) * (a < 0.5 ? 1 : 0.2); }
  const d = u - t - dur;
  if (d >= 0 && d < 0.4) P.sq -= 0.09 * Math.exp(-d / 0.06) * Math.cos(d * 20) * clamp(amp / 5, 0.4, 1.2);
}
const wings = (P, wa, wf, sp, E) => { P.wa = lerp(P.wa, wa, E); P.wf = lerp(P.wf, wf, E); P.sp = lerp(P.sp, sp, E); };
// both wings up (a Y): the near wing straight up, the far one up and back, shown past her back by the 3/4 turn (fw)
const wingsY = (P, E) => { wings(P, 1.75, 1.3, 1, E); P.fw = Math.max(P.fw, E); };
// the far wing alone up and back (the near one down)
const wingFar = (P, E) => { wings(P, 0.4, 1.3, 0.9, E); P.fw = Math.max(P.fw, E); };
// her happy face; `open` is the beak (0 shut .. 5 wide)
const happy = (P, E = 1, open = 2) => { P.eHappy = lerp(P.eHappy, 1, E); P.blush = lerp(P.blush, 0.6, E); P.beak = lerp(P.beak, open, E); };
// a cluck: the beak snaps open and shut around t
const cluck = (P, u, t, amt = 4.5) => { P.beak = Math.max(P.beak, amt * env(u, t - 0.03, t, t + 0.06, t + 0.16)); };
function breathe(P, u) {
  P.sq += Math.sin(u * 3.1) * 0.016; P.hy += Math.sin(u * 3.1 + 0.6) * 0.8;
  P.tail += Math.sin(u * 3.7) * 0.06; P.comb += Math.sin(u * 3.1 - 0.5) * 0.05; P.hr += Math.sin(u * 1.3) * 0.03;
}

/* ------------------------------------------------------------------ the routines */
// Shared beats: she pops in (0..0.3), crouches, and the first big move lands about when the first star does.
const R = {};

// 1 star: a modest cheer. A hop with a flutter, one wing pumped on the star, then a wave.
R.cheer = {
  len: 1.9, stars: [0.88, 1.12, 1.36], face: -1, hold: 'wave',
  cues: [[0.44, 'hen_hop', { intensity: 0.2 }], [0.5, 'flap', { intensity: 0.2 }], [0.8, 'hen_land', { intensity: 0.2 }], [0.92, 'cluck', { intensity: 0 }], [1.6, 'tada', { intensity: 0 }]],
  fx: [{ at: 0.8, n: 14, from: 'sides' }],
  pose(u) {
    const P = henPose({ blush: 0.5 });
    happy(P, ss(0, 0.3, u), 1.5);
    const a = jump(P, u, 0.44, 0.36, 12);
    if (a >= 0) wings(P, 1.5 + Math.sin(u * 36) * 0.45, 1.4 + Math.sin(u * 36 + 0.5) * 0.45, 0.9, Math.sin(a * Math.PI));
    const pump = env(u, 0.84, 0.92, 1.2, 1.36);
    wings(P, 1.75, 0.5, 0.85, pump); P.hr -= 0.15 * pump; P.hx += 2 * pump; cluck(P, u, 0.92);
    bounce(P, u, 1.14, 3);
    const wave = ss(1.4, 1.6, u);
    wings(P, 1.55 + Math.sin(u * 11) * 0.3 * wave, 0.3, 0.75, wave);
    P.hr -= 0.1 * wave; P.wink = ss(1.45, 1.6, u);
    happy(P, wave, 2.5);
    return P;
  },
};

// 2 stars: wing-pump cheer. A big jump into a Y, three pumps that bring the stars, a final hop and a bawk.
R.pump = {
  len: 2.15, stars: [0.98, 1.26, 1.54], face: 1, hold: 'pump',
  cues: [[0.42, 'hen_hop', { intensity: 0.5 }], [0.84, 'hen_land', { intensity: 0.5 }], [1.0, 'flap', { intensity: 0.3 }], [1.28, 'flap', { intensity: 0.3 }], [1.56, 'flap', { intensity: 0.3 }],
    [1.78, 'hen_hop', { intensity: 0.2 }], [1.95, 'cluck', { intensity: 1 }], [2.06, 'tada', { intensity: 0.4 }]],
  fx: [{ at: 0.84, n: 22, from: 'sides' }, { at: 2.05, n: 10, from: 'feathers' }],
  pose(u, pw) {
    const P = henPose({ blush: 0.5 });
    happy(P, ss(0, 0.3, u), 1.5);
    const a = jump(P, u, 0.42, 0.42, 14 + 6 * pw);
    const Y = ss(0.42, 0.55, u);
    wingsY(P, Y); P.hr -= 0.15 * Y; happy(P, Y, 3.5);
    if (a >= 0) { P.fL += 3; P.fR += 3; }
    for (const b of [0.98, 1.26, 1.54]) { // a pump: wings snap down then back up into the Y, the body bounces
      const dn = env(u, b - 0.1, b - 0.04, b + 0.01, b + 0.12);
      P.wa -= 1.05 * dn; P.wf -= 0.75 * dn; P.sp -= 0.3 * dn;
      bounce(P, u, b - 0.02, 3.5); cluck(P, u, b + 0.02, 5);
    }
    jump(P, u, 1.78, 0.28, 8, 0.8, 0.12);
    const fin = ss(1.8, 2.0, u);
    P.lean -= 0.09 * fin; P.hr -= 0.15 * fin; cluck(P, u, 1.97, 5.5); P.tsp += 0.6 * fin;
    { const L = env(u, 1.98, 2.05, 2.12, 2.3); P.wa -= 0.8 * L; P.hx += 3 * L; P.hy -= 2 * L; } // the wings flare out on the landing so the near one clears her face as she squashes
    return P;
  },
};

// 2 stars: the victory dance. Side steps with kicks and alternating wings on the beat, a twirl, then ta-da with a wink.
R.dance = {
  len: 2.35, stars: [1.0, 1.3, 1.6], face: -1, hold: 'sway',
  cues: [[0.42, 'hen_hop', { intensity: 0.2 }], [0.7, 'hen_land', { intensity: 0.2 }], [1.0, 'cluck', { intensity: 0 }], [1.3, 'cluck', { intensity: 0 }], [1.6, 'cluck', { intensity: 0 }],
    [1.86, 'hen_hop', { intensity: 0.4 }], [2.18, 'hen_land', { intensity: 0.3 }], [2.22, 'tada', { intensity: 0.4 }]],
  fx: [{ at: 0.7, n: 16, from: 'sides' }, { at: 2.2, n: 18, from: 'top' }],
  pose(u, pw) {
    const P = henPose({ blush: 0.5 });
    happy(P, ss(0, 0.3, u), 2);
    jump(P, u, 0.42, 0.28, 8);
    const D = env(u, 0.66, 0.8, 1.78, 1.9), ph = (u - 0.7) / 0.3; // a beat is 0.3 s
    const s = Math.sin(ph * Math.PI);
    P.dx += 11 * s * D; P.sway += 0.12 * s * D; P.hx += 3 * s * D; P.hr += -0.12 * s * D;
    P.fL += Math.max(0, s) * 7 * D; P.fR += Math.max(0, -s) * 7 * D; P.sL += Math.max(0, s) * 6 * D; P.sR += Math.max(0, -s) * 6 * D;
    wings(P, 1.25 + 0.5 * s, 1.85 - 0.6 * s, 0.9, D);
    P.lift += Math.abs(Math.cos(ph * Math.PI)) * 3 * D; P.tail += Math.sin(u * 14) * 0.25 * D; P.comb -= 0.2 * s * D;
    for (const b of [1.0, 1.3, 1.6]) cluck(P, u, b, 3.5);
    const ta = jump(P, u, 1.88, 0.3, 10 + 4 * pw, 0.9, 0.1);
    P.twirl += TAU * clamp((u - 1.92) / 0.22, 0, 1);
    if (ta >= 0) wings(P, 1.8, 1.7, 1, Math.sin(ta * Math.PI));
    const fin = ss(2.14, 2.3, u);
    wingsY(P, fin); P.fR += 6 * fin; P.sR += 7 * fin; P.wink = fin; P.hr -= 0.1 * fin; happy(P, fin, 3);
    return P;
  },
};

// The first win in a new world: she juggles three eggs (each thrown twice from the near wing), then they come down one
// by one, a star with each: two land at her feet, the last one on her head.
const JUG = { t0: 0.5, T: 0.26, air: 0.56, fin: 0.42 };
const jugThrows = [0, 1, 2, 3, 4, 5].map((j) => JUG.t0 + j * JUG.T); // egg j % 3; throws 3..5 are the final ones
const jugLand = [0, 1, 2].map((i) => jugThrows[i + 3] + JUG.fin);
R.juggle = {
  len: 2.5, stars: jugLand, face: 1, hold: 'balance',
  cues: [...jugThrows.map((t) => [t, 'flap', { intensity: 0 }]), [jugLand[0], 'hen_land', { intensity: 0 }], [jugLand[1], 'hen_land', { intensity: 0 }], [jugLand[2], 'cluck', { intensity: 1 }],
    [jugLand[2] + 0.02, 'confetti', { intensity: 0.6 }], [2.4, 'tada', { intensity: 0.5 }]],
  fx: [{ at: jugLand[2], n: 26, from: 'sides' }],
  pose(u) {
    const P = henPose({ blush: 0.5 });
    happy(P, ss(0, 0.3, u), 1.5);
    const J = env(u, 0.35, 0.5, jugLand[2] - 0.1, jugLand[2] + 0.05);
    let toss = 0; // each throw: the near wing flicks up
    for (const t of jugThrows) toss = Math.max(toss, env(u, t - 0.06, t - 0.01, t + 0.03, t + 0.12));
    wings(P, 0.95 + 1.1 * toss, 0.7, 0.6, J);
    P.eHappy = lerp(P.eHappy, 0, J); P.pdy -= 1.6 * J; P.pdx += 0.8 * J; P.hr -= 0.3 * J + 0.08 * toss; P.hx -= 2 * J; // eyes on the eggs
    bounce(P, u, jugLand[0] - 0.05, 2.5); bounce(P, u, jugLand[1] - 0.05, 2.5);
    const hit = u - jugLand[2]; // the catch on her head: she dips under it and steadies
    if (hit >= 0) { P.sq -= 0.12 * Math.exp(-hit / 0.08) * Math.cos(hit * 16); P.hy += 3 * Math.exp(-hit / 0.1); }
    const fin = ss(jugLand[2], jugLand[2] + 0.22, u);
    wingsY(P, fin); happy(P, fin, 3); P.hr = lerp(P.hr, -0.05, fin); P.wink = fin;
    return P;
  },
};

// 3 stars, the biggest: a deep crouch, a huge backflip with spread wings, a landing that fires the confetti, a star on
// each of three bounces, a final hop into a ta-da.
R.backflip = {
  len: 2.45, stars: [1.38, 1.62, 1.86], face: -1, hold: 'pump',
  cues: [[0.55, 'hen_hop', { intensity: 1 }], [0.62, 'flap', { intensity: 1 }], [1.24, 'hen_land', { intensity: 1 }], [1.26, 'confetti', { intensity: 1 }],
    [1.4, 'cluck', { intensity: 0 }], [1.64, 'cluck', { intensity: 0 }], [1.88, 'cluck', { intensity: 1 }], [2.08, 'hen_hop', { intensity: 0.2 }], [2.32, 'tada', { intensity: 1 }]],
  fx: [{ at: 1.24, n: 44, from: 'sides' }, { at: 1.24, n: 12, from: 'feathers' }, { at: 2.3, n: 16, from: 'top' }],
  pose(u, pw) {
    const P = henPose({ blush: 0.5 });
    happy(P, ss(0, 0.25, u), 1.5);
    // a long, deep anticipation: she sinks, wings back, looks up
    const c = env(u, 0.22, 0.48, 0.52, 0.58);
    P.hr -= 0.25 * c; P.pdy -= 1.5 * c; P.eHappy = lerp(P.eHappy, 0, c); P.tsp += 0.6 * c;
    const a = jump(P, u, 0.56, 0.68, 30 + 10 * pw, 1.3, 0.3);
    if (a >= 0) {
      P.spin = -TAU * ss(0.06, 0.84, a);
      const E = Math.sin(a * Math.PI);
      wings(P, 1.9, 1.8, 1, E); P.fL += 6 * E; P.fR += 6 * E; P.eSqueeze = ss(0.1, 0.25, a) * (1 - ss(0.7, 0.85, a)); P.beak = 4 * E;
    }
    // the stars: bounce, alternating wings, a cluck each; the third throws both wings up
    const st = [1.38, 1.62, 1.86];
    st.forEach((b, i) => {
      bounce(P, u, b - 0.06, 4 + i);
      const w = env(u, b - 0.06, b + 0.02, b + 0.14, b + 0.24);
      if (i === 0) wings(P, 1.75, 0.5, 0.8, w);
      else if (i === 1) wingFar(P, w);
      cluck(P, u, b + 0.02, 4.5);
    });
    const Y = ss(1.84, 1.96, u);
    wingsY(P, Y); happy(P, ss(1.2, 1.35, u), 3);
    jump(P, u, 2.08, 0.24, 7, 0.8, 0.08);
    const fin = ss(2.26, 2.4, u);
    P.lean -= 0.08 * fin; P.hr -= 0.15 * fin; P.fR += 5 * fin; P.sR += 6 * fin; P.beak = Math.max(P.beak, 4 * fin); P.tsp += 0.7 * fin;
    return P;
  },
};

// 3 stars on a star streak: her chicks run in and hop with her on every star, then a group hug.
const CHICKS = [{ side: -1, x: -40, d: 0 }, { side: 1, x: 40, d: 0.06 }, { side: 1, x: 64, d: 0.12 }];
R.chicks = {
  len: 2.5, stars: [1.12, 1.46, 1.8], face: -1, hold: 'hug',
  cues: [[0.3, 'cluck', { intensity: 0 }], [0.86, 'hen_hop', { intensity: 0.3 }], [1.2, 'hen_hop', { intensity: 0.3 }], [1.54, 'hen_hop', { intensity: 0.5 }],
    [1.12, 'hen_land', { intensity: 0.2 }], [1.46, 'hen_land', { intensity: 0.2 }], [1.8, 'hen_land', { intensity: 0.4 }], [1.82, 'confetti', { intensity: 0.7 }], [2.3, 'tada', { intensity: 0.8 }]],
  fx: [{ at: 1.8, n: 36, from: 'sides' }],
  pose(u, pw) {
    const P = henPose({ blush: 0.5 });
    happy(P, ss(0, 0.3, u), 1.5);
    // she spots them coming: looks one way, then the other, wings open to welcome them
    const look = env(u, 0.15, 0.25, 0.75, 0.85);
    P.eHappy = lerp(P.eHappy, 0, look); P.pdx += 1.6 * Math.sign(Math.sin(u * 7)) * look; cluck(P, u, 0.3);
    wings(P, 1.25, 1.15, 0.7, ss(0.4, 0.7, u));
    for (const b of [0.86, 1.2, 1.54]) {
      const a = jump(P, u, b, 0.26, 10 + 3 * pw, 0.9, 0.1);
      if (a >= 0) wingsY(P, Math.sin(a * Math.PI));
    }
    const hug = ss(1.95, 2.25, u);
    wings(P, 0.95, 0.9, 0.8, hug); P.hy += 3 * hug; P.hr += 0.12 * hug; happy(P, ss(0.8, 0.9, u), 2.5);
    return P;
  },
  // the chicks: they run in on little hopping steps, jump with her on every star, then crowd in for the hug
  props(ctx, u, pw, front) {
    if (!front) return;
    CHICKS.forEach((c, i) => {
      const t = u - c.d, run = ss(0.15, 0.75, t), hug = ss(1.95, 2.25, t);
      const xHome = c.x, xFar = c.side * 150, x = lerp(lerp(xFar, xHome, run), c.side * (26 + i * 12), hug);
      let y = 0, flap = 0;
      if (run > 0 && run < 1) y -= Math.abs(Math.sin(t * 22)) * 5; // little hopping steps
      for (const b of [0.86, 1.2, 1.54]) { if (t > b && t < b + 0.26) { const a = (t - b) / 0.26; y -= (13 + 3 * pw) * 4 * a * (1 - a); flap = Math.sin(a * Math.PI); } }
      if (t > 2.3) y -= Math.max(0, Math.sin((t - 2.3) * 6 + i)) * 2.2; // they keep bobbing in the hug
      ctx.save();
      ctx.translate(x, 0);
      ctx.scale(c.side > 0 ? -1 : 1, 1); // face the hen
      drawChick(ctx, 0, 48 - 0.68 * 24 + y, 24, u * 1.3 + i, flap, 0);
      ctx.restore();
    });
  },
  heart: [2.2],
};

// A boss beaten: a crown drops onto her head, she struts across the stage chest out, then a proud pose.
R.strut = {
  len: 2.6, stars: [1.15, 1.45, 1.75], face: 1, hold: 'proud',
  cues: [[0.62, 'hen_land', { intensity: 0.2 }], [0.66, 'tada', { intensity: 0.2 }], [0.85, 'cluck', { intensity: 0 }], [1.15, 'cluck', { intensity: 0 }], [1.45, 'cluck', { intensity: 0 }], [1.75, 'cluck', { intensity: 0 }],
    [2.1, 'cluck', { intensity: 1 }], [2.15, 'confetti', { intensity: 1 }], [2.4, 'tada', { intensity: 1 }]],
  fx: [{ at: 2.15, n: 40, from: 'sides', gold: true }],
  pose(u) {
    const P = henPose({ blush: 0.5 });
    happy(P, ss(0, 0.3, u), 1);
    const up = env(u, 0.1, 0.25, 0.58, 0.66); // she looks up at the falling crown
    P.eHappy = lerp(P.eHappy, 0, up); P.pdy -= 1.8 * up; P.hr -= 0.25 * up; P.beak = Math.max(P.beak, 2.5 * up);
    const hit = u - 0.62;
    if (hit >= 0) { P.sq -= 0.13 * Math.exp(-hit / 0.08) * Math.cos(hit * 15); P.hy += 3 * Math.exp(-hit / 0.1); P.eSqueeze = env(u, 0.62, 0.66, 0.72, 0.8); }
    // strut: four high steps to the right, chest out, head bobbing forward on each step
    const S = env(u, 0.78, 0.9, 1.88, 2.0), ph = (u - 0.85) / 0.3;
    P.dx += lerp(lerp(-16, 16, ss(0.85, 1.9, u)), 0, ss(1.98, 2.2, u)); // across the stage, and back to centre on the last hop
    const st = Math.sin(ph * Math.PI);
    P.fL += Math.max(0, st) * 8 * S; P.fR += Math.max(0, -st) * 8 * S; P.sL += st * 7 * S; P.sR -= st * 7 * S;
    P.hx += 4 * Math.abs(Math.cos(ph * Math.PI)) * S - 2 * S; P.lean -= 0.1 * S; P.puff += 0.05 * S; P.hr -= 0.22 * S; P.tsp += 1 * S; P.tail += 0.15 * S;
    P.lift += Math.abs(st) * 2 * S;
    for (const b of [0.85, 1.15, 1.45, 1.75]) cluck(P, u, b, 3);
    wings(P, 0.6, 0.5, 0.4, S);
    // the proud pose: chest puffed, beak up, eyes shut, near wing high ("number one")
    const fin = ss(1.95, 2.15, u);
    P.puff += 0.07 * fin; P.lean -= 0.12 * fin; P.hr -= 0.3 * fin; happy(P, fin, 1);
    wings(P, 1.75, 0.45, 0.9, fin); bounce(P, u, 2.0, 4); cluck(P, u, 2.12, 5);
    return P;
  },
  hat: 'crown',
};

// The fail card: a short sad droop and one sniff (never long sobs), she shakes it off, perks up and cheers you on.
R.encourage = {
  len: 1.5, stars: [], face: -1, hold: 'cheerOn',
  cues: [[0.86, 'hen_hop', { intensity: 0.2 }], [0.9, 'cheer_up', {}], [1.0, 'cluck', { intensity: 1 }]],
  fx: [],
  pose(u) {
    const P = henPose({ blush: 0.35 });
    const sad = env(u, 0, 0.12, 0.42, 0.55);
    P.hy += 4 * sad; P.hr += 0.16 * sad; P.pdy += 1.6 * sad; P.brow = 0.9 * sad; P.browY = 1 * sad; P.wa -= 0.2 * sad; P.wf -= 0.1 * sad; P.tail -= 0.3 * sad;
    P.sq -= 0.03 * sad + 0.04 * env(u, 0.26, 0.3, 0.32, 0.4); // one sniff
    const sh = env(u, 0.45, 0.5, 0.68, 0.76); // shake it off
    P.dx += Math.sin(u * 62) * 2.2 * sh; P.hr += Math.sin(u * 62 + 1) * 0.12 * sh; P.tufts = 0.9 * sh; P.eSqueeze = sh; P.puff += 0.04 * sh;
    const a = jump(P, u, 0.86, 0.3, 10, 0.9, 0.1);
    const go = ss(0.8, 0.95, u);
    wings(P, 1.7, 0.5, 0.9, go); happy(P, go, 4); P.grit = go; P.hr -= 0.12 * go;
    if (a >= 0) P.fR += 3;
    const fin = ss(1.15, 1.45, u);
    P.beak = lerp(P.beak, 2.5, fin); P.lean += 0.06 * fin; P.wa = lerp(P.wa, 1.55, fin);
    return P;
  },
};

// the final hold: the routine's last pose kept alive
function hold(name, P, v) {
  breathe(P, v);
  const R0 = R[name], k = Math.floor(v / 2.6), w = v - k * 2.6; // now and then a small beat, so she never freezes
  if (R0.hold === 'wave') P.wa += Math.sin(v * 9) * 0.25 * (0.6 + 0.4 * Math.sin(v * 0.7));
  else if (R0.hold === 'pump') { bounce(P, w, 1.6, 3); P.wa -= 0.9 * env(w, 1.5, 1.56, 1.62, 1.76); P.wf -= 0.6 * env(w, 1.5, 1.56, 1.62, 1.76); }
  else if (R0.hold === 'sway') { P.sway += Math.sin(v * 3) * 0.07; P.dx += Math.sin(v * 3) * 2; }
  else if (R0.hold === 'balance') { P.hr += Math.sin(v * 2.3) * 0.05; P.dx += Math.sin(v * 2.3 + 1) * 1.2; }
  else if (R0.hold === 'hug') P.hy += Math.sin(v * 3.4) * 0.8;
  else if (R0.hold === 'proud') { P.hy += Math.sin(v * 2.2) * 0.8; }
  else if (R0.hold === 'cheerOn') { bounce(P, w, 1.4, 3.5); P.wa += 0.15 * env(w, 1.36, 1.44, 1.56, 1.7); P.hy += Math.max(0, Math.sin(v * 4)) * 1.2; }
}

function poseAt(name, u, pw) {
  const R0 = R[name];
  if (u >= R0.len) { const P = R0.pose(R0.len, pw); hold(name, P, u - R0.len); return P; }
  const P = R0.pose(Math.max(0, u), pw);
  breathe(P, u);
  return P;
}

/* ------------------------------------------------------------------ public API */
export const ROUTINES = ['cheer', 'pump', 'dance', 'juggle', 'backflip', 'chicks', 'strut'];
export const routine = (name) => R[name] || R.cheer;

// Pick the routine for a result. info: {stars, streak (3-star streak incl. this win), boss, firstWorld, last}
export function pickRoutine(info, rnd = Math.random) {
  const { stars = 1, streak = 0, boss = false, firstWorld = false, last = '' } = info || {};
  let pool;
  if (boss) pool = ['strut', 'backflip'];
  else if (firstWorld) pool = ['juggle', 'dance'];
  else if (stars >= 3) pool = streak >= 2 ? ['chicks', 'backflip'] : ['backflip', 'chicks'];
  else if (stars === 2) pool = rnd() < 0.5 ? ['dance', 'pump'] : ['pump', 'dance'];
  else pool = rnd() < 0.65 ? ['cheer', 'pump'] : ['pump', 'cheer'];
  return pool.find((r) => r !== last) || pool[0];
}
// power 0..1 from the result (bigger jumps and more confetti for a better result)
export const routinePower = (stars) => [0.45, 0.45, 0.75, 1][clamp(stars | 0, 0, 3)];

// the cues whose time lies in (u0, u1]
export function routineCues(name, u0, u1) {
  return routine(name).cues.filter(([t]) => t > u0 && t <= u1);
}

/* ------------------------------------------------------------------ drawing */
// Draw the routine `name` at time u on a stage box {x, y, w, h} (screen px). The hen stands centred on the box's floor,
// as tall as fits with room for her biggest jump. o: {pw, calm (reduced motion: the final pose, still, no confetti),
// seed, henH (px), clip {x, y, w, h} (the drawing area; default the box), fxBig (see confetti)}
export function drawCelebration(ctx, name, u, box, o = {}) {
  const R0 = routine(name), pw = o.pw == null ? 1 : o.pw, calm = !!o.calm;
  if (calm) u = R0.len;
  const hh = o.henH || Math.min(box.h * 0.66, box.w * 0.5);
  const cx = box.x + box.w / 2, gy = box.y + box.h - hh * 0.05, cy = gy - 0.48 * hh, S = hh / 100;
  const P = poseAt(name, u, pw);
  if (!calm) { // overlapping action: lagged speeds of the body drive the comb, tail and wing tips
    const P1 = poseAt(name, u - 0.04, pw), P2 = poseAt(name, u - 0.09, pw);
    henSecondary(P, (P1.lift - P2.lift) / 0.05, ((P1.dx - P2.dx) / 0.05) * (R0.face || -1));
  }
  const ev = henIdleEvents(u + 0.7 + (o.seed || 0));
  const blink = calm || P.eHappy > 0.6 || P.eSqueeze > 0.5 ? 0 : ev.blink;
  // feather bursts are drawn by the hen herself (around her body), the latest one that is still flying
  let burst = null;
  for (const f of R0.fx) if (f.from === 'feathers' && u >= f.at && u - f.at < 1) burst = { u: (u - f.at) * 1.1, k: Math.round(f.at * 10) + (o.seed || 0) };
  const clip = o.clip || box, own = { cx, gy, S, clip };
  if (!calm) confetti(ctx, R0, u, pw, own, o.fxBig, o.seed || 0, 0);
  ctx.save();
  ctx.beginPath(); ctx.rect(clip.x, clip.y, clip.w, clip.h); ctx.clip(); // nothing (the falling crown, a flying egg) crosses the HUD
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(S, S);
  if (R0.props) R0.props(ctx, calm ? R0.len : u, pw, false);
  ctx.restore();
  // a soft contact shadow on the stage floor
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(cx + P.dx * S, gy, hh * 0.36 / (1 + Math.max(0, P.lift) / 30), hh * 0.06, 0, 0, TAU); ctx.fill();
  const hat = R0.hat === 'crown' ? crownHat(u) : name === 'juggle' ? eggHat(u) : null;
  drawHenPose(ctx, P, cx, cy, hh, { face: R0.face || -1, blink, tt: u, calm, burst, hat, enter: o.noEnter ? null : u + 0.02 });
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(S, S);
  if (R0.props) R0.props(ctx, calm ? R0.len : u, pw, true);
  if (name === 'juggle') jugglingEggs(ctx, u, P, R0.face);
  if (name === 'strut') fallingCrown(ctx, u, P, R0.face, (box.y - cy) / S); // it drops in from the stage's top edge, under the card title
  if (R0.heart) for (const t of R0.heart) { const v = calm ? 0.4 : fract((u - t) / 2.6) * 2.6; if (u >= t && v < 1) drawHeart(ctx, 4 * Math.sin(v * 5), -62 - v * 22, 8, 2.8, 1 - ss(0.6, 1, v)); }
  ctx.restore();
  ctx.restore();
  if (!calm) confetti(ctx, R0, u, pw, own, o.fxBig, o.seed || 0, 1);
}

// Confetti: deterministic pieces from (burst, index): no stored particles. Two cannons at the stage's floor corners
// shoot up and inward ('sides'), or a shower falls from above ('top'); air drag makes them hang and flutter down.
// layer 0 = the pieces behind her, 1 = in front. Rects, dots and ribbons in the palette; no glow, no white.
// own = {cx, gy, S, clip}: this stage's floor centre, scale and clip; big (optional, with `until`): a burst fired before
// big.until keeps that geometry (the win screen's full-screen show), so its pieces do not jump when she moves to the card.
function confetti(ctx, R0, u, pw, own, big, seed, layer) {
  R0.fx.forEach((f, bi) => {
    if (f.from === 'feathers') return;
    const tau = u - f.at;
    if (tau < 0 || tau > 2.6) return;
    const isBig = big && f.at < big.until, { cx, gy, S, clip } = isBig ? big : own;
    const fade = isBig ? 1 - ss(big.until - 0.1, big.until + 0.45, u) : 1; // the show's confetti clears as the card lands, off its text
    if (fade <= 0.01) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(clip.x, clip.y, clip.w, clip.h); ctx.clip();
    const halfW = Math.max(clip.w / 2, 80 * S);
    const n = Math.round(f.n * (0.55 + 0.45 * pw));
    for (let i = 0; i < n; i++) {
      if ((i & 1) !== layer) continue;
      const h1 = hash(i * 7.31 + bi * 13 + seed), h2 = hash(i * 3.17 + bi * 5 + seed + 1), h3 = hash(i * 1.93 + bi * 11 + seed + 2), h4 = hash(i * 5.71 + bi + seed + 3);
      const life = 1.7 + h4 * 0.9, tt = tau - h3 * 0.08;
      if (tt < 0 || tt > life) continue;
      let x0, y0, vx, vy;
      if (f.from === 'top') { x0 = cx + (h1 * 2 - 1) * halfW; y0 = clip.y - 10 * S; vx = (h2 - 0.5) * 60 * S; vy = 40 * S + h3 * 60 * S; }
      else { const sd = i % 4 < 2 ? -1 : 1, ang = -Math.PI / 2 - sd * (0.3 + h1 * 0.6), sp = (430 + h2 * 320) * S; x0 = cx + sd * halfW * 0.92; y0 = gy; vx = Math.cos(ang) * sp; vy = Math.sin(ang) * sp; }
      const k = 2.4 + h3 * 1.2, g = 340 * S, e = 1 - Math.exp(-k * tt);
      const x = x0 + (vx * e) / k + Math.sin(tt * (5 + 4 * h4) + h1 * 9) * 9 * S * Math.min(1, tt * 2);
      const y = y0 + (g / k) * tt + ((vy - g / k) * e) / k;
      const a = (1 - ss(life - 0.4, life, tt)) * fade;
      const col = f.gold ? ['#ffd23f', '#ffb020', '#e57d12', '#f0402f'][i % 4] : PAL[(i + bi * 3) % PAL.length];
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(x, y);
      ctx.rotate(h2 * TAU + tt * (h1 > 0.5 ? 7 : -7));
      ctx.scale(1, Math.cos(tt * (9 + 6 * h3) + h4 * 6)); // tumbling: the piece flips edge-on and back
      ctx.fillStyle = col;
      const kind = i % 5;
      if (kind === 4) { ctx.beginPath(); ctx.arc(0, 0, 2.6 * S, 0, TAU); ctx.fill(); }
      else if (kind === 3) { ctx.strokeStyle = col; ctx.lineWidth = 2.4 * S; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-6 * S, 0); ctx.quadraticCurveTo(0, -5 * S, 6 * S, 0); ctx.stroke(); }
      else ctx.fillRect(-4 * S, -2.4 * S, 8 * S, 4.8 * S);
      ctx.restore();
    }
    ctx.restore();
  });
}

/* ------------------------------------------------------------------ props */
// a small egg in the hen's frame units (cream, two-tone, the house outline): (x, y) centre, height s
function egg(ctx, x, y, s, rot = 0) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  const w = s * 0.76, path = () => { ctx.beginPath(); for (let i = 0; i <= 24; i++) { const t = (i / 24) * TAU, sy = Math.sin(t); const px = (w / 2) * Math.cos(t) * (1 + 0.13 * sy), py = (s / 2) * sy; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); };
  path(); ctx.fillStyle = '#f6e6c4'; ctx.fill();
  ctx.save(); path(); ctx.clip(); ctx.fillStyle = '#e2c595'; ctx.beginPath(); ctx.ellipse(w * 0.16, s * 0.12, w * 0.5, s * 0.5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f6e6c4'; ctx.beginPath(); ctx.ellipse(-w * 0.04, -s * 0.06, w * 0.46, s * 0.47, 0, 0, TAU); ctx.fill(); ctx.restore();
  path(); ctx.lineWidth = 2.4; ctx.strokeStyle = LINE; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(-w * 0.18, -s * 0.22, w * 0.1, s * 0.08, -0.5, 0, TAU); ctx.fill();
  ctx.restore();
}
// The juggle: egg i waits in her wing, is thrown at jugThrows[i] (up from her chest and caught in front), thrown again at
// jugThrows[i + 3] on its last arc, and lands at jugLand[i]: eggs 0 and 1 at her feet, egg 2 on her head (eggHat).
function jugglingEggs(ctx, u, P, face) {
  const fs = face >= 0 ? 1 : -1, { T, air, fin } = JUG;
  if (u < 0.32) return;
  const appear = ss(0.32, 0.46, u), hand = [30, 4];
  for (let i = 0; i < 3; i++) {
    const t1 = jugThrows[i], t2 = jugThrows[i + 3], t3 = jugLand[i];
    let x, y, rot = 0;
    if (u < t1) { x = 30 + i * 4; y = 8 - 5 * i; } // waiting in her wing
    else if (u < t1 + air) { const a = (u - t1) / air; x = lerp(hand[0], 46, a); y = hand[1] - 78 * 4 * a * (1 - a); rot = a * 3; }
    else if (u < t2) { const a = clamp((u - t1 - air) / (t2 - t1 - air), 0, 1); x = lerp(46, hand[0], a); y = hand[1] + 6 * Math.sin(a * Math.PI); } // carried back to throw again
    else if (u < t3) {
      const a = (u - t2) / fin, end = i === 2 ? [22 + P.hx, -25 + P.hy - 13 - 9] : [[40, 39], [54, 39]][i];
      x = lerp(hand[0], end[0], a); y = lerp(hand[1], end[1], a) - 62 * 4 * a * (1 - a); rot = a * TAU;
    } else if (i < 2) { const d = u - t3; x = [40, 54][i]; y = 39 - 4 * Math.exp(-d / 0.06) * Math.abs(Math.sin(d * 18)); }
    else continue;
    egg(ctx, fs * x, y, 19 * appear, rot * fs);
  }
}
function eggHat(u) {
  const t = jugLand[2];
  if (u < t) return null;
  return (ctx) => { const d = u - t, sq = 1 - 0.15 * Math.exp(-d / 0.08) * Math.cos(d * 16); ctx.save(); ctx.translate(1, -20); ctx.scale(1 / sq, sq); egg(ctx, 0, -9, 19, Math.sin(u * 2.3) * 0.08); ctx.restore(); };
}
// the boss crown: gold, three points with red and blue gems, the house outline; falls from above and lands at 0.62
function crown(ctx, o, glint) {
  ctx.beginPath();
  ctx.moveTo(-11, 0); ctx.lineTo(-13, -13); ctx.lineTo(-6, -7); ctx.lineTo(0, -16); ctx.lineTo(6, -7); ctx.lineTo(13, -13); ctx.lineTo(11, 0); ctx.closePath();
  ctx.fillStyle = '#ffd23f'; ctx.fill();
  ctx.save(); ctx.clip(); ctx.fillStyle = '#e59a12'; ctx.fillRect(-16, -4, 32, 6); ctx.restore();
  ctx.lineWidth = o; ctx.strokeStyle = '#7a4a0a'; ctx.lineJoin = 'round'; ctx.stroke();
  for (const [x, y, c] of [[-13, -13, '#f0402f'], [0, -16, '#5a8dee'], [13, -13, '#f0402f']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, TAU); ctx.fill(); ctx.lineWidth = o * 0.6; ctx.stroke(); }
  if (glint > 0) { ctx.save(); ctx.globalAlpha = glint; ctx.fillStyle = '#fff6c8'; ctx.translate(-5, -6); ctx.rotate(0.6); ctx.fillRect(-0.8, -3.5, 1.6, 7); ctx.fillRect(-3.5, -0.8, 7, 1.6); ctx.restore(); }
}
function crownHat(u) {
  if (u < 0.62) return null;
  return (ctx, P, o) => {
    const d = u - 0.62, b = Math.exp(-d / 0.12) * Math.abs(Math.sin(d * 14)) * 5;
    const gl = u > 1 ? env(fract((u - 1) / 1.6) * 1.6, 0, 0.1, 0.2, 0.35) : 0;
    ctx.save(); ctx.translate(-1, -13 - b); ctx.rotate(-0.12 + Math.sin(d * 10) * 0.12 * Math.exp(-d / 0.2)); crown(ctx, o || 2.8, gl); ctx.restore();
  };
}
function fallingCrown(ctx, u, P, face, top) {
  if (u < 0.08 || u >= 0.62) return;
  const a = (u - 0.08) / 0.54, fs = face >= 0 ? 1 : -1, hx = P.dx + fs * (21 + P.hx), hy = -25 + P.hy - P.lift - 13;
  ctx.save(); ctx.translate(lerp(hx - 14 * fs, hx, a), lerp(Math.min(hy - 20, top + 10), hy, a * a)); ctx.rotate((1 - a) * 2.4 * fs); crown(ctx, 2.8, 0); ctx.restore();
}
