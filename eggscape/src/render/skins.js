// Hen skins (2026-11-15, outfits 2026-11-16): what economy.js HEN_SKINS sells. Cosmetic only.
// Every skin is a real outfit WORN on the bird (mykee: "put a Christmas dress on the hen", no tie-like scarves):
//  - a garment that follows the body (clipped to the bird's own body silhouette, shaded with the body's cel crescent so
//    it reads as cloth on a round bird), with trims, belts, buttons, pockets, patterns;
//  - a sleeve on the near wing (hen), the feather tips stay feathers;
//  - a hat SEATED on the head: it hugs the crown and hides the comb (skinHidesComb) instead of floating over it.
// The hen, the rooster and the goose all wear the same set: each passes its own body geometry (G) to drawSkinOutfit and
// draws drawSkinHat in its head frame (comb on top, x -16..17, y -5..-27, head radius ~13, beak to +x).
const TAU = Math.PI * 2;
let SKIN = 'classic';
export const setSkinId = (id) => { SKIN = id || 'classic'; };
export const skinId = () => SKIN;

// feather tints for the hen's body (hen.js swaps its HEN palette)
export const HEN_TINT = {
  snowy: { hi: '#ffffff', mid: '#f3f8ff', lo: '#dbe8f6', shade: '#b7cbe2', scal: 'rgba(90,120,160,0.45)', wing: ['#ffffff', '#e6eef8'], wingLo: '#b4c6dc', far: ['#d9e4f1', '#b9cadd'], tail: ['#ffffff', '#dfe8f3'], tailLo: '#a9bdd4' },
  golden: { hi: '#fff6c2', mid: '#ffd84a', lo: '#efab1a', shade: '#c47f0a', scal: 'rgba(140,80,0,0.5)', wing: ['#ffe680', '#f2b324'], wingLo: '#b97a08', far: ['#e9b42c', '#c9900e'], tail: ['#ffe27a', '#efab1a'], tailLo: '#a86a04' },
  cocoa: { hi: '#e2b98c', mid: '#c8915c', lo: '#a86c3a', shade: '#8a5428', scal: 'rgba(70,36,10,0.55)', wing: ['#d9a774', '#b97e48'], wingLo: '#8e5a2a', far: ['#a87346', '#8a5a32'], tail: ['#c58a52', '#a56c3a'], tailLo: '#7d4a20' },
};

/* ------------------------------------------------------------------ small kit */
const lerpN = (a, b, k) => a + (b - a) * k;
const bez = (p0, p1, p2, p3, t) => { const u = 1 - t; return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]; };
const lin = (ctx, x0, y0, x1, y1, stops) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c)); return g; };
const poly = (ctx, pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); };
function edge(ctx, o, col, w = 0.9) { ctx.lineWidth = o * w; ctx.strokeStyle = col; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
function dot(ctx, x, y, r, fill, o, line, w = 0.6) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = fill; ctx.fill(); if (line) edge(ctx, o, line, w); }
// points offset along a polyline's normal (+ = to the left of travel)
function offsetPts(pts, d) {
  return pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [p[0] - (dy / l) * d, p[1] + (dx / l) * d, p[2]]; });
}

const FUR = { fill: '#ffffff', shade: '#e4e9f0', edge: '#c9bfb4' };
// a fluffy trim along a list of points: back lumps (edge), then front lumps, then a soft shade, so it has volume
function furTrim(ctx, o, pts, r, spots = false) {
  ctx.save();
  ctx.lineWidth = o * 0.9; ctx.strokeStyle = FUR.edge;
  for (const [x, y, k = 1] of pts) { ctx.beginPath(); ctx.arc(x, y, r * k, 0, TAU); ctx.stroke(); }
  for (const [x, y, k = 1] of pts) { ctx.beginPath(); ctx.arc(x, y, r * k, 0, TAU); ctx.fillStyle = FUR.fill; ctx.fill(); }
  ctx.fillStyle = FUR.shade;
  for (const [x, y, k = 1] of pts) { ctx.beginPath(); ctx.arc(x + r * k * 0.18, y + r * k * 0.32, r * k * 0.62, 0.15, Math.PI - 0.15); ctx.fill(); }
  if (spots) { ctx.fillStyle = '#1d1a20'; pts.forEach(([x, y], i) => { if (i % 2) return; ctx.beginPath(); ctx.ellipse(x, y - r * 0.1, r * 0.17, r * 0.42, 0, 0, TAU); ctx.fill(); }); } // ermine tails
  ctx.restore();
}
// a knitted / cloth band along a polyline: a darker underlay makes the inner edge line, ribs tick across it
function bandAlong(ctx, o, pts, w, col, line, rib = 0) {
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  poly(ctx, pts); ctx.lineWidth = w + o * 1.6; ctx.strokeStyle = line; ctx.stroke();
  poly(ctx, pts); ctx.lineWidth = w; ctx.strokeStyle = col; ctx.stroke();
  if (rib) {
    const A = offsetPts(pts, w * 0.42), B = offsetPts(pts, -w * 0.42);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = o * 0.55; ctx.beginPath();
    for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < rib; k++) {
      const u = k / rib; ctx.moveTo(lerpN(A[i][0], A[i + 1][0], u), lerpN(A[i][1], A[i + 1][1], u)); ctx.lineTo(lerpN(B[i][0], B[i + 1][0], u), lerpN(B[i][1], B[i + 1][1], u));
    }
    ctx.stroke();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ garments (body frame) */
// cloth over the clipped body: the shade colour first, then the lit gradient nudged toward the light (the body's own
// cel crescent), so the garment has the same round form as the feathers it covers
function cloth(ctx, G, c) {
  const [lx, ly, R] = G.light, [ox, oy] = G.off, [x0, y0, x1, y1] = G.box;
  ctx.fillStyle = c[3]; ctx.fillRect(x0 - 10, y0 - 10, x1 - x0 + 20, y1 - y0 + 20);
  ctx.save(); ctx.translate(ox, oy);
  const g = ctx.createRadialGradient(lx, ly, 4, lx, ly, R); g.addColorStop(0, c[0]); g.addColorStop(0.5, c[1]); g.addColorStop(1, c[2]);
  ctx.fillStyle = g; ctx.beginPath(); G.clip(ctx); ctx.fill();
  ctx.restore();
}
function belt(ctx, o, G, col, buckle, line = '#3a2412') {
  const B = G.belt, h = B.w;
  ctx.beginPath(); ctx.moveTo(B.x0, B.y0); ctx.quadraticCurveTo(B.cx, B.cy, B.x1, B.y1); ctx.lineTo(B.x1, B.y1 + h); ctx.quadraticCurveTo(B.cx, B.cy + h, B.x0, B.y0 + h); ctx.closePath();
  ctx.fillStyle = col; ctx.fill(); edge(ctx, o, line, 0.7);
  ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.beginPath(); ctx.moveTo(B.x0, B.y0); ctx.quadraticCurveTo(B.cx, B.cy, B.x1, B.y1); ctx.lineTo(B.x1, B.y1 + 1.4); ctx.quadraticCurveTo(B.cx, B.cy + 1.4, B.x0, B.y0 + 1.4); ctx.closePath(); ctx.fill();
  if (!buckle) return;
  const [bx, by, br] = G.buckle;
  ctx.save(); ctx.translate(bx, by); ctx.rotate(br);
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-4.6, -4.8, 9.2, 9.6, 1.8) : ctx.rect(-4.6, -4.8, 9.2, 9.6);
  ctx.fillStyle = buckle; ctx.fill(); edge(ctx, o, '#6a4a10', 0.8);
  ctx.beginPath(); ctx.rect(-2.2, -2.4, 4.4, 4.8); ctx.fillStyle = col; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(-3.8, -4, 2.2, 1.2);
  ctx.restore();
}
function buttons(ctx, o, G, fill, line, r = 1.9) { for (const [x, y] of G.buttons) { dot(ctx, x, y, r, fill, o, line); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.35, r * 0.35, 0, TAU); ctx.fill(); } }
const hemUp = (G, d) => G.hem.map(([x, y]) => [x, y + d]);
// open-front garments (vests): clip away the chest so her feathers show between the panels
function openFront(ctx, G) { ctx.beginPath(); ctx.rect(-90, -90, 180, 180); G.open(ctx); ctx.clip('evenodd'); }
function openEdge(ctx, o, G, col, w) { ctx.beginPath(); G.open(ctx); ctx.lineWidth = w; ctx.strokeStyle = col; ctx.stroke(); ctx.lineWidth = o * 0.8; ctx.strokeStyle = 'rgba(40,20,10,0.55)'; ctx.stroke(); }
function pocket(ctx, o, x, y, w, h, col, line) {
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w / 2, y - h / 2, w, h, 1.6) : ctx.rect(x - w / 2, y - h / 2, w, h); ctx.fillStyle = col; ctx.fill(); edge(ctx, o, line, 0.7);
  ctx.beginPath(); ctx.moveTo(x - w / 2, y - h / 2 + 2.6); ctx.lineTo(x + w / 2, y - h / 2 + 2.6); edge(ctx, o, line, 0.5);
}

