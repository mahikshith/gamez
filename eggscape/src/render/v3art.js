// v3 art: new creatures, hazards and special eggs. Every function draws in LOCAL y-down space centred
// on (cx, cy) in the units given (world callers wrap with scale(1,-1)). Art must never throw.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mod = (a, b) => ((a % b) + b) % b;
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const safe = (ctx, f) => { ctx.save(); try { f(); } catch (e) { /* never break the frame */ } ctx.restore(); };
const lw = (px, base) => Math.max(px, base); // line width that never thins out below px

/* ------------------------------------------------------------------ EAGLE */

const EG = { dark: '#4a2f17', mid: '#6b4524', lite: '#9a6b3a', white: '#fbf6ea', whiteLo: '#d9cdb4', beak: '#ffc02e', beakLo: '#e08a10', line: '#25140a', talon: '#ffb21e' };

// One wing in a space where the wing points up (-y), root at (0,0), length 1.
function eagleWing(ctx, col, tint, o) {
  const feather = (x, y, ang, L, W) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(-W / 2, 0);
    ctx.lineTo(-W / 2, -L * 0.8);
    ctx.quadraticCurveTo(-W / 2, -L, 0, -L);
    ctx.quadraticCurveTo(W / 2, -L, W / 2, -L * 0.8);
    ctx.lineTo(W / 2, 0);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    ctx.lineWidth = o;
    ctx.strokeStyle = EG.line;
    ctx.stroke();
    ctx.beginPath(); // pale shaft tip
    ctx.moveTo(-W * 0.3, -L * 0.62);
    ctx.lineTo(0, -L * 0.96);
    ctx.lineTo(W * 0.3, -L * 0.62);
    ctx.fillStyle = tint;
    ctx.fill();
    ctx.restore();
  };
  // long primaries fanning out, shorter secondaries along the trailing edge
  for (let i = 0; i < 5; i++) feather(-0.1 + i * 0.045, -0.46, -0.34 + i * 0.17 - 0.05 * i, 0.58 - i * 0.045, 0.14);
  for (let i = 0; i < 4; i++) feather(0.11 - i * 0.075, -0.06, -0.22 - i * 0.09, 0.62 - i * 0.04, 0.15);
  // arm: the covert mass with a leading edge
  ctx.beginPath();
  ctx.moveTo(0.16, 0.05);
  ctx.bezierCurveTo(0.19, -0.3, 0.1, -0.62, -0.1, -0.74);
  ctx.quadraticCurveTo(-0.22, -0.6, -0.26, -0.4);
  ctx.quadraticCurveTo(-0.3, -0.1, -0.2, 0.08);
  ctx.closePath();
  ctx.fillStyle = col;
  ctx.fill();
  ctx.lineWidth = o;
  ctx.strokeStyle = EG.line;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.12, -0.05);
  ctx.bezierCurveTo(0.13, -0.3, 0.06, -0.52, -0.07, -0.62);
  ctx.lineWidth = o * 2.4;
  ctx.strokeStyle = 'rgba(255,230,180,0.28)';
  ctx.stroke();
}

