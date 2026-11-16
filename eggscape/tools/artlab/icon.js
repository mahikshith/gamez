// Eggscape app icon (1024 square). Called with ctx, W, H; opts on window.ICON_OPTS: { layer: 'all' | 'bg' | 'fg' }.
// A front-facing hen bursting with joy, hugging a cheeky egg, framed by a game ring with its gap; warm sunburst behind.
const layer = (window.ICON_OPTS && window.ICON_OPTS.layer) || 'all';
const S = W / 1024; ctx.save(); ctx.scale(S, S);
const TAU = Math.PI * 2, LINE = '#5a3216';
function bg() {
  const g = ctx.createRadialGradient(512, 430, 40, 512, 512, 760);
  g.addColorStop(0, '#fff3a8'); g.addColorStop(0.35, '#ffc53d'); g.addColorStop(0.75, '#f7861f'); g.addColorStop(1, '#d4511a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 1024);
  ctx.save(); ctx.translate(512, 430); // sunburst rays
  for (let i = 0; i < 18; i++) { ctx.rotate(TAU / 18); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-70, -900); ctx.lineTo(70, -900); ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,0.11)'; ctx.fill(); }
  ctx.restore();
  // the vault ring behind her, its gap at the lower right where the egg is escaping
  ring(500, 580, 372, 62, -0.42, -1.3 + TAU);
}
function ring(cx, cy, R, w, a0, a1) {
  ctx.save(); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx, cy + 10, R, a0, a1); ctx.strokeStyle = 'rgba(120,40,0,0.28)'; ctx.lineWidth = w + 6; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, R, a0, a1); ctx.strokeStyle = '#7a3e14'; ctx.lineWidth = w + 10; ctx.stroke();
  const gr = ctx.createRadialGradient(cx, cy, R - w / 2, cx, cy, R + w / 2);
  gr.addColorStop(0, '#b8692a'); gr.addColorStop(0.45, '#e6a050'); gr.addColorStop(1, '#a95a22');
  ctx.beginPath(); ctx.arc(cx, cy, R, a0, a1); ctx.strokeStyle = gr; ctx.lineWidth = w; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, R - w * 0.18, a0 + 0.05, a1 - 0.05); ctx.strokeStyle = 'rgba(255,230,170,0.5)'; ctx.lineWidth = w * 0.16; ctx.stroke();
  ctx.restore();
}
function blob(pts) { // closed smooth curve through points
  ctx.beginPath(); const n = pts.length;
  for (let i = 0; i < n; i++) { const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    if (i === 0) ctx.moveTo(p1[0], p1[1]);
    ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]); }
  ctx.closePath();
}
function hen() {
  // shadow
  ctx.beginPath(); ctx.ellipse(512, 1010, 330, 60, 0, 0, TAU); ctx.fillStyle = 'rgba(110,40,0,0.25)'; ctx.fill();
  // comb (behind the head)
  const comb = [[392, 278, 60], [462, 205, 76], [548, 192, 80], [628, 245, 64]];
  for (const [x, y, r] of comb) { ctx.beginPath(); ctx.arc(x, y + 6, r, 0, TAU); ctx.fillStyle = '#8c1414'; ctx.fill(); }
  for (const [x, y, r] of comb) { const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r); g.addColorStop(0, '#ff6a52'); g.addColorStop(1, '#d81e1e'); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = g; ctx.fill(); }
  // body + head: one plump pear
  const body = [[512, 232], [672, 280], [762, 440], [790, 640], [826, 870], [760, 1070], [512, 1110], [264, 1070], [198, 870], [234, 640], [262, 440], [352, 280]];
  blob(body); ctx.fillStyle = LINE; ctx.save(); ctx.translate(0, 0); ctx.lineWidth = 14; ctx.strokeStyle = LINE; ctx.stroke(); ctx.restore();
  const bg2 = ctx.createRadialGradient(440, 450, 40, 512, 640, 520); bg2.addColorStop(0, '#fffdf4'); bg2.addColorStop(0.6, '#fbefd2'); bg2.addColorStop(1, '#e8c996');
  blob(body); ctx.fillStyle = bg2; ctx.fill();
  // a cowlick of feathers on the crown
  ctx.restore(); ctx.save();
  ctx.fillStyle = '#fbefd2'; ctx.strokeStyle = LINE; ctx.lineWidth = 10; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(470, 262); ctx.quadraticCurveTo(440, 200, 470, 180); ctx.quadraticCurveTo(480, 220, 505, 230); ctx.quadraticCurveTo(500, 180, 540, 168); ctx.quadraticCurveTo(530, 220, 552, 262); ctx.stroke(); ctx.fill();
  ctx.restore(); ctx.save();
  // little feather scallops on the chest
  ctx.save(); blob(body); ctx.clip(); ctx.strokeStyle = 'rgba(180,130,70,0.35)'; ctx.lineWidth = 7; ctx.lineCap = 'round';
  for (let r = 0; r < 4; r++) for (let c = -3; c <= 3; c++) { const x = 512 + c * 62 + (r % 2) * 31, y = 840 + r * 52; ctx.beginPath(); ctx.arc(x, y, 24, 0.3, Math.PI - 0.3); ctx.stroke(); }
  // cheek tufts
  ctx.restore();
  // cheeks blush (subtle)

  // eyes: big, excited, looking down at the egg
  eye(418, 500, 80, 100, 26, -26, -0.1, 0);
  eye(606, 500, 80, 100, 30, -30, 0.1, 0);
  // eyebrows: thrilled, raised
  ctx.lineCap = 'round'; ctx.strokeStyle = LINE; ctx.lineWidth = 20;
  ctx.lineWidth = 24;
  ctx.beginPath(); ctx.moveTo(346, 384); ctx.quadraticCurveTo(396, 330, 468, 352); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(556, 352); ctx.quadraticCurveTo(628, 330, 680, 384); ctx.stroke();
  // wattle
  ctx.beginPath(); ctx.ellipse(494, 790, 34, 48, 0.15, 0, TAU); ctx.fillStyle = '#c71a1a'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(530, 784, 28, 42, -0.15, 0, TAU); ctx.fillStyle = '#e02a24'; ctx.fill();
  // beak: wide open in a laugh
  ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(452, 640); ctx.quadraticCurveTo(512, 720, 572, 640); ctx.quadraticCurveTo(512, 770, 452, 640); ctx.closePath(); // lower jaw
  ctx.beginPath(); ctx.moveTo(448, 636); ctx.quadraticCurveTo(512, 650, 576, 636); ctx.lineTo(566, 720); ctx.quadraticCurveTo(512, 810, 458, 720); ctx.closePath();
  ctx.fillStyle = '#e88a12'; ctx.fill(); ctx.lineWidth = 9; ctx.strokeStyle = '#8a4206'; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(470, 650); ctx.quadraticCurveTo(512, 664, 554, 650); ctx.lineTo(548, 716); ctx.quadraticCurveTo(512, 776, 476, 716); ctx.closePath(); ctx.fillStyle = '#7a1414'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(512, 740, 24, 15, 0, 0, TAU); ctx.fillStyle = '#ff6a6a'; ctx.fill();
  // upper beak
  ctx.beginPath(); ctx.moveTo(436, 610); ctx.quadraticCurveTo(512, 560, 588, 610); ctx.quadraticCurveTo(560, 660, 512, 668); ctx.quadraticCurveTo(464, 660, 436, 610); ctx.closePath();
  const bk = ctx.createLinearGradient(0, 570, 0, 668); bk.addColorStop(0, '#ffd04a'); bk.addColorStop(1, '#f59a16'); ctx.fillStyle = bk; ctx.fill(); ctx.lineWidth = 9; ctx.strokeStyle = '#8a4206'; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(486, 600, 18, 7, -0.3, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
}
function eye(x, y, rx, ry, px, py, tilt, lid = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
  ctx.beginPath(); ctx.ellipse(0, 0, rx + 8, ry + 8, 0, 0, TAU); ctx.fillStyle = LINE; ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.save(); ctx.clip(); ctx.beginPath(); ctx.ellipse(0, -ry * 0.9, rx * 1.2, ry * 0.5, 0, 0, TAU); ctx.fillStyle = 'rgba(120,90,60,0.12)'; ctx.fill(); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.clip();
  ctx.rotate(-tilt);
  ctx.beginPath(); ctx.ellipse(px, py, rx * 0.4, ry * 0.42, 0, 0, TAU); ctx.fillStyle = '#2a170a'; ctx.fill();
  ctx.beginPath(); ctx.arc(px - rx * 0.2, py - ry * 0.25, rx * 0.2, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.beginPath(); ctx.arc(px + rx * 0.18, py + ry * 0.22, rx * 0.08, 0, TAU); ctx.fill();
  ctx.rotate(tilt);
  if (lid > 0) { ctx.beginPath(); ctx.rect(-rx - 10, -ry - 10, rx * 2 + 20, ry * 2 * lid + 10); ctx.fillStyle = '#f6e3bb'; ctx.fill(); ctx.beginPath(); ctx.moveTo(-rx - 10, -ry + ry * 2 * lid); ctx.lineTo(rx + 10, -ry + ry * 2 * lid); ctx.lineWidth = 12; ctx.strokeStyle = LINE; ctx.stroke(); }
  ctx.restore();
  ctx.restore();
}
function egg() {
  // the cheeky egg, hugged under her wing, winking
  const x = 770, y = 236, h = 210;
  // whoosh lines behind it
  ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 14;
  for (const [dx, dy, l] of [[-40, 120, 50], [10, 130, 70], [60, 118, 50]]) { ctx.beginPath(); ctx.moveTo(x + dx, y + dy); ctx.lineTo(x + dx - l * 0.45, y + dy + l * 0.9); ctx.stroke(); }
  ctx.restore();
  ctx.save(); ctx.translate(x, y); ctx.rotate(0.3);
  const path = () => { ctx.beginPath(); ctx.moveTo(0, -h * 0.5); ctx.bezierCurveTo(h * 0.42, -h * 0.5, h * 0.44, h * 0.1, h * 0.38, h * 0.22); ctx.bezierCurveTo(h * 0.3, h * 0.48, -h * 0.3, h * 0.48, -h * 0.38, h * 0.22); ctx.bezierCurveTo(-h * 0.44, h * 0.1, -h * 0.42, -h * 0.5, 0, -h * 0.5); ctx.closePath(); };
  path(); ctx.lineWidth = 14; ctx.strokeStyle = LINE; ctx.stroke();
  const g = ctx.createRadialGradient(-h * 0.14, -h * 0.2, 8, 0, 0, h * 0.62); g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#fff3dc'); g.addColorStop(1, '#efcf9c');
  path(); ctx.fillStyle = g; ctx.fill();
  ctx.beginPath(); ctx.ellipse(-h * 0.17, -h * 0.25, h * 0.07, h * 0.12, -0.4, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
  // face: one eye winking, big grin
  ctx.fillStyle = '#2a170a'; ctx.beginPath(); ctx.ellipse(-h * 0.12, -h * 0.02, h * 0.045, h * 0.065, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(-h * 0.13, -h * 0.045, h * 0.016, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineCap = 'round'; ctx.strokeStyle = '#2a170a'; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(h * 0.06, -h * 0.02); ctx.quadraticCurveTo(h * 0.12, -h * 0.07, h * 0.18, -h * 0.02); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-h * 0.16, h * 0.1); ctx.quadraticCurveTo(0, h * 0.26, h * 0.17, h * 0.08); ctx.quadraticCurveTo(0, h * 0.16, -h * 0.16, h * 0.1); ctx.closePath(); ctx.fillStyle = '#7a1414'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, h * 0.165, h * 0.06, h * 0.03, 0, 0, TAU); ctx.fillStyle = '#ff6a6a'; ctx.fill();
  for (const sx of [-1, 1]) { const gg = ctx.createRadialGradient(sx * h * 0.24, h * 0.06, 2, sx * h * 0.24, h * 0.06, h * 0.08); gg.addColorStop(0, 'rgba(255,120,90,0.5)'); gg.addColorStop(1, 'rgba(255,120,90,0)'); ctx.fillStyle = gg; ctx.fillRect(sx * h * 0.24 - 30, h * 0.06 - 30, 60, 60); }
  ctx.restore();
}
function wings() {
  // both wings flung up in alarm: fans of rounded feathers
  for (const sd of [-1, 1]) {
    ctx.save(); ctx.translate(512 + sd * 250, 860); ctx.scale(sd, 1); ctx.rotate(-0.55);
    const F = [[-0.15, 190], [0.15, 210], [0.45, 185], [0.75, 150]];
    for (let k = F.length - 1; k >= 0; k--) { const [a, L] = F[k];
      ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(-34, 0); ctx.bezierCurveTo(-46, -L * 0.6, -26, -L, 0, -L); ctx.bezierCurveTo(26, -L, 46, -L * 0.6, 34, 0); ctx.closePath();
      const g = ctx.createLinearGradient(0, -L, 0, 0); g.addColorStop(0, '#fffaf0'); g.addColorStop(1, '#e6c690'); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 11; ctx.strokeStyle = LINE; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -L * 0.85); ctx.lineTo(0, -L * 0.2); ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(160,110,60,0.45)'; ctx.stroke(); ctx.restore(); }
    ctx.restore();
  }
}
function sparkles() {
  for (const [x, y, r] of [[180, 230, 34], [860, 190, 26], [150, 700, 22], [900, 560, 30]]) {
    ctx.save(); ctx.translate(x, y); ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.35 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath(); ctx.fillStyle = '#fffbe0'; ctx.fill(); ctx.restore();
  }
}
if (layer !== 'fg') { bg(); sparkles(); }
if (layer !== 'bg') { ctx.save(); ctx.translate(500, 1000); ctx.scale(0.92, 0.92); ctx.translate(-512, -1000); hen(); wings(); ctx.restore(); egg(); }
ctx.restore();