// Each garment: (ctx, o, t, G) inside the body clip, then anything that sits on top (collars, buckles) after the clip.
const OUTFIT = {
  santa: {
    in(ctx, o, t, G) {
      cloth(ctx, G, ['#ff6450', '#e8301f', '#c41d12', '#a3140d']);
      belt(ctx, o, G, '#2b1b16', '#ffcf3a');
      furTrim(ctx, o, hemUp(G, 1.2).map(([x, y], i) => [x, y, i % 2 ? 0.95 : 1.08]), 5.3);
    },
    out(ctx, o, t, G) { buttons(ctx, o, G, '#ffd24a', '#8a5a08'); furTrim(ctx, o, G.collar, 4.6); },
    sleeve: { c: ['#d8301f', '#bb2216'], lo: '#8e140c', far: ['#b01f14', '#8a130b'], cuff: 'fur' },
  },
  snowy: { // a Christmas jumper: red knit, a white Nordic band with a zigzag and dots, ribbed hem and collar
    in(ctx, o, t, G) {
      cloth(ctx, G, ['#ff5a4a', '#dc2c22', '#b81d16', '#9a1610']);
      const [x0, , x1] = G.box, y = G.band;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x0 - 10, y - 5.5, x1 - x0 + 20, 11);
      ctx.strokeStyle = '#2f9a4a'; ctx.lineWidth = 1.9; ctx.lineJoin = 'miter'; ctx.beginPath();
      for (let x = x0 - 10, i = 0; x < x1 + 10; x += 4.2, i++) (i ? ctx.lineTo(x, y + (i % 2 ? -2.4 : 2.4)) : ctx.moveTo(x, y + 2.4));
      ctx.stroke();
      ctx.fillStyle = '#ffffff'; for (let x = x0 - 6, i = 0; x < x1 + 6; x += 7, i++) { dot(ctx, x + (i % 2) * 3.5, y - 10, 1.2, '#ffffff'); dot(ctx, x + ((i + 1) % 2) * 3.5, y + 11, 1.2, '#ffffff'); }
      ctx.lineJoin = 'round';
      bandAlong(ctx, o, G.hem, 11, '#c42219', '#7a120c', 2);
    },
    out(ctx, o, t, G) { bandAlong(ctx, o, G.collar, 6.5, '#d62a20', '#7a120c', 2); },
    sleeve: { c: ['#e8382c', '#c8251b'], lo: '#9a1610', far: ['#b81d16', '#8a130b'], cuff: { col: '#ffffff', line: '#b8a99c' } },
  },
  elf: { // a green tunic with a red pointed hem, black belt, a pointed collar
    in(ctx, o, t, G) {
      cloth(ctx, G, ['#6fdc72', '#2fa64a', '#1f8236', '#16692a']);
      belt(ctx, o, G, '#22201c', '#ffcf3a');
      const top = hemUp(G, -6.5), pts = [];
      top.forEach(([x, y], i) => pts.push([x, y + (i % 2 ? 6.5 : 0)]));
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      for (let i = G.hem.length - 1; i >= 0; i--) ctx.lineTo(G.hem[i][0], G.hem[i][1] + 8);
      ctx.closePath(); ctx.fillStyle = '#e23a2a'; ctx.fill(); edge(ctx, o, '#7a1810', 0.8);
      pts.forEach(([x, y], i) => { if (i % 2) dot(ctx, x, y + 0.6, 1.9, '#ffd23a', o, '#8a5a08', 0.5); });
    },
    out(ctx, o, t, G) {
      const C = G.collar, pts = [];
      for (let i = 0; i < C.length - 1; i++) { const [ax, ay] = C[i], [bx, by] = C[i + 1]; pts.push([[ax, ay - 1], [bx, by - 1], [(ax + bx) / 2 + 1, (ay + by) / 2 + 7]]); }
      for (const p of pts) { poly(ctx, p); ctx.closePath(); ctx.fillStyle = '#e23a2a'; ctx.fill(); edge(ctx, o, '#7a1810', 0.8); }
    },
    sleeve: { c: ['#3cbc58', '#279a40'], lo: '#16692a', far: ['#1f8236', '#16692a'], cuff: { col: '#e23a2a', line: '#7a1810' } },
  },
  reindeer: { // a fuzzy brown onesie with a cream belly, and a red collar with a jingle bell
    in(ctx, o, t, G) {
      cloth(ctx, G, ['#d39a64', '#a8703a', '#8a5428', '#70421c']);
      const [bx, by, rx, ry, rr] = G.belly;
      ctx.beginPath(); ctx.ellipse(bx, by, rx, ry, rr, 0, TAU); ctx.fillStyle = lin(ctx, bx, by - ry, bx, by + ry, ['#fff2da', '#f0d6ae']); ctx.fill();
      ctx.strokeStyle = 'rgba(120,70,30,0.35)'; ctx.lineWidth = o * 0.6; ctx.stroke();
      ctx.strokeStyle = 'rgba(70,36,10,0.25)'; ctx.lineWidth = o * 0.5; ctx.beginPath(); // fuzz ticks
      for (const [x, y] of G.fuzz) { ctx.moveTo(x, y); ctx.lineTo(x - 1.5, y + 2.5); ctx.moveTo(x + 3, y + 1); ctx.lineTo(x + 2, y + 3.5); }
      ctx.stroke();
      bandAlong(ctx, o, G.hem, 9, '#7a4a22', '#4a2a10', 0);
    },
    out(ctx, o, t, G) {
      bandAlong(ctx, o, G.collar, 5, '#d8302a', '#6a120c', 0);
      const C = G.collar, [x, y] = C[C.length - 2], sw = Math.sin(t * 2.6) * 0.15;
      ctx.save(); ctx.translate(x, y + 2.5); ctx.rotate(sw);
      dot(ctx, 0, 3, 3.6, lin(ctx, -3, 0, 3, 6, ['#fff3a0', '#e2a412']), o, '#7a5208', 0.8);
      ctx.fillStyle = '#5a3a08'; ctx.fillRect(-2.2, 4.2, 4.4, 0.9); dot(ctx, 0, 5.6, 0.8, '#5a3a08');
      ctx.restore();
    },
    sleeve: { c: ['#b57a44', '#9a6236'], lo: '#70421c', far: ['#8a5428', '#70421c'], cuff: { col: '#f0d6ae', line: '#8a5a2a' } },
  },
  cocoa: { // a cosy blue jumper with white stripes, red ribbing
    in(ctx, o, t, G) {
      cloth(ctx, G, ['#6aa4ff', '#2f6fd8', '#2457b0', '#1d4794']);
      const [x0, , x1] = G.box;
      ctx.fillStyle = 'rgba(255,255,255,0.92)'; for (const y of G.stripes) ctx.fillRect(x0 - 10, y, x1 - x0 + 20, 3.4);
      bandAlong(ctx, o, G.hem, 10, '#e8402e', '#7a1810', 2);
    },
    out(ctx, o, t, G) { bandAlong(ctx, o, G.collar, 6.5, '#e8402e', '#7a1810', 2); },
    sleeve: { c: ['#3f7ee6', '#2f6fd8'], lo: '#1d4794', far: ['#2457b0', '#1d4794'], cuff: { col: '#e8402e', line: '#7a1810' } },
  },
  royal: { // a purple velvet robe with gold sprigs, ermine hem and collar
    in(ctx, o, t, G) {
      cloth(ctx, G, ['#a45ae8', '#7a2fc0', '#5e2098', '#4a187a']);
      ctx.fillStyle = 'rgba(255,214,80,0.85)';
      for (const [x, y] of G.sprigs) { ctx.save(); ctx.translate(x, y); for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.ellipse(0, -1.6, 0.8, 1.6, 0, 0, TAU); ctx.fill(); } ctx.restore(); }
      furTrim(ctx, o, hemUp(G, 1.2).map(([x, y], i) => [x, y, i % 2 ? 0.95 : 1.08]), 5.3, true);
    },
    out(ctx, o, t, G) { buttons(ctx, o, G, '#ffd24a', '#8a5a08'); furTrim(ctx, o, G.collar, 4.6, true); },
    sleeve: { c: ['#8a3ad0', '#7a2fc0'], lo: '#4a187a', far: ['#5e2098', '#4a187a'], cuff: 'ermine' },
  },
  // ---- world outfits (one per world, World 1 .. 10)
  farmer: { // denim dungarees: trousers, a bib with a pocket, straps, gold stitching, brass buttons
    in(ctx, o, t, G) {
      const D = G.dung;
      ctx.save();
      ctx.beginPath(); D(ctx); ctx.clip();
      cloth(ctx, G, ['#6f9ee8', '#3d6fb8', '#30599a', '#264a82']);
      ctx.restore();
      ctx.beginPath(); D(ctx); edge(ctx, o, '#1d3560', 0.9);
      ctx.save(); ctx.setLineDash([1.8, 1.6]); ctx.lineWidth = 0.8; ctx.strokeStyle = '#f2b84a';
      ctx.beginPath(); G.dungSeam(ctx); ctx.stroke(); ctx.restore();
      const [px, py] = G.pockets[0]; pocket(ctx, o, px, py, 8, 7, '#4a7cc8', '#1d3560');
      bandAlong(ctx, o, G.hem, 7, '#5a88d0', '#1d3560', 0);
    },
    out(ctx, o, t, G) {
      ctx.save(); ctx.beginPath(); G.clip(ctx); ctx.clip();
      for (const S of G.strapPath) { poly(ctx, S); ctx.lineWidth = 5.4 + o * 1.6; ctx.strokeStyle = '#1d3560'; ctx.stroke(); poly(ctx, S); ctx.lineWidth = 5.4; ctx.strokeStyle = '#4a7cc8'; ctx.stroke(); }
      ctx.restore();
      for (const [x, y] of G.straps) dot(ctx, x, y, 1.9, '#ffd24a', o, '#7a5208');
    },
    sleeve: null,
  },
  lumberjack: { // a red buffalo-check shirt, brown leather belt, shirt collar points
    in(ctx, o, t, G) {
      cloth(ctx, G, ['#ff5a40', '#d23420', '#b02615', '#921e10']);
      const [x0, y0, x1, y1] = G.box;
      ctx.fillStyle = 'rgba(30,8,6,0.42)';
      for (let x = x0 - 4; x < x1 + 6; x += 10) ctx.fillRect(x, y0 - 10, 5, y1 - y0 + 20);
      for (let y = y0 - 2; y < y1 + 6; y += 10) ctx.fillRect(x0 - 10, y, x1 - x0 + 20, 5);
      belt(ctx, o, G, '#7a4a22', '#d8dde4');
      bandAlong(ctx, o, G.hem, 5, '#8a1a10', '#4a0e08', 0);
    },
    out(ctx, o, t, G) {
      buttons(ctx, o, G, '#f1e6d2', '#6a4a2a', 1.6);
      const C = G.collar, a = C[Math.floor(C.length / 2) - 1], b = C[C.length - 1];
      for (const [x, y, s] of [[a[0], a[1], -1], [b[0] - 3, b[1] - 1, 1]]) { poly(ctx, [[x - 5, y - 1], [x + 5, y - 1], [x + s * 2, y + 7]]); ctx.closePath(); ctx.fillStyle = '#d23420'; ctx.fill(); edge(ctx, o, '#5a120a', 0.8); }
    },
    sleeve: { c: ['#d63a24', '#b02615'], lo: '#7a160c', far: ['#a52414', '#7a160c'], cuff: { col: '#3a120c', line: '#1a0604' } },
  },
  skier: { // a puffy quilted ski jacket, high collar, zip
    in(ctx, o, t, G) {
      cloth(ctx, G, ['#5fe0ee', '#1fa6b8', '#178898', '#126f7c']);
      const [x0, y0, x1, y1] = G.box;
      for (let y = y0 + 4; y < y1; y += 8.5) { // puffs: a lit top, a seam under it
        ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(x0 - 10, y - 6, x1 - x0 + 20, 2.6);
        ctx.strokeStyle = 'rgba(10,60,70,0.55)'; ctx.lineWidth = o * 0.7; ctx.beginPath(); ctx.moveTo(x0 - 10, y); ctx.quadraticCurveTo((x0 + x1) / 2, y + 3, x1 + 10, y); ctx.stroke();
      }
      ctx.beginPath(); G.zip(ctx); ctx.lineWidth = 2.2; ctx.strokeStyle = '#0d4a54'; ctx.stroke(); ctx.setLineDash([0.8, 1]); ctx.lineWidth = 1.4; ctx.strokeStyle = '#d8e4ea'; ctx.stroke(); ctx.setLineDash([]);
      bandAlong(ctx, o, G.hem, 8, '#ff6a3a', '#7a2810', 0);
    },
    out(ctx, o, t, G) { bandAlong(ctx, o, G.collar, 8, '#ff6a3a', '#7a2810', 0); const C = G.collar, [x, y] = C[C.length - 2]; dot(ctx, x, y + 4, 1.6, '#d8e4ea', o, '#34505a', 0.6); },
    sleeve: { c: ['#2cbccc', '#1fa6b8'], lo: '#126f7c', far: ['#178898', '#126f7c'], cuff: { col: '#ff6a3a', line: '#7a2810' } },
  },
  miner: { // an orange hi-vis vest with reflective stripes, open front, a tool belt
    in(ctx, o, t, G) {
      ctx.save(); openFront(ctx, G);
      cloth(ctx, G, ['#ffb04a', '#ff8a1e', '#e8700e', '#c95e08']);
      const [x0, , x1] = G.box;
      for (const y of G.reflect) { ctx.fillStyle = '#ffe94a'; ctx.fillRect(x0 - 10, y - 3.4, x1 - x0 + 20, 6.8); ctx.fillStyle = '#d8dde4'; ctx.fillRect(x0 - 10, y - 1.6, x1 - x0 + 20, 3.2); }
      ctx.restore();
      openEdge(ctx, o, G, '#e8700e', 2.2);
      belt(ctx, o, G, '#7a4a22', '#c9ced6');
    },
    out() {},
    sleeve: null,
  },
  firefighter: { // a tan turnout coat with yellow-and-silver reflective bands, black clasps
    in(ctx, o, t, G) {
      cloth(ctx, G, ['#f2cf7a', '#d8a640', '#bd8a2a', '#9e701e']);
      const [x0, , x1] = G.box;
      for (const y of G.reflect) { ctx.fillStyle = '#ffe94a'; ctx.fillRect(x0 - 10, y - 3.6, x1 - x0 + 20, 7.2); ctx.fillStyle = '#d8dde4'; ctx.fillRect(x0 - 10, y - 1.7, x1 - x0 + 20, 3.4); }
      bandAlong(ctx, o, G.hem, 6, '#8a6418', '#4a3408', 0);
    },
    out(ctx, o, t, G) {
      for (const [x, y] of G.buttons) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - 2.6, y - 1.3, 5.2, 2.6, 1) : ctx.rect(x - 2.6, y - 1.3, 5.2, 2.6); ctx.fillStyle = '#22201c'; ctx.fill(); }
      bandAlong(ctx, o, G.collar, 6, '#bd8a2a', '#5a3e10', 0); bandAlong(ctx, o, G.collar, 1.6, '#ffe94a', '#9a8a20', 0);
    },
    sleeve: { c: ['#e6bb5a', '#d8a640'], lo: '#9e701e', far: ['#bd8a2a', '#9e701e'], cuff: { col: '#ffe94a', line: '#9a8a20' } },
  },
  raincoat: { // a glossy yellow raincoat with wooden toggles
    in(ctx, o, t, G) {
      cloth(ctx, G, ['#fff07a', '#ffd02a', '#f2b414', '#d89a0a']);
      ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 2; ctx.lineCap = 'round'; // gloss streaks
      for (const [x, y, l] of G.gloss) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + l * 0.3, y + l); ctx.stroke(); }
      bandAlong(ctx, o, G.hem, 6, '#e8a80e', '#8a5a08', 0);
      ctx.save(); ctx.setLineDash([1.4, 1.4]); ctx.lineWidth = 0.7; ctx.strokeStyle = '#a87408'; poly(ctx, hemUp(G, -4.5)); ctx.stroke(); ctx.restore();
    },
    out(ctx, o, t, G) {
      for (const [x, y] of G.buttons) { ctx.save(); ctx.translate(x, y); ctx.rotate(-0.4); ctx.beginPath(); ctx.ellipse(0, 0, 4, 1.7, 0, 0, TAU); ctx.fillStyle = '#8a5a2a'; ctx.fill(); edge(ctx, o, '#4a2a10', 0.6); ctx.restore(); ctx.beginPath(); ctx.arc(x - 3.6, y + 0.4, 1.6, -1, 1.6); edge(ctx, o, '#3a2a1a', 0.7); }
      bandAlong(ctx, o, G.collar, 6.5, '#ffd02a', '#8a5a08', 0);
    },
    sleeve: { c: ['#ffe04a', '#ffd02a'], lo: '#d89a0a', far: ['#f2b414', '#d89a0a'], cuff: { col: '#e8a80e', line: '#8a5a08' } },
  },
  pirate: { // a navy captain's coat with gold braid, a red sash, double row of gold buttons
    in(ctx, o, t, G) {
      cloth(ctx, G, ['#4a6ad0', '#22408a', '#1a3270', '#14285a']);
      belt(ctx, o, G, '#d8302a', null, '#6a120c');
      const B = G.belt; dot(ctx, B.x0 + 14, B.y0 + B.w * 0.6 + 2.6, 3.4, '#c42219', o, '#6a120c', 0.7); // the sash knot at the side
      bandAlong(ctx, o, G.hem, 6, '#ffcc3a', '#8a5a08', 0);
    },
    out(ctx, o, t, G) { buttons(ctx, o, G, '#ffd24a', '#8a5a08', 1.6); for (const [x, y] of G.buttons) dot(ctx, x - 5, y + 0.6, 1.4, '#ffd24a', o, '#8a5a08'); bandAlong(ctx, o, G.collar, 5, '#ffcc3a', '#8a5a08', 0); },
    sleeve: { c: ['#2f50a8', '#22408a'], lo: '#14285a', far: ['#1a3270', '#14285a'], cuff: { col: '#ffcc3a', line: '#8a5a08' } },
  },
  diver: { // a black wetsuit with teal side panels and a front zip
    in(ctx, o, t, G) {
      cloth(ctx, G, ['#4a5c6a', '#25333e', '#1c2830', '#141d24']);
      ctx.beginPath(); G.panel(ctx); ctx.fillStyle = '#19b4c8'; ctx.fill(); edge(ctx, o, '#0a4a54', 0.6);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.ellipse(G.light[0] + 4, G.light[1] + 6, 14, 5, -0.3, 0, TAU); ctx.fill();
      ctx.beginPath(); G.zip(ctx); ctx.lineWidth = 1.8; ctx.strokeStyle = '#d8e4ea'; ctx.setLineDash([0.8, 1]); ctx.stroke(); ctx.setLineDash([]);
      bandAlong(ctx, o, G.hem, 6, '#19b4c8', '#0a4a54', 0);
    },
    out(ctx, o, t, G) { bandAlong(ctx, o, G.collar, 5.5, '#25333e', '#0d1418', 0); },
    sleeve: { c: ['#33434f', '#25333e'], lo: '#141d24', far: ['#1c2830', '#141d24'], cuff: { col: '#19b4c8', line: '#0a4a54' } },
  },
  fisher: { // an olive fishing vest, open front, pockets, a fly pinned on
    in(ctx, o, t, G) {
      ctx.save(); openFront(ctx, G);
      cloth(ctx, G, ['#a8b45e', '#7d8a3c', '#66722e', '#525c24']);
      ctx.restore();
      openEdge(ctx, o, G, '#5a6428', 2);
      for (const [x, y] of G.pockets) pocket(ctx, o, x, y, 8.5, 7.5, '#8a9848', '#3a4218');
      bandAlong(ctx, o, G.hem, 5, '#66722e', '#3a4218', 0);
    },
    out(ctx, o, t, G) { const [x, y] = G.pockets[0]; fly(ctx, o, x + 2, y - 6, 0.8); },
    sleeve: null,
  },
  scientist: { // a white lab coat: lapels, a breast pocket with pens, grey buttons
    in(ctx, o, t, G) {
      cloth(ctx, G, ['#ffffff', '#f2f6fa', '#d9e2ec', '#bfccda']);
      ctx.beginPath(); G.lapel(ctx); ctx.fillStyle = '#e6edf4'; ctx.fill(); edge(ctx, o, '#8a9aac', 0.7);
      const [px, py] = G.pockets[0];
      ctx.fillStyle = '#2f6fd8'; ctx.fillRect(px - 2.6, py - 7, 1.6, 5); ctx.fillStyle = '#e8402e'; ctx.fillRect(px + 0.4, py - 6.2, 1.6, 4.2);
      pocket(ctx, o, px, py, 8, 6.5, '#f6f9fc', '#8a9aac');
      bandAlong(ctx, o, G.hem, 3, '#e6edf4', '#8a9aac', 0);
    },
    out(ctx, o, t, G) { buttons(ctx, o, G, '#c9d3de', '#6a7a8c', 1.6); },
    sleeve: { c: ['#ffffff', '#eef3f8'], lo: '#c3cfdc', far: ['#dfe7ef', '#c3cfdc'], cuff: { col: '#e6edf4', line: '#8a9aac' } },
  },
};
// a fishing fly: a hook, a red-and-white body, a feather
function fly(ctx, o, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(0, 3); ctx.arc(1.6, 3, 1.6, Math.PI, 0, true); edge(ctx, o, '#8a949e', 0.7);
  ctx.beginPath(); ctx.ellipse(0, -1, 1.5, 2.4, 0, 0, TAU); ctx.fillStyle = '#e8402e'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(-2, -3.4, 1.2, 3, -0.7, 0, TAU); ctx.fillStyle = '#ffd23a'; ctx.fill();
  ctx.restore();
}

