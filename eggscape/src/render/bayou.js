// Gator Bayou creatures (v3.7): the alligator (and Grandpa Gator, the world boss), the snapping turtle and the mosquito
// swarm. Crisp cel-shaded code art in the house style: one dark outline, base + one hard shadow + one hard highlight, no light
// rim or halo. Frozen and stunned use the shared looks (render/status.js), drawn into the creature's own silhouette.
//
// drawGator(ctx, s, t, o): in a local px frame (y down), feet-middle at (0, 0), snout toward +x, s = body length px. o:
//   jaw 0..1 (open)   eye 'open' | 'half' | 'shut' | 'spiral' | 'squint'   gait (walk phase)   tail (curl rad, + = up)
//   roll 0..1 (death roll progress)   bend (floor radius px, Infinity = straight)   boss 1 (Grandpa: older skin, lily pad
//   hat, gold tooth, moss)   baby 1 (brighter, big eyes)   sneeze 0..1   stars 0..1
// drawTurtle(ctx, s, t, o): same frame, s = shell length px. o: head (-1 tucked .. 0 out .. 1 lunge), mouth 0..1, gait, flip
//   0..1 (on its back), flail, shell 0..1 (pulled in), eye
// drawMosquito(ctx, x, y, sz, t, o) one insect; drawSwarm(ctx, x, y, R, t, o) a buzzing cloud (o.tight, o.spread, o.fed)
import { TAU } from '../sim/geom.js';
import { GATOR, TURTLE } from '../sim/bayou.js';
import { statusClock, statusDraw, dizzyStars, spiralEye } from './status.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

const SKIN = {
  gator: { line: '#0b0c05', base: '#434a22', shade: '#2b3016', deep: '#1c200d', hi: '#6e7a38', belly: '#f2dc8a', bellyLo: '#c9a952', jaw: '#e8cc72', eye: '#ffd23a', eyeLo: '#d9921a', mouth: '#8a2632', mouthLo: '#5a1420', teeth: '#fff1cc', scute: '#1e220e' },
  baby: { line: '#0b0c05', base: '#525c28', shade: '#363d1a', deep: '#242912', hi: '#808c42', belly: '#f6e296', bellyLo: '#d0b05c', jaw: '#ecd27c', eye: '#ffe04a', eyeLo: '#e0a020', mouth: '#9a2e3a', mouthLo: '#5a1420', teeth: '#fff1cc', scute: '#262c12' },
  boss: { line: '#0a0a06', base: '#45402a', shade: '#2e2a1a', deep: '#1e1b10', hi: '#6e6a48', belly: '#ecd48a', bellyLo: '#bf9e50', jaw: '#e0c470', eye: '#ffb52a', eyeLo: '#cc7a12', mouth: '#82222e', mouthLo: '#4e1018', teeth: '#f6e6bc', scute: '#1c1a0e', moss: '#7fb23a', mossLo: '#4f7a22', pad: '#4fa83a', padLo: '#2f7424', flower: '#ff7aa8', flowerLo: '#d94a80', gold: '#ffcf3a' },
};
const TURT = { line: '#1a180a', shell: '#6f7b3a', shellLo: '#4a5224', shellDeep: '#30361a', shellHi: '#a6b360', moss: '#86b83e', skin: '#a19d5e', skinLo: '#77733e', skinHi: '#cbc78c', plastron: '#dccb8a', beak: '#3a3420', eye: '#ff9a2a' };

// cosine-smoothed profile through [x, y] points
function prof(P) {
  return (x) => {
    if (x <= P[0][0]) return P[0][1];
    for (let i = 1; i < P.length; i++) if (x <= P[i][0]) { const [x0, y0] = P[i - 1], [x1, y1] = P[i], u = (x - x0) / (x1 - x0); return lerp(y0, y1, (1 - Math.cos(u * Math.PI)) / 2); }
    return P[P.length - 1][1];
  };
}
// gator profile in art units (x -50 tail tip .. 50 snout tip; y up)
const G_TOP = prof([[-50, 2], [-40, 5], [-28, 9], [-12, 15], [4, 19], [16, 16.5], [22, 13.5], [30, 12.5], [40, 10], [47, 7.5], [50, 4.6]]);
const G_BOT = prof([[-50, 1.2], [-30, 1], [-12, 1.1], [4, 0.6], [18, 1.4], [24, 2.4], [34, 2], [44, 2.2], [50, 3.6]]);
const G_MOUTH = prof([[22, 7.6], [30, 6], [40, 5.2], [50, 5]]);
const HINGE = [22, 7.4];

