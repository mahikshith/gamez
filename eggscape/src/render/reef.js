// Coral Reef (world 8) drawing: the hermit crab, the pufferfish, the jellyfish, the King Crab's silt cloud, and the
// underwater goal (the water surface, the hen's boat and the basket hanging under it, bubbles rising with the eggs).
// Crisp cel-shaded code art in the house style: dark outline, two-tone shading, no pale rims or halos. ctx is in world
// space (m, y up); each creature is drawn in a local y-DOWN px space (pxSpace). Frozen / stunned looks: render/status.js.
import { RING_TH, TAU, EGG_H, EGG_W } from '../sim/geom.js';
import { HERMIT, PUFF, JELLY } from '../sim/reef.js';
import { statusClock, statusDraw, dizzyStars, spiralEye, boltStroke } from './status.js';
import { drawKingCrab, drawKingOver, iceShards } from './kingcrab.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
const hash = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const pxSpace = (ctx, x, y, k, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(1 / k, -1 / k); try { f(); } catch (e) { if (!pxSpace.w) { pxSpace.w = 1; console.warn('reef art', e); } } ctx.restore(); };
const fillStroke = (ctx, fill, line, lw) => { ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = line; ctx.stroke(); };

// ---------------------------------------------------------------- palettes
export const HC = { line: '#1c0f06', shell: '#9a52d6', shellLo: '#64289c', shellHi: '#b672e6', band: '#3a1260', mouth: '#24082e', body: '#ffb21f', bodyLo: '#d8700c', bodyHi: '#ffd75a', eye: '#1a0a06', white: '#fff4da', leg: '#f59a12' };
const HCP = HC;
// frozen looks: the King Crab's ice palette (render/kingcrab.js KCI) and its ice shards, no white glow
export const HCI = { line: '#12324a', shell: '#8fd0ee', shellLo: '#4f97c4', shellHi: '#b8e2f4', band: '#3f80ac', mouth: '#1d4a6a', body: '#8fd0ee', bodyLo: '#4f97c4', bodyHi: '#b8e2f4', eye: '#0c2234', white: '#d8eef8', leg: '#6fb4dc' };
export const PF = { line: '#2a1a06', body: '#f3c63f', lo: '#c4901f', belly: '#fbe7a1', spot: '#8a5418', fin: '#f09a2a', spine: '#5a3a10', spineF: '#d9a53a', eye: '#1a1006', white: '#fff8e6', mouth: '#c4562a' };
const PFP = PF;
export const JF = { line: '#3d0f4f', bell: '#d57ad8', bellLo: '#9e3fae', bellHi: '#f2b6ee', core: '#ffd66a', arm: '#b04cc4', tent: '#8e3aa6', sting: '#fff17a' };
const JFP = JF;
export const PFI = { line: '#12324a', body: '#8fd0ee', lo: '#4f97c4', belly: '#b8e2f4', spot: '#3f80ac', fin: '#6fb4dc', spine: '#1d4a6a', spineF: '#7cc0e4', eye: '#0c2234', white: '#d8eef8', mouth: '#3f80ac' };
export const JFI = { line: '#12324a', bell: '#8fd0ee', bellLo: '#4f97c4', bellHi: '#b8e2f4', core: '#d8eef8', arm: '#6fb4dc', tent: '#4f97c4', sting: '#fff17a' };
export const HERMIT_ART = 1.55; // the hermit is drawn this much bigger than its old 1 px-per-m art (body clearly bigger than an egg)
export const JELLY_ART = 1.3;

