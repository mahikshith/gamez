// Eggscape app icon, round 3 (after mykee: no dark outlines, pro + funny + clickable; research: one big face close-up,
// shocked open mouth, eyes on the viewer, soft 3D light with a cool rim, saturated sky-blue radial ground, the villain as
// the punchline). The hen in her in-game colours, shocked; the game's violet snake slinking off with an egg.
const S = W / 1024; ctx.save(); ctx.scale(S, S);
const TAU = Math.PI * 2;
const RG = (x, y, r0, x1, y1, r1, st) => { const g = ctx.createRadialGradient(x, y, r0, x1, y1, r1); st.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
const LG = (x0, y0, x1, y1, st) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); st.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
const P = (f) => { ctx.beginPath(); f(); };
const layer = (window.ICON_OPTS && window.ICON_OPTS.layer) || 'all';

function background() {
  ctx.fillStyle = RG(420, 380, 30, 512, 512, 760, [[0, '#c9f0ff'], [0.35, '#6fc6f5'], [0.75, '#2f8ad8'], [1, '#1c5aa8']]); ctx.fillRect(-300, -300, 1624, 1624);
  // soft light rays
  ctx.save(); ctx.translate(420, 380); ctx.globalAlpha = 0.09;
  for (let i = 0; i < 16; i++) { ctx.rotate(TAU / 16); P(() => { ctx.moveTo(0, 0); ctx.lineTo(-60, -1100); ctx.lineTo(60, -1100); }); ctx.fillStyle = '#fff'; ctx.fill(); }
  ctx.restore();
  // a game ring arc behind her head, its gap where the egg went
  ctx.save(); ctx.lineCap = 'round'; ctx.globalAlpha = 0.9;
  P(() => ctx.arc(470, 470, 420, -2.6, 0.55)); ctx.strokeStyle = 'rgba(20,50,100,0.25)'; ctx.lineWidth = 64; ctx.stroke();
  P(() => ctx.arc(470, 462, 420, -2.6, 0.55)); ctx.strokeStyle = LG(0, 40, 0, 900, [[0, '#d99050'], [1, '#a65a24']]); ctx.lineWidth = 52; ctx.stroke();
  P(() => ctx.arc(470, 462, 404, -2.5, 0.45)); ctx.strokeStyle = 'rgba(255,225,170,0.6)'; ctx.lineWidth = 9; ctx.stroke();
  P(() => ctx.arc(470, 462, 420, -1.2, -0.75)); ctx.strokeStyle = '#ffd04a'; ctx.lineWidth = 40; ctx.stroke(); // a pad
  ctx.restore();
}

// soft 3D blob with key light (upper left), shade (lower right) and a cool rim on the right edge
function lit(path, base, hi, lo, rim, kx, ky, R) {
  path(); ctx.fillStyle = RG(kx, ky, R * 0.05, kx + R * 0.35, ky + R * 0.4, R * 1.15, [[0, hi], [0.55, base], [1, lo]]); ctx.fill();
  if (rim) { ctx.save(); path(); ctx.clip(); ctx.fillStyle = RG(kx + R * 0.95, ky + R * 0.25, R * 0.05, kx + R * 0.95, ky + R * 0.25, R * 0.75, [[0, 'rgba(150,215,255,0)'], [0.7, 'rgba(150,215,255,0)'], [1, rim]]); ctx.globalCompositeOperation = 'source-atop'; ctx.restore(); }
}

