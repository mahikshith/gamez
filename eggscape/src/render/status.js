// Creature states, drawn INTO each creature's own art (v3.5): FROZEN and STUNNED share one look across the game.
//   FROZEN  the creature's own colours tinted icy (55% toward #bfe6ff) inside a translucent ice shell that follows its OWN
//           silhouette (an offset outline, not a circle), a dark blue rim (#2f6f9e: reads on white snow), crisp white facet
//           glints and a few frost crystals on the outline. The last second the shell cracks and shivers; on thaw angular
//           shards pop off and fall and the creature shakes itself off.
//   STUNNED the creature goes slack in its own pose (each art file does that part), spiral eyes, three stars circling on a
//           tilted ellipse above the head (dizzyStars). A zap first shows 0.3 s of jagged yellow-white arcs and a flash.
// Everything here draws in a local y-DOWN pixel space (one unit = one css px: wrap world art in pxSpace first).
// Usage per creature, each frame:
//   const st = statusClock(sim, 'e', want, t);       // want: null | { k: 'ice' | 'stun', zap, left }
//   statusDraw(ctx, box, (c) => drawIt(c, st ? st.hold : t), st, opts);
// The ice look is built from a snapshot of the creature drawn off screen (so it works for any art): the snapshot is tinted,
// dilated into the shell and rim, and its outline is sampled for glints, crystals, cracks and shards.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const ease = (u) => 1 - (1 - clamp(u, 0, 1)) ** 3;

export const ICE = {
  tint: 'rgba(191,230,255,0.55)', shell: 'rgba(214,240,255,1)', shellA: 0.3, rim: '#2f6f9e', pale: '#e9f8ff', glint: '#ffffff',
  thaw: 0.9, // s the thaw (shards and shake) lasts after the shell is gone
};
export const ZAP_T = 0.3; // s of arcs before the dizzy starts

// ---------------------------------------------------------------- clock: which state a creature shows, and for how long
const CK = new Map();
// want: null, or { k: 'ice' | 'stun', zap: bool (stun by lightning), left: seconds left (cracks start in the last second) }.
// Returns null (normal) or { k: 'ice' | 'stun' | 'thaw', age, left, hold (time the state began: freeze the art's clock on it),
// zap (0..1 through the zap arcs, or -1), crack (0..1), seed }.
export function statusClock(sim, key, want, t) {
  let c = CK.get(key);
  if (!c || c.sim !== sim || t < c.t - 0.5) { c = { sim, k: '', t0: t, t, hold: t, zap: false, seed: hash(CK.size * 3.7 + key.length) * 100 }; CK.set(key, c); }
  c.t = t;
  if (want) {
    if (c.k !== want.k) { c.k = want.k; c.t0 = t; c.hold = t; c.zap = !!want.zap; c.seed = (c.seed * 1.7 + 11.3) % 997; }
    else if (want.zap && want.k === 'stun' && t - c.t0 > 1.5) { c.t0 = t; c.zap = true; } // a second zap on a long stun
    const age = t - c.t0, left = want.left == null ? 9 : want.left;
    return { k: want.k, age, left, hold: c.hold, zap: c.zap && want.k === 'stun' && age < ZAP_T ? age / ZAP_T : -1, crack: want.k === 'ice' ? clamp(1 - left, 0, 1) : 0, seed: c.seed };
  }
  if (c.k === 'ice') { c.k = 'thaw'; c.t0 = t; }
  if (c.k === 'thaw') {
    const age = t - c.t0;
    if (age < ICE.thaw) return { k: 'thaw', age, left: 0, hold: t, zap: -1, crack: 1, seed: c.seed };
  }
  c.k = '';
  return null;
}
export const statusReset = () => CK.clear();
export const statusKind = (key) => (CK.get(key) || {}).k || ''; // what a creature showed last frame (so an ice that outlasts its marker still thaws)