// ================================================================= the gator
export function drawGator(ctx, s, t = 0, o = {}) {
  if (!(s > 0)) return;
  const C = o.boss ? SKIN.boss : o.baby ? SKIN.baby : SKIN.gator, U = s / 100, lw = clamp(2.3 / U, 1.4, 3.8); // ~2.3 px outline at any size
  const R = o.bend && isFinite(o.bend) ? o.bend / U : Infinity, jaw = clamp(o.jaw || 0, 0, 1) * 0.78, tail = o.tail || 0;
  const rollU = clamp(o.roll || 0, 0, 1), cr = rollU > 0 ? Math.cos(rollU * TAU * 2) : 1, midY = 8;
  const breathe = 1 + 0.02 * Math.sin(t * 1.8 + (o.id || 0));
  // the art point (x, y up) -> ctx (x, y down): tail curl, roll, then the floor's curve
  const HY = o.boss ? 1.05 : 1.3; // the art is drawn a little taller than the profile (reads at phone scale)
  const M = (x, y) => {
    y *= HY;
    if (x < -14 && tail) { const f = clamp((-14 - x) / 36, 0, 1), a = tail * f * 1.25, dx = x + 14, dy = y - 7; x = -14 + dx * Math.cos(a) - dy * Math.sin(a); y = 7 + dx * Math.sin(a) + dy * Math.cos(a); }
    y = midY * HY + (y - midY * HY) * cr;
    if (y > midY * HY) y = midY * HY + (y - midY * HY) * breathe;
    const fy = isFinite(R) ? (x * x) / (2 * R) : 0;
    return [x, -(y + fy)];
  };
  const jawRot = (x, y) => { const dx = x - HINGE[0], dy = y - HINGE[1], c = Math.cos(jaw), sn = Math.sin(jaw); return [HINGE[0] + dx * c - dy * sn, HINGE[1] + dx * sn + dy * c]; };
  const pts = (list) => { ctx.beginPath(); list.forEach(([x, y], i) => { const [X, Y] = M(x, y); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.closePath(); };
  const range = (a, b, f, step = 2) => { const out = []; const n = Math.max(1, Math.ceil(Math.abs(b - a) / step)); for (let i = 0; i <= n; i++) { const x = a + ((b - a) * i) / n; out.push([x, f(x)]); } return out; };
  const stroke = (w = lw) => { ctx.lineWidth = w; ctx.strokeStyle = C.line; ctx.stroke(); };
  ctx.save();
  try {
    ctx.scale(U, U);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    const g = o.gait || 0, walk = o.walk || 0, belly = cr < 0;
    // ---- far legs (behind the body)
    const leg = (x0, ph, far) => {
      const sw = walk * Math.sin(g + ph) * 3, lift = walk * Math.max(0, Math.cos(g + ph)) * 1.6;
      const hip = [x0, 5], knee = [x0 + 3 + sw * 0.4, 2.6 + lift], foot = [x0 + 5 + sw, 0.2 + lift * 0.6];
      ctx.beginPath(); for (const [i, p] of [hip, knee, foot].entries()) { const [X, Y] = M(p[0], p[1]); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
      ctx.lineWidth = 5.2 + lw * 2; ctx.strokeStyle = C.line; ctx.stroke();
      ctx.lineWidth = 5.2; ctx.strokeStyle = far ? C.deep : C.shade; ctx.stroke();
      for (let k = -1; k <= 1; k++) { const [X, Y] = M(foot[0] + 2.6 + k * 0.4, foot[1] - 0.2 + k * 0.9); const [X0, Y0] = M(foot[0], foot[1]); ctx.beginPath(); ctx.moveTo(X0, Y0); ctx.lineTo(X, Y); ctx.lineWidth = 1.6 + lw * 1.6; ctx.strokeStyle = C.line; ctx.stroke(); ctx.lineWidth = 1.6; ctx.strokeStyle = far ? C.deep : C.shade; ctx.stroke(); }
    };
    if (!belly) { leg(-8, 1.6, true); leg(17, -1.6, true); }
    // ---- body + tail + lower jaw silhouette
    const top = range(-50, 22, G_TOP), mouth = range(22, 50, G_MOUTH), bot = range(50, -50, G_BOT);
    const body = [...top, ...mouth, ...bot];
    pts(body); ctx.fillStyle = belly ? C.belly : C.shade; ctx.fill();
    ctx.save(); pts(body); ctx.clip();
    if (!belly) {
      // the lit back: a band from the top line down to 55% of the height; spine highlight just under the top
      pts([...range(-50, 50, (x) => G_TOP(x) + 3), ...range(50, -50, (x) => lerp(G_BOT(x), G_TOP(x), 0.48))]); ctx.fillStyle = C.base; ctx.fill();
      ctx.beginPath(); range(-36, 14, (x) => G_TOP(x) - 1.6).forEach(([x, y], i) => { const [X, Y] = M(x, y); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.lineWidth = 1.5; ctx.strokeStyle = C.hi; ctx.stroke();
      // belly: a pale scoop along the bottom with scale lines
      pts([...range(-40, 46, (x) => lerp(G_BOT(x), G_TOP(x), 0.24)), ...range(46, -40, (x) => G_BOT(x) - 2)]); ctx.fillStyle = C.belly; ctx.fill();
      pts([...range(-40, 46, (x) => lerp(G_BOT(x), G_TOP(x), 0.1)), ...range(46, -40, (x) => G_BOT(x) - 2)]); ctx.fillStyle = C.bellyLo; ctx.fill();
      ctx.strokeStyle = C.bellyLo; ctx.lineWidth = 0.8;
      for (let x = -30; x < 20; x += 4) { const [X0, Y0] = M(x, G_BOT(x) + 0.5), [X1, Y1] = M(x + 0.6, lerp(G_BOT(x), G_TOP(x), 0.24)); ctx.beginPath(); ctx.moveTo(X0, Y0); ctx.lineTo(X1, Y1); ctx.stroke(); }
      // flank scales: two rows of dark ovals
      ctx.fillStyle = C.shade;
      for (let x = -26; x < 16; x += 5.2) for (const [f, r] of [[0.62, 1.6], [0.42, 1.3]]) { const [X, Y] = M(x + (f < 0.5 ? 2.6 : 0), lerp(G_BOT(x), G_TOP(x), f)); ctx.beginPath(); ctx.ellipse(X, Y, r * 1.3, r * 0.8, 0, 0, TAU); ctx.fill(); }
    } else {
      // death roll: the pale belly turns up, with its scale bands
      ctx.strokeStyle = C.bellyLo; ctx.lineWidth = 1;
      for (let x = -40; x < 46; x += 4) { const [X0, Y0] = M(x, G_BOT(x)), [X1, Y1] = M(x, G_TOP(x)); ctx.beginPath(); ctx.moveTo(X0, Y0); ctx.lineTo(X1, Y1); ctx.stroke(); }
    }
    ctx.restore();
    pts(body); stroke();
    // ---- scutes along the back and the tail
    if (!belly) for (let x = -47; x < 16; x += 4.2) {
      const h = x < -12 ? 2.4 + 0.6 * ((x + 47) / 35) : 2.1, y0 = G_TOP(x) - 0.4;
      pts([[x - 1.7, y0], [x - 0.6, y0 + h], [x + 0.6, y0 + h], [x + 1.7, y0]]); ctx.fillStyle = C.scute; ctx.fill(); stroke(lw * 0.75);
    }
    // ---- moss (Grandpa)
    if (o.boss && !belly) for (const [x, r] of [[-20, 2.6], [-6, 3.2], [8, 2.4]]) { const y = G_TOP(x) + 1.2; pts(range(x - r * 1.6, x + r * 1.6, (q) => y + Math.max(0, r * Math.cos(((q - x) / (r * 1.6)) * Math.PI / 2)) * 0.9, 0.8)); ctx.fillStyle = C.moss; ctx.fill(); stroke(lw * 0.7); ctx.fillStyle = C.mossLo; ctx.beginPath(); const [X, Y] = M(x + r * 0.4, y + r * 0.35); ctx.ellipse(X, Y, r * 0.6, r * 0.25, 0, 0, TAU); ctx.fill(); }
    // ---- the open mouth: dark red inside, teeth on both jaws
    const upperJaw = [[17, G_TOP(17) - 0.5], ...range(22, 50, G_TOP), ...range(50, 22, G_MOUTH)];
    const teeth = (up) => {
      for (let x = 25; x < 49; x += 3.1) {
        const y = G_MOUTH(x), p = up ? [[x - 1, y], [x, y - 2.1], [x + 1, y]] : [[x - 0.9 + 1.5, y], [x + 1.5, y + 1.9], [x + 0.9 + 1.5, y]];
        const q = up ? p.map(([a, b]) => jawRot(a, b)) : p;
        const gold = o.boss && up && Math.abs(x - 40.5) < 1;
        pts(gold ? [[x - 2, y + 0.5], [x - 0.3, y - 4.8], [x + 2, y + 0.5]].map(([a, b]) => jawRot(a, b)) : q); ctx.fillStyle = gold ? C.gold : C.teeth; ctx.fill(); stroke(lw * (gold ? 0.7 : 0.55));
      }
    };
    if (jaw > 0.04) {
      const tip = jawRot(50, G_MOUTH(50));
      pts([HINGE, tip, [50, G_MOUTH(50) + 0.5], [36, G_MOUTH(36)]]); ctx.fillStyle = C.mouth; ctx.fill();
      pts([[30, G_MOUTH(30)], [50, G_MOUTH(50) + 0.4], [44, G_MOUTH(44) + 1.6]]); ctx.fillStyle = C.mouthLo; ctx.fill();
      teeth(false);
    } else teeth(false);
    // ---- the upper jaw / head (turned up about the hinge when open)
    const head = upperJaw.map(([x, y]) => jawRot(x, y));
    pts(head); ctx.fillStyle = belly ? C.bellyLo : C.base; ctx.fill();
    if (!belly) { ctx.save(); pts(head); ctx.clip(); pts([...range(17, 50, (x) => G_MOUTH(Math.max(22, x)) + 0.3).map(([x, y]) => jawRot(x, y)), ...range(50, 17, (x) => G_MOUTH(Math.max(22, x)) + 2.4).map(([x, y]) => jawRot(x, y))]); ctx.fillStyle = C.jaw; ctx.fill(); ctx.restore(); }
    pts(head); stroke();
    teeth(true);
    // nostril knob
    { const [nx, ny] = jawRot(47.4, G_TOP(47.4) + 0.4), [X, Y] = M(nx, ny); ctx.beginPath(); ctx.arc(X, Y, 1.5, 0, TAU); ctx.fillStyle = C.shade; ctx.fill(); stroke(lw * 0.7); ctx.beginPath(); ctx.arc(X + 0.3, Y + 0.2, 0.55, 0, TAU); ctx.fillStyle = C.line; ctx.fill(); }
    // ---- the eye on its knob
    if (!belly) {
      const big = o.baby ? 1.3 : 1, [ex0, ey0] = jawRot(28.5, G_TOP(28.5) + 1.2), [EX, EY] = M(ex0, ey0), er = 2.6 * big;
      ctx.beginPath(); ctx.ellipse(EX, EY + 0.6, er * 1.7, er * 1.2, 0, Math.PI, TAU); ctx.fillStyle = C.base; ctx.fill(); stroke(lw * 0.85);
      const eye = o.eye || 'open';
      if (eye === 'spiral') { ctx.beginPath(); ctx.arc(EX, EY, er, 0, TAU); ctx.fillStyle = '#fff6d8'; ctx.fill(); stroke(lw * 0.7); spiralEye(ctx, EX, EY, er, t, 1, C.line); }
      else if (eye === 'shut' || eye === 'squint') { ctx.beginPath(); ctx.moveTo(EX - er, EY - 0.2); ctx.quadraticCurveTo(EX, EY + (eye === 'squint' ? -1.2 : 1.1), EX + er, EY - 0.2); stroke(lw * 0.9); }
      else {
        const lid = eye === 'half' ? 0.5 : o.boss ? 0.32 : 0.12;
        ctx.save(); ctx.beginPath(); ctx.ellipse(EX, EY, er, er * 0.86, 0, 0, TAU); ctx.fillStyle = C.eye; ctx.fill(); ctx.clip();
        ctx.fillStyle = C.eyeLo; ctx.beginPath(); ctx.ellipse(EX, EY + er * 0.55, er * 1.1, er * 0.55, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#120a04'; ctx.beginPath(); ctx.ellipse(EX + (o.look || 0.35) * er * 0.35, EY, er * (o.jaw > 0.3 ? 0.36 : 0.22), er * 0.78, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = C.base; ctx.fillRect(EX - er * 1.3, EY - er * 1.3, er * 2.6, er * (0.3 + lid * 1.9));
        ctx.restore();
        ctx.beginPath(); ctx.ellipse(EX, EY, er, er * 0.86, 0, 0, TAU); stroke(lw * 0.8);
        ctx.beginPath(); ctx.moveTo(EX - er * 1.1, EY - er * 0.86 + er * (0.3 + lid * 1.9) - 0.3); ctx.lineTo(EX + er * 1.1, EY - er * 0.86 + er * (0.3 + lid * 1.9) - 0.6); stroke(lw * 0.8);
      }
      if (o.boss) { // a heavy grey brow and the lily pad hat with its flower
        ctx.beginPath(); ctx.moveTo(EX - er * 1.6, EY - er * 1.1); ctx.quadraticCurveTo(EX, EY - er * 2.2, EX + er * 1.7, EY - er * 0.9); ctx.lineWidth = 2.2 + lw * 1.6; ctx.strokeStyle = C.line; ctx.stroke(); ctx.lineWidth = 2.2; ctx.strokeStyle = '#a8a58a'; ctx.stroke();
        const [hx0, hy0] = jawRot(26, G_TOP(26) + 3.2), [HX, HY] = M(hx0, hy0);
        ctx.save(); ctx.translate(HX, HY); ctx.rotate(-0.08 - jaw * 0.6); ctx.scale(1.25, 1.25);
        ctx.beginPath(); ctx.ellipse(0, 0, 9, 2.6, 0, 0.35, TAU - 0.05); ctx.lineTo(0, 0); ctx.closePath(); ctx.fillStyle = C.pad; ctx.fill(); stroke(lw);
        ctx.beginPath(); ctx.ellipse(1, 0.8, 7, 1.2, 0, 0, Math.PI); ctx.fillStyle = C.padLo; ctx.fill();
        for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.55; ctx.beginPath(); ctx.ellipse(-2 + Math.cos(a) * 1.6, -2.6 + Math.sin(a) * 1.8, 1.3, 2.4, a + Math.PI / 2, 0, TAU); ctx.fillStyle = i % 2 ? C.flowerLo : C.flower; ctx.fill(); stroke(lw * 0.6); }
        ctx.beginPath(); ctx.arc(-2, -2.8, 1, 0, TAU); ctx.fillStyle = C.gold; ctx.fill();
        ctx.restore();
      }
    }
    // ---- near legs
    if (!belly) { leg(-12, 0, false); leg(14, Math.PI, false); }
    // ---- sneeze spray, stars
    if (o.sneeze > 0) { ctx.fillStyle = '#c84a2a'; for (let i = 0; i < 5; i++) { const a = -0.3 + i * 0.22, d = 6 + o.sneeze * 10 + i; const [X, Y] = M(52 + Math.cos(a) * d, 6 + Math.sin(a) * d); ctx.globalAlpha = o.sneeze; ctx.beginPath(); ctx.arc(X, Y, 1.1, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; }
  } catch (e) { /* art never breaks the frame */ }
  ctx.restore();
  if (o.stars > 0) { const [X, Y] = [(28 * s) / 100, -(G_TOP(28) * (o.boss ? 1.05 : 1.3) + 10) * (s / 100)]; dizzyStars(ctx, X, Y, s * 0.12, s * 0.035, t, { size: Math.max(3.2, s * 0.035), fade: o.stars }); }
}

// ================================================================= the snapping turtle (art units: 100 = shell length)
const T_SHELL = prof([[-38, 6], [-32, 20], [-18, 33], [-4, 36], [12, 32], [24, 22], [31, 8]]);
export function drawTurtle(ctx, s, t = 0, o = {}) {
  if (!(s > 0)) return;
  const C = TURT, U = s / 100, lw = clamp(1.5 / U, 1.1, 3.4), flip = clamp(o.flip || 0, 0, 1), tuck = clamp(o.shell || 0, 0, 1);
  const headX = (o.head || 0) * 8 - tuck * 14, mouth = clamp(o.mouth || 0, 0, 1), g = o.gait || 0, walk = o.walk || 0, flail = o.flail || 0;
  const P = (list) => { ctx.beginPath(); list.forEach(([x, y], i) => (i ? ctx.lineTo(x, -y) : ctx.moveTo(x, -y))); ctx.closePath(); };
  const range = (a, b, f, step = 2) => { const out = []; const n = Math.ceil(Math.abs(b - a) / step); for (let i = 0; i <= n; i++) { const x = a + ((b - a) * i) / n; out.push([x, f(x)]); } return out; };
  const stroke = (w = lw) => { ctx.lineWidth = w; ctx.strokeStyle = C.line; ctx.stroke(); };
  ctx.save();
  try {
    ctx.scale(U, U * 0.8); // flatter than drawn: the shell top meets the collider (TURTLE.h), so eggs can roll over it
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (flip > 0) { const c = Math.cos(Math.PI * flip), cy = c >= 0 ? Math.max(0.06, c) : Math.min(-0.06, c); ctx.translate(0, -18 - Math.sin(Math.PI * flip) * 12); ctx.scale(1, cy); ctx.translate(0, 18); } // rolls over in profile
    const limb = (x0, len, ph, far) => {
      const sw = flip > 0.5 ? Math.sin(t * 14 + ph) * 4 * flail : walk * Math.sin(g + ph) * 3;
      const a = [x0, 7], b = [x0 + 3 + sw, -0.2 + (flip > 0.5 ? 0 : walk * Math.max(0, Math.cos(g + ph)) * 1.4)];
      const L2 = len * (1 - tuck * 0.8);
      const bb = [lerp(a[0], b[0], L2 / len), lerp(a[1], b[1], L2 / len)];
      ctx.beginPath(); ctx.moveTo(a[0], -a[1]); ctx.lineTo(bb[0], -bb[1]); ctx.lineWidth = 7 + lw * 2; ctx.strokeStyle = C.line; ctx.stroke(); ctx.lineWidth = 7; ctx.strokeStyle = far ? C.skinLo : C.skin; ctx.stroke();
      if (tuck < 0.6) for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(bb[0] + 2, -bb[1]); ctx.lineTo(bb[0] + 4.2, -(bb[1] - 0.6 + k * 0.8)); ctx.lineWidth = 1.4 + lw; ctx.strokeStyle = C.line; ctx.stroke(); }
    };
    limb(-22, 8, 1.2, true); limb(14, 8, -1.2, true);
    // tail with a spiky ridge
    P([[-34, 9], [-50, 3.5], [-51, 2.4], [-34, 4]]); ctx.fillStyle = C.skinLo; ctx.fill(); stroke();
    for (let x = -48; x < -36; x += 3.5) { P([[x - 1, 3.6 + (x + 50) * 0.3], [x, 5.8 + (x + 50) * 0.33], [x + 1, 3.6 + (x + 50) * 0.3]]); ctx.fillStyle = C.shellDeep; ctx.fill(); stroke(lw * 0.6); }
    // neck and head
    const hx = 37 + headX, hy = 11 + (o.lunge || 0) * 1;
    P([[24, 6], [24, 16], [hx - 4, hy + 6], [hx - 4, hy - 4]]); ctx.fillStyle = C.skin; ctx.fill(); stroke();
    ctx.beginPath(); ctx.ellipse(hx, -hy, 9.5, 7.8, 0, 0, TAU); ctx.fillStyle = C.skin; ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = C.skinLo; ctx.beginPath(); ctx.ellipse(hx + 1, -hy + 5, 10, 4.5, 0, 0, TAU); ctx.fill(); ctx.fillStyle = C.skinHi; ctx.beginPath(); ctx.ellipse(hx - 2, -hy - 5.2, 5, 1.4, -0.1, 0, TAU); ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.ellipse(hx, -hy, 9.5, 7.8, 0, 0, TAU); stroke();
    // the hooked beak: upper hook over a lower jaw that drops open
    const mo = mouth * 4;
    P([[hx + 3, hy - 2 - mo], [hx + 12, hy - 1.6 - mo], [hx + 12.5, hy - 5 - mo], [hx + 9, hy - 6.4 - mo], [hx + 3, hy - 5 - mo]]); ctx.fillStyle = C.beak; ctx.fill(); stroke(lw * 0.8);
    P([[hx + 4, hy - 0.6], [hx + 13.6, hy + 0.2], [hx + 14.2, hy - 3.2], [hx + 12.2, hy - 1.2], [hx + 4, hy + 3]]); ctx.fillStyle = C.beak; ctx.fill(); stroke(lw * 0.8);
    if (mo > 0.5) { P([[hx + 4, hy - 0.8], [hx + 12, hy - 1.6], [hx + 12, hy - 1.8 - mo], [hx + 4, hy - 2 - mo]]); ctx.fillStyle = '#7a2a2a'; ctx.fill(); }
    // eye
    if (tuck < 0.95) {
      const ex = hx + 2.5, ey = hy + 2.6;
      if (o.eye === 'spiral') { ctx.beginPath(); ctx.arc(ex, -ey, 2.4, 0, TAU); ctx.fillStyle = '#fff6d8'; ctx.fill(); stroke(lw * 0.7); spiralEye(ctx, ex, -ey, 2.4, t, 1, C.line); }
      else if (o.eye === 'shut') { ctx.beginPath(); ctx.moveTo(ex - 2.2, -ey); ctx.quadraticCurveTo(ex, -ey + 1, ex + 2.2, -ey); stroke(lw * 0.8); }
      else { ctx.beginPath(); ctx.arc(ex, -ey, 2.2, 0, TAU); ctx.fillStyle = C.eye; ctx.fill(); stroke(lw * 0.7); ctx.beginPath(); ctx.arc(ex + 0.5, -ey, 1, 0, TAU); ctx.fillStyle = '#120a04'; ctx.fill(); if (o.glare) { ctx.beginPath(); ctx.moveTo(ex - 3, -ey - 3.2); ctx.lineTo(ex + 3, -ey - 1.6); stroke(lw * 1.1); } }
    }
    // plastron (belly plate) under the shell
    P([[-34, 7], [30, 7], [27, 2.5], [-31, 2.5]]); ctx.fillStyle = C.plastron; ctx.fill(); stroke(lw * 0.8);
    // the shell: base, hard shadow low, highlight cap, scute plates, three keels with knobs, serrated rim, moss
    const shell = range(-38, 31, T_SHELL);
    const shellPath = () => { P([...shell, [31, 6], [-38, 6]]); };
    shellPath(); ctx.fillStyle = C.shellLo; ctx.fill();
    ctx.save(); shellPath(); ctx.clip();
    P([...range(-38, 31, (x) => T_SHELL(x) + 2), ...range(31, -38, (x) => lerp(6, T_SHELL(x), 0.42))]); ctx.fillStyle = C.shell; ctx.fill();
    ctx.fillStyle = C.shellHi; ctx.beginPath(); ctx.ellipse(-8, -31, 12, 2.4, -0.05, 0, TAU); ctx.fill();
    ctx.strokeStyle = C.shellDeep; ctx.lineWidth = lw * 0.8;
    for (const x of [-24, -10, 6, 19]) { ctx.beginPath(); ctx.moveTo(x, -8); ctx.lineTo(x + 2, -T_SHELL(x) - 1); ctx.stroke(); }
    ctx.beginPath(); for (let x = -36; x <= 29; x += 2) { const y = lerp(6, T_SHELL(x), 0.5); x === -36 ? ctx.moveTo(x, -y) : ctx.lineTo(x, -y); } ctx.stroke();
    ctx.restore();
    shellPath(); stroke();
    // serrated rim plates
    for (let x = -36; x < 29; x += 5.4) { P([[x, 6], [x + 5.4, 6], [x + 4.6, 9.4], [x + 0.8, 9.4]]); ctx.fillStyle = C.shellLo; ctx.fill(); stroke(lw * 0.7); }
    P([[-38, 6], [-42, 4], [-36, 9]]); ctx.fillStyle = C.shellLo; ctx.fill(); stroke(lw * 0.7);
    // keel knobs along the top
    for (let x = -26; x <= 18; x += 7.3) { const y = T_SHELL(x); P([[x - 2.4, y - 1], [x - 0.6, y + 2.8], [x + 0.9, y + 2.8], [x + 2.6, y - 1]]); ctx.fillStyle = C.shellDeep; ctx.fill(); stroke(lw * 0.7); }
    for (const [x, r] of [[-14, 3.2], [4, 2.4]]) { const y = T_SHELL(x) - 0.6; ctx.beginPath(); ctx.ellipse(x, -y, r * 1.5, r * 0.55, 0, Math.PI, TAU); ctx.fillStyle = C.moss; ctx.fill(); stroke(lw * 0.6); }
    limb(-26, 8, 0, false); limb(18, 8, Math.PI, false);
  } catch (e) { /* art never breaks the frame */ }
  ctx.restore();
  if (o.stars > 0) dizzyStars(ctx, s * 0.36, -s * 0.32, s * 0.16, s * 0.05, t, { size: Math.max(3, s * 0.06), fade: o.stars });
}

// ================================================================= mosquitoes
export function drawMosquito(ctx, x, y, sz, t, o = {}) {
  const lw = Math.max(0.8, sz * 0.09), face = o.face || 1, fl = Math.sin(t * 70 + (o.seed || 0)) * 0.5 + 0.5;
  ctx.save();
  ctx.translate(x, y); ctx.scale(face, 1); ctx.rotate(o.tilt || 0);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // legs and the proboscis
  ctx.strokeStyle = '#1a120c'; ctx.lineWidth = Math.max(0.6, sz * 0.05);
  for (const [a, b] of [[-0.1, 0.55], [0.1, 0.62], [0.25, 0.5]]) { ctx.beginPath(); ctx.moveTo(sz * a, sz * 0.1); ctx.lineTo(sz * (a - 0.15), sz * b); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(sz * 0.42, 0); ctx.lineTo(sz * 0.85, sz * 0.18); ctx.stroke();
  // wings: smoky, flickering, dark-edged
  for (const k of [0, 1]) { ctx.save(); ctx.translate(-sz * 0.02, -sz * 0.12); ctx.rotate(-0.5 - k * 0.5 - fl * 0.5); ctx.beginPath(); ctx.ellipse(-sz * 0.3, 0, sz * 0.36, sz * 0.13, 0, 0, TAU); ctx.fillStyle = 'rgba(96,120,128,0.55)'; ctx.fill(); ctx.lineWidth = lw * 0.6; ctx.strokeStyle = '#2a2a2a'; ctx.stroke(); ctx.restore(); }
  // abdomen (striped, red when fed), thorax, head
  ctx.beginPath(); ctx.ellipse(-sz * 0.32, sz * 0.04, sz * 0.36, sz * (o.fed ? 0.17 : 0.12), 0.18, 0, TAU); ctx.fillStyle = o.fed ? '#c0302e' : '#8a5a2a'; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = '#120a06'; ctx.stroke();
  ctx.strokeStyle = o.fed ? '#ff8a5a' : '#f0c050'; ctx.lineWidth = Math.max(0.6, sz * 0.06);
  for (const d of [-0.5, -0.34, -0.18]) { ctx.beginPath(); ctx.moveTo(sz * d, -sz * 0.06); ctx.lineTo(sz * (d + 0.02), sz * 0.14); ctx.stroke(); }
  ctx.beginPath(); ctx.ellipse(sz * 0.08, 0, sz * 0.2, sz * 0.16, 0, 0, TAU); ctx.fillStyle = '#6a4220'; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = '#120a06'; ctx.stroke();
  ctx.beginPath(); ctx.arc(sz * 0.34, sz * 0.02, sz * 0.11, 0, TAU); ctx.fillStyle = '#6a4220'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(sz * 0.37, -sz * 0.01, sz * 0.05, 0, TAU); ctx.fillStyle = '#ff5a3a'; ctx.fill();
  ctx.restore();
}
// a swarm: n insects buzzing round (x, y) in a cloud of radius R px. o.tight 0..1 (pulls in onto an egg), o.spread 0..1 (scatter),
// o.fall 0..1 (stunned: they droop), o.fed
export function drawSwarm(ctx, x, y, R, t, o = {}) {
  const n = o.n || 5, sz = Math.max(7, R * 0.66), tight = o.tight || 0, spread = o.spread || 0, fall = o.fall || 0;
  ctx.save();
  // a faint dark haze so the cloud reads on light rings (never a pale halo)
  if (spread < 0.6) { const g = ctx.createRadialGradient(x, y, 0, x, y, R * 1.5); g.addColorStop(0, `rgba(30,20,10,${0.16 * (1 - spread)})`); g.addColorStop(1, 'rgba(30,20,10,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 1.5, 0, TAU); ctx.fill(); }
  for (let i = 0; i < n; i++) {
    const p = hash(i * 7.3 + (o.seed || 0)) * TAU, sp = 2.2 + hash(i * 3.1) * 2.6, rr = R * (0.45 + 0.55 * hash(i * 1.9)) * (1 - 0.55 * tight) * (1 + spread * 3.5);
    const a = p + t * sp * (i % 2 ? 1 : -1), jx = Math.sin(t * 23 + i * 5) * R * 0.06, jy = Math.cos(t * 19 + i * 3) * R * 0.06;
    let px = x + Math.cos(a) * rr + jx, py = y + Math.sin(a * 1.3) * rr * 0.7 + jy + fall * R * (0.6 + hash(i) * 0.8);
    if (tight > 0.5) py = Math.min(py, y + R * 0.15);
    ctx.globalAlpha = (1 - spread * spread) * (o.alpha ?? 1);
    drawMosquito(ctx, px, py, sz, t, { face: Math.cos(a) > 0 ? -1 : 1, seed: i, tilt: (hash(i * 2.2) - 0.5) * 0.6 + fall * 1.2, fed: o.fed && i % 3 === 0 });
  }
  ctx.restore();
}

// ================================================================= in game
const pxSpace = (ctx, x, y, k, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(1 / k, -1 / k); try { f(); } catch (e) { /* art never breaks the frame */ } ctx.restore(); };
const ANIM = new Map(); // per creature: eased face, gait, last position (render only)
function look(key, sim, x, y, face, t) {
  let A = ANIM.get(key);
  if (!A || A.sim !== sim) { A = { sim, f: face, g: 0, x, y, t, sp: 0 }; ANIM.set(key, A); }
  const dt = clamp(t - A.t, 0, 0.1), d = Math.hypot(x - A.x, y - A.y);
  A.g += d * 9; A.sp = lerp(A.sp, dt > 0 ? d / dt : 0, 0.2); A.f = lerp(A.f, face, 1 - Math.exp(-dt * 10)); A.x = x; A.y = y; A.t = t;
  return A;
}
// the creature's local frame (px, y down, +x = along the floor toward its head)
function frame(ctx, C, rad, k, f) {
  const a = C.a, c = Math.cos(a), s = Math.sin(a), x = rad * c, y = rad * s;
  pxSpace(ctx, x, y, k, () => { const tx = -s, ty = c, nx = -c, ny = -s; ctx.transform(tx, -ty, -nx, ny, 0, 0); f(); });
}
const want = (C) => (C.frz > 0 ? { k: 'ice', left: C.frz } : C.stn > 0 || C.zap > 0 ? { k: 'stun', zap: C.zap > 0, left: C.stn } : null);

export function drawBayou(ctx, sim, t, k) {
  if (!sim.gators) return;
  const B = sim.bx && sim.bx.boss;
  for (const G of sim.gators) {
    if (G.ph === 'hid' || G.ph === 'gone') continue;
    const rf = sim.byFloor(G.ch), A = look('g' + G.id, sim, G.x, G.y, G.face, t), len = GATOR.L * G.s * k, st = statusClock(sim, 'bg' + G.id, want(G), t);
    const atk = G.boss && B && B.atk, warnU = atk && atk.ph === 'warn' ? clamp(1 - atk.t / atk.dur, 0, 1) : 0;
    let jaw = 0, eye = 'open', tail = 0, alpha = 1, sink = 0;
    if (G.ph === 'log') eye = G.next > 0.6 ? 'shut' : 'half';
    if (G.ph === 'warn') { jaw = ss(0, 0.6, G.t / G.dur); eye = 'open'; }
    if (G.ph === 'after') jaw = G.t < 0.1 ? 1 - G.t / 0.1 : 0;
    if (G.ph === 'flee') eye = 'squint';
    if (G.ph === 'dizzy') { eye = 'spiral'; jaw = 0.3; }
    if (G.ph === 'hurt') { eye = 'squint'; jaw = 0.5; }
    if (G.ph === 'beaten') { eye = 'spiral'; alpha = 1 - ss(0.4, 1, G.t / G.dur); sink = ss(0.2, 1, G.t / G.dur) * 0.35 * G.s; }
    if (G.ph === 'in') alpha = ss(0, 1, G.t / G.dur);
    if (atk && atk.name === 'sweep') tail = atk.ph === 'warn' ? 0.95 * ss(0, 0.6, warnU) + Math.sin(t * 30) * 0.05 * warnU : -0.25;
    if (atk && atk.name === 'roll' && atk.ph === 'warn') { jaw = 0.9 * ss(0, 0.5, warnU); eye = 'open'; }
    const stun = st && (st.k === 'stun');
    if (stun) { eye = 'spiral'; jaw = 0.25; }
    const o = { jaw, eye, tail, boss: G.boss, baby: G.call && !G.boss, gait: A.g / Math.max(1, len) * 40, walk: clamp(A.sp / (0.15 * k), 0, 1), bend: rf * k, roll: G.roll > 0 ? 1 - G.roll / 0.9 : 0, sneeze: G.sneeze > 0 ? G.sneeze / 0.8 : 0, stars: G.ph === 'dizzy' || stun ? 1 : 0, alpha, id: G.id, look: 0.35 };
    // the telegraph: a red bite mark over the jaws while they open at an egg
    if (G.ph === 'warn') biteMark(ctx, sim.gJaw(G), t, k, ss(0, 1, G.t / G.dur), G.s);
    frame(ctx, G, rf + sink, k, () => {
      ctx.scale(A.f >= 0 ? 1 : -1, 1);
      if (Math.abs(A.f) < 0.999) ctx.scale(Math.max(0.15, Math.abs(A.f)), 1);
      const S = len, box = { x0: -S * 0.6, y0: -S * 0.4, x1: S * 0.6, y1: S * 0.08 };
      statusDraw(ctx, box, (c) => drawGator(c, S, st ? st.hold : t, o), st, { off: Math.max(1.1, S * 0.012), crys: Math.max(1, S / 90) });
    });
  }
  for (const T of sim.turtles) {
    const rf = sim.byFloor(T.ch), A = look('t' + T.id, sim, T.x, T.y, T.face, t), L = TURTLE.L * k, st = statusClock(sim, 'bt' + T.id, want(T), t);
    const flipU = T.ph === 'flip' ? ss(0, 0.25, T.t) : T.ph === 'right' ? 1 - ss(0, 1, T.t / T.dur) : 0;
    const o = { head: T.ph === 'warn' ? -0.9 : T.ph === 'clamp' ? 0.75 : 0, mouth: T.ph === 'warn' ? ss(0, 1, T.t / Math.max(0.01, T.dur)) : 0, gait: A.g / Math.max(1, L) * 30, walk: clamp(A.sp / (0.08 * k), 0, 1), flip: flipU, flail: 1, shell: T.ph === 'shell' ? 1 - ss(0.75, 1, T.t / T.dur) : 0, eye: st && st.k === 'stun' ? 'spiral' : T.ph === 'flip' ? 'spiral' : undefined, glare: T.ph === 'warn' || T.ph === 'clamp', stars: (st && st.k === 'stun') || (T.ph === 'flip' && T.t > 0.3) ? 1 : 0 };
    frame(ctx, T, rf, k, () => {
      ctx.scale(A.f >= 0 ? 1 : -1, 1);
      const box = { x0: -L * 0.62, y0: -L * 0.5, x1: L * 0.7, y1: L * 0.1 };
      statusDraw(ctx, box, (c) => drawTurtle(c, L, st ? st.hold : t, o), st, { off: Math.max(1, L * 0.02), crys: Math.max(1, L / 60) });
    });
  }
}
// over the eggs: the turtle's beak round a clamped egg, the swarms
export function drawBayouOver(ctx, sim, t, k) {
  if (!sim.gators) return;
  for (const T of sim.turtles) {
    if (!T.eid || T.ph !== 'clamp') continue;
    const rf = sim.byFloor(T.ch), A = ANIM.get('t' + T.id), L = TURTLE.L * k;
    frame(ctx, T, rf, k, () => {
      ctx.scale(A && A.f < 0 ? -1 : 1, 1);
      ctx.save(); ctx.beginPath(); ctx.rect(L * 0.35, -L * 0.4, L * 0.4, L * 0.4); ctx.clip();
      drawTurtle(ctx, L, t, { head: 0.75, glare: 1 });
      ctx.restore();
    });
  }
  for (const Q of sim.mosqs) {
    if (Q.ph === 'hid') continue;
    const st = statusClock(sim, 'bq' + Q.id, Q.frz > 0 ? { k: 'ice', left: Q.frz } : null, t);
    const R = 0.5 * k, spread = Q.ph === 'scatter' ? ss(0, 0.8, Q.t) : 0, tight = Q.ph === 'latch' || Q.ph === 'lift' ? 1 : Q.ph === 'hunt' ? 0.3 : 0;
    if (Q.ph === 'scatter' && Q.t > 0.9) continue;
    pxSpace(ctx, Q.x, Q.y, k, () => {
      const o = { tight, spread, fall: Q.stn > 0 ? 1 : 0, fed: Q.ph === 'lift', seed: Q.id * 13 };
      statusDraw(ctx, { x0: -R * 2, y0: -R * 2, x1: R * 2, y1: R * 2 }, (c) => drawSwarm(c, 0, 0, R, st ? st.hold : t, o), st, { quick: true, off: 0.8, crys: 0.6 });
      if (Q.stn > 0) dizzyStars(ctx, 0, -R * 1.2, R * 0.9, R * 0.25, t, { size: Math.max(2.6, R * 0.22) });
      if (Q.ph === 'lift') liftMark(ctx, R, t);
    });
  }
}
// a red bite mark: two jaw arcs that close in as the snap nears (the snap zone)
function biteMark(ctx, J, t, k, u, s) {
  const r = (0.42 + 0.12 * (1 - u)) * Math.sqrt(s) * k, pulse = 0.75 + 0.25 * Math.sin(t * 16);
  pxSpace(ctx, J.x, J.y, k, () => {
    ctx.save(); ctx.lineCap = 'round';
    for (const [w, col] of [[Math.max(3.4, r * 0.2), '#3a0808'], [Math.max(1.8, r * 0.1), `rgba(255,${80 + 60 * pulse | 0},60,1)`]]) {
      ctx.lineWidth = w; ctx.strokeStyle = col;
      for (const d of [-1, 1]) { ctx.beginPath(); ctx.arc(0, d * r * 0.25 * (1 - u), r, d < 0 ? Math.PI * 1.15 : Math.PI * 0.15, d < 0 ? Math.PI * 1.85 : Math.PI * 0.85); ctx.stroke(); }
      for (let i = -2; i <= 2; i++) for (const d of [-1, 1]) { const x = i * r * 0.32; ctx.beginPath(); ctx.moveTo(x, d * r * 0.55 * (1 - u * 0.7)); ctx.lineTo(x, d * r * 0.3 * (1 - u * 0.7)); ctx.stroke(); }
    }
    ctx.restore();
  });
}
function liftMark(ctx, R, t) {
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    const y = -R * 1.3 - ((t * 1.4 + i * 0.5) % 1) * R * 0.9, a = 1 - ((t * 1.4 + i * 0.5) % 1);
    ctx.globalAlpha = a;
    for (const [w, col] of [[3.2, '#2a1a08'], [1.6, '#ffcf5a']]) { ctx.lineWidth = w; ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(-R * 0.35, y + R * 0.25); ctx.lineTo(0, y); ctx.lineTo(R * 0.35, y + R * 0.25); ctx.stroke(); }
  }
  ctx.restore();
}

// ================================================================= events (popups, sound, particles)
export function bayouEvent(ev, fx, api) {
  const { popup, audio, once } = api;
  switch (ev.type) {
    case 'gatorWarn': audio.play('squish', { vol: 0.7, pitch: 0.45 }); once('gator', 'A gator! Its jaws open under a gap: turn that gap away.'); break;
    case 'gatorSnap':
      audio.play('steel_clang', { vol: ev.hit ? 0.8 : 0.5, pitch: ev.boss ? 0.4 : 0.7 });
      fx.shake = Math.max(fx.shake, ev.hit ? 0.3 : 0.12);
      popup(ev.x, ev.y + 0.55, ev.decoy ? 'Wood!' : ev.stone ? 'Clonk!' : ev.hit ? 'Chomp!' : 'Missed!', { color: ev.hit ? '#ff8a6a' : '#e8f4c8', size: 20, life: 0.9 });
      break;
    case 'gatorFlee': if (ev.why === 'pepper') { audio.play('bubble_on', { vol: 0.6, pitch: 1.6 }); popup(ev.x, ev.y + 0.6, 'Achoo!', { color: '#ffb07a', size: 20, life: 0.9 }); } break;
    case 'gatorDizzy': once('gdizzy', 'He is dizzy! Drop an egg on him, or hit him with pepper or the laser.'); break;
    case 'gatorHit':
      audio.play('egg_bump', { vol: 0.9, pitch: 0.5 }); audio.play('steel_clang', { vol: 0.6, pitch: 1.4 });
      fx.shake = Math.max(fx.shake, 0.4);
      fx.chips(ev.x, ev.y + 0.2, '#fff1cc', 6, 2.2); // a tooth flies
      popup(ev.x, ev.y + 0.7, ev.hp > 0 ? `Ouch! ${ev.hp} left` : 'Beaten!', { color: '#fff2a8', size: 22, life: 1.2 });
      break;
    case 'gatorBeaten': audio.play('unlock', { vol: 0.8, pitch: 0.8 }); break;
    case 'gatorIn': audio.play('splash', { vol: 0.6, pitch: 0.8 }); fx.dust(ev.x, ev.y, 6); break;
    case 'turtleClamp': audio.play('steel_clang', { vol: 0.5, pitch: 1.1 }); popup(ev.x, ev.y + 0.5, 'Clamped!', { color: '#e8e2a0', size: 18, life: 0.9 }); once('turtle', 'The turtle holds your egg: it is safe, but stuck. Drop an egg on its shell to flip it.'); break;
    case 'turtleFlip': audio.play('rock_hit', { vol: 0.7, pitch: 1.2 }); popup(ev.x, ev.y + 0.6, 'Flipped!', { color: '#ffe08a', size: 20, life: 0.9 }); break;
    case 'mosqLatch': audio.play('wind_gust', { vol: 0.3, pitch: 2.6 }); once('mosq', 'Mosquitoes lift eggs up. A flame or pepper scatters them.'); break;
    case 'mosqLift': popup(ev.x, ev.y + 0.4, 'Bzzz!', { color: '#ffd76a', size: 16, life: 0.8 }); break;
    case 'mosqScatter': audio.play('wind_gust', { vol: 0.35, pitch: 2.2 }); if (ev.why !== 'stone') popup(ev.x, ev.y + 0.4, 'Shoo!', { color: '#e8f4c8', size: 16, life: 0.8 }); break;
  }
}

// ================================================================= the boss card and the boss bar emblem (screen space, y down)
export function drawGatorCard(ctx, x, y, w, h, t, age) {
  const H0 = Math.min(h, w * 1.3), W0 = H0 / 1.3, pad = Math.max(2, H0 * 0.025);
  const e = age == null ? 1 : clamp(age / 0.45, 0, 1), pop = e < 1 ? 0.6 + 0.4 * (1 - Math.pow(1 - e, 3)) + Math.sin(e * Math.PI) * 0.08 : 1;
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
  g.addColorStop(0, '#2a1a44'); g.addColorStop(0.45, '#8a3a5a'); g.addColorStop(0.62, '#e08a4a'); g.addColorStop(0.63, '#2f4a3a'); g.addColorStop(1, '#16281e');
  ctx.fillStyle = g; ctx.fillRect(cx - dw / 2, cy - dh / 2, dw, dh);
  // a low sun and cypress silhouettes
  ctx.fillStyle = '#ffcf7a'; ctx.beginPath(); ctx.arc(cx + dw * 0.18, cy + dh * 0.12, dw * 0.13, Math.PI, TAU); ctx.fill();
  ctx.fillStyle = '#1a1424';
  for (const [fx, fh] of [[-0.4, 0.42], [-0.28, 0.3], [0.38, 0.46]]) { const bx = cx + dw * fx, by = cy + dh * 0.13; ctx.fillRect(bx - dw * 0.012, by - dh * fh, dw * 0.024, dh * fh); ctx.beginPath(); ctx.moveTo(bx - dw * 0.06, by); ctx.lineTo(bx, by - dh * fh * 0.25); ctx.lineTo(bx + dw * 0.06, by); ctx.fill(); ctx.beginPath(); ctx.ellipse(bx, by - dh * fh, dw * 0.07, dh * 0.05, 0, 0, TAU); ctx.fill(); }
  // water lines and lily pads
  const wy = cy + dh * 0.13;
  ctx.strokeStyle = 'rgba(160,200,160,0.35)'; ctx.lineWidth = Math.max(1, dw * 0.008);
  for (let i = 0; i < 4; i++) { const yy = wy + dh * (0.06 + i * 0.07); ctx.beginPath(); ctx.moveTo(cx - dw * 0.45, yy); ctx.lineTo(cx - dw * 0.1 + i * dw * 0.08, yy); ctx.stroke(); }
  for (const [px, pr] of [[-0.36, 0.07], [0.34, 0.06]]) { ctx.fillStyle = '#3f8a34'; ctx.beginPath(); ctx.ellipse(cx + dw * px, wy + dh * 0.3, dw * pr, dw * pr * 0.32, 0, 0.3, TAU - 0.1); ctx.lineTo(cx + dw * px, wy + dh * 0.3); ctx.fill(); }
  // Grandpa, lying in the water, jaws a little open
  ctx.save(); ctx.translate(cx - dw * 0.02, wy + dh * 0.2);
  drawGator(ctx, dw * 0.98, t, { boss: 1, jaw: 0.35 + 0.1 * Math.sin(t * 1.5), eye: 'open', look: -0.6, tail: 0.15 * Math.sin(t * 1.2) });
  ctx.restore();
  ctx.restore();
  ctx.restore();
  return true;
}
export function drawGatorEmblem(ctx, r, t) {
  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.94, 0, TAU); ctx.clip();
  ctx.translate(-r * 1.6, r * 0.72);
  drawGator(ctx, r * 4.2, t, { boss: 1, jaw: 0.45, eye: 'open', look: -0.4 });
  ctx.restore();
}