function head() {
  const headPath = () => P(() => {
    ctx.moveTo(170, 1100); ctx.bezierCurveTo(170, 960, 200, 860, 170, 760); ctx.bezierCurveTo(100, 620, 110, 380, 230, 270); ctx.bezierCurveTo(330, 180, 520, 160, 640, 230);
    ctx.bezierCurveTo(770, 310, 800, 470, 770, 600); ctx.bezierCurveTo(745, 700, 700, 760, 690, 840); ctx.bezierCurveTo(680, 940, 700, 1020, 720, 1100); ctx.closePath();
  });
  // comb behind the crown
  const comb = [[300, 230, 88], [400, 150, 104], [520, 135, 104], [630, 190, 88], [700, 270, 64]];
  for (const [x, y, r] of comb) { P(() => ctx.arc(x, y + 10, r, 0, TAU)); ctx.fillStyle = '#8e1010'; ctx.fill(); }
  for (const [x, y, r] of comb) { P(() => ctx.arc(x, y, r, 0, TAU)); ctx.fillStyle = RG(x - r * 0.35, y - r * 0.45, r * 0.08, x, y, r * 1.05, [[0, '#ff8a6a'], [0.45, '#f0322a'], [1, '#b41414']]); ctx.fill(); }
  for (const [x, y, r] of comb) { P(() => ctx.ellipse(x - r * 0.32, y - r * 0.42, r * 0.3, r * 0.17, -0.5, 0, TAU)); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill(); }
  // head
  lit(headPath, '#f7e6c4', '#fffef8', '#c9965a', 'rgba(170,225,255,0.95)', 330, 290, 640);
  // form: a warm shade down the right of the face and under the cheek, ambient occlusion round the eyes
  ctx.save(); headPath(); ctx.clip();
  ctx.fillStyle = RG(860, 760, 40, 860, 760, 420, [[0, 'rgba(170,110,50,0.45)'], [1, 'rgba(170,110,50,0)']]); ctx.fillRect(100, 100, 900, 1000);
  ctx.fillStyle = RG(180, 900, 20, 180, 900, 300, [[0, 'rgba(170,110,50,0.3)'], [1, 'rgba(170,110,50,0)']]); ctx.fillRect(0, 500, 600, 600);
  ctx.restore();
  // a soft shadow under the comb onto the crown
  ctx.save(); headPath(); ctx.clip(); ctx.fillStyle = RG(470, 170, 10, 470, 200, 260, [[0, 'rgba(150,60,30,0.28)'], [1, 'rgba(150,60,30,0)']]); ctx.fillRect(150, 100, 640, 300);
  // feather scallops on the neck, a value step (no ink)
  ctx.strokeStyle = 'rgba(190,140,80,0.35)'; ctx.lineWidth = 9; ctx.lineCap = 'round';
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) { const x = 190 + c * 92 + (r % 2) * 46, y = 870 + r * 64; P(() => ctx.arc(x, y, 34, 0.35, Math.PI - 0.35)); ctx.stroke(); }
  // cheek fluff on the left edge
  ctx.restore();
  ctx.fillStyle = '#fbefd6';
  for (const [x, y, a] of [[130, 520, 2.6], [118, 610, 2.9], [134, 700, 3.2]]) { ctx.save(); ctx.translate(x, y); ctx.rotate(a); P(() => { ctx.moveTo(-26, 0); ctx.quadraticCurveTo(0, 70, 26, 0); }); ctx.fillStyle = '#f3dfba'; ctx.fill(); ctx.restore(); }
}