// The outfit, in the bird's body frame, drawn right after its body. G: the bird's garment geometry (hen.js / allies.js).
export function drawSkinOutfit(ctx, o, t, G, id = SKIN) {
  const F = OUTFIT[id];
  if (!F || !G) return;
  ctx.save();
  try {
    ctx.save(); ctx.beginPath(); G.clip(ctx); ctx.clip(); F.in(ctx, o, t, G); ctx.restore();
    F.out(ctx, o, t, G);
  } catch (e) { /* art must never break the frame */ }
  ctx.restore();
}
export const hasOutfit = (id = SKIN) => !!OUTFIT[id];

// Sleeve colours for the near / far wing (hen.js paints the shoulder half of the wing in these, then the cuff).
export function skinSleeve(id = SKIN) { return (OUTFIT[id] && OUTFIT[id].sleeve) || null; }
// the cuff across a sleeve, in the wing's frame (x along the wing, from the shoulder); y0..y1 its width there
export function drawSleeveCuff(ctx, o, x, y0, y1, cuff = 'fur') {
  if (cuff === 'fur' || cuff === 'ermine') {
    const pts = [];
    for (let i = 0; i <= 4; i++) pts.push([x + (i % 2 ? 0.7 : -0.4), lerpN(y0, y1, i / 4), i % 2 ? 0.9 : 1.05]);
    furTrim(ctx, o, pts, 2.9, cuff === 'ermine');
  } else if (cuff) bandAlong(ctx, o, [[x, y0 + 1], [x + 0.4, y1 - 1]], 5, cuff.col, cuff.line, 0);
}

