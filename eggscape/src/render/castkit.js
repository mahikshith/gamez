// Cast kit: the small shared drawing vocabulary of the reef / bayou / lab cast, so they read as one game's characters.
// One light, top-left. Every body gets FORM (lo band bottom-right, base, hi band top-left: crisp cel bands that follow the
// silhouette), a weighted ink line (heavier on the shadow side), tapered limbs that bend at real joints, and a glossy eye
// with a lid. All of it is plain path work: no shadowBlur, no filters, no per-frame gradients.
const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, k) => a + (b - a) * k;
export const ss = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
export const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
// overshoot ease (0 -> 1 with a little spring past 1)
export const back = (u, c = 1.9) => { u = clamp(u, 0, 1); return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
// a blink: 0 open .. 1 shut, a quick one every few seconds (seeded so a group never blinks together)
export function blinkAt(t, seed = 0) {
  const p = 3.1 + hash(seed + 5) * 2.2, u = ((t + hash(seed) * p) % p) / 0.16;
  return u < 1 ? Math.sin(u * Math.PI) : 0;
}

// a smooth path through points [[x, y], ...] (Catmull-Rom as beziers). closed: joins the ends.
export function spline(ctx, P, closed = true, tension = 0.5, move = true) {
  const n = P.length; if (n < 2) return;
  const at = (i) => (closed ? P[(i + n) % n] : P[clamp(i, 0, n - 1)]);
  if (move) ctx.moveTo(P[0][0], P[0][1]);
  const m = closed ? n : n - 1, k = tension / 3 * 2;
  for (let i = 0; i < m; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * k * 0.5, p1[1] + (p2[1] - p0[1]) * k * 0.5, p2[0] - (p3[0] - p1[0]) * k * 0.5, p2[1] - (p3[1] - p1[1]) * k * 0.5, p2[0], p2[1]);
  }
  if (closed) ctx.closePath();
}

// FORM: fill a silhouette with three crisp light bands and ink it. path() must build the whole path (beginPath included)
// and be callable again under a translation. d = band size (px in the current space). o: { lo, base, hi, line, lw, hiK
// (0 = no light band), inner(ctx) drawn clipped to the shape before the ink (markings, belly) }
export function form(ctx, path, o) {
  const d = o.d, lw = o.lw || 0;
  if (lw > 0 && o.line && !o.noWeight) { // the weighted line: a second, offset ink pass under the shape (thicker bottom-right)
    ctx.save(); ctx.translate(lw * 0.3, lw * 0.45); path(); ctx.lineWidth = lw * 1.5; ctx.strokeStyle = o.line; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
  }
  ctx.save();
  path(); ctx.fillStyle = o.lo; ctx.fill(); ctx.clip();
  ctx.save(); ctx.translate(-d * 0.55, -d); path(); ctx.fillStyle = o.hi && o.hiK !== 0 ? o.hi : o.base; ctx.fill();
  if (o.hi && o.hiK !== 0) { ctx.clip(); const h = d * (o.hiK || 0.8); ctx.translate(h * 0.55, h); path(); ctx.fillStyle = o.base; ctx.fill(); }
  ctx.restore();
  if (o.inner) o.inner(ctx);
  ctx.restore();
  if (lw > 0 && o.line) { path(); ctx.lineWidth = lw; ctx.strokeStyle = o.line; ctx.lineJoin = 'round'; ctx.stroke(); }
}

// two-bone IK: the joint between a (root) and b (tip) for bone lengths l1, l2; dir = +1 / -1 picks the bend side
export function ik(ax, ay, bx, by, l1, l2, dir = 1) {
  let dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1e-6;
  const dd = clamp(d, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3), a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  dx /= d; dy /= d;
  return [ax + dx * a - dy * h * dir, ay + dy * a + dx * h * dir];
}

