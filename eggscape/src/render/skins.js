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
  if (id === 'santa') {
    cone(ctx, o, [-15, -9], [15, -10], [-24 + sw, -36], ['#ff4a3a', '#b8140e'], 6);
    fur(ctx, -24 + sw, -37, 5.2, o);
    ctx.beginPath(); ctx.ellipse(0, -9.5, 17, 4.6, -0.03, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = o * 1.1; ctx.strokeStyle = '#7d8a9c'; ctx.stroke();
    for (const x of [-11, -4, 3, 10]) { ctx.fillStyle = 'rgba(150,170,200,0.35)'; ctx.beginPath(); ctx.arc(x, -8.5, 2.2, 0, TAU); ctx.fill(); }
  } else if (id === 'elf') {
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
  const col = id === 'snowy' ? ['#e8402e', '#ffffff'] : id === 'santa' ? ['#2f9a4a', '#ffffff'] : id === 'elf' ? ['#e8402e', '#ffd23a'] : id === 'royal' ? ['#7a2fb8', '#ffd23a'] : null;
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
