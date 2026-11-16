// Hen and rooster skins (2026-11-15): the hats, scarves and feather tints that economy.js HEN_SKINS sells. Cosmetic only.
// Both birds draw their head in a local frame with the comb on top (x -16..17, y -5..-27, head radius ~13, beak to +x),
// so one set of hats fits both. drawSkinHat is called right after the comb, drawSkinNeck after the body.
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

const line = (ctx, o) => { ctx.lineWidth = o * 1.05; ctx.strokeStyle = '#4a2410'; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; };
function fur(ctx, x, y, r, o) { // a white fluffy ball (pompom, fur trim lumps)
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = o * 1.1; ctx.strokeStyle = '#7d8a9c'; ctx.stroke();
  ctx.fillStyle = 'rgba(150,170,200,0.35)'; ctx.beginPath(); ctx.arc(x + r * 0.25, y + r * 0.3, r * 0.55, 0, TAU); ctx.fill();
}
function cone(ctx, o, base0, base1, tip, cols, bend = 0) {
  ctx.beginPath(); ctx.moveTo(base0[0], base0[1]);
  ctx.quadraticCurveTo((base0[0] + tip[0]) / 2 - bend, (base0[1] + tip[1]) / 2 - bend * 0.4, tip[0], tip[1]);
  ctx.quadraticCurveTo((base1[0] + tip[0]) / 2 + bend * 0.2, (base1[1] + tip[1]) / 2, base1[0], base1[1]);
  ctx.closePath();
  const g = ctx.createLinearGradient(base0[0], base0[1], base1[0], tip[1]); g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]);
  ctx.fillStyle = g; ctx.fill(); line(ctx, o); ctx.stroke();
}

// the hat, in the bird's head frame. t: seconds (the pompom and the bell swing). Returns true if it covers the comb.
export function drawSkinHat(ctx, o, t = 0, id = SKIN) {
  const sw = Math.sin(t * 2.3) * 1.5;
  ctx.save();
  if (id === 'santa') santaHat(ctx, o, t);
  else if (id === 'elf') {
    cone(ctx, o, [-14, -9], [14, -10], [10 + sw, -40], ['#5fd06a', '#1f7a2e'], -5);
    ctx.beginPath(); ctx.moveTo(-15, -11); for (let i = 0; i <= 6; i++) ctx.lineTo(-15 + i * 5, i % 2 ? -5.5 : -10.5); ctx.lineTo(15, -11); ctx.closePath();
    ctx.fillStyle = '#e8402e'; ctx.fill(); line(ctx, o); ctx.stroke();
    ctx.beginPath(); ctx.arc(10 + sw, -41, 3.6, 0, TAU); ctx.fillStyle = '#ffd23a'; ctx.fill(); line(ctx, o); ctx.stroke();
    ctx.fillStyle = '#3a1a0c'; ctx.fillRect(9.2 + sw, -40.5, 1.6, 2.4);
  } else if (id === 'reindeer') {
    for (const [bx, s] of [[-7, -1], [6, 1]]) { // two antlers with two tines each
      ctx.save(); ctx.translate(bx, -12); ctx.scale(s < 0 ? -1 : 1, 1);
      ctx.beginPath(); ctx.moveTo(-1.6, 0); ctx.quadraticCurveTo(-6, -12, -2, -24); ctx.lineTo(1.6, -23); ctx.quadraticCurveTo(-2, -12, 2, 0); ctx.closePath();
      ctx.moveTo(-3.6, -12); ctx.quadraticCurveTo(-10, -15, -12, -21); ctx.lineTo(-9, -22); ctx.quadraticCurveTo(-7, -17, -2.5, -15); ctx.closePath();
      ctx.moveTo(-2.4, -19); ctx.quadraticCurveTo(3, -22, 5, -28); ctx.lineTo(7.4, -26.4); ctx.quadraticCurveTo(4, -20, -1.2, -16.6); ctx.closePath();
      ctx.fillStyle = '#a8703a'; ctx.fill(); line(ctx, o); ctx.stroke();
      ctx.restore();
    }
  } else if (id === 'cocoa') { // a striped bobble beanie
    ctx.beginPath(); ctx.moveTo(-15, -8); ctx.bezierCurveTo(-16, -30, 16, -30, 15, -8); ctx.closePath();
    ctx.fillStyle = '#2f6fd8'; ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = '#ffffff'; for (const y of [-14, -22]) ctx.fillRect(-20, y, 40, 3.6); ctx.restore();
    line(ctx, o); ctx.stroke();
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-16, -11, 32, 6, 3) : ctx.rect(-16, -11, 32, 6); ctx.fillStyle = '#e8402e'; ctx.fill(); line(ctx, o); ctx.stroke();
    fur(ctx, 0 + sw * 0.4, -29, 4.4, o);
  } else if (id === 'royal') { // a gold crown with three red gems
    ctx.beginPath(); ctx.moveTo(-13, -8); ctx.lineTo(-15, -26); ctx.lineTo(-7, -17); ctx.lineTo(0, -29); ctx.lineTo(7, -17); ctx.lineTo(15, -26); ctx.lineTo(13, -8); ctx.closePath();
    const g = ctx.createLinearGradient(0, -29, 0, -8); g.addColorStop(0, '#fff0a0'); g.addColorStop(1, '#e09a12');
    ctx.fillStyle = g; ctx.fill(); line(ctx, o); ctx.stroke();
    for (const [x, y] of [[-15, -26], [0, -29], [15, -26]]) { ctx.beginPath(); ctx.arc(x, y, 2.3, 0, TAU); ctx.fillStyle = '#ffe680'; ctx.fill(); }
    for (const x of [-7, 0, 7]) { ctx.beginPath(); ctx.arc(x, -12, 2.4, 0, TAU); ctx.fillStyle = '#e8402e'; ctx.fill(); }
  } else { ctx.restore(); return false; }
  ctx.restore();
  return id !== 'reindeer';
}

