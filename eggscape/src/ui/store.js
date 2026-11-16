// Shop screen, coin and booster icons, and the level-intro booster picker.
// Drawing only: every text and widget goes through ui.text / ui.button / ui.panel / ui.record so
// the game's overlap checker can verify the layout. Input is routed by the game from button ids:
//   store:  'back', 'home', 'store:coins' (jump to the coin packs), 'tab:deals|boosters|hens|skins',
//           'iap:<sku>' / 'feat:<sku>' (real money), 'buy:<boosterId>', 'item:<ally|goldhour|skip>', 'chick:<strikeId>',
//           'charge:chick|chick3|chick10', 'skin:<skinId>' / 'hen:<henSkinId>' (buy or equip), 'ad:coins'
//   A coin button the player cannot afford stays tappable (off face): the game answers with its "Get more" sheet.
//   picker: 'boost:<boosterId>', 'shop'
import { drawEggSkinArt } from '../render/eggskins.js';
import { ICON, C, tint } from './ui.js';
import { themeBack } from './theme.js';
import { BOOSTERS, BOOSTER_ORDER, SKINS, SKIN_ORDER, AD_REWARDS, MAX_OWNED, canAfford, canAffordSkin, ownedCount, ownsSkin, equippedSkin,
  CHARGE_PACKS, MAX_CHARGES, HEN_SKINS, HEN_SKIN_ORDER, ownsHenSkin, ITEMS, ITEM_ORDER, itemCount, CHICK_PRICES, ownsChick,
  IAP, COIN_PACKS, iapAvailable, usdHint, BANK_OPEN, BANK_CAP } from '../economy.js';
import { drawStrikeToken, STRIKES } from '../render/strike.js';
import { drawHenPose, henPose, setHenSkin } from '../render/hen.js';
import { skinId } from '../render/skins.js';

// ---------------------------------------------------------------- icons

function eggPath(ctx, w, h) {
  ctx.beginPath();
  for (let i = 0; i <= 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const sy = Math.sin(a);
    const x = (w / 2) * Math.cos(a) * (1 + 0.13 * sy);
    const y = (h / 2) * sy;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

function sparkle(ctx, x, y, r, a = 1) {
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 ? r * 0.28 : r;
    const ang = (i * Math.PI) / 4 - Math.PI / 2;
    ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = '#fffbe0';
  ctx.fill();
  ctx.restore();
}

// A shiny gold coin with an egg emblem. t drives a slight spin and a passing glint.
export function drawCoin(ctx, cx, cy, r, t = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  const spin = 0.9 + 0.1 * Math.cos(t * 2.4 + cx * 0.05);
  ctx.scale(spin, 1);
  // rim
  const rim = ctx.createLinearGradient(-r, -r, r, r);
  rim.addColorStop(0, '#ffe27a');
  rim.addColorStop(1, '#c47f0a');
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = rim;
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.strokeStyle = '#8a5200';
  ctx.stroke();
  // face
  const face = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 0.85);
  face.addColorStop(0, '#fff0a0');
  face.addColorStop(0.6, '#ffc83a');
  face.addColorStop(1, '#f0a416');
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.76, 0, Math.PI * 2);
  ctx.fillStyle = face;
  ctx.fill();
  if (r >= 7) {
    ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.strokeStyle = 'rgba(138,82,0,0.55)';
    ctx.stroke();
  }
  // egg emblem
  ctx.save();
  ctx.translate(0, r * 0.02);
  eggPath(ctx, r * 0.74 * 0.78, r * 0.74);
  ctx.fillStyle = '#fff6d0';
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.strokeStyle = '#a8670a';
  ctx.stroke();
  ctx.restore();
  // glint sweeping across every few seconds
  const ph = (t * 0.45) % 1;
  if (ph < 0.4) {
    const gx = -r * 1.2 + (ph / 0.4) * r * 2.4;
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2);
    ctx.clip();
    ctx.rotate(0.6);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(gx - r * 0.12, -r * 1.4, r * 0.24, r * 2.8);
    ctx.restore();
  }
  ctx.restore();
}