function eye(x, y, rx, ry, px, py, near) {
  // socket shade, then the white with a cool lower shade, a big glossy iris looking at you
  P(() => ctx.ellipse(x, y + 6, rx * 1.08, ry * 1.06, 0, 0, TAU)); ctx.fillStyle = 'rgba(160,110,60,0.35)'; ctx.fill();
  P(() => ctx.ellipse(x, y, rx, ry, 0, 0, TAU)); ctx.fillStyle = RG(x - rx * 0.3, y - ry * 0.4, 4, x, y, ry * 1.1, [[0, '#ffffff'], [0.7, '#f4f7fb'], [1, '#c8d6e6']]); ctx.fill();
  ctx.save(); P(() => ctx.ellipse(x, y, rx, ry, 0, 0, TAU)); ctx.clip();
  const ir = rx * (near ? 0.5 : 0.56);
  P(() => ctx.ellipse(x + px, y + py, ir, ir * 1.12, 0, 0, TAU)); ctx.fillStyle = RG(x + px - ir * 0.3, y + py - ir * 0.4, 2, x + px, y + py, ir * 1.1, [[0, '#7a4a22'], [0.5, '#3a200c'], [1, '#160a02']]); ctx.fill();
  P(() => ctx.ellipse(x + px, y + py, ir * 0.55, ir * 0.62, 0, 0, TAU)); ctx.fillStyle = '#0a0402'; ctx.fill();
  P(() => ctx.ellipse(x + px - ir * 0.38, y + py - ir * 0.42, ir * 0.3, ir * 0.36, -0.4, 0, TAU)); ctx.fillStyle = '#fff'; ctx.fill();
  P(() => ctx.arc(x + px + ir * 0.35, y + py + ir * 0.4, ir * 0.11, 0, TAU)); ctx.fill();
  // the upper lid line: a value step, not ink
  P(() => ctx.ellipse(x, y - ry * 1.02, rx * 1.3, ry * 0.2, 0, 0, TAU)); ctx.fillStyle = 'rgba(140,90,40,0.25)'; ctx.fill();
  ctx.restore();
  P(() => ctx.ellipse(x, y, rx, ry, 0, Math.PI * 1.05, Math.PI * 1.95)); ctx.strokeStyle = 'rgba(110,60,20,0.55)'; ctx.lineWidth = 7; ctx.stroke();
}

function face() {
  eye(372, 470, 104, 124, 22, 10, true);
  eye(612, 452, 76, 112, 8, 10, false);
  // brows flung up in shock: soft feather tufts
  ctx.lineCap = 'round';
  for (const [x0, y0, x1, y1, cx, cy] of [[270, 330, 470, 318, 360, 268], [560, 312, 690, 334, 630, 270]]) {
    P(() => { ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x1, y1); }); ctx.strokeStyle = 'rgba(150,90,40,0.85)'; ctx.lineWidth = 26; ctx.stroke();
    P(() => { ctx.moveTo(x0 + 6, y0 - 6); ctx.quadraticCurveTo(cx, cy - 6, x1 - 6, y1 - 6); }); ctx.strokeStyle = 'rgba(200,140,80,0.6)'; ctx.lineWidth = 9; ctx.stroke();
  }
  // wattles
  for (const [x, y, rx, ry, a] of [[520, 760, 46, 72, 0.15], [580, 770, 40, 62, -0.15]]) {
    P(() => ctx.ellipse(x, y, rx, ry, a, 0, TAU)); ctx.fillStyle = RG(x - rx * 0.3, y - ry * 0.4, 4, x, y, ry * 1.1, [[0, '#ff7a5a'], [0.5, '#e8281e'], [1, '#a40c0c']]); ctx.fill();
    P(() => ctx.ellipse(x - rx * 0.3, y - ry * 0.35, rx * 0.25, ry * 0.15, -0.4, 0, TAU)); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill();
  }
  // beak, wide open in a squawk: lower beak dropped, the dark mouth and tongue between, the upper beak over it
  const bx = 540, by = 590;
  P(() => { ctx.moveTo(bx - 40, by + 40); ctx.bezierCurveTo(bx + 20, by + 70, bx + 110, by + 80, bx + 150, by + 120); ctx.bezierCurveTo(bx + 120, by + 170, bx + 40, by + 160, bx - 20, by + 110); ctx.closePath(); });
  ctx.fillStyle = LG(0, by + 60, 0, by + 160, [[0, '#ffb33a'], [1, '#d8700c']]); ctx.fill(); // lower beak
  P(() => { ctx.moveTo(bx - 30, by + 30); ctx.bezierCurveTo(bx + 40, by + 40, bx + 120, by + 60, bx + 160, by + 50); ctx.bezierCurveTo(bx + 150, by + 100, bx + 110, by + 110, bx + 140, by + 118); ctx.bezierCurveTo(bx + 90, by + 92, bx + 20, by + 80, bx - 30, by + 60); ctx.closePath(); });
  ctx.fillStyle = '#4a0606'; ctx.fill(); // mouth
  P(() => ctx.ellipse(bx + 70, by + 88, 40, 14, 0.25, 0, TAU)); ctx.fillStyle = RG(bx + 60, by + 82, 2, bx + 70, by + 88, 42, [[0, '#ff9aa0'], [1, '#d8405a']]); ctx.fill(); // tongue
  P(() => { ctx.moveTo(bx - 60, by - 30); ctx.bezierCurveTo(bx - 10, by - 80, bx + 120, by - 70, bx + 200, by + 10); ctx.bezierCurveTo(bx + 220, by + 40, bx + 200, by + 70, bx + 170, by + 64); ctx.bezierCurveTo(bx + 120, by + 40, bx + 40, by + 40, bx - 20, by + 50); ctx.bezierCurveTo(bx - 60, by + 40, bx - 76, by, bx - 60, by - 30); ctx.closePath(); });
  ctx.fillStyle = LG(0, by - 70, 0, by + 70, [[0, '#ffe39a'], [0.45, '#ffb52e'], [1, '#e2780e']]); ctx.fill(); // upper beak
  P(() => ctx.ellipse(bx + 40, by - 34, 70, 14, 0.12, 0, TAU)); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
  P(() => ctx.arc(bx + 130, by - 4, 6, 0, TAU)); ctx.fillStyle = 'rgba(150,70,0,0.5)'; ctx.fill();
  // a sweat drop
  P(() => { ctx.moveTo(735, 300); ctx.bezierCurveTo(712, 345, 712, 372, 735, 376); ctx.bezierCurveTo(758, 372, 758, 345, 735, 300); });
  ctx.fillStyle = LG(0, 300, 0, 380, [[0, '#d8f4ff'], [1, '#58b8ee']]); ctx.fill();
  P(() => ctx.ellipse(728, 352, 6, 10, -0.3, 0, TAU)); ctx.fillStyle = '#fff'; ctx.fill();
}