/* ------------------------------------------------------------------ hats (head frame) */
// hats that sit over the crown hide the comb (it would poke out round the hat)
const NO_HAT = { diver: 1, scientist: 1 };
export const skinHidesComb = (id = SKIN) => !!OUTFIT[id] && !NO_HAT[id];

// the crown band: points round the head, tilted back so it clears the eyes
function crownPts(n = 7, r = 0) { const pts = []; for (let i = 0; i <= n; i++) { const a = Math.PI + 0.42 + (i / n) * (Math.PI - 1.1); pts.push([(14.2 + r) * Math.cos(a), -1.8 + (13.2 + r) * Math.sin(a)]); } return pts; }
// a soft cap over the crown (covers the comb: x -14..14, y -8..-25); top: how tall
function dome(ctx, o, fill, line, top = -30.5, w = 1) {
  ctx.beginPath();
  ctx.moveTo(-13.5 * w, -8);
  ctx.bezierCurveTo(-16 * w, -20, -11 * w, top, -1, top);
  ctx.bezierCurveTo(9 * w, top, 15.5 * w, -22, 13.5 * w, -12);
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); edge(ctx, o, line, 1);
}
function sheen(ctx, top = -30.5) {
  ctx.save(); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.ellipse(-6, top + 6.5, 5, 2.4, -0.5, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(40,10,0,0.18)'; ctx.beginPath(); ctx.ellipse(8, -12, 10, 6, -0.3, 0, TAU); ctx.fill();
  ctx.restore();
}
const domeG = (ctx, a, b, c, top = -30.5) => lin(ctx, -8, top, 6, -9, [a, b, c]);

function santaHat(ctx, o, t) {
  const sw = Math.sin(t * 2.3) * 1.6, sw2 = Math.sin(t * 2.3 - 0.6) * 1.1;
  ctx.beginPath(); // floppy tip first (behind the cap)
  ctx.moveTo(-6, -27); ctx.bezierCurveTo(-14, -31, -22 + sw2, -29, -26 + sw, -19); ctx.lineTo(-22.5 + sw, -17.5); ctx.bezierCurveTo(-19 + sw2, -23, -13, -22, -9, -18); ctx.closePath();
  ctx.fillStyle = lin(ctx, -26, -30, -8, -16, ['#d01d12', '#a5120b']); ctx.fill(); edge(ctx, o, '#5a1a10', 1);
  dome(ctx, o, domeG(ctx, '#ff5a46', '#e3271a', '#b3150e'), '#5a1a10'); sheen(ctx);
  furTrim(ctx, o, crownPts().map(([x, y], i) => [x, y, i % 2 ? 0.92 : 1.05]), 3.5);
  furTrim(ctx, o, [[-25.5 + sw, -16.5, 1], [-27.5 + sw, -14.6, 0.7], [-23.4 + sw, -14.2, 0.68]], 4.4);
}

const HATS = {
  santa: santaHat,
  snowy(ctx, o, t) { // a fur trapper hat: knitted top, a thick fur band, an ear flap
    furTrim(ctx, o, [[-11.5, 2, 0.9], [-12.5, 7, 0.95], [-10.8, 11, 0.8]], 4.2);
    dome(ctx, o, domeG(ctx, '#bfe6ff', '#6fb8ec', '#3f8cc8', -29), '#1d4a78', -29); sheen(ctx, -29);
    ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.1; ctx.beginPath(); for (let x = -12; x <= 12; x += 4) { ctx.moveTo(x, -28); ctx.lineTo(x + 1, -10); } ctx.stroke(); ctx.restore();
    furTrim(ctx, o, crownPts().map(([x, y], i) => [x, y, i % 2 ? 0.95 : 1.1]), 4.2);
  },
  elf(ctx, o, t) { // a tall pointed cap that bends back, a bell, a red petal band
    const sw = Math.sin(t * 2.3) * 1.4;
    ctx.beginPath(); ctx.moveTo(-10, -22); ctx.bezierCurveTo(-10, -40, -16 + sw, -46, -27 + sw, -42); ctx.bezierCurveTo(-17 + sw, -40, -4, -36, 4, -24); ctx.closePath();
    ctx.fillStyle = lin(ctx, -26, -44, 0, -22, ['#2a9a40', '#4fd060']); ctx.fill(); edge(ctx, o, '#0e4a1a', 1);
    dome(ctx, o, domeG(ctx, '#6fdc72', '#2fa64a', '#1f8236'), '#0e4a1a', -28); sheen(ctx, -28);
    const P = crownPts(8), up = P.map(([x, y]) => [x, y - 3]);
    ctx.beginPath(); up.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    for (let i = P.length - 1; i >= 0; i--) ctx.lineTo(P[i][0], P[i][1] + (i % 2 ? 5 : 1.5));
    ctx.closePath(); ctx.fillStyle = '#e23a2a'; ctx.fill(); edge(ctx, o, '#7a1810', 0.9);
    dot(ctx, -27.5 + sw, -41, 3.4, lin(ctx, -30, -44, -25, -38, ['#fff3a0', '#e2a412']), o, '#7a5208', 0.8);
    ctx.fillStyle = '#5a3a08'; ctx.fillRect(-28.4 + sw, -40.4, 1.8, 2.2);
  },
  reindeer(ctx, o, t) { // a brown hood-cap with antlers and ears
    for (const [bx, s, k] of [[-7, -1, 0.95], [5, 1, 1]]) {
      ctx.save(); ctx.translate(bx, -25); ctx.scale((s < 0 ? -1 : 1) * k, k);
      ctx.beginPath(); ctx.moveTo(-1.6, 0); ctx.quadraticCurveTo(-5, -10, -2, -20); ctx.lineTo(1.6, -19); ctx.quadraticCurveTo(-1.5, -10, 2, 0); ctx.closePath();
      ctx.moveTo(-3, -9); ctx.quadraticCurveTo(-9, -12, -10.5, -17); ctx.lineTo(-7.8, -18); ctx.quadraticCurveTo(-6.5, -14, -2.4, -12.4); ctx.closePath();
      ctx.moveTo(-2.2, -15); ctx.quadraticCurveTo(2.5, -18, 4.2, -23); ctx.lineTo(6.4, -21.6); ctx.quadraticCurveTo(3.4, -16, -1, -13); ctx.closePath();
      ctx.fillStyle = '#d8b07a'; ctx.fill(); edge(ctx, o, '#5a3410', 0.9);
      ctx.restore();
    }
    ctx.save(); ctx.translate(-13, -15); ctx.rotate(-0.9); ctx.beginPath(); ctx.ellipse(0, -4, 3.2, 6.5, 0, 0, TAU); ctx.fillStyle = '#9a6236'; ctx.fill(); edge(ctx, o, '#4a2a10', 0.8); ctx.beginPath(); ctx.ellipse(0, -4, 1.6, 4.4, 0, 0, TAU); ctx.fillStyle = '#f2a8a0'; ctx.fill(); ctx.restore();
    dome(ctx, o, domeG(ctx, '#c88a52', '#9a6236', '#7a4a22', -28), '#4a2a10', -28); sheen(ctx, -28);
    bandAlong(ctx, o, crownPts(), 5, '#7a4a22', '#3a1e08', 0);
  },
  cocoa(ctx, o, t) { // a striped bobble beanie, ribbed band
    const sw = Math.sin(t * 2.3) * 0.6;
    dome(ctx, o, domeG(ctx, '#6aa4ff', '#2f6fd8', '#1d4794', -29), '#12306a', -29);
    ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,0.95)'; for (const y of [-16, -23]) ctx.fillRect(-20, y, 40, 3.2); ctx.restore();
    ctx.beginPath(); ctx.moveTo(-13.5, -8); ctx.bezierCurveTo(-16, -20, -11, -29, -1, -29); ctx.bezierCurveTo(9, -29, 15.5, -22, 13.5, -12); ctx.closePath(); sheen(ctx, -29);
    bandAlong(ctx, o, crownPts(), 6, '#e8402e', '#7a1810', 2);
    furTrim(ctx, o, [[-1 + sw, -32, 1], [-3 + sw, -30.5, 0.7], [1.2 + sw, -30.2, 0.7]], 4.4);
  },
  royal(ctx, o, t) { // a velvet cap inside a gold crown with pearls and a ruby
    dome(ctx, o, domeG(ctx, '#b06ae8', '#7a2fc0', '#4a187a', -27), '#2a0e48', -27); sheen(ctx, -27);
    const P = crownPts(8), tips = P.map(([x, y], i) => [x * 0.98, y - (i % 2 ? 6.5 : 12)]);
    ctx.beginPath(); P.forEach(([x, y], i) => { const [tx, ty] = tips[i]; if (!i) ctx.moveTo(x, y + 2); ctx.lineTo(tx, ty); if (i < P.length - 1) ctx.lineTo((tx + tips[i + 1][0]) / 2, (y + P[i + 1][1]) / 2 - 3.5); });
    for (let i = P.length - 1; i >= 0; i--) ctx.lineTo(P[i][0], P[i][1] + 2);
    ctx.closePath(); ctx.fillStyle = lin(ctx, 0, -30, 0, -6, ['#fff0a0', '#ffc834', '#d88a0a']); ctx.fill(); edge(ctx, o, '#7a4a04', 0.9);
    tips.forEach(([x, y], i) => { if (!(i % 2)) dot(ctx, x, y, 1.7, '#fffaf0', o, '#a89a80', 0.5); });
    const [jx, jy] = P[Math.floor(P.length / 2) + 1]; dot(ctx, jx, jy - 2.5, 2.3, '#e8203a', o, '#6a0a14', 0.6); dot(ctx, P[2][0], P[2][1] - 2.5, 1.8, '#2a8ae8', o, '#0a2a5a', 0.5);
  },
  farmer(ctx, o, t) { // a straw hat: wide brim, woven crown, red band
    const straw = (x0, y0, x1, y1) => lin(ctx, x0, y0, x1, y1, ['#ffe9a0', '#f2cc62', '#d8a838']);
    ctx.beginPath(); ctx.ellipse(-1, -10, 25, 6, -0.1, 0, TAU); ctx.fillStyle = straw(0, -16, 0, -4); ctx.fill(); edge(ctx, o, '#8a5a10', 1);
    ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(140,90,20,0.45)'; ctx.lineWidth = 0.6; ctx.beginPath(); for (let a = 0; a < TAU; a += 0.32) { ctx.moveTo(-1 + Math.cos(a) * 14, -10 + Math.sin(a) * 3.4); ctx.lineTo(-1 + Math.cos(a) * 25, -10 + Math.sin(a) * 6); } ctx.stroke(); ctx.restore();
    ctx.beginPath(); ctx.moveTo(-12, -10); ctx.bezierCurveTo(-13, -22, -9, -27, 0, -27); ctx.bezierCurveTo(9, -27, 12, -22, 11, -11); ctx.quadraticCurveTo(0, -7, -12, -10); ctx.closePath();
    ctx.fillStyle = straw(-8, -27, 6, -9); ctx.fill(); edge(ctx, o, '#8a5a10', 1);
    ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(140,90,20,0.4)'; ctx.lineWidth = 0.6; ctx.beginPath(); for (let y = -24; y < -9; y += 2.6) { ctx.moveTo(-14, y); ctx.lineTo(14, y + 1); } ctx.stroke(); ctx.restore();
    ctx.beginPath(); ctx.moveTo(-12.4, -12.6); ctx.quadraticCurveTo(0, -9.4, 11.4, -14); ctx.lineTo(11.2, -10.8); ctx.quadraticCurveTo(0, -6.6, -12.2, -9.6); ctx.closePath(); ctx.fillStyle = '#e23a2a'; ctx.fill(); edge(ctx, o, '#7a1810', 0.7);
    ctx.save(); ctx.translate(-8, -13); ctx.rotate(-0.5); ctx.beginPath(); ctx.ellipse(0, -5, 1.6, 6, 0.2, 0, TAU); ctx.fillStyle = '#f6efe2'; ctx.fill(); edge(ctx, o, '#8a7a60', 0.5); ctx.restore(); // a feather tucked in
  },
  lumberjack(ctx, o, t) { // a cuffed knit beanie
    dome(ctx, o, domeG(ctx, '#3a3430', '#22201c', '#141210', -28.5), '#0a0806', -28.5);
    ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1.2; ctx.beginPath(); for (let x = -12; x <= 12; x += 3.4) { ctx.moveTo(x, -28); ctx.lineTo(x + 1, -10); } ctx.stroke(); ctx.restore();
    bandAlong(ctx, o, crownPts(7, 0.6), 8, '#c42a1a', '#4a0a04', 3);
  },
  skier(ctx, o, t) { // a knit beanie with a snowflake band and a big pompom, goggles on the band
    const sw = Math.sin(t * 2.3) * 0.7;
    dome(ctx, o, domeG(ctx, '#ffffff', '#e8f2f8', '#bcd2e0', -29), '#4a6a7c', -29); sheen(ctx, -29);
    ctx.save(); ctx.beginPath(); ctx.moveTo(-13.5, -8); ctx.bezierCurveTo(-16, -20, -11, -29, -1, -29); ctx.bezierCurveTo(9, -29, 15.5, -22, 13.5, -12); ctx.closePath(); ctx.clip();
    ctx.fillStyle = '#1fa6b8'; ctx.fillRect(-20, -22, 40, 5); ctx.fillStyle = '#ffffff'; for (let x = -14; x < 14; x += 5) { ctx.beginPath(); ctx.moveTo(x, -19.5); ctx.lineTo(x + 1.6, -21.4); ctx.lineTo(x + 3.2, -19.5); ctx.lineTo(x + 1.6, -17.6); ctx.closePath(); ctx.fill(); } ctx.restore();
    bandAlong(ctx, o, crownPts(), 6.5, '#ff6a3a', '#7a2810', 2);
    furTrim(ctx, o, [[-1 + sw, -32.5, 1], [-3.4 + sw, -31, 0.75], [1.4 + sw, -30.6, 0.75]], 5);
  },
  miner(ctx, o, t) { // a yellow hard hat with a ridge, a brim and a lamp
    const P = crownPts();
    ctx.beginPath(); ctx.ellipse(0, -9.6, 17.5, 3.4, -0.08, 0, TAU); ctx.fillStyle = '#f2b414'; ctx.fill(); edge(ctx, o, '#7a5208', 0.9);
    dome(ctx, o, domeG(ctx, '#fff07a', '#ffd02a', '#e8a80e', -27), '#7a5208', -27); sheen(ctx, -27);
    ctx.beginPath(); ctx.moveTo(-9, -24.6); ctx.quadraticCurveTo(0, -29.4, 10, -22.8); edge(ctx, o, '#c98a08', 1.6);
    void P;
    const glow = 0.55 + 0.25 * Math.sin(t * 3);
    ctx.save(); ctx.globalAlpha *= glow; ctx.fillStyle = lin(ctx, 13, -18, 34, -14, ['rgba(255,250,200,0.9)', 'rgba(255,250,200,0)']); ctx.beginPath(); ctx.moveTo(13, -19.5); ctx.lineTo(36, -26); ctx.lineTo(36, -8); ctx.lineTo(13, -15.5); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(8, -21, 6.4, 6, 1.4) : ctx.rect(8, -21, 6.4, 6); ctx.fillStyle = '#5a646e'; ctx.fill(); edge(ctx, o, '#22282e', 0.8);
    dot(ctx, 14, -17.8, 2.4, '#fffbe0', o, '#8a8a60', 0.6);
  },
  firefighter(ctx, o, t) { // a red fire helmet: long back brim, a ridge, a gold shield
    ctx.beginPath(); ctx.moveTo(14, -10.5); ctx.quadraticCurveTo(0, -13, -16, -11); ctx.quadraticCurveTo(-26, -9, -27, -4); ctx.quadraticCurveTo(-18, -5.5, -8, -6.4); ctx.quadraticCurveTo(6, -7.4, 14, -10.5); ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, -13, 0, -4, ['#e8302a', '#a8140e']); ctx.fill(); edge(ctx, o, '#4a0a06', 1);
    dome(ctx, o, domeG(ctx, '#ff6a50', '#e3271a', '#a8140e', -29), '#4a0a06', -29); sheen(ctx, -29);
    ctx.beginPath(); ctx.moveTo(-11, -22); ctx.quadraticCurveTo(-1, -32.4, 10, -24); edge(ctx, o, '#ffcc3a', 2.4); ctx.beginPath(); ctx.moveTo(-11, -22); ctx.quadraticCurveTo(-1, -32.4, 10, -24); edge(ctx, o, '#4a0a06', 0.6);
    ctx.save(); ctx.translate(8.5, -16.5); ctx.rotate(0.2);
    ctx.beginPath(); ctx.moveTo(0, -5.2); ctx.lineTo(4.4, -3.2); ctx.lineTo(3.6, 2.4); ctx.lineTo(0, 5); ctx.lineTo(-3.6, 2.4); ctx.lineTo(-4.4, -3.2); ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, -5, 0, 5, ['#fff0a0', '#e2a412']); ctx.fill(); edge(ctx, o, '#7a5208', 0.7);
    ctx.fillStyle = '#c42219'; ctx.beginPath(); ctx.arc(0, -0.2, 1.8, 0, TAU); ctx.fill();
    ctx.restore();
  },
  raincoat(ctx, o, t) { // a sou'wester: yellow, its brim longer at the back, stitched
    ctx.beginPath(); ctx.moveTo(20, -8); ctx.quadraticCurveTo(19, -14, 8, -15); ctx.quadraticCurveTo(-8, -15.5, -17, -12); ctx.quadraticCurveTo(-27, -9, -27, -2); ctx.quadraticCurveTo(-17, -5, -6, -6.6); ctx.quadraticCurveTo(10, -7.4, 20, -8); ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, -15, 0, -3, ['#ffe04a', '#e8a80e']); ctx.fill(); edge(ctx, o, '#7a5208', 1);
    ctx.save(); ctx.setLineDash([1.4, 1.4]); ctx.beginPath(); ctx.moveTo(17, -9.6); ctx.quadraticCurveTo(0, -12, -15, -9.6); ctx.quadraticCurveTo(-23, -7.6, -24, -3.6); edge(ctx, o, '#a87408', 0.6); ctx.restore();
    dome(ctx, o, domeG(ctx, '#fff07a', '#ffd02a', '#e8a80e', -27), '#7a5208', -27); sheen(ctx, -27);
    ctx.save(); ctx.setLineDash([1.4, 1.4]); ctx.beginPath(); ctx.moveTo(-1, -26.6); ctx.quadraticCurveTo(1, -18, -1, -11); edge(ctx, o, '#a87408', 0.6); ctx.restore();
  },
  pirate(ctx, o, t) { // a black tricorn with gold braid and a white skull
    ctx.beginPath(); ctx.moveTo(-23, -12); ctx.quadraticCurveTo(-19, -27, -9, -29); ctx.quadraticCurveTo(-2, -23, 4, -24); ctx.quadraticCurveTo(13, -31, 18, -24); ctx.quadraticCurveTo(21, -15, 17, -9); ctx.quadraticCurveTo(0, -4, -23, -12); ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, -30, 0, -6, ['#3a3644', '#1c1a22', '#0e0d12']); ctx.fill(); edge(ctx, o, '#050408', 1);
    ctx.beginPath(); ctx.moveTo(-22, -12.6); ctx.quadraticCurveTo(-18.4, -26, -9, -27.8); ctx.quadraticCurveTo(-2, -22, 4, -22.8); ctx.quadraticCurveTo(12.6, -29.6, 17, -23.4); edge(ctx, o, '#ffcc3a', 1.6);
    ctx.save(); ctx.translate(2, -16);
    ctx.beginPath(); ctx.arc(0, -1, 3.6, 0, TAU); ctx.fillStyle = '#f6efe2'; ctx.fill(); ctx.fillRect(-2, 1.4, 4, 2.6);
    ctx.fillStyle = '#1c1a22'; dot(ctx, -1.3, -1.2, 1, '#1c1a22'); dot(ctx, 1.3, -1.2, 1, '#1c1a22'); ctx.fillRect(-0.3, 1.8, 0.6, 2);
    ctx.strokeStyle = '#f6efe2'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(-5, 3); ctx.lineTo(5, 7); ctx.moveTo(5, 3); ctx.lineTo(-5, 7); ctx.stroke();
    ctx.restore();
  },
  diver(ctx, o, t) { // a dive mask over the eyes (glass, so her eyes still act) and a snorkel
    ctx.beginPath(); ctx.moveTo(-8, -1.5); ctx.lineTo(-14, -2.4); edge(ctx, o, '#141d24', 3.4);
    ctx.beginPath(); ctx.moveTo(-10, 8); ctx.quadraticCurveTo(-13, 9, -13.4, 4); ctx.lineTo(-14, -24); edge(ctx, o, '#141d24', 4.4); ctx.beginPath(); ctx.moveTo(-10, 8); ctx.quadraticCurveTo(-13, 9, -13.4, 4); ctx.lineTo(-14, -24); edge(ctx, o, '#ff7a2a', 2.6);
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-15.6, -28, 4, 5, 1.2) : ctx.rect(-15.6, -28, 4, 5); ctx.fillStyle = '#19b4c8'; ctx.fill(); edge(ctx, o, '#0a4a54', 0.6);
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-8, -7.5, 23, 15, 6) : ctx.rect(-8, -7.5, 23, 15);
    ctx.fillStyle = 'rgba(150,225,255,0.26)'; ctx.fill(); edge(ctx, o, '#141d24', 2.4); edge(ctx, o, '#19b4c8', 0.9);
    ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-4, 6); ctx.lineTo(4, -6); ctx.moveTo(1, 6); ctx.lineTo(6.4, -2); ctx.stroke(); ctx.restore();
  },
  fisher(ctx, o, t) { // a khaki bucket hat with a fly hooked in it
    ctx.beginPath(); ctx.moveTo(-17, -6); ctx.quadraticCurveTo(-15, -11, -12, -12); ctx.lineTo(12, -14.6); ctx.quadraticCurveTo(15.6, -13.6, 17.4, -8.6); ctx.quadraticCurveTo(0, -5, -17, -6); ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, -14, 0, -6, ['#c8c08a', '#9a9058']); ctx.fill(); edge(ctx, o, '#4a4420', 1);
    ctx.save(); ctx.setLineDash([1.2, 1.2]); ctx.beginPath(); ctx.moveTo(-15, -8); ctx.quadraticCurveTo(0, -7.4, 15.4, -10.4); edge(ctx, o, '#6a6230', 0.5); ctx.restore();
    ctx.beginPath(); ctx.moveTo(-12, -12); ctx.bezierCurveTo(-12.6, -24, -8, -27.4, 0, -27.4); ctx.bezierCurveTo(8, -27.4, 12.6, -24, 12, -14.6); ctx.quadraticCurveTo(0, -11, -12, -12); ctx.closePath();
    ctx.fillStyle = lin(ctx, -6, -27, 6, -11, ['#ddd6a2', '#b8ae74', '#968c56']); ctx.fill(); edge(ctx, o, '#4a4420', 1); sheen(ctx, -27);
    ctx.beginPath(); ctx.moveTo(-12, -14.6); ctx.quadraticCurveTo(0, -12, 12, -17); ctx.lineTo(12, -14.6); ctx.quadraticCurveTo(0, -10, -12, -12); ctx.closePath(); ctx.fillStyle = '#5a6428'; ctx.fill();
    fly(ctx, o, -6, -18, 0.9);
  },
  scientist(ctx, o, t) { // round spectacles (the comb stays: a scientist's wild crest)
    ctx.save(); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-6.6, -0.4); ctx.lineTo(-13, -2.4); edge(ctx, o, '#3a2a1a', 1.2);
    ctx.beginPath(); ctx.ellipse(0, 1, 7.2, 7.4, 0, 0, TAU); ctx.fillStyle = 'rgba(200,235,255,0.18)'; ctx.fill(); edge(ctx, o, '#3a2a1a', 1.5);
    ctx.beginPath(); ctx.ellipse(10.6, -0.2, 4.6, 6.6, 0, 0, TAU); ctx.fillStyle = 'rgba(200,235,255,0.18)'; ctx.fill(); edge(ctx, o, '#3a2a1a', 1.3);
    ctx.beginPath(); ctx.moveTo(6.8, -1.4); ctx.quadraticCurveTo(6.6, -3.4, 6.2, -1.8); edge(ctx, o, '#3a2a1a', 1.2);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(0, 1, 5.4, -2.4, -1.6); ctx.stroke();
    ctx.restore();
  },
};