// ---------------------------------------------------------------- bolts
// One lightning look for the whole game: a dark outline (contrast on pale skies and snow), a saturated electric blue band, a
// golden band and a bright yellow-white core. No white rim, no additive white halo. w = core width in the current units.
export const BOLT = { line: '#1b1350', blue: '#2f6bff', gold: '#ffc61a', core: '#fff3a6' };
export function boltStroke(ctx, w, a = 1, path = null, join = 'round') {
  const go = () => (path ? ctx.stroke(path) : ctx.stroke());
  ctx.save();
  ctx.lineJoin = join; ctx.lineCap = join === 'round' ? 'round' : 'butt'; ctx.miterLimit = 3;
  ctx.globalAlpha *= a;
  ctx.strokeStyle = BOLT.line; ctx.lineWidth = w * 3.4; go();
  ctx.strokeStyle = BOLT.blue; ctx.lineWidth = w * 2.5; go();
  ctx.strokeStyle = BOLT.gold; ctx.lineWidth = w * 1.5; go();
  ctx.strokeStyle = BOLT.core; ctx.lineWidth = w * 0.7; go();
  ctx.restore();
}

// ---------------------------------------------------------------- stars
function star(ctx, x, y, r, rot) {
  ctx.beginPath();
  for (let j = 0; j < 10; j++) {
    const rr = j % 2 ? r * 0.5 : r, b = -Math.PI / 2 + (j * Math.PI) / 5 + rot;
    if (j) ctx.lineTo(x + Math.cos(b) * rr, y + Math.sin(b) * rr); else ctx.moveTo(x + Math.cos(b) * rr, y + Math.sin(b) * rr);
  }
  ctx.closePath();
}
// Three small stars circling on a tilted ellipse centred (cx, cy) (the point above the head). The ones on the far side pass
// behind the head: call once with layer 'back' before drawing the head and once with 'front' after (default 'all').
export function dizzyStars(ctx, cx, cy, rx, ry, t, o = {}) {
  const tilt = o.tilt ?? -0.2, n = o.n ?? 3, layer = o.layer || 'all', size = o.size ?? Math.max(2.6, rx * 0.26), fade = o.fade ?? 1;
  ctx.save();
  ctx.lineJoin = 'round';
  for (let i = 0; i < n; i++) {
    const a = t * (o.speed ?? 3.2) + (i * TAU) / n, ex = rx * Math.cos(a), ey = ry * Math.sin(a), far = ey < 0;
    if ((layer === 'back' && !far) || (layer === 'front' && far)) continue;
    const x = cx + ex * Math.cos(tilt) - ey * Math.sin(tilt), y = cy + ex * Math.sin(tilt) + ey * Math.cos(tilt), r = size * (0.82 + 0.18 * Math.sin(a));
    ctx.globalAlpha = fade * (far ? 0.85 : 1);
    star(ctx, x, y, r, t * 1.5 + i);
    ctx.fillStyle = '#ffd93b'; ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.28); ctx.strokeStyle = '#6b3d05'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(x - r * 0.22, y - r * 0.28, Math.max(0.5, r * 0.16), 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// A spiral eye (dizzy): ink spiral in a pale disc. r = eye radius. dir flips the spin.
export function spiralEye(ctx, x, y, r, t, dir = 1, ink = '#2a1a0a') {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  const turns = 2.2, N = 36, rot = t * 6 * dir;
  for (let i = 0; i <= N; i++) { const f = i / N, a = rot + f * turns * TAU * dir, rr = r * 0.9 * f; i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.lineWidth = Math.max(0.9, r * 0.2); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = ink; ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- off-screen snapshot of the creature
let CA = null, C1 = null, C2 = null, CT = null; // creature, ring, shell, tiny outline sampler (pooled, grown on demand)
function pool(c, w, h, read) {
  if (!c) { c = document.createElement('canvas'); c._read = !!read; }
  if (c.width < w) c.width = w;
  if (c.height < h) c.height = h;
  return c;
}
const ctx2 = (c) => (c._ctx || (c._ctx = c.getContext('2d', c._read ? { willReadFrequently: true } : undefined)));

function snap(ctx, box, pad) {
  const m = ctx.getTransform();
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const x of [box.x0, box.x1]) for (const y of [box.y0, box.y1]) {
    const X = m.a * x + m.c * y + m.e, Y = m.b * x + m.d * y + m.f;
    x0 = Math.min(x0, X); y0 = Math.min(y0, Y); x1 = Math.max(x1, X); y1 = Math.max(y1, Y);
  }
  const ox = Math.floor(x0) - pad, oy = Math.floor(y0) - pad, W = Math.ceil(x1 - x0) + 2 * pad + 2, H = Math.ceil(y1 - y0) + 2 * pad + 2;
  if (!(W > 4 && H > 4) || W * H > 2.2e6 || typeof document === 'undefined') return null;
  CA = pool(CA, W, H);
  const a = ctx2(CA);
  a.setTransform(1, 0, 0, 1, 0, 0);
  a.globalAlpha = 1; a.globalCompositeOperation = 'source-over';
  a.clearRect(0, 0, CA.width, CA.height);
  a.setTransform(m.a, m.b, m.c, m.d, m.e - ox, m.f - oy);
  const sc = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1, det = m.a * m.d - m.b * m.c || 1;
  // device (X, Y) in the canvas -> local
  const toLocal = (X, Y) => { const dx = X + ox - m.e, dy = Y + oy - m.f; return [(m.d * dx - m.c * dy) / det, (-m.b * dx + m.a * dy) / det]; };
  const dirLocal = (X, Y) => { const u = (m.d * X - m.c * Y) / det, v = (-m.b * X + m.a * Y) / det, l = Math.hypot(u, v) || 1; return [u / l, v / l]; };
  return { a, m, ox, oy, W, H, sc, toLocal, dirLocal };
}

// outline of the snapshot: boundary points [x, y, nx, ny] (local units, outward normal), sorted by angle round the centroid
function outline(S) {
  const q = Math.min(1, 64 / Math.max(S.W, S.H)), w = Math.max(4, Math.round(S.W * q)), h = Math.max(4, Math.round(S.H * q));
  CT = pool(CT, w, h, true);
  const t = ctx2(CT);
  t.setTransform(1, 0, 0, 1, 0, 0);
  t.clearRect(0, 0, CT.width, CT.height);
  t.drawImage(CA, 0, 0, S.W, S.H, 0, 0, w, h);
  const d = t.getImageData(0, 0, w, h).data, sol = (i, j) => i >= 0 && j >= 0 && i < w && j < h && d[(j * w + i) * 4 + 3] > 60;
  let cx = 0, cy = 0, n = 0;
  const pts = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (!sol(i, j)) continue;
    cx += i; cy += j; n++;
    if (sol(i - 1, j) && sol(i + 1, j) && sol(i, j - 1) && sol(i, j + 1)) continue;
    let gx = 0, gy = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if ((di || dj) && !sol(i + di, j + dj)) { gx += di; gy += dj; }
    pts.push({ i, j, gx, gy });
  }
  if (!n) return { pts: [], c: [0, 0] };
  cx /= n; cy /= n;
  const out = pts.map((p) => {
    let gx = p.gx, gy = p.gy;
    if (!gx && !gy) { gx = p.i - cx; gy = p.j - cy; }
    const [nx, ny] = S.dirLocal(gx, gy), [x, y] = S.toLocal((p.i + 0.5) / q, (p.j + 0.5) / q);
    return { x, y, nx, ny, a: Math.atan2(p.j - cy, p.i - cx) };
  });
  out.sort((u, v) => u.a - v.a);
  return { pts: out, c: S.toLocal((cx + 0.5) / q, (cy + 0.5) / q) };
}
const pick = (pts, n, seed) => {
  if (!pts.length) return [];
  const r = [];
  for (let k = 0; k < n; k++) r.push(pts[Math.floor(((k + 0.15 + 0.7 * hash(seed + k * 5.1)) / n) * pts.length) % pts.length]);
  return r;
};

// the creature's silhouette grown by r device px into dst (recoloured to `color`)
function grow(dst, S, r, N, color) {
  dst.setTransform(1, 0, 0, 1, 0, 0);
  dst.globalCompositeOperation = 'source-over';
  dst.globalAlpha = 1;
  dst.clearRect(0, 0, dst.canvas.width, dst.canvas.height);
  for (let i = 0; i < N; i++) { const a = (i / N) * TAU; dst.drawImage(CA, 0, 0, S.W, S.H, Math.cos(a) * r, Math.sin(a) * r, S.W, S.H); }
  dst.drawImage(CA, 0, 0, S.W, S.H, 0, 0, S.W, S.H);
  dst.globalCompositeOperation = 'source-in';
  dst.fillStyle = color;
  dst.fillRect(0, 0, S.W, S.H);
  dst.globalCompositeOperation = 'source-over';
}

function shardPoly(ctx, x, y, r, a, k) {
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  ctx.lineTo(x + Math.cos(a + 2.1) * r * (0.45 + 0.2 * k), y + Math.sin(a + 2.1) * r * (0.45 + 0.2 * k));
  ctx.lineTo(x + Math.cos(a + 3.6) * r * 0.7, y + Math.sin(a + 3.6) * r * 0.7);
  ctx.closePath();
}

// jagged polyline between two points (crisp corners)
function jag(ctx, x0, y0, x1, y1, n, amp, seed) {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  ctx.moveTo(x0, y0);
  for (let i = 1; i < n; i++) { const f = i / n, o = (hash(seed + i * 1.37) - 0.5) * 2 * amp; ctx.lineTo(x0 + dx * f + nx * o, y0 + dy * f + ny * o); }
  ctx.lineTo(x1, y1);
}

// ---------------------------------------------------------------- the one entry point
// box: {x0, y0, x1, y1} in local units, a little bigger than the creature. draw(c) draws the creature on context c.
// st: from statusClock (null or a stun without a zap just draws it normally). o: { off (shell thickness), rim, crys (crystal size),
// quick (skip glints on tiny creatures) }. Returns true if it drew the creature itself.
export function statusDraw(ctx, box, draw, st, o = {}) {
  const k = st && st.k, zapping = k === 'stun' && st.zap >= 0;
  if (!st || (k === 'stun' && !zapping)) { draw(ctx); return false; }
  const off = o.off ?? 1.2, rim = o.rim ?? 1.6, cs = o.crys ?? 1;
  const M0 = ctx.getTransform(), s0 = Math.sqrt(Math.abs(M0.a * M0.d - M0.b * M0.c)) || 1;
  const S = snap(ctx, box, Math.ceil((off + rim + 7 * cs) * s0 + 3));
  if (!S) { draw(ctx); return false; }
  const a = S.a, sc = S.sc, age = st.age, seed = st.seed;
  draw(a);
  const thaw = k === 'thaw';
  // ----- tint (the creature's own colours go icy) and a faint diagonal sheen
  a.setTransform(1, 0, 0, 1, 0, 0);
  a.globalCompositeOperation = 'source-atop';
  if (k === 'ice' || thaw) {
    const warm = thaw ? 1 - clamp(age / 0.45, 0, 1) : 1;
    a.fillStyle = `rgba(191,230,255,${0.5 * warm})`; a.fillRect(0, 0, S.W, S.H);
    // a multiply pass (masked to the creature) keeps its dark outline readable through the ice
    C1 = pool(C1, S.W, S.H);
    const t1 = ctx2(C1);
    t1.setTransform(1, 0, 0, 1, 0, 0); t1.globalCompositeOperation = 'source-over'; t1.clearRect(0, 0, C1.width, C1.height);
    t1.drawImage(CA, 0, 0, S.W, S.H, 0, 0, S.W, S.H);
    t1.globalCompositeOperation = 'multiply'; t1.fillStyle = `rgba(185,212,244,${0.3 * warm})`; t1.fillRect(0, 0, S.W, S.H);
    t1.globalCompositeOperation = 'destination-in'; t1.drawImage(CA, 0, 0, S.W, S.H, 0, 0, S.W, S.H);
    t1.globalCompositeOperation = 'source-over';
    a.globalCompositeOperation = 'source-over'; a.drawImage(C1, 0, 0, S.W, S.H, 0, 0, S.W, S.H);
    a.globalCompositeOperation = 'source-atop';
    if (!thaw) {
      const g = a.createLinearGradient(0, 0, S.W, S.H);
      g.addColorStop(0, 'rgba(255,255,255,0.0)'); g.addColorStop(0.35, 'rgba(255,255,255,0.14)'); g.addColorStop(0.5, 'rgba(255,255,255,0.05)'); g.addColorStop(1, 'rgba(160,210,245,0.18)');
      a.fillStyle = g; a.fillRect(0, 0, S.W, S.H);
    }
  } else if (zapping) {
    const f = (1 - st.zap) ** 2;
    a.fillStyle = `rgba(255,226,90,${0.8 * f})`; a.fillRect(0, 0, S.W, S.H); // a hot yellow flash, not white
  }
  a.globalCompositeOperation = 'source-over';
  // ----- shake (shivering before the thaw, shaking itself off after it)
  let jx = 0, jy = 0;
  if (k === 'ice' && st.crack > 0) { jx = Math.sin(age * 83) * 0.9 * st.crack; jy = Math.cos(age * 71) * 0.6 * st.crack; }
  if (thaw) { const dec = 1 - clamp(age / ICE.thaw, 0, 1); jx = Math.sin(age * 58) * 2.4 * dec; jy = Math.cos(age * 47) * 1.2 * dec; }
  const needOutline = k === 'ice' || thaw || zapping;
  const OL = needOutline ? outline(S) : null;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const bx = S.ox + jx * sc, by = S.oy + jy * sc;
  if (k === 'ice') {
    const form = ease(age / 0.28), r1 = (off + rim) * sc * form, r0 = off * sc * form;
    const N = r0 > 14 ? 20 : 14;
    C1 = pool(C1, S.W, S.H); C2 = pool(C2, S.W, S.H);
    const c1 = ctx2(C1), c2 = ctx2(C2);
    grow(c2, S, r0, N, ICE.shell);
    grow(c1, S, r1, N, ICE.rim);
    c1.globalCompositeOperation = 'destination-out'; c1.drawImage(C2, 0, 0, S.W, S.H, 0, 0, S.W, S.H); c1.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = ICE.shellA;
    ctx.drawImage(C2, 0, 0, S.W, S.H, bx, by, S.W, S.H);
    ctx.globalAlpha = 1;
    ctx.drawImage(C1, 0, 0, S.W, S.H, bx, by, S.W, S.H);
  }
  ctx.drawImage(CA, 0, 0, S.W, S.H, bx, by, S.W, S.H);
  ctx.restore();
  if (!OL || !OL.pts.length) return true;
  // ----- details in local units
  ctx.save();
  ctx.setTransform(S.m.a, S.m.b, S.m.c, S.m.d, S.m.e + (S.m.a * jx + S.m.c * jy), S.m.f + (S.m.b * jx + S.m.d * jy));
  ctx.lineJoin = 'miter'; ctx.lineCap = 'butt';
  const form = k === 'ice' ? ease(age / 0.28) : 0;
  if (k === 'ice') {
    // facet glints: crisp white dashes in the shell band on the lit (upper left) side, one twinkles
    const lit = OL.pts.filter((p) => p.nx * -0.55 + p.ny * -0.8 > 0.25);
    const gl = pick(lit.length > 4 ? lit : OL.pts, 3, seed);
    gl.forEach((p, i) => {
      const dist = off * (0.45 + 0.1 * i) * form + 0.4, x = p.x + p.nx * dist, y = p.y + p.ny * dist, tx = -p.ny, ty = p.nx, L = (6 + 3 * (i % 2)) * Math.min(1.4, cs);
      ctx.strokeStyle = ICE.glint; ctx.lineWidth = Math.max(1.2, off * 0.42);
      ctx.beginPath(); ctx.moveTo(x - tx * L / 2, y - ty * L / 2); ctx.lineTo(x + tx * L / 2, y + ty * L / 2); ctx.stroke();
      if (i === 0 && !o.quick) { // a four-point twinkle on the first
        const tw = 0.6 + 0.4 * Math.sin(age * 6), r = 3.4 * cs * tw;
        ctx.fillStyle = ICE.glint; ctx.beginPath();
        ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.28, y - r * 0.28); ctx.lineTo(x + r, y); ctx.lineTo(x + r * 0.28, y + r * 0.28); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.28, y + r * 0.28); ctx.lineTo(x - r, y); ctx.lineTo(x - r * 0.28, y - r * 0.28); ctx.closePath(); ctx.fill();
      }
    });
    // two facet slashes across the body itself
    const fc = pick(OL.pts, 2, seed + 40);
    for (const p of fc) {
      const dx = OL.c[0] - p.x, dy = OL.c[1] - p.y, l = Math.hypot(dx, dy) || 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = Math.max(1, 0.9 * cs);
      ctx.beginPath(); ctx.moveTo(p.x + dx * 0.12, p.y + dy * 0.12); ctx.lineTo(p.x + dx * Math.min(0.42, 7 / l), p.y + dy * Math.min(0.42, 7 / l)); ctx.stroke();
    }
    // frost crystals standing on the shell's outline
    const nCr = o.quick ? 3 : 6;
    pick(OL.pts, nCr, seed + 9).forEach((p, i) => {
      const base = (off + rim * 0.4) * form, hgt = (3 + 2.6 * hash(seed + i)) * cs * form, w = 1.4 * cs + 0.4, tx = -p.ny, ty = p.nx, bxp = p.x + p.nx * base, byp = p.y + p.ny * base;
      ctx.beginPath();
      ctx.moveTo(bxp - tx * w, byp - ty * w); ctx.lineTo(bxp + p.nx * hgt + tx * w * 0.15, byp + p.ny * hgt + ty * w * 0.15); ctx.lineTo(bxp + tx * w, byp + ty * w); ctx.closePath();
      ctx.fillStyle = ICE.pale; ctx.fill();
      ctx.lineWidth = Math.max(0.9, rim * 0.6); ctx.strokeStyle = ICE.rim; ctx.lineJoin = 'miter'; ctx.stroke();
    });
    // hairline cracks from the outline toward the middle, longer as the thaw nears
    if (st.crack > 0.02) {
      const nCk = o.quick ? 4 : 7;
      pick(OL.pts, nCk, seed + 21).forEach((p, i) => {
        const dx = OL.c[0] - p.x, dy = OL.c[1] - p.y, f = clamp(st.crack * (1.15 - 0.4 * hash(seed + i * 3)), 0, 1) * (0.45 + 0.3 * hash(seed + i * 7)), ex = p.x + dx * f, ey = p.y + dy * f;
        ctx.beginPath(); jag(ctx, p.x, p.y, ex, ey, 4, Math.hypot(dx, dy) * 0.07, seed + i * 9);
        ctx.strokeStyle = ICE.rim; ctx.lineWidth = Math.max(1, 1.1 * cs * 0.8); ctx.stroke();
        ctx.beginPath(); jag(ctx, p.x + 0.6, p.y - 0.6, ex + 0.6, ey - 0.6, 4, Math.hypot(dx, dy) * 0.07, seed + i * 9);
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 0.7; ctx.stroke();
      });
    }
  } else if (thaw) {
    // angular shards pop off the outline and fall
    const n = o.quick ? 6 : 10, G = 70 * Math.max(0.5, cs);
    pick(OL.pts, n, seed + 5).forEach((p, i) => {
      const v = (14 + 22 * hash(seed + i * 2.3)) * cs, sp = hash(seed + i) * TAU, u = age,
        x = p.x + p.nx * (off + 2 + v * u) + (hash(i + seed) - 0.5) * 6 * u, y = p.y + p.ny * (off + 2 + v * u) + 0.5 * G * u * u - 6 * u,
        r = (3.4 + 3 * hash(seed + i * 4.1)) * cs, al = clamp((ICE.thaw - u) / 0.35, 0, 1);
      ctx.globalAlpha = al;
      shardPoly(ctx, x, y, r, sp + u * (3 + i % 4) * (i % 2 ? 1 : -1), hash(i));
      ctx.fillStyle = ICE.shell; ctx.fill();
      ctx.lineWidth = Math.max(0.9, rim * 0.6); ctx.strokeStyle = ICE.rim; ctx.stroke();
      ctx.strokeStyle = ICE.glint; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(x - r * 0.2, y - r * 0.35); ctx.lineTo(x + r * 0.25, y - r * 0.1); ctx.stroke();
    });
    ctx.globalAlpha = 1;
  } else if (zapping) {
    // crisp jagged arcs along the body, re-rolled 24 times a second
    const f = 1 - st.zap, fr = Math.floor(age * 24), n = o.quick ? 4 : 7, sz = Math.max(0.7, Math.min(1.5, cs));
    ctx.globalAlpha = clamp(f * 2.2, 0, 1);
    ctx.lineJoin = 'miter'; ctx.miterLimit = 3;
    const P = OL.pts;
    for (let i = 0; i < n; i++) {
      const ia = Math.floor(hash(seed + fr * 3.1 + i * 7.7) * P.length), p = P[ia];
      let qx, qy;
      if (i % 3 === 2) { const dx = OL.c[0] - p.x, dy = OL.c[1] - p.y; qx = p.x + dx * 0.45; qy = p.y + dy * 0.45; } // in toward the middle
      else { const q = P[(ia + Math.floor(P.length * (0.06 + 0.1 * hash(seed + fr + i)))) % P.length]; qx = q.x; qy = q.y; } // along the outline
      const L = Math.hypot(qx - p.x, qy - p.y);
      ctx.beginPath(); jag(ctx, p.x, p.y, qx, qy, 5 + (L > 24 ? 2 : 0), Math.max(1.6, L * 0.2), seed + fr * 5 + i * 3);
      boltStroke(ctx, 1.05 * sz, 1, null, 'miter');
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  return true;
}

// a bounding box round a list of points (px), padded
export function boxOf(pts, pad) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
}
