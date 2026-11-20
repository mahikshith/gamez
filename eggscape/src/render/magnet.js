// The magnet power's look (2026-11-20, mykee: "the magnetic effect for the magnet power is not properly designed").
// The mechanic is sim.js setMagnet (unchanged): the egg that takes the orb is tied to its nearest friend by a rope for 8 s.
// Here: a chunky horseshoe clamps onto that egg's back (poles toward the friend), the friend gets a steel band, a snap line
// flashes once, then a dipole field runs between them: curved lines (red from the magnet, blue into the friend) with dashes
// flowing along them, thin and bright when the rope is taut (the friend leans in, sparks), a glowing knot and a clack when
// they touch. Iron-filing specks orbit both. The horseshoe's charge drains from the tips; the last 2 s flicker; at the end
// it pops off and tumbles away while the lines snap back. A miss (no friend in reach) is shown too: it clamps on, looks
// round with a "?", and drops off.
// Cost: a handful of quadratic curves with dash offsets per frame; no gradients, no shadowBlur; nothing when no magnet.
// World space (meters, y up). k = px per meter.
import { EGG_W, EGG_H, TAU } from '../sim/geom.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (q) => q * q * (3 - 2 * q);
const backOut = (q) => { q = clamp(q, 0, 1); return 1 + 2.7 * Math.pow(q - 1, 3) + 1.7 * Math.pow(q - 1, 2); };
const TIME = 8; // = POWER.magnet.time (sim.js)
const RED = '#e8303c', RED_LO = '#a81c28', RED_HI = '#ff8a90', INK = '#4a1016', STEEL = '#e4e9f0', STEEL_LO = '#8a96a8';
const NO_DASH = [], FIELD_DASH = [0.07, 0.09];
const PAIRS = new Map(); // joint -> { a, b, touch, clackT, mx, my, ang, ... } (render memory)
const FLY = []; // magnets popping off: { x, y, vx, vy, a, w, t0, miss? }
const PEND = []; // events waiting for the next draw (they get its time)
const MISS = []; // { egg, t0 }