// the hat, in the bird's head frame. t: seconds (pompoms and bells swing). Returns true if it covers the comb.
export function drawSkinHat(ctx, o, t = 0, id = SKIN) {
  const H = HATS[id];
  if (!H) return false;
  ctx.save();
  try { ctx.lineJoin = 'round'; ctx.lineCap = 'round'; H(ctx, o, t); } catch (e) { /* art must never break the frame */ }
  ctx.restore();
  return skinHidesComb(id);
}

// a red nose over the beak tip (reindeer), in the head frame; (x, y) is the beak tip
export function drawSkinNose(ctx, o, x, y, t = 0, id = SKIN) {
  if (id !== 'reindeer') return;
  const g = 0.5 + 0.5 * Math.sin(t * 3);
  ctx.save();
  ctx.fillStyle = `rgba(255,80,60,${0.25 * g})`; ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, 3.6, 0, TAU); ctx.fillStyle = '#ff2e1f'; ctx.fill(); edge(ctx, o, '#4a2410', 0.7);
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(x - 1.1, y - 1.2, 1, 0, TAU); ctx.fill();
  ctx.restore();
}

// Retired 2026-11-16: the knitted scarf read as a necktie (mykee). Outfits carry their own collars now.
export function drawSkinNeck() {}

/* ------------------------------------------------------------------ garment geometry for each bird */
// The hen (hen.js bodyPath, body frame: x -43..37, y -15..41, beak to +x).
export function henGarment(bodyPath) {
  const hem = [];
  for (let i = 0; i <= 3; i++) hem.push(bez([22, -9], [37, 0], [37, 26], [17, 35], 0.62 + i * 0.12));
  for (let i = 1; i <= 7; i++) hem.push(bez([17, 35], [3, 41], [-19, 40], [-30, 29], i / 7));
  for (let i = 1; i <= 3; i++) hem.push(bez([-30, 29], [-40, 19], [-43, 3], [-37, -8], i * 0.11));
  const collar = [];
  for (let i = 0; i <= 6; i++) { const u = i / 6; collar.push([lerpN(3, 31.5, u), lerpN(-13, -4, u) + Math.sin(u * Math.PI) * 4.2, i % 2 ? 0.9 : 1.05]); } // a ring round the base of her neck (sags at the front)
  return {
    clip: bodyPath, box: [-45, -17, 40, 43], light: [-12, -16, 66], off: [-4.5, -5.5],
    hem, collar,
    belt: { x0: -50, y0: 17, cx: -5, cy: 25, x1: 45, y1: 18, w: 7 }, buckle: [26, 21.4, -0.12],
    buttons: [[29.5, 4], [30.5, 12.5]],
    band: 8, stripes: [0, 9, 18, 27], reflect: [5, 27], gloss: [[24, -2, 9], [-30, 6, 8]],
    belly: [23, 17, 11, 17, -0.25], fuzz: [[-26, 22], [-14, 30], [6, 31], [-34, 10], [14, 22]],
    sprigs: [[-26, 22], [-12, 31], [4, 31], [18, 25], [28, 8], [-36, 8]],
    pockets: [[22, 4], [2, 27], [-18, 28]], straps: [[19.5, -3.5], [-31, -4]], strapPath: [[[19.5, -3.5], [14, -16]], [[-31, -4], [-26, -16]]],
    open: (c) => { c.moveTo(16, -24); c.quadraticCurveTo(9, 8, 23, 46); c.lineTo(60, 46); c.lineTo(60, -24); c.closePath(); },
    zip: (c) => { c.moveTo(31.5, -3); c.quadraticCurveTo(35, 10, 29, 31); },
    lapel: (c) => { c.moveTo(14, -11); c.lineTo(22, 6); c.lineTo(25.5, -4); c.lineTo(30, -1); c.lineTo(31, -4); c.closePath(); },
    panel: (c) => { c.moveTo(-50, 8); c.quadraticCurveTo(-10, -2, 45, 6); c.lineTo(45, 11); c.quadraticCurveTo(-10, 4, -50, 14); c.closePath(); },
    dung: (c) => { c.moveTo(-50, 4); c.quadraticCurveTo(-10, 8, 16, 6); c.lineTo(17, -6); c.lineTo(32, -6); c.lineTo(40, -2); c.lineTo(45, 50); c.lineTo(-50, 50); c.closePath(); },
    dungSeam: (c) => { c.moveTo(-50, 6.6); c.quadraticCurveTo(-10, 10.6, 18.6, 8.6); c.lineTo(19.4, -3.6); c.lineTo(30.6, -3.6); c.moveTo(-5, 20); c.lineTo(-5, 42); },
  };
}
// a bird with an elliptical body (rooster, goose): centre (cx, cy), radii, rotation; neck base at nb, chest front at fr
export function ovalGarment(cx, cy, rx, ry, rot, nb, k = {}) {
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const at = (a, d = 0) => { const x = (rx + d) * Math.cos(a), y = (ry + d) * Math.sin(a); return [cx + x * cr - y * sr, cy + x * sr + y * cr]; };
  const hem = []; for (let i = 0; i <= 12; i++) hem.push(at(lerpN(k.h0 ?? 0.25, k.h1 ?? 2.75, i / 12)));
  const collar = []; for (let i = 0; i <= 6; i++) { const u = i / 6; collar.push([lerpN(nb[0], nb[2], u), lerpN(nb[1], nb[3], u) + Math.sin(u * Math.PI) * 2, i % 2 ? 0.9 : 1.05]); }
  const fr = at(k.fa ?? 0.2, -5), fr2 = at((k.fa ?? 0.2) + 0.5, -5), bl = at(k.ba ?? 0.55, -2);
  const by = bl[1] - 4;
  const clip = (c) => c.ellipse(cx, cy, rx, ry, rot, 0, TAU);
  return {
    clip, box: [cx - rx - 4, cy - ry - 8, cx + rx + 4, cy + ry + 8], light: [cx - 10, cy - 18, rx * 1.9], off: [-4.5, -5.5],
    hem, collar,
    belt: { x0: cx - rx - 8, y0: by, cx: cx, cy: by + 7, x1: cx + rx + 8, y1: by, w: 7 }, buckle: [bl[0] - 2, by + 4.4, -0.1],
    buttons: [fr, fr2],
    band: cy - 2, stripes: [cy - 12, cy - 3, cy + 6, cy + 15], reflect: [cy - 6, cy + 14], gloss: [[fr[0] - 6, fr[1] - 4, 8], [cx - rx * 0.6, cy - 4, 7]],
    belly: [fr[0] - 6, cy + 6, ry * 0.5, ry * 0.7, -0.25], fuzz: [[cx - 18, cy + 8], [cx - 6, cy + 16], [cx + 8, cy + 18], [cx - 26, cy - 2]],
    sprigs: [[cx - 20, cy + 8], [cx - 6, cy + 16], [cx + 10, cy + 16], [cx + 20, cy + 4], [cx - 28, cy - 6]],
    pockets: [[fr[0] - 8, cy - 2], [cx, cy + 14], [cx - 16, cy + 14]], straps: [[fr[0] - 11, fr[1] - 9]], strapPath: [[[fr[0] - 11, fr[1] - 9], [fr[0] - 18, cy - ry - 6]]],
    open: (c) => { c.moveTo(fr[0] - 12, cy - ry - 10); c.quadraticCurveTo(fr[0] - 18, cy, fr[0] - 4, cy + ry + 10); c.lineTo(cx + rx + 40, cy + ry + 10); c.lineTo(cx + rx + 40, cy - ry - 10); c.closePath(); },
    zip: (c) => { c.moveTo(fr[0], fr[1] - 8); c.quadraticCurveTo(fr[0] + 3, cy + 4, fr[0] - 4, cy + ry - 3); },
    lapel: (c) => { c.moveTo(nb[0], nb[1]); c.lineTo(fr[0] - 6, cy + 4); c.lineTo(fr[0] - 3, fr[1]); c.lineTo(nb[2], nb[3]); c.closePath(); },
    panel: (c) => { c.moveTo(cx - rx - 8, cy - 2); c.quadraticCurveTo(cx, cy - 10, cx + rx + 8, cy - 4); c.lineTo(cx + rx + 8, cy + 2); c.quadraticCurveTo(cx, cy - 4, cx - rx - 8, cy + 4); c.closePath(); },
    dung: (c) => { c.moveTo(cx - rx - 8, cy - 4); c.quadraticCurveTo(cx, cy, fr[0] - 14, cy - 3); c.lineTo(fr[0] - 13, fr[1] - 10); c.lineTo(fr[0] + 8, fr[1] - 12); c.lineTo(cx + rx + 8, cy + ry + 8); c.lineTo(cx - rx - 8, cy + ry + 8); c.closePath(); },
    dungSeam: (c) => { c.moveTo(cx - rx - 8, cy - 1.6); c.quadraticCurveTo(cx, cy + 2.4, fr[0] - 11.6, cy - 0.6); c.lineTo(fr[0] - 10.8, fr[1] - 7.6); c.lineTo(fr[0] + 6, fr[1] - 9.6); },
  };
}