// a red nose over the beak tip (reindeer), in the head frame; (x, y) is the beak tip
export function drawSkinNose(ctx, o, x, y, t = 0, id = SKIN) {
  if (id !== 'reindeer') return;
  const g = 0.5 + 0.5 * Math.sin(t * 3);
  ctx.save();
  ctx.fillStyle = `rgba(255,80,60,${0.25 * g})`; ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, 3.6, 0, TAU); ctx.fillStyle = '#ff2e1f'; ctx.fill(); line(ctx, o * 0.7); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(x - 1.1, y - 1.2, 1, 0, TAU); ctx.fill();
  ctx.restore();
}

// a knitted scarf round the neck (snowy, and the elf/santa sets get a cosy one too); (x, y) neck centre in the body frame
export function drawSkinNeck(ctx, o, x, y, t = 0, id = SKIN) {
  const col = id === 'snowy' ? ['#e8402e', '#ffffff'] : id === 'elf' ? ['#e8402e', '#ffd23a'] : id === 'royal' ? ['#7a2fb8', '#ffd23a'] : null;
  if (!col) return;
  ctx.save();
  if (id === 'royal') { // an ermine collar
    ctx.beginPath(); ctx.ellipse(x, y, 13, 5.5, -0.25, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill(); line(ctx, o * 0.8); ctx.stroke();
    ctx.fillStyle = '#1a1a1a'; for (const d of [-7, 0, 7]) { ctx.beginPath(); ctx.ellipse(x + d, y + 0.5, 0.9, 1.6, 0, 0, TAU); ctx.fill(); }
    ctx.restore(); return;
  }
  const sw = Math.sin(t * 2.6) * 2;
  // the tail hanging down the chest
  ctx.beginPath(); ctx.moveTo(x + 2, y + 2); ctx.lineTo(x + 9 + sw * 0.3, y + 16); ctx.lineTo(x + 3 + sw * 0.3, y + 18); ctx.lineTo(x - 3, y + 3); ctx.closePath();
  ctx.fillStyle = col[0]; ctx.fill(); line(ctx, o * 0.8); ctx.stroke();
  ctx.strokeStyle = col[1]; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(x + 1, y + 9); ctx.lineTo(x + 7.5, y + 9.5); ctx.stroke();
  // the wrap
  ctx.beginPath(); ctx.ellipse(x, y, 12.5, 5, -0.25, 0, TAU); ctx.fillStyle = col[0]; ctx.fill(); line(ctx, o * 0.8); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, 12.5, 5, -0.25, 0, TAU); ctx.clip();
  ctx.strokeStyle = col[1]; ctx.lineWidth = 1.8; for (const d of [-6, 0, 6]) { ctx.beginPath(); ctx.moveTo(x + d - 2, y - 6); ctx.lineTo(x + d + 2, y + 6); ctx.stroke(); }
  ctx.restore();
  ctx.restore();
}