// Eagle seen from the side. s = wingspan. opts: { flap 0..1 (beat strength, wings animate from t), dive 0..1 (wings folded),
// carrying: 'egg'|'snake'|null, face: 1|-1 }
export function drawEagle(ctx, cx, cy, s, t = 0, opts = {}) {
  if (!(s > 0)) return;
  safe(ctx, () => {
    opts = opts || {};
    const flap = clamp(opts.flap == null ? 0.6 : opts.flap, 0, 1), dive = clamp(opts.dive || 0, 0, 1), face = opts.face === -1 ? -1 : 1;
    const carry = opts.carrying === 'egg' || opts.carrying === 'snake' ? opts.carrying : null;
    ctx.translate(cx, cy);
    ctx.scale(face * s / 100, s / 100); // 100 units = wingspan
    const o = Math.max(1.6, 70 / s * 1.3);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const ph = Math.sin(t * 9);
    ctx.translate(0, -ph * flap * 2.2 * (1 - dive));
    ctx.rotate(dive * 0.85 + (1 - dive) * (carry ? -0.05 : -0.12 * ph * flap * 0.3));
    // wing pose: 0 = up, + = swinging down and forward, negative = back along the body (folded)
    // base swings -1 (high, swept back) .. +0.7 (down and forward); the far wing rides above it, the near wing below it
    const base = -0.2 + 0.85 * ph * flap + (1 - flap) * 0.15;
    const wingAng = (k) => (1 - dive) * (base + k * 0.55) + dive * (-1.45 + k * 0.1);
    const wingLen = 62 * (1 - dive * 0.35);

    // tail fan
    ctx.save();
    ctx.translate(-22, 3);
    ctx.rotate(-Math.PI / 2 + 0.05 - dive * 0.15);
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.rotate((i - 2) * 0.17 * (1 + dive * 0.3));
      ctx.beginPath();
      ctx.moveTo(-3.2, 0);
      ctx.lineTo(-3.8, -24);
      ctx.quadraticCurveTo(0, -27, 3.8, -24);
      ctx.lineTo(3.2, 0);
      ctx.closePath();
      ctx.fillStyle = i % 2 ? EG.white : EG.whiteLo;
      ctx.fill();
      ctx.lineWidth = o;
      ctx.strokeStyle = EG.line;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // far wing (darker, behind the body)
    ctx.save();
    ctx.translate(2, -7);
    ctx.rotate(wingAng(-1));
    ctx.scale(wingLen, wingLen);
    eagleWing(ctx, EG.dark, EG.mid, o / wingLen);
    ctx.restore();

    // legs: tucked, or reaching down to hold the catch
    const tal = (x, y, ext) => {
      ctx.strokeStyle = EG.talon;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 1, y + ext);
      for (const d of [-3.4, 0, 3.4]) {
        ctx.moveTo(x + 1, y + ext);
        ctx.quadraticCurveTo(x + 1 + d * 1.2, y + ext + 3, x + 1 + d * 1.5, y + ext + 6);
      }
      ctx.stroke();
    };
    const ext = carry ? 11 : 4 + dive * 7;
    ctx.save();
    ctx.lineWidth = 2.4 + o * 1.2;
    ctx.strokeStyle = EG.line;
    for (const lx of [1, 9]) { ctx.beginPath(); ctx.moveTo(lx, 14); ctx.lineTo(lx + 1, 14 + ext); ctx.stroke(); }
    ctx.restore();
    tal(1, 14, ext);
    tal(9, 14, ext);
    if (carry === 'egg') {
      // egg in the talons
      ctx.save();
      ctx.translate(6, 14 + ext + 7);
      ctx.rotate(Math.sin(t * 5) * 0.12);
      ctx.beginPath();
      for (let i = 0; i <= 28; i++) { const a = (i / 28) * TAU; const x = 6.5 * Math.cos(a) * (1 + 0.13 * Math.sin(a)), y = 8.5 * Math.sin(a); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.closePath();
      ctx.fillStyle = '#fbf0d8';
      ctx.fill();
      ctx.lineWidth = o;
      ctx.strokeStyle = '#6b4a2a';
      ctx.stroke();
      ctx.fillStyle = '#2a1d14';
      ctx.beginPath();
      ctx.arc(-2.2, 0, 1, 0, TAU);
      ctx.arc(2.2, 0, 1, 0, TAU);
      ctx.fill();
      ctx.restore();
    } else if (carry === 'snake') {
      ctx.save();
      ctx.translate(5, 14 + ext + 2);
      ctx.lineCap = 'round';
      const sn = (w, col) => {
        ctx.beginPath();
        for (let i = 0; i <= 12; i++) { const u = i / 12; const x = Math.sin(u * 7 - t * 8) * 4.5 * u + 1, y = u * 26; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.lineWidth = w;
        ctx.strokeStyle = col;
        ctx.stroke();
      };
      sn(6.5 + o * 1.4, '#1e0a40');
      sn(6.5, '#7a3ccc');
      sn(2.2, '#ffc49a');
      const hx = Math.sin(7 - t * 8) * 4.5 + 1;
      ctx.beginPath();
      ctx.ellipse(hx, 28.5, 5, 4, 0.1, 0, TAU);
      ctx.fillStyle = '#7a3ccc';
      ctx.fill();
      ctx.lineWidth = o;
      ctx.strokeStyle = '#1e0a40';
      ctx.stroke();
      ctx.fillStyle = '#e6f5a0';
      ctx.beginPath();
      ctx.arc(hx - 1.6, 27.5, 1.4, 0, TAU);
      ctx.arc(hx + 1.8, 27.5, 1.4, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // body
    ctx.beginPath();
    ctx.moveTo(26, -8);
    ctx.bezierCurveTo(30, 2, 24, 14, 8, 17);
    ctx.bezierCurveTo(-8, 19, -22, 12, -26, 2);
    ctx.bezierCurveTo(-26, -6, -12, -13, 4, -13);
    ctx.bezierCurveTo(14, -14, 22, -13, 26, -8);
    ctx.closePath();
    const bg = ctx.createLinearGradient(0, -14, 0, 18);
    bg.addColorStop(0, EG.lite);
    bg.addColorStop(0.5, EG.mid);
    bg.addColorStop(1, EG.dark);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.lineWidth = o * 1.2;
    ctx.strokeStyle = EG.line;
    ctx.stroke();
    // scalloped breast feathers
    ctx.strokeStyle = 'rgba(37,20,10,0.5)';
    ctx.lineWidth = o * 0.7;
    ctx.beginPath();
    for (const [x, y] of [[14, 0], [20, -5], [8, 7], [-2, 9], [-10, 5], [15, 9], [-1, 0], [-14, 0]]) { ctx.moveTo(x - 3.5, y); ctx.quadraticCurveTo(x, y + 4.2, x + 3.5, y); }
    ctx.stroke();
    // white head with a fierce brow
    ctx.save();
    ctx.translate(25, -14);
    ctx.beginPath();
    ctx.moveTo(-9, 3);
    ctx.bezierCurveTo(-11, -10, 0, -14, 8, -10);
    ctx.bezierCurveTo(12, -8, 12, -2, 11, 2);
    ctx.bezierCurveTo(6, 8, -4, 9, -9, 3);
    ctx.closePath();
    const hg = ctx.createRadialGradient(-3, -6, 1, 0, -2, 14);
    hg.addColorStop(0, '#ffffff');
    hg.addColorStop(1, EG.whiteLo);
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.lineWidth = o * 1.1;
    ctx.strokeStyle = EG.line;
    ctx.stroke();
    // hooked beak
    ctx.beginPath();
    ctx.moveTo(8, -9);
    ctx.bezierCurveTo(17, -9, 23, -4, 22, 5);
    ctx.bezierCurveTo(20, 2, 16, 2, 14, 4);
    ctx.bezierCurveTo(10, 3, 9, 0, 9, -2);
    ctx.closePath();
    const kg = ctx.createLinearGradient(0, -9, 0, 5);
    kg.addColorStop(0, EG.beak);
    kg.addColorStop(1, EG.beakLo);
    ctx.fillStyle = kg;
    ctx.fill();
    ctx.lineWidth = o;
    ctx.strokeStyle = EG.line;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(9.5, 1);
    ctx.lineTo(15, 1.6);
    ctx.stroke();
    // eye
    ctx.beginPath();
    ctx.ellipse(3, -4, 3.3, 3.6, 0, 0, TAU);
    ctx.fillStyle = '#ffe14a';
    ctx.fill();
    ctx.lineWidth = o * 0.8;
    ctx.stroke();
    ctx.fillStyle = '#16100a';
    ctx.beginPath();
    ctx.arc(3.8, -4, 1.8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(3.2, -5, 0.8, 0, TAU);
    ctx.fill();
    ctx.beginPath(); // brow ridge
    ctx.moveTo(-3, -9.5);
    ctx.lineTo(8.4, -5.4);
    ctx.lineWidth = o * 1.9;
    ctx.strokeStyle = EG.line;
    ctx.stroke();
    ctx.restore();

    // near wing (in front)
    ctx.save();
    ctx.translate(5, -8);
    ctx.rotate(wingAng(1));
    ctx.scale(wingLen, wingLen);
    eagleWing(ctx, EG.mid, EG.lite, o / wingLen);
    ctx.restore();
  });
}

/* ---------------------------------------------------------------- BARRIER */

// Wooden barrier standing across a channel. Local box: x in [-w/2, w/2], y in [-h, 0] (base at cy).
// melt 0..1 = venom eating it (green drips, sagging); burn 0..1 = fire eating it.
export function drawBarrier(ctx, cx, cy, w, h, t = 0, melt = 0, burn = 0) {
  if (!(w > 0 && h > 0)) return;
  safe(ctx, () => {
    melt = clamp(melt || 0, 0, 1);
    burn = clamp(burn || 0, 0, 1);
    ctx.translate(cx, cy);
    const eat = Math.max(melt, burn);
    const hv = h * (1 - 0.92 * eat); // what is left standing
    const o = lw(1.3, w * 0.05);
    // jagged top edge where it is eaten
    const edgeY = (x) => -hv + (eat > 0 ? Math.sin(x * 0.9 + t) * 1.3 + (hash(Math.round(x * 1.7)) - 0.5) * Math.min(6, h * 0.08) * (melt > burn ? 1 : 1.6) : 0);
    // contact shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 1.5, w * 0.62, Math.max(2, w * 0.12), 0, 0, TAU);
    ctx.fill();
    const steps = 10;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-w / 2 - 1, 0);
    for (let i = 0; i <= steps; i++) { const x = -w / 2 + (w * i) / steps; ctx.lineTo(x, Math.min(0, edgeY(x))); }
    ctx.lineTo(w / 2 + 1, 0);
    ctx.closePath();
    ctx.clip();
    // horizontal planks stacked up the wall
    const ph = clamp(w * 0.62, 7, Math.max(8, h / 3));
    const n = Math.max(2, Math.round(h / ph));
    const pH = h / n;
    for (let i = 0; i < n; i++) {
      const y1 = -i * pH, y0 = y1 - pH;
      const v = hash(i * 3.7 + 1);
      const base = [[182, 125, 72], [166, 110, 62], [194, 140, 84], [158, 104, 58]][i % 4];
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, `rgb(${base[0] + 26},${base[1] + 24},${base[2] + 20})`);
      g.addColorStop(0.5, `rgb(${base[0]},${base[1]},${base[2]})`);
      g.addColorStop(1, `rgb(${base[0] - 48},${base[1] - 40},${base[2] - 30})`);
      ctx.fillStyle = g;
      ctx.fillRect(-w / 2, y0 + 0.4, w, pH - 0.4);
      // grain
      ctx.strokeStyle = 'rgba(90,52,24,0.45)';
      ctx.lineWidth = Math.max(0.7, o * 0.6);
      ctx.beginPath();
      for (let k = 0; k < 2; k++) {
        const gy = y0 + pH * (0.3 + 0.4 * k) + v * 1.2;
        ctx.moveTo(-w / 2 + w * 0.05, gy);
        ctx.quadraticCurveTo(0, gy + (k ? 1.4 : -1.4), w / 2 - w * 0.05, gy + 0.6);
      }
      ctx.stroke();
      // knot
      if (v > 0.45) {
        ctx.beginPath();
        ctx.ellipse(-w * 0.12 + v * w * 0.2, y0 + pH * 0.5, Math.max(1, w * 0.07), Math.max(0.8, pH * 0.16), 0, 0, TAU);
        ctx.fillStyle = 'rgba(90,52,24,0.6)';
        ctx.fill();
      }
      // top light line and dark seam
      ctx.fillStyle = 'rgba(255,235,190,0.45)';
      ctx.fillRect(-w / 2, y0 + 0.4, w, Math.max(0.8, o * 0.7));
      ctx.fillStyle = 'rgba(40,20,8,0.7)';
      ctx.fillRect(-w / 2, y1 - Math.max(0.8, o * 0.8), w, Math.max(0.8, o * 0.8));
    }
    // vertical posts hugging the sides with nails
    ctx.fillStyle = 'rgba(70,40,18,0.5)';
    const pw = Math.max(1.5, w * 0.17);
    ctx.fillRect(-w / 2, -h, pw, h);
    ctx.fillRect(w / 2 - pw, -h, pw, h);
    ctx.fillStyle = '#4a4a50';
    for (let i = 0; i < n; i++) for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * (w / 2 - pw * 0.5), -i * pH - pH / 2, Math.max(0.8, w * 0.045), 0, TAU); ctx.fill(); }
    // char
    if (burn > 0) {
      ctx.fillStyle = `rgba(14,8,6,${0.78 * burn})`;
      ctx.fillRect(-w / 2, -h, w, h);
      ctx.strokeStyle = `rgba(255,120,30,${0.7 * burn * (1 - burn * 0.5)})`;
      ctx.lineWidth = Math.max(0.8, o * 0.8);
      ctx.beginPath();
      for (let i = 0; i < 4; i++) { const yy = -h * (0.15 + i * 0.22); ctx.moveTo(-w / 2, yy); ctx.lineTo(-w * 0.1, yy - 3); ctx.lineTo(w * 0.15, yy + 2); ctx.lineTo(w / 2, yy - 2); }
      ctx.stroke();
    }
    // venom soaking down from the top
    if (melt > 0) {
      const vg = ctx.createLinearGradient(0, -hv, 0, -hv + Math.max(10, hv * 0.8));
      vg.addColorStop(0, 'rgba(140,240,60,0.85)');
      vg.addColorStop(1, 'rgba(110,210,50,0)');
      ctx.fillStyle = vg;
      ctx.fillRect(-w / 2, -hv - 4, w, Math.max(10, hv * 0.8) + 4);
    }
    ctx.restore();
    // outline of what remains
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    for (let i = 0; i <= steps; i++) { const x = -w / 2 + (w * i) / steps; ctx.lineTo(x, Math.min(0, edgeY(x))); }
    ctx.lineTo(w / 2, 0);
    ctx.lineWidth = o * 1.3;
    ctx.strokeStyle = melt > 0 && melt >= burn ? '#2d6a14' : '#3d2210';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(-w / 2, -hv);
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, -hv);
    ctx.lineWidth = o * 1.3;
    ctx.strokeStyle = '#3d2210';
    ctx.stroke();
    // venom: slime gobs along the cut edge, drips and bubbles
    if (melt > 0) {
      for (let i = 0; i < 4; i++) {
        const x = -w / 2 + w * (0.12 + i * 0.25) + Math.sin(t * 1.2 + i) * w * 0.04;
        const y = Math.min(0, edgeY(x));
        const r = Math.max(1.4, w * 0.11) * (0.8 + 0.4 * hash(i + 5));
        ctx.beginPath();
        ctx.ellipse(x, y, r * 1.2, r, 0, 0, TAU);
        ctx.fillStyle = '#7bea38';
        ctx.fill();
        ctx.lineWidth = o * 0.8;
        ctx.strokeStyle = '#2d6a14';
        ctx.stroke();
        const k = mod(t * 0.7 + i * 0.27, 1), dl = (6 + hash(i) * 10) * k * Math.min(1, hv / 8 + 0.3);
        ctx.beginPath();
        ctx.moveTo(x - r * 0.5, y);
        ctx.lineTo(x - r * 0.3, y + dl);
        ctx.arc(x, y + dl, r * 0.45, Math.PI, 0, true);
        ctx.lineTo(x + r * 0.5, y);
        ctx.fillStyle = `rgba(123,234,56,${1 - k * 0.5})`;
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(210,255,170,0.85)';
      for (let i = 0; i < 3; i++) {
        const k = mod(t * 0.9 + i / 3, 1);
        ctx.globalAlpha = Math.sin(k * Math.PI);
        ctx.beginPath();
        ctx.arc((hash(i + 9) - 0.5) * w, -hv - k * h * 0.15, Math.max(0.9, w * 0.05), 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // flames licking the burning edge
    if (burn > 0 && burn < 1) {
      for (let i = 0; i < 4; i++) {
        const x = -w / 2 + w * (0.15 + i * 0.23), y = Math.min(0, edgeY(x)) + 1, fh = (5 + hash(i + 2) * 6) * (0.8 + 0.4 * Math.sin(t * 12 + i * 2)) * (1 - burn * 0.4) + h * 0.05;
        const fw = Math.max(2, w * 0.14);
        for (const [sc, col] of [[1, '#ff5a1a'], [0.65, '#ffb42a'], [0.3, '#fff2a0']]) {
          ctx.beginPath();
          ctx.moveTo(x - fw * sc, y);
          ctx.quadraticCurveTo(x - fw * sc * 0.9, y - fh * sc * 0.5, x + Math.sin(t * 9 + i) * fw * 0.4, y - fh * sc);
          ctx.quadraticCurveTo(x + fw * sc * 0.9, y - fh * sc * 0.5, x + fw * sc, y);
          ctx.closePath();
          ctx.fillStyle = col;
          ctx.fill();
        }
      }
    }
  });
}

/* --------------------------------------------------------------- LAVA ROCK */

const ROCK_SHAPE = [1, 0.86, 1.04, 0.9, 0.98, 0.84, 1.02, 0.92, 1.05, 0.88];

// Glowing lava rock (volcano). r = radius. heat 0..1 (cools to dark crust).
export function drawLavaRock(ctx, cx, cy, r, t = 0, heat = 1) {
  if (!(r > 0)) return;
  safe(ctx, () => {
    heat = clamp(heat == null ? 1 : heat, 0, 1);
    ctx.translate(cx, cy);
    const pulse = 0.85 + 0.15 * Math.sin(t * 5);
    // heat halo
    if (heat > 0.05) {
      const g = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * (1.9 + 0.2 * pulse));
      g.addColorStop(0, `rgba(255,120,30,${0.55 * heat})`);
      g.addColorStop(1, 'rgba(255,90,10,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r * 2.1, 0, TAU);
      ctx.fill();
    }
    const o = lw(1.4, r * 0.09);
    ctx.save();
    ctx.rotate(t * 1.3);
    const rock = () => {
      ctx.beginPath();
      const n = ROCK_SHAPE.length;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU, a2 = ((i + 0.5) / n) * TAU;
        const rr = r * ROCK_SHAPE[i], rm = r * (ROCK_SHAPE[(i + 1) % n] + ROCK_SHAPE[i]) * 0.5 * 1.02;
        const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        ctx.lineTo(Math.cos(a2) * rm, Math.sin(a2) * rm);
      }
      ctx.closePath();
    };
    rock();
    // crust
    const cg = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.1);
    cg.addColorStop(0, heat > 0.3 ? '#6a4a40' : '#5e5652');
    cg.addColorStop(0.6, '#352826');
    cg.addColorStop(1, '#170d0d');
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.save();
    ctx.clip();
    // molten glow under the crust
    const hot = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    hot.addColorStop(0, `rgba(255,214,90,${0.9 * heat * pulse})`);
    hot.addColorStop(0.5, `rgba(255,98,20,${0.55 * heat})`);
    hot.addColorStop(1, 'rgba(120,20,0,0)');
    ctx.fillStyle = hot;
    ctx.fillRect(-r, -r, 2 * r, 2 * r);
    // glowing cracks
    const lava = heat > 0.5 ? `rgb(255,${Math.round(150 + 90 * (heat - 0.5))},40)` : `rgb(${Math.round(110 + 290 * heat)},${Math.round(40 + 160 * heat)},24)`;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const cracks = [[[-0.9, -0.1], [-0.5, 0.05], [-0.2, -0.15], [0.15, 0.05], [0.55, -0.25], [0.95, -0.1]], [[-0.1, -0.95], [0.0, -0.55], [-0.2, -0.2], [0.05, 0.2], [0.3, 0.6], [0.25, 0.95]], [[0.15, 0.05], [0.5, 0.35], [0.85, 0.5]], [[-0.2, -0.15], [-0.5, -0.5], [-0.75, -0.6]]];
    for (const pass of [0, 1]) {
      ctx.strokeStyle = pass ? lava : `rgba(255,70,10,${0.45 * heat})`;
      ctx.lineWidth = r * (pass ? 0.1 : 0.22) * (0.6 + 0.4 * heat);
      ctx.beginPath();
      for (const c of cracks) c.forEach(([x, y], i) => (i ? ctx.lineTo(x * r, y * r) : ctx.moveTo(x * r, y * r)));
      ctx.stroke();
    }
    ctx.restore();
    rock();
    ctx.lineWidth = o * 1.4;
    ctx.strokeStyle = '#120808';
    ctx.stroke();
    ctx.restore();
    // glossy facet highlight (does not spin)
    ctx.fillStyle = `rgba(255,220,200,${0.2 + 0.1 * (1 - heat)})`;
    ctx.beginPath();
    ctx.ellipse(-r * 0.38, -r * 0.42, r * 0.28, r * 0.13, -0.7, 0, TAU);
    ctx.fill();
    // flying sparks
    if (heat > 0.2) {
      ctx.fillStyle = '#ffd36a';
      for (let i = 0; i < 4; i++) {
        const k = mod(t * 1.5 + i / 4, 1), a = hash(i + 3) * TAU;
        ctx.globalAlpha = (1 - k) * heat;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * (1 + k * 0.9), Math.sin(a) * r * (1 + k * 0.9) - k * r * 0.5, Math.max(0.8, r * 0.07 * (1 - k)), 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  });
}

/* --------------------------------------------------------------- MELT HOLE */

// Molten patch on a ring where a lava rock melted it (a temporary hole). len = arc length in px, th = ring thickness px.
export function drawMeltHole(ctx, cx, cy, len, th, t = 0, life = 1) {
  if (!(len > 0 && th > 0)) return;
  safe(ctx, () => {
    life = clamp(life == null ? 1 : life, 0, 1);
    ctx.translate(cx, cy);
    const hl = len / 2, ht = th / 2 * 1.08;
    const cool = 1 - life; // solidifying
    const jag = (x, s) => ht * (1 + 0.16 * Math.sin(x * 0.7 + s) + (hash(Math.round(x * 0.6) + s) - 0.5) * 0.3);
    const env = (x) => Math.sqrt(Math.max(0, 1 - (x / (hl + 0.001)) ** 2) * 0.6 + 0.4);
    const outline = (k) => {
      ctx.beginPath();
      const n = Math.max(6, Math.round(len / 3));
      for (let i = 0; i <= n; i++) { const x = -hl * k + (2 * hl * k * i) / n; const y = -jag(x, 1) * k * env(x); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      for (let i = n; i >= 0; i--) { const x = -hl * k + (2 * hl * k * i) / n; ctx.lineTo(x, jag(x, 5) * k * env(x)); }
      ctx.closePath();
    };
    // scorched rim, then the glowing melt
    outline(1.28);
    ctx.fillStyle = `rgba(20,10,8,${0.75 * (0.4 + 0.6 * life)})`;
    ctx.fill();
    outline(1.06);
    ctx.fillStyle = `rgba(80,20,8,${0.9 * (0.5 + 0.5 * life)})`;
    ctx.fill();
    ctx.save();
    outline(1);
    ctx.clip();
    const g = ctx.createLinearGradient(0, -ht, 0, ht);
    const glow = life;
    g.addColorStop(0, `rgba(255,${Math.round(90 + 80 * glow)},20,${0.5 + 0.5 * glow})`);
    g.addColorStop(0.5, `rgba(255,${Math.round(180 + 60 * glow)},${Math.round(60 * glow)},${0.35 + 0.65 * glow})`);
    g.addColorStop(1, `rgba(220,${Math.round(60 + 40 * glow)},10,${0.5 + 0.5 * glow})`);
    ctx.fillStyle = g;
    ctx.fillRect(-hl * 1.3, -ht * 1.4, len * 1.3, ht * 3);
    // crust forming as it cools
    if (cool > 0.05) {
      ctx.fillStyle = `rgba(40,22,18,${cool * 0.8})`;
      for (let i = 0; i < 5; i++) { const x = -hl + len * (i + 0.5) / 5; ctx.beginPath(); ctx.ellipse(x, (hash(i + 8) - 0.5) * th * 0.4, len / 11, ht * 0.5, hash(i) * 2, 0, TAU); ctx.fill(); }
    }
    // flowing bright streaks
    ctx.strokeStyle = `rgba(255,240,150,${0.7 * glow})`;
    ctx.lineWidth = Math.max(1, th * 0.12);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const y = (i - 1) * ht * 0.45, off = Math.sin(t * 2 + i * 2) * len * 0.08;
      ctx.moveTo(-hl * 0.5 + off, y);
      ctx.quadraticCurveTo(0, y + Math.sin(t * 3 + i) * ht * 0.2, hl * 0.5 + off, y);
    }
    ctx.stroke();
    ctx.restore();
    // bubbles and sparks
    for (let i = 0; i < 4; i++) {
      const k = mod(t * 0.8 + i * 0.25, 1), x = (hash(i * 2 + 1) - 0.5) * len * 0.8;
      ctx.globalAlpha = Math.sin(k * Math.PI) * life;
      ctx.beginPath();
      ctx.arc(x, ht * 0.2 - k * ht * 1.8, Math.max(0.8, th * 0.1) * (0.5 + k), 0, TAU);
      ctx.fillStyle = k > 0.8 ? '#fff2a0' : '#ffb03a';
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
}

/* ----------------------------------------------------------------- ICICLE */

// Falling icicle (frozen lake). h = length, pointing down (+y).
export function drawIcicle(ctx, cx, cy, h, t = 0) {
  if (!(h > 0)) return;
  safe(ctx, () => {
    ctx.translate(cx, cy);
    const w = h * 0.17, top = -h / 2, o = lw(1.2, h * 0.04);
    ctx.lineJoin = 'round';
    // faint cold glow
    const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, h * 0.7);
    gl.addColorStop(0, 'rgba(180,235,255,0.35)');
    gl.addColorStop(1, 'rgba(180,235,255,0)');
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.arc(0, 0, h * 0.7, 0, TAU);
    ctx.fill();
    // small side shard
    ctx.beginPath();
    ctx.moveTo(w * 0.9, top);
    ctx.lineTo(w * 1.9, top);
    ctx.lineTo(w * 1.5, top + h * 0.45);
    ctx.closePath();
    ctx.fillStyle = '#bfe8fa';
    ctx.fill();
    ctx.lineWidth = o;
    ctx.strokeStyle = '#3d7fa8';
    ctx.stroke();
    // main spike: two facets
    const spike = () => {
      ctx.beginPath();
      ctx.moveTo(-w * 1.15, top);
      ctx.lineTo(w * 1.15, top);
      ctx.lineTo(w * 0.7, top + h * 0.35);
      ctx.lineTo(w * 0.12, h / 2);
      ctx.lineTo(-w * 0.1, h / 2 - h * 0.03);
      ctx.lineTo(-w * 0.75, top + h * 0.3);
      ctx.closePath();
    };
    spike();
    const g = ctx.createLinearGradient(-w, 0, w, 0);
    g.addColorStop(0, '#f2fbff');
    g.addColorStop(0.45, '#bfe9fb');
    g.addColorStop(1, '#6fb6e0');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(30,110,190,0.28)'; // shaded right facet
    ctx.beginPath();
    ctx.moveTo(w * 0.12, top);
    ctx.lineTo(w * 1.3, top);
    ctx.lineTo(w * 0.12, h / 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; // gloss streak
    ctx.beginPath();
    ctx.moveTo(-w * 0.75, top + h * 0.03);
    ctx.lineTo(-w * 0.4, top + h * 0.03);
    ctx.lineTo(-w * 0.2, top + h * 0.5);
    ctx.lineTo(-w * 0.4, top + h * 0.5);
    ctx.fill();
    ctx.restore();
    spike();
    ctx.lineWidth = o * 1.2;
    ctx.strokeStyle = '#2f6f9c';
    ctx.stroke();
    // frost cap
    ctx.beginPath();
    ctx.ellipse(0, top, w * 1.3, h * 0.045, 0, 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.stroke();
    // twinkle
    const k = Math.sin(t * 4) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(255,255,255,${0.4 + 0.6 * k})`;
    const sx = -w * 0.15, sy = top + h * 0.28, sr = w * (0.5 + 0.5 * k);
    ctx.beginPath();
    ctx.moveTo(sx, sy - sr * 1.4);
    ctx.quadraticCurveTo(sx, sy, sx + sr, sy);
    ctx.quadraticCurveTo(sx, sy, sx, sy + sr * 1.4);
    ctx.quadraticCurveTo(sx, sy, sx - sr, sy);
    ctx.quadraticCurveTo(sx, sy, sx, sy - sr * 1.4);
    ctx.fill();
  });
}

/* ------------------------------------------------------------------ VENOM */

// Venom spit blob in flight / splash. r = radius, k 0..1 life.
export function drawVenom(ctx, cx, cy, r, t = 0, k = 1) {
  if (!(r > 0)) return;
  safe(ctx, () => {
    k = clamp(k == null ? 1 : k, 0, 1);
    ctx.translate(cx, cy);
    const o = lw(1.2, r * 0.12), sp = 1 - k;
    const gl = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 2.2);
    gl.addColorStop(0, `rgba(150,255,60,${0.5 * k})`);
    gl.addColorStop(1, 'rgba(150,255,60,0)');
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.2, 0, TAU);
    ctx.fill();
    const blob = (x, y, rr, wob) => {
      ctx.beginPath();
      for (let i = 0; i <= 20; i++) {
        const a = (i / 20) * TAU, q = rr * (1 + wob * Math.sin(a * 3 + t * 9) + wob * 0.6 * Math.sin(a * 5 - t * 7));
        const px = x + Math.cos(a) * q, py = y + Math.sin(a) * q;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
      const g = ctx.createRadialGradient(x - rr * 0.35, y - rr * 0.4, rr * 0.1, x, y, rr * 1.1);
      g.addColorStop(0, '#d8ff8a');
      g.addColorStop(0.45, '#7bea38');
      g.addColorStop(1, '#2f9a1c');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = o;
      ctx.strokeStyle = '#1d5e12';
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.ellipse(x - rr * 0.35, y - rr * 0.38, rr * 0.2, rr * 0.12, -0.7, 0, TAU);
      ctx.fill();
    };
    ctx.globalAlpha = Math.min(1, 0.25 + k * 1.6);
    blob(0, 0, r * (0.62 + 0.38 * k + sp * 0.35), 0.07 + sp * 0.12);
    // satellite drops: trail in flight, spray when it splashes
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + hash(i) * 0.8, d = r * (0.9 + sp * 2.2 + hash(i + 4) * 0.6), rr = r * (0.18 + 0.1 * hash(i + 2)) * (0.4 + k * 0.7);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * d, Math.sin(a) * d * (0.7 + sp * 0.3) + sp * sp * r, rr, 0, TAU);
      ctx.fillStyle = '#7bea38';
      ctx.fill();
      ctx.lineWidth = o * 0.7;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}

/* ------------------------------------------------------------- SPECIAL EGGS */

// Crack polylines in unit egg space (x/rx, y/ry), fixed so they never jump between frames.
const KIND_CRACKS = [
  [[0.78, -0.55], [0.6, -0.4], [0.5, -0.22], [0.28, -0.14], [0.2, 0.06], [0.0, 0.14], [-0.06, 0.34]],
  [[-0.82, 0.3], [-0.62, 0.22], [-0.5, 0.4], [-0.3, 0.38], [-0.2, 0.55]],
];

// Special eggs (Angry-Birds-style traits): 'ostrich' (big, cream, pores), 'quail' (small, speckled brown),
// 'duck' (pale blue-green). rx, ry = egg radii in px, rot = body angle, cracks 0..2. Shell only, no face.
export function drawEggKind(ctx, kind, cx, cy, rx, ry, rot = 0, t = 0, cracks = 0) {
  if (!(rx > 0 && ry > 0)) return;
  safe(ctx, () => {
    ctx.translate(cx, cy);
    ctx.rotate(rot || 0);
    const path = (k = 1) => {
      ctx.beginPath();
      for (let i = 0; i <= 36; i++) {
        const a = (i / 36) * TAU, sy = Math.sin(a);
        const x = rx * k * Math.cos(a) * (1 + 0.13 * sy), y = ry * k * sy;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
    };
    const pal = {
      ostrich: ['#fffbe8', '#f1e4c0', '#cdb887', 'rgba(120,90,50,0.8)'],
      quail: ['#f6ead0', '#e3cfa2', '#b99a66', 'rgba(70,45,22,0.9)'],
      duck: ['#f2fffa', '#cfeadf', '#8fc0b4', 'rgba(40,90,86,0.85)'],
    }[kind] || ['#ffffff', '#f7ecd6', '#d9c3a0', 'rgba(90,64,40,0.85)'];
    path();
    const g = ctx.createRadialGradient(-rx * 0.3, -ry * 0.25, ry * 0.05, 0, 0, ry * 1.05);
    g.addColorStop(0, pal[0]);
    g.addColorStop(0.55, pal[1]);
    g.addColorStop(1, pal[2]);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    const u = Math.min(rx, ry);
    if (kind === 'ostrich') {
      // pitted shell: little pores with a lit lip
      for (let i = 0; i < 30; i++) {
        const a = hash(i) * TAU, d = Math.sqrt(hash(i + 50)) * 0.92, x = Math.cos(a) * d * rx, y = Math.sin(a) * d * ry, pr = u * (0.035 + 0.03 * hash(i + 9));
        ctx.beginPath();
        ctx.ellipse(x, y, pr * 1.3, pr, hash(i) * 3, 0, TAU);
        ctx.fillStyle = 'rgba(150,120,70,0.5)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x - pr * 0.3, y - pr * 0.3, pr * 0.4, 0, TAU);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fill();
      }
    } else if (kind === 'quail') {
      // brown blotches and speckles
      for (let i = 0; i < 26; i++) {
        const a = hash(i + 1) * TAU, d = Math.sqrt(hash(i + 60)) * 0.95, x = Math.cos(a) * d * rx, y = Math.sin(a) * d * ry, big = i % 4 === 0;
        ctx.beginPath();
        ctx.ellipse(x, y, u * (big ? 0.2 : 0.09) * (0.7 + hash(i + 3)), u * (big ? 0.13 : 0.075) * (0.7 + hash(i + 4)), hash(i + 5) * 3, 0, TAU);
        ctx.fillStyle = big ? 'rgba(120,80,44,0.65)' : 'rgba(62,40,22,0.85)';
        ctx.fill();
      }
    } else if (kind === 'duck') {
      // soft sheen band and a few mottles
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(-rx * 0.45, -ry * 0.05, rx * 0.12, ry * 0.5, 0.15, 0, TAU);
      ctx.fill();
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.arc((hash(i + 20) - 0.5) * rx * 1.6, (hash(i + 30) - 0.5) * ry * 1.7, u * 0.045, 0, TAU);
        ctx.fillStyle = 'rgba(80,150,140,0.28)';
        ctx.fill();
      }
    }
    // bottom shade for volume
    const sh = ctx.createLinearGradient(0, -ry * 0.2, 0, ry);
    sh.addColorStop(0, 'rgba(0,0,0,0)');
    sh.addColorStop(1, 'rgba(60,30,10,0.22)');
    ctx.fillStyle = sh;
    ctx.fillRect(-rx * 1.3, -ry * 1.1, rx * 2.6, ry * 2.3);
    ctx.restore();
    path();
    ctx.lineWidth = lw(1.4, u * 0.06);
    ctx.strokeStyle = kind === 'ostrich' ? 'rgba(110,80,40,0.9)' : pal[3];
    ctx.stroke();
    // glossy highlight
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.ellipse(-rx * 0.38, -ry * 0.42, rx * 0.12, ry * 0.2, 0.5, 0, TAU);
    ctx.fill();
    // cracks
    const n = clamp(Math.round(cracks || 0), 0, 2);
    if (n > 0) {
      ctx.strokeStyle = '#4a3420';
      ctx.lineWidth = lw(1.2, u * 0.05);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        KIND_CRACKS[i].forEach(([x, y], j) => (j ? ctx.lineTo(x * rx, y * ry) : ctx.moveTo(x * rx, y * ry)));
        const m = KIND_CRACKS[i][3];
        ctx.moveTo(m[0] * rx, m[1] * ry);
        ctx.lineTo((m[0] + 0.22 * (i ? -1 : 1)) * rx, (m[1] + 0.2) * ry);
        ctx.stroke();
      }
    }
  });
}

/* --------------------------------------------------------- THORN CURTAIN */

// Thorn curtain hanging across a gap (only fire clears it). len = gap width px, h = hang length px.
export function drawThornCurtain(ctx, cx, cy, len, h, t = 0, burn = 0) {
  if (!(len > 0 && h > 0)) return;
  safe(ctx, () => {
    burn = clamp(burn || 0, 0, 1);
    ctx.translate(cx, cy);
    const o = lw(1.2, h * 0.025), n = Math.max(3, Math.round(len / Math.max(6, h * 0.34)));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const reach = h * (1 - burn * 0.92);
    const sway = (x, y) => Math.sin(t * 2 + x * 0.25 + y * 0.05) * Math.min(2.5, len * 0.02) * (y / h);
    const sp = [];
    for (let i = 0; i < n; i++) sp.push({ x0: -len / 2 + (len * (i + 0.5)) / n, ln: reach * (0.78 + 0.22 * hash(i * 2 + 1)), ph: hash(i + 7) * 6 });
    // rail the curtain grows from
    ctx.beginPath();
    ctx.moveTo(-len / 2 - 2, 0);
    ctx.lineTo(len / 2 + 2, 0);
    ctx.lineWidth = o * 3.2;
    ctx.strokeStyle = '#2a0a12';
    ctx.stroke();
    ctx.lineWidth = o * 1.6;
    ctx.strokeStyle = '#8a2234';
    ctx.stroke();
    const charred = burn > 0;
    const vineCol = charred ? `rgb(${Math.round(122 - 80 * burn)},${Math.round(29 - 10 * burn)},${Math.round(46 - 24 * burn)})` : '#8a1f33';
    // cross vines weaving between strands
    ctx.lineWidth = o * 1.4;
    ctx.strokeStyle = vineCol;
    for (const yk of [0.35, 0.65]) {
      const y = reach * yk;
      ctx.beginPath();
      sp.forEach((s, i) => { const x = s.x0 + sway(s.x0, y), yy = y + Math.sin(i * 1.7 + yk * 9) * h * 0.04; i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); });
      ctx.stroke();
    }
    for (const s of sp) {
      const segs = Math.max(4, Math.round(h / (len / n * 0.5)));
      const pts = [];
      for (let k = 0; k <= segs; k++) { const y = (s.ln * k) / segs; pts.push([s.x0 + sway(s.x0, y) + Math.sin(k * 1.3 + s.ph) * len * 0.015, y]); }
      for (const [w, col] of [[o * 3.6, '#2a0a12'], [o * 2.2, vineCol]]) {
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.lineWidth = w;
        ctx.strokeStyle = col;
        ctx.stroke();
      }
      // thorns alternate sides
      const tl = Math.max(3, Math.min(len / n * 0.4, h * 0.14));
      for (let k = 1; k < segs; k++) {
        const [x, y] = pts[k], d = k % 2 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(x, y - tl * 0.3);
        ctx.lineTo(x + d * tl, y + tl * 0.5);
        ctx.lineTo(x, y + tl * 0.35);
        ctx.closePath();
        ctx.fillStyle = charred ? `rgb(${Math.round(240 - 150 * burn)},${Math.round(56 - 30 * burn)},${Math.round(79 - 40 * burn)})` : '#f04058';
        ctx.fill();
        ctx.lineWidth = o * 0.8;
        ctx.strokeStyle = '#2a0a12';
        ctx.stroke();
      }
      // sharp tip
      const [ex, ey] = pts[segs];
      ctx.beginPath();
      ctx.moveTo(ex - tl * 0.35, ey - tl * 0.2);
      ctx.lineTo(ex, ey + tl * 0.9);
      ctx.lineTo(ex + tl * 0.35, ey - tl * 0.2);
      ctx.closePath();
      ctx.fillStyle = charred ? '#5a2030' : '#f04058';
      ctx.fill();
      ctx.stroke();
      // fire eating the strand from below
      if (burn > 0 && burn < 1) {
        const fh = (4 + 8 * hash(s.ph)) * (0.8 + 0.4 * Math.sin(t * 13 + s.ph)) + h * 0.05;
        for (const [sc, col] of [[1, '#ff5a1a'], [0.65, '#ffb42a'], [0.3, '#fff2a0']]) {
          ctx.beginPath();
          ctx.moveTo(ex - 3 * sc - 1, ey + 1);
          ctx.quadraticCurveTo(ex - 3 * sc, ey - fh * sc * 0.5, ex + Math.sin(t * 9 + s.ph) * 1.5, ey - fh * sc);
          ctx.quadraticCurveTo(ex + 3 * sc, ey - fh * sc * 0.5, ex + 3 * sc + 1, ey + 1);
          ctx.closePath();
          ctx.fillStyle = col;
          ctx.fill();
        }
      }
    }
  });
}

/* ------------------------------------------------------------------ GRATE */

// Grate set into a ring floor: only small (quail) eggs pass. len = arc length px, th = ring thickness px.
export function drawGrate(ctx, cx, cy, len, th, t = 0) {
  if (!(len > 0 && th > 0)) return;
  safe(ctx, () => {
    ctx.translate(cx, cy);
    const hl = len / 2, ht = th / 2, o = lw(1.2, th * 0.07), fr = Math.max(1.5, th * 0.2);
    const box = () => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-hl, -ht, len, th, fr); else ctx.rect(-hl, -ht, len, th); };
    // dark opening
    ctx.fillStyle = 'rgba(8,6,14,0.82)';
    box();
    ctx.fill();
    // bars across the thickness, gaps small enough for a quail egg only
    const n = Math.max(3, Math.round(len / (th * 0.55)));
    const pitch = (len - fr * 2) / n, bw = Math.max(1.4, pitch * 0.42);
    for (let i = 0; i <= n; i++) {
      const x = -hl + fr + pitch * i;
      const g = ctx.createLinearGradient(x - bw / 2, 0, x + bw / 2, 0);
      g.addColorStop(0, '#d5dbe3');
      g.addColorStop(0.45, '#8f99a6');
      g.addColorStop(1, '#46505c');
      ctx.fillStyle = g;
      ctx.fillRect(x - bw / 2, -ht + fr * 0.4, bw, th - fr * 0.8);
      ctx.lineWidth = o * 0.6;
      ctx.strokeStyle = '#1c222a';
      ctx.strokeRect(x - bw / 2, -ht + fr * 0.4, bw, th - fr * 0.8);
    }
    // frame
    box();
    ctx.lineWidth = fr * 0.9;
    ctx.strokeStyle = '#6b7684';
    ctx.stroke();
    ctx.lineWidth = o;
    ctx.strokeStyle = '#1c222a';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-hl + fr, -ht + fr * 0.45);
    ctx.lineTo(hl - fr, -ht + fr * 0.45);
    ctx.lineWidth = Math.max(0.8, o * 0.6);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.stroke();
    // rivets
    ctx.fillStyle = '#c9d0d9';
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * (hl - fr * 0.55), sy * (ht - fr * 0.55), Math.max(0.8, fr * 0.22), 0, TAU); ctx.fill(); }
    // a tiny glint sliding along the bars
    const k = mod(t * 0.5, 1.4) - 0.2;
    if (k > 0 && k < 1) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(-hl + len * k, -ht + fr * 0.5, Math.max(1, len * 0.015), th - fr);
    }
  });
}

/* --------------------------------------------------------------- ONE WAY */

// One-way ring marker: chevrons pointing the allowed direction (dir 1 = counter-clockwise). size px.
export function drawOneWayMark(ctx, cx, cy, size, dir = 1, t = 0) {
  if (!(size > 0)) return;
  safe(ctx, () => {
    ctx.translate(cx, cy);
    ctx.scale(dir < 0 ? -1 : 1, 1);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // dark pill so the mark reads on any ring colour
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-size * 0.72, -size * 0.5, size * 1.44, size, size * 0.5);
    else ctx.rect(-size * 0.72, -size * 0.5, size * 1.44, size);
    ctx.fillStyle = 'rgba(30,18,4,0.62)';
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * size * 0.4 - size * 0.06;
      ctx.globalAlpha = 0.35 + 0.65 * Math.max(0, Math.sin(t * 5 - i * 1.2));
      ctx.beginPath();
      ctx.moveTo(x - size * 0.12, -size * 0.3);
      ctx.lineTo(x + size * 0.14, 0);
      ctx.lineTo(x - size * 0.12, size * 0.3);
      ctx.lineWidth = size * 0.34;
      ctx.strokeStyle = '#4a2c00';
      ctx.stroke();
      ctx.lineWidth = size * 0.19;
      ctx.strokeStyle = '#ffd34a';
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}