// The horseshoe in its own frame: poles up (+y), the U's bottom at y 0; R outer, r inner, A arm length. charge 0..1 lights
// the arms from the tips down; glow 0..1 the pole glow.
const HR = 0.17, Hr = 0.08, HA = 0.15, HT = 0.06;
function horseshoe(ctx, px, charge, glow) {
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(-HR, HA); ctx.lineTo(-HR, 0); ctx.arc(0, 0, HR, Math.PI, 0, false); ctx.lineTo(HR, HA);
    ctx.lineTo(Hr, HA); ctx.lineTo(Hr, 0); ctx.arc(0, 0, Hr, 0, Math.PI, true); ctx.lineTo(-Hr, HA);
    ctx.closePath();
  };
  ctx.lineJoin = 'round';
  shape();
  ctx.fillStyle = RED_LO;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = RED; // lit body: shifted up-left
  ctx.save(); ctx.translate(-0.03, 0.035); shape(); ctx.fill(); ctx.restore();
  ctx.fillStyle = RED_HI; // a hard highlight down the left arm and round the bottom
  ctx.beginPath(); ctx.moveTo(-HR + 0.022, HA - 0.01); ctx.lineTo(-HR + 0.022, 0); ctx.arc(0, 0, HR - 0.022, Math.PI, Math.PI * 1.35, false); ctx.lineWidth = 0.02; ctx.strokeStyle = RED_HI; ctx.stroke();
  // steel pole tips
  for (const sx of [-1, 1]) {
    const x0 = sx < 0 ? -HR : Hr;
    ctx.fillStyle = STEEL_LO; ctx.fillRect(x0, HA - HT, HR - Hr, HT + 0.01);
    ctx.fillStyle = STEEL; ctx.fillRect(x0 - 0.01, HA - HT + 0.012, HR - Hr - 0.012, HT);
  }
  ctx.restore();
  shape();
  ctx.lineWidth = Math.max(1.6 * px, 0.014);
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath(); // the tip seams
  ctx.moveTo(-HR, HA - HT); ctx.lineTo(-Hr, HA - HT); ctx.moveTo(Hr, HA - HT); ctx.lineTo(HR, HA - HT);
  ctx.lineWidth = Math.max(1.5 * px, 0.01);
  ctx.stroke();
  // charge: a bright core along the arms, shrinking from the tips down toward the bottom of the U
  if (charge > 0.01) {
    const rc = (HR + Hr) / 2, arcL = (Math.PI / 2) * rc, arm = HA - HT - 0.012, half = arcL + arm, L = half * charge;
    ctx.lineCap = 'round';
    for (const [w, col] of [[0.034, 'rgba(255,220,120,0.55)'], [0.013, '#fff6d0']]) {
      ctx.lineWidth = w;
      ctx.strokeStyle = col;
      ctx.beginPath();
      for (const sx of [-1, 1]) {
        ctx.moveTo(0, -rc);
        ctx.arc(0, 0, rc, -Math.PI / 2, -Math.PI / 2 - sx * (Math.PI / 2) * Math.min(1, L / arcL), sx > 0);
        if (L > arcL) ctx.lineTo(-sx * rc, Math.min(arm, L - arcL));
      }
      ctx.stroke();
    }
  }
  if (glow > 0.01) { // pole glow: little sparks over the steel tips
    ctx.fillStyle = `rgba(255,255,255,${glow})`;
    for (const sx of [-1, 1]) spark(ctx, sx * rcMid(), HA + 0.03, 0.035 * glow);
  }
}
const rcMid = () => (HR + Hr) / 2;
function spark(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}
// the friend's steel band round its waist (egg frame: y along the egg)
function steelBand(ctx, egg, sc, px) {
  const b = egg.body, p = b.getPosition(), yb = -EGG_H * 0.3, hw = EGG_W * 0.5 * 0.86, h = 0.085; // round its belly, under the face
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(b.getAngle());
  ctx.translate(0, yb);
  ctx.scale(sc, sc);
  ctx.beginPath();
  ctx.moveTo(-hw, -h / 2); ctx.quadraticCurveTo(0, -h / 2 - 0.035, hw, -h / 2); ctx.lineTo(hw, h / 2); ctx.quadraticCurveTo(0, h / 2 - 0.035, -hw, h / 2); ctx.closePath();
  ctx.fillStyle = '#a9b4c6'; ctx.fill();
  ctx.fillStyle = '#f2f5fa';
  ctx.beginPath(); ctx.moveTo(-hw * 0.9, h * 0.1); ctx.quadraticCurveTo(0, h * 0.1 - 0.03, hw * 0.9, h * 0.1); ctx.lineTo(hw * 0.9, h * 0.38); ctx.quadraticCurveTo(0, h * 0.38 - 0.03, -hw * 0.9, h * 0.38); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-hw, -h / 2); ctx.quadraticCurveTo(0, -h / 2 - 0.035, hw, -h / 2); ctx.lineTo(hw, h / 2); ctx.quadraticCurveTo(0, h / 2 - 0.035, -hw, h / 2); ctx.closePath();
  ctx.lineWidth = Math.max(1.1 * px, 0.008) / sc;
  ctx.strokeStyle = '#4a5468';
  ctx.stroke();
  ctx.fillStyle = '#4a5468'; // two rivets
  for (const x of [-hw * 0.55, hw * 0.55]) { ctx.beginPath(); ctx.arc(x, -0.004, 0.009, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// events (main.js handleEvents): magnetOn / magnetOff / magnetMiss
export function magnetEvent(ev, fx) {
  if (ev.type === 'magnetMiss') { PEND.push({ type: 'miss', egg: ev.egg }); return; }
  if (ev.type === 'magnetOn' && ev.egg && ev.egg.body && fx) {
    const p = ev.egg.body.getPosition();
    fx.wave(p.x, p.y, 0.7, '#ff6a78', 0.35, 0.06, { delay: 0.12 });
  }
}

// the friend leans toward the magnet when the rope goes taut (main.js drawEggFelt): { a (rad), s (stretch), dx, dy }
const LEAN = { a: 0, s: 0, dx: 0, dy: 0 };
export function magnetLean(e) {
  const J = e.joint;
  if (!J || J.b !== e || J.dead) return null;
  const P = PAIRS.get(J);
  if (!P || !(P.taut > 0.02)) return null;
  LEAN.a = P.dir + Math.PI; LEAN.s = 0.09 * P.taut; LEAN.dx = -P.ux * 0.035 * P.taut; LEAN.dy = -P.uy * 0.035 * P.taut;
  return LEAN;
}

export function drawMagnetField(ctx, sim, t, k = 60, calm = false) {
  const px = 1 / k;
  while (PEND.length) { const E = PEND.shift(); if (E.type === 'miss') MISS.push({ egg: E.egg, t0: t }); }
  let seen = 0;
  for (const e of sim.eggs) {
    const J = e.joint;
    if (!J || J.a !== e || J.dead || !e.alive || !(e.magnet > 0)) continue;
    const o = J.b;
    if (!o || !o.alive || !o.body || !e.body) continue;
    seen++;
    let P = PAIRS.get(J);
    if (!P) PAIRS.set(J, (P = { a: e, b: o, touch: false, knot: 0, clackT: -9, seen: t, dir: 0, ux: 1, uy: 0, taut: 0, mx: 0, my: 0, ang: 0, len: J.len }));
    P.seen = t;
    drawPair(ctx, P, e, o, J, t, px, calm);
  }
  // pairs that ended since the last frame: the magnet pops off, the lines snap back
  for (const [J, P] of PAIRS) {
    if (P.seen === t) continue;
    if (!P.end) {
      P.end = t;
      const sd = Math.sign(Math.cos(P.dir + Math.PI)) || 1;
      FLY.push({ x: P.mx, y: P.my, vx: sd * 1.4, vy: 2.6, a: P.ang, w: -sd * 9, t0: t });
    }
    const e = t - P.end;
    if (e > 0.4 || !P.a.body || !P.b.body) { PAIRS.delete(J); continue; }
    snapBack(ctx, P, e, px);
  }
  // misses: clamps on, looks round with a "?", drops off
  for (let i = MISS.length - 1; i >= 0; i--) {
    const M = MISS[i], e = t - M.t0;
    if (e > 0.95 || !M.egg.body || !M.egg.alive) {
      if (M.egg.body) { const p = M.egg.body.getPosition(); FLY.push({ x: p.x, y: p.y + EGG_H * 0.5 + 0.02, vx: 0.6, vy: 1.4, a: 0, w: -6, t0: t }); }
      MISS.splice(i, 1);
      continue;
    }
    const p = M.egg.body.getPosition(), pop = backOut(e / 0.2), look = e > 0.22 ? Math.sin((e - 0.22) * 11) * 0.55 * Math.sin(clamp((e - 0.22) / 0.7, 0, 1) * Math.PI) : 0;
    ctx.save();
    ctx.translate(p.x, p.y + EGG_H * 0.5 - 0.02 + 0.25 * (1 - pop));
    ctx.rotate(look);
    ctx.scale(pop, pop);
    horseshoe(ctx, px, 0.25, 0);
    ctx.restore();
    if (e > 0.25) { // the questioning flicker
      const on = calm ? 1 : Math.floor(e * 9) % 3 ? 1 : 0.4;
      ctx.save();
      ctx.translate(p.x + 0.2, p.y + EGG_H * 0.5 + 0.32);
      ctx.scale(px, -px);
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.globalAlpha = on * clamp((e - 0.25) / 0.1, 0, 1) * clamp((0.95 - e) / 0.15, 0, 1);
      ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.strokeText('?', 0, 0);
      ctx.fillStyle = '#ffffff'; ctx.fillText('?', 0, 0);
      ctx.restore();
    }
  }
  // popped-off magnets tumbling away, fading
  for (let i = FLY.length - 1; i >= 0; i--) {
    const F = FLY[i], e = t - F.t0;
    if (e > 0.8 || e < 0) { FLY.splice(i, 1); continue; }
    ctx.save();
    ctx.globalAlpha *= 1 - smooth(e / 0.8);
    ctx.translate(F.x + F.vx * e, F.y + F.vy * e - 4.5 * e * e);
    ctx.rotate(F.a + F.w * e);
    horseshoe(ctx, px, 0, 0);
    ctx.restore();
  }
  if (!seen && PAIRS.size === 0 && !MISS.length && !FLY.length) return;
}

function snapBack(ctx, P, e, px) {
  const pa = P.a.body.getPosition(), pb = P.b.body.getPosition(), dx = pb.x - pa.x, dy = pb.y - pa.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, nx = -uy, ny = ux;
  const f = Math.max(0, Math.exp(-e * 9) * Math.cos(e * 26)), a = 1 - e / 0.4;
  ctx.save();
  ctx.lineCap = 'round';
  for (const [x0, y0, sd, col] of [[pa.x, pa.y, 1, 'rgba(255,90,104,'], [pb.x, pb.y, -1, 'rgba(90,150,255,']]) {
    for (let i = -1; i <= 1; i++) {
      const L = (d * 0.5) * f, cx = x0 + ux * sd * L * 0.5 + nx * i * 0.12 * f, cy = y0 + uy * sd * L * 0.5 + ny * i * 0.12 * f;
      ctx.beginPath(); ctx.moveTo(x0 + ux * sd * 0.18, y0 + uy * sd * 0.18); ctx.quadraticCurveTo(cx, cy, x0 + ux * sd * (0.18 + L), y0 + uy * sd * (0.18 + L));
      ctx.strokeStyle = col + 0.6 * a + ')';
      ctx.lineWidth = Math.max(3 * px, 0.03);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.8 * a})`;
      ctx.lineWidth = Math.max(1.2 * px, 0.01);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawPair(ctx, P, A, B, J, t, px, calm) {
  const pa = A.body.getPosition(), pb = B.body.getPosition(), dx = pb.x - pa.x, dy = pb.y - pa.y, d = Math.hypot(dx, dy) || 1e-3;
  const ux = dx / d, uy = dy / d, nx = -uy, ny = ux, dir = Math.atan2(dy, dx);
  const age = TIME - A.magnet, left = A.magnet; // seconds since the pickup, seconds left
  const maxL = (J.j && J.j.getMaxLength ? J.j.getMaxLength() : J.len) || 0.8;
  const taut = clamp((d - (maxL - 0.12)) / 0.12, 0, 1), touch = d < EGG_W + 0.1;
  P.dir = dir; P.ux = ux; P.uy = uy; P.taut += (taut - P.taut) * 0.3;
  if (touch && !P.touch) P.clackT = t;
  P.touch = touch;
  // flicker in the last 2 s (calm: a slow fade instead)
  let vis = 1;
  if (left < 2) vis = calm ? 0.45 + 0.55 * (left / 2) : (Math.sin(t * (18 + (2 - left) * 16)) > -0.2 ? 1 : 0.25);
  const intro = clamp((age - 0.2) / 0.25, 0, 1); // the field takes over after the snap
  ctx.save();
  ctx.lineCap = 'round';
  // iron filings orbiting both eggs
  for (let side = 0; side < 2; side++) {
    const p = side ? pb : pa, sd = side ? -1 : 1;
    for (let i = 0; i < 4; i++) {
      const a = t * (1.6 + 0.2 * (i % 3)) * sd + (i / 4) * TAU, rx = 0.34 + 0.04 * (i % 2), ry = 0.4, x = p.x + Math.cos(a) * rx, y = p.y + Math.sin(a) * ry;
      const tx = -Math.sin(a) * rx, ty = Math.cos(a) * ry, tl = Math.hypot(tx, ty), L = 0.028;
      ctx.globalAlpha = 0.85 * intro * vis;
      ctx.strokeStyle = '#2a2f3a'; ctx.lineWidth = Math.max(2.6 * px, 0.02);
      ctx.beginPath(); ctx.moveTo(x - (tx / tl) * L, y - (ty / tl) * L); ctx.lineTo(x + (tx / tl) * L, y + (ty / tl) * L); ctx.stroke();
      ctx.strokeStyle = '#dfe5ee'; ctx.lineWidth = Math.max(1.1 * px, 0.009);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  // the field lines
  if (intro > 0) {
    const gap = Math.max(0, d - EGG_W);
    {
      // a dipole field: lines leave the magnet egg's facing side, bulge out and land on the friend's facing side. Touching,
      // they fold into a tight knot of short loops round the contact, with a glow at its heart.
      const kn = (P.knot += ((touch ? 1 : 0) - P.knot) * 0.25), ra = EGG_W * 0.5 + 0.015, fan = 0.36 + 0.14 * kn;
      const bulge = (0.045 + 0.06 * clamp(1 - gap / 1.0, 0, 1)) * (1 - 0.6 * P.taut) + 0.05 * kn, bright = 0.6 + 0.4 * Math.max(P.taut, kn);
      if (kn > 0.05) {
        const cx = pa.x + ux * d * 0.5, cy = pa.y + uy * d * 0.5, pr = 0.06 + 0.012 * Math.sin(t * 14);
        ctx.globalAlpha = intro * vis * kn;
        ctx.fillStyle = 'rgba(255,240,250,0.9)';
        ctx.beginPath(); ctx.arc(cx, cy, pr, 0, TAU); ctx.fill();
        ctx.lineWidth = Math.max(3 * px, 0.025); ctx.strokeStyle = '#ff5a8a'; ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.setLineDash(NO_DASH);
      for (let pass = 0; pass < 3; pass++) {
        for (let j = 0; j < 4; j++) {
          const i = j - 1.5, aa = dir + i * fan, ab = dir + Math.PI - i * fan, ax = pa.x + Math.cos(aa) * ra, ay = pa.y + Math.sin(aa) * ra, bx = pb.x + Math.cos(ab) * ra, by = pb.y + Math.sin(ab) * ra;
          const bb = i * bulge * (1 + 0.3 * Math.abs(i)), mx = (ax + bx) / 2 + nx * bb, my = (ay + by) / 2 + ny * bb;
          // de Casteljau halves: red from the magnet, blue into the friend
          const c1x = (ax + mx) / 2, c1y = (ay + my) / 2, c2x = (mx + bx) / 2, c2y = (my + by) / 2, hx = (c1x + c2x) / 2, hy = (c1y + c2y) / 2;
          if (pass === 0) { // soft coloured edge (wider when slack, thinner when taut)
            ctx.lineWidth = Math.max(3.6 * px, 0.05 * (1 - 0.45 * P.taut));
            ctx.globalAlpha = intro * vis * (0.45 + 0.25 * P.taut);
            ctx.strokeStyle = '#ff3a52'; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(c1x, c1y, hx, hy); ctx.stroke();
            ctx.strokeStyle = '#3f86ff'; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(c2x, c2y, bx, by); ctx.stroke();
          } else {
            ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, bx, by);
            if (pass === 1) { ctx.lineWidth = Math.max(1.6 * px, 0.012); ctx.strokeStyle = `rgba(255,255,255,${0.55 * bright})`; ctx.globalAlpha = intro * vis; ctx.stroke(); }
            else { // dashes flowing from the magnet to the friend: the pull
              ctx.setLineDash(FIELD_DASH);
              ctx.lineDashOffset = -t * (0.7 + 0.8 * P.taut) - i * 0.03;
              ctx.lineWidth = Math.max(2.2 * px, 0.022 * (1 - 0.3 * P.taut));
              ctx.strokeStyle = '#fffaf2'; ctx.globalAlpha = intro * vis * bright;
              ctx.stroke();
              ctx.setLineDash(NO_DASH);
            }
          }
        }
      }
      ctx.globalAlpha = 1;
      if (P.taut > 0.6 && !calm) { // sparks at the friend when the rope snaps taut
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 3; i++) { const ph = (t * 5 + i / 3) % 1, a = dir + Math.PI + (i - 1) * 0.6; spark(ctx, pb.x + Math.cos(a) * (0.26 + ph * 0.12), pb.y + Math.sin(a) * (0.26 + ph * 0.12), 0.045 * Math.sin(ph * Math.PI) * P.taut); }
      }
    }
  }
  // clack when they touch
  const ce = t - P.clackT;
  if (ce >= 0 && ce < 0.3) {
    const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2, q = ce / 0.3;
    ctx.fillStyle = `rgba(255,255,255,${1 - q})`;
    spark(ctx, mx, my, 0.07 + 0.12 * Math.sin(q * Math.PI));
    ctx.strokeStyle = `rgba(255,236,160,${1 - q})`;
    ctx.lineWidth = Math.max(2.5 * px, 0.02);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.3; ctx.moveTo(mx + Math.cos(a) * (0.08 + 0.1 * q), my + Math.sin(a) * (0.08 + 0.1 * q)); ctx.lineTo(mx + Math.cos(a) * (0.14 + 0.16 * q), my + Math.sin(a) * (0.14 + 0.16 * q)); }
    ctx.stroke();
  }
  // the snap line: once, 0.15 s, right after the clamp
  if (age > 0.12 && age < 0.27 && !calm) {
    const q = (age - 0.12) / 0.15, n = 7;
    for (const [w, col] of [[Math.max(6 * px, 0.05), 'rgba(110,170,255,0.7)'], [Math.max(2.4 * px, 0.018), '#ffffff']]) {
      ctx.lineWidth = w; ctx.strokeStyle = col; ctx.globalAlpha = 1 - q * q;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const f = i / n, j = i === 0 || i === n ? 0 : (i % 2 ? 1 : -1) * 0.07 * Math.sin(i * 7.3 + Math.floor(age * 60));
        const x = pa.x + dx * f + nx * j, y = pa.y + dy * f + ny * j;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  // the friend's steel band (pops on), the horseshoe on the magnet egg's back (pops over, clamps), its charge draining
  const bandIn = backOut((age - 0.12) / 0.2);
  if (bandIn > 0.02) steelBand(ctx, B, 0.6 + 0.4 * bandIn, px);
  const pop = backOut(age / 0.22), drop = 1 - smooth(clamp(age / 0.18, 0, 1));
  const back = EGG_W * 0.5 + 0.04, mx = pa.x - ux * back, my = pa.y - uy * back + 0.35 * drop;
  P.mx = mx; P.my = my; P.ang = dir - Math.PI / 2;
  const clampSq = age > 0.18 && age < 0.34 ? Math.sin(((age - 0.18) / 0.16) * Math.PI) * 0.18 : 0;
  ctx.save();
  ctx.globalAlpha = vis < 1 ? 0.6 + 0.4 * vis : 1;
  ctx.translate(mx, my);
  ctx.rotate(P.ang);
  ctx.scale(pop * (1 + clampSq), pop * (1 - clampSq));
  horseshoe(ctx, px, clamp(left / TIME, 0, 1), intro * (0.5 + 0.5 * Math.sin(t * 9)));
  ctx.restore();
  ctx.restore();
}