/* ------------------------------------------------------------------ outfits (2026-11-16)
   Real clothes worn on the bird instead of a scarf: a coat that follows her body (clipped to the silhouette, with the
   body's own cel crescent so it reads as cloth on a round hen), soft fur trims drawn as clusters of lumps, a sleeve on
   the near wing. Line colour is her outline brown, fur gets a light warm-grey edge so it never reads as a halo. */
const FUR = { fill: '#ffffff', shade: '#e4e9f0', edge: '#c9bfb4' };
// a fluffy trim along a list of points: back lumps (shade + edge), then front lumps, so the cluster has volume
function furTrim(ctx, o, pts, r) {
  ctx.save();
  ctx.lineWidth = o * 0.9; ctx.strokeStyle = FUR.edge;
  for (const [x, y, k = 1] of pts) { ctx.beginPath(); ctx.arc(x, y, r * k, 0, TAU); ctx.stroke(); }
  for (const [x, y, k = 1] of pts) { ctx.beginPath(); ctx.arc(x, y, r * k, 0, TAU); ctx.fillStyle = FUR.fill; ctx.fill(); }
  ctx.fillStyle = FUR.shade;
  for (const [x, y, k = 1] of pts) { ctx.beginPath(); ctx.arc(x + r * k * 0.18, y + r * k * 0.32, r * k * 0.62, 0.15, Math.PI - 0.15); ctx.fill(); }
  ctx.restore();
}
const bez = (p0, p1, p2, p3, t) => { const u = 1 - t; return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]; };

// The Santa hat, seated: a fur band that hugs the crown (tilted back, clear of the eyes), a soft cap over the comb and a
// floppy tip that falls behind her head with a swinging pompom.
function santaHat(ctx, o, t) {
  const sw = Math.sin(t * 2.3) * 1.6, sw2 = Math.sin(t * 2.3 - 0.6) * 1.1;
  const L = '#5a1a10';
  // floppy tip first (behind the cap)
  ctx.beginPath();
  ctx.moveTo(-6, -27);
  ctx.bezierCurveTo(-14, -31, -22 + sw2, -29, -26 + sw, -19);
  ctx.lineTo(-22.5 + sw, -17.5);
  ctx.bezierCurveTo(-19 + sw2, -23, -13, -22, -9, -18);
  ctx.closePath();
  let g = ctx.createLinearGradient(-26, -30, -8, -16); g.addColorStop(0, '#d01d12'); g.addColorStop(1, '#a5120b');
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = o; ctx.strokeStyle = L; ctx.lineJoin = 'round'; ctx.stroke();
  // the cap: covers the comb (x -14..14, y -8..-25)
  ctx.beginPath();
  ctx.moveTo(-13.5, -8);
  ctx.bezierCurveTo(-16, -20, -11, -30.5, -1, -30.5);
  ctx.bezierCurveTo(9, -30.5, 15.5, -22, 13.5, -12);
  ctx.closePath();
  g = ctx.createLinearGradient(-8, -31, 6, -9); g.addColorStop(0, '#ff5a46'); g.addColorStop(0.55, '#e3271a'); g.addColorStop(1, '#b3150e');
  ctx.fillStyle = g; ctx.fill(); ctx.stroke();
  ctx.save(); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.ellipse(-6, -24, 5, 2.4, -0.5, 0, TAU); ctx.fill(); // sheen
  ctx.fillStyle = 'rgba(90,10,6,0.22)'; ctx.beginPath(); ctx.ellipse(8, -12, 10, 6, -0.3, 0, TAU); ctx.fill();
  ctx.restore();
  // fur band round the crown, tilted back
  const pts = [];
  for (let i = 0; i <= 7; i++) { const a = Math.PI + 0.42 + (i / 7) * (Math.PI - 1.1); pts.push([14.2 * Math.cos(a), -1.8 + 13.2 * Math.sin(a), i % 2 ? 0.92 : 1.05]); }
  furTrim(ctx, o, pts, 3.5);
  // pompom
  furTrim(ctx, o, [[-25.5 + sw, -16.5, 1], [-27.5 + sw, -14.6, 0.7], [-23.4 + sw, -14.2, 0.68]], 4.4);
}

// hats that sit over the crown: the bird skips drawing its comb (it would poke out round the hat)
export const skinHidesComb = (id = SKIN) => id === 'santa';

// Sleeve colours for the near / far wing (hen.js paints the shoulder half of the wing in these, then a fur cuff).
export function skinSleeve(id = SKIN) {
  if (id === 'santa') return { c: ['#d8301f', '#bb2216'], lo: '#8e140c', far: ['#b01f14', '#8a130b'], cuff: true };
  return null;
}

