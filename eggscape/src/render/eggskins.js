// More egg skins (2026-11-16, mykee: "we need to have more skins for the eggs"). Cosmetic only. One per world theme
// plus a Christmas pair. Drawn in the same space as ui/store.js drawSkinPreview: centred at (cx, cy), h tall (y down),
// width h * 0.78, so the shop card and the in-game egg (render/world.js) both use this.
const TAU = Math.PI * 2;
function eggPath(ctx, w, h) {
  ctx.beginPath();
  for (let i = 0; i <= 36; i++) {
    const a = (i / 36) * TAU, sy = Math.sin(a);
    const x = (w / 2) * Math.cos(a) * (1 + 0.13 * sy), y = (h / 2) * sy;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath();
}
const lin = (ctx, x0, y0, x1, y1, stops) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c)); return g; };
const rad = (ctx, x, y, r0, r1, stops) => { const g = ctx.createRadialGradient(x, y, r0, x, y, r1); stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c)); return g; };
const dot = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
function star(ctx, x, y, r, n = 5, k = 0.45) { ctx.beginPath(); for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + (i * Math.PI) / n, rr = i % 2 ? r * k : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }
function flake(ctx, x, y, r) { ctx.beginPath(); for (let i = 0; i < 3; i++) { const a = (i * Math.PI) / 3; ctx.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.stroke(); }

// id -> { base(ctx, w, h) fill style, edge colour, art(ctx, w, h, t) inside the shell clip }
export const EGG_ART = {
  bauble: { // a Christmas bauble: glossy red, a gold band with dots, a gold cap
    base: (ctx, w, h) => rad(ctx, -w * 0.18, -h * 0.2, h * 0.04, h * 0.7, ['#ff7a6a', '#e2281c', '#9a0e08']), edge: '#5a0a06',
    art(ctx, w, h) {
      ctx.fillStyle = lin(ctx, 0, -h * 0.08, 0, h * 0.1, ['#fff0a0', '#ffc834', '#c98a0a']); ctx.fillRect(-w, -h * 0.05, w * 2, h * 0.14);
      ctx.fillStyle = '#c42219'; for (let i = -3; i <= 3; i++) dot(ctx, i * w * 0.16, h * 0.02, h * 0.022);
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; for (const [x, y] of [[-0.18, -0.28], [0.16, -0.22], [0.02, -0.36], [-0.2, 0.28], [0.18, 0.3], [0, 0.22]]) dot(ctx, x * w, y * h, h * 0.018);
      ctx.fillStyle = lin(ctx, -w * 0.15, 0, w * 0.15, 0, ['#c98a0a', '#ffe680', '#c98a0a']); ctx.fillRect(-w * 0.14, -h * 0.56, w * 0.28, h * 0.1);
    },
  },
  candy: { // a candy cane: white with red and green spiral stripes
    base: () => '#fffaf4', edge: '#8a1a14',
    art(ctx, w, h) {
      ctx.save(); ctx.rotate(-0.55);
      for (let i = -6; i <= 6; i++) { ctx.fillStyle = i % 3 === 0 ? '#2f9a4a' : '#e2281c'; ctx.fillRect(i * h * 0.13, -h, h * (i % 3 === 0 ? 0.035 : 0.06), h * 2); }
      ctx.restore();
    },
  },
  frosty: { // frosted ice: pale blue, snowflakes, a frosty rim
    base: (ctx, w, h) => lin(ctx, -w / 2, -h / 2, w / 2, h / 2, ['#ffffff', '#cfeaff', '#8ec6ee']), edge: '#3a78a8',
    art(ctx, w, h) {
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = Math.max(1, h * 0.025); ctx.lineCap = 'round';
      for (const [x, y, r] of [[-0.12, -0.22, 0.09], [0.16, 0.02, 0.11], [-0.16, 0.24, 0.07], [0.12, 0.33, 0.05], [0.18, -0.3, 0.05]]) flake(ctx, x * w, y * h, r * h);
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.moveTo(-w, h * 0.42); for (let k = 0; k <= 8; k++) ctx.lineTo(-w / 2 + (k / 8) * w, h * (k % 2 ? 0.38 : 0.44)); ctx.lineTo(w, h); ctx.lineTo(-w, h); ctx.fill();
    },
  },
  galaxy: { // a crystal-cave galaxy: deep violet, a nebula swirl, twinkling stars
    base: (ctx, w, h) => rad(ctx, w * 0.1, -h * 0.05, h * 0.05, h * 0.7, ['#7a4ae8', '#3a1a8a', '#140838']), edge: '#0a0420',
    art(ctx, w, h, t) {
      ctx.fillStyle = 'rgba(255,120,220,0.35)'; ctx.beginPath(); ctx.ellipse(-w * 0.05, h * 0.05, w * 0.5, h * 0.12, -0.6, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(120,220,255,0.3)'; ctx.beginPath(); ctx.ellipse(w * 0.08, -h * 0.12, w * 0.4, h * 0.08, -0.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff';
      [[-0.2, -0.3, 0.05], [0.18, -0.2, 0.035], [0.05, 0.12, 0.045], [-0.22, 0.22, 0.03], [0.2, 0.32, 0.03], [-0.04, -0.08, 0.025], [0.1, -0.38, 0.025]].forEach(([x, y, r], i) => {
        const tw = 0.65 + 0.35 * Math.sin(t * 3 + i * 1.7); star(ctx, x * w, y * h, r * h * tw, 4, 0.35);
      });
    },
  },
  lava: { // a volcano egg: dark rock with glowing cracks
    base: (ctx, w, h) => rad(ctx, -w * 0.15, -h * 0.2, h * 0.05, h * 0.7, ['#6a5a56', '#3a2e2c', '#1c1514']), edge: '#0c0808',
    art(ctx, w, h, t) {
      const g = 0.75 + 0.25 * Math.sin(t * 2.4);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const cracks = [[[-0.3, -0.1], [-0.12, -0.04], [-0.04, -0.2], [0.12, -0.14], [0.3, -0.26]], [[-0.04, -0.2], [0.02, -0.38]], [[-0.3, 0.2], [-0.1, 0.16], [0.04, 0.3], [0.2, 0.22], [0.34, 0.3]], [[0.12, -0.14], [0.16, 0.04], [0.04, 0.12], [-0.1, 0.16]]];
      for (const [lw, col] of [[0.07, `rgba(255,120,20,${0.45 * g})`], [0.032, '#ff8a1e'], [0.014, '#fff0a0']]) {
        ctx.strokeStyle = col; ctx.lineWidth = h * lw;
        for (const C of cracks) { ctx.beginPath(); C.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h))); ctx.stroke(); }
      }
    },
  },
  thunder: { // a storm egg: slate blue with a yellow lightning bolt
    base: (ctx, w, h) => lin(ctx, 0, -h / 2, 0, h / 2, ['#9ab0d8', '#5a72a8', '#2e3e66']), edge: '#141c34',
    art(ctx, w, h) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; for (const [x, y, r] of [[-0.18, -0.34, 0.12], [0.02, -0.38, 0.1], [0.2, -0.32, 0.1]]) dot(ctx, x * w, y * h, r * h);
      ctx.fillStyle = '#ffe23a'; ctx.strokeStyle = '#a87a08'; ctx.lineWidth = Math.max(1, h * 0.02); ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(0.06 * w, -0.3 * h); ctx.lineTo(-0.22 * w, 0.04 * h); ctx.lineTo(-0.02 * w, 0.04 * h); ctx.lineTo(-0.12 * w, 0.36 * h); ctx.lineTo(0.24 * w, -0.04 * h); ctx.lineTo(0.04 * w, -0.04 * h); ctx.lineTo(0.16 * w, -0.3 * h); ctx.closePath(); ctx.fill(); ctx.stroke();
    },
  },
  treasure: { // a treasure-map egg: parchment, a dotted trail, a red X
    base: (ctx, w, h) => rad(ctx, 0, 0, h * 0.1, h * 0.65, ['#fff2cc', '#f0d9a0', '#c8a060']), edge: '#6a4a1a',
    art(ctx, w, h) {
      ctx.strokeStyle = 'rgba(120,80,30,0.35)'; ctx.lineWidth = Math.max(0.8, h * 0.012);
      ctx.beginPath(); ctx.moveTo(-w, -h * 0.05); ctx.lineTo(w, h * 0.02); ctx.moveTo(-w * 0.08, -h); ctx.lineTo(w * 0.02, h); ctx.stroke(); // folds
      ctx.fillStyle = 'rgba(80,160,90,0.5)'; ctx.beginPath(); ctx.ellipse(-w * 0.18, -h * 0.22, w * 0.16, h * 0.08, 0.4, 0, TAU); ctx.fill();
      ctx.setLineDash([h * 0.03, h * 0.025]); ctx.strokeStyle = '#8a4a1a'; ctx.lineWidth = Math.max(1, h * 0.022); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-w * 0.26, h * 0.32); ctx.bezierCurveTo(-w * 0.1, h * 0.1, w * 0.26, h * 0.24, w * 0.12, -h * 0.02); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = '#d8302a'; ctx.lineWidth = Math.max(1.4, h * 0.04);
      const x = w * 0.1, y = -h * 0.08, r = h * 0.06; ctx.beginPath(); ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r); ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r); ctx.stroke();
    },
  },
  pearl: { // a reef pearl: pearly white with a soft rainbow sheen
    base: (ctx, w, h) => rad(ctx, -w * 0.15, -h * 0.2, h * 0.04, h * 0.7, ['#ffffff', '#f4eef8', '#d8cce6']), edge: '#7a6a8c',
    art(ctx, w, h, t) {
      const s = Math.sin(t * 0.8) * w * 0.1;
      for (const [c, y] of [['rgba(255,170,200,0.32)', -0.12], ['rgba(170,220,255,0.32)', 0.04], ['rgba(200,255,200,0.26)', 0.2]]) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(s, y * h, w * 0.6, h * 0.07, -0.25, 0, TAU); ctx.fill(); }
    },
  },
  gator: { // a bayou egg: green with scutes and a pale belly
    base: (ctx, w, h) => lin(ctx, -w / 2, -h / 2, w / 2, h / 2, ['#8ac85a', '#4f8a32', '#2e5a1c']), edge: '#16300c',
    art(ctx, w, h) {
      ctx.fillStyle = 'rgba(20,50,10,0.45)'; ctx.strokeStyle = 'rgba(200,240,150,0.35)'; ctx.lineWidth = Math.max(0.8, h * 0.012);
      for (let r = 0; r < 4; r++) for (let c = -2; c <= 2; c++) { const x = (c + (r % 2) * 0.5) * w * 0.2, y = -h * 0.34 + r * h * 0.15; ctx.beginPath(); ctx.ellipse(x, y, w * 0.075, h * 0.05, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = '#e8e2a8'; ctx.beginPath(); ctx.ellipse(0, h * 0.38, w * 0.5, h * 0.16, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(120,110,50,0.5)'; ctx.beginPath(); for (let i = -2; i <= 2; i++) { ctx.moveTo(i * w * 0.12, h * 0.26); ctx.lineTo(i * w * 0.14, h * 0.5); } ctx.stroke();
    },
  },
  robot: { // a lab egg: brushed steel plates, rivets, a glowing panel
    base: (ctx, w, h) => lin(ctx, -w / 2, 0, w / 2, 0, ['#8a96a4', '#e8eef4', '#a8b4c2', '#6a7684']), edge: '#2a323c',
    art(ctx, w, h, t) {
      ctx.strokeStyle = 'rgba(40,50,60,0.6)'; ctx.lineWidth = Math.max(0.8, h * 0.015);
      ctx.beginPath(); ctx.moveTo(-w, -h * 0.14); ctx.lineTo(w, -h * 0.14); ctx.moveTo(-w, h * 0.2); ctx.lineTo(w, h * 0.2); ctx.stroke();
      ctx.fillStyle = '#4a5664'; for (const y of [-0.19, 0.15, 0.25]) for (const x of [-0.3, -0.1, 0.1, 0.3]) dot(ctx, x * w, y * h, h * 0.014);
      const g = 0.6 + 0.4 * Math.sin(t * 4);
      ctx.fillStyle = '#1c242c'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-w * 0.22, -h * 0.07, w * 0.44, h * 0.18, h * 0.03) : ctx.rect(-w * 0.22, -h * 0.07, w * 0.44, h * 0.18); ctx.fill();
      ctx.fillStyle = `rgba(80,255,170,${g})`; for (let i = 0; i < 3; i++) dot(ctx, (-0.12 + i * 0.12) * w, h * 0.02, h * 0.025);
    },
  },
};

export function drawEggSkinArt(ctx, id, cx, cy, h, t = 0) {
  const A = EGG_ART[id];
  if (!A) return false;
  const w = h * 0.78;
  ctx.save();
  try {
    ctx.translate(cx, cy);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    eggPath(ctx, w, h);
    ctx.fillStyle = A.base(ctx, w, h); ctx.fill();
    ctx.save(); ctx.clip(); A.art(ctx, w, h, t); ctx.restore();
    // a soft shadow side so it reads round, then the outline and the gloss (the shop's recipe)
    eggPath(ctx, w, h); ctx.save(); ctx.clip(); ctx.fillStyle = rad(ctx, -w * 0.3, -h * 0.3, h * 0.3, h * 0.95, ['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,20,0.22)']); ctx.fillRect(-w, -h, w * 2, h * 2); ctx.restore();
    eggPath(ctx, w, h); ctx.lineWidth = Math.max(1.2, h * 0.045); ctx.strokeStyle = A.edge; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = Math.max(1.2, h * 0.04);
    ctx.beginPath(); ctx.arc(0, h * 0.04, w * 0.36, Math.PI * 1.1, Math.PI * 1.4); ctx.stroke();
  } catch (e) { /* art must never break the frame */ }
  ctx.restore();
  return true;
}