// Booster icons. (cx, cy) is the center, s the bounding size (diameter-ish).
export function drawBoosterIcon(ctx, id, cx, cy, s, t = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s); // draw in unit space: roughly -0.5..0.5
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const lw = (px) => px; // unit-space line widths
  if (id === 'stone') {
    eggPath(ctx, 0.64, 0.86);
    const g = ctx.createLinearGradient(-0.3, -0.4, 0.3, 0.4);
    g.addColorStop(0, '#d3d7dc');
    g.addColorStop(0.55, '#8f969e');
    g.addColorStop(1, '#5a6068');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = lw(0.05);
    ctx.strokeStyle = '#33383e';
    ctx.stroke();
    // speckles and chips
    ctx.fillStyle = 'rgba(40,46,52,0.45)';
    for (const [x, y, r] of [[-0.12, -0.16, 0.035], [0.1, -0.02, 0.03], [-0.06, 0.14, 0.04], [0.14, 0.2, 0.025], [-0.2, 0.02, 0.022]]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // crack
    ctx.strokeStyle = 'rgba(30,34,40,0.75)';
    ctx.lineWidth = lw(0.03);
    ctx.beginPath();
    ctx.moveTo(0.04, -0.34);
    ctx.lineTo(-0.04, -0.2);
    ctx.lineTo(0.06, -0.1);
    ctx.lineTo(0, 0.02);
    ctx.stroke();
    // highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = lw(0.045);
    ctx.beginPath();
    ctx.arc(0, 0.02, 0.27, Math.PI * 1.08, Math.PI * 1.38);
    ctx.stroke();
  } else if (id === 'golden') {
    eggPath(ctx, 0.64, 0.86);
    const g = ctx.createLinearGradient(-0.3, -0.4, 0.3, 0.42);
    g.addColorStop(0, '#fff3a6');
    g.addColorStop(0.5, '#ffc628');
    g.addColorStop(1, '#c97d06');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = lw(0.05);
    ctx.strokeStyle = '#8a5200';
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = lw(0.05);
    ctx.beginPath();
    ctx.arc(0, 0.02, 0.27, Math.PI * 1.08, Math.PI * 1.38);
    ctx.stroke();
    const p1 = 0.65 + 0.35 * Math.sin(t * 3.2);
    const p2 = 0.65 + 0.35 * Math.sin(t * 3.2 + 2.1);
    sparkle(ctx, 0.3, -0.3, 0.17 * (0.7 + 0.5 * p1), 0.5 + 0.5 * p1);
    sparkle(ctx, -0.33, 0.12, 0.11 * (0.7 + 0.5 * p2), 0.5 + 0.5 * p2);
  } else if (id === 'time') {
    // bomb-style clock with a lit fuse and a "+" badge
    const ccx = -0.03, ccy = 0.06, cr = 0.32;
    ctx.strokeStyle = '#6b3a14';
    ctx.lineWidth = lw(0.045);
    ctx.beginPath();
    ctx.moveTo(ccx, ccy - cr);
    ctx.quadraticCurveTo(ccx - 0.04, ccy - cr - 0.1, ccx - 0.12, ccy - cr - 0.12);
    ctx.stroke();
    const flick = 0.75 + 0.25 * Math.sin(t * 14);
    sparkle(ctx, ccx - 0.14, ccy - cr - 0.13, 0.12 * flick, 1);
    ctx.fillStyle = '#ff7a2a';
    ctx.beginPath();
    ctx.arc(ccx - 0.14, ccy - cr - 0.13, 0.03, 0, Math.PI * 2);
    ctx.fill();
    // body
    const g = ctx.createRadialGradient(ccx - 0.1, ccy - 0.1, 0.03, ccx, ccy, cr);
    g.addColorStop(0, '#ff9a5a');
    g.addColorStop(1, '#d4481a');
    ctx.beginPath();
    ctx.arc(ccx, ccy, cr, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = lw(0.045);
    ctx.strokeStyle = '#7a2208';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ccx, ccy, cr * 0.76, 0, Math.PI * 2);
    ctx.fillStyle = '#fff3d6';
    ctx.fill();
    ctx.strokeStyle = '#4a2a14';
    ctx.lineWidth = lw(0.035);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(ccx + Math.cos(a) * cr * 0.58, ccy + Math.sin(a) * cr * 0.58);
      ctx.lineTo(ccx + Math.cos(a) * cr * 0.7, ccy + Math.sin(a) * cr * 0.7);
      ctx.stroke();
    }
    const ha = -Math.PI / 2 + t * 0.8;
    ctx.lineWidth = lw(0.04);
    ctx.beginPath();
    ctx.moveTo(ccx, ccy);
    ctx.lineTo(ccx + Math.cos(ha) * cr * 0.5, ccy + Math.sin(ha) * cr * 0.5);
    ctx.moveTo(ccx, ccy);
    ctx.lineTo(ccx + Math.cos(-0.2) * cr * 0.34, ccy + Math.sin(-0.2) * cr * 0.34);
    ctx.stroke();
    // plus badge
    ctx.beginPath();
    ctx.arc(0.3, 0.3, 0.17, 0, Math.PI * 2);
    ctx.fillStyle = '#3fbf4a';
    ctx.fill();
    ctx.lineWidth = lw(0.035);
    ctx.strokeStyle = '#1f7a2a';
    ctx.stroke();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = lw(0.055);
    ctx.beginPath();
    ctx.moveTo(0.3, 0.22);
    ctx.lineTo(0.3, 0.38);
    ctx.moveTo(0.22, 0.3);
    ctx.lineTo(0.38, 0.3);
    ctx.stroke();
  } else if (id === 'rewind') {
    ctx.beginPath();
    ctx.arc(0, 0, 0.43, 0, Math.PI * 2);
    const g = ctx.createLinearGradient(0, -0.43, 0, 0.43);
    g.addColorStop(0, '#6fa4ff');
    g.addColorStop(1, '#3466d0');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = lw(0.045);
    ctx.strokeStyle = '#1f4496';
    ctx.stroke();
    ctx.save();
    ctx.scale(-1, 1); // counter-clockwise arrow
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = lw(0.075);
    ctx.beginPath();
    ctx.arc(0, 0, 0.26, -0.4, Math.PI * 1.45);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    const ax = 0.26 * Math.cos(-0.4), ay = 0.26 * Math.sin(-0.4);
    ctx.beginPath();
    ctx.moveTo(ax + 0.17, ay - 0.02);
    ctx.lineTo(ax - 0.07, ay - 0.2);
    ctx.lineTo(ax - 0.09, ay + 0.09);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = lw(0.05);
    ctx.beginPath();
    ctx.moveTo(0, -0.12);
    ctx.lineTo(0, 0.01);
    ctx.lineTo(0.09, 0.07);
    ctx.stroke();
  } else if (id === 'sponge') {
    const x0 = -0.37, w = 0.74, y0 = -0.19, h = 0.44;
    const rr = 0.1;
    const rp = (x, y, ww, hh, r) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + ww, y, x + ww, y + hh, r);
      ctx.arcTo(x + ww, y + hh, x, y + hh, r);
      ctx.arcTo(x, y + hh, x, y, r);
      ctx.arcTo(x, y, x + ww, y, r);
      ctx.closePath();
    };
    // scrub layer
    rp(x0, y0 + h * 0.62, w, h * 0.38 + 0.03, rr);
    ctx.fillStyle = '#3fa24a';
    ctx.fill();
    ctx.lineWidth = lw(0.04);
    ctx.strokeStyle = '#1f6a2a';
    ctx.stroke();
    // foam
    rp(x0, y0 - 0.02, w, h * 0.7, rr);
    const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
    g.addColorStop(0, '#fff07a');
    g.addColorStop(1, '#f3c61c');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#a77d00';
    ctx.stroke();
    ctx.fillStyle = 'rgba(176,128,0,0.55)';
    for (const [x, y, r] of [[-0.24, -0.1, 0.045], [-0.05, -0.12, 0.035], [0.17, -0.09, 0.05], [-0.14, 0.02, 0.03], [0.07, 0.0, 0.04], [0.27, 0.02, 0.028]]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = lw(0.04);
    ctx.beginPath();
    ctx.moveTo(-0.3, -0.15);
    ctx.lineTo(-0.15, -0.15);
    ctx.stroke();
    // bubbles
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = lw(0.025);
    const b = Math.sin(t * 2) * 0.01;
    ctx.beginPath();
    ctx.arc(0.28, -0.3 + b, 0.05, 0, Math.PI * 2);
    ctx.moveTo(0.14 + 0.03, -0.36 - b);
    ctx.arc(0.14, -0.36 - b, 0.03, 0, Math.PI * 2);
    ctx.stroke();
  } else if (id === 'nest') {
    // Wide Nest: a woven basket stretched wide, arrows pushing its rims out
    ctx.beginPath(); ctx.moveTo(-0.44, -0.04); ctx.quadraticCurveTo(-0.4, 0.3, 0, 0.3); ctx.quadraticCurveTo(0.4, 0.3, 0.44, -0.04); ctx.closePath();
    const g = ctx.createLinearGradient(0, -0.05, 0, 0.3); g.addColorStop(0, '#e6b866'); g.addColorStop(1, '#a8702a');
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = lw(0.04); ctx.strokeStyle = '#5a3a12'; ctx.stroke();
    ctx.strokeStyle = 'rgba(90,58,18,0.55)'; ctx.lineWidth = lw(0.025);
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 0.11, -0.02); ctx.quadraticCurveTo(i * 0.09, 0.16, i * 0.06, 0.28); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-0.38, 0.1); ctx.quadraticCurveTo(0, 0.17, 0.38, 0.1); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -0.04, 0.44, 0.07, 0, 0, Math.PI * 2); ctx.fillStyle = '#f2cf86'; ctx.fill(); ctx.lineWidth = lw(0.04); ctx.strokeStyle = '#5a3a12'; ctx.stroke();
    ctx.save(); ctx.translate(0, -0.12); eggPath(ctx, 0.22, 0.28); ctx.fillStyle = '#fff6e2'; ctx.fill(); ctx.lineWidth = lw(0.03); ctx.strokeStyle = '#8a6a3c'; ctx.stroke(); ctx.restore();
    const push = 0.03 * Math.sin(t * 4);
    for (const sd of [-1, 1]) {
      ctx.save(); ctx.translate(sd * (0.4 + push), -0.3); ctx.scale(sd, 1);
      ctx.beginPath(); ctx.moveTo(-0.1, 0); ctx.lineTo(0.06, 0); ctx.lineTo(0.06, -0.06); ctx.lineTo(0.16, 0.03); ctx.lineTo(0.06, 0.12); ctx.lineTo(0.06, 0.06); ctx.lineTo(-0.1, 0.06); ctx.closePath();
      ctx.fillStyle = '#3fbf4a'; ctx.fill(); ctx.lineWidth = lw(0.025); ctx.strokeStyle = '#1f6a2a'; ctx.stroke(); ctx.restore();
    }
  } else if (id === 'snips') {
    // Thorn Snips: a thorn cut in two, the shears closing on it
    ctx.save(); ctx.translate(-0.16, 0.18);
    ctx.beginPath(); ctx.moveTo(-0.12, 0.18); ctx.lineTo(0.12, 0.18); ctx.lineTo(0.02, -0.04); ctx.lineTo(-0.02, -0.04); ctx.closePath(); ctx.fillStyle = '#5f8a3a'; ctx.fill(); ctx.lineWidth = lw(0.03); ctx.strokeStyle = '#2a4418'; ctx.stroke();
    ctx.translate(0.06, -0.12); ctx.rotate(0.6 + 0.1 * Math.sin(t * 3));
    ctx.beginPath(); ctx.moveTo(-0.04, 0.06); ctx.lineTo(0.04, 0.06); ctx.lineTo(0, -0.16); ctx.closePath(); ctx.fillStyle = '#7aa84a'; ctx.fill(); ctx.stroke();
    ctx.restore();
    const cl = 0.5 + 0.5 * Math.sin(t * 5), a = 0.12 + 0.3 * cl;
    ctx.save(); ctx.translate(0.08, -0.06); ctx.rotate(-0.7);
    for (const sd of [-1, 1]) {
      ctx.save(); ctx.rotate(sd * a);
      ctx.beginPath(); ctx.moveTo(0, -0.03 * sd); ctx.lineTo(-0.42, 0); ctx.lineTo(0, 0.05 * sd); ctx.closePath(); ctx.fillStyle = '#e6eef4'; ctx.fill(); ctx.lineWidth = lw(0.025); ctx.strokeStyle = '#4a5866'; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0.17, 0.07 * sd, 0.1, 0.07, 0, 0, Math.PI * 2); ctx.lineWidth = lw(0.055); ctx.strokeStyle = '#e8402e'; ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(0, 0, 0.03, 0, Math.PI * 2); ctx.fillStyle = '#4a5866'; ctx.fill();
    ctx.restore();
  } else {
    // unknown id: a question-mark disc
    ctx.beginPath();
    ctx.arc(0, 0, 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#888';
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- helpers

function wrapLines(ui, str, size, maxW) {
  // keep a number and its unit ("8 s") on one line
  const words = str.replace(/(\d) (s|seconds)\b/g, '$1\u00a0$2').split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (cur && ui.measure(next, size) > maxW) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.map((l) => l.replace(/\u00a0/g, ' '));
}

// Largest size in [minSize, maxSize] at which str wraps into <= maxLines lines of maxW.
function fitWrap(ui, str, maxW, maxLines, maxSize, minSize) {
  for (let size = maxSize; size >= minSize - 0.01; size -= 0.5) {
    const lines = wrapLines(ui, str, size, maxW);
    if (lines.length <= maxLines) return { size, lines };
  }
  const lines = wrapLines(ui, str, minSize, maxW).slice(0, maxLines);
  return { size: minSize, lines };
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}

const coinIcon = (t) => (ctx, cx, cy, sz) => drawCoin(ctx, cx, cy, sz * 0.5, t);

// ---------------------------------------------------------------- store screen

// Layout dimensions at scale s = 1 (every number below is multiplied by the chosen scale).
const D = { pad: 14, tabY: 64, tabH: 34, top: 106, gap: 9, cardH: 88, adH: 54, adGap: 14, minW1: 330, minW2: 300, packH: 156, featH: 132, headH: 22 };

const BAL = { v: null };

function planLayout(W, H, u) {
  const sMax = Math.min(1.55, u * 1.18);
  const need1 = D.top + 5 * D.cardH + 4 * D.gap + D.adGap + D.adH + D.pad;
  const need2 = D.top + 3 * D.cardH + 2 * D.gap + D.pad;
  const s1 = Math.min(sMax, H / need1, W / (D.minW1 + 2 * D.pad));
  const s2 = Math.min(sMax, H / need2, W / (2 * D.minW2 + 2 * D.pad + D.gap));
  return s2 > s1 * 1.08 ? { cols: 2, s: Math.max(0.5, s2) } : { cols: 1, s: Math.max(0.5, s1) };
}

const fmtNum = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// One shop card. item: { key, name, line, icon(ctx, cx, cy, size, t, bounce), btn: {id, label, kind, disabled, coin, size},
// sub: { text, color } | null, flash, big (the featured offer), tag (a small pill over the name), bar: { p, mark } }
function drawCard(ui, ctx, item, x, y, cw, ch, s, t, wide) {
  const flash = item.flash;
  const fl = flash < 0.9 ? 1 - flash / 0.9 : 0;
  // a cream card in a thin wooden frame; a purchase rings it in gold for a moment (the featured offer glows softly)
  const lip = 4 * s, fh = ch - lip;
  const glowA = Math.max(fl, item.big && !ui.calm ? 0.35 + 0.2 * Math.sin(t * 2.2) : 0);
  ui.frame(x, y, cw, fh, { s, r: 16 * s, fw: 4.5 * s, lip, glow: '#ffe27a', glowA, record: true, tag: 'panel:card:' + item.key });

  const p = 10 * s;
  const it = fh - 2 * p;
  const ix = x + p, iy = y + p;
  ui.well(ix, iy, it, it, { s, r: 12 * s, a: item.owned ? '#bfe6ff' : '#cfe9fb', b: '#eaf6ff', shade: 'rgba(20,70,130,0.28)', border: 'rgba(60,90,130,0.55)' });
  ui.record({ x: ix, y: iy, w: it, h: it }, 'store:icon:' + item.key);
  const bounce = flash < 0.6 ? 1 + 0.22 * Math.sin((flash / 0.6) * Math.PI) : 1;
  item.icon(ctx, ix + it / 2, iy + it / 2, it, t, bounce);

  if (item.big && cw < 470 * s) return drawFeaturedNarrow(ui, ctx, item, ix + it + 10 * s, y, x + cw - p - 2 * s, fh, p, s, t);
  // button (right) with an optional small line underneath
  const bh = (item.big ? 48 : 42) * s;
  const bSize = (item.btn.size || 19) * s;
  // ui.button pads with ui.u (not s), so make sure the label really fits
  const need = ui.measure(item.btn.label, bSize) + 24 * ui.u + (item.btn.coin || item.btn.icon ? bSize * 1.05 + 8 * ui.u : 0);
  const bw = Math.min(Math.max((item.big ? 118 : wide ? 92 : 84) * s, need), cw * 0.4);
  const subSize = 12.5 * s;
  const stackH = bh + (item.sub ? 3 * s + subSize * 1.1 : 0);
  const bx = x + cw - p - 2 * s - bw;
  const by = y + (fh - stackH) / 2;
  const B = item.btn;
  ui.button(B.id, B.label, bx, by, bw, bh, {
    kind: B.kind, disabled: B.disabled, keepFace: B.keepFace, dim: B.keepFace ? 1 : undefined, icon: B.coin ? coinIcon(t) : B.icon || null, size: bSize, shimmer: !!item.big || !!B.ad, ad: !!B.ad,
  });
  if (item.sub) {
    ui.text(item.sub.text, bx + bw / 2, by + bh + 3 * s + subSize * 0.55, { size: subSize, align: 'center', maxW: bw, color: item.sub.color, tag: 'store:sub:' + item.key });
  }

  // name + one-line explanation (wrapped), centered vertically in the middle column
  const tx = ix + it + 10 * s;
  const tw = bx - 8 * s - tx;
  const nameSize = (item.big ? 21 : 17.5) * s;
  const tagH = item.tag ? 20 * s : 0, barH = item.bar ? 15 * s : 0;
  const maxDescH = fh - 2 * p - nameSize * 1.2 - tagH - barH;
  const maxLines = Math.max(2, Math.min(item.big || item.tall ? 4 : 3, Math.floor(maxDescH / (10.5 * s * 1.18))));
  const desc = fitWrap(ui, item.line, tw, maxLines, (item.big ? 14.5 : 13.5) * s, 10.5 * s);
  const lineH = desc.size * 1.18;
  const blockH = tagH + nameSize * 1.2 + desc.lines.length * lineH + barH;
  let cy = y + (fh - blockH) / 2;
  if (item.tag) { pill(ui, ctx, item.tag, tx, cy + 1 * s, 13 * s, '#e8402e', 'store:tag:' + item.key, s); cy += tagH; }
  ui.text(item.name, tx, cy + nameSize * 0.6, { size: nameSize, maxW: tw, color: C.ink, tag: 'store:name:' + item.key });
  cy += nameSize * 1.2;
  desc.lines.forEach((ln, i) => {
    ui.text(ln, tx, cy + lineH * (i + 0.5), { size: desc.size, maxW: tw, color: C.ink2, tag: `store:desc:${item.key}:${i}` });
  });
  if (item.bar) { // a fill bar (the Golden Egg Bank), with a tick where it can be opened
    const yb = cy + desc.lines.length * lineH + 5 * s, hb = 8 * s;
    ui.roundRect(tx, yb, tw, hb, hb / 2); ctx.fillStyle = 'rgba(110,70,30,0.22)'; ctx.fill();
    if (item.bar.p > 0) { ui.roundRect(tx, yb, Math.max(hb, tw * item.bar.p), hb, hb / 2); const g = ctx.createLinearGradient(0, yb, 0, yb + hb); g.addColorStop(0, '#ffe680'); g.addColorStop(1, '#e89a10'); ctx.fillStyle = g; ctx.fill(); }
    if (item.bar.mark) { ctx.fillStyle = '#7a4a14'; ctx.fillRect(tx + tw * item.bar.mark - 1 * s, yb - 2 * s, 2 * s, hb + 4 * s); }
    ui.record({ x: tx, y: yb, w: tw, h: hb }, 'store:bar:' + item.key);
  }
}

// the featured offer on a phone held upright: tag, name and the whole line over a full-width price button
function drawFeaturedNarrow(ui, ctx, item, tx, y, xr, fh, p, s, t) {
  const tw = xr - tx, bh = 46 * s, by = y + fh - p - bh, B = item.btn;
  ui.button(B.id, B.label, tx, by, tw, bh, { kind: B.kind, disabled: B.disabled, keepFace: B.keepFace, dim: B.keepFace ? 1 : undefined, icon: B.icon || null, size: (B.size || 19) * s, shimmer: !B.disabled, ad: !!B.ad });
  let cy = y + p;
  if (item.tag) {
    const pw = pill(ui, ctx, item.tag, tx, cy, 13 * s, '#e8402e', 'store:tag:' + item.key, s);
    if (item.sub) ui.text(item.sub.text, xr, cy + 9.5 * s, { size: 12.5 * s, align: 'right', maxW: tw - pw - 6 * s, color: item.sub.color, tag: 'store:sub:' + item.key });
    cy += 23 * s;
  }
  const nameSize = 21 * s;
  ui.text(item.name, tx, cy + nameSize * 0.6, { size: nameSize, maxW: tw, color: C.ink, tag: 'store:name:' + item.key });
  cy += nameSize * 1.22;
  const room = by - 4 * s - cy, desc = fitWrap(ui, item.line, tw, Math.max(1, Math.min(3, Math.floor(room / (11 * s * 1.18)))), 14 * s, 11 * s), lineH = desc.size * 1.18;
  desc.lines.forEach((ln, i) => ui.text(ln, tx, cy + lineH * (i + 0.5), { size: desc.size, maxW: tw, color: C.ink2, tag: `store:desc:${item.key}:${i}` }));
}

// a small rounded label (Most popular, Best value, Special offer); x is its left edge, y its top
function pill(ui, ctx, str, x, y, size, color, tag, s, group) {
  const w = ui.measure(str, size) + 14 * s, h = size * 1.45;
  ui.roundRect(x, y, w, h, h / 2); ctx.fillStyle = color; ctx.fill();
  ctx.lineWidth = 1.5 * s; ctx.strokeStyle = 'rgba(80,10,0,0.55)'; ctx.stroke();
  ui.text(str, x + w / 2, y + h / 2 + 0.5 * s, { size, align: 'center', color: '#fff', tag, group });
  return w;
}

const GREEN = { kind: 'primary' };
// too few coins: the button looks off but still takes a tap, which opens the "Get more" sheet
const GREY = { kind: 'off' };
const OWNED = (id, label = 'Owned') => ({ id, label, disabled: true, keepFace: true, size: 14, kind: 'tertiary', icon: ICON.check });
const flashOf = (st, id) => (st.flash && st.flash.id === id ? st.flash.t : 99);

function boosterItem(id, st) {
  const b = BOOSTERS[id];
  const owned = ownedCount(st.wallet, id);
  const ok = canAfford(st.wallet, id);
  const maxed = owned >= MAX_OWNED;
  return {
    key: id, name: b.name, line: b.line, owned: owned > 0, count: owned,
    flash: flashOf(st, id),
    icon: (ctx, cx, cy, it, t, bounce) => drawBoosterIcon(ctx, id, cx, cy, it * 0.78 * bounce, t),
    btn: { id: 'buy:' + id, label: maxed ? 'Max' : String(b.price), disabled: maxed, coin: !maxed, ...(ok ? GREEN : GREY) },
    sub: { text: 'Owned ' + owned, color: owned > 0 ? C.good : 'rgba(138,98,56,0.75)' },
  };
}

function skinItem(id, st) {
  const k = SKINS[id];
  const w = st.wallet;
  const owns = ownsSkin(w, id);
  const equipped = equippedSkin(w) === id;
  let btn;
  if (equipped) btn = { id: 'skin:' + id, label: 'Equipped', disabled: true, keepFace: true, size: 14, kind: 'tertiary', icon: ICON.check };
  else if (owns) btn = { id: 'skin:' + id, label: 'Equip', size: 19, kind: 'secondary' };
  else {
    const ok = canAffordSkin(w, id);
    btn = { id: 'skin:' + id, label: String(k.price), coin: true, ...(ok ? GREEN : GREY) };
  }
  return {
    key: 'skin:' + id, name: k.name, line: k.line, owned: owns,
    flash: flashOf(st, 'skin:' + id),
    icon: (ctx, cx, cy, it, t, bounce) => drawSkinPreview(ctx, id, cx, cy + it * 0.02, it * 0.8 * bounce, t),
    btn, sub: null,
  };
}

function chargeItem(P, st) {
  const w = st.wallet, n = P.n || 1;
  const full = (w.charges || 0) + n > MAX_CHARGES, ok = !full && w.coins >= P.price;
  return {
    key: 'charge:' + P.id, name: P.name, short: n > 1 ? `${n} Charges` : P.name, line: P.line, owned: (w.charges || 0) > 0,
    flash: flashOf(st, 'charge:' + P.id),
    icon: (ctx, cx, cy, it, t, bounce) => {
      if (n === 1) drawStrikeToken(ctx, 'freeze', cx, cy, it * 0.36 * bounce, t, true);
      else if (n === 3) for (const [dx, dy, id] of [[-0.2, 0.12, 'shock'], [0.2, 0.12, 'wind'], [0, -0.14, 'freeze']]) drawStrikeToken(ctx, id, cx + dx * it, cy + dy * it, it * 0.24 * bounce, t, true);
      else for (const [dx, dy, id] of [[-0.24, 0.18, 'bomb'], [0.24, 0.18, 'glue'], [-0.13, -0.14, 'thunder'], [0.15, -0.16, 'tornado'], [0, 0.06, 'freeze']]) drawStrikeToken(ctx, id, cx + dx * it, cy + dy * it, it * 0.2 * bounce, t, true);
    },
    btn: { id: 'charge:' + P.id, label: full ? 'Full' : String(P.price), disabled: full, coin: !full, ...(ok ? GREEN : GREY) },
    sub: { text: 'In bag ' + (w.charges || 0), color: (w.charges || 0) > 0 ? C.good : 'rgba(138,98,56,0.75)' },
  };
}

function coinItemCard(id, st) {
  const I = ITEMS[id], w = st.wallet, n = itemCount(w, id), ok = w.coins >= I.price;
  return {
    key: 'item:' + id, name: I.name, line: I.line, owned: n > 0, count: n,
    flash: flashOf(st, 'item:' + id),
    icon: (ctx, cx, cy, it, t, bounce) => drawItemArt(ctx, id, cx, cy, it * bounce, t),
    btn: { id: 'item:' + id, label: String(I.price), coin: true, ...(ok ? GREEN : GREY) },
    sub: { text: id === 'goldhour' ? (n ? `${n} win${n > 1 ? 's' : ''} left` : 'Not active') : 'Owned ' + n, color: n > 0 ? C.good : 'rgba(138,98,56,0.75)' },
  };
}

function chickItem(S, st) {
  const w = st.wallet, mine = ownsChick(w, S.id) || (!S.premium && st.reach >= S.unlock), price = CHICK_PRICES[S.id], ok = w.coins >= price;
  return {
    key: 'chick:' + S.id, name: S.name, owned: mine, badge: mine || S.premium ? null : 'Lv ' + S.unlock, premium: !!S.premium,
    line: S.premium ? `${S.up} Downside: ${S.down}${mine ? '' : ' Premium: coins only.'}` : mine ? 'Yours: usable in every level with villains.' : `Free at level ${S.unlock}. Or unlock it now.`,
    flash: flashOf(st, 'chick:' + S.id),
    icon: (ctx, cx, cy, it, t, bounce) => {
      drawStrikeToken(ctx, S.id, cx, cy, it * 0.38 * bounce, t, mine);
      if (!mine) padlock(ctx, cx + it * 0.27, cy + it * 0.27, it * 0.13);
    },
    btn: mine ? OWNED('chick:' + S.id, 'Yours') : { id: 'chick:' + S.id, label: String(price), coin: true, ...(ok ? GREEN : GREY) },
    sub: mine ? null : { text: S.premium ? 'Premium chick' : 'Unlock now', color: S.premium ? '#b0700a' : C.ink2 },
  };
}

// the hen in a skin, standing, for the shop card (the global skin is put back right after)
function drawHenSkinPreview(ctx, id, cx, cy, h, t) {
  const was = skinId();
  setHenSkin(id);
  try { drawHenPose(ctx, henPose({}), cx, cy, h, { face: 1, tt: t, shadow: false, calm: true }); } finally { setHenSkin(was); }
}

function henItem(id, st) {
  const k = HEN_SKINS[id], w = st.wallet;
  const owns = ownsHenSkin(w, id), equipped = (w.henSkin || 'classic') === id;
  let btn;
  if (equipped) btn = { id: 'hen:' + id, label: 'Equipped', disabled: true, keepFace: true, size: 14, kind: 'tertiary', icon: ICON.check };
  else if (owns) btn = { id: 'hen:' + id, label: 'Equip', size: 19, kind: 'secondary' };
  else if (k.premium) btn = { id: 'iap:' + PREMIUM, label: 'Premium', size: 16, kind: 'gold' };
  else { const ok = w.coins >= k.price; btn = { id: 'hen:' + id, label: String(k.price), coin: true, ...(ok ? GREEN : GREY) }; }
  return {
    key: 'hen:' + id, name: k.name, line: k.line, owned: owns,
    flash: flashOf(st, 'hen:' + id),
    icon: (ctx, cx, cy, it, t, bounce) => drawHenSkinPreview(ctx, id, cx, cy + it * 0.04, it * 0.84 * bounce, t),
    btn, sub: null,
  };
}

const PREMIUM = 'eggscape_premium';
// a real-money product as a card: the localized price (or the USD hint) on the button, "Owned" once a one-time one is bought
function iapItem(sku, st, o = {}) {
  const P = IAP[sku], can = iapAvailable(st.wallet, sku), id = (o.pre || 'iap:') + sku;
  return {
    key: (o.pre || 'iap:') + sku, name: o.name || P.name, short: sku === 'all_chicks' ? 'All chicks' : null, line: o.line || P.line, owned: !can, big: !!o.big, tag: o.tag, tall: sku === PREMIUM,
    flash: flashOf(st, 'iap:' + sku),
    icon: (ctx, cx, cy, it, t, bounce) => drawIapArt(ctx, sku, cx, cy, it * bounce, t, st.wallet),
    btn: can ? { id, label: st.price(sku), kind: sku === PREMIUM || o.big ? 'gold' : 'primary', size: o.big ? 19 : 17 } : OWNED(id),
    sub: can && P.type === 'once' ? { text: 'One time', color: C.ink2 } : null,
  };
}

function bankItem(st) {
  const b = st.wallet.bank || 0, open = b >= BANK_OPEN;
  return {
    key: 'bank', name: 'Golden Egg Bank', owned: open, flash: flashOf(st, 'iap:egg_bank'),
    line: open ? `${fmtNum(b)} coins inside! Crack it open to take them all.` : `${fmtNum(b)} coins inside. Every win drops more in.`,
    bar: { p: Math.min(1, b / BANK_CAP), mark: BANK_OPEN / BANK_CAP },
    icon: (ctx, cx, cy, it, t, bounce) => drawGlassEgg(ctx, cx, cy, it * 0.8 * bounce, b / BANK_CAP, t),
    btn: open ? { id: 'iap:egg_bank', label: 'Crack it open', kind: 'gold', size: 15 } : { id: 'bank:wait', label: 'Filling', kind: 'off', disabled: true, size: 15 },
    sub: { text: open ? st.price('egg_bank') : `Opens at ${BANK_OPEN}`, color: C.ink2 },
  };
}

// ---- product art (drawn in a square well of size `it` centred at cx, cy)

// a heap of coins: n = 1..6 grows the pile
function coinPile(ctx, cx, cy, it, n, t) {
  const r = it * (n > 4 ? 0.13 : 0.15), rows = n <= 1 ? [1] : n === 2 ? [2, 1] : n === 3 ? [3, 2] : n === 4 ? [3, 2, 1] : n === 5 ? [4, 3, 2] : [4, 3, 2, 1];
  const H = rows.length * r * 1.25;
  rows.forEach((k, j) => { for (let i = 0; i < k; i++) drawCoin(ctx, cx + (i - (k - 1) / 2) * r * 1.6, cy + H / 2 - r - j * r * 1.25, r, t + i * 0.7 + j); });
  if (n >= 5) sparkle(ctx, cx + it * 0.28, cy - it * 0.26, it * 0.07, 0.6 + 0.4 * Math.sin(t * 3));
}

function padlock(ctx, x, y, r) {
  ctx.save();
  ctx.lineWidth = r * 0.32; ctx.strokeStyle = '#5a5f66';
  ctx.beginPath(); ctx.arc(x, y - r * 0.35, r * 0.48, Math.PI, 0); ctx.stroke();
  ctx.fillStyle = '#e0a526'; ctx.strokeStyle = '#6b3d04'; ctx.lineWidth = r * 0.14;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - r * 0.75, y - r * 0.4, r * 1.5, r * 1.2, r * 0.25) : ctx.rect(x - r * 0.75, y - r * 0.4, r * 1.5, r * 1.2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#6b3d04'; ctx.beginPath(); ctx.arc(x, y + r * 0.12, r * 0.18, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// The Golden Egg Bank: a glass egg filling with gold. fill 0..1. Also the small meter on the home screen.
export function drawGlassEgg(ctx, cx, cy, h, fill, t = 0) {
  const w = h * 0.78;
  ctx.save();
  ctx.translate(cx, cy);
  eggPath(ctx, w, h);
  ctx.fillStyle = 'rgba(220,240,255,0.35)';
  ctx.fill();
  ctx.save();
  eggPath(ctx, w, h);
  ctx.clip();
  const f = Math.max(0, Math.min(1, fill)), top = h / 2 - h * (0.06 + 0.9 * f);
  if (f > 0) {
    const g = ctx.createLinearGradient(0, top, 0, h / 2);
    g.addColorStop(0, '#ffe680'); g.addColorStop(1, '#d98a06');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-w, h);
    for (let i = 0; i <= 10; i++) ctx.lineTo(-w / 2 + (i / 10) * w, top + Math.sin(i * 1.7 + t * 2) * h * 0.012);
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,250,200,0.8)'; // coin glints in the gold
    for (const [x, y] of [[-0.18, 0.36], [0.14, 0.3], [0, 0.42], [0.2, 0.42], [-0.1, 0.2]]) if (y * h > top + h * 0.04) { ctx.beginPath(); ctx.ellipse(x * w, y * h, w * 0.07, h * 0.025, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
  eggPath(ctx, w, h);
  ctx.lineWidth = Math.max(1.2, h * 0.05); ctx.strokeStyle = 'rgba(40,70,110,0.85)'; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(1, h * 0.045); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(-w * 0.04, -h * 0.02, w * 0.32, Math.PI * 1.08, Math.PI * 1.42); ctx.stroke();
  ctx.restore();
  if (f >= BANK_OPEN / BANK_CAP) sparkle(ctx, cx + w * 0.42, cy - h * 0.34, h * 0.13, 0.6 + 0.4 * Math.sin(t * 4));
}

// a ticket stub (Ally / Skip) with a little symbol, an hourglass of gold (Golden Hour)
function drawItemArt(ctx, id, cx, cy, it, t) {
  ctx.save();
  if (id === 'goldhour') {
    drawCoin(ctx, cx + it * 0.2, cy + it * 0.18, it * 0.16, t);
    ctx.translate(cx - it * 0.05, cy - it * 0.02);
    const h = it * 0.32, w = it * 0.22;
    ctx.fillStyle = '#8a5a2b'; ctx.fillRect(-w * 0.75, -h - it * 0.04, w * 1.5, it * 0.06); ctx.fillRect(-w * 0.75, h - it * 0.02, w * 1.5, it * 0.06);
    ctx.beginPath(); ctx.moveTo(-w / 2, -h); ctx.lineTo(w / 2, -h); ctx.lineTo(w * 0.08, 0); ctx.lineTo(w / 2, h); ctx.lineTo(-w / 2, h); ctx.lineTo(-w * 0.08, 0); ctx.closePath();
    ctx.fillStyle = 'rgba(220,240,255,0.7)'; ctx.fill(); ctx.lineWidth = it * 0.025; ctx.strokeStyle = '#3c5a80'; ctx.stroke();
    ctx.fillStyle = '#ffc83a';
    ctx.beginPath(); ctx.moveTo(-w * 0.3, -h * 0.55); ctx.lineTo(w * 0.3, -h * 0.55); ctx.lineTo(0, -h * 0.05); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-w * 0.45, h * 0.95); ctx.lineTo(w * 0.45, h * 0.95); ctx.lineTo(0, h * 0.4); ctx.closePath(); ctx.fill();
    ctx.restore();
    sparkle(ctx, cx - it * 0.3, cy - it * 0.28, it * 0.07, 0.6 + 0.4 * Math.sin(t * 3));
    return;
  }
  ctx.translate(cx, cy); ctx.rotate(-0.18);
  const w = it * 0.66, h = it * 0.4, n = 0.07 * it;
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, -h / 2); ctx.lineTo(w / 2, -n); ctx.arc(w / 2, 0, n, -Math.PI / 2, Math.PI / 2, true);
  ctx.lineTo(w / 2, h / 2); ctx.lineTo(-w / 2, h / 2); ctx.lineTo(-w / 2, n); ctx.arc(-w / 2, 0, n, Math.PI / 2, -Math.PI / 2, true); ctx.closePath();
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  if (id === 'ally') { g.addColorStop(0, '#ff8a6a'); g.addColorStop(1, '#d8452f'); } else { g.addColorStop(0, '#8ad0ff'); g.addColorStop(1, '#3a80ea'); }
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = it * 0.03; ctx.strokeStyle = 'rgba(40,20,10,0.7)'; ctx.stroke();
  ctx.setLineDash([it * 0.03, it * 0.03]); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = it * 0.015;
  ctx.beginPath(); ctx.moveTo(-w * 0.18, -h / 2 + it * 0.03); ctx.lineTo(-w * 0.18, h / 2 - it * 0.03); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#fff';
  if (id === 'ally') { // a rooster comb
    ctx.beginPath(); ctx.arc(w * 0.06, it * 0.04, it * 0.05, Math.PI, 0); ctx.arc(w * 0.18, it * 0.02, it * 0.06, Math.PI, 0); ctx.arc(w * 0.3, it * 0.04, it * 0.05, Math.PI, 0); ctx.lineTo(w * 0.35, it * 0.08); ctx.lineTo(w * 0.01, it * 0.08); ctx.closePath(); ctx.fill();
  } else { // skip arrows
    for (const o of [0, 0.13]) { ctx.beginPath(); ctx.moveTo(w * (0.04 + o), -it * 0.08); ctx.lineTo(w * (0.17 + o), 0); ctx.lineTo(w * (0.04 + o), it * 0.08); ctx.closePath(); ctx.fill(); }
  }
  ctx.restore();
}

function drawIapArt(ctx, sku, cx, cy, it, t, wallet) {
  const P = IAP[sku];
  if (COIN_PACKS.includes(sku)) return coinPile(ctx, cx, cy, it, COIN_PACKS.indexOf(sku) + 2, t);
  if (sku === 'egg_bank') return drawGlassEgg(ctx, cx, cy, it * 0.8, ((wallet && wallet.bank) || 0) / BANK_CAP, t);
  if (sku === PREMIUM) { drawHenSkinPreview(ctx, 'golden', cx, cy + it * 0.04, it * 0.84, t); sparkle(ctx, cx + it * 0.3, cy - it * 0.3, it * 0.08, 0.6 + 0.4 * Math.sin(t * 3)); return; }
  if (sku === 'starter_nest') { drawHenSkinPreview(ctx, P.hen, cx - it * 0.08, cy + it * 0.02, it * 0.74, t); coinPile(ctx, cx + it * 0.26, cy + it * 0.24, it * 0.6, 3, t); return; }
  if (sku === 'season_pack') { drawHenSkinPreview(ctx, (wallet && wallet.season) || 'skier', cx - it * 0.1, cy + it * 0.02, it * 0.74, t); drawSkinPreview(ctx, P.egg, cx + it * 0.28, cy + it * 0.2, it * 0.36, t); return; }
  if (sku === 'no_ads') {
    ctx.save(); ctx.translate(cx, cy);
    const w = it * 0.56, h = it * 0.4;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-w / 2, -h / 2, w, h, it * 0.06) : ctx.rect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = it * 0.03; ctx.strokeStyle = '#6b3f17'; ctx.stroke();
    ctx.fillStyle = '#6b3f17'; ctx.font = `700 ${Math.round(it * 0.22)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('AD', 0, it * 0.01);
    ctx.strokeStyle = '#e8402e'; ctx.lineWidth = it * 0.07; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, it * 0.36, 0, Math.PI * 2); ctx.moveTo(-it * 0.25, -it * 0.25); ctx.lineTo(it * 0.25, it * 0.25); ctx.stroke();
    ctx.restore();
    return;
  }
  // bundles and the chick pack: power chick tokens over a pile of coins
  const ids = sku === 'all_chicks' ? [['thunder', -0.22, 0.14], ['bomb', 0.22, 0.14], ['freeze', 0, -0.14]]
    : sku === 'bundle_flock' ? [['glue', -0.25, -0.12], ['tornado', 0.25, -0.12], ['freeze', 0, -0.2]] : [['freeze', -0.18, -0.12], ['thunder', 0.18, -0.12]];
  if (sku !== 'all_chicks') coinPile(ctx, cx, cy + it * 0.16, it * 0.8, sku === 'bundle_flock' ? 5 : 3, t);
  for (const [id, dx, dy] of ids) drawStrikeToken(ctx, id, cx + dx * it, cy + dy * it, it * (sku === 'all_chicks' ? 0.24 : 0.19), t, true);
  if (sku === 'bundle_helper') drawItemArt(ctx, 'ally', cx + it * 0.26, cy + it * 0.28, it * 0.42, t);
}

// ---- icon tiles (2026-11-16, owner: "every item as a curvy, colourful icon tile with the price at the bottom; tap shows
// the description"). Power-ups, Hens and Eggs are grids of rounded tiles; a tap opens the detail sheet (the game draws
// it from storeItem(key)). Each tile: its own colour, the art big, the name, and a chip at the bottom: the price (coins
// or money), or Owned / Equipped / Yours.
const TILE_HUES = ['#7fc3ff', '#ff9f8a', '#9be37a', '#ffd36a', '#c7a0ff', '#7fe0c4', '#ffb3d9', '#f5b38a'];
const BOOST_HUE = { stone: '#aab4be', golden: '#ffd24a', time: '#ff9f5a', rewind: '#7fb3ff', sponge: '#f2e06a', nest: '#e0b878', snips: '#9fdc8a' };
const ITEM_HUE = { ally: '#ff8a72', goldhour: '#ffc74a', skip: '#8ac4ff' };

function drawTile(ui, ctx, item, x, y, w, h, s, t) {
  const lip = 5 * s, fh = h - lip, r = 18 * s, col = item.hue || '#7fc3ff', B = item.btn;
  const fl = item.flash < 0.9 ? 1 - item.flash / 0.9 : 0;
  if (fl > 0.01) { ui.roundRect(x - 4 * s, y - 4 * s, w + 8 * s, h + 8 * s, r + 4 * s); ctx.fillStyle = `rgba(255,226,122,${0.85 * fl})`; ctx.fill(); }
  ui.roundRect(x, y + lip, w, fh, r); ctx.fillStyle = tint(col, -0.42); ctx.fill(); // the lip
  ui.roundRect(x, y, w, fh, r);
  const g = ctx.createLinearGradient(0, y, 0, y + fh); g.addColorStop(0, tint(col, 0.6)); g.addColorStop(1, tint(col, 0.12));
  ctx.fillStyle = g; ctx.fill();
  const on = B.keepFace && B.label === 'Equipped';
  ctx.lineWidth = (on ? 4 : 2.5) * s; ctx.strokeStyle = on ? '#ffc83a' : tint(col, -0.5); ctx.stroke();
  // a soft light behind the art
  const chipH = 26 * s, nameS = 13 * s, ah = fh - chipH - nameS * 1.3 - 16 * s, acx = x + w / 2, acy = y + 6 * s + ah / 2;
  const lg = ctx.createRadialGradient(acx, acy, 0, acx, acy, Math.min(w, ah) * 0.55); lg.addColorStop(0, 'rgba(255,255,255,0.75)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lg; ctx.fillRect(x, y, w, ah + 12 * s);
  const bounce = item.flash < 0.6 ? 1 + 0.2 * Math.sin((item.flash / 0.6) * Math.PI) : 1;
  item.icon(ctx, acx, acy, Math.min(w * 0.86, ah * 1.06), t, bounce);
  ui.record({ x: acx - Math.min(w * 0.86, ah) / 2, y: acy - ah / 2, w: Math.min(w * 0.86, ah), h: ah }, 'store:tart:' + item.key);
  ui.text(item.short || item.name, x + w / 2, y + 6 * s + ah + 4 * s + nameS * 0.6, { size: nameS, align: 'center', maxW: w - 12 * s, color: tint(col, -0.72), tag: 'store:tname:' + item.key });
  if (item.badge) pill(ui, ctx, item.badge, x + 7 * s, y + 7 * s, 11.5 * s, '#5b3413', 'store:badge:' + item.key, s, 'store:tart:' + item.key); // e.g. the level a chick comes free
  if (item.premium) { ui.roundRect(x + 3 * s, y + 3 * s, w - 6 * s, fh - 6 * s, r - 3 * s); ctx.lineWidth = 2.5 * s; ctx.strokeStyle = '#ffc928'; ctx.stroke(); } // a premium chick: a gold inner rim (its token wears the crown)
  // the chip
  const cx0 = x + 8 * s, cy0 = y + fh - 8 * s - chipH, cwid = w - 16 * s;
  const coinChip = !!B.coin, ok = B.kind === 'primary' || B.kind === 'gold' || B.kind === 'secondary';
  const fill = B.keepFace ? '#fffaf0' : B.disabled ? '#b8ad9e' : coinChip ? (ok ? '#3eb42d' : '#a09383') : B.kind === 'gold' ? '#f6a21b' : B.kind === 'secondary' ? '#3a80ea' : B.kind === 'off' ? '#a09383' : '#3eb42d';
  ui.roundRect(cx0, cy0, cwid, chipH, chipH / 2); ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 1.5 * s; ctx.strokeStyle = B.keepFace ? 'rgba(47,143,42,0.6)' : 'rgba(30,15,5,0.45)'; ctx.stroke();
  const ls = 14.5 * s, lw = ui.measure(B.label, ls), icoW = coinChip || B.keepFace ? ls * 1.15 : 0, tx = x + w / 2 - (lw + icoW) / 2;
  if (coinChip) drawCoin(ctx, tx + ls * 0.5, cy0 + chipH / 2, ls * 0.5, t);
  else if (B.keepFace) { ctx.strokeStyle = C.good; ctx.lineWidth = 2.5 * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(tx + ls * 0.1, cy0 + chipH / 2); ctx.lineTo(tx + ls * 0.38, cy0 + chipH / 2 + ls * 0.28); ctx.lineTo(tx + ls * 0.85, cy0 + chipH / 2 - ls * 0.3); ctx.stroke(); }
  ui.text(B.label, tx + icoW + lw / 2, cy0 + chipH / 2 + 0.5 * s, { size: ls, align: 'center', maxW: cwid - icoW - 8 * s, color: B.keepFace ? C.good : '#fff', stroke: B.keepFace ? null : 'rgba(30,15,5,0.55)', strokeW: 3 * s, tag: 'store:chip:' + item.key });
  if (item.count > 0) { // how many the player holds
    const br = 11 * s, bx = x + w - br - 5 * s, by = y + br + 5 * s;
    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fillStyle = '#e8402e'; ctx.fill(); ctx.lineWidth = 1.5 * s; ctx.strokeStyle = '#5a110a'; ctx.stroke();
    ui.text(String(item.count), bx, by + 0.5 * s, { size: 13 * s, align: 'center', maxW: br * 1.7, color: '#fff', tag: 'store:count:' + item.key, group: 'store:tart:' + item.key });
  }
  ui.buttons.push({ id: 'tile:' + item.key, x, y, w, h });
}

// one item by its key (the detail sheet asks for it): 'stone', 'item:ally', 'charge:chick3', 'chick:thunder', 'hen:elf',
// 'skin:dino', 'iap:all_chicks'. st: { wallet, t, flash, price(sku), reach }
export function storeItem(key, st0) {
  const st = { price: usdHint, reach: 1, t: 0, ...st0 };
  const [kind, id] = key.includes(':') ? [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)] : ['boost', key];
  if (kind === 'boost' && BOOSTERS[key]) return boosterItem(key, st);
  if (kind === 'item' && ITEMS[id]) return coinItemCard(id, st);
  if (kind === 'charge') { const P = CHARGE_PACKS.find((q) => q.id === id); return P ? chargeItem(P, st) : null; }
  if (kind === 'chick') { const S = STRIKES.find((q) => q.id === id); return S ? chickItem(S, st) : null; }
  if (kind === 'hen' && HEN_SKINS[id]) return henItem(id, st);
  if (kind === 'skin' && SKINS[id]) return skinItem(id, st);
  if (kind === 'iap' && IAP[id]) return iapItem(id, st);
  return null;
}
// the tile's colour and count badge for an item
function tileLook(item, i) {
  const k = item.key, id = k.slice(k.indexOf(':') + 1);
  if (BOOST_HUE[k]) item.hue = BOOST_HUE[k];
  else if (k.startsWith('item:')) item.hue = ITEM_HUE[id];
  else if (k.startsWith('charge:')) item.hue = '#8fd8ff';
  else if (k.startsWith('chick:')) { const S = STRIKES.find((q) => q.id === id); item.hue = S && S.col ? S.col[0] : '#ffd36a'; }
  else if (k.startsWith('iap:')) item.hue = '#d7b0ff';
  else if (k.startsWith('go:')) item.hue = ['#ffd36a', '#ff9f8a', '#9be37a'][i % 3];
  else item.hue = TILE_HUES[i % TILE_HUES.length];
  return item;
}

// The shop's tabs: Deals | Power-ups | Hens | Eggs.
export const STORE_TABS = [['deals', 'Deals'], ['boosters', 'Power-ups'], ['hens', 'Hens'], ['skins', 'Eggs']];
// on the web (no real money) the first tab is the free coins: the rewarded-ad claim, the daily chest, coins from play
const WEB_TABS = [['deals', 'Free coins'], ['boosters', 'Power-ups'], ['hens', 'Hens'], ['skins', 'Eggs']];

// state: { area, wallet, t, adReady, adCooldownLeft, flash, tab, scroll (also .want: 'coins' | 'bank' jumps there once),
//   dragging, price(sku), featured: { sku } | null, reach (furthest level, for the power chicks), money (real-money
//   products shown: the app; false on web portals), dailyOpen (the daily chest was opened today) }
export function drawStore(ui, ctx, W, H, state) {
  const { wallet, t = 0, adReady = false, adCooldownLeft = 0, flash = null } = state;
  const money = state.money !== false, TABS = money ? STORE_TABS : WEB_TABS;
  const tab = TABS.some(([id]) => id === state.tab) ? state.tab : 'deals';
  const st = { wallet, t, flash, price: state.price || usdHint, reach: state.reach || 1, money };
  // the room paints edge to edge (W x H); everything in it lays out in the safe rect (state.area, else the whole screen)
  const AR = state.area || { x: 0, y: 0, w: W, h: H }, OX = AR.x, OY = AR.y, AW = AR.w, AH = AR.h;
  const { cols, s } = planLayout(AW, AH, ui.u);
  const pad = D.pad * s;

  // the shop's own room: deep violet, a soft light from above, slow rays (still when reduced motion is on)
  if (!themeBack(ctx, ui.skin, W, H, H * 0.8)) { // a skin pack paints its own room (ui/theme.js)
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#4a3190');
  bg.addColorStop(0.55, '#2f1f66');
  bg.addColorStop(1, '#1c1240');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, -H * 0.05);
  ctx.rotate(ui.calm ? 0 : Math.sin(t * 0.15) * 0.06);
  ctx.fillStyle = 'rgba(255,255,255,0.045)';
  const RR = Math.hypot(W, H) * 1.1;
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.08 + (i / 8) * 0.84), d = 0.045;
    ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - d) * RR, Math.sin(a - d) * RR); ctx.lineTo(Math.cos(a + d) * RR, Math.sin(a + d) * RR); ctx.closePath();
  }
  ctx.fill();
  ctx.restore();
  }

  // ---- header: back (to where the shop was opened from), home, title ribbon, balance with a "+" to the coin packs
  const bs = 46 * s, hg = 8 * s;
  ui.button('back', '', OX + pad, OY + pad, bs, bs, { kind: 'hud', icon: ICON.left, iconS: 1.3, round: 15 * s });
  ui.button('home', '', OX + pad + bs + hg, OY + pad, bs, bs, { kind: 'hud', icon: ICON.home, iconS: 1.25, round: 15 * s });
  const headCy = OY + pad + bs / 2 - 2 * s;

  const coinFl = flash && (flash.id === 'coins' || flash.id === 'ad') && flash.t < 0.9 ? 1 - flash.t / 0.9 : 0;
  // the balance rolls to its new value (a purchase counts down, an ad reward counts up)
  if (BAL.v == null || ui.calm || Math.abs(wallet.coins - BAL.v) > 5000) BAL.v = wallet.coins;
  else if (BAL.v !== wallet.coins) { const d = wallet.coins - BAL.v; BAL.v += Math.abs(d) < 1.5 ? d : d * 0.16; }
  const balStr = String(Math.round(BAL.v));
  const balSize = 22 * s;
  const cr = 13 * s;
  const tw = ui.measure(String(wallet.coins).replace(/\d/g, '0'), balSize);
  const ph = 40 * s, pb = 32 * s;
  const pw = 7 * s + cr * 2 + 6 * s + tw + 8 * s + pb + 4 * s;
  const px = OX + AW - pad - pw, py = headCy - ph / 2;
  ui.buttons.push({ id: 'store:coins', x: px, y: py, w: pw, h: ph }); // the whole pill jumps to the coin packs
  ui.glass(px, py, pw, ph, { border: coinFl ? `rgba(255,226,120,${0.5 + 0.5 * coinFl})` : 'rgba(255,224,170,0.5)', a: 'rgba(40,24,80,0.9)', b: 'rgba(20,10,46,0.9)' });
  drawCoin(ctx, px + 7 * s + cr, py + ph / 2, cr * (1 + 0.15 * coinFl), t);
  ui.record({ x: px + 7 * s, y: py + ph / 2 - cr, w: cr * 2, h: cr * 2 }, 'store:coinicon', 'store:balance');
  ui.num(balStr, px + 7 * s + cr * 2 + 6 * s, py + ph / 2, { size: balSize, tag: 'store:balance', group: 'store:balance' });
  ui.button('store:coins', '', px + pw - 4 * s - pb, py + (ph - pb) / 2, pb, pb, { kind: 'primary', icon: ICON.plus, iconS: 1.05, round: 11 * s });
  const rl = OX + pad + 2 * bs + hg + 16 * s, rr = px - 16 * s;
  if (rr - rl >= 64 * s) ui.ribbon('Shop', (rl + rr) / 2, headCy - 19 * s, Math.min(150 * s, rr - rl), 38 * s, { s, color: '#f0a01c', size: 24 * s, tag: 'store:title' });

  // ---- tabs
  const tg = 6 * s, tabW = Math.min(130 * s, (AW - 2 * pad - tg * (TABS.length - 1)) / TABS.length), tabH = (D.tabH + 2) * s;
  const tabX = OX + AW / 2 - (tabW * TABS.length + tg * (TABS.length - 1)) / 2, tabY = OY + D.tabY * s;
  // one label size for every tab, the largest at which the longest label fits
  const tabS = Math.min(17 * s, ...TABS.map(([, l]) => (tabW - 18 * s) * 17 * s / ui.measure(l, 17 * s)));
  for (const [i, [id, label]] of TABS.entries()) {
    const on = tab === id;
    ui.button('tab:' + id, label, tabX + i * (tabW + tg), tabY, tabW, tabH, { kind: on ? 'gold' : 'hud', size: tabS });
  }

  // ---- body: one scrolling column of rows (section headings, card rows, the coin-pack grid)
  const gap = D.gap * s;
  const bodyTop = OY + D.top * s;
  const avail = OY + AH - bodyTop - pad;
  const cw = cols === 1 ? Math.min(AW - 2 * pad, 520 * s) : Math.min(AW - 2 * pad, 2 * 440 * s + gap);
  const rows = [];
  const add = (h, draw, key, before = gap) => rows.push({ h, draw, key, before });
  const head = (title, key) => { add(D.headH * s, (x, y, w) => {
    const sz = 12.5 * s, tw2 = ui.measure(title.toUpperCase(), sz), cx = x + w / 2, cy = y + D.headH * s / 2;
    ctx.fillStyle = 'rgba(255,236,200,0.28)';
    ctx.fillRect(x + 6 * s, cy - 0.75 * s, w / 2 - tw2 / 2 - 16 * s, 1.5 * s); ctx.fillRect(cx + tw2 / 2 + 10 * s, cy - 0.75 * s, w / 2 - tw2 / 2 - 16 * s, 1.5 * s);
    ui.text(title.toUpperCase(), cx, cy, { size: sz, align: 'center', color: 'rgba(255,240,214,0.9)', tag: 'store:sec:' + title });
  }, key, rows.length ? 16 * s : 0); rows[rows.length - 1].head = true; };
  // cards, `cols` to a row; an odd last card stretches over the whole row (no hole in the grid)
  const cards = (items, key, ch = D.cardH * s) => {
    for (let i = 0; i < items.length; i += cols) {
      const R = items.slice(i, i + cols), rh = R.some((it) => it.tall) ? ch * 1.2 : ch; // a long line (Premium) gets a taller row
      add(rh, (x, y, w) => { const k = R.length, cwi = (w - (k - 1) * gap) / k; R.forEach((it, j) => drawCard(ui, ctx, it, x + j * (cwi + gap), y, cwi, rh, s, t, k === 1)); }, i ? null : key, rows.length && rows[rows.length - 1].head ? 6 * s : gap);
    }
  };

  // icon tiles: 3 to a row upright, 5-6 on a wide screen; a short last row is centred
  const tn = cols === 1 ? 3 : Math.max(4, Math.min(6, Math.floor((cw + gap) / (138 * s + gap))));
  const tiles = (items, key) => {
    const tw = (cw - (tn - 1) * gap) / tn, th = Math.round(tw * (cols === 1 ? 1.22 : 1.12));
    items.forEach(tileLook);
    for (let i = 0; i < items.length; i += tn) {
      const R = items.slice(i, i + tn);
      add(th, (x, y, w) => { const x1 = x + (w - (R.length * tw + (R.length - 1) * gap)) / 2; R.forEach((it, j) => drawTile(ui, ctx, it, x1 + j * (tw + gap), y, tw, th, s, t)); }, i ? null : key, rows.length && rows[rows.length - 1].head ? 6 * s : gap);
    }
  };

  const cooling = adCooldownLeft > 0;
  const adOff = cooling || !adReady;
  if (tab === 'deals' && !money) { // web: coins come from play, the daily chest and rewarded ads (the portal's own)
    const fh = (cols === 1 ? 150 : D.featH) * s, ad = { key: 'ad', name: 'Free coins', line: `Watch a short video for ${AD_REWARDS.freeCoins.coins} coins. A new one every few minutes.`, big: true, tag: 'Free',
      flash: flash && flash.id === 'ad' ? flash.t : 99, icon: (c, cx, cy, it, tt, b) => coinPile(c, cx, cy, it * b, 3, tt),
      btn: { id: 'ad:coins', label: cooling ? fmtTime(adCooldownLeft) : adOff ? 'Soon' : 'Watch', kind: 'ad', ad: !adOff, disabled: adOff, size: 19 } };
    add(fh, (x, y, w) => drawCard(ui, ctx, ad, x, y, w, fh, s, t, true), 'coins', 0);
    head('More coins');
    cards([
      { key: 'daily', name: 'Daily treasure', line: 'A free chest every day: coins and Chick Charges.', owned: !!state.dailyOpen, flash: 99,
        icon: (c, cx, cy, it, tt) => drawChest(c, cx, cy + it * 0.06, it * 0.78, tt, state.dailyOpen ? 'open' : 'ready'),
        btn: state.dailyOpen ? { id: 'daily:wait', label: 'Tomorrow', kind: 'off', disabled: true, size: 15 } : { id: 'home:chest', label: 'Open', kind: 'primary', size: 19 }, sub: null },
      { key: 'earn', name: 'Coins from play', line: 'Every win pays coins. Three stars and the Daily Vault pay more.', owned: false, flash: 99,
        icon: (c, cx, cy, it, tt) => { coinPile(c, cx + it * 0.12, cy + it * 0.16, it * 0.7, 2, tt); drawSkinPreview(c, 'classic', cx - it * 0.14, cy - it * 0.06, it * 0.5, tt); },
        btn: { id: 'play', label: 'Play', kind: 'primary', size: 19 }, sub: null },
    ]);
    head('Spend your coins');
    const go = (tabId, name, chip, icon) => ({ key: 'go:' + tabId, name, line: '', flash: 99, icon, btn: { label: chip, kind: 'secondary' } });
    tiles([
      go('boosters', 'Power-ups', 'Boosts', (c, cx, cy, it, tt) => { drawBoosterIcon(c, 'golden', cx - it * 0.16, cy, it * 0.5, tt); drawStrikeToken(c, 'thunder', cx + it * 0.18, cy + it * 0.08, it * 0.2, tt, true); }),
      go('hens', 'Hens', 'Outfits', (c, cx, cy, it, tt) => drawHenSkinPreview(c, 'santa', cx, cy + it * 0.04, it * 0.84, tt)),
      go('skins', 'Eggs', 'Skins', (c, cx, cy, it, tt) => { drawSkinPreview(c, 'galaxy', cx - it * 0.16, cy, it * 0.56, tt); drawSkinPreview(c, 'dino', cx + it * 0.18, cy + it * 0.06, it * 0.5, tt); }),
    ]);
  } else if (tab === 'deals') {
    const f = state.featured && IAP[state.featured.sku] && iapAvailable(wallet, state.featured.sku) ? state.featured : null;
    const fh = (cols === 1 ? 168 : D.featH) * s;
    if (f) add(fh, (x, y, w) => drawCard(ui, ctx, iapItem(f.sku, st, { pre: 'feat:', big: true, tag: f.tag || 'Special offer', name: f.title, line: f.line }), x, y, w, fh, s, t, true), 'featured', 0);
    head('Coins', 'coins');
    // coin packs: 2 to a row in portrait, 3 in landscape; the sixth cell is the free-coins ad
    const pc = cols === 1 ? 2 : 3, cells = [...COIN_PACKS, 'ad'], phh = D.packH * s;
    for (let i = 0; i < cells.length; i += pc) {
      const R = cells.slice(i, i + pc);
      add(phh, (x, y, w) => {
        const cwi = (w - (pc - 1) * gap) / pc;
        R.forEach((sku, j) => {
          const cx0 = x + j * (cwi + gap);
          if (sku === 'ad') drawAdCell(ui, ctx, cx0, y, cwi, phh, s, t, { cooling, adCooldownLeft, adOff, flash });
          else drawPack(ui, ctx, sku, cx0, y, cwi, phh, s, t, st);
        });
      }, null, i ? gap : 6 * s);
    }
    const bundles = ['bundle_helper', 'bundle_flock', 'season_pack'];
    if (!f || f.sku !== 'starter_nest') { if (iapAvailable(wallet, 'starter_nest')) bundles.unshift('starter_nest'); }
    head('Bundles');
    cards(bundles.map((sku) => iapItem(sku, st)));
    head('Golden Egg Bank', 'bank');
    cards([bankItem(st)]);
    head('No ads & Premium');
    cards([iapItem('no_ads', st), iapItem(PREMIUM, st)]);
  } else if (tab === 'boosters') {
    head('Boosts');
    tiles(BOOSTER_ORDER.map((id) => boosterItem(id, st)));
    head('Helpers');
    tiles(ITEM_ORDER.map((id) => coinItemCard(id, st)));
    head('Chick Charges');
    tiles(CHARGE_PACKS.map((P) => chargeItem(P, st)));
    head('Power chicks', 'chicks');
    tiles([...STRIKES.filter((S) => !S.premium).map((S) => chickItem(S, st)), ...(money ? [iapItem('all_chicks', st)] : [])]);
    head('Premium chicks', 'premium'); // coins only: never in a level unlock or a chick pack
    tiles(STRIKES.filter((S) => S.premium).map((S) => chickItem(S, st)));
  } else if (tab === 'hens') tiles(HEN_SKIN_ORDER.filter((id) => money || !HEN_SKINS[id].premium).map((id) => henItem(id, st)));
  else tiles(SKIN_ORDER.map((id) => skinItem(id, st)));

  // a long list scrolls between the tabs and the bottom; cards cut by the edge keep a tap area only inside the list and
  // record nothing for the overlap check
  const SC = state.scroll || { y: 0, v: 0, max: 0 }, vt = bodyTop - 4 * s, vb = OY + AH;
  const dt = Math.min(0.05, Math.max(0, t - (SC.t || t))); SC.t = t;
  if (!state.dragging) { if (Math.abs(SC.v) > 8) { SC.y += SC.v * dt; SC.v *= Math.exp(-4.2 * dt); } else SC.v = 0; }
  let total = 0;
  const at = {};
  rows.forEach((R, i) => { total += i ? R.before : 0; R.off = total; if (R.key) at[R.key] = total; total += R.h; });
  SC.max = Math.max(0, total - avail);
  if (SC.want) { if (at[SC.want] != null) { SC.y = at[SC.want] - (rows[0] && at[SC.want] ? 4 * s : 0); SC.v = 0; } SC.want = null; }
  SC.y = Math.max(0, Math.min(SC.max, SC.y));
  const y0 = SC.max > 0 ? bodyTop - SC.y : bodyTop + Math.max(0, (avail - total) / 2);
  const clipped = (y, h, draw) => {
    if (y + h < vt || y > vb) return;
    const n0 = ui.rects.length, nb = ui.buttons.length;
    draw();
    if (y < vt || y + h > vb) {
      ui.rects.length = n0;
      for (let k = ui.buttons.length - 1; k >= nb; k--) { const b = ui.buttons[k], t2 = Math.max(b.y, vt), b2 = Math.min(b.y + b.h, vb); if (b2 - t2 < 8 * s) ui.buttons.splice(k, 1); else { b.y = t2; b.h = b2 - t2; } }
    }
  };
  const x0 = OX + AW / 2 - cw / 2;
  ctx.save(); ctx.beginPath(); ctx.rect(0, vt, W, vb - vt); ctx.clip();
  for (const R of rows) { const y = y0 + R.off; clipped(y, R.h, () => R.draw(x0, y, cw)); }
  ctx.restore();
  if (SC.max > 0 && !ui.calm) { // a thin scroll thumb
    const th = Math.max(30 * s, (vb - vt) * (vb - vt) / (SC.max + vb - vt)), ty = vt + (SC.y / SC.max) * (vb - vt - th - 4 * s);
    ui.roundRect(OX + AW - 5 * s, ty, 3 * s, th, 1.5 * s); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fill();
  }
}

// one coin pack in the Deals grid: the pile, the amount, the price; a "Most popular" / "Best value" pill
function drawPack(ui, ctx, sku, x, y, w, h, s, t, st) {
  const P = IAP[sku], lip = 4 * s, fh = h - lip, p = 9 * s, fl = flashOf(st, 'iap:' + sku), fa = fl < 0.9 ? 1 - fl / 0.9 : 0;
  ui.frame(x, y, w, fh, { s, r: 16 * s, fw: 4.5 * s, lip, glow: '#ffe27a', glowA: fa, record: true, tag: 'panel:card:' + sku });
  const bh = 42 * s, amH = 26 * s, artH = fh - 2 * p - bh - amH - 4 * s;
  ui.well(x + p, y + p, w - 2 * p, artH, { s, r: 12 * s, a: '#cfe9fb', b: '#eaf6ff', shade: 'rgba(20,70,130,0.28)', border: 'rgba(60,90,130,0.55)' });
  ui.record({ x: x + p, y: y + p, w: w - 2 * p, h: artH }, 'store:icon:' + sku);
  const bounce = fl < 0.6 ? 1 + 0.18 * Math.sin((fl / 0.6) * Math.PI) : 1;
  coinPile(ctx, x + w / 2, y + p + artH * 0.56, Math.min(artH * 1.05, w * 0.7) * bounce, COIN_PACKS.indexOf(sku) + 2, t);
  if (P.tag) pill(ui, ctx, P.tag, x + p + 5 * s, y + p + 5 * s, 11.5 * s, P.tag === 'Best value' ? '#2f8f2a' : '#e8402e', 'store:tag:' + sku, s, 'store:icon:' + sku);
  ui.num(fmtNum(P.coins), x + w / 2, y + p + artH + 4 * s + amH / 2, { size: 21 * s, align: 'center', maxW: w - 2 * p, tag: 'store:amt:' + sku });
  ui.button('iap:' + sku, st.price(sku), x + p, y + fh - p - bh, w - 2 * p, bh, { kind: 'primary', size: 17 * s });
}

// the free-coins rewarded ad as the last cell of the coin grid (an offer, never a gate: violet like every ad button)
function drawAdCell(ui, ctx, x, y, w, h, s, t, o) {
  const lip = 4 * s, fh = h - lip, p = 9 * s, fa = o.flash && o.flash.id === 'ad' && o.flash.t < 0.9 ? 1 - o.flash.t / 0.9 : 0;
  ui.frame(x, y, w, fh, { s, r: 16 * s, fw: 4.5 * s, lip, glow: '#ffe27a', glowA: fa, record: true, tag: 'panel:card:ad' });
  const bh = 42 * s, amH = 26 * s, artH = fh - 2 * p - bh - amH - 4 * s;
  ui.well(x + p, y + p, w - 2 * p, artH, { s, r: 12 * s, a: '#e4d4ff', b: '#f4eeff', shade: 'rgba(60,20,130,0.25)', border: 'rgba(90,60,150,0.55)' });
  ui.record({ x: x + p, y: y + p, w: w - 2 * p, h: artH }, 'store:icon:ad');
  coinPile(ctx, x + w / 2, y + p + artH * 0.56, Math.min(artH * 1.05, w * 0.7), 1, t);
  ui.num('+' + AD_REWARDS.freeCoins.coins, x + w / 2, y + p + artH + 4 * s + amH / 2, { size: 21 * s, align: 'center', maxW: w - 2 * p, tag: 'store:amt:ad' });
  const label = o.cooling ? fmtTime(o.adCooldownLeft) : o.adOff ? 'Soon' : 'Free';
  ui.button('ad:coins', label, x + p, y + fh - p - bh, w - 2 * p, bh, { kind: 'ad', shimmer: !o.adOff, ad: !o.adOff, disabled: o.adOff, size: 17 * s });
}

// ---------------------------------------------------------------- egg skins and chests

// An egg of the given skin, centered at (cx, cy), egg height h (y-down local space).
export function drawSkinPreview(ctx, id, cx, cy, h, t = 0) {
  if (drawEggSkinArt(ctx, id, cx, cy, h, t)) return; // 2026-11-16: the newer egg skins (render/eggskins.js)
  const w = h * 0.78;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  eggPath(ctx, w, h);
  let fill = '#fff3d6', edge = '#6b4a20';
  if (id === 'dino') {
    const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    g.addColorStop(0, '#a6e36f');
    g.addColorStop(1, '#4fae3d');
    fill = g;
    edge = '#25601f';
  } else if (id === 'golden') {
    const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    g.addColorStop(0, '#fff3a6');
    g.addColorStop(0.5, '#ffc628');
    g.addColorStop(1, '#c97d06');
    fill = g;
    edge = '#8a5200';
  } else if (id === 'striped') {
    fill = '#fff3d6';
  }
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.save();
  ctx.clip();
  if (id === 'speckled') {
    ctx.fillStyle = '#8a5a2b';
    const sp = [[-0.2, -0.28, 0.035], [0.12, -0.34, 0.025], [0.02, -0.12, 0.04], [-0.26, 0.02, 0.028], [0.24, -0.04, 0.035], [-0.08, 0.16, 0.03], [0.16, 0.2, 0.04], [-0.22, 0.28, 0.025], [0.02, 0.36, 0.03], [0.3, 0.3, 0.02]];
    for (const [x, y, r] of sp) {
      ctx.beginPath();
      ctx.ellipse(x * w * 1.3, y * h, r * w * 1.2, r * w, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (id === 'striped') {
    const cols = ['#e5483a', '#3f7be0'];
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = cols[i % 2];
      ctx.beginPath();
      const y0 = -h * 0.28 + i * h * 0.2;
      ctx.moveTo(-w, y0);
      for (let k = 0; k <= 8; k++) ctx.lineTo(-w / 2 + (k / 8) * w, y0 + (k % 2 ? 1 : -1) * h * 0.03);
      ctx.lineTo(w, y0);
      ctx.lineTo(w, y0 + h * 0.1);
      for (let k = 8; k >= 0; k--) ctx.lineTo(-w / 2 + (k / 8) * w, y0 + h * 0.1 + (k % 2 ? 1 : -1) * h * 0.03);
      ctx.lineTo(-w, y0 + h * 0.1);
      ctx.closePath();
      ctx.fill();
    }
  } else if (id === 'dino') {
    ctx.fillStyle = '#2f7d2a';
    for (const [x, y, r] of [[-0.16, -0.25, 0.1], [0.18, -0.06, 0.13], [-0.14, 0.14, 0.09], [0.1, 0.3, 0.08], [-0.02, -0.02, 0.05]]) {
      ctx.beginPath();
      ctx.ellipse(x * w * 1.4, y * h, r * w, r * w * 0.8, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,220,0.55)';
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, h * 0.36);
    for (let k = 0; k <= 6; k++) ctx.lineTo(-w * 0.5 + (k / 6) * w, h * (k % 2 ? 0.36 : 0.3));
    ctx.lineTo(w * 0.5, h * 0.6);
    ctx.lineTo(-w * 0.5, h * 0.6);
    ctx.fill();
  } else if (id === 'golden') {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    const sw = (((t * 0.35) % 1) * 2 - 0.5) * w * 1.6 - w * 0.3;
    ctx.rotate(0.5);
    ctx.fillRect(sw, -h, w * 0.18, h * 2);
  }
  ctx.restore();
  eggPath(ctx, w, h);
  ctx.lineWidth = Math.max(1.2, h * 0.045);
  ctx.strokeStyle = edge;
  ctx.stroke();
  // gloss
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = Math.max(1.2, h * 0.04);
  ctx.beginPath();
  ctx.arc(0, h * 0.04, w * 0.36, Math.PI * 1.1, Math.PI * 1.4);
  ctx.stroke();
  ctx.restore();
}

// Star chest. s is the chest width; state 'locked' | 'ready' | 'open'.
export function drawChest(ctx, cx, cy, s, t = 0, state = 'locked') {
  ctx.save();
  ctx.translate(cx, cy);
  const ready = state === 'ready';
  const open = state === 'open';
  if (ready) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    const g = ctx.createRadialGradient(0, 0, s * 0.1, 0, 0, s * (0.75 + 0.1 * pulse));
    g.addColorStop(0, 'rgba(255,230,120,0.65)');
    g.addColorStop(1, 'rgba(255,230,120,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-s, -s, s * 2, s * 2);
    ctx.rotate(Math.sin(t * 7) * 0.05 * (Math.sin(t * 1.5) > 0.2 ? 1 : 0.25));
  }
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const wood = locked(state) ? ['#9a6a3c', '#6b4423'] : ['#c4813f', '#7f4c1f'];
  const band = ready || open ? ['#ffe27a', '#c98a10'] : ['#aab2ba', '#6a727a'];
  const edge = '#3d2410';
  const lid = () => {
    ctx.beginPath();
    ctx.moveTo(-0.5, 0);
    ctx.quadraticCurveTo(-0.5, -0.42, 0, -0.42);
    ctx.quadraticCurveTo(0.5, -0.42, 0.5, 0);
    ctx.closePath();
  };
  const grad = (y0, y1, c) => {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, c[0]);
    g.addColorStop(1, c[1]);
    return g;
  };
  if (open) {
    // lid tipped back behind the body
    ctx.save();
    ctx.translate(0, -0.2);
    ctx.scale(0.94, 0.8);
    lid();
    ctx.fillStyle = '#4a2c14';
    ctx.fill();
    ctx.lineWidth = 0.04;
    ctx.strokeStyle = edge;
    ctx.stroke();
    ctx.restore();
    // light rays
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 5);
    ctx.fillStyle = '#fff1a0';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 0.06, -0.02);
      ctx.lineTo(i * 0.2 - 0.05, -0.62);
      ctx.lineTo(i * 0.2 + 0.05, -0.62);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  // body
  ctx.beginPath();
  ctx.moveTo(-0.5, 0);
  ctx.lineTo(0.5, 0);
  ctx.lineTo(0.47, 0.4);
  ctx.quadraticCurveTo(0, 0.45, -0.47, 0.4);
  ctx.closePath();
  ctx.fillStyle = open ? '#2b170a' : grad(0, 0.45, wood);
  ctx.fill();
  if (open) {
    // coin heap peeking over the rim
    ctx.save();
    ctx.beginPath();
    ctx.rect(-0.5, -0.3, 1, 0.34);
    ctx.clip();
    ctx.fillStyle = '#ffc83a';
    ctx.beginPath();
    ctx.ellipse(0, 0.02, 0.44, 0.17, 0, Math.PI, 0);
    ctx.fill();
    ctx.restore();
    for (const [x, y, r] of [[-0.25, -0.1, 0.09], [0, -0.17, 0.1], [0.24, -0.09, 0.09], [-0.1, -0.05, 0.08], [0.12, -0.04, 0.08]]) {
      ctx.save();
      ctx.scale(1 / s, 1 / s); // drawCoin works in pixels
      drawCoin(ctx, x * s, y * s, r * s, t + x * 3);
      ctx.restore();
    }
    sparkle(ctx, 0.3 + 0.03 * Math.sin(t * 4), -0.36, 0.1 + 0.03 * Math.sin(t * 6), 1);
    sparkle(ctx, -0.32, -0.28 + 0.02 * Math.sin(t * 5), 0.07, 0.8);
  }
  // plank lines
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 0.014;
  for (const x of [-0.16, 0.16]) {
    ctx.beginPath();
    ctx.moveTo(x, 0.02);
    ctx.lineTo(x * 0.96, 0.42);
    ctx.stroke();
  }
  ctx.lineWidth = 0.04;
  ctx.strokeStyle = edge;
  ctx.beginPath();
  ctx.moveTo(-0.5, 0);
  ctx.lineTo(-0.47, 0.4);
  ctx.quadraticCurveTo(0, 0.45, 0.47, 0.4);
  ctx.lineTo(0.5, 0);
  ctx.stroke();
  // iron bands on the body
  for (const bx of [-0.34, 0.34]) {
    ctx.fillStyle = grad(0, 0.45, band);
    ctx.fillRect(bx - 0.05, 0, 0.1, 0.42);
    ctx.lineWidth = 0.02;
    ctx.strokeStyle = edge;
    ctx.strokeRect(bx - 0.05, 0, 0.1, 0.42);
  }
  if (!open) {
    lid();
    ctx.fillStyle = grad(-0.42, 0, wood);
    ctx.fill();
    ctx.lineWidth = 0.04;
    ctx.strokeStyle = edge;
    ctx.stroke();
    ctx.save();
    lid();
    ctx.clip();
    for (const bx of [-0.34, 0.34]) {
      ctx.fillStyle = grad(-0.42, 0, band);
      ctx.fillRect(bx - 0.05, -0.45, 0.1, 0.46);
      ctx.lineWidth = 0.02;
      ctx.strokeStyle = edge;
      ctx.strokeRect(bx - 0.05, -0.45, 0.1, 0.46);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 0.025;
    ctx.beginPath();
    ctx.moveTo(-0.2, -0.3);
    ctx.quadraticCurveTo(-0.1, -0.37, 0.05, -0.37);
    ctx.stroke();
    // lock
    if (ready) {
      ctx.fillStyle = grad(-0.1, 0.12, band);
      ctx.fillRect(-0.09, -0.08, 0.18, 0.2);
      ctx.lineWidth = 0.025;
      ctx.strokeStyle = edge;
      ctx.strokeRect(-0.09, -0.08, 0.18, 0.2);
      ctx.fillStyle = '#5a3200';
      ctx.beginPath();
      ctx.arc(0, 0.01, 0.028, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-0.012, 0.01, 0.024, 0.06);
      sparkle(ctx, 0.36 + 0.02 * Math.sin(t * 5), -0.3, 0.12, 0.7 + 0.3 * Math.sin(t * 5));
      sparkle(ctx, -0.38, 0.08, 0.08, 0.7 + 0.3 * Math.sin(t * 5 + 2));
    } else {
      // padlock
      ctx.strokeStyle = '#7a828a';
      ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.arc(0, -0.04, 0.06, Math.PI, 0);
      ctx.lineTo(0.06, 0.02);
      ctx.moveTo(-0.06, -0.04);
      ctx.lineTo(-0.06, 0.02);
      ctx.stroke();
      ctx.fillStyle = grad(-0.02, 0.17, ['#c8ced4', '#7a828a']);
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-0.1, -0.01, 0.2, 0.17, 0.03) : ctx.rect(-0.1, -0.01, 0.2, 0.17);
      ctx.fill();
      ctx.lineWidth = 0.02;
      ctx.strokeStyle = edge;
      ctx.stroke();
      ctx.fillStyle = '#3a3f45';
      ctx.beginPath();
      ctx.arc(0, 0.065, 0.025, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-0.01, 0.07, 0.02, 0.05);
    }
  }
  ctx.restore();
}

function locked(state) {
  return state !== 'ready' && state !== 'open';
}

// ---------------------------------------------------------------- level-intro booster picker

// state: { wallet, selected: Set of booster ids, lastTapped: id | null, t }
// Fits inside (x, y, w, h). Ids: 'boost:<id>' per owned booster, or 'shop' when nothing is owned.
export function drawBoosterPicker(ui, ctx, x, y, w, h, state) {
  const { wallet, selected = new Set(), lastTapped = null, t = 0 } = state;
  const owned = BOOSTER_ORDER.filter((id) => ownedCount(wallet, id) > 0);
  const u = ui.u;
  const gapV = Math.max(2, h * 0.06);
  const lineSize = Math.max(9, Math.min(14 * u, h * 0.24));
  const lineH = lineSize * 1.2;
  const rowH = Math.max(10, h - lineH - gapV);
  const rowY = y;
  const lineCy = y + rowH + gapV + lineH / 2;

  if (!owned.length) {
    // a single small Shop chip
    const cs = Math.min(rowH, 46 * u);
    const cw = Math.min(w, Math.max(cs * 2.2, 100 * u));
    ui.button('shop', 'Shop', x + w / 2 - cw / 2, rowY + (rowH - cs) / 2, cw, cs, {
      kind: 'gold', icon: coinIcon(t), size: Math.min(18 * u, cs * 0.42),
    });
    ui.text('Spend coins on start boosters', x + w / 2, lineCy, { size: lineSize, align: 'center', maxW: w, color: C.ink2, tag: 'picker:hint' });
    return;
  }

  const n = owned.length;
  const gap = Math.min(10 * u, w * 0.03);
  const c = Math.max(12, Math.min(rowH, (w - (n - 1) * gap) / n, 64 * u));
  const rowW = n * c + (n - 1) * gap;
  const x0 = x + w / 2 - rowW / 2;
  const cy0 = rowY + (rowH - c) / 2;
  owned.forEach((id, i) => {
    const cx = x0 + i * (c + gap);
    const on = selected.has(id);
    ui.button('boost:' + id, '', cx, cy0, c, c, { kind: on ? 'primary' : 'tertiary' });
    // icon, nudged down-left so the badge has the corner
    const body = c - 5 * u * Math.min(1, c / 40);
    drawBoosterIcon(ctx, id, cx + c * 0.46, cy0 + body * 0.52, c * 0.6, t);
    if (on) {
      ctx.save();
      ctx.lineWidth = Math.max(2, c * 0.05);
      ctx.strokeStyle = '#fff6c0';
      ui.panel(cx - 2, cy0 - 2, c + 4, c + 2, { fill: 'rgba(0,0,0,0)', r: 16 * u, border: '#fff6c0', lw: Math.max(2, c * 0.05) });
      ctx.restore();
    }
    // count badge (top right, inside the chip)
    const br = Math.max(6, c * 0.2);
    const bcx = cx + c - br - c * 0.04, bcy = cy0 + br + c * 0.04;
    ctx.beginPath();
    ctx.arc(bcx, bcy, br, 0, Math.PI * 2);
    ctx.fillStyle = '#e8402e';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#5a110a';
    ctx.stroke();
    ui.text(String(ownedCount(wallet, id)), bcx, bcy, { size: br * 1.25, align: 'center', maxW: br * 1.6, color: '#fff', noRecord: true });
    ui.record({ x: bcx - br, y: bcy - br, w: br * 2, h: br * 2, container: 'btn:boost:' + id }, 'picker:badge:' + id, 'picker:badge:' + id);
    if (on) {
      // check mark, bottom right
      const kx = cx + c - c * 0.2, ky = cy0 + c * 0.7, ks = c * 0.1;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = Math.max(2, c * 0.06);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(kx - ks, ky);
      ctx.lineTo(kx - ks * 0.25, ky + ks * 0.8);
      ctx.lineTo(kx + ks * 1.1, ky - ks * 0.8);
      ctx.stroke();
    }
  });

  const tapped = lastTapped && BOOSTERS[lastTapped] && ownedCount(wallet, lastTapped) > 0 ? BOOSTERS[lastTapped] : null;
  const str = tapped ? tapped.line : 'Tap a booster to use it this level';
  ui.text(str, x + w / 2, lineCy, { size: lineSize, align: 'center', maxW: w, color: tapped ? C.ink : C.ink2, tag: 'picker:line' });
}

// Art for an offer card (offers.js): a product by sku, or an item: 'charge' (a Chick Charge), 'coins', 'chick:<id>'.
export function drawOfferArt(ctx, key, cx, cy, it, t, wallet) {
  if (IAP[key]) return drawIapArt(ctx, key, cx, cy, it, t, wallet);
  if (key === 'charge') return drawStrikeToken(ctx, 'freeze', cx, cy, it * 0.36, t, true);
  if (key === 'coins') return coinPile(ctx, cx, cy, it, 3, t);
  if (key.startsWith('chick:')) return drawStrikeToken(ctx, key.slice(6), cx, cy, it * 0.38, t, true);
}