// The body outfit, in the hen's body frame, drawn right after her body. body(c) traces her body silhouette (no neck/head).
export function drawSkinBody(ctx, o, t = 0, body, id = SKIN) {
  if (id !== 'santa' || !body) return;
  ctx.save();
  ctx.beginPath(); body(ctx); ctx.clip();
  // coat cloth with the hen's own cel crescent
  ctx.fillStyle = '#a3140d'; ctx.fillRect(-60, -60, 120, 120);
  ctx.translate(-4.5, -5.5);
  const g = ctx.createRadialGradient(-12, -16, 4, -12, -16, 66); g.addColorStop(0, '#ff6450'); g.addColorStop(0.5, '#e8301f'); g.addColorStop(1, '#c41d12');
  ctx.fillStyle = g; ctx.beginPath(); body(ctx); ctx.fill();
  ctx.translate(4.5, 5.5);
  // cloth folds: two soft darker creases from the belt down
  ctx.strokeStyle = 'rgba(110,8,4,0.35)'; ctx.lineWidth = o * 0.8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(8, 27); ctx.quadraticCurveTo(10, 31, 9, 35); ctx.moveTo(-14, 27); ctx.quadraticCurveTo(-13, 31, -15, 35); ctx.stroke();
  // belt
  ctx.beginPath(); ctx.moveTo(-50, 17); ctx.quadraticCurveTo(-5, 25, 45, 18); ctx.lineTo(45, 25); ctx.quadraticCurveTo(-5, 32, -50, 24); ctx.closePath();
  ctx.fillStyle = '#2b1b16'; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.moveTo(-50, 17); ctx.quadraticCurveTo(-5, 25, 45, 18); ctx.lineTo(45, 19.4); ctx.quadraticCurveTo(-5, 26.4, -50, 18.4); ctx.closePath(); ctx.fill();
  // fur hem along the bottom of the coat (the clip trims the outside, the lumps make the inner edge fluffy)
  const hem = [];
  for (let i = 0; i <= 3; i++) hem.push(bez([22, -9], [37, 0], [37, 26], [17, 35], 0.62 + i * 0.12));
  for (let i = 1; i <= 7; i++) hem.push(bez([17, 35], [3, 41], [-19, 40], [-30, 29], i / 7));
  for (let i = 1; i <= 3; i++) hem.push(bez([-30, 29], [-40, 19], [-43, 3], [-37, -8], i * 0.11));
  furTrim(ctx, o, hem.map(([x, y], i) => [x, y + 1.2, i % 2 ? 0.95 : 1.08]), 5.3);
  ctx.restore();
  // buckle (over the clip edge is fine, it sits on the chest)
  ctx.save();
  ctx.translate(26, 21.4); ctx.rotate(-0.12);
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-4.6, -4.8, 9.2, 9.6, 1.8) : ctx.rect(-4.6, -4.8, 9.2, 9.6);
  ctx.fillStyle = '#ffcf3a'; ctx.fill(); ctx.lineWidth = o * 0.8; ctx.strokeStyle = '#8a5a08'; ctx.stroke();
  ctx.beginPath(); ctx.rect(-2.2, -2.4, 4.4, 4.8); ctx.fillStyle = '#2b1b16'; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(-3.8, -4, 2.2, 1.2);
  ctx.restore();
  // brass buttons down the chest
  for (const [x, y] of [[29.5, 4], [30.5, 12.5]]) {
    ctx.beginPath(); ctx.arc(x, y, 1.9, 0, TAU); ctx.fillStyle = '#ffd24a'; ctx.fill(); ctx.lineWidth = o * 0.6; ctx.strokeStyle = '#8a5a08'; ctx.stroke();
  }
  // fur collar round the base of her neck
  const col = [];
  for (let i = 0; i <= 6; i++) { const u = i / 6; col.push([lerpN(1, 31, u), lerpN(-12.5, -1.5, u) + Math.sin(u * Math.PI) * 2.2, i % 2 ? 0.9 : 1.05]); }
  furTrim(ctx, o, col, 4.6);
}
const lerpN = (a, b, k) => a + (b - a) * k;

// the fur cuff across a sleeve, in the wing's frame (x along the wing, from the shoulder); y0..y1 its width there
export function drawSleeveCuff(ctx, o, x, y0, y1) {
  const pts = [];
  for (let i = 0; i <= 4; i++) pts.push([x + (i % 2 ? 0.7 : -0.4), lerpN(y0, y1, i / 4), i % 2 ? 0.9 : 1.05]);
  furTrim(ctx, o, pts, 2.9);
}