// the game's violet snake (its colours and diamond marks) sliding off bottom right, an egg in its jaws, grinning at you
function snake() {
  const V = '#9446bd', VL = '#c590e0', VD = '#5e2384', MK = '#e64fb2', BL = '#fbc288';
  // body: a fat S from the bottom edge
  const body = (w, col) => { P(() => { ctx.moveTo(500, 1120); ctx.bezierCurveTo(540, 1000, 580, 930, 630, 880); ctx.bezierCurveTo(660, 856, 670, 846, 690, 840); }); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke(); };
  body(150, VD); body(134, V); body(46, 'rgba(255,255,255,0.18)');
  ctx.save(); P(() => { ctx.moveTo(500, 1120); ctx.bezierCurveTo(540, 1000, 580, 930, 630, 880); ctx.bezierCurveTo(660, 856, 670, 846, 690, 840); }); ctx.setLineDash([26, 40]); ctx.strokeStyle = MK; ctx.lineWidth = 34; ctx.stroke(); ctx.restore();
  // head: a broad wedge pointing left, grinning at you, an egg clamped at the snout
  ctx.save(); ctx.translate(712, 800); ctx.rotate(0.1); ctx.scale(-1.1, 1.1);
  const headP0 = 0;
  // the egg, clamped at the snout tip, its own worried face
  ctx.save(); ctx.translate(-150, 20); ctx.rotate(-0.5);
  const h = 130;
  const eggP = () => P(() => { ctx.moveTo(0, -h * 0.5); ctx.bezierCurveTo(h * 0.42, -h * 0.5, h * 0.44, h * 0.1, h * 0.38, h * 0.22); ctx.bezierCurveTo(h * 0.3, h * 0.48, -h * 0.3, h * 0.48, -h * 0.38, h * 0.22); ctx.bezierCurveTo(-h * 0.44, h * 0.1, -h * 0.42, -h * 0.5, 0, -h * 0.5); });
  eggP(); ctx.fillStyle = RG(-h * 0.15, -h * 0.2, 4, 0, 0, h * 0.6, [[0, '#ffffff'], [0.6, '#f6e8cc'], [1, '#c9aa7a']]); ctx.fill();
  P(() => ctx.ellipse(-h * 0.16, -h * 0.22, h * 0.07, h * 0.12, -0.4, 0, TAU)); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
  ctx.fillStyle = '#3a2412'; P(() => ctx.ellipse(-h * 0.12, -h * 0.02, h * 0.045, h * 0.065, 0, 0, TAU)); ctx.fill(); P(() => ctx.ellipse(h * 0.1, -h * 0.02, h * 0.045, h * 0.065, 0, 0, TAU)); ctx.fill();
  ctx.strokeStyle = '#3a2412'; ctx.lineWidth = 5; ctx.lineCap = 'round'; P(() => ctx.arc(0, h * 0.2, h * 0.07, Math.PI * 1.15, Math.PI * 1.85)); ctx.stroke();
  ctx.restore();
  const headP = () => P(() => { ctx.moveTo(110, -60); ctx.bezierCurveTo(60, -120, -60, -110, -120, -60); ctx.bezierCurveTo(-150, -40, -150, -10, -128, 6); ctx.bezierCurveTo(-60, 0, 40, 10, 110, 40); ctx.closePath(); });
  P(() => { ctx.moveTo(-128, 8); ctx.bezierCurveTo(-80, 40, 0, 50, 90, 40); ctx.bezierCurveTo(60, 70, -40, 80, -118, 46); ctx.closePath(); }); ctx.fillStyle = LG(0, 10, 0, 70, [[0, '#ffd8a8'], [1, '#d99a5e']]); ctx.fill(); // lower jaw
  headP(); ctx.fillStyle = RG(-40, -90, 4, 0, -30, 170, [[0, VL], [0.5, V], [1, VD]]); ctx.fill();
  P(() => ctx.ellipse(-40, -86, 50, 14, -0.15, 0, TAU)); ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fill();
  for (const [x, y] of [[40, -40], [80, -10]]) { P(() => { ctx.moveTo(x, y - 14); ctx.lineTo(x + 12, y); ctx.lineTo(x, y + 14); ctx.lineTo(x - 12, y); ctx.closePath(); }); ctx.fillStyle = MK; ctx.fill(); }
  P(() => ctx.ellipse(-2, -64, 40, 34, 0, 0, TAU)); ctx.fillStyle = '#fff6d8'; ctx.fill();
  P(() => ctx.ellipse(-10, -60, 22, 26, 0, 0, TAU)); ctx.fillStyle = '#f2a516'; ctx.fill();
  P(() => ctx.ellipse(-10, -60, 6, 20, 0, 0, TAU)); ctx.fillStyle = '#140602'; ctx.fill();
  P(() => ctx.arc(-18, -70, 5, 0, TAU)); ctx.fillStyle = '#fff'; ctx.fill();
  P(() => { ctx.moveTo(-46, -72); ctx.quadraticCurveTo(-2, -114, 42, -72); ctx.lineTo(42, -62); ctx.quadraticCurveTo(-2, -86, -46, -60); ctx.closePath(); }); ctx.fillStyle = VD; ctx.fill(); // the lid
  P(() => { ctx.moveTo(-44, -92); ctx.quadraticCurveTo(0, -124, 48, -94); }); ctx.strokeStyle = '#ff6fae'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.stroke(); // the brow
  P(() => { ctx.moveTo(40, 28); ctx.quadraticCurveTo(84, 34, 104, 4); }); ctx.strokeStyle = VD; ctx.lineWidth = 8; ctx.stroke(); // grin
  P(() => ctx.arc(-116, -36, 6, 0, TAU)); ctx.fillStyle = VD; ctx.fill();
  // the upper jaw's tip over the egg
  ctx.restore();
}

if (layer !== 'fg') background();
if (layer !== 'bg') { head(); face(); snake(); }
ctx.restore();