// a tapered limb through points P [[x, y], ...] with half-widths W [..]: inked silhouette, then the fill (round joints)
export function limb(ctx, P, W, fill, line, lw) {
  const pass = (grow, col) => {
    ctx.fillStyle = col;
    for (let i = 0; i < P.length; i++) {
      const r = W[i] + grow;
      ctx.beginPath(); ctx.arc(P[i][0], P[i][1], r, 0, TAU); ctx.fill();
      if (i + 1 < P.length) {
        const r2 = W[i + 1] + grow, dx = P[i + 1][0] - P[i][0], dy = P[i + 1][1] - P[i][1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
        ctx.beginPath(); ctx.moveTo(P[i][0] + nx * r, P[i][1] + ny * r); ctx.lineTo(P[i + 1][0] + nx * r2, P[i + 1][1] + ny * r2); ctx.lineTo(P[i + 1][0] - nx * r2, P[i + 1][1] - ny * r2); ctx.lineTo(P[i][0] - nx * r, P[i][1] - ny * r); ctx.closePath(); ctx.fill();
      }
    }
  };
  if (line && lw > 0) pass(lw, line);
  pass(0, fill);
}

// a glossy eye. o: { r, iris, irisLo, pupil ('round' | 'slit' | 'dot'), look {x, y} (-1..1), lid 0..1 (from the top), lidCol,
// lidLo 0..1 (lower lid), line, lw, white (sclera colour: when set the iris is a disc inside it), shut (draw a closed arc), mad
// (rad: tilts the upper lid inward), spec (false = no highlight) }
export function eye(ctx, x, y, o) {
  const r = o.r, lw = o.lw ?? Math.max(0.8, r * 0.22), lk = o.look || { x: 0, y: 0 };
  ctx.save(); ctx.translate(x, y);
  if (o.shut) {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fillStyle = o.lidCol || o.iris; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = o.line; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.85, r * 0.1); ctx.quadraticCurveTo(0, r * (o.shut === 'squint' ? -0.5 : 0.7), r * 0.85, r * 0.1); ctx.lineWidth = lw * 1.15; ctx.lineCap = 'round'; ctx.stroke();
    ctx.restore(); return;
  }
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fillStyle = o.white || o.iris; ctx.fill();
  ctx.save(); ctx.clip();
  const px = lk.x * r * 0.32, py = lk.y * r * 0.3;
  if (o.white) { ctx.beginPath(); ctx.arc(px, py, r * (o.irisR || 0.62), 0, TAU); ctx.fillStyle = o.iris; ctx.fill(); }
  if (o.irisLo) { ctx.beginPath(); ctx.arc(o.white ? px : 0, (o.white ? py : 0) + r * 0.75, r * (o.white ? 0.75 : 1.1), 0, TAU); ctx.fillStyle = o.irisLo; ctx.globalAlpha *= 0.8; ctx.fill(); ctx.globalAlpha /= 0.8; }
  ctx.fillStyle = o.pupilCol || '#120a06';
  ctx.beginPath();
  if (o.pupil === 'slit') ctx.ellipse(px, py, r * (o.wide ? 0.34 : 0.2), r * 0.72, 0, 0, TAU);
  else ctx.arc(px, py, r * (o.pupilR || (o.pupil === 'dot' ? 0.3 : 0.42)) * (o.wide ? 1.2 : 1), 0, TAU);
  ctx.fill();
  if (o.spec !== false) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(px - r * 0.3, py - r * 0.34, r * 0.24, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(px + r * 0.28, py + r * 0.3, r * 0.1, 0, TAU); ctx.fill(); }
  const lid = clamp(o.lid || 0, 0, 1), lo = clamp(o.lidLo || 0, 0, 1);
  if (lid > 0.01) { ctx.save(); ctx.rotate(o.mad || 0); ctx.fillStyle = o.lidCol || '#000'; ctx.fillRect(-r * 1.6, -r * 1.6, r * 3.2, r * (0.6 + lid * 2)); ctx.restore(); }
  if (lo > 0.01) { ctx.fillStyle = o.lidCol || '#000'; ctx.fillRect(-r * 1.6, r * (1 - lo * 1.2), r * 3.2, r * 2); }
  ctx.restore();
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.lineWidth = lw; ctx.strokeStyle = o.line; ctx.stroke();
  if (lid > 0.01) { ctx.save(); ctx.rotate(o.mad || 0); const yl = -r + r * lid * 2 - r * 0.4, hw = Math.sqrt(Math.max(0, r * r - yl * yl)); ctx.beginPath(); ctx.moveTo(-hw, yl); ctx.lineTo(hw, yl); ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke(); ctx.restore(); }
  ctx.restore();
}

// a soft contact shadow on the floor under a creature (one flat ellipse, no blur)
export function contact(ctx, x, y, rx, ry, a = 0.26) {
  ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU); ctx.fill(); ctx.restore();
}

// a little "z" for a sleeper, drifting up (u 0..1 its life)
export function zed(ctx, x, y, r, u, line = '#14200c', fill = '#e8f4c8') {
  ctx.save(); ctx.translate(x + Math.sin(u * 5) * r * 0.5, y - u * r * 4); ctx.globalAlpha *= Math.sin(clamp(u, 0, 1) * Math.PI); const q = r * (0.6 + u * 0.6);
  ctx.beginPath(); ctx.moveTo(-q, -q); ctx.lineTo(q, -q); ctx.lineTo(-q, q); ctx.lineTo(q, q); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.lineWidth = q * 0.95; ctx.strokeStyle = line; ctx.stroke(); ctx.lineWidth = q * 0.42; ctx.strokeStyle = fill; ctx.stroke(); ctx.restore();
}

// action lines: n short strokes fanning out of (x, y) between angles a0..a1 (impact, snap, pop)
export function burst(ctx, x, y, r0, r1, a0, a1, n, w, col, line) {
  ctx.save(); ctx.lineCap = 'round';
  for (const [ww, c] of line ? [[w * 2.1, line], [w, col]] : [[w, col]]) {
    ctx.lineWidth = ww; ctx.strokeStyle = c; ctx.beginPath();
    for (let i = 0; i < n; i++) { const a = n > 1 ? lerp(a0, a1, i / (n - 1)) : (a0 + a1) / 2, q = i % 2 ? 0.8 : 1; ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1 * q, y + Math.sin(a) * r1 * q); }
    ctx.stroke();
  }
  ctx.restore();
}