// ---------------------------------------------------------------- hermit crab
// (x, y) = the point on the floor under it, s = px per metre. Local frame: +x = its facing, -y = up (away from the floor).
// o: { face, walk (odometer m), pose 'walk'|'pinch'|'carry'|'flip'|'in', u (0..1 through the pose), egg (bool: an egg
//      tucked in its shell, drawn by the game between the 'back' and 'front' parts), part 'back'|'front'|'all', stun,
//      zap, alpha }
export function drawHermit(ctx, x, y, s, t, o = {}) {
  const face = o.face || 1, pose = o.pose || 'walk', u = o.u ?? 0, lw = Math.max(1.5, s * 0.04), part = o.part || 'all', HC = o.ice ? HCI : HCP;
  const flip = pose === 'flip';
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha *= o.alpha ?? 1;
  if (pose === 'in') { const k = sstep(u); ctx.translate(0, (1 - k) * 0.2 * s); ctx.scale(0.4 + 0.6 * k, 0.4 + 0.6 * k); }
  ctx.scale(face, 1);
  if (flip) { ctx.translate(0, -0.3 * s); ctx.rotate(Math.PI + Math.sin(t * 9) * 0.12); ctx.translate(0, 0.3 * s); } // on its back, in place
  const ph = (o.walk || 0) / 0.07, bob = pose === 'walk' || pose === 'carry' ? Math.abs(Math.sin(ph)) * 0.015 * s : 0;
  ctx.translate(0, -bob);
  const sh = { x: -0.12 * s, y: -0.27 * s, r: 0.3 * s }; // a low, long conch (it must fit a 1 m channel at 1.55x)
  if (part !== 'front') {
    // walking legs: three a side, tips on the floor, stepping in a ripple (flipped: they flail in the air)
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < 3; i++) {
      for (const side of [-1, 1]) {
        const q = ph + i * 2.1 + (side > 0 ? Math.PI : 0), lift = flip ? Math.sin(t * 14 + i * 2 + side) * 0.06 : Math.max(0, Math.sin(q)) * 0.06;
        const hx = (0.05 + i * 0.07) * s, hy = -0.17 * s, kx = hx + (0.08 + 0.03 * i) * s * side * 0.5 + 0.04 * s, ky = -0.24 * s - lift * s;
        const fx = hx + (0.1 + 0.05 * i) * s * (side > 0 ? 1 : 0.5) + Math.cos(q) * 0.03 * s, fy = -lift * s * 0.6;
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy);
        ctx.strokeStyle = HC.line; ctx.lineWidth = lw * 2.6; ctx.stroke();
        ctx.strokeStyle = side > 0 ? HC.leg : HC.bodyLo; ctx.lineWidth = lw * 1.3; ctx.stroke();
      }
    }
    // the shell: a fat spiral conch, mouth toward the front
    ctx.save();
    ctx.translate(sh.x, sh.y); ctx.rotate(-0.18); ctx.scale(1, 0.78);
    const conch = () => {
    ctx.beginPath();
    ctx.moveTo(sh.r * 0.95, sh.r * 0.35);
    ctx.bezierCurveTo(sh.r * 1.05, -sh.r * 0.7, sh.r * 0.2, -sh.r * 1.15, -sh.r * 0.5, -sh.r * 0.85);
    ctx.quadraticCurveTo(-sh.r * 1.35, -sh.r * 0.85, -sh.r * 1.5, -sh.r * 0.2); // the spire
    ctx.quadraticCurveTo(-sh.r * 1.05, -sh.r * 0.15, -sh.r * 1.0, sh.r * 0.3);
    ctx.bezierCurveTo(-sh.r * 0.9, sh.r * 1.0, sh.r * 0.6, sh.r * 1.05, sh.r * 0.95, sh.r * 0.35);
    ctx.closePath();
    };
    conch();
    ctx.fillStyle = HC.shell; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = HC.shellLo; ctx.beginPath(); ctx.ellipse(0, sh.r * 0.75, sh.r * 1.6, sh.r * 0.6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = HC.shellHi; ctx.beginPath(); ctx.ellipse(sh.r * 0.05, -sh.r * 0.42, sh.r * 0.4, sh.r * 0.14, -0.2, 0, TAU); ctx.fill();
    // spiral bands
    ctx.strokeStyle = HC.band; ctx.lineWidth = lw * 1.1;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) { const a = i * 0.32, rr = sh.r * (0.95 - i * 0.021); const px = -sh.r * 0.35 + Math.cos(a) * rr * 0.9, py = Math.sin(a) * rr * 0.8; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
    ctx.stroke();
    ctx.restore();
    conch(); ctx.lineWidth = lw * 1.2; ctx.strokeStyle = HC.line; ctx.stroke();
    // the dark mouth of the shell
    ctx.beginPath(); ctx.ellipse(sh.r * 0.72, sh.r * 0.25, sh.r * 0.3, sh.r * 0.55, 0.25, 0, TAU);
    fillStroke(ctx, HC.mouth, HC.line, lw);
    ctx.restore();
  }
  if (part !== 'back') {
    // the crab's front: carapace out of the shell mouth, eye stalks, two claws (the right one big)
    const cx = 0.16 * s, cy = -0.2 * s;
    ctx.beginPath(); ctx.ellipse(cx, cy, 0.16 * s, 0.11 * s, -0.2, 0, TAU);
    ctx.fillStyle = HC.body; ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = HC.bodyLo; ctx.beginPath(); ctx.ellipse(cx, cy + 0.07 * s, 0.16 * s, 0.06 * s, 0, 0, TAU); ctx.fill(); ctx.fillStyle = HC.bodyHi; ctx.beginPath(); ctx.ellipse(cx - 0.02 * s, cy - 0.05 * s, 0.06 * s, 0.022 * s, -0.2, 0, TAU); ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.ellipse(cx, cy, 0.16 * s, 0.11 * s, -0.2, 0, TAU); ctx.lineWidth = lw; ctx.strokeStyle = HC.line; ctx.stroke();
    // eye stalks, eyes on the egg / ahead
    const lean = pose === 'pinch' ? -0.25 : 0;
    for (const [ex, len] of [[0.13, 0.15], [0.22, 0.13]]) {
      const bx = ex * s, by = cy - 0.05 * s, tx = bx + Math.sin(lean + Math.sin(t * 2 + ex * 20) * 0.08) * len * s, ty = by - len * s;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.strokeStyle = HC.line; ctx.lineWidth = lw * 2.2; ctx.stroke(); ctx.strokeStyle = HC.body; ctx.lineWidth = lw; ctx.stroke();
      ctx.beginPath(); ctx.arc(tx, ty, 0.04 * s, 0, TAU); fillStroke(ctx, HC.white, HC.line, lw * 0.8);
      if (o.stun) spiralEye(ctx, tx, ty, 0.032 * s, t, ex > 0.15 ? 1 : -1, HC.line);
      else { ctx.fillStyle = HC.eye; ctx.beginPath(); ctx.arc(tx + 0.012 * s, ty + 0.004 * s, 0.022 * s, 0, TAU); ctx.fill(); }
      if (pose === 'pinch' && !o.stun) { ctx.strokeStyle = HC.line; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(tx - 0.05 * s, ty - 0.06 * s); ctx.lineTo(tx + 0.04 * s, ty - 0.035 * s); ctx.stroke(); } // a mean brow
    }
    // claws: raised and snapping in the telegraph, hugging the egg when it carries one
    const snapK = pose === 'pinch' ? 0.5 + 0.5 * Math.sin(t * 22) : pose === 'carry' ? 0.1 : 0.35 + 0.15 * Math.sin(t * 3);
    const raise = pose === 'pinch' ? 0.6 + 0.4 * sstep(u * 2) : pose === 'carry' ? 0.15 : flip ? 0.4 : 0;
    claw(ctx, HC, 0.2 * s, -0.17 * s, 0.13 * s * 0.85, -0.5 - raise * 1.0, snapK, lw);
    claw(ctx, HC, 0.25 * s, -0.12 * s, 0.13 * s * 1.15, -0.15 - raise * 0.8, snapK, lw);
  }
  ctx.restore();
}
function claw(ctx, HC, x, y, L, ang, open, lw) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L * 0.8, 0); ctx.strokeStyle = HC.line; ctx.lineWidth = lw * 2.8; ctx.stroke(); ctx.strokeStyle = HC.body; ctx.lineWidth = lw * 1.4; ctx.stroke();
  ctx.translate(L * 0.85, 0);
  const a = 0.15 + open * 0.55;
  for (const [sgn, w] of [[-1, 1], [1, 0.8]]) {
    ctx.save(); ctx.rotate(sgn * a * (sgn < 0 ? 1 : 0.6));
    ctx.beginPath(); ctx.moveTo(-L * 0.12, 0); ctx.quadraticCurveTo(L * 0.3, sgn * L * 0.35 * w, L * 0.75, sgn * L * 0.04); ctx.quadraticCurveTo(L * 0.3, sgn * L * 0.06, -L * 0.12, sgn * L * 0.05);
    ctx.closePath();
    fillStroke(ctx, sgn < 0 ? HC.body : HC.bodyLo, HC.line, lw);
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- pufferfish
// (x, y) its centre, s px per metre, sw 0..1 (0 = a small fish, 1 = a spiky ball), face +-1, ang = heading (screen rad)
export function drawPuffer(ctx, x, y, s, t, o = {}) {
  const sw = sstep(o.sw ?? 0), face = o.face || 1, lw = Math.max(1.2, s * 0.03), PF = o.ice ? PFI : PFP;
  const rx = (0.26 + 0.16 * sw) * s * (o.squash ? 1 + o.squash * 0.15 : 1), ry = (0.16 + 0.26 * sw) * s * (o.squash ? 1 - o.squash * 0.15 : 1);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((o.ang || 0) * (1 - sw));
  ctx.scale(face, o.belly ? -1 : 1);
  ctx.globalAlpha *= o.alpha ?? 1;
  const wob = Math.sin(t * 9) * 0.3;
  // tail and fins
  ctx.save(); ctx.translate(-rx * 0.95, 0); ctx.rotate(wob * (1 - sw * 0.5));
  ctx.beginPath(); ctx.moveTo(0.02 * s, 0); ctx.lineTo(-0.14 * s, -0.09 * s); ctx.quadraticCurveTo(-0.1 * s, 0, -0.14 * s, 0.09 * s); ctx.closePath();
  fillStroke(ctx, PF.fin, PF.line, lw); ctx.restore();
  ctx.save(); ctx.translate(rx * 0.1, ry * 0.55); ctx.rotate(0.6 + Math.sin(t * 11) * 0.35);
  ctx.beginPath(); ctx.ellipse(0.05 * s, 0, 0.06 * s, 0.03 * s, 0, 0, TAU); fillStroke(ctx, PF.fin, PF.line, lw * 0.9); ctx.restore();
  // spines: they stand up as it swells
  if (sw > 0.05) {
    const n = 18, L = 0.15 * s * sw;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + 0.1, bx = Math.cos(a) * rx * 0.95, by = Math.sin(a) * ry * 0.95, nx = Math.cos(a), ny = Math.sin(a) * (rx / ry) * 0.6;
      const nn = Math.hypot(nx, ny) || 1, tx = bx + (nx / nn) * L, ty = by + (ny / nn) * L, px = -ny / nn * 0.03 * s, py = nx / nn * 0.03 * s;
      ctx.beginPath(); ctx.moveTo(bx + px, by + py); ctx.lineTo(tx, ty); ctx.lineTo(bx - px, by - py); ctx.closePath();
      fillStroke(ctx, PF.spineF, PF.line, lw * 0.8);
    }
  }
  // body
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
  ctx.fillStyle = PF.body; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = PF.belly; ctx.beginPath(); ctx.ellipse(rx * 0.1, ry * 0.75, rx * 0.95, ry * 0.55, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = PF.lo; ctx.beginPath(); ctx.ellipse(-rx * 0.35, ry * 0.2, rx * 0.5, ry * 0.9, 0, -Math.PI / 2, Math.PI / 2, true); ctx.fill();
  ctx.fillStyle = PF.spot;
  for (let i = 0; i < 7; i++) { const a = -2.6 + i * 0.42, d = 0.6; ctx.beginPath(); ctx.arc(Math.cos(a) * rx * d, Math.sin(a) * ry * d * 0.9, 0.022 * s * (1 + sw * 0.5), 0, TAU); ctx.fill(); }
  ctx.restore();
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.lineWidth = lw; ctx.strokeStyle = PF.line; ctx.stroke();
  // face: big eyes (cross when it is swollen), a puckered mouth
  const ex = rx * 0.5, ey = -ry * 0.3, er = (0.06 + 0.02 * sw) * s;
  ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); fillStroke(ctx, PF.white, PF.line, lw * 0.9);
  if (o.stun) spiralEye(ctx, ex, ey, er * 0.8, t, 1, PF.line);
  else { ctx.fillStyle = PF.eye; ctx.beginPath(); ctx.arc(ex + er * 0.25, ey + er * 0.1, er * 0.5, 0, TAU); ctx.fill(); }
  if (sw > 0.5 && !o.stun) { ctx.strokeStyle = PF.line; ctx.lineWidth = lw * 1.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ex - er * 1.1, ey - er * 1.5); ctx.lineTo(ex + er * 0.9, ey - er * 1.0); ctx.stroke(); }
  ctx.beginPath(); ctx.ellipse(rx * 0.97, ry * 0.12, 0.03 * s, (0.025 + 0.015 * sw) * s, 0, 0, TAU); fillStroke(ctx, PF.mouth, PF.line, lw * 0.8);
  ctx.restore();
}

