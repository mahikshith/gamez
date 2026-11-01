// v3 art: new creatures, hazards and special eggs. Every function draws in LOCAL y-down space centred
// on (cx, cy) in the units given (world callers wrap with scale(1,-1)). Art must never throw.
// These are placeholder bodies; the art pass replaces them without changing signatures.

const TAU = Math.PI * 2;
const safe = (ctx, f) => { ctx.save(); try { f(); } catch (e) { /* never break the frame */ } ctx.restore(); };

// Eagle seen from the side. s = wingspan. opts: { flap 0..1, dive 0..1 (wings folded), carrying: 'egg'|'snake'|null, face: 1|-1 }
export function drawEagle(ctx, cx, cy, s, t = 0, opts = {}) {
  safe(ctx, () => { ctx.translate(cx, cy); ctx.fillStyle = '#5a3a1e'; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.5, s * 0.12, 0, 0, TAU); ctx.fill(); });
}

// Wooden barrier standing across a channel. Local box: x in [-w/2, w/2], y in [-h, 0] (base at cy).
// melt 0..1 = venom eating it (green drips, sagging); burn 0..1 = fire eating it.
export function drawBarrier(ctx, cx, cy, w, h, t = 0, melt = 0, burn = 0) {
  safe(ctx, () => { ctx.translate(cx, cy); ctx.fillStyle = '#8a5a2b'; ctx.fillRect(-w / 2, -h * (1 - melt * 0.8), w, h * (1 - melt * 0.8)); });
}

// Glowing lava rock (volcano). r = radius. heat 0..1 (cools to dark crust).
export function drawLavaRock(ctx, cx, cy, r, t = 0, heat = 1) {
  safe(ctx, () => { ctx.fillStyle = heat > 0.5 ? '#ff6a1a' : '#4a3a34'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); });
}

// Molten patch on a ring where a lava rock melted it (a temporary hole). len = arc length in px, th = ring thickness px.
export function drawMeltHole(ctx, cx, cy, len, th, t = 0, life = 1) {
  safe(ctx, () => { ctx.fillStyle = `rgba(255,120,30,${0.6 * life})`; ctx.fillRect(cx - len / 2, cy - th / 2, len, th); });
}

// Falling icicle (frozen lake). h = length, pointing down (+y).
export function drawIcicle(ctx, cx, cy, h, t = 0) {
  safe(ctx, () => { ctx.fillStyle = '#cdeeff'; ctx.beginPath(); ctx.moveTo(cx - h * 0.15, cy - h / 2); ctx.lineTo(cx + h * 0.15, cy - h / 2); ctx.lineTo(cx, cy + h / 2); ctx.fill(); });
}

// Venom spit blob in flight / splash. r = radius, k 0..1 life.
export function drawVenom(ctx, cx, cy, r, t = 0, k = 1) {
  safe(ctx, () => { ctx.fillStyle = `rgba(120,230,60,${k})`; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); });
}

// Special eggs (Angry-Birds-style traits): 'ostrich' (big, cream, pores), 'quail' (small, speckled brown),
// 'duck' (pale blue-green). rx, ry = egg radii in px, rot = body angle, cracks 0..2.
export function drawEggKind(ctx, kind, cx, cy, rx, ry, rot = 0, t = 0, cracks = 0) {
  const col = { ostrich: '#f3ead2', quail: '#d8c09a', duck: '#cfe9e2' }[kind] || '#fff';
  safe(ctx, () => { ctx.translate(cx, cy); ctx.rotate(rot); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.fill(); });
}

// Thorn curtain hanging across a gap (only fire clears it). len = gap width px, h = hang length px.
export function drawThornCurtain(ctx, cx, cy, len, h, t = 0, burn = 0) {
  safe(ctx, () => { ctx.strokeStyle = '#b3263a'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i <= 4; i++) { const x = cx - len / 2 + (len * i) / 4; ctx.moveTo(x, cy); ctx.lineTo(x, cy + h * (1 - burn)); } ctx.stroke(); });
}

// Grate set into a ring floor: only small (quail) eggs pass. len = arc length px, th = ring thickness px.
export function drawGrate(ctx, cx, cy, len, th, t = 0) {
  safe(ctx, () => { ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.strokeRect(cx - len / 2, cy - th / 2, len, th); });
}

// One-way ring marker: chevrons pointing the allowed direction (dir 1 = counter-clockwise). size px.
export function drawOneWayMark(ctx, cx, cy, size, dir = 1, t = 0) {
  safe(ctx, () => { ctx.translate(cx, cy); ctx.scale(dir, 1); ctx.strokeStyle = '#ffd34a'; ctx.lineWidth = size * 0.18; ctx.beginPath(); ctx.moveTo(-size * 0.3, -size * 0.4); ctx.lineTo(size * 0.2, 0); ctx.lineTo(-size * 0.3, size * 0.4); ctx.stroke(); });
}