// ---------------------------------------------------------------- jellyfish
// (x, y) the bell's centre, s px per metre, o: { pulse 0..1 (contraction), sting 0..1 (the tentacles crackle), glow, stun }
export function drawJelly(ctx, x, y, s, t, o = {}) {
  const r = 0.32 * s, c = o.pulse ?? 0.5 + 0.5 * Math.sin(t * 3.4), lw = Math.max(1.2, s * 0.028), JF = o.ice ? JFI : JFP;
  const bw = r * (1 + 0.12 * c), bh = r * (0.82 - 0.16 * c);
  ctx.save();
  ctx.translate(x, y + (o.stun ? Math.sin(t * 2) * 0.02 * s : 0));
  ctx.rotate(o.stun ? Math.sin(t * 1.3) * 0.25 : Math.sin(t * 0.9) * 0.06);
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // trailing tentacles (they lag the bell's pulse); they crackle yellow when it stings
  for (let i = 0; i < 6; i++) {
    const x0 = (-0.75 + i * 0.3) * bw, len = (0.55 + 0.2 * hash(i + 3)) * s * (o.stun ? 0.8 : 1);
    ctx.beginPath(); ctx.moveTo(x0, bh * 0.15);
    for (let j = 1; j <= 8; j++) { const q = j / 8; ctx.lineTo(x0 * (1 - 0.25 * q) + Math.sin(t * 3 - q * 5 + i) * 0.05 * s * q, bh * 0.15 + q * len); }
    ctx.strokeStyle = JF.line; ctx.lineWidth = lw * 1.9; ctx.stroke();
    ctx.strokeStyle = o.sting > 0 ? JF.sting : JF.tent; ctx.lineWidth = lw * 0.9; ctx.stroke();
  }
  // frilly oral arms
  for (const sx of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(sx * bw * 0.18, bh * 0.1);
    for (let j = 1; j <= 6; j++) { const q = j / 6; ctx.lineTo(sx * (bw * 0.18 + Math.sin(t * 2.4 + q * 4 + sx) * 0.06 * s), bh * 0.1 + q * 0.42 * s); }
    ctx.strokeStyle = JF.line; ctx.lineWidth = lw * 4.2; ctx.stroke();
    ctx.strokeStyle = JF.arm; ctx.lineWidth = lw * 2.4; ctx.stroke();
  }
  // the bell
  ctx.beginPath();
  ctx.moveTo(-bw, bh * 0.2);
  ctx.bezierCurveTo(-bw * 1.02, -bh * 1.25, bw * 1.02, -bh * 1.25, bw, bh * 0.2);
  for (let i = 0; i <= 8; i++) { const q = i / 8; ctx.lineTo(bw - q * 2 * bw, bh * 0.2 + (i % 2 ? 0.05 * s : 0)); } // scalloped rim
  ctx.closePath();
  ctx.fillStyle = JF.bell; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = JF.bellLo; ctx.beginPath(); ctx.ellipse(0, bh * 0.35, bw * 1.1, bh * 0.45, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = JF.bellHi; ctx.beginPath(); ctx.ellipse(-bw * 0.35, -bh * 0.55, bw * 0.28, bh * 0.16, -0.4, 0, TAU); ctx.fill();
  // its glowing heart (four petals), dimmed when it is stunned
  ctx.fillStyle = o.stun && !o.ice ? '#b88a4a' : JF.core;
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.4; ctx.beginPath(); ctx.ellipse(Math.cos(a) * bw * 0.22, -bh * 0.3 + Math.sin(a) * bh * 0.18, bw * 0.13, bh * 0.09, a, 0, TAU); ctx.fill(); }
  ctx.restore();
  ctx.lineWidth = lw; ctx.strokeStyle = JF.line; ctx.stroke();
  // a little face
  const fy = -bh * 0.02;
  if (o.stun) { spiralEye(ctx, -bw * 0.3, fy, 0.04 * s, t, 1, JF.line); spiralEye(ctx, bw * 0.3, fy, 0.04 * s, t, -1, JF.line); }
  else { ctx.fillStyle = JF.line; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * bw * 0.3, fy, 0.028 * s, 0.038 * s, 0, 0, TAU); ctx.fill(); } }
  if (o.sting > 0) { ctx.strokeStyle = JF.line; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(-bw * 0.15, fy + 0.07 * s); ctx.lineTo(0, fy + 0.04 * s); ctx.lineTo(bw * 0.15, fy + 0.07 * s); ctx.stroke(); }
  ctx.restore();
  // the sting: crisp little arcs on the tentacle tips
  if (o.sting > 0) {
    ctx.save(); ctx.translate(x, y);
    for (let i = 0; i < 3; i++) {
      const bx = (-0.4 + i * 0.4) * bw, by = bh * 0.2 + 0.5 * s;
      ctx.beginPath(); ctx.moveTo(bx - 0.06 * s, by); ctx.lineTo(bx - 0.01 * s, by + 0.05 * s); ctx.lineTo(bx + 0.02 * s, by - 0.02 * s); ctx.lineTo(bx + 0.07 * s, by + 0.04 * s);
      boltStroke(ctx, Math.max(1, s * 0.012), o.sting);
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- in game
const RA = new Map(); // per-creature render memory (held poses for the ice, the sting flash)
const mem = (sim, key, t) => { let R = RA.get(key); if (!R || R.sim !== sim || t < R.t - 0.5) { R = { sim, t, sting: 0, pose: null }; RA.set(key, R); } R.dt = clamp(t - R.t, 0, 0.1); R.t = t; return R; };
const wantOf = (c) => (c.fz > 0 ? { k: 'ice', left: c.fz } : c.stn > 0 || c.zp > 0 ? { k: 'stun', zap: c.zp > 0, left: c.stn } : null);

function hermitFrame(sim, H, t, k) {
  const fl = sim.reefFloor(H.ch), x = fl * Math.cos(H.a), y = fl * Math.sin(H.a);
  const rot = Math.atan2(Math.cos(H.a), -Math.sin(H.a)); // after ctx.rotate(-rot) in the y-down px space, local -y (up) points to the vault centre
  const pose = H.ph === 'flip' ? 'flip' : H.ph === 'pinch' ? 'pinch' : H.ph === 'carry' ? 'carry' : H.ph === 'in' ? 'in' : 'walk';
  const u = H.dur > 0 ? clamp(1 - H.t / H.dur, 0, 1) : 0;
  // the face flips so it always reads upright on screen (as the thieves do): +x along the floor
  const sx = -Math.sin(H.a) * H.face; // screen x direction of its facing (rough)
  void sx;
  return { x, y, rot, o: { face: H.face, walk: H.odo, pose, u, stun: H.ph === 'flip' && H.k !== 'sting' ? 1 : H.zp > 0 ? 1 : 0, alpha: 1 } };
}
// the frozen look: the creature in the ice palette with crisp shards stuck on it (as the King Crab), shaking as it cracks;
// shards drop off as it thaws. A zap keeps status.js's arcs. sh = { x, y, r, seed }: where the shards sit (local px).
function withStatus(ctx, st, box, k, sh, draw, shards = true) {
  if (st && st.k === 'ice') {
    const q = st.crack > 0 ? Math.sin(st.age * 60) * st.crack * 0.025 * k : 0;
    ctx.save(); ctx.translate(q, 0);
    draw(ctx, true);
    if (shards) iceShards(ctx, k, sh.x, sh.y, sh.r, sh.seed);
    ctx.restore();
    return;
  }
  if (st && st.k === 'stun') { statusDraw(ctx, box, (c) => draw(c, false), st, { off: Math.max(1, 0.03 * k), crys: Math.max(0.8, k / 40) }); return; }
  draw(ctx, false);
  if (st && st.k === 'thaw' && shards) {
    const u = clamp(st.age / 0.9, 0, 1);
    ctx.save(); ctx.globalAlpha *= 1 - u; ctx.translate(0, u * u * 0.5 * k); iceShards(ctx, k * (1 - 0.3 * u), sh.x, sh.y, sh.r * (1 + 0.6 * u), sh.seed); ctx.restore();
  }
}
function drawHermitAt(ctx, sim, H, t, k, part) {
  const F = hermitFrame(sim, H, t, k), s = k * HERMIT_ART;
  const st = statusClock(sim, 'h' + H.id, H.fz > 0 ? { k: 'ice', left: H.fz } : H.zp > 0 ? { k: 'stun', zap: true, left: 0.4 } : null, t);
  const tt = st && st.k === 'ice' ? st.hold : t;
  pxSpace(ctx, F.x, F.y, k, () => {
    ctx.rotate(-F.rot);
    const draw = (c, ice) => drawHermit(c, 0, 0, s, tt, { ...F.o, part, ice });
    const box = { x0: -0.6 * s, y0: -0.75 * s, x1: 0.6 * s, y1: 0.1 * s };
    if (st && st.k === 'stun' && part !== 'all') draw(ctx, false);
    else withStatus(ctx, st, box, k, { x: -0.05 * s, y: -0.3 * s, r: 0.3 * s, seed: 3 + H.id }, draw, part !== 'back');
    if (part !== 'back' && F.o.pose === 'flip' && !(H.fz > 0)) dizzyStars(ctx, 0.05 * s, -0.62 * s, 0.22 * s, 0.07 * s, t, { n: 3, size: Math.max(4, s * 0.08) });
  });
}
function pufferFrame(sim, P) {
  const x = P.rr * Math.cos(P.a), y = P.rr * Math.sin(P.a);
  return { x, y };
}

// before the eggs: bubbles behind rising eggs, jellyfish, puffers, hermit crabs (the shell behind a tucked egg), the King Crab
export function drawReefUnder(ctx, sim, t, k, theme) {
  if (sim.water) drawBubbles(ctx, sim, t, k);
  if (!sim.hermits) return;
  if (sim.kc) drawKingCrab(ctx, sim, t, k);
  for (const P of sim.puffs) {
    if (P.ph === 'wait') continue;
    const F = pufferFrame(sim, P), R = mem(sim, 'p' + P.id, t);
    const st = statusClock(sim, 'p' + P.id, wantOf(P), t), tt = st && st.k === 'ice' ? st.hold : t;
    const ang = P.ph === 'drift' || P.ph === 'dart' || P.ph === 'pop' ? Math.atan2(-Math.cos(P.a), -Math.sin(P.a)) + Math.PI / 2 : 0; // along the channel
    const flipF = Math.cos(P.a) * P.face > 0 ? 1 : -1;
    const sw = P.ph === 'pop' ? clamp(P.t / P.dur, 0, 1) * 0.6 : P.sw;
    // the telegraph: it puffs in jerks, flashing its spines
    const squash = P.ph === 'swell' ? Math.sin(t * 30) * 0.5 : 0;
    pxSpace(ctx, F.x, F.y, k, () => {
      const draw = (c, ice) => drawPuffer(c, 0, 0, k, tt, { sw, face: flipF, squash: ice ? 0 : squash, stun: P.stn > 0 || P.zp > 0, alpha: P.ph === 'in' ? 1 - P.t / P.dur : 1, ice });
      const box = { x0: -0.6 * k, y0: -0.6 * k, x1: 0.6 * k, y1: 0.6 * k };
      withStatus(ctx, st, box, k, { x: 0, y: 0, r: (0.3 + 0.2 * sw) * k, seed: 11 + P.id }, draw);
      if (P.stn > 0 && !(P.fz > 0)) dizzyStars(ctx, 0, -(0.25 + 0.2 * sw) * k, 0.2 * k, 0.06 * k, t, { n: 3, size: Math.max(4, k * 0.08) });
    });
    if (P.ph === 'pop') { // the air jet as it deflates
      ctx.save(); ctx.globalAlpha = clamp(P.t / P.dur, 0, 1) * 0.8; ctx.fillStyle = '#e8f6ff';
      for (let i = 0; i < 5; i++) { const q = (t * 3 + i / 5) % 1, a = P.a + Math.PI, r = 0.1 + q * 0.5; ctx.beginPath(); ctx.arc(F.x + Math.cos(P.a + Math.PI / 2 * -P.face) * r, F.y + Math.sin(P.a + Math.PI / 2 * -P.face) * r, 0.035 * (1 - q * 0.5), 0, TAU); ctx.fill(); void a; }
      ctx.restore();
    }
    void ang; void R;
  }
  for (const J of sim.jellies) {
    if (J.ph === 'wait') continue;
    const R = mem(sim, 'j' + J.id, t);
    const stung = J.lastT > 0 && sim.t - J.lastT < 0.35;
    R.sting = Math.max(stung ? 1 : 0, R.sting - R.dt * 3);
    const st = statusClock(sim, 'j' + J.id, wantOf(J), t), tt = st && st.k === 'ice' ? st.hold : t;
    const js = k * JELLY_ART;
    pxSpace(ctx, J.x, J.y, k, () => {
      const draw = (c, ice) => drawJelly(c, 0, 0, js, tt, { pulse: 0.5 + 0.5 * Math.sin(tt * 3.4 + J.id), sting: ice ? 0 : R.sting, stun: J.stn > 0 || J.zp > 0, alpha: J.al, ice });
      withStatus(ctx, st, { x0: -0.5 * js, y0: -0.5 * js, x1: 0.5 * js, y1: 0.95 * js }, k, { x: 0, y: -0.1 * js, r: 0.32 * js, seed: 21 + J.id }, draw);
      if (J.stn > 0 && !(J.fz > 0)) dizzyStars(ctx, 0, -0.42 * js, 0.2 * js, 0.06 * js, t, { n: 3, size: Math.max(4, js * 0.08) });
    });
  }
  for (const H of sim.hermits) if (H.ph !== 'wait') drawHermitAt(ctx, sim, H, t, k, H.eid ? 'back' : 'all');
}
// after the eggs: a hermit crab's claws over the egg it holds, the King Crab's claws over theirs, the silt cloud
export function drawReefOver(ctx, sim, t, k) {
  if (!sim.hermits) return;
  for (const H of sim.hermits) if (H.ph !== 'wait' && H.eid) drawHermitAt(ctx, sim, H, t, k, 'front');
  if (sim.kc) drawKingOver(ctx, sim, t, k);
  const S = sim.kc && sim.kc.silt;
  if (S) drawSilt(ctx, sim, S, t);
}
// the silt cloud: one soft murky cloud (sandy grey-brown, a radial gradient, soft edge, a few slow swirls), painted on a
// scratch canvas and laid over the vault whole; a jellyfish's glow clears a soft round window in it (the sim: jellyLit)
let SILT = null;
function drawSilt(ctx, sim, S, t) {
  const age = S.dur - S.t, a = clamp(age / 0.4, 0, 1) * clamp(S.t / 0.8, 0, 1);
  if (a <= 0) return;
  const M = ctx.getTransform(), ppm = Math.sqrt(Math.abs(M.a * M.d - M.b * M.c)) || 40;
  const g0 = 0.75 + 0.25 * clamp(age / 0.6, 0, 1), cr = S.r * g0, R = cr + 0.45; // m: the cloud's radius, the canvas half size
  const W = Math.max(16, Math.min(1024, Math.ceil(2 * R * ppm))), sc = W / (2 * R);
  if (!SILT) SILT = typeof document !== 'undefined' ? document.createElement('canvas') : new OffscreenCanvas(W, W);
  if (SILT.width !== W) { SILT.width = W; SILT.height = W; }
  const c = SILT.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.clearRect(0, 0, W, W);
  c.setTransform(sc, 0, 0, -sc, W / 2 - S.x * sc, W / 2 + S.y * sc); // world (m, y up) on the scratch canvas
  // the body: a lumpy round cloud (big lobes that breathe), in three nested layers so the edge is soft, not a line
  const lobes = (f) => {
    c.beginPath();
    c.moveTo(S.x + cr * 0.72 * f, S.y); c.arc(S.x, S.y, cr * 0.72 * f, 0, TAU);
    for (let i = 0; i < 9; i++) {
      const an = (i / 9) * TAU + Math.sin(t * 0.25 + i) * 0.12, d = cr * 0.5, r = cr * (0.42 + 0.1 * hash(i + 4)) * f + Math.sin(t * 0.8 + i * 1.7) * 0.03;
      const x = S.x + Math.cos(an) * d, y = S.y + Math.sin(an) * d;
      c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU);
    }
  };
  const gr = c.createRadialGradient(S.x - cr * 0.15, S.y + cr * 0.2, cr * 0.05, S.x, S.y, cr * 1.05);
  gr.addColorStop(0, '#8c7c5e'); gr.addColorStop(0.5, '#75684c'); gr.addColorStop(1, '#5a503c');
  for (const [f, al] of [[1.16, 0.3], [1.06, 0.45], [0.94, 1]]) { c.globalAlpha = al; lobes(f); c.fillStyle = gr; c.fill(); }
  // a few slow swirls of stirred-up sand, inside the cloud only
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-atop';
  c.lineCap = 'round'; c.lineWidth = Math.max(0.05, cr * 0.07);
  for (let i = 0; i < 3; i++) {
    const cx = S.x + Math.cos(i * 2.1 + 0.5) * cr * 0.42, cy = S.y + Math.sin(i * 2.1 + 0.5) * cr * 0.42, rot = t * (0.5 + 0.15 * i) * (i % 2 ? -1 : 1) + i;
    c.beginPath();
    for (let j = 0; j <= 24; j++) { const q = j / 24, an = rot + q * 4.2, rr = cr * (0.08 + 0.26 * q); const x = cx + Math.cos(an) * rr, y = cy + Math.sin(an) * rr; if (j) c.lineTo(x, y); else c.moveTo(x, y); }
    c.strokeStyle = i === 1 ? '#5e533d' : '#9a8a6a'; c.globalAlpha = 0.55; c.stroke();
  }
  // a jellyfish's glow clears a soft window
  c.globalCompositeOperation = 'destination-out'; c.globalAlpha = 1;
  for (const J of sim.jellies || []) {
    if (!(J.ph === 'float' || J.ph === 'in') || J.stn > 0 || Math.hypot(J.x - S.x, J.y - S.y) > cr + JELLY.light) continue;
    const g = c.createRadialGradient(J.x, J.y, JELLY.light * 0.5, J.x, J.y, JELLY.light);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(J.x, J.y, JELLY.light, 0, TAU); c.fill();
  }
  c.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.globalAlpha *= a * 0.94;
  ctx.translate(S.x - R, S.y + R); ctx.scale(2 * R / W, -2 * R / W);
  ctx.drawImage(SILT, 0, 0);
  ctx.restore();
}

// ---------------------------------------------------------------- underwater: the surface, the boat, bubbles
// bubbles trail every rising egg (a pure function of time: no state)
function drawBubbles(ctx, sim, t, k) {
  ctx.save();
  ctx.lineWidth = Math.max(0.012, 1.1 / k);
  for (const e of sim.aliveEggs()) {
    if (!e.body || !e.body.isActive()) continue;
    const p = e.body.getPosition(), v = e.body.getLinearVelocity(), sp = Math.hypot(v.x, v.y);
    for (let i = 0; i < 4; i++) {
      const q = (t * 0.9 + i / 4 + e.id * 0.13) % 1, r = 0.05 + 0.04 * hash(i + e.id * 7);
      ctx.globalAlpha = (1 - q) * clamp(0.35 + sp, 0, 1) * 0.85;
      const x = p.x + Math.sin(q * 9 + i * 2 + e.id) * 0.1 - v.x * q * 0.25, y = p.y - EGG_H * 0.35 + q * 0.6 - v.y * q * 0.2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
      ctx.fillStyle = 'rgba(214,244,255,0.35)'; ctx.fill();
      ctx.strokeStyle = '#2b6f96'; ctx.stroke();
    }
  }
  ctx.restore();
}
// The water surface at sim.groundY: the air above it, a wavy line, and the boat with the basket hanging under it.
// Draws the saved eggs in the basket too (the game skips its usual nest). Call before the eggs.
export function drawSurface(ctx, sim, theme, t, k, saved) {
  const y0 = sim.groundY, n = sim.nest.getPosition(), w = sim.nestW / 2;
  const wave = (x) => y0 + Math.sin(x * 1.3 + t * 1.6) * 0.06 + Math.sin(x * 2.9 - t * 2.3) * 0.025;
  ctx.save();
  // air above the surface: a pale sky band
  const g = ctx.createLinearGradient(0, y0 + 6, 0, y0);
  g.addColorStop(0, '#6fc7ee'); g.addColorStop(1, '#c8eefc');
  ctx.beginPath(); ctx.moveTo(-40, y0 + 30);
  for (let x = -40; x <= 40; x += 0.25) ctx.lineTo(x, wave(x));
  ctx.lineTo(40, y0 + 30); ctx.closePath();
  ctx.fillStyle = g; ctx.fill();
  // the waterline: a bright band, a dark edge under it
  ctx.beginPath(); for (let x = -40; x <= 40; x += 0.25) (x === -40 ? ctx.moveTo(x, wave(x)) : ctx.lineTo(x, wave(x)));
  ctx.strokeStyle = '#1d5a80'; ctx.lineWidth = Math.max(0.05, 3.2 / k); ctx.stroke();
  ctx.strokeStyle = '#9fe2ff'; ctx.lineWidth = Math.max(0.025, 1.4 / k); ctx.stroke();
  // light shafts down into the water
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#e8fbff';
  for (let i = 0; i < 5; i++) { const x = -6 + i * 3 + Math.sin(t * 0.3 + i) * 0.4; ctx.beginPath(); ctx.moveTo(x - 0.3, y0); ctx.lineTo(x + 0.3, y0); ctx.lineTo(x + 1.6, y0 - 7); ctx.lineTo(x + 0.4, y0 - 7); ctx.closePath(); ctx.fill(); }
  ctx.globalAlpha = 1;
  // the basket: an upside-down wicker dome under the boat; the eggs float up into it
  pxSpace(ctx, n.x, n.y, k, () => {
    const W = w * k, H = 0.62 * k, lw = Math.max(1.2, 0.04 * k);
    for (let i = 0; i < Math.min(4, saved); i++) { // saved eggs tucked up in it
      ctx.save(); ctx.translate((-0.33 + i * 0.22) * k, (0.34 + (i % 2) * 0.04) * k); ctx.rotate((i - 1.5) * 0.25 + Math.PI);
      ctx.beginPath(); ctx.ellipse(0, 0, EGG_W * 0.38 * k, EGG_H * 0.38 * k, 0, 0, TAU); fillStroke(ctx, '#f7ecd6', '#5a4028', lw * 0.7); ctx.restore();
    }
    ctx.beginPath(); ctx.moveTo(-W - 0.1 * k, 0.05 * k); ctx.quadraticCurveTo(-W, H, 0, H); ctx.quadraticCurveTo(W, H, W + 0.1 * k, 0.05 * k);
    ctx.lineTo(W - 0.06 * k, 0.05 * k); ctx.quadraticCurveTo(W * 0.9, H * 0.78, 0, H * 0.8); ctx.quadraticCurveTo(-W * 0.9, H * 0.78, -W + 0.06 * k, 0.05 * k); ctx.closePath();
    fillStroke(ctx, '#c99a4a', '#4a2e10', lw);
    ctx.strokeStyle = '#8a6224'; ctx.lineWidth = lw * 0.8;
    for (let i = 1; i < 7; i++) { const q = i / 7, x = -W + q * 2 * W; ctx.beginPath(); ctx.moveTo(x, 0.06 * k); ctx.lineTo(x * 0.92, H * (0.55 + 0.25 * Math.sin(q * Math.PI))); ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(0, 0.05 * k, W + 0.1 * k, 0.07 * k, 0, 0, TAU); fillStroke(ctx, '#a87a30', '#4a2e10', lw);
    // ropes up to the boat
    ctx.strokeStyle = '#4a2e10'; ctx.lineWidth = lw * 0.9;
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * W * 0.85, 0); ctx.lineTo(sx * W * 0.7, -(y0 - n.y) * k - 0.05 * k); ctx.stroke(); }
  });
  ctx.restore();
}
// the boat on the surface over the basket (drawn after the eggs so a saved egg never covers the hull); the hen is drawn
// by the game into the boat at boatSeat()
export function drawBoat(ctx, sim, t, k) {
  const n = sim.nest.getPosition(), w = sim.nestW / 2 + 0.35, y0 = sim.groundY + Math.sin(n.x * 1.3 + t * 1.6) * 0.05;
  pxSpace(ctx, n.x, y0, k, () => {
    ctx.rotate(Math.sin(t * 1.4) * 0.03);
    const W = w * k, H = 0.42 * k, lw = Math.max(1.4, 0.045 * k);
    ctx.beginPath(); ctx.moveTo(-W - 0.15 * k, -H * 0.55); ctx.lineTo(W + 0.15 * k, -H * 0.55); ctx.quadraticCurveTo(W * 0.95, H * 0.45, W * 0.55, H * 0.5); ctx.lineTo(-W * 0.55, H * 0.5); ctx.quadraticCurveTo(-W * 0.95, H * 0.45, -W - 0.15 * k, -H * 0.55); ctx.closePath();
    ctx.fillStyle = '#b8663a'; ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = '#86421f'; ctx.fillRect(-W * 1.2, H * 0.05, W * 2.4, H); ctx.fillStyle = '#e0e8ee'; ctx.fillRect(-W * 1.2, -H * 0.3, W * 2.4, H * 0.12); ctx.restore();
    ctx.lineWidth = lw; ctx.strokeStyle = '#3a1a08'; ctx.stroke();
    ctx.strokeStyle = '#6a3214'; ctx.lineWidth = lw * 0.6; ctx.beginPath(); ctx.moveTo(-W * 0.9, -H * 0.05); ctx.lineTo(W * 0.9, -H * 0.05); ctx.stroke();
  });
}
// where the hen sits in the boat (world): her feet on the deck
export function boatSeat(sim, t) { const n = sim.nest.getPosition(); return { x: n.x + 0.25, y: sim.groundY + 0.2 + Math.sin(n.x * 1.3 + t * 1.6) * 0.05 }; }

// a guide arrow over each outer-ring gap that points up at the basket (green when the basket is right over it)
export function drawRiseGuide(ctx, sim, t) {
  const ring = sim.rings[sim.rings.length - 1], ang = ring.body.getAngle(), nx = sim.nest.getPosition().x;
  for (const g of ring.gaps) {
    if ((g.curtain && g.curtain.alive) || g.grate) continue;
    const th = ang + g.a;
    if (Math.sin(th) < 0.25) continue;
    const r = ring.r + 0.3, x = r * Math.cos(th), y = r * Math.sin(th), over = Math.abs(ring.r * Math.cos(th) - nx) < sim.nestW / 2 - 0.12;
    ctx.save(); ctx.translate(x, y); ctx.rotate(th - Math.PI / 2);
    ctx.globalAlpha = over ? 0.8 + 0.2 * Math.sin(t * 6) : 0.55;
    ctx.fillStyle = over ? '#6dff6a' : '#ff8a7a'; ctx.strokeStyle = 'rgba(20,40,10,0.8)'; ctx.lineWidth = 0.035;
    for (const off of [0, 0.17]) { ctx.beginPath(); ctx.moveTo(-0.18, off); ctx.lineTo(0, off + 0.15); ctx.lineTo(0.18, off); ctx.lineTo(0, off + 0.07); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- events -> popups, sounds, one-time tips
export function reefEvent(ev, fx, U) {
  const P = U.popup, A = U.audio, once = U.once;
  switch (ev.type) {
    case 'hermitIn': once('hermit', 'A hermit crab! It tucks eggs in its shell. Bump an egg into it, or turn a gap to it.'); break;
    case 'hermitWarn': A.play('steel_clang', { vol: 0.25, pitch: 1.9 }); break;
    case 'hermitGrab': A.play('pop', { vol: 0.5, pitch: 0.7 }); P(ev.x, ev.y + 0.5, 'Tucked!', { color: '#ffb07a', size: 17, life: 0.9 }); break;
    case 'hermitDrop': if (ev.why === 'gap') P(ev.x, ev.y + 0.5, 'Slipped out!', { color: '#9cff8a', size: 17, life: 1 }); break;
    case 'hermitFlip': A.play('rock_hit', { vol: 0.5, pitch: 1.4 }); if (ev.why === 'drop') P(ev.x, ev.y + 0.6, 'Flipped!', { color: '#fff2a8', size: 18, life: 0.9 }); break;
    case 'puffIn': once('puffer', 'A pufferfish! It puffs up over a gap and blocks it. A thorn or a zap pops it.'); break;
    case 'puffSwell': A.play('bubble_on', { vol: 0.5, pitch: 0.6 }); break;
    case 'puffBig': A.play('squish', { vol: 0.6, pitch: 0.7 }); break;
    case 'puffPop': A.play('bubble_pop', { vol: 0.8, pitch: 0.6 }); P(ev.x, ev.y + 0.6, 'Pop!', { color: '#fff2a8', size: 18, life: 0.8 }); break;
    case 'puffSpine': A.play('crack', { vol: 0.5, pitch: 1.2 }); P(ev.x, ev.y + 0.4, 'Spines!', { color: '#ff8a7a', size: 16, life: 0.8 }); break;
    case 'puffBounce': A.play('squish', { vol: 0.4, pitch: 1.3 }); break;
    case 'jellyIn': once('jelly', 'A jellyfish! Its sting cracks eggs. Water washes it away, the live ring stuns it.'); break;
    case 'jellySting': A.play('zap', { vol: 0.4, pitch: 1.5 }); P(ev.x, ev.y + 0.45, 'Sting!', { color: '#f0a0ff', size: 16, life: 0.8 }); break;
    case 'jellyFlush': A.play('bubble_on', { vol: 0.6, pitch: 1.2 }); P(ev.x, ev.y + 0.5, 'Washed away!', { color: '#9fe8ff', size: 16, life: 1 }); break;
    case 'kcReach': A.play('wind_gust', { vol: 0.4, pitch: 1.6 }); break;
    case 'kcBonk': A.play('steel_clang', { vol: 0.7, pitch: 0.7 }); P(ev.x, ev.y, 'Bonk!', { color: '#fff2a8', size: 20, life: 0.9 }); break;
    case 'kcSnap': A.play('steel_clang', { vol: 0.5, pitch: 1.6 }); if (!ev.miss) P(ev.x, ev.y + 0.5, 'Snap!', { color: '#ff8a7a', size: 18, life: 0.8 }); break;
    case 'kcStuck': A.play('rock_hit', { vol: 0.8, pitch: 0.6 }); P(ev.x, ev.y + 0.5, 'Stuck! Hit it!', { color: '#ffe066', size: 20, life: 1.4 }); once('kcStuck', 'Its claw is stuck! Bump an egg into it or zap it.'); break;
    case 'kcHit': A.play('steel_clang', { vol: 0.9, pitch: 1.2 }); fx.shake = Math.max(fx.shake, 0.35); P(ev.x, ev.y + 0.5, ev.hp > 0 ? 'Ouch!' : 'Beaten!', { color: '#fff2a8', size: 22, life: 1.1 }); break;
    case 'kcPile': P(ev.x, ev.y + 0.3, 'Stolen!', { color: '#ff8a7a', size: 18, life: 1 }); break;
    case 'kcGive': P(ev.x, ev.y + 0.4, 'Egg back!', { color: '#9cff8a', size: 17, life: 1 }); break;
    case 'kcDefeat': A.play('unlock', { vol: 0.9, pitch: 0.8 }); fx.shake = Math.max(fx.shake, 0.5); break;
    case 'kcSilt': A.play('rock_hit', { vol: 0.6, pitch: 0.5 }); fx.shake = Math.max(fx.shake, 0.2); break;
  }
}
void RING_TH; void PUFF;
